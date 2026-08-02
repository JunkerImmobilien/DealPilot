// quellen-import.js — Quellzeilen aus einer CSV ins Verzeichnis spielen.
// ────────────────────────────────────────────────────────────────────────────
// Warum eine Datei und kein Code: die rund 390 Gutachterausschuesse kommen in
// Wellen herein, ein Land nach dem anderen. Jede Welle als Migration oder als
// Patch waere ein Deploy fuer eine Adressliste — und jede Korrektur an einer
// Zeile ein weiterer. Mit diesem Weg ist eine Welle eine Datei.
//
//   node src/lib/quellen-import.js --datei /tmp/quellen-ni.csv [--trocken]
//
// Spalten (Semikolon, UTF-8, Kopfzeile Pflicht, Reihenfolge egal):
//   name;bundesland;ebene;ags_liste;portal_url;bestell_url;zugang;preis_eur;
//   lizenz;pruefstand;geprueft_am;geprueft_quelle;notiz
//
// Pflicht sind nur name und bundesland. ags_liste sind Kommas innerhalb des
// Feldes: "03151,03152".
//
// ZWEI REGELN, DIE HIER HAENGEN:
//
// 1. pruefstand faellt ohne Angabe auf 'offen'. Nicht auf 'geprueft'. Wer eine
//    Zeile als geprueft ausweist, muss das in der Datei hinschreiben — sonst
//    waere die ehrlichste Spalte des Verzeichnisses die am leichtesten
//    verlorene.
//
// 2. Eine bestehende Zeile mit pruefstand='geprueft' wird von einer
//    'gemeldet'- oder 'offen'-Zeile NICHT ueberschrieben. Sonst macht eine
//    fluechtige Sammelliste eine sorgfaeltige Einzelpruefung kaputt, und
//    niemand merkt es.

import fs from 'fs';
import { q, q1 } from './db.js';

const SPALTEN = ['name', 'bundesland', 'ebene', 'ags_liste', 'portal_url',
  'bestell_url', 'zugang', 'preis_eur', 'lizenz', 'pruefstand',
  'geprueft_am', 'geprueft_quelle', 'notiz'];

const ZUGANG_ERLAUBT = ['frei', 'namensnennung', 'kostenpflichtig', 'auf_anfrage', 'unbekannt'];
const STAND_ERLAUBT = ['geprueft', 'gemeldet', 'offen'];
const EBENE_ERLAUBT = ['kreis', 'land', 'bund'];

/* Rang, damit eine schwaechere Zeile eine staerkere nicht ueberschreibt. */
const RANG = { geprueft: 3, gemeldet: 2, offen: 1 };

function felder(zeile) {
  const out = []; let f = ''; let inQ = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ';' && !inQ) { out.push(f); f = ''; continue; }
    f += c;
  }
  out.push(f);
  return out;
}

export function csvLesen(text) {
  const zeilen = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((z) => z.trim());
  if (!zeilen.length) return { kopf: [], saetze: [] };
  const kopf = felder(zeilen[0]).map((k) => k.trim().toLowerCase());
  const saetze = zeilen.slice(1).map((z) => {
    const w = felder(z); const o = {};
    kopf.forEach((k, i) => { o[k] = (w[i] == null ? '' : String(w[i]).trim()); });
    return o;
  });
  return { kopf, saetze };
}

function zahl(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function leerZuNull(v) {
  return (v == null || String(v).trim() === '') ? null : String(v).trim();
}

/**
 * Eine CSV einspielen.
 * @param {string} text        Dateiinhalt
 * @param {boolean} trockenlauf  nur pruefen und zaehlen, nichts schreiben
 */
export async function quellenEinspielen(text, trockenlauf = false) {
  const { kopf, saetze } = csvLesen(text);
  const bericht = {
    ok: true, gelesen: saetze.length, angelegt: 0, aktualisiert: 0,
    geschuetzt: 0, verworfen: 0, unbekannte_spalten: [], fehler: [],
  };

  bericht.unbekannte_spalten = kopf.filter((k) => k && !SPALTEN.includes(k));
  if (!kopf.includes('name') || !kopf.includes('bundesland')) {
    return { ok: false, grund: 'Kopfzeile braucht mindestens name und bundesland', kopf };
  }

  for (const [i, s] of saetze.entries()) {
    const zn = i + 2;                       // Zeilennummer in der Datei
    const name = leerZuNull(s.name);
    const land = leerZuNull(s.bundesland);
    if (!name || !land) { bericht.verworfen++; bericht.fehler.push(`Z${zn}: name oder bundesland leer`); continue; }

    const ebene = leerZuNull(s.ebene) || 'kreis';
    if (!EBENE_ERLAUBT.includes(ebene)) {
      bericht.verworfen++; bericht.fehler.push(`Z${zn}: ebene "${ebene}" unbekannt`); continue;
    }
    const zugang = leerZuNull(s.zugang) || 'unbekannt';
    if (!ZUGANG_ERLAUBT.includes(zugang)) {
      bericht.verworfen++; bericht.fehler.push(`Z${zn}: zugang "${zugang}" unbekannt`); continue;
    }
    const stand = leerZuNull(s.pruefstand) || 'offen';
    if (!STAND_ERLAUBT.includes(stand)) {
      bericht.verworfen++; bericht.fehler.push(`Z${zn}: pruefstand "${stand}" unbekannt`); continue;
    }
    /* Eine geprueft-Zeile ohne Beleg ist keine geprueft-Zeile. */
    if (stand === 'geprueft' && !leerZuNull(s.geprueft_quelle)) {
      bericht.verworfen++;
      bericht.fehler.push(`Z${zn}: pruefstand=geprueft ohne geprueft_quelle — abgelehnt`);
      continue;
    }

    const ags = leerZuNull(s.ags_liste);
    const agsArr = ags ? ags.split(',').map((x) => x.trim()).filter(Boolean) : null;
    const preis = zahl(s.preis_eur);

    /* v1042 · Der Trockenlauf muss dieselbe Frage stellen wie der echte
     * Lauf, sonst ist er eine Beruhigung ohne Deckung. Er liest jetzt den
     * Bestand — schreiben tut er weiterhin nichts. */
    try {
      const alt = await q1(
        'SELECT id, pruefstand FROM mb.gaa_sources WHERE name = $1 AND bundesland = $2',
        [name, land]);

      if (trockenlauf) {
        if (!alt) bericht.angelegt++;
        else if (RANG[stand] < RANG[alt.pruefstand || 'offen']) bericht.geschuetzt++;
        else bericht.aktualisiert++;
        continue;
      }

      if (!alt) {
        await q1(
          `INSERT INTO mb.gaa_sources
             (name, bundesland, ebene, ags_liste, portal_url, bestell_url, zugang,
              preis_eur, lizenz, pruefstand, geprueft_am, geprueft_quelle, notiz)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date,$12,$13) RETURNING id`,
          [name, land, ebene, agsArr, leerZuNull(s.portal_url), leerZuNull(s.bestell_url),
           zugang, preis, leerZuNull(s.lizenz), stand, leerZuNull(s.geprueft_am),
           leerZuNull(s.geprueft_quelle), leerZuNull(s.notiz)]);
        bericht.angelegt++;
        continue;
      }

      if (RANG[stand] < RANG[alt.pruefstand || 'offen']) { bericht.geschuetzt++; continue; }

      /* COALESCE: ein leeres Feld in der Datei loescht nichts. Wer etwas
       * entfernen will, tut das bewusst im Admin, nicht durch eine Luecke
       * in einer Sammelliste. */
      await q1(
        `UPDATE mb.gaa_sources SET
           ebene           = COALESCE($3, ebene),
           ags_liste       = COALESCE($4, ags_liste),
           portal_url      = COALESCE($5, portal_url),
           bestell_url     = COALESCE($6, bestell_url),
           zugang          = COALESCE($7, zugang),
           preis_eur       = COALESCE($8, preis_eur),
           lizenz          = COALESCE($9, lizenz),
           pruefstand      = $10,
           geprueft_am     = COALESCE($11::date, geprueft_am),
           geprueft_quelle = COALESCE($12, geprueft_quelle),
           notiz           = COALESCE($13, notiz)
         WHERE id = $1 AND $2 = $2 RETURNING id`,
        [alt.id, land, ebene, agsArr, leerZuNull(s.portal_url), leerZuNull(s.bestell_url),
         zugang, preis, leerZuNull(s.lizenz), stand, leerZuNull(s.geprueft_am),
         leerZuNull(s.geprueft_quelle), leerZuNull(s.notiz)]);
      bericht.aktualisiert++;
    } catch (e) {
      bericht.verworfen++;
      bericht.fehler.push(`Z${zn}: ${String(e.message).slice(0, 120)}`);
    }
  }
  return bericht;
}

/* Direktaufruf von der Kommandozeile. */
const istHauptmodul = process.argv[1] && process.argv[1].endsWith('quellen-import.js');
if (istHauptmodul) {
  const arg = (n, d = null) => {
    const i = process.argv.indexOf('--' + n);
    return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d;
  };
  const datei = arg('datei');
  if (!datei || datei === true) {
    console.log('Nutzung: node src/lib/quellen-import.js --datei <pfad.csv> [--trocken]');
    process.exit(1);
  }
  const text = fs.readFileSync(datei, 'utf-8');
  quellenEinspielen(text, !!arg('trocken'))
    .then((r) => {
      if (!r.ok) { console.error('FEHLER: ' + r.grund); process.exit(1); }
      console.log('\n  gelesen       ' + r.gelesen);
      console.log('  angelegt      ' + r.angelegt);
      console.log('  aktualisiert  ' + r.aktualisiert);
      console.log('  geschuetzt    ' + r.geschuetzt + '   (bestehende geprueft-Zeile blieb stehen)');
      console.log('  verworfen     ' + r.verworfen);
      if (r.unbekannte_spalten.length) console.log('  ignorierte Spalten: ' + r.unbekannte_spalten.join(', '));
      if (r.fehler.length) { console.log('\n  BEANSTANDUNGEN'); r.fehler.slice(0, 25).forEach((f) => console.log('   ' + f)); }
      console.log('');
      process.exit(0);
    })
    .catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
}
