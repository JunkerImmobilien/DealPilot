/* ═══════════════════════════════════════════════════════════════════════
   lib/datenumfang.js · v3930 (landing-zahlen-live-1) — DATENUMFANG, TEIL MARKTBERICHT

   Marcel 20.11.2026: die Zahlen auf der Landing („über 1 Million amtliche
   Datenpunkte", Register, Kacheln auf „Wie wir rechnen") sollen sich nach
   der Datenbank aktualisieren, nicht nur, wenn jemand ein Werkzeug startet.

   EINE Stelle für die Zählungen des Marktbericht-Teils. Drei Leser:
     1. GET /api/v1/marktbericht/intern/datenumfang (routes/api.js) — nur im
        Docker-Netz, das Haupt-Backend fragt sie für
        GET /api/v1/public/datenumfang (backend/src/services/datenumfang.js).
     2. tools/datenumfang-messen.mjs — dieselbe SQL per ssh/psql (--ssh).
     3. tools/messe-schleife-daten.mjs — registerStandBerechnen() schreibt
        register-stand.js (war bis v3930 im Werkzeug selbst gerechnet).
   Wer hier eine Zählung ändert, ändert sie für alle drei.

   NUR LESEND (SELECT count), nur Summen: keine Inhalte, keine Namen von
   Personen, keine Hostnamen. Ohne Import von db.js: die Abfragefunktion q
   kommt als Parameter (lokal hat das Werkzeug kein pg).
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── 1 · Zählungen in dealpilot-mb-db ─────────────────────────────────
   Spaltennamen k/v, damit pg (Endpunkt) und psql -At (Werkzeug) dieselbe
   Abfrage lesen. Jede Zeile: Schlüssel | Zahl als Text. */
export const SQL_MB = `
select 'zensus' as k, count(*)::text as v from mb.zensus_werte
union all select 'zensus_tabellen', count(distinct tabelle)::text from mb.zensus_werte
union all select 'zensus_gebiete', count(distinct ags)::text from mb.zensus_werte
union all select 'regional', count(*)::text from mb.makro_werte
union all select 'regional_tabellen', count(distinct tabelle)::text from mb.makro_werte
union all select 'regional_gebiete', count(distinct ags)::text from mb.makro_werte
union all select 'bau', count(*)::text from mb.baustatistik
union all select 'bau_tabellen', count(distinct tabelle)::text from mb.baustatistik
union all select 'akoga', count(*)::text from mb.param_werte
union all select 'register_db', count(*)::text from mb.param_modell
union all select 'kennzahlen_gaa', count(*)::text from mb.wert_parameter where qualitaet in ('A','B','C')
union all select 'indizes', count(*)::text from mb.jahreswerte_abruf
union all select 'indizes_reihen', count(distinct reihe)::text from mb.jahreswerte_abruf
union all select 'portale', count(*)::text from mb.gaa_sources where status = 'aktiv'
union all select 'portale_erreichbar', count(*)::text from mb.gaa_sources where status = 'aktiv' and coalesce(fehler_anzahl,0) < 3
union all select 'portale_laender', count(distinct bundesland)::text from mb.gaa_sources where status = 'aktiv'`;

/** Zeilen [{k, v}] → { k: Zahl | Text }. Dieselbe Deutung wie psql -At im Werkzeug. */
export function zeilenZuObjekt(zeilen) {
  const r = {};
  for (const z of zeilen || []) {
    const v = z.v == null ? null : String(z.v);
    r[z.k] = v != null && /^\d+$/.test(v) ? Number(v) : v;
  }
  return r;
}
/** psql -At -F'|' Ausgabe → dieselben Zeilen. */
export function psqlZuZeilen(text) {
  return String(text || '').trim().split(/\r?\n/).filter(Boolean).map((z) => { const [k, v] = z.split('|'); return { k, v }; });
}

export async function mbZaehlen(q) { return zeilenZuObjekt(await q(SQL_MB)); }

/* ── 2 · Abruftakte aus den Konstanten der Taktgeber ──────────────────
   Gelesen aus dem Quelltext (die Konstanten sind nicht exportiert), relativ
   zu dieser Datei — im Image liegt src/ unter /app/src, im Repo unter
   marktbericht/backend/src. null = nicht gefunden (das Werkzeug wird rot). */
function konst(rel, re) {
  try { const m = fs.readFileSync(join(SRC, rel), 'utf8').match(re); return m || null; } catch (e) { return null; }
}
export function mbTakteRoh() {
  const mk = konst('services/MakroImportService.js', /const ALTER_TAGE = (\d+)/);
  const bs = konst('services/BaustatistikService.js', /ALTER_TAGE = (\d+)/);
  const jw = konst('services/JahreswerteService.js', /const ABRUF_ALTER_TAGE = (\d+)/);
  const hv = konst('lib/harvestScheduler.js', /Januar bis Juni\s+(\S+) je Quelle[\s\S]*?Juli bis Dezember\s+(\S+)/);
  return {
    makro_tage: mk ? Number(mk[1]) : null,
    bau_tage: bs ? Number(bs[1]) : null,
    jahreswerte_tage: jw ? Number(jw[1]) : null,
    harvest_h1: hv ? hv[1] : null,
    harvest_h2: hv ? hv[2] : null,
  };
}

/* ── 3 · BORIS-Dienste (enabled) ──────────────────────────────────────── */
export async function borisDienste() {
  const { BorisRegistry } = await import('../connectors/boris/registry.js');
  const st = await BorisRegistry.status();
  return (Array.isArray(st) ? st : []).filter((a) => a.enabled).map((a) => a.name);
}

/* ── 4 · Registerstand wie Admin „Register & Ernte" ───────────────────
   Bis v3930 in tools/messe-schleife-daten.mjs. registerDeckung() ohne
   Datenbank (der DB-Abgleich steht nicht auf der Tafel), dazu je Wert die
   Herkunftsfelder und die Ausschüsse MIT mindestens einem Wert.
   Wirft bei unlesbarer Registerdatei oder ungleicher Summe. */
export async function registerStandBerechnen() {
  const { registerDeckung, LC, LAENDER, istSperre, maskiere } = await import('./register_deckung.js');
  const { SAATDATEIEN, leseSaatdateien } = await import('./ausschuss_register.js');

  const D = await registerDeckung({ q: async () => { throw new Error('ohne Datenbank'); }, schreibeSchnappschuss: false });
  if (D.dateien.vermisst) throw new Error(D.dateien.vermisst + ' Registerdatei(en) nicht lesbar');

  const { alle } = leseSaatdateien(SAATDATEIEN);
  const landVon = (s) => LC[String((s && s.ags) || '').replace(/\D/g, '').slice(0, 2)]
    || (s && s.land_code && LAENDER.includes(String(s.land_code).toUpperCase()) ? String(s.land_code).toUpperCase() : null);
  /* Jahrgang wie jahrVon() in register_deckung.js */
  const jahrVon = (s) => {
    const b = Number(s.berichtsjahr ?? s.jahrgang);
    if (Number.isFinite(b) && b > 1900) return b;
    const t = /^(\d{4})/.exec(String(s.stichtag || ''));
    return t ? Number(t[1]) : null;
  };
  /* Name normiert wie normName() in register_deckung.js (dort nicht exportiert) —
     „Gutachterausschuss der Stadt Ansbach" und „… für Grundstückswerte Ansbach" sind EIN Ausschuss. */
  const normName = (n) => String(n || '').toLowerCase()
    .replace(/gutachterausschuss(es)?|f(ü|ue)r|grundst(ü|ue)ckswerte|immobilienwerte|die ermittlung von|im bereich|des|der|den|die|in|gemeinsame[rn]?|obere[rn]?/g, ' ')
    .replace(/[^a-zäöüß0-9]+/g, '');
  const ausschuss = (s) => s.gaa_name || s.ausschuss || s.gebiet_name || null;

  let werte = 0, mitAusschuss = 0, mitJahr = 0, mitQuelle = 0, irw = 0;
  const aus = new Set(), irwAus = new Set();
  for (const s of alle) {
    if (!s || !s.kennzahl || istSperre(s)) continue;
    const L = landVon(s); if (!L) continue;
    werte++;
    const a = ausschuss(s);
    if (a) { mitAusschuss++; aus.add(L + '|' + normName(maskiere(a))); }
    if (jahrVon(s)) mitJahr++;
    if (s.quelle_url || s.quelle || (s.belege && s.belege.length)) mitQuelle++;
    if (s.kennzahl === 'umrechnung_irw') { irw++; irwAus.add(L + '|' + normName(a)); }
  }
  let ohneSeite = 0, jmin = null, jmax = null;
  for (const L of D.laender) for (const z of Object.values(D.zellen[L])) {
    ohneSeite += z.ohne_seite || 0;
    if (z.jahr_min) jmin = jmin == null ? z.jahr_min : Math.min(jmin, z.jahr_min);
    if (z.jahr_max) jmax = jmax == null ? z.jahr_max : Math.max(jmax, z.jahr_max);
  }
  const summeWerte = Object.values(D.summe).reduce((n, z) => n + z.werte, 0);
  if (summeWerte !== werte) throw new Error('Werte gesamt ' + werte + ' ≠ Deckung ' + summeWerte);

  /* Länder-Raster: je Land und Kennzahl Werte und Anteil */
  const KZ4 = ['lzs', 'swf', 'uk_flaeche', 'uk_wgfz'];
  const laender = {};
  for (const L of D.laender) {
    const r = { name: D.land_name[L] || L, werte: 0 };
    let w = 0, n = 0;
    for (const k of KZ4) {
      const z = D.zellen[L][k] || { werte: 0, sperren: 0 };
      r[k] = { w: z.werte, anteil: z.werte + z.sperren ? Math.round(100 * z.werte / (z.werte + z.sperren)) / 100 : 0 };
      w += z.werte; n += z.werte + z.sperren;
    }
    for (const z of Object.values(D.zellen[L])) r.werte += z.werte;
    r.anteil4 = n ? Math.round(100 * w / n) / 100 : 0;
    r.erfasst = Object.values(D.zellen[L]).some((z) => z.werte + z.sperren > 0);
    laender[L] = r;
  }
  const sw = (k) => (D.summe[k] ? D.summe[k].werte : 0);
  return {
    quelle: 'registerDeckung() · lib/register_deckung.js, ohne Datenbank (wie Admin „Register & Ernte")',
    dateien: D.dateien.gelesen,
    saetze: D.saetze,
    kopf: {
      werte_gesamt: werte,
      lzs: sw('lzs'), swf: sw('swf'), uk_flaeche: sw('uk_flaeche'), uk_wgfz: sw('uk_wgfz'),
      /* landing-methodik-3: Vergleichsfaktoren für die Karten auf „Wie wir rechnen" */
      vgf: sw('vgf'),
      uk: sw('uk_flaeche') + sw('uk_wgfz'),
      irw_tabellen: irw,
      irw_ausschuesse: irwAus.size,
      ausschuesse: aus.size,
      laender_erfasst: Object.values(laender).filter((l) => l.erfasst).length,
      /* messe-schleife-5d: nur Länder mit mindestens einem WERT — Sätze allein (Saarland) zählen nicht */
      laender_mit_wert: Object.values(laender).filter((l) => l.werte > 0).length,
      laender_gesamt: LAENDER.length,
    },
    herkunft: { werte, mit_ausschuss: mitAusschuss, mit_jahrgang: mitJahr, mit_quelle: mitQuelle, mit_seite: werte - ohneSeite },
    jahrgaenge: [jmin, jmax],
    laender,
  };
}

/* ── 5 · Alles zusammen, für die interne Route ────────────────────────
   Zwischenspeicher 6 h (MB_DATENUMFANG_CACHE_MS): die Registerdateien
   ändern sich nur mit einem neuen Image, die Zählungen langsam. */
const CACHE_MS = Number(process.env.MB_DATENUMFANG_CACHE_MS) || 6 * 3600 * 1000;
let _speicher = { zeit: 0, wert: null };
export async function mbDatenumfang(q, { frisch = false, jetzt = Date.now } = {}) {
  if (!frisch && _speicher.wert && jetzt() - _speicher.zeit < CACHE_MS) return _speicher.wert;
  const [db, boris, reg] = await Promise.all([mbZaehlen(q), borisDienste(), registerStandBerechnen()]);
  const wert = {
    db, takte: mbTakteRoh(), boris_dienste: boris,
    register: { dateien: reg.dateien, saetze: reg.saetze, kopf: reg.kopf, herkunft: reg.herkunft, jahrgaenge: reg.jahrgaenge },
  };
  _speicher = { zeit: jetzt(), wert };
  return wert;
}
export function _cacheLeeren() { _speicher = { zeit: 0, wert: null }; }
