'use strict';
/**
 * V63.83: 2 Demo-User mit Pro-Plan anlegen
 * ─────────────────────────────────────────
 * Aufruf im Backend-Container:
 *   docker exec -it dealpilot-backend node scripts/seed-demo-users.js
 *
 * Was es tut:
 *   1. Legt 2 User an (oder updated wenn schon da)
 *   2. Setzt deren Plan in der subscriptions-Tabelle auf 'pro'
 *   3. Gibt die Login-Daten am Ende auf der Konsole aus
 *
 * Ablauf ist idempotent — kann mehrfach laufen.
 */

const bcrypt = require('bcrypt');
const { pool, query } = require('../src/db/pool');

const DEMO_USERS = [
  {
    email:    'demo.pro1@dealpilot.local',
    name:     'Demo Pro 1',
    password: 'DemoProPilot2026!'
  },
  {
    email:    'demo.pro2@dealpilot.local',
    name:     'Demo Pro 2',
    password: 'DemoProSpace2026!'
  }
];

async function ensureUser(u) {
  const emailLower = u.email.toLowerCase();
  const existing = await query('SELECT id FROM users WHERE email = $1', [emailLower]);
  let userId;
  const hash = await bcrypt.hash(u.password, 12);

  if (existing.rowCount === 0) {
    const r = await query(
      `INSERT INTO users (email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, 'user', TRUE)
       RETURNING id`,
      [emailLower, hash, u.name]
    );
    userId = r.rows[0].id;
    console.log(`   ✓ User ${u.email} angelegt (id=${userId})`);
  } else {
    userId = existing.rows[0].id;
    // Passwort updaten falls existing
    await query(
      `UPDATE users SET password_hash = $1, name = $2, is_active = TRUE WHERE id = $3`,
      [hash, u.name, userId]
    );
    console.log(`   ↻ User ${u.email} existiert (id=${userId}) — Passwort aktualisiert`);
  }

  // Subscriptions setzen — 'pro'-Plan
  // Schema-Detection: prüft welche Spalten existieren
  const colCheck = await query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='subscriptions' AND table_schema='public'
  `);
  const cols = colCheck.rows.map(r => r.column_name);
  const hasUserId = cols.includes('user_id');
  // Schema-Variante: V51+ nutzt 'plan_id' (FK auf plans), ältere ggf. 'plan' (varchar)
  const planCol = cols.includes('plan_id') ? 'plan_id'
                : cols.includes('plan')    ? 'plan'
                : null;
  const hasBillingInterval = cols.includes('billing_interval');
  const hasStatus          = cols.includes('status');

  if (hasUserId && planCol) {
    const sub = await query('SELECT id FROM subscriptions WHERE user_id = $1', [userId]);
    if (sub.rowCount === 0) {
      // Pflichtfelder beachten: billing_interval + status sind NOT NULL in V51+
      const fields = ['user_id', planCol];
      const vals   = [userId,    'pro'];
      if (hasBillingInterval) { fields.push('billing_interval'); vals.push('monthly'); }
      if (hasStatus)          { fields.push('status');           vals.push('active');  }
      const placeholders = vals.map((_, i) => `$${i+1}`).join(',');
      await query(
        `INSERT INTO subscriptions (${fields.join(',')}) VALUES (${placeholders})`,
        vals
      );
    } else {
      await query(`UPDATE subscriptions SET ${planCol} = 'pro' WHERE user_id = $1`, [userId]);
    }
    console.log(`   ✓ Plan 'pro' gesetzt für ${u.email} (Spalte: ${planCol})`);
  } else {
    console.log(`   ⚠ Tabelle 'subscriptions' hat nicht erwartete Struktur — Plan ggf. manuell setzen`);
  }

  return userId;
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  V63.83 — Demo-User-Seed (Pro-Plan)');
  console.log('═══════════════════════════════════════════════\n');

  for (const u of DEMO_USERS) {
    console.log(`\n→ ${u.email} (${u.name})`);
    await ensureUser(u);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('  ✓ Fertig — Login-Daten:\n');
  DEMO_USERS.forEach(u => {
    console.log(`  E-Mail:   ${u.email}`);
    console.log(`  Passwort: ${u.password}`);
    console.log(`  Plan:     pro`);
    console.log(`  ─────────────────────────────────`);
  });
  console.log('\n  Beide User können sich ab sofort einloggen unter');
  console.log('  https://<deine-domain>/');
  console.log('═══════════════════════════════════════════════\n');

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('\n✗ FEHLER:', err.message);
  console.error(err.stack);
  process.exit(1);
});
