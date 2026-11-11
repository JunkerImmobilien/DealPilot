// harvestScheduler.js — Taktgeber der Discovery.
// ────────────────────────────────────────────────────────────────────────────
// Laeuft NICHT im Anfragepfad. Wenn ein Landesportal haengt, darf das keinen
// Bericht blockieren — deshalb ein eigener Zeitplan, der die Warteschlange
// abarbeitet, ein Abruf je Sekunde.
//
// SAISONALER TAKT: Bodenrichtwerte werden zum 1. Januar ermittelt und sollen
// bis Ende Maerz veroeffentlicht sein, die Marktberichte folgen im ersten
// Halbjahr. Beleg: Landkreis Meissen hat den Bericht 2024 am 02.04.2025
// beschlossen.
//
//   Januar bis Juni    woechentlich je Quelle
//   Juli bis Dezember  monatlich
//
// Abschaltbar ueber HARVEST_SCHEDULER=0.

import { HarvestService } from '../services/HarvestService.js';
import { q } from './db.js';
import { takt as _taktSperre } from './taktSperre.js';   /* v3311: Sperre gegen Doppellauf */

const AN = () => String(process.env.HARVEST_SCHEDULER || '1') === '1';
const TAKT_MS = 6 * 60 * 60 * 1000;          // alle 6 Stunden nachsehen
const SPERRE_MS = 60 * 60 * 1000;            // eine Stunde je Quelle

const zuletzt = new Map();                    // source_id -> Zeitstempel

/* v2591 · Der letzte Durchgang des Takts, fuer die Admin-Ansicht
 * „Register & Ernte". Nur im Speicher: nach einem Neustart steht hier
 * null, und die Ansicht faellt auf max(letzter_check) der Quellen zurueck
 * — das sagt sie dann auch. */
let _letzterLauf = null;

/* 026 · Der Lauf wird zusaetzlich in mb.harvest_laeufe geschrieben und beim
 * Start von dort gelesen — sonst stand nach jedem Neustart (also nach jedem
 * Ausrollen) „kein Lauf" in der Admin-Ansicht, bis zu sechs Stunden lang.
 * Fehler hier kippen den Takt nie. */
async function laufSichern(l) {
  await q(`INSERT INTO mb.harvest_laeufe (beginn, ende, geprueft, neu, fehler, abbruch, fehlerliste)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [l.beginn, l.ende, l.geprueft ?? null, l.neu ?? null, l.fehler ?? null, l.abbruch || null,
     l.fehlerliste || null]).catch(() => {});
}
async function laufLaden() {
  if (_letzterLauf) return;
  const r = await q(`SELECT beginn, ende, geprueft, neu, fehler, abbruch
                       FROM mb.harvest_laeufe ORDER BY beginn DESC LIMIT 1`).catch(() => null);
  if (r && r[0] && !_letzterLauf) _letzterLauf = { ...r[0], aus_datenbank: true };
}
export function laufStand() {
  return { an: AN(), takt_stunden: TAKT_MS / 3600000, letzter_lauf: _letzterLauf };
}

/** Wurde diese Quelle gerade erst geprueft? Gibt die Restzeit zurueck. */
export function sperreRest(sourceId) {
  const t = zuletzt.get(String(sourceId));
  if (!t) return null;
  const rest = SPERRE_MS - (Date.now() - t);
  if (rest <= 0) return null;
  return Math.ceil(rest / 60000) + ' Min';
}

export function merkeLauf(sourceId) {
  zuletzt.set(String(sourceId), Date.now());
}

function faelligeAnzahl() {
  const m = new Date().getMonth() + 1;
  // Erstes Halbjahr: mehr Quellen je Durchgang, damit jede etwa woechentlich drankommt.
  return (m >= 1 && m <= 6) ? 12 : 4;
}

async function durchgang() {
  if (!AN()) return;
  const beginn = new Date().toISOString();
  try {
    const b = await HarvestService.discover({ limit: faelligeAnzahl() });
    _letzterLauf = { beginn, ende: new Date().toISOString(), geprueft: b ? b.geprueft : null,
                     neu: b ? b.neu : null, fehler: b && b.fehler ? b.fehler.length : null };
    await laufSichern({ ..._letzterLauf, fehlerliste: b && b.fehler ? b.fehler.slice(0, 50) : null });
    if (b && (b.neu || b.fehler.length)) {
      /* v1047-WOUT-2 · Bisher stand nur die Anzahl da. Der Taktgeber laeuft
       * alle sechs Stunden gegen fremde Behoerdenserver — wogegen er
       * scheitert, gehoert ins Log, sonst kann es niemand abstellen. */
      console.log(`[harvest] ${b.geprueft} geprueft, ${b.neu} neu`
        + (b.fehler.length ? `, ${b.fehler.length} Fehler` : ''));
      b.fehler.slice(0, 5).forEach((f) => console.log('[harvest]   ! ' + f));
      if (b.fehler.length > 5) console.log(`[harvest]   ... und ${b.fehler.length - 5} weitere`);
    }
  } catch (e) {
    _letzterLauf = { beginn, ende: new Date().toISOString(), abbruch: e.message };
    await laufSichern(_letzterLauf);
    console.log('[harvest] Durchgang fehlgeschlagen:', e.message);
  }
}

export function starteHarvestScheduler() {
  if (!AN()) { console.log('[harvest] Taktgeber aus (HARVEST_SCHEDULER=0)'); return; }
  laufLaden();
  // Erster Durchgang mit Verzoegerung: der Start soll nicht davon abhaengen.
  const _dg = _taktSperre('harvest', durchgang);   /* v3311 */
  setTimeout(_dg, 90 * 1000);
  setInterval(_dg, TAKT_MS);
  console.log('[harvest] Taktgeber an, alle 6 Stunden');
}
