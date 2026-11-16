'use strict';
/**
 * tools/partner-demo-anlegen.js · v3490 — DEMO-PARTNER FUER DIE PARTNER-VIDEOS. NUR STAGING, laeuft IM Backend-Container:
 *   docker cp tools/partner-demo-anlegen.js dealpilot-backend:/app/partner-demo-anlegen.js
 *   docker cp tools/partner-demo dealpilot-backend:/app/partner-demo
 *   docker exec dealpilot-backend node /app/partner-demo-anlegen.js
 *
 * Marcel 16.11.2026: ein komplettes Erklaervideo fuer Partner mit einem eigenen Demo-Partnerkonto.
 * Nachtrag 16.11.: der Demo-Partner bleibt DAUERHAFT stehen. Dieses Skript ist idempotent: es erkennt
 * vorhandene Konten und stellt bei jedem Lauf den AUFNAHME-ZUSTAND wieder her (Videos schreiben echt
 * in dieses Konto, z. B. „Zurück an Kunden“ – vor jeder Aufnahme einmal laufen lassen).
 *
 * Alles ist erfunden (Firma, Personen mit „(Demo)“, Adressen der Kunden stammen aus Demo-Objekten).
 *   Partner   partner-demo@nordlicht-demo.dealpilot.test   „Lena Nordmann (Demo)“, Plan partner (manuell),
 *             Marke „Nordlicht Immobilienberatung“, Logo tools/partner-demo/*.png, Farbe Nordlicht-Blau, 5 Plaetze ohne Stripe
 *   Kunde A   jonas.berger@nordlicht-demo.dealpilot.test   Partnerplatz (Einladung mit Platz, angenommen)
 *             Lindenallee 14 Herford (MFH, Ankauf, Unterlagen ausgelesen) · Musterstraße 12 Leipzig (ETW, Bestand)
 *   Kunde B   sabine.kraus@nordlicht-demo.dealpilot.test   eigener Plan Pro, per Verbindungscode verbunden
 *             Parkstr. 9 Bad Oeynhausen (MFH, Bestand) · Musterweg 3 Bielefeld (DHH, Ankauf, NICHT gesendet: Video 3 sendet es)
 *   Kunde C   thomas.weber@nordlicht-demo.dealpilot.test   eingeladen, noch nicht angenommen (offene Anfrage)
 *             Musterallee 7a Konstanz (ETW, Ankauf)
 *   Partner-eigenes Objekt: Gohliser Str. 42 Leipzig (MFH, Bestand) – fuer „Objekt an Kunden übergeben“.
 *
 * Aufnahme-Zustand:
 *   A sendet Lindenallee 14 (Stand 1) → drei Anmerkungen → „Zurück an Kunden“ mit Begleittext (Mail an: Testadresse,
 *   geht nie ueber SMTP) → A beantwortet eine (erledigt) → A sendet erneut (Stand 2) → ein Entwurf des Partners am Stand 2.
 *   A sendet Musterstraße 12, B sendet Parkstr. 9. Mail bei Rückmeldung: A an, B aus. Eine Aufgabe „Steuerjahr 2025“ an alle.
 *
 * Objekte werden aus dem Demo-Konto info@ KOPIERT (nur gelesen, nie geaendert, nie verschoben).
 * Gibt nie ein Passwort aus. Kurz-Tokens (3 h) fuer Messung und Aufnahme stehen in /tmp/partner-demo-tokens.json im Container.
 * Optionen: --nur-tokens (nur Tokens neu schreiben)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');
const planService = require('./src/services/planService');
const resellerService = require('./src/services/resellerService');
const objectService = require('./src/services/objectService');
const objektFotos = require('./src/services/objektFotos');
const jwt = require('./src/utils/jwt');

if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) {
  console.error('ABBRUCH: nur auf Staging (APP_URL enthaelt kein „staging“).'); process.exit(2);
}
const BASIS = 'http://localhost:' + (process.env.PORT || 3000) + '/api/v1';
const QUELLE = 'info@junker-immobilien.io';
const DOMAIN = '@nordlicht-demo.dealpilot.test';
const PLAETZE = 5;
const NUR_TOKENS = process.argv.includes('--nur-tokens');
const LOGO_DIR = fs.existsSync('/app/partner-demo') ? '/app/partner-demo' : path.join(__dirname, 'partner-demo');

const KONTEN = {
  P: { email: 'partner-demo' + DOMAIN, name: 'Lena Nordmann (Demo)' },
  A: { email: 'jonas.berger' + DOMAIN, name: 'Jonas Berger (Demo)' },
  B: { email: 'sabine.kraus' + DOMAIN, name: 'Sabine Kraus (Demo)' },
  C: { email: 'thomas.weber' + DOMAIN, name: 'Thomas Weber (Demo)' }
};
/* Quelle im Demo-Konto: Strasse, Hausnummer, Ort (gemessen 16.11.2026) */
const OBJEKTE = {
  A: [{ str: 'Lindenallee', hnr: '14', ort: 'Herford' }, { str: 'Musterstraße', hnr: '12', ort: 'Leipzig' }],
  B: [{ str: 'Parkstr.', hnr: '9', ort: 'Bad Oeynhausen' }, { str: 'Musterweg', hnr: '3', ort: 'Bielefeld' }],
  C: [{ str: 'Musterallee', hnr: '7a', ort: 'Konstanz' }],
  P: [{ str: 'Gohliser Str.', hnr: '42', ort: 'Leipzig' }]
};
const MARKE = {
  name: 'Nordlicht Immobilienberatung', accent: '#3A8FB7', hi: '#7CC3E3', lo: '#24607D',
  kontakt: { brand_company: 'Nordlicht Immobilienberatung GmbH (Demo)', brand_address: 'Am Hafenkai 7', brand_plz: '32052', brand_city: 'Herford',
    brand_phone: '05221 000000 (Demo)', brand_email: 'kontakt' + DOMAIN, brand_website: 'nordlicht-demo.example',
    brand_tagline: 'Klarer Blick auf jede Immobilie', brand_mail_accent: '#3A8FB7' }
};
/* Felder, die nicht mitkopiert werden: Verknuepfungen, Nummer, Status, Partnerspuren */
const WEG = /^(_ueberf_link|ueberf_ende|ueberf_daten|ueberf_preis|ueberf_restschuld|ueberf_rest_zins|verkehrswert_ueberf|_obj_seq|seq_no|_deal_lost.*|paket_.*|kunden_.*|_freigabe.*|partner_.*|_kundenstand|_von_kunde|_partner_.*)$/;

async function http(token, methode, pfad, body) {
  const r = await fetch(BASIS + pfad, { method: methode, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (r.status >= 400) console.warn('  HTTP', methode, pfad, r.status, JSON.stringify(j).slice(0, 160));
  return { status: r.status, j };
}
const tokenFuer = (u, dauer) => jwt.signKurz({ userId: u.id, email: u.email, name: u.name }, dauer || '30m');
async function konto(k) {
  let u = (await query('SELECT id, email, name FROM users WHERE email = $1', [k.email])).rows[0];
  if (!u) { u = await userService.createUser({ email: k.email, plainPassword: crypto.randomBytes(18).toString('base64url'), name: k.name, newsletter: false }); console.log('Konto angelegt', k.email); }
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), name = $2 WHERE id = $1', [u.id, k.name]);
  return Object.assign(u, { name: k.name });
}
async function quelleLesen(q, o) {
  const r = (await query(`SELECT id FROM objects WHERE user_id = $1 AND data->>'str' = $2 AND data->>'hnr' = $3 AND data->>'ort' = $4
      AND kunden_freigabe_id IS NULL AND COALESCE((data->>'_deal_lost')::boolean, false) = false ORDER BY updated_at DESC LIMIT 1`, [q.id, o.str, o.hnr, o.ort])).rows[0];
  if (!r) throw new Error('Quellobjekt fehlt im Demo-Konto: ' + o.str + ' ' + o.hnr);
  return objectService.getById(q.id, r.id);   /* nur lesen; Fotos als data-URL */
}
/* Kopie anlegen oder auf den Stand der Quelle zuruecksetzen (eigene Nummer bleibt) */
async function objektKopie(u, q, o) {
  const src = await quelleLesen(q, o);
  const d = {};
  Object.keys(src.data || {}).forEach((k) => { if (!WEG.test(k)) d[k] = src.data[k]; });
  const da = (await query(`SELECT id, data->>'_obj_seq' AS seq FROM objects WHERE user_id = $1 AND kunden_freigabe_id IS NULL AND data->>'str' = $2 AND data->>'hnr' = $3
      AND data->'_von_kunde' IS NULL`, [u.id, o.str, o.hnr])).rows[0];
  if (da) {
    if (da.seq) d._obj_seq = da.seq;
    await query(`UPDATE objects SET data = $2::jsonb, ai_analysis = $3, version = version + 1, updated_at = now() WHERE id = $1`,
      [da.id, JSON.stringify(d), src.ai_analysis ? JSON.stringify(src.ai_analysis) : null]);
    return da.id;
  }
  let fotos = src.photos; if (typeof fotos === 'string') { try { fotos = JSON.parse(fotos); } catch (e) { fotos = []; } }
  const neu = await objectService.create(u.id, { data: d, aiAnalysis: src.ai_analysis || null, photos: Array.isArray(fotos) ? fotos : [] });
  return neu.id;
}
async function einstellungenWieDemo(u, q) {
  for (const k of ['bwk_profil', 'browser_vorgaben', 'lage_profil']) {
    await query(`INSERT INTO user_settings (user_id, schluessel, wert) SELECT $1, schluessel, wert FROM user_settings WHERE user_id = $2 AND schluessel = $3
                 ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = EXCLUDED.wert, updated_at = now()`, [u.id, q.id, k]);
  }
}
const logo = (n) => 'data:image/png;base64,' + fs.readFileSync(path.join(LOGO_DIR, n)).toString('base64');

/* Partnerseite auf null: Anmerkungen, Aufgaben, Meldungen, Kundenstaende (Kopien), uebernommene Objekte, Uebergaben */
async function partnerZuruecksetzen(rs, P) {
  const r = rs.id;
  await query(`DELETE FROM partner_anmerkungen WHERE reseller_id = $1`, [r]);
  await query(`DELETE FROM partner_aufgaben_kunden WHERE aufgabe_id IN (SELECT id FROM partner_aufgaben WHERE reseller_id = $1)`, [r]);
  await query(`DELETE FROM partner_aufgaben WHERE reseller_id = $1`, [r]);
  await query(`DELETE FROM partner_meldungen WHERE reseller_id = $1`, [r]);
  const kopien = (await query(`SELECT o.id, o.user_id FROM objects o WHERE o.kunden_freigabe_id IN (SELECT id FROM object_shares WHERE reseller_id = $1)
                                UNION SELECT id, user_id FROM objects WHERE user_id = $2 AND data->'_von_kunde' IS NOT NULL`, [r, P.id])).rows;
  for (const k of kopien) { await objektFotos.objektLeeren(k.user_id, k.id); }
  await query(`DELETE FROM share_audit WHERE share_id IN (SELECT id FROM object_shares WHERE reseller_id = $1)`, [r]);
  await query(`UPDATE object_shares SET kopie_object_id = NULL WHERE reseller_id = $1`, [r]);
  if (kopien.length) await query(`DELETE FROM objects WHERE id = ANY($1::uuid[])`, [kopien.map((k) => k.id)]);
  await query(`DELETE FROM object_shares WHERE reseller_id = $1`, [r]);
  /* Uebergaben aus Video-Laeufen: Kopien beim Empfaenger bleiben (gehoeren dann ihm), Reservierungen frei */
  await query(`UPDATE licenses SET reserviert_fuer = NULL WHERE reseller_id = $1 AND reserviert_fuer IS NOT NULL`, [r]);
  await query(`DELETE FROM objekt_uebergaben WHERE reseller_id = $1 AND uebernommen_at IS NULL`, [r]);
  console.log('Partnerseite zurueckgesetzt: ' + kopien.length + ' Kopien entfernt');
}

(async () => {
  const P = await konto(KONTEN.P), A = await konto(KONTEN.A), B = await konto(KONTEN.B), C = await konto(KONTEN.C);
  const tokens = () => fs.writeFileSync('/tmp/partner-demo-tokens.json', JSON.stringify({
    erzeugt: new Date().toISOString(),
    P: { t: tokenFuer(P, '3h'), id: P.id, email: P.email, name: P.name }, A: { t: tokenFuer(A, '3h'), id: A.id, email: A.email, name: A.name },
    B: { t: tokenFuer(B, '3h'), id: B.id, email: B.email, name: B.name }, C: { t: tokenFuer(C, '3h'), id: C.id, email: C.email, name: C.name } }));
  if (NUR_TOKENS) { tokens(); console.log('Tokens in /tmp/partner-demo-tokens.json'); process.exit(0); }
  const q = (await query('SELECT id FROM users WHERE email = $1', [QUELLE])).rows[0];
  if (!q) { console.error('Demo-Konto fehlt'); process.exit(1); }

  /* Plaene */
  await planService.setUserPlanManual(P.id, 'partner', 'yearly', 365);
  await planService.setUserPlanManual(B.id, 'pro', 'yearly', 365);

  /* Partner: Marke, Kontakt, Logo, Plaetze */
  const rs = await resellerService.ensureReseller(P.id, { name: MARKE.name });
  await query(`UPDATE resellers SET name = $2, brand_name = $2, brand_accent = $3, brand_accent_hi = $4, brand_accent_lo = $5, whitelabel_enabled = true,
                 brand_logo_b64 = $6, brand_logo_dark_b64 = $7, updated_at = now() WHERE id = $1`,
    [rs.id, MARKE.name, MARKE.accent, MARKE.hi, MARKE.lo, logo('nordlicht-logo-hell.png'), logo('nordlicht-logo-dunkel.png')]);
  const k = MARKE.kontakt;
  await query(`UPDATE resellers SET brand_company = $2, brand_address = $3, brand_plz = $4, brand_city = $5, brand_phone = $6, brand_email = $7,
                 brand_website = $8, brand_tagline = $9, brand_mail_accent = $10 WHERE id = $1`,
    [rs.id, k.brand_company, k.brand_address, k.brand_plz, k.brand_city, k.brand_phone, k.brand_email, k.brand_website, k.brand_tagline, k.brand_mail_accent]);
  const pool = await resellerService.getPool(rs.id);
  if (pool.gekauft < PLAETZE) await resellerService.syncPoolQuantity(rs.id, PLAETZE, { interval: 'yearly' });
  /* Stammdaten; onboarding_fertig = Ersteinrichtung erledigt (konto-stammdaten.js), sonst steht der Assistent ueber jeder Aufnahme */
  const FERTIG = '2026-11-16T08:00:00.000Z';
  const stammSetzen = (u, settings) => query(`INSERT INTO user_settings (user_id, schluessel, wert) VALUES ($1,'stammdaten',$2::jsonb)
               ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = EXCLUDED.wert, updated_at = now()`, [u.id, JSON.stringify({ nutzer: u.id, settings, onboarding_fertig: FERTIG })]);
  await stammSetzen(P, { user_name: KONTEN.P.name, user_company: k.brand_company, pdf_address: k.brand_address, pdf_plz: k.brand_plz,
    pdf_city: k.brand_city, pdf_email: k.brand_email, pdf_phone: k.brand_phone, pdf_website: k.brand_website });
  for (const w of ['A', 'B', 'C']) {
    const u = { A, B, C }[w];
    await stammSetzen(u, { user_name: KONTEN[w].name, user_company: '', pdf_address: '', pdf_plz: '', pdf_city: '', pdf_email: u.email, pdf_phone: '', pdf_website: '' });
  }

  /* Objekte (Kopien aus dem Demo-Konto) */
  const ids = {};
  for (const [wer, u] of [['P', P], ['A', A], ['B', B], ['C', C]]) {
    await einstellungenWieDemo(u, q);
    ids[wer] = [];
    for (const o of OBJEKTE[wer]) ids[wer].push(await objektKopie(u, q, o));
  }
  console.log('Objekte', JSON.stringify(Object.fromEntries(Object.entries(ids).map(([w, l]) => [w, l.length]))));

  await partnerZuruecksetzen(rs, P);
  const tP = tokenFuer(P), tA = tokenFuer(A), tB = tokenFuer(B), tC = tokenFuer(C);

  /* Kunde A: Einladung mit Platz, annehmen */
  let c = await http(tP, 'GET', '/partner/cockpit');
  if (c.status !== 200) { console.error('Cockpit', c.status); process.exit(1); }
  const verbunden = (u) => c.j.kunden.find((x) => x.user_id === u.id && !x.getrennt_am);
  if (!verbunden(A)) {
    await http(tP, 'POST', '/partner/einladen', { email: A.email, name: KONTEN.A.name, platz_mitgeben: true });
    const an = ((await http(tA, 'GET', '/mein-partner')).j.anfragen || [])[0];
    if (an) await http(tA, 'POST', '/mein-partner/anfragen/' + an.id, { annehmen: true });
  }
  /* Kunde B: eigener Plan, Verbindungscode */
  if (!verbunden(B)) {
    const cd = await http(tB, 'POST', '/mein-partner/code');
    await http(tP, 'POST', '/partner/code', { code: cd.j && cd.j.code, name: KONTEN.B.name, platz_mitgeben: false });
    const an = ((await http(tB, 'GET', '/mein-partner')).j.anfragen || [])[0];
    if (an) await http(tB, 'POST', '/mein-partner/anfragen/' + an.id, { annehmen: true });
  }
  /* Kunde C: nur eingeladen (offene Anfrage, nicht angenommen) */
  c = await http(tP, 'GET', '/partner/cockpit');
  if (!verbunden(C) && !(c.j.anfragen || []).some((a) => a.email === C.email && a.status === 'offen')) {
    await http(tP, 'POST', '/partner/einladen', { email: C.email, name: KONTEN.C.name, platz_mitgeben: true });
  }
  c = await http(tP, 'GET', '/partner/cockpit');
  const kA = verbunden(A), kB = verbunden(B);
  if (!kA || !kB) { console.error('Verbindung fehlt', !!kA, !!kB); process.exit(1); }
  await http(tP, 'PUT', '/partner/kunden/' + kA.id, { mail_rueckmeldung: true, notiz: 'Kauft das erste Mehrfamilienhaus, Bankgespräch im Dezember.' });
  await http(tP, 'PUT', '/partner/kunden/' + kB.id, { mail_rueckmeldung: false, notiz: 'Bestandshalterin, Steuerunterlagen jährlich.' });
  /* Kunden ohne Partner-Spuren aus frueheren Laeufen: offene Codes widerrufen */
  await query(`UPDATE verbindungs_codes SET widerrufen_am = now() WHERE user_id = ANY($1::uuid[]) AND eingeloest_am IS NULL AND widerrufen_am IS NULL`, [[A.id, B.id, C.id]]);

  /* Sendungen */
  const [aLinden, aMuster] = ids.A, [bPark] = ids.B;
  await http(tA, 'POST', '/mein-partner/senden', { object_ids: [aLinden] });
  await http(tA, 'POST', '/mein-partner/senden', { object_ids: [aMuster] });
  await http(tB, 'POST', '/mein-partner/senden', { object_ids: [bPark] });

  /* Anmerkungen am Stand 1 der Lindenallee, zurueck an Kunden */
  let st = (await http(tP, 'GET', '/partner/kundenstaende')).j.kundenstaende || [];
  const ksL = st.find((x) => x.kunde_email === A.email && x.str === 'Lindenallee');
  if (!ksL) { console.error('Kundenstand Lindenallee fehlt'); process.exit(1); }
  await http(tP, 'POST', '/partner/kundenstaende/' + ksL.share_id + '/geoeffnet');
  const lkp = (await query(`SELECT data->>'kp' AS kp, data->>'nkm' AS nkm FROM objects WHERE id = $1`, [aLinden])).rows[0];
  const an1 = await http(tP, 'POST', '/partner/kundenstaende/' + ksL.share_id + '/anmerkungen', { art: 'pruefen', sec: 's1', reiter: 'Investition', feld_id: 'kp', feld_label: 'Kaufpreis',
    wert_damals: lkp.kp, vorschlag: String(Math.round(Number(lkp.kp) * 0.95 / 5000) * 5000), text: 'Der Kaufpreis liegt über dem Marktwert. Bitte vor dem Bankgespräch den Verhandlungsspielraum prüfen.' });
  const an2 = await http(tP, 'POST', '/partner/kundenstaende/' + ksL.share_id + '/anmerkungen', { art: 'pruefen', sec: 's2', reiter: 'Miete', feld_id: 'nkm', feld_label: 'Nettokaltmiete',
    wert_damals: lkp.nkm, text: 'Bitte die Mieten mit den Mietverträgen abgleichen, vor allem Wohnung 3 und 6.' });
  await http(tP, 'POST', '/partner/kundenstaende/' + ksL.share_id + '/anmerkungen', { art: 'nachreichen', text: 'Bitte das Protokoll der Eigentümerversammlung 2023 nachreichen.' });
  const zr = await http(tP, 'POST', '/partner/kundenstaende/' + ksL.share_id + '/zurueck', { text: 'Hallo Jonas, drei Punkte vor dem Bankgespräch. Viele Grüße, Lena Nordmann (Demo)' });
  console.log('Zurueck an Kunden', zr.status, zr.j && zr.j.mail && zr.j.mail.status);
  /* Kunde A beantwortet die zweite, die anderen bleiben offen; dann sendet er Stand 2 */
  if (an2.j && an2.j.id) await http(tA, 'POST', '/mein-partner/anmerkungen/' + an2.j.id, { status: 'erledigt', antwort: 'Abgeglichen, die Mieten stimmen mit den Verträgen überein.' });
  await http(tA, 'POST', '/mein-partner/senden', { object_ids: [aLinden] });
  /* Entwurf des Partners am Stand 2 (noch nicht zurueckgegeben) */
  await http(tP, 'POST', '/partner/kundenstaende/' + ksL.share_id + '/anmerkungen', { art: 'hinweis', sec: 's3', reiter: 'Finanzierung',
    text: 'Für die Bank bitte auch eine Zinsbindung über 15 Jahre durchrechnen.' });

  /* Aufgabe an alle: Steuerjahr */
  await http(tP, 'POST', '/partner/aufgaben', { titel: 'Unterlagen für das Steuerjahr 2025', art: 'steuerjahr', steuerjahr: 2025, objektfilter: 'bestand',
    text: 'Bitte die Bestandsobjekte mit den Zahlen für 2025 senden.', kunden: 'alle' });

  /* Ein wenig Zeit zwischen den Schritten, damit die Liste wie ein echter Verlauf aussieht */
  await query(`UPDATE object_shares SET submitted_at = submitted_at - interval '2 days' WHERE reseller_id = $1 AND client_id = $2`, [rs.id, kB.id]);
  await query(`UPDATE partner_meldungen SET gelesen_am = now() - interval '1 day' WHERE reseller_id = $1 AND art = 'gesendet'`, [rs.id]);

  st = (await http(tP, 'GET', '/partner/kundenstaende')).j.kundenstaende || [];
  c = await http(tP, 'GET', '/partner/cockpit');
  console.log('Kunden', JSON.stringify(c.j.kunden.filter((x) => !x.getrennt_am).map((x) => ({ n: x.display_name, art: x.platz_art, platz: x.hat_platz, gesendet: x.sendungen, mail: x.mail_rueckmeldung }))));
  console.log('Anfragen offen', (c.j.anfragen || []).filter((a) => a.status === 'offen').length, '· Kundenstaende', st.length, st.map((x) => x.str + ' S' + x.stand_nr).join(', '));
  console.log('Pool', JSON.stringify(await resellerService.getPool(rs.id)));
  tokens();
  console.log('Tokens in /tmp/partner-demo-tokens.json (3 h)');
  process.exit(0);
})().catch((e) => { console.error('FEHLER', e.stack || e.message); process.exit(1); });
