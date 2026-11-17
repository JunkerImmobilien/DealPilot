'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   routes/gutachterpartner.js — v3540
   RESTNUTZUNGSDAUER BEIM UNABHAENGIGEN GUTACHTERPARTNER (Partner Form API)

   Marcel 16.11.2026. Zwei Wege aus dem Reiter Steuer (frontend/js/gutachterpartner.js):
     lite  = Ersteinschaetzung (remaining-useful-life-lite), Ergebnis beim Absenden sofort
     voll  = Gutachtenanfrage (remaining-useful-life), geht beim Partner in regulaere Bearbeitung

   GET    /gutachterpartner/status                  { freigeschaltet, konfiguriert, umgebung }
   GET    /gutachterpartner/formular/:art           Formulardefinition (lite|voll), 1 h im Speicher, ETag/304
   GET    /gutachterpartner/anfragen?objekt=<uuid>  Anfragen dieses Kontos (zum Objekt)
   POST   /gutachterpartner/anfragen                { art, objekt_id, data, absenden, kostenpflichtig_bestaetigt }
   GET    /gutachterpartner/anfragen/:rid           Stand beim Partner abrufen (Status, Ergebnis, Dateien)
   PATCH  /gutachterpartner/anfragen/:rid           { data }   JSON Merge Patch, If-Match aus der letzten Antwort
   POST   /gutachterpartner/anfragen/:rid/dateien   { datei_id, fieldId, documentCategory } | multipart „datei“
   DELETE /gutachterpartner/anfragen/:rid/dateien/:fileId
   POST   /gutachterpartner/anfragen/:rid/absenden  { kostenpflichtig_bestaetigt }

   Freigabe (v3580): jedes angemeldete Konto; Zusatz 'gutachterpartner' aktiv=false sperrt einzeln. Bis v3570:
   Preis und Freigabe entscheidet. Ohne EVALION_* in der Umgebung: 503 „nicht eingerichtet“.
   Jeder Aufruf beim Partner landet in gutachter_aufrufe (Aktion, Konto, Dauer, ok).
   Fehler des Partners kommen FELDGENAU zurueck ({ felder: [{path, message}] }), ohne Anbieternamen.
   ═══════════════════════════════════════════════════════════════════════ */
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { query } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const zusatzService = require('../services/zusatzService');
const ev = require('../services/evalionClient');
const vorschau = require('../services/vorschau');

const router = express.Router();
router.use(authenticate);
/* v3600 · Vorschau (Marcel 17.11.2026): bis zur Freigabe nur Admin und Freigabeliste - alle Routen 403,
   auch /status (die Knoepfe erscheinen dann nicht). Liste: services/vorschau-funktionen.json */
router.use(vorschau.sperre('gutachten_org'));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DATEI = 20 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DATEI, files: 1, fields: 10 } }).single('datei');

const bremse = rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => (req.user && req.user.id ? 'gp:' + req.user.id : req.ip),
  message: { error: 'Zu viele Anfragen an gutachten.org. Bitte kurz warten.' } });

/* v3580 · Marcel 16.11.2026: „Jeder darf anfragen.“ Jedes angemeldete Konto ist freigeschaltet;
   Protokoll und Zaehlung (gutachter_aufrufe) bleiben. Ein Zusatz 'gutachterpartner' mit aktiv=false
   sperrt ein einzelnes Konto weiterhin (Admin-Portal), ohne Zeile gilt: frei. */
async function freigeschaltet(user) {
  if (!user || !user.id) return false;
  if (user.role === 'admin') return true;
  try { const z = await zusatzService.holen(user.id, zusatzService.GUTACHTER); return !(z && z.aktiv === false); } catch (e) { return true; }
}

/* v3580 · Kern gegen Partner: die RND UNSERES Kerns zum selben Zeitpunkt (services/rechenkerne.js,
   rndAusObjekt = mapDealPilotObject, derselbe Weg wie POST /rechenkerne/rnd - kein zweiter Kern). */
async function kernMessen(userId, objektId) {
  if (!objektId) return { fehlt: 'kein DealPilot-Objekt' };
  try {
    const o = await query('SELECT data FROM objects WHERE id=$1 AND user_id=$2', [objektId, userId]);
    if (!o.rowCount) return { fehlt: 'Objekt nicht gefunden' };
    const kerne = require('../services/rechenkerne');
    const eingabe = kerne.rndAusObjekt(o.rows[0].data || {});
    const r = kerne.rnd(eingabe);
    const methoden = {};
    Object.keys(r.methods || {}).forEach((k) => { const m = r.methods[k] || {}; methoden[k] = m.restnutzungsdauer != null ? m.restnutzungsdauer : (m.rnd != null ? m.rnd : null); });
    return { final_rnd: r.final_rnd, verfahren: r.verfahren, quelle: r.final_source, methoden, eingabe: r.input || eingabe,
      version: (kerne.herkunft && kerne.herkunft().version) || null, gemessen_am: new Date().toISOString() };
  } catch (e) { return { fehlt: 'Kern nicht rechenbar: ' + e.message }; }
}
/* Die an den Partner gegebenen Objektangaben - ohne Personendaten (requester bleibt draussen). */
function eingabenOhnePerson(data) {
  const d = Object.assign({}, data || {}); delete d.requester; delete d.owner; delete d.agreement; return d;
}

async function protokoll(userId, aktion, r, requestId) {
  try {
    await query('INSERT INTO gutachter_aufrufe (user_id, aktion, ok, http_status, ms, request_id, code) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [userId || null, aktion, !!(r && r.ok), (r && r.status) || null, (r && r.ms) || null, requestId ? String(requestId).slice(0, 80) : null,
       r && !r.ok && r.body && r.body.code ? String(r.body.code).slice(0, 80) : null]);
  } catch (e) { /* ein Protokollfehler bricht den Aufruf nicht */ }
  try { console.log('[gutachterpartner] ' + aktion + ' ' + ((r && r.status) || '-') + ' ' + ((r && r.ms) || 0) + 'ms'); } catch (e) {}
}

function fehler(res, r, requestId) {
  const f = ev.fehlerText(r);
  if (requestId) f.request_id = requestId;   /* Entwurf besteht schon: der naechste Versuch aendert ihn, statt neu anzulegen */
  const st = r.status === 0 ? 502 : (r.status === 401 || r.status >= 500 ? 502 : r.status);
  return res.status(st).json(f);
}

/* Partner-Anfrage in DealPilot-Form (nur was die Oberflaeche braucht) */
function sicht(d, zeile) {
  d = d || {};
  return {
    request_id: d.requestId || (zeile && zeile.request_id) || null,
    request_number: d.requestNumber || (zeile && zeile.request_number) || null,
    formular: (d.form && d.form.type) || (zeile && zeile.formular) || null,
    form_version: (d.form && d.form.version) || null,
    status: d.status || (zeile && zeile.status) || null,
    allowed_actions: d.allowedActions || [],
    data: d.data || null,
    attachments: (d.attachments || []).map((a) => ({ fileId: a.fileId, filename: a.filename, fieldId: a.fieldId, uploadStatus: a.uploadStatus, sizeBytes: a.sizeBytes })),
    result: d.result || (zeile && zeile.ergebnis) || null,
    objekt_id: zeile ? zeile.objekt_id : null,
    umgebung: zeile ? zeile.umgebung : null,
    created_at: d.createdAt || (zeile && zeile.created_at) || null,
    updated_at: d.updatedAt || (zeile && zeile.updated_at) || null
  };
}

async function zeileHolen(userId, rid) {
  const r = await query('SELECT * FROM gutachter_anfragen WHERE user_id=$1 AND request_id=$2', [userId, rid]);
  return r.rows[0] || null;
}
async function zeileFortschreiben(rid, r) {
  const d = (r.body && r.body.data) || {};
  await query('UPDATE gutachter_anfragen SET status=COALESCE($2,status), etag=COALESCE($3,etag), request_number=COALESCE($4,request_number), '
    + 'ergebnis=COALESCE($5::jsonb,ergebnis), updated_at=NOW() WHERE request_id=$1',
    [rid, d.status || null, r.etag || null, d.requestNumber || null, d.result ? JSON.stringify(d.result) : null]);
}

/* Bei veraltetem ETag (409) einmal frisch lesen und wiederholen — der Nutzer hat nichts falsch gemacht. */
async function mitFrischemEtag(userId, zeile, aktion, fn) {
  let r = await fn(zeile.etag);
  await protokoll(userId, aktion, r, zeile.request_id);
  if (r.status === 409 && r.body && r.body.code === 'concurrency_conflict') {
    const l = await ev.api.lesen(zeile.request_id);
    await protokoll(userId, 'lesen', l, zeile.request_id);
    if (l.ok) { await zeileFortschreiben(zeile.request_id, l); r = await fn(l.etag); await protokoll(userId, aktion, r, zeile.request_id); }
  }
  if (r.ok) await zeileFortschreiben(zeile.request_id, r);
  return r;
}

/* Status: wer die Knoepfe sieht. Ohne Freigabe keine Auskunft ueber die Konfiguration. */
router.get('/status', async (req, res) => {
  const frei = await freigeschaltet(req.user);
  const k = frei ? ev.konfig() : null;
  const a = frei ? require('../services/gutachtenAuftrag').auftraggeber() : null;
  res.json({ freigeschaltet: frei, konfiguriert: !!(k && a), umgebung: k ? k.umgebung : null, beauftragt_ueber: a ? a.anzeige : null });
});

/* ab hier: freigeschaltet + konfiguriert */
router.use(async (req, res, next) => {
  if (!(await freigeschaltet(req.user))) {
    return res.status(403).json({ error: 'Die Anfrage bei gutachten.org ist für dieses Konto gesperrt.', code: 'nicht_freigeschaltet' });
  }
  if (!ev.konfig() || !require('../services/gutachtenAuftrag').auftraggeber()) {
    return res.status(503).json({ error: 'Die Anbindung an gutachten.org ist noch nicht eingerichtet.', code: 'nicht_konfiguriert' });
  }
  next();
});
router.use(bremse);

const _cache = {};   /* formType -> { zeit, etag, body } */
router.get('/formular/:art', async (req, res) => {
  const formType = ev.FORMULARE[req.params.art];
  if (!formType) return res.status(400).json({ error: 'Formular lite oder voll' });
  const c = _cache[formType];
  if (c && Date.now() - c.zeit < 3600 * 1000) return res.json(c.body);
  const r = await ev.api.formular(formType, c && c.etag);
  await protokoll(req.user.id, 'formular', r);
  if (r.status === 304 && c) { c.zeit = Date.now(); return res.json(c.body); }
  if (!r.ok) return fehler(res, r);
  _cache[formType] = { zeit: Date.now(), etag: r.etag, body: r.body };
  res.json(r.body);
});

router.get('/anfragen', async (req, res, next) => {
  try {
    const o = req.query.objekt && UUID.test(String(req.query.objekt)) ? String(req.query.objekt) : null;
    const r = await query('SELECT request_id, request_number, formular, umgebung, status, ergebnis, objekt_id, created_at, updated_at '
      + 'FROM gutachter_anfragen WHERE user_id=$1' + (o ? ' AND objekt_id=$2' : '') + ' ORDER BY created_at DESC LIMIT 50',
      o ? [req.user.id, o] : [req.user.id]);
    res.json({ anfragen: r.rows.map((z) => ({ request_id: z.request_id, request_number: z.request_number,
      art: z.formular === ev.FORMULARE.lite ? 'lite' : 'voll', umgebung: z.umgebung, status: z.status, result: z.ergebnis,
      objekt_id: z.objekt_id, created_at: z.created_at, updated_at: z.updated_at })) });
  } catch (e) { next(e); }
});

async function absenden(req, res, zeile) {
  const voll = zeile.formular === ev.FORMULARE.voll;
  const b = req.body || {};
  /* Die vollstaendige Anfrage wird beim Partner ein kostenpflichtiger Auftrag - nur mit Bestaetigung. */
  /* v3590 · das vollstaendige Gutachten wird nur ueber die Bestellung beauftragt (POST /auftraege: Preis, Kunde, Zustimmungen) */
  if (voll) return res.status(400).json({ error: 'Das Gutachten wird über die Bestellung beauftragt.', code: 'ueber_bestellung', request_id: zeile.request_id });
  if (voll && b.kostenpflichtig_bestaetigt !== true) {
    return res.status(400).json({ error: 'Bitte bestätigen, dass mit dem Absenden ein kostenpflichtiger Auftrag entsteht.', code: 'bestaetigung_fehlt', request_id: zeile.request_id });
  }
  if (voll) await query('UPDATE gutachter_anfragen SET kostenpflichtig_bestaetigt_at=NOW() WHERE request_id=$1', [zeile.request_id]);
  const r = await mitFrischemEtag(req.user.id, zeile, 'absenden', (etag) => ev.api.absenden(zeile.request_id, etag, zeile.idem_submit));
  if (!r.ok) return fehler(res, r, zeile.request_id);
  /* v3580 · auch auf dem Formularweg: Eingaben und Kern zum Zeitpunkt des Absendens */
  try {
    const dd = (r.body && r.body.data) || {};
    await query('UPDATE gutachter_anfragen SET eingaben=COALESCE(eingaben,$2::jsonb), kern=COALESCE(kern,$3::jsonb) WHERE request_id=$1',
      [zeile.request_id, JSON.stringify(eingabenOhnePerson(dd.data)), JSON.stringify(await kernMessen(req.user.id, zeile.objekt_id))]);
  } catch (e) { /* Abgleich bricht das Absenden nicht */ }
  const neu = await zeileHolen(req.user.id, zeile.request_id);
  return res.json({ anfrage: sicht(r.body && r.body.data, neu) });
}

/* v3570 · Ersteinschaetzung ueber die Direct-RUL-IA-API: Ergebnis sofort (siehe services/evalionClient.js).
   Die Datenschutz-Zustimmung des Lite-Formulars traegt die Direct-API nicht - sie wird hier verlangt. */
async function liteDirekt(req, res, objekt, data) {
  /* v3590 · Anfragender ist Junker Solution (mitAuftraggeber); die Zustimmungen gibt DealPilot fuer die Firma ab */
  const idem = ev.idemSchluessel('dp-lite');
  const r = await ev.api.direkt(ev.liteZuDirekt(data, idem));
  const d = (r.body && r.body.data) || {};
  await protokoll(req.user.id, 'direkt', r, d.evalionRequestId);
  if (!r.ok) {
    if (r.body && Array.isArray(r.body.errors)) r.body.errors = r.body.errors.map((e) => Object.assign({}, e, { path: ev.pfadVonDirekt(e.path) }));
    return fehler(res, r);
  }
  const k = ev.konfig();
  const ergebnis = Object.assign({}, d.result || {}, { weg: 'direkt', ms: r.ms });
  const kern = await kernMessen(req.user.id, objekt);   /* v3580 · Kern gegen Partner */
  await query('INSERT INTO gutachter_anfragen (user_id, objekt_id, formular, umgebung, request_id, request_number, status, etag, idem_submit, ergebnis, eingaben, kern) '
    + 'VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8,$9::jsonb,$10::jsonb,$11::jsonb) ON CONFLICT (request_id) DO NOTHING',
    [req.user.id, objekt, ev.FORMULARE.lite, k.umgebung, d.evalionRequestId, d.evalionRequestNumber || null,
     d.result ? 'initialAssessment' : 'received', idem, JSON.stringify(ergebnis), JSON.stringify(eingabenOhnePerson(data)), JSON.stringify(kern)]);
  const zeile = await zeileHolen(req.user.id, d.evalionRequestId);
  return res.status(201).json({ anfrage: Object.assign(sicht({ requestId: d.evalionRequestId, requestNumber: d.evalionRequestNumber,
    form: { type: ev.FORMULARE.lite }, status: zeile && zeile.status, result: ergebnis }, zeile), { dauer_ms: r.ms }) });
}

/* ── v3590 · Gutachten ueber Junker Immobilien (services/gutachtenAuftrag.js) ─────────────
   Beim Partner steht immer Junker Solution als Anfragender (aus der Umgebung), nie der Kunde.
   Beim vollstaendigen Gutachten setzt DealPilot auch die Vereinbarung (Besichtigung, Zahlung). */
const ga = require('../services/gutachtenAuftrag');
function mitAuftraggeber(art, data, auswahl) {
  const a = ga.auftraggeber();
  const d = Object.assign({}, data || {});
  if (!a) return d;
  d.requester = ga.requesterFuerPartner(a, art);
  if (art === 'voll') d.agreement = ga.vereinbarungFuerPartner(auswahl || {});
  return d;
}

router.get('/preise', (req, res) => {
  const a = ga.auftraggeber();
  res.json({ preisliste: ga.preisliste(), beauftragt_ueber: a ? a.anzeige : null, beauftragung_aktiv: ga.beauftragungAktiv() });
});
router.post('/preis', (req, res) => {
  res.json(ga.preisBerechnen(req.body || {}));
});

const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function kundePruefen(k) {
  const f = [];
  const s = (x) => String(x == null ? '' : x).trim();
  if (!s(k.nachname) && !s(k.firma)) f.push({ path: 'kunde.nachname', message: 'Bitte Name oder Firma angeben.' });
  if (!s(k.strasse)) f.push({ path: 'kunde.strasse', message: 'Bitte die Straße angeben.' });
  if (!s(k.plz)) f.push({ path: 'kunde.plz', message: 'Bitte die Postleitzahl angeben.' });
  if (!s(k.ort)) f.push({ path: 'kunde.ort', message: 'Bitte den Ort angeben.' });
  if (!EMAIL_RX.test(s(k.email))) f.push({ path: 'kunde.email', message: 'Bitte eine gültige E-Mail-Adresse angeben.' });
  return f;
}
const KUNDE_FELDER = ['firma', 'vorname', 'nachname', 'strasse', 'hnr', 'plz', 'ort', 'email', 'telefon'];

/* POST /auftraege { objekt_id, data, kunde, auswahl:{besichtigung, express, rabattcode}, zustimmungen:{daten, widerruf, kosten},
                     request_id?, beauftragen }
   1. Kunde nur mit Zustimmung zur Weitergabe (sonst wird nichts gespeichert)
   2. Preis wird HIER gerechnet (preisBerechnen), nie aus dem Browser uebernommen
   3. Entwurf beim Partner anlegen bzw. aendern; mit beauftragen === true absenden
   4. Auftrag speichern, beim Beauftragen Marcel benachrichtigen (Staging: keine echte Mail) */
router.post('/auftraege', async (req, res, next) => {
  try {
    const b = req.body || {};
    const z = b.zustimmungen || {};
    const kunde = {}; KUNDE_FELDER.forEach((k) => { if (b.kunde && b.kunde[k] != null) kunde[k] = String(b.kunde[k]).trim().slice(0, 200); });
    if (z.daten !== true) {
      return res.status(400).json({ error: 'Ohne deine Zustimmung zur Übermittlung können wir den Auftrag nicht annehmen.', code: 'zustimmung_fehlt',
        felder: [{ path: 'zustimmung.daten', message: 'Bitte der Übermittlung deiner Angaben zustimmen.' }] });
    }
    const kf = kundePruefen(kunde);
    if (kf.length) return res.status(400).json({ error: 'Bitte deine Angaben für die Rechnung vervollständigen.', code: 'validation_failed', felder: kf });
    if (b.beauftragen === true && (z.kosten !== true || z.widerruf !== true)) {
      return res.status(400).json({ error: 'Bitte die kostenpflichtige Beauftragung und die Widerrufsbelehrung bestätigen.', code: 'bestaetigung_fehlt',
        felder: [z.kosten !== true ? { path: 'zustimmung.kosten', message: 'Bitte bestätigen.' } : null, z.widerruf !== true ? { path: 'zustimmung.widerruf', message: 'Bitte bestätigen.' } : null].filter(Boolean) });
    }
    if (!ga.auftraggeber()) return res.status(503).json({ error: 'Der Auftraggeber für gutachten.org ist noch nicht eingerichtet.', code: 'auftraggeber_fehlt' });
    let objekt = b.objekt_id && UUID.test(String(b.objekt_id)) ? String(b.objekt_id) : null;
    let objektText = null;
    if (objekt) {
      const o = await query("SELECT data->>'str' AS str, data->>'hnr' AS hnr, data->>'plz' AS plz, data->>'ort' AS ort, data->>'wfl' AS wfl FROM objects WHERE id=$1 AND user_id=$2", [objekt, req.user.id]);
      if (!o.rowCount) objekt = null; else objektText = [[o.rows[0].str, o.rows[0].hnr].filter(Boolean).join(' '), [o.rows[0].plz, o.rows[0].ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    }
    const auswahl = { besichtigung: (b.auswahl && b.auswahl.besichtigung) || 'keine', express: !!(b.auswahl && b.auswahl.express === true),
      rabattcode: String((b.auswahl && b.auswahl.rabattcode) || '').trim().slice(0, 40) };
    const daten = b.data && typeof b.data === 'object' ? b.data : {};
    const od = daten.objectDetails || {};
    const preis = ga.preisBerechnen(Object.assign({ flaeche: od.propertyArea || od.propertyResidentialArea || b.flaeche }, auswahl));
    if (preis.fehler) return res.status(400).json({ error: preis.text, code: preis.fehler, felder: [{ path: 'objectDetails.propertyArea', message: preis.text }] });
    preis.quelle = ga.preisliste().quelle; preis.stand = ga.preisliste().stand; preis.vorlaeufig = !!ga.preisliste().vorlaeufig;
    const partnerDaten = mitAuftraggeber('voll', daten, auswahl);

    /* Entwurf beim Partner: vorhandener (eigener) oder neuer */
    let zeile = b.request_id ? await zeileHolen(req.user.id, String(b.request_id)) : null;
    let r;
    if (zeile) {
      r = await mitFrischemEtag(req.user.id, zeile, 'aendern', (etag) => ev.api.aendern(zeile.request_id, partnerDaten, etag));
      if (!r.ok) return fehler(res, r, zeile.request_id);
    } else {
      r = await ev.api.anlegen(ev.FORMULARE.voll, partnerDaten, ev.idemSchluessel('dp-auftrag'));
      await protokoll(req.user.id, 'anlegen', r, r.body && r.body.data && r.body.data.requestId);
      if (!r.ok) return fehler(res, r);
      const d = r.body.data, k = ev.konfig();
      await query('INSERT INTO gutachter_anfragen (user_id, objekt_id, formular, umgebung, request_id, request_number, status, etag, idem_submit) '
        + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (request_id) DO NOTHING',
        [req.user.id, objekt, ev.FORMULARE.voll, k.umgebung, d.requestId, d.requestNumber || null, d.status || 'draft', r.etag || null, ev.idemSchluessel('dp-absenden')]);
      zeile = await zeileHolen(req.user.id, d.requestId);
    }
    /* v3590 · verbindlich an gutachten.org nur mit Schalter GUTACHTEN_BEAUFTRAGUNG_AKTIV=true; sonst „bestellt“ (Marcel sendet ab) */
    const anPartner = b.beauftragen === true && ga.beauftragungAktiv();
    if (b.beauftragen === true) await query('UPDATE gutachter_anfragen SET kostenpflichtig_bestaetigt_at=NOW() WHERE request_id=$1', [zeile.request_id]);
    if (anPartner) {
      r = await mitFrischemEtag(req.user.id, zeile, 'absenden', (etag) => ev.api.absenden(zeile.request_id, etag, zeile.idem_submit));
      if (!r.ok) return fehler(res, r, zeile.request_id);
    }
    zeile = await zeileHolen(req.user.id, zeile.request_id);
    const jetzt = new Date().toISOString();
    const zust = { daten: jetzt, widerruf: z.widerruf === true ? jetzt : null, kosten: z.kosten === true ? jetzt : null };
    const status = b.beauftragen === true ? (anPartner ? 'beauftragt' : 'bestellt') : 'entwurf';
    const vorh = await query('SELECT id FROM gutachten_auftraege WHERE request_id=$1 AND user_id=$2', [zeile.request_id, req.user.id]);
    let auftragId;
    if (vorh.rowCount) {
      auftragId = vorh.rows[0].id;
      await query('UPDATE gutachten_auftraege SET kunde=$2::jsonb, zustimmungen=$3::jsonb, auswahl=$4::jsonb, preis=$5::jsonb, endpreis=$6, status=$7, '
        + 'request_number=$8, beauftragt_at=CASE WHEN $7 IN (\'beauftragt\',\'bestellt\') THEN NOW() ELSE beauftragt_at END, updated_at=NOW() WHERE id=$1',
        [auftragId, JSON.stringify(kunde), JSON.stringify(zust), JSON.stringify(auswahl), JSON.stringify(preis), preis.endpreis, status, zeile.request_number]);
    } else {
      const ins = await query('INSERT INTO gutachten_auftraege (user_id, objekt_id, objekt_text, request_id, request_number, status, kunde, zustimmungen, auswahl, preis, endpreis, umgebung, beauftragt_at) '
        + 'VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11,$12, CASE WHEN $6 IN (\'beauftragt\',\'bestellt\') THEN NOW() ELSE NULL END) RETURNING id',
        [req.user.id, objekt, objektText, zeile.request_id, zeile.request_number, status, JSON.stringify(kunde), JSON.stringify(zust), JSON.stringify(auswahl),
         JSON.stringify(preis), preis.endpreis, zeile.umgebung]);
      auftragId = ins.rows[0].id;
    }
    let benachrichtigung = null;
    if (status === 'beauftragt' || status === 'bestellt') {
      benachrichtigung = await ga.benachrichtigen({ status, kunde, auswahl, preis, objekt_text: objektText, request_number: zeile.request_number });
      await query('UPDATE gutachten_auftraege SET benachrichtigung=$2::jsonb WHERE id=$1', [auftragId, JSON.stringify(Object.assign({ zeit: jetzt }, benachrichtigung))]);
    }
    res.status(201).json({ auftrag: { id: auftragId, status, preis, request_id: zeile.request_id, request_number: zeile.request_number, benachrichtigung: benachrichtigung && benachrichtigung.status },
      anfrage: sicht(r.body && r.body.data, zeile) });
  } catch (e) { next(e); }
});

router.post('/anfragen', async (req, res, next) => {
  try {
    const b = req.body || {};
    const formType = ev.FORMULARE[b.art];
    if (!formType) return res.status(400).json({ error: 'art lite oder voll' });
    let objekt = b.objekt_id && UUID.test(String(b.objekt_id)) ? String(b.objekt_id) : null;
    if (objekt) {
      const o = await query('SELECT 1 FROM objects WHERE id=$1 AND user_id=$2', [objekt, req.user.id]);
      if (!o.rowCount) objekt = null;
    }
    const data = mitAuftraggeber(b.art, b.data && typeof b.data === 'object' && !Array.isArray(b.data) ? b.data : {}, b.auswahl);
    if (b.art === 'lite' && b.absenden === true && ev.liteWegDirekt()) return liteDirekt(req, res, objekt, data);
    const r = await ev.api.anlegen(formType, data, ev.idemSchluessel('dp-anlegen'));
    await protokoll(req.user.id, 'anlegen', r, r.body && r.body.data && r.body.data.requestId);
    if (!r.ok) return fehler(res, r);
    const d = r.body.data;
    const k = ev.konfig();
    await query('INSERT INTO gutachter_anfragen (user_id, objekt_id, formular, umgebung, request_id, request_number, status, etag, idem_submit) '
      + 'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (request_id) DO NOTHING',
      [req.user.id, objekt, formType, k.umgebung, d.requestId, d.requestNumber || null, d.status || 'draft', r.etag || null, ev.idemSchluessel('dp-absenden')]);
    const zeile = await zeileHolen(req.user.id, d.requestId);
    if (b.absenden === true) return absenden(req, res, zeile);
    res.status(201).json({ anfrage: sicht(d, zeile) });
  } catch (e) { next(e); }
});

router.get('/anfragen/:rid', async (req, res, next) => {
  try {
    const zeile = await zeileHolen(req.user.id, req.params.rid);
    if (!zeile) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    const r = await ev.api.lesen(zeile.request_id);
    await protokoll(req.user.id, 'lesen', r, zeile.request_id);
    if (!r.ok) return fehler(res, r);
    await zeileFortschreiben(zeile.request_id, r);
    res.json({ anfrage: sicht(r.body.data, await zeileHolen(req.user.id, zeile.request_id)) });
  } catch (e) { next(e); }
});

router.patch('/anfragen/:rid', async (req, res, next) => {
  try {
    const zeile = await zeileHolen(req.user.id, req.params.rid);
    if (!zeile) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    const data = mitAuftraggeber(zeile.formular === ev.FORMULARE.lite ? 'lite' : 'voll', (req.body && req.body.data && typeof req.body.data === 'object') ? req.body.data : {}, req.body && req.body.auswahl);
    const r = await mitFrischemEtag(req.user.id, zeile, 'aendern', (etag) => ev.api.aendern(zeile.request_id, data, etag));
    if (!r.ok) return fehler(res, r, zeile.request_id);
    res.json({ anfrage: sicht(r.body.data, await zeileHolen(req.user.id, zeile.request_id)) });
  } catch (e) { next(e); }
});

router.post('/anfragen/:rid/absenden', async (req, res, next) => {
  try {
    const zeile = await zeileHolen(req.user.id, req.params.rid);
    if (!zeile) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    return absenden(req, res, zeile);
  } catch (e) { next(e); }
});

router.post('/anfragen/:rid/dateien', (req, res, next) => {
  upload(req, res, async (err) => {
    if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Datei größer als 20 MB.' : err.message });
    try {
      const zeile = await zeileHolen(req.user.id, req.params.rid);
      if (!zeile) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
      const b = req.body || {};
      const fieldId = String(b.fieldId || '').trim();
      if (!fieldId) return res.status(400).json({ error: 'fieldId fehlt (Feld aus der Formulardefinition).' });
      let datei = null;
      if (req.file) {
        let name = req.file.originalname || 'Datei';
        try { name = Buffer.from(req.file.originalname, 'latin1').toString('utf8'); } catch (e) {}
        datei = { puffer: req.file.buffer, name, mime: req.file.mimetype };
      } else if (b.datei_id && UUID.test(String(b.datei_id))) {
        /* aus den Objektunterlagen (services/dateiAblage.js), nur eigene Dateien */
        const ablage = require('../services/dateiAblage');
        const d = await ablage.holen(req.user.id, String(b.datei_id));
        if (!d) return res.status(404).json({ error: 'Unterlage nicht gefunden' });
        if (d.puffer.length > MAX_DATEI) return res.status(413).json({ error: 'Datei größer als 20 MB.' });
        datei = { puffer: d.puffer, name: d.zeile.name, mime: d.zeile.mime };
      }
      if (!datei) return res.status(400).json({ error: 'Keine Datei (Feld „datei“ oder datei_id).' });
      const felder = { fieldId, documentCategory: b.documentCategory || '' };
      const idem = ev.idemSchluessel('dp-datei');
      const r = await mitFrischemEtag(req.user.id, zeile, 'datei', (etag) => ev.api.dateiHochladen(zeile.request_id, etag, felder, datei, idem));
      if (!r.ok) return fehler(res, r);
      res.status(201).json({ datei: r.body && r.body.data });
    } catch (e) { next(e); }
  });
});

router.delete('/anfragen/:rid/dateien/:fileId', async (req, res, next) => {
  try {
    const zeile = await zeileHolen(req.user.id, req.params.rid);
    if (!zeile) return res.status(404).json({ error: 'Anfrage nicht gefunden' });
    const r = await mitFrischemEtag(req.user.id, zeile, 'datei_loeschen', (etag) => ev.api.dateiLoeschen(zeile.request_id, req.params.fileId, etag));
    if (!r.ok) return fehler(res, r);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
module.exports._intern = { freigeschaltet, sicht };
