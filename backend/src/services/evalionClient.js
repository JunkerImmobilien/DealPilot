'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   services/evalionClient.js — v3540
   CLIENT DER „PARTNER FORM API“ DES GUTACHTERPARTNERS (Evalion)

   Marcel, 16.11.2026: Restnutzungsdauer-Gutachten aus DealPilot heraus anfragen.
   Nach AUSSEN heisst der Anbieter seit v3580 „gutachten.org“ (Marke; Marcel 16.11.2026, vorher (CLAUDE.md,
   Anbieter-Neutralitaet) — der Name steht nur hier im Code und im Admin.

   Vertrag: OpenAPI „Evalion Partner Form API“ 0.1.0-contract-preview,
   app.evalion.net/docs/api/partners/forms/openapi.yaml (gelesen 16.11.2026).

   SIGNATUR (gemessen, nicht geraten):
     X-Evalion-Key-Id          ausgegebene Schluessel-Kennung
     X-Evalion-Timestamp       Unix-Sekunden (hoechstens 5 Minuten Abweichung, sonst 401)
     X-Evalion-Content-SHA256  SHA-256 hex klein der EXAKTEN Rohbytes des Rumpfs
                               (leerer Rumpf -> SHA-256 von '' fuer GET/DELETE/Submit)
     X-Evalion-Signature       base64(HMAC_SHA256(secret, kanonisch))
   kanonisch = METHODE \n PFAD \n ZEITSTEMPEL \n INHALTS-SHA256 — '\n', kein Zeilenende am Schluss.
   Die Zeilenfolge steht woertlich in der Schwester-Spezifikation (Direct RUL IA API,
   …/remaining-useful-life/initial-assessment-requests/openapi.yaml); die Form-API verweist
   auf „the documented canonical string“ mit denselben vier Kopfzeilen.

   Zugangsdaten NUR aus der Umgebung (EVALION_BASE_URL, EVALION_KEY_ID, EVALION_SECRET),
   nie im Code, nie im Log. Ohne sie: konfig() === null, die Routen melden „nicht eingerichtet“.
   Das Secret verlaesst den Server nie (Hinweis des Anbieters).
   ═══════════════════════════════════════════════════════════════════════ */
const crypto = require('crypto');

const LEER_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const FORMULARE = { lite: 'remaining-useful-life-lite', voll: 'remaining-useful-life' };
const ZEITLIMIT_MS = 30000;

function konfig() {
  const base = String(process.env.EVALION_BASE_URL || '').trim().replace(/\/+$/, '');
  const keyId = String(process.env.EVALION_KEY_ID || '').trim();
  const secret = String(process.env.EVALION_SECRET || '');
  if (!base || !keyId || !secret) return null;
  let u;
  try { u = new URL(/^https?:\/\//i.test(base) ? base : 'https://' + base); } catch (e) { return null; }
  if (u.protocol !== 'https:') return null;
  /* Umgebung aus dem Hostnamen: partner-api-staging.… = Test, partner-api.… = Produktion */
  const umgebung = /staging|test|sandbox/i.test(u.hostname) ? 'test' : 'produktion';
  return { base: u.origin + u.pathname.replace(/\/+$/, ''), host: u.hostname, keyId, secret, umgebung };
}

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf && buf.length ? buf : Buffer.alloc(0)).digest('hex');
}
function kanonisch(methode, pfad, zeitstempel, inhaltSha) {
  return [String(methode).toUpperCase(), pfad, String(zeitstempel), inhaltSha].join('\n');
}
function signieren(secret, kanon) {
  return crypto.createHmac('sha256', Buffer.from(String(secret), 'utf8')).update(kanon, 'utf8').digest('base64');
}
/** Kopfzeilen fuer einen Aufruf — rein, ohne Netz (Pruefer und Client nutzen dieselbe Stelle). */
function signaturKoepfe(k, methode, pfad, rumpf, zeitstempel) {
  const ts = zeitstempel != null ? String(zeitstempel) : String(Math.floor(Date.now() / 1000));
  const sha = sha256Hex(rumpf);
  return {
    'X-Evalion-Key-Id': k.keyId,
    'X-Evalion-Timestamp': ts,
    'X-Evalion-Content-SHA256': sha,
    'X-Evalion-Signature': signieren(k.secret, kanonisch(methode, pfad, ts, sha))
  };
}

/** multipart/form-data als EXAKTE Bytes (die Signatur haengt am Rumpf, nicht an einem Stream). */
function multipart(felder, datei) {
  const grenze = '----dealpilot' + crypto.randomBytes(12).toString('hex');
  const teile = [];
  Object.keys(felder || {}).forEach((n) => {
    if (felder[n] == null || felder[n] === '') return;
    teile.push(Buffer.from('--' + grenze + '\r\nContent-Disposition: form-data; name="' + n + '"\r\n\r\n' + String(felder[n]) + '\r\n', 'utf8'));
  });
  const name = String(datei.name || 'datei.pdf');
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  teile.push(Buffer.from('--' + grenze + '\r\nContent-Disposition: form-data; name="file"; filename="' + ascii + '"; filename*=UTF-8\'\'' + encodeURIComponent(name)
    + '\r\nContent-Type: ' + (datei.mime || 'application/octet-stream') + '\r\n\r\n', 'utf8'));
  teile.push(datei.puffer);
  teile.push(Buffer.from('\r\n--' + grenze + '--\r\n', 'utf8'));
  return { rumpf: Buffer.concat(teile), typ: 'multipart/form-data; boundary=' + grenze };
}

/** Idempotency-Key nach Vertrag: ^[A-Za-z0-9._:-]+$, 1–120 Zeichen. */
function idemSchluessel(praefix) {
  return (String(praefix || 'dp').replace(/[^A-Za-z0-9._:-]/g, '') + '-' + crypto.randomUUID()).slice(0, 120);
}

/* Den Anbieternamen aus Texten nehmen, die bis zum Kunden durchgereicht werden. */
function neutral(t) {
  return t == null ? t : String(t).replace(/evalion/gi, 'gutachten.org');   /* v3580: Marke nach aussen */
}

/**
 * Ein signierter Aufruf. Wirft nie; Ergebnis { ok, status, etag, body, ms, fehler? }.
 * opts: { json, mergePatch, multipart:{felder,datei}, ifMatch, ifNoneMatch, idempotencyKey }
 */
async function aufruf(methode, pfad, opts) {
  opts = opts || {};
  const k = konfig();
  if (!k) return { ok: false, status: 503, body: { code: 'nicht_konfiguriert', message: 'gutachten.org nicht konfiguriert' }, ms: 0 };
  const url = k.base + pfad;
  const signPfad = new URL(url).pathname;   /* der Pfad, den der Server sieht (inkl. eventuellem Basis-Pfad) */
  let rumpf = Buffer.alloc(0), typ = null;
  if (opts.json !== undefined) { rumpf = Buffer.from(JSON.stringify(opts.json), 'utf8'); typ = 'application/json'; }
  else if (opts.mergePatch !== undefined) { rumpf = Buffer.from(JSON.stringify(opts.mergePatch), 'utf8'); typ = 'application/merge-patch+json'; }
  else if (opts.multipart) { const m = multipart(opts.multipart.felder, opts.multipart.datei); rumpf = m.rumpf; typ = m.typ; }
  const kopf = Object.assign({ Accept: 'application/json', 'Accept-Language': 'de' }, signaturKoepfe(k, methode, signPfad, rumpf));
  if (typ) kopf['Content-Type'] = typ;
  if (opts.ifMatch) kopf['If-Match'] = opts.ifMatch;
  if (opts.ifNoneMatch) kopf['If-None-Match'] = opts.ifNoneMatch;
  if (opts.idempotencyKey) kopf['Idempotency-Key'] = opts.idempotencyKey;
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.zeitlimit || ZEITLIMIT_MS);
  try {
    const res = await fetch(url, { method: methode, headers: kopf, body: rumpf.length ? rumpf : undefined, signal: ctrl.signal });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) { body = { status: 'error', code: 'keine_json_antwort', message: text.slice(0, 300) }; }
    const ms = Date.now() - t0;
    const r = { ok: res.ok || res.status === 304, status: res.status, etag: res.headers.get('etag') || null, body, ms };
    if (res.status === 401) {
      /* Hinweis des Anbieters: Zeitstempel hoechstens 5 Minuten neben der Serverzeit. Die Abweichung
         laesst sich am Date-Kopf der Antwort messen. */
      const d = Date.parse(res.headers.get('date') || '');
      r.zeitabweichung_s = isFinite(d) ? Math.round((t0 - d) / 1000) : null;
    }
    return r;
  } catch (e) {
    return { ok: false, status: 0, body: { code: e.name === 'AbortError' ? 'zeitueberschreitung' : 'netzfehler', message: e.name === 'AbortError' ? 'gutachten.org hat nicht rechtzeitig geantwortet.' : 'gutachten.org nicht erreichbar.' }, ms: Date.now() - t0 };
  } finally { clearTimeout(timer); }
}

/** Fehler des Partners in DealPilot-Form, feldgenau und ohne Anbieternamen. */
function fehlerText(r) {
  const b = (r && r.body) || {};
  const felder = Array.isArray(b.errors) ? b.errors.map((e) => ({ path: String(e.path || ''), message: neutral(e.message || '') })) : [];
  let text = neutral(b.message || 'Fehler bei gutachten.org').replace(/\b401\b/g, '');
  if (r && r.status === 401) {
    /* v3542 · KEINE Zahl 401 im Text: frontend/js/auth-401-handler.js erkennt „401“ in der MELDUNG als
       abgelaufene DealPilot-Sitzung, loescht den Token und wartet auf Re-Login (gemessen 16.11.2026 im
       Headless-Chrome: Auth.apiCall hing, danach war der Nutzer abgemeldet). Der Status geht als anbieter_status mit. */
    text = 'Anmeldung bei gutachten.org abgelehnt. Häufigste Ursachen: Serverzeit weicht mehr als 5 Minuten ab'
      + (r.zeitabweichung_s != null ? ' (gemessen: ' + r.zeitabweichung_s + ' s)' : '') + ', oder Schlüssel-Kennung/Secret passen nicht zur Umgebung.';
  }
  if (r && r.status === 409 && b.code === 'concurrency_conflict') text = 'Die Anfrage wurde inzwischen geändert. Bitte erneut versuchen.';
  return { error: text, code: b.code || null, felder, anbieter_status: r ? r.status : null, anbieter_request: b.requestId || null };
}

/* ── v3570 · Ersteinschaetzung ueber die Direct-RUL-IA-API ────────────────
   Gemessen 16.11.2026 an der Testumgebung: die Form-API nimmt die Lite-Anfrage an (submit 200,
   status initialAssessment, customerStatus initialAssessmentAvailable, allowedActions viewResult),
   liefert aber das Feld `result` WEDER im Submit NOCH im GET (4 Abrufe ueber 22 s, 26DP04052) —
   einen eigenen Ergebnis-Endpunkt gibt es nicht (…/result, …/results, …/initial-assessment: 401 der
   Nutzer-Anmeldung, also keine Partner-Route). Die Schwester-API
   POST /api/v1/remaining-useful-life/initial-assessment-requests liefert das Ergebnis SOFORT
   (201 nach 4,1 s, 26DP04053: finalAverageRUL, annualDepreciation, finalRangeRUL, …), und die Form-API
   liest diese Anfrage danach unter derselben Kennung. Deshalb geht die Ersteinschaetzung (nur sie) diesen
   Weg; das Formular kommt weiter aus der Form-API. EVALION_LITE_WEG=formular schaltet zurueck. */
const GEWERBE_SCHLUESSEL = { 'Büro / Bank / Praxis': 'officeBankPractice', 'Laden / Geschäftshaus': 'retailStoreCommercialBuilding',
  'Hotel / Gastronomie / Pension': 'hotelRestaurantGuesthouse', 'Lager / Produktion / Werkstatt': 'warehouseProductionWorkshop',
  'Supermarkt / Autohaus': 'supermarketCarDealership', 'Parkhaus / Tiefgarage': 'parkingGarageUndergroundGarage',
  'Schule / Kita / Pflegeheim': 'schoolDaycareNursingHome', 'Krankenhaus / Klinik': 'hospitalClinic',
  'Sporthalle / Freizeitbad / Heilbad': 'sportsHallLeisurePoolSpa', 'Gemeindezentrum / Saalbau / Veranstaltungsgebäude': 'communityCenterHallEventBuilding',
  'Landwirtschaft': 'agriculture', 'Sonstiges': 'other' };
function liteWegDirekt() { return String(process.env.EVALION_LITE_WEG || 'direkt').trim().toLowerCase() !== 'formular'; }
/** Daten des Lite-Formulars (Form-API-Form) -> Rumpf der Direct-RUL-IA-API */
function liteZuDirekt(data, idem) {
  const d = data || {}, r = d.requester || {}, p = d.property || {}, a = p.address || {};
  const rq = {};
  ['title', 'firstName', 'lastName', 'companyName', 'email', 'phoneNumber'].forEach((k) => { if (r[k] != null && r[k] !== '') rq[k] = r[k]; });
  if (r.address) rq.address = r.address;
  const pr = { type: p.type };
  if (p.description != null && p.description !== '') pr.description = (p.type === 'commercialProperty' || p.type === 'other') ? (GEWERBE_SCHLUESSEL[p.description] || p.description) : p.description;
  ['streetName', 'streetNumber', 'postalCode', 'city', 'country', 'latitude', 'longitude'].forEach((k) => { if (a[k] != null && a[k] !== '') pr[k] = a[k]; });
  const det = { constructionYear: p.constructionYear };
  if (d.modernizations) det.modernizations = d.modernizations;
  if (d.renovation) det.renovation = d.renovation;
  return { idempotencyKey: idem, requester: rq, property: pr, requestDetails: det };
}
/** Fehlerpfad der Direct-API -> Pfad im Lite-Formular */
function pfadVonDirekt(p) {
  p = String(p || '');
  if (p === 'requestDetails.constructionYear') return 'property.constructionYear';
  let m = p.match(/^requestDetails\.(modernizations|renovation)(\..*)?$/); if (m) return m[1] + (m[2] || '');
  m = p.match(/^property\.(streetName|streetNumber|postalCode|city|country|latitude|longitude)$/); if (m) return 'property.address.' + m[1];
  return p;
}

/* ── die Aufrufe des Vertrags ─────────────────────────────────────────── */
const P = '/api/v1/partner';
const enc = encodeURIComponent;
const api = {
  formular: (formType, ifNoneMatch) => aufruf('GET', P + '/forms/' + enc(formType), { ifNoneMatch }),
  anlegen: (formType, data, idem, version) => aufruf('POST', P + '/requests',
    { json: { form: Object.assign({ type: formType }, version ? { version } : {}), data: data || {} }, idempotencyKey: idem }),
  lesen: (id) => aufruf('GET', P + '/requests/' + enc(id)),
  aendern: (id, data, etag) => aufruf('PATCH', P + '/requests/' + enc(id), { mergePatch: { data: data || {} }, ifMatch: etag }),
  dateiHochladen: (id, etag, felder, datei, idem) => aufruf('POST', P + '/requests/' + enc(id) + '/files',
    { multipart: { felder, datei }, ifMatch: etag, idempotencyKey: idem }),
  dateiLoeschen: (id, fileId, etag) => aufruf('DELETE', P + '/requests/' + enc(id) + '/files/' + enc(fileId), { ifMatch: etag }),
  absenden: (id, etag, idem) => aufruf('POST', P + '/requests/' + enc(id) + '/submit', { ifMatch: etag, idempotencyKey: idem }),
  direkt: (rumpf) => aufruf('POST', '/api/v1/remaining-useful-life/initial-assessment-requests', { json: rumpf })   /* v3570 */
};

module.exports = { konfig, FORMULARE, LEER_SHA256, sha256Hex, kanonisch, signieren, signaturKoepfe, multipart, idemSchluessel,
  neutral, fehlerText, aufruf, api, liteWegDirekt, liteZuDirekt, pfadVonDirekt, GEWERBE_SCHLUESSEL };
