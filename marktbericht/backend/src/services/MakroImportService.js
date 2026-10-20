// MakroImportService.js — fuellt mb.makro_werte aus der Regionaldatenbank.
//
// v2172 · N62.16. Marcel am 13.10.2026: „Warum warten wir 20 Sekunden auf
// die Regionaldatenbank, wenn wir direkt aus unserer Datenbank die Werte
// holen koennen?"
//
// Gemessen am 13.10.2026 im Container (regionalstatistik.de, GENESIS 2020):
//   - AI008-1 / AI002-1 ohne Kreisfilter: Code 98 „zu gross".
//     Mit regionalkey "05*" kommt ein ganzes Bundesland in EINEM Abruf
//     (54 Schluessel fuer NRW, 53 bis 104 s). Also 16 Abrufe je Tabelle
//     statt 400.
//   - 12411-01-01-4 (Bevoelkerung) und 82000-07-01-4 (Einkommen) kommen
//     ohne Filter vollstaendig, je ein Abruf (rund 55 s).
//
// Die Werte aendern sich einmal im Jahr. Der Takt (starteMakroTakt) prueft
// alle 12 Stunden, ob der letzte vollstaendige Lauf aelter als 30 Tage ist,
// und holt dann alles neu. Der Import ist idempotent (UPSERT) und
// protokolliert jeden Abruf in mb.makro_abrufe — auch die Fehlschlaege.
//
// Von Hand im Container:
//   docker exec dealpilot-mb-backend npm run makro

import { pool, q } from '../lib/db.js';
import { DestatisConnector } from '../connectors/stubConnectors.js';
import { destatisEnabled } from '../lib/config.js';

export const LIZENZ = '© Statistische Ämter des Bundes und der Länder, Regionaldatenbank Deutschland, '
  + 'Datenlizenz Deutschland – Namensnennung – 2.0';
const QUELLE = 'https://www.regionalstatistik.de/genesis/online?operation=table&code=';
const LAENDER = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16'];
/* v2172b · Gemessen im zweiten Lauf: die Regionaldatenbank erlaubt hoechstens
   10 parallele Abrufe JE KONTO (Code 6), und ein Abruf, den WIR abbrechen,
   laeuft dort bis zu 15 Minuten weiter und belegt seinen Platz. Unsere
   eigenen Zeitgrenzen haben das Limit also gefuellt. Deshalb: 3 parallel
   (der Live-Rueckfall der Berichte teilt sich dasselbe Konto), 10 Minuten
   Geduld statt 4, vor dem Lauf logincheck (raeumt Haenger ab) und vor dem
   zweiten Versuch eine Pause. */
const PARALLEL = 3;
const ZEIT_MS = 600000;
const PAUSE_MS = 60000;

/* Die vier Kennzahlen. `spalte` wie in DestatisConnector.macro (v2165 gemessen). */
export const KENNZAHLEN = {
  bevoelkerung:              { tabelle: '12411-01-01-4', einheit: 'Personen' },
  einkommen_je_ew:           { tabelle: '82000-07-01-4', einheit: 'EUR je Einwohner', spalte: 'letzte' },
  arbeitslosenquote:         { tabelle: 'AI008-1',       einheit: '%',                spalte: 3 },
  wanderungssaldo_je_10000:  { tabelle: 'AI002-1',       einheit: 'je 10.000 EW',     spalte: 9 },
};

/* v2517 · GEMEINDEEBENE. Gemessen am 20.10.2026 an der Regionaldatenbank:
   je Gemeinde fuehrt sie die Bevoelkerung (12411-01-01-5) und die Zu- und
   Fortzuege (12711-91-01-5). Wanderungssaldo und Arbeitslosenquote der
   Atlas-Tabellen (AI002-1-5, AI008-1-5) sind je Gemeinde gesperrt ("."),
   Einkommen je Einwohner gibt es nur je Kreis. Der Wanderungssaldo der
   Gemeinde wird deshalb gerechnet: (Zuzuege - Fortzuege) / Bevoelkerung
   31.12. x 10.000 - nachgeprueft am Kreis Minden-Luebbecke 2024:
   (17.951 - 16.851) / 320.557 x 10.000 = 34,3, genau der Atlas-Wert. */
export const GEMEINDE_KENNZAHLEN = {
  bevoelkerung_gemeinde: { tabelle: '12411-01-01-5', einheit: 'Personen' },
  zuzuege_gemeinde:      { tabelle: '12711-91-01-5', einheit: 'Personen je Jahr' },
  fortzuege_gemeinde:    { tabelle: '12711-91-01-5', einheit: 'Personen je Jahr' },
};

function zahl(roh) {
  const s = String(roh == null ? '' : roh).replace(/"/g, '').trim();
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(s)) return null;
  return parseFloat(s.replace(/\./g, '').replace(',', '.'));
}

/* Kopfzeile einer Atlas-Tabelle: die Zeile ueber den Jahreszeilen, deren
   Spalten ab 3 Text tragen. Liefert je Spalte den Merkmalstext. */
function kopf(csv) {
  const zeilen = String(csv || '').split(/\r?\n/);
  for (const l of zeilen) {
    const c = l.split(';');
    if (/^(19|20)\d{2}$/.test((c[0] || '').trim())) break;
    if (c.length > 3 && c.slice(3).some((x) => /[A-Za-zÄÖÜäöü]/.test(x))) return c.map((x) => x.replace(/"/g, '').trim());
  }
  return [];
}

/* Atlas-/VGR-Tabelle: "Jahr;Schluessel;Name;Wert;…" -> Zeilen je Kennzahl. */
function atlasZeilen(csv, kennzahl) {
  const def = KENNZAHLEN[kennzahl];
  const k = kopf(csv);
  const out = [];
  for (const l of String(csv || '').split(/\r?\n/)) {
    const c = l.split(';');
    if (!/^(19|20)\d{2}$/.test((c[0] || '').trim())) continue;
    let idx = def.spalte;
    if (idx === 'letzte') {
      idx = null;
      for (let i = c.length - 1; i >= 3; i--) if (zahl(c[i]) != null) { idx = i; break; }
      if (idx == null) idx = c.length - 1;
    }
    const roh = (c[idx] || '').replace(/"/g, '').trim();
    out.push({
      kennzahl, ags: (c[1] || '').trim(), gebiet_name: (c[2] || '').replace(/"/g, '').trim() || null,
      jahr: parseInt(c[0], 10), wert: zahl(roh), wert_roh: roh || null,
      merkmal: k[idx] || null, stichtag: null,
    });
  }
  return kreisSchluessel(out);
}

/* Gemessen am ersten Lauf (13.10.2026): die Atlas-Tabellen schluesseln fuenf
   Kreise anders als der AgsResolver, der den Bericht fragt —
     Hamburg 02 und Berlin 11 (Land = Kreis)        -> 02000, 11000
     Region Hannover 03241001, StaedteRegion Aachen 05334002,
     Regionalverband Saarbruecken 10041100 (achtstellig) -> 03241, 05334, 10041
   Ohne diese Umschluesselung fiele genau dort jeder Bericht auf den
   langsamen Live-Abruf zurueck. Die Berliner Bezirke (11001001 …) sind
   keine Kreise und bleiben, wie sie sind. */
function kreisSchluessel(zeilen) {
  const fuenf = new Set(zeilen.filter((z) => /^\d{5}$/.test(z.ags)).map((z) => z.ags));
  for (const z of zeilen) {
    if (z.ags === '02' || z.ags === '11') z.ags += '000';
    else if (/^\d{8}$/.test(z.ags) && !z.ags.startsWith('11') && !fuenf.has(z.ags.slice(0, 5))) z.ags = z.ags.slice(0, 5);
  }
  return zeilen;
}

/* Bevoelkerung (datencsv-Pivot): je Kreis die Zeitreihe ueber den
   bewaehrten Parser des Konnektors, damit Import und Live-Abruf dasselbe lesen. */
function bevZeilen(csv) {
  const zeilen = String(csv || '').split(/\r?\n/).map((l) => l.split(';').map((c) => c.replace(/"/g, '').trim()));
  const out = [];
  for (const r of zeilen) {
    const ags = (r[0] || '').replace(/[^0-9]/g, '');
    if (!/^\d{5}$/.test(ags) || !(r[0] || '').trim().startsWith(ags)) continue;
    const name = (r[0] || '').trim().slice(5).trim() || r[1] || null;
    const reihe = DestatisConnector._parseDatencsvSeries(csv, ags) || [];
    for (const p of reihe) {
      out.push({ kennzahl: 'bevoelkerung', ags, gebiet_name: name, jahr: p.year, wert: p.value,
        wert_roh: String(p.value), merkmal: 'Bevölkerung insgesamt (Stichtag 31.12.)', stichtag: p.year + '-12-31' });
    }
  }
  /* v2172c · Hamburg und Berlin stehen in dieser Tabelle nur als Land
     (02, 11) - gemessen: nach dem ersten Lauf fehlten genau diese zwei. */
  for (const land of ['02', '11']) {
    if (out.some((z) => z.ags === land + '000')) continue;
    for (const p of DestatisConnector._parseDatencsvSeries(csv, land) || []) {
      out.push({ kennzahl: 'bevoelkerung', ags: land + '000', gebiet_name: land === '02' ? 'Hamburg' : 'Berlin',
        jahr: p.year, wert: p.value, wert_roh: String(p.value),
        merkmal: 'Bevölkerung insgesamt (Stichtag 31.12.)', stichtag: p.year + '-12-31' });
    }
  }
  return out;
}

const SPALTEN = ['kennzahl', 'ags', 'gebiet_name', 'jahr', 'wert', 'wert_roh', 'einheit', 'tabelle', 'merkmal',
  'stichtag', 'lizenz', 'quelle_url', 'ebene'];   /* v2517: ebene */
function ebeneVon(ags) {
  const a = String(ags || '');
  return a === 'DG' ? 'bund' : a.length === 2 ? 'land' : a.length === 5 ? 'kreis' : a.length === 8 ? 'gemeinde' : null;
}

async function schreiben(zeilen) {
  const m = new Map();
  for (const z of zeilen) if (z.ags && Number.isFinite(z.jahr)) m.set(z.kennzahl + '|' + z.ags + '|' + z.jahr, z);
  const alle = [...m.values()];
  const BLOCK = 800;
  for (let a = 0; a < alle.length; a += BLOCK) {
    const teil = alle.slice(a, a + BLOCK);
    const werte = [], platz = [];
    teil.forEach((z, k) => {
      const def = KENNZAHLEN[z.kennzahl] || GEMEINDE_KENNZAHLEN[z.kennzahl];
      const reihe = SPALTEN.map((s) => (s === 'einheit' ? def.einheit : s === 'tabelle' ? def.tabelle
        : s === 'lizenz' ? LIZENZ : s === 'quelle_url' ? QUELLE + def.tabelle : s === 'ebene' ? ebeneVon(z.ags) : z[s]));
      platz.push('(' + reihe.map((_, j) => '$' + (k * SPALTEN.length + j + 1)).join(',') + ', now())');
      werte.push(...reihe);
    });
    await pool.query(
      'INSERT INTO mb.makro_werte (' + SPALTEN.join(',') + ', abgerufen_am) VALUES ' + platz.join(',')
      + ' ON CONFLICT (kennzahl, ags, jahr) DO UPDATE SET gebiet_name = EXCLUDED.gebiet_name,'
      + ' wert = EXCLUDED.wert, wert_roh = EXCLUDED.wert_roh, einheit = EXCLUDED.einheit, tabelle = EXCLUDED.tabelle,'
      + ' merkmal = EXCLUDED.merkmal, stichtag = EXCLUDED.stichtag, lizenz = EXCLUDED.lizenz,'
      + ' quelle_url = EXCLUDED.quelle_url, ebene = EXCLUDED.ebene, abgerufen_am = now()',
      werte);
  }
  return alle.length;
}

async function protokoll(tabelle, filter, werte, gebiete, dauer, status, fehler) {
  try {
    await q('INSERT INTO mb.makro_abrufe (tabelle, filter, werte, gebiete, dauer_ms, status, fehler) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [tabelle, filter, werte, gebiete, dauer, status, fehler ? String(fehler).slice(0, 500) : null]);
  } catch (e) { /* Protokoll darf den Import nicht kippen */ }
}

async function einAbruf(auftrag, log) {
  const { kennzahl, filter } = auftrag;
  const def = KENNZAHLEN[kennzahl];
  const t0 = Date.now();
  try {
    const txt = await DestatisConnector._fetchTableFfcsv(def.tabelle, null, new Date().getFullYear(), filter,
      { timeoutMs: ZEIT_MS });
    const code = (String(txt).slice(0, 300).match(/"Code"\s*:\s*(\d+)/) || [])[1];
    if (code && code !== '0') throw new Error('GENESIS-Code ' + code);
    const csv = DestatisConnector._extractCsv(txt);
    const zeilen = kennzahl === 'bevoelkerung' ? bevZeilen(csv) : atlasZeilen(csv, kennzahl);
    if (!zeilen.length) throw new Error('keine Zeilen gelesen');
    const n = await schreiben(zeilen);
    const gebiete = new Set(zeilen.map((z) => z.ags)).size;
    const dauer = Date.now() - t0;
    await protokoll(def.tabelle, filter, n, gebiete, dauer, 'ok', null);
    log(`${def.tabelle.padEnd(14)} ${String(filter || 'alle').padEnd(5)} ${String(n).padStart(6)} Werte · ${String(gebiete).padStart(4)} Gebiete · ${Math.round(dauer / 1000)} s`);
    return { ok: true, kennzahl, filter, werte: n, gebiete };
  } catch (e) {
    const dauer = Date.now() - t0;
    await protokoll(def.tabelle, filter, 0, 0, dauer, 'fehler', e.message);
    log(`${def.tabelle.padEnd(14)} ${String(filter || 'alle').padEnd(5)} FEHLER ${e.message} · ${Math.round(dauer / 1000)} s`);
    return { ok: false, kennzahl, filter, fehler: e.message };
  }
}

export async function importiere({ log = console.log, kennzahlen = Object.keys(KENNZAHLEN) } = {}) {
  if (!destatisEnabled()) throw new Error('kein DESTATIS_TOKEN');
  const auftraege = [];
  for (const k of kennzahlen) {
    if (k === 'bevoelkerung' || k === 'einkommen_je_ew') auftraege.push({ kennzahl: k, filter: null });
    else for (const l of LAENDER) auftraege.push({ kennzahl: k, filter: l + '*' });
  }
  try { await DestatisConnector.logincheck(); } catch (e) { /* nur Aufraeumen */ }
  const t0 = Date.now();
  const ergebnis = [];
  let i = 0;
  async function arbeiter() {
    while (i < auftraege.length) {
      const a = auftraege[i++];
      let r = await einAbruf(a, log);
      if (!r.ok) {   /* ein zweiter Versuch je Auftrag, nach einer Pause */
        await new Promise((ok) => setTimeout(ok, PAUSE_MS));
        r = await einAbruf(a, log);
      }
      ergebnis.push(r);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, arbeiter));
  /* Deckung nennen, nicht nur „fertig". Gemessen wird gegen die HEUTIGEN
     Kreise (die der Bevoelkerung im neuesten Jahr): die Atlas-Tabellen
     fuehren zusaetzlich aufgeloeste Altkreise, und eine Zahl ueber 400
     sagte nichts darueber, ob jeder heutige Kreis da ist. */
  const deckung = await q(
    'WITH heute AS (SELECT ags FROM mb.makro_werte WHERE kennzahl = $1 AND wert IS NOT NULL '
    + '  AND jahr = (SELECT max(jahr) FROM mb.makro_werte WHERE kennzahl = $1)) '
    + 'SELECT w.kennzahl, (SELECT count(*) FROM heute) AS soll, count(DISTINCT w.ags) AS kreise, '
    + 'count(DISTINCT left(w.ags, 2)) AS laender, max(w.jahr) AS jahr '
    + 'FROM mb.makro_werte w JOIN heute h ON h.ags = w.ags WHERE w.wert IS NOT NULL '
    + 'GROUP BY w.kennzahl ORDER BY w.kennzahl', ['bevoelkerung']);
  const fehler = ergebnis.filter((r) => !r.ok);
  const voll = !fehler.length && deckung.length === Object.keys(KENNZAHLEN).length
    && deckung.every((d) => Number(d.soll) >= 395 && Number(d.kreise) >= Number(d.soll) - 5 && Number(d.laender) === 16);
  await protokoll('GESAMT', null, ergebnis.reduce((s, r) => s + (r.werte || 0), 0),
    deckung.length ? Math.min(...deckung.map((d) => Number(d.kreise))) : 0, Date.now() - t0, voll ? 'ok' : 'fehler',
    voll ? null : (fehler.length + ' Abrufe gescheitert; Deckung ' + JSON.stringify(deckung)));
  return { voll, fehler, deckung, dauer_s: Math.round((Date.now() - t0) / 1000) };
}

/* ── v2517 · Gemeinden ────────────────────────────────────────────────── */
/* Bevoelkerung je Gemeinde (datencsv-Pivot, Datumszeile + Zeile
   Insgesamt/maennlich/weiblich). Nur 8-stellige Schluessel. */
function gemBevZeilen(csv) {
  const rows = String(csv || '').split(/\r?\n/).map((l) => l.split(';').map((c) => c.replace(/"/g, '').trim()));
  let di = -1, best = 0;
  rows.forEach((r, i) => { const n = r.filter((c) => /^\d{2}\.\d{2}\.(19|20)\d{2}$/.test(c)).length; if (n > best) { best = n; di = i; } });
  if (di < 0) return [];
  const jahrSp = rows[di].map((c) => { const m = c.match(/^\d{2}\.\d{2}\.((19|20)\d{2})$/); return m ? parseInt(m[1], 10) : null; });
  const lab = rows[di + 1] || [];
  const spalten = jahrSp.map((j, i) => (j && (!lab[i] || /insgesamt/i.test(lab[i]))) ? i : -1).filter((i) => i >= 0);
  const out = [];
  for (const r of rows) {
    const ags = (r[0] || '').trim();
    if (!/^\d{8}$/.test(ags)) continue;
    for (const i of spalten) {
      const w = zahl(r[i]);
      if (w == null) continue;
      out.push({ kennzahl: 'bevoelkerung_gemeinde', ags, gebiet_name: (r[1] || '').trim() || null, jahr: jahrSp[i],
        wert: w, wert_roh: r[i], merkmal: 'Bevölkerung insgesamt (Stichtag 31.12.)', stichtag: jahrSp[i] + '-12-31' });
    }
  }
  return out;
}
/* Zu- und Fortzuege je Gemeinde (ffcsv: Jahr;Schluessel;Name;Zuzuege;Fortzuege) */
function gemWanZeilen(csv) {
  const out = [];
  for (const l of String(csv || '').split(/\r?\n/)) {
    const c = l.split(';').map((x) => x.replace(/"/g, '').trim());
    if (!/^(19|20)\d{2}$/.test(c[0] || '') || !/^\d{8}$/.test(c[1] || '')) continue;
    const jahr = parseInt(c[0], 10);
    const zu = zahl(c[3]), fort = zahl(c[4]);
    if (zu != null) out.push({ kennzahl: 'zuzuege_gemeinde', ags: c[1], gebiet_name: c[2] || null, jahr, wert: zu, wert_roh: c[3],
      merkmal: 'Zuzüge über die Gemeindegrenzen', stichtag: null });
    if (fort != null) out.push({ kennzahl: 'fortzuege_gemeinde', ags: c[1], gebiet_name: c[2] || null, jahr, wert: fort, wert_roh: c[4],
      merkmal: 'Fortzüge über die Gemeindegrenzen', stichtag: null });
  }
  return out;
}
async function gemAbruf(a, log) {
  const t0 = Date.now();
  try {
    const txt = await DestatisConnector._fetchTableFfcsv(a.tabelle, null, new Date().getFullYear(), a.filter,
      { timeoutMs: ZEIT_MS, regionalvariable: 'GEMEIN', startyear: a.von, endyear: a.bis });
    const code = (String(txt).slice(0, 300).match(/"Code"\s*:\s*(\d+)/) || [])[1];
    if (code && code !== '0') throw new Error('GENESIS-Code ' + code);
    const csv = DestatisConnector._extractCsv(txt);
    const zeilen = a.art === 'bev' ? gemBevZeilen(csv) : gemWanZeilen(csv);
    if (!zeilen.length) throw new Error('keine Zeilen gelesen');
    const n = await schreiben(zeilen);
    const gebiete = new Set(zeilen.map((z) => z.ags)).size;
    await protokoll(a.tabelle, a.filter + ' ' + a.von + '-' + a.bis, n, gebiete, Date.now() - t0, 'ok', null);
    log(a.tabelle + ' ' + a.filter + ' ' + a.von + '-' + a.bis + ': ' + n + ' Werte · ' + gebiete + ' Gemeinden · ' + Math.round((Date.now() - t0) / 1000) + ' s');
    return { ok: true, werte: n, gebiete };
  } catch (e) {
    await protokoll(a.tabelle, a.filter + ' ' + a.von + '-' + a.bis, 0, 0, Date.now() - t0, 'fehler', e.message);
    log(a.tabelle + ' ' + a.filter + ' FEHLER ' + e.message);
    return { ok: false, fehler: e.message, auftrag: a };
  }
}
/* Je Land drei Abrufe: Bevoelkerung im Anfangsjahr des Trends (wie beim
   Kreis: heute - 12), Bevoelkerung und Zu-/Fortzuege der letzten Jahre. */
export async function importiereGemeinden({ log = console.log, laender = LAENDER } = {}) {
  if (!destatisEnabled()) throw new Error('kein DESTATIS_TOKEN');
  const jetzt = new Date().getFullYear();
  const auftraege = [];
  for (const l of laender) {
    auftraege.push({ art: 'bev', tabelle: '12411-01-01-5', filter: l + '*', von: jetzt - 12, bis: jetzt - 12 });
    auftraege.push({ art: 'bev', tabelle: '12411-01-01-5', filter: l + '*', von: jetzt - 3, bis: jetzt });
    auftraege.push({ art: 'wan', tabelle: '12711-91-01-5', filter: l + '*', von: jetzt - 3, bis: jetzt });
  }
  try { await DestatisConnector.logincheck(); } catch (e) { /* nur Aufraeumen */ }
  const t0 = Date.now();
  const ergebnis = [];
  let i = 0;
  async function arbeiter() {
    while (i < auftraege.length) {
      const a = auftraege[i++];
      let r = await gemAbruf(a, log);
      if (!r.ok) { await new Promise((ok) => setTimeout(ok, PAUSE_MS)); r = await gemAbruf(a, log); }
      ergebnis.push(r);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, arbeiter));
  const deckung = await q(
    "SELECT kennzahl, count(DISTINCT ags) AS gemeinden, count(DISTINCT left(ags, 2)) AS laender, min(jahr) AS von, max(jahr) AS bis "
    + "FROM mb.makro_werte WHERE ebene = 'gemeinde' AND kennzahl = ANY($1) AND wert IS NOT NULL GROUP BY kennzahl ORDER BY kennzahl",
    [Object.keys(GEMEINDE_KENNZAHLEN)]);
  const fehler = ergebnis.filter((r) => !r.ok);
  /* rund 10.800 Gemeinden in Deutschland; 10.000 als Untergrenze */
  const voll = !fehler.length && deckung.length === 3
    && deckung.every((d) => Number(d.gemeinden) >= 10000 && Number(d.laender) === 16);
  await protokoll('GESAMT-GEMEINDE', null, ergebnis.reduce((s, r) => s + (r.werte || 0), 0),
    deckung.length ? Math.min(...deckung.map((d) => Number(d.gemeinden))) : 0, Date.now() - t0, voll ? 'ok' : 'fehler',
    voll ? null : (fehler.length + ' Abrufe gescheitert; Deckung ' + JSON.stringify(deckung)));
  return { voll, fehler, deckung, dauer_s: Math.round((Date.now() - t0) / 1000) };
}

/* ── Der Takt: alle 12 Stunden nachsehen, alle 30 Tage holen ───────────── */
const TAKT_MS = 12 * 3600 * 1000;
const ALTER_TAGE = 30;
let _laeuft = false;
async function faellig(gesamt = 'GESAMT') {
  try {
    const r = await q("SELECT max(abgerufen_am) AS t FROM mb.makro_abrufe WHERE tabelle = $1 AND status = 'ok'", [gesamt]);
    const t = r[0] && r[0].t ? new Date(r[0].t).getTime() : 0;
    return Date.now() - t > ALTER_TAGE * 86400000;
  } catch (e) { return false; }   /* Tabelle fehlt -> Migration noch nicht gelaufen */
}
async function durchgang() {
  if (_laeuft || !destatisEnabled()) return;
  if (!(await faellig())) { await durchgangGemeinden(); return; }   /* v2517: Gemeinden haben ihren eigenen Stand */
  _laeuft = true;
  try {
    const b = await importiere({ log: (s) => console.log('[makro] ' + s) });
    console.log('[makro] Lauf ' + (b.voll ? 'vollstaendig' : 'UNVOLLSTAENDIG') + ' in ' + b.dauer_s + ' s · '
      + b.deckung.map((d) => d.kennzahl + ' ' + d.kreise + ' Kreise/' + d.laender + ' Laender bis ' + d.jahr).join(' · '));
  } catch (e) { console.log('[makro] Lauf fehlgeschlagen:', e.message); }
  finally { _laeuft = false; }
  await durchgangGemeinden();   /* v2517 */
}
async function durchgangGemeinden() {
  if (_laeuft || !destatisEnabled() || !(await faellig('GESAMT-GEMEINDE'))) return;
  _laeuft = true;
  try {
    const b = await importiereGemeinden({ log: (s) => console.log('[makro-gem] ' + s) });
    console.log('[makro-gem] Lauf ' + (b.voll ? 'vollstaendig' : 'UNVOLLSTAENDIG') + ' in ' + b.dauer_s + ' s · ' + JSON.stringify(b.deckung));
  } catch (e) { console.log('[makro-gem] Lauf fehlgeschlagen:', e.message); }
  finally { _laeuft = false; }
}
export function starteMakroTakt() {
  if (String(process.env.MAKRO_IMPORT || '1') !== '1') { console.log('[makro] Takt aus (MAKRO_IMPORT=0)'); return; }
  setTimeout(durchgang, 3 * 60 * 1000);
  setInterval(durchgang, TAKT_MS);
  console.log('[makro] Takt an: alle 12 h pruefen, alle ' + ALTER_TAGE + ' Tage holen');
}

// Direktaufruf: node src/services/MakroImportService.js
if (process.argv[1] && process.argv[1].endsWith('MakroImportService.js') && process.argv[2] === 'gemeinden') {
  importiereGemeinden()
    .then((b) => { console.log(JSON.stringify(b.deckung)); console.log((b.voll ? 'FERTIG' : 'UNVOLLSTÄNDIG') + ' in ' + b.dauer_s + ' s, ' + b.fehler.length + ' Fehler'); if (!b.voll) process.exitCode = 1; })
    .catch((e) => { console.error('FEHLER', e.message); process.exitCode = 1; })
    .finally(() => pool.end());
} else if (process.argv[1] && process.argv[1].endsWith('MakroImportService.js')) {
  importiere()
    .then((b) => {
      b.deckung.forEach((d) => console.log(`DECKUNG ${d.kennzahl.padEnd(26)} ${d.kreise} Kreise · ${d.laender} Länder · bis ${d.jahr}`));
      console.log((b.voll ? 'FERTIG' : 'UNVOLLSTÄNDIG') + ` in ${b.dauer_s} s, ${b.fehler.length} Fehler`);
      if (!b.voll) process.exitCode = 1;
    })
    .catch((e) => { console.error('FEHLER', e.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
