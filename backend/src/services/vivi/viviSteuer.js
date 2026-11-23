'use strict';
/* services/vivi/viviSteuer.js — v4020 · Paket V4 (Steuer): Steuerjahre aus ViVi lesen, je Objekt und Jahr
 *
 * Bauplan Dateien/Architektur/ViVi-Anbindung-2026-11-22.md, Abschnitt 2.3. Marcel 23.11.2026: „auswählen, ob die
 * Belege automatisch in die Steuerjahre geschrieben werden … bei Einsteigern gar nicht anbieten … eine Übersicht in der
 * Pilot-Analyse … Einstellungen, weil es Sachen gibt, die wir nicht wollen.“
 *
 * GEMESSEN am Testkonto (23.11.2026, nur GET, Antworten in tools/vivi-antworten/steuer-belege-2026-11-23.json):
 *   GET /tax-overview?year=&project_id=            data ist ein OBJEKT (Spezifikation sagt string): income[] und
 *                                                  expenses[] je Zeilenbereich der Anlage V ({ zeile: '55-72', label,
 *                                                  amount }), Betrag 0 = nichts gebucht. Jahre ohne Buchung: alle 0.
 *   GET /tax-overview?year=&project_id=&line=55-72 dazu line_details: { zeile, label, amount, items: [{ label,
 *                                                  date: 'TT.MM.JJJJ', amount }], items_truncated }. Die Belege einer
 *                                                  Zeile MIT Datum und Betrag, also genau die Steuerkategorie des Belegs.
 *                                                  Nur der ganze Bereich ('55-72'), eine Einzelzeile ('55') ergibt
 *                                                  line_details.error. Zinsen (46-48) kommen monatlich aus dem Tilgungsplan
 *                                                  (group, info 'Tilgungsplan'), ohne Datum.
 *   GET /receipts?project_id=                      Belege mit Betrag, Datum, Zahlstatus, OHNE Steuerkategorie. Deshalb
 *                                                  liest dieses Modul die Zeilen der Anlage V, nicht die Belegliste.
 *   /costs, /monthly-costs, /revenues, /planned-costs, /depreciation: Summen bzw. im Testkonto leer, ohne Jahr und
 *                                                  ohne Kategorie. Nicht gelesen.
 *
 * ZWEI ARTEN VON ZEILEN:
 *   summe   Mieteinnahmen, NK-Vorauszahlungen, Schuldzinsen. ViVi rechnet sie aus Mieten und Tilgungsplan. DealPilot
 *           vergleicht die Jahressumme und setzt sie auf Wunsch (ein Jahr, das noch laeuft, nie: dort kennt ViVi erst
 *           die Monate bis heute, DealPilot rechnet das ganze Jahr).
 *   belege  Erhaltung, Betriebskosten, nicht umgelegte Kosten, sonstige Kosten, bewegliche Wirtschaftsgueter. Jeder
 *           Posten traegt Datum und Betrag. DealPilot uebernimmt nur Posten, die nicht schon als Beleg erfasst sind
 *           (gleicher Betrag, gleiches Datum) und ADDIERT sie wie der Beleg-Import (dpWkUebernehmen).
 *   vergleich  AfA (33-35): DealPilot rechnet die AfA selbst, ViVi steht nur daneben.
 *
 * Die Entscheidung, was wann geschrieben wird, faellt im Browser (js/vivi-steuer-abgleich.js), weil Steuerjahr,
 * Steuerstand (_jahre, erklaert/Bescheid) und erfasste Belege (_dok_eingang) im Objekt liegen. Das Backend schreibt
 * objects.data nie (viviDienst Regel 3). Hier: Lesepfade, Auslese, Einstellung.
 */

/* Zeilenbereiche der Anlage V (wie ViVi sie liefert) -> tax_records-Spalte, Kategorie der Einstellung, Art */
const ZEILEN = Object.freeze([
  { zeile: '13-15', spalte: 'einnahmen_km', kat: 'mieten', art: 'summe', seite: 'einnahme' },
  { zeile: '20', spalte: 'einnahmen_nk', kat: 'nk_vz', art: 'summe', seite: 'einnahme' },
  { zeile: '33-35', spalte: 'afa', kat: null, art: 'vergleich', seite: 'ausgabe' },
  { zeile: '42-45', spalte: 'sonst_bewegl_wg', kat: 'bewegliche', art: 'belege', seite: 'ausgabe' },
  { zeile: '46-48', spalte: 'schuldzinsen', kat: 'zinsen', art: 'summe', seite: 'ausgabe' },
  { zeile: '55-72', spalte: 'erhaltungsaufwand', kat: 'erhaltung', art: 'belege', seite: 'ausgabe' },
  { zeile: '73-75', spalte: 'nk_umlf', kat: 'betriebskosten', art: 'belege', seite: 'ausgabe' },
  { zeile: '76-78', spalte: 'nk_n_umlf', kat: 'nicht_umgelegt', art: 'belege', seite: 'ausgabe' },
  { zeile: '80-82', spalte: 'sonst_kosten', kat: 'sonstige', art: 'belege', seite: 'ausgabe' }
]);
/* Abwaehlbar in Einstellungen › Konto › Externe Anbieter › ViVi. Kundentext ohne Gedankenstrich und Semikolon. */
const KATEGORIEN = Object.freeze([
  { id: 'erhaltung', label: 'Erhaltungsaufwand', hinweis: 'Reparaturen und Instandhaltung, Anlage V Zeile 55 bis 72' },
  { id: 'betriebskosten', label: 'Umgelegte Betriebskosten', hinweis: 'Hausgeld umlagefähig, Grundsteuer, Versicherung, Wartung, Zeile 73 bis 75' },
  { id: 'nicht_umgelegt', label: 'Nicht umgelegte Kosten', hinweis: 'Hausgeld nicht umlagefähig, Zeile 76 bis 78' },
  { id: 'sonstige', label: 'Sonstige Werbungskosten', hinweis: 'Verwaltung, Beratung, Kontoführung, Zeile 80 bis 82' },
  { id: 'bewegliche', label: 'Bewegliche Wirtschaftsgüter', hinweis: 'Abschreibung auf Einrichtung, Zeile 42 bis 45' },
  { id: 'zinsen', label: 'Schuldzinsen', hinweis: 'aus dem Tilgungsplan in ViVi, Zeile 46 bis 48' },
  { id: 'mieten', label: 'Mieteinnahmen', hinweis: 'Kaltmiete, Zeile 15' },
  { id: 'nk_vz', label: 'Umgelegte Nebenkosten', hinweis: 'Vorauszahlungen der Mieter, Zeile 20' }
]);
const MODI = Object.freeze(['aus', 'vorschlag', 'automatisch']);
const STANDARD_MODUS = 'vorschlag';
const MAX_JAHRE = 8;   /* Anfragebremse: hoechstens acht Jahre je Abruf (je Jahr eine Anfrage plus eine je gebuchter Belegzeile) */

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
/* 'TT.MM.JJJJ' oder 'JJJJ-MM-TT' -> 'JJJJ-MM-TT', sonst null */
function isoDatum(d) {
  const s = String(d == null ? '' : d).trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}

/** Einstellung des Nutzers auf bekannte Werte bringen. Unbekannte Kategorien fallen weg, fehlende sind an. */
function einstellungNormal(roh) {
  const r = roh && typeof roh === 'object' ? roh : {};
  const modus = MODI.indexOf(r.modus) >= 0 ? r.modus : STANDARD_MODUS;
  const kategorien = {};
  KATEGORIEN.forEach(function (k) { kategorien[k.id] = !(r.kategorien && r.kategorien[k.id] === false); });
  return { modus: modus, kategorien: kategorien };
}

/** Jahre vom Kaufjahr bis zum laufenden Jahr, hoechstens MAX_JAHRE (die juengsten). */
function jahre(kaufdatum, jetzt) {
  const heute = new Date(jetzt == null ? Date.now() : jetzt).getFullYear();
  const m = /^(\d{4})/.exec(String(kaufdatum || ''));
  let von = m ? +m[1] : heute;
  if (!(von >= 2000) || von > heute) von = heute;
  von = Math.max(von, heute - MAX_JAHRE + 1);
  const out = [];
  for (let j = von; j <= heute; j++) out.push(j);
  return out;
}
function kaufdatumAus(daten, projekt) {
  const d = daten || {};
  return d.wirtschaftlicher_uebergang || d.kaufdat || (projekt && projekt.purchase_date) || null;
}

/* Zeilenbereich '55-72' -> Eintrag aus ZEILEN */
function zeileZu(z) { const s = String(z == null ? '' : z).replace(/\s/g, ''); return ZEILEN.find(function (x) { return x.zeile === s; }) || null; }

/**
 * Eine Antwort von /tax-overview (data-Objekt) und die line_details je Zeile zu Werten eines Jahres.
 * Rueckgabe { spalte: { summe, zeile, label, kat, art, posten: [{datum, betrag, text}] | null, posten_gekuerzt } }.
 * Betrag 0 heisst bei ViVi „nichts gebucht“: kein Wert (nie eine Null, die einen DealPilot-Wert ueberschreibt).
 */
function ausJahr(uebersicht, details) {
  const aus = {};
  if (!uebersicht || typeof uebersicht !== 'object' || Array.isArray(uebersicht)) return aus;
  [].concat(Array.isArray(uebersicht.income) ? uebersicht.income : [], Array.isArray(uebersicht.expenses) ? uebersicht.expenses : []).forEach(function (z) {
    if (!z || typeof z !== 'object') return;
    const def = zeileZu(z.zeile); if (!def) return;
    const n = zahl(z.amount); if (n == null || n === 0) return;
    const w = { summe: rund(Math.abs(n)), zeile: def.zeile, label: String(z.label || ''), kat: def.kat, art: def.art, posten: null, posten_gekuerzt: 0 };
    const d = details && details[def.zeile];
    if (def.art === 'belege' && d && typeof d === 'object' && Array.isArray(d.items)) {
      w.posten = d.items.map(function (it) {
        const b = zahl(it && it.amount);
        /* v4040 · aufgeteilte Kontoumsaetze tragen die Beschreibung in group (label ist nur „Zahlung vom …“) */
        /* ohne date steht das Datum im label („Zahlung vom 15.12.2025“) */
        const dl = /(\d{1,2}\.\d{1,2}\.\d{4})/.exec(String((it && it.label) || ''));
        return b == null ? null : { datum: isoDatum(it.date) || (dl ? isoDatum(dl[1]) : null), betrag: rund(Math.abs(b)), text: String((it && (it.group || it.label)) || '').slice(0, 160) };
      }).filter(Boolean);
      w.posten_gekuerzt = +d.items_truncated || 0;
    }
    aus[def.spalte] = w;
  });
  return aus;
}

/** Welche Zeilen brauchen die Einzelposten? Nur Belegzeilen mit Betrag (spart Anfragen). */
function zeilenMitPosten(uebersicht) {
  if (!uebersicht || typeof uebersicht !== 'object') return [];
  return (Array.isArray(uebersicht.expenses) ? uebersicht.expenses : []).filter(function (z) {
    const def = z && zeileZu(z.zeile); const n = z && zahl(z.amount);
    return def && def.art === 'belege' && n != null && n !== 0;
  }).map(function (z) { return zeileZu(z.zeile).zeile; });
}

/** Lesepfade eines Jahres (nur GET). Die Zeilen mit Posten folgen erst nach der ersten Antwort (zeilenMitPosten). */
function lesePfade(projektId, jahr, zeilen) {
  const pid = String(projektId);
  const out = [{ pfad: '/tax-overview', abfrage: { year: jahr, project_id: pid } }];
  (zeilen || []).forEach(function (z) { out.push({ pfad: '/tax-overview', abfrage: { year: jahr, project_id: pid, line: z } }); });
  return out;
}

/** Feld-ID in vivi_werte (jahr > 0): steuer.<jahr>.<spalte> */
function feldId(jahr, spalte) { return 'steuer.' + jahr + '.' + spalte; }

/* v4040 · Marcel 23.11.2026: „Bewirtschaftung ist heute, Hausgeld und allem, das wäre geil, wenn wir das übernehmen können …
   in jedem Tab, wenn wir im Ist-Zustand sind, die aktuellen Werte anzeigen“. Aus den Belegen EINES Steuerjahres (posten der
   Zeilen 73 bis 75 und 76 bis 78) die Jahreswerte Hausgeld umlagefaehig, Hausgeld nicht umlagefaehig und Grundsteuer.
   Nur was als Hausgeld oder Grundsteuer erkennbar ist (Text des Postens, ViVi teilt Hausgeld in „(Vorauszahlung)“ und
   „(nicht umlagefähig)“). Kaufjahr mit weniger als 12 Monaten: auf 12 Monate hochgerechnet. Ohne Treffer kein Feld. */
const RE_HAUSGELD = /hausgeld|\(vorauszahlung\)|\(nicht umlagef/i;
const RE_GRUNDSTEUER = /grundsteuer/i;
function bewirtschaftungAus(felder, jahr, monate) {
  const out = {};
  const w = function (sp) { return felder ? felder[feldId(jahr, sp)] : null; };
  const summe = function (z, re) {
    if (!z || !Array.isArray(z.posten)) return null;
    let s = 0, n = 0;
    z.posten.forEach(function (p) { if (p && re.test(String(p.text || '')) && typeof p.betrag === 'number') { s += p.betrag; n++; } });
    return n ? s : null;
  };
  const f = monate > 0 && monate < 12 ? 12 / monate : 1;
  const q = 'tax-overview ' + jahr + (f !== 1 ? ' (auf 12 Monate)' : '');
  const ul = summe(w('nk_umlf'), RE_HAUSGELD), gs = summe(w('nk_umlf'), RE_GRUNDSTEUER), nul = summe(w('nk_n_umlf'), RE_HAUSGELD);
  if (ul != null && ul > 0) out.hg_ul = { wert: Math.round(ul * f), quelle: q };
  if (nul != null && nul > 0) out.hg_nul = { wert: Math.round(nul * f), quelle: q };
  if (gs != null && gs > 0) out.grundsteuer = { wert: Math.round(gs * f), quelle: q };
  return out;
}
/** Welches Steuerjahr traegt die Bewirtschaftung von heute: das letzte volle Jahr nach dem Kaufjahr, sonst das Kaufjahr. */
function bewirtschaftungsJahr(kaufdatum, jetzt, gelesen) {
  const heute = new Date(jetzt == null ? Date.now() : jetzt).getFullYear();
  const m = /^(\d{4})-(\d{2})/.exec(String(kaufdatum || ''));
  const kj = m ? +m[1] : null;
  const J = (gelesen || []).map(Number).filter(function (j) { return j < heute; }).sort(function (a, b) { return b - a; });
  for (const j of J) { if (kj == null || j > kj) return { jahr: j, monate: 12 }; }
  if (kj != null && J.indexOf(kj) >= 0) return { jahr: kj, monate: 13 - +m[2] };
  return null;
}

/* Alt (v3951, Entwurf): Textform der Steueruebersicht, Zeile -> Spalte. Bleibt als Rueckfall, falls ViVi doch Text liefert. */
const ZEILE_ZU_SPALTE = Object.freeze({ 15: 'einnahmen_km', 20: 'einnahmen_nk', 48: 'schuldzinsen', 55: 'erhaltungsaufwand', 75: 'nk_umlf', 78: 'nk_n_umlf' });
function ausSteueruebersicht(text) {
  if (text && typeof text === 'object') {
    const j = ausJahr(text, null), aus = {};
    Object.keys(j).forEach(function (sp) { if (j[sp].art !== 'vergleich' && Object.values(ZEILE_ZU_SPALTE).indexOf(sp) >= 0) aus[sp] = j[sp].summe; });
    return aus;
  }
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

module.exports = { ZEILEN, KATEGORIEN, MODI, STANDARD_MODUS, MAX_JAHRE, ZEILE_ZU_SPALTE, einstellungNormal, jahre, kaufdatumAus, ausJahr, zeilenMitPosten,
  lesePfade, feldId, isoDatum, ausSteueruebersicht, bewirtschaftungAus, bewirtschaftungsJahr };
