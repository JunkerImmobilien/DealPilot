/**
 * DealPilot — Restnutzungsdauer GND-Tabelle
 * ============================================
 * Version 3.3.0 (13.09.2026)
 * Gesamtnutzungsdauern nach Anlage 1 zu § 12 Absatz 5 Satz 1 ImmoWertV 2021
 *
 * FACHLICHE GRUNDLAGE:
 * Für ein RND-Gutachten nach § 7 Abs. 4 Satz 2 EStG ist die ImmoWertV 2021
 * maßgeblich (bestätigt durch BFH IX R 25/19 vom 28.07.2021 und
 * BMF-Schreiben vom 01.12.2025), NICHT die Anlage 22 BewG. Anlage 22 BewG
 * gilt nur für die pauschale Grundbesitzbewertung (Erbschaft/Schenkung).
 *
 * ÄNDERUNG ggü. V3.2.0:
 *   Wohngebäude (EFH/MFH/ETW/Reihenhaus): 70 → 80 Jahre
 *   Quelle-Referenzen: "Anl. 22 BewG" → "Anl. 1 ImmoWertV"
 *   BewG-70J bleibt als bewusster Kommentar zur Erinnerung an den Unterschied
 *
 * Verwendung:
 *   const gnd = DealPilotRND_GND.getDefault('mfh'); // 80
 *   const list = DealPilotRND_GND.list();
 */
(function (global) {
  'use strict';

  // Struktur: id → { label, gnd_default, gnd_min, gnd_max, source, note }
  // gnd_default = Empfehlung für Standardfall (ImmoWertV 2021)
  // note = optionaler Hinweis auf Abweichung nach BewG
  const TABLE = {
    // ─── Wohngebäude (ImmoWertV 2021: 80 Jahre — BewG-Alternative 70) ───
    'efh':         { label: 'Ein-/Zweifamilienhaus, Doppel-/Reihenhaus', gnd_default: 80, gnd_min: 60, gnd_max: 100, source: 'Anl. 1 ImmoWertV', note: 'BewG Anl. 22: 70 J.' },
    'efh_std3':    { label: 'EFH Standardstufe 3 (mittel)',              gnd_default: 80, gnd_min: 60, gnd_max: 90,  source: 'Anl. 1 ImmoWertV / SW-RL' },
    'efh_std4':    { label: 'EFH Standardstufe 4 (gehoben)',             gnd_default: 80, gnd_min: 60, gnd_max: 100, source: 'Anl. 1 ImmoWertV / SW-RL' },
    'efh_std5':    { label: 'EFH Standardstufe 5 (hochwertig)',          gnd_default: 90, gnd_min: 70, gnd_max: 100, source: 'Anl. 1 ImmoWertV / SW-RL' },
    'mfh':         { label: 'Mehrfamilienhaus (Mietwohngebäude)',        gnd_default: 80, gnd_min: 60, gnd_max: 100, source: 'Anl. 1 ImmoWertV', note: 'BewG Anl. 22: 70 J.' },
    'etw':         { label: 'Eigentumswohnung',                          gnd_default: 80, gnd_min: 60, gnd_max: 100, source: 'Anl. 1 ImmoWertV', note: 'BewG Anl. 22: 70 J.' },
    'mischnutz':   { label: 'Wohnhaus mit Mischnutzung',                 gnd_default: 80, gnd_min: 60, gnd_max: 100, source: 'Anl. 1 ImmoWertV', note: 'BewG Anl. 22: 70 J.' },

    // ─── Gewerbe (unverändert) ───
    'geschaeft':   { label: 'Geschäftshaus',                             gnd_default: 60, gnd_min: 30, gnd_max: 70,  source: 'Anl. 1 ImmoWertV' },
    'buero':       { label: 'Bürogebäude',                               gnd_default: 60, gnd_min: 30, gnd_max: 70,  source: 'Anl. 1 ImmoWertV' },
    'bank':        { label: 'Bankgebäude',                               gnd_default: 60, gnd_min: 50, gnd_max: 70,  source: 'SW-RL' },

    // ─── Beherbergung (unverändert) ───
    'hotel':       { label: 'Hotel',                                     gnd_default: 40, gnd_min: 15, gnd_max: 50,  source: 'Anl. 1 ImmoWertV' },
    'budgethotel': { label: 'Budgethotel',                               gnd_default: 40, gnd_min: 35, gnd_max: 45,  source: 'SW-RL' },
    'gaststaette': { label: 'Gaststätte',                                gnd_default: 30, gnd_min: 20, gnd_max: 40,  source: 'SW-RL' },

    // ─── Verbrauchermärkte / Handel (unverändert) ───
    'markt':       { label: 'Verbrauchermarkt, Autohaus',                gnd_default: 30, gnd_min: 10, gnd_max: 40,  source: 'Anl. 1 ImmoWertV' },
    'kaufhaus':    { label: 'Kauf- / Warenhaus',                         gnd_default: 50, gnd_min: 15, gnd_max: 50,  source: 'Anl. 1 ImmoWertV' },

    // ─── Garagen / Parkhäuser (unverändert) ───
    'garage_einzel':{ label: 'Einzelgarage',                             gnd_default: 60, gnd_min: 50, gnd_max: 60,  source: 'Anl. 1 ImmoWertV' },
    'garage_mehr': { label: 'Mehrfachgarage',                            gnd_default: 60, gnd_min: 50, gnd_max: 60,  source: 'SW-RL' },
    'parkhaus':    { label: 'Parkhaus / Tiefgarage',                     gnd_default: 40, gnd_min: 15, gnd_max: 40,  source: 'Anl. 1 ImmoWertV' },
    'carport':     { label: 'Carport',                                   gnd_default: 40, gnd_min: 30, gnd_max: 50,  source: 'SW-RL' },

    // ─── Industrie / Lager (unverändert) ───
    'werkstatt':   { label: 'Gewerbe- / Industriegebäude (Werkstatt)',   gnd_default: 40, gnd_min: 15, gnd_max: 50,  source: 'Anl. 1 ImmoWertV' },
    'lager':       { label: 'Lager- / Logistikgebäude',                  gnd_default: 40, gnd_min: 15, gnd_max: 50,  source: 'Anl. 1 ImmoWertV' },
    'kaltlager':   { label: 'Warm-/Kaltlager mit Sozialtrakt',           gnd_default: 30, gnd_min: 15, gnd_max: 40,  source: 'SW-RL' },

    // ─── Sonderbauten (unverändert) ───
    'kindergarten':{ label: 'Kindergarten / Kita',                       gnd_default: 50, gnd_min: 30, gnd_max: 50,  source: 'Anl. 1 ImmoWertV' },
    'schule':      { label: 'Schule',                                    gnd_default: 50, gnd_min: 40, gnd_max: 60,  source: 'Anl. 1 ImmoWertV' },
    'pflegeheim':  { label: 'Pflegeheim / Wohnheim',                     gnd_default: 50, gnd_min: 40, gnd_max: 70,  source: 'Anl. 1 ImmoWertV' },
    'krankenhaus': { label: 'Krankenhaus / Reha',                        gnd_default: 40, gnd_min: 15, gnd_max: 60,  source: 'Anl. 1 ImmoWertV' },
    'sporthalle':  { label: 'Sport-/Turnhalle',                          gnd_default: 40, gnd_min: 15, gnd_max: 60,  source: 'Anl. 1 ImmoWertV' }
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
    return entry ? entry.gnd_default : 80;  // Fallback: 80 (ImmoWertV-Standard Wohngebäude)
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
