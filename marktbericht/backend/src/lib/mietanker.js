/* ═══════════════════════════════════════════════════════════════════════
   lib/mietanker.js · v3343 — VERGLEICHSMIETE DER WOHNUNG, ANKER DER
   MARKTÜBLICHKEIT UND ZIELBILD-MAXIMUM (Marcel 12.11.2026)

   Marcel: „Im Zielbild sollten wir natürlich immer das Maximum nehmen, was
   wir können … aber nur wenn es wirklich so passt, wir machen keine
   Falschaussage." und (abends) „die Denkweise ist immer erst das Maximum,
   damit sich das Objekt am besten rechnet."

   EINE Rechenstelle für drei Dinge, je WOHNUNG (Fläche!):
     1 vergleichsmieteWohnung()  Vergleichsmiete der Wohnung: Mietspiegel-Werte
       der Gemeinde (lib/mietspiegel/werte.js), sonst die DealPilot-Näherung
       (lib/mietspiegel/naeherung.js) – dieselbe Regel wie die Route
       GET /mietspiegel: Näherung nie neben einer freien Wertedatei.
       Einordnung in die Spanne nach den eingegebenen Merkmalen (einordnung()).
     2 bandWohnung()  Anker der Marktüblichkeit für den Ertragswert (§ 31
       Abs. 2 ImmoWertV, ImmoWertA 5.(3).2 „insbesondere die ortsübliche
       Vergleichsmiete aus geeigneten Mietspiegeln"). NEUTRAL: Anker ist die
       eingeordnete Vergleichsmiete (Mittelwert, Oberwert nur mit Merkmalen).
       Band = Mietspiegel-Spanne, mindestens ± MIETBAND (20 %) um den Anker.
     3 zielMaximum()  Zielbild je Wohnung, rechtlich vertretbares MAXIMUM:
         Bestandsmieter  bis zum Oberwert (§ 558 BGB; Einordnung oben nur, wenn
                         Ausstattung/Lage/Zustand sie tragen – BGH VIII ZR 82/18,
                         VIII ZR 346/10), Kappung und Sperrfrist als Zeitpfad
         Neuvermietung   mit Mietpreisbremse 110 % (§ 556d Abs. 1 BGB),
                         ohne 120 % (§ 5 WiStG: darüber Bußgeldrisiko nur bei
                         Ausnutzung eines geringen Angebots) – je auf den Oberwert
       daneben konservativ (Mittelwert) und die Risikozone darüber.

   ENTSCHEIDUNG BAND (dokumentiert, v3343): die Mietspiegel-Spanne bildet in
   der Regel zwei Drittel der Bestandsmieten ab (Bestand, § 558 Abs. 2 BGB) und
   ist meist ENGER als ±20 % (gemessen 12.11.2026 über 477 Rasterpunkte der
   freien Mietspiegel: Oberwert/Mittel Median 1,14). Für die Marktüblichkeit
   nach ImmoWertA 31 (Bandbreite marktüblich erzielbarer Erträge, auch
   Neuvermietung) wäre sie zu eng. Deshalb: Band = Vereinigung aus Spanne und
   ±20 % (DealPilot-Setzung E11) – wo ein Mietspiegel weiter streut, gilt
   seine Spanne. Nie enger als bisher.

   NÄHERUNG OHNE SPANNE: Oberwert ca. = Mittel × NAEHERUNG_OBEN (1,14),
   Unterwert ca. = Mittel × NAEHERUNG_UNTEN (0,86) – Median der freien
   Mietspiegel, gemessen 12.11.2026 (tools/mietanker-pruefen.mjs, Abschnitt Q).
   Immer „ca." und „DealPilot-Näherung".

   Kern ohne Einstellung, Uhr, Datei oder Datenbank: alles kommt als Parameter.
   Prüfer: tools/mietanker-pruefen.mjs.
   ═══════════════════════════════════════════════════════════════════════ */
import { mietspiegelWerteFuer } from './mietspiegel/werte.js';
import { naeherungFuer } from './mietspiegel/naeherung.js';

export const MIETBAND_PCT = 20;                 /* = CrossCheckService MIETBAND.pct (E11) */
export const NAEHERUNG_OBEN = 1.14;             /* Median Oberwert/Mittel, 477 Rasterpunkte, 12.11.2026 */
export const NAEHERUNG_UNTEN = 0.86;            /* Median Unterwert/Mittel, 12.11.2026 */
export const FAKTOR_BREMSE = 1.10;              /* § 556d Abs. 1 BGB */
export const FAKTOR_WISTG = 1.20;               /* § 5 Abs. 2 WiStG, „nicht unerheblich" ab mehr als 20 % */
export const HINWEIS_RECHT = 'Orientierung, keine Rechtsberatung.';

const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const r2 = (x) => (x == null ? null : Math.round(x * 100 + 1e-9) / 100);
export const qmDe = (x) => (x == null ? '–' : r2(x).toFixed(2).replace('.', ','));

/* ── Einordnung in die Spanne ─────────────────────────────────────────────
   signale: { standardstufe, mikrolage, mod_punkte, baujahr, zustand, jahr }
   Drei Merkmalgruppen wie in den Orientierungshilfen der Mietspiegel:
     Ausstattung  Standardstufe ≥ 4 positiv, ≤ 2 negativ (Anlage 4 ImmoWertV)
     Lage         Mikrolage „gut"/„sehr gut" positiv, „einfach"/„schlecht" negativ
     Zustand      ≥ 11 Modernisierungspunkte (überwiegend modernisiert, Anlage 2)
                  oder Gebäude ≤ 10 Jahre positiv, „sanierungsbedürftig"/„schlecht" negativ
   Oben nur, wenn mindestens ZWEI Gruppen positiv und keine negativ ist; unten
   spiegelbildlich; sonst Mittelwert. Was der Mietspiegel schon selbst
   unterscheidet (Lage- oder Ausstattungsachse), zählt nicht noch einmal. */
export function einordnung(signale, ohne) {
  const s = signale || {}, o = ohne || {};
  const pos = [], neg = [];
  if (!o.ausstattung) {
    const st = num(s.standardstufe);
    if (st != null && st >= 4) pos.push('Ausstattung gehoben (Standardstufe ' + String(st).replace('.', ',') + ')');
    else if (st != null && st > 0 && st <= 2) neg.push('Ausstattung einfach (Standardstufe ' + String(st).replace('.', ',') + ')');
  }
  if (!o.lage) {
    const l = String(s.mikrolage || '').toLowerCase();
    if (/sehr gut|^gut|bevorzugt|beste/.test(l)) pos.push('Lage ' + s.mikrolage);
    else if (/einfach|schlecht|unterdurch|mäßig|maessig/.test(l)) neg.push('Lage ' + s.mikrolage);
  }
  const mp = num(s.mod_punkte), bj = num(s.baujahr), jahr = num(s.jahr);
  const z = String(s.zustand || '').toLowerCase();
  if (/sanierungsbed|renovierungsbed|schlecht|mangelhaft/.test(z)) neg.push('Zustand ' + s.zustand);
  else if ((mp != null && mp >= 11) || (bj > 1000 && jahr > 1000 && jahr - bj <= 10))
    pos.push(mp != null && mp >= 11 ? 'überwiegend modernisiert (' + String(mp).replace('.', ',') + ' Punkte)' : 'neuwertiges Gebäude (Baujahr ' + bj + ')');
  const wahl = (pos.length >= 2 && !neg.length) ? 'oben' : (neg.length >= 2 && !pos.length) ? 'unten' : 'mittel';
  return { wahl, positiv: pos, negativ: neg, belegt_oben: wahl === 'oben',
    text: wahl === 'oben' ? 'Einordnung am Oberwert: ' + pos.join(', ')
      : wahl === 'unten' ? 'Einordnung am Unterwert: ' + neg.join(', ')
      : 'Einordnung am Mittelwert' + (pos.length || neg.length ? ' (' + pos.concat(neg).join(', ') + '. Für eine Einordnung oben oder unten braucht es zwei Merkmalgruppen in derselben Richtung)' : ' (keine Merkmale eingetragen, die eine Einordnung oben oder unten tragen)') };
}

/** Was der Mietspiegel schon selbst unterscheidet (dann zählt das Merkmal nicht doppelt). */
function eigeneAchsen(werte) {
  const w = werte || {}, T = w.tabelle || {}, A = T.achsen || {}, R = w.regression || {};
  const lage = (Array.isArray(A.lage) && A.lage.length > 0) || (T.zuschlaege || []).some((z) => /^lage:/.test(z.merkmal || ''))
    || (R.faktoren || []).some((f) => f.typ === 'lage');
  const ausstattung = (Array.isArray(A.ausstattung) && A.ausstattung.length > 0)
    || (R.faktoren || []).some((f) => /ausstatt/i.test(String(f.merkmal || f.label || '')));
  return { lage, ausstattung };
}

/**
 * Vergleichsmiete EINER Wohnung.
 * k: { werte (Inhalt werte/<ags>.json | null, gesperrte schon ausgefiltert), naeherung_param, zensus_zeilen,
 *      baujahr, lage, ausstattung, merkmale, signale, marktlage }
 * → null | { quelle: 'mietspiegel'|'naeherung', unten, mittel, oben, ca, einordnung, qm (eingeordnet), etikett, herkunft, rechnung, hinweise }
 */
export function vergleichsmieteWohnung(k, wfl) {
  if (!k) return null;
  const fl = num(wfl);
  if (!(fl > 0)) return null;
  if (k.werte) {
    const r = mietspiegelWerteFuer(k.werte, { baujahr: k.baujahr, wfl: fl, lage: k.lage || null, ausstattung: k.ausstattung || null, merkmale: k.merkmale || {} });
    if (!(r && r.mittel > 0)) return null;   /* Wo die Quelle endet, endet die Rechnung - keine Näherung neben einer freien Datei */
    const e = einordnung(k.signale, eigeneAchsen(k.werte));
    const unten = r.unten > 0 ? r.unten : r.mittel, oben = r.oben > 0 ? r.oben : r.mittel;
    const qm = e.wahl === 'oben' ? oben : e.wahl === 'unten' ? unten : r.mittel;
    const art = r.art === 'qualifiziert' ? 'qualifizierter Mietspiegel' : 'Mietspiegel';
    return { quelle: 'mietspiegel', unten, mittel: r.mittel, oben, ca: false, einordnung: e, qm,
      etikett: 'Vergleichsmiete der Wohnung (' + art + (r.gemeinde ? ' ' + r.gemeinde : '') + ')',
      herkunft: (r.dokument || ('Mietspiegel ' + (r.gemeinde || ''))) + (r.seite ? ', S. ' + r.seite : '') + (r.zelle ? ', ' + r.zelle : ''),
      rechnung: r.rechnung || null, hinweise: r.hinweise || [], url: r.url || null };
  }
  if (k.naeherung_param && Array.isArray(k.zensus_zeilen) && k.zensus_zeilen.length) {
    const n = naeherungFuer(k.naeherung_param, k.zensus_zeilen, { baujahr: k.baujahr, wfl: fl, marktlage: k.marktlage || null });
    if (!(n && n.qm > 0)) return null;
    const e = einordnung(k.signale, {});
    const unten = r2(n.qm * NAEHERUNG_UNTEN), oben = r2(n.qm * NAEHERUNG_OBEN);
    const qm = e.wahl === 'oben' ? oben : e.wahl === 'unten' ? unten : n.qm;
    return { quelle: 'naeherung', unten, mittel: n.qm, oben, ca: true, einordnung: e, qm,
      etikett: 'Vergleichsmiete der Wohnung (DealPilot-Näherung)',
      herkunft: n.text, rechnung: n.rechnung, hinweise: n.hinweise || [] };
  }
  return null;
}

/** Band der Marktüblichkeit um die eingeordnete Vergleichsmiete (Anker). */
export function bandWohnung(v) {
  if (!v || !(v.qm > 0)) return null;
  const a = v.qm;
  return { anker_qm: r2(a), anker_stufe: v.quelle, anker_etikett: v.etikett, anker_quelle: v.herkunft,
    unten_qm: r2(Math.min(v.unten > 0 ? v.unten : a, a * (1 - MIETBAND_PCT / 100))),
    oben_qm: r2(Math.max(v.oben > 0 ? v.oben : a, a * (1 + MIETBAND_PCT / 100))),
    band_pct: MIETBAND_PCT, spanne: { unten: v.unten, mittel: v.mittel, oben: v.oben, ca: !!v.ca },
    einordnung: v.einordnung ? v.einordnung.wahl : 'mittel' };
}

/**
 * Zielbild je Wohnung: konservativ · Maximum · Risikozone.
 * bremse: Ergebnis mietpreisbremseFuer() ({ gilt: true|false|null }); ausnahme: '' | '556e' | '556f'
 * → { bestand_max_qm, neu_max_qm, konservativ_qm, risiko_ab_qm, faktor, bremse_gilt, bedingung, texte[] }
 */
export function zielMaximum(v, bremse, ausnahme) {
  if (!v || !(v.mittel > 0)) return null;
  const gilt = bremse ? bremse.gilt : null;
  const mitBremse = gilt !== false;           /* „bitte prüfen" rechnet vorsichtig wie mit Bremse */
  const f = mitBremse ? FAKTOR_BREMSE : FAKTOR_WISTG;
  const oben = v.oben > 0 ? v.oben : v.mittel;
  const ca = v.ca ? 'ca. ' : '';
  const bed = (v.einordnung && v.einordnung.belegt_oben) ? null
    : 'gilt, wenn Ausstattung, Lage und Zustand der Wohnung die Einordnung am Oberwert der Spanne tragen (BGH VIII ZR 82/18). Sonst gilt der Mittelwert ' + ca + qmDe(v.mittel) + ' €/m²';
  const neuMax = r2(oben * f), kons = r2(v.mittel);
  const ausn = mitBremse && (ausnahme === '556e' || ausnahme === '556f');
  const texte = [
    'Bestandsmieter: bis zum Oberwert ' + ca + qmDe(oben) + ' €/m² (§ 558 BGB), in Schritten der Kappungsgrenze, frühestens 15 Monate nach der letzten Erhöhung.',
    mitBremse
      ? 'Neuvermietung: höchstens 110 % der Vergleichsmiete, ' + ca + qmDe(neuMax) + ' €/m² (Mietpreisbremse § 556d BGB' + (gilt == null ? ', ob sie gilt, bitte prüfen' : '') + ')'
        + (ausn ? '. Eingetragene Ausnahme (' + (ausnahme === '556e' ? 'höhere Vormiete § 556e' : 'umfassende Modernisierung § 556f') + ') erlaubt mehr.' : '. Mehr nur mit Vormiete (§ 556e) oder nach umfassender Modernisierung (§ 556f).')
      : 'Neuvermietung: ohne Mietpreisbremse frei vereinbar, unbedenklich bis 120 % der Vergleichsmiete, ' + ca + qmDe(neuMax) + ' €/m². Darüber Bußgeldrisiko nach § 5 WiStG nur bei Ausnutzung eines geringen Angebots.',
  ];
  return { bestand_max_qm: r2(oben), neu_max_qm: neuMax, konservativ_qm: kons, risiko_ab_qm: neuMax, faktor: f,
    bremse_gilt: gilt, ausnahme: ausn ? ausnahme : null, ca: !!v.ca, bedingung: bed, texte, hinweis: HINWEIS_RECHT };
}

/** Kontext aus Objektangaben (Wertkern und Route nutzen denselben Weg). */
export function signaleAus(o, jahr) {
  const x = o || {};
  return { standardstufe: num(x.standardstufe), mikrolage: x.mikrolage || null, mod_punkte: num(x.mod_punkte),
    baujahr: num(x.baujahr != null ? x.baujahr : x.build_year), zustand: x.zustand || x.condition || null, jahr: num(jahr) };
}

/* ══ v3343 · FORTSCHREIBUNG BIS ZUM ZIELBILD-JAHR (Marcel 12.11.2026 abends) ══════════════════════
   „Das Zielbild ist z. B. 2030, abgerufen wird 2026 – die Miete wächst ja bis dahin noch."
   Rate in dieser Rangfolge:
     1 eigene Mietsteigerung des Nutzers (Feld der Projektion, Tab Bewertung) – dieselbe Zahl, mit der die
       App den Cashflow fortschreibt (calc.js projectAll), damit kein zweiter Wert widerspricht. Die
       Formularvorgabe 3,0 % zählt NICHT als eigene Angabe (sie ist keine Aussage über den Ort).
     2 zwei Stände des Mietspiegels derselben Gemeinde – das Register führt je Gemeinde nur EINEN Stand
       (gemessen 12.11.2026: 79 Dateien, je ein Stand), deshalb heute nie erfüllt; vorgesehen.
     3 Index der Nettokaltmieten (Destatis, VPI-Sondergliederung, 2020 = 100), bundesweit: geometrisches Mittel
       der letzten fünf vollen Jahre (zehn, sobald die Reihe sie führt). Länder- oder Kreiswerte sind nicht frei.
     Angebotsmieten-Verläufe sind kostenpflichtig und gehen nicht ein. */
import { NKM_INDEX } from './zensus_miete.js';
export const MIETSTG_FORMULAR_VORGABE = 3.0;
export function mietsteigerungRate(eigenPct, index = NKM_INDEX) {
  const e = num(eigenPct);
  if (e != null && e >= -5 && e <= 15 && Math.abs(e - MIETSTG_FORMULAR_VORGABE) > 1e-9)
    return { pct: e, quelle: 'eigen', text: 'eigene Mietsteigerung ' + String(e).replace('.', ',') + ' % je Jahr (Projektion im Tab Bewertung)' };
  const J = Object.assign({ 2020: 100 }, (index && index.jahre) || {});   /* 2020 = 100 ist die Basis der Reihe */
  const jahre = Object.keys(J).map(Number).filter((j) => num(J[j]) > 0).sort((a, b) => a - b);
  const bis = jahre[jahre.length - 1];
  const von = jahre.includes(bis - 10) ? bis - 10 : (jahre.includes(bis - 5) ? bis - 5 : jahre[0]);
  if (!(bis > von)) return null;
  const pct = Math.round((Math.pow(J[bis] / J[von], 1 / (bis - von)) - 1) * 10000) / 100;
  return { pct, quelle: 'nkm_index', von, bis,
    text: String(pct).replace('.', ',') + ' % je Jahr (Durchschnitt ' + von + ' bis ' + bis + ', Index der Nettokaltmieten des Statistischen Bundesamts, bundesweit)' };
}
/** Faktor der Fortschreibung über n Jahre (ganze und gebrochene Jahre) */
export function fortschreibung(pct, jahre) {
  const p = num(pct), n = num(jahre);
  if (p == null || n == null || n <= 0) return 1;
  return Math.pow(1 + p / 100, n);
}
/** Spanne und Grenzen auf das Zieljahr fortgeschrieben */
export function spanneFortschreiben(v, faktor) {
  if (!v) return null;
  const f = num(faktor) || 1;
  return Object.assign({}, v, { unten: r2(v.unten * f), mittel: r2(v.mittel * f), oben: r2(v.oben * f), qm: r2(v.qm * f), fortgeschrieben: f });
}
/**
 * Höchster Pfad nach § 558 BGB für einen Bestandsmieter, Monat für Monat:
 * jede Erhöhung frühestens 15 Monate nach der letzten Wirksamkeit (12 Monate Sperrfrist § 558 Abs. 1 + Zustimmungsfrist
 * § 558b), in jedem Drei-Jahres-Fenster höchstens + kappung_pct (§ 558 Abs. 3), nie über der Vergleichsmiete ZUM
 * jeweiligen Zeitpunkt (vgl_qm × (1 + rate)^t).
 * p: { ist_qm, vgl_qm, rate_pct, kappung_pct, monate, erste_ab_monat (0 = sofort wirksam möglich) }
 * → { schritte: [{ monat, qm }], ende_qm }
 */
export function kappungsPfad(p) {
  const ist = num(p.ist_qm), vgl = num(p.vgl_qm), k = (num(p.kappung_pct) || 20) / 100;
  const rate = (num(p.rate_pct) || 0) / 100, M = Math.max(0, Math.round(num(p.monate) || 0));
  if (!(ist > 0) || !(vgl > 0)) return { schritte: [], ende_qm: ist || null };
  let m = Math.max(0, Math.round(num(p.erste_ab_monat) || 0));
  let qm = ist; const schritte = []; const verlauf = [{ monat: 0, qm: ist }];
  while (m <= M) {
    const vT = vgl * Math.pow(1 + rate, m / 12);
    /* Basis der Kappung: die Miete drei Jahre vor der Wirksamkeit */
    const vor = verlauf.filter((x) => x.monat <= m - 36).pop() || verlauf[0];
    const grenze = Math.min(vT, vor.qm * (1 + k));
    if (grenze > qm + 0.005) { qm = r2(grenze); schritte.push({ monat: m, qm }); verlauf.push({ monat: m, qm }); m += 15; }
    else m += 1;
  }
  return { schritte, ende_qm: qm };
}
