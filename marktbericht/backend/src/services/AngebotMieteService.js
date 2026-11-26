// AngebotMieteService.js — v5090 · zusammengefasste Angebotsmieten je Marktbericht protokollieren.
//
// Marcel 26.11.2026: „mit jedem Abruf … die Daten mitnehmen und unsere Datenbank füllen".
// Es wird NUR die Kennzahl gespeichert, die der Bericht ohnehin abruft (Median, Quartile, n der
// Angebotsmiete im Umkreis): kein Zusatzabruf, keine Rohangebote, keine Adressen, keine Offer-IDs.
// Fire and forget wie protokolliereMessung (JahreswerteService). Noch NICHT in der Rechnung.
import { q } from '../lib/db.js';

const WFL = [[40, 'Unter 40 m²'], [60, '40 - 59 m²'], [80, '60 - 79 m²'], [100, '80 - 99 m²'], [120, '100 - 119 m²'],
  [140, '120 - 139 m²'], [160, '140 - 159 m²'], [180, '160 - 179 m²'], [200, '180 - 199 m²']];
const BJ = [[1919, 'Vor 1919'], [1950, '1919 - 1949'], [1960, '1950 - 1959'], [1970, '1960 - 1969'], [1980, '1970 - 1979'],
  [1990, '1980 - 1989'], [2000, '1990 - 1999'], [2010, '2000 - 2009'], [2016, '2010 - 2015']];

/** Zensus-Klasse der Wohnfläche (Zensus 2022, nettokaltmiete_qm/flaeche). */
export function wflKlasse(wfl) {
  const x = Number(wfl);
  if (!(x > 0)) return null;
  for (const [g, k] of WFL) if (x < g) return k;
  return '200 m² und mehr';
}
/** Zensus-Klasse des Baujahrs (Zensus 2022, nettokaltmiete_qm/baujahr). */
export function bjKlasse(bj) {
  const x = Number(bj);
  if (!(x > 1500)) return null;
  for (const [g, k] of BJ) if (x < g) return k;
  return '2016 und später';
}
/** Objektart wie in der Mietsuche: MFH vermietet Wohnungen, gesucht wird je Wohnung. */
export function objektart(pt) {
  const s = String(pt || '').toLowerCase();
  if (/mfh|mehrfamilien/.test(s)) return 'mfh';
  if (/wohnung|etw|eigentumswohnung|appartement/.test(s)) return 'wohnung';
  if (/haus|efh|zfh|dhh|rh|reihen|doppel|einfamilien|zweifamilien|bungalow|villa/.test(s)) return 'haus';
  return null;
}
/** Wohnfläche, nach der gesucht wurde (MFH: je Wohnung, wie MarketAnalysisService v2556b). */
export function gesuchteFlaeche(ref) {
  const wfl = Number(ref && ref.living_area) > 0 ? Number(ref.living_area) : null;
  if (!wfl) return null;
  if (objektart(ref.property_type) !== 'mfh') return wfl;
  const eh = Array.isArray(ref.einheiten_miete) ? ref.einheiten_miete.map((e) => Number(e && e.wfl)).filter((x) => x > 0) : [];
  if (eh.length) return eh.reduce((a, x) => a + x, 0) / eh.length;
  return Number(ref.units) > 1 ? wfl / Number(ref.units) : null;
}

/** Baut die Zeile; null, wenn nichts zu speichern ist (kein GeoMap-Wert, Cache, Gewerbe, Demo). */
export function messungAus(rent, ref, jetzt = new Date()) {
  if (!rent || rent.datenherkunft !== 'geomap' || rent.cached || rent.enthaelt_demodaten) return null;
  if (rent.listing_type !== 'miete' || rent.segment === 'gewerbe') return null;
  const med = Number(rent.median_per_sqm), n = Number(rent.sample_size);
  if (!(med > 0) || !(n > 0)) return null;
  const art = objektart(ref && ref.property_type);
  if (!art) return null;
  const ags = String((ref && ref.ags) || '').replace(/\D/g, '') || null;
  return {
    jahr: jetzt.getFullYear(), monat: jetzt.getMonth() + 1, ags, land: ags ? ags.slice(0, 2) : null, objektart: art,
    wfl_klasse: wflKlasse(gesuchteFlaeche(ref)), bj_klasse: bjKlasse(ref && ref.build_year),
    median_eur_qm: med, q25_eur_qm: Number(rent.q25_per_sqm) > 0 ? Number(rent.q25_per_sqm) : null,
    q75_eur_qm: Number(rent.q75_per_sqm) > 0 ? Number(rent.q75_per_sqm) : null, n,
    radius_m: Number(rent.used_radius_m) > 0 ? Math.round(Number(rent.used_radius_m)) : null,
    gruppe: rent.comparable_group || null,
    zeitfenster_monate: Number(rent.zeitfenster_monate) > 0 ? Number(rent.zeitfenster_monate) : null,
    quelle: 'geomap',
  };
}

/** Eine Messung protokollieren (fire and forget, Fehler brechen den Bericht nie). */
export async function protokolliereMiete(rent, ref) {
  const m = messungAus(rent, ref);
  if (!m) return false;
  try {
    await q(`INSERT INTO mb.angebot_miete_messung (jahr, monat, ags, land, objektart, wfl_klasse, bj_klasse, median_eur_qm,
               q25_eur_qm, q75_eur_qm, n, radius_m, gruppe, zeitfenster_monate, quelle)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [m.jahr, m.monat, m.ags, m.land, m.objektart, m.wfl_klasse, m.bj_klasse, m.median_eur_qm, m.q25_eur_qm, m.q75_eur_qm,
      m.n, m.radius_m, m.gruppe, m.zeitfenster_monate, m.quelle]);
    return true;
  } catch (e) { return false; }
}

/** Admin-Überblick: Messungen je Land und Größenklasse. */
export async function ueberblick() {
  const o = { gesamt: 0, je_land: [], je_klasse: [] };
  try {
    const g = await q('SELECT count(*)::int AS n, count(DISTINCT ags)::int AS orte, min(erfasst_am) AS seit FROM mb.angebot_miete_messung');
    o.gesamt = g[0] ? g[0].n : 0; o.orte = g[0] ? g[0].orte : 0; o.seit = g[0] ? g[0].seit : null;
    o.je_land = await q(`SELECT coalesce(land,'?') AS land, count(*)::int AS n, count(DISTINCT ags)::int AS orte
                           FROM mb.angebot_miete_messung GROUP BY 1 ORDER BY 1`);
    o.je_klasse = await q(`SELECT coalesce(land,'?') AS land, objektart, coalesce(wfl_klasse,'ohne Fläche') AS wfl_klasse,
                                  count(*)::int AS n,
                                  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY median_eur_qm)::numeric, 2)::float AS median
                             FROM mb.angebot_miete_messung GROUP BY 1,2,3 ORDER BY 1,2,3`);
  } catch (e) { o.fehler = e.message; }
  return o;
}
