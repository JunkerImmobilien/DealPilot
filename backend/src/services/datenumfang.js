'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   services/datenumfang.js · v3930 (landing-zahlen-live-1) — DATENUMFANG DER LANDING

   Marcel 20.11.2026: die Zahlen auf der Landing („über 1 Million amtliche
   Datenpunkte", Registerzahlen, Kacheln auf „Wie wir rechnen") sollen sich
   nach der Datenbank aktualisieren — bisher standen sie nur so frisch wie
   der letzte Lauf von tools/datenumfang-messen.mjs, und der zählte Staging.

   GET /api/v1/public/datenumfang (routes/publicDatenumfang.js) zählt auf den
   Datenbanken DES SERVERS, AUF DEM ER LÄUFT:
     - dealpilot-postgres: SQL_HAUPT (Zinsreihen der Bundesbank) und die
       Nutzerzahl von /public/stats (routes/publicStats.js nutzerZahl)
     - dealpilot-mb-db: über das Marktbericht-Backend im Docker-Netz,
       GET /api/v1/marktbericht/intern/datenumfang (lib/datenumfang.js dort:
       SQL_MB, BORIS-Dienste, Abruftakte, Registerstand)
   Das Haupt-Backend erreicht die mb-Datenbank nicht direkt — deshalb zwei
   Teilabfragen, zusammengesetzt hier.

   EINE Rechnung für Endpunkt UND Werkzeug: zusammensetzen() rechnet aus den
   Rohzählungen Teile, Summe, Rundung, Schnittstellen und Kopf;
   tools/datenumfang-messen.mjs lädt genau diese Funktion (createRequire).

   Die Antwort trägt nur Zählungen: keine Inhalte, keine personenbezogenen
   Daten, keine Hostnamen oder Adressen (tools/landing-zahlen-pruefen.mjs
   prüft das). Zwischenspeicher 6 h (DATENUMFANG_CACHE_MS); ein Fehlschlag
   wird nur 5 Minuten gemerkt. Täglicher Takt unter takt('landingZahlen')
   misst neu, damit der Speicher nie älter als ein Tag ist.
   ═══════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const VERSION = 'v3930';

/* ── 1 · Zählungen in dealpilot-postgres ─────────────────────────────── */
const SQL_HAUPT = `
select 'zins_tage' as k, count(*)::text as v from markt_zins_tag
union all select 'zins_werte', (count(bund) + count(pfandbrief))::text from markt_zins_tag
union all select 'zins_monat_werte', count(mfi)::text from markt_bauzins_monat
union all select 'zins_seit', min(datum)::text from markt_zins_tag`;

/** Zeilen [{k, v}] → { k: Zahl | Text } — wie psql -At im Werkzeug. */
function zeilenZuObjekt(zeilen) {
  const r = {};
  for (const z of zeilen || []) {
    const v = z.v == null ? null : String(z.v);
    r[z.k] = v != null && /^\d+$/.test(v) ? Number(v) : v;
  }
  return r;
}

/* ── 2 · Abruftakt der Bundesbank-Reihen aus bauzinsService.js ───────── */
function bauzinsUhr(datei) {
  try {
    const t = fs.readFileSync(datei || path.join(__dirname, 'bauzinsService.js'), 'utf8');
    const m = t.match(/ziel\.setHours\((\d+), 0, 0, 0\)[\s\S]*?setInterval\(_taeglich, 24 \* 60 \* 60 \* 1000\)/);
    return m ? Number(m[1]) : null;
  } catch (e) { return null; }
}

const taktWort = (tage) => tage == null ? null : (tage <= 1 ? 'täglich' : tage <= 7 ? 'wöchentlich' : tage <= 31 ? 'monatlich' : 'alle ' + tage + ' Tage');
/** mbRoh aus lib/datenumfang.js mbTakteRoh() des Marktbericht-Backends, uhr aus bauzinsUhr() */
function takteAus(mbRoh, uhr) {
  const m = mbRoh || {};
  return {
    zinsen: uhr != null ? 'täglich' : null,
    zinsen_uhr: uhr != null ? uhr : null,
    statistik: taktWort(m.makro_tage),
    bau: taktWort(m.bau_tage),
    indizes: taktWort(m.jahreswerte_tage),
    portale_halbjahr1: m.harvest_h1 ? String(m.harvest_h1).replace('woechentlich', 'wöchentlich') : null,
    portale_halbjahr2: m.harvest_h2 || null,
    bodenrichtwerte: 'live je Bericht',
  };
}

/** „über 1,1 Millionen" ab einer Million, darunter „über 990.000" (auf Zehntausender abgerundet).
    Die Regel „1 Million nur, wenn die Messung darüber liegt" hängt an genau dieser Funktion. */
function amtlichRund(n) {
  if (n >= 1e6) { const m = Math.floor(n / 1e5) / 10; return 'über ' + m.toLocaleString('de-DE') + (m === 1 ? ' Million' : ' Millionen'); }
  return 'über ' + (Math.floor(n / 1e4) * 1e4).toLocaleString('de-DE');
}
/** Nutzerzahl der Landing: auf Zehner abgerundet, davor steht „>" (dp2.js, landing-strecke-3). */
const nutzerRund = (n) => (Number.isFinite(n) ? Math.floor(n / 10) * 10 : null);

/* ── 3 · Zusammensetzen — EINE Rechnung für Endpunkt und Werkzeug ──────
   db      Rohzählungen aus SQL_MB + SQL_HAUPT (ein Objekt)
   reg     Registerstand { saetze, kopf: { werte_gesamt, ausschuesse, laender_mit_wert, … } }
   boris   Namen der freigeschalteten BORIS-Dienste
   takte   Ergebnis von takteAus()
   fakten  { nutzer } und — nur im Werkzeug, aus dem Repo — api_endpunkte,
           pruefstrecken, videos, video_stunden. Fehlt ein Fakt, fehlt der Schlüssel.
   Rückgabe { teile, fehlend, amtlich, rund, schnitt, schnitt_gesamt, kopf } */
function zusammensetzen({ db, reg, boris, takte, fakten }) {
  db = db || {}; reg = reg || { kopf: {} }; fakten = fakten || {};
  const teile = {
    zensus: db.zensus, regional: db.regional, bau: db.bau, akoga: db.akoga,
    register: reg.kopf.werte_gesamt, kennzahlen_gaa: db.kennzahlen_gaa, indizes: db.indizes,
    zinsen: (db.zins_werte || 0) + (db.zins_monat_werte || 0),
  };
  const fehlend = Object.entries(teile).filter(([, v]) => !Number.isFinite(v)).map(([k]) => k);
  const amtlich = Object.values(teile).reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
  const rund = amtlichRund(amtlich);
  /* Schnittstellen: jeder angebundene amtliche Dienst bzw. jede abgerufene Tabelle/Reihe einzeln */
  const schnitt = {
    boris: (boris || []).length,
    statistik_tabellen: (db.zensus_tabellen || 0) + (db.regional_tabellen || 0) + (db.bau_tabellen || 0) + (db.indizes_reihen || 0),
    bundesbank: 1, akoga: db.akoga > 0 ? 1 : 0,
  };
  const schnitt_gesamt = Object.values(schnitt).reduce((s, v) => s + v, 0);
  const kopf = {
    amtlich_gesamt: amtlich,
    amtlich_rund: rund,
    amtlich_rund_gross: rund.charAt(0).toUpperCase() + rund.slice(1),
    register_werte: reg.kopf.werte_gesamt,
    ausschuesse: reg.kopf.ausschuesse,
    zensus: db.zensus, zensus_tabellen: db.zensus_tabellen, zensus_gebiete: db.zensus_gebiete,
    regional: db.regional, regional_tabellen: db.regional_tabellen, regional_gebiete: db.regional_gebiete,
    bau: db.bau, bau_tabellen: db.bau_tabellen,
    akoga: db.akoga, kennzahlen_gaa: db.kennzahlen_gaa,
    indizes: db.indizes, indizes_reihen: db.indizes_reihen,
    zins_tage: db.zins_tage,
    portale: db.portale, portale_laender: db.portale_laender,
    boris_dienste: (boris || []).length,
    schnittstellen: schnitt_gesamt,
    statistik_tabellen: schnitt.statistik_tabellen,
    nutzer: Number.isFinite(fakten.nutzer) ? fakten.nutzer : null,
    nutzer_rund: nutzerRund(fakten.nutzer),
    register_saetze: reg.saetze,
    laender_mit_wert: reg.kopf.laender_mit_wert,
  };
  for (const k of ['api_endpunkte', 'pruefstrecken', 'videos', 'video_stunden']) if (fakten[k] != null) kopf[k] = fakten[k];
  return { teile, fehlend, amtlich, rund, schnitt, schnitt_gesamt, kopf, takte: takte || null };
}

/* ── 4 · Messen auf diesem Server ────────────────────────────────────── */
const CACHE_MS = Number(process.env.DATENUMFANG_CACHE_MS) || 6 * 3600 * 1000;
const FEHLER_MS = 5 * 60 * 1000;
const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');

async function mbHolenStandard(frisch) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(MB_BASE + '/intern/datenumfang' + (frisch ? '?frisch=1' : ''), { signal: ctrl.signal });
    if (!r.ok) throw new Error('Marktbericht-Teil HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

/**
 * Misst neu und gibt die öffentliche Antwort zurück. Wirft, wenn ein Teil fehlt —
 * eine halbe Summe wäre eine falsche Zahl auf der Landing.
 * @param {{ db: {query: Function}, mbHolen?: Function, nutzerZahl?: Function, frisch?: boolean, jetzt?: () => Date }} o
 */
async function messen(o) {
  const db = o.db;
  const mbHolen = o.mbHolen || mbHolenStandard;
  const nutzerZahl = o.nutzerZahl || require('../routes/publicStats').nutzerZahl;
  const jetzt = (o.jetzt || (() => new Date()))();
  const [haupt, mb, nz] = await Promise.all([
    db.query(SQL_HAUPT).then((r) => zeilenZuObjekt(r.rows)),
    mbHolen(!!o.frisch),
    nutzerZahl(db),
  ]);
  if (!mb || !mb.db || !mb.register || !mb.register.kopf) throw new Error('Marktbericht-Teil unvollständig');
  /* Nur Zählungen und Tage durchlassen — was immer der Marktbericht-Teil künftig mitschickt,
     ein Hostname oder ein Text kommt so nie in die öffentliche Antwort. */
  const DB = {};
  for (const [k, v] of Object.entries(Object.assign({}, mb.db, haupt))) {
    if ((typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v))) DB[k] = v;
  }
  const takte = takteAus(mb.takte, bauzinsUhr());
  const Z = zusammensetzen({ db: DB, reg: mb.register, boris: mb.boris_dienste, takte, fakten: { nutzer: nz && nz.registrierte_nutzer } });
  if (Z.fehlend.length) throw new Error('fehlende Teile: ' + Z.fehlend.join(', '));
  const tag = jetzt.toISOString().slice(0, 10);
  return {
    ok: true,
    version: VERSION,
    stand: tag,
    gemessen: jetzt.toISOString(),
    quelle: 'Datenbanken dieses Servers, nur lesend (SELECT count) · BORIS-Dienste · Abruftakte im Code · Register der Gutachterausschüsse',
    kopf: Z.kopf,
    register: {
      stand: tag,
      dateien: mb.register.dateien, saetze: mb.register.saetze,
      kopf: mb.register.kopf, herkunft: mb.register.herkunft || null, jahrgaenge: mb.register.jahrgaenge || null,
    },
    teile: Z.teile,
    schnittstellen: Z.schnitt,
    takte,
    boris_dienste: (mb.boris_dienste || []).slice(),
    db: DB,
  };
}

let _speicher = { zeit: 0, wert: null, fehler: 0 };
let _laufend = null;   /* gleichzeitige Anfragen nach Ablauf messen EINMAL */
/** Aus dem Speicher, sonst neu gemessen. null = gerade nicht messbar (Antwort 503).
    Nach einem Fehlschlag 5 Minuten keine neue Messung; bis dahin gilt der letzte gute Stand. */
async function holen(o) {
  o = o || {};
  const nun = Date.now();
  if (!o.frisch) {
    if (_speicher.wert && nun - _speicher.zeit < CACHE_MS) return _speicher.wert;
    if (_speicher.fehler && nun - _speicher.fehler < FEHLER_MS) return _speicher.wert;
  }
  if (_laufend) return _laufend;
  _laufend = (async () => {
    try {
      const wert = await messen(o);
      _speicher = { zeit: Date.now(), wert, fehler: 0 };
      return wert;
    } catch (e) {
      console.warn('[datenumfang] Messung fehlgeschlagen: ' + (e && e.message));
      _speicher.fehler = Date.now();
      return _speicher.wert;   /* lieber der letzte gute Stand als keiner */
    } finally { _laufend = null; }
  })();
  return _laufend;
}
function _cacheLeeren() { _speicher = { zeit: 0, wert: null, fehler: 0 }; _laufend = null; }

/* ── 5 · Täglicher Takt ──────────────────────────────────────────────────
   Misst einmal 2 Minuten nach dem Start und danach täglich neu, auch wenn
   niemand die Landing aufruft — so ist der Speicher nie älter als ein Tag
   und die erste Anfrage nach dem Start wartet nicht auf die Messung.
   Unter takt('landingZahlen') wie jeder Takt (v3311): mit zwei Instanzen misst
   nur eine im Takt, die andere misst beim ersten Aufruf selbst. */
function starteTakt(db) {
  const _ts = require('../utils/taktSperre');
  const _landingZahlen = _ts.takt('landingZahlen', function () {
    return holen({ db, frisch: true }).then(function (w) {
      if (w) console.log('[datenumfang] gemessen: ' + w.kopf.amtlich_gesamt + ' amtliche Datenpunkte, Register ' + w.register.kopf.werte_gesamt);
    });
  });
  setTimeout(_landingZahlen, 2 * 60 * 1000);
  setInterval(_landingZahlen, 24 * 60 * 60 * 1000);
}

module.exports = {
  VERSION, SQL_HAUPT, zeilenZuObjekt, bauzinsUhr, takteAus, taktWort, amtlichRund, nutzerRund,
  zusammensetzen, messen, holen, starteTakt, _cacheLeeren, CACHE_MS,
};
