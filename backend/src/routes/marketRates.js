'use strict';
const express = require('express');
const marketRatesService = require('../services/marketRatesService');

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
 */
router.post('/refresh', async (req, res, next) => {
  try {
    marketRatesService.clearCache();
    const data = await marketRatesService.getCurrentRates();
    res.json({ refreshed: true, rates: data.rates, source: data.source, asOf: data.asOf });
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
 *     "margins": { "premium": 0.8, "standard": 1.2, "schwach": 1.8 },
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
      indicativeRates: data.indicativeRates,
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
