// seed.js — generiert realistische Vergleichsangebote (Kauf + Miete) um echte
// Stadt-Koordinaten herum. Ersetzt die fehlende kostenlose DE-Marktdaten-API.
// Basispreise grob am Markt orientiert; Streuung simuliert echte Angebotsvielfalt.
import { pool, q } from './db.js';

// Stadt, Zentrum, Basis-Kaufpreis €/m², Basis-Miete €/m², PLZ
const CITIES = [
  { city: 'Hüllhorst',  lat: 52.3186, lon: 8.6710, kp: 2600, mt: 8.5,  plz: '32609' },
  { city: 'Bielefeld',  lat: 52.0302, lon: 8.5325, kp: 3200, mt: 10.0, plz: '33602' },
  { city: 'Hannover',   lat: 52.3759, lon: 9.7320, kp: 3900, mt: 11.5, plz: '30159' },
  { city: 'Osnabrück',  lat: 52.2799, lon: 8.0472, kp: 3000, mt: 9.8,  plz: '49074' },
  { city: 'Münster',    lat: 51.9607, lon: 7.6261, kp: 4200, mt: 12.0, plz: '48143' },
  { city: 'Berlin',     lat: 52.5200, lon: 13.4050, kp: 5200, mt: 14.5, plz: '10115' },
];

const PROP_TYPES = ['wohnung', 'haus'];
const CONDITIONS = ['neuwertig', 'gepflegt', 'renovierungsbeduerftig'];
const ENERGY = ['A', 'B', 'C', 'D', 'E', 'F'];

function gauss(mean, sd) {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function jitterCoord(base, meters) {
  // ~ grobe Umrechnung: 1 Grad lat ~ 111km
  const dLat = (gauss(0, meters) / 111000);
  const dLon = (gauss(0, meters) / (111000 * Math.cos((base * Math.PI) / 180)));
  return dLat || dLon;
}

function makeOffer(cityObj, listingType) {
  const ptype = pick(PROP_TYPES);
  const area = ptype === 'haus' ? Math.round(gauss(140, 35)) : Math.round(gauss(72, 22));
  const livingArea = Math.max(28, area);
  const buildYear = Math.round(gauss(1985, 25));
  const condition = pick(CONDITIONS);
  const energy = pick(ENERGY);

  // Conditionsfaktor wirkt auf Preis
  const condFactor = condition === 'neuwertig' ? 1.12 : condition === 'renovierungsbeduerftig' ? 0.85 : 1.0;

  let pricePerSqm, price;
  if (listingType === 'kauf') {
    pricePerSqm = Math.max(800, gauss(cityObj.kp * condFactor, cityObj.kp * 0.16));
    price = Math.round(pricePerSqm * livingArea);
    pricePerSqm = Math.round(pricePerSqm);
  } else {
    const rentSqm = Math.max(4, gauss(cityObj.mt * condFactor, cityObj.mt * 0.14));
    price = Math.round(rentSqm * livingArea);
    pricePerSqm = Math.round(rentSqm * 100) / 100;
  }

  const lat = cityObj.lat + jitterCoord(cityObj.lat, 1800);
  const lon = cityObj.lon + jitterCoord(cityObj.lat, 1800);
  const daysAgo = Math.floor(Math.random() * 330);
  const offerDate = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

  return {
    source_code: 'seed',
    listing_type: listingType,
    property_type: ptype,
    postcode: cityObj.plz,
    city: cityObj.city,
    lat, lon,
    living_area: livingArea,
    rooms: Math.max(1, Math.round(livingArea / 28)),
    build_year: buildYear,
    condition,
    energy_class: energy,
    price,
    price_per_sqm: pricePerSqm,
    offer_date: offerDate,
  };
}

async function run() {
  const perCityPerType = parseInt(process.env.SEED_N || '60', 10);
  await q('DELETE FROM mb.offers WHERE source_code = $1', ['seed']);

  let total = 0;
  for (const c of CITIES) {
    for (const lt of ['kauf', 'miete']) {
      const rows = [];
      for (let i = 0; i < perCityPerType; i++) rows.push(makeOffer(c, lt));
      for (const o of rows) {
        await q(
          `INSERT INTO mb.offers
            (source_code,listing_type,property_type,postcode,city,lat,lon,geom,
             living_area,rooms,build_year,condition,energy_class,price,price_per_sqm,offer_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7, ST_SetSRID(ST_MakePoint($7,$6),4326),
             $8,$9,$10,$11,$12,$13,$14,$15)`,
          [o.source_code, o.listing_type, o.property_type, o.postcode, o.city, o.lat, o.lon,
           o.living_area, o.rooms, o.build_year, o.condition, o.energy_class, o.price, o.price_per_sqm, o.offer_date]
        );
        total++;
      }
    }
  }
  console.log(`[seed] ${total} Angebote erzeugt (${CITIES.length} Städte x ${perCityPerType} x 2 Typen).`);
  await pool.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
