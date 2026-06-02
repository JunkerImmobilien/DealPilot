'use strict';
/**
 * 028 — Marktdaten-(AVM)-Credit-Pakete
 *
 * 1 Credit = 1 Abruf (PriceHubble ODER Sprengnetter). KEIN x2 wie bei KI.
 * Ab Starter-Plan zubuchbar (Gate in routes/credits.js). Credits verfallen nicht.
 *
 * Stripe-Price-IDs:
 *   - Default = LIVE (in Stripe angelegt)
 *   - Staging/Sandbox: per ENV ueberschreiben (STRIPE_PRICE_AVM_*)
 */
const AVM_PACKS = {
  avm_1: {
    id: 'avm_1', kind: 'avm', label: 'Einzelabruf',
    credits: 1, amount_cents: 799, currency: 'eur',
    stripe_price_id: process.env.STRIPE_PRICE_AVM_1 || 'price_1TdWIEGefFev8arzqq1bCJXV',
    popular: false
  },
  avm_5: {
    id: 'avm_5', kind: 'avm', label: 'Mehrere Objekte',
    credits: 5, amount_cents: 3795, currency: 'eur',
    stripe_price_id: process.env.STRIPE_PRICE_AVM_5 || 'price_1TdWIIGefFev8arzcxm3e3ZT',
    popular: true
  },
  avm_10: {
    id: 'avm_10', kind: 'avm', label: 'Aktiver Investor',
    credits: 10, amount_cents: 6990, currency: 'eur',
    stripe_price_id: process.env.STRIPE_PRICE_AVM_10 || 'price_1TdWIMGefFev8arzMAjvvrd6',
    popular: false
  },
  avm_25: {
    id: 'avm_25', kind: 'avm', label: 'Profi / Sachverst\u00e4ndiger',
    credits: 25, amount_cents: 15975, currency: 'eur',
    stripe_price_id: process.env.STRIPE_PRICE_AVM_25 || 'price_1TdWIQGefFev8arzPp0LP5cp',
    popular: false
  }
};

function getPack(packId) { return AVM_PACKS[packId] || null; }
function getPackByPriceId(priceId) {
  return Object.values(AVM_PACKS).find(function (p) { return p.stripe_price_id === priceId; }) || null;
}
function listPacks() { return Object.values(AVM_PACKS); }

module.exports = { AVM_PACKS, getPack, getPackByPriceId, listPacks };
