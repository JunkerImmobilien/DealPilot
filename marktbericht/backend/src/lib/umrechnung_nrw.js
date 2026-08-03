// umrechnung_nrw.js  (v1070)
//
// Umrechnungskoeffizienten fuer die Grundstuecksgroesse und die Abgrenzung
// des ueberschuessigen Flaechenanteils ("Hinterland").
//
// QUELLE
// Grundstuecksmarktbericht 2025 des Kreises Minden-Luebbecke (ohne Stadt
// Minden), Abschnitt 4.6.4, Datenlizenz Deutschland Zero 2.0.
//   Gutachterausschuss fuer Grundstueckswerte im Kreis Minden-Luebbecke,
//   Grundstuecksmarktbericht 2025
//
// DAS PROBLEM, DAS ES LOEST
// Der Bodenwert setzte bisher die GESAMTE Flaeche zum vollen Bodenrichtwert
// an. Bei 1.628 m2 in einer Zone mit 700 m2 Bezugsgroesse und 100 EUR/m2
// waren das 162.800 EUR statt 101.328 EUR — 61.000 EUR zu viel, und der
// Hinweis dazu stand seit v1049 als offener Punkt im Kunden-PDF:
//   "Nach § 41 ImmoWertV kommt fuer die Mehrflaeche eine getrennte
//    Bewertung in Betracht — hier nicht vorgenommen."
//
// DIE REGEL DES AUSSCHUSSES, WOERTLICH
// "Es hat sich herausgestellt, dass die Umrechnungskoeffizienten maximal bis
//  zum 1,5-fachen der Bezugsgroesse des Bodenrichtwertes anzuwenden sind.
//  Die Grundstuecksteilflaeche ausserhalb der Begrenzung wird als
//  ueberschuessiger Flaechenanteil betrachtet, der wertmaessig wie eine
//  private Gruenflaeche einzusetzen ist."
// Wertspanne privater Gruenflaechen im Kreis: 1 bis 12 EUR/m2, Durchschnitt
// 5 EUR/m2 — "die Kaufpreise weisen keine lagemaessige Abhaengigkeit auf".
//
// ZWEI EFFEKTE, NICHT EINER
// 1) der Koeffizient druckt den EUR/m2 fuer das groessere Baulandgrundstueck
// 2) die Flaeche oberhalb der Grenze zaehlt nur mit dem Gruenflaechenwert
// Wer nur einen von beiden ansetzt, rechnet falsch.
//
// GELTUNGSBEREICH
// "von 400 bis 1.600 m2 Gesamtgroesse des Baugrundstuecks" und
// "Ein- und Zweifamilienhausgrundstuecke, die eine nicht teilbare Einheit
//  bilden und baulich nutzbar sind". Ausserhalb wird nicht gerechnet.

export const UK_STAND = {
  ausschuss: 'Der Gutachterausschuss für Grundstückswerte im Kreis Minden-Lübbecke',
  bericht: 'Grundstücksmarktbericht 2025 des Kreises Minden-Lübbecke (ohne Stadt Minden)',
  abschnitt: '4.6.4 Umrechnungskoeffizienten',
  ags_kreis: '05770',
  berichtsjahr: 2025,
  kauffaelle: 1800,
  jahrgaenge: '2004 bis 2012, mit aktuellen Kauffällen überprüft',
  lizenz: 'Datenlizenz Deutschland Zero 2.0',
  rechtsgrundlage: '§ 41 ImmoWertV — selbständig nutzbare bzw. überschüssige Teilflächen',
  gruenflaeche_eur_qm: 5,
  gruenflaeche_spanne: [1, 12],
  max_faktor_bezugsgroesse: 1.5,
  flaeche_von: 400,
  flaeche_bis: 1600,
};

/** Stützstellen der Tabelle in m². */
export const UK_FLAECHEN = [400, 600, 800, 1000, 1200, 1400, 1600];

/** Zeilen nach Bodenrichtwert-Klasse. */
export const UK_ZEILEN = {
  bis_60:     [1.32, 1.13, 1.00, 1.00, 1.00, 0.93, 0.86],
  '65_bis_100': [1.04, 1.00, 1.00, 0.95, 0.90, 0.85, 0.81],
  ueber_100:  [1.03, 1.00, 1.00, 0.97, 0.92, 0.88, 0.85],
};

export function zeileFuerBrw(brwEurQm) {
  const b = Number(brwEurQm);
  if (!Number.isFinite(b) || b <= 0) return null;
  if (b < 65) return 'bis_60';
  if (b <= 100) return '65_bis_100';
  return 'ueber_100';
}

function interp(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

/**
 * Umrechnungskoeffizient für eine Fläche. Ausserhalb der Stützstellen wird
 * auf den Randwert gesetzt, NICHT verlängert — die Tabelle endet dort.
 */
export function koeffizient(zeile, flaecheQm) {
  const v = UK_ZEILEN[zeile];
  const f = Number(flaecheQm);
  if (!v || !Number.isFinite(f) || f <= 0) return null;
  if (f <= UK_FLAECHEN[0]) return v[0];
  if (f >= UK_FLAECHEN[UK_FLAECHEN.length - 1]) return v[v.length - 1];
  for (let i = 0; i < UK_FLAECHEN.length - 1; i++) {
    if (f >= UK_FLAECHEN[i] && f <= UK_FLAECHEN[i + 1]) {
      return Math.round(interp(f, UK_FLAECHEN[i], UK_FLAECHEN[i + 1], v[i], v[i + 1]) * 1000) / 1000;
    }
  }
  return null;
}

/**
 * Aufteilung eines Grundstücks in Bauland und überschüssige Fläche.
 *
 * @param {object} o
 * @param {string} o.ags                Gemeinde- oder Kreisschlüssel
 * @param {number} o.brw_eur_qm         Bodenrichtwert
 * @param {number} o.flaeche_qm         tatsächliche Grundstücksfläche
 * @param {number} o.bezugsgroesse_qm   Fläche des Bodenrichtwertgrundstücks
 * @param {boolean} [o.ist_wohnung]
 */
export function flaechenaufteilung({ ags, brw_eur_qm, flaeche_qm, bezugsgroesse_qm, ist_wohnung }) {
  const nichts = (grund, hinweis) => ({ verfuegbar: false, grund, hinweis });

  const kreis = String(ags || '').replace(/\D/g, '').slice(0, 5);
  if (kreis !== UK_STAND.ags_kreis) {
    return nichts('anderer_ausschuss',
      'Umrechnungskoeffizienten sind regional. Für diesen Ort liegen keine vor; '
      + 'die Tabelle eines anderen Gutachterausschusses ist nicht übertragbar '
      + '(§ 10 ImmoWertV).');
  }

  const fl = Number(flaeche_qm);
  const bez = Number(bezugsgroesse_qm);
  const brw = Number(brw_eur_qm);
  if (!(fl > 0)) return nichts('flaeche_fehlt');
  if (!(bez > 0)) {
    return nichts('bezugsgroesse_fehlt',
      'Die Fläche des Bodenrichtwertgrundstücks ist nicht bekannt. Ohne sie '
      + 'lässt sich nicht bestimmen, ab wo die Fläche überschüssig ist.');
  }
  if (!(brw > 0)) return nichts('brw_fehlt');

  /* Der Ausschuss wertet ausdruecklich Ein- und Zweifamilienhausgrundstuecke
   * aus. Fuer Wohnungseigentum gilt die Tabelle nicht — dort fuehrt ohnehin
   * der Miteigentumsanteil zum Bodenwert. */
  if (ist_wohnung) {
    return nichts('wohnungseigentum',
      'Der Anwendungsbereich sind Ein- und Zweifamilienhausgrundstücke, die eine '
      + 'nicht teilbare Einheit bilden. Bei Wohnungseigentum wird der Bodenwert '
      + 'über den Miteigentumsanteil ermittelt.');
  }

  const zeile = zeileFuerBrw(brw);
  if (!zeile) return nichts('brw_fehlt');

  const grenze = Math.round(bez * UK_STAND.max_faktor_bezugsgroesse);
  const bauland = Math.min(fl, grenze);
  const gruen = Math.max(0, fl - grenze);

  /* Geltungsbereich der Tabelle: 400 bis 1.600 m2 Baulandflaeche. Liegt die
   * Baulandflaeche darunter oder darueber, wird der Koeffizient nicht
   * angewandt — die Aufteilung selbst bleibt trotzdem richtig. */
  const imBereich = bauland >= UK_STAND.flaeche_von && bauland <= UK_STAND.flaeche_bis
    && bez >= UK_STAND.flaeche_von && bez <= UK_STAND.flaeche_bis;

  const kBauland = imBereich ? koeffizient(zeile, bauland) : null;
  const kBezug = imBereich ? koeffizient(zeile, bez) : null;
  const faktor = (kBauland != null && kBezug) ? Math.round(kBauland / kBezug * 10000) / 10000 : 1;

  const bwQm = Math.round(brw * faktor * 100) / 100;
  const wertBauland = Math.round(bauland * bwQm);
  const wertGruen = Math.round(gruen * UK_STAND.gruenflaeche_eur_qm);

  return {
    verfuegbar: true,
    zeile, bezugsgroesse_qm: bez, grenze_qm: grenze,
    bauland_qm: bauland, gruen_qm: gruen,
    koeffizient_bauland: kBauland, koeffizient_bezugsgroesse: kBezug,
    faktor, bodenwert_eur_qm: bwQm,
    gruen_eur_qm: UK_STAND.gruenflaeche_eur_qm,
    wert_bauland_eur: wertBauland, wert_gruen_eur: wertGruen,
    wert_eur: wertBauland + wertGruen,
    koeffizient_angewandt: imBereich,
    quelle: UK_STAND.ausschuss,
    quelle_text: UK_STAND.bericht + ', ' + UK_STAND.abschnitt,
    hinweis: gruen > 0
      ? 'Die Umrechnungskoeffizienten sind maximal bis zum 1,5-fachen der Bezugsgröße '
        + 'des Bodenrichtwertgrundstücks anzuwenden (' + bez + ' m² × 1,5 = ' + grenze + ' m²). '
        + 'Die darüber hinausgehenden ' + gruen + ' m² sind als überschüssiger Flächenanteil '
        + 'wie eine private Grünfläche anzusetzen (' + UK_STAND.gruenflaeche_eur_qm + ' €/m², '
        + 'Spanne ' + UK_STAND.gruenflaeche_spanne[0] + ' bis '
        + UK_STAND.gruenflaeche_spanne[1] + ' €/m²). § 41 ImmoWertV.'
      : (imBereich
        ? 'Der Bodenrichtwert wurde mit dem Umrechnungskoeffizienten des Ausschusses an die '
          + 'Grundstücksgröße angepasst (' + bauland + ' m² gegen ' + bez + ' m² Bezugsgröße).'
        : 'Die Grundstücksgröße liegt außerhalb des Geltungsbereichs der '
          + 'Umrechnungskoeffizienten (' + UK_STAND.flaeche_von + ' bis '
          + UK_STAND.flaeche_bis + ' m²); der Bodenrichtwert wurde nicht angepasst.'),
  };
}

/* v1071-WHIN-1 · Die ausdrueckliche Angabe schlaegt die Ableitung.
 *
 * Gemessen an Loehner Strasse 278: das Formular hatte 700 m2 Grundstueck
 * UND 928 m2 Garten in zwei Feldern. In den Bodenwert gingen nur die 700.
 * Die 928 m2 waren nirgends — im Gutachten des Sachverstaendigen stehen sie
 * mit 30 EUR/m2, also 27.840 EUR.
 *
 * Ableiten laesst sich das nicht: bei einer Wohnung ist "Garten 40 m2" ein
 * Teil des Grundstuecks, bei einem Haus koennen 928 m2 Hinterland danebenn
 * liegen. Wer das raet, liegt in der Haelfte der Faelle daneben. Deshalb ein
 * eigenes Feld — genau wie im Werkzeug des Sachverstaendigen.
 *
 * Der Wertansatz ist eine Eingabe. Vorgeschlagen wird der amtliche
 * Gruenflaechenwert des Ausschusses (5 EUR/m2), aber nur wo es einen gibt. */
export function manuelleAufteilung({ flaeche_qm, hinterland_qm, hinterland_eur_qm, brw_eur_qm, ags, rentierlich }) {
  const fl = Number(flaeche_qm), hl = Number(hinterland_qm), brw = Number(brw_eur_qm);
  if (!(fl > 0) || !(brw > 0)) return { verfuegbar: false, grund: 'angaben_fehlen' };
  if (!(hl > 0)) return { verfuegbar: false, grund: 'kein_hinterland' };

  const kreis = String(ags || '').replace(/\D/g, '').slice(0, 5);
  const amtlich = kreis === UK_STAND.ags_kreis;
  const satz = Number(hinterland_eur_qm);
  if (!(satz > 0)) {
    return { verfuegbar: false, grund: 'wertansatz_fehlt',
      hinweis: 'Für die zusätzliche Grundstücksfläche fehlt der Wertansatz. '
        + (amtlich
          ? 'Der Gutachterausschuss weist für private Grünflächen '
            + UK_STAND.gruenflaeche_eur_qm + ' €/m² aus (Spanne '
            + UK_STAND.gruenflaeche_spanne[0] + ' bis ' + UK_STAND.gruenflaeche_spanne[1] + ' €/m²).'
          : 'Ohne Angabe wird nicht geschätzt — der Wert einer Hinterlandfläche '
            + 'hängt von Zuschnitt, Zuwegung und Nutzbarkeit ab.') };
  }

  const bauland = Math.max(0, fl);
  return {
    verfuegbar: true, quelle_art: 'eigene Angabe',
    bauland_qm: bauland, gruen_qm: hl,
    bodenwert_eur_qm: brw, gruen_eur_qm: satz,
    faktor: 1, koeffizient_angewandt: false,
    /* v1072-WREN-3 · Vorgabe: eine zusaetzliche Gartenflaeche wirft keinen
     * Ertrag ab. Wer sie vermietet, setzt den Haken. */
    rentierlich: rentierlich === true,
    wert_bauland_eur: Math.round(bauland * brw),
    wert_gruen_eur: Math.round(hl * satz),
    wert_eur: Math.round(bauland * brw + hl * satz),
    hinweis: 'Zusätzliche Grundstücksfläche von ' + hl + ' m² mit '
      + String(satz).replace('.', ',') + ' €/m² angesetzt (eigene Angabe). '
      + 'Sie unterliegt nicht der Bodenwertverzinsung des Hauptgrundstücks; '
      + 'nach § 41 ImmoWertV ist für selbständig nutzbare oder überschüssige '
      + 'Teilflächen eine getrennte Bewertung vorzunehmen.'
      + (amtlich
        ? ' Zum Vergleich: der Gutachterausschuss weist für private Grünflächen '
          + UK_STAND.gruenflaeche_eur_qm + ' €/m² aus.' : ''),
  };
}

export default { UK_STAND, UK_FLAECHEN, UK_ZEILEN, zeileFuerBrw, koeffizient,
  flaechenaufteilung, manuelleAufteilung };
