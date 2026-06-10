// BorisConnector.js — duenne Fassade ueber die Multi-Land-Registry.
// Echte Logik liegt in boris/registry.js. Haelt die bisherige Schnittstelle
// landValue({lat,lon,year}) stabil und reicht den manuellen DealPilot-brw durch.
import { BorisRegistry } from './boris/registry.js';

export const BorisConnector = {
  code: 'boris',
  available() { return true; }, // Open-Data-Laender + manueller Fallback => immer "da"
  status() { return BorisRegistry.status(); },
  async landValue({ lat, lon, year, manualBrw }) {
    return BorisRegistry.landValue({ lat, lon, year, manualBrw });
  },
  async probe(lat, lon) { return BorisRegistry.probe(lat, lon); },
  async verifyAll() { return BorisRegistry.verifyAll(); },
};
