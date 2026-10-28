// sperren_anfragen.js  (v3020)
//
// ANFRAGELISTE AN DIE ÄMTER — jede Sperre des Registers, je Ausschuss
// gebündelt und mit der E-Mail der Geschäftsstelle verbunden.
//
// Marcel 28.10.2026: „bitte alle Sperren immer vermerken und pflege eine
// Liste dazu mit E-Mail, damit ich das irgendwann mal abfragen kann und
// dann Anfrage bei den Ämtern" — und: „die Ämter, die wir anfragen
// sollten, mit Mail und worum es geht, könnten wir in unser Admin-Portal
// setzen."
//
// EINE Rechnung, zwei Leser:
//   · tools/sperren-anfrageliste.mjs  → CSV + Markdown unter Dateien/Register/
//   · GET /register/anfragen (mb-Backend) → Admin „Register & Ernte",
//     Abschnitt „Anfragen an Ämter" (über den Admin-Proxy, requireAdmin)
//
// WOHER:
//   · Sperren über leseSaatdateien(SAATDATEIEN) — derselbe Leseweg wie der
//     Bericht und die Deckung; Sperre ist istSperre() aus register_deckung.js.
//   · Kontakte aus ausschuss_kontakte.json (nur belegte Funktionspostfächer,
//     je Eintrag quelle_url + gelesen_am). Dubletten-Schreibweisen eines
//     Ausschusses führt die Datei unter `alias` zusammen.
//
// Der SCHLÜSSEL je Ausschuss ist `LAND:normName(kanonischer Name)` — er
// ist zugleich der Primärschlüssel von mb.amt_anfragen (Migration 022).
// Wer normName() ändert, verwaist die gespeicherten Status.
//
// Nichts wird versendet. Der Anfragetext ist ein Vorschlag für mailto:.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SAATDATEIEN, leseSaatdateien } from './ausschuss_register.js';
import { istSperre, KENNZAHLEN, LC, LAENDER, maskiere } from './register_deckung.js';

const HIER = dirname(fileURLToPath(import.meta.url));
export const KONTAKTDATEI = join(HIER, 'ausschuss_kontakte.json');

export const ANFRAGE_STATUS = ['offen', 'angefragt', 'antwort', 'erledigt', 'abgelehnt'];
export const STATUS_NAME = { offen: 'offen', angefragt: 'angefragt', antwort: 'Antwort erhalten',
  erledigt: 'erledigt', abgelehnt: 'abgelehnt' };

/* Mehrzahl für den Anfragetext */
const KZ_TEXT = {
  lzs: 'Liegenschaftszinssätze', swf: 'Sachwertfaktoren',
  uk_flaeche: 'Umrechnungskoeffizienten für die Grundstücksgröße',
  uk_wgfz: 'Umrechnungskoeffizienten für die WGFZ', vgf: 'Vergleichsfaktoren',
  irw: 'Umrechnungskoeffizienten der Immobilienrichtwerte',
};
const kzVon = (k) => KENNZAHLEN[k] || String(k || 'sonstige');
const kzText = (k) => KZ_TEXT[k] || String(k).replace(/_/g, ' ');

export const GRUND_NAME = {
  kostenpflichtig: 'kostenpflichtig', genehmigungspflichtig: 'genehmigungspflichtig',
  nichtkommerziell: 'nur nichtkommerziell', auf_anfrage: 'auf Anfrage',
  auf_anfrage_kostenfrei: 'auf Anfrage (kostenfrei)', 'nicht veröffentlicht': 'nicht veröffentlicht',
  'nicht abgeleitet': 'nicht abgeleitet', kostenfrei: 'kostenfrei, aber nicht verwertbar',
  frei: 'frei, aber nicht verwertbar', veraltet: 'veraltet', ohne_angabe: 'ohne Angabe',
};
/* Reihenfolge, nach der der „Hauptgrund" eines Ausschusses gewählt wird:
   was eine Anfrage am ehesten löst, zuerst. */
const GRUND_RANG = ['kostenpflichtig', 'genehmigungspflichtig', 'nichtkommerziell', 'auf_anfrage',
  'auf_anfrage_kostenfrei', 'nicht veröffentlicht', 'nicht abgeleitet', 'veraltet',
  'kostenfrei', 'frei', 'ohne_angabe'];
const grundVon = (s) => {
  const z = String(s.zugang || '').trim();
  return z ? z : 'ohne_angabe';
};

/* ── Normalisierung des Ausschussnamens ────────────────────────────────
   Nur ganze Wörter, keine Teilwörter (anders als normName() der Deckung,
   die „in" auch mitten im Wort trifft). */
const STOPP = new Set(['gutachterausschuss', 'gutachterausschusses', 'gemeinsamer', 'gemeinsame',
  'fuer', 'grundstueckswerte', 'grundstueckswerten', 'immobilienwerte', 'ermittlung', 'von',
  'der', 'die', 'den', 'des', 'das', 'dem', 'im', 'in', 'bereich', 'und', 'sonstige',
  'wertermittlungen', 'zur']);
export function normName(n) {
  return String(n || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    .filter((w) => w && !STOPP.has(w)).join(' ');
}
export const schluesselVon = (land, name) => String(land || '??').toUpperCase() + ':' + normName(name);

const landVon = (s) => LC[String((s && s.ags) || '').replace(/\D/g, '').slice(0, 2)]
  || (s && s.land_code && LAENDER.includes(String(s.land_code).toUpperCase())
      ? String(s.land_code).toUpperCase() : null);
const jahrVon = (s) => {
  const b = Number(s.berichtsjahr ?? s.jahrgang);
  if (Number.isFinite(b) && b > 1900) return b;
  const t = /^(\d{4})/.exec(String(s.stichtag || ''));
  return t ? Number(t[1]) : null;
};
const nameVon = (s) => s.gaa_name || s.ausschuss || s.gebiet_name || ('AGS ' + s.ags);
const kurz = (t, n = 400) => {
  if (t == null || t === '') return null;
  const s = maskiere(String(t)).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
const preisVon = (s) => {
  if (s.gebuehr_eur != null && s.gebuehr_eur !== '') return s.gebuehr_eur + ' €';
  if (s.gebuehr) return kurz(s.gebuehr, 160);
  return null;
};

/* ── Kontaktdatei ────────────────────────────────────────────────────── */
export function ladeKontakte(datei = KONTAKTDATEI) {
  const roh = JSON.parse(readFileSync(datei, 'utf8'));
  const eintraege = roh.ausschuesse || {};
  const index = new Map();   /* schluessel → { name, kontakt } */
  for (const [name, k] of Object.entries(eintraege)) {
    if (!k || !k.land) continue;
    const ziel = { name, kontakt: k };
    index.set(schluesselVon(k.land, name), ziel);
    for (const a of k.alias || []) index.set(schluesselVon(k.land, a), ziel);
  }
  return { eintraege, index, stand: roh.stand || null };
}

/* ── Prüfung der Kontaktdatei (tools/sperren-anfrageliste.mjs → RC 1) ──
   Eine Adresse ohne Beleg ist eine geratene Adresse. Ein Postfach, das
   wie vorname.nachname aussieht, ist eine Person, keine Geschäftsstelle. */
const FUNKTION = /gutachter|gaa|^ga[.@-]|service|info|wertermittlung|geo|bewertung|geschaeftsstelle|gesch[aä]ftsstelle|verm|kataster|oga|zgga|grundstueck|immobilien|bodenrichtwert|amt|stadt|kreis|lra|poststelle|kontakt/i;
export function pruefeKontakte(K = ladeKontakte()) {
  const fehler = [];
  const gesehen = new Map();
  const MAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}$/;
  for (const [name, k] of Object.entries(K.eintraege)) {
    if (!k || !LAENDER.includes(k.land)) fehler.push(name + ': land fehlt oder unbekannt');
    for (const feld of ['email', 'email_obere_stelle', 'email_landkreis']) {
      const e = k && k[feld];
      if (e == null) continue;
      if (!MAIL.test(e)) fehler.push(name + ': ' + feld + ' ungültig (' + e + ')');
      else if (!FUNKTION.test(e.split('@')[0]) && /^[a-zäöü]+[.-][a-zäöü]+$/i.test(e.split('@')[0]))
        fehler.push(name + ': ' + feld + ' sieht persönlich aus (' + e + ')');
    }
    if (k && (k.email || k.email_obere_stelle) && !k.quelle_url) fehler.push(name + ': E-Mail ohne quelle_url');
    if (k && k.gelesen_am != null && !/^\d{4}-\d{2}-\d{2}$/.test(k.gelesen_am)) fehler.push(name + ': gelesen_am nicht JJJJ-MM-TT');
    for (const n of [name, ...((k && k.alias) || [])]) {
      const s = schluesselVon(k && k.land, n);
      if (gesehen.has(s) && gesehen.get(s) !== name) fehler.push(name + ': Schlüssel ' + s + ' doppelt (auch ' + gesehen.get(s) + ')');
      gesehen.set(s, name);
    }
  }
  return fehler;
}

/* ── Anfragetext ─────────────────────────────────────────────────────── */
export function anfrageText(e) {
  const kz = Object.entries(e.kennzahlen).sort((a, b) => b[1] - a[1]).map(([k]) => kzText(k));
  const was = kz.length > 1 ? kz.slice(0, -1).join(', ') + ' und ' + kz[kz.length - 1] : kz[0];
  const jg = e.jahrgang ? ' (Jahrgang ' + e.jahrgang + ')' : '';
  const betreff = 'Anfrage ' + was + jg + ' – ' + e.ausschuss;
  const g = e.hauptgrund;
  let bitte;
  if (g === 'kostenpflichtig') {
    bitte = 'Nach unseren Unterlagen sind diese Daten bei Ihnen kostenpflichtig erhältlich. '
      + 'Wir würden sie gern erwerben und bitten um Preis und Bestellweg. Bitte teilen Sie uns '
      + 'außerdem mit, ob die Nutzungsbedingungen die Verwendung in einer kommerziellen '
      + 'Bewertungssoftware mit Quellenangabe abdecken.';
  } else if (g === 'genehmigungspflichtig' || g === 'nichtkommerziell') {
    bitte = 'Nach unseren Unterlagen ist die Nutzung dieser Daten '
      + (g === 'nichtkommerziell' ? 'nur für nichtkommerzielle Zwecke freigegeben' : 'genehmigungspflichtig')
      + '. Wir bitten um eine Nutzungserlaubnis für die Verwendung in einer kommerziellen '
      + 'Bewertungssoftware, mit Nennung Ihres Gutachterausschusses als Quelle – gern auch '
      + 'gegen Gebühr; bitte nennen Sie uns ggf. die Bedingungen.';
  } else if (g === 'nicht abgeleitet' || g === 'nicht veröffentlicht') {
    bitte = 'In Ihrem Grundstücksmarktbericht haben wir diese Daten nicht gefunden. Leiten Sie '
      + 'sie ab bzw. sind sie auf Anfrage erhältlich? Falls ja, bitten wir um Überlassung '
      + 'und um die Nutzungsbedingungen für eine kommerzielle Bewertungssoftware mit Quellenangabe.';
  } else {
    bitte = 'Nach unseren Unterlagen sind diese Daten bei Ihnen auf Anfrage erhältlich. Wir bitten '
      + 'um Überlassung und um die Nutzungsbedingungen für die Verwendung in einer kommerziellen '
      + 'Bewertungssoftware mit Nennung Ihres Gutachterausschusses als Quelle; ggf. anfallende '
      + 'Gebühren übernehmen wir.';
  }
  const quelle = e.bestell_urls[0] || e.quelle_urls[0];
  const text = 'Sehr geehrte Damen und Herren,\n\n'
    + 'mit DealPilot (Junker Solution) entwickeln wir eine Software zur Analyse von '
    + 'Immobilieninvestitionen. Für Ertrags- und Sachwert verwenden wir ausschließlich die '
    + 'amtlichen Daten der Gutachterausschüsse und weisen den Ausschuss im Bericht als Quelle aus.\n\n'
    + 'Für Ihren Zuständigkeitsbereich fehlen uns ' + was + jg + '. ' + bitte + '\n\n'
    + (quelle ? 'Unser bisheriger Stand: ' + quelle + '\n\n' : '')
    + 'Vielen Dank und freundliche Grüße\n\nMarcel Junker\nJunker Solution · DealPilot';
  return { betreff, text };
}

/* ── Die Liste ───────────────────────────────────────────────────────── */
export function sperrenAnfrageliste({ land = null, saetze = null, kontakte = null } = {}) {
  const alle = saetze || leseSaatdateien(SAATDATEIEN).alle;
  const K = kontakte || ladeKontakte();
  const L = land ? String(land).toUpperCase() : null;
  const gruppen = new Map();
  let sperrenGesamt = 0;
  for (const s of alle) {
    if (!istSperre(s)) continue;
    const ld = landVon(s) || '??';
    if (L && ld !== L) continue;
    sperrenGesamt++;
    const roh = nameVon(s);
    const treffer = K.index.get(schluesselVon(ld, roh));
    const name = treffer ? treffer.name : roh;
    const key = schluesselVon(ld, name);
    let e = gruppen.get(key);
    if (!e) {
      e = { schluessel: key, land: ld, ausschuss: maskiere(name), namen: new Set(), sperren: 0,
            kennzahlen: {}, gruende: {}, preise: new Set(), quelle_urls: new Set(),
            bestell_urls: new Set(), jahrgang: null, grund_text: null,
            zustaendige_stelle: null, kontakt: treffer ? treffer.kontakt : null };
      gruppen.set(key, e);
    }
    e.namen.add(maskiere(roh));
    e.sperren++;
    const kz = kzVon(s.kennzahl);
    e.kennzahlen[kz] = (e.kennzahlen[kz] || 0) + 1;
    const g = grundVon(s);
    e.gruende[g] = (e.gruende[g] || 0) + 1;
    const p = preisVon(s); if (p) e.preise.add(p);
    if (s.quelle_url && /^https?:/i.test(s.quelle_url)) e.quelle_urls.add(s.quelle_url);
    /* mailto: als Bestellweg ist eine Adresse, kein Link — die gehört in die Kontaktdatei */
    if (s.bestell_url && /^https?:/i.test(s.bestell_url)) e.bestell_urls.add(s.bestell_url);
    const j = jahrVon(s); if (j && (!e.jahrgang || j > e.jahrgang)) e.jahrgang = j;
    if (!e.grund_text) e.grund_text = kurz(s.warum_kein_wert || s.sperre_grund || s.unvollstaendig_grund);
    if (!e.zustaendige_stelle && s.zustaendige_stelle) e.zustaendige_stelle = kurz(s.zustaendige_stelle, 200);
  }
  const ausschuesse = [...gruppen.values()].map((e) => {
    const hauptgrund = GRUND_RANG.find((g) => e.gruende[g]) || Object.keys(e.gruende)[0];
    const k = e.kontakt;
    const r = {
      schluessel: e.schluessel, land: e.land, ausschuss: e.ausschuss,
      namen: [...e.namen].filter((n) => n !== e.ausschuss),
      sperren: e.sperren, kennzahlen: e.kennzahlen, gruende: e.gruende, hauptgrund,
      preise: [...e.preise].slice(0, 3), quelle_urls: [...e.quelle_urls].slice(0, 3),
      bestell_urls: [...e.bestell_urls].slice(0, 3), jahrgang: e.jahrgang,
      grund_text: e.grund_text, zustaendige_stelle: e.zustaendige_stelle,
      email: k && k.email ? k.email : null,
      kontakt: k ? { email: k.email || null, telefon: k.telefon || null, anschrift: k.anschrift || null,
        webseite: k.webseite || null, kontaktformular_url: k.kontaktformular_url || null,
        email_obere_stelle: k.email_obere_stelle || null, obere_stelle: k.obere_stelle || null,
        email_landkreis: k.email_landkreis || null, hinweis: k.hinweis || null,
        quelle_url: k.quelle_url || null, gelesen_am: k.gelesen_am || null } : null,
    };
    r.anfrage = anfrageText(r);
    return r;
  }).sort((a, b) => (a.land < b.land ? -1 : a.land > b.land ? 1 : b.sperren - a.sperren
    || a.ausschuss.localeCompare(b.ausschuss, 'de')));
  const jeGrund = {};
  const jeLand = {};
  for (const a of ausschuesse) {
    for (const [g, n] of Object.entries(a.gruende)) jeGrund[g] = (jeGrund[g] || 0) + n;
    jeLand[a.land] = jeLand[a.land] || { ausschuesse: 0, sperren: 0, mit_email: 0 };
    jeLand[a.land].ausschuesse++; jeLand[a.land].sperren += a.sperren;
    if (a.email) jeLand[a.land].mit_email++;
  }
  return {
    stand: new Date().toISOString().slice(0, 10), land: L, kontakte_stand: K.stand,
    zusammenfassung: {
      ausschuesse: ausschuesse.length, sperren: sperrenGesamt,
      mit_email: ausschuesse.filter((a) => a.email).length,
      nur_obere_stelle: ausschuesse.filter((a) => !a.email && a.kontakt && a.kontakt.email_obere_stelle).length,
      mit_kontaktformular: ausschuesse.filter((a) => !a.email && a.kontakt && a.kontakt.kontaktformular_url).length,
      je_grund: jeGrund, je_land: jeLand,
    },
    ausschuesse,
  };
}
