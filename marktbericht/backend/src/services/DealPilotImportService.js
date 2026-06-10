// DealPilotImportService.js
// Importiert DealPilot-Objekte als echte Vergleichsdatenpunkte in mb.offers.
//
// DealPilot-Objekte kommen entweder flach ({ kp, nkm, wfl, plz, ort, ... })
// oder als Backend-Objekt mit data-Wrapper ({ id, data: { kp, nkm, ... } }).
// Pro Objekt entstehen bis zu zwei Angebote:
//   - listing_type 'kauf'  aus Kaufpreis
//   - listing_type 'miete' aus Nettokaltmiete (Monatsmiete)
// Beide am selben (geokodierten) Standort. Quelle: source_code='dealpilot_import'.

import { q } from '../lib/db.js';
import { GeocodingService } from './GeocodingService.js';
import { GeoapifyConnector } from '../connectors/GeoapifyConnector.js';

// Toleranter Feldzugriff: prüft mehrere mögliche Feldnamen (Kurz- + Langform).
function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
  }
  return null;
}

function num(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

// DealPilot-Objektart -> unser property_type
function mapPropertyType(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (/etw|wohnung|eigentumswohnung/.test(s)) return 'wohnung';
  if (/efh|einfamilien|reihenhaus|doppelhaus|haus/.test(s)) return 'haus';
  if (/mfh|mehrfamilien/.test(s)) return 'mfh';
  if (/gewerbe/.test(s)) return 'gewerbe';
  return null;
}

function buildAddress(d) {
  const str = pick(d, ['str', 'strasse', 'straße']);
  const hnr = pick(d, ['hnr', 'hausnummer']);
  const plz = pick(d, ['plz']);
  const ort = pick(d, ['ort', 'stadt']);
  const adr = pick(d, ['adresse']);
  if (adr) return String(adr);
  const line1 = [str, hnr].filter(Boolean).join(' ');
  const line2 = [plz, ort].filter(Boolean).join(' ');
  return [line1, line2].filter(Boolean).join(', ').trim();
}

// Extrahiert die data-Ebene (flach oder {data:{...}})
function dataOf(obj) {
  if (obj && typeof obj === 'object' && obj.data && typeof obj.data === 'object') return obj.data;
  return obj || {};
}

export const DealPilotImportService = {
  // objects: Array von DealPilot-Objekten. Gibt {imported, skipped, details} zurück.
  async importObjects(objects) {
    const result = { imported: 0, offers_created: 0, skipped: 0, details: [] };

    for (const raw of objects) {
      const d = dataOf(raw);
      const kp = num(pick(d, ['kp', 'kaufpreis']));
      const nkm = num(pick(d, ['nkm', 'nettokaltmiete']));
      const wfl = num(pick(d, ['wfl', 'wohnflaeche', 'wohnfläche']));
      const baujahr = num(pick(d, ['baujahr']));
      const zimmer = num(pick(d, ['zimmer']));
      const ptype = mapPropertyType(pick(d, ['objart', 'objektart']));
      const condition = pick(d, ['zustand']) || null;
      const energy = pick(d, ['energieklasse', 'ds2_energie', 'energie_label']);
      const plz = pick(d, ['plz']);
      const ort = pick(d, ['ort', 'stadt']);

      // Standort: vorhandene lat/lon nutzen, sonst Adresse geokodieren
      let lat = num(pick(d, ['lat', 'latitude']));
      let lon = num(pick(d, ['lon', 'lng', 'longitude']));
      const addr = buildAddress(d);

      if ((lat == null || lon == null) && addr && GeoapifyConnector.available()) {
        try {
          const g = await GeocodingService.geocode(addr);
          if (g) { lat = g.lat; lon = g.lon; }
        } catch { /* weiter ohne Koordinaten */ }
      }

      if (lat == null || lon == null) {
        result.skipped++;
        result.details.push({ addr: addr || '(keine Adresse)', status: 'kein Standort (Geocoding fehlgeschlagen / kein Geoapify-Key)' });
        continue;
      }
      if (!wfl) {
        result.skipped++;
        result.details.push({ addr, status: 'keine Wohnfläche – übersprungen' });
        continue;
      }

      const offerDate = pick(d, ['kaufdat', 'kaufdatum']) || new Date().toISOString().slice(0, 10);
      let created = 0;

      // Kauf-Angebot
      if (kp) {
        await insertOffer({ listing_type: 'kauf', price: kp, price_per_sqm: kp / wfl,
          ptype, plz, ort, lat, lon, wfl, zimmer, baujahr, condition, energy, offerDate });
        created++;
      }
      // Miet-Angebot (Monatsmiete)
      if (nkm) {
        await insertOffer({ listing_type: 'miete', price: nkm, price_per_sqm: nkm / wfl,
          ptype, plz, ort, lat, lon, wfl, zimmer, baujahr, condition, energy, offerDate });
        created++;
      }

      if (created === 0) {
        result.skipped++;
        result.details.push({ addr, status: 'weder Kaufpreis noch Miete – übersprungen' });
      } else {
        result.imported++;
        result.offers_created += created;
        result.details.push({ addr, status: `ok (${created} Angebot${created > 1 ? 'e' : ''})` });
      }
    }
    return result;
  },
};

async function insertOffer(o) {
  await q(
    `INSERT INTO mb.offers
      (source_code,listing_type,property_type,postcode,city,lat,lon,geom,
       living_area,rooms,build_year,condition,energy_class,price,price_per_sqm,offer_date)
     VALUES ('dealpilot_import',$1,$2,$3,$4,$5,$6, ST_SetSRID(ST_MakePoint($6,$5),4326),
       $7,$8,$9,$10,$11,$12,$13,$14)`,
    [o.listing_type, o.ptype, o.plz || null, o.ort || null, o.lat, o.lon,
     o.wfl, o.zimmer, o.baujahr, o.condition, o.energy ? String(o.energy).toUpperCase() : null,
     Math.round(o.price), Math.round(o.price_per_sqm * 100) / 100, o.offerDate]
  );
}
