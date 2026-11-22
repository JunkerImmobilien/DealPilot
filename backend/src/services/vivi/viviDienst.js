'use strict';
/* services/vivi/viviDienst.js — v3950 · ViVi-Anbindung: Verbindung, einmal anlegen, lesen, Takt
 *
 * Marcels Regeln vom 22.11.2026:
 *   1. EINMAL ANLEGEN. anlegen() beansprucht die Zeile in vivi_verknuepfung atomar. Ist das Objekt schon
 *      angelegt (oder legt gerade ein anderer Lauf an), antwortet es mit 409, ohne ViVi zu fragen.
 *      Jede Antwort-ID wird sofort gespeichert. Bricht ein Lauf ab (429, Netz, 422), setzt der naechste an der
 *      letzten gespeicherten Stelle fort und sieht vorher in ViVi nach, ob der letzte Schritt doch angekommen
 *      ist (gleiche Anschrift, gleicher Name der Einheit, gleiches Darlehen). So entsteht nichts doppelt.
 *   2. DANACH NUR LESEN. abrufen() schickt ausschliesslich GET. Kein laufender Wert geht zurueck.
 *   3. Das DealPilot-Objekt (objects.data) wird hier NIE geschrieben. Die ViVi-Werte landen in vivi_werte,
 *      der Browser setzt sie beim Oeffnen in die Felder und speichert wie immer (js/vivi-felder.js).
 *
 * Der Token kommt nur vom Nutzer (Einstellungen › Konto › Externe Anbieter › ViVi), verschluesselt in
 * user_provider_credentials, Anbieter 'vivi'. Nie im Code, nie in .env, nie im Protokoll, nie in einer Antwort.
 */
const mapping = require('./viviMapping');
const viviClient = require('./viviClient');

const ANBIETER = 'vivi';
const TAKT_STUNDEN = 20;          /* ein Objekt wird hoechstens alle 20 h vom Takt gelesen, der Takt laeuft alle 6 h */
const TAKT_GRENZE = 500;          /* Objekte je Taktlauf */
const PAUSE_MS = 1500;            /* zwischen zwei Objekten im Takt */

const STANDARD = {
  get speicher() { return require('./viviSpeicher'); },
  get creds() { return require('../providerCredentialsService'); },
  client: function (token, opt) { return viviClient.erzeugen(token, opt); },
  jetzt: function () { return Date.now(); },
  schlafen: function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
};
let _deps = null;
function deps() { return _deps || STANDARD; }
/** nur fuer tools/vivi-pruefen.mjs */
function _setzeDeps(d) {
  if (!d) { _deps = null; return; }
  const o = Object.create(STANDARD);
  Object.keys(d).forEach(function (k) { Object.defineProperty(o, k, { value: d[k], enumerable: true }); });
  _deps = o;
}

function fehler(status, code, text, extra) {
  const e = new Error(text);
  e.status = status; e.code = code;
  if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
  return e;
}
/* Fehler des Clients in eine HTTP-Antwort uebersetzen */
function alsAntwort(e) {
  if (e && e.status && !e.code) return e;
  const c = e && e.code;
  if (c === 'bremse_429' || c === 'bremse_lokal') return fehler(429, c, e.message);
  if (c === 'nicht_berechtigt') return fehler(502, c, e.message);
  if (c === 'ungueltig') return fehler(422, c, e.message, { details: e.details || null });
  if (c === 'kein_token') return fehler(428, c, 'ViVi ist nicht verbunden. Bitte den Token in den Einstellungen eintragen.');
  if (e && e.status >= 400 && e.status < 600 && c) return e;
  return fehler(502, c || 'vivi_fehler', (e && e.message) || 'ViVi nicht erreichbar');
}

async function token(userId) {
  const t = await deps().creds.getSecret(userId, ANBIETER);
  if (!t) throw fehler(428, 'kein_token', 'ViVi ist nicht verbunden. Bitte den Token in den Einstellungen eintragen.');
  return t;
}
function abfrage(accountId) { return accountId ? { account_id: accountId } : {}; }
function liste(antwort) { return antwort && Array.isArray(antwort.data) ? antwort.data : []; }

/* ── Verbindung ───────────────────────────────────────────────────────── */
async function verbindungMeta(userId) { return deps().creds.getMeta(userId, ANBIETER); }
async function verbindungSpeichern(userId, roh) {
  const t = String(roh || '').trim();
  if (t.length < 8 || /\s/.test(t)) throw fehler(400, 'token_ungueltig', 'Das sieht nicht nach einem ViVi-Token aus.');
  return deps().creds.setCredential(userId, ANBIETER, t);
}
async function verbindungLoeschen(userId) { return deps().creds.remove(userId, ANBIETER); }

/** Probeabruf GET /accounts. Liefert die Accounts (Hauptaccount und Firmenstrukturen), nie den Token. */
async function probe(userId) {
  const t0 = deps().jetzt();
  const cl = deps().client(await token(userId));
  try {
    const a = liste(await cl.get('/accounts'));
    await deps().speicher.protokoll({ user_id: userId, art: 'probe', anfragen: cl.zaehler.anfragen, ok: true, dauer_ms: deps().jetzt() - t0 });
    return { ok: true, accounts: a.map(function (x) { return { id: x.id, name: x.name, label: x.label, is_master: !!x.is_master, is_default: !!x.is_default }; }) };
  } catch (e) {
    await deps().speicher.protokoll({ user_id: userId, art: 'probe', anfragen: cl.zaehler.anfragen, bremse_429: cl.zaehler.bremse429, ok: false, fehler: e.message, dauer_ms: deps().jetzt() - t0 });
    throw alsAntwort(e);
  }
}

/* ── Vorschau ─────────────────────────────────────────────────────────── */
async function objekt(userId, objectId) {
  const o = await deps().speicher.objektHolen(userId, objectId);
  if (!o) throw fehler(404, 'objekt_nicht_gefunden', 'Objekt nicht gefunden');
  return o;
}
function planOptionen(opt) { opt = opt || {}; return { platzhalterNamen: !!opt.platzhalter_namen, faelligTag: opt.faellig_tag }; }

async function vorschau(userId, objectId, opt) {
  const o = await objekt(userId, objectId);
  const v = await deps().speicher.verknuepfung(userId, objectId);
  const plan = mapping.nachVivi(o.data || {}, planOptionen(opt));
  return {
    status: v ? v.anlage_status : null,
    gesperrt: !!(v && (v.anlage_status === 'fertig' || v.herkunft === 'zugeordnet')),
    ok: plan.ok, fehlt: plan.fehlt, hinweise: plan.hinweise, vorschau: plan.vorschau,
    anzahl: { einheiten: plan.einheiten.length, mietverhaeltnisse: plan.einheiten.filter(function (e) { return e.miete; }).length, darlehen: plan.darlehen.length },
    nutzlast: { projekt: plan.projekt, einheiten: plan.einheiten.map(function (e) { return { name: e.name, einheit: e.miete ? null : e.einheit, mietverhaeltnis: e.miete || null }; }), darlehen: plan.darlehen.map(function (d) { return d.body; }) }
  };
}

/* ── Einmal anlegen ───────────────────────────────────────────────────── */
function gleicheAnschrift(p, projekt) {
  const n = function (s) { return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' '); };
  return n(p.street) === n(projekt.street) && n(p.house_number) === n(projekt.house_number) && n(p.postal_code) === n(projekt.postal_code)
    && String(p.purchase_date || '').slice(0, 10) === String(projekt.purchase_date || '').slice(0, 10);
}

async function anlegen(userId, objectId, opt) {
  opt = opt || {};
  const o = await objekt(userId, objectId);
  const plan = mapping.nachVivi(o.data || {}, planOptionen(opt));
  if (!plan.ok) throw fehler(422, 'angaben_fehlen', 'Für ViVi fehlen Angaben: ' + plan.fehlt.map(function (f) { return f.text; }).join(', '), { fehlt: plan.fehlt });
  const tok = await token(userId);
  const sp = deps().speicher;
  const anspruch = await sp.beanspruchen(userId, objectId, opt.account_id || null);
  if (!anspruch) {
    const v = await sp.verknuepfung(userId, objectId);
    if (v && v.anlage_status === 'laeuft') throw fehler(409, 'laeuft', 'Die Übertragung läuft gerade. Bitte einen Moment warten.');
    throw fehler(409, 'bereits_angelegt', 'Dieses Objekt ist schon mit ViVi verknüpft. Es wird nur einmal angelegt.');
  }
  const z = anspruch.zeile;
  const ids = (z.vivi_ids && typeof z.vivi_ids === 'object') ? JSON.parse(JSON.stringify(z.vivi_ids)) : {};
  const q = abfrage(z.vivi_account_id || opt.account_id || null);
  const cl = deps().client(tok, { maxWarten: 65000 });
  const t0 = deps().jetzt();
  const gezaehlt = { projekt: 0, einheiten: 0, mietverhaeltnisse: 0, darlehen: 0, uebernommen: 0 };
  const merken = function () { return sp.idsSpeichern(objectId, ids, ids.projekt || null); };
  try {
    /* 1 · Objekt */
    if (!ids.projekt) {
      let gefunden = null;
      if (anspruch.fortsetzen) gefunden = liste(await cl.get('/projects', q)).find(function (p) { return gleicheAnschrift(p, plan.projekt); }) || null;
      if (gefunden) { ids.projekt = gefunden.id; ids.auto_einheit = (gefunden.units && gefunden.units[0] && gefunden.units[0].id) || null; gezaehlt.uebernommen++; }
      else {
        const r = await cl.post('/projects', plan.projekt, q);
        ids.projekt = r && r.data && r.data.id;
        if (!ids.projekt) throw fehler(502, 'antwort_ohne_id', 'ViVi hat das Objekt ohne ID bestätigt.');
        ids.auto_einheit = (r.data.units && r.data.units[0] && r.data.units[0].id) || null;
        gezaehlt.projekt++;
      }
      await merken();
    }
    const P = '/projects/' + encodeURIComponent(String(ids.projekt));

    /* 2 · Einheiten und Mietverhaeltnisse. ViVi legt mit dem Objekt eine Einheit an (units: 1). Sie gehoert der
       ersten vermieteten Einheit (das Mietverhaeltnis setzt dabei Name, Flaeche, Etage), sonst der ersten. */
    ids.einheiten = ids.einheiten || {};
    if (!ids.auto_fuer) ids.auto_fuer = ((plan.einheiten.find(function (e) { return e.miete; }) || plan.einheiten[0]) || {}).schluessel || null;
    let vorhUnits = null, vorhRentals = null;
    if (anspruch.fortsetzen) { vorhUnits = liste(await cl.get(P + '/units', q)); vorhRentals = liste(await cl.get(P + '/rental-units', q)); }
    for (const e of plan.einheiten) {
      const g = ids.einheiten[e.schluessel] || { index: e.index, nr: e.nr, name: e.name };
      if (g.fertig) continue;
      if (e.schluessel === ids.auto_fuer && ids.auto_einheit && !g.unit_id) g.unit_id = ids.auto_einheit;
      if (e.miete) {
        if (!g.rental_id) {
          /* Fortsetzen: kam das Mietverhaeltnis doch an? Ueber die Einheit (gemerkt, sonst gleicher Name) */
          const uid = g.unit_id || (vorhUnits && (vorhUnits.find(function (u) { return u.identifier === e.name; }) || {}).id) || null;
          const da = vorhRentals && vorhRentals.find(function (r) { return uid ? String(r.unit_id) === String(uid) : (r.unit && r.unit.identifier === e.name); });
          if (da) { g.rental_id = da.id; g.unit_id = da.unit_id || g.unit_id; gezaehlt.uebernommen++; }
          else {
            const rumpf = Object.assign({}, e.miete);
            if (g.unit_id) rumpf.unit_id = String(g.unit_id);
            const r = await cl.post(P + '/rental-units', rumpf, q);
            g.rental_id = r && r.data && r.data.id;
            g.unit_id = (r && r.data && r.data.unit_id) || g.unit_id;
            if (!g.rental_id) throw fehler(502, 'antwort_ohne_id', 'ViVi hat das Mietverhältnis ohne ID bestätigt.');
            gezaehlt.mietverhaeltnisse++;
          }
        }
      } else if (!g.unit_id) {
        const da = vorhUnits && vorhUnits.find(function (u) { return u.identifier === e.name; });
        if (da) { g.unit_id = da.id; gezaehlt.uebernommen++; }
        else {
          const r = await cl.post(P + '/units', e.einheit, q);
          g.unit_id = r && r.data && r.data.id;
          if (!g.unit_id) throw fehler(502, 'antwort_ohne_id', 'ViVi hat die Einheit ohne ID bestätigt.');
          gezaehlt.einheiten++;
        }
      }
      g.fertig = true;
      ids.einheiten[e.schluessel] = g;
      await merken();
    }

    /* 3 · Darlehen */
    ids.darlehen = ids.darlehen || {};
    let vorhFin = null;
    if (anspruch.fortsetzen && plan.darlehen.some(function (d) { return !ids.darlehen[d.schluessel]; })) vorhFin = liste(await cl.get(P + '/financings', q));
    for (const d of plan.darlehen) {
      if (ids.darlehen[d.schluessel]) continue;
      const da = vorhFin && vorhFin.find(function (f) { return f.name === d.body.name && Number(f.financing_amount) === Number(d.body.financing_amount); });
      if (da) { ids.darlehen[d.schluessel] = da.id; gezaehlt.uebernommen++; }
      else {
        const r = await cl.post(P + '/financings', d.body, q);
        if (!(r && r.data && r.data.id != null)) throw fehler(502, 'antwort_ohne_id', 'ViVi hat das Darlehen ohne ID bestätigt.');
        ids.darlehen[d.schluessel] = r.data.id;
        gezaehlt.darlehen++;
      }
      await merken();
    }

    await sp.statusSetzen(objectId, 'fertig', null);
    await sp.protokoll({ user_id: userId, object_id: objectId, art: 'anlegen', anfragen: cl.zaehler.anfragen, ok: true, dauer_ms: deps().jetzt() - t0 });
    return { ok: true, vivi_objekt_id: ids.projekt, fortgesetzt: anspruch.fortsetzen, angelegt: gezaehlt, hinweise: plan.hinweise };
  } catch (e) {
    const a = alsAntwort(e);
    try { await merken(); } catch (x) { /* IDs so weit wie moeglich halten */ }
    await sp.statusSetzen(objectId, 'abgebrochen', a.message);
    await sp.protokoll({ user_id: userId, object_id: objectId, art: 'anlegen', anfragen: cl.zaehler.anfragen, bremse_429: cl.zaehler.bremse429, ok: false, fehler: a.message, dauer_ms: deps().jetzt() - t0 });
    a.fortsetzbar = true;
    a.message = a.message + ' Die Übertragung ist unterbrochen. Ein neuer Versuch setzt an der letzten Stelle fort.';
    throw a;
  }
}

/* Ein vorhandenes ViVi-Objekt verknuepfen. Nur lesend: es wird geprueft, dass es das Objekt gibt. */
async function zuordnen(userId, objectId, viviObjektId, accountId) {
  if (!viviObjektId) throw fehler(400, 'id_fehlt', 'ViVi-Objekt fehlt');
  await objekt(userId, objectId);
  const cl = deps().client(await token(userId));
  try { await cl.get('/projects/' + encodeURIComponent(String(viviObjektId)), abfrage(accountId)); }
  catch (e) { throw alsAntwort(e); }
  const z = await deps().speicher.zuordnen(userId, objectId, viviObjektId, accountId);
  if (!z) throw fehler(409, 'bereits_verknuepft', 'Dieses Objekt ist schon mit ViVi verknüpft.');
  return { ok: true, vivi_objekt_id: String(viviObjektId) };
}

async function projekte(userId, accountId) {
  const cl = deps().client(await token(userId));
  try {
    return { projekte: liste(await cl.get('/projects', abfrage(accountId))).map(function (p) {
      return { id: p.id, name: p.name, type: p.type, street: p.street, house_number: p.house_number, postal_code: p.postal_code, city: p.city };
    }) };
  } catch (e) { throw alsAntwort(e); }
}

/* ── Lesen ────────────────────────────────────────────────────────────── */
function mitEinheiten(v, daten) {
  const e = v && v.vivi_ids && v.vivi_ids.einheiten;
  if (e && typeof e === 'object' && Object.keys(e).length) return Object.keys(e).some(function (k) { return e[k] && e[k].index != null; });
  return mapping.einheitenListe(daten || {}).length > 0;
}

async function abrufen(userId, objectId, opt) {
  opt = opt || {};
  const sp = deps().speicher;
  const v = await sp.verknuepfung(userId, objectId);
  if (!v || v.anlage_status !== 'fertig' || !v.vivi_objekt_id) throw fehler(409, 'nicht_verknuepft', 'Dieses Objekt ist nicht mit ViVi verknüpft.');
  const o = await objekt(userId, objectId);
  const cl = opt.client || deps().client(await token(userId));
  const vorher = cl.zaehler.anfragen;
  const t0 = deps().jetzt();
  const q = abfrage(v.vivi_account_id);
  const P = '/projects/' + encodeURIComponent(String(v.vivi_objekt_id));
  try {
    const projekt = (await cl.get(P, q) || {}).data || {};
    const einheiten = Array.isArray(projekt.units) ? projekt.units : liste(await cl.get(P + '/units', q));
    const miet = liste(await cl.get(P + '/rental-units', q));
    const darl = liste(await cl.get(P + '/financings', q));
    const plan = darl.length ? (await cl.get(P + '/financing-schedule', q)) : null;
    const erg = mapping.ausVivi({ projekt: projekt, einheiten: einheiten, mietverhaeltnisse: miet, darlehen: darl, tilgungsplan: plan },
      { vivi_ids: v.vivi_ids || {}, mitEinheiten: mitEinheiten(v, o.data), objart: o.data && o.data.objart, jetzt: deps().jetzt() });
    await sp.werteSchreiben(objectId, erg.felder, erg.info);
    await sp.protokoll({ user_id: userId, object_id: objectId, art: opt.takt ? 'takt' : 'abruf', anfragen: cl.zaehler.anfragen - vorher, ok: true, dauer_ms: deps().jetzt() - t0 });
    return { ok: true, felder: erg.felder, info: erg.info, anzahl: Object.keys(erg.felder).length };
  } catch (e) {
    const a = alsAntwort(e);
    await sp.abrufFehler(objectId, a.message);
    await sp.protokoll({ user_id: userId, object_id: objectId, art: opt.takt ? 'takt' : 'abruf', anfragen: cl.zaehler.anfragen - vorher, bremse_429: cl.zaehler.bremse429, ok: false, fehler: a.message, dauer_ms: deps().jetzt() - t0 });
    throw a;
  }
}

/** Was der Browser braucht: Status und die zuletzt gelesenen Werte. Schickt nichts an ViVi. */
async function werte(userId, objectId) {
  const v = await deps().speicher.verknuepfung(userId, objectId);
  if (!v) return { verknuepft: false, status: null };
  const zeilen = v.anlage_status === 'fertig' ? await deps().speicher.werteLesen(objectId) : [];
  const felder = {}, info = {};
  zeilen.forEach(function (z) {
    if (z.jahr) return;   /* Steuerjahre: Paket V4 */
    if (z.feld.indexOf('_info.') === 0) info[z.feld.slice(6)] = z.wert;
    else felder[z.feld] = { wert: z.wert, quelle: z.vivi_quelle, gelesen_am: z.gelesen_am };
  });
  return {
    verknuepft: v.anlage_status === 'fertig', status: v.anlage_status, herkunft: v.herkunft,
    vivi_objekt_id: v.vivi_objekt_id, letzter_abruf: v.letzter_abruf, letzter_fehler: v.letzter_fehler,
    felder: felder, info: info
  };
}

async function loesen(userId, objectId) {
  const ok = await deps().speicher.loesen(userId, objectId);
  if (!ok) throw fehler(404, 'nicht_verknuepft', 'Dieses Objekt ist nicht mit ViVi verknüpft.');
  return { ok: true };
}

/* ── Takt viviAbruf (utils/taktSperre.js, Schluessel 11) ─────────────── */
async function taktLauf() {
  const sp = deps().speicher;
  const zeilen = await sp.faelligeAbrufe(TAKT_STUNDEN, TAKT_GRENZE);
  const je = {};
  zeilen.forEach(function (z) { (je[z.user_id] = je[z.user_id] || []).push(z.object_id); });
  const stand = { nutzer: 0, objekte: 0, fehler: 0, bremse: 0 };
  for (const userId of Object.keys(je)) {
    const t = await deps().creds.getSecret(userId, ANBIETER);
    if (!t) continue;
    stand.nutzer++;
    const cl = deps().client(t, { maxWarten: 65000 });
    for (const objectId of je[userId]) {
      try { await abrufen(userId, objectId, { client: cl, takt: true }); stand.objekte++; }
      catch (e) {
        stand.fehler++;
        if (e && (e.code === 'bremse_429' || e.code === 'bremse_lokal' || e.status === 502 && e.code === 'nicht_berechtigt')) { stand.bremse++; break; }
      }
      await deps().schlafen(PAUSE_MS);
    }
  }
  return stand;
}

function starteTakt() {
  const _ts = require('../../utils/taktSperre');
  const _viviAbruf = _ts.takt('viviAbruf', function () {
    return taktLauf().then(function (s) { if (s.objekte || s.fehler) console.log('[vivi] Takt: ' + s.objekte + ' Objekte gelesen, ' + s.fehler + ' Fehler, ' + s.nutzer + ' Verbindungen'); })
      .catch(function (e) { console.error('[vivi] Takt fehlgeschlagen:', e.message); });
  });
  setTimeout(_viviAbruf, 12 * 60 * 1000);
  setInterval(_viviAbruf, 6 * 60 * 60 * 1000);
}

module.exports = {
  ANBIETER, verbindungMeta, verbindungSpeichern, verbindungLoeschen, probe, vorschau, anlegen, zuordnen, projekte,
  abrufen, werte, loesen, taktLauf, starteTakt, _setzeDeps, alsAntwort
};
