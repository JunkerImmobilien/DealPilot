'use strict';
/**
 * tools/steuer-mappe-testkonto.js · v3471 — NUR STAGING, laeuft IM Backend-Container:
 *   docker cp tools/steuer-mappe-testkonto.js dealpilot-backend:/app/steuer-mappe-testkonto.js
 *   docker exec dealpilot-backend node /app/steuer-mappe-testkonto.js [--variante=ledig|verheiratet]
 *
 * Marcel 16.11.2026: „Die Steuermappe für den Steuerberater neu machen, möglichst mit dem ersten
 * Objekt, das wir im Zeitraum haben … das erst gekaufte und das zweit gekaufte.“
 *
 * Legt (idempotent) ein eigenes Testkonto fuer die Kanzlei-Mappe an, damit info@ (Demo-Konto der
 * Messe) unberuehrt bleibt:
 *   steuer-mappe@steuer-pruefung.dealpilot.test   „Max Mustermann (Test)“, Plan pro (manuell, 365 Tage)
 * und kopiert die ZWEI ZUERST GEKAUFTEN Objekte des Demo-Kontos (gemessen 16.11.2026, Kaufdatum):
 *   1. Ravensberger Weg 38, Bielefeld   MFH, Kauf 01.04.2020
 *   2. Bismarckstr. 27, Detmold         MFH, Kauf 01.07.2023
 * Ohne Fotos, ohne Verknuepfungen; alle Steuerfelder befuellt (erfundene Werte):
 *   Grundsteuerwert, Eigentum, Inventar (R), Sanierung 72.000 € ueber der 15-%-Grenze (B), jedes Werbungskostenfeld 2025/2026
 *   (_tax_overrides aus dem Demo-Konto), Steuerzeitraeume, Gesellschaft „Muster Immobilien GmbH (Test)“.
 *
 * --variante=ledig        Einzelveranlagung, zvE 68.000 (2020-2025) / 90.000 (ab 2026), allein Eigentuemer
 * --variante=verheiratet  Zusammenveranlagung (Splitting), gemeinsames zvE 120.000 / 140.000,
 *                         Ehegatten je 50 %
 * Die Variante aendert nur Steuerzeitraeume und Eigentumsfelder — Objekte bleiben sonst gleich.
 * Gibt nie ein Passwort aus. Ein Kurz-Token (2 h) fuer die Messung im eigenen Headless-Chrome
 * landet in /tmp/steuer-mappe-token.txt im Container (nicht im Repo, nicht in der Ausgabe).
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
const VARIANTE = ((process.argv.find((a) => a.startsWith('--variante=')) || '').split('=')[1]) || 'ledig';
if (!/^(ledig|verheiratet)$/.test(VARIANTE)) { console.error('Variante ledig oder verheiratet'); process.exit(2); }
const EMAIL = 'steuer-mappe@steuer-pruefung.dealpilot.test';
const QUELLE = 'info@junker-immobilien.io';
const GMBH_ID = 'mtest-steuer-gmbh';

/* Die zwei Objekte und ihre Steuerfelder (erfunden, plausibel) */
const OBJEKTE = [
  { str: 'Ravensberger Weg', hnr: '38', kaufdat: '2020-04-01', felder: {
      grundsteuerwert: '640000', grundsteuer: '1650',
      moebl: '8000', inv_kueche: '8000', inv_moebel: '0', inv_geraete: '0', inv_sonst: '0', inv_tax_active: true, inv_tax_years: '10',
      san: '', san_tax_active: false },
    wk: { kontofuehrung: 96, bereitstellung: 240, notar_grundschuld: 680, vermittlung: 900, finanz_sonst: 350,
          betr_sonst: 180, hausverwaltung: 2880, steuerber: 450, porto: 35, verw_sonst: 60,
          fahrtkosten: 360, verpflegung: 28, hotel: 89, inserat: 180, gericht: 320, telefon: 120, sonst_kosten: 150,
          erhaltungsaufwand: 1200 } },
  { str: 'Bismarckstr.', hnr: '27', kaufdat: '2023-07-01', felder: {
      grundsteuerwert: '510000', grundsteuer: '1380',
      san: '72000', san_ust: 'brutto', san_tax_active: true, san_tax_years: 'auto', san_ausgefuehrt: '2024-04-15',
      moebl: '2400', inv_geraete: '2400', inv_kueche: '0', inv_moebel: '0', inv_sonst: '0', inv_tax_active: true, inv_tax_years: '10' },
    wk: { kontofuehrung: 84, bereitstellung: 180, notar_grundschuld: 540, vermittlung: 650, finanz_sonst: 290,
          betr_sonst: 140, hausverwaltung: 2160, steuerber: 380, porto: 30, verw_sonst: 45,
          fahrtkosten: 600, verpflegung: 14, hotel: 75, inserat: 150, gericht: 260, telefon: 120, sonst_kosten: 110,
          erhaltungsaufwand: 950 } }
];
const EIGENTUM = VARIANTE === 'verheiratet'
  ? { eig_struktur: 'ehegatten', eig_erwerb: 'kauf', eig_anteil_ich: '50', eig_anteil_ehegatte: '50', eig_anteil_dritte: '0' }
  : { eig_struktur: 'allein', eig_erwerb: 'kauf', eig_anteil_ich: '100', eig_anteil_ehegatte: '0', eig_anteil_dritte: '0' };
const ZEITRAEUME = VARIANTE === 'verheiratet'
  ? [['2020-01-01', '2025-12-31', 120000], ['2026-01-01', null, 140000]]
  : [['2020-01-01', '2025-12-31', 68000], ['2026-01-01', null, 90000]];

/* Felder, die nicht mitkopiert werden: Verknuepfungen, Ueberfuehrung, Nummer, Bilder, Status */
const WEG = /^(_ueberf_link|ueberf_ende|ueberf_daten|ueberf_preis|ueberf_restschuld|ueberf_rest_zins|verkehrswert_ueberf|_obj_seq|seq_no|_thumb|_deal_lost.*|paket_.*|kunden_.*|_freigabe.*|partner_.*)$/;

(async () => {
  let u = (await query('SELECT id, email FROM users WHERE email = $1', [EMAIL])).rows[0];
  if (!u) {
    u = await userService.createUser({ email: EMAIL, plainPassword: crypto.randomBytes(18).toString('base64url'), name: 'Max Mustermann (Test)', newsletter: false });
    console.log('Konto angelegt');
  }
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [u.id]);
  await planService.setUserPlanManual(u.id, 'pro', 'yearly', 365);
  const q = (await query('SELECT id FROM users WHERE email = $1', [QUELLE])).rows[0];
  if (!q) { console.error('Quellkonto fehlt'); process.exit(1); }

  const ids = [];
  for (const o of OBJEKTE) {
    const src = (await query(`SELECT data, ai_analysis FROM objects WHERE user_id = $1 AND data->>'str' = $2 AND data->>'hnr' = $3 AND data->>'kaufdat' = $4
                              AND COALESCE((data->>'_deal_lost')::boolean, false) = false ORDER BY updated_at DESC LIMIT 1`, [q.id, o.str, o.hnr, o.kaufdat])).rows[0];
    if (!src) { console.error('Quellobjekt fehlt: ' + o.str + ' ' + o.hnr); process.exit(1); }
    const d = {};
    Object.keys(src.data || {}).forEach((k) => { if (!WEG.test(k)) d[k] = src.data[k]; });
    /* Werbungskosten je Jahr: die kleinen eigenen Angaben aus dem Demo-Konto bleiben (Porto, Telefon,
       Fahrtkosten, Steuerberatung, Kontofuehrung …). Von Hand ueberschriebene Erhaltungs- und Inventar-
       Betraege fallen weg, wo das Objekt eine Sanierung bzw. ein Inventar fuehrt — dann rechnet die App
       sie selbst (15-%-Pruefung, Verteilung, AfA beweglich), und die Mappe kann sagen, woher die Zahl kommt. */
    const ov = JSON.parse(JSON.stringify(d._tax_overrides || {}));
    Object.keys(ov).forEach((y) => {
      if (o.felder.inv_tax_active || o.felder.san) delete ov[y].sonst_bewegl_wg;
      if (o.felder.san) delete ov[y].erhaltungsaufwand;
    });
    /* Marcel 16.11.2026: „Es müssen alle Felder in den Werbungskosten gefüllt sein, damit man sieht,
       was wir alles für Felder haben.“ Jedes von Hand fuehrbare Feld des Steuerformulars (WK-Liste in
       dp-dokumente.js / Spalten von tax_records) bekommt fuer 2025 und 2026 einen erfundenen Wert.
       Gerechnete Felder (Schuldzinsen, AfA, Nebenkosten, AfA beweglich, anschaffungsnah, Erhaltung aus
       der Sanierung) kommen aus den Objektdaten und werden NICHT ueberschrieben. */
    ['y2025', 'y2026'].forEach((y) => { ov[y] = Object.assign({}, ov[y] || {}, o.wk); });
    d._tax_overrides = ov;
    Object.assign(d, o.felder, EIGENTUM, { halter: 'privat', halter_seit: '', obj_herkunft: 'neukauf',
      notizen: 'Testobjekt fuer die Kanzlei-Mappe (Kopie aus dem Demo-Konto, Steuerfelder erfunden).' });
    const da = (await query(`SELECT id, data FROM objects WHERE user_id = $1 AND data->>'str' = $2 AND data->>'hnr' = $3 AND COALESCE(data->>'obj_herkunft','') <> 'ueberfuehrung'`, [u.id, o.str, o.hnr])).rows[0];
    if (da) {
      /* Bereits ueberfuehrt? Dann nur Eigentum der Variante setzen, nichts zuruecksetzen */
      if (da.data && da.data.ueberf_ende) {
        await query(`UPDATE objects SET data = data || $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1`, [da.id, JSON.stringify(EIGENTUM)]);
      } else {
        d._obj_seq = da.data && da.data._obj_seq; if (!d._obj_seq) delete d._obj_seq;
        await query(`UPDATE objects SET data = $2::jsonb, version = version + 1, updated_at = now() WHERE id = $1`, [da.id, JSON.stringify(d)]);
      }
      ids.push(da.id);
    } else {
      const neu = await objectService.create(u.id, { data: d, aiAnalysis: src.ai_analysis || null, photos: [] });
      ids.push(neu.id);
    }
  }

  /* Steuerzeitraeume der Variante */
  await query('DELETE FROM tax_periods WHERE user_id = $1', [u.id]);
  for (const [von, bis, zve] of ZEITRAEUME) {
    await query(`INSERT INTO tax_periods (user_id, valid_from, valid_to, zve, reason, note, splitting, kirchensteuer) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [u.id, von, bis, zve, 'Testkonto Steuermappe', 'Variante ' + VARIANTE + ' (erfundene Werte)', VARIANTE === 'verheiratet', 0]);
  }

  /* Gesellschaft und Stammdaten (erfunden). Den Plan der Ueberfuehrung (uew_plan) setzt die App. */
  const alt = (await query(`SELECT wert FROM user_settings WHERE user_id = $1 AND schluessel = 'mandanten'`, [u.id])).rows[0];
  const altGmbh = alt && alt.wert && Array.isArray(alt.wert.list) ? alt.wert.list.find((m) => m.id === GMBH_ID) : null;
  const gmbh = Object.assign({
    id: GMBH_ID, name: 'Muster Immobilien GmbH (Test)', rechtsform: 'gmbh',
    ident: { strasse: 'Musterstraße 1', ort: '33602 Bielefeld', steuernummer: '305/0000/0000 (Test)', finanzamt: 'Finanzamt Bielefeld-Innenstadt', handelsregister: 'HRB 00000 (Test), Amtsgericht Bielefeld', ustid: '' },
    regime: { kst: 15.825, gewst: 450, erw_kuerzung: true, erw_pruefung: { nur_grundbesitz: true, keine_betriebsvorrichtung: true, kein_gesellschafterbetrieb: true, bagatell: true } },
    bh: { eb_bank: 25000, wj_start: '01-01', eb_gesdar: 0, kontenrahmen: 'SKR04', stammkapital: 25000, eb_gewinnvortrag: 0 },
    kosten: Object.fromEntries([2025, 2026, 2027, 2028].map((j) => [String(j), { gf: 0, bank: 180, sonst: 300, kammer: 150, abschluss: 900, steuerber: 2400 }]))
  }, altGmbh ? { uew_plan: altGmbh.uew_plan } : {});
  const mand = { list: [{ id: 'privat', name: 'Privat', rechtsform: 'privat', regime: {}, bh: {}, kosten: {}, _locked: true }, gmbh] };
  await query(`INSERT INTO user_settings (user_id, schluessel, wert) VALUES ($1,'mandanten',$2::jsonb)
               ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = EXCLUDED.wert, updated_at = now()`, [u.id, JSON.stringify(mand)]);
  const stamm = { nutzer: u.id, settings: { user_name: 'Max Mustermann (Test)', user_company: '', pdf_address: 'Musterstraße 1', pdf_plz: '33602', pdf_city: 'Bielefeld',
    pdf_email: EMAIL, pdf_phone: '', pdf_website: '' } };
  await query(`INSERT INTO user_settings (user_id, schluessel, wert) VALUES ($1,'stammdaten',$2::jsonb)
               ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = EXCLUDED.wert, updated_at = now()`, [u.id, JSON.stringify(stamm)]);
  /* Bewirtschaftungsprofil und Score-Gewichtung wie im Demo-Konto, damit die Zahlen gleich rechnen */
  for (const k of ['bwk_profil', 'browser_vorgaben', 'lage_profil']) {
    await query(`INSERT INTO user_settings (user_id, schluessel, wert) SELECT $1, schluessel, wert FROM user_settings WHERE user_id = $2 AND schluessel = $3
                 ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = EXCLUDED.wert, updated_at = now()`, [u.id, q.id, k]);
  }

  fs.writeFileSync('/tmp/steuer-mappe-token.txt', jwt.signKurz({ userId: u.id, email: EMAIL }, '2h'));
  console.log('Variante ' + VARIANTE + ' · Objekte ' + ids.join(', ') + ' · Zeitraeume ' + ZEITRAEUME.length + ' · Token in /tmp/steuer-mappe-token.txt');
  process.exit(0);
})().catch((e) => { console.error('FEHLER', e.message); process.exit(1); });
