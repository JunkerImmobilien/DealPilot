// parser-p2-gmb.js  (v1066)
//
// P2 — Grundstuecksmarktberichte und Amtsblatt-Veroeffentlichungen.
//
// P2 IST KEIN PARSER, SONDERN EIN GERUEST.
//
// Die Annahme, man koenne "aus deutschen Marktbericht-PDFs die Zahlen
// ziehen", haelt der ersten Begegnung mit den Dokumenten nicht stand:
//
//   Minden-Luebbecke   Mittelwert mit Streuung, in Tabellen
//   AGVGA NRW          Landesmodell mit eigenen Ansaetzen
//   Berlin             Regressionsgleichung im Amtsblatt
//
// Ein generischer Leser wuerde bei Berlin eine Stuetzstelle fuer den
// Zinssatz halten. Deshalb: je Ausschuss ein Profil, das weiss, wo seine
// Zahlen stehen — und das seine Belege mitbringt.
//
// EINGANG IST TEXT, NICHT PDF.
// Die Umwandlung macht pdftotext auf dem Server. Damit bleibt das
// mb-Backend bei seinen drei Abhaengigkeiten (cors, express, pg), und der
// fragile Teil liegt in einem Werkzeug, das seit zwanzig Jahren nichts
// anderes tut. Ein selbstgebauter PDF-Textextraktor waere die Sorte
// Eigenbau, die man ein Jahr spaeter bereut.
//
// KEIN MODELL OHNE BELEG.
// Jedes Profil liefert die in derselben Veroeffentlichung abgedruckten
// Stuetzstellen mit. Rechnet die gelesene Formel sie nicht nach, wird
// NICHTS uebernommen. Die Quelle prueft sich selbst.

import { belegePruefen } from './modell.js';
import * as beLzs from './profile/be-lzs.js';

export const CODE = 'p2-gmb';

export const PROFILE = {
  [beLzs.ID]: beLzs,
};

export function profilListe() {
  return Object.keys(PROFILE).map((id) => ({
    id, land: PROFILE[id].LAND, ags: PROFILE[id].AGS, kennzahl: PROFILE[id].KENNZAHL,
  }));
}

/**
 * @param {string} profilId
 * @param {string} text     pdftotext-Ausgabe
 * @param {object} opt      { quelleUrl }
 * @returns {{ modelle:Array, saetze:Array, warnungen:Array, verworfen:Array }}
 */
export function parse(profilId, text, opt = {}) {
  const profil = PROFILE[profilId];
  if (!profil) {
    return { modelle: [], saetze: [], verworfen: [],
      warnungen: ['unbekanntes Profil: ' + profilId] };
  }
  if (!text || String(text).trim().length < 200) {
    return { modelle: [], saetze: [], verworfen: [],
      warnungen: ['Text ist leer oder zu kurz — lief pdftotext?'] };
  }

  const roh = profil.parse(text, opt);
  const warnungen = [...(roh.warnungen || [])];
  const modelle = [];
  const verworfen = [];

  for (const m of (roh.modelle || [])) {
    const p = belegePruefen(m);
    if (!p.ok) {
      verworfen.push({ zweig: m.zweig, geprueft: p.geprueft, fehler: p.fehler });
      warnungen.push('Modell "' + m.zweig + '" verworfen: '
        + p.fehler.length + ' von ' + p.geprueft
        + ' Stützstellen nicht getroffen ('
        + p.fehler.slice(0, 3).map((f) => f.miete + '→' + f.ist + ' statt ' + f.zins).join(', ')
        + ')');
      continue;
    }
    m.belege_geprueft = p.geprueft;
    modelle.push(m);
  }

  /* Ein Modell ist kein Wert — es gehoert nach mb.param_modell, nicht nach
   * mb.param_werte. Die Stuetzstellen wandern trotzdem als Spanne in die
   * Wertetabelle, damit die bundesweite Einordnung auch dort etwas findet,
   * wo die Gleichung mangels Miete nicht rechnen kann. Klassiert, Stufe C,
   * nie ein Rechenwert. */
  const saetze = [];
  for (const m of modelle) {
    const lo = Math.min(...m.belege.map((b) => b.zins));
    const hi = Math.max(...m.belege.map((b) => b.zins));
    saetze.push({
      land_code: m.land_code, ags: m.ags, ebene: m.ebene,
      gebiet_name: m.gebiet_name + ' · ' + m.zweig, gaa_name: m.gaa_name,
      objektart: 'mfh', kennzahl: m.kennzahl, einheit: '%',
      wert_num: null, wert_min: lo, wert_max: hi,
      klassiert: true, offen: null,
      wert_roh: String(lo).replace('.', ',') + ' bis ' + String(hi).replace('.', ',') + ' %',
      stufe: 'C', indikativ: true, semantik_offen: false,
      berichtsjahr: m.berichtsjahr, stichtag: m.stichtag,
      quelle_url: m.quelle_url, quelle_parser: m.quelle_parser,
      lizenz: m.lizenz, quellenvermerk: m.quellenvermerk,
    });
  }

  return { modelle, saetze, warnungen, verworfen };
}

export default { CODE, PROFILE, profilListe, parse };
