'use strict';
/**
 * tools/partner-kunden-live.js · v3357 — NUR STAGING, laeuft IM Backend-Container:
 *   docker cp tools/partner-kunden-live.js dealpilot-backend:/app/partner-kunden-live.js
 *   docker exec -e PK_PARTNER_EMAIL=info@junker-immobilien.io dealpilot-backend node /app/partner-kunden-live.js
 *
 * Legt (idempotent) zwei Testkunden an und prueft den ganzen Weg ueber HTTP mit echten Tokens:
 *   K1 „Testkunde Partnerplatz“  (Platz mitgeben)     -> bleibt verbunden, fuer Marcels Test
 *   K2 „Testkunde Durchlauf“     (eigener Plan)       -> Code, Anfrage, Senden, neuer Stand, Zurueckziehen, Trennen
 * Testadressen enden auf .test (nie per SMTP). Passwoerter werden zufaellig erzeugt und NUR beim ersten Anlegen
 * ausgegeben (Datei schreibt der Aufrufer).
 */
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');
const jwt = require('./src/utils/jwt');
const objectService = require('./src/services/objectService');

if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '') && process.env.PK_ERZWINGEN !== '1') {
  console.error('ABBRUCH: nur auf Staging (APP_URL enthaelt kein „staging“).'); process.exit(2);
}
const BASIS = 'http://localhost:' + (process.env.PORT || 3000) + '/api/v1';
let n = 0, rot = 0;
const ok = (was, b, ist) => { n++; if (!b) rot++; console.log((b ? '  ok  ' : '  ROT ') + was + (ist !== undefined ? ' → ' + (typeof ist === 'string' ? ist : JSON.stringify(ist)) : '')); };

async function http(token, methode, pfad, body) {
  const r = await fetch(BASIS + pfad, { method: methode, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
const tokenFuer = (u) => jwt.signKurz({ userId: u.id, email: u.email }, '30m');

async function kunde(email, name) {
  let u = (await query('SELECT id, email, name FROM users WHERE email = $1', [email])).rows[0], pw = null;
  if (!u) {
    pw = crypto.randomBytes(9).toString('base64url');
    u = await userService.createUser({ email, plainPassword: pw, name, newsletter: false });
  }
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [u.id]);
  return { u, pw };
}

(async () => {
  const pEmail = process.env.PK_PARTNER_EMAIL || 'info@junker-immobilien.io';
  const partner = (await query('SELECT id, email, name FROM users WHERE email = $1', [pEmail])).rows[0];
  if (!partner) { console.error('Partnerkonto fehlt: ' + pEmail); process.exit(2); }
  const tP = tokenFuer(partner);
  const k1 = await kunde('kunde-partnerplatz@partner-pruefung.dealpilot.test', 'Testkunde Partnerplatz');
  const k2 = await kunde('kunde-durchlauf@partner-pruefung.dealpilot.test', 'Testkunde Durchlauf');
  const t1 = tokenFuer(k1.u), t2 = tokenFuer(k2.u);
  if (k1.pw || k2.pw) console.log('ZUGANG ' + JSON.stringify({ k1: k1.pw ? { email: k1.u.email, passwort: k1.pw } : null, k2: k2.pw ? { email: k2.u.email, passwort: k2.pw } : null }));

  /* Testobjekte fuer K1: zwei Objekte des Partners als Kopie (nur Staging) */
  const anz = (await query('SELECT count(*)::int AS n FROM objects WHERE user_id = $1 AND kunden_freigabe_id IS NULL', [k1.u.id])).rows[0].n;
  if (anz < 2) {
    const q = (await query(`SELECT id FROM objects WHERE user_id = $1 AND kunden_freigabe_id IS NULL AND (data::jsonb->>'str') IS NOT NULL ORDER BY updated_at DESC LIMIT 2`, [partner.id])).rows;
    for (const x of q) {
      const o = await objectService.getById(partner.id, x.id);
      const d = typeof o.data === 'string' ? JSON.parse(o.data) : o.data; delete d._obj_seq; delete d._kundenstand; d.halter = '';
      await objectService.create(k1.u.id, { data: d, aiAnalysis: null, photos: [] });
    }
  }
  const objK1 = (await query('SELECT id, name FROM objects WHERE user_id = $1 AND kunden_freigabe_id IS NULL ORDER BY created_at', [k1.u.id])).rows;
  ok('K1 hat Testobjekte', objK1.length >= 1, objK1.length);

  /* ── K1: Einladung mit Platz, bestaetigen ── */
  let c = await http(tP, 'GET', '/partner/cockpit');
  ok('Partner-Cockpit 200', c.status === 200, c.status);
  let k1c = c.j && c.j.kunden.filter((k) => k.email === k1.u.email && !k.getrennt_am)[0];
  if (!k1c) {
    const e = await http(tP, 'POST', '/partner/einladen', { email: k1.u.email, name: 'Testkunde Partnerplatz', platz_mitgeben: true });
    ok('Einladung bestehendes Konto = Anfrage', e.status === 200 && e.j.art === 'anfrage', e.j);
    const m = await http(t1, 'GET', '/mein-partner');
    ok('Kunde sieht die Anfrage', m.status === 200 && m.j.anfragen.length === 1, m.j && m.j.anfragen && m.j.anfragen.length);
    const a = await http(t1, 'POST', '/mein-partner/anfragen/' + m.j.anfragen[0].id, { annehmen: true });
    ok('Kunde bestaetigt, Partnerplatz', a.status === 200 && a.j.platz_art === 'platz', a.j);
    c = await http(tP, 'GET', '/partner/cockpit');
    k1c = c.j.kunden.filter((k) => k.email === k1.u.email && !k.getrennt_am)[0];
  }
  ok('K1 verbunden mit Platz', !!k1c && k1c.platz_art === 'platz', k1c && { art: k1c.platz_art, platz: k1c.hat_platz });
  const mp1 = await http(t1, 'GET', '/mein-partner');
  ok('K1 sieht Partner und Stufe', mp1.j.verbunden && !!mp1.j.verbunden.partner_name, mp1.j.verbunden && mp1.j.verbunden.stufe_text);

  /* Rechte setzen und wirken lassen */
  const r = await http(tP, 'PUT', '/partner/kunden/' + k1c.id, { stufe: 2, rechte: { pdf: true, markt: true, ki: true, senden: true }, kontingent: { marktbericht: 3 }, netzwerk: false, marke: 'partner' });
  ok('Stufe und Rechte speichern', r.status === 200, r.status);
  const nw = await http(t1, 'GET', '/network-cards');
  ok('Partnernetzwerk beim Platzkunden aus', nw.status === 200 && nw.j.partner_aus === true && nw.j.cards.length === 0, nw.j && nw.j.partner_aus);

  /* Senden eines Objekts */
  const s1 = await http(t1, 'POST', '/mein-partner/senden', { object_ids: [objK1[0].id] });
  ok('K1 sendet ein Objekt', s1.status === 200 && s1.j.gesendet === 1, s1.j);
  const st = await http(tP, 'GET', '/partner/kundenstaende');
  const meins = (st.j.kundenstaende || []).filter((x) => x.client_id === k1c.id);
  ok('Partner sieht den Kundenstand', meins.length >= 1, meins.length);
  const liste = await http(tP, 'GET', '/objects');
  const items = (liste.j && (liste.j.items || liste.j)) || [];
  ok('Kundenstand NICHT in der Objektliste des Partners', !items.some((x) => meins.some((m) => m.kopie_object_id === x.id)));
  const put = await http(tP, 'PUT', '/objects/' + meins[0].kopie_object_id, { data: { str: 'x' } });
  ok('Kundenstand schreibgeschuetzt', put.status === 409, put.status);

  /* Aufgabe an K1 */
  const ag = await http(tP, 'POST', '/partner/aufgaben', { art: 'steuerjahr', titel: 'Steuerjahr 2025 fertigstellen (Test)', text: 'Bitte die Bestandsobjekte für 2025 fertig machen und senden.', steuerjahr: 2025, objektfilter: 'alle', kunden: [k1c.id] });
  ok('Aufgabe angelegt', ag.status === 200 && ag.j.kunden_anzahl === 1, ag.j && ag.j.kunden_anzahl);
  const mp1b = await http(t1, 'GET', '/mein-partner');
  ok('K1 sieht die Aufgabe', (mp1b.j.aufgaben || []).some((x) => x.id === ag.j.id));

  /* ── K2: Code, eigener Plan, ganzer Durchlauf ── */
  await http(t2, 'POST', '/mein-partner/trennen');   /* falls von einem frueheren Lauf verbunden */
  const cd = await http(t2, 'POST', '/mein-partner/code');
  ok('K2 erzeugt Code', cd.status === 200 && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(cd.j.code), cd.j && cd.j.code && cd.j.code.replace(/./g, '•'));
  const falsch = await http(tP, 'POST', '/partner/code', { code: 'AAAA-AAAA', name: 'x' });
  ok('falscher Code abgewiesen', falsch.status === 404, falsch.status);
  const ein = await http(tP, 'POST', '/partner/code', { code: cd.j.code.toLowerCase(), name: 'Testkunde Durchlauf', platz_mitgeben: false });
  ok('Partner loest Code ein -> Anfrage', ein.status === 200, ein.j);
  const zwei = await http(tP, 'POST', '/partner/code', { code: cd.j.code, name: 'x' });
  ok('Code nur einmal', zwei.status === 404, zwei.status);
  const m2 = await http(t2, 'GET', '/mein-partner');
  const a2 = await http(t2, 'POST', '/mein-partner/anfragen/' + m2.j.anfragen[0].id, { annehmen: true });
  ok('K2 bestaetigt, eigener Plan', a2.status === 200 && a2.j.platz_art === 'eigen', a2.j);
  const c2 = await http(tP, 'GET', '/partner/cockpit');
  const k2c = c2.j.kunden.filter((k) => k.email === k2.u.email && !k.getrennt_am)[0];
  const rs = await http(tP, 'PUT', '/partner/kunden/' + k2c.id, { rechte: { pdf: false } });
  ok('Partner kann beim eigenen Plan keine Rechte setzen', rs.status === 409, rs.status);
  /* K2 braucht ein Objekt */
  let o2 = (await query('SELECT id FROM objects WHERE user_id = $1 AND kunden_freigabe_id IS NULL LIMIT 1', [k2.u.id])).rows[0];
  if (!o2) o2 = await objectService.create(k2.u.id, { data: { str: 'Testweg', hnr: '1', plz: '32049', ort: 'Herford', kp: '200000', objart: 'ETW' }, aiAnalysis: null, photos: [] });
  const sA = await http(t2, 'POST', '/mein-partner/senden', { object_ids: [o2.id] });
  const sB = await http(t2, 'POST', '/mein-partner/senden', { object_ids: [o2.id] });
  ok('erneut senden = Stand 2', sA.status === 200 && sB.j && sB.j.ergebnis[0].stand_nr === (sA.j.ergebnis[0].stand_nr + 1), sB.j && sB.j.ergebnis[0].stand_nr);
  const kopien = (await query('SELECT count(*)::int AS n FROM objects WHERE kunden_freigabe_id = $1', [sB.j.ergebnis[0].share_id])).rows[0].n;
  ok('alte Kopie ersetzt (genau eine)', kopien === 1, kopien);
  const zz = await http(t2, 'POST', '/mein-partner/sendungen/' + sB.j.ergebnis[0].share_id + '/zurueckziehen');
  const rest = (await query('SELECT count(*)::int AS n FROM objects WHERE kunden_freigabe_id = $1', [sB.j.ergebnis[0].share_id])).rows[0].n;
  ok('Zurueckziehen loescht die Kopie', zz.status === 200 && rest === 0, rest);
  const tr = await http(t2, 'POST', '/mein-partner/trennen');
  const m2b = await http(t2, 'GET', '/mein-partner');
  ok('K2 trennt, nicht mehr verbunden', tr.status === 200 && !m2b.j.verbunden);
  const mel = await http(tP, 'GET', '/partner/meldungen');
  ok('Meldungen beim Partner', (mel.j.meldungen || []).length >= 3, (mel.j.meldungen || []).length);

  console.log('\npartner-kunden-live v3357 · ' + n + ' Punkte, ' + (n - rot) + ' gruen, ' + rot + ' rot');
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error('FEHLER', e); process.exit(1); });
