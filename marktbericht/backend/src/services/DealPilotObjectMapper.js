// DealPilotObjectMapper.js
// Uebersetzt ein DealPilot-Objekt (.dpkt: flach ODER { data: {...} }) in
//   - reportInput: Felder fuer ReportOrchestrator.generate (Adresse, Flaeche, Preise, brw)
//   - assessment:  die DS2-Lage-/Potenzialbewertungen (Mikro/Makro/Bevoelkerung/Nachfrage/
//                  Entwicklung/Wertsteigerung/Mietausfall + Marktmiete/Marktfaktor)
//   - dealpilot:   vorhandener DealScore + (geparste) KI-Investmentanalyse
// So fliessen die in DealPilot bereits erfassten Einschaetzungen direkt in den Bericht.
import { gewerbeArt } from '../lib/marktsegment.js';   /* v2241 */

function dataOf(obj) {
  if (obj && typeof obj === 'object' && obj.data && typeof obj.data === 'object') return obj.data;
  return obj || {};
}
function pick(d, keys) {
  for (const k of keys) if (d[k] != null && d[k] !== '') return d[k];
  return null;
}
/* ══ v1962 · DER PUNKT IST NICHT IMMER EIN TAUSENDERTRENNER ═══════════

   Hier stand:

     parseFloat(String(v).replace(/\./g, '').replace(',', '.') ...)

   Der Punkt wurde IMMER geloescht. Richtig fuer "1.234,56" - zerstoerend
   fuer jeden Wert, der mit Dezimalpunkt gespeichert ist:

     "64.58"  ->  6458     Faktor 100    Garagen-BGF
     "3.5"    ->    35     Faktor 10     Zinssatz 3,5 % wurde zu 35 %
     "0.5"    ->     5     Faktor 10     Grundbuchamt

   GEFUNDEN am 07.10.2026 beim Ausloesen einer Stufe-3-Wertermittlung:
   eine 100-m2-Eigentumswohnung ergab einen Sachwert von 1.717.808 EUR,
   das 8,6-fache des Vergleichswerts. Die Spur fuehrte ueber
   garage.bgf_qm = 6458 zum Objektfeld garagen_bgf_qm = "64.58".

   > WARUM ES SO LANGE UNENTDECKT BLIEB: ganze Zahlen gehen heil durch,
   > und Werte mit KOMMA auch. Nur die Punkt-Schreibweise kippt - und die
   > entsteht, wenn ein Wert einmal durch JavaScript gelaufen ist
   > (String(64.58) ergibt "64.58"). Der Fehler traf also genau die
   > Werte, die die App selbst gerechnet hat, nicht die eingetippten.

   DIE REGEL, nach der jetzt entschieden wird:

     1. Steht ein KOMMA drin, ist es deutsche Schreibweise:
        Punkte sind Tausendertrenner, das Komma ist das Dezimalzeichen.
     2. Sonst: sieht die Zahl aus wie eine Tausendergruppierung
        (1.234 / 1.234.567 - nach jedem Punkt GENAU drei Ziffern),
        werden die Punkte entfernt.
     3. Sonst ist der Punkt das Dezimalzeichen und bleibt stehen.

   > Regel 2 bleibt eine ENTSCHEIDUNG, keine Messung: "1.234" ist fuer
   > sich mehrdeutig. Fuer die Felder hier (Kaufpreis, Flaeche, BGF) ist
   > die Tausenderlesart die richtige, und ein JavaScript-Wert sieht nie
   > so aus - String(1.234) ergibt "1.234" nur bei genau diesem Wert,
   > waehrend eine getippte Zahl mit Nachkommastellen in Deutschland ein
   > Komma traegt. Wer das aendert, aendert es bewusst.

   Dieselbe Regel steht schon richtig in
   connectors/opendata/klassen.js und profile/be-lzs.js - sie war nur
   nie hierher uebernommen worden.
   ══════════════════════════════════════════════════════════════════ */
function num(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  let t = String(v).trim().replace(/[^\d.,-]/g, '');
  if (t === '') return null;
  if (t.indexOf(',') >= 0) {
    /* Deutsche Schreibweise: Punkte raus, Komma wird zum Punkt. */
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) {
    /* Reine Tausendergruppierung: 1.234 / 1.234.567 */
    t = t.replace(/\./g, '');
  }
  /* Sonst bleibt der Punkt das Dezimalzeichen. */
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}
/* ── v1839 · FÜNF VON ELF OBJEKTARTEN FIELEN DURCH ───────────────────────
 *
 * GEMESSEN am 04.10.2026 an Marcels Objekt Hauptstr. 51, 49477 Ibbenbüren
 * (Objektart GESCH): der Marktbericht meldete „Objekttyp nicht angegeben
 * — bitte im Formular ergänzen". Er WAR angegeben. Dieser Mapper kannte
 * ihn nur nicht und gab `null` zurück.
 *
 * Die App führt elf Objektarten (frontend-konstanten.json): ETW, EFH,
 * ZFH, DHH, RH, MFH, BUERO, GESCH, HOTEL, GEW, GAR. Abgedeckt waren
 * sechs — die fünf gewerblichen nicht.
 *
 *   > Eine Meldung, die „fehlt" sagt, wo „kenne ich nicht" richtig wäre,
 *   > schickt den Nutzer zurück ins Formular, in dem alles steht. Er
 *   > trägt dann ein, was schon da ist, und es ändert sich nichts.
 *
 * GEWERBE WIRD NICHT ALS WOHNEN GERECHNET. Die NHK-Tabellen der Anlage 4
 * ImmoWertV, die dieser Dienst führt, sind die wohnwirtschaftlichen;
 * ein Geschäftshaus darüber zu bewerten wäre schlimmer als gar nicht.
 * Deshalb reist die Art jetzt als `gewerbe` mit — der Bericht kann dann
 * sagen, WARUM er nicht rechnet, statt eine falsche Lücke zu melden.
 *
 * Garagen sind ein eigener Fall: sie sind kein Bewertungsobjekt für
 * diesen Bericht, sondern Zubehör.
 */
/* ── v2241 · DIE REIHENFOLGE ENTSCHIED UEBER DIE OBJEKTART ───────────────
 *
 * `haus` stand VOR `gewerbe`. Jede Bezeichnung, die auf -haus endet, war
 * damit ein Wohnhaus: „Bürohaus", „Geschäftshaus", „Ärztehaus" — und über
 * das `rh` im Muster sogar „Lagerhalle" (lage-RH-alle). Gemessen am
 * 15.10.2026: ein Bürohaus mit 500 m² bekam die Wohn-NHK und einen
 * Sachwert von 727.000 €.
 *
 * Jetzt: Wohnung und MFH zuerst (ein „Wohn- und Geschäftshaus" ist ein
 * MFH mit Gewerbeeinheiten — v2210 trennt dort Wohnen und Gewerbe),
 * dann Gewerbe, dann Haus. Die Gewerbeart reist getrennt mit
 * (`gewerbeArtAus`), damit der Bericht Buero nicht wie Halle misst.
 */
function mapPropertyType(raw) {
  const s = String(raw || '').toLowerCase();
  if (/etw|wohnung|eigentumswohnung/.test(s)) return 'wohnung';
  if (/mfh|mehrfamilien|wohn.*gesch(ae|ä)?ft|^wgh$/.test(s)) return 'mfh';
  if (/^grst$|grundst(ue|ü)ck|bauland|unbebaut/.test(s)) return 'grundstueck';   /* v2241 */
  if (/^gar$|garage|stellplatz/.test(s)) return 'garage';
  if (/buero|büro|gesch|hotel|gew|laden|handel|praxis|gastro|halle|lager|industrie/.test(s)) return 'gewerbe';
  if (/efh|dhh|rh|zfh|haus|einfamilien|doppelhaus|reihenhaus/.test(s)) return 'haus';
  return null;
}
function gewerbeArtAus(raw) {
  return mapPropertyType(raw) === 'gewerbe' ? gewerbeArt(raw) : null;
}

/* ── v2241 · SANIERUNGSKOSTEN ALS BESONDERES OBJEKTSPEZIFISCHES MERKMAL ──
 *
 * `san` (Reiter Investition, „Sanierungskosten") kam im Marktbericht nie
 * an. Der Zustand wirkte nur im Vergleichswert, und dort gedeckelt
 * (Objektzuschlag ≥ 0,82) — ein Haus mit 60.000 € Instandsetzungsbedarf
 * stand im Sach- und Ertragswert wie ein gepflegtes.
 *
 * § 8 Abs. 3 ImmoWertV: ein Bauschaden oder Instandsetzungsstau ist ein
 * besonderes objektspezifisches Grundstücksmerkmal und wird NACH der
 * Marktanpassung berücksichtigt. Das Feldpaar dafür gibt es seit v1338
 * (`bom_eur`/`bom_grund`, beide Verfahren) — es hatte auf dem
 * Objektweg nur keinen Lieferanten.
 *
 * Eine ausdrückliche bOM-Angabe gewinnt; `san` füllt nur, was leer ist.
 * Angesetzt wird der Betrag, wie er im Objekt steht (brutto oder netto,
 * das steht im Grund). Kosten sind nicht zwingend gleich der
 * Wertminderung — der Grund sagt deshalb, dass es eine Kostenangabe ist. */
function bomAus(d) {
  const eigen = Number.isFinite(Number(d.bom_eur)) && d.bom_eur !== '' && d.bom_eur != null
    ? Number(d.bom_eur) : null;
  if (eigen != null) {
    return { bom_eur: eigen, bom_grund: pick(d, ['bom_grund']) || null, bom_quelle: 'eigene_angabe' };
  }
  const san = num(pick(d, ['san', 'sanierungskosten']));
  if (!(san > 0)) return { bom_eur: null, bom_grund: null, bom_quelle: null };
  const ust = String(pick(d, ['san_ust']) || '').toLowerCase();
  const art = ust === 'netto' ? 'netto' : (ust === 'brutto' ? 'brutto' : null);
  return {
    bom_eur: -Math.round(san),
    bom_grund: 'Sanierungs-/Instandsetzungskosten laut Objekt'
      + (art ? ' (' + art + ')' : '')
      + ' — Kostenansatz, kein sachverständig ermittelter Wertabschlag',
    bom_quelle: 'sanierungskosten',
  };
}
function buildAddress(d) {
  const str = pick(d, ['str', 'strasse', 'straße']);
  const hnr = pick(d, ['hnr', 'hausnummer']);
  const plz = pick(d, ['plz']);
  const ort = pick(d, ['ort', 'stadt']);
  const line1 = [str, hnr].filter(Boolean).join(' ');
  const line2 = [plz, ort].filter(Boolean).join(' ');
  const full = [line1, line2].filter(Boolean).join(', ');
  return full || null;
}
function vacancyFrom(d) {
  const v = String(pick(d, ['vermstand', 'vermietungsstand']) || '').toLowerCase();
  if (/leer|unvermietet/.test(v)) return true;
  if (/vermietet/.test(v)) return false;
  return false;
}

/* v1851 · DEZIMALFELDER LESEN KEINEN TAUSENDERPUNKT. Gemessen am ersten
   Bericht nach dem Umbau: lzs_pct „2.56" kam als 256 an — num() nimmt den
   Punkt als Tausenderpunkt (richtig fuer „200.000", falsch fuer einen
   Prozentsatz). Dasselbe traf sachwertfaktor („1.15" → 115) und, schon
   vor v1851, mea („7.06" → 706). Prozent, Faktoren und Quadratmeterpreise
   haben keine Tausender — sie lesen Punkt UND Komma als Dezimaltrenner. */
function dez(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s|%|€/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/* v1851 · Eine Ausstattungsskala. Marcels Entscheidung vom 04.10.2026: die
   Standardstufe 1–5 (Anlage 4 ImmoWertV) ist die eine Skala; `ausst`
   (einfach/normal/gehoben/luxus) fällt. Damit die erweiterte
   Marktpreisindikation (Stufe 2, QUALITY_FACTOR in ValuationService) weiter
   greift, wird umgeschlüsselt — in BEIDE Richtungen, damit Altobjekte, die
   nur `ausst` tragen, nichts verlieren. */
const AUSST_ZU_STUFE = { einfach: 2, normal: 3, gehoben: 4, luxus: 5, 'luxuriös': 5, luxurioes: 5 };
const STUFE_ZU_QUALITY = { 1: 'einfach', 2: 'einfach', 3: 'normal', 4: 'gehoben', 5: 'luxus' };
const GEWERKE = { aussenwaende: 'ausst_aussenwaende', dach: 'ausst_dach', fenster_tueren: 'ausst_fenster',
                  innenwaende: 'ausst_innenwaende', decken_treppen: 'ausst_decken', fussboeden: 'ausst_fussboeden',
                  sanitaer: 'ausst_sanitaer', heizung: 'ausst_heizung', sonstige_technik: 'ausst_technik' };
const BTL = ['btl_gauben', 'btl_balkone', 'btl_vordach', 'btl_terrassen', 'btl_sonstige'];
function standardstufeAus(d) {
  const s = num(pick(d, ['standardstufe']));
  if (s >= 1 && s <= 5) return s;
  const a = String(pick(d, ['ausst']) || '').toLowerCase();
  return AUSST_ZU_STUFE[a] || null;
}
function qualityAus(d) {
  /* Die Standardstufe gewinnt: `ausst` steht im Formular IMMER auf
     „Normal" (vorausgewaehlt, index.html:1105) und sagt deshalb nichts,
     sobald eine Stufe eingetragen ist. */
  const s = num(pick(d, ['standardstufe']));
  if (s >= 1 && s <= 5) return STUFE_ZU_QUALITY[Math.round(s)] || null;
  return pick(d, ['quality', 'ausst', 'ausstattung']);
}
function gewerkeAus(d) {
  const o = {}; let n = 0;
  Object.keys(GEWERKE).forEach((k) => {
    /* Nicht num(): das liest „2.5" als deutsche 25 (Tausenderpunkt). Die
       Selects liefern halbe Stufen mit Punkt — gemessen im Funktionslauf. */
    const roh = d[GEWERKE[k]];
    const v = (roh == null || roh === '') ? NaN : parseFloat(String(roh).replace(',', '.'));
    if (v >= 1 && v <= 5) { o[k] = v; n++; }
  });
  return n ? o : null;
}

/* v2210 · GEWERBE AUS DEN MFH-EINHEITEN.
   Bis hier kam von den Einheiten nur die ANZAHL an. Ein Wohn- und
   Geschaeftshaus rechnete deshalb die Wohnmiete auf die GANZE Flaeche
   (CrossCheckService, mieteQm x wfl x 12) - auch auf das Ladenlokal.
   § 31 Abs. 2 ImmoWertV verlangt den marktueblichen Rohertrag JE Nutzung,
   Anlage 3 die Bewirtschaftung je Nutzung. Hier wird getrennt:
     wfl_wohnen / wfl_gewerbe, Flaeche je Gewerbe-Nutzung,
     Ist-Miete Gewerbe (vermietet, x 12), Marktmiete Gewerbe (nur wenn JEDE
     Gewerbeeinheit eine marktuebliche Miete traegt - halb gibt es nicht). */
function gewerbeAus(d) {
  const liste = Array.isArray(d._mfh_einheiten) ? d._mfh_einheiten
    : (d._mfh && Array.isArray(d._mfh.einheiten) ? d._mfh.einheiten : null);
  if (!liste || !liste.length) return null;
  const gew = liste.filter((e) => String(e.art || '') === 'gewerbe');
  if (!gew.length) return null;
  const out = { n_gewerbe: gew.length, n_wohnen: liste.length - gew.length,
    wfl_wohnen: 0, wfl_gewerbe: 0, flaechen: {}, ist_jahr: 0, markt_jahr: 0,
    markt_vollstaendig: true, leer_ohne_markt: 0, ohne_nutzung_qm: 0,
    /* v2241 · Ist-Miete des Wohnteils — nur fuer Objekte, die als GEWERBE
       erfasst sind (Geschaeftshaus mit Wohnungen). Dort gibt es keine
       Wohn-Angebotsmiete im Abruf; ein MFH rechnet weiter wie bisher. */
    wohnen_ist_jahr: 0, wohnen_leer: 0 };
  liste.forEach((e) => {
    const fl = num(e.wfl) || 0;
    if (String(e.art || '') !== 'gewerbe') {
      out.wfl_wohnen += fl;
      if (String(e.status || '') === 'leer' || !(num(e.ist) > 0)) out.wohnen_leer++;
      else out.wohnen_ist_jahr += num(e.ist) * 12;
      return;
    }
    out.wfl_gewerbe += fl;
    const n = e.nutzung_gew || '';
    if (n) out.flaechen[n] = (out.flaechen[n] || 0) + fl; else out.ohne_nutzung_qm += fl;
    const leer = String(e.status || '') === 'leer';
    if (!leer) out.ist_jahr += (num(e.ist) || 0) * 12;
    const mq = num(e.markt_qm);
    if (mq > 0 && fl > 0) out.markt_jahr += mq * fl * 12;
    else { out.markt_vollstaendig = false; if (leer) out.leer_ohne_markt++; }
  });
  out.ist_jahr = Math.round(out.ist_jahr);
  out.wohnen_ist_jahr = Math.round(out.wohnen_ist_jahr);
  out.markt_jahr = out.markt_vollstaendig ? Math.round(out.markt_jahr) : null;
  return out;
}

/* v2520 · LEERSTAND AUS DEN MFH-EINHEITEN (Marcel 20.10.2026).
   Der Ertragswert bezieht die Ist-Miete nur auf die VERMIETETE Flaeche und
   prueft sie dort gegen das Band; leere Einheiten gehen mit der marktueblichen
   Miete in den Rohertrag ein (CrossCheckService). Bis hier kam vom Leerstand
   nichts an - die Ist-Miete wurde durch die gesamte Wohnflaeche geteilt.
   Nur wenn es mindestens eine leere UND eine vermietete Wohnung gibt, jede
   Einheit eine Flaeche traegt und kein Gewerbe dabei ist (das rechnet v2210
   getrennt). Leer = Status „leer" oder keine Ist-Miete (wie gewerbeAus und
   PotenzialService). Vermietungsstand „Leer" (ganzes Objekt) gewinnt. */
function leerstandAus(d) {
  const liste = Array.isArray(d._mfh_einheiten) ? d._mfh_einheiten
    : (d._mfh && Array.isArray(d._mfh.einheiten) ? d._mfh.einheiten : null);
  if (!liste || !liste.length) return null;
  if (/^\s*leer\s*$/i.test(String(pick(d, ['vermstand', 'vermietungsstand']) || ''))) return null;
  if (liste.some((e) => e && String(e.art || '') === 'gewerbe')) return null;
  const out = { n_leer: 0, n_vermietet: 0, wfl_leer: 0, wfl_vermietet: 0, ist_monat_vermietet: 0 };
  for (const e of liste) {
    const fl = num(e && e.wfl);
    if (!(fl > 0)) return null;
    const ist = num(e.ist);
    if (String(e.status || '') === 'leer' || !(ist > 0)) { out.n_leer++; out.wfl_leer += fl; }
    else { out.n_vermietet++; out.wfl_vermietet += fl; out.ist_monat_vermietet += ist; }
  }
  if (!out.n_leer || !out.n_vermietet) return null;
  out.wfl_leer = Math.round(out.wfl_leer * 100) / 100;
  out.wfl_vermietet = Math.round(out.wfl_vermietet * 100) / 100;
  out.ist_monat_vermietet = Math.round(out.ist_monat_vermietet * 100) / 100;
  return out;
}

/* v2540 · DIE EINHEITEN EINZELN (Marcel 20.10.2026: die vermieteten Wohnungen
   werden einzeln an die Bandkante gehoben). ImmoWertA 31.2 a/b prueft die
   Marktueblichkeit je Mietverhaeltnis - Mieterhoehungsmoeglichkeiten gibt es
   nur je Vertrag. Bis v2539 pruefte der Ertragswert die Ist-Miete des ganzen
   Hauses: Demo-MFH WE 1 mit 6,18 €/m² unter der Kante 6,64, das Haus mit 7,31
   im Band - die Wohnung blieb bei 6,18. Gleiche Bedingungen wie leerstandAus
   (nur Wohnen, jede Einheit mit Flaeche, mindestens eine vermietet); schon ab
   ZWEI Einheiten, auch ohne Leerstand. */
function einheitenMieteAus(d) {
  const liste = Array.isArray(d._mfh_einheiten) ? d._mfh_einheiten
    : (d._mfh && Array.isArray(d._mfh.einheiten) ? d._mfh.einheiten : null);
  if (!liste || liste.length < 2) return null;
  if (/^\s*leer\s*$/i.test(String(pick(d, ['vermstand', 'vermietungsstand']) || ''))) return null;
  if (liste.some((e) => e && String(e.art || '') === 'gewerbe')) return null;
  const out = [];
  for (let i = 0; i < liste.length; i++) {
    const e = liste[i];
    const fl = num(e && e.wfl);
    if (!(fl > 0)) return null;
    const ist = num(e.ist);
    const leer = String(e.status || '') === 'leer' || !(ist > 0);
    /* v2600 · E2/E3 · Vertragslaufzeit (Restlaufzeit der Mietabweichung) und der waehlbare
       Leerstandsabzug je Wohnung - nur, was eingetragen ist */
    const _d = (v) => (v && /^\d{4}-\d{2}(-\d{2})?$/.test(String(v)) ? String(v) : null);
    out.push(Object.assign({ nr: String(e.nr || e.bez || e.name || ('WE ' + (i + 1))), wfl: Math.round(fl * 100) / 100,
               ist_monat: leer ? null : Math.round(ist * 100) / 100, leer },
      e.mv_art ? { mv_art: String(e.mv_art) } : {},
      _d(e.mv_befristet_bis) ? { mv_befristet_bis: _d(e.mv_befristet_bis) } : {},
      _d(e.mv_kuendigungsverzicht_bis) ? { mv_kuendigungsverzicht_bis: _d(e.mv_kuendigungsverzicht_bis) } : {},
      num(e.mv_abw_jahre) > 0 ? { mv_abw_jahre: num(e.mv_abw_jahre) } : {},
      (leer && (e.leer_abzug === true || e.leer_abzug === 'true')) ? { leer_abzug: true,
        leer_monate: num(e.leer_monate) > 0 ? num(e.leer_monate) : null,
        herrichtung_eur: num(e.herrichtung_eur) > 0 ? num(e.herrichtung_eur) : null } : {}));
  }
  return out.some((x) => !x.leer) ? out : null;
}

export const DealPilotObjectMapper = {
  reportInput(obj) {
    const d = dataOf(obj);
    const wfl = num(pick(d, ['wfl', 'wohnflaeche', 'wohnfläche']));
    const _bom = bomAus(d);   /* v2241 */
    return {
      address: buildAddress(d),
      property_type: mapPropertyType(pick(d, ['objart', 'objektart'])),
      /* v2359 · Die genaue Hausart. mapPropertyType fasst EFH/ZFH/DHH/RH zu
         „haus" zusammen - die Umrechnungskoeffizienten pruefen ihre Geltung
         aber je Hausart (Bielefeld: nur Regelfall IfW, Dortmund: Tabelle je
         Haustyp). Mit „haus" griff fuer App-Objekte weder der amtliche
         Koeffizient noch die DealPilot-Formel. */
      property_subtype: (function () {
        const t = String(pick(d, ['objart', 'objektart']) || '').toLowerCase();
        if (/dhh|doppel/.test(t)) return 'dhh';
        if (/\brh\b|reihen/.test(t)) return 'rh';
        if (/zfh|zweifam/.test(t)) return 'zfh';
        if (/efh|einfam/.test(t)) return 'efh';
        return null;
      })(),
      /* v2241 · Die Unterart (buero, gesch, hotel, gew, laden, praxis …).
         Ohne sie misst der Bericht ein Buero am Wohnungsmarkt. */
      gewerbe_art: gewerbeArtAus(pick(d, ['objart', 'objektart'])),
      /* Nur wenn es einen Betrag gibt: der Orchestrator liest
         `Number.isFinite(Number(input.bom_eur))`, und Number(null) ist 0. */
      ...(_bom.bom_eur != null ? { bom_eur: _bom.bom_eur, bom_grund: _bom.bom_grund, bom_quelle: _bom.bom_quelle } : {}),
      living_area: wfl,
      rooms: num(pick(d, ['zimmer'])),
      build_year: num(pick(d, ['baujahr'])),
      floor: num(pick(d, ['etage'])),
      /* v2660 · E7 · „Anzahl Etagen" (Reiter Objekt) - die Umrechnung des Immobilienrichtwerts
         fuehrt bei Wohnungseigentum teils die Geschosszahl des Gebaeudes (Koeln, Feld ANZG). */
      geschosse_gesamt: num(pick(d, ['etagen_ges'])),
      /* v2660 · E2 · Einzelobjekt ohne Wohnungsliste (ETW, EFH): Restlaufzeit der Mietabweichung.
         Mit Wohnungsliste reisen dieselben Felder je Wohnung (einheitenMieteAus). */
      mv_befristet_bis: (function () { const v = pick(d, ['mv_befristet_bis']); return v && /^\d{4}-\d{2}(-\d{2})?$/.test(String(v)) ? String(v) : null; })(),
      mv_kuendigungsverzicht_bis: (function () { const v = pick(d, ['mv_kuendigungsverzicht_bis']); return v && /^\d{4}-\d{2}(-\d{2})?$/.test(String(v)) ? String(v) : null; })(),
      mv_abw_jahre: num(pick(d, ['mv_abw_jahre'])) > 0 ? num(pick(d, ['mv_abw_jahre'])) : null,
      /* v1437: Wohneinheiten fehlten - der Ertragswert setzt die Verwaltungskosten
         je BEWERTETER Einheit an (Anlage 3 ImmoWertV) und rechnete auf dem Objektweg
         ohne sie am Durchschnitt. Der Sprechlauf fragt sie beim MFH jetzt ab. */
      units: num(pick(d, ['einheiten', 'units'])),
      gewerbe: gewerbeAus(d),   /* v2210 */
      leerstand: leerstandAus(d),   /* v2520 */
      einheiten_miete: einheitenMieteAus(d),   /* v2540 */
      /* v2241 · Hier stand `|| 'gepflegt'`. Ein Objekt OHNE Zustandsangabe
         (der Quick-Check fuehrt gar kein Feld dafuer) wurde damit als
         gepflegt bewertet UND zaehlte in der Aussagekraft als „Zustand
         angegeben". Der Faktor bleibt ohne Angabe 1,0 (ValuationService,
         Vorgabe der Nachschlagetabelle) — nur die Aussagekraft sagt jetzt
         ehrlich, dass er fehlt. */
      condition: pick(d, ['ds2_zustand', 'zustand']) || null,
      /* v1444: ValuationService liest ref.quality - hier kam die Ausstattung nur als
         `ausstattung` an, der Qualitaetsfaktor griff auf dem Objektweg nie. */
      quality: qualityAus(d),   /* v1851: aus `ausst` ODER aus der Standardstufe */
      energy_class: pick(d, ['ds2_energie', 'energieklasse', 'energie_label']),
      purchase_price: num(pick(d, ['kp', 'kaufpreis'])),
      monthly_net_rent: num(pick(d, ['nkm', 'nettokaltmiete'])),
      vacancy: vacancyFrom(d),
      // Bodenrichtwert aus DealPilot als BORIS-Fallback
      land_value_manual: num(pick(d, ['brw'])),
      /* v1427b-ZFH · Die Objektart bleibt grob (haus), das Merkmal reist
         getrennt: ohne es wuerde der Korrekturfaktor 1,05 fuer
         Zweifamilienhaeuser (NHK 2010) aus der App nie ankommen. */
      zweifamilienhaus: /zfh|zweifamilien/i.test(String(pick(d, ['objart', 'objektart']) || '')),
      /* ═══ v1320 · Erbbaurecht ═══════════════════════════════════════
         Marcels Frage: "funktioniert die erbpacht jetzt in jedem
         marktbericht unter marktbewertung?"

         Bisher nicht - der Marktbericht wusste nichts davon. Kein
         Bewertungspartner nimmt den Parameter entgegen (gemessen gegen
         GeoMap: leasehold, heritableBuildingRight, groundLease,
         erbbaurecht, erbpacht - alle 400 Unrecognized field), also muss
         der Bericht es selbst wissen, um es selbst zu rechnen.

         Drei Angaben, mehr braucht § 50 ImmoWertV nicht: ob ueberhaupt,
         wie hoch der Zins und wie lange der Vertrag noch laeuft. Der
         Bodenwert steht schon oben (land_value_manual). */
      plot_area: num(pick(d, ['gsfl', 'grundstuecksflaeche'])),
      mea_pct: dez(pick(d, ['mea'])),   /* v1851: „7.06" ist 7,06 %, nicht 706 */
      leasehold: !!pick(d, ['_erbpacht', 'erbpacht']),
      leasehold_rent_year: num(pick(d, ['erbbauzins'])),
      leasehold_years_left: num(pick(d, ['erb_restlz'])),
      /* v727-equipment: Ausstattungsdetails (fliessen in DealPilot-Marktanalyse ein) */
      heating: pick(d, ['eq_heating']),
      windows: pick(d, ['eq_windows']),
      floor_covering: pick(d, ['eq_floor']),
      bath: pick(d, ['eq_bath']),
      guest_wc: pick(d, ['eq_guest_wc']),
      store_room: pick(d, ['eq_store_room']),
      exterior_walls: pick(d, ['eq_walls']),
      roof: pick(d, ['eq_roof']),
      elevator: pick(d, ['eq_elevator']),

      /* ═══ v1851 · DER BLOCK MIT DEN MEISTEN FELDERN LIEFERTE NICHTS ═══
         Gemessen am 04.10.2026 (N4): von den 37 Feldern des Blocks
         „Wertermittlung (Marktbericht)" im Reiter Objekt kam auf dem
         Objekt-Weg KEIN EINZIGES hier an — der Orchestrator liest sie
         alle (ref-Literal ab ReportOrchestrator.js:88), aber dieser Mapper
         gab sie nicht zurück. Dazu `modernis`, `garagen`, `stellpl_aussen`,
         `balkon_flae`, `nutzungsart`, `bad_anz`: gesendet, verworfen.

         Die Namen sind die des ref-Literals — wer dort nicht steht,
         existiert für den Bericht nicht. Leere Felder bleiben null; der
         Orchestrator füllt `ausstattung` aus den eq_* nur dort, wo hier
         nichts steht (die eigene Angabe gewinnt). */
      usage_type: (function () {
        const n = String(pick(d, ['nutzungsart']) || '').toLowerCase();
        return n ? (/eigen/.test(n) ? 'eigennutzung' : 'vermietet') : null;
      })(),
      modernization_year: num(pick(d, ['modernis'])),
      garages: num(pick(d, ['garagen'])),
      outdoor_parking: num(pick(d, ['stellpl_aussen'])),
      balcony_area: num(pick(d, ['balkon_flae'])),
      bathrooms: num(pick(d, ['bad_anz'])),
      baustatus: pick(d, ['baustatus']),
      /* Sachwert (Stufe 3) */
      bgf: num(pick(d, ['bgf'])),
      standardstufe: standardstufeAus(d),
      grundriss: pick(d, ['grundriss']),
      /* ══ v1973 · 0 PUNKTE IST EINE ANTWORT, KEINE LEERE STELLE ═══════

         `mod_punkte` allein kann nicht zwischen zwei Faellen
         unterscheiden:

           niemand hat hingesehen          -> Schaetzung ist richtig
           alle acht mit „Keine/Nie"       -> 0 Punkte sind ein BEFUND,
                                              und Anlage 2 gilt

         GEMESSEN an der Parkstr. 9: fuenf der acht Bauteile sind
         beantwortet (dreimal „Keine/Nie", zweimal „> 20 Jahre"), und es
         kommen 0 Punkte heraus. Das ist richtig gerechnet — die Anlage 2
         vergibt null, wenn die Massnahmen weit zurueckliegen. Der Bericht
         schrieb daraus aber „Es wurde kein Modernisierungsgrad erfasst."

         `mod_angaben` zaehlt deshalb, wie viele der acht Felder
         ueberhaupt eine Antwort tragen. Das ist ZAEHLEN, kein Modell —
         die Punktevergabe bleibt dort, wo sie hingehoert (Anlage 2,
         Tabelle 1), und wird hier nicht nachgebaut. */
      mod_punkte: num(pick(d, ['mod_punkte'])),
      mod_angaben: (function () {
        const felder = ['mod_dach', 'mod_fenster', 'mod_leitungen', 'mod_heizung',
                        'mod_aussenwand', 'mod_baeder', 'mod_innenausbau', 'mod_grundriss'];
        return felder.reduce((n, k) => n + (d[k] != null && String(d[k]).trim() !== '' ? 1 : 0), 0);
      })(),
      sachwertfaktor: dez(pick(d, ['sachwertfaktor'])),
      uk_flaeche: dez(pick(d, ['uk_flaeche'])),   /* v2282 · eigener Umrechnungskoeffizient Grundstuecksgroesse */
      wgfz_objekt: dez(pick(d, ['wgfz_objekt'])),   /* v2361 · WGFZ des Objekts (§ 16 Abs. 4 ImmoWertV) */
      angebot_abschlag_pct: dez(pick(d, ['angebot_abschlag_pct'])),   /* v2367 · eigener Angebotsabschlag */
      nhk_typ: (function () {
        const h = pick(d, ['nhk_haus']), g = pick(d, ['nhk_geschosse']), dd = pick(d, ['nhk_dach']);
        return (h && g != null && g !== '' && dd) ? (String(h) + '.' + String(g) + String(dd)) : null;
      })(),
      /* v2396 · Reihenend- oder Reihenmittelhaus fuer die Zweigwahl des
         Liegenschaftszinssatzes. Dresden fuehrt beide getrennt (0,86 % End-/
         Doppelhaus, 0,64 % Mittelhaus); ohne Angabe fragt der Bericht jetzt
         nach, statt per Ladereihenfolge zu waehlen. Die Angabe steht schon
         im Formular: Hausform (nhk_haus) 2 = Doppelhaus/Reihenendhaus,
         3 = Reihenmittelhaus. */
      haustyp: (function () {
        const t = String(pick(d, ['objart', 'objektart']) || '').toLowerCase();
        if (!/\brh\b|reihen/.test(t)) return null;
        const h = String(pick(d, ['nhk_haus']) || '');
        return h === '3' ? 'rmh' : (h === '2' ? 'reh' : null);
      })(),
      hinterland_qm: num(pick(d, ['hinterland_qm'])),
      hinterland_eur_qm: dez(pick(d, ['hinterland_eur_qm'])),
      hinterland_rentierlich: /^(ja|true|1)$/i.test(String(pick(d, ['hinterland_rentierlich']) || '')),
      garagen_bgf_qm: num(pick(d, ['garagen_bgf_qm'])),
      garagen_stufe: num(pick(d, ['garagen_stufe'])),
      aussenanlagen_pct: dez(pick(d, ['aussenanlagen_pct'])),
      aussenanlagen: num(pick(d, ['aussenanlagen'])),
      bes_bauteile: num(pick(d, ['bes_bauteile'])),
      ausstattung: gewerkeAus(d),
      /* v2383 · Die Felder sind Euro (Formular: „Balkone (€)"). Ein Betrag unter 100 € ist keine
         Herstellungskostenangabe, sondern fast sicher eine STUECKZAHL (gemessen: btl_balkone = 2 und 1).
         Er wird nicht gerechnet und im Bericht benannt. */
      bauteile_unplausibel: (function () {
        const o = {}; BTL.forEach((k) => { const v = num(d[k]); if (v != null && v > 0 && v < 100) o[k.replace(/^btl_/, '')] = v; });
        return Object.keys(o).length ? o : null;
      })(),
      bauteile_hk: (function () {
        const s = BTL.reduce((a, k) => { const v = num(d[k]) || 0; return a + (v >= 100 ? v : 0); }, 0);
        return s > 0 ? Math.round(s) : null;
      })(),
      bauteile_detail: (function () {
        const g = (v) => { const n = num(v); return n != null && n >= 100 ? n : null; };   /* v2383 */
        const o = { gauben: g(d.btl_gauben), balkone: g(d.btl_balkone), vordaecher: g(d.btl_vordach),
                    terrassen: g(d.btl_terrassen), sonstige: g(d.btl_sonstige) };
        return Object.values(o).some((v) => v) ? o : null;
      })(),
      /* Ertragswert (Stufe 3) */
      lzs_pct: dez(pick(d, ['lzs_pct'])),               /* v1851: „2.56" kam als 256 an */
      brw_anpassung_pct: dez(pick(d, ['brw_anpassung_pct'])),
      brw_anpassung_grund: pick(d, ['brw_anpassung_grund']),
      stellplatz_miete_monat: num(pick(d, ['stellplatz_miete_monat'])),
      /* v1877 · Zusatzeinnahmen aus dem Reiter Miete (`ze`, je Monat) kamen auf diesem Weg gar nicht
         an - der Rohertrag fehlte um 90 EUR/Monat (Parkstr. 9). Der Bericht kennt sie als sonstige_jahr. */
      sonstige_jahr: num(pick(d, ['sonstige_jahr'])),
      /* v2382 · `ze` heisst in der Haupt-App „Zusaetzliche Einnahmen / Monat - Stellplatz, Garage etc.,
         fliesst in Nettokaltmiete". Das ist Rohertrag (§ 31 ImmoWertV), keine Kueche/Moeblierung mit
         15 Jahren Laufzeit. Bis v2381 kam es als sonstige_jahr an (W: 1.080 €/Jahr ausserhalb des Rohertrags). */
      zusatz_ertrag_jahr: (function () { const ze = num(pick(d, ['ze'])); return ze ? Math.round(ze * 12) : null; })(),
    };
  },

  /* v1851 · Die Nutzer-Einschätzung der Lage — getrennt von `assessment`
     (das der Orchestrator aus GeoMap/Zensus/Makro baut und ausdrücklich
     NICHT aus Nutzereingaben). Marcels Entscheidung vom 04.10.2026: die
     Indikatoren gehören in den Bericht — aber als das, was sie sind. */
  nutzerEinschaetzung(obj) {
    const d = dataOf(obj);
    const out = {
      mikrolage: pick(d, ['mikrolage']),
      makrolage: pick(d, ['makrolage']),
      bevoelkerung: pick(d, ['ds2_bevoelkerung']),
      nachfrage: pick(d, ['ds2_nachfrage']),
      entwicklung: pick(d, ['ds2_entwicklung']),
      wertsteigerung: pick(d, ['ds2_wertsteigerung']),
      mietausfallrisiko: pick(d, ['ds2_mietausfall']),
      marktmiete_eur_qm: num(pick(d, ['ds2_marktmiete'])),
      marktfaktor: num(pick(d, ['ds2_marktfaktor'])),
    };
    if (!Object.values(out).some((v) => v != null && v !== '')) return null;
    /* v2515 · HERKUNFT JE FELD. Die KI-Funktion „Lage analysieren" fuellt
       diese Felder (gemessen, wo es eine Messung gibt, sonst KI-Wert) - im
       Bericht stand dann alles als „Ihre Angabe". Die Haupt-App fuehrt seit
       v2515 das versteckte Feld _lage_herkunft (JSON, Feld-ID -> gemessen |
       ki | eigen). Fehlt es (Altbestand), wird nichts behauptet. */
    let h = d._lage_herkunft;
    if (typeof h === 'string') { try { h = h ? JSON.parse(h) : null; } catch { h = null; } }
    if (h && typeof h === 'object') {
      const ERLAUBT = { gemessen: 1, ki: 1, eigen: 1 };
      const map = { mikrolage: 'mikrolage', makrolage: 'makrolage', bevoelkerung: 'ds2_bevoelkerung',
        nachfrage: 'ds2_nachfrage', entwicklung: 'ds2_entwicklung', wertsteigerung: 'ds2_wertsteigerung',
        mietausfallrisiko: 'ds2_mietausfall' };
      const herkunft = {};
      /* Eintrag {art, wert}: gilt nur, solange der Feldwert noch derselbe
         ist - sonst wurde das Feld spaeter anders gesetzt (dann nichts). */
      for (const [k, id] of Object.entries(map)) {
        const e = h[id];
        if (out[k] == null || out[k] === '' || !e || typeof e !== 'object') continue;
        if (ERLAUBT[e.art] && String(e.wert) === String(out[k])) herkunft[k] = e.art;
      }
      if (Object.keys(herkunft).length) out.herkunft = herkunft;
    }
    return out;
  },

  // Lage- und Potenzialbewertungen (DealPilot-Eingaben). Strings bleiben lesbar (gut/mittel/…).
  assessment(obj) {
    const d = dataOf(obj);
    const out = {
      mikrolage: pick(d, ['mikrolage']),
      makrolage: pick(d, ['makrolage']),
      bevoelkerung: pick(d, ['ds2_bevoelkerung']),
      nachfrage: pick(d, ['ds2_nachfrage']),
      entwicklung: pick(d, ['ds2_entwicklung']),
      wertsteigerung: pick(d, ['ds2_wertsteigerung']),
      mietausfallrisiko: pick(d, ['ds2_mietausfall']),
      ausstattung: pick(d, ['ausst', 'ausstattung']),
      vermietungsstand: pick(d, ['vermstand', 'vermietungsstand']),
      marktmiete_eur_qm: num(pick(d, ['ds2_marktmiete'])),
      marktfaktor: num(pick(d, ['ds2_marktfaktor'])),
    };
    // nur zurueckgeben, wenn mind. ein Feld belegt ist
    return Object.values(out).some((v) => v != null && v !== '') ? out : null;
  },

  // Vorhandener DealScore + KI-Investmentanalyse (in der .dpkt als JSON-String)
  dealpilot(obj) {
    const d = dataOf(obj);
    let ai = null;
    const raw = obj && obj.ai_analysis != null ? obj.ai_analysis : d.ai_analysis;
    if (raw) {
      if (typeof raw === 'string') { try { ai = JSON.parse(raw); } catch { ai = null; } }
      else if (typeof raw === 'object') ai = raw;
    }
    const score = num(pick(d, ['_dealpilot_score', 'dealpilot_score']));
    const ds2 = num(pick(d, ['_ds2_score', 'ds2_score']));
    const dscr = num(pick(d, ['_kpis_dscr']));
    const ltv = num(pick(d, ['_kpis_ltv']));
    const cashflow = num(pick(d, ['_kpis_cf_ns']));
    const sv = num(pick(d, ['svwert']));
    if (score == null && ds2 == null && !ai && dscr == null) return null;
    return { score, ds2_score: ds2, dscr, ltv_pct: ltv, cashflow_monthly: cashflow,
             sv_wert: sv, ai_analysis: ai };
  },
};
