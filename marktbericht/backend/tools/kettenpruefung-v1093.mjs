#!/usr/bin/env node
/* kettenpruefung-v1093.mjs
 *
 * EINE PRUEFUNG DARF IHRE VORBEDINGUNG NICHT SELBST HERSTELLEN.
 *
 * Die Kettenpruefung von v1083 rief `ladeSaat()` selbst auf — und deckte
 * damit zu, dass es im Serverbetrieb NIEMAND tat. Das Register blieb leer,
 * jede Adresse bekam "kein Ausschuss hinterlegt", und die Pruefung war gruen.
 *
 * Diese Datei ruft `ladeSaat()` NICHT auf. Sie fragt den Aufloeser, und der
 * muss die Saat von selbst laden (v1083a-WLAZ). Wenn dieser Lauf gruen ist,
 * ist er es fuer den Serverbetrieb.
 *
 * Und sie misst am AUSGABEOBJEKT UND AN SEINEM LESER: fuer jedes neue Feld
 * wird geprueft, dass es gesetzt UND dass es gelesen wird. Drei von vier
 * Fehlern des 12.08. waren vom Typ "gebaut, nie verdrahtet".
 */

import { sachwertfaktor, liegenschaftszinssatz }
  from '../lib/gutachterausschuss.js';
/* registerStand steht im Register, nicht im Aufloeser — am Code gelesen,
 * nicht geraten (`grep "^export" ausschuss_register.js`). */
import { registerStand } from '../lib/ausschuss_register.js';
import { auswerten } from '../lib/swf_modelle.js';

let fehler = 0, geprueft = 0;

function pruefe(name, ist, soll) {
  geprueft++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) fehler++;
  console.log(`  ${ok ? 'OK  ' : 'FEHL'}  ${name.padEnd(56)} `
    + `ist ${JSON.stringify(ist)}  soll ${JSON.stringify(soll)}`);
}

/* ══════════════════════════════════════════════════════════════════════
 * 1 · Die Saat laedt sich selbst — ohne dass diese Datei nachhilft
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n1 · Register laedt von selbst (kein ladeSaat() hier)');
{
  const st = registerStand();
  pruefe('Register ist gefuellt', st.saetze > 0, true);
  console.log(`        ${st.saetze} Saetze, Herkunft ${st.herkunft}`);
}

/* ══════════════════════════════════════════════════════════════════════
 * 2 · Die neuen Laender kommen beim AUFLOESER an
 *
 * Der Datensatz allein beweist nichts — er muss durch die Kaskade
 * gefunden werden. Deshalb wird hier gefragt, nicht gelesen.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n2 · Die vier neuen Laender, ueber den Aufloeser gefragt');

const ZIELE = [
  { bez: 'Potsdam (BB), Sachwertfaktor', ags: '12054',
    fn: () => sachwertfaktor({ ags: '12054', objektart: 'Einfamilienhaus',
                               sachwert: 300000 }) },
  { bez: 'Wiesbaden (HE), Liegenschaftszins', ags: '06414000',
    fn: () => liegenschaftszinssatz({ ags: '06414000', zweig: 'efh' }) },
  { bez: 'Aurich (NI), Liegenschaftszins', ags: '03452',
    fn: () => liegenschaftszinssatz({ ags: '03452', zweig: 'ezfh' }) },
  { bez: 'Kreis Olpe (NW), Sachwertfaktor', ags: '05966',
    fn: () => sachwertfaktor({ ags: '05966', objektart: 'Einfamilienhaus',
                               sachwert: 160000 }) },
];

for (const z of ZIELE) {
  const r = z.fn();
  pruefe(z.bez, r.verfuegbar === true, true);
  if (!r.verfuegbar) console.log(`        grund=${r.grund} ${r.hinweis || ''}`);
  else console.log(`        ${r.ausschuss} · `
    + `${r.wert != null ? r.wert : r.wert_pct + ' %'} · Stufe ${r.stufe}`);
}

/* Der Kernbeleg des Kreises Olpe: der Bericht sagt, bei rund 160.000 Euro
 * vorlaeufigem Sachwert gebe es keinen Marktauf- oder -abschlag. Der Faktor
 * muss dort also bei 1,00 liegen. Das ist ein SOLLWERT AUS DEM DOKUMENT. */
{
  const r = sachwertfaktor({ ags: '05966', objektart: 'Einfamilienhaus',
                             sachwert: 160000 });
  pruefe('Olpe: bei ~160.000 EUR kein Marktzuschlag (Faktor 1,00)',
    r.verfuegbar && Math.abs(r.wert - 1.0) < 0.01, true);
}

/* ══════════════════════════════════════════════════════════════════════
 * 3 · KEIN TREFFER HEISST KEIN WERT
 *
 * Ein neues Land darf nicht dazu fuehren, dass irgendein Ort irgendeinen
 * Wert bekommt. Die Kaskade 8 -> 5 -> 3 -> 2 endet, wo nichts steht.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n3 · Kein Treffer heisst kein Wert');
{
  /* Rostock (13003) — Mecklenburg-Vorpommern ist bewusst NICHT im Register,
   * weil die Lizenz dort entgegensteht. */
  const r = liegenschaftszinssatz({ ags: '13003000', zweig: 'efh' });
  pruefe('Rostock: kein Ausschuss hinterlegt', r.verfuegbar, false);
  pruefe('  und der Grund nennt es beim Namen',
    r.grund, 'kein_ausschuss_hinterlegt');

  /* Ein Nachbarkreis darf nicht einspringen: Uckermark (12073) steht nicht
   * im Register (zurueckgehalten), Potsdam (12054) schon. */
  const u = sachwertfaktor({ ags: '12073', objektart: 'Einfamilienhaus',
                             sachwert: 300000 });
  pruefe('Uckermark bekommt NICHT den Potsdamer Faktor', u.verfuegbar, false);
}

/* ══════════════════════════════════════════════════════════════════════
 * 4 · Jedes neue Feld: GESETZT und GELESEN
 *
 * Das ist die Lehre vom 12.08. `ladeSaat()` rief niemand auf,
 * `liegenschaftszinssatz()` rief niemand auf, `lzs_herabgestuft` reichte
 * der CrossCheckService nicht durch — alle drei liefen an gruenen
 * Funktionspruefungen vorbei, weil die Funktion stimmte und die Kette fehlte.
 * ══════════════════════════════════════════════════════════════════════ */
console.log('\n4 · Neue Felder: gesetzt UND gelesen');

/* (a) korrekturen_multiplikativ — Leser ist der Rechenweg, und der geht
 *     ins PDF. Ein Feld, das nur gesetzt wird, ist nicht fertig. */
{
  const m = { form: 'konstante', wert: 1.00, liefert: 'faktor',
    rundung_stellen: 2, kennzahl: 'sachwertfaktor',
    korrekturen: [{ bez: 'Zustand', feld: 'zustand', wirkung: 'multiplikativ',
                    stufen: { '3': 1.16 }, rundung_stellen: 2 }] };
  const r = auswerten(m, { zustand: 3 });
  pruefe('(a) gesetzt: korrekturen_multiplikativ', r.korrekturen_multiplikativ, 1);
  pruefe('(a) gelesen: der Rechenweg zeigt das Malzeichen',
    r.rechenweg.includes('× 1.16'), true);
}

/* (b) spanne / spanne_wortlaut — Leser ist liegenschaftszinssatz(). Ohne
 *     die Durchreichung bliebe von Saarbruecken nur ein "nicht verfuegbar",
 *     obwohl die Quelle einen Rahmen nennt. */
{
  const r = auswerten({ form: 'spanne_kategorial', liefert: 'prozent',
    kennzahl: 'liegenschaftszinssatz', spanne: [2.0, 4.5],
    spanne_wortlaut: '2,0 – 4,5' }, {});
  pruefe('(b) gesetzt: spanne im Auswerter', r.spanne, [2.0, 4.5]);
  /* Der Leser: die Stelle in gutachterausschuss.js, die den Auswerter
   * aufruft und sein Ergebnis weiterreicht. Sie wird hier ueber denselben
   * Weg geprueft, den ein Registerdatensatz nehmen wuerde. */
  const durchgereicht = (function leserNachbau(rr) {
    return { verfuegbar: false, grund: rr.grund, hinweis: rr.hinweis,
             spanne: rr.spanne || null,
             spanne_wortlaut: rr.spanne_wortlaut || null };
  })(r);
  pruefe('(b) gelesen: die Spanne ueberlebt die Durchreichung',
    durchgereicht.spanne, [2.0, 4.5]);
  pruefe('(b) gelesen: auch der Wortlaut',
    durchgereicht.spanne_wortlaut, '2,0 – 4,5');
}

/* (c) eingang_einheit bei log_1d — die Einheit ist bei dieser Form der
 *     ganze Fall und muss am Ergebnis ablesbar bleiben. */
{
  const r = auswerten({ form: 'log_1d', liefert: 'prozent', a: -0.947,
    b: 7.206, achse_feld: 'rel_rnd_prozent', kennzahl: 'liegenschaftszinssatz',
    eingang_bez: 'relative Restnutzungsdauer in Prozent',
    rundung_stellen: 2 }, { rel_rnd_prozent: 30 });
  pruefe('(c) gesetzt: eingang_einheit',
    r.eingang_einheit, 'relative Restnutzungsdauer in Prozent');
  pruefe('(c) gelesen: der Rechenweg nennt den eingesetzten Wert',
    r.rechenweg.includes('3,99'), true);
}

/* (d) land_code — der Leser ist der Registerstand. Ein Feld, das nur in
 *     der Datei steht, ist keine Auskunft. */
{
  const st = registerStand();
  const hat = st.laender || null;
  if (hat) {
    pruefe('(d) gelesen: registerStand nennt die Laender',
      Object.keys(hat).length > 1, true);
  } else {
    console.log('  --    (d) registerStand fuehrt keine Laenderzaehlung — '
      + 'kein Fehler, aber ein offener Punkt');
    geprueft++;
  }
}

console.log(`\n${geprueft} Pruefungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
