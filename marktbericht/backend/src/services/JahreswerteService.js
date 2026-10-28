// JahreswerteService.js — v3021 · Jahreswerte automatisch nachziehen.
//
// Marcel 28.10.2026: „den Wert [Angebotsabschlag 5,8 %] bitte dann jedes Jahr
// automatisch neu ermitteln, und das müssen wir auch bei den Steuerdaten machen."
//
// Drei Aufgaben, alle neben dem Server, nie im Anfragepfad:
//   1. AMTLICHE REIHEN (VPI, Baupreisindex) holen - täglich prüfen, holen,
//      wenn der letzte erfolgreiche Abruf älter als 7 Tage ist. Jeder gelesene
//      Wert läuft durch pruefe() (lib/destatis_reihen.js); nur 'aktiv' wirkt.
//   2. Beim Start und nach jedem Abruf die aktiven Werte in die Libs laden
//      (baupreisindex.js, nrw_modell.js). Die Rechenkerne lesen weiter ihre
//      Lib-Funktion; die Konstanten im Code bleiben Rückfall und Vorrang.
//   3. ANGEBOTSABSCHLAG: ab dem 15. Januar den DealPilot-Marktdurchschnitt des
//      Vorjahres je Segment aus mb.angebot_abschlag_messung rechnen.
//
// Steuerdaten (ESt-Tarif, Soli, GrESt, AfA) holt dieser Dienst NICHT - Gesetze
// werden nicht automatisch geparst. Für sie gibt es das Jahreswerte-Register
// (lib/data/jahreswerte.json), den Prüfer tools/jahreswerte-pruefen.mjs, den
// Abschnitt „Jahreswerte" im Admin und den Agenten .claude/agents/jahreswerte.md.
//
// Aus: JAHRESWERTE_TAKT=0. Von Hand: POST /api/v1/marktbericht/jahreswerte/abruf.
import { q } from '../lib/db.js';
import { REIHEN, holeSeite, holeGenesis, pruefe } from '../lib/destatis_reihen.js';
import { BPI_TABELLE, uebernimmAbruf as bpiUebernehmen } from '../lib/baupreisindex.js';
import { VPI_OKTOBER_IMMOWERTV, uebernimmVpiOktober } from '../lib/nrw_modell.js';
import { berechneJahr, setzeAktive, MIN_N, STICHTAG_MONAT_TAG, SEGMENTE } from '../lib/angebot_abschlag.js';
import { landAusAgs } from '../lib/lzs_naeherung.js';
import { BWK_JAHRE } from '../lib/immowertv.js';

const TAKT_MS = 24 * 3600 * 1000;
const ABRUF_ALTER_TAGE = 7;
let _laeuft = false;

/** Im Code belegte Werte einer Reihe als { 'JJJJ-MM': wert } (Basis wie die Abrufe). */
function belegtImCode(reihe) {
  if (reihe === 'bpi') {
    const o = {};
    for (const [k, v] of Object.entries(BPI_TABELLE.monate)) if (!(BPI_TABELLE.abgerufen || {})[k]) o[k] = v;
    return o;
  }
  /* VPI: nur die Oktoberwerte auf Basis 2020 sind im Code belegt */
  const o = {};
  for (const [j, v] of Object.entries(VPI_OKTOBER_IMMOWERTV)) if (Number(j) >= 2020) o[j + '-10'] = v;
  return o;
}

async function aktiveZeilen(reihe) {
  return q(`SELECT reihe, periode, wert::float AS wert, quelle_stand, abgerufen_am, weg
              FROM mb.jahreswerte_abruf WHERE status = 'aktiv'${reihe ? ' AND reihe = $1' : ''} ORDER BY periode`,
  reihe ? [reihe] : []);
}

/** Aktive DB-Werte in die Libs übernehmen (Start + nach jedem Abruf). */
export async function ladeAktive() {
  const out = { bpi: 0, vpi: 0, abschlag: 0 };
  try {
    const z = await aktiveZeilen(null);
    out.bpi = bpiUebernehmen(z.filter((x) => x.reihe === 'bpi'));
    out.vpi = uebernimmVpiOktober(z.filter((x) => x.reihe === 'vpi'));
  } catch (e) { out.fehler_reihen = e.message; }
  try {
    const a = await q('SELECT jahr, segment, pct::float AS pct, n, aktiv FROM mb.angebot_abschlag_jahr WHERE aktiv');
    out.abschlag = Object.keys(setzeAktive(a)).length;
  } catch (e) { out.fehler_abschlag = e.message; }
  return out;
}

/** Eine Reihe holen, prüfen, speichern. Rückgabe: Zusammenfassung. */
export async function holeReihe(reihe, opts = {}) {
  let r = await holeGenesis(reihe, opts);
  const genesis = r;
  if (!r.ok) r = await holeSeite(reihe, opts);
  const erg = { reihe, ok: r.ok, weg: r.weg, grund: r.ok ? null : r.grund, genesis: genesis.ok ? 'ok' : genesis.grund,
    eingefroren: !!r.eingefroren, quelle_stand: r.quelle_stand || null, gelesen: 0, neu: 0, warnungen: [], gleich: 0 };
  if (!r.ok) return erg;
  const bekannt = { ...belegtImCode(reihe) };
  for (const z of await aktiveZeilen(reihe)) if (bekannt[z.periode] == null) bekannt[z.periode] = Number(z.wert);
  const perioden = Object.keys(r.werte).sort();
  erg.gelesen = perioden.length;
  for (const p of perioden) {
    const w = r.werte[p];
    const pr = pruefe(reihe, p, w, bekannt);
    if (pr.status === 'gleich') { erg.gleich++; continue; }
    /* dieselbe Warnung nicht bei jedem Lauf neu schreiben */
    const schon = await q(`SELECT 1 FROM mb.jahreswerte_abruf WHERE reihe=$1 AND periode=$2 AND wert=$3 AND status=$4 LIMIT 1`,
      [reihe, p, w, pr.status]);
    if (pr.status === 'warnung') erg.warnungen.push(p + ': ' + w + ' - ' + pr.pruefung);
    if (schon.length) continue;
    await q(`INSERT INTO mb.jahreswerte_abruf (reihe, periode, wert, basis, status, pruefung, weg, quelle_url, quelle_stand)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [reihe, p, w, REIHEN[reihe].basis, pr.status, pr.pruefung, r.weg, r.quelle_url || null, r.quelle_stand || null]);
    if (pr.status === 'aktiv') { erg.neu++; bekannt[p] = w; }
  }
  return erg;
}

async function letzterLauf(art, nurOk = true) {
  try {
    const r = await q(`SELECT gelaufen_am FROM mb.jahreswerte_lauf WHERE art=$1 ${nurOk ? 'AND ok' : ''} ORDER BY gelaufen_am DESC LIMIT 1`, [art]);
    return r.length ? new Date(r[0].gelaufen_am) : null;
  } catch (e) { return undefined; }   /* Tabelle fehlt -> Migration 023 noch nicht gelaufen */
}

export async function laufReihen(opts = {}) {
  const ergebnis = [];
  for (const reihe of Object.keys(REIHEN)) {
    try { ergebnis.push(await holeReihe(reihe, opts)); }
    catch (e) { ergebnis.push({ reihe, ok: false, grund: e.message }); }
  }
  const ok = ergebnis.every((e) => e.ok);
  await q('INSERT INTO mb.jahreswerte_lauf (art, ok, ergebnis) VALUES ($1,$2,$3)', ['reihen', ok, JSON.stringify(ergebnis)]);
  const geladen = await ladeAktive();
  return { ok, ergebnis, geladen };
}

/* ── Angebotsabschlag ─────────────────────────────────────────────── */

/** Eine Messung aus dem Bewertungsergebnis protokollieren (fire and forget). */
export async function protokolliereMessung(angebotAbschlag) {
  const m = angebotAbschlag && angebotAbschlag.messung;
  if (!m || SEGMENTE.indexOf(m.segment) < 0 || !m.ags || !(Number(m.angebotsmedian_eur_qm) > 0)) return false;
  try {
    await q(`INSERT INTO mb.angebot_abschlag_messung (jahr, ags, land, segment, objektart, angebotsmedian_eur_qm,
               angebote_n, kaufpreis_eur_qm, abschlag_pct, quelle, satz_id, satz_berichtsjahr)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [new Date().getFullYear(), String(m.ags), landAusAgs(String(m.ags)) || null, m.segment, m.objektart || null,
      m.angebotsmedian_eur_qm, m.angebote_n || null, m.kaufpreis_eur_qm, m.abschlag_pct, m.quelle,
      m.satz_id || null, m.satz_berichtsjahr || null]);
    return true;
  } catch (e) { return false; }   /* Bericht darf an einem Protokoll nie scheitern */
}

/** Jahresrechnung für `jahr` (Messungen dieses Kalenderjahres). */
export async function rechneAbschlagJahr(jahr) {
  const rows = await q(`SELECT ags, segment, quelle, satz_id, abschlag_pct::float AS abschlag_pct, gemessen_am
                          FROM mb.angebot_abschlag_messung WHERE jahr = $1`, [jahr]);
  const erg = berechneJahr(rows);
  for (const s of SEGMENTE) {
    const e = erg[s];
    await q(`INSERT INTO mb.angebot_abschlag_jahr (jahr, segment, pct, n, n_roh, n_ausreisser, q1, q3, min_n, aktiv, berechnet_am)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
             ON CONFLICT (jahr, segment) DO UPDATE SET pct=EXCLUDED.pct, n=EXCLUDED.n, n_roh=EXCLUDED.n_roh,
               n_ausreisser=EXCLUDED.n_ausreisser, q1=EXCLUDED.q1, q3=EXCLUDED.q3, min_n=EXCLUDED.min_n,
               aktiv=EXCLUDED.aktiv, berechnet_am=now()`,
    [jahr, s, e.pct, e.n, e.n_roh, e.n_ausreisser, e.q1, e.q3, e.min_n, e.aktiv]);
  }
  await q('INSERT INTO mb.jahreswerte_lauf (art, ok, ergebnis) VALUES ($1,$2,$3)', ['angebotsabschlag', true, JSON.stringify({ jahr, erg })]);
  await ladeAktive();
  return { jahr, min_n: MIN_N, segmente: erg };
}

/** Ab dem 15. Januar einmal das Vorjahr rechnen. */
async function abschlagFaellig(heute = new Date()) {
  const j = heute.getFullYear();
  const mt = String(heute.getMonth() + 1).padStart(2, '0') + '-' + String(heute.getDate()).padStart(2, '0');
  if (mt < STICHTAG_MONAT_TAG) return null;
  try {
    const r = await q('SELECT 1 FROM mb.angebot_abschlag_jahr WHERE jahr = $1 LIMIT 1', [j - 1]);
    return r.length ? null : j - 1;
  } catch (e) { return null; }
}

async function durchgang() {
  if (_laeuft) return;
  _laeuft = true;
  try {
    const t = await letzterLauf('reihen');
    if (t !== undefined && (!t || Date.now() - t.getTime() > ABRUF_ALTER_TAGE * 86400000)) {
      const r = await laufReihen();
      console.log('[jahreswerte] Reihen ' + (r.ok ? 'ok' : 'UNVOLLSTAENDIG') + ' · ' + r.ergebnis.map((e) =>
        e.reihe + ' ' + (e.ok ? (e.weg + ' gelesen ' + e.gelesen + ', neu ' + e.neu + (e.warnungen && e.warnungen.length ? ', WARNUNG ' + e.warnungen.length : '')
          + (e.eingefroren ? ', Seite eingefroren' : '')) : 'FEHLER ' + e.grund)).join(' · '));
    }
    const j = await abschlagFaellig();
    if (j) {
      const a = await rechneAbschlagJahr(j);
      console.log('[jahreswerte] Angebotsabschlag ' + j + ': ' + SEGMENTE.map((s) => s + ' ' + (a.segmente[s].aktiv ? a.segmente[s].pct + ' % (n=' + a.segmente[s].n + ')' : 'zu wenig (' + a.segmente[s].n + '/' + MIN_N + ')')).join(' · '));
    }
  } catch (e) { console.log('[jahreswerte] Lauf fehlgeschlagen:', e.message); }
  finally { _laeuft = false; }
}

export function starteJahreswerteTakt() {
  ladeAktive().then((g) => console.log('[jahreswerte] geladen: ' + JSON.stringify(g))).catch(() => {});
  if (String(process.env.JAHRESWERTE_TAKT || '1') !== '1') { console.log('[jahreswerte] Takt aus (JAHRESWERTE_TAKT=0)'); return; }
  setTimeout(durchgang, 5 * 60 * 1000);
  setInterval(durchgang, TAKT_MS);
  console.log('[jahreswerte] Takt an: taeglich pruefen, Reihen alle ' + ABRUF_ALTER_TAGE + ' Tage, Angebotsabschlag ab 15.01.');
}

/** Für Admin: Stand der automatischen Werte. */
export async function stand() {
  const o = { reihen: {}, abschlag: {}, laeufe: [] };
  try {
    for (const reihe of Object.keys(REIHEN)) {
      const a = await q(`SELECT periode, wert::float AS wert, status, pruefung, weg, quelle_stand::text AS quelle_stand, abgerufen_am
                           FROM mb.jahreswerte_abruf WHERE reihe=$1 ORDER BY periode DESC, abgerufen_am DESC LIMIT 8`, [reihe]);
      const code = belegtImCode(reihe);
      const k = Object.keys(code).sort().pop();
      o.reihen[reihe] = { name: REIHEN[reihe].name, seite: REIHEN[reihe].seite, im_code_bis: k ? { periode: k, wert: code[k] } : null,
        db: a, warnungen: a.filter((x) => x.status === 'warnung').length };
    }
    o.laeufe = await q(`SELECT art, gelaufen_am, ok, ergebnis FROM mb.jahreswerte_lauf ORDER BY gelaufen_am DESC LIMIT 6`);
    o.abschlag.messungen = await q(`SELECT jahr, segment, count(*)::int AS n, count(DISTINCT (ags, quelle, satz_id))::int AS orte,
                                           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY abschlag_pct)::numeric, 1)::float AS median
                                      FROM mb.angebot_abschlag_messung GROUP BY jahr, segment ORDER BY jahr DESC, segment`);
    o.abschlag.jahre = await q(`SELECT jahr, segment, pct::float AS pct, n, n_roh, n_ausreisser, min_n, aktiv, berechnet_am
                                  FROM mb.angebot_abschlag_jahr ORDER BY jahr DESC, segment`);
  } catch (e) { o.fehler = e.message; }
  o.genesis_token = !!process.env.GENESIS_TOKEN;
  o.bwk_vorschlag = bwkVorschlag();
  return o;
}

/* Rechnerischer Vorschlag Anlage 3 fuer das naechste Jahr: Ausgangswerte der Verordnung
   (230 / 275 / 30 EUR, 9,00 / 68 EUR) x VPI Oktober Vorjahr / VPI Oktober 2001 (77,1).
   Gemessen 28.10.2026 an 2022-2026: 3 von 5 Jahren exakt, 2022 und 2024 je ein Feld 1 EUR
   unter dem amtlichen Wert - deshalb NUR Vorschlag; eingetragen wird die amtliche Tabelle. */
export function bwkVorschlag() {
  const jahre = Object.keys(BWK_JAHRE).map(Number);
  const naechstes = Math.max(...jahre) + 1;
  const vpi = VPI_OKTOBER_IMMOWERTV[naechstes - 1];
  if (!(vpi > 0)) return { jahr: naechstes, verfuegbar: false, grund: 'VPI Oktober ' + (naechstes - 1) + ' noch nicht da' };
  const f = vpi / VPI_OKTOBER_IMMOWERTV[2001];
  return { jahr: naechstes, verfuegbar: true, vpi_oktober: vpi, verw_we: Math.round(230 * f), verw_etw: Math.round(275 * f),
    verw_garage: Math.round(30 * f), inst_qm: Math.round(9 * f * 10) / 10, inst_garage: Math.round(68 * f),
    hinweis: 'rechnerisch, nicht amtlich - in BWK_JAHRE erst die amtliche Tabelle eintragen' };
}
