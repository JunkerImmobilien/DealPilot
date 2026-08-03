// mietmodell_nrw.js — Die Mietpreisübersicht des Gutachterausschusses.
// ────────────────────────────────────────────────────────────────────────────
// Quelle: Grundstuecksmarktbericht 2025 des Kreises Minden-Luebbecke
//         (ohne Stadt Minden), Abschnitt 9, Aktualitaet 2025.
// Lizenz: Datenlizenz Deutschland Zero 2.0 — jede Nutzung ohne Einschraenkung.
//
// WARUM DAS DER ENTSCHEIDENDE BAUSTEIN IST
//
// Der Marktbericht schreibt bei JEDEM veroeffentlichten Liegenschaftszinssatz
// denselben Satz:
//
//   "Fuer die Ermittlung des Rohertrages sind die marktueblich erzielbaren
//    Ertraege angesetzt worden. Ausgangswerte sind die Daten der
//    Mietpreisuebersicht fuer Wohnungen nach Abschnitt 9."
//
// Der Zinssatz wurde also aus Kaufpreisen abgeleitet, deren Reinertrag auf
// DIESER Tabelle beruht. Wer ihn mit einer Miete aus Portalinseraten
// kombiniert, verlaesst das Modell (Paragraf 10 ImmoWertV).
//
// Gemessen am Testobjekt Huellhorst, 165 m2, Baujahr 1968, ueberwiegend
// modernisiert:
//   GeoMap-Inserate                       8,01 EUR/m2
//   Mietpreisuebersicht, modellkonform    4,83 EUR/m2
//
// Zwei Drittel Unterschied. Das erklaert den Ertragswert von 444.000 EUR
// gegen einen Vergleichswert von 326.000 EUR besser als jede Zinsdiskussion.
//
// GELTUNGSBEREICH — NICHT AUFWEICHEN
// Diese Tabelle gilt fuer den Kreis Minden-Luebbecke OHNE die Stadt Minden.
// Jeder Gutachterausschuss veroeffentlicht seine eigene; sie sind nicht
// uebertragbar. Fehlt die Gemeinde, wird nichts geschaetzt.

export const MIETMODELL_STAND = {
  ausschuss: 'Der Gutachterausschuss für Grundstückswerte im Kreis Minden-Lübbecke',
  bericht: 'Grundstücksmarktbericht 2025 des Kreises Minden-Lübbecke (ohne Stadt Minden)',
  aktualitaet: 2025,
  ags_kreis: '05770',
  lizenz: 'dl-de/zero-2-0',
  hinweis: 'Die angegebenen Mietwerte sind unverbindlich, aus ihnen können keine '
    + 'Rechtsansprüche abgeleitet werden.',
};

/* Abschnitt 9, Mietpreisuebersicht: Nettokaltmiete in EUR/m2 Wohnflaeche,
 * nach Gemeinde und Baujahr. Bezugsgroesse ist eine GUTE Wohnlage,
 * 80 m2, Vollgeschoss — die Faktoren unten passen davon abweichende Faelle an. */
const BAUJAHRE = [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];
const TABELLE = {
  'Bad Oeynhausen':   [5.90, 6.80, 7.00, 7.20, 7.30, 7.70, 8.40, 10.50],
  'Espelkamp':        [5.10, 5.50, 5.70, 6.10, 6.30, 7.50, 7.90,  9.00],
  'Hille':            [4.30, 4.70, 5.10, 5.30, 5.90, 6.60, 7.80,  8.70],
  'Hüllhorst':        [4.40, 5.00, 5.40, 5.70, 6.30, 7.00, 7.50,  8.80],
  'Lübbecke':         [5.40, 5.80, 6.30, 6.60, 6.80, 7.50, 8.20, 10.10],
  'Petershagen':      [4.50, 4.80, 5.10, 5.40, 5.80, 6.30, 6.80,  8.80],
  'Porta Westfalica': [5.30, 5.70, 6.20, 6.50, 6.80, 7.50, 8.30, 10.10],
  'Pr. Oldendorf':    [4.60, 5.00, 5.30, 5.60, 6.40, 6.80, 7.40,  9.20],
  'Rahden':           [4.60, 5.10, 5.50, 5.80, 6.20, 7.00, 7.70,  9.50],
  'Stemwede':         [4.10, 4.70, 5.10, 5.40, 5.90, 6.30, 6.80,  8.30],
};

/* Anpassung des Baujahres nach Modernisierungsgrad, Abschnitt 9.
 * Zeile = Gebaeudealter, Spalte = Klasse 1 bis 5. Wert = Erhoehung in Jahren.
 *
 * ACHTUNG: das ist eine ANDERE Tabelle als Anlage 2 ImmoWertV. Sie dient der
 * Miethoehe, nicht der Restnutzungsdauer. Beide beruhen auf demselben
 * Modernisierungsgedanken, sind aber nicht dasselbe — nicht vermischen. */
const MOD_ALTER = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
const MOD_ERHOEHUNG = {
  0:  [0, 0, 0, 0, 0],   5:  [0, 0, 0, 0, 0],   10: [0, 0, 0, 0, 1],
  15: [0, 0, 0, 1, 4],   20: [0, 0, 1, 3, 8],   25: [0, 0, 1, 5, 11],
  30: [0, 0, 3, 8, 14],  35: [0, 0, 4, 11, 18], 40: [0, 1, 6, 13, 22],
  45: [0, 2, 8, 17, 26], 50: [0, 3, 11, 20, 30], 55: [0, 5, 13, 23, 34],
  60: [1, 7, 17, 27, 38], 65: [2, 10, 20, 31, 42], 70: [5, 13, 24, 35, 47],
  75: [8, 17, 28, 39, 51], 80: [12, 21, 32, 44, 56],
};

export const WOHNLAGE_FAKTOR = {
  sehr_gut: 1.1,   // zentrale Lage in Staedten
  gut: 1.0,        // Stadtlage
  mittel: 0.9,     // Ortschaften der Gemeinden, Ortslage
  einfach: 0.8,    // im Aussenbereich
};

/* Wohnungsgroesse, Abschnitt 9. Zwischenwerte sind zu interpolieren. */
const GROESSE = [[50, 1.20], [60, 1.08], [80, 1.00], [100, 0.94], [120, 0.88], [140, 0.82]];

export const GESCHOSS_FAKTOR = { vollgeschoss: 1.00, dachgeschoss: 0.95 };

function interp(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

function ausTabelle(reihe, jahr) {
  if (jahr <= BAUJAHRE[0]) return reihe[0];
  if (jahr >= BAUJAHRE[BAUJAHRE.length - 1]) return reihe[reihe.length - 1];
  for (let i = 0; i < BAUJAHRE.length - 1; i++) {
    if (jahr >= BAUJAHRE[i] && jahr <= BAUJAHRE[i + 1]) {
      return interp(jahr, BAUJAHRE[i], BAUJAHRE[i + 1], reihe[i], reihe[i + 1]);
    }
  }
  return reihe[0];
}

/** Erhoehung des Baujahres nach Modernisierungsgrad (Klasse 1 bis 5). */
export function baujahrAnpassung(gebaeudealter, klasse) {
  const k = Math.max(1, Math.min(5, Math.round(Number(klasse) || 0))) - 1;
  const a = Math.max(0, Math.min(80, Number(gebaeudealter)));
  if (!Number.isFinite(a)) return 0;
  for (let i = 0; i < MOD_ALTER.length - 1; i++) {
    if (a >= MOD_ALTER[i] && a <= MOD_ALTER[i + 1]) {
      return interp(a, MOD_ALTER[i], MOD_ALTER[i + 1],
        MOD_ERHOEHUNG[MOD_ALTER[i]][k], MOD_ERHOEHUNG[MOD_ALTER[i + 1]][k]);
    }
  }
  return MOD_ERHOEHUNG[80][k];
}

/* Die Tabelle des Ausschusses reicht von 50 bis 140 m2. Darueber hinaus wird
 * NICHT fortgeschrieben: der Faktor faellt von 1,20 auf 0,82 und laesst sich
 * nicht guten Gewissens verlaengern. Eine 165-m2-Wohnung mit 0,82 zu rechnen
 * waere eine Annahme jenseits des Veroeffentlichten — gemessen ergaebe das
 * 4,83 EUR/m2 gegen eine tatsaechliche Kaltmiete von 6,36 EUR/m2 und einen
 * Ertragswert von 204.000 gegen einen Vergleichswert von 326.000 EUR.
 *
 * Ausserhalb der Spanne wird die amtliche Miete deshalb als NICHT FUEHREND
 * gekennzeichnet. Sie bleibt als Vergleich sichtbar; rechnen soll sie dort
 * nicht. */
export const GROESSE_VON = 50;
export const GROESSE_BIS = 140;

function groesseFaktor(qm) {
  const q = Number(qm);
  if (!(q > 0)) return 1;
  if (q <= GROESSE[0][0]) return GROESSE[0][1];
  if (q >= GROESSE[GROESSE.length - 1][0]) return GROESSE[GROESSE.length - 1][1];
  for (let i = 0; i < GROESSE.length - 1; i++) {
    if (q >= GROESSE[i][0] && q <= GROESSE[i + 1][0]) {
      return interp(q, GROESSE[i][0], GROESSE[i + 1][0], GROESSE[i][1], GROESSE[i + 1][1]);
    }
  }
  return 1;
}

/**
 * Marktüblich erzielbare Miete nach der Mietpreisübersicht des Ausschusses.
 *
 * @param {object} o
 * @param {string} o.gemeinde
 * @param {number} o.baujahr
 * @param {number} o.wohnflaeche_qm
 * @param {number} [o.modernisierung_klasse]  1 bis 5, siehe Abschnitt 9
 * @param {number} [o.sanierungsjahr]         bei Kernsanierung
 * @param {boolean} [o.kernsaniert]
 * @param {string} [o.wohnlage]               sehr_gut | gut | mittel | einfach
 * @param {boolean} [o.dachgeschoss]
 * @param {number} [o.stichtag_jahr]
 */
export function marktmiete({
  gemeinde, baujahr, wohnflaeche_qm, ags = null, modernisierung_klasse = null,
  sanierungsjahr = null, kernsaniert = false,
  wohnlage = 'mittel', dachgeschoss = false, stichtag_jahr = null,
}) {
  /* v1071-WZUS-4 · Der Gemeindename allein ist kein Beleg fuer die
   * Zustaendigkeit — "Lauenau", "Hille" und andere Namen gibt es mehrfach
   * in Deutschland. Hier hat bisher nichts geblutet, weil die Tabelle bei
   * unbekannten Namen ohnehin aussteigt; die Pruefung schliesst die Luecke,
   * bevor sie jemand aufmacht. */
  const _kreisM = String(ags || '').replace(/\D/g, '').slice(0, 5);
  if (ags && _kreisM !== MIETMODELL_STAND.ags_kreis) {
    return { verfuegbar: false, grund: 'anderer_ausschuss',
      hinweis: 'Die Mietpreisübersicht gilt nur im Zuständigkeitsbereich des '
        + 'Gutachterausschusses, der sie aufgestellt hat. Jeder Ausschuss '
        + 'veröffentlicht seine eigene; sie sind nicht übertragbar.' };
  }
  const reihe = TABELLE[String(gemeinde || '').trim()];
  if (!reihe) {
    return { verfuegbar: false, grund: 'gemeinde_unbekannt',
      hinweis: `Für ${gemeinde || 'diese Gemeinde'} liegt keine Mietpreisübersicht des `
        + 'Gutachterausschusses vor. Jeder Ausschuss veröffentlicht seine eigene; sie sind '
        + 'nicht übertragbar.' };
  }
  const bj = Number(baujahr);
  const wfl = Number(wohnflaeche_qm);
  if (!(bj > 1500) || !(wfl > 0)) return { verfuegbar: false, grund: 'angaben_fehlen' };

  const jahr = Number(stichtag_jahr) || new Date().getFullYear();

  /* Kernsanierung: Abschnitt 9 sagt ausdruecklich "Zeitpunkt der Sanierung
   * minus 10 Jahre" — nicht das Sanierungsjahr selbst. */
  let fiktiv, wegBj;
  if (kernsaniert && Number(sanierungsjahr) > 1500) {
    fiktiv = Number(sanierungsjahr) - 10;
    wegBj = `Kernsanierung ${sanierungsjahr} − 10 Jahre`;
  } else if (modernisierung_klasse) {
    const erh = baujahrAnpassung(jahr - bj, modernisierung_klasse);
    fiktiv = bj + erh;
    wegBj = `Baujahr ${bj} + ${Math.round(erh)} Jahre (Klasse ${modernisierung_klasse})`;
  } else {
    fiktiv = bj;
    wegBj = `Baujahr ${bj}, keine Anpassung`;
  }

  const basis = ausTabelle(reihe, fiktiv);
  const fLage = WOHNLAGE_FAKTOR[wohnlage] != null ? WOHNLAGE_FAKTOR[wohnlage] : 0.9;
  const fGr = groesseFaktor(wfl);
  const fGe = dachgeschoss ? GESCHOSS_FAKTOR.dachgeschoss : GESCHOSS_FAKTOR.vollgeschoss;

  const miete = basis * fLage * fGr * fGe;
  const r2 = (x) => Math.round(x * 100) / 100;

  /* Ausserhalb der veroeffentlichten Groessenspanne fuehrt die amtliche Miete
   * nicht — sie wird nur ausgewiesen. */
  const ausserhalb = wfl < GROESSE_VON || wfl > GROESSE_BIS;

  return {
    verfuegbar: true,
    fuehrend: !ausserhalb,
    ausserhalb_tabelle: ausserhalb,
    ausserhalb_hinweis: ausserhalb
      ? `Die Größentabelle des Gutachterausschusses reicht von ${GROESSE_VON} bis `
        + `${GROESSE_BIS} m². Mit ${wfl} m² liegt das Objekt außerhalb; der Anpassungsfaktor `
        + 'wurde nicht über den veröffentlichten Bereich hinaus fortgeschrieben. Die amtliche '
        + 'Miete dient hier als Vergleich, nicht als Rechengrundlage.'
      : null,
    miete_qm: r2(miete),
    miete_monat: Math.round(miete * wfl * 100) / 100,
    fiktives_baujahr: Math.round(fiktiv),
    staffel: [
      { pos: `Tabellenwert ${gemeinde} (${wegBj})`, wert: r2(basis), einheit: 'EUR/m²' },
      { pos: `× Wohnlage (${wohnlage})`, faktor: fLage },
      { pos: `× Wohnungsgröße (${wfl} m²)`, faktor: r2(fGr) },
      { pos: `× Geschosslage (${dachgeschoss ? 'Dachgeschoss' : 'Vollgeschoss'})`, faktor: fGe },
      { pos: '= marktüblich erzielbare Miete', wert: r2(miete), einheit: 'EUR/m²' },
    ],
    quelle: MIETMODELL_STAND.bericht + ', Abschnitt 9',
    ausschuss: MIETMODELL_STAND.ausschuss,
    hinweis: 'Marktüblich erzielbare Miete nach der Mietpreisübersicht des Gutachterausschusses. '
      + 'Sie ist die Grundlage, auf der derselbe Ausschuss seine Liegenschaftszinssätze '
      + 'abgeleitet hat — eine Miete aus Portalangeboten wäre modellfremd (§ 10 ImmoWertV).',
  };
}
