'use strict';
/**
 * tools/partner-kauf-testkonto.js · v3610 — NUR STAGING, laeuft IM Backend-Container:
 *   docker cp tools/partner-kauf-testkonto.js dealpilot-backend:/app/partner-kauf-testkonto.js
 *   docker exec dealpilot-backend node /app/partner-kauf-testkonto.js [--aufraeumen]
 *
 * Legt (idempotent) ein FREIES Testkonto ohne Abo an, mit dem der Partner-Plan-Kauf per Stripe-Testkarte
 * gemessen wird - nie Marcels info@-Konto:
 *   partnerkauf-test@partner-pruefung.dealpilot.test   (erfundener Name, .test geht nie per SMTP)
 * Gibt beim Anlegen ein neues Zufallspasswort aus (Zeile ZUGANG) und danach den Stand:
 * Plan, subscriptions, Reseller, Pool, Stripe-Abo (Positionen ohne Betraege).
 *
 * --aufraeumen: laufendes Stripe-Abo des Kontos SOFORT beenden (nur Sandbox: sk_test), Reseller-Zeilen und
 * Konto loeschen.
 */
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');

const EMAIL = 'partnerkauf-test@partner-pruefung.dealpilot.test';
if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) { console.error('ABBRUCH: nur auf Staging.'); process.exit(2); }
if (!/^sk_test_/.test(process.env.STRIPE_SECRET_KEY || '')) { console.error('ABBRUCH: kein Stripe-Testschluessel.'); process.exit(2); }
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function stand(u) {
  const sub = (await query(`SELECT plan_id, status, billing_interval, cancel_at_period_end, current_period_end, stripe_subscription_id IS NOT NULL AS stripe FROM subscriptions WHERE user_id = $1`, [u.id])).rows[0] || null;
  const rs = (await query(`SELECT id, stripe_subscription_id FROM resellers WHERE owner_user_id = $1`, [u.id])).rows[0] || null;
  let pool = null, abo = null;
  if (rs) {
    pool = (await query(`SELECT COUNT(*) FILTER (WHERE kind='client') AS gekauft, COUNT(*) FILTER (WHERE status='zugewiesen') AS zugewiesen FROM licenses WHERE reseller_id = $1`, [rs.id])).rows[0];
    if (rs.stripe_subscription_id) {
      try {
        const s = await stripe.subscriptions.retrieve(rs.stripe_subscription_id, { expand: ['items.data.price'] });
        abo = { status: s.status, cancel_at_period_end: s.cancel_at_period_end, trial_end: s.trial_end, kind: s.metadata.kind,
                positionen: s.items.data.map((i) => (i.price.lookup_key || i.price.id) + ' x' + i.quantity) };
      } catch (e) { abo = { fehler: e.message }; }
    }
  }
  const plan = await require('./src/services/subscriptionService').getEffectivePlan(u.id);
  const ev = (await query(`SELECT type, processed_at IS NOT NULL AS ok, error FROM stripe_webhook_events WHERE payload::text LIKE $1 ORDER BY received_at DESC NULLS LAST LIMIT 12`, ['%' + u.id + '%']).catch(() => ({ rows: [] }))).rows;
  console.log('STAND ' + JSON.stringify({ effektiv: plan && { plan_id: plan.plan_id, status: plan.status, reseller: !!(plan.plan_features && plan.plan_features.reseller), makler_hub: !!(plan.plan_features && plan.plan_features.makler_hub) },
    subscriptions: sub, reseller: rs && { stripe_abo: !!rs.stripe_subscription_id }, pool, abo, webhooks: ev }, null, 1));
}

(async () => {
  let u = (await query('SELECT id, email FROM users WHERE email = $1', [EMAIL])).rows[0];
  if (process.argv.includes('--aufraeumen')) {
    if (!u) { console.log('nichts da'); process.exit(0); }
    const rs = (await query(`SELECT id, stripe_subscription_id FROM resellers WHERE owner_user_id = $1`, [u.id])).rows;
    for (const r of rs) { if (r.stripe_subscription_id) { try { await stripe.subscriptions.cancel(r.stripe_subscription_id); console.log('Abo beendet'); } catch (e) { console.log('Abo:', e.message); } } }
    for (const r of rs) { await query('DELETE FROM licenses WHERE reseller_id = $1', [r.id]); await query('DELETE FROM reseller_members WHERE reseller_id = $1', [r.id]); await query('DELETE FROM resellers WHERE id = $1', [r.id]).catch((e) => console.log('resellers:', e.message)); }
    try { await userService.deleteUser(u.id); console.log('Konto geloescht'); } catch (e) { console.log('Loeschen:', e.message); }
    process.exit(0);
  }
  if (!u) {
    const pw = crypto.randomBytes(9).toString('base64url');
    u = await userService.createUser({ email: EMAIL, plainPassword: pw, name: 'Paula Partnerkauf (Test)', newsletter: false });
    console.log('ZUGANG ' + JSON.stringify({ email: EMAIL, passwort: pw }));
  }
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [u.id]);
  await stand(u);
  process.exit(0);
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
