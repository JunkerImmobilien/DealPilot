/* partner-seats-webhook-pruefen.mjs · v3303
   Prueft den Abgleich der Mandanten-Plaetze ueber den Stripe-Webhook
   (backend/src/services/partnerSeatsWebhook.js) mit nachgebauten Ereignissen —
   ohne Stripe, ohne Datenbank. Gerechnet wird mit der ECHTEN
   resellerService.syncPoolQuantity(); nur db/pool ist durch eine kleine
   In-Memory-Tabelle licenses/resellers ersetzt, die genau die drei SQL-Formen
   der Funktion versteht (Zaehlen, INSERT generate_series, DELETE freie Pool-Zeilen).

   Geprueft: INKLUSIV_MANDANTEN = 0 (Marcel 11.11.2026), Checkout bucht, doppelte
   Zustellung aendert nichts, Mengenaenderung, Kuendigung baut nur FREIE Plaetze ab,
   zugewiesene bleiben, fremdes Abo und incomplete werden uebersprungen,
   Nicht-Seat-Ereignisse laufen weiter in den normalen Zweig.
   RC=0 ist sauber. */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'backend', 'src');

// ── In-Memory-Datenbank ─────────────────────────────────────────
const db = { licenses: [], resellers: new Map(), seq: 0 };
async function query(sql, p = []) {
  const s = sql.replace(/\s+/g, ' ').trim();
  if (/^SELECT id, stripe_subscription_id FROM resellers/.test(s)) {
    const r = db.resellers.get(p[0]); return { rows: r ? [r] : [], rowCount: r ? 1 : 0 };
  }
  if (/COUNT\(\*\) FILTER/.test(s)) {
    /* v3317b · reservierte Plaetze (Objekt-Uebergabe) zaehlen nur, wenn das SQL die Bedingung fuehrt */
    const l = db.licenses.filter(x => x.reseller_id === p[0] && x.kind === 'client');
    const kenntRes = /reserviert_fuer/.test(s);
    const istFrei = (x) => x.status === 'pool' && !(kenntRes && x.reserviert);
    return { rows: [{ gekauft: l.length, zugewiesen: l.filter(x => x.status === 'zugewiesen').length,
                      frei: l.filter(istFrei).length, reserviert: l.filter(x => x.status === 'pool' && !istFrei(x)).length }] };
  }
  if (/^INSERT INTO licenses/.test(s)) {
    for (let i = 0; i < p[4]; i++) db.licenses.push({ id: ++db.seq, reseller_id: p[0], kind: 'client',
      status: 'pool', billing_cycle: p[1], created_at: db.seq });
    return { rows: [], rowCount: p[4] };
  }
  if (/^DELETE FROM licenses/.test(s)) {
    const kenntRes = /reserviert_fuer/.test(s);   /* v3317b · ohne die Bedingung baute der Abgleich reservierte Plaetze ab */
    const frei = db.licenses.filter(x => x.reseller_id === p[0] && x.kind === 'client' && x.status === 'pool' && !(kenntRes && x.reserviert))
      .sort((a, b) => a.created_at - b.created_at).slice(0, p[1]).map(x => x.id);
    db.licenses = db.licenses.filter(x => !frei.includes(x.id));
    return { rows: [], rowCount: frei.length };
  }
  if (/^UPDATE resellers SET stripe_subscription_id/.test(s)) {
    const r = db.resellers.get(p[0]); if (r) r.stripe_subscription_id = p[1]; return { rows: [], rowCount: r ? 1 : 0 };
  }
  throw new Error('unbekanntes SQL im Pruefer: ' + s.slice(0, 80));
}
// Module vor dem Laden ersetzen (resellerService zieht db/pool und planService)
const stub = (rel, exp) => { const f = require.resolve(join(SRC, rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports: exp }; };
stub('db/pool.js', { query, pool: { query } });
stub('services/planService.js', {});
stub('services/stripeService.js', {});

const reseller = require(join(SRC, 'services', 'resellerService.js'));
const { handlePartnerSeatsEvent } = require(join(SRC, 'services', 'partnerSeatsWebhook.js'));

// ── nachgebautes Stripe ─────────────────────────────────────────
const abos = new Map();
const deps = { query, syncPoolQuantity: reseller.syncPoolQuantity, getSubscription: async id => abos.get(id) };
const abo = (id, rid, qty, status = 'active', iv = 'month') => ({ id, object: 'subscription', status,
  metadata: { kind: 'partner_seats', reseller_id: rid, userId: 'u-' + rid },
  current_period_end: 1800000000, items: { data: [{ id: 'si_' + id, quantity: qty, price: { recurring: { interval: iv } } }] } });
const ev = (type, object) => ({ id: 'evt_' + Math.random().toString(36).slice(2), type, data: { object } });
const pool = async rid => reseller.getPool(rid);

let fehler = 0, n = 0;
const ok = (bed, text) => { n++; if (!bed) { fehler++; console.log('  ROT  ' + text); } else console.log('  ok   ' + text); };

// 0 · Konstante
ok(reseller.INKLUSIV_MANDANTEN === 0, 'INKLUSIV_MANDANTEN = 0 (Marcel 11.11.2026)');

// 1 · frischer Partner ohne Kauf
db.resellers.set('r1', { id: 'r1', stripe_subscription_id: null });
let p = await pool('r1');
ok(p.gekauft === 0 && p.inklusiv === 0 && p.bezahlt === 0, 'frischer Partner: Pool 0, inklusiv 0');
await reseller.syncPoolQuantity('r1', 0);
p = await pool('r1'); ok(p.gekauft === 0, 'Abgleich mit 0 gekauften Plaetzen ergibt 0 (frueher 3)');

// 2 · Checkout abgeschlossen, 5 Plaetze
abos.set('sub_A', abo('sub_A', 'r1', 5));
const sess = { id: 'cs_1', object: 'checkout.session', mode: 'subscription', subscription: 'sub_A',
  metadata: { kind: 'partner_seats', reseller_id: 'r1', userId: 'u-r1' } };
let r = await handlePartnerSeatsEvent(ev('checkout.session.completed', sess), deps);
p = await pool('r1');
ok(r.handled && r.menge === 5 && p.gekauft === 5 && p.frei === 5, 'checkout.session.completed bucht 5 Plaetze');
ok(db.resellers.get('r1').stripe_subscription_id === 'sub_A', 'Abo-ID am Reseller gesetzt');
ok(p.inklusiv === 0 && p.bezahlt === 5, 'getPool: inklusiv 0, bezahlt 5');

// 3 · doppelte Zustellung + Ruecksprung-Weg danach
await handlePartnerSeatsEvent(ev('checkout.session.completed', sess), deps);
await handlePartnerSeatsEvent(ev('customer.subscription.updated', abos.get('sub_A')), deps);
p = await pool('r1'); ok(p.gekauft === 5, 'doppelt zugestellt + updated: weiterhin 5 (idempotent)');

// 4 · drei Plaetze vergeben, dann Menge 5 -> 2
db.licenses.filter(x => x.reseller_id === 'r1').slice(0, 3).forEach(x => { x.status = 'zugewiesen'; });
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', abo('sub_A', 'r1', 2)), deps);
p = await pool('r1');
ok(p.gekauft === 3 && p.zugewiesen === 3 && p.frei === 0, 'Menge 5 -> 2 bei 3 vergebenen: 3 bleiben (nur freie abgebaut)');

// 5 · Erhoehung 2 -> 8
await handlePartnerSeatsEvent(ev('customer.subscription.updated', abo('sub_A', 'r1', 8, 'active', 'year')), deps);
p = await pool('r1'); ok(p.gekauft === 8 && p.zugewiesen === 3 && p.frei === 5, 'Menge -> 8: 5 freie dazu, 3 vergebene unveraendert');
ok(db.licenses.filter(x => x.reseller_id === 'r1' && x.billing_cycle === 'jaehrlich').length === 5, 'neue Plaetze tragen jaehrlich');

// 6 · fremdes (altes) Abo darf nicht ueberschreiben
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', abo('sub_ALT', 'r1', 1)), deps);
p = await pool('r1'); ok(r.grund === 'anderes_abo' && p.gekauft === 8, 'anderes Abo: uebersprungen, Pool bleibt 8');

// 7 · incomplete wird uebersprungen, past_due behaelt die Menge
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', abo('sub_A', 'r1', 8, 'incomplete')), deps);
ok(r.aktion === 'uebersprungen' && (await pool('r1')).gekauft === 8, 'incomplete: uebersprungen');
await handlePartnerSeatsEvent(ev('customer.subscription.updated', abo('sub_A', 'r1', 8, 'past_due')), deps);
ok((await pool('r1')).gekauft === 8, 'past_due: Plaetze bleiben');

// 8 · Kuendigung (deleted) -> 0, vergebene bleiben
r = await handlePartnerSeatsEvent(ev('customer.subscription.deleted', abo('sub_A', 'r1', 8, 'canceled')), deps);
p = await pool('r1'); ok(r.menge === 0 && p.gekauft === 3 && p.zugewiesen === 3 && p.frei === 0, 'Kuendigung: freie weg, 3 vergebene bleiben');
await handlePartnerSeatsEvent(ev('customer.subscription.deleted', abo('sub_A', 'r1', 8, 'canceled')), deps);
ok((await pool('r1')).gekauft === 3, 'Kuendigung doppelt: unveraendert');

// 9 · Altbestand wie Staging-Demo (3 aus altem Aufschlag, alle vergeben), Abgleich mit 0
db.resellers.set('r2', { id: 'r2', stripe_subscription_id: null });
await query('INSERT INTO licenses', ['r2', 'monatlich', null, null, 3]);
db.licenses.filter(x => x.reseller_id === 'r2').forEach(x => { x.status = 'zugewiesen'; });
await reseller.syncPoolQuantity('r2', 0);
p = await pool('r2'); ok(p.gekauft === 3 && p.zugewiesen === 3, 'Altbestand 3 vergebene, Abgleich 0: alle 3 bleiben');

// 9b · v3317b: ein fuer eine Objekt-Uebergabe reservierter Platz zaehlt als belegt und wird nicht abgebaut
db.resellers.set('r3', { id: 'r3', stripe_subscription_id: null });
await reseller.syncPoolQuantity('r3', 3);
db.licenses.filter(x => x.reseller_id === 'r3')[0].reserviert = true;
p = await pool('r3'); ok(p.gekauft === 3 && p.frei === 2 && p.reserviert === 1, 'reservierter Platz: 3 gekauft, 2 frei, 1 reserviert');
await reseller.syncPoolQuantity('r3', 0);
p = await pool('r3'); ok(p.gekauft === 1 && p.reserviert === 1 && p.frei === 0, 'Abgleich auf 0: der reservierte Platz bleibt, die freien gehen');
ok(/reserviert_fuer/.test(reseller.FREI_SQL || ''), 'FREI_SQL fuehrt die Reservierung (eine Stelle fuer Zaehlen, Abbauen, Zuweisen)');

// 10 · fremde Ereignisse laufen in den normalen Zweig
r = await handlePartnerSeatsEvent(ev('checkout.session.completed', { mode: 'subscription', metadata: { userId: 'x' } }), deps);
ok(r.handled === false, 'Plan-Checkout ohne kind: nicht abgefangen');
r = await handlePartnerSeatsEvent(ev('checkout.session.completed', { ...sess, metadata: { kind: 'partner_seats', reseller_id: 'r9' } }), deps);
ok(r.handled && r.grund === 'reseller_unbekannt', 'unbekannter Reseller: uebersprungen, nichts gebucht');

// ══ 11 · v3610 · Partner-Plan per Stripe (services/partnerPlanKauf.js) ═══════════════════════════════
console.log('-- v3610 Partner-Plan-Kauf');
const { readFileSync } = await import('node:fs');
const kauf = require(join(SRC, 'services', 'partnerPlanKauf.js'));
const ROOT = join(SRC, '..', '..');
const text = (rel) => readFileSync(join(ROOT, rel), 'utf8');

// 11a · Checkout ohne Testphase, ohne Rabattcode-Feld - als Objekt UND im Quelltext
const schluessel = (o, acc = []) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { acc.push(k); schluessel(o[k], acc); } return acc; };
const cp = (plaetze) => kauf.checkoutParameter({ kundeId: 'cus_X', planPreisId: 'price_plan_m', seatPreisId: 'price_seat_m', plaetze,
  resellerId: 'r7', userId: 'u7', successUrl: 'https://x/s', cancelUrl: 'https://x/c' });
const c5 = cp(5), c0 = cp(0);
ok(!schluessel(c5).some(k => /trial/i.test(k)) && !schluessel(c0).some(k => /trial/i.test(k)), 'Checkout: kein trial-Schluessel (trial_period_days, trial_end, trial_settings)');
ok(!('allow_promotion_codes' in c5) && !('discounts' in c5), 'Checkout: kein Rabattcode-Feld, kein Rabatt (keine Testphase durch die Hintertuer)');
ok(c5.mode === 'subscription' && c5.payment_method_collection === 'always', 'Checkout: Abo, Zahlungsart immer verlangt');
ok(c5.line_items.length === 2 && c5.line_items[0].price === 'price_plan_m' && c5.line_items[0].quantity === 1
   && c5.line_items[1].price === 'price_seat_m' && c5.line_items[1].quantity === 5, 'Checkout 5 Plaetze: Plan x1 + Plaetze x5 in EINEM Abo');
ok(c0.line_items.length === 1 && c0.line_items[0].price === 'price_plan_m', 'Checkout 0 Plaetze: nur der Plan (0 Plaetze erlaubt)');
ok(c5.metadata.kind === 'partner_plan' && c5.subscription_data.metadata.kind === 'partner_plan'
   && c5.subscription_data.metadata.reseller_id === 'r7', 'Metadaten partner_plan an Sitzung und Abo');
ok(cp(-3).line_items.length === 1 && cp(9999).line_items[1].quantity === kauf.MAX_PLAETZE, 'Plaetze begrenzt: negativ = 0, Obergrenze ' + kauf.MAX_PLAETZE);
const qKauf = text('backend/src/services/partnerPlanKauf.js'), qSub = text('backend/src/routes/subscription.js');
ok(!/trial_period_days\s*:|trial_end\s*:|allow_promotion_codes\s*:|discounts\s*:/.test(qKauf), 'Quelltext partnerPlanKauf.js: keine Zuweisung von trial_*/Rabatt');
ok(/partnerCheckoutSchema[\s\S]{0,600}\.strict\(\)/.test(qSub), 'Route partner/checkout: Schema strict (promo/trial wird abgewiesen)');
ok(/plan\.id === 'partner'\) throw new HttpError\(400/.test(qSub), 'allgemeiner /subscription/checkout nimmt den Partner-Plan nicht an (kein Umweg mit Rabattcode)');

// 11b · Staffel: Stripe-Form (tiers_mode volume, gemessen 17.11.2026 in der Sandbox) gegen Landing und Cockpit-Vorschau
const T_M = [{ up_to: 9, unit_amount: 1900 }, { up_to: 24, unit_amount: 1500 }, { up_to: null, unit_amount: 1200 }];
const T_J = [{ up_to: 9, unit_amount: 20900 }, { up_to: 24, unit_amount: 16500 }, { up_to: null, unit_amount: 13200 }];
const s = (t, nn, m = 'volume') => kauf.staffelSumme(t, m, nn);
ok(s(T_M, 0) === 0 && s(T_M, 1) === 1900 && s(T_M, 9) === 17100, 'Staffel monatlich: 0 -> 0, 1 -> 19 EUR, 9 -> 171 EUR');
ok(s(T_M, 10) === 15000 && s(T_M, 24) === 36000 && s(T_M, 25) === 30000, 'Volume: 10 -> 150 EUR, 24 -> 360 EUR, 25 -> 300 EUR (alle Plaetze zum Satz der Stufe)');
ok(s(T_J, 10) === 165000 && s(T_J, 1) === 20900, 'Staffel jaehrlich: 1 -> 209 EUR, 10 -> 1.650 EUR (11 Monatsraten)');
ok(s(T_M, 10, 'graduated') === 9 * 1900 + 1500, 'Gegenprobe graduated rechnet anders (10 -> 186 EUR) - die Form ist pruefbar');
const land = text('frontend/landing/partner.html');
ok(/1 – 9 MANDANTEN<\/div><div class="pv">19 € \/ Platz/.test(land) && /10 – 24 MANDANTEN<\/div><div class="pv">15 € \/ Platz/.test(land)
   && /AB 25 MANDANTEN<\/div><div class="pv">12 € \/ Platz/.test(land), 'Landing partner.html: 1-9 19 EUR, 10-24 15 EUR, ab 25 12 EUR = Stripe-Stufen');
ok(/data-m="99 €" data-j="1.089 €"/.test(land), 'Landing partner.html: 99 EUR / 1.089 EUR');
ok(/desto günstiger jeder einzelne Platz/.test(land), 'Landing beschreibt Volume (jeder Platz wird guenstiger) - passt zu tiers_mode volume');
const rp = text('frontend/js/reseller-portal.js');
ok(/bis: 9,\s+monat: 19, jahr: 209/.test(rp) && /bis: 24,\s+monat: 15, jahr: 165/.test(rp) && /bis: Infinity, monat: 12, jahr: 132/.test(rp), 'Cockpit-Vorschau STAFFEL = Stripe-Stufen');

// 11c · Plaetze reduzieren: Untergrenze belegt + reserviert; Proration
ok(kauf.mindestPlaetze({ gekauft: 8, zugewiesen: 2, reserviert: 1, frei: 5 }) === 3, 'Untergrenze = zugewiesen 2 + reserviert 1 = 3');
ok(kauf.mindestPlaetze({}) === 0, 'Untergrenze ohne Pool: 0');
ok(kauf.proration(3, 5) === 'always_invoice' && kauf.proration(5, 3) === 'create_prorations', 'mehr Plaetze sofort anteilig, weniger als Gutschrift');

// 11d · Webhook: Partner-Plan-Abo mit zwei Positionen
const ppAbo = (id, rid, qty, status = 'active', extra = {}) => ({ id, object: 'subscription', status, cancel_at_period_end: false, ...extra,
  metadata: { kind: 'partner_plan', reseller_id: rid, userId: 'u-' + rid }, current_period_end: 1800000000,
  items: { data: [{ id: 'si_plan_' + id, quantity: 1, price: { id: 'price_plan', lookup_key: 'dp_plan_partner_monthly', recurring: { interval: 'month' } } }]
    .concat(qty > 0 ? [{ id: 'si_seat_' + id, quantity: qty, price: { id: 'price_seat', lookup_key: 'dp_seat_monthly', recurring: { interval: 'month' } } }] : []) } });
let aboEndeAufrufe = 0;
const deps2 = { ...deps, aboEnde: async () => { aboEndeAufrufe++; return { kunden: 0 }; } };
db.resellers.set('r7', { id: 'r7', stripe_subscription_id: null });
abos.set('sub_P', ppAbo('sub_P', 'r7', 3));
const sessP = { id: 'cs_P', object: 'checkout.session', mode: 'subscription', subscription: 'sub_P', metadata: { kind: 'partner_plan', reseller_id: 'r7', userId: 'u-r7' } };
r = await handlePartnerSeatsEvent(ev('checkout.session.completed', sessP), deps2);
p = await pool('r7');
ok(r.handled && r.weiter === true && r.menge === 3 && p.gekauft === 3, 'checkout partner_plan: 3 Plaetze (nicht die Plan-Menge 1), weiter in den Plan-Zweig');
ok(db.resellers.get('r7').stripe_subscription_id === 'sub_P', 'Abo-ID am Reseller gesetzt');
await handlePartnerSeatsEvent(ev('checkout.session.completed', sessP), deps2);
await handlePartnerSeatsEvent(ev('customer.subscription.created', abos.get('sub_P')), deps2);
ok((await pool('r7')).gekauft === 3, 'doppelt zugestellt + created: weiterhin 3 (idempotent)');
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_P', 'r7', 7)), deps2);
ok((await pool('r7')).gekauft === 7 && r.weiter, 'nachgekauft 3 -> 7');
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_P', 'r7', 7, 'active', { cancel_at_period_end: true })), deps2);
ok((await pool('r7')).gekauft === 7 && aboEndeAufrufe === 0 && r.weiter, 'gekuendigt zum Periodenende: Plaetze bleiben bis zum Ende, keine Frist');
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_P', 'r7', 0)), deps2);
ok((await pool('r7')).gekauft === 0 && aboEndeAufrufe === 0 && db.resellers.get('r7').stripe_subscription_id === 'sub_P',
  'Plaetze auf 0, Plan laeuft: keine Frist fuer Kunden, Abo-ID bleibt');
db.licenses.filter(x => x.reseller_id === 'r7').length === 0 && await reseller.syncPoolQuantity('r7', 2);
db.licenses.filter(x => x.reseller_id === 'r7')[0].status = 'zugewiesen';
r = await handlePartnerSeatsEvent(ev('customer.subscription.deleted', ppAbo('sub_P', 'r7', 2, 'canceled')), deps2);
p = await pool('r7');
ok(aboEndeAufrufe === 1 && r.menge === 0 && p.frei === 0 && p.zugewiesen === 1 && r.weiter, 'Abo endet (deleted): Frist fuer die Platz-Kunden (aboEnde), freie Plaetze weg, Plan-Zweig laeuft weiter');
r = await handlePartnerSeatsEvent(ev('customer.subscription.updated', ppAbo('sub_FREMD', 'r7', 9)), deps2);
ok(r.grund === 'anderes_abo' && r.weiter === true, 'fremdes Abo: Plaetze unberuehrt, Plan-Zweig entscheidet selbst');
ok(kauf.seatPosition(ppAbo('x', 'r7', 4)).quantity === 4 && kauf.planPosition(ppAbo('x', 'r7', 4)).quantity === 1, 'Positionen: Platz ueber dp_seat_*, Plan ueber dp_plan_*');
ok(kauf.seatPosition(abo('y', 'r1', 6)).quantity === 6, 'altes Platz-Abo (partner_seats, ohne lookup_key): erste Position');

// 11e · Kuendigung: Kundenportal-Ablauf fuer genau dieses Abo, Folgen aus der bestehenden Regel
ok(/flow_data:\s*\{\s*type:\s*'subscription_cancel'/.test(qKauf), 'Kuendigung ueber das Stripe-Kundenportal (flow subscription_cancel), wie die normalen Plaene');
const qPk = text('backend/src/services/partnerKunden.js');
ok(/const ENTZUG_FRIST_TAGE = 30;/.test(qPk) && /require\('\.\/partnerKunden'\)[\s\S]{0,900}ENTZUG_FRIST_TAGE/.test(qKauf), 'Folgen-Anzeige liest die Frist aus partnerKunden.js (30 Tage), keine eigene Zahl');
const qWh = text('backend/src/routes/stripeWebhook.js');
ok(/if \(!r\.weiter\) return;/.test(qWh) && /planAusAbo\(sub\)/.test(qWh), 'stripeWebhook: Partner-Plan laeuft nach den Plaetzen in den Plan-Zweig, Plan-Preis aus allen Positionen');

// 11f · Ereignisse in neuerer API-Fassung (gemessen: 2026-04-22.dahlia) tragen den Zeitraum an der Position
const qSs = text('backend/src/services/subscriptionService.js');
ok(/_pos\.current_period_end/.test(qSs), 'upsertFromStripe: Laufzeitende aus items.data[0], wenn das Abo keins traegt (sonst NULL nach jedem Webhook)');

console.log((fehler ? 'ROT' : 'SAUBER') + ': ' + (n - fehler) + '/' + n + ' Punkte');
process.exit(fehler ? 1 : 0);
