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
   - die WGFZ des Objekts ist zuerst eine Angabe des Nutzers (oberirdische
     Geschossflaeche nach § 16 Abs. 4 / Grundstuecksflaeche).
     Hier stand bis zum 11.11.2026: „Eine Naeherung aus Wohn- oder
     Bruttogrundflaeche gibt es bewusst NICHT — Keller, Dachgeschoss (75 %)
     und Treppenhaus schwanken zu stark." AUFGEHOBEN durch Marcel am
     11.11.2026 („Wir haben oft ‚WGFZ fehlt'. Können wir das ändern?"):
     fehlt die Angabe, leitet wgfzAbleitung() sie ab (v3293, Stufe N,
     nie amtlich, eigene Angabe genauer) - siehe unten.
   ════════════════════════════════════════════════════════════════════ */
import { finde } from './ausschuss_register.js';
import { artSchluessel } from './umrechnung_flaeche.js';
import { bgf as nhkBgf } from './nhk2010.js';   /* v3293 · BGF aus Wohnflaeche (SW-RL-Faktor) */
import { readFileSync } from 'node:fs';   /* v2375 */

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

/* v2363 · Matrix (Faktor je Objekt-WGFZ × Richtwert-WGFZ), bilinear, nur innerhalb
   eines Teils und nur zwischen vier vorhandenen Zellen. */
function matrixWert(f, wo, wz) {
  const um = (achse, x) => {
    for (let i = 0; i < achse.length; i++) {
      if (Math.abs(achse[i] - x) < 1e-9) return [i, i, 0];
      if (i + 1 < achse.length && achse[i] < x && x < achse[i + 1]) return [i, i + 1, (x - achse[i]) / (achse[i + 1] - achse[i])];
    }
    return null;
  };
  for (const t of f.teile || []) {
    const a = um(t.objekt || [], wo), b = um(t.norm || [], wz);
    if (!a || !b) continue;
    const z = (i, j) => (t.werte[i] || [])[j];
    const c = [z(a[0], b[0]), z(a[0], b[1]), z(a[1], b[0]), z(a[1], b[1])];
    if (c.some((x) => x == null)) continue;
    const o1 = c[0] + (c[1] - c[0]) * b[2], o2 = c[2] + (c[3] - c[2]) * b[2];
    return o1 + (o2 - o1) * a[2];
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
  /* v2363 · Verhaeltnisformeln der Ausschuesse (Ernte NRW 17.10.2026). Sie liefern
     eine Wertzahl f(WGFZ); der Koeffizient ist f(Objekt)/f(Zone). UNGERUNDET -
     die Dokumente rechnen mit der Funktion, nicht mit gerundeten Tabellenwerten. */
  if (f.form === 'wgfz_wurzel') {   /* Bottrop: a·√w + b·w + c */
    return { k: Number(f.a) * Math.sqrt(w) + Number(f.b) * w + Number(f.c), weg: 'Formel', funktion: true };
  }
  if (f.form === 'wgfz_polynom') {   /* Duesseldorf: Σ k_i · w^i */
    const k = (f.koeffizienten || []).reduce((s, c, i) => s + Number(c) * Math.pow(w, i), 0);
    return { k, weg: 'Formel', funktion: true };
  }
  if (f.form === 'wgfz_exp') {   /* Koeln: Wertzahl aus der Tabelle des Dokuments, sonst a·e^(b·w), ab Grenze linear */
    const t = f.tabelle;
    if (t && Array.isArray(t.wgfz) && w >= t.wgfz[0] && w <= t.wgfz[t.wgfz.length - 1]) {
      const k = zeileBei(t.wgfz, t.wz, w);
      if (k != null) return { k, weg: 'Wertzahl-Tabelle', funktion: true };
    }
    if (f.linear_ab != null && w >= Number(f.linear_ab)) return { k: w * Number(f.linear_faktor || 1), weg: 'Formel (linear)', funktion: true };
    return { k: Number(f.faktor) * Math.exp(Number(f.exponent) * w), weg: 'Formel', funktion: true };
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
  /* v2363 · Geltung des Ausschusses (WGFZ-Spanne) fuer BEIDE Werte - eine Tabelle,
     die weiter reicht als der Text erlaubt, gilt nur im Text (Duisburg 0,7–1,7). */
  const gb = s.geltungsbereich || {};
  const draussen = [wz, wo].find((x) => (gb.wgfz_von != null && x < gb.wgfz_von - 1e-9) || (gb.wgfz_bis != null && x > gb.wgfz_bis + 1e-9));
  if (draussen != null) return nein('ausserhalb_wgfz', 'Die Umrechnung des Gutachterausschusses gilt für eine WGFZ von '
    + de(gb.wgfz_von ?? '–') + ' bis ' + de(gb.wgfz_bis ?? '–') + '; hier ' + de(draussen) + '. Eine Extrapolation ist nicht sachgerecht. '
    + 'Der Bodenwert ist insoweit nicht angepasst.' + (gb.ausserhalb_wortlaut ? ' Der Ausschuss: ' + gb.ausserhalb_wortlaut : ''),
    { quelle, wgfz_zone: wz, wgfz_objekt: wo });
  /* v2363 · Matrix (Muelheim): der Faktor steht direkt fuer das Paar (Objekt, Zone). */
  if ((s.formel || {}).form === 'wgfz_matrix') {
    const m = matrixWert(s.formel, wo, wz);
    if (m == null) return nein('ausserhalb_wgfz', 'Die Umrechnungstabelle des Gutachterausschusses führt für WGFZ '
      + de(wo) + ' bei einer Richtwert-WGFZ von ' + de(wz) + ' keinen Wert; eine Extrapolation ist nicht sachgerecht.', { quelle, wgfz_zone: wz, wgfz_objekt: wo });
    const fm = Math.round(m * 10000) / 10000, bw = Math.round(brw * m * 100) / 100;
    return { verfuegbar: true, amtlich: true, stufe: 'A', wgfz_zone: wz, wgfz_objekt: wo, uk_zone: 1, uk_objekt: fm, faktor: fm,
      bodenwert_eur_qm: bw, weg: 'Tabelle (Objekt-WGFZ × Richtwert-WGFZ)', quelle,
      hinweis: 'Umrechnung nach der wertrelevanten Geschossflächenzahl (§ 16 Abs. 4, § 40 ImmoWertV) mit der Tabelle des '
        + (s.ausschuss || s.gaa_name || 'Gutachterausschusses') + (s.seite ? ' (' + s.seite + ')' : '') + ': Faktor ' + de(fm)
        + ' für WGFZ ' + de(wo) + ' bei Richtwert-WGFZ ' + de(wz) + (brw > 0 ? ' → ' + de(bw) + ' €/m²' : '') + '.'
        + (s.bericht_hinweis ? ' ' + s.bericht_hinweis : '') };
  }
  const kz = koeffizientFuer(s.formel, brw, wz), ko = koeffizientFuer(s.formel, brw, wo);
  if (kz.k == null || ko.k == null) {
    const g = (kz.k == null ? kz : ko).grund;
    return nein(g, 'Die Umrechnungstabelle des Gutachterausschusses deckt '
      + (g === 'ausserhalb_brw' ? 'diesen Bodenrichtwert (' + de(brw) + ' €/m²)' : 'die WGFZ ' + de(kz.k == null ? wz : wo))
      + ' nicht ab; eine Extrapolation ist nicht sachgerecht. Der Bodenwert ist insoweit nicht angepasst.', { quelle, wgfz_zone: wz, wgfz_objekt: wo });
  }
  let faktor = ko.k / kz.k;
  /* v2363 · Begrenzung des Ausschusses (Bottrop 0,70–1,30, Duesseldorf ±35 %) */
  const bg = (s.formel || {}).begrenzung || {};
  let begrenzt = false;
  if (bg.uk_min != null && faktor < bg.uk_min) { faktor = Number(bg.uk_min); begrenzt = true; }
  if (bg.uk_max != null && faktor > bg.uk_max) { faktor = Number(bg.uk_max); begrenzt = true; }
  const bwQm = Math.round(brw * faktor * 100) / 100;
  const fx = (x) => de(ko.funktion ? Math.round(x * 1000) / 1000 : x);
  return {
    verfuegbar: true, amtlich: true, stufe: 'A',
    wgfz_zone: wz, wgfz_objekt: wo, uk_zone: Math.round(kz.k * 10000) / 10000, uk_objekt: Math.round(ko.k * 10000) / 10000,
    faktor: Math.round(faktor * 10000) / 10000, begrenzt,
    bodenwert_eur_qm: bwQm, weg: ko.weg, quelle,
    hinweis: 'Umrechnung nach der wertrelevanten Geschossflächenzahl (§ 16 Abs. 4, § 40 ImmoWertV) mit den '
      + 'Umrechnungskoeffizienten des ' + (s.ausschuss || s.gaa_name || 'Gutachterausschusses') + (s.seite ? ' (' + s.seite + ')' : '') + ': '
      + de(brw) + ' €/m² × ' + fx(ko.k) + ' / ' + fx(kz.k) + (begrenzt ? ' (begrenzt auf ' + de(faktor) + ')' : '')
      + ' = ' + de(bwQm) + ' €/m² (WGFZ Objekt ' + de(wo) + ', Richtwertgrundstück ' + de(wz) + ').'
      /* v2378 · abgedruckte und angewandte Tabellen: der Verweis steht darunter (Marcel 19.10.) */
      + (s.bericht_hinweis ? ' ' + s.bericht_hinweis : ''),
  };
}

/* ══ v2375 · DIE DEALPILOT-FORMEL FUER DIE WGFZ (Stufe N) ════════════════════
   Abgeleitet aus allen amtlichen WGFZ-Tabellen des Registers
   (tools/uk-wgfz-naeherung-ableiten.mjs -> uk-wgfz-naeherung.json):
     UK(Objekt)/UK(Richtwert) = (WGFZ Objekt / WGFZ Richtwert)^b
   v2593 · Stand der JSON (gwb, 21.10.2026): b = 0,498 aus 80 Kurven aus 15 Laendern;
   Streuung der Exponenten b_p10 0,253 / b_p90 0,775. Nachgeprueft mit ausgelassener
   Kurve (pruefung.loto): Abweichung Median 3,6 %, 8 von 10 Punkten unter 9,4 %,
   P95 19,5 %; die Spanne r^b_p10..r^b_p90 deckt 78 % der amtlichen Punkte. Hier
   stand „b = 0,501, 75 Kurven aus 14 Laendern, Median 3,7 %, P90 14,9 %" - der
   Stand vom 17.10.; die Zahl im Text kommt seit jeher aus der JSON, nicht von hier. Nur fuer die Objektarten der Datei (MFH, ETW, gemischt), nur im
   Gueltigkeitsbereich, keine Extrapolation. Im Bericht IMMER „abgeleitet aus der
   DealPilot-Formel", nie amtlich. Die Rangfolge (amtlich > oertliche Tabelle,
   auch uebertragen > diese Formel) setzt der Aufrufer. */
let _WN = null;
function _wn() {
  if (_WN) return _WN;
  try { _WN = JSON.parse(readFileSync(new URL('./uk-wgfz-naeherung.json', import.meta.url), 'utf8')); }
  catch (e) { _WN = {}; }
  return _WN;
}
export function wgfzNaeherung({ objektart, brw_eur_qm, wgfz_zone, wgfz_objekt }) {
  const nein = (grund, hinweis) => ({ verfuegbar: false, grund, hinweis: hinweis || null, naeherung: true });
  const N = _wn(), g = N.gilt_fuer || {}, kl = N.gwb || {};
  const b = Number(kl.b);
  if (!(b > 0) || !(Number(kl.tabellen) >= Number(N.mindest_tabellen || 8))) return nein('keine_formel');
  const art = artSchluessel(objektart);
  if ((g.objektarten || []).indexOf(art) < 0) return nein('objektart');
  const wz = Number(wgfz_zone), wo = Number(wgfz_objekt), brw = Number(brw_eur_qm);
  if (!(wz > 0)) return nein('wgfz_zone_fehlt');
  if (!(wo > 0)) return nein('wgfz_objekt_fehlt', 'Die Bodenrichtwertzone führt eine WGFZ von ' + de(wz) + '. Mit der WGFZ '
    + 'des Objekts (§ 16 Abs. 4 ImmoWertV) ließe sich der Bodenwert daran anpassen — trag sie ein.');
  if (Math.abs(wz - wo) < 1e-9) return nein('gleich_norm');
  const r = wo / wz;
  const raus = [wz, wo].some((x) => x < g.wgfz_von - 1e-9 || x > g.wgfz_bis + 1e-9)
    || r < g.verhaeltnis_von - 1e-9 || r > g.verhaeltnis_bis + 1e-9;
  if (raus) return nein('ausserhalb_formel', 'Die DealPilot-Formel für die WGFZ gilt für eine WGFZ von ' + de(g.wgfz_von) + ' bis '
    + de(g.wgfz_bis) + ' und ein Verhältnis Objekt/Richtwert von ' + de(g.verhaeltnis_von) + ' bis ' + de(g.verhaeltnis_bis)
    + '; hier WGFZ ' + de(wo) + ' zu ' + de(wz) + '. Eine Extrapolation ist nicht sachgerecht — der Bodenwert ist insoweit nicht angepasst.');
  const faktor = Math.round(Math.pow(r, b) * 10000) / 10000;
  const bwQm = brw > 0 ? Math.round(brw * faktor * 100) / 100 : null;
  return {
    verfuegbar: true, amtlich: false, naeherung: true, stufe: N.stufe || 'N',
    wgfz_zone: wz, wgfz_objekt: wo, uk_zone: 1, uk_objekt: faktor, faktor, begrenzt: false,
    bodenwert_eur_qm: bwQm, weg: 'DealPilot-Formel (WGFZ)', exponent: b,
    quelle: { ausschuss: null, quelle_url: null, seite: null, jahrgang: N.stand || null, lizenz: null,
      quellenvermerk: 'abgeleitet aus der DealPilot-Formel (' + (kl.tabellen || '?') + ' amtliche Tabellen aus ' + ((kl.laender || []).length) + ' Ländern)' },
    hinweis: 'Umrechnung nach der wertrelevanten Geschossflächenzahl (§ 16 Abs. 4, § 40 ImmoWertV), abgeleitet aus der '
      + 'DealPilot-Formel — der Gutachterausschuss veröffentlicht hier keine eigenen Umrechnungskoeffizienten: '
      + '(' + de(wo) + ' / ' + de(wz) + ')^' + de(b) + ' = ' + de(faktor)
      + (bwQm != null ? ' → ' + de(brw) + ' €/m² × ' + de(faktor) + ' = ' + de(bwQm) + ' €/m²' : '')
      + '. Die Formel ist aus ' + (kl.tabellen || '?') + ' amtlichen Tabellen abgeleitet ('
      /* v2593 · Kreuzvalidierung (pruefung.loto) statt Abweichung in der Stichprobe */
      + (kl.pruefung && kl.pruefung.loto && Number.isFinite(Number(kl.pruefung.loto.p80_pct))
        ? 'nachgeprüft an amtlichen Tabellen in der Hälfte der Fälle höchstens '
          + de(Math.round(Number(kl.pruefung.loto.median_pct) * 10) / 10) + ' % daneben, in 8 von 10 Fällen höchstens '
          + de(Math.round(Number(kl.pruefung.loto.p80_pct))) + ' %'
        : 'typische Abweichung ' + de(Math.round(Number(kl.abweichung_median_pct) * 10) / 10) + ' %')
      + '); sie ist nicht amtlich, der Bodenwert insoweit vorläufig.',
  };
}

/* ══ v3293 · DIE WGFZ DES OBJEKTS ABLEITEN (Stufe N) ═════════════════════════
   Marcel 11.11.2026: „Wir haben oft ‚WGFZ fehlt'. Können wir das ändern?"
   Massstab ist § 16 Abs. 4 ImmoWertV (Wortlaut gesetze-im-internet.de,
   immowertv_2022/__16.html): Flaechen ALLER oberirdischen Geschosse nach den
   Aussenmassen, ausgebaute oder ausbaufaehige Dachgeschosse zu 75 Prozent,
   Kellergeschosse (Deckenoberkante im Mittel <= 1,40 m ueber Gelaende) und nicht
   ausbaufaehige Dachgeschosse nicht, Staffelgeschosse voll.
   Rangfolge:
     a) eingetragene WGFZ (eigene Angabe) - hier nicht, das macht der Aufrufer;
     b) Haus mit Gebaeudeart NHK 2010 (Hausform.Geschosse Dach) und BGF:
        die BGF zaehlt jede Ebene voll (ImmoWertA IV.(I).4: auch das nicht
        ausgebaute Dachgeschoss), die Ebenen sind gleich gross angenommen
        (wie im Beispiel ImmoWertA IV.(I).5: „BGF: 4 Ebenen x 36,3 m²").
          Grundflaeche = BGF / Ebenen
          Geschossflaeche = Grundflaeche x (Vollgeschosse + 0,75 bei Steildach)
        Fehlt die BGF, kommt sie aus der Wohnflaeche ueber den Faktor der
        SW-RL-Anlage 1 (nhk2010.bgf, dieselbe Naeherung wie im Sachwert).
        Ein nicht ausgebautes Dachgeschoss (x.y2) gilt als ausbaufaehig; ist es
        das nicht, entfaellt es - die Spanne nennt dann den kleineren Wert.
     c) Mehrfamilienhaus, Wohn- und Geschaeftshaus, Gewerbe: Wohn-/Nutzflaeche
        geteilt durch einen Divisor - die Naeherungsformel der Ausschuesse:
          Bremen (Umrechnungstabelle 100012, Stichtage 31.12.2020/01.01.2022):
            „Gesamtwohnfläche dividiert durch 0,8 … dividiert durch die
             Grundstücksgröße = ca. WGFZ" (Beispiel 800 : 0,8 : 1.600 = 0,63)
          Muenster (Grundstücksmarktbericht 2025, Abschn. WGFZ, S. 31):
            „durch Rückrechnung mit einem Divisor von 0,75 aus der Wohn- /
             Nutzungsfläche" (Beispiel 1.200 : 1.000 : 0,75 = 1,6)
        Im eigenen Bezirk gilt der eigene Divisor (Muenster 0,75, Bremen 0,8),
        sonst 0,8 mit der Spanne bis 0,75.
   Eigentumswohnung: nur mit Angaben zum GANZEN Gebaeude - die gibt es im
   Formular nicht (Wohnflaeche und MEA sind die der Wohnung), also weiter
   „fehlt". Bremen rechnet die ETW ueber den MEA (Wohnflaeche : 0,8 : (MEA x
   Grundstueck)); das setzt voraus, dass der MEA dem Wohnflaechenanteil folgt
   - bewusst NICHT uebernommen (Marcel 11.11.: ETW nur mit Gesamtgebaeude).
   Ergebnis IMMER: nicht amtlich, „DealPilot-Ableitung, Stufe N", eigene
   Angabe genauer. Keine Extrapolation: was ausserhalb der Tabelle liegt,
   faengt wgfzAnpassung ab wie bei einer eingetragenen WGFZ. */
const DG_ANTEIL = 0.75;
const DIVISOR_STANDARD = 0.8;
const DIVISOR_QUELLEN = {
  bremen: { divisor: 0.8, ausschuss: 'Gutachterausschusses für Grundstückswerte in Bremen',
    fundstelle: 'Umrechnungstabelle 100012 (WGFZ), Stichtage 31.12.2020 und 01.01.2022, „Überschlägige Ermittlung der WGFZ (Näherung)"',
    url: 'https://immobilienmarkt.niedersachsen.de/boris-umdatei/umretabs/2022/1000012wgfz2022.pdf' },
  muenster: { divisor: 0.75, ausschuss: 'Gutachterausschusses für Grundstückswerte in der Stadt Münster',
    fundstelle: 'Grundstücksmarktbericht 2025, Abschnitt „Wertrelevante Geschossflächenzahl (WGFZ)", S. 31',
    url: 'https://epflicht.ulb.uni-muenster.de/download/pdf/1041650' },
};
/* AGS-Anfang -> eigener Divisor des Ausschusses (Stadt Muenster 05515000, Stadtgemeinde Bremen 04011000) */
const DIVISOR_JE_AGS = [['05515', 'muenster'], ['04011', 'bremen']];

export function wgfzAbleitung({ objektart, plot_area, bgf, living_area, nhk_typ, ags } = {}) {
  const nein = (grund, hinweis) => ({ verfuegbar: false, grund, hinweis: hinweis || null });
  const r2x = (x) => Math.round(x * 100) / 100;
  /* deutsche Zahlen im Kundentext: Flaechen mit Tausenderpunkt, WGFZ immer zwei Stellen */
  const qm = (x) => Number(x).toLocaleString('de-DE', { maximumFractionDigits: 2 });
  const zf = (x) => Number(x).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const art = artSchluessel(objektart);
  const g = Number(plot_area), b = Number(bgf), w = Number(living_area);
  if (art === 'etw') return nein('etw_ohne_gesamtgebaeude', 'Bei einer Eigentumswohnung lässt sich die WGFZ nur aus den Flächen '
    + 'des ganzen Gebäudes ableiten; erfasst sind Wohnfläche und Miteigentumsanteil der Wohnung. Trag die WGFZ ein.');
  if (!(g > 0)) return nein('grundstueck_fehlt', 'Für eine Ableitung der WGFZ fehlt die Grundstücksfläche.');
  const kennung = (aus) => 'WGFZ abgeleitet aus ' + aus + ' (DealPilot-Ableitung, Stufe N), eigene Angabe genauer';
  const ergebnis = (wgfz, weg, aus, rechnung, extra) => {
    const wr = r2x(wgfz);
    if (!(wr >= 0.05 && wr <= 8)) return nein('unplausibel', 'Die abgeleitete WGFZ (' + zf(wr) + ') ist nicht plausibel - bitte die WGFZ eintragen.');
    return { verfuegbar: true, amtlich: false, stufe: 'N', wgfz: wr, weg, kennung: kennung(aus),
      hinweis: kennung(aus) + ': ' + rechnung + '. Nicht amtlich; die eingetragene WGFZ des Objekts (§ 16 Abs. 4 ImmoWertV) ersetzt sie.',
      ...(extra || {}) };
  };
  const haus = ['efh', 'zfh', 'dhh', 'rh'].indexOf(art) >= 0 || /^haus$/i.test(String(objektart || ''));
  const mh = String(nhk_typ || '').trim().match(/^([123])\.([0-3])([1-3])$/);
  if (haus || (mh && art !== 'mfh')) {
    if (!mh) return nein('gebaeudeart_fehlt', 'Für eine Ableitung der WGFZ beim Haus fehlt die Gebäudeart nach NHK 2010 '
      + '(Hausform, Geschosse, Dach im Reiter Objekt) - oder trag die WGFZ ein.');
    const gs = Number(mh[2]), dach = Number(mh[3]);
    const keller = gs === 0 || gs === 1 ? 1 : 0, voll = gs === 1 || gs === 3 ? 2 : 1, steil = dach === 1 || dach === 2 ? 1 : 0;
    const ebenen = keller + voll + steil;
    let bq = b > 0 ? b : null, aus = 'der Bruttogrundfläche', weg = 'bgf', bgfText = '';
    if (!bq) {
      const n = nhkBgf({ wohnflaeche_qm: w, nhk_typ: mh[0] });
      if (!(n && n.wert > 0 && n.faktor)) return nein('flaechen_fehlen', 'Für eine Ableitung der WGFZ fehlen Bruttogrundfläche und Wohnfläche.');
      bq = n.wert; aus = 'der Wohnfläche über die Bruttogrundfläche'; weg = 'bgf_aus_wohnflaeche';
      bgfText = qm(w) + ' m² Wohnfläche × ' + de(n.faktor) + ' (BGF/Wohnfläche Typ ' + mh[0] + ', SW-RL Anl. 1) = ';
    }
    const grund = bq / ebenen, gf = grund * (voll + steil * DG_ANTEIL);
    const ohneDg = dach === 2 ? r2x(grund * voll / g) : null;
    return ergebnis(gf / g, weg, aus,
      bgfText + qm(Math.round(bq * 100) / 100) + ' m² BGF : ' + ebenen + ' Ebenen (Typ ' + mh[0] + ') × ('
        + voll + ' Vollgeschoss' + (voll > 1 ? 'e' : '') + (steil ? ' + 0,75 Dachgeschoss' : '') + ') = '
        + qm(Math.round(gf * 10) / 10) + ' m² Geschossfläche : ' + qm(g) + ' m² Grundstück = ' + zf(r2x(gf / g))
        + (keller ? '; Keller nicht angerechnet' : '')
        + (ohneDg != null ? '; das nicht ausgebaute Dachgeschoss ist als ausbaufähig angesetzt, sonst WGFZ ' + zf(ohneDg) : ''),
      { geschossflaeche_qm: Math.round(gf * 10) / 10, spanne: ohneDg != null ? [ohneDg, r2x(gf / g)] : null });
  }
  if (art === 'mfh' || art === 'gewerbe' || /gemischt|gesch|wgh/i.test(String(objektart || ''))) {
    if (!(w > 0)) return nein('wohnflaeche_fehlt', 'Für eine Ableitung der WGFZ beim Mehrfamilienhaus fehlt die Wohn-/Nutzfläche des Gebäudes'
      + (b > 0 ? ' (aus der Bruttogrundfläche allein geht es nicht: Keller und Dachgeschoss sind nicht erfasst)' : '') + '.');
    const a = String(ags || '').replace(/\D/g, '');
    const eigen = (DIVISOR_JE_AGS.find(([p]) => a.startsWith(p)) || [])[1];
    const q = DIVISOR_QUELLEN[eigen || 'bremen'];
    const d = eigen ? q.divisor : DIVISOR_STANDARD;
    const gf = w / d, wgfz = gf / g;
    const alt = eigen ? null : r2x(w / DIVISOR_QUELLEN.muenster.divisor / g);
    return ergebnis(wgfz, 'wohnflaeche', 'der Wohnfläche',
      qm(w) + ' m² Wohn-/Nutzfläche : ' + de(d) + ' = ' + qm(Math.round(gf * 10) / 10) + ' m² Geschossfläche : ' + qm(g)
        + ' m² Grundstück = ' + zf(r2x(wgfz)) + '; Divisor ' + de(d) + ' nach der Näherungsformel des ' + q.ausschuss
        + ' (' + q.fundstelle + ')' + (eigen ? ', hier der zuständige Ausschuss' : ', Münster rechnet mit 0,75 (WGFZ dann ' + zf(alt) + ')'),
      { geschossflaeche_qm: Math.round(gf * 10) / 10, divisor: d, quelle_url: q.url, spanne: alt != null ? [r2x(wgfz), alt] : null });
  }
  return nein('objektart', 'Für diese Objektart gibt es keine belegte Ableitung der WGFZ - trag sie ein.');
}

/* Pruefung gegen das amtliche Anwendungsbeispiel. */
export function pruefeBeispiel(s) {
  const b = s && s.anwendungsbeispiel;
  if (!b) return null;
  const r = wgfzAnpassung({ ags: s.ags, objektart: ((s.geltungsbereich || {}).objektarten || [])[0] || null,
    brw_eur_qm: b.brw_eur_qm != null ? b.brw_eur_qm : 100, wgfz_zone: b.wgfz_norm, wgfz_objekt: b.wgfz_objekt, saetze: [s] });
  if (!r.verfuegbar) return { ok: false, grund: r.grund };
  /* v2363 · Tabellenwert-Beispiele (kein Rechenbeispiel im Dokument): Faktor gegen uk_soll */
  if (b.uk_soll != null) return { ok: Math.abs(r.faktor - Number(b.uk_soll)) <= Number(b.toleranz ?? 0.006), ist: r.faktor, soll: b.uk_soll };
  const tol = Number(b.toleranz ?? 1);
  return { ok: Math.abs(r.bodenwert_eur_qm - Number(b.ergebnis_eur_qm)) <= Math.max(tol, 1), ist: r.bodenwert_eur_qm, soll: b.ergebnis_eur_qm };
}

export default { KENNZAHL, koeffizientFuer, satzFuer, wgfzAnpassung, wgfzNaeherung, wgfzAbleitung, pruefeBeispiel };
