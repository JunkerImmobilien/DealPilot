/* ═══════════════════════════════════════════════════════════════════════
   lib/mietspiegel/werte.js · v3255 — Mietspiegel-WERTE rechnen (Phase 2)

   Eine Datei je Gemeinde unter werte/<ags>.json (Aufbau: README.md,
   Abschnitt „Werte“). mietspiegelWerteFuer(werte, objekt) ist die EINZIGE
   Rechenstelle: kein Einstellungszugriff, keine Uhr, keine Datei — alles kommt
   als Parameter. Laden (werteFuer) ist davon getrennt.

   Doktrin: „Wo die Quelle endet, endet die Rechnung.“ Liegt das Objekt
   außerhalb der Tabelle (Baujahr, Wohnfläche, leeres Feld) oder fehlt eine
   Pflichtangabe ohne Standard im Dokument, kommt null mit Hinweis — nie ein
   Nachbarfeld, nie eine Verlängerung der Kurve.

   Route: GET /mietspiegel?ags=&baujahr=&wfl=&lage=&ausstattung= (routes/api.js).
   Prüfer: tools/mietspiegel-werte-pruefen.mjs (jedes Prüfbeispiel ± 0,01).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WERTE_ORDNER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'werte');

/* ── kleine Helfer ─────────────────────────────────────────────────────── */
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
/** kaufmännisch runden auf n Stellen (auch negative Zahlen symmetrisch) */
export function runden(x, n) {
  if (x === null || !Number.isFinite(x)) return null;
  const f = Math.pow(10, n == null ? 2 : n);
  const s = x < 0 ? -1 : 1;
  return s * Math.round(Math.abs(x) * f + 1e-7) / f;
}
function eur(x) { return x == null ? '–' : x.toFixed(2).replace('.', ','); }
function zahlText(x, n) { return x == null ? '–' : x.toFixed(n).replace('.', ','); }
function norm(s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/[\s_-]+/g, ' '); }

/** liegt x in der Klasse? von/bis einschließlich, außer von_inkl/bis_inkl === false; null = offen */
export function inKlasse(k, x) {
  if (!k || x === null) return false;
  const von = num(k.von), bis = num(k.bis);
  if (von !== null && (k.von_inkl === false ? !(x > von) : !(x >= von))) return false;
  if (bis !== null && (k.bis_inkl === false ? !(x < bis) : !(x <= bis))) return false;
  return true;
}
/** Index der ERSTEN passenden Klasse oder -1 */
export function klasseFinden(liste, x) {
  if (!Array.isArray(liste)) return -1;
  for (let i = 0; i < liste.length; i++) if (inKlasse(liste[i], x)) return i;
  return -1;
}
function klasseText(k) {
  if (!k) return '';
  if (k.label) return k.label;
  const von = num(k.von), bis = num(k.bis);
  if (von !== null && bis !== null) return (k.von_inkl === false ? 'über ' : '') + von + ' bis ' + bis;
  if (bis !== null) return 'bis ' + bis;
  if (von !== null) return 'ab ' + von;
  return 'alle';
}

/**
 * Schlüssel einer Auswahl-Achse (Lage, Ausstattung) aus der Angabe am Objekt.
 * liste: [{ schluessel, label, standard, aliase[] }]. Ergebnis { index, eintrag, angenommen } oder null.
 */
function auswahlFinden(liste, angabe) {
  if (!Array.isArray(liste) || !liste.length) return null;
  const a = norm(angabe);
  if (a) {
    for (let i = 0; i < liste.length; i++) {
      const e = liste[i];
      const namen = [e.schluessel, e.label].concat(Array.isArray(e.aliase) ? e.aliase : []).map(norm);
      if (namen.includes(a)) return { index: i, eintrag: e, angenommen: false };
    }
    return { index: -1, eintrag: null, angenommen: false, unbekannt: true };
  }
  const s = liste.findIndex(e => e && e.standard === true);
  return s >= 0 ? { index: s, eintrag: liste[s], angenommen: true } : null;
}

function leer(hinweise, extra) {
  return Object.assign({ unten: null, mittel: null, oben: null, zelle: null, rechnung: null, hinweise }, extra || {});
}

/** Geltungsbereich { baujahr_von, baujahr_bis, wfl_von, wfl_bis } - Hinweis oder null */
function geltungPruefen(g, bj, wfl) {
  if (!g) return null;
  const bv = num(g.baujahr_von), bb = num(g.baujahr_bis), wv = num(g.wfl_von), wb = num(g.wfl_bis);
  if (bj !== null && ((bv !== null && bj < bv) || (bb !== null && bj > bb)))
    return 'Baujahr ' + bj + ' liegt außerhalb des Mietspiegels (' + (bv !== null ? bv : '…') + '–' + (bb !== null ? bb : '…') + ') — dort endet die Rechnung';
  if (wfl !== null && ((wv !== null && wfl < wv) || (wb !== null && wfl > wb)))
    return 'Wohnfläche ' + zahlText(wfl, wfl % 1 ? 1 : 0) + ' m² liegt außerhalb des Mietspiegels (' + (wv !== null ? wv : '…') + '–' + (wb !== null ? wb : '…') + ' m²) — dort endet die Rechnung';
  return null;
}

/** Bedingung eines Zu-/Abschlags { baujahr_von, baujahr_bis } */
function bedingungErfuellt(b, bj) {
  if (!b) return true;
  const bv = num(b.baujahr_von), bb = num(b.baujahr_bis);
  if ((bv !== null || bb !== null) && bj === null) return false;
  if (bv !== null && bj < bv) return false;
  if (bb !== null && bj > bb) return false;
  return true;
}

function merkmalWahr(objekt, name) {
  const m = objekt && objekt.merkmale;
  if (!m || typeof m !== 'object') return false;
  const v = m[name];
  return v === true || v === 1 || v === 'ja' || v === 'true';
}

/** Spanne auf einen (gerundeten) Mittelwert: { unten_pct, oben_pct } | { unten_abs, oben_abs } | { baujahr_klassen: [...] } */
function spanneAnwenden(sp, mittel, bj, n, hinweise) {
  let s = sp;
  if (sp && Array.isArray(sp.baujahr_klassen)) {
    const i = klasseFinden(sp.baujahr_klassen, bj);
    if (i < 0) { hinweise.push('keine Spanne für Baujahr ' + bj + ' im Mietspiegel'); return { unten: null, oben: null, text: '' }; }
    s = sp.baujahr_klassen[i];
  }
  if (!s) return { unten: null, oben: null, text: '' };
  const up = num(s.unten_pct), op = num(s.oben_pct), ua = num(s.unten_abs), oa = num(s.oben_abs);
  if (up !== null || op !== null) {
    return { unten: up !== null ? runden(mittel * (1 + up / 100), n) : null, oben: op !== null ? runden(mittel * (1 + op / 100), n) : null,
      text: 'Spanne ' + zahlText(up, 0) + ' % / +' + zahlText(op, 0) + ' %' };
  }
  if (ua !== null || oa !== null) {
    return { unten: ua !== null ? runden(mittel + ua, n) : null, oben: oa !== null ? runden(mittel + oa, n) : null,
      text: 'Spanne ' + eur(ua) + ' / +' + eur(oa) + ' €/m²' };
  }
  return { unten: null, oben: null, text: '' };
}

/* ── Tabelle ───────────────────────────────────────────────────────────── */
function tabelleRechnen(w, objekt, bj, wfl, n, hinweise) {
  const T = w.tabelle || {}, A = T.achsen || {};
  const wr = num(T.wfl_runden);
  const wflT = wfl !== null && wr !== null ? runden(wfl, wr) : wfl;
  const g = geltungPruefen(T.geltung, bj, wflT);
  if (g) return leer(hinweise.concat(g));

  const wahl = {}; const teile = [];
  if (Array.isArray(A.baujahr) && A.baujahr.length) {
    if (bj === null) return leer(hinweise.concat('Baujahr fehlt — der Mietspiegel ordnet nach Baualtersklassen'));
    const i = klasseFinden(A.baujahr, bj);
    if (i < 0) return leer(hinweise.concat('Baujahr ' + bj + ' liegt außerhalb der Baualtersklassen des Mietspiegels — dort endet die Rechnung'));
    wahl.baujahr = i; teile.push('Baujahr ' + klasseText(A.baujahr[i]));
  }
  if (Array.isArray(A.wfl) && A.wfl.length) {
    if (wflT === null) return leer(hinweise.concat('Wohnfläche fehlt — der Mietspiegel ordnet nach Wohnungsgröße'));
    const i = klasseFinden(A.wfl, wflT);
    if (i < 0) return leer(hinweise.concat('Wohnfläche ' + zahlText(wfl, wfl % 1 ? 1 : 0) + ' m² liegt außerhalb der Größenklassen des Mietspiegels — dort endet die Rechnung'));
    wahl.wfl = i; teile.push(klasseText(A.wfl[i]) + (/m²/.test(klasseText(A.wfl[i])) ? '' : ' m²'));
  }
  for (const ax of ['lage', 'ausstattung']) {
    if (!Array.isArray(A[ax]) || !A[ax].length) continue;
    const name = ax === 'lage' ? 'Lage' : 'Ausstattung';
    const r = auswahlFinden(A[ax], objekt[ax]);
    if (!r) return leer(hinweise.concat(name + ' nicht angegeben — der Mietspiegel unterscheidet sie, ohne Angabe kein Wert'));
    if (r.unbekannt) return leer(hinweise.concat(name + ' „' + objekt[ax] + '“ kennt der Mietspiegel nicht (' + A[ax].map(e => e.label || e.schluessel).join(', ') + ')'));
    if (r.angenommen) hinweise.push(name + ' nicht angegeben — ' + (r.eintrag.label || r.eintrag.schluessel) + ' angenommen');
    wahl[ax] = r; teile.push(r.eintrag.label || r.eintrag.schluessel);
  }

  const passt = (z) => {
    if (wahl.baujahr !== undefined && z.baujahr !== undefined && z.baujahr !== null && num(z.baujahr) !== wahl.baujahr) return false;
    if (wahl.wfl !== undefined && z.wfl !== undefined && z.wfl !== null && num(z.wfl) !== wahl.wfl) return false;
    for (const ax of ['lage', 'ausstattung']) {
      if (!wahl[ax] || z[ax] === undefined || z[ax] === null) continue;
      if (typeof z[ax] === 'number' ? z[ax] !== wahl[ax].index : norm(z[ax]) !== norm(wahl[ax].eintrag.schluessel)) return false;
    }
    return true;
  };
  const zelle = (T.zellen || []).find(passt);
  const zelleText = teile.join(' · ');
  if (!zelle) return leer(hinweise.concat('Tabellenfeld ' + zelleText + ' ist im Mietspiegel leer (zu wenige Fälle) — kein Wert'), { zelle: zelleText });

  /* Zu-/Abschläge */
  let pct = 0, eurSumme = 0; const zs = [];
  const lageAngabe = norm(objekt.lage);
  let lageZuschlagDa = false;
  for (const z of (T.zuschlaege || [])) {
    if (!bedingungErfuellt(z.bedingung, bj)) continue;
    let wert = null;
    if (Array.isArray(z.wfl_klassen)) {
      const i = klasseFinden(z.wfl_klassen, wflT);
      if (i < 0) continue;
      wert = num(z.wfl_klassen[i].wert);
    } else if (/^lage:/.test(z.merkmal || '')) {
      lageZuschlagDa = true;
      const k = norm(z.merkmal.slice(5));
      const namen = [k].concat(Array.isArray(z.aliase) ? z.aliase.map(norm) : []);
      if (!lageAngabe || !namen.includes(lageAngabe)) continue;
      wert = num(z.wert);
    } else {
      if (!merkmalWahr(objekt, z.merkmal)) continue;
      wert = num(z.wert);
    }
    if (wert === null || wert === 0) continue;
    if (z.art === 'pct') pct += wert; else eurSumme += wert;
    zs.push((z.label || z.merkmal) + ' ' + (wert > 0 ? '+' : '') + (z.art === 'pct' ? zahlText(wert, 1) + ' %' : eur(wert) + ' €'));
  }
  if (lageZuschlagDa && !lageAngabe) hinweise.push('Lage (Ortsteil/Gebiet) nicht angegeben — ohne Lagezu- oder -abschlag gerechnet');
  const f = (v) => v === null || v === undefined ? null : runden(num(v) * (1 + pct / 100) + eurSumme, n);
  let unten, mittel, oben, spText = '';
  if (T.spanne) {
    mittel = f(zelle.mittel);
    if (mittel === null) return leer(hinweise.concat('Tabellenfeld ohne Mittelwert'), { zelle: zelleText });
    const sp = spanneAnwenden(T.spanne, mittel, bj, n, hinweise);
    unten = sp.unten; oben = sp.oben; spText = sp.text;
  } else {
    unten = f(zelle.unten); mittel = f(zelle.mittel); oben = f(zelle.oben);
  }
  const rechnung = 'Tabellenfeld ' + zelleText + ': ' + [zelle.unten, zelle.mittel, zelle.oben].filter(v => v != null).map(v => eur(num(v))).join(' / ') + ' €/m²'
    + (zs.length ? ' · Zu-/Abschläge: ' + zs.join(', ') : '') + (spText ? ' · ' + spText : '');
  return { unten, mittel, oben, zelle: zelleText, rechnung, hinweise, seite: zelle.seite || null };
}

/* ── Regression ────────────────────────────────────────────────────────── */
function regressionRechnen(w, objekt, bj, wfl, n, hinweise) {
  const R = w.regression || {};
  const wr = num(R.wfl_runden);
  const wflR = wfl !== null && wr !== null ? runden(wfl, wr) : wfl;
  const g = geltungPruefen(R.geltung, bj, wflR);
  if (g) return leer(hinweise.concat(g));

  /* Basis */
  let basis = null, basisText = '';
  const B = R.basis || null;
  const ersatz = B && Array.isArray(B.ersatz) ? B.ersatz.find(e => merkmalWahr(objekt, e.merkmal)) : null;
  if (ersatz) { basis = num(ersatz.eur_qm); basisText = 'Basis ' + eur(basis) + ' €/m² (' + (ersatz.label || ersatz.merkmal) + ')'; }
  else if (num(R.basis_eur_qm) !== null) { basis = num(R.basis_eur_qm); basisText = 'Basis ' + eur(basis) + ' €/m²'; }
  else if (B && Array.isArray(B.werte)) {
    if (wflR === null) return leer(hinweise.concat('Wohnfläche fehlt — die Basismiete hängt von der Wohnfläche ab'));
    const i = klasseFinden(B.werte, wflR);
    if (i < 0) return leer(hinweise.concat('Wohnfläche ' + zahlText(wfl, wfl % 1 ? 1 : 0) + ' m² liegt außerhalb der Basistabelle — dort endet die Rechnung'));
    basis = num(B.werte[i].eur_qm); basisText = 'Basis ' + eur(basis) + ' €/m² (' + zahlText(wflR, wflR % 1 ? 1 : 0) + ' m²)';
  }
  if (basis === null) return leer(hinweise.concat('Mietspiegel ohne Basismiete — nicht rechenbar'));

  let pct = 0, eurSumme = 0, prod = 1; const teile = [], jeRubrik = {};
  const rf = num(R.rundung_faktor);
  for (const f of (R.faktoren || [])) {
    if (!bedingungErfuellt(f.bedingung, bj)) continue;
    let wert = null, was = f.label || f.merkmal;
    if (f.typ === 'baujahr_klasse' || f.typ === 'wfl_kurve') {
      const x = f.typ === 'baujahr_klasse' ? bj : wflR;
      if (x === null) return leer(hinweise.concat((f.typ === 'baujahr_klasse' ? 'Baujahr' : 'Wohnfläche') + ' fehlt — der Mietspiegel braucht es für „' + was + '“'));
      const i = klasseFinden(f.werte, x);
      if (i < 0) return leer(hinweise.concat((f.typ === 'baujahr_klasse' ? 'Baujahr ' + x : 'Wohnfläche ' + x + ' m²') + ' liegt außerhalb der Klassen für „' + was + '“ — dort endet die Rechnung'));
      wert = num(f.werte[i].wert); was = was + ' ' + klasseText(f.werte[i]);
    } else if (f.typ === 'lage' || f.typ === 'auswahl') {
      const angabe = f.typ === 'lage' ? objekt.lage : (objekt.merkmale && objekt.merkmale[f.merkmal]);
      const W = f.werte || {};
      const schl = Object.keys(W);
      let k = null;
      if (angabe !== undefined && angabe !== null && angabe !== '' && angabe !== true) {
        const a = norm(angabe);
        k = schl.find(s => norm(s) === a) || null;
        if (!k && f.aliase) for (const s of schl) if ((f.aliase[s] || []).map(norm).includes(a)) { k = s; break; }
        if (!k) return leer(hinweise.concat((f.typ === 'lage' ? 'Lage' : was) + ' „' + angabe + '“ kennt der Mietspiegel nicht (' + schl.join(', ') + ')'));
      } else if (f.standard !== undefined && f.standard !== null) {
        k = f.standard;
        if (f.typ === 'lage') hinweise.push('Lage nicht angegeben — ' + (f.standard_label || k) + ' angenommen');
      } else if (f.typ === 'lage') {
        return leer(hinweise.concat('Lage nicht angegeben — der Mietspiegel unterscheidet sie, ohne Angabe kein Wert'));
      } else continue;
      wert = num(W[k]); was = was + ' ' + k;
    } else if (f.typ === 'flag') {
      if (!merkmalWahr(objekt, f.merkmal)) continue;
      wert = num(f.werte);
    } else if (f.typ === 'eingabe') {
      /* v3261 · Betrag, den der Nutzer selbst aus einem Verzeichnis des Mietspiegels abliest (Rostock: Wohnlage je
         Adresse in €/m²). merkmal 'lage' liest objekt.lage, sonst objekt.merkmale[merkmal]; Zahl mit Komma oder Punkt.
         Außerhalb von von/bis (Spannweite des Verzeichnisses) kein Wert; fehlt die Angabe und ist pflicht gesetzt, auch nicht. */
      const roh = f.merkmal === 'lage' ? objekt.lage : (objekt.merkmale && objekt.merkmale[f.merkmal]);
      const v = (roh === true || roh === false) ? null : num(roh);
      if (v === null) {
        if (f.pflicht) return leer(hinweise.concat((f.label || f.merkmal) + ' nicht angegeben — ' + (f.hinweis_fehlt || 'der Mietspiegel braucht den Betrag, ohne Angabe kein Wert')));
        continue;
      }
      const ev = num(f.von), eb = num(f.bis);
      if ((ev !== null && v < ev) || (eb !== null && v > eb))
        return leer(hinweise.concat((f.label || f.merkmal) + ' ' + zahlText(v, 2) + ' liegt außerhalb des Verzeichnisses (' + zahlText(ev, 2) + ' bis ' + zahlText(eb, 2) + ')'));
      wert = v;
    } else continue;
    if (wert === null) continue;
    if (f.art === 'faktor') { const rb = f.rubrik || f.merkmal; jeRubrik[rb] = (jeRubrik[rb] || 1) * wert; if (wert !== 1) teile.push(was + ' × ' + zahlText(wert, 3)); }
    else if (f.art === 'pct') { pct += wert; if (wert) teile.push(was + ' ' + (wert > 0 ? '+' : '') + zahlText(wert, 1) + ' %'); }
    else { eurSumme += wert; if (wert) teile.push(was + ' ' + (wert > 0 ? '+' : '') + eur(wert) + ' €'); }
  }
  /* Zwischenergebnis je Rubrik und Gesamtfaktor auf rundung_faktor Stellen (Leipzig: drei, S. 7 Fn. 9) */
  for (const rb of Object.keys(jeRubrik)) prod *= rf !== null ? runden(jeRubrik[rb], rf) : jeRubrik[rb];
  if (rf !== null) prod = runden(prod, rf);
  /* summe und produkt: Basis × Gesamtfaktor × (1 + Σ pct/100) + Σ €/m² — Faktoren (art faktor) multiplizieren, Prozente addieren */
  const mittelRoh = basis * prod * (1 + pct / 100) + eurSumme;
  const mittel = runden(mittelRoh, n);
  const sp = spanneAnwenden(R.spanne, mittel, bj, n, hinweise);
  const rechnung = basisText + (teile.length ? ' · ' + teile.join(', ') : '')
    + (prod !== 1 ? ' · Gesamtfaktor ' + zahlText(prod, 3) : '') + ' → Mittelwert ' + eur(mittel) + ' €/m²' + (sp.text ? ' · ' + sp.text : '');
  return { unten: sp.unten, mittel, oben: sp.oben, zelle: null, rechnung, hinweise };
}

/**
 * Mietspiegelwerte für ein Objekt (eine Wohnung).
 * werte:  Inhalt von werte/<ags>.json
 * objekt: { baujahr, wfl, lage?, ausstattung?, merkmale?: { name: true | 'schluessel' } }
 * → { unten, mittel, oben, zelle, rechnung, hinweise[], form, gemeinde, art, stand, url, seite }
 *   ohne rechenbaren Wert: unten/mittel/oben null und der Grund in hinweise.
 */
export function mietspiegelWerteFuer(werte, objekt) {
  const w = werte || {}, o = objekt || {};
  const kopf = { form: w.form || null, gemeinde: w.gemeinde || null, art: w.art || null, stand: w.stand || null,
    gueltig_ab: w.gueltig_ab || null, gueltig_bis: w.gueltig_bis || null,
    url: (w.quelle && w.quelle.url) || null, dokument: (w.quelle && w.quelle.dokument) || null };
  const hinweise = [];
  const bjRoh = num(o.baujahr), wfl = num(o.wfl);
  const bj = bjRoh !== null && bjRoh > 1000 ? Math.round(bjRoh) : null;
  const wflOk = wfl !== null && wfl > 0 ? wfl : null;
  const n = num(w.rundung) !== null ? num(w.rundung) : 2;
  let r;
  if (w.einheit && w.einheit !== 'eur_qm_nettokalt') r = leer(['Einheit ' + w.einheit + ' wird nicht gerechnet']);
  else if (w.form === 'tabelle') r = tabelleRechnen(w, o, bj, wflOk, n, hinweise);
  else if (w.form === 'regression') r = regressionRechnen(w, o, bj, wflOk, n, hinweise);
  else if (w.form === 'punkte') r = leer(['Punkte-Mietspiegel — DealPilot rechnet ihn noch nicht; Werte im Dokument der Stadt ablesen']);
  else r = leer(['Form des Mietspiegels unbekannt']);
  /* w.hinweis ist die Arbeitsnotiz der Ernte (Ablesung, Besonderheiten) - eigenes Feld, nicht in die Kundenhinweise */
  return Object.assign(kopf, r, { seite: r.seite || (w.quelle && w.quelle.seite) || null, hinweis_quelle: w.hinweis || null });
}

/* ── Laden ─────────────────────────────────────────────────────────────── */
let _cache = null;
/** alle Wertedateien des Ordners (Dateien mit _ am Anfang sind Vorlagen) → Map ags → werte */
export function werteLaden(ordner = WERTE_ORDNER) {
  if (_cache && _cache.ordner === ordner) return _cache;
  const jeAgs = new Map(); const fehler = [];
  let dateien = [];
  try { dateien = fs.readdirSync(ordner).filter(f => /^\d{8}\.json$/.test(f)); } catch (e) { dateien = []; }
  for (const f of dateien) {
    try { const w = JSON.parse(fs.readFileSync(path.join(ordner, f), 'utf8')); jeAgs.set(f.slice(0, 8), w); }
    catch (e) { fehler.push(f + ': ' + e.message); }
  }
  _cache = { ordner, jeAgs, fehler };
  return _cache;
}
export function werteFuer(ags, ordner) {
  const a = String(ags == null ? '' : ags).replace(/\D/g, '');
  return werteLaden(ordner).jeAgs.get(a.length === 7 ? '0' + a : a) || null;
}

/**
 * Antwort der Route GET /mietspiegel (routes/api.js) um die Werte ergänzen - hier, damit Route und Prüfer
 * (tools/mietpotenzial-pruefen.mjs, Abschnitt M) DIESELBE Stelle rufen.
 * satz: Ergebnis von mietspiegelFuer(ags) (verzeichnis.js); q: Query { baujahr, wfl, lage, ausstattung, merkmale: 'a,b' }.
 * Setzt satz.werte_verfuegbar immer; mit baujahr oder wfl zusätzlich satz.werte.
 */
export function mietspiegelMitWerten(satz, q, ordner) {
  if (!satz) return satz;
  let w = werteFuer(satz.ags, ordner);
  /* v3260 · Marcel 09.11.2026: Mietspiegel mit Rechtevorbehalt (Datei-Feld freigabe: 'gesperrt') nicht auf Prod,
     bis geklaert ist, ob die Werte genutzt werden duerfen. Der Proxy der Haupt-App setzt nur_frei=1 ausserhalb
     von Staging (backend/src/routes/marktbericht.js). */
  if (w && w.freigabe === 'gesperrt' && q && String(q.nur_frei) === '1') { w = null; satz.werte_gesperrt = true; }
  satz.werte_verfuegbar = !!w;
  q = q || {};
  if (w && (q.baujahr || q.wfl)) {
    const merkmale = {};
    /* 'a,b' setzt Schalter; 'name:wert' (v3261) übergibt eine Auswahl oder einen Betrag (Komma als Dezimalzeichen geht nicht, Punkt nehmen) */
    String(q.merkmale || '').split(',').map(x => x.trim()).filter(Boolean).forEach(x => {
      const i = x.indexOf(':');
      if (i > 0) merkmale[x.slice(0, i).trim()] = x.slice(i + 1).trim(); else merkmale[x] = true;
    });
    satz.werte = mietspiegelWerteFuer(w, { baujahr: q.baujahr, wfl: q.wfl, lage: q.lage || null, ausstattung: q.ausstattung || null, merkmale });
  }
  return satz;
}
