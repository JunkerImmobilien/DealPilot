// BorisConnector.js — duenne Fassade ueber die Multi-Land-Registry.
// Echte Logik liegt in boris/registry.js. Haelt die bisherige Schnittstelle
// landValue({lat,lon,year}) stabil und reicht den manuellen DealPilot-brw durch.
import { BorisRegistry } from './boris/registry.js';

export const BorisConnector = {
  code: 'boris',
  available() { return true; }, // Open-Data-Laender + manueller Fallback => immer "da"
  status() { return BorisRegistry.status(); },
  /* v1388-WLAND: `land` ist OPTIONAL und aendert ohne Angabe nichts. Es
     loest den Fall, dass ein Punkt im Rechteck eines fremden Landes liegt
     (Rinteln/NI im NRW-Rechteck) - siehe registry.js. */
  async landValue({ lat, lon, year, manualBrw, land }) {
    return BorisRegistry.landValue({ lat, lon, year, manualBrw, land });
  },
  async probe(lat, lon) { return BorisRegistry.probe(lat, lon); },
  async verifyAll() { return BorisRegistry.verifyAll(); },
};
