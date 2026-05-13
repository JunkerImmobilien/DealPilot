'use strict';
/**
 * KI-Analyse-Route — server-seitiger Proxy zu OpenAI mit Web-Search.
 *
 * POST /api/v1/ai/analyze
 *   Body: { objekt: {...}, kennzahlen: {...}, finanzierung: {...} }
 *   Auth: Bearer JWT
 *   Limit: ai_analyses_monthly (Plan-Limit)
 *
 * GET /api/v1/ai/status
 *   Public — gibt zurück, ob server-seitige KI verfügbar ist (API-Key gesetzt).
 */

const express = require('express');
const config = require('../config');
const rateLimit = require('express-rate-limit');
const { authenticate } = require('../middleware/auth');
const { requireUnderLimit } = require('../middleware/planLimits');
const usageService = require('../services/usageService');
const openaiService = require('../services/openaiService');
const aiCreditsService = require('../services/aiCreditsService');  // V63.86

const router = express.Router();

// V204 SECURITY-FIX (H5): Extract-Endpoints (extract-expose, extract-market-data)
// hatten KEIN Credit-Verbrauch — User konnte unbegrenzt OpenAI-Calls auf Marcels
// Server-Key auslösen. Schutz jetzt: harter Rate-Limit pro User (nicht pro IP).
// 30 Extractions/h pro User = mehr als jeder legitime Workflow braucht.
const extractLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: function(req) {
    return req.user && req.user.id ? 'u:' + req.user.id : req.ip;
  },
  message: { error: 'Zu viele PDF-Extraktionen — bitte 1h warten oder eigenen OpenAI-Key in Settings hinterlegen.' }
});

/**
 * V63.86: GET /credits — KI-Credits-Status für eingeloggten User.
 * Wird von Frontend (Sidebar-Pill, Settings KI-Tab) gepollt.
 */
router.get('/credits', authenticate, async (req, res, next) => {
  try {
    const status = await aiCreditsService.getStatus(req.user.id);
    res.json(status);
  } catch (e) { next(e); }
});

/**
 * V63.91: POST /credits/demo-purchase — Demo-Kauf von Bonus-Credits.
 *
 * Solange Stripe noch nicht aktiv ist, kann der User über eine "Demo-Kauf"-Aktion
 * Bonus-Credits in Schritten von 5/10/25 hinzufügen. Bewusst limitiert (max 100
 * pro Aufruf, max 200 in Summe Bonus-Credits) damit niemand das ausnutzt.
 *
 * Body: { amount: 5|10|25 }
 * Response: { ok: true, status: <neuer Credit-Status>, demo: true }
 *
 * In Production wird dieser Endpoint später vom Stripe-Webhook ersetzt — die
 * Logik (addBonus) bleibt identisch.
 */
const DEMO_PACK_SIZES = [5, 10, 25];
const DEMO_MAX_BONUS_TOTAL = 200;
router.post('/credits/demo-purchase', authenticate, async (req, res, next) => {
  try {
    const amount = parseInt((req.body || {}).amount, 10);
    if (!DEMO_PACK_SIZES.includes(amount)) {
      return res.status(400).json({
        error: 'Ungültige Paketgröße. Erlaubt: ' + DEMO_PACK_SIZES.join(', ')
      });
    }
    const status = await aiCreditsService.getStatus(req.user.id);
    if (status.bonus_credits + amount > DEMO_MAX_BONUS_TOTAL) {
      return res.status(403).json({
        error: 'Demo-Limit erreicht: max. ' + DEMO_MAX_BONUS_TOTAL + ' Bonus-Credits gleichzeitig. ' +
               'Aktuell: ' + status.bonus_credits + ' Credits.'
      });
    }
    await aiCreditsService.addBonus(req.user.id, amount, 'demo:' + amount);
    const updated = await aiCreditsService.getStatus(req.user.id);
    res.json({ ok: true, demo: true, amount: amount, status: updated });
  } catch (e) { next(e); }
});

/**
 * GET /api/v1/ai/status — gibt zurück, ob server-seitige KI verfügbar ist.
 * Frontend nutzt das, um zu entscheiden, ob es den Backend-Endpoint
 * oder die alte Client-seitige KI nutzt.
 *
 * V26: 'available' = true wenn entweder Server-Key da ODER User-Keys akzeptiert werden.
 */
router.get('/status', (req, res) => {
  res.json({
    available: true,                           // Backend nimmt User-Keys an, auch ohne Server-Key
    server_key_configured: Boolean(config.openai.apiKey),
    accepts_user_key: true,
    model: config.openai.defaultModel,
    web_search: true
  });
});

/**
 * POST /api/v1/ai/analyze — Lage-Analyse mit Web-Search.
 *
 * V26: Body kann optional 'userApiKey' enthalten (vom User in den Settings gepflegt).
 * Priorität: Server-Key (.env) > User-Key (Body) > 503-Fehler.
 * User-Keys werden NICHT geloggt.
 */
router.post('/analyze', authenticate, requireUnderLimit('ai_analyses_monthly'), async (req, res, next) => {
  try {
    const payload = req.body || {};
    const userApiKey = typeof payload.userApiKey === 'string' && payload.userApiKey.startsWith('sk-')
      ? payload.userApiKey
      : null;
    // userApiKey aus dem Payload entfernen, damit es nicht an OpenAI als Teil des Prompts geht
    delete payload.userApiKey;

    if (!config.openai.apiKey && !userApiKey) {
      return res.status(503).json({
        error: 'Kein OpenAI-API-Key verfügbar.',
        message: 'Bitte einen persönlichen OpenAI-Key in den Einstellungen hinterlegen, oder den Admin bitten, einen Server-Key zu konfigurieren.',
        needs_user_key: true
      });
    }

    if (!payload.objekt && !payload.kennzahlen) {
      return res.status(400).json({ error: 'Body muss mindestens "objekt" oder "kennzahlen" enthalten.' });
    }

    // V63.86: Credits-Pre-Check — nur wenn kein eigener User-API-Key (dann zahlt User selbst)
    if (!userApiKey) {
      const status = await aiCreditsService.getStatus(req.user.id);
      if (status.total_remaining < 1) {
        return res.status(402).json({
          error: 'Keine KI-Credits mehr verfügbar.',
          message: 'Dein Monatslimit ist aufgebraucht und du hast keine Bonus-Credits. Reset am ' + status.period_reset_at + '.',
          credits: status,
          needs_credits: true
        });
      }
    }

    const result = await openaiService.analyze(payload, { userApiKey });

    // V63.86: Nach erfolgreicher Analyse Credits abziehen (nur wenn Server-Key benutzt wurde)
    if (!userApiKey) {
      try {
        await aiCreditsService.consume(req.user.id, 1, 'analyze', { model: config.openai.defaultModel });
      } catch (e) {
        console.warn('[ai/analyze] Credits consume failed:', e.message);
      }
    }

    try {
      await usageService.incrementUsage(req.user.id, 'ai_analysis');
    } catch (e) {
      console.warn('Usage tracking failed:', e.message);
    }
    res.json(result);
  } catch (err) {
    if (err.code === 'NO_API_KEY') {
      return res.status(503).json({
        error: err.message,
        needs_user_key: true
      });
    }
    if (err.status === 401) {
      return res.status(401).json({
        error: err.message,
        key_source: err.keySource,
        needs_user_key: err.keySource === 'user'
      });
    }
    if (err.status) {
      return res.status(502).json({ error: 'OpenAI-Fehler: ' + err.message });
    }
    next(err);
  }
});

/**
 * POST /api/v1/ai/lage — Lage-Bewertung (Makro + Mikro) für eine Adresse.
 * V36: Kompaktes Gimmick — kurze Bewertung mit Score je Aspekt.
 *
 * Body: { adresse: "Dresdenstraße 116, 32052 Herford", plz, ort, str, hnr }
 * Response: { makro: {score, label, text, factors[]}, mikro: {...} }
 */
router.post('/lage', authenticate, requireUnderLimit('ai_analyses_monthly'), async (req, res, next) => {
  try {
    const payload = req.body || {};
    const userApiKey = typeof payload.userApiKey === 'string' && payload.userApiKey.startsWith('sk-')
      ? payload.userApiKey
      : null;
    delete payload.userApiKey;

    // V51: Determinismus + Stil aus dem Body extrahieren
    const aiOptions = payload.aiOptions && typeof payload.aiOptions === 'object'
      ? payload.aiOptions
      : null;
    delete payload.aiOptions;

    if (!config.openai.apiKey && !userApiKey) {
      return res.status(503).json({
        error: 'Kein OpenAI-API-Key verfügbar.',
        needs_user_key: true
      });
    }
    if (!payload.adresse && !payload.ort) {
      return res.status(400).json({ error: 'Body muss "adresse" oder "ort" enthalten.' });
    }

    // V63.86: Credits-Pre-Check
    if (!userApiKey) {
      const status = await aiCreditsService.getStatus(req.user.id);
      if (status.total_remaining < 1) {
        return res.status(402).json({
          error: 'Keine KI-Credits mehr verfügbar.',
          credits: status,
          needs_credits: true
        });
      }
    }

    const result = await openaiService.analyzeLage(payload, { userApiKey, aiOptions });

    // V63.86: Credits abziehen
    if (!userApiKey) {
      try { await aiCreditsService.consume(req.user.id, 1, 'lage'); } catch (e) {}
    }

    try {
      await usageService.incrementUsage(req.user.id, 'ai_analysis');
    } catch (e) {
      console.warn('Usage tracking failed:', e.message);
    }
    res.json(result);
  } catch (err) {
    if (err.code === 'NO_API_KEY') {
      return res.status(503).json({ error: err.message, needs_user_key: true });
    }
    if (err.status === 401) {
      return res.status(401).json({
        error: err.message,
        key_source: err.keySource,
        needs_user_key: err.keySource === 'user'
      });
    }
    if (err.status) {
      return res.status(502).json({ error: 'OpenAI-Fehler: ' + err.message });
    }
    next(err);
  }
});

/**
 * V38: POST /api/v1/ai/ds2-suggest — KI-Vorschläge für Investor-Score-Felder.
 *
 * Body:
 *   fields: ["ds2_zustand", "ds2_energie", ...]   — welche Felder
 *   fieldSpecs: { fieldId: { label, values?, type, ... } }  — Enum-Optionen pro Feld
 *   context: { adresse, ort, baujahr, kaufpreis, ... }      — Objekt-Context
 *
 * Response: { suggestions: { fieldId: { value, reasoning } } }
 */
router.post('/ds2-suggest', authenticate, requireUnderLimit('ai_analyses_monthly'), async (req, res, next) => {
  try {
    const payload = req.body || {};
    const userApiKey = typeof payload.userApiKey === 'string' && payload.userApiKey.startsWith('sk-')
      ? payload.userApiKey
      : null;
    delete payload.userApiKey;

    // V51: Determinismus + Stil
    const aiOptions = payload.aiOptions && typeof payload.aiOptions === 'object'
      ? payload.aiOptions
      : null;
    delete payload.aiOptions;

    if (!config.openai.apiKey && !userApiKey) {
      return res.status(503).json({
        error: 'Kein OpenAI-API-Key verfügbar.',
        needs_user_key: true
      });
    }

    if (!Array.isArray(payload.fields) || payload.fields.length === 0) {
      return res.status(400).json({ error: 'Body muss "fields" als Array enthalten.' });
    }
    if (!payload.context || (!payload.context.ort && !payload.context.adresse)) {
      return res.status(400).json({ error: 'Body muss "context.ort" oder "context.adresse" enthalten.' });
    }

    // V63.86: Credits-Check (DS2-Suggest = halber Credit, mindestens 1)
    if (!userApiKey) {
      const status = await aiCreditsService.getStatus(req.user.id);
      if (status.total_remaining < 1) {
        return res.status(402).json({ error: 'Keine KI-Credits mehr verfügbar.', credits: status, needs_credits: true });
      }
    }

    const result = await openaiService.suggestDs2Fields(payload, { userApiKey, aiOptions });

    if (!userApiKey) {
      try { await aiCreditsService.consume(req.user.id, 1, 'ds2-suggest'); } catch (e) {}
    }
    try {
      await usageService.incrementUsage(req.user.id, 'ai_analysis');
    } catch (e) {
      console.warn('Usage tracking failed:', e.message);
    }
    res.json(result);
  } catch (err) {
    if (err.code === 'NO_API_KEY') {
      return res.status(503).json({ error: err.message, needs_user_key: true });
    }
    if (err.status === 401) {
      return res.status(401).json({ error: err.message, needs_user_key: err.keySource === 'user' });
    }
    if (err.status) {
      return res.status(502).json({ error: 'OpenAI-Fehler: ' + err.message });
    }
    next(err);
  }
});

/**
 * V38: POST /api/v1/ai/extract-expose — Strukturdaten aus Exposé-Text extrahieren.
 * V63.91: KEIN requireUnderLimit/Credit-Verbrauch mehr — Datenextraktion ist
 *         ein Hilfsschritt vor der Investitionsanalyse, nicht die Analyse selbst.
 *         User soll sein Objekt importieren können auch ohne KI-Credits.
 *         Marcels Bug: Extract scheiterte weil ai_analyses_monthly aufgebraucht war.
 *
 * Body:
 *   text: string (PDF-extrahierter Text, max ~12k Zeichen)
 *
 * Response: { extracted: { adresse, plz, ort, kaufpreis, wohnflaeche, baujahr, ... } }
 */
router.post('/extract-expose', authenticate, extractLimiter, async (req, res, next) => {
  try {
    const { text, userApiKey: rawUserKey } = req.body || {};
    const userApiKey = typeof rawUserKey === 'string' && rawUserKey.startsWith('sk-') ? rawUserKey : null;

    if (!config.openai.apiKey && !userApiKey) {
      return res.status(503).json({ error: 'Kein OpenAI-API-Key verfügbar.', needs_user_key: true });
    }
    if (!text || typeof text !== 'string' || text.length < 50) {
      return res.status(400).json({ error: 'Body muss "text" enthalten (mindestens 50 Zeichen).' });
    }

    const result = await openaiService.extractExpose(text, { userApiKey });
    // V63.91: kein consume()-Call mehr — Extraktion zählt nicht als KI-Analyse.
    // Wir loggen es aber als "extract" damit Marcel im Admin sehen kann was läuft.
    try {
      if (aiCreditsService && typeof aiCreditsService.logExtract === 'function') {
        await aiCreditsService.logExtract(req.user.id, 'extract-expose');
      }
    } catch (e) { /* nicht kritisch */ }
    res.json(result);
  } catch (err) {
    if (err.code === 'NO_API_KEY') return res.status(503).json({ error: err.message, needs_user_key: true });
    if (err.status === 401) return res.status(401).json({ error: err.message });
    if (err.status) return res.status(502).json({ error: 'OpenAI-Fehler: ' + err.message });
    next(err);
  }
});

/**
 * V63.91: POST /api/v1/ai/extract-market-data
 * Extrahiert Marktwert/Verkehrswert + Lage-Scores aus einem PDF-Marktbericht
 * (PriceHubble, Sprengnetter, Maklergutachten). Wird im Tab Objekt durch einen
 * "Marktbericht-PDF importieren"-Button getriggert.
 *
 * Wie extract-expose: kein Credit-Verbrauch (Datenextraktion ≠ Analyse).
 */
router.post('/extract-market-data', authenticate, extractLimiter, async (req, res, next) => {
  try {
    const { text, userApiKey: rawUserKey } = req.body || {};
    const userApiKey = typeof rawUserKey === 'string' && rawUserKey.startsWith('sk-') ? rawUserKey : null;

    if (!config.openai.apiKey && !userApiKey) {
      return res.status(503).json({ error: 'Kein OpenAI-API-Key verfügbar.', needs_user_key: true });
    }
    if (!text || typeof text !== 'string' || text.length < 50) {
      return res.status(400).json({ error: 'Body muss "text" enthalten (mindestens 50 Zeichen).' });
    }

    const result = await openaiService.extractMarketData(text, { userApiKey });
    try {
      if (aiCreditsService && typeof aiCreditsService.logExtract === 'function') {
        await aiCreditsService.logExtract(req.user.id, 'extract-market-data');
      }
    } catch (e) { /* nicht kritisch */ }
    res.json(result);
  } catch (err) {
    if (err.code === 'NO_API_KEY') return res.status(503).json({ error: err.message, needs_user_key: true });
    if (err.status === 401) return res.status(401).json({ error: err.message });
    if (err.status) return res.status(502).json({ error: 'OpenAI-Fehler: ' + err.message });
    next(err);
  }
});

/**
 * V39: POST /api/v1/ai/qc-suggest — KI-Vorschläge für Quick Check Felder.
 *
 * Body:
 *   group: 'rent' | 'mgmt' | 'finance'
 *   context: { adresse, ort, kaufpreis, wohnflaeche, baujahr }
 *
 * Response: { suggestions: { fieldName: { value, source, reasoning } } }
 */
router.post('/qc-suggest', authenticate, requireUnderLimit('ai_analyses_monthly'), async (req, res, next) => {
  try {
    const { group, context, userApiKey: rawUserKey } = req.body || {};
    const userApiKey = typeof rawUserKey === 'string' && rawUserKey.startsWith('sk-') ? rawUserKey : null;

    if (!config.openai.apiKey && !userApiKey) {
      return res.status(503).json({ error: 'Kein OpenAI-API-Key verfügbar.', needs_user_key: true });
    }
    if (!group || !['rent', 'mgmt', 'finance'].includes(group)) {
      return res.status(400).json({ error: 'group muss "rent", "mgmt" oder "finance" sein.' });
    }
    if (!context || (!context.ort && !context.adresse)) {
      return res.status(400).json({ error: 'context.ort oder context.adresse erforderlich.' });
    }

    const result = await openaiService.suggestQcFields(group, context, { userApiKey });
    try { await usageService.incrementUsage(req.user.id, 'ai_analysis'); } catch (e) {}
    res.json(result);
  } catch (err) {
    if (err.code === 'NO_API_KEY') return res.status(503).json({ error: err.message, needs_user_key: true });
    if (err.status === 401) return res.status(401).json({ error: err.message });
    if (err.status) return res.status(502).json({ error: 'OpenAI-Fehler: ' + err.message });
    next(err);
  }
});

module.exports = router;
