'use strict';
/**
 * DealPilot — Demo-Daten Seed
 *
 * Legt einen Demo-User + 3 vorgeplante Objekte mit Fotos an, damit du
 * direkt nach dem Deploy schon was zum Klicken hast.
 *
 * Aufruf:
 *   node src/db/seed-demo.js
 *
 * Wird im docker-compose.prod.yml automatisch ausgeführt, wenn
 * SEED_DEMO_DATA=1 gesetzt ist.
 *
 * Idempotent: Demo-User wird nur angelegt wenn er noch nicht existiert,
 * Demo-Objekte werden nur angelegt wenn der User noch keine Objekte hat.
 */

const fs = require('fs');
const path = require('path');
const { query, pool } = require('./pool');
const userService = require('../services/userService');
const objectService = require('../services/objectService');

const DEMO_EMAIL = 'demo@dealpilot.local';
const DEMO_PASSWORD = 'demo12345';
const DEMO_NAME = 'Demo-User';
const PHOTO_DIR = path.join(__dirname, '..', '..', 'seed-data', 'photos');

/**
 * Bild als data-URL (base64) einlesen — wie der Client es speichern würde.
 */
function loadPhotoAsDataUrl(filename) {
  const fp = path.join(PHOTO_DIR, filename);
  if (!fs.existsSync(fp)) {
    console.warn('  ⚠ Foto nicht gefunden: ' + fp);
    return null;
  }
  const buf = fs.readFileSync(fp);
  const ext = path.extname(filename).slice(1).toLowerCase();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  return 'data:' + mime + ';base64,' + buf.toString('base64');
}

/**
 * 3 realistische Demo-Objekte aus OWL.
 */
const DEMO_OBJECTS = [
  {
    photoFiles: ['herford_dresdenstr_1.jpg', 'herford_dresdenstr_2.jpg'],
    data: {
      _name: 'Dresdenstr. 116, Herford',
      kuerzel: 'HF_DD_116',
      plz: '32049',
      ort: 'Herford',
      str: 'Dresdenstr.',
      hnr: '116',
      objart: 'ETW',
      wfl: '96',
      baujahr: '1985',
      kaufdat: '2025-08-15',
      ausst: 'Normal',
      thesis: 'Solide ETW in etablierter Lage; aktuell unter Marktmiete vermietet, daher Mietsteigerungs-Potenzial. Sanierungsstand altersgerecht, kein akuter Investitionsdruck.',
      risiken: 'Heizungsumstellung GEG könnte mittelfristig anstehen. WEG-Rücklage prüfen.',
      makrolage: 'Gut',
      mikrolage: 'Durchschnittlich',
      vermstand: 'Vollvermietet',
      exitstr: 'Langfristig halten',
      // Investition
      kp: '180000',
      nk_proz: '1.5',
      grerw_proz: '6.5',
      makler_proz: '3.57',
      san: '0',
      bankval: '200000',
      svwert: '210000',
      // Grund & Boden
      brw: '160',
      mea: '7.06',
      gsfl: '1570',
      // Miete
      nkm: '850',
      ze: '90',
      umlagef: '144',
      mietspiegel: '9.50',
      // BWK
      hg_total: '1944',
      hg_nul: '1539',
      weg_r: '798',
      eigen_r: '0',
      mietausfall: '120',
      nul_sonst: '0',
      grundsteuer: '336',
      // Steuer
      zve: '60000',
      grenz: '40.45',
      afa_satz: '2.0',
      geb_ant: '80',
      // Finanzierung
      bank_inst: 'Sparkasse Herford',
      d1_vertrag: 'KD-2025-DEMO-01',
      ek: '17905',
      d1: '200000',
      d1z: '3.50',
      d1t: '1.00',
      d1_bindj: '10',
      zsatz_an: '5.0',
      // Prognosen
      mietstg: '1.5',
      wertstg: '2.0',
      kostenstg: '1.0',
      leerstand: '0.0',
      btj: '15',
      exit_bmy: '5.0'
    }
  },

  {
    photoFiles: ['bielefeld_brackwede_1.jpg', 'bielefeld_brackwede_2.jpg'],
    data: {
      _name: 'Hauptstr. 42, Bielefeld-Brackwede',
      kuerzel: 'BI_BW_42',
      plz: '33647',
      ort: 'Bielefeld',
      str: 'Hauptstr.',
      hnr: '42',
      objart: 'MFH',
      wfl: '320',
      baujahr: '1965',
      kaufdat: '2025-06-01',
      ausst: 'Normal',
      thesis: 'Saniertes Mehrfamilienhaus mit 4 WE in stadtnaher Lage Bielefelds. Vollvermietet, gute Anbindung an A33. Wertsteigerungs-Potenzial durch Stadtentwicklung Brackwede.',
      risiken: 'Bj. 1965 — energetische Modernisierungen mittelfristig denkbar. Mieterstruktur prüfen.',
      makrolage: 'Sehr gut',
      mikrolage: 'Gut',
      vermstand: 'Vollvermietet',
      exitstr: 'Verkauf nach 10 Jahren',
      kp: '590000',
      nk_proz: '1.5',
      grerw_proz: '6.5',
      makler_proz: '3.57',
      san: '15000',
      bankval: '620000',
      svwert: '640000',
      brw: '280',
      mea: '100',
      gsfl: '480',
      nkm: '2950',
      ze: '180',
      umlagef: '420',
      mietspiegel: '9.20',
      hg_total: '0',
      hg_nul: '0',
      weg_r: '0',
      eigen_r: '4800',
      mietausfall: '350',
      nul_sonst: '600',
      grundsteuer: '910',
      zve: '85000',
      grenz: '42.0',
      afa_satz: '2.0',
      geb_ant: '78',
      bank_inst: 'Volksbank Bielefeld',
      d1_vertrag: 'KD-2025-DEMO-02',
      ek: '85000',
      d1: '590000',
      d1z: '3.65',
      d1t: '2.00',
      d1_bindj: '15',
      zsatz_an: '5.0',
      mietstg: '2.0',
      wertstg: '2.5',
      kostenstg: '1.5',
      leerstand: '1.0',
      btj: '20',
      exit_bmy: '4.5'
    }
  },

  {
    photoFiles: ['minden_innenstadt_1.jpg', 'minden_innenstadt_2.jpg'],
    data: {
      _name: 'Bäckerstr. 7, Minden',
      kuerzel: 'MI_BK_7',
      plz: '32423',
      ort: 'Minden',
      str: 'Bäckerstr.',
      hnr: '7',
      objart: 'ETW',
      wfl: '78',
      baujahr: '1928',
      kaufdat: '2025-09-30',
      ausst: 'Gehoben',
      thesis: 'Sanierte Altbau-ETW in der Mindener Innenstadt mit Stuckdecken und Holzdielen. Top-Mikrolage zwischen Marktplatz und Weserpromenade.',
      risiken: 'Denkmalschutz-Auflagen begrenzen Modernisierungs-Spielraum. Höhere Heizkosten durch Altbau.',
      makrolage: 'Gut',
      mikrolage: 'Sehr gut',
      vermstand: 'Vollvermietet',
      exitstr: 'Langfristig halten',
      kp: '195000',
      nk_proz: '1.8',
      grerw_proz: '6.5',
      makler_proz: '3.57',
      san: '8000',
      bankval: '210000',
      svwert: '220000',
      brw: '250',
      mea: '8.5',
      gsfl: '720',
      nkm: '780',
      ze: '0',
      umlagef: '160',
      mietspiegel: '10.20',
      hg_total: '2400',
      hg_nul: '1800',
      weg_r: '900',
      eigen_r: '0',
      mietausfall: '110',
      nul_sonst: '0',
      grundsteuer: '290',
      zve: '55000',
      grenz: '38.0',
      afa_satz: '2.5',  // Altbau erhöhter AfA-Satz
      geb_ant: '85',
      bank_inst: 'Sparkasse Minden-Lübbecke',
      d1_vertrag: 'KD-2025-DEMO-03',
      ek: '25000',
      d1: '195000',
      d1z: '3.40',
      d1t: '1.50',
      d1_bindj: '10',
      zsatz_an: '5.0',
      mietstg: '1.8',
      wertstg: '2.2',
      kostenstg: '1.2',
      leerstand: '0.0',
      btj: '15',
      exit_bmy: '4.8'
    }
  }
];

async function ensureDemoUser() {
  const existing = await query('SELECT id FROM users WHERE email = $1', [DEMO_EMAIL.toLowerCase()]);
  let userId;
  if (existing.rowCount > 0) {
    console.log('  ✓ Demo-User existiert bereits: ' + DEMO_EMAIL);
    userId = existing.rows[0].id;
  } else {
    console.log('  → Demo-User wird angelegt: ' + DEMO_EMAIL);
    const u = await userService.createUser({
      email: DEMO_EMAIL,
      plainPassword: DEMO_PASSWORD,
      name: DEMO_NAME
    });
    console.log('  ✓ Demo-User angelegt: ' + DEMO_EMAIL + ' (Passwort: ' + DEMO_PASSWORD + ')');
    userId = u.id;
  }

  // V24: Demo-User bekommt Business-Plan (alle Limits NULL/-1 = unbegrenzt) —
  // damit er ohne Limits durchprobieren kann.
  await query(
    `INSERT INTO subscriptions
       (user_id, plan_id, billing_interval, status,
        current_period_start, current_period_end)
     VALUES ($1, 'business', 'monthly', 'active', NOW(), NOW() + INTERVAL '100 years')
     ON CONFLICT (user_id) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       status = EXCLUDED.status,
       current_period_end = EXCLUDED.current_period_end`,
    [userId]
  );
  console.log('  ✓ Demo-User auf Business-Plan (unbegrenzt) gesetzt');

  return userId;
}

async function seedObjects(userId) {
  // Wenn bereits Objekte da → skip (idempotent)
  const existing = await query('SELECT COUNT(*) AS cnt FROM objects WHERE user_id = $1', [userId]);
  const cnt = parseInt(existing.rows[0].cnt, 10);
  if (cnt > 0) {
    console.log('  ✓ Demo-User hat bereits ' + cnt + ' Objekt(e) — Seed übersprungen.');
    return;
  }
  for (const spec of DEMO_OBJECTS) {
    const photos = spec.photoFiles
      .map(loadPhotoAsDataUrl)
      .filter(Boolean);
    const obj = await objectService.create(userId, {
      data: spec.data,
      aiAnalysis: null,
      photos: photos
    });
    console.log('  ✓ Objekt angelegt: ' + obj.name + ' (' + photos.length + ' Foto' + (photos.length === 1 ? '' : 's') + ')');
  }
}

async function main() {
  console.log('━━━ DealPilot Demo-Seed ━━━');
  try {
    const uid = await ensureDemoUser();
    await seedObjects(uid);
    console.log('━━━ Seed abgeschlossen ━━━');
    console.log('Login: ' + DEMO_EMAIL + ' / ' + DEMO_PASSWORD);
  } catch (e) {
    console.error('✗ Seed-Fehler:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
