// parser-p1-imbde.js  (OD-02)
//
// Parser fuer die bundesweite CSV des Immobilienmarktberichts Deutschland
// (AK OGA). Einzige Quelle, die alle 16 Laender abdeckt.
//
// WAS DIESE DATEI NICHT TUT: sie erfindet keine Spaltenbedeutung.
// Die CSV hat Spaltennamen wie "Abb_4_14" — reine Abbildungsnummern aus dem
// Bericht. Ohne die Legende ist "Abb_4_14" ein Zahlenfeld ohne Bedeutung.
// Es waere ein Leichtes gewesen, aus der Groessenordnung zu raten
// ("4000-5600, das wird schon EUR/m2 ETW sein"). Genau das ist der Fehler,
// den wir uns nicht leisten: eine falsch beschriftete Zahl ist schlimmer als
// gar keine, weil sie plausibel aussieht.
//
// Deshalb: unbekannte Spalten werden mit kennzahl='imbde:Abb_4_14' und
// semantik_offen=true gespeichert. Sie sind da, sie sind auswertbar, sie
// tauchen aber nirgends als "Liegenschaftszins" auf. Sobald die Legende in
// data/imbde_legende.csv gepflegt ist, bekommen sie beim naechsten Lauf ihren
// richtigen Namen — gleiches Muster wie bei zensus2022_kreise.csv.

import { parseKlasse } from './klassen.js';

export const CODE = 'p1-imbde';

const QUELLENVERMERK =
  'AK OGA, Immobilienmarktbericht Deutschland {jahr}, Arbeitskreis der Oberen ' +
  'Gutachterausschuesse, Zentralen Geschaeftsstellen und Gutachterausschuesse ' +
  'in der Bundesrepublik Deutschland';

// Landesname in der CSV -> unser Landescode
const LAND = {
  'schleswig-holstein': 'sh', hamburg: 'hh', niedersachsen: 'ni', bremen: 'hb',
  'nordrhein-westfalen': 'nw', hessen: 'he', 'rheinland-pfalz': 'rp',
  'baden-württemberg': 'bw', 'baden-wuerttemberg': 'bw', bayern: 'by',
  saarland: 'sl', berlin: 'be', brandenburg: 'bb',
  'mecklenburg-vorpommern': 'mv', sachsen: 'sn', 'sachsen-anhalt': 'st',
  'thüringen': 'th', 'thueringen': 'th',
};

/** CSV-Zeile mit Anfuehrungszeichen und ; als Trenner. */
export function splitCsvZeile(zeile, trenner = ';') {
  const out = []; let feld = ''; let inQuote = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (c === '"') {
      if (inQuote && zeile[i + 1] === '"') { feld += '"'; i++; }
      else inQuote = !inQuote;
    } else if (c === trenner && !inQuote) { out.push(feld); feld = ''; }
    else feld += c;
  }
  out.push(feld);
  return out;
}

/**
 * Subkr_ID reparieren.
 * Die Datei ist ein R-Export. Hamburg steht dort als "2e+07" statt 20000000.
 * Wer das mit parseInt liest, bekommt 2. Das ist die Falle dieser Datei.
 */
/* v1064-WP1-2 · Die Stellenzahl steht an EINER Stelle. Sie kam vorher
 * dreimal als nackte Ziffer vor (padStart 8, length !== 8, slice(5)) — und
 * beim Reparieren faellt so etwas erfahrungsgemaess einmal hinten runter. */
export const ID_STELLEN = 9;

export function subkreisId(roh) {
  if (roh == null) return null;
  const t = String(roh).trim().replace(/"/g, '');
  if (!t) return null;
  let n;
  /* v1064-WP1-1 · ZWEI Messfehler auf einmal.
   *
   * (a) Die ID ist NEUNSTELLIG: 5 Stellen AGS + 4 Stellen Subkreis.
   *     Bei den Laendern 01 bis 09 faellt die fuehrende Null im R-Export
   *     weg — Flensburg steht als 10010000 statt 010010000. Auf acht
   *     Stellen aufgefuellt ergab das den Gemeindeschluessel 10010 statt
   *     01001: um eine Stelle verschoben, plausibel aussehend, falsch.
   *     Gepruefte Gegenproben: Flensburg 01001, Kiel 01002, Hamburg 02000,
   *     Muenchen 09162, Berlin 11000.
   *
   * (b) '1,1e+08' traegt ein deutsches Dezimalkomma. Number() macht daraus
   *     NaN, und die Zeile verschwand ohne Ton — Berlin fehlte vollstaendig.
   *     '2e+07' ging durch, weil es kein Komma hat. Eine Datei, zwei
   *     Schreibweisen; die eine war behandelt, die andere nicht.
   *
   * Laenger als neun Stellen kann keine gueltige ID sein (16077 + 9999).
   * Solche Zeilen werden gezaehlt und uebersprungen, nicht gekuerzt. */
  if (/e\+?\d+$/i.test(t)) n = Number(t.replace(',', '.'));
  else if (/^\d+$/.test(t)) n = Number(t);
  else return null;
  if (!Number.isFinite(n) || n <= 0) return null;
  const ganz = String(Math.round(n));
  if (ganz.length > ID_STELLEN) return null;
  return ganz.padStart(ID_STELLEN, '0');
}

/** 8-stellige Subkreis-ID -> { ags5, subkreis, istSubkreis } */
export function agsAusSubkreis(id8) {
  /* v1064-WP1-3 · Vier Stellen Subkreis, nicht drei. Gemessen: 652 von
   * 1.010 Zeilen enden auf '0000' (ganzer Kreis), der Rest auf 0001 bis
   * 0007. Mit drei Stellen waere aus jedem Kreis ein Subkreis geworden. */
  if (!id8 || id8.length !== ID_STELLEN) return null;
  const ags5 = id8.slice(0, 5);
  const sub = id8.slice(5);
  return { ags5, subkreis: sub, istSubkreis: sub !== '0000' };
}

/**
 * Legende laden: Abb-ID -> { kennzahl, objektart, einheit }
 * Fehlt die Datei oder die Zeile, bleibt die Spalte semantisch offen.
 */
export function ladeLegende(text) {
  const map = new Map();
  if (!text) return map;
  const zeilen = String(text).split(/\r?\n/).filter((z) => z.trim() && !z.startsWith('#'));
  if (!zeilen.length) return map;
  const kopf = splitCsvZeile(zeilen[0]).map((s) => s.trim().toLowerCase().replace(/"/g, ''));
  const iId = kopf.indexOf('abb_id');
  const iKz = kopf.indexOf('kennzahl');
  const iOa = kopf.indexOf('objektart');
  const iEh = kopf.indexOf('einheit');
  if (iId < 0 || iKz < 0) return map;
  for (const z of zeilen.slice(1)) {
    const s = splitCsvZeile(z).map((x) => x.trim().replace(/"/g, ''));
    const id = s[iId]; const kz = s[iKz];
    if (!id || !kz) continue;                     // ungepflegte Zeile -> offen lassen
    map.set(id, {
      kennzahl: kz,
      objektart: (iOa >= 0 && s[iOa]) ? s[iOa] : 'alle',
      einheit: (iEh >= 0 && s[iEh]) ? s[iEh] : null,
    });
  }
  return map;
}

/**
 * Hauptfunktion. Liefert flache Datensaetze fuer mb.param_werte.
 * @param {string} csvText  Inhalt der AK-OGA-CSV
 * @param {object} opt      { quelleUrl, legendeText }
 */
export function parse(csvText, opt = {}) {
  const legende = ladeLegende(opt.legendeText);
  const zeilen = String(csvText).split(/\r?\n/).filter((z) => z.trim().length);
  if (zeilen.length < 2) return { saetze: [], warnungen: ['CSV enthaelt keine Datenzeilen'], spalten: [] };

  const kopf = splitCsvZeile(zeilen[0]).map((s) => s.trim().replace(/"/g, ''));
  const iId = kopf.findIndex((k) => /^Subkr_ID$/i.test(k));
  const iName = kopf.findIndex((k) => /^Subkr_Name/i.test(k));
  const iJahr = kopf.findIndex((k) => /^BERJ$/i.test(k));
  const iLand = kopf.findIndex((k) => /^B_Land_Name$/i.test(k));

  const warnungen = [];
  if (iId < 0 || iJahr < 0 || iLand < 0) {
    return { saetze: [], spalten: kopf, warnungen: ['Pflichtspalten Subkr_ID / BERJ / B_Land_Name fehlen — Dateiformat hat sich geaendert'] };
  }

  // Wertspalten = alles ausser den vier Kopfspalten und der leeren Laufnummer
  const wertSpalten = kopf
    .map((name, idx) => ({ name, idx }))
    .filter((s) => s.idx !== iId && s.idx !== iName && s.idx !== iJahr && s.idx !== iLand && s.name !== '');

  const offeneSpalten = wertSpalten.filter((s) => !legende.has(s.name)).map((s) => s.name);
  if (offeneSpalten.length) {
    warnungen.push(
      `${offeneSpalten.length} von ${wertSpalten.length} Spalten ohne Legende — werden als ` +
      `semantik_offen gespeichert (data/imbde_legende.csv pflegen)`
    );
  }

  const saetze = [];
  let unbekanntesLand = 0;
  let kaputteId = 0;

  for (const z of zeilen.slice(1)) {
    const s = splitCsvZeile(z);
    const id8 = subkreisId(s[iId]);
    if (!id8) { kaputteId++; continue; }
    const teil = agsAusSubkreis(id8);
    /* v1064-WP1-4 · agsAusSubkreis darf null liefern, und niemand hat es
     * geprueft: "Cannot read properties of null (reading 'istSubkreis')".
     * Der Absturz war das kleinere Uebel — er hat den Rest gerettet.
     * Jetzt wird gezaehlt und weitergemacht; die Zahl steht in den
     * Warnungen, damit nichts lautlos verschwindet. */
    if (!teil) { kaputteId++; continue; }
    const landName = String(s[iLand] || '').trim().replace(/"/g, '').toLowerCase();
    const landCode = LAND[landName] || null;
    if (!landCode) { unbekanntesLand++; continue; }
    const jahr = parseInt(String(s[iJahr] || '').replace(/"/g, ''), 10) || null;
    const gebiet = iName >= 0 ? String(s[iName] || '').replace(/"/g, '').trim() : null;

    for (const sp of wertSpalten) {
      const k = parseKlasse(s[sp.idx]);
      if (k.min == null && k.max == null) continue;   // NA -> keine Zeile, kein Nullwert
      const leg = legende.get(sp.name) || null;

      saetze.push({
        land_code: landCode,
        ags: teil.istSubkreis ? id8 : teil.ags5,
        ebene: teil.istSubkreis ? 'subkreis' : 'kreis',
        gebiet_name: gebiet,
        gaa_name: null,
        objektart: leg ? leg.objektart : 'alle',
        kennzahl: leg ? leg.kennzahl : `imbde:${sp.name}`,
        einheit: leg ? leg.einheit : null,
        // Klassiert -> nie ein Punktwert, auch wenn min===max waere
        wert_num: k.klassiert ? null : k.min,
        wert_min: k.klassiert ? k.min : null,
        wert_max: k.klassiert ? k.max : null,
        klassiert: k.klassiert,
        offen: k.offen,
        wert_roh: k.roh,
        stufe: k.klassiert ? 'C' : 'B',
        indikativ: k.klassiert ? true : false,
        semantik_offen: !leg,
        berichtsjahr: jahr,
        stichtag: null,
        quelle_url: opt.quelleUrl || '',
        quelle_parser: CODE,
        lizenz: 'Quellenvermerk Pflicht',
        quellenvermerk: QUELLENVERMERK.replace('{jahr}', String(opt.berichtsausgabe || jahr || '')),
      });
    }
  }

  if (kaputteId) warnungen.push(`${kaputteId} Zeilen ohne lesbare Subkr_ID uebersprungen`);
  if (unbekanntesLand) warnungen.push(`${unbekanntesLand} Zeilen mit unbekanntem Bundesland uebersprungen`);

  return { saetze, warnungen, spalten: kopf, offeneSpalten };
}

export default { CODE, parse, splitCsvZeile, subkreisId, agsAusSubkreis, ladeLegende };
