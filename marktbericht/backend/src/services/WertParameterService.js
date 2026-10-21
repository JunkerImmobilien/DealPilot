// WertParameterService.js — liest Wertermittlungsparameter aus mb.wert_parameter
// nach der Abdeckungs-Kaskade des Konzepts.
//
//   A  amtlich kreisscharf     aus dem Bericht des zustaendigen Gutachterausschusses
//   B  amtlich regional        aus dem Landesgrundstuecksmarktbericht
//   C  eigene Marktableitung   aus DealPilot-Objektdaten, N >= 10
//   N  DealPilot-Formel        v2401 · aus allen amtlichen Zinssaetzen des
//                              Registers abgeleitet (lib/lzs_naeherung.js), nie
//                              amtlich; nur Wohnen, RND 5-80, nur in Laendern,
//                              in denen sie gemessen genauer ist als § 256, und
//                              NIE, wo das Register fuer die AGS einen Satz fuehrt
//                              (Wert, Sperre, Rueckfrage)
//   D  gesetzlicher Auffangwert  § 256 BewG (nur noch der Auffangwert)
//   E  Nutzereingabe           schlaegt immer alles (wird hier NICHT gelesen,
//                              sondern vom Aufrufer vorrangig gesetzt)
//
// Grundsatz: es wird IMMER ein Wert geliefert, aber nie ohne Stufe und Quelle.
// Eine Zahl ohne Herkunft ist im Dossier wertlos.

import { q } from '../lib/db.js';
/* v1816 · der Weg zum Register. Kein Ringschluss: gutachterausschuss.js
   und ausschuss_register.js kennen diesen Dienst nicht (gegengeprueft). */
import { finde as regFinde, lagenFuer as regLagen } from '../lib/ausschuss_register.js';
import { liegenschaftszinssatz as regZins } from '../lib/gutachterausschuss.js';
import { zinssatzFuerObjekt } from '../lib/zweigwahl.js';
import { lzsNach256, MODELL } from '../lib/immowertv.js';
import { stufeNachStreuung } from '../lib/nrw_modell.js';   /* v1048-WSTR-1 */
/* v2401 · Stufe N - die DealPilot-Formel fuer den Liegenschaftszins */
import { lzsNaeherung, lzsNaeherungsDaten } from '../lib/lzs_naeherung.js';
/* v1063-WOD-1 · Die Open-Data-Tabelle wurde in v1054 angelegt, gefuellt hat
 * sie nie jemand und gelesen hat sie niemand. Ab hier liest sie die Kaskade
 * — ueber das Repository, nicht mit eigenem SQL. */
import { machRepository } from '../connectors/opendata/param-repository.js';
import { kennzahlFuerTyp, objektartFuerOd, einheitPasst, wertPlausibel }
  from '../connectors/opendata/kennzahlen.js';
/* v1099-WQL · Der Weg zur Quelle. Marcels Vorgabe: wo wir keinen Wert
   liefern, soll der Nutzer sehen, WER ihn fuehrt und WO er steht. */
import { quelleFuer, quellenSatz } from '../lib/quellen_links.js';

const RANG = { A: 1, B: 2, C: 3, N: 4, D: 5 };   /* v2401 · N zwischen C und D */
const MIN_FALLZAHL_C = 10;   // Konzept Kap. 5.3 — darunter kein Wert aus eigener Ableitung

/** Objektart des Formulars -> Schluessel der Parametertabelle. */
export function parameterObjektart(objektart, anzahlWe = null) {
  const k = String(objektart ?? '').toLowerCase().trim();
  if (/etw|wohnung|whg|apartment|appartement/.test(k)) return 'etw';
  if (/^(efh|einfamilien)/.test(k)) return 'efh';
  if (/^(zfh|zweifamilien)/.test(k)) return 'zfh';
  if (/dhh|doppelhaus/.test(k)) return 'dhh';
  if (/^rh$|reihen/.test(k)) return 'rh';
  if (/mfh|mehrfamilien/.test(k)) return Number(anzahlWe) > 6 ? 'mfh_ueber6' : 'mfh_bis6';
  /* v2381 · „haus" ohne Hausart ist KEIN Einfamilienhaus: Hiddenhausen (ZFH)
     bekam hier still den EFH-Satz 1,7 % statt des ZFH-Satzes. Ohne Hausart
     trifft nur ein Satz fuer alle Objektarten. */
  if (/villa/.test(k)) return 'efh';
  if (/haus/.test(k)) return 'haus';
  return 'mfh_bis6';
}

/* v2381 · Ausschuesse, die Wohnungseigentum in Objekten mit hoechstens zwei
   Wohneinheiten ausdruecklich aus ihrer Eigentumswohnungs-Auswertung nehmen.
   Nur mit belegtem Wortlaut; die Stadt Minden (05770024) hat einen eigenen
   Ausschuss und steht deshalb NICHT darunter. */
const ETW_KLEINOBJEKT_AUSGENOMMEN = {
  '05770': 'Der Gutachterausschuss für Grundstückswerte im Kreis Minden-Lübbecke wertet nur '
    + 'die typischen am Markt gehandelten Eigentumswohnungen aus, „also Wohnungen in Objekten mit '
    + 'mehr als zwei Wohneinheiten" (Grundstücksmarktbericht 2025); Wohnungseigentum in '
    + 'Zweifamilienhäusern ist ausgenommen.',
};
export function etwKleinobjektAusgenommen(ags) {
  const a = String(ags || '').replace(/\D/g, '');
  if (a.startsWith('05770024')) return null;
  return ETW_KLEINOBJEKT_AUSGENOMMEN[a.slice(0, 5)] || null;
}

/** AGS-Kette vom Kreis aufwaerts: 05770 -> 057 (Bezirk) -> 05 (Land) -> 00000 (Bund). */
function agsKette(ags) {
  const a = String(ags ?? '').replace(/\D/g, '');
  const kette = [];
  /* v1039 · Gemeinde zuerst. Die Open-Data-Saetze der Laender sind
   * gemeindescharf (achtstelliger Schluessel) — genauer als der Kreis, und
   * bei einem Stadtstaat oder einer kreisfreien Stadt macht es den
   * Unterschied zwischen "Duisburg" und "irgendwo im Ruhrgebiet". */
  if (a.length >= 8) kette.push({ ags: a.slice(0, 8), ebene: 'gemeinde' });
  if (a.length >= 5) kette.push({ ags: a.slice(0, 5), ebene: 'kreis' });
  if (a.length >= 3) kette.push({ ags: a.slice(0, 3), ebene: 'bezirk' });
  if (a.length >= 2) kette.push({ ags: a.slice(0, 2), ebene: 'land' });
  kette.push({ ags: '00000', ebene: 'bund' });
  return kette;
}

/* v1044-WNBW-2 · Abschaltbar, damit sich auf Staging vergleichen laesst,
 * was der Nachbarwert an den Zahlen aendert — ohne Rollout. */
const NACHBARWERT_AN = (process.env.NACHBARWERT || '1') !== '0';

/** Achtstelligen Gemeindeschluessel herausziehen, falls vorhanden. */
function a8(ags) {
  const a = String(ags ?? '').replace(/\D/g, '');
  return a.length >= 8 ? a.slice(0, 8) : null;
}

/**
 * Amtlicher Wert einer anderen Gemeinde desselben Gutachterausschusses.
 * Stufe C — indikativ. Nicht 'eigene Marktableitung': der Wert IST amtlich,
 * nur nicht fuer diese Gemeinde ermittelt. Der Standardhinweis fuer C
 * waere hier schlicht falsch, deshalb ein eigener Text.
 */
async function nachbarwert(ags8, art, tag) {
  if (!ags8) return null;
  let rows = [];
  try {
    rows = await q(
      `SELECT p.wert, p.wert_min, p.wert_max, p.fallzahl, p.quelle_text,
              p.quelle_url, p.modellversion, p.ags AS herkunft_ags, p.stichtag,
              s.name AS gaa, n.name AS herkunft_ort
         FROM mb.gaa_sources s
         JOIN mb.wert_parameter p ON p.ags = ANY(s.ags_liste)
         LEFT JOIN mb.ags_namen n ON n.ags = p.ags
        WHERE $1 = ANY(s.ags_liste)
          AND p.ags <> $1
          AND p.typ = 'lzs'
          AND p.objektart IN ($2, 'alle')
          AND p.qualitaet IN ('A','B')
          AND p.gueltig_von <= $3::date
          AND (p.gueltig_bis IS NULL OR p.gueltig_bis >= $3::date)
        ORDER BY p.fallzahl DESC NULLS LAST, p.gueltig_von DESC
        LIMIT 1`, [ags8, art, tag]) || [];
  } catch (e) { return null; }

  const r = rows[0];
  if (!r) return null;
  /* Dieselbe Schwelle wie fuer jeden anderen C-Wert. Ein Zinssatz aus vier
   * Kauffaellen wandert nicht in den Nachbarort. */
  if (Number(r.fallzahl || 0) < MIN_FALLZAHL_C) return null;

  const ort = r.herkunft_ort || r.herkunft_ags;
  return {
    wert: Number(r.wert),
    min: r.wert_min != null ? Number(r.wert_min) : null,
    max: r.wert_max != null ? Number(r.wert_max) : null,
    stufe: 'C',
    quelle: r.quelle_text || null,
    quelle_url: r.quelle_url || null,
    parameter_id: null,
    modellversion: r.modellversion || MODELL.IMMOWERTV_2021,
    fallzahl: r.fallzahl != null ? Number(r.fallzahl) : null,
    ebene: 'gutachterausschuss',
    /* v2390 · eindeutig erkennbar, nicht aus dem Hinweistext erraten */
    nachbarwert: true, herkunft_ort: ort || null, ausschuss: r.gaa || null,
    /* v2396 · Jahrgang der Tabellenzeile, damit der Aufrufer ihn gegen das Register haelt */
    berichtsjahr: r.stichtag ? (r.stichtag instanceof Date ? r.stichtag.getFullYear()
                                                          : Number(String(r.stichtag).slice(0, 4))) : null,
    hinweis: 'Fuer diese Gemeinde hat der Gutachterausschuss keinen eigenen '
      + 'Liegenschaftszinssatz abgeleitet. Verwendet wird der Wert fuer '
      + ort + ' (N = ' + (r.fallzahl || '?') + ') aus dem Bericht desselben '
      + 'Ausschusses: ' + (r.gaa || 'unbekannt') + '. Amtlich ermittelt, aber '
      + 'nicht fuer diesen Ort — daher indikativ.',
  };
}

/* v1063-WOD-2 · Abschaltbar, wie der Nachbarwert. Auf Staging laesst sich
 * damit vergleichen, was die Open-Data-Ebene an den Zahlen aendert. */
const OPENDATA_AN = (process.env.OPENDATA_KASKADE || '1') !== '0';

let _odRepoCache = null;
function odRepo() {
  if (!_odRepoCache) _odRepoCache = machRepository(q);
  return _odRepoCache;
}

/**
 * Ein Satz aus mb.param_werte, uebersetzt in die Sprache der Kaskade.
 *
 * ZWEI DINGE, DIE NICHT AUFGEWEICHT WERDEN:
 *
 * 1) KLASSIERTE SAETZE RECHNEN NICHT. Der Immobilienmarktbericht Deutschland
 *    liefert "2500 und mehr". Das ist kein Wert 2500 und auch keine 3000 —
 *    es ist eine Klasse. Die Mitte zu nehmen waere eine Erfindung mit
 *    Nachkommastelle. Solche Saetze kommen als EINORDNUNG zurueck: sichtbar
 *    im Bericht, ausserhalb der Rechnung.
 *
 * 2) EINHEIT UND WERTEBEREICH WERDEN GEPRUEFT. Ein "Liegenschaftszinssatz"
 *    von 45 ist keiner, sondern eine falsch zugeordnete Spalte. In der
 *    Datenbank sieht beides gleich aus; auffallen wuerde es erst im
 *    Kundenbericht.
 *
 * Rueckgabe: { wert, ... } zum Rechnen ODER { einordnung } ODER null.
 */
async function opendataWert(typ, ags, art) {
  if (!OPENDATA_AN) return null;
  const kz = kennzahlFuerTyp(typ);
  if (!kz) return null;

  let r = null;
  try {
    r = await odRepo().hole(kz, ags, objektartFuerOd(art));
  } catch (e) {
    /* Tabelle fehlt, Migration nicht gelaufen, DB weg: die Wertermittlung
     * darf davon nicht mitgerissen werden. Wie beim Hauptzweig oben. */
    return null;
  }
  if (!r) return null;

  const quelle = r.quellenvermerk || r.gaa_name || r.gebiet_name
    || ('Open Data ' + String(r.land_code || '').toUpperCase());

  if (r.klassiert || r.wert_num == null) {
    const von = r.wert_min != null ? Number(r.wert_min) : null;
    const bis = r.wert_max != null ? Number(r.wert_max) : null;
    let text = r.wert_roh || null;
    if (!text) {
      if (von != null && bis != null) text = von + ' bis ' + bis;
      else if (von != null) text = von + ' und mehr';
      else if (bis != null) text = 'bis ' + bis;
    }
    return {
      einordnung: {
        kennzahl: kz, klasse: text, einheit: r.einheit || null,
        stufe: r.stufe, ebene: r.ebene, gebiet: r.gebiet_name || null,
        quelle, quelle_url: r.quelle_url || null,
        berichtsjahr: r.berichtsjahr || null,
        hinweis: 'Die Quelle veröffentlicht diesen Wert nur klassiert. '
          + 'Eine Klassenmitte wäre eine Erfindung — der Wert dient der '
          + 'Einordnung und geht nicht in die Rechnung ein.',
      },
    };
  }

  const wert = Number(r.wert_num);
  if (!einheitPasst(kz, r.einheit) || !wertPlausibel(kz, wert)) return null;

  return {
    wert,
    min: r.wert_min != null ? Number(r.wert_min) : null,
    max: r.wert_max != null ? Number(r.wert_max) : null,
    wert_min: r.wert_min != null ? Number(r.wert_min) : null,
    wert_max: r.wert_max != null ? Number(r.wert_max) : null,
    stufe: r.stufe,
    streuung_pct: null,
    herabgestuft: false,
    quelle,
    quelle_url: r.quelle_url || null,
    parameter_id: null,
    modellversion: MODELL.IMMOWERTV_2021,
    fallzahl: null,
    ebene: r.ebene || 'opendata',
    herkunft: 'opendata',
    hinweis: 'Wert aus einer offenen amtlichen Veröffentlichung ('
      + quelle + (r.berichtsjahr ? ', ' + r.berichtsjahr : '') + '), Ebene '
      + (r.ebene || '?') + '. Für diese Gemeinde liegt kein Wert des '
      + 'zuständigen Gutachterausschusses in der gepflegten Parametertabelle '
      + 'vor; der Modellvermerk der Quelle ist zu beachten (§ 10 ImmoWertV).',
  };
}

export const WertParameterService = {

  /**
   * Einen Parameter nach der Kaskade holen.
   *
   * @param {object} o
   * @param {string} o.typ         'lzs' | 'sachwertfaktor' | ...
   * @param {string} o.ags         amtlicher Gemeindeschluessel (Kreis, 5-stellig)
   * @param {string} o.objektart   Formularwert
   * @param {number} [o.anzahlWe]
   * @param {string} [o.stichtag]  ISO-Datum; Default heute
   * @param {number} [o.brwSqm]    fuer die § 256-Degression bei EFH
   * @returns {Promise<{wert:number,stufe:string,quelle:string,hinweis:string,
   *                    parameter_id:number|null,modellversion:string,fallzahl:number|null}>}
   */
  async hole({ typ, ags, objektart, anzahlWe = null, stichtag = null, brwSqm = null,
               objekt = null }) {
    const art = parameterObjektart(objektart, anzahlWe);
    const tag = stichtag || new Date().toISOString().slice(0, 10);

    /* ══ v1816 · DAS REGISTER ZUERST ════════════════════════════════════
     *
     * GEMESSEN am 03.10.2026 am laufenden Dienst: außerhalb von NRW rechnete
     * der Ertragswert mit dem gesetzlichen Auffangwert nach § 256 BewG —
     * obwohl im Register 1.205 amtliche Liegenschaftszinssätze mit
     * Quellenvermerk, Jahrgang und Lizenz lagen.
     *
     *     Dresden    Bericht 3,00 % Stufe D    Register 0,54 %    −2,46 PP
     *     Hannover   Bericht 3,00 % Stufe D    Register 0,90 %    −2,10 PP
     *     Leipzig    Bericht 3,00 % Stufe D    Register 2,10 %    −0,90 PP
     *
     * Der Weg dorthin fehlte: `GAA.liegenschaftszinssatz()` war gebaut,
     * verlangt aber einen ZWEIG — und den leitete niemand ab. Das macht
     * jetzt `zweigwahl.js` aus den Schlüsseln, die der Ausschuss selbst
     * führt (`efh_frei_rnd36_55` = freistehendes EFH, RND 36–55 Jahre).
     *
     * WARUM VOR DER TABELLE `wert_parameter`: das Register ist dieselbe
     * amtliche Quelle, nur objektscharf statt nach Objektart gemittelt.
     * GEGENGEPRÜFT, nicht gehofft — für NRW liefern beide Wege denselben
     * Wert:
     *
     *     Bielefeld  Tabelle 2,80 %    Register 2,80 %    Differenz 0,00
     *     Detmold    Tabelle 2,10 %    Register 2,10 %    Differenz 0,00
     *
     *   > Zwei unabhängige Quellen, dieselbe Zahl: erst das macht aus
     *   > einer Umstellung einen Beweis.
     *
     * UND DIE LÜCKE REDET. Fehlt eine Angabe, die der Ausschuss braucht
     * (Lage, Stadtteil, Restnutzungsdauer), fällt die Kaskade weiter wie
     * bisher — aber `rueckfrage` reist mit nach außen. Marcel am
     * 03.10.2026: „konnte nicht gemacht werden aus den und den Gründen und
     * dann kann man diese Sachen noch eingeben, damit dann so ein Zinssatz
     * abgerufen wird."
     *
     *   > Eine Lücke, die sagt was ihr fehlt, ist keine Lücke mehr,
     *   > sondern der nächste Schritt. */
    let _rueckfrage = null;
    /* ══ v2381 · GELTUNGSBEREICH VOR ZWEIG (§ 10 ImmoWertV) ══════════════
       Hueellhorst (ETW in einem Objekt mit hoechstens zwei Wohneinheiten)
       bekam den Zweig `we_v` des Kreises Minden-Luebbecke - derselbe
       Ausschuss nimmt solche Wohnungen aber aus seiner Eigentumswohnungs-
       Auswertung heraus. Dann gilt der Satz nicht: kein amtlicher Wert,
       kein Nachbarzweig - v2394: AUSSER dem ZFH-Zins desselben Ausschusses, siehe unten.
       Gerechnet wird mit dem gesetzlichen Auffangwert (Stufe D), als solcher
       gekennzeichnet. */
    if (typ === 'lzs' && ags && art === 'etw') {
      const _we = Number((objekt && objekt.einheiten) != null ? objekt.einheiten : anzahlWe);
      const _aus = etwKleinobjektAusgenommen(ags);
      if (_aus && Number.isFinite(_we) && _we > 0 && _we <= 2) {
        /* v2394 · Marcel 19.10.2026: „warum ist fuer Huellhorst nicht amtlich? wir
           haben doch alle Werte." Der Ausschuss nimmt Wohnungseigentum in Objekten
           mit hoechstens zwei WE aus SEINER ETW-Auswertung - wirtschaftlich ist das
           Objekt ein Zweifamilienhaus, und dafuer fuehrt derselbe Ausschuss einen
           amtlichen Zins. Den nehmen wir (Stufe A), mit Begruendung. Nur wenn es den
           nicht gibt, bleibt es beim Auffangwert. */
        try {
          const regZ = zinssatzFuerObjekt(
            { finde: regFinde, lagenFuer: regLagen, abruf: regZins },
            String(ags), { ...(objekt || {}), objart: 'zfh', einheiten: _we });
          if (regZ && regZ.verfuegbar) {
            return {
              wert: Number(regZ.wert_pct), min: null, max: null,
              stufe: regZ.stufe || 'A', stufe_roh: regZ.stufe || 'A',
              quelle: regZ.quellenvermerk || regZ.ausschuss || 'Gutachterausschuss',
              quelle_url: regZ.quelle_url || null, parameter_id: null,
              modellversion: MODELL.IMMOWERTV_2021, fallzahl: null, ebene: 'gaa',
              zweig: regZ.zweig, lage: regZ.lage || null,
              berichtsjahr: regZ.berichtsjahr || null, stichtag: regZ.stichtag || null,
              modellansaetze: regZ.modellansaetze || null,
              modell_gnd_jahre: regZ.modell_gnd_jahre ?? null,
              modell_bwk_quote: regZ.modell_bwk_quote || null,
              ausschuss: regZ.ausschuss || null, register_fallzahl: regZ.fallzahl ?? null,
              register_ebene: regZ.register_ebene || null, register_ags: regZ.register_ags || null,
              lizenz: regZ.lizenz || null, aus_register: true,
              hinweis: _aus + ' Die Wohnung liegt in einem Objekt mit ' + _we + ' Wohneinheiten und '
                + 'ist damit wirtschaftlich Teil eines Zweifamilienhauses; gerechnet wird mit dem '
                + 'amtlichen Liegenschaftszinssatz des Ausschusses für Zweifamilienhäuser (§ 10 ImmoWertV).',
            };
          }
        } catch (e) { /* weiter zum Auffangwert */ }
        const fb = lzsNach256(objektart, brwSqm, anzahlWe);
        return {
          wert: fb.pct, min: null, max: null, stufe: 'D',
          quelle: '§ 256 BewG', quelle_url: null, parameter_id: null,
          modellversion: MODELL.IMMOWERTV_2021, fallzahl: null, ebene: 'bund',
          hinweis: fb.hinweis, ausserhalb_geltung: true,
          rueckfrage: { grund: 'ausserhalb_geltung', fehlt: null, auswahl: [], zweig: null,
            hinweis: _aus + ' Der Liegenschaftszinssatz für Wohnungseigentum gilt für dieses '
              + 'Objekt deshalb nicht (§ 10 ImmoWertV); ein anderer Zweig wird nicht übertragen. '
              + 'Einen amtlichen Wert für diesen Fall kann nur der Ausschuss selbst nennen.' },
        };
      }
    }
    if (typ === 'lzs' && ags) {
      try {
        const reg = zinssatzFuerObjekt(
          { finde: regFinde, lagenFuer: regLagen, abruf: regZins },
          String(ags),
          { objart: objektart, einheiten: anzahlWe, ...(objekt || {}) });
        if (reg && reg.verfuegbar) {
          return {
            wert: Number(reg.wert_pct), min: null, max: null,
            stufe: reg.stufe || 'A', stufe_roh: reg.stufe || 'A',
            quelle: reg.quellenvermerk || reg.ausschuss || 'Gutachterausschuss',
            quelle_url: reg.quelle_url || null,
            parameter_id: null, modellversion: MODELL.IMMOWERTV_2021,
            fallzahl: null, ebene: 'gaa',
            zweig: reg.zweig, lage: reg.lage || null,
            berichtsjahr: reg.berichtsjahr || null,
            stichtag: reg.stichtag || null,
            modellansaetze: reg.modellansaetze || null,
            /* v2390 · die Modellansaetze DIESES Satzes als Zahl (§ 10 ImmoWertV):
               mit ihnen rechnet der Ertragswert, wenn er diesen Zins nutzt. */
            modell_gnd_jahre: reg.modell_gnd_jahre ?? null,
            modell_bwk_quote: reg.modell_bwk_quote || null,
            ausschuss: reg.ausschuss || null,
            register_fallzahl: reg.fallzahl ?? null,
            register_ebene: reg.register_ebene || null,
            register_ags: reg.register_ags || null,
            lizenz: reg.lizenz || null,
            hinweis: [reg.begruendung, reg.stufe_grund].filter(Boolean).join(' '),
            aus_register: true,
          };
        }
        if (reg && reg.rueckfrage && reg.rueckfrage !== 'kein_ausschuss'
            && reg.rueckfrage !== 'keine_art') {
          _rueckfrage = { grund: reg.rueckfrage, fehlt: reg.fehlt || null,
            auswahl: reg.auswahl || [], zweig: reg.zweig || null,
            hinweis: reg.hinweis || null };
        }
      } catch (e) {
        /* Das Register darf den Bericht nie kippen — aber der Ausfall
           bleibt sichtbar, statt als "kein Wert" durchzugehen. */
        _rueckfrage = { grund: 'register_fehler', fehlt: null, auswahl: [],
          hinweis: 'Das Register war nicht lesbar: ' + (e && e.message) };
      }
    }

    /* v1063-WOD-3 · Einmal fragen, vor der Kaskade. Der klassierte Satz ist
     * auch NEBEN einem amtlichen Wert eine Auskunft und haengt deshalb an
     * jedem Rueckgabeweg — nicht nur am Rueckfall. */
    const _od = await opendataWert(typ, ags, art);
    const _odRechen = (_od && _od.wert != null) ? _od : null;
    const _odEinordnung = (_od && _od.einordnung) ? _od.einordnung : null;

    /* ══ v2396 · ZWEI WAHRHEITEN: mb.wert_parameter GEGEN DAS REGISTER ════
       mb.wert_parameter fuehrt nur NW, 530 Zinssaetze, alle zum Stichtag
       31.12.2024 und ohne gueltig_bis — sie bestehen also jede Datumspruefung
       und kamen als Stufe A an, sobald der Registerweg keinen Wert lieferte
       (Rueckfrage, Sperre, Zweig fehlt). Das Register fuehrt fuer dieselben
       Kreise laengst den Jahrgang 2025 (Oberbergischer Kreis 05374, Coesfeld
       05513, Mettmann 05170008: lzs-swf-2026-nachernte.json).
       Regel: eine Zeile der Tabelle gilt nur, wenn das Register fuer diese
       AGS keinen NEUEREN Jahrgang fuehrt — auch nicht als Sperre (dann hat
       der Ausschuss neu veroeffentlicht, und der alte Wert ist nicht mehr
       der des Stichtags, § 10 ImmoWertV). Gilt sie, traegt sie ihren
       Jahrgang sichtbar. */
    let _regJahr = null;
    /* v2401 · Fuehrt das Register fuer diese AGS IRGENDEINEN Satz (Wert,
       Sperre, Rueckfrage)? Dann gibt es keine DealPilot-Formel (Stufe N):
       der Ausschuss hat sich zu diesem Ort geaeussert, und der Weg fuehrt
       zu ihm. null = Register nicht lesbar (dann auch keine Formel). */
    let _regSaetze = 0;
    if (typ === 'lzs' && ags) {
      try {
        const _rs = regFinde('liegenschaftszinssatz', String(ags)) || [];
        _regSaetze = _rs.length;
        for (const s of _rs) {
          const j = Number(s.berichtsjahr);
          if (Number.isFinite(j) && j > 0 && (_regJahr == null || j > _regJahr)) _regJahr = j;
        }
      } catch (e) { _regJahr = null; _regSaetze = null; }
    }
    const _jahrVon = (st) => {
      if (st == null) return null;
      if (st instanceof Date) return st.getFullYear();
      const m = /^(\d{4})/.exec(String(st));
      return m ? Number(m[1]) : null;
    };
    let _veraltet = null;

    /* ══ v2401 · STUFE N · DIE DEALPILOT-FORMEL ══════════════════════════
       Marcel 19.10.2026 freigegeben: zwischen allen amtlichen Ebenen und dem
       gesetzlichen Auffangwert - aber nur, wo sie GEMESSEN genauer ist als
       § 256 BewG (Leave-one-Land-out je Land, Ergebnis in lzs-naeherung.json),
       nur fuer Wohnnutzung und RND 5-80.
       NIE, wenn das Register fuer diese AGS einen Satz fuehrt - auch keinen
       gesperrten und keinen, der eine Rueckfrage ausloest: dann hat der
       Ausschuss sich zu diesem Ort geaeussert, und die Auskunft ist der Weg
       zu ihm (§ 256 mit Link), nicht eine Formel, die ihn ueberdeckt.
       Und nie, wo eine offene amtliche Veroeffentlichung oder der Nachbarwert
       desselben Ausschusses einen Wert hat (beides amtlich, beides ueber N).

       WO SIE GREIFT: mb.wert_parameter fuehrt den § 256-Auffangwert selbst als
       Zeile (Qualitaet D, Ebene bund, 00000) - GEMESSEN am 19.10.2026: Darmstadt
       EFH kam ueber diese Zeile als D an, bevor die Kaskade den Rueckfall unten
       erreichte. Deshalb wird N VOR jeder D-Zeile der Tabelle versucht, und
       noch einmal vor dem gerechneten Auffangwert. Alles andere bleibt in
       seiner bisherigen Reihenfolge. */
    let _formelNicht = null, _nVersucht = false;
    const _versucheN = async () => {
      _nVersucht = true;
      if (typ !== 'lzs') return null;
      if (_regSaetze == null) { _formelNicht = { grund: 'register_fehler' }; return null; }
      if (_regSaetze > 0 || _rueckfrage) {
        _formelNicht = { grund: 'register_fuehrt_satz',
          hinweis: 'Der zuständige Gutachterausschuss führt für diesen Ort einen eigenen '
            + 'Liegenschaftszinssatz (oder hat ihn gesperrt); er ließ sich diesem Objekt hier '
            + 'nicht zuordnen. Die DealPilot-Formel ersetzt ihn nicht — es bleibt beim '
            + 'gesetzlichen Auffangwert, bis der Satz des Ausschusses eingetragen ist.' };
        return null;
      }
      if (_odRechen) { _formelNicht = { grund: 'opendata_wert' }; return null; }
      if (NACHBARWERT_AN) {
        let nb = null;
        try { nb = await nachbarwert(a8(ags), art, tag); } catch (e) { nb = null; }
        if (nb) { _formelNicht = { grund: 'nachbarwert' }; return null; }
      }
      let fn = null;
      try {
        fn = lzsNaeherung({ ags, objektart, objart: (objekt && objekt.objart) || null,
          anzahlWe: (objekt && objekt.einheiten != null) ? objekt.einheiten : anzahlWe,
          rnd: objekt ? objekt.restnutzungsdauer : null });
      } catch (e) { fn = { verfuegbar: false, grund: 'formel_fehler', hinweis: e && e.message }; }
      if (fn && fn.verfuegbar) {
        return {
          wert: fn.pct, min: null, max: null, stufe: 'N', stufe_roh: 'N',
          quelle: 'DealPilot-Formel', quelle_url: null, parameter_id: null,
          modellversion: MODELL.IMMOWERTV_2021, fallzahl: null, ebene: 'dealpilot_formel',
          dealpilot_formel: true,
          formel: { ...fn.formel, familie: fn.familie, rnd: fn.rnd, rnd_quelle: fn.rnd_quelle,
                    stadt: fn.stadt, land: fn.land },
          hinweis: fn.hinweis,
          wert_parameter_uebergangen: _veraltet,
          einordnung: _odEinordnung,
          rueckfrage: null,
        };
      }
      _formelNicht = fn ? { grund: fn.grund, hinweis: fn.hinweis || null } : null;
      return null;
    };

    for (const { ags: a, ebene } of agsKette(ags)) {
      let rows = [];
      try {
        const r = await q(
          `SELECT id, wert, wert_min, wert_max, qualitaet, fallzahl, quelle_text,
                  quelle_url, modellversion, stichtag, ags_ebene
             FROM mb.wert_parameter
            WHERE typ = $1 AND ags = $2 AND ags_ebene = $3
              AND objektart IN ($4, 'alle')
              AND gueltig_von <= $5::date
              AND (gueltig_bis IS NULL OR gueltig_bis >= $5::date)
            ORDER BY (CASE qualitaet WHEN 'A' THEN 1 WHEN 'B' THEN 2
                                     WHEN 'C' THEN 3 ELSE 4 END),
                     gueltig_von DESC
            LIMIT 5`,
          [typ, a, ebene, art, tag]
        );
        rows = r || [];
      } catch (e) {
        // Tabelle noch nicht migriert o. DB-Problem: nicht die Wertermittlung
        // mitreissen, sondern auf den gesetzlichen Auffangwert fallen.
        rows = [];
      }

      for (const row of rows) {
        if (row.qualitaet === 'C' && Number(row.fallzahl || 0) < MIN_FALLZAHL_C) continue;
        /* v2401 · vor der § 256-Zeile der Tabelle: die DealPilot-Formel (N), wo sie gilt */
        if (typ === 'lzs' && String(row.qualitaet) === 'D' && !_nVersucht) {
          const _n = await _versucheN();
          if (_n) return _n;
        }
        const _rowJahr = _jahrVon(row.stichtag);
        if (_regJahr != null && _rowJahr != null && _regJahr > _rowJahr) {
          if (!_veraltet) _veraltet = { jahrgang: _rowJahr, register_jahrgang: _regJahr, ags: a };
          continue;   /* v2396 · das Register fuehrt einen neueren Jahrgang */
        }
        /* v1048-WSTR-2 · Ein amtlicher Mittelwert mit grosser Streuung ist
         * nicht objektscharf belastbar. Kreis Minden-Luebbecke, Eigentums-
         * wohnungen: 2,2 Prozent bei einer Standardabweichung von 1,1.
         * Das Modell der AGVGA.NRW weist selbst darauf hin, dass die
         * Mittelwerte betraechtliche Standardabweichungen aufweisen. */
        /* v1083b-WSTU-4 · DIE KETTE. Die Regel unterscheidet Wohnen und
         * Gewerbe — ohne diese eine durchgereichte Variable griffe sie nie,
         * und der ganze Umbau waere wirkungslos geblieben. Genau die Sorte
         * Zeile, die in v1075 fuer `ref.ags` gefehlt hat. */
        const _str = stufeNachStreuung({ wert: row.wert, wert_min: row.wert_min,
                                         wert_max: row.wert_max, qualitaet: row.qualitaet,
                                         objektart: art });
        return {
          wert: Number(row.wert),
          min: row.wert_min != null ? Number(row.wert_min) : null,
          max: row.wert_max != null ? Number(row.wert_max) : null,
          stufe: _str.qualitaet,
          stufe_roh: row.qualitaet,
          streuung_pct: _str.streuung_pct,
          /* v1083b-WSTU-5 · Absolute Streuung und Massstab mit nach aussen.
           * Ohne sie kann der Bericht nicht sagen, WORAN gemessen wurde —
           * und "zu unsicher" ohne Massstab ist keine Begruendung. */
          streuung_pp: _str.streuung_pp != null ? _str.streuung_pp : null,
          massstab: _str.massstab || null,
          herabgestuft: _str.herabgestuft,
          /* v1052-WSPN-1 · Gelesen wurden sie schon, zurueckgegeben nie.
           * Das PDF zeigte deshalb nur "Streuung ±50 % des Mittelwerts"
           * statt der eigentlichen Aussage "Spanne 1,1 bis 3,3 %". */
          wert_min: row.wert_min != null ? Number(row.wert_min) : null,
          wert_max: row.wert_max != null ? Number(row.wert_max) : null,
          quelle: row.quelle_text || null,
          quelle_url: row.quelle_url || null,
          parameter_id: Number(row.id),
          modellversion: row.modellversion || MODELL.IMMOWERTV_2021,
          fallzahl: row.fallzahl != null ? Number(row.fallzahl) : null,
          ebene,
          /* v2396 · der Jahrgang der Tabellenzeile, sichtbar */
          berichtsjahr: _rowJahr,
          jahrgang_hinweis: _rowJahr ? 'Jahrgang ' + _rowJahr + ' (Parametertabelle, Stichtag '
            + String(row.stichtag instanceof Date ? row.stichtag.toISOString() : row.stichtag).slice(0, 10) + ')' : null,
          hinweis: (_rowJahr ? 'Jahrgang ' + _rowJahr + '. ' : '')
                 + (_str.herabgestuft ? _str.hinweis
                                      : hinweisZurStufe(_str.qualitaet, ebene, row.fallzahl, row.quelle_text)),
          einordnung: _odEinordnung,   /* v1063-WOD-4 */
          rueckfrage: _rueckfrage,   /* v1816 */
          /* v2401 · warum es bei einer § 256-Zeile NICHT die DealPilot-Formel wurde */
          dealpilot_formel_nicht: String(row.qualitaet) === 'D' ? _formelNicht : undefined,
        };
      }
    }

    /* v1044-WNBW-1 · Nachbarwert aus DEMSELBEN Gutachterausschuss.
     *
     * Erst hier, nach der ganzen Kaskade: der Nachbarwert soll Paragraf 256
     * ersetzen, nicht einen amtlichen Wert. Stuende er weiter oben, wuerde
     * ein Stufe-C-Wert aus dem Nachbarort ein Stufe-A des eigenen Kreises
     * schlagen — das waere schlechter als der Zustand vorher.
     *
     * NIE ueber Ausschussgrenzen hinweg: die Ableitung gilt fuer den Markt,
     * den dieser Ausschuss beobachtet. Und nichts davon wird geschrieben —
     * sonst staenden bald 355 abgeleitete Zeilen neben 72 echten und
     * niemand koennte sie auseinanderhalten. */
    /* v1063-WOD-5 · DIE RANGFOLGE, und warum sie so ist.
     *
     * Ein amtlich veroeffentlichter Punktwert (Stufe A oder B) aus einer
     * offenen Quelle schlaegt den Nachbarwert: der Nachbarwert ist zwar
     * amtlich, aber fuer einen ANDEREN Ort ermittelt (Stufe C). Ein Wert
     * fuer diesen Ort ist besser als ein Wert fuer den Nachbarort.
     *
     * Ein Stufe-C-Satz aus Open Data schlaegt ihn NICHT: der Nachbarwert
     * stammt aus demselben Gutachterausschuss und damit aus demselben
     * beobachteten Markt. Eine bundesweite Ableitung tut das nicht.
     *
     * Beides schlaegt Paragraf 256. Genau dafuer ist die Ebene da: fuenfzehn
     * Bundeslaender fallen heute auf den gesetzlichen Auffangwert, und der
     * liegt nach unseren NRW-Zahlen durchweg zu hoch (3,0 gegen 2,2). */
    if (_odRechen && (_odRechen.stufe === 'A' || _odRechen.stufe === 'B')) {
      _odRechen.einordnung = _odEinordnung;
      _odRechen.rueckfrage = _rueckfrage;   /* v1816 */
      return _odRechen;
    }

    if (typ === 'lzs' && NACHBARWERT_AN) {
      let nb = await nachbarwert(a8(ags), art, tag);
      /* v2396 · auch der Nachbarwert stammt aus mb.wert_parameter (Jahrgang 2024) */
      if (nb && _regJahr != null && nb.berichtsjahr != null && _regJahr > nb.berichtsjahr) {
        if (!_veraltet) _veraltet = { jahrgang: nb.berichtsjahr, register_jahrgang: _regJahr, ags: nb.herkunft_ort };
        nb = null;
      }
      if (nb) { nb.einordnung = _odEinordnung; nb.rueckfrage = _rueckfrage; return nb; }
    }

    if (_odRechen) {
      _odRechen.einordnung = _odEinordnung;
      _odRechen.rueckfrage = _rueckfrage;   /* v1816 */
      return _odRechen;
    }

    /* v2401 · Stufe N - siehe _versucheN() oben. Hierher kommt die Kaskade nur,
       wenn mb.wert_parameter auch keine § 256-Zeile fuer diese Objektart fuehrt. */
    if (typ === 'lzs' && !_nVersucht) {
      const _n = await _versucheN();
      if (_n) return _n;
    }

    // Nichts in der Tabelle: gesetzlicher Auffangwert direkt rechnen.
    if (typ === 'lzs') {
      const fb = lzsNach256(objektart, brwSqm, anzahlWe);
      return {
        wert: fb.pct, min: null, max: null, stufe: 'D',
        quelle: '§ 256 BewG', quelle_url: null, parameter_id: null,
        modellversion: MODELL.IMMOWERTV_2021, fallzahl: null, ebene: 'bund',
        hinweis: fb.hinweis,
        /* v2401 · warum es NICHT die DealPilot-Formel (N) wurde */
        dealpilot_formel_nicht: _formelNicht,
        /* v2396 · eine aeltere Tabellenzeile wurde bewusst uebergangen */
        wert_parameter_uebergangen: _veraltet,
        einordnung: _odEinordnung,   /* v1063-WOD-6 */
        /* v1816 · WARUM es der Auffangwert wurde, obwohl das Register
           etwas fuehrt. Ohne diese Zeile sieht der Bericht aus, als gaebe
           es fuer diesen Ort keinen amtlichen Zinssatz. */
        rueckfrage: _rueckfrage,
      };
    }
    return null;
  },

  /**
   * Liegenschaftszinssatz mit Vorrang der Nutzereingabe (Stufe E).
   */
  async liegenschaftszins({ ags, objektart, anzahlWe, brwSqm, stichtag, nutzerwert = null,
                            objekt = null }) {
    const eigen = Number(nutzerwert);
    if (Number.isFinite(eigen) && eigen > 0) {
      return mitZinsHerkunft({
        wert: eigen, stufe: 'E', quelle: 'eigene Angabe', parameter_id: null,
        modellversion: MODELL.IMMOWERTV_2021, fallzahl: null, min: null, max: null,
        hinweis: 'Liegenschaftszinssatz manuell gesetzt. Für das Dossier bitte die Herkunft angeben (Grundstücksmarktbericht, Jahr).',
      });
    }
    /* v1099-WQL: Der Weg zur Quelle haengt an JEDER Antwort - auch an der
       leeren. Gerade dann ist er die einzige Auskunft, die wir geben.
       v2390: und jede Antwort sagt, auf welcher EBENE der Wert steht. */
    return mitZinsHerkunft(this.mitQuelle(
      /* v1816 · `objekt` traegt die Angaben, die der Gutachterausschuss zum
         Staffeln braucht: Haustyp (freistehend/DHH/Reihenhaus), Nutzung
         (vermietet ist der Standard — es ist ein Kapitalanlagerechner),
         Baujahr, Restnutzungsdauer, Lage, Stadtteil. Ohne sie kommt eine
         Rueckfrage statt eines Wertes, und das ist richtig so. */
      await this.hole({ typ: 'lzs', ags, objektart, anzahlWe, stichtag, brwSqm, objekt }),
      ags, 'liegenschaftszinssatz'));

  },
  /* ═══ v2390 · ENTFERNT: markableitung() und ableitungSpeichern() ═══════
     Hier stand die „Stufe C aus eigener Marktableitung": eine Bisektion des
     impliziten Zinses aus Marktpreisen und eine Funktion, die den Median als
     Stufe C in mb.wert_parameter SCHRIEB. Beide hatten keinen einzigen
     Aufrufer (grep ueber marktbericht/, tools/, frontend/ am 19.10.2026),
     und ableitungSpeichern() haette beim ersten Aufruf geworfen: sie rief
     `q1`, das in dieser Datei nie importiert war.

     Gefaehrlicher als der Absturz war die Beschriftung, die sie hinterliess:
     „Stufe C = aus eigener Marktableitung" stand im Bericht auch bei
     amtlichen Saetzen mit duenner Datenbasis und beim Nachbarwert desselben
     Ausschusses. Die Beschriftung kommt seit v2390 aus der Herkunft des
     Werts (zinsHerkunft unten), nicht aus dem Buchstaben.
     Wer die Ableitung zurueckholen will: git log -S ableitungSpeichern. */


  /** Sachwertfaktor — Stufe 2, hier nur vorbereitet. */
  async sachwertfaktor({ ags, objektart, anzahlWe, stichtag, nutzerwert = null }) {
    /* v1144-SWFART · Die Objektart-Sperre lag bisher NUR im Tabellenweg
     * (lib/sachwertfaktoren_nrw.js:134). Solange der Feldname-Fehler den
     * Faktor ohnehin verschluckte, fiel das nicht auf; mit dessen Behebung
     * wuerde ein selbst gepflegter Wert bei einer Eigentumswohnung
     * ploetzlich greifen — am Pruefobjekt waeren aus 268.172 EUR
     * 308.398 EUR geworden.
     *
     * Sachwertfaktoren werden nur fuer Ein- und Zweifamilien-, Doppel- und
     * Reihenhaeuser abgeleitet. Auf eine Wohnung angewandt ist das kein
     * "eigener Ansatz", sondern ein Modellbruch (§ 10 ImmoWertV) — und das
     * Sachwertverfahren ist bei der ETW ohnehin nicht das fuehrende.
     * Deshalb gilt die Sperre jetzt fuer BEIDE Wege, an einer Stelle.
     *
     * Der Wert wird nicht still geschluckt: `grund` und `hinweis` gehen
     * nach oben durch, damit die Anzeige sagen kann, warum nichts
     * passiert. */
    const art = String(objektart || '').toLowerCase();
    const nichtAbgeleitet = /etw|eigentumswohnung|wohnung|whg|mfh|mehrfamilien|gewerbe|buero/.test(art);

    const eigen = Number(nutzerwert);
    if (Number.isFinite(eigen) && eigen > 0) {
      if (nichtAbgeleitet) {
        return {
          wert: null, stufe: null, quelle: null, parameter_id: null,
          grund: 'objektart_nicht_abgeleitet',
          eigener_wert_verworfen: eigen,
          hinweis: 'Für diese Objektart werden keine Sachwertfaktoren abgeleitet '
            + '(nur Ein- und Zweifamilien-, Doppel- und Reihenhäuser, Abschnitt 5.1.4). '
            + 'Der eingetragene Wert ' + String(eigen).replace('.', ',')
            + ' bleibt deshalb unberücksichtigt; der Sachwert wird als vorläufiger '
            + 'Sachwert ohne Marktanpassung ausgewiesen.',
        };
      }
      return { wert: eigen, stufe: 'E', quelle: 'eigene Angabe', parameter_id: null, hinweis: '' };
    }
    return this.mitQuelle(
      await this.hole({ typ: 'sachwertfaktor', ags, objektart, anzahlWe, stichtag }),
      ags, 'sachwertfaktor');

  },

  /* ═══ v1099-WQL · WO DER KUNDE DEN WERT SELBST HOLT ═══════════════════
     Marcels Vorgabe vom 13.09.2026: „gib im Marktbericht bei den
     Liegenschaftszinsen und Sachwertfaktoren den Link an, wenn der Kunde
     die Adresse eingegeben hat. Dann kann er selber die Werte holen oder
     kaufen, wenn diese nicht umsonst zur Verfuegung stehen."

     Das ist das Gegenstueck zur Doktrin. Wir erfinden keine Zahl — also
     muessen wir umso genauer sagen koennen, wo die echte steht.

     DREI FAELLE, und alle drei bekommen den Link:
       1. kein Wert gefunden  -> der Link IST die Auskunft
       2. Wert gefunden       -> der Link belegt ihn und laesst nachpruefen
       3. Auffangwert (D)     -> der Link zeigt, wo der echte stuende

     Die Antwort wird dabei NICHT veraendert: `wert`, `stufe` und `grund`
     bleiben, wie sie sind. Es kommt nur etwas dazu. Ein Aufrufer, der
     `quelle_link` nicht kennt, merkt von dieser Aenderung nichts. */
  mitQuelle(antwort, ags, kennzahl) {
    let q = null;
    try { q = quelleFuer(ags); } catch { q = null; }
    if (!q) return antwort;

    const link = { ...q, satz: quellenSatz(q, kennzahl) };

    /* Auch wenn gar nichts kam, geht eine Auskunft nach oben. Vorher
       stand hier `null` — und der Bericht sagte „kein Wert hinterlegt",
       ohne zu sagen, wo einer steht. */
    if (!antwort) {
      return { wert: null, stufe: null, quelle: null, parameter_id: null,
               grund: 'kein_wert_hinterlegt', quelle_link: link };
    }
    return { ...antwort, quelle_link: link };
  },

  /** Abdeckungsuebersicht fuer das Admin — wie viele Kreise auf welcher Stufe. */

  async abdeckung(typ = 'lzs') {
    try {
      const r = await q(
        `SELECT qualitaet, ags_ebene, COUNT(DISTINCT ags)::int AS kreise
           FROM mb.wert_parameter
          WHERE typ = $1 AND (gueltig_bis IS NULL OR gueltig_bis >= CURRENT_DATE)
          GROUP BY qualitaet, ags_ebene
          ORDER BY qualitaet, ags_ebene`, [typ]);
      return r || [];
    } catch { return []; }
  },
};

/* ═══ v2390 · DIE HERKUNFT DES LIEGENSCHAFTSZINSSATZES, AN EINER STELLE ══
   Marcel am 19.10.2026: „Es gibt immer einen Wert, das bleibt so." Ein
   Ertragswert entfaellt nicht, nur weil kein oertlicher Zins vorliegt. ABER
   jede Ebene unterhalb des objektgenauen amtlichen Satzes (A) wird im
   Bericht deutlich ausgewiesen: WOHER der Wert kommt (in Klartext), DASS es
   genauer geht, und WIE (oertlichen Satz im Feld `lzs_pct` eintragen, mit
   Name und Link des zustaendigen Ausschusses). Ein Wert unter A heisst nie
   „amtlich" ohne Zusatz, und der Ertragswert damit ist „insoweit indikativ".

   Hier stand `STUFEN_ETIKETT` (A–E, ein Text je Buchstabe) - ohne einen
   einzigen Leser, aber mit einer zweiten, abweichenden Wahrheit: „C =
   marktabgeleitet". Stufe C ist in diesem Dienst fast nie eine
   Marktableitung, sondern ein amtlicher Satz mit duenner Datenbasis
   (Register, Dresden N = 4) oder der Nachbarwert desselben Ausschusses.
   Der Buchstabe sagt, WIE BELASTBAR - die Ebene sagt, WOHER. Gelesen wird
   jetzt die Herkunft, nicht der Buchstabe.

   Ebenen (`ebene`):
     amtlich             objektgenauer Satz des zustaendigen Ausschusses (A)
     amtlich_streuung    derselbe, amtlich, aber breit gestreut (B) - kein
                         Ebenenwechsel, deshalb nicht „unter A"
     landeswert          Satz auf Landesebene (Oberer GAA, Tabelle `land`)
     bundesdurchschnitt  Tabelle/Open Data auf Bundesebene
     regional            Tabelle auf Bezirksebene
     rueckfall           Satz des Ausschusses, nicht objektgenau zugeordnet
     amtlich_duenn       amtlich, geringe Datenbasis (Register-C, Tabelle-C)
     marktableitung      Tabellenzeile aus eigener Marktableitung (Altbestand)
     nachbarwert         Nachbarwert desselben Ausschusses
     uebertragen         offene Veroeffentlichung, Stufe C (uebertragen)
     dealpilot_formel    v2401 · DealPilot-Formel (N), aus allen amtlichen
                         Zinssaetzen abgeleitet, nie amtlich
     auffangwert         gesetzlicher Auffangwert § 256 BewG (D)
     eigene_angabe       vom Nutzer gesetzt (E) */
const _N = (n) => (n != null && Number.isFinite(Number(n)) && Number(n) > 0 ? ' (N = ' + Number(n) + ')' : '');
const _EBENE_TEXT = {
  amtlich: ['amtlich', 'amtlicher Liegenschaftszinssatz des zuständigen Gutachterausschusses'],
  amtlich_streuung: ['amtlich, große Streuung', 'amtlicher Satz des zuständigen Gutachterausschusses mit großer Streuung'],
  landeswert: ['Landeswert', 'Landeswert — für diesen Ort liegt kein Liegenschaftszinssatz des örtlichen Gutachterausschusses vor'],
  bundesdurchschnitt: ['Bundesdurchschnitt', 'Bundesdurchschnitt — kein Satz des örtlichen Gutachterausschusses'],
  regional: ['regionaler Wert', 'regionaler Wert — für den Kreis liegt kein eigener Satz vor'],
  rueckfall: ['Rückfallwert, nicht objektgenau', 'Satz des Gutachterausschusses, der sich diesem Objekt nicht genau zuordnen ließ'],
  amtlich_duenn: ['amtlich, geringe Datenbasis', 'amtlich veröffentlicht, aber aus wenigen Kauffällen abgeleitet'],
  marktableitung: ['aus eigener Marktableitung, nicht amtlich', 'aus dem regionalen Marktgeschehen zurückgerechnet, kein amtlicher Wert'],
  nachbarwert: ['Nachbarwert desselben Ausschusses', 'amtlicher Satz desselben Gutachterausschusses, aber für einen anderen Ort ermittelt'],
  uebertragen: ['übertragen, nicht örtlich', 'aus einer offenen Veröffentlichung übertragen, nicht für diesen Ort ermittelt'],
  dealpilot_formel: ['abgeleitet aus der DealPilot-Formel', 'DealPilot-Formel — aus den amtlichen Liegenschaftszinssätzen der Gutachterausschüsse abgeleitet, nicht amtlich und nicht für diesen Ort ermittelt'],
  auffangwert: ['gesetzlicher Auffangwert § 256 BewG', 'gesetzlicher Auffangwert nach § 256 BewG — nicht marktabgeleitet; er kann deutlich vom örtlichen Satz abweichen'],
  eigene_angabe: ['eigene Angabe', 'vom Nutzer gesetzt'],
};

export function zinsHerkunft(a) {
  if (!a || a.wert == null) return null;
  const st = String(a.stufe || '').toUpperCase();
  const eb = String(a.ebene || '').toLowerCase();
  const q = String(a.quelle || '');
  let ebene;
  if (st === 'E') ebene = 'eigene_angabe';
  else if (st === 'D') ebene = 'auffangwert';
  else if (st === 'N' || a.dealpilot_formel) ebene = 'dealpilot_formel';   /* v2401 */
  else if (a.nachbarwert) ebene = 'nachbarwert';
  else if (a.aus_register) {
    /* Ein Register-Satz auf Landesebene mit zweistelligem Schluessel ist ein
       Landeswert (Oberer GAA Brandenburg, Sachsen-Anhalt). Hamburg fuehrt
       `land` mit achtstelligem Schluessel - dort IST das Land der Ort. */
    const rAgs = String(a.register_ags || '').replace(/\D/g, '');
    if (String(a.register_ebene || '') === 'land' && rAgs.length > 0 && rAgs.length <= 2) ebene = 'landeswert';
    else if (st === 'C') ebene = 'amtlich_duenn';
    else if (st === 'B') ebene = 'amtlich_streuung';
    else ebene = 'amtlich';
  } else if (a.herkunft === 'opendata') {
    ebene = eb === 'bund' ? 'bundesdurchschnitt' : eb === 'land' ? 'landeswert'
      : st === 'C' ? 'uebertragen' : 'amtlich';
  } else {
    ebene = eb === 'bund' ? 'bundesdurchschnitt' : eb === 'land' ? 'landeswert'
      : eb === 'bezirk' ? 'regional'
      : st === 'C' ? (/marktableitung/i.test(q) ? 'marktableitung' : 'amtlich_duenn')
      : st === 'B' ? (a.herabgestuft ? 'amtlich_streuung' : 'regional')
      : 'amtlich';
  }
  /* Der Ausschuss fuehrt einen Satz, er gilt fuer dieses Objekt aber nicht
     objektgenau (Rueckfrage offen, Tabelle statt Register): nie „amtlich". */
  if ((ebene === 'amtlich' || ebene === 'amtlich_streuung') && a.rueckfrage && !a.aus_register) ebene = 'rueckfall';

  const unterA = ['landeswert', 'bundesdurchschnitt', 'regional', 'rueckfall', 'amtlich_duenn',
    'marktableitung', 'nachbarwert', 'uebertragen', 'dealpilot_formel', 'auffangwert'].indexOf(ebene) >= 0;
  const t = _EBENE_TEXT[ebene];
  const n = a.fallzahl != null ? a.fallzahl : a.register_fallzahl;
  let etikett = t[0];
  if (ebene === 'amtlich_duenn' || ebene === 'marktableitung') etikett += _N(n);
  /* v2401 · N nennt Datenbasis und typische Abweichung (aus lzs-naeherung.json) */
  let klartext = t[1];
  if (ebene === 'dealpilot_formel') {
    const f = a.formel || {};
    const d = lzsNaeherungsDaten() || {};
    const sz = f.saetze || (d.daten && d.daten.saetze) || null;
    /* v2593 · gemessene Abweichung im Einsatzfall (lzs-naeherung.json
       pruefung.loao_einsatz): Median und 8 von 10 - ohne Fachwort. */
    const _ein = (d.pruefung || {}).loao_einsatz || {};
    const ab = Number.isFinite(Number(f.abweichung_median_pp)) ? Number(f.abweichung_median_pp)
      : Number.isFinite(Number(_ein.median_pp)) ? Number(_ein.median_pp) : Number(((d.pruefung || {}).lolo || {}).median_pp);
    const ab80 = Number.isFinite(Number(f.abweichung_p80_pp)) ? Number(f.abweichung_p80_pp) : Number(_ein.p80_pp);
    const _k = (x) => (Math.round(x * 10) / 10).toFixed(1).replace('.', ',');
    etikett = 'abgeleitet aus der DealPilot-Formel (N)';
    klartext = 'DealPilot-Formel (N), aus ' + (sz || 'allen') + ' amtlichen Liegenschaftszinssätzen '
      + 'der Gutachterausschüsse abgeleitet' + (Number.isFinite(ab)
        ? '; an amtlichen Werten nachgeprüft in der Hälfte der Fälle höchstens ' + _k(ab) + ' Prozentpunkte daneben'
          + (Number.isFinite(ab80) ? ', in 8 von 10 Fällen höchstens ' + _k(ab80) : '') : '')
      + ' — nicht amtlich, nicht für diesen Ort ermittelt';
  }
  if (ebene === 'nachbarwert' && a.herkunft_ort) {
    etikett += ' (' + a.herkunft_ort + (Number(n) > 0 ? ', N = ' + Number(n) : '') + ')';
  }

  const ql = a.quelle_link || null;
  const stelle = (ql && ql.stelle) || a.ausschuss || null;
  const url = (ql && ql.url) || a.quelle_url || null;
  const weg = unterA ? {
    feld: 'lzs_pct',
    ausschuss: stelle,
    url,
    kosten: (ql && ql.satz && ql.satz.kosten) || null,
    text: 'Genauer geht es mit dem örtlichen Liegenschaftszinssatz des zuständigen '
      + 'Gutachterausschusses' + (stelle ? ' (' + stelle + ')' : '') + ': im Feld '
      + '„Liegenschaftszinssatz" eintragen, dann rechnet der Ertragswert damit.',
  } : null;
  return {
    ebene, etikett, klartext, unter_a: unterA,
    indikativ: unterA || ebene === 'eigene_angabe',
    ertragswert_hinweis: unterA
      ? (ebene === 'dealpilot_formel'
        ? 'Ertragswert insoweit indikativ: der Liegenschaftszinssatz ist aus der DealPilot-Formel '
          + 'abgeleitet (Stufe N), nicht der örtliche Satz des zuständigen Gutachterausschusses.'
        : 'Ertragswert insoweit indikativ: der Liegenschaftszinssatz ist ein ' + etikett
          + ', nicht der örtliche Satz des zuständigen Gutachterausschusses.')
      : null,
    weg,
  };
}

/* Haengt die Herkunft an die Antwort, ohne sie sonst zu veraendern. */
function mitZinsHerkunft(a) {
  if (!a || a.wert == null) return a;
  return { ...a, zins_herkunft: zinsHerkunft(a) };
}

function hinweisZurStufe(qualitaet, ebene, fallzahl, quelleText = null) {
  switch (qualitaet) {
    case 'A': return '';
    case 'B': return `Regionaler Wert (${ebene}) — für den konkreten Kreis liegt noch kein amtlicher Wert vor.`;
    /* v2390 · C in der Tabelle ist nur dann eine Marktableitung, wenn die
       Zeile es selbst sagt - sonst amtlich mit geringer Datenbasis. */
    case 'C': return /marktableitung/i.test(String(quelleText || ''))
      ? `Aus eigener Marktableitung abgeleitet${_N(fallzahl)}. Kein amtlicher Wert des Gutachterausschusses.`
      : `Amtlich veröffentlicht, aber aus geringer Datenbasis abgeleitet${_N(fallzahl)} — indikativ.`;
    case 'N': return 'Abgeleitet aus der DealPilot-Formel (Stufe N) — nicht amtlich. Genauer: den Liegenschaftszinssatz des zuständigen Gutachterausschusses eintragen.';
    case 'D': return 'Gesetzlicher Auffangwert nach § 256 BewG — nicht marktabgeleitet. Er kann deutlich vom örtlichen Liegenschaftszinssatz abweichen (gemessen 03.10.2026: Dresden 0,54 %, Hannover 0,90 % gegen 3,0 %).';
    default:  return '';
  }
}
