'use strict';
const jwtUtil = require('../utils/jwt');
const { query } = require('../db/pool');
/* mand v807: API-Key-Auth */
const apiKeyService = require('../services/apiKeyService');
const subscriptionService = require('../services/subscriptionService');
/* v2072a: die Schnittstelle haengt am MERKMAL `api_access`, nicht an
   Plannamen. Die Berechtigung liegt damit an EINER Stelle — in der
   Spalte plans.features — und ein neuer Plan braucht keine Codesuche.

   HIER STAND BIS v2072 `PRO_PLAN_IDS = ['pro']`, und v2072 hat daraus
   `['pro','partner']` gemacht. BEIDES WAR FALSCH, das zweite nur
   weniger auffaellig: genau diese Namensliste wurde am 02.10.2026 schon
   einmal entfernt — eine Datei weiter, in routes/apiKeys.js, mit der
   ausdruecklichen Begruendung "wer kuenftig einen Plan anlegt, setzt
   ein Flag und muss keine Namensliste im Code suchen". Die Liste hier
   war die DRITTE Stelle derselben Berechtigung und hat den behobenen
   Fehler wiederholt.

   Gemessen am 10.10.2026 in der Tabelle plans:
     free false · starter false · investor false · pro TRUE · partner TRUE
   Und in subscriptions: partner 3x aktiv, free 1x, starter 1x gekuendigt
   — "pro" kommt dort GAR NICHT vor. Die alte Liste liess also niemanden
   durch, und ihr 403 sah aus wie ein falscher Schluessel.

   Den STATUS prueft das nicht und muss es nicht: getEffectivePlan gibt
   fuer ein nicht aktives Abo plan_id 'free' zurueck (downgraded), und
   free traegt api_access false.

   Die TESTPHASE dagegen braucht eine eigene Pruefung — siehe unten. */
const API_FEATURE = 'api_access';
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
    /* ══ v2136a · DIE FRIST GILT AUCH FUER DEN API-SCHLUESSEL ════════
       GEFUNDEN von meinem eigenen Pruefer, und zwar als Rest: er suchte
       den englischen Satz "User account is disabled" und fand ihn nach
       dem Umbau noch einmal - hier. Es gibt ZWEI Wege in die App, und
       ich hatte nur den einen angefasst.

       > Ein Zugang, der die Frist nicht kennt, hebt sie auf. Wer sich
       > in den sechs Stunden einen API-Schluessel anlegt, haette danach
       > unbegrenzt weitergearbeitet - die Sperre haette nur den Browser
       > getroffen.

       Dieselben drei Lagen wie im Token-Pfad, dieselben Kennwoerter,
       damit ein Aufrufer EINEN Fall behandelt und nicht zwei.

       Die Spalten kommen jetzt mit; vorher stand hier nur `is_active`. */
    const r = await query(
      'SELECT id, email, name, role, is_active, email_verified_at, created_at FROM users WHERE id = $1',
      [rec.user_id]
    );
    if (r.rowCount === 0) return res.status(401).json({ error: 'User no longer exists' });
    const user = r.rows[0];
    if (!user.is_active) {
      if (!user.email_verified_at) {
        return res.status(403).json({
          error: 'Deine E-Mail-Adresse ist noch nicht bestätigt. Bitte klicke den Link in der '
            + 'Bestätigungs-Mail – auch im Spam-Ordner.',
          code: 'EMAIL_NOT_VERIFIED'
        });
      }
      return res.status(403).json({
        error: 'Dieser Zugang ist deaktiviert. Bitte wende dich an den Support.',
        code: 'ACCOUNT_DISABLED'
      });
    }
    if (!user.email_verified_at) {
      const fristApi = require('../config').auth.verifyGnadenfristStunden;
      if (Date.now() > new Date(user.created_at).getTime() + fristApi * 3600 * 1000) {
        return res.status(403).json({
          error: 'Die Frist zur Bestätigung deiner E-Mail-Adresse ist abgelaufen. Lass dir die '
            + 'Bestätigungs-Mail erneut schicken, dann ist der Zugang sofort wieder da.',
          code: 'VERIFY_EXPIRED'
        });
      }
    }
    try {
      const plan = await subscriptionService.getEffectivePlan(user.id);
      /* v2072a: dasselbe Merkmal, das routes/apiKeys.js per
         requireFeature('api_access') prueft. Dort geht es um das ANLEGEN
         eines Schluessels, hier um sein BENUTZEN — beide muessen am
         gleichen Massstab haengen, sonst entsteht wieder eine Tuer, die
         sich zeigt und nicht oeffnet (so war es bis v1791).
         Die Meldung nennt den gemessenen Plan MIT, damit ein 403 nicht
         wieder als falscher Schluessel gelesen wird. */
      if (!plan || !plan.plan_features || !plan.plan_features[API_FEATURE]) {
        return res.status(403).json({
          error: `Feature '${API_FEATURE}' is not available on your plan`,
          plan_id: (plan && plan.plan_id) || null,
          upgrade_required: true
        });
      }
      /* v2072: waehrend der Testphase bleibt die Schnittstelle zu — aus
         demselben Grund, aus dem getEffectivePlan dort export_csv,
         json_backup und excel_import ausschaltet ("Pro-Verkaufsargumente").
         Das Merkmal oben allein reicht nicht: die Testphase liefert die
         FEATURES des gewaehrten Plans, api_access ist darin true.
         Marcels Entscheidung vom 10.10.2026 ("ja b"). */
      if (plan.trial === true) {
        return res.status(403).json({
          error: 'API-Zugang ist in der Testphase nicht enthalten',
          plan_id: plan.plan_id, trial: true,
          trial_ends_at: plan.trial_ends_at || null,
          upgrade_required: true
        });
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

    /* ══ v2136 · DIE FRIST WIRD HIER DURCHGESETZT (N60.3) ═══════════
       `email_verified_at` und `created_at` kommen mit. Vorher stand
       hier nur `is_active`, und das reichte, solange der Riegel die
       Bestaetigung ERZWANG. Seit v2136 ist der Zugang sofort da - also
       muss der Ablauf an einer Stelle greifen, die JEDE Anfrage
       passiert.

       > Eine Frist, die nur beim Anmelden geprueft wird, laeuft fuer
       > eine offene Sitzung nie ab. Der Token gilt sieben Tage; sechs
       > Stunden waeren damit eine Empfehlung. */
    const r = await query(
      'SELECT id, email, name, role, is_active, email_verified_at, created_at FROM users WHERE id = $1',
      [payload.userId]
    );
    if (r.rowCount === 0) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    const user = r.rows[0];
    if (!user.is_active) {
      /* v2136: dieselbe Unterscheidung wie beim Login (v2094) - und
         auf Deutsch. Hier stand 'User account is disabled'. */
      if (!user.email_verified_at) {
        return res.status(403).json({
          error: 'Deine E-Mail-Adresse ist noch nicht bestätigt. Bitte klicke den Link in der '
            + 'Bestätigungs-Mail – auch im Spam-Ordner.',
          code: 'EMAIL_NOT_VERIFIED'
        });
      }
      return res.status(403).json({
        error: 'Dieser Zugang ist deaktiviert. Bitte wende dich an den Support.',
        code: 'ACCOUNT_DISABLED'
      });
    }
    if (!user.email_verified_at) {
      const frist = require('../config').auth.verifyGnadenfristStunden;
      const ablauf = new Date(user.created_at).getTime() + frist * 3600 * 1000;
      if (Date.now() > ablauf) {
        return res.status(403).json({
          error: 'Die Frist zur Bestätigung deiner E-Mail-Adresse ist abgelaufen. Lass dir die '
            + 'Bestätigungs-Mail erneut schicken, dann ist der Zugang sofort wieder da.',
          code: 'VERIFY_EXPIRED'
        });
      }
      /* Noch in der Frist: die App soll den Countdown zeigen koennen,
         ohne eine zweite Anfrage. */
      res.set('X-DP-Verify-Deadline', new Date(ablauf).toISOString());
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
