'use strict';
/**
 * tools/landing-bilder-testkonto.js · landing-bilder-1 — NUR STAGING, laeuft IM Backend-Container:
 *   docker cp tools/landing-bilder-testkonto.js dealpilot-backend:/app/landing-bilder-testkonto.js
 *   docker exec dealpilot-backend node /app/landing-bilder-testkonto.js
 *
 * Marcel 16.11.2026: echte Bilder der normalen App (DealPilot-Marke) auf der Landingpage;
 * Freigabe im Chat: „ja darfst du kopieren“ (Demo-Objekte des Kontos info@ auf Staging).
 *
 * Legt (idempotent) ein eigenes Testkonto an und KOPIERT alle nicht verlorenen Objekte des
 * Demo-Kontos dorthin. Das Quellkonto wird nur GELESEN. Ohne Fotos, ohne Partner-/Kunden-/
 * Ueberfuehrungs-Verknuepfungen. Steuerzeitraeume und Score-/Lage-/BWK-Vorgaben werden kopiert,
 * damit die Bilder dieselben Zahlen zeigen wie das Demo-Konto.
 * Gibt nie ein Passwort aus; Kurz-Token (2 h) nach /tmp/landing-bilder-token.txt im Container.
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
const QUELLE = 'info@junker-immobilien.io';
const EMAIL = 'app-bilder@landing-bilder.dealpilot.test';
const WEG = /^(_ueberf_link|ueberf_ende|ueberf_daten|ueberf_preis|ueberf_restschuld|ueberf_rest_zins|verkehrswert_ueberf|_thumb|_deal_lost.*|paket_.*|kunden_.*|_freigabe.*|partner_.*)$/;

(async () => {
  const q = (await query('SELECT id FROM users WHERE email = $1', [QUELLE])).rows[0];
  if (!q) { console.error('Quellkonto fehlt'); process.exit(1); }
  let u = (await query('SELECT id FROM users WHERE email = $1', [EMAIL])).rows[0];
  if (!u) {
    u = await userService.createUser({ email: EMAIL, plainPassword: crypto.randomBytes(18).toString('base64url'), name: 'Demo Investor (Test)', newsletter: false });
    console.log('Konto angelegt');
  }
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [u.id]);
  await planService.setUserPlanManual(u.id, 'pro', 'yearly', 365);

  const quellen = (await query(`SELECT data, ai_analysis FROM objects WHERE user_id = $1
     AND COALESCE((data->>'_deal_lost')::boolean, false) = false ORDER BY created_at`, [q.id])).rows;
  let neu = 0, da = 0;
  for (const src of quellen) {
    const s = src.data || {};
    const vorhanden = (await query(`SELECT id FROM objects WHERE user_id = $1 AND COALESCE(data->>'str','') = $2 AND COALESCE(data->>'hnr','') = $3 AND COALESCE(data->>'ort','') = $4`,
      [u.id, s.str || '', s.hnr || '', s.ort || ''])).rows[0];
    if (vorhanden) { da++; continue; }
    const d = {};
    Object.keys(s).forEach((k) => { if (!WEG.test(k)) d[k] = s[k]; });
    await objectService.create(u.id, { data: d, aiAnalysis: src.ai_analysis || null, photos: [] });
    neu++;
  }

  const tp = (await query('SELECT count(*)::int AS n FROM tax_periods WHERE user_id = $1', [u.id])).rows[0].n;
  if (!tp) {
    await query(`INSERT INTO tax_periods (user_id, valid_from, valid_to, zve, reason, note, splitting, kirchensteuer)
                 SELECT $1, valid_from, valid_to, zve, reason, note, splitting, kirchensteuer FROM tax_periods WHERE user_id = $2`, [u.id, q.id]);
  }
  for (const k of ['bwk_profil', 'browser_vorgaben', 'lage_profil']) {
    await query(`INSERT INTO user_settings (user_id, schluessel, wert) SELECT $1, schluessel, wert FROM user_settings WHERE user_id = $2 AND schluessel = $3
                 ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = EXCLUDED.wert, updated_at = now()`, [u.id, q.id, k]);
  }
  fs.writeFileSync('/tmp/landing-bilder-token.txt', jwt.signKurz({ userId: u.id, email: EMAIL }, '2h'));
  console.log('Quelle ' + quellen.length + ' Objekte · neu kopiert ' + neu + ' · schon vorhanden ' + da + ' · Token in /tmp/landing-bilder-token.txt');
  process.exit(0);
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
