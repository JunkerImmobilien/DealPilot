#!/usr/bin/env node
/* tools/einzelcheck-pruefen.mjs — v3940 / v3941 · Einzel-Check der Landing (ohne Netz, ohne Datenbank)
 *
 *   node tools/einzelcheck-pruefen.mjs        RC=0 sauber
 *
 * Geprüft am ECHTEN Dienst backend/src/services/einzelcheck.js (mit echtem schwaerzen.js und
 * dokumentSchemas.js, nachgebauter KI, Datenbank, Stripe und Marktbericht-Dienst) und an den echten
 * Dateien der Route, des Webhooks, der Migration, des mb-Dienstes und des Frontends:
 *   A Speicher-only: memoryStorage, kein fs-Schreiben im Lauf, keine Datei/kein Text/kein Name in der DB,
 *     pdftotext über stdin/stdout (echter Lauf, wenn pdftotext installiert ist)
 *   B Schwärzen VOR dem KI-Aufruf (Reihenfolge je Unterlage, Name/E-Mail/Geburtsdatum nicht bei der KI)
 *   C Bremse: express-rate-limit je Route (auslesen 3 je Tag und IP), Tagesdeckel in Euro für den freien Teil
 *   D kostenlos höchstens 2 Unterlagen (Server liest nur 2, günstiges Modell; Browser sendet nur 2)
 *   E Bericht nur mit gültigem, bezahltem Kauf-Token (und höchstens 3 je Kauf)
 *   F Frist 14 Tage (Rechnung, Migration CHECK, Löschtakt unter takt(), Anrechnungs-Code läuft mit ab)
 *   G Preis aus dem lookup_key (Betrag aus Stripe, kein Betrag im Code)
 *   H Webhook: nur bezahlt, nur unser Preis, einmal; Anrechnung als Promotion-Code auf festen Coupon
 *   I Zahlen-Weissliste (keine Namen, keine Anschrift im Zahlenstand)
 *   J Siegel: manipulierte Zahlen werden beim Kauf abgewiesen
 *   K Marktbericht-Dienst ohne Ablage, keine Quellennamen nach außen, v3941: STUFE 2 (keine Wertindikation
 *     aus Stufe 3, kein Ertrags-/Sachwert im Ergebnis, Satz mit dem Weg in die App, KI-Kosten erfasst)
 *   L v3941 · gescannte PDFs: Texterkennung NUR im Speicher (ocr.js ocrAusPuffer: pdftoppm und tesseract über
 *     stdin/stdout, fs-Spion), höchstens 6 Seiten, Zeitlimit, Schwärzen danach, zählt im freien Teil mit
 *   M v3941 · Rabatt-Vorrang: der Anrechnungs-Code EC… ersetzt in den Paketlinks den Flyer-Code
 *     (die App liest den ersten code=), Satz „nicht kombinierbar“
 *   GEGENPROBE: jede Sperre einzeln aus einer Kopie im Speicher entfernt -> der zugehörige Teil muss rot werden.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn as spawnEcht } from 'node:child_process';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const P = {
  dienst: path.join(WURZEL, 'backend/src/services/einzelcheck.js'),
  route: path.join(WURZEL, 'backend/src/routes/publicEinzelcheck.js'),
  webhook: path.join(WURZEL, 'backend/src/routes/stripeWebhook.js'),
  index: path.join(WURZEL, 'backend/src/index.js'),
  takt: path.join(WURZEL, 'backend/src/utils/taktSperre.js'),
  kiv: path.join(WURZEL, 'backend/src/services/kiVerbrauch.js'),
  mig: path.join(WURZEL, 'backend/migrations/123_einzelcheck.sql'),
  mbApi: path.join(WURZEL, 'marktbericht/backend/src/routes/api.js'),
  mbOrch: path.join(WURZEL, 'marktbericht/backend/src/services/ReportOrchestrator.js'),
  mbGeo: path.join(WURZEL, 'marktbericht/backend/src/services/GeocodingService.js'),
  front: path.join(WURZEL, 'frontend/landing/einzelcheck.js'),
  faecher: path.join(WURZEL, 'frontend/landing/landing-faecher.js'),
  ocr: path.join(WURZEL, 'backend/src/services/ocr.js'),
  flyerApp: path.join(WURZEL, 'frontend/js/flyer-code.js'),
  flyerLanding: path.join(WURZEL, 'frontend/landing/flyer-code.js')
};
const lies = (p) => fs.readFileSync(p, 'utf8');
const ohneKommentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

process.env.EINZELCHECK_SIEGEL = 'pruefer-geheimnis-nur-fuer-den-test-0123456789';
process.env.EINZELCHECK_MODELL_VOLL = 'modell-voll-test';
delete process.env.EINZELCHECK_MODELL_FREI;
process.env.LANDING_URL = 'https://staging.dealpilot.immo';

const schwaerzen = require(path.join(WURZEL, 'backend/src/services/schwaerzen.js'));
const dokumentSchemas = require(path.join(WURZEL, 'backend/src/services/dokumentSchemas.js'));

function ladeAusText(pfad, text) {
  const m = new Module(pfad, null);
  m.filename = pfad;
  m.paths = Module._nodeModulePaths(path.dirname(pfad));
  m._compile(text, pfad);
  return m.exports;
}

/* ── Testdaten: vier „PDFs“ (Puffer mit %PDF-Kopf), ihr Text liegt im nachgebauten pdftotext ─── */
const NAME = 'Mustermann', MAIL = 'max.mustermann@example.com', GEB = '01.02.1960', STRASSE = 'Musterweg 17';
const TEXTE = {
  expose: 'Exposé Eigentumswohnung. Ansprechpartner Herr Max Mustermann, ' + MAIL + ', Telefon 0170 1234567. '
    + 'Objekt ' + STRASSE + ', 32609 Hüllhorst. Kaufpreis 180.000 €, Wohnfläche 100 m², Kaltmiete 1.300 € im Monat, Baujahr 1968. '.repeat(3),
  mieter: 'Mietaufstellung zum 01.10.2026. Einheit 1, Wohnung EG, Mieter Herr Erich Beispiel geb. ' + GEB + ', Kaltmiete 1.250 €. Summe Kaltmiete 1.250 €. '.repeat(2),
  weg: 'Protokoll der Eigentümerversammlung vom 12.05.2026. Anwesend Frau Erika Mustermann, wohnhaft ' + STRASSE + ' 32609 Hüllhorst. Instandhaltungsrücklage 48.000 €. Beschluss Sonderumlage. '.repeat(2),
  energie: 'Energieausweis für Wohngebäude nach GEG. Energieeffizienzklasse D. Endenergieverbrauch 118 kWh. Baujahr Gebäude 1968. '.repeat(2),
  scan: ''   /* gescannt: keine Textebene, nur die Texterkennung liest ihn */
};
/* v3941 · was die Texterkennung aus dem Scan liest (mit Personendaten, die vor der KI fallen müssen) */
const SCAN_TEXT = 'Exposé Mehrfamilienhaus. Ansprechpartner Herr Max Mustermann, ' + MAIL + '. Kaufpreis 520.000 €, Wohnfläche 410 m², Kaltmiete 2.900 € im Monat. '.repeat(2);
const SCAN = pdf('scan', 'Scan.pdf');
function pdf(id, name) { const b = Buffer.from('%PDF-1.4\n%' + id + '\n'); return { buffer: b, size: b.length, mimetype: 'application/pdf', originalname: name || (id + '.pdf') }; }
const DATEIEN = [pdf('expose', 'Expose.pdf'), pdf('mieter', 'Mietaufstellung.pdf'), pdf('weg', 'WEG-Protokoll.pdf'), pdf('energie', 'Energieausweis.pdf')];

/* ── Nachbauten ───────────────────────────────────────────────────────── */
function umgebung(opt) {
  opt = opt || {};
  const log = [], ki = [], sql = [], tab = new Map(), stripeLog = [], kiPosten = [];
  let uhr = Date.UTC(2026, 10, 20, 10, 0, 0);
  const sw = { schwaerze: function (t) { log.push('schwaerzen'); return schwaerzen.schwaerze(t); } };
  const openai = {
    extractExpose: async function (text, o) { log.push('ki'); ki.push({ text, model: o && o.model, art: 'expose' });
      return { success: true, model: o.model, extracted: { adresse: STRASSE + ', 32609 Hüllhorst', plz: '32609', ort: 'Hüllhorst', kaufpreis: 180000, wohnflaeche: 100, nettokaltmiete: 1300,
        baujahr: 1968, objektart: 'Eigentumswohnung', name: 'Max Mustermann', verkaeufer: NAME, risiken: [{ titel: 'Ansprechpartner Herr Max Mustermann', beschreibung: 'Kontakt ' + MAIL, schwere: 'niedrig' }] } }; },
    extractDokument: async function (text, typ, o) { log.push('ki'); ki.push({ text, model: o && o.model, art: typ });
      const x = { mietaufstellung: { summe_kaltmiete_monat_eur: 1250, einheiten: [{ nr: '1', nutzung: 'wohnen', wfl_m2: 100, kaltmiete_eur: 1250, mieter: 'Erich Beispiel' }] },
        weg_protokoll: { ruecklage_stand_eur: 48000, verwalter: 'Hausverwaltung Mustermann', sonderumlagen_geplant: [{ status: 'beschlossen', betrag_einheit_eur: 2500 }], risiken: [{ titel: 'Dach', schwere: 'hoch' }] },
        energieausweis: { energieeffizienzklasse: 'D', endenergie_kwh_m2a: 118, baujahr_gebaeude: 1968 } }[typ] || {};
      return { success: true, model: o.model, extracted: x }; }
  };
  const pdfText = async function (buf) { log.push('pdf'); const id = /%(\w+)\n/.exec(buf.toString('latin1').slice(8)); return TEXTE[id && id[1]] || ''; };
  const ocr = async function (buf) { log.push('ocr'); const id = /%(\w+)\n/.exec(buf.toString('latin1').slice(8));
    return (id && id[1] === 'scan' && !opt.ocrLeer) ? { roh: SCAN_TEXT, seiten: 2, konfidenz: 88, woerter: 40, lesbar: true, abgeschnitten: false } : { roh: '', seiten: 1, konfidenz: 0, woerter: 0, lesbar: false }; };
  const kiVerbrauch = { erfasseFremdPosten: function (l, o) { kiPosten.push({ l, o }); return 0.0123; } };
  const query = async function (text, params) {
    sql.push({ text, params: params || [] });
    if (/INSERT INTO einzelcheck_kaeufe/.test(text)) {
      const id = 'k' + (tab.size + 1);
      tab.set(id, { id, token_hash: params[0], status: 'offen', zahlen: JSON.parse(params[1]), amount_cents: params[2], currency: params[3], erstellt_am: params[4], gueltig_bis: params[5], berichte: 0 });
      return { rows: [{ id }], rowCount: 1 };
    }
    if (/UPDATE einzelcheck_kaeufe SET stripe_session_id/.test(text)) { tab.get(params[1]).stripe_session_id = params[0]; return { rowCount: 1, rows: [] }; }
    if (/SELECT \* FROM einzelcheck_kaeufe WHERE token_hash/.test(text)) { const z = [...tab.values()].find((r) => r.token_hash === params[0]); return { rows: z ? [z] : [] }; }
    if (/SET status = 'bezahlt'/.test(text)) {
      const z = [...tab.values()].find((r) => r.stripe_session_id === params[1] && r.status === 'offen' && new Date(r.gueltig_bis).getTime() > uhr);
      if (!z) return { rowCount: 0, rows: [] };
      z.status = 'bezahlt'; return { rowCount: 1, rows: [{ id: z.id, gueltig_bis: z.gueltig_bis, amount_cents: z.amount_cents }] };
    }
    if (/SELECT status FROM einzelcheck_kaeufe/.test(text)) { const z = [...tab.values()].find((r) => r.stripe_session_id === params[0]); return { rowCount: z ? 1 : 0, rows: z ? [{ status: z.status }] : [] }; }
    if (/SET anrechnung_code/.test(text)) { const z = tab.get(params[2]); z.anrechnung_code = params[0]; z.anrechnung_promo_id = params[1]; return { rowCount: 1 }; }
    if (/SET berichte = berichte \+ 1/.test(text)) { const z = tab.get(params[0]); z.berichte++; z.zahlen = JSON.parse(params[1]); return { rowCount: 1 }; }
    if (/FROM ki_verbrauch/.test(text)) return { rows: [{ eur: opt.tagEur || 0 }] };
    if (/DELETE FROM einzelcheck_kaeufe/.test(text)) return { rowCount: 2 };
    return { rows: [], rowCount: 0 };
  };
  const stripe = {
    prices: { list: async function (a) { stripeLog.push(['prices.list', a]); return { data: (a.lookup_keys || []).indexOf('dp_einzelcheck_399') >= 0 ? [{ id: 'price_test_ec', unit_amount: opt.betrag || 517, currency: 'eur', type: 'one_time', lookup_key: 'dp_einzelcheck_399', product: { name: 'Einzel-Check' } }] : [] }; } },
    checkout: { sessions: {
      create: async function (a) { stripeLog.push(['session', a]); return { id: 'cs_test_' + stripeLog.length, url: 'https://checkout.stripe.test/x' }; },
      listLineItems: async function () { return { data: [{ quantity: 1, price: { lookup_key: opt.fremd ? 'dp_einzeln_wev' : 'dp_einzelcheck_399' } }] }; } } },
    promotionCodes: { create: async function (a) { stripeLog.push(['promo', a]); return { id: 'promo_test_1' }; } }
  };
  const mbFetch = async function (url, init) {
    stripeLog.push(['mb', url, JSON.parse(init.body)]);
    /* v3941 · Antwort wie Stufe 2 - mit einem cross_check, den der Dienst trotzdem NICHT lesen darf */
    const daten = { ai_mode: 'openai', cost: { geomap_eur: 0.38, openai_posten: [{ modell: 'gpt-4.1-mini', usage: { prompt_tokens: 9000, completion_tokens: 1500 } }] },
      report_md: '## Lage\nRuhige Wohnlage mit guter Anbindung; Schulen in der Nähe.\n\nDie Angebote bei ImmobilienScout liegen höher.\n\n## Wert\nDer Ertragswert liegt bei 185.000 €.\n\n## Markt\n- Preise 2020–2025 stabil',
      data: { micro: { score: 64 }, macro: { score: 58 }, address: { city: 'Hüllhorst', postcode: '32609' }, ref: { ags: '05770016', wert_stufe: 2 },
      valuation: { market_value: { estimated: 190000, low: 170000, high: 210000, basis_median_sqm: 1900, angebot_abschlag: { pct: 10, herkunft: 'Marktdurchschnitt GeoMap', roh: { estimated: 211000 } } },
        inputs: { market_rent_sqm: 9.1 }, yield: { gross_yield_pct: 8.2 } },
      price_trend_pct: 2.1, rent_trend_pct: 1.4, days_on_market: 61, wertermittlungsstichtag: { datum: '2026-11-21', eigen: false },
      cross_check: { ertragswert: { available: true, value_eur: 185000, liegenschaftszins_pct: 2.9, miete_vergleich_qm: 7.8, miete_stufe: { etikett: 'ImmobilienScout-Angebote' } }, sachwert: { available: false, grund: 'Sachwertfaktor fehlt' } },
      wertermittlung_herkunft: { kurz: 'amtlich', indikativ: false } } };
    return { ok: true, text: async () => JSON.stringify(daten) };
  };
  return { log, ki, sql, tab, stripeLog, kiPosten, deps: { pdfText, ocr, kiVerbrauch, schwaerzen: sw, dokumentSchemas, openai, query, stripe: () => stripe, mbFetch, jetzt: () => uhr },
    uhr: (t) => { uhr = t; }, jetzt: () => uhr };
}

/* ── Die Teile ────────────────────────────────────────────────────────── */
const TEILE = {};
TEILE.A = async function (svc, q) {
  const f = [];
  const route = ohneKommentar(q.route), dienst = ohneKommentar(q.dienst);
  if (!/multer\.memoryStorage\(\)/.test(route) || /diskStorage|\bdest\s*:/.test(route)) f.push('Route ohne memoryStorage oder mit Plattenablage');
  if (/require\(['"](node:)?fs['"]\)/.test(dienst + route)) f.push('Dienst/Route laden fs');
  /* v3941 · ocr.js nur über ocrAusPuffer (Speicher); bildZuText/bilderZuText schreiben nach tmpdir */
  if (/bildZuText|bilderZuText/.test(dienst + route) || (/require\(['"]\.\/ocr['"]\)/.test(dienst) && !/require\('\.\/ocr'\)\.ocrAusPuffer\(/.test(dienst))) f.push('Dienst nutzt den tmpdir-Weg von ocr.js');
  if (!/spawn\('pdftotext', \[[^\]]*'-', '-'\]/.test(dienst)) f.push('pdftotext nicht über stdin/stdout');
  /* echter Lauf mit Spionen auf fs */
  const U = umgebung(); svc._setzeDeps(U.deps);
  const spione = ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'createWriteStream', 'copyFileSync', 'renameSync', 'mkdtempSync'];
  const alt = {}, treffer = [];
  spione.forEach((n) => { alt[n] = fs[n]; fs[n] = function () { treffer.push(n); }; });
  const altP = fs.promises.writeFile; fs.promises.writeFile = async function () { treffer.push('promises.writeFile'); };
  try {
    const frei = await svc.auslesen(DATEIEN.slice(0, 2), 'frei');
    const k = await svc.kaufAnlegen({ zahlen: frei.zahlen, siegelWert: svc.siegel(frei.zahlen) });
    const sess = U.stripeLog.find((x) => x[0] === 'session')[1];
    await svc.handleEinzelcheckPaid({ id: [...U.tab.values()][0].stripe_session_id, mode: 'payment', payment_status: 'paid', metadata: sess.metadata });
    const z = await svc.kaufLesen(k.token);
    const voll = await svc.auslesen(DATEIEN, 'voll');
    await svc.auslesen([SCAN], 'frei');   /* v3941 · gescannt: Texterkennung im selben Spion-Lauf */
    await svc.berichtGezaehlt(z.id, voll.zahlen);
    await svc.markt(voll.zahlen, voll._adresse);
    if (JSON.stringify(voll).indexOf(STRASSE) >= 0) f.push('Anschrift steht in der JSON-Antwort');
  } finally {
    spione.forEach((n) => { fs[n] = alt[n]; }); fs.promises.writeFile = altP; svc._setzeDeps(null);
  }
  if (treffer.length) f.push('fs-Schreiben im Lauf: ' + treffer.join(', '));
  const db = JSON.stringify(U.sql.map((s) => s.params));
  if (U.sql.some((s) => s.params.some((p) => Buffer.isBuffer(p)))) f.push('ein Datei-Puffer ging an die Datenbank');
  [NAME, MAIL, GEB, STRASSE, 'Exposé Eigentumswohnung', 'Hausverwaltung'].forEach((x) => { if (db.indexOf(x) >= 0) f.push('in der Datenbank steht „' + x + '“'); });
  return f;
};
TEILE.A2 = async function () {
  /* echter pdftotext über stdin/stdout, wenn vorhanden (sonst übersprungen) */
  /* nur poppler-utils (wie im Backend-Image) liest von stdin; xpdf (Git für Windows) kann das nicht */
  const v = spawnSync('pdftotext', ['-v'], { encoding: 'utf8' });
  if (v.error || !/poppler/i.test(String(v.stdout || '') + String(v.stderr || ''))) return null;
  const inhalt = 'BT /F1 18 Tf 72 720 Td (Kaufpreis 180000 Euro Wohnflaeche 100 qm Einzel-Check Pruefer) Tj ET';
  const teile = ['%PDF-1.4\n', '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n', '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>endobj\n',
    '4 0 obj<</Length ' + inhalt.length + '>>stream\n' + inhalt + '\nendstream endobj\n', '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n'];
  let pos = 0; const off = []; teile.forEach((t, i) => { if (i) off.push(pos); pos += t.length; });
  const xref = 'xref\n0 6\n0000000000 65535 f \n' + off.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  const buf = Buffer.from(teile.join('') + xref + 'trailer<</Size 6/Root 1 0 R>>\nstartxref\n' + pos + '\n%%EOF', 'latin1');
  const vorher = fs.readdirSync(os.tmpdir()).length;
  const svc = require(P.dienst);
  const t = await svc._pdfText(buf);
  const f = [];
  if (!/Kaufpreis 180000/.test(t)) f.push('pdftotext lieferte nicht den Text: ' + JSON.stringify(t.slice(0, 80)));
  if (fs.readdirSync(os.tmpdir()).length > vorher) f.push('im tmpdir ist eine Datei dazugekommen');
  return f;
};
TEILE.B = async function (svc) {
  const f = [], U = umgebung(); svc._setzeDeps(U.deps);
  try { await svc.auslesen(DATEIEN, 'voll'); } finally { svc._setzeDeps(null); }
  /* je Unterlage: pdf -> schwaerzen -> ki */
  /* (danach schwärzt anzeigeAus die KI-Antwort noch einmal - das zählt hier nicht) */
  const folge = U.log.slice(0, U.log.lastIndexOf('ki') + 1).join(' ');
  if (folge !== 'pdf schwaerzen ki pdf schwaerzen ki pdf schwaerzen ki pdf schwaerzen ki') f.push('Reihenfolge je Unterlage: ' + folge);
  U.ki.forEach((k) => { [NAME, MAIL, GEB, '0170 1234567'].forEach((x) => { if (k.text.indexOf(x) >= 0) f.push('KI (' + k.art + ') bekam „' + x + '“'); }); });
  if (U.ki.length !== 4) f.push('KI-Aufrufe ' + U.ki.length + ' statt 4');
  return f;
};
TEILE.C = async function (svc, q) {
  const f = [], route = ohneKommentar(q.route);
  if (!/require\('express-rate-limit'\)/.test(route)) f.push('Route nutzt nicht express-rate-limit');
  if (!/bremseAuslesen = bremse\(TAG, 3,/.test(route) || !/const TAG = 24 \* 60 \* 60 \* 1000/.test(route)) f.push('Bremse auslesen nicht 3 je 24 h');
  [['auslesen', 'bremseAuslesen'], ['kaufen', 'bremseKaufen'], ['status', 'bremseStatus'], ['bericht', 'bremseBericht']].forEach(([r, b]) => {
    if (!new RegExp("router\\.post\\('/" + r + "', " + b + ',').test(route)) f.push('/' + r + ' ohne ' + b + ' als erste Stufe');
  });
  if (!/keyGenerator: function \(req\) \{ return 'ec:' \+ ipSchluessel\(req\)/.test(route)) f.push('Bremse nicht je IP');
  if (!/router\.use\(function \(req, res, next\) \{\s*if \(!ec\.aktiv\(\)\)/.test(route)) f.push('Schalter „nur Staging“ fehlt vor den Routen');
  /* Tagesdeckel (alle Besucher zusammen) */
  const U1 = umgebung({ tagEur: 4.99 }); svc._setzeDeps(U1.deps); const a = await svc.freiMoeglich();
  const U2 = umgebung({ tagEur: 5.00 }); svc._setzeDeps(U2.deps); const b = await svc.freiMoeglich(); svc._setzeDeps(null);
  if (!(a.ok && !b.ok)) f.push('Tagesdeckel 5 €: 4,99 frei=' + a.ok + ', 5,00 frei=' + b.ok);
  if (!/if \(!deckel\.ok\) return res\.status\(503\)/.test(route)) f.push('/auslesen prüft den Tagesdeckel nicht');
  /* Schalter */
  const altA = process.env.APP_URL, altS = process.env.EINZELCHECK_AKTIV;
  delete process.env.EINZELCHECK_AKTIV;
  process.env.APP_URL = 'https://app.dealpilot.immo'; const prod = svc.aktiv();
  process.env.APP_URL = 'https://app.staging.dealpilot.immo'; const stg = svc.aktiv();
  if (altA === undefined) delete process.env.APP_URL; else process.env.APP_URL = altA;
  if (altS !== undefined) process.env.EINZELCHECK_AKTIV = altS;
  if (prod || !stg) f.push('Schalter: Prod aktiv=' + prod + ', Staging aktiv=' + stg);
  return f;
};
TEILE.D = async function (svc, q) {
  const f = [], U = umgebung(); svc._setzeDeps(U.deps);
  let r; try { r = await svc.auslesen(DATEIEN, 'frei'); } finally { svc._setzeDeps(null); }
  if (U.ki.length !== 2 || U.log.filter((x) => x === 'pdf').length !== 2) f.push('frei: ' + U.ki.length + ' KI-Aufrufe, ' + U.log.filter((x) => x === 'pdf').length + ' PDFs gelesen (erwartet je 2)');
  if (U.ki.some((k) => k.model !== 'gpt-4.1-mini')) f.push('frei: Modell ' + U.ki.map((k) => k.model).join(','));
  if (!r || r.nicht_gelesen.length !== 2) f.push('frei: nicht gelesene Unterlagen nicht gemeldet');
  if (r && Object.prototype.hasOwnProperty.call(r, '_adresse')) f.push('frei: Anschrift im Ergebnis');
  const front = ohneKommentar(q.front);
  if (!/var teil = S\.dateien\.slice\(0, INFO\.frei_max\)/.test(front) || !/body: formular\(teil\)/.test(front)) f.push('Browser schickt im freien Teil nicht nur die ersten zwei');
  const U2 = umgebung(); svc._setzeDeps(U2.deps); try { await svc.auslesen(DATEIEN, 'voll'); } finally { svc._setzeDeps(null); }
  if (U2.ki.length !== 4 || U2.ki.some((k) => k.model !== 'modell-voll-test')) f.push('voll: ' + U2.ki.length + ' Aufrufe, Modell ' + U2.ki.map((k) => k.model).join(','));
  return f;
};
TEILE.E = async function (svc, q) {
  const f = [], j = Date.UTC(2026, 10, 20), bis = new Date(j + 5 * 86400000).toISOString();
  const fall = (z) => svc.berichtErlaubt(z, j);
  if (fall(null).ok) f.push('ohne Kauf erlaubt');
  if (fall({ status: 'offen', gueltig_bis: bis, berichte: 0 }).ok) f.push('unbezahlt erlaubt');
  if (fall({ status: 'bezahlt', gueltig_bis: new Date(j - 1).toISOString(), berichte: 0 }).ok) f.push('abgelaufen erlaubt');
  if (fall({ status: 'bezahlt', gueltig_bis: bis, berichte: 3 }).ok) f.push('vierter Bericht erlaubt');
  if (!fall({ status: 'bezahlt', gueltig_bis: bis, berichte: 2 }).ok) f.push('bezahlter, gültiger Kauf abgewiesen');
  const U = umgebung(); svc._setzeDeps(U.deps);
  const n0 = U.sql.length; const z = await svc.kaufLesen('kurz'); const n1 = U.sql.length;
  svc._setzeDeps(null);
  if (z !== null || n1 !== n0) f.push('Token ohne gültige Form wird nachgeschlagen');
  const route = ohneKommentar(q.route);
  const i1 = route.indexOf('const darf = ec.berichtErlaubt(z);'), i2 = route.indexOf("ec.auslesen(dateien, 'voll')");
  if (i1 < 0 || i2 < 0 || i1 > i2 || !/if \(!darf\.ok\) return res\.status/.test(route)) f.push('/bericht prüft den Kauf nicht vor dem Auslesen');
  if (!/const t = String\(\(req\.body && req\.body\.token\) \|\| ''\);/.test(route)) f.push('/bericht liest das Token nicht aus dem Formular');
  return f;
};
TEILE.F = async function (svc, q) {
  const f = [], j = Date.UTC(2026, 10, 20, 10);
  const g = svc.gueltigBis(j).getTime();
  if (g - j !== 14 * 86400000) f.push('Frist ' + (g - j) / 86400000 + ' Tage statt 14');
  if (!svc.istGueltig({ gueltig_bis: new Date(g) }, g - 1) || svc.istGueltig({ gueltig_bis: new Date(g) }, g)) f.push('istGueltig an der Grenze falsch');
  if (!/CHECK \(gueltig_bis <= erstellt_am \+ interval '14 days'\)/.test(q.mig)) f.push('Migration ohne CHECK 14 Tage');
  if (/\b(name|adresse|anschrift|email|datei|text)\s+(text|bytea|jsonb)/i.test(q.mig.replace(/--.*$/gm, ''))) f.push('Migration hat eine Spalte für Namen/Anschrift/Datei');
  if (!/DELETE FROM einzelcheck_kaeufe WHERE gueltig_bis < now\(\)/.test(q.dienst)) f.push('Löschen nach Ablauf fehlt');
  if (!/_einzelcheckLoeschen = _ts\.takt\('einzelcheckLoeschen'/.test(q.dienst) || !/setInterval\(_einzelcheckLoeschen,/.test(q.dienst)) f.push('Löschtakt nicht unter takt()');
  if (!/einzelcheckLoeschen: \d+/.test(q.takt)) f.push('Schlüssel einzelcheckLoeschen fehlt in SCHLUESSEL');
  if (!/require\('\.\/services\/einzelcheck'\)\.starteTakt\(\)/.test(q.index)) f.push('index.js startet den Löschtakt nicht');
  /* Anrechnungs-Code läuft mit der Frist ab, einmal einlösbar */
  const U = umgebung(); svc._setzeDeps(U.deps);
  try {
    const frei = await svc.auslesen(DATEIEN.slice(0, 2), 'frei');
    await svc.kaufAnlegen({ zahlen: frei.zahlen, siegelWert: svc.siegel(frei.zahlen) });
    const z = [...U.tab.values()][0];
    await svc.handleEinzelcheckPaid({ id: z.stripe_session_id, mode: 'payment', payment_status: 'paid', metadata: U.stripeLog.find((x) => x[0] === 'session')[1].metadata });
    const p = U.stripeLog.find((x) => x[0] === 'promo');
    if (!p || p[1].expires_at !== Math.floor(new Date(z.gueltig_bis).getTime() / 1000) || p[1].max_redemptions !== 1) f.push('Anrechnungs-Code: ' + JSON.stringify(p && p[1]));
    if (new Date(z.gueltig_bis).getTime() - new Date(z.erstellt_am).getTime() !== 14 * 86400000) f.push('gespeicherte Frist nicht 14 Tage');
    U.uhr(new Date(z.gueltig_bis).getTime() + 1);
    const s = svc.statusAus(z);
    if (s.status !== 'abgelaufen' || s.zahlen !== null || s.anrechnung !== null) f.push('nach Ablauf noch Zahlen oder Anrechnung: ' + JSON.stringify(s));
  } finally { svc._setzeDeps(null); }
  return f;
};
TEILE.G = async function (svc, q) {
  const f = [], U = umgebung({ betrag: 517 }); svc._setzeDeps(U.deps);
  try {
    const frei = await svc.auslesen(DATEIEN.slice(0, 1), 'frei');
    const k = await svc.kaufAnlegen({ zahlen: frei.zahlen, siegelWert: svc.siegel(frei.zahlen) });
    const pl = U.stripeLog.find((x) => x[0] === 'prices.list');
    if (!pl || JSON.stringify(pl[1].lookup_keys) !== '["dp_einzelcheck_399"]') f.push('Preis nicht über den lookup_key gesucht');
    const s = U.stripeLog.find((x) => x[0] === 'session')[1];
    if (s.line_items[0].price !== 'price_test_ec' || s.mode !== 'payment') f.push('Checkout nicht mit dem gefundenen Preis (mode payment)');
    if (k.amount_cents !== 517 || [...U.tab.values()][0].amount_cents !== 517) f.push('Betrag nicht aus Stripe: ' + k.amount_cents);
    if (s.automatic_tax && s.automatic_tax.enabled !== false) f.push('Steuer eingeschaltet (Kleinunternehmer)');
    if (!s.invoice_creation || !s.invoice_creation.enabled) f.push('keine Rechnung (invoice_creation)');
  } finally { svc._setzeDeps(null); }
  [['Dienst', q.dienst], ['Route', q.route], ['Frontend', q.front]].forEach(([n, t]) => {
    const c = ohneKommentar(t);
    if (/\b399\b(?!['"_])|3[,.]99|unit_amount:\s*\d/.test(c.replace(/dp_einzelcheck_399/g, ''))) f.push(n + ': Betrag steht im Code');
  });
  if (!/window\.DpEinzelCheck\.preis = INFO\.amount_cents \/ 100/.test(q.front)) f.push('Frontend nimmt den Preis nicht vom Server');
  return f;
};
TEILE.H = async function (svc, q) {
  const f = [];
  for (const [name, opt, sitz, soll] of [['bezahlt', {}, { payment_status: 'paid' }, true], ['unbezahlt', {}, { payment_status: 'unpaid' }, false], ['fremder Preis', { fremd: true }, { payment_status: 'paid' }, false]]) {
    const U = umgebung(opt); svc._setzeDeps(U.deps);
    try {
      const frei = await svc.auslesen(DATEIEN.slice(0, 1), 'frei');
      await svc.kaufAnlegen({ zahlen: frei.zahlen, siegelWert: svc.siegel(frei.zahlen) });
      const z = [...U.tab.values()][0];
      const se = Object.assign({ id: z.stripe_session_id, mode: 'payment', metadata: { type: 'einzelcheck', kauf_id: z.id } }, sitz);
      const r1 = await svc.handleEinzelcheckPaid(se);
      if ((z.status === 'bezahlt') !== soll) f.push(name + ': Status ' + z.status);
      if (soll) {
        const r2 = await svc.handleEinzelcheckPaid(se);
        if (r2.reason !== 'already_processed' || U.stripeLog.filter((x) => x[0] === 'promo').length !== 1) f.push('zweite Zustellung nicht idempotent');
        const pc = U.stripeLog.find((x) => x[0] === 'promo')[1];
        if (pc.coupon !== 'dp_einzelcheck_anrechnung') f.push('Coupon ' + pc.coupon);
        if (!r1.anrechnung || !z.anrechnung_code) f.push('Anrechnungs-Code nicht gespeichert');
      }
    } finally { svc._setzeDeps(null); }
  }
  if (!/session\.metadata\?\.type === 'einzelcheck'/.test(q.webhook) || !/handleEinzelcheckPaid\(session\)/.test(q.webhook)) f.push('Webhook-Zweig fehlt');
  return f;
};
TEILE.I = async function (svc) {
  const f = [];
  const z = svc.zahlenSauber({ kp: 180000, name: 'Max Mustermann', adresse: STRASSE, verwalter: 'X', plz: '32609', ort: 'Hüllhorst', art: 'ETW', wfl: '100', nkm: 'Mustermann',
    ek_klasse: 'D; DROP', zustand: 'saniert', bj: 3000 });
  const keys = Object.keys(z).sort().join(',');
  if (keys !== 'art,kp,ort,plz,wfl,zustand') f.push('Weissliste ließ durch: ' + keys);
  const U = umgebung(); svc._setzeDeps(U.deps);
  let r; try { r = await svc.auslesen(DATEIEN, 'voll'); } finally { svc._setzeDeps(null); }
  const s = JSON.stringify(r.zahlen);
  [NAME, STRASSE, 'Erich', 'Hausverwaltung'].forEach((x) => { if (s.indexOf(x) >= 0) f.push('Zahlenstand enthält „' + x + '“'); });
  if (r.zahlen.nkm !== 1250 || r.zahlen.kp !== 180000 || r.zahlen.ruecklage_stand !== 48000 || r.zahlen.ek_klasse !== 'D') f.push('Zahlen falsch gelesen: ' + s);
  const anz = JSON.stringify(r.unterlagen);
  if (anz.indexOf(MAIL) >= 0 || anz.indexOf('Herr Max Mustermann') >= 0) f.push('Anzeige zeigt Personendaten aus der KI-Antwort');
  return f;
};
TEILE.J = async function (svc) {
  const f = [], U = umgebung(); svc._setzeDeps(U.deps);
  try {
    const frei = await svc.auslesen(DATEIEN.slice(0, 2), 'frei');
    const s = svc.siegel(frei.zahlen);
    let fehler = null;
    try { await svc.kaufAnlegen({ zahlen: Object.assign({}, frei.zahlen, { kp: 1000 }), siegelWert: s }); } catch (e) { fehler = e.code; }
    if (fehler !== 'siegel') f.push('manipulierte Zahlen angenommen');
    if (U.tab.size !== 0) f.push('trotz falschem Siegel ein Kauf angelegt');
  } finally { svc._setzeDeps(null); }
  return f;
};
TEILE.K = async function (svc, q) {
  const f = [];
  if (!/const OHNE_ABLAGE = !!\(opts && opts\.ohneAblage\)/.test(q.mbOrch) || !/\(NUR_WERT \|\| OHNE_ABLAGE\) \? \{ id: null \}/.test(q.mbOrch)) f.push('mb: ohneAblage am Property-Eintrag fehlt');
  const iRet = q.mbOrch.indexOf('if (OHNE_ABLAGE) {'), iIns = q.mbOrch.indexOf('INSERT INTO mb.valuation_results');
  if (iRet < 0 || iRet > iIns) f.push('mb: Lauf ohne Ablage endet nicht vor den INSERTs');
  if (!/GeocodingService\.geocode\(input\.address, \{ ohneAblage: OHNE_ABLAGE \}\)/.test(q.mbOrch) || !/if \(opts && opts\.ohneAblage\) return/.test(q.mbGeo)) f.push('mb: Geocoding schreibt mb.addresses');
  const blk = (q.mbApi.split("router.post('/reports/einzelcheck'")[1] || '').split('router.post(')[0];
  if (!blk || /saveFixture/.test(blk) || !/ohneAblage: true/.test(blk)) f.push('mb: Route /reports/einzelcheck fehlt oder speichert');
  const U = umgebung(); svc._setzeDeps(U.deps);
  let m; try { m = await svc.markt({ plz: '32609', ort: 'Hüllhorst', wfl: 100, kp: 180000, nkm: 1300, art: 'ETW' }, STRASSE + ', 32609 Hüllhorst'); } finally { svc._setzeDeps(null); }
  const mbAufruf = U.stripeLog.find((x) => x[0] === 'mb');
  if (!mbAufruf || !/\/reports\/einzelcheck$/.test(mbAufruf[1])) f.push('Dienst ruft nicht /reports/einzelcheck');
  if (mbAufruf && (mbAufruf[2].user_id || mbAufruf[2].external_ref)) f.push('mb-Aufruf trägt Nutzer oder Objektbezug');
  /* v3941 · Stufe 2: angefragt wird 2 ohne fast (wie die App), und der mb-Dienst begrenzt selbst auf 2 */
  if (mbAufruf && (mbAufruf[2].wert_stufe !== 2 || mbAufruf[2].fast)) f.push('angefragt Stufe ' + mbAufruf[2].wert_stufe + (mbAufruf[2].fast ? ' (Schnellmodus)' : '') + ' statt 2 wie in der App');
  if (!/b\.wert_stufe = Math\.min\(2, /.test(blk)) f.push('mb: /reports/einzelcheck begrenzt die Stufe nicht auf 2');
  const mj = JSON.stringify(m);
  if (!m.verfuegbar || m.markt.wert !== 190000 || m.markt.miete_qm !== 9.1 || m.lage.ags !== '05770016' || m.stufe !== 2 || m.stichtag !== '2026-11-21') f.push('Marktdaten nicht übernommen: ' + mj.slice(0, 200));
  if (!m.markt.abschlag || m.markt.abschlag.pct !== 10 || m.markt.abschlag.vor_abschlag !== 211000 || m.markt.abschlag.herkunft !== 'Marktdurchschnitt') f.push('Abschlag/Kennzeichnung der Marktpreisindikation: ' + JSON.stringify(m.markt.abschlag));
  if (m.wert !== undefined || /185000|2\.9\b|ertragswert|sachwert|liegenschaftszins/i.test(mj)) f.push('Wertindikation aus Stufe 3 im Ergebnis: ' + mj.slice(0, 160));
  if (m.vergleichsmiete !== null) f.push('Vergleichsmiete aus dem Ertragswert übernommen');
  if (!m.wertermittlung || m.wertermittlung.in_app !== true) f.push('Weg in die App fehlt im Ergebnis');
  /* KI-Text: bereinigt, ohne Quellen- und Wertermittlungssatz, nur Punkt und Komma */
  const tx = (m.text || []).map((x) => x.text).join(' | ');
  if (!/Ruhige Wohnlage mit guter Anbindung, Schulen in der Nähe\./.test(tx) || !/Preise 2020 bis 2025 stabil/.test(tx)) f.push('KI-Text nicht übernommen oder nicht bereinigt: ' + tx);
  if (/;|–|—|ImmobilienScout|Ertragswert/.test(tx)) f.push('KI-Text mit Semikolon/Gedankenstrich/Quelle/Wertsatz: ' + tx);
  if ((m.text || []).some((x) => x.art === 'h' && x.text === 'Wert')) f.push('leere Überschrift im KI-Text');
  /* Kosten: KI-Posten erfasst (Weg des Berichts, ohne Nutzer), nicht im Ergebnis */
  const kp = U.kiPosten[0];
  if (!kp || kp.o.endpunkt !== 'public/einzelcheck/bericht' || kp.o.userId !== null || !Array.isArray(kp.l) || kp.l.length !== 1) f.push('KI-Kosten des Marktberichts nicht erfasst: ' + JSON.stringify(kp && kp.o));
  if (/openai_posten|geomap/i.test(mj)) f.push('Kosten oder Quelle im Ergebnis');
  if (!m._kosten || m._kosten.marktdaten_eur !== 0.38) f.push('Kosten nicht am Ergebnis (nicht aufzählbar)');
  if (JSON.stringify(m).match(/immobilienscout|immo\s*scout/i)) f.push('Quellenname nach außen: ' + JSON.stringify(m.vergleichsmiete));
  const front = ohneKommentar(q.front);
  if (/immobilienscout|immo\s*scout|geomap|pricehubble|sprengnetter/i.test(front)) f.push('Quellenname im Frontend');
  if (/\.ertragswert|\.sachwert|liegenschaftszins_pct|ausschuss_link/.test(front)) f.push('Frontend liest noch die Wertindikation der Stufe 3');
  if (!/Die Wertermittlung nach amtlichen Daten findest du in DealPilot\./.test(front) || !/D\.esc\(WERT_WEG\)/.test(front)) f.push('Satz mit dem Weg in die App fehlt im Bericht');
  return f;
};

/* v3941 · L · gescannte PDFs */
function pdfSeiten(n) {
  /* ein echtes PDF mit n Seiten (für pdftoppm) */
  const inhalt = 'BT /F1 18 Tf 72 720 Td (Seite) Tj ET';
  const objs = ['<</Type/Catalog/Pages 2 0 R>>'];
  const kids = []; for (let i = 0; i < n; i++) kids.push((3 + i * 2) + ' 0 R');
  objs.push('<</Type/Pages/Kids[' + kids.join(' ') + ']/Count ' + n + '>>');
  for (let i = 0; i < n; i++) {
    objs.push('<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]/Resources<</Font<</F1 ' + (3 + n * 2) + ' 0 R>>>>/Contents ' + (4 + i * 2) + ' 0 R>>');
    objs.push('<</Length ' + inhalt.length + '>>stream\n' + inhalt + '\nendstream');
  }
  objs.push('<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>');
  let t = '%PDF-1.4\n'; const off = [];
  objs.forEach((o, i) => { off.push(t.length); t += (i + 1) + ' 0 obj' + o + '\nendobj\n'; });
  const x = t.length;
  t += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + off.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')
    + 'trailer<</Size ' + (objs.length + 1) + '/Root 1 0 R>>\nstartxref\n' + x + '\n%%EOF';
  return Buffer.from(t, 'latin1');
}
/* Nachgebaute Prozesse (node -e): pdftoppm liefert ein PNG je Seite (Seiten aus PDF_SEITEN, danach RC 99),
   tesseract prüft, dass ein PNG über stdin kam, und antwortet als TSV; LANGSAM=1 schläft. */
const NACHBAU = [
  'const ch=[];process.stdin.on("data",d=>ch.push(d));process.stdin.on("end",()=>{',
  'const b=Buffer.concat(ch),a=JSON.parse(process.env.EC_ARGS),rolle=process.env.EC_ROLLE;',
  'if(rolle==="pdftoppm"){const n=+a[a.indexOf("-f")+1];if(n>+process.env.PDF_SEITEN){process.stderr.write("Wrong page range");process.exit(99);}',
  'if(a[a.length-1]!=="-"||b.slice(0,5).toString("latin1")!=="%PDF-"){process.exit(3);}',
  'process.stdout.write(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from("seite"+n)]));return;}',
  'if(a[0]!=="stdin"||a[1]!=="stdout"||b[1]!==80||b[2]!==78||b[3]!==71){process.exit(4);}',
  'const out=()=>{process.stdout.write("level\\tpage_num\\tblock_num\\tpar_num\\tline_num\\tword_num\\tleft\\ttop\\twidth\\theight\\tconf\\ttext\\n");',
  'for(let i=0;i<8;i++)process.stdout.write("5\\t1\\t1\\t1\\t1\\t"+(i+1)+"\\t0\\t0\\t1\\t1\\t91\\tWort"+i+"\\n");};',
  'if(process.env.LANGSAM==="1")setTimeout(out,8000);else out();});'
].join('');
function nachbauStarter(protokoll, opt) {
  return function (befehl, args, o) {
    const echtPdf = opt.echtPdftoppm && befehl === 'pdftoppm';
    protokoll.push({ befehl, args: args.slice(), echt: echtPdf });
    if (echtPdf) return spawnEcht(befehl, args, o);
    const env = Object.assign({}, (o && o.env) || process.env, { EC_ARGS: JSON.stringify(args), EC_ROLLE: befehl, PDF_SEITEN: String(opt.seiten || 2), LANGSAM: opt.langsam ? '1' : '0' });
    return spawnEcht(process.execPath, ['-e', NACHBAU], Object.assign({}, o, { env }));
  };
}
TEILE.L = async function (svc, q) {
  const f = [];
  /* 1 · Dienst: Scan wird per Texterkennung gelesen, DANN geschwärzt, dann an die KI */
  const U = umgebung(); svc._setzeDeps(U.deps);
  let r; try { r = await svc.auslesen([SCAN], 'frei'); } finally { svc._setzeDeps(null); }
  const folge = U.log.slice(0, U.log.lastIndexOf('ki') + 1).join(' ');
  if (folge !== 'pdf ocr schwaerzen ki') f.push('Scan: Reihenfolge ' + folge + ' (erwartet pdf ocr schwaerzen ki)');
  if (!r.unterlagen[0] || !r.unterlagen[0].gelesen || !r.unterlagen[0].texterkennung) f.push('Scan nicht gelesen: ' + JSON.stringify(r.unterlagen[0]));
  U.ki.forEach((k) => { [NAME, MAIL].forEach((x) => { if (k.text.indexOf(x) >= 0) f.push('KI bekam aus dem Scan „' + x + '“'); }); });
  const U0 = umgebung({ ocrLeer: true }); svc._setzeDeps(U0.deps);
  let r0; try { r0 = await svc.auslesen([SCAN], 'frei'); } finally { svc._setzeDeps(null); }
  if (!r0.unterlagen[0] || r0.unterlagen[0].grund !== 'kein_text' || U0.ki.length) f.push('Scan ohne erkannten Text: ' + JSON.stringify(r0.unterlagen[0]));
  /* 2 · im kostenlosen Teil zählt ein Scan wie jede andere Unterlage */
  const U2 = umgebung(); svc._setzeDeps(U2.deps);
  let r2; try { r2 = await svc.auslesen([SCAN, DATEIEN[0], DATEIEN[1]], 'frei'); } finally { svc._setzeDeps(null); }
  if (U2.ki.length !== 2 || r2.nicht_gelesen.length !== 1) f.push('frei mit Scan: ' + U2.ki.length + ' KI-Aufrufe, ' + r2.nicht_gelesen.length + ' nicht gelesen (erwartet 2 und 1)');
  /* 3 · ocr.js im Text: ocrAusPuffer ohne fs, pdftoppm stdin -> stdout, tesseract stdin -> stdout */
  const ocrText = ohneKommentar(q.ocr);
  const koerper = (ocrText.split('async function ocrAusPuffer(')[1] || '').split('\nfunction _setzeStarter')[0]
    + (ocrText.split('function _imSpeicher(')[1] || '').split('\nasync function ocrAusPuffer')[0];
  if (!koerper.trim()) f.push('ocr.js: ocrAusPuffer/_imSpeicher fehlen');
  if (/\bfs\.|tmpdir|_datenUrlZuDatei|writeFile/.test(koerper)) f.push('ocr.js: ocrAusPuffer berührt die Platte');
  if (!/'pdftoppm', \['-f', String\(n\), '-l', String\(n\), [^\]]*'-png', '-'\]/.test(koerper)) f.push('ocr.js: pdftoppm nicht stdin -> stdout (eine Seite je Aufruf)');
  if (!/'tesseract', \['stdin', 'stdout'/.test(koerper)) f.push('ocr.js: tesseract nicht stdin -> stdout');
  if (!/bildZuText\(dataUrl\)[\s\S]*_datenUrlZuDatei\(dataUrl\)/.test(ocrText)) f.push('ocr.js: der App-Weg bildZuText wurde verändert');
  /* 4 · echter Lauf von ocrAusPuffer mit fs-Spion: nachgebaute Prozesse, pdftoppm echt, wenn poppler da ist */
  const ocr = q.ocr === lies(P.ocr) ? require(P.ocr) : ladeAusText(P.ocr, q.ocr);
  const pv = spawnSync('pdftoppm', ['-v'], { encoding: 'utf8' });
  const popplerDa = !pv.error && /poppler/i.test(String(pv.stdout || '') + String(pv.stderr || ''));
  const spione = ['writeFileSync', 'writeFile', 'appendFileSync', 'appendFile', 'createWriteStream', 'copyFileSync', 'renameSync', 'mkdtempSync', 'openSync'];
  const lauf = async function (opt, pdfPuffer, ocrOpt) {
    const prot = [], alt = {}, treffer = [];
    ocr._setzeStarter(nachbauStarter(prot, opt));
    const vorher = fs.readdirSync(os.tmpdir()).length;
    spione.forEach((n) => { alt[n] = fs[n]; fs[n] = function () { treffer.push(n); return alt[n].apply(fs, arguments); }; });
    let erg = null, fehler = null; const t0 = Date.now();
    try { erg = await ocr.ocrAusPuffer(pdfPuffer, ocrOpt); } catch (e) { fehler = e; }
    finally { spione.forEach((n) => { fs[n] = alt[n]; }); ocr._setzeStarter(null); }
    return { prot, treffer, erg, fehler, ms: Date.now() - t0, neu: fs.readdirSync(os.tmpdir()).length - vorher };
  };
  const acht = pdfSeiten(8);
  const a = await lauf({ seiten: 8, echtPdftoppm: popplerDa }, acht);
  if (a.fehler) f.push('ocrAusPuffer: ' + a.fehler.message);
  else {
    const tess = a.prot.filter((x) => x.befehl === 'tesseract').length, ppm = a.prot.filter((x) => x.befehl === 'pdftoppm').length;
    if (tess !== 6 || ppm !== 6 || a.erg.seiten !== 6) f.push('8 Seiten: ' + ppm + ' pdftoppm, ' + tess + ' tesseract, ' + a.erg.seiten + ' gelesen (erwartet je 6)');
    if (!/Wort0/.test(a.erg.roh) || !(a.erg.konfidenz > 80)) f.push('Text der Texterkennung kam nicht an: ' + JSON.stringify(a.erg).slice(0, 120));
  }
  if (a.treffer.length) f.push('fs-Schreiben in ocrAusPuffer: ' + a.treffer.join(', '));
  if (a.neu > 0) f.push('im tmpdir ist eine Datei dazugekommen');
  const zwei = await lauf({ seiten: 2 }, pdfSeiten(2));
  if (zwei.fehler || zwei.erg.seiten !== 2 || zwei.prot.filter((x) => x.befehl === 'pdftoppm').length !== 3) f.push('2 Seiten: Seitenende nicht erkannt ' + JSON.stringify(zwei.erg || (zwei.fehler && zwei.fehler.message)));
  /* 5 · Zeitlimit: tesseract hängt, nach der Frist ist Schluss (gekürzt, nicht gewartet) */
  const z = await lauf({ seiten: 3, langsam: true }, pdfSeiten(3), { zeitMs: 1500 });
  if (z.fehler || !z.erg.abgeschnitten || z.erg.grund !== 'zeit' || z.ms > 5000) f.push('Zeitlimit: ' + (z.fehler ? z.fehler.message : JSON.stringify(z.erg)) + ' nach ' + z.ms + ' ms');
  /* 6 · Dienst ruft genau ocrAusPuffer mit den Grenzen 6 Seiten */
  if (!/require\('\.\/ocr'\)\.ocrAusPuffer\(buffer, \{ maxSeiten: OCR_SEITEN, zeitMs: OCR_ZEIT_MS \}\)/.test(q.dienst) || !/const OCR_SEITEN = 6;/.test(q.dienst)) f.push('Dienst ruft ocrAusPuffer nicht mit 6 Seiten');
  if (!popplerDa) console.log('       (L: pdftoppm nachgebaut, kein poppler hier; echter Lauf ist Staging-Abnahme im Container)');
  return f;
};
/* v3941 · M · Rabatt-Vorrang */
function fnAus(text, kopf) {
  const i = text.indexOf(kopf); if (i < 0) return null;
  let t = 0, j = text.indexOf('{', i);
  for (let k = j; k < text.length; k++) { if (text[k] === '{') t++; else if (text[k] === '}') { t--; if (!t) return text.slice(i, k + 1); } }
  return null;
}
TEILE.M = async function (svc, q) {
  const f = [];
  const quelle = fnAus(q.front, 'function mitCode(href, code)');
  if (!quelle) return ['mitCode() fehlt im Frontend'];
  const mitCode = new Function('location', quelle + '; return mitCode;')({ href: 'https://staging.dealpilot.immo/' });
  for (const [name, datei] of [['App', q.flyerApp], ['Landing', q.flyerLanding]]) {
    const aq = fnAus(datei, 'function ausQuery(suche)');
    if (!aq) { f.push(name + ': ausQuery() nicht gefunden'); continue; }
    const ausQuery = new Function(aq + '; return ausQuery;')();
    const suche = (u) => { try { return new URL(u).search; } catch (e) { return ''; } };
    const faelle = [
      ['Flyer-Code am Link, EC gewinnt', 'https://app.dealpilot.immo/?register=1&plan=pro&code=ERSTFLUG', 'EC1A2B3C4D5E', 'EC1A2B3C4D5E'],
      ['promo= am Link, EC gewinnt', 'https://app.dealpilot.immo/?promo=MESSE&register=1&plan=investor', 'EC1A2B3C4D5E', 'EC1A2B3C4D5E'],
      ['ohne Code am Link', 'https://app.dealpilot.immo/?register=1&plan=starter', 'EC1A2B3C4D5E', 'EC1A2B3C4D5E'],
      ['ohne EC bleibt der Flyer-Code', 'https://app.dealpilot.immo/?register=1&plan=pro&code=ERSTFLUG', null, 'ERSTFLUG']
    ];
    for (const [w, href, code, soll] of faelle) {
      const ist = ausQuery(suche(mitCode(href, code)));
      if (ist !== soll) f.push(name + ' liest „' + ist + '“ statt „' + soll + '“ (' + w + '): ' + mitCode(href, code));
    }
  }
  const front = ohneKommentar(q.front);
  if (!/if \(code && !frei\) href = mitCode\(href, code\)/.test(front)) f.push('paketeEinsetzen setzt den Code nicht über mitCode()');
  if (!/Ein anderer Gutscheincode lässt sich mit der Anrechnung nicht kombinieren\./.test(front) || (front.match(/esc\(KOMBI\)/g) || []).length < 2) f.push('Satz „nicht kombinierbar“ fehlt in Ansicht oder PDF');
  return f;
};

/* ── Lauf ─────────────────────────────────────────────────────────────── */
let rot = 0;
const ok = (t) => console.log('  ok   ' + t);
const fehl = (t) => { rot++; console.log('  ROT  ' + t); };
function quellen(ueber) {
  const q = {};
  Object.keys(P).forEach((k) => { q[k] = lies(P[k]); });
  return Object.assign(q, ueber || {});
}
const NAMEN = { A: 'Speicher-only', A2: 'pdftotext echt über stdin/stdout', B: 'Schwärzen vor dem KI-Aufruf', C: 'Bremse und Schalter', D: 'kostenlos höchstens 2 Unterlagen',
  E: 'Bericht nur mit gültigem Kauf-Token', F: 'Frist 14 Tage', G: 'Preis aus dem lookup_key', H: 'Webhook', I: 'Zahlen-Weissliste', J: 'Siegel', K: 'Marktbericht Stufe 2 ohne Ablage, keine Quellennamen',
  L: 'gescannte PDFs: Texterkennung nur im Speicher', M: 'Rabatt-Vorrang Anrechnung vor Flyer-Code' };

console.log('einzelcheck-pruefen · v3941');
const svc = require(P.dienst);
const q0 = quellen();
for (const k of Object.keys(TEILE)) {
  let f;
  try { f = await TEILE[k](svc, q0); } catch (e) { f = ['Ausnahme: ' + e.message]; }
  if (f === null) { console.log("  --   " + k + " " + NAMEN[k] + " (übersprungen: kein poppler-pdftotext, Staging-Abnahme im Container)"); continue; }
  if (f.length) f.forEach((x) => fehl(k + ' ' + NAMEN[k] + ': ' + x)); else ok(k + ' ' + NAMEN[k]);
}

/* ── Gegenprobe: je eine Sperre entfernt -> der Teil muss rot werden ─── */
console.log('\nGegenprobe (je eine Sperre entfernt, Kopie im Speicher)');
const D = q0.dienst, R = q0.route;
const ersetze = (t, a, b) => { if (t.indexOf(a) < 0) throw new Error('Anker fehlt: ' + a.slice(0, 60)); return t.split(a).join(b); };
const GEGEN = [
  ['B', 'Schwärzen entfernt', { dienst: ersetze(D, 'const sw = d.schwaerzen.schwaerze(roh);', 'const sw = { text: roh, gesamt: 0 };') }],
  ['D', 'Grenze 2 entfernt', { dienst: ersetze(D, 'const max = voll ? VOLL_MAX_UNTERLAGEN : FREI_MAX_UNTERLAGEN;', 'const max = VOLL_MAX_UNTERLAGEN;') }],
  ['D', 'freies Modell = volles Modell', { dienst: ersetze(D, 'const modell = voll ? modellVoll() : modellFrei();', 'const modell = modellVoll();') }],
  ['E', 'Bezahlt-Prüfung entfernt', { dienst: ersetze(D, "if (zeile.status !== 'bezahlt') return { ok: false, code: 'nicht_bezahlt' };", '') }],
  ['E', 'Fristprüfung im Bericht entfernt', { dienst: ersetze(D, "if (!istGueltig(zeile, jetzt)) return { ok: false, code: 'kauf_abgelaufen' };", '') }],
  ['E', 'Route prüft den Kauf nicht', { route: ersetze(R, "if (!darf.ok) return res.status(darf.code === 'nicht_bezahlt' ? 402 : 403)", "if (false) return res.status(darf.code === 'nicht_bezahlt' ? 402 : 403)") }],
  ['F', 'Frist 30 statt 14 Tage', { dienst: ersetze(D, 'const FRIST_TAGE = 14;', 'const FRIST_TAGE = 30;') }],
  ['F', 'Löschtakt ohne takt()', { dienst: ersetze(D, "_ts.takt('einzelcheckLoeschen', ", '(') }],
  ['G', 'Betrag hart im Code', { dienst: ersetze(D, "[hash(token), JSON.stringify(z), p.amount_cents, p.currency,", "[hash(token), JSON.stringify(z), 399, p.currency,") }],
  ['A', 'Datei auf die Platte geschrieben', { dienst: ersetze(D, 'const sw = d.schwaerzen.schwaerze(roh);', "require('fs').writeFileSync(require('os').tmpdir() + '/ec.pdf', datei.buffer); const sw = d.schwaerzen.schwaerze(roh);") }],
  ['A', 'diskStorage statt memoryStorage', { route: ersetze(R, 'storage: multer.memoryStorage(),', "storage: multer.diskStorage({ destination: '/tmp' }),") }],
  ['C', 'Bremse auslesen entfernt', { route: ersetze(R, "router.post('/auslesen', bremseAuslesen, mitDateien,", "router.post('/auslesen', mitDateien,") }],
  ['C', 'Bremse 30 statt 3', { route: ersetze(R, 'bremseAuslesen = bremse(TAG, 3,', 'bremseAuslesen = bremse(TAG, 30,') }],
  ['C', 'Tagesdeckel umgangen', { dienst: ersetze(D, 'return { ok: v < tagesdeckelEur(),', 'return { ok: true,') }],
  ['H', 'Preisprüfung im Webhook entfernt', { dienst: ersetze(D, "if (!passt) { console.error('[einzelcheck-webhook] Sitzung ohne Preis ' + LOOKUP_KEY + ':', session.id); return { ok: false, reason: 'fremder_preis' }; }", '') }],
  ['H', 'unbezahlt angenommen', { dienst: ersetze(D, "if (session.payment_status && session.payment_status !== 'paid') return", "if (false) return") }],
  ['I', 'Weissliste abgeschaltet', { dienst: ersetze(D, '  z.unterlagen = liste.length;\n  return zahlenSauber(z);', '  z.unterlagen = liste.length;\n  return Object.assign({ name: ' + JSON.stringify(NAME) + ' }, z);') }],
  ['J', 'Siegel nicht geprüft', { dienst: ersetze(D, 'if (Object.keys(z).length && !siegelPruefen(z, siegelWert)) {', 'if (false) {') }],
  ['K', 'mb speichert wieder', { mbOrch: ersetze(q0.mbOrch, '(NUR_WERT || OHNE_ABLAGE) ? { id: null }', 'NUR_WERT ? { id: null }') }],
  /* v3941 */
  ['K', 'Stufe 3 angefragt', { dienst: ersetze(D, 'const MB_STUFE = 2;', 'const MB_STUFE = 3;') }],
  ['K', 'Schnellmodus statt Stufe 2 wie in der App', { dienst: ersetze(D, 'return { address: adr, wert_stufe: MB_STUFE,', 'return { address: adr, wert_stufe: MB_STUFE, fast: true,') }],
  ['K', 'Ertragswert wieder übernommen', { dienst: ersetze(D, '    vergleichsmiete: null,\n', '    vergleichsmiete: null, wert: { ertragswert: ((p.cross_check || {}).ertragswert || {}).value_eur },\n') }],
  ['K', 'mb begrenzt die Stufe nicht', { mbApi: ersetze(q0.mbApi, 'b.wert_stufe = Math.min(2, ', 'b.wert_stufe = Math.min(3, ') }],
  ['K', 'KI-Kosten nicht erfasst', { dienst: ersetze(D, "try { ki = deps().kiVerbrauch.erfasseFremdPosten(", "try { ki = 0 && deps().kiVerbrauch.erfasseFremdPosten(") }],
  ['K', 'Frontend zeigt wieder den Ertragswert', { front: ersetze(q0.front, "    if (mk && mk.qm > 0) z.push(", "    if (m.wert && m.wert.ertragswert > 0) z.push(['Ertragswert', eur(m.wert.ertragswert), 'ImmoWertV']);\n    if (mk && mk.qm > 0) z.push(") }],
  ['L', 'Texterkennung im Dienst entfernt', { dienst: ersetze(D, 'try { ocr = await d.ocr(datei.buffer); } catch (e) { ocr = null; }', 'ocr = null;') }],
  ['L', 'Texterkennung nach dem Schwärzen statt davor (Rohtext an die KI)', { dienst: ersetze(D, '  const sw = d.schwaerzen.schwaerze(roh);\n  const text = sw.text;', '  const sw = d.schwaerzen.schwaerze(roh);\n  const text = roh;') }],
  ['L', 'ocrAusPuffer schreibt nach tmpdir', { ocr: ersetze(q0.ocr, "  if (!Buffer.isBuffer(pdf) || !pdf.length) throw new Error('Texterkennung: kein PDF-Puffer');", "  if (!Buffer.isBuffer(pdf) || !pdf.length) throw new Error('Texterkennung: kein PDF-Puffer');\n  fs.writeFileSync(path.join(os.tmpdir(), 'ocr-ec.pdf'), pdf); try { fs.unlinkSync(path.join(os.tmpdir(), 'ocr-ec.pdf')); } catch (e) {}") }],
  ['L', 'Seitengrenze 20 statt 6', { ocr: ersetze(q0.ocr, 'const OCR_MAX_SEITEN = 6;', 'const OCR_MAX_SEITEN = 20;') }],
  ['L', 'kein Zeitlimit', { ocr: ersetze(q0.ocr, "    const uhr = setTimeout(function () { try { p.kill('SIGKILL'); } catch (e) {} ende(nein, Object.assign(new Error('Texterkennung: Zeitüberschreitung'), { code: 'ZEIT' })); }, fristMs);", "    const uhr = null;") }],
  ['L', 'freier Teil zählt den Scan nicht mit', { dienst: ersetze(D, 'const zuLesen = alle.slice(0, max);', 'const zuLesen = alle.slice(0, max + (alle[0] && /%scan/.test(alle[0].buffer.toString("latin1")) ? 1 : 0));') }],
  ['M', 'Code wieder nur angehängt', { front: ersetze(q0.front, "      if (code && !frei) href = mitCode(href, code).split('#')[0];", "      if (code && !frei) href += (href.indexOf('?') >= 0 ? '&' : '?') + 'code=' + encodeURIComponent(code);") }],
  ['M', 'mitCode lässt den Flyer-Code stehen', { front: ersetze(q0.front, "    ['code', 'promo', 'rabatt'].forEach(function (k) { u.searchParams.delete(k); });\n", '') }]
];
for (const [teil, was, ueber] of GEGEN) {
  const q = quellen(ueber);
  const s = ueber.dienst ? ladeAusText(P.dienst, ueber.dienst) : svc;
  let f;
  try { f = await TEILE[teil](s, q); } catch (e) { f = ['Ausnahme: ' + e.message]; }
  /* eine Ausnahme zählt nicht als Befund: rot werden muss die PRÜFUNG, nicht der Lauf */
  const echt = (f || []).filter((x) => !/^Ausnahme/.test(x));
  if (echt.length) ok(teil + ' wird rot, wenn ' + was + ' (' + echt[0].slice(0, 70) + ')');
  else fehl('Gegenprobe ' + teil + ': ' + was + ' bleibt GRÜN' + (f && f.length ? ' (nur Ausnahme: ' + f[0].slice(0, 80) + ')' : '') + ', der Prüfer sieht die Sperre nicht');
}

/* v3940a · Exposé-Erkennung: Lindenallee 14 kam auf Staging als Energieausweis an */
{
  const ex = svc.istExpose;
  const faelle = [
    ['Exposé mit Energieausweis-Abschnitt', ex('Exposé Lindenallee 14. Kaufpreis 480.000 Euro, Wohnfläche 520 m². Energieausweis Verbrauch 118 kWh, Klasse D.', 'unterlagen.pdf'), true],
    ['Dateiname exposé', ex('Objektbeschreibung', 'Expose-Objekt.pdf'), true],
    ['Verkaufsangebot ohne Wort Exposé', ex('Kaufpreis 300.000 Euro, Wohnfläche 90 m², Käuferprovision 3,57 Prozent', 'a.pdf'), true],
    ['reiner Energieausweis', ex('Energieausweis für Wohngebäude, Endenergiebedarf 118 kWh, Wohnfläche 520 m²', 'ea.pdf'), false],
    ['Mietaufstellung', ex('Mietaufstellung, Wohnung 1, Wohnfläche 60 m², Kaltmiete 480 Euro', 'mieten.pdf'), false]
  ];
  for (const [w, ist, soll] of faelle) { if (ist === soll) ok('Exposé-Erkennung: ' + w); else fehl('Exposé-Erkennung: ' + w + ' ergibt ' + ist); }
}

console.log('\n' + (rot ? 'ROT: ' + rot + ' Befund(e)' : 'GRÜN: alles sauber') + ' · RC=' + (rot ? 1 : 0));
process.exit(rot ? 1 : 0);
