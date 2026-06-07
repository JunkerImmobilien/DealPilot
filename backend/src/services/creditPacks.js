'use strict';
/**
 * V197 → v491: Kerosin-Pack-Definitionen (vorher: KI-Credit-Packs)
 *
 * Staffel (Marketing = Wahrheit):
 *   - kerosin_10:  10 L für  2 €  (0,20 €/L)  "Mal schnell prüfen"
 *   - kerosin_28:  28 L für  5 €  (0,18 €/L)  "Mehrere Deals"
 *   - kerosin_90:  90 L für 15 €  (0,167 €/L) "Aktiver Investor" (BELIEBT)
 *   - kerosin_160: 160 L für 25 € (0,156 €/L) "Maximale Reichweite"
 *
 * 1 Liter = 1 Pilot-Anfrage (kleine Anfrage). Verbrauch je Aktion zieht das
 * Backend ab: klein 1 L · volle Pilot-Analyse 3 L · Sprengnetter 20 L ·
 * PriceHubble 40 L (avm.js COST). Markteinschätzung 2 L / Marktreport 4 L
 * folgen mit der Marktbericht-Integration.
 *
 * DB-Einheit: ai_credits_user.bonus_credits speichert LITER 1:1
 * (bonus_credits_units = liter). Kein x2 mehr wie bei den alten KI-Packs.
 *
 * Stripe: Price-IDs kommen aus ENV (STRIPE_PRICE_KEROSIN_*). Solange E3
 * (Stripe-Produkte anlegen) nicht erledigt ist, sind sie leer und
 * /credits/checkout antwortet mit stripe_price_missing.
 *
 * LEGACY_PACKS: alte pack_5/15/40/100 bleiben auflösbar, damit Webhook-Replays
 * und noch offene pending-Checkout-Sessions sauber verbucht werden können.
 * Sie werden NICHT mehr in listPacks() ausgeliefert (= nicht mehr kaufbar).
 */

const CREDIT_PACKS = {
  kerosin_10: {
    id: 'kerosin_10',
    label: 'Mal schnell prüfen',
    liter: 10,
    credits: 10,                 // Kompat (Webhook/Mails lesen pack.credits)
    bonus_credits_units: 10,     // wird in ai_credits_user.bonus_credits gespeichert (1:1 Liter)
    amount_cents: 200,
    currency: 'eur',
    per_liter_cents: 20,
    flight: '✈ Kurzstrecke',
    reach: '≈ 2 Reports oder 5 Markteinschätzungen',
    gauge: { off: 164.8, deg: -57.6 },
    stripe_price_id: process.env.STRIPE_PRICE_KEROSIN_10 || '',
    popular: false
  },
  kerosin_28: {
    id: 'kerosin_28',
    label: 'Mehrere Deals',
    liter: 28,
    credits: 28,
    bonus_credits_units: 28,
    amount_cents: 500,
    currency: 'eur',
    per_liter_cents: 18,
    flight: '✈✈ Mittelstrecke',
    reach: '≈ 7 Reports oder 14 Markteinschätzungen',
    gauge: { off: 116.6, deg: -14.4 },
    stripe_price_id: process.env.STRIPE_PRICE_KEROSIN_28 || '',
    popular: false
  },
  kerosin_90: {
    id: 'kerosin_90',
    label: 'Aktiver Investor',
    liter: 90,
    credits: 90,
    bonus_credits_units: 90,
    amount_cents: 1500,
    currency: 'eur',
    per_liter_cents: 17,
    flight: '✈✈✈ Langstrecke',
    reach: '≈ 22 Reports oder 45 Markteinschätzungen',
    gauge: { off: 56.3, deg: 39.6 },
    stripe_price_id: process.env.STRIPE_PRICE_KEROSIN_90 || '',
    popular: true
  },
  kerosin_160: {
    id: 'kerosin_160',
    label: 'Maximale Reichweite',
    liter: 160,
    credits: 160,
    bonus_credits_units: 160,
    amount_cents: 2500,
    currency: 'eur',
    per_liter_cents: 16,
    flight: '🌍 Interkontinental',
    reach: '≈ 40 Reports oder 80 Markteinschätzungen',
    gauge: { off: 14.1, deg: 77.4 },
    stripe_price_id: process.env.STRIPE_PRICE_KEROSIN_160 || '',
    popular: false
  }
};

// Alt-Packs: nur noch für Webhook-Replays / offene pending-Sessions auflösbar.
const LEGACY_PACKS = {
  pack_5: {
    id: 'pack_5', label: 'Mal schnell prüfen', credits: 5, requests: 10,
    bonus_credits_units: 10, amount_cents: 200, currency: 'eur',
    price_per_request_cents: 20,
    stripe_product_id: 'prod_UXBhsps2EUMoeL',
    stripe_price_id: process.env.STRIPE_PRICE_PACK_5 || 'price_1TY8E2KEjyPDo0wokbI5oIPV',
    popular: false, legacy: true
  },
  pack_15: {
    id: 'pack_15', label: 'Mehrere Deals', credits: 15, requests: 30,
    bonus_credits_units: 30, amount_cents: 500, currency: 'eur',
    price_per_request_cents: 17,
    stripe_product_id: 'prod_UXCdXtnTCFOnOC',
    stripe_price_id: process.env.STRIPE_PRICE_PACK_15 || 'price_1TY8EFKEjyPDo0wooJK1uioi',
    popular: false, legacy: true
  },
  pack_40: {
    id: 'pack_40', label: 'Aktiver Investor', credits: 40, requests: 80,
    bonus_credits_units: 80, amount_cents: 1200, currency: 'eur',
    price_per_request_cents: 15,
    stripe_product_id: 'prod_UXCdCcDy70NZF4',
    stripe_price_id: process.env.STRIPE_PRICE_PACK_40 || 'price_1TY8EQKEjyPDo0wo9tRixXAe',
    popular: false, legacy: true
  },
  pack_100: {
    id: 'pack_100', label: 'Profi / Sachverständiger', credits: 100, requests: 200,
    bonus_credits_units: 200, amount_cents: 2500, currency: 'eur',
    price_per_request_cents: 13,
    stripe_product_id: 'prod_UXCdQ39azqGjEp',
    stripe_price_id: process.env.STRIPE_PRICE_PACK_100 || 'price_1TY8EcKEjyPDo0wo5DYWZ52I',
    popular: false, legacy: true
  }
};

function getPack(packId) {
  return CREDIT_PACKS[packId] || LEGACY_PACKS[packId] || null;
}

function getPackByPriceId(priceId) {
  return Object.values(CREDIT_PACKS).find(p => p.stripe_price_id === priceId)
      || Object.values(LEGACY_PACKS).find(p => p.stripe_price_id === priceId)
      || null;
}

// Nur kaufbare (neue) Packs — Legacy erscheint nirgends mehr im Frontend.
function listPacks() {
  return Object.values(CREDIT_PACKS);
}

module.exports = {
  CREDIT_PACKS,
  LEGACY_PACKS,
  getPack,
  getPackByPriceId,
  listPacks
};
