/* einzelcheck-2 (24.11.2026) · Stripe fuer den Einzel-Check pruefen und vorbereiten. Laeuft IM Backend-Container
   (dort liegt der passende Schluessel in process.env, er wird nie ausgegeben):

     docker cp tools/einzelcheck-stripe-vorbereiten.js dealpilot-backend:/app/ec-stripe.js
     docker exec dealpilot-backend node /app/ec-stripe.js            # nur lesen
     docker exec dealpilot-backend node /app/ec-stripe.js --anlegen  # fehlende Teile anlegen
     docker exec dealpilot-backend rm /app/ec-stripe.js

   Liest: Preis dp_einzelcheck_399 (3,99 € einmalig), Coupon dp_einzelcheck_anrechnung (Anrechnung 3,99 €, einmal),
   Coupon/Code DEALCHECK10 (10 % auf die erste Rechnung eines Abos, Vorschlag, nur nach Marcels Ja live anlegen).
   --anlegen legt NUR an, was fehlt, und nur in dem Konto, dessen Schluessel im Container liegt.
   Im Live-Konto (sk_live) braucht --anlegen zusaetzlich --live-ja. */
const Stripe = require('stripe');
const s = Stripe(process.env.STRIPE_SECRET_KEY);
const anlegen = process.argv.includes('--anlegen');
const liveJa = process.argv.includes('--live-ja');
const mitZehn = process.argv.includes('--dealcheck10');
(async () => {
  const modus = String(process.env.STRIPE_SECRET_KEY || '').slice(0, 7);
  const konto = await s.accounts.retrieve().then((a) => a.id).catch(() => '?');
  console.log('Konto', konto, 'Modus', modus);
  if (anlegen && modus === 'sk_live' && !liveJa) { console.log('Live-Konto: --anlegen nur mit --live-ja'); process.exit(2); }
  /* 1 Preis */
  const pr = await s.prices.list({ lookup_keys: ['dp_einzelcheck_399'], active: true, limit: 1 });
  if (pr.data.length) console.log('Preis dp_einzelcheck_399 da:', pr.data[0].id, pr.data[0].unit_amount, pr.data[0].type);
  else if (anlegen) {
    const prod = await s.products.create({ name: 'DealPilot Einzel-Check', description: 'Bericht mit Bewertung, Finanzierung und Marktbericht als PDF, einmalig, ohne Abo', metadata: { dp_kind: 'einzelcheck' } });
    const p = await s.prices.create({ product: prod.id, unit_amount: 399, currency: 'eur', lookup_key: 'dp_einzelcheck_399', tax_behavior: 'unspecified' });
    console.log('Preis angelegt:', p.id);
  } else console.log('Preis dp_einzelcheck_399 FEHLT');
  /* 2 Anrechnungs-Coupon (Webhook legt je Kauf einen eigenen Code darauf an) */
  try { const c = await s.coupons.retrieve('dp_einzelcheck_anrechnung'); console.log('Coupon dp_einzelcheck_anrechnung da:', c.amount_off, c.currency, c.duration); }
  catch (e) {
    if (anlegen) { const c = await s.coupons.create({ id: 'dp_einzelcheck_anrechnung', name: 'Einzel-Check angerechnet', amount_off: 399, currency: 'eur', duration: 'once' }); console.log('Coupon angelegt:', c.id); }
    else console.log('Coupon dp_einzelcheck_anrechnung FEHLT');
  }
  /* 3 DEALCHECK10 (nur mit --dealcheck10) */
  const pc = await s.promotionCodes.list({ code: 'DEALCHECK10', active: true, limit: 1 });
  console.log('Code DEALCHECK10:', pc.data.length ? 'aktiv ' + pc.data[0].id : 'nicht angelegt');
  if (mitZehn && anlegen && !pc.data.length) {
    const keys = ['dp_plan_starter_monthly', 'dp_plan_investor_monthly', 'dp_plan_pro_monthly'];
    const prods = [...new Set((await s.prices.list({ lookup_keys: keys, limit: 10 })).data.map((p) => p.product))];
    const c = await s.coupons.create({ name: 'Einzel-Check · 10 % im ersten Monat', percent_off: 10, duration: 'once', applies_to: { products: prods } });
    const neu = await s.promotionCodes.create({ coupon: c.id, code: 'DEALCHECK10', restrictions: { first_time_transaction: true } });
    console.log('DEALCHECK10 angelegt:', neu.id, 'Produkte', prods.length);
  }
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
