// anlage2.js — Restnutzungsdauer bei Modernisierungen nach Anlage 2 ImmoWertV.
// ────────────────────────────────────────────────────────────────────────────
// Quelle: ImmoWertV vom 14.07.2021, BGBl. I 2021 Nr. 44, S. 2819 f.
// Abgeschrieben aus dem Verordnungstext, nicht aus Sekundaerliteratur.
//
// Bisher wurde die Restnutzungsdauer aus Baujahr und einem groben
// Modernisierungsgrad geschaetzt. Anlage 2 gibt ein Modell vor, das
// bei Ermittlung der sonstigen erforderlichen Daten ZUGRUNDE ZU LEGEN ist.
//
// Wichtig: das Modell ersetzt nicht die sachverstaendige Wuerdigung des
// Einzelfalls. Es liefert einen begruendeten Wert, kein Urteil.

/* Tabelle 1 — Modernisierungselemente mit den maximal zu vergebenden Punkten.
 * Summe 20. Liegen die Massnahmen weiter zurueck, sind weniger als die
 * Maximalpunkte anzusetzen; nicht modernisierte Bauteile, die noch
 * zeitgemaessen Anspruechen genuegen, bekommen vergleichbare Punkte. */
export const MODERNISIERUNGSELEMENTE = [
  { id: 'dach',        max: 4, text: 'Dacherneuerung inklusive Verbesserung der Wärmedämmung' },
  { id: 'fenster',     max: 2, text: 'Modernisierung der Fenster und Außentüren' },
  { id: 'leitungen',   max: 2, text: 'Modernisierung der Leitungssysteme (Strom, Gas, Wasser, Abwasser)' },
  { id: 'heizung',     max: 2, text: 'Modernisierung der Heizungsanlage' },
  { id: 'daemmung',    max: 4, text: 'Wärmedämmung der Außenwände' },
  { id: 'baeder',      max: 2, text: 'Modernisierung von Bädern' },
  { id: 'innenausbau', max: 2, text: 'Modernisierung des Innenausbaus, z. B. Decken, Fußböden, Treppen' },
  { id: 'grundriss',   max: 2, text: 'Wesentliche Verbesserung der Grundrissgestaltung' },
];

/* Tabelle 2 — sachverstaendige Einschaetzung des Modernisierungsgrades.
 * Die Grenzen stehen so in der Verordnung; sie sind NICHT frei gewaehlt. */
export const MODERNISIERUNGSGRAD = [
  { von: 0,  bis: 1,  text: 'nicht modernisiert' },
  { von: 2,  bis: 5,  text: 'kleine Modernisierungen im Rahmen der Instandhaltung' },
  { von: 6,  bis: 10, text: 'mittlerer Modernisierungsgrad' },
  { von: 11, bis: 17, text: 'überwiegend modernisiert' },
  { von: 18, bis: 20, text: 'umfassend modernisiert' },
];

/* Tabelle 3 — Variablen a, b, c und das relative Alter, ab dem die Formel
 * ueberhaupt anwendbar ist. Index = Modernisierungspunkte 0 bis 20. */
const TAB3 = [
  { a: 1.2500, b: 2.6250, c: 1.5250, abRelAlter: 60 },  //  0
  { a: 1.2500, b: 2.6250, c: 1.5250, abRelAlter: 60 },  //  1
  { a: 1.0767, b: 2.2757, c: 1.3878, abRelAlter: 55 },  //  2
  { a: 0.9033, b: 1.9263, c: 1.2505, abRelAlter: 55 },  //  3
  { a: 0.7300, b: 1.5770, c: 1.1133, abRelAlter: 40 },  //  4
  { a: 0.6725, b: 1.4578, c: 1.0850, abRelAlter: 35 },  //  5
  { a: 0.6150, b: 1.3385, c: 1.0567, abRelAlter: 30 },  //  6
  { a: 0.5575, b: 1.2193, c: 1.0283, abRelAlter: 25 },  //  7
  { a: 0.5000, b: 1.1000, c: 1.0000, abRelAlter: 20 },  //  8
  { a: 0.4660, b: 1.0270, c: 0.9906, abRelAlter: 19 },  //  9
  { a: 0.4320, b: 0.9540, c: 0.9811, abRelAlter: 18 },  // 10
  { a: 0.3980, b: 0.8810, c: 0.9717, abRelAlter: 17 },  // 11
  { a: 0.3640, b: 0.8080, c: 0.9622, abRelAlter: 16 },  // 12
  { a: 0.3300, b: 0.7350, c: 0.9528, abRelAlter: 15 },  // 13
  { a: 0.3040, b: 0.6760, c: 0.9506, abRelAlter: 14 },  // 14
  { a: 0.2780, b: 0.6170, c: 0.9485, abRelAlter: 13 },  // 15
  { a: 0.2520, b: 0.5580, c: 0.9463, abRelAlter: 12 },  // 16
  { a: 0.2260, b: 0.4990, c: 0.9442, abRelAlter: 11 },  // 17
  { a: 0.2000, b: 0.4400, c: 0.9420, abRelAlter: 10 },  // 18
  { a: 0.2000, b: 0.4400, c: 0.9420, abRelAlter: 10 },  // 19
  { a: 0.2000, b: 0.4400, c: 0.9420, abRelAlter: 10 },  // 20
];

export function grad(punkte) {
  const p = Math.max(0, Math.min(20, Math.round(Number(punkte) || 0)));
  const g = MODERNISIERUNGSGRAD.find((x) => p >= x.von && p <= x.bis);
  return g ? g.text : 'nicht modernisiert';
}

/**
 * Restnutzungsdauer nach Anlage 2.
 *
 * @param {object} o
 * @param {number} o.gnd            Gesamtnutzungsdauer nach Anlage 1 (Wohngebaeude 80)
 * @param {number} o.alter          Stichtagsjahr minus Baujahr
 * @param {number} o.punkte         Modernisierungspunkte 0 bis 20
 * @param {boolean} [o.kernsaniert] Kernsanierung: Baujahr = Jahr der Sanierung,
 *                                  RND bis zu 90 Prozent der GND
 * @returns {{rnd:number, weg:string, grad:string, punkte:number,
 *            relatives_alter:number, hinweis:string}|null}
 */
export function restnutzungsdauer({ gnd, alter, punkte = 0, kernsaniert = false }) {
  const G = Number(gnd);
  const A = Number(alter);
  if (!(G > 0) || !(A >= 0)) return null;

  const p = Math.max(0, Math.min(20, Math.round(Number(punkte) || 0)));
  const t = TAB3[p];
  const relAlter = (A / G) * 100;

  let rnd;
  let weg;
  let ausFormel;
  if (relAlter < t.abRelAlter) {
    /* "Modernisierungen haben erst ab einem bestimmten Alter Auswirkungen."
     * Unterhalb der Schwelle gilt schlicht GND minus Alter. */
    rnd = G - A;
    ausFormel = false;
    weg = `GND − Alter (relatives Alter ${relAlter.toFixed(1)} % < ${t.abRelAlter} %)`;
  } else {
    rnd = (t.a * A * A) / G - t.b * A + t.c * G;
    ausFormel = true;
    weg = `Formel Anlage 2 (a=${t.a}, b=${t.b}, c=${t.c})`;
  }

  /* Die Kappung auf 70 Prozent gehoert zum Modellansatz der STRECKUNG durch
   * Modernisierung — sie gilt fuer den Formelzweig. Auf GND minus Alter
   * angewendet wuerde sie den trivialen Grundfall unterschreiten: ein
   * 20 Jahre altes Haus mit GND 80 haette dann 56 statt 60 Jahre. Der Deckel
   * darf nichts kuerzen, was gar nicht gestreckt wurde.
   *
   * Der 90-Prozent-Deckel bei Kernsanierung ist dagegen eine allgemeine
   * Obergrenze und gilt in beiden Zweigen. */
  let hinweis = '';
  if (kernsaniert && rnd > 0.90 * G) {
    rnd = 0.90 * G;
    hinweis = 'Auf 90 % der Gesamtnutzungsdauer begrenzt (Kernsanierung).';
  } else if (!kernsaniert && ausFormel && rnd > 0.70 * G) {
    rnd = 0.70 * G;
    hinweis = 'Auf 70 % der Gesamtnutzungsdauer begrenzt, wie im Modell vorgesehen.';
  }
  if (rnd < 0) { rnd = 0; hinweis = 'Rechnerisch aufgebraucht — sachverständige Würdigung nötig.'; }

  return {
    rnd: Math.round(rnd * 10) / 10,
    weg,
    grad: grad(p),
    punkte: p,
    relatives_alter: Math.round(relAlter * 10) / 10,
    hinweis: hinweis
      || 'Modell nach Anlage 2 ImmoWertV. Ersetzt nicht die sachverständige Würdigung des Einzelfalls.',
  };
}

/* Wägungsanteile der neun Gewerke aus Anlage 4, Abschnitt III.1.
 *
 * ACHTUNG, GELTUNGSBEREICH: Die Verordnung gibt diese Anteile NUR fuer
 * freistehende Ein- und Zweifamilienhaeuser, Doppelhaeuser und Reihenhaeuser
 * an — dort mit den Standardstufen 1 bis 5. Fuer Mehrfamilienhaeuser
 * (Abschnitt III.2) beschreibt sie die Stufen 3 bis 5 ohne Wägungsanteile.
 *
 * Sie deshalb auf Wohnungen anzuwenden waere eine Uebertragung, die der
 * Verordnungstext nicht deckt. Bis das geklaert ist, bleibt die Standardstufe
 * bei Mehrfamilienhaeusern eine sachverstaendige Direkteingabe. */
export const WAEGUNGSANTEILE_EFH = {
  aussenwaende: 23, dach: 15, fenster_tueren: 11, innenwaende: 11,
  decken_treppen: 11, fussboeden: 5, sanitaer: 9, heizung: 9, sonstige_technik: 6,
};
export const WAEGUNG_GILT_FUER = 'efh_zfh_doppel_reihen';

/** Standardstufe aus den neun Gewerken. Nur fuer Ein- und Zweifamilienhaeuser. */
export function standardstufeAusGewerken(gewerke) {
  const summe = Object.entries(WAEGUNGSANTEILE_EFH).reduce((a, [k, w]) => {
    const s = Number(gewerke && gewerke[k]);
    return (s >= 1 && s <= 5) ? a + s * w : a;
  }, 0);
  const gewicht = Object.entries(WAEGUNGSANTEILE_EFH).reduce((a, [k, w]) => {
    const s = Number(gewerke && gewerke[k]);
    return (s >= 1 && s <= 5) ? a + w : a;
  }, 0);
  if (gewicht < 100) {
    return { stufe: null, abdeckung_pct: gewicht,
      grund: `Nur ${gewicht} von 100 Wägungsanteilen bewertet — für eine belastbare `
        + 'Einstufung müssen alle neun Gewerke eingeschätzt sein.' };
  }
  const roh = summe / gewicht;
  return { stufe: Math.round(roh), roh: Math.round(roh * 100) / 100, abdeckung_pct: 100 };
}
