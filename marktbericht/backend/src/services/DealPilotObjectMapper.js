// DealPilotObjectMapper.js
// Uebersetzt ein DealPilot-Objekt (.dpkt: flach ODER { data: {...} }) in
//   - reportInput: Felder fuer ReportOrchestrator.generate (Adresse, Flaeche, Preise, brw)
//   - assessment:  die DS2-Lage-/Potenzialbewertungen (Mikro/Makro/Bevoelkerung/Nachfrage/
//                  Entwicklung/Wertsteigerung/Mietausfall + Marktmiete/Marktfaktor)
//   - dealpilot:   vorhandener DealScore + (geparste) KI-Investmentanalyse
// So fliessen die in DealPilot bereits erfassten Einschaetzungen direkt in den Bericht.

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
function mapPropertyType(raw) {
  const s = String(raw || '').toLowerCase();
  if (/etw|wohnung|eigentumswohnung/.test(s)) return 'wohnung';
  if (/mfh|mehrfamilien/.test(s)) return 'mfh';
  if (/efh|dhh|rh|zfh|haus|einfamilien|doppelhaus|reihenhaus/.test(s)) return 'haus';
  if (/^gar$|garage|stellplatz/.test(s)) return 'garage';
  if (/buero|büro|gesch|hotel|gew|laden|handel|praxis/.test(s)) return 'gewerbe';
  return null;
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

export const DealPilotObjectMapper = {
  reportInput(obj) {
    const d = dataOf(obj);
    const wfl = num(pick(d, ['wfl', 'wohnflaeche', 'wohnfläche']));
    return {
      address: buildAddress(d),
      property_type: mapPropertyType(pick(d, ['objart', 'objektart'])),
      living_area: wfl,
      rooms: num(pick(d, ['zimmer'])),
      build_year: num(pick(d, ['baujahr'])),
      floor: num(pick(d, ['etage'])),
      /* v1437: Wohneinheiten fehlten - der Ertragswert setzt die Verwaltungskosten
         je BEWERTETER Einheit an (Anlage 3 ImmoWertV) und rechnete auf dem Objektweg
         ohne sie am Durchschnitt. Der Sprechlauf fragt sie beim MFH jetzt ab. */
      units: num(pick(d, ['einheiten', 'units'])),
      condition: pick(d, ['ds2_zustand', 'zustand']) || 'gepflegt',
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
      mod_punkte: num(pick(d, ['mod_punkte'])),
      sachwertfaktor: dez(pick(d, ['sachwertfaktor'])),
      nhk_typ: (function () {
        const h = pick(d, ['nhk_haus']), g = pick(d, ['nhk_geschosse']), dd = pick(d, ['nhk_dach']);
        return (h && g != null && g !== '' && dd) ? (String(h) + '.' + String(g) + String(dd)) : null;
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
      bauteile_hk: (function () {
        const s = BTL.reduce((a, k) => a + (num(d[k]) || 0), 0);
        return s > 0 ? Math.round(s) : null;
      })(),
      bauteile_detail: (function () {
        const o = { gauben: num(d.btl_gauben), balkone: num(d.btl_balkone), vordaecher: num(d.btl_vordach),
                    terrassen: num(d.btl_terrassen), sonstige: num(d.btl_sonstige) };
        return Object.values(o).some((v) => v) ? o : null;
      })(),
      /* Ertragswert (Stufe 3) */
      lzs_pct: dez(pick(d, ['lzs_pct'])),               /* v1851: „2.56" kam als 256 an */
      brw_anpassung_pct: dez(pick(d, ['brw_anpassung_pct'])),
      brw_anpassung_grund: pick(d, ['brw_anpassung_grund']),
      stellplatz_miete_monat: num(pick(d, ['stellplatz_miete_monat'])),
      /* v1877 · Zusatzeinnahmen aus dem Reiter Miete (`ze`, je Monat) kamen auf diesem Weg gar nicht
         an - der Rohertrag fehlte um 90 EUR/Monat (Parkstr. 9). Der Bericht kennt sie als sonstige_jahr. */
      sonstige_jahr: (function () { const sj = num(pick(d, ['sonstige_jahr'])); if (sj) return sj; const ze = num(pick(d, ['ze'])); return ze ? Math.round(ze * 12) : null; })(),
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
    return Object.values(out).some((v) => v != null && v !== '') ? out : null;
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
