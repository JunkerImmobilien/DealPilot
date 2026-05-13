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

  app.listen(config.port, () => {
    console.log(`✓ Server listening on http://localhost:${config.port}`);
    console.log(`  Try: curl http://localhost:${config.port}/health`);
    console.log('───────────────────────────────────────────────');
  });
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
