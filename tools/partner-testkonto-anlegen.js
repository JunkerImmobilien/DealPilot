'use strict';
/**
 * tools/partner-testkonto-anlegen.js · v3392 — NUR STAGING, laeuft IM Backend-Container:
 *   docker cp tools/partner-testkonto-anlegen.js dealpilot-backend:/app/partner-testkonto-anlegen.js
 *   docker exec dealpilot-backend node /app/partner-testkonto-anlegen.js
 *
 * Legt (idempotent) ein eigenes Partner-Testkonto an, damit das Partner-Cockpit ohne Marcels Konto
 * (info@) gemessen werden kann:
 *   Partner  partner-test@partner-pruefung.dealpilot.test   Plan partner (manuell, 365 Tage, keine Stripe-Zahlung),
 *            Partnermarke „Muster Finanzberatung (Test)“, 5 Plaetze im Pool (licenses, ohne Stripe)
 *   Kunde A  kunde-a@partner-pruefung.dealpilot.test        Partnerplatz, 2 Testobjekte, eines gesendet (Ankauf)
 *   Kunde B  kunde-b@partner-pruefung.dealpilot.test        eigener Plan per Verbindungscode, 1 Objekt gesendet
 * Erfundene Namen und Adressen. Testadressen enden auf .test (nie per SMTP). info@ wird nicht beruehrt.
 * Passwoerter werden zufaellig erzeugt und NUR beim ersten Anlegen ausgegeben (Zeile ZUGANG, Datei schreibt der Aufrufer).
 */
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');
const planService = require('./src/services/planService');
const resellerService = require('./src/services/resellerService');
const objectService = require('./src/services/objectService');
const jwt = require('./src/utils/jwt');

if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) {
  console.error('ABBRUCH: nur auf Staging (APP_URL enthaelt kein „staging“).'); process.exit(2);
}
const BASIS = 'http://localhost:' + (process.env.PORT || 3000) + '/api/v1';
const PLAETZE = 5;
async function http(token, methode, pfad, body) {
  const r = await fetch(BASIS + pfad, { method: methode, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
const tokenFuer = (u) => jwt.signKurz({ userId: u.id, email: u.email }, '30m');
async function konto(email, name) {
  let u = (await query('SELECT id, email, name FROM users WHERE email = $1', [email])).rows[0], pw = null;
  if (!u) { pw = crypto.randomBytes(9).toString('base64url'); u = await userService.createUser({ email, plainPassword: pw, name, newsletter: false }); }
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [u.id]);
  return { u, pw };
}
async function objekt(userId, d) {
  const da = (await query(`SELECT id FROM objects WHERE user_id = $1 AND kunden_freigabe_id IS NULL AND data::jsonb->>'str' = $2`, [userId, d.str])).rows[0];
  return da || objectService.create(userId, { data: d, aiAnalysis: null, photos: [] });
}

(async () => {
  const P = await konto('partner-test@partner-pruefung.dealpilot.test', 'Partner Test');
  const A = await konto('kunde-a@partner-pruefung.dealpilot.test', 'Anna Testkundin');
  const B = await konto('kunde-b@partner-pruefung.dealpilot.test', 'Bernd Testkunde');
  const zugang = [P, A, B].filter((x) => x.pw).map((x) => ({ email: x.u.email, passwort: x.pw }));
  if (zugang.length) console.log('ZUGANG ' + JSON.stringify(zugang));

  /* Partner: Plan, Marke, Plaetze */
  await planService.setUserPlanManual(P.u.id, 'partner', 'yearly', 365);
  const rs = await resellerService.ensureReseller(P.u.id, { name: 'Muster Finanzberatung (Test)' });
  await query(`UPDATE resellers SET name = $2, brand_name = $2, brand_accent = $3, brand_accent_hi = $4, brand_accent_lo = $5, whitelabel_enabled = true, updated_at = now() WHERE id = $1`,
    [rs.id, 'Muster Finanzberatung (Test)', '#2F6F8F', '#5C97B4', '#1F4F67']);
  const pool = await resellerService.getPool(rs.id);
  if (pool.gekauft < PLAETZE) await resellerService.syncPoolQuantity(rs.id, PLAETZE, { interval: 'yearly' });
  console.log('Pool', JSON.stringify(await resellerService.getPool(rs.id)));
  const tP = tokenFuer(P.u), tA = tokenFuer(A.u), tB = tokenFuer(B.u);

  /* Testobjekte (erfundene Adressen) */
  const a1 = await objekt(A.u.id, { str: 'Lindenweg', hnr: '12', plz: '32052', ort: 'Herford', kp: '245000', objart: 'ETW', wfl: '78', baujahr: '1994' });
  await objekt(A.u.id, { str: 'Am Mühlenbach', hnr: '3', plz: '32049', ort: 'Herford', kp: '389000', objart: 'MFH', wfl: '240', baujahr: '1972' });
  const b1 = await objekt(B.u.id, { str: 'Bergstraße', hnr: '7a', plz: '32120', ort: 'Hiddenhausen', kp: '310000', objart: 'EFH', wfl: '132', baujahr: '1988' });

  /* Kunde A: Einladung mit Platz, bestaetigen, ein Objekt senden */
  let c = await http(tP, 'GET', '/partner/cockpit');
  if (c.status !== 200) { console.error('Cockpit', c.status, c.j); process.exit(1); }
  if (!c.j.kunden.some((k) => k.email === A.u.email && !k.getrennt_am)) {
    const e = await http(tP, 'POST', '/partner/einladen', { email: A.u.email, name: 'Anna Testkundin', platz_mitgeben: true });
    console.log('Einladung A', e.status, e.j && e.j.art);
    const m = await http(tA, 'GET', '/mein-partner');
    const an = (m.j.anfragen || [])[0];
    if (an) console.log('A bestaetigt', (await http(tA, 'POST', '/mein-partner/anfragen/' + an.id, { annehmen: true })).status);
  }
  const sa = await http(tA, 'POST', '/mein-partner/senden', { object_ids: [a1.id] });
  console.log('A sendet', sa.status, sa.j && sa.j.gesendet);

  /* Kunde B: Verbindungscode, eigener Plan, ein Objekt als Bestand senden */
  c = await http(tP, 'GET', '/partner/cockpit');
  if (!c.j.kunden.some((k) => k.email === B.u.email && !k.getrennt_am)) {
    const cd = await http(tB, 'POST', '/mein-partner/code');
    const ein = await http(tP, 'POST', '/partner/code', { code: cd.j && cd.j.code, name: 'Bernd Testkunde', platz_mitgeben: false });
    console.log('Code B', cd.status, ein.status);
    const m = await http(tB, 'GET', '/mein-partner');
    const an = (m.j.anfragen || [])[0];
    if (an) console.log('B bestaetigt', (await http(tB, 'POST', '/mein-partner/anfragen/' + an.id, { annehmen: true })).status);
  }
  const sb = await http(tB, 'POST', '/mein-partner/senden', { object_ids: [b1.id] });
  console.log('B sendet', sb.status, sb.j && sb.j.gesendet);

  c = await http(tP, 'GET', '/partner/cockpit');
  console.log('Kunden', JSON.stringify(c.j.kunden.map((k) => ({ n: k.display_name, art: k.platz_art, platz: k.hat_platz, gesendet: k.sendungen }))));
  const st = await http(tP, 'GET', '/partner/kundenstaende');
  console.log('Kundenstaende', (st.j.kundenstaende || []).length);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
