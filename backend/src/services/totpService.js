/**
 * TOTP Service — Time-based One-Time Passwords für Admin-Auth
 *
 * Nutzt 'speakeasy' für RFC 6238-konforme TOTP-Codes.
 * Secret wird mit AES-256-GCM verschlüsselt in der DB gespeichert.
 *
 * ENV-VARS:
 *   ADMIN_TOTP_KEY = 32-byte hex-Key zur Verschlüsselung der TOTP-Secrets
 *                    (generiere mit: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
 */
'use strict';

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function _getKey() {
    const k = process.env.ADMIN_TOTP_KEY;
    if (!k) {
        throw new Error('ADMIN_TOTP_KEY env var ist nicht gesetzt — siehe README');
    }
    const buf = Buffer.from(k, 'hex');
    if (buf.length !== 32) {
        throw new Error('ADMIN_TOTP_KEY muss 32 bytes (64 hex chars) sein, gefunden: ' + buf.length);
    }
    return buf;
}

/** Verschlüsselt einen Klartext-Secret zur DB-Speicherung. */
function encryptSecret(plaintext) {
    const key = _getKey();
    const iv = crypto.randomBytes(IV_LEN);
    const cipher = crypto.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: iv:tag:ciphertext (alles base64)
    return iv.toString('base64') + ':' + tag.toString('base64') + ':' + enc.toString('base64');
}

/** Entschlüsselt einen gespeicherten TOTP-Secret. */
function decryptSecret(encrypted) {
    const key = _getKey();
    const parts = encrypted.split(':');
    if (parts.length !== 3) throw new Error('Invalides TOTP-Secret-Format');
    const iv = Buffer.from(parts[0], 'base64');
    const tag = Buffer.from(parts[1], 'base64');
    const enc = Buffer.from(parts[2], 'base64');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(enc, undefined, 'utf8') + decipher.final('utf8');
}

/** Generiert ein neues TOTP-Secret für einen Admin. Gibt base32-Secret + otpauth-URL zurück. */
function generateSecret(adminEmail, issuer) {
    issuer = issuer || 'DealPilot Admin';
    const secret = speakeasy.generateSecret({
        name: `${issuer}:${adminEmail}`,
        issuer: issuer,
        length: 20
    });
    return {
        base32: secret.base32,
        otpauth_url: secret.otpauth_url
    };
}

/** Generiert einen QR-Code als Data-URL (zum Anzeigen im Browser oder Terminal). */
async function generateQrDataUrl(otpauthUrl) {
    return QRCode.toDataURL(otpauthUrl);
}

/** Generiert QR-Code als ASCII-Art für Terminal-Ausgabe. */
async function generateQrTerminal(otpauthUrl) {
    return new Promise((resolve, reject) => {
        QRCode.toString(otpauthUrl, { type: 'terminal', small: true }, (err, str) => {
            if (err) reject(err); else resolve(str);
        });
    });
}

/** Verifiziert einen 6-stelligen TOTP-Code gegen den gespeicherten (verschlüsselten) Secret. */
function verifyCode(encryptedSecret, code) {
    if (!encryptedSecret || !code) return false;
    let secret;
    try {
        secret = decryptSecret(encryptedSecret);
    } catch (e) {
        console.error('[totp] decrypt failed:', e.message);
        return false;
    }
    return speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: String(code).replace(/\s/g, ''),
        window: 1   // erlaubt ±30s Drift
    });
}

module.exports = {
    encryptSecret,
    decryptSecret,
    generateSecret,
    generateQrDataUrl,
    generateQrTerminal,
    verifyCode
};
