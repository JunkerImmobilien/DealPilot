'use strict';
const express = require('express');
const { z } = require('zod');
const { validate } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const objectService = require('../services/objectService');
const { HttpError } = require('../middleware/errors');
const { requireUnderLimit } = require('../middleware/planLimits');
const usageService = require('../services/usageService');
const portfolioExport = require('../services/portfolioExport'); /* v2043 */
const { requireFlowLinie } = require('../middleware/flow');      /* v3289 · DealPilot Flow */

const router = express.Router();

// All object routes require authentication
router.use(authenticate);

// ── Schemas ──────────────────────────────────────────
const objectBodySchema = z.object({
  data: z.record(z.any()).optional().default({}),
  aiAnalysis: z.string().nullable().optional(),
  photos: z.array(z.string()).optional().default([]),
  expectedVersion: z.number().int().positive().optional()
});

const idParamSchema = z.object({
  id: z.string().uuid('Invalid object id')
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

// ── Routes ───────────────────────────────────────────

/**
 * GET /objects - list user's objects (summaries only)
 */
router.get('/', validate({ query: listQuerySchema }), async (req, res, next) => {
  try {
    // V30: Browser darf die Liste nicht cachen — sonst stale thumbnails nach Photo-Update
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const items = await objectService.listForUser(req.user.id, req.query);
    res.json({ items, count: items.length });
  } catch (err) { next(err); }
});

/**
 * GET /objects/portfolio-export - das ganze Portfolio samt Lexikon
 *
 * v2043 - Marcel: „ich brauche dann ein Export ueber das gesamte
 * Portfolio. Wichtig ist, dass wir das gesamte Wissen mitgeben."
 *
 * STEHT VOR `/:id` - und das ist kein Geschmack: Express nimmt die
 * erste passende Route, und `/:id` passt auf `portfolio-export`
 * genauso. Stuende sie danach, liefe der Aufruf in die Objekt-Abfrage
 * und bekaeme „Invalid object id". Eine Route hinter einem Platzhalter
 * ist keine Route, sondern ein toter Pfad mit plausibler Fehlermeldung.
 */
router.get('/portfolio-export', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    const mitFotos = String(req.query.fotos || '') === '1';
    const paket = await portfolioExport.bauen(req.user.id, { fotos: mitFotos });
    res.json(paket);
  } catch (err) { next(err); }
});

/**
 * GET /objects/:id - get full object data
 */
/* v3159 · Schnittstellen-Prüfung 03.11.2026: das Objektwissen (objektWissen.js, v3025) hatte keinen Endpunkt -
   nur Co-Pilot und Bot lasen es. GET /objects/:id/wissen?jahr=2026 liefert dieselbe Fassung: Unterlagen
   (Risiken, WEG, Anteil, offene Fragen), Potenzial im Jahr (§ 558/§ 559 aus _potenzial) und To-dos. Nichts wird
   neu gerechnet. */
/* v3289 · Flow Investor (Dateien/Makler-Hub/Flow-Investor-Schnittstelle.md, „Für alle Punkte"):
   das Feldverzeichnis, das der Agent mit feld_katalog liest - damit der Hub Felder richtig setzt.
   Dieselbe Quelle (fuehrungService.katalog), ohne die Kuerzung des Agenten. ?suche= filtert.
   Steht VOR /:id, sonst nimmt die Uuid-Pruefung "felder" als falsche Id. */
router.get('/felder', async (req, res, next) => {
  try {
    const fuehrung = require('../services/fuehrungService');
    const flach = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
    let felder = fuehrung.katalog();
    const suche = flach(req.query.suche);
    if (suche) felder = felder.filter((f) => flach(f.id).indexOf(suche) >= 0 || flach(f.label).indexOf(suche) >= 0);
    res.set('Cache-Control', 'private, max-age=300');
    res.json({ anzahl: felder.length, felder: felder,
      hinweis: 'Interne Feld-Ids fuer data{} in POST/PUT /objects. Betraege als Zahl oder deutscher Text ("180.000"), '
        + 'Prozentsaetze als Zahl ("3,5" oder 3.5). Auswahlfelder nur mit den genannten Werten.' });
  } catch (err) { next(err); }
});

/* v3289 · Flow Investor, Punkt 1: Kennzahlen und Quick-Check auf dem Server, mit dem Investmentprofil
   des Kontos, gespeichert unter data._flow_berechnung. Kostenlos. Linie „investor“ noetig.
   Body (optional): { expectedVersion, speichern: false } - 409 bei Versionskonflikt. */
const berechnenSchema = z.object({
  expectedVersion: z.number().int().positive().optional(),
  speichern: z.boolean().optional()
});
router.post('/:id/berechnen', validate({ params: idParamSchema, body: berechnenSchema }), requireFlowLinie('investor'),
  async (req, res, next) => {
    try {
      const flow = require('../services/flowBerechnung');
      const b = req.body || {};
      const erg = await flow.berechnen(req.user.id, req.params.id, { expectedVersion: b.expectedVersion, speichern: b.speichern });
      res.set('Cache-Control', 'no-store');
      res.json(erg);
    } catch (err) { next(err); }
  });

router.get('/:id/wissen', validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    const obj = await objectService.getById(req.user.id, req.params.id);
    if (!obj) return res.status(404).json({ error: 'Object not found' });
    let d = obj.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
    const ow = require('../services/objektWissen');
    const heute = new Date();
    const jahr = Number(req.query.jahr) || heute.getFullYear();
    const sicher = (f) => { try { return f(); } catch (e) { return { fehler: String(e && e.message || e).slice(0, 120) }; } };
    res.json({
      id: obj.id, adresse: ow.adresse(d || {}), stand: obj.updated_at, jahr: jahr,
      unterlagen: sicher(() => ow.unterlagen(d || {})) || null,
      potenzial: sicher(() => ow.potenzial(d || {}, jahr, heute)) || null,
      todos: sicher(() => ow.todos(d || {})) || null,
      hinweis: 'Gelesen, was die App am Objekt abgelegt hat - kein Wert neu ermittelt. Namen in Unterlagen sind geschwärzt.'
    });
  } catch (err) { next(err); }
});

router.get('/:id', validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    let obj = await objectService.getById(req.user.id, req.params.id);
    /* W27-sharedget: Kein eigenes Objekt? Dann pruefen, ob es dem Anfragenden ueber
       eine AKTIVE Reseller-Freigabe zusteht. Dieselbe Regel wie getSharedObject
       (widerrufen/zurueckgegeben = kein Zugriff) — nur an zweiter Stelle angewandt.
       Damit kann die Rechen-Engine im Frontend das Objekt normal laden und der
       Partner die echten PDFs ziehen. Ohne Freigabe bleibt es bei 404. */
    if (!obj) {
      try {
        const reseller = require('../services/resellerService');
        const ownerId = await reseller.sharedObjectOwner(req.user.id, req.params.id);
        if (ownerId) obj = await objectService.getById(ownerId, req.params.id);
      } catch (e) { /* Freigabe-Pfad ist Zusatz, nie blockierend */ }
    }
    if (!obj) throw new HttpError(404, 'Object not found');
    /* v3193 · Ausstattung lesbar fuer die Schnittstelle (Portfoliostrategie fand sie im Rohdatensatz nicht) */
    try { let _d = obj.data; if (typeof _d === 'string') _d = JSON.parse(_d); obj = Object.assign({}, obj, { ausstattung: require('../services/ausstattung').ausstattung(_d) }); } catch (_eA) {}
    res.json(obj);
  } catch (err) { next(err); }
});

/**
 * POST /objects - create new object
 */
router.post('/', validate({ body: objectBodySchema }), requireUnderLimit('objects'), async (req, res, next) => {
  try {
    const created = await objectService.create(req.user.id, req.body);
    await objectService.logAudit({
      userId: req.user.id,
      action: 'object.create',
      resourceType: 'object',
      resourceId: created.id,
      ipAddress: req.ip
    });
    res.status(201).json(created);
  } catch (err) { next(err); }
});

/**
 * PUT /objects/:id - update object
 */
router.put('/:id',
  validate({ params: idParamSchema, body: objectBodySchema }),
  async (req, res, next) => {
    try {
      const updated = await objectService.update(req.user.id, req.params.id, req.body);
      await objectService.logAudit({
        userId: req.user.id,
        action: 'object.update',
        resourceType: 'object',
        resourceId: req.params.id,
        ipAddress: req.ip
      });
      res.json(updated);
    } catch (err) { next(err); }
  }
);

/**
 * DELETE /objects/:id
 */
router.delete('/:id', validate({ params: idParamSchema }), async (req, res, next) => {
  try {
    await objectService.deleteObject(req.user.id, req.params.id);
    await objectService.logAudit({
      userId: req.user.id,
      action: 'object.delete',
      resourceType: 'object',
      resourceId: req.params.id,
      ipAddress: req.ip
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});


/**
 * POST /objects/track-usage
 * Frontend calls this when user runs an AI analysis or PDF export.
 * Body: { metric: 'ai_analysis' | 'pdf_export' }
 * Enforces plan limits.
 */
const trackUsageSchema = z.object({
  metric: z.enum(['ai_analysis', 'pdf_export'])
});

router.post('/track-usage', validate({ body: trackUsageSchema }), async (req, res, next) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const plan = await subscriptionService.getEffectivePlan(req.user.id);

    const planLimitField = req.body.metric === 'ai_analysis'
      ? 'max_ai_analyses_monthly'
      : 'max_pdf_exports_monthly';
    const limit = plan[planLimitField];

    const usage = await usageService.getCurrentMonthUsage(req.user.id);
    const current = usage[req.body.metric] || 0;

    if (limit != null && limit >= 0 && current >= limit) { // V225: -1 = unlimited
      return res.status(403).json({
        error: 'Plan limit reached',
        metric: req.body.metric,
        current,
        limit,
        plan_id: plan.plan_id,
        upgrade_required: true
      });
    }

    const newCount = await usageService.incrementUsage(req.user.id, req.body.metric, 1);
    res.json({
      ok: true,
      metric: req.body.metric,
      count: newCount,
      limit: limit
    });
  } catch (err) { next(err); }
});



// V277-steuer-snapshot: Dedizierter Endpoint zum Persistieren des Steuer-Snapshots
// Nutzt JSONB-Merge damit andere Felder in data unberuehrt bleiben.
router.post('/:id/steuer-snapshot',
  validate({ params: idParamSchema, body: z.object({
    wk_per_year: z.record(z.union([z.number(), z.string()]))
  }).strict() }),
  async (req, res, next) => {
    try {
      const { query } = require('../db/pool');
      const snapshot = { steuer_snapshot: { wk_per_year: req.body.wk_per_year, updated_at: new Date().toISOString() } };
      const r = await query(
        `UPDATE objects
           SET data = data || $1::jsonb, version = version + 1
         WHERE id = $2 AND user_id = $3
         RETURNING id, version, updated_at`,
        [JSON.stringify(snapshot), req.params.id, req.user.id]
      );
      if (r.rowCount === 0) {
        return res.status(404).json({ error: 'Object not found or not authorized' });
      }
      res.json({ ok: true, id: r.rows[0].id, version: r.rows[0].version });
    } catch (err) {
      next(err);
    }
  }
);


/**
 * POST /objects/demo-rundgang   (v1747)
 *
 * Legt das offizielle Demo-Objekt an — dasselbe, das ein neuer Kunde bei der
 * Registrierung bekommt. Die Tour ruft das, wenn der Nutzer kein eigenes
 * Objekt hat, und loescht es am Ende per DELETE /objects/:id wieder.
 *
 * `requireUnderLimit` bleibt dran: es ist eine Objektanlage wie jede andere,
 * und der Rundgang ist kein Grund, die Plan-Grenze zu umgehen.
 */
router.post('/demo-rundgang', requireUnderLimit('objects'), async (req, res, next) => {
  try {
    const demoObjectService = require('../services/demoObjectService');
    const row = await demoObjectService.fuerRundgangAnlegen(req.user.id);
    if (!row) return res.status(503).json({ error: 'Demo-Objekt nicht verfuegbar' });
    res.json({ ok: true, id: row.id, name: row.name });
  } catch (err) { next(err); }
});

module.exports = router;
