'use strict';
/**
 * V169 — Registrierung mit E-Mail-Bestätigung
 *
 * Routes:
 *   POST /auth/register-with-verify  — Public, anonyme Anmeldung
 *   GET  /auth/verify-email?token=X  — Public, Token einlösen → Auto-Login
 *
 * Flow:
 *  1. User schickt {name, email, password} → User wird mit is_active=false angelegt
 *  2. Verify-Token wird generiert, in email_tokens gespeichert
 *  3. Mail an User mit Verify-Link
 *  4. Notification-Mail an Admin (info@dealpilot.immo)
 *  5. User klickt Link → User auf is_active=true → JWT-Cookie/Token, Redirect zur App
 *
 * Schutz:
 *   - Rate-Limit: 5 Registrierungen pro IP/Stunde
 *   - Honeypot-Feld 'hp'
 *   - Bestehende E-Mail-Adressen → still 200 zurück (keine User-Enumeration)
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { query } = require('../db/pool');
const userService = require('../services/userService');
const emailVerifyService = require('../services/emailVerifyService');
const mailerService = require('../services/mailerService');
const verifyMailTemplate = require('../services/verifyMailTemplate'); // v627-verify-backend
const resellerBrandLookup = require('../services/resellerBrandLookup'); // W21-wire
const objectService = require('../services/objectService');
const jwtUtil = require('../utils/jwt');
const password = require('../utils/password');

const router = express.Router();

// Rate-Limit (strenger als /auth/register weil das ja "Coming Soon" public ist)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Registrierungs-Versuche. Bitte versuche es später erneut.' }
});

/* v2136: eigener, strengerer Zaehler fuer das Nachsenden. Fuenf
   Registrierungen pro Stunde sind etwas anderes als fuenf Mails an
   dieselbe Adresse - der zweite Weg ist der billigere Missbrauch. */
const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte versuche es in einer Stunde erneut.' }
});

const RegisterSchema = z.object({
  name: z.string().trim().min(2, 'Name zu kurz').max(100, 'Name zu lang'),
  email: z.string().trim().toLowerCase().email('Ungültige E-Mail-Adresse').max(200),
  password: z.string().min(10, 'Passwort muss mindestens 10 Zeichen haben').max(128),
  hp: z.string().optional()  // Honeypot
});

router.post('/register-with-verify', registerLimiter, async (req, res) => {
  // Honeypot
  if (req.body && req.body.hp && String(req.body.hp).trim().length > 0) {
    return res.json({ success: true, message: 'Registrierung läuft. Bitte E-Mail-Postfach prüfen.' });
  }

  let parsed;
  try {
    parsed = RegisterSchema.parse(req.body || {});
  } catch (err) {
    const msg = err.errors && err.errors[0] ? err.errors[0].message : 'Ungültige Eingabe';
    return res.status(400).json({ error: msg });
  }

  const { name, email, password: plainPassword } = parsed;
  const baseUrl = process.env.FRONTEND_BASE_URL || 'https://dealpilot.junker-immobilien.io';

  try {
    // Existiert User schon?
    const existing = await userService.findByEmail(email);
    if (existing) {
      // Aus Sicherheit immer "ok" — verhindert User-Enumeration
      console.log('[register-verify] Bereits registrierte E-Mail:', email);
      return res.json({
        success: true,
        message: 'Falls die E-Mail noch nicht registriert ist, erhältst du eine Bestätigungs-Mail.'
      });
    }

    // Neuen User anlegen — DIREKT in DB damit wir is_active=false setzen können
    // (userService.createUser setzt is_active=true per Default)
    const hash = await password.hash(plainPassword);
    const countResult = await query('SELECT COUNT(*) AS cnt FROM users');
    const isFirstUser = parseInt(countResult.rows[0].cnt, 10) === 0;
    const role = isFirstUser ? 'admin' : 'user';

    /* ══ v2136 · ZUGANG SOFORT, FRIST STATT RIEGEL (N60.3) ══════════
       Hier stand `FALSE`. Marcel: "Bei der Erstanmeldung besteht die
       Moeglichkeit, dass der Kunde direkt Zugang zur App bekommt und
       spaetestens 6 Stunden nach Erstanmeldung bestaetigen muss, sonst
       wird der Account gesperrt. Der Hinweis muss natuerlich mit der
       Erstanmeldung kommen, aber so kann ein User direkt, ohne dass er
       jetzt in seine Mails gehen muss, schon was sehen."

       Der Riegel war `is_active=false` - und er hat die Mail zur
       Voraussetzung gemacht, nicht zur Bestaetigung. Jetzt traegt die
       FRIST, was vorher der Riegel trug:

         is_active        TRUE ab der Sekunde der Anmeldung
         email_verified_at NULL, bis der Link geklickt wird
         Ablauf           created_at + config.auth.verifyGnadenfristStunden

       Durchgesetzt wird sie nicht hier, sondern an JEDER Anfrage
       (`middleware/auth.js`) und beim Login (`userService`). Eine Frist,
       die nur beim Anmelden geprueft wird, laeuft fuer eine offene
       Sitzung nie ab.

       ⚠ DER PREIS, ausdruecklich benannt: ein unbestaetigter Zugang ist
       ein Zugang. Wer eine fremde Adresse eintraegt, kann sechs Stunden
       arbeiten, und der Inhaber der Adresse erfaehrt es nur aus der
       Mail. Das ist Marcels Entscheidung und steht so in N60.3 als
       Weg (a); der Gegenvorschlag (b) war ein eigenes Lesezugangs-
       Merkmal. Die sechs Stunden sind die Begrenzung dieses Preises. */
    const r = await query(
      `INSERT INTO users (email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, email, name, role, created_at`,
      [email, hash, name, role]
    );
    const user = r.rows[0];

    // Verify-Token generieren
    const token = await emailVerifyService.createVerifyToken(user.id);
    const verifyUrl = `${process.env.APP_URL || baseUrl}/api/v1/auth/verify-email?token=${token}`;

    // Audit
    try {
      await objectService.logAudit({
        userId: user.id,
        action: 'register_with_verify',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (e) { /* nicht kritisch */ }

    // Mail an User
    try {
      const firstName = (user.name || '').trim().split(/\s+/)[0] || user.name || '';
      /* W21-wire: Der Mandant bekam die Einladung im Reseller-Branding, klickte,
         registrierte sich — und danach eine DealPilot-Verify-Mail. Bruch genau da,
         wo Vertrauen entsteht. brandForEmail() sucht eine offene Reseller-Einladung
         fuer diese Adresse; ohne Treffer kommt null -> alles bleibt DealPilot. */
      let _brand = null;
      try { _brand = await resellerBrandLookup.brandForEmail(user.email); }
      catch (e) { /* Branding ist Kuer, nie mail-blockierend */ }
      await mailerService.sendMail({
        to: user.email,
        subject: verifyMailTemplate.subject(),
        text: verifyMailTemplate.renderVerifyText(firstName, verifyUrl, _brand),
        html: verifyMailTemplate.renderVerifyMail(firstName, verifyUrl, _brand)
      });
      console.log('[register-verify] Verify-Mail gesendet an:', email);
    } catch (e) {
      console.error('[register-verify] Verify-Mail fehlgeschlagen:', e.message);
    }

    // Admin-Notification (Marcel bekommt Bescheid bei jeder Anmeldung)
    try {
      const adminMail = process.env.BETA_MAIL_TO || 'info@dealpilot.immo';
      await mailerService.sendMail({
        to: adminMail,
        subject: '[DealPilot] Neuer Check-in: ' + name,
        text:
          `Neuer Check-in über das DealPilot-Anmeldeformular:\n\n` +
          `Name:    ${name}\n` +
          `E-Mail:  ${email}\n` +
          `Zeit:    ${new Date().toISOString()}\n` +
          `IP:      ${req.ip || '–'}\n\n` +
          `User wartet auf E-Mail-Bestätigung (Token gültig 24h).\n` +
          `Wenn der User klickt: Konto wird automatisch aktiviert + Free-Plan zugewiesen.\n\n` +
          `Admin-Aktionen falls nötig:\n` +
          `- Plan ändern: /api/v1/plans/admin/users/${user.id}/plan`,
        html:
          `<div style="font-family:-apple-system,sans-serif">` +
            `<h3 style="color:#C9A84C">Neuer Check-in</h3>` +
            `<table style="border-collapse:collapse">` +
              `<tr><td style="padding:4px 16px 4px 0;color:#888"><strong>Name</strong></td><td>${_esc(name)}</td></tr>` +
              `<tr><td style="padding:4px 16px 4px 0;color:#888"><strong>E-Mail</strong></td><td><a href="mailto:${_esc(email)}">${_esc(email)}</a></td></tr>` +
              `<tr><td style="padding:4px 16px 4px 0;color:#888"><strong>Zeit</strong></td><td>${new Date().toLocaleString('de-DE')}</td></tr>` +
              `<tr><td style="padding:4px 16px 4px 0;color:#888"><strong>IP</strong></td><td>${_esc(req.ip || '–')}</td></tr>` +
              `<tr><td style="padding:4px 16px 4px 0;color:#888"><strong>User-ID</strong></td><td><code>${user.id}</code></td></tr>` +
            `</table>` +
            `<p style="color:#666;font-size:13px;margin-top:16px">` +
              `User wartet auf E-Mail-Bestätigung. Nach Klick auf Verify-Link wird das Konto automatisch aktiviert + Free-Plan zugewiesen.` +
            `</p>` +
          `</div>`
      });
    } catch (e) {
      console.error('[register-verify] Admin-Notification fehlgeschlagen:', e.message);
    }

    /* v2136: Token und Ablauf mit der Antwort. Ohne Token muesste der
       Nutzer sich nach der Anmeldung noch einmal anmelden - und genau
       diesen Umweg soll die Gnadenfrist ersparen. `verifyDeadline` ist
       die EINE Zahl, aus der die App ihren Countdown rechnet; sie wird
       nicht im Frontend abgeleitet, sonst haette die Frist zwei
       Wahrheiten. */
    const _frist = require('../config').auth.verifyGnadenfristStunden;
    const _ablauf = new Date(new Date(user.created_at).getTime() + _frist * 3600 * 1000);
    res.status(201).json({
      success: true,
      message: 'Anmeldung erfolgreich. Du kannst sofort loslegen – bitte bestätige deine E-Mail-Adresse innerhalb von '
        + _frist + ' Stunden, sonst wird der Zugang gesperrt.',
      token: jwtUtil.sign({ userId: user.id, email: user.email, name: user.name, role: user.role }),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      emailVerified: false,
      verifyDeadline: _ablauf.toISOString(),
      verifyGraceHours: _frist
    });
  } catch (err) {
    console.error('[register-verify] Fehler:', err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen. Bitte später erneut versuchen.' });
  }
});

/**
 * ══ v2136 · POST /auth/resend-verify (N60.3) ═════════════════════════
 *
 * `v2094` hat den Fehlercode `EMAIL_NOT_VERIFIED` eingefuehrt, damit das
 * Frontend einen Knopf "Mail erneut senden" zeigen kann statt den Text
 * zu zerlegen. **Den Endpunkt dazu gab es nicht.** Gemessen: in
 * `registerWithVerify.js` standen genau zwei Routen, und keine davon
 * verschickt die Mail noch einmal.
 *
 * > Ein Kennwort an einem Fehler ist ein Versprechen. Ohne den Weg
 * > dahinter ist es eine Beschriftung ohne Tuer.
 *
 * Antwortet IMMER neutral (200), auch fuer unbekannte Adressen - sonst
 * waere der Endpunkt eine Auskunft darueber, wer Kunde ist. Dieselbe
 * Haltung wie die Anmeldung selbst, die bei bekannter Adresse ebenfalls
 * 200 gibt.
 */
router.post('/resend-verify', resendLimiter, async (req, res) => {
  const neutral = {
    success: true,
    message: 'Falls für diese Adresse eine Bestätigung offen ist, haben wir sie erneut verschickt.'
  };
  try {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    if (!email || email.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.json(neutral);
    }
    const r = await query(
      'SELECT id, email, name, email_verified_at FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );
    /* Unbekannt, oder schon bestaetigt: beides beantwortet derselbe Satz. */
    if (r.rowCount === 0 || r.rows[0].email_verified_at) return res.json(neutral);

    const user = r.rows[0];
    const token = await emailVerifyService.createVerifyToken(user.id);
    const baseUrl = process.env.APP_URL || process.env.FRONTEND_BASE_URL
      || 'https://app.dealpilot.junker-immobilien.io';
    const verifyUrl = `${baseUrl}/api/v1/auth/verify-email?token=${token}`;
    const firstName = (user.name || '').trim().split(/\s+/)[0] || user.name || '';
    let _brand = null;
    try { _brand = await resellerBrandLookup.brandForEmail(user.email); } catch (e) {}
    await mailerService.sendMail({
      to: user.email,
      subject: verifyMailTemplate.subject(),
      text: verifyMailTemplate.renderVerifyText(firstName, verifyUrl, _brand),
      html: verifyMailTemplate.renderVerifyMail(firstName, verifyUrl, _brand)
    });
    console.log('[resend-verify] Verify-Mail erneut gesendet an:', email);
    return res.json(neutral);
  } catch (err) {
    console.error('[resend-verify] Fehler:', err.message);
    /* Auch im Fehlerfall neutral - der Nutzer soll nicht aus der Antwort
       schliessen koennen, ob seine Adresse bekannt ist. */
    return res.json(neutral);
  }
});

/**
 * GET /auth/verify-email?token=XXX
 *
 * Antwort: Redirect zur App mit ?welcome=1 (User automatisch eingeloggt via Token in URL)
 *          oder ?verify_error=expired bzw. invalid
 */
router.get('/verify-email', async (req, res) => {
  const token = req.query.token || '';
  const baseUrl = process.env.APP_URL || process.env.FRONTEND_BASE_URL || 'https://app.dealpilot.junker-immobilien.io';

  try {
    const userId = await emailVerifyService.consumeVerifyToken(token);
    if (!userId) {
      return res.redirect(`${baseUrl}/?verify_error=invalid`);
    }

    // User aktivieren
    /* ══ v2136 · DER STEMPEL WURDE NIE GESETZT ══════════════════════
       Hier stand nur `is_active = TRUE`. `email_verified_at` blieb
       NULL - auch nach einer erfolgreichen Bestaetigung.

       GEMESSEN am 12.10.2026 auf Staging:
         4 Nutzer, 4 aktiv, 0 mit email_verified_at.

       Das war die Grundlage, auf der v2094 seine zwei Auskuenfte
       unterscheidet ("noch nicht bestaetigt" gegen "deaktiviert") -
       und sie war leer. Wer bestaetigt hatte und spaeter deaktiviert
       wird, haette weiter "sieh in dein Postfach" gelesen und einen
       Knopf "Mail erneut senden" bekommen, der ihm nichts bringt.

       > Eine Spalte, die eine Unterscheidung tragen soll, muss auch
       > GESCHRIEBEN werden. v2094 hat sie gelesen und niemand gefuellt.

       COALESCE, damit ein zweiter Klick auf denselben Link den ersten
       Zeitpunkt nicht ueberschreibt. */
    await query(
      'UPDATE users SET is_active = TRUE, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1',
      [userId]
    );

    // Free-Plan zuweisen falls nicht schon zugewiesen
    // (Subscriptions-Tabelle: insert wenn nicht existiert)
    try {
      const subCheck = await query(
        'SELECT id FROM subscriptions WHERE user_id = $1',
        [userId]
      );
      if (subCheck.rowCount === 0) {
        const freePlan = await query(`SELECT id FROM plans WHERE id = 'free'`);
        if (freePlan.rowCount > 0) {
          await query(
            `INSERT INTO subscriptions (user_id, plan_id, billing_interval, status, current_period_start, current_period_end)
             VALUES ($1, 'free', 'monthly', 'active', NOW(), NOW() + INTERVAL '100 years')`,
            [userId]
          );
        }
      }
    } catch (e) {
      console.warn('[verify-email] Free-Plan-Zuweisung fehlgeschlagen (nicht kritisch):', e.message);
    }

    // V251-04: Demo-Objekt fuer neuen Free-Plan-User anlegen
    // Einmalig beim Verify. Wenn User es loescht, wird es NICHT wieder angelegt.
    try {
      const demoObjectService = require('../services/demoObjectService');
      await demoObjectService.assignDemoObject(userId);
    } catch (e) {
      console.warn('[verify-email] Demo-Objekt-Anlage fehlgeschlagen (nicht kritisch):', e.message);
    }

    // User-Daten holen + JWT erstellen
    const user = await userService.getById(userId);
    if (!user) {
      return res.redirect(`${baseUrl}/?verify_error=user_not_found`);
    }

    const jwtToken = jwtUtil.sign({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });

    // Audit
    try {
      await objectService.logAudit({
        userId: user.id,
        action: 'email_verified',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    } catch (e) {}

    // V204 SECURITY-FIX (C2): JWT via Hash-Fragment statt Query-Param.
    // Hash-Fragments (#...) werden NICHT an den Server gesendet, landen nicht
    // in Access-Logs, Browser-History bleibt, aber Referrer-Header leaken sie nicht.
    // Vorher: ${baseUrl}/?welcome=1&t=JWT → Token in Caddy-Logs + Browser-History sichtbar
    // Frontend muss window.location.hash statt .search lesen (siehe auth.js).
    return res.redirect(`${baseUrl}/#welcome=1&t=${encodeURIComponent(jwtToken)}`);
  } catch (err) {
    console.error('[verify-email] Fehler:', err);
    return res.redirect(`${baseUrl}/?verify_error=server`);
  }
});

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = router;
