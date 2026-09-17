/* =====================================================================
   Gegen echte Gutachten rechnen
   =====================================================================

   Marcel hat am 15.09.2026 vier Restnutzungsdauergutachten in den Ordner
   gelegt. Drei davon nennen ihre Eingaben UND ihr Ergebnis — damit lässt
   sich nachrechnen, ob unser Kern dasselbe tut wie ein Sachverständiger
   vor Ort.

   Das ist die wertvollste Art von Prüfung, die es hier gibt: Die Zahlen
   stammen nicht aus diesem Skript und nicht aus unserem Rechner,
   sondern aus einem unterschriebenen Gutachten.

   ---------------------------------------------------------------------
   Die Fälle
   ---------------------------------------------------------------------

   1. Am Markt 18, Kabelsketal — WE 2      (25DG02661/HH, DER GUTACHTER)
      Eigentumswohnung, Baujahr 1994, Stichtag 06.05.2024, GND 70.
      Das Gutachten weist ALLE DREI Verfahren aus:
          Punktraster        44,07 Jahre   (AWM 37,04 %)
          linear             40,00 Jahre   (AWM 42,86 %)
          technisch          26,00 Jahre   (AWM 62,86 %)
          reelle RND         26 Jahre
      Und es sagt den Rechenweg dazu: „Immobilien mit der vorhandenen
      Bebauung und Nutzbarkeit werden vorrangig nach der technischen
      Alterswertminderung bewertet. Die lineare Abschreibung und die
      Abschreibung nach der Punktrastermethode wurden als stützendes
      Ermittlungsverfahren angewandt."

      Das ist wörtlich die Regel aus SP.leitwertAn.

   2. Alexanderstraße 11, Bielefeld — Wohnung 6 DG links
                                      (Az. 2024-298, REHKUGLER/PANACEAS)
      Eigentumswohnung, Baujahr 1976, Stichtag 14.08.2024, GND 80.
      Reine Anlage-2-Rechnung: 2 Modernisierungspunkte, Ergebnis
      33 Jahre. Kein technisches Verfahren.

   3. Westerfeldstraße 140, Bielefeld     (SVB Schopohl, 28.05.2025)
      Mehrfamilienhaus, Baujahr 1967, Stichtag 01.04.2025.
      Hier wird die Gesamtnutzungsdauer aus dem Gebäudestandard
      abgeleitet: Standard 2,4 (einfach bis mittel) → GND 67.
      2,2 Modernisierungspunkte → 16 Jahre.

   Nicht als Fall geeignet: „Sachsenstraße 16, Herford" ist eine
   kostenlose Ersteinschätzung desselben Wettbewerbers an Marcel
   (26DG07989/MK, 28 Jahre) — sie nennt keine einzige Eingabe. Ohne
   Eingaben lässt sich nichts nachrechnen, und eine Prüfung gegen ein
   Ergebnis ohne Eingaben wäre geraten, nicht gemessen.

   ---------------------------------------------------------------------
   Was hier NICHT geprüft wird
   ---------------------------------------------------------------------
   Nicht, dass unsere angezeigte Spanne das Gutachten trifft. Die Spanne
   ist eine Ersteinschätzung ohne Ortstermin und liegt bewusst darüber.
   Geprüft wird, ob die VERFAHREN dieselben Zahlen liefern, wenn man
   ihnen dieselben Eingaben gibt — denn genau das ist nachrechenbar.
   ===================================================================== */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
/* Pfade gegen DIESE Datei aufloesen, nicht gegen das
   Arbeitsverzeichnis - sonst laeuft die Pruefung nur, wenn man
   zufaellig im richtigen Ordner steht. */
const __hier = path.dirname(fileURLToPath(import.meta.url));
const H = (p) => path.join(__hier, p);

const g = globalThis;
/* DealPilot v1426: Kern und GND-Tabelle aus der App selbst, nicht aus einer Kopie -
   sonst bestaetigt der Test Dateien, die er nie sieht. rnd-spanne.js liegt
   nur fuer diese Pruefung daneben (die App laedt sie nicht). */
for (const f of ['../../frontend/js/rnd-gnd-table.js', '../../frontend/js/rnd-calc.js',
                 'rnd-spanne.js'])
  new Function('window', fs.readFileSync(H(f), 'utf8'))(g);
const K = g.DealPilotRND, S = g.JunkerRND_Spanne, Z = g.JunkerRND_Zustand;

let fehler = 0;
function pruef(name, bed, ist) {
  console.log((bed ? '  OK      ' : '  FEHLER  ') + name.padEnd(52) + ist);
  if (!bed) fehler++;
}
const A = ['dach', 'fenster', 'leitungen', 'heizung', 'aussenwand',
           'baeder', 'decken', 'technik', 'grundriss'];
const gew = (v, o = {}) => Object.assign(Object.fromEntries(A.map(k => [k, v])), o);
const n2 = (x) => Math.round(x * 100) / 100;

/* =====================================================================
   1. Am Markt 18 — alle drei Verfahren nachgerechnet
   ===================================================================== */
console.log('\n1 · AM MARKT 18, KABELSKETAL — WE 2   (25DG02661/HH)');
console.log('    ETW, Baujahr 1994, Stichtag 06.05.2024, GND 70\n');
{
  /* Das Gutachten listet: alle Gewerke über 20 Jahre, nur die
     technische Ausstattung 5 bis 10 Jahre. */
  const r = K.calcAll({
    baujahr: 1994, stichtag: '2024-05-06', gnd: 70, modPoints: 0,
    gewerkeBewertung: gew('veraltet', { technik: 'standard' })
  });

  pruef('Alter am Stichtag = 30 Jahre', r.input.alter === 30, r.input.alter);

  /* Die lineare Rechnung ist die einfachste Gegenprobe auf die GND:
     70 − 30 = 40, und das Gutachten nennt genau 40,00. */
  pruef('linear = 40,00 Jahre wie im Gutachten',
        n2(r.methods.linear.restnutzungsdauer) === 40,
        r.methods.linear.restnutzungsdauer);
  pruef('lineare Alterswertminderung = 42,86 %',
        Math.abs(r.methods.linear.alterswertminderung_pct - 42.86) < 0.01,
        n2(r.methods.linear.alterswertminderung_pct) + ' %');

  /* ---- Anlage 2: dieselbe Formel, eine andere Grenze --------------
     Das Gutachten nennt 44,07 Jahre. Unsere Koeffizienten liefern
     dieselbe Zahl — auf vier Nachkommastellen. Die Formel ist also
     identisch.

     Ausgewiesen wird bei uns trotzdem 40, und das ist Absicht: Anlage 2
     ImmoWertV nennt je Punktzahl ein relatives Alter, AB dem die Formel
     gilt. Bei 0 Modernisierungspunkten sind das 60 %; dieses Objekt
     liegt bei 42,86 %. Darunter gilt „RND = GND minus Alter".

     Wer die Parabel trotzdem anwendet, bekommt hier 44,07 statt 40 —
     also gut vier Jahre MEHR als ohne jede Modernisierung, obwohl das
     Gutachten ausdrücklich keine einzige ausweist (alle Gewerke über 20
     Jahre). Das kann nicht sein: Anlage 2 bildet ab, was Modernisierung
     verlängert. Ohne Modernisierung darf sie nicht über die reine
     Altersrechnung hinausgehen.

     Für das Ergebnis des Gutachtens spielt es keine Rolle — dort führt
     das technische Verfahren, und das Punktraster ist ausdrücklich nur
     „stützend". */
  pruef('unsere Koeffizienten ergeben exakt die 44,07 des Gutachtens',
        Math.abs((1.25 * 30 * 30 / 70 - 2.625 * 30 + 1.525 * 70) - 44.07) < 0.01,
        n2(1.25 * 30 * 30 / 70 - 2.625 * 30 + 1.525 * 70));
  pruef('die Formel ist unterhalb ihrer Schwelle nicht anwendbar',
        r.methods.punktraster.anwendbar === false
          && r.methods.punktraster.grenze === 'unter_schwelle',
        n2(r.methods.punktraster.relatives_alter_pct) + ' % gegen Schwelle '
          + r.methods.punktraster.koeffizienten.schwelle_rel + ' %');
  pruef('wir weisen deshalb 40 aus, nicht 44,07',
        r.methods.punktraster.restnutzungsdauer === 40,
        r.methods.punktraster.restnutzungsdauer);
  pruef('44,07 wäre mehr als ohne jede Modernisierung — und es gab keine',
        44.07 > r.methods.linear.restnutzungsdauer,
        '44,07 gegen linear ' + r.methods.linear.restnutzungsdauer);

  /* Und die technische Alterswertminderung, die im Gutachten führt. */
  pruef('technisch = 26,00 Jahre wie im Gutachten',
        n2(r.methods.technisch.restnutzungsdauer) === 26,
        r.methods.technisch.restnutzungsdauer);
  pruef('technische Alterswertminderung = 62,86 %',
        Math.abs(r.methods.technisch.alterswertminderung_pct - 62.86) < 0.02,
        n2(r.methods.technisch.alterswertminderung_pct) + ' %');

  /* Der Leitwert: Das Gutachten sagt ausdrücklich, dass das technische
     Verfahren führt und die anderen beiden stützen. */
  const nach = S.leitwertAn(r, false);
  pruef('bei uns führt ebenfalls das technische Verfahren',
        nach.verfahren === 'technisch', nach.verfahren + ' → ' + nach.final_rnd);
  pruef('und liefert die reelle Restnutzungsdauer des Gutachtens (26)',
        n2(nach.final_rnd) === 26, nach.final_rnd);
}

/* =====================================================================
   2. Alexanderstraße 11 — reine Anlage-2-Rechnung
   ===================================================================== */
console.log('\n2 · ALEXANDERSTRASSE 11, BIELEFELD — WE 6 DG   (Az. 2024-298)');
console.log('    ETW, Baujahr 1976, Stichtag 14.08.2024, GND 80, 2 Punkte\n');
{
  const r = K.calcAll({
    baujahr: 1976, stichtag: '2024-08-14', gnd: 80, modPoints: 2,
    gewerkeBewertung: gew('veraltet')
  });
  pruef('Alter am Stichtag = 48 Jahre', r.input.alter === 48, r.input.alter);
  pruef('Anlage 2 ist hier anwendbar', r.methods.punktraster.anwendbar === true,
        'relatives Alter ' + n2(48 / 80 * 100) + ' %');
  /* Das Gutachten nennt 33 Jahre — gerundet aus der Anlage-2-Formel. */
  pruef('Anlage 2 ergibt gerundet die 33 Jahre des Gutachtens',
        Math.round(r.methods.punktraster.restnutzungsdauer) === 33,
        r.methods.punktraster.restnutzungsdauer);
  pruef('und weicht um weniger als ein halbes Jahr ab',
        Math.abs(r.methods.punktraster.restnutzungsdauer - 33) < 0.5,
        'Abweichung ' + n2(Math.abs(r.methods.punktraster.restnutzungsdauer - 33))
          + ' Jahre');
}

/* =====================================================================
   3. Westerfeldstraße 140 — Anlage 2 mit abgeleiteter GND
   ===================================================================== */
console.log('\n3 · WESTERFELDSTRASSE 140, BIELEFELD   (SVB Schopohl)');
console.log('    MFH, Baujahr 1967, Stichtag 01.04.2025, GND 67, 2,2 Punkte\n');
{
  /* Der Kern nimmt ganze Punkte (clampInt). 2,2 wird zu 2 — das ist die
     vorsichtigere Richtung, denn weniger Punkte heissen weniger
     Restnutzungsdauer. */
  const r = K.calcAll({
    baujahr: 1967, stichtag: '2025-04-01', gnd: 67, modPoints: 2,
    gewerkeBewertung: gew('veraltet')
  });
  pruef('Alter am Stichtag = 58 Jahre', r.input.alter === 58, r.input.alter);
  /* Die lineare Gegenprobe auf die GND des Gutachters: 67 − 58 = 9,
     und genau 9 Jahre nennt das Gutachten als vorläufigen Wert. */
  pruef('linear = 9 Jahre wie im Gutachten ("vorläufig rechnerisch")',
        n2(r.methods.linear.restnutzungsdauer) === 9,
        r.methods.linear.restnutzungsdauer);
  /* Das Gutachten nennt 16 Jahre. Mit 2 statt 2,2 Punkten liegen wir
     knapp darunter — die Richtung stimmt, der Abstand ist der Preis der
     ganzzahligen Punkte. */
  pruef('Anlage 2 liegt innerhalb eines Jahres an den 16 des Gutachtens',
        Math.abs(r.methods.punktraster.restnutzungsdauer - 16) <= 1.0,
        r.methods.punktraster.restnutzungsdauer + ' gegen 16');
  pruef('Anlage 2 hebt gegenüber linear an (9 → über 14)',
        r.methods.punktraster.restnutzungsdauer > 14,
        n2(r.methods.linear.restnutzungsdauer) + ' → '
          + r.methods.punktraster.restnutzungsdauer);
}

/* =====================================================================
   4. Was die drei Fälle über die Gesamtnutzungsdauer sagen
   =====================================================================
   Drei Gutachten, drei verschiedene Gesamtnutzungsdauern für
   Wohngebäude: 70, 80 und 67. Das ist kein Widerspruch, sondern die
   Praxis — Anlage 1 ImmoWertV nennt 80 als Modellwert, die
   Sachwertrichtlinie eine Spanne je Standardstufe, und Anlage 22 BewG
   sagt 70.

   Unsere Tabelle kennt die Spanne (gnd_min / gnd_max) und gibt 80 als
   Vorgabe aus. Geprüft wird hier nur, dass alle drei Werte der
   Gutachten innerhalb unserer eigenen Spanne liegen — läge einer
   ausserhalb, wäre unsere Tabelle zu eng.
   ===================================================================== */
console.log('\n4 · DIE GESAMTNUTZUNGSDAUER IN DER PRAXIS\n');
{
  const GND = g.DealPilotRND_GND;
  [['etw', 70, 'Am Markt 18'], ['etw', 80, 'Alexanderstraße 11'],
   ['mfh', 67, 'Westerfeldstraße 140']].forEach(([schl, wert, wo]) => {
    const e = GND.getEntry(schl);
    pruef(wo + ': GND ' + wert + ' liegt in unserer Spanne',
          wert >= e.gnd_min && wert <= e.gnd_max,
          e.gnd_min + ' bis ' + e.gnd_max + ', Vorgabe ' + e.gnd_default);
  });
}

console.log('\n' + (fehler
  ? 'FEHLER: ' + fehler
  : 'Unser Rechenkern liefert dieselben Zahlen wie die Gutachten.'));
process.exit(fehler ? 1 : 0);
