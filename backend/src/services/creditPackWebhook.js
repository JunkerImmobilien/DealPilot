'use strict';
/**
 * V197: Webhook-Handler-Erweiterung für Credit-Pack-Käufe
 *
 * Dieses Modul wird vom bestehenden Stripe-Webhook in /api/v1/webhooks/stripe
 * für Events vom Typ `checkout.session.completed` mit mode=payment aufgerufen.
 *
 * Idempotent: prüft credit_purchases.status BEFORE Gutschrift.
 */

const { getPack } = require('./creditPacks');

/**
 * Verarbeitet ein checkout.session.completed Event für einen Credit-Pack-Kauf.
 *
 * @param {object} db   — pg pool
 * @param {object} session — Stripe checkout session
 * @returns {object}    — { ok: boolean, reason?: string, credits_added?: int }
 */
async function handleCreditPackPaid(db, session) {
  // Sicherheits-Prüfungen
  if (session.mode !== 'payment') {
    return { ok: false, reason: 'not_payment_mode' };
  }
  if (!session.metadata || session.metadata.type !== 'credit_pack') {
    return { ok: false, reason: 'not_a_credit_pack' };
  }

  const userId = session.metadata.user_id || session.client_reference_id;
  const packId = session.metadata.pack_id;

  if (!userId || !packId) {
    console.error('[credits-webhook] missing metadata:', session.id);
    return { ok: false, reason: 'missing_metadata' };
  }

  const pack = getPack(packId);
  if (!pack) {
    console.error('[credits-webhook] unknown pack_id:', packId);
    return { ok: false, reason: 'unknown_pack' };
  }

  // Transaktion: Idempotenz-Check + Gutschrift in einem Rutsch
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1) Purchase auf 'completed' setzen — NUR wenn vorher 'pending'
    //    UPDATE ... RETURNING liefert nichts wenn schon completed → idempotent
    const updateResult = await client.query(`
      UPDATE credit_purchases
      SET status = 'completed',
          completed_at = NOW(),
          stripe_payment_intent = COALESCE($1, stripe_payment_intent)
      WHERE stripe_session_id = $2
        AND status = 'pending'
      RETURNING id
    `, [session.payment_intent || null, session.id]);

    if (updateResult.rowCount === 0) {
      // Entweder schon completed (Webhook-Replay) oder Purchase fehlt komplett
      const exists = await client.query(
        'SELECT status FROM credit_purchases WHERE stripe_session_id = $1',
        [session.id]
      );
      await client.query('COMMIT');
      if (exists.rowCount && exists.rows[0].status === 'completed') {
        console.log('[credits-webhook] session bereits verbucht (idempotent):', session.id);
        return { ok: true, reason: 'already_processed' };
      }
      console.warn('[credits-webhook] purchase nicht gefunden:', session.id);
      return { ok: false, reason: 'purchase_not_found' };
    }

    // 2) Credits in ai_credits_user.bonus_credits hinzufügen
    //    (DB speichert Anfragen-Einheiten = credits * 2)
    await client.query(`
      INSERT INTO ai_credits_user (user_id, bonus_credits)
      VALUES ($1, $2)
      ON CONFLICT (user_id) DO UPDATE SET
        bonus_credits = ai_credits_user.bonus_credits + EXCLUDED.bonus_credits,
        updated_at = NOW()
    `, [userId, pack.bonus_credits_units]);

    // 3) ai_credits_log Eintrag (für Buchhaltung)
    await client.query(`
      INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta)
      VALUES ($1, 'credit-pack-purchase', $2, 'stripe', $3::jsonb)
    `, [userId, -pack.bonus_credits_units, JSON.stringify({
      pack_id: pack.id,
      credits_granted: pack.credits,
      requests_granted: pack.bonus_credits_units,
      stripe_session_id: session.id,
      amount_cents: session.amount_total
    })]);

    await client.query('COMMIT');
    console.log(`[credits-webhook] ✓ ${pack.credits} Credits (${pack.bonus_credits_units} Anfragen) gutgeschrieben an User ${userId}`);

    // V198: Credit-Pack-Bestätigungs-Mail asynchron (non-blocking)
    setImmediate(async () => {
      try {
        const { sendCreditPackConfirmation } = require('./welcomeMail');
        await sendCreditPackConfirmation(db, {
          userId,
          packLabel: pack.label || pack.id,
          creditsGranted: pack.credits,
          requestsGranted: pack.bonus_credits_units,
          amountCents: session.amount_total || pack.amount_cents,
          sessionId: session.id
        });
      } catch (e) {
        console.error('[credits-webhook] mail-confirmation failed (non-fatal):', e.message);
      }
    });

    return { ok: true, credits_added: pack.credits, requests_added: pack.bonus_credits_units };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[credits-webhook] error:', err);

    // Purchase als failed markieren
    try {
      await db.query(`
        UPDATE credit_purchases SET status = 'failed'
        WHERE stripe_session_id = $1 AND status = 'pending'
      `, [session.id]);
    } catch {}

    return { ok: false, reason: 'db_error', message: err.message };
  } finally {
    client.release();
  }
}

module.exports = { handleCreditPackPaid };
