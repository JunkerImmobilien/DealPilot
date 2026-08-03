// sachwertfaktoren_herford.js  (v1073)
//
// Sachwertfaktoren (§ 21 Abs. 3 ImmoWertV) und Umrechnungskoeffizienten
// (§ 41 ImmoWertV) fuer den Kreis Herford einschliesslich der Stadt Herford.
//
// QUELLE
// Grundstuecksmarktbericht 2026 fuer den Kreis Herford, Abschnitte 5.1.2 und
// 4.5.5, veroeffentlicht im Maerz 2026 durch den Gutachterausschuss fuer
// Grundstueckswerte im Kreis Herford und in der Stadt Herford.
// Datenlizenz Deutschland Zero 2.0 — jede Nutzung ohne Einschraenkung.
//
// WARUM EIN ZWEITES MODUL
// Der Kreis Herford veroeffentlicht seine Sachwertfaktoren in einer ANDEREN
// Struktur als Minden-Luebbecke:
//   Minden-Luebbecke  Matrix  vorlaeufiger Sachwert x Restnutzungsdauer
//   Luedenscheid      eindimensional + Regressionsformel Y = a * X^b
//   Herford           Matrix  vorlaeufiger Sachwert x BODENRICHTWERT,
//                     dazu additive Zu-/Abschlaege fuer RND und BGF
// Drei Ausschuesse, drei Strukturen. Ein gemeinsames Schema gibt es nicht —
// deshalb je Ausschuss ein Modul und davor ein Aufloeser (gutachterausschuss.js),
// der nach dem Gemeindeschluessel entscheidet.
//
// DIE MATRIX IST BELEGT
// Der Bericht druckt ein Anwendungsbeispiel ab: Bodenrichtwert 125 EUR/m2,
// vorlaeufiger Sachwert 300.000 EUR -> Tabellenwert 0,89; Restnutzungsdauer
// 45 statt 30 Jahre -> +0,02; Bruttogrundflaeche 500 statt 350 m2 -> -0,03;
// anzusetzender Faktor 0,88. Die Pruefstrecke rechnet genau das nach.

export const HF_STAND = {
  ausschuss: 'Der Gutachterausschuss für Grundstückswerte im Kreis Herford '
    + 'und in der Stadt Herford',
  bericht: 'Grundstücksmarktbericht 2026 für den Kreis Herford',
  abschnitt_swf: '5.1.2 Sachwertfaktoren',
  abschnitt_uk: '4.5.5 Umrechnungskoeffizienten',
  ags_kreis: '05758',
  berichtsjahr: 2026,
  veroeffentlicht: '2026-03',
  kauffaelle: 1658,
  geschaeftsjahre: '2024 und 2025',
  gesamtnutzungsdauer: 80,
  lizenz: 'Datenlizenz Deutschland Zero 2.0',
  rechtsgrundlage: '§ 21 Abs. 3 ImmoWertV — Marktanpassung',
  /* Normierung der Tabelle. Abweichungen werden ADDITIV korrigiert. */
  norm_bgf_qm: 350,
  norm_rnd_jahre: 30,
  /* Kennzahlen der Stichprobe — Massstab dafuer, ob ein Objekt passt. */
  stichprobe: {
    kaufpreis_eur: 273000, grundstuecksgroesse_qm: 770,
    bodenrichtwert_eur_qm: 135, bgf_qm: 340, baujahr: 1959,
    restnutzungsdauer_jahre: 32, vorlaeufiger_sachwert_eur: 308000,
    sachwertfaktor_mittel: 0.90, sachwertfaktor_median: 0.92,
  },
  /* Modellansaetze, mit denen die Faktoren abgeleitet wurden. Wer anders
   * rechnet, darf sie nicht anwenden (Grundsatz der Modelltreue). */
  modell: {
    nhk: 'NHK 2010', alterswertminderung: 'linear',
    bezugsmassstab: 'Bruttogrundfläche',
    aussenanlagen_pct: 6, aussenanlagen_spanne: [4, 8],
    gnd_jahre: 80, baupreisindex: 'Preisindex des Bundes',
    restnutzungsdauer: 'Anlage 2 ImmoWertV, mit Modernisierungspunkten',
  },
  /* Bewirtschaftungskosten nach Anlage 3 ImmoWertV, Stand 01.01.2026. */
  bwk_2026: {
    verwaltung_wohnung_eur: 367, verwaltung_etw_eur: 439,
    verwaltung_garage_eur: 48, verwaltung_gewerbe_pct: 3,
    instandhaltung_wohnen_eur_qm: 14.40, instandhaltung_garage_eur: 108,
    mietausfall_wohnen_pct: 2, mietausfall_gewerbe_pct: 4,
  },
  /* Liegenschaftszinssaetze 2023–2025, differenziert nach Gebaeudeart. */
  lzs: {
    efh_freistehend: { pct: 1.8, stabw: 0.7, n: 706 },
    zfh: { pct: 1.8, stabw: 0.8, n: 446 },
    dhh_rh: { pct: 1.8, stabw: 0.7, n: 185 },
    dreifamilienhaus: { pct: 2.5, stabw: 0.9, n: 127 },
    mfh: { pct: 2.8, stabw: 1.0, n: 113 },
    gemischt: { pct: 3.6, stabw: 1.2, n: 82 },
    etw_weiterverkauf: { pct: 2.3, stabw: 0.8, n: 709 },
    etw_neubau: { pct: 2.5, stabw: 0.6, n: 128 },
  },
};

/* ── Sachwertfaktoren, Abschnitt 5.1.2 ─────────────────────────────────── */

/** Zeilen: vorläufiger Sachwert in EUR (100.000 bis 600.000). */
export const HF_SW_STUFEN = [];
for (let s = 100000; s <= 600000; s += 25000) HF_SW_STUFEN.push(s);

/** Spalten: Bodenrichtwert in EUR/m². */
export const HF_BRW_STUFEN = [75, 100, 125, 150, 175, 200, 225];

export const HF_MATRIX = [
  [0.94, 0.97, 0.99, 1.01, 1.03, 1.05, 1.08],
  [0.93, 0.95, 0.98, 1.00, 1.02, 1.04, 1.07],
  [0.92, 0.94, 0.96, 0.99, 1.01, 1.03, 1.05],
  [0.91, 0.93, 0.95, 0.97, 1.00, 1.02, 1.04],
  [0.90, 0.92, 0.94, 0.96, 0.99, 1.01, 1.03],
  [0.88, 0.91, 0.93, 0.95, 0.97, 1.00, 1.02],
  [0.87, 0.89, 0.92, 0.94, 0.96, 0.98, 1.01],
  [0.86, 0.88, 0.91, 0.93, 0.95, 0.97, 0.99],
  [0.85, 0.87, 0.89, 0.92, 0.94, 0.96, 0.98],
  [0.84, 0.86, 0.88, 0.90, 0.93, 0.95, 0.97],
  [0.82, 0.85, 0.87, 0.89, 0.91, 0.94, 0.96],
  [0.81, 0.84, 0.86, 0.88, 0.90, 0.92, 0.95],
  [0.80, 0.82, 0.85, 0.87, 0.89, 0.91, 0.94],
  [0.79, 0.81, 0.83, 0.86, 0.88, 0.90, 0.92],
  [0.78, 0.80, 0.82, 0.84, 0.87, 0.89, 0.91],
  [0.77, 0.79, 0.81, 0.83, 0.86, 0.88, 0.90],
  [0.75, 0.78, 0.80, 0.82, 0.84, 0.87, 0.89],
  [0.74, 0.76, 0.79, 0.81, 0.83, 0.85, 0.88],
  [0.73, 0.75, 0.77, 0.80, 0.82, 0.84, 0.86],
  [0.72, 0.74, 0.76, 0.79, 0.81, 0.83, 0.85],
  [0.71, 0.73, 0.75, 0.77, 0.80, 0.82, 0.84],
];

/** Additive Korrektur für die Restnutzungsdauer (Norm 30 Jahre). */
export const HF_RND_KORREKTUR = {
  10: -0.03, 15: -0.02, 20: -0.01, 25: -0.01, 30: 0.00, 35: 0.01,
  40: 0.01, 45: 0.02, 50: 0.03, 55: 0.04, 60: 0.04, 65: 0.05, 70: 0.06,
};

/** Additive Korrektur für die Bruttogrundfläche (Norm 350 m²). */
export const HF_BGF_KORREKTUR = {
  150: 0.04, 200: 0.03, 250: 0.02, 300: 0.01, 350: 0.00,
  400: -0.01, 450: -0.02, 500: -0.03, 550: -0.04, 600: -0.05,
};

function interp(x, x0, x1, y0, y1) {
  if (x1 === x0) return y0;
  return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

/** Nächstgelegene Stützstelle einer Korrekturtabelle; ausserhalb: Randwert. */
function korrektur(tab, x) {
  const k = Object.keys(tab).map(Number).sort((a, b) => a - b);
  const v = Number(x);
  if (!Number.isFinite(v)) return null;
  if (v <= k[0]) return tab[k[0]];
  if (v >= k[k.length - 1]) return tab[k[k.length - 1]];
  for (let i = 0; i < k.length - 1; i++) {
    if (v >= k[i] && v <= k[i + 1]) {
      /* Der Bericht nennt keine Interpolation fuer die Zuschlaege — sie sind
       * Stufen. Genommen wird die naechstgelegene Stuetzstelle. */
      return (v - k[i]) <= (k[i + 1] - v) ? tab[k[i]] : tab[k[i + 1]];
    }
  }
  return null;
}

/** Kreuzinterpolation in der Matrix; null ausserhalb der Spannen. */
export function tabellenwert(sachwertEur, brwEurQm) {
  const s = Number(sachwertEur), b = Number(brwEurQm);
  if (!Number.isFinite(s) || !Number.isFinite(b)) return null;
  if (s < HF_SW_STUFEN[0] || s > HF_SW_STUFEN[HF_SW_STUFEN.length - 1]) return null;
  if (b < HF_BRW_STUFEN[0] || b > HF_BRW_STUFEN[HF_BRW_STUFEN.length - 1]) return null;
  let i = 0; while (i < HF_SW_STUFEN.length - 2 && s > HF_SW_STUFEN[i + 1]) i++;
  let j = 0; while (j < HF_BRW_STUFEN.length - 2 && b > HF_BRW_STUFEN[j + 1]) j++;
  const unten = interp(s, HF_SW_STUFEN[i], HF_SW_STUFEN[i + 1], HF_MATRIX[i][j], HF_MATRIX[i + 1][j]);
  const oben = interp(s, HF_SW_STUFEN[i], HF_SW_STUFEN[i + 1], HF_MATRIX[i][j + 1], HF_MATRIX[i + 1][j + 1]);
  return interp(b, HF_BRW_STUFEN[j], HF_BRW_STUFEN[j + 1], unten, oben);
}

/**
 * Sachwertfaktor Kreis Herford.
 * Gleiche Rückgabeform wie sachwertfaktoren_nrw.sachwertfaktor().
 */
export function sachwertfaktor({ ags, sachwert_eur, rnd_jahre, bgf_qm, brw_eur_qm, objektart }) {
  const nichts = (grund, hinweis) => ({ verfuegbar: false, grund, hinweis });

  const kreis = String(ags || '').replace(/\D/g, '').slice(0, 5);
  if (kreis !== HF_STAND.ags_kreis) {
    return nichts('anderer_ausschuss',
      'Für diesen Ort liegt kein Sachwertfaktor des Kreises Herford vor '
      + '(§ 10 ImmoWertV).');
  }

  const art = String(objektart || '').toLowerCase();
  if (art && /etw|eigentumswohnung|wohnung|whg|mfh|mehrfamilien|gewerbe|buero/.test(art)) {
    return nichts('objektart_nicht_abgeleitet',
      'Der Gutachterausschuss leitet Sachwertfaktoren für Ein- und '
      + 'Zweifamilienhäuser ab (Abschnitt 5.1.2). Für diese Objektart liegt '
      + 'keiner vor.');
  }

  const sw = Number(sachwert_eur), brw = Number(brw_eur_qm);
  if (!(sw > 0)) return nichts('sachwert_fehlt');
  if (!(brw > 0)) {
    return nichts('brw_fehlt',
      'Die Herforder Sachwertfaktoren hängen vom Bodenrichtwert ab (Lagequalität). '
      + 'Ohne ihn lässt sich kein Faktor bestimmen.');
  }

  const basis = tabellenwert(sw, brw);
  if (basis == null) {
    return nichts('ausserhalb_der_tabelle',
      'Vorläufiger Sachwert oder Bodenrichtwert liegen außerhalb der vom '
      + 'Gutachterausschuss veröffentlichten Spannen ('
      + (HF_SW_STUFEN[0] / 1000) + '.000 bis '
      + (HF_SW_STUFEN[HF_SW_STUFEN.length - 1] / 1000) + '.000 € bzw. '
      + HF_BRW_STUFEN[0] + ' bis ' + HF_BRW_STUFEN[HF_BRW_STUFEN.length - 1]
      + ' €/m²). Die Tabelle wird nicht über ihren Rahmen hinaus verlängert.');
  }

  /* Die Zuschlaege sind additiv und beide optional — fehlt eine Angabe,
   * bleibt der Tabellenwert stehen und der Bericht sagt es. */
  const kRnd = Number.isFinite(Number(rnd_jahre)) ? korrektur(HF_RND_KORREKTUR, rnd_jahre) : null;
  const kBgf = Number.isFinite(Number(bgf_qm)) ? korrektur(HF_BGF_KORREKTUR, bgf_qm) : null;
  const offen = [];
  if (kRnd == null) offen.push('Restnutzungsdauer');
  if (kBgf == null) offen.push('Bruttogrundfläche');

  const wert = Math.round((basis + (kRnd || 0) + (kBgf || 0)) * 1000) / 1000;

  return {
    verfuegbar: true,
    wert, stufe: 'A', ebene: 'kreis', ags: HF_STAND.ags_kreis,
    tabellenwert: Math.round(basis * 1000) / 1000,
    korrektur_rnd: kRnd, korrektur_bgf: kBgf,
    nicht_korrigiert: offen.length ? offen : null,
    sachwert_eur: sw, brw_eur_qm: brw, rnd_jahre: rnd_jahre ?? null, bgf_qm: bgf_qm ?? null,
    quelle: HF_STAND.ausschuss,
    quelle_text: HF_STAND.bericht + ', ' + HF_STAND.abschnitt_swf,
    fallzahl: HF_STAND.kauffaelle,
    modellversion: 'gaa_herford_2026',
    hinweis: 'Marktanpassung nach § 21 Abs. 3 ImmoWertV mit dem Sachwertfaktor des '
      + 'Gutachterausschusses (' + HF_STAND.kauffaelle + ' Kauffälle, '
      + HF_STAND.geschaeftsjahre + '). Der Tabellenwert ist auf eine '
      + 'Bruttogrundfläche von ' + HF_STAND.norm_bgf_qm + ' m² und eine '
      + 'Restnutzungsdauer von ' + HF_STAND.norm_rnd_jahre + ' Jahren normiert; '
      + 'Abweichungen werden additiv korrigiert. MODELLTREUE: die Faktoren gelten '
      + 'für eine Sachwertermittlung nach NHK 2010 mit linearer Alterswertminderung, '
      + 'Gesamtnutzungsdauer 80 Jahre und Außenanlagen von im Regelfall '
      + HF_STAND.modell.aussenanlagen_pct + ' % (' + HF_STAND.modell.aussenanlagen_spanne[0]
      + ' bis ' + HF_STAND.modell.aussenanlagen_spanne[1] + ' %).'
      + (offen.length ? ' Nicht korrigiert mangels Angabe: ' + offen.join(', ') + '.' : ''),
  };
}

/* ── Umrechnungskoeffizienten und Gartenland, Abschnitt 4.5.5 ──────────── */

export const HF_BEZUGSGROESSE_QM = 700;

/** "Flächengröße bis" → Umrechnungskoeffizient. */
export const HF_UK = {
  700: 1.000, 750: 0.977, 800: 0.938, 850: 0.902, 900: 0.871, 950: 0.840,
  1000: 0.808, 1050: 0.780, 1100: 0.754, 1150: 0.729, 1200: 0.703,
  1250: 0.680, 1300: 0.658, 1350: 0.638, 1400: 0.619, 1450: 0.602, 1500: 0.586,
};

/* "Bei bebauten uebergrossen Grundstuecken werden fuer darueberhinausgehende
 * Gartenlandflaechen im Mittel rd. 20 % des zugehoerigen beitragsfreien
 * Bodenrichtwerts fuer Wohnen gezahlt (Spanne zwischen rd. 10 % und rd. 30 %
 * — Kaufvertraege aus den letzten 10 Jahren)."
 * Genau dieser Satz belegt die 30 EUR/m2 im Gutachten Loehner Str. 278:
 * 20 Prozent von 150 EUR/m2. */
export const HF_GARTENLAND_PCT = 20;
export const HF_GARTENLAND_SPANNE_PCT = [10, 30];

export function umrechnungskoeffizient(flaecheQm) {
  const f = Number(flaecheQm);
  if (!Number.isFinite(f) || f <= 0) return null;
  const k = Object.keys(HF_UK).map(Number).sort((a, b) => a - b);
  if (f <= k[0]) return HF_UK[k[0]];
  if (f > k[k.length - 1]) return null;   /* ueber 1.500 m2: keine Angabe */
  for (const g of k) if (f <= g) return HF_UK[g];
  return null;
}

/**
 * Vorschlag für den Wertansatz einer Gartenland-/Hinterlandfläche.
 * Ein VORSCHLAG, keine Rechnung — die Eingabe bleibt beim Sachverständigen.
 */
export function gartenlandAnsatz({ ags, brw_eur_qm }) {
  const kreis = String(ags || '').replace(/\D/g, '').slice(0, 5);
  if (kreis !== HF_STAND.ags_kreis) return { verfuegbar: false, grund: 'anderer_ausschuss' };
  const brw = Number(brw_eur_qm);
  if (!(brw > 0)) return { verfuegbar: false, grund: 'brw_fehlt' };
  const r = (p) => Math.round(brw * p) / 100;
  return {
    verfuegbar: true,
    vorschlag_eur_qm: r(HF_GARTENLAND_PCT),
    spanne_eur_qm: [r(HF_GARTENLAND_SPANNE_PCT[0]), r(HF_GARTENLAND_SPANNE_PCT[1])],
    pct: HF_GARTENLAND_PCT, spanne_pct: HF_GARTENLAND_SPANNE_PCT,
    quelle_text: HF_STAND.bericht + ', ' + HF_STAND.abschnitt_uk,
    hinweis: 'Für nicht selbständig bebaubare Gartenlandflächen werden im Kreis '
      + 'Herford im Mittel rund ' + HF_GARTENLAND_PCT + ' % des beitragsfreien '
      + 'Bodenrichtwerts gezahlt (Spanne ' + HF_GARTENLAND_SPANNE_PCT[0] + ' bis '
      + HF_GARTENLAND_SPANNE_PCT[1] + ' %), hier ' + r(HF_GARTENLAND_PCT).toString().replace('.', ',')
      + ' €/m². Das ist ein Vorschlag; Zuschnitt, Zuwegung und Nutzbarkeit sind '
      + 'sachverständig zu würdigen.',
  };
}

export default { HF_STAND, HF_MATRIX, HF_SW_STUFEN, HF_BRW_STUFEN,
  HF_RND_KORREKTUR, HF_BGF_KORREKTUR, HF_UK, HF_BEZUGSGROESSE_QM,
  tabellenwert, sachwertfaktor, umrechnungskoeffizient, gartenlandAnsatz };
