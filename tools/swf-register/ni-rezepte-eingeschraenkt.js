/* ═══════════════════════════════════════════════════════════════════════
   ni-rezepte-eingeschraenkt.js · Die Gebiete, deren Kurven nur Bilder sind

   ni-rezepte-bauen.js baut nur, wo ALLE Korrekturkurven lesbar sind.
   Diese Datei nimmt den Rest — und zwar so, dass die Luecke im Ergebnis
   SICHTBAR bleibt statt still zu verschwinden.

   ─── Wie das geht ───────────────────────────────────────────────────
   Gemessen am 25.09.2026 am laufenden Rechenkern: eine Korrektur mit
   LEEREN Stuetzstellen wird mitgezaehlt (`korrekturen_gefuehrt`) und
   landet in `korrekturen_offen`. Sie faellt nicht weg, sie meldet sich.

       Faktor 0,95 · angewandt: [Restnutzungsdauer] · offen: [Wohnflaeche]

   Genau das brauchen diese Gebiete: der Tabellenwert steht, die
   Umrechnung fehlt, und der Bericht sagt es.

   ─── Was hier NICHT behauptet wird ──────────────────────────────────
   Welche Merkmale der jeweilige Ausschuss fuehrt, ist bei diesen
   Gebieten NICHT belegt — ihre Kurven sind im PDF nur Bilder, und die
   Ueberschriften konnten nicht gelesen werden. Deshalb steht hier EINE
   Sammelkorrektur ohne Stuetzstellen, nicht drei erfundene mit Namen.

   Ebenso wenig ist belegt, welche Merkmalsauspraegung die Stellung
   trug, an der das Gitter abgetastet wurde: ni-ernte.sh setzt nur
   Bodenrichtwert und Sachwert, die uebrigen Regler bleiben auf der
   Standardstellung des Kalkulators. Bei den lesbaren Gebieten ist
   bewiesen, dass das die Normstellung ist (dort stehen alle Kurven auf
   1,00). Hier ist es eine naheliegende Annahme — und eine Annahme
   gehoert benannt, nicht eingerechnet.
   ═══════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const HIER = __dirname;
const GITTER = path.join(HIER, 'ni-ernte', 'ni-gitter');
const KURVEN = path.join(HIER, 'ni-ernte', 'ni-kurven');
const REZEPTE = path.join(HIER, 'rezepte');

const FELD = {
  'Restnutzungsdauer': ['rnd_jahre', 'Abweichende Restnutzungsdauer'],
  'Restnutzungsdauern': ['rnd_jahre', 'Abweichende Restnutzungsdauer'],
  'Standardstufe': ['standardstufe', 'Abweichende Standardstufe'],
  'Standardstufen': ['standardstufe', 'Abweichende Standardstufe'],
  'Wohnfläche': ['wohnflaeche', 'Abweichende Wohnfläche'],
  'Wohnflächen': ['wohnflaeche', 'Abweichende Wohnfläche'],
  'modifiziertes Baujahr': ['mod_baujahr', 'Abweichendes modifiziertes Baujahr'],
  'modifiziertes Baujahre': ['mod_baujahr', 'Abweichendes modifiziertes Baujahr']
};

const CHARGE = [
  { ags: '03252', datei: 'NI-03252-hameln-pyrmont', bereich: 'Landkreis Hameln-Pyrmont',
    gaa: 'Hameln-Hannover', kuerzel: 'hmhhm' },
  { ags: '03352', datei: 'NI-03352-cuxhaven',       bereich: 'Landkreis Cuxhaven',
    gaa: 'Otterndorf',      kuerzel: 'ott_cux' },
  { ags: '03356', datei: 'NI-03356-osterholz',      bereich: 'Landkreis Osterholz',
    gaa: 'Otterndorf',      kuerzel: 'ott_ohz' },
  { ags: '03359', datei: 'NI-03359-stade',          bereich: 'Landkreis Stade',
    gaa: 'Otterndorf',      kuerzel: 'ott_std' },
  { ags: '03456', datei: 'NI-03456-grafschaft-bentheim', bereich: 'Landkreis Grafschaft Bentheim',
    gaa: 'Osnabrück-Meppen', kuerzel: 'osmep_osmepnoh' },
  { ags: '03459', datei: 'NI-03459-osnabrueck-land', bereich: 'Landkreis Osnabrück',
    gaa: 'Osnabrück-Meppen', kuerzel: 'osmep_osmeposla' },
  /* Diese beiden haben schon ein Rezept (der EFH-Zweig ist vollstaendig).
     Ihr Reihenhaus-Zweig gehoert hierher, weil dort die Wohnflaechenkurve
     doppelt abgelegt wurde und damit fehlt. `anhaengen` sorgt dafuer,
     dass das bestehende Rezept ERGAENZT und nicht ueberschrieben wird -
     ein Ueberschreiben haette den vollstaendigen EFH-Satz verloren. */
  { ags: '03154', datei: 'NI-03154-helmstedt', bereich: 'Landkreis Helmstedt',
    gaa: 'Braunschweig-Wolfsburg', kuerzel: 'bshe', anhaengen: true, nurZweig: 'rh' },
  { ags: '03157', datei: 'NI-03157-peine', bereich: 'Landkreis Peine',
    gaa: 'Braunschweig-Wolfsburg', kuerzel: 'bspe', anhaengen: true, nurZweig: 'rh' }
];

const ZWEIGE = [
  { kuerzel: 'efh', zweig: 'ezfh',  bez: 'freistehendes Ein- und Zweifamilienhaus' },
  { kuerzel: 'rh',  zweig: 'rhdhh', bez: 'Reihenhaus / Doppelhaushälfte' }
];

function zahl(s) {
  if (s === undefined || s === null) return null;
  let t = String(s).trim();
  if (!t) return null;
  t = t.indexOf(',') >= 0 ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function liesCsv(p) {
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map((z) => z.split(';'));
}
function kopfdaten() {
  const k = {};
  liesCsv(path.join(HIER, 'ni-kopfdaten.csv')).slice(1).forEach((t) => {
    k[t[0]] = { ausschuss: (t[1] || '').replace(/^-\s*|\s*-$/g, '').trim(),
      stichtag: t[2], stichprobe: zahl(t[3]),
      norm_faktor: zahl(t[4]), norm_stdabw: zahl(t[5]) };
  });
  return k;
}
function gitterLesen(wb) {
  const csv = path.join(GITTER, wb + '.csv');
  if (!fs.existsSync(csv)) return null;
  const brwSet = [], swSet = [], wert = {};
  let streuung = null;
  liesCsv(csv).forEach((t) => {
    const brw = zahl(t[0]), sw = zahl(t[1]), fk = zahl(t[2]), st = zahl(t[3]);
    if (brw === null || sw === null) return;
    if (!brwSet.includes(brw)) brwSet.push(brw);
    if (!swSet.includes(sw)) swSet.push(sw);
    if (fk !== null) wert[brw + '|' + sw] = fk;
    if (st !== null && streuung === null) streuung = st;
  });
  brwSet.sort((a, b) => a - b); swSet.sort((a, b) => a - b);
  const zellen = {}; let belegt = 0;
  brwSet.forEach((b) => {
    zellen[String(b)] = swSet.map((s) => {
      const v = wert[b + '|' + s];
      if (v === undefined) return null;
      belegt++; return v;
    });
  });
  if (!belegt) return null;
  return { achse_y: brwSet, achse_x: swSet, zellen, belegt, streuung,
           gesamt: brwSet.length * swSet.length };
}
/* Lesbare Kurven mitnehmen, Doppelungen verwerfen (siehe
   ni-rezepte-bauen.js: bei zwei Gebieten lag dieselbe Kurve zweimal). */
function kurvenLesen(wb) {
  const p = path.join(KURVEN, wb + '.json');
  if (!fs.existsSync(p)) return { korrekturen: [], normobjekt: [] };
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const korr = [], norm = [], gesehen = {};
  (j.kurven || []).forEach((k) => {
    const abb = FELD[k.merkmal];
    const st = k.stuetzstellen || {};
    if (!abb || !Object.keys(st).length) return;
    const sig = JSON.stringify(st);
    if (gesehen[sig]) return;
    gesehen[sig] = k.merkmal;
    const stufen = {};
    Object.keys(st).forEach((s) => { const n = zahl(s); if (n !== null) stufen[String(n)] = st[s]; });
    korr.push({ bez: abb[1], feld: abb[0], art: 'stufen', wirkung: 'multiplikativ',
      stufen, rundung_stellen: 2,
      hinweis: Object.keys(stufen).length + ' abgedruckte Stützstellen.' });
    const nw = (k.normobjekt && String(k.normobjekt).trim()) ? String(k.normobjekt).trim()
      : (k.normobjekt_interpoliert ? String(k.normobjekt_interpoliert) : null);
    if (nw) norm.push({ merkmal: k.merkmal, wert: nw });
  });
  return { korrekturen: korr, normobjekt: norm };
}

/* Die Sammelkorrektur: gefuehrt, aber nicht bezifferbar. Der Rechenkern
   meldet sie dadurch bei JEDER Anfrage als offen. */
const SAMMEL = {
  bez: 'Umrechnung für abweichende Merkmale (im Dokument nur als Bild)',
  feld: '_nicht_lesbar', art: 'stufen', wirkung: 'multiplikativ',
  stufen: {}, rundung_stellen: 2,
  hinweis: 'Der Ausschuss druckt Umrechnungskurven ab, aber ohne Zahlen an '
    + 'den Datenpunkten — sie sind aus dem PDF nicht lesbar. Der '
    + 'Tabellenwert gilt deshalb nur für die Stellung, an der er '
    + 'abgetastet wurde. Diese Korrektur bleibt absichtlich unbeziffert, '
    + 'damit sie als offen gemeldet wird statt still zu fehlen.'
};

const KD = kopfdaten();
let gebaut = 0, uebersprungen = [];

CHARGE.forEach((geb) => {
  const modelle = [];
  ZWEIGE.forEach((zw) => {
    if (geb.nurZweig && geb.nurZweig !== zw.kuerzel) return;
    const wb = '2026_sw_' + zw.kuerzel + '_' + geb.kuerzel;
    const g = gitterLesen(wb);
    if (!g) { uebersprungen.push(wb + ' (kein belegtes Gitter)'); return; }
    const k = kurvenLesen(wb);
    const kd = KD[wb] || {};
    const vollstaendig = k.korrekturen.length >= 3;
    if (vollstaendig) { uebersprungen.push(wb + ' (vollstaendig - gehoert in ni-rezepte-bauen.js)'); return; }

    const korrekturen = k.korrekturen.concat([SAMMEL]);
    const normText = k.normobjekt.map((n) => n.merkmal + ' ' + n.wert).join(' · ');

    modelle.push({
      zweig: zw.zweig, zweig_bez: zw.bez, form: 'matrix_interp',
      formel: {
        form: 'matrix_interp',
        achse_x_feld: 'sachwert', achse_x_bez: 'vorläufiger Sachwert in Euro',
        achse_x: g.achse_x,
        achse_y_feld: 'brw', achse_y_bez: 'Bodenrichtwert in €/m²',
        achse_y: g.achse_y,
        zellen: g.zellen, rundung_stellen: 2, liefert: 'faktor',
        normobjekt: normText || null,
        hinweis: 'Die ' + g.belegt + ' Zellen sind an der STANDARDSTELLUNG des '
          + 'Kalkulators abgetastet — ni-ernte.sh setzt nur Bodenrichtwert und '
          + 'Sachwert. Bei den Gebieten mit lesbaren Kurven ist bewiesen, dass '
          + 'die Standardstellung das Normobjekt ist; hier ist es eine '
          + 'naheliegende, aber unbewiesene Annahme. '
          + (k.korrekturen.length
              ? 'Lesbar war die Umrechnung für: '
                + k.korrekturen.map((x) => x.bez.replace(/^Abweichende[sr]? /, '')).join(', ') + '. '
              : 'Keine der Umrechnungskurven war lesbar. ')
          + 'Die übrigen bleiben als offene Korrektur im Ergebnis stehen.'
      },
      korrekturen,
      auflagen: 'Die Faktoren gelten nur für einen vorläufigen Sachwert nach dem '
        + 'Modell der niedersächsischen Gutachterausschüsse (NHK 2010, '
        + 'Brutto-Grundfläche, lineare Alterswertminderung, GND 80 Jahre). '
        + 'ZUSÄTZLICH: die Umrechnung für abweichende Merkmale konnte nicht '
        + 'gelesen werden — für ein Objekt, das von der Abtaststellung '
        + 'abweicht, ist der Faktor insoweit unkorrigiert.',
      stufe: 'B',
      stufe_begruendung: 'Amtliche Quelle, Gitterwerte am Kalkulator des '
        + 'Ausschusses abgetastet. Stufe B statt A: die Stützstellen sind von '
        + 'uns gewählt, und die Umrechnungskurven dieses Gebiets sind im '
        + 'Dokument nur als Bild abgedruckt — sie konnten nicht übernommen '
        + 'werden und werden deshalb als offene Korrektur ausgewiesen.',
      fallzahl: kd.stichprobe !== undefined ? kd.stichprobe : null,
      streuung: g.streuung !== null ? g.streuung : (kd.norm_stdabw ?? null),
      beleg: 'Kalkulator ' + wb + ' (Tableau Public, Profil ogagmd2026), '
        + 'Datenbasis ' + (kd.stichtag || '01.01.2026')
        + (kd.stichprobe ? ', Stichprobe ' + kd.stichprobe + ' Kauffälle' : '')
        + '. ' + g.belegt + ' von ' + g.gesamt + ' Stützpunkten belegt'
        + (kd.norm_faktor ? '; der Ausschuss weist an der Standardstellung den '
            + 'Faktor ' + String(kd.norm_faktor).replace('.', ',') + ' aus' : '') + '.'
    });
  });

  if (!modelle.length) return;

  /* Anhaengen statt ueberschreiben: das bestehende Rezept traegt den
     vollstaendigen EFH-Satz, der hier nicht verlorengehen darf. */
  const zielDatei = path.join(REZEPTE, geb.datei + '.json');
  if (geb.anhaengen && fs.existsSync(zielDatei)) {
    const alt = JSON.parse(fs.readFileSync(zielDatei, 'utf8'));
    const da = new Set((alt.modelle || []).map((m) => m.zweig));
    const neu = modelle.filter((m) => !da.has(m.zweig));
    if (!neu.length) { uebersprungen.push(geb.datei + ' (Zweig schon im Rezept)'); return; }
    alt.modelle = (alt.modelle || []).concat(neu);
    fs.writeFileSync(zielDatei, JSON.stringify(alt, null, 2) + '\n', 'utf8');
    gebaut++;
    console.log('  ' + geb.datei + '.json  ·  ERGÄNZT um ' + neu.length + ' Modell  ·  '
      + neu.map((m) => m.zweig + ' ' + m.formel.achse_y.length + 'x' + m.formel.achse_x.length
          + ' (' + m.korrekturen.filter((k) => Object.keys(k.stufen).length).length + ' lesbar, '
          + m.korrekturen.filter((k) => !Object.keys(k.stufen).length).length + ' offen)').join(', '));
    return;
  }

  const rezept = {
    land_code: 'NI',
    gaa_name: 'Gutachterausschuss für Grundstückswerte ' + geb.gaa + ', Bereich ' + geb.bereich,
    gaa_kennz: geb.ags, ags: [geb.ags], ebene: 'kreis',
    berichtsjahr: 2026, stichtag: '2026-01-01',
    auswertezeitraum: '11/2022 bis 10/2025',
    beschlossen: null, veroeffentlicht: '2026-03-02',
    quelle_url: 'https://public.tableau.com/views/2026_sw_efh_' + geb.kuerzel + '/dash',
    quelle_datei: 'Tableau-Kalkulatoren für ' + geb.bereich
      + ' (Grundstücksmarktinformationen Niedersachsen 2026)',
    quellenvermerk: '© Oberer Gutachterausschuss für Grundstückswerte Niedersachsen '
      + '2026, dl-de/by-2-0 (www.govdata.de/dl-de/by-2-0), '
      + 'https://immobilienmarkt.niedersachsen.de',
    lizenz: 'dl-de/by-2-0',
    fundstelle: 'Grundstücksmarktinformationen 2026, Sachwertfaktor, Kalkulatoren für ' + geb.bereich,
    modelle
  };
  fs.writeFileSync(path.join(REZEPTE, geb.datei + '.json'),
    JSON.stringify(rezept, null, 2) + '\n', 'utf8');
  gebaut++;
  console.log('  ' + geb.datei + '.json  ·  ' + modelle.length + ' Modelle  ·  '
    + modelle.map((m) => m.zweig + ' ' + m.formel.achse_y.length + 'x' + m.formel.achse_x.length
        + ' (' + m.korrekturen.filter((k) => Object.keys(k.stufen).length).length + ' lesbar, '
        + m.korrekturen.filter((k) => !Object.keys(k.stufen).length).length + ' offen)').join(', '));
});

console.log('\nGebaut: ' + gebaut + ' Rezepte');
if (uebersprungen.length) {
  console.log('Übersprungen:');
  uebersprungen.forEach((u) => console.log('  ' + u));
}
