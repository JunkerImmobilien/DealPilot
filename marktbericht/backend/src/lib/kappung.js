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
export function erhoehungspfad558(istJahr, ansatzJahr, lzsPct, kappungPct, rndJahre) {
  const I = Number(istJahr) / 12, A = Number(ansatzJahr) / 12, k = Number(kappungPct) / 100, i = Number(lzsPct) / 100;
  if (!(I > 0) || !(A > I) || !(k > 0) || !(i > 0)) return null;
  const maxMon = Number(rndJahre) > 0 ? Math.round(Number(rndJahre) * 12) : 1200;
  let m = 0, miete = I, bw = 0;
  const schritte = [];
  let naechste = 3;
  while (m < maxMon) {
    if (m === naechste) {
      const neu = Math.min(A, miete * (1 + k));
      schritte.push({ ab_monat: m, miete_monat: Math.round(neu * 100) / 100 });
      miete = neu; naechste += 36;
    }
    if (miete >= A - 0.005) break;
    bw += (miete - A) / Math.pow(1 + i, (m + 1) / 12);
    m++;
  }
  return { jahre: Math.round(m / 12 * 10) / 10, monate: m, barwert_eur: Math.round(bw), schritte, kappung_pct: kappungPct,
    gedeckelt_auf_rnd: m >= maxMon,
    annahmen: 'Mieterhöhung nach § 558 BGB: Wartefrist als erfüllt unterstellt, Verlangen zum Stichtag, Wirkung nach drei Monaten (§ 558b), danach alle drei Jahre um die Kappungsgrenze von '
      + kappungPct + ' %, höchstens bis zur marktüblichen Miete' };
}
