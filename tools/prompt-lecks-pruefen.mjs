#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════
 * prompt-lecks-pruefen.mjs — v2139
 *
 * KOMMT AN, WAS GESENDET WIRD?
 *
 * Marcel (N60.4): „Auf welche Daten wird zugegriffen und wo ist das
 * Wissen? Haben wir auf alles Zugriff oder koennen wir was besser
 * machen?"
 *
 * `v2009` fand vier Felder, die das Frontend seit Jahren mitschickte und
 * die `buildPrompt()` nie las. Am 12.10.2026 fanden sich SIEBEN weitere.
 * Beide Male war die Ursache dieselbe: ein Feld dazugeben kostet eine
 * Zeile in `ui.js`, ein Feld LESEN kostet eine zweite an einer anderen
 * Stelle - und niemand merkt, wenn die zweite fehlt.
 *
 *   > Ein Feld, das gesendet und nicht gelesen wird, verschwindet
 *   > lautlos. Der Prompt ist vollstaendig, die Antwort plausibel, und
 *   > die Angabe des Nutzers war umsonst.
 *
 * Der schlimmste gemessene Fall war nicht ein stummes Feld, sondern das
 * Gegenteil: der Block „MIETVERTRAEGE JE EINHEIT" erklaerte dem Modell
 * auf 16 Zeilen, wie es `vertragsart`, `naechste_anpassung`,
 * `letzte_erhoehung` und `befristet_bis` lesen soll - und die Werte
 * standen nirgends. Seine Bedingung prueft `e.vertragsart`, er erschien
 * also GENAU DANN, wenn die Daten vorlagen.
 *
 * ── WIE DIESER PRUEFER ARBEITET ──────────────────────────────────────
 *
 * Er ruft die ECHTE `buildPrompt()` aus `openaiService.js` mit einem
 * Auftrag, in dem JEDES Feld belegt ist - mit einem unverwechselbaren
 * Wert. Dann sucht er jeden dieser Werte im erzeugten Text.
 *
 * Nicht `grep` auf den Quelltext: ein `payload.zustand.bauteile` kann
 * gelesen und trotzdem nicht gedruckt werden (etwa in einer Bedingung,
 * die nie wahr wird). Nur der Text selbst beweist, dass es ankommt.
 *
 * Nicht erfundene Feldnamen: die Liste unten ist an `frontend/js/ui.js`
 * ausgelesen, Zeile fuer Zeile - siehe `QUELLE` je Eintrag.
 *
 * RC = 0, wenn jedes belegte Feld im Prompt vorkommt.
 * ══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';

const WURZEL = process.cwd();
const require_ = createRequire(path.join(WURZEL, 'backend', 'src', 'x.js'));

/* ── Die Umgebung, VOR dem require ─────────────────────────────────────
   `config.js` laedt `dotenv`, und das liegt lokal nicht in
   `node_modules`. Ersetzt wird genau DAS - nicht `config` selbst:

   > Ein nachgebautes `config` ist eine Nachbildung, und ein Pruefer, der
   > gegen eine Nachbildung laeuft, misst seine eigene Annahme. Mit dem
   > Haken auf dem Lader kommt die ECHTE `config.js` zum Einsatz, und
   > nur die eine fehlende Abhaengigkeit wird gestellt.

   `require_.resolve('dotenv')` geht hier NICHT: was nicht installiert
   ist, laesst sich nicht aufloesen, und der Cache-Eintrag landete
   nirgends. Also der Haken auf `Module._load`.

   Er steht hier oben, VOR dem `require` von `openaiService`. Am
   12.10.2026 hat genau diese Reihenfolge in einem anderen Pruefer vier
   Punkte falsch GRUEN gemacht: der Ersatz kam nach dem `require`, wurde
   ignoriert, und die vorige Probe antwortete weiter. */
const ERSATZ = {
  dotenv: { config: function () { return { parsed: {} }; } }
};
const _echtesLoad = Module._load;
let ersetzt = 0;
Module._load = function (anfrage, eltern, istHaupt) {
  if (Object.prototype.hasOwnProperty.call(ERSATZ, anfrage)) {
    try { return _echtesLoad.apply(this, arguments); }
    catch (e) { ersetzt++; return ERSATZ[anfrage]; }
  }
  return _echtesLoad.apply(this, arguments);
};
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

let openai;
try {
  openai = require_('./services/openaiService.js');
} catch (e) {
  console.error('Konnte openaiService nicht laden: ' + e.message);
  process.exit(2);
}
if (typeof openai.buildPrompt !== 'function') {
  console.error('buildPrompt() ist nicht exportiert.');
  process.exit(2);
}

/* ══ DER AUFTRAG — jedes Feld mit einem unverwechselbaren Wert ════════
 *
 * Die Werte sind so gewaehlt, dass sie im Prompt nicht zufaellig
 * entstehen koennen: fuenfstellige Zahlen mit ungewoehnlichen Ziffern,
 * Texte mit einem Praefix. Eine `4` als Zimmerzahl waere nutzlos - sie
 * steht in jedem zweiten Satz.
 *
 * Zahlen laufen durch `_z()` (`toLocaleString('de-DE')`, also mit
 * Tausenderpunkt) oder `_p()` (`toFixed(1)` mit Komma und ' %'). Der
 * Pruefer sucht deshalb die FORMATIERTE Form, nicht die rohe. */
const auftrag = {
  objekt: {
    str: 'Pruefstrasse', hnr: '9', plz: '32609', ort: 'Pruefort',
    objektart: 'mfh', wfl: 23456, baujahr: 1968, zimmer: 5,
    kaufpreis: 345678,
    einheiten: {
      anzahl: 2,
      /* v2139a: `flaeche_summe` ABSICHTLICH abweichend von `wfl`
         (23456) — so wird der neue Abgleich mitgeprueft. */
      flaeche_summe: 23400,
      aufgeteilt: true,
      gnd: 77,
      stand: '2026-10-12',
      /* Ein OBJEKT, so wie `mfh-einheiten.js` es fuehrt (Gewerk ->
         Stufe) — nicht ein String. Mein erster Auftrag schickte einen
         String, und genau daran fiel die Typfalle im Leser auf. */
      modernisierung: { Dach: 'PRUEFSTUFE-4', Heizung: 'PRUEFSTUFE-2' },
      je_einheit: [{
        nr: 1, wfl: 8123, miete: 91234, art: 'wohnen', status: 'vermietet',
        lage: 'PRUEFLAGE-EINS',
        /* Die sieben, die bis v2139 ungelesen mitreisten (ui.js:813-826) */
        etage: 'PRUEFETAGE', zimmer: 7,
        vertragsart: 'PRUEF-STAFFELMIETE',
        letzte_erhoehung: '2019-07-13',
        naechste_anpassung: '2027-04-19',
        befristet_bis: '2031-11-23',
        zustand: 'PRUEFZUSTAND-EINHEIT'
      }, {
        nr: 2, wfl: 8124, miete: 91235, art: 'gewerbe', status: 'leer',
        vertragsart: 'PRUEF-INDEXMIETE'
      }]
    }
  },
  kennzahlen: { bmy: 6.7, nmy: 5.3, cf_m: 234, dscr: 1.23, ltv: 67.8 },
  finanzierung: { ek: 56789, d1: 234567, d1z: 3.9, d1t: 2.1 },

  /* ── STEUER: vier Angaben hatten bis v2139 keinen Leser ──────────── */
  steuer: {
    zve: 87654,                               /* QUELLE ui.js:895 */
    grenzsteuersatz_pct: 41.7,                /* ui.js:895 */
    afa_satz_pct: 2.7,                        /* ui.js:896 */
    afa_rnd_jahre: 43,                        /* ui.js:896 */
    gebaeudeanteil_pct: 73.9,                 /* ui.js:897 */
    afa_eigen_pct: 3.3,                       /* ui.js:897  — war stumm */
    sanierung: {                              /* ui.js:899-906 — war stumm */
      kosten_eur: 47119,
      betrag_ist: 'PRUEF-netto',
      steuerlich_angesetzt: true,
      verteilung_jahre: '4'
    },
    sonder_afa_7b: true,                      /* ui.js:908 — war stumm */
    erbbaurecht: { ja: true, erbbauzins_eur_jahr: 19876 }  /* ui.js:909-911 */
  },

  bewirtschaftung: {
    hausgeld_umlagefaehig: 31234, hausgeld_nicht_umlagefaehig: 21345,
    grundsteuer: 1456, weg_ruecklage: 2567, eigene_ruecklage: 3678,
    mietausfall_pct: 1.9
  },

  /* ── MIETENTWICKLUNG: `umlagefaehig` hatte keinen Leser ──────────── */
  mietentwicklung: {
    herkunft: 'PRUEF-HERKUNFT', modus: 'einheiten',
    einheiten_gesamt: 2, einheiten_mit_plan: 2, einheiten_index: 1,
    soll_eur_qm: 11.7, schritte: 3, intervall_jahre: 2, schritt_pct: 4.3,
    mietspiegel_eur_qm: 9.8, leerstand_pct: 2.7,
    umlagefaehig: false                       /* ui.js:936 — war stumm */
  },

  /* v2139a: ebenfalls aus `ui.js:974-978` ausgelesen. */
  wohnung: {
    zimmer: 3, baeder: 2, etage: 'PRUEF-OG', etagen_gesamt: 4,
    garagen: 3, stellplaetze_aussen: 2, balkon_qm: 17, grundriss: 'PRUEF-GRUNDRISS'
  },

  boden: {
    bodenrichtwert_eur_qm: 219, grundstueck_qm: 9876,
    sachwertfaktor: 1.07, liegenschaftszins_pct: 2.56
  },

  /* v2139a: die Namen aus `ui.js:987-991` ausgelesen, nicht geraten. */
  halter: {
    name: 'PRUEF-HALTER-GMBH', seit: '2019-05-02', kaufdatum: '2019-04-11',
    wirtschaftlicher_uebergang: '2019-06-01', vermietungsstand: 'PRUEF-VOLL'
  },

  /* ── ZUSTAND: Bauteile und gerechnete RND hatten keinen Leser ────── */
  zustand: {
    ds2_zustand: 'PRUEF-GEPFLEGT',
    energieklasse: 'PRUEF-KLASSE-D',
    modernisierung: 'PRUEF-TEILMODERNISIERT',
    modernisierungspunkte: 13,
    bauteile: {                               /* ui.js:1031-1037 — war stumm */
      Dach: 'PRUEFJAHR-2011', Fenster: 'PRUEFJAHR-2013',
      Heizung: 'PRUEFJAHR-2017', Baeder: 'PRUEFJAHR-2009'
    },
    restnutzungsdauer_berechnet: {            /* ui.js:1053-1061 — war stumm */
      jahre: 51, gesamtnutzungsdauer: 79, alter_jahre: 58,
      verfahren: 'PRUEF-ANLAGE-2', stand: 'PRUEF-STAND-RND'
    }
  },

  /* ── ANKAUF: Kennzahlen von damals und das Datum ─────────────────── */
  ankauf: {
    stichtag: '2024-03-17',
    festgeschrieben_am: '2024-09-29',         /* ui.js:969 — war stumm */
    korrekturen: 2,
    kennzahlen_damals: 'PRUEF-KENNZAHLEN-DAMALS',   /* ui.js:967 — war stumm */
    abweichung: null                          /* GENAU der Fall: kein Vergleich */
  },

  verhandlung: { inseriert_seit: '2026-01-13', tage_online: 263 },
  investor_score: { total: 71, rendite: 67, finanzierung: 73, risiko: 61, lage: 79 },
  dealscore: { total: 68 },
  herkunft: 'PRUEF-HERKUNFT-OBJEKT'
};

/* ══ DIE ERWARTUNGEN ═════════════════════════════════════════════════
 * Je Eintrag: wo das Feld herkommt, und welcher Text im Prompt stehen
 * MUSS. `_z()` setzt Tausenderpunkte, `_p()` Komma und ' %'. */
const z = (n) => Math.round(n).toLocaleString('de-DE');
const p = (n) => n.toFixed(1).replace('.', ',') + ' %';

const ERWARTET = [
  /* ── die vier aus v2009, als Rueckfallprobe ───────────────────────── */
  ['verhandlung.tage_online', 'ui.js:1128', '263'],
  ['investor_score.rendite', 'ui.js:1183', '67'],

  /* ── die sieben Einheitenfelder (v2139) ───────────────────────────── */
  ['einheit.etage', 'ui.js:813', 'PRUEFETAGE'],
  ['einheit.zimmer', 'ui.js:814', '7 Zi.'],
  ['einheit.vertragsart', 'ui.js:815', 'PRUEF-STAFFELMIETE'],
  ['einheit.vertragsart (zweite)', 'ui.js:815', 'PRUEF-INDEXMIETE'],
  ['einheit.letzte_erhoehung', 'ui.js:816', '2019-07-13'],
  ['einheit.naechste_anpassung', 'ui.js:817', '2027-04-19'],
  ['einheit.befristet_bis', 'ui.js:818', '2031-11-23'],
  ['einheit.zustand', 'ui.js:825', 'PRUEFZUSTAND-EINHEIT'],

  /* ── Steuer (v2139) ───────────────────────────────────────────────── */
  ['steuer.afa_eigen_pct', 'ui.js:897', p(3.3)],
  ['steuer.sanierung.kosten_eur', 'ui.js:901', z(47119)],
  ['steuer.sanierung.betrag_ist', 'ui.js:902', 'PRUEF-netto'],
  ['steuer.sanierung.verteilung_jahre', 'ui.js:904', '4 Jahre'],
  ['steuer.sonder_afa_7b', 'ui.js:908', '§ 7b'],
  ['steuer.erbbaurecht.erbbauzins', 'ui.js:910', z(19876)],

  /* ── Mietentwicklung (v2139) ──────────────────────────────────────── */
  ['mietentwicklung.umlagefaehig', 'ui.js:936', 'Kaltmiete'],

  /* ── Zustand (v2139) ──────────────────────────────────────────────── */
  ['zustand.bauteile Dach', 'ui.js:1031', 'PRUEFJAHR-2011'],
  ['zustand.bauteile Heizung', 'ui.js:1032', 'PRUEFJAHR-2017'],
  ['zustand.rnd.jahre', 'ui.js:1055', '51 Jahre'],
  ['zustand.rnd.gesamtnutzungsdauer', 'ui.js:1056', 'von 79'],
  ['zustand.rnd.verfahren', 'ui.js:1057', 'PRUEF-ANLAGE-2'],

  /* ── Ankauf (v2139) ───────────────────────────────────────────────── */
  ['ankauf.kennzahlen_damals', 'ui.js:967', 'PRUEF-KENNZAHLEN-DAMALS'],
  ['ankauf.festgeschrieben_am', 'ui.js:969', '2024-09-29'],

  /* ── die, die vorher schon ankamen: Gegenprobe gegen einen Rueckbau ─ */
  ['steuer.zve', 'ui.js:895', z(87654)],
  ['bewirtschaftung.weg_ruecklage', 'ui.js:917', z(2567)],
  ['boden.bodenrichtwert_eur_qm', 'ui.js:980', '219'],
  /* ⚠ ZURUECKGENOMMEN (v2139a) — hier standen vier Erwartungen, und
     ZWEI davon waren MEIN Fehler, nicht der des Codes:

       ['halter.halter',      'PRUEF-HALTER-GMBH']
       ['wohnung.stellplatz', 'PRUEF-TG']

     Das Feld heisst `halter.name` (ui.js:988), nicht `halter.halter`;
     und Stellplaetze stehen als `garagen` und `stellplaetze_aussen`
     (ui.js:976), ein Feld `stellplatz` gibt es nicht. Beide werden
     gelesen - `openaiService.js:481-486` und `:463-469`.

     > Ein Pruefer, der einen Feldnamen erfindet, meldet ein Leck, das
     > es nicht gibt - und schickt den naechsten Leser in die falsche
     > Datei. Die Namen unten sind jetzt an `ui.js` ausgelesen.

     Die dritte Erwartung war ebenfalls meine: `modernisierung` ist ein
     OBJEKT (Gewerk -> Stufe), kein String. Dass der Leser einen String
     trotzdem annimmt und in Buchstaben zerlegt, ist der eigentliche
     Fund - abgesichert in v2139a.

     Nur `einheiten.stand` war ein echtes Leck. */
  ['halter.name', 'ui.js:988', 'PRUEF-HALTER-GMBH'],
  ['wohnung.garagen', 'ui.js:976', '3'],
  ['objekt.einheiten.stand', 'ui.js:837', '2026-10-12'],
  ['objekt.einheiten.modernisierung', 'ui.js:838', 'Dach=PRUEFSTUFE-4'],
  ['objekt.einheiten.flaeche_summe', 'ui.js:788', 'ABWEICHUNG Flaeche']
];

/* ══ LAUF ════════════════════════════════════════════════════════════ */
let prompt;
try {
  prompt = openai.buildPrompt(auftrag, {});
} catch (e) {
  console.error('buildPrompt() ist geworfen: ' + e.message);
  console.error(e.stack.split('\n').slice(0, 4).join('\n'));
  process.exit(2);
}

let rot = 0, gruen = 0;
console.log('=== Kommt an, was gesendet wird? ===');
console.log('    Prompt: ' + prompt.length + ' Zeichen, '
  + prompt.split('\n').length + ' Zeilen\n');

ERWARTET.forEach(function (e) {
  const feld = e[0], quelle = e[1], suche = e[2];
  const da = prompt.indexOf(suche) >= 0;
  if (da) { gruen++; } else { rot++; }
  console.log('  ' + (da ? 'ok  ' : 'ROT ') + feld.padEnd(38)
    + quelle.padEnd(14) + (da ? '' : 'nicht im Prompt: "' + suche + '"'));
});

/* ══ DIE GEGENPROBE: findet dieser Pruefer ein Leck ueberhaupt? ══════
 *
 * Ein Pruefer, der nur bestaetigt, ist kein Pruefer. Also wird ein Feld
 * ABSICHTLICH entfernt - kommt es dann noch im Prompt an, sucht der
 * Pruefer an der falschen Stelle (etwa einen Wert, der auch woanders
 * entsteht), und der gruene Punkt darueber war nichts wert.
 *
 * > Siehe die eigene Notiz: ein Pruefer muss seine DECKUNG nennen, und
 * > jeder Erkenner braucht eine Gegenprobe. */
console.log('\n=== Gegenprobe: erkennt der Pruefer ein Leck? ===');
const proben = [
  ['einheit.vertragsart', 'PRUEF-STAFFELMIETE', function (a) {
    a.objekt.einheiten.je_einheit.forEach(function (x) { delete x.vertragsart; }); }],
  ['zustand.bauteile', 'PRUEFJAHR-2011', function (a) { delete a.zustand.bauteile; }],
  ['steuer.sanierung', '47.119', function (a) { delete a.steuer.sanierung; }],
  ['ankauf.kennzahlen_damals', 'PRUEF-KENNZAHLEN-DAMALS', function (a) {
    delete a.ankauf.kennzahlen_damals; }]
];

/* ── Die Typprobe (v2139a) ─────────────────────────────────────────────
   Ein String in `modernisierung` zerfiel bis v2139a in Einzelbuchstaben
   (`0=D, 1=a, ...`). Die Probe prueft, dass das NICHT mehr passiert -
   und dass der Text stattdessen als Text ankommt. */
const typProben = [
  ['modernisierung als String', function (a) {
      a.objekt.einheiten.modernisierung = 'Dach 2011, Heizung 2017'; },
    'Dach 2011, Heizung 2017', '0=D'],
  ['modernisierung als Array', function (a) {
      a.objekt.einheiten.modernisierung = ['Dach', 'Heizung']; },
    null, '0=Dach']
];
let blind = 0;
proben.forEach(function (pr) {
  const kopie = JSON.parse(JSON.stringify(auftrag));
  pr[2](kopie);
  let txt = '';
  try { txt = openai.buildPrompt(kopie, {}); } catch (e) { txt = 'FEHLER ' + e.message; }
  const weg = txt.indexOf(pr[1]) < 0;
  if (!weg) blind++;
  console.log('  ' + (weg ? 'ok  ' : 'ROT ') + 'ohne ' + pr[0].padEnd(30)
    + (weg ? 'verschwindet der Wert' : 'Wert ist TROTZDEM da — der Pruefer ist blind'));
});

console.log('\n=== Typproben: zerfaellt ein String in Buchstaben? ===');
let typRot = 0;
typProben.forEach(function (tp) {
  const kopie = JSON.parse(JSON.stringify(auftrag));
  tp[1](kopie);
  let txt = '';
  try { txt = openai.buildPrompt(kopie, {}); } catch (e) { txt = 'FEHLER ' + e.message; }
  const schlechtDa = txt.indexOf(tp[3]) >= 0;
  const gutDa = tp[2] == null ? true : txt.indexOf(tp[2]) >= 0;
  const ok = !schlechtDa && gutDa;
  if (!ok) typRot++;
  console.log('  ' + (ok ? 'ok  ' : 'ROT ') + tp[0].padEnd(30)
    + (schlechtDa ? 'ZERFALLEN ("' + tp[3] + '" im Prompt)'
       : (gutDa ? 'sauber' : 'Text kommt NICHT an')));
});

/* ══ REGELN OHNE DATEN ═══════════════════════════════════════════════
 *
 * Der eigentliche Befund von v2139 war kein stummes Feld, sondern ein
 * Regelblock, der Felder erklaerte, die nicht im Prompt standen. Das
 * faellt mit der Pruefung oben nicht auf: der Block IST ja da.
 *
 * Also eine zweite Frage: nennt ein Block einen Feldnamen in
 * Anfuehrungszeichen, steht dann auch ein Wert dazu? */
console.log('\n=== Regeln ohne Daten ===');
const regelFelder = [
  ['"vertragsart"', 'PRUEF-STAFFELMIETE'],
  ['"naechste_anpassung"', '2027-04-19'],
  ['"letzte_erhoehung"', '2019-07-13'],
  ['"befristet_bis"', '2031-11-23']
];
let ohneDaten = 0;
regelFelder.forEach(function (r) {
  const regelDa = prompt.indexOf(r[0]) >= 0;
  const wertDa = prompt.indexOf(r[1]) >= 0;
  const ok = !regelDa || wertDa;
  if (!ok) ohneDaten++;
  console.log('  ' + (ok ? 'ok  ' : 'ROT ') + r[0].padEnd(24)
    + (regelDa ? 'Regel da' : 'keine Regel').padEnd(14)
    + (wertDa ? 'Wert da' : 'WERT FEHLT')
    + (ok ? '' : '   <- Regel ohne Daten'));
});

/* ══ DECKUNG ═════════════════════════════════════════════════════════ */
const ui = fs.readFileSync(path.join(WURZEL, 'frontend', 'js', 'ui.js'), 'utf8');
const bauAnfang = ui.indexOf('function _buildAIPayload');
const bauEnde = ui.indexOf('\n  }', ui.indexOf('aiOptions', bauAnfang));
const bau = bauAnfang >= 0 ? ui.slice(bauAnfang, bauEnde > 0 ? bauEnde : bauAnfang + 60000) : '';

console.log('\n=== Deckung ===');
console.log('  Geprueft              : ' + ERWARTET.length + ' Felder, '
  + gruen + ' gruen, ' + rot + ' rot');
console.log('  Gegenproben           : ' + proben.length + ', davon blind: ' + blind);
console.log('  Regelbloecke          : ' + regelFelder.length + ', ohne Daten: ' + ohneDaten);
console.log('  Typproben             : ' + typProben.length + ', rot: ' + typRot);
console.log('  buildPrompt           : die ECHTE Funktion aus openaiService.js');
console.log('  _buildAIPayload       : ' + (bau ? bau.split('\n').length + ' Zeilen gelesen'
  : 'NICHT GEFUNDEN — die Feldliste unten ist dann nicht abgeglichen'));

/* Wie viele Feldnamen sendet das Frontend ueberhaupt? Eine Zahl, die
   sagt, wie gross der ungeprueefte Rest ist - ein Pruefer, der seine
   Deckung nicht nennt, wird gruen und beweist nichts. */
const gesendet = new Set();
(bau.match(/^\s{4,}([a-z_][a-z0-9_]*)\s*:/gim) || []).forEach(function (m) {
  gesendet.add(m.trim().replace(/:$/, ''));
});
console.log('  Feldnamen im Sender   : ~' + gesendet.size
  + ' (geprueft werden ' + ERWARTET.length + ' Stellen gezielt, nicht alle)');

const rc = (rot > 0 || blind > 0 || ohneDaten > 0 || typRot > 0) ? 1 : 0;
console.log('\n' + (rc === 0
  ? 'SAUBER — jedes belegte Feld kommt im Prompt an.'
  : 'ROT — ' + rot + ' Feld(er) verschwinden, ' + blind + ' blinde Probe(n), '
    + ohneDaten + ' Regel(n) ohne Daten, ' + typRot + ' Typprobe(n) rot.'));
process.exit(rc);
