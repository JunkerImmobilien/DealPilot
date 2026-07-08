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
const { query } = require('../db/pool'); /* v891-dpk */

let mailerService = null;
try { mailerService = require('../services/mailerService'); } catch (e) { /* optional */ }
let mailLayout = null;
try { mailLayout = require('../services/mailLayout'); } catch (e) { /* optional */ }

/* v891-dpk: object_ref -> volles Objekt des Users (UUID | kuerzel | seq_no | data.kuerzel) */
async function resolveObject(userId, ref) {
  if (!userId || !ref) return null;
  try {
    const r = await query(
      `SELECT id, name, kuerzel, data, ai_analysis, photos /* v893r-dpkphotos */
         FROM objects
        WHERE user_id = $1 AND (id::text = $2 OR kuerzel = $2 OR seq_no = $2 OR data->>'kuerzel' = $2)
        LIMIT 1`,
      [userId, String(ref)]
    );
    return r.rows[0] || null;
  } catch (e) { console.warn('[network] resolveObject:', e.message); return null; }
}

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
        // v891-dpk: ganzes Objekt als .dpk anhaengen (alle eingegebenen Werte inkl. Finanzierung)
        let attachments;
        if (mit.objekt_voll && objectRef) {
          try {
            const obj = await resolveObject(userId, objectRef);
            if (obj && obj.data) {
              const dpk = JSON.stringify({
                exported_at: new Date().toISOString(),
                source: 'DealPilot',
                name: obj.name || null,
                kuerzel: obj.kuerzel || null,
                data: obj.data,
                aiAnalysis: obj.ai_analysis || null,
                photos: (body.mit_bilder === true && Array.isArray(obj.photos)) ? obj.photos : undefined /* v893r-dpkphotos */
              }, null, 2);
              const safe = String(obj.kuerzel || obj.name || 'objekt').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'objekt';
              attachments = [{ filename: safe + '.dpk', content: dpk, contentType: 'application/json' }];
              tl.push('', 'Ganzes Objekt als .dpk-Datei im Anhang (alle eingegebenen Werte inkl. Finanzierung' + (body.mit_bilder === true ? ' und Fotos' : '') + ').');
              hl.push('<p><strong>Anhang:</strong> Ganzes Objekt als <code>.dpk</code>-Datei (alle eingegebenen Werte inkl. Finanzierung).</p>');
            }
          } catch (e) { console.warn('[network] dpk attach failed:', e.message); }
        }
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
          replyTo: userEmail || undefined,
          attachments: attachments
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

/* v856: Pro-Einreichung — Karte landet als 'eingereicht' (aktiv=false) zur Freigabe im Admin */
router.post('/einreichen', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'name_missing' });
    if (!b.ziel_email || !String(b.ziel_email).trim()) return res.status(400).json({ error: 'email_missing' });
    const userId = req.user ? (req.user.id || req.user.userId || null) : null;
    const userEmail = req.user ? (req.user.email || '') : '';
    const card = await svc.createSubmission(userId, userEmail, b);
    // Marcel informieren
    if (mailerService && typeof mailerService.sendMail === 'function') {
      try {
        await mailerService.sendMail({
          to: 'dealpilot@junker-immobilien.io',
          subject: 'Neue Netzwerk-Karten-Einreichung: ' + card.name,
          text: 'Neue Einreichung ueber die App.\n\nName: ' + card.name +
            '\nVon: ' + (userEmail || 'unbekannt') +
            (b.wunsch_kategorie ? '\nWunsch-Kategorie: ' + b.wunsch_kategorie : '') +
            '\n\nFreigabe im Admin unter Netzwerk.',
          replyTo: userEmail || undefined
        });
      } catch (mailErr) { console.warn('[network] submission mail failed:', mailErr.message); }
    }
    res.json({ ok: true, status: 'eingereicht' });
  } catch (e) {
    console.error('[network] einreichen', e.message);
    res.status(500).json({ error: 'submit_failed' });
  }
});

/* v893n-partner: "Partner werden" (Freier-Sitzplatz-CTA) -> Marcel informieren */
router.post('/partner-interest', async (req, res) => {
  try {
    const userEmail = req.user ? (req.user.email || '') : '';
    if (mailerService && typeof mailerService.sendMail === 'function') {
      try {
        await mailerService.sendMail({
          to: 'dealpilot@junker-immobilien.io',
          subject: 'Partner-werden-Anfrage' + (userEmail ? (' von ' + userEmail) : ''),
          text: 'Anfrage verschickt',
          replyTo: userEmail || undefined
        });
      } catch (mailErr) { console.warn('[network] partner-interest mail failed:', mailErr.message); }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[network] partner-interest', e.message);
    res.status(500).json({ error: 'interest_failed' });
  }
});

/* v871: Link-Klick zaehlt als Lead (cta_aktion 'link' — Partner-Seite/eigene Anfrageseite) */
router.post('/:id/click', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id, 10);
    if (!cardId) return res.status(400).json({ error: 'bad_id' });
    await svc.recordLead(cardId, req.user ? req.user.id : null,
      'link-click:' + ((req.body && req.body.object_ref) || ''));
    res.json({ ok: true });
  } catch (e) {
    console.error('[network] click:', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
