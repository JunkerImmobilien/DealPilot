'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   maklerHubService.js · v3190 — DealPilot als Anmelde- und Abo-Dienst des Makler-Hubs

   Vertrag: Dateien/Makler-Hub/Anmeldung-Schnittstelle.md (04.11.2026). OAuth 2.0 Authorization Code
   mit PKCE (S256). Marcel 05.11.2026: der Makler-Hub läuft vorerst unter dem Partner-Paket - gleicher
   Preis, gleiche Platzzahl, Standardkontingent für Partner. Ob ein Paket den Hub enthält, sagt das
   Feature-Flag `makler_hub` am Plan (Migration 097), nicht eine Namensliste im Code.

   Geheimnisse (client_secret, hub_token, api_key) stehen nie in Logs und werden nur als Hash gespeichert.
   ═══════════════════════════════════════════════════════════════════════ */
const crypto = require('crypto');
const { query } = require('../db/pool');
const subscriptionService = require('./subscriptionService');
const apiKeyService = require('./apiKeyService');
const zusatzService = require('./zusatzService');   /* v3289 · Flow-Linien */

let credits = null;
try { credits = require('./aiCreditsService'); } catch (e) { credits = null; }

const CODE_SEKUNDEN = 60;
const API_KEY_NAME = 'Makler-Hub';

function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function b64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function zufall(n) { return b64url(crypto.randomBytes(n || 32)); }
function gleich(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ── Einstellungen ─────────────────────────────────────────────────── */
function einstellungen() {
  return {
    clientId: process.env.MAKLERHUB_CLIENT_ID || '',
    secret: process.env.MAKLERHUB_CLIENT_SECRET || '',
    redirects: String(process.env.MAKLERHUB_REDIRECT_URIS || '').split(',').map((s) => s.trim()).filter(Boolean),
    webhook: process.env.MAKLERHUB_WEBHOOK || ''
  };
}
function bereit() { const e = einstellungen(); return !!(e.clientId && e.secret && e.secret.length >= 32 && e.redirects.length); }
/** client_id bekannt und redirect_uri exakt in der Liste? */
function clientPruefen(clientId, redirectUri) {
  const e = einstellungen();
  if (!bereit()) return { ok: false, grund: 'Makler-Hub ist auf diesem Server nicht eingerichtet.' };
  if (!clientId || clientId !== e.clientId) return { ok: false, grund: 'Unbekannte Anwendung.' };
  if (!redirectUri || e.redirects.indexOf(redirectUri) < 0) return { ok: false, grund: 'Die Rücksprungadresse ist nicht freigegeben.' };
  return { ok: true };
}
/** Basic-Auth client_id:client_secret prüfen */
function clientAuth(header) {
  const e = einstellungen();
  const m = /^Basic\s+(.+)$/i.exec(String(header || ''));
  if (!m || !bereit()) return false;
  let roh = '';
  try { roh = Buffer.from(m[1], 'base64').toString('utf8'); } catch (x) { return false; }
  const i = roh.indexOf(':');
  if (i < 0) return false;
  return gleich(roh.slice(0, i), e.clientId) && gleich(roh.slice(i + 1), e.secret);
}

async function protokoll(userId, art, ip, detail) {
  try {
    await query('INSERT INTO hub_protokoll (user_id, client_id, art, ip, detail) VALUES ($1,$2,$3,$4,$5)',
      [userId || null, einstellungen().clientId || null, art, ip || null, JSON.stringify(detail || {})]);
  } catch (e) { /* Protokoll darf den Ablauf nie aufhalten */ }
}

/* ── Konto, Paket, Kontingent ──────────────────────────────────────── */
async function konto(userId) {
  const u = await query('SELECT id, email, name, email_verified_at FROM users WHERE id=$1', [userId]);
  if (!u.rowCount) return null;
  const r = u.rows[0];
  const plan = await subscriptionService.getEffectivePlan(userId);
  const f = plan.plan_features || {};
  const hub = f.makler_hub === true;
  /* v3289 · DealPilot Flow (Flow-Investor-Schnittstelle.md, Punkt 7): die Linien der Firma aus
     Plan-Merkmal und Zusatz je Konto. Der Hub uebernimmt sie als meta.linien. makler_hub bleibt
     und bedeutet ["makler"]. */
  let flowLinien = hub ? ['makler'] : [];
  try { flowLinien = await zusatzService.flowLinien(userId, plan); } catch (e) { /* Liste bleibt beim Plan */ }
  const paket = {
    plan_id: plan.plan_id,
    /* Partnertypen folgen (Marcel 05.11.2026): heute ist jeder Partner ein Makler-Partner */
    partner_typ: hub ? 'makler' : null,
    makler_hub: hub,
    flow_linien: flowLinien,   /* v3289 */
    plaetze: Math.max(1, Number(plan.max_users) || 1),
    status: plan.status || 'active',
    bis: plan.current_period_end ? new Date(plan.current_period_end).toISOString().slice(0, 10) : (plan.trial_ends_at ? new Date(plan.trial_ends_at).toISOString().slice(0, 10) : null),
    testphase: !!plan.trial
  };
  let kontingent = {};
  try {
    if (credits && typeof credits.getStatus === 'function') {
      const s = await credits.getStatus(userId);
      ['mpi', 'mpi_plus', 'wev'].forEach((a) => {
        const x = s && s.arten && s.arten[a];
        kontingent[a] = { limit: x ? (x.limit || 0) : 0, rest: x ? (x.rest || 0) : 0 };
      });
    }
  } catch (e) { kontingent = {}; }
  return {
    konto: { id: r.id, email: r.email, name: r.name || r.email, email_verifiziert: !!r.email_verified_at },
    paket: paket,
    kontingent: kontingent
  };
}

/* ── 2. Code ausstellen (angemeldet) ───────────────────────────────── */
async function codeAusstellen(userId, clientId, redirectUri, codeChallenge, ip) {
  const p = clientPruefen(clientId, redirectUri);
  if (!p.ok) { const err = new Error(p.grund); err.status = 400; throw err; }
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(String(codeChallenge || ''))) { const err = new Error('code_challenge fehlt oder ist ungültig (S256, Base64url).'); err.status = 400; throw err; }
  const code = zufall(32);
  await query('INSERT INTO hub_codes (code_hash, user_id, client_id, redirect_uri, code_challenge, expires_at) VALUES ($1,$2,$3,$4,$5, NOW() + ($6 || \' seconds\')::interval)',
    [sha256(code), userId, clientId, redirectUri, codeChallenge, String(CODE_SEKUNDEN)]);
  await protokoll(userId, 'code', ip, {});
  return code;
}

/* ── 3. Code gegen Token tauschen (Hub-Server) ─────────────────────── */
async function tokenTauschen(body, ip) {
  const b = body || {};
  if (b.grant_type !== 'authorization_code' || !b.code || !b.redirect_uri || !b.code_verifier) return { fehler: 'invalid_grant' };
  /* Code atomar verbrauchen: nur eine Anfrage bekommt die Zeile */
  const r = await query(
    'UPDATE hub_codes SET used_at = NOW() WHERE code_hash=$1 AND used_at IS NULL AND expires_at > NOW() RETURNING user_id, client_id, redirect_uri, code_challenge',
    [sha256(b.code)]);
  if (!r.rowCount) { await protokoll(null, 'token_fehler', ip, { grund: 'code' }); return { fehler: 'invalid_grant' }; }
  const c = r.rows[0];
  const pkce = b64url(crypto.createHash('sha256').update(String(b.code_verifier)).digest());
  if (c.redirect_uri !== b.redirect_uri || c.client_id !== einstellungen().clientId || !gleich(pkce, c.code_challenge)) {
    await protokoll(c.user_id, 'token_fehler', ip, { grund: c.redirect_uri !== b.redirect_uri ? 'redirect' : 'pkce' });
    return { fehler: 'invalid_grant' };
  }
  const k = await konto(c.user_id);
  if (!k) return { fehler: 'invalid_grant' };

  /* alte Verbindung dieses Clients ersetzen - Token und Makler-Hub-Schlüssel widerrufen */
  const alt = await query('UPDATE hub_verbindungen SET revoked_at = NOW() WHERE user_id=$1 AND client_id=$2 AND revoked_at IS NULL RETURNING api_key_id', [c.user_id, c.client_id]);
  for (const z of alt.rows) { if (z.api_key_id) { try { await apiKeyService.revoke(c.user_id, z.api_key_id); } catch (e) {} } }

  const hubToken = 'dph_' + zufall(32);
  let apiKey = null, apiKeyId = null;
  /* v3289 · Den Schluessel bekommt jede Firma mit einer Flow-Linie, nicht nur makler_hub.
     Der Bereich (scope) folgt den Linien:
       nur makler                 'crud'       - wie bisher (Vertrag Anmeldung-Schnittstelle.md: Rechte crud),
                                                 haengt weiter an api_access und ist in der Testphase zu
       investor/privat, kein makler  'flow'    - darf NUR die Flow-Routen (middleware/flow.js), geht auch in
                                                 der Testphase, solange die Linie freigeschaltet ist
       makler + investor/privat   'crud flow'  - wie crud; wo crud nicht greift (Testphase), bleiben die Flow-Routen
     Ohne Freischaltung einer Linie bleibt alles wie heute (Marcel 11.11.2026). */
  const linien = k.paket.flow_linien || [];
  const scope = apiKeyScope(linien);
  if (scope) {
    const neu = await apiKeyService.createForUser(c.user_id, { name: API_KEY_NAME, scopes: scope });
    apiKey = neu.plain; apiKeyId = neu.id;
  }
  await query('INSERT INTO hub_verbindungen (user_id, client_id, token_hash, api_key_id) VALUES ($1,$2,$3,$4)', [c.user_id, c.client_id, sha256(hubToken), apiKeyId]);
  await protokoll(c.user_id, 'token', ip, { makler_hub: k.paket.makler_hub, flow_linien: linien, scope: scope });
  const antwort = Object.assign({}, k, { hub_token: hubToken });
  if (apiKey) antwort.api_key = apiKey;
  return { antwort: antwort };
}

/** v3289 · Bereich des Hub-Schluessels aus den Linien (siehe tokenTauschen). null = kein Schluessel. */
function apiKeyScope(linien) {
  const l = Array.isArray(linien) ? linien : [];
  const makler = l.indexOf('makler') >= 0;
  const flow = l.indexOf('investor') >= 0 || l.indexOf('privat') >= 0;
  if (makler && flow) return 'crud flow';
  if (makler) return 'crud';
  if (flow) return 'flow';
  return null;
}

/* ── 4./5. Bearer hub_token ────────────────────────────────────────── */
async function verbindungZumToken(authHeader) {
  const m = /^Bearer\s+(dph_[A-Za-z0-9_-]+)$/.exec(String(authHeader || ''));
  if (!m) return null;
  const r = await query('UPDATE hub_verbindungen SET last_used_at = NOW() WHERE token_hash=$1 AND revoked_at IS NULL RETURNING id, user_id, client_id, api_key_id', [sha256(m[1])]);
  return r.rowCount ? r.rows[0] : null;
}
async function trennen(verbindung, ip, quelle) {
  await query('UPDATE hub_verbindungen SET revoked_at = NOW() WHERE id=$1 AND revoked_at IS NULL', [verbindung.id]);
  if (verbindung.api_key_id) { try { await apiKeyService.revoke(verbindung.user_id, verbindung.api_key_id); } catch (e) {} }
  await protokoll(verbindung.user_id, 'getrennt', ip, { quelle: quelle || 'hub' });
}
/** In DealPilot getrennt (Einstellungen): alle aktiven Verbindungen des Nutzers, danach Webhook */
async function trennenFuerNutzer(userId, ip) {
  const r = await query('SELECT id, user_id, client_id, api_key_id FROM hub_verbindungen WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
  for (const v of r.rows) await trennen(v, ip, 'dealpilot');
  if (r.rowCount) ereignis(userId, 'verbindung.getrennt');
  return r.rowCount;
}
async function verbunden(userId) {
  const r = await query('SELECT created_at, last_used_at FROM hub_verbindungen WHERE user_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1', [userId]);
  return r.rowCount ? r.rows[0] : null;
}

/* ── 6. Webhook DealPilot → Hub ────────────────────────────────────────
   Nur für Nutzer mit Verbindung (oder beim Trennen). Signatur HMAC-SHA256(body, client_secret),
   bis zu fünf Wiederholungen mit wachsendem Abstand. Läuft im Hintergrund, blockiert nie den Aufrufer. */
function ereignis(userId, art) {
  const e = einstellungen();
  if (!e.webhook || !bereit() || !userId) return;
  (async () => {
    if (art !== 'verbindung.getrennt') {
      const v = await query('SELECT 1 FROM hub_verbindungen WHERE user_id=$1 AND revoked_at IS NULL LIMIT 1', [userId]).catch(() => ({ rowCount: 0 }));
      if (!v.rowCount) return;
    }
    const body = JSON.stringify({ ereignis: art, konto_id: userId, zeit: new Date().toISOString() });
    const sig = 'sha256=' + crypto.createHmac('sha256', e.secret).update(body).digest('hex');
    for (let versuch = 0; versuch < 6; versuch++) {
      try {
        const r = await fetch(e.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-DealPilot-Signatur': sig }, body: body, signal: AbortSignal.timeout(10000) });
        if (r.ok) { await protokoll(userId, 'webhook', null, { ereignis: art, status: r.status, versuch: versuch }); return; }
      } catch (x) { /* nächster Versuch */ }
      await new Promise((ok) => setTimeout(ok, Math.min(300000, 2000 * Math.pow(3, versuch))));
    }
    await protokoll(userId, 'webhook', null, { ereignis: art, fehlgeschlagen: true });
  })().catch(() => {});
}

/* abgelaufene Codes aufräumen (beim Ausstellen gelegentlich) */
async function aufraeumen() { try { await query("DELETE FROM hub_codes WHERE expires_at < NOW() - interval '1 day'"); } catch (e) {} }

module.exports = { bereit, clientPruefen, clientAuth, konto, codeAusstellen, tokenTauschen, verbindungZumToken, trennen, trennenFuerNutzer, verbunden, ereignis, aufraeumen, API_KEY_NAME,
  apiKeyScope };   /* v3289 */
