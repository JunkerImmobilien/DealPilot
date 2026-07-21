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
const plzValidator = require('../services/plzValidator');  // V229: PLZ-Halluzinationsschutz
const voiceExtractService = require('../services/voiceExtractService');  // v503-voice

/* v947-mbsource
 * ──────────────────────────────────────────────────────────────────────────
 * Die Pilot-Analyse sah den Marktbericht bisher NICHT. payload.marktbewertung
 * trug genau zwei handgetippte Formularfelder (svwert, ds2_marktmiete) — keine
 * Vergleichsbasis, keine Spanne, keine Konfidenz, keine Historie.
 * Hier holen wir den echten Stand aus dem mb-Backend. Same-Origin-Netz, der
 * Browser ist daran nicht beteiligt.
 * user_id kommt IMMER aus req.user.id, nie aus dem Body -> ein Nutzer kann sich
 * keine fremden Berichte in seinen Prompt holen (User-Bindung v942).
 */
const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');

async function _mbHistoryFor(userId, ref) {
  if (!ref || !userId) return null;
  try {
    const url = MB_BASE + '/objects/history?user_id=' + encodeURIComponent(userId) +
                '&ref=' + encodeURIComponent(ref);
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const h = (j && j.history) || [];
    const reps = h.filter(function (x) { return x && x.report_id != null; })
                  .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    if (!reps.length) return null;
    const last = reps[reps.length - 1];
    return {
      anzahl: reps.length,
      aktuell: last,
      verlauf: reps.map(function (x) {
        return {
          datum: x.created_at,
          marktwert: x.market_value != null ? Number(x.market_value) : null,
          deal_score: x.deal_score != null ? Number(x.deal_score) : null,
        };
      }),
    };
  } catch (e) {
    console.warn('[ai] Marktbericht-Lookup fehlgeschlagen:', e.message);
    return null;   /* Der Bericht ist Kuer — er darf die Analyse nie blockieren. */
  }
}

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
router.post('/analyze', authenticate, plzValidator.middleware, /* V229: PLZ-Halluzinationsschutz */ /* V186: kein requireUnderLimit, AI-Credits ist Wahrheit */ async (req, res, next) => {
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

    // v493-limits: 1 Liter = 1 KI-Analyse (Feature-Matrix 05.06.)
    if (!userApiKey) {
      const status = await aiCreditsService.getStatus(req.user.id);
      if (status.total_remaining < 1) {
        return res.status(402).json({
          error: 'Nicht genug Kerosin im Tank.',
          message: 'Dein Tank ist leer. Monatskontingent-Reset am ' + status.period_reset_at + ' — oder jetzt Kerosin tanken.',
          credits: status,
          required: 1,
          needs_credits: true
        });
      }
    }

    /* v947-mbsource: Marktbericht anhaengen, BEVOR der Prompt gebaut wird.
     * objId kommt vom Client, user_id NICHT — die kommt aus dem Token. */
    try {
      const _mb = await _mbHistoryFor(req.user.id, payload.objId);
      if (_mb) payload.marktbericht = _mb;
    } catch (e) { console.warn('[ai] marktbericht attach:', e.message); }
    delete payload.objId;   /* gehoert nicht in den Prompt */

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
router.post('/lage', authenticate, plzValidator.middleware, /* V229: PLZ-Halluzinationsschutz */ /* V186: kein requireUnderLimit, AI-Credits ist Wahrheit */ async (req, res, next) => {
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
          error: 'Nicht genug Kerosin im Tank.',
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
router.post('/ds2-suggest', authenticate, /* V186: kein requireUnderLimit, AI-Credits ist Wahrheit */ async (req, res, next) => {
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
        return res.status(402).json({ error: 'Nicht genug Kerosin im Tank.', credits: status, needs_credits: true });
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
 * v503-voice: POST /api/v1/ai/extract-voice — Sprachaufzeichnung auswerten.
 * Body: { audio: base64 (ohne data:-Prefix), mime: 'audio/webm'|...,
 *         catalog: [{id, kind, label, hint?, options?:[{v,t}]}], userApiKey? }
 * Ablauf: Transkription (OpenAI Audio) -> Feld-Extraktion gegen den vom
 * Frontend mitgelieferten Laufzeit-Katalog (alle Tabs, Selects mit echten
 * Optionen -> KI brueckt freie Formulierungen auf Optionswerte).
 * Response: { transcript, fields: {feldId: wert}, unsicher: [feldId] }
 *
 * KEROSIN: 1 Liter pro Auswertung (Muster wie /analyze, v493-limits:
 * 1 Liter = 1 KI-Analyse). Pre-Check + consume nur bei Server-Key.
 * Zusaetzlich extractLimiter (30/h) + Groessenlimit (~10 min Audio).
 */
/* v536-transcribe-chunk: Live-Mitschrift aus MediaRecorder-Haeppchen (Web-Audio liefert
 * auf manchen Geraeten Stille -> Realtime-WS unbrauchbar). Nur Transkription, KEIN
 * Kerosin, KEINE Feld-Extraktion. Eigener grosszuegiger Limiter (4s-Takt). */
const liveTranscribeLimiter = rateLimit({ windowMs: 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });
router.post('/transcribe-chunk', authenticate, liveTranscribeLimiter, async (req, res, next) => {
  try {
    const { audio, mime, userApiKey: rawUserKey } = req.body || {};
    const userApiKey = typeof rawUserKey === 'string' && rawUserKey.startsWith('sk-') ? rawUserKey : null;
    const apiKey = userApiKey || config.openai.apiKey;
    if (!apiKey) return res.status(503).json({ error: 'Kein OpenAI-API-Key verfuegbar.' });
    if (!audio || typeof audio !== 'string' || audio.length < 500) {
      return res.json({ text: '' });  /* zu kurz -> leer, kein Fehler */
    }
    if (audio.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'Live-Chunk zu gross.' });
    }
    let buf;
    try { buf = Buffer.from(audio, 'base64'); } catch (e) { return res.json({ text: '' }); }
    let text = '';
    try { text = await voiceExtractService.transcribe(buf, mime || 'audio/webm', apiKey); }
    catch (e) { return res.json({ text: '', warn: (e && e.message) || 'transcribe failed' }); }
    return res.json({ text: text || '' });
  } catch (err) { next(err); }
});

router.post('/extract-voice', authenticate, extractLimiter, async (req, res, next) => {
  try {
    const { audio, mime, catalog, userApiKey: rawUserKey } = req.body || {};
    const userApiKey = typeof rawUserKey === 'string' && rawUserKey.startsWith('sk-') ? rawUserKey : null;

    if (!config.openai.apiKey && !userApiKey) {
      return res.status(503).json({ error: 'Kein OpenAI-API-Key verfuegbar.', needs_user_key: true });
    }
    if (!audio || typeof audio !== 'string' || audio.length < 2000) {
      return res.status(400).json({ error: 'Body muss "audio" (base64) enthalten.' });
    }
    if (audio.length > 26 * 1024 * 1024) {
      return res.status(413).json({ error: 'Aufnahme zu gross (max ca. 10 Minuten).' });
    }

    // Kerosin-Pre-Check (nur Server-Key) — Muster /analyze
    if (!userApiKey) {
      const status = await aiCreditsService.getStatus(req.user.id);
      if (status.total_remaining < 1) {
        return res.status(402).json({
          error: 'Nicht genug Kerosin im Tank.',
          credits: status,
          required: 1,
          needs_credits: true
        });
      }
    }

    const result = await voiceExtractService.extractFromAudio(audio, mime, catalog, {
      apiKey: config.openai.apiKey,
      userApiKey: userApiKey
    });

    // Kerosin abziehen (nur Server-Key), erst NACH erfolgreicher Auswertung
    if (!userApiKey) {
      try {
        await aiCreditsService.consume(req.user.id, 1, 'extract-voice');
      } catch (e) {
        console.warn('[ai/extract-voice] Credits consume failed:', e.message);
      }
    }
    try {
      if (aiCreditsService && typeof aiCreditsService.logExtract === 'function') {
        await aiCreditsService.logExtract(req.user.id, 'extract-voice');
      }
    } catch (e) { /* nicht kritisch */ }
    res.json(result);
  } catch (err) {
    if (err.code === 'NO_API_KEY') return res.status(503).json({ error: err.message, needs_user_key: true });
    if (err.status === 401) return res.status(401).json({ error: err.message });
    if (err.status) return res.status(err.status >= 500 ? 502 : err.status).json({ error: err.message });
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
/* v513-voice: Live-Zwischenauswertung waehrend des Sprechens.
 * Transkript-Text rein -> Array erkannter Feld-ids raus (keine Werte).
 * KEIN Kerosin-Consume (Eigenkosten), nur Server-Key, eigener Limiter,
 * fail-soft: liefert im Zweifel { ids: [] } statt zu fehlern. */
const quickMatchLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 240, standardHeaders: true, legacyHeaders: false });
router.post('/voice-quickmatch', authenticate, quickMatchLimiter, async (req, res) => {
  try {
    const { transcript, catalog } = req.body || {};
    if (!config.openai.apiKey) return res.json({ ids: [] });  // nur Server-Key
    if (!transcript || typeof transcript !== 'string' || transcript.length < 3) return res.json({ ids: [] });
    const out = await voiceExtractService.quickMatch(transcript.slice(0, 8000), catalog, config.openai.apiKey);
    res.json({ ids: (out && out.ids) || [] });
  } catch (err) {
    res.json({ ids: [] });  // Live-Hilfe darf nie hart fehlschlagen
  }
});

router.post('/qc-suggest', authenticate, plzValidator.middleware, /* V229: PLZ-Halluzinationsschutz */ /* V186: kein requireUnderLimit, AI-Credits ist Wahrheit */ async (req, res, next) => {
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





/**
 * V187 Hotfix: POST /ai/bodenrichtwert
 * Schätzt den Bodenrichtwert anhand der Adresse via OpenAI.
 * Body: { str?, plz, ort, userApiKey? }
 * Returns: { value: number, confidence: 'niedrig'|'mittel'|'hoch', reasoning: string }
 *
 * Implementiert wie /lage: nutzt openaiService.callOpenAI() als rohen Call
 * mit eigenem Prompt + JSON-Response-Parsing.
 */
router.post('/bodenrichtwert', authenticate, plzValidator.middleware, /* V229: PLZ-Halluzinationsschutz */ async (req, res, next) => {
  try {
    const payload = req.body || {};
    const userApiKey = typeof payload.userApiKey === 'string' && payload.userApiKey.startsWith('sk-')
      ? payload.userApiKey
      : null;

    if (!config.openai.apiKey && !userApiKey) {
      return res.status(503).json({
        error: 'Kein OpenAI-API-Key verfügbar.',
        needs_user_key: true
      });
    }
    if (!payload.plz || !payload.ort) {
      return res.status(400).json({ error: 'plz und ort sind erforderlich' });
    }

    // Credit-Pre-Check (nur wenn Server-Key)
    if (!userApiKey) {
      const status = await aiCreditsService.getStatus(req.user.id);
      if (status.total_remaining < 1) {
        return res.status(402).json({
          error: 'Nicht genug Kerosin im Tank.',
          credits: status,
          needs_credits: true
        });
      }
    }

    // Adresse zusammenbauen
    const address = [payload.str, payload.plz, payload.ort].filter(Boolean).join(', ');

    // V187-h3: Prompt OHNE konkretes Zahlen-Beispiel (vermeidet Few-Shot-Bias auf 250)
    // Web-Search ist ueber callOpenAI/Responses-API standardmaessig aktiv (web_search_preview tool)
    const hasStreet = !!(payload.str && String(payload.str).trim());
    const addressInfo = hasStreet 
      ? 'Strasse + PLZ + Ort vorhanden'
      : 'NUR PLZ + Ort (keine Strasse) - schaetze den durchschnittlichen Bodenrichtwert fuer das PLZ-Gebiet';

    const prompt = [
      'Du bist Sachverstaendiger fuer Immobilienbewertung in Deutschland und kennst die BORIS-Portale aller Bundeslaender.',
      '',
      'AUFGABE: Recherchiere mit der Web-Suche den AKTUELLEN Bodenrichtwert fuer:',
      '  Adresse: ' + address,
      '  Datenlage: ' + addressInfo,
      '',
      'VORGEHEN:',
      '1. Suche im Web nach dem zustaendigen BORIS-Portal des Bundeslandes / der Stadt.',
      '2. Suche nach typischen Bodenrichtwerten fuer diese PLZ / diesen Stadtteil.',
      '3. Beruecksichtige Wohnbauflaeche (W) vs Mischgebiet (M) - wir bewerten Wohnen.',
      '4. Nimm wenn moeglich das aktuelle BORIS-Datum.',
      '',
      'WICHTIGE REGELN:',
      '- Erfinde KEINE Werte. Wenn die Recherche keine belastbare Quelle ergibt: confidence = niedrig und value = best-guess basierend auf Region.',
      '- Realistische Bandbreiten Deutschland (Wohnen):',
      '    laendlich        20 - 80 EUR/m^2',
      '    Kleinstadt       80 - 250 EUR/m^2',
      '    Mittelstadt     200 - 600 EUR/m^2',
      '    Grossstadt      400 - 2000 EUR/m^2',
      '    Top-Lagen (Muenchen / Frankfurt / Hamburg / Berlin Mitte) 2000 - 10000+ EUR/m^2',
      '- Die Zahl im value-Feld MUSS zur konkreten Region passen. Beispiel: 250 EUR/m^2 sind FALSCH fuer Muenchen-Innenstadt und FALSCH fuer ein Dorf in Mecklenburg.',
      '- confidence hoch = echte BORIS-Quelle gefunden.',
      '- confidence mittel = Vergleichswerte fuer das Gebiet, aber keine exakte BORIS-Karte.',
      '- confidence niedrig = nur Schaetzung aus Bundesland-Durchschnitt.',
      '',
      'OUTPUT-FORMAT (NUR dieses JSON, keine Markdown-Backticks, kein Drumherum):',
      '{',
      '  "value": <Zahl_EUR_pro_m2>,',
      '  "confidence": "niedrig" | "mittel" | "hoch",',
      '  "reasoning": "<konkrete_Begruendung_mit_Quelle_und_Region_max_150_Zeichen>",',
      '  "source_url": "<BORIS_URL_falls_gefunden_sonst_leer>"',
      '}',
      '',
      'KRITISCH: Die Zahl im value-Feld MUSS aus deiner Web-Recherche stammen und regional plausibel sein. NICHT die Platzhalter-Schreibweise wiederholen.'
    ].join('\n');

    // OpenAI-Call mit Web-Search (callOpenAI nutzt Responses-API mit web_search_preview standardmaessig)
    const raw = await openaiService.callOpenAI(prompt, {
      userApiKey: userApiKey,
      aiOptions: { temperature: 0.3 }
    });

    // Response parsen (kann String mit Markdown sein)
    let parsed = null;
    let rawText = '';
    try {
      // callOpenAI kann String oder Object zurückgeben — robust extrahieren
      if (typeof raw === 'string') {
        rawText = raw;
      } else if (raw && typeof raw.text === 'string') {
        rawText = raw.text;
      } else if (raw && typeof raw.output_text === 'string') {
        rawText = raw.output_text;
      } else if (raw && typeof raw.content === 'string') {
        rawText = raw.content;
      } else if (raw && raw.choices && raw.choices[0] && raw.choices[0].message) {
        rawText = raw.choices[0].message.content || '';
      } else if (raw && Array.isArray(raw.output)) {
        try {
          for (const blk of raw.output) {
            if (blk.content && Array.isArray(blk.content)) {
              for (const it of blk.content) {
                if (typeof it.text === 'string') { rawText += it.text; }
              }
            }
          }
        } catch (e) { rawText = JSON.stringify(raw); }
      } else {
        rawText = JSON.stringify(raw);
      }
      console.log('[ai/bodenrichtwert] Raw-Text length:', rawText.length, 'preview:', rawText.substring(0, 300));
      if (rawText) {
        parsed = openaiService.extractJson(rawText);
      }
    } catch (e) {
      console.warn('[ai/bodenrichtwert] JSON-Parse failed:', e.message, '— rawText len:', rawText.length);
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.status(502).json({
        error: 'KI-Antwort konnte nicht als JSON gelesen werden.',
        raw: rawText ? rawText.substring(0, 500) : 'leer',
        rawType: typeof raw,
        rawKeys: (raw && typeof raw === 'object') ? Object.keys(raw).slice(0, 10) : null
      });
    }

    const value = parseFloat(parsed.value);
    const confidence = ['niedrig', 'mittel', 'hoch'].includes(parsed.confidence)
      ? parsed.confidence
      : 'niedrig';
    const reasoning = String(parsed.reasoning || '').substring(0, 200);

    if (isNaN(value) || value <= 0) {
      return res.json({
        value: 0,
        confidence: 'niedrig',
        reasoning: reasoning || 'Keine sinnvolle Schaetzung moeglich.',
        source: 'openai'
      });
    }

    // Credits verbrauchen (nur wenn Server-Key)
    if (!userApiKey) {
      try {
        await aiCreditsService.consume(req.user.id, 1, 'bodenrichtwert');
      } catch (e) {
        console.warn('[ai/bodenrichtwert] Credits consume failed:', e.message);
      }
    }

    try { await usageService.incrementUsage(req.user.id, 'ai_analysis'); } catch (e) {}

    res.json({
      value: Math.round(value),
      confidence: confidence,
      reasoning: reasoning,
      source: 'openai-' + (config.openai.defaultModel || 'gpt-4o-mini')
    });
  } catch (err) {
    if (err.code === 'NO_API_KEY') {
      return res.status(503).json({ error: 'OpenAI-API-Key nicht konfiguriert.' });
    }
    if (err.status === 401) {
      return res.status(401).json({
        error: err.message || 'OpenAI-Authentifizierung fehlgeschlagen.',
        keySource: err.keySource || 'server'
      });
    }
    next(err);
  }
});

/* V288-bmf-gaa-applied */
/**
 * V288: POST /ai/bmf-gaa
 * Schätzt 4 GAA-Werte (Gutachterausschuss-Werte) für BMF-Kaufpreisaufteilung
 * via OpenAI in EINEM Call:
 *   - brw                  (Bodenrichtwert in €/m²)
 *   - vergleichsmiete_range (Vergleichsmiete in €/m²/Monat, Range low/high)
 *   - liegenschaftszins    (in %)
 *   - sachwertfaktor       (Faktor, einheitslos)
 *   - vergleichsfaktor?    (optional, einheitslos)
 *
 * Body: { str?, plz, ort, baujahr, grundstuecksart?, wohnflaeche?, userApiKey? }
 * Auth: Bearer JWT
 * Credits: 1 (analog /bodenrichtwert)
 */
router.post('/bmf-gaa', authenticate, plzValidator.middleware, async (req, res, next) => {
  try {
    const payload = req.body || {};
    const userApiKey = typeof payload.userApiKey === 'string' && payload.userApiKey.startsWith('sk-')
      ? payload.userApiKey
      : null;

    if (!config.openai.apiKey && !userApiKey) {
      return res.status(503).json({
        error: 'Kein OpenAI-API-Key verfügbar.',
        needs_user_key: true
      });
    }
    if (!payload.plz || !payload.ort) {
      return res.status(400).json({ error: 'plz und ort sind erforderlich' });
    }

    // Credit-Pre-Check (nur wenn Server-Key)
    if (!userApiKey) {
      const status = await aiCreditsService.getStatus(req.user.id);
      if (status.total_remaining < 1) {
        return res.status(402).json({
          error: 'Nicht genug Kerosin im Tank.',
          credits: status,
          needs_credits: true
        });
      }
    }

    // Adresse + Kontext zusammenbauen
    const address = [payload.str, payload.plz, payload.ort].filter(Boolean).join(', ');
    const baujahr = parseInt(payload.baujahr) || null;
    const grundstuecksart = payload.grundstuecksart || 'Wohnimmobilie';
    const wfl = parseFloat(payload.wohnflaeche) || null;

    const prompt = [
      'Du bist Gutachter-Experte für deutsche Immobilien-Bewertung nach BMF-Arbeitshilfe (Fassung Juni 2023).',
      'Schätze für diese Immobilie die 4 wichtigsten GAA-Werte (Gutachterausschuss-Werte):',
      '',
      'Adresse: ' + address,
      'Baujahr: ' + (baujahr || '(unbekannt)'),
      'Grundstücksart: ' + grundstuecksart,
      'Wohnfläche: ' + (wfl ? wfl + ' m²' : '(unbekannt)'),
      '',
      'GESUCHTE WERTE:',
      '1) brw — Bodenrichtwert in €/m² Grundstücksfläche (von BORIS-D/Gutachterausschuss)',
      '2) vergleichsmiete_range — Vergleichsmiete (ortsüblich, kalt) in €/m²/Monat',
      '     · low: niedriges Quartil',
      '     · high: hohes Quartil',
      '3) liegenschaftszins — Liegenschaftszinssatz in % (typisch 3-7% für Wohnimmobilien)',
      '4) sachwertfaktor — Sachwertfaktor (typisch 0.6-1.4, abhängig vom Markt)',
      '',
      'OPTIONAL: vergleichsfaktor (Vergleichswert-Marktanpassungsfaktor, falls Daten existieren)',
      '',
      'Antworte AUSSCHLIESSLICH als JSON mit dieser Struktur:',
      '{',
      '  "brw": <number>,',
      '  "vergleichsmiete_range": { "low": <number>, "high": <number> },',
      '  "liegenschaftszins": <number>,',
      '  "sachwertfaktor": <number>,',
      '  "vergleichsfaktor": <number|null>,',
      '  "confidence": "niedrig"|"mittel"|"hoch",',
      '  "reasoning": "<kurze Begründung, max 300 Zeichen, welche Quellen/Vergleiche>"',
      '}',
      '',
      'Wichtig: Wenn keine belastbaren Daten vorliegen, gib confidence="niedrig" zurück.',
      'Niemals raten oder halluzinieren — bei Unsicherheit konservative Werte.'
    ].join('\n');

    let raw;
    try {
      raw = await openaiService.callOpenAI(prompt, {
        userApiKey,
        temperature: 0.1,
        maxTokens: 600,
        responseFormat: { type: 'json_object' }
      });
    } catch (oaErr) {
      console.warn('[ai/bmf-gaa] OpenAI call failed:', oaErr.message);
      return res.status(502).json({
        error: 'OpenAI-Aufruf fehlgeschlagen',
        detail: oaErr.message
      });
    }

    let rawText = '';
    let parsed = null;
    try {
      if (raw && typeof raw === 'object' && typeof raw.content === 'string') {
        rawText = raw.content;
      } else if (typeof raw === 'string') {
        rawText = raw;
      } else {
        rawText = JSON.stringify(raw);
      }
      console.log('[ai/bmf-gaa] Raw-Text length:', rawText.length, 'preview:', rawText.substring(0, 300));
      if (rawText) {
        parsed = openaiService.extractJson(rawText);
      }
    } catch (e) {
      console.warn('[ai/bmf-gaa] JSON-Parse failed:', e.message);
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.status(502).json({
        error: 'KI-Antwort konnte nicht als JSON gelesen werden.',
        raw: rawText ? rawText.substring(0, 500) : 'leer'
      });
    }

    // Validierung der Werte
    const brw = parseFloat(parsed.brw);
    const liegZ = parseFloat(parsed.liegenschaftszins);
    const sachF = parseFloat(parsed.sachwertfaktor);
    const vergF = parsed.vergleichsfaktor != null ? parseFloat(parsed.vergleichsfaktor) : null;

    let vmRange = null;
    if (parsed.vergleichsmiete_range && typeof parsed.vergleichsmiete_range === 'object') {
      const lo = parseFloat(parsed.vergleichsmiete_range.low);
      const hi = parseFloat(parsed.vergleichsmiete_range.high);
      if (!isNaN(lo) && !isNaN(hi) && lo > 0 && hi >= lo) {
        vmRange = { low: lo, high: hi };
      }
    }

    const confidence = ['niedrig', 'mittel', 'hoch'].includes(parsed.confidence)
      ? parsed.confidence
      : 'niedrig';
    const reasoning = String(parsed.reasoning || '').substring(0, 300);

    // Sanity-Checks auf realistische Bereiche
    const warnings = [];
    if (isNaN(brw) || brw <= 0 || brw > 50000) warnings.push('brw außerhalb plausibler Bereich');
    if (isNaN(liegZ) || liegZ < 0.5 || liegZ > 15) warnings.push('liegenschaftszins außerhalb plausibler Bereich');
    if (isNaN(sachF) || sachF < 0.2 || sachF > 3.0) warnings.push('sachwertfaktor außerhalb plausibler Bereich');

    // Credits verbrauchen (nur wenn Server-Key + erfolgreich)
    if (!userApiKey) {
      try {
        await aiCreditsService.consume(req.user.id, 1, 'bmf-gaa');
      } catch (e) {
        console.warn('[ai/bmf-gaa] credit-deduct failed:', e.message);
      }
    }

    res.json({
      brw: isNaN(brw) ? null : brw,
      vergleichsmiete_range: vmRange,
      liegenschaftszins: isNaN(liegZ) ? null : liegZ,
      sachwertfaktor: isNaN(sachF) ? null : sachF,
      vergleichsfaktor: vergF != null && !isNaN(vergF) ? vergF : null,
      confidence,
      reasoning: reasoning || 'Keine ausreichenden Daten für belastbare Schätzung.',
      warnings,
      source: 'openai',
      address
    });
  } catch (err) {
    next(err);
  }
});

/**
 * v361-enrich-market-fields: POST /api/v1/ai/enrich-market-fields
 * Ermittelt fehlende Lage-Felder nach Marktbericht-Import. Bekommt den PDF-Text +
 * Liste fehlender Felder. Leitet zuerst aus dem Bericht ab, sonst web_search.
 * Pro Feld: { value, herkunft: 'kontext'|'kontext+ki', text }.
 * Kostet 1 Credit pro Aufruf (egal wie viele Felder).
 */
router.post('/enrich-market-fields', authenticate, extractLimiter, async (req, res, next) => {
  try {
    const { text, fields, context, userApiKey: rawUserKey } = req.body || {};
    const userApiKey = typeof rawUserKey === 'string' && rawUserKey.startsWith('sk-') ? rawUserKey : null;

    if (!config.openai.apiKey && !userApiKey) {
      return res.status(503).json({ error: 'Kein OpenAI-API-Key verfuegbar.', needs_user_key: true });
    }
    if (!text || typeof text !== 'string' || text.length < 50) {
      return res.status(400).json({ error: 'Body muss "text" enthalten (mindestens 50 Zeichen).' });
    }
    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({ error: 'Body muss "fields" als nicht-leeres Array enthalten.' });
    }

    // Credit-Check (1 Credit pro Aufruf) — nur bei Server-Key
    if (!userApiKey) {
      const status = await aiCreditsService.getStatus(req.user.id);
      if (status.total_remaining < 1) {
        return res.status(402).json({ error: 'Nicht genug Kerosin im Tank.', credits: status, needs_credits: true });
      }
    }

    const result = await openaiService.enrichMarketFields(text, fields, context || {}, { userApiKey });

    if (!userApiKey) {
      try { await aiCreditsService.consume(req.user.id, 1, 'enrich-market-fields'); } catch (e) {}
    }
    try { await usageService.incrementUsage(req.user.id, 'ai_analysis'); } catch (e) {}
    res.json(result);
  } catch (err) {
    if (err.code === 'NO_API_KEY') return res.status(503).json({ error: err.message, needs_user_key: true });
    if (err.status === 401) return res.status(401).json({ error: err.message, needs_user_key: err.keySource === 'user' });
    if (err.status) return res.status(502).json({ error: 'OpenAI-Fehler: ' + err.message });
    next(err);
  }
});

/* v585-copilot-route BEGIN */
/* v588-copilot-tiering */
/**
 * POST /api/v1/ai/copilot — Co-Pilot Chat. KEIN Kerosin, plan-basiertes Tageslimit.
 * Tier aus dem bekannten Monatslimit abgeleitet (aiCreditsService.getStatus ist Wahrheit):
 *   monthly_limit 2->free(10) 10->starter(50) 40->investor(150) 100->pro(300)
 * Body: { message, history:[{role,content}], context:{...}, allowWeb:bool, userApiKey? }
 */
const COPILOT_PLAN_LIMITS = { free: 10, starter: 50, investor: 150, pro: 300 };
const _COPILOT_BY_MONTHLY = { 2: 10, 10: 50, 40: 150, 100: 300 };
const _cpDaily = new Map(); // key: userId:YYYY-MM-DD -> count
function _cpKey(uid) { return uid + ':' + new Date().toISOString().slice(0, 10); }
async function _copilotLimit(uid) {
  try {
    const st = await aiCreditsService.getStatus(uid);
    return _COPILOT_BY_MONTHLY[st && st.monthly_limit] || COPILOT_PLAN_LIMITS.free;
  } catch (e) { return COPILOT_PLAN_LIMITS.free; }
}
router.post('/copilot', authenticate, async (req, res, next) => {
  try {
    const uid = req.user && req.user.id;
    const limit = await _copilotLimit(uid);
    const key = _cpKey(uid);
    const used = _cpDaily.get(key) || 0;
    if (used >= limit) {
      return res.status(429).json({ error: 'copilot_rate_limited', message: 'Co-Pilot-Tageslimit erreicht (' + limit + '/Tag). Morgen wieder verfuegbar.' });
    }

    const payload = req.body || {};
    const userApiKey = (typeof payload.userApiKey === 'string' && payload.userApiKey.startsWith('sk-')) ? payload.userApiKey : null;
    delete payload.userApiKey;

    if (!config.openai.apiKey && !userApiKey) {
      return res.status(503).json({ error: 'Kein OpenAI-API-Key verfuegbar.', needs_user_key: true });
    }
    if (!payload.message || !String(payload.message).trim()) {
      return res.status(400).json({ error: 'message fehlt.' });
    }

    const result = await openaiService.copilotChat(payload, { userApiKey });
    _cpDaily.set(key, used + 1);
    if (_cpDaily.size > 5000) {
      const today = new Date().toISOString().slice(0, 10);
      for (const k of Array.from(_cpDaily.keys())) { if (k.slice(-10) !== today) _cpDaily.delete(k); }
    }
    res.json(result);
  } catch (err) {
    if (err.code === 'NO_API_KEY') return res.status(503).json({ error: err.message, needs_user_key: true });
    if (err.status === 401) return res.status(401).json({ error: err.message, key_source: err.keySource, needs_user_key: err.keySource === 'user' });
    if (err.status) return res.status(502).json({ error: 'OpenAI-Fehler: ' + err.message });
    next(err);
  }
});
/* v585-copilot-route END */

/* ─────────────────────────────────────────────────────────────────────
 * v1008-beleg: POST /api/v1/ai/extract-beleg — KI-Beleg-Import (Vision).
 * Body: { belege: [ { name, images:[dataURL] } ] }. Plan-Gate Investor+/Pro.
 * 1 Import-Lauf = 1 L Kerosin (nur wenn mindestens ein Beleg gelesen wurde).
 * ───────────────────────────────────────────────────────────────────── */
router.post('/extract-beleg', authenticate, extractLimiter, async (req, res, next) => {
  try {
    const { query } = require('../db/pool');
    // Plan-Gate: Investor+ / Pro / Partner
    const pr = await query("SELECT plan_id FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1", [req.user.id]);
    const plan = pr.rowCount ? String(pr.rows[0].plan_id) : 'free';
    if (plan === 'free' || plan === 'starter') {
      return res.status(403).json({ error: 'Der KI-Beleg-Import ist ab dem Investor-Plan verfuegbar.' });
    }
    const belege = (req.body && Array.isArray(req.body.belege)) ? req.body.belege : [];
    if (!belege.length) return res.status(400).json({ error: 'Keine Belege uebergeben.' });
    if (belege.length > 40) return res.status(400).json({ error: 'Zu viele Belege pro Lauf (max. 40).' });

    // Kerosin-Verfuegbarkeit vorab pruefen (1 L pro Lauf), noch nicht abbuchen.
    try {
      const st = await aiCreditsService.getStatus(req.user.id);
      if (!st || st.total_remaining < 1) {
        return res.status(402).json({ error: 'Nicht genug Kerosin fuer diesen Import-Lauf.', status: st });
      }
    } catch (e) { /* getStatus-Fehler nicht blockierend */ }

    const userApiKey = (req.body && req.body.userApiKey) || undefined;
    const results = [];
    let okCount = 0;
    for (let i = 0; i < belege.length; i++) {
      const b = belege[i] || {};
      const imgs = Array.isArray(b.images) ? b.images : [];
      const nm = b.name || ('Beleg ' + (i + 1));
      if (!imgs.length) { results.push({ name: nm, ok: false, error: 'keine Bilddaten' }); continue; }
      try {
        const out = await openaiService.extractBeleg(imgs, { userApiKey });
        const positionen = (out && Array.isArray(out.positionen)) ? out.positionen : [];
        results.push({ name: nm, ok: positionen.length > 0, positionen: positionen, pages: (out && out.pages) || imgs.length, diag: (out && out.diag) || '' });
        if (positionen.length > 0) okCount++;
      } catch (e) {
        results.push({ name: nm, ok: false, error: (e && e.message) ? String(e.message).slice(0, 160) : 'Lesefehler', diag: 'Fehler: ' + ((e && e.message) ? String(e.message).slice(0, 120) : '') });
      }
    }

    // 1 L pro Lauf — nur wenn mindestens ein Beleg erfolgreich gelesen wurde.
    let charged = false;
    if (okCount > 0) {
      try {
        const c = await aiCreditsService.consume(req.user.id, 1, 'extract-beleg', { belege: belege.length, ok: okCount });
        charged = !!(c && c.ok);
      } catch (e) { /* Abbuchung fehlgeschlagen -> nicht blockierend */ }
    }

    return res.json({ results: results, ok_count: okCount, charged: charged });
  } catch (err) { next(err); }
});


module.exports = router;
