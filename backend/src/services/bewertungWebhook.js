'use strict';
/* ═══ v1184 · Der gekaufte Vorrat kommt an ══════════════════════════════
   Bis hierher endete jeder Kauf im Nichts: `addKontingent()` stand seit
   v1183 bereit, aber niemand rief es. Der alte Handler
   (creditPackWebhook.js) schreibt in `bonus_credits` — den Litertank, den
   Migration 066 stillgelegt hat. Ein Kauf haette also bezahlt und nichts
   gebracht.

   WOHER DIE MENGE KOMMT: aus den LINE ITEMS der Sitzung, nicht aus den
   Metadaten, die wir selbst an die Sitzung geschrieben haben. Der Preis in
   Stripe ist die Quelle, aus der auch der Betrag stammt — steht die Menge
   woanders, koennen beide auseinanderlaufen. Die Sitzungs-Metadaten sind
   nur der Rueckfall, falls das Nachladen scheitert.

   IDEMPOTENZ, ZWEIFACH:
   1. stripeWebhook.js verwirft ein Event, das schon `processed_at` traegt.
   2. Hier wird `credit_purchases` von 'pending' auf 'completed' gesetzt und
      NUR bei einer betroffenen Zeile gebucht. Ein Wiederholungslauf
      (Stripe stellt bis zu 3 Tage erneut zu) findet 'completed' vor und
      bucht nicht noch einmal.

   WARUM ERST DER ANSPRUCH, DANN DIE GUTSCHRIFT: sie liegen in zwei
   Transaktionen, weil aiCreditsService ueber den Pool arbeitet. Faellt die
   Gutschrift aus, wird der Anspruch zurueckgenommen und der Fehler
   GEWORFEN — der Router antwortet 500, Stripe stellt erneut zu, und der
   naechste Lauf findet wieder 'pending' vor. Ein verschluckter Fehler
   waere hier ein bezahlter Kauf ohne Ware.
   ═════════════════════════════════════════════════════════════════════ */

const katalog = require('./bewertungsKatalog');
const aiCreditsService = require('./aiCreditsService');
const stripeService = require('./stripeService');

/* Die Line Items der Sitzung nachladen und zu EINEM Paket summieren.
   `expand: price` liefert die Metadaten mit, an denen die Inhalte haengen. */
async function _paketAusSitzung(session) {
  const stripe = stripeService.getStripe();
  const items = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ['data.price']
  });

  const gesamt = {};
  let treffer = 0;
  (items.data || []).forEach(function (it) {
    const meta = it.price && it.price.metadata;
    const teil = katalog.paketAusMeta(meta, it.quantity);
    if (!teil) return;
    treffer++;
    Object.keys(teil).forEach(function (art) {
      gesamt[art] = (gesamt[art] || 0) + teil[art];
    });
  });

  return { paket: Object.keys(gesamt).length ? gesamt : null, positionen: treffer };
}

/* Rueckfall: was wir beim Anlegen der Sitzung selbst hineingeschrieben
   haben. Kommt nur zum Zug, wenn Stripe die Positionen nicht hergibt. */
function _paketAusMetadaten(session) {
  try {
    const roh = session.metadata && session.metadata.paket;
    if (!roh) return null;
    const p = JSON.parse(roh);
    const sauber = {};
    katalog.ARTEN.forEach(function (art) {
      const n = parseInt(p[art], 10);
      if (Number.isFinite(n) && n > 0) sauber[art] = n;
    });
    return Object.keys(sauber).length ? sauber : null;
  } catch (e) {
    return null;
  }
}

/**
 * checkout.session.completed mit metadata.type = 'bewertung'.
 * @returns {object} { ok, reason?, paket? }
 * @throws  wenn die Gutschrift scheitert — damit Stripe erneut zustellt.
 */
async function handleBewertungPaid(db, session) {
  if (session.mode !== 'payment') return { ok: false, reason: 'not_payment_mode' };
  if (!session.metadata || session.metadata.type !== 'bewertung') {
    return { ok: false, reason: 'not_a_bewertung' };
  }
  /* Bezahlt heisst bezahlt. `unpaid` kommt bei verzoegerten Zahlarten vor;
     dann wartet Stripe mit checkout.session.async_payment_succeeded. */
  if (session.payment_status && session.payment_status !== 'paid') {
    return { ok: false, reason: 'nicht_bezahlt:' + session.payment_status };
  }

  const userId = session.metadata.user_id || session.client_reference_id;
  if (!userId) {
    console.error('[bewertung-webhook] ohne user_id:', session.id);
    return { ok: false, reason: 'missing_user' };
  }

  /* 1 · Die Menge bestimmen — Quelle zuerst, Metadaten nur als Rueckfall. */
  let paket = null;
  let quelle = 'line_items';
  try {
    const r = await _paketAusSitzung(session);
    paket = r.paket;
  } catch (e) {
    console.warn('[bewertung-webhook] line items nicht ladbar:', e.message);
  }
  if (!paket) {
    paket = _paketAusMetadaten(session);
    quelle = 'session_metadata';
  }
  if (!paket) {
    console.error('[bewertung-webhook] kein Paket ermittelbar:', session.id);
    return { ok: false, reason: 'kein_paket' };
  }

  /* 2 · Anspruch stellen — atomar, und nur einmal. */
  const claim = await db.query(`
    UPDATE credit_purchases
       SET status = 'completed',
           completed_at = NOW(),
           stripe_payment_intent = COALESCE($1, stripe_payment_intent)
     WHERE stripe_session_id = $2
       AND status = 'pending'
     RETURNING id
  `, [session.payment_intent || null, session.id]);

  if (claim.rowCount === 0) {
    const da = await db.query(
      'SELECT status FROM credit_purchases WHERE stripe_session_id = $1',
      [session.id]
    );
    if (da.rowCount && da.rows[0].status === 'completed') {
      console.log('[bewertung-webhook] schon verbucht (idempotent):', session.id);
      return { ok: true, reason: 'already_processed' };
    }
    /* Kein Eintrag: der Kauf lief an /credits/checkout vorbei (Stripe-Link,
       Zahlung per Hand). Trotzdem gutschreiben — bezahlt ist bezahlt — und
       die Historie nachtragen, damit der Kauf sichtbar bleibt. */
    console.warn('[bewertung-webhook] kein pending-Eintrag, trage nach:', session.id);
    await db.query(`
      INSERT INTO credit_purchases
        (user_id, pack_id, credits_granted, amount_cents, currency,
         stripe_session_id, stripe_payment_intent, status, completed_at, kind)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'completed',NOW(),'bewertung')
      ON CONFLICT (stripe_session_id) DO NOTHING
    `, [
      userId,
      session.metadata.sku || 'unbekannt',
      katalog.summe(paket),
      session.amount_total || 0,
      session.currency || 'eur',
      session.id,
      session.payment_intent || null
    ]);
  }

  /* 3 · Gutschreiben. Ab hier ist der Anspruch gestellt — schlaegt das
     fehl, muss er zurueck, sonst waere der Kauf fuer immer verbucht und
     nie geliefert. */
  try {
    const res = await aiCreditsService.addKontingent(userId, paket, 'stripe:' + session.id);
    if (!res || !res.ok) throw new Error('addKontingent: ' + ((res && res.reason) || 'unbekannt'));
  } catch (err) {
    try {
      await db.query(`
        UPDATE credit_purchases SET status = 'pending', completed_at = NULL
         WHERE stripe_session_id = $1 AND status = 'completed'
      `, [session.id]);
    } catch (e2) {
      console.error('[bewertung-webhook] Anspruch nicht ruecknehmbar:', e2.message);
    }
    console.error('[bewertung-webhook] Gutschrift fehlgeschlagen:', err.message);
    throw err;   /* 500 → Stripe stellt erneut zu */
  }

  console.log('[bewertung-webhook] ✓ gutgeschrieben an ' + userId +
    ' (' + quelle + '): ' + JSON.stringify(paket));
  return { ok: true, paket: paket, quelle: quelle };
}

module.exports = { handleBewertungPaid };
