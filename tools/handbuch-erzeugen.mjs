#!/usr/bin/env node
/* tools/handbuch-erzeugen.mjs — v2555 · Flughandbuch „Objekt anlegen"
 *
 * Marcel am 21.10.2026: „bebilderte Anleitungen, wie man ein MFH oder eine
 * ETW oder ein EFH anlegt, mit allen Feldern und Beschreibung sowie
 * Auswirkung … auch als PDF-Export … irgendwo in die Hilfe packen."
 *
 * ── WARUM EIN ERZEUGER UND KEIN HANDGESCHRIEBENES HANDBUCH ────────────────
 *
 *   > Ein Handbuch von Hand ist eine dritte Quelle neben index.html und den
 *   > Hilfetexten — sie laeuft beim ersten neuen Feld auseinander.
 *
 * Dieser Erzeuger LIEST nur, was schon da ist, und schreibt EINE Datendatei
 * (frontend/handbuch/handbuch-daten.js), die frontend/handbuch.html anzeigt:
 *
 *   index.html               Reiter, Karten, Feld-Ids, Beschriftung, Einheit,
 *                            Auswahlwerte, Platzhalter, Hinweis, title, DS2-Marke
 *   tooltip-content.js       gepflegte Erklaertexte (ueber data-tip-id am Feld)
 *   help.js                  „Die Reiter im Objekt" je Reiter als Einleitung
 *   tour-content.js          der Tour-Text je Reiter
 *   objekt-reiter.js         pflichtFuer(stufe) je Objektart (die ECHTE Funktion)
 *   objektart-felder.js      was zu welcher Objektart passt (ueber
 *                            backend/src/generated/frontend-konstanten.json)
 *   deal-action-readycheck   FIELD_TARGETS: welches Feld im Readycheck zaehlt
 *   feld-hilfe.js            DS2-Liste und die mod_/eq_-Regel
 *   mfh-einheiten.js         die Felder der Wohnungsliste (f()/s()/d()-Aufrufe)
 *   Wirkungs-Module          calc.js, ui.js (_buildAIPayload), pdf.js,
 *                            pdf-investment-bank.js, financing-pdf.js,
 *                            werbungskosten-pdf.js, pdf-anlage-bmf.js,
 *                            pdf-kaufpreisaufteilung.js — ein Feld „wirkt",
 *                            wenn das Modul es per Id liest (Aufruf mit der
 *                            Id als einzigem Argument). Was nicht belegt ist,
 *                            steht nicht da.
 *
 * Dazu GEMESSEN (nicht abgeleitet): frontend/handbuch/bilder/aufnahme.json —
 * von frontend/handbuch/aufnahme.js im Browser auf Staging geschrieben:
 * welche Felder je Objektart sichtbar sind, in welchem Bild sie stehen und
 * welche Nummer sie dort tragen.
 *
 * DIE EINZIGE HANDGEPFLEGTE STELLE ist WOHER_REGELN (unten): wo ein Wert
 * ueblicherweise steht (Exposé, Teilungserklaerung …). Steht die Herkunft
 * schon im Hilfetext („steht im Energieausweis"), gewinnt der Hilfetext.
 *
 * Aufruf:  node tools/handbuch-erzeugen.mjs [--pruefen]
 *          --pruefen schreibt nichts und meldet RC=1, wenn die Datendatei
 *          nicht mehr zu den Quellen passt.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { ABLAEUFE } from './handbuch-ablaeufe.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(HIER, '..');
const FE = path.join(WURZEL, 'frontend');
const JS = (n) => path.join(FE, 'js', n);
const ZIEL = path.join(FE, 'handbuch', 'handbuch-daten.js');
const AUFNAHME = path.join(FE, 'handbuch', 'bilder', 'aufnahme.json');
const KONST = path.join(WURZEL, 'backend', 'src', 'generated', 'frontend-konstanten.json');

const QUELLEN = {
  'index.html': path.join(FE, 'index.html'),
  'tooltip-content.js': JS('tooltip-content.js'),
  'help.js': JS('help.js'),
  'tour-content.js': JS('tour-content.js'),
  'objekt-reiter.js': JS('objekt-reiter.js'),
  'deal-action-readycheck.js': JS('deal-action-readycheck.js'),
  'feld-hilfe.js': JS('feld-hilfe.js'),
  'mfh-einheiten.js': JS('mfh-einheiten.js'),
  'calc.js': JS('calc.js'),
  'ui.js': JS('ui.js'),
  'pdf.js': JS('pdf.js'),
  'pdf-investment-bank.js': JS('pdf-investment-bank.js'),
  'financing-pdf.js': JS('financing-pdf.js'),
  'werbungskosten-pdf.js': JS('werbungskosten-pdf.js'),
  'pdf-anlage-bmf.js': JS('pdf-anlage-bmf.js'),
  'pdf-kaufpreisaufteilung.js': JS('pdf-kaufpreisaufteilung.js'),
  'frontend-konstanten.json': KONST,
  'aufnahme.json': AUFNAHME,
  /* v2574 · Teil „Schritt für Schritt": handgepflegte Abläufe mit Belegen */
  'handbuch-ablaeufe.mjs': path.join(HIER, 'handbuch-ablaeufe.mjs')
};

const nurPruefen = process.argv.includes('--pruefen');
const lies = (p) => fs.readFileSync(p, 'utf8');
const summe = (p) => fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16) : 'fehlt';

/* ═══ 1 · Ein HTML-Baum, der gerade genug kann ═══════════════════════════
 * Kein Parser im Repo (gemessen: weder jsdom noch parse5 in einem der drei
 * node_modules). index.html ist handgeschrieben und wohlgeformt genug fuer
 * einen Stapel-Baum: leere Elemente, Kommentare, script/style als Rohtext. */
const LEER = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'use', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon', 'stop']);
const ROH = new Set(['script', 'style', 'textarea', 'template']);
function ent(s) {
  return String(s).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/g, 'ß').replace(/&euro;/g, '€').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&middot;/g, '·').replace(/&sup2;/g, '²');
}
function baum(html) {
  const wurzel = { tag: '#root', attr: {}, kinder: [], eltern: null };
  let akt = wurzel, i = 0;
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m.index > i) akt.kinder.push({ text: html.slice(i, m.index) });
    i = re.lastIndex;
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) {
      const t = m[1].toLowerCase();
      let k = akt; while (k && k.tag !== t) k = k.eltern;
      if (k && k.eltern) akt = k.eltern;
      continue;
    }
    const tag = m[2].toLowerCase(), attr = {};
    const ar = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
    while ((a = ar.exec(m[3] || ''))) attr[a[1].toLowerCase()] = ent(a[2] ?? a[3] ?? a[4] ?? '');
    const kn = { tag, attr, kinder: [], eltern: akt };
    akt.kinder.push(kn);
    if (ROH.has(tag)) {
      const ende = html.toLowerCase().indexOf('</' + tag, i);
      kn.kinder.push({ text: html.slice(i, ende < 0 ? html.length : ende) });
      const zu = ende < 0 ? html.length : html.indexOf('>', ende) + 1;
      i = zu; re.lastIndex = zu; continue;
    }
    if (!LEER.has(tag) && !m[4]) akt = kn;
  }
  return wurzel;
}
const klassen = (k) => (k.attr && k.attr.class ? k.attr.class.split(/\s+/) : []);
const hatKlasse = (k, c) => klassen(k).includes(c);
function alle(k, pr, aus = []) { for (const c of k.kinder || []) { if (c.tag) { if (pr(c)) aus.push(c); alle(c, pr, aus); } } return aus; }
function erstes(k, pr) { for (const c of k.kinder || []) { if (c.tag) { if (pr(c)) return c; const r = erstes(c, pr); if (r) return r; } } return null; }
function text(k, ohne) {
  if (k.text != null) return k.text;
  if (ohne && ohne(k)) return '';
  if (k.tag === 'script' || k.tag === 'style' || k.tag === 'svg') return '';
  return (k.kinder || []).map((c) => text(c, ohne)).join('');
}
const sauber = (s) => ent(String(s || '')).replace(/\s+/g, ' ').trim();

/* ═══ 2 · Die Module, die reine Daten tragen ═════════════════════════════ */
function kontext() {
  const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, appendChild() {}, setAttribute() {}, getAttribute() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {} });
  const document = { readyState: 'loading', head: el(), body: el(), documentElement: el(), getElementById() { return null; }, createElement: el, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {} };
  const w = { document, addEventListener() {}, setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, localStorage: { getItem() { return null; }, setItem() {} }, navigator: { userAgent: 'node' }, location: { href: '', search: '' }, console };
  w.window = w; w.self = w;
  return vm.createContext(w);
}
function lauf(datei, k) { new vm.Script(lies(datei), { filename: path.basename(datei) }).runInContext(k); }
/* Ein Literal aus einer Datei schneiden: ab `anfang` bis zur passenden Klammer. */
function literal(quelle, anfang) {
  const s = quelle.indexOf(anfang); if (s < 0) throw new Error('Anker fehlt: ' + anfang);
  let i = quelle.indexOf(anfang.trim().slice(-1) === '[' ? '[' : '{', s + anfang.length - 1);
  const auf = quelle[i], zu = auf === '[' ? ']' : '}'; let t = 0, str = null;
  for (let j = i; j < quelle.length; j++) {
    const c = quelle[j];
    if (str) { if (c === '\\') { j++; continue; } if (c === str) str = null; continue; }
    if (c === '/' && quelle[j + 1] === '*') { j = quelle.indexOf('*/', j + 2) + 1; continue; }
    if (c === '/' && quelle[j + 1] === '/') { j = quelle.indexOf('\n', j); continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === auf) t++; else if (c === zu) { t--; if (t === 0) return quelle.slice(i, j + 1); }
  }
  throw new Error('Literal nicht geschlossen: ' + anfang);
}
function funktion(quelle, kopf) {
  const s = quelle.indexOf(kopf); if (s < 0) throw new Error('Funktion fehlt: ' + kopf);
  return kopf.slice(0, kopf.lastIndexOf('{')) + literal(quelle.slice(s), kopf);
}

/* ═══ 3 · WOHER — die einzige handgepflegte Tabelle ══════════════════════
 * Nur, wo die Herkunft eines Wertes eindeutig ein Dokument ist. Alles andere
 * bleibt leer. Gewinnt NICHT gegen einen Hilfetext, der die Herkunft nennt. */
const WOHER_REGELN = [
  [/^(plz|ort|str|hnr)$/, 'Exposé oder Kaufvertragsentwurf'],
  [/^objart$/, 'Exposé'],
  [/^(wfl|zimmer|bad_anz|etage|etagen_ges)$/, 'Exposé, Wohnflächenberechnung oder Grundriss'],
  [/^baujahr$/, 'Exposé oder Energieausweis'],
  [/^einheiten$/, 'Exposé oder Mieterliste'],
  [/^mea$/, 'Teilungserklärung oder Grundbuchauszug'],
  [/^gsfl$/, 'Grundbuchauszug oder Flurkarte'],
  [/^ds2_energie$/, 'Energieausweis'],
  [/^kp$/, 'Exposé oder Kaufvertragsentwurf'],
  [/^(makler_p|makler)$/, 'Exposé (Käuferprovision)'],
  [/^(nkm|ze|uf)$/, 'Mietvertrag oder Mieterliste'],
  [/^(d[12]|d[12]z|d[12]t|d[12]_bindj)$/, 'Finanzierungsangebot der Bank'],
  [/^(hg_ul|hg_nul|hausgeld)/, 'Wirtschaftsplan oder Hausgeldabrechnung der WEG'],
  [/^(zve|grenz)$/, 'letzter Einkommensteuerbescheid'],
  [/^(brw)$/, 'Bodenrichtwertkarte (amtlich)']
];
const DOKUMENT = /(Energieausweis|Teilungserklärung|Kaufvertrag|Exposé|Mietvertrag|Mieterliste|Grundbuch\w*|Darlehensvertrag|Finanzierungsangebot|Steuerbescheid|Einkommensteuerbescheid|Hausgeldabrechnung|Wirtschaftsplan|Nebenkostenabrechnung|Betriebskostenabrechnung|Flurkarte|Baulastenverzeichnis|Bauakte|Gutachten|Mietspiegel|Bodenrichtwertkarte)/;
function woherAusText(t) {
  if (!t) return '';
  const saetze = String(t).replace(/<[^>]+>/g, '').split(/(?<=[.!?])\s+/);
  const s = saetze.find((x) => DOKUMENT.test(x) && /(steht|stehen|findest|aus dem|aus der|laut|im |in der )/i.test(x));
  return s ? s.trim() : '';
}

/* ═══ 4 · Die Ernte ═════════════════════════════════════════════════════ */
function ernte() {
  const html = lies(QUELLEN['index.html']);
  const root = baum(html);

  /* Reiter in der Reihenfolge der Leiste (data-target-sec), nur Eingabe-Reiter */
  const EINGABE = ['s0', 's1', 's2', 's3', 's4', 's3-tax'];
  const leiste = alle(root, (k) => k.tag === 'button' && k.attr['data-target-sec'] && hatKlasse(k, 'tab'));
  const reiterName = {}; leiste.forEach((b) => { reiterName[b.attr['data-target-sec']] = sauber(text(b)); });
  const reihenfolge = leiste.map((b) => b.attr['data-target-sec']).filter((s) => EINGABE.includes(s));

  /* Hilfe: „Die Reiter im Objekt" */
  const help = lies(QUELLEN['help.js']);
  const kh = kontext(); const THEMEN = vm.runInContext('(' + literal(help, 'var HELP_TOPICS = [') + ')', kh);
  const reiterHilfe = {};
  (THEMEN.find((t) => t.id === 'reiter') || { sections: [] }).sections.forEach((s) => {
    const name = String(s.h).split(' — ')[0].trim();
    reiterHilfe[name] = { titel: s.h, text: s.body };
  });

  /* Tour: der Schritt, der auf den Reiter zeigt */
  const kt = kontext(); lauf(QUELLEN['tour-content.js'], kt);
  const tour = {}; (kt.DpTourVariants && kt.DpTourVariants.withObjects || []).forEach((s) => {
    const m = /data-target-sec="([^"]+)"\]$/.exec(String(s.selector || '').trim());
    if (m && !tour[m[1]]) tour[m[1]] = { titel: s.title, text: s.body };
  });

  /* Tooltips */
  const ktt = kontext(); lauf(QUELLEN['tooltip-content.js'], ktt);
  const TIPS = (ktt.DpTooltips && ktt.DpTooltips.content) || {};

  /* Readycheck */
  const rc = lies(QUELLEN['deal-action-readycheck.js']);
  const ZIELE = vm.runInContext('(' + literal(rc, 'var FIELD_TARGETS = {') + ')', kontext());
  const RCLAB = vm.runInContext('(' + literal(rc, 'var LABELS = {') + ')', kontext());
  const readycheck = {}; Object.keys(ZIELE).forEach((k) => { readycheck[ZIELE[k][0]] = RCLAB[k] || k; });

  /* DS2-Liste der Feld-Hilfe */
  const fh = lies(QUELLEN['feld-hilfe.js']);
  const DS2 = vm.runInContext('(' + literal(fh, 'var DS2 = [') + ')', kontext());

  /* pflichtFuer — die ECHTE Funktion, mit einem _v, das nur die Objektart kennt */
  const orq = lies(QUELLEN['objekt-reiter.js']);
  const pfSrc = funktion(orq, 'function pflichtFuer(stufe, artOpt, garOpt) {');
  const pflichtFuer = vm.runInContext('(function(){ var _v = function(){ return ""; }; ' + pfSrc + ' return pflichtFuer; })()', kontext());

  const konst = JSON.parse(lies(KONST)).daten;

  /* Wirkungs-Module: liest das Modul das Feld per Id? */
  const ui = lies(QUELLEN['ui.js']);
  const aiA = ui.indexOf('function _buildAIPayload()'), aiE = ui.indexOf('function _formatAIError', aiA);
  const MODULE = [
    ['calc.js', lies(QUELLEN['calc.js']), 'rechnet in den Kennzahlen mit (Cashflow, Renditen, DSCR · Reiter Bewertung)'],
    ['ui.js', ui.slice(aiA, aiE), 'geht in die Pilot-Analyse ein'],
    ['pdf.js', lies(QUELLEN['pdf.js']), 'steht im Investment-PDF'],
    ['pdf-investment-bank.js', lies(QUELLEN['pdf-investment-bank.js']), 'steht im Bank-PDF (Investment Case)'],
    ['financing-pdf.js', lies(QUELLEN['financing-pdf.js']), 'steht im Finanzierungs-PDF'],
    ['werbungskosten-pdf.js', lies(QUELLEN['werbungskosten-pdf.js']), 'steht im Werbungskosten-PDF'],
    ['pdf-anlage-bmf.js', lies(QUELLEN['pdf-anlage-bmf.js']), 'geht in die BMF-Kaufpreisaufteilung (Anlage)'],
    ['pdf-kaufpreisaufteilung.js', lies(QUELLEN['pdf-kaufpreisaufteilung.js']), 'steht im PDF Kaufpreisaufteilung']
  ];
  const liest = (q, id) => new RegExp('\\(\\s*[\'"]' + id.replace(/[$]/g, '\\$') + '[\'"]\\s*\\)').test(q);

  /* ── Felder je Reiter aus index.html ── */
  const OHNE = (k) => k.tag === 'button' || hatKlasse(k, 'ds2-tag') || hatKlasse(k, 'oe-lk-tag') || hatKlasse(k, 'info-tag') || hatKlasse(k, 'oe-opt') || hatKlasse(k, 'sfx') || k.tag === 'select' || k.tag === 'input' || k.tag === 'textarea';
  const felder = {}; const reiter = []; const auffaellig = [];
  for (const sec of reihenfolge) {
    const s = erstes(root, (k) => k.attr && k.attr.id === sec);
    if (!s) continue;
    const titel = erstes(s, (k) => hatKlasse(k, 'sec-title'));
    const desc = erstes(s, (k) => hatKlasse(k, 'sec-desc'));
    const name = reiterName[sec];
    const r = { sec, name, titel: titel ? sauber(text(titel)) : name, desc: desc ? sauber(text(desc)) : '',
      hilfe: reiterHilfe[name] || null, tour: tour[sec] || null, karten: [] };
    const kasten = alle(s, (k) => hatKlasse(k, 'f'));
    const gesehen = new Set();
    for (const f of kasten) {
      const ein = erstes(f, (k) => (k.tag === 'input' || k.tag === 'select' || k.tag === 'textarea') && k.attr.id && k.attr.type !== 'hidden');
      if (!ein || gesehen.has(ein.attr.id)) continue;
      const id = ein.attr.id; gesehen.add(id);
      /* Karte: naechster Vorfahr .card, Titel .ct/.card-title */
      let k = f.eltern, karte = null; while (k) { if (hatKlasse(k, 'card')) karte = k; k = k.eltern; }
      let kt2 = '';
      if (karte) { const t = erstes(karte, (x) => hatKlasse(x, 'ct') || hatKlasse(x, 'card-title')); kt2 = t ? sauber(text(t, (x) => hatKlasse(x, 'ct-ico') || x.tag === 'button' || hatKlasse(x, 'oe-ct-hint'))) : ''; }
      const lab = erstes(f, (x) => x.tag === 'label');
      const label = lab ? sauber(text(lab, OHNE)).replace(/\*/g, '').replace(/\s+[·|]\s*$/, '').trim() : '';
      const tipBtn = erstes(f, (x) => x.attr && x.attr['data-tip-id']);
      const tipId = tipBtn ? tipBtn.attr['data-tip-id'] : null;
      let tip = tipId && TIPS[tipId] ? TIPS[tipId] : null;
      /* Ein Hilfetext, der zu einem ANDEREN Feld gehoert (gemessen: d1z traegt
         tab5.zinsbindung), erklaert hier das Falsche - er faellt weg und wird
         gemeldet. Passend heisst: ein Wort (ab 4 Zeichen) aus dem Titel steht
         in der Beschriftung, oder die Tip-Id endet auf die Feld-Id. */
      if (tip && lab) {
        const lt = sauber(text(lab, OHNE)).toLowerCase(); const tt = String(tip.title || '').toLowerCase();
        const passt = tipId.split('.').pop() === id || tt.split(/[^a-zäöüß0-9]+/).some((w) => w.length >= 4 && lt.includes(w.slice(0, Math.max(4, w.length - 2))))
          || lt.split(/[^a-zäöüß0-9]+/).some((w) => w.length >= 4 && tt.includes(w));
        if (!passt) { auffaellig.push(id + ' trägt den Hilfetext ' + tipId + ' („' + tip.title + '“)'); tip = null; }
      }
      const hint = erstes(f, (x) => hatKlasse(x, 'hint') || hatKlasse(x, 'cf-hint') || hatKlasse(x, 'dz-sub'));
      const sfx = erstes(f, (x) => hatKlasse(x, 'sfx'));
      const optionen = ein.tag === 'select' ? alle(ein, (x) => x.tag === 'option').map((o) => ({ wert: o.attr.value ?? sauber(text(o)), text: sauber(text(o)) })).filter((o) => o.text) : null;
      const typ = ein.tag === 'select' ? 'auswahl' : ein.tag === 'textarea' ? 'text' : (ein.attr.type === 'checkbox' ? 'haken' : (ein.attr.type === 'date' ? 'datum' : (/decimal|numeric/.test(ein.attr.inputmode || '') || ein.attr.type === 'number' ? 'zahl' : 'text')));
      const ds2 = !!erstes(f, (x) => hatKlasse(x, 'ds2-tag')) || DS2.includes(id);
      const titelAttr = (lab && lab.attr.title) || ein.attr.title || '';
      const wirkung = [];
      /* Marken an der Beschriftung erklaeren ihre Wirkung im title (Lageklasse → Zielrendite, WEG-Ruecklage → nur Info) */
      if (lab) alle(lab, (x) => (hatKlasse(x, 'oe-lk-tag') || hatKlasse(x, 'info-tag')) && x.attr.title).forEach((x) => wirkung.push(sauber(x.attr.title)));
      if (ds2) wirkung.push('geht in den Investor Deal Score');
      if (readycheck[id]) wirkung.push('zählt im Readycheck der Deal-Aktion (' + readycheck[id] + ')');
      if (/^mod_/.test(id)) wirkung.push('Modernisierungspunkte nach Anlage 2 ImmoWertV (Restnutzungsdauer)');
      if (/^eq_/.test(id)) wirkung.push('Vorschlag der Standardstufe je Gewerk (Anlage 4 ImmoWertV)');
      for (const [, q, satz] of MODULE) if (liest(q, id)) wirkung.push(satz);
      const quellText = [tip && tip.body, titelAttr, hint && text(hint)].filter(Boolean).join(' ');
      let woher = woherAusText(quellText);
      if (!woher) { const r2 = WOHER_REGELN.find(([re]) => re.test(id)); if (r2) woher = r2[1]; }
      felder[id] = {
        id, reiter: sec, karte: kt2, label: label || (tip && tip.title) || id,
        typ, einheit: sfx ? sauber(text(sfx)) : '', platzhalter: ein.attr.placeholder || '',
        optionen, hinweis: hint ? sauber(text(hint)) : '', titel: sauber(titelAttr),
        tip: tip ? { titel: tip.title || '', text: String(tip.body || '').replace(/<[^>]+>/g, ''), beispiel: tip.example || '', paragraf: tip.paragraph || '' } : null,
        ds2, pflichtMarke: !!(lab && hatKlasse(lab, 'dp-required')), woher, wirkung
      };
      let kartenEintrag = r.karten.find((x) => x.titel === kt2);
      if (!kartenEintrag) { kartenEintrag = { titel: kt2, felder: [] }; r.karten.push(kartenEintrag); }
      kartenEintrag.felder.push(id);
    }
    reiter.push(r);
  }

  /* ── Wohnungsliste (MFH) aus mfh-einheiten.js ── */
  const mfh = lies(QUELLEN['mfh-einheiten.js']);
  const SCHRITTE = vm.runInContext('(' + literal(mfh, 'var SCHRITTE = [') + ')', kontext());
  const karteA = mfh.indexOf("ov.innerHTML = '<div class=\"mfh-we-karte\""), karteE = mfh.indexOf('document.body.appendChild(ov);', karteA);
  const kq = mfh.slice(karteA, karteE);
  const wFelder = []; let block = 'Stammdaten';
  const reW = /blk\('[a-z]*',\s*'([^']+)'|<h4>([^<]+)<\/h4>|\b([fsd])\('([a-z_]+)',\s*'([^']+)'(?:,\s*'([^']*)')?/g; let mm;
  while ((mm = reW.exec(kq))) {
    if (mm[1] || mm[2]) { block = sauber((mm[1] || mm[2]).replace(/<[^>]+>/g, ' ')); continue; }
    wFelder.push({ key: mm[4], label: mm[5], block, typ: mm[3] === 's' ? 'auswahl' : mm[3] === 'd' ? 'datum' : 'eingabe', platzhalter: mm[3] === 'f' ? (mm[6] || '') : '' });
  }
  const wHinweise = [...kq.matchAll(/<p class="mfh-we-hint">([\s\S]*?)<\/p>/g)].map((x) => sauber(x[1].replace(/'\s*\+\s*'/g, '').replace(/<[^>]+>/g, '').replace(/'\s*\+[^+]*\+\s*'/g, ' … ')));
  const s2a = mfh.indexOf('function schritt2()'); const s2 = mfh.slice(s2a, mfh.indexOf('function schritt3', s2a));
  const s2text = sauber((/'<div[^>]*>(Hier nur[^<]*(?:<b>[^<]*<\/b>[^<]*)*)<\/div>'/.exec(s2) || [, ''])[1].replace(/<[^>]+>/g, ''));
  const spalten = [...s2.matchAll(/<th[^>]*>([^<]*)/g)].map((x) => sauber(x[1])).filter(Boolean);
  const kopfA = mfh.indexOf('Schritt 1 Gebaeude'), kopfE = mfh.indexOf('KEIN eigener Rechenkern', kopfA);
  const schrittBeschreibung = mfh.slice(kopfA, kopfE).split(/\n\s*Schritt \d /).map((x) => x.replace(/^\s*Schritt \d /, '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    .map((x) => x.replace(/^(Gebaeude|Einheiten|Zustand|Ergebnis)\s+/, '').replace(/Gebaeude/g, 'Gebäude').replace(/Baeder/g, 'Bäder').replace(/Aussenwand/g, 'Außenwand')
      .replace(/flaechen- gewichtet/g, 'flächengewichtet').replace(/Uebernahme/g, 'Übernahme').replace(/fuer/g, 'für').replace(/„wie Gebäude"/g, '„wie Gebäude“'))
    .map((x) => (/^die Liste wie bisher/.test(x) ? s2text : x));
  /* Die Hilfe kennt die Wohnung schon: Thema „Mieterhöhung und Zielbild" */
  const zielHilfe = ((THEMEN.find((t) => t.id === 'zielbild') || { sections: [] }).sections || []).map((x) => ({ titel: x.h, text: x.body }));
  const wohnungsliste = { schritte: SCHRITTE.map((t, i) => ({ titel: t, text: schrittBeschreibung[i] || '' })), einstieg: s2text, spalten, felder: wFelder, hinweise: wHinweise, hilfe: zielHilfe };

  /* ── Kapitel je Objektart ── */
  const auf = fs.existsSync(AUFNAHME) ? JSON.parse(lies(AUFNAHME)) : null;
  const ARTEN = konst.objektarten;
  const ALLE_ART_FELDER = new Set(Object.values(ARTEN).flatMap((a) => a.passt));
  /* Zweite handgepflegte Stelle (neben WOHER_REGELN): wie die Aufnahme die Zusatzfelder
     eingeblendet hat (frontend/handbuch/aufnahme.js AUSWAHL) - in den Worten der Oberflaeche. */
  const AUSWAHL_TEXT = {
    s0: 'Haken „Erbbaurecht / Erbpacht“ gesetzt',
    s1: 'Haken „Inventar erfassen“ gesetzt',
    s3: 'Haken „Eigene Anschlussfinanzierung für Darlehen 1“, Art des Darlehens „Tilgungsaussetzungsdarlehen (mit Bausparvertrag)“, Darlehen II „Hinzufügen“ und dessen Anschlussfinanzierung',
    s4: 'Eingabe-Modus „% der NKM“',
    's3-tax': 'Haken „§ 7b Sonder-AfA aktivieren“ gesetzt'
  };
  /* Warum ein Feld ohne Bild bleibt - gemessen bei der Aufnahme v2560 */
  const UEBERF = 'Erscheint nur bei einem Objekt, das über „Deal-Aktion → Überführung starten“ aus dem Privatbestand überführt wurde. Das braucht ein gespeichertes Objekt; im Aufnahme-Tab ist Speichern gesperrt, deshalb kein Bild.';
  const GRUENDE = {
    verkehrswert_ueberf: UEBERF, ueberf_preis: UEBERF, halter_seit: UEBERF, gesellschafterdarlehen: UEBERF, ueberf_restschuld: UEBERF, ueberf_rest_zins: UEBERF, ueberf_ende: UEBERF,
    ausst: 'Altfeld, ersetzt durch die Standardstufe (NHK 2010). Die App blendet es nicht mehr ein; gespeicherte Werte bleiben lesbar.',
    bwk_kp_pct: 'Erscheint im Eingabe-Modus „% der NKM“ erst mit der Unterwahl „% vom Kaufpreis“ und ersetzt dann die beiden NKM-Quoten — es steht nie zusammen mit ihnen im Bild.'
  };
  const KAPITEL = [['ETW', 'Eigentumswohnung'], ['EFH', 'Einfamilienhaus'], ['MFH', 'Mehrfamilienhaus']];
  const kapitel = KAPITEL.map(([art, name]) => {
    const passt = new Set(ARTEN[art].passt);
    const pf = { 1: pflichtFuer(1, art, ''), 2: pflichtFuer(2, art, ''), 3: pflichtFuer(3, art, '') };
    const gem = auf && auf.arten && auf.arten[art];
    const schritte = reiter.map((r) => {
      const ids = r.karten.flatMap((k) => k.felder).filter((id) => !ALLE_ART_FELDER.has(id) || passt.has(id));
      let sichtbar = ids, weitere = [], extra = [];
      const g = (gem && gem.reiter && gem.reiter[r.sec]) || null;
      if (g) {
        const vis = new Set((g.sichtbar || []).concat((g.extra && g.extra.felder) || []));
        /* Gemessen sichtbar (auch nach einer Auswahl) → Hauptliste in Bildreihenfolge; nur bei
           ANDEREN Arten sichtbar → gehoert nicht hierher; nirgends sichtbar → „weitere“ mit Grund. */
        const sonst = new Set(Object.entries(auf.arten).filter(([a]) => a !== art)
          .flatMap(([, x]) => { const y = x.reiter && x.reiter[r.sec]; return y ? (y.sichtbar || []).concat((y.extra && y.extra.felder) || []) : []; }));
        sichtbar = (g.sichtbar || []).filter((id) => felder[id] && (!ALLE_ART_FELDER.has(id) || passt.has(id)));
        extra = ((g.extra && g.extra.felder) || []).filter((id) => felder[id]);
        weitere = ids.filter((id) => !vis.has(id) && !sonst.has(id));
      }
      const stufe = (id) => (pf[1].includes(id) ? 1 : pf[2].includes(id) ? 2 : pf[3].includes(id) ? 3 : 0);
      const artPflicht = (ARTEN[art].pflicht || []);
      const nr = Object.assign({}, (g && g.nummer) || {}, (g && g.extra && g.extra.nummer) || {});
      const eintrag = (id, i, nachAuswahl) => ({ id, nr: nr[id] || i + 1, stufe: stufe(id), artPflicht: artPflicht.includes(id), artHinweis: (ARTEN[art].hinweis || {})[id] || '', nachAuswahl: !!nachAuswahl });
      return {
        sec: r.sec,
        auswahl: extra.length ? (AUSWAHL_TEXT[r.sec] || '') : '',
        felder: sichtbar.map((id, i) => eintrag(id, i, false)).concat(extra.map((id, i) => eintrag(id, sichtbar.length + i, true))),
        weitere: weitere.map((id) => ({ id, stufe: stufe(id), grund: GRUENDE[id] || '' })),
        bilder: ((g && g.bilder) || []).concat(((g && g.extra && g.extra.bilder) || []).map((b) => Object.assign({ nachAuswahl: true }, b))),
        mobil: (g && g.mobil && g.mobil.bilder) || []
      };
    });
    return { art, name, beispiel: (gem && gem.beispiel) || null, pflicht: pf, schritte, wohnungsliste: art === 'MFH', wohnungBilder: (art === 'MFH' && gem && gem.wohnungen) || [] };
  });

  const quellen = {}; for (const [n, p] of Object.entries(QUELLEN)) quellen[n] = summe(p);
  return { version: 'v2555', quellen, reiter, felder, kapitel, wohnungsliste, auffaellig, aufnahme: auf ? { am: auf.am, ansicht: auf.ansicht } : null };
}

/* ═══ v2574 · Teil „Schritt für Schritt" ══════════════════════════════════
 * Die Abläufe sind Prosa (tools/handbuch-ablaeufe.mjs). Jeder Schritt trägt
 * Belege [Datei, Text]; hier wird geprüft, dass der Text in der Datei steht —
 * roh, nach \uXXXX-Auflösung oder nach HTML-Entitäten. Fehlt einer, ist das
 * Handbuch ROT (beim Schreiben wie beim Prüfen): ein Knopf ist weg oder
 * umbenannt, und der Ablauf muss nachgezogen werden. */
function ablaeufePruefen() {
  const cache = {};
  const fassungen = (datei) => {
    if (cache[datei]) return cache[datei];
    const p = path.join(WURZEL, datei);
    if (!fs.existsSync(p)) return (cache[datei] = null);
    const roh = lies(p);
    const u = roh.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    return (cache[datei] = [roh, u, ent(u)]);
  };
  const fehlen = []; let n = 0;
  const ablaeufe = ABLAEUFE.map((a) => {
    a.schritte.forEach((s, i) => {
      if (!s.belege || !s.belege.length) fehlen.push(a.id + ' Schritt ' + (i + 1) + ': ohne Beleg');
      (s.belege || []).forEach(([datei, txt]) => {
        n++; const f = fassungen(datei);
        if (!f) fehlen.push(a.id + ' Schritt ' + (i + 1) + ': Datei fehlt ' + datei);
        else if (!f.some((x) => x.includes(txt))) fehlen.push(a.id + ' Schritt ' + (i + 1) + ': „' + txt + '“ nicht in ' + datei);
      });
    });
    (a.bilder || []).forEach((b) => { if (!fs.existsSync(path.join(FE, 'handbuch', 'bilder', b.datei))) fehlen.push(a.id + ': Bild fehlt ' + b.datei); });
    /* Ausgeliefert wird der Text; die Belege bleiben als Datei:Text-Liste lesbar dabei */
    return { id: a.id, titel: a.titel, kurz: a.kurz, wann: a.wann || '', hinweis: a.hinweis || '', bilder: a.bilder || [], siehe: a.siehe || [],
      schritte: a.schritte.map((s) => ({ t: s.t, kosten: s.kosten || '', plan: s.plan || '', belege: (s.belege || []).map(([d, t]) => d.replace(/^frontend\//, '') + ': ' + t) })) };
  });
  return { ablaeufe, fehlen, belege: n };
}
const ABL = ablaeufePruefen();
if (ABL.fehlen.length) {
  console.log('ROT · Schritt für Schritt: ' + ABL.fehlen.length + ' Beleg(e) nicht gefunden — Ablauf in tools/handbuch-ablaeufe.mjs nachziehen:');
  ABL.fehlen.forEach((x) => console.log('  - ' + x));
  process.exit(1);
}

const daten = ernte();
daten.ablaeufe = ABL.ablaeufe;
const ausgabe = '/* Erzeugt von tools/handbuch-erzeugen.mjs — NICHT von Hand aendern. */\nwindow.DP_HANDBUCH = ' + JSON.stringify(daten, null, 1) + ';\n';
const zaehl = daten.kapitel.map((k) => k.art + ' ' + k.schritte.reduce((s, x) => s + x.felder.length, 0) + '+' + k.schritte.reduce((s, x) => s + x.weitere.length, 0)).join(' · ')
  + ' · Abläufe ' + ABL.ablaeufe.length + ' (' + ABL.ablaeufe.reduce((s, a) => s + a.schritte.length, 0) + ' Schritte, ' + ABL.belege + ' Belege)';
if (nurPruefen) {
  const alt = fs.existsSync(ZIEL) ? lies(ZIEL) : '';
  const m = /"quellen": (\{[\s\S]*?\})/.exec(alt);
  const altQ = m ? JSON.parse(m[1]) : {};
  const abw = Object.keys(daten.quellen).filter((k) => altQ[k] !== daten.quellen[k]);
  if (abw.length) { console.log('ROT · Handbuch veraltet, Quellen geaendert: ' + abw.join(', ') + ' → node tools/handbuch-erzeugen.mjs'); process.exit(1); }
  console.log('GRUEN · Handbuch passt zu den Quellen (' + zaehl + ')'); process.exit(0);
}
fs.mkdirSync(path.dirname(ZIEL), { recursive: true });
fs.writeFileSync(ZIEL, ausgabe);
console.log('geschrieben: ' + path.relative(WURZEL, ZIEL) + ' · ' + Object.keys(daten.felder).length + ' Felder in ' + daten.reiter.length + ' Reitern · Kapitel ' + zaehl + ' · Wohnungsliste ' + daten.wohnungsliste.felder.length + ' Felder' + (daten.aufnahme ? '' : ' · OHNE Aufnahme (aufnahme.json fehlt)'));
