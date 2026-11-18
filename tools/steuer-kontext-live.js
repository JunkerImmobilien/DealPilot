'use strict';
/**
 * tools/steuer-kontext-live.js · v3700 — NUR STAGING, laeuft IM Backend-Container (aufgerufen von
 * tools/steuer-kontext-mappe-test.mjs). Paket P2: Steuerprofil des Kunden beim Partner.
 *
 *   node /app/steuer-kontext-live.js einrichten   Kunden-Testkonto steuer-kunde@partner-pruefung.dealpilot.test als KOPIE
 *                                                  des Steuer-Mappe-Testkontos (Objekte, Steuerzeitraeume, Mandanten,
 *                                                  Browser-Vorgaben, Snapshots, Steuersaetze; Kennungen umgeschrieben),
 *                                                  mit partner-test verbunden (Freigabe dauerhaft mit Steuerdaten),
 *                                                  dem Partner eine ABWEICHENDE Steuer gegeben (Zeitraum 2015 bis offen,
 *                                                  zvE 250.000, Einzel, 9 % KiSt) - leckt der Kontext, weichen die Zahlen ab.
 *                                                  Tokens (2 h) nach /tmp/sk-tokens.json.
 *   node /app/steuer-kontext-live.js pruefen      Serverseite nach dem Senden: Fassungen, _steuerbasis in jeder Kopie,
 *                                                  Uebernehmen kunde/eigen, Verlustverrechnung, Steuer-Mappe-Saetze je Kunde
 *   node /app/steuer-kontext-live.js freigabe <art> <steuerdaten 0|1>   Freigabe des Testkunden setzen
 *   node /app/steuer-kontext-live.js abraeumen    Testkunde, Verbindung, Kopien, uebernommene Objekte, Partner-Zeitraum weg
 *
 * Das Steuer-Mappe-Testkonto steuer-mappe@steuer-pruefung.dealpilot.test wird NUR GELESEN (Pruefmassstab fuer den
 * Kanzleitermin am 19.11.).
 */
const fs = require('fs');
const crypto = require('crypto');
const { query } = require('./src/db/pool');
const userService = require('./src/services/userService');
const planService = require('./src/services/planService');
const resellerService = require('./src/services/resellerService');
const objectService = require('./src/services/objectService');
const F = require('./src/services/partnerFreigaben');
const jwt = require('./src/utils/jwt');

if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) { console.error('ABBRUCH: nur auf Staging.'); process.exit(2); }
const QUELLE = 'steuer-mappe@steuer-pruefung.dealpilot.test';
const KUNDE = 'steuer-kunde@partner-pruefung.dealpilot.test';
const PARTNER = 'partner-test@partner-pruefung.dealpilot.test';
const MARKE_ZR = 'v3700-gegenprobe';   /* reason des Partner-Zeitraums */
const BASIS = 'http://localhost:' + (process.env.PORT || 3000) + '/api/v1';
const nutzer = async (e) => (await query('SELECT id, email, name FROM users WHERE email = $1 AND deleted_at IS NULL', [e])).rows[0];
const tok = (u, d) => jwt.signKurz({ userId: u.id, email: u.email, name: u.name }, d || '2h');
let n = 0, rot = 0;
const ok = (was, b, ist) => { n++; if (!b) rot++; console.log((b ? '  ok  ' : '  ROT ') + was + (ist !== undefined && !b ? ' → ' + JSON.stringify(ist).slice(0, 300) : '')); };
async function http(t, m, p, body) {
  const r = await fetch(BASIS + p, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
async function rsVon(P) { return (await query('SELECT id FROM resellers WHERE owner_user_id = $1', [P.id])).rows[0]; }
async function verbindung(K) { return (await query('SELECT * FROM reseller_clients WHERE user_id = $1 AND getrennt_am IS NULL ORDER BY created_at DESC LIMIT 1', [K.id])).rows[0]; }

async function abraeumen() {
  const P = await nutzer(PARTNER), K = await nutzer(KUNDE);
  if (P) await query(`DELETE FROM tax_periods WHERE user_id = $1 AND reason = $2`, [P.id, MARKE_ZR]);
  if (K) {
    const cs = (await query('SELECT id FROM reseller_clients WHERE user_id = $1', [K.id])).rows.map((x) => x.id);
    if (cs.length && P) {
      await query(`DELETE FROM objects WHERE kunden_freigabe_id IN (SELECT id FROM object_shares WHERE client_id = ANY($1::uuid[]))`, [cs]);
      await query(`DELETE FROM objects WHERE user_id = $1 AND kunden_freigabe_id IS NULL AND data::jsonb->'_von_kunde'->>'client_id' = ANY($2::text[])`, [P.id, cs]);
    }
    await query('DELETE FROM reseller_clients WHERE user_id = $1', [K.id]);
    try { await userService.deleteUser(K.id); } catch (e) { console.error('Testkunde', e.message); }
  }
  console.log('abgeraeumt');
}

async function einrichten() {
  const Q = await nutzer(QUELLE), P = await nutzer(PARTNER);
  if (!Q || !P) { console.error('Konten fehlen (Steuer-Mappe-Testkonto, partner-test)'); process.exit(2); }
  await abraeumen();
  const K = await userService.createUser({ email: KUNDE, plainPassword: crypto.randomBytes(18).toString('base64url'), name: 'Steuerkunde Muster (Test)', newsletter: false });
  await query('UPDATE users SET email_verified_at = now() WHERE id = $1', [K.id]);
  await planService.setUserPlanManual(K.id, 'pro', 'yearly', 30);
  /* Objekte kopieren, Kennungen abbilden */
  const quelle = (await query(`SELECT id, data, ai_analysis FROM objects WHERE user_id = $1 AND kunden_freigabe_id IS NULL ORDER BY created_at`, [Q.id])).rows;
  const map = {};
  for (const o of quelle) {
    const d = typeof o.data === 'string' ? JSON.parse(o.data) : o.data;
    const neu = await objectService.create(K.id, { data: Object.assign({}, d, { _obj_seq: undefined }), aiAnalysis: o.ai_analysis || null, photos: [] });
    map[o.id] = neu.id;
  }
  const ersetzen = (txt) => Object.keys(map).reduce((s, a) => s.split(a).join(map[a]), txt);
  for (const qid of Object.keys(map)) {
    const r = (await query('SELECT data FROM objects WHERE id = $1', [map[qid]])).rows[0];
    await query('UPDATE objects SET data = $2::jsonb, created_at = (SELECT created_at FROM objects WHERE id = $3) WHERE id = $1', [map[qid], ersetzen(JSON.stringify(r.data)), qid]);
  }
  await query(`INSERT INTO tax_periods (user_id, valid_from, valid_to, zve, reason, note, splitting, kirchensteuer)
               SELECT $2, valid_from, valid_to, zve, reason, note, splitting, kirchensteuer FROM tax_periods WHERE user_id = $1`, [Q.id, K.id]);
  for (const s of (await query(`SELECT schluessel, wert FROM user_settings WHERE user_id = $1 AND schluessel IN ('mandanten','browser_vorgaben','stammdaten','bwk_profil')`, [Q.id])).rows) {
    let w = ersetzen(JSON.stringify(s.wert)).split(Q.id).join(K.id);
    await query(`INSERT INTO user_settings (user_id, schluessel, wert) VALUES ($1,$2,$3::jsonb) ON CONFLICT (user_id, schluessel) DO UPDATE SET wert = EXCLUDED.wert`, [K.id, s.schluessel, w]);
  }
  for (const s of (await query(`SELECT object_id, wk_per_year, source FROM tax_snapshots WHERE user_id = $1`, [Q.id])).rows) {
    if (!map[s.object_id]) continue;
    await query(`INSERT INTO tax_snapshots (object_id, user_id, wk_per_year, source) VALUES ($1,$2,$3::jsonb,$4) ON CONFLICT DO NOTHING`, [map[s.object_id], K.id, JSON.stringify(s.wk_per_year), s.source]);
  }
  const spalten = (await query(`SELECT string_agg(column_name, ',') AS s FROM information_schema.columns WHERE table_schema='public' AND table_name='tax_records' AND column_name NOT IN ('id','user_id','object_id','created_at','updated_at')`)).rows[0].s;
  for (const qid of Object.keys(map)) {
    await query(`INSERT INTO tax_records (user_id, object_id, ${spalten}) SELECT $2, $3, ${spalten} FROM tax_records WHERE user_id = $1 AND object_id = $4`, [Q.id, K.id, map[qid], qid]);
  }
  /* verbinden mit Freigabe dauerhaft (Steuer + Steuerdaten) */
  const rs = await rsVon(P);
  const c = await resellerService.createClient(rs.id, { userId: K.id, displayName: 'Steuerkunde Muster (Test)' });
  await F.setzen(c.id, K.id, F.freigabeSauber({ art: 'dauer', bereiche: { steuer: true, steuerdaten: true } }), 'mein_partner');
  /* Partner bekommt eine eigene, abweichende Steuer */
  await query(`INSERT INTO tax_periods (user_id, valid_from, valid_to, zve, reason, splitting, kirchensteuer) VALUES ($1,'2015-01-01',NULL,250000,$2,false,9)`, [P.id, MARKE_ZR]);
  fs.writeFileSync('/tmp/sk-tokens.json', JSON.stringify({
    kunde: { id: K.id, email: K.email, name: K.name, t: tok(K) }, partner: { id: P.id, email: P.email, name: P.name, t: tok(P) },
    client_id: c.id, objekte: map }));
  console.log('eingerichtet: ' + Object.keys(map).length + ' Objekte, Verbindung ' + c.id);
}

async function freigabe(art, sd) {
  const K = await nutzer(KUNDE); const c = await verbindung(K);
  await F.setzen(c.id, K.id, F.freigabeSauber({ art, bereiche: { steuer: true, steuerdaten: sd === '1' } }), 'mein_partner');
  console.log('freigabe ' + art + ' steuerdaten ' + sd);
}

async function pruefen() {
  const P = await nutzer(PARTNER), K = await nutzer(KUNDE), T = JSON.parse(fs.readFileSync('/tmp/sk-tokens.json', 'utf8'));
  const c = await verbindung(K), tP = tok(P, '20m'), tK = tok(K, '20m');
  const fv = (await query('SELECT * FROM partner_steuerprofile WHERE client_id = $1 ORDER BY fassung', [c.id])).rows;
  ok('Steuerprofil als Fassung abgelegt, genau eine gilt', fv.length >= 1 && fv.filter((x) => !x.ersetzt_am).length === 1, fv.map((x) => [x.fassung, !!x.ersetzt_am]));
  const p = fv[fv.length - 1].profil;
  ok('Profil traegt ALLE Steuerzeitraeume des Kunden', p.zeitraeume.length === 2 && p.zeitraeume[0].zve === 120000 && p.zeitraeume[1].zve === 140000 && p.zeitraeume[0].splitting === true, p.zeitraeume);
  ok('Profil traegt Veranlagung und Kirchensteuer aus dem Investmentprofil des Kunden', p.angaben && p.angaben.splitting === false && p.angaben.kirchensteuer === 0, p.angaben);
  ok('Profil traegt die Gesellschaft mit Regime, Hebesatz, erweiterter Kuerzung und Kosten', p.mandanten.some((m) => m.id === 'mtest-steuer-gmbh' && m.regime.gewst === 450 && m.regime.erw_kuerzung === true && m.kosten && m.kosten['2026']));
  ok('Profil traegt die Ueberfuehrungen mit Stichtag und Gruppe-Verweis', (p.ueberfuehrungen || []).length === 2 && p.ueberfuehrungen.every((u) => u.halter === 'mtest-steuer-gmbh' && /^\d{4}-\d{2}-\d{2}$/.test(u.stichtag || '') && u.privat_id), p.ueberfuehrungen);
  ok('Profil traegt die Saldo-Grundlage (Snapshots der Bestandsobjekte), keine Daten des Partners', (p.bestand || []).length >= 2 && p.bestand.every((o) => Object.values(T.objekte).indexOf(o.id) >= 0), (p.bestand || []).map((o) => o.id));
  ok('Plan des Kunden (pro) im Profil', p.pro === true);
  const sh = (await query(`SELECT s.*, o.data AS kd FROM object_shares s JOIN objects o ON o.id = s.kopie_object_id WHERE s.client_id = $1 AND s.status <> 'widerrufen'`, [c.id])).rows;
  ok('jede Kopie traegt _steuerbasis mit Original-Kennung, Halter des Kunden und dieselbe Fassung', sh.length >= 4 && sh.every((s) => s.kd._steuerbasis && s.kd._steuerbasis.orig_id === s.object_id && s.kd._steuerbasis.profil_id === s.steuerprofil_id && s.kd.halter === (s.kd._steuerbasis.halter)), sh.map((s) => [s.kd.halter, !!s.kd._steuerbasis]));
  ok('GmbH-Objekte tragen den Halter des Kunden', sh.filter((s) => s.kd.halter === 'mtest-steuer-gmbh').length === 2);
  /* Partner liest */
  const pr = await http(tP, 'GET', '/partner/kunden/' + c.id + '/steuerprofil');
  ok('Partner liest das Steuerprofil (Reiter Steuer)', pr.status === 200 && pr.j.aktuell && pr.j.aktuell.profil && pr.j.fassungen.length === fv.length, pr.status);
  const P2 = await nutzer('partner-test2@partner-pruefung.dealpilot.test');
  if (P2) { const f2 = await http(tok(P2, '5m'), 'GET', '/partner/kunden/' + c.id + '/steuerprofil'); ok('fremder Partner liest nicht (404)', f2.status === 404, f2.status); }
  const tpP = (await query('SELECT count(*)::int AS n FROM tax_periods WHERE user_id = $1', [P.id])).rows[0].n;
  const msP = (await query(`SELECT wert FROM user_settings WHERE user_id = $1 AND schluessel = 'mandanten'`, [P.id])).rows[0];
  ok('nichts in Steuerzeitraeume oder Mandanten des Partners geschrieben', tpP === 1 && !(msP && JSON.stringify(msP.wert).indexOf('mtest-steuer-gmbh') >= 0), [tpP]);
  /* gleicher Inhalt = keine neue Fassung */
  ok('erneutes Senden mit gleichem Inhalt: keine neue Fassung (siehe Lauf), Fassungen fortlaufend', fv.every((x, i) => x.fassung === i + 1));
  console.log(`LIVE ${n} Punkte, ${rot} rot`);
}

async function uebernehmenPruefen() {
  const P = await nutzer(PARTNER), K = await nutzer(KUNDE);
  const c = await verbindung(K), tP = tok(P, '20m');
  const sh = (await query(`SELECT s.id, s.object_id, o.data AS kd FROM object_shares s JOIN objects o ON o.id = s.kopie_object_id WHERE s.client_id = $1 AND s.status <> 'widerrufen' ORDER BY o.data::jsonb->>'kaufdat'`, [c.id])).rows;
  const gmbh = sh.filter((s) => s.kd.halter === 'mtest-steuer-gmbh');
  const priv = sh.filter((s) => s.kd.halter !== 'mtest-steuer-gmbh' && s.kd._deal_won === true);
  const erg = {};
  for (const s of gmbh.concat(priv)) {
    const r = await http(tP, 'POST', '/partner/kundenstaende/' + s.id + '/uebernehmen', { ziel: 'kunde' });
    erg[s.object_id] = r.j && r.j.object_id;
    const o = await objectService.getById(P.id, r.j.object_id, { fotos: false });
    ok('Uebernehmen fuer den Kunden: _steuerbasis bleibt, Halter des Kunden, Deal-Status des Kunden, Ziel kunde (' + s.kd.str + ' ' + s.kd.halter + ')',
      r.status === 200 && r.j.ziel === 'kunde' && o.data._steuerbasis && o.data.halter === s.kd.halter && o.data._deal_won === s.kd._deal_won && o.data._von_kunde.modus === 'kunde', [r.status, r.j]);
  }
  const ts = await http(tP, 'GET', '/tax-snapshots');
  const ids = (ts.j.snapshots || []).map((x) => x.object_id);
  ok('fuer den Kunden weitergefuehrt: nicht in der Verlustverrechnung des Partners', Object.values(erg).every((id) => ids.indexOf(id) < 0), ids.length);
  /* eigener Bestand: ein Privatobjekt als eigen uebernehmen (neue Kopie), gewinnen, Snapshot schreiben -> zaehlt */
  const s0 = priv[0];
  const e = await http(tP, 'POST', '/partner/kundenstaende/' + s0.id + '/uebernehmen', { ziel: 'eigen', modus: 'neu', halter: 'privat' });
  const oe = await objectService.getById(P.id, e.j.object_id, { fotos: false });
  ok('Uebernehmen in den eigenen Bestand: keine _steuerbasis, kein zve/grenz des Kunden, Halter privat, Deal offen, Ziel eigen',
    e.status === 200 && e.j.ziel === 'eigen' && !oe.data._steuerbasis && !('zve' in oe.data) && !('grenz' in oe.data) && oe.data.halter === 'privat' && !oe.data._deal_won && oe.data._von_kunde.modus === 'eigen', [e.j, Object.keys(oe.data).filter((k) => /zve|grenz|_deal|_steuerbasis/.test(k))]);
  await objectService.update(P.id, e.j.object_id, { data: Object.assign({}, oe.data, { _deal_won: true }), aiAnalysis: null, photos: [] });
  await query(`INSERT INTO tax_snapshots (object_id, user_id, wk_per_year, source) VALUES ($1,$2,'{"2026":-1234}'::jsonb,'v3700-test') ON CONFLICT (object_id) DO UPDATE SET wk_per_year = EXCLUDED.wk_per_year`, [e.j.object_id, P.id]).catch(async () => {
    await query(`DELETE FROM tax_snapshots WHERE object_id = $1`, [e.j.object_id]);
    await query(`INSERT INTO tax_snapshots (object_id, user_id, wk_per_year, source) VALUES ($1,$2,'{"2026":-1234}'::jsonb,'v3700-test')`, [e.j.object_id, P.id]);
  });
  for (const id of Object.values(erg)) {
    await query(`DELETE FROM tax_snapshots WHERE object_id = $1`, [id]);
    await query(`INSERT INTO tax_snapshots (object_id, user_id, wk_per_year, source) VALUES ($1,$2,'{"2026":-999}'::jsonb,'v3700-test')`, [id, P.id]);
  }
  const ts2 = await http(tP, 'GET', '/tax-snapshots');
  const ids2 = (ts2.j.snapshots || []).map((x) => x.object_id);
  ok('eigener Bestand (gewonnen): zaehlt in der Verlustverrechnung des Partners', ids2.indexOf(e.j.object_id) >= 0, ids2.length);
  ok('fuer den Kunden weitergefuehrt, auch mit Snapshot und gewonnen: zaehlt NICHT', Object.values(erg).every((id) => ids2.indexOf(id) < 0));
  const tr = await http(tP, 'GET', '/tax-records?from=2000&to=2100');
  ok('eigene Steuersaetze des Partners ohne fuer den Kunden weitergefuehrte Objekte', (tr.j.records || []).every((r) => Object.values(erg).indexOf(r.object_id) < 0));
  for (const id of Object.values(erg)) await query(`DELETE FROM tax_snapshots WHERE object_id = $1 AND source = 'v3700-test'`, [id]);
  await objectService.deleteObject(P.id, e.j.object_id).catch(() => {});
  fs.writeFileSync('/tmp/sk-weiter.json', JSON.stringify(erg));
  console.log('WEITER ' + JSON.stringify(erg));
  console.log(`LIVE ${n} Punkte, ${rot} rot`);
}

(async () => {
  const a = process.argv[2];
  if (a === 'einrichten') await einrichten();
  else if (a === 'pruefen') await pruefen();
  else if (a === 'uebernehmen') await uebernehmenPruefen();
  else if (a === 'freigabe') await freigabe(process.argv[3], process.argv[4]);
  else if (a === 'abraeumen') await abraeumen();
  else { console.error('einrichten | pruefen | uebernehmen | freigabe <art> <0|1> | abraeumen'); process.exit(2); }
  process.exit(rot ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
