#!/usr/bin/env node
/* tools/vivi-copilot-pruefen.mjs — v4130 · Co-Pilot mit ViVi-Werkzeugen (services/vivi/viviAuskunft.js)
 *
 * Marcels Datenregel 23.11.2026: keine Mieternamen und Kontaktdaten an OpenAI, „Mieter kann man abkürzen falls
 * notwendig, mit z. B. Hr. M“. Geprueft wird an der ECHTEN Datei mit nachgebauten ViVi-Antworten (erfundene Daten,
 * kein Netz, keine Datenbank):
 *   A  Abkuerzung: Hr. M. / Fr. K. / Mieter S. / Firma B. / Mieter
 *   B  vivi_einheiten: kein Vor-/Nachname, keine E-Mail, Telefon, Geburtsdatum, Zweitanschrift, Mitmietername im Ergebnis,
 *      auch nicht im Freitext des Mietverlaufs. Gegenprobe: ohne Schwaerzer waere der Name drin (Pruefer wird rot).
 *   C  vivi_belege: Absender, Beschreibung, Posten-Bezeichnung geschwaerzt, IBAN, Gegenkonto, Verwendungszweck nie drin
 *   D  vivi_vorgaenge: tenant_name nie drin, Mieter abgekuerzt, nur_offen filtert
 *   E  vivi_handwerker: E-Mail des Handwerkers nie drin
 *   F  vivi_darlehen: Restschuld heute und Jahressummen aus dem Tilgungsplan
 *   G  fremdes Objekt / ohne Verknuepfung: saubere Antwort, KEINE Anfrage an ViVi; frage() 404 bzw. 409
 *   H  Bremse 429: saubere Antwort, kein Wurf; Zwischenspeicher: zweiter Aufruf ohne Anfrage
 *   I  frage(): Tageslimit 429, Schreiben wird abgelehnt, keine Kosten, Objekt als Bezug
 *   J  Bauart: viviAuskunft ruft nur get(), die Werkzeuge stehen als 'lesen' in agentWerkzeuge.js, Route hinter der
 *      Vorschau-Sperre in routes/vivi.js
 *   K  v4190 · copilotWissen fuer den normalen Co-Piloten: Erkenner, keine Anfrage ohne ViVi-Frage, Vorschau,
 *      Verknuepfung oder bei fremdem Nutzer, alle Teile geschwaerzt im Kontext, Einheit eingegrenzt, Verdrahtung ai.js
 * RC 0 = sauber.
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const require = createRequire(import.meta.url);
const WURZEL = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const A = require(path.join(WURZEL, 'backend/src/services/vivi/viviAuskunft.js'));

let gruen = 0, rot = 0;
function ok(bed, text) { if (bed) { gruen++; console.log('  ok  ' + text); } else { rot++; console.log('  ROT ' + text); } }

/* ── erfundene Testdaten ─────────────────────────────────────────────── */
const VERBOTEN = ['Hans', 'Müllermann', 'Karla', 'Klabunde', 'Sven', 'Spohrmeier', 'Bertram', 'hans.muellermann@example.test',
  '0521 9876543', '1979-04-12', 'Nebenweg 7', 'DE89 3704 0044 0532 0130 00', 'Gegenkonto Muellermann', 'Miete Mai Muellermann',
  'Brigitte', 'maler@example.test', 'Spohrmeier GmbH'];
const MIET = [
  { id: 'r1', unit_id: 'u1', tenant_first_name: 'Hans', tenant_last_name: 'Müllermann', tenant_salutation: 'Herr', tenant_date_of_birth: '1979-04-12',
    tenant_phone: '0521 9876543', tenant_email: 'hans.muellermann@example.test', tenant_alt_street: 'Nebenweg 7', is_company: false,
    rent: 620, target_rent: 650, monthly_utility_costs: 180, rental_start: '2019-03-01', rental_end: null, occupancy_type: 'rented', contract_type: 'unbefristet',
    last_rent_increase: '2024-06-01', deposit_amount: 1240, deposit_type: 'Barkaution', deposit_location: 'DE89 3704 0044 0532 0130 00',
    co_tenants: [{ first_name: 'Brigitte', last_name: 'Müllermann' }] },
  { id: 'r2', unit_id: 'u2', tenant_first_name: 'Karla', tenant_last_name: 'Klabunde', tenant_salutation: 'Frau', is_company: false,
    rent: 540, monthly_utility_costs: 160, rental_start: '2021-01-01', occupancy_type: 'rented' },
  { id: 'r3', unit_id: 'u3', tenant_first_name: 'Sven', tenant_last_name: 'Spohrmeier', tenant_salutation: null, is_company: false,
    rent: 400, rental_start: '2015-01-01', rental_end: '2020-12-31', occupancy_type: 'rented' },
  { id: 'r4', unit_id: 'u3', company_name: 'Bertram Logistik', is_company: true, rent: 900, rental_start: '2022-01-01', occupancy_type: 'rented' }
];
const UNITS = [{ id: 'u1', identifier: 'WE 01', unit_type: 'apartment', square_meters: 68, rooms: 3, floor: 1 },
  { id: 'u2', identifier: 'WE 02', unit_type: 'apartment', square_meters: 55, rooms: 2, floor: 2 },
  { id: 'u3', identifier: 'Laden', unit_type: 'commercial', square_meters: 90, rooms: null, floor: 0 },
  { id: 'u4', identifier: 'WE 04', unit_type: 'apartment', square_meters: 40, rooms: 1, floor: 3 }];
const ANTWORTEN = {
  '/projects/p1': { data: { id: 'p1' } },
  '/projects/p1/units': { data: UNITS },
  '/projects/p1/rental-units': { data: MIET },
  '/projects/p1/rental-units/r1/rent-history': { data: { rental_start: '2019-03-01', start_state: { rent: 580, utility: 170 }, rent_changes: [
    { effective_date: '2024-06-01', status: 'active', adjustment_type: 'increase', previous_rent: 580, new_rent: 620, previous_utility_costs: 170, new_utility_costs: 180,
      adjustment_reason: 'Herr Müllermann einverstanden, Rückruf 0521 9876543 oder hans.muellermann@example.test' }] } },
  '/projects/p1/rental-units/r2/rent-history': { data: { rental_start: '2021-01-01', start_state: { rent: 540, utility: 160 }, rent_changes: [] } },
  '/projects/p1/rental-units/r4/rent-history': { data: { rental_start: '2022-01-01', start_state: { rent: 900, utility: 0 }, rent_changes: [] } },
  '/tax-overview': function (q) {
    if (!q.line) return { data: { income: [{ zeile: '13-15', label: 'Mieteinnahmen', amount: 13920 }], expenses: [{ zeile: '55-72', label: 'Erhaltungsaufwand', amount: 385 }] } };
    return { data: { line_details: { zeile: q.line, label: 'Erhaltungsaufwand', amount: 385, items: [{ label: 'Heizung Wohnung Müllermann', date: '12.06.2025', amount: 385 }], items_truncated: false } } };
  },
  '/receipts': { data: [{ id: 'b1', status: 'paid', amount: 385, open_amount: 0, date: '2025-06-12', due_date: '2025-06-26', sender: 'Heizungsbau Hans Müllermann',
    description: 'Rechnung an Müllermann, IBAN DE89 3704 0044 0532 0130 00', direction: 'incoming',
    payments: [{ booking_date: '2025-06-20', amount: 385, counterparty_name: 'Gegenkonto Muellermann', purpose: 'Miete Mai Muellermann', bank_account: { iban: 'DE89 3704 0044 0532 0130 00' } }] }],
    links: {}, meta: { last_page: 1 } },
  '/portal-cases': { data: [
    { id: 'c1', rental_unit_id: 'r2', title: 'Wasserhahn tropft bei Klabunde', category: 'damage', status: 'open', priority: 'normal', tenant_name: 'Karla Klabunde',
      description: 'Frau Klabunde meldet einen tropfenden Hahn', created_at: '2026-10-01' },
    { id: 'c2', rental_unit_id: 'r1', title: 'Treppenlicht', category: 'damage', status: 'closed', tenant_name: 'Hans Müllermann', created_at: '2026-01-01' }] },
  '/craftsman-jobs': { data: [{ id: 'j1', type: 'repair', status: 'finished', craftsman: { name: 'Malerbetrieb Nord', email: 'maler@example.test' },
    request: { description: 'Bad streichen bei Müllermann', cost_limit: 800 }, offer: { amount: 720, offered_at: '2026-05-01' }, finished_at: '2026-05-20', invoice: { file_name: 'r.pdf' } }] },
  '/projects/p1/financings': { data: [{ name: 'Annuität', bank_name: 'Testbank', financing_amount: 120000, interest_rate: 3.1, initial_repayment: 2, fixed_monthly_rate: 510,
    fixed_interest_end_date: '2034-06-30', special_repayment_allowed: true }] },
  '/projects/p1/financing-schedule': { data: [
    { date: '2026-01-31', remaining_debt: 101000, interest: 260, repayment: 250, monthly_rate: 510, remaining_debt_after: 100750 },
    { date: '2026-02-28', remaining_debt: 100750, interest: 259, repayment: 251, monthly_rate: 510, remaining_debt_after: 100499 },
    { date: '2027-01-31', remaining_debt: 98000, interest: 250, repayment: 260, monthly_rate: 510, remaining_debt_after: 97740 }] }
};
const JETZT = Date.parse('2026-11-23T12:00:00Z');
function umgebung(opt) {
  opt = opt || {};
  const zaehler = { anfragen: 0, pfade: [] };
  return {
    zaehler,
    speicher: { verknuepfung: async function (userId, objectId) {
      if (opt.ohne || userId !== 'nutzer-1' || objectId !== 'obj-1') return null;
      return { anlage_status: 'fertig', vivi_objekt_id: 'p1', vivi_account_id: null, vivi_ids: { einheiten: { e0: { index: 0, nr: '1', unit_id: 'u1' }, e1: { index: 1, nr: '2', unit_id: 'u2' } } } };
    } },
    token: async function () { return 't'; },
    client: function () {
      return { zaehler: { anfragen: 0 }, get: async function (p, q) {
        zaehler.anfragen++; zaehler.pfade.push(p);
        if (opt.bremse) { const e = new Error('429'); e.code = 'bremse_429'; throw e; }
        const a = ANTWORTEN[p];
        if (typeof a === 'function') return a(q || {});
        if (!a) { const e = new Error('404'); e.code = 'nicht_gefunden'; throw e; }
        return JSON.parse(JSON.stringify(a));
      } };
    },
    jetzt: function () { return JETZT; }
  };
}
function sauber(obj, liste) {
  const s = JSON.stringify(obj);
  return (liste || VERBOTEN).filter(function (w) { return s.toLowerCase().indexOf(String(w).toLowerCase()) >= 0; });
}

console.log('vivi-copilot-pruefen (v4130, v4190)');

/* A */
ok(A.mieterKurz(MIET[0]) === 'Hr. M.', 'A1 Herr Müllermann -> Hr. M. (' + A.mieterKurz(MIET[0]) + ')');
ok(A.mieterKurz(MIET[1]) === 'Fr. K.', 'A2 Frau Klabunde -> Fr. K.');
ok(A.mieterKurz(MIET[2]) === 'Mieter S.', 'A3 ohne Anrede -> Mieter S.');
ok(A.mieterKurz(MIET[3]) === 'Firma B.', 'A4 Firma -> Firma B.');
ok(A.mieterKurz({ tenant_salutation: 'Frau' }) === 'Mieter', 'A5 ohne Nachname -> Mieter');

/* B */
let U = umgebung(); A._setzeTest(U);
const e = await A.einheiten('nutzer-1', 'obj-1', {});
ok(e.ok === true && e.einheiten.length === 4, 'B1 vier Einheiten gelesen');
ok(sauber(e).length === 0, 'B2 keine Namen/Kontaktdaten im Ergebnis' + (sauber(e).length ? ': ' + sauber(e).join(', ') : ''));
const w1 = e.einheiten[0];
ok(w1.mietverhaeltnis && w1.mietverhaeltnis.mieter === 'Hr. M.' && w1.mietverhaeltnis.weitere_mieter === 1, 'B3 Mieter Hr. M., ein Mitmieter gezaehlt');
ok(w1.dealpilot_nr === '1' && w1.mietverhaeltnis.letzte_erhoehung === '2024-06-01' && w1.mietverhaeltnis.kaution.betrag === 1240, 'B4 Nr., letzte Erhoehung, Kaution');
const grund = w1.mietverhaeltnis.mietverlauf && w1.mietverhaeltnis.mietverlauf.aenderungen[0].grund;
ok(/^Hr\. M\. einverstanden/.test(grund || '') && /\[Telefon entfernt\]/.test(grund) && /\[E-Mail entfernt\]/.test(grund), 'B5 Freitext geschwaerzt: ' + grund);
ok(e.einheiten[3].leer === true && e.einheiten[2].mietverhaeltnis.mieter === 'Firma B.', 'B6 leere Wohnung erkannt, Laden an Firma B.');
const e2 = await A.einheiten('nutzer-1', 'obj-1', { einheit: 'Wohnung 2' });
ok(e2.einheiten.length === 1 && e2.einheiten[0].einheit === 'WE 02', 'B7 Filter "Wohnung 2" trifft WE 02');
/* Gegenprobe: ohne Schwaerzer bliebe der Name stehen, der Pruefer muss es merken */
const roh = A.schwaerzer([])('Herr Müllermann einverstanden');
ok(sauber({ roh }).length > 0, 'B8 Gegenprobe: ohne Namensliste findet der Pruefer den Namen (rot waere richtig)');

/* C */
const b = await A.belege('nutzer-1', 'obj-1', { jahr: 2025 });
ok(b.ok === true && b.jahr === 2025 && b.kostenarten.length === 1 && b.belege.length === 1, 'C1 Anlage V und Belegliste 2025');
ok(sauber(b).length === 0, 'C2 Belege ohne Namen, IBAN, Gegenkonto, Verwendungszweck' + (sauber(b).length ? ': ' + sauber(b).join(', ') : ''));
ok(b.belege[0].status === 'paid' && b.belege[0].zuletzt_bezahlt === '2025-06-20' && b.kostenarten[0].posten[0].betrag === 385, 'C3 Zahlstatus, Zahldatum, Posten');

/* D */
const v = await A.vorgaenge('nutzer-1', 'obj-1', { nur_offen: true });
ok(v.ok === true && v.vorgaenge.length === 1 && v.vorgaenge[0].mieter === 'Fr. K.', 'D1 nur offene, Mieter Fr. K.');
ok(sauber(v).length === 0 && /^Fr\. K\. meldet/.test(v.vorgaenge[0].beschreibung), 'D2 tenant_name und Freitext geschwaerzt: ' + v.vorgaenge[0].beschreibung);

/* E */
const h = await A.handwerker('nutzer-1', 'obj-1', {});
ok(h.ok === true && h.auftraege[0].handwerker === 'Malerbetrieb Nord' && sauber(h).length === 0, 'E1 Handwerker ohne E-Mail, Auftrag geschwaerzt');

/* F */
const d = await A.darlehen('nutzer-1', 'obj-1', { jahr: 2026 });
ok(d.ok === true && d.restschuld_heute === 100499 && d.jahr_summen && d.jahr_summen.zinsen === 519 && d.jahr_summen.monate === 2, 'F1 Restschuld heute 100.499, Zinsen 2026 aus dem Plan');

/* G */
U = umgebung(); A._setzeTest(U);
const f = await A.einheiten('nutzer-2', 'obj-1', {});
ok(f.ok === false && f.nicht_verknuepft === true && U.zaehler.anfragen === 0, 'G1 fremder Nutzer: keine Verknuepfung, keine Anfrage an ViVi');
U = umgebung({ ohne: true }); A._setzeTest(U);
const g2 = await A.belege('nutzer-1', 'obj-1', { jahr: 2025 });
ok(g2.ok === false && g2.nicht_verknuepft === true && U.zaehler.anfragen === 0, 'G2 ohne Verknuepfung: saubere Antwort, keine Anfrage');

/* H */
U = umgebung({ bremse: true }); A._setzeTest(U);
const hb = await A.einheiten('nutzer-1', 'obj-1', {});
ok(hb.ok === false && hb.bremse === true, 'H1 Bremse 429: saubere Antwort');
U = umgebung(); A._setzeTest(U);
await A.vorgaenge('nutzer-1', 'obj-1', {});
const vorher = U.zaehler.anfragen;
await A.vorgaenge('nutzer-1', 'obj-1', {});
ok(vorher > 0 && U.zaehler.anfragen === vorher, 'H2 Zwischenspeicher: zweiter Aufruf ohne Anfrage');

/* J */
const quelle = fs.readFileSync(path.join(WURZEL, 'backend/src/services/vivi/viviAuskunft.js'), 'utf8');
ok(!/\bcl\.(post|put|patch|delete|senden)\s*\(/.test(quelle) && /\bcl\.get\(/.test(quelle), 'J1 viviAuskunft ruft nur cl.get()');
const aw = fs.readFileSync(path.join(WURZEL, 'backend/src/services/agentWerkzeuge.js'), 'utf8');
['vivi_einheiten', 'vivi_belege', 'vivi_vorgaenge', 'vivi_handwerker', 'vivi_darlehen'].forEach(function (n) {
  ok(new RegExp("name: '" + n + "', stufe: 'lesen'").test(aw), 'J2 ' + n + ' steht als lesendes Werkzeug');
});
ok(/darf\(\{ id: ctx\.userId \}, 'vivi'\)/.test(aw), 'J3 Werkzeuge pruefen die Vorschau-Freigabe vivi');
const rv = fs.readFileSync(path.join(WURZEL, 'backend/src/routes/vivi.js'), 'utf8');
ok(rv.indexOf("router.post('/objekt/:id/frage'") < 0, 'J4 eigene Frage-Route /objekt/:id/frage ist weg (v4190: ein Co-Pilot)');

/* K · v4190 · ViVi-Wissen im normalen Co-Piloten (copilotWissen) */
const darfJa = async function () { return true; }, darfNein = async function () { return false; };
ok(A.frageErkennen('Wie hoch ist der Cashflow?') === null, 'K1 Nicht-ViVi-Frage erkannt als keine ViVi-Frage');
const k2 = A.frageErkennen('Wann war die letzte Mieterhöhung in Wohnung 3?');
ok(k2 && k2.teile.indexOf('einheiten') >= 0 && k2.einheit === '3', 'K2 Mieterhöhung -> einheiten, Wohnung 3');
const k3 = A.frageErkennen('Welche Belege gab es 2025?');
ok(k3 && k3.teile.join() === 'belege' && k3.jahr === 2025, 'K3 Belege 2025 -> belege, Jahr 2025');
const k4 = A.frageErkennen('Wie hoch ist die Restschuld laut ViVi?');
ok(k4 && k4.teile.indexOf('darlehen') >= 0, 'K4 Restschuld -> darlehen');
U = umgebung(); A._setzeTest(U);
const kn = await A.copilotWissen('nutzer-1', 'obj-1', 'Wie hoch ist der Cashflow?', { darf: darfJa });
ok(kn === null && U.zaehler.anfragen === 0, 'K5 Nicht-ViVi-Frage: kein Wissen, keine Anfrage an ViVi');
U = umgebung(); A._setzeTest(U);
const kv = await A.copilotWissen('nutzer-1', 'obj-1', 'Wann war die letzte Mieterhöhung?', { darf: darfNein });
ok(kv === null && U.zaehler.anfragen === 0, 'K6 Vorschau vivi gesperrt: kein Wissen, keine Anfrage');
U = umgebung({ ohne: true }); A._setzeTest(U);
const ko = await A.copilotWissen('nutzer-1', 'obj-1', 'Wann war die letzte Mieterhöhung?', { darf: darfJa });
ok(ko === null && U.zaehler.anfragen === 0, 'K7 ohne Verknüpfung: kein Wissen, keine Anfrage');
U = umgebung(); A._setzeTest(U);
const kf = await A.copilotWissen('nutzer-2', 'obj-1', 'Wann war die letzte Mieterhöhung?', { darf: darfJa });
ok(kf === null && U.zaehler.anfragen === 0, 'K8 fremder Nutzer: kein Wissen, keine Anfrage');
U = umgebung(); A._setzeTest(U);
const kw = await A.copilotWissen('nutzer-1', 'obj-1', 'Wann war die letzte Mieterhöhung, welche Belege gab es 2025, gibt es offene Schäden, Handwerker und Restschuld laut ViVi?', { darf: darfJa });
ok(kw && /aus ViVi/.test(kw.quelle) && kw.einheiten && kw.einheiten.ok === true && kw.belege && kw.belege.jahr === 2025 && kw.vorgaenge && kw.handwerker && kw.darlehen && kw.darlehen.restschuld_heute === 100499, 'K9 alle fünf Teile im Kontext, Quelle aus ViVi');
ok(sauber(kw).length === 0, 'K10 Kontext ohne Namen, Kontakt, IBAN' + (sauber(kw).length ? ': ' + sauber(kw).join(', ') : ''));
ok(JSON.stringify(kw).indexOf('Hr. M.') >= 0, 'K11 Mieter abgekürzt (Hr. M.) im Kontext');
U = umgebung(); A._setzeTest(U);
const ke = await A.copilotWissen('nutzer-1', 'obj-1', 'Seit wann wohnt der Mieter in Wohnung 2?', { darf: darfJa });
ok(ke && ke.einheit === '2' && ke.einheiten.einheiten.length === 1 && ke.einheiten.einheiten[0].einheit === 'WE 02', 'K12 Frage zu Wohnung 2 auf die Einheit eingegrenzt');
/* Gegenprobe: ohne Schwärzung (roh) fände der Prüfer den Namen, K10 wäre rot */
ok(sauber({ roh: MIET[0] }).length > 0, 'K13 Gegenprobe: Rohdaten trügen Namen (Prüfer erkennt sie)');
const ai = fs.readFileSync(path.join(WURZEL, 'backend/src/routes/ai.js'), 'utf8');
const ow = ai.slice(ai.indexOf('async function _copilotObjektwissen'), ai.indexOf("router.post('/copilot'"));
ok(ow.indexOf('copilotWissen(uid, oid, payload.message') >= 0 && ow.indexOf("_vorschau.darf({ id: uid }, 'vivi')") >= 0 && ow.indexOf('wissen.vivi = vw') >= 0, 'K14 _copilotObjektwissen legt wissen.vivi aus copilotWissen');
const fe = fs.readFileSync(path.join(WURZEL, 'frontend/js/vivi-copilot.js'), 'utf8');
ok(fe.indexOf("apiCall") < 0 && /DealPilotBlase/.test(fe) && /dp-cp-in/.test(fe), 'K15 Reiter ViVi: keine eigene Route mehr, Beispielfragen gehen an den Co-Piloten unten');

A._setzeTest(null);
console.log('\n' + (rot ? 'ROT: ' + rot + ' von ' + (gruen + rot) : 'SAUBER · ' + gruen + ' Prüfpunkte grün'));
process.exit(rot ? 1 : 0);
