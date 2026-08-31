'use strict';
/* ═══ v1186 · Die Preis-IDs kommen aus Stripe, nicht aus einer Migration ═══
   GEMESSEN am 31.08.2026 beim Prod-Rollout, und es waere teuer geworden:
   Migration 065 schreibt die Price-IDs der SANDBOX (`…KEjyPDo0wo…`) fest in
   `plans`. Auf Staging ist das richtig — dort rechnet die App gegen genau
   dieses Konto. Auf Produktion, die mit einem Live-Schluessel gegen
   `…GefFev8arz` rechnet, waere jeder Checkout und jeder Planwechsel mit
   „No such price" gescheitert. **Eine hartverdrahtete Price-ID ist immer
   in genau einer Umgebung falsch, und zwar lautlos.**

   Deshalb steht hier kein einziges `price_…`. Dieses Modul fragt Stripe
   mit dem Schluessel DIESER Umgebung nach den `lookup_key`s — die heissen
   in beiden Konten gleich — und traegt ein, was es findet.

   LAEUFT BEIM START, NACH DEN MIGRATIONEN. Idempotent: es schreibt nur,
   wo sich etwas unterscheidet, und meldet jede Aenderung. Findet es einen
   Schluessel nicht, bleibt der alte Wert stehen — ein fehlender Preis darf
   nie eine funktionierende Abbuchung ueberschreiben.

   NEUE PREISE, NICHT GEAENDERTE: Stripe-Preise werden nie bearbeitet. Wer
   einen Betrag aendert, legt einen neuen Preis mit demselben lookup_key an
   (Stripe loest den alten dabei automatisch ab) — beim naechsten Start
   zieht diese Datei nach. Laufende Abos behalten ihren alten Preis, das
   ist gewollt: ein Bestandskunde zahlt weiter, was er abgeschlossen hat. */

const { query } = require('./pool');

/* plan_id -> die beiden lookup_keys. Namen, keine IDs. */
const PLAN_KEYS = {
  starter:  { monthly: 'dp_plan_starter_monthly',  yearly: 'dp_plan_starter_yearly'  },
  investor: { monthly: 'dp_plan_investor_monthly', yearly: 'dp_plan_investor_yearly' },
  pro:      { monthly: 'dp_plan_pro_monthly',      yearly: 'dp_plan_pro_yearly'      },
  partner:  { monthly: 'dp_plan_partner_monthly',  yearly: 'dp_plan_partner_yearly'  }
};

async function sync(opts) {
  opts = opts || {};
  const trocken = !!opts.dryRun;
  const stripeService = require('../services/stripeService');
  if (!stripeService.isConfigured()) {
    console.warn('[plans-sync] Stripe nicht konfiguriert — uebersprungen');
    return { ok: false, reason: 'stripe_nicht_konfiguriert' };
  }

  const keys = [];
  Object.keys(PLAN_KEYS).forEach(function (p) {
    keys.push(PLAN_KEYS[p].monthly, PLAN_KEYS[p].yearly);
  });

  let gefunden = {};
  try {
    const stripe = stripeService.getStripe();
    /* Stripe nimmt bis zu 10 lookup_keys je Abfrage — acht passen, ein
       neunter Plan braucht Bloecke. */
    const res = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 20 });
    (res.data || []).forEach(function (pr) {
      if (pr.lookup_key) gefunden[pr.lookup_key] = pr;
    });
  } catch (e) {
    console.error('[plans-sync] Stripe nicht erreichbar:', e.message);
    return { ok: false, reason: 'stripe_fehler', message: e.message };
  }

  const aenderungen = [];
  const fehlend = [];

  for (const planId of Object.keys(PLAN_KEYS)) {
    const k = PLAN_KEYS[planId];
    const m = gefunden[k.monthly];
    const y = gefunden[k.yearly];
    if (!m) fehlend.push(k.monthly);
    if (!y) fehlend.push(k.yearly);
    if (!m && !y) continue;

    const ist = await query(
      'SELECT stripe_price_monthly_id, stripe_price_yearly_id,' +
      ' price_monthly_cents, price_yearly_cents FROM plans WHERE id = $1',
      [planId]
    );
    if (!ist.rowCount) { fehlend.push('plan:' + planId); continue; }
    const r = ist.rows[0];

    const neuM = m ? m.id : r.stripe_price_monthly_id;
    const neuY = y ? y.id : r.stripe_price_yearly_id;
    const centM = m && m.unit_amount != null ? m.unit_amount : r.price_monthly_cents;
    const centY = y && y.unit_amount != null ? y.unit_amount : r.price_yearly_cents;

    const gleich = (neuM === r.stripe_price_monthly_id)
                && (neuY === r.stripe_price_yearly_id)
                && (centM === r.price_monthly_cents)
                && (centY === r.price_yearly_cents);
    if (gleich) continue;

    aenderungen.push({
      plan: planId,
      monatlich: { von: r.stripe_price_monthly_id, nach: neuM, cent: centM },
      jaehrlich: { von: r.stripe_price_yearly_id,  nach: neuY, cent: centY }
    });

    if (!trocken) {
      /* Beide Spaltenpaare: die Tabelle fuehrt historisch
         stripe_price_monthly_id UND stripe_price_id_monthly. Wer nur eines
         setzt, laesst das andere veralten — und welches gelesen wird,
         haengt am Aufrufer. */
      await query(
        'UPDATE plans SET stripe_price_monthly_id = $2, stripe_price_yearly_id = $3,' +
        ' stripe_price_id_monthly = $2, stripe_price_id_yearly = $3,' +
        ' price_monthly_cents = $4, price_yearly_cents = $5, updated_at = NOW()' +
        ' WHERE id = $1',
        [planId, neuM, neuY, centM, centY]
      );
    }
  }

  if (fehlend.length) {
    console.warn('[plans-sync] nicht gefunden, alter Wert bleibt:', fehlend.join(', '));
  }
  if (aenderungen.length) {
    aenderungen.forEach(function (a) {
      console.log('[plans-sync] ' + a.plan + ': ' +
        (a.monatlich.von || 'leer') + ' -> ' + a.monatlich.nach + ' (' + a.monatlich.cent + ' ct)');
    });
  } else {
    console.log('[plans-sync] nichts zu tun — plans stimmt mit Stripe ueberein');
  }

  return { ok: true, dryRun: trocken, aenderungen: aenderungen, fehlend: fehlend };
}

module.exports = { sync, PLAN_KEYS };
