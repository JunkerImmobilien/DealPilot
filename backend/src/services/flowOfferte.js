'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/flowOfferte.js — v3295 · Flow Investor, Punkt 2: Offerte nur mit der Objekt-Id
 *
 * POST /api/v1/objects/:id/offerte. Der Server baut den Auftrag selbst
 * (offertePayload.bauen: Objekt, Kennzahlen aus objektRechnung, Profil, Unterlagen),
 * haengt den Marktbericht-Verlauf an wie /ai/analyze und ruft DIESELBE Funktion
 * openaiService.analyze() - mit ihr laufen _offerteDeckeln (Offerte hoechstens
 * Kaufpreis) und _bestandModus (Objekt im Bestand: kein Kaufpreisvorschlag) unveraendert.
 *
 *   · Gespeichert wird das Ergebnis als ai_analysis (JSON-Text, wie der Browser ihn
 *     ablegt, storage.js), mit optimistischer Sperre.
 *   · Es wird NICHTS versendet. Die Mail ist ein Entwurf fuer den Hub.
 *   · Grenze wie /ai/analyze: im Plan enthalten (logExtract 'analyze'), gezaehlt als
 *     ai_analysis; dazu die Monatsgrenze des Plans (max_ai_analyses_monthly), die der
 *     Browser vor jeder Analyse ueber /objects/track-usage prueft.
 *   · vorschau:true baut nur den Auftrag (kein KI-Abruf, keine Kosten).
 * ═══════════════════════════════════════════════════════════════════════════ */
const { query } = require('../db/pool');
const { HttpError } = require('../middleware/errors');
const config = require('../config');
const objektRechnung = require('./objektRechnung');
const rechenkerne = require('./rechenkerne');
const vorgaben = require('./botVorgabenService');
const dialog = require('./telegramDialogService');
const flowProfil = require('./flowProfil');
const flowBerechnung = require('./flowBerechnung');
const offertePayload = require('./offertePayload');

async function _objekt(userId, objectId) {
  const r = await query('SELECT id, data, version FROM objects WHERE id = $1 AND user_id = $2', [objectId, userId]);
  if (!r.rowCount) throw new HttpError(404, 'Object not found');
  let d = r.rows[0].data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
  return { d: d || {}, version: r.rows[0].version };
}

/** Den Auftrag bauen - ohne KI. Auch fuer vorschau:true und den Pruefer. */
async function auftrag(userId, objectId, d) {
  const profil = await flowProfil.lesen(userId);
  const erg = flowBerechnung.ergMitProfil(await vorgaben.ergaenzung(userId, d), profil, d);
  const gewichte = rechenkerne.scoreGewichte(profil.ds);
  const R = objektRechnung.rechnen(d, { erg: erg, gespeichert: dialog.scoreLesen(d), gewichte: gewichte });
  if (R.pflicht.length) {
    const e = new HttpError(422, 'Ohne ' + R.pflicht.join(' und ') + ' lässt sich keine Offerte ableiten.');
    e.code = 'FLOW_ANGABEN_FEHLEN'; throw e;
  }
  const payload = offertePayload.bauen(d, R, { S: R.S, profil: profil, objId: objectId });
  /* Marktbericht-Verlauf wie /ai/analyze (v947) */
  try {
    const mb = await require('../routes/ai').mbHistoryFor(userId, objectId);
    if (mb) payload.marktbericht = mb;
  } catch (e) { /* ohne Bericht weiter */ }
  delete payload.objId;
  return { payload, R, profil };
}

async function _grenze(userId) {
  const subscriptionService = require('./subscriptionService');
  const usageService = require('./usageService');
  const plan = await subscriptionService.getEffectivePlan(userId);
  const limit = plan ? plan.max_ai_analyses_monthly : null;
  const usage = await usageService.getCurrentMonthUsage(userId);
  const n = usage.ai_analysis || 0;
  return { ok: !(limit != null && limit >= 0 && n >= limit), limit: limit, genutzt: n, plan_id: plan && plan.plan_id };
}

async function offerte(userId, objectId, opts) {
  opts = opts || {};
  const o = await _objekt(userId, objectId);
  if (opts.expectedVersion != null && o.version !== opts.expectedVersion) {
    throw new HttpError(409, 'Version conflict (expected ' + opts.expectedVersion + ', got ' + o.version + ')');
  }
  const a = await auftrag(userId, objectId, o.d);
  if (opts.vorschau) {
    return { vorschau: true, auftrag: a.payload, prompt_zeichen: require('./openaiService').buildPrompt(a.payload, {}).length };
  }
  const g = await _grenze(userId);
  if (!g.ok) {
    const e = new HttpError(403, 'Monatsgrenze der KI-Analysen erreicht (' + g.genutzt + ' von ' + g.limit + ').');
    e.code = 'ANALYSE_GRENZE'; throw e;
  }
  if (!config.openai.apiKey) { const e = new HttpError(503, 'Kein OpenAI-API-Key auf dem Server.'); e.code = 'NO_API_KEY'; throw e; }

  const openaiService = require('./openaiService');
  const wissensblock = await require('./projektwissen').blockFuer(userId);
  const result = await openaiService.analyze(a.payload, { wissensblock: wissensblock });
  try { await require('./aiCreditsService').logExtract(userId, 'analyze'); } catch (e) {}
  try { await require('./usageService').incrementUsage(userId, 'ai_analysis'); } catch (e) {}

  const an = (result && result.analysis) || null;
  let version = o.version, gespeichert = false;
  if (an && opts.speichern !== false) {
    const w = await query(
      'UPDATE objects SET ai_analysis = $1, version = version + 1, updated_at = NOW() WHERE id = $2 AND user_id = $3 AND version = $4 RETURNING version',
      [JSON.stringify(an, null, 2), objectId, userId, o.version]);
    if (!w.rowCount) throw new HttpError(409, 'Version conflict: das Objekt wurde während der Analyse geändert - die Offerte ist NICHT gespeichert.');
    version = w.rows[0].version; gespeichert = true;
  }
  let mpi = null;
  try {
    const m = await require('./agentWerkzeuge')._marktpreisIndikation(userId, objectId, o.d, a.R.kp);
    if (m && m.vergleich) mpi = { marktwert_bereinigt: m.vergleich._basis || null, grund: m.vergleich._abschlag_grund || null };
  } catch (e) { mpi = null; }
  const K = a.R.K || a.R.K0 || {};
  return {
    objekt_id: objectId,
    kaufpreis_offerte: an ? an.kaufpreis_offerte || null : null,
    offerte_mail: an ? an.offerte_mail || null : null,
    offerte_mail_entfallen: an ? an.offerte_mail_entfallen || null : null,
    offerte_gedeckelt: an ? an.offerte_gedeckelt || null : null,
    verhandlungsempfehlung: an ? an.verhandlungsempfehlung || null : null,
    empfehlung: an ? an.empfehlung || null : null,
    bestand_modus: !!(an && an.bestand_modus),
    grundlage: {
      kennzahlen: { kaufpreis: a.R.kp, bruttorendite: K.bmy, nettorendite: K.nmy != null ? K.nmy : null,
        cashflow_vor_steuer_monat: K.cf_m != null ? K.cf_m : null, dscr: a.R.darlehenGesamt > 0 ? K.dscr : null,
        score: a.R.S ? a.R.S.score : null },
      mpi: mpi,
      marktbericht: a.payload.marktbericht ? { anzahl: a.payload.marktbericht.anzahl || null } : null
    },
    versendet: false,
    gespeichert: gespeichert, version: version, erstellt_at: new Date().toISOString()
  };
}

module.exports = { offerte, auftrag };
