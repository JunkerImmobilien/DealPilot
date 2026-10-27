/* ═══════════════════════════════════════════════════════════════════════
   lib/stichtag.js · v3010 — DER WERTERMITTLUNGSSTICHTAG DES BERICHTS
   (§ 2 Abs. 4 ImmoWertV: der Zeitpunkt, auf den sich die Wertermittlung bezieht)

   Marcel 27.10.2026: Feld „Wertermittlungsstichtag", leer = heute. An ihm haengen
   Baupreisindex (veroeffentlichter Stand), das Alter in der Restnutzungsdauer,
   die Mietabweichung (boG), die Fortschreibung von Zensus und NRW-BWK und die
   Wahl des Register-Jahrgangs. EINE Stelle, die das Datum liest - vorher stand
   in jedem dieser Wege `new Date()`.

   Eingabe: ISO JJJJ-MM-TT oder TT.MM.JJJJ. Ungueltig oder in der Zukunft ->
   heute, der verworfene Wert wird ausgewiesen.
   ═══════════════════════════════════════════════════════════════════════ */

export function stichtagAus(roh) {
  if (roh == null || roh === '') return { datum: new Date(), eigen: false, iso: null, verworfen: null };
  if (roh instanceof Date) roh = isNaN(roh) ? '' : roh.toISOString().slice(0, 10);
  let s = String(roh).trim();
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) s = de[3] + '-' + de[2].padStart(2, '0') + '-' + de[1].padStart(2, '0');
  s = s.slice(0, 10);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + 'T12:00:00Z') : NaN;
  if (!Number.isFinite(t) || t > Date.now()) return { datum: new Date(), eigen: false, iso: null, verworfen: String(roh) };
  return { datum: new Date(t), eigen: true, iso: s, verworfen: null };
}

/** Stichtag aus einem Objekt mit Feld `wertermittlungsstichtag` (ref, params, input). */
export function stichtagVon(obj) { return stichtagAus(obj && obj.wertermittlungsstichtag); }

/** Jahr des Stichtags (fuer Alter = Stichtagsjahr − Baujahr). */
export function stichtagJahr(obj) { return stichtagVon(obj).datum.getFullYear(); }

/** ISO-Datum des Stichtags, auch wenn er „heute" ist. */
export function stichtagIso(st) {
  const d = st && st.datum instanceof Date ? st.datum : new Date();
  return st && st.iso ? st.iso : d.toISOString().slice(0, 10);
}

export default { stichtagAus, stichtagVon, stichtagJahr, stichtagIso };
