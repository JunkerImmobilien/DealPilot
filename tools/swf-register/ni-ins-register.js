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
let neu = 0, uebersprungen = 0;

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
      fallzahl: (m.fallzahl !== undefined) ? m.fallzahl : null,
      streuung: (m.streuung !== undefined) ? m.streuung : null,
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
    console.log('  + ' + ags + ' ' + m.zweig.padEnd(6)
      + m.formel.achse_y.length + 'x' + m.formel.achse_x.length + ' Gitter, '
      + (m.korrekturen || []).length + ' Korrekturen, Fallzahl ' + m.fallzahl);
  });
});

/* Nach ags und zweig sortieren - eine Registerdatei, die man lesen kann. */
register.sort((a, b) => String(a.ags).localeCompare(String(b.ags))
  || String(a.zweig).localeCompare(String(b.zweig)));

fs.writeFileSync(ZIEL, JSON.stringify(register, null, 2) + '\n', 'utf8');
console.log('\nswf-ni.json: ' + vorher + ' -> ' + register.length
  + ' Saetze (' + neu + ' neu, ' + uebersprungen + ' schon da)');
