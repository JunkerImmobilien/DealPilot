// profile/be-lzs.js  (v1066)
//
// Profil: Liegenschaftszinssaetze Berlin, Geschaeftsstelle des
// Gutachterausschusses fuer Grundstueckswerte in Berlin.
//
// WARUM ES PROFILE GIBT UND KEINEN GENERISCHEN PARSER
//
// Minden-Luebbecke veroeffentlicht einen Mittelwert mit Streuung.
// Das AGVGA-NRW-Modell veroeffentlicht Tabellen mit Ansaetzen.
// Berlin veroeffentlicht eine Regressionsgleichung.
//
// Drei Ausschuesse, drei Formen. Ein Parser, der "aus deutschen
// Marktbericht-PDFs die Zahlen zieht", wuerde bei Berlin eine Stuetzstelle
// fuer den Zinssatz halten — und damit einen Wert verwenden, der fuer eine
// Miete von 4,00 EUR/m2 gilt, bei einem Objekt mit 12,00.
//
// Ein Profil weiss, wo SEINE Zahlen stehen, und bringt seine Belege mit.

export const ID = 'be-lzs';
export const LAND = 'be';
export const AGS = '11000';
export const KENNZAHL = 'liegenschaftszinssatz';

const GEBIETSGRUPPEN = ['Südost', 'Südwest', 'Nord', 'City', 'Ost', 'West'];

/** '0,644' -> 0.644 · '1.096' -> 1096 (Tausenderpunkt) */
function de(s) {
  const t = String(s).trim();
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

function ersteZahl(text, muster, wandler) {
  const m = text.match(muster);
  if (!m) return null;
  return (wandler || de)(m[1]);
}

/**
 * @param {string} text  pdftotext-Ausgabe der Veroeffentlichung
 * @param {object} opt   { quelleUrl }
 * @returns {{ modelle:Array, warnungen:Array }}
 */
export function parse(text, opt = {}) {
  const t = String(text || '');
  const warnungen = [];

  // ── Rahmendaten ────────────────────────────────────────────────────────
  const stichtagRoh = (t.match(/zum Stichtag (\d{2}\.\d{2}\.\d{4})/) || [])[1] || null;
  const stichtag = stichtagRoh
    ? stichtagRoh.split('.').reverse().join('-')
    : null;
  const berichtsjahr = ersteZahl(t, /Liegenschaftszinssätze (\d{4})/, Number);
  const fallzahl = ersteZahl(
    t, /ergaben sich danach ([\d.]+) Kauffälle, die in die Ableitung/);

  // ── Geltungsbereich, woertlich aus Punkt 3 der Vorbemerkungen ──────────
  const minWe = ersteZahl(t, /für Objekte mit mindestens (\w+) Mieteinheiten/,
    (w) => ({ zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6 }[String(w).toLowerCase()]
      || Number(w) || null));
  const schliesstAus = /gelten nicht für Ein-, Zwei- oder Dreifamilienhäuser und Wohnungs-\/Teileigentum/.test(t);

  // ── Modellansaetze (§ 10 ImmoWertV) ────────────────────────────────────
  const modellansaetze = {
    instandhaltung_wohnen_eur_qm: ersteZahl(t, /Wohnen:\s*([\d,]+)\s*EUR\s*\/\s*m²\s*Wohnfläche/),
    instandhaltung_garage_eur: ersteZahl(t, /Garagen:\s*([\d,]+)\s*EUR je Platz/),
    instandhaltung_stellplatz_eur: ersteZahl(t, /Wagenabstellplätze:\s*([\d,]+)\s*EUR je Platz/),
    verwaltung_je_wohnung_eur: ersteZahl(t, /Wohnen:\s*([\d,]+)\s*EUR jährlich je Wohnung/),
    verwaltung_gewerbe_pct: ersteZahl(t, /Gewerbe und Sonstiges:\s*(\d+)\s*%/),
    mietausfall_wohnen_pct: ersteZahl(t, /Mietausfallwagnis:\s*(\d+)\s*% der jährlichen/),
    mietausfall_gewerbe_pct: ersteZahl(t, /und (\d+)\s*% der jährlichen\s*\n?Netto-Kaltmiete für gewerbliche/),
    vpi_basis: ersteZahl(t, /Monat Oktober 2001\s*=\s*([\d,]+)/),
    vpi_ziel: ersteZahl(t, /Monat Oktober 20\d\d\s*\n?=\s*([\d,]+)\s*angepasst/),
    bodenrichtwert_stichtag: (t.match(/modellkonform der Bodenrichtwert zum (\d{2}\.\d{2}\.\d{4})/) || [])[1] || null,
  };

  // ── Korrekturen, die auf ALLE Tabellen wirken ──────────────────────────
  const korrekturen = { altbezirk: {}, baujahresgruppe: {}, gewerbeanteil_pct: {} };

  const bjBlock = t.split('Baujahresgruppe:')[1] || '';
  const bjMuster = [
    [/Altbauten \(Baujahre vor 1919\):\s*([±+\-][\d,]+)/, 'vor_1919'],
    [/Zwischenkriegsbauten \(Baujahre 1919 bis 1948\):\s*([±+\-][\d,]+)/, '1919_1948'],
    [/Baujahre 1949 bis 1972:\s*([±+\-][\d,]+)/, '1949_1972'],
    [/Baujahre 1973 bis 1990 im Westteil:\s*([±+\-][\d,]+)/, '1973_1990_west'],
    [/Baujahre 1973 bis 1990 im Ostteil:\s*([±+\-][\d,]+)/, '1973_1990_ost'],
    [/Baujahre 1991 bis 2002:\s*([±+\-][\d,]+)/, '1991_2002'],
    [/Baujahr nach 2002:\s*([±+\-][\d,]+)/, 'ab_2003'],
  ];
  for (const [muster, name] of bjMuster) {
    const m = bjBlock.match(muster);
    if (m) korrekturen.baujahresgruppe[name] = m[1][0] === '±' ? 0 : de(m[1].replace('+', ''));
  }

  const gwBlock = (t.split('Gewerblichen Anteil am Nettojahresrohertrag in Prozent:')[1] || '')
    .split('Weitere Einflussfaktoren')[0];
  for (const m of gwBlock.matchAll(/^\s*(\d{1,2}):\s*([±+\-][\d,]+)\s*$/gm)) {
    korrekturen.gewerbeanteil_pct[m[1]] = m[2][0] === '±' ? 0 : de(m[2].replace('+', ''));
  }

  // ── Die sechs Tabellen ─────────────────────────────────────────────────
  const modelle = [];
  for (const gruppe of GEBIETSGRUPPEN) {
    const i = t.indexOf('Gebietsgruppe ' + gruppe);
    if (i < 0) { warnungen.push('Gebietsgruppe ' + gruppe + ' nicht gefunden'); continue; }
    // Bis zur naechsten Tabelle bzw. bis zum Korrekturblock am Ende.
    let ende = t.indexOf('Tabelle', i);
    const endeKorr = t.indexOf('Diese Korrekturen sind auf die Tabellen', i);
    if (endeKorr > 0 && (ende < 0 || endeKorr < ende)) ende = endeKorr;
    const block = t.slice(i, ende > i ? ende : t.length);

    const f = block.match(
      /=\s*([\d,]+)\s*\+\s*([\d,]+)\s*x\s*Objektmiete[\s\S]*?\+\s*\n?([\d,]+)\s*x\s*([\d.]+)/);
    if (!f) { warnungen.push('Formel der Gebietsgruppe ' + gruppe + ' nicht lesbar'); continue; }

    // Zuschlag steht hinter der Tageskomponente, falls vorhanden.
    const nachTagen = block.slice(block.indexOf(f[0]) + f[0].length, block.indexOf(f[0]) + f[0].length + 200);
    const zu = nachTagen.match(/\)\s*\+\s*([\d,]+)/);

    // Stuetzstellen: die Mietenzeile und die Zinszeile stehen direkt
    // untereinander. Die Fussnotenziffern kleben an 4,00 und 20,00 —
    // deshalb wird die Ziffer hinter zwei Nachkommastellen abgeschnitten.
    const zeilen = block.split('\n');
    let belege = [];
    for (let z = 0; z < zeilen.length - 1; z++) {
      if (!/EUR \/ m² WNfl\./.test(zeilen[z])) continue;
      const mieten = (zeilen[z + 1].match(/\d+,\d{2}/g) || []).map(de);
      const zinsen = (zeilen[z + 2] || '').trim().split(/\s+/).map(de).filter((x) => Number.isFinite(x));
      if (mieten.length && mieten.length === zinsen.length) {
        belege = mieten.map((m, k) => ({ miete: m, zins: zinsen[k] }));
      }
      break;
    }
    if (!belege.length) {
      warnungen.push('Stützstellen der Gebietsgruppe ' + gruppe + ' nicht lesbar');
      continue;
    }

    // Altbezirks-Korrekturen stehen NUR im jeweiligen Tabellenblock.
    const altbezirk = {};
    const kBlock = block.split(/Korrekturen:\s*\n\s*Altbezirk/)[1];
    if (kBlock) {
      for (const m of kBlock.matchAll(/^\s*([A-ZÄÖÜ][\wäöüß-]+)\s+([+\-][\d,]+)\s*$/gm)) {
        altbezirk[m[1]] = de(m[2].replace('+', ''));
      }
    }

    modelle.push({
      land_code: LAND, ags: AGS, ebene: 'land',
      gebiet_name: 'Berlin',
      gaa_name: 'Gutachterausschuss für Grundstückswerte in Berlin',
      kennzahl: KENNZAHL,
      zweig: gruppe,
      formel: {
        konstante: de(f[1]), je_miete: de(f[2]),
        je_tag: de(f[3]), tage: de(f[4]),
        zuschlag: zu ? de(zu[1]) : 0,
      },
      korrekturen: { ...korrekturen, altbezirk },
      modellansaetze,
      geltungsbereich: {
        min_mieteinheiten: minWe,
        objektarten_aus: schliesstAus
          ? ['etw', 'wohnungseigentum', 'teileigentum', 'efh', 'zfh',
             'einfamilien', 'zweifamilien', 'dreifamilien']
          : [],
        miete_von: belege[0].miete,
        miete_bis: belege[belege.length - 1].miete,
      },
      belege,
      stufe: 'A',
      fallzahl,
      stichtag,
      berichtsjahr,
      modellversion: 'be_lzs_' + (berichtsjahr || '') ,
      quelle_url: opt.quelleUrl || '',
      quelle_parser: 'p2-' + ID,
      lizenz: 'Amtsblatt für Berlin — Quellenvermerk Pflicht',
      quellenvermerk: 'Geschäftsstelle des Gutachterausschusses für '
        + 'Grundstückswerte in Berlin, Liegenschaftszinssätze '
        + (berichtsjahr || '') + ', Amtsblatt für Berlin',
    });
  }

  if (!modelle.length) warnungen.push('keine Gebietsgruppe gelesen');
  return { modelle, warnungen };
}

export default { ID, LAND, AGS, KENNZAHL, parse };
