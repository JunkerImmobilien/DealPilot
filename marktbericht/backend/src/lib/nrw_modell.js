// nrw_modell.js — Das Ertragswertmodell der AGVGA.NRW.
// ────────────────────────────────────────────────────────────────────────────
// Quelle: "Modell zur Ableitung von Liegenschaftszinssaetzen",
// Arbeitsgemeinschaft der Vorsitzenden der Gutachterausschuesse fuer
// Grundstueckswerte in Nordrhein-Westfalen, Stand 21. Juni 2016.
//
// WARUM DAS EIN EIGENES MODUL IST
// Die NRW-Liegenschaftszinssaetze werden NICHT nach Anlage 3 ImmoWertV
// abgeleitet, sondern nach diesem Modell. Es hat andere Ansaetze:
//
//                        ImmoWertV Anlage 3      AGVGA.NRW
//   Verwaltung ETW       275 (Basis) / 357 (21)  275 (Basis) / 335 (2015)
//   Instandhaltung       9,00 / 11,70 EUR/m2     9,00 / 11,00 EUR/m2
//   Garage Instandh.     68 / 88 EUR             65 EUR
//   Stellplatz Instandh. (nicht getrennt)        25 EUR
//   Carport              (nicht getrennt)        40 EUR
//
// Das Modell sagt dazu ausdruecklich: "Die Verwendung der abgeleiteten
// Liegenschaftszinssaetze bedingt eine modellkonforme Ertragswertermittlung."
// Wer einen NRW-Zinssatz mit den Bewirtschaftungskosten der ImmoWertV
// kombiniert, verlaesst das Modell — und bekommt ein Ergebnis, das amtlich
// aussieht und es nicht ist (Paragraf 10 ImmoWertV).

/* Ausgangswerte zum 01.01.2002, wie im Modell (Anlage 3) angegeben.
 * Von hier aus wird mit dem Verbraucherpreisindex fortgeschrieben. */
export const AGVGA_2002 = {
  verwaltung_je_wohnung_eur: 230,
  verwaltung_je_etw_eur: 275,
  verwaltung_je_stellplatz_eur: 30,
  instandhaltung_je_qm_eur: 9,
  /* Fuer Garage, Carport und Stellplatz nennt das Modell nur die Werte zum
   * Stichtag 2015, keine 2002er Ausgangswerte. Sie werden deshalb NICHT
   * zurueckgerechnet — eine Ableitung waere geraten. */
};

/* Belegte Staende. Nur was im Modelltext steht, kommt hier hinein.
 * Die Fortschreibung auf spaetere Stichtage braucht den Verbraucherpreis-
 * index; fehlt er, wird der letzte belegte Stand verwendet und im Bericht
 * als solcher benannt. Lieber ein sichtbar veralteter Ansatz als ein
 * erfundener aktueller. */
export const AGVGA_STAENDE = {
  2015: {
    stand: '2015-01-01',
    beleg: 'AGVGA.NRW, Modell zur Ableitung von Liegenschaftszinssaetzen, Stand 21.06.2016, Anlage 3',
    verwaltung_je_wohnung_eur: 280,
    verwaltung_je_etw_eur: 335,
    verwaltung_je_stellplatz_eur: 37,
    instandhaltung_je_qm_eur: 11,
    instandhaltung_je_garage_eur: 65,
    instandhaltung_je_carport_eur: 40,
    instandhaltung_je_stellplatz_eur: 25,
    mietausfall_pct: 2,
  },
};

/* Verbraucherpreisindex Deutschland, Oktober, Basis 2010 = 100.
 * NUR belegte Werte. Beide stehen woertlich in der Beispielrechnung des
 * Modells (Anlage 3, Seite 23). Weitere Jahre gehoeren hier ergaenzt, sobald
 * sie beim Statistischen Bundesamt nachgeschlagen wurden — nicht geschaetzt.
 * Ein geschaetzter Index waere schlimmer als ein fehlender: er sieht aus
 * wie eine Fortschreibung. */
export const VPI_OKTOBER = {
  2001: 87.5,
  2014: 106.7,
  /* v1058-WVPI-1 · Oktober 2025 = 123, belegt aus einem Verkehrswert-
   * gutachten vom 04.03.2026, das die Fortschreibung nach Anlage 3
   * ausdruecklich vorrechnet.
   *
   * ACHTUNG, ZWEI BASEN: dieses Gutachten rechnet gegen Oktober 2001 = 77,1
   * (ImmoWertV Anlage 3), dieses Modell gegen 87,5 (AGVGA.NRW). Dasselbe
   * Datum, zwei Indexstaende — die Verordnung nutzt eine andere
   * Reihenbasis. Der Index 123 gehoert zur 77,1er-Reihe.
   *
   * Umgerechnet auf die NRW-Basis: 123 x (87,5 / 77,1) = 139,6. Nur so
   * bleiben die im Modell nachgerechneten Werte fuer 2015 gueltig
   * (230 x 106,7/87,5 = 280). Wer die 123 direkt gegen 87,5 rechnet,
   * verliert zwoelf Prozent. */
  2025: 139.6,
};

/* Dieselbe Reihe auf der Basis der ImmoWertV Anlage 3 (Oktober 2001 = 77,1).
 * Getrennt gehalten, damit niemand die beiden Basen mischt. */
export const VPI_OKTOBER_IMMOWERTV = {
  2001: 77.1,
  2025: 123,
};

/**
 * Bewirtschaftungskosten nach dem NRW-Modell.
 *
 * @param {object} o
 * @param {number} o.rohertrag_eur
 * @param {number} o.wohnflaeche_qm
 * @param {boolean} o.ist_eigentumswohnung
 * @param {number} [o.wohneinheiten]
 * @param {number} [o.garagen]
 * @param {number} [o.carports]
 * @param {number} [o.stellplaetze]
 * @param {number} [o.stichtag_jahr]
 */
export function bewirtschaftungskosten({
  rohertrag_eur, wohnflaeche_qm, ist_eigentumswohnung,
  wohneinheiten = 1, garagen = 0, carports = 0, stellplaetze = 0,
  stichtag_jahr = null,
}) {
  const roh = Number(rohertrag_eur) || 0;
  const wfl = Number(wohnflaeche_qm) || 0;
  if (roh <= 0 || wfl <= 0) return null;

  const jahr = Number(stichtag_jahr) || new Date().getFullYear();
  const m = AGVGA_STAENDE[2015];

  /* Fortschreibung nur, wenn der Index fuer das Vorjahr des Stichtags
   * wirklich vorliegt. Sonst bleibt es beim belegten Stand — sichtbar. */
  const idxBasis = VPI_OKTOBER[2001];
  const idxZiel = VPI_OKTOBER[jahr - 1];
  const fortgeschrieben = !!(idxBasis && idxZiel);
  const f = fortgeschrieben ? idxZiel / idxBasis : null;

  /* Verwaltung und Instandhaltung je m2 lassen sich aus 2002 fortschreiben,
   * die Stellplatz-Instandhaltungen nicht — fuer sie gibt es keinen
   * 2002er Ausgangswert im Modell. */
  const rd0 = (x) => Math.round(x);
  const rd1 = (x) => Math.round(x * 10) / 10;

  const vETW = fortgeschrieben ? rd0(AGVGA_2002.verwaltung_je_etw_eur * f) : m.verwaltung_je_etw_eur;
  const vWhg = fortgeschrieben ? rd0(AGVGA_2002.verwaltung_je_wohnung_eur * f) : m.verwaltung_je_wohnung_eur;
  const vSP = fortgeschrieben ? rd0(AGVGA_2002.verwaltung_je_stellplatz_eur * f) : m.verwaltung_je_stellplatz_eur;
  const iQm = fortgeschrieben ? rd1(AGVGA_2002.instandhaltung_je_qm_eur * f) : m.instandhaltung_je_qm_eur;

  const plaetze = (Number(garagen) || 0) + (Number(carports) || 0) + (Number(stellplaetze) || 0);
  const we = Math.max(1, Number(wohneinheiten) || 1);

  const verwaltung = (ist_eigentumswohnung ? vETW : vWhg * we) + vSP * plaetze;
  const instandhaltung = wfl * iQm
    + (Number(garagen) || 0) * m.instandhaltung_je_garage_eur
    + (Number(carports) || 0) * m.instandhaltung_je_carport_eur
    + (Number(stellplaetze) || 0) * m.instandhaltung_je_stellplatz_eur;
  const mietausfall = roh * m.mietausfall_pct / 100;

  const summe = verwaltung + instandhaltung + mietausfall;
  return {
    summe_eur: Math.round(summe),
    anteil_pct: Math.round(summe / roh * 1000) / 10,
    posten: [
      { pos: `Verwaltung (${ist_eigentumswohnung ? '1 ETW × ' + vETW : we + ' WE × ' + vWhg} €`
             + (plaetze ? ` + ${plaetze} Stellpl. × ${vSP} €` : '') + ')', wert: Math.round(verwaltung) },
      { pos: `Instandhaltung (${wfl} m² × ${String(iQm).replace('.', ',')} €`
             + (plaetze ? ' + Stellplätze' : '') + ')', wert: Math.round(instandhaltung) },
      { pos: `Mietausfallwagnis (${m.mietausfall_pct} % vom Rohertrag)`, wert: Math.round(mietausfall) },
    ],
    modell: 'agvga_nrw',
    stand: fortgeschrieben ? `${jahr - 1} (fortgeschrieben)` : m.stand,
    fortgeschrieben,
    hinweis: fortgeschrieben
      ? `Bewirtschaftungskosten nach dem Ertragswertmodell der AGVGA.NRW, fortgeschrieben mit dem Verbraucherpreisindex auf Oktober ${jahr - 1}.`
      : 'Bewirtschaftungskosten nach dem Ertragswertmodell der AGVGA.NRW, Stand 01.01.2015. '
        + 'Die im Modell vorgesehene Fortschreibung mit dem Verbraucherpreisindex konnte nicht '
        + 'vorgenommen werden, weil der Index für das Stichtagsjahr nicht hinterlegt ist — der Ansatz '
        + 'ist damit zu niedrig und der Ertragswert eher zu hoch.',
    beleg: m.beleg,
  };
}

/* Anlage 2 des NRW-Modells: modifizierte Restnutzungsdauer, GND 80 Jahre.
 * Zeilen = Gebaeudealter, Spalten = Modernisierungsgrad in Punkten.
 * Zwischen beiden Achsen ist zu interpolieren (so schreibt es das Modell vor). */
const RND_PUNKTE = [1, 4, 8, 13, 18];
const RND_80 = {
  0: [80, 80, 80, 80, 80], 5: [75, 75, 75, 75, 75], 10: [70, 70, 70, 70, 71],
  15: [65, 65, 65, 66, 69], 20: [60, 60, 61, 63, 68], 25: [55, 55, 56, 60, 66],
  30: [50, 50, 53, 58, 64], 35: [45, 45, 49, 56, 63], 40: [40, 41, 46, 53, 62],
  45: [35, 37, 43, 52, 61], 50: [30, 33, 41, 50, 60], 55: [25, 30, 38, 48, 59],
  60: [21, 27, 37, 47, 58], 65: [17, 25, 35, 46, 57], 70: [15, 23, 34, 45, 57],
  75: [13, 22, 33, 44, 56], 80: [12, 21, 32, 44, 56],
};

function interp(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

/**
 * Restnutzungsdauer nach der Tabelle des NRW-Modells (GND 80).
 * Gibt null zurueck, wenn die Gesamtnutzungsdauer nicht 80 Jahre betraegt —
 * das Modell fuehrt eigene Tabellen fuer 70, 60, 50 und 40 Jahre, die hier
 * noch nicht hinterlegt sind. Lieber keine Antwort als die falsche Tabelle.
 */
export function restnutzungsdauerNrw({ gnd, alter, punkte }) {
  if (Number(gnd) !== 80) return null;
  const a = Math.max(0, Math.min(80, Number(alter)));
  const p = Math.max(0, Math.min(20, Number(punkte)));
  if (!Number.isFinite(a) || !Number.isFinite(p)) return null;

  const alterStufen = Object.keys(RND_80).map(Number).sort((x, y) => x - y);
  let a0 = alterStufen[0], a1 = alterStufen[alterStufen.length - 1];
  for (let i = 0; i < alterStufen.length - 1; i++) {
    if (a >= alterStufen[i] && a <= alterStufen[i + 1]) { a0 = alterStufen[i]; a1 = alterStufen[i + 1]; break; }
  }

  const zeile = (alt) => {
    const r = RND_80[alt];
    if (p <= RND_PUNKTE[0]) return r[0];
    if (p >= RND_PUNKTE[4]) return r[4];
    for (let i = 0; i < RND_PUNKTE.length - 1; i++) {
      if (p >= RND_PUNKTE[i] && p <= RND_PUNKTE[i + 1]) {
        return interp(p, RND_PUNKTE[i], RND_PUNKTE[i + 1], r[i], r[i + 1]);
      }
    }
    return r[0];
  };

  const rnd = interp(a, a0, a1, zeile(a0), zeile(a1));
  return {
    rnd: Math.round(rnd * 10) / 10,
    modell: 'agvga_nrw',
    punkte: p,
    hinweis: 'Restnutzungsdauer nach Anlage 2 des Ertragswertmodells der AGVGA.NRW, '
      + 'interpoliert nach Alter und Modernisierungsgrad.',
  };
}

/* Ab welcher relativen Streuung ein amtlicher Zinssatz nicht mehr als
 * kreisscharf belastbar gelten kann.
 *
 * Der Anlass: Kreis Minden-Luebbecke, Eigentumswohnungen, 2,2 % bei einer
 * Standardabweichung von 1,1 — also fuenfzig Prozent. Der Ausschuss sagt
 * damit selbst, dass der Zinssatz zwischen 1,1 und 3,3 Prozent liegt. Fuer
 * ein 165-m2-Objekt sind das 313.000 bis 503.000 Euro Ertragswert.
 *
 * Ein solcher Wert als einzelne Zahl mit Stufe-A-Siegel verspricht mehr, als
 * er halten kann. Das Modell selbst weist darauf hin, dass die Mittelwerte
 * "regelmaessig betraechtliche Standardabweichungen aufweisen" und weitere
 * Merkmale Einfluss haben. */
export const STREUUNG_SCHWELLE_PCT = Number(process.env.LZS_STREUUNG_SCHWELLE || 25);

/* v1083b-WSTU-1 · DIE RELATIVE SCHWELLE PASST NUR AUF GEWERBE.
 *
 * Gemessen an den Grundstuecksmarktdaten NRW, 471 Saetze mit Streuungsangabe
 * (12.08.2026): die Standardabweichung ist in ABSOLUTEN Prozentpunkten
 * ziemlich konstant — Median 1,1 Pp. Wo der Zinssatz klein ist, explodiert
 * die relative Quote, ohne dass die Datenlage schlechter waere:
 *
 *   handel   LZS-Median 5,6 %   relative Streuung  30 %
 *   mfh      LZS-Median 3,2 %   relative Streuung  37 %
 *   efh      LZS-Median 1,4 %   relative Streuung  55 %
 *   we_s     LZS-Median 1,8 %   relative Streuung  62 %
 *
 * Mit der 25-Prozent-Regel blieben 15 % aller Saetze auf Stufe A — die Regel
 * bestraft damit genau die Wohn-Teilmaerkte am haertesten, und zwar nicht
 * wegen schlechterer Daten, sondern weil ihr Zinssatz kleiner ist.
 *
 * Entscheidung Marcel (DESAG-Sachverstaendiger), 12.08.2026:
 * Wohnen absolut, Gewerbe relativ. Damit bleiben 81 % der Wohn-Saetze auf A.
 *
 * Der Anlassfall selbst: Minden-Luebbecke, Eigentumswohnungen 2,2 % +/- 1,1.
 * 1,1 Pp liegt UNTER 1,5 Pp — der Wert bleibt jetzt Stufe A. Die Spanne
 * 1,1 bis 3,3 % wird weiterhin ausgewiesen; sie verschwindet nicht, sie
 * entwertet den Wert nur nicht mehr. */
/* v1090-WSCH · 1,55 statt 1,5 — Marcels Festlegung vom 13.08.2026.
 *
 * Der Gutachterausschuss Osnabrueck-Meppen weist eine Standardabweichung von
 * EXAKT 1,5 Prozentpunkten aus und traf damit die alte Schwelle punktgenau.
 * An dieser Stelle widersprachen sich Prosa und Code:
 *
 *   Projektanweisung:  "Wohnen absolut, ab 1,5 Punkten"   (einschliessend)
 *   diese Datei:       stabw > STREUUNG_SCHWELLE_PP        (ausschliessend)
 *
 * Mit 1,55 ist die Frage gegenstandslos: 1,5 liegt eindeutig darunter und
 * bleibt Stufe A. Inhaltlich verschiebt sich nichts — betroffen waren nur
 * die Grenzfaelle, deren Stufe vorher vom Vergleichsoperator abhing statt
 * von einer Festlegung.
 *
 * EINE SCHWELLE, DIE GENAU AUF EINEM ABGEDRUCKTEN WERT SITZT, IST KEINE
 * SCHWELLE. Sie ist ein Muenzwurf mit dem Vergleichsoperator. */
export const STREUUNG_SCHWELLE_PP = Number(process.env.LZS_STREUUNG_SCHWELLE_PP || 1.55);

/** Teilmaerkte, fuer die die ABSOLUTE Schwelle gilt. Alles andere relativ. */
const WOHNEN = new Set([
  'efh', 'zfh', 'dhh', 'rh', 'rhdhh', 'dreifh', 'mfh', 'mfh_bis6', 'mfh_ueber6',
  'etw', 'we_s', 'we_v', 'wohnung',
]);

export function istWohnteilmarkt(objektart) {
  return WOHNEN.has(String(objektart || '').toLowerCase().trim());
}

/**
 * Stufe anhand der Streuung pruefen. A bleibt A, solange die relative
 * Standardabweichung unter der Schwelle liegt; darueber wird daraus B —
 * amtlich, aber als unsicher gekennzeichnet.
 */
export function stufeNachStreuung({ wert, wert_min, wert_max, qualitaet, objektart = null }) {
  if (qualitaet !== 'A') return { qualitaet, streuung_pct: null, herabgestuft: false };
  const w = Number(wert);
  /* v1048 · `Number(null)` ist 0, und 0 besteht Number.isFinite. Eine
   * fehlende Streuungsangabe waere damit als "Streuung 0 Prozent" durch-
   * gegangen — also als perfekt genauer Wert. Dieselbe Falle wie bei
   * _euro(null): der Fehlwert sieht aus wie ein gueltiges Ergebnis.
   * Deshalb zuerst auf Abwesenheit pruefen, dann erst rechnen. */
  const fehlt = (x) => x === null || x === undefined || x === '';
  if (fehlt(wert_min) || fehlt(wert_max)) {
    return { qualitaet, streuung_pct: null, herabgestuft: false };
  }
  const lo = Number(wert_min);
  const hi = Number(wert_max);
  if (!(w > 0) || !Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
    return { qualitaet, streuung_pct: null, herabgestuft: false };
  }
  /* v1083b-WSTU-2a · Auf eine Nachkommastelle runden. (3.3-1.1)/2 ergibt in
   * Fliesskomma 1.0999999999999999 — das stand sonst so im Bericht. */
  const stabw = Math.round((hi - lo) / 2 * 10) / 10;
  const rel = Math.round(stabw / w * 1000) / 10;

  /* v1083b-WSTU-2 · Massstab je Teilmarkt. Fehlt die Objektart, bleibt es
   * beim bisherigen relativen Verhalten — eine unbekannte Objektart darf
   * die Regel nicht stillschweigend lockern. */
  const absolut = istWohnteilmarkt(objektart);
  const drueber = absolut ? (stabw > STREUUNG_SCHWELLE_PP)
                          : (rel > STREUUNG_SCHWELLE_PCT);
  const massstab = absolut
    ? `${String(STREUUNG_SCHWELLE_PP).replace('.', ',')} Punkten`
    : `${STREUUNG_SCHWELLE_PCT} Prozent des Wertes`;

  if (!drueber) {
    return { qualitaet: 'A', streuung_pct: rel, streuung_pp: stabw,
             massstab: absolut ? 'absolut' : 'relativ', herabgestuft: false };
  }
  return {
    qualitaet: 'B',
    streuung_pct: rel,
    streuung_pp: stabw,
    massstab: absolut ? 'absolut' : 'relativ',
    herabgestuft: true,
    /* v1083b-WSTU-3 · Der Hinweis nennt jetzt den MASSSTAB, an dem gemessen
     * wurde. "Der Wert ist zu unsicher" ist keine Begruendung, solange
     * nicht dasteht, woran das gemessen wurde. */
    hinweis: `Der Gutachterausschuss gibt zu diesem Zinssatz eine Standardabweichung von `
      + `±${String(stabw.toFixed(1)).replace('.', ',')} Punkten an — bezogen auf den Mittelwert `
      + `sind das ${String(rel).replace('.', ',')} Prozent. Das liegt über dem hier angesetzten `
      + `Maßstab von ${massstab}. Der Wert ist amtlich und für das Gebiet des Ausschusses `
      + `ermittelt, als Mittelwert aber nicht objektscharf belastbar; er wird deshalb `
      + `herabgestuft und mit seiner Spanne ausgewiesen.`,
  };
}
