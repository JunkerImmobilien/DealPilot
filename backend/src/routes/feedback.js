'use strict';
/**
 * V63.74: Feedback & Support
 *
 * POST /api/v1/feedback
 *   Body (multipart/form-data oder JSON):
 *     - type:           'feedback' | 'support'
 *     - overall_rating: 0-5 (Feedback)
 *     - criteria:       JSON-String mit { ux:n, performance:n, ... }
 *     - category:       Support-Kategorie ('bug', 'how', 'data', ...)
 *     - message:        Freitext (Pflicht bei Support)
 *     - contact_email:  Antwort-E-Mail (optional)
 *     - diagnostics:    JSON-String mit User/Plan/Browser-Info
 *     - object_json:    JSON-String mit aktuellem Objekt (optional, bei Support)
 *     - screenshots[]:  Bild-Uploads (optional, bei Support)
 *
 * Schutz:
 *   - Auth-Token wird genutzt um User-Daten in Diagnostics aufzunehmen,
 *     ist aber nicht zwingend (Demo-User können auch Feedback geben)
 *   - Rate-Limit: 10 Anfragen pro IP pro Stunde
 *   - Max 5 Bilder à 5 MB
 *
 * Sendet an FEEDBACK_MAIL_TO oder BETA_MAIL_TO.
 * Im DRY-RUN-Modus loggt es nur in die Konsole.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

let multer;
try { multer = require('multer'); } catch (e) { multer = null; }

const mailerService = require('../services/mailerService');

const router = express.Router();

const fbLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Feedback-Anfragen. Bitte später erneut.' }
});

// V204 SECURITY-FIX (H4): Feedback-Screenshots nur Bilder zulassen.
const ALLOWED_FEEDBACK_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const upload = multer
  ? multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 6 }, // 5MB · 5 Bilder + 1 JSON
      fileFilter: function(req, file, cb) {
        // JSON-Anhang als data-Field ist OK (kommt vom Frontend automatisch)
        if (file.fieldname === 'object_json' || file.fieldname === 'diagnostics') {
          return cb(null, true);
        }
        if (!ALLOWED_FEEDBACK_MIME.includes(file.mimetype)) {
          return cb(new Error('Nur Bilder erlaubt (JPEG, PNG, WebP, GIF). Erhalten: ' + file.mimetype));
        }
        cb(null, true);
      }
    })
  : null;

function _stars(n) {
  n = parseInt(n, 10) || 0;
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function _critLabel(key) {
  return ({
    ux:           'Bedienung & UX',
    performance:  'Geschwindigkeit',
    features:     'Funktionsumfang',
    pdf:          'PDF-Qualität',
    ai:           'KI-Analyse',
    support:      'Support & Hilfe',
    workflow:     'Workflow-Verständlichkeit',
    kpis:         'Kennzahlen-Aufbereitung',
    score:        'DealScore-Logik',
    onboarding:   'Onboarding / Einstieg'
  })[key] || key;
}

function _catLabel(c) {
  return ({
    bug: 'Bug / Fehler', how: 'Bedienungsfrage', data: 'Daten / Account',
    billing: 'Plan / Abrechnung', other: 'Sonstiges'
  })[c] || c;
}

function buildEmailBody(p) {
  var lines = [];
  if (p.type === 'support') {
    lines.push('SUPPORT-ANFRAGE');
    lines.push('Kategorie:  ' + _catLabel(p.category));
    lines.push('');
  } else {
    lines.push('FEEDBACK');
    lines.push('Gesamt:     ' + _stars(p.overall_rating) + ' (' + (p.overall_rating || '-') + '/5)');
    lines.push('');
    if (p.criteria && Object.keys(p.criteria).length) {
      lines.push('Im Detail:');
      Object.keys(p.criteria).forEach(function(k) {
        lines.push('  ' + _critLabel(k).padEnd(28, ' ') + _stars(p.criteria[k]) + ' (' + p.criteria[k] + '/5)');
      });
      lines.push('');
    }
  }
  lines.push('── Nachricht ──');
  lines.push(p.message || '(keine)');
  lines.push('');
  if (p.contact_email) {
    lines.push('Antwort an: ' + p.contact_email);
    lines.push('');
  }
  if (p.diagnostics && typeof p.diagnostics === 'object') {
    lines.push('── Diagnose ──');
    Object.keys(p.diagnostics).forEach(function(k) {
      var v = p.diagnostics[k];
      if (v == null || v === '') return;
      lines.push(k.padEnd(16, ' ') + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v));
    });
  }
  return lines.join('\n');
}

function _parseJson(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}

router.post('/', fbLimiter, (req, res) => {
  if (!upload) {
    return res.status(503).json({ error: 'multer nicht installiert' });
  }
  upload.any()(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Upload-Fehler' });

    try {
      var b = req.body || {};
      var payload = {
        type:           (b.type === 'support' ? 'support' : 'feedback'),
        overall_rating: parseInt(b.overall_rating, 10) || 0,
        criteria:       _parseJson(b.criteria) || {},
        category:       b.category || '',
        message:        b.message || '',
        contact_email:  b.contact_email || '',
        diagnostics:    _parseJson(b.diagnostics) || {}
      };

      if (req.user && req.user.email) {
        payload.diagnostics.auth_user_email = req.user.email;
        payload.diagnostics.auth_user_id = req.user.id || req.user.user_id || '-';
      }

      // Validation
      if (payload.type === 'feedback') {
        if (!payload.overall_rating && !(payload.message || '').trim()) {
          return res.status(400).json({ error: 'Mindestens Stern-Bewertung oder Text angeben.' });
        }
      } else {
        if (!payload.category) return res.status(400).json({ error: 'Kategorie fehlt' });
        if (!(payload.message || '').trim() || payload.message.trim().length < 10) {
          return res.status(400).json({ error: 'Nachricht zu kurz (min. 10 Zeichen).' });
        }
      }

      // Attachments aufbauen
      var files = Array.isArray(req.files) ? req.files : [];
      var attachments = files.map(function(f) {
        return {
          filename: f.originalname || ('attachment_' + Date.now()),
          content: f.buffer,
          contentType: f.mimetype || 'application/octet-stream'
        };
      });

      // Objekt-JSON falls mitgeschickt
      var objJson = _parseJson(b.object_json);
      if (objJson) {
        attachments.push({
          filename: 'objekt.json',
          content: Buffer.from(JSON.stringify(objJson, null, 2), 'utf8'),
          contentType: 'application/json'
        });
      }

      var subject;
      if (payload.type === 'support') {
        subject = '[DealPilot Support] ' + _catLabel(payload.category) + ' — ' + payload.message.split('\n')[0].substring(0, 60);
      } else {
        subject = '[DealPilot Feedback] ' + (payload.overall_rating ? payload.overall_rating + '★' : 'Kommentar');
      }

      var to;
      if (payload.type === 'support') {
        to = process.env.SUPPORT_MAIL_TO || 'support@junker-immobilien.io';
      } else {
        to = process.env.FEEDBACK_MAIL_TO || 'dealpilot@junker-immobilien.io';
      }

      await mailerService.sendMail({
        to: to,
        replyTo: payload.contact_email || (req.user && req.user.email) || undefined,
        subject: subject,
        text: buildEmailBody(payload),
        attachments: attachments
      });

      // V63.77: Bestätigungs-E-Mail an Absender (best-effort)
      var confirmTo = payload.contact_email || (req.user && req.user.email) || null;
      if (confirmTo) {
        var userName = (payload.diagnostics && payload.diagnostics.user_name) || (req.user && req.user.name) || '';
        var summary = (payload.message || '').substring(0, 500);
        await mailerService.sendConfirmation(confirmTo, {
          kind: payload.type,        // 'feedback' oder 'support'
          subject: subject,
          userName: userName,
          summary: summary
        });
      }

      res.json({ success: true, type: payload.type, attachmentCount: attachments.length });
    } catch (e) {
      console.error('[feedback] error:', e);
      if (e.code === 'NO_SMTP') {
        return res.status(503).json({ error: 'SMTP nicht konfiguriert' });
      }
      res.status(500).json({ error: 'Versand fehlgeschlagen' });
    }
  });
});

module.exports = router;
