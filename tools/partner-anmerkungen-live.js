'use strict';
/**
 * tools/partner-anmerkungen-live.js · v3450 — NUR STAGING, laeuft IM Backend-Container (aufgerufen von
 * tools/partner-anmerkungen-pruefen.mjs --live). Echte HTTP-Wege mit echten Tokens.
 *
 * Braucht das Partner-Testkonto aus tools/partner-testkonto-anlegen.js (partner-test@…, Kunde A und B).
 * Legt einen zweiten Testpartner partner-test2@partner-pruefung.dealpilot.test an (fremder Partner fuer die Rechte).
 * Raeumt seine eigenen Anmerkungen, Aufgaben und Meldungen am Ende wieder ab. info@ wird nicht beruehrt.
 */
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');
const planService = require('./src/services/planService');
const resellerService = require('./src/services/resellerService');
const jwt = require('./src/utils/jwt');

if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) { console.error('ABBRUCH: nur auf Staging.'); process.exit(2); }
const BASIS = 'http://localhost:' + (process.env.PORT || 3000) + '/api/v1';
let n = 0, rot = 0;
const ok = (was, b, ist) => { n++; if (!b) rot++; console.log((b ? '  ok  ' : '  ROT ') + was + (ist !== undefined && !b ? ' → ' + JSON.stringify(ist).slice(0, 200) : '')); };
async function http(t, m, p, body) {
  const r = await fetch(BASIS + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
const tok = (u) => jwt.signKurz({ userId: u.id, email: u.email }, '20m');
const nutzer = async (e) => (await query('SELECT id, email FROM users WHERE email = $1', [e])).rows[0];

(async () => {
  const P = await nutzer('partner-test@partner-pruefung.dealpilot.test');
  const A = await nutzer('kunde-a@partner-pruefung.dealpilot.test');
  const B = await nutzer('kunde-b@partner-pruefung.dealpilot.test');
  if (!P || !A || !B) { console.error('Testkonten fehlen: erst tools/partner-testkonto-anlegen.js'); process.exit(2); }
  let P2 = await nutzer('partner-test2@partner-pruefung.dealpilot.test');
  if (!P2) P2 = await userService.createUser({ email: 'partner-test2@partner-pruefung.dealpilot.test', plainPassword: crypto.randomBytes(12).toString('base64url'), name: 'Fremder Testpartner', newsletter: false });
  await planService.setUserPlanManual(P2.id, 'partner', 'yearly', 365);
  /* v3460 · wie partner-testkonto-anlegen.js: ohne bestaetigte Adresse sperrt die Frist (VERIFY_EXPIRED, 403) nach einem Tag
     jeden Aufruf - dann prueft „fremder Partner 404“ die Mailsperre statt der Rechte (gemessen 16.11.2026) */
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [P2.id]);
  await resellerService.ensureReseller(P2.id, { name: 'Fremder Testpartner' });
  const tP = tok(P), tA = tok(A), tB = tok(B), tP2 = tok(P2);
  const neu = { anm: [], aufg: [] };

  /* Kundenstand von A beim Partner */
  const st = await http(tP, 'GET', '/partner/kundenstaende');
  const ks = (st.j.kundenstaende || []).filter((x) => x.kunde_email === A.email)[0];
  ok('Kundenstand von Kunde A vorhanden', !!ks, st.status);
  if (!ks) { console.log(`LIVE ${n} Punkte, ${rot} rot`); process.exit(1); }
  const orig = (await query('SELECT object_id, stand_nr FROM object_shares WHERE id = $1', [ks.share_id])).rows[0];

  /* Anlegen: Feld und frei */
  const a1 = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/anmerkungen', { art: 'pruefen', text: 'Kaufpreis bitte prüfen (Test)', sec: 's1', reiter: 'Investition', feld_id: 'kp', feld_label: 'Kaufpreis', wert_damals: '245000', vorschlag: '239000' });
  ok('Partner legt Feld-Anmerkung an (Entwurf)', a1.status === 200 && a1.j.status === 'entwurf' && a1.j.objekt_id === orig.object_id, a1.j);
  if (a1.j && a1.j.id) neu.anm.push(a1.j.id);
  const a2 = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/anmerkungen', { art: 'nachreichen', text: 'Bitte Teilungserklärung nachreichen (Test)' });
  ok('Partner legt freie Anmerkung an', a2.status === 200 && !a2.j.feld_id, a2.j);
  if (a2.j && a2.j.id) neu.anm.push(a2.j.id);
  const leer = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/anmerkungen', { text: '   ' });
  ok('leerer Text abgewiesen', leer.status === 400, leer.status);

  /* Rechte */
  const f1 = await http(tP2, 'GET', '/partner/kundenstaende/' + ks.share_id + '/anmerkungen');
  ok('fremder Partner liest nicht (404)', f1.status === 404, f1.status);
  const f2 = await http(tP2, 'POST', '/partner/kundenstaende/' + ks.share_id + '/anmerkungen', { text: 'fremd' });
  ok('fremder Partner legt nicht an (404)', f2.status === 404, f2.status);
  const f3 = await http(tP2, 'PUT', '/partner/anmerkungen/' + a1.j.id, { text: 'fremd' });
  const f4 = await http(tP2, 'DELETE', '/partner/anmerkungen/' + a1.j.id);
  ok('fremder Partner aendert/loescht nicht (404)', f3.status === 404 && f4.status === 404, [f3.status, f4.status]);
  const f5 = await http(tP2, 'POST', '/partner/kundenstaende/' + ks.share_id + '/zurueck', {});
  ok('fremder Partner gibt nicht zurueck (404)', f5.status === 404, f5.status);
  const f6 = await http(tA, 'GET', '/partner/kundenstaende/' + ks.share_id + '/anmerkungen');
  ok('Kunde kommt nicht an die Partnerroute', f6.status === 403 || f6.status === 404, f6.status);
  const kv = await http(tA, 'GET', '/mein-partner');
  ok('Entwurf beim Kunden unsichtbar', !(kv.j.aufgaben || []).some((x) => x.art === 'rueckmeldung' && x.anmerkungen_offen > 0 && neu.aufg.includes(x.id)));
  const kd = await http(tA, 'POST', '/mein-partner/anmerkungen/' + a1.j.id, { status: 'erledigt' });
  ok('Kunde kann Entwurf nicht setzen (404)', kd.status === 404, kd.status);
  const geaendert = await http(tP, 'PUT', '/partner/anmerkungen/' + a1.j.id, { text: 'Kaufpreis bitte prüfen, Notar (Test)' });
  ok('Partner aendert Entwurf', geaendert.status === 200 && /Notar/.test(geaendert.j.text), geaendert.status);

  /* Zurueckgeben */
  const z = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/zurueck', { text: 'Zwei Punkte, bitte ansehen (Test)' });
  ok('Zurueck an Kunden: eine Aufgabe mit allen Entwuerfen', z.status === 200 && z.j.anzahl >= 2, z.j);
  if (z.j && z.j.aufgabe_id) neu.aufg.push(z.j.aufgabe_id);
  const z2 = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/zurueck', {});
  ok('ohne neue Entwuerfe kein zweites Zurueck (409)', z2.status === 409, z2.status);
  const nach = await http(tP, 'PUT', '/partner/anmerkungen/' + a1.j.id, { text: 'zu spaet' });
  ok('zurueckgegebene Anmerkung nicht mehr aenderbar (409)', nach.status === 409, nach.status);
  const ag = (await query('SELECT art, share_id, objekt_id, stand_nr FROM partner_aufgaben WHERE id = $1', [z.j.aufgabe_id])).rows[0] || {};
  ok('Aufgabe: Art rueckmeldung, Bezug Kundenstand, Original, Stand', ag.art === 'rueckmeldung' && ag.share_id === ks.share_id && ag.objekt_id === orig.object_id && ag.stand_nr === orig.stand_nr, ag);

  /* Kunde */
  const m = await http(tA, 'GET', '/mein-partner');
  const auf = (m.j.aufgaben || []).filter((x) => x.id === z.j.aufgabe_id)[0];
  ok('Kunde sieht die Rueckmeldung mit Zahlen', !!auf && auf.art === 'rueckmeldung' && auf.anmerkungen >= 2 && auf.anmerkungen_offen >= 2, auf);
  const kl = await http(tA, 'GET', '/mein-partner/aufgaben/' + z.j.aufgabe_id + '/anmerkungen');
  ok('Kunde: Liste fuehrt zu SEINEM Original', kl.status === 200 && kl.j.aufgabe.objekt_id === orig.object_id && kl.j.anmerkungen.length >= 2, kl.j && kl.j.aufgabe);
  ok('Kunde: Feldbezug kommt an (kp, Vorschlag)', kl.j.anmerkungen.some((x) => x.feld_id === 'kp' && x.vorschlag === '239000'));
  const fb = await http(tB, 'GET', '/mein-partner/aufgaben/' + z.j.aufgabe_id + '/anmerkungen');
  const fb2 = await http(tB, 'POST', '/mein-partner/anmerkungen/' + a1.j.id, { status: 'erledigt' });
  ok('anderer Kunde liest/setzt nicht (404)', fb.status === 404 && fb2.status === 404, [fb.status, fb2.status]);

  /* Feldbezug ueberlebt einen neuen Stand */
  const s2 = await http(tA, 'POST', '/mein-partner/senden', { object_ids: [orig.object_id] });
  ok('Kunde sendet Stand ' + (orig.stand_nr + 1), s2.status === 200 && s2.j.ergebnis[0].stand_nr === orig.stand_nr + 1, s2.j);
  const kl2 = await http(tA, 'GET', '/mein-partner/aufgaben/' + z.j.aufgabe_id + '/anmerkungen');
  ok('nach neuem Stand: Anmerkungen mit Feldbezug und altem Stand weiter da', kl2.j.anmerkungen.length === kl.j.anmerkungen.length && kl2.j.anmerkungen.some((x) => x.feld_id === 'kp' && x.stand_nr === orig.stand_nr));
  const pl = await http(tP, 'GET', '/partner/kundenstaende/' + ks.share_id + '/anmerkungen');
  ok('Partner sieht sie am neuen Stand weiter', pl.status === 200 && pl.j.anmerkungen.filter((x) => neu.anm.includes(x.id)).length === neu.anm.length, pl.status);

  /* Erledigen */
  const ids = kl.j.anmerkungen.map((x) => x.id);
  const e1 = await http(tA, 'POST', '/mein-partner/anmerkungen/' + a1.j.id, { status: 'erledigt', antwort: 'Kaufpreis ist verhandelt (Test)' });
  ok('erste erledigt mit Antwort, Rest offen', e1.status === 200 && e1.j.offen === ids.length - 1, e1.j);
  const akz = (await query('SELECT status FROM partner_aufgaben_kunden WHERE aufgabe_id = $1', [z.j.aufgabe_id])).rows[0];
  ok('Aufgabe steht auf in Arbeit', akz && akz.status === 'in_arbeit', akz);
  let letzt = null;
  for (const id of ids.filter((x) => x !== a1.j.id)) letzt = await http(tA, 'POST', '/mein-partner/anmerkungen/' + id, { status: 'erledigt' });
  ok('alle erledigt -> alle_erledigt', letzt && letzt.j.alle_erledigt === true, letzt && letzt.j);
  const ake = (await query('SELECT status FROM partner_aufgaben_kunden WHERE aufgabe_id = $1', [z.j.aufgabe_id])).rows[0];
  ok('Aufgabe erledigt', ake && ake.status === 'erledigt', ake);
  const mel = (await query(`SELECT art FROM partner_meldungen WHERE aufgabe_id = $1`, [z.j.aufgabe_id])).rows.map((x) => x.art);
  ok('Partner hat Meldungen (Antwort, erledigt)', mel.includes('anmerkung_antwort') && mel.includes('aufgabe_erledigt'), mel);
  const wo = await http(tA, 'POST', '/mein-partner/anmerkungen/' + a1.j.id, { status: 'offen' });
  const akw = (await query('SELECT status FROM partner_aufgaben_kunden WHERE aufgabe_id = $1', [z.j.aufgabe_id])).rows[0];
  ok('wieder offen -> Aufgabe wieder in Arbeit', wo.j.offen === 1 && akw.status === 'in_arbeit', [wo.j, akw]);

  /* v3460 · E-Mail bei Rueckmeldung: Schalter je Kunde, echte Route, echte DB. Kunde A hat eine .test-Adresse:
     an -> 'testadresse' (nie ueber SMTP), aus -> 'aus'. Der Schalter wird am Ende auf den Ausgangswert gesetzt. */
  const vorher = (await query('SELECT mail_rueckmeldung FROM reseller_clients WHERE id = $1', [ks.client_id])).rows[0];
  ok('Spalte mail_rueckmeldung da, Vorgabe an', vorher && vorher.mail_rueckmeldung === true, vorher);
  const ck = await http(tP, 'GET', '/partner/cockpit');
  const kz = (ck.j.kunden || []).filter((x) => x.id === ks.client_id)[0];
  ok('Cockpit liefert den Schalter je Kunde', kz && kz.mail_rueckmeldung === true, kz && kz.mail_rueckmeldung);
  const aus = await http(tP, 'PUT', '/partner/kunden/' + ks.client_id, { mail_rueckmeldung: false });
  ok('Partner schaltet die Mail fuer Kunde A aus', aus.status === 200 && aus.j.mail_rueckmeldung === false, aus.j && aus.j.mail_rueckmeldung);
  const ksAus = ((await http(tP, 'GET', '/partner/kundenstaende')).j.kundenstaende || []).filter((x) => x.share_id === ks.share_id)[0];
  ok('Kundenstand traegt den Schalter (Zurueck-Fenster)', ksAus && ksAus.kunde_mail_rueckmeldung === false, ksAus && ksAus.kunde_mail_rueckmeldung);
  const m1 = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/anmerkungen', { art: 'hinweis', text: 'Mailtest aus (Test)' });
  if (m1.j && m1.j.id) neu.anm.push(m1.j.id);
  const zAus = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/zurueck', { text: 'Ohne Mail (Test)' });
  if (zAus.j && zAus.j.aufgabe_id) neu.aufg.push(zAus.j.aufgabe_id);
  ok('Schalter aus: Zurueck gelingt, mail.status aus', zAus.status === 200 && zAus.j.mail && zAus.j.mail.status === 'aus', zAus.j);
  const an = await http(tP, 'PUT', '/partner/kunden/' + ks.client_id, { mail_rueckmeldung: true });
  ok('Partner schaltet sie wieder an', an.status === 200 && an.j.mail_rueckmeldung === true);
  const m2 = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/anmerkungen', { art: 'hinweis', text: 'Mailtest an (Test)' });
  if (m2.j && m2.j.id) neu.anm.push(m2.j.id);
  const zAn = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/zurueck', { text: 'Mit Mail (Test)' });
  if (zAn.j && zAn.j.aufgabe_id) neu.aufg.push(zAn.j.aufgabe_id);
  ok('Schalter an, Testadresse: Zurueck gelingt, keine Mail ueber SMTP (testadresse)', zAn.status === 200 && zAn.j.mail && zAn.j.mail.status === 'testadresse', zAn.j);
  const au = (await query(`SELECT meta FROM share_audit WHERE share_id = $1 AND action = 'rueckmeldung' AND meta->>'aufgabe_id' = ANY($2::text[])`, [ks.share_id, [zAus.j.aufgabe_id, zAn.j.aufgabe_id]])).rows.map((x) => x.meta.mail).sort();
  ok('share_audit fuehrt den Mailstatus', au.join(',') === 'aus,testadresse', au);
  const fremd = await http(tP2, 'PUT', '/partner/kunden/' + ks.client_id, { mail_rueckmeldung: false });
  ok('fremder Partner schaltet nicht (404)', fremd.status === 404, fremd.status);
  await query('UPDATE reseller_clients SET mail_rueckmeldung = $2 WHERE id = $1', [ks.client_id, vorher ? vorher.mail_rueckmeldung : true]);

  /* Aufraeumen: nur was dieser Lauf angelegt hat */
  await query(`DELETE FROM partner_meldungen WHERE aufgabe_id = ANY($1::uuid[])`, [neu.aufg]);
  await query(`DELETE FROM partner_anmerkungen WHERE id = ANY($1::uuid[]) OR aufgabe_id = ANY($2::uuid[])`, [neu.anm, neu.aufg]);
  await query(`DELETE FROM partner_aufgaben WHERE id = ANY($1::uuid[])`, [neu.aufg]);
  const rest = (await query(`SELECT count(*)::int AS n FROM partner_anmerkungen WHERE id = ANY($1::uuid[])`, [neu.anm])).rows[0].n;
  ok('aufgeraeumt', rest === 0, rest);
  console.log(`LIVE ${n} Punkte, ${rot} rot`);
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); console.log(`LIVE ${n} Punkte, ${rot + 1} rot`); process.exit(1); });
