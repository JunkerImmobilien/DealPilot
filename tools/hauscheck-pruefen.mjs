#!/usr/bin/env node
/* tools/hauscheck-pruefen.mjs · v5130 KK6 · Prüfer des Haus-Check-Kaufwegs (backend/src/services/hausCheck.js)
   an der ECHTEN Datei, ohne DB, Stripe und Netz (gestellte deps):
     A  Eingaben: Pflichtfelder, MFH abgewiesen mit Hinweis Vermieten, nur EFH/ZFH/DHH/RH/ETW
     B  Kauf: Preis über lookup_key dp_hauscheck_999, Zeile mit produkt 'hauscheck', Checkout mit metadata.type hauscheck,
        Token nur im Fragment, Rückweg nur Pfad der Landing, kein Netto-Einkommen in der Zeile
     C  Webhook: fremder Preis schaltet nichts frei, nur produkt 'hauscheck' wird bezahlt, doppelt = already_processed
     D  Lesen: kaufLesen fragt nur hauscheck-Zeilen, Status ohne Anrechnung
     E  Wert: Verkehrswert nur mit Wertindikation, sonst vorläufig mit Weg, Beleihungswert-Hinweise ohne Gedankenstrich
     F  Stripe-Skript: Trockenlauf RC 2, Live nur mit Live-Schlüssel
   RC=0 sauber. */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
process.env.EINZELCHECK_SIEGEL_GEHEIM = process.env.EINZELCHECK_SIEGEL_GEHEIM || 'pruefer';
const hc = require(path.join(W, 'backend/src/services/hausCheck.js'));
require(path.join(W, 'backend/src/services/verkaufSchalter.js'))._setzeDeps({ query: async () => ({ rowCount: 1, rows: [] }) });   /* Tageszähler ohne DB */
const S = await import(pathToFileURL(path.join(W, 'tools/stripe-hauscheck-preis-anlegen.mjs')).href);

let rot = 0, gruen = 0;
function ok(b, t) { if (b) gruen++; else { rot++; console.log('ROT  ' + t); } }

/* gestellte Welt */
const db = [];
let sitzung = null, items = [], nr = 0;
const deps = {
  jetzt: () => Date.parse('2026-11-26T12:00:00Z'),
  query: async (sql, p) => {
    if (/^INSERT INTO einzelcheck_kaeufe/.test(sql)) { const id = 'k' + (db.length + 1); db.push({ id, token_hash: p[0], status: 'offen', zahlen: JSON.parse(p[1]), produkt: /'hauscheck'/.test(sql) ? 'hauscheck' : 'einzelcheck', gueltig_bis: p[5] }); return { rows: [{ id }] }; }
    if (/^UPDATE einzelcheck_kaeufe SET anrechnung_code/.test(sql)) { const z = db.find((x) => x.id === p[2]); z.anrechnung_code = p[0]; return { rowCount: 1 }; }
    if (/^UPDATE einzelcheck_kaeufe SET stripe_session_id/.test(sql)) { db.find((z) => z.id === p[1]).stripe_session_id = p[0]; return { rowCount: 1 }; }
    if (/^UPDATE einzelcheck_kaeufe SET status = 'bezahlt'/.test(sql)) {
      ok(/produkt = 'hauscheck'/.test(sql), 'C  Webhook setzt nur hauscheck-Zeilen auf bezahlt');
      const z = db.find((x) => x.stripe_session_id === p[1] && x.status === 'offen' && x.produkt === 'hauscheck');
      if (!z) return { rowCount: 0, rows: [] }; z.status = 'bezahlt'; return { rowCount: 1, rows: [{ id: z.id, gueltig_bis: z.gueltig_bis, amount_cents: 999 }] };
    }
    if (/^SELECT status FROM einzelcheck_kaeufe/.test(sql)) { const z = db.find((x) => x.stripe_session_id === p[0]); return { rowCount: z ? 1 : 0, rows: z ? [{ status: z.status }] : [] }; }
    if (/^SELECT \* FROM einzelcheck_kaeufe/.test(sql)) { ok(/produkt = 'hauscheck'/.test(sql), 'D  kaufLesen fragt nur hauscheck-Zeilen'); return { rows: db.filter((x) => x.token_hash === p[0] && x.produkt === 'hauscheck') }; }
    throw new Error('unerwartete Abfrage: ' + sql.slice(0, 60));
  },
  stripe: () => ({
    promotionCodes: { create: async (o) => { ok(o.coupon === 'dp_hauscheck_anrechnung' && o.max_redemptions === 1 && /^HC[0-9A-F]{10}$/.test(o.code), 'C  Anrechnungs-Code auf dp_hauscheck_anrechnung, einmal'); return { id: 'promo_t' }; } },
    prices: { list: async (o) => { ok(o.lookup_keys[0] === 'dp_hauscheck_999', 'B  Preis über lookup_key dp_hauscheck_999'); return { data: [{ id: 'price_t', unit_amount: 999, currency: 'eur', type: 'one_time', lookup_key: 'dp_hauscheck_999', product: { name: 'DealPilot Haus-Check' } }] }; } },
    checkout: { sessions: {
      create: async (o) => { sitzung = o; nr++; return { id: 'cs_t' + nr, url: 'https://checkout.stripe.test/x' }; },
      listLineItems: async () => ({ data: items })
    } }
  })
};
hc._setzeDeps(deps);

/* A */
const gut = { kp: 395000, wfl: 140, gsfl: 620, bj: 2009, art: 'EFH', ek_eur: 80000, plz: '32278' };
ok(hc.grundFehlt(gut).length === 0, 'A  vollständige Angaben');
ok(hc.grundFehlt({ kp: 1 }).indexOf('wfl') >= 0 && hc.grundFehlt({ kp: 1 }).indexOf('plz') >= 0, 'A  fehlende Angaben werden genannt');
let fehler = null; try { await hc.kaufAnlegen({ grund: Object.assign({}, gut, { art: 'MFH' }) }); } catch (e) { fehler = e; }
ok(fehler && fehler.code === 'mfh' && /Vermieten/.test(fehler.message), 'A  MFH abgewiesen mit Hinweis Modus Vermieten');
fehler = null; try { await hc.kaufAnlegen({ grund: Object.assign({}, gut, { art: 'GEW' }) }); } catch (e) { fehler = e; }
ok(fehler && fehler.code === 'objektart', 'A  Gewerbe abgewiesen');
ok(hc.ARTEN.join() === 'EFH,ZFH,DHH,RH,ETW', 'A  nur EFH, ZFH, DHH, RH, ETW');

ok(hc.grundFehlt(Object.assign({}, gut, { gsfl: null })).indexOf('gsfl') >= 0, 'A  Haus ohne Grundstücksfläche: Pflicht');
ok(hc.grundFehlt(Object.assign({}, gut, { art: 'ETW', gsfl: null })).length === 0, 'A  ETW ohne Grundstücksfläche erlaubt');

/* B */
const k = await hc.kaufAnlegen({ grund: Object.assign({}, gut, { netto: 5400 }), rueckweg: '/haus-check.html' });
ok(db.length === 1 && db[0].produkt === 'hauscheck', 'B  Zeile mit produkt hauscheck');
ok(!('netto' in db[0].zahlen), 'B  kein Netto-Einkommen in der Zeile');
ok(sitzung && sitzung.metadata.type === 'hauscheck' && sitzung.payment_intent_data.metadata.type === 'hauscheck', 'B  Checkout metadata.type hauscheck');
ok(sitzung && /\/haus-check\.html\?hauscheck=bezahlt#hc=/.test(sitzung.success_url) && sitzung.success_url.endsWith(k.token), 'B  Token nur im Fragment, Rückweg haus-check.html');
ok(sitzung.automatic_tax.enabled === false && sitzung.mode === 'payment', 'B  Einmalzahlung ohne automatische Steuer (§ 19 UStG)');
await hc.kaufAnlegen({ grund: gut, rueckweg: 'https://boese.example/x' });
ok(/\/haus-check\.html\?/.test(sitzung.success_url) && !/boese/.test(sitzung.success_url), 'B  fremder Rückweg wird verworfen');

/* C */
items = [{ price: { lookup_key: 'dp_einzelcheck_399' } }];
let r = await hc.handlePaid({ id: 'cs_t1', mode: 'payment', payment_status: 'paid', metadata: { type: 'hauscheck' } });
ok(r.ok === false && r.reason === 'fremder_preis' && db[0].status === 'offen', 'C  fremder Preis schaltet nichts frei');
r = await hc.handlePaid({ id: 'cs_t1', mode: 'payment', payment_status: 'paid', metadata: { type: 'einzelcheck' } });
ok(r.ok === false && r.reason === 'not_hauscheck', 'C  Einzel-Check-Sitzung wird hier nicht verbucht');
items = [{ price: { lookup_key: 'dp_hauscheck_999' } }];
r = await hc.handlePaid({ id: 'cs_t1', mode: 'payment', payment_status: 'paid', metadata: { type: 'hauscheck' } });
ok(r.ok === true && db[0].status === 'bezahlt' && r.anrechnung === true && /^HC/.test(db[0].anrechnung_code || ''), 'C  richtiger Preis: bezahlt, Anrechnungs-Code angelegt');
r = await hc.handlePaid({ id: 'cs_t1', mode: 'payment', payment_status: 'paid', metadata: { type: 'hauscheck' } });
ok(r.ok === true && r.reason === 'already_processed', 'C  doppelt: already_processed');

/* D */
const z = await hc.kaufLesen(k.token);
ok(z && z.status === 'bezahlt', 'D  Kauf lesbar');
const st = hc.statusAus(Object.assign({}, z, { gueltig_bis: new Date(Date.now() + 864e5) }));
ok(st.anrechnung && /^HC/.test(st.anrechnung.code) && !('mails_rest' in st), 'D  Status mit Anrechnung, ohne Mailzähler');
const _alt = process.env.HAUSCHECK_AKTIV, _ec = process.env.EINZELCHECK_AKTIV;
process.env.EINZELCHECK_AKTIV = '1'; process.env.HAUSCHECK_AKTIV = '0'; ok(hc.aktiv() === false, 'D  eigener Schalter: HAUSCHECK_AKTIV=0 sperrt trotz EINZELCHECK_AKTIV=1');
process.env.EINZELCHECK_AKTIV = '0'; process.env.HAUSCHECK_AKTIV = '1'; ok(hc.aktiv() === true, 'D  eigener Schalter: HAUSCHECK_AKTIV=1 frei trotz EINZELCHECK_AKTIV=0');
if (_alt === undefined) delete process.env.HAUSCHECK_AKTIV; else process.env.HAUSCHECK_AKTIV = _alt; if (_ec === undefined) delete process.env.EINZELCHECK_AKTIV; else process.env.EINZELCHECK_AKTIV = _ec;

/* E */
const voll = hc.hausWert({ verfuegbar: true, wertindikation: { wert_eur: 410245, verfahren: 'sachwert' },
  verfahren: [{ art: 'sachwert', verfuegbar: true, wert_eur: 410245, marktangepasst: true, rechenweg: [{ pos: 'x', wert: 1 }] }, { art: 'ertragswert', verfuegbar: true, wert_eur: 298000 }], quellen: [] });
ok(voll.vollstaendig === true && voll.betrag === 410245 && voll.ertragswert === 298000, 'E  Wertindikation: vollständig, Ertragswert stützend');
const vorl = hc.hausWert({ verfuegbar: true, wertindikation: null, wertindikation_grund: 'Ohne Sachwertfaktor kein Marktwert.',
  verfahren: [{ art: 'sachwert', verfuegbar: true, wert_eur: 300000, marktangepasst: false }] });
ok(vorl.vollstaendig === false && vorl.verfahren === 'sachwert' && /Sachwertfaktor/.test(vorl.weg), 'E  ohne Sachwertfaktor: vorläufig mit Weg');
ok(hc.hausWert({ verfuegbar: false, text: 'Ohne Anschrift' }).verfuegbar === false, 'E  ohne Wert kein Betrag');
const b = hc.belwAus({ verfuegbar: true, beleihungswert: 381000, basis: 'sachwert_4_2', eigennutzung: true, hinweise: ['A - B; C'], auslauf: { auslauf_pct: 73.5 } });
ok(b.beleihungswert === 381000 && b.eigennutzung && b.auslauf_pct === 73.5 && !/[–—;]| - /.test(b.hinweise[0]), 'E  Beleihungswert übernommen, Hinweise ohne Gedankenstrich und Semikolon');

const nk = hc.nhkSauber({ haus: '1', geschosse: '1', dach: '1', ausst: 'normal', boese: 'x' });
ok(nk.nhk_haus === '1' && nk.nhk_geschosse === '1' && nk.nhk_dach === '1' && nk.ausst === 'normal' && !('boese' in nk), 'E  NHK-Angaben nur über die Weißliste');
ok(Object.keys(hc.nhkSauber({ haus: '9', dach: 'x' })).length === 0, 'E  ungültige NHK-Angaben fallen weg');

/* F */
ok(S.sicherung({ ausfuehren: false }).rc === 2, 'F  Stripe-Skript Trockenlauf RC 2');
ok(S.sicherung({ ausfuehren: true, live: true, schluessel: 'sk_test_x' }).rc === 3, 'F  --live mit Testschlüssel abgelehnt');
ok(S.sicherung({ ausfuehren: true, live: false, schluessel: 'sk_live_x' }).rc === 3, 'F  ohne --live kein Live-Schlüssel');
ok(S.PREIS.unit_amount === 999 && S.PREIS.lookup_key === hc.LOOKUP_KEY, 'F  Skript und Dienst nennen denselben lookup_key, 999 Cent');
ok(S.COUPON.id === hc.ANRECHNUNG_COUPON && S.COUPON.amount_off === 999 && S.COUPON.duration === 'once', 'F  Skript legt den Anrechnungs-Coupon 9,99 € einmal an, gleiche ID wie der Dienst');

/* N · pp6 Datenschutz: das Netto-Einkommen verlässt den Browser nie (Datenschutzerklärung 1.8).
   Der Server druckt die Fassung ohne Netto, kein Aufruf an den Server trägt netto oder die Quote. */
{
  const fs = await import('node:fs');
  const kauf = fs.readFileSync(path.join(W, 'frontend/landing/haus-check-kauf.js'), 'utf8');
  const pdfBody = (kauf.match(/fetch\(API \+ '\/pdf'[^;]*/) || [''])[0];
  ok(/html: htmlServer/.test(pdfBody) && !/html: html\b/.test(pdfBody), 'N  /pdf bekommt die Fassung ohne Netto (htmlServer)');
  ok(/var ohne = A\.html\([^\n]*netto: 0\b/.test(kauf) && !/var ohne = A\.html\([^\n]*e\.netto/.test(kauf) && !/var basis = [^\n]*netto/.test(kauf), 'N  Fassung für den Server rechnet mit netto 0, die Grundangaben tragen kein Netto');
  const posts = kauf.match(/post\('\/[a-z]+', \{[^)]*\)/g) || [];
  ok(posts.length >= 3 && posts.every((p) => !/netto|quote|leistbar/i.test(p)), 'N  kein post() trägt netto oder die Quote (' + posts.length + ' Aufrufe)');
  const pdfJs = fs.readFileSync(path.join(W, 'frontend/js/haus-check-pdf.js'), 'utf8');
  ok(/Gut tragbar ab einem Netto-Einkommen von/.test(pdfJs), 'N  PDF ohne Netto nennt das nötige Netto für grün');
  /* Gegenprobe: die alte Zeile (Netto im Body) würde rot */
  ok(!/html: htmlServer/.test("fetch(API + '/pdf', { body: JSON.stringify({ token: t, html: html, titel: x }) })"), 'N  Gegenprobe greift');
}

console.log((rot ? 'ROT' : 'sauber') + ' · ' + gruen + ' grün, ' + rot + ' rot');
process.exit(rot ? 1 : 0);
