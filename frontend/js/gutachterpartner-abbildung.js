/* ════════════════════════════════════════════════════════════════════
   v3540/v3570 · GUTACHTERPARTNER — ABBILDUNG OBJEKT → FORMULAR (rein, ohne DOM)
   v3570: deutsche Optionstexte (optionText), Vorbelegung ALLER Felder der Live-Definitionen mit
   Herkunft (vorbelegenMitHerkunft, REGELN), Pflichtfelder (pflicht) — Marcel 16.11.2026.
   ════════════════════════════════════════════════════════════════════
   Marcel 16.11.2026: Restnutzungsdauer beim unabhaengigen Gutachterpartner
   anfragen. Das Formular kommt vom Partner (server-driven: Felder, Reihenfolge,
   Optionen, Bedingungen als JSON Logic, Pruefregeln). Diese Datei
     - bewertet visibleWhen (JSON Logic, die im Vertrag genutzten Operatoren),
     - liest Optionen aus dem Feld ODER aus dem JSON Schema (enum),
     - belegt das Formular aus dem DealPilot-Objekt vor (nur Felder, die die
       Definition fuehrt, nur Werte, die eine Option sind),
     - ordnet die feldgenauen Fehler des Partners den Feldern zu.
   Die Oberflaeche (js/gutachterpartner.js) und der Pruefer
   (tools/evalion-pruefen.mjs) laden DIESELBE Datei.

   Modernisierung: DealPilot fuehrt je Bauteil (Tab Objekt, mod_*) die Stufen
   von Anlage 2 ImmoWertV — Keine/Nie, > 20, 10 - 20, 5 - 10, < 5 Jahre,
   Kernsanierung. Der Partner fragt in 5-Jahres-Stufen. „10 - 20 Jahre“ wird
   VORSICHTIG zu „15–20 Jahre“ (die aeltere Haelfte, eher kuerzere RND) — es
   ist eine Vorbelegung, im Formular sichtbar und aenderbar.
   ════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ── JSON Logic (Teilmenge) ─────────────────────────────────────── */
  function holen(obj, pfad) {
    if (pfad == null || pfad === '') return obj;
    var teile = String(pfad).split('.'), o = obj;
    for (var i = 0; i < teile.length; i++) { if (o == null) return undefined; o = o[teile[i]]; }
    return o;
  }
  function setzen(obj, pfad, wert) {
    var teile = String(pfad).split('.'), o = obj;
    for (var i = 0; i < teile.length - 1; i++) { if (o[teile[i]] == null || typeof o[teile[i]] !== 'object') o[teile[i]] = {}; o = o[teile[i]]; }
    o[teile[teile.length - 1]] = wert;
  }
  function logik(expr, data) {
    if (expr === null || typeof expr !== 'object') return expr;
    if (Array.isArray(expr)) return expr.map(function (e) { return logik(e, data); });
    var op = Object.keys(expr)[0], a = expr[op];
    var args = Array.isArray(a) ? a : [a];
    if (op === 'var') { var v = holen(data, logik(args[0], data)); return v === undefined && args.length > 1 ? logik(args[1], data) : v; }
    if (op === 'and') { var r = true; for (var i = 0; i < args.length; i++) { r = logik(args[i], data); if (!r) return r; } return r; }
    if (op === 'or') { var s = false; for (var j = 0; j < args.length; j++) { s = logik(args[j], data); if (s) return s; } return s; }
    var w = args.map(function (x) { return logik(x, data); });
    switch (op) {
      case '==': return w[0] == w[1];   // eslint-disable-line eqeqeq
      case '===': return w[0] === w[1];
      case '!=': return w[0] != w[1];   // eslint-disable-line eqeqeq
      case '!==': return w[0] !== w[1];
      case '!': return !w[0];
      case '!!': return !!w[0];
      case '>': return w[0] > w[1];
      case '>=': return w[0] >= w[1];
      case '<': return w[0] < w[1];
      case '<=': return w[0] <= w[1];
      case 'in': return Array.isArray(w[1]) ? w[1].indexOf(w[0]) >= 0 : (typeof w[1] === 'string' ? w[1].indexOf(w[0]) >= 0 : false);
      case 'if': for (var k = 0; k + 1 < w.length; k += 2) { if (w[k]) return w[k + 1]; } return w.length % 2 ? w[w.length - 1] : null;
      default: return true;   /* unbekannter Operator: lieber zeigen als still verstecken */
    }
  }
  function sichtbar(feld, data) { return !feld.visibleWhen || !!logik(feld.visibleWhen, data || {}); }

  /* ── Pfade und Schema ───────────────────────────────────────────── */
  function zeigerZuPunkt(p) { return String(p || '').replace(/^\//, '').split('/').map(function (t) { return t.replace(/~1/g, '/').replace(/~0/g, '~'); }).join('.'); }
  function feldPfad(f) { return f.path ? zeigerZuPunkt(f.path) : String(f.id || ''); }
  function schemaAn(schema, punktPfad) {
    var s = schema, teile = String(punktPfad).split('.');
    for (var i = 0; i < teile.length; i++) {
      if (!s) return null;
      var n = (s.properties && s.properties[teile[i]]) || null;
      if (!n && Array.isArray(s.allOf)) s.allOf.forEach(function (x) { if (!n && x && x.then && x.then.properties) n = x.then.properties[teile[i]] || null; });
      if (!n && s.items) n = s.items.properties && s.items.properties[teile[i]];
      s = n;
    }
    return s || null;
  }
  function optionen(feld, schema) {
    if (Array.isArray(feld.options) && feld.options.length) return feld.options;
    var s = schema ? schemaAn(schema, feldPfad(feld)) : null;
    var e = s && (s.enum || (s.items && s.items.enum));
    return Array.isArray(e) ? e.map(function (v) { return { value: String(v), label: String(v) }; }) : [];
  }
  /* Pflichtfeld nach JSON Schema: der Elternknoten fuehrt den letzten Pfadteil in `required` (auch im then-Zweig von allOf, wenn die Bedingung zutrifft) */
  function pflicht(def, pfad, data) {
    var teile = String(pfad).split('.'), letzter = teile.pop();
    var eltern = teile.length ? schemaAn(def && def.schema, teile.join('.')) : (def && def.schema);
    if (!eltern) return false;
    if (Array.isArray(eltern.required) && eltern.required.indexOf(letzter) >= 0) return true;
    return (eltern.allOf || []).some(function (x) {
      if (!x || !x.then || !Array.isArray(x.then.required) || x.then.required.indexOf(letzter) < 0) return false;
      var bed = x['if'] && x['if'].properties; if (!bed) return false;
      var basis = teile.length ? holen(data || {}, teile.join('.')) : data;
      return Object.keys(bed).every(function (k) { var v = basis && basis[k], c = bed[k];
        if (c.const !== undefined) return v === c.const; if (Array.isArray(c.enum)) return c.enum.indexOf(v) >= 0;
        if (c.not && c.not.const !== undefined) return v !== undefined && v !== c.not.const; return false; });
    });
  }
  function felder(def) {
    var g = (def && def.ui && def.ui.groups) || [];
    return g.slice().sort(function (a, b) { return a.order - b.order; }).map(function (x) {
      return { id: x.id, label: x.label, description: x.description, fields: (x.fields || []).slice().sort(function (a, b) { return a.order - b.order; }) };
    });
  }

  /* ── v3570 · Deutsche Beschriftung ────────────────────────────────
     Gemessen 16.11.2026 an den LIVE-Definitionen (lite + voll, Accept-Language de): die
     Feldbeschriftungen kommen deutsch, die OPTIONEN aber als Schluessel (label === value,
     „fiveToTenYears“). Marcel: „Auswahlfelder auf Englisch, das darf nicht sein.“
     Diese Tabelle uebersetzt je Feldpfad (Endung) und Option. Liefert der Partner spaeter
     eine echte deutsche Beschriftung (label !== value), gewinnt sie. Ein unbekannter
     Schluessel wird lesbar gemacht und als „weitere Angabe“ markiert — tools/evalion-pruefen.mjs
     haelt die Tabelle gegen die Live-Definitionen vollstaendig. */
  var MOD_TEXT = { fiveYears: 'vor weniger als 5 Jahren', fiveToTenYears: 'vor 5–10 Jahren', tenToFifteenYears: 'vor 10–15 Jahren',
    fifteenToTwentyYears: 'vor 15–20 Jahren', moreThanTwentyYears: 'vor mehr als 20 Jahren', none: 'nie / keine Modernisierung' };
  var JA_NEIN = { yes: 'Ja', no: 'Nein' };
  var VORHANDEN = { available: 'vorhanden', notAvailable: 'nicht vorhanden' };
  var TITEL = { mr: 'Herr', miss: 'Frau', company: 'Firma', other: 'Divers / keine Angabe' };
  var HERKUNFT = { none: 'keine Angabe', personalRecommendation: 'persönliche Empfehlung', immocation: 'Immocation', faz: 'FAZ', linkedIn: 'LinkedIn',
    socialMedia: 'soziale Medien', internetSearch: 'Internetsuche', artificialIntelligence: 'KI-Assistent', other: 'Sonstiges' };
  var UEBERSETZUNG = {
    'property.type': { apartment: 'Eigentumswohnung', singleFamilyHouse: 'Einfamilienhaus', twoFamilyHouse: 'Zweifamilienhaus', semiDetachedHouse: 'Doppelhaushälfte',
      townhouse: 'Reihenhaus', apartmentBuilding: 'Mehrfamilienhaus', residentialAndCommercialProperty: 'Wohn- und Geschäftshaus',
      commercialProperty: 'Gewerbeimmobilie', undevelopedProperty: 'unbebautes Grundstück', other: 'Sonstiges' },
    'modernizations.*': MOD_TEXT,
    'modernizations.floorPlan.age': MOD_TEXT,
    'modernizations.floorPlan.scopeOfChanges': { fully: 'vollständig', partly: 'teilweise' },
    'renovation.hasRenovations': JA_NEIN, 'construction.hasRenovations': JA_NEIN, 'objectDetails.propertyMonument': JA_NEIN,
    'requester.title': TITEL, 'owner.ownerDetailsData.title': TITEL,
    'requester.leadSource': HERKUNFT, 'agreement.leadSource': HERKUNFT,
    'objectDetails.propertyBasement': { noBasement: 'nicht unterkellert', partialBasement: 'teilweise unterkellert', fullBasement: 'voll unterkellert', crawlSpace: 'Kriechkeller' },
    'construction.constructionType': { solid: 'Massivbau', halfTimbering: 'Fachwerk', wood: 'Holzbau', prefabricatedHouse: 'Fertighaus' },
    'construction.innerWalls': { dryWall: 'Trockenbau', solidBrickWork: 'Mauerwerk (massiv)', both: 'beides' },
    'construction.constructionCeilingType': { reinforcedConcrete: 'Stahlbeton', woodenBeams: 'Holzbalken', prefabricatedElements: 'Fertigteile', brick: 'Ziegel / Mauerwerk', capCeiling: 'Kappendecke' },
    'construction.floors': { laminateFlooring: 'Laminat', tiling: 'Fliesen', parquetFlooring: 'Parkett', vinylFlooring: 'Vinyl', linoleumFlooring: 'Linoleum', carpet: 'Teppich', cork: 'Kork' },
    'construction.stairs': { concrete: 'Beton', stone: 'Stein', hardwood: 'Hartholz', softwood: 'Weichholz', metal: 'Metall', none: 'keine Treppe' },
    'construction.constructionGlazingType': { oneWay: 'Einfachverglasung', twoWay: 'Zweifachverglasung', threeWay: 'Dreifachverglasung', fourWay: 'Vierfachverglasung', fiveWay: 'Fünffachverglasung' },
    'construction.constructionWindowFrameType': { wood: 'Holz', plastic: 'Kunststoff', aluminium: 'Aluminium' },
    'construction.constructionRoofShape': { flatRoof: 'Flachdach', gableRoof: 'Satteldach', leanToRoof: 'Pultdach', hippedRoof: 'Walmdach', scheddach: 'Sheddach',
      halfHipRoof: 'Krüppelwalmdach', mansardRoof: 'Mansarddach', barrelRoof: 'Tonnendach', tentRoof: 'Zeltdach', canopy: 'Kuppeldach', dormerRoof: 'Dach mit Gauben' },
    'construction.constructionRoofCovering': { concreteBricksStones: 'Betondachsteine', tar: 'Bitumen / Dachpappe', slate: 'Schiefer', reed: 'Reet', sheetMetal: 'Blech / Metall',
      greening: 'Gründach', clayBricks: 'Tondachziegel', other: 'Sonstige' },
    'construction.constructionHeatingType': { gasCentral: 'Gas-Zentralheizung', gasFloorHeating: 'Gas mit Fußbodenheizung', oilCentral: 'Öl-Zentralheizung', districtHeating: 'Fernwärme',
      singleThermalBath: 'Gas-Etagenheizung (Therme)', singleOvensGravityHeating: 'Einzelöfen / Schwerkraftheizung', solarThermalEnergy: 'Solarthermie', heatPump: 'Wärmepumpe',
      pelletHeating: 'Pelletheizung', chp: 'Blockheizkraftwerk (BHKW)', fuelCellHeating: 'Brennstoffzellenheizung', electricHeating: 'Elektroheizung' },
    'construction.sanitary': { bathroomWithShower: 'Bad mit Dusche', bathroomWithBathtub: 'Bad mit Badewanne', bathroomWithShowerAndBathtub: 'Bad mit Dusche und Badewanne', guestToilet: 'Gäste-WC' },
    'construction.balcony': VORHANDEN, 'construction.energyCertificate': VORHANDEN,
    'construction.electricity': { after1990: 'nach 1990 (erneuert)', before1990: 'vor 1990', both: 'teils vor, teils nach 1990' },
    'construction.renewableEnergies': { photovoltaics: 'Photovoltaik', solarThermalEnergy: 'Solarthermie', none: 'keine' },
    'owner.ownershipType': { soleOwner: 'Alleineigentümer', notSoleOwner: 'Miteigentümer (nicht allein)', notOwner: 'nicht Eigentümer' },
    'agreement.desiredProducts': { receiveAssessment: 'zuerst eine Ersteinschätzung erhalten', noAssessment: 'Gutachten direkt beauftragen (ohne Ersteinschätzung)' },
    'agreement.paymentType': { prePay: 'Vorkasse', postPay: 'Zahlung auf Rechnung' },
    'agreement.addonService': { none: 'keine Zusatzleistung', onSiteInspection: 'Besichtigung vor Ort', interiorExteriorOnSiteInspection: 'Besichtigung innen und außen' },
    'agreement.taxPlausibilityCheckService': { none: 'keine', taxLawPlausibilityReview: 'steuerrechtliche Plausibilitätsprüfung durch eine Kanzlei' }
  };
  var LAENDER = { AL: 'Albanien', AD: 'Andorra', AM: 'Armenien', AT: 'Österreich', AZ: 'Aserbaidschan', BY: 'Belarus', BE: 'Belgien', BA: 'Bosnien und Herzegowina',
    BG: 'Bulgarien', HR: 'Kroatien', CY: 'Zypern', CZ: 'Tschechien', DK: 'Dänemark', EE: 'Estland', FI: 'Finnland', FR: 'Frankreich', GE: 'Georgien', DE: 'Deutschland',
    GR: 'Griechenland', HU: 'Ungarn', IS: 'Island', IE: 'Irland', IT: 'Italien', KZ: 'Kasachstan', XK: 'Kosovo', LV: 'Lettland', LI: 'Liechtenstein', LT: 'Litauen',
    LU: 'Luxemburg', MT: 'Malta', MD: 'Moldau', MC: 'Monaco', ME: 'Montenegro', NL: 'Niederlande', MK: 'Nordmazedonien', NO: 'Norwegen', PL: 'Polen', PT: 'Portugal',
    RO: 'Rumänien', RU: 'Russland', SM: 'San Marino', RS: 'Serbien', SK: 'Slowakei', SI: 'Slowenien', ES: 'Spanien', SE: 'Schweden', CH: 'Schweiz', TR: 'Türkei',
    UA: 'Ukraine', GB: 'Vereinigtes Königreich', VA: 'Vatikanstadt' };
  /* Unterfelder einer Liste (Eigentuemerdaten) */
  var UNTERFELD = { title: 'Anrede', companyName: 'Firmenname', firstName: 'Vorname', lastName: 'Nachname', streetName: 'Straße', streetNumber: 'Hausnummer',
    postalCode: 'Postleitzahl', city: 'Ort', country: 'Land', phoneNumber: 'Telefonnummer', email: 'E-Mail-Adresse' };

  function tabelleFuer(pfad) {
    if (UEBERSETZUNG[pfad]) return UEBERSETZUNG[pfad];
    if (/(^|\.)country$/.test(pfad)) return LAENDER;
    if (/^modernizations\.[A-Za-z]+$/.test(pfad)) return UEBERSETZUNG['modernizations.*'];
    return null;
  }
  /** Deutscher Text einer Option. { text, uebersetzt:true|false, unbekannt:true|false } */
  function optionText(pfad, opt) {
    var v = String(opt && opt.value != null ? opt.value : opt), l = opt && opt.label != null ? String(opt.label) : v;
    if (l !== v && !/^[a-z]+[A-Z][A-Za-z]*$/.test(l)) return { text: l, uebersetzt: false, unbekannt: false };   /* echte Beschriftung des Partners */
    var t = tabelleFuer(pfad);
    if (t && t[v]) return { text: t[v], uebersetzt: true, unbekannt: false };
    if (/[ /äöüÄÖÜß]/.test(v) || /^[A-ZÄÖÜ][a-zäöüß]+$/.test(v)) return { text: v, uebersetzt: false, unbekannt: false };   /* schon deutscher Text als Wert (Gewerbe-Beschreibung: „Landwirtschaft“, „Sonstiges“) */
    if (/^[A-Z]\+?$/.test(v)) return { text: v, uebersetzt: false, unbekannt: false };      /* Energieklasse A … H */
    return { text: 'weitere Angabe (' + v.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase() + ')', uebersetzt: false, unbekannt: true };
  }

  /* ── Vorbelegung aus dem Objekt ─────────────────────────────────── */
  /* „10 - 20 Jahre“ -> „vor 15–20 Jahren“: Marcel 16.11.2026 „mittlere Grenze nehmen (≈ vor 15 Jahren)“ — die
     Partner-Stufe, die bei 15 beginnt, trifft diese Mitte; sie liegt auf der vorsichtigen (aelteren) Seite. */
  var MOD_STUFE = { 'Keine/Nie': 'none', '> 20 Jahre': 'moreThanTwentyYears', '10 - 20 Jahre': 'fifteenToTwentyYears',
    '5 - 10 Jahre': 'fiveToTenYears', '< 5 Jahre': 'fiveYears', 'Kernsanierung': 'fiveYears' };
  /* Bauteil beim Partner -> Feld in DealPilot (mod_*). Anlage 2: Leitungssysteme = technische Ausstattung. */
  var MOD_BAUTEIL = { roof: 'dach', outsideInsulation: 'aussenwand', windowsAndExternalDoors: 'fenster', heatingSystem: 'heizung',
    interior: 'innenausbau', bathroom: 'baeder', technicalEquipment: 'leitungen' };
  /* Objektart: erste Option, die die Definition anbietet (Lite kennt kein ZFH/DHH/RH). */
  var OBJART = { ETW: ['apartment'], EFH: ['singleFamilyHouse'], ZFH: ['twoFamilyHouse', 'singleFamilyHouse'],
    DHH: ['semiDetachedHouse', 'singleFamilyHouse'], RH: ['townhouse', 'singleFamilyHouse'], MFH: ['apartmentBuilding'],
    WGH: ['residentialAndCommercialProperty'], BUERO: ['commercialProperty'], GESCH: ['commercialProperty'], HOTEL: ['commercialProperty'],
    GEW: ['commercialProperty'], GAR: ['commercialProperty', 'other'], GRST: ['undevelopedProperty', 'other'] };
  /* Gewerbe-Beschreibung: Option der Definition, deren Text so beginnt (Werte sind beim Lite die deutschen Texte). */
  var GEWERBE = { BUERO: /^(Büro|officeBank)/i, GESCH: /^(Laden|retail)/i, HOTEL: /^(Hotel|hotel)/i, GEW: /^(Lager|warehouse)/i, GAR: /^(Parkhaus|parking)/i };
  /* Ausstattung (Tab Objekt) -> Bauweise beim Partner */
  var BODEN = { PARKETT_NATURSTEIN: ['parquetFlooring'], FLIESEN: ['tiling'], TEPPICH_LAMINAT: ['laminateFlooring', 'carpet'], KUNSTSTOFF_PVC: ['vinylFlooring'] };
  var VERGLASUNG = { EINFACH: 'oneWay', KASTENFENSTER: 'oneWay', ISOLIERVERGLASUNG: 'twoWay', ZWEIFACHVERGLASUNG: 'twoWay', DREIFACHVERGLASUNG: 'threeWay' };
  var DECKUNG = { DACHPFANNEN: 'clayBricks', SCHIEFER: 'slate', METALL: 'sheetMetal', DACHPAPPE: 'tar', SONSTIGE: 'other' };
  var HEIZUNG = { ZENTRALHEIZUNG: 'gasCentral', FUSSBODENHEIZUNG: 'gasFloorHeating', EINZELOEFEN: 'singleOvensGravityHeating' };
  /* nhk_geschosse (Tab Objekt, NHK 2010): 0 KG+EG, 1 KG+EG+OG, 2 EG ohne Keller, 3 EG+OG ohne Keller */
  var GESCHOSSE = { '0': { voll: 1, keller: 'fullBasement' }, '1': { voll: 2, keller: 'fullBasement' }, '2': { voll: 1, keller: 'noBasement' }, '3': { voll: 2, keller: 'noBasement' } };

  function _wahl(opts, kandidaten) {
    var werte = opts.map(function (o) { return o.value; });
    if (!werte.length) return kandidaten[0];
    for (var i = 0; i < kandidaten.length; i++) if (werte.indexOf(kandidaten[i]) >= 0) return kandidaten[i];
    return undefined;
  }
  function _str(x) { return x == null ? '' : String(x).trim(); }
  function _zahl(x) { var s = _str(x); if (!s) return null; var n = Number(s.replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; }

  /**
   * Regeln je Partnerfeld: Pfad-Muster -> function(objekt, nutzer, art, f) -> { wert, quelle, art: 'objekt'|'abgeleitet'|'konto' }
   * quelle nennt das DealPilot-Feld (fuer die Tabelle im Bericht und den Hinweis am Feld).
   */
  var REGELN = [
    [/^property\.type$/, function (o, n, art, f, opts) { var k = OBJART[art]; var w = k && _wahl(opts, k); return w && { wert: w, quelle: 'objart', art: (k[0] === w ? 'objekt' : 'abgeleitet') }; }],
    [/^property\.description$/, function (o, n, art, f, opts) {
      if (f.inputType === 'select') { var re = GEWERBE[art]; var x = re && opts.filter(function (q) { return re.test(q.value) || re.test(q.label); })[0]; return x && { wert: x.value, quelle: 'objart', art: 'abgeleitet' }; }
      if (art !== 'ETW') return null;
      var wfl = _zahl(o.wfl);
      return { wert: 'Eigentumswohnung' + (wfl > 0 ? ', ca. ' + Math.round(wfl) + ' m² Wohnfläche' : ''), quelle: 'objart, wfl', art: 'abgeleitet' };
    }],
    [/^property\.(?:address\.)?(streetName|streetNumber|postalCode|city|country)$/, function (o, n, art, f, opts, m) {
      var a = { streetName: ['str', o.str], streetNumber: ['hnr', o.hnr], postalCode: ['plz', o.plz], city: ['ort', o.ort], country: ['—', (o.str || o.ort) ? 'DE' : ''] }[m[1]];
      return _str(a[1]) ? { wert: _str(a[1]), quelle: a[0], art: m[1] === 'country' ? 'abgeleitet' : 'objekt' } : null;
    }],
    [/^property\.constructionYear$/, function (o) { var bj = parseInt(_str(o.baujahr), 10); return bj >= 1800 && bj <= new Date().getFullYear() ? { wert: bj, quelle: 'baujahr', art: 'objekt' } : null; }],
    [/^valuation\.valuationDate$/, function (o) { var d = _str(o.kaufdat); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? { wert: d, quelle: 'kaufdat (Kaufdatum = AfA-Beginn)', art: 'abgeleitet' } : null; }],
    [/^objectDetails\.(propertyArea|propertyResidentialArea)$/, function (o) { var w = _zahl(o.wfl); return w > 0 ? { wert: w, quelle: 'wfl', art: 'objekt' } : null; }],
    [/^objectDetails\.propertyNumberOfBathrooms$/, function (o) {
      var b = _zahl(o.bad_anz); if (b > 0) return { wert: Math.round(b), quelle: 'bad_anz', art: 'objekt' };
      if (o.eq_bath === 'MEHR_ALS_EIN_BAD') return { wert: 2, quelle: 'eq_bath (mehr als ein Bad)', art: 'abgeleitet' };
      if (/^(EIN_BAD|INNENLIEGEND|MIT_FENSTER)$/.test(_str(o.eq_bath))) return { wert: 1, quelle: 'eq_bath', art: 'abgeleitet' };
      return null;
    }],
    [/^objectDetails\.propertyNumberOfFullFloors$/, function (o) { var g = GESCHOSSE[_str(o.nhk_geschosse)]; return g ? { wert: g.voll, quelle: 'nhk_geschosse', art: 'abgeleitet' } : null; }],
    [/^objectDetails\.propertyNumberOfUnits$/, function (o, n, art) {
      var e = _zahl(o.einheiten); if (e > 0) return { wert: Math.round(e), quelle: 'einheiten', art: 'objekt' };
      var d = { EFH: 1, DHH: 1, RH: 1, ZFH: 2 }[art]; return d ? { wert: d, quelle: 'objart', art: 'abgeleitet' } : null;
    }],
    [/^objectDetails\.propertyBasement$/, function (o) { var g = GESCHOSSE[_str(o.nhk_geschosse)]; return g ? { wert: g.keller, quelle: 'nhk_geschosse', art: 'abgeleitet' } : null; }],
    [/^construction\.floors$/, function (o) { var b = BODEN[_str(o.eq_floor)]; return b ? { wert: b.slice(0, 1), quelle: 'eq_floor', art: 'abgeleitet' } : null; }],
    [/^construction\.constructionGlazingType$/, function (o) { var v = VERGLASUNG[_str(o.eq_windows)]; return v ? { wert: [v], quelle: 'eq_windows', art: 'abgeleitet' } : null; }],
    [/^construction\.constructionRoofShape$/, function (o) { return _str(o.nhk_dach) === '3' ? { wert: 'flatRoof', quelle: 'nhk_dach (Flachdach)', art: 'abgeleitet' } : null; }],
    [/^construction\.constructionRoofCovering$/, function (o) { var v = DECKUNG[_str(o.eq_roof)]; return v ? { wert: v, quelle: 'eq_roof', art: 'abgeleitet' } : null; }],
    [/^construction\.constructionHeatingType$/, function (o) { var v = HEIZUNG[_str(o.eq_heating)]; return v ? { wert: v, quelle: 'eq_heating', art: 'abgeleitet' } : null; }],
    [/^construction\.sanitary$/, function (o) { return o.eq_guest_wc === 'GAESTE_WC' ? { wert: ['guestToilet'], quelle: 'eq_guest_wc', art: 'abgeleitet' } : null; }],
    [/^construction\.balcony$/, function (o) { var b = _zahl(o.balkon_flae); return b == null ? null : { wert: b > 0 ? 'available' : 'notAvailable', quelle: 'balkon_flae', art: 'abgeleitet' }; }],
    [/^construction\.renewableEnergies$/, function (o) { return _zahl(o.inv_pv) > 0 ? { wert: 'photovoltaics', quelle: 'inv_pv', art: 'abgeleitet' } : null; }],
    [/^construction\.energyCertificate$/, function (o) { return _str(o.ds2_energie) ? { wert: 'available', quelle: 'ds2_energie', art: 'abgeleitet' } : null; }],
    [/^construction\.energyEfficiencyClass$/, function (o) { var k = _str(o.ds2_energie).replace('+', ''); return k ? { wert: k, quelle: 'ds2_energie' + (/\+/.test(o.ds2_energie || '') ? ' (A+ → A)' : ''), art: 'objekt' } : null; }],
    [/^(?:renovation|construction)\.hasRenovations$/, function (o) {
      var mod = o.mod || {}, k = Object.keys(MOD_STUFE), werte = ['dach', 'fenster', 'leitungen', 'heizung', 'aussenwand', 'baeder', 'innenausbau'].map(function (x) { return _str(mod[x]); });
      if (werte.some(function (w) { return w === 'Kernsanierung'; })) return { wert: 'yes', quelle: 'mod_* (Kernsanierung)', art: 'abgeleitet' };
      if (werte.every(function (w) { return k.indexOf(w) >= 0; })) return { wert: 'no', quelle: 'mod_* (keine Kernsanierung)', art: 'abgeleitet' };
      return null;
    }],
    [/^modernizations\.([A-Za-z]+)$/, function (o, n, art, f, opts, m) { var b = MOD_BAUTEIL[m[1]]; var s = b && _str((o.mod || {})[b]); return s && MOD_STUFE[s] ? { wert: MOD_STUFE[s], quelle: 'mod_' + b, art: s === '10 - 20 Jahre' || s === 'Kernsanierung' ? 'abgeleitet' : 'objekt' } : null; }],
    [/^modernizations\.floorPlan\.age$/, function (o) { var s = _str((o.mod || {}).grundriss); return MOD_STUFE[s] ? { wert: MOD_STUFE[s], quelle: 'mod_grundriss', art: s === '10 - 20 Jahre' ? 'abgeleitet' : 'objekt' } : null; }],
    [/^requester\.title$/, function (o, n) { return _str(n.firma) ? { wert: 'company', quelle: 'Einstellungen › Firma', art: 'konto' } : null; }],
    [/^requester\.(firstName|lastName|email|phoneNumber|companyName)$/, function (o, n, art, f, opts, m) {
      var x = { firstName: ['Einstellungen › Name', n.vorname], lastName: ['Einstellungen › Name', n.nachname], email: ['Einstellungen › E-Mail', n.email],
        phoneNumber: ['Einstellungen › Telefon', n.telefon], companyName: ['Einstellungen › Firma', n.firma] }[m[1]];
      return _str(x[1]) ? { wert: _str(x[1]), quelle: x[0], art: 'konto' } : null;
    }],
    [/^requester\.address\.(streetName|streetNumber|postalCode|city|country)$/, function (o, n, art, f, opts, m) {
      var x = { streetName: n.str, streetNumber: n.hnr, postalCode: n.plz, city: n.ort, country: (n.str || n.ort) ? 'DE' : '' }[m[1]];
      return _str(x) ? { wert: _str(x), quelle: 'Einstellungen › Adresse', art: 'konto' } : null;
    }],
    [/^(?:requester|agreement)\.leadSource$/, function () { return { wert: 'other', quelle: '— (Anfrage über DealPilot)', art: 'abgeleitet' }; }],
    [/^(?:requester|agreement)\.leadSourceDetails$/, function () { return { wert: 'DealPilot', quelle: '— (Anfrage über DealPilot)', art: 'abgeleitet' }; }],
    [/^owner\.ownershipType$/, function (o) { var e = _str(o.eig_struktur); return e ? { wert: e === 'allein' ? 'soleOwner' : 'notSoleOwner', quelle: 'eig_struktur', art: 'objekt' } : null; }],
    [/^agreement\.desiredProducts$/, function () { return { wert: 'noAssessment', quelle: '— (Knopf „Gutachten beauftragen“)', art: 'abgeleitet' }; }]
  ];

  /**
   * vorbelegenMitHerkunft(def, objekt, nutzer) -> { data, herkunft: { pfad: {quelle, art} } }
   * objekt: Felder des Tabs Objekt (objart, str, hnr, plz, ort, baujahr, wfl, einheiten, nhk_geschosse,
   *         nhk_dach, eq_*, bad_anz, balkon_flae, inv_pv, ds2_energie, kaufdat, eig_struktur, mod:{…})
   * nutzer: Einstellungen des Kontos { vorname, nachname, email, telefon, firma, str, hnr, plz, ort }
   * Gesetzt wird nur, was die Definition als Feld fuehrt; bei Auswahlfeldern nur gueltige Optionen.
   */
  function vorbelegenMitHerkunft(def, objekt, nutzer) {
    objekt = objekt || {}; nutzer = nutzer || {};
    var data = {}, herkunft = {}, schema = def && def.schema;
    var art = _str(objekt.objart).toUpperCase();
    var alle = [];
    felder(def).forEach(function (g) { g.fields.forEach(function (f) { alle.push(f); }); });
    /* zweimal: Felder mit Bedingung (Beschreibung, Energieklasse) sehen die Werte des ersten Laufs */
    for (var runde = 0; runde < 2; runde++) {
      alle.forEach(function (f) {
        var p = feldPfad(f);
        if (holen(data, p) !== undefined || f.inputType === 'file') return;
        if (runde === 1 && f.visibleWhen && !logik(f.visibleWhen, data)) return;
        if (runde === 0 && f.visibleWhen) return;
        var opts = optionen(f, schema);
        for (var i = 0; i < REGELN.length; i++) {
          var m = p.match(REGELN[i][0]); if (!m) continue;
          var r = REGELN[i][1](objekt, nutzer, art, f, opts, m);
          if (!r || r.wert === undefined || r.wert === null || r.wert === '') return;
          var werte = opts.map(function (o) { return o.value; });
          if (/^(select|radio)$/.test(f.inputType) && werte.length && werte.indexOf(String(r.wert)) < 0) return;
          if (f.inputType === 'multiselect' && werte.length && !r.wert.every(function (w) { return werte.indexOf(w) >= 0; })) return;
          setzen(data, p, r.wert); herkunft[p] = { quelle: r.quelle, art: r.art };
          return;
        }
      });
    }
    return { data: data, herkunft: herkunft };
  }
  function vorbelegen(def, objekt, nutzer) { return vorbelegenMitHerkunft(def, objekt, nutzer).data; }

  /* „Max Mustermann“ -> Vorname / Nachname (letztes Wort = Nachname). */
  function nameTeilen(name) {
    var t = _str(name).replace(/\s*\(.*?\)\s*/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!t.length) return { vorname: '', nachname: '' };
    if (t.length === 1) return { vorname: '', nachname: t[0] };
    return { vorname: t.slice(0, -1).join(' '), nachname: t[t.length - 1] };
  }
  /* „Hermannstraße 9a“ -> Straße / Hausnummer */
  function strasseTeilen(s) {
    var m = _str(s).match(/^(.*?)[\s,]+(\d+\s*[a-zA-Z]?(?:\s*[-\/]\s*\d+\s*[a-zA-Z]?)?)$/);
    return m ? { str: m[1].trim(), hnr: m[2].replace(/\s+/g, '') } : { str: _str(s), hnr: '' };
  }

  /* ── Eingaben -> Datentypen der Definition ─────────────────────── */
  function wertAusEingabe(f, roh, schema) {
    var s = schema ? schemaAn(schema, feldPfad(f)) : null;
    var typ = s && s.type;
    if (f.inputType === 'checkbox') return !!roh;
    if (f.inputType === 'multiselect') return Array.isArray(roh) ? roh : (roh ? [roh] : []);
    if (Array.isArray(roh)) return roh.length ? roh : undefined;   /* v3570: Liste (Eigentuemerdaten) */
    if (roh === '' || roh == null) return undefined;
    if (f.inputType === 'number' || typ === 'integer' || typ === 'number') {
      var n = Number(String(roh).replace(/\./g, '').replace(',', '.'));
      if (!isFinite(n)) return roh;
      return typ === 'integer' ? Math.round(n) : n;
    }
    if (typ === 'boolean') return roh === true || roh === 'true' || roh === 'yes';
    return String(roh);
  }

  /* Nur sichtbare Felder schicken; ausgeblendete fallen weg (sonst lehnt der Partner sie ab). */
  function sammeln(def, werte) {
    var data = {}, schema = def && def.schema;
    var alle = [];
    felder(def).forEach(function (g) { g.fields.forEach(function (f) { if (f.inputType !== 'file') alle.push(f); }); });
    /* zweimal: ein Feld, das von einem anderen abhaengt, sieht dessen Wert erst im zweiten Lauf */
    for (var runde = 0; runde < 2; runde++) {
      data = {};
      alle.forEach(function (f) {
        var p = feldPfad(f);
        if (!(p in werte)) return;
        var w = wertAusEingabe(f, werte[p], schema);
        if (w === undefined) return;
        setzen(data, p, w);
      });
      var sicht = {};
      alle.forEach(function (f) { var p = feldPfad(f); if (sichtbar(f, data) && holen(data, p) !== undefined) setzen(sicht, p, holen(data, p)); });
      data = sicht;
    }
    return data;
  }

  /* Fehler des Partners (path „property.constructionYear“) -> Feld. Unbekannte Pfade bleiben allgemein. */
  function fehlerZuordnen(def, fehler) {
    var bekannt = {}, ohne = [];
    felder(def).forEach(function (g) { g.fields.forEach(function (f) { bekannt[feldPfad(f)] = true; bekannt[f.id] = true; }); });
    var je = {};
    (fehler || []).forEach(function (e) {
      var p = zeigerZuPunkt(e.path || '');
      var treffer = bekannt[p] ? p : Object.keys(bekannt).filter(function (k) { return p.indexOf(k + '.') === 0; })[0];
      if (treffer) (je[treffer] = je[treffer] || []).push(e.message); else ohne.push((p ? p + ': ' : '') + e.message);
    });
    return { jeFeld: je, allgemein: ohne };
  }

  /* Der Anbietername bleibt draussen (CLAUDE.md, Anbieter-Neutralitaet). */
  /* v3580 · nach aussen heisst der Partner gutachten.org (Marcel 16.11.2026), nie der Firmenname */
  function neutral(t) { return t == null ? '' : String(t).replace(/evalion/gi, 'gutachten.org'); }

  var API = { logik: logik, sichtbar: sichtbar, holen: holen, setzen: setzen, zeigerZuPunkt: zeigerZuPunkt, feldPfad: feldPfad,
    schemaAn: schemaAn, optionen: optionen, felder: felder, vorbelegen: vorbelegen, vorbelegenMitHerkunft: vorbelegenMitHerkunft, optionText: optionText, pflicht: pflicht, UEBERSETZUNG: UEBERSETZUNG, LAENDER: LAENDER, UNTERFELD: UNTERFELD, REGELN: REGELN, nameTeilen: nameTeilen, strasseTeilen: strasseTeilen,
    wertAusEingabe: wertAusEingabe, sammeln: sammeln, fehlerZuordnen: fehlerZuordnen, neutral: neutral, MOD_STUFE: MOD_STUFE, MOD_BAUTEIL: MOD_BAUTEIL, OBJART: OBJART };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.DpGutachterAbbildung = API;
})(typeof window !== 'undefined' ? window : this);
