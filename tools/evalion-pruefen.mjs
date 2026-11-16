#!/usr/bin/env node
/* tools/evalion-pruefen.mjs — v3540
 *
 * Prueft die Anbindung des unabhaengigen Gutachterpartners (Evalion, Partner Form API):
 *   A  Signatur: Kanonisierung und HMAC gegen eine UNABHAENGIGE Nachrechnung im Pruefer
 *      (die Doku hat kein Beispiel mit Secret und erwarteter Signatur), leerer Rumpf,
 *      multipart als exakte Bytes, Idempotency-Key nach Muster, keine Zugangsdaten im Code.
 *   B  Abbildung Objekt -> Formular (frontend/js/gutachterpartner-abbildung.js) am
 *      Lite-Beispiel der Doku (tools/evalion-beispiele/): Objektart, Adresse, Baujahr,
 *      Modernisierungen, visibleWhen, nur sichtbare Felder werden gesendet, Fehler feldgenau.
 *   C  Ohne Konfiguration: konfig() null, Aufruf 503 „nicht_konfiguriert“, die Route prueft
 *      Freigabe und Konfiguration VOR jedem Aufruf beim Partner.
 *   D  --live [--env=Datei] [--anzahl=1..3] [--formularweg] [--voll-entwurf [--voll-absenden]]: NUR gegen die TEST-Umgebung
 *      (Host mit „staging“): Formular lite + voll abrufen, N Ersteinschaetzungen anlegen und
 *      absenden, einen vollstaendigen Entwurf anlegen (ohne Absenden, ausser --voll-absenden).
 *      Anfragende Person „DealPilot Test“, Testadresse aus dem Demo-Objekt, Mail @example.com.
 *      Gibt Anfrage-IDs aus, nie Zugangsdaten.
 *
 *   node tools/evalion-pruefen.mjs
 *   node tools/evalion-pruefen.mjs --live --env=Dateien/Testunterlagen/evalion-test.env
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n) => { const a = process.argv.find((x) => x === '--' + n || x.startsWith('--' + n + '=')); return a ? (a.includes('=') ? a.split('=').slice(1).join('=') : true) : null; };

let fehler = 0, punkte = 0;
function pruefe(name, ok, info) { punkte++; if (!ok) fehler++; console.log((ok ? '  ok   ' : '  ROT  ') + name + (info && !ok ? '  -> ' + info : '')); }

/* Zugangsdaten fuer den Pruefer nie aus der Umgebung des Aufrufers erben (Teil C misst „ohne“) */
const ENV_ALT = {};
['EVALION_BASE_URL', 'EVALION_KEY_ID', 'EVALION_SECRET'].forEach((k) => { ENV_ALT[k] = process.env[k]; delete process.env[k]; });
const ev = require(path.join(WURZEL, 'backend/src/services/evalionClient.js'));
const A = require(path.join(WURZEL, 'frontend/js/gutachterpartner-abbildung.js'));

/* ── A Signatur ─────────────────────────────────────────────────────── */
console.log('A  Signatur (Kanonisierung, HMAC, Rumpf)');
const LEER = crypto.createHash('sha256').update('').digest('hex');
pruefe('SHA-256 des leeren Rumpfs', ev.LEER_SHA256 === LEER && ev.sha256Hex(Buffer.alloc(0)) === LEER);
const k0 = { keyId: 'pruef-key', secret: 'pruef-secret-nicht-echt' };
const koepfe = ev.signaturKoepfe(k0, 'get', '/api/v1/partner/forms/remaining-useful-life-lite', Buffer.alloc(0), 1763290000);
const kanonErwartet = 'GET\n/api/v1/partner/forms/remaining-useful-life-lite\n1763290000\n' + LEER;
pruefe('kanonisch = METHODE\\nPFAD\\nZEIT\\nSHA, ohne Zeilenende', ev.kanonisch('get', '/api/v1/partner/forms/remaining-useful-life-lite', 1763290000, LEER) === kanonErwartet);
const sigErwartet = crypto.createHmac('sha256', 'pruef-secret-nicht-echt').update(kanonErwartet).digest('base64');
pruefe('Signatur = base64(HMAC_SHA256(secret, kanonisch))', koepfe['X-Evalion-Signature'] === sigErwartet, koepfe['X-Evalion-Signature']);
pruefe('vier Kopfzeilen, Zeitstempel in Sekunden', koepfe['X-Evalion-Key-Id'] === 'pruef-key' && koepfe['X-Evalion-Timestamp'] === '1763290000'
  && koepfe['X-Evalion-Content-SHA256'] === LEER && Object.keys(koepfe).length === 4);
const jetzt = ev.signaturKoepfe(k0, 'GET', '/x', null)['X-Evalion-Timestamp'];
pruefe('Zeitstempel aus der Serverzeit (±2 s)', Math.abs(Number(jetzt) - Date.now() / 1000) < 2);
const json = Buffer.from(JSON.stringify({ form: { type: 'remaining-useful-life-lite' }, data: { a: 'ä' } }), 'utf8');
pruefe('Inhalts-SHA ueber die exakten UTF-8-Bytes', ev.signaturKoepfe(k0, 'POST', '/p', json, 1)['X-Evalion-Content-SHA256'] === crypto.createHash('sha256').update(json).digest('hex'));
const mp = ev.multipart({ fieldId: 'construction.energyCertificateFile', documentCategory: '' }, { puffer: Buffer.from('%PDF-1.4 test'), name: 'Energieausweis Ä.pdf', mime: 'application/pdf' });
const mpText = mp.rumpf.toString('latin1');
pruefe('multipart: Feld fieldId, Datei „file“, leere Felder weggelassen, Grenze im Typ',
  /name="fieldId"\r\n\r\nconstruction\.energyCertificateFile\r\n/.test(mpText) && /name="file"; filename="Energieausweis _.pdf"/.test(mpText)
  && !/documentCategory/.test(mpText) && mp.typ.indexOf(mpText.slice(2, mpText.indexOf('\r\n'))) > 0);
const idem = ev.idemSchluessel('dp-absenden');
pruefe('Idempotency-Key nach Vertrag (^[A-Za-z0-9._:-]+$, ≤ 120)', /^[A-Za-z0-9._:-]+$/.test(idem) && idem.length <= 120 && idem !== ev.idemSchluessel('dp-absenden'));
const quelltexte = ['backend/src/services/evalionClient.js', 'backend/src/routes/gutachterpartner.js', 'frontend/js/gutachterpartner.js', 'frontend/js/gutachterpartner-abbildung.js']
  .map((f) => fs.readFileSync(path.join(WURZEL, f), 'utf8')).join('\n');
pruefe('kein Secret/Key im Code, Zugang nur aus process.env', !/EVALION_SECRET\s*[:=]\s*['"][^'"]{8,}/.test(quelltexte) && /process\.env\.EVALION_SECRET/.test(quelltexte));
pruefe('Secret nie im Log (kein console.* mit secret)', !/console\.[a-z]+\([^)]*secret/i.test(quelltexte));
pruefe('Frontend kennt kein Secret und keinen Anbieter-Host', !/EVALION|evalion\.net/i.test(fs.readFileSync(path.join(WURZEL, 'frontend/js/gutachterpartner.js'), 'utf8')));
const f401 = ev.fehlerText({ status: 401, zeitabweichung_s: 412, body: { code: 'authentication_failed', message: 'Partner authentication failed.' } });
pruefe('401 nennt Zeitabweichung und Schluessel als Ursache', /5 Minuten/.test(f401.error) && /412 s/.test(f401.error) && f401.code === 'authentication_failed');
/* auth-401-handler.js haelt „401“ in der Meldung fuer eine abgelaufene DealPilot-Sitzung und meldet ab (gemessen 16.11.2026) */
const h401 = fs.readFileSync(path.join(WURZEL, 'frontend/js/auth-401-handler.js'), 'utf8');
pruefe('Fehlertext ohne „401“ (sonst meldet auth-401-handler.js den Nutzer ab)', /\\b401\\b/.test(h401) && !/\b401\b/.test(f401.error)
  && !/\b401\b/.test(ev.fehlerText({ status: 400, body: { message: 'HTTP 401 upstream' } }).error), f401.error);
const fNeutral = ev.fehlerText({ status: 400, body: { code: 'validation_failed', message: 'Evalion konnte das nicht prüfen', errors: [{ path: 'x', message: 'bei Evalion' }] } });
pruefe('Fehlertexte ohne Anbieternamen, feldgenau', !/evalion/i.test(JSON.stringify(fNeutral)) && fNeutral.felder.length === 1 && fNeutral.felder[0].path === 'x');

/* ── B Abbildung ────────────────────────────────────────────────────── */
console.log('B  Abbildung Objekt -> Formular (Lite-Beispiel der Doku)');
const lite = JSON.parse(fs.readFileSync(path.join(WURZEL, 'tools/evalion-beispiele/form-definition-remaining-useful-life-lite.json'), 'utf8')).data;
const etw = { objart: 'ETW', str: 'Ravensberger Weg', hnr: '38', plz: '33602', ort: 'Bielefeld', baujahr: '1965', wfl: '72,5',
  mod: { dach: '10 - 20 Jahre', fenster: '< 5 Jahre', heizung: 'Keine/Nie', grundriss: '5 - 10 Jahre' } };
const nutzer = { vorname: 'DealPilot', nachname: 'Test', email: 'dealpilot-test@example.com' };
const v = A.vorbelegen(lite, etw, nutzer);
pruefe('Objektart ETW -> apartment', A.holen(v, 'property.type') === 'apartment', A.holen(v, 'property.type'));
pruefe('Beschreibung (Pflicht bei apartment) als Freitext', /^Eigentumswohnung, ca\. 73 m²/.test(A.holen(v, 'property.description') || ''), A.holen(v, 'property.description'));
pruefe('Baujahr als Zahl', A.holen(v, 'property.constructionYear') === 1965);
pruefe('Adresse: nur Felder der Definition (Straße, Ort)', A.holen(v, 'property.address.streetName') === 'Ravensberger Weg' && A.holen(v, 'property.address.city') === 'Bielefeld'
  && A.holen(v, 'property.address.postalCode') === undefined, JSON.stringify(A.holen(v, 'property.address')));
pruefe('Dach „10 - 20 Jahre“ -> fifteenToTwentyYears (vorsichtig)', A.holen(v, 'modernizations.roof') === 'fifteenToTwentyYears', A.holen(v, 'modernizations.roof'));
pruefe('anfragende Person: Vorname, E-Mail', A.holen(v, 'requester.firstName') === 'DealPilot' && A.holen(v, 'requester.email') === 'dealpilot-test@example.com');
const vMfh = A.vorbelegen(lite, { objart: 'MFH', baujahr: '1880' }, {});
pruefe('MFH -> apartmentBuilding, keine Beschreibung', A.holen(vMfh, 'property.type') === 'apartmentBuilding' && A.holen(vMfh, 'property.description') === undefined);
const vZfh = A.vorbelegen(lite, { objart: 'ZFH' }, {});
pruefe('ZFH: Lite kennt twoFamilyHouse nicht -> singleFamilyHouse', A.holen(vZfh, 'property.type') === 'singleFamilyHouse', A.holen(vZfh, 'property.type'));
const vBuero = A.vorbelegen(lite, { objart: 'BUERO' }, {});
pruefe('Büro -> commercialProperty + Beschreibung aus den Optionen', A.holen(vBuero, 'property.type') === 'commercialProperty' && A.holen(vBuero, 'property.description') === 'Büro / Bank / Praxis', A.holen(vBuero, 'property.description'));
pruefe('Baujahr außerhalb 1800–heute wird nicht gesetzt', A.holen(A.vorbelegen(lite, { objart: 'EFH', baujahr: '1750' }, {}), 'property.constructionYear') === undefined);
pruefe('Modernisierungsstufen: alle sechs DealPilot-Werte abgebildet', ['Keine/Nie', '> 20 Jahre', '10 - 20 Jahre', '5 - 10 Jahre', '< 5 Jahre', 'Kernsanierung']
  .every((x) => /^(none|moreThanTwentyYears|fifteenToTwentyYears|fiveToTenYears|fiveYears)$/.test(A.MOD_STUFE[x])));
const desc = A.felder(lite)[0].fields.filter((f) => f.id === 'property.description');
pruefe('visibleWhen: Freitext nur bei apartment, Auswahl nur bei Gewerbe/Sonstiges',
  A.sichtbar(desc[0], { property: { type: 'apartment' } }) && !A.sichtbar(desc[0], { property: { type: 'singleFamilyHouse' } })
  && A.sichtbar(desc[1], { property: { type: 'other' } }) && !A.sichtbar(desc[1], { property: { type: 'apartment' } }));
const ren = A.felder(lite).find((g) => g.id === 'renovation').fields.find((f) => f.id === 'renovation.year');
const ges = A.sammeln(lite, { 'renovation.hasRenovations': 'no', 'renovation.year': '2018', 'property.constructionYear': '1.965' });
pruefe('nur sichtbare Felder werden gesendet (Jahr der Kernsanierung bei „no“ weg)', ges.renovation && ges.renovation.hasRenovations === 'no' && ges.renovation.year === undefined && !A.sichtbar(ren, ges));
pruefe('Zahlen nach Schema (integer): „1.965“ -> 1965', ges.property.constructionYear === 1965, ges.property.constructionYear);
const ges2 = A.sammeln(lite, { 'renovation.hasRenovations': 'yes', 'renovation.year': '2018' });
pruefe('sichtbar bei „yes“: Jahr als Zahl', ges2.renovation.year === 2018);
const vf = JSON.parse(fs.readFileSync(path.join(WURZEL, 'tools/evalion-beispiele/validation-error-response.json'), 'utf8'));
const zu = A.fehlerZuordnen(lite, vf.errors);
pruefe('Fehler der Doku feldgenau zugeordnet (Baujahr am Feld)', zu.jeFeld['property.constructionYear'] && zu.jeFeld['property.constructionYear'].length === 1);
pruefe('Fehler zu unbekanntem Feld bleibt allgemein sichtbar', A.fehlerZuordnen(lite, [{ path: 'irgendwas.neu', message: 'm' }]).allgemein.length === 1);
pruefe('JSON Logic: and/or/!/in auf Zeichenkette', A.logik({ and: [{ '==': [1, 1] }, { or: [false, { in: ['b', 'abc'] }] }, { '!': [false] }] }, {}) === true);
pruefe('Name teilen: „Max Mustermann (Test)“', JSON.stringify(A.nameTeilen('Max Mustermann (Test)')) === '{"vorname":"Max","nachname":"Mustermann"}');
pruefe('Straße teilen: „Hermannstraße 9a“', JSON.stringify(A.strasseTeilen('Hermannstraße 9a')) === '{"str":"Hermannstraße","hnr":"9a"}');

/* ── C Ohne Konfiguration ───────────────────────────────────────────── */
console.log('C  Ohne Konfiguration');
pruefe('konfig() ohne Variablen = null', ev.konfig() === null);
process.env.EVALION_BASE_URL = 'http://unsicher.example'; process.env.EVALION_KEY_ID = 'k'; process.env.EVALION_SECRET = 's';
pruefe('konfig() nur mit https', ev.konfig() === null);
process.env.EVALION_BASE_URL = 'https://partner-api-staging.evalion.net/';
pruefe('Umgebung aus dem Host: staging = test', ev.konfig() && ev.konfig().umgebung === 'test' && ev.konfig().base === 'https://partner-api-staging.evalion.net');
process.env.EVALION_BASE_URL = 'https://partner-api.evalion.net';
pruefe('Umgebung aus dem Host: partner-api = produktion', ev.konfig() && ev.konfig().umgebung === 'produktion');
['EVALION_BASE_URL', 'EVALION_KEY_ID', 'EVALION_SECRET'].forEach((k) => delete process.env[k]);
const r503 = await ev.aufruf('GET', '/api/v1/partner/forms/remaining-useful-life-lite');
pruefe('Aufruf ohne Konfiguration: 503 nicht_konfiguriert, kein Netz', r503.status === 503 && r503.body.code === 'nicht_konfiguriert' && r503.ms === 0);
const route = fs.readFileSync(path.join(WURZEL, 'backend/src/routes/gutachterpartner.js'), 'utf8');
const iStatus = route.indexOf("router.get('/status'"), iTor = route.indexOf("code: 'nicht_konfiguriert'"), iForm = route.indexOf("router.get('/formular/");
pruefe('Route: /status vor dem Tor, Tor (Freigabe + Konfiguration) vor allen Partner-Aufrufen', iStatus > 0 && iTor > iStatus && iForm > iTor && /nicht_freigeschaltet/.test(route));
pruefe('Route: vollständige Anfrage nur mit kostenpflichtig_bestaetigt === true', /kostenpflichtig_bestaetigt !== true/.test(route));
pruefe('Route: jeder Partner-Aufruf protokolliert', (route.match(/await protokoll\(/g) || []).length >= 6);
const idx = fs.readFileSync(path.join(WURZEL, 'backend/src/index.js'), 'utf8');
pruefe('index.js montiert /api/v1/gutachterpartner', /app\.use\('\/api\/v1\/gutachterpartner', require\('\.\/routes\/gutachterpartner'\)\)/.test(idx));
const mig = fs.readdirSync(path.join(WURZEL, 'backend/migrations')).filter((f) => /gutachterpartner/.test(f));
pruefe('Migration gutachter_anfragen/gutachter_aufrufe vorhanden', mig.length === 1 && /gutachter_aufrufe/.test(fs.readFileSync(path.join(WURZEL, 'backend/migrations', mig[0]), 'utf8')));

/* ── E Live-Definitionen (abgelegt 16.11.2026): Deutsch, Vorbelegung, Direktweg ── */
console.log('E  Live-Definitionen lite + voll (tools/evalion-beispiele/live-definition-*.json)');
/* Felder, die DealPilot bewusst NICHT vorbelegt — mit Grund. Jedes andere Feld braucht eine Regel. */
const BEWUSST_LEER = {
  'property.description': 'nur ETW/Gewerbe, Regel vorhanden (sichtbar je Objektart)',
  'modernizations.floorPlan.scopeOfChanges': 'Umfang kennt DealPilot nicht',
  'modernizations.remarks': 'Freitext', 'renovation.year': 'Jahr der Kernsanierung kennt DealPilot nicht', 'renovation.description': 'Freitext',
  'construction.renovationsYearOfRenovations': 'Jahr kennt DealPilot nicht', 'construction.renovationsExplainRenovations': 'Freitext',
  'valuation.valuationDateComments': 'Freitext', 'objectDetails.propertyCommercialArea': 'Gewerbefläche führt DealPilot nicht',
  'objectDetails.propertyMonument': 'Denkmalschutz führt DealPilot nicht (N162)', 'objectDetails.propertyDefectRemarks': 'Freitext',
  'objectDetails.propertyFeaturesRemarks': 'Freitext', 'objectDetails.propertyDataNotes': 'Freitext',
  'construction.constructionType': 'Bauweise führt DealPilot nicht', 'construction.innerWalls': 'nicht im Objekt', 'construction.constructionCeilingType': 'nicht im Objekt',
  'construction.stairs': 'nicht im Objekt', 'construction.constructionWindowFrameType': 'Rahmen nicht im Objekt', 'construction.electricity': 'nicht im Objekt',
  'construction.energyCertificateFile': 'Datei wählt der Nutzer', 'construction.constructionRemarks': 'Freitext',
  'owner.ownerDetailsData': 'Personendaten Dritter nie vorbelegt', 'agreement.paymentType': 'Entscheidung des Nutzers',
  'agreement.addonService': 'Entscheidung des Nutzers (kostet)', 'agreement.taxPlausibilityCheckService': 'Entscheidung des Nutzers (kostet)',
  'agreement.acceptInitialAssessmentPrivacy': 'Zustimmung nur durch den Nutzer', 'agreement.acceptPrivacy': 'Zustimmung nur durch den Nutzer',
  'agreement.acceptTerms': 'Zustimmung nur durch den Nutzer', 'agreement.acceptServiceWithdrawalTerms': 'Zustimmung nur durch den Nutzer',
  'agreement.generalComments': 'Freitext', 'requester.acceptPrivacy': 'Zustimmung nur durch den Nutzer', 'requester.acceptTerms': 'Zustimmung nur durch den Nutzer'
};
const OBJ_TEST = { objart: 'MFH', str: 'Ravensberger Weg', hnr: '38', plz: '33719', ort: 'Bielefeld', baujahr: '1978', wfl: '606', einheiten: '8', nhk_geschosse: '1',
  nhk_dach: '3', eq_floor: 'TEPPICH_LAMINAT', eq_windows: 'ZWEIFACHVERGLASUNG', eq_roof: 'DACHPFANNEN', eq_heating: 'ZENTRALHEIZUNG', eq_bath: 'MIT_FENSTER',
  eq_guest_wc: 'GAESTE_WC', bad_anz: '8', balkon_flae: '24', inv_pv: '9000', ds2_energie: 'A+', kaufdat: '2020-04-01', eig_struktur: 'allein',
  mod: { dach: 'Keine/Nie', fenster: '10 - 20 Jahre', leitungen: 'Keine/Nie', heizung: '5 - 10 Jahre', aussenwand: 'Keine/Nie', baeder: '> 20 Jahre', innenausbau: 'Keine/Nie', grundriss: 'Keine/Nie' } };
const NUTZER_TEST = { vorname: 'DealPilot', nachname: 'Test', email: 'dealpilot-test@example.com', telefon: '+491700000000', firma: 'DealPilot Test', str: 'Musterstraße', hnr: '1', plz: '33602', ort: 'Bielefeld' };
for (const art of ['lite', 'voll']) {
  const datei = path.join(WURZEL, 'tools/evalion-beispiele/live-definition-' + art + '.json');
  if (!fs.existsSync(datei)) { pruefe('Live-Definition ' + art + ' abgelegt', false, datei); continue; }
  const d = JSON.parse(fs.readFileSync(datei, 'utf8')).data;
  const engl = [], unbek = [], ohneRegel = [];
  A.felder(d).forEach((g) => g.fields.forEach((f) => {
    const p = A.feldPfad(f);
    A.optionen(f, d.schema).forEach((o) => { const t = A.optionText(p, o); if (t.unbekannt) unbek.push(p + ':' + o.value); if (/^[a-z]+[A-Z][A-Za-z]*$/.test(t.text) || (/^[a-z]+$/.test(t.text) && t.text === o.value)) engl.push(p + ':' + t.text); });
    if (!BEWUSST_LEER[p] && !A.REGELN.some((r) => r[0].test(p))) ohneRegel.push(p);
  }));
  /* Unterfelder der Liste (Eigentuemer) */
  const items = (A.schemaAn(d.schema, 'owner.ownerDetailsData') || {}).items;
  if (items) Object.keys(items.properties || {}).forEach((u) => { if (!A.UNTERFELD[u]) ohneRegel.push('owner.ownerDetailsData.' + u + ' (Beschriftung)'); });
  pruefe(art + ': jede Option hat einen deutschen Text (keine unbekannte)', unbek.length === 0, unbek.join(' '));
  pruefe(art + ': keine englische Option im UI', engl.length === 0, engl.slice(0, 8).join(' '));
  pruefe(art + ': jedes Feld hat eine Vorbelege-Regel oder einen Grund, leer zu bleiben', ohneRegel.length === 0, ohneRegel.join(' '));
  const v = A.vorbelegenMitHerkunft(d, OBJ_TEST, NUTZER_TEST);
  const erw = { 'property.type': 'apartmentBuilding', 'property.constructionYear': 1978, 'modernizations.windowsAndExternalDoors': 'fifteenToTwentyYears',
    'modernizations.heatingSystem': 'fiveToTenYears', 'modernizations.bathroom': 'moreThanTwentyYears', 'property.address.postalCode': '33719',
    'requester.companyName': 'DealPilot Test', 'requester.address.city': 'Bielefeld' };
  if (art === 'voll') Object.assign(erw, { 'valuation.valuationDate': '2020-04-01', 'objectDetails.propertyArea': 606, 'objectDetails.propertyNumberOfUnits': 8,
    'objectDetails.propertyNumberOfBathrooms': 8, 'objectDetails.propertyNumberOfFullFloors': 2, 'objectDetails.propertyBasement': 'fullBasement',
    'construction.constructionGlazingType': ['twoWay'], 'construction.constructionRoofShape': 'flatRoof', 'construction.constructionRoofCovering': 'clayBricks',
    'construction.constructionHeatingType': 'gasCentral', 'construction.sanitary': ['guestToilet'], 'construction.balcony': 'available',
    'construction.renewableEnergies': 'photovoltaics', 'construction.energyCertificate': 'available', 'construction.energyEfficiencyClass': 'A',
    'construction.hasRenovations': 'no', 'owner.ownershipType': 'soleOwner', 'agreement.desiredProducts': 'noAssessment', 'agreement.leadSource': 'other' });
  else Object.assign(erw, { 'renovation.hasRenovations': 'no', 'requester.leadSource': 'other', 'requester.leadSourceDetails': 'DealPilot' });
  const ab = Object.keys(erw).filter((p) => JSON.stringify(A.holen(v.data, p)) !== JSON.stringify(erw[p])).map((p) => p + '=' + JSON.stringify(A.holen(v.data, p)) + ' statt ' + JSON.stringify(erw[p]));
  pruefe(art + ': Vorbelegung aus dem Testobjekt (' + Object.keys(erw).length + ' Felder)', ab.length === 0, ab.join(' · '));
  pruefe(art + ': Zustimmungen nie vorbelegt', !JSON.stringify(v.data).includes('accept'));
  pruefe(art + ': jede Vorbelegung trägt ihre Herkunft', Object.keys(v.herkunft).length > 0 && Object.values(v.herkunft).every((h) => h.quelle && /^(objekt|abgeleitet|konto)$/.test(h.art)));
  const ges = A.sammeln(d, (() => { const w = {}; A.felder(d).forEach((g) => g.fields.forEach((f) => { const p = A.feldPfad(f); const x = A.holen(v.data, p); if (x !== undefined) w[p] = x; })); return w; })());
  pruefe(art + ': Vorbelegung übersteht sammeln() (Typen, Sichtbarkeit)', ges.property && ges.property.constructionYear === 1978 && (art === 'lite' || (ges.objectDetails && ges.objectDetails.propertyNumberOfUnits === 8)));
}
pruefe('Modernisierung: alle sechs Stufen deutsch', ['fiveYears', 'fiveToTenYears', 'tenToFifteenYears', 'fifteenToTwentyYears', 'moreThanTwentyYears', 'none']
  .every((x) => /^(vor|nie)/.test(A.optionText('modernizations.roof', { value: x, label: x }).text)));
pruefe('echte deutsche Beschriftung des Partners gewinnt', A.optionText('property.type', { value: 'apartment', label: 'Wohnung' }).text === 'Wohnung');
pruefe('unbekannter Schlüssel: lesbar, als „weitere Angabe“ markiert', A.optionText('x.y', { value: 'newThing', label: 'newThing' }).text === 'weitere Angabe (new thing)');
pruefe('Pflichtfeld nach Bedingung (Energieklasse nur mit Ausweis)', (() => { const d = JSON.parse(fs.readFileSync(path.join(WURZEL, 'tools/evalion-beispiele/live-definition-voll.json'), 'utf8')).data;
  return A.pflicht(d, 'construction.energyEfficiencyClass', { construction: { energyCertificate: 'available' } }) && A.pflicht(d, 'objectDetails.propertyMonument', {}) && !A.pflicht(d, 'valuation.valuationDateComments', {}); })());
const dir = ev.liteZuDirekt({ property: { type: 'commercialProperty', description: 'Büro / Bank / Praxis', constructionYear: 1984, address: { streetName: 'A', streetNumber: '1', postalCode: '10115', city: 'Berlin', country: 'DE' } },
  modernizations: { roof: 'none' }, renovation: { hasRenovations: 'no' }, requester: { title: 'company', companyName: 'X', firstName: 'a', lastName: 'b', email: 'e@example.com', phoneNumber: '1', acceptPrivacy: true, leadSource: 'other', address: { city: 'Berlin' } } }, 'k1');
pruefe('Direktweg: Rumpf nach Direct-API (Adresse flach, requestDetails, Gewerbe-Schlüssel, ohne Formular-Zusätze)', dir.idempotencyKey === 'k1' && dir.property.streetName === 'A' && !dir.property.address
  && dir.property.description === 'officeBankPractice' && dir.requestDetails.constructionYear === 1984 && dir.requestDetails.modernizations.roof === 'none'
  && dir.requester.leadSource === undefined && dir.requester.acceptPrivacy === undefined && dir.requester.address.city === 'Berlin', JSON.stringify(dir));
pruefe('Direktweg: Fehlerpfade zurück ins Formular', ev.pfadVonDirekt('requestDetails.constructionYear') === 'property.constructionYear' && ev.pfadVonDirekt('property.postalCode') === 'property.address.postalCode'
  && ev.pfadVonDirekt('requestDetails.modernizations.roof') === 'modernizations.roof' && ev.pfadVonDirekt('requester.email') === 'requester.email');
pruefe('Direktweg: alle zwölf Gewerbe-Beschreibungen haben einen Schlüssel', Object.keys(ev.GEWERBE_SCHLUESSEL).length === 12);
process.env.EVALION_LITE_WEG = 'formular'; const wegF = ev.liteWegDirekt(); delete process.env.EVALION_LITE_WEG;
pruefe('Direktweg ist Standard, EVALION_LITE_WEG=formular schaltet zurück', ev.liteWegDirekt() === true && wegF === false);
pruefe('Route: Ersteinschätzung über den Direktweg, Datenschutz verlangt', /liteWegDirekt\(\)\) return liteDirekt/.test(route) && /acceptPrivacy !== true/.test(route));
const ui = fs.readFileSync(path.join(WURZEL, 'frontend/js/gutachterpartner.js'), 'utf8');
/* v3580 · Reiter wie der RND-Rechner (rnd-wizard.js): dieselben Klassen */
const wiz = fs.readFileSync(path.join(WURZEL, 'frontend/js/rnd-wizard.js'), 'utf8');
const BAUSTEINE = ['rnd-wiz-overlay rnd-hub', 'rnd-wiz-modal', 'rnd-wiz-header', 'rnd-wiz-close', 'rnd-wiz-steps rnd-hub-schritte', 'rnd-hub-balken', 'rnd-wiz-progress-bar',
  'rnd-wiz-body', 'rnd-wiz-footer rnd-hub-nav', 'rnd-wiz-btn rnd-wiz-btn-sec rnd-hub-zurueck', 'rnd-wiz-counter', 'rnd-wiz-btn rnd-wiz-btn-pri rnd-hub-weiter', 'rnd-hub-nr', 'rnd-hub-kurz'];
const fehltBau = BAUSTEINE.filter((k) => !(wiz.includes(k) && ui.includes(k)));
pruefe('UI: Fenster aus den Bausteinen des RND-Rechners (' + BAUSTEINE.length + ' Klassen in beiden Dateien)', fehltBau.length === 0, fehltBau.join(', '));
pruefe('UI: Karten und Felder wie im RND-Rechner (rnd-hub-karte, rnd-hub-h, rnd-wiz-field, rnd-hub-chip)', ['rnd-hub-karte', 'rnd-hub-h', 'rnd-wiz-grid rnd-hub-felder', 'rnd-wiz-field', 'rnd-hub-chip'].every((k) => ui.includes(k)));
const reiterBlock = ui.slice(ui.indexOf('var REITER = {'), ui.indexOf('function reiterBauen'));
for (const art of ['lite', 'voll']) {
  const d = JSON.parse(fs.readFileSync(path.join(WURZEL, 'tools/evalion-beispiele/live-definition-' + art + '.json'), 'utf8')).data;
  const teil = reiterBlock.slice(reiterBlock.indexOf(art + ': ['), art === 'lite' ? reiterBlock.indexOf('voll: [') : undefined);
  const ohne = A.felder(d).map((g) => g.id).filter((g) => !teil.includes("'" + g + "'"));
  const n = (teil.match(/kurz:/g) || []).length;
  pruefe(art + ': jede Gruppe der Live-Definition hat ihren Reiter (' + n + ' Reiter)', ohne.length === 0 && n >= 3, ohne.join(' '));
}
pruefe('UI: offene Pflichtangaben je Reiter gezählt', /offeneJeReiter/.test(ui) && /data-offen/.test(ui));
pruefe('UI: unsere AfA = 100 ÷ RND ist die Hauptzahl, die des Partners nur als Information',
  ui.includes('function unsereAfa(rnd) { var n = Math.round(Number(rnd)); return n > 0 ? 100 / n : null; }') && ui.includes("' nennt ' + zahl(partner, 2)"));
const afaE = fs.readFileSync(path.join(WURZEL, 'frontend/js/afa-eigen.js'), 'utf8');
pruefe('Übernahme setzt 100 ÷ RND (afa-eigen.js setzen)', afaE.includes("el('afa_eigen').value = fmt(100 / n, 2)") && ui.includes('DpAfaEigen.setzen(n,'));
pruefe('Marke gutachten.org nach außen, kein Firmenname im UI', ui.includes("var MARKE = 'gutachten.org'") && !/evalion/i.test(ui) && A.neutral('Evalion') === 'gutachten.org' && ev.neutral('Evalion') === 'gutachten.org');
const logoDatei = path.join(WURZEL, 'frontend/img/partner/gutachten-org.svg');
const logoText = fs.existsSync(logoDatei) ? fs.readFileSync(logoDatei, 'utf8') : '';
pruefe('Logo: offizielles SVG abgelegt, Quelle im Code vermerkt, ohne Skript', /^<svg/.test(logoText) && !/<script|onload=/i.test(logoText) && ui.includes('gutachten.org/brand/logo/gutachten-org-ink.svg'));
pruefe('Kosten: Ersteinschätzung kostenlos, Gutachten „stellt gutachten.org gesondert in Rechnung“, kein Betrag', ui.includes('kostenlos') && ui.includes('gesondert in Rechnung') && !/\d\s*(€|EUR|Euro)\b/.test(ui));
pruefe('Freigabe: jedes angemeldete Konto (Zusatz nur zum Sperren)', route.includes('return !(z && z.aktiv === false)'));
pruefe('Abgleich: Eingaben (ohne Person) und Kern zum selben Zeitpunkt gespeichert, Kern über rndAusObjekt',
  route.includes('kernMessen(req.user.id, objekt)') && route.includes('kerne.rndAusObjekt(') && route.includes('kerne.rnd(eingabe)') && route.includes('delete d.requester') && route.includes('ergebnis, eingaben, kern)'));
const mig109 = path.join(WURZEL, 'backend/migrations/109_gutachter_abgleich.sql');
pruefe('Migration 109 (eingaben, kern)', fs.existsSync(mig109) && fs.readFileSync(mig109, 'utf8').includes('ADD COLUMN IF NOT EXISTS kern JSONB'));
pruefe('UI: Optionen nur über optionText, Nachladen 3 × 5 s', /optionText\(p, o\)/.test(ui) && /versuch < 3/.test(ui) && /5000/.test(ui));

const AB = await import('./rnd-partner-abgleich.mjs');
const abRoh = [
  { nr: 'T1', umgebung: 'test', ergebnis: { finalAverageRUL: 16, annualDepreciation: 7 }, eingaben: { property: { constructionYear: 1978 } }, kern: { final_rnd: 32, verfahren: 'punktraster', eingabe: { modPoints: 0 } } },
  { nr: 'T2', umgebung: 'test', ergebnis: { finalAverageRUL: 10 }, eingaben: { property: { constructionYear: 1965 } }, kern: { fehlt: 'kein DealPilot-Objekt' } },
  { nr: 'T3', umgebung: 'produktion', ergebnis: { finalAverageRUL: 40 }, eingaben: { property: { constructionYear: 1995 } }, kern: { final_rnd: 38, eingabe: { modPoints: 8 } } }
];
const abF = AB.faelleBauen(abRoh), abA = AB.auswerten(abF);
pruefe('Abgleich-Werkzeug: Abweichung Kern − Partner je Fall, ohne Kernwert ausgewiesen', abF[0].diff === 16 && abF[1].diff === null && abF[1].kernFehlt && abF[2].diff === -2);
pruefe('Abgleich-Werkzeug: Mittel/Median/Gruppen nach Baujahr und Modernisierungsgrad', abA.nMitKern === 2 && abA.mittel === 7 && abA.median === 7
  && abA.nachBaujahr.some((g) => g.gruppe === '1970–1989') && abA.nachModernisierung.some((g) => /^mittlerer/.test(g.gruppe)) && abA.groesste[0].nr === 'T1');
pruefe('Abgleich-Werkzeug: nur Vorschläge, liest nur (kein UPDATE/INSERT, keine Änderung am Kern)', AB.vorschlaege(abA).length >= 1
  && !/\b(UPDATE|INSERT|DELETE)\b/.test(fs.readFileSync(path.join(WURZEL, 'tools/rnd-partner-abgleich.mjs'), 'utf8').replace(/\/\*[\s\S]*?\*\//, '')) && !/writeFileSync/.test(fs.readFileSync(path.join(WURZEL, 'tools/rnd-partner-abgleich.mjs'), 'utf8')));

/* ── D Live gegen die TEST-Umgebung ─────────────────────────────────── */
if (arg('live')) {
  console.log('D  Live (nur Testumgebung)');
  const envDatei = arg('env');
  if (envDatei && envDatei !== true) {
    for (const z of fs.readFileSync(path.resolve(envDatei), 'utf8').split(/\r?\n/)) {
      const m = z.match(/^\s*(EVALION_[A-Z_]+)\s*=\s*(.*?)\s*$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } else Object.keys(ENV_ALT).forEach((k) => { if (ENV_ALT[k]) process.env[k] = ENV_ALT[k]; });
  const k = ev.konfig();
  if (!k) { console.log('  ROT  keine Zugangsdaten (EVALION_BASE_URL/KEY_ID/SECRET)'); process.exit(1); }
  if (k.umgebung !== 'test' || !/staging/.test(k.host)) { console.log('  ROT  ABBRUCH: kein Test-Host (' + k.host + ') — live nur gegen die Testumgebung'); process.exit(2); }
  const ids = [];
  const def = await ev.api.formular(ev.FORMULARE.lite);
  pruefe('Formular lite abrufen (200)', def.ok && def.body && def.body.data && def.body.data.ui, def.status + ' ' + JSON.stringify(def.body).slice(0, 160) + (def.zeitabweichung_s != null ? ' Zeitabweichung ' + def.zeitabweichung_s + ' s' : ''));
  const defV = await ev.api.formular(ev.FORMULARE.voll);
  pruefe('Formular voll abrufen (200)', defV.ok && defV.body && defV.body.data && defV.body.data.ui, defV.status + ' ' + JSON.stringify(defV.body).slice(0, 160));
  if (def.ok) {
    const ablage = arg('ablage');
    if (ablage && ablage !== true) { fs.writeFileSync(path.join(ablage, 'def-lite.json'), JSON.stringify(def.body, null, 1)); if (defV.ok) fs.writeFileSync(path.join(ablage, 'def-voll.json'), JSON.stringify(defV.body, null, 1)); }
    const d = def.body.data;
    const faelle = [
      { objart: 'MFH', str: 'Ravensberger Weg', hnr: '38', plz: '33602', ort: 'Bielefeld', baujahr: '1965', mod: { dach: '10 - 20 Jahre', fenster: '5 - 10 Jahre', heizung: '< 5 Jahre', aussenwand: 'Keine/Nie', baeder: '10 - 20 Jahre', innenausbau: '> 20 Jahre', leitungen: '> 20 Jahre', grundriss: 'Keine/Nie' } },
      { objart: 'MFH', str: 'Bismarckstr.', hnr: '27', plz: '32756', ort: 'Detmold', baujahr: '1928', mod: { dach: '5 - 10 Jahre', fenster: '10 - 20 Jahre', heizung: '5 - 10 Jahre', aussenwand: 'Keine/Nie', baeder: '> 20 Jahre', innenausbau: 'Keine/Nie', leitungen: '10 - 20 Jahre', grundriss: 'Keine/Nie' } },
      { objart: 'ETW', str: 'Ravensberger Weg', hnr: '38', plz: '33602', ort: 'Bielefeld', baujahr: '1965', wfl: '68', mod: { dach: '10 - 20 Jahre', fenster: '< 5 Jahre', heizung: '< 5 Jahre', aussenwand: 'Keine/Nie', baeder: '< 5 Jahre', innenausbau: '5 - 10 Jahre', leitungen: '> 20 Jahre', grundriss: 'Keine/Nie' } }
    ];
    const anfrager = { vorname: 'DealPilot', nachname: 'Test', email: 'dealpilot-test@example.com', telefon: '+491700000000', firma: 'DealPilot Test',
      str: 'Ravensberger Weg', hnr: '38', plz: '33602', ort: 'Bielefeld' };
    /* Pflichtfelder, die DealPilot nicht kennt, fuer den Test aus den Optionen der Definition */
    const ergaenzen = (def0, data) => {
      A.felder(def0).forEach((g) => g.fields.forEach((f) => {
        const p = A.feldPfad(f);
        if (f.inputType === 'file' || A.holen(data, p) !== undefined || !A.sichtbar(f, data)) return;
        const o = A.optionen(f, def0.schema);
        if (/^requester\.title$/.test(p)) A.setzen(data, p, (o.find((x) => x.value === 'company') || o[0] || {}).value);
        else if (/acceptPrivacy|acceptTerms/.test(p)) A.setzen(data, p, true);
        else if (/leadSource$/.test(p) && o.length) A.setzen(data, p, (o.find((x) => x.value === 'other') || o[0]).value);
        else if (/leadSourceDetails$/.test(p)) A.setzen(data, p, 'DealPilot Schnittstellentest');
        else if (/renovation\.hasRenovations$/.test(p)) A.setzen(data, p, 'no');
        else if (/scopeOfChanges$/.test(p) && o.length) A.setzen(data, p, o[0].value);
        else if (/(^|\.)country$/.test(p)) A.setzen(data, p, 'DE');
        else if (/(^|\.)(postalCode)$/.test(p)) A.setzen(data, p, '33602');
        else if (/(^|\.)(streetNumber)$/.test(p)) A.setzen(data, p, '38');
        else if (/companyName$/.test(p)) A.setzen(data, p, 'DealPilot Test');
      }));
      return data;
    };
    /* v3570: Standard 1 Anfrage (Testumgebung schonen), ueber den Direktweg wie die App; --formularweg = Form-API */
    const n = Math.max(1, Math.min(3, parseInt(arg('anzahl'), 10) || 1));
    for (let i = 0; i < n && !arg('formularweg'); i++) {
      const fall = faelle[i % faelle.length];
      const data = ergaenzen(d, A.vorbelegen(d, fall, anfrager));
      A.setzen(data, 'requester.acceptPrivacy', true);
      const t0 = Date.now();
      const r = await ev.api.direkt(ev.liteZuDirekt(data, ev.idemSchluessel('dp-pruef-lite')));
      const dd = (r.body && r.body.data) || {}, res = dd.result;
      pruefe('Lite ' + (i + 1) + ' (Direktweg): 201 mit Ergebnis sofort', r.status === 201 && res && res.finalAverageRUL > 0, r.status + ' ' + JSON.stringify(r.body).slice(0, 400));
      ids.push({ art: 'lite direkt', fall: fall.objart + ' ' + fall.str + ' ' + fall.hnr + ', ' + fall.ort + ', Bj ' + fall.baujahr, requestId: dd.evalionRequestId, nummer: dd.evalionRequestNumber,
        status: 'Ergebnis nach ' + (Date.now() - t0) + ' ms', rnd: res && res.finalAverageRUL, afa: res && res.annualDepreciation, spanne: res && res.finalRangeRUL });
    }
    for (let i = 0; i < n && arg('formularweg'); i++) {
      const fall = faelle[i % faelle.length];
      let data = A.vorbelegen(d, fall, anfrager);
      /* Lite: Adresse und Personendaten vollstaendig (das Doku-Beispiel ist gekuerzt) */
      A.setzen(data, 'property.address', Object.assign({ streetName: fall.str, streetNumber: fall.hnr, postalCode: fall.plz, city: fall.ort, country: 'DE' }, A.holen(data, 'property.address') || {}));
      data = ergaenzen(d, data);
      const c = await ev.api.anlegen(ev.FORMULARE.lite, data, ev.idemSchluessel('dp-pruef-lite'));
      pruefe('Lite ' + (i + 1) + ': Entwurf angelegen (201, draft, ETag)', c.status === 201 && c.body.data.status === 'draft' && !!c.etag, c.status + ' ' + JSON.stringify(c.body).slice(0, 300));
      if (!c.ok) continue;
      const rid = c.body.data.requestId;
      const s = await ev.api.absenden(rid, c.etag, ev.idemSchluessel('dp-pruef-absenden'));
      const res = s.body && s.body.data && s.body.data.result;
      pruefe('Lite ' + (i + 1) + ': absenden (200) mit Ergebnis', s.ok && res && res.finalAverageRUL > 0, s.status + ' ' + JSON.stringify(s.body).slice(0, 400));
      ids.push({ art: 'lite', fall: fall.objart + ' ' + fall.str + ' ' + fall.hnr + ', ' + fall.ort + ', Bj ' + fall.baujahr, requestId: rid, nummer: c.body.data.requestNumber,
        status: s.body && s.body.data && s.body.data.status, rnd: res && res.finalAverageRUL, afa: res && res.annualDepreciation, spanne: res && res.finalRangeRUL });
      const l = await ev.api.lesen(rid);
      pruefe('Lite ' + (i + 1) + ': Stand lesen (200)', l.ok && l.body.data.requestId === rid, l.status);
    }
    if (defV.ok && arg('voll-entwurf')) {
      const dv = defV.body.data;
      let data = ergaenzen(dv, A.vorbelegen(dv, faelle[0], anfrager));
      const c = await ev.api.anlegen(ev.FORMULARE.voll, data, ev.idemSchluessel('dp-pruef-voll'));
      pruefe('Voll: Entwurf angelegt (201, draft)', c.status === 201 && c.body.data.status === 'draft', c.status + ' ' + JSON.stringify(c.body).slice(0, 400));
      if (c.ok) {
        const e = { art: 'voll (Entwurf)', fall: 'MFH Ravensberger Weg 38, Bielefeld, Bj 1965', requestId: c.body.data.requestId, nummer: c.body.data.requestNumber, status: c.body.data.status };
        const p = await ev.api.aendern(e.requestId, { property: { description: 'DealPilot Schnittstellentest' } }, c.etag);
        pruefe('Voll: Merge Patch mit If-Match', p.ok || p.status === 400, p.status + ' ' + JSON.stringify(p.body).slice(0, 300));
        if (arg('voll-absenden')) {
          const l = await ev.api.lesen(e.requestId);
          const s = await ev.api.absenden(e.requestId, l.etag, ev.idemSchluessel('dp-pruef-voll-absenden'));
          pruefe('Voll: absenden', s.ok, s.status + ' ' + JSON.stringify(s.body).slice(0, 400));
          e.status = s.body && s.body.data && s.body.data.status; e.art = 'voll (abgesendet)';
          if (!s.ok) e.fehler = JSON.stringify(s.body).slice(0, 400);
        }
        ids.push(e);
      }
    }
  }
  console.log('\nAnfragen an die Testumgebung:');
  ids.forEach((x) => console.log('  ' + x.art + ' · ' + x.fall + ' · ' + x.requestId + ' · ' + (x.nummer || '') + ' · ' + (x.status || '') + (x.rnd ? ' · RND ' + x.rnd + ' J · AfA ' + x.afa + ' %' + (x.spanne ? ' · Spanne ' + x.spanne : '') : '')));
}

console.log('\n' + (punkte - fehler) + ' von ' + punkte + ' Punkten grün' + (fehler ? ', ' + fehler + ' ROT' : ''));
process.exit(fehler ? 1 : 0);
