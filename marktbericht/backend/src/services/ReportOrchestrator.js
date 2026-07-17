// v564-neutralized: Anbieternamen aus provenance + steps entfernt
// ReportOrchestrator.js — orchestriert die gesamte Bericht-Pipeline.
import { q, q1 } from '../lib/db.js';
import { cfg, geomapEnabled, geoEnabled } from '../lib/config.js';
import { GeocodingService } from './GeocodingService.js';
import { MarketAnalysisService } from './MarketAnalysisService.js';
import { MicroLocationService } from './MicroLocationService.js';
import { ValuationService } from './ValuationService.js';
import { CrossCheckService } from './CrossCheckService.js';
import { ScoringService } from './ScoringService.js';
import { ReportGenerationService } from './ReportGenerationService.js';
import { DestatisConnector } from '../connectors/stubConnectors.js';
import { BorisConnector } from '../connectors/BorisConnector.js';
import { DealPilotObjectMapper } from './DealPilotObjectMapper.js';
import { MarketInsightsService } from './MarketInsightsService.js';
import { GeoMapConnector } from '../connectors/GeoMapConnector.js';
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

    // 6b) Sachwert/Ertragswert-Quercheck (reine Rechnung, keine API-Kosten)
    const crossCheck = CrossCheckService.compute(ref, landValue, rent, valuation);
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
