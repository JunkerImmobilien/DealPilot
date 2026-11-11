'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/flowProfil.js — v3290 · Flow Investor, Punkt 3: Richtwerte und Ziele
 *
 * GET/PUT /api/v1/flow/profil (routes/flow.js). Auftrag:
 * Dateien/Makler-Hub/Flow-Investor-Schnittstelle.md, Punkt 3.
 *
 * KEINE DRITTE ABLAGE (Auftrag 11.11.2026). Gespeichert wird dort, wo Browser
 * und Bot schon lesen:
 *   · Investmentprofil  user_settings browser_vorgaben -> keys.dp_investment_profile
 *                       (der JSON-Text, den investment-profile.js im localStorage
 *                       fuehrt und vorgaben-sync.js hochlaedt)
 *   · Lageprofil        user_settings lage_profil -> klassen.{A,B,C}.ziel_bmr
 *   · Ziele, Alarme, Freigaben  im Investmentprofil unter dem Schluessel `flow`.
 *     investment-profile.js behaelt beim Speichern, was das Formular nicht zeigt
 *     (v1783) - der Browser traegt den Block also unveraendert mit.
 * Doppelt gefuehrt wird nichts: ziele.min_dscr IST ip.min_dscr, ziele.min_cashflow_monat
 * IST ip.min_cashflow_vor_st (dieselben Werte, die schon die Ampel faerben, v2240).
 * Neu sind min_bruttorendite, max_faktor (Kaufpreis / Jahresnettokaltmiete) und
 * max_kaufpreis.
 *
 * FREIGABEN (Marcel 11.11.2026: „automatische Kosten ja, aber gezielt genehmigen“):
 * je Stufe mpi / mpi_plus / wev einer von auto | frage | nie, Voreinstellung `frage`.
 * `auto` nur, wenn der Aufruf es ausdruecklich setzt UND eine Monatsgrenze > 0 nennt.
 * Wer `auto` setzt, wird mit Zeit und Weg vermerkt.
 *
 * Der Browser schreibt browser_vorgaben als GANZEN Blob. Damit ein Browser-Tab mit
 * altem Stand einen neueren Flow-Block nicht ueberschreibt, behaelt
 * routes/userSettings.js beim PUT den juengeren `flow`-Block (flowBewahren()).
 * ═══════════════════════════════════════════════════════════════════════════ */
const { query } = require('../db/pool');

/* Namen der Bewertungsprofile, wie dealscore2.js sie zeigt (v2548). */
const PROFIL_NAME = {
  balanced: 'Ausgewogen', conservative: 'Vorsichtig', optimistic: 'Renditeorientiert',
  lage: 'Lage-Fokus', cashflow: 'Cashflow-Fokus', sicherheit: 'Sicherheit', custom: 'Eigene Gewichte'
};
const STUFEN = ['mpi', 'mpi_plus', 'wev'];
const FREIGABE_WERTE = ['auto', 'frage', 'nie'];

/* Was der Hub im Investmentprofil setzen darf: [Schluessel, min, max] - die Felder, mit denen der
   Server rechnet (flowBerechnung PROFIL_SAETZE, Schwellen). Alles andere bleibt dem Browser. */
const IP_FELDER = [
  ['zins_override', 0.1, 15], ['tilgung_default', 0, 10], ['zinsbindung_default', 1, 40],
  ['ek_quote_default', 0, 100], ['notar_pct', 0, 5], ['grundbuch_pct', 0, 5], ['maklerkosten', 0, 10],
  ['max_ltv', 1, 150], ['min_dscr', 0, 5], ['min_cashflow_vor_st', -100000, 100000]
];
/* Ziele: [Name, Ablage (ip-Feld oder flow.ziele), min, max] */
const ZIELE = [
  ['min_bruttorendite', 'flow', 0.1, 30],
  ['min_cashflow_monat', 'ip:min_cashflow_vor_st', -100000, 100000],
  ['min_dscr', 'ip:min_dscr', 0, 5],
  ['max_faktor', 'flow', 1, 100],
  ['max_kaufpreis', 'flow', 1000, 1e9]
];

function _json(w) {
  if (typeof w === 'string') { try { return JSON.parse(w); } catch (e) { return null; } }
  return w || null;
}
function _zahl(v) {
  if (v == null || v === '') return null;
  const n = (typeof v === 'number') ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Ziele/Alarme/Freigaben aus dem Investmentprofil - mit Voreinstellungen, nie erfunden. */
function flowTeile(ip) {
  const f = (ip && ip.flow && typeof ip.flow === 'object') ? ip.flow : {};
  const fz = f.ziele || {};
  const ziele = {};
  ZIELE.forEach(([name, ablage]) => {
    ziele[name] = _zahl(ablage === 'flow' ? fz[name] : (ip || {})[ablage.slice(3)]);
  });
  const a = f.alarme || {};
  const alarme = {
    preissenkung_pct: _zahl(a.preissenkung_pct),
    unter_zielpreis: a.unter_zielpreis === true
  };
  const fr = f.freigaben || {};
  const freigaben = { monatsgrenze_eur: _zahl(fr.monatsgrenze_eur) || 0 };
  STUFEN.forEach((s) => { freigaben[s] = FREIGABE_WERTE.indexOf(fr[s]) >= 0 ? fr[s] : 'frage'; });
  /* auto ohne Monatsgrenze gilt nicht - dann wird wieder gefragt */
  if (!(freigaben.monatsgrenze_eur > 0)) STUFEN.forEach((s) => { if (freigaben[s] === 'auto') freigaben[s] = 'frage'; });
  if (fr.auto_gesetzt) freigaben.auto_gesetzt = fr.auto_gesetzt;
  return { ziele, alarme, freigaben, geaendert: f.geaendert || null };
}

/** Rein (ohne DB) - fuer flowBerechnung, den Bot und die Pruefer. */
function profilAus(browserVorgaben, lageProfil, staende) {
  const keys = (browserVorgaben && browserVorgaben.keys) || {};
  const ip = _json(keys.dp_investment_profile) || {};
  const ds = {
    preset: keys.dp_dealscore2_preset || null,
    eigen: keys.dp_dealscore_eigen || null,
    weights: keys.dp_dealscore_weights || null
  };
  const t = (staende || []).map((x) => new Date(x).getTime()).filter((x) => Number.isFinite(x));
  const presetGilt = ds.preset && PROFIL_NAME[ds.preset] ? ds.preset : 'balanced';
  const name = (ds.eigen === '1' || ds.eigen === true) ? 'Eigene Gewichte' : PROFIL_NAME[presetGilt];
  /* Ampel-Schwellen wie schwellen.js get(): nur die drei Werte, den Rest leitet der Kern ab
     (qc-heuristik.js _schwellenOk). Fehlt einer, gilt seine Vorgabe 1,2 / 90 / 0. */
  const schwellen = {};
  const md = _zahl(ip.min_dscr), ml = _zahl(ip.max_ltv), mc = _zahl(ip.min_cashflow_vor_st);
  if (md != null && md > 0) schwellen.dscrGruen = md;
  if (ml != null && ml > 0) schwellen.ltvGruen = ml;
  if (mc != null) schwellen.cfMin = mc;
  const ft = flowTeile(ip);
  return {
    vorhanden: !!browserVorgaben,
    name: name, preset: presetGilt,
    geaendert: t.length ? new Date(Math.max.apply(null, t)).toISOString() : null,
    investment: ip, lage: lageProfil || null, ds: ds, schwellen: schwellen,
    ziele: ft.ziele, alarme: ft.alarme, freigaben: ft.freigaben, flow_geaendert: ft.geaendert
  };
}

async function _einstellungen(userId) {
  const r = await query(
    'SELECT schluessel, wert, updated_at FROM user_settings WHERE user_id = $1 AND schluessel = ANY($2)',
    [userId, ['browser_vorgaben', 'lage_profil']]);
  const e = {};
  r.rows.forEach((x) => { e[x.schluessel] = { wert: _json(x.wert), updated_at: x.updated_at }; });
  return e;
}

/** Das Profil des Kontos, so wie der Browser es hochlaedt (vorgaben-sync.js, v3024). */
async function lesen(userId) {
  const e = await _einstellungen(userId);
  return profilAus(e.browser_vorgaben ? e.browser_vorgaben.wert : null,
    e.lage_profil ? e.lage_profil.wert : null,
    [e.browser_vorgaben, e.lage_profil].filter(Boolean).map((x) => x.updated_at));
}

/** Die Antwort von GET /flow/profil. */
function ansicht(p, gewichte) {
  const ip = p.investment || {};
  const investment = {};
  IP_FELDER.forEach(([k]) => { investment[k] = _zahl(ip[k]); });
  const klassen = {};
  ['A', 'B', 'C'].forEach((k) => {
    const z = p.lage && p.lage.klassen && p.lage.klassen[k] ? _zahl(p.lage.klassen[k].ziel_bmr) : null;
    klassen[k] = { ziel_bmr: z };
  });
  return {
    investment: investment,
    lage: { klassen: klassen },
    ziele: p.ziele, alarme: p.alarme, freigaben: p.freigaben,
    bewertungsprofil: { name: p.name, preset: p.preset, gewichte: gewichte || null },
    geaendert: p.geaendert, flow_geaendert: p.flow_geaendert,
    hinweis: 'Gespeichert im Investmentprofil und Lageprofil des Kontos - dieselben Werte, mit denen App, '
      + 'Telegram-Bot und /objects/:id/berechnen rechnen. Freigaben: auto nur mit monatsgrenze_eur > 0.'
  };
}

/**
 * pruefen(body, altIp, altLage, von) — rein. Gibt { ip, lage, fehler[] } zurueck.
 * Leere Strings / null loeschen einen Wert (zurueck auf die Vorgabe); unbekannte Felder -> Fehler.
 */
function pruefen(body, altIp, altLage, von) {
  const b = body || {};
  const fehler = [];
  const ip = JSON.parse(JSON.stringify(altIp || {}));
  const lage = JSON.parse(JSON.stringify(altLage || {}));
  const jetzt = new Date().toISOString();
  const bekannt = ['investment', 'lage', 'ziele', 'alarme', 'freigaben'];
  Object.keys(b).forEach((k) => { if (bekannt.indexOf(k) < 0) fehler.push('unbekannter Block: ' + k); });
  const ipFelder = [];   /* v3292 · welche Felder des Investmentprofils dieser Aufruf setzt (fuer flow_angelegt) */
  const setze = (ziel, k, roh, min, max, was) => {
    if (ziel === ip) ipFelder.push(k);
    if (roh === null || roh === '') { delete ziel[k]; return; }
    const n = _zahl(roh);
    if (n == null || n < min || n > max) { fehler.push(was + ' muss eine Zahl von ' + min + ' bis ' + max + ' sein'); return; }
    ziel[k] = n;
  };
  if (b.investment !== undefined) {
    if (!b.investment || typeof b.investment !== 'object') fehler.push('investment muss ein Objekt sein');
    else Object.keys(b.investment).forEach((k) => {
      const f = IP_FELDER.find((x) => x[0] === k);
      if (!f) { fehler.push('investment.' + k + ' ist nicht setzbar'); return; }
      setze(ip, k, b.investment[k], f[1], f[2], 'investment.' + k);
    });
  }
  let flowGeaendert = false;
  ip.flow = (ip.flow && typeof ip.flow === 'object') ? ip.flow : {};
  if (b.ziele !== undefined) {
    if (!b.ziele || typeof b.ziele !== 'object') fehler.push('ziele muss ein Objekt sein');
    else Object.keys(b.ziele).forEach((k) => {
      const z = ZIELE.find((x) => x[0] === k);
      if (!z) { fehler.push('ziele.' + k + ' ist unbekannt'); return; }
      if (z[1] === 'flow') { ip.flow.ziele = ip.flow.ziele || {}; setze(ip.flow.ziele, k, b.ziele[k], z[2], z[3], 'ziele.' + k); flowGeaendert = true; }
      else setze(ip, z[1].slice(3), b.ziele[k], z[2], z[3], 'ziele.' + k);
    });
  }
  if (b.alarme !== undefined) {
    if (!b.alarme || typeof b.alarme !== 'object') fehler.push('alarme muss ein Objekt sein');
    else {
      ip.flow.alarme = ip.flow.alarme || {};
      Object.keys(b.alarme).forEach((k) => {
        if (k === 'preissenkung_pct') setze(ip.flow.alarme, k, b.alarme[k], 0.1, 100, 'alarme.preissenkung_pct');
        else if (k === 'unter_zielpreis') {
          if (typeof b.alarme[k] !== 'boolean') fehler.push('alarme.unter_zielpreis muss true oder false sein');
          else ip.flow.alarme[k] = b.alarme[k];
        } else fehler.push('alarme.' + k + ' ist unbekannt');
      });
      flowGeaendert = true;
    }
  }
  if (b.freigaben !== undefined) {
    if (!b.freigaben || typeof b.freigaben !== 'object') fehler.push('freigaben muss ein Objekt sein');
    else {
      const fr = Object.assign({}, ip.flow.freigaben || {});
      Object.keys(b.freigaben).forEach((k) => {
        if (k === 'monatsgrenze_eur') setze(fr, k, b.freigaben[k], 0, 100000, 'freigaben.monatsgrenze_eur');
        else if (STUFEN.indexOf(k) >= 0) {
          if (FREIGABE_WERTE.indexOf(b.freigaben[k]) < 0) fehler.push('freigaben.' + k + ' muss auto, frage oder nie sein');
          else fr[k] = b.freigaben[k];
        } else fehler.push('freigaben.' + k + ' ist unbekannt');
      });
      const autoNeu = STUFEN.filter((s) => b.freigaben[s] === 'auto');
      if (STUFEN.some((s) => fr[s] === 'auto') && !(_zahl(fr.monatsgrenze_eur) > 0)) {
        fehler.push('auto braucht eine Monatsgrenze: freigaben.monatsgrenze_eur > 0 (Marcel 11.11.2026: automatische Kosten nur gezielt genehmigt)');
      }
      if (autoNeu.length) fr.auto_gesetzt = { stufen: autoNeu, am: jetzt, von: von || null };
      ip.flow.freigaben = fr;
      flowGeaendert = true;
    }
  }
  if (flowGeaendert) ip.flow.geaendert = jetzt;
  if (!Object.keys(ip.flow).length) delete ip.flow;
  if (b.lage !== undefined) {
    const kl = b.lage && b.lage.klassen;
    if (!kl || typeof kl !== 'object') fehler.push('lage muss { klassen: { A|B|C: { ziel_bmr } } } sein');
    else Object.keys(kl).forEach((k) => {
      if (['A', 'B', 'C'].indexOf(k) < 0) { fehler.push('lage.klassen.' + k + ' ist unbekannt (A, B, C)'); return; }
      const e = kl[k] || {};
      Object.keys(e).forEach((f) => { if (f !== 'ziel_bmr') fehler.push('lage.klassen.' + k + '.' + f + ' ist nicht setzbar'); });
      lage.klassen = lage.klassen || {};
      lage.klassen[k] = Object.assign({}, lage.klassen[k] || {});
      if ('ziel_bmr' in e) setze(lage.klassen[k], 'ziel_bmr', e.ziel_bmr, 0.1, 30, 'lage.klassen.' + k + '.ziel_bmr');
    });
  }
  return { ip: ip, lage: lage, fehler: fehler, lageGeaendert: b.lage !== undefined, ipFelder: ipFelder };
}

/** PUT /flow/profil. Schreibt in browser_vorgaben (Investmentprofil) und lage_profil - keine dritte Ablage. */
async function setzen(userId, body, von) {
  const e = await _einstellungen(userId);
  const bv = (e.browser_vorgaben && e.browser_vorgaben.wert && typeof e.browser_vorgaben.wert === 'object')
    ? e.browser_vorgaben.wert : null;
  const altIp = bv && bv.keys ? (_json(bv.keys.dp_investment_profile) || {}) : {};
  const altLage = e.lage_profil ? (e.lage_profil.wert || {}) : {};
  const p = pruefen(body, altIp, altLage, von);
  if (p.fehler.length) return { ok: false, fehler: p.fehler };
  /* Den Blob so weiterschreiben, wie der Browser ihn kennt: keys bleiben, nur dp_investment_profile neu. */
  const neuBv = blobNeu(bv, p, userId);
  await query(
    `INSERT INTO user_settings (user_id, schluessel, wert, updated_at) VALUES ($1, 'browser_vorgaben', $2::jsonb, NOW())
     ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = $2::jsonb, updated_at = NOW()`,
    [userId, JSON.stringify(neuBv)]);
  if (p.lageGeaendert) {
    await query(
      `INSERT INTO user_settings (user_id, schluessel, wert, updated_at) VALUES ($1, 'lage_profil', $2::jsonb, NOW())
       ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = $2::jsonb, updated_at = NOW()`,
      [userId, JSON.stringify(p.lage)]);
  }
  return { ok: true };
}

/**
 * v3292 · blobNeu(bv, p, userId) — rein. Der neue browser_vorgaben-Blob nach einem PUT /flow/profil.
 * Hat das Konto noch KEINEN Blob (oder einen, den der Hub angelegt hat und den der Browser noch nicht
 * zusammengefuehrt hat), traegt er die Marke flow_angelegt { am, felder }. vorgaben-sync.js fuehrt dann
 * beim ersten Laden zusammen, statt die lokalen Vorgaben zu ersetzen (Ursache: dort entfernt setzen(server)
 * jeden lokalen Schluessel, der auf dem Server fehlt). Ein vom Browser geschriebener Blob hat keine Marke.
 */
function blobNeu(bv, p, userId) {
  const neu = Object.assign({}, bv || { nutzer: userId }, {
    keys: Object.assign({}, (bv && bv.keys) || {}, { dp_investment_profile: JSON.stringify(p.ip) }),
    stand: new Date().toISOString()
  });
  if (!bv || bv.flow_angelegt) {
    const alt = (bv && bv.flow_angelegt) || {};
    const felder = Array.from(new Set((alt.felder || []).concat(p.ipFelder || [])));
    neu.flow_angelegt = { am: alt.am || neu.stand, felder: felder };
  }
  return neu;
}

/**
 * flowBewahren(neuWert, altWert) — fuer PUT /user-settings/browser_vorgaben (routes/userSettings.js).
 * Der Browser schreibt den ganzen Blob aus seinem localStorage. Traegt sein Investmentprofil einen
 * AELTEREN (oder gar keinen) `flow`-Block als der gespeicherte, bleibt der gespeicherte - sonst
 * loeschte ein offener Tab, was der Hub inzwischen gesetzt hat. Alles andere gewinnt wie bisher.
 */
function flowBewahren(neuWert, altWert) {
  try {
    const altIp = altWert && altWert.keys ? _json(altWert.keys.dp_investment_profile) : null;
    if (!altIp || !altIp.flow) return neuWert;
    if (!neuWert || !neuWert.keys || neuWert.keys.dp_investment_profile == null) return neuWert;
    const neuIp = _json(neuWert.keys.dp_investment_profile);
    if (!neuIp || typeof neuIp !== 'object') return neuWert;
    const tA = new Date((altIp.flow && altIp.flow.geaendert) || 0).getTime() || 0;
    const tN = new Date((neuIp.flow && neuIp.flow.geaendert) || 0).getTime() || 0;
    if (neuIp.flow && tN >= tA) return neuWert;
    neuIp.flow = altIp.flow;
    return Object.assign({}, neuWert, { keys: Object.assign({}, neuWert.keys, { dp_investment_profile: JSON.stringify(neuIp) }) });
  } catch (e) { return neuWert; }
}

module.exports = { lesen, setzen, pruefen, ansicht, profilAus, flowTeile, flowBewahren, blobNeu,   /* v3292: blobNeu */
  PROFIL_NAME, IP_FELDER, ZIELE, STUFEN };
