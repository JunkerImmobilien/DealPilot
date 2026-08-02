// OpenDataConnector.js — Wertermittlungsdaten aus den Open-Data-Portalen.
// ────────────────────────────────────────────────────────────────────────────
// DER RICHTIGE WEG, nachdem Crawler und PDF-Import beide umstaendlich waren:
// Die Laender veroeffentlichen ihre Grundstuecksmarktdaten als CSV in
// CKAN-Portalen, mit offener Lizenz und stabiler API. Kein HTML-Kratzen,
// keine PDF-Extraktion, keine JavaScript-Anwendungen.
//
// Nordrhein-Westfalen, Datensatz "Grundstuecksmarktdaten NRW":
//   Lizenz  Datenlizenz Deutschland Zero 2.0 — kommerzielle Nutzung erlaubt
//   Inhalt  lzs.csv mit 11 Objektarten x 16 Kennzahlen je Gemeinde
//   Umfang  73 Gutachterausschuesse, 396 Gemeinden
//
// Und es ist nicht nur der Zinssatz: die Datei liefert auch die
// Bewirtschaftungskostenquote, Rest- und Gesamtnutzungsdauer, Marktmiete und
// Kaufpreisniveau — alles amtlich abgeleitet und regional. Damit rechnet der
// Ertragswert nicht mehr mit Tabellenwerten aus einer Verordnungsanlage,
// sondern mit dem, was der Gutachterausschuss vor Ort gemessen hat.

import { inflateRawSync } from 'node:zlib';
import { q1 } from '../lib/db.js';

/* Kein adm-zip: die Abhaengigkeiten des mb-Backends sind cors, express und pg,
 * und dabei soll es bleiben. Ein ZIP-Leser fuer unkomprimierte und
 * deflate-Eintraege ist ueberschaubar, und zlib ist eingebaut.
 *
 * Gelesen wird ueber das zentrale Verzeichnis am Dateiende — der einzig
 * verlaessliche Weg, die lokalen Kopfsaetze luegen bei gestreamten Archiven
 * ueber die Groessen. */
function zipEintraege(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Kein ZIP-Verzeichnis gefunden');
  const anzahl = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let n = 0; n < anzahl; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const methode = buf.readUInt16LE(p + 10);
    const gross = buf.readUInt32LE(p + 24);
    const nLen = buf.readUInt16LE(p + 28);
    const eLen = buf.readUInt16LE(p + 30);
    const kLen = buf.readUInt16LE(p + 32);
    const lokal = buf.readUInt32LE(p + 42);
    const name = buf.toString('latin1', p + 46, p + 46 + nLen);
    out.push({ name, methode, gross, lokal });
    p += 46 + nLen + eLen + kLen;
  }
  return out;
}

function zipLies(buf, eintrag) {
  const p = eintrag.lokal;
  if (buf.readUInt32LE(p) !== 0x04034b50) throw new Error('Kaputter Eintrag: ' + eintrag.name);
  const nLen = buf.readUInt16LE(p + 26);
  const eLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nLen + eLen;
  const roh = buf.subarray(start, start + eintrag.gross);
  return eintrag.methode === 0 ? roh : inflateRawSync(roh);
}

/* Node 22 bringt fetch mit — kein eigener HTTP-Baustein noetig. */
async function holeBuffer(url, ms = 120000) {
  const ab = new AbortController();
  const t = setTimeout(() => ab.abort(), ms);
  try {
    const r = await fetch(url, { signal: ab.signal, headers: { 'User-Agent': kennung() } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  } finally { clearTimeout(t); }
}

function kennung() {
  return process.env.OPENDATA_USER_AGENT
    || 'DealPilot/1.0 (Immobilienbewertung; +https://dealpilot.immo; info@dealpilot.immo)';
}

/* Quellen. Je Land ein CKAN-Datensatz; die Ressourcen-URL kommt aus der API,
 * damit ein Umzug der Datei uns nicht bricht. */
export const OPENDATA_QUELLEN = [
  {
    land: 'NW',
    name: 'Grundstuecksmarktdaten NRW',
    ckan: 'https://ckan.open.nrw.de/api/3/action/package_show?id=ad760913-eb7b-4843-b3b7-dc9100b788ca',
    lizenz: 'dl-de/zero-2-0',
    format: 'nrw-gmd',
    /* v1048-WMOD-1 · Modell zur Ableitung von Liegenschaftszinssaetzen,
     * AGVGA.NRW, Stand 21.06.2016. Landesweit einheitlich fuer alle
     * nordrhein-westfaelischen Gutachterausschuesse. */
    modell: 'agvga_nrw_2016',
    /* v1041-WQR-1 · Ressourcenmuster gehoert zur Quelle, nicht in den Code.
     * Vorher stand /GMDNRW_CSV\.zip$/ fest in findeDatei() — ein zweites
     * Land haette dort nie etwas gefunden. */
    datei_muster: /GMDNRW_CSV\.zip$/i,
    /* Fallback, falls die API einmal nicht antwortet. */
    direkt: 'https://www.opengeodata.nrw.de/produkte/infrastruktur_bauen_wohnen/boris/GMD/GMDNRW_CSV.zip',
  },
];

/* Objektarten der Quelle auf unsere abbilden.
 * we_v = Wohnungseigentum vermietet — das ist der Fall, den ein Kapitalanleger
 * kauft, und deshalb der richtige fuer unsere 'etw'. we_s (selbstgenutzt)
 * liegt regelmaessig darunter und waere hier irrefuehrend. */
const ART_MAP = {
  efh: ['efh'],
  zfh: ['zfh'],
  rhdhh: ['rh', 'dhh'],
  dreifh: ['mfh_bis6'],
  mfh: ['mfh_bis6', 'mfh_ueber6'],
  we_v: ['etw'],
  we_s: ['etw_selbstgenutzt'],
  ggg: ['gemischt'],
  handel: ['handel'],
  buero: ['buero'],
  gegi: ['gewerbe'],
};

/* Plausibilitaetsband je Kennzahl. Was ausserhalb liegt, wird verworfen und
 * gezaehlt — eine stille Uebernahme waere schlimmer als eine Luecke. */
const BAND = {
  lzs: [0.1, 12], bwk_pct: [5, 45], rnd: [1, 100], gnd: [30, 100],
  miete: [1, 60], kp_qm: [50, 20000],
};

function zahl(v) {
  const t = String(v == null ? '' : v).trim();
  if (!t || t === '-') return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/* CSV mit Semikolon und Anfuehrungszeichen, Latin-1. Keine Bibliothek noetig,
 * das Format ist eng genug. */
function csvLesen(text) {
  const zeilen = text.split(/\r?\n/).filter((z) => z.trim());
  const teile = (z) => {
    const out = []; let f = ''; let inQ = false;
    for (let i = 0; i < z.length; i++) {
      const c = z[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ';' && !inQ) { out.push(f); f = ''; continue; }
      f += c;
    }
    out.push(f);
    return out;
  };
  const kopf = teile(zeilen[0]);
  return zeilen.slice(1).map((z) => {
    const w = teile(z); const o = {};
    kopf.forEach((k, i) => { o[k] = w[i]; });
    return o;
  });
}

export const OpenDataConnector = {

  /** Ressourcen-URL aus der CKAN-API holen, mit Fallback. */
  async findeDatei(quelle) {
    try {
      const b = await holeBuffer(quelle.ckan, 30000);
      const j = JSON.parse(b.toString('utf-8'));
      const res = (j.result && j.result.resources) || [];
      /* Die aktuelle Fassung heisst ohne Jahrgang; die mit Jahr sind Archiv. */
      const muster = quelle.datei_muster || /\.zip$/i;
      const akt = res.find((x) => muster.test(x.url || ''));
      if (akt) return { url: akt.url, stand: j.result.metadata_modified || null };
    } catch (e) { /* Fallback unten */ }
    return { url: quelle.direkt, stand: null };
  },

  /**
   * Einlesen und als Stufe A ablegen.
   * @param {object} o
   * @param {boolean} [o.trockenlauf]  nur zaehlen, nichts schreiben
   */
  async importiere({ land = 'NW', trockenlauf = false } = {}) {
    const quelle = OPENDATA_QUELLEN.find((x) => x.land === land);
    if (!quelle) return { ok: false, grund: `Keine Open-Data-Quelle fuer ${land}` };

    /* v1041-WQR-2 · Der Rumpf unten liest NRWs Spaltenschema (quellArt +
     * '_lzs', '_bwk', '_rnd' ...). Ein anderes Land hat andere Spalten.
     * Ohne diese Sperre laeuft der Import durch, findet nichts und meldet
     * Erfolg mit null Zeilen — der teuerste aller Fehler, weil er wie ein
     * leerer Datensatz aussieht statt wie ein Programmfehler.
     * Neues Land = neuer Parser HIER, nicht nur ein Eintrag in der Liste. */
    if (quelle.format !== 'nrw-gmd') {
      return { ok: false, grund: `Format "${quelle.format}" hat noch keinen Parser. `
        + `Die Spaltennamen der Quelle muessen erst gemessen werden — geraten waere schlimmer als eine Luecke.` };
    }

    const datei = await this.findeDatei(quelle);
    let buf, eintraege;
    try {
      buf = await holeBuffer(datei.url);
      eintraege = zipEintraege(buf);
    } catch (e) {
      return { ok: false, grund: 'Download fehlgeschlagen: ' + String(e.message).slice(0, 120) };
    }

    /* Latin-1: die Quelle liefert "Düsseldorf" als D\xfcsseldorf. */
    const hol = (n) => {
      const e = eintraege.find((x) => x.name.toLowerCase().endsWith(n));
      return e ? zipLies(buf, e).toString('latin1') : null;
    };
    const lzsTxt = hol('lzs.csv');
    const schlTxt = hol('schluessel.csv');
    if (!lzsTxt) return { ok: false, grund: 'lzs.csv nicht im Archiv' };

    /* v1043-WTDZ-1 · Zaehler VOR dem Namensblock. In v1042 stand dort
     * bericht.namen — aber `bericht` wird erst rund 20 Zeilen spaeter
     * deklariert. Temporale Todeszone: node --check hat es durchgewunken,
     * der erste echte Erntelauf ist abgestuerzt. */
    let namenAngelegt = 0;
    let gaaAngelegt = 0;   /* v1044-WZUS-1 · vor dem Block, siehe v1043 */

    /* Gemeinde -> Gutachterausschuss, fuer die Quellenangabe. */
    const gaa = {};
    if (schlTxt) {
      csvLesen(schlTxt).forEach((z) => {
        if (z.ags) gaa[z.ags] = { name: z.gaa_name, kreis: z.kreis_kreisfreiestadt };
      });
      /* v1042-WNAM-2 · Kreisnamen nebenbei mitschreiben. Fehler hier duerfen
       * den Import nie kippen — es ist eine Anzeigehilfe, keine Rechengroesse.
       * Deshalb je Zeile ein eigenes catch und kein Abbruch. */
      if (!trockenlauf) {
        const gesehen = new Set();
        for (const z of csvLesen(schlTxt)) {
          const k5 = String(z.ags || '').slice(0, 5);
          const nam = (z.kreis_kreisfreiestadt || '').trim();
          if (!k5 || k5.length < 5 || !nam || gesehen.has(k5)) continue;
          gesehen.add(k5);
          await q1(`INSERT INTO mb.ags_namen (ags, name, ebene, bundesland, quelle, stand)
                    VALUES ($1,$2,'kreis',$3,$4,CURRENT_DATE)
                    ON CONFLICT (ags) DO NOTHING RETURNING ags`,
                   [k5, nam, k5.slice(0, 2) === '05' ? 'NW' : null,
                    'schluessel.csv, ' + quelle.name]).catch(() => {});
        }
        namenAngelegt = gesehen.size;
      }

      /* v1044-WZUS-2 · Zustaendigkeitskarte. Je gaa_name eine Quellzeile
       * mit allen Gemeinden ihres Bereichs. Damit weiss der Bericht auch
       * fuer die 355 Gemeinden OHNE eigenen Zinssatz, wer zustaendig ist —
       * statt kommentarlos auf Paragraf 256 zu fallen. */
      if (!trockenlauf) {
        const proAusschuss = new Map();
        for (const z of csvLesen(schlTxt)) {
          const nm = (z.gaa_name || '').trim();
          const ag = String(z.ags || '').trim();
          if (!nm || ag.length !== 8) continue;
          if (!proAusschuss.has(nm)) proAusschuss.set(nm, []);
          proAusschuss.get(nm).push(ag);
        }
        for (const [nm, liste] of proAusschuss) {
          await q1(
            `INSERT INTO mb.gaa_sources
               (name, bundesland, ebene, ags_liste, portal_url, zugang, lizenz,
                pruefstand, geprueft_am, geprueft_quelle, notiz)
             VALUES ($1,'NW','kreis',$2,$3,'frei',$4,'geprueft',CURRENT_DATE,$5,$6)
             ON CONFLICT (name, bundesland) DO UPDATE
               SET ags_liste = EXCLUDED.ags_liste,
                   pruefstand = 'geprueft',
                   geprueft_am = CURRENT_DATE
             RETURNING id`,
            [nm, liste, 'https://www.boris.nrw.de/borisplus/', quelle.lizenz,
             'schluessel.csv aus ' + quelle.name,
             liste.length + ' Gemeinden im Zustaendigkeitsbereich.']).catch(() => {});
          gaaAngelegt++;
        }
      }
    }

    const zeilen = csvLesen(lzsTxt);
    const bericht = {
      ok: true, quelle: quelle.name, lizenz: quelle.lizenz, datei: datei.url,
      /* v1044-WZUS-3 · frueher hiess das Feld 'gemeinden' und meldete 73.
       * 73 ist die Zeilenzahl der lzs.csv — NRW hat 427 Gemeinden, und nur
       * 72 davon tragen ueberhaupt einen Zinssatz. Das Etikett hat eine
       * Abdeckung von 18 Prozent wie Vollstaendigkeit aussehen lassen. */
      stand: datei.stand, wertzeilen: zeilen.length,
      angelegt: 0, uebersprungen: 0, unplausibel: 0, unsicher: 0, arten: {},
    };
    bericht.namen = namenAngelegt;   /* v1043-WTDZ-2 */
    bericht.ausschuesse = gaaAngelegt;

    for (const z of zeilen) {
      const ags = String(z.ags || '').trim();
      if (!ags) continue;
      /* v1047-WKRS-1 · Ein achtstelliger Schluessel auf drei Nullen ist der
       * KREIS, nicht eine Gemeinde: 05770000 = Kreis Minden-Luebbecke.
       * Als Gemeinde abgelegt findet ihn niemand — Huellhorst ist 05770016.
       * Belegt: 52 der 71 NRW-Schluessel sind Kreiswerte. */
      const _istKreis = ags.length === 8 && ags.slice(5) === '000';
      const zielAgs = _istKreis ? ags.slice(0, 5) : ags;
      const zielEbene = _istKreis ? 'kreis' : 'gemeinde';
      const jahr = parseInt(z.berichtsjahr, 10) || null;
      const stichtag = jahr ? `${jahr}-12-31` : null;
      const g = gaa[ags] || {};

      for (const [quellArt, unsere] of Object.entries(ART_MAP)) {
        const lzs = zahl(z[quellArt + '_lzs']);
        if (lzs == null) { bericht.uebersprungen++; continue; }
        if (lzs < BAND.lzs[0] || lzs > BAND.lzs[1]) { bericht.unplausibel++; continue; }

        /* Die Quelle markiert selbst, wenn ein Wert unsicher ist. Das
         * uebernehmen wir als Qualitaetsabstufung statt es zu verschweigen. */
        const unsicher = String(z[quellArt + '_lzs_unsicher'] || '').trim() === '1';
        if (unsicher) bericht.unsicher++;

        const fall = parseInt(z[quellArt + '_anz'], 10) || null;
        const stabw = zahl(z[quellArt + '_lzs_stabw']);
        const bwk = zahl(z[quellArt + '_bwk']);
        const rnd = zahl(z[quellArt + '_rnd']);
        const gnd = zahl(z[quellArt + '_gnd']);
        const miete = zahl(z[quellArt + '_miete']);

        const quelleText = `${g.name || quelle.name}, Grundstücksmarktdaten ${jahr || ''}`
          + (fall ? `, ${fall} Kauffälle` : '')
          + (stabw != null ? `, Streuung ±${stabw}` : '')
          + (unsicher ? ' — von der Quelle als unsicher gekennzeichnet' : '');

        for (const art of unsere) {
          bericht.arten[art] = (bericht.arten[art] || 0) + 1;
          if (trockenlauf) continue;
          try {
            await q1(
              `INSERT INTO mb.wert_parameter
                 (ags, ags_ebene, objektart, typ, wert, wert_min, wert_max, einheit,
                  qualitaet, fallzahl, quelle_text, quelle_url, modellversion,
                  stichtag, gueltig_von, geprueft_am)
               VALUES ($1,$11,$2,'lzs',$3,$4,$5,'prozent',$6,$7,$8,$9,
                       /* v1048-WMOD-2 · nicht mehr fest immowertv2021 */
                       $12,$10::date, COALESCE($10::date, CURRENT_DATE), now())
               ON CONFLICT DO NOTHING RETURNING id`,
              [zielAgs, art, lzs,
               stabw != null ? Math.max(0.1, lzs - stabw) : null,
               stabw != null ? lzs + stabw : null,
               unsicher ? 'B' : 'A', fall, quelleText, datei.url, stichtag, zielEbene,
               quelle.modell || 'immowertv2021']);
            bericht.angelegt++;

            /* Die uebrigen Kennzahlen als eigene Parameter — sie machen den
             * Ertragswert erst wirklich regional. */
            const weitere = [
              ['bwk_pct', bwk, 'prozent'], ['rnd', rnd, 'jahre'],
              ['gnd', gnd, 'jahre'], ['miete_qm', miete, 'eur_qm'],
            ];
            for (const [typ, wert, einheit] of weitere) {
              if (wert == null) continue;
              const b = BAND[typ];
              if (b && (wert < b[0] || wert > b[1])) continue;
              await q1(
                `INSERT INTO mb.wert_parameter
                   (ags, ags_ebene, objektart, typ, wert, einheit, qualitaet,
                    fallzahl, quelle_text, quelle_url, modellversion, stichtag, gueltig_von)
                 /* v1049-WMOD-1 · Die zweite Einfuegung schrieb den Vermerk
                  * weiter fest. v1048 hat nur die erste erwischt. */
                 VALUES ($1,$11,$2,$3,$4,$5,$6,$7,$8,$9,$12,$10::date,
                         COALESCE($10::date, CURRENT_DATE))
                 ON CONFLICT DO NOTHING RETURNING id`,
                [zielAgs, art, typ, wert, einheit, unsicher ? 'B' : 'A', fall,
                 quelleText, datei.url, stichtag, zielEbene,
                 quelle.modell || 'immowertv2021']).catch(() => {});
            }
          } catch (e) { /* eine Zeile kippt den Lauf nicht */ }
        }
      }
    }
    return bericht;
  },
};
