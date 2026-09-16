/* ============================================================================
   adminRabatte.js — Rabattcodes im Admin verwalten (v1423)

   Marcels Auftrag vom 16.09.2026:
     „Wir koennen ja im Admin, baue das bitte ein, dass ich dort einen
      Counter drin habe und es dort dann halt auch einfach rausnehmen kann.
      Und vielleicht auch, wenn ich wieder einen Rabatt geben moechte,
      15 %, dann kann ich den dort auch anlegen und dem vielleicht einen
      anderen Namen geben."

   DREI DINGE, DIE STRIPE ERZWINGT — und die diese Datei kapselt:

   1. EIN COUPON AENDERT SEINEN PROZENTSATZ NIE.
      Wer 15 statt 16 Prozent will, braucht einen NEUEN Coupon. Deshalb
      legt „anlegen" immer beides an: Coupon (der Wert) und Promotion-Code
      (der Name, den der Kunde tippt). Genau daran ist ERSTFLUG15 einmal
      gescheitert: der Coupon lag monatelang da, ohne dass je ein Code
      daranhing — und war damit fuer keinen Kunden erreichbar.

   2. EIN CODE-NAME DARF NUR EINMAL AKTIV SEIN.
      Wer denselben Namen neu vergeben will, muss den alten erst
      abschalten. Das macht diese Datei NICHT von selbst — sie meldet den
      Konflikt zurueck, damit niemand versehentlich einen laufenden Rabatt
      abraeumt. Der Admin entscheidet.

   3. ABSCHALTEN IST NICHT LOESCHEN.
      `active:false` nimmt den Code aus dem Verkehr; wer ihn bereits
      eingeloest hat, behaelt seinen Rabatt, solange sein Abo laeuft. Das
      ist fast immer gewollt und der Grund, warum es hier gar kein
      Loeschen gibt. Ein geloeschter Code waere aus der Historie
      verschwunden, die Rabatte aber weiter in den Abos — die
      unangenehmste Kombination.

   Rollen: alles hier ist Geld, deshalb ausschliesslich `owner`.
   ========================================================================= */
const express = require('express');
const Stripe = require('stripe');
const { requireAdmin, requireRole } = require('../middleware/adminAuth');

const router = express.Router();
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

router.use(requireAdmin, requireRole('owner'));

function keinStripe(res) {
  return res.status(503).json({ error: 'stripe_not_configured', message: 'Kein Stripe-Schluessel in dieser Umgebung.' });
}

/** Ein Promotion-Code, so wie ihn die Admin-Oberflaeche braucht. */
function abbilden(p) {
  const c = p.coupon || {};
  return {
    id:         p.id,
    code:       p.code,
    aktiv:      p.active === true,
    prozent:    c.percent_off != null ? c.percent_off : null,
    betrag:     c.amount_off != null ? c.amount_off / 100 : null,
    waehrung:   c.currency ? String(c.currency).toUpperCase() : null,
    dauer:      c.duration || null,              /* forever | once | repeating */
    dauer_monate: c.duration_in_months || null,
    coupon_id:  c.id,
    coupon_name: c.name || null,
    eingeloest: p.times_redeemed || 0,
    grenze:     p.max_redemptions == null ? null : p.max_redemptions,
    ablauf:     p.expires_at ? new Date(p.expires_at * 1000).toISOString() : null,
    /* Ein Coupon kann auf Produkte eingeschraenkt sein. Steht das hier
       nicht auf null, gilt der Rabatt NICHT fuer alles — das muss sichtbar
       sein, sonst wundert sich jemand, warum er beim Pro nicht greift. */
    nur_fuer:   (c.applies_to && c.applies_to.products) || null,
    angelegt:   p.created ? new Date(p.created * 1000).toISOString() : null
  };
}

/* ── GET /  ─ alle Rabattcodes, neueste zuerst ───────────────────────── */
router.get('/', async (req, res) => {
  if (!stripe) return keinStripe(res);
  try {
    const r = await stripe.promotionCodes.list({ limit: 100, expand: ['data.coupon'] });
    const liste = r.data.map(abbilden).sort((a, b) => {
      if (a.aktiv !== b.aktiv) return a.aktiv ? -1 : 1;   /* aktive nach oben */
      return String(b.angelegt || '').localeCompare(String(a.angelegt || ''));
    });
    /* Coupons ohne Code sind die stille Falle aus der ERSTFLUG-Geschichte:
       angelegt, nie angeschlossen, fuer niemanden erreichbar. Sie gehoeren
       in die Ansicht, sonst legt jemand denselben Fehler noch einmal an. */
    const cs = await stripe.coupons.list({ limit: 100 });
    const benutzt = new Set(r.data.map(p => p.coupon && p.coupon.id));
    const verwaist = cs.data
      .filter(c => !benutzt.has(c.id) && c.valid)
      .map(c => ({
        coupon_id: c.id,
        name: c.name || null,
        prozent: c.percent_off != null ? c.percent_off : null,
        dauer: c.duration
      }));
    res.json({ rabatte: liste, verwaiste_coupons: verwaist, modus: String(process.env.STRIPE_SECRET_KEY).startsWith('sk_live') ? 'live' : 'test' });
  } catch (e) {
    res.status(502).json({ error: 'stripe_fehler', message: e.message });
  }
});

/* ── POST /:id/aktiv  ─ ein- oder ausschalten ────────────────────────── */
router.post('/:id/aktiv', async (req, res) => {
  if (!stripe) return keinStripe(res);
  const an = req.body && req.body.aktiv === true;
  try {
    const p = await stripe.promotionCodes.update(req.params.id, { active: an });
    res.json({ ok: true, rabatt: abbilden(p) });
  } catch (e) {
    res.status(502).json({ error: 'stripe_fehler', message: e.message });
  }
});

/* ── POST /anlegen  ─ neuer Coupon + Code in einem Zug ───────────────── */
router.post('/anlegen', async (req, res) => {
  if (!stripe) return keinStripe(res);
  const b = req.body || {};
  const code = String(b.code || '').trim().toUpperCase();
  const prozent = Number(b.prozent);
  const dauer = b.dauer === 'once' ? 'once' : (b.dauer === 'repeating' ? 'repeating' : 'forever');
  const monate = dauer === 'repeating' ? Math.round(Number(b.monate)) : null;
  const grenze = (b.grenze === '' || b.grenze == null) ? null : Math.round(Number(b.grenze));

  if (!/^[A-Z0-9_-]{2,50}$/.test(code)) {
    return res.status(400).json({ error: 'code_ungueltig', message: 'Der Name darf nur Buchstaben, Ziffern, _ und - enthalten (2 bis 50 Zeichen).' });
  }
  if (!Number.isFinite(prozent) || prozent < 1 || prozent > 100) {
    return res.status(400).json({ error: 'prozent_ungueltig', message: 'Der Rabatt muss zwischen 1 und 100 Prozent liegen.' });
  }
  if (dauer === 'repeating' && (!Number.isFinite(monate) || monate < 1 || monate > 36)) {
    return res.status(400).json({ error: 'monate_ungueltig', message: 'Bei „laeuft eine Weile" sind 1 bis 36 Monate moeglich.' });
  }
  if (grenze != null && (!Number.isFinite(grenze) || grenze < 1)) {
    return res.status(400).json({ error: 'grenze_ungueltig', message: 'Die Begrenzung muss mindestens 1 sein — oder leer fuer unbegrenzt.' });
  }

  try {
    /* Stripe laesst denselben Code-Namen nicht zweimal AKTIV zu. Lieber
       vorher nachsehen und klar sagen, was im Weg steht, als eine rohe
       Stripe-Meldung durchzureichen. */
    const vorhanden = await stripe.promotionCodes.list({ code, limit: 10 });
    const aktiv = vorhanden.data.find(p => p.active);
    if (aktiv) {
      return res.status(409).json({
        error: 'code_vergeben',
        message: 'Den Namen „' + code + '" gibt es schon und er ist aktiv ('
          + (aktiv.coupon && aktiv.coupon.percent_off != null ? aktiv.coupon.percent_off + ' %' : 'Rabatt')
          + ', ' + (aktiv.times_redeemed || 0) + ' mal eingeloest). Schalte ihn erst ab, dann ist der Name wieder frei.',
        blockiert_von: aktiv.id
      });
    }

    const couponDaten = {
      percent_off: prozent,
      duration: dauer,
      name: (b.bezeichnung ? String(b.bezeichnung).slice(0, 40) : code + ' ' + prozent + '% ' + dauer)
    };
    if (dauer === 'repeating') couponDaten.duration_in_months = monate;

    const coupon = await stripe.coupons.create(couponDaten);

    const codeDaten = { coupon: coupon.id, code };
    if (grenze != null) codeDaten.max_redemptions = grenze;

    const pc = await stripe.promotionCodes.create(codeDaten);
    const voll = await stripe.promotionCodes.retrieve(pc.id, { expand: ['coupon'] });
    res.status(201).json({ ok: true, rabatt: abbilden(voll) });
  } catch (e) {
    res.status(502).json({ error: 'stripe_fehler', message: e.message });
  }
});

module.exports = router;
