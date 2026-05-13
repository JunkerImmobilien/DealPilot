/* ═══════════════════════════════════════════════════════════════
   DealPilot — d1-Type-Handler (V148)
   ═══════════════════════════════════════════════════════════════
   Implementiert die V63.57-Funktionen die im HTML referenziert sind
   aber im Code fehlten:

     - onD1TypeChange()        → schaltet Bauspar-Card ein/aus + Tilgung-Feld
     - calcD1Volltilgung()     → berechnet Volltilgungsdatum aus Auszahldatum
     - openTilgungsplanModal() → Tilgungsplan als Modal-Ansicht
     - triggerPdfImportTo(t)   → PDF-Import-Trigger (Stub)
     - _recalcBspar()          → Bauspar-Zuteilungs-Berechnung
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function _q(id) { return document.getElementById(id); }
  function _v(id) {
    var el = _q(id); if (!el) return 0;
    return parseFloat(String(el.value || '0').replace(',', '.')) || 0;
  }
  function _s(id) { var el = _q(id); return el ? el.value : ''; }
  function _fE(v, dec) {
    if (typeof v !== 'number' || !isFinite(v)) return '–';
    dec = dec || 0;
    return v.toLocaleString('de-DE', {
      minimumFractionDigits: dec, maximumFractionDigits: dec
    }) + ' €';
  }

  // ─── onD1TypeChange() ─────────────────────────────────────────
  // Bei Tilgungsaussetzung: Bauspar-Card sichtbar, Tilgung-Feld grau,
  //   Tilgung auf 0 setzen, Hint einblenden.
  // Bei Annuität: Bauspar-Card verstecken, Tilgung normal.
  function onD1TypeChange() {
    var type = _s('d1_type') || 'annuitaet';
    var bsparCard = _q('bspar_card');
    var d1tField = _q('d1t');
    var d1tHint = _q('d1t_hint');
    var d1tFieldWrap = _q('d1t_field');

    if (type === 'tilgungsaussetzung') {
      if (bsparCard) bsparCard.style.display = '';
      if (d1tField) {
        d1tField.value = '0';
        d1tField.setAttribute('disabled', 'disabled');
        d1tField.style.opacity = '0.5';
        d1tField.style.cursor = 'not-allowed';
      }
      if (d1tHint) d1tHint.style.display = '';
      if (d1tFieldWrap) d1tFieldWrap.title = 'Tilgung 0% während Sparphase — Ablösung durch Bausparvertrag';
    } else {
      if (bsparCard) bsparCard.style.display = 'none';
      if (d1tField) {
        d1tField.removeAttribute('disabled');
        d1tField.style.opacity = '';
        d1tField.style.cursor = '';
      }
      if (d1tHint) d1tHint.style.display = 'none';
      if (d1tFieldWrap) d1tFieldWrap.title = '';
    }

    // Trigger calc() für Live-Update
    if (typeof calc === 'function') calc();
    _recalcBspar();
    calcD1Volltilgung();
  }

  // ─── calcD1Volltilgung() ──────────────────────────────────────
  // Berechnet das voraussichtliche Volltilgungsjahr aus Auszahldatum +
  // d1z + d1t. Bei Tilgungsaussetzung wird "Tilgungsaussetzung" angezeigt.
  function calcD1Volltilgung() {
    var bindEl = _q('bindend');
    var vtEl = _q('volltilg');
    if (!bindEl && !vtEl) return;

    var d1 = _v('d1');
    var d1z = _v('d1z') / 100;
    var d1t = _v('d1t') / 100;
    var bindj = _v('d1_bindj') || 10;
    var type = _s('d1_type') || 'annuitaet';
    var auszahl = _s('d1_auszahl');

    // Auszahldatum parsen (Format: "MM.YYYY" oder "MM/YYYY")
    var startDate = new Date();
    if (auszahl) {
      var m = String(auszahl).match(/(\d{1,2})[\.\/](\d{4})/);
      if (m) startDate = new Date(parseInt(m[2]), parseInt(m[1]) - 1, 1);
    }

    // Zinsbindung Ende
    var bindEnd = new Date(startDate);
    bindEnd.setFullYear(bindEnd.getFullYear() + bindj);
    if (bindEl) {
      bindEl.textContent = bindEnd.toLocaleDateString('de-DE', {
        month: '2-digit', year: 'numeric'
      });
    }

    // Volltilgung
    if (!vtEl) return;
    if (type === 'tilgungsaussetzung' || d1t <= 0 || d1z <= 0 || d1 <= 0) {
      vtEl.textContent = type === 'tilgungsaussetzung'
        ? 'Tilgungsaussetzung — Bauspar löst ab'
        : '—';
      return;
    }

    // Annuität-Formel: n = ln(R/(R-K*i)) / ln(1+i)
    // wobei R = jährl. Annuität, K = Darlehen, i = Zins p.a.
    var R_jahr = d1 * (d1z + d1t);
    var n_jahre;
    if (R_jahr > d1 * d1z) {
      n_jahre = Math.log(R_jahr / (R_jahr - d1 * d1z)) / Math.log(1 + d1z);
    } else {
      n_jahre = 99;
    }
    var vtDate = new Date(startDate);
    vtDate.setFullYear(vtDate.getFullYear() + Math.ceil(n_jahre));
    vtEl.textContent = vtDate.getFullYear().toString();
  }

  // ─── _recalcBspar() ──────────────────────────────────────────
  // Berechnet voraussichtliches Zuteilungsdatum + Bauspardarlehens-Rate.
  function _recalcBspar() {
    var bsparCard = _q('bspar_card');
    if (!bsparCard || bsparCard.style.display === 'none') return;

    var bsum = _v('bspar_sum');
    var brate = _v('bspar_rate');           // Sparrate €/Monat
    var bquote = _v('bspar_quote_min') || 40;  // Mindest-Quote %
    var bzins = _v('bspar_zins') / 100;     // Sparzins (sehr klein typisch)
    var bdarz = _v('bspar_dar_z') / 100;    // Bauspardarlehen-Zins
    var bdart = _v('bspar_dar_t') / 100;    // Bauspardarlehen-Tilgung
    var auszahl = _s('d1_auszahl');

    var statusBox = _q('bspar_zuteilung_box');
    var statusEl = _q('bspar_zuteil_status');
    var detailEl = _q('bspar_zuteil_detail');
    var autoEl = _q('bspar_zuteil_auto');
    var rateEl = _q('bspar_dar_rate');

    if (bsum <= 0 || brate <= 0) {
      if (statusBox) statusBox.style.display = 'none';
      if (autoEl) autoEl.textContent = '—';
      if (rateEl) rateEl.textContent = '—';
      return;
    }

    // Ziel-Ansparen = Bausparsumme × Mindestquote%
    var zielAnsparen = bsum * bquote / 100;

    // Ansparphase: Sparrate + Zinsen
    // Vereinfacht ohne Zinsesszins (Zins typisch < 0.5%, kaum Einfluss):
    var monate = zielAnsparen > 0 ? Math.ceil(zielAnsparen / brate) : 999;
    var jahre = monate / 12;

    // Mit Zinseszins (genauer):
    if (bzins > 0.0001) {
      // FV = R × ((1+i)^n - 1) / i, R=Rate/M, i=Sparzins/12, n=Monate
      var i_m = bzins / 12;
      // n = ln(FV*i/R + 1) / ln(1+i)
      monate = Math.ceil(Math.log(zielAnsparen * i_m / brate + 1) / Math.log(1 + i_m));
      jahre = monate / 12;
    }

    // Zuteilungsdatum
    var startDate = new Date();
    if (auszahl) {
      var m = String(auszahl).match(/(\d{1,2})[\.\/](\d{4})/);
      if (m) startDate = new Date(parseInt(m[2]), parseInt(m[1]) - 1, 1);
    }
    var zuteilDate = new Date(startDate);
    zuteilDate.setMonth(zuteilDate.getMonth() + monate);

    // Status-Box
    var nochZuSparen = zielAnsparen;
    var bauspar_darlehen = bsum - zielAnsparen;  // restliche Differenz
    if (statusBox) statusBox.style.display = '';
    if (statusEl) {
      statusEl.textContent = '✓ Zuteilung voraussichtlich nach ' +
        jahre.toFixed(1).replace('.', ',') + ' Jahren';
    }
    if (detailEl) {
      detailEl.innerHTML =
        'Ziel-Ansparung: <b>' + _fE(zielAnsparen) + '</b> ' +
        '(' + bquote.toFixed(0) + '% von ' + _fE(bsum) + ')<br>' +
        'Sparrate: ' + _fE(brate) + '/Monat · ' +
        'Bauspardarlehen (Differenz): <b>' + _fE(bauspar_darlehen) + '</b>';
    }
    if (autoEl) {
      autoEl.textContent = zuteilDate.toLocaleDateString('de-DE', {
        month: '2-digit', year: 'numeric'
      });
    }

    // Rate Bauspardarlehen (Annuität auf bauspar_darlehen)
    if (rateEl && bauspar_darlehen > 0 && (bdarz + bdart) > 0) {
      var rate_m = bauspar_darlehen * (bdarz + bdart) / 12;
      rateEl.textContent = _fE(rate_m, 2) + '/M';
    } else if (rateEl) {
      rateEl.textContent = '—';
    }
  }

  // ─── openTilgungsplanModal() ──────────────────────────────────
  // Zeigt Tilgungsplan in einem Modal.
  function openTilgungsplanModal() {
    var d1 = _v('d1');
    var d1z = _v('d1z') / 100;
    var d1t = _v('d1t') / 100;
    var bindj = _v('d1_bindj') || 10;
    var type = _s('d1_type') || 'annuitaet';
    var auszahl = _s('d1_auszahl');

    if (d1 <= 0) {
      alert('Bitte erst Darlehenssumme eingeben.');
      return;
    }

    var startDate = new Date();
    if (auszahl) {
      var m = String(auszahl).match(/(\d{1,2})[\.\/](\d{4})/);
      if (m) startDate = new Date(parseInt(m[2]), parseInt(m[1]) - 1, 1);
    }
    var startYear = startDate.getFullYear();

    // Tilgungsplan-Tabelle generieren (Jahr für Jahr)
    var rs = d1;
    var rows = [];
    var maxJ = type === 'tilgungsaussetzung' ? bindj : 50;

    for (var y = 0; y < maxJ && rs > 1; y++) {
      var zins_y = rs * d1z;
      var tilg_y = (type === 'tilgungsaussetzung') ? 0 : d1 * d1t;
      // bei Annuität: Tilgung wächst mit Zeit
      if (type !== 'tilgungsaussetzung') {
        var annuitaet = d1 * (d1z + d1t);
        tilg_y = annuitaet - zins_y;
      }
      var rs_neu = Math.max(0, rs - tilg_y);
      rows.push({
        year: startYear + y,
        rest_start: rs,
        zins: zins_y,
        tilg: tilg_y,
        rate_m: (zins_y + tilg_y) / 12,
        rest_end: rs_neu
      });
      rs = rs_neu;
      if (rs <= 1) break;
    }

    // Modal bauen
    var existing = _q('tilgungsplan-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'tilgungsplan-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(42,39,39,0.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';

    var rowsHtml = '';
    rows.forEach(function (r) {
      rowsHtml +=
        '<tr>' +
        '<td style="padding:6px 10px;font-weight:600">' + r.year + '</td>' +
        '<td style="padding:6px 10px;text-align:right">' + _fE(r.rest_start, 0) + '</td>' +
        '<td style="padding:6px 10px;text-align:right;color:#B8625C">' + _fE(r.zins, 0) + '</td>' +
        '<td style="padding:6px 10px;text-align:right;color:#3FA56C">' + _fE(r.tilg, 0) + '</td>' +
        '<td style="padding:6px 10px;text-align:right">' + _fE(r.rate_m, 2) + '</td>' +
        '<td style="padding:6px 10px;text-align:right;font-weight:600">' + _fE(r.rest_end, 0) + '</td>' +
        '</tr>';
    });

    var summeZins = rows.reduce(function (s, r) { return s + r.zins; }, 0);
    var summeTilg = rows.reduce(function (s, r) { return s + r.tilg; }, 0);

    modal.innerHTML =
      '<div style="background:#fff;border-radius:8px;max-width:900px;width:100%;max-height:88vh;overflow:hidden;box-shadow:0 12px 50px rgba(0,0,0,0.3);display:flex;flex-direction:column">' +
      '  <div style="display:flex;justify-content:space-between;align-items:center;padding:20px 28px;border-bottom:1px solid #E5DEB8;background:#FAF6E8">' +
      '    <div>' +
      '      <h2 style="margin:0;font-family:\'Cormorant Garamond\',serif;font-size:24px;font-weight:600;color:#2A2727">Tilgungsplan — Darlehen I</h2>' +
      '      <div style="margin-top:4px;font-size:13px;color:#7A7370">' +
              _fE(d1) + ' · ' + (d1z * 100).toFixed(2).replace('.', ',') + ' % Zins · ' +
              (d1t * 100).toFixed(2).replace('.', ',') + ' % Tilgung · ' +
              (type === 'tilgungsaussetzung' ? 'Tilgungsaussetzung' : 'Annuität') +
      '      </div>' +
      '    </div>' +
      '    <button onclick="document.getElementById(\'tilgungsplan-modal\').remove()" style="background:transparent;border:none;font-size:28px;cursor:pointer;color:#7A7370;padding:0 8px">×</button>' +
      '  </div>' +
      '  <div style="flex:1;overflow-y:auto;padding:20px 28px">' +
      '    <table style="width:100%;border-collapse:collapse;font-size:13px">' +
      '      <thead><tr style="border-bottom:2px solid #C9A84C;background:#FAF6E8;text-align:right">' +
      '        <th style="padding:10px;text-align:left">Jahr</th>' +
      '        <th style="padding:10px">Restschuld Anfang</th>' +
      '        <th style="padding:10px">Zinsen/J</th>' +
      '        <th style="padding:10px">Tilgung/J</th>' +
      '        <th style="padding:10px">Rate/M</th>' +
      '        <th style="padding:10px">Restschuld Ende</th>' +
      '      </tr></thead>' +
      '      <tbody>' + rowsHtml + '</tbody>' +
      '      <tfoot><tr style="border-top:2px solid #C9A84C;background:#FAF6E8;font-weight:700">' +
      '        <td style="padding:10px">Summe ' + rows.length + ' J.</td>' +
      '        <td></td>' +
      '        <td style="padding:10px;text-align:right;color:#B8625C">' + _fE(summeZins, 0) + '</td>' +
      '        <td style="padding:10px;text-align:right;color:#3FA56C">' + _fE(summeTilg, 0) + '</td>' +
      '        <td></td>' +
      '        <td></td>' +
      '      </tr></tfoot>' +
      '    </table>' +
      '  </div>' +
      '  <div style="padding:14px 28px;border-top:1px solid #E5DEB8;background:#FAF6E8;font-size:12px;color:#7A7370">' +
      '    Tilgungsplan ist eine Schätzung auf Basis konstanter Konditionen. Bei Anschlussfinanzierung können neue Zinssätze gelten.' +
      '  </div>' +
      '</div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.remove();
    });
  }

  // ─── triggerPdfImportTo() — Stub ──────────────────────────────
  // PDF-Import-Flow ist umfangreich, in V148 nur Stub mit Hinweis.
  // Echte Implementierung: V149 oder später, integriert in pdf-import.js
  function triggerPdfImportTo(target) {
    var label = target === 'd1' ? 'Bankdarlehen' :
                target === 'bspar' ? 'Bausparvertrag' : 'Dokument';
    alert(
      '📄 PDF-Import für ' + label + '\n\n' +
      'Funktion in Vorbereitung. Im aktuellen Stand bitte:\n\n' +
      '1. PDF öffnen (z.B. in Acrobat)\n' +
      '2. Wichtige Werte (Summe, Zins, Tilgung, Laufzeit) ablesen\n' +
      '3. Manuell in die Felder eintragen\n\n' +
      'Automatischer Import (KI-gestützt) folgt in einer der nächsten Versionen.'
    );
  }

  // ─── Hooks für bspar-Felder ────────────────────────────────────
  // Wenn Bauspar-Felder geändert werden, neu berechnen
  function _attachBsparListeners() {
    ['bspar_sum', 'bspar_rate', 'bspar_quote_min', 'bspar_zins',
     'bspar_dar_z', 'bspar_dar_t', 'd1_auszahl'].forEach(function (id) {
      var el = _q(id);
      if (el && !el._v148Hooked) {
        el.addEventListener('input', _recalcBspar);
        el._v148Hooked = true;
      }
    });
    // d1-Inputs für Volltilgung
    ['d1', 'd1z', 'd1t', 'd1_bindj', 'd1_auszahl'].forEach(function (id) {
      var el = _q(id);
      if (el && !el._v148HookedVT) {
        el.addEventListener('input', calcD1Volltilgung);
        el._v148HookedVT = true;
      }
    });
  }

  // ─── Init beim DOM-Load ────────────────────────────────────────
  function _init() {
    _attachBsparListeners();
    _forceEnableD1TypeOptions();
    // Initialer Render: wenn d1_type schon "tilgungsaussetzung" ist (gespeicherte Daten)
    var sel = _q('d1_type');
    if (sel && sel.value === 'tilgungsaussetzung') {
      onD1TypeChange();
    }
    calcD1Volltilgung();
  }

  // V150: Wenn irgendein anderes Skript die Tilgungsaussetzungs-Option
  // versteckt/disabled, hier wieder freischalten + dauerhaft beobachten.
  //
  // Plan-Logik (laut Marcels Vorgabe V150):
  //   - free:     erlaubt (zum Ausprobieren)
  //   - starter:  GESPERRT (zeigt Lock-Hinweis statt Option)
  //   - investor: erlaubt
  //   - pro:      erlaubt
  //   - business: erlaubt
  function _getCurrentPlan() {
    try {
      if (window.DealPilotConfig && DealPilotConfig.pricing && DealPilotConfig.pricing.current) {
        var cur = DealPilotConfig.pricing.current();
        if (cur && cur.key) return cur.key;
      }
    } catch (e) {}
    // Fallback: localStorage-Override oder default
    try {
      var ov = localStorage.getItem('dp_plan_override');
      if (ov) return ov;
    } catch (e) {}
    return 'free';
  }

  function _isTilgungsaussetzungAllowed() {
    var plan = _getCurrentPlan();
    // Starter ist der einzige zahlende Plan ohne Tilgungsaussetzung
    return plan !== 'starter';
  }

  function _forceEnableD1TypeOptions() {
    var allowed = _isTilgungsaussetzungAllowed();
    ['d1_type', 'd2_type'].forEach(function(selId) {
      var sel = _q(selId);
      if (!sel) return;
      Array.prototype.forEach.call(sel.options, function(opt) {
        if (opt.value !== 'tilgungsaussetzung') return;
        if (allowed) {
          // Plan erlaubt → komplett freischalten
          opt.disabled = false;
          opt.hidden = false;
          opt.style.display = '';
          opt.removeAttribute('disabled');
          opt.removeAttribute('hidden');
          // Label normalisieren (falls Lock-Emoji o.ä. drin steht)
          if (selId === 'd1_type' && opt.textContent.indexOf('🔒') === -1) {
            // Original-Text behalten, kein Override nötig
          }
        } else {
          // Starter → bleiben sperren, mit klarem Hinweis statt unsichtbar
          opt.disabled = true;
          opt.hidden = false;          // sichtbar lassen (greyed)
          opt.style.display = '';
          if (opt.textContent.indexOf('🔒') === -1) {
            opt.textContent = '🔒 ' + opt.textContent.replace(/^🔒\s*/, '') + ' — ab Investor-Plan';
          }
        }
      });
      // MutationObserver: wenn nochmal versteckt wird, gleich reagieren
      if (!sel._v150Watched && typeof MutationObserver !== 'undefined') {
        var mo = new MutationObserver(function(muts) {
          var needsRescan = false;
          muts.forEach(function(m) {
            if (m.target && m.target.tagName === 'OPTION' &&
                m.target.value === 'tilgungsaussetzung') {
              needsRescan = true;
            }
          });
          if (needsRescan) _forceEnableD1TypeOptions();
        });
        mo.observe(sel, { attributes: true, subtree: true,
                          attributeFilter: ['disabled', 'hidden', 'style'] });
        sel._v150Watched = true;
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    setTimeout(_init, 100);
  }
  // Nochmal nach load-Event (manche Felder werden async befüllt)
  if (typeof window !== 'undefined') {
    window.addEventListener('load', function () {
      setTimeout(_init, 300);
    });
  }

  // ─── Export ────────────────────────────────────────────────────
  global.onD1TypeChange = onD1TypeChange;
  global.calcD1Volltilgung = calcD1Volltilgung;
  global.openTilgungsplanModal = openTilgungsplanModal;
  global.triggerPdfImportTo = triggerPdfImportTo;
  global._recalcBspar = _recalcBspar;
  global._forceEnableD1TypeOptions = _forceEnableD1TypeOptions;
})(typeof window !== 'undefined' ? window : globalThis);
