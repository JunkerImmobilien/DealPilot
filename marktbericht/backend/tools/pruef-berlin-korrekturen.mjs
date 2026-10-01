/* ════════════════════════════════════════════════════════════════════════════
   Prüfstrecke: feuern die Berliner Korrekturen?

   Befund am 01.10.2026: drei der vier Korrekturen trugen
   `art: "stufen_kategorial"` — eine Art, die ZWEI Größen braucht (eine
   Kategorie aus `kategorie_feld` und eine Zahl aus `feld`). Sie hatten
   kein `kategorie_feld`, also war `kat` leer, also `return null`
   (`swf_modelle.js:846`). Die Korrekturen feuerten nie; der Zinssatz blieb
   um bis zu 0,9 Prozentpunkte daneben, und es sah richtig aus.

   > Eine Korrektur, die nie feuert, ist schlimmer als keine: ihr Eintrag im
   > Register behauptet, der Wert sei angepasst worden.

   Dieser Prüfer fährt das ECHTE Modell des Satzes (`formel.form`
   = `stufen_1d`) durch den ECHTEN Auswerter. Kein Minimalmodell, keine
   Nachbildung — und er nennt seine Deckung, bevor er urteilt.

   > Ein erster Entwurf baute ein eigenes `{art:'stufen'}`-Modell und bekam
   > überall `null`. Der Satz heißt `form`, nicht `art`, und das Modell
   > steht in `formel`. Ein Prüfer, der sein Prüfobjekt selbst erfindet,
   > misst sich selbst — hier fiel es nur auf, weil ALLE acht Fälle
   > fehlschlugen.
   ════════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import { auswerten } from '../src/lib/swf_modelle.js';

const P = new URL('../src/lib/register/berlin.json', import.meta.url);
const saetze = JSON.parse(fs.readFileSync(P, 'utf8'));
const satz = saetze[0];
/* Die KENNZAHL gehoert ins Modell. `auswerten` prueft die Einheit gegen
   `BAND[modell.kennzahl]` (swf_modelle.js:1352) und nimmt ohne sie
   `sachwertfaktor` an — ein Zinssatz von 3 % faellt dann als
   `einheit_unplausibel` durch. Zweiter Werkzeugfehler in derselben Datei,
   und wieder machte er sich als Befund bemerkbar statt als Ausfall. */
const modell = Object.assign({}, satz.formel,
  { kennzahl: satz.kennzahl, korrekturen: satz.korrekturen || [] });

console.log('Deckung: ' + (satz.korrekturen || []).length + ' Korrekturen · Modellform '
  + satz.formel.form + ' · ' + satz.kennzahl + ' ' + satz.berichtsjahr);
if (!(satz.korrekturen || []).length) { console.error('AUSFALL: keine Korrekturen'); process.exit(1); }
if (modell.form !== 'stufen_1d') { console.error('AUSFALL: unerwartete Modellform'); process.exit(1); }

/* Die Achse auf eine abgedruckte Stützstelle legen: 9 EUR/m² -> 3,0 %.
   Damit ist der Grundwert bekannt und jede Abweichung ist die Korrektur.

   Der Auswerter liefert DEZIMAL (0.03 = 3 %) und rechnet die Korrekturen in
   Prozentpunkten selbst um. Verglichen wird deshalb in Prozentpunkten. */
const ACHSE = { objektkaltmiete_eur_m2_monat: 9 };
const basis = auswerten(modell, Object.assign({}, ACHSE));
const PP = (r) => (r && typeof r.wert === 'number')
  ? Math.round((r.wert - basis.wert) * 100000) / 1000 : null;
console.log('Grundwert bei 9 EUR/m²: ' + basis.wert
  + ' dezimal = ' + Math.round(basis.wert * 1000) / 10 + ' % (Stützstelle im Bericht: 3)');
if (Math.abs(basis.wert - 0.03) > 1e-9) {
  console.error('AUSFALL: Stützstelle nicht getroffen'); process.exit(1);
}

const FAELLE = [
  { bez: 'Altbezirk Weißensee',      e: { altbezirk: 'Weißensee' },      soll: 0.5 },
  { bez: 'Altbezirk Wedding',        e: { altbezirk: 'Wedding' },        soll: -0.3 },
  { bez: 'Altbezirk Steglitz',       e: { altbezirk: 'Steglitz' },       soll: 0.3 },
  { bez: 'Altbezirk Mitte (0)',      e: { altbezirk: 'Mitte' },          soll: 0 },
  { bez: 'Baujahr 1973-1990 West',   e: { baujahr: '1973–1990 West' },   soll: 0.2 },
  { bez: 'Wohnlage einfach',         e: { wohnlage: 'einfach' },         soll: 0.2 },
  /* 0,15 Pp wären die Tabellenzahl — der Bericht rundet aber auf 0,1 Pp
     (`rundung_stellen: 1`), also 3,15 % -> 3,2 %. Gemessen über die ganze
     Reihe: 0/10 % -> 3,0 · 50/80 % -> 3,2. Mein erster Soll-Wert von 0,15
     war falsch, nicht der Rechenweg.

     > Ein Soll-Wert, der die Rundungsregel der Quelle übergeht, macht einen
     > richtigen Rechenweg zum Fehlschlag — und das ist der Prüfbefund, der
     > am meisten Zeit kostet. */
  { bez: 'Gewerbeanteil 50 %',       e: { gewerbeanteil_prozent: 50 },   soll: 0.2 },
  /* Zwei zusammen: additiv, kein Ersetzen */
  { bez: 'Weißensee + einfach',      e: { altbezirk: 'Weißensee', wohnlage: 'einfach' }, soll: 0.7 },
  /* Unbekannter Schlüssel: KEINE Korrektur, auch nicht die eines Nachbarn */
  { bez: 'Altbezirk unbekannt',      e: { altbezirk: 'Gibtsnicht' },     soll: 0 },
  { bez: 'Wohnlage unbekannt',       e: { wohnlage: 'mittelpraechtig' }, soll: 0 }
];

let gut = 0, schlecht = 0;
for (const f of FAELLE) {
  const r = auswerten(modell, Object.assign({}, ACHSE, f.e));
  const ist = PP(r);
  const ok = ist !== null && Math.abs(ist - f.soll) < 1e-9;
  ok ? gut++ : schlecht++;
  const gefeuert = ((r && r.korrekturen) || [])
    .map((k) => k.merkmal + '=' + k.wert).join(', ') || '—';
  console.log((ok ? 'OK  ' : 'FEHL') + ' ' + String(f.bez).padEnd(24)
    + ' soll ' + String(f.soll).padStart(5)
    + '  ist ' + String(ist).padStart(5)
    + '   [' + gefeuert + ']');
}

/* ══ GEGENTEST: war die ALTE Form wirklich kaputt? ══════════════════════
   Ohne diesen Test beweist der Lauf oben nur, dass die neue Form geht —
   nicht, dass die alte nicht ging. Die alte Form wird hier rekonstruiert:
   `art: "stufen_kategorial"`, Tabelle unter `stufen`, kein
   `kategorie_feld`.

   > „Nachher richtig" ist kein Beweis für „vorher falsch". Wer nur den
   > neuen Stand prüft, kann eine Korrektur feiern, die nichts geändert
   > hat. */
console.log('\n-- Gegentest: die Form von vor v1768 --');
const altKorr = (satz.korrekturen || []).map(function (k) {
  if (k.art !== 'kategorial' || !k.werte) return k;
  var a = Object.assign({}, k);
  a.art = 'stufen_kategorial';
  a.stufen = a.werte;
  delete a.werte;
  return a;
});
const altModell = Object.assign({}, satz.formel,
  { kennzahl: satz.kennzahl, korrekturen: altKorr });
let totGefeuert = 0;
[{ altbezirk: 'Weißensee' }, { baujahr: '1973–1990 West' }, { wohnlage: 'einfach' }]
  .forEach(function (e) {
    const r = auswerten(altModell, Object.assign({}, ACHSE, e));
    const pp = PP(r);
    const feuert = pp !== null && Math.abs(pp) > 1e-9;
    if (feuert) totGefeuert++;
    console.log('     alte Form ' + JSON.stringify(e).padEnd(32)
      + ' Wirkung ' + String(pp).padStart(5) + ' Pp'
      + (feuert ? '   (sie feuerte doch?)' : '   feuert nicht — Defekt bestaetigt'));
  });
if (totGefeuert === 0) {
  gut++;
  console.log('OK   alle drei feuerten in der alten Form NIE — die Korrektur wirkt');
} else {
  schlecht++;
  console.log('FEHL die alte Form war nicht durchgaengig kaputt — Befund pruefen');
}

console.log('\n' + gut + ' von ' + (gut + schlecht) + ' richtig');
if (schlecht) process.exitCode = 1;
