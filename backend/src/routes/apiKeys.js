'use strict';
/* routes/apiKeys.js — DealPilot API-Key-Selbstverwaltung (mand v807)
 * Mount: /api/v1/api-keys. Nur per echtem Login (JWT), nur Pro. */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const subscriptionService = require('../services/subscriptionService');
const apiKeyService = require('../services/apiKeyService');

router.use(authenticate);

/* Verwaltung NIE per API-Key selbst (kein Key, der Keys verwaltet) */
function requireJwt(req, res, next) {
  if (req.apiKey) return res.status(403).json({ error: 'Key-Verwaltung nur nach Login moeglich' });
  next();
}
/* v1791 · HIER STAND EINE PRUEFUNG AUF DEN PLAN-NAMEN: `!== 'pro'`.
   Der Partner wurde damit ausgesperrt, obwohl er `api_access` hat —
   gemessen am 02.10.2026 in der Staging-Datenbank:

     free false · starter false · investor false · pro TRUE · partner TRUE

   Die Oberflaeche wusste es laengst besser. `frontend/js/apikeys.js:9`
   traegt seit v1081 den Kommentar "war === 'pro'. Der Partner hat
   api_access in der DB, wurde hier aber trotzdem ausgesperrt" — und
   prueft seitdem die Planfamilie. DER SERVER WURDE NIE NACHGEZOGEN.

   Folge, an Marcels eigenem Konto sichtbar: das Panel erscheint (der
   Client laesst ihn durch) und jeder Aufruf dahinter scheitert mit 403.
   In den Einstellungen stand "Fehler: API-Keys erfordern einen aktiven
   Pro-Plan" — bei einem Partner-Abo.

   > Eine Berechtigung an zwei Stellen mit zwei Massstaeben: der laxere
   > laesst herein, der strengere wirft hinaus. Der Nutzer sieht eine Tuer,
   > die sich nicht oeffnet, und keiner der beiden meldet einen Fehler.

   Jetzt ueber `requireFeature('api_access')` — die Middleware gab es
   bereits, und `planLimits.js:14` nennt als BEISPIEL exakt diesen
   Anwendungsfall. Wer kuenftig einen Plan anlegt, setzt ein Flag und
   muss keine Namensliste im Code suchen. */
const { requireFeature } = require('../middleware/planLimits');
const requirePro = requireFeature('api_access');

router.get('/', requireJwt, requirePro, async (req, res, next) => {
  try { res.json({ keys: await apiKeyService.listForUser(req.user.id) }); }
  catch (e) { next(e); }
});

/* Auto-Bereitstellung: legt bei Pro genau dann einen Key an, wenn noch keiner existiert */
router.post('/ensure', requireJwt, requirePro, async (req, res, next) => {
  try {
    const n = await apiKeyService.countActive(req.user.id);
    if (n > 0) return res.json({ created: false, keys: await apiKeyService.listForUser(req.user.id) });
    const created = await apiKeyService.createForUser(req.user.id, { name: 'DealPilot API' });
    res.json({ created: true, key: created, keys: await apiKeyService.listForUser(req.user.id) });
  } catch (e) { next(e); }
});

router.post('/', requireJwt, requirePro, async (req, res, next) => {
  try {
    const n = await apiKeyService.countActive(req.user.id);
    if (n >= 5) return res.status(400).json({ error: 'Maximal 5 aktive Keys' });
    const created = await apiKeyService.createForUser(req.user.id, {
      name: (req.body && req.body.name) || 'DealPilot API',
      expiresInDays: req.body && req.body.expiresInDays
    });
    res.json({ key: created });
  } catch (e) { next(e); }
});

router.delete('/:id', requireJwt, requirePro, async (req, res, next) => {
  try { res.json(await apiKeyService.revoke(req.user.id, req.params.id)); }
  catch (e) { next(e); }
});

module.exports = router;
