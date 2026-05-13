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

  // Custom HTTP error
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
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
