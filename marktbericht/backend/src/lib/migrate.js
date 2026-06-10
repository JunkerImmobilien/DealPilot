// migrate.js — führt backend/migrations/*.sql in Reihenfolge aus.
// Idempotent: alle Migrations nutzen IF NOT EXISTS / ON CONFLICT.
// Trackt angewendete Migrations in mb._migrations.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, q } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGR_DIR = path.resolve(__dirname, '../../migrations');

async function ensureTable() {
  // Schema mb existiert evtl. noch nicht -> erst nach 001. Tracking-Tabelle separat im public-Schema.
  await q(`CREATE TABLE IF NOT EXISTS public._mb_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT now()
  )`);
}

async function applied(name) {
  const r = await q('SELECT 1 FROM public._mb_migrations WHERE name = $1', [name]);
  return r.length > 0;
}

async function run() {
  await ensureTable();
  const files = fs
    .readdirSync(MIGR_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const f of files) {
    if (await applied(f)) {
      console.log(`[migrate] skip ${f} (bereits angewendet)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGR_DIR, f), 'utf8');
    console.log(`[migrate] apply ${f} ...`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO public._mb_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log(`[migrate] OK ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`[migrate] FEHLER ${f}:`, e.message);
      process.exit(1);
    } finally {
      client.release();
    }
  }
  console.log('[migrate] fertig.');
  await pool.end();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
