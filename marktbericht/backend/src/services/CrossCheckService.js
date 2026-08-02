// CrossCheckService.js — Sachwert- & Ertragswertverfahren als PLAUSIBILITÄTS-QUERCHECK
// zum Vergleichswert. Vereinfachte, transparente Umsetzung nach ImmoWertV-Logik
// (indikativ, KEIN Gutachten): alle Annahmen als Konstanten dokumentiert und im
// Output unter assumptions ausgewiesen. Reine Rechnung — keine API-Kosten.
import { round } from '../lib/stats.js';
/* WKERN-1 · Ertragswert wird nicht mehr hier gerechnet, sondern im gemeinsamen
 * Kern. Zwei Ertragswerte im selben Bericht waeren zwei Wahrheiten. */
import { ErtragswertService } from './ErtragswertService.js';
/* WNHK-4 */
import { sachwert as nhkSachwert, NHK_2010 } from '../lib/nhk2010.js';

// ---- Annahmen (dokumentiert, anpassbar) ----
const NHK_EFH_BGF = 835;          // NHK 2010, EFH Standardstufe 3, €/m² BGF
const BAUPREISINDEX = 2.02;       // Baupreisindex Wohngebäude 2010 -> 2026 (Destatis, gerundet)
const BGF_FAKTOR = 1.35;          // BGF ≈ Wohnfläche × 1,35 (EFH-Faustwert)
const GND_JAHRE = 80;             // Gesamtnutzungsdauer Wohngebäude
const RND_MIN = 10;               // Mindest-Restnutzungsdauer
const SACHWERTFAKTOR = 1.0;       // Marktanpassung (ohne lokale GAA-Daten neutral = 1,0)
const BWK_QUOTE = 0.23;           // Bewirtschaftungskosten inkl. Mietausfallwagnis, % v. Rohertrag
const LIEGENSCHAFTSZINS = 0.03;   // EFH-typisch 2,5–3,5 % -> 3,0 %
/* v955-etw: Der Zinssatz ist EFH-begruendet. Fuer Eigentumswohnungen liegen
 * Liegenschaftszinsen typischerweise HOEHER (3,5-5 %) — ein zu niedriger Zins
 * rechnet den Ertragswert nach OBEN. Der Hinweis steht im Output, damit niemand
 * die Zahl fuer eine Aussage haelt, die sie nicht ist. */

const _num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };

export const CrossCheckService = {
  // ref: Objektdaten; landValue: BORIS ({available, value_sqm}); rent: GeoMap-Mietstats;
  // valuation: Ergebnis des Vergleichswertverfahrens (fuer die Gegenueberstellung)
  compute(ref, landValue, rent, valuation, params) {   /* WKERN-3: params optional */
    const out = {
      available: false,
      sachwert: { available: false },
      ertragswert: { available: false },
      comparison: null,
      assumptions: {
        /* WSACH-2 · Die Fussnote nannte hart "Liegenschaftszins 3 %", auch wenn
         * tatsaechlich 4 % gerechnet wurden. Eine Annahme, die etwas anderes
         * behauptet als die Rechnung, ist schlimmer als keine. */
        nhk_efh_bgf_eur: NHK_EFH_BGF, baupreisindex_2010_heute: BAUPREISINDEX,
        bgf_faktor: BGF_FAKTOR, gnd_jahre: GND_JAHRE, sachwertfaktor: SACHWERTFAKTOR,
        liegenschaftszins_pct_effektiv: (params && params.lzs_pct != null)
          ? Number(params.lzs_pct) : LIEGENSCHAFTSZINS * 100,
        liegenschaftszins_stufe: (params && params.lzs_stufe) || null,
        bwk_quote: BWK_QUOTE, liegenschaftszins: LIEGENSCHAFTSZINS,
      },
      notes: ['Vereinfachtes Sachwert-/Ertragswertverfahren nach ImmoWertV-Logik als Plausibilitäts-Quercheck. Indikativ, kein Gutachten n. § 194 BauGB.'],
    };

    /* v955-etw: Die Objektart kam in dieser Datei bisher NICHT vor (grep = 0).
     * Gerechnet wurde alles als EFH — auch jede Eigentumswohnung. */
    const _pt = String(ref.property_type || '').toLowerCase().trim();
    const istWohnung = /etw|wohnung|whg|apartment|appartement/.test(_pt);
    const istHaus = /efh|dhh|\brh\b|reihen|zfh|mfh|haus|villa/.test(_pt);
    const wfl = _num(ref.living_area);
    const buildYear = _num(ref.build_year);
    const plot = _num(ref.plot_area);
    const brw = landValue && landValue.available ? _num(landValue.value_sqm) : null;
    const bodenwert = plot && brw ? Math.round(plot * brw) : null;
    const nowYear = new Date().getFullYear();

    // ---- Restnutzungsdauer (vereinfacht modifiziert) ----
    // Basis: GND - Alter. Modernisierung verlängert (teilmodernisiert +10 J., kern-/umfassend +20 J.),
    // gedeckelt auf GND-10; Minimum RND_MIN.
    let rnd = null;
    if (buildYear) {
      const alter = Math.max(0, nowYear - buildYear);
      rnd = GND_JAHRE - alter;
      const mod = String(ref.modernization || '').toLowerCase();
      const modYear = _num(ref.modernization_year);
      let bonus = 0;
      if (mod.includes('kern') || mod.includes('umfassend')) bonus = 20;
      else if (mod.includes('teil') || (modYear && nowYear - modYear <= 35)) bonus = 10;
      rnd = Math.min(GND_JAHRE - 10, Math.max(rnd + bonus, RND_MIN));
    }

    // ================= SACHWERT =================
    /* v955-etw
     * ────────────────────────────────────────────────────────────────────────
     * Bei einer Eigentumswohnung wird der Sachwert NICHT gerechnet, sondern
     * weggelassen. Die Konstanten oben sagen selbst, wofuer sie gelten:
     *     NHK_EFH_BGF = 835     "EFH Standardstufe 3"
     *     BGF_FAKTOR  = 1.35    "EFH-Faustwert"
     * Eine ETW hat keinen eigenen Dachstuhl und kein eigenes Fundament; ihr
     * Anteil an Treppenhaus und Keller steckt anders in der Flaeche. Mit der
     * EFH-Tabelle kaeme eine Zahl heraus, die aussieht wie eine zweite Meinung
     * und doch nur dieselbe Flaeche mit der falschen Tabelle ist.
     *
     * Ein falsch gerechneter Quercheck ist schlechter als keiner: er beruhigt.
     * Der Ertragswert bleibt — der rechnet aus Rohertrag und Liegenschaftszins
     * und gilt fuer eine ETW genauso.
     */
    /* WSACH-1 · Ohne Objekttyp wurde der Sachwert mit der EFH-Tabelle gerechnet
     * — im Test kam fuer eine Eigentumswohnung ein Sachwert von 100.000 EUR und
     * ein Verfahrens-Spread von 192 % heraus. Ein falsch gerechneter Quercheck
     * ist schlechter als keiner, das steht schon im Kommentar unten. */
    let _nhkFertig = false;
    /* WNHK-5 · Sobald die NHK-Tabelle steht, rechnet der richtige Sachwert.
     * Bis dahin bleibt der bisherige vereinfachte Weg fuer Haeuser. */
    if (NHK_2010.geprueft && ref.property_type && !istWohnung) {
      const _sw = nhkSachwert({
        nhk_typ: (p && p.nhk_typ) || ref.nhk_typ, keller_dg: (p && p.keller_dg) || ref.keller_dg,
        standardstufe: (p && p.standardstufe) || ref.standardstufe,
        bgf_direkt: (p && p.bgf_direkt) || ref.bgf, wohnflaeche_qm: wfl, objektart: ref.property_type,
        baupreisindex: BAUPREISINDEX, regionalfaktor: (p && p.regionalfaktor) || null,
        gnd_jahre: GND_JAHRE, rnd_jahre: rnd,
        bes_bauteile: (p && p.bes_bauteile) || null, aussenanlagen: (p && p.aussenanlagen) || null,
      }, (p && p.bodenwert) || null, (p && p.sachwertfaktor_param) || null);
      if (_sw.wert != null) {
        out.sachwert = {
          available: true, value_eur: _sw.wert, staffel: _sw.staffel,
          marktangepasst: _sw.marktangepasst, sachwertfaktor: _sw.sachwertfaktor || null,
          verfahren: _sw.verfahren,
        };
        _sw.warnungen.forEach((w) => { if (out.notes.indexOf(w) < 0) out.notes.push(w); });
        _sw.hinweise.forEach((h) => { if (out.notes.indexOf(h) < 0) out.notes.push(h); });
        /* v1028 · Kein vorzeitiges return: der Vergleichsblock unten setzt
         * out.comparison und den Spread. Frueher aussteigen hiesse, den
         * Sachwert zu haben und die Gegenueberstellung zu verlieren. */
        _nhkFertig = true;
      }
    }

    const _typUnbekannt = !ref.property_type;
    if (_nhkFertig) { /* WNHK-6: Sachwert steht bereits aus der NHK-Rechnung */ }
    else if (_typUnbekannt) {
      out.sachwert = { available: false,
        grund: 'Objekttyp nicht angegeben — ohne ihn ist die richtige NHK-Tabelle nicht bestimmbar.' };
      out.notes.push('Sachwert nicht ausgewiesen: Der Objekttyp fehlt. Bitte im Formular ergänzen.');
    } else if (istWohnung) {
      out.sachwert = {
        available: false,
        grund: /* WSACH-4 */ 'Sachwert bei Wohnungseigentum nicht ausgewiesen: unsere NHK-Tabelle ist für Ein- und Zweifamilienhäuser hinterlegt. Rechenbar wäre er über den Sachwert des gesamten Gebäudes mal Miteigentumsanteil — dafür fehlt die Bruttogrundfläche des Gebäudes. Beim Wohnungseigentum führt ohnehin das Vergleichswertverfahren.',
      };
      out.notes.push('Sachwert nicht ausgewiesen: Das vereinfachte Sachwertverfahren arbeitet mit den Normalherstellungskosten für Einfamilienhäuser (NHK 2010, Standardstufe 3) und dem EFH-Faustwert BGF ≈ Wohnfläche × 1,35. Für eine Eigentumswohnung ist das die falsche Grundlage – lieber keine Zahl als eine falsche. Der Ertragswert-Quercheck bleibt.');
    } else if (wfl && buildYear) {
      const bgf = wfl * BGF_FAKTOR;
      const hkNeubau = bgf * NHK_EFH_BGF * BAUPREISINDEX;
      const alterswertfaktor = rnd != null ? rnd / GND_JAHRE : null;
      const gebaeudeSachwert = alterswertfaktor != null ? hkNeubau * alterswertfaktor : null;
      if (gebaeudeSachwert != null) {
        const vorl = (bodenwert || 0) + gebaeudeSachwert;
        const sachwert = Math.round(vorl * SACHWERTFAKTOR / 1000) * 1000;
        out.sachwert = {
          available: true,
          bodenwert_eur: bodenwert,                       // null wenn Grundstueck/BRW fehlt
          bgf_sqm: Math.round(bgf),
          herstellungskosten_neubau_eur: Math.round(hkNeubau),
          alter_jahre: nowYear - buildYear,
          restnutzungsdauer_jahre: rnd,
          alterswertminderung_faktor: round(alterswertfaktor, 3),
          gebaeude_sachwert_eur: Math.round(gebaeudeSachwert),
          sachwertfaktor: SACHWERTFAKTOR,
          value_eur: sachwert,
          bodenwert_fehlt: bodenwert == null,
        };
        if (bodenwert == null) out.notes.push('Sachwert OHNE Bodenwert (Grundstücksfläche oder Bodenrichtwert fehlt) – nur Gebäudesachwert ausgewiesen.');
        /* v955-etw: SACHWERTFAKTOR = 1.0 heisst "keine Marktanpassung", nicht
         * "Marktanpassung ergibt 1,0". Real liegt er je nach Lage bei 0,8-1,3.
         * Wer das nicht weiss, liest den Sachwert als Verkehrswert. */
        out.notes.push('Sachwertfaktor 1,0 angesetzt: Ohne Daten des örtlichen Gutachterausschusses erfolgt KEINE Marktanpassung. Reale Sachwertfaktoren liegen je nach Lage zwischen 0,8 und 1,3 – der ausgewiesene Sachwert ist deshalb unangepasst und weicht systematisch vom Verkehrswert ab.');
        if (!istHaus && !istWohnung) out.notes.push('Objektart nicht eindeutig – Sachwert mit EFH-Ansatz gerechnet. Bei Nicht-Wohnnutzung ist er nicht belastbar.');
      }
    }

    /* WKERN-2 · ERTRAGSWERT ueber den gemeinsamen Kern.
     * Die Formel ist dieselbe. Neu ist, woher die Parameter kommen: Liegenschafts-
     * zins und Bewirtschaftungskosten waren hier fest verdrahtet (3,0 % und
     * pauschal 23 %). Jetzt setzt der Aufrufer sie ueber `params`; fehlt etwas,
     * greifen dieselben Pauschalen wie bisher. Ein Kern, zwei Genauigkeitsgrade.
     */
    const rentSqm = rent && _num(rent.median_per_sqm);
    const p = params || {};
    if (wfl && rentSqm && rnd != null) {
      const rohertrag = Math.round(rentSqm * wfl * 12);
      const lzsPct = _num(p.lzs_pct) != null ? Number(p.lzs_pct) : LIEGENSCHAFTSZINS * 100;
      const bwErgebnis = (p.bodenwert && p.bodenwert.vollstaendig)
        ? p.bodenwert
        : { vollstaendig: bodenwert != null, wert: bodenwert,
            quelle: { brw_sqm: brw, herkunft: brw ? 'boris' : 'manuell' } };

      const ein = {
        objektart: ref.property_type, baujahr: buildYear, baustatus: ref.baustatus || 'bestand',
        wohnflaeche_qm: wfl, anzahl_we: _num(ref.units) || 1, stichtag_jahr: nowYear,
        miete_markt_jahr: rohertrag,
        stellplatz_anz: _num(ref.garages), stellplatz_miete_monat: _num(p.stellplatz_miete_monat),
        rnd_jahre: rnd,
        lzs_pct: lzsPct, lzs_quelle: p.lzs_quelle || 'pauschal', lzs_stufe: p.lzs_stufe || null,
        bog_eur: _num(p.bog_eur), bog_grund: p.bog_grund || null,
      };
      if (p.bwk_modus !== 'normiert') {
        ein.bwk_modus = 'manuell';
        ein.bwk_gesamt_jahr = Math.round(rohertrag * BWK_QUOTE);
      } else {
        ein.bwk_modus = 'normiert';
        ein.bwk_verwaltung_je_we = _num(p.bwk_verwaltung_je_we);
        ein.bwk_instandhaltung_je_qm = _num(p.bwk_instandhaltung_je_qm);
        ein.bwk_mietausfall_pct = _num(p.bwk_mietausfall_pct);
        ein.bwk_betrieb_nul_jahr = _num(p.bwk_betrieb_nul_jahr);
      }

      const kern = ErtragswertService.ertragswert(ein, bwErgebnis);
      out.ertragswert_kern = kern;

      if (kern.vollstaendig && kern.wert != null) {
        const hol = (t) => { const r = kern.staffel.find((s) => s.pos.indexOf(t) >= 0); return r ? r.wert : null; };
        out.ertragswert = {
          available: true,
          rohertrag_pa_eur: hol('= Rohertrag'),
          bwk_pa_eur: Math.abs(hol('Bewirtschaftungskosten') || 0),
          reinertrag_pa_eur: hol('= Reinertrag'),
          liegenschaftszins_pct: kern.lzs ? kern.lzs.pct : lzsPct,
          liegenschaftszins_stufe: kern.lzs ? kern.lzs.stufe : null,
          liegenschaftszins_quelle: kern.lzs ? kern.lzs.quelle : null,
          restnutzungsdauer_jahre: kern.nutzungsdauer ? kern.nutzungsdauer.rnd : rnd,
          vervielfaeltiger: kern.barwertfaktor,
          bodenwert_eur: bwErgebnis.vollstaendig ? bwErgebnis.wert : null,
          value_eur: kern.wert,
          bodenwert_fehlt: !bwErgebnis.vollstaendig,
          staffel: kern.staffel,
          belastbarkeit: kern.belastbarkeit,
          sensitivitaet: kern.sensitivitaet,
          verfahren: kern.verfahren,
          modellversion: kern.modellversion,
        };
        kern.warnungen.forEach((w) => { if (out.notes.indexOf(w) < 0) out.notes.push(w); });
        kern.hinweise.forEach((h) => { if (out.notes.indexOf(h) < 0) out.notes.push(h); });
      } else {
        out.ertragswert = { available: false, grund: (kern.warnungen[0] || 'Ertragswert nicht berechenbar.') };
      }
    }

    // ================= VERGLEICH =================
    const vgl = valuation && valuation.market_value ? valuation.market_value.estimated : null;
    if (out.sachwert.available || out.ertragswert.available) {
      out.available = true;
      const vals = [
        ['vergleichswert', vgl],
        ['sachwert', out.sachwert.available ? out.sachwert.value_eur : null],
        ['ertragswert', out.ertragswert.available ? out.ertragswert.value_eur : null],
      ].filter(([, v]) => v != null);
      const nums = vals.map(([, v]) => v);
      out.comparison = {
        vergleichswert_eur: vgl,
        sachwert_eur: out.sachwert.available ? out.sachwert.value_eur : null,
        ertragswert_eur: out.ertragswert.available ? out.ertragswert.value_eur : null,
        min_eur: nums.length ? Math.min(...nums) : null,
        max_eur: nums.length ? Math.max(...nums) : null,
        spread_pct: nums.length >= 2 && Math.min(...nums) > 0
          ? round((Math.max(...nums) / Math.min(...nums) - 1) * 100, 1) : null,
      };
    }
    return out;
  },
};
