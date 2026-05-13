'use strict';
const express = require('express');
const { pool } = require('../db/pool');

const router = express.Router();

/**
 * GET /health - basic health check
 */
router.get('/', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/**
 * GET /health/ready - readiness check (db reachable)
 */
router.get('/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ready', db: 'ok' });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', db: 'error', error: err.message });
  }
});

module.exports = router;
