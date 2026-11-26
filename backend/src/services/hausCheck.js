'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/hausCheck.js · v5130 KK6 · HAUS-CHECK für Eigennutzer (9,99 €), Kaufweg des Einzel-Checks
 *
 * Marcel 26.11.2026: „ja mach das“ (Bericht 9,99 €, Stripe-Preis grundsätzlich frei, Live-Preis erst beim
 * Prod-Livegang). Derselbe Weg wie der Einzel-Check (services/einzelcheck.js): Kauf ohne Konto, Token im Fragment,
 * Frist 14 Tage, Tabelle einzelcheck_kaeufe mit produkt = 'hauscheck' (Migration 134), Stripe-Preis über den
 * lookup_key dp_hauscheck_999 (nie aus dem Code), Webhook metadata.type = 'hauscheck'.
 *
 * Unterschiede zum Einzel-Check:
 *   - keine Unterlagen, kein KI-Auslesen: der Käufer gibt Objekt und Eigenkapital ein, die Rechnung (Haus-Score,
 *     Leistbarkeit, Kaufen oder mieten) macht der Kern im Browser (js/eigennutzer-kern.js). Das Netto-Einkommen
 *     verlässt den Browser NIE.
 *   - der Bericht holt Stufe 3 (Wert), den indikativen Beleihungswert nach § 4 Abs. 2 BelWertV (Eigennutzung) und
 *     das Umfeld in EINEM Lauf des mb-Dienstes (/reports/einzelcheck mit hauscheck: {...}), ohne Ablage.
 *   - Anrechnung aufs Abo wie beim Einzel-Check (Marcel 26.11.2026): je Kauf ein eigener Promotion-Code auf den festen
 *     Coupon dp_hauscheck_anrechnung (9,99 €, einmal), gültig bis Fristende.
 *   - EIGENER Schalter HAUSCHECK_AKTIV (Marcel 26.11.2026), getrennt von EINZELCHECK_AKTIV.
 *   - nur EFH, ZFH, DHH, RH, ETW. Ein MFH bekommt den Hinweis auf den Modus Vermieten.
 * ═══════════════════════════════════════════════════════════════════════════ */
const crypto = require('crypto');
const ec = require('./einzelcheck');

const VERSION = 'v5130kk6';
const PRODUKT = 'hauscheck';
const LOOKUP_KEY = 'dp_hauscheck_999';
/* Coupon in BEIDEN Stripe-Konten mit genau dieser ID (tools/stripe-hauscheck-preis-anlegen.mjs legt ihn mit an) */
const ANRECHNUNG_COUPON = 'dp_hauscheck_anrechnung';
const ARTEN = ['EFH', 'ZFH', 'DHH', 'RH', 'ETW'];
const PFLICHT = ['kp', 'wfl', 'art', 'bj', 'ek_eur'];
const MFH_HINWEIS = 'Für Mehrfamilienhäuser den Modus Vermieten nutzen.';
const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');

const STANDARD = {
  query: function (t, p) { return require('../db/pool').query(t, p); },
  stripe: function () { return require('./stripeService').getStripe(); },
  mbFetch: function (url, init) { return fetch(url, init); },
  jetzt: function () { return Date.now(); }
};
let _deps = null;
function deps() { return _deps || STANDARD; }
/** nur für tools/hauscheck-pruefen.mjs */
function _setzeDeps(d) { _preisCache = null; _deps = d ? Object.assign(Object.create(STANDARD), d) : null; }

/* ── Schalter: HAUSCHECK_AKTIV=1 frei, =0 aus, sonst nur Staging ── */
function aktiv() {
  const s = String(process.env.HAUSCHECK_AKTIV || '');
  if (s === '1') return true;
  if (s === '0') return false;
  return ec.istStaging();
}

/* ── Eingaben: nur die Felder des Einzel-Checks (Weißliste), Pflicht wie oben, Art nur Eigennutzer-Arten ── */
function grundSauber(g) { return ec.grundSauber(g); }
function grundFehlt(g) {
  const z = grundSauber(g);
  const f = PFLICHT.filter(function (k) { return z[k] == null || (k !== 'ek_eur' && k !== 'art' && !(z[k] > 0)); });
  if (!z.plz && !z.ort) f.push('plz');
  /* Haus ohne Grundstücksfläche: kein Bodenwert, damit kein Sach- und kein Ertragswert. Der bezahlte Bericht bräuchte
     ihn, also Pflicht (gemessen 26.11.2026 am Testkauf: „Sachwert nicht ausgewiesen: der Bodenwert fehlt“). */
  if (z.art && z.art !== 'ETW' && !(z.gsfl > 0)) f.push('gsfl');
  return f;
}
function artErlaubt(art) { return ARTEN.indexOf(String(art || '').toUpperCase()) >= 0; }

/* ── Preis aus Stripe ── */
let _preisCache = null;
async function preis(force) {
  if (!force && _preisCache && (deps().jetzt() - _preisCache.t) < 10 * 60 * 1000) return _preisCache.p;
  const res = await deps().stripe().prices.list({ lookup_keys: [LOOKUP_KEY], active: true, limit: 1, expand: ['data.product'] });
  const p = (res && res.data && res.data[0]) || null;
  if (!p || !(p.unit_amount > 0) || p.type !== 'one_time') {
    const e = new Error('Preis ' + LOOKUP_KEY + ' fehlt oder ist kein Einmalpreis'); e.code = 'preis_fehlt'; throw e;
  }
  const out = { price_id: p.id, amount_cents: p.unit_amount, currency: p.currency, lookup_key: p.lookup_key,
    produkt: (p.product && typeof p.product === 'object' && p.product.name) || 'Haus-Check' };
  _preisCache = { t: deps().jetzt(), p: out };
  return out;
}

function _fehler(text, status, code, extra) { const e = new Error(text); e.status = status; e.code = code; if (extra) Object.assign(e, extra); return e; }

/* ── Kauf anlegen, Checkout ── */
async function kaufAnlegen({ grund, rueckweg }) {
  const d = deps();
  const z = grundSauber(grund);
  if (z.art === 'MFH') throw _fehler(MFH_HINWEIS, 400, 'mfh');
  const fehlt = grundFehlt(z);
  if (fehlt.length) throw _fehler('Bitte zuerst Kaufpreis, Wohnfläche, Grundstücksfläche, Objektart, Baujahr, Eigenkapital und Postleitzahl eintragen.', 400, 'grundangaben', { fehlt });
  if (!artErlaubt(z.art)) throw _fehler('Der Haus-Check gilt für Einfamilien-, Zweifamilien-, Doppel- und Reihenhaus und die Eigentumswohnung.', 400, 'objektart');
  const p = await preis(false);
  const token = ec.neuesToken();
  const jetzt = d.jetzt();
  const bis = ec.gueltigBis(jetzt);
  const ins = await d.query(
    'INSERT INTO einzelcheck_kaeufe (token_hash, status, zahlen, amount_cents, currency, erstellt_am, gueltig_bis, produkt)' +
    " VALUES ($1, 'offen', $2, $3, $4, $5, $6, 'hauscheck') RETURNING id",
    [ec.hash(token), JSON.stringify(z), p.amount_cents, p.currency, new Date(jetzt), bis]);
  const kaufId = ins.rows[0].id;
  /* Rückweg: nur eine Seite der Landing (Pfad ohne Host), sonst die Haus-Check-Seite */
  const pfad = (typeof rueckweg === 'string' && /^\/[A-Za-z0-9._\/-]{1,80}$/.test(rueckweg) && rueckweg.indexOf('..') < 0) ? rueckweg : '/haus-check.html';
  const basis = ec.landingBasis();
  const meta = { type: PRODUKT, kauf_id: String(kaufId), lookup_key: LOOKUP_KEY };
  const session = await d.stripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: p.price_id, quantity: 1 }],
    billing_address_collection: 'required',
    invoice_creation: { enabled: true, invoice_data: { metadata: { hauscheck: String(kaufId) } } },
    automatic_tax: { enabled: false },   /* Kleinunternehmer § 19 UStG */
    client_reference_id: String(kaufId),
    metadata: meta,
    payment_intent_data: { metadata: meta },
    /* Token im FRAGMENT, es geht an keinen Server */
    success_url: basis + pfad + '?hauscheck=bezahlt#hc=' + token,
    cancel_url: basis + pfad + '?hauscheck=abbruch#hc=' + token,
    expires_at: Math.floor(jetzt / 1000) + 60 * 60,
    locale: 'de'
  });
  await d.query('UPDATE einzelcheck_kaeufe SET stripe_session_id = $1 WHERE id = $2', [session.id, kaufId]);
  return { token, url: session.url, kauf_id: kaufId, gueltig_bis: bis.toISOString(), amount_cents: p.amount_cents, currency: p.currency };
}

async function kaufLesen(token) {
  if (!ec.tokenForm(token)) return null;
  const r = await deps().query("SELECT * FROM einzelcheck_kaeufe WHERE token_hash = $1 AND produkt = 'hauscheck'", [ec.hash(token)]);
  return r.rows[0] || null;
}
function statusAus(z, jetzt) {
  const s = ec.statusAus(z, jetzt);
  delete s.mails_rest;
  return s;
}

/* Anrechnung: ein eigener Promotion-Code je Kauf auf den festen Coupon, einmal einlösbar, läuft mit der Frist ab.
   Fehlt der Coupon im Konto, bleibt der Kauf gültig, nur ohne Anrechnung (gemeldet). */
async function anrechnungAnlegen(k) {
  const d = deps();
  let code = null;
  try {
    code = 'HC' + crypto.randomBytes(5).toString('hex').toUpperCase();
    const pc = await d.stripe().promotionCodes.create({
      coupon: ANRECHNUNG_COUPON, code: code, max_redemptions: 1,
      expires_at: Math.floor(new Date(k.gueltig_bis).getTime() / 1000),
      metadata: { dp_kind: 'hauscheck_anrechnung', kauf_id: String(k.id) }
    });
    await d.query('UPDATE einzelcheck_kaeufe SET anrechnung_code = $1, anrechnung_promo_id = $2 WHERE id = $3', [code, pc.id, k.id]);
  } catch (e) {
    code = null;
    console.warn('[hauscheck-webhook] Anrechnung nicht angelegt (Coupon ' + ANRECHNUNG_COUPON + ' vorhanden?):', e.message);
  }
  return code;
}

/* ── Webhook: checkout.session.completed mit metadata.type = 'hauscheck' ── */
async function handlePaid(session) {
  const d = deps();
  if (!session || session.mode !== 'payment') return { ok: false, reason: 'not_payment_mode' };
  if (!session.metadata || session.metadata.type !== PRODUKT) return { ok: false, reason: 'not_hauscheck' };
  if (session.payment_status && session.payment_status !== 'paid') return { ok: false, reason: 'nicht_bezahlt:' + session.payment_status };
  const items = await d.stripe().checkout.sessions.listLineItems(session.id, { limit: 10, expand: ['data.price'] });
  const passt = (items.data || []).some(function (it) { return it && it.price && it.price.lookup_key === LOOKUP_KEY; });
  if (!passt) { console.error('[hauscheck-webhook] Sitzung ohne Preis ' + LOOKUP_KEY + ':', session.id); return { ok: false, reason: 'fremder_preis' }; }
  const claim = await d.query(
    "UPDATE einzelcheck_kaeufe SET status = 'bezahlt', bezahlt_am = now(), stripe_payment_intent = COALESCE($1, stripe_payment_intent)" +
    " WHERE stripe_session_id = $2 AND status = 'offen' AND produkt = 'hauscheck' AND gueltig_bis > now() RETURNING id, gueltig_bis, amount_cents",
    [session.payment_intent || null, session.id]);
  if (!claim.rowCount) {
    const da = await d.query('SELECT status FROM einzelcheck_kaeufe WHERE stripe_session_id = $1', [session.id]);
    if (da.rowCount && da.rows[0].status === 'bezahlt') return { ok: true, reason: 'already_processed' };
    console.error('[hauscheck-webhook] kein offener Kauf zur Sitzung:', session.id);
    return { ok: false, reason: 'kein_kauf' };
  }
  const k = claim.rows[0];
  await require('./verkaufSchalter').gezaehlt('hauscheck', k.amount_cents);
  const code = await anrechnungAnlegen(k);
  console.log('[hauscheck-webhook] bezahlt ' + k.id + (code ? ' · Anrechnung ' + code : ' · ohne Anrechnung'));
  return { ok: true, kauf_id: k.id, anrechnung: !!code };
}

/* ── Bericht: Wert (Stufe 3), Beleihungswert (§ 4 Abs. 2), Umfeld, Lage, Vergleichsmiete ──
   Der Wert geht durch die Weißliste des Einzel-Checks (ec.wertAus). Für das PDF: „Verkehrswert“ nur, wenn das
   führende Verfahren eine Wertindikation trägt (beim Sachwert nur mit Sachwertfaktor), sonst „vorläufig“ mit Weg. */
function hausWert(w) {
  if (!w || !w.verfuegbar) return { verfuegbar: false, grund: (w && (w.text || w.grund)) || 'nicht_im_umfang' };
  const nimm = function (a) { return (w.verfahren || []).filter(function (x) { return x.art === a && x.verfuegbar; })[0] || null; };
  const ew = nimm('ertragswert');
  if (w.wertindikation) {
    const f = nimm(w.wertindikation.verfahren) || {};
    return { verfuegbar: true, vollstaendig: true, verfahren: w.wertindikation.verfahren, betrag: w.wertindikation.wert_eur,
      rechenweg: f.rechenweg || null, ertragswert: ew && w.wertindikation.verfahren !== 'ertragswert' ? ew.wert_eur : null,
      stufe: w.wertindikation.stufe || null, herkunft: f.herkunft || null, quellen: w.quellen || [], hinweis: w.hinweis };
  }
  const sw = nimm('sachwert'), vg = nimm('vergleichswert');
  const v = sw || vg;
  if (!v) return { verfuegbar: false, grund: w.wertindikation_grund || 'kein_verfahren', weg: w.weg || null };
  return { verfuegbar: true, vollstaendig: false, verfahren: v.art, betrag: v.wert_eur, rechenweg: v.rechenweg || null,
    ertragswert: ew ? ew.wert_eur : null, weg: w.wertindikation_grund || w.weg || null, quellen: w.quellen || [], hinweis: w.hinweis };
}
function belwAus(b) {
  if (!b || !b.verfuegbar) return { verfuegbar: false };
  return { verfuegbar: true, beleihungswert: Math.round(Number(b.beleihungswert) || 0), basis: String(b.basis || ''), eigennutzung: !!b.eigennutzung,
    verhaeltnis_pct: Number.isFinite(Number(b.verhaeltnis_zum_verkehrswert_pct)) ? Number(b.verhaeltnis_zum_verkehrswert_pct) : null,
    auslauf_pct: b.auslauf && Number.isFinite(Number(b.auslauf.auslauf_pct)) ? Number(b.auslauf.auslauf_pct) : null,
    ueber_60: !!(b.auslauf && b.auslauf.ueber_60), kleindarlehen: !!(b.kleindarlehen && b.kleindarlehen.moeglich),
    hinweise: (Array.isArray(b.hinweise) ? b.hinweise : []).map(function (t) { return String(t).replace(/\s[–—-]\s/g, ', ').replace(/;/g, ',').slice(0, 400); }).slice(0, 4) };
}
function umfeldAus(u) {
  if (!u || !u.ok || !Array.isArray(u.kategorien)) return null;
  return { ok: true, vermerk: String(u.vermerk || '© OpenStreetMap-Mitwirkende').slice(0, 120), hinweis: String(u.hinweis || '').slice(0, 200),
    kategorien: u.kategorien.slice(0, 16).map(function (k) {
      const n = k.naechster;
      return { k: String(k.k || '').slice(0, 20), label: String(k.label || '').slice(0, 40), anzahl: Number.isFinite(Number(k.anzahl)) ? Number(k.anzahl) : null,
        nicht_ermittelt: !!k.nicht_ermittelt,
        naechster: n ? { name: String(n.name || '').slice(0, 80), luftlinie_m: Math.round(Number(n.luftlinie_m) || 0), fuss_min: Math.round(Number(n.fuss_min) || 0) } : null };
    }) };
}

/* Gebäudetyp nach NHK 2010 und Standardstufe aus dem Formular der Landing (nicht gespeichert, nur für diesen Lauf).
   Dieselben Felder wie das Objekt-Formular der App (DealPilotObjectMapper: nhk_haus, nhk_geschosse, nhk_dach, ausst). */
function nhkSauber(n) {
  if (!n || typeof n !== 'object') return {};
  const o = {};
  if (/^[123]$/.test(String(n.haus))) o.nhk_haus = String(n.haus);
  if (/^[0-3]$/.test(String(n.geschosse))) o.nhk_geschosse = String(n.geschosse);
  if (/^[123]$/.test(String(n.dach))) o.nhk_dach = String(n.dach);
  if (/^(einfach|normal|gehoben|luxus)$/.test(String(n.ausst))) o.ausst = String(n.ausst);
  /* pp6 · Modernisierungspunkte nach Anlage 2 ImmoWertV aus der Zustandsstufe (0 bis 20), für Restnutzungsdauer und Sachwert */
  if (/^(d|1d|20)$/.test(String(n.mod))) o.mod_punkte = Number(n.mod);
  if (/^(A+|[A-H])$/.test(String(n.ekl || ''))) o.energieklasse = String(n.ekl);
  return o;
}
/* pp6 (26.11.2026) · Marktdaten am Ort für den Bericht (Marcel: „das sah gut aus mit den GeoMap-Sachen“), nur Weißliste:
   Angebotspreis und -miete je m² (Median, Quartile, Stichprobe, Umkreis), Preis- und Mietreihe je Jahr, Vergleichsangebote
   OHNE Adresse und OHNE Koordinaten (Preis/m², Fläche, Baujahr, Entfernung, Monat). Keine Rohangebote dauerhaft speichern. */
const _z = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
function marktAmOrt(j, m) {
  const d = (j && j.data) || {}, sale = d.sale || {}, rent = d.rent || {}, mh = d.market_history || {};
  const reihe = (a) => (Array.isArray(a) ? a : []).filter((p) => _z(p.year) && _z(p.median) > 0).slice(-8).map((p) => ({ jahr: _z(p.year), median: Math.round(_z(p.median) * 100) / 100, n: _z(p.count) }));
  const angebote = (Array.isArray(sale.comparables) ? sale.comparables : []).filter((c) => _z(c.price_per_sqm) > 0).slice(0, 10).map((c) => ({
    qm_preis: Math.round(_z(c.price_per_sqm)), flaeche: _z(c.living_area), baujahr: _z(c.build_year), entfernung_m: _z(c.distance_m) != null ? Math.round(_z(c.distance_m) / 10) * 10 : null,
    monat: /^\d{4}-\d{2}/.test(String(c.offer_date || '')) ? String(c.offer_date).slice(0, 7) : null }));
  const mk = m.markt || {};
  return { wert: mk.wert, wert_von: mk.wert_von, wert_bis: mk.wert_bis, abschlag_pct: mk.abschlag ? mk.abschlag.pct : null, abschlag_herkunft: mk.abschlag ? mk.abschlag.herkunft : null,
    kauf: { median: _z(sale.median_per_sqm), q25: _z(sale.q25_per_sqm), q75: _z(sale.q75_per_sqm), n: _z(sale.sample_size), umkreis_m: _z(sale.used_radius_m) },
    miete: { median: _z(rent.median_per_sqm), q25: _z(rent.q25_per_sqm), q75: _z(rent.q75_per_sqm), n: _z(rent.sample_size), umkreis_m: _z(rent.used_radius_m) },
    preis_trend_pct: mk.preis_trend_pct, miete_trend_pct: mk.miete_trend_pct,
    reihe: { preis: reihe(mh.price), miete: reihe(mh.rent) }, angebote,
    aus_markt: !!(_z(sale.median_per_sqm) || angebote.length || (mh.price && mh.price.length)) };
}
/* pp6 · Regionale Daten wie im Marktbericht, aus derselben Antwort (keine zweite Rechnung), nur Weißliste ohne Quellennamen:
   Makro-Kennzahlen (Bevölkerung, Wanderung, Kaufkraft, Arbeitslosigkeit mit Jahr und Ebene), Zensus 2022 (Leerstand,
   marktaktiver Leerstand, Eigentumsquote, Zensus-Miete) für Gemeinde und Kreis, Bodenrichtwert mit Stichtag und Vorwert. */
function regionAus(j) {
  const d = (j && j.data) || {}, mk = d.makro_kennzahlen || {}, z = d.zensus || {}, lv = d.land_value || {};
  const werte = (Array.isArray(mk.werte) ? mk.werte : []).filter((w) => _z(w.wert) != null).slice(0, 8).map((w) => ({
    k: String(w.schluessel || '').slice(0, 30), label: String(w.label || '').slice(0, 60), wert: _z(w.wert), einheit: String(w.einheit || '').slice(0, 40),
    nachkomma: _z(w.nachkomma), vorzeichen: !!w.vorzeichen, jahr: _z(w.jahr), von_jahr: _z(w.von_jahr), ebene: String(w.ebene || '').slice(0, 20), gebiet: String(w.gebiet || '').slice(0, 60) }));
  const zs = (o) => (o && typeof o === 'object' ? { name: String(o.name || '').slice(0, 60), leerstand_pct: _z(o.leerstandsquote), leerstand_markt_pct: _z(o.leerstandsquote_marktaktiv),
    eigentum_pct: _z(o.eigentuemerquote), miete_qm: _z(o.nettokaltmiete_qm) } : null);
  const raw = lv.properties_raw || {};
  const brw = lv.available && _z(lv.value_sqm) ? { qm: _z(lv.value_sqm), stichtag: String(lv.stichtag || '').slice(0, 10), nutzung: String(lv.nutzung || '').slice(0, 10),
    vor_qm: _z(String(raw.HBRW || '').trim()) || null, vor_stichtag: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.HTAG || '')) ? String(raw.HTAG) : null } : null;
  return { werte, makro_score: d.macro ? _z(d.macro.score) : null, zensus: z.available ? { stichtag: String(z.stichtag || '').slice(0, 10), gemeinde: zs(z.gemeinde), kreis: zs(z.kreis) } : null, brw };
}
async function bericht(zeile, adresse, darlehen, nhk) {
  if (!zeile) throw _fehler('Der Kauf ist unbekannt.', 403, 'kauf_unbekannt');
  const darf = ec.berichtErlaubt(zeile);
  if (!darf.ok) throw _fehler('Der Bericht braucht einen bezahlten, gültigen Kauf.', darf.code === 'nicht_bezahlt' ? 402 : 403, darf.code);
  const z = ec.zahlenSauber(zeile.zahlen || {});
  const adr = (typeof adresse === 'string') ? adresse.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 160) : '';
  const body = Object.assign(ec.mbEingabe(z, adr.length >= 5 ? adr : null), {
    hauscheck: { objektart: String(z.art || '').toLowerCase(), darlehen: Number(darlehen) > 0 && Number(darlehen) < 1e8 ? Math.round(Number(darlehen)) : null } });
  if (z.art !== 'ETW') Object.assign(body.dealpilot, nhkSauber(nhk));
  let j = null;
  try {
    const r = await deps().mbFetch(MB_BASE + '/reports/einzelcheck', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const t = await r.text();
    try { j = JSON.parse(t); } catch (e) { j = null; }
    if (!r.ok) j = null;
  } catch (e) { j = null; }
  await ec.berichtGezaehlt(zeile.id, z);
  if (!j) return { verfuegbar: false, grund: 'dienst', zahlen: z };
  try { ec.kostenErfassen(j); } catch (e) { /* Kostenerfassung bricht den Bericht nie */ }
  const m = ec.marktAus(j);
  let karte = null;
  try { const kt = await ec.karteHolen(j.data && j.data.address); if (kt) karte = kt.bild; } catch (e) { karte = null; }
  return { verfuegbar: true, zahlen: z, wert: hausWert(m.wert), belw: belwAus(j.beleihungswert), umfeld: umfeldAus(j.umfeld),
    lage: m.lage, vergleichsmiete: m.vergleichsmiete, markt: { qm: m.markt.qm, miete_qm: m.markt.miete_qm }, stichtag: m.stichtag, karte,
    am_ort: (function () { try { return marktAmOrt(j, m); } catch (e) { return null; } })(),
    region: (function () { try { return regionAus(j); } catch (e) { return null; } })() };
}

module.exports = { VERSION, PRODUKT, LOOKUP_KEY, ANRECHNUNG_COUPON, aktiv, anrechnungAnlegen, ARTEN, PFLICHT, MFH_HINWEIS, grundSauber, grundFehlt, artErlaubt, preis, kaufAnlegen, kaufLesen,
  statusAus, handlePaid, hausWert, belwAus, umfeldAus, nhkSauber, marktAmOrt, regionAus, bericht, _setzeDeps };
