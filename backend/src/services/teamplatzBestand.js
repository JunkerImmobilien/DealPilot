'use strict';
/**
 * teamplatzBestand.js · v3947a — kostenlose Bestands-Teamplaetze zaehlen in der Staffel mit (Marcel 22.11.2026)
 *
 *   Ein Partnerkonto mit k kostenlosen Teamplaetzen (resellers.team_plaetze, Bestand vor v3947 oder Admin) zahlt fuer
 *   seinen naechsten Login den Satz der Stufe, in die der (1 + k + 1). Login faellt, nicht automatisch die erste Stufe.
 *
 *   Umsetzung in Stripe (gemessen: eine Position mit negativem Betrag gibt es nicht, unit_amount >= 0):
 *     Menge der Position dp_teamplatz_*  = k + b   (b = bezahlte Teamplaetze)
 *     Rabatt AN DIESER POSITION          = Kosten der ersten k Plaetze nach derselben Staffel (Coupon amount_off,
 *                                          duration forever, applies_to nur das Teamplatz-Produkt)
 *     Stripe berechnet                   = staffel(k + b) - staffel(k)
 *     metadata.bestand an der Position   = k  -> Webhook und Cockpit rechnen b = Menge - k
 *   Ohne Bestand (k = 0, jedes neue Konto) gibt es weder Coupon noch Metadaten-Abzug: Menge = b.
 *
 *   Coupon-ID enthaelt Intervall, k und Betrag (dp_teamplatz_bestand_monthly_5_27100): aendert sich die Staffel in
 *   Stripe, entsteht ein neuer Coupon, ein alter wird nie umgedeutet.
 *
 *   Eigene Datei, nicht in partnerPlanKauf.js: dort gilt „kein Rabatt im Checkout“ (tools/partner-seats-webhook-pruefen.mjs
 *   prueft den Quelltext). Dieser Rabatt sitzt nur an der Teamplatz-Position und entsteht nur aus dem Bestand.
 *   Rechnung gespiegelt in frontend/js/teamplatz-staffel.js (summeBezahlt), tools/teamplatz-pruefen.mjs haelt beide gleich.
 */

function zahl(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; }

/** Graduierte Summe in Cent ueber Stripe-tiers ({up_to, unit_amount, flat_amount}). */
function staffel(tiers, n) {
  let rest = zahl(n), unten = 0, summe = 0;
  for (const t of tiers || []) {
    if (rest <= 0) break;
    const oben = (t.up_to == null || t.up_to === 'inf') ? Infinity : Number(t.up_to);
    const k = Math.max(0, Math.min(rest, oben - unten));
    if (k > 0) summe += k * (t.unit_amount || 0) + (t.flat_amount || 0);
    rest -= k; unten = oben;
  }
  return summe;
}

/** Was b bezahlte Plaetze bei k Bestand kosten (Cent): staffel(k + b) - staffel(k). */
function summeBezahlt(tiers, bestand, bezahlt) { const k = zahl(bestand); return staffel(tiers, k + zahl(bezahlt)) - staffel(tiers, k); }

/** Bezahlte Plaetze aus einer Abo-Position: Menge minus metadata.bestand. */
function bezahltAusPosition(pos) {
  if (!pos) return 0;
  return Math.max(0, (pos.quantity || 0) - zahl(pos.metadata && pos.metadata.bestand));
}

/** Coupon fuer k Bestandsplaetze, rein. null bei k = 0. */
function couponParameter(bestand, intervall, preis) {
  const k = zahl(bestand);
  if (!k || !preis) return null;
  const betrag = staffel(preis.tiers, k);
  if (!betrag) return null;
  const iv = intervall === 'yearly' ? 'yearly' : 'monthly';
  return {
    id: 'dp_teamplatz_bestand_' + iv + '_' + k + '_' + betrag,
    amount_off: betrag, currency: 'eur', duration: 'forever',
    name: 'Teamplätze Bestand (' + k + ')',
    applies_to: { products: [typeof preis.product === 'string' ? preis.product : preis.product && preis.product.id] },
    metadata: { dp_key: 'teamplatz_bestand', bestand: String(k), intervall: iv }
  };
}

/** Felder der Teamplatz-Position fuer subscriptions.update (ohne id/price): Menge, Bestand, Rabatt. */
function positionFelder(bestand, bezahlt, couponId) {
  const k = zahl(bestand);
  return { quantity: k + zahl(bezahlt), metadata: { bestand: String(k) }, discounts: couponId ? [{ coupon: couponId }] : '' };
}

/** Coupon anlegen, falls er fehlt (idempotent ueber die ID). Liefert die ID oder null. */
async function couponSicherstellen(stripe, bestand, intervall, preis) {
  const p = couponParameter(bestand, intervall, preis);
  if (!p) return null;
  try { await stripe.coupons.retrieve(p.id); return p.id; } catch (e) { if (e && e.statusCode && e.statusCode !== 404) throw e; }
  await stripe.coupons.create(p);
  return p.id;
}

module.exports = { staffel, summeBezahlt, bezahltAusPosition, couponParameter, positionFelder, couponSicherstellen };
