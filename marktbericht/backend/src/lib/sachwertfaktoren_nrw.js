// sachwertfaktoren_nrw.js  (v1069)
//
// Sachwertfaktoren nach § 21 Abs. 3 ImmoWertV (Marktanpassung).
//
// QUELLE
// Grundstuecksmarktbericht 2025 des Kreises Minden-Luebbecke (ohne Stadt
// Minden), Abschnitt 5.1.4, veroeffentlicht am 11.07.2025.
// Datenlizenz Deutschland Zero 2.0 — jede Nutzung ohne Einschraenkung.
//   Gutachterausschuss fuer Grundstueckswerte im Kreis Minden-Luebbecke,
//   Grundstuecksmarktbericht 2025
//
// WARUM ES DIESE DATEI BRAUCHT
// Ohne Sachwertfaktor bleibt der Sachwert ein Herstellungskostenwert. Beim
// Testobjekt Huellhorst ist der Sachwert nach § 6 Abs. 1 das FUEHRENDE
// Verfahren — und trug bisher den Vermerk "vorlaeufig, ohne Sachwertfaktor"
// und zaehlte nicht im Verfahrensvergleich. Das fuehrende Verfahren war das
// einzige ohne Marktwert.
//
// DIE AUSRICHTUNG DER MATRIX IST BELEGT, NICHT GERATEN
// Der Bericht druckt 19 Sachwertstufen ab, aber Zeilen unterschiedlicher
// Laenge (15 / 14 / 12 / 8 Werte). Ob sie links- oder rechtsbuendig zu lesen
// sind, steht nicht dabei. Entschieden hat es die Monotonie: bei gleichem
// Sachwert muss der Faktor mit sinkender Restnutzungsdauer fallen.
// Linksbuendig ab 150 Tsd. EUR haelt das an allen 49 Vergleichspunkten;
// rechtsbuendig verletzt es an vier Stellen. Beide Proben laufen in der
// Pruefstrecke mit.
//
// KEINE EXTRAPOLATION
// "Die in dem Diagramm angegebene Spanne der Sachwerte gibt den Rahmen fuer
// die Verwendbarkeit der Sachwertfaktoren vor." Ausserhalb wird nicht
// gerechnet, sondern ausgewiesen — dieselbe Regel wie bei der
// Groessentabelle der Mietpreisuebersicht.
//
// "Fuer Ein- und Zweifamilienhaeuser mit einer Restnutzungsdauer ueber
// 70 Jahre konnten keine Sachwertfaktoren abgeleitet werden." Darueber
// wird deshalb NICHT auf 70 gedeckelt, sondern abgelehnt.

export const SWF_STAND = {
  ausschuss: 'Der Gutachterausschuss für Grundstückswerte im Kreis Minden-Lübbecke',
  bericht: 'Grundstücksmarktbericht 2025 des Kreises Minden-Lübbecke (ohne Stadt Minden)',
  abschnitt: '5.1.4 Sachwertfaktoren',
  berichtsjahr: 2025,
  veroeffentlicht: '2025-07-11',
  ags_kreis: '05770',
  kauffaelle: 339,
  geschaeftsjahre: '2023 und 2024',
  gesamtnutzungsdauer: 80,
  rechtsgrundlage: '§ 21 Abs. 3 ImmoWertV — Marktanpassung',
  lizenz: 'Datenlizenz Deutschland Zero 2.0',
  modell: 'AGVGA-NRW Sachwertmodell, Stand 11.07.2017, auf Basis SW-RL 2012',
  /* Die Stichprobe, gegen die ein Objekt zu pruefen ist. Weicht es stark ab,
   * ist der Faktor nicht ohne Weiteres uebertragbar. */
  stichprobe: {
    grundstuecksflaeche_qm: 786, grundstuecksflaeche_stabw: 264,
    bgf_qm: 314, bgf_stabw: 96,
    bodenrichtwert_eur_qm: 100, bodenrichtwert_stabw: 33,
    baujahre: '1950 bis 2022 (ohne Neubauten)',
  },
  lage: 'mittlere Lage — für gute bzw. mäßige Lagen ist eine sachverständige '
    + 'Korrektur des Faktors erforderlich (Abschnitt 5.1.4, Hinweise zur Anwendung)',
};

/** Sachwertstufen der Tabelle in EUR (150.000 bis 600.000 in 25.000er Schritten). */
export const SW_STUFEN = [];
for (let s = 150000; s <= 600000; s += 25000) SW_STUFEN.push(s);

/* Die Zeilen beginnen alle bei 150.000 EUR und enden unterschiedlich früh —
 * dort endet die vom Ausschuss ausgewiesene Spanne. */
export const SWF_MATRIX = {
  70: [1.09, 1.04, 1.00, 0.96, 0.93, 0.90, 0.87, 0.84, 0.82, 0.80, 0.78, 0.76, 0.74, 0.73, 0.71],
  60: [1.06, 1.00, 0.95, 0.91, 0.87, 0.83, 0.80, 0.78, 0.75, 0.73, 0.71, 0.69, 0.67, 0.65],
  40: [1.00, 0.94, 0.89, 0.85, 0.82, 0.79, 0.76, 0.74, 0.72, 0.70, 0.68, 0.67],
  20: [0.83, 0.80, 0.77, 0.74, 0.72, 0.70, 0.68, 0.67],
};

export const RND_STUFEN = [20, 40, 60, 70];
export const RND_MAX = 70;

/** Nur für den Kreis Minden-Lübbecke ohne Stadt Minden. */
export const GILT_FUER = { ags_kreis: '05770', ohne_gemeinden: [] };

function zahl(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function interp(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

/** Faktor einer RND-Zeile bei gegebenem Sachwert; null ausserhalb der Spanne. */
export function faktorInZeile(rnd, sachwertEur) {
  const zeile = SWF_MATRIX[rnd];
  if (!zeile) return null;
  const s = zahl(sachwertEur);
  if (s == null) return null;
  const von = SW_STUFEN[0];
  const bis = SW_STUFEN[zeile.length - 1];
  if (s < von || s > bis) return null;
  for (let i = 0; i < zeile.length - 1; i++) {
    if (s >= SW_STUFEN[i] && s <= SW_STUFEN[i + 1]) {
      return interp(s, SW_STUFEN[i], SW_STUFEN[i + 1], zeile[i], zeile[i + 1]);
    }
  }
  return zeile[zeile.length - 1];
}

/**
 * Sachwertfaktor für ein Objekt.
 *
 * @param {object} o
 * @param {string} o.ags            Gemeinde- oder Kreisschlüssel
 * @param {number} o.sachwert_eur   vorläufiger Sachwert
 * @param {number} o.rnd_jahre      modifizierte Restnutzungsdauer
 * @param {string} [o.objektart]
 */
export function sachwertfaktor({ ags, sachwert_eur, rnd_jahre, objektart }) {
  const nichts = (grund, hinweis) => ({ verfuegbar: false, grund, hinweis });

  const kreis = String(ags || '').replace(/\D/g, '').slice(0, 5);
  if (kreis !== GILT_FUER.ags_kreis) {
    return nichts('anderer_ausschuss',
      'Für diesen Ort liegt kein Sachwertfaktor vor. Sachwertfaktoren gelten '
      + 'nur für den Zuständigkeitsbereich des Gutachterausschusses, der sie '
      + 'abgeleitet hat; sie sind nicht übertragbar (§ 10 ImmoWertV).');
  }

  /* Der Ausschuss leitet Sachwertfaktoren nur fuer Ein- und
   * Zweifamilienhaeuser, Doppel- und Reihenhaeuser ab (Abschnitt 5.1). */
  const art = String(objektart || '').toLowerCase();
  if (art && /etw|eigentumswohnung|wohnung|whg|mfh|mehrfamilien|gewerbe|buero/.test(art)) {
    return nichts('objektart_nicht_abgeleitet',
      'Der Gutachterausschuss leitet Sachwertfaktoren nur für Ein- und '
      + 'Zweifamilienhäuser, Doppel- und Reihenhäuser ab (Abschnitt 5.1.4). '
      + 'Für diese Objektart liegt keiner vor.');
  }

  const sw = zahl(sachwert_eur);
  const rnd = zahl(rnd_jahre);
  if (sw == null || sw <= 0) return nichts('sachwert_fehlt');
  if (rnd == null || rnd <= 0) return nichts('rnd_fehlt');

  if (rnd > RND_MAX) {
    return nichts('rnd_ueber_70',
      'Für Ein- und Zweifamilienhäuser mit einer Restnutzungsdauer über '
      + '70 Jahren konnte der Gutachterausschuss keine Sachwertfaktoren '
      + 'ableiten (Abschnitt 5.1.4). Der Sachwert bleibt vorläufig.');
  }

  /* Zwischen den RND-Zeilen wird interpoliert, ueber die Raender hinaus
   * nicht. Unter 20 Jahren endet die Ableitung. */
  if (rnd < RND_STUFEN[0]) {
    return nichts('rnd_unter_20',
      'Die Ableitung des Ausschusses beginnt bei einer Restnutzungsdauer von '
      + '20 Jahren; darunter liegt kein Faktor vor.');
  }

  let unten = RND_STUFEN[0], oben = RND_STUFEN[RND_STUFEN.length - 1];
  for (let i = 0; i < RND_STUFEN.length - 1; i++) {
    if (rnd >= RND_STUFEN[i] && rnd <= RND_STUFEN[i + 1]) {
      unten = RND_STUFEN[i]; oben = RND_STUFEN[i + 1]; break;
    }
  }

  const fu = faktorInZeile(unten, sw);
  const fo = faktorInZeile(oben, sw);

  /* Faellt der Sachwert aus der Spanne EINER der beiden Zeilen, wird nicht
   * auf die andere ausgewichen — das waere eine Verlaengerung der Tabelle
   * ueber ihren ausgewiesenen Rahmen hinaus. */
  if (fu == null || fo == null) {
    const zeile = SWF_MATRIX[oben];
    const bis = SW_STUFEN[zeile.length - 1];
    return nichts('sachwert_ausserhalb',
      'Der Sachwert liegt außerhalb der Spanne, für die der Gutachterausschuss '
      + 'Faktoren ausgewiesen hat (' + (SW_STUFEN[0] / 1000) + '.000 bis '
      + (bis / 1000) + '.000 € bei ' + oben + ' Jahren Restnutzungsdauer). '
      + 'Die Tabelle wird nicht über ihren Rahmen hinaus verlängert.');
  }

  const wert = Math.round(interp(rnd, unten, oben, fu, fo) * 1000) / 1000;

  return {
    verfuegbar: true,
    wert,
    stufe: 'A',
    ebene: 'kreis',
    ags: GILT_FUER.ags_kreis,
    rnd_jahre: rnd, sachwert_eur: sw,
    stuetzstellen: { rnd_unten: unten, rnd_oben: oben, faktor_unten: fu, faktor_oben: fo },
    quelle: SWF_STAND.ausschuss,
    quelle_text: SWF_STAND.bericht + ', ' + SWF_STAND.abschnitt,
    fallzahl: SWF_STAND.kauffaelle,
    modellversion: 'agvga_nrw_sachwert_2017',
    hinweis: 'Marktanpassung nach § 21 Abs. 3 ImmoWertV mit dem Sachwertfaktor des '
      + 'Gutachterausschusses (' + SWF_STAND.kauffaelle + ' Kauffälle, '
      + SWF_STAND.geschaeftsjahre + '). MODELLKONFORMITÄT: der Faktor gilt für eine '
      + 'Gesamtnutzungsdauer von ' + SWF_STAND.gesamtnutzungsdauer + ' Jahren und für '
      + 'mittlere Lagen. Für gute oder mäßige Lagen ist eine sachverständige Korrektur '
      + 'erforderlich; besondere objektspezifische Grundstücksmerkmale sind nach der '
      + 'Marktanpassung gesondert zu berücksichtigen (§ 8 ImmoWertV).',
  };
}

export default { SWF_STAND, SWF_MATRIX, SW_STUFEN, RND_STUFEN, RND_MAX,
  GILT_FUER, faktorInZeile, sachwertfaktor };
