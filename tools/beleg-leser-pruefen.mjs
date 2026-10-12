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
 * GEMESSEN am 12.10.2026 an der Fassung vor v2151: von den 19
 * Schreibweisen unten wurden SIEBEN verfehlt, und ein Teil der Treffer
 * kam über einen Rückfall, der die Adresse nie gesehen hatte
 * (`includes(konto) && includes(domain)`) — der also auch „bestätigt"
 * sagt, wenn „info" im Menü steht und die Domain im Impressum.
 *
 * Abschnitt 5 rechnet diese Zahlen bei jedem Lauf NEU aus, gegen die
 * wörtlich nachgebaute alte Logik. Eine Zahl im Kopf eines Prüfers
 * veraltet, eine gemessene nicht — mein erster Stand sagte hier
 * „neun, vier verfehlt", und das stimmte nur für die neun Fälle, die
 * ich zuerst geschrieben hatte.
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
import fs from 'node:fs';
import path from 'node:path';
import Module from 'node:module';
import { createRequire } from 'node:module';

/* ── ZWEI UMGEBUNGEN, EIN PRUEFER ───────────────────────────────────
 *
 * Im Repo liegt der Dienst unter `backend/src/services/`, IM CONTAINER
 * unter `/app/src/services/` — das Image kopiert `backend/` als
 * Wurzel. Ein Pruefer, der nur den Repo-Pfad kennt, laeuft dort nicht,
 * und genau dort sind `pg` und `dotenv` echt installiert.
 *
 *   > Gemessen am 12.10.2026: `docker exec … node /tmp/p.mjs` brach mit
 *   > „Cannot find module './services/unterlagenService.js'" ab. Ein
 *   > Pruefer, der nur in einer Umgebung laeuft, prueft die andere nie
 *   > — und die andere ist die ausgelieferte.
 *
 * Gesucht wird nach der DATEI, nicht geraten. Der gefundene Pfad wird
 * unten in der Deckung genannt. */
const KANDIDATEN = [
  path.join(process.cwd(), 'backend', 'src'),
  path.join(process.cwd(), 'src'),
  '/app/src',
  '/app/backend/src'
];
let BASIS = null;
for (const k of KANDIDATEN) {
  if (fs.existsSync(path.join(k, 'services', 'unterlagenService.js'))) { BASIS = k; break; }
}
if (!BASIS) {
  console.error('unterlagenService.js in keinem dieser Pfade gefunden:\n  '
    + KANDIDATEN.join('\n  '));
  process.exit(2);
}
const require_ = createRequire(path.join(BASIS, 'x.js'));

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
/* Die mit (*) stammen aus ECHTEN Amtsseiten, nicht aus meinem Kopf.
   `rechnung@invoice…` stand am 12.10.2026 im Impressum des Kreises
   Minden-Lübbecke und wurde von der ersten Fassung als PERSOENLICH
   eingeordnet — ein Rechnungspostfach als Ansprechperson. Kein
   erdachter Auftrag hätte das gefunden. */
const POSTF = [
  ['info@stadt-xy.de', false], ['bauamt@stadt-xy.de', false],
  ['poststelle@kreis.de', false], ['buergerbuero@stadt.de', false],
  ['kataster@kreis.de', false], ['grundbuch@ag-xy.de', false],
  ['a.mueller@stadt-xy.de', true], ['anna.schmidt@kreis.de', true],
  ['m.weber@stadt.de', true],
  /* v2152b · aus echten Seiten */
  ['rechnung@invoice.minden-luebbecke.de', false],      /* (*) */
  ['info@minden-luebbecke.de', false],                  /* (*) */
  ['s.ohnesorge@minden-luebbecke.de', true],            /* (*) */
  ['info@vps.minden-luebbecke.de', false],              /* (*) */
  ['poststelle@vps.huellhorst.de', false],              /* (*) */
  ['posteingang@bielefeld.de', false],                  /* (*) */
  /* Woerter, die kein Name sind und in keiner Liste stehen muessen,
     seit nur der PUNKT zaehlt */
  ['buchhaltung@stadt.de', false], ['anmeldung@stadt.de', false],
  ['fundbuero@stadt.de', false], ['standesamt@stadt.de', false],
  ['mweber@stadt.de', false],   /* nicht unterscheidbar -> sichere Seite */
  /* Und zwei, die einen Punkt tragen und TROTZDEM Funktion sind —
     dafuer ist die Negativliste da */
  ['post.stelle@stadt.de', false], ['buerger.service@stadt.de', false]
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

/* ══ 6 · v2152 · DER ZUSAMMENBAU DER ANSPRECHPERSONEN ═════════════════
 *
 * `personenAus()` trifft fuenf Zusicherungen, und jede einzelne war
 * einmal ein denkbarer Fehler:
 *
 *   hoechstens zwei            sonst wird aus einer Auskunft eine Liste
 *   nie der Empfaenger         sonst steht eine Adresse doppelt im Brief
 *   keine Dubletten            dieselbe Person aus zwei Quellen
 *   bestaetigt nur wenn WIR    sonst ist der Beleg eine Behauptung
 *     die Adresse gefunden
 *     haben
 *   kopie beginnt bei false    niemand wird ohne Zutun angeschrieben
 */
console.log('');
console.log('=== 6 · Zusammenbau der Ansprechpersonen (v2152) ===');
if (typeof U.personenAus !== 'function') {
  console.log('  ROT personenAus() ist nicht exportiert');
  rot++;
} else {
  const BELEG = {
    alle: ['bauamt@stadt-xy.de', 'a.mueller@stadt-xy.de', 'b.schmidt@stadt-xy.de'],
    pro_seite: [{ url: 'https://stadt-xy.de/bauamt',
                  mails: ['bauamt@stadt-xy.de', 'a.mueller@stadt-xy.de', 'b.schmidt@stadt-xy.de'] }]
  };
  const Q = 'https://stadt-xy.de/bauamt';
  const proben = [
    ['hoechstens zwei', function () {
      const p = U.personenAus([
        { name: 'A', email: 'a.mueller@stadt-xy.de' },
        { name: 'B', email: 'b.schmidt@stadt-xy.de' },
        { name: 'C', email: 'c.klein@stadt-xy.de' }
      ], 'bauamt@stadt-xy.de', BELEG, Q);
      return p.length === 2 ? null : 'es sind ' + p.length;
    }],
    ['Empfaenger faellt heraus', function () {
      const p = U.personenAus([{ name: 'X', email: 'bauamt@stadt-xy.de' }],
        'bauamt@stadt-xy.de', BELEG, Q);
      return p.some(function (x) { return x.email === 'bauamt@stadt-xy.de'; })
        ? 'der Empfaenger steht in der Liste' : null;
    }],
    ['keine Dublette', function () {
      /* ISOLIERT pruefen: der Belegsatz darf hier KEINE weitere
         persoenliche Adresse tragen, sonst fuellt Schritt 2 legitim
         eine zweite Person nach und die Probe misst das Auffuellen
         statt die Dublette.
         Genau daran ist mein erster Entwurf gescheitert — er erwartete
         1 und bekam 2, und die 2 war richtig. */
      const nurEine = { alle: ['bauamt@stadt-xy.de', 'a.mueller@stadt-xy.de'],
                        pro_seite: [{ url: Q, mails: ['bauamt@stadt-xy.de', 'a.mueller@stadt-xy.de'] }] };
      const p = U.personenAus([
        { name: 'A', email: 'a.mueller@stadt-xy.de' },
        { name: 'A nochmal', email: 'a.mueller@stadt-xy.de' }
      ], 'bauamt@stadt-xy.de', nurEine, Q);
      return p.length === 1 ? null : 'es sind ' + p.length
        + ' (' + p.map(function (x) { return x.email || x.name; }).join(', ') + ')';
    }],
    ['Dublette aus beiden Quellen', function () {
      /* Die KI nennt a.mueller, und a.mueller steht auch auf der Seite.
         Das ist der Normalfall — er darf NICHT zwei Eintraege geben. */
      const p = U.personenAus([{ name: 'A', email: 'a.mueller@stadt-xy.de' }],
        'bauamt@stadt-xy.de', BELEG, Q);
      const wievielMal = p.filter(function (x) { return x.email === 'a.mueller@stadt-xy.de'; }).length;
      return wievielMal === 1 ? null : 'a.mueller steht ' + wievielMal + ' mal in der Liste';
    }],
    ['belegt, weil WIR sie fanden', function () {
      const p = U.personenAus([{ name: 'A', email: 'a.mueller@stadt-xy.de' }],
        'bauamt@stadt-xy.de', BELEG, Q);
      return p[0] && p[0].bestaetigt === true ? null : 'bestaetigt ist nicht true';
    }],
    ['NICHT belegt, nur genannt', function () {
      /* Die KI nennt eine Adresse, die auf keiner gelesenen Seite stand.
         Das ist der haeufigste Fall und der gefaehrlichste. */
      const p = U.personenAus([{ name: 'Z', email: 'z.erfunden@stadt-xy.de' }],
        'bauamt@stadt-xy.de', BELEG, Q);
      return p[0] && p[0].bestaetigt === false ? null
        : 'eine ungepruefte Adresse gilt als belegt';
    }],
    ['kopie beginnt bei false', function () {
      const p = U.personenAus([{ name: 'A', email: 'a.mueller@stadt-xy.de' }],
        'bauamt@stadt-xy.de', BELEG, Q);
      return p[0] && p[0].kopie === false ? null : 'kopie ist nicht false';
    }],
    ['aufgefuellt aus der Quellseite', function () {
      /* Die KI nennt NIEMANDEN. Dann treten die persoenlichen
         Postfaecher der Quellseite ein — in deren Reihenfolge. */
      const p = U.personenAus([], 'bauamt@stadt-xy.de', BELEG, Q);
      if (p.length !== 2) return 'es sind ' + p.length;
      if (p[0].email !== 'a.mueller@stadt-xy.de') return 'falsche Reihenfolge: ' + p[0].email;
      return null;
    }],
    ['Funktionspostfach wird NICHT Person', function () {
      const p = U.personenAus([], 'info@stadt-xy.de',
        { alle: ['bauamt@stadt-xy.de', 'poststelle@stadt-xy.de'],
          pro_seite: [{ url: Q, mails: ['bauamt@stadt-xy.de', 'poststelle@stadt-xy.de'] }] }, Q);
      return p.length === 0 ? null : 'Funktionsadressen wurden als Personen gefuehrt';
    }],
    ['leere Huelle faellt weg', function () {
      const p = U.personenAus([{ name: '', funktion: 'Sachgebiet', email: '', telefon: '' }],
        'bauamt@stadt-xy.de', { alle: [], pro_seite: [] }, Q);
      return p.length === 0 ? null : 'eine Person ohne Name UND ohne Adresse wurde gefuehrt';
    }],
    ['Name ohne Adresse bleibt', function () {
      /* „Fragen Sie Frau X" ist eine brauchbare Auskunft — sie darf nur
         nicht in Kopie koennen. */
      const p = U.personenAus([{ name: 'Frau Mueller', funktion: 'Kataster' }],
        'bauamt@stadt-xy.de', { alle: [], pro_seite: [] }, Q);
      return (p.length === 1 && p[0].name === 'Frau Mueller' && !p[0].email) ? null
        : 'ein Name ohne Adresse ging verloren';
    }],
    ['kein Beleg, keine Seiten', function () {
      const p = U.personenAus([{ name: 'A', email: 'a.mueller@stadt-xy.de' }],
        '', null, null);
      return (p.length === 1 && p[0].bestaetigt === false) ? null
        : 'ohne Belegdaten stimmt etwas nicht';
    }],
    /* ══ v2153 · ENTWEDER ZWEI ODER KEINE ════════════════════════════
       Marcel: „wenn es nicht 2 ansprechpartner gibt sollte man schauen
       ob es eine übergeordnete email adresse oder einen kontakt gibt
       und den ausgeben und die ansprechpartner weg lassen." */
    ['eine nackte Adresse faellt', function () {
      /* Nur EIN persoenliches Postfach auf der Seite, kein Name. Das
         war genau der Abnahmefall vom 12.10. (s.ohnesorge@…) — er sah
         aus wie DIE Ansprechperson des Katasteramts. */
      const nurEine = { alle: ['bauamt@stadt-xy.de', 'a.mueller@stadt-xy.de'],
                        pro_seite: [{ url: Q, mails: ['bauamt@stadt-xy.de', 'a.mueller@stadt-xy.de'] }] };
      const p = U.personenAus([], 'bauamt@stadt-xy.de', nurEine, Q);
      return p.length === 0 ? null
        : 'eine einzelne nackte Adresse wurde als Ansprechperson gefuehrt';
    }],
    ['eine MIT Namen bleibt', function () {
      /* „Frau Mueller, Katasterauskunft" behauptet keine Zustaendigkeit
         ueber das Amt hinaus und ist am Telefon brauchbar. */
      const nurEine = { alle: ['bauamt@stadt-xy.de'],
                        pro_seite: [{ url: Q, mails: ['bauamt@stadt-xy.de'] }] };
      const p = U.personenAus([{ name: 'Frau Mueller', funktion: 'Katasterauskunft',
                                 telefon: '0571 807-0' }],
        'bauamt@stadt-xy.de', nurEine, Q);
      return (p.length === 1 && p[0].name === 'Frau Mueller') ? null
        : 'eine benannte Person ging verloren (' + p.length + ')';
    }],
    ['zwei bleiben zwei', function () {
      const p = U.personenAus([
        { name: 'A', email: 'a.mueller@stadt-xy.de' },
        { name: 'B', email: 'b.schmidt@stadt-xy.de' }
      ], 'bauamt@stadt-xy.de', BELEG, Q);
      return p.length === 2 ? null : 'es sind ' + p.length;
    }],
    ['ungueltige Adresse faellt weg', function () {
      const p = U.personenAus([{ name: 'A', email: 'email' },
                               { name: 'B', email: 'keine' }],
        'bauamt@stadt-xy.de', BELEG, Q);
      return p.every(function (x) { return !x.email; }) ? null
        : 'ein Platzhalter wurde als Adresse genommen';
    }]
  ];
  proben.forEach(function (pr) {
    faelle++;
    let fehler = null;
    try { fehler = pr[1](); } catch (e) { fehler = 'wirft: ' + e.message; }
    if (fehler) rot++;
    console.log('  ' + (fehler ? 'ROT ' : 'ok  ') + pr[0].padEnd(32) + (fehler || ''));
  });
}

/* ══ 6b · v2152a · `seiten` HAT ZWEI FORMEN ═══════════════════════════
 *
 * Gemessen auf Staging: alle 19 bestehenden Saetze tragen die ALTE
 * URL-Liste, neue bekommen das Objekt mit dem Beleg. Ein Leser, der nur
 * die neue Form kennt, meldet bei jedem Altsatz „keine Seiten gelesen"
 * — und das ist etwas anderes als „aus der Zeit vor dem Beleg".
 */
console.log('');
console.log('=== 6b · Beide Formen von `seiten` (v2152a) ===');
if (typeof U.seitenLesen !== 'function') {
  console.log('  ROT seitenLesen() ist nicht exportiert'); rot++;
} else {
  [
    ['alte URL-Liste', ['https://a.de', 'https://b.de'],
      function (r) { return r.liste.length === 2 && r.pro_seite.length === 0 && r.alt === true
        ? null : 'liste=' + r.liste.length + ' alt=' + r.alt; }],
    ['neue Objektform', { liste: ['https://a.de'], pro_seite: [{ url: 'https://a.de', mails: ['x@a.de'] }], alternativen: ['y@a.de'] },
      function (r) { return r.pro_seite.length === 1 && r.alt === false
        ? null : 'pro_seite=' + r.pro_seite.length + ' alt=' + r.alt; }],
    ['null', null,
      function (r) { return r.liste.length === 0 && r.pro_seite.length === 0 ? null : 'nicht leer'; }],
    ['leeres Objekt', {},
      function (r) { return r.liste.length === 0 && r.alt === false ? null : 'alt=' + r.alt; }],
    ['Array mit Luecken', ['https://a.de', null, ''],
      function (r) { return r.liste.length === 1 ? null : 'liste=' + r.liste.length; }]
  ].forEach(function (p) {
    faelle++;
    let fehler = null;
    try { fehler = p[2](U.seitenLesen(p[1])); } catch (e) { fehler = 'wirft: ' + e.message; }
    if (fehler) rot++;
    console.log('  ' + (fehler ? 'ROT ' : 'ok  ') + p[0].padEnd(22) + (fehler || ''));
  });
}

/* ══ 7 · STEHT DER AUFTRAG IM PROMPT — UND SEIN ZIELFELD? ═════════════
 *
 * Der Prompt ist die Stelle, an der erfundene Namen entstehen. Die drei
 * Einschraenkungen aus der Vorlage v6 muessen WOERTLICH dort stehen,
 * und das Zielfeld muss im Antwortformat vorkommen:
 *
 *   > Ohne Zielfeld faellt ein Prompt-Auftrag lautlos auf den Boden.
 *   > Das hat heute Morgen schon einmal Arbeit gekostet (v2139).
 *
 * Geprueft wird der KOMMENTARFREIE Text. Sonst findet der Pruefer seine
 * eigenen Zitate aus den Begruendungen daneben — dreimal Fehlalarm in
 * einer Sitzung, deshalb steht es hier.
 */
console.log('');
console.log('=== 7 · Der KI-Auftrag und sein Zielfeld (v2152) ===');
const quelle = fs.readFileSync(path.join(BASIS, 'services', 'unterlagenService.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ')          /* Blockkommentare weg */
  .replace(/^\s*\/\/.*$/gm, ' ');             /* Zeilenkommentare weg */
[
  ['Auftrag: erste beiden',    'die ersten beiden '],
  ['Auftrag: Reihenfolge',     'in der Reihenfolge der Seite'],
  ['Riegel: wirklich stehen',  'Nur Personen, die dort wirklich stehen'],
  ['Riegel: Mail nur woertlich', 'Eine E-Mail nur, wenn '],
  /* Der Satz ist im Quelltext ueber zwei JS-Zeilen gebrochen, und `\n`
     steht dort als ZWEI Zeichen. Gesucht wird deshalb ein Stueck, das
     sicher in EINER Dateizeile steht — mein erster Versuch war
     `'bleibt \n'` und fand nichts. */
  ['Riegel: leer ist erlaubt', 'Stehen dort keine Personen, bleibt'],
  ['Zielfeld im JSON-Format',  '"ansprechpartner":[{"name":"","funktion":"","email":"","telefon":""}]']
].forEach(function (p) {
  faelle++;
  const ok = quelle.indexOf(p[1]) >= 0;
  if (!ok) rot++;
  console.log('  ' + (ok ? 'ok  ' : 'ROT ') + p[0].padEnd(30)
    + (ok ? '' : 'nicht im kommentarfreien Text: "' + p[1].slice(0, 40) + '"'));
});

console.log('');
console.log('=== Deckung ===');
console.log('  Dienst      : der ECHTE ' + BASIS + '/services/unterlagenService.js');
console.log('  Gestellt    : ' + (gestellt.length ? gestellt.join(', ') + ' (lokal nicht installiert)'
  : 'nichts — alle Abhaengigkeiten waren echt da'));
console.log('  Faelle      : ' + faelle);
console.log('  Geprueft    : 19 Schreibweisen finden, 12 Fehlalarme vermeiden,');
console.log('                Reihenfolge, 9 Postfacharten, zwei Gegenproben,');
console.log('                13 Zusicherungen des Personen-Zusammenbaus (v2152),');
console.log('                5 Formproben der Spalte seiten (v2152a),');
console.log('                6 Stellen des KI-Auftrags am kommentarfreien Text');
console.log('  NICHT       : `belegSeiten()` selbst — die ruft echte Server ab.');
console.log('                Dass sie die Seiten LIEST, ist hier bewiesen; dass sie');
console.log('                sie ABRUFT, ist ein Staging-Abnahmepunkt.');
console.log('                Auch NICHT: ob das Modell den Auftrag BEFOLGT. Dass er');
console.log('                im Prompt steht und ein Zielfeld hat, ist geprueft —');
console.log('                ob echte Personen herauskommen, zeigt nur ein Lauf.');
console.log('');
console.log(rot === 0 ? 'SAUBER — der Leser findet jede echte Schreibweise und keinen Fehlalarm.'
                      : 'ROT — ' + rot + ' Befund(e).');
process.exit(rot ? 1 : 0);
