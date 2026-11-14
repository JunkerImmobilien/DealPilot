'use strict';
/**
 * resellerService.js — Partner/Reseller Businesslogik (Paket 3)
 *
 * Baut auf Migration 055 (resellers, reseller_members, reseller_clients,
 * licenses, object_shares, share_audit) + Migration 056 (Partner-Plan).
 *
 * Pool-Modell: jede licenses-Zeile mit kind='client' = 1 Seat.
 *   pool  = status='pool'        (frei, verteilbar)
 *   assig = status='zugewiesen'  (client_id gesetzt)
 * Die Pool-Größe wird aus der Stripe-Subscription-Menge synchronisiert
 * (syncPoolQuantity) — beim Checkout-Return, bei jedem Pool-Abruf und seit
 * v3303 im Stripe-Webhook (services/partnerSeatsWebhook.js).
 */

const { query } = require('../db/pool');
const planService = require('./planService');

// ── Reseller-Kontext ────────────────────────────────────────────
async function getResellerForUser(userId) {
  // DETERMINISTISCH: Owner-Reseller mit den meisten Lizenzen (= der mit dem Pool),
  // dann ältester. Verhindert, dass bei mehreren Reseller-Zeilen mal die eine,
  // mal die andere gewählt wird (Pool/Mandant-Mismatch).
  const r = await query(
    `SELECT r.* FROM resellers r
      WHERE r.owner_user_id = $1
         OR r.id IN (SELECT reseller_id FROM reseller_members WHERE user_id = $1)
      ORDER BY (r.owner_user_id = $1) DESC,
               (SELECT COUNT(*) FROM licenses l WHERE l.reseller_id = r.id) DESC,
               r.created_at ASC
      LIMIT 1`,
    [userId]
  );
  return r.rows[0] || null;
}

async function ensureReseller(userId, { name, role } = {}) {
  const existing = await getResellerForUser(userId);
  if (existing) return existing;
  const r = await query(
    `INSERT INTO resellers (name, role, owner_user_id) VALUES ($1, $2, $3) RETURNING *`,
    [name || 'Mein Partner-Konto', role || 'sonstige', userId]
  );
  const reseller = r.rows[0];
  await query(
    `INSERT INTO reseller_members (reseller_id, user_id, role)
     VALUES ($1, $2, 'owner') ON CONFLICT (reseller_id, user_id) DO NOTHING`,
    [reseller.id, userId]
  );
  return reseller;
}

// ── Lizenz-Pool ─────────────────────────────────────────────────
/* v3317b · Ein Pool-Platz kann fuer eine Objekt-Uebergabe RESERVIERT sein (Migration 104,
   licenses.reserviert_fuer). Frei ist er nur ohne AKTIVE Reservierung - aktiv heisst: die
   Uebergabe ist gesendet/geoeffnet und nicht abgelaufen. Ablauf braucht so keinen Takt.
   Diese Bedingung gilt fuer Zaehlen, Abbauen (syncPoolQuantity) und Zuweisen - an EINER Stelle. */
const FREI_SQL = `(licenses.reserviert_fuer IS NULL OR NOT EXISTS (
    SELECT 1 FROM objekt_uebergaben ru WHERE ru.id = licenses.reserviert_fuer
       AND ru.status IN ('gesendet','geoeffnet') AND ru.expires_at > now()))`;

async function getPool(resellerId) {
  const r = await query(
    `SELECT
        COUNT(*) FILTER (WHERE kind='client')                          AS gekauft,
        COUNT(*) FILTER (WHERE kind='client' AND status='zugewiesen')  AS zugewiesen,
        COUNT(*) FILTER (WHERE kind='client' AND status='pool' AND ${FREI_SQL})      AS frei,
        COUNT(*) FILTER (WHERE kind='client' AND status='pool' AND NOT ${FREI_SQL})  AS reserviert
       FROM licenses WHERE reseller_id = $1`,
    [resellerId]
  );
  const row = r.rows[0] || {};
  const gekauft = parseInt(row.gekauft, 10) || 0;
  return {
    gekauft:    gekauft,
    zugewiesen: parseInt(row.zugewiesen, 10) || 0,
    frei:       parseInt(row.frei, 10)       || 0,
    reserviert: parseInt(row.reserviert, 10) || 0,   /* v3317b · fuer eine Uebergabe reserviert, zaehlt als belegt */
    /* v1537: davon im Grundpreis enthalten - nur zur Anzeige, nie zum
       Rechnen. Wer Plaetze zaehlt, nimmt 'gekauft'.
       v3303: seit Marcels Entscheidung vom 11.11.2026 ist INKLUSIV_MANDANTEN
       = 0, also immer inklusiv 0 und bezahlt = gekauft. Die Felder bleiben,
       damit kein Leser an einem fehlenden Feld scheitert. */
    inklusiv:   Math.min(INKLUSIV_MANDANTEN, gekauft),
    bezahlt:    Math.max(0, gekauft - INKLUSIV_MANDANTEN)
  };
}

/**
 * Gleicht die Anzahl der client-Seats an targetQty an.
 * Mehr nötig -> neue pool-Zeilen. Weniger -> löscht NUR freie pool-Zeilen
 * (zugewiesene bleiben immer erhalten).
 */
/* ═══ v1537 · Marcel 22.09.2026 ═══════════════════════════════════════════
   Das Partner-Paket enthaelt seit der Preisumstellung auf 99 EUR drei
   Mandanten-Plaetze. Damit das nicht nur auf der Preisseite steht, sondern
   auch wirkt, wird der Aufschlag HIER gerechnet - an der einen Stelle, die
   alle Aufrufer durchlaufen.

   Warum nicht beim Aufrufer: es gibt zwei (Pool-Abruf und Checkout-Return),
   und ein dritter wuerde den Aufschlag vergessen. Genau so ist auf der
   alten Landing das Versprechen "3 Berater-Seats inklusive" entstanden,
   das die Software nie eingeloest hat.

   uebergeben wird weiterhin die GEKAUFTE Menge aus Stripe. Wer null Seats
   kauft, hat drei; wer fuenf kauft, hat acht. Beim Herunterstufen werden
   nur freie Pool-Zeilen geloescht, es bleiben also immer mindestens drei.

   ═══ v3303 · Marcel 11.11.2026 (Preis, freigegeben) ═════════════════════
   Der Partner-Plan kostet weiter 99 EUR/Monat bzw. 1.089 EUR/Jahr, enthaelt
   aber KEINE Kundenplaetze mehr. Jeder Platz wird dazugekauft (Staffel
   unveraendert 19/15/12 EUR, Stripe-Preise unveraendert). Deshalb hier 0:
   wer null Seats kauft, hat null, wer fuenf kauft, hat fuenf.
   Altbestand: auf Prod 0 Reseller und 0 Client-Lizenzen (gemessen). Wo es
   doch Plaetze aus dem alten Aufschlag gibt (Staging-Demo), loescht der
   naechste Abgleich nur FREIE Pool-Zeilen - zugewiesene bleiben immer.
   Die Konstante bleibt stehen (statt zu verschwinden), damit die Stelle,
   an der ein kuenftiger Inklusiv-Anteil wirken MUSS, auffindbar bleibt.
   ════════════════════════════════════════════════════════════════════════ */
const INKLUSIV_MANDANTEN = 0;

async function syncPoolQuantity(resellerId, gekaufteSeats, opts = {}) {
  const targetQty = Math.max(0, parseInt(gekaufteSeats, 10) || 0) + INKLUSIV_MANDANTEN;
  const cycle = opts.interval === 'yearly' ? 'jaehrlich' : 'monatlich';
  const cur = await getPool(resellerId);

  if (targetQty > cur.gekauft) {
    const toAdd = targetQty - cur.gekauft;
    await query(
      `INSERT INTO licenses (reseller_id, kind, status, billing_cycle,
                             stripe_subscription_item_id, current_period_end)
       SELECT $1, 'client', 'pool', $2, $3, $4 FROM generate_series(1, $5)`,
      [resellerId, cycle, opts.stripeSubscriptionItemId || null,
       opts.currentPeriodEnd || null, toAdd]
    );
  } else if (targetQty < cur.gekauft) {
    const toRemove = cur.gekauft - targetQty;
    await query(
      `DELETE FROM licenses WHERE id IN (
         SELECT id FROM licenses
          WHERE reseller_id = $1 AND kind='client' AND status='pool' AND ${FREI_SQL}
          ORDER BY created_at ASC LIMIT $2)`,   /* v3317b · reservierte Plaetze werden nie abgebaut */
      [resellerId, toRemove]
    );
  }

  if (opts.stripeSubscriptionId) {
    await query(
      `UPDATE resellers SET stripe_subscription_id = $2, updated_at = now() WHERE id = $1`,
      [resellerId, opts.stripeSubscriptionId]
    );
  }
  return getPool(resellerId);
}

// ── Clients (Endkunden; Anzeige "Mandant") ──────────────────────
async function createClient(resellerId, { userId, displayName }) {
  const r = await query(
    `INSERT INTO reseller_clients (reseller_id, user_id, display_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (reseller_id, user_id)
       DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING *`,
    [resellerId, userId, displayName]
  );
  return r.rows[0];
}

async function listClients(resellerId) {
  const r = await query(
    `SELECT c.*,
            CASE WHEN EXISTS(
              SELECT 1 FROM licenses l
               WHERE l.reseller_id = c.reseller_id AND l.client_id = c.id AND l.status = 'zugewiesen'
            ) THEN 'zugewiesen' ELSE NULL END AS seat_status
       FROM reseller_clients c
      WHERE c.reseller_id = $1
      ORDER BY c.created_at DESC`,
    [resellerId]
  );
  return r.rows;
}

// ── Seat zuweisen / entziehen ───────────────────────────────────
/* v3357 · PLAN-SCHUTZ (Konzept 13.11.2026, Abschnitt 2, Pflicht). Bis hier setzte ein Platz JEDEN Kunden still auf
   Investor und beim Entziehen auf Free - ein zahlender Pro-Kunde waere herabgestuft worden, sein Stripe-Abo liefe
   weiter. Jetzt: ein bezahltes Abo (Stripe, aktiv) wird nie angefasst; einen Platz bekommt so ein Kunde nicht
   (er verbindet sich als 'eigen'). Sonst merkt sich der Kunde den Plan VOR dem Platz und bekommt ihn beim Entzug
   zurueck. */
async function hatBezahltesAbo(userId) {
  const r = await query(
    `SELECT 1 FROM subscriptions WHERE user_id = $1 AND stripe_subscription_id IS NOT NULL
        AND status IN ('active','trialing','past_due') AND plan_id <> 'free'
        AND (current_period_end IS NULL OR current_period_end > now()) LIMIT 1`, [userId]);
  return r.rowCount > 0;
}
async function _planVorPlatzMerken(clientId, userId) {
  try {
    const cur = await planService.getUserCurrentPlan(userId);
    const pv = cur && cur.planId ? cur.planId : 'free';
    await query(`UPDATE reseller_clients SET plan_vorher = COALESCE(plan_vorher, $2) WHERE id = $1`, [clientId, pv === 'investor' ? 'free' : pv]);
  } catch (e) {}
}
/* W1a-investor: Seat = Investor-Tier (59-EUR-Referenz aus dem Konzept), nicht Starter */
/* v3317b · opts.lizenzId: genau DIESEN (fuer eine Uebergabe reservierten) Platz nehmen, sonst einen freien. */
async function assignSeat(resellerId, clientId, opts) {
  const lizenzId = (opts && opts.lizenzId) || null;
  // Client muss zum Reseller gehören
  const c = await query(
    `SELECT id, user_id FROM reseller_clients WHERE id = $1 AND reseller_id = $2`,
    [clientId, resellerId]
  );
  if (!c.rowCount) { const e = new Error('Client gehört nicht zu diesem Reseller'); e.status = 404; throw e; }
  if (c.rows[0].user_id && await hatBezahltesAbo(c.rows[0].user_id)) {   /* v3357 · Plan-Schutz */
    const e = new Error('eigenes_abo'); e.status = 409; e.detail = 'Der Kunde hat ein eigenes bezahltes Abo, er wird ohne Platz verbunden.'; throw e;
  }

  // IDEMPOTENT: hat der Client schon einen aktiven Seat? -> den zurückgeben,
  // nicht doppelt zuweisen (sonst uq_license_active_per_client-Verletzung).
  const ex = await query(
    `SELECT * FROM licenses WHERE reseller_id = $1 AND client_id = $2 AND status = 'zugewiesen' LIMIT 1`,
    [resellerId, clientId]
  );
  if (ex.rowCount) {
    try { if (c.rows[0].user_id) await planService.setUserPlanManual(c.rows[0].user_id, 'investor', 'monthly', 3650); } catch (e) {}
    return ex.rows[0];
  }

  // Einen freien Pool-Seat atomar greifen
  const r = await query(
    `UPDATE licenses SET client_id = $2, status = 'zugewiesen', assigned_at = now(), reserviert_fuer = NULL
      WHERE id = (
        SELECT id FROM licenses
         WHERE reseller_id = $1 AND kind='client' AND status='pool'
           AND (id = $3::uuid OR ${FREI_SQL})
         ORDER BY (id = $3::uuid) DESC NULLS LAST, created_at ASC
         FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING *`,
    [resellerId, clientId, lizenzId]
  );
  if (!r.rowCount) { const e = new Error('Kein freier Seat im Pool'); e.status = 409; throw e; }
  if (c.rows[0].user_id) await _planVorPlatzMerken(clientId, c.rows[0].user_id);   /* v3357 */
  try { await query(`UPDATE reseller_clients SET platz_art = 'platz' WHERE id = $1`, [clientId]); } catch (e) {}

  /* v3299 · Hier stand "mindestens Starter" - vergeben wird seit jeher Investor
     (10 Jahre, manuell), gemessen in der Partner-Demo 11.11.2026. */
  try { if (c.rows[0].user_id) await planService.setUserPlanManual(c.rows[0].user_id, 'investor', 'monthly', 3650); } catch (e) { /* Plan best-effort */ }
  return r.rows[0];
}

async function unassignSeat(resellerId, clientId) {
  const cu = await query(`SELECT user_id FROM reseller_clients WHERE id = $1 AND reseller_id = $2`, [clientId, resellerId]);
  const r = await query(
    `UPDATE licenses SET client_id = NULL, status = 'pool', assigned_at = NULL
      WHERE reseller_id = $1 AND client_id = $2 AND status = 'zugewiesen'
     RETURNING *`,
    [resellerId, clientId]
  );
  /* v3357 · Plan-Schutz: ein bezahltes Abo bleibt; sonst der Plan von VOR dem Platz (Standard Free) */
  try {
    const uid = cu.rows[0] && cu.rows[0].user_id;
    if (uid && r.rowCount && !(await hatBezahltesAbo(uid))) {
      const pv = (await query(`SELECT plan_vorher FROM reseller_clients WHERE id = $1`, [clientId])).rows[0];
      const ziel = pv && pv.plan_vorher && pv.plan_vorher !== 'investor' ? pv.plan_vorher : 'free';
      await planService.setUserPlanManual(uid, ziel, 'monthly', 3650);
      await query(`UPDATE reseller_clients SET plan_vorher = NULL WHERE id = $1`, [clientId]);
    }
  } catch (e) {}
  return r.rows[0] || null;
}

// ── Freigaben (object_shares) ───────────────────────────────────
async function _audit(shareId, actorUserId, action, meta) {
  try {
    await query(
      `INSERT INTO share_audit (share_id, actor_user_id, action, meta)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [shareId, actorUserId || null, action, meta ? JSON.stringify(meta) : null]
    );
  } catch (e) { /* Audit ist best-effort */ }
}

async function reviewShare(resellerId, shareId, { decision, actorUserId }) {
  const status = decision === 'bestaetigt' ? 'bestaetigt' : 'zurueckgegeben';
  const r = await query(
    `UPDATE object_shares SET status = $3, reviewed_at = now(), updated_at = now()
      WHERE id = $1 AND reseller_id = $2 RETURNING *`,
    [shareId, resellerId, status]
  );
  if (r.rowCount) await _audit(shareId, actorUserId, status, {});
  return r.rows[0] || null;
}

async function revokeShare(resellerId, shareId, actorUserId) {
  const r = await query(
    `UPDATE object_shares SET status = 'widerrufen', revoked_at = now(), updated_at = now()
      WHERE id = $1 AND reseller_id = $2 RETURNING *`,
    [shareId, resellerId, actorUserId]
  );
  if (r.rowCount) await _audit(shareId, actorUserId, 'widerrufen', {});
  return r.rows[0] || null;
}

// ── Mandanten-Menü (Reseller-Sicht) ─────────────────────────────
async function listMandanten(resellerId) {
  const r = await query(
    `SELECT c.id, c.display_name, c.status, c.created_at,
            COUNT(s.id) FILTER (WHERE s.status <> 'widerrufen')  AS freigaben,
            COUNT(s.id) FILTER (WHERE s.status =  'eingereicht') AS offen_pruefung,
            MAX(s.updated_at)                                    AS last_activity
       FROM reseller_clients c
       LEFT JOIN object_shares s ON s.client_id = c.id
      WHERE c.reseller_id = $1
      GROUP BY c.id
      ORDER BY offen_pruefung DESC, last_activity DESC NULLS LAST`,
    [resellerId]
  );
  return r.rows;
}

// ── Freigaben: Mandanten- + Reseller-Sicht ──────────────────────
async function getMyReseller(userId) {
  const r = await query(
    `SELECT rs.id, COALESCE(NULLIF(rs.brand_name,''), rs.name) AS brand_name, rs.whitelabel_enabled
       FROM reseller_clients c JOIN resellers rs ON rs.id = c.reseller_id
      WHERE c.user_id = $1 LIMIT 1`, [userId]);
  return r.rows[0] || null;
}

async function createMandantShare(userId, objectId) {
  const rc = await query(`SELECT id, reseller_id FROM reseller_clients WHERE user_id = $1 LIMIT 1`, [userId]);
  if (!rc.rowCount) { const e = new Error('not_a_mandant'); e.status = 403; throw e; }
  const client = rc.rows[0];
  const obj = await query(`SELECT id FROM objects WHERE id = $1 AND user_id = $2`, [objectId, userId]);
  if (!obj.rowCount) { const e = new Error('object_not_found'); e.status = 404; throw e; }
  const ex = await query(
    `SELECT id, status FROM object_shares
      WHERE reseller_id = $1 AND object_id = $2 AND status IN ('eingereicht','bestaetigt') LIMIT 1`,
    [client.reseller_id, objectId]);
  if (ex.rowCount) return ex.rows[0];
  /* W14-reshare: Die Vorpruefung oben findet nur 'eingereicht'/'bestaetigt'.
     Ein WIDERRUFENES oder zurueckgegebenes Share bleibt als Zeile bestehen —
     object_shares hat UNIQUE(object_id, reseller_id), der INSERT lief also in
     einen Duplicate-Key. Ergebnis: ein einmal widerrufenes Objekt konnte NIE
     wieder freigegeben werden. Jetzt: UPSERT, der die alte Zeile reaktiviert
     und die Zeitstempel der Vorrunde sauber zuruecksetzt. */
  const r = await query(
    `INSERT INTO object_shares (reseller_id, client_id, object_id, status, submitted_at)
     VALUES ($1, $2, $3, 'eingereicht', now())
     ON CONFLICT (object_id, reseller_id) DO UPDATE SET
       status       = 'eingereicht',
       client_id    = EXCLUDED.client_id,
       submitted_at = now(),
       reviewed_at  = NULL,
       revoked_at   = NULL,
       updated_at   = now()
     RETURNING *`,
    [client.reseller_id, client.id, objectId]);
  try { await _audit(r.rows[0].id, userId, 'eingereicht', {}); } catch (e) {}
  return r.rows[0];
}

async function listMandantShares(userId) {
  const r = await query(
    `SELECT s.id, s.object_id, s.status, s.created_at, s.updated_at,
            COALESCE(NULLIF(o.name,''), o.kuerzel, 'Objekt') AS obj_name, o.ort, o.seq_no
       FROM object_shares s
       JOIN reseller_clients c ON c.id = s.client_id
       LEFT JOIN objects o ON o.id = s.object_id
      WHERE c.user_id = $1 AND s.status <> 'widerrufen'
      ORDER BY s.updated_at DESC`, [userId]);
  return r.rows;
}

async function revokeMandantShare(userId, shareId) {
  const r = await query(
    `UPDATE object_shares s SET status='widerrufen', revoked_at=now(), updated_at=now()
       FROM reseller_clients c
      WHERE s.id = $1 AND s.client_id = c.id AND c.user_id = $2
      RETURNING s.*`, [shareId, userId]);
  if (r.rowCount) { try { await _audit(shareId, userId, 'widerrufen', {}); } catch (e) {} }
  return r.rows[0] || null;
}

async function listSharesForReseller(resellerId) {
  const r = await query(
    `SELECT s.id, s.object_id, s.status, s.created_at, s.updated_at,
            c.display_name AS mandant,
            COALESCE(NULLIF(o.name,''), o.kuerzel, 'Objekt') AS obj_name, o.ort, o.seq_no,
            o.kaufpreis, o.dscr, o.cf_ns
       FROM object_shares s
       JOIN reseller_clients c ON c.id = s.client_id
       LEFT JOIN objects o ON o.id = s.object_id
      WHERE s.reseller_id = $1 AND s.status <> 'widerrufen'
      ORDER BY (s.status = 'eingereicht') DESC, s.updated_at DESC`, [resellerId]);
  return r.rows;
}

// Cross-Account: freigegebenes Objekt read-only holen (nur eigene, aktive Freigabe)
/* W27-sharedowner: Der Partner soll die ECHTEN Engine-PDFs eines freigegebenen
   Objekts ziehen koennen (Investment, Werbungskosten pro Jahr). Die Engine laeuft
   im Frontend und laedt ueber GET /objects/:id — dort bekommt der Partner heute
   404, weil das Objekt dem Mandanten gehoert.
   Diese Funktion liefert die USER-ID DES EIGENTUEMERS, wenn eine AKTIVE Freigabe
   besteht — sonst null. Die Route ruft damit dieselbe getById()-Funktion wie sonst
   auch: gleiche Datenform, gleicher Codepfad, kein Parallelweg.
   Regel identisch zu getSharedObject(): widerrufen/zurueckgegeben = kein Zugriff. */
async function sharedObjectOwner(userId, objectId) {
  try {
    const rs = await getResellerForUser(userId);
    if (!rs) return null;
    const s = await query(
      `SELECT status FROM object_shares WHERE object_id = $1 AND reseller_id = $2 LIMIT 1`,
      [objectId, rs.id]);
    if (!s.rowCount) return null;
    const st = s.rows[0].status;
    if (st === 'widerrufen' || st === 'zurueckgegeben') return null;
    const o = await query(`SELECT user_id FROM objects WHERE id = $1`, [objectId]);
    return o.rowCount ? o.rows[0].user_id : null;
  } catch (e) { return null; }
}

async function getSharedObject(resellerId, shareId) {
  const s = await query(`SELECT object_id, status FROM object_shares WHERE id = $1 AND reseller_id = $2`, [shareId, resellerId]);
  if (!s.rowCount) { const e = new Error('share_not_found'); e.status = 404; throw e; }
  if (s.rows[0].status === 'widerrufen' || s.rows[0].status === 'zurueckgegeben') { const e = new Error('share_inactive'); e.status = 403; throw e; }
  const o = await query(
    `SELECT id, name, kuerzel, ort, seq_no, kaufpreis, dscr, cf_ns, bmy, data, ai_analysis
       FROM objects WHERE id = $1`, [s.rows[0].object_id]);
  if (!o.rowCount) { const e = new Error('object_not_found'); e.status = 404; throw e; }
  return o.rows[0];
}

// ── Einladungen (reseller_invites) ──────────────────────────
const crypto = require('crypto');

async function createInvite(resellerId, { email, displayName, invitedBy }) {
  email = String(email || '').trim().toLowerCase();
  displayName = String(displayName || '').trim();
  if (!email || !displayName) { const e = new Error('email_and_displayName_required'); e.status = 400; throw e; }
  // offene Einladung an dieselbe Mail wiederverwenden
  const ex = await query(
    `SELECT * FROM reseller_invites WHERE reseller_id=$1 AND email=$2 AND status='pending' LIMIT 1`,
    [resellerId, email]
  );
  if (ex.rowCount) return ex.rows[0];
  const token = crypto.randomBytes(24).toString('hex');
  const r = await query(
    `INSERT INTO reseller_invites (reseller_id, email, display_name, token, invited_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [resellerId, email, displayName, token, invitedBy || null]
  );
  return r.rows[0];
}

async function listInvites(resellerId) {
  const r = await query(
    `SELECT id, email, display_name, status, invited_at, expires_at
       FROM reseller_invites WHERE reseller_id=$1 AND status='pending'
       ORDER BY invited_at DESC`,
    [resellerId]
  );
  return r.rows;
}

async function revokeInvite(resellerId, inviteId) {
  const r = await query(
    `UPDATE reseller_invites SET status='revoked' WHERE id=$1 AND reseller_id=$2 AND status='pending' RETURNING id`,
    [inviteId, resellerId]
  );
  return r.rowCount > 0;
}

// Öffentliche Info für die Einladungs-Landeseite (kein Auth)
async function getInviteInfo(token) {
  const r = await query(
    `SELECT i.email, i.display_name, i.status, i.expires_at,
            COALESCE(NULLIF(r.brand_name,''), r.name) AS brand_name
       FROM reseller_invites i JOIN resellers r ON r.id = i.reseller_id
      WHERE i.token = $1 LIMIT 1`,
    [token]
  );
  const row = r.rows[0];
  if (!row) return null;
  const valid = row.status === 'pending' && new Date(row.expires_at) > new Date();
  return { email: row.email, display_name: row.display_name, brand_name: row.brand_name, valid: valid, status: row.status };
}

// Annahme durch den eingeloggten Mandanten (userId aus Auth)
async function acceptInvite(token, userId) {
  const inv = await query(`SELECT * FROM reseller_invites WHERE token=$1 LIMIT 1`, [token]);
  const invite = inv.rows[0];
  if (!invite) { const e = new Error('invite_not_found'); e.status = 404; throw e; }
  if (invite.status !== 'pending') { const e = new Error('invite_already_used'); e.status = 409; throw e; }
  if (new Date(invite.expires_at) <= new Date()) { const e = new Error('invite_expired'); e.status = 410; throw e; }

  // Client anlegen (bzw. vorhandenen wiederverwenden)
  const client = await createClient(invite.reseller_id, { userId: userId, displayName: invite.display_name });

  await query(
    `UPDATE reseller_invites SET status='accepted', accepted_at=now(), client_id=$2 WHERE id=$1`,
    [invite.id, client.id]
  );

  /* v3357 · Zugangsart: ein bezahltes Abo bleibt (eigen), sonst Platz, wenn die Einladung ihn mitgibt */
  const bezahlt = await hatBezahltesAbo(userId);
  const art = (invite.platz_mitgeben !== false && !bezahlt) ? 'platz' : 'eigen';
  await query(`UPDATE reseller_clients SET platz_art = $2, herkunft = 'einladung', verbunden_am = now(), getrennt_am = NULL, getrennt_von = NULL,
                      stufe = COALESCE(stufe, 2) WHERE id = $1`, [client.id, art]);
  var seatAssigned = false;
  if (art === 'platz') { try { await assignSeat(invite.reseller_id, client.id); seatAssigned = true; } catch (e) { /* kein freier Seat -> Partner weist später zu */ } }
  try { await query(`INSERT INTO partner_meldungen (reseller_id, client_id, art, text) VALUES ($1,$2,'verbindung_angenommen',$3)`,
    [invite.reseller_id, client.id, invite.display_name + ' hat die Einladung angenommen' + (art === 'eigen' ? ' (eigener Plan)' : '')]); } catch (e) {}

  const rname = await query(
    `SELECT COALESCE(NULLIF(brand_name,''), name) AS brand_name FROM resellers WHERE id=$1`,
    [invite.reseller_id]
  );
  return { ok: true, brand_name: rname.rows[0] ? rname.rows[0].brand_name : 'DealPilot', client_id: client.id, seat_assigned: seatAssigned };
}

async function deleteClient(resellerId, clientId) {
  const cu = await query(`SELECT user_id FROM reseller_clients WHERE id = $1 AND reseller_id = $2`, [clientId, resellerId]);
  // aktiven Seat zurück in den Pool
  await query(
    `UPDATE licenses SET status='pool', client_id=NULL, assigned_at=NULL
       WHERE reseller_id=$1 AND client_id=$2 AND status='zugewiesen'`,
    [resellerId, clientId]
  );
  await query(`DELETE FROM reseller_clients WHERE id=$1 AND reseller_id=$2`, [clientId, resellerId]);
  try { if (cu.rows[0] && cu.rows[0].user_id) await planService.setUserPlanManual(cu.rows[0].user_id, 'free', 'monthly', 3650); } catch (e) {}
  return { ok: true };
}

module.exports = {
  hatBezahltesAbo,
  FREI_SQL,   /* v3317b */
  getResellerForUser,
  ensureReseller,
  getPool,
  syncPoolQuantity,
  INKLUSIV_MANDANTEN,
  createClient,
  listClients,
  assignSeat,
  unassignSeat,
  deleteClient,
  reviewShare,
  revokeShare,
  listMandanten,
  getMyReseller,
  createMandantShare,
  listMandantShares,
  revokeMandantShare,
  listSharesForReseller,
  getSharedObject,
  sharedObjectOwner,   /*W27-sharedowner*/
  createInvite,
  listInvites,
  revokeInvite,
  getInviteInfo,
  acceptInvite
};
