/* ═══════════════════════════════════════════════════════════════════════
   ni-rezepte-bauen.js · Rezepte aus der Niedersachsen-Ernte

   Baut aus dem, was ni-ernte.sh und ni-kurven-ernte.sh geerntet haben,
   fertige Registersaetze. Erfindet NICHTS: jede Zahl steht entweder im
   Gitter, in der Kurvendatei oder in den Kopfdaten.

   WAS HIER ZUSAMMENKOMMT
     ni-ags.csv                     AGS und amtlicher Name
     ni-kopfdaten.csv               Ausschuss, Stichtag, Stichprobe, Streuung
     ni-ernte/ni-gitter/*.csv       brw;sachwert;faktor;streuung
     ni-ernte/ni-gitter/*.csv.meta  die abgetasteten Achsen
     ni-ernte/ni-kurven/*.json      Korrekturkurven und Normobjekt

   NUR GEBIETE MIT LESBAREN KURVEN. Wo die Kurven im PDF nur Bilder sind,
   entsteht hier kein Rezept - ein Faktor ohne seine Korrekturen sieht
   genauso aus wie einer mit, und das waere die gefaehrlichste Sorte
   Zahl. Diese Gebiete brauchen einen eigenen Bauschritt, in dem die
   Einschraenkung mitgeliefert wird.

   Der Aufbau folgt NI-03101-braunschweig.json, Feld fuer Feld.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const HIER = __dirname;
const GITTER = path.join(HIER, 'ni-ernte', 'ni-gitter');
const KURVEN = path.join(HIER, 'ni-ernte', 'ni-kurven');
const REZEPTE = path.join(HIER, 'rezepte');

/* ── Die Gebiete dieser Charge ───────────────────────────────────────
   Alle drei liegen im Gutachterausschuss Braunschweig-Wolfsburg und
   haben ALLE DREI Korrekturkurven lesbar (gepruft am 25.09.2026). */
const CHARGE = [
  { ags: '03102', datei: 'NI-03102-salzgitter',  name: 'Salzgitter',
    bereich: 'Stadt Salzgitter',      kuerzel: 'bssz' },
  { ags: '03154', datei: 'NI-03154-helmstedt',   name: 'Helmstedt',
    bereich: 'Landkreis Helmstedt',   kuerzel: 'bshe' },
  { ags: '03157', datei: 'NI-03157-peine',       name: 'Peine',
    bereich: 'Landkreis Peine',       kuerzel: 'bspe' }
];

const ZWEIGE = [
  { kuerzel: 'efh',  zweig: 'ezfh',
    bez: 'freistehendes Ein- und Zweifamilienhaus',
    fundstelle: 'Ein- und Zweifamilienhäuser' },
  { kuerzel: 'rh',   zweig: 'rhdhh',
    bez: 'Reihenhaus / Doppelhaushälfte',
    fundstelle: 'Reihenhaus/Doppelhaushälfte' }
];

/* Merkmal der Kurve -> Feld im Rechenkern. Die Namen stehen so im
   Dashboard; Mehrzahl und Einzahl kommen beide vor. */
const FELD = {
  'Restnutzungsdauer': ['rnd_jahre', 'Abweichende Restnutzungsdauer'],
  'Restnutzungsdauern': ['rnd_jahre', 'Abweichende Restnutzungsdauer'],
  'Standardstufe': ['standardstufe', 'Abweichende Standardstufe'],
  'Standardstufen': ['standardstufe', 'Abweichende Standardstufe'],
  'Wohnfläche': ['wohnflaeche', 'Abweichende Wohnfläche'],
  'Wohnflächen': ['wohnflaeche', 'Abweichende Wohnfläche']
};

/* Zwei Schreibweisen liegen nebeneinander, und sie sehen gleich aus:
   das Dashboard druckt "2,5" (deutsches Komma), der Kurvenleser legt
   "30.8333" ab (Punkt als DEZIMALtrenner). Wer den Punkt pauschal als
   Tausendertrenner streicht, macht aus 30,8333 Jahren 308.333 - so
   geschehen beim ersten Lauf am 25.09.2026.
   Regel: gibt es ein Komma, ist es der Dezimaltrenner und Punkte sind
   Tausender. Gibt es keins, ist der Punkt der Dezimaltrenner. */
function zahl(s) {
  if (s === undefined || s === null) return null;
  let t = String(s).trim();
  if (!t) return null;
  t = t.indexOf(',') >= 0
    ? t.replace(/\./g, '').replace(',', '.')
    : t;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/* CSV mit Semikolon, deutsche Dezimalkommas. */
function liesCsv(p) {
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean)
    .map((z) => z.split(';'));
}

function kopfdaten() {
  const karte = {};
  liesCsv(path.join(HIER, 'ni-kopfdaten.csv')).slice(1).forEach((t) => {
    karte[t[0]] = {
      ausschuss: (t[1] || '').replace(/^-\s*|\s*-$/g, '').trim(),
      stichtag: t[2], stichprobe: zahl(t[3]),
      norm_faktor: zahl(t[4]), norm_stdabw: zahl(t[5]), teilmarkt: t[6]
    };
  });
  return karte;
}

/* Das Gitter in die Form bringen, die der Rechenkern liest:
   zellen = { <brw>: [faktor je sachwert, ...] } mit null fuer Luecken. */
function gitterLesen(wb) {
  const csv = path.join(GITTER, wb + '.csv');
  if (!fs.existsSync(csv)) return null;
  const zeilen = liesCsv(csv);
  const brwSet = [], swSet = [];
  const wert = {};
  let streuung = null;
  zeilen.forEach((t) => {
    const brw = zahl(t[0]), sw = zahl(t[1]), fk = zahl(t[2]), st = zahl(t[3]);
    if (brw === null || sw === null) return;
    if (!brwSet.includes(brw)) brwSet.push(brw);
    if (!swSet.includes(sw)) swSet.push(sw);
    if (fk !== null) wert[brw + '|' + sw] = fk;
    if (st !== null && streuung === null) streuung = st;
  });
  brwSet.sort((a, b) => a - b);
  swSet.sort((a, b) => a - b);
  const zellen = {};
  let belegt = 0;
  brwSet.forEach((b) => {
    zellen[String(b)] = swSet.map((s) => {
      const v = wert[b + '|' + s];
      if (v === undefined) return null;
      belegt++;
      return v;
    });
  });
  return { achse_y: brwSet, achse_x: swSet, zellen, belegt, streuung,
           zellen_gesamt: brwSet.length * swSet.length };
}

function kurvenLesen(wb) {
  const p = path.join(KURVEN, wb + '.json');
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const korr = [], norm = [];
  /* ── Dieselbe Kurve unter zwei Namen ist KEINE zweite Kurve ────────
     Gemessen am 25.09.2026: bei 2026_sw_rh_bshe und 2026_sw_rh_bspe
     liegen unter "Restnutzungsdauer" und "Wohnflächen" Zeichen fuer
     Zeichen dieselben Stuetzstellen (15/25/35/45/55/65/75) - das sind
     Jahre, keine Quadratmeter. Die echte Wohnflaechenkurve wurde nie
     gelesen; der Leser hat die erste zweimal abgelegt.

     Eine daraus gebaute "Korrektur fuer abweichende Wohnflaeche" waere
     fuer jedes Objekt mit anderer Wohnflaeche still falsch - und eine
     falsche Korrektur ist gefaehrlicher als eine fehlende, weil der
     Faktor mit ihr genauso aussieht wie ohne sie. */
  const gesehen = {};
  (j.kurven || []).forEach((k) => {
    const abb = FELD[k.merkmal];
    if (!abb) return;
    const st = k.stuetzstellen || {};
    if (!Object.keys(st).length) return;
    const sig = JSON.stringify(st);
    if (gesehen[sig]) {
      korr.doppelt = (korr.doppelt || []);
      korr.doppelt.push(k.merkmal + ' ist Zeichen für Zeichen dieselbe Kurve wie '
        + gesehen[sig] + ' — nicht gelesen, sondern doppelt abgelegt');
      return;
    }
    gesehen[sig] = k.merkmal;
    /* Schluessel mit deutschem Komma ("2,5") in Zahlen wandeln - der
       Rechenkern vergleicht numerisch, nicht als Text. */
    const stufen = {};
    Object.keys(st).forEach((s) => {
      const n = zahl(s);
      if (n !== null) stufen[String(n)] = st[s];
    });
    korr.push({
      bez: abb[1], feld: abb[0], art: 'stufen', wirkung: 'multiplikativ',
      stufen, rundung_stellen: 2,
      hinweis: Object.keys(stufen).length + ' abgedruckte Stützstellen. '
        + 'Zwischen ihnen wird linear interpoliert; über den Rand hinaus '
        + 'wird nicht verlängert.'
    });
    const nw = (k.normobjekt && String(k.normobjekt).trim())
      ? String(k.normobjekt).trim()
      : (k.normobjekt_interpoliert ? String(k.normobjekt_interpoliert) : null);
    if (nw) norm.push({ merkmal: k.merkmal, wert: nw,
                        abgelesen: !!(k.normobjekt && String(k.normobjekt).trim()) });
  });
  return { korrekturen: korr, normobjekt: norm, doppelt: korr.doppelt || [] };
}

function normText(norm) {
  const teil = [];
  norm.forEach((n) => {
    const v = zahl(n.wert);
    if (/Wohnfl/.test(n.merkmal)) teil.push('Wohnfläche ' + Math.round(v) + ' m²');
    else if (/Restnutzung/.test(n.merkmal)) teil.push('Restnutzungsdauer ' + Math.round(v) + ' Jahre');
    else if (/Standard/.test(n.merkmal)) teil.push('Standardstufe ' + String(v).replace('.', ','));
  });
  return teil.join(' · ');
}

/* ══ Bauen ═══════════════════════════════════════════════════════════ */
const KD = kopfdaten();
let gebaut = 0, uebersprungen = [];

CHARGE.forEach((geb) => {
  const modelle = [];
  ZWEIGE.forEach((zw) => {
    const wb = '2026_sw_' + zw.kuerzel + '_' + geb.kuerzel;
    const g = gitterLesen(wb);
    const k = kurvenLesen(wb);
    if (!g) { uebersprungen.push(wb + ' (kein Gitter)'); return; }
    if (!k || k.korrekturen.length < 3) {
      uebersprungen.push(wb + ' (nur ' + (k ? k.korrekturen.length : 0)
        + ' von 3 Korrekturen lesbar'
        + ((k && k.doppelt.length) ? ' — ' + k.doppelt.join('; ') : '')
        + '). Ohne die fehlende Umrechnung waere der Faktor fuer jedes '
        + 'abweichende Objekt still falsch.');
      return;
    }
    const kd = KD[wb];
    if (!kd) { uebersprungen.push(wb + ' (keine Kopfdaten)'); return; }

    modelle.push({
      zweig: zw.zweig,
      zweig_bez: zw.bez,
      form: 'matrix_interp',
      formel: {
        form: 'matrix_interp',
        achse_x_feld: 'sachwert',
        achse_x_bez: 'vorläufiger Sachwert in Euro',
        achse_x: g.achse_x,
        achse_y_feld: 'brw',
        achse_y_bez: 'Bodenrichtwert in €/m²',
        achse_y: g.achse_y,
        zellen: g.zellen,
        rundung_stellen: 2,
        liefert: 'faktor',
        normobjekt: normText(k.normobjekt),
        hinweis: 'Alle ' + g.belegt + ' belegten Zellen sind am NORMOBJEKT '
          + 'abgetastet — dort stehen alle drei Umrechnungskurven auf 1,00. '
          + 'Abweichende Merkmale wirken über die Korrekturen.'
      },
      korrekturen: k.korrekturen,
      auflagen: 'Die Faktoren gelten nur für einen vorläufigen Sachwert, der '
        + 'nach dem Modell der niedersächsischen Gutachterausschüsse ermittelt '
        + 'wurde (NHK 2010, Bezugsmaßstab Brutto-Grundfläche, lineare '
        + 'Alterswertminderung, Gesamtnutzungsdauer 80 Jahre). Für einen nach '
        + 'anderem Modell ermittelten Sachwert gelten sie nicht.',
      stufe: 'B',
      stufe_begruendung: 'Stufe B statt A: die Gitterwerte sind nicht aus einer '
        + 'abgedruckten Tabelle übernommen, sondern am amtlichen Kalkulator '
        + 'abgetastet; die Stützstellen sind von uns gewählt. Die drei '
        + 'Korrekturkurven dagegen sind vom Ausschuss selbst abgedruckt.',
      fallzahl: kd.stichprobe,
      streuung: g.streuung !== null ? g.streuung : kd.norm_stdabw,
      beleg: 'Kalkulator ' + wb + ' (Tableau Public, Profil ogagmd2026), '
        + 'Datenbasis ' + kd.stichtag + ', Stichprobe ' + kd.stichprobe
        + ' Kauffälle. ' + g.belegt + ' von ' + g.zellen_gesamt
        + ' Stützpunkten belegt; der Ausschuss weist am Normobjekt den Faktor '
        + String(kd.norm_faktor).replace('.', ',') + ' aus.'
    });
  });

  if (!modelle.length) return;

  const rezept = {
    land_code: 'NI',
    gaa_name: 'Gutachterausschuss für Grundstückswerte Braunschweig-Wolfsburg, '
      + 'Bereich ' + geb.bereich,
    gaa_kennz: geb.ags,
    ags: [geb.ags],
    ebene: 'kreis',
    berichtsjahr: 2026,
    stichtag: '2026-01-01',
    auswertezeitraum: '11/2022 bis 10/2025',
    beschlossen: null,
    veroeffentlicht: '2026-03-02',
    quelle_url: 'https://public.tableau.com/views/2026_sw_efh_' + geb.kuerzel + '/dash',
    quelle_datei: 'Tableau-Kalkulatoren 2026_sw_efh_' + geb.kuerzel + ' und '
      + '2026_sw_rh_' + geb.kuerzel + ' (Grundstücksmarktinformationen '
      + 'Niedersachsen 2026)',
    quellenvermerk: '© Oberer Gutachterausschuss für Grundstückswerte '
      + 'Niedersachsen 2026, dl-de/by-2-0 (www.govdata.de/dl-de/by-2-0), '
      + 'https://immobilienmarkt.niedersachsen.de',
    lizenz: 'dl-de/by-2-0',
    fundstelle: 'Grundstücksmarktinformationen 2026, Sachwertfaktor, '
      + 'Kalkulatoren für ' + geb.bereich,
    modelle
  };

  const ziel = path.join(REZEPTE, geb.datei + '.json');
  fs.writeFileSync(ziel, JSON.stringify(rezept, null, 2) + '\n', 'utf8');
  gebaut++;
  console.log('  ' + geb.datei + '.json  ·  ' + modelle.length + ' Modelle  ·  '
    + modelle.map((m) => m.zweig + ' ' + m.formel.achse_y.length + 'x'
        + m.formel.achse_x.length + ' (' + m.korrekturen.length + ' Korrekturen)').join(', '));
});

console.log('\nGebaut: ' + gebaut + ' Rezepte');
if (uebersprungen.length) {
  console.log('Übersprungen:');
  uebersprungen.forEach((u) => console.log('  ' + u));
}
