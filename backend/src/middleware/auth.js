'use strict';
const jwtUtil = require('../utils/jwt');
const { query } = require('../db/pool');
/* mand v807: API-Key-Auth */
const apiKeyService = require('../services/apiKeyService');
const subscriptionService = require('../services/subscriptionService');
const PRO_PLAN_IDS = ['pro'];
const _apiKeyRate = new Map();
function _rateOk(keyId) {
  const now = Date.now();
  let e = _apiKeyRate.get(keyId);
  if (!e || now - e.ts > 60000) { e = { count: 0, ts: now }; _apiKeyRate.set(keyId, e); }
  e.count++;
  return e.count <= 120;
}
async function _authViaApiKey(req, res, next, plain) {
  try {
    const rec = await apiKeyService.findValidByPlaintext(plain);
    if (!rec) return res.status(401).json({ error: 'Invalid or revoked API key' });
    if (!_rateOk(rec.id)) return res.status(429).json({ error: 'Rate limit exceeded (120/min)' });
    const r = await query('SELECT id, email, name, role, is_active FROM users WHERE id = $1', [rec.user_id]);
    if (r.rowCount === 0) return res.status(401).json({ error: 'User no longer exists' });
    const user = r.rows[0];
    if (!user.is_active) return res.status(403).json({ error: 'User account is disabled' });
    try {
      const plan = await subscriptionService.getEffectivePlan(user.id);
      if (PRO_PLAN_IDS.indexOf(((plan && plan.plan_id) || '').toLowerCase()) < 0) {
        return res.status(403).json({ error: 'API access requires an active Pro plan' });
      }
    } catch (e) { /* im Zweifel durchlassen statt Owner aussperren */ }
    req.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    req.apiKey = { id: rec.id, scopes: rec.scopes };

    /* ── v1796 · DER SCOPE WIRD JETZT AUCH GELESEN ────────────────────────
     *
     * Hier wurde `rec.scopes` seit jeher GESETZT und an keiner Stelle des
     * Programms ausgewertet — gemessen am 02.10.2026 quer durch
     * `backend/src`: genau ein Treffer, nämlich diese Zuweisung.
     *
     *   > Ein Recht, das vergeben, angezeigt und nie geprüft wird, ist
     *   > keine Einschränkung, sondern eine Behauptung. Die Oberfläche sagt
     *   > dem Nutzer, sein Key könne „lesen" — und er kann löschen.
     *
     * Die Prüfung sitzt hier und nicht an den Routen: eine Stelle deckt
     * alle, und niemand kann sie beim nächsten Endpunkt vergessen.
     *
     * RUECKWAERTSKOMPATIBEL: alle drei heute vergebenen Keys tragen `crud`,
     * also ändert sich für sie nichts. Ein Key OHNE Scope behält vollen
     * Zugriff — ihn nachträglich zu entrechten würde eine laufende
     * Verbindung brechen, und der Fehler läge nicht beim Nutzer. Er wird
     * stattdessen protokolliert.
     *
     * Damit ist der Weg frei für einen Bot-Key, der nur lesen darf. */
    const scope = String(rec.scopes || '').toLowerCase();
    const schreibend = ['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(req.method) >= 0;
    if (!scope) {
      console.warn('[api-key] ' + rec.id + ' hat keinen Scope — voller Zugriff (Altbestand)');
    } else if (schreibend && scope.indexOf('crud') < 0 && scope.indexOf('write') < 0) {
      return res.status(403).json({
        error: 'Dieser API-Key darf nur lesen.',
        scope: scope, methode: req.method
      });
    } else if (req.method === 'DELETE' && scope.indexOf('crud') < 0 && scope.indexOf('delete') < 0) {
      return res.status(403).json({
        error: 'Dieser API-Key darf nicht loeschen.',
        scope: scope, methode: req.method
      });
    }

    apiKeyService.touchLastUsed(rec.id).catch(function () {});
    next();
  } catch (err) { next(err); }
}

/**
 * Authenticate request via Bearer token in Authorization header.
 * Sets req.user = { id, email, name, role }
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      /* mand v807: API-Key-Pfad */
      const _apiKeyPlain = req.headers['x-api-key'];
      if (_apiKeyPlain) return _authViaApiKey(req, res, next, _apiKeyPlain);
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    let payload;
    try {
      payload = jwtUtil.verify(match[1]);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Verify user still exists and is active
    const r = await query(
      'SELECT id, email, name, role, is_active FROM users WHERE id = $1',
      [payload.userId]
    );
    if (r.rowCount === 0) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    const user = r.rows[0];
    if (!user.is_active) {
      return res.status(403).json({ error: 'User account is disabled' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require user to have a specific role
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
