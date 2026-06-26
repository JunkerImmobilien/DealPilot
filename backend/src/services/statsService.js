'use strict';
/**
 * v800 — Statistik/Analytics Service (Admin)
 *
 * Liest NUR aus vorhandenen Tabellen (keine Migration):
 *   - ai_credits_log  (endpoint, cost, source, created_at) -> Feature-Nutzung
 *   - users           (created_at, last_login_at, email_verified_at?, deleted_at) -> Funnel + Login
 *   - objects         (user_id, created_at, deal_won) -> Funnel-Schritt "hat Objekt"
 *   - subscriptions   (plan_id, status, created..end, canceled_at, ended_at) -> Conversion + Churn
 *
 * Alle Funktionen tolerant gegen fehlende Spalten (try/catch -> Teil-Ergebnis).
 */

const { query } = require('../db/pool');

function _num(v) { return parseInt(v, 10) || 0; }

// ── 1) FEATURE-NUTZUNG ────────────────────────────────────────
// Verbrauch je Feature-Gruppe aus ai_credits_log (cost > 0 = echter Verbrauch).
async function featureUsage(days) {
  const d = Math.min(Math.max(_num(days) || 30, 1), 365);
  // Endpoints in Feature-Gruppen mappen.
  const r = await query(
    `SELECT endpoint, COUNT(*)::int AS cnt, COALESCE(SUM(cost),0)::int AS liters
       FROM ai_credits_log
      WHERE created_at >= NOW() - ($1 || ' days')::interval
        AND cost > 0
      GROUP BY endpoint
      ORDER BY cnt DESC`,
    [String(d)]
  );
  // Gruppieren
  const groups = {};
  function add(label, row) {
    if (!groups[label]) groups[label] = { feature: label, count: 0, liters: 0 };
    groups[label].count += row.cnt;
    groups[label].liters += row.liters;
  }
  for (const row of r.rows) {
    const ep = (row.endpoint || '').toLowerCase();
    if (ep.indexOf('marktbericht') === 0) add('Marktbericht', row);
    else if (ep.indexOf('avm') === 0 || ep === 'sprengnetter' || ep === 'pricehubble') add('Marktbewertung (AVM)', row);
    else if (ep.indexOf('ds2') === 0) add('KI-Feldvorschlag', row);
    else if (ep.indexOf('analyze') >= 0 || ep === 'ai-analysis' || ep.indexOf('analyse') >= 0) add('KI-Analyse', row);
    else if (ep.indexOf('extract') >= 0 || ep.indexOf('voice') >= 0) add('Daten-Extraktion', row);
    else if (ep.indexOf('copilot') >= 0) add('Co-Pilot', row);
    else add('Sonstiges', row);
  }
  const list = Object.keys(groups).map(function (k) { return groups[k]; })
    .sort(function (a, b) { return b.count - a.count; });
  return { days: d, features: list };
}

// ── 2) ENGAGEMENT-FUNNEL ──────────────────────────────────────
// Registriert -> E-Mail bestaetigt -> hat Objekt -> hat zahlendes Abo.
async function funnel() {
  const out = { registered: 0, verified: 0, has_object: 0, paying: 0, verified_pct: null, object_pct: null, paying_pct: null };

  const reg = await query(`SELECT COUNT(*)::int AS n FROM users WHERE deleted_at IS NULL AND is_test_user = false`);
  out.registered = _num(reg.rows[0] && reg.rows[0].n);

  // E-Mail bestaetigt: Spalte kann email_verified_at ODER is_verified heissen -> beide versuchen.
  try {
    const v = await query(`SELECT COUNT(*)::int AS n FROM users WHERE deleted_at IS NULL AND is_test_user = false AND email_verified_at IS NOT NULL`);
    out.verified = _num(v.rows[0] && v.rows[0].n);
  } catch (e) {
    try {
      const v2 = await query(`SELECT COUNT(*)::int AS n FROM users WHERE deleted_at IS NULL AND is_test_user = false AND is_verified = true`);
      out.verified = _num(v2.rows[0] && v2.rows[0].n);
    } catch (e2) { out.verified = null; }
  }

  // Hat mindestens 1 Objekt
  try {
    const o = await query(
      `SELECT COUNT(DISTINCT o.user_id)::int AS n
         FROM objects o JOIN users u ON u.id = o.user_id
        WHERE u.deleted_at IS NULL AND u.is_test_user = false`);
    out.has_object = _num(o.rows[0] && o.rows[0].n);
  } catch (e) { out.has_object = null; }

  // Zahlendes Abo (aktiv, nicht free)
  try {
    const p = await query(
      `SELECT COUNT(DISTINCT s.user_id)::int AS n
         FROM subscriptions s JOIN users u ON u.id = s.user_id
        WHERE s.status = 'active' AND s.plan_id <> 'free'
          AND u.deleted_at IS NULL AND u.is_test_user = false`);
    out.paying = _num(p.rows[0] && p.rows[0].n);
  } catch (e) { out.paying = null; }

  function pct(a, b) { return (b > 0 && a != null) ? Math.round(a / b * 1000) / 10 : null; }
  out.verified_pct = pct(out.verified, out.registered);
  out.object_pct = pct(out.has_object, out.registered);
  out.paying_pct = pct(out.paying, out.registered);
  return out;
}

// ── 3) LOGIN-AKTIVITAET ───────────────────────────────────────
// DAU/WAU/MAU + Verteilung "letzter Login".
async function loginActivity() {
  const out = {};
  const base = `FROM users WHERE deleted_at IS NULL AND is_test_user = false AND last_login_at IS NOT NULL`;
  const dau = await query(`SELECT COUNT(*)::int AS n ${base} AND last_login_at >= NOW() - INTERVAL '1 day'`);
  const wau = await query(`SELECT COUNT(*)::int AS n ${base} AND last_login_at >= NOW() - INTERVAL '7 days'`);
  const mau = await query(`SELECT COUNT(*)::int AS n ${base} AND last_login_at >= NOW() - INTERVAL '30 days'`);
  out.dau = _num(dau.rows[0] && dau.rows[0].n);
  out.wau = _num(wau.rows[0] && wau.rows[0].n);
  out.mau = _num(mau.rows[0] && mau.rows[0].n);

  // Verteilung: heute / 7T / 30T / 90T / aelter / nie
  const buckets = await query(`
    SELECT
      COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '1 day')::int AS d1,
      COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '7 days' AND last_login_at < NOW() - INTERVAL '1 day')::int AS d7,
      COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '30 days' AND last_login_at < NOW() - INTERVAL '7 days')::int AS d30,
      COUNT(*) FILTER (WHERE last_login_at >= NOW() - INTERVAL '90 days' AND last_login_at < NOW() - INTERVAL '30 days')::int AS d90,
      COUNT(*) FILTER (WHERE last_login_at < NOW() - INTERVAL '90 days')::int AS older,
      COUNT(*) FILTER (WHERE last_login_at IS NULL)::int AS never
    FROM users WHERE deleted_at IS NULL AND is_test_user = false`);
  out.distribution = buckets.rows[0] || {};
  return out;
}

// ── 4) CONVERSION + CHURN ─────────────────────────────────────
async function conversionChurn() {
  const out = {};
  // Free vs Paid
  const total = await query(`SELECT COUNT(*)::int AS n FROM users WHERE deleted_at IS NULL AND is_test_user = false`);
  out.total_users = _num(total.rows[0] && total.rows[0].n);

  const paying = await query(
    `SELECT COUNT(DISTINCT s.user_id)::int AS n
       FROM subscriptions s JOIN users u ON u.id = s.user_id
      WHERE s.status = 'active' AND s.plan_id <> 'free'
        AND u.deleted_at IS NULL AND u.is_test_user = false`);
  out.paying_users = _num(paying.rows[0] && paying.rows[0].n);
  out.conversion_pct = out.total_users > 0 ? Math.round(out.paying_users / out.total_users * 1000) / 10 : null;

  // Churn: gekuendigt/beendet in letzten 30 Tagen vs. aktive zahlende
  try {
    const churned = await query(
      `SELECT COUNT(*)::int AS n FROM subscriptions
        WHERE plan_id <> 'free'
          AND (status = 'canceled' OR ended_at IS NOT NULL)
          AND COALESCE(ended_at, canceled_at, updated_at) >= NOW() - INTERVAL '30 days'`);
    out.churned_30d = _num(churned.rows[0] && churned.rows[0].n);
  } catch (e) {
    try {
      const churned2 = await query(
        `SELECT COUNT(*)::int AS n FROM subscriptions
          WHERE plan_id <> 'free' AND status = 'canceled'
            AND updated_at >= NOW() - INTERVAL '30 days'`);
      out.churned_30d = _num(churned2.rows[0] && churned2.rows[0].n);
    } catch (e2) { out.churned_30d = null; }
  }
  out.churn_pct = (out.churned_30d != null && (out.paying_users + out.churned_30d) > 0)
    ? Math.round(out.churned_30d / (out.paying_users + out.churned_30d) * 1000) / 10 : null;

  // Plan-Verteilung der zahlenden
  try {
    const dist = await query(
      `SELECT s.plan_id, COUNT(*)::int AS n
         FROM subscriptions s JOIN users u ON u.id = s.user_id
        WHERE s.status = 'active' AND s.plan_id <> 'free'
          AND u.deleted_at IS NULL AND u.is_test_user = false
        GROUP BY s.plan_id ORDER BY n DESC`);
    out.plan_distribution = dist.rows;
  } catch (e) { out.plan_distribution = []; }

  // Kerosin: verkauft vs verbraucht (letzte 30 Tage)
  try {
    const k = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN cost > 0 THEN cost ELSE 0 END),0)::int AS verbraucht,
         COALESCE(SUM(CASE WHEN cost < 0 THEN -cost ELSE 0 END),0)::int AS gutgeschrieben
       FROM ai_credits_log WHERE created_at >= NOW() - INTERVAL '30 days'`);
    out.kerosin_30d = k.rows[0] || { verbraucht: 0, gutgeschrieben: 0 };
  } catch (e) { out.kerosin_30d = null; }

  return out;
}

async function overview(days) {
  const [fu, fn, la, cc] = await Promise.all([
    featureUsage(days).catch(function (e) { return { error: e.message }; }),
    funnel().catch(function (e) { return { error: e.message }; }),
    loginActivity().catch(function (e) { return { error: e.message }; }),
    conversionChurn().catch(function (e) { return { error: e.message }; })
  ]);
  return { featureUsage: fu, funnel: fn, loginActivity: la, conversionChurn: cc };
}

module.exports = { featureUsage, funnel, loginActivity, conversionChurn, overview };
