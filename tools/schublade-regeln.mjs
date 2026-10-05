/* Erzeugt den Handy-Schublade-Block in frontend/css/layout-varianten.css neu.
   Aufruf: node <dieses Skript>   (aus E:\DealPilot\repo)

   Warum: die Aktenmappe gestaltet ihre Objektliste mit Regeln, die alle an
   `.dpl-schiene` haengen. Auf dem Handy nimmt die Schiene seit v1880 nichts,
   die Liste liegt in `aside#sidebar` - keine dieser Regeln greift dort, und
   die Liste faellt auf die Gestaltung der Ansicht "Heute" zurueck (Marcel am
   05.10.2026: "irgendeine Mischung aus einer Objektkartei von unserer heutigen
   Ansicht und dieser Aktenansicht ... das ist ja mal gar nichts").

   Das Skript kopiert die Regeln mit dem Anker `aside#sidebar` - erst die
   Grundgestaltung, dann die sieben Objektkarten-Stile (spaeter = gewinnt bei
   Gleichstand) - und haengt die Handy-Korrekturen an. Alles in EINEM
   @media (max-width: 900px), damit der Desktop unberuehrt bleibt.

   Bei Aenderungen an den Originalregeln dieses Skript erneut laufen lassen. */
import fs from 'fs';

const P = 'frontend/css/layout-varianten.css';
const MARKE = '/* ═══ v1885 · DIE AKTENMAPPE AUF DEM HANDY';
let s = fs.readFileSync(P, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';

/* frueheren Block (dieses Skript oder den Vorlaeufer v1883a) abschneiden */
for (const alt of [MARKE, '/* v1883a · Objektkarten-Stile in der Liste']) {
  const i = s.indexOf(alt);
  if (i > 0) s = s.slice(0, i).replace(/\s+$/, '') + nl;
}

/* ── Regeln einsammeln ───────────────────────────────────────────────── */
const re = /([^{}]*?)\{([^{}]*)\}/g;
const PRE = '.dpl-schiene';
const TEILE = /(sb-card|#sb-list|sb-section-title|sb-search|sb-sort|sb-wm|sb-count|sbc-)/;
const grund = [], stile = [];
let m;
while ((m = re.exec(s))) {
  let sel = m[1].trim();
  const i = sel.lastIndexOf('*/');          // Kommentar vor dem Selektor abschneiden
  if (i >= 0) sel = sel.slice(i + 2).trim();
  if (!sel || /@media|@container|@supports/.test(sel)) continue;
  if (/data-stellung=/.test(sel)) continue; // andere Schienen-Stellungen, nicht die Schublade
  const istStil = /data-dp-objkarte=/.test(sel);
  const teile = sel.split(',').map(x => x.trim())
    .filter(x => x.includes(PRE) && (istStil || TEILE.test(x)))
    .map(x => x.replace(PRE, 'aside#sidebar'));
  if (!teile.length) continue;
  const body = m[2].trim().replace(/\s*\r?\n\s*/g, ' ');
  if (!body) continue;
  (istStil ? stile : grund).push('  ' + teile.join(',' + nl + '  ') + ' { ' + body + ' }');
}

/* ── Handy-Korrekturen (gemessen 390 px, siehe Journal 45) ───────────── */
const korrektur = [
  '',
  '  /* (1) Der Kopf der Ansicht "Heute" gehoert nicht in die Aktenmappe: das gerahmte Logo (303 x 78) steht',
  '         doppelt, die Marke traegt schon die Schiene daruber (78 x 78), und die Knopfzeile Quick-Check /',
  '         Marktbericht ist in der Aktenmappe der Aktionsblock. Beides weg - die Liste beginnt oben.',
  '         Die Kette braucht zwei Attribute und body: die Regel in style.css traegt eine ID und drei',
  '         Klassen (1,3,2) und schlug die kuerzere Fassung. */',
  '  html[data-dp-layout][data-dp-layout] body aside.sidebar#sidebar .sb-header,',
  '  html[data-dp-layout][data-dp-layout] body aside.sidebar#sidebar .sb-neu-row { display: none !important; }',
  '',
  '  /* (2) Die Suchzeile: das Eingabefeld ist 44 px hoch (iOS-Zoomschutz erzwingt 16 px Schrift und 40 px',
  '         Hoehe), seine Umrahmung .sb-search-box aber 30 - das Feld stand sichtbar ausserhalb seines Rahmens',
  '         (Marcel: "das Suchfeld ist viel groesser, dann ist da gar keine Umrahmung drum"). Die Zeile wird',
  '         zweizeilig: Titel und Werkzeuge oben, die Suche darunter ueber die volle Breite. */',
  '  html[data-dp-layout] aside#sidebar .sb-section-title { display: grid !important; grid-template-columns: minmax(0, 1fr) auto !important; align-items: center !important; row-gap: 8px !important; padding: 12px 14px !important; }',
  '  html[data-dp-layout] aside#sidebar .sb-section-title > span { grid-row: 1 !important; grid-column: 1 !important; }',
  '  html[data-dp-layout] aside#sidebar .sb-section-title .sb-tools-group { grid-row: 1 !important; grid-column: 2 !important; }',
  '  html[data-dp-layout] aside#sidebar .sb-section-title .sb-search-box { grid-row: 2 !important; grid-column: 1 / -1 !important; height: auto !important; min-height: 44px !important; width: auto !important; max-width: none !important; box-sizing: border-box !important; padding: 0 12px !important; display: flex !important; align-items: center !important; gap: 8px !important; }',
  '  html[data-dp-layout] aside#sidebar .sb-section-title .sb-search-box input { height: 42px !important; min-height: 42px !important; width: 100% !important; max-width: none !important; background: transparent !important; border: 0 !important; padding: 0 !important; }',
  '',
  '  /* (3) Der Aktionsblock traegt in der Schublade den Platz, den in der Schiene die Teile haben. */',
  '  html[data-dp-layout] aside#sidebar #sb-actions-trigger-btn { margin: 8px 12px !important; }',
].join(nl);

const block = [
  MARKE + ' (05.10.2026) ════════════════════════════════════════',
  '   Erzeugt von tools/schublade-regeln.mjs - NICHT von Hand aendern, sondern das Skript laufen lassen.',
  '',
  '   Die Aktenmappe gestaltet ihre Objektliste ueber `.dpl-schiene`. Auf dem Handy nimmt die Schiene seit',
  '   v1880 nichts mehr, die Liste liegt in `aside#sidebar` - also griff dort KEINE dieser Regeln, und die',
  '   Liste sah aus wie in der Ansicht "Heute" (Foto, grosse Kacheln, Heute-Kopf). Marcel am 05.10.2026:',
  '   "das ist irgendeine Mischung aus einer Objektkartei von unserer heutigen Ansicht und dieser',
  '   Aktenansicht. Also das ist ja mal gar nichts." Hier stehen dieselben Regeln mit dem Anker',
  '   `aside#sidebar`: ' + grund.length + ' fuer die Grundgestaltung, ' + stile.length + ' fuer die sieben Objektkarten-Stile',
  '   (spaeter, damit sie bei Gleichstand gewinnen), dazu die gemessenen Handy-Korrekturen.',
  '   ════════════════════════════════════════════════════════════════════════════════════════════ */',
  '@media (max-width: 900px) {',
  ...grund,
  '',
  '  /* ── die sieben Objektkarten-Stile (Aktenreiter, Bordkarte, Score-Kante, Datenzeile, Ampel,',
  '     Kennzahlen, Minimal) ─────────────────────────────────────────────────────────────────── */',
  ...stile,
  korrektur,
  '}',
].join(nl);

fs.writeFileSync(P, s + nl + block + nl);

/* ── Selbstpruefung: zaehlt der Parser so viele Regeln, wie geschrieben wurden? ──
   Klammern zaehlen reicht NICHT: ein Kommentar, der im Block wieder aufgeht (ein
   Satz hinter dem schliessenden Sternchen-Schraegstrich), frisst still die naechste
   Regel - genau so verschwand am 05.10.2026 die Kopf-Regel, obwohl sie in der Datei
   stand und die Klammerbilanz stimmte. */
const geschrieben = grund.length + stile.length + korrektur.split(nl).filter(z => /\{.*\}/.test(z)).length;
const text = fs.readFileSync(P, 'utf8');
const ab = text.indexOf(MARKE);
const meinBlock = text.slice(ab);
const offen = (meinBlock.match(/\/\*/g) || []).length;
const zu = (meinBlock.match(/\*\//g) || []).length;
const regeln = (meinBlock.replace(/\/\*[\s\S]*?\*\//g, '').match(/\{[^{}]*\}/g) || []).length;
console.log('Grundregeln:', grund.length, '· Stilregeln:', stile.length, '· Korrekturen:', geschrieben - grund.length - stile.length);
console.log('Kommentare auf/zu:', offen, zu, offen === zu ? 'ok' : 'FEHLER');
console.log('Regeln im Block nach Kommentar-Abzug:', regeln, '(erwartet', geschrieben + ')', regeln === geschrieben ? 'ok' : 'FEHLER');
if (offen !== zu || regeln !== geschrieben) process.exit(1);
