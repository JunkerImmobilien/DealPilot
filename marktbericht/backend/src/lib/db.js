// db.js — PostgreSQL-Pool. Roh-SQL (kein ORM), wie DealPilot.
import pg from 'pg';
import { cfg } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  host: cfg.db.host,
  port: cfg.db.port,
  user: cfg.db.user,
  password: cfg.db.password,
  database: cfg.db.database,
  max: parseInt(process.env.DB_POOL_MAX, 10) || 25,
  idleTimeoutMillis: 30000,
});

export async function q(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

export async function q1(text, params) {
  const rows = await q(text, params);
  return rows[0] || null;
}

export async function ping() {
  const r = await q1('SELECT 1 AS ok');
  return r && r.ok === 1;
}
