'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { testConnection, pool } = require('./db/pool');
const { errorHandler, notFoundHandler } = require('./middleware/errors');

const authRoutes = require('./routes/auth');
const registerWithVerifyRoutes = require('./routes/registerWithVerify');
const objectRoutes = require('./routes/objects');
const userRoutes = require('./routes/users');
const healthRoutes = require('./routes/health');
const planRoutes = require('./routes/plans');
const subscriptionRoutes = require('./routes/subscription');
const taxRecordsRoutes = require('./routes/taxRecords');
const stripeWebhookRoutes = require('./routes/stripeWebhook');
const aiRoutes = require('./routes/ai');
const marketRatesRoutes = require('./routes/marketRates');
const betaSignupRoutes = require('./routes/betaSignup');
const dealActionRoutes = require('./routes/dealAction');
const feedbackRoutes = require('./routes/feedback');
const scrapeRoutes = require('./routes/scrape');
const rndRequestRoutes = require('./routes/rndRequest');  // V186: RND-Anfrage-Endpoint
const adminRoutes = require('./routes/admin');  // V194: Admin-Dashboard
const creditsRoutes = require('./routes/credits');  // V197: KI-Credit-Käufe
const resellerRoutes = require('./routes/reseller');  // V200: Reseller-Anfragen
const avmRoutes = require('./routes/avm');  // V326: AVM-Integration

const app = express();

// ── Trust proxy (for correct req.ip behind reverse proxies) ──
app.set('trust proxy', 1);

// ── Security headers ───────────────────────────────
app.use(helmet({
  // Allow CORS to work properly
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ── CORS ───────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Allow no-origin (e.g., mobile apps, curl) and configured origins
    if (!origin || config.cors.origins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS: origin not allowed: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Stripe Webhook (MUST be before express.json() - needs raw body) ──
app.use('/api/v1/webhooks/stripe', stripeWebhookRoutes);

// ── Body parsing ────────────────────────────────────
// Big limit because photos are stored as base64 inside data
app.use(express.json({ limit: '50mb' }));

// ── Rate limiting (skip health checks) ──────────────
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  skip: function (req) { /* v395-ratelimit-skip: eingeloggte App-Requests nicht limitieren */ return !!(req.headers && req.headers.authorization && /^Bearer /i.test(req.headers.authorization)); },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/health')
});
app.use(limiter);

// Stricter rate limit for auth endpoints (prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

// ── Routes ─────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/auth', registerWithVerifyRoutes);
// V276.1-route-order: wkAggregate VOR objectRoutes! Sonst matched /:id und Validator wirft 400
app.use('/api/v1/objects', require('./routes/wkAggregate'));  // V276-wk-enabled
app.use('/api/v1/bmf', require('./routes/bmf'));  /* V288-bmf-route-applied */
app.use('/api/v1/tax-snapshots', require('./routes/taxSnapshots'));  // V278-tax-snapshots
app.use('/api/v1/objects', objectRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/plans', planRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.use('/api/v1/tax-records', taxRecordsRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/market-rates', marketRatesRoutes);
app.use('/api/v1/beta-signup', betaSignupRoutes);
app.use('/api/v1/deal-action', dealActionRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/listing', scrapeRoutes);  // V63.85: URL-Scraper für Quick-Check
app.use('/api/v1/rnd-request', rndRequestRoutes);  // V186: RND-Wizard-Anfrage
app.use('/api/v1/export', require('./routes/exportEncrypt'));
// V276.1-route-order: wkAggregate wurde NACH OBEN verschoben (vor objectRoutes) — siehe oben
app.use('/api/v1/tax-periods', require('./routes/taxPeriods'));  // V259-02: Steuerzeitraeume  // V258-04: WK-Aggregation  // V251-05: Encrypted Export

// V194: Admin-Dashboard
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/credits', creditsRoutes);  // V197
app.use('/api/v1/avm', avmRoutes);  // V326: AVM-Integration
app.use('/api/v1', resellerRoutes);  // V200
app.set('db', pool);

// API root info
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Junker Immobilien Backend',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      objects: '/api/v1/objects',
      users: '/api/v1/users (admin)',
      plans: '/api/v1/plans',
      subscription: '/api/v1/subscription',
      stripeWebhook: '/api/v1/webhooks/stripe',
      health: '/health'
    }
  });
});

// Root redirect to API info
app.get('/', (req, res) => res.redirect('/api/v1'));

// ── Error handlers (LAST) ──────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Startup ────────────────────────────────────────
async function start() {
  console.log('═══════════════════════════════════════════════');
  console.log(' Junker Immobilien Backend');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Environment: ${config.env}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  CORS: ${config.cors.origins.join(', ')}`);

  const dbOk = await testConnection();
  if (!dbOk) {
    console.error('✗ Database not reachable - start anyway (will retry on requests)');
  }

  const _server = app.listen(config.port, () => {
    console.log(`✓ Server listening on http://localhost:${config.port}`);
    console.log(`  Try: curl http://localhost:${config.port}/health`);
    console.log('───────────────────────────────────────────────');
  });
  // v507: WebSocket-Relay fuer Live-Transkription (OpenAI Realtime)
  try { require('./ws/voiceStream').attach(_server); }
  catch (e) { console.error('[voiceStream] attach failed:', e && e.message); }
}

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n  Received ${signal}, shutting down...`);
  try {
    await pool.end();
    console.log('  ✓ Database pool closed');
  } catch (err) {
    console.error('  ✗ Error closing pool:', err.message);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  console.error('✗ Unhandled rejection:', err);
});

start();

module.exports = app;
