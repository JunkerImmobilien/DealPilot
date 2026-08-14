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

/* v1084a-WMRG · Die Saat wird als Liste behalten, nicht nur als Index.
 * Ohne sie liesse sich nach einem DB-Lauf nicht mehr sagen, welche Saetze
 * aus der Datei kamen — und genau das braucht die Zusammenfuehrung. */
let _saat = [];

/** Zaehlung je Kennzahl. Die einzige Zahl, an der man von aussen sieht, ob
 *  beide Kennzahlen im Register stehen. Sie gehoert deshalb ins Startlog. */
function jeKennzahl(saetze) {
  const n = {};
  for (const s of saetze) n[s.kennzahl] = (n[s.kennzahl] || 0) + 1;
  return n;
}

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
/* v1084-WSAAT · Eine Saatdatei je Kennzahl.
 *
 * Bis v1083 gab es genau eine Datei. Mit den Sachwertfaktoren kaeme eine
 * zweite dazu — und die Versuchung waere, sie an dieselbe Stelle zu haengen.
 * Das ginge einmal gut: beide Kennzahlen teilen sich den Index-Schluessel
 * `kennzahl|ags`, und ein zweites JSON.parse() auf dieselbe Variable haette
 * die erste Datei still ueberschrieben.
 *
 * Deshalb wird GESAMMELT und einmal indiziert. Fehlt eine Datei, laedt die
 * andere trotzdem — aber die Luecke wird gemeldet, nicht verschwiegen. */
export const SAATDATEIEN = ['lzs-nrw.json', 'swf-nrw.json',
                            'berlin.json',           /* v1085 */
                            'lzs-nrw-2023.json',     /* v1086 · Zeitreihe */
                            'bodenpreise-nrw.json',  /* v1086 · Flaeche */
                            'marktdaten-nrw.json',   /* v1087 · Marktdaten */
                            'ost.json',              /* v1088 · ST, TH */
                            'sued-nord.json',        /* v1089 · BY, NI */
                            'nord2.json',            /* v1090 · NI */
                            'laender2.json',         /* v1093 · BB, HE, NI, NRW */
                            'laender3.json'];        /* v1094 · BB, HE, NI */

export function ladeSaat(dateien = SAATDATEIEN) {
  const liste = (Array.isArray(dateien) ? dateien : [dateien])
    .map((d) => (String(d).includes('/') ? String(d) : join(HIER, 'register', d)));
  const alle = [];
  const gelesen = [];
  const vermisst = [];
  for (const datei of liste) {
    try {
      const saetze = JSON.parse(readFileSync(datei, 'utf8'));
      if (!Array.isArray(saetze)) throw new Error('kein Array');
      alle.push(...saetze);
      gelesen.push({ datei, saetze: saetze.length });   /* v1084a-WMRG */
    } catch (e) {
      vermisst.push({ datei, fehler: e.message });
      console.error('[register] Saatdatei nicht lesbar:', datei, e.message);
    }
  }
  if (alle.length) {
    _saat = alle;                                 /* v1084a-WMRG */
    _index = indizieren(alle);
    _herkunft = 'saatdatei';
    _stand = { saetze: alle.length, gelesen, vermisst,
               je_kennzahl: jeKennzahl(alle) };
    return _stand;
  }
  try {
    throw new Error(vermisst.map((v) => v.fehler).join('; ') || 'keine Saatdatei');
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
export async function ladeAusDb(q, kennzahlen = ['liegenschaftszinssatz',
                                               'sachwertfaktor',
                                               'bodenpreisniveau',
                                               'durchschnittspreis',
                                               'preisentwicklung',
                                               'erbbauzinssatz',
                                               /* v1094-WKZ */
                                               'vergleichsfaktor',
                                               'bodenpreisindex']) {
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

    /* v1084a-WMRG · DIE TABELLE GEWINNT JE KENNZAHL, NICHT PAUSCHAL.
     *
     * Bis v1084 ersetzte diese Zeile den ganzen Index. Auf Produktion lagen
     * in mb.param_modell 493 Liegenschaftszinssaetze und NULL
     * Sachwertfaktoren — die 31 Sachwertfaktoren der Saatdatei waren damit
     * zur Laufzeit weg, obwohl die Datei danebenlag und der Marker stand.
     *
     * Die alte Wache fing die LEERE Tabelle. Die halb gefuellte fing sie
     * nicht. Ab hier gilt: was die Tabelle fuehrt, kommt aus der Tabelle;
     * was sie nicht fuehrt, bleibt aus der Saat stehen. Ein Datensatz
     * verschwindet nur, wenn ihn jemand ausdruecklich ersetzt. */
    /* v1095-WMRG2 · JE DATENSATZ, NICHT JE KENNZAHL.
     *
     * Der Rollout von v1094 hat es sichtbar gemacht: die Saatdateien fuehren
     * 2150 Saetze, der laufende Server meldete 1565. In mb.param_modell
     * liegen 493 Liegenschaftszinssaetze aus dem Saatlauf vom 12.08. — nur
     * NRW, nur Berichtsjahr 2024. Weil die Tabelle die KENNZAHL fuehrte,
     * gewann sie fuer die ganze Kennzahl, und die 585 neueren Saetze
     * (Hessen, Niedersachsen, Brandenburg, Berlin, Sachsen-Anhalt,
     * Thueringen, Bayern, dazu der Jahrgang 2023) fielen still heraus.
     *
     * 2150 - 1078 + 493 = 1565. Die Rechnung ging exakt auf.
     *
     * Dieselbe Fehlerklasse wie in v1084a, eine Ebene tiefer: damals fing
     * die Wache die LEERE Tabelle, aber nicht die halb gefuellte; danach
     * fing sie die halb gefuellte, aber nicht die VERALTETE. Beide Male lag
     * dieselbe Annahme darunter — dass die Tabelle mindestens so aktuell
     * ist wie die Datei. Sie stimmt nicht: die Datei ist versioniert und
     * faehrt mit dem Code mit, die Tabelle wird von Hand nachgezogen.
     *
     * Der Schluessel ist derselbe wie der Eindeutigkeitsschluessel der
     * Tabelle. Das ist kein Zufall, sondern die Bedingung dafuer, dass
     * "ersetzen" ueberhaupt eine wohldefinierte Bedeutung hat. */
    const schluessel = (s) => [s.ags, s.kennzahl, s.zweig,
                               s.berichtsjahr ?? ''].join('|');
    const ausDb = new Set(rows.map(schluessel));
    const behalten = _saat.filter((s) => !ausDb.has(schluessel(s)));
    const zusammen = [...behalten, ...rows];
    const ersetzt = _saat.length - behalten.length;

    _index = indizieren(zusammen);
    _herkunft = behalten.length ? 'param_modell+saatdatei' : 'param_modell';
    _stand = { saetze: zusammen.length,
               aus_db: rows.length, aus_saat: behalten.length,
               /* v1095-WMRG2 · Wieviele Saetze der Saat die Tabelle
                * tatsaechlich ERSETZT hat. Ohne diese Zahl sieht ein
                * stiller Verlust genauso aus wie eine saubere
                * Zusammenfuehrung — beim v1094-Rollout war genau das der
                * Fall. Sie gehoert ins Startlog. */
               ersetzt,
               je_kennzahl: jeKennzahl(zusammen),
               db_fuehrt: [...ausDb].sort() };
    return { geladen: rows.length, aus_saat: behalten.length,
             herkunft: _herkunft, je_kennzahl: _stand.je_kennzahl };
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
  /* v1093-WSTD · Auch die Standmeldung loest die Saat aus.
   *
   * `finde()` laedt die Saatdatei beim ersten Zugriff selbst (v1083a-WLAZ).
   * `registerStand()` tat es nicht — wer also zuerst nach dem STAND fragte,
   * bekam "0 Saetze, Herkunft leer", obwohl das Register in Ordnung war.
   *
   * Genau der umgekehrte Fehler wie bei der Abfrage `--stand` aus v1084:
   * dort war die Auskunft gruen und wertlos, hier rot und falsch. Beide Male
   * lag es daran, dass die Auskunftsfunktion einen anderen Weg nimmt als der
   * Rechenweg. Eine Standmeldung, die den Zustand nicht herstellt, den sie
   * meldet, misst sich selbst. */
  if (!_index.size && _herkunft === 'leer') ladeSaat();
  /* v1093-WSTD · Die Laenderzaehlung. Seit v1093 traegt jeder Satz einen
   * abgeleiteten Landesschluessel; ohne diese Zeilen stuende er nur in der
   * Datei und waere keine Auskunft. Gezaehlt wird ueber die ersten beiden
   * Stellen des AGS — dieselbe amtliche Quelle, aus der er abgeleitet ist. */
  const LC = { '01':'SH','02':'HH','03':'NI','04':'HB','05':'NW','06':'HE',
               '07':'RP','08':'BW','09':'BY','10':'SL','11':'BE','12':'BB',
               '13':'MV','14':'SN','15':'ST','16':'TH' };
  const laender = {};
  for (const k of _index.keys()) {
    const c = LC[String(k.split('|')[1] || '').slice(0, 2)];
    if (c) laender[c] = (laender[c] || 0) + 1;
  }
  return { herkunft: _herkunft, ..._stand, laender,
           schluessel: _index.size,
           gebiete: new Set([..._index.keys()].map((k) => k.split('|')[1])).size };
}

/** Nur fuer Tests. */
export function _setzeRegister(saetze) {
  /* v1095-WMRG2 · DER MOCK MUSS DIE ECHTE SCHNITTSTELLE ABBILDEN.
   *
   * Bis v1094 setzte diese Testhilfe nur den Index, nicht die Saatliste.
   * Damit war `_saat` in jedem Test leer — und `ladeAusDb()` konnte gar
   * nichts "behalten", egal wie die Zusammenfuehrung gebaut war. Eine
   * Pruefung der Zusammenfuehrung haette IMMER nur die Tabelle gesehen und
   * das Ergebnis fuer richtig gehalten.
   *
   * Dieselbe Klasse wie der q()-Stub aus v1083, der `{rows: []}` lieferte,
   * wo die echte Funktion `res.rows` direkt gibt: ein Mock, der die
   * Schnittstelle nur halb nachbaut, prueft die halbe Wahrheit. */
  _saat = saetze;
  _index = indizieren(saetze); _herkunft = 'test'; _stand = { saetze: saetze.length };
}

export default { ladeSaat, ladeAusDb, finde, findeZweig, hatEintrag,
                 registerStand, kaskadeSchluessel };
