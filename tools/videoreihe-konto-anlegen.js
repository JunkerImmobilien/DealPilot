'use strict';
/**
 * tools/videoreihe-konto-anlegen.js · v3502 — KONTO FÜR DIE VIDEOREIHE. NUR STAGING, läuft IM Backend-Container:
 *   docker cp tools/videoreihe-konto-anlegen.js dealpilot-backend:/app/videoreihe-konto-anlegen.js
 *   docker exec dealpilot-backend node /app/videoreihe-konto-anlegen.js
 *
 * Marcel 16.11.2026: die Videos mit Pilot-Analyse neu aufnehmen, aber NICHT im Konto info@ (dort wird nicht
 * eingeloggt). Dieses Skript legt (idempotent) videoreihe@video-demo.dealpilot.test an („Demo Investor (Video)“,
 * Plan pro) und KOPIERT alle Demo-Objekte aus info@ (nur gelesen) samt Fotos, Pilot-Analyse (ohne Objektkennung
 * des Originals), Steuerzeiträumen und Vorgaben (Score, Lage, BWK, Darstellung, Mandanten).
 *
 * Jede Kopie trägt die Kennung ihres Originals in data._demo_quelle. Daraus entsteht die Zuordnung
 * Original → Kopie (/tmp/videoreihe-kennungen.json im Container); das Aufnahmewerkzeug legt sie in
 * localStorage dpm_kennungen ab, und messe-drehbuch.js (kennungenAufloesen) setzt seine festen Kennungen
 * (R11_WESTERFELD, R11_PARK, R27_DT, QG_A …) darauf um. Ein zweiter Lauf setzt die Kopien auf den Stand der
 * Originale zurück (Daten, Analyse), Nummer und Fotos bleiben.
 * Gibt nie ein Passwort aus. Kurz-Token (3 h) in /tmp/videoreihe-token.json im Container.
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
const EMAIL = 'videoreihe@video-demo.dealpilot.test';
const NAME = 'Demo Investor (Video)';
const WEG = /^(_ueberf_link|_obj_seq|seq_no|_thumb|paket_.*|kunden_.*|_freigabe.*|partner_.*|_kundenstand|_von_kunde|_demo_quelle)$/;
const EINSTELLUNGEN = ['bwk_profil', 'browser_vorgaben', 'lage_profil', 'mandanten', 'portfolio_analyse', 'pdf_vorgabe', 'hinweise', 'bot_vorgaben'];
function ohneKennung(ai) {
  if (!ai) return ai;
  try { const istText = typeof ai === 'string'; const aj = istText ? JSON.parse(ai) : JSON.parse(JSON.stringify(ai));
    if (aj && aj._fuer && aj._fuer.objekt_id) { delete aj._fuer.objekt_id; return istText ? JSON.stringify(aj) : aj; } } catch (e) {}
  return ai;
}

(async () => {
  const q = (await query('SELECT id FROM users WHERE email = $1', [QUELLE])).rows[0];
  if (!q) { console.error('Quellkonto fehlt'); process.exit(1); }
  let u = (await query('SELECT id, email FROM users WHERE email = $1', [EMAIL])).rows[0];
  if (!u) { u = await userService.createUser({ email: EMAIL, plainPassword: crypto.randomBytes(18).toString('base64url'), name: NAME, newsletter: false }); console.log('Konto angelegt'); }
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), name = $2 WHERE id = $1', [u.id, NAME]);
  await planService.setUserPlanManual(u.id, 'pro', 'yearly', 365);

  /* Vorgaben wie im Demo-Konto, Stammdaten neutral (Ersteinrichtung erledigt) */
  for (const k of EINSTELLUNGEN) {
    await query(`INSERT INTO user_settings (user_id, schluessel, wert) SELECT $1, schluessel, wert FROM user_settings WHERE user_id = $2 AND schluessel = $3
                 ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = EXCLUDED.wert, updated_at = now()`, [u.id, q.id, k]);
  }
  await query(`INSERT INTO user_settings (user_id, schluessel, wert) VALUES ($1,'stammdaten',$2::jsonb)
               ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = EXCLUDED.wert, updated_at = now()`,
    [u.id, JSON.stringify({ nutzer: u.id, settings: { user_name: NAME, user_company: '', pdf_address: '', pdf_plz: '', pdf_city: '', pdf_email: EMAIL, pdf_phone: '', pdf_website: '' }, onboarding_fertig: '2026-11-16T08:00:00.000Z' })]);
  await query('DELETE FROM tax_periods WHERE user_id = $1', [u.id]);
  await query(`INSERT INTO tax_periods (user_id, valid_from, valid_to, zve, reason, note, splitting, kirchensteuer)
               SELECT $1, valid_from, valid_to, zve, reason, note, splitting, kirchensteuer FROM tax_periods WHERE user_id = $2`, [u.id, q.id]);

  /* Objekte: jedes Original (auch verlorene, die Reihe zeigt sie im Ankauf) genau einmal */
  const quellen = (await query('SELECT id FROM objects WHERE user_id = $1 AND kunden_freigabe_id IS NULL ORDER BY created_at', [q.id])).rows;
  const karte = {}; let neu = 0, zurueck = 0;
  for (const { id } of quellen) {
    const src = await objectService.getById(q.id, id);   /* nur lesen; Fotos als data-URL */
    if (!src) continue;
    const d = {}; Object.keys(src.data || {}).forEach((k) => { if (!WEG.test(k)) d[k] = src.data[k]; });
    d._demo_quelle = id;
    const da = (await query(`SELECT id, data->>'_obj_seq' AS seq FROM objects WHERE user_id = $1 AND data->>'_demo_quelle' = $2`, [u.id, id])).rows[0];
    if (da) {
      if (da.seq) d._obj_seq = da.seq;
      await query('UPDATE objects SET data = $2::jsonb, ai_analysis = $3, version = version + 1, updated_at = now() WHERE id = $1',
        [da.id, JSON.stringify(d), src.ai_analysis ? JSON.stringify(ohneKennung(src.ai_analysis)) : null]);
      karte[id] = da.id; zurueck++;
    } else {
      let fotos = src.photos; if (typeof fotos === 'string') { try { fotos = JSON.parse(fotos); } catch (e) { fotos = []; } }
      const o = await objectService.create(u.id, { data: d, aiAnalysis: ohneKennung(src.ai_analysis) || null, photos: Array.isArray(fotos) ? fotos : [] });
      karte[id] = o.id; neu++;
    }
  }
  /* Kopien, deren Original es nicht mehr gibt, bleiben liegen (keine Löschung) */
  fs.writeFileSync('/tmp/videoreihe-kennungen.json', JSON.stringify(karte));
  fs.writeFileSync('/tmp/videoreihe-token.json', JSON.stringify({ t: jwt.signKurz({ userId: u.id, email: EMAIL, name: NAME }, '3h'), id: u.id, email: EMAIL, name: NAME }));
  console.log('Objekte: ' + neu + ' neu, ' + zurueck + ' zurueckgesetzt, Zuordnung ' + Object.keys(karte).length + ' · /tmp/videoreihe-kennungen.json, /tmp/videoreihe-token.json');
  process.exit(0);
})().catch((e) => { console.error('FEHLER', e.stack || e.message); process.exit(1); });
