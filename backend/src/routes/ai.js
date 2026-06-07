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

    // v491-kerosin-ai: volle Pilot-Analyse = 3 Liter (Pre-Check, nur Server-Key)
    if (!userApiKey) {
      const status = await aiCreditsService.getStatus(req.user.id);
      if (status.total_remaining < 3) {
        return res.status(402).json({
          error: 'Nicht genug Kerosin im Tank.',
          message: 'Die volle Pilot-Analyse braucht 3 Liter. Monatskontingent-Reset am ' + status.period_reset_at + ' — oder jetzt Kerosin tanken.',
          credits: status,
          required: 3,
          needs_credits: true
        });
      }
    }

    const result = await openaiService.analyze(payload, { userApiKey });

    // V63.86: Nach erfolgreicher Analyse Credits abziehen (nur wenn Server-Key benutzt wurde)
    if (!userApiKey) {
      try {
        await aiCreditsService.consume(req.user.id, 3, 'analyze', { model: config.openai.defaultModel });
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
 * V39: POST /api/v1/ai/qc-suggest — KI-Vorschläge für Quick Check Felder.
 *
 * Body:
 *   group: 'rent' | 'mgmt' | 'finance'
 *   context: { adresse, ort, kaufpreis, wohnflaeche, baujahr }
 *
 * Response: { suggestions: { fieldName: { value, source, reasoning } } }
 */
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

module.exports = router;
