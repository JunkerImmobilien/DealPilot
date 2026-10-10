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
    /* ═══ v2070 · DER MARKTBERICHT GEHOERT IN DIE TABELLE ═══════════════
       Marcel, 10.10.2026: „ob wir dann auch alle Marktberichtdaten auch
       mit uebergeben koennen. Also dass wir wirklich was
       Vollumfaengliches haben."

       Die DealPilot-Sicherung bekommt sie seit `v2069` von selbst - sie
       holt `/objects/portfolio-export` und schreibt es vollstaendig weg.
       DIESE Tabelle ist eine flache Auswahl, und dort muss jede Spalte
       einzeln benannt werden.

       Vier reichen fuer den Zweck einer Tabelle: was ist das Objekt
       heute wert, wie viele Berichte gibt es, seit wann, und wie hat
       sich der Wert seitdem entwickelt. Den vollen Verlauf traegt die
       JSON-Sicherung - eine Tabelle mit 33 Spalten fuer 33 Berichte
       waere keine Tabelle mehr. */
    ['Marktwert', '_mb_wert', 'EUR'],
    ['Marktberichte', '_mb_anzahl', 'Anzahl'],
    ['Erster Bericht', '_mb_erster', 'Datum'],
    ['Wertentwicklung', '_mb_delta', '%'],
    ['Fotos', 'fotos_anzahl', 'Anzahl']
  ];

  function lies(obj, pfad) {
    if (pfad === '_status') {
      return obj.gewonnen ? 'gewonnen' : (obj.verloren ? 'verloren' : 'offen');
    }
    /* v2070 - die vier Marktbericht-Spalten. Sie stehen NEBEN `daten`,
       nicht darin: die Berichte kommen aus einer eigenen Datenbank. */
    if (pfad.indexOf('_mb_') === 0) {
      var mb = obj.marktbericht;
      if (!mb) return null;
      var v = (mb.verlauf && mb.verlauf.length) ? mb.verlauf : null;
      if (pfad === '_mb_wert') return (mb.stand && mb.stand.marktwert_eur) || null;
      if (pfad === '_mb_anzahl') return v ? v.length : ((mb.stand && mb.stand.berichte) || null);
      if (pfad === '_mb_erster') return v ? String(v[0].datum).slice(0, 10) : null;
      if (pfad === '_mb_delta') {
        /* Nur rechnen, wenn es wirklich zwei Punkte gibt - aus einem
           einzelnen Bericht laesst sich keine Entwicklung ablesen, und
           eine 0 dort waere eine Behauptung. */
        if (!v || v.length < 2) return null;
        var a = Number(v[0].marktwert_eur) || 0;
        var b = Number(v[v.length - 1].marktwert_eur) || 0;
        if (!a) return null;
        return Math.round((b - a) / a * 1000) / 10;
      }
      return null;
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

  /* ── Der Stand, bevor etwas geschrieben wird ──────────────────────
     v2048 - Marcel: „vorher soll der Stand geprueft werden und wenn
     veraltet gefragt werden, ob erst aktualisiert werden soll."

     Eine exportierte Analyse traegt kein „ungefaehr". Wer die Datei
     weitergibt, gibt eine Beurteilung weiter - und wenn sich der
     Kaufpreis seitdem geaendert hat, beurteilt sie ein Objekt, das es
     so nicht mehr gibt. In der App steht das Banner daneben, in der
     Datei nicht. */
  function standPruefen(paket) {
    var ohne = [], veraltet = [], ohneStempel = [];
    (paket.objekte || []).forEach(function (o) {
      var titel = (o.nummer ? o.nummer + ' ' : '') + (o.name || o.ort || o.id);
      if (!o.analyse) { ohne.push(titel); return; }
      var f = o.analyse._fuer;
      if (!f || !f.abdruck) { ohneStempel.push(titel); return; }
      if (typeof window._analyseAbweichungAus !== 'function') return;
      var ab = window._analyseAbweichungAus(o.daten, f.abdruck);
      if (ab && ab.length) veraltet.push(titel + ' (' + ab.slice(0, 3).join(', ')
        + (ab.length > 3 ? ' +' + (ab.length - 3) : '') + ')');
    });
    var pf = paket.wissen && paket.wissen.portfolio_analyse;
    var pfStand = (pf && pf.stand) ? String(pf.stand).slice(0, 10) : null;
    var pfAlt = null;
    if (pfStand) {
      var tage = Math.floor((Date.now() - Date.parse(pfStand)) / 86400000);
      if (tage > 30) pfAlt = tage;
    }
    return { ohne: ohne, veraltet: veraltet, ohneStempel: ohneStempel,
             portfolioFehlt: !pf, portfolioAlt: pfAlt, gesamt: (paket.objekte || []).length };
  }

  /* Gefragt wird, ob TROTZDEM exportiert wird - nicht, ob
     aktualisiert werden soll. Das Aktualisieren kostet Guthaben und
     laeuft je Objekt; eine Frage, die eine teure Handlung automatisch
     ausloest, ist keine Frage. */
  function nachfragen(b) {
    var z = [];
    if (b.veraltet.length) z.push('\u26a0 ' + b.veraltet.length + ' von ' + b.gesamt
      + ' Pilot-Analysen sind VERALTET \u2014 die Zahlen haben sich seitdem geaendert:\n   \u2022 '
      + b.veraltet.slice(0, 6).join('\n   \u2022 ')
      + (b.veraltet.length > 6 ? '\n   \u2022 \u2026 und ' + (b.veraltet.length - 6) + ' weitere' : ''));
    if (b.ohne.length) z.push('\u2139 ' + b.ohne.length + ' Objekte haben noch GAR KEINE Pilot-Analyse.');
    if (b.ohneStempel.length) z.push('\u2139 ' + b.ohneStempel.length + ' Analysen tragen kein Datum (vor Oktober 2026).');
    if (b.portfolioFehlt) z.push('\u2139 Es liegt KEINE Portfolio-Analyse vor (entsteht im Cockpit).');
    else if (b.portfolioAlt) z.push('\u26a0 Die Portfolio-Analyse ist ' + b.portfolioAlt + ' Tage alt.');
    if (!z.length) return true;
    return window.confirm(z.join('\n\n')
      + '\n\nTrotzdem exportieren?\n'
      + 'Abbrechen = erst aktualisieren, dann noch einmal exportieren.');
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
    /* v2048 - erst pruefen, dann schreiben. Nach einem Abbruch
       entsteht KEINE Datei: eine halbe Antwort auf die Frage waere
       schlimmer als keine. */
    if (!nachfragen(standPruefen(paket))) {
      if (typeof toast === 'function') toast('\u2139 Export abgebrochen \u2014 erst aktualisieren.');
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
    _standPruefen: standPruefen,
    /* v2048b - auch die Sicherung prueft den Stand. Sie IST der Export
       (v2045), also gilt Marcels Bedingung dort genauso. */
    standPruefenUndFragen: function (paket) { return nachfragen(standPruefen(paket)); },
    _csvAus: csvAus,
    _lies: lies
  };
  /* Kurzname fuer einen onclick im Markup */
  window.exportPortfolioKomplett = function () { return exportieren({}); };
})();
