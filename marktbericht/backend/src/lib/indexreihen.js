/* ═══════════════════════════════════════════════════════════════════════
   lib/indexreihen.js · v3026 — die amtlichen Indexreihen für viele Nutzer

   Marcel 28.10.2026: „so, dass wir halt viele Nutzer und Abrufe abdecken
   können. Eventuell benötigen wir dann Tabellen, die wir aktualisieren."

   DER WEG EINES WERTES (kein Nutzerabruf geht je an GENESIS):
     GENESIS / destatis.de ──(Jahreswerte-Takt, alle 7 Tage, ein Prozess)──▶
     mb.jahreswerte_abruf (status 'aktiv', geprüft) ──(Start + nach jedem
     Abruf: setzeIndexreihen)──▶ dieser Speicher-Cache ──▶ GET /indexreihen
     (ETag, Cache-Control) ──▶ Haupt-Backend (eigener Speicher-Cache) ──▶
     Browser (Speicher + localStorage mit Stand) ──▶ Rechenkern als PARAMETER.

   RÜCKFALL, wenn etwas ausfällt:
     GENESIS weg   → die DB hält den letzten geprüften Stand, nichts bricht.
     DB weg        → indexreihen() baut aus den Code-Tabellen (NKM_INDEX,
                     BPI_TABELLE, VPI-Oktoberwerte); 'herkunft: code'.
   Im Code belegte Werte haben Vorrang vor abgerufenen (wie baupreisindex.js).
   ═══════════════════════════════════════════════════════════════════════ */
import crypto from 'crypto';
import { REIHEN } from './destatis_reihen.js';
import { NKM_INDEX } from './zensus_miete.js';
import { BPI_TABELLE } from './baupreisindex.js';
import { VPI_OKTOBER_IMMOWERTV } from './nrw_modell.js';

let _cache = null;

function codeWerte(reihe) {
  if (reihe === 'nkm') return { ...NKM_INDEX.monate };
  if (reihe === 'bpi') return { ...BPI_TABELLE.monate };
  const o = {};
  for (const [j, v] of Object.entries(VPI_OKTOBER_IMMOWERTV)) o[j + '-10'] = v;
  return o;
}

function tag(x) {
  if (!x) return null;
  return String(x instanceof Date ? x.toISOString() : x).slice(0, 10);
}

function baue(zeilen, herkunft) {
  const reihen = {};
  let stand = null;
  for (const reihe of Object.keys(REIHEN)) {
    const monate = codeWerte(reihe);
    const code = new Set(Object.keys(monate));
    let abgerufen = null;
    for (const z of zeilen || []) {
      if (z.reihe !== reihe) continue;
      const k = String(z.periode || ''), w = Number(z.wert);
      if (!/^\d{4}-\d{2}$/.test(k) || !(w > 0)) continue;
      if (!code.has(k)) monate[k] = w;
      const a = tag(z.abgerufen_am);
      if (a && (!abgerufen || a > abgerufen)) abgerufen = a;
    }
    const sortiert = {};
    for (const k of Object.keys(monate).sort()) sortiert[k] = monate[k];
    const ks = Object.keys(sortiert);
    reihen[reihe] = {
      name: REIHEN[reihe].name, basis: REIHEN[reihe].basis,
      quelle: 'Statistisches Bundesamt' + (REIHEN[reihe].genesis ? ', GENESIS ' + REIHEN[reihe].genesis : ''),
      von: ks[0] || null, bis: ks[ks.length - 1] || null, n: ks.length, abgerufen_am: abgerufen, monate: sortiert,
    };
    if (abgerufen && (!stand || abgerufen > stand)) stand = abgerufen;
  }
  const kern = { version: 1, herkunft, stand, reihen };
  const etag = '"ir-' + crypto.createHash('sha1').update(JSON.stringify(kern)).digest('hex').slice(0, 16) + '"';
  return { ...kern, erzeugt_am: new Date().toISOString(), etag };
}

/** Aus den aktiven DB-Zeilen neu bauen (JahreswerteService.ladeAktive). */
export function setzeIndexreihen(zeilen) {
  _cache = baue(zeilen, 'db');
  return { etag: _cache.etag, n: Object.fromEntries(Object.entries(_cache.reihen).map(([k, r]) => [k, r.n])) };
}

/** Die aktive Reihe aus dem Speicher; ohne DB-Stand aus den Code-Tabellen. */
export function indexreihen() {
  if (!_cache) _cache = baue([], 'code');
  return _cache;
}
