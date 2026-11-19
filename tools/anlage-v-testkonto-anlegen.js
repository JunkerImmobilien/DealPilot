'use strict';
/**
 * tools/anlage-v-testkonto-anlegen.js · v3800 — NUR STAGING, laeuft IM Backend-Container:
 *   docker cp tools/anlage-v-testkonto-anlegen.js dealpilot-backend:/app/anlage-v-testkonto-anlegen.js
 *   docker exec dealpilot-backend node /app/anlage-v-testkonto-anlegen.js
 *
 * Eigenes Testkonto fuer die Anlage-V-Pruefung (v3800), damit weder Marcels Konto noch das
 * Steuer-Testkonto der Kanzlei geoeffnet wird (ein geoeffnetes Objekt speichert sich):
 *   anlage-v@anlage-v-pruefung.dealpilot.test   Plan pro (manuell, 30 Tage, keine Stripe-Zahlung)
 *   ein erfundenes Testobjekt (Musterstrasse 1, 12345 Musterstadt, ETW, Kauf 2025)
 * Kein Passwort: Ausgabe ist ein Kurz-Token (2 h) in /tmp/anlage-v-token.txt, nie auf der Konsole.
 * Idempotent. Abraeumen: --abraeumen (Konto, Objekte und Steuersaetze).
 */
const fs = require('fs');
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');
const planService = require('./src/services/planService');
const objectService = require('./src/services/objectService');
const jwt = require('./src/utils/jwt');

if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) {
  console.error('ABBRUCH: nur auf Staging (APP_URL enthaelt kein „staging“).'); process.exit(2);
}
const EMAIL = 'anlage-v@anlage-v-pruefung.dealpilot.test';
(async () => {
  let u = (await query('SELECT id, email FROM users WHERE email = $1', [EMAIL])).rows[0];
  if (process.argv.includes('--abraeumen')) {
    if (!u) { console.log('kein Konto'); process.exit(0); }
    await query('DELETE FROM tax_records WHERE user_id = $1', [u.id]);
    await query('DELETE FROM objects WHERE user_id = $1', [u.id]);
    await query('DELETE FROM users WHERE id = $1', [u.id]);
    console.log('abgeraeumt'); process.exit(0);
  }
  if (!u) u = await userService.createUser({ email: EMAIL, plainPassword: crypto.randomBytes(12).toString('base64url'), name: 'Anlage-V-Pruefung (Test)', newsletter: false });
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [u.id]);
  await planService.setUserPlanManual(u.id, 'pro', 'monthly', 30);
  const da = (await query("SELECT id FROM objects WHERE user_id = $1 AND data->>'str' = 'Musterstrasse'", [u.id])).rows[0];
  const obj = da || await objectService.create(u.id, { data: {
    str: 'Musterstrasse', hnr: '1', plz: '12345', ort: 'Musterstadt', objart: 'ETW', wfl: '80', baujahr: '1995',
    kp: '250000', kaufdat: '2025-03-01', nkm: '900', ze: '120', umlagef: '180', zve: '60000', halter: 'privat'
  }, aiAnalysis: null, photos: [] });
  fs.writeFileSync('/tmp/anlage-v-token.txt', jwt.signKurz({ userId: u.id, email: EMAIL }, '2h'));
  console.log('Konto ' + u.id + ' · Objekt ' + (obj.id || obj));
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
