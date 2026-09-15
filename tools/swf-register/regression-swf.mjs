/* ═══════════════════════════════════════════════════════════════════════
   Regressionsstrecke über ALLE Sachwertfaktor-Sätze des Registers
   ═══════════════════════════════════════════════════════════════════════
   Entstanden am 15.09.2026 nach neun Versionen an einem Tag (v1397–v1409).
   Die Frage war schlicht: bricht irgendwo etwas?

   WAS GEPRÜFT WIRD — und was ausdrücklich NICHT:

     geprüft   Kein Satz wirft einen technischen Fehler.
     geprüft   Jeder gelieferte Wert liegt im Band seiner Einheit.
     geprüft   Die KETTE von der gedruckten Zahl zum Faktor: aus
               `dokumentwert` muss über die Einheit genau `wert` werden.
     NICHT     Ob ein Satz überhaupt liefert. Viele brauchen Angaben, die
               ein einzelnes Testobjekt nicht haben kann — eine
               Standardstufe, eine Gemeinde, eine Bandachse. „Kein Wert"
               ist dort eine AUSKUNFT, kein Fehler, und die Gründe werden
               gezählt statt beklagt.

   ═══ WAS `einheit` BEDEUTET — zweimal falsch gelesen, hier festgehalten ══

   `r.einheit` ist die **Dokumenteinheit**: wie der BERICHT die Zahl druckt.
   Sie sagt nichts über die Einheit von `r.wert`.

     r.dokumentwert   die Zahl aus dem Bericht  (90,86 · 26 · 1,02)
     r.einheit        in welcher Einheit sie steht
                      ('prozent' · 'zuschlag_prozent' · 'faktor' · 'eur')
     r.wert           IMMER der Faktor — außer bei 'eur'

   Der Auswerter rechnet in `IN_FAKTOR` um (swf_modelle.js:982) und hat dafür
   einen eigenen Wächter (`einheit_unplausibel`). Zwei Sätze sind mir hier
   nacheinander durch die Lappen gegangen, weil ich `einheit` für die Einheit
   des Ergebnisses hielt:

     Stadt Paderborn      `linear_sachwert`, einheit 'eur'      → 308.942 €
        Ein Euro-BETRAG, kein Faktor. Sah nach einem entgleisten Faktor aus,
        war der einzige Fall, in dem `wert` wirklich nicht der Faktor ist.
     Kreis Lippe/Detmold  `doppel_log`, einheit 'prozent'       → 0,9086
        Der Bericht druckt 90,86 %, `wert` ist längst der Faktor 0,9086.
        Gegen ein Prozentband geprüft, fiel die korrekte Zahl durch.
     Stadt Dortmund       `stufen_1d`, 'zuschlag_prozent'       → 1,26
        Der Bericht druckt +26 Prozentpunkte, `wert` ist 1 + 26/100. Dieser
        Satz lief STILL durch, weil 1,26 zufällig im Faktorband liegt —
        die gefährlichere Hälfte desselben Fehlers.

   Deshalb prüft dieser Lauf die Umrechnung selbst nach, statt ihr zu
   glauben: die Zeile `KETTE` unten spiegelt `IN_FAKTOR`.

   Aufruf im Container:
     docker exec dealpilot-mb-backend node /tmp/regression-swf.mjs
   ═══════════════════════════════════════════════════════════════════════ */
import reg from '/app/src/lib/ausschuss_register.js';
import { sachwertfaktor } from '/app/src/lib/gutachterausschuss.js';
import fs from 'fs';

reg.ladeSaat();

const D = '/app/src/lib/register/';
const saetze = [];
for (const f of fs.readdirSync(D).filter((x) => x.endsWith('.json'))) {
  let j; try { j = JSON.parse(fs.readFileSync(D + f, 'utf8')); } catch (e) { continue; }
  for (const s of (Array.isArray(j) ? j : (j.saetze || []))) {
    if (s.kennzahl === 'sachwertfaktor') saetze.push(s);
  }
}

/* Ein Objekt, das möglichst viele Modelle bedienen kann. Die Feldnamen
   decken beide Schreibweisen ab (kurz und lang), weil die Brücke in
   gutachterausschuss.js sie ineinander übersetzt. */
const OBJ = {
  sachwert_eur: 320000, vorlaeufiger_sachwert_eur: 320000, sachwert: 320000,
  brw_eur_qm: 250, brw: 250, lagewert: 250, normbrw20: 630,
  rnd_jahre: 40, rnd: 40, bgf_qm: 250, bgf: 250,
  grundstuecksflaeche_qm: 600, flaeche_qm: 600, gsfl: 600, gsflaeche: 600,
  baulandflaeche_qm: 600, baugrundstuecksflaeche_qm: 600,
  wohnflaeche_qm: 150, wohnflaeche: 150, wfl: 150,
  baujahr: 1985, standardstufe: 3, gebaeudestandard: 3,
  mod_punkte: 3.53, unterkellerung: 'ohne', keller: 'ohne',
  sachwertverhaeltnis: 1, bodenwertanteil: 0.60,
  ecklage: 'nein', wohnungszahl: 1, einbaukueche: 'nein',
  dachform: '1-geschossig mit Dachgeschossausbau', fussbodenheizung: 'nein',
  solarenergie: 'nein', waermepumpe: 'nein', stellung: 'freistehend',
  aktualisierungsfaktor: 0.973,
};

/* `wert` ist der Faktor — nur der Euro-Betrag hat sein eigenes Band. */
const FAKTORBAND = [0.3, 3.0];
const EUROBAND   = [20000, 3000000];

/* Spiegel von IN_FAKTOR (swf_modelle.js:982). Steht hier ABSICHTLICH noch
   einmal: ein Prüfstand, der die zu prüfende Funktion aufruft, prüft nichts.
   Weicht diese Tabelle künftig vom Auswerter ab, meldet der Lauf das als
   Kettenbruch — und genau dann soll jemand hinsehen. */
const KETTE = {
  faktor:           (v) => v,
  prozent:          (v) => v / 100,
  zuschlag_prozent: (v) => 1 + v / 100,
};

let geliefert = 0, ohneWert = 0, fehler = 0;
const gruende = {}, einheiten = {}, ausreisser = [], kaputt = [], kette = [];

for (const s of saetze) {
  const wer = (s.gaa_name || '?').slice(0, 34) + ' [' + s.zweig + ']';
  let r;
  try {
    r = sachwertfaktor({ ...OBJ, ags: s.ags, objektart: s.zweig, zweig: s.zweig });
  } catch (e) {
    fehler++;
    kaputt.push(wer + ': ' + e.message);
    continue;
  }
  if (!(r && r.verfuegbar && typeof r.wert === 'number')) {
    ohneWert++;
    const g = (r && r.grund) || 'unbekannt';
    gruende[g] = (gruende[g] || 0) + 1;
    continue;
  }

  geliefert++;
  const eh = r.einheit || 'faktor';
  const istEuro = (eh === 'eur' || r.liefert === 'wert_eur');
  einheiten[eh] = (einheiten[eh] || 0) + 1;

  const b = istEuro ? EUROBAND : FAKTORBAND;
  if (r.wert < b[0] || r.wert > b[1]) {
    ausreisser.push(wer + ' = ' + r.wert + '  (einheit ' + eh
      + (istEuro ? ', Euro-Band' : ', Faktorband') + ')');
  }

  /* Die Kettenprüfung: was der Bericht druckt, muss über die Einheit auf
     den Faktor führen. Sie greift nur, wo beide Zahlen vorliegen — der
     Euro-Zweig kennt keine Umrechnung, er IST die Ausgabeeinheit. */
  if (!istEuro && typeof r.dokumentwert === 'number') {
    const um = KETTE[eh];
    if (!um) {
      kette.push(wer + ': Einheit "' + eh + '" kennt dieser Lauf nicht — '
        + 'ungeprüft durchgelassen zu werden wäre schlimmer als rot zu sein.');
    } else {
      const soll = Math.round(um(r.dokumentwert) * 10000) / 10000;
      if (Math.abs(soll - r.wert) > 0.0001) {
        kette.push(wer + ': Bericht druckt ' + r.dokumentwert + ' ' + eh
          + ' → erwartet ' + soll + ', geliefert ' + r.wert);
      }
    }
  }
}

console.log('=== REGRESSIONSSTRECKE · Sachwertfaktoren ===\n');
console.log('Sätze geprüft                   : ' + saetze.length);
console.log('  liefern einen Wert            : ' + geliefert);
console.log('  liefern begründet KEINEN Wert : ' + ohneWert);
console.log('  TECHNISCHER FEHLER            : ' + fehler);

console.log('\nDokumenteinheiten — so druckt der jeweilige Bericht die Zahl');
console.log('(der gelieferte `wert` ist überall der Faktor, außer bei eur):');
Object.entries(einheiten).sort((a, b) => b[1] - a[1]).forEach(([e, n]) =>
  console.log('  ' + String(n).padStart(4) + '  ' + e));

console.log('\nWarum kein Wert — das sind Auskünfte, keine Fehler:');
Object.entries(gruende).sort((a, b) => b[1] - a[1]).forEach(([g, n]) =>
  console.log('  ' + String(n).padStart(4) + '  ' + g));

if (ausreisser.length) {
  console.log('\n>>> WERTE AUSSERHALB IHRES BANDES <<<');
  ausreisser.slice(0, 15).forEach((a) => console.log('  ' + a));
} else {
  console.log('\nAlle gelieferten Werte liegen im Band ihrer Einheit.');
}

console.log('\nKettenprüfung Dokumentwert → Faktor:');
if (kette.length) {
  console.log('  >>> DIE UMRECHNUNG STIMMT NICHT <<<');
  kette.slice(0, 15).forEach((k) => console.log('  ' + k));
} else {
  console.log('  bestanden — jede gedruckte Zahl führt auf ihren Faktor');
}

if (kaputt.length) {
  console.log('\n>>> TECHNISCHE FEHLER <<<');
  kaputt.slice(0, 15).forEach((k) => console.log('  ' + k));
}

const ok = (fehler === 0 && ausreisser.length === 0 && kette.length === 0);
console.log('\n' + '='.repeat(60));
console.log(ok ? 'BESTANDEN — kein Satz bricht, kein Wert entgleist,'
               + '\n           jede Umrechnung trägt'
               : 'BEFUNDE — siehe oben');
process.exit(ok ? 0 : 1);
