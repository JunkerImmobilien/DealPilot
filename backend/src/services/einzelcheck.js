'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * services/einzelcheck.js · v3940 / v3941 · DER EINZEL-CHECK VON DER LANDING
 *
 * Marcel 20.11.2026 (Preis entschieden: 3,99 EUR): Ohne Konto laedt ein Besucher bis zu vier Unterlagen
 * hoch (Exposé, Mietaufstellung, WEG-Protokoll, Energieausweis …). Kostenlos werden ZWEI davon mit
 * einem guenstigen Modell gelesen und grob eingeschaetzt. Fuer 3,99 EUR (Stripe Checkout, mode payment,
 * lookup_key dp_einzelcheck_399) entsteht der volle Bericht: alle vier Unterlagen, normales Modell,
 * dazu Lage und Markt aus dem Marktbericht-Dienst (v3941: Stufe 2, siehe unten). Wer binnen
 * 14 Tagen ein Paket bucht, bekommt die 3,99 EUR angerechnet (Stripe-Promotion-Code auf den Coupon
 * dp_einzelcheck_anrechnung, derselbe Weg wie der Flyer-Code ?code=) und das Objekt landet im Konto
 * (Fragment #dc=1&… an js/dealcheck-uebernahme.js, derselbe Weg wie der Deal-Check).
 *
 * v3941 (21.11.2026):
 *   - Marktbericht STUFE 2 statt 3 (Marcel 20.11.: „Stufe 2 würde reichen“). Keine registergestützte
 *     Wertindikation (Ertrags-, Sachwert, Liegenschaftszins) mehr im Bericht, dafür der Satz mit dem Weg in
 *     die App. Wie Stufe 2 in der App (dealpilot-mb.js run: wert_stufe 2 OHNE fast) mit KI-Text und
 *     Preishistorie. Feldzuordnung in marktAus().
 *   - Gescannte PDFs: ohne Textebene liest ocr.js ocrAusPuffer() die Seiten NUR IM SPEICHER
 *     (pdftoppm stdin -> stdout, tesseract stdin -> stdout), höchstens 6 Seiten, eine Frist je Unterlage.
 *     Eine gescannte Unterlage zählt im kostenlosen Teil wie jede andere.
 *   - Rabatt-Vorrang: der Anrechnungs-Code EC… ersetzt in den Paketlinks jeden anderen Code (Flyer);
 *     umgesetzt im Browser (frontend/landing/einzelcheck.js mitCode()).
 *
 * v3944 (22.11.2026) · Marcel: „Vergleichsmieten angeben und Obergrenze für Investoren, was max drin ist.“
 *   - Die ortsuebliche Vergleichsmiete kommt wieder mit, OHNE Stufe 3: der mb-Dienst nimmt sie in
 *     /reports/einzelcheck vor der Stufensperre aus dem Quercheck (lib/vergleichsmiete_auszug.js, Antwortfeld
 *     `vergleichsmiete` neben data). Nur Mietspiegel, amtliche Mietpreisuebersicht oder DealPilot-Naeherung,
 *     sonst kein Wert. marktAus() -> vergleichsmiete, Weissliste vglAus().
 *   - Die Obergrenze rechnet der Browser mit js/mietpotenzial-kern.js (zulaessig, neuvermietung, zielmieteBremse).
 *
 * v3946 (22.11.2026) · Marcel nach dem Testkauf: „danach direkt den Bericht erstellen … wir machen einfach eine
 * Stufe drei … den Bodenrichtwert mit ausgeben … Grundangaben auf jeden Fall angegeben“.
 *   - Marktbericht STUFE 3 (MB_STUFE): Bodenrichtwert, Ertrags-, Sach- und Vergleichswert, fuehrendes Verfahren.
 *     Uebernommen nur ueber die Weissliste wertAus(): Zahlen, Herkunftsstufe, Gruende, Lizenzvermerke ohne Portal-
 *     und Quellennamen. Ohne Anschrift (Strasse) gilt der Bodenrichtwert nicht fuer das Objekt: dann kein
 *     Bodenrichtwert und keine Verfahren, die ihn brauchen (kein Verfahren rechnet halb), nur der Weg dorthin.
 *   - GRUNDANGABEN (grundSauber, grundFehlt): Kaufpreis, Miete, Wohnflaeche, Objektart, PLZ oder Ort und die
 *     Finanzierung (Eigenkapital, Zins, Tilgung, Zinsbindung) sind Pflicht vor dem Auslesen und vor dem Kauf.
 *     Sie gehen mit dem Kauf in den Zahlenstand (Weissliste, ohne Namen) und schlagen beim Bericht die
 *     gelesenen Werte (der Kaeufer hat sie bestaetigt). Eine Anschrift aus dem Formular geht wie die aus dem
 *     Exposé nur an den Marktbericht-Dienst, nie in den Zahlenstand.
 *
 * DATENSCHUTZ, VERBINDLICH (Pruefer: tools/einzelcheck-pruefen.mjs):
 *   1 Dateien nur im Arbeitsspeicher. multer.memoryStorage in der Route, pdftotext liest ueber STDIN und
 *     schreibt nach STDOUT - keine Datei auf der Platte, kein Puffer in der Datenbank. Gescannte PDFs
 *     ohne Textebene liest seit v3941 ocr.ocrAusPuffer() ebenso nur ueber STDIN/STDOUT (NICHT
 *     bildZuText(): der App-Weg schreibt Bilder nach tmpdir).
 *   2 Geschwaerzt wird VOR dem KI-Aufruf (schwaerzen.js), am Text, den die KI bekommt.
 *   3 Gespeichert werden nur Zahlen (zahlenSauber, eine Weissliste), mit Token-Hash, hoechstens 14 Tage.
 *     Danach loescht der Takt 'einzelcheckLoeschen'. Die Anschrift aus dem Exposé verlaesst den
 *     Arbeitsspeicher nur in Richtung Marktbericht-Dienst, dort mit ohneAblage (keine Zeile in
 *     mb.addresses, mb.properties, mb.market_reports).
 *   4 Das PDF baut der Browser (frontend/landing/einzelcheck.js mit js/dp-dokument.js) - auf dem Server
 *     liegt kein Bericht.
 *
 * Ein Kern liest NIE Einstellungen: Modell, Grenzen und Preise kommen hier aus der Umgebung bzw. aus
 * Stripe; gerechnet wird im Browser mit denselben Kernen wie im Deal-Check (DealKpis, DealScore2,
 * ScoreTier, DpMietpotenzial). Dieser Dienst liest, prueft und liefert nur Daten.
 *
 * Abhaengigkeiten sind austauschbar (_setzeDeps), damit der Pruefer ohne Netz und Datenbank laeuft.
 * ═══════════════════════════════════════════════════════════════════════════ */
const crypto = require('crypto');
const { spawn } = require('child_process');

const VERSION = 'v3946';
const LOOKUP_KEY = 'dp_einzelcheck_399';
/* Coupon in BEIDEN Stripe-Konten mit genau dieser ID anlegen (umgebungsblind wie ein lookup_key). */
const ANRECHNUNG_COUPON = 'dp_einzelcheck_anrechnung';
const FRIST_TAGE = 14;
const FREI_MAX_UNTERLAGEN = 2;
const VOLL_MAX_UNTERLAGEN = 4;
const MAX_DATEI_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_ZEICHEN = 120000;
const MAX_MAILS = 3;                 /* einzelcheck-2 · je Kauf so oft per Mail (PDF-Dienst und SMTP je Lauf) */
const MAX_MAIL_HTML = 12 * 1024 * 1024;
const MAX_BERICHTE = 3;             /* je Kauf so oft neu erzeugbar (Kosten je Lauf, siehe Bericht) */
const ERLAUBTE_MIME = ['application/pdf'];
/* v3941 · Texterkennung fuer gescannte PDFs: hoechstens 6 Seiten, 60 s je Unterlage (ocr.js grenzt selbst auch) */
const OCR_SEITEN = 6;
const OCR_ZEIT_MS = 60000;
const MB_STUFE = 3;                  /* v3946 · Wertermittlung (Stufe 3) wie in der App, mit KI-Text. v3941 bis v3945: 2 */

/* Welche Arten der Dokument-Import (dokumentSchemas.js) fuer den Einzel-Check liest. Alles andere
   (auch nicht erkannt) laeuft ueber das Exposé-Schema - wie dokument-import.js in der App. */
const DOKUMENT_ARTEN = ['mietaufstellung', 'weg_protokoll', 'hausgeld', 'energieausweis', 'teilungserklaerung', 'mietvertrag'];
const ART_NAME = { expose: 'Exposé', mietaufstellung: 'Mietaufstellung', weg_protokoll: 'WEG-Protokoll', hausgeld: 'Wirtschaftsplan',
  energieausweis: 'Energieausweis', teilungserklaerung: 'Teilungserklärung', mietvertrag: 'Mietvertrag', wertbericht: 'Marktbericht' };
/* einzelcheck-3 (Marcel 24.11.2026: „Marktbericht reingeladen mit 180.000 … die Unterlagen sagen was ganz anderes“).
   GEMESSEN am Muster „Marktbericht Profi Baeckerstr 7“: klassifiziere() erkennt ihn richtig als „marktbericht“, aber
   DOKUMENT_ARTEN kannte die Art nicht, und istExpose() sagte ja (Kaufpreis, Wohnfläche und „Vergleichsangebote“).
   Er lief also über das Exposé-Schema, das aus FÜNF Eurobeträgen (Kaufpreis 165.000, Angebotsmittel vor Abschlag
   180.000, Marktpreisindikation 171.000, Vergleichswert führend 143.550, Ertragswert 83.000) genau EINEN als
   „Kaufpreis“ nimmt, und der Kunde sah nur „Unterlagen 165.000 €“ ohne Herkunft. Jetzt hat ein Bewertungsbericht
   (eigener Marktbericht, Verkehrswertgutachten) ein eigenes Schema: der im Bericht angesetzte Kaufpreis heißt
   „Kaufpreis im Marktbericht“, und die Werte der Verfahren stehen getrennt daneben, nie als Kaufpreis. */
function istWertbericht(text, name, erk) {
  const n = String(name || '').toLowerCase(), t = String(text || '').toLowerCase().slice(0, 8000);
  if (/expos[eé]/.test(n)) return false;
  if (erk && (erk.typ === 'marktbericht' || erk.typ === 'vwg_vorgutachten')) return true;
  if (/(marktbericht|gutachten|wertermittlung|bewertung)/.test(n)) return true;
  const indikation = /(marktwert-indikation|marktpreisindikation|verkehrswert)/.test(t);
  const verfahren = /(spanne der verfahren|f(ü|ue)hrende[sn]? (bewertungs)?verfahren|vergleichswertverfahren|ertragswertverfahren|sachwertverfahren)/.test(t);
  return indikation && verfahren;
}
/* v3940a · Exposé-Merkmal: „Exposé“ im Dateinamen oder am Anfang des Textes, oder ein Verkaufsangebot
   (Kaufpreis + Wohnfläche + Makler-/Provisions- bzw. Angebotsbegriff). Ein reiner Energieausweis, eine
   Mietaufstellung oder ein Protokoll führt keinen Kaufpreis mit Provision. */
function istExpose(text, name) {
  const n = String(name || '').toLowerCase(), t = String(text || '').toLowerCase().slice(0, 6000);
  if (/expos[eé]/.test(n) || /expos[eé]/.test(t.slice(0, 1500))) return true;
  const kp = /kaufpreis/.test(t), wf = /wohnfl(ä|ae)che/.test(t);
  const angebot = /(provision|courtage|makler|käuferprovision|kaeuferprovision|zum verkauf|angebot)/.test(t);
  return kp && wf && angebot;
}

/* ── Abhaengigkeiten ─────────────────────────────────────────────────── */
function _pdfText(buffer) {
  /* pdftotext (poppler-utils, Backend-Image) liest aus STDIN ("-") und schreibt nach STDOUT ("-").
     -l 40: hoechstens 40 Seiten. Nichts beruehrt die Platte. */
  return new Promise(function (ok, nein) {
    let p;
    try { p = spawn('pdftotext', ['-q', '-enc', 'UTF-8', '-l', '40', '-', '-'], { stdio: ['pipe', 'pipe', 'pipe'] }); }
    catch (e) { nein(e); return; }
    const teile = []; let laenge = 0, fehler = '';
    const uhr = setTimeout(function () { try { p.kill('SIGKILL'); } catch (e) {} nein(new Error('pdftotext: Zeitüberschreitung')); }, 30000);
    p.stdout.on('data', function (d) { laenge += d.length; if (laenge <= MAX_TEXT_ZEICHEN * 4) teile.push(d); });
    p.stderr.on('data', function (d) { fehler += d; });
    p.on('error', function (e) { clearTimeout(uhr); nein(e.code === 'ENOENT' ? new Error('pdftotext fehlt im Image') : e); });
    p.on('close', function (code) {
      clearTimeout(uhr);
      if (code !== 0) { nein(new Error('pdftotext RC ' + code + ': ' + String(fehler).slice(0, 120))); return; }
      ok(Buffer.concat(teile).toString('utf8').slice(0, MAX_TEXT_ZEICHEN));
    });
    p.stdin.on('error', function () { /* Prozess beendet, bevor alles geschrieben war */ });
    p.stdin.end(buffer);
  });
}
/* Getter: ein Modul wird erst geladen, wenn es gebraucht wird (der Pruefer ersetzt sie vorher). */
const STANDARD = {
  pdfText: _pdfText,
  /* v3941 · nur ocrAusPuffer (Speicher), nie bildZuText (tmpdir) */
  ocr: function (buffer) { return require('./ocr').ocrAusPuffer(buffer, { maxSeiten: OCR_SEITEN, zeitMs: OCR_ZEIT_MS }); },
  get kiVerbrauch() { return require('./kiVerbrauch'); },
  get schwaerzen() { return require('./schwaerzen'); },
  get dokumentSchemas() { return require('./dokumentSchemas'); },
  get openai() { return require('./openaiService'); },
  query: function (t, p) { return require('../db/pool').query(t, p); },
  stripe: function () { return require('./stripeService').getStripe(); },
  mbFetch: function (url, init) { return fetch(url, init); },
  pdfFetch: function (url, init) { return fetch(url, init); },   /* einzelcheck-2 */
  sendMail: function (o) { return require('./mailerService').sendMail(o); },   /* einzelcheck-2 */
  jetzt: function () { return Date.now(); }
};
let _deps = null;
function deps() { return _deps || STANDARD; }
/** nur fuer tools/einzelcheck-pruefen.mjs */
function _setzeDeps(d) {
  _preisCache = null;
  if (!d) { _deps = null; return; }
  const o = Object.create(STANDARD);
  Object.keys(d).forEach(function (k) { Object.defineProperty(o, k, { value: d[k], enumerable: true }); });
  _deps = o;
}

/* ── Schalter: nur Staging, bis Marcel abnimmt ───────────────────────── */
function istStaging() { return /staging/i.test(process.env.APP_URL || process.env.FRONTEND_URL || ''); }
function aktiv() {
  const s = String(process.env.EINZELCHECK_AKTIV || '');
  if (s === '1') return true;
  if (s === '0') return false;
  return istStaging();
}

/* ── Modelle ─────────────────────────────────────────────────────────── */
/* Kostenlos: gpt-4.1-mini (0,40 $ / 1,60 $ je Mio Token, kiVerbrauch.PREISE_FEST) - kein Denkmodell,
   fuellt ein festes JSON-Schema ohne Denk-Token; gpt-4o-mini waere billiger, ist aber zum 11.12.2026
   abgekuendigt (config.js v1329). Gekauft: das normale Modell der App (config.openai.defaultModel). */
function modellFrei() { return process.env.EINZELCHECK_MODELL_FREI || 'gpt-4.1-mini'; }
function modellVoll() { return process.env.EINZELCHECK_MODELL_VOLL || require('../config').openai.defaultModel; }
function tagesdeckelEur() { const n = Number(process.env.EINZELCHECK_TAGESDECKEL_EUR); return Number.isFinite(n) && n >= 0 ? n : 5; }

/* ── Token, Siegel, Frist ────────────────────────────────────────────── */
function hash(token) { return crypto.createHash('sha256').update(String(token || '')).digest('hex'); }
function neuesToken() { return crypto.randomBytes(32).toString('base64url'); }
function tokenForm(t) { return typeof t === 'string' && /^[A-Za-z0-9_-]{40,60}$/.test(t); }
function _geheim() {
  const g = process.env.EINZELCHECK_SIEGEL || require('../config').auth.jwtSecret || '';
  if (!g) throw new Error('einzelcheck: kein Geheimnis fuer das Siegel (JWT_SECRET)');
  return 'einzelcheck:' + g;
}
function _sortiert(o) { const a = {}; Object.keys(o || {}).sort().forEach(function (k) { a[k] = o[k]; }); return a; }
/* Das Siegel bindet die Zahlen an DIESES Auslesen: beim Kauf schickt der Browser sie zurueck, ohne dass
   der Server sie zwischen Auslesen und Kauf speichern muss. */
function siegel(zahlen) { return crypto.createHmac('sha256', _geheim()).update(JSON.stringify(_sortiert(zahlen))).digest('base64url'); }
function siegelPruefen(zahlen, s) {
  if (typeof s !== 'string' || !s) return false;
  const soll = Buffer.from(siegel(zahlen)), ist = Buffer.from(s);
  return soll.length === ist.length && crypto.timingSafeEqual(soll, ist);
}
function gueltigBis(ab) { return new Date((ab == null ? deps().jetzt() : ab) + FRIST_TAGE * 24 * 3600 * 1000); }
function istGueltig(zeile, jetzt) {
  if (!zeile || !zeile.gueltig_bis) return false;
  return new Date(zeile.gueltig_bis).getTime() > (jetzt == null ? deps().jetzt() : jetzt);
}
/** Bericht nur mit bezahltem, gueltigem Kauf und unter der Laufgrenze. */
function berichtErlaubt(zeile, jetzt) {
  if (!zeile) return { ok: false, code: 'kauf_unbekannt' };
  if (!istGueltig(zeile, jetzt)) return { ok: false, code: 'kauf_abgelaufen' };
  if (zeile.status !== 'bezahlt') return { ok: false, code: 'nicht_bezahlt' };
  if ((Number(zeile.berichte) || 0) >= MAX_BERICHTE) return { ok: false, code: 'berichte_aufgebraucht' };
  return { ok: true };
}

/* ── Dateien pruefen (vor jedem Lesen) ───────────────────────────────── */
function dateiPruefen(d) {
  if (!d || !Buffer.isBuffer(d.buffer)) return 'keine_datei';
  if (d.size > MAX_DATEI_BYTES || d.buffer.length > MAX_DATEI_BYTES) return 'zu_gross';
  if (ERLAUBTE_MIME.indexOf(String(d.mimetype || '')) < 0) return 'kein_pdf';
  if (d.buffer.slice(0, 5).toString('latin1') !== '%PDF-') return 'kein_pdf';
  return null;
}
function dateiname(d) {
  /* multer liefert den Namen als latin1 (routes/dateien.js) - fuer Umlaute zurueck nach UTF-8.
     Der Name dient nur der Erkennung der Art und geht nie in die Datenbank. */
  let n = String((d && d.originalname) || 'Unterlage.pdf');
  try { n = Buffer.from(n, 'latin1').toString('utf8'); } catch (e) {}
  return n.replace(/[^\wÄÖÜäöüß .\-()]/g, '').slice(0, 80) || 'Unterlage.pdf';
}

/* ── Zahlen: die EINE Weissliste ─────────────────────────────────────── */
const ZAHL_GRENZEN = {
  kp: [1000, 1e9], wfl: [5, 1e6], nkm: [0, 1e7], ze: [0, 1e6], gsfl: [1, 1e7], bj: [1500, 2100], zimmer: [0.5, 1000],
  einheiten: [1, 10000], nk_pct: [0, 30], makler_pct: [0, 15], hausgeld_monat: [0, 1e6], bwk_nul_jahr: [0, 1e7],
  ruecklage_zuf_jahr: [0, 1e7], ruecklage_stand: [0, 1e9], sonderumlage_eur: [0, 1e8], sonderumlagen_anzahl: [0, 100],
  endenergie: [0, 1000], bj_heizung: [1900, 2100], leer_einheiten: [0, 10000], nkm_liste: [0, 1e7], wfl_liste: [1, 1e6],
  risiken_hoch: [0, 100], risiken_mittel: [0, 100], unterlagen: [0, VOLL_MAX_UNTERLAGEN],
  /* v3946 · Grundangaben: Miteigentumsanteil (Prozent) und die Finanzierung */
  mea_pct: [0.01, 100], ek_eur: [0, 1e9], zins_pct: [0, 20], tilg_pct: [0, 10], bindung_j: [1, 40],
  /* einzelcheck-3 · aus einem Bewertungsbericht: Wert des führenden Verfahrens und Marktpreisindikation (nur Anzeige) */
  wert_bericht: [1000, 1e9], mpi_bericht: [1000, 1e9]
};
/* v3946 · GRUNDANGABEN des Kaeufers (Formular „Objekt“ und „Finanzierung“). Nur diese Felder, ueber dieselbe
   Weissliste wie die gelesenen Zahlen. Pflicht: GRUND_PFLICHT und PLZ oder Ort. */
const GRUND_FELDER = ['kp', 'nkm', 'wfl', 'art', 'plz', 'ort', 'bj', 'gsfl', 'ze', 'nk_pct', 'mea_pct', 'ek_eur', 'zins_pct', 'tilg_pct', 'bindung_j'];
const GRUND_PFLICHT = ['kp', 'nkm', 'wfl', 'art', 'ek_eur', 'zins_pct', 'tilg_pct', 'bindung_j'];
function grundSauber(g) {
  if (typeof g === 'string') { try { g = JSON.parse(g); } catch (e) { g = null; } }
  const z = zahlenSauber(g), aus = {};
  GRUND_FELDER.forEach(function (k) { if (z[k] != null) aus[k] = z[k]; });
  return aus;
}
/** Welche Pflichtangaben fehlen (leer = vollstaendig). */
function grundFehlt(g) {
  const z = grundSauber(g);
  const f = GRUND_PFLICHT.filter(function (k) { return z[k] == null || (k !== 'ek_eur' && k !== 'zins_pct' && k !== 'art' && !(z[k] > 0)); });
  if (!z.plz && !z.ort) f.push('plz');
  return f;
}
const TEXT_REGELN = {
  plz: /^\d{5}$/,
  ort: /^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .\-()/]{1,59}$/,
  art: /^(ETW|EFH|ZFH|DHH|RH|MFH|GEW)$/,
  ek_klasse: /^(A\+|A|B|C|D|E|F|G|H)$/,
  zustand: /^(neubau|erstbezug|saniert|renoviert|modernisiert|renovierungsbeduerftig)$/,
  wert_verfahren: /^(vergleichswert|ertragswert|sachwert|marktpreisindikation|verkehrswert)$/
};
function _zahl(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s|€|%/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
/** Nur Zahlen aus der Liste oben und fuenf Merkmale nach Regel - alles andere faellt weg (auch Namen). */
function zahlenSauber(z) {
  const aus = {};
  if (!z || typeof z !== 'object') return aus;
  Object.keys(ZAHL_GRENZEN).forEach(function (k) {
    const n = _zahl(z[k]); const g = ZAHL_GRENZEN[k];
    if (n != null && n >= g[0] && n <= g[1]) aus[k] = Math.round(n * 100) / 100;
  });
  Object.keys(TEXT_REGELN).forEach(function (k) {
    if (typeof z[k] === 'string' && TEXT_REGELN[k].test(z[k].trim())) aus[k] = z[k].trim();
  });
  return aus;
}

function _artAus(t) {
  const s = String(t || '').toLowerCase();
  if (/eigentumswohnung|^wohnung|etw/.test(s)) return 'ETW';
  if (/mehrfamilien|mfh/.test(s)) return 'MFH';
  if (/doppelhaus|dhh/.test(s)) return 'DHH';
  if (/reihenhaus/.test(s)) return 'RH';
  if (/zweifamilien/.test(s)) return 'ZFH';
  if (/einfamilien|efh/.test(s)) return 'EFH';
  if (/gewerbe/.test(s)) return 'GEW';
  return null;
}
function _zustandAus(t) {
  const s = String(t || '').toLowerCase().replace('ü', 'ue');
  const m = /(neubau|erstbezug|saniert|renoviert|modernisiert|renovierungsbeduerftig)/.exec(s);
  return m ? m[1] : null;
}
function _summe(liste, feld) {
  return (Array.isArray(liste) ? liste : []).reduce(function (a, x) { const n = _zahl(x && x[feld]); return a + (n > 0 ? n : 0); }, 0);
}

/* einzelcheck-4 · „Musterweg 12, 12345 Musterstadt“ oder „Musterweg 12“ -> „Musterweg 12“. Muss eine Hausnummer
   tragen, sonst kein Vorschlag (kein Ortsname als Strasse). */
function strasseAus(t) {
  if (typeof t !== 'string') return null;
  const s = t.replace(/[\u0000-\u001f]/g, '\n').split(/[,\n]/)[0].replace(/\b\d{5}\b.*$/, '').replace(/\s+/g, ' ').trim();
  if (s.length < 4 || s.length > 80) return null;
  if (!/^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9 .\-\/]*\s\d{1,4}\s?[a-zA-Z]?(\s?[-\/]\s?\d{1,4}[a-zA-Z]?)?$/.test(s)) return null;
  return s;
}

/** Aus den Antworten der Auslese die Zahlen ziehen. Reihenfolge der Quellen: Mietaufstellung vor Exposé
 *  fuer die Miete (Ist statt Angabe im Inserat), Wirtschaftsplan fuer nicht umlagefaehige Kosten. */
function zahlenAus(ergebnisse) { return zahlenUndHerkunft(ergebnisse).zahlen; }
/* einzelcheck-3 · dazu je Feld, aus welcher Unterlage der Wert stammt (Art, nie der Dateiname): die Grundangaben
   zeigen „aus dem Exposé“ / „aus dem Marktbericht“ am Feld, und bei Widerspruch wählt der Käufer. */
function zahlenUndHerkunft(ergebnisse) {
  const z = {}, her = {}; let risHoch = 0, risMittel = 0; let quelle = null;
  /* einzelcheck-4 · Strasse und Hausnummer (Marcel 25.11.2026: „die Strasse und die Hausnummer hat er nicht eingetragen“).
     Nie in die Zahlen (Siegel, Kauf, Speicher), nur als Vorschlag fuer das Feld in der Antwort an den Besucher selbst. */
  let adr = null;
  const strasseVon = function (t, q) { if (adr) return; const s0 = strasseAus(t); if (s0) adr = { strasse: s0, herkunft: q }; };
  const setze = function (k, v) { const n = _zahl(v); if (n != null && z[k] == null) { z[k] = n; if (quelle) her[k] = quelle; } };
  const setzeT = function (k, v) { if (v != null && v !== '' && !z[k]) { z[k] = v; if (quelle) her[k] = quelle; } };
  const liste = (Array.isArray(ergebnisse) ? ergebnisse : []).filter(function (e) { return e && e.ok && e.extracted; });
  const nach = function (typ) { return liste.filter(function (e) { return e.typ === typ; }); };
  nach('mietaufstellung').forEach(function (e) {
    quelle = ART_NAME.mietaufstellung;
    const x = e.extracted, eh = Array.isArray(x.einheiten) ? x.einheiten : [];
    setze('nkm_liste', x.summe_kaltmiete_monat_eur != null ? x.summe_kaltmiete_monat_eur : _summe(eh, 'kaltmiete_eur'));
    setze('wfl_liste', x.summe_wfl_m2 != null ? x.summe_wfl_m2 : _summe(eh, 'wfl_m2'));
    if (eh.length) {
      setze('einheiten', eh.filter(function (u) { return !u || !/stellplatz|garage|keller/.test(String(u.nutzung || '')); }).length || eh.length);
      setze('leer_einheiten', eh.filter(function (u) { return u && !(_zahl(u.kaltmiete_eur) > 0) && !/stellplatz|garage|keller/.test(String(u.nutzung || '')); }).length);
    }
  });
  nach('expose').forEach(function (e) {
    quelle = ART_NAME.expose;
    const x = e.extracted;
    setze('kp', x.kaufpreis); setze('wfl', x.wohnflaeche); setze('nkm', x.nettokaltmiete); setze('gsfl', x.grundstuecksflaeche);
    setze('bj', x.baujahr); setze('zimmer', x.zimmer); setze('einheiten', x.wohneinheiten); setze('nk_pct', x.kaufnebenkosten);
    setze('makler_pct', x.kaeuferprovision_pct); setze('hausgeld_monat', x.hausgeld); setze('endenergie', x.energieverbrauch);
    const ze = (_zahl(x.stellplatz_miete_monat) || 0) + (_zahl(x.kueche_miete_monat) || 0) + (_zahl(x.zusatz_miete_monat) || 0);
    if (ze > 0) setze('ze', ze);
    if (typeof x.plz === 'string') setzeT('plz', x.plz.trim());
    if (typeof x.ort === 'string') setzeT('ort', x.ort.trim());
    strasseVon(x.strasse || x.adresse, ART_NAME.expose);
    setzeT('art', _artAus(x.objektart));
    if (x.energieklasse) setzeT('ek_klasse', String(x.energieklasse).toUpperCase());
    setzeT('zustand', _zustandAus(x.zustand));
  });
  /* einzelcheck-3 · Bewertungsbericht NACH dem Exposé: dessen Kaufpreis ist die Angabe des Verkäufers, der Bericht
     ergänzt nur, was noch fehlt. Die Werte der Verfahren gehen nie in den Kaufpreis. */
  nach('wertbericht').forEach(function (e) {
    quelle = ART_NAME.wertbericht;
    const x = e.extracted;
    setze('kp', x.kaufpreis_im_bericht_eur); setze('wfl', x.wohnflaeche_m2); setze('nkm', x.nettokaltmiete_monat_eur);
    setze('gsfl', x.grundstuecksflaeche_m2); setze('bj', x.baujahr);
    setze('wert_bericht', x.fuehrender_wert_eur); setze('mpi_bericht', x.marktpreisindikation_eur);
    const vf = String(x.fuehrendes_verfahren || '').toLowerCase();
    if (/^(vergleichswert|ertragswert|sachwert|marktpreisindikation|verkehrswert)$/.test(vf)) setzeT('wert_verfahren', vf);
    if (typeof x.plz === 'string') setzeT('plz', x.plz.trim());
    if (typeof x.ort === 'string') setzeT('ort', x.ort.trim());
    strasseVon(x.strasse || x.adresse, ART_NAME.wertbericht);
    setzeT('art', _artAus(x.objektart));
  });
  nach('hausgeld').forEach(function (e) {
    quelle = ART_NAME.hausgeld;
    const ein = e.extracted.einzel || {};
    setze('hausgeld_monat', ein.hausgeld_monat_eur); setze('bwk_nul_jahr', ein.nicht_umlagefaehig_jahr_eur);
    setze('ruecklage_zuf_jahr', ein.ruecklage_zufuehrung_jahr_eur); setze('ruecklage_stand', e.extracted.ruecklage_stand_eur);
  });
  nach('weg_protokoll').forEach(function (e) {
    quelle = ART_NAME.weg_protokoll;
    const x = e.extracted;
    setze('ruecklage_stand', x.ruecklage_stand_eur != null ? x.ruecklage_stand_eur : x.instandhaltungsruecklage_eur);
    const su = (Array.isArray(x.sonderumlagen_geplant) ? x.sonderumlagen_geplant : []).filter(function (s) { return s && s.status === 'beschlossen'; });
    if (su.length) { setze('sonderumlagen_anzahl', su.length); setze('sonderumlage_eur', _summe(su, 'betrag_einheit_eur') || null); }
  });
  nach('energieausweis').forEach(function (e) {
    quelle = ART_NAME.energieausweis;
    const x = e.extracted;
    if (x.energieeffizienzklasse) setzeT('ek_klasse', String(x.energieeffizienzklasse).toUpperCase().replace(/\s/g, ''));
    setze('endenergie', x.endenergie_kwh_m2a); setze('bj', x.baujahr_gebaeude); setze('bj_heizung', x.baujahr_waermeerzeuger);
    setze('einheiten', x.anzahl_wohnungen);
  });
  liste.forEach(function (e) {
    (Array.isArray(e.extracted.risiken) ? e.extracted.risiken : []).forEach(function (r) {
      if (r && r.schwere === 'hoch') risHoch++; else if (r && r.schwere === 'mittel') risMittel++;
    });
  });
  /* Die Ist-Miete der Mietaufstellung schlaegt die Angabe im Exposé */
  if (z.nkm_liste > 0) { z.nkm = z.nkm_liste; her.nkm = ART_NAME.mietaufstellung; }
  if (!(z.wfl > 0) && z.wfl_liste > 0) { z.wfl = z.wfl_liste; her.wfl = ART_NAME.mietaufstellung; }
  if (risHoch) z.risiken_hoch = risHoch;
  if (risMittel) z.risiken_mittel = risMittel;
  z.unterlagen = liste.length;
  const zahlen = zahlenSauber(z), herkunft = {};
  Object.keys(her).forEach(function (k) { if (zahlen[k] != null) herkunft[k] = her[k]; });
  return { zahlen: zahlen, herkunft: herkunft, adresse: adr };
}

/* Was der Bericht aus einer Unterlage zeigen darf: Art, ob gelesen, Risiken als kurze Saetze.
   Texte laufen noch einmal durch schwaerzen.js (die KI sah nur geschwaerzten Text, aber sicher ist sicher)
   und werden gekuerzt. Nichts davon wird gespeichert. */
function _kurz(t, n) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, n); }
function anzeigeAus(e) {
  const sw = deps().schwaerzen;
  const s = function (t, n) { return _kurz(sw.schwaerze(_kurz(t, 400)).text, n); };
  const aus = { name: e.name, art: ART_NAME[e.typ] || 'Unterlage', typ: e.typ || null, gelesen: !!e.ok, grund: e.ok ? null : (e.grund || 'nicht_lesbar'),
    geschwaerzt: e.geschwaerzt || 0, risiken: [], kernpunkte: [],
    /* v3941 · per Texterkennung gelesen (gescannt): Seiten, schwer lesbar, nach 6 Seiten oder der Frist gekuerzt */
    texterkennung: e.ocr ? { seiten: e.ocr.seiten, schwer_lesbar: !e.ocr.lesbar, gekuerzt: !!e.ocr.abgeschnitten } : null };
  if (e.ok && e.extracted) {
    (Array.isArray(e.extracted.risiken) ? e.extracted.risiken : []).slice(0, 6).forEach(function (r) {
      if (r && r.titel) aus.risiken.push({ titel: s(r.titel, 90), beschreibung: s(r.beschreibung, 260), schwere: /^(hoch|mittel|niedrig)$/.test(r.schwere) ? r.schwere : 'mittel' });
    });
    (Array.isArray(e.extracted.kernpunkte) ? e.extracted.kernpunkte : []).slice(0, 5).forEach(function (k) { aus.kernpunkte.push(s(k, 220)); });
  }
  return aus;
}

/* ── Eine Unterlage lesen ────────────────────────────────────────────── */
async function leseEine(datei, modell) {
  const d = deps();
  const name = dateiname(datei);
  const fehler = dateiPruefen(datei);
  if (fehler) return { name, ok: false, grund: fehler };
  let roh;
  try { roh = await d.pdfText(datei.buffer); } catch (e) { return { name, ok: false, grund: 'nicht_lesbar' }; }
  /* v3941 · gescannt, ohne Textebene: Texterkennung im Speicher. Zaehlt wie jede andere Unterlage. */
  let ocr = null;
  if (!roh || roh.replace(/\s+/g, '').length < 80) {
    try { ocr = await d.ocr(datei.buffer); } catch (e) { ocr = null; }
    if (!ocr || !ocr.roh || ocr.roh.replace(/\s+/g, '').length < 80) return { name, ok: false, grund: 'kein_text' };
    roh = ocr.roh;
    ocr = { seiten: ocr.seiten || 0, lesbar: !!ocr.lesbar, abgeschnitten: !!ocr.abgeschnitten };
  }
  /* 2 · ERST schwaerzen, DANN klassifizieren und an die KI */
  const sw = d.schwaerzen.schwaerze(roh);
  const text = sw.text;
  roh = null;
  const erk = d.dokumentSchemas.klassifiziere(text, name) || {};
  if (erk.typ === 'mieter_unterlagen') return { name, ok: false, grund: 'mieter_unterlagen', geschwaerzt: sw.gesamt, ocr: ocr };
  /* v3940a · gemessen auf Staging 20.11.2026: das Muster-Exposé Lindenallee 14 kam als „Energieausweis“
     zurück (Kaufpreis, Wohnfläche, Miete fehlten). DOKUMENT_TYPEN kennt kein Exposé, und ein Exposé
     führt fast immer einen Abschnitt zum Energieausweis. In der App wählt der Nutzer das Exposé
     ausdrücklich, hier entscheidet nur die Erkennung - deshalb gewinnt ein Exposé-Merkmal. */
  const typ = istWertbericht(text, name, erk) ? 'wertbericht'
    : istExpose(text, name) ? 'expose' : (DOKUMENT_ARTEN.indexOf(erk.typ) >= 0 ? erk.typ : 'expose');
  let r;
  try {
    r = typ === 'expose'
      ? await d.openai.extractExpose(text, { model: modell })
      : await d.openai.extractDokument(text, typ, { model: modell });
  } catch (e) {
    if (e && e.code === 'NO_API_KEY') throw e;
    return { name, typ, ok: false, grund: 'ki_fehler', geschwaerzt: sw.gesamt, ocr: ocr };
  }
  if (!r || !r.success) return { name, typ, ok: false, grund: 'ki_unlesbar', geschwaerzt: sw.gesamt, ocr: ocr };
  return { name, typ, ok: true, extracted: r.extracted || {}, modell: r.model || modell, geschwaerzt: sw.gesamt, ocr: ocr };
}

/** Mehrere Unterlagen lesen. modus 'frei': hoechstens FREI_MAX_UNTERLAGEN, guenstiges Modell.
 *  Die uebrigen Dateien werden NICHT angefasst (kein pdftotext, kein KI-Aufruf). */
async function auslesen(dateien, modus) {
  const voll = modus === 'voll';
  const max = voll ? VOLL_MAX_UNTERLAGEN : FREI_MAX_UNTERLAGEN;
  const modell = voll ? modellVoll() : modellFrei();
  const alle = Array.isArray(dateien) ? dateien.slice(0, VOLL_MAX_UNTERLAGEN) : [];
  const zuLesen = alle.slice(0, max);
  const ergebnisse = [];
  for (const f of zuLesen) ergebnisse.push(await leseEine(f, modell));
  const zh = zahlenUndHerkunft(ergebnisse), zahlen = zh.zahlen;
  const out = {
    modus: voll ? 'voll' : 'frei', modell: modell,
    zahlen: zahlen,
    /* einzelcheck-4 · nur im FREIEN Lauf, nur zurueck an den Besucher, der die Unterlage selbst hochgeladen hat (Vorschlag
       fuers Feld). Nie gespeichert, nie im Zahlenstand. Im gekauften Lauf bleibt sie wie bisher nicht aufzaehlbar (_adresse). */
    adresse_vorschlag: voll ? undefined : zh.adresse,
    herkunft: zh.herkunft,   /* einzelcheck-3 · Feld -> Art der Unterlage, nur zur Anzeige (nicht im Siegel, nicht gespeichert) */
    unterlagen: ergebnisse.map(anzeigeAus),
    nicht_gelesen: alle.slice(max).map(function (f) { return { name: dateiname(f), grund: 'im_bericht' }; })
  };
  /* Die Anschrift nur im gekauften Lauf und nur fuer den Marktbericht-Dienst: nicht aufzaehlbar,
     damit sie in keiner JSON-Antwort und in keinem Speicherweg landet. */
  if (voll) Object.defineProperty(out, '_adresse', { value: adresseAus(ergebnisse) || (zh.adresse ? [zh.adresse.strasse, [zahlen.plz, zahlen.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') : null), enumerable: false });
  return out;
}

/* ── Tagesdeckel fuer den kostenlosen Teil (alle Besucher zusammen) ───── */
async function tagesverbrauchEur() {
  const r = await deps().query(
    "SELECT COALESCE(SUM(eur),0) AS eur FROM ki_verbrauch WHERE endpunkt = 'public/einzelcheck/auslesen'" +
    " AND ts >= (date_trunc('day', now() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')", []);
  return Number((r.rows[0] || {}).eur) || 0;
}
async function freiMoeglich() {
  try { const v = await tagesverbrauchEur(); return { ok: v < tagesdeckelEur(), verbraucht_eur: v, deckel_eur: tagesdeckelEur() }; }
  catch (e) { return { ok: true, verbraucht_eur: null, deckel_eur: tagesdeckelEur() }; }   /* DB weg: wie kiVerbrauch fail-soft */
}

/* ── Preis aus Stripe (lookup_key), nie aus dem Code ─────────────────── */
let _preisCache = null;
async function preis(force) {
  if (!force && _preisCache && (deps().jetzt() - _preisCache.t) < 10 * 60 * 1000) return _preisCache.p;
  const stripe = deps().stripe();
  const res = await stripe.prices.list({ lookup_keys: [LOOKUP_KEY], active: true, limit: 1, expand: ['data.product'] });
  const p = (res && res.data && res.data[0]) || null;
  if (!p || !(p.unit_amount > 0) || p.type !== 'one_time') {
    const e = new Error('Preis ' + LOOKUP_KEY + ' fehlt oder ist kein Einmalpreis'); e.code = 'preis_fehlt'; throw e;
  }
  const out = { price_id: p.id, amount_cents: p.unit_amount, currency: p.currency, lookup_key: p.lookup_key,
    produkt: (p.product && typeof p.product === 'object' && p.product.name) || 'Einzel-Check' };
  _preisCache = { t: deps().jetzt(), p: out };
  return out;
}

/* ── Kauf anlegen, Checkout ──────────────────────────────────────────── */
function landingBasis() {
  if (process.env.LANDING_URL) return String(process.env.LANDING_URL).replace(/\/+$/, '');
  const app = String(process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.dealpilot.immo').replace(/\/+$/, '');
  return app.replace(/^(https?:\/\/)app\./i, '$1');
}
async function kaufAnlegen({ zahlen, siegelWert, grund }) {
  const d = deps();
  const gelesen = zahlenSauber(zahlen);
  /* Ohne Zahlen (kostenloses Auslesen ging schief) gibt es nichts zu besiegeln - der Bericht liest dann alles neu */
  if (Object.keys(gelesen).length && !siegelPruefen(gelesen, siegelWert)) {
    const e = new Error('Die Daten stammen nicht aus diesem Auslesen. Bitte noch einmal auslesen.'); e.code = 'siegel'; e.status = 400; throw e;
  }
  /* v3946 · Grundangaben sind Pflicht (Marcel 22.11.2026). Das Siegel bindet nur die GELESENEN Zahlen,
     die Grundangaben sind Angaben des Kaeufers und kommen danach dazu. */
  const fehlt = grundFehlt(grund);
  if (fehlt.length) {
    const e = new Error('Bitte zuerst die Grundangaben zu Objekt und Finanzierung eintragen.'); e.code = 'grundangaben'; e.status = 400; e.fehlt = fehlt; throw e;
  }
  const z = Object.assign({}, gelesen, grundSauber(grund));
  const p = await preis(false);
  const token = neuesToken();
  const jetzt = d.jetzt();
  const bis = gueltigBis(jetzt);
  const ins = await d.query(
    'INSERT INTO einzelcheck_kaeufe (token_hash, status, zahlen, amount_cents, currency, erstellt_am, gueltig_bis)' +
    " VALUES ($1, 'offen', $2, $3, $4, $5, $6) RETURNING id",
    [hash(token), JSON.stringify(z), p.amount_cents, p.currency, new Date(jetzt), bis]);
  const kaufId = ins.rows[0].id;
  const basis = landingBasis();
  const meta = { type: 'einzelcheck', kauf_id: String(kaufId), lookup_key: LOOKUP_KEY };
  const session = await d.stripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: p.price_id, quantity: 1 }],
    /* wie die Einzelkaeufe (credits.js v2248): Rechnung statt Beleg, Anschrift als Pflichtangabe */
    billing_address_collection: 'required',
    invoice_creation: { enabled: true, invoice_data: { metadata: { einzelcheck: String(kaufId) } } },
    automatic_tax: { enabled: false },   /* Kleinunternehmer § 19 UStG */
    client_reference_id: String(kaufId),
    metadata: meta,
    payment_intent_data: { metadata: meta },
    /* Das Token steht im FRAGMENT - es geht an keinen Server, auch nicht an Stripe zurueck */
    success_url: basis + '/?einzelcheck=bezahlt#ec=' + token,
    cancel_url: basis + '/?einzelcheck=abbruch#ec=' + token,
    expires_at: Math.floor(jetzt / 1000) + 60 * 60,
    locale: 'de'
  });
  await d.query('UPDATE einzelcheck_kaeufe SET stripe_session_id = $1 WHERE id = $2', [session.id, kaufId]);
  return { token, url: session.url, kauf_id: kaufId, gueltig_bis: bis.toISOString(), amount_cents: p.amount_cents, currency: p.currency };
}

async function kaufLesen(token) {
  if (!tokenForm(token)) return null;
  const r = await deps().query('SELECT * FROM einzelcheck_kaeufe WHERE token_hash = $1', [hash(token)]);
  return r.rows[0] || null;
}

/* Fuer Browser und Erfolgsseite: was der Kauf kann. Zahlen nur, solange gueltig. */
function statusAus(z, jetzt) {
  if (!z) return { status: 'unbekannt' };
  const g = istGueltig(z, jetzt);
  return {
    status: g ? z.status : 'abgelaufen', bezahlt: z.status === 'bezahlt' && g, gueltig_bis: z.gueltig_bis,
    berichte_rest: Math.max(0, MAX_BERICHTE - (Number(z.berichte) || 0)),
    mails_rest: Math.max(0, MAX_MAILS - (Number(z.mails) || 0)),   /* einzelcheck-2 */
    anrechnung: (z.status === 'bezahlt' && g && z.anrechnung_code) ? { code: z.anrechnung_code, cents: z.amount_cents, bis: z.gueltig_bis } : null,
    zahlen: g ? zahlenSauber(z.zahlen || {}) : null
  };
}

async function berichtGezaehlt(id, zahlen) {
  await deps().query('UPDATE einzelcheck_kaeufe SET berichte = berichte + 1, zahlen = $2 WHERE id = $1', [id, JSON.stringify(zahlenSauber(zahlen))]);
}

/* ── Webhook: checkout.session.completed mit metadata.type = 'einzelcheck' ──
   Muster bewertungWebhook.js: nur bezahlt, Menge/Preis aus den LINE ITEMS (der Preis in Stripe ist die
   Quelle), Anspruch atomar und nur einmal. Ein fremder Preis schaltet nichts frei. */
async function handleEinzelcheckPaid(session) {
  const d = deps();
  if (!session || session.mode !== 'payment') return { ok: false, reason: 'not_payment_mode' };
  if (!session.metadata || session.metadata.type !== 'einzelcheck') return { ok: false, reason: 'not_einzelcheck' };
  if (session.payment_status && session.payment_status !== 'paid') return { ok: false, reason: 'nicht_bezahlt:' + session.payment_status };
  const stripe = d.stripe();
  const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10, expand: ['data.price'] });
  const passt = (items.data || []).some(function (it) { return it && it.price && it.price.lookup_key === LOOKUP_KEY; });
  if (!passt) { console.error('[einzelcheck-webhook] Sitzung ohne Preis ' + LOOKUP_KEY + ':', session.id); return { ok: false, reason: 'fremder_preis' }; }

  const claim = await d.query(
    "UPDATE einzelcheck_kaeufe SET status = 'bezahlt', bezahlt_am = now(), stripe_payment_intent = COALESCE($1, stripe_payment_intent)" +
    " WHERE stripe_session_id = $2 AND status = 'offen' AND gueltig_bis > now() RETURNING id, gueltig_bis, amount_cents",
    [session.payment_intent || null, session.id]);
  if (!claim.rowCount) {
    const da = await d.query('SELECT status FROM einzelcheck_kaeufe WHERE stripe_session_id = $1', [session.id]);
    if (da.rowCount && da.rows[0].status === 'bezahlt') return { ok: true, reason: 'already_processed' };
    console.error('[einzelcheck-webhook] kein offener Kauf zur Sitzung (abgelaufen oder geloescht):', session.id);
    return { ok: false, reason: 'kein_kauf' };
  }
  const k = claim.rows[0];
  /* Anrechnung: ein eigener Promotion-Code je Kauf auf den festen Coupon, einmal einloesbar, laeuft mit
     der Frist ab. Fehlt der Coupon im Konto, bleibt der Kauf gueltig - nur ohne Anrechnung (gemeldet). */
  let code = null;
  try {
    code = 'EC' + crypto.randomBytes(5).toString('hex').toUpperCase();
    const pc = await stripe.promotionCodes.create({
      coupon: ANRECHNUNG_COUPON, code: code, max_redemptions: 1,
      expires_at: Math.floor(new Date(k.gueltig_bis).getTime() / 1000),
      metadata: { dp_kind: 'einzelcheck_anrechnung', kauf_id: String(k.id) }
    });
    await d.query('UPDATE einzelcheck_kaeufe SET anrechnung_code = $1, anrechnung_promo_id = $2 WHERE id = $3', [code, pc.id, k.id]);
  } catch (e) {
    code = null;
    console.warn('[einzelcheck-webhook] Anrechnung nicht angelegt (Coupon ' + ANRECHNUNG_COUPON + ' vorhanden?):', e.message);
  }
  console.log('[einzelcheck-webhook] bezahlt ' + k.id + (code ? ' · Anrechnung ' + code : ' · ohne Anrechnung'));
  return { ok: true, kauf_id: k.id, anrechnung: !!code };
}

/* ── Marktbericht-Dienst: Lage, Markt, Angebotsindikation (Stufe 2) ──
   Ohne Ablage (mb /reports/einzelcheck -> ReportOrchestrator.generate(…, { ohneAblage: true })).

   v3941 · STUFE 2 wie in der App (frontend/js/dealpilot-mb.js run(): wert_stufe 2 OHNE fast), also mit
   KI-Text, Preishistorie und Marktkontext. Der Orchestrator verwirft unter Stufe 3 den Quercheck
   (cross_check -> { available:false, nicht_im_umfang:true }, ReportOrchestrator „_stufe < 3“) - Boden-,
   Ertrags- und Sachwert, Liegenschaftszins und die ortsuebliche Vergleichsmiete (miete_stufe /
   miete_vergleich_qm stecken im Ertragswert) kommen damit NICHT mehr. marktAus() liest cross_check
   deshalb gar nicht mehr, auch wenn es da waere.
   v3944 · Die Vergleichsmiete liefert der mb-Dienst als eigenes Feld out.vergleichsmiete (Auszug VOR der
   Sperre, dieselbe Zahl wie Stufe 3). Uebernommen nur ueber die Weissliste vglAus(): Zahl, Art (mietspiegel,
   amtlich, naeherung), Spanne, Einordnung. Kein Quellenname, kein Dokumenttitel.

   FELDZUORDNUNG Stufe 2 (Payload data.*) -> Bericht:
     micro.score                               -> lage.mikro
     macro.score                               -> lage.makro
     address.city / address.postcode           -> lage.ort / lage.plz
     ref.ags                                   -> lage.ags (Kappung, Mietpreisbremse im Browser)
     bevoelkerung_trend_pct                    -> lage.bevoelkerung_trend_pct
     days_on_market                            -> lage.angebotsdauer_tage
     valuation.market_value.estimated/low/high -> markt.wert / wert_von / wert_bis (Erweiterte Marktpreisindikation)
     valuation.market_value.basis_median_sqm   -> markt.qm
     valuation.market_value.angebot_abschlag   -> markt.abschlag {pct, vor_abschlag, herkunft} (Kennzeichnung wie app.js _mpZusatz)
     valuation.inputs.market_rent_sqm          -> markt.miete_qm (Angebotsmieten, Neuvermietung)
     valuation.yield.gross_yield_pct           -> markt.brutto_pct
     price_trend_pct / rent_trend_pct          -> markt.preis_trend_pct / miete_trend_pct
     wertermittlungsstichtag.datum             -> stichtag
     report_md (nur ai_mode 'openai')          -> text (Absaetze, ohne Quellennamen, ohne Wertermittlungssaetze)
     cost.openai_posten                        -> ki_verbrauch (public/einzelcheck/bericht), nicht im Ergebnis
   Nicht uebernommen: cross_check (Stufe 3), wertermittlung_herkunft, land_value, zensus, datenquellen.

   KOSTEN je Bericht (Stufe 2 voll): Marktdaten im Mittel bis 0,38 EUR je Lauf (gemessen 11.09.2026 an 45
   Laeufen der Erweiterten MPI, viele 0 EUR wegen Cache), KI-Text gpt-4.1-mini (split-call, Zehntel-Cent bis
   wenige Cent) - seit v3941 je Lauf in ki_verbrauch erfasst und im Protokoll als Zeile. */
const MB_BASE = (process.env.MB_BACKEND_URL || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');
/* v3946 · dazu die amtlichen Portal- und Datenbanknamen (Marcel: „keine Datenquelle namentlich“) */
const _QUELLEN_NAMEN = /immo\s*scout|immobilienscout|scout24|immowelt|kleinanzeigen|geomap|pricehubble|sprengnetter|on-geo|21st|geoapify|overpass|openstreetmap|boris|bundesbank|zensus|regionaldatenbank|regionalstatistik|destatis|genesis/i;
function _ohneQuelle(t) { return (typeof t === 'string' && !_QUELLEN_NAMEN.test(t)) ? t : null; }
function _n(v) { const n = Number(v); return (v === null || v === undefined || v === '' || !Number.isFinite(n)) ? null : n; }
/* Herkunft des Abschlags wie die Marktbericht-App (_mpZusatz), nach aussen nur feste Woerter */
function _abschlagAus(ab) {
  if (!ab || !(_n(ab.pct) > 0)) return null;
  const h = String(ab.herkunft || '');
  const herkunft = /rtlich/.test(h) ? 'aus den Kauffällen des Gutachterausschusses'
    : ((/^DealPilot-Marktdurchschnitt/.test(h) && _ohneQuelle(h)) ? _satzzeichen(h).slice(0, 120) : 'Marktdurchschnitt');
  return { pct: _n(ab.pct), vor_abschlag: (ab.roh && _n(ab.roh.estimated) > 0) ? _n(ab.roh.estimated) : null, herkunft: herkunft };
}
/* KI-Text der Stufe 2 als Absaetze: nur Punkt und Komma, keine Quellennamen, keine Saetze zur
   Wertermittlung (die gehoert in die App). Kein HTML, kein Markdown nach aussen. */
const _WERT_WORTE = /ertragswert|sachwert|bodenwert|liegenschaftszins|verkehrswert|immowertv|restnutzungsdauer/i;
function _satzzeichen(t) {
  return String(t).replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 bis $2').replace(/\s*[;–—]\s*/g, ', ').replace(/\s+-\s+/g, ', ')
    .replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').replace(/,\s*\./g, '.').trim();
}
/* v3946 · Kapitel des KI-Texts heissen wie im Marktbericht-PDF (frontend/marktbericht-app/app.js PDF_SECTION_TITLES),
   ohne Buchstaben davor. Marcel 22.11.2026: „nichts davor mit A, B und C. Da kommt eine Überschrift hin, eine vernünftige.“ */
const KAPITEL = { A: 'Zusammenfassung und Empfehlung', B: 'Objekt, Lage und Markt', C: 'Bewertung, Rendite und Ausblick', D: 'Entwicklung, Ableitung und Prognose' };
function ueberschrift(t) {
  const m = /^([A-P])\s*[).:·]\s*(.*)$/.exec(String(t || '').trim());
  let s = m ? (KAPITEL[m[1]] || m[2]) : String(t || '').trim();
  s = s.replace(/^[A-Z]\d?\s*[).:·]\s+/, '').replace(/^(Kapitel|Abschnitt|Teil)\s+[A-Z0-9]+\s*[).:·]?\s*/i, '');
  return s.replace(/\s*&\s*/g, ' und ').trim();
}
/** mitWert: Stufe 3 mit genauer Lage - Saetze zur Wertermittlung bleiben (die Zahlen stehen im Bericht daneben). */
function textAus(md, mitWert) {
  if (typeof md !== 'string' || !md.trim()) return [];
  const aus = []; let zeichen = 0;
  md.replace(/\r/g, '').split('\n').forEach(function (z) {
    let t = z.trim();
    if (!t || /^[-*_]{3,}$/.test(t) || /^\|/.test(t) || zeichen > 9000 || aus.length >= 60) return;
    let art = 'p';
    if (/^#{1,6}\s/.test(t)) { art = 'h'; t = t.replace(/^#{1,6}\s+/, ''); }
    else if (/^([-*•]|\d+[.)])\s+/.test(t)) { art = 'li'; t = t.replace(/^([-*•]|\d+[.)])\s+/, ''); }
    t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '')
      .replace(/[*_`>]+/g, '').replace(/<[^>]*>/g, '');
    if (art === 'h') t = ueberschrift(t);
    t = _satzzeichen(t);
    if (t.length < 2 || !_ohneQuelle(t) || (!mitWert && _WERT_WORTE.test(t))) return;
    aus.push({ art: art, text: _satzKurz(t, 1600) }); zeichen += t.length;   /* einzelcheck-6 · nie mitten im Wort (Herford: „Grundstücksmerkma“) */
  });
  /* keine Ueberschrift ohne Inhalt: eine Ueberschrift direkt vor einer anderen oder am Ende faellt weg */
  return aus.filter(function (x, i) { return x.art !== 'h' || (aus[i + 1] && aus[i + 1].art !== 'h'); });
}
/* einzelcheck-6 · Kürzen am Satzende: bis zur Grenze den letzten ganzen Satz behalten, gibt es keinen, am letzten
   Wort mit „…“. Vorher schnitt slice() mitten im Wort, Marcel sah im Herford-Bericht „Grundstücksmerkma“ und „Die Mar“. */
function _satzKurz(t, n, streng) {
  const s = String(t == null ? '' : t);
  if (s.length <= n) return s;
  const teil = s.slice(0, n);
  const ende = Math.max(teil.lastIndexOf('. '), teil.lastIndexOf('! '), teil.lastIndexOf('? '));
  if (ende > n * 0.4) return teil.slice(0, ende + 1);
  /* hh4 (25.11.2026) · Stichpunkt ohne ganzen Satz fällt weg (MFH Herford: „… nicht für Mehrfamilienhäuser („Bei den …“) */
  if (streng) return ende > 20 ? teil.slice(0, ende + 1) : null;
  return teil.slice(0, n - 1).replace(/\s+\S*$/, '') + ' …';
}
/* v3944 · Vergleichsmiete aus dem mb-Auszug, nur feste Felder. Kein Treffer heisst kein Wert. */
const VGL_ARTEN = ['mietspiegel', 'amtlich', 'naeherung'];
function vglAus(v) {
  if (!v || v.verfuegbar !== true || VGL_ARTEN.indexOf(v.art) < 0) return null;
  const qm = _n(v.qm);
  if (!(qm > 0 && qm < 60)) return null;
  const s = function (x) { const n = _n(x); return n > 0 && n < 60 ? n : null; };
  return { qm: qm, art: v.art, ca: v.art === 'naeherung', unten: s(v.unten), mittel: s(v.mittel), oben: s(v.oben),
    einordnung: /^(oben|mittel|unten)$/.test(String(v.einordnung || '')) ? v.einordnung : null,
    /* einzelcheck-9 · Obergrenzen wie die App (mb lib/mietanker.js zielMaximum ueber zielAusAuszug), nur Zahlen */
    ziel: zielAus(v.ziel) };
}
function zielAus(z) {
  if (!z || typeof z !== 'object') return null;
  const s = function (x) { const n = _n(x); return n > 0 && n < 60 ? n : null; };
  const b = s(z.bestand_max_qm), nm = s(z.neu_max_qm);
  if (!b || !nm) return null;
  const f = _n(z.faktor);
  return { bestand_max_qm: b, neu_max_qm: nm, neu_sicher_qm: s(z.neu_sicher_qm), mittel_qm: s(z.mittel_qm),
    faktor: (f > 1 && f <= 1.2) ? f : null, bremse_gilt: z.bremse_gilt === true ? true : (z.bremse_gilt === false ? false : null),
    neubau: z.neubau === true, ca: z.ca === true, bedingung: z.bedingung === true };
}
function marktAus(out) {
  const p = (out && out.data) || {};
  const v = p.valuation || {}, mv = v.market_value || {};
  const st = p.wertermittlungsstichtag;
  const stichtag = (st && typeof st === 'object' && typeof st.datum === 'string') ? st.datum.slice(0, 10) : (typeof st === 'string' ? st.slice(0, 10) : null);
  const wert = wertAus(out);
  return {
    stufe: MB_STUFE,
    lage: { mikro: _n(p.micro && p.micro.score), makro: _n(p.macro && p.macro.score),
      ort: _ohneQuelle(p.address && p.address.city) || null, plz: (p.address && /^\d{5}$/.test(String(p.address.postcode || ''))) ? String(p.address.postcode) : null,
      ags: (p.ref && /^\d{8}$/.test(String(p.ref.ags || ''))) ? String(p.ref.ags) : null,   /* Gemeindeschluessel fuer Kappung/Bremse */
      bevoelkerung_trend_pct: _n(p.bevoelkerung_trend_pct), angebotsdauer_tage: _n(p.days_on_market) },
    markt: { bezeichnung: 'Erweiterte Marktpreisindikation', wert: _n(mv.estimated), wert_von: _n(mv.low), wert_bis: _n(mv.high), qm: _n(mv.basis_median_sqm),
      abschlag: _abschlagAus(mv.angebot_abschlag),
      miete_qm: _n(v.inputs && v.inputs.market_rent_sqm), brutto_pct: _n(v.yield && v.yield.gross_yield_pct),
      preis_trend_pct: _n(p.price_trend_pct), miete_trend_pct: _n(p.rent_trend_pct) },
    /* v3944 · Vergleichsmiete aus dem Auszug des mb-Dienstes (nie aus cross_check), sonst null */
    vergleichsmiete: vglAus(out && out.vergleichsmiete),
    /* v3946 · Stufe 3: Bodenrichtwert und Verfahren ueber die Weissliste wertAus() */
    wert: wert,
    text: (out && out.ai_mode === 'openai') ? textAus(out.report_md, wert.verfuegbar === true) : [],
    stichtag: stichtag
  };
}

/* ── v3946 · WERTERMITTLUNG (Stufe 3) FUER DEN KUNDEN ──────────────────────────────────────────────────
   Nur feste Felder aus dem Quercheck (cross_check) und dem Bodenrichtwert (land_value). Regeln aus CLAUDE.md:
     - jede Zahl traegt ihre Herkunft (Stufe A bis E, M, N, Lizenzvermerk), alles indikativ
     - kein Verfahren rechnet halb: nicht ausgewiesen heisst KEINE Zahl, dafuer der Grund und der Weg
     - die Wertindikation ist der Wert des FUEHRENDEN Verfahrens (§ 6 Abs. 1 ImmoWertV). Ein Sachwert ohne
       Sachwertfaktor des Gutachterausschusses ist kein Marktwert und traegt keine Wertindikation.
     - ohne Anschrift (Strasse) steht der Bodenrichtwert einer Zone am Mittelpunkt der PLZ, nicht der des Objekts:
       dann kein Bodenrichtwert und kein Verfahren, das ihn braucht (kein Treffer heisst kein Wert).
   Texte laufen durch _kunde(): ohne Links, ohne Portal- und Datenbanknamen, nur Punkt und Komma. */
const VERFAHREN_NAME = { ertragswert: 'Ertragswertverfahren', sachwert: 'Sachwertverfahren', vergleichswert: 'Vergleichswertverfahren' };
const STUFE_TEXT = {
  /* wie KiGegenrechnungService (Liegenschaftszins) und CLAUDE.md „Jede Zahl trägt Herkunft“ */
  A: 'amtlich', B: 'amtlich, große Streuung oder regional', C: 'indikativ',
  D: 'gesetzlicher Auffangwert § 256 BewG', E: 'eigene Angabe', M: 'indikativ, aus Angebotspreisen abgeleitet', N: 'abgeleitet aus der DealPilot-Formel, nicht amtlich'
};
function _kunde(t, n, streng) {
  if (typeof t !== 'string' || !t.trim()) return null;
  let s = t.replace(/https?:\/\/\S+/g, '').replace(/\bwww\.[\w.\/-]+/gi, '').replace(/\bBORIS[\w-]*/g, '')
    .replace(/\(\s*[,;]?\s*\)/g, '').replace(/,\s*\)/g, ')').replace(/\(\s*,\s*/g, '(').replace(/\(\s*\)/g, '');
  /* Lizenzkennungen (dl-de/by-2-0) sind keine Spannen: vor den Satzzeichen schuetzen */
  s = s.replace(/dl-de\/(by|zero)-2-0/gi, 'DLDE_$1_20');
  s = _satzzeichen(s).replace(/\s+([,.)])/g, '$1').replace(/\s{2,}/g, ' ').trim().replace(/DLDE_(by|zero)_20/gi, 'dl-de/$1-2-0');
  if (!s || !_ohneQuelle(s)) return null;
  return _satzKurz(s, n || 400, streng);   /* einzelcheck-6 · am Satzende kürzen, nicht mitten im Satz („rechnet der Bericht …“) */
}
function _stufe(x) { const s = String(x || '').trim().toUpperCase(); return /^[A-EMN]$/.test(s) ? s : null; }
function _jahr(x) { const n = _n(x); return n > 0 ? Math.round(n * 10) / 10 : null; }
/* hh4 (Marcel 25.11.2026: „Die Rechnung fehlt noch im PDF, wenn es Ertragswert oder Sachwert ist.“) · Rechenweg wie im
   Marktbericht: die Staffel des Kerns (ErtragswertService / nhk2010) unverändert durchgereicht, nichts neu gerechnet.
   Eine Zeile ohne Betrag und ohne Faktor fällt weg, statt etwas zu erfinden. */
function _rechenweg(staffel) {
  if (!Array.isArray(staffel)) return null;
  const z = staffel.map(function (x) {
    if (!x || typeof x.pos !== 'string') return null;
    const wert = _n(x.wert), faktor = _n(x.faktor);
    if (wert == null && faktor == null) return null;
    return { pos: _kunde(x.pos, 140), detail: _kunde(x.detail, 140), wert: wert == null ? null : Math.round(wert), faktor: faktor, summe: !!x.summe };
  }).filter(function (x) { return x && x.pos; });
  return z.length >= 3 ? z.slice(0, 28) : null;
}
function wertAus(out) {
  const p = (out && out.data) || {}, cc = p.cross_check || {}, lv = p.land_value || {}, ref = p.ref || {};
  if (!(Number(ref.wert_stufe) >= 3) || cc.nicht_im_umfang) return { verfuegbar: false, grund: 'nicht_im_umfang' };
  const genau = !!(p.address && typeof p.address.street === 'string' && p.address.street.trim());
  if (!genau) {
    return { verfuegbar: false, grund: 'ohne_anschrift',
      text: 'Ohne Anschrift nennt DealPilot keinen Bodenrichtwert. Er gilt je Zone, die Postleitzahl reicht dafür nicht. '
        + 'Damit fehlt auch der Bodenwert, den Ertrags- und Sachwert brauchen. Mit der Anschrift im Exposé oder im Formular rechnet der Bericht beides.' };
  }
  const aus = { verfuegbar: true, genau: true, boden: null, verfahren: [], fuehrend: null, stuetzend: null, fuehrend_grund: null,
    weg: null, wertindikation: null, wertindikation_grund: null, quellen: [], hinweis: 'Indikative Wertermittlung, kein Verkehrswertgutachten nach § 194 BauGB.' };
  /* Bodenrichtwert und Bodenwert */
  const bw = cc.bodenwert || {};
  if (lv.available && _n(lv.value_sqm) > 0) {
    aus.boden = { verfuegbar: true, brw_qm: _n(lv.value_sqm), stichtag: /^\d{4}-\d{2}-\d{2}$/.test(String(lv.stichtag || '')) ? String(lv.stichtag) : null,
      veraltet: !!lv.stichtag_veraltet, herkunft: 'amtlicher Bodenrichtwert des Gutachterausschusses',
      bodenwert_eur: (bw.vollstaendig !== false && _n(bw.wert) > 0) ? Math.round(_n(bw.wert)) : null,
      hinweise: (Array.isArray(bw.hinweise) ? bw.hinweise : []).map(function (h) { return _kunde(h, 260, true); }).filter(Boolean).slice(0, 3) };
  } else {
    aus.boden = { verfuegbar: false, grund: _kunde(lv.note, 260) || 'Für diese Lage liegt kein amtlicher Bodenrichtwert vor.' };
  }
  /* Ertragswert */
  const ew = cc.ertragswert || {}, wh = p.wertermittlung_herkunft || {};
  if (ew.available && _n(ew.value_eur) > 0) {
    const st = _stufe(ew.liegenschaftszins_stufe || wh.stufe);
    aus.verfahren.push({ art: 'ertragswert', name: VERFAHREN_NAME.ertragswert, verfuegbar: true, wert_eur: Math.round(_n(ew.value_eur)),
      bezeichnung: _kunde(ew.bezeichnung, 120), lzs_pct: _n(ew.liegenschaftszins_pct), stufe: st,
      herkunft: _kunde(wh.kurz || wh.klartext, 160) || (st ? STUFE_TEXT[st] : null),
      indikativ: !!(wh.indikativ || ew.indikativ_wegen_zins || (st && st !== 'A')),
      rnd_j: _jahr(ew.restnutzungsdauer_jahre), gnd_j: _jahr(ew.gesamtnutzungsdauer_jahre), miete_qm: _n(ew.miete_qm),
      weg: wh.unter_a && wh.weg && wh.weg.text ? _kunde(wh.weg.text, 300) : null, rechenweg: _rechenweg(ew.staffel) });
  } else {
    aus.verfahren.push({ art: 'ertragswert', name: VERFAHREN_NAME.ertragswert, verfuegbar: false, grund: _kunde(ew.grund, 320) || 'Nicht ausgewiesen.' });
  }
  /* Sachwert */
  const sw = cc.sachwert || {};
  if (sw.available && _n(sw.value_eur) > 0 && !sw.pauschal) {
    aus.verfahren.push({ art: 'sachwert', name: VERFAHREN_NAME.sachwert, verfuegbar: true, wert_eur: Math.round(_n(sw.value_eur)),
      marktangepasst: !!sw.marktangepasst, swf: _n(sw.sachwertfaktor),
      bezeichnung: _kunde(sw.bezeichnung, 120),
      herkunft: sw.marktangepasst ? 'Sachwertfaktor des Gutachterausschusses' : 'ohne Sachwertfaktor, vorläufiger Sachwert, kein Marktwert',
      indikativ: true, rnd_j: _jahr(sw.restnutzungsdauer_jahre), gnd_j: _jahr(sw.gnd_jahre), rechenweg: _rechenweg(sw.staffel) });
  } else {
    aus.verfahren.push({ art: 'sachwert', name: VERFAHREN_NAME.sachwert, verfuegbar: false, nicht_massgeblich: !!sw.nicht_massgeblich,
      grund: _kunde(sw.grund, 320) || 'Nicht ausgewiesen.' });
  }
  /* Vergleichswert: nur aus Kaufpreisen (amtlicher Vergleichsfaktor, Immobilienrichtwert) oder Stufe M */
  const cmp = cc.comparison || {}, vw = cc.verfahrenswahl || {}, vi = cc.vergleichswert_irw || {};
  const stufeM = vw.verfahren === 'vergleichswert' && vw.basis === 'angebote' && cmp.basis !== 'kaufpreise';
  if (vi.verfuegbar && _n(vi.vergleichswert_eur) > 0) {
    aus.verfahren.push({ art: 'vergleichswert', name: VERFAHREN_NAME.vergleichswert, verfuegbar: true, wert_eur: Math.round(_n(vi.vergleichswert_eur)),
      stufe: 'A', herkunft: 'Immobilienrichtwert des Gutachterausschusses, auf das Objekt umgerechnet', indikativ: true });
  } else if (cmp.basis === 'kaufpreise' && _n(cmp.vergleichswert_eur) > 0) {
    aus.verfahren.push({ art: 'vergleichswert', name: VERFAHREN_NAME.vergleichswert, verfuegbar: true, wert_eur: Math.round(_n(cmp.vergleichswert_eur)),
      stufe: 'A', herkunft: 'amtlicher Vergleichsfaktor des Gutachterausschusses', rechnung: _kunde(cmp.basis_hinweis, 300), indikativ: true });
  } else if (stufeM && _n(cmp.vergleichswert_eur) > 0) {
    aus.verfahren.push({ art: 'vergleichswert', name: VERFAHREN_NAME.vergleichswert, verfuegbar: true, wert_eur: Math.round(_n(cmp.vergleichswert_eur)),
      stufe: 'M', herkunft: STUFE_TEXT.M, indikativ: true, weg: _kunde(vw.weg, 300) });
  } else {
    aus.verfahren.push({ art: 'vergleichswert', name: VERFAHREN_NAME.vergleichswert, verfuegbar: false,
      grund: 'Für diesen Ort liegt kein amtlicher Vergleichsfaktor vor. Angebotspreise sind keine Kaufpreise (§ 25 Abs. 1 ImmoWertV).' });
  }
  /* Fuehrendes und stuetzendes Verfahren, Wertindikation */
  const nimm = function (a) { return aus.verfahren.filter(function (x) { return x.art === a; })[0] || null; };
  aus.fuehrend = VERFAHREN_NAME[vw.verfahren] ? vw.verfahren : null;
  aus.stuetzend = VERFAHREN_NAME[vw.stuetzend] && nimm(vw.stuetzend) && nimm(vw.stuetzend).verfuegbar ? vw.stuetzend : null;
  aus.fuehrend_grund = _kunde(vw.grund, 300, true);   /* hh4 · nur ganze Sätze */
  if (!aus.fuehrend && vw.nicht_gerechnet) aus.weg = _kunde(vw.weg, 320);
  const f = aus.fuehrend ? nimm(aus.fuehrend) : null;
  if (f && f.verfuegbar && !(f.art === 'sachwert' && !f.marktangepasst)) {
    aus.wertindikation = { wert_eur: f.wert_eur, verfahren: f.art, name: f.name, stufe: f.stufe || null, indikativ: true };
  } else if (f && f.art === 'sachwert' && f.verfuegbar) {
    aus.wertindikation_grund = 'Führend ist das Sachwertverfahren. Ohne Sachwertfaktor des Gutachterausschusses ist der Sachwert eine Herstellungskostenrechnung und kein Marktwert. DealPilot nennt deshalb keine Wertindikation.';
  } else {
    aus.wertindikation_grund = aus.weg || 'Das führende Verfahren ist mit den vorliegenden Angaben nicht rechenbar. Kein Verfahren rechnet halb.';
  }
  /* Namensnennung: nur, was in diesem Bericht steckt (Bodenrichtwert und die Saetze des Quercheck) */
  const q = [];
  if (aus.boden && aus.boden.verfuegbar && lv.quellenvermerk) q.push({ vermerk: _kunde(lv.quellenvermerk, 260), kennzahlen: ['Bodenrichtwert'] });
  (Array.isArray(cc.quellen_nachweis) ? cc.quellen_nachweis : []).slice(0, 8).forEach(function (x) {
    if (!x) return;
    q.push({ vermerk: _kunde(x.vermerk, 260), kennzahlen: (Array.isArray(x.kennzahlen) ? x.kennzahlen : []).map(function (k) { return _kunde(k, 60); }).filter(Boolean),
      jahrgang: _n(x.jahrgang), lizenz: _kunde(x.lizenz, 120) });
  });
  aus.quellen = q.filter(function (x) { return x.vermerk; });
  return aus;
}
function mbEingabe(zahlen, adresse) {
  const z = zahlenSauber(zahlen);
  const ort = [z.plz, z.ort].filter(Boolean).join(' ');
  const adr = (typeof adresse === 'string' && adresse.trim().length >= 5) ? adresse.trim().slice(0, 160) : ort;
  /* v3941 · ohne fast: wie die App (dealpilot-mb.js schickt ab Stufe 2 kein fast). v3946 · Stufe 3, dazu der
     Miteigentumsanteil (ohne ihn kein Bodenwert einer Eigentumswohnung) */
  return { address: adr, wert_stufe: MB_STUFE,
    dealpilot: { plz: z.plz || '', ort: z.ort || '', objart: z.art || '', wfl: z.wfl || null, baujahr: z.bj || null, kp: z.kp || null,
      nkm: z.nkm || null, gsfl: z.gsfl || null, einheiten: z.einheiten || null, zimmer: z.zimmer || null, energieklasse: z.ek_klasse || null,
      mea: z.mea_pct || null } };
}
/* KI-Posten des mb-Dienstes erfassen (wie routes/marktbericht.js), ohne Nutzer, im Weg des Berichts */
function kostenErfassen(j) {
  const c = (j && j.cost) || {};
  let ki = 0;
  try { ki = deps().kiVerbrauch.erfasseFremdPosten(c.openai_posten, { userId: null, endpunkt: 'public/einzelcheck/bericht', funktion: 'einzelcheck-marktbericht' }) || 0; }
  catch (e) { ki = 0; }
  return { ki_eur: ki, marktdaten_eur: _n(c.geomap_eur) };
}
async function markt(zahlen, adresse) {
  const z = zahlenSauber(zahlen);
  if (!z.plz && !z.ort && !(typeof adresse === 'string' && /\b\d{5}\b/.test(adresse))) return { verfuegbar: false, grund: 'ohne_ort' };
  try {
    const r = await deps().mbFetch(MB_BASE + '/reports/einzelcheck', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mbEingabe(z, adresse)) });
    const t = await r.text();
    let j = null; try { j = JSON.parse(t); } catch (e) { j = null; }
    if (!r.ok || !j) return { verfuegbar: false, grund: 'dienst' };
    const k = kostenErfassen(j);
    console.log('[einzelcheck] Marktbericht Stufe ' + MB_STUFE + ': KI ' + Number(k.ki_eur).toFixed(4) + ' EUR, Marktdaten '
      + (k.marktdaten_eur == null ? 'unbekannt' : k.marktdaten_eur.toFixed(2) + ' EUR'));
    const m = Object.assign({ verfuegbar: true }, marktAus(j));
    Object.defineProperty(m, '_kosten', { value: k, enumerable: false });
    /* einzelcheck-2 · Lagekarte fuers Deckblatt (dieselbe Karte wie oben im Marktbericht, ueber den mb-Dienst,
       der Schluessel bleibt dort). Ohne Strasse nur der Ort ohne Marker. */
    const kt = await karteHolen(j && j.data && j.data.address);
    if (kt) { m.karte = kt.bild; m.karte_genau = kt.genau; }
    return m;
  } catch (e) { return { verfuegbar: false, grund: 'dienst' }; }
}

/* einzelcheck-4 · Tiefe vorab: dieselben Zugaenge wie der Bericht, im mb-Dienst (lib/tiefe_vorab.js). Nur PLZ, Ort,
   Objektart, Flaeche, Baujahr und ob eine Strasse vorliegt. Antwort nur Ja/Teils/Nein mit Satz je Verfahren. */
async function tiefe(q) {
  q = q || {};
  const plz = String(q.plz || '').replace(/\D/g, '').slice(0, 5);
  if (!/^\d{5}$/.test(plz)) return { verfuegbar: false, grund: 'ohne_plz' };
  const ort = String(q.ort || '').replace(/[^A-Za-zÄÖÜäöüß .\-()/]/g, '').slice(0, 60);
  const art = /^(ETW|EFH|ZFH|DHH|RH|MFH|GEW)$/.test(String(q.art || '')) ? String(q.art) : '';
  const n = function (v) { const x = _n(v); return x != null && x > 0 && x < 1e6 ? Math.round(x) : ''; };
  const u = MB_BASE + '/tiefe-vorab?plz=' + plz + '&ort=' + encodeURIComponent(ort) + '&objektart=' + art.toLowerCase()
    + '&wfl=' + n(q.wfl) + '&baujahr=' + n(q.bj) + '&strasse=' + (q.strasse === '1' ? '1' : '0');
  try {
    const r = await deps().mbFetch(u, { method: 'GET' });
    const j = r && r.ok ? await r.json() : null;
    if (!j || !j.verfuegbar) return { verfuegbar: false, grund: (j && j.grund) || 'dienst' };
    return { verfuegbar: true, stufe3_voll: !!j.stufe3_voll, kurz: _kunde(j.kurz, 200), hinweis: _kunde(j.hinweis, 200),
      punkte: (Array.isArray(j.punkte) ? j.punkte : []).slice(0, 6).map(function (p) {
        return { id: String(p.id || '').slice(0, 20), name: _kunde(p.name, 40), ok: /^(ja|teils|nein|info)$/.test(p.ok) ? p.ok : 'nein', text: _kunde(p.text, 260) };
      }) };
  } catch (e) { return { verfuegbar: false, grund: 'dienst' }; }
}

/* einzelcheck-7 · Lagekarte als data:-Bild (Deckblatt des Berichts) aus UNSERER OpenStreetMap-Karte statt Geoapify.
   Marcel 25.11.2026: „diese OpenStreetMap-Karte, die soll natürlich auch beim Deal Check auf das PDF mit halt so einem
   Pin, wo die Wohnung ist". Dieselben Kacheln und dieselbe Häuschen-Stecknadel wie frontend/js/lagekarte.js (pin:'haus',
   v4690), nur serverseitig: das Backend hat keine Bildbibliothek, deshalb ein SVG mit den Kacheln als PNG-Bildern.
   Der PDF-Dienst (Chromium) druckt es wie jedes andere Bild. Kacheln über services/osmKacheln.js (Ablage, Ratenbremse,
   eigener User-Agent); an den Kachelserver geht nur die Kachelnummer. Fehlt eine Kachel: null, nie eine halbe Karte.
   Ohne Straße steht die Nadel am Ort, der Bericht sagt dann „Lage ungefähr". */
const OSM_VERMERK = '© OpenStreetMap-Mitwirkende';
function _osmPlan(lat, lon, b, h, z) {
  const K = 256, n0 = K * Math.pow(2, z);
  let si = Math.sin(lat * Math.PI / 180); si = Math.min(Math.max(si, -0.9999), 0.9999);
  const mx = (lon + 180) / 360 * n0, my = (0.5 - Math.log((1 + si) / (1 - si)) / (4 * Math.PI)) * n0;
  const x0 = mx - b / 2, y0 = my - h / 2, n = Math.pow(2, z), liste = [];
  for (let ty = Math.floor(y0 / K); ty <= Math.floor((y0 + h - 1) / K); ty++) {
    for (let tx = Math.floor(x0 / K); tx <= Math.floor((x0 + b - 1) / K); tx++) {
      if (ty < 0 || ty >= n) continue;
      liste.push({ z: z, x: ((tx % n) + n) % n, y: ty, dx: tx * K - x0, dy: ty * K - y0 });
    }
  }
  return { liste: liste, mx: b / 2, my: h / 2 };
}
function _osmPin(mx, my) {
  /* Stecknadel mit Häuschen, Spitze auf der Anschrift (Maße wie lagekarte.js, für die 1200-px-Karte x1,6) */
  const R = 21, cy = my - 40, g = '#C9A84C';
  const tropfen = 'M' + mx + ' ' + my + ' C' + (mx - 8) + ' ' + (my - 14) + ' ' + (mx - R) + ' ' + (cy + 13) + ' ' + (mx - R) + ' ' + cy
    + ' A' + R + ' ' + R + ' 0 0 1 ' + (mx + R) + ' ' + cy + ' C' + (mx + R) + ' ' + (cy + 13) + ' ' + (mx + 8) + ' ' + (my - 14) + ' ' + mx + ' ' + my + ' Z';
  const p = function (dx, dy) { return (mx + dx * 1.6).toFixed(1) + ' ' + (cy + dy * 1.6).toFixed(1); };
  const haus = 'M' + p(0, -7) + ' L' + p(7.5, -0.5) + ' L' + p(5, -0.5) + ' L' + p(5, 6) + ' L' + p(1.6, 6) + ' L' + p(1.6, 2) + ' L' + p(-1.6, 2)
    + ' L' + p(-1.6, 6) + ' L' + p(-5, 6) + ' L' + p(-5, -0.5) + ' L' + p(-7.5, -0.5) + ' Z';
  return '<ellipse cx="' + mx + '" cy="' + (my + 2) + '" rx="11" ry="4" fill="#000" fill-opacity="0.25"/>'
    + '<path d="' + tropfen + '" fill="' + g + '" stroke="#fff" stroke-width="2.6" filter="url(#sch)"/>'
    + '<path d="' + haus + '" fill="#fff"/>';
}
async function karteHolen(adr, o) {
  o = o || {};
  const lat = _n(adr && adr.lat), lon = _n(adr && adr.lon);
  if (lat == null || lon == null || Math.abs(lat) > 85 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  const genau = !!(adr && typeof adr.street === 'string' && adr.street.trim());
  const B = 1200, H = 560, plan = _osmPlan(lat, lon, B, H, genau ? 16 : 13);
  if (!plan.liste.length || plan.liste.length > 24) return null;
  try {
    const osm = o.osm || require('./osmKacheln');
    const bilder = await Promise.all(plan.liste.map(function (k) { return osm.kachel(k.z, k.x, k.y).then(function (r) { return r && r.buf; }, function () { return null; }); }));
    if (bilder.some(function (b) { return !b || !osm.istPng(b); })) return null;   /* nie eine halbe Karte */
    const kacheln = plan.liste.map(function (k, i) {
      return '<image x="' + k.dx.toFixed(1) + '" y="' + k.dy.toFixed(1) + '" width="256" height="256" href="data:image/png;base64,' + bilder[i].toString('base64') + '"/>';
    }).join('');
    const tw = Math.round(OSM_VERMERK.length * 7.2);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + B + '" height="' + H + '" viewBox="0 0 ' + B + ' ' + H + '">'
      + '<defs><filter id="sch" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.35"/></filter></defs>'
      + '<rect width="' + B + '" height="' + H + '" fill="#f2efe9"/>' + kacheln + _osmPin(plan.mx, plan.my)
      + '<rect x="' + (B - tw - 16) + '" y="' + (H - 24) + '" width="' + (tw + 16) + '" height="24" fill="#fff" fill-opacity="0.82"/>'
      + '<text x="' + (B - 8) + '" y="' + (H - 7) + '" text-anchor="end" font-family="Inter, Helvetica, Arial, sans-serif" font-size="14" fill="#333">' + OSM_VERMERK + '</text></svg>';
    return { bild: 'data:image/svg+xml;base64,' + Buffer.from(svg, 'utf8').toString('base64'), genau: genau, quelle: 'osm', vermerk: OSM_VERMERK };
  } catch (e) { return null; }
}

/* ── einzelcheck-2 · Bericht per Mail ─────────────────────────────────────────────────────────────────
   Marcel 24.11.2026: „in der Strecke … die E-Mail-Adresse angeben, dass der Bericht auch per E-Mail einmal
   zugesendet wird … mit dem Link zu DealPilot … gleich mit dem Code". Das PDF druckt der PDF-Dienst aus dem
   fertigen HTML des Browsers (Art html: ohne Skript, ohne Netz, CSP), wie in der App. Die Adresse wird nicht
   gespeichert, nur der Zaehler. Testadressen (.test …) gehen nie ueber SMTP (mailerService). */
function mailErlaubt(zeile, jetzt) {
  if (!zeile) return { ok: false, code: 'kauf_unbekannt' };
  if (!istGueltig(zeile, jetzt)) return { ok: false, code: 'kauf_abgelaufen' };
  if (zeile.status !== 'bezahlt') return { ok: false, code: 'nicht_bezahlt' };
  if ((Number(zeile.mails) || 0) >= MAX_MAILS) return { ok: false, code: 'mails_aufgebraucht' };
  return { ok: true };
}
function emailForm(e) {
  const a = String(e || '').trim();
  return a.length <= 254 && /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[a-z]{2,}$/i.test(a) ? a : null;
}
function _escM(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
/* Mailtext: nur Punkt und Komma, keine Datenquellen. Werbung fuer eigene, aehnliche Leistung an Kaeufer
   (§ 7 Abs. 3 UWG) mit Hinweis auf Widerspruch bei jeder Verwendung. */
function mailInhalt(o) {
  const app = String(o.app || 'https://app.dealpilot.immo/').replace(/\/?$/, '/');
  const reg = app + (o.code ? '?code=' + encodeURIComponent(o.code) : '');
  const codeText = o.code_text || '';
  const widerspruch = 'Du bekommst diese Mail, weil du den Einzel-Check gekauft hast. Hinweise auf DealPilot kannst du jederzeit mit einer kurzen Antwort an info@dealpilot.immo abbestellen. Dafür entstehen nur die Übermittlungskosten nach den Basistarifen.';
  const zeilen = ['Hallo,', '', 'anbei dein Einzel-Check als PDF: ' + o.titel + '.', '',
    'Alle Zahlen, die Finanzierung und die Wertermittlung rechnest du in DealPilot weiter, mit Steuer, Restnutzungsdauer und Mietpotenzial.'];
  if (o.code) zeilen.push('', 'Dein Code: ' + o.code + '. ' + codeText + (o.code_bis ? ', gültig bis ' + o.code_bis : '') + '. Im Checkout eingeben.');
  zeilen.push('', 'Kostenlos starten: ' + reg, '', 'Viele Grüße', 'DealPilot', '', widerspruch);
  const html = '<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:560px">'
    + '<p>Hallo,</p><p>anbei dein Einzel-Check als PDF: <b>' + _escM(o.titel) + '</b>.</p>'
    + '<p>Alle Zahlen, die Finanzierung und die Wertermittlung rechnest du in DealPilot weiter, mit Steuer, Restnutzungsdauer und Mietpotenzial.</p>'
    + (o.code ? '<p style="border:1px dashed #C9A84C;border-radius:8px;padding:12px 14px;background:#FBF6E9">Dein Code: <b style="font-family:monospace;font-size:17px;letter-spacing:.08em">' + _escM(o.code) + '</b><br>'
      + _escM(codeText) + (o.code_bis ? ', gültig bis ' + _escM(o.code_bis) : '') + '. Im Checkout eingeben.</p>' : '')
    + '<p><a href="' + _escM(reg) + '" style="display:inline-block;background:#C9A84C;color:#0a0a0a;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:999px">Kostenlos starten</a></p>'
    + '<p>Viele Grüße<br>DealPilot</p><p style="font-size:12px;color:#6b6b6b">' + _escM(widerspruch) + '</p></div>';
  return { text: zeilen.join('\n'), html: html };
}
function _fehlerMit(text, status, code) { const e = new Error(text); e.status = status; e.code = code; return e; }
/* einzelcheck-6 · Das PDF entsteht beim PDF-Dienst, nicht im Druckfenster des Browsers. Marcels Herford-Bericht trug
   oben Datum und Titel und unten die Adresse der Seite: das sind die Kopf- und Fusszeilen des Chrome-Druckfensters,
   die der Bericht nicht abschalten kann. Mail und Herunterladen nehmen jetzt denselben Weg. */
async function _pdfDrucken(html, t, signal) {
  const geheim = process.env.PDF_DIENST_SECRET;
  const url = String(process.env.PDF_DIENST_URL || 'http://dealpilot-pdf:4100').replace(/\/+$/, '') + '/pdf';
  /* Art html druckt ohne Anmeldung (kein Skript, kein Netz). token/sitzung verlangt der Dienst nur formal. */
  const r = await deps().pdfFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Pdf-Geheimnis': geheim },
    body: JSON.stringify({ art: 'html', html: html, titel: 'DealPilot Einzel-Check ' + t,
      fuss: ['DealPilot · Einzel-Check', 'Stand ' + new Date().toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })],
      token: 'einzelcheck', sitzung: { mode: 'einzelcheck' } }), signal: signal });
  if (!r.ok) throw new Error('PDF-Dienst ' + r.status);
  const pdf = Buffer.from(await r.arrayBuffer());
  if (pdf.length < 1000 || pdf.slice(0, 4).toString() !== '%PDF') throw new Error('kein PDF');
  return pdf;
}
/* einzelcheck-6 · Herunterladen: nur fuer einen bezahlten, gueltigen Kauf, ohne Mail-Zaehler */
async function berichtPdf(zeile, html, titel) {
  if (!zeile) throw _fehlerMit('Der Kauf ist unbekannt.', 403, 'kauf_unbekannt');
  if (!istGueltig(zeile)) throw _fehlerMit('Der Kauf ist abgelaufen.', 403, 'kauf_abgelaufen');
  if (zeile.status !== 'bezahlt') throw _fehlerMit('Das PDF braucht einen bezahlten Kauf.', 402, 'nicht_bezahlt');
  if (typeof html !== 'string' || html.length < 200 || html.length > MAX_MAIL_HTML || !/^<!doctype html>/i.test(html.trim())) throw _fehlerMit('Der Bericht fehlt.', 400, 'html');
  if (!process.env.PDF_DIENST_SECRET) throw _fehlerMit('Der PDF-Dienst ist hier gerade nicht eingerichtet.', 503, 'kein_dienst');
  const t = String(titel || 'Einzel-Check').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) || 'Einzel-Check';
  const ctrl = new AbortController(); const uhr = setTimeout(function () { ctrl.abort(); }, 120000);
  try { return { pdf: await _pdfDrucken(html, t, ctrl.signal), titel: t }; }
  catch (e) { console.warn('[einzelcheck] PDF zum Herunterladen fehlgeschlagen:', e.message); throw _fehlerMit('Das PDF ließ sich gerade nicht erzeugen.', 502, 'pdf'); }
  finally { clearTimeout(uhr); }
}
async function berichtMailen(zeile, email, html, titel) {
  const an = emailForm(email);
  if (!an) throw _fehlerMit('Bitte eine gültige E-Mail-Adresse eintragen.', 400, 'email');
  if (typeof html !== 'string' || html.length < 200 || html.length > MAX_MAIL_HTML || !/^<!doctype html>/i.test(html.trim())) throw _fehlerMit('Der Bericht fehlt.', 400, 'html');
  const geheim = process.env.PDF_DIENST_SECRET;
  if (!geheim) throw _fehlerMit('Der Versand ist hier gerade nicht eingerichtet.', 503, 'kein_dienst');
  const t = String(titel || 'Einzel-Check').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) || 'Einzel-Check';
  /* Zaehler zuerst, mit Bedingung: zwei gleichzeitige Anfragen ueberholen den Deckel nicht */
  const up = await deps().query('UPDATE einzelcheck_kaeufe SET mails = mails + 1 WHERE id = $1 AND mails < $2 RETURNING mails', [zeile.id, MAX_MAILS]);
  if (!up.rowCount) throw _fehlerMit('Der Bericht ging schon ' + MAX_MAILS + ' Mal per Mail raus.', 403, 'mails_aufgebraucht');
  const zurueck = function () { return deps().query('UPDATE einzelcheck_kaeufe SET mails = GREATEST(mails - 1, 0) WHERE id = $1', [zeile.id]).catch(function () {}); };
  const ctrl = new AbortController(); const uhr = setTimeout(function () { ctrl.abort(); }, 120000);
  let pdf;
  try {
    pdf = await _pdfDrucken(html, t, ctrl.signal);
  } catch (e) {
    console.warn('[einzelcheck] PDF fuer Mail fehlgeschlagen:', e.message);
    await zurueck();
    throw _fehlerMit('Das PDF ließ sich gerade nicht erzeugen. Bitte gleich noch einmal.', 502, 'pdf');
  } finally { clearTimeout(uhr); }
  const bis = zeile.gueltig_bis ? new Date(zeile.gueltig_bis) : null;
  const cents = Number(zeile.amount_cents) || 0;
  const inhalt = mailInhalt({ titel: t, app: 'https://app.dealpilot.immo/',
    code: zeile.anrechnung_code || null,
    code_text: cents > 0 ? 'Er rechnet die ' + (cents / 100).toFixed(2).replace('.', ',') + ' € des Berichts auf dein erstes Paket an' : 'Er rechnet den Bericht auf dein erstes Paket an',
    code_bis: bis ? bis.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }) : '' });
  try {
    const erg = await deps().sendMail({ to: an, subject: 'Dein DealPilot Einzel-Check: ' + t, text: inhalt.text, html: inhalt.html, replyTo: 'info@dealpilot.immo',
      attachments: [{ filename: ('DealPilot Einzel-Check ' + t).replace(/[^\wäöüÄÖÜß .,-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) + '.pdf', content: pdf, contentType: 'application/pdf' }] });
    return { ok: true, mails: up.rows[0].mails, rest: Math.max(0, MAX_MAILS - up.rows[0].mails), bytes: pdf.length, testadresse: !!(erg && erg.testadresse) };
  } catch (e) {
    console.warn('[einzelcheck] Mail fehlgeschlagen:', e.message);
    await zurueck();
    throw _fehlerMit('Die Mail ließ sich gerade nicht senden. Bitte gleich noch einmal.', 502, 'mail');
  }
}

/* Adresse aus dem Exposé: nur fuer den Marktbericht-Dienst, nie gespeichert, nie in zahlen. */
function adresseAus(ergebnisse) {
  const e = (ergebnisse || []).find(function (x) { return x && x.ok && x.typ === 'expose' && x.extracted && typeof x.extracted.adresse === 'string'; });
  return e ? e.extracted.adresse : null;
}

/* ── Takt: abgelaufene Kaeufe loeschen ───────────────────────────────── */
async function aufraeumen() {
  const r = await deps().query('DELETE FROM einzelcheck_kaeufe WHERE gueltig_bis < now()', []);
  return r.rowCount || 0;
}
function starteTakt() {
  const _ts = require('../utils/taktSperre');
  const _einzelcheckLoeschen = _ts.takt('einzelcheckLoeschen', function () {
    return aufraeumen().then(function (n) { if (n) console.log('[einzelcheck] ' + n + ' abgelaufene Käufe gelöscht'); })
      .catch(function (e) { console.error('[einzelcheck] Löschen fehlgeschlagen:', e.message); });
  });
  setTimeout(_einzelcheckLoeschen, 4 * 60 * 1000);
  setInterval(_einzelcheckLoeschen, 6 * 60 * 60 * 1000);
}

module.exports = {
  VERSION, LOOKUP_KEY, ANRECHNUNG_COUPON, FRIST_TAGE, FREI_MAX_UNTERLAGEN, VOLL_MAX_UNTERLAGEN, MAX_DATEI_BYTES, MAX_BERICHTE,
  ERLAUBTE_MIME, ZAHL_GRENZEN,
  aktiv, istStaging, modellFrei, modellVoll, tagesdeckelEur,
  hash, neuesToken, tokenForm, siegel, siegelPruefen, gueltigBis, istGueltig, berichtErlaubt,
  dateiPruefen, dateiname, zahlenSauber, zahlenAus, anzeigeAus, leseEine, auslesen,
  freiMoeglich, tagesverbrauchEur, preis, landingBasis, kaufAnlegen, kaufLesen, statusAus, berichtGezaehlt,
  handleEinzelcheckPaid, marktAus, vglAus, mbEingabe, strasseAus, markt, textAus, kostenErfassen, adresseAus, aufraeumen, starteTakt, MB_STUFE, OCR_SEITEN, OCR_ZEIT_MS,
  /* v3946 */ grundSauber, grundFehlt, GRUND_FELDER, GRUND_PFLICHT, wertAus, ueberschrift, KAPITEL,
  istExpose, istWertbericht, zahlenUndHerkunft, _setzeDeps, _pdfText,
  /* einzelcheck-2 */ karteHolen, tiefe, berichtMailen, berichtPdf, mailErlaubt, mailInhalt, emailForm, MAX_MAILS
};
