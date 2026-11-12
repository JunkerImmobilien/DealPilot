'use strict';
/* objekt-uebergabe-pruefen.live.cjs · v3317
   Laeuft IM Container dealpilot-backend auf STAGING (aufgerufen von
   tools/objekt-uebergabe-pruefen.mjs --live, per stdin). Echte Datenbank, echte
   Dienste (objektUebergabe, resellerService, objectService, objektFotos).
   Legt Testkonten unter @uebergabe-pruefer.dealpilot.test an (is_test_user) und
   raeumt alles im finally wieder ab. Ausgabe je Punkt: "OK …" oder "ROT …". */
const crypto = require('crypto');
const { query } = require('/app/src/db/pool');
const U = require('/app/src/services/objektUebergabe');
const reseller = require('/app/src/services/resellerService');
const objectService = require('/app/src/services/objectService');
const ablage = require('/app/src/services/dateiAblage');

if (String(process.env.APP_URL || '').indexOf('staging') < 0) { console.log('ROT nicht Staging (APP_URL) - Abbruch'); console.log('ENDE'); process.exit(1); }

const DOM = '@uebergabe-pruefer.dealpilot.test';
const BASIS = process.env.APP_URL;
const ok = (b, t) => console.log((b ? 'OK ' : 'ROT ') + t);
const info = (t) => console.log('INFO ' + t);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
/* zweites, anderes Bild (andere Pruefsumme) - gleiche Bilder legt objektFotos nur einmal ab */
const PNG2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
async function fehlerVon(fn) { try { await fn(); return null; } catch (e) { return { code: e.message, status: e.status }; } }

const ids = { users: [], resellers: [] };
async function nutzer(kurz, name) {
  const r = await query(`INSERT INTO users (email, password_hash, name, is_test_user, email_verified_at)
                         VALUES ($1, 'pruefer-kein-login', $2, true, now()) RETURNING id, email, name`, [kurz + DOM, name]);
  ids.users.push(r.rows[0].id); return r.rows[0];
}
async function partnerKonto(owner, marke) {
  const r = await query(`INSERT INTO resellers (name, role, owner_user_id, whitelabel_enabled, brand_name, brand_accent, brand_email)
                         VALUES ($1, 'finanzierer', $2, true, $1, '#2E5E8C', $3) RETURNING *`, [marke, owner.id, 'kontakt' + DOM]);
  ids.resellers.push(r.rows[0].id);
  await query(`INSERT INTO reseller_members (reseller_id, user_id, role) VALUES ($1, $2, 'owner')`, [r.rows[0].id, owner.id]);
  return r.rows[0];
}
async function platz(resellerId) {
  await query(`INSERT INTO licenses (reseller_id, kind, status, billing_cycle) VALUES ($1, 'client', 'pool', 'monatlich')`, [resellerId]);
}
const zeile = async (id) => (await query('SELECT * FROM objekt_uebergaben WHERE id = $1', [id])).rows[0];

(async () => {
  try {
    /* Vorher: alte Reste eines abgebrochenen Laufs */
    await aufraeumen(true);

    info('Ablage bereit: ' + ablage.bereit());
    const p1 = await nutzer('partner1', 'Pruefer Partner Eins');
    const m1 = await nutzer('mitglied1', 'Pruefer Mitglied');
    const p2 = await nutzer('partner2', 'Pruefer Partner Zwei');
    const k1 = await nutzer('bestand1', 'Pruefer Bestandskunde');
    const k2 = await nutzer('neu2', 'Pruefer Neukunde');
    const k3 = await nutzer('neu3', 'Pruefer Ohne Platz');
    const k4 = await nutzer('fremd4', 'Pruefer Fremdmandant');
    const r1 = await partnerKonto(p1, 'Pruefer Partner Eins (Test)');
    const r2 = await partnerKonto(p2, 'Pruefer Partner Zwei (Test)');
    await query(`INSERT INTO reseller_members (reseller_id, user_id, role) VALUES ($1, $2, 'berater')`, [r1.id, m1.id]);
    await reseller.createClient(r1.id, { userId: k1.id, displayName: 'Bestandskunde' });
    await reseller.createClient(r2.id, { userId: k4.id, displayName: 'Fremdmandant' });
    await platz(r1.id);   /* genau EIN freier Platz */

    const daten = { str: 'Pruefweg', hnr: '1', plz: '32052', ort: 'Herford', _obj_seq: '2026-901', _dealpilot_score: 72,
      _kpis_cf_ns: 1800, _kpis_bmy: 5.4, _kpis_dscr: 1.25, svwert: 250000, svw_herkunft: 'bank', _deal_won: true, halter: 'm-1', kp: 230000, _thumb: PNG };
    const o1 = await objectService.create(p1.id, { data: JSON.parse(JSON.stringify(daten)), aiAnalysis: 'Analyse-Text', photos: [PNG, PNG2] });
    const o2 = await objectService.create(p2.id, { data: { str: 'Fremdweg', hnr: '2' }, photos: [] });
    const o1Vorher = (await query('SELECT version, data::text AS d, photos::text AS p, user_id FROM objects WHERE id = $1', [o1.id])).rows[0];

    /* ── Berechtigung ── */
    let e = await fehlerVon(() => U.anlegen({ resellerId: r2.id, userId: p2.id, objectId: o1.id, email: 'x' + DOM, basis: BASIS }));
    ok(e && e.status === 404, 'fremder Partner kann fremdes Objekt nicht uebergeben (404 ' + (e && e.code) + ')');
    e = await fehlerVon(() => U.anlegen({ resellerId: r1.id, userId: p2.id, objectId: o2.id, email: 'x' + DOM, basis: BASIS }));
    ok(e && e.status === 403, 'Nicht-Mitglied kann nicht im Namen eines Partner-Kontos uebergeben (403 ' + (e && e.code) + ')');
    e = await fehlerVon(() => U.anlegen({ resellerId: r1.id, userId: m1.id, objectId: o1.id, email: 'x' + DOM, basis: BASIS }));
    ok(e && e.status === 404, 'Mitglied kann nur EIGENE Objekte uebergeben, nicht die des Owners (404)');
    e = await fehlerVon(() => U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: 'kein-mail', basis: BASIS }));
    ok(e && e.status === 400, 'ungueltige Adresse abgewiesen (400)');

    /* ── Vorpruefung / Platz ── */
    let vp = await U.vorpruefung(r1.id, k1.email.toUpperCase());
    ok(vp.bestehender_mandant && vp.kann_senden, 'Vorpruefung: Bestandsmandant erkannt (Grossschreibung egal), braucht keinen Platz');
    vp = await U.vorpruefung(r1.id, k3.email);
    ok(!vp.bestehender_mandant && vp.frei === 1 && vp.kann_senden, 'Vorpruefung: neuer Kunde, 1 Platz frei');

    /* ── Lebenszyklus mit Bestandsmandant ── */
    const a = await U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k1.email, anzeigeName: 'Bestandskunde', nachricht: 'Bitte ansehen', basis: BASIS });
    let z = await zeile(a.uebergabe.id);
    ok(z.status === 'gesendet' && a.mail.status === 'testadresse', 'angelegt: gesendet, Testadresse -> keine Mail ueber SMTP');
    ok(z.token_hash === crypto.createHash('sha256').update(a.token).digest('hex'), 'Token nur als SHA-256 gespeichert');
    const roh = (await query('SELECT row_to_json(u)::text AS t FROM objekt_uebergaben u WHERE id = $1', [z.id])).rows[0].t;
    ok(roh.indexOf(a.token) < 0, 'Token steht in keiner Spalte');
    ok(a.token.length >= 40, 'Token lang genug (' + a.token.length + ' Zeichen, 32 Byte)');
    ok(Math.abs(new Date(z.expires_at) - Date.now() - 30 * 864e5) < 120000, 'laeuft in 30 Tagen ab');
    ok(z.zusammenfassung.score === 72 && z.zusammenfassung.stufe.wort === 'Gut' && z.zusammenfassung.cashflow_jahr === 1800, 'Zusammenfassung mit gespeicherten Werten');

    const b = await U.bild(z.bild_schluessel);
    ok(b && b.mime === 'image/png' && b.puffer.length > 50, 'Titelfoto ueber eigenen Schluessel abrufbar (' + (b ? b.puffer.length + ' Byte' : 'nichts') + ')');
    ok((await U.bild('0'.repeat(32))) === null && (await U.bild(a.token)) === null, 'falscher Schluessel / Token als Bildschluessel -> nichts');

    let i = await U.info(a.token);
    z = await zeile(a.uebergabe.id);
    ok(i && i.valid && z.status === 'geoeffnet' && z.geoeffnet_at, 'Link aufgerufen -> geoeffnet');
    ok(i.brand_name === 'Pruefer Partner Eins (Test)' && i.objekt.adresse === 'Pruefweg 1, 32052 Herford', 'Landeseite: Partner und Adresse');
    ok((await U.info('falsch-' + a.token.slice(7))) === null, 'falsches Token -> nicht gefunden');

    e = await fehlerVon(() => U.uebernehmen(a.token, p1));
    ok(e && e.code === 'partnerkonto', 'Partner selbst kann nicht uebernehmen (409 partnerkonto)');
    e = await fehlerVon(() => U.uebernehmen(a.token, m1));
    ok(e && e.code === 'partnerkonto', 'Mitglied des Partners kann nicht uebernehmen');
    z = await zeile(a.uebergabe.id);
    ok(z.status === 'geoeffnet', 'abgewiesene Versuche lassen den Link unverbraucht');

    const poolVor = await reseller.getPool(r1.id);
    const u1 = await U.uebernehmen(a.token, k1);
    z = await zeile(a.uebergabe.id);
    ok(u1.ok && !u1.neuer_mandant && u1.seat_assigned === null, 'Bestandsmandant uebernimmt, kein neuer Platz');
    ok((await reseller.getPool(r1.id)).frei === poolVor.frei, 'Pool unveraendert (' + poolVor.frei + ' frei)');
    ok(z.status === 'uebernommen' && z.empfaenger_user_id === k1.id && z.kopie_object_id === u1.object_id, 'Status uebernommen, Empfaenger und Kopie vermerkt');
    const kop = (await query('SELECT id, user_id, data, photos, ai_analysis, seq_no FROM objects WHERE id = $1', [u1.object_id])).rows[0];
    const orig = (await query('SELECT version, data::text AS d, photos::text AS p, user_id FROM objects WHERE id = $1', [o1.id])).rows[0];
    ok(kop && kop.user_id === k1.id && kop.id !== o1.id, 'Kopie liegt beim Kunden (neue ID)');
    ok(orig && orig.user_id === p1.id && orig.version === o1Vorher.version && orig.d === o1Vorher.d && orig.p === o1Vorher.p, 'Original unveraendert beim Partner (Kopie, keine Verschiebung)');
    ok(kop.data._kpis_cf_ns === 1800 && kop.data._dealpilot_score === 72 && kop.data.kp === 230000 && kop.ai_analysis === 'Analyse-Text', 'Kopie traegt Berechnung, Eingaben und Analyse');
    ok(!kop.data._deal_won && !kop.data.halter && kop.data._uebergabe && kop.data._uebergabe.uebergabe_id === z.id, 'Kopie ohne Gewonnen/Halter, mit Herkunft');
    ok(kop.seq_no && kop.seq_no !== '2026-901', 'Kopie bekommt eine eigene Objektnummer (' + kop.seq_no + ')');
    const kf = Array.isArray(kop.photos) ? kop.photos : [];
    ok(kf.length === 2, 'beide Fotos kopiert (' + kf.length + ')');
    if (ablage.bereit()) {
      const verw = Array.from(new Set(kf.filter((p) => typeof p === 'string' && p.indexOf('dpfoto:') === 0).map((p) => p.slice(7))));
      const ds = verw.length ? (await query('SELECT user_id FROM dateien WHERE id = ANY($1::uuid[])', [verw])).rows : [];
      ok(verw.length === 2 && ds.length === verw.length && ds.every((d) => d.user_id === k1.id), 'Fotos der Kopie in der Ablage des KUNDEN (' + verw.length + ' Dateien, ' + ds.length + ' Zeilen)');
      const origVerw = JSON.parse(orig.p).filter((p) => typeof p === 'string' && p.indexOf('dpfoto:') === 0);
      ok(origVerw.length === 2 && origVerw.every((p) => verw.indexOf(p.slice(7)) < 0), 'eigene Dateien, keine Verweise auf die Fotos des Partners');
    }

    e = await fehlerVon(() => U.uebernehmen(a.token, k1));
    ok(e && e.status === 409 && e.code === 'schon_uebernommen', 'zweite Uebernahme abgewiesen (409)');
    e = await fehlerVon(() => U.uebernehmen(a.token, k2));
    ok(e && e.status === 409, 'Uebernahme durch Dritten danach abgewiesen (409)');
    const nK1 = (await query('SELECT COUNT(*)::int AS n FROM objects WHERE user_id = $1', [k1.id])).rows[0].n;
    ok(nK1 === 1, 'genau eine Kopie beim Kunden (' + nK1 + ')');

    /* ── Mandant eines ANDEREN Partners ── */
    const f = await U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k4.email, basis: BASIS });
    e = await fehlerVon(() => U.uebernehmen(f.token, k4));
    ok(e && e.code === 'mandant_anderer_partner', 'Mandant eines anderen Partners: abgewiesen (409), Link bleibt');
    ok((await zeile(f.uebergabe.id)).status === 'gesendet', 'abgewiesener Fremdmandant verbraucht den Link nicht');
    await U.widerrufen(r1.id, f.uebergabe.id);

    /* ── Neukunde, gleichzeitig zweimal ── */
    const c = await U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k2.email, anzeigeName: 'Neukunde', basis: BASIS });
    const beide = await Promise.allSettled([U.uebernehmen(c.token, k2), U.uebernehmen(c.token, k2)]);
    const gut = beide.filter((x) => x.status === 'fulfilled');
    ok(gut.length === 1 && beide.some((x) => x.status === 'rejected' && x.reason.status === 409), 'gleichzeitige Doppel-Uebernahme: genau eine gewinnt');
    const u2 = gut[0] && gut[0].value;
    ok(u2 && u2.neuer_mandant && u2.seat_assigned === true, 'Neukunde wird Mandant und bekommt den freien Platz');
    const cl = (await query(`SELECT c.id, (SELECT status::text FROM licenses l WHERE l.client_id = c.id LIMIT 1) AS lz FROM reseller_clients c WHERE c.reseller_id = $1 AND c.user_id = $2`, [r1.id, k2.id])).rows[0];
    ok(cl && cl.lz === 'zugewiesen' && cl.id === u2.client_id, 'reseller_clients + Lizenz zugewiesen');
    const pl = (await query(`SELECT plan_id FROM subscriptions WHERE user_id = $1 ORDER BY updated_at DESC NULLS LAST LIMIT 1`, [k2.id]).catch(() => ({ rows: [] }))).rows[0];
    ok(pl && pl.plan_id === 'investor', 'Plan des Neukunden: investor (' + (pl ? pl.plan_id : 'kein Abo') + ')');
    ok((await query('SELECT COUNT(*)::int AS n FROM objects WHERE user_id = $1', [k2.id])).rows[0].n === 1, 'genau eine Kopie beim Neukunden');
    ok((await reseller.getPool(r1.id)).frei === 0, 'Pool danach 0 frei');

    /* ── kein freier Platz ── */
    vp = await U.vorpruefung(r1.id, k3.email);
    ok(!vp.kann_senden && vp.frei === 0, 'Vorpruefung: kein Platz -> kann_senden false');
    e = await fehlerVon(() => U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k3.email, basis: BASIS }));
    ok(e && e.status === 409 && e.code === 'kein_freier_platz', 'Senden an Neukunden ohne Platz: 409 kein_freier_platz');
    const nachK1 = await fehlerVon(() => U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k1.email, basis: BASIS }));
    ok(nachK1 === null, 'an Bestandsmandanten geht es auch ohne freien Platz');

    /* ── Ablauf ── */
    const d = await U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k1.email, basis: BASIS });
    await query(`UPDATE objekt_uebergaben SET expires_at = now() - interval '1 minute' WHERE id = $1`, [d.uebergabe.id]);
    i = await U.info(d.token);
    ok(i && !i.valid && i.status === 'abgelaufen' && (await zeile(d.uebergabe.id)).status === 'gesendet', 'abgelaufen: Landeseite ungueltig, kein "geoeffnet"');
    e = await fehlerVon(() => U.uebernehmen(d.token, k1));
    ok(e && e.status === 410 && e.code === 'abgelaufen', 'abgelaufen: Uebernahme 410');
    ok((await U.bild((await zeile(d.uebergabe.id)).bild_schluessel)) === null, 'abgelaufen: kein Titelfoto');

    /* ── Widerruf ── */
    const w = await U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k1.email, basis: BASIS });
    ok((await U.widerrufen(r2.id, w.uebergabe.id)) === false, 'fremder Partner kann nicht widerrufen');
    ok((await U.widerrufen(r1.id, w.uebergabe.id)) === true, 'eigener Partner widerruft');
    e = await fehlerVon(() => U.uebernehmen(w.token, k1));
    ok(e && e.status === 410 && e.code === 'widerrufen', 'widerrufen: Uebernahme 410');
    ok((await U.bild((await zeile(w.uebergabe.id)).bild_schluessel)) === null, 'widerrufen: kein Titelfoto');
    ok((await U.widerrufen(r1.id, a.uebergabe.id)) === false, 'uebernommene Uebergabe laesst sich nicht widerrufen');

    /* ── Liste ── */
    const l1 = await U.liste(r1.id), l2 = await U.liste(r2.id);
    const st = l1.map((x) => x.status).sort().join(',');
    ok(l1.length === 6 && st === 'abgelaufen,gesendet,uebernommen,uebernommen,widerrufen,widerrufen', 'Partner sieht seine 6 Uebergaben mit Status (' + st + ')');
    ok(l2.length === 0, 'fremder Partner sieht keine');
    ok(l1.every((x) => !('token_hash' in x)), 'Liste ohne Token-Hash');

    /* ── v3317b · Kundenplatz mitschicken (Reservierung beim Senden) ── */
    const k5 = await nutzer('platz5', 'Pruefer Platz Fuenf'), k6 = await nutzer('platz6', 'Pruefer Platz Sechs');
    const k7 = await nutzer('platz7', 'Pruefer Platz Sieben'), k8 = await nutzer('platz8', 'Pruefer Platz Acht');
    await platz(r1.id); await platz(r1.id);   /* zwei neue freie Plaetze */
    let pool = await reseller.getPool(r1.id);
    ok(pool.frei === 2 && pool.reserviert === 0, 'Ausgang: 2 frei, 0 reserviert');
    vp = await U.vorpruefung(r1.id, k5.email);
    ok(vp.platz_moeglich === true && vp.frei === 2, 'Vorpruefung neue Adresse: Haekchen moeglich');
    ok((await U.vorpruefung(r1.id, k1.email)).platz_moeglich === false, 'Bestandsmandant: kein Haekchen');
    const p5 = await U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k5.email, platzMitschicken: true, basis: BASIS });
    let z5 = await zeile(p5.uebergabe.id);
    const l5 = z5.lizenz_id && (await query('SELECT status::text, reserviert_fuer FROM licenses WHERE id = $1', [z5.lizenz_id])).rows[0];
    ok(l5 && l5.status === 'pool' && l5.reserviert_fuer === z5.id, 'beim SENDEN reserviert: Platz traegt die Uebergabe');
    pool = await reseller.getPool(r1.id);
    ok(pool.frei === 1 && pool.reserviert === 1 && pool.gekauft === 3, 'Pool: 1 frei, 1 reserviert (zaehlt als belegt)');
    ok((await U.liste(r1.id)).find((x) => x.id === z5.id).platz_reserviert === true, 'Portal-Liste: platz_reserviert');
    ok((await U.info(p5.token)).platz_reserviert === true, 'Landeseite: platz_reserviert (Band "Zugang schon freigeschaltet")');
    const keinPlatzBeiBestand = await U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k1.email, platzMitschicken: true, basis: BASIS });
    ok(!(await zeile(keinPlatzBeiBestand.uebergabe.id)).lizenz_id && (await reseller.getPool(r1.id)).reserviert === 1, 'Bestandsmandant mit Haekchen: nichts reserviert');
    await U.widerrufen(r1.id, keinPlatzBeiBestand.uebergabe.id);

    /* Doppelreservierung: 1 freier Platz, zwei gleichzeitige Sendungen mit Haekchen */
    const zwei = await Promise.allSettled([
      U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k6.email, platzMitschicken: true, basis: BASIS }),
      U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k7.email, platzMitschicken: true, basis: BASIS })]);
    const gew = zwei.filter((x) => x.status === 'fulfilled');
    ok(gew.length === 1 && zwei.some((x) => x.status === 'rejected' && x.reason.status === 409), 'zwei gleichzeitige Reservierungen auf 1 Platz: genau eine gewinnt, die andere 409');
    const verwaist = (await query('SELECT COUNT(*)::int AS n FROM objekt_uebergaben WHERE email = ANY($1) AND lizenz_id IS NULL', [[k6.email, k7.email]])).rows[0].n;
    ok(verwaist === 0, 'die abgewiesene Uebergabe ist nicht angelegt (keine Zeile ohne Platz)');
    pool = await reseller.getPool(r1.id);
    ok(pool.frei === 0 && pool.reserviert === 2, 'Pool: 0 frei, 2 reserviert');
    e = await fehlerVon(() => U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k8.email, platzMitschicken: true, basis: BASIS }));
    ok(e && e.code === 'kein_freier_platz', 'kein Platz frei: Senden mit Haekchen 409');

    /* Abgleich mit Stripe (Webhook) darf reservierte Plaetze nicht abbauen */
    await reseller.syncPoolQuantity(r1.id, 0);
    pool = await reseller.getPool(r1.id);
    ok(pool.reserviert === 2 && pool.frei === 0, 'syncPoolQuantity(0): beide reservierten Plaetze bleiben (' + pool.gekauft + ' gekauft)');

    /* Widerruf gibt frei */
    const w6 = gew[0].value;
    await U.widerrufen(r1.id, w6.uebergabe.id);
    pool = await reseller.getPool(r1.id);
    ok(pool.frei === 1 && pool.reserviert === 1, 'Widerruf: Platz sofort wieder frei');
    ok((await query('SELECT COUNT(*)::int AS n FROM licenses WHERE reserviert_fuer = $1', [w6.uebergabe.id])).rows[0].n === 0, 'Widerruf raeumt reserviert_fuer');

    /* Ablauf gibt frei (ohne Takt) */
    await query(`UPDATE objekt_uebergaben SET expires_at = now() - interval '1 minute' WHERE id = $1`, [z5.id]);
    pool = await reseller.getPool(r1.id);
    ok(pool.frei === 2 && pool.reserviert === 0, 'Ablauf: reservierter Platz zaehlt wieder als frei');

    /* Uebernahme nutzt GENAU den reservierten Platz */
    const p8 = await U.anlegen({ resellerId: r1.id, userId: p1.id, objectId: o1.id, email: k8.email, platzMitschicken: true, basis: BASIS });
    const z8 = await zeile(p8.uebergabe.id);
    const u8 = await U.uebernehmen(p8.token, k8);
    const l8 = (await query('SELECT status::text, client_id, reserviert_fuer FROM licenses WHERE id = $1', [z8.lizenz_id])).rows[0];
    ok(u8.seat_assigned === true && l8.status === 'zugewiesen' && l8.client_id === u8.client_id && !l8.reserviert_fuer, 'Uebernahme: genau der reservierte Platz geht an den Kunden');
    pool = await reseller.getPool(r1.id);
    ok(pool.frei === 1 && pool.reserviert === 0, 'danach: der andere Platz bleibt frei');
    const pl8 = (await query('SELECT plan_id FROM subscriptions WHERE user_id = $1', [k8.id])).rows[0];
    ok(pl8 && pl8.plan_id === 'investor', 'Kunde mit mitgeschicktem Platz: Investor');

    /* ── Mail ── */
    const brand = (await query('SELECT id, name, brand_name, brand_accent, whitelabel_enabled, brand_email FROM resellers WHERE id = $1', [r1.id])).rows[0];
    brand.basis = BASIS;
    const mb = U.mailBauen({ zusammenfassung: z.zusammenfassung, link: BASIS + '/?rp_uebergabe=X', reseller: brand });
    ok(mb.html.indexOf('Score 72 · GUT') > 0 && mb.html.indexOf('#2E5E8C') > 0 && mb.marke.fromName === brand.brand_name, 'Mail im Container: Stufe aus dem Kern, Partnerfarbe, Absendername');
  } catch (err) {
    ok(false, 'Ausnahme: ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : err));
  } finally {
    try { await aufraeumen(false); } catch (e) { ok(false, 'Aufraeumen: ' + e.message); }
    console.log('ENDE');
    process.exit(0);
  }
})();

async function aufraeumen(vorher) {
  const u = (await query('SELECT id FROM users WHERE email LIKE $1', ['%' + DOM])).rows.map((x) => x.id);
  if (!u.length) { if (!vorher) ok(true, 'aufgeraeumt (nichts uebrig)'); return; }
  const rs = (await query('SELECT id FROM resellers WHERE owner_user_id = ANY($1::uuid[])', [u])).rows.map((x) => x.id);
  if (rs.length) {
    await query('DELETE FROM objekt_uebergaben WHERE reseller_id = ANY($1::uuid[])', [rs]);
    await query('DELETE FROM reseller_clients WHERE reseller_id = ANY($1::uuid[])', [rs]);
    await query('DELETE FROM resellers WHERE id = ANY($1::uuid[])', [rs]);
  }
  await query('DELETE FROM reseller_clients WHERE user_id = ANY($1::uuid[])', [u]);
  for (const id of u) { try { await ablage.kontoLeeren(id); } catch (e) {} }
  await query('DELETE FROM dateien WHERE user_id = ANY($1::uuid[])', [u]).catch(() => {});
  await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [u]);
  const rest = (await query('SELECT COUNT(*)::int AS n FROM users WHERE email LIKE $1', ['%' + DOM])).rows[0].n;
  if (vorher) info('Reste eines frueheren Laufs entfernt: ' + u.length + ' Konten');
  else ok(rest === 0, 'aufgeraeumt: ' + u.length + ' Testkonten samt Partnern, Objekten, Fotos entfernt');
}
