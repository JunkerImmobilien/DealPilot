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
  const k = String(e[m.achse_k_feld] ?? '').toLowerCase().trim();
  if (x === null) return nichts('achse_x_fehlt', `${m.achse_x_bez} nicht erfasst.`);
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
  if (k.art === 'band') {
    const b = (k.baender || []).find((r) => x >= r.von && x <= r.bis);
    return b ? { merkmal: k.bez, wert: b.zuschlag, ausprägung: b.bez ?? `${b.von}-${b.bis}` } : null;
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
  return { merkmal: k.bez, wert: Math.round(v * q) / q, ausprägung: String(x) };
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

/** Plausibilitaetsband fuer einen Sachwertfaktor. Keine Marktaussage, sondern
 *  ein Einheitenwaechter: was hier herausfaellt, ist keine ungewoehnliche
 *  Lage, sondern eine verwechselte Einheit. Lieber KEIN Wert als ein Faktor
 *  von 90 — ein stiller Rueckfall ist schlimmer als ein Fehler. */
const FAKTOR_MIN = 0.1;
const FAKTOR_MAX = 5.0;

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

  // Ein Betrag in Euro. Additive Faktorkorrekturen waeren dort sinnlos und
  // werden nicht angewandt.
  if (einheit === 'wert_eur' || r.liefert === 'wert_eur') {
    r.liefert = 'wert_eur';
    r.einheit = 'eur';
    r.rechenweg = `${modell.formel || r.formel || ''} = ${r.wert} EUR`.trim();
    return r;
  }

  const korr = [];
  for (const k of (modell.korrekturen || [])) {
    const t = korrekturAnwenden(k, eingabe || {});
    if (t && t.wert) korr.push(t);
  }

  /* Die Korrekturen stehen in der Einheit des Berichts — Herford in
   * Faktorpunkten, Dortmund in Prozentpunkten. Deshalb wird HIER, in der
   * Dokumenteinheit, summiert und gerundet. */
  const summe = korr.reduce((s, k) => s + k.wert, 0);
  const stellen = modell.rundung_stellen ?? (einheit === 'faktor' ? 2 : 1);
  const p = Math.pow(10, stellen);
  const dokument = Math.round((r.tabellenwert + summe) * p) / p;

  const faktor = IN_FAKTOR[einheit](dokument);

  if (!(faktor > 0)) {
    return nichts('korrektur_unplausibel',
      'Die Zu-/Abschlaege fuehren auf einen Faktor kleiner oder gleich null.');
  }
  if (faktor < FAKTOR_MIN || faktor > FAKTOR_MAX) {
    /* Kein Marktbefund, sondern ein Einheitenbefund. */
    return nichts('einheit_unplausibel',
      `Aus ${dokument} (${einheit}) wird der Faktor ${faktor} — das liegt `
      + `ausserhalb von ${FAKTOR_MIN} bis ${FAKTOR_MAX}. Der Datensatz weist `
      + `seine Einheit vermutlich falsch aus; gerechnet wird damit nicht.`);
  }

  const zeigen = (v) => v.toFixed(stellen).replace('.', ',');
  r.korrekturen = korr;
  r.einheit = einheit;
  r.dokumentwert = dokument;        /* die Zahl, wie der Bericht sie druckt */
  r.wert = Math.round(faktor * 10000) / 10000;
  r.rechenweg = [`Tabellenwert ${zeigen(r.tabellenwert)}`]
    .concat(korr.map((k) => `${k.wert > 0 ? '+' : '−'} ${zeigen(Math.abs(k.wert))} (${k.merkmal})`))
    .join(' ') + ` = ${zeigen(dokument)}`
    + (einheit === 'faktor' ? '' : ` ${einheit === 'wert_eur' ? '€' : '%'} `
       + `→ Faktor ${r.wert.toFixed(3).replace('.', ',')}`);
  return r;
}

export default { auswerten, FORMEN: Object.keys(AUSWERTER) };
