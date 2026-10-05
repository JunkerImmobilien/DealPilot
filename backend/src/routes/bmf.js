'use strict';
/**
 * V288 — BMF Kaufpreisaufteilung (produktive Routes)
 *
 * POST /api/v1/bmf/aufteilung
 *   Body: { inputs: {...}, include_file?: boolean }
 *   Auth: Bearer JWT + requireFeature('bmf_advanced') (Pro-Plan)
 *   Returns: { ok, output: {...}, file_base64? }
 *
 * GET /api/v1/bmf/meta
 *   Auth: Bearer JWT + requireFeature('bmf_advanced')
 *   Returns: Dropdown-Optionen + Input-Felder-Spezifikation
 *
 * GET /api/v1/bmf/selftest
 *   Auth: Bearer JWT + requireFeature('bmf_advanced')
 *   Returns: Demo-Berechnung als Health-Check
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { requireFeature } = require('../middleware/planLimits');
const bmfPipelineService = require('../services/bmfPipelineService');  /* V290-pipeline-require */
/* v1872 · Der Lauf wird je Eingabe-Hash gemerkt (Tabelle bmf_cache, Migration 084).
   Gemessen an der Parkstr. 9: 40 s je Lauf, weil LibreOffice die
   BMF-Arbeitshilfe neu rechnet. Gleiche Eingaben, gleiches Ergebnis — der
   zweite Aufruf kommt in Millisekunden. `prewarm` ist der stille Vorlauf aus
   dem Frontend (Objekt geladen, Pro, alles da): er stellt sich hinten an,
   wenn gerade ein Lauf arbeitet, statt einen zweiten LibreOffice zu starten. */
const crypto = require('crypto');
const { query: dbQuery } = require('../db/pool');
let _bmfLaufend = 0;
function _stabil(v) {
  if (Array.isArray(v)) return v.map(_stabil);
  if (v && typeof v === 'object') { const o = {}; Object.keys(v).sort().forEach((k) => { o[k] = _stabil(v[k]); }); return o; }
  return v;
}
function _bmfHash(inputs) {
  return crypto.createHash('sha256').update(JSON.stringify(_stabil(inputs))).digest('hex');
}
async function _cacheLesen(hash) {
  try {
    const r = await dbQuery('SELECT result, created_at FROM bmf_cache WHERE hash = $1', [hash]);
    if (!r.rows.length) return null;
    dbQuery('UPDATE bmf_cache SET letzter_zugriff = now() WHERE hash = $1', [hash]).catch(() => {});
    return r.rows[0];
  } catch (e) { return null; }   /* Tabelle fehlt (Migration nicht gelaufen) → ohne Cache weiter */
}
async function _cacheSchreiben(hash, userId, inputs, result, dauerMs) {
  try {
    await dbQuery(
      `INSERT INTO bmf_cache (hash, user_id, inputs, result, dauer_ms)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (hash) DO UPDATE SET result = EXCLUDED.result, dauer_ms = EXCLUDED.dauer_ms, letzter_zugriff = now()`,
      [hash, userId || null, JSON.stringify(inputs), JSON.stringify(result), dauerMs]);
    if (Math.random() < 0.05) dbQuery(`DELETE FROM bmf_cache WHERE created_at < now() - interval '60 days'`).catch(() => {});
  } catch (e) { /* kein Cache ist kein Fehler */ }
}
const bmfService = require('../services/bmfService');

const router = express.Router();

/**
 * GET /api/v1/bmf/meta
 * Liefert Dropdown-Werte + Input-Spezifikation für das Frontend.
 */
router.get('/meta', authenticate, requireFeature('bmf_advanced'), (req, res) => {
  res.json({
    grundstuecksart_options: bmfService.GRUNDSTUECKSART_OPTIONS,
    input_cells: Object.keys(bmfService.INPUT_CELLS),
    output_cells: Object.keys(bmfService.OUTPUT_CELLS),
    template_version: 'Juni 2023',
    api_version: 'V288'
  });
});

/**
 * POST /api/v1/bmf/aufteilung
 * Hauptberechnung: führt LibreOffice-Sandwich aus.
 */
router.post('/aufteilung', authenticate, requireFeature('bmf_advanced'), async (req, res, next) => {
  try {
    const body = req.body || {};
    const inputs = body.inputs;
    const includeFile = !!body.include_file;
    /* v1484: die ausgefuellte Arbeitshilfe zusaetzlich als PDF. */
    const includePdf = !!body.include_pdf;

    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({ error: 'Body muss { inputs: {...} } enthalten.' });
    }

    // Pflicht-Inputs
    const required = ['lage', 'grundstuecksart', 'kaufdatum', 'kaufpreis', 'baujahr', 'wohnflaeche'];
    const missing = required.filter(k => inputs[k] == null || inputs[k] === '');
    if (missing.length) {
      return res.status(400).json({
        error: 'Pflichtfelder fehlen',
        missing
      });
    }

    const result = await bmfService.calculateKpa(inputs, { includeFile, includePdf });

    /* V289-results-fix-applied */
    res.json({
      ok: true,
      results: result.results || result.output,  /* Service liefert 'results' */
      inputs_received: result.inputs_received,
      meta: result.meta,
      warnings: result.warnings || [],
      file_base64: includeFile ? result.file_base64 : undefined,
      file_name: includeFile ? 'BMF_Aufteilung_' + Date.now() + '.xlsx' : undefined,
      pdf_base64: includePdf ? result.pdf_base64 : undefined,
      pdf_name: includePdf ? result.pdf_name : undefined
    });
  } catch (err) {
    // Operational errors aus LibreOffice → 500 mit kontrollierter Message
    if (err && err.code === 'LIBREOFFICE_ERROR') {
      return res.status(500).json({
        error: 'LibreOffice-Berechnung fehlgeschlagen',
        detail: err.message,
        hint: 'Bitte erneut versuchen oder Support kontaktieren.'
      });
    }
    if (err && err.code === 'TIMEOUT') {
      return res.status(504).json({
        error: 'BMF-Berechnung dauerte zu lange',
        detail: err.message
      });
    }
    next(err);
  }
});

/**
 * GET /api/v1/bmf/selftest
 * Führt eine Demo-Berechnung mit hartcodierten Werten durch.
 * Erwartet: gebaeudeanteil_prozent ≈ 87.89
 */
router.get('/selftest', authenticate, requireFeature('bmf_advanced'), async (req, res, next) => {
  try {
    const result = await bmfService.selfTest();
    /* V289-results-fix: Service-Feld ist 'results' */
    const res_obj = result.results || result.output;
    const gebanteil = res_obj && res_obj.gebaeudeanteil_prozent;
    const ok = gebanteil && gebanteil.value >= 87.0 && gebanteil.value <= 89.0;
    res.json({
      ok,
      expected_gebaeudeanteil: 87.89,
      actual_gebaeudeanteil: gebanteil ? gebanteil.value : null,
      results: res_obj,
      api_version: 'V288',
      message: ok
        ? 'Selftest erfolgreich — LibreOffice-Recalc liefert korrekte Werte.'
        : 'WARN — gebäudeanteil weicht > 1% vom erwarteten Wert ab. Prüfung erforderlich.'
    });
  } catch (err) {
    next(err);
  }
});


/* ─────────────────────────────────────────────────────────────────
 * V290-pipeline-endpoint-applied
 *
 * POST /api/v1/bmf/pipeline
 * Vollständige BMF-Pipeline nach Konzept-Doc Phase 2-11:
 *   - Inventar-Trennung
 *   - Prognose-AK
 *   - BMF-Aufteilung (LibreOffice)
 *   - 3 Vertragsvarianten (Konservativ × 1.00, Optimiert × 0.85, Aggressiv × 0.75)
 *   - NK-Verteilung pro Variante
 *   - Finale AK pro Variante
 *   - 15-%-Grenze pro Variante
 *   - AfA-Berechnung pro Variante (Gebäude + Inventar getrennt)
 *   - Risikoampel pro Variante
 *
 * Body: { phase1_inputs: { objekt, investition, inventar, renovierung, miete, gaa } }
 * Response: { ok, phase2_inventar, phase3_prognose_ak, phase4_bmf,
 *             phase5_varianten, phase7_nk_verteilung, phase8_finale_ak,
 *             phase9_15pct, phase10_afa, phase11_risiko, meta }
 *
 * Auth: Bearer JWT + requireFeature('bmf_advanced')
 * ───────────────────────────────────────────────────────────────── */
router.post('/pipeline', authenticate, requireFeature('bmf_advanced'), async (req, res, next) => {
  try {
    const body = req.body || {};
    if (!body.phase1_inputs && !body.objekt) {
      return res.status(400).json({
        error: 'Body muss { phase1_inputs: {...} } enthalten',
        hint: 'Siehe BMF_Konzept_V290.md Kapitel 4 für Request-Format'
      });
    }

    /* v1872 · Cache vor dem Lauf */
    const prewarm = !!body.prewarm;
    /* gehasht wird genau das, was runPipeline liest (phase1_inputs oder der Body) — ohne die Vorlauf-Markierung */
    const eingaben = body.phase1_inputs || Object.assign({}, body, { prewarm: undefined });
    const hash = _bmfHash(eingaben);
    const treffer = await _cacheLesen(hash);
    if (treffer && treffer.result) {
      return res.json(Object.assign({}, treffer.result, { _cache: { hit: true, created_at: treffer.created_at, hash: hash.slice(0, 12) } }));
    }
    if (prewarm && _bmfLaufend > 0) {
      return res.status(202).json({ ok: false, queued: false, grund: 'LibreOffice rechnet gerade — Vorlauf übersprungen' });
    }
    _bmfLaufend++;
    const t0 = Date.now();
    let result;
    try { result = await bmfPipelineService.runPipeline(body); }
    finally { _bmfLaufend--; }
    const dauer = Date.now() - t0;
    if (result && result.ok !== false) await _cacheSchreiben(hash, req.user && req.user.id, eingaben, result, dauer);
    res.json(Object.assign({}, result, { _cache: { hit: false, dauer_ms: dauer, hash: hash.slice(0, 12) } }));
  } catch (err) {
    if (err && err.code === 'LIBREOFFICE_ERROR') {
      return res.status(500).json({
        error: 'LibreOffice-Berechnung fehlgeschlagen',
        detail: err.message
      });
    }
    if (err && err.code === 'TIMEOUT') {
      return res.status(504).json({
        error: 'BMF-Berechnung dauerte zu lange',
        detail: err.message
      });
    }
    if (err && err.code === 'PIPELINE_INVALID_INPUT') {
      return res.status(400).json({
        error: 'Pipeline-Input ungültig',
        detail: err.message
      });
    }
    next(err);
  }
});

/* GET /api/v1/bmf/pipeline-selftest
 * Führt Pipeline mit Sachsenstr-Beispiel aus Konzept-Doc Anhang A aus.
 * Auth: Bearer JWT + requireFeature('bmf_advanced')
 */
router.get('/pipeline-selftest', authenticate, requireFeature('bmf_advanced'), async (req, res, next) => {
  try {
    const result = await bmfPipelineService.selfTest();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
