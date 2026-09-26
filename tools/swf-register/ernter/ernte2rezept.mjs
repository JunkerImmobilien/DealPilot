/* ═══════════════════════════════════════════════════════════════════════
   ernte2rezept.mjs · Aus der Ernte werden Rezepte

   Die Ernte liefert je Gebiet MEHRERE Gitter — eines je Lageklasse.
   Dieses Werkzeug macht daraus Rezepte und legt die Lage sauber ab
   (`geltungsbereich.lage`, `geltungsbereich.zuordnung`).

   > **Hier stand bis v1625: „SCHREIBT NOCH NICHT INS REGISTER."** Das
   > galt zu Recht, solange `findeZweig` den ersten Satz je (ags, zweig)
   > nahm und `geltungsbereich` nicht las — ein Eintrag haette still eine
   > Lage fuer alle gelten lassen. Seit v1623 siebt die Maschine die Lage
   > VOR der Zweigwahl aus, seit v1624 bestimmt sie sie aus der
   > BORIS-Gemarkung. Weiter geht es mit `rezept2register.mjs`.

   Warum die Lage nicht als Korrektur taugt: gemessen an Goslar sind die
   Verhaeltnisse zwischen den Lagen NICHT konstant. GS 06 gegen GS 01
   liegt bei niedrigem Sachwert bei 0,74 und bei hohem bei 0,62. Ein
   einzelner Faktor waere fuer die halbe Spanne falsch.

   Aufruf:  node ernte2rezept.mjs
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'fs';
import path from 'path';

const EIN = '/arb/ernte';
const AUS = '/arb/rezepte';
fs.mkdirSync(AUS, { recursive: true });

/* Aus dem Workbook-Namen den Zweig ableiten - dieselbe Zuordnung wie in
   ni-ernte.sh, damit beide Wege dasselbe meinen. */
function zweigAus(wb) {
  if (/_sw_efh_|_sw_efhrh_/.test(wb)) return 'ezfh';
  if (/_sw_rh_/.test(wb)) return 'rhdhh';
  if (/_sw_hof_/.test(wb)) return 'hoefe';
  return null;
}

/* Wie wird eine Anschrift dieser Lage zugeordnet?
   Das ist die wichtigste Angabe im ganzen Satz: ohne sie ist das Gitter
   Zahlenmaterial ohne Weg zur Anwendung. BORIS liefert zur Adresse
   Gemarkungsnummer UND Gemeindename (gemessen 26.09.2026), beide Wege
   sind also gangbar. */
function zuordnungAus(satz) {
  if (satz.lagetabelle && satz.lagetabelle.length) {
    return {
      art: 'gemarkung',
      quelle: 'Dashboard "Lage einblenden": Gemarkung -> Lageklasse',
      hinweis: 'BORIS liefert `Gemarkungsnummer` sechsstellig mit '
             + 'Landespraefix (036271); die Tabelle des Ausschusses nennt '
             + 'die letzten vier Stellen (6271).',
      tabelle: satz.lagetabelle,
    };
  }
  /* ── NICHT JEDER LAGENAME IST EIN ORT ──────────────────────────────
     Hameln-Pyrmont fuehrt "Hameln", "Bad Pyrmont", "Kleinstaedte" und
     "Doerfer". Die ersten zwei sind Orte, die letzten zwei KATEGORIEN -
     aus einer Anschrift nicht bestimmbar. Gemessen am 26.09.2026.

     Das muss im Satz stehen, nicht nur im Kopf des Lesers: sonst sieht
     ein Gebiet, in dem die Haelfte der Objekte nie eine Lage findet,
     genauso aus wie eines, das vollstaendig zuordenbar ist. Die Maschine
     verhaelt sich ohnehin richtig (kein Treffer -> `lage_noetig`), aber
     erst diese Angabe macht sichtbar, WO nachgearbeitet werden muss. */
  const GENERISCH = /^(doerfer|dörfer|kleinstaedte|kleinstädte|uebrige|übrige|sonstige|restgebiet|laendlich|ländlich|umland|kernstadt|stadtgebiet|land)$/i;
  const namen = (satz.lagen || []).map((l) => String(l).replace(/\s*\[.*?\]\s*$/, '').trim());
  const generisch = namen.filter((n) => n.split(/,|\bund\b/)
    .every((t) => GENERISCH.test(t.trim())));

  return {
    art: 'gemeinde',
    quelle: 'Die Lagenamen des Waehlers nennen Orte (Gemeinden oder Ortsteile)',
    hinweis: 'BORIS liefert `Gemeindesname`, `Gemeindeschlüssel` und '
           + '`ortsteilName`. Die Lagenamen fuehren mehrere Orte je Klasse, '
           + 'durch Komma oder "und" getrennt, und tragen den Koeffizienten '
           + 'in eckigen Klammern. Salzgitter staffelt nach ORTSTEILEN, '
           + 'Helmstedt nach GEMEINDEN - beides wird geprueft.',
    vollstaendig: generisch.length === 0,
    nicht_zuordenbar: generisch.length ? generisch : null,
    nicht_zuordenbar_grund: generisch.length
      ? 'Diese Lagen sind KATEGORIEN, keine Orte - aus einer Anschrift '
        + 'nicht bestimmbar. Objekte, die dorthin gehoeren, bekommen '
        + 'keinen Faktor, sondern die Auskunft, welche Lagen es gibt. '
        + 'Eine geratene Lage waere teurer als gar kein Wert.'
      : null,
    tabelle: null,
  };
}

/* Eine Lagebezeichnung in ihre Bestandteile: Name und, falls angegeben,
   der Koeffizient in eckigen Klammern. */
function lageZerlegen(w) {
  const m = String(w).match(/^(.*?)\s*\[([\d,\.]+)\]\s*$/);
  if (!m) return { name: String(w).trim(), koeffizient: null };
  const z = Number(m[2].replace(',', '.'));
  return { name: m[1].trim(), koeffizient: Number.isFinite(z) ? z : null };
}

/* Ein Gitter auf Plausibilitaet pruefen - dieselben zwei Merkmale wie in
   ni-ins-register.js: wiederholt sich ein Wert zu oft, und faellt der
   Faktor mit steigendem Sachwert? */
function gitterBefund(tafel, achseS) {
  const werte = [];
  Object.values(tafel).forEach((r) => r.forEach((v) => { if (v !== null) werte.push(v); }));
  if (!werte.length) return 'Gitter ohne einen einzigen Wert';
  const h = {};
  werte.forEach((v) => { h[v] = (h[v] || 0) + 1; });
  const [w, n] = Object.entries(h).sort((a, b) => b[1] - a[1])[0];
  if (n / werte.length > 0.33) {
    return `der Wert ${w} steht in ${n} von ${werte.length} Zellen`;
  }
  let sprung = 0;
  Object.values(tafel).forEach((r) => {
    const v = r.filter((x) => x !== null);
    for (let i = 1; i < v.length; i++) if (v[i] > v[i - 1]) sprung++;
  });
  if (sprung > 1) return `${sprung} Spruenge nach oben`;
  return null;
}

const dateien = fs.readdirSync(EIN).filter((f) => f.endsWith('.json') && !/FEHLER/.test(f));
console.log(`Ernte-Dateien: ${dateien.length}\n`);

let gebaut = 0, gesperrt = 0, abgewiesen = 0;
for (const f of dateien.sort()) {
  const e = JSON.parse(fs.readFileSync(path.join(EIN, f), 'utf8'));
  const zweig = zweigAus(e.workbook);
  if (e.gesperrt) {
    console.log(`  GESPERRT ${e.workbook}: ${String(e.gesperrt_grund).slice(0, 70)}…`);
    gesperrt++; continue;
  }
  if (!zweig) { console.log(`  KEIN ZWEIG aus ${e.workbook}`); abgewiesen++; continue; }
  if (!e.gitter || !Object.keys(e.gitter).length) {
    console.log(`  OHNE GITTER ${e.workbook}`); abgewiesen++; continue;
  }

  const modelle = [];
  let schlecht = 0;
  for (const [lage, tafel] of Object.entries(e.gitter)) {
    const befund = gitterBefund(tafel, e.achse_sachwert);
    if (befund) {
      console.log(`  ABGEWIESEN ${e.workbook} / "${lage}": ${befund}`);
      schlecht++; continue;
    }
    const l = lageZerlegen(lage);
    modelle.push({
      zweig,
      lage: l.name,
      lage_roh: lage,
      lage_koeffizient: l.koeffizient,
      form: 'matrix_interp',
      formel: {
        form: 'matrix_interp',
        achse_x_feld: 'sachwert',
        achse_x_bez: 'vorläufiger Sachwert in Euro',
        achse_x: e.achse_sachwert,
        achse_y_feld: 'brw',
        achse_y_bez: 'Bodenrichtwert in €/m²',
        achse_y: Object.keys(tafel).map(Number).sort((a, b) => a - b),
        zellen: tafel,
        rundung_stellen: 2,
        liefert: 'faktor',
        normobjekt: e.normobjekt,
        hinweis: 'Am Kalkulator des Ausschusses abgetastet, '
               + 'ausschliesslich innerhalb der abgedruckten Stichprobe. '
               + 'Alle uebrigen Merkmale standen dabei auf der '
               + 'Vorgabestellung (siehe normobjekt).',
      },
      fallzahl: null,
      streuung: e.streuung ?? null,
      stufe: 'B',
      stufe_begruendung: 'Am amtlichen Kalkulator abgetastet; die Achsen '
        + 'liegen innerhalb der vom Ausschuss abgedruckten Stichprobe. '
        + 'Keine abgedruckte Wertetabelle, daher nicht Stufe A.',
    });
  }
  if (!modelle.length) { abgewiesen++; continue; }

  const rezept = {
    land_code: 'NI',
    ags: [e.ags],
    ebene: 'kreis',
    gaa_name: e.gebiet_name,
    berichtsjahr: 2026,
    stichtag: '2026-01-01',
    quelle_url: `https://public.tableau.com/views/${e.workbook}/${e.view}`,
    quelle_datei: `Tableau-Kalkulator ${e.workbook} (Grundstücksmarktinformationen Niedersachsen 2026)`,
    quellenvermerk: '© Oberer Gutachterausschuss für Grundstückswerte Niedersachsen 2026, '
      + 'dl-de/by-2-0 (www.govdata.de/dl-de/by-2-0), https://immobilienmarkt.niedersachsen.de',
    lizenz: 'dl-de/by-2-0',
    fundstelle: 'Grundstücksmarktinformationen 2026, Sachwertfaktor',
    stichprobe: e.stichprobe,
    /* DIE WICHTIGSTE ANGABE: wie kommt eine Anschrift zu ihrer Lage? */
    geltungsbereich: (function () {
      const lagen = modelle.map((m) => m.lage);
      return { lagen, zuordnung: zuordnungAus({ ...e, lagen }) };
    })(),
    /* v1625 · HIER STAND EINE SPERRE, und sie galt zu Recht: solange
       findeZweig() den ersten Satz je (ags, zweig) nahm, haette ein
       Eintrag still eine Lage fuer alle gelten lassen. Seit v1623 siebt
       die Maschine die Lage VOR der Zweigwahl aus, seit v1624 bestimmt
       sie sie aus der BORIS-Gemarkung. Eine Sperre, die nicht mehr gilt,
       haelt Arbeit auf, die laengst erlaubt ist. */
    register_bereit: 'Die Maschine wertet geltungsbereich.lage seit v1623 '
      + 'aus und bestimmt die Lage seit v1624 aus der BORIS-Gemarkung. '
      + 'Ohne bestimmbare Lage kommt kein Wert, sondern lage_noetig.',
    modelle,
  };
  fs.writeFileSync(path.join(AUS, `NI-${e.ags}-${zweig}.json`),
                   JSON.stringify(rezept, null, 1));
  gebaut++;
  console.log(`  + ${e.ags} ${zweig.padEnd(6)} ${modelle.length} Lagen`
    + (schlecht ? `, ${schlecht} abgewiesen` : '')
    + `  (${rezept.geltungsbereich.zuordnung.art})`);
}

console.log(`\nRezepte: ${gebaut} gebaut, ${gesperrt} gesperrt, ${abgewiesen} abgewiesen`);
console.log('Sie liegen in ' + AUS + '. Weiter mit rezept2register.mjs.');
