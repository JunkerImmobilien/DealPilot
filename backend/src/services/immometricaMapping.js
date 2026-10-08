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
  /* v1997 · GEMESSEN am 08.10.2026 an einer echten Antwort (Suchauftrag
     110695, 50 Inserate) UND am Select in frontend/index.html:

       Select  A+ A B C D E F G H
       API     G  E  C  D  F  A+  H

     Dieselbe Schreibweise - keine Umsetzung noetig. Die Sperre war eine
     offene Frage, die vier Monate niemand gestellt hat. */
  ds2_energie: ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  /* ds2_zustand BLEIBT offen: die API schickt deutschen Fliesstext
     (gemessen: "Vollstaendig renoviert", "Saniert", "Modernisiert",
     "Gepflegt", "Renovierungsbeduerftig"), das Select fuehrt
     neubau / gut / normal / renovierungsbeduerftig /
     stark_sanierungsbeduerftig. Welcher Wert auf welche Stufe faellt,
     ist eine BEWERTUNGSfrage - die gehoert Marcel, nicht dem Code. */
  /* v1998 · MARCELS ZUORDNUNG vom 08.10.2026, auf die gemessenen
     API-Werte (50 Inserate, Suchauftrag 110695):

       Vollstaendig renoviert / Saniert / Modernisiert -> gut
       Gepflegt                                        -> normal
       Renovierungsbeduerftig                          -> renovierungsbeduerftig

     `neubau` steht NICHT hier: es ist keine Zustandsbeschreibung,
     sondern eine Tatsache, und die API fuehrt sie als eigenes Feld
     `new_building`. Marcel: „Neubau ist eigentlich extra."

     `stark_sanierungsbeduerftig` bleibt leer - die API kennt keinen
     Wert dafuer, und ihn aus „Renovierungsbeduerftig" abzuleiten
     waere eine Verschaerfung, die niemand gesagt hat. */
  ds2_zustand: ['neubau', 'gut', 'normal', 'renovierungsbeduerftig', 'stark_sanierungsbeduerftig'],
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
  energy_efficiency_class:{ target: 'dp', dp: 'ds2_energie', label: 'Energieklasse', note: 'v1997: Schreibweise der API gemessen, 1:1 uebernehmbar' },
  reactivated_at:      { target: 'meta', dp: '_immometrica_reaktiviert', label: 'Wieder eingestellt am', note: 'v1998: war das EINZIGE der 57 Felder, das hier fehlte - geplatzter Verkauf, Verhandlungssignal' },

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
  /* v1997 · DIE API-WERTE SIND JETZT GEMESSEN (08.10.2026, 50 Inserate):

       Vollstaendig renoviert  ·  Saniert  ·  Modernisiert
       Gepflegt  ·  Renovierungsbeduerftig

     Das Select fuehrt: neubau / gut / normal /
     renovierungsbeduerftig / stark_sanierungsbeduerftig

     Die Zuordnung ist eine BEWERTUNGSentscheidung (der Zustand
     fliesst in DealScore 2 ein) und gehoert Marcel. Sie steht hier
     NICHT geraten - lieber offen als falsch. */
ds2_zustand: {
    needs: 'Zuordnung der 5 gemessenen API-Werte auf die 5 Stufen - Marcels Entscheidung',
    // Erst befuellen, wenn Optionen bekannt. Beispiel-Skizze:
    lookup: {
      // 'Erstbezug': '<dp-option>', 'Neuwertig': '...', 'Saniert': '...',
      // 'Modernisiert': '...', 'Gepflegt': '...', 'Renovierungsbeduerftig': '...'
    },
  },
  /* v1997 · ERLEDIGT - steht nur noch als Spur hier. Die API schickt
     genau die Schreibweise des Selects; die Zuordnung ist die Identitaet
     und braucht keine Tabelle. Gemessene Werte: G E C D F A+ H. */
  ds2_energie: {
    needs: 'erledigt in v1997 - Schreibweise gemessen, identisch',
    lookup: null,
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
  /* v1256: ZFH VOR EFH prüfen. „Zweifamilienhaus" enthält kein
     „einfamilien", aber „haus" — es wäre in der Zeile darunter als EFH
     durchgerutscht. Reihenfolge ist hier die ganze Logik. */
  if (/zweifamilien|\bzfh\b/.test(s)) return 'ZFH';
  if (/einfamilien|\befh\b|housebuy|haus/.test(s)) return 'EFH';
  return 'ETW';
}
/* == v2001 - DAS BUNDESLAND RECHTS VOM KOMMA ========================

   Hier stand ein Komma-Zweig, der links IMMER einen Strassennamen
   annahm - "Strasse 9, 32609 Ort". ImmoMetrica schickt bei Inseraten
   OHNE veroeffentlichte Anschrift aber die Form "Ort, Bundesland",
   und dann landete gemessen die Stadt in der Strasse:

     "Herford, Nordrhein-Westfalen"         -> str="Herford"
     "32049 Herford, Nordrhein-Westfalen"   -> str="32049 Herford", plz leer
     "Mitte, Berlin"                        -> str="Mitte"
     "Bad Oeynhausen - Nordrhein-Westfalen" -> ort LEER (der Trenner nahm
                                               das LETZTE Segment, und das
                                               Land wurde danach geloescht)

   Der Fehler war doppelt: der Bodenrichtwert suchte eine Strasse, die
   es nicht gibt, UND die Ortskern-Zeile aus v1999 haengt an `!dp.str`
   und konnte deshalb NIE erscheinen. Ein Inserat ohne Anschrift sah
   aus wie eines mit.

   Das Bundesland ist fuer uns Rauschen - es gibt in der Datenaufnahme
   kein Feld dafuer (gemessen: kein #bundesland, kein address_state in
   der API). Es wird erkannt und verworfen, der ORT bleibt. Ausnahme
   sind die drei Stadtstaaten: dort IST das "Land" die Stadt und links
   steht der Ortsteil - "Mitte, Berlin" wird zu "Berlin-Mitte". == */
const LAENDER = ['Nordrhein-Westfalen', 'Bayern', 'Baden-W\u00fcrttemberg',
  'Niedersachsen', 'Hessen', 'Sachsen-Anhalt', 'Sachsen', 'Rheinland-Pfalz',
  'Schleswig-Holstein', 'Brandenburg', 'Th\u00fcringen', 'Mecklenburg-Vorpommern',
  'Saarland', 'Berlin', 'Hamburg', 'Bremen'];
const STADTSTAATEN = ['Berlin', 'Hamburg', 'Bremen'];
const istLand = (t) => LAENDER.some((l) => l.toLowerCase() === String(t || '').trim().toLowerCase());

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
  /* v2001 - "32049 Herford" oder "Herford 32049" in PLZ und Ort trennen */
  function plzOrt(seg) {
    seg = String(seg || '').trim();
    const m1 = seg.match(/^(\d{5})\s+(.+)$/);  if (m1) return { plz: m1[1], ort: m1[2].trim() };
    const m2 = seg.match(/^(.+?)\s+(\d{5})$/);  if (m2) return { plz: m2[2], ort: m2[1].trim() };
    return { plz: '', ort: seg };
  }
  /* v2001 - ZUERST die Form ohne Anschrift: endet der Rohtext auf ein
     Bundesland, ist links kein Strassenname, sondern der Ort. Das muss
     vor dem Komma-Zweig stehen - sonst greift der wieder zuerst. */
  const teile = raw.split(/\s*,\s*|\s+-\s+|\s*\u2013\s*/).map((t) => t.trim()).filter(Boolean);
  if (teile.length > 1 && istLand(teile[teile.length - 1])) {
    const land = teile[teile.length - 1];
    const po = plzOrt(teile.slice(0, -1).join(' '));
    plz = plz || po.plz;
    ort = po.ort;
    if (STADTSTAATEN.some((s) => s.toLowerCase() === land.toLowerCase())) {
      ort = (!ort || ort.toLowerCase() === land.toLowerCase()) ? land : (land + '-' + ort);
    }
    /* str und hnr bleiben LEER - genau daran erkennt die Oberflaeche,
       dass der Bodenrichtwert vom Ortsmittelpunkt kommen muss. */
    return { plz, str: '', hnr: '', ort };
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
    /* v2001 - hier stand `seg[seg.length - 1]` - das LETZTE Segment. Bei
       "Bad Oeynhausen - Nordrhein-Westfalen" war das das Land, und nach
       dem Loeschen der Laendernamen blieb LEER uebrig. Jetzt wird das
       erste Segment genommen, das kein Bundesland ist. */
    const seg = raw.split(/\s-\s|\u2013/).map((t) => t.trim()).filter(Boolean);
    const ohneLand = seg.filter((t) => !istLand(t));
    ort = (ohneLand[ohneLand.length - 1] || '').replace(/\d{5}/g, '').trim();
  }
  return { plz, str, hnr, ort };
}

/* ---- Hauptfunktion: Inserat -> DealPilot-Felder ---- */
/* v1998 · Der Zustandstext der API auf unsere Stufe. Unbekanntes wird
   VERWORFEN, nicht geraten: der Zustand fliesst in DealScore 2 ein,
   und eine erfundene Stufe faelscht eine Zahl, die wie eine Messung
   aussieht. Verglichen wird klein und ohne Umlautstreit. */
const ZUSTAND_TEXT = {
  'vollstaendig renoviert': 'gut',
  'vollständig renoviert':  'gut',
  'saniert':                'gut',
  'modernisiert':           'gut',
  'gepflegt':               'normal',
  'renovierungsbeduerftig': 'renovierungsbeduerftig',
  'renovierungsbedürftig':  'renovierungsbeduerftig',
};
function mapZustand(it) {
  /* Neubau schlaegt den Text: ein Neubau, der als „Gepflegt"
     inseriert ist, bleibt ein Neubau. */
  if (it && it.new_building === true) return 'neubau';
  var t = String((it && it.condition) || '').trim().toLowerCase();
  if (!t) return undefined;
  return ZUSTAND_TEXT[t];   /* unbekannt -> undefined, also nicht gesetzt */
}

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
    /* v1997 · DIE ENERGIEKLASSE WIRD JETZT WIRKLICH GESETZT.

       Die Feldtabelle oben ist DOKUMENTATION, nicht Mechanik - dieses
       Objekt hier wird von Hand gebaut. Ein Eintrag mit target:"dp" in
       der Tabelle bewirkt nichts, wenn die Zeile hier fehlt. Genau
       daran ist mein erster Anlauf gescheitert: die Tabelle sagte ja,
       mapToDp() lieferte undefined.

       Gemessen am 08.10.2026 an einer echten Antwort (Suchauftrag
       110695, 50 Inserate): die API schickt G E C D F A+ H - genau die
       Schreibweise des Selects (A+ A B C D E F G H). Deshalb ohne
       Umsetzungstabelle, aber MIT Schranke: was nicht im Select steht,
       wird nicht gesetzt. Eine erfundene Energieklasse waere schlimmer
       als keine. */
    ds2_energie: ((DP_OPTIONS.ds2_energie || []).indexOf(String(it.energy_efficiency_class || '').trim()) >= 0
      ? String(it.energy_efficiency_class).trim() : undefined),
    /* v1998 · auch hier gilt: die Tabelle oben ist Dokumentation, die
       Zeile hier ist die Mechanik. */
    ds2_zustand: mapZustand(it),
    notizen: buildSummary(it),
    // Meta
    _immometrica_id: it.id,
    _quelle: p ? p.platform : '',
    _expose: p ? p.url : '',
    _immometrica_online_since: it.online_since || null,  // NEU (B1)
    _immometrica_reaktiviert: it.reactivated_at || null,   // v1998
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
