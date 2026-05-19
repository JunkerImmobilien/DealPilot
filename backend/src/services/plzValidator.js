'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * DealPilot V229 — PLZ-Validator
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Zentrale Validierung deutscher Postleitzahlen — verhindert dass die KI
 * mit Test-PLZ wie 12345 oder Unsinn-Werten gefüttert wird und dann
 * halluziniert.
 *
 * Verwendung:
 *   const plzValidator = require('./plzValidator');
 *
 *   // Soft-Check (returned Result-Object):
 *   const result = plzValidator.check('12345');
 *   if (!result.valid) console.log(result.reason, result.message);
 *
 *   // Strict-Check (wirft HttpError 422):
 *   plzValidator.validateStrict('12345');  // → throws HttpError
 * ═══════════════════════════════════════════════════════════════════════════ */

const { HttpError } = require('../middleware/errors');

// ───────────────────────────────────────────────────────────────────────────
// Test-PLZ-Blacklist
// Diese Werte sind klassische "fake" / "demo" / "test" PLZ die in Tutorials,
// Mock-Daten und Spam-Formularen auftauchen. Sie sehen aus wie echte PLZ,
// existieren aber nicht oder werden missbräuchlich verwendet.
//
// WICHTIG: 12345 IST eine echte PLZ (Berlin-Adlershof), aber im Audit
// haben wir festgestellt dass User sie überproportional als Test-Wert
// eingeben (Faulheit/Demo). Wir blocken sie defensiv — wer wirklich in
// 12345 wohnt kann den Block per UI override (TODO V229.1).
// ───────────────────────────────────────────────────────────────────────────
const TEST_PLZ_BLACKLIST = new Set([
  '00000', '11111', '22222', '33333', '44444',
  '55555', '66666', '77777', '88888', '99999',
  '12345', '54321', '01234', '98765', '12321',
  '23456', '34567', '45678', '56789', '67890',
  '10101', '20202', '30303', '40404', '50505'
]);

// ───────────────────────────────────────────────────────────────────────────
// Deutsche PLZ-Bereiche
// Quelle: Deutsche Post — gültige PLZ liegen zwischen 01067 und 99998.
// Lücken in den Bereichen sind nicht erfasst (TBD), aber Format-Check fängt
// die offensichtlichsten Fakes.
// ───────────────────────────────────────────────────────────────────────────
const PLZ_MIN = 1067;   // niedrigste echte PLZ (Dresden)
const PLZ_MAX = 99998;  // höchste echte PLZ

/**
 * Normalisiert PLZ-Input.
 * Akzeptiert: "12345", " 12345 ", 12345 (number), "01234"
 * Returned: 5-stelliger String oder null bei ungültig.
 */
function normalize(plz) {
  if (plz == null) return null;
  const s = String(plz).trim();
  if (!s) return null;
  // Nur Ziffern
  if (!/^\d+$/.test(s)) return null;
  // Nur exakt 5 Stellen — KEIN auto-padding mehr, sonst wird "1234" als
  // "01234" interpretiert und landet auf der Test-Blacklist (verwirrt User).
  // User der echt "01067" eingeben will muss das so tippen.
  if (s.length !== 5) return null;
  return s;
}

/**
 * Format-Check: ist es überhaupt eine 5-stellige Ziffernfolge?
 */
function hasValidFormat(plz) {
  return normalize(plz) !== null;
}

/**
 * Range-Check: liegt die PLZ im gültigen deutschen Bereich?
 * Achtung: liefert false für 00000 weil < 01067.
 */
function isInValidRange(plz) {
  const n = normalize(plz);
  if (!n) return false;
  const num = parseInt(n, 10);
  return num >= PLZ_MIN && num <= PLZ_MAX;
}

/**
 * Test-PLZ-Check: Ist diese PLZ auf unserer Blacklist?
 */
function isKnownTestPlz(plz) {
  const n = normalize(plz);
  if (!n) return false;
  return TEST_PLZ_BLACKLIST.has(n);
}

/**
 * Vollständiger Soft-Check.
 * @returns {{valid: boolean, reason: string|null, message: string|null, plz: string|null}}
 */
function check(plz) {
  const normalized = normalize(plz);
  if (normalized === null) {
    return {
      valid: false,
      reason: 'invalid_format',
      message: 'PLZ muss aus 5 Ziffern bestehen (z.B. "32049").',
      plz: null
    };
  }
  if (!isInValidRange(normalized)) {
    return {
      valid: false,
      reason: 'out_of_range',
      message: 'PLZ "' + normalized + '" liegt außerhalb des deutschen PLZ-Bereichs (01067–99998).',
      plz: normalized
    };
  }
  if (isKnownTestPlz(normalized)) {
    return {
      valid: false,
      reason: 'test_plz',
      message: 'PLZ "' + normalized + '" sieht wie eine Test- oder Demo-PLZ aus und wird zum Schutz vor halluzinierten Daten blockiert. Bitte echte PLZ eingeben.',
      plz: normalized
    };
  }
  return {
    valid: true,
    reason: null,
    message: null,
    plz: normalized
  };
}

/**
 * Strict-Validation: wirft HttpError 422 bei ungültig.
 * Wird in Routes vor dem KI-Call benutzt.
 */
function validateStrict(plz) {
  const result = check(plz);
  if (!result.valid) {
    const err = new HttpError(422, result.message);
    err.code = 'INVALID_PLZ';
    err.reason = result.reason;
    err.plz = result.plz;
    throw err;
  }
  return result.plz; // normalisiert zurückgeben
}

/**
 * Express-Middleware: prüft req.body.plz (oder req.body.objekt.plz oder req.body.context.plz)
 * und wirft 422 wenn ungültig.
 *
 * Suchreihenfolge:
 *   1. req.body.plz
 *   2. req.body.objekt?.plz
 *   3. req.body.context?.plz
 *
 * Wenn keine PLZ im Body: PASSIERT NICHTS (Route entscheidet selbst).
 */
function middleware(req, res, next) {
  try {
    const body = req.body || {};
    const plz = body.plz
             || (body.objekt && body.objekt.plz)
             || (body.context && body.context.plz);

    // Keine PLZ im Body → kein Check nötig (Route entscheidet)
    if (plz == null || String(plz).trim() === '') {
      return next();
    }

    const result = check(plz);
    if (!result.valid) {
      return res.status(422).json({
        error: result.message,
        code: 'INVALID_PLZ',
        reason: result.reason,
        plz: result.plz
      });
    }

    // Optional: normalisierte PLZ zurück in Body schreiben
    if (body.plz != null) body.plz = result.plz;
    if (body.objekt && body.objekt.plz != null) body.objekt.plz = result.plz;
    if (body.context && body.context.plz != null) body.context.plz = result.plz;

    next();
  } catch (e) {
    next(e);
  }
}

module.exports = {
  check,
  validateStrict,
  middleware,
  normalize,
  hasValidFormat,
  isInValidRange,
  isKnownTestPlz,
  // Für Tests
  TEST_PLZ_BLACKLIST,
  PLZ_MIN,
  PLZ_MAX
};
