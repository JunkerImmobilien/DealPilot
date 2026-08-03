// vergleichsfaktoren_nrw.js — Vergleichsfaktoren des Gutachterausschusses.
// ────────────────────────────────────────────────────────────────────────────
// Quelle: Grundstuecksmarktbericht 2025 des Kreises Minden-Luebbecke
//         (ohne Stadt Minden), Abschnitte 5.1.2 und 6.1.2.
// Lizenz: Datenlizenz Deutschland Zero 2.0.
//
// WARUM DAS DER FEHLENDE ANKER IST
//
// Unser fuehrendes Verfahren stuetzt sich auf GeoMap-Portalinserate — das sind
// ANGEBOTSPREISE. Paragraf 25 ImmoWertV verlangt Kaufpreise. Immobilien-
// richtwerte nach Paragraf 20 gibt es fuer Minden-Luebbecke nicht ("Richtwerte
// noch nicht beschlossen"), aber der Marktbericht veroeffentlicht dieselbe
// Sache als Tabelle: durchschnittliche Kaufpreise je m2 Wohnflaeche, aus der
// Kaufpreissammlung, nach Gemeinde und Baujahresklasse.
//
// Der Bericht sagt selbst, wozu sie dienen: "Diese aus der Kaufpreissammlung
// ermittelten Daten koennen als Vergleichsfaktoren benutzt werden, um den
// Marktwert einer Eigentumswohnung ueberschlaegig zu ermitteln."
//
// DIE ANWENDUNGSGRENZEN STEHEN IM BERICHT UND WERDEN NICHT GEDEHNT
//
// Wohnungseigentum (Abschnitt 6.1.1/6.1.2):
//   - Wohnflaeche 50 bis 120 m2
//   - gebietstypische Wohnlagen (mittel bis gut)
//   - Objekte ab DREI Wohneinheiten
//   - ohne Stellplaetze bzw. Garagen
//
// Ein- und Zweifamilienhaeuser (Abschnitt 5.1.2):
//   - Grundstueck 450 bis 1.200 m2
//   - Massivbauweise, Bauausfuehrung baujahrestypisch
//
// Wer diese Grenzen ueberschreitet, bekommt keinen Wert, sondern den Grund.

export const VF_STAND = {
  ausschuss: 'Der Gutachterausschuss für Grundstückswerte im Kreis Minden-Lübbecke',
  bericht: 'Grundstücksmarktbericht 2025 des Kreises Minden-Lübbecke (ohne Stadt Minden)',
  berichtsjahr: 2025,
  kauffaelle_aus: 2024,
  ags_kreis: '05770',
  lizenz: 'dl-de/zero-2-0',
  rechtsgrundlage: '§ 20 ImmoWertV — Vergleichsfaktoren für bebaute Grundstücke',
};

/* Abschnitt 6.1.2 — Wohnungseigentum, EUR/m2 Wohnflaeche.
 * Reihenfolge: [Neubau/Erstverkauf, 2010-2021, 1995-2009, 1975-1994, 1950-1974]
 * null = im Bericht mit "/" gekennzeichnet: keine Angabe. */
const WE_KLASSEN = [
  { von: 2022, bis: 9999, name: 'Neubau / Erstverkauf' },
  { von: 2010, bis: 2021, name: '2010–2021' },
  { von: 1995, bis: 2009, name: '1995–2009' },
  { von: 1975, bis: 1994, name: '1975–1994' },
  { von: 1950, bis: 1974, name: '1950–1974' },
];
const WE_TABELLE = {
  'Bad Oeynhausen':   [3400, null, 2050, 1800, 1550],
  'Espelkamp':        [null, null, null, null, 1400],
  'Lübbecke':         [3500, 2800, 1900, 1600, 1350],
  'Porta Westfalica': [null, null, 1800, 1550, null],
  /* Der Bericht fuehrt die uebrigen Gemeinden zusammen als "andere". */
  '_andere':          [3300, null, 1850, 1550, null],
  '_kreis':           [3300, 2750, 1900, 1600, 1450],
};

/* Abschnitt 5.1.2 — freistehende Ein- und Zweifamilienhaeuser, EUR/m2 Wohnflaeche.
 * [2010-2022, 1995-2009, 1975-1994, 1950-1974, 1919-1949] */
const HAUS_KLASSEN = [
  { von: 2010, bis: 9999, name: '2010–2022' },
  { von: 1995, bis: 2009, name: '1995–2009' },
  { von: 1975, bis: 1994, name: '1975–1994' },
  { von: 1950, bis: 1974, name: '1950–1974' },
  { von: 1919, bis: 1949, name: '1919–1949' },
];
const HAUS_TABELLE = {
  'Bad Oeynhausen':   [3050, 2300, 1900, 1650, 1450],
  'Espelkamp':        [null, 2050, 1750, 1400, null],
  'Hille':            [null, 2200, 1800, 1300, 1000],
  'Hüllhorst':        [null, 2150, 1700, 1500, 1100],
  'Lübbecke':         [null, 2200, 1750, 1550, 1200],
  'Petershagen':      [null, 2000, 1650, 1400, null],
  'Porta Westfalica': [null, 2100, 1750, 1500, 1200],
  'Pr. Oldendorf':    [null, 2050, 1700, 1400, null],
  'Rahden':           [null, 2100, 1750, 1300, null],
  'Stemwede':         [null, 2000, 1650, 1300, 1450],
  '_kreis':           [2650, 2100, 1750, 1450, 1150],
};

/* Anwendungsgrenzen, woertlich aus dem Bericht. */
export const GRENZEN = {
  wohnungseigentum: { wfl_von: 50, wfl_bis: 120, we_mindestens: 3 },
  haus: { gsfl_von: 450, gsfl_bis: 1200 },
};

function klasseFuer(klassen, baujahr) {
  const bj = Number(baujahr);
  if (!(bj > 1500)) return -1;
  for (let i = 0; i < klassen.length; i++) {
    if (bj >= klassen[i].von && bj <= klassen[i].bis) return i;
  }
  return -1;
}

/**
 * Vergleichsfaktor für ein Objekt.
 *
 * Gibt bei Überschreitung der Anwendungsgrenzen KEINEN Wert zurück, sondern
 * den Grund. Ein Vergleichsfaktor außerhalb seines Geltungsbereichs ist kein
 * schlechterer Wert — er ist keiner.
 *
 * @param {object} o
 * @param {string} o.objektart
 * @param {string} o.gemeinde
 * @param {number} o.baujahr
 * @param {number} o.wohnflaeche_qm
 * @param {number} [o.wohneinheiten]
 * @param {number} [o.grundstuecksflaeche_qm]
 * @param {boolean} [o.erstverkauf]
 */
export function vergleichsfaktor({
  objektart, gemeinde, baujahr, wohnflaeche_qm, ags = null,
  wohneinheiten = null, grundstuecksflaeche_qm = null, erstverkauf = false,
}) {
  /* v1071-WZUS-1 · DIE ZUSTAENDIGKEITSPRUEFUNG, DIE HIER GEFEHLT HAT.
   *
   * Gemessen an Loehner Strasse 278, Hiddenhausen (Kreis Herford, AGS
   * 05758016): der Vergleichsfaktor 337.850 EUR aus Minden-Luebbecke stand
   * im Kunden-PDF unter "AMTLICHE WERTE DES GUTACHTERAUSSCHUSSES".
   *
   * Ursache war der Rueckfall weiter unten: ist die Gemeinde nicht in der
   * Tabelle, greift HAUS_TABELLE['_kreis'] — und das gilt fuer jeden Ort in
   * Deutschland, nicht nur fuer die zehn Gemeinden dieses Kreises.
   *
   * Ein Vergleichsfaktor ist an den Ausschuss gebunden, der ihn abgeleitet
   * hat (§ 10 ImmoWertV). Ohne AGS wird nicht mehr geraten: fehlt er, gilt
   * nur ein Treffer auf den Gemeindenamen, kein Kreis-Rueckfall. */
  const _kreis = String(ags || '').replace(/\D/g, '').slice(0, 5);
  if (ags && _kreis !== VF_STAND.ags_kreis) {
    return { verfuegbar: false, grund: 'anderer_ausschuss',
      hinweis: 'Für diesen Ort liegt kein Vergleichsfaktor vor. Vergleichsfaktoren '
        + 'gelten nur im Zuständigkeitsbereich des Gutachterausschusses, der sie '
        + 'abgeleitet hat; sie sind nicht auf andere Kreise übertragbar '
        + '(§ 10 ImmoWertV).' };
  }
  const _ohneAgs = !ags;
  const wfl = Number(wohnflaeche_qm);
  const gem = String(gemeinde || '').trim();
  const istWohnung = /etw|eigentumswohnung|wohnung|whg/i.test(String(objektart || ''));
  const istHaus = /efh|zfh|einfamilien|zweifamilien|haus/i.test(String(objektart || ''));

  if (!(wfl > 0) || !(Number(baujahr) > 1500)) {
    return { verfuegbar: false, grund: 'angaben_fehlen' };
  }

  const ausserhalb = [];

  if (istWohnung) {
    const G = GRENZEN.wohnungseigentum;
    /* Der Ausschuss schliesst Wohnungseigentum in Zweifamilienhaeusern
     * ausdruecklich aus: "Erfasst sind hier nur die typischen am Markt
     * gehandelten Eigentumswohnungen, also Wohnungen in Objekten mit mehr
     * als zwei Wohneinheiten." */
    const we = Number(wohneinheiten);
    if (we > 0 && we < G.we_mindestens) {
      ausserhalb.push(`Das Objekt hat ${we} Wohneinheiten. Der Gutachterausschuss wertet nur `
        + 'Eigentumswohnungen in Objekten mit mehr als zwei Wohneinheiten aus; Wohnungseigentum '
        + 'in Zweifamilienhäusern ist ausdrücklich ausgenommen.');
    }
    if (wfl < G.wfl_von || wfl > G.wfl_bis) {
      ausserhalb.push(`Die Auswertung umfasst Wohnungen von ${G.wfl_von} bis ${G.wfl_bis} m²; `
        + `das Objekt hat ${wfl} m².`);
    }

    const idx = erstverkauf ? 0 : klasseFuer(WE_KLASSEN, baujahr);
    if (idx < 0) return { verfuegbar: false, grund: 'baujahr_ausserhalb' };

    let reihe = WE_TABELLE[gem];
    let quelleGem = gem;
    /* v1071-WZUS-3 · "andere Gemeinden" heisst: andere Gemeinden DIESES
     * Kreises. Ohne AGS ist nicht belegt, dass das Objekt dazugehoert. */
    if ((!reihe || reihe[idx] == null) && !_ohneAgs) { reihe = WE_TABELLE['_andere']; quelleGem = 'andere Gemeinden'; }
    if ((!reihe || reihe[idx] == null) && !_ohneAgs) { reihe = WE_TABELLE['_kreis']; quelleGem = 'Kreis (ohne Stadt Minden)'; }
    const wert = reihe ? reihe[idx] : null;
    if (wert == null) return { verfuegbar: false, grund: 'keine_angabe',
      hinweis: 'Der Gutachterausschuss weist für diese Kombination aus Gemeinde und '
        + 'Baujahresklasse keinen Wert aus.' };

    return bauErgebnis(wert, wfl, WE_KLASSEN[idx].name, quelleGem, ausserhalb,
      'Wohnungseigentum', 'Abschnitt 6.1.2');
  }

  if (istHaus) {
    const G = GRENZEN.haus;
    const gsfl = Number(grundstuecksflaeche_qm);
    if (gsfl > 0 && (gsfl < G.gsfl_von || gsfl > G.gsfl_bis)) {
      ausserhalb.push('Die Auswertung umfasst Grundstücke von '
        + G.gsfl_von.toLocaleString('de-DE') + ' bis ' + G.gsfl_bis.toLocaleString('de-DE')
        + ' m²; das Objekt hat ' + gsfl.toLocaleString('de-DE') + ' m².');
    }
    const idx = klasseFuer(HAUS_KLASSEN, baujahr);
    if (idx < 0) return { verfuegbar: false, grund: 'baujahr_ausserhalb' };

    let reihe = HAUS_TABELLE[gem];
    let quelleGem = gem;
    /* v1071-WZUS-2 · Ohne AGS kein Kreis-Rueckfall. Er war der Weg, auf dem
     * ein Haus in Hiddenhausen den Faktor von Minden-Luebbecke bekam. */
    if ((!reihe || reihe[idx] == null) && !_ohneAgs) {
      reihe = HAUS_TABELLE['_kreis']; quelleGem = 'Kreis (ohne Stadt Minden)';
    }
    const wert = reihe ? reihe[idx] : null;
    if (wert == null) return { verfuegbar: false, grund: 'keine_angabe' };

    return bauErgebnis(wert, wfl, HAUS_KLASSEN[idx].name, quelleGem, ausserhalb,
      'Ein- und Zweifamilienhäuser', 'Abschnitt 5.1.2');
  }

  return { verfuegbar: false, grund: 'objektart_ohne_tabelle' };
}

function bauErgebnis(faktor, wfl, klasse, gemeinde, ausserhalb, teilmarkt, abschnitt) {
  const wert = Math.round(faktor * wfl);
  return {
    verfuegbar: true,
    /* Ausserhalb der Anwendungsgrenzen wird der Wert AUSGEWIESEN, aber er
     * fuehrt nicht. Dieselbe Regel wie bei der Mietpreisuebersicht: wo die
     * Quelle endet, endet die Rechnung. */
    fuehrend: ausserhalb.length === 0,
    ausserhalb_grenzen: ausserhalb.length > 0,
    ausserhalb_gruende: ausserhalb,
    faktor_qm: faktor,
    wert_eur: wert,
    baujahresklasse: klasse,
    gemeinde_quelle: gemeinde,
    teilmarkt,
    rechnung: `${wfl} m² × ${faktor.toLocaleString('de-DE')} €/m² = ${wert.toLocaleString('de-DE')} €`,
    quelle: `${VF_STAND.bericht}, ${abschnitt}`,
    ausschuss: VF_STAND.ausschuss,
    rechtsgrundlage: VF_STAND.rechtsgrundlage,
    hinweis: ausserhalb.length
      ? 'Der Vergleichsfaktor des Gutachterausschusses liegt vor, das Objekt fällt aber aus '
        + 'seinem Anwendungsbereich: ' + ausserhalb.join(' ')
        + ' Der Wert dient deshalb als Orientierung, nicht als Vergleichswert des Objekts.'
      : 'Vergleichsfaktor für bebaute Grundstücke nach § 20 ImmoWertV, abgeleitet aus der '
        + 'Kaufpreissammlung des Gutachterausschusses. Anders als Angebotspreise beruht er auf '
        + 'beurkundeten Kaufpreisen (§ 25 ImmoWertV). Abweichungen der qualitativen Merkmale '
        + 'sind mit Zu- oder Abschlägen zu berücksichtigen.',
  };
}
