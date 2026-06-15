/* =========================================================================
   immometrica-mapping.js  (v3 – BUILD-SCOPE)
   Feld-Zuordnung ImmoMetrica Search API  ->  DealPilot
   SCOPE: nur ImmoMetrica. PriceHubble vorerst NICHT Teil des Builds.
          Neue Felder (B) gelockt inkl. Tab + Benefit.
   -------------------------------------------------------------------------
   Aenderungen ggü. v1 (aus dem Feld-Lernen, Grep Staging 12.06.):
   - rented_out  -> vermstand  (Select-Werte bestaetigt: Vollvermietet/Leer)  [FINAL]
   - condition   -> ds2_zustand  [PENDING: <option>-Werte fehlen noch]
   - energy_efficiency_class -> ds2_energie  [PENDING: <option>-Werte fehlen]
   - maintenance -> hg_ul  [PENDING: Einheit pruefen (hg_ul=Jahr, API evtl. Monat -> x12)]
   - ausst / modernis: NICHT aus ImmoMetrica ableitbar -> bleiben Freitext/leer
   - Neue Felder-Vorschlaege (B) als PLANNED_NEW_FIELDS dokumentiert
   - Meta-Felder fuer Inseratsalter ergaenzt
   Bekannte DealPilot-Selects:
     vermstand: ["Vollvermietet","Teilweise leer","Leer"]
     ausst:     ["Einfach","Normal","Gehoben","Luxus"]
   ========================================================================= */

'use strict';

/* ---- DealPilot-Select-Optionen (bekannt) ---- */
const DP_OPTIONS = {
  vermstand: ['Vollvermietet', 'Teilweise leer', 'Leer'],
  ausst:     ['Einfach', 'Normal', 'Gehoben', 'Luxus'],
  // PENDING – per Grep nachziehen (siehe README):
  ds2_zustand: null,   // grep id="ds2_zustand" ... <option> in frontend/index.html
  ds2_energie: null,   // grep id="ds2_energie" ... <option> in frontend/index.html
};

/* =========================================================================
   FIELD_MAP – alle 63 Felder
   target: dp | meta | note | filter | skip
   pendingDp: Ziel steht fest, wartet aber auf Enum-/Einheiten-Klaerung
   ========================================================================= */
const FIELD_MAP = {
  // ---- Identitaet & Status ----
  id:                    { target: 'meta', dp: '_immometrica_id', label: 'ImmoMetrica-ID', note: 'Duplikatschutz / externe Referenz' },
  online_since:          { target: 'meta', dp: '_immometrica_online_since', label: 'Online seit', note: 'fuer Inseratsalter (B1)' },
  offline_since:         { target: 'skip' },
  last_modified:         { target: 'skip' },
  fake:                  { target: 'filter', label: 'Spam-Flag', note: 'true -> Objekt ueberspringen' },

  // ---- Plattformen ----
  'platforms[].platform':    { target: 'meta', dp: '_quelle',  label: 'Portal', note: 'auch Portal-Anzahl -> Inseratsalter (B1)' },
  'platforms[].url':         { target: 'meta', dp: '_expose',  label: 'Exposé-Link' },
  'platforms[].source_id':   { target: 'skip' },
  'platforms[].active':      { target: 'skip' },
  'platforms[].online_since':{ target: 'skip' },
  'platforms[].offline_since':{ target: 'skip' },
  'platforms[].last_seen':   { target: 'skip' },
  'platforms[].id':          { target: 'skip' },

  // ---- Objekt-Basis ----
  title:               { target: 'dp', dp: 'kuerzel', label: 'Titel' },
  real_estate_type:    { target: 'dp', dp: 'objart',  label: 'Objektart (grob)' },
  house_type:          { target: 'dp', dp: 'objart',  label: 'Haustyp (Text)' },
  appartement_type:    { target: 'dp', dp: 'objart',  label: 'Wohnungstyp (Text)' },
  address_raw:         { target: 'dp', dp: 'ort/str/hnr', label: 'Adresse (Rohtext)' },
  address_zipcode:     { target: 'dp', dp: 'plz',     label: 'PLZ' },
  country:             { target: 'note', label: 'Land' },
  currency:            { target: 'skip' },

  // ---- Preis & Miete ----
  buying_price:        { target: 'dp', dp: 'kp',  label: 'Kaufpreis' },
  buying_price_per_sqm:{ target: 'note', label: 'Kaufpreis/m²' },
  maintenance:         { target: 'pendingDp', dp: 'hg_ul', label: 'Hausgeld', note: 'EINHEIT PRUEFEN: hg_ul=/Jahr, API evtl. /Monat -> x12' },
  commission_text:     { target: 'note', label: 'Provision' },
  rent_cold:           { target: 'dp', dp: 'nkm', label: 'Kaltmiete/Monat', note: 'bei Kauf meist null' },
  rent_total:          { target: 'note', label: 'Warmmiete' },
  rent_per_sqm:        { target: 'note', label: 'Miete/m²' },
  buy_rent_cold:       { target: 'skip' },
  buy_rent_per_sqm:    { target: 'skip' },

  // ---- Gebaeude ----
  construction_year:   { target: 'dp', dp: 'baujahr',    label: 'Baujahr' },
  building_phase:      { target: 'note', label: 'Bauphase' },
  floor:               { target: 'dp', dp: 'etage',      label: 'Etage (fallback)' },
  floor_act:           { target: 'dp', dp: 'etage',      label: 'Etage' },
  floor_max:           { target: 'dp', dp: 'etagen_ges', label: 'Etagen gesamt' },
  condition:           { target: 'pendingDp', dp: 'ds2_zustand', label: 'Zustand', note: 'PENDING: ds2_zustand-Optionen noetig' },
  property_area:       { target: 'dp', dp: 'gsfl',       label: 'Grundstuecksflaeche' },
  living_space:        { target: 'dp', dp: 'wfl',        label: 'Wohnflaeche' },
  rooms:               { target: 'dp', dp: 'zimmer',     label: 'Zimmer' },
  bath_rooms:          { target: 'dp', dp: 'bad_anz',    label: 'Badezimmer' },
  number_of_apartments:{ target: 'dp', dp: 'einheiten',  label: 'Wohneinheiten' },
  heating_type:        { target: 'note', label: 'Heizungsart' },
  energy_efficiency_class:{ target: 'pendingDp', dp: 'ds2_energie', label: 'Energieklasse', note: 'PENDING: ds2_energie-Optionen noetig' },

  // ---- Status-Flag mit DealPilot-Zuhause ----
  rented_out:          { target: 'dp', dp: 'vermstand', label: 'Vermietungsstand', note: 'true->Vollvermietet, false->Leer' },

  // ---- Flags -> Vorschlaege fuer neue Felder (B) bzw. Zusammenfassung ----
  leasehold:           { target: 'note', label: 'Erbpacht', note: 'B2: eigenes Feld erbpacht + erbbauzins vorgeschlagen' },
  foreclosure:         { target: 'note', label: 'Zwangsversteigerung', note: 'B3: erwerbsart' },
  auction:             { target: 'note', label: 'Bieterverfahren', note: 'B3: erwerbsart' },
  is_private:          { target: 'note', label: 'Anbieter privat/gewerblich', note: 'B4: anbietertyp' },
  new_building:        { target: 'note', label: 'Neubau', note: 'Hint §7b-Modul' },
  usufruct:            { target: 'note', label: 'Nießbrauch' },
  kitchen:             { target: 'note', label: 'Einbaukueche' },
  balcony:             { target: 'note', label: 'Balkon' },
  terrace:             { target: 'note', label: 'Terrasse' },
  roof_terrace:        { target: 'note', label: 'Dachterrasse' },
  garden:              { target: 'note', label: 'Garten' },
  winter_garden:       { target: 'note', label: 'Wintergarten' },
  guest_toilet:        { target: 'note', label: 'Gaeste-WC' },
  basement:            { target: 'note', label: 'Keller' },
  furnished:           { target: 'note', label: 'moebliert' },
  elevator:            { target: 'note', label: 'Aufzug' },
  prefab:              { target: 'note', label: 'Fertighaus' },
  is_holidayhome:      { target: 'note', label: 'Ferienimmobilie' },
  move_in:             { target: 'note', label: 'Bezug' },
};

/* =========================================================================
   PENDING_MAPPINGS – fertig, sobald die DealPilot-Enum-Werte vorliegen.
   Lookup von ImmoMetrica-Wert -> DealPilot-Option.
   ========================================================================= */
const PENDING_MAPPINGS = {
  ds2_zustand: {
    needs: 'frontend/index.html  select#ds2_zustand <option>-Werte',
    // Erst befuellen, wenn Optionen bekannt. Beispiel-Skizze:
    lookup: {
      // 'Erstbezug': '<dp-option>', 'Neuwertig': '...', 'Saniert': '...',
      // 'Modernisiert': '...', 'Gepflegt': '...', 'Renovierungsbeduerftig': '...'
    },
  },
  ds2_energie: {
    needs: 'frontend/index.html  select#ds2_energie <option>-Werte',
    lookup: { /* z.B. 'A+':'...', 'A':'...', ... 'H':'...' – Format der API noch offen */ },
  },
  hg_ul: {
    needs: 'Einheit der API-maintenance (Monat vs Jahr) an einem echten Wert verifizieren',
    transform: 'wenn /Monat -> *12',
  },
};

/* =========================================================================
   PLANNED_NEW_FIELDS (B) – neue FIELDS-Eintraege (storage.js Z.8, JSONB,
   KEINE Migration). Erst auf dein OK gebaut.
   ========================================================================= */
const PLANNED_NEW_FIELDS = {
  // B1 – Inseratsalter / Vermarktungsdauer (hoechster Hebel)
  _immometrica_online_since: { type: 'meta', from: 'online_since', tab: 'Pilot-Analyse / Verhandlung & Offerte',
    benefit: 'Vermarktungsdauer = Verhandlungshebel (lange online -> Preisreduktionspotenzial)' },
  _immometrica_portals:      { type: 'meta', from: 'platforms[].length', tab: 'Pilot-Analyse / Verhandlung & Offerte',
    benefit: 'Portal-Streuung -> Verkaeuferdruck-Signal' },
  // abgeleitet: tage_online = heute - online_since (Frontend)

  // B2 – Erbpacht (braucht calc.js-Anbindung: Erbbauzins in Cashflow/DSCR)
  erbpacht:    { type: 'field', input: 'checkbox', from: 'leasehold', tab: 'Investition/Finanzierung',
    benefit: 'Erbpacht -> Cashflow/DSCR + Finanzierungs-/Wiederverkaufsrisiko' },
  erbbauzins:  { type: 'field', input: 'number-eur-jahr', tab: 'Investition/Finanzierung',
    benefit: 'laufender Erbbauzins in Cashflow', note: 'NICHT aus API – User-Eingabe, nur wenn erbpacht=true' },

  // B3 – Erwerbsart (Risiko/Strategie)
  erwerbsart:  { type: 'field', input: 'select', options: ['Normal', 'Zwangsversteigerung', 'Bieterverfahren'],
    from: 'foreclosure/auction', tab: 'Objekt (Tab 1)', benefit: 'Risiko-/Strategieklasse (ZV = andere Due-Diligence)' },

  // B4 – Anbietertyp (Sourcing/Provision)
  anbietertyp: { type: 'field', input: 'select', options: ['privat', 'gewerblich'], from: 'is_private',
    tab: 'Objekt (Tab 1)', benefit: 'privat = oft provisionsfrei -> KNK runter -> bessere Rendite' },
};

/* ---- Hilfs-Maps fuer die Zusammenfassung ---- */
const PLATFORM_LABEL = { IS24: 'ImmobilienScout24', ebayKA: 'Kleinanzeigen', immowelt: 'Immowelt', immonet: 'Immonet' };
const HEATING_LABEL = { central_heating: 'Zentralheizung', floor_heating: 'Fussbodenheizung', district_heating: 'Fernwaerme', gas_heating: 'Gasheizung', oil_heating: 'Oelheizung', heat_pump: 'Waermepumpe', self_contained: 'Etagenheizung' };

/* ---- Mapper ---- */
function mapVermstand(rented_out) {
  if (rented_out === true) return 'Vollvermietet';
  if (rented_out === false) return 'Leer';
  return null; // unbekannt -> Default des Selects nicht ueberschreiben
}
function mapObjart(it) {
  const s = ((it.house_type || '') + ' ' + (it.real_estate_type || '') + ' ' + (it.appartement_type || '')).toLowerCase();
  if (/wohnung|flatbuy|appartement|apartment|\betw\b/.test(s)) return 'ETW';
  if (/doppelhaus|\bdhh\b/.test(s)) return 'DHH';
  if (/reihen/.test(s)) return 'RH';
  if (/mehrfamilien|\bmfh\b/.test(s)) return 'MFH';
  if (/wohn-?\s*\/?\s*gesch|gesch\u00e4ft|geschaeft/.test(s)) return 'GESCH';
  if (/b\u00fcro|buero|office/.test(s)) return 'BUERO';
  if (/hotel/.test(s)) return 'HOTEL';
  if (/garage|stellplatz/.test(s)) return 'GAR';
  if (/gewerbe|industrie/.test(s)) return 'GEW';
  if (/einfamilien|\befh\b|housebuy|haus/.test(s)) return 'EFH';
  return 'ETW';
}
function parseAddr(it) {
  const raw = (it.address_raw || '').trim();
  let plz = it.address_zipcode ? String(it.address_zipcode) : '';
  let str = '', hnr = '', ort = '';
  function splitStrHnr(seg) {
    seg = (seg || '').trim();
    const mm = seg.match(/^(.*?[^\s\d])\s+(\d+\s*[a-zA-Z]?(?:\s*[-+\/]\s*\d+\s*[a-zA-Z]?)?)$/);
    if (mm) return { str: mm[1].trim(), hnr: mm[2].replace(/\s+/g, '') };
    return { str: seg, hnr: '' };
  }
  if (raw.includes(',')) {
    const parts = raw.split(',');
    const left = parts[0].trim(); const right = (parts[1] || '').trim();
    const sh = splitStrHnr(left); str = sh.str; hnr = sh.hnr;
    const mr = right.match(/(\d{5})\s+(.+)$/);
    if (mr) { plz = plz || mr[1]; ort = mr[2].trim(); }
  } else if (/[A-Za-z].*\s+\d/.test(raw) && !/^\d{5}\b/.test(raw)) {
    const noplz = raw.replace(/\s*\b\d{5}\b.*$/, '').trim();
    const sh2 = splitStrHnr(noplz); str = sh2.str; hnr = sh2.hnr;
    const mp = raw.match(/(\d{5})\b/); if (mp) plz = plz || mp[1];
    const mo = raw.match(/\b\d{5}\b\s+(.+)$/); if (mo) ort = mo[1].trim();
  } else {
    const m = raw.match(/(\d{5})\b/); if (m) plz = plz || m[1];
    const seg = raw.split(/\s-\s|\u2013/);
    ort = (seg[seg.length - 1] || '').replace(/\d{5}/g, '')
      .replace(/Nordrhein-Westfalen|Bayern|Niedersachsen|Hessen|Baden-W\u00fcrttemberg|Sachsen|Th\u00fcringen|Brandenburg|Rheinland-Pfalz|Saarland|Schleswig-Holstein|Mecklenburg-Vorpommern|Sachsen-Anhalt|Bremen|Hamburg|Berlin/gi, '').trim();
  }
  return { plz, str, hnr, ort };
}

/* ---- Hauptfunktion: Inserat -> DealPilot-Felder ---- */
function mapToDp(it) {
  const a = parseAddr(it);
  const plist = it.platforms || [];
  const p = plist.find(x => x && x.active) || plist[0] || null;
  const out = {
    // direkte Felder
    plz: a.plz, ort: a.ort, str: a.str, hnr: a.hnr,
    objart: mapObjart(it),
    wfl: it.living_space, gsfl: it.property_area, baujahr: it.construction_year,
    kp: it.buying_price, nkm: it.rent_cold,
    zimmer: it.rooms, bad_anz: it.bath_rooms,
    etage: (it.floor_act != null ? it.floor_act : it.floor), etagen_ges: it.floor_max,
    einheiten: it.number_of_apartments,
    kuerzel: (it.title || '').slice(0, 40),
    vermstand: mapVermstand(it.rented_out),     // NEU (A, final)
    notizen: buildSummary(it),
    // Meta
    _immometrica_id: it.id,
    _quelle: p ? p.platform : '',
    _expose: p ? p.url : '',
    _immometrica_online_since: it.online_since || null,  // NEU (B1)
    _immometrica_portals: plist.length,                   // NEU (B1)
  };
  // PENDING: ds2_zustand / ds2_energie / hg_ul erst setzen, wenn Optionen/Einheit geklaert
  if (DP_OPTIONS.ds2_zustand && it.condition) {
    const v = (PENDING_MAPPINGS.ds2_zustand.lookup || {})[it.condition];
    if (v) out.ds2_zustand = v;
  }
  if (DP_OPTIONS.ds2_energie && it.energy_efficiency_class) {
    const v = (PENDING_MAPPINGS.ds2_energie.lookup || {})[it.energy_efficiency_class];
    if (v) out.ds2_energie = v;
  }
  // hg_ul bewusst NICHT automatisch gesetzt bis Einheit verifiziert
  return out;
}

/* ---- Zusammenfassung -> "Sonstige Bemerkungen" (notizen) ---- */
function buildSummary(it) {
  const L = [];
  const plist = it.platforms || [];
  const p = plist.find(x => x && x.active) || plist[0] || null;
  if (it.title) L.push(it.title);
  L.push('');
  if (p) L.push('Quelle: ' + (PLATFORM_LABEL[p.platform] || p.platform) + (p.url ? ' \u2013 ' + p.url : ''));
  if (plist.length > 1) L.push('Auf ' + plist.length + ' Portalen gelistet');
  L.push('ImmoMetrica-ID: ' + it.id);
  if (it.condition) L.push('Zustand: ' + it.condition);
  if (it.heating_type) L.push('Heizung: ' + (HEATING_LABEL[it.heating_type] || it.heating_type));
  if (it.energy_efficiency_class) L.push('Energieklasse: ' + it.energy_efficiency_class);
  L.push('Status: ' + (it.rented_out ? 'vermietet' : 'frei / selbstgenutzt'));
  L.push('Anbieter: ' + (it.is_private ? 'privat' : 'gewerblich'));
  if (it.commission_text) L.push('Provision: ' + it.commission_text);
  if (it.maintenance != null) L.push('Hausgeld (lt. Inserat): ' + it.maintenance + ' \u20ac');
  if (it.buying_price_per_sqm != null) L.push('Kaufpreis/m\u00b2: ' + Math.round(it.buying_price_per_sqm) + ' \u20ac');
  if (it.rent_total != null) L.push('Warmmiete: ' + it.rent_total + ' \u20ac');

  const feats = [];
  [['balcony', 'Balkon'], ['terrace', 'Terrasse'], ['roof_terrace', 'Dachterrasse'], ['garden', 'Garten'],
   ['winter_garden', 'Wintergarten'], ['basement', 'Keller'], ['elevator', 'Aufzug'], ['guest_toilet', 'G\u00e4ste-WC'],
   ['kitchen', 'Einbauk\u00fcche'], ['furnished', 'm\u00f6bliert']].forEach(([k, lbl]) => { if (it[k]) feats.push(lbl); });
  if (feats.length) L.push('Ausstattung: ' + feats.join(', '));

  const flags = [];
  [['foreclosure', 'Zwangsversteigerung'], ['auction', 'Bieterverfahren'], ['leasehold', 'Erbpacht'],
   ['usufruct', 'Nie\u00dfbrauch'], ['new_building', 'Neubau'], ['is_holidayhome', 'Ferienimmobilie'],
   ['prefab', 'Fertighaus']].forEach(([k, lbl]) => { if (it[k]) flags.push(lbl); });
  if (flags.length) L.push('Hinweis: ' + flags.join(', '));

  if (it.online_since) L.push('Online seit: ' + String(it.online_since).slice(0, 10));
  return '\u2014 Aus ImmoMetrica \u00fcbernommen \u2014\n' + L.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FIELD_MAP, PENDING_MAPPINGS, PLANNED_NEW_FIELDS, DP_OPTIONS,
    mapToDp, buildSummary, mapObjart, parseAddr, mapVermstand,
    PLATFORM_LABEL, HEATING_LABEL,
  };
}
