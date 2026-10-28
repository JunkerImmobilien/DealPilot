/* ═══════════════════════════════════════════════════════════════════════
   lib/jahreswerte.js · v3021 — Jahreswerte-Register lesen und bewerten

   Das Register (lib/data/jahreswerte.json) führt jeden zeit- oder
   jahresabhängigen Parameter: Ort im Code mit allen Spiegelstellen, Stand,
   Quelle (intern), Turnus, Fälligkeit und Verfahren.

   Liegt im mb-Backend, weil der Admin-Abschnitt „Jahreswerte" es über das
   mb-Backend liest (das Image führt nur marktbericht/backend/). Der Prüfer
   tools/jahreswerte-pruefen.mjs nutzt DIESELBE Funktion jahreswerteStatus()
   und prüft dazu die Spiegelstellen in den Dateien des Repos.
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.resolve(HIER, '..', '..');          /* marktbericht/backend bzw. /app */
const REPO = path.resolve(BACKEND, '..', '..');
export const REGISTER_DATEI = path.join(HIER, 'data', 'jahreswerte.json');
export const VORLAUF_TAGE = 60;

export function jahreswerteRegister(datei = REGISTER_DATEI) {
  return JSON.parse(fs.readFileSync(datei, 'utf8'));
}

/** Repo-Pfad → lesbarer Pfad (im Container: marktbericht/backend/… → /app/…). */
export function aufloesen(rel) {
  const r = String(rel).replace(/\\/g, '/');
  const kand = [path.join(REPO, r)];
  if (r.startsWith('marktbericht/backend/')) kand.unshift(path.join(BACKEND, r.slice('marktbericht/backend/'.length)));
  return kand.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } }) || null;
}

function iso(d) { return d.toISOString().slice(0, 10); }

/** Fälligkeit aus einer Datei: nächstes Datum ab heute, das das Muster liefert. */
function faelligAus(fa, heute) {
  const p = aufloesen(fa.datei);
  if (!p) return { datum: null, fehler: 'Datei nicht lesbar: ' + fa.datei };
  const re = new RegExp(fa.muster, 'g');
  const t = fs.readFileSync(p, 'utf8');
  const d = [...t.matchAll(re)].map((m) => m[1]).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
  const ab = iso(heute);
  return { datum: d.find((x) => x >= ab) || null };
}

/**
 * Status je Wert: 'ueberfaellig' | 'bald' (≤ 60 Tage) | 'ok' | 'ohne_termin'.
 * Bei verfahren 'automatisch' heißt überfällig nur: der RÜCKFALL im Code ist alt
 * (der Takt hält den Wert aktuell) - das ist eine Warnung, kein Abbruch.
 */
export function jahreswerteStatus(reg, heute = new Date()) {
  const h = iso(heute);
  const grenze = iso(new Date(heute.getTime() + VORLAUF_TAGE * 86400000));
  return (reg.werte || []).map((w) => {
    let faellig = w.faellig_am || null, fehler = null;
    if (w.faellig_aus) { const f = faelligAus(w.faellig_aus, heute); fehler = f.fehler || null; faellig = f.datum || faellig; }
    let status = 'ohne_termin';
    if (faellig) status = faellig < h ? 'ueberfaellig' : (faellig <= grenze ? 'bald' : 'ok');
    const tage = faellig ? Math.round((Date.parse(faellig) - Date.parse(h)) / 86400000) : null;
    return { id: w.id, name: w.name, gruppe: w.gruppe, stand: w.stand, wert: w.wert_text || w.erwartet || null,
      turnus: w.turnus, verfahren: w.verfahren, faellig_am: faellig, tage, status,
      abbruch: status === 'ueberfaellig' && w.verfahren !== 'automatisch', fehler,
      orte: (w.orte || []).map((o) => o.datei + (o.bezeichner ? ' · ' + o.bezeichner : '')), hinweis: w.hinweis || null };
  });
}

/**
 * Spiegelstellen prüfen (nur im Repo sinnvoll - der Container hat frontend/ nicht).
 * orte[i]: { datei, bezeichner, muster, block?, nimm?: 'erster'|'alle'|'max' }
 *   muster = RegExp-Quelltext; alle Gruppen werden mit ',' verbunden.
 *   block  = Text, ab dem gesucht wird (bis zur nächsten Zeile, die mit '};' oder '}' endet).
 * verboten[i]: { datei, muster, grund } - darf NICHT vorkommen (zweite Quelle).
 * @returns {{ id, gleich:boolean, werte:[{ort, wert|null, fehler?}], erwartet, verstoesse:[] }}
 */
export function spiegelPruefen(w) {
  const werte = [];
  for (const o of w.orte || []) {
    if (!o.muster) continue;
    const p = aufloesen(o.datei);
    if (!p) { werte.push({ ort: o.datei, wert: null, fehler: 'Datei fehlt' }); continue; }
    let t = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    if (o.block) {
      const i = t.indexOf(o.block);
      if (i < 0) { werte.push({ ort: o.datei, wert: null, fehler: 'Block nicht gefunden: ' + o.block }); continue; }
      t = t.slice(i);
      const e = t.search(/\n\s*\};?\s*\n/);
      if (e > 0) t = t.slice(0, e);
    }
    /* faktor: Prozent gegen Anteil (40.45 gegen 0.4045) vergleichbar machen */
    const norm = (x) => (o.faktor ? String(Math.round(Number(x) * o.faktor * 1e6) / 1e6) : x);
    const treffer = [...t.matchAll(new RegExp(o.muster, 'g'))].map((m) => m.slice(1).map(norm).join(','));
    if (!treffer.length) { werte.push({ ort: o.datei + (o.bezeichner ? ' · ' + o.bezeichner : ''), wert: null, fehler: 'Muster ohne Treffer' }); continue; }
    const nimm = o.nimm || 'erster';
    let liste = treffer;
    if (nimm === 'erster') liste = [treffer[0]];
    if (nimm === 'max') liste = [treffer.slice().sort().pop()];
    for (const x of liste) werte.push({ ort: o.datei + (o.bezeichner ? ' · ' + o.bezeichner : ''), wert: x });
  }
  const verstoesse = [];
  for (const v of w.verboten || []) {
    const p = aufloesen(v.datei);
    if (!p) continue;
    if (new RegExp(v.muster).test(fs.readFileSync(p, 'utf8'))) verstoesse.push(v.datei + ': ' + v.grund);
  }
  const vorhanden = werte.filter((x) => x.wert != null).map((x) => x.wert);
  const erwartet = w.erwartet != null ? String(w.erwartet) : null;
  const gleich = !werte.some((x) => x.fehler) && new Set(vorhanden).size <= 1
    && (erwartet == null || vorhanden.every((x) => x === erwartet)) && !verstoesse.length;
  return { id: w.id, gleich, werte, erwartet, verstoesse };
}
