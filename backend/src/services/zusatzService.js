'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   services/zusatzService.js — v2977
   ZUSÄTZE JE KUNDE (zuerst: die Schnittstelle der Rechenkerne)

   Marcel, 27.10.2026: die Schnittstelle für RND und Verkehrswert soll später
   „für sachverständige oder makler ein extra paket“ werden, buchbar „nur Pro
   und Partner“. Der Preis steht noch nicht fest — deshalb schaltet heute das
   Admin-Portal frei, und ein späteres Stripe-Paket setzt dieselbe Zeile.

   > Eine Freigabe, eine Stelle: routes/rechenkerne.js fragt NUR hier.
   ═══════════════════════════════════════════════════════════════════════ */
const { query } = require('../db/pool');
const subscriptionService = require('./subscriptionService');

const RECHENKERNE = 'rechenkerne_api';
const BEKANNT = [RECHENKERNE];
const KERN_SPALTE = { rnd: 'kontingent_rnd', verkehrswert: 'kontingent_vw' };

async function holen(userId, zusatz) {
  const r = await query(
    'SELECT user_id, zusatz, aktiv, kontingent_rnd, kontingent_vw, notiz, geaendert_von, created_at, updated_at '
    + 'FROM user_zusaetze WHERE user_id=$1 AND zusatz=$2', [userId, zusatz]);
  return r.rows[0] || null;
}

/* Aufrufe im laufenden Kalendermonat (Europe/Berlin), je Kern. */
async function monatsZaehlung(userId) {
  const r = await query(
    "SELECT kern, COUNT(*)::int AS n, COUNT(*) FILTER (WHERE ok)::int AS n_ok "
    + "FROM rechenkerne_aufrufe WHERE user_id=$1 "
    + "AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin' "
    + "GROUP BY kern", [userId]);
  const z = { rnd: { n: 0, n_ok: 0 }, verkehrswert: { n: 0, n_ok: 0 } };
  r.rows.forEach(function (x) { z[x.kern] = { n: x.n, n_ok: x.n_ok }; });
  return z;
}

/* Darf dieser Kunde den Kern rechnen? Reihenfolge: Plan, Testphase, Zusatz, Kontingent.
   Gezählt wird nur, was erfolgreich gerechnet hat (n_ok) — ein Fehler des Dienstes
   darf das Kontingent des Kunden nicht aufbrauchen. */
async function darfRechnen(user, kern) {
  if (!user || !user.id) return { ok: false, status: 401, grund: 'nicht_angemeldet' };
  const plan = await subscriptionService.getEffectivePlan(user.id);
  if (!plan || !plan.plan_features || !plan.plan_features.api_access) {
    return { ok: false, status: 403, grund: 'plan_ohne_schnittstelle',
      text: 'Die Schnittstelle gibt es für die Pläne Pro und Partner.', plan_id: (plan && plan.plan_id) || null };
  }
  if (plan.trial === true) {
    return { ok: false, status: 403, grund: 'testphase',
      text: 'Die Schnittstelle ist in der Testphase nicht enthalten.', plan_id: plan.plan_id };
  }
  const z = await holen(user.id, RECHENKERNE);
  if (!z || !z.aktiv) {
    return { ok: false, status: 403, grund: 'zusatz_nicht_freigeschaltet',
      text: 'Die Schnittstelle der Rechenkerne ist ein Zusatz und für dieses Konto nicht freigeschaltet. '
          + 'Bitte an DealPilot wenden.', plan_id: plan.plan_id };
  }
  const grenze = z[KERN_SPALTE[kern]];
  if (grenze != null) {
    const zaehl = await monatsZaehlung(user.id);
    const genutzt = (zaehl[kern] && zaehl[kern].n_ok) || 0;
    if (genutzt >= grenze) {
      return { ok: false, status: 429, grund: 'kontingent_erschoepft',
        text: 'Das Monatskontingent für ' + (kern === 'rnd' ? 'die Restnutzungsdauer' : 'den Verkehrswert')
            + ' ist aufgebraucht (' + genutzt + ' von ' + grenze + ').',
        kontingent: grenze, genutzt: genutzt };
    }
    return { ok: true, kontingent: grenze, genutzt: genutzt };
  }
  return { ok: true, kontingent: null };
}

async function aufrufZaehlen(e) {
  await query(
    'INSERT INTO rechenkerne_aufrufe (user_id, api_key_id, kern, ok, http_status, ms, external_ref) '
    + 'VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [e.userId, e.apiKeyId || null, e.kern, !!e.ok, e.status || null, e.ms || null,
     e.externalRef ? String(e.externalRef).slice(0, 120) : null]);
}

/* Admin: setzen (anlegen oder ändern). Leere Kontingente heißen „ohne Grenze“. */
async function setzen(userId, zusatz, werte, von) {
  if (BEKANNT.indexOf(zusatz) < 0) throw new Error('unbekannter Zusatz: ' + zusatz);
  const kg = function (v) {
    if (v === null || v === undefined || v === '') return null;
    const n = parseInt(v, 10);
    if (!isFinite(n) || n < 0) throw new Error('Kontingent muss eine ganze Zahl ab 0 sein');
    return n;
  };
  const r = await query(
    'INSERT INTO user_zusaetze (user_id, zusatz, aktiv, kontingent_rnd, kontingent_vw, notiz, geaendert_von) '
    + 'VALUES ($1,$2,$3,$4,$5,$6,$7) '
    + 'ON CONFLICT (user_id, zusatz) DO UPDATE SET aktiv=EXCLUDED.aktiv, kontingent_rnd=EXCLUDED.kontingent_rnd, '
    + 'kontingent_vw=EXCLUDED.kontingent_vw, notiz=EXCLUDED.notiz, geaendert_von=EXCLUDED.geaendert_von, updated_at=NOW() '
    + 'RETURNING *',
    [userId, zusatz, werte.aktiv !== false, kg(werte.kontingent_rnd), kg(werte.kontingent_vw),
     werte.notiz ? String(werte.notiz).slice(0, 500) : null, von || null]);
  return r.rows[0];
}

module.exports = { RECHENKERNE, BEKANNT, holen, monatsZaehlung, darfRechnen, aufrufZaehlen, setzen };
