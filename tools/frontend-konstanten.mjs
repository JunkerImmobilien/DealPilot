#!/usr/bin/env node
/* tools/frontend-konstanten.mjs — v1794
 *
 * Macht die Frontend-Konstanten fuer das Backend lesbar, OHNE sie zu
 * duplizieren.
 *
 * ── WARUM ES DIESES WERKZEUG GIBT ────────────────────────────────────────
 *
 * Der Telegram-Bot soll Objekte anlegen und dabei Schritt fuer Schritt
 * fuehren ("mir fehlen noch die und die Eckdaten"). Diese Fuehrung ist
 * gebaut — aber im Browser:
 *
 *   voice-import.js:2682   ETAPPEN      8 Etappen
 *   voice-import.js:2718   RFRAGEN      18 Frageblöcke, nach Rang sortiert
 *   objektart-felder.js:51 ARTEN        welches Feld zu welcher Objektart passt
 *   storage.js:54          FIELDS       221 Feld-Ids
 *   index.html             label/kind/options je Feld
 *
 * Marcel am 02.10.2026: "du sollst das auch nicht doppelt bauen."
 *
 * Gemessen am selben Tag: ETAPPEN, RFRAGEN, ARTEN und FIELDS enthalten
 * ZUSAMMEN NULL FUNKTIONEN. Es sind reine Daten — und reine Daten lassen
 * sich extrahieren statt abschreiben.
 *
 *   > Eine Kopie von Hand ist eine zweite Quelle, die beim ersten
 *   > Nachpflegen auseinanderlaeuft. Ein Extraktor ist eine Ableitung: er
 *   > ist immer falsch ODER immer richtig, nie halb.
 *
 * Es gab bereits zwei handgepflegte Duplikate mit Kommentar-Vertrag
 * ("MUSS MIT frontend/js/config.js ZUSAMMENPASSEN" in aiCreditsService.js,
 * "grep <option> in frontend/index.html" in immometricaMapping.js). Genau
 * diese Bauart soll hier nicht noch einmal entstehen.
 *
 * ── WIE ES ARBEITET ──────────────────────────────────────────────────────
 *
 * 1. Die IIFE-Module werden in Node AUSGEFUEHRT, mit einem winzigen
 *    DOM-Stub. Dann stehen die Konstanten als echte Objekte bereit — kein
 *    Regex-Schneiden, keine halb geparsten Literale.
 * 2. `index.html` wird als Text gelesen: Typ, Optionen und Beschriftung je
 *    Feld stehen dort literal.
 * 3. Herausgeschrieben wird EINE JSON-Datei mit einer PRUEFSUMME je
 *    Quelldatei. Aendert sich eine Quelle, ohne dass der Extraktor lief,
 *    meldet der Waechter das — statt still mit alten Daten zu arbeiten.
 *
 * Aufruf:  node tools/frontend-konstanten.mjs [--pruefen]
 *          --pruefen schreibt nichts, sondern meldet nur, ob die Datei
 *          noch zu den Quellen passt (RC=1, wenn nicht).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, '..');
const FE = path.join(WURZEL, 'frontend');
const ZIEL = path.join(WURZEL, 'backend', 'src', 'generated', 'frontend-konstanten.json');

const QUELLEN = {
  'voice-import': path.join(FE, 'js', 'voice-import.js'),
  'objektart-felder': path.join(FE, 'js', 'objektart-felder.js'),
  'storage': path.join(FE, 'js', 'storage.js'),
  'index-html': path.join(FE, 'index.html'),
  /* ── v1823 · DIE GRUNDERWERBSTEUER ──────────────────────────────────
   *
   * Marcel am 04.10.2026 zum Bot: „dass wir da vielleicht einfach gucken,
   * einmal den Ort abfragen, was haben wir denn da, und dann koennen wir
   * ja grob das hochrechnen, was die Kaufnebenkosten waeren."
   *
   * Die Tabelle gibt es seit V226: PLZ-Bereich -> Bundesland -> Satz,
   * sechzehn Laender, von 3,5 % (Bayern) bis 6,5 %. Sie ist reine Daten.
   *
   *   > Eine zweite Steuertabelle im Backend waere die Stelle, an der ein
   *   > Satz nach der naechsten Gesetzesaenderung an EINEM Ort stimmt. */
  'grest': path.join(FE, 'js', 'grest-plz-lookup.js')
};

/* ── v2960 · HILFE UND BEWERTUNG FUER DEN TELEGRAM-BOT ─────────────────
 *
 * Marcel am 26.10.2026: „Kann der Telegram Bot auch Fragen beantworten in
 * Bezug auf die Hilfe? … alle 3 Stufen der Bewertung?"
 *
 * Drei Dinge, die der Bot braucht und die nur im Frontend stehen:
 *
 *   help.js           HELP_TOPICS   18 Themen, 161 Abschnitte (Hilfe-Fenster)
 *   objekt-reiter.js  pflichtFuer() was jede Bewertungsstufe zwingend braucht
 *   dealpilot-mb.js   ZUSATZ        welche Objektfelder der Browser an den
 *                                   Bericht schickt (88 Felder)
 *
 * GEMESSEN am 26.10.2026: der Bot schickte dem Bericht ZWOELF Felder, der
 * Browser 88. Eine „erweiterte Marktpreisindikation" aus dem Bot kannte
 * damit weder Zustand noch Ausstattung — genau das, wofuer Stufe 2 bezahlt
 * wird. Eine handgeschriebene Liste im Backend waere die naechste Kopie.
 *
 * ANDERS ALS OBEN wird hier nicht die ganze Datei gehasht, sondern der
 * GEERNTETE INHALT. Diese drei Dateien aendern sich oft an Stellen, die
 * den Bot nichts angehen (Layout, Texte daneben). Der Waechter soll
 * anschlagen, wenn sich die HILFE oder die PFLICHT aendert — nicht, wenn
 * jemand einen Abstand im Hilfe-Fenster korrigiert. */
const INHALT_QUELLEN = {
  'hilfe': path.join(FE, 'js', 'help.js'),
  'objekt-reiter': path.join(FE, 'js', 'objekt-reiter.js'),
  'dealpilot-mb': path.join(FE, 'js', 'dealpilot-mb.js')
};

function inhaltSumme(wert) {
  return crypto.createHash('sha256').update(JSON.stringify(wert)).digest('hex').slice(0, 16);
}

/* HTML der Hilfe -> lesbarer Text. Absaetze bleiben, Auszeichnung faellt. */
function hilfeText(s) {
  return String(s == null ? '' : s)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* Eine Liste '...'-Strings aus einem Array-Literal, Kommentare entfernt. */
function stringListe(literal) {
  return (String(literal).replace(/\/\*[\s\S]*?\*\//g, '').match(/'[^']+'/g) || [])
    .map((s) => s.slice(1, -1));
}

const nurPruefen = process.argv.includes('--pruefen');

function summe(datei) {
  return crypto.createHash('sha256').update(fs.readFileSync(datei)).digest('hex').slice(0, 16);
}

/* ── Ein DOM, das gerade genug kann ──────────────────────────────────────
 *
 * GEMESSEN, was die Module beim Laden wirklich anfassen:
 *   voice-import.js:11221   injectCss() -> getElementById, createElement,
 *                           head.appendChild
 *   objektart-felder.js:193 boot() -> addEventListener, readyState,
 *                           setTimeout
 * Mehr nicht. Alles Weitere laeuft erst, wenn jemand das Modul bedient. */
function domStub() {
  const el = () => ({
    id: '', textContent: '', style: {}, className: '', value: '',
    options: [], children: [], classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, closest() { return null; }, parentElement: null
  });
  const document = {
    readyState: 'complete',
    head: el(), body: el(), documentElement: el(),
    getElementById() { return null; },
    createElement() { return el(); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}, createTextNode() { return el(); }
  };
  const window = {
    document,
    addEventListener() {}, removeEventListener() {},
    setTimeout() { return 0; }, clearTimeout() {},
    setInterval() { return 0; }, clearInterval() {},
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    navigator: { userAgent: 'node', language: 'de' },
    location: { href: '', search: '' },
    console
  };
  window.window = window;
  window.self = window;
  window.globalThis = window;
  return window;
}

function ladeModul(datei, kontext) {
  const quelle = fs.readFileSync(datei, 'utf8');
  const script = new vm.Script(quelle, { filename: path.basename(datei) });
  script.runInContext(kontext);
}

function ernte() {
  const win = domStub();
  const kontext = vm.createContext(win);
  /* damit `var X = ...` auf oberster Ebene am Kontext landet */
  kontext.global = kontext;

  const ergebnis = { erzeugt_am: new Date().toISOString(), quellen: {}, daten: {} };
  for (const [name, datei] of Object.entries(QUELLEN)) ergebnis.quellen[name] = summe(datei);

  /* ── 1 · Objektart-Tabelle ─────────────────────────────────────────── */
  ladeModul(QUELLEN['objektart-felder'], kontext);
  const OA = kontext.DealPilotObjektart;
  if (!OA || !OA._arten) throw new Error('DealPilotObjektart._arten nicht erreichbar');
  ergebnis.daten.objektarten = OA._arten;

  /* ── 2 · Etappen und Fragen ────────────────────────────────────────── */
  ladeModul(QUELLEN['voice-import'], kontext);
  const VI = kontext.VoiceImport;
  if (!VI) throw new Error('window.VoiceImport nicht erreichbar');
  if (!VI._etappen || !VI._fragen) {
    throw new Error('VoiceImport._etappen/._fragen fehlen — die Pruefhaken sind weg');
  }
  ergebnis.daten.etappen = VI._etappen;
  ergebnis.daten.fragen = VI._fragen;

  /* ── 3 · Feld-Ids ──────────────────────────────────────────────────── */
  ladeModul(QUELLEN['storage'], kontext);
  const F = kontext.FIELDS || win.FIELDS;
  if (!Array.isArray(F) || !F.length) throw new Error('FIELDS nicht erreichbar');
  ergebnis.daten.feld_ids = F;

  /* ── 4 · Beschriftung, Art und Optionen aus dem HTML ───────────────── */
  ergebnis.daten.felder = felderAusHtml(fs.readFileSync(QUELLEN['index-html'], 'utf8'), F);

  /* ── 5 · Grunderwerbsteuer je Bundesland, PLZ-Bereiche ─────────────── */
  ladeModul(QUELLEN['grest'], kontext);
  const G = kontext.DealPilotGrest || win.DealPilotGrest;
  if (!G || !G.rates || !G._ranges) {
    throw new Error('DealPilotGrest.rates/._ranges nicht erreichbar — der Pruefhaken ist weg');
  }
  if (Object.keys(G.rates).length !== 16) {
    throw new Error('GREST_RATES hat ' + Object.keys(G.rates).length
      + ' Laender, nicht 16 — da fehlt eines');
  }
  ergebnis.daten.grest = {
    saetze: G.rates,
    namen: G.names,
    plz_bereiche: G._ranges,
    hinweis: 'Saetze je Bundesland in Prozent. plz_bereiche ist [von, bis, '
           + 'Landeskuerzel] und wird der Reihe nach geprueft — der erste '
           + 'Treffer gilt, wie im Frontend.'
  };

  /* ── 6 · v2960 · Die Hilfe, wie sie im Hilfe-Fenster steht ─────────── */
  ladeModul(INHALT_QUELLEN['hilfe'], kontext);
  const H = kontext.DealPilotHilfe;
  if (!H || typeof H.themen !== 'function') throw new Error('DealPilotHilfe.themen() nicht erreichbar');
  ergebnis.daten.hilfe = H.themen().map((t) => ({
    id: t.id,
    titel: hilfeText(t.title),
    beschreibung: hilfeText(t.desc || ''),
    abschnitte: (t.sections || []).map((s) => ({ h: hilfeText(s.h), text: hilfeText(s.body) }))
  }));

  /* ── 7 · v2960 · Was jede Bewertungsstufe braucht, und was mitreist ── */
  ladeModul(INHALT_QUELLEN['objekt-reiter'], kontext);
  const OR = kontext.DealPilotObjektReiter;
  if (!OR || typeof OR.pflichtFuer !== 'function') throw new Error('DealPilotObjektReiter.pflichtFuer() nicht erreichbar');
  /* pflichtFuer(stufe, art, garagen) liest ohne die beiden letzten
     Angaben das FORMULAR. Mit ihnen ist sie rein — die Tabelle unten ist
     also genau ihr Ergebnis, Zelle fuer Zelle, nicht eine Nachbildung. */
  const pflicht = {};
  for (const art of [''].concat(Object.keys(OA._arten))) {
    pflicht[art] = {};
    for (const s of [1, 2, 3]) pflicht[art][s] = OR.pflichtFuer(s, art || '-', '0');
    pflicht[art]['3_mit_garage'] = OR.pflichtFuer(3, art || '-', '1');
  }
  const mbQuelle = fs.readFileSync(INHALT_QUELLEN['dealpilot-mb'], 'utf8');
  const z = /var ZUSATZ = \[([\s\S]*?)\];/.exec(mbQuelle);
  if (!z) throw new Error('dealpilot-mb.js: var ZUSATZ nicht gefunden');
  const mfh = /o\._mfh_einheiten = m\.einheiten\.map\(function \(e\) \{([\s\S]*?)\}\);/.exec(mbQuelle);
  if (!mfh) throw new Error('dealpilot-mb.js: _mfh_einheiten-Abbildung nicht gefunden');
  const oaQuelle = fs.readFileSync(QUELLEN['objektart-felder'], 'utf8');
  const alle = /var ALLE = \[([\s\S]*?)\];/.exec(oaQuelle);
  if (!alle) throw new Error('objektart-felder.js: var ALLE nicht gefunden');
  ergebnis.daten.bewertung = {
    pflicht: pflicht,
    grundfelder: ['plz', 'ort', 'str', 'hnr', 'objektart', 'objart', 'wfl', 'baujahr', 'kp'],
    zusatz: stringListe(z[1]),
    mfh_einheit_felder: [...mfh[1].replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(\w+):\s*e\./g)].map((x) => x[1]),
    objektart_typfelder: stringListe(alle[1]),
    hinweis: 'pflicht[art][stufe] ist das Ergebnis von DealPilotObjektReiter.pflichtFuer(stufe, art, garagen) '
           + '(objekt-reiter.js). zusatz ist die Feldliste, mit der dealpilot-mb.js inputs() den Bericht '
           + 'fuettert; grundfelder steht dort literal in der ersten Zeile von inputs().'
  };

  ergebnis.inhalt = {
    hilfe: inhaltSumme(ergebnis.daten.hilfe),
    bewertung: inhaltSumme(ergebnis.daten.bewertung)
  };

  return ergebnis;
}

/* Liest je Feld-Id Typ, Optionen und Beschriftung aus dem statischen HTML.
 *
 * GEMESSEN: von 221 Feldern hat KEIN EINZIGES ein `label[for=...]` — in der
 * ganzen index.html gibt es zwei davon. Die Beschriftung haengt an der
 * Struktur `.f > label`, also wird sie so gesucht: vom Element aus
 * rueckwaerts zum naechsten <label> innerhalb desselben `<div class="f">`. */
function felderAusHtml(html, ids) {
  const raus = [];
  for (const id of ids) {
    if (/^_/.test(id) || /^ai_/.test(id)) continue;
    const m = new RegExp('<(input|select|textarea)\\b[^>]*\\bid="' + id + '"[^>]*>', 'i').exec(html);
    if (!m) continue;
    const tag = m[1].toLowerCase();
    const attr = m[0];
    if (/\btype="hidden"/i.test(attr)) continue;

    let kind = 'text';
    if (/\btype="checkbox"/i.test(attr)) kind = 'bool';
    else if (tag === 'select') kind = 'select';

    const eintrag = { id, kind };

    if (kind === 'select') {
      const ende = html.indexOf('</select>', m.index);
      const block = ende > 0 ? html.slice(m.index, ende) : '';
      const opts = [];
      const re = /<option\b[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi;
      let o;
      while ((o = re.exec(block))) {
        if (o[1] === '') continue;
        opts.push({ wert: o[1], text: o[2].replace(/<[^>]+>/g, '').trim() });
      }
      if (opts.length) eintrag.optionen = opts;
    }

    /* Beschriftung: rueckwaerts zum naechsten <label>, aber nur innerhalb
       der letzten 1200 Zeichen — sonst greift man das Label des Feldes
       darueber ab. */
    /* v1794b · HIER STAND EIN LOOKAHEAD, UND ER HAT LABELS VERSCHMOLZEN.
       Der Ausdruck `<label[^>]*>([\s\S]*?)<\/label>(?![\s\S]*<label)`
       sollte "das letzte Label davor" treffen. Tatsaechlich beginnt er beim
       ERSTEN Label, und weil der Lookahead nach dessen `</label>` noch ein
       weiteres `<label` sieht, dehnt er sich ueber alle hinweg.

       GEMESSEN: `objart` bekam das Label "PLZ Ort Strasse Hausnummer
       Objektart" — vier Beschriftungen in einer. Der Bot haette dem Nutzer
       diesen Satz als Feldnamen vorgelesen.

       > Ein Extraktor, der etwas Plausibles liefert, wird nicht
       > nachgemessen. Gerade deshalb muss man ihn nachmessen.

       Jetzt alle Labels im Fenster einsammeln und das LETZTE nehmen —
       eine Schleife sagt, was sie meint, ein Lookahead nicht. */
    const vor = html.slice(Math.max(0, m.index - 1200), m.index);
    const re2 = /<label[^>]*>([\s\S]*?)<\/label>/gi;
    let lab = null, treffer;
    while ((treffer = re2.exec(vor))) lab = treffer[1];
    if (lab) {
      const txt = lab.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (txt) eintrag.label = txt;
    }

    /* v1813c · DREI FELDER HATTEN KEIN LABEL — UND DER BOT ZEIGTE DEN
       FELDNAMEN. Gemessen am 03.10.2026: `leerstand`, `btj` und `exit_bmy`
       kamen ohne Beschriftung durch, weil ihre Zeile keinen <label> fuehrt,
       sondern ein <span class="ass-l">. Der Agent las dem Nutzer daraufhin
       "leerstand: 0" vor.

         > Die Beschriftung ist das einzige, was ein Feld fuer einen
         > Menschen lesbar macht. Fehlt sie, zeigt die Maschine ihre
         > Innereien — und das sieht aus wie ein Datenfehler.

       Der Ausdruck greift nur, wenn KEIN <label> gefunden wurde, und nur in
       den letzten 400 Zeichen: so weit reicht eine Zeile, nicht weiter.
       Dass der Zaehler unten "mit Beschriftung" mitfuehrt, hat diesen
       Befund ueberhaupt erst sichtbar gemacht. */
    if (!eintrag.label) {
      const nah = html.slice(Math.max(0, m.index - 400), m.index);
      const re3 = /<span[^>]*class="[^"]*\bass-l\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
      let sp = null, t3;
      while ((t3 = re3.exec(nah))) sp = t3[1];
      if (sp) {
        const txt = sp.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (txt) eintrag.label = txt;
      }
    }
    raus.push(eintrag);
  }
  return raus;
}

/* ── Lauf ────────────────────────────────────────────────────────────── */
let neu;
try {
  neu = ernte();
} catch (e) {
  console.error('FEHLGESCHLAGEN: ' + e.message);
  process.exit(2);
}

const d = neu.daten;
const bericht = [
  'Objektarten : ' + Object.keys(d.objektarten).length,
  'Etappen     : ' + d.etappen.length,
  'Frageblöcke : ' + d.fragen.length,
  'Feld-Ids    : ' + d.feld_ids.length,
  'Felder mit Form aus dem HTML: ' + d.felder.length
    + '  (davon select ' + d.felder.filter((f) => f.kind === 'select').length
    + ', bool ' + d.felder.filter((f) => f.kind === 'bool').length
    + ', mit Beschriftung ' + d.felder.filter((f) => f.label).length + ')',
  'Hilfe       : ' + d.hilfe.length + ' Themen, '
    + d.hilfe.reduce((a, t) => a + t.abschnitte.length, 0) + ' Abschnitte',
  'Bewertung   : ' + Object.keys(d.bewertung.pflicht).length + ' Objektarten, '
    + d.bewertung.zusatz.length + ' Zusatzfelder, '
    + d.bewertung.mfh_einheit_felder.length + ' Einheitenfelder'
].join('\n  ');

if (nurPruefen) {
  if (!fs.existsSync(ZIEL)) {
    console.error('Es gibt noch keine ' + path.relative(WURZEL, ZIEL) + ' — einmal ohne --pruefen laufen lassen.');
    process.exit(1);
  }
  const alt = JSON.parse(fs.readFileSync(ZIEL, 'utf8'));
  const abweichung = Object.keys(neu.quellen).filter((k) => alt.quellen[k] !== neu.quellen[k]);
  /* v2960 · Hilfe und Bewertung werden am geernteten INHALT gemessen. */
  Object.keys(neu.inhalt || {}).forEach((k) => {
    if (!alt.inhalt || alt.inhalt[k] !== neu.inhalt[k]) {
      neu.quellen['inhalt:' + k] = neu.inhalt[k];
      alt.quellen['inhalt:' + k] = (alt.inhalt && alt.inhalt[k]) || '(fehlt)';
      abweichung.push('inhalt:' + k);
    }
  });
  if (abweichung.length) {
    console.error('VERALTET. Diese Quellen haben sich geaendert, seit die Datei erzeugt wurde:');
    abweichung.forEach((k) => console.error('  ' + k + '  ' + alt.quellen[k] + ' -> ' + neu.quellen[k]));
    console.error('\n  node tools/frontend-konstanten.mjs');
    process.exit(1);
  }
  console.log('AKTUELL — alle ' + Object.keys(neu.quellen).length + ' Quellen unveraendert.');
  console.log('  ' + bericht);
  process.exit(0);
}

/* Mindestmengen: ein Extraktor, der still NICHTS findet, ist schlimmer als
   einer, der abbricht. Die Zahlen stammen aus der Messung vom 02.10.2026. */
const mindest = { etappen: 6, fragen: 12, feld_ids: 150, felder: 120, hilfe: 12 };
/* v2960 · gemessen 26.10.2026: 161 Abschnitte, 88 Zusatzfelder, 16 Einheitenfelder */
if (d.hilfe.reduce((a, t) => a + t.abschnitte.length, 0) < 100
    || d.bewertung.zusatz.length < 60 || d.bewertung.mfh_einheit_felder.length < 10
    || d.bewertung.zusatz.indexOf('ds2_zustand') < 0 || d.bewertung.zusatz.indexOf('baustatus') < 0) {
  console.error('ABBRUCH — Hilfe oder Bewertungsfelder zu duenn geerntet, das ist ein Ausfall.');
  process.exit(2);
}
const zuwenig = Object.entries(mindest).filter(([k, n]) =>
  (k === 'objektarten' ? Object.keys(d[k]).length : d[k].length) < n);
if (zuwenig.length) {
  console.error('ABBRUCH — zu wenig geerntet, das ist ein Ausfall und kein Befund:');
  zuwenig.forEach(([k, n]) => console.error('  ' + k + ': ' + d[k].length + ' < ' + n));
  process.exit(2);
}

fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
fs.writeFileSync(ZIEL, JSON.stringify(neu, null, 1) + '\n', 'utf8');
console.log('Geschrieben: ' + path.relative(WURZEL, ZIEL));
console.log('  ' + bericht);
