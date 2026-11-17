'use strict';
/**
 * tools/partner-kunden-live.js · v3640 — NUR STAGING, laeuft IM Backend-Container (aufgerufen von
 * tools/partner-kunden-pruefen.mjs --live). Echte HTTP-Wege mit echten Tokens, echte DB (Trigger der Migration 113).
 *
 * Braucht das Partner-Testkonto aus tools/partner-testkonto-anlegen.js (partner-test@…, Kunde A und B, Kunde A hat
 * einen Kundenstand). Prueft:
 *   - Kundennummer: Altbestand hat eine (K-JJJJ-NNN), eindeutig je Partner, neue Verbindung bekommt die naechste
 *     (Trigger), Partner aendert sie, doppelt -> 409, ungueltig -> 400, fremder Partner 404, Kundenstaende/Meldungen
 *     liefern sie, uebernommene Objekte ziehen eine geaenderte Nummer nach.
 *   - Uebernehmen mit Kundenbezug: neu, erneut = aktualisieren (gleiche ID), modus neu = weitere Kopie, Objektliste
 *     liefert kunde_client_id/kunde_nr, Kundenstand zeigt „uebernommen als“.
 * Raeumt ab: angelegte Objekte, Testverbindung und Testnutzer, Kundennummer von Kunde A zurueck. info@ wird nicht beruehrt.
 */
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');
const planService = require('./src/services/planService');
const resellerService = require('./src/services/resellerService');
const objectService = require('./src/services/objectService');
const jwt = require('./src/utils/jwt');

if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) { console.error('ABBRUCH: nur auf Staging.'); process.exit(2); }
const BASIS = 'http://localhost:' + (process.env.PORT || 3000) + '/api/v1';
let n = 0, rot = 0;
const ok = (was, b, ist) => { n++; if (!b) rot++; console.log((b ? '  ok  ' : '  ROT ') + was + (ist !== undefined && !b ? ' → ' + JSON.stringify(ist).slice(0, 220) : '')); };
async function http(t, m, p, body) {
  const r = await fetch(BASIS + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
const tok = (u) => jwt.signKurz({ userId: u.id, email: u.email }, '20m');
const nutzer = async (e) => (await query('SELECT id, email FROM users WHERE email = $1', [e])).rows[0];
const MUSTER = /^K-\d{4}-\d{3,}$/;

(async () => {
  const P = await nutzer('partner-test@partner-pruefung.dealpilot.test');
  const A = await nutzer('kunde-a@partner-pruefung.dealpilot.test');
  const B = await nutzer('kunde-b@partner-pruefung.dealpilot.test');
  if (!P || !A || !B) { console.error('Testkonten fehlen: erst tools/partner-testkonto-anlegen.js'); process.exit(2); }
  let P2 = await nutzer('partner-test2@partner-pruefung.dealpilot.test');
  if (!P2) P2 = await userService.createUser({ email: 'partner-test2@partner-pruefung.dealpilot.test', plainPassword: crypto.randomBytes(12).toString('base64url'), name: 'Fremder Testpartner', newsletter: false });
  await planService.setUserPlanManual(P2.id, 'partner', 'yearly', 365);
  await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [P2.id]);
  await resellerService.ensureReseller(P2.id, { name: 'Fremder Testpartner' });
  const tP = tok(P), tP2 = tok(P2);
  const neuObj = [];
  let tempNutzer = null;

  /* ── Kundennummer ── */
  const ck = await http(tP, 'GET', '/partner/cockpit');
  const kA = (ck.j.kunden || []).filter((k) => k.email === A.email)[0], kB = (ck.j.kunden || []).filter((k) => k.email === B.email)[0];
  ok('Cockpit: Kunde A und B mit Kundennummer im Muster K-JJJJ-NNN', kA && kB && MUSTER.test(kA.kundennummer || '') && MUSTER.test(kB.kundennummer || ''), [kA && kA.kundennummer, kB && kB.kundennummer]);
  const alleNr = (ck.j.kunden || []).map((k) => String(k.kundennummer || '').toLowerCase()).filter(Boolean);
  ok('Kundennummern eindeutig je Partner', new Set(alleNr).size === alleNr.length && alleNr.length === (ck.j.kunden || []).length, alleNr);
  const vorA = kA.kundennummer;

  const rsP = (await query('SELECT id FROM resellers WHERE owner_user_id = $1', [P.id])).rows[0];
  tempNutzer = await nutzer('kn-pruefer@partner-pruefung.dealpilot.test') || await userService.createUser({ email: 'kn-pruefer@partner-pruefung.dealpilot.test', plainPassword: crypto.randomBytes(12).toString('base64url'), name: 'Nummernpruefer', newsletter: false });
  await query('DELETE FROM reseller_clients WHERE user_id = $1', [tempNutzer.id]);   /* Rest eines abgebrochenen Laufs */
  const jahr = new Date().getFullYear();
  const davor = (await query(`SELECT COALESCE(MAX(substring(kundennummer from '^K-[0-9]{4}-([0-9]+)$')::int), 0) AS m FROM reseller_clients WHERE reseller_id = $1 AND kundennummer LIKE $2`, [rsP.id, 'K-' + jahr + '-%'])).rows[0].m;
  const neuC = await resellerService.createClient(rsP.id, { userId: tempNutzer.id, displayName: 'Nummernpruefer (Test)' });
  ok('neue Verbindung bekommt vom Trigger die naechste Nummer des Jahres', neuC.kundennummer === 'K-' + jahr + '-' + String(davor + 1).padStart(3, '0'), [neuC.kundennummer, davor]);

  const u1 = await http(tP, 'PUT', '/partner/kunden/' + kA.id, { kundennummer: 'K-' + jahr + '-950' });
  ok('Partner aendert die Kundennummer von A', u1.status === 200 && u1.j.kundennummer === 'K-' + jahr + '-950', u1.j && u1.j.kundennummer);
  const u2 = await http(tP, 'PUT', '/partner/kunden/' + kA.id, { kundennummer: kB.kundennummer.toLowerCase() });
  ok('Nummer von B (auch klein geschrieben) -> 409 kundennummer_vergeben', u2.status === 409 && u2.j.error === 'kundennummer_vergeben', u2);
  const u3 = await http(tP, 'PUT', '/partner/kunden/' + kA.id, { kundennummer: '  ' });
  const u4 = await http(tP, 'PUT', '/partner/kunden/' + kA.id, { kundennummer: '<b>x</b>' });
  ok('leer oder mit Sonderzeichen -> 400', u3.status === 400 && u4.status === 400, [u3.status, u4.status]);
  const u5 = await http(tP2, 'PUT', '/partner/kunden/' + kA.id, { kundennummer: 'K-' + jahr + '-951' });
  ok('fremder Partner aendert nicht (404)', u5.status === 404, u5.status);
  const neuC2 = await resellerService.createClient(rsP.id, { userId: tempNutzer.id, displayName: 'Nummernpruefer (Test)' });
  ok('bestehende Verbindung erneut anlegen behaelt ihre Nummer', neuC2.kundennummer === neuC.kundennummer, [neuC2.kundennummer, neuC.kundennummer]);

  /* ── Uebernehmen mit Kundenbezug ── */
  const st = await http(tP, 'GET', '/partner/kundenstaende');
  const ks = (st.j.kundenstaende || []).filter((x) => x.kunde_email === A.email)[0];
  ok('Kundenstand von A traegt die (geaenderte) Kundennummer', ks && ks.kunde_nr === 'K-' + jahr + '-950', ks && ks.kunde_nr);
  if (!ks) { console.log(`LIVE ${n} Punkte, ${rot} rot`); process.exit(1); }
  const e1 = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/uebernehmen', { modus: 'neu' });
  if (e1.j && e1.j.object_id) neuObj.push(e1.j.object_id);
  ok('Uebernehmen (neu) legt ein eigenes Objekt an', e1.status === 200 && e1.j.modus === 'neu' && e1.j.object_id, e1.j);
  const o1 = await objectService.getById(P.id, e1.j.object_id, { fotos: false });
  const vk = o1 && o1.data && o1.data._von_kunde;
  ok('Objekt traegt den Kunden (client_id, Name, Kundennummer, Stand)', vk && vk.client_id === ks.client_id && vk.kunde === ks.kunde && vk.kundennummer === 'K-' + jahr + '-950' && vk.stand_nr === ks.stand_nr, vk);
  const e2 = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/uebernehmen', {});
  const o1b = await objectService.getById(P.id, e1.j.object_id, { fotos: false });
  ok('erneut ohne Wahl -> dasselbe Objekt aktualisiert, Objektnummer bleibt', e2.status === 200 && e2.j.modus === 'aktualisiert' && e2.j.object_id === e1.j.object_id && o1b && o1b.data._obj_seq === o1.data._obj_seq, [e2.j, o1b && o1b.data._obj_seq, o1.data._obj_seq]);
  const e3 = await http(tP, 'POST', '/partner/kundenstaende/' + ks.share_id + '/uebernehmen', { modus: 'neu' });
  if (e3.j && e3.j.object_id) neuObj.push(e3.j.object_id);
  ok('modus neu -> weitere Kopie', e3.status === 200 && e3.j.modus === 'neu' && e3.j.object_id !== e1.j.object_id, e3.j);
  const fremd = await http(tP2, 'POST', '/partner/kundenstaende/' + ks.share_id + '/uebernehmen', {});
  ok('fremder Partner uebernimmt nicht (404)', fremd.status === 404, fremd.status);
  const li = await http(tP, 'GET', '/objects?limit=500');
  const lz = (li.j.items || []).filter((x) => neuObj.includes(x.id));
  ok('Objektliste liefert kunde_client_id, kunde_name, kunde_nr', lz.length === 2 && lz.every((x) => x.kunde_client_id === ks.client_id && x.kunde_nr === 'K-' + jahr + '-950' && x.kunde_name === ks.kunde), lz.map((x) => [x.kunde_client_id, x.kunde_nr]));
  const st2 = await http(tP, 'GET', '/partner/kundenstaende');
  const ks2 = (st2.j.kundenstaende || []).filter((x) => x.share_id === ks.share_id)[0] || {};
  ok('Kundenstand zeigt „uebernommen als“ (juengstes Objekt)', ks2.uebernommen_id === e3.j.object_id && !!ks2.uebernommen_seq, [ks2.uebernommen_id, ks2.uebernommen_seq]);
  const u6 = await http(tP, 'PUT', '/partner/kunden/' + kA.id, { kundennummer: 'K-' + jahr + '-951' });
  const o2 = await objectService.getById(P.id, e1.j.object_id, { fotos: false });
  ok('geaenderte Kundennummer zieht in die uebernommenen Objekte nach', u6.status === 200 && o2.data._von_kunde.kundennummer === 'K-' + jahr + '-951', o2 && o2.data._von_kunde);
  const me = await http(tP, 'GET', '/partner/meldungen');
  ok('Meldungen liefern die Kundennummer', (me.j.meldungen || []).some((m) => m.client_id === kA.id ? m.kunde_nr === 'K-' + jahr + '-951' : false) || !(me.j.meldungen || []).some((m) => m.client_id === kA.id), (me.j.meldungen || []).slice(0, 2).map((m) => m.kunde_nr));

  /* ── Aufraeumen ── */
  for (const id of neuObj) { try { await objectService.deleteObject(P.id, id); } catch (e) { console.error('Objekt', id, e.message); } }
  await query('UPDATE reseller_clients SET kundennummer = $2 WHERE id = $1', [kA.id, vorA]);
  await query('DELETE FROM reseller_clients WHERE user_id = $1', [tempNutzer.id]);
  try { await userService.deleteUser(tempNutzer.id); } catch (e) { console.error('Testnutzer', e.message); }
  const rest = (await query('SELECT count(*)::int AS n FROM objects WHERE id = ANY($1::uuid[])', [neuObj])).rows[0].n;
  const nrZ = (await query('SELECT kundennummer FROM reseller_clients WHERE id = $1', [kA.id])).rows[0].kundennummer;
  ok('aufgeraeumt (Objekte weg, Nummer von A zurueck)', rest === 0 && nrZ === vorA, [rest, nrZ]);
  console.log(`LIVE ${n} Punkte, ${rot} rot`);
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); console.log(`LIVE ${n} Punkte, ${rot + 1} rot`); process.exit(1); });
