/* ═══════════════════════════════════════════════════════════════════════
   ni-ins-register.js · Rezepte in die Registerdatei uebertragen

   Die Dateien in `rezepte/` sind ein AUTORENFORMAT: ein Gebiet, mehrere
   Modelle. Das Register liest ein anderes - FLACH, ein Satz JE ZWEIG,
   `ags` als Zeichenkette. Dieses Skript uebersetzt.

   Es fuegt nur HINZU. Ein Satz mit gleichem ags UND zweig wird nicht
   angefasst; wer etwas aendern will, sagt es ausdruecklich. So kann das
   Skript beliebig oft laufen, ohne Bestand zu ueberschreiben.

   Aufruf:  node ni-ins-register.js NI-03102-salzgitter [...]
            node ni-ins-register.js --alle-offenen
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const HIER = __dirname;
const REZEPTE = path.join(HIER, 'rezepte');
const ZIEL = path.join(HIER, '..', '..', 'marktbericht', 'backend',
                       'src', 'lib', 'register', 'swf-ni.json');

const MODELLANSAETZE = {
  wortlaut: 'Sachwertmodell der niedersaechsischen Gutachterausschuesse: '
    + 'NHK 2010, Bezugsmassstab Brutto-Grundflaeche, lineare '
    + 'Alterswertminderung. Der Kalkulator gibt den Sachwertfaktor zu einem '
    + 'vorlaeufigen Sachwert aus; abweichende Merkmale wirken ueber '
    + 'Umrechnungskoeffizienten.',
  nhk: 'NHK 2010',
  bezugsmassstab: 'Brutto-Grundflaeche',
  alterswertminderung: 'linear'
};

/* Die Fallzahl steht je nach Alter des Rezepts an drei Stellen: am Modell,
   oben am Gebiet als blanke Zahl, oder in einem Block `stichprobe`, der
   ausser der Fallzahl noch Kaufzeitraum und Spannen fuehrt. Am 25.09.2026
   hat ein blinder Rueckgriff auf `r.stichprobe` diesen ganzen BLOCK ins
   Zahlenfeld geschrieben - JSON nimmt das klaglos an, und ein Objekt in
   einem Zahlenfeld faellt erst auf, wenn jemand damit rechnen will.
   Deshalb wird hier nur Ausgepacktes zurueckgegeben, und nur Zahlen. */
function fallzahlAus(quelle) {
  if (quelle === undefined || quelle === null) return null;
  const roh = (typeof quelle === 'object') ? quelle.faelle : quelle;
  const n = Number(roh);
  return Number.isFinite(n) ? n : null;
}

/* ─── Gitterpruefung ──────────────────────────────────────────────────
   Ein abgetastetes Gitter kann still misslingen: liegen die Stuetzstellen
   ausserhalb des Gueltigkeitsbereichs des Kalkulators, gibt er keinen
   Fehler, sondern eine Restzahl. Am 25.09.2026 trug Cuxhaven-RH in 50 von
   54 Zellen die 0,15 - eine Datei voller Zahlen, die aussah wie eine
   Ernte. Zwei Merkmale verraten das, ohne dass man die Quelle kennt:
   ein Wert, der sich staendig wiederholt, und ein Faktor, der mit
   steigendem Sachwert NICHT faellt. */
function gitterBefund(formel) {
  if (formel.form !== 'matrix_interp') return null;
  const werte = [];
  Object.values(formel.zellen || {}).forEach((z) =>
    (z || []).forEach((v) => { if (v !== null) werte.push(v); }));
  if (!werte.length) return 'Gitter ohne einen einzigen Wert';

  const haeufig = {};
  werte.forEach((v) => { haeufig[v] = (haeufig[v] || 0) + 1; });
  const [wert, anzahl] = Object.entries(haeufig)
    .sort((a, b) => b[1] - a[1])[0];
  if (anzahl / werte.length > 0.33) {
    return 'der Wert ' + wert + ' steht in ' + anzahl + ' von '
      + werte.length + ' Zellen ('
      + Math.round(anzahl / werte.length * 100) + ' %)';
  }

  let sprung = 0;
  Object.values(formel.zellen).forEach((z) => {
    const v = (z || []).filter((x) => x !== null);
    for (let i = 1; i < v.length; i++) if (v[i] > v[i - 1]) sprung++;
  });
  /* Ein einzelner Schritt nach oben kommt in der untersten
     Bodenrichtwertzeile wirklich vor (gemessen an Osnabrueck-Land).
     Mehrere sind ein Ausfall. */
  if (sprung > 1) {
    return sprung + ' Spruenge nach oben - der Faktor muss mit '
      + 'steigendem vorlaeufigem Sachwert fallen';
  }
  return null;
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error('Welche Rezepte? z. B.  node ni-ins-register.js NI-03102-salzgitter');
  process.exit(1);
}

let namen = args;
if (args[0] === '--alle-offenen') {
  const vorhanden = new Set(
    JSON.parse(fs.readFileSync(ZIEL, 'utf8'))
      .map((s) => String(s.ags) + '|' + String(s.zweig)));
  namen = fs.readdirSync(REZEPTE).filter((f) => /^NI-.*\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((n) => {
      const r = JSON.parse(fs.readFileSync(path.join(REZEPTE, n + '.json'), 'utf8'));
      const ags = Array.isArray(r.ags) ? r.ags[0] : r.ags;
      return (r.modelle || []).some((m) => !vorhanden.has(ags + '|' + m.zweig));
    });
}

const register = JSON.parse(fs.readFileSync(ZIEL, 'utf8'));
const schonDa = new Set(register.map((s) => String(s.ags) + '|' + String(s.zweig)));
const vorher = register.length;
let neu = 0, uebersprungen = 0, abgewiesen = 0;

namen.forEach((name) => {
  const p = path.join(REZEPTE, name.replace(/\.json$/, '') + '.json');
  if (!fs.existsSync(p)) { console.error('  FEHLT: ' + name); process.exit(1); }
  const r = JSON.parse(fs.readFileSync(p, 'utf8'));
  const ags = Array.isArray(r.ags) ? r.ags[0] : r.ags;

  (r.modelle || []).forEach((m) => {
    const schluessel = ags + '|' + m.zweig;
    if (schonDa.has(schluessel)) {
      console.log('  schon da: ' + ags + ' ' + m.zweig);
      uebersprungen++; return;
    }
    if (m.gesperrt) {
      console.log('  GESPERRT: ' + ags + ' ' + m.zweig + ' - '
        + String(m.gesperrt_grund || '').split('.')[0]);
      uebersprungen++; return;
    }
    const befund = gitterBefund(m.formel || {});
    if (befund) {
      console.log('  ABGEWIESEN: ' + ags + ' ' + m.zweig + ' - ' + befund);
      abgewiesen++; return;
    }
    register.push({
      land_code: r.land_code,
      ags: String(ags),
      ebene: r.ebene || 'kreis',
      gebiet_name: r.gaa_name,
      gaa_name: r.gaa_name,
      kennzahl: 'sachwertfaktor',
      zweig: m.zweig,
      formel: m.formel,
      korrekturen: m.korrekturen || [],
      modellansaetze: MODELLANSAETZE,
      geltungsbereich: {},
      belege: [m.beleg],
      stufe: m.stufe,
      /* Anders als die bisherigen Saetze tragen diese ihre Begruendung,
         Fallzahl und Streuung wirklich - sie sind geerntet, nicht
         geschaetzt. Ein null waere hier eine verschenkte Angabe. */
      stufe_grund: m.stufe_begruendung || m.stufe_grund || null,
      /* Beim ersten Lauf am 25.09.2026 fiel Osnabrueck-Stadt auf null -
         die Zahl war da, nur woanders. Eine Fallzahl ist kein Beiwerk:
         sie sagt, wie belastbar der Satz ist. */
      fallzahl: fallzahlAus(m.fallzahl) !== null ? fallzahlAus(m.fallzahl)
        : fallzahlAus(r.stichprobe),
      streuung: (m.streuung !== undefined && m.streuung !== null) ? m.streuung
        : (r.streuung !== undefined ? r.streuung : null),
      stichtag: r.stichtag,
      berichtsjahr: r.berichtsjahr,
      modellversion: 'GMB ' + r.berichtsjahr,
      quelle_url: r.quelle_url,
      quelle_parser: 'v1612-WREZ',
      quellenvermerk: r.quellenvermerk,
      lizenz: r.lizenz,
      verwendung: 'produkt',
      auflagen: m.auflagen || r.auflagen || null,
      fundstelle: r.fundstelle
    });
    schonDa.add(schluessel);
    neu++;
    const gestalt = m.formel.form === 'matrix_interp'
      ? m.formel.achse_y.length + 'x' + m.formel.achse_x.length + ' Gitter'
      : Object.keys(m.formel.stufen || {}).length + ' Stuetzstellen';
    console.log('  + ' + ags + ' ' + m.zweig.padEnd(6) + gestalt + ', '
      + (m.korrekturen || []).length + ' Korrekturen, Fallzahl '
      + (register[register.length - 1].fallzahl === null ? 'FEHLT'
         : register[register.length - 1].fallzahl));
  });
});

/* Nach ags und zweig sortieren - eine Registerdatei, die man lesen kann. */
register.sort((a, b) => String(a.ags).localeCompare(String(b.ags))
  || String(a.zweig).localeCompare(String(b.zweig)));

fs.writeFileSync(ZIEL, JSON.stringify(register, null, 2) + '\n', 'utf8');
console.log('\nswf-ni.json: ' + vorher + ' -> ' + register.length
  + ' Saetze (' + neu + ' neu, ' + uebersprungen + ' uebersprungen, ' + abgewiesen + ' abgewiesen)');
