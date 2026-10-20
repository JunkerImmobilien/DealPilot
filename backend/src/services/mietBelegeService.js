'use strict';
/* ══════════════════════════════════════════════════════════════════════
   mietBelegeService.js — v2500 · Belegte Vergleichswerte fuer die
   Pilot-Mietpreis-Analyse (Reiter Miete)

   Marcel am 20.10.2026: „Schau lieber in der Pilot-Mietpreis-Analyse, ob
   wir dort genauer werden koennen mit Quellen etc. Vielleicht holen wir uns
   auch mehrere Vergleichswerte, und fuer das Mietausfallrisiko auch. Da
   koennten wir den Zensus gegenueberstellen, wenn es passt."

   GEMESSEN vorher (v1242–v2499): die Analyse war reine KI mit Websuche
   (`/ai/ds2-suggest`). Kein einziger Wert aus DealPilots eigenen Daten kam
   im Prompt an — weder die amtliche Mietpreisuebersicht noch die
   Angebotsmieten des Marktberichts noch der Zensus, obwohl alle drei fuer
   genau dieses Objekt in der Datenbank liegen.

   Hier wird SERVERSEITIG gesammelt (wie der Marktzins v1951): die Werte sind
   Tatsachenbehauptungen im Ergebnis, was der Browser schickt, koennte er
   erfunden haben. user_id kommt immer aus dem Token.

   Drei Quellen, alle aus dem mb-Backend im selben Netz, je mit Frist:
     1. der LETZTE Marktbericht des Objekts (/objects/history -> /reports/one):
        amtliche Vergleichsmiete (Mietpreisuebersicht des Gutachterausschusses),
        Angebotsmieten (Median, Q25/Q75, Zahl, Umkreis), Marktueblichkeits-
        band und die im Ertragswert angesetzte Miete
     2. Zensus 2022 (/zensus/objekt, mb.zensus_werte): Leerstand der Gemeinde,
        sonst des Kreises — als GEGENUEBERSTELLUNG zum Mietausfallrisiko,
        mit Stichtag 15.05.2022
     3. Regionaldatenbank (/lage/gemessen ohne Adresse = ohne Umfeld-Abruf,
        also ohne Kosten): Bevoelkerungstrend des Kreises

   Kein Treffer heisst kein Wert: jede fehlende Angabe kommt als
   `{ fehlt: true, grund, weg }` zurueck — der Kunde bekommt den Weg dorthin.

   QUELLEN NACH AUSSEN NEUTRAL (Marcel 14.10.2026): die Angebotsmieten
   heissen „aktueller Marktdurchschnitt". Der Anbieter steht im Bericht unter
   rent.source und wird hier NICHT mitgegeben.
   ══════════════════════════════════════════════════════════════════════ */

const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');

function _n(v) {
  if (v == null || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}
function _r2(x) { return x == null ? null : Math.round(x * 100) / 100; }

async function _json(url, ms) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms || 4000) });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

/* Dieselben Schwellen wie der Leerstands-Anhalt im Reiter Miete
   (zensus-info.js, v2220): ein VORSCHLAG an der Fluktuationsreserve von
   2–3 %, keine amtliche Tabelle. Sie stehen im Ergebnis sichtbar dabei. */
const LEER_STUFEN = [
  [1.5, 'sehr_niedrig', 'Sehr niedrig'],
  [3, 'niedrig', 'Niedrig'],
  [5, 'mittel', 'Mittel'],
  [8, 'erhoeht', 'Erhöht'],
  [Infinity, 'hoch', 'Hoch']
];
const LEER_SCHWELLEN_TEXT = 'unter 1,5 % sehr niedrig · unter 3 % niedrig · unter 5 % mittel · unter 8 % erhöht · darüber hoch (Vorschlag an der Fluktuationsreserve, keine amtliche Tabelle)';

function leerAnhalt(pct) {
  const p = _n(pct);
  if (p == null) return null;
  for (const s of LEER_STUFEN) if (p < s[0]) return { wert: s[1], wort: s[2] };
  return null;
}

function _datum(d) {
  if (!d) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
}

/* ── 1 · Marktbericht ─────────────────────────────────────────────────── */
function ausBericht(data, row, ort) {
  const d = data || {};
  const cc = d.cross_check || {};
  const bericht = {
    datum: _datum(row && row.created_at),
    stufe: _n(d.ref && d.ref.wert_stufe),
    adresse: (row && row.address) || (d.ref && d.ref.address) || null
  };

  /* amtliche Vergleichsmiete — die Mietpreisuebersicht des Ausschusses */
  let amtlich;
  const am = cc.amtliche_miete;
  if (am && am.verfuegbar && _n(am.miete_qm) != null) {
    amtlich = {
      wert_qm: _r2(_n(am.miete_qm)),
      quelle: am.quelle || null,              /* amtlich — darf genannt werden */
      ausschuss: am.ausschuss || null,
      ausserhalb: !!am.ausserhalb_tabelle,
      hinweis: am.ausserhalb_hinweis || null,
      stand: bericht.datum
    };
  } else {
    amtlich = {
      fehlt: true,
      grund: am ? (am.grund || 'nicht_verfuegbar') : (bericht.stufe === 3 ? 'nicht_verfuegbar' : 'erst_mit_wertermittlung'),
      hinweis: am && am.hinweis ? am.hinweis : null,
      weg: 'Mietpreisübersicht des zuständigen Gutachterausschusses oder qualifizierter Mietspiegel der Gemeinde'
        + (ort ? ' ' + ort : '') + ' — dort nachsehen und den Wert als Marktmiete eintragen.'
        + (am ? '' : ' DealPilot ermittelt die amtliche Vergleichsmiete mit dem Marktbericht Stufe 3 (Wertermittlung), wo der Ausschuss eine Übersicht veröffentlicht.')
    };
  }

  /* aktueller Marktdurchschnitt — Angebotsmieten im Umkreis */
  const rent = d.rent || {};
  const vin = (d.valuation && d.valuation.inputs) || {};
  const med = _n(rent.median_per_sqm) != null ? _n(rent.median_per_sqm) : _n(vin.market_rent_sqm);
  let markt;
  if (med != null && med > 0 && !rent.enthaelt_demodaten) {
    markt = {
      wert_qm: _r2(med),
      q25_qm: _r2(_n(rent.q25_per_sqm)),
      q75_qm: _r2(_n(rent.q75_per_sqm)),
      anzahl: _n(rent.sample_size),
      umkreis_km: _n(rent.used_radius_m) != null ? Math.round(_n(rent.used_radius_m) / 100) / 10 : null,
      trend_pct_pa: _n(d.rent_trend_pct),
      stand: bericht.datum
    };
  } else {
    markt = { fehlt: true, grund: rent.enthaelt_demodaten ? 'demodaten' : 'keine_angebote',
      weg: 'Im Marktbericht lagen keine Mietangebote im Umkreis vor. Neuer Abruf mit größerem Umkreis oder eigene Recherche der aktuellen Angebotsmieten.' };
  }

  /* Marktueblichkeitsband (v2382) — nur mit Wertermittlung */
  const mb = cc.miete_band || (cc.ertragswert && cc.ertragswert.miete_band) || null;
  const band = (mb && _n(mb.unten_qm) != null && _n(mb.oben_qm) != null)
    ? { unten_qm: _r2(_n(mb.unten_qm)), oben_qm: _r2(_n(mb.oben_qm)), lage: mb.lage || null, regel: mb.regel || null }
    : null;

  /* die im Ertragswert angesetzte Miete */
  const ew = cc.ertragswert || {};
  const ertrag = (ew.available && _n(ew.miete_qm) != null)
    ? { wert_qm: _r2(_n(ew.miete_qm)), quelle: ew.miete_quelle || null }
    : null;

  return { bericht, amtlich, markt, band, ertrag };
}

/* ── 2 · Zensus 2022 ──────────────────────────────────────────────────── */
function ausZensus(z) {
  if (!z || !z.available) {
    return { fehlt: true, grund: z && z.reason ? z.reason : 'keine_zensuswerte',
      weg: 'Für diese PLZ liegen in DealPilots Zensus-Tabelle keine Werte vor. Amtliche Quelle: ergebnisse.zensus2022.de (Gebäude- und Wohnungszählung, Gemeinde).' };
  }
  const g = z.gemeinde || null, k = z.kreis || null;
  /* Gemeinde vor Kreis — aber je Kennzahl, und die Ebene steht dabei */
  const b = (g && _n(g.leerstandsquote_marktaktiv) != null) ? g : ((k && _n(k.leerstandsquote_marktaktiv) != null) ? k : null);
  const bg = b || g || k;
  if (!bg) return { fehlt: true, grund: 'keine_ebene', weg: 'ergebnisse.zensus2022.de' };
  let lang = null;
  (bg.leerstandsdauer || []).forEach(function (x) { if (/12 Monaten oder l/i.test(String(x.text || ''))) lang = _n(x.anteil_pct); });
  const klasse = function (feld) {
    const a = g && g[feld] && _n(g[feld].wert) != null ? [g[feld], 'Gemeinde'] : (k && k[feld] && _n(k[feld].wert) != null ? [k[feld], 'Kreis'] : null);
    return a ? { klasse: a[0].klasse, pct: _n(a[0].wert), ebene: a[1] } : null;
  };
  const mak = b ? _n(b.leerstandsquote_marktaktiv) : null;
  return {
    stichtag: '2022-05-15',
    ebene: bg === g ? 'Gemeinde' : 'Kreis',
    name: bg.name || null,
    marktaktiv_pct: mak,
    gesamt_pct: _n(bg.leerstandsquote),
    dauerleer_anteil_pct: lang,
    nach_baujahr: klasse('leerstand_baujahr'),
    nach_groesse: klasse('leerstand_flaeche'),
    anhalt: leerAnhalt(mak),
    schwellen: LEER_SCHWELLEN_TEXT,
    quelle: 'Zensus 2022 (Stichtag 15.05.2022), © Statistische Ämter des Bundes und der Länder, Datenlizenz Deutschland – Namensnennung – 2.0'
  };
}

/* ── 3 · Regionaldatenbank ────────────────────────────────────────────── */
function ausLage(l) {
  const f = (l && l.felder) || {};
  const bv = f.ds2_bevoelkerung;
  const bevoelkerung = (bv && _n(bv.wert) != null)
    ? { trend_pct_pa: _n(bv.wert), stufe: bv.stufe || null, stand: bv.stand || null, ebene: 'Kreis',
        quelle: 'Regionaldatenbank der Statistischen Ämter, Tabelle 12411-01-01-4 (Bevölkerungsstand), Trend je Jahr' }
    : { fehlt: true, weg: 'Bevölkerungsstand des Kreises: regionalstatistik.de (Tabelle 12411-01-01-4).' };
  return { bevoelkerung };
}

/* ── Sammeln ──────────────────────────────────────────────────────────── */
async function sammeln(opt) {
  const o = opt || {};
  const out = { bericht: null, amtlich: null, markt: null, band: null, ertrag: null, ist_qm: _r2(_n(o.istQm)),
    leerstand: null, bevoelkerung: null,
    /* Nicht in DealPilots Daten — ausdruecklich als fehlend, damit das Modell
       keine Zahl dafuer recherchiert und neben gemessene stellt. */
    haushalte: { fehlt: true, weg: 'DealPilots Regionaldaten führen keine Haushaltszahlen. Haushaltsvorausberechnung des Statistischen Landesamts.' },
    angebotsdauer_miete: { fehlt: true, weg: 'Gemessen wird die Angebotsdauer nur bei Kaufangeboten, nicht bei Mietangeboten.' }
  };
  const plz = /^\d{5}$/.test(String(o.plz || '')) ? String(o.plz) : null;
  const ort = o.ort ? String(o.ort).slice(0, 80) : '';

  const hist = (o.userId && o.objId)
    ? _json(MB_BASE + '/objects/history?user_id=' + encodeURIComponent(o.userId) + '&ref=' + encodeURIComponent(o.objId), 4000)
    : Promise.resolve(null);
  const zq = plz
    ? _json(MB_BASE + '/zensus/objekt?plz=' + plz + '&ort=' + encodeURIComponent(ort)
        + '&baujahr=' + encodeURIComponent(o.baujahr || '') + '&wfl=' + encodeURIComponent(o.wflJeWohnung || ''), 4000)
    : Promise.resolve(null);
  /* ohne adresse: kein Geocoding, kein Umfeld-Abruf — nur Tabellen */
  const lq = plz ? _json(MB_BASE + '/lage/gemessen?plz=' + plz + '&ort=' + encodeURIComponent(ort), 4000) : Promise.resolve(null);

  const [h, z, l] = await Promise.all([hist, zq, lq]);

  const reps = ((h && h.history) || []).filter(function (x) { return x && x.report_id != null; })
    .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
  const last = reps.length ? reps[reps.length - 1] : null;
  if (last) {
    const one = await _json(MB_BASE + '/reports/one?id=' + encodeURIComponent(last.report_id) + '&user_id=' + encodeURIComponent(o.userId), 5000);
    if (one && one.data) Object.assign(out, ausBericht(one.data, last, ort));
  }
  if (!out.bericht) {
    const weg = 'Noch kein DealPilot-Marktbericht zu diesem Objekt (Reiter Objekt → Marktbericht). Erst er liefert Angebotsmieten und — mit der Wertermittlung — die amtliche Vergleichsmiete.';
    out.amtlich = { fehlt: true, grund: 'kein_bericht', weg: weg };
    out.markt = { fehlt: true, grund: 'kein_bericht', weg: weg };
  }
  out.leerstand = plz ? ausZensus(z) : { fehlt: true, grund: 'keine_plz', weg: 'PLZ im Reiter Objekt eintragen.' };
  out.bevoelkerung = plz ? ausLage(l).bevoelkerung : { fehlt: true, grund: 'keine_plz', weg: 'PLZ im Reiter Objekt eintragen.' };
  return out;
}

module.exports = { sammeln, ausBericht, ausZensus, ausLage, leerAnhalt, LEER_STUFEN, LEER_SCHWELLEN_TEXT };
