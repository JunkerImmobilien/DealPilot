'use strict';
/**
 * Migration runner
 * Usage:
 *   node src/db/migrate.js          - Apply pending migrations
 *   node src/db/migrate.js --reset  - DROP all tables and reapply (DEV ONLY)
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { pool, query, transaction } = require('./pool');
const config = require('../config');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

async function getAppliedVersions() {
  // First check if migrations table exists
  const tableCheck = await query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'schema_migrations'
    ) AS exists
  `);
  if (!tableCheck.rows[0].exists) return new Set();
  const r = await query('SELECT version FROM schema_migrations');
  return new Set(r.rows.map(row => row.version));
}

async function reset() {
  console.log('⚠  RESET MODE - dropping all tables...');
  await query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      -- Drop all tables in public schema
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
      -- Drop all triggers/functions
      FOR r IN (SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public') LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.routine_name) || ' CASCADE';
      END LOOP;
    END $$;
  `);
  console.log('✓ Database reset complete');
}

async function applyMigrations() {
  // Ensure pgcrypto extension for gen_random_uuid()
  await query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  const applied = await getAppliedVersions();

  // Read all migration files
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    const match = file.match(/^(\d+)_/);
    if (!match) continue;
    const version = parseInt(match[1], 10);

    if (applied.has(version)) {
      // Already applied, skip
      continue;
    }

    console.log(`→ Applying migration ${version}: ${file}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    await transaction(async (client) => {
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version, filename) VALUES ($1, $2)',
        [version, file]
      );
    });
    count++;
  }

  if (count === 0) {
    console.log('✓ No new migrations to apply (database is up to date)');
  } else {
    console.log(`✓ Applied ${count} migration(s)`);
  }
}

async function bootstrapAdmin() {
  // Check if any admin user exists
  const r = await query("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'");
  if (parseInt(r.rows[0].cnt, 10) > 0) {
    return;
  }

  if (!config.admin.email || !config.admin.password) {
    console.log('ℹ  No admin user exists. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to bootstrap one,');
    console.log('   or register the first user via the API (the first user becomes admin automatically).');
    return;
  }

  const hash = await bcrypt.hash(config.admin.password, config.auth.bcryptRounds);
  await query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [config.admin.email.toLowerCase(), hash, config.admin.name]
  );
  console.log(`✓ Admin user created: ${config.admin.email}`);
}

async function main() {
  const isReset = process.argv.includes('--reset');

  console.log('═══ Junker Backend Migration ═══');
  console.log(`  Database: ${config.db.connectionString || `${config.db.host}:${config.db.port}/${config.db.database}`}`);

  try {
    if (isReset) {
      if (config.env === 'production') {
        console.error('✗ Cannot reset in production environment');
        process.exit(1);
      }
      await reset();
    }
    await applyMigrations();
    await bootstrapAdmin();
    console.log('═══ Migration complete ═══');
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { applyMigrations, reset };
