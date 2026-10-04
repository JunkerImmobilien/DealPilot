'use strict';
/* pruef-unterlagen.js — v1833
 *
 * Prüft `unterlagenService` an der ECHTEN Datei. Der Teil, auf den es
 * ankommt, ist die BELEGPRÜFUNG: sie entscheidet, ob eine Mailadresse als
 * bestätigt gilt oder mit Warnung ausgeliefert wird.
 *
 *   > Lieber eine Adresse mit Warnung als eine ohne Zweifel. Wer eine
 *   > unbelegte Adresse stillschweigend anbietet, lässt den Nutzer in
 *   > seinem Namen an die falsche Stelle schreiben.
 *
 * Läuft im Container:
 *   docker exec dealpilot-backend node /app/tools/agent-pruefung/pruef-unterlagen.js
 *
 * Die KI-Recherche wird NICHT gefahren — sie kostet und hängt vom Netz ab.
 * Geprüft wird alles drumherum, und das ist der Teil, der still falsch
 * sein kann.
 */
const path = require('path');
const fs = require('fs');

const _orte = [
  path.join(__dirname, '..', '..', 'backend', 'src', 'services', 'unterlagenService.js'),
  path.join(__dirname, '..', '..', 'src', 'services', 'unterlagenService.js')
];
const _quelle = _orte.find((p) => fs.existsSync(p));
if (!_quelle) { console.log('ABBRUCH: unterlagenService.js nicht gefunden.'); process.exit(2); }
const u = require(_quelle);

let ok = 0, schlecht = 0;
const zeilen = [];
function pruefe(name, bedingung, hinweis) {
  if (bedingung) { ok++; zeilen.push('  [ok]   ' + name); }
  else { schlecht++; zeilen.push('  [NEIN] ' + name + (hinweis ? ' — ' + hinweis : '')); }
}

console.log('== pruef-unterlagen (v1833) ==');
console.log('   Quelle: ' + _quelle);
console.log('');

/* ── 1 · Die fünf Arten, vollständig ─────────────────────────────────── */
pruefe('fünf Unterlagenarten', u.ARTEN.length === 5, 'sind ' + u.ARTEN.length);
for (const a of u.ARTEN) {
  pruefe('„' + a.name + '" hat Regel, Betreff und Bitte',
    Boolean(a.id && a.name && a.regel && a.betreff && a.bitte));
}
/* Die Rechtsgrundlage beim Grundbuch ist kein Schmuck — ohne das
   berechtigte Interesse nach § 12 GBO gibt es keinen Auszug. */
pruefe('Grundbuch nennt § 12 GBO', /§\s*12\s*GBO/.test(u.ARTEN_MAP.grundbuch.bitte));
pruefe('Baulasten nennt die Besonderheit in Bayern', /Bayern/.test(u.ARTEN_MAP.baulasten.regel));

/* ── 2 · Der Gemeindeschlüssel ───────────────────────────────────────── */
pruefe('Gemeindeschlüssel normalisiert',
  u.gemeindeSchluessel('32609', 'Hüllhorst') === '32609-hüllhorst',
  'bekam: ' + u.gemeindeSchluessel('32609', 'Hüllhorst'));
pruefe('Gemeindeschlüssel ist schreibweisenunabhängig',
  u.gemeindeSchluessel('32609', 'HÜLLHORST') === u.gemeindeSchluessel('32609', 'hüllhorst'));
pruefe('Gemeindeschlüssel trennt zwei Orte',
  u.gemeindeSchluessel('32609', 'Hüllhorst') !== u.gemeindeSchluessel('32120', 'Hiddenhausen'));
pruefe('Ort mit Zusatz bleibt unterscheidbar',
  u.gemeindeSchluessel('06184', 'Kabelsketal OT Großkugel')
    !== u.gemeindeSchluessel('06184', 'Kabelsketal'));

/* ── 3 · Gewerbliche Portale erkennen ────────────────────────────────── */
const gewerblich = [
  'https://www.katasteramt-online.de/bestellen',
  'https://baulastenverzeichnis-online.de/nrw',
  'https://grundbuchauszug24.de',
  'https://geoindex.de/flurkarte',
  /* v1833c · DIESE DREI SIND GEMESSEN, NICHT AUSGEDACHT. Der erste kam
     am 04.10.2026 aus einer echten Recherche für Hüllhorst zurück und
     rutschte durch das damalige Muster — es kannte „portal" nur als
     Nachsilbe. Gehalten hat nur die Belegprüfung. */
  'https://portal-grundbuchamt.de/grundbuchamt/Nordrhein-Westfalen/32609-Huellhorst/antragsformular',
  'https://mein-grundbuchauszug.de/bestellen',
  'https://www.flurkarte-express.de/nrw'
];
for (const url of gewerblich) {
  pruefe('erkennt gewerblich: ' + url.slice(8, 40), u.istGewerblich(url) === true);
}
const amtlich = [
  'https://www.kreis-minden-luebbecke.de/kataster',
  'https://www.bielefeld.de/bauordnung',
  'https://justiz.nrw.de/grundbuchamt',
  'https://service.sachsen.de/altlasten',
  'https://www.hiddenhausen.de/rathaus/bauamt'
];
for (const url of amtlich) {
  pruefe('erkennt amtlich: ' + url.slice(8, 40), u.istGewerblich(url) === false,
    'wurde faelschlich als gewerblich gewertet');
}

/* ── 4 · Die Belegprüfung, ohne Netz ─────────────────────────────────── */
(async () => {
  const f1 = await u.belegPruefen('', 'https://beispiel.de');
  pruefe('ohne Adresse: kein Beleg', f1.ok === false && /keine Adresse/i.test(f1.grund));
  const f2 = await u.belegPruefen('a@b.de', '');
  pruefe('ohne Quelle: kein Beleg', f2.ok === false && /keine Quelle/i.test(f2.grund));
  const f3 = await u.belegPruefen('a@b.de', 'https://www.katasteramt-online.de/x');
  pruefe('gewerbliche Quelle: kein Beleg',
    f3.ok === false && /gewerbliches Portal/i.test(f3.grund), f3.grund);
  const f4 = await u.belegPruefen('a@b.de', 'https://dieseseitegibtesnicht.invalid/x');
  pruefe('unerreichbare Quelle: kein Beleg, mit Grund',
    f4.ok === false && Boolean(f4.grund), JSON.stringify(f4));

  /* ── 5 · Das Anschreiben ───────────────────────────────────────────── */
  const mit = u.anschreiben('grundbuch',
    { strasse: 'Hermannstraße 9', plz: '32609', ort: 'Hüllhorst',
      gemarkung: 'Hüllhorst', flur: '3', flurstueck: '45' },
    { name: 'Marcel Junker', firma: 'Junker Solution', vollmacht_liegt_bei: true });
  pruefe('Anschreiben nennt die Adresse', /Hermannstraße 9/.test(mit.text));
  pruefe('Anschreiben nennt Gemarkung, Flur und Flurstück',
    /Gemarkung Hüllhorst/.test(mit.text) && /Flur 3/.test(mit.text)
    && /Flurstück 45/.test(mit.text));
  pruefe('Betreff trägt die Adresse', /Hermannstraße 9/.test(mit.betreff));
  pruefe('mit Vollmacht: "liegt diesem Schreiben bei"',
    /liegt diesem Schreiben bei/.test(mit.text));

  const ohne = u.anschreiben('grundbuch',
    { strasse: 'Hermannstraße 9', plz: '32609', ort: 'Hüllhorst' },
    { name: 'Marcel Junker' });
  /* DER PUNKT: ohne Vollmacht darf dort NICHT stehen, sie liege bei. Ein
     Satz über eine Anlage, die fehlt, kostet den Vorgang eine Runde. */
  pruefe('ohne Vollmacht: KEIN "liegt bei"',
    !/liegt diesem Schreiben bei/.test(ohne.text), 'der Brief behauptet eine Anlage, die fehlt');
  pruefe('ohne Vollmacht: bietet Nachreichen an', /nachreichen/i.test(ohne.text));
  /* HIER STAND EIN FEHLER IN DIESEM PRUEFER: er las Zeile 5 und prüfte sie
     unter anderem gegen `^\s*$` — und Zeile 5 IST eine Leerzeile, von
     Anfang an und mit Absicht. Die Probe schlug also fehl, obwohl der
     Brief richtig war.

       > Ein Pruefer, der die falsche Zeile misst, meldet einen Fehler,
       > den es nicht gibt — und kostet die Zeit, die er sparen soll.

     Richtig gemessen: ohne Flurangaben darf keines dieser Wörter im Brief
     stehen. Das ist, was die Probe sagen wollte. */
  pruefe('ohne Flurstück: keine Flurzeile im Brief',
    !/Gemarkung|Flurstück/.test(ohne.text),
    'der Brief nennt Flurangaben, die es nicht gibt');

  /* Unbekannte Art muss abbrechen, nicht leise einen leeren Brief bauen. */
  let geworfen = false;
  try { u.anschreiben('baugenehmigung', {}, {}); } catch (e) { geworfen = true; }
  pruefe('unbekannte Unterlagenart bricht ab', geworfen);

  console.log(zeilen.join('\n'));
  console.log('');
  console.log('   Deckung: ' + (ok + schlecht) + ' Pruefungen, ' + ok + ' gruen, ' + schlecht + ' rot.');
  console.log('   NICHT geprueft: die KI-Recherche selbst (kostet und haengt am Netz).');
  process.exit(schlecht ? 1 : 0);
})().catch((e) => {
  console.log(zeilen.join('\n'));
  console.log('   ABBRUCH: ' + (e && e.stack || e));
  process.exit(2);
});
