'use strict';
/**
 * V149: RND-Gutachten-Anfrage
 *
 * POST /api/v1/rnd-request
 *   Body: {
 *     typ: 'rnd_gutachten_anfrage',
 *     version: 'V149',
 *     timestamp: ISO,
 *     wizard_state: {...},   // alle Wizard-Eingaben
 *     wizard_result: {...},  // berechnete RND-Werte
 *     wizard_afa: {...},     // AfA-Vergleich
 *     meta: { user_agent, absender }
 *   }
 *
 * Authentifiziert (User muss eingeloggt sein).
 * Speichert die Anfrage als JSON im Verzeichnis /data/rnd-requests/
 * für späteren Import ins RND-Modul.
 * Sendet Mail-Notification an info@junker-immobilien.io.
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');

const { authenticate } = require('../middleware/auth');
const mailerService = require('../services/mailerService');

const router = express.Router();

// Storage-Verzeichnis: Default /data/rnd-requests, überschreibbar per ENV
const STORAGE_DIR = process.env.RND_REQUEST_DIR || '/app/data/rnd-requests';

// Rate-Limit: max 10 Anfragen pro User pro Stunde
const rndLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
  keyGenerator: function (req) {
    return req.user && req.user.id ? 'u:' + req.user.id : req.ip;
  }
});

// V189: Schema relaxed — alle Felder optional (außer typ). Damit greift
// das Backend auch wenn der Frontend-Payload ein leeres oder nicht
// vollständig befülltes wizard_state hat.
const RndRequestSchema = z.object({
  typ: z.string(),
  version: z.string().optional(),
  timestamp: z.string().optional(),
  wizard_state: z.record(z.any()).optional(),
  wizard_result: z.record(z.any()).optional(),
  wizard_afa: z.record(z.any()).optional(),
  meta: z.record(z.any()).optional()
}).passthrough();

router.post('/', authenticate, rndLimiter, async (req, res) => {
  let parsed;
  try {
    parsed = RndRequestSchema.parse(req.body || {});
  } catch (err) {
    const msg = err.errors && err.errors[0] ? err.errors[0].message : 'Ungültige Eingabe';
    return res.status(400).json({ error: msg });
  }

  // Request-ID generieren (kurz + lesbar)
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  const requestId = 'RND-' + dateStr + '-' + rnd;

  // User-Info anhängen
  const enriched = Object.assign({}, parsed, {
    request_id: requestId,
    received_at: new Date().toISOString(),
    user: req.user ? {
      id: req.user.id,
      email: req.user.email
    } : null,
    ip: req.ip || null
  });

  // Auf Disk speichern (für späteren Import ins RND-Modul)
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    const filename = path.join(STORAGE_DIR, requestId + '.json');
    await fs.writeFile(filename, JSON.stringify(enriched, null, 2), 'utf8');
    console.log('[rnd-request] Anfrage gespeichert:', filename);
  } catch (err) {
    console.error('[rnd-request] Speicher-Fehler:', err.message);
    // Trotz Speicher-Fehler weitermachen (Mail ist primärer Kanal)
  }

  // Zusammenfassung für Mail
  const state = enriched.wizard_state || {};
  const result = enriched.wizard_result || {};
  const afa = enriched.wizard_afa || {};

  const objekt = (state.str || '') + ' ' + (state.hnr || '') +
                 (state.plz || state.ort ? ', ' + (state.plz || '') + ' ' + (state.ort || '') : '');
  const baujahr = state.baujahr || '?';
  const wfl = state.wohnflaeche || state.wfl || '?';
  const rnd_jahre = result.final_rnd || result.rnd || '?';
  const gnd = result.gnd || '?';
  const alter = result.alter || '?';

  const subject = '[DealPilot] Neue RND-Gutachten-Anfrage · ' + requestId;
  const text = [
    'Neue RND-Gutachten-Anfrage über den DealPilot-Wizard:',
    '',
    'Referenz-Nr.: ' + requestId,
    'Eingegangen:  ' + new Date(enriched.received_at).toLocaleString('de-DE'),
    'User:         ' + (enriched.user ? enriched.user.email + ' (ID ' + enriched.user.id + ')' : '–'),
    '',
    '── Objekt ──',
    'Adresse:      ' + (objekt.trim() || '–'),
    'Baujahr:      ' + baujahr,
    'Wohnfläche:   ' + wfl + ' m²',
    'Stichtag:     ' + (state.stichtag || '–'),
    '',
    '── Wizard-Ergebnis ──',
    'RND berechnet: ' + rnd_jahre + ' Jahre',
    'GND:           ' + gnd + ' J',
    'Alter:         ' + alter + ' J',
    afa.afa_standard ? 'AfA Standard: ' + afa.afa_standard.satz_pct + ' % (' + Math.round(afa.afa_standard.jahresbetrag || 0) + ' €/J)' : '',
    afa.afa_kurz     ? 'AfA Kurz:     ' + afa.afa_kurz.satz_pct + ' % (' + Math.round(afa.afa_kurz.jahresbetrag || 0) + ' €/J)' : '',
    afa.steuerersparnis_jahr ? 'Mehr Steuer:  ' + Math.round(afa.steuerersparnis_jahr) + ' €/J' : '',
    '',
    '── Vollständiger State (JSON) ──',
    'Die vollständige Datei wurde im RND-Modul gespeichert unter:',
    '  ' + requestId + '.json',
    '',
    'Bitte ins RND-Modul importieren um das Gutachten zu erstellen.',
    '',
    '---',
    'Automatisch generiert von DealPilot · ' + new Date().toISOString()
  ].filter(Boolean).join('\n');

  const html =
    '<div style="font-family:-apple-system,sans-serif;max-width:680px">' +
      '<h2 style="color:#C9A84C">Neue RND-Gutachten-Anfrage</h2>' +
      '<p style="background:#FAF6E8;padding:10px 14px;border-left:3px solid #C9A84C;font-family:monospace">' +
        '<strong>Referenz-Nr.:</strong> ' + _escHtml(requestId) + '<br>' +
        '<strong>User:</strong> ' + _escHtml(enriched.user ? enriched.user.email : '–') +
      '</p>' +
      '<h3 style="color:#2A2727;margin-top:24px">Objekt</h3>' +
      '<table style="border-collapse:collapse">' +
        '<tr><td style="padding:4px 14px 4px 0;color:#888"><strong>Adresse</strong></td><td>' + _escHtml(objekt.trim() || '–') + '</td></tr>' +
        '<tr><td style="padding:4px 14px 4px 0;color:#888"><strong>Baujahr</strong></td><td>' + _escHtml(baujahr) + '</td></tr>' +
        '<tr><td style="padding:4px 14px 4px 0;color:#888"><strong>Wohnfläche</strong></td><td>' + _escHtml(wfl) + ' m²</td></tr>' +
        '<tr><td style="padding:4px 14px 4px 0;color:#888"><strong>Stichtag</strong></td><td>' + _escHtml(state.stichtag || '–') + '</td></tr>' +
      '</table>' +
      '<h3 style="color:#2A2727;margin-top:24px">Wizard-Ergebnis</h3>' +
      '<table style="border-collapse:collapse">' +
        '<tr><td style="padding:4px 14px 4px 0;color:#888"><strong>RND berechnet</strong></td><td><strong style="color:#C9A84C">' + _escHtml(rnd_jahre) + ' Jahre</strong></td></tr>' +
        '<tr><td style="padding:4px 14px 4px 0;color:#888"><strong>GND</strong></td><td>' + _escHtml(gnd) + ' J</td></tr>' +
        '<tr><td style="padding:4px 14px 4px 0;color:#888"><strong>Alter</strong></td><td>' + _escHtml(alter) + ' J</td></tr>' +
      '</table>' +
      '<div style="background:#FAF6E8;border-left:3px solid #C9A84C;padding:14px;margin-top:20px;font-size:13px">' +
        '<strong style="color:#2A2727">Anfrage gespeichert:</strong> ' + _escHtml(requestId) + '.json<br>' +
        '<span style="color:#7A7370">Im RND-Modul importieren um das vollständige Gutachten zu erstellen.</span>' +
      '</div>' +
      '<hr style="border:none;border-top:1px solid #eee;margin:20px 0">' +
      '<p style="color:#aaa;font-size:11px">Automatisch generiert · ' + new Date().toLocaleString('de-DE') + '</p>' +
    '</div>';

  // Mail senden
  try {
    await mailerService.sendMail({
      to: process.env.RND_REQUEST_MAIL_TO || 'info@junker-immobilien.io',  // V189
      subject: subject,
      text: text,
      html: html,
      replyTo: enriched.user && enriched.user.email ? enriched.user.email : undefined
    });
    return res.json({
      success: true,
      request_id: requestId
    });
  } catch (err) {
    console.error('[rnd-request] Mail-Fehler:', err.message);
    // Anfrage ist trotzdem auf Disk — daher success, mit Hinweis
    return res.json({
      success: true,
      request_id: requestId,
      warning: 'Anfrage gespeichert, aber Mail-Versand fehlgeschlagen. Marcel wird die Anfrage manuell beim nächsten Check sehen.'
    });
  }
});

/**
 * GET /api/v1/rnd-request/list — Liste aller Anfragen (Admin-Only).
 * Für späteren Import-UI im RND-Modul.
 */
router.get('/list', authenticate, async (req, res) => {
  // TODO: Admin-Gate hinzufügen
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    const files = await fs.readdir(STORAGE_DIR);
    const items = await Promise.all(
      files
        .filter(function (f) { return f.endsWith('.json'); })
        .sort()
        .reverse()
        .slice(0, 50)
        .map(async function (f) {
          try {
            const raw = await fs.readFile(path.join(STORAGE_DIR, f), 'utf8');
            const data = JSON.parse(raw);
            return {
              request_id: data.request_id,
              received_at: data.received_at,
              user_email: data.user && data.user.email,
              objekt: (data.wizard_state && data.wizard_state.str) +
                      ' ' + (data.wizard_state && data.wizard_state.hnr) +
                      ', ' + (data.wizard_state && data.wizard_state.ort),
              rnd: data.wizard_result && data.wizard_result.final_rnd
            };
          } catch (e) {
            return { filename: f, error: e.message };
          }
        })
    );
    res.json({ items: items });
  } catch (err) {
    console.error('[rnd-request/list] Fehler:', err.message);
    res.status(500).json({ error: 'Liste konnte nicht geladen werden.' });
  }
});

/**
 * GET /api/v1/rnd-request/:id — Einzelne Anfrage abrufen (für Import).
 */
router.get('/:id', authenticate, async (req, res) => {
  const id = String(req.params.id || '').replace(/[^A-Z0-9-]/gi, '');
  if (!id || id.length < 8) {
    return res.status(400).json({ error: 'Ungültige ID' });
  }
  try {
    const filename = path.join(STORAGE_DIR, id + '.json');
    const raw = await fs.readFile(filename, 'utf8');
    res.json(JSON.parse(raw));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    }
    console.error('[rnd-request/:id] Fehler:', err.message);
    res.status(500).json({ error: 'Anfrage konnte nicht geladen werden.' });
  }
});

function _escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = router;
