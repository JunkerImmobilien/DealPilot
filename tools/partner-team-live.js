'use strict';
/**
 * tools/partner-team-live.js · v3830 — NUR STAGING, laeuft IM Backend-Container (aufgerufen von
 * tools/partner-kunden-pruefen.mjs --live). Echte HTTP-Wege mit Kurz-Tokens, echte DB (Migration 121).
 *
 * Braucht das Partner-Testkonto aus tools/partner-testkonto-anlegen.js (partner-test@…, Kunde A mit Kundenstand).
 * Prueft Marcels Wuensche vom 19.11.2026:
 *   A  Team: Einladung (Konto vorhanden), Token nur fuer die eingeladene Adresse, Beitritt, Berater sieht das Cockpit,
 *      darf fremde Kunden nicht aendern, Inhaber gibt ihm einen Kunden (berater_id), dann darf er; nur Inhaber laedt ein,
 *      Marke nur Inhaber, Berater liest den Kundenstand (GET /objects/:kopie), uebernimmt in SEIN Konto; Rauswurf gibt
 *      die Kunden an den Inhaber zurueck, danach kein Zugang mehr.
 *   B  Meldungen: Seiten, Sortierung, Filter, einzeln loeschen, fremder Partner 404, gelesene loeschen.
 *   C  Aufgaben: offen nicht loeschbar (409), abgeschlossen mit Zeitpunkt, dann loeschbar; Takt aufraeumen (Trockenlauf).
 *   E  Kunde entfernen: eigener Plan -> Verbindung, Kopien, Freigaben, Meldungen weg, Konto und Original bleiben;
 *      Partnerplatz -> Platz frei, Frist laeuft, Rumpf unsichtbar fuer den Partner, der Kunde sieht die Frist.
 *   F  Objekt einem Kunden zuordnen: Objektliste liefert den Kunden, fremdes Objekt 404, Loesen.
 * Raeumt ab: Testberater, Testkunden, Objekte, Meldungen, Aufgaben, Einladungen. info@ und majunker@ werden nicht beruehrt.
 */
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');
const planService = require('./src/services/planService');
const resellerService = require('./src/services/resellerService');
const objectService = require('./src/services/objectService');
const pk = require('./src/services/partnerKunden');
const T = require('./src/services/partnerTeam');
const jwt = require('./src/utils/jwt');

if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) { console.error('ABBRUCH: nur auf Staging.'); process.exit(2); }
const BASIS = 'http://localhost:' + (process.env.PORT || 3000) + '/api/v1';
let n = 0, rot = 0;
const ok = (was, b, ist) => { n++; if (!b) rot++; console.log((b ? '  ok  ' : '  ROT ') + 'T ' + was + (ist !== undefined && !b ? ' → ' + JSON.stringify(ist).slice(0, 260) : '')); };
async function http(t, m, p, body) {
  const r = await fetch(BASIS + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
const tok = (u) => jwt.signKurz({ userId: u.id, email: u.email }, '20m');
const nutzer = async (e) => (await query('SELECT id, email, name FROM users WHERE email = $1 AND deleted_at IS NULL', [e])).rows[0];
const DOM = '@team-pruefung.dealpilot.test';
async function neuerNutzer(lokal, name) {
  const e = lokal + DOM, alt = await nutzer(e);
  if (alt) { await query('DELETE FROM reseller_clients WHERE user_id = $1', [alt.id]); await query('DELETE FROM reseller_members WHERE user_id = $1', [alt.id]); try { await userService.deleteUser(alt.id); } catch (x) {} }
  const u = await userService.createUser({ email: e, plainPassword: crypto.randomBytes(12).toString('base64url'), name, newsletter: false });
  await query('UPDATE users SET email_verified_at = now() WHERE id = $1', [u.id]);
  return Object.assign(u, { email: e, name });
}

(async () => {
  const P = await nutzer('partner-test@partner-pruefung.dealpilot.test');
  const A = await nutzer('kunde-a@partner-pruefung.dealpilot.test');
  const P2 = await nutzer('partner-test2@partner-pruefung.dealpilot.test');
  if (!P || !A) { console.error('Testkonten fehlen: erst tools/partner-testkonto-anlegen.js'); process.exit(2); }
  const rsP = (await query('SELECT * FROM resellers WHERE owner_user_id = $1', [P.id])).rows[0];
  const tP = tok(P), tP2 = P2 ? tok(P2) : null;
  const weg = { objekte: [], nutzer: [], meldungen: [] };
  const cA = (await query('SELECT * FROM reseller_clients WHERE reseller_id = $1 AND user_id = $2', [rsP.id, A.id])).rows[0];
  const vorA = { berater_id: cA.berater_id, notiz: cA.notiz };

  /* ── A · Team ── */
  ok('Migration 121: Spalten und Tabellen da', (await query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE (table_name, column_name) IN (('resellers','team_plaetze'),('reseller_clients','entfernt_am'),('partner_aufgaben','abgeschlossen_am'))`)).rows[0].n === 3 &&
    (await query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name IN ('partner_team_einladungen','partner_objekt_kunden')`)).rows[0].n === 2);
  ok('Altbestand: jeder Kunde des Testpartners hat einen Betreuer', (await query('SELECT count(*)::int AS n FROM reseller_clients WHERE reseller_id = $1 AND berater_id IS NULL AND entfernt_am IS NULL', [rsP.id])).rows[0].n === 0);
  const BT = await neuerNutzer('berater', 'Bea Beispiel (Test)'); weg.nutzer.push(BT);
  const tB = tok(BT);
  const vor = await http(tB, 'GET', '/partner/cockpit');
  ok('ohne Team und ohne Partner-Plan kein Cockpit (403)', vor.status === 403, vor.status);
  const ein = await http(tP, 'POST', '/partner/team/einladen', { email: BT.email, name: BT.name });
  ok('Inhaber laedt ein (bestehendes Konto)', ein.status === 200 && ein.j.einladung && ein.j.einladung.id, ein.j);
  const ck0 = await http(tP, 'GET', '/partner/cockpit');
  ok('Cockpit des Inhabers: ich = owner, Einladung offen, Teamplaetze 5', ck0.j.ich && ck0.j.ich.rolle === 'owner' && ck0.j.team.einladungen.some((e) => e.email === BT.email) && ck0.j.team.plaetze === 5, ck0.j.team);
  const mp = await http(tB, 'GET', '/mein-partner');
  const te = (mp.j.team_einladungen || [])[0];
  ok('Eingeladener sieht die Einladung unter /mein-partner', te && te.id === ein.j.einladung.id && !!te.partner_name, mp.j.team_einladungen);
  const token = crypto.randomBytes(24).toString('base64url');
  await query('UPDATE partner_team_einladungen SET token_hash = $2 WHERE id = $1', [te.id, T._sha(token)]);
  const tk1 = await http(tB, 'POST', '/mein-partner/team/token', { token });
  const tk2 = await http(tok(A), 'POST', '/mein-partner/team/token', { token });
  const tk3 = await http(tB, 'POST', '/mein-partner/team/token', { token: 'falsch' + token });
  ok('Token: eingeladene Adresse 200, andere Adresse 409, falscher Token 404', tk1.status === 200 && tk1.j.einladung.id === te.id && tk2.status === 409 && tk3.status === 404, [tk1.status, tk2.status, tk3.status]);
  const kunde = await http(tok(A), 'POST', '/mein-partner/team/' + te.id, { annehmen: true });
  ok('fremdes Konto nimmt die Einladung nicht an (404)', kunde.status === 404, kunde.status);
  const an = await http(tB, 'POST', '/mein-partner/team/' + te.id, { annehmen: true });
  ok('Berater tritt bei', an.status === 200 && an.j.angenommen === true, an.j);
  const ckB = await http(tB, 'GET', '/partner/cockpit');
  const kAB = ckB.j && (ckB.j.kunden || []).filter((k) => k.id === cA.id)[0];
  ok('Berater sieht das Cockpit der Kanzlei (Rolle berater, Kunde A sichtbar, darf nicht)', ckB.status === 200 && ckB.j.ich.rolle === 'berater' && ckB.j.partner.id === rsP.id && kAB && kAB.darf === false, [ckB.status, ckB.j && ckB.j.ich, kAB && kAB.darf]);
  const f1 = await http(tB, 'PUT', '/partner/kunden/' + cA.id, { notiz: 'Berater darf nicht' });
  const f2 = await http(tB, 'POST', '/partner/kunden/' + cA.id + '/trennen');
  const f3 = await http(tB, 'POST', '/partner/team/einladen', { email: 'x' + DOM, name: 'X' });
  const f4 = await http(tB, 'PUT', '/reseller/branding', { brand_name: 'Uebernahme' });
  const f5 = await http(tB, 'GET', '/reseller/pool');
  ok('Berater: fremden Kunden aendern/trennen 403, einladen 403, Marke 403, Pool lesen 200', f1.status === 403 && f2.status === 403 && f3.status === 403 && f4.status === 403 && f5.status === 200, [f1.status, f2.status, f3.status, f4.status, f5.status]);
  const zw = await http(tP, 'PUT', '/partner/kunden/' + cA.id, { berater_id: BT.id });
  const f6 = await http(tB, 'PUT', '/partner/kunden/' + cA.id, { notiz: 'Notiz vom Berater (Test)' });
  ok('Inhaber gibt Kunde A an den Berater, dann darf der Berater', zw.status === 200 && zw.j.berater_id === BT.id && f6.status === 200, [zw.status, zw.j && zw.j.berater_id, f6.status]);
  const zfremd = await http(tP, 'PUT', '/partner/kunden/' + cA.id, { berater_id: A.id });
  ok('Betreuer ausserhalb des Teams -> 400', zfremd.status === 400, zfremd.status);
  const st = await http(tB, 'GET', '/partner/kundenstaende');
  const ks = (st.j.kundenstaende || []).filter((x) => x.client_id === cA.id)[0];
  if (ks) {
    const lb = await http(tB, 'GET', '/objects/' + ks.kopie_object_id);
    const lf = tP2 ? await http(tP2, 'GET', '/objects/' + ks.kopie_object_id) : { status: 404 };
    ok('Berater liest den Kundenstand (Kopie beim Inhaber), fremder Partner 404', lb.status === 200 && lb.j.id === ks.kopie_object_id && lf.status === 404, [lb.status, lf.status]);
    const pu = await http(tB, 'PUT', '/objects/' + ks.kopie_object_id, { data: { x: 1 } });
    ok('Berater schreibt den Kundenstand nicht', pu.status >= 400, pu.status);
    const ue = await http(tB, 'POST', '/partner/kundenstaende/' + ks.share_id + '/uebernehmen', { modus: 'neu' });
    if (ue.j && ue.j.object_id) weg.objekte.push([BT.id, ue.j.object_id]);
    const own = ue.j && ue.j.object_id && await objectService.getById(BT.id, ue.j.object_id, { fotos: false });
    const li = await http(tB, 'GET', '/objects?limit=500');
    const zl = (li.j.items || []).filter((x) => x.id === (ue.j && ue.j.object_id))[0];
    ok('Berater uebernimmt in SEIN Konto, als Kundenobjekt (kunde_ziel kunde)', ue.status === 200 && own && zl && zl.kunde_ziel === 'kunde' && zl.kunde_client_id === cA.id, [ue.status, ue.j, zl && zl.kunde_ziel]);
  } else ok('Kunde A hat einen Kundenstand (Testkonto)', false, st.j);

  /* ── B · Meldungen ── */
  for (let i = 0; i < 3; i++) {
    const r = await query(`INSERT INTO partner_meldungen (reseller_id, client_id, art, text, erstellt_am, gelesen_am) VALUES ($1,$2,'test',$3, now() - make_interval(mins => $4::int), $5) RETURNING id`,
      [rsP.id, cA.id, 'TEAMPRUEF Meldung ' + i, 10 - i, i === 0 ? new Date() : null]);
    weg.meldungen.push(r.rows[0].id);
  }
  const m1 = await http(tP, 'GET', '/partner/meldungen?sort=alt&filter=alle&kunde=' + cA.id + '&seite=1&je=2');
  const m2 = await http(tP, 'GET', '/partner/meldungen?sort=neu&filter=ungelesen&kunde=' + cA.id + '&seite=1&je=25');
  const alt = (m1.j.meldungen || []).map((m) => new Date(m.erstellt_am).getTime());
  ok('Meldungen: Seiten (je 2), aelteste zuerst, Zaehlung', m1.status === 200 && m1.j.je === 2 && m1.j.seiten >= 2 && m1.j.gesamt >= 3 && alt.length === 2 && alt[0] <= alt[1], [m1.status, m1.j && { je: m1.j.je, seiten: m1.j.seiten, gesamt: m1.j.gesamt }]);
  ok('Meldungen: Filter ungelesen zeigt keine gelesene', m2.status === 200 && (m2.j.meldungen || []).every((m) => !m.gelesen_am), m2.j && m2.j.meldungen && m2.j.meldungen.length);
  const alt2 = await http(tP, 'GET', '/partner/meldungen');
  ok('Meldungen ohne Angaben wie bisher (Liste)', alt2.status === 200 && Array.isArray(alt2.j.meldungen) && alt2.j.seiten === undefined, Object.keys(alt2.j || {}));
  const d1 = tP2 ? await http(tP2, 'DELETE', '/partner/meldungen/' + weg.meldungen[1]) : { status: 404 };
  const d2 = await http(tP, 'DELETE', '/partner/meldungen/' + weg.meldungen[1]);
  const da = (await query('SELECT count(*)::int AS n FROM partner_meldungen WHERE id = $1', [weg.meldungen[1]])).rows[0].n;
  ok('Meldung loeschen: fremder Partner 404, eigener 200, weg', d1.status === 404 && d2.status === 200 && da === 0, [d1.status, d2.status, da]);
  const gl = await http(tP, 'POST', '/partner/meldungen/gelesene-loeschen');
  const rest = (await query('SELECT count(*)::int AS n FROM partner_meldungen WHERE reseller_id = $1 AND gelesen_am IS NOT NULL', [rsP.id])).rows[0].n;
  const ungel = (await query('SELECT count(*)::int AS n FROM partner_meldungen WHERE id = $1', [weg.meldungen[2]])).rows[0].n;
  ok('Alle gelesenen loeschen: keine gelesene mehr, ungelesene bleibt', gl.status === 200 && gl.j.geloescht >= 1 && rest === 0 && ungel === 1, [gl.j, rest, ungel]);

  /* ── C · Aufgaben ── */
  const au = await http(tP, 'POST', '/partner/aufgaben', { titel: 'TEAMPRUEF Aufgabe', art: 'frei', kunden: [cA.id] });
  const auId = au.j && au.j.id;
  const ad1 = await http(tP, 'DELETE', '/partner/aufgaben/' + auId);
  await http(tP, 'POST', '/partner/aufgaben/' + auId + '/abschliessen');
  const az = (await query('SELECT abgeschlossen_am FROM partner_aufgaben WHERE id = $1', [auId])).rows[0];
  const ad2 = await http(tP, 'DELETE', '/partner/aufgaben/' + auId);
  const ag = (await query('SELECT count(*)::int AS n FROM partner_aufgaben WHERE id = $1', [auId])).rows[0].n;
  ok('Aufgabe: offen loeschen 409, abschliessen setzt den Zeitpunkt, dann loeschen 200', au.status === 200 && ad1.status === 409 && az && az.abgeschlossen_am && ad2.status === 200 && ag === 0, [au.status, ad1.status, !!(az && az.abgeschlossen_am), ad2.status, ag]);
  const tr = await T.aufraeumen({ dryRun: true });
  ok('Takt aufraeumen (Trockenlauf) zaehlt je Art ohne Fehler', ['meldungen_gelesen', 'meldungen_ungelesen', 'aufgaben', 'uebergaben', 'team_einladungen'].every((k) => Number.isInteger(tr[k])), tr);
  const lf = await http(tB, 'GET', '/partner/loeschfristen');
  ok('Loeschfristen lesbar (auch fuer Berater), Entzug 30 Tage', lf.status === 200 && lf.j.werte.entzug_frist_tage === 30 && lf.j.fristen.length >= 8, lf.status);

  /* ── F · Objekt einem Kunden zuordnen ── */
  const eo = await objectService.create(P.id, { data: { str: 'Zuordnungsweg', hnr: '3', plz: '12345', ort: 'Musterstadt', objart: 'ETW', kp: 120000 }, photos: [] });
  weg.objekte.push([P.id, eo.id]);
  const z1 = await http(tP, 'PUT', '/partner/objekte/' + eo.id + '/kunde', { client_id: cA.id });
  const zl1 = ((await http(tP, 'GET', '/objects?limit=500')).j.items || []).filter((x) => x.id === eo.id)[0];
  const z2 = await http(tB, 'PUT', '/partner/objekte/' + eo.id + '/kunde', { client_id: cA.id });
  ok('Zuordnen: Objektliste liefert Kunde und Zuordnung, fremdes Objekt 404', z1.status === 200 && zl1 && zl1.kunde_zuordnung === cA.id && zl1.kunde_client_id === cA.id && !!zl1.kunde_name && zl1.objart === 'ETW' && z2.status === 404, [z1.status, zl1 && [zl1.kunde_zuordnung, zl1.kunde_name, zl1.objart], z2.status]);
  const ckZ = await http(tP, 'GET', '/partner/cockpit');
  ok('Cockpit zaehlt die zugeordneten Objekte je Kunde', ((ckZ.j.kunden || []).filter((k) => k.id === cA.id)[0] || {}).objekte_zugeordnet >= 1);
  const z3 = await http(tP, 'PUT', '/partner/objekte/' + eo.id + '/kunde', { client_id: null });
  ok('Zuordnung loesen', z3.status === 200 && (await query('SELECT count(*)::int AS n FROM partner_objekt_kunden WHERE object_id = $1', [eo.id])).rows[0].n === 0, z3.status);

  /* ── E · Kunde entfernen ── */
  const E = await neuerNutzer('entfernen-eigen', 'Eigen Entferner (Test)'); weg.nutzer.push(E);
  const cE = await resellerService.createClient(rsP.id, { userId: E.id, displayName: 'Eigen Entferner (Test)', beraterId: P.id });
  await query(`UPDATE reseller_clients SET platz_art = 'eigen', verbunden_am = now(), notiz = 'geheim' WHERE id = $1`, [cE.id]);
  const oE = await objectService.create(E.id, { data: { str: 'Entfernweg', hnr: '5', plz: '12345', ort: 'Musterstadt', kp: 99000 }, photos: [] });
  const se = await pk.senden({ id: E.id, email: E.email }, { object_ids: [oE.id] });
  const shE = (await query('SELECT id, kopie_object_id FROM object_shares WHERE client_id = $1', [cE.id])).rows[0];
  await query(`INSERT INTO partner_meldungen (reseller_id, client_id, art, text) VALUES ($1,$2,'test','TEAMPRUEF Entfernen')`, [rsP.id, cE.id]);
  const x1 = await http(tP, 'POST', '/partner/kunden/' + cE.id + '/entfernen', { bestaetigung: 'Falscher Name' });
  const x2 = await http(tP, 'POST', '/partner/kunden/' + cE.id + '/entfernen', { bestaetigung: 'eigen entferner (test)' });
  const restE = (await query(`SELECT (SELECT count(*) FROM reseller_clients WHERE id = $1)::int AS c, (SELECT count(*) FROM object_shares WHERE client_id = $1)::int AS s,
      (SELECT count(*) FROM objects WHERE id = $2)::int AS k, (SELECT count(*) FROM partner_meldungen WHERE client_id = $1)::int AS m,
      (SELECT count(*) FROM objects WHERE id = $3)::int AS orig, (SELECT count(*) FROM users WHERE id = $4 AND deleted_at IS NULL)::int AS konto`, [cE.id, shE && shE.kopie_object_id, oE.id, E.id])).rows[0];
  ok('Entfernen: falscher Name 400', x1.status === 400, x1.status);
  ok('Entfernen (eigener Plan): Verbindung, Kopie, Freigabe, Meldungen weg, Konto und Original bleiben', se.gesendet === 1 && x2.status === 200 && x2.j.frist === false && restE.c === 0 && restE.s === 0 && restE.k === 0 && restE.m === 0 && restE.orig === 1 && restE.konto === 1, [se.gesendet, x2.status, x2.j, restE]);
  const R = await neuerNutzer('entfernen-platz', 'Platz Entferner (Test)'); weg.nutzer.push(R);
  const cR = await resellerService.createClient(rsP.id, { userId: R.id, displayName: 'Platz Entferner (Test)', beraterId: P.id });
  await query(`UPDATE reseller_clients SET platz_art = 'platz', verbunden_am = now() WHERE id = $1`, [cR.id]);
  let platzDa = true; try { await resellerService.assignSeat(rsP.id, cR.id); } catch (e) { platzDa = false; }
  const poolVor = await resellerService.getPool(rsP.id);
  const x3 = await http(tP, 'POST', '/partner/kunden/' + cR.id + '/entfernen', { bestaetigung: 'Platz Entferner (Test)' });
  const poolNach = await resellerService.getPool(rsP.id);
  const zR = (await query('SELECT entfernt_am, entzug_frist_bis, kundennummer, notiz FROM reseller_clients WHERE id = $1', [cR.id])).rows[0];
  const ckR = await http(tP, 'GET', '/partner/cockpit');
  const mpR = await http(tok(R), 'GET', '/mein-partner');
  ok('Entfernen (Partnerplatz): Platz frei, Frist laeuft, Rumpf ohne Kundennummer, unsichtbar im Cockpit, Kunde sieht die Frist',
    platzDa && x3.status === 200 && x3.j.frist === true && poolNach.frei === poolVor.frei + 1 && zR && zR.entfernt_am && zR.entzug_frist_bis && !zR.kundennummer && !(ckR.j.kunden || []).some((k) => k.id === cR.id) && mpR.j.verbunden && !!mpR.j.verbunden.entzug_frist_bis,
    [platzDa, x3.status, x3.j, poolVor.frei, poolNach.frei, zR, mpR.j && mpR.j.verbunden && mpR.j.verbunden.entzug_frist_bis]);

  /* ── A · Rauswurf ── */
  const rw = await http(tP, 'DELETE', '/partner/team/' + BT.id);
  const cA2 = (await query('SELECT berater_id FROM reseller_clients WHERE id = $1', [cA.id])).rows[0];
  const nach = await http(tB, 'GET', '/partner/cockpit');
  ok('Inhaber nimmt den Berater aus dem Team: Kunde A zurueck beim Inhaber, kein Cockpit mehr', rw.status === 200 && rw.j.kunden_an_inhaber >= 1 && String(cA2.berater_id) === String(P.id) && nach.status === 403, [rw.status, rw.j, cA2, nach.status]);

  /* ── Aufraeumen ── */
  for (const [u, id] of weg.objekte) { try { await objectService.deleteObject(u, id); } catch (e) { await query('DELETE FROM objects WHERE id = $1', [id]).catch(() => {}); } }
  await query('DELETE FROM partner_meldungen WHERE id = ANY($1::uuid[]) OR text LIKE $2', [weg.meldungen, 'TEAMPRUEF%']);
  await query('DELETE FROM partner_aufgaben WHERE reseller_id = $1 AND titel LIKE $2', [rsP.id, 'TEAMPRUEF%']);
  await query('UPDATE reseller_clients SET berater_id = $2, notiz = $3 WHERE id = $1', [cA.id, vorA.berater_id || P.id, vorA.notiz]);
  for (const u of weg.nutzer) {
    await query('DELETE FROM objects WHERE kunden_freigabe_id IN (SELECT s.id FROM object_shares s JOIN reseller_clients c ON c.id = s.client_id WHERE c.user_id = $1)', [u.id]);
    await query('DELETE FROM reseller_clients WHERE user_id = $1', [u.id]);
    await query('DELETE FROM reseller_members WHERE user_id = $1', [u.id]);
    await query('DELETE FROM partner_team_einladungen WHERE lower(email) = lower($1)', [u.email]);
    try { await userService.deleteUser(u.id); } catch (e) { console.error('Testnutzer', e.message); }
  }
  await query(`UPDATE licenses SET client_id = NULL, status = 'pool', assigned_at = NULL WHERE reseller_id = $1 AND client_id IS NULL AND status = 'zugewiesen'`, [rsP.id]);
  const restN = (await query(`SELECT count(*)::int AS n FROM users WHERE email LIKE $1 AND deleted_at IS NULL`, ['%' + DOM])).rows[0].n;
  const restO = (await query('SELECT count(*)::int AS n FROM objects WHERE id = ANY($1::uuid[])', [weg.objekte.map((x) => x[1])])).rows[0].n;
  ok('aufgeraeumt (Testnutzer, Objekte, Kunde A wie vorher)', restN === 0 && restO === 0, [restN, restO]);
  console.log(`LIVE ${n} Punkte, ${rot} rot`);
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); console.log(`LIVE ${n} Punkte, ${rot + 1} rot`); process.exit(1); });
