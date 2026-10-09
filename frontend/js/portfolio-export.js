/* portfolio-export.js - v2043
 * ═════════════════════════════════════════════════════════════════════
 * DAS GANZE PORTFOLIO ALS DATEI - MIT DEM WISSEN DAZU.
 *
 * Marcel: „ich brauche dann ein Export ueber das gesamte Portfolio.
 * Wichtig ist, dass wir das gesamte Wissen mitgeben."
 *
 * ── ZWEI DATEIEN, EINE QUELLE ───────────────────────────────────────
 *
 * **JSON** traegt alles und ist die Wahrheit: Datensatz je Objekt,
 * Pilot-Analyse, Ankauf-Stand, das Feld-Lexikon, das Projektwissen und
 * Marcels eigene Ergaenzung.
 *
 * **CSV** ist das, womit man tatsaechlich rechnet. Sie wird AUS
 * DEMSELBEN Paket gebaut - nicht aus einem zweiten Abruf.
 *
 *   > Zwei Exporte, die auseinanderlaufen koennen, sind schlimmer als
 *   > einer. Wer sie aus derselben Antwort baut, kann sie nicht
 *   > auseinanderlaufen lassen.
 *
 * Die Tabelle traegt die Spalten, die man vergleicht - nicht alle 280
 * Felder. Wer alles braucht, nimmt das JSON; dafuer ist es da. Welche
 * Spalten das sind, steht in SPALTEN, und jede nennt ihre Einheit.
 * ═════════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  /* Spalte: [Ueberschrift, Pfad im Objekt, Einheit]
     Der Pfad ist absichtlich einfach gehalten (eine Ebene mit Punkt),
     damit man hier nachsehen und nachrechnen kann. */
  var SPALTEN = [
    ['Nummer', 'nummer', ''],
    ['Objekt', 'name', ''],
    ['Ort', 'ort', ''],
    ['Lageklasse', 'lageklasse', ''],
    ['Status', '_status', ''],
    ['Ankauf-Stand', 'ankauf_stand', 'Datum'],
    ['Kaufpreis', 'daten.kp', 'EUR'],
    ['Wohnflaeche', 'daten.wfl', 'm2'],
    ['Baujahr', 'daten.bj', 'Jahr'],
    ['Nettokaltmiete', 'daten.nkm', 'EUR/Monat'],
    ['Jahresmiete', 'daten._kpis_miete_j', 'EUR/Jahr'],
    ['Bruttomietrendite', 'daten._kpis_bmy', '%'],
    ['Nettomietrendite', 'daten._kpis_nmy', '%'],
    ['DSCR', 'daten._kpis_dscr', ''],
    ['Cashflow n. Steuer', 'daten._kpis_cf_ns', 'EUR/Jahr'],
    ['LTV', 'daten._kpis_ltv', '%'],
    ['DealScore', 'daten._dealpilot_score', '0-100'],
    ['Investor-Score', 'daten._ds2_score', '0-100'],
    ['Analyse vom', 'analyse._fuer.stand', 'Datum'],
    ['Fotos', 'fotos_anzahl', 'Anzahl']
  ];

  function lies(obj, pfad) {
    if (pfad === '_status') {
      return obj.gewonnen ? 'gewonnen' : (obj.verloren ? 'verloren' : 'offen');
    }
    var teile = pfad.split('.'), v = obj;
    for (var i = 0; i < teile.length; i++) {
      if (v === null || v === undefined) return null;
      v = v[teile[i]];
    }
    return (v === undefined) ? null : v;
  }

  /* CSV fuer deutsches Excel: Semikolon als Trenner, Komma als
     Dezimalzeichen. Eine Datei mit Punkt-Dezimalen landet dort als
     Text, und dann rechnet niemand damit. */
  function feld(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    var s = String(v);
    if (/[";\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function csvAus(paket) {
    var z = [];
    /* Kopf mit Einheiten - sonst raet der Empfaenger */
    z.push(SPALTEN.map(function (s) { return feld(s[0] + (s[2] ? ' [' + s[2] + ']' : '')); }).join(';'));
    paket.objekte.forEach(function (o) {
      z.push(SPALTEN.map(function (s) { return feld(lies(o, s[1])); }).join(';'));
    });
    /* Die Hinweise unter die Tabelle: wer sie liest, laeuft nicht in
       die Einheiten-Fallen. Sie stehen im JSON genauso. */
    z.push('');
    z.push('# DealPilot Portfolio-Export vom ' + paket.erzeugt_am);
    z.push('# ' + paket.anzahl_objekte + ' Objekte. Das vollstaendige Paket (alle Felder,');
    z.push('# Pilot-Analysen, Ankauf-Staende, Feld-Lexikon) liegt in der JSON-Datei.');
    (paket.lexikon && paket.lexikon.hinweise ? paket.lexikon.hinweise : []).forEach(function (h) {
      z.push('# ' + h.replace(/`/g, ''));
    });
    return '﻿' + z.join('\r\n');   /* BOM, sonst zerlegt Excel die Umlaute */
  }

  function speichern(inhalt, name, typ) {
    var blob = new Blob([inhalt], { type: typ });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { a.remove(); URL.revokeObjectURL(a.href); } catch (e) {} }, 400);
  }

  function stempel() {
    return new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  }

  async function exportieren(opt) {
    opt = opt || {};
    if (typeof toast === 'function') toast('ℹ Portfolio wird zusammengestellt …');
    var paket;
    try {
      /* Auth.apiCall - NIE ein nacktes fetch: das umgeht den zentralen
         401-Handler, und ein abgelaufenes Token saehe aus wie ein
         kaputter Export. */
      paket = await Auth.apiCall('/objects/portfolio-export' + (opt.fotos ? '?fotos=1' : ''));
    } catch (e) {
      if (typeof toast === 'function') toast('⚠ Export fehlgeschlagen: ' + (e.message || e));
      return null;
    }
    if (!paket || !Array.isArray(paket.objekte)) {
      if (typeof toast === 'function') toast('⚠ Der Export kam leer zurück.');
      return null;
    }
    var t = stempel();
    speichern(JSON.stringify(paket, null, 2),
      'DealPilot_Portfolio_' + t + '.json', 'application/json');
    speichern(csvAus(paket),
      'DealPilot_Portfolio_' + t + '.csv', 'text/csv;charset=utf-8');
    if (typeof toast === 'function') {
      toast('✓ ' + paket.objekte.length + ' Objekte exportiert — JSON und Tabelle');
    }
    return paket;
  }

  window.DealPilotPortfolioExport = {
    exportieren: exportieren,
    SPALTEN: SPALTEN,
    _csvAus: csvAus,
    _lies: lies
  };
  /* Kurzname fuer einen onclick im Markup */
  window.exportPortfolioKomplett = function () { return exportieren({}); };
})();
