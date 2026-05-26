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

    const result = await bmfService.calculateKpa(inputs, { includeFile });

    res.json({
      ok: true,
      output: result.output,
      warnings: result.warnings || [],
      file_base64: includeFile ? result.file_base64 : undefined,
      file_name: includeFile ? 'BMF_Aufteilung_' + Date.now() + '.xlsx' : undefined
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
    const gebanteil = result.output && result.output.gebaeudeanteil_prozent;
    const ok = gebanteil && gebanteil.value >= 87.0 && gebanteil.value <= 89.0;
    res.json({
      ok,
      expected_gebaeudeanteil: 87.89,
      actual_gebaeudeanteil: gebanteil ? gebanteil.value : null,
      output: result.output,
      api_version: 'V288',
      message: ok
        ? 'Selftest erfolgreich — LibreOffice-Recalc liefert korrekte Werte.'
        : 'WARN — gebäudeanteil weicht > 1% vom erwarteten Wert ab. Prüfung erforderlich.'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
