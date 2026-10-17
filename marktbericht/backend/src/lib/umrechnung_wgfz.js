/* ════════════════════════════════════════════════════════════════════
   v2361 · UMRECHNUNGSKOEFFIZIENT WERTRELEVANTE GESCHOSSFLAECHENZAHL (WGFZ)

   § 16 Abs. 4 / § 40 ImmoWertV: weicht die WGFZ des Wertermittlungsobjekts
   von der des Bodenrichtwertgrundstuecks ab, wird der Bodenrichtwert mit
   den Umrechnungskoeffizienten des Gutachterausschusses angepasst:

       BW/m2 = BRW × UK(WGFZ Objekt) / UK(WGFZ Richtwertgrundstueck)

   Anlass: der Grundstuecksmarktbericht Bielefeld 2026 (Abschn. 4.7.5,
   S. 30 f.) rechnet MEHRFAMILIENHAUS-Grundstuecke ueber die WGFZ, nicht
   ueber die Flaeche. Marcel 17.10.2026: „so wie es richtig ist nach
   ImmoWertV".

   Regeln (dieselben wie beim Flaechenkoeffizienten, umrechnung_flaeche.js):
   - nur aus dem Dokument des Ausschusses, in SEINEM Geltungsbereich;
   - lineare Interpolation ueber Bodenrichtwert und WGFZ, KEINE
     Extrapolation („nicht sachgerecht", Bielefeld S. 31);
   - Koeffizienten wie im amtlichen Beispiel auf zwei Stellen gerundet;
   - die WGFZ des Objekts ist eine Angabe des Nutzers (oberirdische
     Geschossflaeche nach § 16 Abs. 4 / Grundstuecksflaeche). Eine
     Naeherung aus Wohn- oder Bruttogrundflaeche gibt es bewusst NICHT —
     Keller, Dachgeschoss (75 %) und Treppenhaus schwanken zu stark.
   ════════════════════════════════════════════════════════════════════ */
import { finde } from './ausschuss_register.js';
import { artSchluessel } from './umrechnung_flaeche.js';

export const KENNZAHL = 'umrechnungskoeffizient_wgfz';

const r2 = (x) => Math.round(x * 100) / 100;
const de = (x) => String(x).replace('.', ',');

/* Wert einer Zeile an der Stelle w (lineare Interpolation, keine Extrapolation). */
function zeileBei(wgfz, uk, w) {
  for (let i = 0; i < wgfz.length; i++) {
    if (Math.abs(wgfz[i] - w) < 1e-9) return uk[i] != null ? Number(uk[i]) : null;
    if (i + 1 < wgfz.length && wgfz[i] < w && w < wgfz[i + 1]) {
      if (uk[i] == null || uk[i + 1] == null) return null;
      return Number(uk[i]) + (Number(uk[i + 1]) - Number(uk[i])) * (w - wgfz[i]) / (wgfz[i + 1] - wgfz[i]);
    }
  }
  return null;
}

/**
 * Koeffizient einer amtlichen Formel fuer (Bodenrichtwert, WGFZ).
 * → { k, weg } oder { k: null, grund }
 */
export function koeffizientFuer(formel, brw, w) {
  const f = formel || {};
  w = Number(w); brw = Number(brw);
  if (!(w > 0)) return { k: null, grund: 'wgfz_fehlt' };
  if (f.form === 'wgfz_potenz') {
    const g = f.gilt || {};
    if ((g.wgfz_von != null && w < g.wgfz_von) || (g.wgfz_bis != null && w > g.wgfz_bis)) return { k: null, grund: 'ausserhalb_wgfz' };
    return { k: r2(Number(f.faktor || 1) * Math.pow(w, Number(f.exponent))), weg: 'Formel' };
  }
  if (f.form !== 'wgfz_tabelle' || !Array.isArray(f.wgfz) || !Array.isArray(f.zeilen) || !f.zeilen.length) return { k: null, grund: 'keine_tabelle' };
  const zeilen = f.zeilen.slice().sort((a, b) => (a.brw ?? 0) - (b.brw ?? 0));
  if (zeilen.length === 1 && zeilen[0].brw == null) {
    const k = zeileBei(f.wgfz, zeilen[0].uk, w);
    return k == null ? { k: null, grund: 'ausserhalb_wgfz' } : { k: r2(k), weg: 'Tabelle' };
  }
  if (!(brw > 0)) return { k: null, grund: 'brw_fehlt' };
  const lo = zeilen.filter((z) => z.brw <= brw).pop(), hi = zeilen.find((z) => z.brw >= brw);
  if (!lo || !hi) return { k: null, grund: 'ausserhalb_brw' };
  const kl = zeileBei(f.wgfz, lo.uk, w), kh = zeileBei(f.wgfz, hi.uk, w);
  if (kl == null || kh == null) return { k: null, grund: 'ausserhalb_wgfz' };
  const k = lo.brw === hi.brw ? kl : kl + (kh - kl) * (brw - lo.brw) / (hi.brw - lo.brw);
  return { k: r2(k), weg: lo.brw === hi.brw ? 'Tabelle' : 'Tabelle, zwischen ' + lo.brw + ' und ' + hi.brw + ' €/m² interpoliert' };
}

/* Gueltiger Satz fuer die Gemeinde (Kaskade ueber finde) und die Objektart. */
export function satzFuer(ags, objektart, alle) {
  const t = (alle || finde(KENNZAHL, ags) || []).filter(Boolean);
  if (!t.length) return null;
  const art = artSchluessel(objektart);
  return t.find((s) => ((s.geltungsbereich || {}).objektarten || []).indexOf(art) >= 0)
    || t.find((s) => !((s.geltungsbereich || {}).objektarten || []).length) || null;
}

/**
 * WGFZ-Anpassung des Bodenrichtwerts.
 * → { verfuegbar, faktor, uk_zone, uk_objekt, bodenwert_eur_qm, quelle…, hinweis } oder { verfuegbar:false, grund, hinweis }
 */
export function wgfzAnpassung({ ags, objektart, brw_eur_qm, wgfz_zone, wgfz_objekt, saetze }) {
  const nein = (grund, hinweis, extra) => ({ verfuegbar: false, grund, hinweis: hinweis || null, ...(extra || {}) });
  const s = satzFuer(ags, objektart, saetze);
  if (!s) return nein('kein_satz');
  const quelle = { ausschuss: s.ausschuss || null, quelle_url: s.quelle_url || null, seite: s.seite || null,
    jahrgang: s.jahrgang || null, lizenz: s.lizenz || null, quellenvermerk: s.quellenvermerk || null };
  if (s.vollstaendig === false || s.warum_kein_wert) return nein('sperre', s.warum_kein_wert || null, { quelle });
  const wz = Number(wgfz_zone), wo = Number(wgfz_objekt), brw = Number(brw_eur_qm);
  if (!(wz > 0)) return nein('wgfz_zone_fehlt',
    'Die Bodenrichtwertzone nennt keine WGFZ — eine Umrechnung nach der Geschossflächenzahl ist hier nicht vorgesehen.', { quelle });
  if (!(wo > 0)) return nein('wgfz_objekt_fehlt',
    'Der Gutachterausschuss rechnet den Bodenwert über die wertrelevante Geschossflächenzahl (WGFZ) um. Die WGFZ '
      + 'des Objekts ist nicht angegeben — der Bodenwert ist insoweit nicht angepasst und vorläufig. Trag die WGFZ '
      + '(oberirdische Geschossfläche nach § 16 Abs. 4 ImmoWertV geteilt durch die Grundstücksfläche) ein.', { quelle, wgfz_zone: wz });
  if (Math.abs(wz - wo) < 1e-9) return nein('gleich_norm', null, { quelle, wgfz_zone: wz, wgfz_objekt: wo });
  const kz = koeffizientFuer(s.formel, brw, wz), ko = koeffizientFuer(s.formel, brw, wo);
  if (kz.k == null || ko.k == null) {
    const g = (kz.k == null ? kz : ko).grund;
    return nein(g, 'Die Umrechnungstabelle des Gutachterausschusses deckt '
      + (g === 'ausserhalb_brw' ? 'diesen Bodenrichtwert (' + de(brw) + ' €/m²)' : 'die WGFZ ' + de(kz.k == null ? wz : wo))
      + ' nicht ab; eine Extrapolation ist nicht sachgerecht. Der Bodenwert ist insoweit nicht angepasst.', { quelle, wgfz_zone: wz, wgfz_objekt: wo });
  }
  const faktor = ko.k / kz.k;
  const bwQm = Math.round(brw * faktor * 100) / 100;
  return {
    verfuegbar: true, amtlich: true, stufe: 'A',
    wgfz_zone: wz, wgfz_objekt: wo, uk_zone: kz.k, uk_objekt: ko.k, faktor: Math.round(faktor * 10000) / 10000,
    bodenwert_eur_qm: bwQm, weg: ko.weg, quelle,
    hinweis: 'Umrechnung nach der wertrelevanten Geschossflächenzahl (§ 16 Abs. 4, § 40 ImmoWertV) mit den '
      + 'Umrechnungskoeffizienten des ' + (s.ausschuss || 'Gutachterausschusses') + (s.seite ? ' (' + s.seite + ')' : '') + ': '
      + de(brw) + ' €/m² × ' + de(ko.k) + ' / ' + de(kz.k) + ' = ' + de(bwQm) + ' €/m² (WGFZ Objekt ' + de(wo)
      + ', Richtwertgrundstück ' + de(wz) + ').',
  };
}

/* Pruefung gegen das amtliche Anwendungsbeispiel. */
export function pruefeBeispiel(s) {
  const b = s && s.anwendungsbeispiel;
  if (!b) return null;
  const r = wgfzAnpassung({ ags: s.ags, objektart: ((s.geltungsbereich || {}).objektarten || [])[0] || null, brw_eur_qm: b.brw_eur_qm, wgfz_zone: b.wgfz_norm,
    wgfz_objekt: b.wgfz_objekt, saetze: [s] });
  if (!r.verfuegbar) return { ok: false, grund: r.grund };
  return { ok: Math.abs(Math.round(r.bodenwert_eur_qm) - Number(b.ergebnis_eur_qm)) <= 1, ist: r.bodenwert_eur_qm, soll: b.ergebnis_eur_qm };
}

export default { KENNZAHL, koeffizientFuer, satzFuer, wgfzAnpassung, pruefeBeispiel };
