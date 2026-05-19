'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * DealPilot V227 — AfA-UI-Glue
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Bindet window.Afa (afa-engine.js) an die UI in Tab Steuer-Details:
 *   - onAfaSatzChange()        — bei Select-Wechsel: Vorschau befüllen, calc() triggern
 *   - onAfaSonder7bToggle()    — bei Checkbox: Details öffnen, calc() triggern
 *   - afaSwitchToDegressiv()   — Banner-Button-Handler
 *   - afaDismissNeubauHint()   — X-Button im Banner
 *   - afaCheckNeubauHint()     — Wird von calc.js bei jedem calc() aufgerufen
 *   - afaUpdatePreview()       — Tabelle für die ersten 10 Jahre
 *
 * Diese Datei macht KEINE Steuerberechnung, nur UI-Glue.
 * ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ───── Helpers ─────────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function fE(n, dec) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    dec = dec == null ? 0 : dec;
    return n.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' €';
  }
  function safeCalc() {
    if (typeof window.calc === 'function') {
      try { window.calc(); } catch (e) { console.warn('calc() failed:', e); }
    }
  }
  function getNum(id) {
    var el = $(id);
    if (!el) return 0;
    var v = (typeof parseDe === 'function') ? parseDe(el.value) : parseFloat(el.value);
    return isNaN(v) ? 0 : v;
  }

  // ───── Banner ──────────────────────────────────────────────────────────
  /**
   * Prüft Eligibility und zeigt/versteckt den Neubau-Hinweis.
   * Wird von calc.js bei jedem calc() aufgerufen.
   */
  window.afaCheckNeubauHint = function () {
    var hint = $('afa-neubau-hint');
    if (!hint) return;

    // User hat Banner explizit weggeklickt? Dann nicht mehr zeigen (Session)
    if (window._afaHintDismissed === true) {
      hint.style.display = 'none';
      return;
    }

    var zustand = ($('ds2_zustand') || {}).value || '';
    var baujahr = ($('bj') || {}).value || '';
    var afaSatz = ($('afa_satz') || {}).value || '';

    var elig = window.Afa.checkDegressivEligibility({
      ds2_zustand: zustand,
      baujahr: baujahr,
      afaSatz: afaSatz
    });

    hint.style.display = elig.eligible ? 'flex' : 'none';
  };

  /**
   * Banner-Button "Auf degressiv 5% wechseln"
   */
  window.afaSwitchToDegressiv = function () {
    var sel = $('afa_satz');
    if (!sel) return;
    // Wechsel-Variante als Default (kommt User-Optimum näher)
    sel.value = '5.0_deg_wechsel';
    // Trigger Change
    var ev = new Event('change', { bubbles: true });
    sel.dispatchEvent(ev);
    afaDismissNeubauHint();
  };

  /**
   * Banner-X-Button
   */
  window.afaDismissNeubauHint = function () {
    window._afaHintDismissed = true;
    var hint = $('afa-neubau-hint');
    if (hint) hint.style.display = 'none';
  };

  // ───── AfA-Select-Change ───────────────────────────────────────────────
  /**
   * Wird beim onchange des AfA-Select aufgerufen.
   * Triggert calc() (damit alle abhängigen Werte updaten) und
   * aktualisiert die Vorschau-Tabelle.
   */
  window.onAfaSatzChange = function () {
    afaUpdateMethodLabel();
    safeCalc();
    afaUpdatePreview();
  };

  function afaUpdateMethodLabel() {
    var sel = $('afa_satz');
    var label = $('afa_methode_label');
    if (!sel || !label) return;

    var parsed = window.Afa.parseSelectValue(sel.value);
    var methodeLabel = '';
    if (parsed.methode === 'linear') {
      methodeLabel = '· ' + parsed.satzPct.toFixed(1).replace('.', ',') + ' % linear';
    } else if (parsed.methode === 'degressiv') {
      methodeLabel = '· ' + parsed.satzPct.toFixed(1).replace('.', ',') + ' % degressiv (vom Restbuchwert)';
    } else if (parsed.methode === 'degressiv_wechsel') {
      methodeLabel = '· degressiv mit Wechsel auf linear';
    }
    label.textContent = methodeLabel;
  }

  // ───── § 7b ────────────────────────────────────────────────────────────
  /**
   * Toggle Sonder-§ 7b — Details öffnen/schließen, calc() triggern.
   */
  window.onAfaSonder7bToggle = function () {
    var aktiv = ($('afa_sonder7b_aktiv') || {}).checked || false;
    var details = $('afa_sonder7b_details');
    if (details) details.style.display = aktiv ? 'block' : 'none';
    safeCalc();
  };

  // Auch bei Bedingungs-Checkboxen → calc neu
  function bindSonder7bConditions() {
    ['afa_sonder7b_eh40', 'afa_sonder7b_baukosten', 'afa_sonder7b_vermietung', 'afa_sonder7b_neubau']
      .forEach(function (id) {
        var el = $(id);
        if (el && !el.dataset.v227Bound) {
          el.addEventListener('change', safeCalc);
          el.dataset.v227Bound = '1';
        }
      });
  }

  /**
   * Prüft ob § 7b gültig anwendbar ist — alle 4 Bedingungen müssen TRUE sein.
   */
  window.afaSonder7bIsValid = function () {
    if (!($('afa_sonder7b_aktiv') || {}).checked) return false;
    var c1 = ($('afa_sonder7b_eh40') || {}).checked;
    var c2 = ($('afa_sonder7b_baukosten') || {}).checked;
    var c3 = ($('afa_sonder7b_vermietung') || {}).checked;
    var c4 = ($('afa_sonder7b_neubau') || {}).checked;
    return !!(c1 && c2 && c3 && c4);
  };

  /**
   * Aktualisiert die § 7b-Anzeigen (Basis, Jahres-Betrag, Warnung).
   * Wird von calc.js am Ende aufgerufen, NACHDEM die Engine gelaufen ist.
   * @param {object} info - { basis, jaehrlich, gueltig }
   */
  window.afaSonder7bUpdateDisplay = function (info) {
    info = info || {};
    var b = $('afa_sonder7b_basis');
    var j = $('afa_sonder7b_jaehrlich');
    var w = $('afa_sonder7b_warning');
    if (b) b.textContent = info.basis != null ? fE(info.basis, 0) : '—';
    if (j) j.textContent = info.jaehrlich != null ? fE(info.jaehrlich, 0) : '—';
    if (w) {
      var aktiv = ($('afa_sonder7b_aktiv') || {}).checked || false;
      w.style.display = (aktiv && !info.gueltig) ? 'block' : 'none';
    }
  };

  // ───── Vorschau-Tabelle ────────────────────────────────────────────────
  /**
   * Befüllt die Vorschau-Tabelle (erste 10 Jahre) im Details-Block.
   * Verwendet State._afaSeries wenn vorhanden, sonst on-the-fly.
   */
  window.afaUpdatePreview = function () {
    var wrap = $('afa_deg_preview_wrap');
    var body = $('afa_deg_preview_body');
    if (!wrap || !body) return;

    var sel = $('afa_satz');
    if (!sel) return;
    var parsed = window.Afa.parseSelectValue(sel.value);

    // Vorschau nur bei degressiv sinnvoll
    if (parsed.methode === 'linear') {
      wrap.style.display = 'none';
      return;
    }
    wrap.style.display = 'block';

    // Daten aus State holen (gesetzt von calc.js)
    var st = window.State || {};
    var series = st._afaSeriesNormal || [];
    var sonder = st._afaSeriesSonder || new Array(series.length).fill(0);

    if (!series.length) {
      body.innerHTML = '<div class="hint">Werte erst nach Eingabe verfügbar.</div>';
      return;
    }

    var sumNormal = 0, sumSonder = 0;
    var rows = '';
    var wechsel = st._afaWechselJahr;
    for (var i = 0; i < Math.min(10, series.length); i++) {
      var year = i + 1;
      var n = series[i];
      var s = sonder[i] || 0;
      var t = n + s;
      sumNormal += n;
      sumSonder += s;
      var cls = '';
      if (wechsel && year === wechsel) cls = ' class="afa-wechsel"';
      rows += '<tr' + cls + '><td class="tal">Jahr ' + year + (wechsel === year ? ' (Wechsel)' : '') + '</td>' +
        '<td>' + fE(n, 0) + '</td>' +
        '<td>' + (s > 0 ? fE(s, 0) : '—') + '</td>' +
        '<td>' + fE(t, 0) + '</td></tr>';
    }
    var total = sumNormal + sumSonder;
    rows += '<tr class="afa-total"><td class="tal">Summe 10 J.</td>' +
      '<td>' + fE(sumNormal, 0) + '</td>' +
      '<td>' + fE(sumSonder, 0) + '</td>' +
      '<td>' + fE(total, 0) + '</td></tr>';

    body.innerHTML =
      '<table>' +
      '<thead><tr><th class="tal">Jahr</th><th>Normal-AfA</th><th>§ 7b</th><th>Gesamt</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table>' +
      (wechsel
        ? '<div class="hint" style="margin-top:6px">↳ Ab Jahr ' + wechsel + ' wechselt die AfA automatisch auf linear, weil das ab da günstiger ist.</div>'
        : '') +
      (parsed.methode === 'degressiv'
        ? '<div class="hint" style="margin-top:6px">Hinweis: Bei "ohne Wechsel" sinkt die AfA jedes Jahr. Tipp: "mit Wechsel" wählen um automatisch zu linear zu switchen wenn günstiger.</div>'
        : '');
  };

  // ───── Auto-Wire bei DOM-Ready ────────────────────────────────────────
  function init() {
    bindSonder7bConditions();
    afaUpdateMethodLabel();
    // Initial-Check für Banner (nach kurzem Delay damit calc.js fertig ist)
    setTimeout(function () {
      if (typeof window.afaCheckNeubauHint === 'function') {
        window.afaCheckNeubauHint();
      }
      afaUpdatePreview();
    }, 500);

    // Auch bei Änderung des Zustands oder Baujahrs → Banner neu prüfen
    ['ds2_zustand', 'bj'].forEach(function (id) {
      var el = $(id);
      if (el && !el.dataset.v227Bound) {
        el.addEventListener('change', function () {
          window.afaCheckNeubauHint();
        });
        el.dataset.v227Bound = '1';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
