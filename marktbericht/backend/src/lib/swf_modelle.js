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
  return { verfuegbar: true, wert: Math.round(wert * 1000) / 1000,
           tabellenwert: Math.round(wert * 1000) / 1000, korrekturen: [],
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
  return { verfuegbar: true, wert: Math.round(wert * 1000) / 1000,
           tabellenwert: Math.round(wert * 1000) / 1000, korrekturen: [],
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
  const wert = zwischen(x, n[0], n[1], m.stufen[String(n[0])], m.stufen[String(n[1])]);
  return { verfuegbar: true, wert: Math.round(wert * 1000) / 1000,
           tabellenwert: Math.round(wert * 1000) / 1000, korrekturen: [] };
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
  return { verfuegbar: true, wert: Math.round(wert * 1000) / 1000,
           tabellenwert: Math.round(wert * 1000) / 1000, korrekturen: [],
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
    const exp = zahl(t.exponent);
    const basis = (exp === null || exp === 1) ? x : Math.pow(x, exp);
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
    if (!v) continue;
    const w = zahl((dz.werte || {})[v]);
    if (w === null) continue;
    summe += w;
    teile.push(`${w >= 0 ? '+' : '−'} ${Math.abs(w).toFixed(4)} (${dz.bez || dz.feld})`);
  }

  const st = m.rundung_stellen ?? 2;
  const p = Math.pow(10, st);
  const wert = Math.round(summe * p) / p;
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
};

/* ── Additive Korrekturen ──────────────────────────────────────────────── */

/**
 * Zu-/Abschlaege als Stufentabelle (interpoliert) oder Bandtabelle (nicht).
 * Immer ADDITIV auf den Tabellenwert — so drucken es die Berichte ab
 * (Herford 0,89 + 0,02 - 0,03 = 0,88; Hoexter 0,70 + 0,06 + 0,01 = 0,77).
 */
function korrekturAnwenden(k, e) {
  const x = zahl(e[k.feld]);
  if (x === null) return null;                  // nicht erfasst = keine Korrektur

  /* v1093-WMUL · `wirkung` sagt, WIE die Korrektur wirkt; `art` sagt, welche
   * FORM ihre Tabelle hat. Zwei verschiedene Dinge — die Rezepte hatten
   * beides unter `art` geschrieben, der Wandler trennt es. Fehlt `wirkung`,
   * gilt additiv: so drucken es Herford, Hoexter und Dortmund ab, und so
   * hat der Auswerter seit v1083 gerechnet. */
  const wirkung = k.wirkung === 'multiplikativ' ? 'multiplikativ' : 'additiv';

  if (k.art === 'band') {
    const b = (k.baender || []).find((r) => x >= r.von && x <= r.bis);
    return b ? { merkmal: k.bez, wert: b.zuschlag, wirkung,
                 ausprägung: b.bez ?? `${b.von}-${b.bis}` } : null;
  }
  const stufen = Object.keys(k.stufen || {}).map(Number).sort((p, q) => p - q);
  if (!stufen.length) return null;
  // Ausserhalb der Korrekturtabelle gilt der Randwert - der Bericht druckt
  // die Reihe als vollstaendig ab, ohne Fortsetzung nach aussen.
  const v = x <= stufen[0] ? k.stufen[String(stufen[0])]
          : x >= stufen[stufen.length - 1] ? k.stufen[String(stufen[stufen.length - 1])]
          : (() => { const n = nachbarn(stufen, x);
                     return zwischen(x, n[0], n[1],
                                     k.stufen[String(n[0])], k.stufen[String(n[1])]); })();
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

  const zu = m.kategorie_zuordnung;
  if (!zu) return { wert: '', ueber: null };
  const feld = m.zuordnung_feld || 'altbezirk';
  const v = String(e[feld] ?? '').toLowerCase().trim();
  if (!v) return { wert: '', ueber: null };

  for (const kat of (m.kategorien || [])) {
    const liste = zu[String(kat)];
    if (Array.isArray(liste)
        && liste.some((x) => String(x).toLowerCase().trim() === v)) {
      return { wert: String(kat).toLowerCase(), ueber: feld };
    }
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
export function auswerten(modell, eingabe) {
  if (!modell || !modell.form) return nichts('kein_modell', 'Kein Modell hinterlegt.');
  const fn = AUSWERTER[modell.form];
  if (!fn) return nichts('form_unbekannt', `Modellform '${modell.form}' kennt der Auswerter nicht.`);

  const r = fn(modell, eingabe || {});
  if (!r.verfuegbar) return r;

  const einheit = modell.liefert || FORM_EINHEIT[modell.form] || 'faktor';

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
      const t = korrekturAnwenden(k, eingabe || {});
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
    const t = korrekturAnwenden(k, eingabe || {});
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
