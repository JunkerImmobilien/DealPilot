/* ═══════════════════════════════════════════════════════════════════════
   lib/mietspiegel/naeherung.js · v3266 — DealPilot-Näherung der ortsüblichen
   Vergleichsmiete (Stufe N, nie amtlich)

   WOZU. Viele Mietspiegel verbieten, ihre Werte zu speichern („Speicherung in
   elektronische Systeme nur mit Genehmigung“), andere stehen unter
   Rechtevorbehalt (Wertedatei freigabe: 'gesperrt'), viele Gemeinden haben gar
   keinen. Marcel 09.11.2026: KEINE Formel, die diese Tabellen nachbildet.
   Stattdessen eine Näherung aus einer Größe, die DealPilot für JEDE Gemeinde
   hat — der Zensus-2022-Bestandsmiete der Gemeinde (mb.zensus_werte, nach
   Baujahr und Wohnungsgröße) —, kalibriert NUR an den FREIEN Wertedateien.

   WIE. Mittelwert ≈ Faktor × Zensus(Baujahresklasse) × Zensus(Größenklasse) /
   Zensus(gesamt). Den Faktor (und welche Form gilt) leitet
   tools/mietspiegel-naeherung-ableiten.mjs ab, mit Leave-one-Stadt-out-Güte,
   und schreibt ihn nach naeherung.json. Fehlt eine Klasse (kleine Gemeinde,
   Zensus-Geheimhaltung), steht dort die Gemeindemiete aller Wohnungen — mit
   Hinweis. Ohne Zensuswert der Gemeinde: kein Wert (nie Kreis, nie Land).

   Doktrin wie die LZS-Formel (lib/lzs_naeherung.js): im Bericht immer
   „DealPilot-Näherung“, nie amtlich, nie der Mietspiegel; gilt nur, wo
   keine verwendbaren Mietspiegel-Werte vorliegen (die Route entscheidet,
   routes/api.js GET /mietspiegel) und nie gegen eine eigene Eingabe
   (frontend/js/potenzial.js objektVgl()).

   Kern ohne Einstellung, Uhr, Datei oder Datenbank: Parameter, Zensuszeilen
   und Objekt kommen herein. Laden (naeherungParameter) ist davon getrennt.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const NAEHERUNG_DATEI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'naeherung.json');
export const ZENSUS_LIZENZ = '© Statistische Ämter des Bundes und der Länder, Zensus 2022, Datenlizenz Deutschland – Namensnennung – 2.0';

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function runden(x, n) { const f = Math.pow(10, n); return Math.round(x * f + 1e-9) / f; }
/** v5110a · Kundentext ohne Gedankenstrich: Zensus-Klasse „1960 - 1969“ → „1960 bis 1969“ */
function klTxt(k) { return String(k == null ? '' : k).replace(/\s*[-–]\s*/g, ' bis '); }
function dez(x, n) { return x == null ? '–' : x.toFixed(n == null ? 2 : n).replace('.', ','); }

/** Klasse aus der Zensus-Ausprägung: 'BAU1970B1979' → { von 1970, bis 1979 }, 'BAU2016BXXXX' → bis offen,
    'WFL060B079' → 60 bis 79,999 m² (Zensus zählt ganze m²). */
export function zensusKlasse(auspraegung) {
  const m = /^(BAU|WFL)(\d+)B(\d+|X+)$/.exec(String(auspraegung || ''));
  if (!m) return null;
  const von = Number(m[2]), bis = /^X+$/.test(m[3]) ? null : Number(m[3]);
  return { art: m[1] === 'BAU' ? 'baujahr' : 'flaeche', von, bis: bis === null ? null : (m[1] === 'WFL' ? bis + 0.999 : bis) };
}

/**
 * Zeilen aus mb.zensus_werte (ebene 'gemeinde', kennzahl 'nettokaltmiete_qm') → Block der Gemeinde für das Objekt.
 * zeilen: [{ dimension: 'gesamt'|'baujahr'|'flaeche', auspraegung, auspraegung_text, wert, gebiet_name }]
 * → { name, gesamt, baujahr: { klasse, wert } | null, flaeche: { klasse, wert } | null }
 */
export function zensusBlock(zeilen, baujahr, wfl) {
  const z = Array.isArray(zeilen) ? zeilen : [];
  const g = z.find((r) => r && r.dimension === 'gesamt');
  const bj = num(baujahr), fl = num(wfl);
  const finde = (dim, x) => {
    if (x === null) return null;
    const r = z.find((r) => {
      if (!r || r.dimension !== dim) return false;
      const k = zensusKlasse(r.auspraegung);
      return k && x >= k.von && (k.bis === null || x <= k.bis);
    });
    return r && num(r.wert) > 0 ? { klasse: r.auspraegung_text || r.auspraegung, wert: num(r.wert) } : null;
  };
  return {
    name: (g && g.gebiet_name) || (z[0] && z[0].gebiet_name) || null,
    gesamt: g && num(g.wert) > 0 ? num(g.wert) : null,
    baujahr: finde('baujahr', bj !== null && bj > 1000 ? Math.round(bj) : null),
    flaeche: finde('flaeche', fl !== null && fl > 0 ? fl : null)
  };
}

/** v5110 · amtliche Marktmiete (Gutachterausschuss) für eine Gemeinde: zuerst der Gemeindewert, sonst der Kreis.
    mm: Inhalt von marktmiete-amtlich.json → { qm, ebene: 'gemeinde'|'kreis', jahr, n } | null */
export function marktmieteFuer(mm, ags) {
  const a = String(ags == null ? '' : ags);
  if (!mm || a.length < 5) return null;
  const g = mm.gemeinde && mm.gemeinde[a];
  if (g && num(g.qm) > 0) return { qm: num(g.qm), ebene: 'gemeinde', jahr: g.jahr || null, n: g.n || null };
  const k = mm.kreis && mm.kreis[a.slice(0, 5)];
  if (k && num(k.qm) > 0) return { qm: num(k.qm), ebene: 'kreis', jahr: k.jahr || null, n: k.n || null };
  return null;
}

/** Faktor des Modells; marktlage ('angespannt'|'mittel'|'entspannt') nur, wenn das Modell ihn je Marktlage führt */
function faktorFuer(param, marktlage) {
  const je = param.faktoren_marktlage;
  if (je && typeof je === 'object') {
    const f = num(je[marktlage]);
    if (f !== null) return { f, je: marktlage };
    return { f: num(param.faktor), je: null };
  }
  return { f: num(param.faktor), je: null };
}

/** Genauigkeit für eine Gemeinde (v5080, Marcel 26.11.2026 „die genaue Abweichung … immer kurz und knapp“):
    eigener Wert der Stadt aus dem Leave-one-Stadt-out (guete_stadt, nur eine Prozentzahl), sonst der Region, sonst
    gesamt. → { pct, ebene: 'stadt' | 'region' | 'gesamt' } */
export const REGION_JE_LAND = { '01': 'Nord', '02': 'Nord', '03': 'Nord', '04': 'Nord', '13': 'Nord', '05': 'West', '06': 'Mitte', '07': 'Mitte',
  '10': 'Mitte', '08': 'Süd', '09': 'Süd', '11': 'Ost', '12': 'Ost', '14': 'Ost', '15': 'Ost', '16': 'Ost' };
export function genauigkeit(param, ags) {
  const p = param || {}, a = String(ags == null ? '' : ags);
  const st = p.guete_stadt && p.guete_stadt[a];
  if (num(st) > 0) return { pct: num(st), ebene: 'stadt' };
  const r = REGION_JE_LAND[a.slice(0, 2)], gr = r && p.guete_region && p.guete_region[r];
  if (gr && num(gr.mape_pct) > 0 && (num(gr.staedte) || 0) >= 5) return { pct: num(gr.mape_pct), ebene: 'region', region: r };
  return { pct: num((p.guete || {}).mape_pct), ebene: 'gesamt' };
}
/** Kundentext (v5080, Marcel 26.11.2026): sichtbar nur „DealPilot-Näherung“. Die Genauigkeit steht im Tooltip (ⓘ) bzw. im PDF
    klein auf der Rechenweg- oder Quellenseite: genauigkeitText(). Die Herleitung in textDetail. */
export function naeherungText() { return 'DealPilot-Näherung'; }
export function genauigkeitText(param, ags) {
  const g = genauigkeit(param, ags);
  return num(g.pct) > 0 ? 'im Mittel ±' + dez(g.pct, 1) + ' % zum Mietspiegel' + (g.ebene === 'stadt' ? ' der Stadt' : '') : null;
}
export function naeherungTextDetail(param, ags) {
  const p = param || {}, g = genauigkeit(param, ags);
  return 'Aus der Zensus-Bestandsmiete der Gemeinde nach Baujahr und Wohnungsgröße, kalibriert an ' + (p.n_staedte || '–')
    + ' Mietspiegeln' + (p.marktmiete ? ', wo vorhanden mit der amtlichen Marktmiete der Gemeinde oder des Kreises' : '') + '. Gemessene mittlere Abweichung ' + dez(g.pct, 1) + ' %'
    + (g.ebene === 'stadt' ? ' zum Mietspiegel dieser Stadt' : g.ebene === 'region' ? ' in der Region ' + g.region : '')
    + ', jeweils ohne den eigenen Mietspiegel gerechnet. Kein Mietspiegel und nicht amtlich. Für ein Erhöhungsverlangen mit dem Mietspiegel, drei Vergleichswohnungen oder einem Gutachten belegen.';
}

/**
 * Näherung für ein Objekt.
 * param:  Inhalt von naeherung.json
 * zeilen: Zensuszeilen der Gemeinde (siehe zensusBlock)
 * objekt: { baujahr, wfl, marktlage? }
 * → { qm, quelle_art: 'dealpilot_naeherung', text, rechnung, hinweise[], faktor, basis, zensus{...}, n_staedte, mape_pct, stand, lizenz }
 *   ohne Wert: qm null und der Grund in hinweise.
 */
export function naeherungFuer(param, zeilen, objekt) {
  const p = param || {}, o = objekt || {};
  const hinweise = [];
  const leer = (h) => ({ qm: null, quelle_art: 'dealpilot_naeherung', hinweise: hinweise.concat(h), stand: p.stand || null });
  if (!p.modell || !(num(p.faktor) > 0)) return leer('DealPilot-Näherung nicht kalibriert');
  const b = zensusBlock(zeilen, o.baujahr, o.wfl);
  if (!(b.gesamt > 0)) return leer('keine Zensus-Bestandsmiete für die Gemeinde, keine Näherung');
  const ff = faktorFuer(p, o.marktlage);
  if (!(ff.f > 0)) return leer('DealPilot-Näherung ohne Faktor');
  let basis = b.gesamt;
  const teile = ['Zensus 2022 Bestandsmiete der Gemeinde ' + dez(b.gesamt) + ' €/m²'];
  if (p.modell === 'klassen_faktor') {
    const bj = b.baujahr ? b.baujahr.wert : b.gesamt, fl = b.flaeche ? b.flaeche.wert : b.gesamt;
    if (b.baujahr) teile.push('Baujahr ' + klTxt(b.baujahr.klasse) + ': ' + dez(b.baujahr.wert));
    else hinweise.push(num(o.baujahr) > 1000 ? 'Zensus führt für die Baujahresklasse keinen Wert, Miete aller Baujahre' : 'Baujahr fehlt, Zensus-Miete aller Baujahre');
    if (b.flaeche) teile.push(klTxt(b.flaeche.klasse) + ': ' + dez(b.flaeche.wert));
    else hinweise.push(num(o.wfl) > 0 ? 'Zensus führt für die Größenklasse keinen Wert, Miete aller Größen' : 'Wohnfläche fehlt, Zensus-Miete aller Größen');
    basis = bj * fl / b.gesamt;
  } else if (p.modell !== 'gesamt_faktor') return leer('Modell ' + p.modell + ' unbekannt');
  let qm = runden(basis * ff.f, 2);
  let rechnung = teile.join(' · ') + (p.modell === 'klassen_faktor' ? ' → ' + dez(basis) + ' €/m²' : '')
    + ' × Kalibrierfaktor ' + dez(ff.f, 3) + (ff.je ? ' (Marktlage ' + ff.je + ')' : '') + ' = ' + dez(qm) + ' €/m²';
  /* v5110 · amtliche Marktmiete als örtliches Niveau (Gewicht je Ebene aus dem Leave-one-Stadt-out, naeherung.json marktmiete) */
  const pm = p.marktmiete, mmo = o.marktmiete;
  let mmTeil = null;
  if (pm && mmo && num(mmo.qm) > 0 && b.gesamt > 0) {
    const a = mmo.ebene === 'gemeinde' ? num(pm.gewicht_gemeinde) : num(pm.gewicht_kreis);
    if (a > 0 && num(pm.g) > 0) {
      const strukt = (p.modell === 'klassen_faktor' ? basis : b.gesamt) / b.gesamt;
      const ausMm = strukt * mmo.qm * num(pm.g);
      const neu = runden((1 - a) * qm + a * ausMm, 2);
      rechnung += ' · amtliche Marktmiete ' + (mmo.ebene === 'gemeinde' ? 'der Gemeinde' : 'des Kreises') + ' ' + dez(mmo.qm) + ' €/m² zu '
        + Math.round(a * 100) + ' % eingerechnet = ' + dez(neu) + ' €/m²';
      mmTeil = { qm: mmo.qm, ebene: mmo.ebene, jahr: mmo.jahr || null, gewicht: a, aus_marktmiete: runden(ausMm, 2) };
      qm = neu;
    }
  }
  /* MM6 · Modernisierung (Anlage-2-Punkte, Feld mod_punkte): gemessener Zuschlag der freien Mietspiegel je Stufe (naeherung.json
     modernisierung, tools/mietspiegel-naeherung-ableiten.mjs). Nur mit Angabe, ohne Punkte bleibt alles wie bisher. */
  let modTeil = null;
  const mpkt = num(o.mod_punkte), ms = (p.modernisierung && Array.isArray(p.modernisierung.stufen)) ? p.modernisierung.stufen : [];
  if (mpkt != null && mpkt > 0 && ms.length) {
    const st = ms.filter((x) => num(x.ab_punkte) != null && mpkt >= num(x.ab_punkte) && num(x.pct) > 0)
      .sort((x, y) => num(y.ab_punkte) - num(x.ab_punkte))[0];
    if (st) {
      const neu = runden(qm * (1 + num(st.pct) / 100), 2);
      rechnung += ' · modernisiert (' + String(mpkt).replace('.', ',') + ' Punkte nach Anlage 2 ImmoWertV, ' + st.name + ') + '
        + String(st.pct).replace('.', ',') + ' % = ' + dez(neu) + ' €/m²';
      modTeil = { punkte: mpkt, pct: num(st.pct), ab_punkte: num(st.ab_punkte), stufe: st.name };
      qm = neu;
    }
  }
  /* v5110 · Spanne wie beim Mietspiegel (Marcel 26.11.2026 „nicht zu niedrig"): die App rechnet mit dem OBEREN Wert (potenzial.js msWahl) */
  const sp = p.spanne || {};
  const oben = num(sp.oben) > 1 ? runden(qm * num(sp.oben), 2) : null;
  const unten = num(sp.unten) > 0 && num(sp.unten) < 1 ? runden(qm * num(sp.unten), 2) : null;
  return {
    qm, oben, unten, marktmiete: mmTeil, modernisierung: modTeil, quelle_art: 'dealpilot_naeherung', text: naeherungText(), genauigkeit_text: genauigkeitText(p, o.ags), text_detail: naeherungTextDetail(p, o.ags), rechnung, hinweise,
    faktor: ff.f, basis: runden(basis, 2), marktlage: ff.je,
    zensus: { gemeinde: b.name, gesamt: b.gesamt, baujahr: b.baujahr, flaeche: b.flaeche, stichtag: '2022-05-15' },
    n_staedte: p.n_staedte || null, mape_pct: genauigkeit(p, o.ags).pct || null, genauigkeit_ebene: genauigkeit(p, o.ags).ebene, stand: p.stand || null,
    lizenz: ZENSUS_LIZENZ
  };
}

export const MARKTMIETE_DATEI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'marktmiete-amtlich.json');
let _mmCache = null;
export function marktmieteParameter(datei = MARKTMIETE_DATEI) {
  if (_mmCache && _mmCache.datei === datei) return _mmCache.mm;
  let mm = null;
  try { mm = JSON.parse(fs.readFileSync(datei, 'utf8')); } catch (e) { mm = null; }
  _mmCache = { datei, mm };
  return mm;
}

/* ── Laden ─────────────────────────────────────────────────────────────── */
let _cache = null;
export function naeherungParameter(datei = NAEHERUNG_DATEI) {
  if (_cache && _cache.datei === datei) return _cache.param;
  let param = null;
  try { param = JSON.parse(fs.readFileSync(datei, 'utf8')); } catch (e) { param = null; }
  _cache = { datei, param };
  return param;
}

/**
 * Route GET /mietspiegel: Näherung NUR, wenn keine verwendbaren Mietspiegel-Werte vorliegen
 * (keine Wertedatei, Datei gesperrt und nicht ausgeliefert, Speicherverbot, kein/unklarer Mietspiegel).
 * Liegt eine freie Wertedatei vor, nie — auch nicht außerhalb ihrer Tabelle („Wo die Quelle endet, endet die Rechnung“).
 * Setzt satz.naeherung_verfuegbar immer; mit baujahr oder wfl und Zensuszeilen zusätzlich satz.naeherung.
 * holeZeilen: async (ags) → Zensuszeilen (die Route liest mb.zensus_werte; der Prüfer reicht sie herein).
 */
export async function mietspiegelMitNaeherung(satz, q, holeZeilen, param) {
  if (!satz) return satz;
  const p = param === undefined ? naeherungParameter() : param;
  satz.naeherung_verfuegbar = !satz.werte_verfuegbar && !!(p && p.modell);
  q = q || {};
  if (!satz.naeherung_verfuegbar || !(q.baujahr || q.wfl) || typeof holeZeilen !== 'function') return satz;
  let zeilen = null;
  try { zeilen = await holeZeilen(satz.ags); } catch (e) { zeilen = null; }
  satz.naeherung = naeherungFuer(p, zeilen, { baujahr: q.baujahr, wfl: q.wfl, marktlage: q.marktlage || null, ags: satz.ags, mod_punkte: q.mod_punkte,   /* MM6 */
    marktmiete: marktmieteFuer(marktmieteParameter(), satz.ags) });   /* v5110 */
  return satz;
}
