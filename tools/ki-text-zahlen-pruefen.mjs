#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * ki-text-zahlen-pruefen.mjs — v2670
 *
 * RECHNET DER KI-FLIESSTEXT RICHTIG?
 *
 * Bericht 330 (Bismarckstr. 27, Detmold) schrieb „Die Marktpreisindikation
 * liegt knapp 60 Prozent unter dem Kaufpreis" (richtig: 37 %) und
 * „vier leerstehende Wohnungen" (richtig: 2; die 4 sind die Mieten ueber
 * dem Band). Dieser Pruefer laedt den ECHTEN Text als Fixture
 * (tools/ki-text-zahlen-330.json) und die ECHTE Nachpruefung
 * (marktbericht/backend/src/lib/ki_text_pruefung.js):
 *   1. der echte Text 330 muss die beiden Fehler liefern (und den dritten:
 *      „Ertragswert nicht enthalten", obwohl er im Bericht steht);
 *   2. ein korrigierter Text muss ohne Befund durchgehen;
 *   3. die Pruefzahlen fuer den Prompt muessen beide Richtungen tragen;
 *   4. kapitelD liest den Ertragswert (value_eur) - die Ursache von 1.3;
 *   5. der Reparaturablauf entfernt, was nach dem Neuschreiben falsch bleibt.
 * Kein Modellabruf. RC = 0 nur, wenn alles stimmt.
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const W = process.cwd();
const LIB = path.join(W, 'marktbericht', 'backend', 'src', 'lib', 'ki_text_pruefung.js');
const RGS = path.join(W, 'marktbericht', 'backend', 'src', 'services', 'ReportGenerationService.js');
const K = await import(pathToFileURL(LIB).href);
const fx = JSON.parse(fs.readFileSync(path.join(W, 'tools', 'ki-text-zahlen-330.json'), 'utf8'));

let fehler = 0, n = 0;
const ok = (bed, txt) => { n++; if (bed) console.log('  ok   ' + txt); else { fehler++; console.log('  ROT  ' + txt); } };

const F = K.textFakten(fx.payload);
console.log('Fakten 330: KP ' + F.werte.kaufpreis + ', MPI ' + F.werte.mpi + ', EW ' + F.werte.ertragswert
  + ' | leer ' + F.zaehl.anzahl_leer + ', ueber Band ' + F.zaehl.anzahl_ueber_band);

console.log('1) echter Text Bericht 330');
const b = K.pruefeText(fx.report_md, F);
b.forEach((x) => console.log('       ' + x.art + ': ' + x.ist + ' -> soll ' + x.soll + ' | ' + x.satz.slice(0, 70)));
ok(b.some((x) => x.art === 'prozent' && /knapp 60 Prozent unter dem Kaufpreis/.test(x.satz)), 'findet „knapp 60 Prozent unter dem Kaufpreis" (soll 37,0 % unter)');
ok(b.some((x) => x.art === 'zaehlung_leer' && /vier leerstehende/.test(x.satz)), 'findet „vier leerstehende Wohnungen" (soll 2)');
ok(b.some((x) => x.art === 'umfang'), 'findet „Ertrags- und Sachwerte ... nicht enthalten"');
ok(!b.some((x) => /58,6 Prozent/.test(x.satz)), 'laesst die richtigen 58,6 % stehen (beide Stellen)');
ok(!b.some((x) => /vier Mietverhältnisse/.test(x.satz)), 'laesst „vier Mietverhaeltnisse ... hoeheren Ist-Mieten" stehen (4 ueber dem Band)');
ok(b.length === 3, 'genau 3 Befunde, keine Fehlalarme (ist ' + b.length + ')');

console.log('2) korrigierter Text');
const gut = fx.report_md
  .replace('Die Marktpreisindikation liegt knapp 60 Prozent unter dem Kaufpreis.', 'Die Marktpreisindikation liegt rund 37 Prozent unter dem Kaufpreis.')
  .replace('berücksichtigt vier leerstehende Wohnungen', 'berücksichtigt zwei leerstehende Wohnungen')
  .replace('Ertrags- und Sachwerte sind in dieser Berichtsstufe nicht enthalten.', 'Der vorläufige Ertragswert liegt 23,0 Prozent unter dem Kaufpreis.');
const b2 = K.pruefeText(gut, F);
b2.forEach((x) => console.log('       ' + x.art + ': ' + x.satz.slice(0, 80)));
ok(b2.length === 0, 'korrigierter Text ohne Befund');

console.log('3) Einzelfaelle');
const fall = (t, soll, txt) => { const r = K.pruefeText(t, F).length; ok((r > 0) === soll, txt + ' -> ' + (r ? 'Befund' : 'durch')); };
fall('Der Kaufpreis liegt 37,0 Prozent über der Marktpreisindikation.', true, 'Bezugsgroesse vertauscht (37 statt 58,6)');
fall('Der Kaufpreis liegt 58,6 Prozent unter der Marktpreisindikation.', true, 'Richtung vertauscht');
fall('Der Kaufpreis liegt knapp 60 Prozent über der Marktpreisindikation.', false, '„knapp 60" fuer 58,6 in richtiger Richtung');
fall('Der Kaufpreis liegt rund 30 Prozent über dem Ertragswert.', false, 'KP gegen EW 29,9 %');
fall('Es gibt eine leere Wohnung im Haus.', true, '„eine leere Wohnung" bei 2 leer');
fall('Zwei Wohnungen stehen derzeit leer.', false, '„Zwei Wohnungen stehen leer"');
fall('Der Kaufpreisfaktor liegt 26,1 Prozent über dem Durchschnitt.', false, 'unbekannte Bezugsgroesse wird nicht beurteilt');
fall('Die Mietindikation liegt 10 Prozent unter dem Kaufpreis.', false, '„Mietindikation" ist nicht die Marktpreisindikation');

console.log('4) Pruefzahlen und kapitelD');
const pz = K.pruefzahlen(F);
ok(pz.kaufpreis_ueber_mpi_pct === 58.6 && pz.mpi_unter_kaufpreis_pct === 37, 'kaufpreis_ueber_mpi_pct 58.6 / mpi_unter_kaufpreis_pct 37 (ist ' + pz.kaufpreis_ueber_mpi_pct + ' / ' + pz.mpi_unter_kaufpreis_pct + ')');
ok(pz.anzahl_leer === 2 && pz.anzahl_ueber_band === 4, 'anzahl_leer 2 / anzahl_ueber_band 4');
const anw = K.faktenAnweisung(F);
ok(/37,0 % UNTER dem Kaufpreis/.test(anw) && /58,6 % ÜBER/.test(anw), 'Anweisung nennt beide Richtungen');
const R = await import(pathToFileURL(RGS).href);
const D = R.kapitelD(fx.payload);
ok(D.ableitung.ertragswert === 885000 && D.ableitung.sachwert === 1032864, 'kapitelD liest Ertrags-/Sachwert aus value_eur (ist ' + D.ableitung.ertragswert + ' / ' + D.ableitung.sachwert + ')');

console.log('5) Reparaturablauf');
const r1 = await K.pruefeUndRepariere(fx.report_md, F, async () => fx.report_md); /* Modell bleibt beim Fehler */
ok(r1.prot.neu_erzeugt && r1.prot.entfernt.length === 3 && K.pruefeText(r1.md, F).length === 0, 'Neuschreiben ohne Besserung -> 3 Saetze entfernt, Rest sauber');
const r2 = await K.pruefeUndRepariere(fx.report_md, F, async () => gut);
ok(r2.md === gut && r2.prot.entfernt.length === 0, 'Neuschreiben mit Besserung -> neuer Text, nichts entfernt');
const r3 = await K.pruefeUndRepariere(gut, F, async () => { throw new Error('nie gerufen'); });
ok(r3.md === gut && !r3.prot.neu_erzeugt, 'sauberer Text -> kein Neuschreiben');

console.log('6) Abnahme Bericht 331 (echter Lauf v2670)');
const ab = fx.abnahme_331;
if (ab) {
  const [sw, band] = ab.entwurf_saetze;
  ok(K.pruefeText(sw, F).some((x) => x.art === 'prozent'), 'Entwurf: „Sachwert ... 11,3 Prozent unter dem Kaufpreis" (soll 10,2 %) -> Befund');
  ok(!K.pruefeText(band, F).some((x) => x.art === 'zaehlung_band'), 'Entwurf: „vier von sechs Wohnungen ... über dem Band" ist richtig -> kein Fehlalarm');
  ok(K.pruefeText('Fünf von sechs Wohnungen liegen über dem marktüblichen Band.', F).length === 1, '„Fünf von sechs ... über dem Band" (soll 4) -> Befund');
  const e = K.pruefeText(ab.report_md, F);
  e.forEach((x) => console.log('       ' + x.art + ': ' + x.satz.slice(0, 80)));
  ok(e.length === 0, 'veröffentlichter Text 331 ohne Befund');
} else ok(false, 'abnahme_331 fehlt in der Fixture');

console.log('7) v2990 · Bodenwert nicht angepasst ist nicht „konservativ" (Bericht Am Markt 9, Kabelsketal)');
{
  const pl = JSON.parse(JSON.stringify(fx.payload));
  pl.cross_check = pl.cross_check || {};
  pl.cross_check.flaeche = { erheblich: true, bodenwert_nicht_angepasst: true, objekt_qm: 2350, richtwertgrundstueck_qm: 800, ueberschreitung_pct: 194 };
  const Fb = K.textFakten(pl);
  ok(Fb.bodenwert_nicht_angepasst === true, 'Fakt bodenwert_nicht_angepasst gesetzt');
  ok(/NICHT an die Grundstücksgröße angepasst/.test(K.faktenAnweisung(Fb)), 'Anweisung nennt es');
  const echt = 'Der Bodenrichtwert ist mit 130 €/m² ausgewiesen, die umfangreiche Grundstücksfläche wurde hierbei nicht angepasst, sodass der Bodenwert konservativ angesetzt wurde.';
  ok(K.pruefeText(echt, Fb).some((x) => x.art === 'bodenwert_wertung'), 'echter Satz aus Bericht Am Markt 9 -> Befund');
  ok(!K.pruefeText(echt, F).some((x) => x.art === 'bodenwert_wertung'), 'ohne den Fakt kein Befund (angepasster Bodenwert darf so heissen)');
  ok(!K.pruefeText('Der Bodenwert ist nicht an die Grundstücksgröße angepasst und insoweit vorläufig.', Fb).length, 'richtige Formulierung -> kein Befund');
  ok(!K.pruefeText('Die Mietansätze sind konservativ gewählt.', Fb).some((x) => x.art === 'bodenwert_wertung'), '„konservativ" ohne Bodenwert -> kein Befund');
  const R2 = await import(pathToFileURL(RGS).href);
  ok(R2.bodenwertFakten(pl.cross_check).length === 1 && R2.bodenwertFakten({ flaeche: { erheblich: true } }).length === 0, 'bodenwertFakten nur bei nicht angepasstem Bodenwert');
}

console.log((fehler ? 'ROT' : 'GRUEN') + ': ' + (n - fehler) + '/' + n);
process.exit(fehler ? 1 : 0);
