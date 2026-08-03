// v564-neutralized: Anbieternamen aus provenance + steps entfernt
// ReportOrchestrator.js — orchestriert die gesamte Bericht-Pipeline.
import { q, q1 } from '../lib/db.js';
import { cfg, geomapEnabled, geoEnabled } from '../lib/config.js';
import { GeocodingService } from './GeocodingService.js';
import { MarketAnalysisService } from './MarketAnalysisService.js';
import { MicroLocationService } from './MicroLocationService.js';
import { ValuationService } from './ValuationService.js';
/* WPARAM-2 */
import { WertParameterService } from './WertParameterService.js';
/* WGAA-2 */
import { HarvestService } from './HarvestService.js';
/* WKIGEG-4 */
import { KiGegenrechnungService } from './KiGegenrechnungService.js';
import { ErtragswertService } from './ErtragswertService.js';
import { CrossCheckService } from './CrossCheckService.js';
/* v1070-WUK-4 · Umrechnungskoeffizienten und Hinterland-Abgrenzung. */
import { flaechenaufteilung, manuelleAufteilung } from '../lib/umrechnung_nrw.js';
/* v1073-WGAA-4 · Vorschlag fuer den Gartenland-Wertansatz aus dem
 * zustaendigen Grundstuecksmarktbericht. */
import { gartenland as gartenlandVorschlag, zustaendig as gaaZustaendig }
  from '../lib/gutachterausschuss.js';
import { ScoringService } from './ScoringService.js';
import { ReportGenerationService } from './ReportGenerationService.js';
import { DestatisConnector } from '../connectors/stubConnectors.js';
import { BorisConnector } from '../connectors/BorisConnector.js';
import { DealPilotObjectMapper } from './DealPilotObjectMapper.js';
import { MarketInsightsService } from './MarketInsightsService.js';
import { GeoMapConnector } from '../connectors/GeoMapConnector.js';
import { IrwConnector } from '../connectors/IrwConnector.js';
import { marktmiete as amtlicheMiete } from '../lib/mietmodell_nrw.js';   /* v1059-WMIET-1 */
import { vergleichsfaktor as amtlicherVf } from '../lib/vergleichsfaktoren_nrw.js';   /* v1060-WVF-1 */   /* v1053-WIRW-1 */
import { AgsResolver } from '../connectors/AgsResolver.js';
import { ZensusConnector } from '../connectors/ZensusConnector.js';

export const ReportOrchestrator = {
  async generate(input, opts = {}) {
    // input: { address, property_type, usage_type, living_area, rooms, build_year,
    //          floor, condition, energy_class, purchase_price, monthly_net_rent, vacancy }
    const trace = [];
    const t0 = Date.now();
    const step = (msg) => {
      const line = `[bericht +${Date.now() - t0}ms] ${msg}`;
      console.log(line);
      trace.push(msg);
      if (opts && typeof opts.onStep === 'function') { try { opts.onStep(msg); } catch {} }
    };
    step('START generate');
    const FAST = !!(input.fast || input.schnell); // Schnell-Modus: nur Kauf+Miete, kein KI-Text/keine Historie
    if (FAST) step('SCHNELL-MODUS: nur Marktwert+Spanne & Miete+Spanne (kein KI-Text, keine Preishistorie)');

    // 0) DealPilot-Objekt (.dpkt) als Quelle? -> Stammdaten + Score/KI uebernehmen.
    //    Lage-/Potenzialbewertungen kommen NICHT aus der Eingabe, sondern aus echten APIs (s.u.).
    let dealpilotMeta = null;
    if (input.dealpilot) {
      const mapped = DealPilotObjectMapper.reportInput(input.dealpilot);
      for (const k of Object.keys(mapped)) {
        if (input[k] == null || input[k] === '') input[k] = mapped[k];
      }
      dealpilotMeta = DealPilotObjectMapper.dealpilot(input.dealpilot);
      step(`dealpilot: Stammdaten übernommen${dealpilotMeta ? ' +Score/KI' : ''}`);
    }

    // 1) Geocoding
    let geo = null;
    if (input.address) {
      step('Standort wird ermittelt …');
      geo = await GeocodingService.geocode(input.address);
      step(`geocode: ${geo ? 'ok lat=' + geo.lat + ' lon=' + geo.lon : 'fehlgeschlagen'}`);
    }
    const lat = geo?.lat ?? input.lat;
    const lon = geo?.lon ?? input.lon;
    if (lat == null || lon == null) {
      const err = new Error('Keine Koordinaten – Adresse nicht geokodierbar und keine lat/lon angegeben.');
      err.status = 422;
      throw err;
    }

    const ref = {
      address: input.address,
      lat, lon,
      property_type: input.property_type || null,
      usage_type: input.usage_type || null,
      living_area: input.living_area ? Number(input.living_area) : null,
      rooms: input.rooms ? Number(input.rooms) : null,
      build_year: input.build_year ? Number(input.build_year) : null,
      floor: input.floor != null ? Number(input.floor) : null,
      condition: input.condition || null,
      quality: input.quality || null,
      modernization: input.modernization || null,
      modernization_year: input.modernization_year ? Number(input.modernization_year) : null,
      energy_class: input.energy_class || null,
      bathrooms: input.bathrooms ? Number(input.bathrooms) : null,
      balcony_area: input.balcony_area ? Number(input.balcony_area) : null,
      garden_area: input.garden_area ? Number(input.garden_area) : null,
      plot_area: input.plot_area ? Number(input.plot_area) : null,
      units: input.units ? Number(input.units) : null,
      elevator: input.elevator === true || input.elevator === 'true' || input.elevator === 'ja' || false,
      garages: input.garages ? Number(input.garages) : null,
      outdoor_parking: input.outdoor_parking ? Number(input.outdoor_parking) : null,
      purchase_price: input.purchase_price ? Number(input.purchase_price) : null,
      monthly_net_rent: input.monthly_net_rent ? Number(input.monthly_net_rent) : null,
      vacancy: !!input.vacancy,
      // Manuell in DealPilot eingegebener Bodenrichtwert (Feld "brw") als BORIS-Fallback
      land_value_manual: input.land_value_manual ?? input.brw ?? null,

      /* WREF-1 · Wertermittlung Stufe 2/3. Diese Felder fehlten hier komplett:
       * das Frontend schickte sie, der Orchestrator liess sie fallen. Sichtbar
       * wurde es daran, dass Neubau und Bestand denselben Wert lieferten —
       * ref.baustatus war undefined, also griff der Erstbezug-Filter nie. */
      baustatus: input.baustatus || null,
      first_time_use: input.first_time_use === true || input.first_time_use === 'true' || null,
      refurbished: input.refurbished === true || input.refurbished === 'true' || null,
      reconstruction_year: input.reconstruction_year ? Number(input.reconstruction_year) : null,
      mea_pct: input.mea_pct ? Number(input.mea_pct) : null,
      lzs_pct: input.lzs_pct ? Number(input.lzs_pct) : null,
      brw_anpassung_pct: input.brw_anpassung_pct ? Number(input.brw_anpassung_pct) : null,
      brw_anpassung_grund: input.brw_anpassung_grund || null,
      gfz_koeff: input.gfz_koeff ? Number(input.gfz_koeff) : null,
      beitrag_abzug_eur: input.beitrag_abzug_eur ? Number(input.beitrag_abzug_eur) : null,
      stellplatz_miete_monat: input.stellplatz_miete_monat ? Number(input.stellplatz_miete_monat) : null,
      bwk_modus: input.bwk_modus || null,
      bog_eur: input.bog_eur ? Number(input.bog_eur) : null,
      bog_grund: input.bog_grund || null,
      wert_stufe: input.wert_stufe ? Number(input.wert_stufe) : 1,
      /* WNHK-3 · Sachwertfelder aus dem Formular */
      nhk_typ: input.nhk_typ || null,
      keller_dg: input.keller_dg || null,
      standardstufe: input.standardstufe ? Number(input.standardstufe) : null,
      /* v1055-WFELD-2 · Grundrissart und Modernisierungspunkte. Die
       * Standardstufe stand hier schon; diese beiden nicht. */
      grundriss: input.grundriss || null,
      /* v1057-WSON-6 */
      sonstige_jahr: input.sonstige_jahr ? Number(input.sonstige_jahr) : null,
      sonstige_dauer_jahre: input.sonstige_dauer_jahre ? Number(input.sonstige_dauer_jahre) : null,
      mod_punkte: input.mod_punkte != null && input.mod_punkte !== ''
        ? Number(input.mod_punkte) : null,
      bgf: input.bgf ? Number(input.bgf) : null,
      regionalfaktor: input.regionalfaktor ? Number(input.regionalfaktor) : null,
      sachwertfaktor: input.sachwertfaktor ? Number(input.sachwertfaktor) : null,
      bes_bauteile: input.bes_bauteile ? Number(input.bes_bauteile) : null,
      /* v1071-WHIN-3 · Zusaetzliche Grundstuecksflaeche mit eigenem Ansatz. */
      hinterland_qm: input.hinterland_qm ? Number(input.hinterland_qm) : null,
      hinterland_eur_qm: input.hinterland_eur_qm ? Number(input.hinterland_eur_qm) : null,
      hinterland_rentierlich: input.hinterland_rentierlich === true
        || input.hinterland_rentierlich === 'ja',   /* v1072-WREN-5 */
      /* v1072-WGAR-4 · Garage als eigene bauliche Anlage. */
      garagen_bgf_qm: input.garagen_bgf_qm ? Number(input.garagen_bgf_qm) : null,
      garagen_stufe: input.garagen_stufe ? Number(input.garagen_stufe) : null,
      aussenanlagen_pct: input.aussenanlagen_pct ? Number(input.aussenanlagen_pct) : null,
      aussenanlagen: input.aussenanlagen ? Number(input.aussenanlagen) : null,
      /* v1074-WAUS9-3 · Die ref-Liste ist ausdruecklich — wer hier fehlt,
       * kommt nicht an (Lehre aus v1071). */
      ausstattung: (input.ausstattung && typeof input.ausstattung === 'object') ? input.ausstattung : null,
      bauteile_hk: input.bauteile_hk ? Number(input.bauteile_hk) : null,
      bauteile_detail: (input.bauteile_detail && typeof input.bauteile_detail === 'object') ? input.bauteile_detail : null,
      /* WBW26-3 · aus den Objekt-Tabs Bewirtschaftung und Miete */
      instandhaltung_ruecklage_jahr: input.instandhaltung_ruecklage_jahr
        ?? input.inst ?? input.instandhaltung ?? null,
      leerstand_pct: input.leerstand_pct ?? input.leerstand ?? input.mietausfall ?? null,
    };

    // 2) Property persistieren
    step('property: insert');
    const prop = await q1(
      `INSERT INTO mb.properties
        (external_ref,address_id,property_type,usage_type,living_area,rooms,build_year,floor,
         condition,energy_class,purchase_price,monthly_net_rent,vacancy,lat,lon,geom,data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
         ST_SetSRID(ST_MakePoint($15,$14),4326), $16)
       RETURNING id`,
      [input.external_ref || null, geo?.address_id || null, ref.property_type, ref.usage_type,
       ref.living_area, ref.rooms, ref.build_year, ref.floor, ref.condition, ref.energy_class,
       ref.purchase_price, ref.monthly_net_rent, ref.vacancy, lat, lon, JSON.stringify(input)]
    );
    const propertyId = prop.id;

    // 3-5b) ALLE Quellen-Calls PARALLEL (V-PERF, Option 2):
    //   Vorher liefen getBalance -> Kauf/Miete -> Mikro -> Insights -> AGS/Destatis -> BORIS
    //   seriell hintereinander (~8 Netz-Roundtrips). Jetzt eine Welle.
    //   Einzige Abhaengigkeit: insights braucht micro -> haengt an microP.
    //   Jeder Strang meldet sich per step(), sobald er fertig ist -> Live-Fortschritt.
    step('Marktdaten werden geladen …');

    const balanceBeforeP = GeoMapConnector.getBalance().catch(() => null);

    const saleP = MarketAnalysisService.saleLevel(ref)
      .then((r) => { step(`Vergleichspreise: ${r.sample_size} Objekte`); return r; });
    const rentP = MarketAnalysisService.rentLevel(ref)
      .then((r) => { step(`Vergleichsmieten: ${r.sample_size} Objekte`); return r; });

    const microP = MicroLocationService.analyze(lat, lon, 2000)
      .then((r) => { step(`Mikrolage: Score ${r.score}`); return r; });

    // insights haengt an micro (braucht den Mikrolage-Output):
    const insightsP = FAST
      ? Promise.resolve(null) // Schnell-Modus: keine GeoMap-Preishistorie-Abrufe
      : microP
      .then((m) => MarketInsightsService.derive(ref, m))
      .then((ins) => {
        if (ins) step('Markttrend wird analysiert …');
        return ins;
      })
      .catch((e) => { step('insights: fehler ' + e.message); return null; });

    // AGS einmal aufloesen (OpenPLZ) und an Makro UND Zensus teilen -> beide bleiben parallel.
    const agsP = AgsResolver.fromPostcode(geo?.components?.postcode).catch(() => null);

    // Makro-Kette (Destatis) als eigener paralleler Strang:
    // v784-fast-macro: im Schnell-Modus ueberspringen (Destatis haengt ~5,6s, liefert hier eh keine Daten).
    const macroP = FAST
      ? Promise.resolve({ agsInfo: null, macroRaw: { available: false, reason: 'schnell-modus' } })
      : (async () => {
      const agsInfo = await agsP;
      const macroRaw = await DestatisConnector.macro({ ags: agsInfo?.kreis_ags, city: geo?.components?.city });
      step(`Makrolage: ${macroRaw.available ? 'ausgewertet' : 'keine Daten'}`);
      return { agsInfo, macroRaw };
    })().catch((e) => { step('macro: fehler ' + e.message); return { agsInfo: null, macroRaw: { available: false, reason: e.message } }; });

    // Zensus 2022 (Leerstand/Eigentuemerquote/Ø-Miete, gratis offline-CSV) als eigener Strang:
    const zensusP = (async () => {
      const agsInfo = await agsP;
      const z = ZensusConnector.lookup(agsInfo?.kreis_ags);
      step(`Strukturdaten: ${z.available ? 'ausgewertet' : 'keine Daten'}`);
      return z;
    })().catch((e) => { step('zensus: fehler ' + e.message); return { available: false, source: 'zensus2022', reason: e.message }; });

    // Bodenrichtwert (BORIS-NRW, echt; nur NRW) als eigener paralleler Strang:
    const borisP = (async () => {
      const lv = await BorisConnector.landValue({ lat, lon, manualBrw: ref.land_value_manual });
      step(`Bodenrichtwert: ${lv && lv.available ? lv.value_sqm + ' EUR/m²' : 'keine Daten'}`);
      return lv;
    })().catch((e) => { step('boris: fehler ' + e.message); return null; });

    const [balanceBefore, sale, rent, micro, insights, macroBundle, zensus, landValue] =
      await Promise.all([balanceBeforeP, saleP, rentP, microP, insightsP, macroP, zensusP, borisP]);

    const macroRaw = macroBundle.macroRaw;
    const macro = ScoringService.macroScore(macroRaw.metrics || null);

    // Bewertungen aus ECHTEN Quellen zusammenfuehren (keine Nutzereingabe).
    let assessment = (insights && insights.assessment) ? { ...insights.assessment } : null;
    if (macroRaw.available && macro && macro.estimated === false && macro.score != null) {
      assessment = assessment || {};
      assessment.makrolage = macro.score >= 60 ? 'gut' : macro.score >= 45 ? 'durchschnittlich' : 'schwach';
    }
    // Zensus-Leerstand qualitativ in die Bewertung (niedriger Leerstand = gut vermietbar):
    if (zensus && zensus.available && zensus.leerstandsquote != null) {
      assessment = assessment || {};
      const ls = zensus.leerstandsquote;
      assessment.leerstand_zensus = ls < 3 ? 'niedrig' : ls < 6 ? 'moderat' : 'erhöht';
    }

    // 6) Bewertung (inkl. Grundstuecks-Mehrflaechenkorrektur ueber BORIS-BRW)
    const valuation = ValuationService.compute(ref, sale, rent, landValue);

    /* WPARAM-1 · Wertermittlungsparameter nach der Abdeckungs-Kaskade
     * (A amtlich kreisscharf ... D gesetzlicher Auffangwert, E Nutzereingabe).
     * Faellt der Lesezugriff aus, rechnet der Quercheck mit seinen Pauschalen
     * weiter — der Bericht darf an einem fehlenden Parameter nicht scheitern. */
    let _wertParams = null;

    /* v1047-WAGS-1 · Ohne Schluessel laeuft die ganze Kaskade ins Leere.
     * ref.ags ist leer — das Formular kennt kein solches Feld. Der
     * Schluessel liegt aber zweimal vor:
     *   BORIS  properties_raw.Gemeindekennzeichen  (8-stellig, exakt)
     *   PLZ    AgsResolver.fromPostcode()          (5-stellig, Kreis)
     * Beide wurden bisher fuer anderes benutzt. Reihenfolge: genauer zuerst. */
    let _agsWert = String(ref.ags || '').replace(/\D/g, '');
    if (!_agsWert) {
      const _bp0 = (landValue && landValue.properties_raw) || {};
      _agsWert = String(_bp0.Gemeindekennzeichen || _bp0.gemeindekennzeichen
        || _bp0['Gemeindeschlüssel'] || _bp0.Gemeindeschluessel || '').replace(/\D/g, '');
    }
    if (!_agsWert) {
      try {
        const _ai = await agsP;
        _agsWert = String((_ai && (_ai.gemeinde_ags || _ai.kreis_ags)) || '').replace(/\D/g, '');
      } catch (e) { /* ohne Schluessel bleibt es beim Auffangwert */ }
    }
    step('wertparameter: ags=' + (_agsWert || 'KEINER'));

    /* v1053-WIRW-2 · Immobilienrichtwert. Anders als der Vergleichswert
     * aus Inseraten stammt er aus beurkundeten Kaufpreisen — Paragraf 20
     * ImmoWertV. Beim Wohnungseigentum einschliesslich Miteigentumsanteil.
     * Faellt der Abruf aus, laeuft der Bericht unveraendert weiter: eine
     * zusaetzliche Quelle darf nie das Ganze kippen. */
    /* v1059-WMIET-2 · Die Miete, auf der der Ausschuss seinen Zinssatz
     * abgeleitet hat. Sie wird IMMER gerechnet, auch wenn sie nicht fuehrt —
     * der Vergleich mit der Portalmiete ist selbst eine Aussage. */
    let _amtMiete = null;
    try {
      const _bp3 = (landValue && landValue.properties_raw) || {};
      const _gem = _bp3.Gemeinde || _bp3.GENA
        || (address && (address.city || address.town)) || null;
      if (_gem && ref.build_year && ref.living_area) {
        const _kl = ref.mod_punkte != null
          ? (Number(ref.mod_punkte) <= 1 ? 1 : Number(ref.mod_punkte) <= 5 ? 2
             : Number(ref.mod_punkte) <= 10 ? 3 : Number(ref.mod_punkte) <= 17 ? 4 : 5)
          : null;
        const _lage = _bp3.Lagebeurteilung != null
          ? (Number(_bp3.Lagebeurteilung) >= 4 ? 'sehr_gut'
             : Number(_bp3.Lagebeurteilung) === 3 ? 'gut'
             : Number(_bp3.Lagebeurteilung) === 2 ? 'mittel' : 'einfach')
          : 'mittel';
        _amtMiete = amtlicheMiete({
          ags: ref.ags || null,   /* v1071-WZUS-5 */
          gemeinde: _gem, baujahr: ref.build_year, wohnflaeche_qm: ref.living_area,
          modernisierung_klasse: _kl,
          kernsaniert: /kernsaniert/i.test(String(ref.modernization || ''))
            && Number(ref.mod_punkte || 0) >= 18,
          sanierungsjahr: ref.modernization_year || null,
          wohnlage: _lage, stichtag_jahr: (new Date()).getFullYear(),
        });
        step('amtliche miete: ' + (_amtMiete.verfuegbar
          ? _amtMiete.miete_qm + ' EUR/m2 (fiktives Bj ' + _amtMiete.fiktives_baujahr + ')'
          : 'keine (' + _amtMiete.grund + ')'));
      }
    } catch (e) { _amtMiete = null; }

    /* v1060-WVF-2 · Der Vergleichsfaktor des Ausschusses. Anders als der
     * Immobilienrichtwert liegt er fuer Minden-Luebbecke vor — als Tabelle
     * im Marktbericht statt als Geodatensatz. Dieselbe Rechtsgrundlage:
     * Paragraf 20 ImmoWertV, abgeleitet aus der Kaufpreissammlung. */
    let _amtVf = null;
    try {
      const _bp4 = (landValue && landValue.properties_raw) || {};
      const _gem4 = _bp4.Gemeinde || _bp4.GENA
        || (address && (address.city || address.town)) || null;
      if (_gem4 && ref.build_year && ref.living_area) {
        _amtVf = amtlicherVf({
          /* v1071-WZUS-6 · Ohne diesen Parameter blieb die Pruefung im Modul
           * wirkungslos — der Weg von A nach B, den node --check nie findet. */
          ags: ref.ags || null,
          objektart: ref.property_type, gemeinde: _gem4,
          baujahr: ref.build_year, wohnflaeche_qm: ref.living_area,
          wohneinheiten: ref.units, grundstuecksflaeche_qm: ref.plot_area,
          erstverkauf: /erstbezug|neubau|erstverkauf/i.test(String(ref.baustatus || '')),
        });
        step('vergleichsfaktor: ' + (_amtVf.verfuegbar
          ? _amtVf.faktor_qm + ' EUR/m2 -> ' + _amtVf.wert_eur + ' EUR'
            + (_amtVf.fuehrend ? ' (fuehrend)' : ' (nur Orientierung)')
          : 'keiner (' + _amtVf.grund + ')'));
      }
    } catch (e) { _amtVf = null; }

    let _irw = null;
    try {
      /* lat/lon stehen ab Z. 62 bereit; BorisConnector nutzt sie genauso. */
      const _la = Number(lat), _lo = Number(lon);
      if (Number.isFinite(_la) && Number.isFinite(_lo)) {
        _irw = await IrwConnector.hole({ lat: _la, lon: _lo,
          objektart: ref.property_type, anzahlWe: ref.units });
        if (_irw && _irw.verfuegbar) {
          _irw.abweichung = IrwConnector.abweichung(_irw, ref);
          step('irw: ' + _irw.wert_qm + ' EUR/m2, Stichtag ' + (_irw.stichtag || '?'));
        } else {
          step('irw: kein Wert (' + ((_irw && _irw.grund) || 'unbekannt') + ')');
        }
      }
    } catch (e) { _irw = null; }

    /* v1049-WFLA-1 · BORIS liefert die Grundstuecksgroesse des
     * Bodenrichtwertgrundstuecks mit — die marktuebliche Groesse der Zone.
     * Huellhorst: 700 m2 gegen 950 m2 tatsaechlich. Nach Paragraf 41
     * ImmoWertV kommt fuer eine erhebliche Ueberschreitung eine getrennte
     * Bewertung in Betracht. Wir setzen weiter die volle Flaeche an — aber
     * der Bericht sagt es, statt es zu verschweigen. */
    let _flaeche = null;
    try {
      const _bp2 = (landValue && landValue.properties_raw) || {};
      const _refQm = parseFloat(String(_bp2['Fläche'] || _bp2.Flaeche || '').replace(',', '.'));
      const _istQm = parseFloat(ref.plot_area);
      if (_refQm > 0 && _istQm > 0) {
        const _ueber = Math.round((_istQm / _refQm - 1) * 100);
        _flaeche = {
          richtwertgrundstueck_qm: _refQm, objekt_qm: _istQm, ueberschreitung_pct: _ueber,
          erheblich: _ueber >= 30,
          geschosszahl: _bp2.Geschosszahl || null,
          lagebeurteilung: _bp2.Lagebeurteilung || null,
          umrechnungsvorschrift_url: _bp2['Link zur Umrechnungsvorschrift'] || null,
          hinweis: _ueber >= 30
            ? 'Das Grundstück ist mit ' + _istQm + ' m² um ' + _ueber + ' % größer als das '
              + 'Bodenrichtwertgrundstück dieser Zone (' + _refQm + ' m²). Der Bodenwert setzt '
              + 'die gesamte Fläche zum vollen Bodenrichtwert an. Nach § 41 ImmoWertV kommt '
              + 'für die Mehrfläche eine getrennte Bewertung in Betracht — hier nicht vorgenommen.'
            : null,
        };
        step('flaeche: ' + _istQm + ' m2 gegen ' + _refQm + ' m2 Richtwertgrundstueck ('
          + (_ueber >= 0 ? '+' : '') + _ueber + ' %)');
      }
    } catch (e) { /* eine Nebenangabe darf den Bericht nie kippen */ }

    try {
      const _lzs = await WertParameterService.liegenschaftszins({
        ags: _agsWert || null, objektart: ref.property_type, anzahlWe: ref.units,
        brwSqm: landValue && landValue.available ? landValue.value_sqm : null,
        nutzerwert: ref.lzs_pct || null,
      });
      /* v1049-WBWK-1 · Die Bewirtschaftungskostenquote, die der
       * Gutachterausschuss selbst gemessen hat. Sie steht als eigener
       * Parameter in derselben Ernte wie der Zinssatz und ist der beste
       * verfuegbare Ansatz: nicht nur modellkonform, sondern das Modell
       * dieses Ausschusses. Faellt sie aus, greift der Modellansatz. */
      let _bwkPct = null;
      try {
        const _b = await WertParameterService.hole({
          typ: 'bwk_pct', ags: _agsWert || null,
          objektart: ref.property_type, anzahlWe: ref.units,
        });
        if (_b && _b.wert > 0) _bwkPct = _b;
      } catch (e) { /* ohne Quote bleibt es beim Modellansatz */ }
      step('bwk-quote: ' + (_bwkPct ? _bwkPct.wert + ' % (Stufe ' + _bwkPct.stufe + ')' : 'keine'));

      /* v1070-WUK-2 · Die Bezugsgroesse liegt seit v1049 vor (_flaeche aus
       * dem BORIS-Datensatz), wurde aber nur fuer einen Hinweistext benutzt.
       * Jetzt rechnet sie mit. */
      let _uk = null;
      try {
        _uk = flaechenaufteilung({
          ags: ref.ags || null,
          brw_eur_qm: (landValue && landValue.available) ? landValue.value_sqm : null,
          flaeche_qm: ref.plot_area,
          bezugsgroesse_qm: _flaeche ? _flaeche.richtwertgrundstueck_qm : null,
          ist_wohnung: /etw|wohnung|whg|apartment/i.test(String(ref.property_type || '')),
        });
        /* v1071-WHIN-2 · Die ausdrueckliche Angabe schlaegt die Ableitung
         * aus der Bezugsgroesse. Wer 928 m2 Hinterland eintraegt, weiss es
         * besser als eine Tabelle. */
        /* v1073-WGAA-5 · Ohne eigenen Wertansatz schlaegt der zustaendige
         * Ausschuss einen vor. Der Kreis Herford nennt "im Mittel rd. 20 %
         * des zugehoerigen beitragsfreien Bodenrichtwerts" — bei 150 EUR/m2
         * sind das genau die 30 EUR/m2 aus dem Gutachten zur Loehner
         * Strasse. Minden-Luebbecke nennt stattdessen 5 EUR/m2 pauschal,
         * "die Kaufpreise weisen keine lagemaessige Abhaengigkeit auf".
         *
         * VORSCHLAG, nicht Rechnung: er fuellt nur, was leer ist. */
        let _garten = null;
        if (Number(ref.hinterland_qm) > 0) {
          try {
            _garten = gartenlandVorschlag({
              ags: ref.ags || null,
              brw_eur_qm: (landValue && landValue.available) ? landValue.value_sqm : null,
            });
            if (_garten && _garten.verfuegbar) {
              step('gartenland: Vorschlag ' + _garten.vorschlag_eur_qm + ' EUR/m2 ('
                + (_garten.pct ? _garten.pct + ' % des BRW' : 'pauschal') + ')');
            }
          } catch (e) { _garten = null; }
        }
        if (Number(ref.hinterland_qm) > 0) {
          const _man = manuelleAufteilung({
            flaeche_qm: ref.plot_area, hinterland_qm: ref.hinterland_qm,
            /* v1073-WGAA-6 · Die eigene Angabe schlaegt den Vorschlag. */
            hinterland_eur_qm: ref.hinterland_eur_qm
              || (_garten && _garten.verfuegbar ? _garten.vorschlag_eur_qm : null),
            rentierlich: ref.hinterland_rentierlich === true,   /* v1072-WREN-4 */
            brw_eur_qm: (landValue && landValue.available) ? landValue.value_sqm : null,
            ags: ref.ags || null,
          });
          if (_man && _man.verfuegbar) _uk = _man;
          else if (_man && _man.hinweis) step('hinterland: ' + _man.grund);
        }
        /* v1073-WGAA-7 · Woher der Wertansatz kam, gehoert ins Ergebnis. */
        if (_uk && _uk.verfuegbar && _garten && _garten.verfuegbar && !ref.hinterland_eur_qm) {
          _uk.wertansatz_quelle = _garten.quelle_text;
          _uk.wertansatz_hinweis = _garten.hinweis;
          _uk.quelle_art = 'Vorschlag des Gutachterausschusses';
        }
        if (_uk && _uk.verfuegbar) {
          step('flaechenaufteilung: ' + _uk.bauland_qm + ' m2 Bauland zu '
            + _uk.bodenwert_eur_qm + ' EUR/m2 + ' + _uk.gruen_qm + ' m2 Gruenflaeche');
        }
      } catch (e) { _uk = null; }

      const _bw = ErtragswertService.bodenwert({
        groessenanpassung: _uk,   /* v1070-WUK-3 */
        flaeche_qm: ref.plot_area,
        brw_sqm: landValue && landValue.available ? landValue.value_sqm : null,
        brw_stichtag: landValue ? landValue.stichtag : null,
        brw_zone: landValue ? landValue.zone : null,
        brw_quelle: landValue && landValue.available ? 'boris' : 'manuell',
        /* WBW26-1 · ist_wohnung entscheidet, ob der volle Grundstueckswert
         * ueberhaupt angesetzt werden darf. Ohne diese Angabe rechnete eine
         * 50-m2-Wohnung mit 700 m2 Grundstueck. */
        ist_wohnung: /etw|wohnung|whg|apartment/i.test(String(ref.property_type || '')),
        mea_pct: ref.mea_pct || null, gfz_koeff: ref.gfz_koeff || null,
        beitrag_abzug_eur: ref.beitrag_abzug_eur || null,
        anpassung_pct: ref.brw_anpassung_pct || null,
        anpassung_grund: ref.brw_anpassung_grund || null,
      });
      /* WNHK-1 · Sachwertfaktor aus derselben Kaskade wie der Zinssatz.
       * Er steht in denselben Grundstuecksmarktberichten — die Ernte
       * liefert beides oder keines. */
      let _swf = null;
      try {
        _swf = await WertParameterService.sachwertfaktor({
          ags: _agsWert || null, objektart: ref.property_type, anzahlWe: ref.units,
          nutzerwert: ref.sachwertfaktor || null,
        });
      } catch (e) { /* ohne Faktor bleibt es beim vorlaeufigen Sachwert */ }

      /* WGAA-1 · Zustaendigen Gutachterausschuss vermerken. Fehler hier
       * duerfen den Bericht nie kippen — es ist eine Nebenbuchung. */
      try {
        const _bp = landValue && landValue.properties_raw;
        /* v1047-WAGS-2 · BORIS nennt die Felder anders, als v1036 annahm:
         * 'Bezeichnung des Gutachterausschusses' statt 'Gutachterausschussname'.
         * Deshalb hat sich die Ausschussliste nie aus der Nutzung gefuellt —
         * die Abfrage lief, fand nie etwas und meldete auch nichts. */
        const _gaaName = _bp && (_bp['Bezeichnung des Gutachterausschusses']
          || _bp.Gutachterausschussname || _bp.gutachterausschussname
          || _bp['Bezeichnung des Gutachterausschusses '.trim()]);
        if (_bp && _gaaName) {
          await HarvestService.merkeAusschuss({
            name: _gaaName,   /* v1047-WAGS-3 */
            nummer: _bp.Gutachterausschusskennziffer || _bp.gutachterausschusskennziffer
              || _bp.Gutachterausschussnummer || _bp.gutachterausschussnummer || null,
            ags: String(_bp.Gemeindekennzeichen || _bp.gemeindekennzeichen
              || _bp['Gemeindeschlüssel'] || _bp.Gemeindeschluessel
              || _bp.gemeindeschluessel || '').replace(/\D/g, '').slice(0, 5) || null,
            bundesland: _bp.LAND_KENNUNG || _bp.land_kennung || null,
            gemeinde: _bp.Gemeinde || _bp.Gemeindename || _bp.gemeindename || null,
            hinweis_url: _bp.Dateiname || null,
          });
        }
      } catch (e) { /* Nebenbuchung */ }

      if (_lzs) {
        _wertParams = {
          lzs_pct: _lzs.wert, lzs_quelle: _lzs.quelle, lzs_stufe: _lzs.stufe,
          /* v1049-WBWK-2 */
          /* v1050-WSTR-1 · Die Streuung aus der Kaskade weiterreichen. */
          lzs_streuung_pct: _lzs.streuung_pct != null ? _lzs.streuung_pct : null,
          lzs_min: _lzs.wert_min != null ? _lzs.wert_min : null,
          lzs_max: _lzs.wert_max != null ? _lzs.wert_max : null,
          lzs_herabgestuft: !!_lzs.herabgestuft,
          bwk_quote_pct: _bwkPct ? _bwkPct.wert : null,
          bwk_quote_stufe: _bwkPct ? _bwkPct.stufe : null,
          bwk_quote_quelle: _bwkPct ? _bwkPct.quelle : null,
          modellversion: _lzs.modellversion || null,
          lzs_parameter_id: _lzs.parameter_id, lzs_hinweis: _lzs.hinweis,
          bodenwert: _bw,
          flaeche: _flaeche,   /* v1049-WFLA-2 */
          /* v1055-WSPL-1 · Hinweis, wenn Stellplaetze da sind und kein
           * Ertrag dafuer angesetzt wurde. */
          stellplatz_ertrag_fehlt: ((Number(ref.garages) || 0) + (Number(ref.outdoor_parking) || 0)) > 0
            && !(Number(ref.stellplatz_miete_monat) > 0),
          irw: _irw,           /* v1053-WIRW-3 */
          amtliche_miete: _amtMiete,   /* v1059-WMIET-3 */
          amtlicher_vergleichsfaktor: _amtVf,   /* v1060-WVF-3 */
          bwk_modus: ref.bwk_modus || null,
          bwk_verwaltung_je_we: ref.bwk_verwaltung_je_we || null,
          bwk_instandhaltung_je_qm: ref.bwk_instandhaltung_je_qm || null,
          bwk_mietausfall_pct: ref.bwk_mietausfall_pct || null,
          bwk_betrieb_nul_jahr: ref.bwk_betrieb_nul_jahr || null,
          stellplatz_miete_monat: ref.stellplatz_miete_monat || null,
          /* WBW26-2 · Was im Objekt gepflegt ist, schlaegt die Tabellenwerte. */
          instandhaltung_ruecklage_jahr: ref.instandhaltung_ruecklage_jahr || null,
          leerstand_pct: ref.leerstand_pct || null,
          bog_eur: ref.bog_eur || null, bog_grund: ref.bog_grund || null,
          /* WNHK-2 · Sachwert-Eingaben */
          sachwertfaktor_param: _swf,
          nhk_typ: ref.nhk_typ || null, keller_dg: ref.keller_dg || null,
          standardstufe: ref.standardstufe || null, bgf_direkt: ref.bgf || null,
          regionalfaktor: ref.regionalfaktor || null,
          bes_bauteile: ref.bes_bauteile || null, aussenanlagen: ref.aussenanlagen || null,
          /* v1074-WAUS9-4 · Kette von A nach B. */
          ausstattung: ref.ausstattung || null,
          bauteile_hk: ref.bauteile_hk || null,
          bauteile_detail: ref.bauteile_detail || null,
          /* v1062-WMIK-1 · Zwei Felder, die der Quercheck seit v1061 liest und
           * die nie jemand geschrieben hat. Der Mikrolage-Score liegt seit dem
           * Promise.all bereit. normobjekt_qm hat keine belegte Quelle und
           * bleibt deshalb null — das Merkmal faellt aus und wird im Bericht
           * als nicht bewertbar ausgewiesen. */
          mikrolage_score: (micro && micro.score != null) ? Number(micro.score) : null,
          normobjekt_qm: null,
          /* v1063-WOD-7 · Die bundesweite Einordnung aus mb.param_werte.
           * Der Wert der Kaskade traegt sie mit; hier wird sie in den
           * Berichtsweg gehoben. Ohne diese Zeile bleibt sie in hole()
           * liegen — der Fehler, den v1062 zweimal reparieren musste. */
          lzs_einordnung: (_lzs && _lzs.einordnung) ? _lzs.einordnung : null,
        };
        step('wertparameter: LZS ' + _lzs.wert + ' % (Stufe ' + _lzs.stufe + ')'
             + (_bw && _bw.vollstaendig ? ', Bodenwert ' + _bw.wert + ' EUR' : ', kein Bodenwert'));
      }
    } catch (e) {
      step('wertparameter: nicht verfuegbar (' + (e && e.message ? e.message : 'Fehler') + ')');
    }

    /* WKIGEG-1 · Zweitmeinung. Nur wenn ausdruecklich eingeschaltet. */
    let _kiGegen = null;

    // 6b) Sachwert/Ertragswert-Quercheck (reine Rechnung, keine API-Kosten)
    const crossCheck = CrossCheckService.compute(ref, landValue, rent, valuation, _wertParams);

    /* WKIGEG-3 · Zweitmeinung einholen, wenn eingeschaltet. Faellt sie aus,
     * laeuft der Bericht unveraendert weiter — sie ist eine Probe, kein
     * Bestandteil der Rechnung. */
    if (String(process.env.KI_GEGENRECHNUNG || '0') === '1') {
      try {
        const _ein = KiGegenrechnungService.baueEingabe(ref, landValue, sale, rent, _wertParams);
        _kiGegen = await KiGegenrechnungService.rechne(_ein, crossCheck);
        const _v = _kiGegen && _kiGegen.vergleich;
        step('ki-gegenrechnung: ' + (_kiGegen && _kiGegen.verfuegbar
          ? ((_v && _v.auffaellige && _v.auffaellige.length)
              ? 'Abweichung bei ' + _v.auffaellige.join(', ')
              : 'deckungsgleich')
          : (_kiGegen ? _kiGegen.grund : 'kein Ergebnis')));
      } catch (e) {
        step('ki-gegenrechnung: fehlgeschlagen (' + String(e.message).slice(0, 60) + ')');
      }
    }
    if (crossCheck.available) {
      const c = crossCheck.comparison;
      step(`quercheck: Vergleich ${c.vergleichswert_eur ?? '–'} / Sachwert ${c.sachwert_eur ?? '–'} / Ertrag ${c.ertragswert_eur ?? '–'}${c.spread_pct != null ? ' (Spread ' + c.spread_pct + '%)' : ''}`);
    }

    // 7) Deal-Score
    const deal = ScoringService.dealScore({
      discountPct: valuation.market_value?.discount_to_market_pct ?? 0,
      grossYieldPct: valuation.yield?.gross_yield_pct ?? 0,
      macroScore: macro.score,
      microScore: micro.score,
      rentTrendPct: insights && insights.series ? insights.series.rent_cagr_pct : null,
      riskScore: sale.confidence != null ? 0.4 + sale.confidence * 0.5 : 0.6,
    });

    // 7b) DealScore-Anzeige: echten DealPilot DealScore 2 bei .dpkt bevorzugen, sonst vereinfacht.
    const dpDs2 = dealpilotMeta ? (dealpilotMeta.ds2_score != null ? dealpilotMeta.ds2_score : dealpilotMeta.score) : null;
    const hasFinKpis = dealpilotMeta && dealpilotMeta.dscr != null && dealpilotMeta.ltv_pct != null;
    const dealscoreMeta = (dpDs2 != null)
      ? { value: Math.round(dpDs2), source: 'DealPilot DealScore 2', simplified: false,
          kpis_complete: !!hasFinKpis,
          kpis: { dscr: dealpilotMeta.dscr, ltv_pct: dealpilotMeta.ltv_pct, cashflow_monthly: dealpilotMeta.cashflow_monthly },
          market_score: deal.score }
      : { value: deal.score, source: 'Marktbericht-Score (vereinfacht)', simplified: true,
          note: 'Vereinfachter Score ohne Finanzierungsdaten (Zins, Tilgung, EK, DSCR). Für den vollen DealScore 2 ein DealPilot-Objekt (.dpkt) laden.',
          market_score: deal.score };

    // 8) Payload für KI / JSON-Ausgabe
    const payload = {
      ref,
      address: { ...(geo?.components || {}), formatted: geo?.formatted, lat, lon,
                 city: geo?.components?.city, postcode: geo?.components?.postcode },
      object_image: (geoEnabled() && lat != null && lon != null)
        ? `/api/v1/marktbericht/static-map?lat=${lat}&lon=${lon}` : null,
      sale, rent, micro, macro,
        /* WETIK-1 · Herkunft der Wertermittlungsparameter im Klartext.
       * A/B sind amtlich, C/D/E sind indikativ — das muss im Bericht und
       * im PDF stehen, nicht nur als Buchstabe im Datensatz. */
      wertermittlung_herkunft: (function () {
        var st = (_wertParams && _wertParams.lzs_stufe) || 'D';
        var e = { A: ['amtlich', 'amtlicher Wert des zustaendigen Gutachterausschusses', false],
                  B: ['amtlich, regional', 'amtlicher Wert auf Landesebene', false],
                  C: ['indikativ, marktabgeleitet', 'aus dem regionalen Marktgeschehen zurueckgerechnet', true],
                  D: ['indikativ, gesetzlicher Auffangwert', 'nach § 256 BewG, nicht marktabgeleitet', true],
                  E: ['eigene Angabe', 'vom Nutzer gesetzt', true] }[st]
                || ['indikativ', 'Herkunft nicht bestimmbar', true];
        return { stufe: st, kurz: e[0], lang: e[1], indikativ: e[2],
                 liegenschaftszins_pct: _wertParams ? _wertParams.lzs_pct : null,
                 quelle: _wertParams ? _wertParams.lzs_quelle : null };
      })(),
    /* WKIGEG-2 · Zweitmeinung im Bericht, klar getrennt vom Ergebnis. */
      ki_gegenrechnung: _kiGegen,
      /* WSEED-5 · Herkunft der Marktdaten, gezaehlt statt behauptet.
       * Bisher trug der Bericht keine Angabe dazu — ein Bericht aus echten
       * GeoMap-Daten sah aus wie einer aus dem Fallback, und der Fallback
       * konnte erfundene Seed-Zeilen enthalten. */
      datenherkunft: (sale && sale.datenherkunft) || (rent && rent.datenherkunft) || 'keine',
      enthaelt_demodaten: !!((sale && sale.enthaelt_demodaten) || (rent && rent.enthaelt_demodaten)),
      datenquellen: Object.assign({}, (sale && sale.quellen) || {}, (rent && rent.quellen) || {}),
      land_value: landValue,
      zensus,                // Zensus 2022: Leerstand/Eigentuemerquote/Ø-Miete (gratis, offline-CSV)
      valuation,
      cross_check: crossCheck,   // Sachwert/Ertragswert-Quercheck (vereinfacht, indikativ)
      deal_score: deal,
      dealscore_meta: dealscoreMeta,
      assessment,            // jetzt aus echten APIs abgeleitet (oder null)
      market_history: insights ? insights.series : null,   // Preis-/Mietreihe für Chart
      market_dynamics: insights ? insights.dynamics : null, // Angebotsdauer (Markttempo)
      dealpilot: dealpilotMeta, // berechneter DealScore + KI-Analyse (Zweitmeinung)
      rent_trend_pct: insights && insights.series ? insights.series.rent_cagr_pct : null,
      price_trend_pct: insights && insights.series ? insights.series.price_cagr_pct : null,
      meta: {
        generated_at: new Date().toISOString(),
        sources: ['geoapify', 'overpass', 'geomap', (landValue && landValue.available) ? 'boris-nrw' : null].filter(Boolean),
        missing: ['destatis', 'mietindex', 'preisindex'].concat((landValue && landValue.available) ? [] : ['boris']),
        // Datenherkunft je Bereich. trust: echt=externe API | berechnet | eingabe | simuliert | fehlt
        provenance: [
          { label: 'Standort / Geocoding', source: 'Standortdaten', trust: 'echt' },
          { label: 'Mikrolage / Infrastruktur', source: micro.source ? 'Infrastrukturdaten' : 'keine Daten', trust: micro.source ? 'echt' : 'fehlt' },
          { label: 'Vergleichspreise Kauf (€/m²)', source: sale.source === 'geomap' ? 'Marktdaten' : (sale.source === 'keine_daten' ? 'keine Daten' : 'Demo'), trust: sale.source === 'geomap' ? 'echt' : (sale.source === 'keine_daten' ? 'fehlt' : 'simuliert') },
          { label: 'Vergleichsmieten (€/m²)', source: rent.source === 'geomap' ? 'Marktdaten' : (rent.source === 'keine_daten' ? 'keine Daten' : 'Demo'), trust: rent.source === 'geomap' ? 'echt' : (rent.source === 'keine_daten' ? 'fehlt' : 'simuliert') },
          { label: 'Vergleichsobjekte (Einzeln)', source: (sale.comparables && sale.comparables.length) ? 'Marktdaten' : 'nicht abgerufen', trust: (sale.comparables && sale.comparables.length) ? 'echt' : 'fehlt' },
          { label: 'Marktwert-Indikation + Spanne', source: valuation.market_value.range_basis === 'quartile' ? 'berechnet aus Marktquartilen' : 'berechnet (Spanne pauschal ±10%)', trust: 'berechnet' },
          { label: 'Nachfrage / Markttempo', source: insights && insights.dynamics && insights.dynamics.days_on_market != null ? 'Angebotsdauer-Analyse' : 'keine Daten', trust: insights && insights.dynamics && insights.dynamics.days_on_market != null ? 'echt' : 'fehlt' },
          { label: 'Leerstand / Eigentümerquote', source: zensus && zensus.available ? 'Strukturdaten' : 'keine Daten', trust: zensus && zensus.available ? 'echt' : 'fehlt' },
          { label: 'Wertentwicklung (Historie)', source: insights && insights.series && insights.series.usable ? 'Marktdaten-Historie ab ' + insights.series.start_year : 'keine/zu wenig Daten', trust: insights && insights.series && insights.series.usable ? 'echt' : 'fehlt' },
          { label: 'Rendite / Kaufpreisfaktor', source: 'berechnet aus Kaufpreis & Miete', trust: 'berechnet' },
          { label: 'Deal-Score', source: 'berechnet', trust: 'berechnet' },
          { label: 'Bodenrichtwert', source: landValue && landValue.source ? (landValue.source === 'dealpilot-eingabe' ? 'DealPilot-Eingabe' : 'amtlich') : 'keine Daten', trust: !landValue || !landValue.available ? 'fehlt' : (landValue.source === 'dealpilot-eingabe' ? 'eingabe' : 'echt') },
          { label: 'Makrolage / Sozioökonomie', source: macroRaw.available ? 'amtliche Statistik' : 'nicht verfügbar', trust: macroRaw.available ? 'echt' : 'fehlt' },
          { label: 'Bericht (Fließtext)', source: cfg.ai.mode === 'openai' ? 'KI-Analyse auf Basis obiger Daten' : 'Vorlage', trust: cfg.ai.mode === 'openai' ? 'echt' : 'berechnet' },
        ],
      },
    };

    // 9) KI-Report (im Schnell-Modus uebersprungen -> kein OpenAI-Mehrfach-Call)
    let report;
    if (FAST) {
      step('report: uebersprungen (Schnell-Modus)');
      report = { mode: 'schnell', report_md: '_Schnell-Modus: nur Marktwert- und Mietindikation inkl. Spanne berechnet. KI-Bericht und Preishistorie wurden übersprungen (für die schnelle Vorschau)._' };
    } else {
      step(`report: start (mode=${cfg.ai.mode})`);
      report = await ReportGenerationService.generate(payload, { onStep: (opts && opts.onStep) });
      step(`report: fertig mode=${report.mode}${report.error ? ' ERR=' + report.error : ''}`);
    }

    // 10) Persistieren
    step('persist: start');
    const balanceAfter = await GeoMapConnector.getBalance();
    const geomapCostEur = (balanceBefore != null && balanceAfter != null)
      ? Math.round((balanceBefore - balanceAfter) * 100) / 100 : null;
    if (geomapCostEur != null) step('Marktdaten verrechnet');
    await q('INSERT INTO mb.valuation_results (property_id,result) VALUES ($1,$2)',
      [propertyId, JSON.stringify(valuation)]);
    await q('INSERT INTO mb.deal_scores (property_id,score,breakdown) VALUES ($1,$2,$3)',
      [propertyId, deal.score, JSON.stringify(deal.breakdown)]);
    /* v942-userbind */
    const _uid = (input.user_id != null && !isNaN(parseInt(input.user_id, 10))) ? parseInt(input.user_id, 10) : null;
    const _label = (typeof input.object_label === 'string' && input.object_label.trim()) ? input.object_label.trim() : null;
    const rep = await q1(
      'INSERT INTO mb.market_reports (property_id,ai_mode,payload,report_md,user_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [propertyId, report.mode, JSON.stringify(payload), report.report_md, _uid]
    );

    // 10b) Objekt-Snapshot fuer den Verlauf (gruppiert wiederkehrende Berichte ueber object_key)
    const ext = input.external_ref || null;
    const objectKey = ext
      ? `dp:${ext}`
      : `geo:${lat != null ? lat.toFixed(4) : '?'}:${lon != null ? lon.toFixed(4) : '?'}:${ref.property_type || '?'}:${ref.living_area ? Math.round(ref.living_area / 5) * 5 : '?'}:${ref.build_year || '?'}`;
    try {
      const mvv = (payload.valuation && payload.valuation.market_value) || {};
      const yld = (payload.valuation && payload.valuation.yield) || {};
      const hist = payload.market_history || {};
      await q(
        `INSERT INTO mb.object_snapshots
          (object_key,external_ref,property_id,report_id,address,lat,lon,property_type,living_area,build_year,
           market_value,market_value_low,market_value_high,median_sqm,gross_yield_pct,rent_multiplier,
           deal_score,micro_score,macro_score,price_cagr_pct,confidence,comparable_group,ai_mode,data,
           user_id,object_label)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [objectKey, ext, propertyId, rep.id, payload.address?.formatted || null, lat, lon,
         ref.property_type, ref.living_area, ref.build_year,
         mvv.estimated ?? null, mvv.low ?? null, mvv.high ?? null, mvv.basis_median_sqm ?? null,
         yld.gross_yield_pct ?? null, yld.rent_multiplier ?? null,
         payload.deal_score?.score ?? null, payload.micro?.score ?? null, payload.macro?.score ?? null,
         hist.price_cagr_pct ?? null, mvv.confidence ?? null, payload.sale?.comparable_group ?? null,
         report.mode, JSON.stringify(payload), _uid, _label]
      );
    } catch (e) { step('snapshot: ' + e.message); /* Snapshot ist optional, Bericht nicht blockieren */ }
    step('DONE');

    return {
      report_id: rep.id,
      property_id: propertyId,
      object_key: objectKey,
      external_ref: ext,
      ai_mode: report.mode,
      ai_error: report.error || null,
      cost: { geomap_eur: geomapCostEur, geomap_balance_eur: balanceAfter },
      took_ms: Date.now() - t0,
      trace,
      data: payload,
      report_md: report.report_md,
    };
  },
};
