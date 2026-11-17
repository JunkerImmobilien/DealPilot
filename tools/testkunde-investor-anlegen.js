'use strict';
/**
 * tools/testkunde-investor-anlegen.js · v3630 — NUR STAGING, laeuft IM Backend-Container:
 *   docker cp tools/testkunde-investor-anlegen.js dealpilot-backend:/app/testkunde-investor-anlegen.js
 *   docker exec dealpilot-backend node /app/testkunde-investor-anlegen.js
 *
 * Legt (idempotent) einen Testkunden mit EIGENEM Investor-Plan an (manuell, 365 Tage, ohne Stripe),
 * NICHT mit einem Partner verbunden - damit Marcel den Ablauf "Kunde mit eigenem Plan verbinden"
 * selbst durchspielen kann. Zwei Testobjekte (Kopien aus dem Demo-Bestand des Partners, falls vorhanden).
 * Erfundener Name, Adresse endet auf .test (nie per SMTP). Passwort nur beim ersten Anlegen ausgegeben
 * (Zeile ZUGANG, der Aufrufer schreibt es in Dateien/Testunterlagen/, nie ins Repo).
 */
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');
const planService = require('./src/services/planService');
const objectService = require('./src/services/objectService');

if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) {
  console.error('ABBRUCH: nur auf Staging (APP_URL enthaelt kein „staging“).'); process.exit(2);
}
const EMAIL = 'testkunde-investor@partner-pruefung.dealpilot.test';
const NAME = 'Testkunde Investor';

(async () => {
  let u = (await query('SELECT id, email FROM users WHERE email = $1', [EMAIL])).rows[0], pw = null;
  if (!u) {
    pw = crypto.randomBytes(9).toString('base64url');
    u = await userService.createUser({ email: EMAIL, plainPassword: pw, name: NAME, newsletter: false });
  }
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [u.id]);
  await planService.setUserPlanManual(u.id, 'investor', 'yearly', 365);
  const plan = await planService.getUserCurrentPlan(u.id);

  const anz = (await query('SELECT count(*)::int AS n FROM objects WHERE user_id = $1', [u.id])).rows[0].n;
  if (anz < 2) {
    const quelle = (await query(`SELECT id FROM users WHERE email = 'partner-test@partner-pruefung.dealpilot.test'`)).rows[0];
    if (quelle) {
      const q = (await query(`SELECT id FROM objects WHERE user_id = $1 AND kunden_freigabe_id IS NULL AND (data::jsonb->>'str') IS NOT NULL ORDER BY updated_at DESC LIMIT $2`, [quelle.id, 2 - anz])).rows;
      for (const x of q) {
        const o = await objectService.getById(quelle.id, x.id);
        const d = typeof o.data === 'string' ? JSON.parse(o.data) : o.data; delete d._obj_seq; delete d._kundenstand; d.halter = '';
        await objectService.create(u.id, { data: d, aiAnalysis: null, photos: [] });
      }
    }
  }
  const nObj = (await query('SELECT count(*)::int AS n FROM objects WHERE user_id = $1', [u.id])).rows[0].n;
  const verb = (await query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'partner_kunden'`)).rows[0].n
    ? (await query('SELECT count(*)::int AS n FROM partner_kunden WHERE kunde_user_id = $1 AND getrennt_am IS NULL', [u.id]).catch(() => ({ rows: [{ n: '?' }] }))).rows[0].n : '?';
  if (pw) console.log('ZUGANG ' + JSON.stringify({ email: EMAIL, passwort: pw }));
  console.log('OK Konto ' + EMAIL + ' | Plan ' + JSON.stringify(plan && (plan.plan_id || plan.id || plan.planId || plan)) + ' | Objekte ' + nObj + ' | aktive Partnerverbindungen ' + verb);
  process.exit(0);
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
