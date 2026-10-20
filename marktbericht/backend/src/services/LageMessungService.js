// LageMessungService.js — v2175 · N62.19 B
//
// Marcel am 13.10.2026: „Macht im Tab Objekt die ‚Lage analysieren' noch
// Sinn? ... koennen wir das mit unseren vorhandenen Daten aus den
// Datenbanken und Schnittstellen besser? Oder vielleicht auch beides und
// im Vergleich?"
//
// GEMESSEN vorher: „Lage analysieren" war reine KI mit Websuche
// (openaiService.analyzeLage), Quellen ungeprueft, sechs Felder.
// Diese lassen sich MESSEN:
//
//   makrolage         macroScore aus mb.makro_werte (4 Kennzahlen, Gemeinde vor Kreis)
//   mikrolage         Umfeld-Score (6 Gruppen, 2 km)
//   ds2_bevoelkerung  Bevoelkerungstrend %/Jahr (Gemeinde vor Kreis, 12 Jahre)
//   ds2_nachfrage     Vermarktungsdauer der Angebote (Median Tage, Kauf, 12 Monate)
//   ds2_mietausfall   marktaktiver Leerstand laut Zensus 2022 (Gemeinde vor Kreis)
//
// v2518 · Marcel am 20.10.2026: „Nachfrage" heisst ueberall Vermarktungsdauer
// der Angebote (wie im Bericht); der Zensus-Leerstand wandert unter das
// Mietausfallrisiko. Und EINE Skala fuer Bericht und Messdienst: die
// Schwellen stehen in lib/lage_stufen.js, mit Begruendung, und gelten fuer
// beide. Bis hier stand hier eine eigene Tabelle (SCHWELLEN), und die
// Nachfrage wurde aus dem Leerstand abgeleitet, waehrend der Bericht sie
// aus der Angebotsdauer las - dasselbe Wort fuer zwei Messgroessen.
//
// Kein Treffer heisst kein Wert: ein Feld ohne Messung bleibt leer.

import { GeocodingService } from './GeocodingService.js';
import { MicroLocationService } from './MicroLocationService.js';
import { MarketInsightsService } from './MarketInsightsService.js';
import { ScoringService } from './ScoringService.js';
import { DestatisConnector } from '../connectors/stubConnectors.js';
import { AgsResolver } from '../connectors/AgsResolver.js';
import { ZensusConnector } from '../connectors/ZensusConnector.js';
import { einstufen, schwelleText, zensusLeerstand, ZENSUS_LEERSTAND_TEXT } from '../lib/lage_stufen.js';

const QUELLE = {
  makrolage: 'Makro-Score aus der Regionaldatenbank (Bevölkerung, Kaufkraft, Arbeitslosigkeit, Wanderung)',
  mikrolage: 'Umfeld-Score (Einkaufen, ÖPNV, Gesundheit, Freizeit, Bildung, Gastronomie, 2 km)',
  ds2_bevoelkerung: 'Bevölkerungsentwicklung je Jahr, Regionaldatenbank',
  ds2_nachfrage: 'Vermarktungsdauer der Angebote (Kauf, Median der letzten 12 Monate)',
  ds2_mietausfall: ZENSUS_LEERSTAND_TEXT + ', marktaktiver Leerstand',
};
const SKALA = { makrolage: 'makrolage', mikrolage: 'mikrolage', ds2_bevoelkerung: 'bevoelkerung',
  ds2_nachfrage: 'nachfrage', ds2_mietausfall: 'mietausfall' };

function feld(id, wert, einheit, zusatz) {
  const e = einstufen(SKALA[id], wert);
  if (!e) return null;
  return Object.assign({ wert, einheit, stufe: e.stufe, wort: e.wort, ton: e.ton,
    quelle: QUELLE[id], schwelle: schwelleText(SKALA[id]) }, zusatz || {});
}

const ebeneText = (eb, name) => eb + (name ? ' ' + name : '');

export async function messeLage({ adresse, plz, ort, objektart }) {
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

  /* Die Vermarktungsdauer braucht Koordinaten - ohne Adresse (Aufruf nur mit
     PLZ) gibt es sie nicht, und dann bleibt die Nachfrage leer. Hoechstens
     6 s, damit der Messdienst nicht am Marktdaten-Abruf haengt. */
  const vmdP = geo ? Promise.race([
    MarketInsightsService.vermarktungsdauer({ lat: geo.lat, lon: geo.lon, property_type: objektart || null }).catch(() => null),
    new Promise((ok) => setTimeout(() => ok(null), 6000)),
  ]) : Promise.resolve(null);

  const [macroRaw, micro, zensus, vmd] = await Promise.all([
    ags && ags.kreis_ags ? DestatisConnector.macro({ ags: ags.kreis_ags, city, gemeindeAgs: gem && gem.gemeinde_ags }).catch(() => null) : null,
    geo ? MicroLocationService.analyze(geo.lat, geo.lon, 2000).catch(() => null) : null,
    ags && ags.kreis_ags ? ZensusConnector.lookupDb({ kreisAgs: ags.kreis_ags, gemeindeAgs: gem && gem.gemeinde_ags }).catch(() => null) : null,
    vmdP,
  ]);

  /* Makro: wie im Bericht erst ab zwei gemessenen Kennzahlen (v2158). */
  if (macroRaw && macroRaw.available) {
    const m = ScoringService.macroScore(macroRaw.metrics || null);
    const eb = macroRaw.ebenen || {};
    if (m && m.score != null && m.estimated === false && (m.gemessen ?? 0) >= 2) {
      const f = feld('makrolage', Math.round(m.score), 'Score', {
        stand: macroRaw.jahre || null, aus: macroRaw.herkunft || 'regionaldatenbank_live',
        ebene: Object.values(eb).includes('Gemeinde') ? 'Gemeinde und Kreis' : 'Kreis' });
      if (f) out.felder.makrolage = f;
    }
    const tr = macroRaw.metrics && macroRaw.metrics.bevoelkerung_trend;
    if (tr != null && Number.isFinite(tr)) {
      const ebB = eb.bevoelkerung || 'Kreis';
      const ebW = eb.wanderung || 'Kreis';
      const f = feld('ds2_bevoelkerung', Math.round(tr * 100) / 100, '%/Jahr', {
        quelle: QUELLE.ds2_bevoelkerung + ' (' + ebeneText(ebB, ebB === 'Gemeinde' ? macroRaw.gemeinde_name : macroRaw.kreis_name) + ')',
        stand: macroRaw.jahre && macroRaw.jahre.bevoelkerung || null,
        ebene: ebB,
        /* v2501 · wanderungssaldo steht in PROZENT (je 10.000 EW / 100).
           Gezeigt je 1.000 EW, deutsches Komma; v2518 mit Ebene. */
        zusatz: macroRaw.metrics.wanderungssaldo != null ? 'Wanderungssaldo ' + String(Math.round(macroRaw.metrics.wanderungssaldo * 100) / 10).replace('.', ',') + ' je 1.000 EW (' + ebW + ')' : null });
      if (f) out.felder.ds2_bevoelkerung = f;
    }
  }
  if (micro && micro.score != null && micro.source !== 'none') {
    const f = feld('mikrolage', Math.round(micro.score), 'Score');
    if (f) out.felder.mikrolage = f;
  }
  if (vmd && vmd.tage != null) {
    const f = feld('ds2_nachfrage', Math.round(vmd.tage), 'Tage', { stand: vmd.von + ' bis ' + vmd.bis });
    if (f) out.felder.ds2_nachfrage = f;
  }
  /* v2501 · Gemeinde vor Kreis, das Etikett nennt die Ebene, deren Wert es ist. */
  const ls = zensusLeerstand(zensus);
  if (ls) {
    const f = feld('ds2_mietausfall', ls.wert, '% Leerstand', {
      quelle: QUELLE.ds2_mietausfall + ' (' + ebeneText(ls.ebene, ls.name) + ')', stand: '15.05.2022', ebene: ls.ebene });
    if (f) out.felder.ds2_mietausfall = f;
  }
  out.dauer_ms = Date.now() - t0;
  return out;
}
