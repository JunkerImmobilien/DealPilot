/**
 * v2933 · KONTO LOESCHEN - VOLLSTAENDIG.
 *
 * Datenschutz-Bestandsaufnahme 23.10.2026, gemessen am Code:
 *   - DELETE /auth/me loeschte nur die Zeile in `users` (FK-Kaskade).
 *   - Ein laufendes Stripe-Abo wurde NICHT gekuendigt: das Konto war weg,
 *     die Abbuchung lief weiter.
 *   - Marktberichte (eigene Datenbank, mit Objektanschrift) blieben stehen.
 *   - Support-Tickets samt Anhaengen blieben stehen (user_id ON DELETE SET NULL).
 *
 * Reihenfolge ist Absicht: erst das Abo. Scheitert die Kuendigung, wird NICHT
 * geloescht - sonst bezahlt ein Konto, das es nicht mehr gibt, und niemand
 * kann es mehr kuendigen. Danach mb-Daten, Tickets, zuletzt der Nutzer.
 */
const fs = require('fs');
const path = require('path');
const { query } = require('../db/pool');
const stripeService = require('./stripeService');

const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');
const OFFEN = ['trialing', 'active', 'past_due', 'unpaid', 'incomplete', 'paused'];

async function aboKuendigen(userId) {
  const r = await query(
    `SELECT stripe_subscription_id, status FROM subscriptions
      WHERE user_id = $1 AND stripe_subscription_id IS NOT NULL`, [userId]);
  const erg = [];
  for (const row of r.rows) {
    if (OFFEN.indexOf(String(row.status)) < 0) continue;
    if (!stripeService.isConfigured()) throw new Error('Stripe nicht eingerichtet - Abo kann nicht gekündigt werden');
    const stripe = stripeService.getStripe();
    try {
      await stripe.subscriptions.cancel(row.stripe_subscription_id);
      erg.push(row.stripe_subscription_id);
    } catch (e) {
      /* schon gekuendigt / bei Stripe unbekannt: kein Hindernis */
      if (e && (e.code === 'resource_missing' || /canceled|No such subscription/i.test(e.message || ''))) continue;
      throw e;
    }
  }
  return erg;
}

async function mbLoeschen(userId) {
  const r = await fetch(MB_BASE + '/nutzer/' + encodeURIComponent(userId), {
    method: 'DELETE', headers: { 'x-dp-konto-loeschen': String(userId) }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Marktbericht-Daten: ' + (j.message || j.error || r.status));
  return j.rows || {};
}

async function ticketsLoeschen(userId, email) {
  const t = await query(
    `SELECT id FROM support_tickets WHERE user_id = $1 OR (contact_email IS NOT NULL AND lower(contact_email) = lower($2))`,
    [userId, email || '']);
  const ids = t.rows.map((x) => x.id);
  if (!ids.length) return 0;
  const base = process.env.UPLOAD_DIR || '/app/uploads';
  for (const id of ids) {
    try { fs.rmSync(path.join(base, 'tickets', String(id)), { recursive: true, force: true }); } catch (e) {}
  }
  /* Kinder zuerst, falls keine Kaskade gesetzt ist */
  for (const tab of ['ticket_attachments', 'ticket_messages']) {
    try { await query(`DELETE FROM ${tab} WHERE ticket_id = ANY($1)`, [ids]); } catch (e) { /* Tabelle fehlt: egal */ }
  }
  const d = await query('DELETE FROM support_tickets WHERE id = ANY($1)', [ids]);
  return d.rowCount;
}

async function loeschen(userId, email) {
  const bericht = {};
  bericht.abo_gekuendigt = await aboKuendigen(userId);
  bericht.marktbericht = await mbLoeschen(userId);
  bericht.tickets = await ticketsLoeschen(userId, email);
  await query('DELETE FROM users WHERE id = $1', [userId]);
  return bericht;
}

module.exports = { loeschen, aboKuendigen, mbLoeschen, ticketsLoeschen };
