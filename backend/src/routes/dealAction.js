'use strict';
/**
 * V63.73: Deal-Aktion — Anfrage-Versand
 *
 * POST /api/v1/deal-action/submit
 *   Body (multipart/form-data):
 *     - kind:    'bank' | 'fb' | 'expert' | 'consult'
 *     - to:      Empfänger-E-Mail (vom Frontend, validiert gegen Whitelist)
 *     - subject: Mail-Betreff
 *     - body:    Mail-Text (Plaintext)
 *     - data:    JSON-String mit Objektdaten
 *     - docs[<docId>][<idx>]: Datei-Anhänge
 *
 * Schutz:
 *   - Optional Auth (Bearer-Token) — wird genutzt um replyTo zu setzen
 *   - Empfänger-Whitelist aus Env DEAL_ACTION_ALLOWED_RECIPIENTS
 *     (Komma-getrennt) — sonst werden ALLE Anfragen an DEAL_ACTION_FALLBACK
 *     geleitet (default: BETA_MAIL_TO)
 *   - Max 10 MB pro Datei, max 30 Dateien insgesamt
 *   - Rate-Limit 10 Anfragen pro IP pro Stunde
 *
 * Bei DRY-RUN-SMTP loggt die Mail in die Konsole.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

let multer;
try {
  multer = require('multer');
} catch (e) {
  multer = null;
}

const mailerService = require('../services/mailerService');
const nextcloudService = require('../services/nextcloudService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Rate-Limit: 10 Anfragen pro IP pro Stunde
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' }
});

// V204 SECURITY-FIX (H4): MIME-Type-Whitelist gegen Schadcode-Anhänge
// und Mail-Server-Reputation-Risiko. Multer-Filter prüft den Content-Type-Header
// (kann zwar gefaked sein, fängt aber 99% der Casual-Missuse ab).
const ALLOWED_DEAL_ACTION_MIME = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
  'application/zip',
  'application/json'   // Objektdaten-JSON kommt vom Frontend
];

// Multer: Memory-Storage, da wir die Files direkt als Mail-Attachment versenden
// und nicht persistent speichern wollen.
// V190: Limits erhöht — 25 MB pro Datei (war 10 MB) + 50 Dateien total.
// Investment-PDF nach V184-JPEG-Optimierung ist typisch 2-5 MB, Bank-Präsentation
// kann nochmal 5-10 MB werden, plus User-Uploads (Personalausweis, Schufa, etc.)
// → mit 10 MB pro Datei kann ein einzelnes größeres PDF schon den Submit killen.
const upload = multer
  ? multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024,      // 25 MB pro Datei
        files: 50                          // max 50 Dateien
      },
      fileFilter: function(req, file, cb) {
        if (!ALLOWED_DEAL_ACTION_MIME.includes(file.mimetype)) {
          return cb(new Error('Dateityp nicht erlaubt: ' + file.mimetype +
            '. Erlaubt: PDF, JPEG, PNG, WebP, DOC, DOCX, XLS, XLSX, TXT, CSV, ZIP.'));
        }
        cb(null, true);
      }
    })
  : null;

const KIND_LABELS = {
  bank:    'Bankanfrage',
  fb:      'Finanzierungsbestätigung',
  expert:  'Gutachten-/Expertise-Anfrage',
  consult: 'Beratungs-Anfrage'
};

function getAllowedRecipients() {
  const list = (process.env.DEAL_ACTION_ALLOWED_RECIPIENTS || '').trim();
  if (!list) return null;        // null = keine Whitelist → alle erlaubt
  return list.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function resolveRecipient(requested) {
  const allow = getAllowedRecipients();
  const fallback = process.env.DEAL_ACTION_FALLBACK
                || 'dealpilot@junker-immobilien.io';

  if (!requested) return fallback;
  if (!allow)     return requested;        // keine Whitelist → durchreichen
  if (allow.indexOf(requested.toLowerCase()) >= 0) return requested;
  return fallback;                          // nicht erlaubt → Fallback
}

// V204 SECURITY-FIX (C3): authenticate vor submit — vorher konnten anonyme User
// Bankanfragen über Marcels Mail-Server versenden (Spam-/Reputation-Risiko).
// Plus zusätzlich MIME-Type-Filter (H4) für Multer eingebaut weiter unten.
router.post('/submit', authenticate, submitLimiter, (req, res, next) => {
  if (!upload) {
    return res.status(503).json({
      error: 'multer nicht installiert — bitte `npm install` im backend ausführen'
    });
  }
  // Multer aufrufen — alle Files akzeptieren
  upload.any()(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload-Fehler' });
    }

    try {
      const { kind, to, subject, body } = req.body || {};
      let dataJson = null;
      try { dataJson = req.body.data ? JSON.parse(req.body.data) : null; } catch (e) { /* ignore */ }

      if (!kind || !KIND_LABELS[kind]) {
        return res.status(400).json({ error: 'Ungültiger kind-Parameter' });
      }
      if (!subject || !body) {
        return res.status(400).json({ error: 'subject und body sind Pflicht' });
      }

      const recipient = resolveRecipient(to);

      // V63.78: Bei Bankanfrage/FB → Files nach Nextcloud hochladen statt anzuhängen
      const ncStatus = nextcloudService.getStatus();
      const useNextcloud = (kind === 'bank' || kind === 'fb') && ncStatus.enabled;

      // Attachments aus den hochgeladenen Files
      const files = Array.isArray(req.files) ? req.files : [];
      let bodyExtra = '';
      let attachments = [];

      if (useNextcloud && files.length) {
        // Files-Map nach Doc-ID gruppieren (multer-Field-Name = `da-{kind}-file-{docId}`)
        const fileMap = {};
        files.forEach((f) => {
          const m = (f.fieldname || '').match(/^da-[^-]+-file-(.+)$/);
          const docId = m ? m[1] : 'sonstiges';
          if (!fileMap[docId]) fileMap[docId] = [];
          fileMap[docId].push({
            filename: f.originalname,
            content: f.buffer,
            contentType: f.mimetype
          });
        });

        try {
          const addressSlug = (dataJson && dataJson.objekt && dataJson.objekt.adresse) || 'objekt';
          const ncResult = await nextcloudService.uploadBankDocs(fileMap, {
            kind: kind,
            addressSlug: addressSlug,
            userIdentifier: (req.user && req.user.email) || 'anon'
          });
          if (ncResult && ncResult.shareUrl) {
            bodyExtra = '\n\n── Bank-Datenraum (Nextcloud) ──\n'
                      + 'Link:        ' + ncResult.shareUrl + '\n'
                      + 'Dateien:     ' + ncResult.fileCount + '\n'
                      + 'Ablauf:      ' + ncResult.expiresInDays + ' Tage\n'
                      + 'Ordner-Pfad: ' + ncResult.folderPath + '\n';
          } else {
            // Nextcloud meldet null (z.B. keine Files) → Fallback Mail-Attachment
            attachments = files.map((f) => ({
              filename: f.originalname || ('file_' + Date.now()),
              content: f.buffer,
              contentType: f.mimetype || 'application/octet-stream'
            }));
          }
        } catch (ncErr) {
          console.error('[deal-action] Nextcloud-Upload fehlgeschlagen, fallback to attachments:', ncErr.message);
          // Fallback: Files doch als Anhang
          attachments = files.map((f) => ({
            filename: f.originalname || ('file_' + Date.now()),
            content: f.buffer,
            contentType: f.mimetype || 'application/octet-stream'
          }));
          bodyExtra = '\n\n⚠ Nextcloud-Upload fehlgeschlagen — Files sind direkt angehängt.\n';
        }
      } else {
        // Kein Nextcloud oder kein bank/fb: Files als Mail-Anhang wie bisher
        attachments = files.map((f) => ({
          filename: f.originalname || ('file_' + Date.now()),
          content: f.buffer,
          contentType: f.mimetype || 'application/octet-stream'
        }));
      }

      // Objektdaten als JSON anhängen (immer)
      if (dataJson) {
        attachments.push({
          filename: 'objektdaten.json',
          content: Buffer.from(JSON.stringify(dataJson, null, 2), 'utf8'),
          contentType: 'application/json'
        });
      }

      // ReplyTo aus Auth-User (wenn vorhanden) — sonst kein replyTo
      let replyTo;
      if (req.user && req.user.email) replyTo = req.user.email;

      await mailerService.sendMail({
        to: recipient,
        replyTo: replyTo,
        subject: '[' + KIND_LABELS[kind] + '] ' + subject,
        text: body + bodyExtra,
        attachments: attachments
      });

      // V63.77: Bestätigungs-E-Mail an den Absender (best-effort, blockiert nicht)
      if (replyTo) {
        const userName = (req.user && req.user.name) || (dataJson && dataJson.user && dataJson.user.name) || '';
        // Erste 5 Zeilen der Anfrage als Summary
        const summary = (body || '').split('\n').slice(0, 8).join('\n');
        await mailerService.sendConfirmation(replyTo, {
          kind: kind,
          subject: subject,
          userName: userName,
          summary: summary
        });
      }

      res.json({
        success: true,
        kind: kind,
        recipient: recipient,
        attachmentCount: attachments.length
      });
    } catch (e) {
      console.error('[deal-action] submit error:', e);
      if (e.code === 'NO_SMTP') {
        return res.status(503).json({ error: 'SMTP nicht konfiguriert — bitte SMTP-Credentials in .env setzen.' });
      }
      res.status(500).json({ error: 'Versand fehlgeschlagen' });
    }
  });
});

module.exports = router;
