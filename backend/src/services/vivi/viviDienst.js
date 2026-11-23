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
const steuer = require('./viviSteuer');   /* v4020 · Paket V4: Steuerjahre, nach Einstellung des Nutzers (aus, Vorschlag, automatisch) */

const ANBIETER = 'vivi';
const TAKT_STUNDEN = 20;          /* ein Objekt wird hoechstens alle 20 h vom Takt gelesen, der Takt laeuft alle 6 h */
const TAKT_GRENZE = 500;          /* Objekte je Taktlauf */
const PAUSE_MS = 1500;            /* zwischen zwei Objekten im Takt */

const STANDARD = {
  get speicher() { return require('./viviSpeicher'); },
  get creds() { return require('../providerCredentialsService'); },
  get objekte() { return require('../objectService'); },   /* v4050 · nur der Import legt ein Objekt an */
  client: function (token, opt) { return viviClient.erzeugen(token, opt); },
  jetzt: function () { return Date.now(); },
  /* v3951 · Testbetrieb: solange 'vivi' als Vorschau-Funktion gefuehrt und nicht fuer alle freigegeben ist */
  testbetrieb: async function () {
    const vs = require('../vorschau');
    if (!vs.eintrag('vivi')) return false;
    try { return !(await vs.fuerAlle()).has('vivi'); } catch (e) { return true; }
  },
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
/* v3951 · Im Testbetrieb sind Musteranschrift und Platzhalter-Mieter vorgegeben (an), solange der Aufrufer sie nicht
   ausdruecklich auf false setzt. Die Hausnummer der Musteranschrift ist die laufende Nummer des Objekts
   (2026-1157 -> Musterstraße 1157), damit die Demo-Objekte in ViVi unterscheidbar bleiben. */
async function planOptionen(opt, daten) {
  opt = opt || {};
  const test = await deps().testbetrieb();
  const vorgabe = function (v) { return v === undefined || v === null ? test : !!v; };
  const nr = String((daten && daten._obj_seq) || '').split('-').pop().replace(/\D/g, '').replace(/^0+/, '') || '1';
  /* v4035 · Marcel 23.11.2026 („können wir die nicht richtig benennen?“): die echte Anschrift ist die Vorgabe, auch im
     Testbetrieb. Die Musteranschrift gibt es nur noch, wenn der Haken im Anlegen-Fenster ausdrücklich gesetzt wird. */
  return { platzhalterNamen: vorgabe(opt.platzhalter_namen), musterAnschrift: opt.muster_anschrift === undefined || opt.muster_anschrift === null ? false : !!opt.muster_anschrift, musterNr: nr, faelligTag: opt.faellig_tag, testbetrieb: test };
}
function optionenAntwort(po) { return { platzhalter_namen: po.platzhalterNamen, muster_anschrift: po.musterAnschrift, testbetrieb: po.testbetrieb }; }

async function vorschau(userId, objectId, opt) {
  const o = await objekt(userId, objectId);
  const v = await deps().speicher.verknuepfung(userId, objectId);
  const po = await planOptionen(opt, o.data);
  const plan = mapping.nachVivi(o.data || {}, po);
  return {
    optionen: optionenAntwort(po),
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

/* v4210 · Mieterhoehungen eines Vertrags nacheinander als Mietaenderung (POST …/rent-changes ueber die freigegebene Methode
   mietaenderungAnlegen). z.aend zaehlt die schon gesendeten, ein Fortsetzen schickt keine doppelt. */
async function aenderungenSenden(cl, P, z, liste, q, gezaehlt, merke) {
  const L = Array.isArray(liste) ? liste : [];
  for (let i = z.aend || 0; i < L.length; i++) {
    await cl.mietaenderungAnlegen(P + '/rental-units/' + encodeURIComponent(String(z.rental_id)) + '/rent-changes', L[i], q);
    z.aend = i + 1;
    gezaehlt.mietaenderungen = (gezaehlt.mietaenderungen || 0) + 1;
    await merke();
  }
}

async function anlegen(userId, objectId, opt) {
  opt = opt || {};
  const o = await objekt(userId, objectId);
  const po = await planOptionen(opt, o.data);
  const plan = mapping.nachVivi(o.data || {}, po);
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
  /* v3951 · ein Fortsetzen bleibt bei der Anschrift des ersten Laufs, sonst faende gleicheAnschrift() das Objekt nicht */
  if (ids.muster_anschrift === undefined) ids.muster_anschrift = po.musterAnschrift;
  else if (ids.muster_anschrift !== po.musterAnschrift) { po.musterAnschrift = ids.muster_anschrift; Object.assign(plan.projekt, mapping.nachVivi(o.data || {}, po).projekt); }
  const q = abfrage(z.vivi_account_id || opt.account_id || null);
  const cl = deps().client(tok, { maxWarten: 65000 });
  const t0 = deps().jetzt();
  const gezaehlt = { projekt: 0, einheiten: 0, mietverhaeltnisse: 0, darlehen: 0, uebernommen: 0, angepasst: 0 };
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
    if (!ids.auto_fuer) ids.auto_fuer = ((plan.einheiten.find(function (e) { return e.miete || (e.fruehere && e.fruehere.length); }) || plan.einheiten[0]) || {}).schluessel || null;
    let vorhUnits = null, vorhRentals = null;
    if (anspruch.fortsetzen) { vorhUnits = liste(await cl.get(P + '/units', q)); vorhRentals = liste(await cl.get(P + '/rental-units', q)); }
    for (const e of plan.einheiten) {
      const g = ids.einheiten[e.schluessel] || { index: e.index, nr: e.nr, name: e.name };
      if (g.fertig) continue;
      if (e.schluessel === ids.auto_fuer && ids.auto_einheit && !g.unit_id) g.unit_id = ids.auto_einheit;
      /* v4210 · fruehere Vertraege zuerst (aeltester zuerst), damit der heutige Vertrag als letzter laufend bleibt.
         Je Vertrag danach seine Mieterhoehungen als Mietaenderung mit Stichtag. Fortschritt in g.frueher[k] / g.aend. */
      if (e.fruehere && e.fruehere.length) {
        g.frueher = g.frueher || [];
        for (let k = 0; k < e.fruehere.length; k++) {
          const fz = g.frueher[k] || {};
          if (fz.fertig) continue;
          const v = e.fruehere[k];
          if (!fz.rental_id) {
            const da = vorhRentals && vorhRentals.find(function (r) { return String(r.rental_start || '').slice(0, 10) === v.rental_start && (!g.unit_id || String(r.unit_id) === String(g.unit_id)); });
            if (da) { fz.rental_id = da.id; g.unit_id = da.unit_id || g.unit_id; gezaehlt.uebernommen++; }
            else {
              const rumpf = Object.assign({}, v); delete rumpf.aenderungen;
              if (g.unit_id) rumpf.unit_id = String(g.unit_id);
              const r = await cl.post(P + '/rental-units', rumpf, q);
              fz.rental_id = r && r.data && r.data.id;
              g.unit_id = (r && r.data && r.data.unit_id) || g.unit_id;
              if (!fz.rental_id) throw fehler(502, 'antwort_ohne_id', 'ViVi hat das frühere Mietverhältnis ohne ID bestätigt.');
              gezaehlt.mietverhaeltnisse++;
            }
            g.frueher[k] = fz; ids.einheiten[e.schluessel] = g; await merken();
          }
          fz.aend = fz.aend || 0;
          await aenderungenSenden(cl, P, fz, v.aenderungen, q, gezaehlt, function () { g.frueher[k] = fz; ids.einheiten[e.schluessel] = g; return merken(); });
          fz.fertig = true; g.frueher[k] = fz; ids.einheiten[e.schluessel] = g; await merken();
        }
      }
      if (e.miete) {
        if (!g.rental_id) {
          /* Fortsetzen: kam das Mietverhaeltnis doch an? Ueber die Einheit (gemerkt, sonst gleicher Name) */
          const uid = g.unit_id || (vorhUnits && (vorhUnits.find(function (u) { return u.identifier === e.name; }) || {}).id) || null;
          const da = vorhRentals && vorhRentals.find(function (r) { return (uid ? String(r.unit_id) === String(uid) : (r.unit && r.unit.identifier === e.name)) && (!r.rental_start || String(r.rental_start).slice(0, 10) === e.miete.rental_start); });   /* v4210 · mit frueheren Vertraegen auf derselben Einheit: nach Mietbeginn */
          if (da) { g.rental_id = da.id; g.unit_id = da.unit_id || g.unit_id; gezaehlt.uebernommen++; }
          else {
            const rumpf = Object.assign({}, e.miete); delete rumpf.aenderungen;   /* v4210 · die Erhoehungen gehen danach als Mietaenderung */
            if (g.unit_id) rumpf.unit_id = String(g.unit_id);
            const r = await cl.post(P + '/rental-units', rumpf, q);
            g.rental_id = r && r.data && r.data.id;
            g.unit_id = (r && r.data && r.data.unit_id) || g.unit_id;
            if (!g.rental_id) throw fehler(502, 'antwort_ohne_id', 'ViVi hat das Mietverhältnis ohne ID bestätigt.');
            gezaehlt.mietverhaeltnisse++;
          }
          ids.einheiten[e.schluessel] = g; await merken();
        }
        /* v4210 · Mieterhoehungen des heutigen Vertrags als Mietaenderung mit Stichtag */
        const gz = { rental_id: g.rental_id, aend: g.aend || 0 };
        await aenderungenSenden(cl, P, gz, e.miete.aenderungen, q, gezaehlt, function () { g.aend = gz.aend; ids.einheiten[e.schluessel] = g; return merken(); });
        g.aend = gz.aend;
      } else if (e.fruehere && e.fruehere.length) {
        /* v4210 · heute leer, aber mit frueheren Vertraegen: die Einheit kam mit dem ersten frueheren Vertrag */
      } else if (g.unit_id && String(g.unit_id) === String(ids.auto_einheit) && !ids.auto_angepasst) {
        /* v3965 · die automatische Einheit ist leer: einmal benennen (Name, Art, Flaeche, Etage), sonst bliebe sie
           „Einheit 1“ ohne Flaeche. Gemerkt in ids.auto_angepasst, ein Fortsetzen schickt es nicht noch einmal. */
        await cl.einheitBeimAnlegen(P + '/units/' + encodeURIComponent(String(g.unit_id)), e.einheit);
        ids.auto_angepasst = true;
        gezaehlt.angepasst++;
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
async function zuordnen(userId, objectId, viviObjektId, accountId, opt) {
  opt = opt || {};
  if (!viviObjektId) throw fehler(400, 'id_fehlt', 'ViVi-Objekt fehlt');
  await objekt(userId, objectId);
  const cl = deps().client(await token(userId));
  try { await cl.get('/projects/' + encodeURIComponent(String(viviObjektId)), abfrage(accountId)); }
  catch (e) { throw alsAntwort(e); }
  const z = await deps().speicher.zuordnen(userId, objectId, viviObjektId, accountId);
  if (!z) throw fehler(409, 'bereits_verknuepft', 'Dieses Objekt ist schon mit ViVi verknüpft.');
  /* v3951 · Im Testbetrieb tragen die ViVi-Objekte Musteranschriften: die Anschrift wird dann nicht zurueckgelesen */
  const muster = opt.muster_anschrift === undefined || opt.muster_anschrift === null ? await deps().testbetrieb() : !!opt.muster_anschrift;
  if (muster) await deps().speicher.idsSpeichern(objectId, Object.assign({}, z.vivi_ids || {}, { muster_anschrift: true }), null);
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

/* v3996 · fuehrt die Objektliste des Kontos das Objekt nicht mehr? Nur ein eindeutiges Ja zaehlt: Liste gelesen,
   keine weitere Seite angekuendigt, Objekt nicht darin. Jeder Fehler beim Lesen der Liste heisst „unklar“ = false. */
async function inViviGeloescht(cl, v, q) {
  try {
    const roh = await cl.get('/projects', q);
    if (!roh || !Array.isArray(roh.data)) return false;
    const m = roh.meta || {}, l = roh.links || {};
    if (l.next || (m.last_page != null && +m.last_page > 1) || (m.next_cursor != null && m.next_cursor !== '')) return false;
    return !roh.data.some(function (p) { return p && String(p.id) === String(v.vivi_objekt_id); });
  } catch (e) { return false; }
}

/* v4037 · Uebergang des Objekts: wirtschaftlicher Uebergang, sonst Kaufdatum, sonst Stichtag des Ankauf-Stands */
function uebergangVon(d) {
  d = d || {};
  const k = [d.wirtschaftlicher_uebergang, d.kaufdat, d._ankauf && d._ankauf.stichtag].map(function (x) { return mapping.isoDatum(x); }).filter(Boolean);
  return k[0] || null;
}
/* v4037 · Mietzahlungen je Kalenderjahr ab dem Uebergang bis Ende Vorjahr (GET /rental-payments, nur Miete, hoechstens
   5 Seiten): gezahlt und erwartet, warm wie ViVi sie fuehrt. */
async function gezahltJeJahr(cl, q, projektId, ab, heute) {
  if (!ab) return null;
  const bis = (+heute.slice(0, 4) - 1) + '-12-31';
  if (ab > bis) return null;
  /* v4037 · ViVi fuehrt je Sollstellung expected_total und actual_total (warm, mit Stellplatz). Gemessen 23.11.2026 an
     2026-1183: period JJJJ-MM, status paid/pending. Gezaehlt wird die Periode, nicht das Zahlungsdatum. */
  const out = { gezahlt: {}, soll: {} };
  for (let seite = 1; seite <= 5; seite++) {
    const roh = await cl.get('/rental-payments', Object.assign({}, q, { project_id: projektId, date_from: ab, date_to: bis, type: 'rent', per_page: 100, page: seite }));
    const L = liste(roh);
    L.forEach(function (x) {
      const per = /^(\d{4})-\d{2}/.exec(String((x && (x.period || x.due_date)) || '')); if (!per) return;
      const j = per[1], ist = mapping.zahl(x.actual_total), soll = mapping.zahl(x.expected_total);
      if (ist != null) out.gezahlt[j] = Math.round(((out.gezahlt[j] || 0) + ist) * 100) / 100;
      if (soll != null) out.soll[j] = Math.round(((out.soll[j] || 0) + soll) * 100) / 100;
    });
    const m = (roh && roh.meta) || {};
    if (!(m.last_page > seite) || !L.length) break;
  }
  return out;
}
/* v4037 · Soll warm je Jahr (Kaltmiete plus Stellplatz plus Vorauszahlung laut Mietverlauf) zum Vergleich mit gezahlt */
function sollWarmJeJahr(miet, verlauf, ab, heute) {
  if (!ab) return null;
  const nk = function (r, h, iso) {
    if (h && h.start_state && mapping.zahl(h.start_state.utility) != null) {
      let u = mapping.zahl(h.start_state.utility);
      (Array.isArray(h.rent_changes) ? h.rent_changes : []).filter(function (c) { return c && (!c.status || c.status === 'active') && mapping.isoDatum(c.effective_date) && mapping.isoDatum(c.effective_date) <= iso && mapping.zahl(c.new_utility_costs) != null; })
        .sort(function (x, y) { return mapping.isoDatum(x.effective_date) < mapping.isoDatum(y.effective_date) ? -1 : 1; }).forEach(function (c) { u = mapping.zahl(c.new_utility_costs); });
      return u;
    }
    return mapping.zahl(r.monthly_utility_costs) || 0;
  };
  const out = {}, j0 = +ab.slice(0, 4), m0 = +ab.slice(5, 7), jh = +heute.slice(0, 4);
  for (let j = j0; j < jh; j++) {
    let s = 0;
    for (let mo = (j === j0 ? m0 : 1); mo <= 12; mo++) {
      const iso = j + '-' + String(mo).padStart(2, '0') + '-01';
      (miet || []).forEach(function (r) { const k = mapping.mieteImMonat(r, verlauf[r.id], iso); if (k != null) s += k + nk(r, verlauf[r.id], iso); });
    }
    out[String(j)] = Math.round(s * 100) / 100;
  }
  return out;
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
    let projekt;
    try { projekt = (await cl.get(P, q) || {}).data || {}; }
    catch (e) {
      /* v3996 · Marcel 23.11.2026: „wenn dort ein Objekt gelöscht ist und wir das nicht mehr abrufen können, dass wir das
         rausnehmen“. Nur wenn ViVi das Objekt mit 404 ablehnt UND die vollstaendige Objektliste desselben Kontos es nicht
         mehr fuehrt (anderes Konto, Rechte oder eine weitere Seite der Liste loesen nie). Die Werte bleiben im Objekt. */
      if (e && e.code === 'nicht_gefunden' && await inViviGeloescht(cl, v, q)) {
        await sp.loesen(userId, objectId);
        await sp.protokoll({ user_id: userId, object_id: objectId, art: opt.takt ? 'takt' : 'abruf', anfragen: cl.zaehler.anfragen - vorher, ok: false, fehler: 'in ViVi geloescht, Verknuepfung geloest', dauer_ms: deps().jetzt() - t0 });
        const g = fehler(410, 'in_vivi_geloescht', 'Dieses Objekt gibt es in ViVi nicht mehr. Die Verknüpfung ist gelöst, die Werte bleiben in DealPilot als deine Angaben.');
        g.geloest = true;
        throw g;
      }
      throw e;
    }
    const einheiten = Array.isArray(projekt.units) ? projekt.units : liste(await cl.get(P + '/units', q));
    const miet = liste(await cl.get(P + '/rental-units', q));
    const darl = liste(await cl.get(P + '/financings', q));
    const plan = darl.length ? (await cl.get(P + '/financing-schedule', q)) : null;
    /* v3966 · Mietverlauf je laufendem Mietverhaeltnis (nur GET): unterscheidet Mieterhoehung und NK-Anpassung.
       Ein Fehler hier kostet nur die Unterscheidung, die Anfragebremse beendet die Runde wie immer. */
    const mietverlauf = {};
    const heuteIso = new Date(deps().jetzt()).toISOString().slice(0, 10);
    const uebergang = uebergangVon(o.data);   /* v4037 */
    for (const r of miet) {
      /* v4037 · auch beendete Mietverhaeltnisse seit dem Uebergang: ihr Verlauf zaehlt fuer die Ist-Miete vergangener Jahre */
      if (!r || r.id == null || (r.rental_end && String(r.rental_end).slice(0, 10) < (uebergang || heuteIso))) continue;
      try { mietverlauf[r.id] = ((await cl.get(P + '/rental-units/' + encodeURIComponent(String(r.id)) + '/rent-history', q)) || {}).data || null; }
      catch (e) { if (e && (e.code === 'bremse_429' || e.code === 'bremse_lokal' || e.code === 'nicht_berechtigt')) throw e; }
    }
    const erg = mapping.ausVivi({ projekt: projekt, einheiten: einheiten, mietverhaeltnisse: miet, darlehen: darl, tilgungsplan: plan, mietverlauf: mietverlauf },
      { vivi_ids: v.vivi_ids || {}, mitEinheiten: mitEinheiten(v, o.data), objart: o.data && o.data.objart, jetzt: deps().jetzt(),
        musterAnschrift: !!(v.vivi_ids && v.vivi_ids.muster_anschrift), uebergang: uebergang,
        dpMietzeiten: (function () { try { return mapping.dpMietzeiten(o.data || {}); } catch (e) { return null; } })() });   /* v4210 · Abdeckung */
    /* v4037 · gezahlte Mieten je Jahr (warm, Hinweis im Jahresabgleich). Ein Fehler kostet nur den Hinweis. */
    if (erg.info && erg.info.ist_jahre && Object.keys(erg.info.ist_jahre.summe || {}).length) {
      let gz = null;
      try { gz = await gezahltJeJahr(cl, q, v.vivi_objekt_id, uebergang, heuteIso); }
      catch (e) { if (e && (e.code === 'bremse_429' || e.code === 'bremse_lokal')) throw e; }
      if (gz && Object.keys(gz.gezahlt).length) { erg.info.ist_jahre.gezahlt = gz.gezahlt; erg.info.ist_jahre.soll_warm = gz.soll; }
      else erg.info.ist_jahre.soll_warm = sollWarmJeJahr(miet, mietverlauf, uebergang, heuteIso);
    }
    /* v4050 · Stammdaten nur vergleichen, nie setzen: Abweichungen als Hinweis fuer den Reiter ViVi */
    if (erg.info && erg.info.stamm) {
      erg.info.stamm_aenderungen = mapping.stammAenderungen(erg.info.stamm, o.data, mitEinheiten(v, o.data) ? erg.info.stamm_einheiten : null);
      delete erg.info.stamm; delete erg.info.stamm_einheiten;
    }
    await sp.werteSchreiben(objectId, erg.felder, erg.info);
    /* v4020 · Paket V4: Steuerjahre vom Kaufjahr bis heute (nur GET). Einstellung „aus“ fragt ViVi nicht. Ein Fehler hier
       kostet nur die Steuerjahre dieses Abrufs: die Objektwerte sind schon geschrieben, die alten Steuerwerte bleiben. */
    const st = await steuerLesen(userId, objectId, o.data, projekt, cl, q, v.vivi_objekt_id);
    /* v4040 · Bewirtschaftung Ist heute aus dem letzten vollen Steuerjahr (Hausgeld, Grundsteuer). Werden mit den anderen
       Feldern gesperrt (vivi-felder.js). Faellt der Steuerabruf aus, fehlen sie bis zum naechsten Abgleich. */
    if (st && st._felder) {
      const bj = steuer.bewirtschaftungsJahr(steuer.kaufdatumAus(o.data, projekt), deps().jetzt(), st.jahre);
      const bw = bj ? steuer.bewirtschaftungAus(st._felder, bj.jahr, bj.monate) : {};
      if (Object.keys(bw).length) { await sp.werteErgaenzen(objectId, bw); Object.assign(erg.felder, bw); }
    }
    if (st) delete st._felder;
    await sp.protokoll({ user_id: userId, object_id: objectId, art: opt.takt ? 'takt' : 'abruf', anfragen: cl.zaehler.anfragen - vorher, bremse_429: !!st.bremse, ok: true, fehler: st.fehler || null, dauer_ms: deps().jetzt() - t0 });
    /* im Takt beendet die Bremse die Runde wie immer (taktLauf bricht bei bremse_429 ab) */
    if (st.bremse && opt.takt) throw fehler(429, 'bremse_429', 'ViVi bremst gerade. Die Steuerjahre folgen beim nächsten Abgleich.');
    return { ok: true, felder: erg.felder, info: erg.info, anzahl: Object.keys(erg.felder).length, steuer: st };
  } catch (e) {
    if (e && e.geloest) throw e;
    const a = alsAntwort(e);
    await sp.abrufFehler(objectId, a.message);
    await sp.protokoll({ user_id: userId, object_id: objectId, art: opt.takt ? 'takt' : 'abruf', anfragen: cl.zaehler.anfragen - vorher, bremse_429: cl.zaehler.bremse429, ok: false, fehler: a.message, dauer_ms: deps().jetzt() - t0 });
    throw a;
  }
}

/* ── v4020 · Paket V4: Steuerjahre ────────────────────────────────────── */
async function steuerEinstellung(userId) {
  let roh = null;
  try { roh = await deps().speicher.einstellungLesen(userId); } catch (e) { roh = null; }
  return steuer.einstellungNormal(roh);
}
async function steuerEinstellungSpeichern(userId, roh) {
  if (!roh || typeof roh !== 'object') throw fehler(400, 'einstellung_ungueltig', 'Einstellung fehlt.');
  if (roh.modus != null && steuer.MODI.indexOf(roh.modus) < 0) throw fehler(400, 'einstellung_ungueltig', 'Unbekannte Einstellung.');
  const n = steuer.einstellungNormal(roh);
  await deps().speicher.einstellungSchreiben(userId, n);
  return n;
}
/** Liest die Steuerjahre eines verknuepften Objekts (nur GET) und schreibt sie nach vivi_werte (jahr > 0). */
async function steuerLesen(userId, objectId, daten, projekt, cl, q, projektId) {
  const e = await steuerEinstellung(userId);
  if (e.modus === 'aus') return { modus: 'aus', jahre: [] };
  const J = steuer.jahre(steuer.kaufdatumAus(daten, projekt), deps().jetzt());
  const felder = {}, gelesen = [];
  try {
    for (const j of J) {
      const basis = (((await cl.get('/tax-overview', Object.assign({}, q, steuer.lesePfade(projektId, j)[0].abfrage))) || {}).data) || null;
      const details = {};
      for (const x of steuer.lesePfade(projektId, j, steuer.zeilenMitPosten(basis)).slice(1)) {
        const d = (((await cl.get(x.pfad, Object.assign({}, q, x.abfrage))) || {}).data) || {};
        if (d.line_details && !d.line_details.error) details[x.abfrage.line] = d.line_details;
      }
      const w = steuer.ausJahr(basis, details);
      Object.keys(w).forEach(function (sp) { felder[steuer.feldId(j, sp)] = w[sp]; });
      gelesen.push(j);
    }
  } catch (x) {
    if (gelesen.length) await deps().speicher.steuerSchreiben(objectId, gelesen, felder);
    const bremse = !!(x && (x.code === 'bremse_429' || x.code === 'bremse_lokal'));
    return { modus: e.modus, jahre: gelesen, fehler: 'Steuerjahre: ' + ((x && x.message) || 'Fehler'), bremse: bremse };
  }
  await deps().speicher.steuerSchreiben(objectId, gelesen, felder);
  return { modus: e.modus, jahre: gelesen, anzahl: Object.keys(felder).length, _felder: felder };   /* v4040 · _felder nur intern (abrufen) */
}

/** Was der Browser braucht: Status und die zuletzt gelesenen Werte. Schickt nichts an ViVi. */
async function werte(userId, objectId) {
  const v = await deps().speicher.verknuepfung(userId, objectId);
  if (!v) return { verknuepft: false, status: null };
  const zeilen = v.anlage_status === 'fertig' ? await deps().speicher.werteLesen(objectId) : [];
  const felder = {}, info = {}, steuerJahre = {};
  let steuerStand = null;
  zeilen.forEach(function (z) {
    /* v4020 · Steuerjahre (Paket V4): steuer[jahr][spalte] = { summe, zeile, label, kat, art, posten, gelesen_am } */
    if (z.jahr) {
      const sp = String(z.feld).split('.').pop();
      (steuerJahre[z.jahr] = steuerJahre[z.jahr] || {})[sp] = Object.assign({}, z.wert, { gelesen_am: z.gelesen_am });
      if (!steuerStand || new Date(z.gelesen_am) > new Date(steuerStand)) steuerStand = z.gelesen_am;
      return;
    }
    if (z.feld.indexOf('_info.') === 0) info[z.feld.slice(6)] = z.wert;
    else if (mapping.istStamm(z.feld)) return;   /* v4050 · Stammdaten aus aelteren Abrufen: nie mehr gebunden */
    else felder[z.feld] = { wert: z.wert, quelle: z.vivi_quelle, gelesen_am: z.gelesen_am };
  });
  return {
    verknuepft: v.anlage_status === 'fertig', status: v.anlage_status, herkunft: v.herkunft,
    muster_anschrift: !!(v.vivi_ids && v.vivi_ids.muster_anschrift), import: (v.vivi_ids && v.vivi_ids.import) || null,   /* v4050 · Kaufdatum des Imports, js/vivi-import.js */
    vivi_objekt_id: v.vivi_objekt_id, letzter_abruf: v.letzter_abruf, letzter_fehler: v.letzter_fehler,
    felder: felder, info: info,
    steuer: steuerJahre, steuer_stand: steuerStand, steuer_einstellung: v.anlage_status === 'fertig' ? await steuerEinstellung(userId) : null
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

/* ── v4037 · Mieterhoehung aus DealPilot in ViVi (Marcel 23.11.2026) ─────────────────────────────────────
   „Wenn DealPilot Potenzial sieht … einen Absprung, dass wir das hier anpassen und es in ViVi hinterlegt wird.“
   opt = { einheit (Index der Wohnung oder null fuers Objekt), datum (JJJJ-MM-TT), neue_miete (kalt je Monat),
           art ('558' | 'index' | '559' | 'staffel'), grund (Freitext), vorschau (true = nur ViVi rechnen lassen),
           bestaetigt (true = anlegen) }.
   Vorschau schreibt nichts. Anlegen nur mit bestaetigt === true, danach Abruf, damit die Liste in DealPilot stimmt. */
const MIET_ART = Object.freeze({ '558': ['increase', '§ 558 BGB'], index: ['index_adjustment', '§ 557b BGB'], '559': ['modernization', '§ 559 BGB'], staffel: ['stepped_rent', '§ 557a BGB'],
  /* v4042 · Nebenkosten-Vorauszahlung anpassen (§ 560 Abs. 4 BGB): dieselbe ViVi-Mietaenderung, nur new_utility_costs.
     Gleicher Weg wie die Mieterhoehung (Vorschau, Bestaetigung, Protokoll 'mietaenderung'), keine neue Schreibstelle. */
  nk: ['utility_adjustment', '§ 560 BGB'] });
async function mietverhaeltnisFuer(cl, P, q, v, einheit, heute) {
  const ids = v.vivi_ids || {};
  const gem = ids.einheiten && typeof ids.einheiten === 'object' ? ids.einheiten : {};
  let unitId = null;
  if (einheit != null && einheit !== '') {
    const k = Object.keys(gem).find(function (x) { return gem[x] && String(gem[x].index) === String(einheit); });
    unitId = k ? gem[k].unit_id : null;
    if (!unitId) {
      const units = liste(await cl.get(P + '/units', q)).filter(function (u) { return u && u.unit_type !== 'ancillary'; });
      unitId = units[+einheit] ? units[+einheit].id : null;
    }
  } else if (gem.e0 && gem.e0.unit_id) unitId = gem.e0.unit_id;
  const miet = liste(await cl.get(P + '/rental-units', q)).filter(function (r) {
    if (!r || r.id == null || (r.occupancy_type && r.occupancy_type !== 'rented')) return false;
    const b = mapping.isoDatum(r.rental_start), e = mapping.isoDatum(r.rental_end);
    return !(e && e < heute) && !(b && b > heute);
  });
  const r = unitId ? miet.find(function (x) { return String(x.unit_id) === String(unitId); }) : (miet.length === 1 ? miet[0] : null);
  if (!r) throw fehler(404, 'kein_mietverhaeltnis', einheit != null && einheit !== '' ? 'Für diese Wohnung gibt es in ViVi kein laufendes Mietverhältnis.' : 'In ViVi gibt es für dieses Objekt kein eindeutiges laufendes Mietverhältnis.');
  return r;
}
async function mieterhoehung(userId, objectId, opt) {
  opt = opt || {};
  const sp = deps().speicher;
  const v = await sp.verknuepfung(userId, objectId);
  if (!v || v.anlage_status !== 'fertig' || !v.vivi_objekt_id) throw fehler(409, 'nicht_verknuepft', 'Dieses Objekt ist nicht mit ViVi verknüpft.');
  const datum = mapping.isoDatum(opt.datum);
  const nk = String(opt.art || '') === 'nk';
  const neu = mapping.zahl(nk ? opt.neue_nk : opt.neue_miete);
  const art = MIET_ART[String(opt.art || '558')];
  if (!datum) throw fehler(400, 'datum_fehlt', nk ? 'Bitte das Datum eintragen, ab dem die neue Vorauszahlung gilt.' : 'Bitte das Datum eintragen, ab dem die neue Miete gilt.');
  if (nk ? !(neu != null && neu >= 0) : !(neu > 0)) throw fehler(400, nk ? 'nk_fehlt' : 'miete_fehlt', nk ? 'Bitte die neue Nebenkosten-Vorauszahlung je Monat eintragen.' : 'Bitte die neue Kaltmiete je Monat eintragen.');
  if (!art) throw fehler(400, 'art_ungueltig', 'Diese Art der Mietänderung gibt es nicht.');
  if (!opt.vorschau && opt.bestaetigt !== true) throw fehler(400, 'nicht_bestaetigt', nk ? 'Bitte die Anpassung der Vorauszahlung bestätigen.' : 'Bitte die Mieterhöhung bestätigen.');
  const cl = opt.client || deps().client(await token(userId));
  const vorher = cl.zaehler.anfragen, t0 = deps().jetzt();
  const q = abfrage(v.vivi_account_id);
  const P = '/projects/' + encodeURIComponent(String(v.vivi_objekt_id));
  const heute = new Date(deps().jetzt()).toISOString().slice(0, 10);
  const protokollArt = opt.vorschau ? 'mietaenderung_vorschau' : 'mietaenderung';
  try {
    const r = await mietverhaeltnisFuer(cl, P, q, v, opt.einheit, heute);
    const alt = mapping.zahl(nk ? r.monthly_utility_costs : r.rent);
    if (nk && alt != null && Math.abs(neu - alt) < 0.5) throw fehler(400, 'keine_aenderung', 'Die neue Vorauszahlung ist gleich der heutigen (' + alt + ' €).');
    if (!nk && alt != null && !(neu > alt)) throw fehler(400, 'keine_erhoehung', 'Die neue Miete liegt nicht über der heutigen (' + alt + ' €).');
    const rumpf = { effective_date: datum, adjustment_type: art[0], legal_basis: art[1],
      adjustment_reason: String(opt.grund || (nk ? 'Anpassung der Nebenkosten-Vorauszahlung aus DealPilot' : 'Mieterhöhung aus DealPilot')).slice(0, 500) };
    if (nk) rumpf.new_utility_costs = Math.round(neu * 100) / 100; else rumpf.new_rent = Math.round(neu * 100) / 100;
    const pfad = P + '/rental-units/' + encodeURIComponent(String(r.id)) + '/rent-changes';
    const antwort = opt.vorschau ? await cl.mietaenderungVorschau(pfad + '/preview', rumpf, q) : await cl.mietaenderungAnlegen(pfad, rumpf, q);
    await sp.protokoll({ user_id: userId, object_id: objectId, art: protokollArt, anfragen: cl.zaehler.anfragen - vorher, ok: true, dauer_ms: deps().jetzt() - t0 });
    const out = { ok: true, vorschau: !!opt.vorschau, mietverhaeltnis: r.id, miete_bisher: nk ? mapping.zahl(r.rent) : alt, nk_bisher: nk ? alt : mapping.zahl(r.monthly_utility_costs), rumpf: rumpf, vivi: (antwort && antwort.data) || antwort || null };
    if (!opt.vorschau) {
      try { await abrufen(userId, objectId, { client: cl }); out.abgerufen = true; } catch (e) { out.abgerufen = false; out.abruf_fehler = e && e.message; }
    }
    return out;
  } catch (e) {
    const a = e && e.status ? e : alsAntwort(e);
    await sp.protokoll({ user_id: userId, object_id: objectId, art: protokollArt, anfragen: cl.zaehler.anfragen - vorher, bremse_429: cl.zaehler.bremse429, ok: false, fehler: a.message, dauer_ms: deps().jetzt() - t0 });
    throw a;
  }
}

/* ══ v4050 · OBJEKTE AUS ViVi ÜBERNEHMEN (Import) ═════════════════════════════════════════════════════════════
   Marcel 23.11.2026: Objekte, die schon (auch seit Jahren) in ViVi verwaltet werden, als gewonnene Bestandsobjekte in
   DealPilot anlegen, rückwirkend mit eingefrorenem Ankauf, Auswahl alle oder einzeln, aus den Einstellungen.
   ViVi wird dabei NUR GELESEN (GET). Ausnahme von Regel 3 oben: der Import legt das DealPilot-Objekt an (objectService,
   derselbe Weg wie jedes neue Objekt) und ergänzt einmal die Bewirtschaftung zum Kaufdatum. Danach gilt wieder: die
   ViVi-Werte liegen in vivi_werte, der Browser setzt sie (js/vivi.js, js/vivi-import.js friert vorher den Ankauf ein). */
const IMPORT_VORSCHAU_MAX = 15;   /* je Liste hoechstens so viele ViVi-Objekte im Detail (3 Abrufe je Objekt, Bremse 50/min) */

async function importierbar(userId, accountId) {
  const cl = deps().client(await token(userId), { maxWarten: 65000 });
  const q = abfrage(accountId || null);
  const L = liste(await cl.get('/projects', q));
  const verkn = new Set(await deps().speicher.verknuepfteViviIds(userId));
  const offen = L.filter(function (p) { return p && p.id != null && !verkn.has(String(p.id)); });
  const heute = new Date(deps().jetzt()).toISOString().slice(0, 10);
  const aus = [];
  for (const p0 of offen.slice(0, IMPORT_VORSCHAU_MAX)) {
    const P = '/projects/' + encodeURIComponent(String(p0.id));
    const projekt = ((await cl.get(P, q)) || {}).data || p0;
    const units = Array.isArray(projekt.units) ? projekt.units : liste(await cl.get(P + '/units', q));
    const miet = liste(await cl.get(P + '/rental-units', q));
    const plan = mapping.importDaten({ projekt: projekt, einheiten: units, mietverhaeltnisse: miet, darlehen: [] }, { jetzt: deps().jetzt() });
    let miete = 0, vermietet = 0;
    miet.forEach(function (r) { const m = mapping.mieteImMonat(r, null, heute, true); if (m != null) { miete += m; vermietet++; } });
    aus.push({
      vivi_id: String(p0.id), name: plan.kurz.name || p0.name || '', objart: plan.objart, einheiten: plan.kurz.einheiten,
      vermietet_heute: vermietet, kaufdatum: plan.kurz.kaufdatum, kaufpreis: plan.kurz.kaufpreis,
      miete_heute: Math.round(miete * 100) / 100,
      importierbar: !!plan.objart, grund: plan.objart ? null : 'Objektart in ViVi unbekannt',
      fehlt: plan.fehlt_bewertung.map(function (x) { return x.text; })
    });
  }
  return { objekte: aus, weitere: Math.max(0, offen.length - aus.length), verknuepft: verkn.size };
}

/* Bewirtschaftung ZUM KAUF aus den gelesenen Steuerjahren: das erste volle Jahr nach dem Kaufjahr, sonst das Kaufjahr
   selbst, nicht hochgerechnet (ViVi bucht das Hausgeld oft einmal im Jahr, gemessen 1183 am 15.12.2025). */
function bewirtschaftungZumKauf(zeilen, kauf, jetzt) {
  const m = /^(\d{4})-(\d{2})/.exec(String(kauf || '')); if (!m) return null;
  const felder = {}, J = {};
  (zeilen || []).forEach(function (z) { if (z && z.jahr) { felder[z.feld] = z.wert; J[+z.jahr] = true; } });
  const heute = new Date(jetzt == null ? Date.now() : jetzt).getFullYear();
  const kj = +m[1];
  const jahr = (J[kj + 1] && kj + 1 < heute) ? kj + 1 : (J[kj] ? kj : null);
  if (jahr == null) return null;
  const bw = steuer.bewirtschaftungAus(felder, jahr, 12);
  const out = {};
  Object.keys(bw).forEach(function (k) { out[k] = String(bw[k].wert); });
  return Object.keys(out).length ? { jahr: jahr, felder: out } : null;
}

async function importieren(userId, viviId, accountId) {
  if (viviId == null || String(viviId).trim() === '') throw fehler(400, 'vivi_id_fehlt', 'Welches ViVi-Objekt soll übernommen werden?');
  viviId = String(viviId);
  const sp = deps().speicher;
  if ((await sp.verknuepfteViviIds(userId)).indexOf(viviId) >= 0) throw fehler(409, 'bereits_verknuepft', 'Dieses ViVi-Objekt ist schon mit einem DealPilot-Objekt verknüpft.');
  const cl = deps().client(await token(userId), { maxWarten: 65000 });
  const vorher = cl.zaehler.anfragen, t0 = deps().jetzt();
  const q = abfrage(accountId || null);
  const P = '/projects/' + encodeURIComponent(viviId);
  try {
    const projekt = ((await cl.get(P, q)) || {}).data || {};
    const einheiten = Array.isArray(projekt.units) ? projekt.units : liste(await cl.get(P + '/units', q));
    const miet = liste(await cl.get(P + '/rental-units', q));
    const darl = liste(await cl.get(P + '/financings', q));
    const kauf = mapping.isoDatum(projekt.purchase_date);
    const mietverlauf = {};
    for (const r of miet) {
      if (!r || r.id == null || (kauf && r.rental_end && String(r.rental_end).slice(0, 10) < kauf)) continue;
      try { mietverlauf[r.id] = ((await cl.get(P + '/rental-units/' + encodeURIComponent(String(r.id)) + '/rent-history', q)) || {}).data || null; }
      catch (e) { if (e && (e.code === 'bremse_429' || e.code === 'bremse_lokal' || e.code === 'nicht_berechtigt')) throw e; }
    }
    const plan = mapping.importDaten({ projekt: projekt, einheiten: einheiten, mietverhaeltnisse: miet, darlehen: darl, mietverlauf: mietverlauf }, { jetzt: deps().jetzt() });
    if (!plan.ok) throw fehler(422, 'objektart_unbekannt', 'Die Objektart dieses ViVi-Objekts kennt DealPilot nicht. Bitte in ViVi die Art setzen.');
    plan.vivi_ids.import.am = new Date(deps().jetzt()).toISOString();
    const neu = await deps().objekte.create(userId, { data: plan.daten, photos: [] });
    const v = await sp.importVerknuepfen(userId, neu.id, viviId, accountId || null, plan.vivi_ids);
    if (!v) {
      /* gleichzeitig schon verknuepft: das neue Objekt nicht loeschen (nie endgueltig), sondern als verloren markieren */
      await sp.objektDatenErgaenzen(userId, neu.id, { _deal_won: false, _deal_lost: true });
      throw fehler(409, 'bereits_verknuepft', 'Dieses ViVi-Objekt wurde gerade schon übernommen.');
    }
    await sp.protokoll({ user_id: userId, object_id: neu.id, art: 'import', anfragen: cl.zaehler.anfragen - vorher, ok: true, dauer_ms: deps().jetzt() - t0 });
    /* die Werte von heute und die Steuerjahre: derselbe Abgleich wie bei jedem verknuepften Objekt */
    let abgleich = { ok: true, fehler: null };
    try { await abrufen(userId, neu.id, { client: cl }); }
    catch (e) { abgleich = { ok: false, fehler: (e && e.message) || 'Abgleich fehlgeschlagen' }; }
    let bw = null;
    try {
      bw = bewirtschaftungZumKauf(await sp.werteLesen(neu.id), plan.stichtag, deps().jetzt());
      if (bw) await sp.objektDatenErgaenzen(userId, neu.id, bw.felder);
    } catch (e) { bw = null; }
    const fehlt = mapping.importFehlt(Object.assign({}, plan.daten, bw ? bw.felder : {}), plan.objart);
    return {
      ok: true, objekt_id: neu.id, seq: neu.seq_no, name: plan.kurz.name, objart: plan.objart, stichtag: plan.stichtag,
      einheiten: plan.kurz.einheiten, bewirtschaftung_jahr: bw ? bw.jahr : null, abgleich: abgleich, fehlt_bewertung: fehlt
    };
  } catch (e) {
    if (e && (e.code === 'bereits_verknuepft' || e.code === 'objektart_unbekannt')) throw e;
    const a = alsAntwort(e);
    await sp.protokoll({ user_id: userId, object_id: null, art: 'import', anfragen: cl.zaehler.anfragen - vorher, bremse_429: cl.zaehler.bremse429, ok: false, fehler: a.message, dauer_ms: deps().jetzt() - t0 });
    throw a;
  }
}

module.exports = {
  ANBIETER, verbindungMeta, verbindungSpeichern, verbindungLoeschen, probe, vorschau, anlegen, zuordnen, projekte,
  abrufen, werte, loesen, taktLauf, starteTakt, _setzeDeps, alsAntwort, planOptionen,
  steuerEinstellung, steuerEinstellungSpeichern, steuerLesen, mieterhoehung, MIET_ART, importierbar, importieren, bewirtschaftungZumKauf, IMPORT_VORSCHAU_MAX,
  _deps: deps, _token: token   /* v4130 · viviAuskunft.js (Co-Pilot, nur lesen) nutzt dieselben Abhaengigkeiten */
};
