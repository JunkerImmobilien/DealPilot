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

/* v3610 · 'partner_plan' = Partner-Plan + Plaetze in EINEM Abo (services/partnerPlanKauf.js) */
function istPartnerSeats(obj) {
  return !!(obj && obj.metadata && (obj.metadata.kind === 'partner_seats' || obj.metadata.kind === 'partner_plan') && obj.metadata.reseller_id);
}
function istPartnerPlan(obj) { return !!(obj && obj.metadata && obj.metadata.kind === 'partner_plan'); }

/* v3610 · Menge der PLATZ-Position: im Partner-Plan-Abo steht der Plan daneben (Menge 1), item[0] waere falsch */
function platzMenge(sub) {
  const pos = require('./partnerPlanKauf').seatPosition(sub);
  return pos ? (pos.quantity || 0) : 0;
}

function intervallAus(item) {
  return item && item.price && item.price.recurring && item.price.recurring.interval === 'year'
    ? 'yearly' : 'monthly';
}

function standardDeps() {
  return {
    query: require('../db/pool').query,
    syncPoolQuantity: require('./resellerService').syncPoolQuantity,
    getSubscription: require('./stripeService').getSubscription,
    aboEnde: (rid) => require('./partnerKunden').aboEnde(rid)   /* v3357 */
  };
}

async function abgleichen(deps, resellerId, sub, menge, abo) {
  const item = require('./partnerPlanKauf').seatPosition(sub) || (sub.items && sub.items.data && sub.items.data[0]);
  return deps.syncPoolQuantity(resellerId, menge, {
    interval: intervallAus(item),
    stripeSubscriptionId: abo ? sub.id : undefined,
    stripeSubscriptionItemId: item && item.id,
    /* v3610 · neuere API-Fassung der Ereignisse: Zeitraum an der Position */
    currentPeriodEnd: (sub.current_period_end || (item && item.current_period_end)) ? new Date((sub.current_period_end || item.current_period_end) * 1000) : null
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
  /* v3610 · beim Partner-Plan laeuft danach der normale Plan-Zweig (subscriptions) weiter */
  const r0 = await _seats(deps, typ, obj, resellerId);
  return istPartnerPlan(obj) ? Object.assign(r0, { weiter: r0.handled !== false }) : r0;
}

async function _seats(deps, typ, obj, resellerId) {

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
    const menge = platzMenge(sub);
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
      menge = platzMenge(sub);
    } else {
      return { handled: true, aktion: 'uebersprungen', grund: 'status_' + sub.status };
    }
    /* v3357 · erst die Frist (gibt die Plaetze in den Pool), dann abgleichen - so baut der Abgleich sie ab */
    let ende = null;
    /* v3610 · im Partner-Plan-Abo heisst Menge 0 nur „keine Plaetze gebucht", nicht „Abo zu Ende" -
       die Frist laeuft dort nur, wenn das Abo wirklich endet */
    const endet = typ === 'customer.subscription.deleted' || BEENDET.has(sub.status);
    if ((istPartnerPlan(sub) ? endet : menge === 0) && typeof deps.aboEnde === 'function') { try { ende = await deps.aboEnde(resellerId); } catch (e) { ende = { fehler: e.message }; } }
    /* v3610 · im Partner-Plan-Abo bleibt die Abo-ID am Reseller auch bei 0 Plaetzen, solange es laeuft */
    const aboBleibt = menge > 0 || (istPartnerPlan(sub) && BEZAHLT.has(sub.status) && typ !== 'customer.subscription.deleted');
    const pool = await abgleichen(deps, resellerId, sub, menge, aboBleibt);
    /* v3357 · Ende des Partner-Abos: zugewiesene Plaetze laufen in die Frist (wie ein Platzentzug), statt
       10 Jahre Investor zu behalten (Luecke aus dem Konzept 13.11.2026, Abschnitt 1.2) */
    return { handled: true, aktion: 'abgeglichen', menge, pool, abo_ende: ende };
  }

  return { handled: false };
}

module.exports = { handlePartnerSeatsEvent, istPartnerSeats, istPartnerPlan, platzMenge };
