/* ══════════════════════════════════════════════════════════════════════
   DealPilot · tools/kerosin-nutztext-pruefen.mjs
   Backlog N60.24

   Zaehlt „Kerosin" und „Liter" im NUTZTEXT — nicht in Kommentaren.

   WARUM DAS NOETIG IST: N60.24 meldet „alle erreichbaren Texte
   umgestellt". Gefunden am 10.10.2026 in einer LIVE-Antwort der API:
   `routes/credits.js` -> „Kerosin-Kauf ist noch nicht freigeschaltet."
   Eine Erledigt-Meldung ohne Messung haelt sich nicht.

   Der Pruefer muss Kommentare ausblenden, sonst findet er die
   BEGRUENDUNGEN mit, warum der Begriff weg ist — und meldet genau die
   Dateien, die ihn korrekt abgeschafft haben (Memory:
   pruefer-findet-eigenes-zitat).

   RC=0 heisst: kein Kerosin im Nutztext.
   ══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const WURZEL = process.cwd();
const ORTE = ['frontend', 'backend/src'];
const ENDUNGEN = ['.js', '.html', '.mjs'];
const AUS = ['node_modules', '.git', 'patchesold', 'generated'];

/* ── Kommentare AUSLEEREN, nicht entfernen ────────────────────────────
   Der erste Entwurf hat sie geloescht und die Zeilennummern danach im
   gekuerzten Text gezaehlt. Die Verweise zeigten dadurch auf voellig
   andere Zeilen: gemeldet war `config.js:455` („alte Kerosin-Pakete"),
   dort steht eine Leerzeile; gemeldet war `credits.js:134`, dort steht
   ein Kommentar.

   Ein Pruefer, der auf die falsche Zeile zeigt, ist schlimmer als keiner:
   man sieht nach, findet nichts und haelt den Befund fuer erledigt.

   Jetzt wird jedes Kommentarzeichen durch ein Leerzeichen ersetzt. Die
   Datei behaelt ihre Laenge, jede Zeilennummer stimmt, und Zeilenumbrueche
   innerhalb von Blockkommentaren bleiben erhalten. */
function ohneKommentare(text, endung) {
  const leer = (m) => m.replace(/[^\n]/g, ' ');
  let s = text;
  if (endung === '.html') s = s.replace(/<!--[\s\S]*?-->/g, leer);
  s = s.replace(/\/\*[\s\S]*?\*\//g, leer);
  /* Zeilenkommentare: nur wenn `//` nicht in einer URL steht (`://`). */
  s = s.split('\n').map(function (z) {
    const i = z.search(/(^|[^:/])\/\//);
    if (i < 0) return z;
    const ab = z.indexOf('//', i);
    return z.slice(0, ab) + ' '.repeat(z.length - ab);
  }).join('\n');
  return s;
}

function dateien(dir, raus) {
  let eintraege;
  try { eintraege = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of eintraege) {
    if (AUS.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { dateien(p, raus); continue; }
    if (ENDUNGEN.includes(path.extname(e.name))) raus.push(p);
  }
}

const liste = [];
for (const o of ORTE) dateien(path.join(WURZEL, o), liste);

/* ── Zwei Regeln aus CLAUDE.md, ein Waechter ──────────────────────────
   1. „Kerosin" ist abgeschafft, die Einheit „Liter" ist mitgefallen.
   2. ANBIETER-NEUTRALITAET: „Sprengnetter und PriceHubble nie namentlich
      nach aussen — ,unabhaengige Bewertungspartner'. ImmoMetrica darf
      genannt werden."

   Punkt 2 kam dazu, weil der Kerosin-Lauf ihn mitgefunden hat:
   `quickcheck-app.html` nennt in EINEM Kundensatz beide Namen. Eine
   Regel, die nur in CLAUDE.md steht, wird nicht eingehalten — sie
   braucht einen Lauf. */
const BEGRIFFE = [
  ['Kerosin', /Kerosin/g],
  ['Liter (als Einheit)', /\b\d+\s*Liter\b|\bLiter\b(?!\s*-?\s*Tank)/g],
  ['Sprengnetter (nach aussen)', /Sprengnetter/g],
  ['PriceHubble (nach aussen)', /PriceHubble/g]
];

const funde = [];
let gelesen = 0, zeichenGesamt = 0, zeichenOhne = 0;
for (const f of liste) {
  let roh;
  try { roh = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  gelesen++;
  zeichenGesamt += roh.length;
  const endung = path.extname(f);
  const text = ohneKommentare(roh, endung);
  /* Seit die Kommentare GELEERT statt entfernt werden, ist die Laenge
     gleich — gezaehlt wird deshalb, wie viel wirklich ausgeblendet wurde.
     Vorher stand hier `text.length` und meldete stolz „100 % Nutztext". */
  let weg = 0;
  for (let i = 0; i < roh.length; i++) if (roh[i] !== text[i]) weg++;
  zeichenOhne += weg;
  for (const [name, re] of BEGRIFFE) {
    re.lastIndex = 0;
    const treffer = text.match(re);
    if (!treffer) continue;
    /* ── v2 · BEZEICHNER SIND KEIN KUNDENTEXT ─────────────────────────
       Der erste Lauf meldete 25 Kerosin-Stellen und 150 Anbieternamen.
       Nachgesehen sind die meisten KEINE Verstoesse:

         `_wireKerosinStrip`              Funktionsname
         `/Kerosin|\/ Monat/`             ein Filter, der den Begriff
                                          sogar ENTFERNT
         `console.warn('[v1182c] Kerosin-Kasten …')`   Protokoll
         `sprengnetter-client.js`         Modulname, darf so heissen
         `alt="Sprengnetter"`             ein PARTNER-LOGO auf der
                                          Landingpage - Marketing, nicht
                                          eine Herkunftsangabe

       Ein Waechter, der 150 Stellen meldet, von denen 140 richtig sind,
       wird abgeschaltet. Deshalb wird getrennt: PROSA zaehlt als Befund,
       BEZEICHNER wird nur mitgezaehlt.

       Prosa heisst: im Umfeld stehen mindestens drei deutsche Woerter.
       Das ist eine Heuristik und wird als solche benannt - die Zahl der
       Einordnungen steht im Bericht, damit man ihr nicht blind glaubt. */
    /* Die Zeilennummern stimmen jetzt mit dem ORIGINAL ueberein, weil
       `ohneKommentare` die Laenge erhaelt. Zur Sicherheit wird gegengeprueft,
       dass die Zeile im Original denselben Begriff traegt — sonst wandert
       der Verweis wieder, und das faellt dann HIER auf. */
    const original = roh.split('\n');
    const nr = [];
    let verrutscht = 0;
    text.split('\n').forEach((z, i) => {
      re.lastIndex = 0;
      if (!re.test(z)) return;
      nr.push(i + 1);
      re.lastIndex = 0;
      if (!original[i] || !re.test(original[i])) verrutscht++;
      re.lastIndex = 0;
    });
    if (verrutscht) console.log('  !! ' + path.basename(f) + ': ' + verrutscht
      + ' Zeilenverweis(e) stimmen nicht mit dem Original — Pruefer defekt');
    /* Je Zeile einordnen: Prosa oder Bezeichner. */
    const DE = /\b(der|die|das|dein|deine|deinen|wird|werden|ist|sind|für|fuer|pro|alle|noch|nicht|und|oder|mit|von|im|in|auf|laufen|kostet|verbraucht|Monat|Anfragen|Tank|Kauf|freigeschaltet)\b/gi;
    const prosaZeilen = [], codeZeilen = [];
    for (const z of nr) {
      const zeile = original[z - 1] || '';
      DE.lastIndex = 0;
      const woerter = (zeile.match(DE) || []).length;
      /* Ein Bezeichner traegt den Begriff direkt an Buchstaben oder
         Bindestrich-Dateinamen; Prosa traegt Leerzeichen und Woerter. */
      const istBezeichner = /[A-Za-z_]Kerosin|Kerosin[A-Za-z_]|-client\.js|function |var _wire|console\.(warn|log|error)|^\s*\/\//.test(zeile)
        || /alt="|src="|require\(|\.js['"]/.test(zeile);
      if (woerter >= 3 && !istBezeichner) prosaZeilen.push(z); else codeZeilen.push(z);
    }
    funde.push({ datei: path.relative(WURZEL, f).replace(/\\/g, '/'),
                 begriff: name, n: treffer.length,
                 prosa: prosaZeilen, code: codeZeilen,
                 verrutscht: verrutscht });
  }
}

console.log('Gelesen: ' + gelesen + ' Dateien, ' + Math.round(zeichenGesamt / 1024) + ' KiB');
console.log('Als Kommentar ausgeblendet: ' + Math.round(zeichenOhne / 1024) + ' KiB ('
  + Math.round(zeichenOhne / zeichenGesamt * 100) + ' % der Datei), geprueft wurde der Rest');

if (!funde.length) {
  console.log('\nRC=0 — kein Treffer im Nutztext');
  process.exit(0);
}

const prosa = funde.filter((f) => f.prosa.length);
const nurCode = funde.filter((f) => !f.prosa.length);

console.log('\n╔══ PROSA — das sind die Befunde (' + prosa.length + ' Dateien) ══');
if (!prosa.length) console.log('║  keine');
for (const f of prosa.sort((a, b) => b.prosa.length - a.prosa.length)) {
  console.log('║  ' + String(f.prosa.length).padStart(3) + 'x  ' + f.begriff.padEnd(28)
    + f.datei + '  Z. ' + f.prosa.join(', '));
}
console.log('╚══');

console.log('\n── Bezeichner, Regex, Protokolle — KEIN Befund (' + nurCode.length + ' Dateien) ──');
for (const f of nurCode.sort((a, b) => b.code.length - a.code.length).slice(0, 12)) {
  console.log('   ' + String(f.code.length).padStart(3) + 'x  ' + f.begriff.padEnd(28)
    + f.datei + '  Z. ' + f.code.slice(0, 4).join(', '));
}
if (nurCode.length > 12) console.log('   … und ' + (nurCode.length - 12) + ' weitere');

const sumProsa = prosa.reduce((a, f) => a + f.prosa.length, 0);
const sumCode = funde.reduce((a, f) => a + f.code.length, 0);
console.log('\nSumme: ' + sumProsa + ' Prosa-Zeilen, ' + sumCode + ' Bezeichner-Zeilen');
console.log('Die Einordnung ist eine HEURISTIK (deutsche Woerter im Umfeld,');
console.log('Bezeichner-Muster) — sie ersetzt das Hinsehen nicht, sie sortiert vor.');
console.log('');
console.log('ZWEI BEKANNTE FEHLURTEILE, am 10.10.2026 von Hand geprueft:');
console.log('  pricing-modal.js:1096/1099 — „Liter = X Pilot-Anfragen" und');
console.log('  „X / Liter" sind KUNDENSICHTBAR (Preis-Fenster), landen aber im');
console.log('  Bezeichner-Topf, weil in der Zeile zu wenige deutsche Woerter');
console.log('  stehen. Behoben in v2097; wer die Heuristik verschaerft, prueft');
console.log('  zuerst, ob avm-section.js und die *-client.js nicht wieder');
console.log('  mitgemeldet werden — die duerfen so heissen.');

console.log('\n' + (sumProsa === 0
  ? 'RC=0 — kein Kundentext mehr betroffen'
  : 'RC=1 — ' + sumProsa + ' Prosa-Zeile(n) offen'));
process.exit(sumProsa === 0 ? 0 : 1);
