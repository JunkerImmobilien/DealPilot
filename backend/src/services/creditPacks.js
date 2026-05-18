'use strict';
/**
 * V197: Credit-Pack-Definitionen
 *
 * Pricing entspricht dem Marketing-Screenshot:
 *   - 5 Credits / 10 Anfragen für 2€
 *   - 15 Credits / 30 Anfragen für 5€
 *   - 40 Credits / 80 Anfragen für 12€
 *   - 100 Credits / 200 Anfragen für 25€
 *
 * 1 Credit = 2 Anfragen.
 *
 * Da `ai_credits_log.cost` ein INTEGER ist und nicht 0.5 speichern kann,
 * rechnen wir intern in "Anfragen-Einheiten":
 *   - credits_granted ist die ANZEIGE (Marketing)
 *   - bonus_credits in der DB ist die ANZAHL DER ANFRAGEN (= credits_granted * 2)
 *
 * Beispiel: Pack 5 → User sieht "+5 Credits", DB speichert bonus_credits += 10.
 *
 * Stripe-Price-IDs sind aus dem Test-Mode (Stand 2026-05-17).
 */

const CREDIT_PACKS = {
  pack_5: {
    id: 'pack_5',
    label: 'Mal schnell prüfen',
    credits: 5,
    requests: 10,
    bonus_credits_units: 10,    // wird in ai_credits_user.bonus_credits gespeichert
    amount_cents: 200,
    currency: 'eur',
    price_per_request_cents: 20,
    stripe_product_id: 'prod_UXBhsps2EUMoeL',
    stripe_price_id:   'price_1TY8E2KEjyPDo0wokbI5oIPV',
    popular: false
  },
  pack_15: {
    id: 'pack_15',
    label: 'Mehrere Deals',
    credits: 15,
    requests: 30,
    bonus_credits_units: 30,
    amount_cents: 500,
    currency: 'eur',
    price_per_request_cents: 17,
    stripe_product_id: 'prod_UXCdXtnTCFOnOC',
    stripe_price_id:   'price_1TY8EFKEjyPDo0wooJK1uioi',
    popular: false
  },
  pack_40: {
    id: 'pack_40',
    label: 'Aktiver Investor',
    credits: 40,
    requests: 80,
    bonus_credits_units: 80,
    amount_cents: 1200,
    currency: 'eur',
    price_per_request_cents: 15,
    stripe_product_id: 'prod_UXCdCcDy70NZF4',
    stripe_price_id:   'price_1TY8EQKEjyPDo0wo9tRixXAe',
    popular: true
  },
  pack_100: {
    id: 'pack_100',
    label: 'Profi / Sachverständiger',
    credits: 100,
    requests: 200,
    bonus_credits_units: 200,
    amount_cents: 2500,
    currency: 'eur',
    price_per_request_cents: 13,
    stripe_product_id: 'prod_UXCdQ39azqGjEp',
    stripe_price_id:   'price_1TY8EcKEjyPDo0wo5DYWZ52I',
    popular: false
  }
};

function getPack(packId) {
  return CREDIT_PACKS[packId] || null;
}

function getPackByPriceId(priceId) {
  return Object.values(CREDIT_PACKS).find(p => p.stripe_price_id === priceId) || null;
}

function listPacks() {
  return Object.values(CREDIT_PACKS);
}

module.exports = {
  CREDIT_PACKS,
  getPack,
  getPackByPriceId,
  listPacks
};
