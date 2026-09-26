/* ═══════════════════════════════════════════════════════════════════════
   rezept2register.mjs · Die geernteten Lagesaetze ins Register

   BIS v1623 WAERE DAS FALSCH GEWESEN. `findeZweig` nahm den ersten Satz
   je (ags, zweig) und las `geltungsbereich` nicht - mehrere Saetze je
   Zweig haetten still eine Lage fuer alle gelten lassen. Schlimmer noch:
   `waehleAusGruppe` hielt sie fuer zwei BAUJAHRSGRUPPEN und gab ganz
   auf ("objektart_nicht_abgeleitet"), obwohl der Ausschuss die Objektart
   fuehrt.

   Seit v1623/v1624 kann die Maschine es: die Lage wird VOR der Zweigwahl
   ausgesiebt, und v1624 bestimmt sie aus der BORIS-Gemarkung oder dem
   Gemeindenamen. Ohne bestimmbare Lage kommt KEIN Wert, sondern
   `lage_noetig` mit der Liste der gefuehrten Lagen.

   Additiv: ein Satz mit gleichem ags|zweig|lage wird nicht angefasst.

   Aufruf:  node rezept2register.mjs [--schreiben]
            (ohne --schreiben nur zeigen, was passieren wuerde)
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const REZ = '/arb/rezepte';
const ZIEL = '/arb/swf-ni.json';
const schreiben = process.argv.includes('--schreiben');

const MODELLANSAETZE = {
  wortlaut: 'Sachwertmodell der niedersaechsischen Gutachterausschuesse: '
    + 'NHK 2010, Bezugsmassstab Brutto-Grundflaeche, lineare '
    + 'Alterswertminderung. Der Kalkulator gibt den Sachwertfaktor zu einem '
    + 'vorlaeufigen Sachwert aus; abweichende Merkmale wirken ueber '
    + 'Umrechnungskoeffizienten.',
  nhk: 'NHK 2010',
  bezugsmassstab: 'Brutto-Grundflaeche',
  alterswertminderung: 'linear',
};

const register = JSON.parse(fs.readFileSync(ZIEL, 'utf8'));
const schonDa = new Set(register.map((s) =>
  String(s.ags) + '|' + String(s.zweig) + '|' + String((s.geltungsbereich || {}).lage || '')));
const vorher = register.length;

let neu = 0, uebersprungen = 0;
for (const f of fs.readdirSync(REZ).filter((x) => x.endsWith('.json')).sort()) {
  const r = JSON.parse(fs.readFileSync(path.join(REZ, f), 'utf8'));
  const ags = Array.isArray(r.ags) ? r.ags[0] : r.ags;
  for (const m of r.modelle || []) {
    const key = String(ags) + '|' + m.zweig + '|' + m.lage;
    if (schonDa.has(key)) { uebersprungen++; continue; }
    register.push({
      land_code: r.land_code,
      ags: String(ags),
      ebene: r.ebene || 'kreis',
      gebiet_name: r.gaa_name,
      gaa_name: r.gaa_name,
      kennzahl: 'sachwertfaktor',
      zweig: m.zweig,
      formel: m.formel,
      korrekturen: [],
      modellansaetze: MODELLANSAETZE,
      /* DIE LAGE UND IHR ZUORDNUNGSWEG. Ohne beides waere der Satz
         Zahlenmaterial ohne Weg zur Anwendung - `lageAusOrt` in
         gutachterausschuss.js liest genau diese zwei Felder. */
      geltungsbereich: {
        lage: m.lage,
        lage_roh: m.lage_roh,
        lage_koeffizient: m.lage_koeffizient,
        zuordnung: (r.geltungsbereich || {}).zuordnung || null,
      },
      belege: [{
        art: 'kalkulator',
        wortlaut: 'Am Kalkulator des Ausschusses abgetastet, ausschliesslich '
          + 'innerhalb der abgedruckten Stichprobe. Alle uebrigen Merkmale '
          + 'standen auf der Vorgabestellung.',
        stichprobe: r.stichprobe || null,
      }],
      stufe: m.stufe,
      stufe_grund: m.stufe_begruendung || null,
      fallzahl: m.fallzahl ?? null,
      streuung: m.streuung ?? null,
      stichtag: r.stichtag,
      berichtsjahr: r.berichtsjahr,
      modellversion: 'GMB ' + r.berichtsjahr,
      quelle_url: r.quelle_url,
      quelle_parser: 'v1625-ERNTER',
      quellenvermerk: r.quellenvermerk,
      lizenz: r.lizenz,
      verwendung: 'produkt',
      auflagen: null,
      fundstelle: r.fundstelle,
    });
    schonDa.add(key);
    neu++;
    console.log(`  + ${ags} ${m.zweig.padEnd(6)} "${m.lage}"`);
  }
}

register.sort((a, b) => String(a.ags).localeCompare(String(b.ags))
  || String(a.zweig).localeCompare(String(b.zweig))
  || String((a.geltungsbereich || {}).lage || '')
       .localeCompare(String((b.geltungsbereich || {}).lage || '')));

console.log(`\nswf-ni.json: ${vorher} -> ${register.length} `
  + `(${neu} neu, ${uebersprungen} schon da)`);
if (schreiben) {
  fs.writeFileSync(ZIEL, JSON.stringify(register, null, 2) + '\n', 'utf8');
  console.log('geschrieben.');
} else {
  console.log('NICHT geschrieben - mit --schreiben wiederholen.');
}
