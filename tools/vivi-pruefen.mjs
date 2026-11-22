#!/usr/bin/env node
/* tools/vivi-pruefen.mjs — v3950/v3951 · ViVi-Anbindung (Pakete V1 bis V3, V5, V4 als Entwurf), ohne Netz, ohne Datenbank, ohne Token
 *
 * Prueft gegen die ECHTE Spezifikation Dateien/Architektur/vivi/vivi-openapi-v1.json (ViVi API v1.5.0) und die
 * ECHTEN Dateien des Repos. Statt ViVi antwortet eine Attrappe, die jede Anfrage gegen die Schemas der
 * Spezifikation prueft (Pflichtfelder, nur bekannte Felder, Typen, Wertelisten) und Antworten nach den
 * Resource-Schemas baut.
 *
 *   A  Abbildung DealPilot -> ViVi an Demo-Faellen: jede Nutzlast passt zum Request-Schema, Objekttyp nach Tabelle,
 *      ETW eine Einheit, Prozente -> Betraege, "3.5" bleibt 3,5, kein Kontakt, keine IBAN, Platzhalter-Namen
 *   B  Nebenkosten-Vorauszahlung: Backend nkVorschlag() == Frontend DpNkVorauszahlung.vorschlag(), Summe = UL / 12
 *   C  Nur GET und POST: services/vivi/ und routes/vivi.js, Client-Schnittstelle, gesperrte Pfade, Gegenprobe
 *   D  Einmal anlegen: Ende zu Ende gegen die Attrappe, zweites Anlegen 409, Fortsetzen nach 429 und nach
 *      verlorener Antwort legt nichts doppelt an
 *   E  Lesen ViVi -> DealPilot: Rundweg Feld fuer Feld, jedes gelesene ViVi-Feld steht im Resource-Schema,
 *      jedes Ziel-Feld gibt es in DealPilot (index.html, FIELDS, Einheiten-Felder)
 *   F  Anfragebremse: hoechstens 50 je Minute, 429 bricht ab, keine Wiederholung
 *   G  Takt viviAbruf unter taktSperre (Schluessel 11)
 *   H  Frontend: _vivi und nk_vorauszahlung in FIELDS, Hinweis Zeichen fuer Zeichen, eigenes Merkattribut,
 *      Ausgrauen und lokal Ueberschreiben an einem nachgebauten Formular, Gegenproben
 *   I  Token: nie im Protokoll, nie in einer Antwort, nie im Code, nie in .env-Vorlagen
 *   J  Kundentext ohne Gedankenstrich und Semikolon
 *   K  v3951 Testbetrieb: Musteranschrift und Platzhalter vorgegeben, solange vivi Vorschau-Funktion ist, Anschrift wird
 *      dann nicht zurueckgelesen, Gegenprobe ohne Testbetrieb
 *   V5 v3951 Unterlagen-Abgleich: vivi_abweichung an den echten Dateien dokument-import.js + vivi-felder.js, nie
 *      vorgehakt, Hinweis Zeichen fuer Zeichen, Entscheidung gemerkt, lokal festlegen ohne Netz, Gegenproben
 *   R  v3953 Echte Antworten aus dem Testkonto (tools/vivi-antworten/): Rundweg, gelesene Felder, was ViVi selbst setzt,
 *      Steueruebersicht als Objekt
 *   V4 v3951 Steuer als Entwurf: Schalter aus, Lesepfade in der Spezifikation, Zielspalten in tax_records, Auslese an
 *      nachgebauten Antworten (Feldnamen sind Annahmen, erst mit Key pruefbar)
 *
 * Aufruf: node tools/vivi-pruefen.mjs [--zeigen]   (--zeigen druckt die Nutzlast je Demo-Fall)
 * RC=0 sauber, RC=1 rot.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (rel) => path.join(WURZEL, rel);
const lies = (rel) => fs.readFileSync(P(rel), 'utf8');
const ZEIGEN = process.argv.includes('--zeigen');

let rot = 0, gruen = 0;
const ok = (b, t) => { if (b) { gruen++; console.log('  ok  ' + t); } else { rot++; console.log('  ROT ' + t); } return b; };
const kopf = (t) => console.log('\n' + t);

const SPEC = JSON.parse(lies('Dateien/Architektur/vivi/vivi-openapi-v1.json'));
const mapping = require(P('backend/src/services/vivi/viviMapping.js'));
const viviClient = require(P('backend/src/services/vivi/viviClient.js'));
const dienst = require(P('backend/src/services/vivi/viviDienst.js'));
const steuerEntwurf = require(P('backend/src/services/vivi/viviSteuer.js'));   /* v3951 · V4 als Entwurf */
/* v3951 · Testbetrieb (Musteranschrift) ist in den Teilen A bis J aus, damit sie die echte Abbildung pruefen. Teil K schaltet ihn an. */
const setzeDeps = (d) => dienst._setzeDeps(Object.assign({ testbetrieb: async () => false }, d));

/* ── Schema-Werkzeug ─────────────────────────────────────────────────── */
function deref(s) { let n = 0; while (s && s.$ref && n++ < 10) s = SPEC.components.schemas[s.$ref.split('/').pop()]; return s; }
function operation(methode, pfad) { const o = SPEC.paths[pfad]; return o && o[methode.toLowerCase()]; }
function rumpfSchema(methode, pfad) { const op = operation(methode, pfad); return op && op.requestBody ? deref(op.requestBody.content['application/json'].schema) : null; }
function typen(s) { return Array.isArray(s.type) ? s.type : (s.type ? [s.type] : []); }
/* Prueft wert gegen schema, liefert Liste der Befunde (leer = passt). Unbekannte Felder sind ein Befund. */
function pruefeSchema(wert, schema, wo) {
  const f = [];
  schema = deref(schema);
  if (!schema) return f;
  if (schema.anyOf) { if (!schema.anyOf.some((s) => !pruefeSchema(wert, s, wo).length)) f.push(wo + ': passt zu keiner anyOf-Form'); return f; }
  const T = typen(schema);
  if (wert === null) { if (T.length && !T.includes('null')) f.push(wo + ': null nicht erlaubt'); return f; }
  const passt = (t) => (t === 'string' && typeof wert === 'string') || (t === 'number' && typeof wert === 'number' && isFinite(wert))
    || (t === 'integer' && Number.isInteger(wert)) || (t === 'boolean' && typeof wert === 'boolean')
    || (t === 'array' && Array.isArray(wert)) || (t === 'object' && wert && typeof wert === 'object' && !Array.isArray(wert));
  if (T.length && !T.some(passt)) { f.push(wo + ': Typ ' + JSON.stringify(T) + ' erwartet, ist ' + typeof wert + ' (' + JSON.stringify(wert) + ')'); return f; }
  if (schema.enum && !schema.enum.map(String).includes(String(wert))) f.push(wo + ': ' + JSON.stringify(wert) + ' nicht in ' + JSON.stringify(schema.enum));
  if (typeof wert === 'number') {
    if (schema.minimum != null && wert < schema.minimum) f.push(wo + ': unter ' + schema.minimum);
    if (schema.maximum != null && wert > schema.maximum) f.push(wo + ': über ' + schema.maximum);
  }
  if (typeof wert === 'string' && schema.maxLength != null && wert.length > schema.maxLength) f.push(wo + ': länger als ' + schema.maxLength);
  if (typeof wert === 'string' && schema.format === 'date-time' && !/^\d{4}-\d{2}-\d{2}/.test(wert)) f.push(wo + ': kein Datum YYYY-MM-DD');
  if (Array.isArray(wert) && schema.items) wert.forEach((x, i) => f.push(...pruefeSchema(x, schema.items, wo + '[' + i + ']')));
  if (wert && typeof wert === 'object' && !Array.isArray(wert) && schema.properties) {
    (schema.required || []).forEach((k) => { if (!(k in wert)) f.push(wo + ': Pflichtfeld ' + k + ' fehlt'); });
    Object.keys(wert).forEach((k) => {
      if (!(k in schema.properties)) f.push(wo + ': Feld ' + k + ' gibt es in der Spezifikation nicht');
      else f.push(...pruefeSchema(wert[k], schema.properties[k], wo + '.' + k));
    });
  }
  return f;
}
function pfadVorlage(methode, pfad) {
  for (const v of Object.keys(SPEC.paths)) {
    const re = new RegExp('^' + v.replace(/\{[^}]+\}/g, '[^/]+') + '$');
    if (re.test(pfad) && operation(methode, v)) return v;
  }
  return null;
}

/* ── Demo-Faelle (eingefroren aus tools/flow-berechnen-faelle.json, Stammdaten erfunden) ─────────── */
const FLOW = JSON.parse(lies('tools/flow-berechnen-faelle.json')).faelle;
const DEMO = ['2026-1157', '2026-1158', '2026-001', '2026-1006', '2026-1041', '2026-1053', '2026-1055'];   /* v3965 · 2026-1051 gestrichen (Marcel 22.11.2026) */
function faelle() {
  const aus = [];
  DEMO.forEach((nr, i) => {
    const q = FLOW['demo-konto:' + nr];
    if (!q) return;
    const d = JSON.parse(JSON.stringify(q.d));
    /* Musteranschrift, nie eine echte (Regel: echte Namen und Strassen nie ins Repo, nie in ein Fremdsystem) */
    Object.assign(d, { str: 'Musterstraße', hnr: String(10 + i), ort: 'Musterstadt', plz: /^\d{5}$/.test(String(d.plz || '')) ? String(d.plz) : '33602',
      wirtschaftlicher_uebergang: '2024-0' + (1 + (i % 8)) + '-01', baujahr: String(1960 + i * 5), d1_auszahl: '0' + (1 + (i % 8)) + '.2024', bank_inst: 'Musterbank' });
    if (d.d2 && Number(String(d.d2).replace(',', '.')) > 0) d.d2_auszahl = '0' + (1 + (i % 8)) + '.2024';
    const art = String(d.objart || '').toUpperCase();
    if (art === 'MFH' || art === 'GESCH') {
      /* erfundene Einheiten aus Gesamtflaeche und Miete, eine davon leer */
      const n = art === 'GESCH' ? 3 : (nr === '2026-1051' ? 12 : 4);
      const wfl = Number(String(d.wfl || 400).replace(',', '.')) || 400;
      const nkm = Number(String(d.nkm || 2000).replace(',', '.')) || 2000;
      d._mfh = { einheiten: Array.from({ length: n }, (_, k) => ({
        nr: String(k + 1), lage: ['EG links', 'EG rechts', '1. OG links', '1. OG rechts'][k % 4], art: art === 'GESCH' && k === 0 ? 'gewerbe' : 'wohnen',
        wfl: String(Math.round(wfl / n * 10) / 10).replace('.', ','), status: k === n - 1 ? 'leer' : 'vermietet',
        ist: k === n - 1 ? '' : String(Math.round(nkm / (n - 1))), mv_art: k === 1 ? 'staffel' : 'unbefristet', mv_beginn: '2019-0' + (1 + k % 9) + '-01',
        mv_kaution: String(Math.round(nkm / (n - 1)) * 3), stellplatz_miete: k === 0 ? '45' : '', nk_vorauszahlung: k === 2 ? '180' : ''
      })) };
    } else {
      d.mv_beginn = '2020-05-01'; d.mv_kaution = '2400'; d.mv_art = 'index'; d.ze_stp_monat = '40'; d.etage = art === 'ETW' ? '2' : '';
    }
    aus.push({ nr: nr, d: d });
  });
  /* Sonderfall: Mietername vorhanden, Zins mit Dezimalpunkt "3.5", Nebenkosten nur im Monatsfeld */
  aus.push({ nr: 'name-und-punkt', d: { objart: 'ETW', str: 'Musterweg', hnr: '1a', plz: '12345', ort: 'Musterstadt', kp: '250.000', wirtschaftlicher_uebergang: '2025-03-01',
    wfl: '68,5', etage: '0', nkm: '820', mv_mieter: 'Erika Beispiel', mv_beginn: '2021-07-01', umlagef: '210',
    makler_p: '3,57', gest_p: '6,5', notar_p: '1,5', gba_p: '0,5', ji_p: '0', d1: '200000', d1z: '3.5', d1t: '2', d1_bindj: '10', d1_auszahl: '03.2025',
    darlehen_weitere: JSON.stringify([{ bez: 'KfW 261', betrag: 30000, zins: 1.9, tilg: 3, bindj: 10 }]) } });
  /* v3965 · ZFH, beide Einheiten leer (wie 2026-1006): die automatische Einheit wird einmal per PATCH benannt */
  aus.push({ nr: 'zfh-leer', d: { objart: 'ZFH', str: 'Musterweg', hnr: '2', plz: '12345', ort: 'Musterstadt', kp: '350000', wirtschaftlicher_uebergang: '2026-08-12',
    d1: '280000', d1z: '3,5', d1t: '2', d1_bindj: '10', d1_auszahl: '08.2026',
    _mfh: { einheiten: [{ nr: '1', lage: 'EG / OG', wfl: '141,7', status: 'leer' }, { nr: '2', lage: 'DG', wfl: '103,38', status: 'leer' }] } } });
  return aus;
}
const FAELLE = faelle();

/* ═══ A · DealPilot -> ViVi ═══════════════════════════════════════════════ */
kopf('A  Abbildung DealPilot -> ViVi gegen die Request-Schemas (' + FAELLE.length + ' Fälle)');
ok(FAELLE.length >= 9, 'acht Demo-Objekte aus dem Bauplan plus Sonderfall vorhanden (' + FAELLE.length + ')');
const TYPTABELLE = { ETW: 'apartment', EFH: 'single_family_house', DHH: 'single_family_house', RH: 'single_family_house', ZFH: 'multi_family_house', MFH: 'multi_family_house', BUERO: 'commercial', GESCH: 'commercial', HOTEL: 'commercial', GEW: 'commercial', GRST: 'land', GAR: 'other' };
const typEnum = rumpfSchema('POST', '/projects').properties.type.enum;
ok(Object.values(TYPTABELLE).every((t) => typEnum.includes(t)) && JSON.stringify(mapping.OBJEKTTYP) === JSON.stringify(Object.assign({}, TYPTABELLE)), 'Objekttyp-Tabelle wie im Bauplan, alle Werte in der Werteliste der Spezifikation');
let schemaFehler = [];
for (const fa of FAELLE) {
  const plan = mapping.nachVivi(fa.d, {});
  const art = String(fa.d.objart).toUpperCase();
  if (!ok(plan.ok, fa.nr + ' (' + art + '): alle ViVi-Pflichtangaben vorhanden' + (plan.ok ? '' : ': ' + plan.fehlt.map((x) => x.text).join(', ')))) continue;
  schemaFehler.push(...pruefeSchema(plan.projekt, rumpfSchema('POST', '/projects'), fa.nr + ' POST /projects'));
  plan.einheiten.forEach((e) => {
    if (e.miete) schemaFehler.push(...pruefeSchema(Object.assign({ unit_id: 'unt_x' }, e.miete), rumpfSchema('POST', '/projects/{project}/rental-units'), fa.nr + ' rental-units ' + e.name));
    else schemaFehler.push(...pruefeSchema(e.einheit, rumpfSchema('POST', '/projects/{project}/units'), fa.nr + ' units ' + e.name));
  });
  plan.darlehen.forEach((x) => schemaFehler.push(...pruefeSchema(x.body, rumpfSchema('POST', '/projects/{project}/financings'), fa.nr + ' financings ' + x.schluessel)));
  if (ZEIGEN) console.log(JSON.stringify({ fall: fa.nr, projekt: plan.projekt, einheiten: plan.einheiten, darlehen: plan.darlehen }, null, 1));
  ok(plan.projekt.type === (TYPTABELLE[art] || 'other'), fa.nr + ': Objekttyp ' + art + ' -> ' + plan.projekt.type);
  if (!fa.d._mfh) ok(plan.einheiten.length === 1 && plan.projekt.units === 1, fa.nr + ': ohne Einheitenliste genau eine Einheit (nicht das Feld einheiten)');
  else ok(plan.einheiten.length === fa.d._mfh.einheiten.length, fa.nr + ': ' + plan.einheiten.length + ' Einheiten wie in _mfh, leere ohne Mietverhältnis (' + plan.einheiten.filter((e) => !e.miete).length + ')');
  const txt = JSON.stringify({ p: plan.projekt, e: plan.einheiten, d: plan.darlehen });
  ok(!/iban|tenant_email|tenant_phone|tenant_date_of_birth|tenant_alt_/i.test(txt), fa.nr + ': keine IBAN, keine Kontaktdaten in der Nutzlast');
}
{
  /* Gegenproben des Schema-Werkzeugs: ein erfundenes Feld, ein fehlendes Pflichtfeld, ein Wert ausserhalb der Werteliste */
  const p0 = mapping.nachVivi(FAELLE[0].d, {}).projekt;
  const S0 = rumpfSchema('POST', '/projects');
  ok(pruefeSchema(Object.assign({}, p0, { tenant_iban: 'DE00' }), S0, 'x').length > 0, 'Gegenprobe rot: erfundenes Feld tenant_iban');
  const ohne = Object.assign({}, p0); delete ohne.purchase_date;
  ok(pruefeSchema(ohne, S0, 'x').some((x) => /Pflichtfeld purchase_date/.test(x)), 'Gegenprobe rot: Pflichtfeld purchase_date fehlt');
  ok(pruefeSchema(Object.assign({}, p0, { type: 'house' }), S0, 'x').length > 0 && pruefeSchema(Object.assign({}, p0, { purchase_price: '250000' }), S0, 'x').length > 0, 'Gegenprobe rot: Objektart außerhalb der Werteliste, Kaufpreis als Text');
}
ok(!schemaFehler.length, 'jede Nutzlast passt zum Request-Schema der Spezifikation' + (schemaFehler.length ? ':\n        ' + schemaFehler.slice(0, 12).join('\n        ') : ''));
{
  const s = FAELLE.find((x) => x.nr === 'name-und-punkt');
  const plan = mapping.nachVivi(s.d, {});
  const d1 = plan.darlehen.find((x) => x.schluessel === 'd1').body;
  ok(d1.interest_rate === 3.5, 'Zins "3.5" bleibt 3,5 (nicht 35)');
  ok(plan.projekt.purchase_price === 250000, 'Kaufpreis "250.000" -> 250000');
  ok(plan.projekt.broker === 8925 && plan.projekt.real_estate_transfer_tax === 16250 && plan.projekt.notary === 3750 && plan.projekt.land_register === 1250 && !('other_costs' in plan.projekt),
    'Prozente -> Beträge: Makler 3,57 % = 8.925, GrESt 16.250, Notar 3.750, Grundbuch 1.250, Sonstige 0 % nicht gesendet');
  const m = plan.einheiten[0].miete;
  ok(m.tenant_first_name === 'Erika' && m.tenant_last_name === 'Beispiel', 'vorhandener Mietername wird geteilt (Vorname, Nachname)');
  ok(m.unit_floor === 'EG' && m.unit_square_meters === 68.5, 'Etage 0 -> "EG", Fläche 68,5 -> 68.5');
  ok(m.monthly_utility_costs === 210, 'Nebenkosten ohne Bewirtschaftungsposten aus umlagef (210 €/Monat)');
  const mp = mapping.nachVivi(s.d, { platzhalterNamen: true }).einheiten[0].miete;
  ok(mp.tenant_first_name === 'Mieter' && mp.tenant_last_name === 'Wohnung', 'Platzhalter-Wahl ersetzt den Namen ("Mieter Wohnung")');
  ok(plan.darlehen.length === 2 && plan.darlehen[1].body.name === 'KfW 261' && plan.darlehen[1].body.financing_type === 'parallel', 'weiteres Darlehen aus darlehen_weitere als parallel');
  const leer = mapping.nachVivi({ objart: 'MFH', kp: '1', str: 'a', hnr: '1', plz: '1234', ort: 'x' }, {});
  ok(!leer.ok && leer.fehlt.some((x) => x.feld === 'plz') && leer.fehlt.some((x) => x.feld === 'wirtschaftlicher_uebergang'), 'fehlende Pflichtangaben werden genannt (PLZ vierstellig, Übergang fehlt), kein Anlegen');
  const ohneName = mapping.nachVivi(FAELLE[0].d, {}).einheiten.find((e) => e.miete);
  ok(ohneName && ohneName.miete.tenant_first_name === 'Mieter', 'ohne Mieternamen steht ein Platzhalter');
}

/* ═══ B · Nebenkosten-Vorauszahlung ══════════════════════════════════════ */
kopf('B  Nebenkosten-Vorauszahlung: Backend und Frontend rechnen gleich');
function frontendModul(rel, extra) {
  const ctx = { console, setTimeout: () => 0, clearTimeout: () => {}, Event: function () {}, CustomEvent: function () {}, MutationObserver: function () { this.observe = () => {}; }, WeakSet };
  ctx.window = ctx;
  ctx.document = Object.assign({ readyState: 'complete', addEventListener: () => {}, getElementById: () => null, querySelectorAll: () => [], body: {}, head: { appendChild: () => {} }, createElement: () => ({ style: {} }) }, (extra && extra.document) || {});
  ctx.addEventListener = () => {};
  Object.assign(ctx, (extra && extra.globals) || {});
  vm.createContext(ctx);
  vm.runInContext(lies(rel), ctx, { filename: rel });
  return ctx;
}
const NK = frontendModul('frontend/js/nk-vorauszahlung.js').DpNkVorauszahlung;
let nkGleich = 0, nkVergl = 0;
for (const fa of FAELLE) {
  const idxs = fa.d._mfh ? fa.d._mfh.einheiten.map((_, i) => i) : [null];
  idxs.forEach((i) => { nkVergl++; if (mapping.nkVorschlag(fa.d, i) === NK.vorschlag(fa.d, i)) nkGleich++; });
}
ok(nkVergl >= 15 && nkGleich === nkVergl, 'nkVorschlag (Backend) == DpNkVorauszahlung.vorschlag (Frontend) in ' + nkGleich + ' von ' + nkVergl + ' Einheiten');
{
  const d = { objart: 'MFH', hg_ul: '6000', grundsteuer: '1200', ul_sonst: '0', _mfh: { einheiten: [{ nr: '1', wfl: '60', ist: '500' }, { nr: '2', wfl: '90', ist: '700' }, { nr: '3', wfl: '50', status: 'leer' }] } };
  const v = [0, 1, 2].map((i) => mapping.nkVorschlag(d, i));
  ok(v[0] === 180 && v[1] === 270 && v[2] === 150, 'MFH 7.200 €/Jahr nach Fläche 60/90/50 m²: 180, 270, 150 €/Monat (leere Einheit trägt ihren Anteil)');
  ok(mapping.nkVorschlag({ objart: 'ETW', hg_ul: '1391', grundsteuer: '336' }, null) === 144, 'ETW (1.391 + 336) / 12 = 144 €/Monat');
  ok(mapping.nkVorschlag({ objart: 'ETW' }, null) === null, 'ohne umlagefähige Kosten kein Vorschlag (null, nie 0)');
  const kerne = ['frontend/js/calc.js', 'frontend/js/deal-kpis.js', 'frontend/js/dscr-engine.js', 'frontend/js/dealscore.js', 'frontend/js/score-tiers.js'];
  ok(kerne.every((k) => !lies(k).includes('nk_vorauszahlung')), 'kein Rechenkern liest nk_vorauszahlung (calc, deal-kpis, dscr-engine, dealscore, score-tiers)');
}

/* ═══ C · Nur GET und POST ═══════════════════════════════════════════════ */
kopf('C  Nur GET und POST an ViVi');
const VIVI_DATEIEN = fs.readdirSync(P('backend/src/services/vivi')).filter((f) => f.endsWith('.js')).map((f) => 'backend/src/services/vivi/' + f).concat(['backend/src/routes/vivi.js']);
function nurLesenBefunde(dateien) {
  const f = [];
  for (const [rel, t] of dateien) {
    const ohneKommentar = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    /* v3965 · genau EIN PATCH ist erlaubt: senden('PATCH' …) in viviClient.einheitBeimAnlegen() */
    const ohnePatch = rel.endsWith('viviClient.js') ? ohneKommentar.replace(/function einheitBeimAnlegen\(pfad, rumpf\) \{[\s\S]*?return senden\('PATCH', pfad, null, r\);\r?\n  \}/, '') : ohneKommentar;
    if (rel.endsWith('viviClient.js') && ohnePatch === ohneKommentar) f.push(rel + ': einheitBeimAnlegen() fehlt oder ist verändert');
    if (/['"`](PUT|PATCH|DELETE)['"`]/.test(ohnePatch) && !rel.endsWith('routes/vivi.js')) f.push(rel + ': Methode PUT/PATCH/DELETE als Text');
    if (rel.endsWith('viviDienst.js')) {
      const aufrufe = (ohneKommentar.match(/einheitBeimAnlegen\(/g) || []).length;
      const anl = /async function anlegen\([\s\S]*?\r?\n\}\r?\n/.exec(ohneKommentar);
      if (aufrufe !== 1 || !anl || !/einheitBeimAnlegen\(/.test(anl[0])) f.push(rel + ': einheitBeimAnlegen ' + aufrufe + ' mal, erlaubt genau einmal in anlegen()');
      if (anl && !/!ids\.auto_angepasst/.test(anl[0])) f.push(rel + ': einheitBeimAnlegen ohne Merker auto_angepasst');
    }
    if (/method\s*:\s*['"`](?!GET['"`]|POST['"`])/i.test(ohneKommentar.replace(/method\s*:\s*methode/g, ''))) f.push(rel + ': method mit anderem Wert als GET/POST');
    if (/\bfetch\s*\(/.test(ohneKommentar) && !rel.endsWith('viviClient.js')) f.push(rel + ': eigenes fetch ausserhalb von viviClient.js');
    if (/require\(['"](node:)?(https?|axios|node-fetch|undici)['"]\)/.test(ohneKommentar)) f.push(rel + ': eigener HTTP-Weg');
    if (rel.endsWith('routes/vivi.js') && /viviClient/.test(ohneKommentar.replace(/services\/vivi\/viviClient\.js/g, ''))) f.push(rel + ': Route spricht den Client direkt an');
    if (rel.endsWith('viviClient.js')) {
      const m = ohneKommentar.match(/senden\(\s*'([A-Z]+)'/g) || [];
      const meth = m.map((x) => x.replace(/senden\(\s*'|'/g, ''));
      if (meth.filter((x) => x === 'PATCH').length !== 1 || meth.some((x) => x !== 'GET' && x !== 'POST' && x !== 'PATCH')) f.push(rel + ': senden() mit ' + meth.join(','));
      if (!/function get\(/.test(ohneKommentar) || !/function post\(/.test(ohneKommentar)) f.push(rel + ': get/post fehlen');
    }
  }
  return f;
}
const echtDateien = VIVI_DATEIEN.map((r) => [r, lies(r)]);
const befunde = nurLesenBefunde(echtDateien);
ok(!befunde.length, VIVI_DATEIEN.length + ' Dateien: kein PUT, DELETE an ViVi, PATCH nur einmal in einheitBeimAnlegen() aus anlegen(), fetch nur im Client' + (befunde.length ? ': ' + befunde.join(' | ') : ''));
{
  const cl = viviClient.erzeugen('test-token-12345', { fetch: async () => ({ status: 200, json: async () => ({ data: [] }) }) });
  ok(JSON.stringify(Object.keys(cl).sort()) === JSON.stringify(['einheitBeimAnlegen', 'get', 'post', 'zaehler']), 'der Client bietet nur get, post, einheitBeimAnlegen (und den Zähler)');
  let patchGesperrt = 0;
  for (const p of ['/projects/prj_1', '/projects/prj_1/rental-units/r1', '/projects/prj_1/financings/f1', '/projects/prj_1/units', '/projects/prj_1/units/u1/condition']) {
    try { await cl.einheitBeimAnlegen(p, { identifier: 'x' }); } catch (e) { if (e.code === 'pfad_gesperrt') patchGesperrt++; }
  }
  ok(patchGesperrt === 5 && operation('PATCH', '/projects/{project}/units/{unit}'), 'PATCH nur an /projects/{p}/units/{u} (5 andere Pfade abgewiesen), Pfad steht in der Spezifikation');
  let gesperrt = 0;
  for (const p of ['/projects/prj_1', '/projects/prj_1/rental-units/r1/end', '/projects/prj_1/financings/f1/split', '/rental-payments/1/mark-paid', '/contacts', '/projects/prj_1/rental-units/r1/rent-changes']) {
    try { await cl.post(p, {}); } catch (e) { if (e.code === 'pfad_gesperrt') gesperrt++; }
  }
  ok(gesperrt === 6, 'POST nur an Anlege-Pfade: 6 von 6 andere Pfade abgewiesen (Objekt ändern, Mietende, Aufteilung, bezahlt, Kontakte, Mietänderung)');
  let frei = 0;
  for (const p of ['/projects', '/projects/prj_1/units', '/projects/prj_1/rental-units', '/projects/prj_1/financings']) { try { await cl.post(p, {}); frei++; } catch (e) { /* */ } }
  ok(frei === 4 && viviClient.ANLEGEN_PFADE.length === 4, 'die vier Anlege-Pfade sind offen (Objekt, Einheit, Mietverhältnis, Darlehen)');
  const alle = viviClient.ANLEGEN_PFADE.every((re) => Object.keys(SPEC.paths).some((v) => re.test(v.replace(/\{[^}]+\}/g, 'x1')) && operation('POST', v)));
  ok(alle, 'jeder Anlege-Pfad ist ein POST-Pfad der Spezifikation');
  /* Gegenproben: je eine eingeschmuggelte Methode muss rot werden */
  const proben = [
    ['viviClient.js mit method: PATCH', 'backend/src/services/vivi/viviClient.js', (t) => t.replace("function get(pfad, abfrage) { return senden('GET', pfad, abfrage, null); }", "function get(pfad, abfrage) { return senden('PATCH', pfad, abfrage, null); }")],
    ['viviDienst.js mit eigenem fetch', 'backend/src/services/vivi/viviDienst.js', (t) => t + "\nfetch('https://app.vivi-immo.de/api/v1/projects/1', { method: 'DELETE' });\n"],
    ['viviMapping.js mit method: PUT', 'backend/src/services/vivi/viviMapping.js', (t) => t + "\nconst x = { method: 'PUT' };\n"],
    ['viviDienst.js ruft einheitBeimAnlegen auch im Abruf', 'backend/src/services/vivi/viviDienst.js', (t) => t.replace('const projekt = (await cl.get(P, q) || {}).data || {};', "await cl.einheitBeimAnlegen(P + '/units/x', {}); const projekt = (await cl.get(P, q) || {}).data || {};")],
    ['viviClient.js mit zweitem PATCH', 'backend/src/services/vivi/viviClient.js', (t) => t.replace("function get(pfad, abfrage) { return senden('GET', pfad, abfrage, null); }", "function get(pfad, abfrage) { return senden('GET', pfad, abfrage, null); }\n  function aendern(p, r) { return senden('PATCH', p, null, r); }")]
  ];
  for (const [name, rel, aendern] of proben) {
    const neu = aendern(lies(rel));
    const f = nurLesenBefunde(echtDateien.map(([r, t]) => [r, r === rel ? neu : t]));
    ok(neu !== lies(rel) && f.length > 0, 'Gegenprobe rot: ' + name);
  }
}

/* ═══ Attrappe nach der Spezifikation ════════════════════════════════════ */
function attrappe() {
  const st = { n: 0, projekte: {}, einheiten: {}, miete: {}, darlehen: {}, anfragen: [], posts: 0, stoerung: null, fehler: [] };
  const id = (p) => p + '_' + (++st.n).toString(36).padStart(4, '0');
  const projektRes = (p) => Object.assign({ name: p.name || (p.street + ' ' + p.house_number), description: null, area: null, project_type: 'bestand', planned_sale_date: null, vat_enabled: false,
    externally_managed_from: null, externally_managed_until: null, construction_year: null, real_estate_transfer_tax: null, notary: null, land_register: null, broker: null, other_costs: null },
    p, { units: Object.values(st.einheiten).filter((u) => u._p === p.id).map(einheitRes) });
  const einheitRes = (u) => ({ id: u.id, identifier: u.identifier, unit_type: u.unit_type || 'residential', square_meters: u.square_meters == null ? null : u.square_meters, rooms: null, floor: u.floor == null ? null : u.floor });
  const mieteRes = (r) => { const o = Object.assign({}, r); delete o._p; o.unit = einheitRes(st.einheiten[r.unit_id]); o.occupancy_type = 'rented'; o.is_special = false; o.co_tenants = []; o.amenities = (r.amenities || []).map((a, i) => Object.assign({ id: 'am' + i, vat_rate: null }, a)); return o; };
  const darlRes = (f) => { const o = Object.assign({ status: 'active', is_bullet_loan: false, is_repayment_substitute: false, is_savings_plan: false, initial_repayment: null, fixed_monthly_rate: null, fixed_interest_period: null, share_factor: 1, is_split: false, special_repayments: [], rate_overrides: [], shares: [] }, f); delete o._p; return o; };
  const antwort = (status, daten) => ({ status, json: async () => daten });
  async function holen(url, init) {
    const u = new URL(url);
    const pfad = u.pathname.replace(/^\/api\/v1/, '');
    const m = init.method;
    st.anfragen.push(m + ' ' + pfad);
    const vorlage = pfadVorlage(m, pfad);
    if (!vorlage) { st.fehler.push('Pfad nicht in der Spezifikation: ' + m + ' ' + pfad); return antwort(404, { message: 'nicht in der Spezifikation' }); }
    if (!/^Bearer \S+$/.test((init.headers || {}).Authorization || '')) return antwort(401, { message: 'Unauthenticated.' });
    let rumpf = null;
    if (m === 'PATCH') {
      st.patches = (st.patches || 0) + 1;
      rumpf = init.body ? JSON.parse(init.body) : {};
      const f = pruefeSchema(rumpf, deref(SPEC.components.schemas.UpdateUnitRequest), m + ' ' + vorlage);
      if (f.length) { st.fehler.push(...f); return antwort(422, { message: 'invalid', errors: f }); }
    }
    if (m === 'POST') {
      st.posts++;
      rumpf = init.body ? JSON.parse(init.body) : {};
      const f = pruefeSchema(rumpf, rumpfSchema('POST', vorlage), m + ' ' + vorlage);
      if (f.length) { st.fehler.push(...f); return antwort(422, { message: 'invalid', errors: f }); }
      if (st.stoerung && st.stoerung.nachPosts === st.posts) {
        const art = st.stoerung.art; st.stoerung = null;
        if (art === '429') return antwort(429, { message: 'Too Many Attempts.' });
        if (art === 'verloren') { await verarbeiten(m, pfad, rumpf); throw new Error('socket hang up'); }
      }
    }
    return verarbeiten(m, pfad, rumpf);
  }
  async function verarbeiten(m, pfad, b) {
    let x;
    if (m === 'GET' && pfad === '/accounts') return antwort(200, { data: [{ id: 'acc_1', name: 'Hauptaccount', label: 'Hauptaccount', is_master: true, is_default: true }, { id: 'acc_2', name: 'Muster GmbH', label: 'GmbH', is_master: false, is_default: false }] });
    if (m === 'POST' && pfad === '/projects') {
      const p = Object.assign({}, b, { id: id('prj') }); const n = p.units || 1; delete p.units;
      st.projekte[p.id] = p;
      for (let k = 0; k < n; k++) { const uid = id('unt'); st.einheiten[uid] = { id: uid, _p: p.id, identifier: 'Einheit ' + (k + 1), unit_type: 'residential' }; }
      return antwort(201, { data: projektRes(p) });
    }
    if (m === 'GET' && pfad === '/projects') return antwort(200, { data: Object.values(st.projekte).map(projektRes) });
    if ((x = /^\/projects\/([^/]+)$/.exec(pfad))) { const p = st.projekte[x[1]]; return p ? antwort(200, { data: projektRes(p) }) : antwort(404, {}); }
    if (m === 'PATCH' && (x = /^\/projects\/([^/]+)\/units\/([^/]+)$/.exec(pfad))) {
      const u = st.einheiten[x[2]]; if (!u || u._p !== x[1]) return antwort(404, {});
      Object.assign(u, b); return antwort(200, { data: einheitRes(u) });
    }
    if ((x = /^\/projects\/([^/]+)\/units$/.exec(pfad))) {
      if (!st.projekte[x[1]]) return antwort(404, {});
      if (m === 'GET') return antwort(200, { data: Object.values(st.einheiten).filter((u) => u._p === x[1]).map(einheitRes) });
      const uid = id('unt'); st.einheiten[uid] = Object.assign({ id: uid, _p: x[1] }, b); return antwort(201, { data: einheitRes(st.einheiten[uid]) });
    }
    if ((x = /^\/projects\/([^/]+)\/rental-units$/.exec(pfad))) {
      if (!st.projekte[x[1]]) return antwort(404, {});
      if (m === 'GET') return antwort(200, { data: Object.values(st.miete).filter((r) => r._p === x[1]).map(mieteRes) });
      let uid = b.unit_id;
      if (uid) { const u = st.einheiten[uid]; if (!u || u._p !== x[1]) return antwort(422, { message: 'unit_id' }); if (b.unit_identifier) u.identifier = b.unit_identifier; if (b.unit_square_meters != null) u.square_meters = b.unit_square_meters; if (b.unit_floor) u.floor = b.unit_floor; }
      else { if (!b.unit_identifier || b.unit_square_meters == null) return antwort(422, { message: 'neue Einheit braucht unit_identifier und unit_square_meters' }); uid = id('unt'); st.einheiten[uid] = { id: uid, _p: x[1], identifier: b.unit_identifier, square_meters: b.unit_square_meters, floor: b.unit_floor || null, unit_type: b.unit_type || 'residential' }; }
      if (Object.values(st.miete).some((r) => r.unit_id === uid)) return antwort(422, { message: 'Überschneidung' });
      const rid = id('ren');
      const r = { id: rid, _p: x[1], project_id: x[1], unit_id: uid };
      ['tenant_first_name', 'tenant_last_name', 'rent', 'monthly_utility_costs', 'rental_start', 'rent_due_day', 'rental_end', 'deposit_amount', 'last_rent_increase', 'contract_type', 'amenities'].forEach((k) => { if (k in b) r[k] = b[k]; });
      st.miete[rid] = r;
      return antwort(201, { data: mieteRes(r) });
    }
    if ((x = /^\/projects\/([^/]+)\/financings$/.exec(pfad))) {
      if (!st.projekte[x[1]]) return antwort(404, {});
      if (m === 'GET') return antwort(200, { data: Object.values(st.darlehen).filter((f) => f._p === x[1]).map(darlRes) });
      const fid = 'fin_' + (++st.n); st.darlehen[fid] = Object.assign({ id: fid, _p: x[1], project_id: x[1] }, b); return antwort(201, { data: darlRes(st.darlehen[fid]) });
    }
    if ((x = /^\/projects\/([^/]+)\/financing-schedule$/.exec(pfad))) {
      const L = Object.values(st.darlehen).filter((f) => f._p === x[1]);
      const zeilen = [];
      L.forEach((f) => { let rs = f.financing_amount; const rate = rs * ((f.interest_rate || 0) + (f.initial_repayment || 0)) / 1200; let d = new Date(f.financing_start_date);
        for (let k = 0; k < 24; k++) { const z = rs * (f.interest_rate || 0) / 1200; const t = Math.max(0, rate - z); const nach = rs - t;
          zeilen.push({ date: d.toISOString().slice(0, 10), remaining_debt: rs, interest: z, repayment: t, monthly_rate: rate, remaining_debt_after: nach, is_repayment_substitute: false, savings_rate: 0, savings_balance: 0 }); rs = nach; d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12); } });
      return antwort(200, { data: zeilen, meta: { months: zeilen.length } });
    }
    return antwort(404, { message: 'Attrappe kennt ' + m + ' ' + pfad + ' nicht' });
  }
  return { holen, st, projektRes, einheitRes, mieteRes, darlRes };
}
function speicherImArbeitsspeicher(objekte) {
  const v = {}, w = {}, prot = [];
  const zeit = { jetzt: Date.now() };
  return {
    prot, v, w, zeit,
    async objektHolen(u, o) { const x = objekte[o]; return x && x.user === u ? { id: o, data: x.data } : null; },
    async verknuepfung(u, o) { return v[o] && v[o].user_id === u ? Object.assign({}, v[o]) : null; },
    async beanspruchen(u, o, acc) {
      if (!v[o]) { v[o] = { object_id: o, user_id: u, vivi_objekt_id: null, vivi_account_id: acc, vivi_ids: {}, herkunft: 'angelegt', anlage_status: 'laeuft', aktualisiert: zeit.jetzt }; return { zeile: Object.assign({}, v[o]), fortsetzen: false }; }
      const z = v[o];
      if (z.user_id === u && z.herkunft === 'angelegt' && (z.anlage_status === 'abgebrochen' || (z.anlage_status === 'laeuft' && zeit.jetzt - z.aktualisiert > 10 * 60 * 1000))) { z.anlage_status = 'laeuft'; z.aktualisiert = zeit.jetzt; return { zeile: JSON.parse(JSON.stringify(z)), fortsetzen: true }; }
      return null;
    },
    async idsSpeichern(o, ids, pid) { v[o].vivi_ids = JSON.parse(JSON.stringify(ids)); if (pid) v[o].vivi_objekt_id = pid; v[o].aktualisiert = zeit.jetzt; },
    async statusSetzen(o, s, f) { v[o].anlage_status = s; v[o].letzter_fehler = f || null; v[o].aktualisiert = zeit.jetzt; },
    async zuordnen(u, o, pid, acc) { if (v[o]) return null; v[o] = { object_id: o, user_id: u, vivi_objekt_id: pid, vivi_account_id: acc, vivi_ids: {}, herkunft: 'zugeordnet', anlage_status: 'fertig' }; return v[o]; },
    async loesen(u, o) { if (!v[o] || v[o].user_id !== u) return false; delete v[o]; delete w[o]; return true; },
    async werteSchreiben(o, felder, info) { w[o] = []; Object.keys(felder).forEach((k) => w[o].push({ feld: k, jahr: 0, wert: felder[k].wert, vivi_quelle: felder[k].quelle, gelesen_am: new Date(zeit.jetzt).toISOString() }));
      Object.keys(info || {}).forEach((k) => { if (info[k] != null) w[o].push({ feld: '_info.' + k, jahr: 0, wert: info[k], vivi_quelle: null }); }); v[o].letzter_abruf = new Date(zeit.jetzt).toISOString(); },
    async abrufFehler(o, t) { if (v[o]) v[o].letzter_fehler = t; },
    async werteLesen(o) { return w[o] || []; },
    async verknuepfteObjekte(u) { return Object.values(v).filter((x) => x.user_id === u); },
    async faelligeAbrufe() { return Object.values(v).filter((x) => x.anlage_status === 'fertig' && x.vivi_objekt_id).map((x) => ({ object_id: x.object_id, user_id: x.user_id })); },
    async protokoll(e) { prot.push(e); }
  };
}

/* ═══ D · Einmal anlegen ═════════════════════════════════════════════════ */
kopf('D  Einmal anlegen, Ende zu Ende gegen die Attrappe');
const TOKEN = 'vivi-testtoken-NIEMALS-ECHT-7f3a';
const USER = '11111111-1111-4111-8111-111111111111';
const objekte = {};
FAELLE.forEach((fa, i) => { objekte['00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0')] = { user: USER, data: fa.d, nr: fa.nr }; });
const A = attrappe();
const SP = speicherImArbeitsspeicher(objekte);
const tresor = { [USER]: TOKEN };
viviClient._fensterLeeren();
setzeDeps({
  speicher: SP,
  creds: { getSecret: async (u) => tresor[u] || null, getMeta: async (u) => (tresor[u] ? { exists: true, hint: tresor[u].slice(-4) } : { exists: false }), setCredential: async (u, p, s) => { tresor[u] = s; return { exists: true, hint: s.slice(-4) }; }, remove: async (u) => { delete tresor[u]; return { exists: false }; } },
  client: (t, o) => viviClient.erzeugen(t, Object.assign({}, o, { fetch: A.holen, maxWarten: 0 })),
  jetzt: () => SP.zeit.jetzt,
  schlafen: async () => {}
});
const OIDS = Object.keys(objekte);
let alleAngelegt = true;
for (const oid of OIDS) {
  try { const r = await dienst.anlegen(USER, oid, { platzhalter_namen: false }); if (!r.ok) alleAngelegt = false; }
  catch (e) { alleAngelegt = false; console.log('        ' + objekte[oid].nr + ': ' + e.message + (e.details ? ' ' + JSON.stringify(e.details).slice(0, 300) : '')); }
}
ok(alleAngelegt && !A.st.fehler.length, OIDS.length + ' Objekte angelegt, die Attrappe fand keine Abweichung von der Spezifikation' + (A.st.fehler.length ? ': ' + A.st.fehler.slice(0, 5).join(' | ') : ''));
ok(Object.keys(A.st.projekte).length === OIDS.length, 'je Objekt genau ein ViVi-Objekt (' + Object.keys(A.st.projekte).length + ')');
{
  let erwartetE = 0, erwartetM = 0, erwartetD = 0;
  OIDS.forEach((o) => { const p = mapping.nachVivi(objekte[o].data, {}); erwartetE += p.einheiten.length; erwartetM += p.einheiten.filter((e) => e.miete).length; erwartetD += p.darlehen.length; });
  ok(Object.keys(A.st.einheiten).length === erwartetE, 'Einheiten in ViVi = Einheiten in DealPilot (' + Object.keys(A.st.einheiten).length + ' von ' + erwartetE + ', die von ViVi selbst angelegte mitgezählt)');
  ok(Object.keys(A.st.miete).length === erwartetM && Object.keys(A.st.darlehen).length === erwartetD, 'Mietverhältnisse ' + Object.keys(A.st.miete).length + '/' + erwartetM + ', Darlehen ' + Object.keys(A.st.darlehen).length + '/' + erwartetD);
  const ohneFlaeche = Object.values(A.st.einheiten).filter((u) => !(u.square_meters > 0) && objekte[Object.keys(SP.v).find((k) => SP.v[k].vivi_objekt_id === u._p)].data._mfh);
  ok(!ohneFlaeche.length, 'jede MFH-Einheit trägt in ViVi ihre Fläche (auch die von ViVi angelegte erste)');
  const patches = A.st.anfragen.filter((a) => a.startsWith('PATCH '));
  const ohneMiete = OIDS.filter((o) => !mapping.nachVivi(objekte[o].data, {}).einheiten.some((e) => e.miete)).length;
  ok(A.st.anfragen.every((a) => /^(GET|POST) /.test(a) || /^PATCH \/projects\/[^/]+\/units\/[^/]+$/.test(a)) && patches.length === ohneMiete && ohneMiete >= 1,
    'die Attrappe sah GET und POST, PATCH nur an die automatische Einheit, genau ' + patches.length + ' mal (Objekte ohne vermietete Einheit: ' + ohneMiete + ')');
  const zl = OIDS.find((o) => objekte[o].nr === 'zfh-leer');
  const zu = Object.values(A.st.einheiten).filter((u) => u._p === SP.v[zl].vivi_objekt_id).map((u) => u.identifier + ':' + u.square_meters).sort().join(' | ');
  ok(zu === 'WE 1 · EG / OG:141.7 | WE 2 · DG:103.38', 'ZFH ohne Mieter: beide Einheiten mit Name und Fläche in ViVi, keine „Einheit 1“ (' + zu + ')');
}
{
  const oid = OIDS[0], postsVorher = A.st.posts;
  let code = null; try { await dienst.anlegen(USER, oid, {}); } catch (e) { code = e.status + ' ' + e.code; }
  ok(code === '409 bereits_angelegt' && A.st.posts === postsVorher, 'zweites Anlegen: 409, kein einziger POST an ViVi');
  SP.v[OIDS[1]].anlage_status = 'laeuft'; SP.v[OIDS[1]].aktualisiert = SP.zeit.jetzt;
  code = null; try { await dienst.anlegen(USER, OIDS[1], {}); } catch (e) { code = e.status + ' ' + e.code; }
  ok(code === '409 laeuft' && A.st.posts === postsVorher, 'gleichzeitiges Anlegen (Zeile läuft): 409, nichts gesendet');
  SP.v[OIDS[1]].anlage_status = 'fertig';
  code = null; try { await dienst.anlegen('22222222-2222-4222-8222-222222222222', oid, {}); } catch (e) { code = e.status; }
  ok(code === 404, 'fremder Nutzer: 404 (Objekt gehört ihm nicht)');
}
/* Fortsetzen nach 429 und nach verlorener Antwort */
for (const [art, nach] of [['429', 3], ['verloren', 2], ['verloren', 1]]) {
  const B = attrappe();
  const objs = { 'aaaaaaaa-0000-4000-8000-000000000001': { user: USER, data: FAELLE.find((x) => x.nr === '2026-1041').d } };
  const S2 = speicherImArbeitsspeicher(objs);
  viviClient._fensterLeeren();
  setzeDeps({ speicher: S2, creds: { getSecret: async () => TOKEN }, client: (t, o) => viviClient.erzeugen(t, Object.assign({}, o, { fetch: B.holen, maxWarten: 0 })), jetzt: () => S2.zeit.jetzt, schlafen: async () => {} });
  const oid = Object.keys(objs)[0];
  B.st.stoerung = { nachPosts: nach, art: art };
  let erst = null; try { await dienst.anlegen(USER, oid, {}); } catch (e) { erst = e; }
  const status1 = S2.v[oid].anlage_status;
  let zweit = null; try { zweit = await dienst.anlegen(USER, oid, {}); } catch (e) { zweit = e; }
  const p = mapping.nachVivi(objs[oid].data, {});
  ok(erst && status1 === 'abgebrochen' && erst.fortsetzbar && zweit && zweit.ok && zweit.fortgesetzt
    && Object.keys(B.st.projekte).length === 1 && Object.keys(B.st.einheiten).length === p.einheiten.length && Object.keys(B.st.miete).length === p.einheiten.filter((e) => e.miete).length && Object.keys(B.st.darlehen).length === p.darlehen.length,
    'Abbruch durch ' + (art === '429' ? '429' : 'verlorene Antwort') + ' beim ' + nach + '. POST: Zeile abgebrochen, Fortsetzen ergänzt, nichts doppelt (' + Object.keys(B.st.projekte).length + ' Objekt, ' + Object.keys(B.st.einheiten).length + ' Einheiten, ' + Object.keys(B.st.miete).length + ' Mietverhältnisse)');
}

/* ═══ E · Lesen ViVi -> DealPilot ════════════════════════════════════════ */
kopf('E  Lesen ViVi -> DealPilot');
setzeDeps({ speicher: SP, creds: { getSecret: async (u) => tresor[u] || null }, client: (t, o) => viviClient.erzeugen(t, Object.assign({}, o, { fetch: A.holen, maxWarten: 0 })), jetzt: () => SP.zeit.jetzt, schlafen: async () => {} });
viviClient._fensterLeeren();
/* Jede Antwort der Attrappe ist selbst gegen das Resource-Schema geprueft */
{
  const f = [];
  Object.values(A.st.projekte).forEach((p) => f.push(...pruefeSchema(A.projektRes(p), SPEC.components.schemas.ProjectResource, 'ProjectResource')));
  Object.values(A.st.miete).forEach((r) => f.push(...pruefeSchema(A.mieteRes(r), SPEC.components.schemas.RentalUnitResource, 'RentalUnitResource').filter((x) => !/Pflichtfeld/.test(x))));
  /* Die Spezifikation fuehrt einige Datumsfelder als reinen string, beschreibt aber null ("null = bis heute"). Die Attrappe liefert null wie ViVi. */
  f.splice(0, f.length, ...f.filter((x) => !/(planned_sale_date|externally_managed_from|externally_managed_until|rental_end|tenant_date_of_birth|maturity_date|repayment_free_until_date|fixed_interest_end_date|financing_end_date|last_rent_increase|deposit_\w+_date): null nicht erlaubt/.test(x)));
  ok(!f.length, 'Antworten der Attrappe passen zu ProjectResource und RentalUnitResource' + (f.length ? ': ' + f.slice(0, 4).join(' | ') : ''));
}
/* Welche ViVi-Felder liest ausVivi? Ueber Proxies gemessen, gegen die Resource-Schemas */
function beobachtet(obj, schema, name, gelesen) {
  const props = deref(schema).properties || {};
  return new Proxy(obj, { get(t, k) { if (typeof k === 'string' && !(k in Object.prototype) && k !== 'toJSON' && k !== 'then') gelesen.push([name, k, k in props]); return t[k]; } });
}
const gelesen = [];
const FIELDS_TEXT = lies('frontend/js/storage.js');
const HTML = lies('frontend/index.html');
const MV_FELDER = (lies('frontend/js/mfh-einheiten.js').match(/var MV_FELDER = \[([\s\S]*?)\];/) || [, ''])[1];
const ID_DA = (id) => new RegExp('id="' + id + '"').test(HTML) && new RegExp("'" + id + "'").test(FIELDS_TEXT);
let rundOk = 0, rundAlle = 0; const rundFehler = [];
for (const oid of OIDS) {
  const d = objekte[oid].data;
  viviClient._fensterLeeren();
  const r = await dienst.abrufen(USER, oid);
  const v = SP.v[oid];
  /* Proxy-Lauf auf denselben Antworten: welche Felder fasst ausVivi an? */
  const pr = A.st.projekte[v.vivi_objekt_id];
  const paket = {
    projekt: beobachtet(A.projektRes(pr), SPEC.components.schemas.ProjectResource, 'ProjectResource', gelesen),
    einheiten: Object.values(A.st.einheiten).filter((u) => u._p === pr.id).map((u) => beobachtet(A.einheitRes(u), SPEC.components.schemas.UnitResource, 'UnitResource', gelesen)),
    mietverhaeltnisse: Object.values(A.st.miete).filter((x) => x._p === pr.id).map((x) => beobachtet(A.mieteRes(x), SPEC.components.schemas.RentalUnitResource, 'RentalUnitResource', gelesen)),
    darlehen: Object.values(A.st.darlehen).filter((x) => x._p === pr.id).map((x) => beobachtet(A.darlRes(x), SPEC.components.schemas.FinancingResource, 'FinancingResource', gelesen)),
    tilgungsplan: { data: [] }
  };
  mapping.ausVivi(paket, { vivi_ids: v.vivi_ids, mitEinheiten: !!d._mfh, objart: d.objart, jetzt: SP.zeit.jetzt });
  /* Rundweg: was hingeschickt wurde, kommt gleich zurueck */
  const F = r.felder, z = mapping.zahl;
  const pruefe = (feld, soll) => { rundAlle++; const ist = F[feld] && F[feld].wert; const g = (typeof soll === 'number') ? Math.abs(z(ist) - soll) < 0.01 : String(ist) === String(soll); if (g) rundOk++; else rundFehler.push(objekte[oid].nr + ' ' + feld + ': ' + JSON.stringify(ist) + ' statt ' + JSON.stringify(soll)); };
  pruefe('kp', z(d.kp)); pruefe('str', d.str); pruefe('plz', d.plz); pruefe('wirtschaftlicher_uebergang', d.wirtschaftlicher_uebergang);
  if (z(d.makler_p) > 0) pruefe('makler_p', Math.round(z(d.makler_p) * 100) / 100);
  pruefe('d1', z(d.d1)); pruefe('d1z', z(d.d1z)); if (d.d1_type !== 'tilgungsaussetzung') pruefe('d1t', z(d.d1t)); pruefe('bank_inst', d.bank_inst);
  if (d._mfh) {
    d._mfh.einheiten.forEach((e, i) => {
      if (z(e.wfl) > 0) pruefe('einheit.' + i + '.wfl', z(e.wfl));
      pruefe('einheit.' + i + '.status', e.status === 'leer' ? 'leer' : 'vermietet');
      if (e.status !== 'leer') { pruefe('einheit.' + i + '.ist', z(e.ist)); pruefe('einheit.' + i + '.mv_beginn', e.mv_beginn); if (z(e.stellplatz_miete) > 0) pruefe('einheit.' + i + '.stellplatz_miete', z(e.stellplatz_miete)); }
    });
  } else {
    pruefe('wfl', z(d.wfl)); pruefe('nkm', z(d.nkm)); pruefe('mv_beginn', d.mv_beginn); if (d.mv_art) pruefe('mv_art', d.mv_art); if (z(d.ze_stp_monat) > 0) pruefe('ze_stp_monat', z(d.ze_stp_monat));
    if (String(d.objart).toUpperCase() === 'ETW') pruefe('etage', d.etage || '0');
  }
  /* jedes Ziel-Feld gibt es in DealPilot */
  Object.keys(F).forEach((feld) => {
    const m = /^einheit\.\d+\.(\w+)$/.exec(feld);
    const da = m ? (['wfl', 'ist', 'status'].includes(m[1]) || new RegExp("'" + m[1] + "'").test(MV_FELDER)) : ID_DA(feld);
    if (!da) rundFehler.push(objekte[oid].nr + ': Ziel-Feld ' + feld + ' gibt es in DealPilot nicht (index.html/FIELDS bzw. Einheiten-Felder)');
  });
}
ok(!rundFehler.length && rundAlle > 100, 'Rundweg Feld für Feld: ' + rundOk + ' von ' + rundAlle + ' Werten kommen gleich zurück, jedes Ziel-Feld existiert' + (rundFehler.length ? ':\n        ' + rundFehler.slice(0, 10).join('\n        ') : ''));
const unbekannt = [...new Set(gelesen.filter((g) => !g[2]).map((g) => g[0] + '.' + g[1]))];
ok(gelesen.length > 50 && !unbekannt.length, 'ausVivi liest nur Felder aus den Resource-Schemas (' + new Set(gelesen.map((g) => g[0] + '.' + g[1])).size + ' verschiedene)' + (unbekannt.length ? ': unbekannt ' + unbekannt.join(', ') : ''));
{
  /* feste Rate statt Tilgung, Zinsbindung als Datum, Leerstand aus fehlendem Mietverhaeltnis, Restschuld heute */
  const erg = mapping.ausVivi({
    projekt: { id: 'p', street: 'a', purchase_price: 100000 },
    einheiten: [{ id: 'u1', identifier: 'WE 1', unit_type: 'residential', square_meters: 50 }, { id: 'u2', identifier: 'WE 2', unit_type: 'residential', square_meters: 60 }, { id: 'g', identifier: 'Garage', unit_type: 'ancillary' }],
    mietverhaeltnisse: [{ id: 'r1', unit_id: 'u1', rent: 500, rental_start: '2020-01-01', occupancy_type: 'rented' }, { id: 'r0', unit_id: 'u2', rent: 400, rental_start: '2015-01-01', rental_end: '2019-12-31', occupancy_type: 'rented' }],
    darlehen: [{ id: 'f1', financing_amount: 120000, interest_rate: 4, initial_repayment: null, fixed_monthly_rate: 600, fixed_interest_end_date: '2034-01-01', financing_start_date: '2024-01-01', financing_type: 'primary' }],
    tilgungsplan: { data: [{ date: '2026-10-01', remaining_debt_after: 115000 }, { date: '2026-11-01', remaining_debt_after: 114800 }, { date: '2099-01-01', remaining_debt_after: 1 }] }
  }, { vivi_ids: {}, mitEinheiten: true, objart: 'MFH', jetzt: Date.parse('2026-11-22T10:00:00Z') });
  ok(erg.felder.d1t && erg.felder.d1t.wert === 2, 'Tilgung aus fester Rate: 600 × 12 / 120.000 − 4 % = 2 %');
  ok(erg.felder.d1_bindj && erg.felder.d1_bindj.wert === '10', 'Zinsbindung aus Enddatum: 2024 bis 2034 = 10 Jahre');
  ok(erg.felder['einheit.1.status'] && erg.felder['einheit.1.status'].wert === 'leer' && erg.felder['einheit.0.ist'].wert === 500, 'Leerstand aus beendetem Mietverhältnis, Garage (ancillary) ist keine Wohneinheit');
  ok(erg.info.restschuld_heute && erg.info.restschuld_heute.wert === 114800, 'Restschuld heute aus dem Tilgungsplan (Gegenprobe, kein Eingabefeld)');
}
{
  /* Zuordnen: nichts geht an ViVi, nur ein GET */
  const vorher = A.st.anfragen.length, posts = A.st.posts;
  const neuOid = 'bbbbbbbb-0000-4000-8000-000000000009';
  objekte[neuOid] = { user: USER, data: FAELLE[2].d };
  const r = await dienst.zuordnen(USER, neuOid, Object.keys(A.st.projekte)[2], null);
  ok(r.ok && A.st.posts === posts && A.st.anfragen.slice(vorher).every((a) => a.startsWith('GET ')), 'Zuordnen eines vorhandenen ViVi-Objekts: nur GET, kein POST');
  viviClient._fensterLeeren();   /* v3966 · der Abruf liest jetzt auch den Mietverlauf je Mietverhaeltnis */
  const w = await dienst.abrufen(USER, neuOid);
  ok(w.felder.kp && w.felder.wfl, 'zugeordnetes Objekt wird gelesen (Einheiten in ViVi-Reihenfolge)');
  const l = await dienst.loesen(USER, neuOid);
  ok(l.ok && !SP.v[neuOid] && Object.keys(A.st.projekte).length === OIDS.length && A.st.posts === posts, 'Lösen entfernt nur die DealPilot-Seite, ViVi bleibt unverändert');
}

/* ═══ F · Anfragebremse ══════════════════════════════════════════════════ */
kopf('F  Anfragebremse');
{
  viviClient._fensterLeeren();
  let n = 0; let t = 1000;
  const cl = viviClient.erzeugen('bremsen-test-token', { fetch: async () => { n++; return { status: 200, json: async () => ({ data: [] }) }; }, jetzt: () => t, maxWarten: 0 });
  for (let i = 0; i < 50; i++) await cl.get('/accounts');
  let code = null; try { await cl.get('/accounts'); } catch (e) { code = e.code; }
  ok(n === 50 && code === 'bremse_lokal', 'höchstens 50 Anfragen je Minute und Token, die 51. wird nicht gesendet');
  t += 60 * 1000 + 10;
  await cl.get('/accounts');
  ok(n === 51, 'nach Ablauf der Minute geht es weiter');
  let gewartet = 0;
  const cl2 = viviClient.erzeugen('bremsen-test-token', { fetch: async () => { n++; return { status: 200, json: async () => ({}) }; }, jetzt: () => t, schlafen: async (ms) => { gewartet += ms; t += ms; }, maxWarten: 70000 });
  for (let i = 0; i < 50; i++) await cl2.get('/accounts');
  ok(gewartet > 0 && gewartet <= 61000, 'mit Wartezeit (Takt, Anlegen) wartet der Client auf den nächsten freien Platz statt zu überziehen (' + Math.round(gewartet / 1000) + ' s)');
  viviClient._fensterLeeren();
  let m = 0;
  const c3 = viviClient.erzeugen('t429-token-abcdef', { fetch: async () => { m++; return { status: 429, json: async () => ({ message: 'Too Many Attempts.' }) }; } });
  let c1 = null, c2 = null; try { await c3.get('/projects'); } catch (e) { c1 = e.code; } try { await c3.get('/projects'); } catch (e) { c2 = e.code; }
  ok(c1 === 'bremse_429' && c2 === 'bremse_429' && m === 1 && c3.zaehler.bremse429, '429 bricht ab, die nächste Anfrage dieser Runde wird gar nicht mehr gesendet (1 Anfrage)');
  const quelle = lies('backend/src/services/vivi/viviClient.js');
  ok(!/retry|wiederhol\w*\s*\(/i.test(quelle.replace(/\/\*[\s\S]*?\*\//g, '')), 'keine Wiederholungsschleife im Client');
  /* Takt bricht die Runde eines Nutzers bei 429 ab */
  const C = attrappe(); const S3 = speicherImArbeitsspeicher({});
  S3.v['o1'] = { object_id: 'o1', user_id: USER, vivi_objekt_id: 'x', anlage_status: 'fertig', vivi_ids: {} }; S3.v['o2'] = Object.assign({}, S3.v['o1'], { object_id: 'o2' });
  let anfragen = 0;
  setzeDeps({ speicher: Object.assign(S3, { objektHolen: async (u, o) => ({ id: o, data: {} }) }), creds: { getSecret: async () => TOKEN },
    client: (tk, o) => viviClient.erzeugen(tk, Object.assign({}, o, { fetch: async () => { anfragen++; return { status: 429, json: async () => ({}) }; }, maxWarten: 0 })), jetzt: () => Date.now(), schlafen: async () => {} });
  viviClient._fensterLeeren();
  const s = await dienst.taktLauf();
  ok(anfragen === 1 && s.bremse === 1 && s.objekte === 0, 'Takt: 429 beim ersten Objekt beendet die Runde dieses Nutzers (1 Anfrage, zweites Objekt nicht gefragt)');
}

/* ═══ G · Takt ═══════════════════════════════════════════════════════════ */
kopf('G  Takt viviAbruf');
{
  const ts = require(P('backend/src/utils/taktSperre.js'));
  ok(ts.SCHLUESSEL.viviAbruf === 11, 'SCHLUESSEL viviAbruf = 11 in utils/taktSperre.js');
  const q = lies('backend/src/services/vivi/viviDienst.js');
  ok(/const _viviAbruf = _ts\.takt\('viviAbruf'/.test(q) && /setInterval\(_viviAbruf,/.test(q), 'setInterval(_viviAbruf) läuft unter _ts.takt(\'viviAbruf\')');
  ok(/require\('\.\/services\/vivi\/viviDienst'\)\.starteTakt\(\)/.test(lies('backend/src/index.js')), 'index.js startet den Takt');
}

/* ═══ H · Frontend ═══════════════════════════════════════════════════════ */
kopf('H  Frontend: Felder, Hinweis, Ausgrauen');
{
  const fieldsBlock = (function () { const a = FIELDS_TEXT.indexOf('var FIELDS = ['); if (a < 0) return ''; const r = FIELDS_TEXT.slice(a + 14); const e = r.search(/\n(var|function|const|let) /); return e < 0 ? r : r.slice(0, e); })();   /* bis zur naechsten Deklaration am Zeilenanfang */
  ok(/'_vivi'/.test(fieldsBlock) && /'nk_vorauszahlung'/.test(fieldsBlock), "storage.js FIELDS führt '_vivi' und 'nk_vorauszahlung' (sonst fallen sie beim Speichern lautlos weg)");
  ok(/id="_vivi"/.test(HTML) && /id="nk_vorauszahlung"/.test(HTML), 'index.html: verstecktes Feld _vivi und Eingabe nk_vorauszahlung');
  const dz = lies('frontend/js/data/detailgrad-zuordnung.js');
  const z = {}; vm.runInNewContext(dz, { window: z });
  const s2 = z.DpDetailgradZuordnung.reiter.s2;
  ok(s2['2'].felder.includes('nk_vorauszahlung') && !s2['1'].felder.includes('nk_vorauszahlung'), 'nk_vorauszahlung ab Detailgrad Fortgeschritten (nicht Einsteiger)');
  ok(/f\('nk_vorauszahlung'/.test(lies('frontend/js/mfh-einheiten.js')), 'MFH: je Wohnung das Feld nk_vorauszahlung im Wohnungsfenster');
  const vf = lies('frontend/js/vivi-felder.js');
  ok(vf.includes("var HINWEIS = 'Verknüpft mit ViVi, der Wert kommt aus ViVi, Änderungen bitte in ViVi.';"), 'Hinweis Zeichen für Zeichen: „Verknüpft mit ViVi, der Wert kommt aus ViVi, Änderungen bitte in ViVi.“');
  const ohneK = vf.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/data-vivi-ro/.test(ohneK) && !/data-mff-ro/.test(ohneK) && !/mff-gesperrt/.test(ohneK), 'eigenes Merkattribut data-vivi-ro, kein data-mff-ro und keine mff-Klasse (mfh-felder.js bleibt unberührt)');
  ok(!/["'`]\/vivi\//.test(ohneK), 'vivi-felder.js spricht nicht mit dem Backend (das tut nur vivi.js hinter DpVorschau.frei)');
  ok(/DpVorschau\.frei\('vivi'\)/.test(lies('frontend/js/vivi.js')), "vivi.js fragt DpVorschau.frei('vivi')");

  /* Nachgebautes Formular: setzen, sperren, eigen, loesen */
  function feldbau() {
    const els = {};
    function mk(id, tag, wert) {
      const attrs = {}; const cls = new Set();
      const el = { id, tagName: tag || 'INPUT', value: wert || '', readOnly: false, title: '', placeholder: '',
        classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
        setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null), hasAttribute: (k) => k in attrs, removeAttribute: (k) => { delete attrs[k]; },
        dispatchEvent: () => true, insertAdjacentElement: () => {}, focus: () => {} };
      el.parentNode = { querySelector: () => null, querySelectorAll: () => [] };
      els[id] = el; return el;
    }
    mk('kp', 'INPUT', '400000'); mk('wfl', 'INPUT', '80'); mk('mv_art', 'SELECT', ''); mk('_vivi', 'INPUT', ''); mk('nkm', 'INPUT', '700');
    const doc = { createElement: (tag) => mk('neu' + Object.keys(els).length, String(tag).toUpperCase()), getElementById: (id) => els[id] || null, querySelectorAll: (s) => (/vivi-verknuepft/.test(s) ? Object.values(els).filter((e) => e.classList.contains('vivi-verknuepft') || e.classList.contains('vivi-eigen')) : []) };
    return { els, doc };
  }
  function lauf(quelle) {
    const fb = feldbau();
    const ctx = frontendModul('frontend/js/vivi-felder.js', { document: fb.doc });
    if (quelle) vm.runInContext(quelle.replace('if (window.DpViviFelder) return;', ''), ctx);
    return { F: ctx.DpViviFelder, els: fb.els };
  }
  const stand = { verknuepft: true, letzter_abruf: '2026-11-22T13:05:00Z', felder: { kp: { wert: 465000 }, wfl: { wert: 82.5 }, mv_art: { wert: 'index' } }, info: {} };
  let t = lauf();
  const geaendert = t.F.setzen(stand);
  const kp = t.els.kp, wfl = t.els.wfl, sel = t.els.mv_art;
  ok(geaendert && kp.value === '465000' && wfl.value === '82,5' && sel.value === 'index', 'ViVi-Werte kommen ins Formular (465000, 82,5 im deutschen Format, Select)');
  ok(kp.readOnly && kp.classList.contains('vivi-verknuepft') && kp.getAttribute('data-vivi-ro') === '0' && kp.title.indexOf(t.F.HINWEIS) === 0 && /Stand \d\d\.\d\d\.2026/.test(kp.title), 'Feld gesperrt: readOnly, Klasse, eigenes Merkattribut, Hinweis mit Stand im title');
  ok(sel.getAttribute('tabindex') === '-1' && sel.classList.contains('vivi-verknuepft'), 'Select gesperrt (tabindex -1, pointer-events über die Klasse)');
  ok(t.els.nkm.readOnly === false && !t.els.nkm.classList.contains('vivi-verknuepft'), 'nicht verknüpftes Feld bleibt frei');
  const v = JSON.parse(t.els._vivi.value);
  ok(v.verknuepft && v.felder.kp === 465000, '_vivi im Objekt: Spiegel der ViVi-Werte');
  /* eigene Angabe: der Kunde hat kp lokal festgelegt */
  t.els._vivi.value = JSON.stringify({ verknuepft: true, felder: {}, eigen: { kp: '455000' } });
  kp.value = '455000';
  t.F.setzen(stand);
  ok(kp.value === '455000' && !kp.readOnly && kp.classList.contains('vivi-eigen') && /ViVi führt 465000/.test(kp.title), 'lokal überschrieben: Wert bleibt, Feld frei, Hinweis nennt den ViVi-Wert, nichts geht nach ViVi');
  t.F.setzen({ verknuepft: false });
  ok(!wfl.readOnly && !wfl.classList.contains('vivi-verknuepft') && wfl.getAttribute('data-vivi-ro') === null && t.els._vivi.value === '', 'Verknüpfung gelöst: alte Sperre zurück (readOnly wie vorher), _vivi leer');
  /* Gegenprobe: anderer Hinweistext bzw. fremdes Merkattribut */
  const quelle = lies('frontend/js/vivi-felder.js');
  t = lauf(quelle.replace("'Verknüpft mit ViVi, der Wert kommt aus ViVi, Änderungen bitte in ViVi.'", "'Kommt aus ViVi'"));
  t.F.setzen(stand);
  ok(t.els.kp.title.indexOf('Verknüpft mit ViVi, der Wert kommt aus ViVi, Änderungen bitte in ViVi.') !== 0, 'Gegenprobe rot: geänderter Hinweistext fällt auf');
  t = lauf(quelle.split("'data-vivi-ro'").join("'data-mff-ro'"));
  t.F.setzen(stand);
  ok(t.els.kp.getAttribute('data-vivi-ro') === null, 'Gegenprobe rot: fremdes Merkattribut fällt auf');
}

/* ═══ I · Token ══════════════════════════════════════════════════════════ */
kopf('I  Token');
{
  const alles = JSON.stringify(SP.prot) + JSON.stringify(SP.v) + JSON.stringify(SP.w);
  ok(SP.prot.length > 10 && !alles.includes(TOKEN) && !alles.includes(TOKEN.slice(0, 12)), 'Token nie im Protokoll, nie in der Verknüpfung, nie in vivi_werte (' + SP.prot.length + ' Protokolleinträge)');
  setzeDeps({ speicher: SP, creds: { getSecret: async () => TOKEN, getMeta: async () => ({ exists: true, hint: TOKEN.slice(-4) }) }, client: (tk, o) => viviClient.erzeugen(tk, Object.assign({}, o, { fetch: async () => ({ status: 401, json: async () => ({ message: 'Unauthenticated.' }) }), maxWarten: 0 })), jetzt: () => Date.now(), schlafen: async () => {} });
  let msg = ''; try { await dienst.probe(USER); } catch (e) { msg = e.message + JSON.stringify(e); }
  const meta = JSON.stringify(await dienst.verbindungMeta(USER));
  ok(msg && !msg.includes(TOKEN) && /401/.test(msg) && !meta.includes(TOKEN.slice(0, -4)), 'Fehler 401 und Verbindungsstatus nennen den Token nicht (nur die letzten vier Zeichen)');
  const grepToken = [...VIVI_DATEIEN, 'frontend/js/vivi.js', 'frontend/js/vivi-felder.js'].filter((r) => /Bearer\s+[A-Za-z0-9]{16,}|VIVI_TOKEN|process\.env\.VIVI/.test(lies(r)));
  ok(!grepToken.length, 'kein Token im Code, keine VIVI_TOKEN-Umgebungsvariable' + (grepToken.length ? ': ' + grepToken.join(', ') : ''));
  const envs = ['.env.example', 'backend/.env.example'].filter((f) => fs.existsSync(P(f)) && /VIVI/i.test(lies(f)));
  ok(!envs.length, 'keine ViVi-Zeile in den .env-Vorlagen');
  const r = lies('backend/src/routes/vivi.js');
  ok(/router\.use\(vorschau\.sperre\('vivi'\)\)/.test(r) && !/credentials\/reveal|reveal/.test(r), "Route hinter vorschau.sperre('vivi'), kein Anzeigen des Tokens");
}

/* ═══ J · Kundentext ═════════════════════════════════════════════════════ */
kopf('J  Kundentext ohne Gedankenstrich und Semikolon');
{
  const texte = [];
  FAELLE.forEach((fa) => { const p = mapping.nachVivi(fa.d, { platzhalterNamen: true }); texte.push(...p.hinweise, ...p.fehlt.map((x) => x.text), ...p.vorschau.map((x) => x.feld + ' ' + x.wert + ' ' + x.notiz)); });
  texte.push(...mapping.nachVivi({ objart: 'XYZ' }, {}).fehlt.map((x) => x.text), ...mapping.nachVivi({ objart: 'XYZ' }, {}).hinweise);
  const schlecht = texte.filter((x) => /[–—;]/.test(x));
  ok(texte.length > 50 && !schlecht.length, texte.length + ' Texte der Vorschau ohne – — ;' + (schlecht.length ? ': ' + schlecht.slice(0, 3).join(' | ') : ''));
  const datei = ['frontend/js/vivi.js', 'frontend/js/vivi-felder.js', 'frontend/js/nk-vorauszahlung.js', 'backend/src/services/vivi/viviDienst.js', 'backend/src/services/vivi/viviClient.js'];
  const funde = [];
  datei.forEach((rel) => {
    const t = lies(rel).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((z) => !/^\s*\/\//.test(z)).join('\n');
    const re = /'((?:[^'\\\n]|\\.)*)'/g; let m;
    while ((m = re.exec(t))) {
      const s = m[1];
      if (!/[A-Za-zÄÖÜäöüß]{3,} [A-Za-zÄÖÜäöüß]{2,}/.test(s)) continue;            /* nur Saetze */
      if (/[{}]|style=|px|rgba|var\(--|@media|font:/.test(s)) continue;          /* CSS und Markup-Attribute */
      if (/[–—]/.test(s) || /;\s*\S/.test(s.replace(/&[a-z]+;/g, ''))) funde.push(rel + ': ' + s.slice(0, 70));
    }
  });
  ok(!funde.length, 'Kundentexte in ' + datei.length + ' Dateien ohne – — ;' + (funde.length ? ':\n        ' + funde.slice(0, 6).join('\n        ') : ''));
}


/* ═══ K · Testbetrieb: Musteranschrift (v3951) ═══════════════════════════ */
kopf('K  Testbetrieb: Musteranschrift und Platzhalter, solange vivi Vorschau-Funktion ist');
{
  const VS = require(P('backend/src/services/vorschau.js'));
  ok(!!VS.eintrag('vivi'), "vivi steht in vorschau-funktionen.json (dort hängt der Testbetrieb)");
  const echt = FAELLE.find((x) => x.nr === '2026-1041').d;
  const mit = mapping.nachVivi(Object.assign({}, echt, { str: 'Echtweg', hnr: '77', plz: '33613', ort: 'Echtstadt' }), { musterAnschrift: true, musterNr: '1041' });
  ok(mit.projekt.street === 'Musterstraße' && mit.projekt.house_number === '1041' && mit.projekt.postal_code === '12345' && mit.projekt.city === 'Musterstadt', 'Musteranschrift: Musterstraße 1041, 12345 Musterstadt');
  const txt = JSON.stringify(mit);
  ok(!/Echtweg|Echtstadt|33613/.test(txt), 'die echte Anschrift steht nirgends in Nutzlast, Vorschau oder Hinweisen');
  ok(!pruefeSchema(mit.projekt, rumpfSchema('POST', '/projects'), 'muster').length, 'Musteranschrift passt zum Request-Schema POST /projects');
  const ohneAdr = mapping.nachVivi(Object.assign({}, echt, { str: '', hnr: '', plz: '', ort: '' }), { musterAnschrift: true });
  ok(ohneAdr.ok && ohneAdr.projekt.house_number === '1', 'mit Musteranschrift fehlt keine Anschrift (Hausnummer ohne Nummer: 1)');
  const pk = { projekt: { id: 'p1', street: 'Musterstraße', house_number: '1041', postal_code: '12345', city: 'Musterstadt', purchase_price: 545000, purchase_date: '2025-01-01' } };
  const a1 = mapping.ausVivi(pk, { musterAnschrift: true }).felder, a2 = mapping.ausVivi(pk, {}).felder;
  ok(!a1.str && !a1.hnr && !a1.plz && !a1.ort && a1.kp && a2.str && a2.plz, 'ausVivi liest die Anschrift bei Musteranschrift nicht zurück (Kaufpreis schon), ohne Musteranschrift wie bisher');

  /* Dienst Ende zu Ende gegen die Attrappe, Testbetrieb an */
  const B = attrappe();
  const oid = 'bbbbbbbb-0000-4000-8000-000000000001';
  const objs = { [oid]: { user: USER, data: Object.assign({}, echt, { _obj_seq: '2026-1041', str: 'Echtweg', hnr: '77', ort: 'Echtstadt' }) } };
  const S4 = speicherImArbeitsspeicher(objs);
  viviClient._fensterLeeren();
  const deps4 = (test) => dienst._setzeDeps({ speicher: S4, testbetrieb: async () => test, creds: { getSecret: async () => TOKEN }, client: (t, o) => viviClient.erzeugen(t, Object.assign({}, o, { fetch: B.holen, maxWarten: 0 })), jetzt: () => S4.zeit.jetzt, schlafen: async () => {} });
  deps4(true);
  const vs = await dienst.vorschau(USER, oid, {});
  ok(vs.optionen && vs.optionen.muster_anschrift === true && vs.optionen.platzhalter_namen === true && vs.optionen.testbetrieb === true, 'Vorschau im Testbetrieb: Musteranschrift und Platzhalter vorgegeben (an)');
  const vsAus = await dienst.vorschau(USER, oid, { muster_anschrift: false, platzhalter_namen: false });
  ok(vsAus.optionen.muster_anschrift === false && vsAus.nutzlast.projekt.street === 'Echtweg', 'ausdrücklich abgewählt: echte Anschrift (Wahl des Kunden)');
  await dienst.anlegen(USER, oid, {});
  const proj = Object.values(B.st.projekte)[0] || {};
  const rentals = Object.values(B.st.miete);
  ok(proj.street === 'Musterstraße' && proj.house_number === '1041' && !JSON.stringify(B.st).includes('Echtweg'), 'angelegt mit Musterstraße 1041, die echte Straße kam nie bei ViVi an');
  ok(rentals.length && rentals.every((r) => r.tenant_first_name === 'Mieter'), 'Mieter als Platzhalter (' + rentals.length + ' Mietverhältnisse)');
  ok(S4.v[oid].vivi_ids.muster_anschrift === true, 'Verknüpfung merkt sich die Musteranschrift');
  const ab = await dienst.abrufen(USER, oid);
  ok(!ab.felder.str && !ab.felder.plz && ab.felder.kp, 'Zurücklesen: keine Anschrift aus ViVi, die echte bleibt im DealPilot-Objekt');
  const w = await dienst.werte(USER, oid);
  ok(w.muster_anschrift === true, 'werte() meldet die Musteranschrift an den Browser');
  /* Zuordnen im Testbetrieb */
  const oid2 = 'bbbbbbbb-0000-4000-8000-000000000002';
  objs[oid2] = { user: USER, data: { objart: 'ETW' } };
  await dienst.zuordnen(USER, oid2, proj.id || Object.keys(B.st.projekte)[0], null);
  ok(S4.v[oid2] && S4.v[oid2].vivi_ids && S4.v[oid2].vivi_ids.muster_anschrift === true, 'Zuordnen im Testbetrieb: Musteranschrift gemerkt (Anschrift wird nicht zurückgelesen)');
  /* Gegenprobe: ohne Testbetrieb gilt die echte Anschrift */
  deps4(false);
  const vsOhne = await dienst.vorschau(USER, oid, {});
  ok(vsOhne.optionen.muster_anschrift === false && vsOhne.nutzlast.projekt.street === 'Echtweg', 'Gegenprobe: ohne Testbetrieb ist die Vorgabe aus (echte Anschrift)');
  const fe = lies('frontend/js/vivi.js');
  ok(/id="vivi-muster"/.test(fe) && /Anschrift durch Musteranschrift ersetzen/.test(fe) && /muster_anschrift: !!\(ma && ma\.checked\)/.test(fe), 'Vorschaufenster: Schalter „Anschrift durch Musteranschrift ersetzen“, wird mitgeschickt');
}

/* ═══ V5 · Abweichungs-Abgleich beim Auslesen von Unterlagen (v3951) ══════ */
kopf('V5 Unterlagen gegen ViVi: Zustand vivi_abweichung, nie vorgehakt, lokal festlegen statt nach ViVi');
{
  function formular(werte) {
    const els = {};
    function mk(id, wert, tag) {
      const attrs = {}; const cls = new Set();
      const el = { id, tagName: tag || 'INPUT', value: wert == null ? '' : String(wert), readOnly: false, title: '',
        classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
        setAttribute: (k, v) => { attrs[k] = String(v); }, getAttribute: (k) => (k in attrs ? attrs[k] : null), hasAttribute: (k) => k in attrs, removeAttribute: (k) => { delete attrs[k]; },
        dispatchEvent: () => true, insertAdjacentElement: () => {}, focus: () => {} };
      el.parentNode = { querySelector: () => null, querySelectorAll: () => [] };
      els[id] = el; return el;
    }
    Object.keys(werte).forEach((k) => mk(k, werte[k]));
    mk('_vivi', '');
    const doc = { createElement: (tag) => mk('neu' + Object.keys(els).length, '', String(tag).toUpperCase()), getElementById: (id) => els[id] || null,
      querySelectorAll: (q) => (/vivi-verknuepft/.test(q) ? Object.values(els).filter((e) => e.classList.contains('vivi-verknuepft') || e.classList.contains('vivi-eigen')) : []), querySelector: () => null };
    return { els, doc };
  }
  function bauen(werte, quellen) {
    const fb = formular(werte);
    const ctx = frontendModul('frontend/js/vivi-felder.js', { document: fb.doc, globals: { confirm: () => true, parseDe: (x) => { const n = parseFloat(String(x).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : NaN; } } });
    vm.runInContext((quellen && quellen.di) || lies('frontend/js/dokument-import.js'), ctx, { filename: 'dokument-import.js' });
    return { ctx, F: ctx.DpViviFelder, D: ctx.DokumentImport, els: fb.els };
  }
  const STAND = { verknuepft: true, letzter_abruf: '2026-11-22T13:05:00Z', felder: { kp: { wert: 465000 }, nkm: { wert: 950 }, hg_ul: { wert: 2160 }, hg_nul: { wert: 2160 }, 'einheit.0.ist': { wert: 717 }, 'einheit.0.mv_beginn': { wert: '2014-08-01' } }, info: { einheiten: { 0: { nr: '1' } } } };
  const FORM = { kp: '465000', nkm: '950', hg_ul: '2160', hg_nul: '2160', objart: 'ETW', mea: '4,85', wfl: '82' };
  const zeile = (L, f) => (L || []).find((z) => z.feld === f) || {};

  let t = bauen(FORM);
  ok(t.D && typeof t.D.abgleich === 'function' && t.F && typeof t.F.vergleich === 'function', 'dokument-import.js und vivi-felder.js laufen zusammen (echte Dateien)');
  let z = zeile(t.D.abgleich({ kaufpreis_eur: 480000 }, 'kaufvertrag', {}), 'kp');
  ok(z.status === 'abweichung', 'ohne ViVi-Verknüpfung alles wie bisher: Kaufpreis 480.000 gegen 465.000 = abweichung');
  t.F.setzen(STAND);
  z = zeile(t.D.abgleich({ kaufpreis_eur: 480000 }, 'kaufvertrag', {}), 'kp');
  ok(z.status === 'vivi_abweichung' && z.vivi === '465.000' && z.viviWert === 465000, 'verknüpft und abweichend: Zustand vivi_abweichung, laut ViVi 465.000');
  z = zeile(t.D.abgleich({ kaufpreis_eur: 465000 }, 'kaufvertrag', {}), 'kp');
  ok(z.status === 'gleich' && z.viviGleich, 'gleich mit ViVi: „stimmt mit ViVi überein“');
  const hg = t.D.abgleich({ jahr: 2026, art: 'Wirtschaftsplan', einzel: { umlagefaehig_jahr_eur: 2400, nicht_umlagefaehig_jahr_eur: 1284 } }, 'hausgeld', { objart: 'ETW', mea: 4.85 });
  ok(zeile(hg, 'hg_ul').status === 'vivi_abweichung' && zeile(hg, 'hg_nul').status === 'vivi_abweichung' && zeile(hg, 'hg_ul').vivi === '2.160', 'Wirtschaftsplan 2026 mit abweichendem Hausgeld: hg_ul und hg_nul vivi_abweichung');
  const hgGleich = t.D.abgleich({ jahr: 2026, einzel: { umlagefaehig_jahr_eur: 2160, nicht_umlagefaehig_jahr_eur: 2160 } }, 'hausgeld', { objart: 'ETW', mea: 4.85 });
  ok(zeile(hgGleich, 'hg_ul').status === 'gleich' && zeile(hgGleich, 'hg_ul').viviGleich, 'Wirtschaftsplan mit gleichem Hausgeld: gleich');
  z = zeile(t.D.abgleich({ kaltmiete_eur: 1000 }, 'mietvertrag', {}), 'nkm');
  ok(z.status === 'vivi_abweichung' && z.vivi === '950', 'ETW-Mietvertrag 1.000 gegen ViVi 950: vivi_abweichung');
  /* Mietvertrag gegen eine Einheit */
  t.ctx._dpMfh = { einheiten: [{ nr: '1', ist: '717', mv_beginn: '2014-08-01' }, { nr: '2', ist: '717' }] };
  const ev = t.F.einheitVergleich(0, { ist: 750, mv_beginn: '01.08.2014', mv_kaution: 2100 });
  ok(ev.length === 1 && ev[0].id === 'einheit.0.ist' && ev[0].k === 'ist', 'Mietvertrag WE 1: Kaltmiete 750 weicht von ViVi 717 ab, Mietbeginn gleich (01.08.2014 = 2014-08-01), Kaution nicht verknüpft');
  ok(t.F.einheitVergleich(1, { ist: 900 }).length === 0, 'Einheit ohne ViVi-Werte: keine Abweichung');
  /* Entscheidung merken */
  t.F.entscheiden('kp', { wahl: 'vivi', dok: 'Kaufvertrag', dok_wert: '480000', vivi_wert: 465000 });
  z = zeile(t.D.abgleich({ kaufpreis_eur: 480000 }, 'kaufvertrag', {}), 'kp');
  ok(z.status === 'vivi_abweichung' && z.viviEntschieden && z.viviEntschieden.wahl === 'vivi', '„ViVi-Wert behalten“ gemerkt: dieselbe Unterlage fragt nicht noch einmal');
  z = zeile(t.D.abgleich({ kaufpreis_eur: 490000 }, 'kaufvertrag', {}), 'kp');
  ok(z.status === 'vivi_abweichung' && !z.viviEntschieden, 'anderer Wert in der Unterlage: es wird wieder gefragt');
  /* Wert aus der Unterlage nehmen = lokal festlegen */
  ok(t.els.kp.readOnly && t.els.kp.classList.contains('vivi-verknuepft'), 'vorher: Kaufpreis ausgegraut (verknüpft)');
  t.F.lokalFestlegen('kp', '480000', 'Kaufvertrag');
  t.els.kp.value = '480000';
  const v = JSON.parse(t.els._vivi.value);
  ok(v.eigen.kp === '480000' && v.herkunft.kp.quelle === 'Kaufvertrag' && !t.els.kp.readOnly && t.els.kp.classList.contains('vivi-eigen'), '„Wert aus der Unterlage nehmen“: eigene Angabe mit Herkunft, Feld frei');
  t.F.setzen(STAND);
  ok(t.els.kp.value === '480000' && !t.F.istVerknuepft('kp'), 'nächster Abgleich mit ViVi überschreibt die eigene Angabe nicht');
  z = zeile(t.D.abgleich({ kaufpreis_eur: 480000 }, 'kaufvertrag', {}), 'kp');
  ok(z.status === 'gleich' && !z.viviGleich, 'danach: Feld nicht mehr verknüpft, Abgleich gegen das Objekt wie ohne ViVi');

  /* Pruefliste in object-actions.js: nie vorgehakt, Hinweis, Knoepfe, kein Weg nach ViVi */
  const oa = lies('frontend/js/object-actions.js');
  const vf = lies('frontend/js/vivi-felder.js');
  ok(vf.includes("var HINWEIS_ABWEICHUNG = 'Weicht ab. Bitte in ViVi ändern, damit beide gleich sind.';"), 'Hinweis Zeichen für Zeichen: „Weicht ab. Bitte in ViVi ändern, damit beide gleich sind.“');
  ok(/if \(z\.status === 'vivi_abweichung'\) \{ _merged\[z\.feld\]\.nurAktiv = true;/.test(oa) && /\(abw\[id\] !== undefined \|\| it\.nurAktiv\) \? '' : ' checked'/.test(oa), 'Prüftabelle: vivi_abweichung ist nurAktiv, also nie vorgehakt');
  ok(/>ViVi-Wert behalten<\/button>/.test(oa) && />Wert aus der Unterlage nehmen<\/button>/.test(oa) && /<td>laut ViVi<\/td>/.test(oa), 'Knöpfe „ViVi-Wert behalten“ und „Wert aus der Unterlage nehmen“, Spalte „laut ViVi“');
  const fn = (src, name) => { const a = src.indexOf('function ' + name + '('); if (a < 0) return ''; let i = src.indexOf('{', a), tiefe = 0; for (let k = i; k < src.length; k++) { if (src[k] === '{') tiefe++; else if (src[k] === '}') { tiefe--; if (!tiefe) return src.slice(a, k + 1); } } return ''; };
  const ent = fn(oa, '_viviEntscheiden'), lok = fn(vf, 'lokalFestlegen'), ents = fn(vf, 'entscheiden');
  const netz = /apiCall|fetch\(|XMLHttpRequest|sendBeacon|\/vivi\//;
  ok(ent && lok && ents && !netz.test(ent + lok + ents), 'lokal festlegen und Entscheidung merken: kein Netz, kein /vivi/ (schreibt nie nach ViVi)');
  ok(oa.indexOf('_viviEntscheiden(ov);') > 0 && oa.indexOf('_viviEntscheiden(ov);') < oa.indexOf("ov.querySelectorAll('.oabi-tbl input[type=\"checkbox\"]:checked').forEach"), 'Übernehmen: erst lokal festlegen, dann schreiben (sonst setzt die Sperre den Wert zurück)');

  /* Gegenproben */
  const ohne = bauen(FORM, { di: lies('frontend/js/dokument-import.js').split('return zeilen.map(_viviPruefen);').join('return zeilen;') });
  ohne.F.setzen(STAND);
  ok(zeile(ohne.D.abgleich({ kaufpreis_eur: 480000 }, 'kaufvertrag', {}), 'kp').status !== 'vivi_abweichung', 'Gegenprobe rot: ohne _viviPruefen fällt der fehlende Zustand auf');
  const lokNetz = lok.replace('schreiben(v);', "schreiben(v); Auth.apiCall('/vivi/objekt/x', { method: 'POST' });");
  ok(netz.test(lokNetz), 'Gegenprobe rot: ein Aufruf nach ViVi in lokalFestlegen würde gefunden');
}

/* ═══ V4 · Steuer als Entwurf (v3951) ════════════════════════════════════ */
kopf('V4 Steuer: Entwurf hinter dem Schalter, nicht aktiv');
{
  ok(steuerEntwurf.AKTIV === false, 'Schalter viviSteuer.AKTIV ist aus');
  const ds = lies('backend/src/services/vivi/viviDienst.js');
  const nutz = ds.split('steuer.').length - 1;
  ok(/if \(steuer\.AKTIV\) \{/.test(ds) && !/steuer\.(ausViviSteuer|lesePfade)/.test(ds.replace(/if \(steuer\.AKTIV\) \{[\s\S]*?\n    \}/, '')), 'viviDienst ruft den Steuer-Entwurf nur hinter if (steuer.AKTIV) (' + nutz + ' Stellen)');
  const TO = SPEC.paths['/tax-overview'] && SPEC.paths['/tax-overview'].get;
  const toTyp = TO && TO.responses['200'].content['application/json'].schema.properties.data.type;
  ok(toTyp === 'string', 'Spezifikation: /tax-overview liefert data als string (gemessen: Objekt, siehe Teil R, die Textauslese bleibt Rückfall)');
  const pf = steuerEntwurf.lesePfade('p1', 2026).map((x) => x.pfad.replace('/projects/p1', '/projects/{project}'));
  ok(pf.every((x) => SPEC.paths[x] && SPEC.paths[x].get), 'alle Lesepfade stehen in der Spezifikation mit GET: ' + pf.join(', '));
  const mig = lies('backend/migrations/005_tax_records.sql') + lies('backend/migrations/006_tax_extended.sql');
  const spalten = [...new Set([...Object.values(steuerEntwurf.ZEILE_ZU_SPALTE), ...Object.values(steuerEntwurf.KATEGORIE_ZU_SPALTE)])];
  ok(spalten.every((c) => new RegExp('\\b' + c + '\\b').test(mig)), 'jede Zielspalte steht in tax_records (Migration 005/006): ' + spalten.join(', '));
  ok(/id="hg_ul"/.test(HTML) && /id="hg_nul"/.test(HTML), 'Hausgeld-Ziele hg_ul und hg_nul gibt es im Formular');
  const r = steuerEntwurf.ausViviSteuer({
    steueruebersicht: 'Anlage V 2026\nZeile 15 Mieteinnahmen 11.400,00 €\nZeile 48 Schuldzinsen 11.880,00\nZeile 99 Unbekannt 5,00\nFreitext ohne Zeile 1.000,00',
    kosten: [{ tax_category: 'Erhaltungsaufwand', amount: 1850, date: '2026-05-12' }, { tax_category: 'Erhaltungsaufwand', amount: '640,50', date: '2026-09-02' }, { tax_category: 'Erhaltungsaufwand', amount: 999, date: '2025-12-30' },
      { tax_category: 'Hausgeld (Rücklage)', amount: 85, date: '2026-01-01' }, { tax_category: 'Sonstige Werbungskosten', amount: 120, date: '2026-03-01' }],
    laufend: [{ name: 'Hausgeld', tax_category: 'Hausgeld (Vorauszahlung)', amount: 200, interval: 'monthly' }, { name: 'Hausgeld', tax_category: 'Hausgeld (WEG)', amount: 107, interval: 'monthly' }, { name: 'Grundsteuer', amount: 90, interval: 'quarterly' }]
  }, 2026);
  const f = r.felder;
  ok(f['steuer.2026.einnahmen_km'].wert === 11400 && f['steuer.2026.schuldzinsen'].wert === 11880 && !Object.keys(f).some((k) => /99|unbekannt/i.test(k)), 'Steuerübersicht als Text: Zeile 15 und 48 erkannt, unbekannte Zeile und Freitext bleiben liegen');
  ok(f['steuer.2026.erhaltungsaufwand'].wert === 2490.5, 'Erhaltungsaufwand 2026 = 1.850 + 640,50 (der Beleg aus 2025 zählt nicht)');
  ok(!Object.keys(f).some((k) => /ruecklage/.test(k)) && r.vorschlaege['steuer.2026.sonst_kosten'].wert === 120 && !f['steuer.2026.sonst_kosten'], 'Rücklage ohne Abzug, sonstige Werbungskosten nur als Vorschlag (nicht verknüpft)');
  ok(f.hg_ul.wert === 2400 && f.hg_nul.wert === 1284, 'laufendes Hausgeld je Jahr: umlagefähig 200 × 12 = 2.400, nicht umlagefähig 107 × 12 = 1.284, Grundsteuer kein Hausgeld');
  ok(Object.keys(steuerEntwurf.ausViviSteuer({}, 2026).felder).length === 0, 'leere oder unbekannte Antworten: kein Wert (nie geraten)');
}

/* ═══ R · Echte Antworten aus dem Testkonto (v3953) ═══════════════════════ */
kopf('R  Echte ViVi-Antworten (Testkonto, 22.11.2026, tools/vivi-antworten/)');
{
  const ECHT = JSON.parse(lies('tools/vivi-antworten/testkonto-2026-11-22.json'));
  const jetzt = Date.parse(ECHT.jetzt);
  const befunde = [], gelesenEcht = [];
  let werte = 0;
  for (const [nr, o] of Object.entries(ECHT.objekte)) {
    const a = o.antworten;
    const mitE = Object.values(o.vivi_ids.einheiten || {}).some((g) => g.index != null);
    const paket = {
      projekt: beobachtet(a.projekt, SPEC.components.schemas.ProjectResource, 'ProjectResource', gelesenEcht),
      einheiten: a.projekt.units.map((u) => beobachtet(u, SPEC.components.schemas.UnitResource, 'UnitResource', gelesenEcht)),
      mietverhaeltnisse: a.mietverhaeltnisse.map((r) => beobachtet(r, SPEC.components.schemas.RentalUnitResource, 'RentalUnitResource', gelesenEcht)),
      darlehen: a.darlehen.map((f) => beobachtet(f, SPEC.components.schemas.FinancingResource, 'FinancingResource', gelesenEcht)),
      tilgungsplan: { data: a.tilgungsplan_anfang }
    };
    const F = mapping.ausVivi(paket, { vivi_ids: o.vivi_ids, mitEinheiten: mitE, objart: o.objart, jetzt, musterAnschrift: true }).felder;
    const z = mapping.zahl;
    const soll = (feld, w) => { if (w == null || w === '') return; werte++; const ist = F[feld] && F[feld].wert; const g = typeof w === 'number' ? Math.abs(z(ist) - w) < 0.01 : String(ist) === String(w); if (!g) befunde.push(nr + ' ' + feld + ': ' + JSON.stringify(ist) + ' statt ' + JSON.stringify(w)); };
    const g = o.gesendet;
    soll('kp', g.projekt.purchase_price); soll('wirtschaftlicher_uebergang', g.projekt.purchase_date);
    if (g.projekt.construction_year) soll('baujahr', String(g.projekt.construction_year));
    ['str', 'hnr', 'plz', 'ort'].forEach((k) => { if (F[k]) befunde.push(nr + ' ' + k + ' trotz Musteranschrift zurückgelesen'); });
    g.einheiten.forEach((e) => {
      const P = mitE ? 'einheit.' + e.index + '.' : '';
      const m = e.mietverhaeltnis;
      if (!m) { if (mitE) soll(P + 'status', 'leer'); return; }
      if (mitE) { soll(P + 'status', 'vermietet'); soll(P + 'ist', m.rent); soll(P + 'wfl', m.unit_square_meters); if (m.deposit_amount) soll(P + 'mv_kaution', m.deposit_amount); }
      else { soll('nkm', m.rent); soll('wfl', m.unit_square_meters); }
      soll(P + 'nk_vorauszahlung', m.monthly_utility_costs); soll(P + 'mv_beginn', m.rental_start); soll(P + 'mv_befristet_bis', m.rental_end);
      soll(P + 'mv_letzte_erhoehung', m.last_rent_increase);
      if (!m.last_rent_increase && F[P + 'mv_letzte_erhoehung']) befunde.push(nr + ' ' + P + 'mv_letzte_erhoehung: ViVi-Vorgabe (= Mietbeginn) als Erhöhung gelesen');
      if (m.amenities) soll(mitE ? P + 'stellplatz_miete' : 'ze_stp_monat', m.amenities.reduce((s, x) => s + x.monthly_rent, 0));
    });
    g.darlehen.forEach((d) => { const k = d.schluessel; soll(k, d.body.financing_amount); soll(k + 'z', d.body.interest_rate); if (d.body.initial_repayment != null) soll(k + 't', d.body.initial_repayment); });
  }
  ok(!befunde.length && werte > 60, 'Rundweg an echten Antworten: ' + werte + ' gesendete Werte kommen gleich zurück, Anschrift bleibt liegen' + (befunde.length ? ':\n        ' + befunde.slice(0, 10).join('\n        ') : ''));
  const fehltEcht = [...new Set(gelesenEcht.filter((x) => !x[2]).map((x) => x[0] + '.' + x[1]))];
  ok(gelesenEcht.length > 50 && !fehltEcht.length, 'ausVivi liest an echten Antworten nur Felder aus den Resource-Schemas' + (fehltEcht.length ? ': ' + fehltEcht.join(', ') : ''));
  /* Was ViVi selbst setzt (gemessen): letzte Erhoehung = Mietbeginn, Vertragsart free_rent, Einheit 1 ohne Flaeche */
  const b1158 = ECHT.objekte['2026-1158'].antworten.mietverhaeltnisse[0];
  ok(b1158.last_rent_increase === b1158.rental_start && b1158.contract_type === 'free_rent', 'gemessen: ViVi setzt last_rent_increase = rental_start und contract_type free_rent, wenn nichts gesendet wird');
  const o1006 = ECHT.objekte['2026-1006'];
  const e1006 = o1006.antworten.projekt.units.find((u) => u.id === o1006.vivi_ids.auto_einheit);
  ok(e1006 && e1006.identifier === 'Einheit 1' && e1006.square_meters == null, 'gemessen: ohne Mietverhältnis bleibt die automatische Einheit „Einheit 1“ ohne Fläche (2026-1006)');
  ok(/einheitBeimAnlegen/.test(lies('backend/src/services/vivi/viviDienst.js')), 'deshalb benennt anlegen() die automatische Einheit einmal per PATCH (Marcel 22.11.2026, Teil C und D)');
  const nkPlan = mapping.nachVivi({ objart: 'MFH', kp: '100000', wirtschaftlicher_uebergang: '2026-01-01', grundsteuer: '336', _mfh: { einheiten: [{ nr: '1', wfl: '79', ist: '717', status: 'vermietet', mv_beginn: '2020-01-01' }, { nr: '2', wfl: '79', ist: '717', status: 'vermietet', mv_beginn: '2020-01-01' }] } }, { musterAnschrift: true });
  ok(nkPlan.hinweise.some((h) => /auffällig niedrig/.test(h)) && nkPlan.einheiten[0].miete.monthly_utility_costs === 14, 'abgeleitete NK-Vorauszahlung unter 0,50 €/m²: Hinweis „auffällig niedrig“, der Wert selbst bleibt (14 €)');
  /* V4 an den echten Antworten */
  const so = ECHT.steueruebersicht_objekt;
  ok(so && typeof so === 'object' && Array.isArray(so.income) && so.income.some((x) => x.zeile === '13-15'), 'gemessen: /tax-overview mit project_id liefert ein Objekt mit income[]/expenses[] und Zeilenbereichen (Spezifikation sagt string)');
  const tv = steuerEntwurf.ausSteueruebersicht(so);
  ok(tv.einnahmen_km === 32850 && tv.einnahmen_nk === 9760 && tv.schuldzinsen === 15524.77 && tv.erhaltungsaufwand === undefined, 'Steuerübersicht als Objekt: Zeile 13-15, 20, 46-48 erkannt, Betrag 0 (nichts gebucht) ist kein Wert');
  const ko = ECHT.objekte['2026-1041'].antworten.costs;
  ok(ko && !Array.isArray(ko) && 'realized_costs' in ko && !Object.keys(steuerEntwurf.ausKosten(ko, 2026).verknuepft).length, 'gemessen: /costs ist ein Summen-Objekt ohne Steuerkategorie, daraus wird nichts gelesen');
}

/* ═══ R2 · nach den Bewegungsdaten (v3966) ═══════════════════════════════ */
kopf('R2 Echte Antworten nach Mietanpassung, Mietende, Sondertilgung, Belegen');
{
  const ECHT = JSON.parse(lies('tools/vivi-antworten/testkonto-2026-11-22.json')).nach_schritt3;
  const heute = '2026-11-22';
  const r1041 = ECHT.mietverhaeltnisse_1041;
  const we = (n) => r1041.find((r) => r.unit.identifier.startsWith('WE ' + n));
  ok(we(1).last_rent_increase === '2026-11-01' && we(1).rent === 590, 'gemessen: ViVi setzt last_rent_increase auch bei einer reinen NK-Anpassung (1041 WE 1, Kaltmiete 590 unverändert)');
  ok(mapping.letzteErhoehung(we(1), ECHT.mietverlauf[we(1).id], heute) === null,
    'NK-Anpassung ist keine Mieterhöhung: letzte Erhöhung von WE 1 kommt nicht als 01.11.2026 zurück');
  ok(mapping.letzteErhoehung(we(2), ECHT.mietverlauf[we(2).id], heute) === '2026-11-01', 'Mieterhöhung WE 2 600 → 630 zum 01.11.2026 aus dem Mietverlauf');
  ok(mapping.letzteErhoehung({ last_rent_increase: '2026-11-01', rental_start: '2011-05-01' }, null, heute) === '2026-11-01', 'ohne Mietverlauf gilt last_rent_increase (außer Mietbeginn)');
  const L = r1041.map((r) => ({ id: r.unit_id, identifier: r.unit.identifier, unit_type: 'residential', square_meters: r.unit.square_meters }));
  const F = mapping.ausVivi({ projekt: { id: 'p' }, einheiten: L, mietverhaeltnisse: r1041, darlehen: [], mietverlauf: ECHT.mietverlauf },
    { vivi_ids: {}, mitEinheiten: true, objart: 'MFH', jetzt: Date.parse(heute + 'T12:00:00Z'), musterAnschrift: true }).felder;
  const ist = [0, 1, 2, 3, 4, 5].map((i) => F['einheit.' + i + '.status'] && F['einheit.' + i + '.status'].wert === 'vermietet' ? F['einheit.' + i + '.ist'].wert : 0).reduce((a, b) => a + b, 0);
  ok(F['einheit.5.status'].wert === 'leer' && ist === 2805 && F['einheit.0.nk_vorauszahlung'].wert === 185 && F['einheit.1.ist'].wert === 630,
    '1041: WE 6 nach Mietende leer, Nettokaltmiete 590 + 630 + 585 + 585 + 415 = ' + ist + ' (Testplan 4.6: 2.805), WE 1 NK 185, WE 2 630');
  const d = ECHT.darlehen_1157;
  const erg = mapping.ausVivi({ projekt: {}, einheiten: [], mietverhaeltnisse: [], darlehen: d, tilgungsplan: { data: [{ date: '2026-10-31', remaining_debt_after: 330000 }, { date: '2026-10-31', remaining_debt_after: 48818.37 }, { date: '2026-11-30', remaining_debt_after: 1 }] } },
    { vivi_ids: {}, jetzt: Date.parse(heute + 'T12:00:00Z') });
  ok(erg.info.restschuld_heute.wert === 373818.37 && erg.info.restschuld_heute.sondertilgung === 5000 && erg.felder.d2 && erg.felder.d2.wert === 50000,
    '1157: Sondertilgung 5.000 € am 15.11. senkt die Restschuld heute (378.818,37 → 373.818,37), die Darlehenssumme bleibt 50.000 (Testplan 4.9)');
  const soll = { '2026-1157': 1850, '2026-1041': 4760, '2026-1053': 2380, '2026-001': 980 };
  const st = Object.keys(soll).map((k) => [k, steuerEntwurf.ausSteueruebersicht(ECHT.steueruebersicht[k]).erhaltungsaufwand]);
  ok(st.every(([k, v]) => v === soll[k]), 'V4 mit echten Belegen: Erhaltungsaufwand 2026 ' + st.map(([k, v]) => k + ' ' + v).join(', ') + ' (Testplan 7.4)');
  const b = ECHT.beleg_beispiel;
  ok(b && b.status === 'booked' && b.payments && b.payments[0] && b.payments[0].is_manual === true, 'gemessen: hochgeladene Belege als manuelle Transaktion gebucht (/receipts status booked)');
}

dienst._setzeDeps(null);
console.log('\n' + (rot ? 'ROT · ' + rot + ' Befund(e), ' + gruen + ' grün' : 'SAUBER · ' + gruen + ' Prüfpunkte grün'));
process.exit(rot ? 1 : 0);
