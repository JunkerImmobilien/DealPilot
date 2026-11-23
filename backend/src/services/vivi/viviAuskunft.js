'use strict';
/* services/vivi/viviAuskunft.js — v4130 · ViVi-Werkzeuge des Co-Piloten (NUR LESEN)
 *
 * Marcel 23.11.2026: „kann im Reiter ViVi man auch KI-Anfragen machen zu seinem Objekt? … mit dem Co-Pilot kombinieren?
 * … so kann man über die Einheit alles fragen.“ Und zur Datenregel: „ja prima, und Mieter kann man abkürzen falls
 * notwendig, mit z. B. Hr. M“.
 *
 * Der Co-Pilot laeuft ueber OpenAI. Deshalb gilt hier, BEVOR irgendetwas das Modell erreicht:
 *   · Jedes Ergebnis wird aus einer FREIGABELISTE von Feldern gebaut, nie aus der rohen ViVi-Antwort. Was nicht in der
 *     Liste steht (Vorname, Nachname, Geburtsdatum, Telefon, E-Mail, Zweitanschrift, IBAN, Gegenkonto, Verwendungszweck,
 *     Handwerker-E-Mail), kommt gar nicht erst in das Ergebnis.
 *   · Mieter heissen „Hr. M.“, „Fr. K.“ oder „Mieter S.“ (Anrede aus ViVi, erster Buchstabe des Nachnamens). Eine
 *     Firma als Mieter heisst „Firma B.“. Mitmieter werden nur gezaehlt.
 *   · Freitext (Beschreibung, Grund, Titel, Absender, Posten-Bezeichnung) laeuft durch den Schwaerzer: alle Namen der
 *     Mieter DIESES Objekts werden durch ihre Abkuerzung ersetzt, E-Mail, Telefonnummer und IBAN durch einen Platzhalter.
 *   · Gespeichert wird nichts davon: kein Schreiben in objects.data, keine Tabelle. Ein kurzer Zwischenspeicher im
 *     Arbeitsspeicher (5 Minuten, nur das GESCHWAERZTE Ergebnis) schont die ViVi-Bremse (60 Anfragen je Minute).
 *
 * Die API liefert (Dateien/Architektur/vivi/vivi-openapi-v1.json, gemessen am Testkonto 22./23.11.2026):
 *   einheiten   GET /projects/{p}/units, /rental-units, /rental-units/{r}/rent-history
 *   belege      GET /tax-overview?year=&project_id= (+ &line= je Bereich, Posten mit Datum und Kostenart der Anlage V)
 *               und GET /receipts?project_id=&date_from=&date_to= (Betrag, Faelligkeit, Zahlstatus, ohne Kostenart)
 *   vorgaenge   GET /portal-cases?project_id=
 *   handwerker  GET /craftsman-jobs?project_id=
 *   darlehen    GET /projects/{p}/financings und /financing-schedule
 *   Zaehler: /meters steht in der Spezifikation ohne beschriebene Antwort (data: string) und ist am Testkonto nicht
 *   gemessen. Deshalb gibt es dafuer bewusst kein Werkzeug.
 *
 * Nur fuer das EIGENE, mit ViVi verknuepfte Objekt: viviSpeicher.verknuepfung(userId, objectId) ist nutzergebunden.
 * Ohne Verknuepfung, ohne Token oder bei der Bremse gibt es eine saubere Antwort statt eines Fehlers.
 * tools/vivi-copilot-pruefen.mjs prueft Freigabeliste, Schwaerzer, Abkuerzung, fremdes Objekt und Bremse.
 */
const mapping = require('./viviMapping');
const steuer = require('./viviSteuer');

const CACHE_MS = 5 * 60 * 1000;
const MAX_VERLAEUFE = 12;          /* hoechstens so viele Mietverlaeufe je Lauf (je eine Anfrage) */
const MAX_POSTEN = 60;             /* je Liste an das Modell, der Rest wird gezaehlt */
const _cache = new Map();          /* schluessel -> { t, wert } (nur geschwaerzte Ergebnisse) */

let _dienst = null;
function dienst() { return _dienst || require('./viviDienst'); }
/** nur fuer tools/vivi-copilot-pruefen.mjs: { speicher, token(userId), client(token), jetzt() } */
let _test = null;
function _setzeTest(t) { _test = t || null; _cache.clear(); }
function umgebung() {
  if (_test) return _test;
  const d = dienst();
  return {
    speicher: d._deps().speicher,
    token: d._token,
    client: function (t) { return d._deps().client(t, { maxWarten: 20000 }); },
    jetzt: function () { return d._deps().jetzt(); }
  };
}

/* ── Abkuerzen und Schwaerzen ───────────────────────────────────────── */
function text(v) { return v == null ? '' : String(v).trim(); }
function anrede(s) {
  const a = text(s).toLowerCase();
  if (/^(herr|hr\b|hr\.|mr\b|mr\.|m$|male|mann)/.test(a)) return 'Hr.';
  if (/^(frau|fr\b|fr\.|mrs|ms\b|ms\.|f$|female|w$)/.test(a)) return 'Fr.';
  return 'Mieter';
}
function initial(s) {
  const t = text(s).replace(/^(von|van|de|zu|vom|der|den)\s+/i, '');
  const m = /[A-Za-zÄÖÜäöüß]/.exec(t);
  return m ? m[0].toUpperCase() + '.' : '';
}
/** Mietverhaeltnis -> „Hr. M.“ / „Fr. K.“ / „Mieter S.“ / „Firma B.“ / „Mieter“ */
function mieterKurz(r) {
  if (!r) return null;
  if (r.is_company) { const i = initial(r.company_name); return i ? 'Firma ' + i : 'Firma'; }
  const i = initial(r.tenant_last_name);
  const a = anrede(r.tenant_salutation);
  return i ? a + ' ' + i : 'Mieter';
}
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/** Namen aller Mietverhaeltnisse dieses Objekts -> [{ wort, ersatz }] (auch Mitmieter, beendete Vertraege) */
function namenAus(mietverhaeltnisse) {
  const liste = [];
  const dazu = function (wort, ersatz) {
    const w = text(wort);
    if (w.length < 3) return;                       /* „Li“ oder „Ng“ stehen in zu vielen Woertern */
    if (!liste.some(function (x) { return x.wort.toLowerCase() === w.toLowerCase(); })) liste.push({ wort: w, ersatz: ersatz });
  };
  (mietverhaeltnisse || []).forEach(function (r) {
    if (!r) return;
    const k = mieterKurz(r) || 'Mieter';
    [r.tenant_last_name, r.tenant_first_name, r.company_name].forEach(function (n) {
      dazu(n, k);
      text(n).split(/[\s,-]+/).forEach(function (teil) { dazu(teil, k); });   /* Doppelnamen einzeln */
    });
    [r.tenant_email, r.tenant_phone, r.tenant_alt_street].forEach(function (n) { dazu(n, '[entfernt]'); });
    (Array.isArray(r.co_tenants) ? r.co_tenants : []).forEach(function (c) {
      if (!c || typeof c !== 'object') { dazu(c, 'Mitmieter'); return; }
      Object.keys(c).forEach(function (key) {
        if (/name|email|phone|telefon|street/i.test(key)) {
          dazu(c[key], 'Mitmieter');
          text(c[key]).split(/[\s,-]+/).forEach(function (teil) { dazu(teil, 'Mitmieter'); });
        }
      });
    });
  });
  /* laengste zuerst, damit „Müller-Lüdenscheidt“ vor „Müller“ greift */
  return liste.sort(function (a, b) { return b.wort.length - a.wort.length; });
}
const RE_MAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RE_IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g;
const RE_TEL = /(?:\+|\b0)\d[\d \/()-]{6,}\d/g;
function schwaerzer(namen) {
  const muster = (namen || []).map(function (n) {
    return { re: new RegExp('(^|[^A-Za-zÄÖÜäöüß])(?:(?:Herrn?|Frau|Hr\\.|Fr\\.)\\s+)?' + escRe(n.wort) + '(?=$|[^A-Za-zÄÖÜäöüß])', 'gi'), ersatz: n.ersatz };
  });
  return function (s) {
    if (s == null) return null;
    let t = String(s);
    t = t.replace(RE_MAIL, '[E-Mail entfernt]').replace(RE_IBAN, '[IBAN entfernt]').replace(RE_TEL, '[Telefon entfernt]');
    muster.forEach(function (m) { t = t.replace(m.re, function (_, vor) { return vor + m.ersatz; }); });
    return t.slice(0, 300);
  };
}

/* ── Hilfen ─────────────────────────────────────────────────────────── */
function liste(a) { return a && Array.isArray(a.data) ? a.data : []; }
function zahl(v) { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : null; }
function datum(v) { return mapping.isoDatum ? mapping.isoDatum(v) : (v ? String(v).slice(0, 10) : null); }
function rund(n) { return n == null ? null : Math.round(n * 100) / 100; }
function fehlerAntwort(e) {
  const c = e && e.code;
  if (c === 'bremse_429' || c === 'bremse_lokal') return { ok: false, bremse: true, hinweis: 'ViVi bremst gerade die Anfragen (höchstens 60 je Minute). Sag dem Nutzer, er soll es in einer Minute noch einmal versuchen.' };
  if (c === 'kein_token') return { ok: false, nicht_verbunden: true, hinweis: 'ViVi ist in diesem Konto nicht verbunden. Der Token wird in den Einstellungen unter Account & Sicherheit eingetragen.' };
  if (c === 'nicht_berechtigt') return { ok: false, hinweis: 'ViVi lehnt den Zugriff ab. Der Token in den Einstellungen sollte geprüft werden.' };
  return { ok: false, hinweis: 'ViVi war nicht erreichbar (' + String((e && e.message) || 'Fehler').slice(0, 120) + '). Nichts erfinden, ehrlich sagen.' };
}

/** Verknuepfung + Client. Liefert { ok:false, … } statt zu werfen, damit das Modell eine ehrliche Antwort geben kann. */
async function oeffnen(userId, objectId) {
  const U = umgebung();
  const v = await U.speicher.verknuepfung(userId, objectId);
  if (!v || v.anlage_status !== 'fertig' || !v.vivi_objekt_id) {
    return { fehlt: { ok: false, nicht_verknuepft: true, hinweis: 'Dieses Objekt ist nicht mit ViVi verknüpft. Verknüpfen geht im Reiter Objekt über die ViVi-Leiste.' } };
  }
  let cl;
  try { cl = U.client(await U.token(userId)); } catch (e) { return { fehlt: fehlerAntwort(e) }; }
  const q = v.vivi_account_id ? { account_id: v.vivi_account_id } : {};
  return { v: v, cl: cl, q: q, P: '/projects/' + encodeURIComponent(String(v.vivi_objekt_id)), jetzt: U.jetzt() };
}
async function zwischen(schluessel, fn) {
  const t = umgebung().jetzt();
  const c = _cache.get(schluessel);
  if (c && t - c.t < CACHE_MS) return c.wert;
  const w = await fn();
  if (w && w.ok !== false) _cache.set(schluessel, { t: t, wert: w });
  if (_cache.size > 500) { const k = _cache.keys().next().value; _cache.delete(k); }
  return w;
}

/* ── Werkzeug 1: Einheiten und Mietverhaeltnisse ────────────────────── */
async function einheiten(userId, objectId, args) {
  const a = args || {};
  return zwischen(userId + '|' + objectId + '|einheiten', async function () {
    const o = await oeffnen(userId, objectId); if (o.fehlt) return o.fehlt;
    try {
      const units = liste(await o.cl.get(o.P + '/units', o.q));
      const miet = liste(await o.cl.get(o.P + '/rental-units', o.q));
      const sw = schwaerzer(namenAus(miet));
      const heute = new Date(o.jetzt).toISOString().slice(0, 10);
      const gem = o.v.vivi_ids && o.v.vivi_ids.einheiten && typeof o.v.vivi_ids.einheiten === 'object' ? o.v.vivi_ids.einheiten : {};
      const nrVon = function (unitId) { const k = Object.keys(gem).find(function (x) { return gem[x] && String(gem[x].unit_id) === String(unitId); }); return k ? (gem[k].nr != null ? String(gem[k].nr) : null) : null; };
      const laufend = function (r) { const b = datum(r.rental_start), e = datum(r.rental_end); return !(e && e < heute) && !(b && b > heute); };
      let verlaeufe = 0;
      const aus = [];
      for (const u of units) {
        if (!u) continue;
        const alle = miet.filter(function (r) { return r && String(r.unit_id) === String(u.id); });
        const jetzt = alle.filter(laufend).sort(function (x, y) { return String(datum(y.rental_start) || '').localeCompare(String(datum(x.rental_start) || '')); })[0] || null;
        let mv = null;
        if (jetzt) {
          let verlauf = null;
          if (verlaeufe < MAX_VERLAEUFE && jetzt.id != null) {
            verlaeufe++;
            try {
              const h = ((await o.cl.get(o.P + '/rental-units/' + encodeURIComponent(String(jetzt.id)) + '/rent-history', o.q)) || {}).data || null;
              if (h) {
                verlauf = {
                  beginn: datum(h.rental_start),
                  start_kalt: h.start_state ? zahl(h.start_state.rent) : null,
                  start_nk: h.start_state ? zahl(h.start_state.utility) : null,
                  aenderungen: (Array.isArray(h.rent_changes) ? h.rent_changes : []).filter(function (c) { return c && typeof c === 'object'; }).map(function (c) {
                    return { ab: datum(c.effective_date), art: text(c.adjustment_type) || null, status: text(c.status) || null,
                      kalt_vorher: zahl(c.previous_rent), kalt_neu: zahl(c.new_rent), nk_vorher: zahl(c.previous_utility_costs), nk_neu: zahl(c.new_utility_costs),
                      grund: c.adjustment_reason ? sw(c.adjustment_reason) : null };
                  })
                };
              }
            } catch (e) { if (e && (e.code === 'bremse_429' || e.code === 'bremse_lokal')) throw e; }
          }
          mv = {
            mieter: mieterKurz(jetzt), weitere_mieter: Array.isArray(jetzt.co_tenants) ? jetzt.co_tenants.length : 0,
            nutzung: text(jetzt.occupancy_type) || null, vertragsart: text(jetzt.contract_type) || null,
            beginn: datum(jetzt.rental_start), ende: datum(jetzt.rental_end),
            kaltmiete: zahl(jetzt.rent), zielmiete: zahl(jetzt.target_rent), nk_vorauszahlung: zahl(jetzt.monthly_utility_costs), hausgeld_monat: zahl(jetzt.monthly_hausgeld),
            letzte_erhoehung: datum(jetzt.last_rent_increase),
            index: jetzt.index_base_year ? { basisjahr: jetzt.index_base_year, basismonat: jetzt.index_base_month, basiswert: zahl(jetzt.index_base_value), seit: datum(jetzt.index_base_since) } : null,
            kaution: { betrag: zahl(jetzt.deposit_amount), art: text(jetzt.deposit_type) || null, eingegangen: datum(jetzt.deposit_received_date), zurueck: datum(jetzt.deposit_returned_date), einbehalten: zahl(jetzt.deposit_retained_amount) },
            mietverlauf: verlauf
          };
        }
        aus.push({
          einheit: text(u.identifier) || null, dealpilot_nr: nrVon(u.id), art: text(u.unit_type) || null,
          flaeche_m2: zahl(u.square_meters), zimmer: zahl(u.rooms), etage: u.floor == null ? null : String(u.floor),
          leer: !jetzt && text(u.unit_type) !== 'ancillary', mietverhaeltnis: mv,
          fruehere_mietverhaeltnisse: alle.filter(function (r) { return r !== jetzt && datum(r.rental_end) && datum(r.rental_end) < heute; }).length
        });
      }
      return { ok: true, quelle: 'ViVi, gelesen ' + heute, stichtag: heute, einheiten: aus,
        hinweis: 'Mieter sind aus Datenschutzgründen abgekürzt (Hr. M., Fr. K.). Nenne sie genau so, frage nie nach dem vollen Namen. '
          + 'Beträge sind Euro im Monat. dealpilot_nr ist die Nummer der Wohnung in DealPilot.' };
    } catch (e) { return fehlerAntwort(e); }
  }).then(function (w) {
    if (!w || w.ok === false || a.einheit == null || a.einheit === '') return w;
    const s = String(a.einheit).toLowerCase().replace(/^(wohnung|whg\.?|einheit|we)\s*/, '').trim();
    const treffer = w.einheiten.filter(function (e) { return String(e.dealpilot_nr || '').toLowerCase() === s || String(e.einheit || '').toLowerCase() === s || String(e.einheit || '').toLowerCase().indexOf(s) >= 0; });
    return Object.assign({}, w, { einheiten: treffer.length ? treffer : w.einheiten, einheit_gefiltert: treffer.length ? String(a.einheit) : null,
      einheit_hinweis: treffer.length ? undefined : 'Keine Einheit passt zu „' + String(a.einheit).slice(0, 40) + '“, hier alle.' });
  });
}

/* ── Werkzeug 2: Belege eines Jahres (Kostenart aus der Anlage V, Zahlstatus aus der Belegliste) ── */
async function belege(userId, objectId, args) {
  const a = args || {};
  const jahrJetzt = new Date(umgebung().jetzt()).getFullYear();
  const jahr = Number.isInteger(+a.jahr) && +a.jahr >= 2000 && +a.jahr <= jahrJetzt ? +a.jahr : jahrJetzt - 1;
  return zwischen(userId + '|' + objectId + '|belege|' + jahr, async function () {
    const o = await oeffnen(userId, objectId); if (o.fehlt) return o.fehlt;
    try {
      const miet = liste(await o.cl.get(o.P + '/rental-units', o.q));
      const sw = schwaerzer(namenAus(miet));
      const pid = String(o.v.vivi_objekt_id);
      /* Kostenarten: die Zeilen der Anlage V mit ihren Posten (wie viviSteuer) */
      const pfade = steuer.lesePfade(pid, jahr);
      const basis = ((await o.cl.get('/tax-overview', Object.assign({}, o.q, pfade[0].abfrage))) || {}).data || null;
      const arten = [];
      let posten = 0;
      for (const x of steuer.lesePfade(pid, jahr, steuer.zeilenMitPosten(basis)).slice(1)) {
        const d = ((await o.cl.get(x.pfad, Object.assign({}, o.q, x.abfrage))) || {}).data || {};
        const ld = d.line_details && !d.line_details.error ? d.line_details : null;
        if (!ld) continue;
        const items = Array.isArray(ld.items) ? ld.items : [];
        arten.push({ zeile: text(ld.zeile || x.abfrage.line), kostenart: sw(ld.label), summe: zahl(ld.amount),
          posten: items.slice(0, Math.max(0, MAX_POSTEN - posten)).map(function (it) { return { datum: text(it.date) || null, bezeichnung: sw(it.label), betrag: zahl(it.amount) }; }),
          weitere_posten: Math.max(0, items.length - Math.max(0, MAX_POSTEN - posten)) + (ld.items_truncated ? 1 : 0) });
        posten += items.length;
      }
      const summen = [];
      ['income', 'expenses'].forEach(function (seite) {
        (basis && Array.isArray(basis[seite]) ? basis[seite] : []).forEach(function (z) {
          if (z && zahl(z.amount)) summen.push({ seite: seite === 'income' ? 'Einnahme' : 'Ausgabe', zeile: text(z.zeile), bezeichnung: sw(z.label), betrag: zahl(z.amount) });
        });
      });
      /* Belegliste: Betrag, Faelligkeit, Zahlstatus (ohne Kostenart, ohne Gegenkonto und Verwendungszweck) */
      const r = (await o.cl.get('/receipts', Object.assign({}, o.q, { project_id: pid, date_from: jahr + '-01-01', date_to: jahr + '-12-31', per_page: 100 }))) || {};
      const bl = liste(r);
      const belegListe = bl.slice(0, MAX_POSTEN).map(function (b) {
        const zahlungen = Array.isArray(b.payments) ? b.payments : [];
        return { datum: datum(b.date), faellig: datum(b.due_date), betrag: zahl(b.amount), offen: zahl(b.open_amount), status: text(b.status) || null,
          richtung: text(b.direction) || null, absender: b.sender ? sw(b.sender) : null, beschreibung: b.description ? sw(b.description) : null,
          zahlungen: zahlungen.length, zuletzt_bezahlt: zahlungen.map(function (p) { return datum(p.booking_date || p.value_date); }).filter(Boolean).sort().pop() || null };
      });
      const offen = bl.reduce(function (s, b) { return s + (zahl(b.open_amount) || 0); }, 0);
      return { ok: true, jahr: jahr, quelle: 'ViVi, Anlage V und Belegliste ' + jahr,
        anlage_v_summen: summen, kostenarten: arten, belege: belegListe,
        belege_anzahl: bl.length + (r.meta && r.meta.last_page > 1 ? ' (mehr als ' + bl.length + ', nur die erste Seite gelesen)' : ''),
        offen_summe: rund(offen),
        hinweis: 'kostenarten kommt aus der Anlage V in ViVi (je Zeile mit Posten), belege aus der Belegliste (Zahlstatus). '
          + 'Ein Posten kann in beiden stehen, also nicht doppelt zählen. Läuft das Jahr noch, sind es die Buchungen bis heute.' };
    } catch (e) { return fehlerAntwort(e); }
  });
}

/* ── Werkzeug 3: Vorgaenge aus dem Mieterportal ─────────────────────── */
async function vorgaenge(userId, objectId, args) {
  const a = args || {};
  return zwischen(userId + '|' + objectId + '|vorgaenge', async function () {
    const o = await oeffnen(userId, objectId); if (o.fehlt) return o.fehlt;
    try {
      const miet = liste(await o.cl.get(o.P + '/rental-units', o.q));
      const sw = schwaerzer(namenAus(miet));
      const kurzVon = {}; miet.forEach(function (r) { if (r && r.id != null) kurzVon[String(r.id)] = mieterKurz(r); });
      const L = liste(await o.cl.get('/portal-cases', Object.assign({}, o.q, { project_id: String(o.v.vivi_objekt_id) })));
      return { ok: true, quelle: 'ViVi-Mieterportal', vorgaenge: L.slice(0, MAX_POSTEN).map(function (c) {
        return { titel: sw(c.title), kategorie: text(c.category) || null, status: text(c.status) || null, prioritaet: text(c.priority) || null,
          naechster_schritt: c.next_step ? sw(c.next_step) : null, faellig: datum(c.due_at), angelegt: datum(c.created_at), zuletzt: datum(c.last_activity_at),
          mieter: c.rental_unit_id != null ? (kurzVon[String(c.rental_unit_id)] || 'Mieter') : null,
          beschreibung: c.description ? sw(c.description) : null, anhaenge: c.attachments_count == null ? null : c.attachments_count };
      }), anzahl: L.length };
    } catch (e) { return fehlerAntwort(e); }
  }).then(function (w) {
    if (!w || w.ok === false || !a.nur_offen) return w;
    return Object.assign({}, w, { vorgaenge: w.vorgaenge.filter(function (x) { return !/^(closed|done|erledigt|geschlossen|resolved|archived)$/i.test(String(x.status || '')); }) });
  });
}

/* ── Werkzeug 4: Handwerkerauftraege ─────────────────────────────────── */
async function handwerker(userId, objectId) {
  return zwischen(userId + '|' + objectId + '|handwerker', async function () {
    const o = await oeffnen(userId, objectId); if (o.fehlt) return o.fehlt;
    try {
      const miet = liste(await o.cl.get(o.P + '/rental-units', o.q));
      const sw = schwaerzer(namenAus(miet));
      const L = liste(await o.cl.get('/craftsman-jobs', Object.assign({}, o.q, { project_id: String(o.v.vivi_objekt_id) })));
      return { ok: true, quelle: 'ViVi-Handwerkeraufträge', auftraege: L.slice(0, MAX_POSTEN).map(function (j) {
        const c = j.craftsman || {}, rq = j.request || {}, of = j.offer || null;
        return { art: text(j.type) || null, status: text(j.status) || null,
          handwerker: c.name ? sw(c.name) : null,   /* Firmenname; E-Mail und Kontakt nie */
          auftrag: rq.description ? sw(rq.description) : null, kostengrenze: zahl(rq.cost_limit),
          angebot: of ? { betrag: zahl(of.amount), ab: datum(of.available_from), am: datum(of.offered_at) } : null,
          vergeben: datum(j.awarded_at), vor_ort: datum(j.arrived_at), fertig: datum(j.finished_at), freigegeben: datum(j.approved_at),
          arbeitszeit_min: j.work_minutes == null ? null : j.work_minutes, rechnung_da: !!(j.invoice && j.invoice.file_name) };
      }), anzahl: L.length };
    } catch (e) { return fehlerAntwort(e); }
  });
}

/* ── Werkzeug 5: Darlehen und Tilgungsplan ──────────────────────────── */
async function darlehen(userId, objectId, args) {
  const a = args || {};
  const jahrJetzt = new Date(umgebung().jetzt()).getFullYear();
  const jahr = Number.isInteger(+a.jahr) && +a.jahr >= 2000 && +a.jahr <= jahrJetzt + 40 ? +a.jahr : jahrJetzt;
  return zwischen(userId + '|' + objectId + '|darlehen|' + jahr, async function () {
    const o = await oeffnen(userId, objectId); if (o.fehlt) return o.fehlt;
    try {
      const F = liste(await o.cl.get(o.P + '/financings', o.q));
      const plan = liste(await o.cl.get(o.P + '/financing-schedule', o.q));
      const heute = new Date(o.jetzt).toISOString().slice(0, 10);
      const imJahr = plan.filter(function (z) { return z && String(z.date || '').slice(0, 4) === String(jahr); });
      const bisHeute = plan.filter(function (z) { return z && datum(z.date) && datum(z.date) <= heute; });
      const letzte = bisHeute.length ? bisHeute[bisHeute.length - 1] : null;
      const summe = function (L, k) { return rund(L.reduce(function (s, z) { return s + (zahl(z[k]) || 0); }, 0)); };
      return { ok: true, quelle: 'ViVi-Finanzierung, gelesen ' + heute,
        darlehen: F.map(function (f) {
          return { name: text(f.name) || null, bank: text(f.bank_name) || null, art: text(f.financing_type) || null, status: text(f.status) || null,
            betrag: zahl(f.financing_amount), zins_pct: zahl(f.interest_rate), tilgung_pct: zahl(f.initial_repayment), rate_monat: zahl(f.fixed_monthly_rate),
            zinsbindung_jahre: zahl(f.fixed_interest_period), zinsbindung_bis: datum(f.fixed_interest_end_date), beginn: datum(f.financing_start_date), ende: datum(f.financing_end_date),
            sondertilgung_erlaubt: !!f.special_repayment_allowed, sondertilgung_max_pct: zahl(f.special_repayment_max_percent), sondertilgung_max_betrag: zahl(f.special_repayment_max_amount),
            sondertilgungen: Array.isArray(f.special_repayments) ? f.special_repayments.filter(function (s) { return s && typeof s === 'object'; }).map(function (s) { return { datum: datum(s.date || s.repayment_date), betrag: zahl(s.amount) }; }) : [] };
        }),
        restschuld_heute: letzte ? zahl(letzte.remaining_debt_after != null ? letzte.remaining_debt_after : letzte.remaining_debt) : null,
        restschuld_stand: letzte ? datum(letzte.date) : null,
        jahr: jahr,
        jahr_summen: imJahr.length ? { zinsen: summe(imJahr, 'interest'), tilgung: summe(imJahr, 'repayment'), raten: summe(imJahr, 'monthly_rate'),
          restschuld_jahresende: zahl(imJahr[imJahr.length - 1].remaining_debt_after), monate: imJahr.length } : null,
        hinweis: 'Restschuld und Summen stammen aus dem ViVi-Tilgungsplan. Ohne Zeilen im Jahr gibt es keine Jahressummen, dann nichts schätzen.' };
    } catch (e) { return fehlerAntwort(e); }
  });
}

/* ── Die Frage aus dem Reiter ViVi ──────────────────────────────────────
   POST /vivi/objekt/:id/frage { text, einheit?, verlauf? } (routes/vivi.js, hinter Vorschau-Sperre 'vivi').
   Derselbe Agent wie Telegram und Flow (agentLauf.laufen, alle LESENDEN Werkzeuge, dazu die ViVi-Werkzeuge oben),
   mit dem Objekt als Bezug. Schreiben gibt es hier nicht (vormerken lehnt ab), Kosten auch nicht (darfKosten false).
   Tageslimit: derselbe Zaehler wie der Co-Pilot (routes/ai.js copilotKontingent). KI-Deckel: agentLauf._ruf. */
async function frage(userId, objectId, b, opt) {
  b = b || {}; opt = opt || {};
  const text = String(b.text || '').trim();
  if (text.length < 2) throw Object.assign(new Error('Bitte eine Frage eingeben.'), { status: 400, code: 'text_fehlt' });
  if (text.length > 1500) throw Object.assign(new Error('Die Frage ist zu lang (höchstens 1.500 Zeichen).'), { status: 400, code: 'text_zu_lang' });
  const query = opt.query || require('../../db/pool').query;
  const o = await query('SELECT id, data FROM objects WHERE id=$1 AND user_id=$2', [objectId, userId]);
  if (!o.rowCount) throw Object.assign(new Error('Objekt nicht gefunden.'), { status: 404, code: 'objekt_fehlt' });
  const v = await umgebung().speicher.verknuepfung(userId, objectId);
  if (!v || v.anlage_status !== 'fertig' || !v.vivi_objekt_id) throw Object.assign(new Error('Dieses Objekt ist nicht mit ViVi verknüpft.'), { status: 409, code: 'nicht_verknuepft' });
  const kont = opt.kontingent || require('../../routes/ai').copilotKontingent;
  const lim = await kont.verbrauchen(userId);
  if (!lim.ok) throw Object.assign(new Error('Co-Pilot-Tageslimit erreicht (' + lim.limit + ' am Tag). Morgen wieder verfügbar.'), { status: 429, code: 'copilot_tageslimit' });
  const d = o.rows[0].data || {};
  const adr = [d.str, d.hnr].filter(Boolean).join(' ') + (d.ort ? ', ' + d.ort : '');
  const einheit = b.einheit != null && String(b.einheit).trim() ? String(b.einheit).trim().slice(0, 40) : null;
  const vorspann = '[Frage aus dem Reiter ViVi zum Objekt ' + (adr || 'dieses Nutzers') + ' (objekt id ' + objectId + ').'
    + (einheit ? ' Gewählt ist die Einheit ' + einheit + ', ohne andere Angabe ist sie gemeint (Werkzeuge mit einheit "' + einheit + '").' : '')
    + ' Nutze für Daten aus der Verwaltung die Werkzeuge vivi_*, für die DealPilot-Rechnung die übrigen. Mieter nur abgekürzt nennen.'
    + ' Antworte auf Deutsch im Du, knapp, ohne Markdown, ohne Gedankenstriche und Semikolons.]\n';
  const ctx = {
    userId: userId, kanal: 'vivi', nummerErfunden: true, letzteListe: null, letztesObjekt: objectId, protokoll: [],
    merkeObjekt: function () {}, merkeListe: function () {}, anlageFertig: async function () {},
    merkeAngebot: async function () {}, angebotVerbraucht: async function () {}
  };
  const verlauf = Array.isArray(b.verlauf) ? b.verlauf.slice(-6).map(function (e) { return { rolle: e && e.rolle === 'user' ? 'user' : 'assistant', text: String((e && e.text) || '').slice(0, 1500) }; }) : [];
  const laufen = opt.laufen || require('../agentLauf').laufen;
  const r = await laufen(vorspann + text, ctx, {
    darfKosten: false, verlauf: verlauf,
    schreibenVormerken: async function () { return { ok: false, gesperrt: true, hinweis: 'Im Reiter ViVi wird nur gelesen. Sag, dass Änderungen in DealPilot oder in ViVi selbst gemacht werden.' }; }
  });
  const schritte = (r.protokoll || ctx.protokoll || []).map(function (x) { return x.werkzeug; });
  return { antwort: String(r.text || '').trim(), werkzeuge: schritte, abgebrochen: !!r.abgebrochen, tageslimit: { benutzt: lim.benutzt, limit: lim.limit } };
}

module.exports = { einheiten, belege, vorgaenge, handwerker, darlehen, frage, mieterKurz, namenAus, schwaerzer, _setzeTest, CACHE_MS };
