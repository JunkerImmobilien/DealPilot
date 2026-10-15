'use strict';
const express = require('express');
const marketRatesService = require('../services/marketRatesService');
const bauzinsService = require('../services/bauzinsService');   /* v2245 */
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/v1/market-rates/current
 * Liefert aktuelle Wohnungsbau-Zinsen (variabel/1-5/5-10/über 10 Jahre).
 * Public — keine Auth nötig.
 *
 * Antwort (V28):
 *   {
 *     "rates":  { "var": 3.48, "1_5": 3.37, "5_10": 3.55, "over10": 3.26 },
 *     "labels": { "var": "variabel / bis 1 Jahr", ... },
 *     "asOf":   "2026-02-01T00:00:00.000Z",
 *     "source": "bundesbank" | "ecb" | "static" | "mixed",
 *     "sourceInfo": { "name": "...", "url": "...", "description": "..." },
 *     "fallback_used": []   // welche Buckets statischen Fallback genutzt haben
 *   }
 */
router.get('/current', async (req, res, next) => {
  try {
    const data = await marketRatesService.getCurrentRates();
    res.json({
      rates: data.rates,
      labels: data.labels,
      asOf: data.asOf,
      source: data.source,
      sourceInfo: data.sourceInfo,
      fallback_used: data.fallback_used,
      cached_until: new Date(data.fetchedAt.getTime() + 6 * 60 * 60 * 1000)
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/v1/market-rates/refresh
 * Erzwingt einen Cache-Refresh.
 * v2245: nur fuer Admins. Bis v2244 ohne Anmeldung erreichbar - jeder
 * Aufruf loeste Abrufe bei Bundesbank und EZB aus. Seit v2245 holt er
 * auch den Bauzins neu und schreibt ihn in die Datenbank.
 */
router.post('/refresh', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    marketRatesService.clearCache();
    let bauzins = null;
    try { await bauzinsService.aktualisieren({ voll: req.query.voll === '1' }); bauzins = 'aktualisiert'; }
    catch (e) { bauzins = 'fehlgeschlagen: ' + e.message; }
    const data = await marketRatesService.getCurrentRates();
    res.json({ refreshed: true, rates: data.rates, source: data.source, asOf: data.asOf, bauzins: bauzins });
  } catch (err) { next(err); }
});

/**
 * v2245: GET /api/v1/market-rates/bauzins
 * Der marktabhaengige indikative Bauzins mit allen Bausteinen.
 * Public (wie /pfandbrief; die Landing liest ohne Anmeldung).
 *
 *   Bauzins(b, LTV) = formel.bund[b] + formel.aufschlag[b] + formel.k + Z(LTV)
 *   Z(LTV) linear zwischen formel.zuschlaege [[ltv, pp], ...], Bezug 80 %.
 *
 * ?ltv=85 liefert zusaetzlich `fuer_ltv` { ltv, zuschlag, rates{b} }.
 */
router.get('/bauzins', async (req, res, next) => {
  try {
    const d = await bauzinsService.getBauzins();
    const out = Object.assign({}, d);
    const ltv = req.query.ltv != null ? Number(String(req.query.ltv).replace(',', '.')) : null;
    if (ltv != null && isFinite(ltv) && ltv > 0 && ltv < 300) {
      const rates = {};
      d.maturities.forEach(b => {
        const f = d.formel;
        rates[b] = (f.bund[b] != null && f.aufschlag[b] != null) ? bauzinsService.zinsFuer(f.bund[b], f.aufschlag[b], ltv) : null;
      });
      out.fuer_ltv = { ltv: ltv, zuschlag: bauzinsService.zuschlagLtv(ltv), rates: rates };
    }
    res.json(out);
  } catch (err) { next(err); }
});

/**
 * V209: GET /api/v1/market-rates/history?months=12
 * Liefert echte Bundesbank-Zeitreihe für alle 4 Buckets.
 * Public — keine Auth nötig. Cache 24h.
 *
 * Antwort:
 *   {
 *     "months": 12,
 *     "series": {
 *       "var":    [{ "period": "2025-05", "value": 4.12 }, ...],
 *       "1_5":    [...],
 *       "5_10":   [...],
 *       "over10": [...]
 *     },
 *     "labels": { "var": "variabel / bis 1 Jahr", ... },
 *     "source": "bundesbank" | "unavailable",
 *     "sourceInfo": { "name": "...", "url": "..." },
 *     "fallback_used": []   // welche Buckets leer waren (keine API-Daten)
 *   }
 */
router.get('/history', async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 12;
    const data = await marketRatesService.getHistoricalRates({ months });
    res.json({
      months: data.months,
      series: data.series,
      labels: data.labels,
      source: data.source,
      sourceInfo: data.sourceInfo,
      fallback_used: data.fallback_used,
      fetched_at: data.fetchedAt
    });
  } catch (err) { next(err); }
});

/**
 * V210: GET /api/v1/market-rates/pfandbrief?maturities=5,10,15,20
 * Liefert Pfandbrief-Renditen + indikative Bauzinsen (Yield + Marge).
 *
 * Antwort:
 *   {
 *     "maturities": ["5","10","15","20"],
 *     "yields":  { "5": 2.85, "10": 3.05, "15": 3.18, "20": 3.28 },
 *     "margins": { "premium": 0.25, "standard": 0.40, "schwach": 0.80 },
 *     "indicativeRates": {
 *       "5":  { "premium": 3.65, "standard": 4.05, "schwach": 4.65 },
 *       "10": { ... },
 *       "15": { ... },
 *       "20": { ... }
 *     },
 *     "sources":  { "5":"live", "10":"live", "15":"static", "20":"static" },
 *     "periods":  { "5":"2026-05", ... },
 *     "source":   "live" | "static" | "mixed" | "unavailable",
 *     "sourceInfo": { "name": "...", "url": "...", "description": "..." },
 *     "asOf": "..."
 *   }
 */
router.get('/pfandbrief', async (req, res, next) => {
  try {
    let maturities = ['5', '10', '15', '20'];
    if (req.query.maturities) {
      maturities = String(req.query.maturities).split(',').map(s => s.trim()).filter(Boolean);
    }
    const data = await marketRatesService.getPfandbriefRates({ maturities });
    res.json({
      maturities: data.maturities,
      yields: data.yields,
      margins: data.margins,
      margins_bezug: data.margins_bezug,     // v2245
      modell: data.modell,                   // v2245: 'bund+aufschlag' | 'pfandbrief+marge'
      indicativeRates: data.indicativeRates,
      formel: data.formel,                   // v2245: bund, aufschlag, aufschlag_monat, k, zuschlaege
      stufen_ltv: data.stufen_ltv,           // v2245: premium 60, standard 80, schwach 90
      verlauf: data.verlauf,                 // v2245: wochen[], monate[] fuer die Aufschlag-Grafik
      sources: data.sources,
      periods: data.periods,
      source: data.source,
      sourceInfo: data.sourceInfo,
      asOf: data.asOf,
      fetched_at: data.fetchedAt
    });
  } catch (err) { next(err); }
});

/**
 * V211: GET /api/v1/market-rates/market-context
 * Liefert EZB-Leitzins + EURIBOR 3M (+ Trend zu Vormonat).
 *
 * Antwort:
 *   {
 *     "ecb_mrr":    { value, period, previousValue, trend, source },
 *     "euribor_3m": { value, period, previousValue, trend, source },
 *     "source": "live" | "static" | "mixed",
 *     "sourceInfo": { name, url }
 *   }
 */
router.get('/market-context', async (req, res, next) => {
  try {
    const data = await marketRatesService.getMarketContext();
    res.json(data);
  } catch (err) { next(err); }
});

module.exports = router;
