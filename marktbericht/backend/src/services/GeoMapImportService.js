// GeoMapImportService.js
// Holt echte GeoMap-Angebote (Kauf + Miete) für einen Standort und schreibt sie
// nach mb.offers (source_code='geomap'). Kostenbewusst: begrenzte Detail-Abrufe,
// Dedup gegen vorhandene geomap-Zeilen im selben Radius (vermeidet Doppelkosten).
import { q, q1 } from '../lib/db.js';
import { cfg } from '../lib/config.js';
import { GeoMapConnector } from '../connectors/GeoMapConnector.js';

export const GeoMapImportService = {
  // params: { lat, lon, radiusKm?, maxDetails?, force? }
  async importLocation({ lat, lon, radiusKm, maxDetails, force }) {
    if (!GeoMapConnector.available()) {
      const e = new Error('GeoMap nicht konfiguriert (GEOMAP_TOKEN fehlt).');
      e.status = 400;
      throw e;
    }
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      const e = new Error('lat/lon erforderlich.');
      e.status = 400;
      throw e;
    }

    const radius = radiusKm || cfg.geomap.radiusKm;

    // Dedup/Cache: wenn nicht force und schon frische geomap-Daten in der Nähe (≤ radius,
    // < 30 Tage alt), nicht erneut abrufen -> spart Guthaben.
    if (!force) {
      const existing = await q1(
        `SELECT COUNT(*)::int AS n FROM mb.offers
         WHERE source_code='geomap'
           AND created_at > now() - interval '30 days'
           AND ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2,$1),4326)::geography, $3)`,
        [lat, lon, radius * 1000]
      );
      if (existing && existing.n >= 20) {
        return { skipped: true, reason: 'cache_hit', existing: existing.n,
                 message: `Bereits ${existing.n} frische GeoMap-Angebote im Umkreis – kein neuer Abruf (force=true erzwingt).` };
      }
    }

    const balanceBefore = await GeoMapConnector.getBalance();

    // Kauf + Miete getrennt abrufen
    const [kauf, miete] = await Promise.all([
      GeoMapConnector.marketOffers({ lat, lon, radiusKm: radius, offerType: 'Kauf', maxDetails }),
      GeoMapConnector.marketOffers({ lat, lon, radiusKm: radius, offerType: 'Miete', maxDetails }),
    ]);

    const all = [...(kauf.offers || []), ...(miete.offers || [])];
    let written = 0;
    for (const o of all) {
      await q(
        `INSERT INTO mb.offers
          (source_code,listing_type,property_type,postcode,city,lat,lon,geom,
           living_area,rooms,build_year,condition,energy_class,price,price_per_sqm,offer_date)
         VALUES ('geomap',$1,$2,$3,$4,$5,$6, ST_SetSRID(ST_MakePoint($6,$5),4326),
           $7,$8,$9,$10,$11,$12,$13,$14)`,
        [o.listing_type, o.property_type, o.postcode, o.city, o.lat, o.lon,
         o.living_area, o.rooms, o.build_year, o.condition, o.energy_class,
         o.price, o.price_per_sqm, o.offer_date]
      );
      written++;
    }

    const balanceAfter = await GeoMapConnector.getBalance();

    return {
      skipped: false,
      radius_km: radius,
      kauf: { found: kauf.totalResults, details: kauf.fetchedDetails },
      miete: { found: miete.totalResults, details: miete.fetchedDetails },
      offers_written: written,
      balance_before_eur: balanceBefore,
      balance_after_eur: balanceAfter,
      cost_eur: (balanceBefore != null && balanceAfter != null)
        ? Math.round((balanceBefore - balanceAfter) * 100) / 100 : null,
    };
  },
};
