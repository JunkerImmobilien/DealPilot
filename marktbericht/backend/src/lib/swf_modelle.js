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
  /* v1880 · Gemessen an Heppenheim (ETW nach Einheiten, Prozent): die aeussere Ebene rechnet ab
     `tabellenwert` weiter und teilt Prozent noch einmal durch 100 - 0,034 wurde zu 0. Das
     Untermodell liefert in `dokumentwert` die Zahl, wie der Bericht sie druckt; DIE ist der
     Tabellenwert dieser Ebene. Und die Kennzahl reist mit, sonst weiss das Untermodell nicht,
     dass es einen Zinssatz und keinen Faktor liefert. */
  const r = auswerten({ ...unter, liefert: unter.liefert || m.liefert,
                        kennzahl: unter.kennzahl || m.kennzahl }, e);
  if (!r.verfuegbar) return { ...r, kategorie: schluessel };

  /* GEMESSEN an Havelland: das Untermodell hatte richtig gerechnet -
     0,92 aus der Tabelle mal 1,16 fuer Baujahr 1900 = 1,07 -, und die
     aeussere Ebene warf es weg. Sie rechnet naemlich ab `tabellenwert`
     weiter, und der stand noch auf den nackten 0,92.

     Der Endwert des Untermodells IST der Tabellenwert dieser Ebene: was
     unten passiert ist, ist von hier aus die Tabelle. Die Korrekturen
     des Untermodells wandern nach `korrekturen_kategorie`, damit sie im
     Rechenweg sichtbar bleiben statt still ueberschrieben zu werden. */
  return { ...r, kategorie: schluessel,
           tabellenwert: (r.dokumentwert != null ? r.dokumentwert : r.wert),
           korrekturen_kategorie: r.korrekturen || [],
           rechenweg_kategorie: r.rechenweg || null,
           korrekturen: [] };
}

/* ═══ v1886-WFW · formelwerk — EIN BLATT, DAS SEINE RECHNUNG IN FAKTOREN SCHREIBT
 *
 * GEMESSEN am 05.10.2026 am laufenden Abruf:
 *
 *     15003000 mfh  ->  nicht verfuegbar: form_unbekannt
 *
 * Acht Registersaetze tragen `form: "formelwerk"`, und der Auswerter kannte
 * die Form nicht — `auswerten()` fiel auf `form_unbekannt`. Betroffen sind
 * Magdeburg (mfh), Kiel (mfh) und GANZ HAMBURG: fuenf Liegenschaftszinssaetze
 * (mfh, efh, etw, buero, produktion_logistik) und ein Sachwertfaktor (efh).
 *
 *   > `form_unbekannt` ist eine Aussage ueber den Auswerter, keine ueber die
 *   > Quelle. Wer sie liest, sucht den Fehler im Register und findet nichts.
 *
 * ── DREI BAUARTEN, GELESEN STATT GERATEN ────────────────────────────────
 *
 * Die drei Blaetter schreiben dieselbe Sache verschieden auf:
 *
 *   linearkombination  Magdeburg: LZ = ( k0 + k1*(1/RND) + k2*WNF + k3*Jahr )²
 *                      Koeffizienten unter `koeffizienten`, Grenzen unter
 *                      `gueltigkeit`, die Jahresstufe diskret.
 *   produkt            Kiel und Hamburg: ein Basiswert mal benannte Faktoren,
 *                      bei Kiel zusaetzlich additive Korrekturwerte danach.
 *   bezug_linear       Hamburg efh/etw: a * LIZI(MFH) + b — die Rechnung
 *                      haengt am ERGEBNIS eines anderen Zweiges.
 *
 * Welche Bauart gilt, sagt `bauart` im Rezept; fehlt es, entscheidet die
 * STRUKTUR des Satzes (Bezug > Basiswert > Koeffizienten). Keine Bauart
 * heisst kein Wert, mit Nennung der gefundenen Schluessel — nicht
 * `form_unbekannt` zum zweiten Mal.
 *
 * ── WAS HIER AUSDRUECKLICH NICHT PASSIERT ───────────────────────────────
 *
 * KEIN FAKTOR WIRD ERFUNDEN. Ein Faktor, dessen Zahl das Blatt nicht nennt,
 * wird nicht auf 1 gesetzt — er macht das ganze Modell unvollstaendig, und
 * der Satz liefert dann KEINEN Wert, sondern eine Liste: welcher Faktor,
 * welche Eingabe fehlt, was im Blatt woertlich dazu steht.
 *
 *   > Ein Faktor, den man auf 1 setzt, ist eine Erfindung mit
 *   > Nachkommastelle. Sie faellt nie auf, weil das Ergebnis plausibel
 *   > bleibt.
 *
 * Ein bedingter Faktor (Erstbezug, eingeschossiger Laden) ist der eine
 * Sonderfall: trifft seine Bedingung NACHWEISLICH nicht zu, faellt er aus
 * dem Produkt heraus — das ist keine Erfindung, sondern die Bedingung des
 * Blattes. Ist die Bedingung NICHT entscheidbar, weil die Angabe fehlt,
 * gibt es keinen Wert. Und wo das Blatt ausdruecklich festhaelt, dass es
 * den Normalfall nicht beziffert (Hamburg, Gebaeudeartfaktor Buero), gilt
 * auch der Normalfall als unbelegt.
 *
 * ── EINE FALLE, DIE ZWEI NAMEN HAT ──────────────────────────────────────
 *
 * In EINEM Hamburger Satz bedeuten `a` und `b` zweierlei:
 *
 *     bodenwertanteilsfaktor   0,67318 + 0,5447 * Anteil      a + b*x
 *     restnutzungsdauerfaktor  -0,0013 * RND + 1,065          b + a*x
 *
 * Wer stumpf `a + b*x` rechnet, bekommt beim zweiten 53 statt 1,00 — oder,
 * schlimmer, einen Wert, der im Band bleibt. Deshalb wird jede lineare
 * Regel gegen die NORMSTELLE geprueft, die das Blatt selbst angibt
 * ("bei Restnutzungsdauer 50 Jahre: 1"). Reproduziert sie keine Lesart,
 * wird nicht gerechnet. Der Pruefmassstab ist das Dokument.
 *
 * ── TEILERGEBNISSE SIND EINE AUSKUNFT ───────────────────────────────────
 *
 * Auch ohne Endwert wird jeder Faktor einzeln ausgewiesen: gerechnet,
 * Eingabe fehlt, Teiltabelle fehlt, nicht maschinenlesbar. Das ist der
 * Unterschied zwischen "geht nicht" und "es fehlt genau das".
 */

/* Welche Eingabenamen zu einer Groesse gehoeren. Die Reihenfolge ist
 * Rangfolge; der erste belegte Name gewinnt. Die kurzen Namen (`rnd`,
 * `wohnflaeche`, `brw`, `baujahr`, `ortsteil`) sind die, die die
 * FELDBRUECKE in gutachterausschuss.js wirklich liefert — alles andere
 * muss der Aufrufer ausdruecklich mitgeben. */
const FW_EINGANG = {
  restnutzungsdauer: ['restnutzungsdauer_jahre', 'rnd_jahre', 'rnd',
                      'restnutzungsdauer'],
  wohn_nutzflaeche_qm: ['wohn_nutzflaeche_qm', 'wohnflaeche_qm', 'wohnflaeche',
                        'wfl', 'nutzflaeche_qm'],
  /* Der normierte Bodenrichtwert ist NICHT der Bodenrichtwert: Hamburg
     normiert auf eine WGFZ von 1,0 und den 31.12.2019, Kiel auf WGFZ 1,5
     und den 31.12.2020. Er faellt deshalb ausdruecklich NICHT auf `brw`
     zurueck — eine Normierung, die man nicht gerechnet hat, darf man nicht
     unterstellen. */
  norm_brw: ['norm_brw_eur_qm', 'normbrw_eur_qm', 'norm_brw', 'normbrw',
             'nbrw_eur_qm'],
  brw: ['brw_eur_qm', 'brw_sqm', 'brw', 'bodenrichtwert_eur_qm'],
  nettokaltmiete: ['nettokaltmiete_eur_m2_monat', 'nettokaltmiete_eur_qm_monat',
                   'nkm_eur_qm', 'nettokaltmiete'],
  alter: ['alter_jahre', 'alter'],
  baujahr: ['baujahr', 'build_year'],
  stadtteil: ['stadtteil', 'ortsteil'],
  stichtag: ['stichtag', 'wertermittlungsstichtag', 'bewertungsstichtag'],
  jahr: ['jahr', 'jahr_klasse', 'wertermittlungsjahr', 'jahrgang'],
  sachwert: ['sachwert', 'sachwert_eur', 'vorlaeufiger_sachwert_eur'],
  bodenwertanteil: ['bodenwertanteil', 'bodenwertanteil_pct'],
  grundstuecksflaeche: ['grundstuecksflaeche_qm', 'flaeche_qm', 'flaeche', 'gsfl'],
  erstbezug: ['erstbezug'],
  gebaeudeart: ['gebaeudeart_laden', 'eingeschossiger_laden'],
  bezugswert: ['bezugswert_pct', 'bezugswert', 'lizi_mfh_pct'],
};

/* Welche Groesse ein benannter Faktor liest. Jede Zeile ist am WORTLAUT des
 * Blattes belegt — der Hinweis des Satzes nennt sie selbst:
 *   lagefaktor      "NormBRW19 = ... bei einer WGFZ von 1,0"  (Hamburg)
 *   af_nbrw         "normiertes Bodenrichtwertniveau 2020"     (Kiel)
 *   af_nkm          "Anpassungsfaktor Nettokaltmiete"          (Kiel)
 *   af_zeit         "Anpassungsfaktor Wertermittlungszeitpunkt"(Kiel)
 *   altersfaktor    "Alter = Kalenderjahr des Wertermittlungs-
 *                    stichtages - Baujahr"                     (Hamburg)
 * Ein Faktor, der hier nicht steht und im Satz kein `feld` traegt, wird
 * NICHT geraten: er kommt als `faktor_ohne_feld` in die Auskunft. */
const FW_FAKTOR_FELD = {
  lagefaktor: 'norm_brw',            /* ueberschrieben, wenn der Satz BRW nennt */
  af_nbrw: 'norm_brw',
  af_nkm: 'nettokaltmiete',
  af_zeit: 'jahr',
  altersfaktor: 'alter',
  baujahrsfaktor: 'baujahr',
  erstbezugsfaktor: 'erstbezug',
  gebaeudeartfaktor: 'gebaeudeart',
  stadtteilfaktor: 'stadtteil',
  aktualisierungsfaktor: 'stichtag',
  sachwerthoehenfaktor: 'sachwert',
  bodenwertanteilsfaktor: 'bodenwertanteil',
  grundstuecksgroessenfaktor: 'grundstuecksflaeche',
  wohnflaechenfaktor: 'wohn_nutzflaeche_qm',
  restnutzungsdauerfaktor: 'restnutzungsdauer',
};

/* Schluessel, die eine BESCHREIBUNG sind und keine Stuetzstelle. Ohne diese
 * Liste liest der Klassenleser `basis: "bei Baujahr ab 1980 bis 1989: 1"`
 * als Klasse und trifft sie nie. */
const FW_META = new Set(['basis', 'hinweis', 'bez', 'formel', 'bedingung',
  'gueltig_wenn', 'interpolation', 'anmerkung', 'anmerkung_erfassung',
  'fussnote', 'sonderfall', 'alter_definition', 'kappung', 'a', 'b',
  'exponent', 'wert', 'stufen', 'norm_brw', 'norm_brw_stichtag', 'brw',
  'norm', 'normstelle', 'baujahrstypische_punktzahl', 'feld',
  'rundung_stellen', 'quelle', 'fundstelle', 'sonst']);

const fwNorm = (s) => String(s == null ? '' : s).toLowerCase().trim()
  .replace(/\s+/g, ' ');

/** Den Stamm eines Registerfeldnamens auf eine Groesse der Bruecke abbilden.
 *
 * GEMESSEN an Dresden: der Term heisst dort `ln_vorlaeufiger_sachwert`, das
 * Eingabefeld `vorlaeufiger_sachwert_eur`. Ein Vergleich nur gegen die
 * STAMMNAMEN findet das nicht — `sachwert` steckt mitten im Wort. Deshalb
 * wird gegen alle Namen der Bruecke verglichen, und zwar in dieser
 * Rangfolge: genauer Name, dann Name mit Einheitenanhang
 * (`..._eur`, `..._jahre`, `..._eur_qm`), dann Stamm.
 *
 * Was auch dann nicht passt, bleibt wie es ist und fuehrt zu `feld_fehlt`
 * MIT NENNUNG der gesuchten Namen — besser eine Luecke, die sagt, wonach
 * sie gesucht hat, als ein Treffer auf der falschen Groesse. */
function fwStamm(feld) {
  const f = fwNorm(feld).replace(/ /g, '_');
  if (FW_EINGANG[f]) return f;
  for (const [k, namen] of Object.entries(FW_EINGANG)) {
    if (namen.includes(f)) return k;
  }
  for (const [k, namen] of Object.entries(FW_EINGANG)) {
    if (namen.some((n) => n.startsWith(f + '_') || f.startsWith(n + '_'))) return k;
  }
  for (const k of Object.keys(FW_EINGANG)) {
    if (f.startsWith(k) || k.startsWith(f)) return k;
  }
  return f;
}

/** Einen Eingabewert holen. Gibt IMMER Auskunft, welcher Name gesucht wurde. */
function fwWert(e, stamm) {
  const namen = FW_EINGANG[stamm] || [stamm];
  for (const n of namen) {
    const v = (e || {})[n];
    if (v !== undefined && v !== null && v !== '') {
      return { da: true, wert: v, feld: n, namen };
    }
  }
  return { da: false, wert: null, feld: namen[0], namen };
}

/** Das Jahr einer Eingabe: aus `jahr` oder aus dem Stichtag. */
function fwJahr(e) {
  const j = fwWert(e, 'jahr');
  if (j.da) {
    const n = zahl(j.wert);
    if (n !== null && n > 1900 && n < 2200) return { da: true, jahr: n, feld: j.feld };
    return { da: true, jahr: null, text: String(j.wert), feld: j.feld };
  }
  const s = fwWert(e, 'stichtag');
  if (s.da) {
    const m = /(\d{4})/.exec(String(s.wert));
    if (m) return { da: true, jahr: Number(m[1]), feld: s.feld };
  }
  return { da: false, jahr: null, feld: 'jahr' };
}

/** Das Alter: direkt, oder aus Baujahr und Stichtagsjahr — so, wie das Blatt
 *  es selbst definiert ("Alter = Kalenderjahr des Wertermittlungsstichtages
 *  minus Baujahr"). OHNE Stichtag wird es nicht geschaetzt. */
function fwAlter(e) {
  const a = fwWert(e, 'alter');
  if (a.da && zahl(a.wert) !== null) {
    return { da: true, wert: zahl(a.wert), herkunft: a.feld };
  }
  const bj = fwWert(e, 'baujahr');
  const j = fwJahr(e);
  if (bj.da && zahl(bj.wert) !== null && j.da && j.jahr) {
    return { da: true, wert: j.jahr - zahl(bj.wert),
             herkunft: `${j.feld} (${j.jahr}) − ${bj.feld}` };
  }
  return { da: false, wert: null,
           fehlt: bj.da ? 'stichtag (fuer das Kalenderjahr)'
                        : 'alter_jahre, oder baujahr und stichtag' };
}

/** Eine Teiltabelle des Satzes finden, auf die ein Faktor verweist
 *  ("siehe stadtteile_lzs"). Gesucht wird in `modellansaetze` — dort liegen
 *  sie bei Hamburg, unter einem ANDEREN Namen als im Verweis
 *  (`stadtteilfaktoren` gegen `stadtteile_lzs`). Verglichen wird deshalb
 *  ueber den Stamm des FAKTORNAMENS, und der kuerzeste Treffer gewinnt:
 *  `aktualisierung` vor `aktualisierung_untersuchungszeitraum`. */
function fwTeiltabelle(m, faktorname) {
  const ma = (m && m.modellansaetze) || {};
  const stamm = fwNorm(faktorname).replace(/faktor(en)?$/, '').replace(/s$/, '');
  if (!stamm) return null;
  const treffer = Object.keys(ma)
    .filter((k) => fwNorm(k).includes(stamm) && ma[k] && typeof ma[k] === 'object')
    .sort((p, q) => p.length - q.length);
  if (!treffer.length) return null;
  return { tab: ma[treffer[0]], quelle: 'modellansaetze.' + treffer[0] };
}

const FW_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Aus einer Tabelle den Wert holen. Die FORM der Schluessel sagt, womit
 *  nachgeschlagen wird — Datum, Zahl oder Name. Kein Nachbar, kein Mittel.
 *  Zwischen Stuetzstellen wird nur interpoliert, wo das Blatt es ausdruecklich
 *  erlaubt (`interpolation`); sonst zaehlt allein der Treffer. */
function fwAusTabelle(tab, name, e, stamm, opt = {}) {
  const schluessel = Object.keys(tab || {}).filter((k) => !FW_META.has(k));
  if (!schluessel.length) return { status: 'teiltabelle_leer' };
  const alleDatum = schluessel.every((k) => FW_ISO.test(k));
  const alleZahl = schluessel.every((k) => zahl(k) !== null);
  const holen = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return zahl(v.faktor !== undefined ? v.faktor : v.wert);
    }
    return zahl(v);
  };

  if (alleDatum) {
    const s = fwWert(e, 'stichtag');
    if (!s.da) {
      return { status: 'eingabe_fehlt', benoetigt: 'stichtag', auswahl: schluessel };
    }
    const tag = String(s.wert).slice(0, 10);
    if (!Object.prototype.hasOwnProperty.call(tab, tag)) {
      return { status: 'stichtag_ohne_faktor', benoetigt: 'stichtag',
        auswahl: schluessel, gegeben: tag };
    }
    const w = holen(tab[tag]);
    if (w === null) return { status: 'tabelle_ohne_wert', gegeben: tag };
    return { status: 'gerechnet', wert: w, auspraegung: tag };
  }

  if (alleZahl) {
    let x = null, feld = stamm;
    if (stamm === 'jahr') {
      const j = fwJahr(e);
      if (!j.da || j.jahr === null) {
        return { status: 'eingabe_fehlt', benoetigt: 'jahr oder stichtag' };
      }
      x = j.jahr; feld = j.feld;
    } else {
      const f = fwWert(e, stamm);
      if (!f.da || zahl(f.wert) === null) {
        return { status: 'eingabe_fehlt', benoetigt: stamm };
      }
      x = zahl(f.wert); feld = f.feld;
    }
    const achse = schluessel.map(Number).sort((p, q) => p - q);
    const genau = achse.find((v) => v === x);
    if (genau !== undefined) {
      const w = holen(beiZahl(tab, genau));
      if (w === null) return { status: 'tabelle_ohne_wert', gegeben: x };
      return { status: 'gerechnet', wert: w, auspraegung: `${x} (${feld})` };
    }
    if (!opt.interpolieren) {
      return { status: 'zwischen_den_stuetzstellen', gegeben: x,
        auswahl: achse,
        hinweis_fw: 'Das Blatt erlaubt keine Interpolation; zwischen den '
          + 'Stuetzstellen gibt es keinen Wert.' };
    }
    const n = nachbarn(achse, x);
    if (!n) {
      return { status: 'ausserhalb_der_tabelle', gegeben: x,
        spanne: [achse[0], achse[achse.length - 1]] };
    }
    const a0 = holen(beiZahl(tab, n[0])), a1 = holen(beiZahl(tab, n[1]));
    if (a0 === null || a1 === null) return { status: 'tabelle_ohne_wert', gegeben: x };
    return { status: 'gerechnet', wert: zwischen(x, n[0], n[1], a0, a1),
      auspraegung: `${x} (${feld}, zwischen ${n[0]} und ${n[1]})`, stuetzstellen: n };
  }

  /* Namenstabelle: Stadtteile. Ohne Beachtung der Gross-/Kleinschreibung,
     aber nicht unscharf — wer einen Namen falsch schreibt, bekommt keinen
     Faktor statt eines falschen. */
  const f = fwWert(e, stamm);
  if (!f.da) {
    return { status: 'eingabe_fehlt', benoetigt: stamm, auswahl_zahl: schluessel.length };
  }
  const gesucht = fwNorm(f.wert);
  const k = schluessel.find((x) => fwNorm(x) === gesucht);
  if (k === undefined) {
    return { status: 'name_unbekannt', gegeben: String(f.wert),
      auswahl_zahl: schluessel.length };
  }
  const w = holen(tab[k]);
  if (w === null) {
    /* Hamburg: Neuwerk traegt in keiner Stadtteiltabelle einen Faktor —
       der Geltungsbereich lautet ueberall "ganz Hamburg ohne Neuwerk". */
    return { status: 'ohne_wert', gegeben: k };
  }
  return { status: 'gerechnet', wert: w, auspraegung: k };
}

/** Eine einfache Zahlenbedingung aus dem Wortlaut lesen ("Alter < 30 Jahre").
 *  Was sich nicht so lesen laesst, gilt als NICHT maschinenlesbar — es wird
 *  nicht sinngemaess ausgelegt. */
function fwBedingung(text) {
  const m = /(<=|>=|<|>)\s*([0-9]+(?:[.,][0-9]+)?)/.exec(String(text || ''));
  if (!m) return null;
  return { op: m[1], schwelle: Number(String(m[2]).replace(',', '.')) };
}

/** Der Normalfall eines bedingten Faktors. Belegt ist er, wenn das Blatt ihn
 *  nennt — `sonst: <zahl>` oder eine Basisangabe, die auf ": 1" endet
 *  ("bei Alter 30 Jahre: 1", "keine Ecklage: 1").
 *
 *  EIN BEDINGTER EINZELWERT ist der Sonderfall, und zwar ein belegter: ein
 *  Faktor, den das Blatt NUR fuer eine Bedingung beziffert (Erstbezug 0,83),
 *  steht in einer Formel, die fuer JEDES Objekt dieser Art gelten soll. Fuer
 *  ein Objekt ohne Erstbezug kommt er im Produkt gar nicht vor — das ist
 *  rechnerisch die Eins und keine Erfindung. Entscheidend ist, dass die
 *  Bedingung NACHWEISLICH nicht zutrifft; ist sie unbekannt, wird nicht
 *  gerechnet (das entscheidet der Aufrufer in `fwFaktor`).
 *
 *  Haelt der Satz dagegen ausdruecklich fest, dass der Normalfall NICHT
 *  beziffert ist — Hamburg, Gebaeudeartfaktor Buero: „Ein Wert fuer den
 *  Normalfall (sonst) ist im Bericht nicht beziffert" —, dann bleibt er
 *  unbelegt. Diese Zeile hat ein Mensch beim Ernten hingeschrieben, weil es
 *  ihm auffiel; sie wird nicht uebergangen. */
function fwNormalfall(def, opt = {}) {
  const s = zahl(def && def.sonst);
  if (s !== null) return { da: true, wert: s, beleg: 'sonst' };
  const txt = String((def && (def.anmerkung_erfassung || def.hinweis)) || '');
  if (/nicht\s+bezif/i.test(txt)) {
    return { da: false, grund: 'normalfall_nicht_beziffert', wortlaut: txt };
  }
  const basis = String((def && def.basis) || '');
  if (/:\s*1(?:[.,]0+)?\s*$/.test(basis)) {
    return { da: true, wert: 1, beleg: basis };
  }
  if (opt.bedingt) {
    return { da: true, wert: 1,
      beleg: 'bedingter Faktor; ausserhalb seiner Bedingung kommt er im '
        + 'Produkt des Blattes nicht vor' };
  }
  return { da: false, grund: 'normalfall_nicht_belegt' };
}

/** Die NORMSTELLE aus der Basisangabe: die Stelle, an der das Blatt den Wert
 *  des Faktors ausdruecklich nennt.
 *  "bei Restnutzungsdauer 50 Jahre: 1" -> { x: 50,  soll: 1 }
 *  "bei Bodenwertanteil von 60%: 1"    -> { x: 0.6, soll: 1, prozent: true }
 *
 *  EIN PROZENTZEICHEN IST EINE EINHEIT, KEINE ZIERDE: in die Gleichung geht
 *  der Anteil als Dezimalbruch ein (0,67318 + 0,5447 · 0,60 = 1,00), nicht
 *  die Zahl 60. Wer die 60 einsetzt, bekommt 33 — das haelt kein Band aus,
 *  aber beim naechsten Faktor derselben Art faellt es vielleicht nicht auf. */
function fwNormstelle(def) {
  const t = String((def && def.basis) || '');
  const m = /([0-9]+(?:[.,][0-9]+)?)\s*(%|Prozent)?[^:]*:\s*([0-9]+(?:[.,][0-9]+)?)\s*$/.exec(t);
  if (!m) return null;
  const roh = Number(m[1].replace(',', '.'));
  return { x: m[2] ? roh / 100 : roh, x_roh: roh, prozent: !!m[2],
    soll: Number(m[3].replace(',', '.')), wortlaut: t };
}

/** Klassenschluessel wie "bis 1939", "1940 bis 1959", "ab 1980". */
function fwKlasse(schluessel, x) {
  for (const k of schluessel) {
    const t = fwNorm(k);
    let m = /^bis\s+(-?\d+(?:[.,]\d+)?)$/.exec(t);
    if (m && x <= Number(m[1].replace(',', '.'))) return k;
    m = /^ab\s+(-?\d+(?:[.,]\d+)?)$/.exec(t);
    if (m && x >= Number(m[1].replace(',', '.'))) return k;
    m = /^(-?\d+(?:[.,]\d+)?)\s*(?:bis|-|–)\s*(-?\d+(?:[.,]\d+)?)$/.exec(t);
    if (m && x >= Number(m[1].replace(',', '.'))
           && x <= Number(m[2].replace(',', '.'))) return k;
  }
  return null;
}

/**
 * EINEN Faktor aufloesen. Gibt immer dieselbe Form zurueck, damit die
 * Auskunft jeden Faktor einzeln ausweisen kann:
 *   { faktor, status, wert?, benoetigt?, wortlaut?, art }
 * `status: 'gerechnet'` ist der einzige, der einen Wert traegt.
 */
function fwFaktor(name, def, m, e) {
  const aus = { faktor: name, status: 'nicht_maschinenlesbar', art: null,
    wortlaut: null };
  let stamm = (def && def.feld) ? fwStamm(def.feld)
    : (FW_FAKTOR_FELD[fwNorm(name)] || null);

  /* 1 · eine nackte Zahl */
  if (typeof def === 'number') {
    return { ...aus, status: 'gerechnet', wert: def, art: 'konstante' };
  }

  /* 2 · ein Verweis auf eine Teiltabelle ("siehe stadtteile_lzs") */
  if (typeof def === 'string') {
    aus.art = 'verweis';
    aus.wortlaut = def;
    const t = fwTeiltabelle(m, name);
    if (!t) {
      return { ...aus, status: 'teiltabelle_fehlt', verweis: def,
        benoetigt: 'Teiltabelle "' + def.replace(/^siehe\s*/i, '')
          + '" im Registersatz' };
    }
    if (!stamm) {
      return { ...aus, status: 'faktor_ohne_feld', quelle: t.quelle,
        benoetigt: 'Angabe im Rezept, welche Groesse diese Tabelle liest (`feld`)' };
    }
    const r = fwAusTabelle(t.tab, name, e, stamm);
    return { ...aus, ...r, art: 'tabelle', quelle: t.quelle };
  }

  if (!def || typeof def !== 'object') {
    return { ...aus, status: 'faktor_ohne_regel' };
  }

  aus.wortlaut = def.formel || def.bedingung || def.bez || def.hinweis || null;

  /* 3 · Stufentabelle im Faktor selbst (Kiel: af_zeit, af_nbrw, af_nkm) */
  if (def.stufen && typeof def.stufen === 'object') {
    if (!stamm) {
      return { ...aus, status: 'faktor_ohne_feld',
        benoetigt: 'Angabe im Rezept, welche Groesse dieser Faktor liest (`feld`)' };
    }
    const r = fwAusTabelle(def.stufen, name, e, stamm,
      { interpolieren: !!def.interpolation });
    return { ...aus, ...r, art: 'stufen' };
  }

  /* 4 · Potenz um eine Normstelle: (x / norm) ^ exponent */
  const exp = zahl(def.exponent);
  if (exp !== null) {
    aus.art = 'potenz';
    let norm = null, normFeld = null;
    for (const k of ['norm_brw', 'brw', 'norm', 'normstelle']) {
      if (zahl(def[k]) !== null) { norm = zahl(def[k]); normFeld = k; break; }
    }
    if (norm === null || !(norm > 0)) {
      /* Zwei verschiedene Luecken, und sie brauchen verschiedene Namen:
         Hamburgs Grundstuecksgroessenfaktor nennt seine Normstelle (600 m²)
         NUR im Formeltext — da fehlt eine Zahl. Der Miethoehenfaktor
         (MM/RM)^0,0948 hat dagegen gar keine Normstelle: er teilt zwei
         GROESSEN, und die zweite (Referenzmiete) ist selbst ein Modell. */
      if (/\([^()\/]*\/\s*[A-Za-zÄÖÜäöü][^()\/\d]*\)/.test(String(def.formel || ''))) {
        return { ...aus, status: 'quotient_nicht_maschinenlesbar',
          benoetigt: 'beide Groessen des Quotienten als Felder im Rezept '
            + '(hier: marktuebliche Miete und Referenzmiete)' };
      }
      return { ...aus, status: 'normstelle_nicht_beziffert',
        benoetigt: 'Normstelle als Zahl im Rezept (`norm`)' };
    }
    /* Welche Groesse gemessen wird, sagt der Satz mit dem Namen der
       Normstelle: `brw` heisst Bodenrichtwert, `norm_brw` heisst der
       NORMIERTE. Hamburgs Produktions-/Logistikzweig rechnet mit dem
       nackten BRW22, der Wohnzweig mit dem normierten. */
    if (normFeld === 'brw') stamm = 'brw';
    else if (normFeld === 'norm_brw') stamm = 'norm_brw';
    if (!stamm) {
      return { ...aus, status: 'faktor_ohne_feld',
        benoetigt: 'Angabe im Rezept, welche Groesse dieser Faktor liest (`feld`)' };
    }
    const f = fwWert(e, stamm);
    if (!f.da || zahl(f.wert) === null) {
      return { ...aus, status: 'eingabe_fehlt', benoetigt: stamm };
    }
    const x = zahl(f.wert);
    if (!(x > 0)) {
      return { ...aus, status: 'eingabe_unbrauchbar', benoetigt: stamm, gegeben: x };
    }
    /* Eine Kappung gehoert zum Modell. Steht sie nur als Satz da, wird der
       Faktor NICHT gerechnet — ungekappt waere er ausserhalb dessen, was
       das Blatt zulaesst. */
    if (def.kappung && zahl(def.kappung.schwelle) === null) {
      return { ...aus, status: 'kappung_nicht_maschinenlesbar',
        wortlaut: def.kappung.bedingung || null,
        benoetigt: 'Kappungsschwelle als Zahl im Rezept (`kappung.schwelle`)' };
    }
    let v = Math.pow(x / norm, exp);
    if (def.kappung) {
      const sw = zahl(def.kappung.schwelle), kw = zahl(def.kappung.wert);
      if (sw !== null && kw !== null && x / norm >= sw) v = kw;
    }
    if (!Number.isFinite(v)) return { ...aus, status: 'term_unbestimmt' };
    return { ...aus, status: 'gerechnet', wert: v,
      auspraegung: `${x} (${f.feld})`, rechnung: `(${x} / ${norm})^${exp}` };
  }

  /* 5 · linear: a + b * x bzw. b + a * x — welche Lesart gilt, entscheidet
   *     die Normstelle des Blattes, nicht die Reihenfolge der Buchstaben. */
  const ka = zahl(def.a), kb = zahl(def.b);
  if (ka !== null && kb !== null) {
    aus.art = 'linear';
    /* Eine lineare Regel, die NUR in einem Abschnitt gilt (Hamburg:
       "RND <= 15 Jahre" / "RND 16 bis 50 Jahre" / "RND > 50 Jahre"), ist
       kein linearer Faktor, sondern eine Verzweigung. Sie halb zu rechnen
       traefe den mittleren Abschnitt und waere in den beiden anderen
       falsch — unauffaellig falsch. */
    const zweige = Object.keys(def).filter((k) => !FW_META.has(k)
      && /(<=|>=|<|>|\bbis\b)/i.test(k));
    if (zweige.length) {
      return { ...aus, status: 'verzweigung_nicht_maschinenlesbar',
        zweige, benoetigt: 'die Abschnitte als Regeln im Rezept' };
    }
    if (!stamm) {
      return { ...aus, status: 'faktor_ohne_feld',
        benoetigt: 'Angabe im Rezept, welche Groesse dieser Faktor liest (`feld`)' };
    }
    const w = (stamm === 'alter') ? fwAlter(e) : (() => {
      const f = fwWert(e, stamm);
      return { da: f.da && zahl(f.wert) !== null, wert: zahl(f.wert),
               herkunft: f.feld };
    })();
    if (!w.da) {
      return { ...aus, status: 'eingabe_fehlt', benoetigt: w.fehlt || stamm };
    }
    const bed = def.gueltig_wenn ? fwBedingung(def.gueltig_wenn) : null;
    if (def.gueltig_wenn && !bed) {
      return { ...aus, status: 'bedingung_nicht_maschinenlesbar',
        wortlaut: String(def.gueltig_wenn) };
    }
    if (bed) {
      const x0 = w.wert;
      const trifft = bed.op === '<' ? x0 < bed.schwelle
                   : bed.op === '<=' ? x0 <= bed.schwelle
                   : bed.op === '>' ? x0 > bed.schwelle
                   : x0 >= bed.schwelle;
      if (!trifft) {
        const nf = fwNormalfall(def);
        if (!nf.da) {
          return { ...aus, status: nf.grund,
            wortlaut: nf.wortlaut || def.basis || null };
        }
        return { ...aus, status: 'gerechnet', wert: nf.wert, art: 'normalfall',
          auspraegung: `${x0} — "${def.gueltig_wenn}" trifft nicht zu`,
          rechnung: `Normalfall ${nf.wert} laut Blatt: ${nf.beleg}` };
      }
    }
    /* Die Lesart gegen die Normstelle pruefen. Hamburg nennt sie zu jedem
       linearen Faktor ("bei Bodenwertanteil von 60%: 1"). */
    const ns = fwNormstelle(def);
    const lesarten = [
      { bez: 'a + b*x', f: (x) => ka + kb * x },
      { bez: 'b + a*x', f: (x) => kb + ka * x },
    ];
    let gewaehlt = lesarten[0], geprueft = false;
    if (ns) {
      const treffer = lesarten.filter((l) => Math.abs(l.f(ns.x) - ns.soll) <= 0.005);
      if (!treffer.length) {
        return { ...aus, status: 'normstelle_nicht_reproduzierbar',
          wortlaut: ns.wortlaut,
          benoetigt: 'eine Lesart von a und b, die die Normstelle trifft' };
      }
      gewaehlt = treffer[0]; geprueft = true;
      /* Nennt das Blatt seine Normstelle in Prozent, geht in die Gleichung
         der Dezimalbruch ein. Eine Eingabe von 62 statt 0,62 waere dann um
         den Faktor 100 daneben — und das wird nicht stillschweigend
         zurechtgebogen, sondern gefragt. */
      if (ns.prozent && w.wert > 1) {
        return { ...aus, status: 'eingang_einheit_unklar', wortlaut: ns.wortlaut,
          gegeben: w.wert,
          benoetigt: `${stamm} als Dezimalbruch (Normstelle laut Blatt: `
            + `${ns.x_roh} % = ${ns.x})` };
      }
    }
    const v = gewaehlt.f(w.wert);
    if (!Number.isFinite(v)) return { ...aus, status: 'term_unbestimmt' };
    return { ...aus, status: 'gerechnet', wert: v,
      auspraegung: String(w.wert) + (w.herkunft ? ` (${w.herkunft})` : ''),
      rechnung: `${gewaehlt.bez} mit a=${ka}, b=${kb}, x=${w.wert}`,
      normstelle_geprueft: geprueft,
      eingang_einheit: (ns && ns.prozent) ? 'Dezimalbruch (Blatt nennt Prozent)' : null };
  }

  /* 6 · bedingter Einzelwert (Erstbezug, eingeschossiger Laden) */
  const wz = zahl(def.wert);
  if (wz !== null && def.bedingung) {
    aus.art = 'bedingt';
    if (!stamm) {
      return { ...aus, status: 'faktor_ohne_feld',
        benoetigt: 'Angabe im Rezept, welches Merkmal die Bedingung '
          + 'entscheidet (`feld`)' };
    }
    const f = fwWert(e, stamm);
    if (!f.da) {
      return { ...aus, status: 'eingabe_fehlt', benoetigt: stamm,
        wortlaut: String(def.bedingung) };
    }
    const ja = f.wert === true || /^(1|ja|true|wahr|j)$/i.test(String(f.wert));
    if (ja) {
      return { ...aus, status: 'gerechnet', wert: wz,
        auspraegung: 'Bedingung trifft zu' };
    }
    const nf = fwNormalfall(def, { bedingt: true });
    if (!nf.da) {
      return { ...aus, status: nf.grund,
        wortlaut: nf.wortlaut || String(def.bedingung) };
    }
    return { ...aus, status: 'gerechnet', wert: nf.wert, art: 'normalfall',
      auspraegung: 'Bedingung trifft nicht zu' };
  }
  if (wz !== null) {
    return { ...aus, status: 'gerechnet', wert: wz, art: 'konstante' };
  }

  /* 7 · Klassentabelle ("bis 1939", "1940 bis 1959", "ab 1980") */
  const kl = Object.keys(def).filter((k) => !FW_META.has(k)
    && zahl(def[k]) !== null);
  if (kl.length) {
    aus.art = 'klassen';
    if (!stamm) {
      return { ...aus, status: 'faktor_ohne_feld', auswahl: kl,
        benoetigt: 'Angabe im Rezept, welche Groesse dieser Faktor liest (`feld`)' };
    }
    const f = fwWert(e, stamm);
    if (!f.da || zahl(f.wert) === null) {
      return { ...aus, status: 'eingabe_fehlt', benoetigt: stamm };
    }
    const x = zahl(f.wert);
    const k = fwKlasse(kl, x);
    if (k === null) {
      /* Zwischen Klassen wird NICHT interpoliert und ueber sie hinaus nicht
         fortgeschrieben: ein Baujahr faellt in genau eine Klasse. */
      return { ...aus, status: 'ausserhalb_der_klassen', gegeben: x, auswahl: kl };
    }
    return { ...aus, status: 'gerechnet', wert: zahl(def[k]),
      auspraegung: `${k} (${f.feld} = ${x})` };
  }

  return { ...aus, status: 'faktor_ohne_regel',
    benoetigt: 'Zahl oder Regel im Rezept',
    gefundene_schluessel: Object.keys(def) };
}

/** Die additiven Korrekturwerte eines Formelwerks (Kiel: Prozentpunkte NACH
 *  den multiplikativen Faktoren). Angewandt wird nur, was BENANNT ist —
 *  ein Stadtteil, den niemand angegeben hat, bekommt keine Korrektur und
 *  erscheint stattdessen in `korrekturen_offen`. Das ist dieselbe Regel wie
 *  bei `art: 'kategorial'`: wer einen Namen nicht nennt, bekommt keine
 *  Korrektur statt einer falschen — aber die Luecke steht im Rechenweg. */
function fwKorrekturen(tab, e) {
  const an = [], offen = [];
  const merkmale = new Set();
  for (const k of ['nutzungsart', 'objektart', 'objektart_bez', 'zweig',
                   'gebaeudeart']) {
    if (e && e[k]) merkmale.add(fwNorm(e[k]));
  }
  if (Array.isArray(e && e.merkmale)) e.merkmale.forEach((x) => merkmale.add(fwNorm(x)));
  const st = fwWert(e || {}, 'stadtteil');
  const stadtteil = st.da ? fwNorm(st.wert) : null;

  for (const [name, roh] of Object.entries(tab || {})) {
    const w = zahl(roh);
    if (w === null) continue;                 /* `hinweis` ist kein Korrekturwert */
    const mSt = /^stadtteil\s+(.+)$/i.exec(name);
    if (mSt) {
      if (stadtteil && fwNorm(mSt[1]) === stadtteil) an.push({ merkmal: name, wert: w });
      else if (!stadtteil) offen.push(name + ' (Stadtteil nicht angegeben)');
      continue;
    }
    if (merkmale.has(fwNorm(name))
        || (/gesch[äa]ftshaus/i.test(name) && merkmale.has('wgh'))) {
      an.push({ merkmal: name, wert: w });
    } else if (!merkmale.size) {
      offen.push(name + ' (Nutzungsart nicht angegeben)');
    }
  }
  return { an, offen };
}

/** Bauart `linearkombination` — Magdeburg. */
function fwLinearkombination(m, e) {
  const ko = m.koeffizienten || {};
  const namen = Object.keys(ko);
  if (!namen.length) {
    return nichts('kein_koeffizient', 'Der Satz fuehrt keine Koeffizienten.');
  }

  /* Der Geltungsbereich steht VOR der Rechnung. Ohne die Angabe wird nicht
     gerechnet: eine Grenze, die man nicht pruefen kann, ist nicht gewahrt. */
  for (const [feld, spanne] of Object.entries(m.gueltigkeit || {})) {
    if (!Array.isArray(spanne) || spanne.length !== 2) continue;
    const stamm = fwStamm(feld);
    const f = fwWert(e, stamm);
    if (!f.da || zahl(f.wert) === null) {
      return nichts('feld_fehlt',
        `${feld} ist nicht erfasst. Die Regressionsfunktion gilt nur fuer `
        + `${feld} von ${spanne[0]} bis ${spanne[1]}; ohne die Angabe laesst `
        + `sich das nicht pruefen, und ohne Pruefung wird nicht gerechnet. `
        + `Gesucht wurde unter: ${(FW_EINGANG[stamm] || [stamm]).join(', ')}.`);
    }
    const x = zahl(f.wert);
    if (x < spanne[0] || x > spanne[1]) {
      return nichts('ausserhalb_der_stichprobe',
        `${feld} = ${x} liegt ausserhalb von ${spanne[0]} bis ${spanne[1]}. `
        + 'Der Bericht hat dort nichts abgeleitet; extrapoliert wird nicht.');
    }
  }

  let summe = 0;
  const teile = [];
  for (const name of namen) {
    const c = zahl(ko[name]);
    if (c === null) return nichts('kein_koeffizient', `${name} ohne Zahl.`);
    if (/^(konstante|intercept|achsabschnitt)$/i.test(name)) {
      summe += c; teile.push(`${c}`); continue;
    }
    let art = 'linear', feld = name;
    if (/^inv_/.test(name)) { art = 'inv'; feld = name.slice(4); }
    else if (/^ln_/.test(name)) { art = 'ln'; feld = name.slice(3); }
    else if (/^log10_/.test(name)) { art = 'log10'; feld = name.slice(6); }
    else if (/_diskret$/.test(name)) { art = 'diskret'; feld = name.replace(/_diskret$/, ''); }

    let x = null, ausp = null;
    if (art === 'diskret') {
      /* Die diskrete Stufe steht als TABELLE im Satz. `_anwendung` gewinnt
         gegen `_laut_blatt`: Magdeburgs Blatt druckt seine Jahresbasis
         VERTAUSCHT, und das steht dort ausdruecklich (`formel.hinweis`,
         `auflagen`). Eine Korrektur, die nur im Fliesstext steht, rechnet
         niemand mit — sie gehoert als ZAHL ins Feld. */
      const tab = m[feld + '_basis_anwendung'] || m[feld + '_basis']
               || m[feld + '_basis_laut_blatt'] || null;
      if (!tab || typeof tab !== 'object') {
        return nichts('stufentabelle_fehlt',
          `Der Term "${name}" ist diskret, der Satz fuehrt aber keine Tabelle `
          + `${feld}_basis_anwendung.`);
      }
      const schluessel = Object.keys(tab);
      const j = fwJahr(e);
      if (!j.da) {
        return nichts('feld_fehlt',
          `Die Jahresstufe ist nicht erfasst. Der Bericht fuehrt `
          + `${schluessel.join(' · ')}; anzugeben ist "jahr" (Klasse oder `
          + `Kalenderjahr) oder "stichtag".`);
      }
      let k = schluessel.find((s) => fwNorm(s) === fwNorm(j.text || j.jahr));
      if (k === undefined && j.jahr) {
        k = schluessel.find((s) => (String(s).match(/\d{4}/g) || [])
          .some((y) => Number(y) === j.jahr));
      }
      if (k === undefined) {
        return nichts('ausserhalb_der_jahresklassen',
          `Fuer ${j.text || j.jahr} fuehrt der Bericht keine Jahresstufe. `
          + `Gefuehrt werden: ${schluessel.join(' · ')}. Eine Stufe `
          + `fortzuschreiben waere eine Ableitung, die der Ausschuss nicht `
          + `vorgenommen hat.`);
      }
      x = zahl(tab[k]);
      ausp = k;
      if (x === null) {
        return nichts('stufe_ohne_wert', `Die Jahresstufe "${k}" traegt keine Zahl.`);
      }
    } else {
      const stamm = fwStamm(feld);
      const f = fwWert(e, stamm);
      if (!f.da || zahl(f.wert) === null) {
        return nichts('feld_fehlt',
          `${feld} ist nicht erfasst. Die Gleichung ist als Ganzes abgeleitet; `
          + `ein weggelassener Term waere ein anderes Modell. Gesucht wurde `
          + `unter: ${(FW_EINGANG[stamm] || [stamm]).join(', ')}.`);
      }
      x = zahl(f.wert);
      ausp = `${x} (${f.feld})`;
    }

    let basiswert = x;
    if (art === 'inv') {
      if (x === 0) {
        return nichts('term_unbestimmt', `${feld} = 0; 1/${feld} ist nicht erklaert.`);
      }
      basiswert = 1 / x;
    } else if (art === 'ln') {
      if (!(x > 0)) {
        return nichts('term_unbestimmt', `${feld} = ${x}; ln ist dort nicht erklaert.`);
      }
      basiswert = Math.log(x);
    } else if (art === 'log10') {
      if (!(x > 0)) {
        return nichts('term_unbestimmt', `${feld} = ${x}; log10 ist dort nicht erklaert.`);
      }
      basiswert = Math.log10(x);
    }
    const anteil = c * basiswert;
    if (!Number.isFinite(anteil)) {
      return nichts('term_unbestimmt', `Der Term "${name}" ergibt keinen endlichen Wert.`);
    }
    summe += anteil;
    teile.push(`${anteil >= 0 ? '+' : '−'} ${Math.abs(anteil).toFixed(6)} `
      + `(${name} = ${ausp})`);
  }

  /* ── WAS AUSSEN UM DIE KLAMMER STEHT, IST TEIL DES MODELLS ───────────
     Magdeburg druckt ( … )² ab; ohne das Quadrat kaeme 1,58 statt 2,49
     heraus. Dresden schreibt den Logarithmus LINKS —
     `ln(SWF) = …` —, da ist der Faktor e hoch der Summe: ohne das kaeme
     0,09 statt 1,10. Beide Zahlen bleiben im plausiblen Band, und beide
     sind falsch. Deshalb: nennt der Ausdruck ein Aussenherum und das
     Rezept nicht, wird NICHT gerechnet. */
  let ergebnis = summe;
  if (m.aussen_funktion === 'exp') {
    ergebnis = Math.exp(summe);
    teile.push(`= e^(${summe.toFixed(6)})`);
    if (!Number.isFinite(ergebnis)) {
      return nichts('term_unbestimmt', 'Die Gleichung ergibt keinen endlichen Wert.');
    }
    const w0 = gerundet(m, ergebnis);
    return { verfuegbar: true, wert: w0, tabellenwert: w0, korrekturen: [],
      bauart: 'linearkombination', rechenweg_terme: teile,
      rechenweg_formelwerk: teile.join(' ') + ` = ${w0}` };
  }
  if (!m.aussen_funktion && /\bln\s*\(\s*[A-Za-z]/.test(String(m.ausdruck || ''))
      && /^\s*ln\s*\(/.test(String(m.ausdruck || ''))) {
    return nichts('aussen_funktion_fehlt',
      'Der abgedruckte Ausdruck hat den Logarithmus auf der LINKEN Seite '
      + '(ln(…) = …). Die Summe ist dann nicht das Ergebnis, sondern sein '
      + 'Logarithmus; das Rezept muss `aussen_funktion: "exp"` fuehren.');
  }
  const aexp = zahl(m.aussen_exponent);
  if (aexp === null) {
    if (/[²³]/.test(String(m.ausdruck || ''))) {
      return nichts('exponent_nicht_beziffert',
        'Der abgedruckte Ausdruck traegt einen Exponenten auf der Klammer, '
        + 'das Rezept nennt ihn aber nicht als Zahl (`aussen_exponent`). '
        + 'Ohne ihn waere es eine andere Gleichung.');
    }
  } else if (aexp !== 1) {
    if (summe < 0 && !Number.isInteger(aexp)) {
      return nichts('term_unbestimmt',
        `Die Klammersumme ist ${summe.toFixed(4)}; mit dem Exponenten ${aexp} `
        + 'ergibt das keinen reellen Wert.');
    }
    ergebnis = Math.pow(summe, aexp);
    teile.push(`= (${summe.toFixed(6)})^${aexp}`);
  }
  if (!Number.isFinite(ergebnis)) {
    return nichts('term_unbestimmt', 'Die Gleichung ergibt keinen endlichen Wert.');
  }

  const w = gerundet(m, ergebnis);
  return { verfuegbar: true, wert: w, tabellenwert: w, korrekturen: [],
    bauart: 'linearkombination', rechenweg_terme: teile,
    rechenweg_formelwerk: teile.join(' ') + ` = ${w}` };
}

/** Bauart `produkt` — Kiel und Hamburg. */
function fwProdukt(m, e) {
  const pct = zahl(m.basiswert_pct);
  const basis = pct !== null ? pct : zahl(m.basiswert);
  if (basis === null) {
    return nichts('kein_basiswert', 'Der Satz nennt keinen Basiswert.');
  }
  const tab = m.faktoren || m.koeffizienten || {};
  const namen = Object.keys(tab);
  if (!namen.length) return nichts('keine_faktoren', 'Der Satz nennt keine Faktoren.');

  const teil = [], offenFw = [];
  let produkt = basis;
  const weg = [`Basiswert ${basis}`];
  let korr = { an: [], offen: [] };

  for (const name of namen) {
    /* Kiel: "ADDITIV, erst NACH den multiplikativen Faktoren a-c." — der
       Satz sagt es selbst, deshalb steht dieser Block nicht im Produkt. */
    if (/^korrektur/i.test(name)) { korr = fwKorrekturen(tab[name], e); continue; }
    const r = fwFaktor(name, tab[name], m, e);
    teil.push(r);
    if (r.status === 'gerechnet') {
      produkt *= r.wert;
      weg.push(`× ${Number(r.wert.toFixed(5))} (${name}`
        + (r.auspraegung ? `: ${r.auspraegung}` : '') + ')');
    } else {
      offenFw.push(r);
    }
  }

  if (offenFw.length) {
    const fehlende = [...new Set(offenFw.map((r) => r.benoetigt).filter(Boolean))];
    const liste = offenFw.map((r) => `${r.faktor} (${r.status}`
      + (r.benoetigt ? `, noetig: ${r.benoetigt}` : '') + ')').join(' · ');
    return { ...nichts('modell_unvollstaendig',
      'Dieser Gutachterausschuss rechnet ueber ein Faktormodell. '
      + `${offenFw.length} von ${teil.length} Faktoren sind nicht auswertbar: `
      + `${liste}. `
      + (fehlende.length ? `Beizubringen waere: ${fehlende.join(', ')}. ` : '')
      + 'Gerechnet wird damit nicht — ein Faktor, den man auf 1 setzt, ist '
      + 'eine Erfindung mit Nachkommastelle.'),
      bauart: 'produkt', teilergebnisse: teil, fehlende_eingaben: fehlende,
      faktoren_gerechnet: teil.filter((r) => r.status === 'gerechnet').length,
      faktoren_gefuehrt: teil.length };
  }

  let ergebnis = produkt;
  for (const k of korr.an) {
    ergebnis += k.wert;
    weg.push(`${k.wert >= 0 ? '+' : '−'} ${Math.abs(k.wert)} (${k.merkmal})`);
  }

  const w = gerundet(m, ergebnis);
  return { verfuegbar: true, wert: w, tabellenwert: w, korrekturen: [],
    bauart: 'produkt', teilergebnisse: teil,
    faktoren_gerechnet: teil.length, faktoren_gefuehrt: teil.length,
    korrekturen_formelwerk: korr.an,
    korrekturen_offen_formelwerk: korr.offen,
    rechenweg_formelwerk: weg.join(' ') + ` = ${w}` };
}

/** Bauart `bezug_linear` — Hamburg efh/etw: a * LIZI(MFH) + b.
 *
 * Der Bezugswert ist das ERGEBNIS eines anderen Zweiges. Er wird hier nicht
 * beschafft — der Auswerter kennt das Register nicht — sondern erwartet:
 * `bezugswert_pct`. Fehlt er, sagt die Auskunft, AN WELCHEM Zweig die
 * Rechnung haengt. Eine Luecke, die eine Stufe tiefer liegt, ist keine
 * andere Luecke; sie gehoert mit demselben Namen gemeldet. */
function fwBezugLinear(m, e) {
  const a = zahl(m.a), b = zahl(m.b);
  if (a === null || b === null) {
    return nichts('kein_koeffizient', 'Der Satz fuehrt a oder b nicht.');
  }
  const mz = /zweig\s*=\s*([a-z0-9_]+)/i.exec(String(m.bezug || ''));
  const quelle = mz ? mz[1] : null;
  const f = fwWert(e, 'bezugswert');
  const x = f.da ? zahl(f.wert) : null;
  if (x === null) {
    return { ...nichts('bezugswert_fehlt',
      `Dieser Zweig wird AUS dem Zweig "${quelle || 'eines anderen Zweiges'}" `
      + `abgeleitet (${m.ausdruck || `${a} * Bezugswert + ${b}`}). Der Wert `
      + 'dieses Zweiges liegt nicht vor; beizubringen ist "bezugswert_pct" — '
      + `oder der Zweig "${quelle || '?'}" muss selbst erst rechnen.`),
      bauart: 'bezug_linear', haengt_an_zweig: quelle,
      fehlende_eingaben: ['bezugswert_pct (Ergebnis des Zweiges '
        + (quelle || '?') + ')'] };
  }
  const w = gerundet(m, a * x + b);
  return { verfuegbar: true, wert: w, tabellenwert: w, korrekturen: [],
    bauart: 'bezug_linear', haengt_an_zweig: quelle,
    rechenweg_formelwerk: `${a} * ${x} (${quelle || 'Bezug'}) `
      + `${b >= 0 ? '+' : '−'} ${Math.abs(b)} = ${w}` };
}

/** formelwerk — der Einstieg. Waehlt die Bauart und gibt die Hausform zurueck. */
function formelwerk(m, e) {
  const bauart = m.bauart
    || (m.bezug ? 'bezug_linear'
      : (m.basiswert != null || m.basiswert_pct != null) ? 'produkt'
      : (m.koeffizienten && Object.keys(m.koeffizienten).length)
        ? 'linearkombination' : null);
  if (bauart === 'linearkombination') return fwLinearkombination(m, e);
  if (bauart === 'produkt') return fwProdukt(m, e);
  if (bauart === 'bezug_linear') return fwBezugLinear(m, e);
  return nichts('formelwerk_bauart_unbekannt',
    'Der Satz traegt die Form "formelwerk", aber keine erkennbare Bauart. '
    + 'Gefunden wurden: ' + Object.keys(m).filter((k) => k !== 'form').join(', ')
    + '. Gefuehrt werden: produkt (Basiswert mal Faktoren), '
    + 'linearkombination (Koeffizienten) und bezug_linear (a * anderer Zweig + b).');
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
  formelwerk,                           /* v1886-WFW */
  /* v1886-WFW · `regression_log` ist dieselbe BAUART wie Magdeburgs
     Formelwerk: Koeffizienten auf transformierte Groessen, aussen eine
     Funktion. Dresden fuehrt sie unter diesem Namen (1 Satz,
     efh_regression, Stufe A) und war damit genauso stumm wie die acht
     Formelwerke — `form_unbekannt`, obwohl sein Anwendungsbeispiel im
     Satz nachgerechnet daneben steht (1,0988).

     Ein ZWEITER Auswerter dafuer waere eine Dublette; Dubletten laufen
     auseinander. Also derselbe Rechenweg unter beiden Namen. */
  regression_log: (m, e) => fwLinearkombination(m, e),
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

/* ═══ v1778 · EIN RECHENKERN DARF NICHT AN EINEM DATENFELD STERBEN ═══

   Gemessen am 02.10.2026: `korrekturen: {}` — ein LEERES OBJEKT statt
   eines leeren Arrays — liess `auswerten()` mit

     TypeError: object is not iterable

   abstuerzen. `{}` ist truthy, also greift `modell.korrekturen || []`
   nicht, und `for..of` kann es nicht durchlaufen. Betroffen waren **69
   Saetze** in sieben Registerdateien (dresden, hamburg, leipzig,
   lzs-bb, lzs-rp, lzs-sh, schwerin) — die ganze Ernte vom 01./02.10.

   Die Saetze sind korrigiert. ABER: der Rechenkern bleibt sonst so
   zerbrechlich, dass der naechste Tippfehler in einer Registerdatei ihn
   wieder umwirft — und ein Absturz ist die schlechteste Art, einen
   Datenfehler zu melden, weil er die ganze Auskunft mitnimmt.

   > Ein Rechenkern, der an einem Datenfeld stirbt, verliert nicht ein
   > Feld, sondern die Antwort.

   `_korrListe()` gibt IMMER ein Array. Was keines ist, wird gemeldet
   und als leer behandelt — die Zahl kommt dann ohne Korrektur heraus,
   und das steht im Protokoll statt in einem Stacktrace. */
function _korrListe(modell) {
  const k = modell && modell.korrekturen;
  if (Array.isArray(k)) return k;
  if (k == null) return [];
  try {
    console.warn('[swf_modelle v1778] korrekturen ist kein Array ('
      + (typeof k) + ', ' + JSON.stringify(k).slice(0, 80)
      + ') — wird als leer behandelt. Registerdatensatz pruefen.');
  } catch (e) {}
  return [];
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
    for (const k of _korrListe(modell)) {
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
    r.korrekturen_gefuehrt = _korrListe(modell).length;
    r.korrekturen_multiplikativ = mulE.length;
    r.rechenweg = [`Tabellenwert ${r.tabellenwert} EUR`]
      .concat(addE.map((k) => `${k.wert > 0 ? '+' : '−'} ${Math.abs(k.wert)} (${k.merkmal})`))
      .concat(mulE.map((k) => `× ${k.wert} (${k.merkmal})`))
      .join(' ') + ` = ${betrag} EUR`;
    return r;
  }

  const korr = [];
  const offen = [];
  for (const k of _korrListe(modell)) {
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

  /* ══ v1977b · EINE UNBEKANNTE EINHEIT STUERZTE DEN AUSWERTER ═════════

     Hier stand:

       const faktor = IN_FAKTOR[einheit](dokument);

     `einheit` kommt aus `modell.liefert` (Zeile ~2252) und damit aus
     einer REGISTERDATEI. `IN_FAKTOR` kennt drei Werte: faktor, prozent,
     zuschlag_prozent. Jeder andere ergibt `undefined` — und der Aufruf
     `undefined(dokument)` wirft einen TypeError.

     GEMESSEN am 08.10.2026 an den neuen Berliner Vergleichsfaktoren
     (`liefert: "eur_qm"`):

       TypeError: IN_FAKTOR[einheit] is not a function
         at auswerten (swf_modelle.js:2389)

     Das ist kein fehlender Wert, sondern ein ABBRUCH — ein
     Registersatz mit einem Tippfehler im Feld `liefert` haette jeden
     Bericht in diesem Gebiet zerlegt. Die Doktrin sagt „kein Treffer
     heisst kein Wert", nicht „kein Treffer heisst kein Bericht".

     Jetzt gibt es dafuer eine Auskunft: welche Einheit stand da, und
     welche kennt der Auswerter. Damit ist der Fehler am Satz zu finden,
     nicht im Stapelprotokoll. */
  const _umrechner = IN_FAKTOR[einheit];
  if (typeof _umrechner !== 'function') {
    return nichts('einheit_unbekannt',
      `Das Modell gibt die Einheit "${einheit}" an. Der Auswerter kennt `
      + `${Object.keys(IN_FAKTOR).join(", ")} sowie wert_eur. Solange die `
      + 'Einheit nicht zugeordnet ist, wird daraus kein Wert gebildet.');
  }
  const faktor = _umrechner(dokument);
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
  r.korrekturen_gefuehrt = _korrListe(modell).length;
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
