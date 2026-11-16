/* ════════════════════════════════════════════════════════════════════
   v3540 · GUTACHTERPARTNER — ABBILDUNG OBJEKT → FORMULAR (rein, ohne DOM)
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
  function felder(def) {
    var g = (def && def.ui && def.ui.groups) || [];
    return g.slice().sort(function (a, b) { return a.order - b.order; }).map(function (x) {
      return { id: x.id, label: x.label, description: x.description, fields: (x.fields || []).slice().sort(function (a, b) { return a.order - b.order; }) };
    });
  }

  /* ── Vorbelegung aus dem Objekt ─────────────────────────────────── */
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

  function _wahl(opts, kandidaten) {
    var werte = opts.map(function (o) { return o.value; });
    if (!werte.length) return kandidaten[0];
    for (var i = 0; i < kandidaten.length; i++) if (werte.indexOf(kandidaten[i]) >= 0) return kandidaten[i];
    return undefined;
  }
  function _str(x) { return x == null ? '' : String(x).trim(); }

  /**
   * vorbelegen(def, objekt, nutzer) -> data
   * objekt: { objart, str, hnr, plz, ort, baujahr, wfl, mod: {dach, fenster, …, grundriss} }
   * nutzer: { vorname, nachname, email, telefon, str, hnr, plz, ort, firma }
   * Gesetzt wird nur, was die Definition als Feld fuehrt; bei Auswahlfeldern nur gueltige Optionen.
   */
  function vorbelegen(def, objekt, nutzer) {
    objekt = objekt || {}; nutzer = nutzer || {};
    var data = {}, schema = def && def.schema, mod = objekt.mod || {};
    var gefunden = [];
    felder(def).forEach(function (g) { g.fields.forEach(function (f) { gefunden.push(f); }); });
    var art = _str(objekt.objart).toUpperCase();
    function setze(f, wert) {
      if (wert === undefined || wert === null || wert === '') return;
      var p = feldPfad(f);
      var opts = optionen(f, schema);
      if (/^(select|radio)$/.test(f.inputType) && opts.length && opts.map(function (o) { return o.value; }).indexOf(String(wert)) < 0) return;
      if (holen(data, p) !== undefined) return;
      setzen(data, p, wert);
    }
    var bj = parseInt(_str(objekt.baujahr), 10);
    gefunden.forEach(function (f) {
      var p = feldPfad(f), m;
      if (p === 'property.type' || /(^|\.)property\.type$/.test(p)) { var k = OBJART[art]; if (k) setze(f, _wahl(optionen(f, schema), k)); return; }
      if (/(^|\.)property\.description$/.test(p)) {
        if (f.inputType === 'select') {
          var re = GEWERBE[art]; if (!re) return;
          var o = optionen(f, schema).filter(function (x) { return re.test(x.value) || re.test(x.label); })[0];
          if (o && logik(f.visibleWhen || true, { property: { type: (OBJART[art] || [])[0] } })) setze(f, o.value);
          return;
        }
        if (art === 'ETW' && (!f.visibleWhen || logik(f.visibleWhen, { property: { type: 'apartment' } }))) {
          var wfl = parseFloat(_str(objekt.wfl).replace(',', '.'));
          setze(f, 'Eigentumswohnung' + (isFinite(wfl) && wfl > 0 ? ', ca. ' + Math.round(wfl) + ' m² Wohnfläche' : ''));
        }
        return;
      }
      if ((m = p.match(/(^|\.)property\.(?:address\.)?(streetName|streetNumber|postalCode|city|country)$/))) {
        var adr = { streetName: objekt.str, streetNumber: objekt.hnr, postalCode: objekt.plz, city: objekt.ort, country: 'DE' };
        setze(f, _str(adr[m[2]]) || undefined); return;
      }
      if (/(^|\.)constructionYear$/.test(p) && !/renovation/.test(p)) { if (bj >= 1800 && bj <= new Date().getFullYear()) setze(f, bj); return; }
      if ((m = p.match(/(^|\.)modernizations\.(\w+)$/)) && MOD_BAUTEIL[m[2]]) { setze(f, MOD_STUFE[_str(mod[MOD_BAUTEIL[m[2]]])]); return; }
      if (/(^|\.)modernizations\.floorPlan\.age$/.test(p)) { setze(f, MOD_STUFE[_str(mod.grundriss)]); return; }
      if ((m = p.match(/^requester\.(firstName|lastName|email|phoneNumber|companyName)$/))) {
        var n = { firstName: nutzer.vorname, lastName: nutzer.nachname, email: nutzer.email, phoneNumber: nutzer.telefon, companyName: nutzer.firma };
        setze(f, _str(n[m[1]]) || undefined); return;
      }
      if ((m = p.match(/^requester\.address\.(streetName|streetNumber|postalCode|city|country)$/))) {
        var na = { streetName: nutzer.str, streetNumber: nutzer.hnr, postalCode: nutzer.plz, city: nutzer.ort, country: (nutzer.str || nutzer.ort) ? 'DE' : '' };
        setze(f, _str(na[m[1]]) || undefined); return;
      }
    });
    /* Kernsanierung bei einem Bauteil: ein Hinweis, kein Wert — das Jahr kennt DealPilot nicht. */
    return data;
  }

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
  function neutral(t) { return t == null ? '' : String(t).replace(/evalion/gi, 'Gutachterpartner'); }

  var API = { logik: logik, sichtbar: sichtbar, holen: holen, setzen: setzen, zeigerZuPunkt: zeigerZuPunkt, feldPfad: feldPfad,
    schemaAn: schemaAn, optionen: optionen, felder: felder, vorbelegen: vorbelegen, nameTeilen: nameTeilen, strasseTeilen: strasseTeilen,
    wertAusEingabe: wertAusEingabe, sammeln: sammeln, fehlerZuordnen: fehlerZuordnen, neutral: neutral, MOD_STUFE: MOD_STUFE, MOD_BAUTEIL: MOD_BAUTEIL, OBJART: OBJART };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.DpGutachterAbbildung = API;
})(typeof window !== 'undefined' ? window : this);
