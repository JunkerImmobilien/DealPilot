'use strict';
/**
 * partnerPlanKauf.js · v3610 — Partner-Plan per Stripe kaufen, Plaetze aendern, kuendigen
 * (Marcel 17.11.2026: „Partner-Plan an Stripe anbinden").
 *
 * EIN Abo, ZWEI Positionen:
 *   - Partner-Plan   lookup_key dp_plan_partner_monthly / _yearly   (99 EUR / 1.089 EUR, Menge 1)
 *   - Kundenplaetze  lookup_key dp_seat_monthly / _yearly           (Volume-Staffel 19/15/12 EUR bzw.
 *                    209/165/132 EUR im Jahr, Menge = Zahl der Plaetze, 0 = keine Position)
 * Die Betraege stehen NUR in Stripe (Staffel gemessen 17.11.2026 in der Sandbox: tiers_mode volume,
 * bis 9 / bis 24 / darueber). Diese Datei rechnet keinen Preis, sie liest ihn (angebot()).
 *
 * v3947 · DRITTE Position, optional: Teamplaetze (weitere Logins der Kanzlei, Marcel 22.11.2026)
 *   - Teamplaetze    lookup_key dp_teamplatz_monat / _jahr   (tiers_mode GRADUATED: 1. bis 3. Teamplatz 59 EUR,
 *                    4. bis 8. 49 EUR, ab dem 9. 39 EUR, im Jahr 649/539/429 EUR; Menge = Logins ohne Inhaber)
 *   Quelle der Betraege: frontend/js/teamplatz-staffel.js, angelegt von tools/stripe-teamplatz-preis-anlegen.mjs.
 *   Fehlt der Preis in Stripe (vor Marcels OK), laeuft alles andere weiter: angebot().team ist null, Teamplaetze
 *   lassen sich nicht buchen, die kostenlosen (team_plaetze) gelten wie bisher.
 *
 * v3960 · Teamplaetze schon im ersten Checkout (Landing preise.html › vier Pakete, Preisfenster mit Mengenwahl):
 *   checkoutParameter() nimmt teamPreisId + teamplaetze und haengt die dritte Position an (Menge = Teamplaetze,
 *   graduated wie oben). checkoutAnlegen() tut das NUR, wenn der Stripe-Preis existiert UND das Partnerkonto keine
 *   kostenlosen Bestandsplaetze hat (k = 0: ohne Coupon gilt Menge = bezahlt, teamplatzBestand.js). Sonst kauft er
 *   leise ohne Teamplaetze und meldet team_hinweis ('preis_fehlt' | 'bestand'), die Plaetze bucht man danach im
 *   Cockpit (teamplaetzeAendern). Nie ein Fehler wegen Teamplaetzen. Kein Rabatt im Checkout, auch hier nicht.
 *
 * Abo-Metadaten: kind = 'partner_plan', reseller_id, userId. Der Webhook
 * (partnerSeatsWebhook.js + stripeWebhook.js) gleicht damit BEIDES ab: den Plan (subscriptions)
 * und den Platz-Pool (resellerService.syncPoolQuantity).
 *
 * KEINE Testphase: kein trial_period_days, kein trial_end, kein Rabattcode-Feld (ein 100-%-Code
 * waere eine Testphase durch die Hintertuer). checkoutParameter() baut die Sitzung als reines
 * Objekt, damit tools/partner-seats-webhook-pruefen.mjs genau das pruefen kann.
 *
 * Kuendigung: wie bei den normalen Plaenen im Stripe-Kundenportal (bpc_..., subscription_cancel
 * mode at_period_end), hier direkt als Kuendigungs-Ablauf (flow_data subscription_cancel) fuer
 * genau dieses Abo. Was danach mit den Kunden passiert, regelt partnerKunden.aboEnde() (v3357);
 * kuendigungsFolgen() beschreibt genau diese Regel, sie erfindet keine.
 */

const PLAN_LOOKUP = { monthly: 'dp_plan_partner_monthly', yearly: 'dp_plan_partner_yearly' };
const SEAT_LOOKUP = { monthly: 'dp_seat_monthly', yearly: 'dp_seat_yearly' };
const TEAM_LOOKUP = { monthly: 'dp_teamplatz_monat', yearly: 'dp_teamplatz_jahr' };   /* v3947 · = DpTeamplatz.LOOKUP (tools/teamplatz-pruefen.mjs) */
const MAX_PLAETZE = 500;

function fehler(code, status, detail) { const e = new Error(code); e.status = status || 400; if (detail) e.detail = detail; return e; }
function intervallNorm(iv) { return iv === 'yearly' ? 'yearly' : 'monthly'; }
function plaetzeNorm(n) {
  const x = parseInt(n, 10);
  if (!Number.isFinite(x) || x < 0) return 0;
  return Math.min(MAX_PLAETZE, x);
}

/* ── reine Helfer (ohne Stripe, ohne DB) ─────────────────────────────────── */

/** Preis einer Menge nach Stripe-Staffel. mode 'volume': alle Einheiten zum Satz der erreichten Stufe;
 *  'graduated': jede Einheit zum Satz ihrer Stufe. Ergebnis in Cent. */
function staffelSumme(tiers, mode, menge) {
  const n = plaetzeNorm(menge);
  if (!n || !Array.isArray(tiers) || !tiers.length) return 0;
  const bis = (t) => (t.up_to == null || t.up_to === 'inf') ? Infinity : Number(t.up_to);
  if (mode === 'graduated') {
    let rest = n, unten = 0, summe = 0;
    for (const t of tiers) {
      const oben = bis(t), inStufe = Math.max(0, Math.min(rest, oben - unten));
      if (inStufe > 0) summe += inStufe * (t.unit_amount || 0) + (t.flat_amount || 0);
      rest -= inStufe; unten = oben;
      if (rest <= 0) break;
    }
    return summe;
  }
  const t = tiers.find((x) => n <= bis(x)) || tiers[tiers.length - 1];
  return n * (t.unit_amount || 0) + (t.flat_amount || 0);
}

/** Die Checkout-Sitzung als Objekt. Bewusst OHNE trial_*, OHNE allow_promotion_codes, OHNE discounts. */
function checkoutParameter({ kundeId, planPreisId, seatPreisId, plaetze, teamPreisId, teamplaetze, resellerId, userId, successUrl, cancelUrl }) {
  const n = plaetzeNorm(plaetze);
  const t = teamPreisId ? plaetzeNorm(teamplaetze) : 0;   /* v3960 · ohne Preis keine Teamplaetze */
  const meta = { kind: 'partner_plan', reseller_id: String(resellerId), userId: String(userId), plaetze: String(n) };
  if (t > 0) meta.teamplaetze = String(t);
  const items = [{ price: planPreisId, quantity: 1 }];
  if (n > 0) items.push({ price: seatPreisId, quantity: n });
  if (t > 0) items.push({ price: teamPreisId, quantity: t });
  return {
    mode: 'subscription',
    customer: kundeId,
    line_items: items,
    success_url: successUrl,
    cancel_url: cancelUrl,
    billing_address_collection: 'required',
    customer_update: { address: 'auto', name: 'auto' },
    payment_method_collection: 'always',
    locale: 'de',
    automatic_tax: { enabled: false },   /* Kleinunternehmer § 19 UStG */
    subscription_data: { metadata: meta },
    metadata: meta,
    client_reference_id: String(userId)
  };
}

/** Position der Plaetze im Abo: Preis mit lookup_key dp_seat_*; bei einem reinen Platz-Abo (kind partner_seats,
 *  vor v3610) die erste Position. */
function seatPosition(sub) {
  const items = (sub && sub.items && sub.items.data) || [];
  const s = items.find((i) => i && i.price && /^dp_seat_/.test(i.price.lookup_key || ''));
  if (s) return s;
  if (sub && sub.metadata && sub.metadata.kind === 'partner_seats') return items[0] || null;
  return null;
}
/** v3947 · Position der Teamplaetze (lookup_key dp_teamplatz_*), sonst null. */
function teamPosition(sub) {
  const items = (sub && sub.items && sub.items.data) || [];
  return items.find((i) => i && i.price && /^dp_teamplatz_/.test(i.price.lookup_key || '')) || null;
}
/* v3947a · BEZAHLTE Teamplaetze: Menge der Position minus metadata.bestand (kostenlose Plaetze zaehlen in der Staffel mit,
   services/teamplatzBestand.js) */
function teamMenge(sub) { return require('./teamplatzBestand').bezahltAusPosition(teamPosition(sub)); }
function planPosition(sub) {
  const items = (sub && sub.items && sub.items.data) || [];
  return items.find((i) => i && i.price && /^dp_plan_/.test(i.price.lookup_key || '')) || null;
}

/** Untergrenze beim Reduzieren: belegte (zugewiesene) + fuer eine Uebergabe reservierte Plaetze (FREI_SQL). */
function mindestPlaetze(pool) {
  pool = pool || {};
  return Math.max(0, (parseInt(pool.zugewiesen, 10) || 0) + (parseInt(pool.reserviert, 10) || 0));
}

/** Proration beim Aendern (Entscheidung offen, Marcel): mehr Plaetze sofort anteilig berechnen,
 *  weniger Plaetze als Gutschrift auf die naechste Rechnung. */
function proration(alt, neu) { return neu > alt ? 'always_invoice' : 'create_prorations'; }

/* ── Stripe ─────────────────────────────────────────────────────────────── */

function stripe() { return require('./stripeService').getStripe(); }

const _cache = { wert: null, bis: 0 };
async function preiseLesen() {
  if (_cache.wert && _cache.bis > Date.now()) return _cache.wert;
  const keys = [PLAN_LOOKUP.monthly, PLAN_LOOKUP.yearly, SEAT_LOOKUP.monthly, SEAT_LOOKUP.yearly];
  const optional = [TEAM_LOOKUP.monthly, TEAM_LOOKUP.yearly];   /* v3947 · ohne sie bleibt der Kauf moeglich */
  const r = await stripe().prices.list({ lookup_keys: keys.concat(optional), active: true, limit: 10, expand: ['data.tiers'] });
  const by = {};
  for (const p of r.data) by[p.lookup_key] = p;
  const fehlt = keys.filter((k) => !by[k]);
  if (fehlt.length) throw fehler('partner_preis_fehlt', 503, 'In Stripe fehlt: ' + fehlt.join(', '));
  _cache.wert = by; _cache.bis = Date.now() + 10 * 60 * 1000;
  return by;
}

/** Fuer Preis-Fenster und Cockpit: Plan- und Platzpreise, so wie Stripe sie abrechnet (Cent). */
async function angebot() {
  const by = await preiseLesen();
  const seat = (p) => ({
    tiers_mode: p.tiers_mode || null,
    stufen: (p.tiers || []).map((t) => ({ bis: t.up_to == null ? null : t.up_to, cent: t.unit_amount, pauschal: t.flat_amount || 0 })),
    cent: p.unit_amount
  });
  return {
    plan: { monthly: by[PLAN_LOOKUP.monthly].unit_amount, yearly: by[PLAN_LOOKUP.yearly].unit_amount },
    platz: { monthly: seat(by[SEAT_LOOKUP.monthly]), yearly: seat(by[SEAT_LOOKUP.yearly]) },
    /* v3947 · Teamplaetze (graduated), null solange der Preis in Stripe fehlt */
    team: by[TEAM_LOOKUP.monthly] && by[TEAM_LOOKUP.yearly] ? { monthly: seat(by[TEAM_LOOKUP.monthly]), yearly: seat(by[TEAM_LOOKUP.yearly]) } : null,
    inklusiv: require('./resellerService').INKLUSIV_MANDANTEN,
    testphase: false,
    max_plaetze: MAX_PLAETZE
  };
}

async function aktivesPlatzAbo(resellerId) {
  const { query } = require('../db/pool');
  const r = await query('SELECT stripe_subscription_id FROM resellers WHERE id = $1', [resellerId]);
  const id = r.rows[0] && r.rows[0].stripe_subscription_id;
  if (!id) return null;
  try {
    const sub = await stripe().subscriptions.retrieve(id, { expand: ['items.data.price'] });
    return ['active', 'trialing', 'past_due'].includes(sub.status) ? sub : null;
  } catch (e) { return null; }
}

/** v3960 · Duerfen Teamplaetze in den ersten Checkout? Preis vorhanden und kein kostenloser Bestand (sonst bräuchte die
 *  Position einen Coupon, den es im Checkout nicht gibt). Liefert { menge, preisId, hinweis }. */
function teamImCheckout(teamplaetze, teamPreis, reseller) {
  const t = plaetzeNorm(teamplaetze);
  if (!t) return { menge: 0, preisId: null, hinweis: null };
  if (!teamPreis) return { menge: 0, preisId: null, hinweis: 'preis_fehlt' };
  const k = parseInt(reseller && reseller.team_plaetze, 10) || 0;
  if (k > 0) return { menge: 0, preisId: null, hinweis: 'bestand' };
  return { menge: t, preisId: teamPreis.id, hinweis: null };
}

/** Checkout fuer den Partner-Plan. user = req.user. */
async function checkoutAnlegen({ user, interval, plaetze, teamplaetze, successUrl, cancelUrl }) {
  const reseller = require('./resellerService');
  const iv = intervallNorm(interval);
  /* Ein zweites Abo neben einem bezahlten (Pro, Investor ...) wuerde dieselbe subscriptions-Zeile
     ueberschreiben und beim naechsten Ereignis des alten Abos zurueckgeschrieben. */
  if (await reseller.hatBezahltesAbo(user.id)) {
    throw fehler('bezahltes_abo_vorhanden', 409, 'Du hast bereits ein bezahltes Abo. Kündige es im Abo-Portal zum Laufzeitende, danach kannst du den Partner-Plan buchen.');
  }
  const rs = await reseller.ensureReseller(user.id, { name: user.name });
  if (await aktivesPlatzAbo(rs.id)) {
    throw fehler('platz_abo_vorhanden', 409, 'Für dieses Partner-Konto läuft bereits ein Abo für Kundenplätze.');
  }
  const by = await preiseLesen();
  const kunde = await require('./stripeService').getOrCreateCustomer({ userId: user.id, email: user.email, name: user.name });
  const team = teamImCheckout(teamplaetze, by[TEAM_LOOKUP[iv]], rs);
  const params = checkoutParameter({
    kundeId: kunde.id, planPreisId: by[PLAN_LOOKUP[iv]].id, seatPreisId: by[SEAT_LOOKUP[iv]].id,
    plaetze, teamPreisId: team.preisId, teamplaetze: team.menge, resellerId: rs.id, userId: user.id, successUrl, cancelUrl
  });
  const s = await stripe().checkout.sessions.create(params);
  return { url: s.url, sessionId: s.id, teamplaetze: team.menge, team_hinweis: team.hinweis };
}

/** Plaetze im laufenden Abo auf `anzahl` setzen (Cockpit). Untergrenze: belegt + reserviert. */
async function plaetzeAendern(resellerId, anzahl) {
  const reseller = require('./resellerService');
  const ziel = plaetzeNorm(anzahl);
  const sub = await aktivesPlatzAbo(resellerId);
  if (!sub) throw fehler('kein_abo', 409, 'Kein laufendes Abo für Kundenplätze. Plätze werden mit dem Partner-Plan gebucht.');
  if (sub.cancel_at_period_end) throw fehler('abo_gekuendigt', 409, 'Das Abo ist zum Laufzeitende gekündigt. Plätze lassen sich erst nach einer Wiederaufnahme ändern.');
  const pool = await reseller.getPool(resellerId);
  const min = mindestPlaetze(pool);
  if (ziel < min) throw fehler('unter_belegung', 409, 'Belegt oder für eine Übergabe vorgemerkt sind ' + min + ' Plätze. Weniger geht erst, wenn du Plätze freigibst.');
  const pos = seatPosition(sub);
  const alt = pos ? (pos.quantity || 0) : 0;
  if (ziel === alt) return { ok: true, unveraendert: true, pool };
  const ref = planPosition(sub) || pos;
  const iv = ref && ref.price && ref.price.recurring && ref.price.recurring.interval === 'year' ? 'yearly' : 'monthly';
  let items;
  if (pos && ziel > 0) items = [{ id: pos.id, quantity: ziel }];
  else if (pos && ziel === 0) {
    /* ein reines Platz-Abo (vor v3610) hat keine zweite Position - dort bleibt die Menge 0 nicht moeglich */
    if (!planPosition(sub)) throw fehler('nur_platz_abo', 409, 'Dieses ältere Platz-Abo lässt sich nur im Abo-Portal beenden.');
    items = [{ id: pos.id, deleted: true }];
  } else {
    const by = await preiseLesen();
    items = [{ price: by[SEAT_LOOKUP[iv]].id, quantity: ziel }];
  }
  const neu = await stripe().subscriptions.update(sub.id, {
    items, proration_behavior: proration(alt, ziel), expand: ['items.data.price']
  });
  const np = seatPosition(neu);
  const poolNeu = await reseller.syncPoolQuantity(resellerId, np ? np.quantity : 0, {
    interval: iv, stripeSubscriptionId: neu.id, stripeSubscriptionItemId: np && np.id,
    currentPeriodEnd: neu.current_period_end ? new Date(neu.current_period_end * 1000) : null
  });
  return { ok: true, vorher: alt, nachher: ziel, pool: poolNeu };
}

/* ── v3947 · Teamplaetze im laufenden Abo ─────────────────────────────── */

/** Intervall des Abos (aus der Plan-Position, sonst der Platz-Position). */
function aboIntervall(sub) {
  const ref = planPosition(sub) || seatPosition(sub) || teamPosition(sub);
  return ref && ref.price && ref.price.recurring && ref.price.recurring.interval === 'year' ? 'yearly' : 'monthly';
}

/** Was das Cockpit vor dem Bestaetigen zeigt: Rahmen, Stufen aus Stripe, Summe heute und mit einem Platz mehr.
 *  Betraege in Cent, gerechnet mit staffelSumme(…, 'graduated') auf den Stripe-Stufen. */
async function teamAngebot(rs) {
  const T = require('./partnerTeam'), TB = require('./teamplatzBestand');
  const team = await T.team(rs);
  const rahmen = { plaetze: team.plaetze, kostenlos: team.kostenlos, bezahlt: team.bezahlt, belegt: team.belegt, frei: team.frei,
                   ueberbelegt: team.ueberbelegt, mindest_bezahlt: team.mindest_bezahlt };
  let sub = null, by = null;
  try { sub = await aktivesPlatzAbo(rs.id); } catch (e) { sub = null; }
  try { by = await preiseLesen(); } catch (e) { by = null; }
  const iv = sub ? aboIntervall(sub) : 'monthly';
  const preis = by && by[TEAM_LOOKUP[iv]];
  if (!preis) return Object.assign(rahmen, { buchbar: false, grund: 'preis_fehlt', intervall: iv });
  const stufen = (preis.tiers || []).map((t) => ({ bis: t.up_to == null ? null : t.up_to, cent: t.unit_amount, pauschal: t.flat_amount || 0 }));
  /* v3947a · k kostenlose Plaetze zaehlen in der Staffel mit: b bezahlte kosten staffel(k + b) - staffel(k) */
  const k = team.kostenlos;
  const summe = (n) => TB.summeBezahlt(preis.tiers || [], k, n);
  const bezahltAbo = sub ? teamMenge(sub) : 0;
  const naechsterNr = bezahltAbo + 1;
  return Object.assign(rahmen, {
    buchbar: !!sub && !sub.cancel_at_period_end, grund: !sub ? 'kein_abo' : (sub.cancel_at_period_end ? 'abo_gekuendigt' : null),
    intervall: iv, tiers_mode: preis.tiers_mode || 'graduated', stufen, bestand: k, bezahlt_abo: bezahltAbo,
    summe_cent: summe(bezahltAbo),
    naechster: { teamplatz: naechsterNr, login: 1 + k + naechsterNr, satz_cent: summe(naechsterNr) - summe(bezahltAbo), summe_cent: summe(naechsterNr) }
  });
}

/** Bezahlte Teamplaetze im laufenden Abo auf `anzahl` setzen (nur Inhaber, Route prueft). Untergrenze: so viele bezahlte,
 *  dass Berater und offene Einladungen Platz haben (teamRahmen().mindest_bezahlt). v3947a: Stripe-Menge = Bestand + bezahlt,
 *  der Bestand wird an der Position per Coupon abgezogen (teamplatzBestand.js). */
async function teamplaetzeAendern(rs, anzahl) {
  const T = require('./partnerTeam'), TB = require('./teamplatzBestand');
  const ziel = plaetzeNorm(anzahl);
  const sub = await aktivesPlatzAbo(rs.id);
  if (!sub) throw fehler('kein_abo', 409, 'Teamplätze werden im Partner-Plan-Abo gebucht. Dein Partner-Plan läuft nicht über ein Abo, schreib uns an info@dealpilot.immo.');
  if (sub.cancel_at_period_end) throw fehler('abo_gekuendigt', 409, 'Das Abo ist zum Laufzeitende gekündigt. Teamplätze lassen sich erst nach einer Wiederaufnahme ändern.');
  if (!planPosition(sub)) throw fehler('nur_platz_abo', 409, 'Dieses ältere Platz-Abo kennt keine Teamplätze. Bitte schreib uns an info@dealpilot.immo.');
  const team = await T.team(rs);
  if (ziel < team.mindest_bezahlt) throw fehler('unter_belegung', 409, 'Im Team sind ' + team.belegt + ' Plätze belegt oder eingeladen, davon ' + team.kostenlos + ' kostenlos. Weniger als ' + team.mindest_bezahlt + ' bezahlte Teamplätze geht erst, wenn jemand das Team verlässt oder du eine Einladung zurückziehst.');
  const pos = teamPosition(sub);
  const alt = TB.bezahltAusPosition(pos), k = team.kostenlos;
  const bestandAlt = pos ? parseInt((pos.metadata && pos.metadata.bestand) || '0', 10) || 0 : k;
  if (ziel === alt && bestandAlt === k) { await T.bezahltAbgleichen(rs.id, alt); return { ok: true, unveraendert: true, bezahlt: alt }; }
  const iv = aboIntervall(sub);
  const by = await preiseLesen();
  const preis = by[TEAM_LOOKUP[iv]];
  let items;
  if (pos && ziel === 0) items = [{ id: pos.id, deleted: true }];
  else if (ziel === 0) { await T.bezahltAbgleichen(rs.id, 0); return { ok: true, unveraendert: true, bezahlt: 0 }; }
  else {
    if (!preis) throw fehler('teamplatz_preis_fehlt', 503, 'Teamplätze lassen sich noch nicht buchen. Bitte schreib uns an info@dealpilot.immo.');
    const coupon = await TB.couponSicherstellen(stripe(), k, iv, preis);
    const felder = TB.positionFelder(k, ziel, coupon);
    if (!pos && !coupon) delete felder.discounts;   /* neue Position ohne Bestand: kein Rabatt-Feld */
    items = [Object.assign(pos ? { id: pos.id } : { price: preis.id }, felder)];
  }
  const neu = await stripe().subscriptions.update(sub.id, { items, proration_behavior: proration(alt, ziel), expand: ['items.data.price'] });
  const menge = teamMenge(neu);
  await T.bezahltAbgleichen(rs.id, menge);
  return { ok: true, vorher: alt, nachher: menge, bezahlt: menge, bestand: k };
}

/** Rueckweg nach dem Checkout: dasselbe wie der Webhook (Plan + Plaetze), falls er spaeter kommt oder
 *  verloren geht. Idempotent: upsert je Nutzer, syncPoolQuantity auf die Zielmenge. */
async function bestaetigen({ userId, sessionId }) {
  const st = stripe();
  const s = await st.checkout.sessions.retrieve(String(sessionId || ''));
  if (!s || !s.metadata || s.metadata.kind !== 'partner_plan') throw fehler('keine_partner_sitzung', 400);
  if (String(s.metadata.userId) !== String(userId)) throw fehler('fremde_sitzung', 403);
  const subId = typeof s.subscription === 'string' ? s.subscription : (s.subscription && s.subscription.id);
  if (!subId) return { ok: false, grund: 'noch_kein_abo' };
  const sub = await require('./stripeService').getSubscription(subId);
  if (!['active', 'trialing', 'past_due'].includes(sub.status)) return { ok: false, grund: 'status_' + sub.status };
  const pp = planPosition(sub);
  const iv = pp && pp.price && pp.price.recurring && pp.price.recurring.interval === 'year' ? 'yearly' : 'monthly';
  await require('./subscriptionService').upsertFromStripe({ userId, stripeSubscription: sub, planId: 'partner', billingInterval: iv });
  const pos = seatPosition(sub);
  const pool = await require('./resellerService').syncPoolQuantity(s.metadata.reseller_id, pos ? pos.quantity : 0, {
    interval: iv, stripeSubscriptionId: sub.id, stripeSubscriptionItemId: pos && pos.id,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null
  });
  await require('./partnerTeam').bezahltAbgleichen(s.metadata.reseller_id, teamMenge(sub));   /* v3947 */
  return { ok: true, plan: 'partner', intervall: iv, pool };
}

/** Link in den Kuendigungs-Ablauf des Kundenportals fuer genau das Partner-Abo. */
async function kuendigenLink({ userId, resellerId, returnUrl }) {
  const { query } = require('../db/pool');
  const subscriptionService = require('./subscriptionService');
  const customerId = await subscriptionService.getStripeCustomerId(userId);
  if (!customerId) throw fehler('kein_stripe_kunde', 409, 'Dein Partner-Plan läuft nicht über Stripe. Bitte schreib uns an info@dealpilot.immo.');
  let subId = null;
  const s = await query(`SELECT stripe_subscription_id FROM subscriptions WHERE user_id = $1 AND plan_id = 'partner' AND stripe_subscription_id IS NOT NULL`, [userId]);
  subId = s.rows[0] && s.rows[0].stripe_subscription_id;
  if (!subId && resellerId) { const sub = await aktivesPlatzAbo(resellerId); subId = sub && sub.id; }
  if (!subId) throw fehler('kein_partner_abo', 409, 'Kein laufendes Partner-Abo gefunden.');
  const sess = await stripe().billingPortal.sessions.create({
    customer: customerId, return_url: returnUrl,
    flow_data: { type: 'subscription_cancel', subscription_cancel: { subscription: subId },
                 after_completion: { type: 'redirect', redirect: { return_url: returnUrl } } }
  });
  return { url: sess.url };
}

/** Was eine Kuendigung fuer die Kunden bedeutet - die Regel aus partnerKunden.aboEnde()/platzEntziehen()/fristenAbarbeiten(). */
async function kuendigungsFolgen(resellerId) {
  const { query } = require('../db/pool');
  const pk = require('./partnerKunden');
  const r = await query(
    `SELECT COUNT(*) FILTER (WHERE platz_art = 'platz' AND entzug_am IS NULL) AS platz,
            COUNT(*) FILTER (WHERE platz_art = 'eigen') AS eigen
       FROM reseller_clients WHERE reseller_id = $1 AND getrennt_am IS NULL`, [resellerId]);
  const z = r.rows[0] || {};
  return {
    frist_tage: pk.ENTZUG_FRIST_TAGE,
    kunden_platz: parseInt(z.platz, 10) || 0,
    kunden_eigen: parseInt(z.eigen, 10) || 0,
    zum: 'periodenende'
  };
}

module.exports = {
  PLAN_LOOKUP, SEAT_LOOKUP, TEAM_LOOKUP, MAX_PLAETZE,
  staffelSumme, checkoutParameter, teamImCheckout, seatPosition, planPosition, teamPosition, teamMenge, aboIntervall, mindestPlaetze, proration, plaetzeNorm,
  angebot, checkoutAnlegen, bestaetigen, plaetzeAendern, kuendigenLink, kuendigungsFolgen,
  teamAngebot, teamplaetzeAendern
};
