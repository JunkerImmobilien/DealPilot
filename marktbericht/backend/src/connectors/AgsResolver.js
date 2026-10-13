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
  /* v2162 · Die Gemeinde EINDEUTIG. fromPostcode() nimmt die ERSTE Ortschaft
     der Postleitzahl - bei einer PLZ ueber mehrere Gemeinden waere ein
     Gemeindewert damit still falsch. Hier gilt: eine Gemeinde je PLZ, oder
     die, deren Name zum Ort der Adresse passt. Sonst null - dann zeigt der
     Bericht den Kreiswert, als Kreiswert beschriftet. */
  async gemeindeEindeutig(postcode, ort) {
    const plz = (postcode || '').toString().trim();
    if (!/^\d{5}$/.test(plz)) return null;
    let data;
    try { data = await httpJson('https://openplzapi.org/de/Localities?postalCode=' + plz, { timeoutMs: 10000, retries: 1 }); }
    catch { return null; }
    const liste = Array.isArray(data) ? data : (data && data.content) || [];
    const gem = new Map();
    for (const l of liste) {
      if (l && l.municipality && l.municipality.key) gem.set(String(l.municipality.key), { name: l.municipality.name || '', orte: [] });
    }
    for (const l of liste) { if (l && l.municipality && gem.has(String(l.municipality.key))) gem.get(String(l.municipality.key)).orte.push(String(l.name || '')); }
    if (gem.size === 1) return { gemeinde_ags: [...gem.keys()][0], eindeutig: 'plz' };
    const o = String(ort || '').toLowerCase().trim();
    if (!o) return null;
    const passt = [...gem.entries()].filter(([, g]) =>
      g.name.toLowerCase().startsWith(o) || o.startsWith(g.name.toLowerCase().split(',')[0]) || g.orte.some((n) => n.toLowerCase() === o));
    return passt.length === 1 ? { gemeinde_ags: passt[0][0], eindeutig: 'ort' } : null;
  },

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
