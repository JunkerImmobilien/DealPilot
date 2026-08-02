// klassen.js  (OD-02)
//
// Amtliche Marktdaten kommen haeufig KLASSIERT: "2500 und mehr", "bis unter 700",
// "450 bis unter 600". Diese Datei ist die einzige Stelle, an der aus so einem
// Text Zahlen werden — und die einzige Stelle, an der entschieden wird, wann es
// eben KEINE Zahl gibt.
//
// Die Regel, die alles traegt:
//   Eine offene Randklasse hat KEINE Mitte.
//   "2500 und mehr" ist nicht 2500 und erst recht nicht 3000. Es ist eine
//   Untergrenze. Wer daraus einen Punktwert macht, erfindet Marktdaten.
//
// Deshalb liefert parseKlasse() immer {min, max, offen} und NIE stillschweigend
// einen Mittelwert. Die Mitte gibt es nur ueber mitte(), und die gibt bei
// offenen Klassen null zurueck.

/** Zahl aus deutschem ODER englischem Dezimalformat. Gibt null statt NaN. */
export function zahl(roh) {
  if (roh == null) return null;
  let t = String(roh).trim().replace(/"/g, '');
  if (!t) return null;
  if (/^(NA|N\/A|k\.A\.|-|–|\.\.\.|x)$/i.test(t)) return null;
  // "1.234,56" -> deutsch;  "1234.56" -> englisch;  "1.234" ist mehrdeutig
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  t = t.replace(/[^\d.\-]/g, '');
  if (!t || t === '-' || t === '.') return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Klassentext -> { min, max, offen, klassiert, roh }
 *   offen: null | 'oben' | 'unten'
 * Ein reiner Punktwert ("3,45") kommt als klassiert:false mit min===max zurueck.
 */
export function parseKlasse(roh) {
  const leer = { min: null, max: null, offen: null, klassiert: false, roh: roh == null ? null : String(roh) };
  if (roh == null) return leer;
  const t = String(roh).trim().replace(/^"|"$/g, '');
  if (!t || /^(NA|N\/A|k\.A\.|-|–|\.\.\.|x)$/i.test(t)) return leer;

  // "450 bis unter 600" / "450 bis 600" / "450 - 600"
  let m = t.match(/^(.+?)\s*(?:bis\s+unter|bis|–|—|-)\s*(.+)$/i);
  if (m && !/^bis/i.test(t)) {
    const a = zahl(m[1]); const b = zahl(m[2]);
    if (a != null && b != null) return { min: a, max: b, offen: null, klassiert: true, roh: t };
  }

  // "bis unter 700" / "unter 700" / "weniger als 700"
  m = t.match(/^(?:bis\s+unter|bis|unter|weniger\s+als|<)\s*(.+)$/i);
  if (m) {
    const b = zahl(m[1]);
    if (b != null) return { min: null, max: b, offen: 'unten', klassiert: true, roh: t };
  }

  // "2500 und mehr" / "ab 2500" / "2500 oder mehr" / ">= 2500"
  m = t.match(/^(?:ab\s*)?(.+?)\s*(?:und\s+mehr|oder\s+mehr|und\s+groesser|und\s+größer)$/i)
   || t.match(/^(?:ab|>=|>)\s*(.+)$/i);
  if (m) {
    const a = zahl(m[1]);
    if (a != null) return { min: a, max: null, offen: 'oben', klassiert: true, roh: t };
  }

  // Punktwert
  const p = zahl(t);
  if (p != null) return { min: p, max: p, offen: null, klassiert: false, roh: t };
  return leer;
}

/**
 * Klassenmitte — NUR bei beidseitig begrenzter Klasse.
 * Offene Randklassen liefern null. Das ist Absicht und darf nicht
 * mit einem ||-Fallback ueberschrieben werden.
 */
export function mitte(k) {
  if (!k || k.offen) return null;
  if (k.min == null || k.max == null) return null;
  return (k.min + k.max) / 2;
}

/** Anzeigetext, der die Herkunft nicht verliert. */
export function alsText(k) {
  if (!k || (k.min == null && k.max == null)) return '–';
  if (!k.klassiert) return String(k.min);
  if (k.offen === 'oben') return `ab ${k.min}`;
  if (k.offen === 'unten') return `unter ${k.max}`;
  return `${k.min} bis unter ${k.max}`;
}

/**
 * Ein klassierter Wert ist IMMER indikativ und nie besser als Stufe C.
 * Diese Funktion ist die Bremse: sie laesst keine Stufe A/B durch, wenn
 * die Quelle nur Spannen liefert.
 */
export function stufeBegrenzen(stufeGewuenscht, k) {
  if (k && k.klassiert) return 'C';
  return stufeGewuenscht;
}

export default { zahl, parseKlasse, mitte, alsText, stufeBegrenzen };
