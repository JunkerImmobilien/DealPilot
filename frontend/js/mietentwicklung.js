'use strict';
/* ═══════════════════════════════════════════════════
   DEALPILOT V22 – mietentwicklung.js
   Mietentwicklung: Prognose-Modus (linear %) ODER
   Detail-Modus (diskrete Erhöhungs-Treppe).

   Public API:
     window.MietEntwicklung.getMode()    → 'prog' | 'detail'
     window.MietEntwicklung.factor(y)    → Multiplikator für Jahr y (y=0..N)
     window.MietEntwicklung.snapshot()   → {mode, schedule:[{year,factor,nkm}], opp_pct}
     window.setMietModus(mode)           → UI-Toggle (HTML onclick)
═══════════════════════════════════════════════════ */

window.MietEntwicklung = (function() {

  // Modus + zE-Toggle werden PRO OBJEKT gespeichert.
  // Sie liegen als versteckte Form-Felder im DOM (#me_modus, #me_inc_ze) damit
  // sie automatisch über loadData()/saveObj() mit dem Objekt persistiert werden.
  // localStorage wird nur als kurzfristiger Fallback genutzt, falls die Felder
  // (z.B. beim Initial-Render) noch nicht da sind.

  function _g(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '').toString() : '';
  }
  function _v(id, fallback) {
    var s = _g(id).replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : (fallback != null ? fallback : 0);
  }

  /* ══ v2024 · DER DRITTE MODUS: AUS DEN WOHNUNGEN ════════════════

     Die beiden bisherigen Modi rechnen auf der GESAMT-Miete. Bei
     einem MFH mit fuenf Vertraegen, von denen zwei eine Staffel
     tragen, ist jeder von beiden eine Schaetzung ueber etwas, das
     in Wirklichkeit feststeht.

     Hier wird die Miete jedes Jahres aus den EINZELNEN Wohnungen
     summiert. Eine Wohnung ohne hinterlegte Staffel bekommt KEINE
     erfundene Steigerung - lieber eine Entwicklung, die zu flach
     ist und das sagt, als eine, die stimmt, weil sie geraten hat. */

  function _einheiten() {
    var m = window._dpMfh;
    return (m && Array.isArray(m.einheiten)) ? m.einheiten : [];
  }
  /** Gibt es ueberhaupt Wohnungen mit Haken? */
  function einheitenNutzbar() {
    return _einheiten().some(function (e) {
      return e && e.mv_in_mietentwicklung && _zahl(e.ist) > 0;
    });
  }
  function _zahl(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  /** Jahre bis zur ersten Erhoehung, aus dem hinterlegten Datum. */
  function _jahreBis(datum) {
    if (!datum) return null;
    var d = new Date(datum);
    if (isNaN(d)) return null;
    var j = (d.getTime() - Date.now()) / (365.25 * 86400000);
    return j < 0 ? 0 : j;
  }
  /** Monatsmiete EINER Einheit im Jahr y. */
  function _mieteEinheit(e, y) {
    var basis = _zahl(e.ist);
    if (!basis) return 0;
    if (!e.mv_in_mietentwicklung) return basis;   /* ohne Haken: unveraendert */
    var wert = _zahl(e.mv_erhoehung_wert);
    if (!wert) return basis;
    var ersteIn = _jahreBis(e.mv_naechste_anpassung);
    if (ersteIn == null) return basis;            /* ohne Termin keine Treppe */
    var rhythmus = Math.max(1, Math.round(_zahl(e.mv_rhythmus_jahre)) || 1);
    var offen = Math.round(_zahl(e.mv_stufen_offen));
    if (offen <= 0) offen = 1;                    /* mindestens die naechste */
    /* Wie viele Stufen sind bis Jahr y gelaufen? */
    var stufen = 0;
    if (y >= ersteIn) stufen = 1 + Math.floor((y - ersteIn) / rhythmus);
    if (stufen > offen) stufen = offen;
    if (stufen <= 0) return basis;
    if (e.mv_erhoehung_art === 'betrag') return basis + wert * stufen;
    return basis * Math.pow(1 + wert / 100, stufen);   /* Prozent, zinseszinslich */
  }
  /** Summe aller Einheiten im Jahr y. */
  function _summeEinheiten(y) {
    return _einheiten().reduce(function (s, e) { return s + _mieteEinheit(e, y); }, 0);
  }

  function getMode() {
    /* v2024 - drei Modi. `einheiten` faellt auf `prog` zurueck, wenn
       keine Wohnung mit Haken da ist: ein Modus, der nichts zu rechnen
       hat, darf nicht einfach 1,0 liefern und so aussehen, als gaebe es
       keine Steigerung. */
    var el = document.getElementById('me_modus');
    var w = el && el.value ? el.value : localStorage.getItem('dp_miet_modus');
    if (w === 'einheiten') return einheitenNutzbar() ? 'einheiten' : 'prog';
    return w === 'detail' ? 'detail' : 'prog';
  }

  function setMode(m) {
    if (m !== 'detail' && m !== 'prog' && m !== 'einheiten') m = 'prog';   /* v2024 */
    var el = document.getElementById('me_modus');
    if (el) el.value = m;
    localStorage.setItem('dp_miet_modus', m);
    _renderUI();
    if (typeof calc === 'function') calc();
  }

  /**
   * Toggle: Wirkt die Mieterhöhung auch auf zusätzliche Einnahmen (Stellplatz, Garage)?
   * Default: false (nur NKM wächst).
   */
  function appliesToZE() {
    var el = document.getElementById('me_inc_ze');
    if (el) return !!el.checked;
    return false;
  }

  function setAppliesToZE(b) {
    var el = document.getElementById('me_inc_ze');
    if (el) el.checked = !!b;
    if (typeof calc === 'function') calc();
  }

  /**
   * Liefert den Mietfaktor für Jahr y (y=0..N).
   * y=0 → 1.0 (Heutige Miete = Basis)
   * y=1 → Nach Jahr 1 wirksamer Faktor
   * Im Detail-Modus: Treppen-Faktor, nach jeder Erhöhung springt der Wert.
   * Im Prognose-Modus: (1+mstg)^y.
   */
  /* v1457 · Sprung auf die Soll-Miete (MFH-Konfigurator, Backlog v22 Punkt 6).
     Sind Einheiten mit Soll-Miete erfasst UND ein Jahr gesetzt, wirkt ab
     diesem Jahr zusaetzlich der Faktor Soll ÷ Ist. Die normale Steigerung
     laeuft davor und danach unveraendert weiter — der Sprung ist ein
     EINMALIGER Aufschlag, keine zweite Steigerungsreihe.
     Der Faktor wird hier gebildet, damit calc.js, Cashflow und Exit alle
     dieselbe Kurve sehen (calc liest ausschliesslich MietEntwicklung.factor). */
  function sollSprung() {
    var d = window._dpMfh;
    if (!d || !Array.isArray(d.einheiten) || !d.einheiten.length) return null;
    var jahr = Math.round(Number(d.sollAbJahr) || 0);
    if (!(jahr > 0)) return null;
    function z(v) { if (v == null || String(v).trim() === '') return 0; var n = (typeof window.parseDe === 'function') ? window.parseDe(String(v)) : parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
    var ist = 0, soll = 0;
    d.einheiten.forEach(function (e) {
      if (e.status !== 'leer') ist += z(e.ist);
      soll += z(e.soll) || z(e.ist);
    });
    if (!(ist > 0) || !(soll > ist)) return null;
    return { jahr: jahr, faktor: soll / ist, ist: ist, soll: soll };
  }

  function factor(y) {
    if (y <= 0) return 1.0;
    var _s = sollSprung();
    var _auf = (_s && y >= _s.jahr) ? _s.faktor : 1.0;
    if (_auf !== 1.0) return _basisFaktor(y) * _auf;
    return _basisFaktor(y);
  }
  function _basisFaktor(y) {
    if (y <= 0) return 1.0;
    var mode = getMode();
    /* v2024 - aus den Wohnungen. Der Faktor ist Summe(y)/Summe(0),
       damit er in dieselbe Schnittstelle passt wie die anderen beiden
       Modi - alles, was factor(y) benutzt, rechnet ohne Aenderung
       weiter. */
    if (mode === 'einheiten') {
      var jetzt = _summeEinheiten(0);
      if (jetzt <= 0) return 1.0;
      return _summeEinheiten(y) / jetzt;
    }
    if (mode === 'prog') {
      var mstg = _v('mietstg') / 100;
      return Math.pow(1 + mstg, y);
    }
    // Detail-Modus
    var anz = Math.max(0, Math.round(_v('me_anz', 0)));
    var intv = Math.max(1, Math.round(_v('me_int', 1)));
    var pct = _v('me_pct', 0) / 100;
    if (anz === 0 || pct === 0) return 1.0;
    // Step-Faktor pro Erhöhung — geometrisch verteilt, damit Gesamtsumme exakt pct ergibt
    var step = Math.pow(1 + pct, 1 / anz);
    // Wie viele Erhöhungen sind in Jahr y bereits passiert?
    // Erhöhungen geschehen in Jahr intv, 2*intv, 3*intv, ..., anz*intv
    var hikes = Math.min(anz, Math.floor(y / intv));
    return Math.pow(step, hikes);
  }

  /**
   * Liefert eine Tabelle (für UI) und Meta-Infos zur Mietentwicklung.
   */
  /* v2024 - fuer die Oberflaeche: wie viele Wohnungen zaehlen mit? */
  function einheitenStand() {
    var alle = _einheiten().filter(function (e) { return _zahl(e.ist) > 0; });
    var mit = alle.filter(function (e) { return e.mv_in_mietentwicklung; });
    var index = mit.filter(function (e) { return e.mv_art === 'index'; });
    return { gesamt: alle.length, mit: mit.length, index: index.length,
             miete_heute: _summeEinheiten(0) };
  }

  function snapshot() {
    var mode = getMode();
    var includesZE = appliesToZE();
    var nkm_m = _v('nkm', 0);
    var ze_m = _v('ze', 0);
    var wfl = _v('wfl', 0);
    var soll = _v('me_soll', 0);
    // Aktuelle Miete pro qm/Monat (inkl. zE)
    var ist_qm = wfl > 0 ? (nkm_m + ze_m) / wfl : 0;
    var opp_pct = (soll > 0 && ist_qm > 0) ? (ist_qm / soll - 1) : 0;

    var rows = [];
    var btj = Math.max(1, Math.round(_v('btj', 15)));
    var anz = Math.max(0, Math.round(_v('me_anz', 0)));
    var intv = Math.max(1, Math.round(_v('me_int', 1)));

    for (var y = 1; y <= btj; y++) {
      var f = factor(y);
      // V24: Toggle-respektierende Berechnung
      // - NKM wächst immer mit Faktor
      // - zE wächst NUR wenn Toggle aktiv, sonst bleibt zE konstant
      var nkm_grown = nkm_m * 12 * f;
      var ze_grown = ze_m * 12 * (includesZE ? f : 1.0);
      var nkm_y = nkm_grown + ze_grown;
      var qm = wfl > 0 ? (nkm_y / 12) / wfl : 0;
      var isHike = (mode === 'detail') &&
                   (y % intv === 0) &&
                   (y / intv <= anz);
      rows.push({ year: y, factor: f, nkm: nkm_y, qm: qm, isHike: isHike });
    }

    return { mode: mode, schedule: rows, opp_pct: opp_pct, ist_qm: ist_qm, soll: soll, includesZE: includesZE };
  }

  // ─────────────────────────────────────────────
  // UI-Rendering
  // ─────────────────────────────────────────────
  function _renderUI() {
    var mode = getMode();
    var btnP = document.getElementById('me-mode-prog');
    var btnD = document.getElementById('me-mode-detail');
    var blkP = document.getElementById('me-block-prog');
    var blkD = document.getElementById('me-block-detail');
    if (btnP && btnD) {
      btnP.classList.toggle('active', mode === 'prog');
      btnD.classList.toggle('active', mode === 'detail');
    }
    if (blkP && blkD) {
      blkP.style.display = mode === 'prog' ? '' : 'none';
      blkD.style.display = mode === 'detail' ? '' : 'none';
    }
    if (mode === 'detail') {
      _renderTable();
      _renderOpp();
    }
  }

  function _renderTable() {
    var wrap = document.getElementById('me_table_wrap');
    if (!wrap) return;
    var snap = snapshot();
    var fmtE = function(n) {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency', currency: 'EUR', maximumFractionDigits: 0
      }).format(n || 0);
    };
    var fmtQm = function(n) {
      return (n || 0).toFixed(2).replace('.', ',') + ' €/m²';
    };
    var html = '<table><thead><tr>' +
               '<th>Jahr</th><th>Kaltmiete p.a.</th><th>€/m² (Monat)</th><th>Faktor</th>' +
               '</tr></thead><tbody>';
    snap.schedule.forEach(function(r) {
      html += '<tr' + (r.isHike ? ' class="me-row-hike"' : '') + '>' +
              '<td>Jahr ' + r.year + (r.isHike ? ' ⬆' : '') + '</td>' +
              '<td>' + fmtE(r.nkm) + '</td>' +
              '<td>' + fmtQm(r.qm) + '</td>' +
              '<td>' + r.factor.toFixed(3).replace('.', ',') + '</td>' +
              '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  /* ── v1240 · Die Soll-Miete sagt den Prozentsatz schon ────────────────────
     Testbericht Block E, woertlich: „Versteh ich nicht ganz, ich sage hier
     ich will 3x die Miete erhoehen ueber drei Jahre, um auf 10 € zu kommen.
     Dann muss ich noch die ‚angestrebte Entwicklung' eingeben? Ich hab doch
     schon ein Ziel von 10€/m²."

     Er hat recht. Gemessen am 07.09.2026: `me_soll` (Soll-Mietspiegel) geht
     in die RECHNUNG gar nicht ein — er dient nur der Potenzial-Anzeige
     (`opp_pct`). Gerechnet wird im Detail-Modus mit `me_anz`, `me_int` und
     `me_pct`. Der Prozentsatz ist aus der Soll-Miete aber exakt ableitbar:

         me_pct = Soll je m2 / Ist je m2 - 1

     Dieselbe Regel wie bei v1231: **fuellen nur wenn leer, sonst anbieten.**
     Einen von Hand getippten Wert zu ueberschreiben waere schlimmer als die
     doppelte Frage.

     Liegt die Soll-Miete UNTER der heutigen, wird kein negativer Prozentsatz
     vorgeschlagen — dann steht da, dass das Ziel bereits erreicht ist. Ein
     Vorschlag, der die Miete senkt, waere Unsinn. */
  function _sollProzent() {
    var snap = snapshot();
    if (!(snap.soll > 0) || !(snap.ist_qm > 0)) return null;
    return (snap.soll / snap.ist_qm - 1) * 100;
  }

  function _renderSollHinweis() {
    var pctEl = document.getElementById('me_pct');
    if (!pctEl) return;
    var host = document.getElementById('me-soll-hint');
    if (!host) {
      var box = pctEl.closest('.f') || pctEl.parentElement;
      if (!box) return;
      host = document.createElement('div');
      host.id = 'me-soll-hint';
      host.style.cssText = 'margin-top:4px;font-size:11.5px;line-height:1.45;color:#7A7370';
      box.appendChild(host);
    }
    var p = _sollProzent();
    if (p == null) { host.innerHTML = ''; return; }

    var snap = snapshot();
    var qm = function (v) { return v.toFixed(2).replace('.', ',') + ' €/m²'; };
    if (p <= 0.05) {
      host.innerHTML = 'Die heutige Miete (' + qm(snap.ist_qm) + ') liegt bereits bei oder über '
        + 'deiner Soll-Miete von ' + qm(snap.soll) + ' — <b>keine Erhöhung nötig</b>.';
      return;
    }
    var pTxt = p.toFixed(1).replace('.', ',') + ' %';
    var leer = String(pctEl.value || '').trim() === '';
    if (leer) {
      pctEl.value = p.toFixed(1).replace('.', ',');
      try { pctEl.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      host.innerHTML = 'Aus deiner Soll-Miete von ' + qm(snap.soll) + ' berechnet: <b>' + pTxt + '</b>.';
      return;
    }
    host.innerHTML = 'Aus deiner Soll-Miete von ' + qm(snap.soll) + ' ergäben sich <b>' + pTxt + '</b>. '
      + '<button type="button" id="me-soll-uebernehmen" style="background:none;border:0;padding:0;'
      + 'font:inherit;color:var(--wl-b8932f,#b8932f);text-decoration:underline;cursor:pointer">übernehmen</button>';
    var btn = document.getElementById('me-soll-uebernehmen');
    if (btn) btn.addEventListener('click', function () {
      pctEl.value = p.toFixed(1).replace('.', ',');
      try { pctEl.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
      try { if (typeof window.calc === 'function') window.calc(); } catch (e) {}
      _renderSollHinweis();
    });
  }

  function _renderOpp() {
    var el = document.getElementById('me_opp');
    if (!el) return;
    var snap = snapshot();
    if (snap.soll <= 0 || snap.ist_qm <= 0) {
      el.textContent = '—';
      el.className = 'cf';
      return;
    }
    var p = snap.opp_pct * 100;
    el.textContent = (p >= 0 ? '+' : '') + p.toFixed(1).replace('.', ',') + ' %';
    el.className = 'cf ' + (p < -5 ? 'pos' : (p > 5 ? 'neg' : ''));
  }

  // Re-render Tabelle bei jeder calc()-Aktualisierung
  function refresh() { _renderUI(); try { _renderSollHinweis(); } catch (e) {} }

  // Initial-Setup nach DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(_renderUI, 0);
  });

  return {
    getMode: getMode,
    setMode: setMode,
    appliesToZE: appliesToZE,
    sollSprung: sollSprung,
    setAppliesToZE: setAppliesToZE,
    factor: factor,
    snapshot: snapshot,
    refresh: refresh,
    /* v2024 - fuer die Oberflaeche: wie viele Wohnungen zaehlen mit?
       Ohne diese Zeile waere der dritte Modus gebaut und unerreichbar. */
    einheitenStand: einheitenStand,
    einheitenNutzbar: einheitenNutzbar
  };
})();

// HTML-onclick-Handler
window.setMietModus = function(mode) {
  window.MietEntwicklung.setMode(mode);
};
window.setMietInclZE = function(checked) {
  window.MietEntwicklung.setAppliesToZE(checked);
};
