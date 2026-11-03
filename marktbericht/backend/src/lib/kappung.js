/* ═══════════════════════════════════════════════════════════════════════
   lib/kappung.js · v2993 — Kappungsgrenze (§ 558 Abs. 3 BGB) und der
   Erhöhungspfad einer Bestandsmiete bis zur marktüblichen Miete.

   WOZU. Liegt die Miete einer Wohnung unter dem Band der Marktüblichkeit,
   ist die Abweichung ein besonderes objektspezifisches Grundstücksmerkmal
   (§ 8 Abs. 3 ImmoWertV), und „Möglichkeiten der Anpassung … (Mieterhöhungs-
   möglichkeiten) sind zu berücksichtigen" (ImmoWertA zu § 31 c). Bei
   Wohnraum bestimmt § 558 BGB, wie schnell das geht: Zustimmungsverlangen,
   Wirkung ab dem dritten Kalendermonat nach Zugang (§ 558b Abs. 1), höchstens
   20 % in drei Jahren (15 %, wo eine Landesverordnung gilt), nie über die
   ortsübliche Vergleichsmiete. Bis v2992 galten ohne Vertragsdatum nur die
   Szenarien 3/5/10 Jahre.

   Die Liste der Landesverordnungen ist ein SPIEGEL von
   frontend/js/data/kappungsgrenzen.json (das Backend-Image enthält frontend/
   nicht). tools/kappungsgrenzen-pruefen.mjs bricht ab, wenn beide abweichen.
   Die Logik folgt frontend/js/potenzial.js kappung().
   ═══════════════════════════════════════════════════════════════════════ */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
let _liste = null;
function liste() {
  if (_liste !== null) return _liste;
  try { _liste = JSON.parse(readFileSync(join(HIER, 'data', 'kappungsgrenzen.json'), 'utf8')); }
  catch (e) { _liste = false; }
  return _liste;
}
const PRAEFIX = { '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE', '07': 'RP', '08': 'BW',
  '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB', '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH' };

/** Kappungsgrenze für eine Gemeinde (AGS 8-stellig). Eigene Angabe (15/20) geht vor. */
export function kappungFuer(ags, eigenPct, heute = new Date()) {
  const e = Number(eigenPct);
  if (e === 15 || e === 20) return { pct: e, herkunft: 'eigen', pruefen: false, text: 'Kappungsgrenze ' + e + ' % in 3 Jahren (eigene Angabe)' };
  const std = (warum) => ({ pct: 20, herkunft: 'auffang', pruefen: true, text: 'Kappungsgrenze 20 % in 3 Jahren (§ 558 Abs. 3 BGB) — ' + warum + ', bitte prüfen' });
  const K = liste();
  if (!K || !K.laender) return std('die Liste der Landesverordnungen liegt nicht vor');
  const a = String(ags || '').replace(/\D/g, '');
  if (a.length !== 8) return std('Gemeinde nicht eindeutig ermittelt');
  const land = PRAEFIX[a.slice(0, 2)], L = land && K.laender[land];
  const std2 = Number(K.standard_kappung_pct) || 20;
  if (!L) return { pct: std2, herkunft: 'gesetz', pruefen: false, text: 'Kappungsgrenze ' + std2 + ' % in 3 Jahren (§ 558 Abs. 3 BGB), keine Landesverordnung' };
  const g = (Array.isArray(L.gemeinden) ? L.gemeinden : []).find((x) => x && x.ags === a);
  const tag = heute.toISOString().slice(0, 10);
  if (g && g.kappung15) {
    const bis = g.kappung_gueltig_bis || L.gueltig_bis || null;
    if (bis && bis < tag) return { pct: std2, herkunft: 'ausgelaufen', pruefen: true, text: 'Kappungsgrenze ' + std2 + ' % in 3 Jahren: die Landesverordnung ist am ' + bis + ' ausgelaufen, bitte prüfen' };
    return { pct: 15, herkunft: 'verordnung', pruefen: !!L.unsicher, url: L.url || null,
      text: 'Kappungsgrenze 15 % in 3 Jahren: ' + (g.name || 'die Gemeinde') + ' steht in der Landesverordnung' + (L.fundstelle ? ' (' + L.fundstelle + ')' : '') };
  }
  return { pct: std2, herkunft: 'gesetz', pruefen: !!L.unsicher,
    text: 'Kappungsgrenze ' + std2 + ' % in 3 Jahren (§ 558 Abs. 3 BGB): Gemeinde nicht in der Landesverordnung' + (L.unsicher ? ' — Landesliste unsicher, bitte prüfen' : '') };
}

/**
 * Erhöhungspfad nach § 558 BGB und der Barwert der Mindermiete auf diesem Pfad.
 * Annahmen (im Ergebnis benannt): Wartefrist erfüllt, Verlangen am Stichtag,
 * Wirkung nach 3 Monaten, danach je 36 Monate um die volle Kappungsgrenze,
 * höchstens bis zur marktüblichen Miete. Monatlich gerechnet, abgezinst mit dem
 * Liegenschaftszins. Deckel: Restnutzungsdauer.
 * @param {number} istJahr     Ist-Miete der Wohnung p. a.
 * @param {number} ansatzJahr  marktübliche Miete p. a. (Ansatz im Ertragswert)
 * @returns {null | {jahre, barwert_eur, schritte[], kappung_pct, annahmen}}
 */
/* ══ v3140 · N114 · DIE LETZTE ERHÖHUNG ZÄHLT (Marcel 03.11.2026) ══════════════
   Bis v3139 unterstellte der Pfad immer „Wartefrist erfüllt" und rechnete die
   Kappungsgrenze auf die heutige Miete - auch wenn die Wohnung vor sechs Monaten
   erhöht worden war. Dann setzt die erste Anhebung zu früh und zu hoch an, die
   Mindermiete wird zu klein und der Ertragswert zu hoch. ImmoWertA 31.(2) b)
   (Muster-AH, FK Städtebau 20.09.2023, hess. Fassung S. 33): „Bei bestehenden
   Mietverhältnissen sind Mieterhöhungsmöglichkeiten zu berücksichtigen. Bei
   Wohnraummietverhältnissen sind insoweit … die differenzierten Vorgaben des BGB
   … zu beachten." Jetzt, wenn die letzte Erhöhung eingetragen ist (opts.letzte):
     - Wartefrist § 558 Abs. 1 BGB: die Erhöhung wirkt frühestens 15 Monate nach
       der letzten (Verlangen ein Jahr danach, Wirkung § 558b Abs. 1 drei Monate
       später) - dieselbe Regel wie frontend/js/mietpotenzial-kern.js mhTermine()
       (TERMIN_REGEL '558': warte 12, plus 3); tools/wertermittlung-pruefen.mjs
       vergleicht beide an echten Daten (B21c).
     - Kappungsgrenze § 558 Abs. 3 BGB: Bezug ist die Miete drei Jahre VOR dem
       Wirksamwerden. Mit Betrag der letzten Erhöhung (opts.letzteBetragMonat) ist
       sie bekannt; ohne Betrag und mit der letzten Erhöhung im Fenster rechnet der
       Pfad erst, wenn sie aus dem Fenster fällt (sicher erreichbar, keine
       erfundene Zahl) und sagt es.
     - Staffel- und Indexmiete: keine Erhöhung nach § 558 (§ 557a Abs. 2, § 557b
       Abs. 2 BGB) -> null, der Aufrufer nennt den Grund.
   Ohne letzte Erhöhung rechnet der Pfad wie bis v3139 (Annahme im Text benannt). */
const ymOffset = (st, ym) => {
  const r = /^(\d{4})-(\d{2})/.exec(String(ym || ''));
  if (!r || !(st instanceof Date) || !Number.isFinite(st.getTime())) return null;
  return (Number(r[1]) - st.getUTCFullYear()) * 12 + (Number(r[2]) - 1 - st.getUTCMonth());
};
const ymPlus = (st, off) => {
  const t = st.getUTCFullYear() * 12 + st.getUTCMonth() + off;
  return String(Math.floor(t / 12)) + '-' + String((t % 12) + 1).padStart(2, '0');
};
const mmjj = (ym) => ym.slice(5, 7) + '/' + ym.slice(0, 4);
const eurM = (x) => (Math.round(x * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
/** v3140 · Staffel-/Indexmiete schliesst § 558 aus (wie mietpotenzial-kern.js vertragGrenzen) */
export function ausschluss558(mvArt) {
  const a = String(mvArt || '').toLowerCase();
  if (a === 'staffel') return 'Staffelmiete: keine Erhöhung nach § 558 BGB während der Staffel (§ 557a Abs. 2 BGB)';
  if (a === 'index') return 'Indexmiete: keine Erhöhung bis zur Vergleichsmiete (§ 557b Abs. 2 BGB)';
  return null;
}

export function erhoehungspfad558(istJahr, ansatzJahr, lzsPct, kappungPct, rndJahre, opts = {}) {
  const I = Number(istJahr) / 12, A = Number(ansatzJahr) / 12, k = Number(kappungPct) / 100, i = Number(lzsPct) / 100;
  if (!(I > 0) || !(A > I) || !(k > 0) || !(i > 0)) return null;
  if (ausschluss558(opts.mvArt)) return null;
  const maxMon = Number(rndJahre) > 0 ? Math.round(Number(rndJahre) * 12) : 1200;
  const st = opts.stichtag instanceof Date ? opts.stichtag : null;
  /* Monat der letzten Erhoehung relativ zum Stichtagsmonat (negativ = Vergangenheit) */
  let l = st && opts.letzte ? ymOffset(st, opts.letzte) : null;
  const letzteUngueltig = l != null && l > 0;   /* in der Zukunft eingetragen: nicht verwendbar */
  if (letzteUngueltig) l = null;
  const B = (l != null && Number(opts.letzteBetragMonat) > 0 && Number(opts.letzteBetragMonat) < I) ? Number(opts.letzteBetragMonat) : null;
  /* Miete im Monat t (t < 0: Vergangenheit; null = unbekannt) */
  const sim = [];
  const mieteAm = (t) => {
    if (t >= 0) return sim[t];
    if (l == null || t >= l) return I;
    return B != null ? I - B : null;
  };
  let m = 0, miete = I, bw = 0, letzteWirk = l;
  const schritte = [];
  while (m < maxMon) {
    /* Wartefrist: 15 Monate nach der letzten Erhoehung (§ 558 Abs. 1), fruehestens Verlangen am Stichtag + 3 (§ 558b) */
    const frueh = letzteWirk == null ? 3 : Math.max(3, letzteWirk + 15);
    if (m >= frueh) {
      const basis = mieteAm(m - 36);
      if (basis != null) {
        const neu = Math.min(A, basis * (1 + k));
        if (neu > miete + 0.005) {
          schritte.push({ ab_monat: m, miete_monat: Math.round(neu * 100) / 100 });
          miete = neu; letzteWirk = m;
        }
      }
    }
    sim[m] = miete;
    if (miete >= A - 0.005) break;
    bw += (miete - A) / Math.pow(1 + i, (m + 1) / 12);
    m++;
  }
  const out = { jahre: Math.round(m / 12 * 10) / 10, monate: m, barwert_eur: Math.round(bw), schritte, kappung_pct: kappungPct,
    gedeckelt_auf_rnd: m >= maxMon, wartefrist_geprueft: l != null };
  if (l == null) {
    out.annahmen = 'Mieterhöhung nach § 558 BGB: Wartefrist als erfüllt unterstellt, Verlangen zum Stichtag, Wirkung nach drei Monaten (§ 558b), danach alle drei Jahre um die Kappungsgrenze von '
      + kappungPct + ' %, höchstens bis zur marktüblichen Miete';
    if (letzteUngueltig) out.hinweis = 'die eingetragene letzte Erhöhung liegt nach dem Wertermittlungsstichtag und ist nicht verwendet';
    else out.hinweis = 'letzte Erhöhung nicht eingetragen';
    return out;
  }
  const lYm = ymPlus(st, l);
  out.letzte_erhoehung = lYm;
  out.erste_anhebung = schritte.length ? ymPlus(st, schritte[0].ab_monat) : null;
  /* erste Anhebung spaeter als die Wartefrist erlaubt -> die Kappung (Fenster) hat sie verschoben */
  const s0 = schritte.length ? schritte[0].ab_monat : null;
  const verschoben = s0 != null && s0 > Math.max(3, l + 15);
  const imFenster = s0 != null && (s0 - 36 < l || verschoben);
  out.kappung_angerechnet_eur = (imFenster && B != null) ? Math.round(B * 100) / 100 : null;
  out.kappung_basis_unbekannt = verschoben && B == null;
  out.annahmen = 'Mieterhöhung nach § 558 BGB: letzte Erhöhung ' + mmjj(lYm)
    + (out.erste_anhebung ? ', erste Anhebung wirksam ab ' + mmjj(out.erste_anhebung) : '')
    + ' (Wartefrist § 558 Abs. 1, Wirkung § 558b Abs. 1 BGB)'
    + (out.kappung_angerechnet_eur != null ? ', die letzte Erhöhung (' + eurM(B) + '/Monat) auf die Kappungsgrenze angerechnet (§ 558 Abs. 3 BGB)' : '')
    + (out.kappung_basis_unbekannt ? ', Betrag der letzten Erhöhung nicht eingetragen: die Kappungsgrenze erst angesetzt, wenn sie aus dem Drei-Jahres-Fenster fällt' : '')
    + ', danach alle drei Jahre um die Kappungsgrenze von ' + kappungPct + ' %, höchstens bis zur marktüblichen Miete';
  return out;
}
