// AgsResolver.js — ermittelt aus einer PLZ den 5-stelligen Kreis-Schluessel (AGS).
// Quelle: OpenPLZ API (openplzapi.org) – kostenlos, kein Token, DACH-Verwaltungsdaten.
// Wird fuer den regionalen GENESIS-Abruf (Regionalstatistik) gebraucht: GENESIS adressiert
// Kreise ueber den 5-stelligen AGS (z. B. 05758 = Kreis Herford).
import { httpJson } from '../lib/http.js';
import { cacheGet, cacheSet } from '../lib/cache.js';

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // AGS aendert sich praktisch nie -> 30 Tage cachen

/* v1392 · Die ersten zwei Ziffern des Amtlichen Gemeindeschluessels sind
   das Bundesland. Amtlich, eindeutig und ohne Grenzfaelle - im Gegensatz
   zur Postleitzahl, die ueber Landesgrenzen reichen kann. */
const LAND_AUS_AGS = {
  '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE',
  '07': 'RP', '08': 'BW', '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB',
  '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH',
};

export const AgsResolver = {
  // postcode -> { kreis_ags, kreis_name, bundesland, gemeinde_ags } | null
  async fromPostcode(postcode) {
    const plz = (postcode || '').toString().trim();
    if (!/^\d{5}$/.test(plz)) return null;
    const ck = 'ags:' + plz;
    const cached = cacheGet(ck);
    if (cached !== undefined) return cached;

    let out = null;
    try {
      const data = await httpJson(`https://openplzapi.org/de/Localities?postalCode=${plz}`, { timeoutMs: 10000, retries: 1 });
      const loc = Array.isArray(data) ? data[0] : (data && data.content ? data.content[0] : null);
      if (loc) {
        // district = Kreis (bei kreisfreien Staedten ggf. null -> dann aus Gemeinde-AGS ableiten)
        const gemAgs = loc.municipality && loc.municipality.key ? String(loc.municipality.key) : null;
        const krsAgs = loc.district && loc.district.key ? String(loc.district.key)
          : (gemAgs ? gemAgs.slice(0, 5) : null);
        if (krsAgs) {
          out = {
            kreis_ags: krsAgs.slice(0, 5),
            kreis_name: (loc.district && loc.district.name) || (loc.municipality && loc.municipality.name) || null,
            bundesland: loc.federalState && loc.federalState.name ? loc.federalState.name : null,
            /* v1392: Das Kuerzel aus den ersten zwei Ziffern des AGS. Das
               ist die amtliche Zuordnung und eindeutig - anders als eine
               Postleitzahl, die ueber Landesgrenzen reichen kann, und
               anders als der Landesname, den man erst uebersetzen muesste.
               Der Bodenrichtwert-Abruf braucht genau das (v1388). */
            land_code: LAND_AUS_AGS[krsAgs.slice(0, 2)] || null,
            gemeinde_ags: gemAgs,
          };
        }
      }
    } catch { out = null; }

    cacheSet(ck, out, TTL_MS);
    return out;
  },
};
