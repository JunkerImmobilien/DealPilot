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
    const l = db.licenses.filter(x => x.reseller_id === p[0] && x.kind === 'client');
    return { rows: [{ gekauft: l.length, zugewiesen: l.filter(x => x.status === 'zugewiesen').length,
                      frei: l.filter(x => x.status === 'pool').length }] };
  }
  if (/^INSERT INTO licenses/.test(s)) {
    for (let i = 0; i < p[4]; i++) db.licenses.push({ id: ++db.seq, reseller_id: p[0], kind: 'client',
      status: 'pool', billing_cycle: p[1], created_at: db.seq });
    return { rows: [], rowCount: p[4] };
  }
  if (/^DELETE FROM licenses/.test(s)) {
    const frei = db.licenses.filter(x => x.reseller_id === p[0] && x.kind === 'client' && x.status === 'pool')
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

// 10 · fremde Ereignisse laufen in den normalen Zweig
r = await handlePartnerSeatsEvent(ev('checkout.session.completed', { mode: 'subscription', metadata: { userId: 'x' } }), deps);
ok(r.handled === false, 'Plan-Checkout ohne kind: nicht abgefangen');
r = await handlePartnerSeatsEvent(ev('checkout.session.completed', { ...sess, metadata: { kind: 'partner_seats', reseller_id: 'r9' } }), deps);
ok(r.handled && r.grund === 'reseller_unbekannt', 'unbekannter Reseller: uebersprungen, nichts gebucht');

console.log((fehler ? 'ROT' : 'SAUBER') + ': ' + (n - fehler) + '/' + n + ' Punkte');
process.exit(fehler ? 1 : 0);
