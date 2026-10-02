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
  'index-html': path.join(FE, 'index.html')
};

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
    + ', mit Beschriftung ' + d.felder.filter((f) => f.label).length + ')'
].join('\n  ');

if (nurPruefen) {
  if (!fs.existsSync(ZIEL)) {
    console.error('Es gibt noch keine ' + path.relative(WURZEL, ZIEL) + ' — einmal ohne --pruefen laufen lassen.');
    process.exit(1);
  }
  const alt = JSON.parse(fs.readFileSync(ZIEL, 'utf8'));
  const abweichung = Object.keys(neu.quellen).filter((k) => alt.quellen[k] !== neu.quellen[k]);
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
const mindest = { etappen: 6, fragen: 12, feld_ids: 150, felder: 120 };
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
