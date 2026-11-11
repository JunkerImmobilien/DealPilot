'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   middleware/flow.js — v3289 · DealPilot Flow (Makler-Hub), Zugang je Linie

   Auftrag: Dateien/Makler-Hub/Flow-Investor-Schnittstelle.md, Punkt 7 und
   „Für alle Punkte": API-Schlüssel mit Bereich `flow`, jede Investor-Route
   prüft die Linie `investor`.

   Zwei Dinge stehen hier und nur hier:

   1. requireFlowLinie(linie) — wie requireFeature, aber für die Linien
      der Firma (zusatzService.flowLinien: Plan-Merkmal `flow_linien`,
      `makler_hub` = makler, Zusatz 'flow' je Konto). Gilt für JEDEN Zugang,
      auch den Browser mit JWT.

   2. FLOW_ROUTEN — was ein Schlüssel mit Bereich `flow` darf. Er ist der
      Schlüssel, den der Hub für eine Investor-/Privat-Firma bekommt; er
      geht auch in der Testphase und ohne `api_access` (Marcels bewusste
      Freischaltung der Linie, 11.11.2026), darf dafür aber nur das, was der
      Ablauf im Hub braucht: Objekte anlegen, lesen, ändern (nicht löschen),
      rechnen, Felder nachschlagen und Unterlagen hochladen/lesen (nicht
      löschen). Alles andere - KI, Marktbericht, ImmoMetrica, Einstellungen,
      Löschen - kommt erst mit den Punkten, die es brauchen, und wird dann
      HIER ergänzt.

   > Eine Liste, die erlaubt, gehört an EINE Stelle. auth.js liest sie,
   > die Routen müssen nichts davon wissen.
   ═══════════════════════════════════════════════════════════════════════ */
const zusatzService = require('../services/zusatzService');

const UUID = '[0-9a-fA-F-]{36}';
const FLOW_ROUTEN = [
  ['GET',  new RegExp('^/api/v1/objects/?$')],
  ['POST', new RegExp('^/api/v1/objects/?$')],
  ['GET',  new RegExp('^/api/v1/objects/felder/?$')],
  ['GET',  new RegExp('^/api/v1/objects/' + UUID + '/?$')],
  ['PUT',  new RegExp('^/api/v1/objects/' + UUID + '/?$')],
  ['GET',  new RegExp('^/api/v1/objects/' + UUID + '/wissen/?$')],
  ['POST', new RegExp('^/api/v1/objects/' + UUID + '/berechnen/?$')],
  ['GET',  new RegExp('^/api/v1/dateien/?$')],
  ['GET',  new RegExp('^/api/v1/dateien/speicher/?$')],
  ['GET',  new RegExp('^/api/v1/dateien/' + UUID + '/?$')],
  ['POST', new RegExp('^/api/v1/dateien/?$')],
  /* v3290 · Punkt 3: Richtwerte und Ziele */
  ['GET',  new RegExp('^/api/v1/flow/profil/?$')],
  ['PUT',  new RegExp('^/api/v1/flow/profil/?$')]
];

const LINIE_NAME = { makler: 'Makler', privat: 'Privat', investor: 'Investor' };

function istFlowRoute(methode, url) {
  const pfad = String(url || '').split('?')[0];
  const m = String(methode || '').toUpperCase();
  return FLOW_ROUTEN.some(([mm, re]) => (mm === m || (mm === 'GET' && m === 'HEAD')) && re.test(pfad));
}

/** Bereich eines Schlüssels: hat er `flow`, und hat er daneben noch volle Rechte? */
function scopeArt(scopes) {
  const s = String(scopes || '').toLowerCase();
  const flow = /(^|\s|,)flow($|\s|,)/.test(s);
  const sonst = /(^|\s|,)(crud|write|read|delete)($|\s|,)/.test(s);
  return { flow: flow, nurFlow: flow && !sonst };
}

function requireFlowLinie(linie) {
  return async function (req, res, next) {
    try {
      if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
      const linien = Array.isArray(req.flowLinien) ? req.flowLinien : await zusatzService.flowLinien(req.user.id);
      req.flowLinien = linien;
      if (linien.indexOf(linie) >= 0) return next();
      return res.status(403).json({
        error: 'Die Linie „' + (LINIE_NAME[linie] || linie) + '“ von DealPilot Flow ist für dieses Konto nicht '
          + 'freigeschaltet. Bitte an DealPilot wenden.',
        code: 'FLOW_LINIE_FEHLT', linie: linie, linien: linien, upgrade_required: true
      });
    } catch (e) { next(e); }
  };
}

module.exports = { FLOW_ROUTEN, istFlowRoute, scopeArt, requireFlowLinie, LINIE_NAME };
