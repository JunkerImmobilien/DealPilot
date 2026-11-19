'use strict';
/**
 * tools/miete-testkonto-anlegen.js · v3840 — NUR STAGING, laeuft IM Backend-Container:
 *   docker cp tools/miete-testkonto-anlegen.js dealpilot-backend:/app/miete-testkonto-anlegen.js
 *   docker exec dealpilot-backend node /app/miete-testkonto-anlegen.js
 *
 * Eigenes Testkonto fuer den Reiter Miete (Marcel 19.11.2026): Kopien von drei Demo-Objekten
 * des Landing-Bilder-Kontos (MFH Westerfeldstr., ETW Hoelderlinstr., EFH Habighorst), damit
 * Messungen nie ein Demo- oder Steuer-Testkonto veraendern. Idempotent: die Kopien werden je
 * Lauf aus dem Original neu geschrieben (Wegwerf-Objekte). Kurz-Token nach /tmp/miete-token.txt,
 * kein Passwort.
 */
const fs = require('fs');
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');
const planService = require('./src/services/planService');
const objectService = require('./src/services/objectService');
const jwt = require('./src/utils/jwt');

if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) {
  console.error('ABBRUCH: nur auf Staging.'); process.exit(2);
}
const EMAIL = 'miete-test@miete-pruefung.dealpilot.test';
const QUELLEN = ['a1390d59-7950-4b92-9ebf-c17ac9faad8f', '4f17e1ae-75fb-4e2f-a45a-188c81e39986', 'a2afb0d1-dc28-4fbd-9d2b-d697f480da2e'];

(async () => {
  let u = (await query('SELECT id, email FROM users WHERE email = $1', [EMAIL])).rows[0];
  if (!u) u = await userService.createUser({ email: EMAIL, plainPassword: crypto.randomBytes(12).toString('base64url'), name: 'Miete Test', newsletter: false });
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [u.id]);
  await planService.setUserPlanManual(u.id, 'pro', 'yearly', 365);
  for (const qid of QUELLEN) {
    const q = (await query('SELECT data FROM objects WHERE id = $1', [qid])).rows[0];
    if (!q) { console.log('fehlt', qid); continue; }
    const d = typeof q.data === 'string' ? JSON.parse(q.data) : q.data;
    const da = (await query(`SELECT id FROM objects WHERE user_id = $1 AND data::jsonb->>'str' = $2 AND data::jsonb->>'objart' = $3`, [u.id, d.str, d.objart])).rows[0];
    if (da) { await query('UPDATE objects SET data = $2, updated_at = now() WHERE id = $1', [da.id, JSON.stringify(d)]); console.log('neu geschrieben', da.id, d.str, d.objart); }
    else { const o = await objectService.create(u.id, { data: d, aiAnalysis: null, photos: [] }); console.log('angelegt', o.id, d.str, d.objart); }
  }
  fs.writeFileSync('/tmp/miete-token.txt', jwt.signKurz({ userId: u.id, email: EMAIL }, '4h'));
  console.log('Token in /tmp/miete-token.txt');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
