'use strict';
/* services/vivi/viviSteuer.js — v3951 · Paket V4 (Steuer) als ENTWURF, NICHT AKTIV
 *
 * Bauplan Dateien/Architektur/ViVi-Anbindung-2026-11-22.md, Abschnitt 2.3. Die Spezifikation (vivi-openapi-v1.json,
 * v1.5.0) nennt die Pfade, aber nicht die Felder der Antworten:
 *   GET /tax-overview?year=&project_id=&line=   200: { data: string }       Anlage V als TEXT, Form unbekannt
 *   GET /projects/{p}/costs                     200: { data: array<{}> }    Summen geplanter und angefallener Kosten
 *   GET /projects/{p}/monthly-costs             200: { data: array<{}> }    laufende Kosten (Hausgeld, Grundsteuer …)
 *   GET /projects/{p}/revenues                  200: { data: array<{}> }    Erloese ausserhalb der Miete
 * Die Schluessel unten (amount, tax_category, interval …) sind deshalb ANNAHMEN nach dem Hilfe-Center
 * (kb/objekt-kosten.html: Steuerkategorien „Erhaltungsaufwand“, „Hausgeld (WEG)“, „Hausgeld (Vorauszahlung)“,
 * „Hausgeld (Rücklage)“, „Sonstige Werbungskosten“, „Nicht absetzbar“ …). Jede Funktion nimmt mehrere Schreibweisen
 * an und laesst weg, was sie nicht sicher erkennt (kein Treffer heisst kein Wert, nie geraten).
 *
 * SCHALTER: AKTIV = false. viviDienst.abrufen() ruft dieses Modul nur, wenn AKTIV true ist. Umlegen erst, wenn mit dem
 * Key eine echte Antwort je Pfad abgelegt ist (Prueffaelle in tools/vivi-pruefen.mjs, Teil V4) und Marcel die
 * Steuerjahr-Regel bestaetigt hat (Jahre mit Steuerstand nie automatisch, nur als Abweichung).
 *
 * Feld-IDs: Steuerwerte als 'steuer.<jahr>.<spalte>' (tax_records, Migration 005/006), Objektfelder ohne Jahr
 * (hg_ul, hg_nul in €/Jahr wie das Formular). vivi_werte fuehrt sie spaeter mit jahr > 0, werte() liefert sie heute
 * bewusst nicht aus (z.jahr wird uebersprungen).
 */
const AKTIV = false;

/* Anlage V 2025, Zeile -> tax_records-Spalte (nur die Zeilen, die ViVi laut Hilfe-Center fuehrt und die als Spalte
   in tax_records stehen). Die av_*-Zeilen (21, 26, 27, 79) liegen im anlage_v-JSON und folgen mit der echten Antwort. */
const ZEILE_ZU_SPALTE = Object.freeze({ 15: 'einnahmen_km', 20: 'einnahmen_nk', 48: 'schuldzinsen', 55: 'erhaltungsaufwand', 75: 'nk_umlf', 78: 'nk_n_umlf' });
/* Steuerkategorie der Kostenposition -> Spalte. Sonstige Werbungskosten sind EINE Summe bei ViVi, DealPilot trennt sie,
   deshalb nur Vorschlag (nicht verknuepft). Ruecklage und nicht absetzbar: kein Abzug. */
const KATEGORIE_ZU_SPALTE = Object.freeze({
  'erhaltungsaufwand': 'erhaltungsaufwand',
  'hausgeld (vorauszahlung)': 'nk_umlf',
  'hausgeld (weg)': 'nk_n_umlf'
});
const NUR_VORSCHLAG = Object.freeze({ 'sonstige werbungskosten': 'sonst_kosten', 'abschreibbare anschaffung': 'sonst_bewegl_wg', 'herstellungskosten am gebäude': 'anschaffungsnah' });
const OHNE_ABZUG = Object.freeze({ 'hausgeld (rücklage)': 1, 'nicht absetzbar': 1 });

function zahl(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v).trim().replace(/\s|€/g, '');
  if (!s) return null;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
function rund(n) { return Math.round(n * 100) / 100; }
function erstes(o, schluessel) { for (const k of schluessel) if (o && o[k] != null && o[k] !== '') return o[k]; return null; }
function jahrVon(o) {
  const d = String(erstes(o, ['date', 'booking_date', 'paid_at', 'invoice_date', 'due_date', 'year']) || '');
  const m = /^(\d{4})/.exec(d) || /(\d{4})$/.exec(d);
  return m ? +m[1] : null;
}
function kategorie(o) { return String(erstes(o, ['tax_category', 'tax_category_label', 'category', 'category_label']) || '').trim().toLowerCase(); }
function betrag(o) { return zahl(erstes(o, ['amount', 'gross_amount', 'total', 'total_amount', 'value'])); }

/**
 * /tax-overview liefert data als TEXT. Erkannt werden nur Zeilen der Form „Zeile 48 … 1.234,56“ (auch „Z. 48“).
 * Alles andere bleibt liegen. Rueckgabe { spalte: betrag }.
 */
function ausSteueruebersicht(text) {
  const aus = {};
  String(text == null ? '' : text).split(/\r?\n/).forEach(function (z) {
    const m = /(?:Zeile|Z\.)\s*(\d{1,3})\b[^\n]*?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}|-?\d+\.\d{2})\s*(?:€|EUR)?\s*$/i.exec(z);
    if (!m) return;
    const sp = ZEILE_ZU_SPALTE[+m[1]]; if (!sp) return;
    const n = zahl(m[2]); if (n == null) return;
    aus[sp] = rund((aus[sp] || 0) + Math.abs(n));
  });
  return aus;
}

/** /costs: Kostenpositionen eines Jahres nach Steuerkategorie summiert. { verknuepft: {spalte: betrag}, vorschlag: {...} } */
function ausKosten(liste, jahr) {
  const verknuepft = {}, vorschlag = {};
  (Array.isArray(liste) ? liste : []).forEach(function (o) {
    if (!o || typeof o !== 'object') return;
    if (jahr && jahrVon(o) !== jahr) return;
    const k = kategorie(o), b = betrag(o);
    if (b == null || !k || OHNE_ABZUG[k]) return;
    if (KATEGORIE_ZU_SPALTE[k]) verknuepft[KATEGORIE_ZU_SPALTE[k]] = rund((verknuepft[KATEGORIE_ZU_SPALTE[k]] || 0) + Math.abs(b));
    else if (NUR_VORSCHLAG[k]) vorschlag[NUR_VORSCHLAG[k]] = rund((vorschlag[NUR_VORSCHLAG[k]] || 0) + Math.abs(b));
  });
  return { verknuepft: verknuepft, vorschlag: vorschlag };
}

/* Intervall -> Faktor auf ein Jahr */
const JE_JAHR = { monthly: 12, monatlich: 12, quarterly: 4, vierteljaehrlich: 4, 'vierteljährlich': 4, half_yearly: 2, halbjaehrlich: 2, yearly: 1, annually: 1, jaehrlich: 1, 'jährlich': 1 };
/**
 * /monthly-costs: Hausgeld je Jahr fuer die Objektfelder hg_ul (umlagefaehig) und hg_nul (nicht umlagefaehig, inkl.
 * Ruecklage wie tab6 im Formular). Fuer den Unterlagen-Abgleich (Paket V5: Wirtschaftsplan gegen ViVi).
 */
function hausgeldJahr(liste) {
  let ul = null, nul = null;
  (Array.isArray(liste) ? liste : []).forEach(function (o) {
    if (!o || typeof o !== 'object') return;
    const k = kategorie(o), name = String(erstes(o, ['name', 'description', 'label']) || '').toLowerCase();
    if (!/hausgeld/.test(k + ' ' + name)) return;
    const f = JE_JAHR[String(erstes(o, ['interval', 'frequency', 'rhythm']) || 'monthly').toLowerCase()];
    const b = betrag(o); if (b == null || !f) return;
    const j = rund(Math.abs(b) * f);
    if (/vorauszahlung|umlagef/.test(k + ' ' + name) && !/nicht umlagef/.test(k + ' ' + name)) ul = rund((ul || 0) + j);
    else nul = rund((nul || 0) + j);   /* „Hausgeld (WEG)“ und „Hausgeld (Rücklage)“ */
  });
  return { hg_ul: ul, hg_nul: nul };
}

/**
 * Alles zusammen fuer ein Jahr. paket = { steueruebersicht: string, kosten: [], laufend: [], einnahmen: [] }.
 * Vorrang: die Anlage-V-Zeile aus /tax-overview, sonst die Summe aus /costs. Ergebnis wie ausVivi().felder.
 */
function ausViviSteuer(paket, jahr) {
  paket = paket || {};
  const felder = {}, vorschlaege = {};
  const pre = 'steuer.' + jahr + '.';
  const tv = ausSteueruebersicht(paket.steueruebersicht);
  const ko = ausKosten(paket.kosten, jahr);
  Object.keys(ko.verknuepft).forEach(function (sp) { felder[pre + sp] = { wert: ko.verknuepft[sp], quelle: 'costs' }; });
  Object.keys(tv).forEach(function (sp) { felder[pre + sp] = { wert: tv[sp], quelle: 'tax-overview' }; });
  Object.keys(ko.vorschlag).forEach(function (sp) { vorschlaege[pre + sp] = { wert: ko.vorschlag[sp], quelle: 'costs' }; });
  const hg = hausgeldJahr(paket.laufend);
  if (hg.hg_ul != null) felder.hg_ul = { wert: hg.hg_ul, quelle: 'monthly-costs' };
  if (hg.hg_nul != null) felder.hg_nul = { wert: hg.hg_nul, quelle: 'monthly-costs' };
  return { felder: felder, vorschlaege: vorschlaege };
}

/* Pfade, die der Abruf mit AKTIV lesen wuerde (nur GET, Pruefer C kennt sie als Lesepfade) */
function lesePfade(projektId, jahr) {
  const P = '/projects/' + encodeURIComponent(String(projektId));
  return [
    { pfad: '/tax-overview', abfrage: { year: jahr, project_id: String(projektId) } },
    { pfad: P + '/costs', abfrage: {} },
    { pfad: P + '/monthly-costs', abfrage: {} },
    { pfad: P + '/revenues', abfrage: {} }
  ];
}

module.exports = { AKTIV, ZEILE_ZU_SPALTE, KATEGORIE_ZU_SPALTE, NUR_VORSCHLAG, ausSteueruebersicht, ausKosten, hausgeldJahr, ausViviSteuer, lesePfade };
