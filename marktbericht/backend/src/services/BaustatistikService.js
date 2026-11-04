// BaustatistikService.js — v3172 · N121 Marktstatistik je Kreis (Portfolio-Modul, Marcel 04.11.2026)
//
// Fuellt mb.baustatistik und liefert daraus /market-stats/baukosten und /market-stats/index.
// Gemessen am 04.11.2026 (Staging):
//   - Veranschlagte Kosten des Bauwerks (Merkmal VKB001, Tsd. EUR) gibt es amtlich NUR je Land und Bund:
//     GENESIS-Online 31111-0100 (Bundeslaender) und 31111-0001 (Deutschland), mit Wohnflaeche (FLC014,
//     1000 qm), Wohnungen (WOHN01) und Gebaeuden (BAU015) je Gebaeudeart. NRW 2024 Wohngebaeude-Neubau:
//     6.993.093 TEUR / 2.983 Tsd. qm = rund 2.344 EUR/qm.
//   - Je Kreis fuehrt die Regionaldatenbank nur Gebaeude, Wohnungen, Wohnflaeche (31111-01-02-4 genehmigt,
//     31121-01-02-4 fertiggestellt) - die Kostentabellen antworten auf Kreisebene mit Code 104.
//   - Bauland je Kreis: 61511-01-03-4 (Faelle, Flaeche, Kaufsumme, Kaufwert je qm; insgesamt und baureif).
// Regel der Anforderung: kein Wert erfunden. Ein Kreis bekommt baukosten = null und daneben den
// LANDESwert, ausdruecklich als solcher gekennzeichnet.
//
// Von Hand im Container:  docker exec dealpilot-mb-backend node src/services/BaustatistikService.js

import { pool, q } from '../lib/db.js';
import { DestatisConnector as D } from '../connectors/stubConnectors.js';
import { destatisEnabled } from '../lib/config.js';
import { entpackeZip } from '../lib/destatis_reihen.js';
import { BPI_TABELLE } from '../lib/baupreisindex.js';   /* v3172b */

export const LIZENZ = 'Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2-0)';
const QUELLE_REGIO = 'Statistische Ämter des Bundes und der Länder, Regionaldatenbank Deutschland';
const QUELLE_GENESIS = 'Statistisches Bundesamt (Destatis), GENESIS-Online';
const REGIO_URL = 'https://www.regionalstatistik.de/genesis/online?operation=table&code=';
const LAENDER = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16'];
const LAND_KUERZEL = { '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE', '07': 'RP', '08': 'BW', '09': 'BY',
  '10': 'SL', '11': 'BE', '12': 'BB', '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH' };
const PARALLEL = 3, ZEIT_MS = 600000, PAUSE_MS = 60000, JAHRE = 5;
const DUENN_UNTER = 10;

function zahl(roh) {
  const s = String(roh == null ? '' : roh).replace(/"/g, '').trim();
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(s)) return null;
  return parseFloat(s.replace(/\./g, '').replace(',', '.'));
}
function ebeneVon(ags) { const a = String(ags || ''); return a === 'DG' ? 'bund' : a.length === 2 ? 'land' : a.length === 5 ? 'kreis' : null; }
/* Dieselbe Umschluesselung wie MakroImportService.kreisSchluessel (gemessen 13.10.2026) */
function kreisSchluessel(zeilen) {
  const fuenf = new Set(zeilen.filter((z) => /^\d{5}$/.test(z.ags)).map((z) => z.ags));
  for (const z of zeilen) {
    if (z.ags === '02' || z.ags === '11') { if (z.ebeneKreis) z.ags += '000'; }
    else if (/^\d{8}$/.test(z.ags) && !z.ags.startsWith('11') && !fuenf.has(z.ags.slice(0, 5))) z.ags = z.ags.slice(0, 5);
  }
  return zeilen;
}

/* ── Regionaldatenbank: Kreistabellen ─────────────────────────────────── */
// 31111-01-02-4 / 31121-01-02-4: Jahr;AGS;Name;Geb.ges;Geb.1W;Geb.2W;Geb.3+;Whg.ges;Whg.1W;Whg.2W;Whg.3+;Wohnflaeche(1000 qm)
const BAU_SPALTEN = [
  [3, 'gebaeude', 'insgesamt'], [4, 'gebaeude', '1_wohnung'], [5, 'gebaeude', '2_wohnungen'], [6, 'gebaeude', '3_und_mehr'],
  [7, 'wohnungen', 'insgesamt'], [8, 'wohnungen', '1_wohnung'], [9, 'wohnungen', '2_wohnungen'], [10, 'wohnungen', '3_und_mehr'],
  [11, 'wohnflaeche_qm', 'insgesamt'],
];
function bauZeilen(csv, praefix, tabelle) {
  const out = [];
  for (const l of String(csv || '').split(/\r?\n/)) {
    const c = l.split(';');
    if (!/^(19|20)\d{2}$/.test((c[0] || '').trim())) continue;
    const ags = (c[1] || '').trim(), name = (c[2] || '').replace(/"/g, '').trim();
    if (!/^\d{5}$|^\d{8}$|^(02|11)$/.test(ags)) continue;   /* nur Kreise (Land/RB stehen auch drin) */
    for (const [i, k, g] of BAU_SPALTEN) {
      let w = zahl(c[i]);
      if (w != null && k === 'wohnflaeche_qm') w = Math.round(w * 1000);
      out.push({ kennzahl: praefix + '_' + k, ags, ebeneKreis: true, gebiet_name: name, jahr: parseInt(c[0], 10), gruppe: g, wert: w, tabelle });
    }
  }
  return kreisSchluessel(out);
}
// 61511-01-03-4: Jahr;AGS;Name;Merkmal;Einheit;Insgesamt;baureifes Land
const BAULAND = { 'Veräußerungsfälle von Bauland': ['bauland_faelle', 1], 'Veräußerte Baulandfläche': ['bauland_flaeche_qm', 1000],
  'Kaufsumme': ['bauland_kaufsumme_teur', 1], 'Durchschnittlicher Kaufwert je qm': ['bauland_eur_qm', 1] };
function baulandZeilen(csv, tabelle) {
  const out = [];
  for (const l of String(csv || '').split(/\r?\n/)) {
    const c = l.split(';');
    if (!/^(19|20)\d{2}$/.test((c[0] || '').trim())) continue;
    const ags = (c[1] || '').trim(), m = BAULAND[(c[3] || '').replace(/"/g, '').trim()];
    if (!m || !/^\d{5}$|^\d{8}$|^(02|11)$/.test(ags)) continue;
    const name = (c[2] || '').replace(/"/g, '').trim();
    [[5, 'insgesamt'], [6, 'baureif']].forEach(([i, g]) => {
      const w = zahl(c[i]);
      out.push({ kennzahl: m[0], ags, ebeneKreis: true, gebiet_name: name, jahr: parseInt(c[0], 10), gruppe: g, wert: w == null ? null : w * m[1], tabelle });
    });
  }
  return kreisSchluessel(out);
}

/* ── GENESIS-Online: Land und Bund (Kosten) ───────────────────────────── */
const MERKMAL = { VKB001: ['gen_kosten_teur', 1], FLC014: ['gen_wohnflaeche_qm', 1000], WOHN01: ['gen_wohnungen', 1], BAU015: ['gen_gebaeude', 1] };
function gruppeAus(label) {
  const t = String(label || '').trim();
  if (/^Wohngebäude$/i.test(t)) return 'insgesamt';
  if (/mit 1 Wohnung\b/i.test(t)) return '1_wohnung';
  if (/mit 2 Wohnungen/i.test(t)) return '2_wohnungen';
  if (/mit 3 (oder|und) mehr Wohnungen/i.test(t)) return '3_und_mehr';
  return null;
}
export function genesisZeilen(txt, tabelle) {
  const z = String(txt || '').split(/\r?\n/);
  const kopf = (z[0] || '').split(';');
  const ix = (n) => kopf.indexOf(n);
  const iZeit = ix('time'), iWert = ix('value'), iMerk = ix('value_variable_code');
  const out = [], unbekannt = new Set();
  for (let r = 1; r < z.length; r++) {
    const c = z[r].split(';'); if (c.length < kopf.length - 1) continue;
    const mk = MERKMAL[c[iMerk]]; if (!mk) continue;
    let land = 'DG', btk = null, gb = null;
    for (let k = 1; k <= 5; k++) {
      const vc = c[ix(k + '_variable_code')]; if (vc == null) continue;
      const ac = c[ix(k + '_variable_attribute_code')], al = c[ix(k + '_variable_attribute_label')];
      if (vc === 'DLAND') land = ac;
      else if (vc === 'BAUTK1') btk = ac;
      else if (vc === 'BAUGB1') gb = al;
    }
    if (btk !== 'BTK-GEB-NEU') continue;   /* nur Errichtung neuer Gebaeude */
    const g = gruppeAus(gb); if (!g) { if (/Wohngeb/i.test(gb || '')) unbekannt.add(gb); continue; }
    const w = zahl(c[iWert]);
    out.push({ kennzahl: mk[0], ags: land, gebiet_name: null, jahr: parseInt(c[iZeit], 10), gruppe: g, wert: w == null ? null : w * mk[1], tabelle });
  }
  if (unbekannt.size) console.log('[baustatistik] Gebaeudeart nicht zugeordnet: ' + [...unbekannt].join(' | '));
  return out;
}
async function holeGenesis(tabelle, jahrVon, jahrBis) {
  const tok = process.env.GENESIS_TOKEN || '';
  if (!tok) throw new Error('kein GENESIS_TOKEN');
  const base = process.env.GENESIS_BASE || 'https://genesis.destatis.de/genesisWS/rest/2020';
  const jahr = new Date().getFullYear();
  const body = new URLSearchParams({ name: tabelle, area: 'all', compress: 'false', format: 'ffcsv', language: 'de',
    startyear: String(jahrVon || jahr - JAHRE), endyear: String(jahrBis || jahr) }).toString();
  const r = await fetch(base + '/data/tablefile', { method: 'POST', body,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', username: tok, password: process.env.GENESIS_PASSWORD || '' } });
  const buf = Buffer.from(await r.arrayBuffer());
  const txt = (buf[0] === 0x50 && buf[1] === 0x4b ? entpackeZip(buf) : buf).toString('utf8').replace(/^﻿/, '');
  if (!r.ok || /^\s*\{/.test(txt)) throw new Error('GENESIS: ' + txt.slice(0, 160));
  return txt;
}

/* ── Schreiben, Protokoll, Import ─────────────────────────────────────── */
async function schreiben(zeilen) {
  const m = new Map();
  for (const z of zeilen) if (z.ags && Number.isFinite(z.jahr)) m.set([z.kennzahl, z.ags, z.jahr, z.gruppe].join('|'), z);
  const alle = [...m.values()], S = ['kennzahl', 'ags', 'jahr', 'gruppe', 'ebene', 'gebiet_name', 'wert', 'tabelle'];
  for (let a = 0; a < alle.length; a += 800) {
    const teil = alle.slice(a, a + 800), werte = [], platz = [];
    teil.forEach((z, k) => {
      const reihe = [z.kennzahl, z.ags, z.jahr, z.gruppe, ebeneVon(z.ags), z.gebiet_name, z.wert, z.tabelle];
      platz.push('(' + reihe.map((_, j) => '$' + (k * S.length + j + 1)).join(',') + ', now())');
      werte.push(...reihe);
    });
    await pool.query('INSERT INTO mb.baustatistik (' + S.join(',') + ', abgerufen_am) VALUES ' + platz.join(',')
      + ' ON CONFLICT (kennzahl, ags, jahr, gruppe) DO UPDATE SET ebene = EXCLUDED.ebene,'
      + ' gebiet_name = COALESCE(EXCLUDED.gebiet_name, mb.baustatistik.gebiet_name), wert = EXCLUDED.wert,'
      + ' tabelle = EXCLUDED.tabelle, abgerufen_am = now()', werte);
  }
  return alle.length;
}
async function protokoll(tabelle, filter, werte, dauer, status, fehler) {
  try { await q('INSERT INTO mb.baustatistik_abrufe (tabelle, filter, werte, dauer_ms, status, fehler) VALUES ($1,$2,$3,$4,$5,$6)',
    [tabelle, filter, werte, dauer, status, fehler ? String(fehler).slice(0, 500) : null]); } catch (e) { /* still */ }
}
async function auftrag(a, log) {
  const t0 = Date.now();
  try {
    let zeilen;
    if (a.art === 'genesis') zeilen = genesisZeilen(await holeGenesis(a.tabelle, a.jahr, a.jahr), a.tabelle);
    else {
      const jahr = new Date().getFullYear();
      const txt = await D._fetchTableFfcsv(a.tabelle, null, jahr, a.filter, { timeoutMs: ZEIT_MS, startyear: jahr - JAHRE, endyear: jahr });
      const code = (String(txt).slice(0, 300).match(/"Code"\s*:\s*(\d+)/) || [])[1];
      if (code && code !== '0') throw new Error('GENESIS-Code ' + code);
      const csv = D._extractCsv(txt);
      zeilen = a.art === 'bauland' ? baulandZeilen(csv, a.tabelle) : bauZeilen(csv, a.praefix, a.tabelle);
    }
    if (!zeilen.length) throw new Error('keine Zeilen gelesen');
    const n = await schreiben(zeilen);
    await protokoll(a.tabelle, a.filter || null, n, Date.now() - t0, 'ok', null);
    log(`${a.tabelle.padEnd(14)} ${String(a.filter || 'alle').padEnd(4)} ${String(n).padStart(6)} Werte · ${Math.round((Date.now() - t0) / 1000)} s`);
    return { ok: true, werte: n };
  } catch (e) {
    await protokoll(a.tabelle, a.filter || null, 0, Date.now() - t0, 'fehler', e.message);
    log(`${a.tabelle.padEnd(14)} ${String(a.filter || 'alle').padEnd(4)} FEHLER ${e.message}`);
    return { ok: false, fehler: e.message, a };
  }
}
export async function importiere({ log = console.log, nur = null } = {}) {
  if (!destatisEnabled()) throw new Error('kein DESTATIS_TOKEN');
  /* gemessen 04.11.2026: 31111-0100 ueber 6 Jahre ist „zu gross“ (Code 98), ein Jahr je Abruf geht */
  const jetzt = new Date().getFullYear(), auftraege = [{ art: 'genesis', tabelle: '31111-0001' }];
  for (let j = jetzt - JAHRE; j < jetzt; j++) auftraege.push   /* das laufende Jahr ist nie vollstaendig */({ art: 'genesis', tabelle: '31111-0100', jahr: j, filter: String(j) });
  for (const l of (nur || LAENDER)) {
    auftraege.push({ art: 'bau', tabelle: '31111-01-02-4', praefix: 'gen', filter: l + '*' });
    auftraege.push({ art: 'bau', tabelle: '31121-01-02-4', praefix: 'fert', filter: l + '*' });
    auftraege.push({ art: 'bauland', tabelle: '61511-01-03-4', filter: l + '*' });
  }
  try { await D.logincheck(); } catch (e) { /* nur Aufraeumen */ }
  const t0 = Date.now(), ergebnis = []; let i = 0;
  async function arbeiter() {
    while (i < auftraege.length) {
      const a = auftraege[i++];
      let r = await auftrag(a, log);
      if (!r.ok) { await new Promise((ok) => setTimeout(ok, PAUSE_MS)); r = await auftrag(a, log); }
      ergebnis.push(r);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, arbeiter));
  const deckung = await q("SELECT kennzahl, count(DISTINCT ags) FILTER (WHERE ebene='kreis') AS kreise, count(DISTINCT ags) FILTER (WHERE ebene='land') AS laender, max(jahr) AS jahr"
    + " FROM mb.baustatistik WHERE wert IS NOT NULL AND gruppe IN ('insgesamt','baureif') GROUP BY kennzahl ORDER BY kennzahl");
  const fehler = ergebnis.filter((r) => !r.ok);
  await protokoll('GESAMT', null, ergebnis.reduce((s, r) => s + (r.werte || 0), 0), Date.now() - t0, fehler.length ? 'fehler' : 'ok',
    fehler.length ? fehler.length + ' Abrufe gescheitert' : null);
  return { voll: !fehler.length, fehler, deckung, dauer_s: Math.round((Date.now() - t0) / 1000) };
}

/* ── Lesen fuer die Schnittstelle ─────────────────────────────────────── */
const r0 = (v) => (v == null ? null : Math.round(Number(v)));
function block(werte, praefix, jahr) {
  const w = (k, g) => { const x = werte.find((z) => z.kennzahl === praefix + '_' + k && z.gruppe === g && z.jahr === jahr); return x && x.wert != null ? Number(x.wert) : null; };
  const teil = (g) => {
    const kosten = w('kosten_teur', g), fl = w('wohnflaeche_qm', g), wo = w('wohnungen', g);
    const o = { wohnflaeche_qm: r0(fl), wohnungen: r0(wo), gebaeude: r0(w('gebaeude', g)) };
    if (praefix === 'gen' && kosten != null) { o.kosten_teur = r0(kosten); o.eur_je_qm = fl ? Math.round(kosten * 1000 / fl) : null; }
    if (wo != null) o.duenn = wo < DUENN_UNTER;
    return o;
  };
  const o = Object.assign({ zeitraum: String(jahr) }, teil('insgesamt'));
  const je = {}; ['1_wohnung', '2_wohnungen', '3_und_mehr'].forEach((g) => { const t = teil(g); if (t.wohnungen != null || t.wohnflaeche_qm != null) je[g] = t; });
  if (Object.keys(je).length) o.je_gebaeudeart = je;
  return o;
}
function jahrMit(werte, kennzahl) {
  const j = werte.filter((z) => z.kennzahl === kennzahl && z.gruppe === 'insgesamt' && z.wert != null).map((z) => z.jahr);
  return j.length ? Math.max(...j) : null;
}
/* v3172b · gemessen 04.11.2026: mb.jahreswerte_abruf (reihe bpi) hielt auf Staging nur vier Werte aus 2020 - der
   automatische Abruf liest den Index nicht fortlaufend. Massgeblich ist die gepruefte Tabelle lib/baupreisindex.js
   (dieselbe, mit der die Wertermittlung rechnet); ein neuerer, geprueft aktiver Datenbankwert gewinnt. */
export async function baupreisindex() {
  const m = BPI_TABELLE.monate, tabelle = Object.keys(m).sort();
  let monat = tabelle[tabelle.length - 1], wert = m[monat], quelle = BPI_TABELLE.quelle, url = BPI_TABELLE.quelle_url;
  try {
    const r = await q("SELECT periode, wert FROM mb.jahreswerte_abruf WHERE reihe = 'bpi' AND status = 'aktiv' AND basis = '2021=100' ORDER BY periode DESC LIMIT 1");
    if (r[0] && r[0].periode > monat) { monat = r[0].periode; wert = Number(r[0].wert); }
  } catch (e) { /* Tabelle reicht */ }
  const vjMonat = (Number(monat.slice(0, 4)) - 1) + monat.slice(4), vj = m[vjMonat];
  return { reihe: '61261-0002', wert: wert, basis: '2021 = 100', monat: monat,
    vj_pct: vj ? Math.round((wert / vj - 1) * 1000) / 10 : null,
    hinweis: 'Neubau Wohngebäude (konventionell), Bauleistungen am Bauwerk, einschl. USt; quartalsweise (Feb/Mai/Aug/Nov)',
    quelle: quelle, quelle_url: url, stand: BPI_TABELLE.stand };
}
export async function baukosten({ ags = null } = {}) {
  const rows = await q('SELECT kennzahl, ags, jahr, gruppe, ebene, gebiet_name, wert, tabelle, abgerufen_am FROM mb.baustatistik'
    + (ags ? ' WHERE ags = $1 OR ags = $2 OR ags = $3' : ''), ags ? [ags, String(ags).slice(0, 2), 'DG'] : []);
  const nachAgs = new Map();
  for (const z of rows) { z.jahr = Number(z.jahr); (nachAgs.get(z.ags) || nachAgs.set(z.ags, []).get(z.ags)).push(z); }
  const stand = rows.reduce((m, z) => (!m || z.abgerufen_am > m ? z.abgerufen_am : m), null);
  const abgerufen = stand ? new Date(stand).toISOString().slice(0, 10) : null;
  const landBlock = (code) => {
    const w = nachAgs.get(code) || []; const j = jahrMit(w, 'gen_kosten_teur'); if (!j) return null;
    return Object.assign({ statistik: '31111', tabelle: code === 'DG' ? '31111-0001' : '31111-0100', gebaeudeart: 'Wohngebäude, Neubau',
      quelle: QUELLE_GENESIS + ', Tabelle ' + (code === 'DG' ? '31111-0001' : '31111-0100') + ', abgerufen ' + abgerufen }, block(w, 'gen', j));
  };
  const kreise = [];
  for (const [a, w] of nachAgs) {
    if (ebeneVon(a) !== 'kreis') continue;
    if (ags && a !== ags) continue;
    const land = a.slice(0, 2), jg = jahrMit(w, 'gen_wohnungen'), jf = jahrMit(w, 'fert_wohnungen'), jb = jahrMit(w, 'bauland_eur_qm');
    const bl = (k, g) => { const x = w.find((z) => z.kennzahl === k && z.gruppe === g && z.jahr === jb); return x && x.wert != null ? Number(x.wert) : null; };
    const tabellen = ['31111-01-02-4', '31121-01-02-4', '61511-01-03-4'];
    kreise.push({
      ags: a, name: (w.find((z) => z.gebiet_name) || {}).gebiet_name || null, land: LAND_KUERZEL[land] || null,
      baukosten: null,
      baukosten_hinweis: 'Veranschlagte Baukosten veröffentlicht die amtliche Statistik nicht je Kreis, nur je Land (land_baukosten).',
      genehmigt: jg ? Object.assign({ statistik: '31111', tabelle: '31111-01-02-4', gebaeudeart: 'Wohngebäude, Neubau' }, block(w, 'gen', jg)) : null,
      fertiggestellt: jf ? Object.assign({ statistik: '31121', tabelle: '31121-01-02-4', gebaeudeart: 'Wohngebäude, Neubau' }, block(w, 'fert', jf)) : null,
      bauland: jb ? { statistik: '61511', tabelle: '61511-01-03-4', zeitraum: String(jb),
        eur_je_qm: bl('bauland_eur_qm', 'insgesamt'), baureif_eur_je_qm: bl('bauland_eur_qm', 'baureif'),
        kauffaelle: r0(bl('bauland_faelle', 'insgesamt')), kauffaelle_baureif: r0(bl('bauland_faelle', 'baureif')),
        duenn: bl('bauland_faelle', 'baureif') != null ? bl('bauland_faelle', 'baureif') < DUENN_UNTER : null } : null,
      land_baukosten: landBlock(land),
      quelle: QUELLE_REGIO + ', Tabellen ' + tabellen.join(', ') + ', abgerufen ' + abgerufen,
      quelle_urls: tabellen.map((t) => REGIO_URL + t),
      lizenz: LIZENZ, abgerufen,
    });
  }
  kreise.sort((x, y) => x.ags.localeCompare(y.ags));
  const laender = {}; LAENDER.forEach((l) => { const b = landBlock(l); if (b) laender[LAND_KUERZEL[l]] = Object.assign({ ags: l }, b); });
  return { stand: abgerufen, quelle: QUELLE_REGIO + '; ' + QUELLE_GENESIS, lizenz: 'dl-de/by-2-0',
    hinweis: 'Je Kreis keine Baukosten (amtlich nur je Land): baukosten = null, Landeswert in land_baukosten. Nur Kosten des Bauwerks (KG 300+400 DIN 276, inkl. USt).',
    baupreisindex: await baupreisindex(), bund: landBlock('DG'), laender, anzahl: kreise.length, kreise };
}

/* ── Takt: monatlich wie der Makro-Import ─────────────────────────────── */
const TAKT_MS = 12 * 3600 * 1000, ALTER_TAGE = 30;
async function durchgang() {
  try {
    const r = await q("SELECT max(am) AS am FROM mb.baustatistik_abrufe WHERE tabelle = 'GESAMT' AND status = 'ok'");
    const am = r[0] && r[0].am;
    if (am && Date.now() - new Date(am).getTime() < ALTER_TAGE * 86400000) return;
    console.log('[baustatistik] Abgleich startet');
    const b = await importiere({ log: (t) => console.log('[baustatistik] ' + t) });
    console.log('[baustatistik] ' + (b.voll ? 'fertig' : 'unvollstaendig') + ' in ' + b.dauer_s + ' s');
  } catch (e) { console.log('[baustatistik] Fehler: ' + e.message); }
}
export function starteBaustatistikTakt() {
  if (String(process.env.BAUSTATISTIK_IMPORT || '1') !== '1') { console.log('[baustatistik] Takt aus'); return; }
  setTimeout(durchgang, 20 * 60 * 1000);   /* nach dem Makro-Import (3 min), damit sich die Abrufe nicht stauen */
  setInterval(durchgang, TAKT_MS);
}

if (process.argv[1] && process.argv[1].endsWith('BaustatistikService.js')) {
  const nur = process.argv[2] ? process.argv[2].split(',') : null;
  importiere({ nur })
    .then((b) => { b.deckung.forEach((d) => console.log('DECKUNG ' + d.kennzahl.padEnd(24) + ' ' + d.kreise + ' Kreise · ' + d.laender + ' Länder · bis ' + d.jahr));
      console.log((b.voll ? 'FERTIG' : 'UNVOLLSTÄNDIG') + ' in ' + b.dauer_s + ' s, ' + b.fehler.length + ' Fehler'); if (!b.voll) process.exitCode = 1; })
    .catch((e) => { console.error('FEHLER', e.message); process.exitCode = 1; })
    .finally(() => pool.end());
}
