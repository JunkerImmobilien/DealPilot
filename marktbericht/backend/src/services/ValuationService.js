// ValuationService.js — Marktwert + Renditekennzahlen.
// Formeln exakt nach Auftrag; Faktoren transparent & einzeln ausgewiesen.
import { round } from '../lib/stats.js';
import { istGewerbe, istGrundstueck } from '../lib/marktsegment.js';   /* v2241 */
import { finde as regFinde } from '../lib/ausschuss_register.js';   /* v2367 */

/* v2367 · recherchierter Marktdurchschnitt des Abschlags auf Angebotspreise - DERSELBE
   Wert wie frontend/js/config.js angebotAbschlagMarkt.pct (Stand Dezember 2025). Bei
   jeder Nachrecherche BEIDE Stellen ziehen. */
const ANGEBOT_ABSCHLAG_MARKT_PCT = 5.8;
import { lagenFuer as regLagen } from '../lib/ausschuss_register.js';   /* v2578 */
import { liegenschaftszinssatz as regZins } from '../lib/gutachterausschuss.js';   /* v2578 */
import { zinssatzFuerObjekt, typVon, dekodiere } from '../lib/zweigwahl.js';   /* v2578 */
import { restnutzungsdauerEinheitlich as rndEinheitlich } from '../lib/rnd-einheitlich.js';   /* v2578 */
import { etwKleinobjektAusgenommen } from './WertParameterService.js';   /* v2578 */

/* ══ v2578 · ZWEITE QUELLE FUER DEN OERTLICHEN ANGEBOTSABSCHLAG ═══════════════
   Marcel 21.10.2026: „Wenn wir verlaessliche Abschlaege haben fuer Angebotsdaten,
   sollten wir das machen." Die Liegenschaftszins-Saetze der Ausschuesse (NRW:
   Grundstuecksmarktdaten nach AGVGA-Modell, HE: Immobilienmarktberichte) fuehren
   als Modellansatz den Ø Kaufpreis der ausgewerteten Kauffaelle
   (modellansaetze.kaufpreis_eur_qm, €/m² Wohnflaeche). Gegen den Angebotsmedian
   gehalten ergibt er den oertlichen Abschlag - aber NUR, wenn ALLE Kriterien
   erfuellt sind; sonst gilt der Marktdurchschnitt, und WARUM steht intern im
   Ergebnis (angebot_abschlag.pruefung_lzs), nie im Kundentext:

     K1  Teilmarkt: der Zweig des Satzes ist DERSELBE Teilmarkt wie das Objekt
         (MFH -> mfh/mfh_bis6/mfh_ueber6, Dreifamilienhaus -> dreifh/mfh,
         ETW -> etw/we_v/we/wohnung, EFH -> efh/ezfh, ZFH -> zfh/ezfh,
         DHH/RH -> efh_dhh_reh/efh_rmh/rhdhh, Villa -> efh_villa/altbauvilla).
         Kein Ausweichen auf einen Nachbarteilmarkt (wgh fuer ein MFH, efh fuer
         eine DHH), kein Gewerbe, kein Grundstueck. Der Zweig wird mit
         DERSELBEN Zweigwahl bestimmt wie der Zins des Ertragswerts
         (zinssatzFuerObjekt) - Lage/Baujahr/RND-Baender inklusive; eine
         Rueckfrage der Zweigwahl heisst: kein Wert.
     K2  Gebiet: Satz des Ausschusses fuer die AGS des Objekts (Gemeinde oder
         Kreis); nie Bezirk, Land oder Bund (Kein Treffer heisst kein Wert).
         ETW in Objekten mit hoechstens zwei WE dort, wo der Ausschuss sie aus
         seiner ETW-Auswertung ausdruecklich ausnimmt (Kreis Minden-Luebbecke).
     K3  Satz nicht gesperrt (vollstaendig !== false) und amtlich: Stufe A oder B
         (B heisst bei NRW nur: die Streuung des ZINSES liegt ueber 1,5 Pp - fuer
         den Ø Kaufpreis ohne Belang).
     K4  Jahrgang: der juengste Satz (Rangfolge der Zweigwahl), Berichtsjahr
         hoechstens zwei Jahre vor dem Bewertungsjahr - aeltere Kaufpreise gegen
         heutige Angebote messen die Preisentwicklung mit, nicht den Abschlag.
     K5  Stichprobe: mindestens 10 Kauffaelle, wo der Satz sie fuehrt
         (dieselbe Untergrenze wie MIN_FALLZAHL_C im WertParameterService).
     K6  Angebote: Median aus mindestens 8 Angeboten (MIN_SAMPLE des
         MarketAnalysisService), keine Demodaten.
     K7  Modellrahmen: die Saetze fuehren nur MITTELWERTE (Ø Objektgroesse,
         Ø Restnutzungsdauer), keine Spannen. Das Objekt liegt im Rahmen, wenn
         seine Wohnflaeche zwischen der Haelfte und dem Doppelten der
         Ø Objektgroesse liegt und seine RND (Anlage 2, GND des Satzes) hoechstens
         20 Jahre von der Ø RND abweicht (gemessene Streuung der RND in den
         Stichproben rund 10-11 Jahre, Bielefeld MFH 24 +- 11: 20 Jahre sind
         knapp zwei Standardabweichungen). Ohne RND entscheidet die Flaeche allein.
     K8  Band: das Ergebnis liegt zwischen 0 und 25 % - dasselbe Band wie die
         Messung am Rohertragsfaktor-Satz. Anders als dort wird NICHT gekappt:
         ein Wert ausserhalb heisst, dass Satz und Angebote nicht dasselbe messen
         -> Marktdurchschnitt mit internem Vermerk.

   Rangfolge (im compute): eigene Angabe > Ø Kaufpreis des Rohertragsfaktor-
   Satzes > Ø Kaufpreis des Liegenschaftszins-Satzes > Marktdurchschnitt. Der
   Rohertragsfaktor-Satz geht vor, weil er den Kaufpreis als eigene Kennzahl des
   Segments veroeffentlicht und dieselbe Quelle die amtliche Gegenprobe traegt;
   der Kaufpreis im Zins-Satz ist ein beschreibender Modellansatz der
   Zins-Stichprobe (nur rentierliche, vermietete Faelle eines Geschaeftsjahres). */
const LZS_AB = Object.freeze({ MIN_ANGEBOTE: 8, MIN_FALLZAHL: 10, MAX_ALTER_JAHRE: 2,
  FLAECHE_MIN: 0.5, FLAECHE_MAX: 2.0, RND_ABW_MAX: 20, BAND_MIN: 0, BAND_MAX: 25 });
const LZS_AB_TEILMARKT = {
  etw: ['etw', 'we_v', 'we', 'wohnung'], etw_selbst: ['etw', 'we_s', 'we_e', 'we', 'wohnung'],
  efh: ['efh', 'ezfh'], zfh: ['zfh', 'ezfh'], villa: ['efh_villa', 'altbauvilla'],
  dhh: ['efh_dhh_reh', 'rhdhh'], reh: ['efh_dhh_reh', 'efh_rmh', 'rhdhh'],
  rmh: ['efh_dhh_reh', 'efh_rmh', 'rhdhh'], rh: ['efh_dhh_reh', 'efh_rmh', 'rhdhh'],
  dreifh: ['dreifh', 'mfh'], mfh: ['mfh'], mfh_bis6: ['mfh_bis6', 'mfh'], mfh_ueber6: ['mfh_ueber6', 'mfh'],
};
/** „Der Gutachterausschuss für Grundstückswerte im Kreis Lippe und in der Stadt Detmold"
 *  -> „Gutachterausschuss Kreis Lippe und Stadt Detmold" (Ausschussnamen sind erlaubt). */
export function ausschussKurz(n) {
  let s = String(n || '').trim();
  if (!s) return null;
  s = s.replace(/^(der|die|das)\s+/i, '').replace(/\s+für\s+Grundstückswerte/i, '')
    .replace(/^(Gutachterausschuss|Obere[rn]? Gutachterausschuss)\s+(im|in der|in den|in|für den|für die|für das|für)\s+/i, '$1 ')
    .replace(/\s+und\s+(in der|im|in)\s+/gi, ' und ');
  return s;
}
/** Prueft K1-K8 und liefert den Abschlag aus dem Ø Kaufpreis des LZS-Satzes oder den Grund, warum nicht. */
export function abschlagAusLzs(ref, sale, area) {
  const nein = (grund, extra) => Object.assign({ verwendet: false, grund }, extra || {});
  try {
    if (!ref || !ref.ags) return nein('keine AGS');
    if (istGewerbe(ref) || istGrundstueck(ref)) return nein('Gewerbe/Grundstück - kein Wohnteilmarkt');
    const med = Number(sale && sale.median_per_sqm);
    const n = Number(sale && sale.sample_size);
    if (!(med > 0)) return nein('kein Angebotsmedian');
    if (!(n >= LZS_AB.MIN_ANGEBOTE)) return nein('K6: nur ' + (Number.isFinite(n) ? n : 0) + ' Angebote (mindestens ' + LZS_AB.MIN_ANGEBOTE + ')');
    if (sale.enthaelt_demodaten === true || sale.datenherkunft === 'demo') return nein('K6: Demodaten');
    const objart = ref.property_subtype || ref.property_type;
    const obj = { objart, nutzung: ref.nutzung || ref.usage_type || 'vermietet', haustyp: ref.haustyp || null,
      baujahr: ref.build_year || null, einheiten: ref.units || null, lage: ref.lage || null,
      stadtteil: ref.stadtteil || ref.ortsteil || null, bauweise: ref.bauweise || null };
    const typ = typVon(obj);
    if (!typ || !LZS_AB_TEILMARKT[typ]) return nein('K1: kein Wohnteilmarkt für Objektart ' + (objart || '-'));
    if (/^etw/.test(typ) && etwKleinobjektAusgenommen(ref.ags) && Number(ref.units) > 0 && Number(ref.units) <= 2) {
      return nein('K2: der Ausschuss nimmt Wohnungseigentum in Objekten mit höchstens zwei WE aus seiner ETW-Auswertung aus');
    }
    const rnd80 = rndEinheitlich(ref, 80);
    obj.restnutzungsdauer = rnd80 && rnd80.rnd != null ? rnd80.rnd : null;
    const z = zinssatzFuerObjekt({ finde: regFinde, lagenFuer: regLagen, abruf: regZins }, String(ref.ags), obj);
    if (!z || !z.verfuegbar) return nein('K1: Zweigwahl ohne Satz (' + ((z && (z.rueckfrage || z.grund)) || 'kein Satz') + ')');
    const art = dekodiere(z.zweig).art;
    if (LZS_AB_TEILMARKT[typ].indexOf(art) < 0) return nein('K1: Zweig ' + z.zweig + ' ist nicht der Teilmarkt ' + typ, { zweig: z.zweig });
    const satz = (regFinde('liegenschaftszinssatz', ref.ags) || []).find((s) => s && s.zweig === z.zweig
      && (z.lage == null || String(((s.geltungsbereich || {}).lage) || '') === String(z.lage))
      && (z.berichtsjahr == null || s.berichtsjahr === z.berichtsjahr)) || null;
    if (!satz) return nein('K1: Satz nicht auffindbar', { zweig: z.zweig });
    const ebene = String(satz.ebene || z.register_ebene || '');
    if (['bezirk', 'land', 'bund'].indexOf(ebene) >= 0) return nein('K2: Ebene ' + ebene, { zweig: z.zweig });
    if (satz.vollstaendig === false) return nein('K3: Satz gesperrt', { zweig: z.zweig });
    const stufe = String(satz.stufe || z.stufe || '');
    if (['A', 'B'].indexOf(stufe) < 0) return nein('K3: Stufe ' + (stufe || '-') + ' (nur A/B)', { zweig: z.zweig });
    const ma = satz.modellansaetze || {};
    const kp = Number(ma.kaufpreis_eur_qm);
    if (!(kp > 0)) return nein('Satz führt keinen Ø Kaufpreis', { zweig: z.zweig });
    const jahr = Number(satz.berichtsjahr) || (String(satz.stichtag || '').slice(0, 4) * 1) || null;
    const bewJahr = new Date().getFullYear();
    if (!jahr || jahr < bewJahr - LZS_AB.MAX_ALTER_JAHRE) return nein('K4: Berichtsjahr ' + (jahr || '-') + ' älter als ' + LZS_AB.MAX_ALTER_JAHRE + ' Jahre', { zweig: z.zweig });
    const fz = satz.fallzahl != null ? Number(satz.fallzahl) : null;
    if (fz != null && Number.isFinite(fz) && fz < LZS_AB.MIN_FALLZAHL) return nein('K5: ' + fz + ' Kauffälle (mindestens ' + LZS_AB.MIN_FALLZAHL + ')', { zweig: z.zweig });
    const og = Number(ma.objektgroesse_qm);
    const fl = Number(area);
    if (og > 0 && fl > 0 && (fl < og * LZS_AB.FLAECHE_MIN || fl > og * LZS_AB.FLAECHE_MAX)) {
      return nein('K7: Wohnfläche ' + Math.round(fl) + ' m² außerhalb des Modellrahmens (Ø ' + Math.round(og) + ' m², '
        + LZS_AB.FLAECHE_MIN + '- bis ' + LZS_AB.FLAECHE_MAX + '-fach)', { zweig: z.zweig });
    }
    const gnd = Number(ma.gnd_jahre || ma.gesamtnutzungsdauer_jahre || ma.gesamtnutzungsdauer || ma.gnd) || 80;
    const rr = rndEinheitlich(ref, gnd);
    const rnd = rr && rr.rnd != null ? Number(rr.rnd) : null;
    const rm = Number(ma.restnutzungsdauer_mittel);
    if (rnd != null && rm > 0 && Math.abs(rnd - rm) > LZS_AB.RND_ABW_MAX) {
      return nein('K7: RND ' + rnd + ' J. weicht mehr als ' + LZS_AB.RND_ABW_MAX + ' J. von der Ø RND ' + rm + ' J. ab', { zweig: z.zweig });
    }
    const pct = round((1 - kp / med) * 100, 1);
    if (!(pct >= LZS_AB.BAND_MIN && pct <= LZS_AB.BAND_MAX)) {
      return nein('K8: ' + String(pct).replace('.', ',') + ' % außerhalb des Bands ' + LZS_AB.BAND_MIN + ' bis ' + LZS_AB.BAND_MAX + ' %',
        { zweig: z.zweig, kaufpreis_eur_qm: kp, median_angebote: round(med, 0) });
    }
    const kurz = ausschussKurz(satz.gaa_name || z.ausschuss);
    const herkunft = 'örtlich gemessen: Ø Kaufpreis der Kauffälle des '
      + String(kurz || 'Gutachterausschusses').replace(/^Gutachterausschuss/, 'Gutachterausschusses') + ' ' + jahr
      + ' (' + Math.round(kp).toLocaleString('de-DE') + ' €/m²' + (fz ? ', ' + fz + ' Kauffälle' : '')   /* v2578a: kein Zweig-Kuerzel im Kundentext, es steht in pruefung_lzs */
      + ') gegen den Median der Angebote (' + Math.round(med).toLocaleString('de-DE') + ' €/m², ' + n + ' Angebote)';
    return { verwendet: true, pct, herkunft, quelle: 'liegenschaftszinssatz', ausschuss: kurz, berichtsjahr: jahr,
      kurz: (kurz || 'Gutachterausschuss') + ' ' + jahr, zweig: z.zweig, kaufpreis_eur_qm: kp, fallzahl: fz,
      median_angebote: round(med, 0), angebote: n, objektgroesse_qm: og || null, rnd_objekt: rnd, rnd_mittel: rm || null,
      register_ags: satz.ags || null, quelle_url: satz.quelle_url || null };
  } catch (e) { return nein('Fehler: ' + e.message); }
}
import { groessenanpassung as ukAusRegister, naeherung as ukNaeherung } from '../lib/umrechnung_flaeche.js';   /* v2282, v2288 */

// Zustands-/Energie-/Etagen-Faktoren (dokumentiert, anpassbar)
// Zustand robust gemappt inkl. Synonyme & DealPilot-Werte ("gut", "saniert", ...).
const CONDITION_FACTOR = {
  erstbezug: 1.08, neuwertig: 1.08, neu: 1.08, kernsaniert: 1.07,
  saniert: 1.05, modernisiert: 1.04, 'sehr gut': 1.04, sehr_gut: 1.04, 'sehr_gut': 1.04,
  gut: 1.0, gepflegt: 1.0, normal: 0.99, mittel: 0.96,
  renovierungsbeduerftig: 0.88, 'renovierungsbedürftig': 0.88,
  sanierungsbeduerftig: 0.82, 'sanierungsbedürftig': 0.82, unsaniert: 0.92, abrissreif: 0.70,
  /* v1444 · Backlog v22 Punkt 17: die Werte der App-Auswahl ds2_zustand kamen hier
     nicht vor und fielen still auf 1,0 - „neubau" wie „gepflegt", und
     „stark sanierungsbeduerftig" ebenso. Jetzt eindeutig zugeordnet. */
  neubau: 1.08, stark_sanierungsbeduerftig: 0.82, 'stark sanierungsbedürftig': 0.82,
};
// Ausstattungsqualität (einfach … luxuriös)
const QUALITY_FACTOR = { einfach: 0.93, normal: 1.0, gehoben: 1.06, luxurioes: 1.12, 'luxuriös': 1.12, luxus: 1.12 };
// Modernisierungsgrad
const MODERNIZATION_FACTOR = {
  kernsaniert: 1.08, 'umfassend modernisiert': 1.05, umfassend: 1.05,
  teilmodernisiert: 1.02, teilweise: 1.02, keine: 1.0,
  unsaniert: 0.95, original: 0.95, renovierungsstau: 0.90,
};
/* v2241 · Zustaende, die einen Instandsetzungsbedarf ausdruecken. Liegt
   dafuer ein Kostenbetrag (bOM) vor, entfaellt ihr Abschlag. */
const MANGEL_ZUSTAND = new Set(['renovierungsbeduerftig', 'renovierungsbedürftig', 'sanierungsbeduerftig',
  'sanierungsbedürftig', 'unsaniert', 'abrissreif', 'stark_sanierungsbeduerftig', 'stark sanierungsbedürftig']);
const MANGEL_MODERNISIERUNG = new Set(['unsaniert', 'original', 'renovierungsstau']);
const ENERGY_FACTOR = { 'A+': 1.06, A: 1.05, B: 1.03, C: 1.01, D: 1.0, E: 0.98, F: 0.95, G: 0.92, H: 0.9 };

const _norm = (v) => String(v ?? '').toLowerCase().trim();
const _lookup = (map, v, dflt = 1.0) => (map[_norm(v)] ?? dflt);
const _clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function floorFactor(floor, propertyType) {
  if (propertyType === 'haus' || floor == null) return 1.0;
  if (floor === 0) return 0.97;       // EG
  if (floor >= 4) return 1.02;        // höhere Lage leicht +
  return 1.0;
}

const _roundNice = (v) => {
  if (v == null) return v;
  const step = v >= 500000 ? 5000 : v >= 100000 ? 1000 : 500;
  return Math.round(v / step) * step;
};

/* ═══ v2241 · VERGLEICH FUER GEWERBE ════════════════════════════════════
   Nur mit Angeboten aus dem Segment Gewerbe DERSELBEN Klasse
   (MarketAnalysisService setzt `segment: 'gewerbe'`). Fehlt das, entfaellt
   der Vergleich — mit Grund, ohne Ersatz.

   Die Objektfaktoren oben (Zustand, Ausstattung, Energie, Etage, Balkon,
   Aufzug, Stellplaetze, Grundstuecks-Mehrflaeche) sind Festlegungen fuer
   WOHNraum. Fuer ein Buero oder eine Halle gibt es keine belegte
   Entsprechung; sie werden deshalb nicht angewandt. Gerechnet wird
   Median x Flaeche, Spanne aus den Quartilen, dazu ein bOM-Betrag, wenn
   einer vorliegt. Es bleibt eine Angebotsindikation (§ 25 Abs. 1:
   Kaufpreise, nicht Angebote) und heisst auch so. */
function gewerbeVergleich(ref, sale, area, out) {
  const ok = sale && sale.segment === 'gewerbe' && Number(sale.median_per_sqm) > 0;
  /* Mit Wohnteil (Geschaeftshaus mit Wohnungen) gibt es keine EINE
     Vergleichsklasse: der Gewerbemedian auf die Wohnflaeche waere
     derselbe Fehler wie bisher umgekehrt. */
  const _wohnteil = ref.gewerbe && Number(ref.gewerbe.wfl_wohnen) > 0;
  if (ok && area && _wohnteil) {
    out.vergleichswert_gesperrt = { grund: 'gemischte_nutzung',
      hinweis: 'Vergleichswert entfällt: das Objekt verbindet Gewerbe- und Wohnflächen ('
        + Math.round(Number(ref.gewerbe.wfl_wohnen)) + ' m² Wohnen). Für diese Mischung gibt es keine '
        + 'einheitliche Vergleichsgruppe; maßgeblich ist der Ertragswert.' };
    out.notes.push(out.vergleichswert_gesperrt.hinweis);
    return out;
  }
  if (!ok || !area) {
    out.vergleichswert_gesperrt = {
      grund: !ok ? 'keine_gewerbe_vergleichsdaten' : 'flaeche_fehlt',
      hinweis: !ok
        ? ('Vergleichswert entfällt: für dieses Gewerbeobjekt'
          + (ref.gewerbe_art ? '' : ' (Gewerbeart nicht bestimmt)')
          + ' liegen keine Vergleichsdaten aus dem Gewerbemarkt derselben Nutzung vor. '
          + 'Wohnungs- und Hauspreise sind dafür kein Maßstab und werden nicht ersatzweise verwendet.')
        : 'Vergleichswert entfällt: die Nutzfläche fehlt.',
    };
    out.notes.push(out.vergleichswert_gesperrt.hinweis);
    return out;
  }
  const base = Number(sale.median_per_sqm);
  const _b = Number(ref.bom_eur);
  const kosten = (ref.bom_eur != null && Number.isFinite(_b) && _b !== 0) ? Math.round(_b) : 0;
  const ev = base * area + kosten;
  out.factors = { location_factor: 1.0, condition_factor: 1.0, quality_factor: 1.0,
    modernization_factor: 1.0, object_adjustment: 1.0, amenity_factor: 1.0, energy_factor: 1.0,
    floor_factor: 1.0, vacancy_factor: 1.0, parking_value_eur: 0, land_excess_value_eur: 0,
    ...(kosten ? { kostenabzug_eur: kosten, kostenabzug_grund: ref.bom_grund || null } : {}) };
  out.market_value.estimated = _roundNice(ev);
  if (sale.q25_per_sqm != null && sale.q75_per_sqm != null) {
    out.market_value.low = _roundNice(sale.q25_per_sqm * area + kosten);
    out.market_value.high = _roundNice(sale.q75_per_sqm * area + kosten);
    out.market_value.range_basis = 'quartile';
  } else {
    /* Keine erfundene ±10-%-Spanne fuer Gewerbe: ohne Quartile keine Spanne. */
    out.market_value.low = null; out.market_value.high = null;
    out.market_value.range_basis = 'keine';
  }
  out.market_value.basis_median_sqm = round(base / 5, 0) * 5;
  out.market_value.confidence = sale.confidence;
  out.market_value.segment = 'gewerbe';
  out.market_value.gewerbe_klasse = sale.gewerbe_klasse || null;
  out.market_value.bezeichnung = 'Marktpreisindikation aus Gewerbeangeboten';
  const dc = sale.confidence != null ? sale.confidence : 0.5;
  /* Ohne Objektfaktoren und mit Angebotspreisen: gedaempft wie die
     pauschale Spanne im Wohnweg (0,82), nie hoeher als die Stichprobe. */
  const _conf = _clamp(dc * 0.82, 0, 0.98);
  out.market_value.confidence_pct = Math.round(_conf * 100);
  out.market_value.confidence_label = out.market_value.confidence_pct >= 85 ? 'Sehr hoch'
    : out.market_value.confidence_pct >= 70 ? 'Hoch' : out.market_value.confidence_pct >= 55 ? 'Mittel' : 'Niedrig';
  out.market_value.confidence_parts = { marktdaten: round(dc, 2), eingaben: null, streuung: 0.82 };
  out.notes.push('Gewerbe: Marktpreisindikation aus Angeboten der Klasse '
    + (sale.gewerbe_klasse || 'Gewerbe') + ' (Median ' + Math.round(base).toLocaleString('de-DE')
    + ' €/m² × ' + Math.round(area).toLocaleString('de-DE') + ' m²). Die Objektfaktoren für Wohnraum '
    + '(Zustand, Ausstattung, Energie, Etage, Stellplätze) sind nicht angewandt — für Gewerbe gibt es dafür '
    + 'keine belegten Ansätze. Angebotspreise sind keine Kaufpreise (§ 25 Abs. 1 ImmoWertV).');
  if (kosten) {
    out.notes.push((kosten < 0 ? 'Abzug' : 'Zuschlag') + ' besondere objektspezifische Grundstücksmerkmale: '
      + (kosten < 0 ? '− ' : '+ ') + Math.abs(kosten).toLocaleString('de-DE') + ' €'
      + (ref.bom_grund ? ' (' + ref.bom_grund + ')' : '') + ' (§ 8 Abs. 3 ImmoWertV).');
  }
  if (ref.purchase_price && ev > 0) {
    out.market_value.discount_to_market_pct = round((1 - ref.purchase_price / ev) * 100, 1);
  }
  return out;
}

export const ValuationService = {
  /* ═══ v2241 · UNBEBAUTES GRUNDSTUECK ═══════════════════════════════════
     Setzt den Bodenwert als Ergebnis ein. `bw` ist die Rueckgabe von
     ErtragswertService.bodenwert() — DER Bodenwert-Kern (Flaeche x BRW,
     Groessenanpassung, Zuschnitt, Erschliessungsbeitrag). Hier wird nichts
     gerechnet, nur ausgewiesen. Keine Spanne: der Bodenrichtwert ist ein
     Durchschnittswert der Zone, und eine Spanne darum waere erfunden. */
  grundstueck(valuation, bw, landValue, ref) {
    const v = valuation || {};
    v.market_value = {};
    v.notes = Array.isArray(v.notes) ? v.notes : [];
    if (!(bw && bw.vollstaendig && bw.wert != null)) {
      v.vergleichswert_gesperrt = { grund: 'bodenwert_fehlt',
        hinweis: 'Bodenwert nicht bestimmbar: '
          + ((bw && Array.isArray(bw.hinweise) && bw.hinweise.length) ? bw.hinweise.join(' ')
            : 'Grundstücksfläche oder Bodenrichtwert fehlt.') };
      v.notes.push(v.vergleichswert_gesperrt.hinweis);
      return v;
    }
    const q = Object.assign({}, bw.quelle || {});
    /* Bis v2390 setzte der Orchestrator `brw_quelle: 'boris'`, sobald landValue
       verfuegbar war — auch fuer den Rueckfall auf die eigene Eingabe
       (registry.js: source 'dealpilot-eingabe'). Seit v2390 liefert
       ErtragswertService.brwHerkunft() die echte Herkunft ('eigene_angabe');
       diese Zeile bleibt als Absicherung fuer aeltere Bodenwert-Ergebnisse. */
    if (landValue && landValue.source === 'dealpilot-eingabe') q.herkunft = 'eigene_angabe';
    v.vergleichswert_gesperrt = { grund: 'grundstueck',
      hinweis: 'Unbebautes Grundstück: Vergleichs-, Ertrags- und Sachwert entfallen; der Wert ist der Bodenwert.' };
    v.market_value = {
      estimated: bw.wert, low: bw.wert, high: bw.wert, range_basis: 'keine',
      verfahren: 'bodenwert', bezeichnung: 'Bodenwert (Bodenrichtwert × Fläche, § 40 Abs. 2 ImmoWertV)',
      basis_median_sqm: q.brw_sqm != null ? q.brw_sqm : null,
      brw_sqm: q.brw_sqm != null ? q.brw_sqm : null,
      brw_stichtag: q.stichtag || (landValue && landValue.stichtag) || null,
      brw_zone: q.zone || null,
      brw_herkunft: q.herkunft || null,
      flaeche_qm: Number(ref && ref.plot_area) || null,
      schritte: Array.isArray(bw.schritte) ? bw.schritte : [],
      hinweise: Array.isArray(bw.hinweise) ? bw.hinweise : [],
      confidence_pct: null,
      confidence_label: q.herkunft === 'boris' ? 'Bodenrichtwert' : 'Bodenrichtwert (eigene Angabe)',
    };
    if (ref && ref.purchase_price) {
      v.market_value.discount_to_market_pct = round((1 - ref.purchase_price / bw.wert) * 100, 1);
    }
    v.notes.push('Unbebautes Grundstück: Bodenwert '
      + Math.round(bw.wert).toLocaleString('de-DE') + ' € aus dem Bodenrichtwert '
      + (q.brw_sqm != null ? String(q.brw_sqm).replace('.', ',') + ' €/m² ' : '')
      + (q.herkunft === 'boris' ? '(amtlich)' : '(eigene Angabe)')
      + '. Abweichungen vom Richtwertgrundstück (Größe, Zuschnitt, Erschließung) sind nur berücksichtigt, '
      + 'soweit sie im Objekt angegeben sind.');
    return v;
  },

  // ref: {living_area, purchase_price, monthly_net_rent, condition, energy_class, floor,
  //       property_type, vacancy, plot_area}
  // sale: comparables-Stats (Kauf), rent: comparables-Stats (Miete)
  // landValue: BORIS-Bodenrichtwert ({available, value_sqm}) — fuer Grundstuecks-Mehrflaechenkorrektur (Haeuser)
  compute(ref, sale, rent, landValue = null) {
    const area = Number(ref.living_area) || null;
    const out = { inputs: {}, factors: {}, market_value: {}, yield: {}, notes: [] };

    // A) Kaufpreis pro m²
    out.inputs.price_per_sqm =
      ref.purchase_price && area ? round(ref.purchase_price / area, 2) : null;

    // B) Marktmiete pro m² (aus Vergleichsmieten)
    out.inputs.market_rent_sqm = rent && rent.median_per_sqm ? rent.median_per_sqm : null;

    // C/D/E) Renditekennzahlen
    const annualNetRent = ref.monthly_net_rent ? ref.monthly_net_rent * 12 : null;
    out.yield.annual_net_rent = annualNetRent ? round(annualNetRent, 0) : null;
    out.yield.gross_yield_pct =
      annualNetRent && ref.purchase_price
        ? round((annualNetRent / ref.purchase_price) * 100, 2)
        : null;
    out.yield.rent_multiplier =
      annualNetRent && ref.purchase_price ? round(ref.purchase_price / annualNetRent, 1) : null;

    /* ═══ v2241 · ZWEI OBJEKTARTEN OHNE WOHN-VERGLEICH ═══════════════════
       Unbebautes Grundstueck: kein Gebaeude, keine Wohnflaeche — der Wert
       ist der Bodenwert und wird im Orchestrator aus dem Bodenwert-Kern
       eingesetzt (grundstueck() unten). Gewerbe: NUR mit Vergleichsdaten
       aus dem Segment Gewerbe derselben Klasse. Bis hier rechnete ein
       Buero mit dem Median von Wohnungen und Haeusern. */
    const _ptV = _norm(ref.property_type);
    if (istGrundstueck(_ptV)) {
      out.inputs.market_rent_sqm = null;
      out.vergleichswert_gesperrt = { grund: 'grundstueck',
        hinweis: 'Unbebautes Grundstück: ein Vergleichswert aus Gebäudeangeboten entfällt. '
          + 'Der Wert ergibt sich aus dem Bodenwert (Bodenrichtwert × Fläche, § 40 Abs. 2 ImmoWertV).' };
      out.notes.push(out.vergleichswert_gesperrt.hinweis);
      return out;
    }
    if (istGewerbe(_ptV) || ref.gewerbe_art) {
      if (!(rent && rent.segment === 'gewerbe')) out.inputs.market_rent_sqm = null;
      return gewerbeVergleich(ref, sale, area, out);
    }

    /* v2241 · BESONDERE OBJEKTSPEZIFISCHE GRUNDSTUECKSMERKMALE (§ 8 Abs. 3).
       Sanierungs- oder Instandsetzungskosten aus dem Objekt (`san`) oder
       ein ausdruecklicher bOM-Ansatz. Sie wirken NACH den Marktfaktoren als
       Betrag. Der Zustandsabschlag druckt DENSELBEN Mangel als Prozentsatz
       aus — beides zusammen waere ein Doppelabzug. Liegt ein Abzug vor,
       entfaellt deshalb jeder ZustandsABSCHLAG (Faktor < 1); Zuschlaege
       bleiben, sie beschreiben keinen Mangel. Ohne bOM aendert sich hier
       nichts. */
    const _bomV = Number(ref.bom_eur);
    const kostenAbzug = (ref.bom_eur != null && Number.isFinite(_bomV) && _bomV !== 0) ? Math.round(_bomV) : 0;

    // F) Marktwert = Median-Vergleichspreis/m² * Fläche * Faktoren
    const base = sale && sale.median_per_sqm ? sale.median_per_sqm : null;
    if (base && area) {
      const locationFactor = 1.0; // später aus Makro/Mikro-Score ableitbar
      const condFactorRoh = _lookup(CONDITION_FACTOR, ref.condition);
      const qualFactor = _lookup(QUALITY_FACTOR, ref.quality);
      const modFactorRoh = _lookup(MODERNIZATION_FACTOR, ref.modernization);
      /* v2241: Abzug ODER Abschlag, nie beides. Nur die Stufen, die einen
         MANGEL beschreiben (renovierungs-/sanierungsbeduerftig, unsaniert,
         Renovierungsstau, abrissreif). „normal" (0,99) und „mittel" (0,96)
         sind Abnutzung im ueblichen Rahmen, kein Instandsetzungsbedarf —
         sie bleiben stehen. */
      const _mangelZ = kostenAbzug < 0 && MANGEL_ZUSTAND.has(_norm(ref.condition));
      const _mangelM = kostenAbzug < 0 && MANGEL_MODERNISIERUNG.has(_norm(ref.modernization));
      const condFactor = _mangelZ ? 1.0 : condFactorRoh;
      const modFactor = _mangelM ? 1.0 : modFactorRoh;
      if (_mangelZ || _mangelM) {
        out.notes.push('Zustandsabschlag nicht angesetzt (Faktor '
          + String(_mangelZ ? condFactorRoh : modFactorRoh).replace('.', ',') + '): für denselben Mangel ist ein Betrag von '
          + Math.abs(kostenAbzug).toLocaleString('de-DE') + ' € als besonderes objektspezifisches Grundstücksmerkmal '
          + 'abgezogen (§ 8 Abs. 3 ImmoWertV) — beides zusammen wäre ein Doppelabzug.');
      }
      const enFactor = ENERGY_FACTOR[(ref.energy_class || '').toUpperCase()] ?? 1.0;
      const flFactor = floorFactor(ref.floor, ref.property_type);
      const vacFactor = ref.vacancy ? 0.97 : 1.0;

      // Modernisierungsjahr verfeinert (falls angegeben) den Modernisierungs-Level.
      const _num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
      let modYearFactor = null;
      const modYear = _num(ref.modernization_year);
      if (modYear >= 1950 && modYear <= 2100) {
        const age = Math.max(0, new Date().getFullYear() - modYear);
        modYearFactor = age <= 5 ? 1.06 : age <= 15 ? 1.03 : age <= 30 ? 1.0 : 0.98;
      }
      const effModFactor = modYearFactor != null ? modYearFactor : modFactor;

      // Zustand × Qualität × Modernisierung überschneiden sich inhaltlich -> Teilprodukt
      // auf ±22 % deckeln (gegen Doppelzählung/Ausreißer beim Aufsummieren der Aufschläge).
      const objAdjRaw = condFactor * qualFactor * effModFactor;
      const objAdj = _clamp(objAdjRaw, 0.82, 1.22);

      // Ausstattungs-/Amenity-Faktor: NUR Aufschläge, getrennt vom Zustandsblock, separat gedeckelt
      // (Balkon/Terrasse, Garten, Aufzug, zweites Bad). Diese bewegen den Wert real, überschneiden
      // sich aber nicht mit Zustand/Qualität.
      const hasBalcony = _num(ref.balcony_area) > 0;
      const hasGarden = _num(ref.garden_area) > 0;
      const hasElevator = ref.elevator === true || _norm(ref.elevator) === 'true' || _norm(ref.elevator) === 'ja';
      const baths = _num(ref.bathrooms);
      let amenity = 1.0;
      if (hasBalcony) amenity *= 1.02;
      if (hasGarden) amenity *= 1.02;
      if (hasElevator) amenity *= (_num(ref.floor) >= 3 ? 1.03 : 1.02);
      if (baths >= 2) amenity *= 1.02;
      const amenityFactor = _clamp(amenity, 1.0, 1.12);

      // Stellplätze ADDITIV (eigenständiger Wert, nicht über €/m² skaliert). Pauschalen,
      // bewusst konservativ, da der Vergleichsmedian Parken teils schon enthält. Gedeckelt.
      const GARAGE_VALUE = 10000, OUTDOOR_VALUE = 4000;
      const parkingValue = _clamp(_num(ref.garages) * GARAGE_VALUE + _num(ref.outdoor_parking) * OUTDOOR_VALUE, 0, 30000);

      // GRUNDSTUECKS-MEHRFLAECHE (nur Haeuser): Der Vergleichsmedian €/m² Wfl preist ein
      // TYPISCHES EFH-Grundstueck mit ein. Uebergroesse (ueber ~650 m²) wird vom Markt
      // separat verguetet — additiv ueber den amtlichen Bodenrichtwert, mit Marktabschlag
      // (Uebergroesse wird nicht 1:1 bezahlt). Sanity-Deckel: max. 35 % des Vergleichswerts.
      /* v1071-WMFL-1 · Die 650 m2 und der Faktor 0,40 standen in keiner
       * Quelle. BORIS liefert die tatsaechliche Bezugsgroesse der Zone frei
       * Haus mit (Feld "Flaeche"; bei Loehner Strasse 278 sind es 700 m2,
       * nicht 650). Sie wird jetzt bevorzugt; die 650 bleiben nur als
       * Rueckfall, wenn BORIS nichts liefert — und der Hinweistext sagt,
       * welcher der beiden gegriffen hat. */
      const _bezugBoris = Number(
        (landValue && landValue.properties_raw
          && (landValue.properties_raw['Fläche'] || landValue.properties_raw.Flaeche)) || 0);
      const TYPICAL_PLOT_SQM = _bezugBoris > 0 ? _bezugBoris : 650;
      const TYPICAL_QUELLE = _bezugBoris > 0
        ? 'Bezugsgröße des Bodenrichtwertgrundstücks' : 'Annahme mangels Angabe';
      const EXCESS_MARKET_FACTOR = 0.40;
      const _pt = _norm(ref.property_type);
      const isHouse = _pt.includes('haus') || ['efh', 'dhh', 'rh', 'zfh', 'mfh'].includes(_pt);
      const plotArea = _num(ref.plot_area);
      const brwSqm = landValue && landValue.available && Number(landValue.value_sqm) > 0
        ? Number(landValue.value_sqm) : null;
      let landExcessValue = 0; let landComponent = null;
      if (isHouse && plotArea > 0 && brwSqm) {
        const excess = Math.max(0, plotArea - TYPICAL_PLOT_SQM);
        /* v2282 · Marcel 16.10.2026: „amtlich nur da, wo es auch so ist".
           Liegt ein amtlicher Umrechnungskoeffizient vor (Register, oder ein
           selbst eingetragener), ist die Mehrflaeche genau der Unterschied
           zwischen dem angepassten Bodenwert und dem Bodenwert des
           Richtwertgrundstuecks: Flaeche x BRW x UK - Bezugsgroesse x BRW.
           Nur ohne Koeffizient bleibt der eigene Marktfaktor 0,40 - mit dem
           Vermerk, dass er eine Festlegung von DealPilot ist. */
        let _ukV = null;
        if (_bezugBoris > 0 && excess > 0) {
          const _eigen = Number(ref.uk_flaeche);
          if (_eigen > 0 && _eigen < 3) {
            _ukV = { koeffizient: _eigen, quelle: 'eigene Angabe' };
          } else {
            try {
              const g = ukAusRegister({ ags: ref.ags || null, objektart: ref.property_subtype || ref.property_type,
                flaeche_qm: plotArea, bezugsgroesse_qm: _bezugBoris, brw_eur_qm: brwSqm,
                ortsteile: [((landValue && landValue.properties_raw) || {}).Ortsteil,
                            ((landValue && landValue.properties_raw) || {}).Gemarkungsname].filter(Boolean),   /* v2283 */
                mfh_uebertragen: true });   /* v2362 */
              if (g && g.verfuegbar) _ukV = { koeffizient: g.faktor, quelle: g.quelle, quelle_url: g.quelle_url || null };
              /* v2288 · ohne amtlichen Wert die DealPilot-Formel (nicht bei Minden, nicht
                 wo der Ausschuss eine andere Regel nennt - dann kommt g mit Grund zurueck). */
              else if ((!g || g.grund === 'kein_satz' || (g.grund === 'ausserhalb_geltung' && /mfh|mehrfam/i.test(String(ref.property_type || ''))))
                       && !String(ref.ags || '').startsWith('05770')) {   /* v2360: MFH -> Formel */
                const _pr = (landValue && landValue.properties_raw) || {};
                const n = ukNaeherung({ objektart: ref.property_subtype || ref.property_type, flaeche_qm: plotArea, bezugsgroesse_qm: _bezugBoris,
                  brw_eur_qm: brwSqm, geschosszahl: _pr.Geschosszahl || _pr.geschosszahl || null });
                if (n && n.verfuegbar) _ukV = { koeffizient: n.faktor, quelle: 'abgeleitet aus der DealPilot-Formel' };
              }
            } catch (e) { _ukV = null; }
          }
        }
        const raw = _ukV
          ? (plotArea * brwSqm * _ukV.koeffizient - _bezugBoris * brwSqm)
          : excess * brwSqm * EXCESS_MARKET_FACTOR;
        landExcessValue = Math.round(_clamp(raw, 0, base * area * 0.35));
        landComponent = {
          plot_area_sqm: plotArea, typical_plot_sqm: TYPICAL_PLOT_SQM,
          excess_sqm: excess, brw_sqm: brwSqm, market_factor: _ukV ? null : EXCESS_MARKET_FACTOR,
          umrechnungskoeffizient: _ukV ? _ukV.koeffizient : null,
          umrechnung_quelle: _ukV ? _ukV.quelle : null,
          value_eur: landExcessValue,
          land_value_total_eur: Math.round(plotArea * brwSqm * (_ukV ? _ukV.koeffizient : 1)),
        };
        if (landExcessValue > 0 && _ukV) {
          out.notes.push(`Grundstücks-Mehrfläche: ${plotArea} m² × BRW ${brwSqm} €/m² × Umrechnungskoeffizient ${String(_ukV.koeffizient).replace('.', ',')} (${_ukV.quelle}) − ${TYPICAL_PLOT_SQM} m² Richtwertgrundstück × ${brwSqm} €/m² = +${landExcessValue.toLocaleString('de-DE')} € (additiv).`);
        } else if (landExcessValue > 0) {
          out.notes.push(`Grundstücks-Mehrfläche: ${excess} m² über ${TYPICAL_PLOT_SQM} m² (${TYPICAL_QUELLE}) × BRW ${brwSqm} €/m² × Marktfaktor ${EXCESS_MARKET_FACTOR} = +${landExcessValue.toLocaleString('de-DE')} € (additiv). Der Marktfaktor ist eine Festlegung von DealPilot, keine Angabe des Gutachterausschusses.`);   /* v1071-WMFL-2 */
        }
      } else if (isHouse && plotArea > 0 && !brwSqm) {
        out.notes.push('Grundstücksfläche angegeben, aber kein Bodenrichtwert verfügbar – Mehrflächenkorrektur nicht berechenbar.');
      }
      out.land_component = landComponent;

      out.factors = {
        location_factor: locationFactor,
        condition_factor: condFactor,
        quality_factor: qualFactor,
        modernization_factor: round(effModFactor, 3),
        object_adjustment: round(objAdj, 3),
        amenity_factor: round(amenityFactor, 3),
        energy_factor: enFactor,
        floor_factor: flFactor,
        vacancy_factor: vacFactor,
        parking_value_eur: parkingValue || 0,
        land_excess_value_eur: landExcessValue || 0,
      };
      if (kostenAbzug) {
        /* v2241: nur wenn es einen gibt — sonst bleibt die Ausgabe wie bisher */
        out.factors.kostenabzug_eur = kostenAbzug;
        out.factors.kostenabzug_grund = ref.bom_grund || null;
        if (condFactor !== condFactorRoh) out.factors.condition_factor_ohne_abzug = condFactorRoh;
      }
      if (round(objAdjRaw, 3) !== round(objAdj, 3)) {
        out.notes.push(`Objektzuschlag (Zustand×Qualität×Modernisierung = ${round(objAdjRaw, 3)}) auf ${objAdj} gedeckelt (Plausibilität).`);
      }
      out.notes.push('Objektfaktoren (Zustand, Ausstattungsqualität, Modernisierung, Energie, Etage, Ausstattung) verschieben die Punkt-Indikation; Stellplätze fließen additiv ein; die Spanne bleibt datenbasiert (GeoMap-Quartile).');

      const factorProduct = locationFactor * objAdj * amenityFactor * enFactor * flFactor * vacFactor;
      /* v2241: der bOM-Betrag ist Teil des Additivs — er wirkt nach den
         Faktoren und in Punktwert UND Spanne gleich. */
      const additive = parkingValue + landExcessValue + kostenAbzug;
      let ev = base * area * factorProduct + additive;   /* v2367: let - der Angebotsabschlag mindert ihn */
      if (kostenAbzug) {
        out.notes.push((kostenAbzug < 0 ? 'Abzug' : 'Zuschlag') + ' besondere objektspezifische Grundstücksmerkmale: '
          + (kostenAbzug < 0 ? '− ' : '+ ') + Math.abs(kostenAbzug).toLocaleString('de-DE') + ' €'
          + (ref.bom_grund ? ' (' + ref.bom_grund + ')' : '') + ', nach den Marktfaktoren angesetzt (§ 8 Abs. 3 ImmoWertV).');
      }
      // Sinnvolles Runden gegen Scheingenauigkeit: Marktwerte auf 1.000er (kleine auf 500er,
      // grosse auf 5.000er), damit minimale Restschwankungen unsichtbar werden.
      const roundNice = (v) => {
        if (v == null) return v;
        const step = v >= 500000 ? 5000 : v >= 100000 ? 1000 : 500;
        return Math.round(v / step) * step;
      };
      out.market_value.estimated = roundNice(ev);
      // Spanne aus echten GeoMap-Quartilen (q25/q75), falls vorhanden; sonst pauschal ±10%.
      if (sale.q25_per_sqm != null && sale.q75_per_sqm != null) {
        out.market_value.low = roundNice(sale.q25_per_sqm * area * factorProduct + additive);
        out.market_value.high = roundNice(sale.q75_per_sqm * area * factorProduct + additive);
        out.market_value.range_basis = 'quartile';
      } else {
        out.market_value.low = roundNice(ev * 0.9);
        out.market_value.high = roundNice(ev * 1.1);
        out.market_value.range_basis = 'pauschal';
      }
      /* ══ v2367 · ANGEBOTSPREISE SIND KEINE KAUFPREISE ═════════════════════════
         § 25 Abs. 1 ImmoWertV: das Vergleichswertverfahren braucht Kaufpreise.
         Die Indikation steht auf Angebotspreisen und lag ohne Abschlag zu hoch -
         gemessen am 17.10.2026, Westerfeldstr. 140 (MFH Bielefeld): Angebotsmedian
         2.178 €/m², Ø Kaufpreis der 56 MFH-Kauffaelle 2025 laut Ausschuss
         1.820 €/m². Marcel 18.10.2026: „so, dass es den Normen und Gesetzen
         entspricht und nah an der Realitaet ist".
         Rangfolge des Abschlags:
           1. eigene Angabe des Nutzers (Investmentprofil, angebot_abschlag_pct)
           2. oertlich gemessen: Ø Kaufpreis der Kauffaelle des Ausschusses fuer
              dieses Segment gegen den Angebotsmedian (0 bis 25 %)
           3. recherchierter Marktdurchschnitt (5,8 %)
         Die Rohwerte bleiben im Ergebnis (angebot_abschlag.roh). */
      let _abPct = null, _abHerk = null, _rfSatz = null, _abMeta = null, _lzsPruef = null;   /* v2578: _abMeta, _lzsPruef */
      try {
        const _art = String(ref.property_type || '').toLowerCase();
        _rfSatz = (regFinde('rohertragsfaktor', ref.ags || null) || []).find((s) => s && s.vollstaendig !== false
          && (((s.geltungsbereich || {}).objektarten || []).indexOf(_art) >= 0)) || null;
        const _eigen = (ref.angebot_abschlag_pct == null || ref.angebot_abschlag_pct === '') ? NaN : Number(ref.angebot_abschlag_pct);
        const _kpQm = _rfSatz ? Number((_rfSatz.modellansaetze || {}).kaufpreis_eur_qm_mittel) : NaN;
        if (isFinite(_eigen) && _eigen >= 0 && _eigen < 50) { _abPct = _eigen; _abHerk = 'eigene Angabe'; }
        else if (_kpQm > 0 && Number(sale.median_per_sqm) > 0) {
          _abPct = round(Math.max(0, Math.min(25, (1 - _kpQm / Number(sale.median_per_sqm)) * 100)), 1);
          _abHerk = 'örtlich gemessen: Ø Kaufpreis der Kauffälle des Gutachterausschusses ('
            + Math.round(_kpQm).toLocaleString('de-DE') + ' €/m²) gegen den Median der Angebote ('
            + Math.round(Number(sale.median_per_sqm)).toLocaleString('de-DE') + ' €/m²)';
          /* v2578 · kurze Herkunft fuer die Zeile an der Zahl */
          const _rfK = ausschussKurz(_rfSatz.gaa_name || _rfSatz.ausschuss || null);
          _abMeta = { quelle: 'rohertragsfaktor', ausschuss: _rfK,
            berichtsjahr: _rfSatz.berichtsjahr || null,
            kurz: _rfK ? _rfK + (_rfSatz.berichtsjahr ? ' ' + _rfSatz.berichtsjahr : '') : null };
        } else {
          /* v2578 · zweite Quelle: Ø Kaufpreis des Liegenschaftszins-Satzes, nur mit K1-K8 (s. o.) */
          _lzsPruef = abschlagAusLzs(ref, sale, area);
          if (_lzsPruef && _lzsPruef.verwendet) {
            _abPct = _lzsPruef.pct; _abHerk = _lzsPruef.herkunft;
            _abMeta = { quelle: 'liegenschaftszinssatz', ausschuss: _lzsPruef.ausschuss,
              berichtsjahr: _lzsPruef.berichtsjahr, kurz: _lzsPruef.kurz };
          } else { _abPct = ANGEBOT_ABSCHLAG_MARKT_PCT; _abHerk = 'Marktdurchschnitt'; }
        }
      } catch (e) { _abPct = ANGEBOT_ABSCHLAG_MARKT_PCT; _abHerk = 'Marktdurchschnitt'; }
      if (_abPct > 0) {
        const _f = 1 - _abPct / 100;
        out.market_value.angebot_abschlag = { pct: _abPct, herkunft: _abHerk,
          roh: { estimated: out.market_value.estimated, low: out.market_value.low, high: out.market_value.high } };
        /* v2578 · Quelle kurz (Ausschuss + Jahrgang) und die interne Pruefung K1-K8 */
        if (_abMeta) Object.assign(out.market_value.angebot_abschlag, _abMeta);
        if (_lzsPruef) out.market_value.angebot_abschlag.pruefung_lzs = _lzsPruef;
        /* v2383 · Der Abschlag trifft nur den Teil, der aus ANGEBOTSPREISEN kommt. Mehrflaechen-
           Bodenwert (Bodenrichtwert), Stellplatzwert und bOM-Betrag sind keine Angebotspreise -
           bis v2382 wurden sie mit abgeschlagen (W: 15,9 % auch auf 43.615 € Bodenwert). */
        const _addAb = additive || 0;
        out.market_value.angebot_abschlag.nicht_abgeschlagen_eur = Math.round(_addAb);
        ev = (ev - _addAb) * _f + _addAb;
        out.market_value.estimated = roundNice(ev);
        if (out.market_value.low != null) out.market_value.low = roundNice((out.market_value.low - _addAb) * _f + _addAb);
        if (out.market_value.high != null) out.market_value.high = roundNice((out.market_value.high - _addAb) * _f + _addAb);
        out.notes.push('Abschlag auf Angebotspreise: ' + String(_abPct).replace('.', ',') + ' % (' + _abHerk + ')'
          + (_addAb ? ' — nur auf den Angebotsanteil; Mehrflächen-Bodenwert, Stellplätze und besondere Merkmale (' + Math.round(_addAb).toLocaleString('de-DE') + ' €) bleiben unberührt' : '') + '.');
      } else if (_abPct === 0) {
        /* v2490 · Auch ein Satz von 0 % (örtlich gemessen oder eigene Angabe) steht im
           Ergebnis. Ohne ihn hielten Karte und Verlauf den Wert für roh und zogen den
           Marktdurchschnitt von 5,8 % selbst ab - der Abschlag, den der Bericht bewusst
           NICHT gemacht hat. */
        out.market_value.angebot_abschlag = { pct: 0, herkunft: _abHerk, nicht_abgeschlagen_eur: 0,
          roh: { estimated: out.market_value.estimated, low: out.market_value.low, high: out.market_value.high } };
        if (_abMeta) Object.assign(out.market_value.angebot_abschlag, _abMeta);   /* v2578 */
        if (_lzsPruef) out.market_value.angebot_abschlag.pruefung_lzs = _lzsPruef;
      }
      /* v2367 · AMTLICHE GEGENPROBE - wo der Ausschuss fuer dieses Segment einen
         Rohertragsfaktor und den Ø Kaufpreis seiner Kauffaelle veroeffentlicht.
         Rohertrag: Ist-Miete, sonst Angebotsmiete (gekennzeichnet). */
      if (_rfSatz) {
        const _ma = _rfSatz.modellansaetze || {};
        const _rf = Number((_rfSatz.formel || {}).wert);
        const _istJahr = (!ref.vacancy && Number(ref.monthly_net_rent) > 0) ? Number(ref.monthly_net_rent) * 12 : null;
        const _mktJahr = (rent && Number(rent.median_per_sqm) > 0) ? Number(rent.median_per_sqm) * area * 12 : null;
        const _roh = _istJahr || _mktJahr;
        const _g = _rfSatz.geltungsbereich || {};
        out.amtliche_gegenprobe = {
          ausschuss: _rfSatz.gaa_name || null, quelle_url: _rfSatz.quelle_url || null, seite: _rfSatz.seite || null,
          berichtsjahr: _rfSatz.berichtsjahr || null, datengrundlage_jahr: _ma.datengrundlage_jahr || null,
          rohertragsfaktor: _rf > 0 ? _rf : null, rohertrag_eur: _roh ? Math.round(_roh) : null,
          rohertrag_basis: _istJahr ? 'Ist-Miete' : (_mktJahr ? 'Angebotsmiete' : null),
          wert_rohertragsfaktor_eur: (_rf > 0 && _roh) ? roundNice(_rf * _roh) : null,
          kaufpreis_eur_qm_mittel: Number(_ma.kaufpreis_eur_qm_mittel) || null, kaufpreis_vertraege: _ma.kaufpreis_vertraege || null,
          wert_kaufpreis_mittel_eur: (Number(_ma.kaufpreis_eur_qm_mittel) > 0 && area > 0) ? roundNice(Number(_ma.kaufpreis_eur_qm_mittel) * area) : null,
          miete_eur_qm_mittel: _ma.nettokaltmiete_eur_qm_mittel || null,
          geltung: { brw_von: _g.brw_von || null, brw_bis: _g.brw_bis || null, baujahr_von: _g.baujahr_von || null, baujahr_bis: _g.baujahr_bis || null },
          hinweis: 'Durchschnittswerte des Gutachterausschusses aus tatsächlichen Kauffällen — eine Gegenprobe, kein Verkehrswert.',
        };
      }
      out.market_value.basis_median_sqm = round(base / 5, 0) * 5; // €/m² auf 5er
      out.market_value.confidence = sale.confidence;

      // Aussagekraft = Marktdaten-Konfidenz (Stichprobe) × Vollstaendigkeit der werttreibenden
      // Objektangaben. Mehr Angaben -> hoehere Indikations-Konfidenz (objektspezifischer).
      const PRECISION = [
        ['condition', 'Zustand'], ['quality', 'Ausstattungsqualität'],
        ['modernization', 'Modernisierung'], ['energy_class', 'Energieklasse'],
      ];
      const has = (k) => { const v = ref[k]; if (v == null) return false; const s = String(v).trim().toLowerCase(); return s !== '' && s !== 'nan' && s !== 'null'; };
      const filled = PRECISION.filter(([k]) => has(k));
      const completeness = filled.length / PRECISION.length;
      const dataConf = sale.confidence != null ? sale.confidence : 0.5;

      /* v948-spread
       * ────────────────────────────────────────────────────────────────────
       * Bis v947 war die Aussagekraft = Stichprobe x Eingabe-Vollstaendigkeit.
       * Die STREUUNG kam nicht vor. Real auf Prod: Marktwert 197.000 € bei einer
       * Spanne von 146.000-272.000 € (Faktor 1,86) -> "Aussagekraft: Hoch · 80 %".
       * Bei der Spanne ist der Punktwert eine Orientierung, keine Aussage.
       *
       * Bezug ist (high-low)/estimated: die Breite RELATIV zu der Aussage, die
       * getroffen wird. Nicht high/low — ein Verhaeltnis sagt nichts darueber,
       * wie weit der Punkt danebenliegen kann.
       *   bis 25 %  -> voll (typische Quartilsbreite, homogener Markt)
       *   darueber  -> linearer Abschlag, Boden 0,45
       *
       * PAUSCHALE Spanne (kein q25/q75 -> +/-10 % erfunden): die ist rechnerisch
       * die engste von allen und bekaeme sonst die BESTE Note. Verkehrt herum —
       * keine Quartile heisst weniger Wissen, nicht mehr. Eigener Abschlag.
       */
      let spreadFactor = 1.0, spreadPct = null;
      if (out.market_value.range_basis === 'pauschal') {
        spreadFactor = 0.82;
        out.notes.push('Keine Vergleichsquartile verfügbar – Spanne pauschal mit ±10 % angesetzt. Die Aussagekraft ist deshalb gedämpft: eine erfundene Spanne ist kein Beleg für Genauigkeit.');
      } else if (out.market_value.low != null && out.market_value.high != null && ev > 0) {
        spreadPct = (out.market_value.high - out.market_value.low) / ev;
        spreadFactor = _clamp(1 - Math.max(0, spreadPct - 0.25) * 1.2, 0.45, 1.0);
      }
      out.market_value.spread_pct = spreadPct != null ? round(spreadPct * 100, 1) : null;
      out.market_value.spread_factor = round(spreadFactor, 2);
      out.market_value.spread_label =
        spreadPct == null ? null
        : spreadPct <= 0.25 ? 'eng'
        : spreadPct <= 0.40 ? 'normal'
        : spreadPct <= 0.60 ? 'weit' : 'sehr weit';
      if (spreadPct != null && spreadPct > 0.40) {
        out.notes.push(
          'Vergleichsspanne ' + Math.round(spreadPct * 100) + ' % des Marktwerts (' +
          Math.round(out.market_value.low).toLocaleString('de-DE') + ' – ' +
          Math.round(out.market_value.high).toLocaleString('de-DE') + ' €). Der Punktwert ist bei dieser Streuung ' +
          'eine Orientierung, keine Aussage — die Aussagekraft ist entsprechend gemindert. ' +
          'Für Kalkulation und Beleihung ist das untere Ende die belastbare Größe.'
        );
      }

      const combined = _clamp(dataConf * (0.78 + 0.22 * completeness) * spreadFactor, 0, 0.98);
      out.market_value.data_confidence = round(dataConf, 2);
      out.market_value.input_filled = filled.length;
      out.market_value.input_total = PRECISION.length;
      out.market_value.input_completeness = round(completeness, 2);
      out.market_value.input_missing = PRECISION.filter(([k]) => !has(k)).map(([, l]) => l);
      /* v948-spread: nachvollziehbar statt Blackbox — wer 43 % liest, soll sehen warum. */
      out.market_value.confidence_parts = {
        marktdaten: round(dataConf, 2),
        eingaben: round(0.78 + 0.22 * completeness, 2),
        streuung: round(spreadFactor, 2),
      };
      out.market_value.confidence_pct = Math.round(combined * 100);
      out.market_value.confidence_label =
        out.market_value.confidence_pct >= 85 ? 'Sehr hoch'
        : out.market_value.confidence_pct >= 70 ? 'Hoch'
        : out.market_value.confidence_pct >= 55 ? 'Mittel' : 'Niedrig';

      // Preisabschlag/-aufschlag ggü. Marktwert
      if (ref.purchase_price) {
        const disc = (1 - ref.purchase_price / ev) * 100; // >0 = unter Marktwert (Schnäppchen)
        out.market_value.discount_to_market_pct = round(disc, 1);
      }
    } else {
      out.notes.push('Kein Vergleichs-Kaufpreis vorhanden – Marktwert nicht belastbar berechenbar.');
    }

    return out;
  },
};
