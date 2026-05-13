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
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '11', 10)
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
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini'
  },

  // Frontend URL for redirects (Stripe success/cancel, email links)
  frontend: {
    baseUrl: process.env.FRONTEND_BASE_URL || 'http://localhost:8080'
  },

  // Email (placeholder - to be implemented when provider is configured)
  email: {
    provider: process.env.EMAIL_PROVIDER || '',  // 'resend', 'sendgrid', 'smtp'
    fromAddress: process.env.EMAIL_FROM || 'noreply@junker-immobilien.io',
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
