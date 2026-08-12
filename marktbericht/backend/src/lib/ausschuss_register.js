// ausschuss_register.js  (v1083-WREG)
//
// DAS REGISTER — datengetrieben statt ein JS-Modul je Kreis.
//
// WARUM IM SPEICHER UND NICHT PER DB-ABFRAGE:
// CrossCheckService.compute() ist SYNCHRON. holeModelle() aus dem
// param-repository ist async. Den Aufloeser auf einen DB-Lesevorgang
// umzustellen wuerde compute() async machen und damit die ganze Aufrufkette.
// Das Register ist klein (unter 600 Saetze) — es wird einmal geladen und
// danach synchron abgefragt.
//
// WOHER DIE DATEN KOMMEN, in dieser Reihenfolge:
//   1. die versionierte Saatdatei im Repo  (immer vorhanden)
//   2. mb.param_modell, falls befuellt      (ueberschreibt die Saat)
// Damit laeuft das Feature auch, BEVOR die Tabelle befuellt ist. Ein
// vergessener Saatlauf fuehrt nicht zu einem stillen "kein Ausschuss
// hinterlegt" — das waere ein stiller Rueckfall, und die sind schlimmer
// als ein Fehler.
//
// DIE ZUSTAENDIGKEIT LAEUFT UEBER DIE KASKADE, NICHT UEBER FUENF STELLEN.
// Gemessen an schluessel.csv der Grundstuecksmarktdaten NRW: 14 Kreise
// tragen mehr als einen Gutachterausschuss. Der Kreis Wesel hat vier
// (Kreis, Dinslaken, Moers, Wesel), der Maerkische Kreis drei (Kreis,
// Iserlohn, Luedenscheid). Ein Vergleich auf den fuenfstelligen
// Kreisschluessel kann sie nicht auseinanderhalten — ein Registereintrag
// fuer Luedenscheid haette dort still den Maerkischen Kreis getroffen.
// Genau so ist in v1060 ein Vergleichsfaktor aus Minden-Luebbecke in einen
// Bericht fuer Hiddenhausen geraten.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));

/** AGS von fein nach grob: 8 -> 5 -> 3 -> 2. Dieselbe Reihenfolge wie
 *  kaskadeSchluessel() im param-repository — bewusst identisch. */
export function kaskadeSchluessel(ags) {
  const t = String(ags || '').replace(/\D/g, '');
  const stufen = [];
  for (const n of [8, 5, 3, 2]) if (t.length >= n) stufen.push(t.slice(0, n));
  return [...new Set(stufen)];
}

/* ── Zustand ───────────────────────────────────────────────────────────── */

/** Map: `${kennzahl}|${ags}` -> Array von Saetzen */
let _index = new Map();
let _herkunft = 'leer';
let _stand = null;

function schluessel(kennzahl, ags) { return `${kennzahl}|${ags}`; }

function indizieren(saetze) {
  const ix = new Map();
  for (const s of saetze) {
    if (!s || !s.ags || !s.kennzahl) continue;
    const k = schluessel(s.kennzahl, s.ags);
    if (!ix.has(k)) ix.set(k, []);
    ix.get(k).push(s);
  }
  // Juengster Jahrgang zuerst — bei zwei Jahrgaengen gewinnt der neuere.
  for (const liste of ix.values()) {
    liste.sort((a, b) => (b.berichtsjahr || 0) - (a.berichtsjahr || 0));
  }
  return ix;
}

/* ── Laden ─────────────────────────────────────────────────────────────── */

/** Saatdatei aus dem Repo. Fehlt sie, bleibt das Register leer — aber laut. */
export function ladeSaat(datei = join(HIER, 'register', 'lzs-nrw.json')) {
  try {
    const saetze = JSON.parse(readFileSync(datei, 'utf8'));
    _index = indizieren(saetze);
    _herkunft = 'saatdatei';
    _stand = { saetze: saetze.length, datei };
    return _stand;
  } catch (e) {
    console.error('[register] Saatdatei nicht lesbar:', e.message);
    /* 'fehlgeschlagen', NICHT 'leer' — sonst versucht der Lazy-Load es bei
     * jedem einzelnen Aufruf erneut. Einmal scheitern reicht. */
    _index = new Map(); _herkunft = 'fehlgeschlagen';
    _stand = { saetze: 0, fehler: e.message };
    return _stand;
  }
}

/**
 * Register aus mb.param_modell nachladen. Ueberschreibt die Saat NUR bei
 * Erfolg und nur, wenn die Tabelle ueberhaupt etwas liefert — eine leere
 * Tabelle darf ein gefuelltes Register nicht loeschen.
 */
export async function ladeAusDb(q, kennzahlen = ['liegenschaftszinssatz', 'sachwertfaktor']) {
  if (typeof q !== 'function') return { geladen: 0, grund: 'kein_q' };
  try {
    const rows = await q(
      `SELECT land_code, ags, ebene, gebiet_name, gaa_name, kennzahl, zweig,
              formel, korrekturen, modellansaetze, geltungsbereich, belege,
              stufe, fallzahl, stichtag, berichtsjahr, modellversion,
              quelle_url, quellenvermerk, lizenz
         FROM mb.param_modell
        WHERE kennzahl = ANY($1)`, [kennzahlen]);
    if (!rows || !rows.length) {
      return { geladen: 0, grund: 'tabelle_leer', behalten: _herkunft };
    }
    _index = indizieren(rows);
    _herkunft = 'param_modell';
    _stand = { saetze: rows.length };
    return { geladen: rows.length, herkunft: 'param_modell' };
  } catch (e) {
    console.error('[register] param_modell nicht lesbar:', e.message);
    return { geladen: 0, grund: 'fehler', fehler: e.message, behalten: _herkunft };
  }
}

/* ── Abfragen, synchron ────────────────────────────────────────────────── */

/**
 * Saetze einer Kennzahl fuer ein Gebiet, feinste Ebene zuerst.
 * KEIN TREFFER HEISST KEIN WERT — nie ein Nachbarkreis, nie ein Landesmittel.
 */
export function finde(kennzahl, ags) {
  /* v1083a-WLAZ · DIE PRUEFUNG DARF IHRE VORBEDINGUNG NICHT SELBST HERSTELLEN.
   *
   * In v1083 rief ladeSaat() NIEMAND ausser der Pruefstrecke — im laufenden
   * Server blieb das Register leer, und liegenschaftszinssatz() meldete fuer
   * jede Adresse "kein Ausschuss hinterlegt". Die Kettenpruefung war trotzdem
   * gruen, weil sie selbst geladen hat. Ein Test, der sich seine Vorbedingung
   * baut, prueft die Kette nicht.
   *
   * Jetzt laedt das Register sich beim ersten Zugriff selbst. Damit kann es
   * nicht mehr vergessen werden — egal wer zuerst fragt. */
  if (!_index.size && _herkunft === 'leer') ladeSaat();
  if (!_index.size) return [];
  for (const s of kaskadeSchluessel(ags)) {
    const t = _index.get(schluessel(kennzahl, s));
    if (t && t.length) return t;
  }
  return [];
}

/** Ein Satz einer Kennzahl fuer einen Zweig (Objektart), oder null. */
export function findeZweig(kennzahl, ags, zweig) {
  const t = finde(kennzahl, ags);
  if (!t.length) return null;
  const z = String(zweig || '').toLowerCase();
  return t.find((s) => String(s.zweig || '').toLowerCase() === z) || null;
}

/** Ist fuer dieses Gebiet ueberhaupt etwas hinterlegt? */
export function hatEintrag(ags, kennzahl) {
  return finde(kennzahl, ags).length > 0;
}

/** Fuer Diagnose und Bericht. */
export function registerStand() {
  return { herkunft: _herkunft, ..._stand,
           schluessel: _index.size,
           gebiete: new Set([..._index.keys()].map((k) => k.split('|')[1])).size };
}

/** Nur fuer Tests. */
export function _setzeRegister(saetze) {
  _index = indizieren(saetze); _herkunft = 'test'; _stand = { saetze: saetze.length };
}

export default { ladeSaat, ladeAusDb, finde, findeZweig, hatEintrag,
                 registerStand, kaskadeSchluessel };
