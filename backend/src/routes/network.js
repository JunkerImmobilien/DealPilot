'use strict';
/**
 * v852 – routes/network.js  (App-API, authentifiziert)
 *   GET  /api/v1/network-cards           -> aktive Partnerkarten (Designer-Felder)
 *   POST /api/v1/network-cards/:id/lead  -> Anforderungs-Gate + Lead + Mail an Partner
 *
 * Lead-Body (vom Frontend):
 *   { object_ref, adresse, eckdaten:{kaufpreis,wohnflaeche,baujahr,dscr,ltv},
 *     dr:{pers_url,obj_url,snippet}, checks:{readycheck100,dr_objekt,dr_persoenlich} }
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const svc = require('../services/networkCardsService');

let mailerService = null;
try { mailerService = require('../services/mailerService'); } catch (e) { /* optional */ }
let mailLayout = null;
try { mailLayout = require('../services/mailLayout'); } catch (e) { /* optional */ }

router.use(authenticate);

const REQ_LABELS = {
  readycheck100: 'Grundfelder-Check 100 %',
  dr_objekt: 'Datenraum Objekt verkn\u00fcpft',
  dr_persoenlich: 'Datenraum pers\u00f6nlich verkn\u00fcpft'
};

router.get('/', async (req, res) => {
  try {
    const cards = await svc.listActive();
    let categories = [];
    try { categories = await svc.listCategories(); } catch (e2) { /* Mig 051 evtl. noch nicht da */ }
    res.json({ cards: cards, categories: categories });
  } catch (e) {
    console.error('[network] list', e.message);
    res.status(500).json({ error: 'list_failed' });
  }
});

router.post('/:id/lead', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'bad_id' });
  try {
    const card = await svc.getById(id);
    if (!card || !card.aktiv) return res.status(404).json({ error: 'not_found' });

    const body = req.body || {};
    const checks = body.checks || {};

    // ── Anforderungs-Gate (serverseitig): alle Pflicht-Punkte muessen bestaetigt sein ──
    let anf = card.anforderungen || {};
    if (typeof anf === 'string') { try { anf = JSON.parse(anf); } catch (e) { anf = {}; } }
    const missing = Object.keys(anf).filter(function (k) { return anf[k] === true && checks[k] !== true; });
    if (missing.length) {
      return res.status(409).json({
        error: 'requirements_not_met',
        missing: missing.map(function (k) { return REQ_LABELS[k] || k; })
      });
    }

    const userId = req.user ? (req.user.id || req.user.userId || null) : null;
    const userEmail = req.user ? (req.user.email || '') : '';
    const objectRef = body.object_ref || null;

    await svc.recordLead(id, userId, objectRef);

    // ── Mail an Partner: Inhalt nach Mitgabe-Konfiguration der Karte ──
    if (card.ziel_email && mailerService && typeof mailerService.sendMail === 'function') {
      try {
        let mit = card.mitgabe || {};
        if (typeof mit === 'string') { try { mit = JSON.parse(mit); } catch (e) { mit = {}; } }
        const eck = body.eckdaten || {};
        const dr = body.dr || {};

        const tl = [];
        const hl = [];
        tl.push('Ein DealPilot-Nutzer hat eine Anfrage an Sie gesendet.');
        hl.push('<p>Ein DealPilot-Nutzer hat eine Anfrage an Sie gesendet.</p>');
        tl.push('Partnerkarte: ' + card.name);
        if (mit.kontakt && userEmail) { tl.push('Anfragender Nutzer: ' + userEmail); hl.push('<p><strong>Anfragender Nutzer:</strong> ' + userEmail + '</p>'); }
        if (mit.objekt && body.adresse) { tl.push('Objekt: ' + body.adresse); hl.push('<p><strong>Objekt:</strong> ' + body.adresse + '</p>'); }
        if (mit.objekt && objectRef) { tl.push('Objekt-Referenz: ' + objectRef); }
        if (mit.eckdaten) {
          const eckLines = [];
          if (eck.kaufpreis) eckLines.push('Kaufpreis: ' + eck.kaufpreis);
          if (eck.wohnflaeche) eckLines.push('Wohnfl\u00e4che: ' + eck.wohnflaeche);
          if (eck.baujahr) eckLines.push('Baujahr: ' + eck.baujahr);
          if (eck.dscr) eckLines.push('DSCR: ' + eck.dscr);
          if (eck.ltv) eckLines.push('LTV: ' + eck.ltv);
          if (eckLines.length) {
            tl.push('', 'Eckdaten:'); eckLines.forEach(function (l) { tl.push('  ' + l); });
            hl.push('<p><strong>Eckdaten:</strong><br>' + eckLines.join('<br>') + '</p>');
          }
        }
        if (mit.dr_persoenlich && dr.pers_url) { tl.push('', 'Datenraum pers\u00f6nlich: ' + dr.pers_url); hl.push('<p><strong>Datenraum pers\u00f6nlich:</strong> <a href="' + dr.pers_url + '">' + dr.pers_url + '</a></p>'); }
        if (mit.dr_objekt && dr.obj_url) { tl.push('Datenraum Objekt: ' + dr.obj_url); hl.push('<p><strong>Datenraum Objekt:</strong> <a href="' + dr.obj_url + '">' + dr.obj_url + '</a></p>'); }
        if ((mit.dr_persoenlich || mit.dr_objekt) && dr.snippet) { tl.push('', dr.snippet); }
        tl.push('', 'Bitte nehmen Sie zeitnah Kontakt auf.');
        hl.push('<p>Bitte nehmen Sie zeitnah Kontakt auf.</p>');

        let html = null;
        if (mailLayout && typeof mailLayout.wrap === 'function') {
          html = mailLayout.wrap({
            preheader: 'Neue Anfrage \u00fcber DealPilot',
            heroKicker: 'DEALPILOT \u00b7 NETZWERK',
            heroTitle: 'Neue Anfrage',
            heroSubtitle: card.name,
            bodyHtml: hl.join('\n'),
            footerNote: 'Diese Nachricht wurde \u00fcber DealPilot ausgel\u00f6st.'
          });
        }
        await mailerService.sendMail({
          to: card.ziel_email,
          subject: 'Neue Anfrage \u00fcber DealPilot',
          text: tl.join('\n'),
          html: html || undefined,
          replyTo: userEmail || undefined
        });
      } catch (mailErr) {
        console.warn('[network] lead mail failed:', mailErr.message);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[network] lead', e.message);
    res.status(500).json({ error: 'lead_failed' });
  }
});

module.exports = router;
