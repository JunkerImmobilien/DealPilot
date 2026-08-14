// kettenpruefung-swf.mjs   (v1084-WKET)
//
// DIE KETTE, NICHT DIE FUNKTION.
//
// Die Pruefstrecke prueft den Auswerter. Sie sagt nichts darueber, ob der
// Wert beim Aufrufer ankommt. Mehrfach war ein Modul richtig und der Aufrufer
// reichte den Parameter nicht durch — bei ref.ags liefen fuenf Lesestellen
// seit ihrer Einfuehrung mit null.
//
// ZWEI REGELN FUER DIESEN TEST:
//
// 1. ER LAEDT DAS REGISTER NICHT SELBST. In v1083 rief ladeSaat() niemand
//    ausser der Pruefstrecke — im Server blieb das Register leer, und die
//    Pruefung war trotzdem gruen, weil sie sich ihre Vorbedingung gebaut hat.
//    Ein Test, der das tut, prueft die Kette nicht. Hier wird ausschliesslich
//    ueber sachwertfaktor() gegangen; laedt sich das Register nicht von
//    selbst, faellt der Test.
//
// 2. ER SPRICHT DIE SPRACHE DES ECHTEN AUFRUFERS. Die Feldnamen stammen
//    woertlich aus CrossCheckService.js Zeile 217 ff. — sachwert_eur,
//    rnd_jahre, bgf_qm, brw_eur_qm, objektart. Ein Test mit den Feldnamen
//    der Rezepte waere gruen und wertlos.

import { sachwertfaktor } from '../lib/gutachterausschuss.js';
import { registerStand } from '../lib/ausschuss_register.js';   /* nur lesen, nicht laden */

let ok = 0, fehler = 0;
const zeilen = [];

function pruefe(titel, bedingung, zusatz = '') {
  if (bedingung) { ok++; zeilen.push(`  ok      ${titel}${zusatz ? ' — ' + zusatz : ''}`); }
  else { fehler++; zeilen.push(`  FEHLER  ${titel}${zusatz ? ' — ' + zusatz : ''}`); }
}

/* ── 0 · Laedt sich das Register von selbst? ───────────────────────────── */

const ersteAntwort = sachwertfaktor({
  ags: '05762020', sachwert_eur: 300000, brw_eur_qm: 80,
  rnd_jahre: 55, bgf_qm: 300, objektart: 'Einfamilienhaus',
});
const stand = registerStand();
pruefe('Register laedt sich beim ersten Zugriff selbst',
  stand.herkunft === 'saatdatei' && stand.saetze > 400,
  `${stand.herkunft}, ${stand.saetze} Saetze, ${stand.schluessel} Schluessel`);
/* Die Zahl der Saatdateien waechst mit jedem Bundesland — geprueft wird,
 * dass ALLE angemeldeten gelesen wurden, nicht eine feste Anzahl. */
pruefe('Alle Saatdateien gelesen',
  Array.isArray(stand.gelesen) && stand.gelesen.length >= 2
    && (stand.vermisst || []).length === 0,
  (stand.gelesen || []).map((g) => `${g.datei.split('/').pop()}:${g.saetze}`).join(' · '));

/* ── 1 · Hoexter, ueber die Kaskade 8 -> 5 ─────────────────────────────── */
// Anwendungsbeispiel des Berichts: vorlaeufiger Sachwert 300.000 EUR,
// Bodenrichtwert 80 EUR/m2 -> Tabellenwert 0,70; RND 55 -> +0,06;
// BGF 300 -> +0,01; Ergebnis 0,77.

pruefe('Hoexter: Kreisschluessel ueber die Kaskade gefunden',
  ersteAntwort && ersteAntwort.verfuegbar === true,
  ersteAntwort ? (ersteAntwort.grund || `Faktor ${ersteAntwort.wert}`) : 'null');
pruefe('Hoexter: Anwendungsbeispiel 0,77',
  ersteAntwort && Math.round((ersteAntwort.wert ?? 0) * 100) === 77,
  ersteAntwort && ersteAntwort.rechenweg);
pruefe('Hoexter: Herkunft und Ausschuss stehen am Ergebnis',
  ersteAntwort && ersteAntwort.herkunft === 'register'
    && !!ersteAntwort.ausschuss && !!ersteAntwort.stichtag,
  ersteAntwort && `${ersteAntwort.herkunft} · ${ersteAntwort.ausschuss} · `
    + `Stufe ${ersteAntwort.stufe} · ${ersteAntwort.modellform}`);

/* ── 2 · Die Kaskade trennt Iserlohn vom Maerkischen Kreis ─────────────── */
// Beide tragen 05962. Nur die achtstellige Ebene haelt sie auseinander.
// Genau hier ist in v1060 ein Vergleichsfaktor in den falschen Kreis geraten.

const iserlohn = sachwertfaktor({
  ags: '05962024', sachwert_eur: 300000, brw_eur_qm: 150,
  rnd_jahre: 45, bgf_qm: 300, objektart: 'Einfamilienhaus',
});
const mk = sachwertfaktor({
  ags: '05962012', sachwert_eur: 300000, brw_eur_qm: 150,
  rnd_jahre: 45, bgf_qm: 300, objektart: 'Einfamilienhaus',
});
pruefe('Iserlohn wird gemeindescharf getroffen',
  iserlohn && /Iserlohn/i.test(iserlohn.ausschuss || ''),
  iserlohn && iserlohn.ausschuss);
pruefe('Nachbargemeinde faellt auf den Maerkischen Kreis',
  mk && /Märkisch|Maerkisch/i.test(mk.ausschuss || ''),
  mk && mk.ausschuss);
pruefe('Die beiden liefern nicht denselben Datensatz',
  iserlohn && mk && iserlohn.ausschuss !== mk.ausschuss,
  `${iserlohn && iserlohn.wert} gegen ${mk && mk.wert}`);

/* ── 3 · Die handgeschriebenen Module haben Vorrang ────────────────────── */
// Regression. Aendert sich hier etwas, ist der Rechenkern angefasst worden.

// DER SOLLWERT KOMMT AUS DEM DOKUMENT, NICHT AUS DEM KOPF.
// Erster Anlauf dieses Tests hatte fuer die Loehner Strasse einen
// Bodenrichtwert von 145 EUR/m2 GERATEN, weil die Regression nur mit
// "Tabelle 0,899 -> Faktor 0,889" notiert ist. Heraus kamen 0,885 — und
// beinahe waere daraus ein Befund gegen den Rechenkern geworden. Der Kern
// war richtig; falsch war die erfundene Eingabe.
//
// Geprueft wird deshalb das Anwendungsbeispiel, das der Kreis Herford
// SELBST abdruckt (Kommentar in sachwertfaktoren_herford.js, Zeile 24):
// Bodenrichtwert 125 EUR/m2, vorlaeufiger Sachwert 300.000 EUR
//   -> Tabellenwert 0,89
//   Restnutzungsdauer 45 statt 30 Jahre  -> +0,02
//   Bruttogrundflaeche 500 statt 350 m2  -> -0,03
//   anzusetzender Faktor 0,88
const herford = sachwertfaktor({
  ags: '05758016', sachwert_eur: 300000, brw_eur_qm: 125,
  rnd_jahre: 45, bgf_qm: 500, objektart: 'Zweifamilienhaus',
});
pruefe('Kreis Herford laeuft weiter ueber das MODUL, nicht ueber das Register',
  herford && herford.herkunft === 'modul',
  herford && `${herford.herkunft} · Faktor ${herford.wert}`);
pruefe('Herford: Anwendungsbeispiel des Berichts 0,88 unveraendert',
  herford && Math.round((herford.wert ?? 0) * 100) === 88,
  herford && String(herford.wert));

// Die Loehner Strasse bleibt als KETTENfall drin — ohne Zahlenbehauptung,
// weil die Eingaben des v1076-Klicktests hier nicht belegt vorliegen.
// Geprueft wird nur, dass sie weiter im Modul landet und nicht im Register.
const loehner = sachwertfaktor({
  ags: '05758016', sachwert_eur: 326649, brw_eur_qm: 125,
  rnd_jahre: 18, bgf_qm: 346.62, objektart: 'Zweifamilienhaus',
});
pruefe('Loehner Strasse landet weiter im Herford-Modul',
  loehner && loehner.herkunft === 'modul',
  loehner && `${loehner.herkunft} · Faktor ${loehner.wert} `
    + '(Sollwert offen: Klicktest-Eingaben nicht belegt)');

const huellhorst = sachwertfaktor({
  ags: '05770016', sachwert_eur: 348687, brw_eur_qm: 120,
  rnd_jahre: 49.6, bgf_qm: 300, objektart: 'Eigentumswohnung',
});
pruefe('Huellhorst laeuft weiter ueber das Minden-Luebbecke-MODUL',
  huellhorst && (huellhorst.herkunft === 'modul' || huellhorst.verfuegbar === false),
  huellhorst && (huellhorst.herkunft || huellhorst.grund));

/* ── 4 · Kein Treffer heisst kein Wert ─────────────────────────────────── */

const bayern = sachwertfaktor({
  ags: '07315000' /* Mainz — RLP ist kostenpflichtig und nicht geerntet */, sachwert_eur: 400000, brw_eur_qm: 900,
  rnd_jahre: 50, bgf_qm: 300, objektart: 'Einfamilienhaus',
});
pruefe('Ausserhalb der hinterlegten Gebiete: kein Ausschuss hinterlegt',
  bayern && bayern.verfuegbar === false
    && bayern.grund === 'kein_ausschuss_hinterlegt',
  bayern && bayern.grund);

/* ── 5 · Objektart, die der Ausschuss nicht ableitet ───────────────────── */
// Kreis Lippe fuehrt nur Ein- und Zweifamilienhaeuser. Eine Eigentumswohnung
// darf dort KEINEN Faktor bekommen — auch dann nicht, wenn das Register fuer
// dieses Gebiet nur einen einzigen Zweig kennt. Ein Rueckfall "es gibt ja nur
// einen" waere still und falsch.

const etwLippe = sachwertfaktor({
  ags: '05766020', sachwert_eur: 250000, brw_eur_qm: 120,
  rnd_jahre: 45, bgf_qm: 120, objektart: 'Eigentumswohnung',
});
pruefe('ETW im Kreis Lippe bekommt KEINEN EZFH-Faktor',
  etwLippe && etwLippe.verfuegbar === false
    && etwLippe.grund === 'objektart_nicht_abgeleitet',
  etwLippe && `${etwLippe.grund} · gefuehrt: ${(etwLippe.gefuehrte_zweige || []).join(', ')}`);

/* ── 6 · Die Feldbruecke traegt wirklich ───────────────────────────────── */
// Ohne sie meldet jedes Objekt 'achse_y_fehlt'. Gegenprobe: dieselbe Anfrage
// OHNE die Bruecke-Quellfelder muss scheitern, MIT ihnen gelingen.

const ohneBruecke = sachwertfaktor({
  ags: '05762020', vorlaeufiger_sachwert: 300000, bodenrichtwert: 80,
  objektart: 'Einfamilienhaus',
});
pruefe('Unbekannte Feldnamen liefern keinen Wert (kein stiller Standardwert)',
  ohneBruecke && ohneBruecke.verfuegbar === false,
  ohneBruecke && ohneBruecke.grund);

/* ── 7 · Der Beleg reist mit ───────────────────────────────────────────── */

pruefe('Der Beleg haengt am Ergebnis',
  ersteAntwort && ersteAntwort.beleg && ersteAntwort.beleg.fundstelle,
  ersteAntwort && ersteAntwort.beleg && ersteAntwort.beleg.fundstelle);
pruefe('Lizenz und Quelle stehen am Ergebnis',
  ersteAntwort && !!ersteAntwort.lizenz && !!ersteAntwort.quelle_url,
  ersteAntwort && ersteAntwort.lizenz);

console.log(zeilen.join('\n'));
console.log('');
console.log(`Kettenpruefung: ${ok} ok · ${fehler} FEHLER`);
process.exit(fehler ? 1 : 0);
