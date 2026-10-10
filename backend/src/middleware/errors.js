'use strict';
const config = require('../config');

/**
 * Generic error handler. Should be the LAST middleware in the chain.
 * Express recognizes error handlers by their 4-arg signature.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Zod validation error
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message }))
    });
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists', detail: err.detail });
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced resource does not exist' });
  }

  /* ── v2094 · DER HANDLER HAT `code` WEGGEWORFEN ───────────────────────
   *
   * Hier stand `json({ error: err.message })`. Wer an einem `HttpError`
   * ein `code` setzt, damit das Frontend zwei Faelle unterscheiden kann,
   * bekam es nie zu sehen — die Zeile reicht nur die Botschaft weiter,
   * und zwar lautlos. Gemessen am 10.10.2026, als `EMAIL_NOT_VERIFIED`
   * fuer N60.3 gebraucht wurde.
   *
   * Durchgelassen wird nur ein ausdruecklich gesetztes Kennwort in
   * GROSSBUCHSTABEN_MIT_UNTERSTRICH. Das ist kein Schoenheitsfilter: die
   * PostgreSQL-Fehlercodes (`23505`, `23503` — zwei Zeilen weiter oben
   * abgefangen) liegen ebenfalls auf `err.code`, und ein Datenbankcode
   * gehoert nicht nach aussen.                                         */
  if (err.statusCode) {
    const body = { error: err.message };
    if (typeof err.code === 'string' && /^[A-Z][A-Z0-9_]{2,39}$/.test(err.code)) {
      body.code = err.code;
    }
    return res.status(err.statusCode).json(body);
  }

  // Unknown error - log it, return generic 500
  console.error('✗ Unhandled error:', err.message);
  console.error(err.stack);

  const body = { error: 'Internal server error' };
  if (config.env !== 'production') {
    body.detail = err.message;
    body.stack = err.stack.split('\n').slice(0, 5);
  }
  res.status(500).json(body);
}

/**
 * 404 handler for unmatched routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found', path: req.path });
}

/**
 * Helper to create HTTP errors
 */
class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = { errorHandler, notFoundHandler, HttpError };
