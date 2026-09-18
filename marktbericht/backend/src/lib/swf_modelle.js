// swf_modelle.js  (v1083-WMOD)
//
// ACHT AUSWERTER, EIN VERTRAG.
//
// Jeder Gutachterausschuss veroeffentlicht seine Sachwertfaktoren in eigener
// Struktur. Gemessen an 21 Berichten des Jahrgangs 2026 sind es nicht drei
// Formen, sondern neun — und die neun brauchen acht Auswerter, weil
// 'basiswert_additiv' (Bochum) und 'zuschlag_prozent' (Dortmund) nichts
// anderes sind als eine 'konstante' mit additiven Korrekturen.
//
//   matrix_interp      zwei stetige Achsen, Kreuzinterpolation
//                      Minden-Luebbecke · Herford · Hoexter · Kreis Paderborn
//   matrix_kategorial  x stetig, y kategorial                    Bielefeld
//   matrix_band        beide Achsen Baender, KEINE Interpolation Duesseldorf
//   stufen_1d          eine stetige Achse       Iserlohn · Maerkischer Kreis
//   potenz             Y = a * X^b            Luedenscheid · Rhein-Erft
//   linear_sachwert    liefert den WERT, nicht den Faktor   Stadt Paderborn
//   doppel_log         SF[%] = c + a*ln(F) + b*ln(X)        Kreis Lippe
//   konstante          ein Faktor je Objektart        Essen · Duisburg · Bochum
//
// EIN AUSWERTER, NICHT ZWEI. Das Erntewerkzeug schlaegt nur nach; gerechnet
// wird ausschliesslich hier. Eine Dublette in einer anderen Sprache laeuft
// frueher oder spaeter auseinander.
//
// DREI REGELN, DIE NICHT AUFGEWEICHT WERDEN:
//  1. Wo die Quelle endet, endet die Rechnung. Keine Extrapolation ueber die
//     Tabelle hinaus — mehrere Berichte untersagen sie ausdruecklich.
//  2. Eine leere Zelle ist kein Wert. Kein Nachbar, kein Mittelwert.
//  3. Jede Zahl traegt ihre Herkunft: Tabellenwert, jede Korrektur einzeln,
//     und die Rechenkette als Text.

/* ── Hilfsmittel ───────────────────────────────────────────────────────── */

const istZahl = (v) => typeof v === 'number' && Number.isFinite(v);

/** Number(null) ist 0 und besteht Number.isFinite. Erst auf Abwesenheit
 *  pruefen, dann rechnen. */
function zahl(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* === v1103-WRND - ZWEIMAL RUNDEN VERSCHIEBT DAS ERGEBNIS ==============
   GEMESSEN an Barnim: 566,13 * 500.000^-0,485 ergibt 0,97479. Die Form
   `potenz` rundete hart auf DREI Stellen (0,975), der Registerweg danach
   auf die zwei des Rezepts - und aus 0,975 wird 0,98. Der Bericht druckt
   an dieser Stelle 0,97 ab.

   Ein Cent auf hunderttausend Euro ist wenig; eine Zahl, die dem
   abgedruckten Wert widerspricht, ist viel. Sie laesst den Anwender
   zweifeln, ob die Maschine das Modell ueberhaupt richtig anwendet -
   und dieses Register lebt davon, dass sie es beweisbar tut.

   Deshalb rundet jede Form auf die Stelle, die das REZEPT nennt. Drei
   Stellen bleiben der Rueckfall fuer Rezepte, die nichts sagen. */
function gerundet(m, wert) {
  const st = (m && m.rundung_stellen != null) ? m.rundung_stellen : 3;
  const q = Math.pow(10, st);
  return Math.round(wert * q) / q;
}

/* === v1109-WSCHL - EIN SCHLUESSEL, DER NUMERISCH GEMEINT IST =========
   GEFUNDEN an Prignitz: seine Anpassungstabelle fuer Reihenhaeuser fuehrt
   die Standardstufen als "1.4", "1.6", "1.8", "2.0", "2.2" ... Der
   Auswerter sortiert sie ueber Number() und greift danach mit
   String(2) zu - und "2" ist nicht "2.0". Der abgedruckte Wert lag da
   und war unerreichbar; heraus kam `korrektur_unplausibel`.

   Beim Einfamilienhaus-Satz desselben Berichts fiel es nicht auf, weil
   dort "2" steht. Ein Rezept ist aber keine Programmiersprache: wer eine
   Stufe 2,0 abdruckt, schreibt sie auch so hin.

   Dieser Zugriff sucht ueber den ZAHLENWERT, nicht ueber die
   Schreibweise. "2", "2.0" und "2.00" sind damit derselbe Schluessel. */
function beiZahl(tabelle, zahlwert) {
  if (!tabelle || zahlwert == null) return undefined;
  const direkt = tabelle[String(zahlwert)];
  if (direkt !== undefined) return direkt;
  for (const k of Object.keys(tabelle)) {
    if (Number(k) === Number(zahlwert)) return tabelle[k];
  }
  return undefined;
}

function nichts(grund, hinweis) {


  return { verfuegbar: false, wert: null, grund, hinweis, korrekturen: [] };
}

/** Lineare Interpolation zwischen zwei Stuetzstellen. */
function zwischen(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
}

/**
 * Zwei benachbarte Stuetzstellen einer sortierten Achse.
 * Ausserhalb der Achse: null — das ist die Extrapolationssperre.
 */
function nachbarn(achse, x) {
  if (!Array.isArray(achse) || !achse.length) return null;
  const a = [...achse].sort((p, q) => p - q);
  if (x < a[0] || x > a[a.length - 1]) return null;
  for (let i = 0; i < a.length - 1; i++) {
    if (x >= a[i] && x <= a[i + 1]) return [a[i], a[i + 1]];
  }
  return [a[a.length - 1], a[a.length - 1]];
}

/** Zellenzugriff. Die Schluessel sind Strings, auch wenn die Achse Zahlen fuehrt. */
function zelle(zellen, y, x_index) {
  const reihe = zellen[String(y)] ?? zellen[y];
  if (!Array.isArray(reihe)) return null;
  const v = reihe[x_index];
  return istZahl(v) ? v : null;      // null, '-', undefined = leere Zelle
}

/* ── Die acht Auswerter ────────────────────────────────────────────────── */

/** matrix_interp — zwei stetige Achsen, Kreuzinterpolation. */
function matrixInterp(m, e) {
  const x = zahl(e[m.achse_x_feld]); const y = zahl(e[m.achse_y_feld]);
  if (x === null) return nichts('achse_x_fehlt', `${m.achse_x_bez} nicht erfasst.`);
  if (y === null) return nichts('achse_y_fehlt', `${m.achse_y_bez} nicht erfasst.`);
  const nx = nachbarn(m.achse_x, x); const ny = nachbarn(m.achse_y, y);
  if (!nx || !ny) {
    return nichts('ausserhalb_der_tabelle',
      `Der Wert liegt ausserhalb der veroeffentlichten Tabelle `
      + `(${m.achse_y_bez} ${Math.min(...m.achse_y)} bis ${Math.max(...m.achse_y)}, `
      + `${m.achse_x_bez} ${Math.min(...m.achse_x)} bis ${Math.max(...m.achse_x)}). `
      + `Der Gutachterausschuss hat dort nichts abgeleitet; extrapoliert wird nicht.`);
  }
  const ax = [...m.achse_x].sort((p, q) => p - q);
  const i0 = ax.indexOf(nx[0]); const i1 = ax.indexOf(nx[1]);
  /* ═══ v1098g-WEXA · EIN EXAKTER TREFFER BRAUCHT KEINE NACHBARN ═══════
     GEMESSEN an Wolfenbuettel: der Bericht druckt fuer Bodenrichtwert 40
     und 100.000 Euro Sachwert den Wert 1,33 ab. Der Auswerter gab
     `zelle_leer` — weil er VIER Zellen holt und die Nachbarkurve (Band
     130) bei 100.000 Euro leer ist. Der abgedruckte Wert war damit
     unerreichbar, obwohl er dasteht.

     Liegt die Anfrage GENAU auf beiden Stuetzstellen, ist nichts zu
     interpolieren: die Zelle IST die Antwort. Das aendert an keinem
     bestehenden Fall etwas — bei einem exakten Treffer liefert die
     Interpolation denselben Wert, sie scheitert nur, wenn ein Nachbar
     fehlt, den sie gar nicht braucht.

     Die Regel bleibt unangetastet: eine LEERE Zelle wird weiterhin nicht
     durch einen Nachbarwert ersetzt. Hier ist die Zelle nicht leer. */
  const exaktX = ax.includes(x);
  const exaktY = (m.achse_y || []).includes(y);
  if (exaktX && exaktY) {
    const direkt = zelle(m.zellen, y, ax.indexOf(x));
    if (direkt !== null) {
      return { verfuegbar: true, wert: gerundet(m, direkt),
               tabellenwert: gerundet(m, direkt), korrekturen: [],
               stuetzstellen: { x: [x, x], y: [y, y] } };
    }
  }

  const c = [zelle(m.zellen, ny[0], i0), zelle(m.zellen, ny[0], i1),
             zelle(m.zellen, ny[1], i0), zelle(m.zellen, ny[1], i1)];
  if (c.some((v) => v === null)) {

    return nichts('zelle_leer',
      'Fuer diese Kombination fuehrt der Bericht keinen Wert. '
      + 'Eine leere Zelle wird nicht durch einen Nachbarwert ersetzt.');
  }
  const oben  = zwischen(x, nx[0], nx[1], c[0], c[1]);
  const unten = zwischen(x, nx[0], nx[1], c[2], c[3]);
  const wert  = zwischen(y, ny[0], ny[1], oben, unten);
  return { verfuegbar: true, wert: gerundet(m, wert),
           tabellenwert: gerundet(m, wert), korrekturen: [],
           stuetzstellen: { x: nx, y: ny } };
}

/** matrix_kategorial — x stetig, y kategorial (Wohnlage, Rheinseite …). */
function matrixKategorial(m, e) {
  const x = zahl(e[m.achse_x_feld]);
  const kk = kategorieAus(m, e);              /* v1085-WZUO */
  const k = kk.wert;
  if (x === null) return nichts('achse_x_fehlt', `${m.achse_x_bez} nicht erfasst.`);
  if (!k && kk.bekannt_aber_ohne_wert) {
    return nichts('gebiet_ohne_wert',
      `Fuer dieses Gebiet fuehrt der Bericht keinen Wert. `
      + `Ein Wert eines anderen Gebiets wird nicht uebertragen.`);
  }
  if (!k) return nichts('kategorie_fehlt', `${m.achse_k_bez} nicht erfasst.`);
  const idx = m.kategorien.findIndex((c) => String(c).toLowerCase() === k);
  if (idx < 0) {
    return nichts('kategorie_unbekannt',
      `Der Bericht fuehrt nur ${m.kategorien.join(', ')}.`);
  }
  // Nur Stuetzstellen verwenden, die in DIESER Spalte belegt sind. Bielefeld
  // fuehrt 'sehr gut' erst ab 400.000 — der Bereich darunter ist kein Wert.
  const belegt = m.achse_x.filter((v) => zelle(m.zellen, v, idx) !== null);
  const n = nachbarn(belegt, x);
  if (!n) {
    return nichts('ausserhalb_der_tabelle',
      `Fuer ${m.kategorien[idx]} fuehrt der Bericht Werte von `
      + `${Math.min(...belegt)} bis ${Math.max(...belegt)}; extrapoliert wird nicht.`);
  }
  const wert = zwischen(x, n[0], n[1],
                        zelle(m.zellen, n[0], idx), zelle(m.zellen, n[1], idx));
  return { verfuegbar: true, wert: gerundet(m, wert),
           tabellenwert: gerundet(m, wert), korrekturen: [],
           kategorie: m.kategorien[idx] };
}

/** matrix_band — beide Achsen sind Baender. NICHT interpolieren. */
function matrixBand(m, e) {
  const x = zahl(e[m.achse_x_feld]);
  const y = e[m.achse_y_feld];
  if (x === null) return nichts('achse_x_fehlt', `${m.achse_x_bez} nicht erfasst.`);
  const ix = m.baender_x.findIndex((b) => x >= b.von && x <= b.bis);
  if (ix < 0) {
    return nichts('ausserhalb_der_tabelle',
      `${m.achse_x_bez} liegt ausserhalb der Baender des Berichts.`);
  }
  const yk = String(y ?? '').toLowerCase().trim();
  const yz = zahl(y);
  const iy = m.baender_y.findIndex((b) => (b.schluessel
      ? String(b.schluessel).toLowerCase() === yk
      : (yz !== null && yz >= b.von && yz <= b.bis)));
  if (iy < 0) return nichts('achse_y_fehlt', `${m.achse_y_bez} nicht zuzuordnen.`);
  const v = zelle(m.zellen, m.baender_x[ix].schluessel ?? ix, iy);
  if (v === null) {
    return nichts('zelle_leer',
      'Fuer diese Kombination von Baendern fuehrt der Bericht keinen Wert.');
  }
  return { verfuegbar: true, wert: v, tabellenwert: v, korrekturen: [],
           band_x: m.baender_x[ix].bez, band_y: m.baender_y[iy].bez };
}

/** stufen_1d — eine stetige Achse, zwischen den Stufen wird interpoliert. */
function stufen1d(m, e) {
  const x = zahl(e[m.achse_feld]);
  if (x === null) return nichts('achse_fehlt', `${m.achse_bez} nicht erfasst.`);
  const stufen = Object.keys(m.stufen).map(Number).sort((p, q) => p - q);
  const n = nachbarn(stufen, x);
  if (!n) {
    return nichts('ausserhalb_der_tabelle',
      `Der Bericht fuehrt ${m.achse_bez} von ${stufen[0]} bis `
      + `${stufen[stufen.length - 1]}; extrapoliert wird nicht.`);
  }
  const wert = zwischen(x, n[0], n[1], beiZahl(m.stufen, n[0]), beiZahl(m.stufen, n[1]));
  return { verfuegbar: true, wert: gerundet(m, wert),
           tabellenwert: gerundet(m, wert), korrekturen: [] };
}

/** potenz — Y = a * X^b. Der Geltungsbereich ist Pflicht. */
function potenz(m, e) {
  const x = zahl(e[m.achse_feld]);
  if (x === null) return nichts('achse_fehlt', `${m.achse_bez} nicht erfasst.`);
  if (m.gueltig_von != null && x < m.gueltig_von)
    return nichts('ausserhalb_der_stichprobe', `Unterhalb der Stichprobe (${m.gueltig_von}).`);
  if (m.gueltig_bis != null && x > m.gueltig_bis)
    return nichts('ausserhalb_der_stichprobe', `Oberhalb der Stichprobe (${m.gueltig_bis}).`);
  const wert = m.a * Math.pow(x * (m.x_faktor ?? 1), m.b);
  return { verfuegbar: true, wert: gerundet(m, wert),
           tabellenwert: gerundet(m, wert), korrekturen: [],
           formel: `${m.a} * (${m.achse_bez}${m.x_faktor ? ' * ' + m.x_faktor : ''})^${m.b}` };
}

/** linear_sachwert — liefert den WERT in Euro, nicht den Faktor. */
function linearSachwert(m, e) {
  const x = zahl(e[m.achse_feld]);
  if (x === null) return nichts('achse_fehlt', `${m.achse_bez} nicht erfasst.`);
  if (m.gueltig_von != null && x < m.gueltig_von)
    return nichts('ausserhalb_der_stichprobe',
      `Die Stichprobe reicht von ${m.gueltig_von} bis ${m.gueltig_bis} Euro. `
      + `Der Bericht untersagt die Extrapolation ausdruecklich.`);
  if (m.gueltig_bis != null && x > m.gueltig_bis)
    return nichts('ausserhalb_der_stichprobe',
      `Die Stichprobe reicht von ${m.gueltig_von} bis ${m.gueltig_bis} Euro. `
      + `Der Bericht untersagt die Extrapolation ausdruecklich.`);
  const wert = m.a * x + m.b;
  return { verfuegbar: true, liefert: 'wert_eur',
           wert: Math.round(wert), tabellenwert: Math.round(wert),
           faktor_rechnerisch: Math.round((wert / x) * 1000) / 1000,
           korrekturen: [], formel: `${m.a} * vSW + ${m.b}` };
}

/** doppel_log — SF[%] = c + a*ln(F) + b*ln(X). Ergebnis in Prozent. */
function doppelLog(m, e) {
  const f = zahl(e[m.feld_1]); const x = zahl(e[m.feld_2]);
  if (f === null) return nichts('achse_fehlt', `${m.bez_1} nicht erfasst.`);
  if (x === null) return nichts('achse_fehlt', `${m.bez_2} nicht erfasst.`);
  for (const [v, g, bez] of [[f, m.gueltig_1, m.bez_1], [x, m.gueltig_2, m.bez_2]]) {
    if (Array.isArray(g) && (v < g[0] || v > g[1])) {
      return nichts('ausserhalb_der_stichprobe',
        `${bez} liegt ausserhalb der Datenspanne ${g[0]} bis ${g[1]}.`);
    }
  }
  const pct = m.c + m.a * Math.log(f) + m.b * Math.log(x);
  return { verfuegbar: true, wert: Math.round(pct / 100 * 10000) / 10000,
           prozent: Math.round(pct * 100) / 100, tabellenwert: Math.round(pct * 100) / 100,
           einheit: 'prozent', korrekturen: [],
           formel: `${m.c} + ${m.a}*ln(${m.bez_1}) + ${m.b}*ln(${m.bez_2})` };
}

/** v1088-WKAT · stufen_kategorial — eine reine Nachschlagetabelle.
 *
 * Sachsen-Anhalt fuehrt seinen Liegenschaftszinssatz je Stadt bzw.
 * Regionstyp. Es gibt KEINE stetige Achse und deshalb auch nichts zu
 * interpolieren — der Bericht rundet ausdruecklich auf halbe Prozentpunkte
 * und ermittelt sachverstaendig. Ein Zwischenwert waere eine Erfindung.
 *
 * Der Unterschied zu matrix_kategorial: dort gibt es zusaetzlich eine
 * stetige x-Achse. Hier ist die Kategorie alles. */
function stufenKategorial(m, e) {
  const kk = kategorieAus(m, e);
  const k = kk.wert;
  if (!k && kk.bekannt_aber_ohne_wert) {
    return nichts('gebiet_ohne_wert',
      'Fuer dieses Gebiet fuehrt der Bericht keinen Wert. Ein Wert eines '
      + 'anderen Gebiets wird nicht uebertragen.');
  }
  if (!k) return nichts('kategorie_fehlt', `${m.achse_k_bez} nicht erfasst.`);

  /* Der Schluesselvergleich laeuft ueber die Kleinschreibung, damit
   * "Halle" und "halle" dasselbe treffen — die Schreibweise im Bericht
   * ist keine Aussage ueber das Gebiet. */
  const tab = m.stufen || {};
  let treffer = tab[k];
  if (treffer === undefined) {
    const gefunden = Object.keys(tab)
      .find((x) => String(x).toLowerCase().trim() === k);
    if (gefunden !== undefined) treffer = tab[gefunden];
  }
  if (!istZahl(treffer)) {
    return nichts('kategorie_unbekannt',
      `Der Bericht fuehrt ${Object.keys(tab).length} Eintraege; `
      + `"${k}" ist keiner davon.`);
  }
  return { verfuegbar: true, wert: treffer, tabellenwert: treffer,
           korrekturen: [], kategorie: k };
}

/** v1088-WREG · regression_additiv — mehrgliedrige Regression.
 *
 *   wert = intercept + SUMME( koeffizient * feld ^ exponent )
 *                    + SUMME( diskrete Zuschlaege )
 *
 * Halle veroeffentlicht seinen Sachwertfaktor so, und mit ihm der groesste
 * Teil Ost- und Sueddeutschlands. Wo NRW Matrizen druckt, drucken sie
 * Gleichungen.
 *
 * DREI REGELN, DIE AUCH HIER GELTEN:
 *  1. Fehlt ein Feld eines Terms, gibt es KEINEN Wert. Einen Term
 *     wegzulassen hiesse, gegen ein anderes Modell zu rechnen — die
 *     Gleichung ist als Ganzes abgeleitet worden.
 *  2. Der Geltungsbereich ist Pflicht, wo die Quelle einen nennt.
 *     Extrapolation ueber die Stichprobe hinaus ist keine Rechnung.
 *  3. Jeder Term erscheint einzeln im Rechenweg. */
function regressionAdditiv(m, e) {
  const teile = [];
  let summe = zahl(m.intercept) ?? 0;
  teile.push(`${summe}`);

  for (const t of (m.terme || [])) {
    const x = zahl(e[t.feld]);
    if (x === null) {
      return nichts('feld_fehlt',
        `${t.bez || t.feld} ist nicht erfasst. Die Gleichung ist als Ganzes `
        + `abgeleitet; ein weggelassener Term waere ein anderes Modell.`);
    }
    if (Array.isArray(t.gueltig) && (x < t.gueltig[0] || x > t.gueltig[1])) {
      return nichts('ausserhalb_der_stichprobe',
        `${t.bez || t.feld} liegt ausserhalb der Datenspanne `
        + `${t.gueltig[0]} bis ${t.gueltig[1]}.`);
    }
    /* v1110b-WLN - EIN LOGARITHMUS IST KEINE POTENZ.
       Magdeburg druckt fuer Baujahre ab 1991 ab:
         - 0,18684634 x ln vorlaeufiger Sachwert
       Ohne diesen Zweig muesste man den Term weglassen oder als Potenz
       missdeuten - beides ergaebe eine andere Gleichung, und beide
       Ergebnisse blieben im plausiblen Band. */
    const exp = zahl(t.exponent);
    let basis;
    if (t.transform === 'ln') {
      if (!(x > 0)) {
        return nichts('term_unbestimmt',
          `${t.bez || t.feld} = ${x}; der natuerliche Logarithmus ist dort `
          + 'nicht erklaert.');
      }
      basis = Math.log(x);
    } else if (t.transform === 'log10') {
      if (!(x > 0)) {
        return nichts('term_unbestimmt',
          `${t.bez || t.feld} = ${x}; der Zehnerlogarithmus ist dort nicht erklaert.`);
      }
      basis = Math.log10(x);
    } else {
      basis = (exp === null || exp === 1) ? x : Math.pow(x, exp);
    }
    if (!Number.isFinite(basis)) {
      return nichts('term_unbestimmt',
        `${t.bez || t.feld} = ${x} ergibt in diesem Term keinen endlichen `
        + `Wert (Exponent ${exp}).`);
    }
    const bei = zahl(t.koeffizient);
    if (bei === null) return nichts('kein_koeffizient', `${t.feld} ohne Koeffizient.`);
    const anteil = bei * basis;
    summe += anteil;
    teile.push(`${anteil >= 0 ? '+' : '−'} ${Math.abs(anteil).toFixed(4)} `
      + `(${t.bez || t.feld}${exp && exp !== 1 ? ` ^${exp}` : ''})`);
  }

  /* Diskrete Zuschlaege: eine Auspraegung, ein Betrag. Fehlt die
   * Auspraegung, gilt KEIN Zuschlag — das ist der ausdrueckliche
   * Standardfall der Gleichung, nicht ein uebersehener Term. */
  for (const dz of (m.diskret || [])) {
    const v = String(e[dz.feld] ?? '').toLowerCase().trim();
    /* v1110-WPFL - MANCHE DISKRETEN MERKMALE SIND PFLICHT.
       Halle (Saale) fuehrt fuer Baujahre ab 1991 den Term
       "- 0,06348555 x Gemarkung" MITTEN in der Regressionsgleichung; die
       Gemarkung ist dort in zwei Gruppen eingeteilt (West = 1, Ost = 2).
       Ihn zu ueberspringen hiesse, mit einer anderen Gleichung zu rechnen
       als der Ausschuss - und das faellt niemandem auf, weil das Ergebnis
       im Band bleibt.

       Ein diskreter Zuschlag OHNE `pflicht` bleibt dagegen, was er war:
       fehlt die Auspraegung, gilt kein Zuschlag. Das ist bei einem
       Zuschlag der ausdrueckliche Standardfall, bei einem Glied der
       Gleichung nicht. */
    if (!v) {
      if (dz.pflicht) {
        return nichts('feld_fehlt',
          `${dz.bez || dz.feld} ist nicht erfasst. Die Gleichung fuehrt `
          + 'dieses Merkmal als eigenes Glied; ohne den Wert waere es eine '
          + 'andere Gleichung.');
      }
      continue;
    }
    const w = zahl((dz.werte || {})[v]);
    if (w === null) {
      if (dz.pflicht) {
        return nichts('auspraegung_unbekannt',
          `Fuer "${v}" fuehrt der Bericht keinen Wert des Merkmals `
          + `${dz.bez || dz.feld}.`);
      }
      continue;
    }
    summe += w;
    teile.push(`${w >= 0 ? '+' : '−'} ${Math.abs(w).toFixed(4)} (${dz.bez || dz.feld})`);
  }

  /* v1110-WAEXP - EIN EXPONENT AUF DER GANZEN SUMME.
     Halle (Saale) druckt fuer Baujahre vor 1991 ab:

       SWF = ( 4,1081 - 27,7358 * vSW^-0,29 - 0,0139 * BRW^0,5
               + 1,4482 * WF^-0,29 - 2,2382 * GStd^0,15 ) ^ -1,32

     Die Klammer ist keine Schreibweise, sondern Teil des Modells: ohne
     den aeusseren Exponenten kaeme statt 1,05 ein negativer Wert heraus.
     Ein Modell halb zu rechnen ist schlimmer, als es gar nicht zu fuehren. */
  let ergebnis = summe;

  /* v1116-WEXP - DER LOGARITHMUS STEHT LINKS.
     Dresden druckt ab:
       ln(SWF) = -0,3450*ln(vSW) - 0,0001*BRW + 0,1754*ln(RND) + 3,9573
     Die Summe ist nicht der Faktor, sondern sein Logarithmus - der Faktor
     ist e hoch dieser Summe. Sein Anwendungsbeispiel rechnet es vor:
     0,0942 ergibt 1,0988, und 1,0988 x 440.000 sind 483.472 Euro.

     Ohne diesen Zweig kaeme 0,09 heraus statt 1,10 - eine Zahl, die der
     Einheitenwaechter zu Recht verwerfen wuerde. Schlimmer waere ein
     Modell, das man deshalb weglaesst: Dresden ist die zweitgroesste
     Stadt Sachsens. */
  if (m.aussen_funktion === 'exp') {
    ergebnis = Math.exp(summe);
    teile.push(`= e^(${summe.toFixed(4)}) = ${ergebnis.toFixed(4)}`);
    if (!Number.isFinite(ergebnis)) {
      return nichts('term_unbestimmt',
        'Die Gleichung ergibt fuer dieses Objekt keinen endlichen Wert.');
    }
  }

  const aexp = zahl(m.aussen_exponent);
  if (aexp !== null && aexp !== 1 && m.aussen_funktion !== 'exp') {
    if (summe <= 0 && !Number.isInteger(aexp)) {
      return nichts('term_unbestimmt',
        `Die Klammersumme ist ${summe.toFixed(4)}; mit dem Exponenten `
        + `${aexp} ergibt das keinen reellen Wert. Das Objekt liegt damit `
        + 'ausserhalb dessen, was die Gleichung abbildet.');
    }
    ergebnis = Math.pow(summe, aexp);
    teile.push(`= (${summe.toFixed(4)}) ^${aexp}`);
    if (!Number.isFinite(ergebnis)) {
      return nichts('term_unbestimmt',
        'Die Gleichung ergibt fuer dieses Objekt keinen endlichen Wert.');
    }
  }

  const st = m.rundung_stellen ?? 2;
  const p = Math.pow(10, st);
  const wert = Math.round(ergebnis * p) / p;
  return { verfuegbar: true, wert, tabellenwert: wert, korrekturen: [],
           rechenweg_terme: teile };
}

/** v1089-WBND1 · baender_1d — eine stetige Achse in KLASSEN, ohne Interpolation.
 *
 * Muenchen fuehrt seine Sachwertfaktoren je Klasse des vorlaeufigen
 * Sachwerts und begruendet die fehlende Interpolation selbst:
 *
 *   "Jeder Wert ist das arithmetische Mittel einer Teilstichprobe, kein
 *    Funktionswert an einer Stuetzstelle."
 *
 * Zwischen zwei Klassenmitten zu interpolieren hiesse, eine Kurve zu
 * unterstellen, die der Ausschuss nicht abgeleitet hat.
 *
 * Abgrenzung: `stufen_1d` interpoliert zwischen Stuetzstellen EINER
 * Funktion. `matrix_band` hat zwei Bandachsen. Hier ist es eine.
 *
 * Ein offenes Band (von=null oder bis=null) ist Absicht — die unterste und
 * oberste Klasse sind nach aussen offen. Das ist KEINE Extrapolation,
 * sondern die Klasseneinteilung des Berichts. */
function baender1d(m, e) {
  const x = zahl(e[m.achse_feld]);
  if (x === null) return nichts('achse_fehlt', `${m.achse_bez} nicht erfasst.`);

  const b = (m.baender || []).find((r) =>
    (r.von == null || x > r.von) && (r.bis == null || x <= r.bis));
  if (!b) {
    return nichts('ausserhalb_der_klassen',
      `${m.achse_bez} = ${x} faellt in keine der `
      + `${(m.baender || []).length} Klassen des Berichts.`);
  }
  if (!istZahl(b.wert)) {
    return nichts('klasse_ohne_wert',
      `Fuer die Klasse "${b.schluessel || b.bez}" fuehrt der Bericht keinen Wert.`);
  }
  return { verfuegbar: true, wert: b.wert, tabellenwert: b.wert,
           korrekturen: [], klasse: b.schluessel || b.bez || null,
           klasse_fallzahl: b.fallzahl ?? null,
           klasse_streuung: b.streuung ?? null };
}

/** v1093-WLOG · log_1d — eine Achse, ein Logarithmus: Y = a * ln(x) + b.
 *
 * Worms fuehrt seine Liegenschaftszinssaetze so, ueber der relativen
 * Restnutzungsdauer. Abgrenzung: `doppel_log` hat ZWEI Logarithmen ueber
 * zwei Achsen, `potenz` ist Y = a * X^b.
 *
 * DIE EINHEIT IST HIER DER GANZE FALL. Worms setzt die relative
 * Restnutzungsdauer als PROZENTZAHL ein (30 fuer 30 %), nicht als
 * Dezimalbruch 0,30. Mit dem Dezimalbruch kaeme 8,35 % statt 3,99 % heraus
 * — plausibel und falsch. `eingang_bez` haelt fest, was einzusetzen ist;
 * `skala` rechnet um, wenn der Aufrufer die andere Einheit liefert.
 *
 * Der Logarithmus ist fuer jedes x > 0 definiert — die Regression traegt
 * dort aber nicht. Deshalb gilt der abgedruckte Gueltigkeitsbereich, und
 * zwar in derselben Einheit wie der Eingang. Wo die Quelle endet, endet
 * die Rechnung. */
function log1d(m, e) {
  const feld = m.achse_feld || m.eingang;
  const roh = zahl(e[feld]);
  if (roh === null) {
    return nichts('achse_fehlt',
      `${m.eingang_bez || m.achse_bez || feld} nicht erfasst.`);
  }
  const skala = zahl(m.skala) ?? 1;
  const x = roh * skala;

  if (!(x > 0)) {
    return nichts('achse_nicht_positiv',
      `Der Logarithmus ist fuer ${feld} = ${x} nicht definiert. `
      + 'Gerechnet wird damit nicht.');
  }
  const g = m.gueltig || m.geltungsbereich || null;
  if (Array.isArray(g) && g.length === 2 && (x < g[0] || x > g[1])) {
    return nichts('ausserhalb_des_gueltigkeitsbereichs',
      `${m.eingang_bez || feld} = ${x} liegt ausserhalb von ${g[0]} bis `
      + `${g[1]}. Der Bericht untersagt die Extrapolation; ausgewiesen `
      + 'wird, gerechnet nicht.');
  }
  const a = zahl(m.a), b = zahl(m.b);
  if (a === null || b === null) {
    return nichts('koeffizient_fehlt',
      'Der Datensatz fuehrt a oder b nicht.');
  }
  const wert = a * Math.log(x) + b;
  const st = m.rundung_stellen ?? 2;
  const q = Math.pow(10, st);
  const ger = Math.round(wert * q) / q;
  return { verfuegbar: true, wert: ger, tabellenwert: ger, korrekturen: [],
           formel: `${a} * ln(${x}) + ${b}`,
           eingang_einheit: m.eingang_bez || null };
}

/** v1093-WSPN · spanne_kategorial — die Form, die ABSICHTLICH nicht rechnet.
 *
 * Saarbruecken druckt je Grundstuecksart nur eine Spanne ab ("2,0 – 4,5"),
 * kein Punktmass — weder Median noch Mittel. Ein Wert daraus waere erfunden.
 *
 * Diese Form liefert deshalb keinen Wert, sondern die Spanne. Der
 * Unterschied zu `form_unbekannt` ist der ganze Zweck: `form_unbekannt` ist
 * eine Aussage ueber den Auswerter, `nur_spanne` eine ueber die Quelle. Der
 * Bericht kann die Spanne dann ausweisen, statt zu schweigen. */
function spanneKategorial(m, e) {
  const k = m.kategorie_feld ? String(e[m.kategorie_feld] || '').toLowerCase().trim() : null;
  const eintrag = (k && (m.kategorien || {})[k]) || m;
  const sp = eintrag.spanne;
  if (!Array.isArray(sp) || sp.length !== 2) {
    return nichts('spanne_fehlt', 'Der Datensatz fuehrt keine Spanne.');
  }
  return { verfuegbar: false, wert: null, grund: 'nur_spanne',
    hinweis: 'Die Quelle nennt fuer diese Art nur eine Spanne von '
      + `${eintrag.spanne_wortlaut || sp.join(' bis ')}, kein Punktmass. `
      + 'Ein Mittelwert daraus stuende nirgends im Dokument und wird '
      + 'deshalb nicht gebildet. Die Spanne ist auszuweisen, nicht zu '
      + 'verrechnen.',
    spanne: sp, spanne_wortlaut: eintrag.spanne_wortlaut || null,
    korrekturen: [] };
}

/** konstante — ein Faktor. Basis fuer Bochum und Dortmund. */
function konstante(m) {
  if (!istZahl(m.wert)) return nichts('kein_wert', 'Kein Faktor hinterlegt.');
  return { verfuegbar: true, wert: m.wert, tabellenwert: m.wert, korrekturen: [] };
}

/* ═══ v1101-WBKAT · BAENDER, DIE JE KATEGORIE ANDERS LAUFEN ════════════
   Teltow-Flaeming staffelt seine Sachwertfaktoren nach Standardstufe UND
   Bodenrichtwertniveau — und die Bodenrichtwertbaender sind je
   Standardstufe andere:

     Stufe 2:  bis 20 · 21-100 · 101-250 · ab 251
     Stufe 3:  bis 100 · 101-200 · 201-300 · ab 301
     Stufe 4:  bis 100 · 101-200 · 201-350 · ab 351

   `matrix_band` kann das nicht: sie hat EINE Bandliste je Achse. Eine
   gemeinsame Liste zu bilden hiesse, Grenzen zu erfinden, die im Bericht
   nicht stehen — und an genau diesen erfundenen Grenzen laege der Faktor
   dann falsch, ohne dass es auffiele.

   Hier traegt jede Kategorie ihre EIGENEN Baender. Was der Bericht
   abdruckt, steht so im Rezept. */
function baenderKategorial(m, e) {
  const kat = kategorieAus(m, e);
  if (!kat.wert) {
    return nichts(kat.bekannt_aber_ohne_wert ? 'kategorie_ohne_wert' : 'kategorie_fehlt',
      `${m.achse_k_bez || 'Die Kategorie'} ist nicht bestimmbar`
      + (kat.ueber ? ` (gelesen aus "${kat.ueber}")` : '') + '.');
  }
  /* Die Kategorien stehen im Rezept in ihrer Schreibweise; verglichen wird
     ohne Gross-/Kleinschreibung, aber nicht unscharf. */
  const schluessel = Object.keys(m.baender_je_kategorie || {})
    .find((k) => k.toLowerCase() === String(kat.wert).toLowerCase());
  if (schluessel === undefined) {
    return nichts('kategorie_unbekannt',
      `Fuer "${kat.wert}" fuehrt der Bericht keine Reihe.`);
  }
  const reihe = m.baender_je_kategorie[schluessel] || [];
  const x = zahl(e[m.achse_feld]);
  if (x === null) return nichts('achse_fehlt', `${m.achse_bez} nicht erfasst.`);

  const b = reihe.find((r) => (r.von == null || x >= r.von)
                           && (r.bis == null || x <= r.bis));
  if (!b) {
    return nichts('ausserhalb_der_klassen',
      `${m.achse_bez} = ${x} faellt in keine der ${reihe.length} Klassen, `
      + `die der Bericht fuer "${schluessel}" fuehrt.`);
  }
  if (!istZahl(b.wert)) {
    return nichts('klasse_ohne_wert',
      `Fuer "${schluessel}" und ${b.bez || 'diese Klasse'} fuehrt der Bericht keinen Wert.`);
  }
  const st = m.rundung_stellen ?? 2;
  const q = Math.pow(10, st);
  return { verfuegbar: true, wert: Math.round(b.wert * q) / q,
           tabellenwert: Math.round(b.wert * q) / q, korrekturen: [],
           kategorie: schluessel, klasse: b.bez || null,
           klasse_fallzahl: b.fallzahl ?? null,
           klasse_spanne: (b.min != null && b.max != null) ? [b.min, b.max] : null };
}

/* === v1103-WVERZ - JE KATEGORIE EIN VOLLSTAENDIGES MODELL =============
   GEFUNDEN an Havelland: der Landkreis druckt fuer seine zwei Regionen
   zwei Tabellen ab, die nicht einmal dieselben ACHSEN haben -

     Berliner Umland        Grundstuecksflaeche x WOHNflaeche, Bezugsbaujahr 2000
     weiterer Metropolenraum Grundstuecksflaeche x BGF,        Bezugsbaujahr 1960

   und dazu je Region eine eigene Baujahrskorrektur (1,16 bis 0,97 gegen
   1,08 bis 0,92). Barnim hatte je Region eine eigene Potenzfunktion.

   Statt fuer jede dieser Kombinationen eine eigene Form zu bauen -
   `potenz_kategorial`, `matrix_kategorial_2`, und so weiter - traegt
   diese hier je Kategorie ein GANZES Modell und wertet es ueber
   auswerten() aus. Damit gilt fuer das Untermodell alles, was sonst
   auch gilt: seine Bedingungen, seine Korrekturen, sein Einheitenwaechter.

   v1102 hatte dafuer `potenz_kategorial` gebaut. Diese Form ist damit
   ueberfluessig und WEG - zwei Wege zum selben Ziel laufen frueher oder
   spaeter auseinander. Barnim steht jetzt als `verzweigt` mit vier
   `potenz`-Untermodellen im Register; seine dreizehn Pruefungen sind
   dieselben geblieben.

   Die Korrekturen der AEUSSEREN Ebene wirken zusaetzlich - was fuer alle
   Kategorien gilt, steht aussen, was je Kategorie verschieden ist, innen. */
function verzweigt(m, e) {
  const kat = kategorieAus(m, e);
  if (!kat.wert) {
    return nichts(kat.bekannt_aber_ohne_wert ? 'kategorie_ohne_wert' : 'kategorie_fehlt',
      `${m.achse_k_bez || 'Die Kategorie'} ist nicht bestimmbar`
      + (kat.ueber ? ` (gelesen aus "${kat.ueber}")` : '') + '.');
  }
  const tab = m.modell_je_kategorie || {};
  const schluessel = Object.keys(tab)
    .find((k) => k.toLowerCase() === String(kat.wert).toLowerCase());
  if (schluessel === undefined) {
    return nichts('kategorie_unbekannt',
      `Fuer "${kat.wert}" fuehrt der Bericht kein Modell.`);
  }
  const unter = tab[schluessel];
  if (!unter || !unter.form) {
    return nichts('form_unbekannt',
      `Das Modell fuer "${schluessel}" traegt keine Form.`);
  }
  /* Die Einheit der aeusseren Ebene gilt, wenn das Untermodell keine
     eigene nennt - sonst koennte ein Untermodell still eine andere
     Einheit liefern als der Registersatz verspricht. */
  const r = auswerten({ ...unter, liefert: unter.liefert || m.liefert }, e);
  if (!r.verfuegbar) return { ...r, kategorie: schluessel };

  /* GEMESSEN an Havelland: das Untermodell hatte richtig gerechnet -
     0,92 aus der Tabelle mal 1,16 fuer Baujahr 1900 = 1,07 -, und die
     aeussere Ebene warf es weg. Sie rechnet naemlich ab `tabellenwert`
     weiter, und der stand noch auf den nackten 0,92.

     Der Endwert des Untermodells IST der Tabellenwert dieser Ebene: was
     unten passiert ist, ist von hier aus die Tabelle. Die Korrekturen
     des Untermodells wandern nach `korrekturen_kategorie`, damit sie im
     Rechenweg sichtbar bleiben statt still ueberschrieben zu werden. */
  return { ...r, kategorie: schluessel, tabellenwert: r.wert,
           korrekturen_kategorie: r.korrekturen || [],
           rechenweg_kategorie: r.rechenweg || null,
           korrekturen: [] };
}

const AUSWERTER = {



  matrix_interp: matrixInterp,
  matrix_kategorial: matrixKategorial,
  matrix_band: matrixBand,
  stufen_1d: stufen1d,
  potenz,
  linear_sachwert: linearSachwert,
  doppel_log: doppelLog,
  konstante,
  stufen_kategorial: stufenKategorial,   /* v1088-WKAT */
  regression_additiv: regressionAdditiv, /* v1088-WREG */
  baender_1d: baender1d,                 /* v1089-WBND1 */
  log_1d: log1d,                         /* v1093-WLOG */
  spanne_kategorial: spanneKategorial,   /* v1093-WSPN */
  baender_kategorial: baenderKategorial, /* v1101-WBKAT */
  verzweigt: verzweigt,                 /* v1103-WVERZ */
};

/* ── Additive Korrekturen ──────────────────────────────────────────────── */

/**
 * Zu-/Abschlaege als Stufentabelle (interpoliert) oder Bandtabelle (nicht).
 * Immer ADDITIV auf den Tabellenwert — so drucken es die Berichte ab
 * (Herford 0,89 + 0,02 - 0,03 = 0,88; Hoexter 0,70 + 0,06 + 0,01 = 0,77).
 */
function korrekturAnwenden(k, e) {
  /* ═══ v1098-WPOT · DREI KORREKTURARTEN, DIE KEINE TABELLE SIND ═══════
     Bis hierher kannte diese Funktion zwei Arten: `stufen` (interpoliert)
     und `band` (nicht). Beide sind Tabellen ueber eine ZAHL.

     Hamburg druckt seinen Sachwertfaktor als PRODUKT aus 19 Faktoren ab,
     und die wenigsten davon sind Tabellen:

       Lagefaktor              (NormBRW20 / 630) ^ 0,1902
       Bodenwertanteilsfaktor  0,67318 + 0,5447 × Bodenwertanteil
       Stadtteilfaktor         rund 100 Namen, je ein Wert

     Eine Potenz als Stufentabelle nachzubilden hiesse, eine geschlossene
     Funktion durch Stuetzstellen zu ersetzen und zwischen ihnen LINEAR zu
     interpolieren — an einer gekruemmten Kurve ist das ein Fehler, den
     niemand sieht, weil das Ergebnis plausibel bleibt.

     WARUM KEINE NEUE MODELLFORM: die Multiplikation gibt es hier seit
     v1093 (`wirkung: multiplikativ`), samt Waechter und Rechenweg. Hamburg
     ist damit `konstante` 0,788 plus 19 multiplikative Korrekturen — die
     vorhandene Mechanik traegt es, sobald sie diese drei Arten kennt.

     `kategorial` liest ausdruecklich den ROHWERT, keine Zahl: ein
     Stadtteil heisst "Blankenese". */
  /* ═══ v1100-WK2D · EINE KORREKTUR, DIE VON ZWEI GROESSEN ABHAENGT ═════
     Der Landkreis Oberhavel druckt zwei Tabellen ab und schreibt dazu:
     „Bei modellkonformer Verkehrswertermittlung sind beide Faktoren
     gleichzeitig anzuwenden." Die erste gibt den Sachwertfaktor nach Region
     und vorlaeufigem Sachwert, die zweite eine Korrektur nach
     Bruttogrundflaeche — und die Korrekturkurve ist JE REGION eine andere.

     Die bisherigen Arten koennen das nicht: `stufen` liest eine Zahl,
     `kategorial` einen Text. Hier braucht es beides — die Zahl sagt WO auf
     der Kurve, die Kategorie sagt WELCHE Kurve.

     Ohne diese Art bliebe nur, die zweite Tabelle wegzulassen. Dann
     rechnete das Modell halb, und das Ergebnis saehe trotzdem plausibel
     aus — genau die Fehlerklasse, die dieses Register vermeiden soll.

     WICHTIG: faellt die Kategorie nicht in die Tabelle, gibt es KEINE
     Korrektur — nicht die einer Nachbarregion. */
  if (k.art === 'stufen_kategorial') {
    /* ═══ v1408 · DIE KATEGORIE KANN AUS EINER ZAHL KOMMEN ════════════════
       Bisher las dieser Zweig die Kategorie ausschliesslich als TEXT aus
       `e[k.kategorie_feld]` — der Aufrufer musste sie also kennen.

       Hamburgs Modernisierungsfaktor braucht etwas anderes: seine Kategorie
       ist die BAUJAHRSKLASSE, und die steht in keinem Eingabefeld. Sie
       ergibt sich aus dem Baujahr, und die Klassengrenzen kennt nur der
       Bericht:

         bis 1919 · 1920-39 · 1940-59 · 1960-69 · 1970-79
         1980-89 · 1990-99 · 2000-09 · ab 2010

       Der Aufrufer kann sie nicht liefern, ohne den Bericht zu kennen —
       dann stuende die Zuordnung an zwei Stellen. Fuer die MODELLachse gibt
       es diesen Weg seit v1094 (`kategorie_baender` in `kategorieAus`);
       hier fehlte er. Dieselbe Mechanik, dasselbe Rezeptwort.

       KEINE INTERPOLATION ZWISCHEN DEN KLASSEN: ein Baujahr faellt in genau
       eine. Faellt es in keine, gibt es keine Korrektur — nicht die der
       Nachbarklasse. */
    let kat = '';
    if (Array.isArray(k.kategorie_baender) && k.kategorie_baender.length) {
      const zv = zahl(e[k.kategorie_feld]);
      if (zv === null) return null;
      const tr = k.kategorie_baender.find((b) => (b.von == null || zv >= b.von)
                                              && (b.bis == null || zv <= b.bis));
      if (!tr) return null;                      /* ausserhalb aller Klassen */
      kat = String(tr.kategorie);
    } else {
      kat = String(e[k.kategorie_feld] ?? '').trim();
    }
    if (!kat) return null;
    const tab = k.stufen || {};
    let reihe = tab[kat];
    if (reihe === undefined) {
      const treffer = Object.keys(tab).find(
        (n) => n.toLowerCase() === kat.toLowerCase());
      if (treffer !== undefined) reihe = tab[treffer];
    }
    if (!reihe || typeof reihe !== 'object') return null;

    const xk = zahl(e[k.feld]);
    if (xk === null) return null;
    const st = Object.keys(reihe).map(Number).filter((n) => Number.isFinite(n))
                     .sort((p, q) => p - q);
    if (!st.length) return null;
    /* Ausserhalb der Reihe gilt der Randwert — der Bericht druckt sie als
       vollstaendig ab, ohne Fortsetzung nach aussen. Dieselbe Regel wie bei
       `stufen`. */
    const v2 = xk <= st[0] ? beiZahl(reihe, st[0])
             : xk >= st[st.length - 1] ? beiZahl(reihe, st[st.length - 1])
             : (() => { const n2 = nachbarn(st, xk);
                        return zwischen(xk, n2[0], n2[1],
                                        beiZahl(reihe, n2[0]), beiZahl(reihe, n2[1])); })();
    if (!istZahl(v2)) return null;
    const st2 = k.rundung_stellen ?? 3;
    const q2 = Math.pow(10, st2);
    return { merkmal: k.bez, wert: Math.round(v2 * q2) / q2,
             wirkung: k.wirkung === 'multiplikativ' ? 'multiplikativ' : 'additiv',
             ausprägung: `${xk} (${kat})` };
  }

  if (k.art === 'kategorial') {

    const roh = e[k.feld];
    if (roh === undefined || roh === null || roh === '') return null;
    const schluessel = String(roh).trim();
    const tab = k.werte || {};
    /* Ohne Beachtung von Gross-/Kleinschreibung, aber NICHT unscharf: wer
       einen Namen falsch schreibt, bekommt keine Korrektur statt einer
       falschen. */
    let v = tab[schluessel];
    if (v === undefined) {
      const treffer = Object.keys(tab).find(
        (n) => n.toLowerCase() === schluessel.toLowerCase());
      if (treffer !== undefined) v = tab[treffer];
    }
    if (!istZahl(v)) return null;
    return { merkmal: k.bez, wert: v,
             wirkung: k.wirkung === 'multiplikativ' ? 'multiplikativ' : 'additiv',
             ausprägung: schluessel };
  }

  const x = zahl(e[k.feld]);
  if (x === null) return null;                  // nicht erfasst = keine Korrektur

  if (k.art === 'potenz' || k.art === 'linear') {
    const wirkungP = k.wirkung === 'multiplikativ' ? 'multiplikativ' : 'additiv';
    let v;
    if (k.art === 'potenz') {
      /* (x / basis) ^ exponent — `basis` ist die Normstelle, an der die
         Korrektur 1 ergibt. Sie steht in jedem Bericht ausdruecklich
         daneben ("bei 120 m² Wohnflaeche: 1"). */
      const basis = zahl(k.basis);
      const exp = zahl(k.exponent);
      if (basis === null || exp === null || !(basis > 0) || !(x > 0)) return null;
      v = Math.pow(x / basis, exp);
    } else {
      const a = zahl(k.a), b = zahl(k.b);
      if (a === null || b === null) return null;
      v = a + b * x;
    }
    /* Deckelung: Hamburg kappt zwei Faktoren ausdruecklich ("wenn
       Wohnflaeche >= 300 m²: 1,427"). Ohne die Kappung rechnet die Potenz
       weiter und laeuft aus dem Gueltigkeitsbereich der Stichprobe heraus. */
    if (k.deckel_ab != null && x >= zahl(k.deckel_ab) && istZahl(zahl(k.deckel_wert))) {
      v = zahl(k.deckel_wert);
    }
    if (k.boden_ab != null && x <= zahl(k.boden_ab) && istZahl(zahl(k.boden_wert))) {
      v = zahl(k.boden_wert);
    }
    if (!istZahl(v)) return null;
    const stP = k.rundung_stellen ?? 5;
    const qP = Math.pow(10, stP);
    return { merkmal: k.bez, wert: Math.round(v * qP) / qP, wirkung: wirkungP,
             ausprägung: String(x) };
  }


  /* v1093-WMUL · `wirkung` sagt, WIE die Korrektur wirkt; `art` sagt, welche
   * FORM ihre Tabelle hat. Zwei verschiedene Dinge — die Rezepte hatten
   * beides unter `art` geschrieben, der Wandler trennt es. Fehlt `wirkung`,
   * gilt additiv: so drucken es Herford, Hoexter und Dortmund ab, und so
   * hat der Auswerter seit v1083 gerechnet. */
  const wirkung = k.wirkung === 'multiplikativ' ? 'multiplikativ' : 'additiv';

  /* ═══ v1412-WOFN · EINE KORREKTUR, DEREN WERTE WIR NICHT HABEN ════════
     Der Landkreis Verden fuehrt eine Kurve fuer abweichenden
     Energiebedarf. Im Dashboard steht ihre Beschriftung, im PDF-Export
     aber KEINE Stuetzstelle — sie erscheint erst bei einer Auswahl.

     Bisher gab es dafuer zwei Wege, und beide sind falsch: die Korrektur
     weglassen (dann rechnet das Modell halb, und das Ergebnis sieht
     trotzdem plausibel aus) oder Werte schaetzen (dann erfinden wir eine
     Zahl). Das ist der dritte Weg — die Korrektur steht im Satz, traegt
     ihren Grund und wird als OFFEN ausgewiesen.

     TECHNISCH kam das bisher schon heraus: ohne `stufen` faellt die
     Funktion unten auf `return null`, und null bedeutet offen. Aber
     zufaellig richtig ist nicht richtig — wer `art: "offen"` liest, soll
     die Stelle finden, die es behandelt. */
  if (k.art === 'offen') return null;

  if (k.art === 'band') {
    const b = (k.baender || []).find((r) => x >= r.von && x <= r.bis);
    return b ? { merkmal: k.bez, wert: b.zuschlag, wirkung,
                 ausprägung: b.bez ?? `${b.von}-${b.bis}` } : null;
  }
  const stufen = Object.keys(k.stufen || {}).map(Number).sort((p, q) => p - q);
  if (!stufen.length) return null;
  // Ausserhalb der Korrekturtabelle gilt der Randwert - der Bericht druckt
  // die Reihe als vollstaendig ab, ohne Fortsetzung nach aussen.
  const v = x <= stufen[0] ? beiZahl(k.stufen, stufen[0])
          : x >= stufen[stufen.length - 1] ? beiZahl(k.stufen, stufen[stufen.length - 1])
          : (() => { const n = nachbarn(stufen, x);
                     return zwischen(x, n[0], n[1],
                                     beiZahl(k.stufen, n[0]), beiZahl(k.stufen, n[1])); })();
  // Auch die Rundung ist Dokumentverhalten. Herford druckt seine Zu-/Abschlaege
  // ZWEISTELLIG ab und summiert erst danach: 0,899 + (-0,01) + 0,00 = 0,889.
  // Wer erst summiert und dann rundet, kommt auf 0,89 - eine andere Zahl.
  const st = k.rundung_stellen ?? 3;
  const q = Math.pow(10, st);
  return { merkmal: k.bez, wert: Math.round(v * q) / q, wirkung,
           ausprägung: String(x) };
}

/* ── Einheiten ─────────────────────────────────────────────────────────── */
/* v1084-WEIN · Nicht jeder Bericht druckt einen Faktor.
 *
 * Kreis Lippe druckt den Sachwertfaktor in Prozent (90,86), Dortmund einen
 * Zu-/Abschlag in Prozent (+34), Stadt Paderborn einen Euro-Betrag. Bis v1083
 * hat der Wrapper das Ergebnis des Auswerters mit `tabellenwert + Korrekturen`
 * ueberschrieben und damit die Umrechnung von doppelLog() zunichte gemacht —
 * heraus kam ein "Sachwertfaktor" von 90,86. Aufgefallen ist es nie, weil der
 * Register-Zweig bis v1084 gar nicht gerechnet hat.
 *
 * Jetzt gilt: gerechnet und GERUNDET wird in der Einheit des Dokuments,
 * umgerechnet genau einmal danach. */
const FORM_EINHEIT = {
  doppel_log: 'prozent',        /* SF[%] = c + a*ln(F) + b*ln(X) */
  linear_sachwert: 'wert_eur',  /* liefert einen Betrag, keinen Faktor */
};

const IN_FAKTOR = {
  faktor: (v) => v,
  prozent: (v) => v / 100,
  zuschlag_prozent: (v) => 1 + v / 100,
};

/** v1085-WBND · Plausibilitaetsband JE KENNZAHL.
 *
 * Keine Marktaussage, sondern ein Einheitenwaechter: was hier herausfaellt,
 * ist keine ungewoehnliche Lage, sondern eine verwechselte Einheit. Lieber
 * KEIN Wert als ein Faktor von 90.
 *
 * Bis v1084 war das Band fest auf Sachwertfaktoren geeicht. Berlin fuehrt
 * seinen Liegenschaftszinssatz als Funktion der Objektkaltmiete — 2,3 % bis
 * 4,6 %, also 0,023 bis 0,046 als Dezimalwert. Der feste Waechter hat das
 * als "Einheit vermutlich falsch ausgewiesen" verworfen, obwohl der
 * Datensatz stimmte. Ein Waechter, der Unfug meldet, wird ueberlesen. */
const BAND = {
  sachwertfaktor: [0.1, 5.0],
  liegenschaftszinssatz: [0.001, 0.15],   /* 0,1 % bis 15 % */
};
const BAND_STANDARD = BAND.sachwertfaktor;

/* v1085-WZUO · Ein feineres Merkmal auf die Kategorie abbilden.
 *
 * Berlins Sachwertfaktoren stehen je Gebietsgruppe (1/2/3), zugeordnet ueber
 * den ALTBEZIRK — Stand vor 2001, nicht der heutige Bezirk und nicht der
 * Ortsteil. Die Zuordnung liegt im Datensatz; ohne diese Funktion muesste
 * der Aufrufer sie kennen, und dann stuende sie an zwei Stellen.
 *
 * Ist das Merkmal bekannt, aber keiner Kategorie zugeordnet, gibt es KEINEN
 * Wert: sieben der 23 Berliner Altbezirke fuehren keinen Sachwertfaktor.
 * Das ist kein Fehler, das ist die Aussage des Berichts. */
function kategorieAus(m, e) {
  const direkt = String(e[m.achse_k_feld] ?? '').toLowerCase().trim();
  if (direkt) return { wert: direkt, ueber: 'direkt' };

  /* v1094-WKAB · Die Kategorie aus einem ZAHLENBAND ableiten.
   *
   * Berlins Zuordnung ist eine Namensliste (Altbezirk -> Gebietsgruppe).
   * Wiesbaden ordnet dagegen ueber eine ZAHL zu: der Bodenrichtwert faellt
   * in eine Klasse 600-699, 700-799 und so fort. Ohne diesen Zweig muesste
   * der Aufrufer die Klassengrenzen kennen — und dann stuenden sie an zwei
   * Stellen, die frueher oder spaeter auseinanderlaufen.
   *
   * Zwischen den Klassen wird NICHT interpoliert: der Bericht druckt sie
   * als Klassen ab, nicht als Stuetzstellen. Faellt die Zahl in keine
   * Klasse, gibt es keinen Wert — das ist die Extrapolationssperre, nicht
   * ein fehlendes Merkmal. */
  const zb = m.kategorie_baender;
  if (Array.isArray(zb) && zb.length) {
    const feldZ = m.zuordnung_feld;
    const zv = zahl(e[feldZ]);
    if (zv === null) return { wert: '', ueber: null };
    const treffer = zb.find((b) => (b.von == null || zv >= b.von)
                                && (b.bis == null || zv <= b.bis));
    if (!treffer) {
      return { wert: '', ueber: feldZ, bekannt_aber_ohne_wert: true };
    }
    return { wert: String(treffer.kategorie).toLowerCase(), ueber: feldZ };
  }

  /* v1104-WMEHRD - NAMEN, DIE AUSDRUECKLICH KEINEN WERT ERGEBEN.

     Dahme-Spreewald teilt zwei Gemeinden GEMARKUNGSSCHARF: die
     Gemarkungen Koenigs Wusterhausen und Deutsch Wusterhausen gehoeren
     zur S-Bahn-Region, die uebrigen Gemarkungen derselben Stadt nicht;
     bei Schoenefeld ebenso. Der Gemeindename allein sagt also nichts.

     Ohne diese Liste faenden solche Namen den Weg in die Restkategorie
     und bekaemen den Faktor des weiteren Metropolenraums - fuer ein
     Grundstueck im Berliner Umland. Die Restkategorie ist fuer das
     gedacht, was der Bericht NICHT aufzaehlt, nicht fuer das, was er
     feiner aufteilt, als die Anfrage es hergibt.

     Diese Pruefung steht VOR der Zuordnung: ein mehrdeutiger Name
     gewinnt gegen jede Liste. */
  const mehrdeutig = m.kategorie_mehrdeutig;
  if (Array.isArray(mehrdeutig) && mehrdeutig.length) {
    const feldM = m.zuordnung_feld || 'altbezirk';
    const vM = String(e[feldM] ?? '').toLowerCase().trim();
    if (vM && mehrdeutig.some((x) => String(x).toLowerCase().trim() === vM)) {
      return { wert: '', ueber: feldM, bekannt_aber_ohne_wert: true,
               mehrdeutig: true };
    }
  }

  const zu = m.kategorie_zuordnung;

  if (!zu) return { wert: '', ueber: null };
  const feld = m.zuordnung_feld || 'altbezirk';
  const v = String(e[feld] ?? '').toLowerCase().trim();
  if (!v) {
    /* v1112-WOHNE - ZWEI ARTEN VON RESTKATEGORIE.

       Bei Barnim BESTIMMT der Ort die Region: ohne ihn ist nicht zu sagen,
       ob 1,25 oder 0,96 gilt, und dann gibt es keinen Wert.

       Bei Dessau-Rosslau und den drei Landkreisen SCHLIESST der Ort nur
       AUS: das Blatt gilt fuer den ganzen Bereich `ohne
       Grossstadtrandlage`, und die Randlage sind acht benannte Orte im
       Jerichower Land. Fehlt der Name, ist die Restkategorie die richtige
       Antwort - die Ausnahme bleibt die Ausnahme.

       Welcher Fall vorliegt, entscheidet das REZEPT. Ohne
       `sonst_auch_ohne_wert` bleibt es beim strengen Verhalten. */
    if (m.kategorie_sonst && m.sonst_auch_ohne_wert) {
      return { wert: String(m.kategorie_sonst).toLowerCase(), ueber: null,
               ueber_rest: true };
    }
    return { wert: '', ueber: null };
  }

  for (const kat of (m.kategorien || [])) {
    const liste = zu[String(kat)];
    if (Array.isArray(liste)
        && liste.some((x) => String(x).toLowerCase().trim() === v)) {
      return { wert: String(kat).toLowerCase(), ueber: feld };
    }
  }
  /* v1103-WSONST - EINE RESTKATEGORIE, ABER NUR WENN DER BERICHT SIE NENNT.

     Oder-Spree zaehlt elf Gemarkungen als Berliner Umland auf und
     schreibt fuer den weiteren Metropolenraum ausdruecklich `Doerfer:
     alle uebrigen`. Ohne Restkategorie bekaeme der groesste Teil des
     Landkreises keinen Faktor, obwohl der Bericht ihn eindeutig zuordnet.

     Sie greift NUR, wenn ein Zuordnungswert vorliegt und in keiner Liste
     steht. Fehlt der Wert ganz, bleibt es bei 'kategorie_fehlt': wer
     nicht weiss, wo das Objekt liegt, darf es nicht in den Rest sortieren.

     `kategorie_sonst` gehoert ins Rezept und ist dort zu belegen. Wo ein
     Bericht seine Kategorien NICHT erschoepfend teilt - Barnims vier
     Regionen etwa -, steht das Feld nicht, und ein unbekannter Ort bleibt
     ohne Wert. */
  if (m.kategorie_sonst) {
    return { wert: String(m.kategorie_sonst).toLowerCase(), ueber: feld,
             ueber_rest: true };
  }
  return { wert: '', ueber: feld, bekannt_aber_ohne_wert: true };
}


/* ── Der Vertrag nach aussen ───────────────────────────────────────────── */

/**
 * Ein Modell auswerten. Gibt IMMER dieselbe Form zurueck, damit die Aufrufer
 * die neun Strukturen nicht kennen muessen.
 *
 * @param {object} modell  Eintrag aus mb.param_modell (Feld `formel` + `korrekturen`)
 * @param {object} eingabe Objektmerkmale, flach
 * @returns {{verfuegbar:boolean, wert:number|null, tabellenwert?:number,
 *            korrekturen:Array, grund?:string, hinweis?:string, rechenweg?:string}}
 */
/* ═══ v1100c-WBED · EINE BEDINGUNG AUF EINEM ZWEITEN FELD ═══════════════
   GEFUNDEN an der Uckermark: der Bericht wertet Ein- und
   Zweifamilienhaeuser nur fuer Bodenrichtwerte UEBER 30 EUR/qm aus. Die
   Modellform `potenz` kennt genau eine Achse (den vorlaeufigen Sachwert)
   und konnte das nicht pruefen.

   Folge waere: wer fuer ein Objekt mit 20 EUR/qm rechnet, bekommt einen
   Faktor — aus einer Auswertung, die fuer sein Objekt gar nicht gilt. Das
   Ergebnis saehe plausibel aus. Genau die Fehlerklasse, gegen die dieses
   Register gebaut ist.

   `bedingungen` gilt fuer JEDE Modellform und wird VOR der Rechnung
   geprueft. Sie beschreibt, was der Bericht ueber seinen
   Anwendungsbereich sagt — nicht, was DealPilot fuer sinnvoll haelt.

   Fehlt das Feld beim Objekt, wird NICHT gerechnet: eine Bedingung, die
   man nicht pruefen kann, ist nicht erfuellt. Der Bericht hat seinen
   Anwendungsbereich benannt; ihn zu ignorieren, weil eine Angabe fehlt,
   waere die Umkehrung seiner Aussage. */
function bedingungPruefen(modell, eingabe) {
  const bed = modell.bedingungen;
  if (!Array.isArray(bed) || !bed.length) return null;
  for (const b of bed) {
    if (!b || !b.feld) continue;
    const v = zahl(eingabe[b.feld]);
    if (v === null) {
      return nichts('bedingung_nicht_pruefbar',
        `${b.bez || b.feld} ist nicht erfasst. Der Bericht wertet nur aus, `
        + `wenn ${b.bez || b.feld} ${b.text || 'im Anwendungsbereich liegt'} — `
        + 'ohne die Angabe laesst sich das nicht pruefen, und ohne Pruefung '
        + 'wird nicht gerechnet.');
    }
    const zuKlein = b.groesser_als != null && !(v > b.groesser_als);
    const zuGross = b.kleiner_als  != null && !(v < b.kleiner_als);
    const unter   = b.mindestens   != null && v < b.mindestens;
    const ueber   = b.hoechstens   != null && v > b.hoechstens;
    if (zuKlein || zuGross || unter || ueber) {
      return nichts('ausserhalb_des_anwendungsbereichs',
        `${b.bez || b.feld} = ${v}. Der Bericht wertet nur aus, wenn `
        + `${b.bez || b.feld} ${b.text || 'im Anwendungsbereich liegt'}. `
        + 'Fuer dieses Objekt hat der Gutachterausschuss keinen Faktor '
        + 'abgeleitet; ein Faktor aus einem anderen Segment gilt hier nicht '
        + '(§ 10 ImmoWertV).');
    }
  }
  return null;
}

export function auswerten(modell, eingabe) {
  if (!modell || !modell.form) return nichts('kein_modell', 'Kein Modell hinterlegt.');

  /* v1100c-WBED: der Anwendungsbereich wird geprueft, BEVOR gerechnet wird. */
  const _bed = bedingungPruefen(modell, eingabe || {});
  if (_bed) return _bed;

  const fn = AUSWERTER[modell.form];
  if (!fn) return nichts('form_unbekannt', `Modellform '${modell.form}' kennt der Auswerter nicht.`);

  const r = fn(modell, eingabe || {});
  if (!r.verfuegbar) return r;

  const einheit = modell.liefert || FORM_EINHEIT[modell.form] || 'faktor';

  /* ═══ v1100b-WK2D · DIE ERMITTELTE KATEGORIE GEHT AN DIE KORREKTUREN ══
     GEMESSEN an Oberhavel: die BGF-Korrektur greift je Region anders, und
     die Region leitet die FORMEL aus dem Bodenrichtwert ab. Sie stand
     danach in `r.kategorie` — aber nicht im Eingabeobjekt, das die
     Korrekturen lesen. Die Korrektur fand ihre Kategorie nie und lieferte
     still nichts: 0,97 statt 0,97 x 1,01.

     Der Aufrufer kann sie auch nicht selbst setzen — er kennt die
     Zuordnungsregel des Berichts nicht, sonst braeuchte es sie im Rezept
     nicht. Also reicht der Auswerter sie durch.

     Eine ausdrueckliche Angabe des Aufrufers gewinnt: wer die Region
     kennt, soll sie setzen koennen. */
  const _eingabeK = (r && r.kategorie && modell.achse_k_feld
                     && (eingabe || {})[modell.achse_k_feld] == null)
    ? { ...(eingabe || {}), [modell.achse_k_feld]: r.kategorie }
    : (eingabe || {});


  /* v1094-WEUR · EIN EURO-BETRAG BEKOMMT SEINE KORREKTUREN.
   *
   * Bis v1093 kehrte diese Stelle sofort zurueck — mit der Begruendung,
   * additive Faktorkorrekturen seien bei einem Euro-Betrag sinnlos. Das
   * stimmte fuer Stadt Paderborn, deren `linear_sachwert` einen
   * Gesamtbetrag liefert und gar keine Korrekturen fuehrt.
   *
   * Wiesbaden fuehrt seine Vergleichsfaktoren (§ 20 ImmoWertV) als Wert JE
   * QUADRATMETER Wohnflaeche, mit einer Korrekturtabelle in DERSELBEN
   * Einheit. Sein Anwendungsbeispiel rechnet 5.171 + (-855) = 4.316, mal
   * 140 m2 = 604.240 EUR. Ohne die Korrektur kaeme 723.940 heraus —
   * 120.000 Euro daneben, und die falsche Zahl sieht plausibel aus.
   *
   * Was NICHT passiert und auch nicht passieren darf: die Umrechnung in
   * einen Faktor und die Pruefung gegen das Faktorband. Ein Euro-Betrag ist
   * kein Faktor; der Einheitenwaechter wuerde ihn zu Recht verwerfen. Er
   * wird in seiner eigenen Einheit gerechnet und in ihr ausgegeben. */
  if (einheit === 'wert_eur' || r.liefert === 'wert_eur') {
    const kE = [];
    const offenE = [];
    for (const k of (modell.korrekturen || [])) {
      const t = korrekturAnwenden(k, _eingabeK);
      if (t && (t.wert || t.wirkung === 'multiplikativ')) kE.push(t);
      else if (t == null) offenE.push(k.bez || k.feld);
    }
    const addE = kE.filter((k) => k.wirkung !== 'multiplikativ');
    const mulE = kE.filter((k) => k.wirkung === 'multiplikativ');
    const stE = modell.rundung_stellen ?? 0;
    const pE = Math.pow(10, stE);
    let betrag = r.tabellenwert + addE.reduce((s, k) => s + k.wert, 0);
    for (const k of mulE) {
      if (!(k.wert > 0)) {
        return nichts('korrektur_unplausibel',
          `Der multiplikative Faktor "${k.merkmal}" ist ${k.wert} — `
          + 'gerechnet wird damit nicht.');
      }
      betrag *= k.wert;
    }
    betrag = Math.round(betrag * pE) / pE;
    if (!(betrag > 0)) {
      return nichts('korrektur_unplausibel',
        'Die Zu-/Abschlaege fuehren auf einen Betrag kleiner oder gleich null.');
    }
    r.liefert = 'wert_eur';
    r.einheit = 'eur';
    r.wert = betrag;
    r.dokumentwert = betrag;
    r.korrekturen = kE;
    r.korrekturen_offen = offenE;
    r.korrekturen_gefuehrt = (modell.korrekturen || []).length;
    r.korrekturen_multiplikativ = mulE.length;
    r.rechenweg = [`Tabellenwert ${r.tabellenwert} EUR`]
      .concat(addE.map((k) => `${k.wert > 0 ? '+' : '−'} ${Math.abs(k.wert)} (${k.merkmal})`))
      .concat(mulE.map((k) => `× ${k.wert} (${k.merkmal})`))
      .join(' ') + ` = ${betrag} EUR`;
    return r;
  }

  const korr = [];
  const offen = [];
  for (const k of (modell.korrekturen || [])) {
    const t = korrekturAnwenden(k, _eingabeK);
    /* v1093-WMUL · Ein additiver Zuschlag von 0,00 ist ein Nichts — so
     * druckt Herford ihn ab (kBgf 0,00), und so wird er seit v1083
     * uebersprungen. Ein MULTIPLIKATIVER Faktor 0 ist kein Nichts: er
     * setzt das Ergebnis auf null. Er waere hier still verschwunden, weil
     * 0 falsy ist, und der Waechter unten haette ihn nie gesehen. */
    if (t && (t.wert || t.wirkung === 'multiplikativ')) korr.push(t);
    else if (t == null) offen.push(k.bez || k.feld);   /* v1085-WOFF */
  }

  /* Die Korrekturen stehen in der Einheit des Berichts — Herford in
   * Faktorpunkten, Dortmund in Prozentpunkten. Deshalb wird HIER, in der
   * Dokumenteinheit, summiert und gerundet. */
  /* v1093-WMUL · ZWEI ARTEN, ZWEI RECHENSCHRITTE.
   *
   * Kiel druckt seine Zu-/Abschlaege als FAKTOREN ab (x 0,89, x 1,16,
   * x 0,82, x 0,78). Additiv verrechnet wuerde aus einem Abschlag auf
   * 78 Prozent ein Zuschlag von 0,78 Faktorpunkten — ein Wert, der im
   * Plausibilitaetsband bleibt und keiner Monotonie- oder Zaehlpruefung
   * auffaellt.
   *
   * Reihenfolge: erst die additive Summe, in Dokumenteinheit gerundet (das
   * ist belegtes Herford-Verhalten), dann die Faktoren, dann EINMAL runden.
   * Eine Zwischenrundung je Faktor wird bewusst NICHT angewandt — kein
   * bisher gelesener Bericht druckt dafuer ein Anwendungsbeispiel ab.
   * Sobald einer es tut, ist es zu messen und hier nachzuziehen, nicht zu
   * vermuten. */
  const addK = korr.filter((k) => k.wirkung !== 'multiplikativ');
  const mulK = korr.filter((k) => k.wirkung === 'multiplikativ');
  const summe = addK.reduce((s, k) => s + k.wert, 0);
  const stellen = modell.rundung_stellen ?? (einheit === 'faktor' ? 2 : 1);
  const p = Math.pow(10, stellen);
  let dokument = Math.round((r.tabellenwert + summe) * p) / p;

  if (mulK.length) {
    /* Ein Zuschlag in Prozentpunkten ist die Abweichung von 1 — ihn zu
     * multiplizieren waere eine Doppelzaehlung. Lieber kein Wert als ein
     * doppelt gezaehlter. */
    if (einheit === 'zuschlag_prozent') {
      return nichts('multiplikativ_auf_zuschlag',
        'Der Datensatz fuehrt multiplikative Korrekturen auf einer Groesse, '
        + 'die selbst schon ein Zuschlag ist. Das waere eine Doppelzaehlung; '
        + 'gerechnet wird damit nicht.');
    }
    for (const k of mulK) {
      if (!(k.wert > 0)) {
        return nichts('korrektur_unplausibel',
          `Der multiplikative Faktor "${k.merkmal}" ist ${k.wert} — `
          + 'gerechnet wird damit nicht.');
      }
      dokument *= k.wert;
    }
    dokument = Math.round(dokument * p) / p;
  }

  const faktor = IN_FAKTOR[einheit](dokument);
  const [bMin, bMax] = BAND[modell.kennzahl] || BAND_STANDARD;   /* v1085-WBND */

  if (!(faktor > 0)) {
    return nichts('korrektur_unplausibel',
      'Die Zu-/Abschlaege fuehren auf einen Wert kleiner oder gleich null.');
  }
  if (faktor < bMin || faktor > bMax) {
    /* Kein Marktbefund, sondern ein Einheitenbefund. */
    return nichts('einheit_unplausibel',
      `Aus ${dokument} (${einheit}) wird ${faktor} — das liegt ausserhalb `
      + `von ${bMin} bis ${bMax} fuer `
      + `${modell.kennzahl || 'sachwertfaktor'}. Der Datensatz weist seine `
      + `Einheit vermutlich falsch aus; gerechnet wird damit nicht.`);
  }

  const zeigen = (v) => v.toFixed(stellen).replace('.', ',');
  /* v1085-WOFF · Welche Korrekturen NICHT angewandt wurden, weil ihr Merkmal
   * nicht erfasst war. Berlin fuehrt sechs Zu-/Abschlaege; ein Faktor, der
   * ohne vier davon zustande kam, sieht genauso aus wie einer mit allen.
   * Jede Zahl traegt ihre Herkunft — auch die Luecken darin. */
  r.korrekturen = korr;
  r.korrekturen_offen = offen;
  r.korrekturen_gefuehrt = (modell.korrekturen || []).length;
  r.einheit = einheit;
  r.dokumentwert = dokument;        /* die Zahl, wie der Bericht sie druckt */
  r.wert = Math.round(faktor * 10000) / 10000;
  r.korrekturen_multiplikativ = mulK.length;   /* v1093-WMUL */
  r.rechenweg = [`Tabellenwert ${zeigen(r.tabellenwert)}`]
    .concat(addK.map((k) => `${k.wert > 0 ? '+' : '−'} ${zeigen(Math.abs(k.wert))} (${k.merkmal})`))
    .concat(mulK.map((k) => `× ${k.wert} (${k.merkmal})`))
    .join(' ') + ` = ${zeigen(dokument)}`
    + (einheit === 'faktor' ? '' : ` ${einheit === 'wert_eur' ? '€' : '%'} `
       + `→ Faktor ${r.wert.toFixed(3).replace('.', ',')}`);
  return r;
}

export default { auswerten, FORMEN: Object.keys(AUSWERTER) };
