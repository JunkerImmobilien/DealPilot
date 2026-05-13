'use strict';
const { Pool } = require('pg');
const config = require('../config');

// Build connection config
let poolConfig;
if (config.db.connectionString) {
  poolConfig = { connectionString: config.db.connectionString };
} else {
  poolConfig = {
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password
  };
}

// Pool tuning
poolConfig.max = 20;
poolConfig.idleTimeoutMillis = 30000;
poolConfig.connectionTimeoutMillis = 5000;

// SSL configuration via PGSSLMODE env variable (PostgreSQL standard).
// V25.1: Default ist KEIN SSL — funktioniert für Docker-Compose-Setup
// (Postgres-Container im selben Netz wie das Backend).
// Für externe Cloud-DBs (Supabase/Render/Heroku) explizit PGSSLMODE=require setzen.
//
// PGSSLMODE Values:
//   'disable'  → kein SSL (Default für Docker-internes Postgres)
//   'require'  → SSL erzwingen
//   'no-verify' → SSL ohne CA-Verifikation (Standard bei Cloud-DBs mit self-signed Certs)
//   nicht gesetzt → kein SSL (sicher für Container-zu-Container-Kommunikation)
const sslMode = (process.env.PGSSLMODE || '').toLowerCase().trim();
if (sslMode === 'require') {
  poolConfig.ssl = true;
} else if (sslMode === 'no-verify') {
  poolConfig.ssl = { rejectUnauthorized: false };
} else {
  // 'disable', leer, oder andere Werte → kein SSL
  poolConfig.ssl = false;
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('✗ Unexpected database pool error:', err.message);
});

// Helper: query with auto-release
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    if (process.env.LOG_QUERIES === '1') {
      const duration = Date.now() - start;
      console.log(`  SQL (${duration}ms): ${text.split('\n')[0].slice(0, 80)}...`);
    }
    return result;
  } catch (err) {
    console.error('  SQL error:', err.message);
    throw err;
  }
}

// Helper: transaction
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Test connection
async function testConnection() {
  try {
    const r = await pool.query('SELECT NOW() AS now, current_database() AS db');
    console.log(`✓ Database connected: ${r.rows[0].db} at ${r.rows[0].now.toISOString()}`);
    return true;
  } catch (err) {
    console.error('✗ Database connection failed:', err.message);
    return false;
  }
}

module.exports = {
  pool,
  query,
  transaction,
  testConnection
};
