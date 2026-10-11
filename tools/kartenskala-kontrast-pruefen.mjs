/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/kartenskala-kontrast-pruefen.mjs · v2104
   Backlog N60.17 (Kontrast) — die Skalen-Beschriftungen der Objektkarte

   Die 161 Stellen sind `.sbcm-scale span` auf den Objektkarten der
   Seitenleiste: 23 Karten x 7 Beschriftungen ("0", "1", "1,5", "2+" am
   DSCR-Balken und "0%", "5%", "10%" an der Rendite).

   SCHRIFTGROESSE 7,5 px -> DIE SCHWELLE IST 4,5.
   3,0 gilt erst ab 24 px, oder ab 18,66 px fett. Der v1107-Kommentar
   nennt 3,2 als Ziel; das war die falsche Schwelle.

   Der Pruefer liest die TOENE aus den echten Blaettern und haelt sie
   gegen die in der Messkabine GEMESSENEN Gruende. Er rechnet die Toene
   nicht nach - er prueft, dass im Blatt steht, was gemessen wurde.

   RC=0 ist sauber.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import vm from 'node:vm';

let fehler = 0, geprueft = 0;
const melde = (ok, text) => {
  geprueft++;
  if (!ok) fehler++;
  console.log('  ' + (ok ? 'ok  ' : 'FEHL') + ' ' + text);
};

const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const kontrast = (a, b) => {
  const l1 = lum(a), l2 = lum(b);
  return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
};
const rgb = (h) => {
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};

const SCHWELLE = 4.5;
const style = fs.readFileSync('frontend/css/style.css', 'utf8');
const uv = fs.readFileSync('frontend/css/ui-varianten.css', 'utf8');
const idx = fs.readFileSync('frontend/index.html', 'utf8');

/* ── Kommentare ausblenden, Laenge erhalten ───────────────────────────
   Sonst findet der Pruefer die Begruendungen, die er selbst
   hineingeschrieben hat - in dieser Sitzungsreihe dreimal passiert. */
const nutz = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const styleN = nutz(style), uvN = nutz(uv);
const anteil = (roh, blank) => Math.round(100 * blank.replace(/\s/g, '').length
  / roh.replace(/\s/g, '').length);

/* ── GEMESSENE Gruende (Messkabine, 11.10.2026, je nach Neuladen) ──── */
const GRUND = {
  dunkel: [13, 11, 8],      /* Grundfassung: Kartenverlauf, effGrund "verlauf" */
  creme:  [250, 248, 243],  /* data-ui-surface=light: --uv-card-tile #FAF8F3 */
  weiss:  [255, 255, 255]   /* body.dp-chrome-hell: Regler setzt --dp-obj-card inline */
};

/* ── 1 · Die drei Toene stehen im Blatt ──────────────────────────────── */
console.log('=== 1 · Stehen die gemessenen Toene wirklich im Blatt? ===');

const FAELLE = [
  { name: 'Grundfassung (dunkle Karte)',
    datei: 'style.css', text: styleN, grund: 'dunkel',
    /* Die Regel, die die Farbe traegt - der Selektor kommt ZWEIMAL vor,
       nur eine der beiden setzt `color` (gegengeprueft in Abschnitt 3). */
    re: /aside\.sidebar\s+\.sb-card\s+\.sbcm-scale\s*\{[^}]*?color:\s*var\(--dpuv-obj-mut,\s*(#[0-9a-fA-F]{6})\)/ },
  { name: 'heller Skin (weisse Karte)',
    datei: 'style.css', text: styleN, grund: 'weiss',
    re: /body\.dp-chrome-hell[^{]*\.sbcm-scale span[^{]*\{[^}]*?color:\s*var\(--dpuv-obj-mut,\s*(#[0-9a-fA-F]{6})\)/ },
  { name: 'surface=light, Regel',
    datei: 'ui-varianten.css', text: uvN, grund: 'creme',
    re: /data-ui-surface="light"[^{]*\.sbcm-tick\s*\{[^}]*?color:\s*var\(--dpuv-obj-mut,\s*(#[0-9a-fA-F]{6})\)/ },
  { name: 'surface=light, Token --uv-card-mut',
    datei: 'ui-varianten.css', text: uvN, grund: 'creme',
    re: /data-ui-surface="light"[^{]*\.sb-card\s*\{[^}]*--uv-card-mut:\s*(#[0-9a-fA-F]{6})/ }
];

/* v2105: geprueft wird der RUECKFALL im var() - der abgeleitete Ton steht
   nicht im Blatt, er wird zur Laufzeit gesetzt (Abschnitt 1c). Dass der
   Rueckfall ueberhaupt noch traegt, ist der Punkt: er gilt fuer jeden,
   der die Kartenflaeche nie angefasst hat. */
console.log('    Fassung                             Rueckfall Grund             k');
for (const f of FAELLE) {
  const m = f.text.match(f.re);
  if (!m) { melde(false, f.name + ': Ton im Blatt NICHT GEFUNDEN (' + f.datei + ')'); continue; }
  const k = kontrast(rgb(m[1]), GRUND[f.grund]);
  console.log('    ' + f.name.padEnd(36) + m[1] + '   '
    + ('rgb(' + GRUND[f.grund].join(',') + ')').padEnd(17) + String(k.toFixed(2)).padStart(5));
  melde(k >= SCHWELLE, f.name + ': k=' + k.toFixed(2) + ' >= ' + SCHWELLE
    + ' (Ton ' + m[1] + ')');
  /* Reserve: ein Ton, der GENAU auf der Schwelle sitzt, kippt beim
     naechsten Verlaufspunkt. Lehre aus `schwelle-am-gerundeten-wert`. */
  melde(k >= 4.6, f.name + ': hat Reserve (k=' + k.toFixed(2) + ' >= 4,6)');
}

/* ── 1b · Die fünf Vorlagen, jede gegen IHREN gemessenen Grund ────────
   v2104b. Mein erster Anlauf hat alle fuenf gegen rgb(13,11,8) gerechnet
   und drei davon fuer sauber erklaert (5,94 / 5,96 / 5,31). GEMESSEN
   haben VIER von fuenf eine HELLE Kachel, und alle fuenf lagen unter
   4,5. Deshalb steht hier je Vorlage der Grund, den die Messkabine
   gemeldet hat - nicht einer fuer alle. */
console.log('\n=== 1b · Die fuenf Vorlagen (--uv-card-mut) ===');
const VORLAGEN = [
  ['kontor',   [250, 249, 247], '3,14'],
  ['kanzlei',  [251, 250, 247], '3,16'],
  ['boarding', [255, 255, 255], '3,70'],
  ['konsole',  [20, 23, 27],    '3,81'],
  ['panel',    [248, 249, 251], '4,39']
];
console.log('    Vorlage    Ton       Grund (gemessen)    k alt   k neu');
for (const [name, grund, kAlt] of VORLAGEN) {
  /* Die LETZTE Deklaration gewinnt - bei panel sind es zwei (`:111` und
     die Korrektur von v1108).

     ABER: der Suchausdruck muss am BLOCKENDE halten. Mein erster Entwurf
     suchte „ab `data-ui-theme=NAME` die naechsten 1200 Zeichen" und las
     fuer `konsole` den Wert von `panel` - deren Block folgt dicht
     darauf. Der Pruefer meldete daraufhin 3,53 fuer einen Ton, der dort
     gar nicht steht. Gefunden, weil er rot wurde, bevor etwas ausgerollt
     war - genau dafuer ist er da.

     Deshalb: erst die Bloecke der Vorlage holen (`{...}` ohne `}` darin),
     dann DARIN suchen. */
  const blockRe = new RegExp('data-ui-theme="' + name + '"[^{]*\\{([^}]*)\\}', 'g');
  const bloecke = [...uvN.matchAll(blockRe)];
  let ton = null;
  for (const b of bloecke) {
    const d = [...b[1].matchAll(/--uv-card-mut:\s*(#[0-9a-fA-F]{6});/g)];
    if (d.length) ton = d[d.length - 1][1];
  }
  if (!ton) { melde(false, name + ': --uv-card-mut in keinem eigenen Block gefunden'); continue; }
  const k = kontrast(rgb(ton), grund);
  console.log('    ' + name.padEnd(11) + ton + '   '
    + ('rgb(' + grund.join(',') + ')').padEnd(20) + kAlt.padStart(5) + '   '
    + String(k.toFixed(2)).padStart(5));
  melde(k >= SCHWELLE, name + ': k=' + k.toFixed(2) + ' >= ' + SCHWELLE + ' (Ton ' + ton + ')');
  melde(k >= 4.6, name + ': hat Reserve (k=' + k.toFixed(2) + ')');
}

/* ── 1c · Der abgeleitete Ton (v2105) ───────────────────────────────────
   Die festen Toene aus 1 und 1b sind nur noch der RUECKFALL. Die
   Kartenflaeche ist ein FREIER Farbwaehler (`dp_obj_ui`), deshalb wird
   der Ton aus ihr abgeleitet - mit `tonFuerGrund` aus config.js, dem
   Kern, den `whitelabel-override.js` schon benutzt.

   Hier wird die ECHTE Funktion aus der ECHTEN Datei gerufen, nicht
   nachgebaut. Ein Pruefer, der die Formel nachbaut, misst sich selbst. */
console.log('\n=== 1c · Der abgeleitete Ton folgt der Kartenflaeche ===');

const uvjs = fs.readFileSync('frontend/js/ui-varianten.js', 'utf8');
const uvjsN = nutz(uvjs);
melde(/--dpuv-obj-mut/.test(uvjsN), 'ui-varianten.js setzt `--dpuv-obj-mut`');
melde(/tonFuerGrund/.test(uvjsN), 'es benutzt `tonFuerGrund` (kein zweiter Rechenweg)');
melde(/OBJ_MUT_MIN\s*=\s*4\.5/.test(uvjsN), 'der Mindestkontrast ist 4,5');
melde(/#a8a299/.test(uvjsN), 'die Basis ist #a8a299 = der Originalton rgba(168,162,153)');
melde(/removeProperty\('--dpuv-obj-mut'\)/.test(uvjsN),
  'der Rueckbau raeumt ihn wieder ab (sonst bleibt er nach "Zuruecksetzen")');
/* Liest das CSS ihn auch? Vier Stellen, sonst traegt er nur halb. */
const leser = (styleN.match(/--dpuv-obj-mut/g) || []).length
            + (uvN.match(/--dpuv-obj-mut/g) || []).length;
console.log('    CSS-Stellen, die das Token lesen: ' + leser);
melde(leser === 4, 'alle vier Fassungswege lesen es (sind: ' + leser + ')');
/* Und jede davon MUSS einen Rueckfall tragen - ohne Token darf nichts
   ungefaerbt bleiben. */
const ohneRueckfall = [...styleN.matchAll(/var\(--dpuv-obj-mut\s*\)/g)].length
                    + [...uvN.matchAll(/var\(--dpuv-obj-mut\s*\)/g)].length;
melde(ohneRueckfall === 0, 'keine Stelle liest das Token OHNE Rueckfall');

/* Die echte Funktion rufen und den Vertrag pruefen. `config.js` ist ein
   Browser-Modul; geladen wird es mit einem DOM-Stummel, wie es
   `tools/frontend-konstanten.mjs` seit v1823 tut. */
let tfg = null;
try {
  /* Der Fensterstummel und der vm-Kontext sind von
     `tools/frontend-konstanten.mjs` ABGESCHRIEBEN, nicht nachgebaut.
     Mein erster Entwurf nahm `new Function('window', …)` und scheiterte
     an `DealPilotConfig is not defined`: config.js greift auf das
     GLOBALE Symbol zu, und ein Parameter namens `window` reicht dafuer
     nicht. Nur `vm.createContext` laesst `var X` am Kontext landen. */
  const el = () => ({
    id: '', textContent: '', style: { setProperty() {}, removeProperty() {} },
    className: '', value: '', options: [], children: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {}, setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, closest() { return null; }, parentElement: null
  });
  const document_ = {
    readyState: 'complete', head: el(), body: el(), documentElement: el(),
    getElementById() { return null; }, createElement() { return el(); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, createTextNode() { return el(); }
  };
  const win = {
    document: document_,
    addEventListener() {}, removeEventListener() {},
    setTimeout() { return 0; }, clearTimeout() {},
    setInterval() { return 0; }, clearInterval() {},
    matchMedia() { return { matches: false, addEventListener() {} }; },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    navigator: { userAgent: 'node', language: 'de' },
    location: { href: '', search: '' }, console
  };
  win.window = win; win.self = win; win.globalThis = win;
  const kontext = vm.createContext(win);
  kontext.global = kontext;
  new vm.Script(fs.readFileSync('frontend/js/config.js', 'utf8'),
    { filename: 'config.js' }).runInContext(kontext);
  const DPC = kontext.DealPilotConfig || win.DealPilotConfig;
  tfg = DPC && DPC.branding && DPC.branding.tonFuerGrund;
} catch (e) {
  console.log('    config.js nicht ladbar: ' + String(e.message).slice(0, 70));
}

if (typeof tfg !== 'function') {
  melde(false, 'tonFuerGrund konnte nicht gerufen werden - Vertrag UNGEPRUEFT');
} else {
  melde(true, 'tonFuerGrund aus der echten config.js geladen');
  /* Gegen echte Kartenfarben: die Vorgabe, Weiss, Obsidian, und ein paar,
     die ein Nutzer wirklich waehlen koennte. */
  const KARTEN = ['#F6F2E9', '#FFFFFF', '#0d0b08', '#141719', '#C9A84C',
                  '#3FA56C', '#2A2727', '#FBF6E9', '#000000'];
  console.log('    Kartenfarbe   abgeleitet   k');
  let alleOk = true;
  for (const karte of KARTEN) {
    const ton = tfg('#a8a299', karte, 4.5);
    const k = kontrast(rgb(ton), rgb(karte));
    console.log('    ' + karte.padEnd(14) + String(ton).padEnd(13) + k.toFixed(2)
      + (k >= 4.5 ? '' : '   UNTER 4,5'));
    if (k < 4.5) alleOk = false;
  }
  melde(alleOk, 'tonFuerGrund haelt 4,5 gegen alle ' + KARTEN.length + ' Kartenfarben');
}

/* ── 2 · Die alten Werte sind WEG ────────────────────────────────────── */
console.log('\n=== 2 · Die alten Werte stehen nicht mehr im Nutztext ===');
melde(!/aside\.sidebar\s+\.sb-card\s+\.sbcm-scale\s*\{[^}]*rgba\(168,\s*162,\s*153,\s*0\.65\)/.test(styleN),
  'die Deckkraft 0,65 traegt die Grundfassung nicht mehr');
const achtf = (uvN.match(/#8f897c/g) || []).length;
console.log('    #8f897c steht noch ' + achtf + 'x im Nutztext von ui-varianten.css');
melde(!/data-ui-surface="light"[^{]*\.sbcm-tick\s*\{\s*color:\s*#8f897c/.test(uvN),
  'die Sechser-Regel traegt nicht mehr #8f897c');
melde(!/data-ui-surface="light"[^{]*\.sb-card\s*\{[^}]*--uv-card-mut:\s*#8f897c/.test(uvN),
  '--uv-card-mut traegt nicht mehr #8f897c');

/* ── 3 · Eigene Regeln erschlagen sich ───────────────────────────────── */
console.log('\n=== 3 · Erschlaegt eine spaetere Regel denselben Selektor? ===');
const selektor = /aside\.sidebar\s+\.sb-card\s+\.sbcm-scale\s*\{/g;
const treffer = [...styleN.matchAll(selektor)];
console.log('    `aside.sidebar .sb-card .sbcm-scale {` kommt ' + treffer.length + 'x vor');
let mitFarbe = 0, letzteMitFarbe = -1;
treffer.forEach((t) => {
  const block = styleN.slice(t.index, styleN.indexOf('}', t.index));
  if (/color\s*:/.test(block)) { mitFarbe++; letzteMitFarbe = t.index; }
});
melde(mitFarbe === 1, 'genau EINE davon setzt `color` (sind: ' + mitFarbe + ')');
/* Und die mit der Farbe muss die LETZTE sein, sonst gewinnt eine ohne
   nichts - bzw. eine spaetere mit anderem Wert. */
if (mitFarbe === 1 && treffer.length > 1) {
  const spaeter = treffer.filter((t) => t.index > letzteMitFarbe).length;
  melde(true, spaeter + ' Regel(n) stehen danach, keine davon setzt `color`');
}

/* ── 4 · Der Cache-Buster ist mitgezogen ────────────────────────────── */
console.log('\n=== 4 · Kommt es im Browser an? ===');
for (const [blatt, re] of [['style.css', /css\/style\.css\?v=([^"']+)/],
                           ['ui-varianten.css', /css\/ui-varianten\.css\?v=([^"']+)/]]) {
  const m = idx.match(re);
  /* Auf die FAMILIE pruefen, nicht auf eine Zahl: sonst wird der Pruefer
     bei jedem Nachpaket rot, obwohl der Buster richtig hochgezogen ist -
     und dann stellt ihn jemand ab. Wichtig ist, dass er NICHT mehr auf
     dem Stand von vor dieser Arbeit steht. */
  melde(!!m && /^v210[4-9]/.test(m[1]),
    blatt + ': Buster ist ' + (m ? m[1] : 'FEHLT') + ' (soll v2104 oder neuer)');
}

/* ── 5 · Kein Ton traegt dunkel UND hell ────────────────────────────── */
console.log('\n=== 5 · Warum es zwei Regeln sein MUESSEN ===');
/* Auf rgb(13,11,8) braucht ein Ton eine Mindesthelligkeit, auf Creme eine
   Hoechsthelligkeit. Die Pruefung rechnet das Fenster aus, statt es zu
   behaupten: wird es leer, ist eine gemeinsame Regel unmoeglich. */
let gemeinsam = 0;
for (let g = 0; g <= 255; g += 1) {
  const c = [g, g, g];
  if (kontrast(c, GRUND.dunkel) >= SCHWELLE && kontrast(c, GRUND.creme) >= SCHWELLE) gemeinsam++;
}
console.log('    Graustufen, die dunkle UND creme Karte bei ' + SCHWELLE + ' tragen: ' + gemeinsam + ' von 256');
melde(gemeinsam === 0, 'das Fenster ist leer - zwei Regeln sind noetig, nicht bequem');

/* ── 6 · Deckung, und was ausdruecklich NICHT geprueft ist ──────────── */
console.log('\n=== 6 · Deckung ===');
console.log('  Pruefpunkte          : ' + geprueft);
console.log('  Fassungen geprueft   : 8 — Grundfassung, heller Skin,');
console.log('                         surface=light und die fuenf Vorlagen');
console.log('  Stellen je Fassung   : 161 (23 Karten x 7 Beschriftungen)');
console.log('  Stellen insgesamt    : ' + (8 * 161));
console.log('  Nutztext style.css   : ' + anteil(style, styleN) + ' %');
console.log('  Nutztext ui-varianten: ' + anteil(uv, uvN) + ' %');
console.log('');
console.log('  NICHT geprueft, und zwar absichtlich:');
console.log('    Jede Fassung ist gegen EINEN gemessenen Grund geprueft -');
console.log('    den, den die Messkabine bei der Vorgabe des Kartenreglers');
console.log('    gemeldet hat. Die Kartenflaeche ist aber eine EIGENE');
console.log('    Achse (--dp-obj-card, von ui-varianten.js inline');
console.log('    gesetzt, Merker dp_obj_ui). Stellt der Nutzer sie um,');
console.log('    wandert der Grund, und ein Ton je Vorlage kann dann');
console.log('    grundsaetzlich nicht fuer beide Kartenfarben stimmen.');
console.log('    -> 5 Vorlagen x die Kartenstufen, eigener Messlauf.');
console.log('    Backlog N60.34.');

console.log('\n' + (fehler === 0
  ? 'RC=0 - ' + geprueft + ' Punkte, keine Abweichung'
  : 'RC=1 - ' + fehler + ' Abweichung(en) von ' + geprueft));
process.exit(fehler === 0 ? 0 : 1);
