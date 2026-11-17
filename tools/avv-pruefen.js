'use strict';
/**
 * tools/avv-pruefen.js · v3620 — Auftragsverarbeitungsvertrag (AVV) der Partner, Art. 28 DSGVO
 *
 * A  ohne DB, im Repo:  node tools/avv-pruefen.js
 *    - Version und Stand in frontend/landing/avv.html (#avv-stand) = backend/src/services/avvService.js
 *    - Pflichtinhalte Art. 28 Abs. 3 lit. a-h, Abs. 9 (elektronisch), Anlagen TOM und Unterauftragsverarbeiter
 *    - Kundentext ohne Gedankenstrich und Semikolon (Memory kundentext-punkt-komma)
 *    - sicherheit/partner/fragen verlinken avv.html, „stellen wir bereit“ und das Domain-Versprechen sind weg
 *    - zaehlt die [offen: ...]-Stellen (vor einem Prod-Rollout aufzuloesen, gelb, kein Rot)
 *    - Kauf-Fenster und Cockpit sind verdrahtet (partner-plan-kauf.js, partner-kunden.js, index.html)
 *
 * B  --live, NUR STAGING, IM Backend-Container:
 *      docker cp tools/avv-pruefen.js dealpilot-backend:/app/avv-pruefen.js
 *      docker exec dealpilot-backend node /app/avv-pruefen.js --live
 *    Legt zwei Testkonten @avv-pruefer.dealpilot.test an (erfundene Namen, .test geht nie per SMTP) und raeumt
 *    sie wieder ab: Kauf ohne Haekchen 400, alte Version 409, mit Haekchen Stripe-Sitzung (Sandbox) und
 *    Protokollzeile (Konto, Version, Zeitpunkt), bestehender Partner im Cockpit nicht aktuell -> Zustimmung ->
 *    aktuell, neue Version erzwingt erneute Zustimmung, Admin-Liste zeigt Version/Datum, Aufraeumen laesst den
 *    AVV-Nachweis eines bestehenden Kontos stehen.
 *    --browser  wie --live, aber ohne Abraeumen und ohne Zustimmung des Partners: gibt TOKEN-Zeilen fuer die
 *               Messung im eigenen headless Chrome aus.   --aufraeumen  Testkonten entfernen.
 */
const fs = require('fs');
const path = require('path');

let fehlerZahl = 0, gelb = 0;
function ok(b, text, info) { if (!b) fehlerZahl++; console.log((b ? '  ok   ' : '  ROT  ') + text + (info ? '  (' + info + ')' : '')); }
function hinweis(text) { gelb++; console.log('  gelb ' + text); }

const LIVE = process.argv.includes('--live'), BROWSER = process.argv.includes('--browser'), RAEUMEN = process.argv.includes('--aufraeumen');

/* ── A · Dateien ───────────────────────────────────────────────────────── */
function teilA() {
  const R = path.join(__dirname, '..');
  const lies = (p) => fs.readFileSync(path.join(R, p), 'utf8');
  console.log('=== A · Vertragstext und Verdrahtung ===');
  const html = lies('frontend/landing/avv.html');
  const svc = lies('backend/src/services/avvService.js');
  const v = (svc.match(/AVV_VERSION = '([^']+)'/) || [])[1], st = (svc.match(/AVV_STAND = '([^']+)'/) || [])[1];
  const kopf = html.match(/id="avv-stand" data-version="([^"]+)" data-stand="([^"]+)"/) || [];
  ok(v && kopf[1] === v, 'Version im Seitenkopf = avvService.AVV_VERSION', kopf[1] + ' / ' + v);
  ok(st && kopf[2] === st, 'Stand im Seitenkopf = avvService.AVV_STAND', kopf[2] + ' / ' + st);
  const [j, m, t] = String(st).split('-');
  const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const lang = Number(t) + '. ' + monate[Number(m) - 1] + ' ' + j;
  ok(html.includes('Stand: ' + lang + ' · Version ' + v), 'sichtbarer Stand im Kopf', lang);
  ok(html.includes('AVV-Version ' + v), 'Fuss nennt dieselbe Version');

  const text = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<style>[\s\S]*?<\/style>/, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  const pflicht = [
    ['Gegenstand und Dauer', /§ 1 Gegenstand und Dauer/], ['Art und Zweck', /Art und Zweck der Verarbeitung/],
    ['Datenarten (Anlage 1)', /Arten personenbezogener Daten/], ['Betroffene (Anlage 1)', /Kategorien betroffener Personen/],
    ['lit. a Weisungen', /Art\. 28 Abs\. 3 lit\. a/], ['lit. b Vertraulichkeit', /Art\. 28 Abs\. 3 lit\. b/],
    ['lit. c TOM', /Art\. 28 Abs\. 3 lit\. c/], ['Abs. 2/4 Unterauftrag', /Art\. 28 Abs\. 2 DSGVO[\s\S]*Art\. 28 Abs\. 4 DSGVO/],
    ['lit. e Betroffenenrechte', /Art\. 28 Abs\. 3 lit\. e/], ['lit. f Art. 32 bis 36', /Art\. 28 Abs\. 3 lit\. f/],
    ['lit. g Loeschung/Rueckgabe', /Art\. 28 Abs\. 3 lit\. g/], ['lit. h Nachweise/Kontrollen', /Art\. 28 Abs\. 3 lit\. h/],
    ['Hinweis rechtswidrige Weisung', /Art\. 28 Abs\. 3 Satz 3/], ['Meldung Verletzung Art. 33', /Art\. 33 Abs\. 2 DSGVO/],
    ['Abs. 9 elektronisch', /Art\. 28 Abs\. 9 DSGVO/], ['Anlage 2 TOM', /Anlage 2 · Technische und organisatorische/],
    ['Anlage 3 Unterauftragsverarbeiter', /Anlage 3 · Unterauftragsverarbeiter/], ['Hetzner mit Ort', /Hetzner Online GmbH[^]*?Deutschland/],
    ['OpenAI als Drittland', /OpenAI[\s\S]{0,900}Drittland/], ['Loeschfrist 30 Tage Kundenkonto', /30 Tage Frist/],
    ['neue Version = erneute Zustimmung', /neue Versionsnummer[\s\S]{0,200}stimmt der neuen Version/]];
  pflicht.forEach(([n, re]) => ok(re.test(text), 'Pflichtinhalt: ' + n));
  ok(!/[–—]/.test(text), 'Kundentext ohne Gedankenstrich', String((text.match(/[–—]/g) || []).length));
  ok(!/;/.test(text), 'Kundentext ohne Semikolon', String((text.match(/;/g) || []).length));
  const offen = (html.match(/\[offen:/g) || []).length;
  if (offen) hinweis(offen + ' Stellen [offen: …] im Vertrag, vor einem Prod-Rollout mit Marcel klaeren');

  const sich = lies('frontend/landing/sicherheit.html'), part = lies('frontend/landing/partner.html'), fr = lies('frontend/landing/fragen.html');
  ok(/href="avv\.html"/.test(sich) && /href="avv\.html"/.test(part) && /href="avv\.html"/.test(fr), 'sicherheit, partner, fragen verlinken avv.html');
  const ohneKommentar = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
  ok(!/stellen wir bereit/.test(ohneKommentar(sich + part + fr)), '„stellen wir bereit“ ist weg (ausserhalb von Kommentaren)');
  const alle = ['fragen.html', 'preise.html', 'partner.html', 'index.html', 'loesungen.html', 'sicherheit.html'].map((f) => ohneKommentar(lies('frontend/landing/' + f))).join('\n');
  ok(!/nicht in Erscheinung/.test(alle), '„DealPilot tritt nicht in Erscheinung“ ist weg');
  ok(!/Eigene Domain, eigene|eigene Absenderadresse/.test(alle), 'kein Versprechen eigene Domain oder Absenderadresse');
  ok(/Eine eigene Domain bieten wir nicht an/.test(fr), 'fragen.html sagt: keine eigene Domain');

  const kauf = lies('frontend/js/partner-plan-kauf.js'), pk = lies('frontend/js/partner-kunden.js'), idx = lies('frontend/index.html'), leg = lies('frontend/js/legal.js');
  ok(/avv_zustimmung:/.test(kauf) && /avv_version:/.test(kauf) && /zusatz: _zusatz/.test(kauf), 'Kauf-Fenster schickt avv_zustimmung und avv_version');
  ok(/opts\.zusatz/.test(leg) && /alleGesetzt/.test(leg), 'DpWiderruf kennt Zusatz-Haekchen (alle Pflicht)');
  ok(/c\.avv\.aktuell === false/.test(pk) && /DpAvv\.einholen/.test(pk), 'Cockpit fragt ohne aktuelle Zustimmung');
  const iAvv = idx.indexOf('js/avv-zustimmung.js'), iKauf = idx.indexOf('js/partner-plan-kauf.js');
  ok(iAvv > 0 && iAvv < iKauf, 'index.html laedt avv-zustimmung.js vor partner-plan-kauf.js');
  const sub = lies('backend/src/routes/subscription.js');
  const iA = sub.indexOf("require('../services/avvService').pruefen(req"), iW = sub.indexOf("widerrufVerzichtPruefen(req, { kauf: 'abo', plan: 'partner'");
  ok(iA > 0 && iA < iW, 'Partner-Checkout prueft den AVV vor dem Widerrufsverzicht');
  ok(fs.existsSync(path.join(R, 'frontend/avv.html')) && /\/landing\/avv\.html/.test(lies('frontend/avv.html')), 'Weiche /avv.html auf der App-Domain');
}

/* ── B · live auf Staging ──────────────────────────────────────────────── */
async function teilB() {
  if (!/staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || '')) { console.error('ABBRUCH: nur auf Staging.'); process.exit(2); }
  const { query } = require('./src/db/pool');
  const userService = require('./src/services/userService');
  const planService = require('./src/services/planService');
  const resellerService = require('./src/services/resellerService');
  const avv = require('./src/services/avvService');
  const consent = require('./src/services/consentService');
  const jwt = require('./src/utils/jwt');
  const crypto = require('crypto');
  const BASIS = 'http://localhost:' + (process.env.PORT || 3000) + '/api/v1';
  const KAUF = 'avv-kauf@avv-pruefer.dealpilot.test', PARTNER = 'avv-partner@avv-pruefer.dealpilot.test';

  async function http(token, methode, pfad, body) {
    const r = await fetch(BASIS + pfad, { method: methode, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
    let d = null; try { d = await r.json(); } catch (e) {}
    return { status: r.status, d };
  }
  async function konto(email, name) {
    let u = (await query('SELECT id, email, name FROM users WHERE email = $1', [email])).rows[0];
    if (!u) u = await userService.createUser({ email, plainPassword: crypto.randomBytes(12).toString('base64url'), name, newsletter: false });
    await query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1', [u.id]);
    return u;
  }
  async function abraeumen() {
    for (const e of [KAUF, PARTNER]) {
      const u = (await query('SELECT id FROM users WHERE email = $1', [e])).rows[0]; if (!u) continue;
      await query(`DELETE FROM consent_log WHERE user_id = $1`, [u.id]);
      const rs = (await query(`SELECT id FROM resellers WHERE owner_user_id = $1`, [u.id])).rows;
      for (const r of rs) {
        await query('DELETE FROM licenses WHERE reseller_id = $1', [r.id]).catch(() => {});
        await query('DELETE FROM reseller_members WHERE reseller_id = $1', [r.id]).catch(() => {});
        await query('DELETE FROM resellers WHERE id = $1', [r.id]).catch((x) => console.log('  resellers:', x.message));
      }
      try { await userService.deleteUser(u.id); } catch (x) { console.log('  Loeschen ' + e + ': ' + x.message); }
    }
    console.log('  Testkonten abgeraeumt');
  }
  if (RAEUMEN) { await abraeumen(); return; }

  console.log('=== B · live (Staging, Container) ===');
  const ku = await konto(KAUF, 'Karl Kaufprobe (Test)');
  const pu = await konto(PARTNER, 'Petra Partnerprobe (Test)');
  await query(`DELETE FROM consent_log WHERE user_id = ANY($1) AND art = 'avv'`, [[ku.id, pu.id]]);
  await planService.setUserPlanManual(pu.id, 'partner', 'monthly', 30);
  await resellerService.ensureReseller(pu.id, { name: 'Muster Finanzberatung AVV (Test)' });
  const tk = jwt.signKurz({ userId: ku.id, email: ku.email }, '30m'), tp = jwt.signKurz({ userId: pu.id, email: pu.email }, '30m');

  if (BROWSER) {
    console.log('TOKEN_KAUF ' + tk); console.log('TOKEN_PARTNER ' + tp);
    console.log('  Konten stehen, Partner ohne AVV. Danach: --aufraeumen'); return;
  }

  /* Kauf */
  let s = await http(tk, 'GET', '/consent/avv');
  ok(s.status === 200 && s.d.version === avv.AVV_VERSION && s.d.aktuell === false && s.d.zugestimmt === null, 'neues Konto: GET /consent/avv nicht aktuell', s.status + ' ' + (s.d && s.d.version));
  ok(s.d && s.d.link === '/avv.html' && /Version 1\.0|Version \d/.test(s.d.text), 'Stand liefert Link und Haekchentext', s.d && s.d.text);
  const basis = { billingInterval: 'monthly', plaetze: 1, widerruf_verzicht: true, widerruf_version: '2026-10-23' };
  let r = await http(tk, 'POST', '/subscription/partner/checkout', basis);
  ok(r.status === 400 && r.d && r.d.error === 'avv_fehlt', 'Kauf ohne AVV-Haekchen: 400 avv_fehlt', r.status + ' ' + (r.d && r.d.error));
  r = await http(tk, 'POST', '/subscription/partner/checkout', Object.assign({ avv_zustimmung: false, avv_version: avv.AVV_VERSION }, basis));
  ok(r.status === 400 && r.d && r.d.error === 'avv_fehlt', 'Kauf mit avv_zustimmung:false: 400', String(r.status));
  r = await http(tk, 'POST', '/subscription/partner/checkout', Object.assign({ avv_zustimmung: true, avv_version: '0.9' }, basis));
  ok(r.status === 409 && r.d && r.d.error === 'avv_version_veraltet', 'Kauf mit alter Version: 409 avv_version_veraltet', r.status + ' ' + (r.d && r.d.error));
  let n = (await query(`SELECT COUNT(*)::int AS n FROM consent_log WHERE user_id = $1`, [ku.id])).rows[0].n;
  ok(n === 0, 'abgewiesene Kaeufe protokollieren nichts (weder AVV noch Widerruf)', String(n));
  const vor = Date.now();
  r = await http(tk, 'POST', '/subscription/partner/checkout', Object.assign({ avv_zustimmung: true, avv_version: avv.AVV_VERSION }, basis));
  ok(r.status === 200 && r.d && /^https:\/\/checkout\.stripe\.com\//.test(r.d.url || ''), 'Kauf mit AVV-Haekchen: Stripe-Sitzung (Sandbox)', r.status + ' ' + (r.d && (r.d.url ? 'url' : r.d.error)));
  const zl = (await query(`SELECT version, accepted_at, kontext FROM consent_log WHERE user_id = $1 AND art = 'avv' ORDER BY accepted_at DESC`, [ku.id])).rows;
  ok(zl.length === 1 && zl[0].version === avv.AVV_VERSION, 'Protokollzeile art=avv mit Version', zl.length + ' ' + (zl[0] && zl[0].version));
  ok(zl[0] && Math.abs(new Date(zl[0].accepted_at).getTime() - vor) < 60000, 'Zeitpunkt der Zustimmung gespeichert', zl[0] && new Date(zl[0].accepted_at).toISOString());
  ok(zl[0] && zl[0].kontext && zl[0].kontext.weg === 'kauf' && zl[0].kontext.text === avv.haekchenText(), 'Kontext: Weg kauf und Wortlaut des Haekchens');
  ok((await query(`SELECT COUNT(*)::int AS n FROM consent_log WHERE user_id = $1 AND art = 'widerruf_verzicht'`, [ku.id])).rows[0].n === 1, 'Widerrufsverzicht weiter protokolliert');
  s = await http(tk, 'GET', '/consent/avv');
  ok(s.d && s.d.aktuell === true && s.d.zugestimmt && s.d.zugestimmt.version === avv.AVV_VERSION, 'nach dem Kauf: aktuell');
  r = await http(tk, 'POST', '/consent', { art: 'avv', version: '0.1' });
  ok(r.status === 400 && r.d.error === 'nur_ueber_consent_avv', 'allgemeiner Consent-Endpunkt nimmt keinen AVV an', String(r.status));

  /* bestehender Partner */
  let c = await http(tp, 'GET', '/partner/cockpit');
  ok(c.status === 200 && c.d.avv && c.d.avv.aktuell === false, 'bestehender Partner: Cockpit meldet AVV nicht aktuell', c.status + ' ' + JSON.stringify(c.d && c.d.avv && c.d.avv.aktuell));
  r = await http(tp, 'POST', '/consent/avv', { version: avv.AVV_VERSION });
  ok(r.status === 400 && r.d.error === 'avv_fehlt', 'POST /consent/avv ohne Haekchen: 400', String(r.status));
  r = await http(tp, 'POST', '/consent/avv', { zugestimmt: true, version: avv.AVV_VERSION, weg: 'cockpit' });
  ok(r.status === 200 && r.d.aktuell === true, 'Zustimmung im Cockpit: aktuell', String(r.status));
  c = await http(tp, 'GET', '/partner/cockpit');
  ok(c.d && c.d.avv && c.d.avv.aktuell === true, 'Cockpit danach: aktuell, kein zweites Fragen');
  /* neue Version: die letzte Zustimmung traegt eine andere Version als die geltende */
  await query(`INSERT INTO consent_log (user_id, art, version, accepted_at, kontext) VALUES ($1, 'avv', '0.9', now() + interval '1 second', '{"pruefer":true}')`, [pu.id]);
  c = await http(tp, 'GET', '/partner/cockpit');
  ok(c.d && c.d.avv && c.d.avv.aktuell === false && c.d.avv.zugestimmt.version === '0.9', 'andere Version zuletzt zugestimmt: Cockpit fragt erneut', JSON.stringify(c.d && c.d.avv && c.d.avv.zugestimmt));
  r = await http(tp, 'POST', '/consent/avv', { zugestimmt: true, version: '0.9' });
  ok(r.status === 409, 'Zustimmung zu einer anderen als der geltenden Version: 409', String(r.status));
  await new Promise((f) => setTimeout(f, 1100));
  r = await http(tp, 'POST', '/consent/avv', { zugestimmt: true, version: avv.AVV_VERSION, weg: 'cockpit' });
  ok(r.status === 200 && r.d.aktuell === true, 'erneute Zustimmung zur geltenden Version: aktuell');

  /* Admin-Liste */
  const admin = require('./src/routes/resellerAdminPanel');
  const lage = admin.stack.find((l) => l.route && l.route.path === '/resellers' && l.route.methods.get);
  const antwort = await new Promise((fertig) => { lage.route.stack[lage.route.stack.length - 1].handle({}, { json: fertig, status: () => ({ json: fertig }) }); });
  const zeile = (antwort.resellers || []).find((x) => x.owner_email === PARTNER);
  ok(antwort.avv_version_aktuell === avv.AVV_VERSION && zeile && zeile.avv_version === avv.AVV_VERSION && zeile.avv_am, 'Admin-Partnerliste: AVV-Version und Datum', zeile && (zeile.avv_version + ' ' + new Date(zeile.avv_am).toISOString()));

  /* Aufbewahrung: Nachweis eines bestehenden Kontos bleibt ueber 3 Jahre */
  await query(`INSERT INTO consent_log (user_id, art, version, accepted_at, kontext) VALUES ($1, 'avv', '0.8', now() - interval '4 years', '{"pruefer":true}'),
               ($1, 'hinweise', 'pruefer', now() - interval '4 years', '{"pruefer":true}')`, [pu.id]);
  await consent.aufraeumen();
  const alt = (await query(`SELECT art FROM consent_log WHERE user_id = $1 AND accepted_at < now() - interval '3 years'`, [pu.id])).rows.map((x) => x.art);
  ok(alt.length === 1 && alt[0] === 'avv', 'Aufraeumen: alter AVV-Nachweis bleibt, alte andere Zustimmung geht', JSON.stringify(alt));

  await abraeumen();
}

(async () => {
  if (LIVE || BROWSER || RAEUMEN) await teilB(); else teilA();
  console.log('\n' + (fehlerZahl ? 'ROT · ' + fehlerZahl + ' Fehler' : 'GRUEN') + (gelb ? ' · ' + gelb + ' gelb' : ''));
  process.exit(fehlerZahl ? 1 : 0);
})().catch((e) => { console.error('FEHLER', e && e.stack || e); process.exit(1); });
