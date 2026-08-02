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

const AN = () => String(process.env.HARVEST_SCHEDULER || '1') === '1';
const TAKT_MS = 6 * 60 * 60 * 1000;          // alle 6 Stunden nachsehen
const SPERRE_MS = 60 * 60 * 1000;            // eine Stunde je Quelle

const zuletzt = new Map();                    // source_id -> Zeitstempel

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
  try {
    const b = await HarvestService.discover({ limit: faelligeAnzahl() });
    if (b && (b.neu || b.fehler.length)) {
      console.log(`[harvest] ${b.geprueft} geprueft, ${b.neu} neu`
        + (b.fehler.length ? `, ${b.fehler.length} Fehler` : ''));
    }
  } catch (e) {
    console.log('[harvest] Durchgang fehlgeschlagen:', e.message);
  }
}

export function starteHarvestScheduler() {
  if (!AN()) { console.log('[harvest] Taktgeber aus (HARVEST_SCHEDULER=0)'); return; }
  // Erster Durchgang mit Verzoegerung: der Start soll nicht davon abhaengen.
  setTimeout(durchgang, 90 * 1000);
  setInterval(durchgang, TAKT_MS);
  console.log('[harvest] Taktgeber an, alle 6 Stunden');
}
