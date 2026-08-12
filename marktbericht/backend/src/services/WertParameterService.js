// WertParameterService.js — liest Wertermittlungsparameter aus mb.wert_parameter
// nach der Abdeckungs-Kaskade des Konzepts.
//
//   A  amtlich kreisscharf     aus dem Bericht des zustaendigen Gutachterausschusses
//   B  amtlich regional        aus dem Landesgrundstuecksmarktbericht
//   C  eigene Marktableitung   aus DealPilot-Objektdaten, N >= 10
//   D  gesetzlicher Auffangwert  § 256 BewG
//   E  Nutzereingabe           schlaegt immer alles (wird hier NICHT gelesen,
//                              sondern vom Aufrufer vorrangig gesetzt)
//
// Grundsatz: es wird IMMER ein Wert geliefert, aber nie ohne Stufe und Quelle.
// Eine Zahl ohne Herkunft ist im Dossier wertlos.

import { q } from '../lib/db.js';
import { lzsNach256, MODELL } from '../lib/immowertv.js';
import { stufeNachStreuung } from '../lib/nrw_modell.js';   /* v1048-WSTR-1 */
/* v1063-WOD-1 · Die Open-Data-Tabelle wurde in v1054 angelegt, gefuellt hat
 * sie nie jemand und gelesen hat sie niemand. Ab hier liest sie die Kaskade
 * — ueber das Repository, nicht mit eigenem SQL. */
import { machRepository } from '../connectors/opendata/param-repository.js';
import { kennzahlFuerTyp, objektartFuerOd, einheitPasst, wertPlausibel }
  from '../connectors/opendata/kennzahlen.js';

const RANG = { A: 1, B: 2, C: 3, D: 4 };
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
  if (/haus|villa/.test(k)) return 'efh';
  return 'mfh_bis6';
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
              p.quelle_url, p.modellversion, p.ags AS herkunft_ags,
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
  async hole({ typ, ags, objektart, anzahlWe = null, stichtag = null, brwSqm = null }) {
    const art = parameterObjektart(objektart, anzahlWe);
    const tag = stichtag || new Date().toISOString().slice(0, 10);

    /* v1063-WOD-3 · Einmal fragen, vor der Kaskade. Der klassierte Satz ist
     * auch NEBEN einem amtlichen Wert eine Auskunft und haengt deshalb an
     * jedem Rueckgabeweg — nicht nur am Rueckfall. */
    const _od = await opendataWert(typ, ags, art);
    const _odRechen = (_od && _od.wert != null) ? _od : null;
    const _odEinordnung = (_od && _od.einordnung) ? _od.einordnung : null;

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
          hinweis: _str.herabgestuft ? _str.hinweis
                                     : hinweisZurStufe(_str.qualitaet, ebene, row.fallzahl),
          einordnung: _odEinordnung,   /* v1063-WOD-4 */
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
      return _odRechen;
    }

    if (typ === 'lzs' && NACHBARWERT_AN) {
      const nb = await nachbarwert(a8(ags), art, tag);
      if (nb) { nb.einordnung = _odEinordnung; return nb; }
    }

    if (_odRechen) {
      _odRechen.einordnung = _odEinordnung;
      return _odRechen;
    }

    // Nichts in der Tabelle: gesetzlicher Auffangwert direkt rechnen.
    if (typ === 'lzs') {
      const fb = lzsNach256(objektart, brwSqm, anzahlWe);
      return {
        wert: fb.pct, min: null, max: null, stufe: 'D',
        quelle: '§ 256 BewG', quelle_url: null, parameter_id: null,
        modellversion: MODELL.IMMOWERTV_2021, fallzahl: null, ebene: 'bund',
        hinweis: fb.hinweis,
        einordnung: _odEinordnung,   /* v1063-WOD-6 */
      };
    }
    return null;
  },

  /**
   * Liegenschaftszinssatz mit Vorrang der Nutzereingabe (Stufe E).
   */
  async liegenschaftszins({ ags, objektart, anzahlWe, brwSqm, stichtag, nutzerwert = null }) {
    const eigen = Number(nutzerwert);
    if (Number.isFinite(eigen) && eigen > 0) {
      return {
        wert: eigen, stufe: 'E', quelle: 'eigene Angabe', parameter_id: null,
        modellversion: MODELL.IMMOWERTV_2021, fallzahl: null, min: null, max: null,
        hinweis: 'Liegenschaftszinssatz manuell gesetzt. Für das Dossier bitte die Herkunft angeben (Grundstücksmarktbericht, Jahr).',
      };
    }
    return this.hole({ typ: 'lzs', ags, objektart, anzahlWe, stichtag, brwSqm });
  },

  /* ═══════════════════════════════════════════════════════════════════════
   * STUFE C — marktabgeleiteter Liegenschaftszins.
   * ───────────────────────────────────────────────────────────────────────
   * Gesucht ist der Zinssatz, bei dem das Ertragswertverfahren den tatsaechlich
   * gezahlten Marktpreis trifft. Eindimensionale Nullstellensuche ueber die
   * Barwertformel — keine erfundenen Koeffizienten, jeder Schritt nachrechenbar.
   *
   * Ein Punktraster mit Zuschlaegen fuer Lage, Baujahr und Zustand waere die
   * Alternative gewesen. Dafuer muesste man die Koeffizienten erfinden; das
   * Ergebnis saehe aus wie eine Messung und waere eine Meinung mit
   * Nachkommastelle.
   *
   * ZIRKELSCHLUSS: aus dem eigenen Objekt zurueckgerechnet ist der Wert
   * wertlos — der Ertragswert traefe zwangslaeufig wieder den Marktwert.
   * Deshalb NUR aus dem regionalen Aggregat ANDERER Objekte, Median, N >= 10.
   *
   * Belegt am Coswig-Fall: Marktwert 312.000, Reinertrag 6.676, Bodenwert
   * 8.015, RND 80 -> impliziter Zins 1,5 %. Der gesetzliche Auffangwert nach
   * § 256 sagt 3,0 % — genau das Doppelte, und daher der Verfahrens-Spread.
   * ═══════════════════════════════════════════════════════════════════════ */
  markableitung({ marktwert, reinertrag, bodenwert = 0, rnd }) {
    const MW = Number(marktwert), RE = Number(reinertrag), BW = Number(bodenwert) || 0, N = Number(rnd);
    if (![MW, RE, N].every(Number.isFinite) || MW <= 0 || RE <= 0 || N <= 0) return null;

    const ertragswertBei = (p) => {
      const q = 1 + p / 100;
      const qn = Math.pow(q, N);
      const V = (qn - 1) / (qn * (q - 1));
      return (RE - BW * p / 100) * V + BW;
    };
    // Monoton fallend in p -> Bisektion ist sicher.
    if (ertragswertBei(0.2) < MW) return null;   // selbst bei 0,2 % zu niedrig
    if (ertragswertBei(12) > MW) return null;    // selbst bei 12 % zu hoch
    let lo = 0.2, hi = 12;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (ertragswertBei(m) > MW) lo = m; else hi = m;
    }
    const p = Math.round(((lo + hi) / 2) * 100) / 100;
    return (p >= 0.3 && p <= 9) ? p : null;   // Plausibilitaetsband
  },

  /**
   * Stufe C aus dem regionalen Aggregat bilden und ablegen.
   * Nur ab MIN_FALLZAHL_C, Median, ohne das anfragende Objekt.
   */
  async ableitungSpeichern({ ags, objektart, werte, ausschlussObjektId = null }) {
    const gueltig = (werte || []).filter((w) => Number.isFinite(w) && w >= 0.3 && w <= 9);
    if (gueltig.length < MIN_FALLZAHL_C) {
      return { angelegt: false, grund: `nur ${gueltig.length} Faelle, noetig sind ${MIN_FALLZAHL_C}` };
    }
    const sortiert = gueltig.slice().sort((a, b) => a - b);
    // Raender trimmen: ein Ausreisser darf keinen Kreis kippen.
    const trim = Math.floor(sortiert.length * 0.1);
    const kern = sortiert.slice(trim, sortiert.length - trim || undefined);
    const mid = Math.floor(kern.length / 2);
    const median = kern.length % 2 ? kern[mid] : (kern[mid - 1] + kern[mid]) / 2;

    const r = await q1(
      `INSERT INTO mb.wert_parameter
         (ags, ags_ebene, objektart, typ, wert, wert_min, wert_max, einheit, qualitaet,
          fallzahl, quelle_text, modellversion, gueltig_von)
       VALUES ($1,'kreis',$2,'lzs',$3,$4,$5,'prozent','C',$6,$7,'immowertv2021',CURRENT_DATE)
       ON CONFLICT DO NOTHING RETURNING id`,
      [String(ags).slice(0, 5), objektart, Math.round(median * 100) / 100,
       kern[0], kern[kern.length - 1], kern.length,
       `Marktableitung aus ${kern.length} Vergleichsfaellen (Median, Raender getrimmt) — indikativ, kein amtlicher Wert`]);
    return { angelegt: !!r, id: r ? r.id : null, wert: median, fallzahl: kern.length };
  },

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
    return this.hole({ typ: 'sachwertfaktor', ags, objektart, anzahlWe, stichtag });
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

/* Etikett fuer Bericht und PDF. Der Nutzer muss auf einen Blick sehen,
 * womit gerechnet wurde und wie weit er der Zahl trauen kann. */
export const STUFEN_ETIKETT = {
  A: { kurz: 'amtlich', lang: 'amtlicher Wert des zustaendigen Gutachterausschusses', indikativ: false },
  B: { kurz: 'amtlich, regional', lang: 'amtlicher Wert auf Landesebene — fuer den Kreis liegt keiner vor', indikativ: false },
  C: { kurz: 'indikativ, marktabgeleitet', lang: 'aus dem regionalen Marktgeschehen zurueckgerechnet, kein amtlicher Wert', indikativ: true },
  D: { kurz: 'indikativ, gesetzlicher Auffangwert', lang: 'gesetzlicher Auffangwert nach § 256 BewG — nicht marktabgeleitet, liegt in der Regel unter dem oertlichen Niveau', indikativ: true },
  E: { kurz: 'eigene Angabe', lang: 'vom Nutzer gesetzt', indikativ: true },
};

function hinweisZurStufe(qualitaet, ebene, fallzahl) {
  switch (qualitaet) {
    case 'A': return '';
    case 'B': return `Regionaler Wert (${ebene}) — für den konkreten Kreis liegt noch kein amtlicher Wert vor.`;
    case 'C': return `Aus eigener Marktableitung abgeleitet (N = ${fallzahl}). Kein amtlicher Wert des Gutachterausschusses.`;
    case 'D': return 'Gesetzlicher Auffangwert nach § 256 BewG — nicht marktabgeleitet. Er liegt in der Regel unter dem örtlichen Liegenschaftszinssatz und führt damit zu einem eher hohen Ertragswert.';
    default:  return '';
  }
}
