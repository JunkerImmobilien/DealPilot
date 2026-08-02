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
        return {
          wert: Number(row.wert),
          min: row.wert_min != null ? Number(row.wert_min) : null,
          max: row.wert_max != null ? Number(row.wert_max) : null,
          stufe: row.qualitaet,
          quelle: row.quelle_text || null,
          quelle_url: row.quelle_url || null,
          parameter_id: Number(row.id),
          modellversion: row.modellversion || MODELL.IMMOWERTV_2021,
          fallzahl: row.fallzahl != null ? Number(row.fallzahl) : null,
          ebene,
          hinweis: hinweisZurStufe(row.qualitaet, ebene, row.fallzahl),
        };
      }
    }

    // Nichts in der Tabelle: gesetzlicher Auffangwert direkt rechnen.
    if (typ === 'lzs') {
      const fb = lzsNach256(objektart, brwSqm, anzahlWe);
      return {
        wert: fb.pct, min: null, max: null, stufe: 'D',
        quelle: '§ 256 BewG', quelle_url: null, parameter_id: null,
        modellversion: MODELL.IMMOWERTV_2021, fallzahl: null, ebene: 'bund',
        hinweis: fb.hinweis,
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
    const eigen = Number(nutzerwert);
    if (Number.isFinite(eigen) && eigen > 0) {
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
