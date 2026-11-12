'use strict';
require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:8080')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  },

  db: {
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'junker_db',
    user: process.env.DB_USER || 'junker',
    password: process.env.DB_PASSWORD || ''
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '11', 10),

    /* ══ v2136 · DIE GNADENFRIST (Backlog N60.3) ══════════════════════
       Marcel: "Bei der Erstanmeldung besteht die Moeglichkeit, dass der
       Kunde direkt Zugang zur App bekommt und spaetestens 6 Stunden nach
       Erstanmeldung bestaetigen muss, sonst wird der Account gesperrt."

       EINE Quelle fuer die Frist. Sie wird an drei Stellen gelesen: der
       Anmeldung (Antwort mit Ablaufzeitpunkt), dem Login
       (userService.authenticate) und JEDER Anfrage (middleware
       authenticate). Drei Zahlen an drei Orten waeren drei Fristen.

       > Eine Frist, die an mehreren Stellen steht, ist keine Frist,
       > sondern eine Vermutung. Dieselbe Form wie die Score-Kette: ein
       > Wert, eine Stelle, alle lesen von dort. */
    verifyGnadenfristStunden: parseInt(process.env.VERIFY_GRACE_HOURS || '6', 10)
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '200', 10)
  },

  admin: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Administrator'
  },

  // Stripe (optional - if not set, paid plans are disabled)
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
  },

  // OpenAI (optional - server-side proxy for KI-Analyse with web search)
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    /* v1329: war gpt-4o-mini - in ChatGPT abgeschaltet, API-Snapshot
       abgekuendigt zum 11.12.2026. */
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-5.6-luna'
  },

  /* ══ v3318 · KI-DECKEL - DIE EINE STELLE FUER ALLE GRENZEN ═════════════════
     Marcel 12.11.2026: „passende grenzen, dass man max 3-4 euro hat pro monat".
     Gelesen nur von services/kiVerbrauch.js. Begruendung der Werte:
     wissen/2026-11-12.md (Abschnitt v3318) und tools/ki-deckel-pruefen.mjs.
       deckelEur        Monatsdeckel in Euro je Konto (Berliner Kalendermonat). null = ohne Deckel.
                        testphase = laufende Pro-Testphase, test = is_test_user, admin = role admin.
                        Mandanten eines Partners haben je Platz ein eigenes Konto und damit
                        je Platz ihren eigenen Deckel.
       monatsgrenzen    Vorgaenge je Monat fuer die frueher ungedeckelten Funktionen.
       reserveEur       je laufendem, schon geprueftem Vorgang vorgemerkt (parallele Anfragen
                        koennen den Deckel sonst gemeinsam ueberspringen).
       analyseJeStunde  Ratenbegrenzer fuer POST /ai/analyze.
     Uebersteuern ohne Codeaenderung: KI_DECKEL_EUR='{"pro":4}', KI_MONATSGRENZEN='{"pro":{"analyse":60}}',
     OPENAI_USD_EUR=0.92, OPENAI_PREISE='{"modell":{"ein":..,"aus":..}}' (USD je Mio Token). */
  ki: (function () {
    function _json(s) { try { return s ? JSON.parse(s) : {}; } catch (e) { return {}; } }
    const deckel = Object.assign({
      free: 0.75, starter: 2.00, investor: 3.00, pro: 3.50, partner: 3.50,
      business: 3.50, enterprise: 3.50, testphase: 2.50, test: 10.00, admin: null
    }, _json(process.env.KI_DECKEL_EUR));
    const grenzenBasis = {
      free:     { analyse: 3,  recherche: 15,  dokument: 30 },
      starter:  { analyse: 15, recherche: 40,  dokument: 80 },
      investor: { analyse: 30, recherche: 80,  dokument: 150 },
      pro:      { analyse: 50, recherche: 120, dokument: 250 },
      testphase:{ analyse: 15, recherche: 40,  dokument: 80 }
    };
    ['partner', 'business', 'enterprise'].forEach(function (p) { grenzenBasis[p] = Object.assign({}, grenzenBasis.pro); });
    const ueber = _json(process.env.KI_MONATSGRENZEN);
    Object.keys(ueber).forEach(function (p) { grenzenBasis[p] = Object.assign({}, grenzenBasis[p] || {}, ueber[p]); });
    return {
      usdEur: Number(process.env.OPENAI_USD_EUR || 0.92),
      deckelEur: deckel,
      monatsgrenzen: grenzenBasis,
      reserveEur: Number(process.env.KI_RESERVE_EUR || 0.15),
      analyseJeStunde: parseInt(process.env.KI_ANALYSE_JE_STUNDE || '12', 10)
    };
  })(),

  // Frontend URL for redirects (Stripe success/cancel, email links)
  frontend: {
    baseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:8080'
  },

  // Email (placeholder - to be implemented when provider is configured)
  email: {
    provider: process.env.EMAIL_PROVIDER || '',  // 'resend', 'sendgrid', 'smtp'
    fromAddress: process.env.EMAIL_FROM || 'info@dealpilot.immo',
    apiKey: process.env.EMAIL_API_KEY || ''
  }
};

// Validate critical config
function validate() {
  const errors = [];

  if (config.env === 'production') {
    if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be set and at least 32 characters in production');
    }
    if (config.auth.jwtSecret.includes('CHANGE_ME')) {
      errors.push('JWT_SECRET still contains placeholder; please set a real secret');
    }
  } else {
    // dev: allow placeholder but warn
    if (!config.auth.jwtSecret) {
      config.auth.jwtSecret = 'dev_secret_DO_NOT_USE_IN_PRODUCTION_' + Date.now();
      console.warn('⚠  JWT_SECRET not set - using development fallback');
    }
  }

  if (errors.length) {
    console.error('✗ Configuration errors:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
}

validate();

module.exports = config;
