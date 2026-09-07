'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   v1254 · Eingabemodus — „Wie genau willst du dieses Objekt rechnen?"

   Testbericht: „Warum werden hier so viele Details abgefragt? Ich wollte
   eine erste Renditeeinschätzung. Vielleicht vorher fragen, wie
   umfangreich der Anwender jetzt die Eingabe machen will?"

   Gemessen am 07.09.2026: 238 Eingabefelder über die sechs Bereiche,
   allein 93 im Tab Objekt. Für eine vollständige Bewertung nötig sind
   14 — sechs Prozent.

   DIE MECHANIK GAB ES SCHON. `workflow.js` kennt seit V56 die Stufen
   `einfach` und `detailliert` und führt je Bereich die Pflichtfelder;
   der Wert steht in `dp_user_settings.workflow_detail_level`. Was
   fehlte, war die Frage — es wurde nie jemand gefragt.

   WIE HIER GEKLAPPT WIRD: auf KARTENEBENE, nicht je Feld. Eine Karte,
   die kein Pflichtfeld der gewählten Stufe enthält, bekommt einen
   Kopf zum Aufklappen und wird zugeklappt. Das ist die vorsichtigere
   Richtung: der Inhalt bleibt vollständig im DOM, jedes Feld behält
   seinen Wert, jede Rechnung liest weiter dieselben Elemente. Wer
   umschaltet, verliert nichts — es ändert sich nur, was sichtbar ist.

   WAS BEWUSST NICHT PASSIERT: kein Feld wird entfernt, keins wird
   geleert, und der Investor Deal Score rechnet unverändert. Er lässt
   fehlende Angaben ohnehin aus, statt sie zu schätzen — dass er dann
   ein Teilscore ist, sagt ihm dieser Modus nicht ab.
   ═══════════════════════════════════════════════════════════════════ */
(function (global) {

  var SCHLUESSEL = 'dp_eingabemodus';        /* 'einfach' | 'detailliert' */
  var GEFRAGT    = 'dp_eingabemodus_gefragt';

  /* Karten, die IMMER stehen bleiben — auch ohne Pflichtfeld darin.
     Sie tragen das Ergebnis, nicht die Eingabe. */
  var IMMER = ['wert-puffer', 'kpis', 'dp-lage-luecken'];

  function _lies() {
    try { return localStorage.getItem(SCHLUESSEL) || null; } catch (e) { return null; }
  }
  function _schreib(wert) {
    try {
      localStorage.setItem(SCHLUESSEL, wert);
      /* Und in die Nutzereinstellungen, wo workflow.js schon nachsieht. */
      var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
      s.workflow_detail_level = wert;
      localStorage.setItem('dp_user_settings', JSON.stringify(s));
    } catch (e) {}
  }

  /* ── Welche Karten bleiben offen? ──────────────────────────────────── */
  function _pflichtIds() {
    try {
      if (global.DealPilotWorkflow && DealPilotWorkflow.pflichtfelder) {
        return DealPilotWorkflow.pflichtfelder('einfach');
      }
    } catch (e) {}
    /* Rückfall: dieselbe Liste wie workflow.js, falls es nicht geladen ist. */
    return ['ort', 'wfl', 'baujahr', 'objart', 'wirtschaftlicher_uebergang',
            'kp', 'nkm', 'ek', 'd1', 'd1z', 'd1t', 'hg_ul', 'hg_nul', 'grenz'];
  }

  function _kartenTitel(karte) {
    var t = karte.querySelector('.ct, .card-title');
    return t ? t.textContent.replace(/\s+/g, ' ').trim() : 'Weitere Angaben';
  }

  function _feldZahl(karte) {
    return karte.querySelectorAll('input:not([type=hidden]), select, textarea').length;
  }

  /* ── Zuklappen und aufklappen ──────────────────────────────────────── */
  function _zuklappen(karte, titel, felder) {
    if (karte._emZu) return;
    karte._emZu = true;

    var kopf = document.createElement('button');
    kopf.type = 'button';
    kopf.className = 'em-aufklapp';
    kopf.innerHTML = '<span class="em-pfeil">▸</span><span class="em-t">' + titel + '</span>' +
                     '<span class="em-n">' + felder + (felder === 1 ? ' Feld' : ' Felder') + '</span>';
    kopf.addEventListener('click', function () { _aufklappen(karte); });

    karte._emKopf = kopf;
    karte.parentNode.insertBefore(kopf, karte);
    karte.style.display = 'none';
  }

  function _aufklappen(karte) {
    karte.style.display = '';
    if (karte._emKopf) { karte._emKopf.remove(); karte._emKopf = null; }
    karte._emZu = false;
  }

  function _alleAuf() {
    Array.prototype.forEach.call(document.querySelectorAll('.card'), function (k) {
      if (k._emZu) _aufklappen(k);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.em-aufklapp'), function (b) { b.remove(); });
  }

  /* ── Anwenden ──────────────────────────────────────────────────────── */
  function anwenden(modus) {
    _alleAuf();
    if (modus !== 'einfach') { _knopfText(); return; }

    var pflicht = _pflichtIds();
    var karten = document.querySelectorAll('.sec .card');

    Array.prototype.forEach.call(karten, function (karte) {
      if (IMMER.indexOf(karte.id) >= 0) return;
      /* Enthält die Karte ein Pflichtfeld? Dann bleibt sie offen. */
      var hatPflicht = pflicht.some(function (id) {
        var e = document.getElementById(id);
        return e && karte.contains(e);
      });
      if (hatPflicht) return;
      /* Karten ohne jedes Eingabefeld sind Anzeigen — die bleiben. */
      var n = _feldZahl(karte);
      if (n === 0) return;
      _zuklappen(karte, _kartenTitel(karte), n);
    });
    _knopfText();
  }

  /* ── Der Umschalter im Kopf ────────────────────────────────────────── */
  function _knopfText() {
    var b = document.getElementById('em-schalter');
    if (!b) return;
    var m = _lies() || 'detailliert';
    b.textContent = (m === 'einfach') ? 'Einfach · alle Felder zeigen' : 'Alle Felder · vereinfachen';
    b.title = (m === 'einfach')
      ? 'Zurzeit siehst du nur die Felder, die für Rendite, Cashflow und Score nötig sind. Klicken zeigt alle.'
      : 'Zurzeit siehst du alle Felder. Klicken blendet die aus, die für die erste Einschätzung nicht nötig sind — Werte bleiben erhalten.';
  }

  function umschalten() {
    var neu = (_lies() === 'einfach') ? 'detailliert' : 'einfach';
    _schreib(neu);
    anwenden(neu);
    if (typeof global.toast === 'function') {
      global.toast(neu === 'einfach'
        ? '✓ Vereinfacht — nur die Felder für die erste Einschätzung. Nichts geht verloren.'
        : '✓ Alle Felder sichtbar.');
    }
  }

  function _schalterBauen() {
    if (document.getElementById('em-schalter')) return;
    var ziel = document.querySelector('nav.tabs');
    if (!ziel) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'em-schalter';
    b.className = 'em-schalter';
    b.addEventListener('click', umschalten);
    ziel.appendChild(b);
    _knopfText();
  }

  /* ── Die Frage, einmal ─────────────────────────────────────────────── */
  function fragen() {
    if (document.getElementById('em-frage')) return;
    var o = document.createElement('div');
    o.id = 'em-frage';
    o.className = 'em-overlay';
    o.innerHTML =
      '<div class="em-box">' +
        '<div class="em-h">Wie genau willst du dieses Objekt rechnen?</div>' +
        '<p class="em-s">Du kannst jederzeit umschalten. Nichts geht verloren — ' +
          'ausgeblendete Felder behalten ihre Werte.</p>' +
        '<div class="em-karten">' +
          '<button type="button" class="em-k" data-m="einfach">' +
            '<span class="em-k-t">Erste Einschätzung</span>' +
            '<span class="em-k-n">14 Felder</span>' +
            '<span class="em-k-s">Reicht für Rendite, Cashflow, DSCR und den DealPilot-Score.</span>' +
            '<span class="em-k-f">≈ 3 Minuten · alles Weitere später</span>' +
          '</button>' +
          '<button type="button" class="em-k" data-m="detailliert">' +
            '<span class="em-k-t">Vollständig</span>' +
            '<span class="em-k-n">alle Felder</span>' +
            '<span class="em-k-s">Für Wertermittlung, Steuer-Mappe und Bankunterlagen.</span>' +
            '<span class="em-k-f">so wie bisher</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(o);

    o.querySelectorAll('.em-k').forEach(function (k) {
      k.addEventListener('click', function () {
        var m = k.getAttribute('data-m');
        _schreib(m);
        try { localStorage.setItem(GEFRAGT, '1'); } catch (e) {}
        o.remove();
        anwenden(m);
      });
    });
  }

  /* ── Start ─────────────────────────────────────────────────────────── */
  function start() {
    _schalterBauen();
    var m = _lies();
    var gefragt = false;
    try { gefragt = localStorage.getItem(GEFRAGT) === '1'; } catch (e) {}
    if (m) { anwenden(m); return; }
    /* Nur fragen, wenn noch nie gefragt wurde — und erst, wenn die Maske
       wirklich steht. Ein Modal über einem halb gebauten Formular wirkt
       wie ein Fehler. */
    if (!gefragt) setTimeout(fragen, 1200);
  }

  global.DealPilotEingabemodus = {
    anwenden: anwenden,
    umschalten: umschalten,
    fragen: fragen,
    modus: _lies,
    _pflichtIds: _pflichtIds
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 600); });
  } else {
    setTimeout(start, 600);
  }

})(typeof window !== 'undefined' ? window : this);
