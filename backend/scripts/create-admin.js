#!/usr/bin/env node
/**
 * Initial Admin anlegen
 *
 * Aufruf:
 *   docker compose -f docker-compose.prod.yml exec backend node scripts/create-admin.js info@junker-immobilien.io owner
 *
 * Generiert ein Passwort und einen TOTP-QR-Code im Terminal.
 */
'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');
const totp = require('../src/services/totpService');

async function main() {
    const email = process.argv[2];
    const role = process.argv[3] || 'owner';

    if (!email) {
        console.error('Usage: node scripts/create-admin.js <email> [owner|support|readonly]');
        process.exit(1);
    }
    if (!['owner', 'support', 'readonly'].includes(role)) {
        console.error('Invalid role. Use: owner, support, readonly');
        process.exit(1);
    }
    if (!process.env.ADMIN_TOTP_KEY) {
        console.error('FEHLER: ADMIN_TOTP_KEY env var ist nicht gesetzt.');
        console.error('Generiere einen mit:');
        console.error('  node -e "console.log(require(\\"crypto\\").randomBytes(32).toString(\\"hex\\"))"');
        console.error('Und füge zur .env hinzu: ADMIN_TOTP_KEY=<hex>');
        process.exit(1);
    }

    // DB connection
    const { Pool } = require('pg');
    const db = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        // Existiert dieser Admin schon?
        const existing = await db.query('SELECT id, totp_enabled FROM admin_users WHERE LOWER(email) = LOWER($1)', [email]);
        if (existing.rows.length > 0) {
            console.error(`\nFEHLER: Admin '${email}' existiert bereits.`);
            console.error(`  ID: ${existing.rows[0].id}`);
            console.error(`  TOTP enabled: ${existing.rows[0].totp_enabled}`);
            console.error(`\nUm das Passwort zurückzusetzen, nutze: node scripts/reset-admin-password.js ${email}`);
            process.exit(1);
        }

        // Sicheres Passwort generieren (16 Zeichen, gut zu tippen)
        const password = generatePassword(16);
        const passwordHash = await bcrypt.hash(password, 12);

        // TOTP-Secret generieren
        const secret = totp.generateSecret(email, 'DealPilot Admin');
        const encryptedSecret = totp.encryptSecret(secret.base32);

        // Insert
        await db.query(
            `INSERT INTO admin_users (email, password_hash, totp_secret, totp_enabled, role, is_active)
             VALUES ($1, $2, $3, TRUE, $4, TRUE)`,
            [email.toLowerCase(), passwordHash, encryptedSecret, role]
        );

        // QR-Code im Terminal
        const qrAscii = await totp.generateQrTerminal(secret.otpauth_url);

        console.log('\n═══════════════════════════════════════════════');
        console.log('  Admin-Account erstellt!');
        console.log('═══════════════════════════════════════════════');
        console.log('');
        console.log('  E-Mail:    ' + email);
        console.log('  Rolle:     ' + role);
        console.log('  Passwort:  ' + password);
        console.log('');
        console.log('  TOTP-Secret (für manuelle Eingabe):');
        console.log('    ' + secret.base32);
        console.log('');
        console.log('  TOTP-QR-Code (scan mit Google Authenticator):');
        console.log('');
        console.log(qrAscii);
        console.log('');
        console.log('═══════════════════════════════════════════════');
        console.log('  WICHTIG:');
        console.log('  1. Passwort sicher speichern (Password-Manager)');
        console.log('  2. QR-Code SOFORT scannen — wird nicht wieder angezeigt');
        console.log('  3. Login: https://dealpilot.junker-immobilien.io/admin');
        console.log('═══════════════════════════════════════════════');
        console.log('');

        await db.end();
        process.exit(0);
    } catch (e) {
        console.error('FEHLER:', e.message);
        await db.end();
        process.exit(1);
    }
}

function generatePassword(length) {
    // Alphabet ohne Verwechslungsgefahr (kein 0/O, l/I, etc.)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(length);
    let pw = '';
    for (let i = 0; i < length; i++) {
        pw += chars[bytes[i] % chars.length];
    }
    return pw;
}

main();
