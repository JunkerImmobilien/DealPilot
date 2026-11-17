'use strict';
/**
 * tools/gutachterpartner-testkonto.js · v3540 — NUR STAGING, laeuft IM Backend-Container:
 *   docker cp tools/gutachterpartner-testkonto.js dealpilot-backend:/app/gutachterpartner-testkonto.js
 *   docker exec dealpilot-backend node /app/gutachterpartner-testkonto.js [--ohne-zusatz]
 *
 * Legt (idempotent) ein Testkonto fuer die Anbindung des Gutachterpartners an, damit info@
 * (Demo-Konto der Messe) unberuehrt bleibt:
 *   gutachter@gutachter-pruefer.dealpilot.test  „DealPilot Test“, Plan pro (manuell, 30 Tage),
 *   Zusatz 'gutachterpartner' aktiv (mit --ohne-zusatz: abgeschaltet, fuer die Gegenprobe),
 *   v3600: Zusatz 'vorschau' aktiv (Freigabeliste der Vorschau-Funktionen, sonst 403 auf /gutachterpartner;
 *   mit --ohne-vorschau: abgeschaltet - das Konto sieht dann, was ein Kunde sieht),
 * und kopiert EIN Demo-Objekt (Ravensberger Weg 38, Bielefeld) ohne Fotos und Verknuepfungen.
 * Gibt nie ein Passwort aus. Kurz-Token (2 h) nach /tmp/gutachter-token.txt im Container.
 */
const fs = require('fs');
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');
const planService = require('./src/services/planService');
const objectService = require('./src/services/objectService');
const zusatzService = require('./src/services/zusatzService');
const jwt = require('./src/utils/jwt');

if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) {
  console.error('ABBRUCH: nur auf Staging (APP_URL enthaelt kein „staging“).'); process.exit(2);
}
const EMAIL = 'gutachter@gutachter-pruefer.dealpilot.test';
const QUELLE = 'info@junker-immobilien.io';
const WEG = /^(_ueberf_link|ueberf_.*|verkehrswert_ueberf|_obj_seq|seq_no|_thumb|_deal_lost.*|paket_.*|kunden_.*|_freigabe.*|partner_.*)$/;

(async () => {
  let u = (await query('SELECT id FROM users WHERE email = $1', [EMAIL])).rows[0];
  if (!u) {
    u = await userService.createUser({ email: EMAIL, plainPassword: crypto.randomBytes(18).toString('base64url'), name: 'DealPilot Test', newsletter: false });
    console.log('Konto angelegt');
  }
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [u.id]);
  await planService.setUserPlanManual(u.id, 'pro', 'monthly', 30);
  await zusatzService.setzen(u.id, zusatzService.GUTACHTER, { aktiv: !process.argv.includes('--ohne-zusatz') }, 'gutachterpartner-testkonto.js');
  await zusatzService.setzen(u.id, zusatzService.VORSCHAU, { aktiv: !process.argv.includes('--ohne-vorschau') }, 'gutachterpartner-testkonto.js');   /* v3600 */
  let oid = (await query(`SELECT id FROM objects WHERE user_id = $1 AND data->>'str' = 'Ravensberger Weg' AND data->>'hnr' = '38'`, [u.id])).rows[0];
  if (!oid) {
    const q = (await query('SELECT id FROM users WHERE email = $1', [QUELLE])).rows[0];
    const src = q && (await query(`SELECT data FROM objects WHERE user_id = $1 AND data->>'str' = 'Ravensberger Weg' AND data->>'hnr' = '38' ORDER BY updated_at DESC LIMIT 1`, [q.id])).rows[0];
    if (!src) { console.error('Quellobjekt fehlt'); process.exit(1); }
    const d = {}; Object.keys(src.data || {}).forEach((k) => { if (!WEG.test(k)) d[k] = src.data[k]; });
    d.notizen = 'Testobjekt fuer die Anbindung des Gutachterpartners (Kopie aus dem Demo-Konto).';
    oid = await objectService.create(u.id, { data: d, aiAnalysis: null, photos: [] });
  }
  fs.writeFileSync('/tmp/gutachter-token.txt', jwt.signKurz({ userId: u.id, email: EMAIL }, '2h'));
  console.log('Konto ' + u.id + ' · Objekt ' + oid.id + ' · Zusatz ' + (process.argv.includes('--ohne-zusatz') ? 'aus' : 'an') + ' · Token in /tmp/gutachter-token.txt');
  process.exit(0);
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
