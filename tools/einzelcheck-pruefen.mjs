#!/usr/bin/env node
/* tools/einzelcheck-pruefen.mjs — v3940 / v3941 / v3944 / v3946 · Einzel-Check der Landing (ohne Netz, ohne Datenbank)
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
 *   N v3944 · Vergleichsmiete (Auszug aus dem Quercheck vor der Stufensperre, nur Mietspiegel, amtlich, Näherung,
 *     ohne Treffer kein Wert) und Obergrenze für Investoren mit dem echten js/mietpotenzial-kern.js: Fälle mit
 *     Vergleichsmiete, ohne Vergleichsmiete, mit Bremse, Bremse ohne Vergleichsmiete, Näherung bei offener Bremse
 *   K v3946 · jetzt STUFE 3: Bodenrichtwert, Verfahren mit Herkunft, Wertindikation nur aus dem führenden Verfahren
 *     (nie ein Sachwert ohne Sachwertfaktor), ohne Anschrift kein Bodenrichtwert und kein Verfahren, Kapitel des
 *     KI-Texts ohne Buchstaben davor, keine Portal- und Datenbanknamen, Lizenzvermerke heil
 *   O v3946 · Finanzierung wie im Investment-PDF am echten Frontend mit den echten Kernen: Restschuld gegen den
 *     Tilgungsplan der Bank (calc.js v3029: 300.000 €, 3,8 %, 2 % -> 227.146 €), Anschluss 5 % mit derselben Tilgung,
 *     Cashflow und DSCR je Phase aus DealKpis, Laufzeit aus dem Monatsplan, keine eigene Zins- oder Tilgungsformel
 *   P v3946 · Grundangaben Pflicht (Server und Browser, dieselbe Liste), schlagen die gelesenen Werte, keine Anschrift
 *     einzelcheck-3: Pflicht erst beim KAUF, die Unterlagen kommen vorher (Marcel 24.11.2026 „erst auslesen“)
 *   S einzelcheck-3 · Bewertungsbericht (Marktbericht, Gutachten) mit eigenem Schema, nie als Exposé; Herkunft je Feld;
 *     Ablauf Unterlagen → Auslesen → Grundangaben vorbelegt; Widerspruch Eingabe gegen Unterlage nur per Wahl
 *     im Zahlenstand, Formular getrennt in Objekt und Finanzierung
 *   Q v3946 · nach dem Kauf kein zweites Hochladen: kein zweites Fenster, Ablage auf dem Gerät vor der Weiterleitung,
 *     Bericht startet nach der Rückkehr von selbst, Ablage gelöscht (fertig, Abbruch, Alter), Datenschutztext
 *   R v3946 · Bericht am echten pdf() mit dem echten dp-dokument.js: Kapitel mit Überschrift, keine Buchstaben davor,
 *     Bodenrichtwert und Wertindikation auf dem Deckblatt, Kundentext ohne Gedankenstrich, Semikolon, Quellennamen
 *   GEGENPROBE: jede Sperre einzeln aus einer Kopie im Speicher entfernt -> der zugehörige Teil muss rot werden.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync, spawn as spawnEcht } from 'node:child_process';
import vm from 'node:vm';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const P = {
  dienst: path.join(WURZEL, 'backend/src/services/einzelcheck.js'),
  schemas: path.join(WURZEL, 'backend/src/services/dokumentSchemas.js'),   /* einzelcheck-3 · Schema wertbericht */
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
  flyerLanding: path.join(WURZEL, 'frontend/landing/flyer-code.js'),
  /* v3944 · Vergleichsmiete und Obergrenze */
  mbVgl: path.join(WURZEL, 'marktbericht/backend/src/lib/vergleichsmiete_auszug.js'),
  kern: path.join(WURZEL, 'frontend/js/mietpotenzial-kern.js'),
  kappDaten: path.join(WURZEL, 'frontend/js/data/kappungsgrenzen.json')
};
/* v3944 · Zeilenenden auf LF: die Anker der Gegenprobe stehen mit \n, die Windows-Arbeitskopie hat CRLF (autocrlf) */
const lies = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
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
/* v3946 · Grundangaben des Käufers (Pflicht vor Auslesen und Kauf), erfunden */
const GRUND = { art: 'ETW', kp: 180000, nkm: 1300, wfl: 100, plz: '32609', ort: 'Hüllhorst', ek_eur: 20000, nk_pct: 10, zins_pct: 3.8, tilg_pct: 2, bindung_j: 10 };
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
    const ein = JSON.parse(init.body);
    stripeLog.push(['mb', url, ein]);
    /* v3946 · Antwort wie Stufe 3 (cross_check, land_value, quellen_nachweis), Strasse nur mit Anschrift */
    const daten = { ai_mode: 'openai', cost: { geomap_eur: 0.38, openai_posten: [{ modell: 'gpt-4.1-mini', usage: { prompt_tokens: 9000, completion_tokens: 1500 } }] },
      report_md: '# A) Zusammenfassung & Empfehlung\nSolide Wohnung.\n## Lage\nRuhige Wohnlage mit guter Anbindung; Schulen in der Nähe.\n\nDie Angebote bei ImmobilienScout liegen höher.\n\n## Wert\nDer Ertragswert liegt bei 185.000 €.\n\n## Markt\n- Preise 2020–2025 stabil\n- Der Bodenrichtwert stammt aus BORIS-NRW.',
      data: { micro: { score: 64 }, macro: { score: 58 }, address: Object.assign({ city: 'Hüllhorst', postcode: '32609' }, opt.ohneStrasse ? {} : { street: 'Musterweg' }),
      ref: { ags: '05770016', wert_stufe: ein.wert_stufe },
      land_value: { available: true, value_sqm: 95, stichtag: '2026-01-01', source: 'BORIS-NRW', quellenvermerk: 'Der obere Gutachterausschuss für Grundstückswerte im Land Nordrhein-Westfalen (www.boris.nrw.de), dl-de/by-2-0' },
      valuation: { market_value: { estimated: 190000, low: 170000, high: 210000, basis_median_sqm: 1900, angebot_abschlag: { pct: 10, herkunft: 'Marktdurchschnitt GeoMap', roh: { estimated: 211000 } } },
        inputs: { market_rent_sqm: 9.1 }, yield: { gross_yield_pct: 8.2 } },
      price_trend_pct: 2.1, rent_trend_pct: 1.4, days_on_market: 61, wertermittlungsstichtag: { datum: '2026-11-21', eigen: false },
      cross_check: ein.wert_stufe >= 3 ? Object.assign({ ertragswert: { available: true, value_eur: 185000, liegenschaftszins_pct: 2.9, liegenschaftszins_stufe: 'A', restnutzungsdauer_jahre: 38, gesamtnutzungsdauer_jahre: 80,
          miete_vergleich_qm: 7.8, miete_stufe: { etikett: 'ImmobilienScout-Angebote' } },
        sachwert: opt.swOhneFaktor ? { available: true, value_eur: 240000, marktangepasst: false } : { available: false, grund: 'Sachwert nicht ausgewiesen — es fehlt die BGF; siehe https://www.boris.nrw.de/x.' },
        bodenwert: { wert: 41000, vollstaendig: true, hinweise: [] },
        comparison: { basis: 'angebote', vergleichswert_eur: 190000 },
        verfahrenswahl: opt.swOhneFaktor ? { verfahren: 'sachwert', grund: 'Einfamilienhaus.', stuetzend: 'ertragswert' } : { verfahren: 'ertragswert', grund: 'Renditeobjekt — Erwerb unter Renditegesichtspunkten.', stuetzend: null },
        quellen_nachweis: [{ vermerk: 'Grundstuecksmarktdaten NRW, Oberer Gutachterausschuss, dl-de/zero-2-0 (BORIS-NRW)', kennzahlen: ['Liegenschaftszinssatz'], jahrgang: 2025, lizenz: 'dl-de/zero-2-0' }] })
        : { available: false, nicht_im_umfang: true, stufe: ein.wert_stufe },
      wertermittlung_herkunft: { kurz: 'amtlich', indikativ: false } } };
    if (opt.vgl !== undefined) daten.vergleichsmiete = opt.vgl;   /* v3944 · Auszug der Vergleichsmiete neben data */
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
    const k = await svc.kaufAnlegen({ zahlen: frei.zahlen, siegelWert: svc.siegel(frei.zahlen), grund: GRUND });
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
    await svc.kaufAnlegen({ zahlen: frei.zahlen, siegelWert: svc.siegel(frei.zahlen), grund: GRUND });
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
    const k = await svc.kaufAnlegen({ zahlen: frei.zahlen, siegelWert: svc.siegel(frei.zahlen), grund: GRUND });
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
      await svc.kaufAnlegen({ zahlen: frei.zahlen, siegelWert: svc.siegel(frei.zahlen), grund: GRUND });
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
    try { await svc.kaufAnlegen({ zahlen: Object.assign({}, frei.zahlen, { kp: 1000 }), siegelWert: s, grund: GRUND }); } catch (e) { fehler = e.code; }
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
  /* v3946 · Stufe 3, der mb-Dienst begrenzt auf höchstens 3 */
  if (!/b\.wert_stufe = Math\.min\(3, Math\.max\(1, /.test(blk)) f.push('mb: /reports/einzelcheck begrenzt die Stufe nicht auf höchstens 3');
  const lauf = async (opt, adr) => { const U = umgebung(opt); svc._setzeDeps(U.deps);
    try { return { m: await svc.markt({ plz: '32609', ort: 'Hüllhorst', wfl: 100, kp: 180000, nkm: 1300, art: 'ETW', mea_pct: 12.5 }, adr), U }; } finally { svc._setzeDeps(null); } };
  const { m, U } = await lauf({}, STRASSE + ', 32609 Hüllhorst');
  const mbAufruf = U.stripeLog.find((x) => x[0] === 'mb');
  if (!mbAufruf || !/\/reports\/einzelcheck$/.test(mbAufruf[1])) f.push('Dienst ruft nicht /reports/einzelcheck');
  if (mbAufruf && (mbAufruf[2].user_id || mbAufruf[2].external_ref)) f.push('mb-Aufruf trägt Nutzer oder Objektbezug');
  if (mbAufruf && (mbAufruf[2].wert_stufe !== 3 || mbAufruf[2].fast)) f.push('angefragt Stufe ' + mbAufruf[2].wert_stufe + (mbAufruf[2].fast ? ' (Schnellmodus)' : '') + ' statt 3');
  if (mbAufruf && mbAufruf[2].dealpilot.mea !== 12.5) f.push('Miteigentumsanteil geht nicht an den mb-Dienst');
  const mj = JSON.stringify(m);
  if (!m.verfuegbar || m.markt.wert !== 190000 || m.markt.miete_qm !== 9.1 || m.lage.ags !== '05770016' || m.stufe !== 3 || m.stichtag !== '2026-11-21') f.push('Marktdaten nicht übernommen: ' + mj.slice(0, 200));
  if (!m.markt.abschlag || m.markt.abschlag.pct !== 10 || m.markt.abschlag.vor_abschlag !== 211000 || m.markt.abschlag.herkunft !== 'Marktdurchschnitt') f.push('Abschlag/Kennzeichnung der Marktpreisindikation: ' + JSON.stringify(m.markt.abschlag));
  /* Stufe 3: Bodenrichtwert, Verfahren mit Herkunft, Wertindikation = führendes Verfahren */
  const w = m.wert || {};
  if (!w.verfuegbar || !w.boden || w.boden.brw_qm !== 95 || w.boden.stichtag !== '2026-01-01' || w.boden.bodenwert_eur !== 41000) f.push('Bodenrichtwert/Bodenwert fehlen: ' + JSON.stringify(w.boden));
  const ew = (w.verfahren || []).find((x) => x.art === 'ertragswert');
  if (!ew || ew.wert_eur !== 185000 || ew.stufe !== 'A' || ew.lzs_pct !== 2.9 || !ew.herkunft) f.push('Ertragswert ohne Wert oder Herkunft: ' + JSON.stringify(ew));
  if (!w.wertindikation || w.wertindikation.wert_eur !== 185000 || w.wertindikation.verfahren !== 'ertragswert' || w.fuehrend !== 'ertragswert') f.push('Wertindikation ist nicht das führende Verfahren: ' + JSON.stringify(w.wertindikation));
  const sw = (w.verfahren || []).find((x) => x.art === 'sachwert');
  if (!sw || sw.verfuegbar || sw.wert_eur != null || !/nicht ausgewiesen/.test(sw.grund || '')) f.push('Sachwert ohne Grund oder mit Zahl: ' + JSON.stringify(sw));
  const vg = (w.verfahren || []).find((x) => x.art === 'vergleichswert');
  if (!vg || vg.verfuegbar) f.push('Angebotspreise als Vergleichswert ausgegeben: ' + JSON.stringify(vg));
  if (!(w.quellen || []).length || !(w.quellen || []).every((x) => /dl-de\/(by|zero)-2-0/.test(x.vermerk))) f.push('Lizenzvermerk fehlt oder verstümmelt: ' + JSON.stringify(w.quellen));
  /* Sachwert ohne Sachwertfaktor führt: KEINE Wertindikation (kein Marktwert), aber der Grund */
  const sf = (await lauf({ swOhneFaktor: true }, STRASSE + ', 32609 Hüllhorst')).m.wert || {};
  if (sf.wertindikation || !/Sachwertfaktor/.test(sf.wertindikation_grund || '') || sf.stuetzend !== 'ertragswert') f.push('Sachwert ohne Faktor trägt eine Wertindikation: ' + JSON.stringify(sf.wertindikation));
  /* ohne Anschrift (keine Strasse): kein Bodenrichtwert, keine Verfahren, nur der Weg */
  const oa = (await lauf({ ohneStrasse: true }, null)).m;
  if (!oa.wert || oa.wert.verfuegbar !== false || oa.wert.grund !== 'ohne_anschrift' || /185000|"brw_qm"/.test(JSON.stringify(oa.wert)) || !/Anschrift/.test(oa.wert.text || '')) f.push('ohne Anschrift trotzdem Bodenrichtwert oder Verfahren: ' + JSON.stringify(oa.wert).slice(0, 160));
  if ((oa.text || []).some((x) => /Ertragswert/.test(x.text))) f.push('ohne Anschrift steht der Ertragswert im KI-Text');
  /* KI-Text: Kapitel ohne Buchstaben, bereinigt, ohne Quellennamen */
  const tx = (m.text || []).map((x) => x.text).join(' | ');
  const kopf = (m.text || []).filter((x) => x.art === 'h').map((x) => x.text);
  if (kopf[0] !== 'Zusammenfassung und Empfehlung' || kopf.some((h) => /^[A-Z]\d?\s*[).:·]/.test(h))) f.push('Kapitel des KI-Texts mit Buchstaben davor: ' + JSON.stringify(kopf));
  if (!/Ruhige Wohnlage mit guter Anbindung, Schulen in der Nähe\./.test(tx) || !/Preise 2020 bis 2025 stabil/.test(tx) || !/Ertragswert liegt bei 185\.000/.test(tx)) f.push('KI-Text nicht übernommen oder nicht bereinigt: ' + tx);
  if (/;|–|—|ImmobilienScout|BORIS/i.test(tx)) f.push('KI-Text mit Semikolon/Gedankenstrich/Quelle: ' + tx);
  /* Kosten: KI-Posten erfasst (Weg des Berichts, ohne Nutzer), nicht im Ergebnis */
  const kp = U.kiPosten[0];
  if (!kp || kp.o.endpunkt !== 'public/einzelcheck/bericht' || kp.o.userId !== null || !Array.isArray(kp.l) || kp.l.length !== 1) f.push('KI-Kosten des Marktberichts nicht erfasst: ' + JSON.stringify(kp && kp.o));
  if (/openai_posten|geomap/i.test(mj)) f.push('Kosten oder Quelle im Ergebnis');
  if (!m._kosten || m._kosten.marktdaten_eur !== 0.38) f.push('Kosten nicht am Ergebnis (nicht aufzählbar)');
  if (/immobilienscout|immo\s*scout|boris|www\.|https?:/i.test(mj)) f.push('Quellenname oder Link nach außen: ' + (mj.match(/.{40}(immobilienscout|boris|www\.|https?:).{20}/i) || [])[0]);
  const front = ohneKommentar(q.front);
  if (/immobilienscout|immo\s*scout|geomap|pricehubble|sprengnetter|boris|bundesbank/i.test(front)) f.push('Quellenname im Frontend');
  if (!/function wertSeite\(D, m, r\)/.test(front) || !/wertSeite\(D, m, r\)\)\)/.test(front)) f.push('Kapitel Wertermittlung fehlt im Bericht');
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

/* v3944 · N · Vergleichsmiete und Obergrenze für Investoren (Marcel 22.11.2026)
   Kette am echten Code: Quercheck -> mb lib/vergleichsmiete_auszug.js -> Antwort des mb-Dienstes -> services/einzelcheck.js
   vglAus -> frontend/landing/einzelcheck.js mietpotenzialAus/mieteZeilen/mieteSaetze mit dem ECHTEN
   js/mietpotenzial-kern.js und der echten js/data/kappungsgrenzen.json. Fälle: mit Vergleichsmiete (Mietspiegel,
   ohne Bremse), ohne Vergleichsmiete, mit Bremse, Bremse ohne Vergleichsmiete, Näherung (ca.), Bremse offen. */
const KUNDENTEXT_VERBOTEN = /[–—;]|mietwucher|immobilienscout|immo\s*scout|immowelt|geomap|pricehubble|sprengnetter|zensus|regionaldatenbank/i;
function frontMiete(front) {
  const vh = /var VGL_HERKUNFT = \{[\s\S]*?\};/.exec(front);
  const koepfe = ['function istZahl(v)', 'function dez(n, st)', 'function eur(n)', 'function eurS(n)', 'function mietpotenzialAus(MP, kappDaten, ist, wfl, m)',
    'function qmText(x, ca)', 'function spanneText(vg)', 'function mieteZeilen(mi)', 'function mieteSaetze(mi)'];
  const teile = koepfe.map((k) => fnAus(front, k));
  if (!vh || teile.some((x) => !x)) return null;
  return new Function(vh[0] + '\n' + teile.join('\n') + '\n; return { mietpotenzialAus, mieteZeilen, mieteSaetze };')();
}
TEILE.N = async function (svc, q) {
  const f = [];
  /* 1 · mb-Auszug: nur Mietspiegel, amtliche Mietpreisübersicht, Näherung. Kein Quellentext nach außen. */
  let A;
  try { A = await import('data:text/javascript,' + encodeURIComponent(q.mbVgl)); } catch (e) { return ['mb-Auszug lädt nicht: ' + e.message]; }
  const cc = (code, qm, spanne) => ({ ertragswert: { available: true, value_eur: 185000, liegenschaftszins_pct: 2.9,
    miete_stufe: { code, etikett: 'Vergleichsmiete der Wohnung (qualifizierter Mietspiegel Musterstadt)', quelle: 'Mietspiegel Musterstadt 2025, S. 4, ImmobilienScout', qm },
    miete_band: spanne ? { spanne: { unten: spanne[0], mittel: spanne[1], oben: spanne[2], ca: code === 'naeherung' }, einordnung: { wahl: 'mittel', text: 'Einordnung am Mittelwert' } } : null } });
  const msp = A.vergleichsmieteAuszug(cc('mietspiegel', 8.4, [7.2, 8.4, 9.6]));
  if (!msp.verfuegbar || msp.qm !== 8.4 || msp.art !== 'mietspiegel' || msp.unten !== 7.2 || msp.oben !== 9.6 || msp.ca || msp.einordnung !== 'mittel') f.push('Auszug Mietspiegel: ' + JSON.stringify(msp));
  if (/Musterstadt|ImmobilienScout|S\. 4|185000|2\.9/.test(JSON.stringify(msp))) f.push('Auszug trägt Quelle, Dokument oder Ertragswert: ' + JSON.stringify(msp));
  const amt = A.vergleichsmieteAuszug(cc('amtlich', 6.1, null));
  if (!amt.verfuegbar || amt.qm !== 6.1 || amt.art !== 'amtlich' || amt.unten !== null) f.push('Auszug amtlich: ' + JSON.stringify(amt));
  const nae = A.vergleichsmieteAuszug(cc('naeherung', 7.05, [6.06, 7.05, 8.04]));
  if (!nae.verfuegbar || !nae.ca) f.push('Auszug Näherung ohne ca.: ' + JSON.stringify(nae));
  for (const c of ['satz_mittel', 'zensus', 'angebot']) {
    const x = A.vergleichsmieteAuszug(cc(c, 7.5, null));
    if (x.verfuegbar !== false || x.qm !== undefined) f.push('Auszug gibt „' + c + '“ als Vergleichsmiete aus: ' + JSON.stringify(x));
  }
  /* am ECHTEN Quercheck: ETW ohne Miteigentumsanteil (Ertragswert nicht ausgewiesen), Mietspiegel-Werte Wolfsburg -
     der Anker steht oben in crossCheck.miete_band, dieselbe Zahl wie in Stufe 3 */
  try {
    const W = path.join(WURZEL, 'marktbericht/backend/src/');
    const { CrossCheckService } = await import(pathToFileURL(W + 'services/CrossCheckService.js').href);
    const { werteFuer } = await import(pathToFileURL(W + 'lib/mietspiegel/werte.js').href);
    const ags = '03103000', werte = werteFuer(ags);
    if (!werte) f.push('Mietspiegel-Werte ' + ags + ' fehlen (Testfall anpassen)');
    else {
      const echt = CrossCheckService.compute({ property_type: 'etw', living_area: 70, build_year: 1975, units: 1, monthly_net_rent: 500, ags },
        { available: true, value_sqm: 200 }, { median_per_sqm: 9 }, { market_value: { estimated: 150000 } },
        { lzs_pct: 2.5, lzs_stufe: 'B', lzs_quelle: 'Test', vergleichsmiete_kontext: { ags, werte, naeherung_param: null, zensus_zeilen: null, baujahr: 1975, signale: {}, bremse: null } });
      const ax = A.vergleichsmieteAuszug(echt);
      const anker = echt.miete_band && echt.miete_band.anker_qm;
      if (!ax.verfuegbar || ax.art !== 'mietspiegel' || !(ax.qm > 0) || ax.qm !== Math.round(anker * 100) / 100) f.push('echter Quercheck: Auszug ' + JSON.stringify(ax) + ' gegen Anker ' + anker);
      if (echt.ertragswert && echt.ertragswert.available !== false) f.push('Testfall: Ertragswert sollte ohne Miteigentumsanteil fehlen');
    }
  } catch (e) { f.push('echter Quercheck lädt nicht: ' + e.message); }
  const leer = A.vergleichsmieteAuszug({ available: false, nicht_im_umfang: true });
  if (leer.verfuegbar !== false || leer.grund !== 'nicht_ermittelt') f.push('Auszug ohne Quercheck: ' + JSON.stringify(leer));
  /* 2 · mb: Auszug VOR der Stufensperre, nur auf Wunsch, neben data (nicht im Payload, nicht im KI-Text) */
  const o = q.mbOrch, iAus = o.indexOf('_vglAuszug = vergleichsmieteAuszug(crossCheck)'), iSperre = o.indexOf('if (_stufe < 3) {');
  if (iAus < 0 || iSperre < 0 || iAus > iSperre) f.push('mb: Auszug nicht vor der Stufensperre');
  if (!/if \(opts && opts\.vergleichsmiete\) \{/.test(o)) f.push('mb: Auszug nicht an opts.vergleichsmiete gebunden');
  if (/payload\.vergleichsmiete\s*=|vergleichsmiete: _vglAuszug[^}]*\}\s*;?\s*\n\s*const payload/.test(o)) f.push('mb: Auszug im Payload');
  const ohneBlk = (o.split('if (OHNE_ABLAGE) {')[1] || '').split('await q(')[0];
  if (!/vergleichsmiete: _vglAuszug/.test(ohneBlk)) f.push('mb: Auszug nicht in der Antwort ohne Ablage');
  const blk = (q.mbApi.split("router.post('/reports/einzelcheck'")[1] || '').split('router.post(')[0];
  if (!/generate\(b, \{ ohneAblage: true, vergleichsmiete: true \}\)/.test(blk)) f.push('mb: Route /reports/einzelcheck fragt die Vergleichsmiete nicht an');
  /* 3 · Dienst: Weissliste, nie aus cross_check */
  const lauf = async (vgl) => { const U = umgebung({ vgl }); svc._setzeDeps(U.deps);
    try { return await svc.markt({ plz: '32609', ort: 'Hüllhorst', wfl: 100, kp: 180000, nkm: 650, art: 'ETW' }, STRASSE + ', 32609 Hüllhorst'); } finally { svc._setzeDeps(null); } };
  const mMit = await lauf(Object.assign({ quelle: 'ImmobilienScout', etikett: 'Mietspiegel Musterstadt', herkunft: 'S. 4' }, msp));
  const vj = JSON.stringify(mMit.vergleichsmiete);
  if (!mMit.vergleichsmiete || mMit.vergleichsmiete.qm !== 8.4 || mMit.vergleichsmiete.art !== 'mietspiegel' || mMit.vergleichsmiete.oben !== 9.6) f.push('Dienst übernimmt die Vergleichsmiete nicht: ' + vj);
  if (/ImmobilienScout|Musterstadt|S\. 4|quelle|etikett|herkunft/.test(vj || '')) f.push('Dienst reicht Quellentext durch: ' + vj);
  const mOhne = await lauf(undefined);
  if (mOhne.vergleichsmiete !== null) f.push('ohne Auszug trotzdem eine Vergleichsmiete (aus cross_check?): ' + JSON.stringify(mOhne.vergleichsmiete));
  const mFremd = await lauf({ verfuegbar: true, qm: 7.5, art: 'zensus' });
  if (mFremd.vergleichsmiete !== null) f.push('Dienst nimmt Art „zensus“ als Vergleichsmiete');
  const mKein = await lauf({ verfuegbar: false, grund: 'keine_vergleichsmiete' });
  if (mKein.vergleichsmiete !== null) f.push('Dienst erfindet eine Vergleichsmiete ohne Treffer');
  /* 4 · Frontend mit dem echten Kern */
  const front = q.front;
  const F = frontMiete(front);
  if (!F) return f.concat(['Frontend: mietpotenzialAus/mieteZeilen/mieteSaetze nicht gefunden']);
  let MP, KD;
  try { MP = require(P.kern); KD = JSON.parse(lies(P.kappDaten)); } catch (e) { return f.concat(['Kern oder Kappungsdaten laden nicht: ' + e.message]); }
  const mitOrt = (m, ags) => Object.assign({}, m, { lage: Object.assign({}, m.lage, { ags }) });
  const faelle = [];
  /* A · Mietspiegel, Hüllhorst (keine Bremse, Kappung 20 % Gesetz): Ist 650 €, 100 m², Vergleichsmiete 8,40 */
  faelle.push(['mit Vergleichsmiete, ohne Bremse', F.mietpotenzialAus(MP, KD, 650, 100, mitOrt(mMit, '05770016')), (mi, s) => {
    const w = [];
    if (mi.vgl_qm !== 8.4 || mi.bremse !== false) w.push('vgl ' + mi.vgl_qm + ', Bremse ' + mi.bremse);
    if (!mi.bestand || mi.bestand.monat !== 780 || mi.bestand.plus_monat !== 130 || mi.bestand.plus_jahr !== 1560) w.push('Bestand ' + JSON.stringify(mi.bestand) + ' (erwartet 780, +130, +1.560: Kappung 20 %)');
    if (mi.nv.art !== 'richtwert' || mi.nv.qm !== 8.4 || mi.nv.monat !== 840 || mi.nv.plus_monat !== 190 || mi.nv.plus_jahr !== 2280) w.push('Neuvermietung ' + JSON.stringify(mi.nv) + ' (erwartet Richtwert 8,40, 840, +190, +2.280)');
    if (!/Ortsübliche Vergleichsmiete 8,40 €\/m² \(amtliche Mietdaten, Mietspiegel der Gemeinde, Spanne 7,20 bis 9,60 €\/m²\)\./.test(s)) w.push('Satz zur Vergleichsmiete fehlt');
    if (!/gilt keine Mietpreisbremse\. Als Richtwert für die Neuvermietung dient die ortsübliche Vergleichsmiete von 8,40 €\/m²/.test(s)) w.push('Richtwert-Satz fehlt');
    if (!/\+190 € im Monat, \+2\.280 € im Jahr/.test(s) || !/\+130 € im Monat, \+1\.560 € im Jahr/.test(s)) w.push('Abstand in Monat und Jahr fehlt');
    return w; }]);
  /* B · ohne Vergleichsmiete (kein Treffer): keine Zahl, nur Kappung */
  faelle.push(['ohne Vergleichsmiete', F.mietpotenzialAus(MP, KD, 650, 100, mitOrt(mOhne, '05770016')), (mi, s) => {
    const w = [];
    if (mi.vgl_qm !== null || mi.nv.qm !== null || mi.nv.art !== 'ohne') w.push('Zahl ohne Treffer: ' + JSON.stringify(mi.nv));
    if (!mi.zul.vgl_fehlt || !mi.bestand || mi.bestand.monat !== 780) w.push('Bestand ohne Vergleichsmiete ' + JSON.stringify(mi.bestand));
    if (!/keine amtlichen Mietdaten zur Vergleichsmiete vor\. DealPilot nennt deshalb keine Zahl\./.test(s) || !/nur bis zur Kappungsgrenze/.test(s)) w.push('Hinweis ohne Vergleichsmiete fehlt');
    if (/Vergleichsmiete \d|Richtwert|Obergrenze, /.test(s)) w.push('Zahl zur Vergleichsmiete trotz fehlendem Wert');
    return w; }]);
  /* C · Bremse (Köln, Kappung 15 %): Ist 800 €, 100 m², Vergleichsmiete 10,00 -> Obergrenze 11,00 */
  const v10 = Object.assign({}, mMit.vergleichsmiete, { qm: 10, unten: null, mittel: null, oben: null, art: 'amtlich' });
  faelle.push(['mit Bremse', F.mietpotenzialAus(MP, KD, 800, 100, mitOrt(Object.assign({}, mMit, { vergleichsmiete: v10 }), '05315000')), (mi, s) => {
    const w = [];
    if (mi.bremse !== true || mi.kPct !== 15 || !mi.kAus) w.push('Bremse/Kappung Köln: ' + mi.bremse + ', ' + mi.kPct);
    if (!mi.bestand || mi.bestand.monat !== 920 || mi.bestand.plus_jahr !== 1440) w.push('Bestand ' + JSON.stringify(mi.bestand) + ' (erwartet 920, +1.440)');
    if (mi.nv.art !== 'bremse' || mi.nv.qm !== 11 || mi.nv.monat !== 1100 || mi.nv.plus_monat !== 300 || mi.nv.plus_jahr !== 3600) w.push('Obergrenze ' + JSON.stringify(mi.nv) + ' (erwartet 11,00, 1.100, +300, +3.600)');
    if (!/gilt die Mietpreisbremse\. Bei Neuvermietung höchstens 11,00 €\/m², das ist die Vergleichsmiete plus 10 % \(§ 556d BGB\)\./.test(s)) w.push('Bremse-Satz fehlt');
    if (!/amtliche Mietdaten des Gutachterausschusses/.test(s)) w.push('Herkunft amtlich fehlt');
    if (!/Marktdurchschnitt liegt mit 9,10 €\/m² darunter/.test(s)) w.push('Hinweis Marktdurchschnitt unter der Grenze fehlt');
    return w; }]);
  /* D · Bremse ohne Vergleichsmiete: keine Zahl */
  faelle.push(['Bremse ohne Vergleichsmiete', F.mietpotenzialAus(MP, KD, 800, 100, mitOrt(mOhne, '05315000')), (mi, s) => {
    const w = [];
    if (mi.nv.art !== 'bremse_ohne_vgl' || mi.nv.qm !== null) w.push('Obergrenze ohne Vergleichsmiete: ' + JSON.stringify(mi.nv));
    if (!/Ohne Vergleichsmiete nennt DealPilot hier keine Zahl\./.test(s)) w.push('Satz fehlt');
    return w; }]);
  /* E · Näherung (ca.), Bremse offen (ohne Gemeindeschlüssel) */
  faelle.push(['Näherung, Bremse offen', F.mietpotenzialAus(MP, KD, 600, 100, Object.assign({}, mMit, { lage: {}, vergleichsmiete: Object.assign({}, nae) })), (mi, s) => {
    const w = [];
    if (mi.bremse !== null || mi.nv.art !== 'richtwert_pruefen' || mi.nv.qm !== 7.05) w.push('offen: ' + mi.bremse + ' ' + JSON.stringify(mi.nv));
    if (!/Ortsübliche Vergleichsmiete ca\. 7,05 €\/m² \(Schätzung von DealPilot aus amtlichen Mietdaten der Gemeinde, nicht amtlich, Spanne ca\. 6,06 bis 8,04 €\/m²\)/.test(s)) w.push('Näherung nicht als Schätzung gekennzeichnet');
    if (!/Ob in der Gemeinde die Mietpreisbremse gilt, bitte prüfen\./.test(s)) w.push('Hinweis „bitte prüfen“ fehlt');
    return w; }]);
  for (const [name, mi, pruef] of faelle) {
    const saetze = F.mieteSaetze(mi), zeilen = F.mieteZeilen(mi);
    const s = saetze.join(' | ');
    pruef(mi, s).forEach((x) => f.push(name + ': ' + x));
    const alles = s + ' ' + JSON.stringify(zeilen);
    if (KUNDENTEXT_VERBOTEN.test(alles)) f.push(name + ': Kundentext mit Gedankenstrich, Semikolon, Quelle oder „Mietwucher“: ' + (alles.match(KUNDENTEXT_VERBOTEN) || [])[0]);
    if (!/Orientierung, keine Rechtsberatung\./.test(s)) f.push(name + ': Hinweis „keine Rechtsberatung“ fehlt');
  }
  /* 5 · nur der Kern rechnet, im Bericht steht die Tabelle */
  const fk = ohneKommentar(front);
  ['MP.zulaessig(', 'MP.zielmieteBremse(', 'MP.mietpreisbremseAus(', 'MP.kappungAus('].forEach((x) => { if (fk.indexOf(x) < 0) f.push('Frontend ruft ' + x + ' nicht'); });
  if (/\*\s*1[.,]1\d?\b|\*\s*1[.,]2\b|\*\s*\(1 \+ /.test(fk.split('function mietpotenzialAus')[1].split('function mieteSaetze')[0])) f.push('Frontend rechnet Kappung oder Bremse selbst');
  if (!/D\.liste\(mieteZeilen\(mi\), \['Miete', 'im Monat', 'Abstand im Monat', 'Abstand im Jahr'\]\)/.test(fk)) f.push('Tabelle der Obergrenze fehlt im PDF');
  if (!/DpMietpotenzial: 'js\/mietpotenzial-kern\.js\?v=/.test(fk)) f.push('Kern wird nicht nachgeladen');
  return f;
};

/* ── v3946 · O P Q R ────────────────────────────────────────────────────────────────────────────────────
   Das ECHTE frontend/landing/einzelcheck.js läuft in einer vm-Umgebung mit einem Minimal-DOM, zusammen mit den
   ECHTEN Kernen der App (dscr-engine, darlehen-weitere, deal-kpis, score-tiers, dealscore, mietpotenzial-kern,
   dp-dokument). Gerechnet und gesetzt wird über window.DpEinzelCheck._bericht/_pdf/_fin/_grundFehlt. */
const KERN_DATEIEN = ['dscr-engine.js', 'darlehen-weitere.js', 'deal-kpis.js', 'score-tiers.js', 'dealscore.js', 'mietpotenzial-kern.js', 'dp-dokument.js'];
function frontLaden(frontText, ueber) {
  const leer = () => null;
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, addEventListener() {} });
  const ctx = { console, Math, JSON, Date, Number, String, Array, Object, Promise, isFinite, parseFloat, parseInt, encodeURIComponent, URL, setTimeout, clearTimeout,
    navigator: { userAgent: 'pruefer' }, sessionStorage: { getItem: leer, setItem() {} }, localStorage: { getItem: leer, setItem() {} },
    location: { hostname: 'localhost', search: '', hash: '', pathname: '/', origin: 'http://localhost', href: 'http://localhost/', protocol: 'http:' },
    history: { replaceState() {} }, fetch: () => Promise.reject(new Error('offline')), alert() {}, CustomEvent: function () {},
    matchMedia: () => ({ matches: true }), getComputedStyle: () => ({ getPropertyValue: () => '' }),
    document: { addEventListener() {}, getElementById: leer, querySelector: leer, querySelectorAll: () => [], createElement: el, dispatchEvent() {},
      documentElement: { classList: { add() {}, remove() {} } }, body: { appendChild() {} } } };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  const opfer = Object.assign({}, ueber || {});
  for (const d of KERN_DATEIEN) vm.runInContext(opfer[d] || lies(path.join(WURZEL, 'frontend/js', d)), ctx, { filename: d });
  vm.runInContext(frontText, ctx, { filename: 'einzelcheck.js' });
  ctx.DpDokument.vorschau = function () {};
  return ctx;
}
/* Ein Bericht wie nach dem Kauf (erfunden): MFH Musterstadt, Stufe 3 mit Ertragswert führend */
const GRUND_O = { art: 'MFH', kp: 690000, nkm: 3650, wfl: 420, plz: '12345', ort: 'Musterstadt', bj: 1972, gsfl: 610, ze: 120, ek_eur: 140000, nk_pct: 10, zins_pct: 3.85, tilg_pct: 2, bindung_j: 10 };
function antwortO(wertUeber) {
  return { zahlen: Object.assign({ einheiten: 6, ruecklage_stand: 38000, ek_klasse: 'E', endenergie: 148, unterlagen: 2 }, GRUND_O),
    unterlagen: [{ art: 'Exposé', gelesen: true, kernpunkte: ['Sechs Wohnungen'], risiken: [{ titel: 'Dach', schwere: 'mittel', beschreibung: 'Dämmung fehlt' }] }],
    status: {}, markt: { verfuegbar: true, stufe: 3, stichtag: '2026-11-22', lage: { mikro: 66, makro: 58, ort: 'Musterstadt', plz: '12345', ags: null },
      markt: { bezeichnung: 'Erweiterte Marktpreisindikation', wert: 712000, qm: 1695, miete_qm: 9.6 }, vergleichsmiete: null,
      wert: Object.assign({ verfuegbar: true, genau: true, boden: { verfuegbar: true, brw_qm: 260, stichtag: '2026-01-01', bodenwert_eur: 158600, hinweise: [] },
        verfahren: [{ art: 'ertragswert', name: 'Ertragswertverfahren', verfuegbar: true, wert_eur: 668000, lzs_pct: 3.1, stufe: 'A', herkunft: 'amtlich', rnd_j: 30, gnd_j: 80 },
          { art: 'sachwert', name: 'Sachwertverfahren', verfuegbar: false, grund: 'Für dieses Objekt ist das Ertragswertverfahren maßgeblich.' },
          { art: 'vergleichswert', name: 'Vergleichswertverfahren', verfuegbar: false, grund: 'Kein amtlicher Vergleichsfaktor.' }],
        fuehrend: 'ertragswert', fuehrend_grund: 'Renditeobjekt.', wertindikation: { wert_eur: 668000, verfahren: 'ertragswert', name: 'Ertragswertverfahren', stufe: 'A' },
        quellen: [{ vermerk: 'Gutachterausschuss Musterstadt, dl-de/by-2-0', kennzahlen: ['Bodenrichtwert'] }] }, wertUeber || {}),
      text: [{ art: 'h', text: 'A) Zusammenfassung & Empfehlung' }, { art: 'p', text: 'Solide Lage.' }] } };
}
/* O · Finanzierung wie im Investment-PDF, nur mit den Kernen. Prüfmaßstab: calc.js v3029 (Tilgungsplan der Bank,
   monatlich): 300.000 € zu 3,8 % mit 2 % Tilgung, Restschuld nach 10 Jahren 227.146 € (jährlich gerechnet 228.628 €). */
TEILE.O = async function (svc, q) {
  const f = [];
  let C; try { C = frontLaden(q.front, q.kerne); } catch (e) { return ['Frontend lädt nicht: ' + e.message]; }
  const EC = C.DpEinzelCheck;
  if (!EC || typeof EC._fin !== 'function') return ['DpEinzelCheck._fin fehlt'];
  EC._S.grund = { art: 'ETW', kp: 272727.27, nkm: 1500, wfl: 100, plz: '32609', ek_eur: 0, nk_pct: 10, zins_pct: 3.8, tilg_pct: 2, bindung_j: 10 };
  const r = EC.rechne({});
  if (!r || !r.k || Math.abs(r.d1 - 300000) > 0.01) return ['Darlehen aus den Grundangaben: ' + (r && r.d1)];
  const fin = EC._fin(r, C.DpDarlehenWeitere, C.DealKpis, C.Dscr, 5);
  if (Math.abs(fin.bindung.rs - 227146) > 1) f.push('Restschuld nach 10 Jahren ' + Math.round(fin.bindung.rs) + ' statt 227.146 € (Tilgungsplan monatlich, calc.js v3029)');
  if (Math.abs(fin.heute.rate_m - 300000 * 0.058 / 12) > 0.01) f.push('Rate heute ' + fin.heute.rate_m);
  if (Math.abs(fin.heute.cf_nach_m - r.k.cf_m) > 0.001 || Math.abs(fin.heute.dscr - r.k.dscr) > 1e-9) f.push('Cashflow/DSCR heute nicht aus DealKpis');
  const a = fin.anschluss;
  if (!a || a.zins !== 5 || a.tilg !== 2) f.push('Anschluss nicht mit 5 % und derselben Tilgung: ' + JSON.stringify(a && { z: a.zins, t: a.tilg }));
  else {
    if (Math.abs(a.rate_m - fin.bindung.rs * 0.07 / 12) > 0.01) f.push('Rate im Anschluss ' + a.rate_m + ' statt Restschuld × 7 % / 12');
    const ka = C.DealKpis.compute({ kp: r.e.kp, nk: r.nk, nkm: r.e.nkm, ze: r.e.ze, uf: 0, bwk_ul: 0, bwk_nul: r.bwkNul, d1: fin.bindung.rs, d1z: 5, d1t: 2, ek: r.ek });
    if (Math.abs(a.cf_nach_m - ka.cf_m) > 0.001 || Math.abs(a.dscr - ka.dscr) > 1e-9) f.push('Cashflow/DSCR im Anschluss nicht aus DealKpis');
    /* Laufzeit: der Monatsplan des Kerns muss im Monat laufzeit_monate bei 0 sein, davor nicht */
    const plan = C.DpDarlehenWeitere.monatsplan({ betrag: fin.bindung.rs, zins: 5, tilg: 2 }, 1200);
    if (!(a.laufzeit_monate > 0) || plan[a.laufzeit_monate - 1].rs >= 0.5 || plan[a.laufzeit_monate - 2].rs < 0.5) f.push('Laufzeit im Anschluss ' + a.laufzeit_monate);
    if (!(a.gesamt_jahre > 10 && a.gesamt_jahre < 60)) f.push('Gesamtlaufzeit unplausibel ' + a.gesamt_jahre);
  }
  const fk = ohneKommentar(q.front).split('function finanzierungAus')[1].split('\n  }\n')[0];
  if (/Math\.pow|\*\s*\(1\s*\+|\/\s*12\s*\*\s*\(|rs\s*-=|rs\s*=\s*rs/.test(fk)) f.push('finanzierungAus rechnet Zins oder Tilgung selbst');
  if (!/DW\.monatsplan\(/.test(fk) || !/DK\.compute\(/.test(fk) || !/DS\.compute\(/.test(fk)) f.push('finanzierungAus ruft die Kerne nicht');
  if (!/var ANSCHLUSS_ZINS = 5\.0;/.test(q.front)) f.push('Anschlusszins nicht 5,0 %');
  return f;
};
/* P · Grundangaben Pflicht: Server (grundFehlt in /auslesen und kaufAnlegen), Browser (zeigeUnterlagen erst danach),
   Grundangaben schlagen gelesene Werte, Anschrift geht nie in den Zahlenstand */
TEILE.P = async function (svc, q) {
  const f = [];
  if (svc.grundFehlt(GRUND).length) f.push('vollständige Grundangaben gelten als unvollständig: ' + svc.grundFehlt(GRUND));
  const ohne = Object.assign({}, GRUND); delete ohne.zins_pct; delete ohne.plz; delete ohne.ort;
  const fe = svc.grundFehlt(ohne);
  if (fe.indexOf('zins_pct') < 0 || fe.indexOf('plz') < 0) f.push('fehlender Zins oder Ort nicht erkannt: ' + fe);
  if (svc.grundFehlt(Object.assign({}, GRUND, { plz: undefined, ort: 'Hüllhorst' })).length) f.push('Ort ohne PLZ wird abgelehnt');
  const U = umgebung(); svc._setzeDeps(U.deps);
  try {
    const frei = await svc.auslesen(DATEIEN.slice(0, 2), 'frei');
    let code = null;
    try { await svc.kaufAnlegen({ zahlen: frei.zahlen, siegelWert: svc.siegel(frei.zahlen) }); } catch (e) { code = e.code; }
    if (code !== 'grundangaben') f.push('Kauf ohne Grundangaben angenommen (' + code + ')');
    const g = Object.assign({}, GRUND, { kp: 175000, strasse: STRASSE, name: NAME });
    await svc.kaufAnlegen({ zahlen: frei.zahlen, siegelWert: svc.siegel(frei.zahlen), grund: g });
    const zeile = [...U.tab.values()].pop();
    if (!zeile || zeile.zahlen.kp !== 175000 || zeile.zahlen.ek_eur !== 20000 || zeile.zahlen.bindung_j !== 10) f.push('Grundangaben nicht im Zahlenstand oder schlagen die gelesenen nicht: ' + JSON.stringify(zeile && zeile.zahlen));
    if (JSON.stringify(zeile && zeile.zahlen).indexOf(STRASSE) >= 0 || JSON.stringify(zeile && zeile.zahlen).indexOf(NAME) >= 0) f.push('Anschrift oder Name im Zahlenstand');
  } finally { svc._setzeDeps(null); }
  const route = ohneKommentar(q.route);
  /* einzelcheck-3 · /auslesen darf OHNE Grundangaben laufen (erst auslesen, dann die Grundangaben) */
  if (/ec\.grundFehlt\(/.test(route.split("router.post('/auslesen'")[1].split('router.post(')[0])) f.push('/auslesen verlangt wieder die Grundangaben vor den Unterlagen');
  if (!/kaufAnlegen\(\{ zahlen: b\.zahlen, siegelWert: b\.siegel, grund: b\.grund \}\)/.test(route)) f.push('/kaufen gibt die Grundangaben nicht weiter');
  const bb = route.split("router.post('/bericht'")[1] || '';
  if (!/Object\.assign\(\{\}, ec\.zahlenSauber\(z\.zahlen\), r \? r\.zahlen : \{\}, grund\)/.test(bb)) f.push('/bericht: Grundangaben schlagen die gelesenen Werte nicht');
  if (/berichtGezaehlt\([^)]*adr/.test(bb)) f.push('/bericht speichert die Anschrift');
  /* Browser: Pflicht vor dem Hochladen, dieselbe Liste wie der Server */
  let C; try { C = frontLaden(q.front, q.kerne); } catch (e) { return f.concat(['Frontend lädt nicht: ' + e.message]); }
  const gf = C.DpEinzelCheck._grundFehlt;
  if (gf(GRUND).length || gf(ohne).indexOf('zins_pct') < 0 || gf({}).length < 8) f.push('Browser prüft die Grundangaben anders als der Server');
  const fr = ohneKommentar(q.front);
  /* einzelcheck-3 · Kauf bleibt hinter den Grundangaben: kaufen() nur aus zeigeErgebnis, und dorthin nur über das Formular */
  if (!/S\.grund = n; S\.abweichungen = \[\];[\s\S]{0,200}zeigeErgebnis\(\);/.test(fr)) f.push('Ergebnis nicht hinter den bestätigten Grundangaben');
  if (!/else if \(\(S\.frei \|\| S\.ohneUnterlagen\) && S\.grund && !grundFehlt\(S\.grund\)\.length\) zeigeErgebnis\(\);/.test(fr)) f.push('auf() öffnet das Ergebnis ohne vollständige Grundangaben');
  if (!/<legend>Objekt<\/legend>/.test(fr) || !/<legend>Finanzierung<\/legend>/.test(fr)) f.push('Formular nicht in Objekt und Finanzierung getrennt');
  if (!/fd\.append\('grund', JSON\.stringify\(S\.grund\)\)/.test(fr)) f.push('Grundangaben gehen nicht mit dem Formular');
  return f;
};
/* S · einzelcheck-3 · Bewertungsbericht und neuer Ablauf (Marcel 24.11.2026: „Marktbericht reingeladen mit 180.000 …
   die Unterlagen sagen was ganz anderes“ / „erst auslesen, dann die Grundangaben gucken, was noch fehlt“) */
TEILE.S = async function (svc, q) {
  const f = [];
  const MB_TEXT = 'DealPilot Marktbericht. MARKTWERT-INDIKATION SPANNE DER VERFAHREN KAUFPREIS BODENRICHTWERT. Vergleichswertverfahren 143.550 €. '
    + 'Kaufpreis von 165.000 €, Wohnfläche 78 m², 1.013 Vergleichsangebote, Angebotsabschlag 5,8 % auf 180.000 €. Marktpreisindikation 171.000 €. Ertragswert 83.000 €.';
  if (!svc.istWertbericht(MB_TEXT, 'Bericht.pdf', { typ: 'marktbericht' })) f.push('Marktbericht nicht als Bewertungsbericht erkannt (Klassifizierung)');
  if (!svc.istWertbericht(MB_TEXT, 'Unterlage.pdf', {})) f.push('Marktbericht nicht am Text erkannt');
  if (svc.istWertbericht(TEXTE.expose, 'Expose.pdf', {})) f.push('Exposé als Bewertungsbericht erkannt');
  if (svc.istWertbericht('Exposé Mehrfamilienhaus. Kaufpreis 520.000 €, Wohnfläche 410 m², Käuferprovision 3,57 %.', 'Angebot.pdf', {})) f.push('Verkaufsangebot als Bewertungsbericht erkannt');
  /* Kette mit nachgebauter KI: der Bericht läuft über das Schema „wertbericht“, nie über extractExpose */
  const U = umgebung(); const altText = TEXTE.expose; TEXTE.mbx = MB_TEXT;
  const kiAlt = U.deps.openai;
  const arten = [];
  const openai = { extractExpose: async function (t, o) { arten.push('expose'); return kiAlt.extractExpose(t, o); },
    extractDokument: async function (t, typ, o) { arten.push(typ);
      if (typ === 'wertbericht') return { success: true, model: o.model, extracted: { kaufpreis_im_bericht_eur: 165000, fuehrender_wert_eur: 143550, fuehrendes_verfahren: 'vergleichswert',
        marktpreisindikation_eur: 171000, ertragswert_eur: 83000, wohnflaeche_m2: 78, objektart: 'Eigentumswohnung', plz: '32423', ort: 'Minden' } };
      return kiAlt.extractDokument(t, typ, o); } };
  svc._setzeDeps(Object.assign({}, U.deps, { openai: openai }));
  try {
    const r = await svc.auslesen([pdf('mbx', 'Marktbericht.pdf')], 'frei');
    if (arten.join() !== 'wertbericht') f.push('Marktbericht nicht über das eigene Schema gelesen: ' + arten.join());
    const z = r.zahlen || {};
    if (z.kp !== 165000 || z.wert_bericht !== 143550 || z.mpi_bericht !== 171000 || z.wert_verfahren !== 'vergleichswert') f.push('Zahlen aus dem Bericht falsch: ' + JSON.stringify(z));
    if (!r.herkunft || r.herkunft.kp !== 'Marktbericht' || r.herkunft.wfl !== 'Marktbericht') f.push('Herkunft fehlt: ' + JSON.stringify(r.herkunft));
    if (!svc.siegelPruefen(z, r.siegel || svc.siegel(z))) f.push('Siegel passt nicht zu den Zahlen');
    if (Object.keys(r).indexOf('herkunft') < 0) f.push('herkunft nicht in der Antwort');
    /* Exposé und Bericht zusammen: der Kaufpreis des Exposés gewinnt, die Verfahrenswerte nie als Kaufpreis */
    arten.length = 0;
    const r2 = await svc.auslesen([pdf('expose', 'Expose.pdf'), pdf('mbx', 'Marktbericht.pdf')], 'frei');
    if (r2.zahlen.kp !== 180000 || r2.herkunft.kp !== 'Exposé') f.push('Exposé-Kaufpreis gewinnt nicht vor dem Bericht: ' + r2.zahlen.kp + ' ' + r2.herkunft.kp);
    if (r2.zahlen.wert_bericht !== 143550) f.push('Wert des Berichts fehlt neben dem Exposé');
  } finally { svc._setzeDeps(null); delete TEXTE.mbx; TEXTE.expose = altText; }
  /* Schema: eigener Eintrag nur in SCHEMATA, nie in DOKUMENT_TYPEN (der App-Import bleibt unberührt) */
  const ds = q.schemas;
  if (!/wertbericht: \{\s*einleitung:/.test(ds)) f.push('Schema wertbericht fehlt');
  if (/kaufpreis_im_bericht_eur/.test(ds) && !/NIE ein Verfahrenswert/.test(ds)) f.push('Schema trennt Kaufpreis und Verfahrenswerte nicht');
  const typenTeil = ds.split('const DOKUMENT_TYPEN')[1] ? ds.split('const DOKUMENT_TYPEN')[1].split('};')[0] : '';
  if (/\bwertbericht\b/.test(typenTeil)) f.push('wertbericht steht in DOKUMENT_TYPEN (der App-Import würde ihn wählen)');
  /* Browser: Ablauf und Wahl bei Widerspruch */
  const fr = ohneKommentar(q.front);
  if (!/<li>Unterlagen<\/li><li>Auslesen<\/li><li>Grundangaben<\/li><li>Ergebnis<\/li><li>Bericht<\/li>/.test(fr)) f.push('Schrittleiste nicht Unterlagen, Auslesen, Grundangaben');
  if (!/S\.frei = j; S\.herkunft = j\.herkunft \|\| \{\}; S\.ohneUnterlagen = false;\s*zeigeGrund\(\);/.test(fr)) f.push('nach dem Auslesen nicht die Grundangaben');
  if (!/var nochOffen = Object\.keys\(offen\);\s*if \(nochOffen\.length\) \{/.test(fr)) f.push('Widerspruch ohne Wahl übergehbar');
  if (!/class="btn-l ec-ohne"/.test(fr)) f.push('kein Weg ohne Unterlagen');
  /* echter Lauf im Browser-Nachbau: Deal-Check 180.000, Unterlage 165.000 → Wahl, weiter erst nach Klick */
  let C; try { C = frontLaden(q.front, q.kerne); } catch (e) { return f.concat(['Frontend lädt nicht: ' + e.message]); }
  if (!C.DpEinzelCheck || !C.DpEinzelCheck._vorbelegung) return f.concat(['_vorbelegung fehlt']);
  const S0 = C.DpEinzelCheck._S;
  S0.grund = Object.assign({}, GRUND, { kp: 180000 }); S0.frei = { zahlen: { kp: 165000, wfl: 100, bj: 1928, wert_bericht: 143550 } }; S0.herkunft = { kp: 'Marktbericht', wfl: 'Marktbericht', bj: 'Marktbericht' };
  const vb = C.DpEinzelCheck._vorbelegung();
  if (!vb.konflikt.kp || vb.konflikt.kp.a !== 180000 || vb.konflikt.kp.b !== 165000 || vb.konflikt.kp.bq !== 'Marktbericht') f.push('Widerspruch Kaufpreis nicht erkannt: ' + JSON.stringify(vb.konflikt));
  if (vb.werte.kp !== 180000) f.push('Kaufpreis still überschrieben: ' + vb.werte.kp);
  if (vb.konflikt.wfl) f.push('gleicher Wert als Widerspruch gemeldet');
  if (vb.werte.bj !== 1928 || vb.quelle.bj !== 'Marktbericht') f.push('leeres Feld nicht aus der Unterlage vorbelegt: ' + vb.werte.bj + ' ' + vb.quelle.bj);
  S0.grund = null; S0.frei = null; S0.herkunft = {};
  return f;
};
/* Q · Nach dem Kauf kein zweites Hochladen: selber Tab, Ablage auf dem Gerät, Bericht startet von selbst, Ablage wird gelöscht */
TEILE.Q = async function (svc, q) {
  const f = [], fr = ohneKommentar(q.front);
  if (/window\.open\(/.test(fr)) f.push('Stripe öffnet wieder ein zweites Fenster');
  const kauf = fnAus(fr, 'function kaufen()') || '';
  if (!/ablage\.schreiben\(ablageAus\(r\.token\)\)\.then\(weiter, weiter\)/.test(kauf) || !/location\.href = r\.url/.test(kauf)) f.push('Kauf legt die Unterlagen vor der Weiterleitung nicht ab');
  const rk = fnAus(fr, 'function rueckkehrPruefen()') || '';
  if (!/ablage\.lesen\(\)\.then\(function \(rec\) \{\s*if \(rec && rec\.token === tokenLesen\(\)\) ablageEin\(rec\);/.test(rk)) f.push('Rückkehr holt die Ablage dieses Kaufs nicht zurück');
  if (!/if \(s && s\.bezahlt\) \{ erstelleBericht\(\); return; \}/.test(rk)) f.push('Bericht startet nach der Rückkehr nicht von selbst');
  if (!/ablage\.loeschen\(\);/.test(rk)) f.push('Abbruch löscht die Ablage nicht');
  const eb = fnAus(fr, 'function erstelleBericht()') || '';
  if (!/ablage\.loeschen\(\);/.test(eb)) f.push('fertiger Bericht löscht die Ablage nicht');
  const st = /var ABLAGE_STUNDEN = (\d+);/.exec(q.front);
  if (!st || +st[1] > 24) f.push('Ablage länger als einen Tag');
  if (!/Date\.now\(\) - \(rec\.zeit \|\| 0\) < ABLAGE_STUNDEN \* 3600000/.test(fr)) f.push('alte Ablage wird nicht verworfen');
  if (/ablage[\s\S]{0,400}(fetch|holeJson)\(/.test(fnAus(fr, 'function ablageAus(token)') || '')) f.push('Ablage geht an einen Server');
  /* Datenschutztext sagt es */
  const schutz = (/var SCHUTZ = ([\s\S]*?);\n/.exec(q.front) || [])[1] || '';
  if (!/auf deinem Gerät ab/.test(schutz) || !/nicht an DealPilot/.test(schutz) || !/gelöscht, sobald dein Bericht fertig ist/.test(schutz)) f.push('Datenschutztext nennt die Ablage im Browser nicht');
  if (/kann der Einzel-Check noch nicht lesen/.test(schutz)) f.push('Datenschutztext sagt noch, gescannte PDFs gingen nicht');
  if (KUNDENTEXT_VERBOTEN.test(schutz.replace(/'\s*\+\s*'/g, ''))) f.push('Datenschutztext mit Gedankenstrich oder Semikolon');
  return f;
};
/* R · Bericht: Kapitel mit Überschrift, keine Buchstaben davor, Bodenrichtwert oben, Kundentext ohne Gedankenstrich,
   Semikolon, Quellennamen. Am ECHTEN pdf() mit dem ECHTEN dp-dokument.js. */
TEILE.R = async function (svc, q) {
  const f = [];
  let C; try { C = frontLaden(q.front, q.kerne); } catch (e) { return ['Frontend lädt nicht: ' + e.message]; }
  const EC = C.DpEinzelCheck;
  EC._S.grund = Object.assign({}, GRUND_O);
  const d = EC._bericht(antwortO(), null);
  if (!d.fin || !d.fin.anschluss) f.push('Bericht ohne Finanzierung');
  const doc = EC._pdf(d);
  if (typeof doc !== 'string' || doc.length < 5000) return f.concat(['kein Dokument']);
  const kopf = (doc.match(/<h[123][^>]*>[\s\S]*?<\/h[123]>/g) || []).map((x) => x.replace(/<[^>]+>/g, '').trim());
  const brauch = ['Auf einen Blick', 'Objekt und Miete', 'Finanzierung und Anschluss', 'Bodenrichtwert und Verfahren', 'Mietpotenzial und Obergrenze', 'Quellen und Methodik', 'Rate und Cashflow je Phase', 'Anschlussfinanzierung', 'Zusammenfassung und Empfehlung'];
  brauch.forEach((b) => { if (kopf.indexOf(b) < 0 && !(b === 'Mietpotenzial und Obergrenze')) f.push('Kapitel fehlt: ' + b); });
  const brief = kopf.filter((h) => /^[A-Z]\d?\s*[).:·]\s|^[A-Z]\s·/.test(h));
  if (brief.length) f.push('Überschrift mit Buchstaben davor: ' + brief.join(' | '));
  const eyebrow = (doc.match(/<div class="eyebrow">([^<]*)</g) || []).map((x) => x.replace(/<[^>]+>/g, ''));
  if (eyebrow.some((e) => /^[A-Z]\s*[·.)]\s/.test(e))) f.push('Kapitelzeile mit Buchstaben davor: ' + eyebrow.join(' | '));
  /* Deckblatt: Bodenrichtwert oben, Wertindikation als Hauptzahl */
  const deck = (doc.split('<section class="seite deck">')[1] || '').split('</section>')[0];
  if (!/Bodenrichtwert<\/div><div class="v">260 €\/m²/.test(deck)) f.push('Bodenrichtwert nicht auf dem Deckblatt');
  if (!/Wertindikation · Ertragswertverfahren/.test(deck) || !/668\.000 €/.test(deck)) f.push('Wertindikation nicht auf dem Deckblatt');
  /* Kundentext: kein Gedankenstrich, kein Semikolon (ausser in CSS und Platzhalter), keine Quellennamen, kein „Mietwucher“ */
  const text = doc.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ');
  const verboten = text.match(/[–—;]|mietwucher|immobilienscout|immo\s*scout|immowelt|geomap|pricehubble|sprengnetter|zensus|regionaldatenbank|boris|bundesbank/i);
  if (verboten) f.push('Kundentext mit „' + verboten[0] + '“: …' + text.slice(Math.max(0, verboten.index - 60), verboten.index + 20).replace(/\s+/g, ' '));
  /* jede Zahl der Wertermittlung mit Herkunft: Stufe und Liegenschaftszins in der Zeile des Ertragswerts */
  if (!/amtlich, Stufe A, Liegenschaftszinssatz 3,10 %/.test(text)) f.push('Ertragswert ohne Herkunft im Bericht');
  if (!/Restschuld am Ende der Zinsbindung/.test(text) || !/Schuldenfrei nach/.test(text) || !/Cashflow vor Finanzierung im Monat/.test(text)) f.push('Finanzierung unvollständig im Bericht');
  /* ohne Anschrift: kein Bodenrichtwert, kein Ertragswert, dafür der Weg */
  EC._S.grund = Object.assign({}, GRUND_O);
  const d2 = EC._bericht(Object.assign(antwortO(), { markt: Object.assign(antwortO().markt, { wert: { verfuegbar: false, grund: 'ohne_anschrift', text: 'Ohne Anschrift nennt DealPilot keinen Bodenrichtwert.' } }) }), null);
  const doc2 = EC._pdf(d2).replace(/<[^>]+>/g, ' ');
  if (/668\.000|260 €\/m²/.test(doc2) || !/Ohne Anschrift nennt DealPilot keinen Bodenrichtwert/.test(doc2)) f.push('ohne Anschrift trotzdem Werte im Bericht');
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
  E: 'Bericht nur mit gültigem Kauf-Token', F: 'Frist 14 Tage', G: 'Preis aus dem lookup_key', H: 'Webhook', I: 'Zahlen-Weissliste', J: 'Siegel', K: 'Marktbericht Stufe 3 ohne Ablage, Wertermittlung mit Herkunft, keine Quellennamen',
  L: 'gescannte PDFs: Texterkennung nur im Speicher', M: 'Rabatt-Vorrang Anrechnung vor Flyer-Code', N: 'Vergleichsmiete und Obergrenze für Investoren',
  O: 'Finanzierung wie im Investment-PDF (Kerne)', P: 'Grundangaben Pflicht', Q: 'kein zweites Hochladen nach dem Kauf', R: 'Bericht: Kapitel, Deckblatt, Kundentext', S: 'Bewertungsbericht und Ablauf erst auslesen' };

console.log('einzelcheck-pruefen · v3946');
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
  ['I', 'Weissliste abgeschaltet', { dienst: ersetze(D, '  const zahlen = zahlenSauber(z), herkunft = {};', '  const zahlen = Object.assign({ name: ' + JSON.stringify(NAME) + ' }, z), herkunft = {};') }],
  ['J', 'Siegel nicht geprüft', { dienst: ersetze(D, 'if (Object.keys(gelesen).length && !siegelPruefen(gelesen, siegelWert)) {', 'if (false) {') }],
  ['K', 'mb speichert wieder', { mbOrch: ersetze(q0.mbOrch, '(NUR_WERT || OHNE_ABLAGE) ? { id: null }', 'NUR_WERT ? { id: null }') }],
  /* v3941 / v3946 */
  ['K', 'wieder Stufe 2 angefragt', { dienst: ersetze(D, 'const MB_STUFE = 3;', 'const MB_STUFE = 2;') }],
  ['K', 'Schnellmodus statt Stufe 3 wie in der App', { dienst: ersetze(D, 'return { address: adr, wert_stufe: MB_STUFE,', 'return { address: adr, wert_stufe: MB_STUFE, fast: true,') }],
  ['K', 'mb begrenzt die Stufe nicht', { mbApi: ersetze(q0.mbApi, 'b.wert_stufe = Math.min(3, ', 'b.wert_stufe = Math.min(9, ') }],
  ['K', 'ohne Anschrift trotzdem Bodenrichtwert und Verfahren', { dienst: ersetze(D, "  const genau = !!(p.address && typeof p.address.street === 'string' && p.address.street.trim());", '  const genau = true;') }],
  ['K', 'Sachwert ohne Sachwertfaktor als Wertindikation', { dienst: ersetze(D, "if (f && f.verfuegbar && !(f.art === 'sachwert' && !f.marktangepasst)) {", 'if (f && f.verfuegbar) {') }],
  ['K', 'Angebotspreise als Vergleichswert', { dienst: ersetze(D, "  } else if (cmp.basis === 'kaufpreise' && _n(cmp.vergleichswert_eur) > 0) {", "  } else if (_n(cmp.vergleichswert_eur) > 0) {") }],
  ['K', 'Kapitel des KI-Texts behalten ihre Buchstaben', { dienst: ersetze(D, '    if (art === \'h\') t = ueberschrift(t);', '') }],
  ['K', 'Portalnamen in Wertermittlungstexten', { dienst: ersetze(D, "  if (!s || !_ohneQuelle(s)) return null;", '  if (!s) return null;').split(".replace(/\\bBORIS[\\w-]*/g, '')").join('') }],
  ['K', 'Lizenzkennung wird zur Spanne', { dienst: ersetze(D, "  s = s.replace(/dl-de\\/(by|zero)-2-0/gi, 'DLDE_$1_20');", '') }],
  ['K', 'KI-Kosten nicht erfasst', { dienst: ersetze(D, "try { ki = deps().kiVerbrauch.erfasseFremdPosten(", "try { ki = 0 && deps().kiVerbrauch.erfasseFremdPosten(") }],
  ['L', 'Texterkennung im Dienst entfernt', { dienst: ersetze(D, 'try { ocr = await d.ocr(datei.buffer); } catch (e) { ocr = null; }', 'ocr = null;') }],
  ['L', 'Texterkennung nach dem Schwärzen statt davor (Rohtext an die KI)', { dienst: ersetze(D, '  const sw = d.schwaerzen.schwaerze(roh);\n  const text = sw.text;', '  const sw = d.schwaerzen.schwaerze(roh);\n  const text = roh;') }],
  ['L', 'ocrAusPuffer schreibt nach tmpdir', { ocr: ersetze(q0.ocr, "  if (!Buffer.isBuffer(pdf) || !pdf.length) throw new Error('Texterkennung: kein PDF-Puffer');", "  if (!Buffer.isBuffer(pdf) || !pdf.length) throw new Error('Texterkennung: kein PDF-Puffer');\n  fs.writeFileSync(path.join(os.tmpdir(), 'ocr-ec.pdf'), pdf); try { fs.unlinkSync(path.join(os.tmpdir(), 'ocr-ec.pdf')); } catch (e) {}") }],
  ['L', 'Seitengrenze 20 statt 6', { ocr: ersetze(q0.ocr, 'const OCR_MAX_SEITEN = 6;', 'const OCR_MAX_SEITEN = 20;') }],
  ['L', 'kein Zeitlimit', { ocr: ersetze(q0.ocr, "    const uhr = setTimeout(function () { try { p.kill('SIGKILL'); } catch (e) {} ende(nein, Object.assign(new Error('Texterkennung: Zeitüberschreitung'), { code: 'ZEIT' })); }, fristMs);", "    const uhr = null;") }],
  ['L', 'freier Teil zählt den Scan nicht mit', { dienst: ersetze(D, 'const zuLesen = alle.slice(0, max);', 'const zuLesen = alle.slice(0, max + (alle[0] && /%scan/.test(alle[0].buffer.toString("latin1")) ? 1 : 0));') }],
  ['M', 'Code wieder nur angehängt', { front: ersetze(q0.front, "      if (code && !frei) href = mitCode(href, code).split('#')[0];", "      if (code && !frei) href += (href.indexOf('?') >= 0 ? '&' : '?') + 'code=' + encodeURIComponent(code);") }],
  /* v3944 */
  ['N', 'mb-Auszug lässt die Zensus-Miete als Vergleichsmiete durch', { mbVgl: ersetze(q0.mbVgl, "export const VGL_STUFEN = ['mietspiegel', 'amtlich', 'naeherung'];", "export const VGL_STUFEN = ['mietspiegel', 'amtlich', 'naeherung', 'zensus', 'satz_mittel', 'angebot'];") }],
  ['N', 'mb-Auszug liest nur den Ertragswert (fehlt bei ETW ohne Miteigentumsanteil)', { mbVgl: ersetze(q0.mbVgl, 'const b = (crossCheck && crossCheck.miete_band && crossCheck.miete_band.anker_stufe) ? crossCheck.miete_band : (ew.miete_band || null);', 'const b = ew.miete_band || null;') }],
  ['N', 'mb-Auszug erst nach der Stufensperre', { mbOrch: ersetze(ersetze(q0.mbOrch, '      try { _vglAuszug = vergleichsmieteAuszug(crossCheck); }', '      try { _vglAuszug = null; }'),
    "      step('quercheck: nicht im Umfang (Stufe ' + _stufe + ')');", "      step('quercheck: nicht im Umfang (Stufe ' + _stufe + ')'); _vglAuszug = vergleichsmieteAuszug(crossCheck);") }],
  ['N', 'mb-Route fragt die Vergleichsmiete nicht an', { mbApi: ersetze(q0.mbApi, '{ ohneAblage: true, vergleichsmiete: true }', '{ ohneAblage: true }') }],
  ['N', 'Dienst reicht den Quellentext durch', { dienst: ersetze(D, "  return { qm: qm, art: v.art, ca: v.art === 'naeherung',", "  return { quelle: v.quelle, qm: qm, art: v.art, ca: v.art === 'naeherung',") }],
  ['N', 'Dienst nimmt jede Art', { dienst: ersetze(D, "if (!v || v.verfuegbar !== true || VGL_ARTEN.indexOf(v.art) < 0) return null;", "if (!v || !(v.qm > 0)) return null;") }],
  ['N', 'Frontend rechnet die Bremse selbst (120 %)', { front: ersetze(q0.front, 'var grenze = vglQm ? MP.zielmieteBremse({ ziel_qm: vglQm, vgl_qm: vglQm, bremse: bremse }) : null;', 'var grenze = vglQm ? { obergrenze_qm: vglQm * 1.2 } : null;') }],
  ['N', 'Frontend nennt ohne Vergleichsmiete den Marktdurchschnitt als Richtwert', { front: ersetze(q0.front, "    else nv = { art: 'ohne', qm: null };", "    else nv = marktQm ? { art: 'richtwert', qm: marktQm } : { art: 'ohne', qm: null };") }],
  ['N', 'Frontend zeigt keinen Abstand im Jahr', { front: ersetze(q0.front, "' im Monat, ' + eurS(nv.plus_jahr) + ' im Jahr.'", "' im Monat.'") }],
  /* v3946 */
  ['O', 'Restschuld jährlich statt Monat für Monat', { kerne: { 'darlehen-weitere.js': ersetze(lies(path.join(WURZEL, 'frontend/js/darlehen-weitere.js')), '      var zm = rs * z / 12;', '      var zm = (m - start) % 12 === 0 ? rs * z : 0; if ((m - start) % 12 !== 0) { if (cb) cb(m, 0, 0, rs); continue; }') } }],
  ['O', 'Anschluss mit 4 % statt 5 %', { front: ersetze(q0.front, 'var ANSCHLUSS_ZINS = 5.0;', 'var ANSCHLUSS_ZINS = 4.0;') }],
  ['O', 'Anschluss mit eigener Tilgung', { front: ersetze(q0.front, 'var plan2 = DW.monatsplan({ betrag: rs, zins: anschlussZins, tilg: e.tilg }, 1200);', 'var plan2 = DW.monatsplan({ betrag: rs, zins: anschlussZins, tilg: 1 }, 1200);').split("d1: rs, d1z: anschlussZins, d1t: e.tilg, ek: r.ek });").join("d1: rs, d1z: anschlussZins, d1t: 1, ek: r.ek });") }],
  ['O', 'Restschuld selbst gerechnet', { front: ersetze(q0.front, '    var rs = plan.length ? plan[plan.length - 1].rs : r.d1;', '    var rs = r.d1 * Math.pow(1 + e.zins / 1200, bind * 12) - (r.d1 * (e.zins + e.tilg) / 1200) * (Math.pow(1 + e.zins / 1200, bind * 12) - 1) / (e.zins / 1200) * 1.01;') }],
  ['P', 'Kauf ohne Prüfung der Grundangaben', { dienst: ersetze(D, '  if (fehlt.length) {\n    const e = new Error(\'Bitte zuerst die Grundangaben', '  if (false) {\n    const e = new Error(\'Bitte zuerst die Grundangaben') }],
  ['P', '/auslesen verlangt wieder die Grundangaben', { route: ersetze(R, "    const dateien = req.files || [];\n    if (!dateien.length) return res.status(400).json({ error: 'Bitte mindestens ein PDF hochladen.', code: 'keine_datei' });", "    const dateien = req.files || [];\n    if (!dateien.length) return res.status(400).json({ error: 'Bitte mindestens ein PDF hochladen.', code: 'keine_datei' });\n    if (ec.grundFehlt(req.body && req.body.grund).length) return res.status(400).json({});") }],
  ['P', 'Ergebnis ohne vollständige Grundangaben', { front: ersetze(q0.front, '    else if ((S.frei || S.ohneUnterlagen) && S.grund && !grundFehlt(S.grund).length) zeigeErgebnis();', '    else if (S.frei || S.ohneUnterlagen) zeigeErgebnis();') }],
  /* einzelcheck-3 */
  ['S', 'Marktbericht wieder als Exposé gelesen', { dienst: ersetze(D, "  const typ = istWertbericht(text, name, erk) ? 'wertbericht'\n    : istExpose", "  const typ = false ? 'wertbericht'\n    : istExpose") }],
  ['S', 'Widerspruch still mit der Unterlage überschrieben', { front: ersetze(q0.front, "      if (!gleich(VORBELEGBAR[k], werte[k], u)) konflikt[k] =", "      if (!gleich(VORBELEGBAR[k], werte[k], u)) werte[k] = u; if (false) konflikt[k] =") }],
  ['S', 'Weiter trotz offener Wahl', { front: ersetze(q0.front, '      if (nochOffen.length) {', '      if (false) {') }],
  ['S', 'nach dem Auslesen gleich das Ergebnis', { front: ersetze(q0.front, "      S.frei = j; S.herkunft = j.herkunft || {}; S.ohneUnterlagen = false;\n      zeigeGrund();", "      S.frei = j; S.herkunft = j.herkunft || {}; S.ohneUnterlagen = false;\n      zeigeErgebnis();") }],
  ['P', 'Browser ohne Zinsbindung als Pflicht', { front: ersetze(q0.front, "  var GRUND_PFLICHT = ['kp', 'nkm', 'wfl', 'art', 'ek_eur', 'zins_pct', 'tilg_pct', 'bindung_j'];", "  var GRUND_PFLICHT = ['kp', 'nkm', 'wfl', 'art', 'ek_eur', 'tilg_pct', 'bindung_j'];") }],
  ['P', 'Grundangaben schlagen die gelesenen Werte nicht', { dienst: ersetze(D, '  const z = Object.assign({}, gelesen, grundSauber(grund));', '  const z = Object.assign({}, grundSauber(grund), gelesen);') }],
  ['Q', 'Stripe wieder im zweiten Fenster', { front: ersetze(q0.front, "        var weiter = function () { location.href = r.url; };", "        var weiter = function () { window.open(r.url, '_blank'); };") }],
  ['Q', 'Bericht startet nach der Rückkehr nicht von selbst', { front: ersetze(q0.front, '          if (s && s.bezahlt) { erstelleBericht(); return; }', '          if (s && s.bezahlt) { zeigeRueckkehr(); return; }') }],
  ['Q', 'Ablage bleibt nach dem Bericht liegen', { front: ersetze(q0.front, '        ablage.loeschen();   /* v3946 · Bericht fertig', '        /* v3946 · Bericht fertig') }],
  ['Q', 'Datenschutztext ohne Ablage', { front: ersetze(q0.front, "Für die Zahlung legt dein Browser die Unterlagen kurz auf deinem Gerät ab, damit", "Für die Zahlung bleiben die Unterlagen offen, damit") }],
  ['R', 'Buchstabe vor der Überschrift', { front: ersetze(q0.front, "'Finanzierung und Anschluss', annahmeText(r))", "'A · Finanzierung und Anschluss', annahmeText(r))") }],
  ['R', 'KI-Kapitel im Browser nicht umbenannt', { front: ersetze(q0.front, "html += b.art === 'h' ? '<h3>' + D.esc(kapitel(b.text)) + '</h3>'", "html += b.art === 'h' ? '<h3>' + D.esc(b.text) + '</h3>'") }],
  ['R', 'Bodenrichtwert nicht auf dem Deckblatt', { front: ersetze(q0.front, "      kz: [{ l: 'Bodenrichtwert',", "      kz: [{ l: 'Grundwert',") }],
  ['R', 'Gedankenstrich im Kundentext', { front: ersetze(q0.front, "zeile('Tilgung im Jahr', dez(h.tilg, 2) + ' %', a && dez(a.tilg, 2) + ' %', { det: 'Anschluss mit derselben Tilgung' }),", "zeile('Tilgung im Jahr', dez(h.tilg, 2) + ' %', a && dez(a.tilg, 2) + ' %', { det: 'Anschluss – dieselbe Tilgung' }),") }],
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

/* einzelcheck-2 (24.11.2026) · Lagekarte, Bericht per Mail, Fenster schließt nicht per Klick daneben */
{
  const s2 = require(P.dienst);
  const front = fs.readFileSync(P.front, 'utf8');
  const kaufer = (o) => Object.assign({ id: 'k1', status: 'bezahlt', gueltig_bis: new Date(Date.now() + 864e5).toISOString(), mails: 0, amount_cents: 399, anrechnung_code: 'EC1A2B3C4D5E' }, o || {});
  const tab = { mails: 0 }, log = [];
  const deps = (o) => Object.assign({
    query: async (t, pa) => { log.push(t); if (/SET mails = mails \+ 1/.test(t)) { if (tab.mails >= pa[1]) return { rowCount: 0, rows: [] }; tab.mails++; return { rowCount: 1, rows: [{ mails: tab.mails }] }; }
      if (/GREATEST\(mails - 1/.test(t)) { tab.mails = Math.max(0, tab.mails - 1); return { rowCount: 1, rows: [] }; } return { rowCount: 0, rows: [] }; },
    pdfFetch: async () => ({ ok: true, arrayBuffer: async () => Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(2000)]) }),
    sendMail: async (m) => { log.push('MAIL ' + m.to + ' ' + (m.attachments || []).length); return { messageId: 'x' }; },
    mbFetch: async (u) => ({ ok: true, headers: { get: () => 'image/png' }, arrayBuffer: async () => Buffer.from('PNGDATA') })
  }, o || {});
  const HTML = '<!doctype html><html><head></head><body>' + 'x'.repeat(400) + '</body></html>';
  const altG = process.env.PDF_DIENST_SECRET; process.env.PDF_DIENST_SECRET = 'geheim-test';
  try {
    s2._setzeDeps(deps());
    const r1 = await s2.berichtMailen(kaufer(), 'kaeufer@beispiel.de', HTML, 'ETW in 32609 Hüllhorst');
    if (r1.ok && tab.mails === 1 && log.some((x) => /^MAIL kaeufer@beispiel\.de 1$/.test(x))) ok('Mail: PDF als Anhang, Zähler 1'); else fehl('Mail: kein Versand oder Zähler falsch ' + JSON.stringify(r1));
    let e2 = null; try { await s2.berichtMailen(kaufer(), 'keine-adresse', HTML, 't'); } catch (e) { e2 = e; }
    if (e2 && e2.code === 'email') ok('Mail: ungültige Adresse abgewiesen'); else fehl('Mail: ungültige Adresse geht durch');
    tab.mails = 3; let e3 = null; try { await s2.berichtMailen(kaufer({ mails: 3 }), 'a@beispiel.de', HTML, 't'); } catch (e) { e3 = e; }
    if (e3 && e3.code === 'mails_aufgebraucht') ok('Mail: Deckel ' + s2.MAX_MAILS + ' je Kauf'); else fehl('Mail: Deckel greift nicht');
    tab.mails = 0; s2._setzeDeps(deps({ sendMail: async () => { throw new Error('smtp'); } }));
    let e4 = null; try { await s2.berichtMailen(kaufer(), 'a@beispiel.de', HTML, 't'); } catch (e) { e4 = e; }
    if (e4 && e4.code === 'mail' && tab.mails === 0) ok('Mail: SMTP-Fehler gibt den Zähler zurück'); else fehl('Mail: Zähler bleibt nach SMTP-Fehler stehen (' + tab.mails + ')');
    s2._setzeDeps(deps({ pdfFetch: async () => ({ ok: true, arrayBuffer: async () => Buffer.from('<html>kein pdf</html>') }) }));
    let e5 = null; try { await s2.berichtMailen(kaufer(), 'a@beispiel.de', HTML, 't'); } catch (e) { e5 = e; }
    if (e5 && e5.code === 'pdf' && tab.mails === 0) ok('Mail: ohne echtes PDF keine Mail'); else fehl('Mail: Antwort ohne %PDF wird verschickt');
    const mi = s2.mailInhalt({ titel: 'ETW', code: 'EC1A2B3C4D5E', code_text: 'Er rechnet die 3,99 € an', code_bis: '08.12.2026' });
    const kunde = mi.text + ' ' + mi.html.replace(/<[^>]+>/g, ' ');
    if (!/[–—;]/.test(kunde.replace(/&[a-z]+;/g, ''))) ok('Mail: Kundentext ohne Gedankenstrich und Semikolon'); else fehl('Mail: Gedankenstrich oder Semikolon im Text');
    if (/abbestellen/.test(mi.text) && /app\.dealpilot\.immo\/\?code=EC1A2B3C4D5E/.test(mi.text) && !/staging/.test(mi.text)) ok('Mail: Widerspruchshinweis, Prod-Link mit Code'); else fehl('Mail: Widerspruch oder Link fehlt');
    if (/geomap|scout|immowelt|pricehubble|sprengnetter/i.test(kunde)) fehl('Mail: Quellenname im Text'); else ok('Mail: keine Quellennamen');
    delete process.env.PDF_DIENST_SECRET; s2._setzeDeps(deps());
    let e6 = null; try { await s2.berichtMailen(kaufer(), 'a@beispiel.de', HTML, 't'); } catch (e) { e6 = e; }
    if (e6 && e6.code === 'kein_dienst') ok('Mail: ohne PDF-Dienst 503 statt stiller Mail'); else fehl('Mail: ohne PDF-Dienst kein sauberer Fehler');
    if (s2.mailErlaubt(kaufer({ status: 'offen' })).code === 'nicht_bezahlt' && s2.mailErlaubt(kaufer({ gueltig_bis: '2020-01-01' })).code === 'kauf_abgelaufen') ok('Mail: nur bezahlt und gültig'); else fehl('Mail: offener oder abgelaufener Kauf darf mailen');
    s2._setzeDeps(deps());
    const k1 = await s2.karteHolen({ lat: 52.27, lon: 8.62, street: 'Musterweg' });
    const k0 = await s2.karteHolen({ city: 'Hüllhorst' });
    if (k1 && /^data:image\/png;base64,/.test(k1.bild) && k1.genau && k0 === null) ok('Lagekarte: mit Koordinaten data:-Bild, ohne keine'); else fehl('Lagekarte: falsch ' + JSON.stringify([k1 && k1.genau, k0]));
    s2._setzeDeps(deps({ mbFetch: async () => ({ ok: true, headers: { get: () => 'text/html' }, arrayBuffer: async () => Buffer.from('x') }) }));
    if ((await s2.karteHolen({ lat: 52, lon: 8 })) === null) ok('Lagekarte: kein Bild, keine Karte'); else fehl('Lagekarte: HTML-Antwort wird als Bild genommen');
  } finally { s2._setzeDeps(null); if (altG == null) delete process.env.PDF_DIENST_SECRET; else process.env.PDF_DIENST_SECRET = altG; }
  /* Fenster: Klick daneben schließt nicht (Marcel 24.11.2026), × und Esc schon */
  if (/class="ec-dunkel"><\/div>/.test(front) && !/class="ec-dunkel" data-zu/.test(front)) ok('Fenster: Klick auf den Hintergrund schließt nicht'); else fehl('Fenster: Hintergrund trägt data-zu und schließt');
  if (/_laeuft > 0/.test(front) && /Trotzdem schließen/.test(front)) ok('Fenster: Rückfrage, solange Hochladen oder Auslesen läuft'); else fehl('Fenster: keine Rückfrage bei laufender Anfrage');
  if (!/'Unterlagen', D\.abschnitt\('Deine Unterlagen'/.test(front) || /var ud = \[\];/.test(front)) ok('Bericht: Seite Unterlagen und Hinweise entfällt'); else fehl('Bericht: Seite Unterlagen noch drin');
  if (/Marktpreisindikation aus Angebotspreisen<\/h3>/.test(front) && /kein Verkehrswert/.test(front)) ok('Bericht: Marktpreisindikation getrennt vom Vergleichswertverfahren'); else fehl('Bericht: Marktpreisindikation nicht getrennt');
  if (/bild: deckFoto \|\| m\.karte \|\| deckBild\(\)/.test(front)) ok('Bericht: Deckblatt Foto, sonst Lagekarte'); else fehl('Bericht: Deckblatt ohne Karte');
}

console.log('\n' + (rot ? 'ROT: ' + rot + ' Befund(e)' : 'GRÜN: alles sauber') + ' · RC=' + (rot ? 1 : 0));
process.exit(rot ? 1 : 0);
