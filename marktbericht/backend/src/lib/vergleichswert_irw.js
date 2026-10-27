/* ════════════════════════════════════════════════════════════════════
   v2620 · VERGLEICHSWERT AUS DEM IMMOBILIENRICHTWERT (NRW)
   §§ 24–26 ImmoWertV, § 20 ImmoWertV, ImmoWertA zu § 20 und § 26

   WAS DAS IST
   Der Immobilienrichtwert (IRW) ist ein Vergleichsfaktor im Sinne des
   § 20 ImmoWertV: aus der KAUFPREISSAMMLUNG abgeleitet, vom Ausschuss
   beschlossen, in Euro je m² Wohnflaeche, bezogen auf ein Normobjekt.
   Weicht das Bewertungsobjekt vom Normobjekt ab, wird er mit den
   Umrechnungskoeffizienten DESSELBEN Ausschusses angepasst — „ausschliess-
   lich mit den Umrechnungstabellen des Gutachterausschusses", „nur innerhalb
   des Modells" (Gars Dortmund, ebenso Herford: „nur innerhalb des Modells
   des Gutachterausschusses mit seinen entsprechenden Umrechnungskoeffizienten").

       vorlaeufiger Vergleichswert
         = IRW × Π ( UK(Objekt) / UK(Normobjekt) ) × Wohnflaeche
       Vergleichswert
         = vorlaeufiger Vergleichswert ± besondere objektspezifische
           Grundstuecksmerkmale (§ 8 Abs. 3, ImmoWertA zu § 26),
           darunter Stellplaetze, wenn das Modell sie AUSSCHLIESST.

   Angebotspreise sind KEIN Vergleichswert (§ 25 Abs. 1). Die bisherige
   Marktpreisindikation aus Angeboten bleibt unberuehrt und heisst weiter so.

   DIE REGELN (Doktrin, CLAUDE.md „Wertermittlung")
   - Koeffizienten NUR aus dem Register (uk-irw-*.json, Kennzahl
     `umrechnung_irw`), je Ausschuss × Teilmarkt × Jahrgang.
   - Tabellen: lineare Interpolation innerhalb, NIE Extrapolation.
     Ausserhalb → kein Wert, mit Grund.
   - Fehlt ein Merkmal des Objekts, das der Ausschuss umrechnet → kein Wert,
     mit der Liste dessen, was fehlt (Weg: Angabe nachtragen).
   - Liegt der Wert auf einer Klassengrenze zweier verschiedener
     Koeffizienten → kein Wert („in den Randbereichen sachverstaendig").
   - Eine Sperre im Register traegt keine rechenbare formel.
   - Ergebnis Stufe A (amtlich): IRW und Koeffizienten sind beschlossen.

   SCHNITTSTELLE (fuer CrossCheckService — die Verdrahtung macht der
   Hauptagent, dieses Modul ruft keinen Dienst):

     import { vergleichswertIrw } from '../lib/vergleichswert_irw.js';
     const v = vergleichswertIrw({
       irw,      // Ergebnis von IrwConnector.hole() (mit .roh = Zonenmerkmale)
       objekt,   // kanonische Merkmale, siehe EINGABEN unten
       bog,      // optional [{ pos, eur }] — besondere objektspez. Merkmale
       saetze,   // optional: Registersaetze (Test); sonst aus dem Ordner
     });

     v.verfuegbar === true:
       { wert_qm, wert_qm_roh, vorlaeufig_eur, vergleichswert_eur, stufe:'A',
         faktoren:[{id, name, objekt, norm, uk, art}], rechenweg:[{pos, detail, wert}],
         bog:[…], stellplaetze_im_irw, quelle:{…}, quellennachweis, hinweise:[] }
     v.verfuegbar === false:
       { grund: 'kein_irw'|'kein_satz'|'sperre'|'merkmal_fehlt'|'ausserhalb'|
                'norm_unbekannt'|'zweifel'|'teilmarkt',
         fehlt:[ids], hinweis, weg:{url, text} }
   ════════════════════════════════════════════════════════════════════ */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const KENNZAHL = 'umrechnung_irw';
const HIER = dirname(fileURLToPath(import.meta.url));
const ORDNER = join(HIER, 'register');

/* Teilmarkt-Kennung des IRW-Datenmodells (Feld 19 UDOK / 21 TEILMA). */
export const TEILMAERKTE = {
  1: 'etw', 2: 'efh_zfh', 3: 'rh_dhh', 4: 'mfh', 5: 'gemischt', 6: 'buero', 7: 'gewerbe',
};

/* Kanonische Objektmerkmale. Ein Registersatz darf in `eingabe` nur
   diese Namen fuehren; der Pruefer (tools/irw-pruefen.mjs) haelt das fest.
   Codes nach dem IRW-Datenmodell NRW (Borisplus v3.3, Feldnummer in Klammern). */
export const EINGABEN = {
  baujahr: 'Baujahr (Jahr der Bezugsfertigkeit), Zahl',
  wohnflaeche: 'Wohnfläche in m², Zahl',
  grundstuecksflaeche: 'Grundstücksfläche in m², Zahl',
  bodenrichtwert: 'Bodenrichtwert am Objekt in €/m², Zahl',
  standardstufe: 'Standardstufe nach Anlage 4 ImmoWertV (1,0–5,0)',
  gstand: 'Gebäudestandard (60), Code 1–10 — wird aus der Standardstufe abgeleitet, wenn nicht angegeben',
  modernisierungspunkte: 'Modernisierungspunkte nach Anlage 2 ImmoWertV (0–20)',
  mgrad: 'Modernisierungsgrad (61), Code 1–5',
  mtyp: 'Modernisierungstyp (28), Code 1 baujahrtypisch · 2 teilmodernisiert · 3 neuzeitlich',
  keller: 'Keller vorhanden, ja/nein',
  anbauweise: "Ergänzende Gebäudeart (24): 'freistehend' | 'doppelhaushaelfte' | 'reihenendhaus' | 'reihenmittelhaus'",
  gebaeudeart: "Gebäudeart (23): 'efh' | 'efh_einlieger' | 'zfh' | 'dfh' | 'mfh' | 'villa'",
  vermietet: 'vermietet, ja/nein',
  wohnlage: 'Wohnlage (11), Code 1 sehr gut … 8 sehr einfach, oder Wort des Ausschusses',
  einheiten: 'Anzahl der Wohnungen/Einheiten im Gebäude bzw. der Anlage, Zahl',
  geschoss: 'Geschosslage (31), Code: 88 EG, 1…n OG, 77 DG, 99 Souterrain, 98 Maisonette, 67 Penthouse',
  erstverkauf: 'Erstverkauf aus Neubau, ja/nein',
  balkon: 'Balkon/Terrasse vorhanden, ja/nein',
  aufzug: 'Aufzug vorhanden, ja/nein',
  garage: 'Garage/Stellplatz im Kaufpreis enthalten, ja/nein',
  dachgeschoss: 'Dachgeschoss ausgebaut, ja/nein',
  restnutzungsdauer: 'Restnutzungsdauer in Jahren, Zahl',
  geschosse: 'Anzahl der Geschosse im Gebäude, Zahl (36)',
  denkmalschutz: 'Baudenkmal, ja/nein (54)',
  /* v2680 · Merkmale, die Umrechnungsdokumente weiterer Ausschüsse führen, DealPilot aber
     (noch) nicht als Eingabe hat. Ohne Angabe meldet der Kern merkmal_fehlt — es wird nichts geraten. */
  energieklasse: 'Energieeffizienzklasse nach GEG (A+, A, B … H)',
  energiekennwert: 'Endenergiebedarf bzw. -verbrauch in kWh/(m²·a), Zahl',
  rohertrag_qm: 'Nettokaltmiete in €/m² Wohnfläche und Monat, Zahl',
  balkon_art: "Art des Freisitzes: 'balkon' | 'loggia' | 'terrasse' | 'dachterrasse' | 'keiner'",
  keller_art: "Unterkellerung: 'voll' | 'teil' | 'kein'",
  stellplatz_art: "Stellplatz im Kaufpreis: 'garage' | 'tiefgarage' | 'carport' | 'stellplatz' | 'keiner'",
  fertighaus: 'Fertighaus (Fertigbauweise), ja/nein',
  erbbaurecht: 'Erbbaurecht, ja/nein',
  /* v2680 · aus der zweiten IRW-Ernte (58 Ausschüsse), von den Erntelinien gemeldet */
  baujahr_fiktiv: 'Fiktives Baujahr nach Anlage 2 ImmoWertV (Stichtag + Restnutzungsdauer − Gesamtnutzungsdauer des Ausschussmodells), Zahl',
  bodenrichtwert_2022: 'Bodenrichtwert am Objekt zum 01.01.2022 in €/m² (Lagewert-Stichtag des Ausschusses), Zahl',
  lagewert: 'Lagewert nach dem Modell des Ausschusses (z. B. Lagebeurteilung × Lageanpassungsfaktor, dimensionslos)',
  optik: 'Äußeres Erscheinungsbild, IRW-Datenmodell Feld 67, Code 1–9',
  wohnflaeche_je_einheit: 'Durchschnittliche Wohnfläche je Wohnung im Gebäude in m² (Gesamtwohnfläche / Einheiten), Zahl',
  verkaufsumstand: "Verkaufsumstand: 'weiterverkauf' | 'erstverkauf_umwandlung' | 'erstverkauf_neubau'",
  zimmer: 'Anzahl der Zimmer (Räume), Zahl',
  barrierefrei: 'Alten- bzw. behindertengerecht (barrierefrei), ja/nein',
  barrierearm: 'Barrierearmer Ausbau (IRW-Feld BEHING), ja/nein',
  umwandlung: 'Nachträglich in Wohnungseigentum umgewandelt, ja/nein',
  garagen_anzahl: 'Anzahl der Garagen, Zahl',
  carport_anzahl: 'Anzahl der Carports, Zahl',
  garage_ort: "Lage der Garage: 'hausgrundstueck' | 'separat' | 'keine'",
  grundstuecksart: "Grundstücksart nach Lage: 'binnen' | 'einfront' | 'zweifront' | 'kopf' | 'eck'",
  balkon_nutzwert: "Nutzwert des Balkons: 'kein' | 'gering' | 'normal' | 'hoch' | 'terrasse'",
  terrasse: 'Terrasse vorhanden, ja/nein',
  gewerbeanteil_klasse: "Gewerbeanteil am Rohertrag: 'kein' | 'bis 20' | '21-50' | 'über 50'",
  jahresrohertrag_qm: 'Jahresrohertrag in €/m² Wohn-/Nutzfläche und JAHR, Zahl',
  wohn_nutzflaeche: 'Summe aus Wohn- und Nutzfläche in m², Zahl',
  einheiten_anlage: 'Anzahl der Wohnungen in der gesamten Wohnanlage, Zahl',
  /* v3015 · Kernausbau (additiv, matrix_linear, Bedingung, Gemeindegruppe) */
  alter: 'Gebäudealter in Jahren am Stichtag nach dem Modell des Ausschusses (tatsächlich bzw. bei Modernisierung fiktiv), Zahl — ohne Angabe aus dem fiktiven Baujahr, nie still aus dem Baujahr',
  gemeinde: 'Gemeinde des Objekts (Name wie in BORIS-NRW, Feld GENA) — sonst aus der Richtwertzone',
  bodenrichtwert_2023: 'Bodenrichtwert am Objekt zum 01.01.2023 in €/m² (Lagewert-Stichtag des Ausschusses), Zahl',
  dachgeschoss_ausbau: "Ausbau des Dachgeschosses: 'flachdach' | 'nicht' | 'teilweise' | 'voll'",
  ausstattung: "Ausstattungsklasse nach dem Wort des Ausschusses (z. B. 'einfach' | 'mittel' | 'gehoben')",
  stellplatz_anzahl: 'Anzahl der Garagen und Stellplätze im Kaufpreis, Zahl',
  /* Kein Objektmerkmal: Zeitpunkt. Stichtag des Richtwerts = Wertermittlungsstichtag. */
  stichtag: '(intern) Registrierungsjahr/Kaufzeitpunkt — gleich dem Richtwertstichtag',
};

/* IRW-Datenmodell Feld 60: Standardstufe → Gebaeudestandard-Code.
   [1,0–1,2]=1 … [2,8–3,2]=5 … [5,0]=10. Auf eine Stelle gerundet. */
export function gstandAusStandardstufe(s) {
  const x = Math.round(Number(s) * 10) / 10;
  if (!(x >= 1 && x <= 5)) return null;
  const B = [[1.2, 1], [1.7, 2], [2.2, 3], [2.7, 4], [3.2, 5], [3.7, 6], [4.2, 7], [4.7, 8], [4.9, 9], [5.0, 10]];
  for (const [o, c] of B) if (x <= o + 1e-9) return c;
  return null;
}

const leer = (v) => v == null || (typeof v === 'string' && (!v.trim() || v.trim() === 'n/a'));
const num = (v) => {
  if (leer(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!/^-?[\d.,]+$/.test(s)) return null;
  /* Nur Dezimalkomma; Tausenderpunkte kommen in den IRW-Feldern nicht vor
     (Datenmodell: „ohne Tausender-Trennzeichen"). Siehe Memory „Punkt ist kein Tausender". */
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const r3 = (x) => Math.round(x * 1000) / 1000;
const de = (x, st = 3) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: st, maximumFractionDigits: st });
const eur = (x) => Number(x).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €';

/* ── Register ─────────────────────────────────────────────────────── */
let _cache = null;
export function ladeSaetze() {
  if (_cache) return _cache;
  const alle = [];
  for (const f of readdirSync(ORDNER).filter((x) => x.startsWith('uk-irw-') && x.endsWith('.json')).sort()) {
    for (const s of JSON.parse(readFileSync(join(ORDNER, f), 'utf8'))) {
      if (s && s.kennzahl === KENNZAHL) alle.push({ ...s, _datei: f });
    }
  }
  _cache = alle;
  return alle;
}

/** Registersatz fuer Ausschuss (GASL) × Teilmarkt × Jahrgang. */
export function satzFuer({ gasl, teilmarkt, jahrgang = null, saetze = null }) {
  const tm = typeof teilmarkt === 'number' ? TEILMAERKTE[teilmarkt] : teilmarkt;
  const alle = (saetze || ladeSaetze()).filter((s) => String(s.gasl) === String(gasl) && s.zweig === tm);
  if (!alle.length) return null;
  const passend = jahrgang ? alle.filter((s) => Number(s.jahrgang) === Number(jahrgang)) : alle;
  const pool = passend.length ? passend : [];
  pool.sort((a, b) => Number(b.jahrgang) - Number(a.jahrgang));
  return pool[0] || null;
}

/* ── Merkmal auswerten ────────────────────────────────────────────── */

/* Objektwert fuer ein Merkmal aus den kanonischen Eingaben. */
/* `eingabe` darf eine Liste sein: der erste Wert, der in der Tabelle
   vorkommt, gilt (z. B. ['anbauweise','gebaeudeart'] — eine Doppelhaus-
   haelfte vor dem Einfamilienhaus). */
function eingabeWert(k, m, objekt, ctx = {}) {
  let v = objekt ? objekt[k] : undefined;
  /* v3015 · Alter: nur ausdruecklich oder aus dem FIKTIVEN Baujahr. Aus dem Baujahr allein
     waere es bei einem modernisierten Haus falsch (Borken: „bei Modernisierungen fiktives Alter"). */
  if (k === 'alter' && leer(v) && objekt && num(objekt.baujahr_fiktiv) != null && ctx.jahr) v = Number(ctx.jahr) - num(objekt.baujahr_fiktiv);
  if (k === 'gemeinde' && leer(v) && ctx.roh && !leer(ctx.roh.GENA)) v = String(ctx.roh.GENA).trim();
  if (k === 'gstand' && leer(v) && objekt && !leer(objekt.standardstufe)) v = gstandAusStandardstufe(objekt.standardstufe);
  if (k === 'mgrad' && leer(v) && objekt && !leer(objekt.modernisierungspunkte) && m.punkte_zuordnung) {
    const p = Number(objekt.modernisierungspunkte);
    const t = m.punkte_zuordnung.find((z) => p >= z.von && p <= z.bis);
    v = t ? t.wert : '__grenze__';
  }
  if (typeof v === 'boolean') v = v ? 'ja' : 'nein';
  if (m.runden != null && typeof v === 'number') v = Math.round(v * 10 ** m.runden) / 10 ** m.runden;
  return leer(v) ? null : v;
}
function objektWert(m, objekt, ctx = {}) {
  const liste = Array.isArray(m.eingabe) ? m.eingabe : [m.eingabe];
  let erst = null;
  for (const k of liste) {
    const v = eingabeWert(k, m, objekt, ctx);
    if (v == null) continue;
    if (erst == null) erst = v;
    if (liste.length === 1) return v;
    const s = String(aufSchluessel(m, v)).toLowerCase();
    const bekannt = m.art === 'kategorien' ? Object.keys(m.werte || {}).some((x) => x.toLowerCase() === s)
      : m.art === 'matrix' ? (m.kategorien || []).some((x) => String(x).toLowerCase() === s) : true;
    if (bekannt) return v;
  }
  return erst;
}

/* Wert auf den Schluessel des Merkmals bringen (Code → Kategorie).
   Objekt: `zuordnung`; Norm: `norm_zuordnung` (sonst `zuordnung`) —
   die Norm kommt als Code des IRW-Datenmodells, das Objekt oft anders. */
function aufSchluessel(m, v, fuerNorm = false) {
  if (v == null) return null;
  const z = (fuerNorm && m.norm_zuordnung) || m.zuordnung || {};
  const s = String(v).trim();
  if (Object.prototype.hasOwnProperty.call(z, s)) return z[s];
  const k = Object.keys(z).find((x) => x.toLowerCase() === s.toLowerCase());
  return k != null ? z[k] : v;
}

/* Klasse finden: Name ODER Zahl. Liefert {klasse} | {grenze:true} | null. */
function klasseFuer(m, v) {
  const kl = m.klassen || [];
  const s = String(v).trim().toLowerCase();
  const nachName = kl.find((k) => String(k.name || '').trim().toLowerCase() === s);
  if (nachName) return { klasse: nachName };
  /* Spanne wie im IRW-Feld: "126-150" */
  const sp = String(v).match(/^\s*(\d+(?:[.,]\d+)?)\s*-\s*(\d+(?:[.,]\d+)?)\s*$/);
  if (sp) {
    const a = num(sp[1]), b = num(sp[2]);
    const t = kl.find((k) => k.von === a && k.bis === b);
    return t ? { klasse: t } : null;
  }
  const x = num(v);
  if (x == null) return null;
  const treffer = kl.filter((k) => (k.von == null || x >= k.von) && (k.bis == null || x <= k.bis));
  if (!treffer.length) return null;
  const uks = new Set(treffer.map((k) => k.uk));
  if (treffer.length > 1 && uks.size > 1) return { grenze: true, treffer };
  return { klasse: treffer[0] };
}

/* Kurve: lineare Interpolation, keine Extrapolation. */
function kurveBei(m, x) {
  const xs = m.x, ys = m.uk;
  const zw = (m.zweifel || []).map((z) => Number(z.bei));
  for (let i = 0; i < xs.length; i++) {
    if (Math.abs(xs[i] - x) < 1e-9) {
      if (zw.includes(xs[i])) return { zweifel: xs[i] };
      return ys[i] == null ? null : { uk: Number(ys[i]) };
    }
    if (i + 1 < xs.length && ((xs[i] < x && x < xs[i + 1]) || (xs[i] > x && x > xs[i + 1]))) {
      if (zw.includes(xs[i]) || zw.includes(xs[i + 1])) return { zweifel: zw.includes(xs[i]) ? xs[i] : xs[i + 1] };
      if (ys[i] == null || ys[i + 1] == null) return null;
      return { uk: Number(ys[i]) + (Number(ys[i + 1]) - Number(ys[i])) * (x - xs[i]) / (xs[i + 1] - xs[i]) };
    }
  }
  return null;
}

/* ══ v3015 · MATRIX „RICHTWERTOBJEKT × BEWERTUNGSOBJEKT" MIT INTERPOLATION ══
   zeilen_norm   Stuetzstellen des Richtwertobjekts (Zone), Zahlen, auf- oder absteigend
   spalten_objekt Stuetzstellen des Bewertungsobjekts
   werte[i][j]   Koeffizient fuer Norm zeilen_norm[i] und Objekt spalten_objekt[j], WIE GEDRUCKT
   Zwischen den Stuetzstellen linear in beide Richtungen (bilinear), wenn das Dokument
   interpoliert oder keine eigene Regel nennt; `interpolation: false` laesst nur Treffer zu.
   Ausserhalb der Stuetzstellen kein Wert (nie Extrapolation). */
function klammer(achse, x) {
  for (let i = 0; i < achse.length; i++) {
    if (Math.abs(achse[i] - x) < 1e-9) return { i, j: i, t: 0 };
    if (i + 1 < achse.length && ((achse[i] < x && x < achse[i + 1]) || (achse[i] > x && x > achse[i + 1]))) {
      return { i, j: i + 1, t: (x - achse[i]) / (achse[i + 1] - achse[i]) };
    }
  }
  return null;
}
export function matrixLinearBei(m, xNorm, xObjekt) {
  const z = klammer(m.zeilen_norm || [], xNorm), s = klammer(m.spalten_objekt || [], xObjekt);
  if (!z) return { aus: 'norm' };
  if (!s) return { aus: 'objekt' };
  if (m.interpolation === false && (z.t !== 0 || s.t !== 0)) return { aus: 'zwischen' };
  const w = (a, b) => { const r = (m.werte[a] || [])[b]; return r == null ? null : Number(r); };
  const ecken = [w(z.i, s.i), w(z.i, s.j), w(z.j, s.i), w(z.j, s.j)];
  if (ecken.some((e) => e == null)) {
    /* v3015 · gedruckter Fehler (zweifel: [{zeile, spalte, grund}]) ist kein Loch, sondern eine Rueckfrage */
    const zl = [m.zeilen_norm[z.i], m.zeilen_norm[z.j]], sl = [m.spalten_objekt[s.i], m.spalten_objekt[s.j]];
    const zw = (m.zweifel || []).find((q) => q && zl.includes(q.zeile) && sl.includes(q.spalte));
    return zw ? { aus: 'zweifel', zweifel: zw } : { aus: 'luecke' };
  }
  const oben = ecken[0] + (ecken[1] - ecken[0]) * s.t;
  const unten = ecken[2] + (ecken[3] - ecken[2]) * s.t;
  let uk = oben + (unten - oben) * z.t;
  if (m.uk_runden != null) uk = Math.round(uk * 10 ** m.uk_runden) / 10 ** m.uk_runden;
  /* v3015 · vom Ausschuss als „nicht gesichert" markierte Zeilen/Spalten: rechnet (der Ausschuss
     rechnet sie selbst), aber mit Hinweis */
  const ug = m.ungesichert || null;
  const zeilenBenutzt = z.t === 0 ? [m.zeilen_norm[z.i]] : [m.zeilen_norm[z.i], m.zeilen_norm[z.j]];
  const spaltenBenutzt = s.t === 0 ? [m.spalten_objekt[s.i]] : [m.spalten_objekt[s.i], m.spalten_objekt[s.j]];
  const ungesichert = !!(ug && (zeilenBenutzt.some((x) => (ug.zeilen || []).includes(x)) || spaltenBenutzt.some((x) => (ug.spalten || []).includes(x))));
  return { uk, interpoliert: z.t !== 0 || s.t !== 0, ungesichert };
}

/* ══ v3015 · MATRIX MIT KLASSEN „RICHTWERT (ZEILE) × BEWERTUNGSOBJEKT (SPALTE)" (Moers) ══
   zeilen_norm / spalten_objekt: Eintraege als Name ("mittel", "151 - 200", "< 80", "> 200",
   "2023-2018") oder Zahl (2013). Zuordnung: erst der Name (nach zuordnung/norm_zuordnung),
   dann eine Zahl in der Klasse (von–bis, offene Grenzen; Zahl = Einzelwert). Mehrere Klassen
   mit einer Zahl → Grenze (kein Wert). Keine Interpolation. Leere Zelle → kein Wert. */
function klasseAusName(e) {
  if (typeof e === 'number') return { von: e, bis: e };
  const s = String(e).replace(/\s+/g, '').replace(',', '.');
  let r;
  if ((r = s.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/))) { const a = Number(r[1]), b = Number(r[2]); return { von: Math.min(a, b), bis: Math.max(a, b) }; }
  if ((r = s.match(/^<(\d+(?:\.\d+)?)$/))) return { bis: Number(r[1]), bis_offen: true };
  if ((r = s.match(/^>(\d+(?:\.\d+)?)$/))) return { von: Number(r[1]), von_offen: true };
  if ((r = s.match(/^(\d+(?:\.\d+)?)$/))) return { von: Number(r[1]), bis: Number(r[1]) };
  return null;
}
const normName = (x) => String(x).replace(/\s+/g, '').toLowerCase();
function indexInListe(liste, v) {
  const n = normName(v);
  const i = liste.findIndex((e) => normName(e) === n);
  if (i >= 0) return { i };
  const x = num(v);
  if (x == null) return { i: -1 };
  const treffer = [];
  liste.forEach((e, k) => {
    const c = klasseAusName(e);
    if (!c) return;
    const ok1 = c.von == null || (c.von_offen ? x > c.von : x >= c.von);
    const ok2 = c.bis == null || (c.bis_offen ? x < c.bis : x <= c.bis);
    if (ok1 && ok2) treffer.push(k);
  });
  if (treffer.length > 1) return { i: -1, grenze: treffer.map((k) => liste[k]) };
  return { i: treffer.length ? treffer[0] : -1 };
}

/* ══ v3015 · INTERPOLATIONSFUNKTION DES AUSSCHUSSES (Dortmund) ═══════════════════
   m.formel: der gedruckte Ausdruck in Zeichen, die dieser kleine Leser kennt — Zahlen (Punkt),
   x (Objekt), n (Richtwertobjekt/Zone), + − * / ^, Klammern, sqrt ln exp log10. Kein eval.
   Ergebnis: Zu-/Abschlag in Prozent. Nur im Bereich der Tabelle (bereich_objekt/bereich_norm),
   nie darueber hinaus; klemme_objekt.unter: Tabellenklasse „bis …" (Wert an dieser Grenze). */
const FN = { sqrt: Math.sqrt, ln: Math.log, exp: Math.exp, log10: Math.log10 };
export function formelWert(text, vars) {
  const t = String(text).match(/\d+(?:\.\d+)?|[a-z0-9_]+|[-+*/^()]/gi) || [];
  if (t.join('') !== String(text).replace(/\s+/g, '')) throw new Error('Formel enthält unbekannte Zeichen');
  let p = 0;
  const sieh = () => t[p], nimm = () => t[p++];
  const ausdruck = () => { let v = term(); while (sieh() === '+' || sieh() === '-') { const o = nimm(); const w = term(); v = o === '+' ? v + w : v - w; } return v; };
  const term = () => { let v = faktor(); while (sieh() === '*' || sieh() === '/') { const o = nimm(); const w = faktor(); v = o === '*' ? v * w : v / w; } return v; };
  const faktor = () => { if (sieh() === '-') { nimm(); return -faktor(); } if (sieh() === '+') { nimm(); return faktor(); } const b = basis(); if (sieh() === '^') { nimm(); return b ** faktor(); } return b; };
  const basis = () => {
    const k = nimm();
    if (k === '(') { const v = ausdruck(); if (nimm() !== ')') throw new Error('Klammer'); return v; }
    if (/^\d/.test(k)) return Number(k);
    if (Object.prototype.hasOwnProperty.call(FN, k)) { if (nimm() !== '(') throw new Error('Funktion ohne Klammer'); const v = ausdruck(); if (nimm() !== ')') throw new Error('Klammer'); return FN[k](v); }
    if (Object.prototype.hasOwnProperty.call(vars, k)) return Number(vars[k]);
    throw new Error('unbekannt: ' + k);
  };
  const v = ausdruck();
  if (p !== t.length) throw new Error('Formel nicht zu Ende gelesen');
  return v;
}
function imBereich(b, x) { return !b || ((b.von == null || x >= b.von - 1e-9) && (b.bis == null || x <= b.bis + 1e-9)); }
export function funktionProzent(m, x, n = null) {
  /* An einer gedruckten Stuetzstelle gilt der gedruckte Tabellenwert („Zwischenwerte" nach der Funktion):
     die Funktion trifft die Tabelle sonst nur bis auf die Rundung ihrer Koeffizienten (±0,1 %). */
  const gleich = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-9;
  if (n == null && m.stuetzstellen && Array.isArray(m.stuetzstellen.x)) {
    const i = m.stuetzstellen.x.findIndex((s) => gleich(s, x));
    if (i >= 0 && m.stuetzstellen.prozent[i] != null) return Number(m.stuetzstellen.prozent[i]);
  }
  if (n != null && m.tabelle && Array.isArray(m.tabelle.zeilen_norm)) {
    const i = m.tabelle.zeilen_norm.findIndex((s) => gleich(s, n)), j = (m.tabelle.spalten_objekt || []).findIndex((s) => gleich(s, x));
    if (i >= 0 && j >= 0 && (m.tabelle.werte_prozent[i] || [])[j] != null) return Number(m.tabelle.werte_prozent[i][j]);
  }
  let p = formelWert(m.formel, n == null ? { x } : { x, n });
  if (!Number.isFinite(p)) return null;
  if (m.prozent_runden != null) p = Math.round((p + Math.sign(p) * 1e-9) * 10 ** m.prozent_runden) / 10 ** m.prozent_runden;
  return p;
}

/* ══ v3015 · BEDINGUNG ZWISCHEN MERKMALEN (Hagen, Bottrop) ════════════════════
   m.bedingung = [{ wenn: { baujahr_von, baujahr_bis, alter_von, alter_bis }, setze | nur | nicht, wortlaut }]
     setze  der Ausschuss gibt die Kategorie vor („fuer juengere Gebaeude wird eine mittlere
            Modernisierung unterstellt") — die Angabe des Objekts wird ersetzt
     nur    nur diese Kategorien sind zulaessig; eine andere → kein Wert (ausserhalb)
     nicht  diese Kategorien sind ausgeschlossen
   Alter = Stichtagsjahr des Satzes − Baujahr (tatsaechliches Alter, wie im Dokument).
   Fehlt das Baujahr, das die Bedingung braucht → kein Wert (merkmal_fehlt). */
function bedingungPruefen(m, objekt, ctx) {
  const regeln = Array.isArray(m.bedingung) ? m.bedingung : [];
  const greifen = [];
  for (const r of regeln) {
    const w = r.wenn || {};
    const brauchtBj = ['baujahr_von', 'baujahr_bis', 'alter_von', 'alter_bis'].some((k) => w[k] != null);
    if (!brauchtBj) { greifen.push(r); continue; }
    const bj = num(objekt && objekt.baujahr);
    if (bj == null) return { fehlt: true };
    const alter = ctx.jahr ? Number(ctx.jahr) - bj : null;
    if (w.baujahr_von != null && bj < w.baujahr_von) continue;
    if (w.baujahr_bis != null && bj > w.baujahr_bis) continue;
    if ((w.alter_von != null || w.alter_bis != null) && alter == null) return { fehlt: true };
    if (w.alter_von != null && alter < w.alter_von) continue;
    if (w.alter_bis != null && alter > w.alter_bis) continue;
    greifen.push(r);
  }
  return { greifen };
}

/* Normwert des Merkmals: aus der Zone (Feld des IRW), sonst aus dem Satz. */
function normWert(m, roh, satzNorm) {
  if (m.norm_feld && roh && !leer(roh[m.norm_feld])) {
    const v = String(roh[m.norm_feld]).trim();
    return { wert: aufSchluessel(m, v, true), herkunft: 'zone', roh: v };
  }
  const n = m.norm != null ? m.norm : (satzNorm || {})[m.id];
  return n == null ? null : { wert: aufSchluessel(m, n, true), herkunft: 'satz', roh: n };
}

/**
 * Ein Merkmal: Faktor Objekt gegen Norm.
 * @returns {{ok:true, uk, objekt, norm, text}} | {{ok:false, grund, text}}
 */
export function merkmalFaktor(m, objekt, roh, satzNorm, ctx = {}) {
  const name = m.name || m.id;
  ctx = { ...ctx, roh: roh || ctx.roh || null };
  /* v3015 · Tabelle je Gemeindegruppe (Guetersloh): die Gruppe kommt aus der Gemeinde der
     Zone (BORIS-Feld GENA) oder der Angabe zum Objekt; ohne Gruppe kein Wert. */
  if (Array.isArray(m.gruppen)) {
    const feld = m.gruppe_feld || 'GENA';
    const gem = (roh && !leer(roh[feld])) ? String(roh[feld]).trim() : (objekt && !leer(objekt.gemeinde) ? String(objekt.gemeinde).trim() : null);
    if (!gem) return { ok: false, grund: 'norm_unbekannt', text: `${name}: die Tabelle hängt von der Gemeinde ab — Gemeinde der Zone unbekannt` };
    const g = m.gruppen.find((x) => (x.gemeinden || []).some((n) => n.toLowerCase() === gem.toLowerCase()));
    if (!g) return { ok: false, grund: 'ausserhalb', text: `${name}: die Gemeinde „${gem}" gehört zu keiner Gemeindegruppe des Ausschusses` };
    const { gruppen, gruppe_feld, gruppe_art, ...rest } = m;
    const { gemeinden, name: gName, ...tab } = g;
    const r = merkmalFaktor({ ...rest, ...tab, art: gruppe_art || 'klassen' }, objekt, roh, satzNorm, ctx);
    if (r.text) r.text = r.text.replace(name + ':', `${name} (Tabelle ${gName || gemeinden.join(', ')}):`);
    return r;
  }
  if (m.art === 'stichtag') {
    return { ok: true, uk: 1, objekt: 'Stichtag des Richtwerts', norm: m.norm != null ? String(m.norm) : 'Richtwertstichtag',
      text: `${name}: Wertermittlungsstichtag gleich Richtwertstichtag — keine Zeitanpassung` };
  }
  /* v2680 · Geltungsgrenze eines Merkmals (Hochsauerlandkreis: Modernisierungstyp „nur für die
     Baujahre bis 1985 geeignet", darueber sachverstaendig): ausserhalb kein Wert, nie still 1,000. */
  if (m.gilt_nur && (m.gilt_nur.baujahr_bis != null || m.gilt_nur.baujahr_von != null)) {
    const bj = num(objekt && objekt.baujahr);
    if (bj == null) return { ok: false, grund: 'merkmal_fehlt', text: name + ': gilt nur für bestimmte Baujahre — Baujahr fehlt' };
    const gv = m.gilt_nur.baujahr_von, gb = m.gilt_nur.baujahr_bis;
    if ((gb != null && bj > gb) || (gv != null && bj < gv)) {
      return { ok: false, grund: 'ausserhalb', text: name + ': der Ausschuss wendet diese Umrechnung nur für Baujahre '
        + (gv != null ? 'ab ' + gv + ' ' : '') + (gb != null ? 'bis ' + gb : '') + ' an; darüber hinaus ist sachverständig anzupassen' };
    }
  }
  const nw = normWert(m, roh, satzNorm);
  if (!nw) return { ok: false, grund: 'norm_unbekannt', text: `${name}: das Normobjekt der Zone führt dieses Merkmal nicht` };
  let ov0 = objektWert(m, objekt, ctx);
  /* v3015 · Bedingung zwischen Merkmalen */
  let bedText = '';
  if (Array.isArray(m.bedingung) && m.bedingung.length) {
    const b = bedingungPruefen(m, objekt, ctx);
    if (b.fehlt) return { ok: false, grund: 'merkmal_fehlt', text: `${name}: die Vorgabe des Ausschusses hängt vom Baujahr ab — Angabe zum Objekt fehlt (${EINGABEN.baujahr})` };
    for (const r of b.greifen) {
      if (r.setze != null) { ov0 = r.setze; bedText = ` (Vorgabe des Ausschusses: ${r.kurz || r.wortlaut || r.setze})`; }
    }
    if (ov0 != null && ov0 !== '__grenze__') {
      const key = String(aufSchluessel(m, ov0)).toLowerCase();
      for (const r of b.greifen) {
        const nur = (r.nur || []).map((x) => String(x).toLowerCase()), nicht = (r.nicht || []).map((x) => String(x).toLowerCase());
        if ((nur.length && !nur.includes(key)) || nicht.includes(key)) {
          return { ok: false, grund: 'ausserhalb', text: `${name}: „${aufSchluessel(m, ov0)}" ist für dieses Objekt nach dem Modell des Ausschusses nicht zulässig (${r.kurz || r.wortlaut || 'Bedingung'})` };
        }
      }
    }
  }
  if (ov0 == null) {
    const k0 = Array.isArray(m.eingabe) ? m.eingabe[m.eingabe.length - 1] : m.eingabe;
    return { ok: false, grund: 'merkmal_fehlt', text: `${name}: Angabe zum Objekt fehlt (${EINGABEN[k0] || k0})` };
  }
  if (ov0 === '__grenze__') {
    return { ok: false, grund: 'grenze', text: `${name}: die Modernisierungspunkte liegen zwischen zwei Stufen des Ausschusses — sachverständig zuzuordnen` };
  }
  const ov = aufSchluessel(m, ov0);

  if (m.art === 'matrix_linear') {
    const xo = num(ov), xn = num(nw.wert);
    if (xo == null) return { ok: false, grund: 'merkmal_fehlt', text: `${name}: „${ov0}" ist keine Zahl` };
    if (xn == null) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" ist keine Zahl (Spanne?) — nicht eindeutig` };
    const r = matrixLinearBei(m, xn, xo);
    const zs = m.zeilen_norm, sp = m.spalten_objekt;
    const rand = (a) => `${Math.min(a[0], a[a.length - 1])}–${Math.max(a[0], a[a.length - 1])}`;
    if (r.aus === 'norm') return { ok: false, grund: 'norm_unbekannt', text: `${name}: das Normobjekt der Zone (${xn}) liegt außerhalb der Tabelle des Ausschusses (${rand(zs)})` };
    if (r.aus === 'objekt') return { ok: false, grund: 'ausserhalb', text: `${name}: ${xo} liegt außerhalb der Tabelle des Ausschusses (${rand(sp)}); eine Fortschreibung darüber hinaus ist nicht zulässig` };
    if (r.aus === 'zwischen') return { ok: false, grund: 'ausserhalb', text: `${name}: ${xo} gegen Norm ${xn} liegt zwischen den Tabellenwerten, und der Ausschuss sieht keine Interpolation vor` };
    if (r.aus === 'zweifel') return { ok: false, grund: 'zweifel', text: `${name}: der amtliche Tabellenwert (Richtwert ${r.zweifel.zeile}, Objekt ${r.zweifel.spalte}) ist offensichtlich fehlerhaft gedruckt — Rückfrage beim Ausschuss` };
    if (r.aus) return { ok: false, grund: 'ausserhalb', text: `${name}: für ${xo} gegen Norm ${xn} veröffentlicht der Ausschuss keinen Koeffizienten` };
    const iv = r.interpoliert ? `; ${m.interpolation_text || 'lineare Interpolation (DealPilot), Tabelle des Ausschusses ohne eigene Regel'}` : '';
    const ug = r.ungesichert ? `; ${m.ungesichert.text || 'vom Ausschuss als nicht gesichert gekennzeichnet (geringe Anzahl von Kauffällen)'}` : '';
    return { ok: true, uk: r.uk, objekt: String(xo), norm: String(xn), ungesichert: r.ungesichert || undefined,
      text: `${name}: Objekt ${xo} gegen Norm ${xn} → ${de(r.uk)}${iv}${ug}` };
  }

  /* v3015 · Matrix mit Klassen (Zeilen = Richtwert, Spalten = Objekt), siehe indexInListe */
  if (m.art === 'matrix_klassen') {
    const zi = indexInListe(m.zeilen_norm || [], nw.wert), si = indexInListe(m.spalten_objekt || [], ov);
    if (si.grenze) return { ok: false, grund: 'grenze', text: `${name}: ${ov0} liegt auf der Grenze zweier Klassen (${si.grenze.join(' / ')}) — sachverständig zuzuordnen` };
    if (zi.i < 0) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" ist keiner Zeile der Tabelle zuzuordnen` };
    if (si.i < 0) return { ok: false, grund: 'ausserhalb', text: `${name}: „${ov0}" ist in der Tabelle des Ausschusses nicht geführt` };
    const zk = m.zeilen_norm[zi.i], sk = m.spalten_objekt[si.i];
    const zw = (m.zweifel || []).find((q) => q && q.zeile === zk && q.spalte === sk);
    if (zw) return { ok: false, grund: 'zweifel', text: `${name}: der amtliche Tabellenwert (Richtwert ${zk}, Objekt ${sk}) ist offensichtlich fehlerhaft gedruckt — Rückfrage beim Ausschuss` };
    const uk = (m.werte[zi.i] || [])[si.i];
    if (uk == null) return { ok: false, grund: 'ausserhalb', text: `${name}: kein Koeffizient für Objekt ${sk} gegen Richtwert ${zk}` };
    return { ok: true, uk: Number(uk), objekt: String(sk), norm: String(zk),
      text: `${name}: ${sk} gegen Richtwert ${zk} → ${de(uk)}${bedText}` };
  }

  /* v3015 · Interpolationsfunktion des Ausschusses (Prozent), ein- oder zweidimensional */
  if (m.art === 'funktion') {
    const xo = num(ov), xn = num(nw.wert);
    if (xo == null) return { ok: false, grund: 'merkmal_fehlt', text: `${name}: „${ov0}" ist keine Zahl` };
    if (xn == null) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" ist keine Zahl — nicht eindeutig` };
    const bo = m.bereich_objekt || null, bn = m.bereich_norm || bo;
    const rand = (b) => `${b.von ?? '…'}–${b.bis ?? '…'}`;
    if (!imBereich(bo, xo)) return { ok: false, grund: 'ausserhalb', text: `${name}: ${xo} liegt außerhalb der Tabelle des Ausschusses (${rand(bo)}); eine Fortschreibung darüber hinaus ist nicht zulässig` };
    if (!imBereich(bn, xn)) return { ok: false, grund: 'norm_unbekannt', text: `${name}: das Normobjekt der Zone (${xn}) liegt außerhalb der Tabelle des Ausschusses (${rand(bn)})` };
    const kl = m.klemme_objekt || {};
    const xr = kl.unter != null && xo < kl.unter ? kl.unter : (kl.ueber != null && xo > kl.ueber ? kl.ueber : xo);
    const klText = xr !== xo ? ` (Tabellenklasse ${kl.unter != null && xo < kl.unter ? 'bis ' + kl.unter : 'ab ' + kl.ueber})` : '';
    const ft = m.funktion_text || 'Interpolationsfunktion des Ausschusses';
    try {
      if (m.zweidimensional) {
        const p = funktionProzent(m, xr, xn);
        if (p == null) return { ok: false, grund: 'ausserhalb', text: `${name}: die Funktion des Ausschusses ist hier nicht definiert` };
        return { ok: true, uk: 1 + p / 100, objekt: String(xo), norm: String(xn), prozent: p,
          text: `${name}: Objekt ${xo}${klText} gegen Richtwert ${xn} → ${de(p, 1)} % (${ft})` };
      }
      const po = funktionProzent(m, xr), pn = funktionProzent(m, xn);
      if (po == null || pn == null) return { ok: false, grund: 'ausserhalb', text: `${name}: die Funktion des Ausschusses ist hier nicht definiert` };
      return { ok: true, uk: (1 + po / 100) / (1 + pn / 100), uk_objekt: 1 + po / 100, uk_norm: 1 + pn / 100, objekt: String(xo), norm: String(xn),
        text: `${name}: ${xo}${klText} → ${de(po, 1)} %` + (pn ? ` (Norm ${xn}: ${de(pn, 1)} %)` : ` (Norm ${xn})`) + ` (${ft})` };
    } catch (e) {
      return { ok: false, grund: 'form', text: `${name}: Funktion nicht lesbar (${e.message})` };
    }
  }

  if (m.art === 'matrix') {
    const ks = m.kategorien.map((k) => String(k).toLowerCase());
    /* v2680 · Matrix mit Zahlenklassen (Kreis Steinfurt: Baujahr, Wohnflaeche, Grundstueck,
       Lagewert als Klassen „Bewertungsobjekt × Richtwertobjekt"): eine Zahl wird ueber
       m.klassen auf den Kategorienamen gebracht. Liegt sie in zwei Klassen → Grenze, in
       keiner → ausserhalb. Ein Kategoriename gilt unmittelbar. */
    const aufKat = (v) => {
      if (ks.includes(String(v).toLowerCase()) || !Array.isArray(m.klassen)) return { kat: v };
      const x = num(v);
      if (x == null) return { kat: v };
      const t = m.klassen.filter((k) => (k.von == null || x >= k.von) && (k.bis == null || x <= k.bis));
      if (t.length > 1) return { grenze: t.map((k) => k.name) };
      return t.length ? { kat: t[0].name } : { kat: null };
    };
    const ko = aufKat(ov), kn = aufKat(nw.wert);
    if (ko.grenze) return { ok: false, grund: 'grenze', text: `${name}: ${ov0} liegt auf der Grenze zweier Klassen (${ko.grenze.join(' / ')}) — sachverständig zuzuordnen` };
    if (kn.grenze) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" liegt auf einer Klassengrenze` };
    const i = ko.kat == null ? -1 : ks.indexOf(String(ko.kat).toLowerCase()), j = kn.kat == null ? -1 : ks.indexOf(String(kn.kat).toLowerCase());
    if (i < 0) return { ok: false, grund: 'ausserhalb', text: `${name}: „${ov0}" ist in der Tabelle des Ausschusses nicht geführt` };
    if (j < 0) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" ist der Tabelle nicht zuzuordnen` };
    /* v3015 · Zellen, die der Ausschuss offensichtlich fehlerhaft gedruckt hat (Kreis Unna, Keller RH:
       Zeile „vorhanden" vertauscht) → kein Wert mit Rueckfrage, nie still korrigiert. */
    const zwz = (m.zweifel_zellen || []).find((z) => String(z.objekt).toLowerCase() === ks[i] && String(z.norm).toLowerCase() === ks[j]);
    if (zwz) return { ok: false, grund: 'zweifel', text: `${name}: der amtliche Koeffizient für ${m.kategorien[i]} gegen Norm ${m.kategorien[j]} ist offensichtlich fehlerhaft gedruckt (${zwz.grund || 'Rückfrage beim Ausschuss'})` };
    const uk = (m.werte[i] || [])[j];
    if (uk == null) return { ok: false, grund: 'ausserhalb', text: `${name}: kein Koeffizient für ${m.kategorien[i]} gegen ${m.kategorien[j]}` };
    return { ok: true, uk: Number(uk), objekt: m.kategorien[i], norm: m.kategorien[j],
      text: `${name}: ${m.kategorien[i]} gegen Norm ${m.kategorien[j]} → ${de(uk)}${bedText}` };
  }

  let ukO, ukN, oTxt, nTxt;
  if (m.art === 'klassen') {
    const o = klasseFuer(m, ov), n = klasseFuer(m, nw.wert);
    if (o && o.grenze) return { ok: false, grund: 'grenze', text: `${name}: ${ov0} liegt auf der Grenze zweier Klassen (${o.treffer.map((k) => k.name).join(' / ')}) — sachverständig zuzuordnen` };
    if (!o) return { ok: false, grund: 'ausserhalb', text: `${name}: ${ov0} liegt außerhalb der Klassen des Ausschusses` };
    if (!n || n.grenze) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" ist keiner Klasse zuzuordnen` };
    if (o.klasse.uk == null || n.klasse.uk == null) return { ok: false, grund: 'ausserhalb', text: `${name}: für diese Klasse veröffentlicht der Ausschuss keinen Koeffizienten` };
    ukO = Number(o.klasse.uk); ukN = Number(n.klasse.uk); oTxt = o.klasse.name; nTxt = n.klasse.name;
  } else if (m.art === 'kategorien') {
    const w = m.werte || {};
    const key = Object.keys(w).find((k) => k.toLowerCase() === String(ov).toLowerCase());
    const nkey = Object.keys(w).find((k) => k.toLowerCase() === String(nw.wert).toLowerCase());
    if (key == null) return { ok: false, grund: 'ausserhalb', text: `${name}: „${ov0}" ist in der Tabelle des Ausschusses nicht geführt` };
    if (nkey == null) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" ist der Tabelle nicht zuzuordnen` };
    if (w[key] == null || w[nkey] == null) return { ok: false, grund: 'ausserhalb', text: `${name}: kein Koeffizient veröffentlicht` };
    ukO = Number(w[key]); ukN = Number(w[nkey]); oTxt = key; nTxt = nkey;
  } else if (m.art === 'kurve') {
    const xo = num(ov), xn = num(nw.wert);
    if (xo == null) return { ok: false, grund: 'merkmal_fehlt', text: `${name}: „${ov0}" ist keine Zahl` };
    if (xn == null) return { ok: false, grund: 'norm_unbekannt', text: `${name}: Normmerkmal „${nw.roh}" ist keine Zahl (Spanne?) — nicht eindeutig` };
    const a = kurveBei(m, xo), b = kurveBei(m, xn);
    if (a && a.zweifel != null) return { ok: false, grund: 'zweifel', text: `${name}: der amtliche Tabellenwert bei ${a.zweifel} ist offensichtlich fehlerhaft gedruckt — Rückfrage beim Ausschuss` };
    if (b && b.zweifel != null) return { ok: false, grund: 'zweifel', text: `${name}: der amtliche Tabellenwert am Normobjekt (${b.zweifel}) ist offensichtlich fehlerhaft gedruckt` };
    if (!a) return { ok: false, grund: 'ausserhalb', text: `${name}: ${xo} liegt außerhalb der Tabelle des Ausschusses (${m.x[0]}–${m.x[m.x.length - 1]}); eine Fortschreibung darüber hinaus ist nicht zulässig` };
    if (!b) return { ok: false, grund: 'norm_unbekannt', text: `${name}: das Normobjekt der Zone (${xn}) liegt außerhalb der veröffentlichten Tabelle (${m.x[0]}–${m.x[m.x.length - 1]})` };
    ukO = a.uk; ukN = b.uk; oTxt = String(xo); nTxt = String(xn);
  } else {
    return { ok: false, grund: 'form', text: `${name}: unbekannte Form ${m.art}` };
  }
  const uk = ukO / ukN;
  return { ok: true, uk, uk_objekt: ukO, uk_norm: ukN, objekt: oTxt, norm: nTxt,
    text: (ukN === 1 ? `${name}: ${oTxt} (Norm ${nTxt}) → ${de(ukO)}`
      : `${name}: ${oTxt} gegen Norm ${nTxt} → ${de(ukO)} / ${de(ukN)} = ${de(uk, 4)}`) + bedText };
}

/** Nur die Umrechnung (ohne Flaeche), fuer Pruefer und Rechner. */
export function umrechnen(satz, irwWert, objekt, roh = null) {
  const f = satz.formel || {};
  const faktoren = [], fehler = [];
  const ctx = { jahr: Number(satz.jahrgang) || null, roh };
  for (const m of f.merkmale || []) {
    const r = merkmalFaktor(m, objekt, roh, f.normobjekt, ctx);
    /* v2660 · `eingabe` und `name` reisen mit: der Bericht nennt, WELCHE Angabe fehlt und wo sie einzutragen ist */
    if (!r.ok) { fehler.push({ id: m.id, name: m.name || m.id, eingabe: m.eingabe, grund: r.grund, text: r.text }); continue; }
    faktoren.push({ id: m.id, name: m.name || m.id, art: m.art, objekt: r.objekt, norm: r.norm, uk: r.uk, uk_objekt: r.uk_objekt, uk_norm: r.uk_norm, text: r.text });
  }
  /* v3015 · Zuschlaege in €/m² nach der Multiplikation (Bergisch Gladbach: „Summe =
     vorlaeufiger Vergleichswert"): Betrag × (Objekt − Richtwertobjekt), nur innerhalb von/bis. */
  const zuschlaege = [];
  for (const z of f.zuschlaege_eur_qm || []) {
    const name = z.name || z.id;
    const xo = num(eingabeWert(z.eingabe, z, objekt, ctx));
    const nw = normWert(z, roh, f.normobjekt);
    const xn = nw ? num(nw.wert) : null;
    if (xo == null) { fehler.push({ id: z.id, name, eingabe: z.eingabe, grund: 'merkmal_fehlt', text: `${name}: Angabe zum Objekt fehlt (${EINGABEN[z.eingabe] || z.eingabe})` }); continue; }
    if (xn == null) { fehler.push({ id: z.id, name, eingabe: z.eingabe, grund: 'norm_unbekannt', text: `${name}: das Normobjekt der Zone führt dieses Merkmal nicht als Zahl` }); continue; }
    if ((z.von != null && xo < z.von) || (z.bis != null && xo > z.bis)) { fehler.push({ id: z.id, name, eingabe: z.eingabe, grund: 'ausserhalb', text: `${name}: ${xo} liegt außerhalb des Geltungsbereichs des Ausschusses (${z.von ?? '…'}–${z.bis ?? '…'})` }); continue; }
    const eurQm = Number(z.eur_je_einheit) * (xo - xn);
    zuschlaege.push({ id: z.id, name, objekt: xo, norm: xn, eur_qm: eurQm,
      text: `${name}: ${de(Number(z.eur_je_einheit), 2)} €/m² × (${xo} − ${xn}) = ${de(eurQm, 2)} €/m²` });
  }
  if (fehler.length) return { ok: false, fehler };
  /* v3015 · Verknuepfung nach dem Dokument des Ausschusses.
     multiplikativ  IRW × Π UKᵢ
     additiv        IRW × (1 + Σ (UKᵢ − 1)) — „Ausgehend vom Normobjekt … addiert bzw. subtrahiert"
                    (Borken, Warendorf, Dortmund u. a.). Liegt das Normobjekt der Zone nicht auf dem
                    Normobjekt der Tabelle (UK(Norm) ≠ 1), wird dieselbe Formel auf Objekt und
                    Zonennorm angewandt und ins Verhaeltnis gesetzt:
                    IRW × (1 + Σ (UKᵢ(Objekt) − 1)) / (1 + Σ (UKᵢ(Norm) − 1)).
                    Bei UK(Norm) = 1 ist das genau die Formel des Dokuments.
                    Matrizen (Richtwert × Objekt) sind schon auf die Zone bezogen: Beitrag UK − 1. */
  const verk = f.verknuepfung || 'multiplikativ';
  let prod, summeObjekt = null, summeNorm = null;
  let prodRoh = null;
  if (verk === 'multiplikativ') {
    prod = faktoren.reduce((a, x) => a * x.uk, 1);
    /* v3015 · Rundung des Gesamtfaktors, wo das Dokument sie vorgibt (Rhein-Erft, Euskirchen, Kreis Dueren:
       „Die Multiplikation der Umrechnungskoeffizienten ergibt einen Faktor von 1,17“, dann IRW × 1,17). */
    if (f.rundung_produkt != null) { prodRoh = prod; prod = Math.round(prod * 10 ** f.rundung_produkt) / 10 ** f.rundung_produkt; }
  }
  else if (verk === 'additiv') {
    summeObjekt = 0; summeNorm = 0;
    for (const x of faktoren) {
      if (x.uk_objekt != null && x.uk_norm != null) { summeObjekt += x.uk_objekt - 1; summeNorm += x.uk_norm - 1; x.zuschlag = x.uk_objekt - 1; x.zuschlag_norm = x.uk_norm - 1; }
      else { summeObjekt += x.uk - 1; x.zuschlag = x.uk - 1; x.zuschlag_norm = 0; }
    }
    prod = (1 + summeObjekt) / (1 + summeNorm);
  } else {
    return { ok: false, fehler: [{ id: '*', grund: 'form', text: `Verknüpfung „${verk}" ist nicht umgesetzt` }] };
  }
  let wert = irwWert * prod;
  const summeEur = zuschlaege.reduce((a, z) => a + z.eur_qm, 0);
  wert += summeEur;
  let gerundet = null;
  if (f.rundung_eur_qm) { gerundet = Math.round(wert / f.rundung_eur_qm) * f.rundung_eur_qm; }
  return { ok: true, faktoren, produkt: prod, produkt_ungerundet: prodRoh, verknuepfung: verk, summe_objekt: summeObjekt, summe_norm: summeNorm,
    zuschlaege, summe_zuschlaege_eur_qm: summeEur, wert_qm_ungerundet: wert, wert_qm: gerundet != null ? gerundet : wert };
}

const GRUND_TEXT = {
  merkmal_fehlt: 'Für die Umrechnung fehlen Angaben zum Objekt',
  ausserhalb: 'Das Objekt liegt außerhalb der Umrechnungstabellen des Gutachterausschusses',
  norm_unbekannt: 'Das Normobjekt dieser Richtwertzone ist mit den veröffentlichten Tabellen nicht abzubilden',
  grenze: 'Ein Merkmal liegt auf einer Klassengrenze',
  zweifel: 'Ein amtlicher Tabellenwert ist offensichtlich fehlerhaft gedruckt',
  form: 'Die Umrechnungsvorschrift ist nicht umgesetzt',
};

/**
 * Vergleichswert aus dem Immobilienrichtwert.
 * @param {object} p
 * @param {object} p.irw     IrwConnector.hole()-Ergebnis (verfuegbar, wert_qm, gasl, teilmarkt_code, roh, …)
 * @param {object} p.objekt  kanonische Merkmale (EINGABEN)
 * @param {Array}  [p.bog]   [{ pos, eur }] — besondere objektspezifische Grundstücksmerkmale
 * @param {Array}  [p.saetze] Registersätze (sonst Ordner)
 */
export function vergleichswertIrw({ irw, objekt = {}, bog = [], saetze = null, ersatz_teilmarkt = false }) {
  if (!irw || !irw.verfuegbar || !(Number(irw.wert_qm) > 0)) {
    return { verfuegbar: false, grund: 'kein_irw',
      hinweis: (irw && irw.hinweis) || 'An dieser Stelle liegt kein Immobilienrichtwert vor.' };
  }
  const roh = irw.roh || {};
  const gasl = irw.gasl || roh.GASL;
  const tm = Number(irw.teilmarkt_code || roh.TEILMA);
  const jahr = irw.stichtag ? Number(String(irw.stichtag).slice(-4)) : null;
  const udok = irw.umrechnungsvorschrift_url || roh.UDOK_URL || null;
  const weg = udok ? { url: udok, text: 'Umrechnungsvorschrift des Gutachterausschusses (Örtliche Fachinformationen, BORIS-NRW)' } : null;

  const satz = satzFuer({ gasl, teilmarkt: tm, jahrgang: jahr, saetze });
  if (!satz) {
    return { verfuegbar: false, grund: 'kein_satz', weg,
      hinweis: `Für den Immobilienrichtwert liegen die Umrechnungskoeffizienten des Gutachterausschusses `
        + `(${irw.gutachterausschuss || 'Ausschuss ' + gasl}, Teilmarkt ${TEILMAERKTE[tm] || tm}, Jahrgang ${jahr || '?'}) `
        + 'noch nicht im Register. Ohne sie wird nicht umgerechnet — der Richtwert bleibt Orientierung.' };
  }
  if (satz.vollstaendig === false || satz.warum_kein_wert || !satz.formel) {
    return { verfuegbar: false, grund: 'sperre', weg: weg || (satz.quelle_url ? { url: satz.quelle_url, text: 'Quelle' } : null),
      hinweis: satz.warum_kein_wert || 'Die Umrechnung dieses Ausschusses ist gesperrt.' };
  }
  /* v2660 · Ersatz-Teilmarkt: ein Doppel- oder Reihenhaus mit dem Richtwert der Ein- und
     Zweifamilienhaeuser (Kreis Herford fuehrt keinen eigenen Teilmarkt 3) nur, wenn DESSEN
     Umrechnung die Anbauweise fuehrt - sonst wuerde das Haus still wie ein freistehendes gerechnet. */
  if (ersatz_teilmarkt && !((satz.formel.merkmale || []).some((m) => [].concat(m.eingabe || []).includes('anbauweise')))) {
    return { verfuegbar: false, grund: 'teilmarkt', weg,
      hinweis: 'An dieser Stelle führt der Gutachterausschuss keinen Immobilienrichtwert für Doppel- und Reihenhäuser, '
        + 'und seine Umrechnung für Ein- und Zweifamilienhäuser kennt die Anbauweise nicht. Ein Vergleichswert wird deshalb nicht ausgewiesen.' };
  }

  const u = umrechnen(satz, Number(irw.wert_qm), objekt, roh);
  if (!u.ok) {
    const g = u.fehler[0].grund;
    return { verfuegbar: false, grund: g, fehlt: u.fehler.filter((x) => x.grund === 'merkmal_fehlt').map((x) => x.id),
      gruende: u.fehler, weg, ausschuss: satz.gaa_name || null,
      hinweis: `${GRUND_TEXT[g] || 'Keine Umrechnung möglich'}: ${u.fehler.map((x) => x.text).join(' · ')}. `
        + 'Ein Vergleichswert wird deshalb nicht ausgewiesen; der Immobilienrichtwert bleibt Orientierung.' };
  }

  const wfl = num(objekt.wohnflaeche);
  if (!(wfl > 0)) return { verfuegbar: false, grund: 'merkmal_fehlt', fehlt: ['wohnflaeche'], weg, hinweis: 'Ohne Wohnfläche kein Vergleichswert.' };

  const f = satz.formel;
  const wertQm = u.wert_qm;
  const vorl = wertQm * wfl;
  const rechenweg = [{ pos: 'Immobilienrichtwert der Zone', detail: `${irw.zonennummer ? 'Zone ' + irw.zonennummer + ', ' : ''}Stichtag ${irw.stichtag || '?'}`, wert: Number(irw.wert_qm), einheit: '€/m²' }];
  if (u.verknuepfung === 'additiv') {
    /* v3015 · additiv: jede Zeile ist ein Zu-/Abschlag in Prozent des Richtwerts */
    for (const x of u.faktoren) {
      const p = (x.zuschlag - (x.zuschlag_norm || 0)) * 100;
      rechenweg.push({ pos: `${p < 0 ? '−' : '+'} ${x.name}`, detail: x.text + (x.zuschlag_norm ? ` (Zonennorm ${de(x.zuschlag_norm * 100, 1)} %)` : ''), zuschlag_prozent: Math.round(p * 10) / 10 });
    }
    const nTxt = u.summe_norm ? ` / (1 ${u.summe_norm < 0 ? '−' : '+'} ${de(Math.abs(u.summe_norm), 3)} Zonennorm)` : '';
    rechenweg.push({ pos: '= angepasster Richtwert', detail: `additive Verknüpfung nach dem Ausschuss: Richtwert × (1 ${u.summe_objekt < 0 ? '−' : '+'} ${de(Math.abs(u.summe_objekt), 3)})${nTxt} = × ${de(u.produkt, 4)}`, wert: Math.round((Number(irw.wert_qm) * u.produkt) * 100) / 100, einheit: '€/m²' });
  } else {
    for (const x of u.faktoren) rechenweg.push({ pos: `× ${x.name}`, detail: x.text, faktor: r3(x.uk) });
    rechenweg.push({ pos: u.zuschlaege.length ? '= Richtwert nach Koeffizienten' : '= angepasster Richtwert', detail: u.produkt_ungerundet != null ? `Produkt der Koeffizienten ${de(u.produkt_ungerundet, 4)}, gerundet auf ${de(u.produkt, f.rundung_produkt)} wie im Anwendungsbeispiel des Ausschusses` : `Produkt der Koeffizienten ${de(u.produkt, 4)}`, wert: Math.round((Number(irw.wert_qm) * u.produkt) * 100) / 100, einheit: '€/m²' });
  }
  for (const z of u.zuschlaege) rechenweg.push({ pos: `${z.eur_qm < 0 ? '−' : '+'} ${z.name}`, detail: z.text, wert: Math.round(z.eur_qm * 100) / 100, einheit: '€/m²' });
  if (u.zuschlaege.length) rechenweg.push({ pos: '= angepasster Richtwert', detail: 'Summe nach dem Modell des Ausschusses', wert: Math.round(u.wert_qm_ungerundet * 100) / 100, einheit: '€/m²' });
  if (f.rundung_eur_qm && u.wert_qm !== u.wert_qm_ungerundet) rechenweg.push({ pos: '= gerundet', detail: `auf ${f.rundung_eur_qm} €/m² wie im Anwendungsbeispiel des Ausschusses`, wert: u.wert_qm, einheit: '€/m²' });
  rechenweg.push({ pos: '× Wohnfläche', detail: `${de(wfl, 2)} m²`, wert: Math.round(vorl), einheit: '€' });

  const bogListe = (Array.isArray(bog) ? bog : []).filter((b) => b && Number.isFinite(Number(b.eur)) && Number(b.eur) !== 0);
  /* ══ v2670 · GARAGE IM NORMOBJEKT, OBJEKT OHNE (Marcel 21.10.2026) ══════════
     Enthaelt das Normobjekt eine Garage/einen Stellplatz und das Objekt hat keine,
     wird abgezogen - NUR in der Hoehe, die der Ausschuss selbst angibt
     (formel.garage_normobjekt: zeitwert_eur, sonst die MITTE der Spanne
     zeitwert_eur_von/_bis, mit Seite). v2671 · Marcel 21.10.2026 „was ein
     Gutachter machen wuerde": das Normobjekt ist ein durchschnittliches Objekt,
     seine Garage also eine durchschnittliche - ohne Angaben zu Alter/Zustand die
     Mitte der Zeitwertspanne, nicht die Untergrenze (die den Wert systematisch
     zu hoch ausweist). Ein Koeffizient des Ausschusses steht als Merkmal
     in formel.merkmale und rechnet oben mit. Ohne Betrag bleibt es beim Hinweis. */
  const gn = f.stellplaetze_im_irw === true ? (f.garage_normobjekt || null) : null;
  let garage = null;
  if (gn) {
    const einzel = num(gn.zeitwert_eur), von = num(gn.zeitwert_eur_von), bis = num(gn.zeitwert_eur_bis);
    const betrag = einzel != null ? einzel : (von != null && bis != null ? Math.round((von + bis) / 2) : von);
    const spanne = einzel == null && von != null && bis != null;
    const fund = `${satz.gaa_name || 'Gutachterausschuss'}, Örtliche Fachinformationen ${satz.jahrgang}, ${gn.seite || satz.seite || ''}`.trim();
    if (objekt.garage === false && betrag > 0) {
      const detail = spanne
        ? `Mitte der Zeitwertspanne des Ausschusses (${eur(von)} bis ${eur(bis)}${gn.abhaengig ? ', ' + gn.abhaengig : ''}; ${fund})`
        : `Zeitwert nach Angabe des Ausschusses (${fund})`;
      bogListe.unshift({ pos: 'Garage des Normobjekts (Objekt ohne Garage)', eur: -betrag, detail, quelle: 'ausschuss' });
      garage = { fall: 'abzug', eur: -betrag, spanne: spanne ? [von, bis] : null, fundstelle: fund };
    } else if (objekt.garage === false) {
      garage = { fall: 'kein_betrag', fundstelle: fund };
    } else if (objekt.garage == null) {
      garage = { fall: 'angabe_fehlt', eur: betrag > 0 ? -betrag : null, fundstelle: fund };
    } else garage = { fall: 'wie_norm' };
  }
  let summeBog = 0;
  for (const b of bogListe) { summeBog += Number(b.eur); rechenweg.push({ pos: (Number(b.eur) > 0 ? '+ ' : '− ') + (b.pos || 'besonderes Merkmal'), detail: b.detail || '§ 8 Abs. 3 ImmoWertV', wert: Math.round(Number(b.eur)), einheit: '€' }); }
  const vw = vorl + summeBog;
  rechenweg.push({ pos: '= Vergleichswert', detail: bogListe.length ? 'vorläufiger Vergleichswert ± besondere objektspezifische Grundstücksmerkmale' : 'ohne besondere objektspezifische Grundstücksmerkmale', wert: Math.round(vw), einheit: '€' });

  const hinweise = [];
  if (f.stellplaetze_im_irw === false) hinweise.push('Stellplätze und Garagen sind im Immobilienrichtwert nicht enthalten; sie sind getrennt als besonderes objektspezifisches Merkmal anzusetzen.');
  if (f.stellplaetze_im_irw === true) {
    if (garage && garage.fall === 'abzug') {
      hinweise.push('Das Normobjekt enthält eine Garage, das Objekt hat keine: abgezogen sind ' + eur(-garage.eur)
        + (garage.spanne ? ' — die Mitte der vom Ausschuss angegebenen Zeitwertspanne (' + eur(garage.spanne[0]) + ' bis ' + eur(garage.spanne[1]) + '); je nach Größe, Alter und Ausstattung der Garage liegt der Abzug zwischen ' + eur(garage.spanne[0]) + ' und ' + eur(garage.spanne[1]) : '')
        + ' (' + garage.fundstelle + ').');
    } else if (garage && garage.fall === 'kein_betrag') {
      hinweise.push('Das Normobjekt enthält eine Garage oder einen Stellplatz, das Objekt hat keine. Der Ausschuss nennt dafür keinen Betrag; '
        + 'der Unterschied ist mit dem Zeitwert sachverständig zu berücksichtigen und hier nicht angesetzt (' + garage.fundstelle + ').');
    } else if (garage && garage.fall === 'angabe_fehlt') {
      hinweise.push('Das Normobjekt enthält eine Garage oder einen Stellplatz; ob das Objekt eine hat, ist nicht angegeben (Garagen bzw. Stellplätze, Reiter Objekt). '
        + (garage.eur ? 'Ohne Garage wären nach Angabe des Ausschusses ' + eur(-garage.eur) + ' abzuziehen.' : 'Ein gesonderter Ansatz ist nicht vorgenommen.'));
    } else hinweise.push(f.stellplaetze_hinweis || 'Das Normobjekt enthält Garage oder Stellplatz; ein gesonderter Ansatz entfällt.');
  }
  if (irw.aus_vorjahr) hinweise.push(irw.vorjahr_hinweis);
  if (f.hinweis_ausschuss) hinweise.push(f.hinweis_ausschuss);

  const quelle = {
    ausschuss: satz.gaa_name, gasl, teilmarkt: satz.zweig, jahrgang: satz.jahrgang,
    irw_quelle: irw.quelle || 'BORIS-NRW, Immobilienrichtwerte (dl-de/zero-2-0)',
    umrechnung_url: satz.quelle_url, seite: satz.seite, lizenz: satz.lizenz, stichtag: satz.stichtag,
  };
  return {
    verfuegbar: true,
    stufe: 'A',
    verfahren: 'vergleichswert',
    basis: 'immobilienrichtwert',
    wert_qm_roh: wertQm,
    wert_qm: Math.round(wertQm),
    vorlaeufig_eur: Math.round(vorl),
    bog: bogListe,
    vergleichswert_eur: Math.round(vw),
    faktoren: u.faktoren.map((x) => ({ ...x, uk: r3(x.uk) })),
    produkt: u.produkt,
    verknuepfung: u.verknuepfung,   /* v3015: multiplikativ | additiv */
    rechenweg,
    stellplaetze_im_irw: f.stellplaetze_im_irw ?? null,
    garage_normobjekt: garage,   /* v2670: abzug | kein_betrag | angabe_fehlt | wie_norm | null */
    quelle,
    /* dl-de/zero-2-0 verlangt keine Namensnennung; genannt wird die Quelle
       trotzdem (ImmoWertA 9: Herkunft der Daten). */
    quellennachweis: `${satz.gaa_name}: Immobilienrichtwert (BORIS-NRW, Stichtag ${irw.stichtag || satz.stichtag}) und `
      + `Umrechnungskoeffizienten (Örtliche Fachinformationen ${satz.jahrgang}, ${satz.seite || ''}), ${satz.lizenz}`,
    satz_id: `${satz.gasl}/${satz.zweig}/${satz.jahrgang}`,
    hinweise,
    rechtsgrundlage: '§§ 24–26 ImmoWertV i. V. m. § 20 ImmoWertV (Vergleichsfaktor)',
  };
}

/* ══ v2660 · DIE KANONISCHEN MERKMALE AUS DEM BERICHTSOBJEKT (ref) ══════════
   Nur, was das Objekt FUEHRT - nichts wird erfunden oder vorbelegt. Was fehlt,
   bleibt leer, und der Kern meldet „merkmal_fehlt" mit dem Merkmal.
     keller        aus der Unterkellerung (keller_dg) oder dem NHK-Typ: zweite
                   Ziffer 0/1 = mit Keller, 2/3 = ohne (NHK 2010, Anlage 4)
     anbauweise    NHK-Hausform 1 freistehend · 2 Doppel-/Reihenendhaus (dann
                   die Objektart: DHH oder Reihenendhaus) · 3 Reihenmittelhaus;
                   ohne Hausform die Objektart des Reiters (EFH/ZFH = freistehend,
                   dort getrennt von DHH und RH gefuehrt)
     geschoss      Etage: 0 = Erdgeschoss (Code 88), n = n. OG; Dachgeschoss und
                   Souterrain sind aus der Etage nicht abzulesen -> leer
   Nicht abbildbar, weil der Reiter sie nicht fuehrt: Wohnlage (des Ausschusses),
   Modernisierungstyp (baujahrtypisch/teilmodernisiert/neuzeitlich), Baudenkmal. */
export const EINGABE_ORT = {
  baujahr: 'Baujahr (Reiter Objekt)',
  wohnflaeche: 'Wohnfläche (Reiter Objekt)',
  grundstuecksflaeche: 'Grundstücksfläche (Reiter Objekt)',
  bodenrichtwert: 'Bodenrichtwert (BORIS oder eigene Angabe)',
  standardstufe: 'Standardstufe (Wertermittlung, Reiter Objekt)',
  gstand: 'Standardstufe (Wertermittlung, Reiter Objekt)',
  modernisierungspunkte: 'Modernisierungsgrad (Anlage 2, Reiter Objekt)',
  mgrad: 'Modernisierungsgrad (Anlage 2, Reiter Objekt)',
  mtyp: 'Modernisierungstyp des Ausschusses (baujahrtypisch, teilmodernisiert, neuzeitlich) — im Reiter Objekt nicht erfasst',
  keller: 'Hausform und Geschosse nach NHK 2010 (Wertermittlung, Reiter Objekt)',
  anbauweise: 'Objektart (EFH, DHH, Reihenhaus) bzw. Hausform nach NHK 2010',
  gebaeudeart: 'Objektart (Reiter Objekt)',
  vermietet: 'Nutzungsart (Reiter Objekt)',
  wohnlage: 'Wohnlage nach der Einstufung des Gutachterausschusses — im Reiter Objekt nicht erfasst',
  einheiten: 'Einheiten im Gebäude (Reiter Objekt)',
  geschoss: 'Etage (Reiter Objekt)',
  geschosse: 'Etagen gesamt (Reiter Objekt)',
  erstverkauf: 'Baustatus (Wertermittlung, Reiter Objekt)',
  balkon: 'Balkonfläche (Reiter Objekt)',
  aufzug: 'Aufzug (Ausstattung, Reiter Objekt)',
  garage: 'Garagen bzw. Stellplätze (Reiter Objekt)',
  denkmalschutz: 'Baudenkmal — im Reiter Objekt nicht erfasst',
  energieklasse: 'Energieeffizienzklasse — im Reiter Objekt nicht erfasst',
  energiekennwert: 'Energiekennwert (kWh/m²a) — im Reiter Objekt nicht erfasst',
  rohertrag_qm: 'Nettokaltmiete je m² (Reiter Miete)',
  balkon_art: 'Art des Balkons/Freisitzes — im Reiter Objekt nicht erfasst',
  keller_art: 'Voll- oder Teilunterkellerung — im Reiter Objekt nicht erfasst',
  stellplatz_art: 'Art des Stellplatzes — im Reiter Objekt nicht erfasst',
  fertighaus: 'Fertighaus — im Reiter Objekt nicht erfasst',
  erbbaurecht: 'Erbbaurecht — im Reiter Objekt nicht erfasst',
  baujahr_fiktiv: 'Fiktives Baujahr nach dem Modell des Ausschusses — im Reiter Objekt nicht erfasst',
  bodenrichtwert_2022: 'Bodenrichtwert zum 01.01.2022 — im Reiter Objekt nicht erfasst',
  lagewert: 'Lagewert nach dem Modell des Ausschusses — im Reiter Objekt nicht erfasst',
  optik: 'Äußeres Erscheinungsbild — im Reiter Objekt nicht erfasst',
  wohnflaeche_je_einheit: 'Wohnfläche je Wohnung (Wohnfläche und Einheiten, Reiter Objekt)',
  verkaufsumstand: 'Verkaufsumstand (Weiterverkauf, Umwandlung, Neubau) — im Reiter Objekt nicht erfasst',
  zimmer: 'Zimmerzahl — im Reiter Objekt nicht erfasst',
  barrierefrei: 'Barrierefreiheit — im Reiter Objekt nicht erfasst',
  barrierearm: 'Barrierearmer Ausbau — im Reiter Objekt nicht erfasst',
  umwandlung: 'Umwandlung in Wohnungseigentum — im Reiter Objekt nicht erfasst',
  garagen_anzahl: 'Garagen (Reiter Objekt)',
  carport_anzahl: 'Carports — im Reiter Objekt nicht getrennt erfasst',
  garage_ort: 'Lage der Garage — im Reiter Objekt nicht erfasst',
  grundstuecksart: 'Grundstücksart (Eck-, Binnengrundstück …) — im Reiter Objekt nicht erfasst',
  balkon_nutzwert: 'Nutzwert des Balkons — im Reiter Objekt nicht erfasst',
  terrasse: 'Terrasse — im Reiter Objekt nicht erfasst',
  gewerbeanteil_klasse: 'Gewerbeanteil — im Reiter Objekt nicht erfasst',
  jahresrohertrag_qm: 'Jahresrohertrag je m² (Reiter Miete)',
  wohn_nutzflaeche: 'Wohn- und Nutzfläche (Reiter Objekt)',
  einheiten_anlage: 'Wohnungen in der Wohnanlage — im Reiter Objekt nicht erfasst',
};
export function objektAusRef(ref = {}, { bodenrichtwert = null } = {}) {
  const r = ref || {};
  const z = (v) => { if (v == null || v === '') return null; const x = Number(v); return Number.isFinite(x) ? x : null; };
  const o = {};
  const setze = (k, v) => { if (v != null && v !== '') o[k] = v; };
  const art = String(r.property_type || '').toLowerCase();
  const unter = String(r.property_subtype || '').toLowerCase();
  const istWohnung = /etw|eigentumswohnung|wohnung|whg|apartment/.test(art);
  setze('baujahr', z(r.build_year) > 0 ? z(r.build_year) : null);
  setze('wohnflaeche', z(r.living_area) > 0 ? z(r.living_area) : null);
  if (!istWohnung) setze('grundstuecksflaeche', z(r.plot_area) > 0 ? z(r.plot_area) : null);
  setze('bodenrichtwert', z(bodenrichtwert) > 0 ? z(bodenrichtwert) : null);
  const ss = z(r.standardstufe);
  setze('standardstufe', ss != null && ss >= 1 && ss <= 5 ? ss : null);
  const mp = z(r.mod_punkte);
  setze('modernisierungspunkte', mp != null && mp >= 0 && mp <= 20 ? mp : null);
  /* Keller */
  const kdg = String(r.keller_dg || '');
  const nhk = String(r.nhk_typ || '').match(/^([123])\.([0-3])\d$/);
  if (/^kg_/.test(kdg)) o.keller = true;
  else if (/^ohne_kg/.test(kdg)) o.keller = false;
  else if (nhk) o.keller = Number(nhk[2]) <= 1;
  /* Anbauweise */
  const ht = String(r.haustyp || '').toLowerCase();
  let anb = null;
  if (nhk) {
    if (nhk[1] === '1') anb = 'freistehend';
    else if (nhk[1] === '3') anb = 'reihenmittelhaus';
    else if (nhk[1] === '2') anb = unter === 'dhh' ? 'doppelhaushaelfte' : (ht === 'reh' ? 'reihenendhaus' : null);
  } else if (unter === 'dhh') anb = 'doppelhaushaelfte';
  else if (ht === 'rmh') anb = 'reihenmittelhaus';
  else if (ht === 'reh') anb = 'reihenendhaus';
  else if (unter === 'efh' || unter === 'zfh') anb = 'freistehend';
  if (!istWohnung) setze('anbauweise', anb);
  /* Gebaeudeart */
  if (!istWohnung) {
    if (unter === 'zfh' || r.zweifamilienhaus === true) o.gebaeudeart = 'zfh';
    else if (/mfh|mehrfamilien/.test(art)) o.gebaeudeart = 'mfh';
    else if (unter === 'efh' || unter === 'dhh' || unter === 'rh') o.gebaeudeart = 'efh';
  }
  /* Vermietung */
  const nu = String(r.usage_type || '').toLowerCase();
  if (/eigen/.test(nu)) o.vermietet = false;
  else if (/vermiet|kapital/.test(nu)) o.vermietet = true;
  setze('einheiten', z(r.units) > 0 ? z(r.units) : null);
  if (istWohnung) {
    const fl = z(r.floor);
    if (fl === 0) o.geschoss = 88;
    else if (fl != null && fl > 0) o.geschoss = fl;
    setze('geschosse', z(r.geschosse_gesamt) > 0 ? z(r.geschosse_gesamt) : null);
  }
  const bk = z(r.balcony_area);
  if (bk != null) o.balkon = bk > 0;
  /* Aufzug nur, wenn JA: der Bericht fuehrt `elevator` immer als Wahrheitswert (false auch
     ohne Angabe, ReportOrchestrator) - ein „nein" waere hier geraten. */
  const el = r.elevator;
  if (el === true || /^(ja|true|1)$/i.test(String(el == null ? '' : el))) o.aufzug = true;
  const ga = z(r.garages), sp = z(r.outdoor_parking);
  if ((ga || 0) + (sp || 0) > 0) o.garage = true;
  else if (ga === 0 || sp === 0) o.garage = false;
  const bs = String(r.baustatus || '').toLowerCase();
  if (/erstbezug|neubau|erstverkauf/.test(bs)) o.erstverkauf = true;
  else if (/bestand/.test(bs)) o.erstverkauf = false;
  return o;
}

/** Anwendungsbeispiel eines Satzes nachrechnen (Pruefmassstab). */
export function pruefeBeispiel(satz) {
  const b = satz.anwendungsbeispiel;
  if (!b) return null;
  /* v3015 · b.merkmale_ersatz: rechnet das amtliche Beispiel nachweislich mit einer anderen (der
     Vorjahres-)Tabelle eines Merkmals — Kreis Unna druckt im Dokument 2026 das Beispiel „Zeitpunkt
     01.01.2025" mit der Baujahrtabelle 2025 —, wird NUR fuer die Pruefung diese Tabelle eingesetzt
     (mit Quelle und ersatz_grund im Satz). Alle uebrigen Merkmale und die Rechenregel bleiben die des Satzes. */
  let s2 = satz;
  if (Array.isArray(b.merkmale_ersatz) && b.merkmale_ersatz.length) {
    const ers = new Map(b.merkmale_ersatz.map((m) => [m.id, m]));
    s2 = { ...satz, formel: { ...satz.formel, merkmale: satz.formel.merkmale.map((m) => (ers.has(m.id) ? { ...m, ...ers.get(m.id) } : m)) } };
  }
  const u = umrechnen(s2, Number(b.irw), b.objekt || {}, b.norm_zone || null);
  if (!u.ok) return { ok: false, fehler: u.fehler };
  const abw = [];
  for (const [id, soll] of Object.entries(b.faktoren || {})) {
    const ist = u.faktoren.find((x) => x.id === id);
    if (!ist) { abw.push(`${id}: nicht berechnet`); continue; }
    if (Math.abs(ist.uk - Number(soll)) > (b.toleranz_uk ?? 0.0005)) abw.push(`${id}: ${r3(ist.uk)} statt ${soll}`);
  }
  const tol = b.toleranz_eur_qm ?? 1;
  if (b.ergebnis_eur_qm != null && Math.abs(u.wert_qm - Number(b.ergebnis_eur_qm)) > tol) {
    abw.push(`€/m²: ${Math.round(u.wert_qm * 100) / 100} statt ${b.ergebnis_eur_qm} (±${tol})`);
  }
  return { ok: !abw.length, abw, wert_qm: u.wert_qm, faktoren: u.faktoren.length };
}

export default { KENNZAHL, TEILMAERKTE, EINGABEN, EINGABE_ORT, objektAusRef, ladeSaetze, satzFuer, merkmalFaktor, matrixLinearBei, umrechnen, vergleichswertIrw, pruefeBeispiel, gstandAusStandardstufe };
