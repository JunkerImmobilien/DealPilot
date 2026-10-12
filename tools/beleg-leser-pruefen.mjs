#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * beleg-leser-pruefen.mjs — v2151
 *
 * FINDET DIE BELEGPRUEFUNG EINE ADRESSE, DIE DA STEHT?
 *
 * Ämter schreiben ihre E-Mail-Adressen gegen Erntemaschinen
 * verschleiert. Eine Belegprüfung, die das nicht übersteht, sagt
 * „steht nicht auf der Quellseite" — für eine Adresse, die dort steht.
 * Der Nutzer bekommt eine Warnung für einen korrekten Fund.
 *
 * GEMESSEN am 12.10.2026 an der Fassung vor v2151: von neun echten
 * Schreibweisen wurden VIER verfehlt, und drei der fünf Treffer kamen
 * über einen Rückfall, der die Adresse nie gesehen hatte
 * (`includes(konto) && includes(domain)`).
 *
 * ── DIESER PRUEFER HAT ZWEI HAELFTEN ────────────────────────────────
 *
 *   FINDEN      jede Schreibweise, die ein Amt wirklich benutzt
 *   NICHT FINDEN was keine Adresse ist
 *
 * Die zweite ist die wichtigere. Ein Leser, der alles findet, ist
 * wertlos: ein falscher Beleg behauptet eine Herkunft, und das ist
 * schlimmer als ein fehlender.
 *
 * Er lädt den ECHTEN `unterlagenService.js` und ruft die ECHTE
 * Funktion. Ein Prüfer, der den Extraktor abschreibt, misst sich selbst.
 * ══════════════════════════════════════════════════════════════════════ */
import path from 'node:path';
import Module from 'node:module';
import { createRequire } from 'node:module';

const WURZEL = process.cwd();
const require_ = createRequire(path.join(WURZEL, 'backend', 'src', 'x.js'));

/* ── WARUM EIN STUB, UND WARUM NUR EINER ────────────────────────────
 *
 * `unterlagenService.js` zieht `db/pool.js` mit, und das verlangt `pg`.
 * Lokal ist `pg` nicht installiert (die Abhaengigkeiten liegen im
 * Backend-Image). Ohne Stub bricht der Pruefer mit
 * „Cannot find module 'pg'" ab und prueft nichts.
 *
 * Ersetzt wird GENAU EIN Modul, und es ist eines, das hier gar nicht
 * benutzt wird: geprueft werden reine Textfunktionen, die keine
 * Datenbank anfassen. Alles andere — der Extraktor, die
 * Gueltigkeitspruefung, die Postfacherkennung — ist der echte Code aus
 * der echten Datei.
 *
 *   > Dasselbe Muster wie beim Prompt-Pruefer, der `callOpenAI`
 *   > ersetzt: die eine Aussenverbindung wird stillgelegt, die
 *   > geprueften Funktionen bleiben die ausgelieferten. Ein Pruefer,
 *   > der den Extraktor NACHBAUT, misst sich selbst.
 *
 * Der Stub wirft, wenn ihn jemand WIRKLICH benutzt. Ein stiller
 * Platzhalter wuerde einen Datenbankzugriff in diesem Lauf verdecken
 * und den Pruefer gruen machen, obwohl er etwas anderes gemessen hat. */
const _werfe = function () {
  throw new Error('Dieser Pruefer fasst die Datenbank nicht an — '
    + 'wird sie wirklich gebraucht, misst er das Falsche.');
};
const ERSATZ = {
  dotenv: { config: function () { return { parsed: {} }; } },
  pg: { Pool: function () { return { query: _werfe, connect: _werfe, on: function () {}, end: _werfe }; } }
};
const _load = Module._load;
let gestellt = [];
Module._load = function (anfrage) {
  if (Object.prototype.hasOwnProperty.call(ERSATZ, anfrage)) {
    /* ERST das echte Modul versuchen. Auf dem Server sind beide
       installiert, und dort soll der echte Treiber laufen — ein Stub,
       der auch dann greift, wenn das Echte da ist, verschiebt die
       Messung still. */
    try { return _load.apply(this, arguments); }
    catch (e) { if (gestellt.indexOf(anfrage) < 0) gestellt.push(anfrage); return ERSATZ[anfrage]; }
  }
  return _load.apply(this, arguments);
};

/* Die Umgebung VOR dem require — `unterlagenService` zieht `db` und
   `config` mit, und die wollen Werte sehen. Es wird nichts verbunden:
   geprueft werden reine Funktionen. */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://x:x@127.0.0.1:1/x';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'pruefer';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'pruefer';

let U;
try {
  U = require_('./services/unterlagenService.js');
} catch (e) {
  console.error('unterlagenService nicht ladbar: ' + e.message);
  process.exit(2);
}
for (const n of ['mailsAufSeite', 'istPersonenpostfach']) {
  if (typeof U[n] !== 'function') {
    console.error(n + '() ist nicht exportiert.');
    process.exit(2);
  }
}

let rot = 0, faelle = 0;

/* ══ 1 · FINDEN: die Schreibweisen, die Aemter benutzen ═══════════════ */
const ZIEL = 'info@stadt-xy.de';
const FINDEN = [
  ['nackt',              'Kontakt: info@stadt-xy.de'],
  ['span im @',          'Kontakt: info<span>@</span>stadt-xy.de'],
  ['(at)',               'Kontakt: info(at)stadt-xy.de'],
  ['[at] [dot]',         'Kontakt: info [at] stadt-xy [dot] de'],
  ['(ät) deutsch',       'Kontakt: info(ät)stadt-xy.de'],
  ['{punkt}',            'Kontakt: info(at)stadt-xy{punkt}de'],
  ['HTML-Entity commat', 'Kontakt: info&commat;stadt-xy.de'],
  ['Zahlen-Entity',      'Kontakt: info&#64;stadt-xy.de'],
  ['Hex-Entity',         'Kontakt: info&#x40;stadt-xy.de'],
  ['Soft-Hyphen',        'Kontakt: in­fo@stadt-xy.de'],
  ['Zero-Width',         'Kontakt: info@stadt​-xy.de'],
  ['wbr-Tag',            'Kontakt: info@stadt<wbr>-xy.de'],
  ['Grossschreibung',    'Kontakt: Info@Stadt-XY.de'],
  ['Gedankenstrich',     'Kontakt: info@stadt‐xy.de'],
  ['Minuszeichen',       'Kontakt: info@stadt−xy.de'],
  ['mailto-Attribut',    '<a href="mailto:info@stadt-xy.de">E-Mail</a>'],
  ['URL-kodiert',        '<a href="mailto:info%40stadt-xy.de">Mail</a>'],
  ['in Tabelle',         '<td>E-Mail</td><td><b>info</b>@<i>stadt-xy.de</i></td>'],
  ['mit Zeilenumbruch',  'Kontakt:\n  info@stadt-xy.de\n']
];
console.log('=== 1 · FINDEN — Ziel: ' + ZIEL + ' ===');
FINDEN.forEach(function (f) {
  faelle++;
  const got = U.mailsAufSeite(f[1]);
  const ok = got.includes(ZIEL);
  if (!ok) rot++;
  console.log('  ' + (ok ? 'ok  ' : 'ROT ') + f[0].padEnd(20)
    + (ok ? '' : 'gefunden: ' + (got.length ? got.join(', ') : '(nichts)')));
});

/* ══ 2 · NICHT FINDEN: was keine Adresse ist ══════════════════════════
 *
 * Die wichtigere Haelfte. Jeder Eintrag war einmal ein denkbarer
 * Fehlalarm. */
console.log('');
console.log('=== 2 · NICHT FINDEN — kein Fehlalarm ===');
const NICHT = [
  ['Konto ohne Domain',   'Schreiben Sie an info oder an das Bauamt', []],
  ['Domain ohne Konto',   'Mehr unter www.stadt-xy.de im Internet', []],
  ['beide, aber getrennt', '<nav>Info</nav><footer>stadt-xy.de</footer>', []],
  ['Bilddatei',           '<img src="logo@2x.png">', []],
  ['Schriftdatei',        '<link href="font@1x.woff2">', []],
  ['Platzhalter email',   'E-Mail: email@', []],
  ['Twitter-Handle',      'Folgen Sie @stadtxy auf dem Kanal', []],
  ['Preisangabe',         'Gebuehr: 3 Stueck @ 12,50 EUR', []],
  ['Version mit @',       'Paket @stadt/ui.de installieren', []],
  ['zwei Absaetze',       '<p>mail</p><p>stadt-xy.de</p>', []],
  /* Und zwei, die eine ECHTE andere Adresse enthalten — die MUSS
     gefunden werden, aber eben nur sie. */
  ['nur die echte (1)',   'info steht hier. Kontakt: bauamt@stadt-xy.de', ['bauamt@stadt-xy.de']],
  ['nur die echte (2)',   'stadt-xy.de und poststelle@kreis-ab.de', ['poststelle@kreis-ab.de']]
];
NICHT.forEach(function (f) {
  faelle++;
  const got = U.mailsAufSeite(f[1]);
  const soll = f[2];
  const ok = got.length === soll.length && soll.every(function (m) { return got.includes(m); });
  if (!ok) rot++;
  console.log('  ' + (ok ? 'ok  ' : 'ROT ') + f[0].padEnd(20)
    + 'erwartet ' + (soll.length ? soll.join(', ') : '(nichts)')
    + (ok ? '' : '   GEFUNDEN: ' + (got.length ? got.join(', ') : '(nichts)')));
});

/* ══ 3 · DIE REIHENFOLGE DER SEITE BLEIBT ═════════════════════════════
 *
 * Kein Beiwerk: die erste genannte Stelle ist die zustaendige, und
 * darauf stuetzt sich spaeter „Ansprechpartner 1". */
console.log('');
console.log('=== 3 · Reihenfolge der Seite ===');
faelle++;
const reihe = U.mailsAufSeite(
  '<p>Leitung: a.mueller@stadt-xy.de</p>' +
  '<p>Sachbearbeitung: b.schmidt@stadt-xy.de</p>' +
  '<p>Allgemein: bauamt@stadt-xy.de</p>');
const erwartet = ['a.mueller@stadt-xy.de', 'b.schmidt@stadt-xy.de', 'bauamt@stadt-xy.de'];
const reiheOk = JSON.stringify(reihe) === JSON.stringify(erwartet);
if (!reiheOk) rot++;
console.log('  ' + (reiheOk ? 'ok  ' : 'ROT ') + 'drei Adressen in der Reihenfolge der Seite');
if (!reiheOk) console.log('      gefunden: ' + reihe.join(' | '));

/* ══ 4 · FUNKTIONS- ODER PERSONENPOSTFACH ═════════════════════════════ */
console.log('');
console.log('=== 4 · Funktionspostfach erkennen ===');
const POSTF = [
  ['info@stadt-xy.de', false], ['bauamt@stadt-xy.de', false],
  ['poststelle@kreis.de', false], ['buergerbuero@stadt.de', false],
  ['kataster@kreis.de', false], ['grundbuch@ag-xy.de', false],
  ['a.mueller@stadt-xy.de', true], ['anna.schmidt@kreis.de', true],
  ['m.weber@stadt.de', true]
];
POSTF.forEach(function (p) {
  faelle++;
  const got = U.istPersonenpostfach(p[0]);
  const ok = got === p[1];
  if (!ok) rot++;
  console.log('  ' + (ok ? 'ok  ' : 'ROT ') + p[0].padEnd(26)
    + (p[1] ? 'persoenlich' : 'Funktion') + (ok ? '' : '   GEMESSEN: ' + (got ? 'persoenlich' : 'Funktion')));
});

/* ══ 5 · GEGENPROBE: erkennt der Pruefer einen schlechten Leser? ══════ */
console.log('');
console.log('=== 5 · Gegenprobe ===');
/* Die ALTE Logik, woertlich aus der Fassung vor v2151. Sie MUSS an
   diesem Satz scheitern — sonst prueft Abschnitt 1 nichts. */
function alt(html, email) {
  const text = String(html).toLowerCase();
  const adr = String(email).toLowerCase();
  if (text.includes(adr)) return true;
  const t = adr.split('@');
  return !!(t[0] && t[1] && text.includes(t[0]) && text.includes(t[1]));
}
const altVerfehlt = FINDEN.filter(function (f) { return !alt(f[1], ZIEL); });
const neuVerfehlt = FINDEN.filter(function (f) { return !U.mailsAufSeite(f[1]).includes(ZIEL); });
console.log('  alte Logik verfehlt : ' + altVerfehlt.length + ' von ' + FINDEN.length
  + (altVerfehlt.length ? '  (' + altVerfehlt.map(function (f) { return f[0]; }).join(', ') + ')' : ''));
console.log('  neue Logik verfehlt : ' + neuVerfehlt.length + ' von ' + FINDEN.length);
const besser = altVerfehlt.length > neuVerfehlt.length;
console.log('  ' + (besser ? 'ok  ' : 'ROT ') + 'der neue Leser findet mehr als der alte'
  + (besser ? '' : ' — dann misst Abschnitt 1 nichts Neues'));
if (!besser) rot++;
/* Und der Fehlalarm des alten Rueckfalls MUSS auffallen. */
faelle++;
const fehlalarm = alt('<nav>Info</nav><footer>stadt-xy.de</footer>', ZIEL);
const neuSauber = !U.mailsAufSeite('<nav>Info</nav><footer>stadt-xy.de</footer>').includes(ZIEL);
console.log('  ' + (fehlalarm && neuSauber ? 'ok  ' : 'ROT ')
  + 'der alte Rueckfall belegte eine Adresse, die nicht da war — der neue nicht');
if (!(fehlalarm && neuSauber)) rot++;

console.log('');
console.log('=== Deckung ===');
console.log('  Dienst      : der ECHTE backend/src/services/unterlagenService.js');
console.log('  Gestellt    : ' + (gestellt.length ? gestellt.join(', ') + ' (lokal nicht installiert)'
  : 'nichts — alle Abhaengigkeiten waren echt da'));
console.log('  Faelle      : ' + faelle);
console.log('  Geprueft    : 19 Schreibweisen finden, 12 Fehlalarme vermeiden,');
console.log('                Reihenfolge, Postfachart, zwei Gegenproben');
console.log('  NICHT       : `belegSeiten()` selbst — die ruft echte Server ab.');
console.log('                Dass sie die Seiten LIEST, ist hier bewiesen; dass sie');
console.log('                sie ABRUFT, ist ein Staging-Abnahmepunkt.');
console.log('');
console.log(rot === 0 ? 'SAUBER — der Leser findet jede echte Schreibweise und keinen Fehlalarm.'
                      : 'ROT — ' + rot + ' Befund(e).');
process.exit(rot ? 1 : 0);
