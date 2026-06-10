// GeocodingService.js — Adresse -> Koordinaten via Geoapify, mit DB-Cache.
import { GeoapifyConnector } from '../connectors/GeoapifyConnector.js';
import { q, q1 } from '../lib/db.js';

export const GeocodingService = {
  async geocode(address) {
    // Cache-Treffer?
    const cached = await q1(
      'SELECT * FROM mb.addresses WHERE raw = $1 AND lat IS NOT NULL ORDER BY id DESC LIMIT 1',
      [address]
    );
    if (cached) {
      return {
        lat: cached.lat, lon: cached.lon, confidence: cached.geocode_conf,
        formatted: cached.raw, components: {
          street: cached.street, postcode: cached.postcode, city: cached.city,
          district: cached.district, state: cached.state,
        }, cached: true, address_id: cached.id,
      };
    }

    const g = await GeoapifyConnector.geocode(address);
    if (!g) return null;

    const row = await q1(
      `INSERT INTO mb.addresses (raw,street,house_number,postcode,city,district,state,country,lat,lon,geom,geocoder,geocode_conf)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, ST_SetSRID(ST_MakePoint($10,$9),4326), 'geoapify', $11)
       RETURNING id`,
      [address, g.components.street, g.components.house_number, g.components.postcode,
       g.components.city, g.components.district, g.components.state, g.components.country || 'DE',
       g.lat, g.lon, g.confidence]
    );
    return { ...g, cached: false, address_id: row.id };
  },
};
