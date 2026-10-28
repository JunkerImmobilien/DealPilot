/* ═══════════════════════════════════════════════════════════════════════
   lib/angebot_abschlag.js · v3021 — EINE Quelle für den Marktdurchschnitt
   des Abschlags auf Angebotspreise

   Marcel 28.10.2026: „den Wert [5,8 %] bitte dann jedes Jahr automatisch neu
   ermitteln".

   Bis v3020 stand die Zahl zweimal: frontend/js/config.js
   `angebotAbschlagMarkt.pct` und ValuationService `ANGEBOT_ABSCHLAG_MARKT_PCT`
   („bei jeder Nachrecherche BEIDE Stellen ziehen"). Jetzt steht sie NUR hier;
   die Haupt-App holt sie über GET /jahreswerte/angebotsabschlag.

   RANGFOLGE des Marktdurchschnitts (Stufe 4 im ValuationService - die Stufen
   1-3, eigene Angabe und örtliche Messung, gehen weiter vor):
     a) DealPilot-Marktdurchschnitt des Vorjahres je Segment (ETW / Haus / MFH):
        Median der örtlichen Messungen (mb.angebot_abschlag_messung), je Ort und
        Satz nur die jüngste, Ausreißer nach Tukey (1,5 × IQR) geschnitten,
        nur mit mindestens MIN_N Messungen. Gerechnet einmal im Jahr ab dem
        15. Januar (JahreswerteService).
     b) sonst der recherchierte Wert RECHERCHE (bisher 5,8 %).

   Die Quelle der Recherche steht nur hier, intern. Nach außen heißt es
   „aktueller Marktdurchschnitt" (Marcel 14.10.2026: keine Datenquelle nennen).
   ═══════════════════════════════════════════════════════════════════════ */
import { typVon } from './zweigwahl.js';

/* Recherchierter Wert - Rückfall, solange kein DealPilot-Durchschnitt aktiv ist.
   Beim Nachrecherchieren NUR diesen Block ändern; Register tools/../jahreswerte.json
   (Eintrag angebotsabschlag_recherche) mitziehen, der Prüfer vergleicht beide. */
export const RECHERCHE = Object.freeze({
  pct: 5.8,
  stand: 'Dezember 2025',
  quelle: 'ImmoScout24-Marktanalyse, Eigentumswohnungen bundesweit',   /* intern - nie nach außen */
  url: 'https://www.immobilienscout24.de/unternehmen/news-medien/news/default-title/verhandlungsspielraum-beim-wohnungskauf-schrumpft-weiter/',
  recherchiert: '2026-10-14',
  spanne: 'Leipzig 0 %, Düsseldorf 1,4 %, Hamburg 7,8 %, Köln 9,2 % (Dezember 2025); Mitte 2025 bundesweit 6,8 %',
});

export const SEGMENTE = Object.freeze(['etw', 'haus', 'mfh']);
export const SEGMENT_NAME = Object.freeze({ etw: 'Eigentumswohnungen', haus: 'Ein- und Zweifamilienhäuser', mfh: 'Mehrfamilienhäuser' });
/* Mindestzahl verschiedener Messungen (Ort × Satz) je Segment und Jahr. 20, weil
   der Median erst dann gegen einzelne Orte stabil ist und ein Bundesland allein
   (NRW liefert die meisten Sätze mit Ø Kaufpreis) ihn nicht tragen soll. */
export const MIN_N = 20;
export const STICHTAG_MONAT_TAG = '01-15';   /* jährliche Rechnung ab 15. Januar */

/** Objekt → Segment 'etw' | 'haus' | 'mfh' | null (Gewerbe, Grundstück, unbekannt). */
export function segmentVon(ref) {
  if (!ref) return null;
  const t = typVon({ objart: ref.property_subtype || ref.property_type, haustyp: ref.haustyp || null,
    nutzung: ref.nutzung || ref.usage_type || null, einheiten: ref.units || null });
  if (!t) return null;
  if (/^etw/.test(t)) return 'etw';
  if (/^mfh|dreifh/.test(t)) return 'mfh';
  if (['efh', 'zfh', 'villa', 'dhh', 'reh', 'rmh', 'rh'].indexOf(t) >= 0) return 'haus';
  return null;
}

/* Aktive Jahreswerte je Segment, geladen aus mb.angebot_abschlag_jahr
   (JahreswerteService.ladeAktive). Leer = Recherche gilt. */
let _aktiv = {};
export function setzeAktive(zeilen) {
  const neu = {};
  for (const z of zeilen || []) {
    if (!z || !z.aktiv || SEGMENTE.indexOf(z.segment) < 0 || !(Number(z.pct) >= 0)) continue;
    const alt = neu[z.segment];
    if (!alt || Number(z.jahr) > alt.jahr) neu[z.segment] = { pct: Number(z.pct), n: Number(z.n), jahr: Number(z.jahr) };
  }
  _aktiv = neu;
  return _aktiv;
}
export function aktive() { return { ..._aktiv }; }

/** Marktdurchschnitt für ein Segment: { pct, herkunft, art, n?, jahr? }. */
export function marktdurchschnitt(segment) {
  const a = segment ? _aktiv[segment] : null;
  if (a) {
    return { pct: a.pct, art: 'dealpilot', n: a.n, jahr: a.jahr, segment,
      /* KEIN „örtlich" im Text: Frontend und Bericht lesen /rtlich/ als Stufe 2
         (örtlich gemessen am Satz des Ausschusses) - das ist dies nicht. */
      herkunft: 'DealPilot-Marktdurchschnitt aus ' + a.n + ' Ortsmessungen (' + a.jahr + ')' };
  }
  return { pct: RECHERCHE.pct, art: 'recherche', herkunft: 'Marktdurchschnitt', stand: RECHERCHE.stand, segment: segment || null };
}

/** Für die Haupt-App - ohne Quellennamen und Link. */
export function oeffentlich() {
  const seg = {};
  for (const s of SEGMENTE) { const m = marktdurchschnitt(s); seg[s] = { pct: m.pct, art: m.art, n: m.n || null, jahr: m.jahr || null }; }
  return { pct: RECHERCHE.pct, stand: RECHERCHE.stand, segmente: seg, version: 'v3021' };
}

function quantil(sortiert, p) {
  if (!sortiert.length) return null;
  const pos = (sortiert.length - 1) * p, u = Math.floor(pos), o = Math.ceil(pos);
  return sortiert[u] + (sortiert[o] - sortiert[u]) * (pos - u);
}

/**
 * Jahresrechnung aus Messungen (rein, ohne DB - prüfbar).
 * @param {Array<{ags, segment, satz_id, quelle, abschlag_pct, gemessen_am}>} messungen  eines Jahres
 * @returns {{ [segment]: { pct, n, n_roh, n_ausreisser, q1, q3, min_n, aktiv } }}
 */
export function berechneJahr(messungen, { minN = MIN_N } = {}) {
  /* je Ort × Segment × Satz die jüngste Messung */
  const juengste = new Map();
  for (const m of messungen || []) {
    if (!m || SEGMENTE.indexOf(m.segment) < 0 || !Number.isFinite(Number(m.abschlag_pct))) continue;
    const k = [m.ags, m.segment, m.quelle, m.satz_id || ''].join('|');
    const alt = juengste.get(k);
    if (!alt || String(m.gemessen_am) > String(alt.gemessen_am)) juengste.set(k, m);
  }
  const out = {};
  for (const s of SEGMENTE) {
    const w = [...juengste.values()].filter((m) => m.segment === s).map((m) => Number(m.abschlag_pct)).sort((a, b) => a - b);
    const q1 = quantil(w, 0.25), q3 = quantil(w, 0.75);
    let rein = w;
    if (w.length >= 4) {
      const iqr = q3 - q1;
      rein = w.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
    }
    const med = quantil(rein, 0.5);
    out[s] = { pct: med == null ? null : Math.round(med * 10) / 10, n: rein.length, n_roh: w.length,
      n_ausreisser: w.length - rein.length, q1: q1 == null ? null : Math.round(q1 * 10) / 10,
      q3: q3 == null ? null : Math.round(q3 * 10) / 10, min_n: minN, aktiv: rein.length >= minN && med != null };
  }
  return out;
}
