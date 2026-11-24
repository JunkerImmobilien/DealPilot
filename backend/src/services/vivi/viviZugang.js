/* ════════════════════════════════════════════════════════════════════
 * v4350 · WER DARF VIVI? (Marcel 24.11.2026: „ab Investor“, inklusive Testphase)
 *
 * Bis v4340 war 'vivi' eine Vorschau-Funktion (services/vorschau-funktionen.json).
 * Jetzt ein Plan-Merkmal: plans.features.vivi (Migration 128) — Investor, Pro,
 * Partner true, Free und Starter false. Die Testphase läuft als Pro
 * (subscriptionService.getEffectivePlan, plan_trials) und ist damit dabei.
 * users.role = 'admin' immer.
 *
 * EINE Entscheidung für alle Stellen: Route /api/v1/vivi, Co-Pilot-Wissen
 * (routes/ai.js), Agent-Werkzeug (agentWerkzeuge.js), Auskunft (viviAuskunft.js).
 * Unbekannter Plan oder Fehler = gesperrt.
 * ════════════════════════════════════════════════════════════════════ */
'use strict';

const MERKMAL = 'vivi';

/** Reine Entscheidung, ohne Datenbank (tools/vivi-pruefen.mjs misst sie am echten Code). */
function entscheiden(role, planFeatures) {
  if (role === 'admin') return { frei: true, grund: 'admin' };
  if (planFeatures && planFeatures[MERKMAL] === true) return { frei: true, grund: 'plan' };
  return { frei: false, grund: 'plan_ohne_vivi' };
}

async function darf(user) {
  if (!user || !user.id) return false;
  try {
    let role = user.role;
    if (role == null) {
      const { query } = require('../../db/pool');
      const u = await query('SELECT role FROM users WHERE id = $1', [user.id]);
      role = u.rows[0] ? u.rows[0].role : null;
    }
    if (role === 'admin') return true;
    const plan = await require('../subscriptionService').getEffectivePlan(user.id);
    return entscheiden(role, plan && plan.plan_features).frei;
  } catch (e) { return false; }
}

/** Middleware NACH authenticate: 403 mit upgrade_required, wenn der Plan ViVi nicht enthält. */
function sperre() {
  return async function viviSperre(req, res, next) {
    let ok = false;
    try { ok = await darf(req.user); } catch (e) { ok = false; }
    if (ok) return next();
    res.status(403).json({ error: 'Die ViVi-Anbindung ist ab dem Paket Investor enthalten.', code: 'plan', funktion: MERKMAL, upgrade_required: true });
  };
}

module.exports = { MERKMAL, entscheiden, darf, sperre };
