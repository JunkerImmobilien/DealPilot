/**
 * DealPilot — Restnutzungsdauer GND-Tabelle
 * ============================================
 * Gesamtnutzungsdauern nach Anlage 22 BewG / SW-RL / BelWertV
 * Quelle: Anlage 1 zu § 12 Abs. 5 Satz 1 ImmoWertV, KL-V (8) S. 887 f.
 *
 * Verwendung:
 *   const gnd = DealPilotRND_GND.getDefault('mfh'); // 70
 *   const list = DealPilotRND_GND.list();           // alle Optionen
 */
(function (global) {
  'use strict';

  // Struktur: id → { label, gnd_default, gnd_min, gnd_max, source }
  // gnd_default = Empfehlung für Standardfall
  const TABLE = {
    // Wohngebäude
    'efh':         { label: 'Ein-/Zweifamilienhaus, Doppel-/Reihenhaus', gnd_default: 70, gnd_min: 50, gnd_max: 100, source: 'Anl. 22 BewG' },
    'efh_std3':    { label: 'EFH Standardstufe 3 (mittel)',              gnd_default: 70, gnd_min: 60, gnd_max: 75,  source: 'SW-RL' },
    'efh_std4':    { label: 'EFH Standardstufe 4 (gehoben)',             gnd_default: 75, gnd_min: 60, gnd_max: 80,  source: 'SW-RL' },
    'efh_std5':    { label: 'EFH Standardstufe 5 (hochwertig)',          gnd_default: 80, gnd_min: 60, gnd_max: 100, source: 'SW-RL' },
    'mfh':         { label: 'Mehrfamilienhaus (Mietwohngebäude)',        gnd_default: 70, gnd_min: 30, gnd_max: 80,  source: 'Anl. 22 BewG' },
    'etw':         { label: 'Eigentumswohnung',                          gnd_default: 70, gnd_min: 30, gnd_max: 80,  source: 'Anl. 22 BewG' },
    'mischnutz':   { label: 'Wohnhaus mit Mischnutzung',                 gnd_default: 70, gnd_min: 30, gnd_max: 80,  source: 'Anl. 22 BewG' },

    // Gewerbe
    'geschaeft':   { label: 'Geschäftshaus',                             gnd_default: 60, gnd_min: 30, gnd_max: 70,  source: 'Anl. 22 BewG' },
    'buero':       { label: 'Bürogebäude',                               gnd_default: 60, gnd_min: 30, gnd_max: 70,  source: 'Anl. 22 BewG' },
    'bank':        { label: 'Bankgebäude',                               gnd_default: 60, gnd_min: 50, gnd_max: 70,  source: 'SW-RL' },

    // Beherbergung
    'hotel':       { label: 'Hotel',                                     gnd_default: 40, gnd_min: 15, gnd_max: 50,  source: 'Anl. 22 BewG' },
    'budgethotel': { label: 'Budgethotel',                               gnd_default: 40, gnd_min: 35, gnd_max: 45,  source: 'SW-RL' },
    'gaststaette': { label: 'Gaststätte',                                gnd_default: 30, gnd_min: 20, gnd_max: 40,  source: 'SW-RL' },

    // Verbrauchermärkte / Handel
    'markt':       { label: 'Verbrauchermarkt, Autohaus',                gnd_default: 30, gnd_min: 10, gnd_max: 40,  source: 'Anl. 22 BewG' },
    'kaufhaus':    { label: 'Kauf- / Warenhaus',                         gnd_default: 50, gnd_min: 15, gnd_max: 50,  source: 'Anl. 22 BewG' },

    // Garagen / Parkhäuser
    'garage_einzel':{ label: 'Einzelgarage',                             gnd_default: 60, gnd_min: 50, gnd_max: 60,  source: 'Anl. 22 BewG' },
    'garage_mehr': { label: 'Mehrfachgarage',                            gnd_default: 60, gnd_min: 50, gnd_max: 60,  source: 'SW-RL' },
    'parkhaus':    { label: 'Parkhaus / Tiefgarage',                     gnd_default: 40, gnd_min: 15, gnd_max: 40,  source: 'Anl. 22 BewG' },
    'carport':     { label: 'Carport',                                   gnd_default: 40, gnd_min: 30, gnd_max: 50,  source: 'SW-RL' },

    // Industrie / Lager
    'werkstatt':   { label: 'Gewerbe- / Industriegebäude (Werkstatt)',   gnd_default: 40, gnd_min: 15, gnd_max: 50,  source: 'Anl. 22 BewG' },
    'lager':       { label: 'Lager- / Logistikgebäude',                  gnd_default: 40, gnd_min: 15, gnd_max: 50,  source: 'Anl. 22 BewG' },
    'kaltlager':   { label: 'Warm-/Kaltlager mit Sozialtrakt',           gnd_default: 30, gnd_min: 15, gnd_max: 40,  source: 'SW-RL' },

    // Sonderbauten
    'kindergarten':{ label: 'Kindergarten / Kita',                       gnd_default: 50, gnd_min: 30, gnd_max: 50,  source: 'Anl. 22 BewG' },
    'schule':      { label: 'Schule',                                    gnd_default: 50, gnd_min: 40, gnd_max: 60,  source: 'Anl. 22 BewG' },
    'pflegeheim':  { label: 'Pflegeheim / Wohnheim',                     gnd_default: 50, gnd_min: 40, gnd_max: 70,  source: 'Anl. 22 BewG' },
    'krankenhaus': { label: 'Krankenhaus / Reha',                        gnd_default: 40, gnd_min: 15, gnd_max: 60,  source: 'Anl. 22 BewG' },
    'sporthalle':  { label: 'Sport-/Turnhalle',                          gnd_default: 40, gnd_min: 15, gnd_max: 60,  source: 'Anl. 22 BewG' }
  };

  // Heuristik: Mappt DealPilot-Objekttypen auf RND-Kategorie
  const TYPE_MAPPING = {
    'wohnung': 'etw',
    'eigentumswohnung': 'etw',
    'etw': 'etw',
    'mfh': 'mfh',
    'mehrfamilienhaus': 'mfh',
    'efh': 'efh',
    'einfamilienhaus': 'efh',
    'doppelhaus': 'efh',
    'reihenhaus': 'efh',
    'gewerbe': 'buero',
    'buero': 'buero',
    'haus': 'efh'
  };

  function getDefault(id) {
    const entry = TABLE[id];
    return entry ? entry.gnd_default : 70;
  }

  function getEntry(id) {
    return TABLE[id] || null;
  }

  function list() {
    return Object.keys(TABLE).map(function (id) {
      return Object.assign({ id: id }, TABLE[id]);
    });
  }

  function suggestFromObjectType(objType) {
    if (!objType) return 'mfh';
    const key = String(objType).toLowerCase().trim();
    return TYPE_MAPPING[key] || 'mfh';
  }

  // Validation helper
  function isValidGND(gnd, id) {
    const entry = TABLE[id];
    if (!entry) return gnd > 0 && gnd <= 150;
    return gnd >= entry.gnd_min && gnd <= entry.gnd_max;
  }

  global.DealPilotRND_GND = {
    TABLE: TABLE,
    getDefault: getDefault,
    getEntry: getEntry,
    list: list,
    suggestFromObjectType: suggestFromObjectType,
    isValidGND: isValidGND
  };
})(typeof window !== 'undefined' ? window : globalThis);
