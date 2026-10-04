'use strict';
/* pruef-adresssuche.js — v1828
 *
 * PRUEFT DIE ECHTE FUNKTION aus der echten Datei: `objektRaten` in
 * `backend/src/services/telegramDialogService.js`. Kein Nachbau — ein
 * Nachbau hat hier schon einmal acht Nullen gemeldet (register-saat).
 *
 * Laeuft ohne Datenbank und ohne Netz:
 *   node tools/agent-pruefung/pruef-adresssuche.js
 *
 * ── DER GEGENTEST ────────────────────────────────────────────────────────
 *
 * "Nachher richtig" beweist nicht "vorher falsch". Der Pruefer baut
 * deshalb die ALTE Regel nach (nur die Praefixpruefung aus v1810, ohne
 * Stammform) und zeigt, dass sie bei den neuen Faellen durchfaellt. Wenn
 * der alte Weg dieselben Faelle bestuende, waere die Aenderung sinnlos —
 * und das muss ein Pruefer sagen koennen.
 */
const path = require('path');
const dialog = require(path.join(__dirname, '..', '..', 'backend', 'src',
  'services', 'telegramDialogService.js'));

/* Marcels echte Objektliste vom 04.10.2026, aus der Staging-Datenbank
   gelesen. Keine erfundenen Adressen: der Fehler hing an der Schreibweise,
   und eine ausgedachte Schreibweise prueft die falsche Sache. */
const LISTE = [
  'Dealstreet 999 Dealhausen', 'Hermannstraße 9 Hüllhorst',
  'Musterstraße 12 Leipzig', 'Bäckerstr. 7 Musterhausen',
  'Am Markt 9 Kabelsketal', 'Demo-Objekt · Beispiel-Wohnung Dealhausen',
  'Löhner Str. 278 Hiddenhausen', 'Hölderlinstr. 1 Bad Oeynhausen',
  'Wilhelm-Busch-Straße 10 + 11 Rinteln', 'Am Markt 18 Kabelsketal',
  'Westerfeldstr. 140 Bielefeld', 'Alexanderstraße 11 Bielefeld',
  'Lindenhof 14 Castrop-Rauxel', 'Gohliser Str. 42 Leipzig',
  'Ravensberger Weg 38 Bielefeld', 'Bismarckstr. 27 Detmold',
  'Hauptstr. 51 Ibbenbüren', 'Parkstr. 9 Bad Oeynhausen'
].map((a, i) => ({ id: 'id' + i, adresse: a }));

/* Die ALTE Regel, nachgebaut — nur fuer den Gegentest, nie als Massstab
   fuer das Richtige. */
const ALT_STRASSENWOERTER = new Set(['strasse', 'straße', 'str', 'weg', 'allee',
  'platz', 'gasse', 'ring', 'damm', 'ufer', 'chaussee', 'hof', 'park']);
function altWoerter(s) {
  return String(s || '').toLowerCase().replace(/[^a-zäöüß0-9]+/g, ' ')
    .split(' ').filter(Boolean);
}
function altRaten(satz, liste) {
  const w = altWoerter(satz);
  const tr = liste.map((o) => {
    const ows = altWoerter(o.adresse); const ow = new Set(ows); let p = 0;
    for (const t of w) {
      if (/^\d+$/.test(t)) { if (ow.has(t)) p += 3; continue; }
      if (ALT_STRASSENWOERTER.has(t)) continue;
      if (ow.has(t)) { if (t.length > 2) p += 2; continue; }
      if (t.length >= 5) {
        if (ows.some((a) => a.length > t.length && a.indexOf(t) === 0)) { p += 2; continue; }
      }
    }
    return { o: o, p: p };
  }).filter((x) => x.p > 0).sort((a, b) => b.p - a.p);
  if (!tr.length) return { art: 'keiner' };
  if (tr.length > 1 && tr[0].p === tr[1].p) return { art: 'mehrdeutig' };
  return { art: 'eindeutig', objekt: tr[0].o };
}

let ok = 0, schlecht = 0;
const zeilen = [];
function probe(frage, sollAdresse) {
  const neu = dialog.objektRaten(frage, LISTE);
  const alt = altRaten(frage, LISTE);
  const neuAdr = neu.art === 'eindeutig' ? neu.objekt.adresse : ('(' + neu.art + ')');
  const altAdr = alt.art === 'eindeutig' ? alt.objekt.adresse : ('(' + alt.art + ')');
  const gut = neu.art === 'eindeutig' && neu.objekt.adresse === sollAdresse;
  if (gut) ok++; else schlecht++;
  zeilen.push((gut ? '  [ok]   ' : '  [NEIN] ')
    + '"' + frage + '"'
    + '\n           neu: ' + neuAdr
    + (gut ? '' : '\n           soll: ' + sollAdresse)
    + '\n           alt: ' + altAdr
    + (altAdr !== neuAdr ? '   <- der alte Stand war hier anders' : ''));
  return { neu: neu.art, alt: alt.art, geaendert: altAdr !== neuAdr };
}

console.log('== pruef-adresssuche (v1828) ==');
console.log('   Liste: ' + LISTE.length + ' echte Objekte aus Marcels Staging-Bestand');
console.log('');

/* ── Der gemeldete Fall ──────────────────────────────────────────────── */
const f1 = probe('Bismarckstraße', 'Bismarckstr. 27 Detmold');
probe('Was kannst du mir zum Objekt in der Bismarckstraße sagen?',
  'Bismarckstr. 27 Detmold');

/* ── Dieselbe Richtung bei den anderen abgekuerzten Objekten ─────────── */
probe('Hauptstraße', 'Hauptstr. 51 Ibbenbüren');
probe('Westerfeldstraße', 'Westerfeldstr. 140 Bielefeld');
probe('Hölderlinstraße', 'Hölderlinstr. 1 Bad Oeynhausen');
probe('Bäckerstraße', 'Bäckerstr. 7 Musterhausen');
probe('Parkstraße', 'Parkstr. 9 Bad Oeynhausen');

/* ── Die GEGENRICHTUNG muss weiter gehen (v1810 darf nicht fallen) ───── */
probe('Musterstr', 'Musterstraße 12 Leipzig');
probe('Hermannstr', 'Hermannstraße 9 Hüllhorst');
probe('Alexanderstr', 'Alexanderstraße 11 Bielefeld');

/* ── Und die Faelle, die schon vorher gingen, muessen bleiben ────────── */
probe('Gohliser', 'Gohliser Str. 42 Leipzig');
probe('Lindenhof', 'Lindenhof 14 Castrop-Rauxel');
probe('Ravensberger Weg', 'Ravensberger Weg 38 Bielefeld');
probe('Am Markt 18', 'Am Markt 18 Kabelsketal');
probe('Löhner Str. 278', 'Löhner Str. 278 Hiddenhausen');
probe('Wilhelm-Busch-Straße', 'Wilhelm-Busch-Straße 10 + 11 Rinteln');

console.log(zeilen.join('\n'));
console.log('');

/* ── Was NICHT passieren darf ────────────────────────────────────────── */
const grenz = [];
function darfNicht(frage, verboten, warum) {
  const r = dialog.objektRaten(frage, LISTE);
  const traf = r.art === 'eindeutig' && r.objekt.adresse === verboten;
  if (traf) { schlecht++; grenz.push('  [NEIN] "' + frage + '" traf ' + verboten + ' — ' + warum); }
  else { ok++; grenz.push('  [ok]   "' + frage + '" traf NICHT ' + verboten
    + '  (' + (r.art === 'eindeutig' ? r.objekt.adresse : r.art) + ')'); }
}
/* "Am Markt" gibt es ZWEIMAL (9 und 18) — das muss mehrdeutig bleiben,
   nicht stillschweigend eines von beiden nehmen. */
const ammarkt = dialog.objektRaten('Am Markt', LISTE);
if (ammarkt.art === 'mehrdeutig') { ok++; grenz.push('  [ok]   "Am Markt" bleibt mehrdeutig (zwei Objekte) — Rueckfrage'); }
else { schlecht++; grenz.push('  [NEIN] "Am Markt" ist ' + ammarkt.art + ', muesste mehrdeutig sein'); }
darfNicht('Marktplatz', 'Am Markt 9 Kabelsketal', 'anderes Wort, nur gleicher Anfang');
darfNicht('Hofstraße', 'Lindenhof 14 Castrop-Rauxel', 'der Stamm von Lindenhof ist linden~, nicht hof');

console.log('── Grenzfaelle ──');
console.log(grenz.join('\n'));
console.log('');
console.log('   Deckung: ' + (ok + schlecht) + ' Proben, ' + ok + ' gruen, ' + schlecht + ' rot.');
console.log('   Gegentest: der alte Stand fand "Bismarckstraße" als "'
  + f1.alt + '" — ' + (f1.alt === 'keiner'
    ? 'genau der gemeldete Fehler, und er ist jetzt behoben.'
    : 'ACHTUNG: der alte Stand war hier nicht kaputt, die Aenderung braucht eine andere Begruendung.'));
process.exit(schlecht ? 1 : 0);
