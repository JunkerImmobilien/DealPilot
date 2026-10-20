// LageMessungService.js — v2175 · N62.19 B
//
// Marcel am 13.10.2026: „Macht im Tab Objekt die ‚Lage analysieren' noch
// Sinn? ... koennen wir das mit unseren vorhandenen Daten aus den
// Datenbanken und Schnittstellen besser? Oder vielleicht auch beides und
// im Vergleich?"
//
// GEMESSEN vorher: „Lage analysieren" war reine KI mit Websuche
// (openaiService.analyzeLage), Quellen ungeprueft, sechs Felder.
// Vier davon lassen sich MESSEN — ohne GeoMap-Kosten und ohne vollen Bericht:
//
//   makrolage        macroScore aus mb.makro_werte (4 Kennzahlen, Kreis)
//   mikrolage        Geoapify-Umfeld-Score (6 Gruppen, 2 km)
//   ds2_bevoelkerung Bevoelkerungstrend %/Jahr (Kreis, 12 Jahre)
//   ds2_nachfrage    marktaktive Leerstandsquote (Zensus 2022, Gemeinde/Kreis)
//
// Die Schwellen der mittleren Stufen sind die, die der Bericht schon nutzt
// (ReportOrchestrator: Makro 60/45; MarketInsights: Mikro 75/55; Zensus-
// Leerstand 3/6 %). Die aeusseren Stufen sind ERGAENZT und stehen als
// Modellannahme an jedem Feld - abzunehmen von Marcel.
// Kein Treffer heisst kein Wert: ein Feld ohne Messung bleibt leer.

import { GeocodingService } from './GeocodingService.js';
import { MicroLocationService } from './MicroLocationService.js';
import { ScoringService } from './ScoringService.js';
import { DestatisConnector } from '../connectors/stubConnectors.js';
import { AgsResolver } from '../connectors/AgsResolver.js';
import { ZensusConnector } from '../connectors/ZensusConnector.js';

export const SCHWELLEN = {
  makrolage:        { quelle: 'Makro-Score aus Regionaldatenbank (Bevölkerung, Kaufkraft, Arbeitslosigkeit, Wanderung, Kreis)',
                      stufen: [[75, 'sehr_gut'], [60, 'gut'], [45, 'durchschnittlich'], [30, 'schwach'], [-Infinity, 'sehr_schwach']],
                      text: '≥75 sehr gut · ≥60 gut · ≥45 durchschnittlich · ≥30 schwach · darunter sehr schwach (Score 0–100)' },
  mikrolage:        { quelle: 'Umfeld-Score Geoapify (Einkaufen, ÖPNV, Gesundheit, Freizeit, Bildung, Gastronomie, 2 km)',
                      stufen: [[85, 'sehr_gut'], [75, 'gut'], [55, 'durchschnittlich'], [35, 'schwach'], [-Infinity, 'sehr_schwach']],
                      text: '≥85 sehr gut · ≥75 gut · ≥55 durchschnittlich · ≥35 schwach · darunter sehr schwach (Score 0–100)' },
  ds2_bevoelkerung: { quelle: 'Bevölkerungstrend je Jahr, Regionaldatenbank 12411-01-01-4 (Kreis)',
                      stufen: [[0.8, 'stark_wachsend'], [0.2, 'wachsend'], [-0.2, 'stabil'], [-0.8, 'leicht_fallend'], [-Infinity, 'stark_fallend']],
                      text: '≥0,8 %/J stark wachsend · ≥0,2 wachsend · ≥−0,2 stabil · ≥−0,8 leicht fallend · darunter stark fallend' },
  /* Nachfrage: niedriger Leerstand = hohe Nachfrage, daher absteigend. */
  ds2_nachfrage:    { quelle: 'Marktaktive Leerstandsquote, Zensus 2022',
                      stufen: [[1.5, 'sehr_stark'], [3, 'stark'], [6, 'mittel'], [9, 'schwach'], [Infinity, 'sehr_schwach']],
                      absteigend: true,
                      text: '<1,5 % sehr stark · <3 % stark · <6 % mittel · <9 % schwach · darüber sehr schwach (marktaktiver Leerstand)' },
};

function stufe(feld, wert) {
  const s = SCHWELLEN[feld];
  if (wert == null || !Number.isFinite(Number(wert))) return null;
  const v = Number(wert);
  if (s.absteigend) { for (const [g, st] of s.stufen) if (v < g) return st; return null; }
  for (const [g, st] of s.stufen) if (v >= g) return st;
  return null;
}

export async function messeLage({ adresse, plz, ort }) {
  const t0 = Date.now();
  const out = { felder: {}, gebiet: {}, dauer_ms: 0 };
  const geo = adresse ? await GeocodingService.geocode(adresse).catch(() => null) : null;
  const pc = (geo && geo.components && geo.components.postcode) || plz || null;
  const city = (geo && geo.components && geo.components.city) || ort || null;
  const [ags, gem] = await Promise.all([
    pc ? AgsResolver.fromPostcode(pc).catch(() => null) : null,
    pc ? AgsResolver.gemeindeEindeutig(pc, city).catch(() => null) : null,
  ]);
  out.gebiet = { kreis_ags: ags && ags.kreis_ags || null, gemeinde_ags: gem && gem.gemeinde_ags || null, lat: geo && geo.lat, lon: geo && geo.lon };

  const [macroRaw, micro, zensus] = await Promise.all([
    ags && ags.kreis_ags ? DestatisConnector.macro({ ags: ags.kreis_ags, city }).catch(() => null) : null,
    geo ? MicroLocationService.analyze(geo.lat, geo.lon, 2000).catch(() => null) : null,
    ags && ags.kreis_ags ? ZensusConnector.lookupDb({ kreisAgs: ags.kreis_ags, gemeindeAgs: gem && gem.gemeinde_ags }).catch(() => null) : null,
  ]);

  /* Makro: wie im Bericht erst ab zwei gemessenen Kennzahlen (v2158). */
  if (macroRaw && macroRaw.available) {
    const m = ScoringService.macroScore(macroRaw.metrics || null);
    if (m && m.score != null && m.estimated === false && (m.gemessen ?? 0) >= 2) {
      out.felder.makrolage = { wert: Math.round(m.score), einheit: 'Score', stufe: stufe('makrolage', m.score),
        quelle: SCHWELLEN.makrolage.quelle, schwelle: SCHWELLEN.makrolage.text,
        stand: macroRaw.jahre || null, aus: macroRaw.herkunft || 'regionaldatenbank_live' };
    }
    const tr = macroRaw.metrics && macroRaw.metrics.bevoelkerung_trend;
    if (tr != null && Number.isFinite(tr)) {
      out.felder.ds2_bevoelkerung = { wert: Math.round(tr * 100) / 100, einheit: '%/Jahr', stufe: stufe('ds2_bevoelkerung', tr),
        quelle: SCHWELLEN.ds2_bevoelkerung.quelle, schwelle: SCHWELLEN.ds2_bevoelkerung.text,
        stand: macroRaw.jahre && macroRaw.jahre.bevoelkerung || null,
        /* v2501 · wanderungssaldo steht in PROZENT (je 10.000 EW / 100,
           stubConnectors.js:259). Hier stand * 1000 / 10 - das ergab je
           1.000 EW das Zehnfache: Minden-Luebbecke „34.3 je 1.000 EW" statt
           3,4 (gemessen 20.10.2026). Dazu deutsches Komma. */
        zusatz: macroRaw.metrics.wanderungssaldo != null ? 'Wanderungssaldo ' + String(Math.round(macroRaw.metrics.wanderungssaldo * 100) / 10).replace('.', ',') + ' je 1.000 EW' : null };
    }
  }
  if (micro && micro.score != null && micro.source !== 'none') {
    out.felder.mikrolage = { wert: Math.round(micro.score), einheit: 'Score', stufe: stufe('mikrolage', micro.score),
      quelle: SCHWELLEN.mikrolage.quelle, schwelle: SCHWELLEN.mikrolage.text };
  }
  if (zensus && zensus.available) {
    /* v2501 · Die oberste Ebene von lookupDb() traegt den KREIS-Wert. Hier
       stand sie unter dem Etikett „(Gemeinde …)", sobald es eine Gemeinde
       gab: Huellhorst zeigte 2 % (Kreis Minden-Luebbecke) als Gemeindewert,
       die Gemeinde selbst hat 1,2 % (gemessen 20.10.2026). Jetzt Gemeinde
       vor Kreis, und das Etikett nennt die Ebene, deren Wert es ist. */
    const _gm = zensus.gemeinde && zensus.gemeinde.leerstandsquote_marktaktiv != null ? zensus.gemeinde : null;
    const ls = _gm ? _gm.leerstandsquote_marktaktiv
      : (zensus.leerstandsquote_marktaktiv != null ? zensus.leerstandsquote_marktaktiv : null);
    if (ls != null) {
      out.felder.ds2_nachfrage = { wert: ls, einheit: '% Leerstand', stufe: stufe('ds2_nachfrage', ls),
        quelle: SCHWELLEN.ds2_nachfrage.quelle + (_gm ? ' (Gemeinde ' + _gm.name + ')' : ' (Kreis' + (zensus.kreis_name ? ' ' + zensus.kreis_name : '') + ')'),
        schwelle: SCHWELLEN.ds2_nachfrage.text, stand: '15.05.2022' };
    }
  }
  out.dauer_ms = Date.now() - t0;
  return out;
}
