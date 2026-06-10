// Standort-Finder: rankt Standorte nach Investment-Absicht.
// MVP (Option 1): feste Kandidatenlisten je Region. Scoring zuerst aus KOSTENLOSEN Signalen
// (Geoapify-POI + Destatis-Bevoelkerungstrend). GeoMap-Rendite optional fuer Top-Treffer.
import { GeoapifyConnector } from '../connectors/GeoapifyConnector.js';
import { DestatisConnector } from '../connectors/stubConnectors.js';
import { GeoMapConnector } from '../connectors/GeoMapConnector.js';
import { ZensusConnector } from '../connectors/ZensusConnector.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Geoapify-Kategorien je Absicht: [category, gewicht, radius_m]
const INTENTS = {
  student: {
    label: 'Studentisches Wohnen',
    desc: 'Naehe zu Hochschulen, junge Nachfrage, solide Mietauslastung.',
    poi: [['education.university', 3.0, 5000], ['education.school', 1.0, 2500], ['catering', 0.6, 1200], ['public_transport', 0.9, 1000]],
    popWeight: 0.6, youngWeight: 1.5,
  },
  cashflow: {
    label: 'Cashflow / hohe Mietrendite',
    desc: 'Stabile Nachfrage, gute Brutto-Mietrendite, B/C-Lagen.',
    poi: [['public_transport', 1.0, 1000], ['commercial.supermarket', 1.0, 1500], ['healthcare', 0.6, 1500]],
    popWeight: 0.4, renditeWeight: 1.6,
  },
  wertsteigerung: {
    label: 'Wertsteigerung',
    desc: 'Bevoelkerungswachstum, Dynamik, Aufwertungspotenzial.',
    poi: [['education.university', 1.0, 5000], ['public_transport', 1.0, 1000], ['commercial', 0.6, 1500]],
    popWeight: 2.2,
  },
  familie: {
    label: 'Familien / Eigennutzer',
    desc: 'Schulen, Kitas, Gruenflaechen, ruhige Wohnlagen.',
    poi: [['education.school', 1.5, 2000], ['childcare', 1.5, 1500], ['leisure.park', 1.2, 1500], ['commercial.supermarket', 0.8, 1500]],
    popWeight: 1.0,
  },
  senioren: {
    label: 'Senioren / Betreutes Wohnen',
    desc: 'Aerzte, Apotheken, OEPNV und Nahversorgung fusslaeufig.',
    poi: [['healthcare', 2.0, 1200], ['healthcare.pharmacy', 1.5, 1000], ['public_transport', 1.2, 800], ['commercial.supermarket', 1.0, 1000]],
    popWeight: 0.5,
  },
};

const CAT_LABEL = {
  'education.university': 'Hochschulen', 'education.school': 'Schulen', catering: 'Gastronomie',
  public_transport: 'OEPNV-Punkte', 'commercial.supermarket': 'Supermaerkte', commercial: 'Einzelhandel',
  healthcare: 'Aerzte/Gesundheit', 'healthcare.pharmacy': 'Apotheken', childcare: 'Kitas', 'leisure.park': 'Parks/Gruen',
};

// Kandidaten je Region: name, ags (Kreis fuer Destatis), lat/lon (Stadtzentrum fuer POI).
// AGS bewusst auf Kreisebene; falsche/fehlende AGS degradieren sauber auf neutrale Demografie.
const REGIONS = {
  owl: {
    label: 'Ostwestfalen-Lippe (OWL)',
    candidates: [
      { name: 'Bielefeld', ags: '05711', lat: 52.0302, lon: 8.5325 },
      { name: 'Paderborn', ags: '05774', lat: 51.7189, lon: 8.7575 },
      { name: 'Herford', ags: '05758', lat: 52.1157, lon: 8.6770 },
      { name: 'Guetersloh', ags: '05754', lat: 51.9066, lon: 8.3786 },
      { name: 'Detmold (Kreis Lippe)', ags: '05766', lat: 51.9380, lon: 8.8786 },
      { name: 'Minden', ags: '05770', lat: 52.2884, lon: 8.9176 },
      { name: 'Bad Salzuflen', ags: '05766', lat: 52.0860, lon: 8.7480 },
    ],
  },
  nrw: {
    label: 'NRW-Grossstaedte',
    candidates: [
      { name: 'Koeln', ags: '05315', lat: 50.9375, lon: 6.9603 },
      { name: 'Duesseldorf', ags: '05111', lat: 51.2277, lon: 6.7735 },
      { name: 'Dortmund', ags: '05913', lat: 51.5136, lon: 7.4653 },
      { name: 'Muenster', ags: '05515', lat: 51.9607, lon: 7.6261 },
      { name: 'Bonn', ags: '05314', lat: 50.7374, lon: 7.0982 },
      { name: 'Aachen', ags: '05334', lat: 50.7753, lon: 6.0839 },
      { name: 'Bielefeld', ags: '05711', lat: 52.0302, lon: 8.5325 },
    ],
  },
  unistaedte: {
    label: 'Deutsche Unistaedte',
    candidates: [
      { name: 'Muenster', ags: '05515', lat: 51.9607, lon: 7.6261 },
      { name: 'Paderborn', ags: '05774', lat: 51.7189, lon: 8.7575 },
      { name: 'Osnabrueck', ags: '03404', lat: 52.2799, lon: 8.0472 },
      { name: 'Bielefeld', ags: '05711', lat: 52.0302, lon: 8.5325 },
      { name: 'Bonn', ags: '05314', lat: 50.7374, lon: 7.0982 },
      { name: 'Aachen', ags: '05334', lat: 50.7753, lon: 6.0839 },
      { name: 'Goettingen', ags: '03159', lat: 51.5413, lon: 9.9158 },
    ],
  },
  ruhrgebiet: {
    label: 'Ruhrgebiet',
    candidates: [
      { name: 'Dortmund', ags: '05913', lat: 51.5136, lon: 7.4653 },
      { name: 'Essen', ags: '05113', lat: 51.4556, lon: 7.0116 },
      { name: 'Duisburg', ags: '05112', lat: 51.4344, lon: 6.7623 },
      { name: 'Bochum', ags: '05911', lat: 51.4818, lon: 7.2162 },
      { name: 'Gelsenkirchen', ags: '05513', lat: 51.5177, lon: 7.0857 },
      { name: 'Oberhausen', ags: '05119', lat: 51.4963, lon: 6.8638 },
    ],
  },
  metropolen: {
    label: 'Deutsche Metropolen',
    candidates: [
      { name: 'Berlin', ags: '11000', lat: 52.5200, lon: 13.4050 },
      { name: 'Hamburg', ags: '02000', lat: 53.5511, lon: 9.9937 },
      { name: 'Muenchen', ags: '09162', lat: 48.1351, lon: 11.5820 },
      { name: 'Koeln', ags: '05315', lat: 50.9375, lon: 6.9603 },
      { name: 'Frankfurt a.M.', ags: '06412', lat: 50.1109, lon: 8.6821 },
      { name: 'Stuttgart', ags: '08111', lat: 48.7758, lon: 9.1829 },
      { name: 'Duesseldorf', ags: '05111', lat: 51.2277, lon: 6.7735 },
    ],
  },
  sued: {
    label: 'Sueddeutschland',
    candidates: [
      { name: 'Muenchen', ags: '09162', lat: 48.1351, lon: 11.5820 },
      { name: 'Stuttgart', ags: '08111', lat: 48.7758, lon: 9.1829 },
      { name: 'Nuernberg', ags: '09564', lat: 49.4521, lon: 11.0767 },
      { name: 'Augsburg', ags: '09761', lat: 48.3705, lon: 10.8978 },
      { name: 'Karlsruhe', ags: '08212', lat: 49.0069, lon: 8.4037 },
      { name: 'Freiburg', ags: '08311', lat: 47.9990, lon: 7.8421 },
      { name: 'Heidelberg', ags: '08221', lat: 49.3988, lon: 8.6724 },
    ],
  },
};

// Reines Scoring (offline testbar). signals = { poi: {cat:count}, popTrend: %/Jahr|null, rendite: %|null }
export function scoreCandidate(intentKey, signals) {
  const it = INTENTS[intentKey];
  if (!it) throw new Error('Unbekannte Absicht: ' + intentKey);
  const poi = signals.poi || {};
  let poiAcc = 0, wSum = 0; const reasons = [];
  it.poi.forEach(([cat, w]) => {
    const cnt = poi[cat] || 0;
    const norm = 1 - Math.exp(-cnt / 6); // saturierend: ~6 -> 0.63, ~20 -> 0.96
    poiAcc += norm * w; wSum += w;
    if (cnt > 0 && w >= 1.0) reasons.push(`${CAT_LABEL[cat] || cat}: ${cnt}`);
  });
  const poiScore = wSum ? poiAcc / wSum : 0;

  const pt = signals.popTrend;
  const demoScore = pt == null ? 0.5 : clamp((pt + 1) / 2.5, 0, 1); // -1%/J -> 0, +1.5%/J -> 1
  if (pt != null) reasons.push(`Bevoelkerungstrend ${pt > 0 ? '+' : ''}${(Math.round(pt * 100) / 100)} %/Jahr`);

  let rendScore = null;
  if (signals.rendite != null) {
    rendScore = clamp((signals.rendite - 3) / 4, 0, 1); // 3% -> 0, 7% -> 1
    reasons.push(`Bruttorendite ${signals.rendite} %`);
  }

  let youngScore = null;
  if (it.youngWeight && signals.youngShare != null) {
    youngScore = clamp((signals.youngShare - 15) / 20, 0, 1); // 15% -> 0, 35% -> 1
    reasons.push(`18\u201330-Anteil ${signals.youngShare} %`);
  }

  const wPoi = 1.0, wDemo = it.popWeight || 0.5,
    wRend = (it.renditeWeight && rendScore != null) ? it.renditeWeight : 0,
    wYoung = (it.youngWeight && youngScore != null) ? it.youngWeight : 0;
  const num = poiScore * wPoi + demoScore * wDemo
    + (rendScore != null ? rendScore * wRend : 0) + (youngScore != null ? youngScore * wYoung : 0);
  const den = wPoi + wDemo + wRend + wYoung;
  const score = Math.round(clamp(den ? num / den : 0, 0, 1) * 100);
  return {
    score,
    reasons,
    parts: {
      poi: Math.round(poiScore * 100), demografie: Math.round(demoScore * 100),
      rendite: rendScore != null ? Math.round(rendScore * 100) : null,
      jung: youngScore != null ? Math.round(youngScore * 100) : null,
    },
  };
}

export const LocationFinderService = {
  meta() {
    return {
      intents: Object.entries(INTENTS).map(([k, v]) => ({ key: k, label: v.label, desc: v.desc })),
      regions: Object.entries(REGIONS).map(([k, v]) => ({ key: k, label: v.label, count: v.candidates.length })),
    };
  },

  async run(intentKey, regionKey, opts) {
    opts = opts || {};
    const withRendite = opts.withRendite !== false; // default an
    const topN = opts.topN || 5;
    const it = INTENTS[intentKey];
    if (!it) throw new Error('Unbekannte Absicht');
    const region = REGIONS[regionKey] || REGIONS.owl;

    const evalCandidate = async (c) => {
      // POI je Kategorie parallel
      const poiEntries = await Promise.all(it.poi.map(async ([cat, , radius]) => {
        try { const arr = await GeoapifyConnector.places(cat, c.lat, c.lon, radius || 1500, 40); return [cat, Array.isArray(arr) ? arr.length : 0]; }
        catch (e) { return [cat, 0]; }
      }));
      const poi = Object.fromEntries(poiEntries);
      // Demografie + Altersanteil parallel
      const [popTrend, youngShare] = await Promise.all([
        (async () => {
          try { const macro = await DestatisConnector.macro({ ags: c.ags }); const mm = (macro && (macro.metrics || macro)) || null; return (mm && mm.bevoelkerung_trend != null) ? mm.bevoelkerung_trend : null; }
          catch (e) { return null; }
        })(),
        (async () => {
          if (!it.youngWeight) return null;
          try { const ag = await DestatisConnector.ageShare18_30({ ags: c.ags }); if (ag && ag.available && ag.share != null) return Math.round(ag.share * 10) / 10; } catch (e) { /* */ }
          try { const z = ZensusConnector.lookup(c.ags); if (z && z.available && z.jung_18_30 != null) return z.jung_18_30; } catch (e) { /* */ }
          return null;
        })(),
      ]);
      const sc = scoreCandidate(intentKey, { poi, popTrend, youngShare });
      return { name: c.name, ags: c.ags, lat: c.lat, lon: c.lon, poi, popTrend, youngShare, rendite: null, ...sc };
    };

    let results = await Promise.all(region.candidates.map(evalCandidate));
    results.sort((a, b) => b.score - a.score);

    // GeoMap-Rendite NUR fuer die Top-N nachladen (Kosten begrenzen) – parallel
    let geomapCalls = 0;
    if (withRendite) {
      await Promise.all(results.slice(0, topN).map(async (r) => {
        try {
          const [sale, rent] = await Promise.all([
            GeoMapConnector.kpiCollection({ lat: r.lat, lon: r.lon, offerType: 'Kauf', analyzedField: 'PREISPROQM', objectClasses: ['Wohnung'] }),
            GeoMapConnector.kpiCollection({ lat: r.lat, lon: r.lon, offerType: 'Miete', analyzedField: 'PREISPROQM', objectClasses: ['Wohnung'] }),
          ]);
          geomapCalls += 2;
          const sMed = sale && !sale.error ? sale.median : null;
          const rMed = rent && !rent.error ? rent.median : null;
          if (sMed && rMed) {
            const rendite = Math.round((rMed * 12 / sMed) * 1000) / 10;
            const sc = scoreCandidate(intentKey, { poi: r.poi, popTrend: r.popTrend, youngShare: r.youngShare, rendite });
            r.rendite = rendite; r.rendite_source = 'geomap';
            r.score = sc.score; r.reasons = sc.reasons; r.parts = sc.parts;
          }
        } catch (e) { /* GeoMap optional */ }
      }));
      results.sort((a, b) => b.score - a.score);
    }

    return {
      intent: intentKey, intentLabel: it.label, region: regionKey, regionLabel: region.label,
      results, geomap_calls: geomapCalls,
      cost_hint_eur: geomapCalls ? Math.round(geomapCalls * 0.28 * 100) / 100 : 0,
    };
  },
};
