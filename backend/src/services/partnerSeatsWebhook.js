'use strict';
/**
 * partnerSeatsWebhook.js — v3303 · Mandanten-Plaetze (metadata.kind = 'partner_seats')
 * ueber den Stripe-Webhook abgleichen.
 *
 * Bis v3302 buchte NUR der Checkout-Ruecksprung (POST /reseller/pool/confirm)
 * bzw. GET /reseller/pool?refresh=1 die Plaetze. Schloss der Partner das
 * Fenster nach der Zahlung, bevor die Erfolgsseite lud, hatte er bezahlt und
 * keinen Platz, bis er das Portal wieder oeffnete. Kuendigung und
 * Mengenaenderung im Stripe-Kundenportal kamen gar nicht an.
 *
 * Jetzt gleicht der Webhook mit derselben EINEN Funktion ab, die alle Wege
 * durchlaufen: resellerService.syncPoolQuantity(). Sie setzt die Poolgroesse
 * auf die Zielmenge (idempotent: zweimal dieselbe Menge aendert nichts) und
 * baut beim Verkleinern NUR freie Pool-Zeilen ab — zugewiesene Plaetze gehen
 * nie verloren.
 *
 * Regeln:
 *  - checkout.session.completed (mode=subscription, kind=partner_seats):
 *    Abo holen, Menge abgleichen, Abo-ID am Reseller setzen.
 *  - customer.subscription.created/updated: nur wenn das Abo das des
 *    Resellers ist (resellers.stripe_subscription_id) oder er noch keins hat.
 *    Ein altes, zweites Abo darf den Pool nicht ueberschreiben.
 *      active/trialing/past_due -> Menge der ersten Position
 *      incomplete               -> nichts tun (noch nicht bezahlt; der Abschluss
 *                                  kommt als updated/active nach)
 *      canceled/unpaid/incomplete_expired -> 0
 *  - customer.subscription.deleted -> 0 (gleiche Abo-Pruefung)
 *
 * Abhaengigkeiten werden injiziert (deps), damit tools/partner-seats-webhook-pruefen.mjs
 * die Funktion mit nachgebauten Ereignissen ohne Stripe und ohne Datenbank laufen lassen kann.
 */

const BEZAHLT = new Set(['active', 'trialing', 'past_due']);
const BEENDET = new Set(['canceled', 'unpaid', 'incomplete_expired']);

function istPartnerSeats(obj) {
  return !!(obj && obj.metadata && obj.metadata.kind === 'partner_seats' && obj.metadata.reseller_id);
}

function intervallAus(item) {
  return item && item.price && item.price.recurring && item.price.recurring.interval === 'year'
    ? 'yearly' : 'monthly';
}

function standardDeps() {
  return {
    query: require('../db/pool').query,
    syncPoolQuantity: require('./resellerService').syncPoolQuantity,
    getSubscription: require('./stripeService').getSubscription
  };
}

async function abgleichen(deps, resellerId, sub, menge, abo) {
  const item = sub.items && sub.items.data && sub.items.data[0];
  return deps.syncPoolQuantity(resellerId, menge, {
    interval: intervallAus(item),
    stripeSubscriptionId: abo ? sub.id : undefined,
    stripeSubscriptionItemId: item && item.id,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null
  });
}

/**
 * @returns {Promise<{handled:boolean, aktion?:string, menge?:number, grund?:string}>}
 *   handled=false: kein Partner-Seat-Ereignis, der normale Webhook-Zweig laeuft weiter.
 */
async function handlePartnerSeatsEvent(event, deps) {
  deps = deps || standardDeps();
  const typ = event && event.type;
  const obj = event && event.data && event.data.object;
  if (!istPartnerSeats(obj)) return { handled: false };
  const resellerId = obj.metadata.reseller_id;

  const r = await deps.query('SELECT id, stripe_subscription_id FROM resellers WHERE id = $1', [resellerId]);
  const reseller = r.rows && r.rows[0];
  if (!reseller) return { handled: true, aktion: 'uebersprungen', grund: 'reseller_unbekannt' };

  if (typ === 'checkout.session.completed') {
    if (obj.mode !== 'subscription' || !obj.subscription) {
      return { handled: true, aktion: 'uebersprungen', grund: 'kein_abo' };
    }
    const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id;
    const sub = await deps.getSubscription(subId);
    if (!sub || !BEZAHLT.has(sub.status)) {
      return { handled: true, aktion: 'uebersprungen', grund: 'status_' + (sub && sub.status) };
    }
    const item = sub.items && sub.items.data && sub.items.data[0];
    const menge = item ? (item.quantity || 0) : 0;
    const pool = await abgleichen(deps, resellerId, sub, menge, true);
    return { handled: true, aktion: 'abgeglichen', menge, pool };
  }

  if (typ === 'customer.subscription.created' || typ === 'customer.subscription.updated'
      || typ === 'customer.subscription.deleted') {
    const sub = obj;
    if (reseller.stripe_subscription_id && reseller.stripe_subscription_id !== sub.id) {
      return { handled: true, aktion: 'uebersprungen', grund: 'anderes_abo' };
    }
    let menge;
    if (typ === 'customer.subscription.deleted' || BEENDET.has(sub.status)) menge = 0;
    else if (BEZAHLT.has(sub.status)) {
      const item = sub.items && sub.items.data && sub.items.data[0];
      menge = item ? (item.quantity || 0) : 0;
    } else {
      return { handled: true, aktion: 'uebersprungen', grund: 'status_' + sub.status };
    }
    const pool = await abgleichen(deps, resellerId, sub, menge, menge > 0);
    return { handled: true, aktion: 'abgeglichen', menge, pool };
  }

  return { handled: false };
}

module.exports = { handlePartnerSeatsEvent, istPartnerSeats };
