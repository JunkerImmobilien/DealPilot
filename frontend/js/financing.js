'use strict';

/* ═══════════════════════════════════════════════════════════════════
   DealPilot — financing.js V63.49

   Erweiterungen Tab Finanzierung:
   1. D1-Darlehenstyp-Toggle (Annuität / Tilgungsaussetzung)
   2. Bausparvertrag-Card mit Sparrate + Zuteilungsdatum
   3. Auto-Berechnung: Zinsbindung (Jahre) → Zinsbindung-Datum,
      Volltilgung-Datum
   4. Tilgungsplan-Vorschau (read-only Tabelle, ein-/ausklappbar)
   5. PDF-Import-Ziel-Auswahl (D1 / D2 / Bausparvertrag)
   6. Empfehlungs-Engine (LTV / DSCR / Tilgung / Zinsbindung)

   Hinweis zur Cashflow-Mechanik:
   Bei Tilgungsaussetzung wird in calc.js "d1t" als 0 behandelt
   (geprüft via dpIsD1Tilgungsaussetzung). Die Bausparrate fließt
   stattdessen als zusätzlicher Liquiditätsabfluss in cf_ns ein.
═══════════════════════════════════════════════════════════════════ */

(function() {

  // ── Hilfen ────────────────────────────────────────────────────────
  function _g(id) { var e = document.getElementById(id); return e ? (e.value || '').trim() : ''; }
  function _v(id) {
    var s = _g(id);
    if (!s) return 0;
    var n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function _set(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; }
  function _setVal(id, val) {
    var e = document.getElementById(id); if (!e) return;
    if (e.tagName === 'INPUT' || e.tagName === 'SELECT' || e.tagName === 'TEXTAREA') {
      e.value = val;
      try { e.dispatchEvent(new Event('input', { bubbles: true })); } catch(_) {}
      try { e.dispatchEvent(new Event('change', { bubbles: true })); } catch(_) {}
    }
  }

  // ── (1) D1-Typ-Toggle ─────────────────────────────────────────────
  window.dpIsD1Tilgungsaussetzung = function() {
    return _g('d1_type') === 'tilgungsaussetzung';
  };

  window.onD1TypeChange = function() {
    var isAussetzung = window.dpIsD1Tilgungsaussetzung();
    var d1tField = document.getElementById('d1t');
    var d1tHint = document.getElementById('d1t_hint');
    var bsparCard = document.getElementById('bspar_card');

    if (d1tField) {
      d1tField.disabled = isAussetzung;
      d1tField.style.opacity = isAussetzung ? '0.45' : '';
      d1tField.style.cursor = isAussetzung ? 'not-allowed' : '';
      if (isAussetzung) {
        // Speichern und auf 0 setzen — bei Aussetzung gibt's keine Tilgung
        d1tField.dataset.savedValue = d1tField.value;
        d1tField.value = '0';
      } else if (d1tField.dataset.savedValue) {
        d1tField.value = d1tField.dataset.savedValue;
        delete d1tField.dataset.savedValue;
      }
    }
    if (d1tHint) d1tHint.style.display = isAussetzung ? '' : 'none';
    if (bsparCard) bsparCard.style.display = isAussetzung ? '' : 'none';

    // Recalc triggern
    if (typeof window.calc === 'function') window.calc();
  };

  // ── (2) Auto-Berechnung Zinsbindung-Datum + Volltilgung ──────────
  // Erwartet d1_auszahl als "MM.YYYY" oder "YYYY-MM" oder "MM/YYYY"
  function _parseMonth(str) {
    if (!str) return null;
    var s = String(str).trim();
    var m;
    // MM.YYYY
    m = s.match(/^(\d{1,2})[\.\/-](\d{4})$/);
    if (m) return { m: parseInt(m[1]), y: parseInt(m[2]) };
    // YYYY-MM
    m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return { m: parseInt(m[2]), y: parseInt(m[1]) };
    // Just year
    m = s.match(/^(\d{4})$/);
    if (m) return { m: 1, y: parseInt(m[1]) };
    return null;
  }
  function _addMonths(ym, n) {
    var total = ym.y * 12 + (ym.m - 1) + n;
    return { m: (total % 12) + 1, y: Math.floor(total / 12) };
  }
  function _fmtMonth(ym) {
    if (!ym) return '—';
    return String(ym.m).padStart(2, '0') + '.' + ym.y;
  }

  // Berechnet Volltilgung-Datum bei Annuitätendarlehen
  // Restschuld = D × ((1+i)^n − (1+i)^(t/12) × ((1+i)^n − 1) / i × 12 / D)
  // Pragmatisch: Anzahl Monate bis Restschuld 0 via Iteration
  function _calcMonthsToZero(D, iAnnual, monthlyRate) {
    if (D <= 0 || iAnnual <= 0 || monthlyRate <= 0) return 0;
    var iMonth = iAnnual / 100 / 12;
    var maxMonths = 600;
    var rs = D;
    for (var k = 0; k < maxMonths; k++) {
      var z = rs * iMonth;
      var t = monthlyRate - z;
      if (t <= 0) return 0; // Rate deckt nicht mal die Zinsen → keine Tilgung
      rs -= t;
      if (rs <= 0) return k + 1;
    }
    return maxMonths;
  }

  window.calcD1Volltilgung = function() {
    var auszahl = _parseMonth(_g('d1_auszahl'));
    var bindj = _v('d1_bindj');
    var D = _v('d1');
    var iAnnual = _v('d1z');
    var tInitial = _v('d1t');

    // Zinsbindung bis (auto)
    var bindEndYM = null;
    if (auszahl && bindj > 0) {
      bindEndYM = _addMonths(auszahl, Math.round(bindj * 12));
      _set('bindend', _fmtMonth(bindEndYM));
    } else if (bindj > 0) {
      // Fallback: Heute + bindj
      var today = new Date();
      bindEndYM = _addMonths({ m: today.getMonth() + 1, y: today.getFullYear() }, Math.round(bindj * 12));
      _set('bindend', _fmtMonth(bindEndYM) + ' (geschätzt)');
    } else {
      _set('bindend', '—');
    }

    // Volltilgung
    if (window.dpIsD1Tilgungsaussetzung()) {
      // Bei Aussetzung = Zuteilungsdatum vom Bausparvertrag
      var zuteil = _parseMonth(_g('bspar_zuteil'));
      _set('volltilg', zuteil ? 'BSV-Zuteilung ' + _fmtMonth(zuteil) : 'mit Bausparzuteilung');
    } else {
      // Annuität: monatliche Rate berechnen
      if (D > 0 && iAnnual > 0 && tInitial > 0) {
        var monthlyRate = D * (iAnnual + tInitial) / 100 / 12;
        var months = _calcMonthsToZero(D, iAnnual, monthlyRate);
        if (months > 0 && months < 600) {
          var startYM = auszahl || { m: (new Date()).getMonth() + 1, y: (new Date()).getFullYear() };
          var endYM = _addMonths(startYM, months);
          _set('volltilg', _fmtMonth(endYM) + ' (' + Math.ceil(months / 12) + ' J.)');
        } else {
          _set('volltilg', '—');
        }
      } else {
        _set('volltilg', '—');
      }
    }
  };

  // ── (4) Tilgungsplan-Modal (V63.50: editierbar, mit Override-Tracking) ──
  // Storage für manuelle Overrides — Schlüssel: "monthIdx" → { rate?, zins?, tilg? }
  window._tilgPlanOverrides = window._tilgPlanOverrides || {};

  window.openTilgungsplanModal = function() {
    var existing = document.getElementById('tilgplan-modal');
    if (existing) existing.remove();

    var ov = document.createElement('div');
    ov.id = 'tilgplan-modal';
    ov.className = 'iexp-overlay';
    ov.innerHTML =
      '<div class="iexp-modal tilgplan-modal" style="max-width:980px; max-height:92vh">' +
        '<div class="iexp-header">' +
          '<div class="iexp-h-text">' +
            '<h2>📋 Tilgungsplan — Darlehen 1</h2>' +
            '<p>Übersicht und Bearbeitung der monatlichen Raten. ' +
            'Du kannst einzelne Werte überschreiben — z.B. wenn deine Bank Sondertilgungen oder abweichende Raten vereinbart hat.</p>' +
          '</div>' +
          '<button class="iexp-close" type="button" onclick="closeTilgplanModal()" aria-label="Schließen">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="iexp-body" id="tilgplan-body" style="padding:0">' +
          '<div id="tilgplan-statusbar" style="padding:14px 24px; background:rgba(63,165,108,0.08); border-bottom:1px solid rgba(42,39,39,0.06); display:flex; align-items:center; justify-content:space-between; gap:14px">' +
            '<div id="tilgplan-status-text" style="font-size:13px; color:#2A2727; flex:1">' +
              '✓ Plan zeigt die Standard-Berechnung deiner Bank — keine manuellen Änderungen.' +
            '</div>' +
            '<div style="display:flex; gap:8px">' +
              '<button type="button" class="btn-ghost btn-sm" onclick="resetTilgplanOverrides()">↺ Zurücksetzen</button>' +
              '<button type="button" class="btn-primary btn-sm" onclick="closeTilgplanModal()">Übernehmen</button>' +
            '</div>' +
          '</div>' +
          '<div style="padding:18px 24px 24px 24px; max-height:calc(92vh - 200px); overflow-y:auto" id="tilgplan-table-wrap"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e) { if (e.target === ov) closeTilgplanModal(); });
    document.addEventListener('keydown', _tilgPlanEsc);
    _renderTilgPlanTable();
  };

  function _tilgPlanEsc(e) {
    if (e.key === 'Escape') closeTilgplanModal();
  }

  window.closeTilgplanModal = function() {
    var m = document.getElementById('tilgplan-modal'); if (m) m.remove();
    document.removeEventListener('keydown', _tilgPlanEsc);
  };

  window.resetTilgplanOverrides = function() {
    if (!confirm('Alle manuellen Änderungen verwerfen und Standard-Berechnung wiederherstellen?')) return;
    window._tilgPlanOverrides = {};
    _renderTilgPlanTable();
    if (typeof toast === 'function') toast('↺ Standard-Plan wiederhergestellt');
  };

  function _renderTilgPlanTable() {
    var box = document.getElementById('tilgplan-table-wrap');
    if (!box) return;
    var D = _v('d1');
    var iAnnual = _v('d1z');
    var tInitial = _v('d1t');
    var auszahl = _parseMonth(_g('d1_auszahl')) || { m: (new Date()).getMonth() + 1, y: (new Date()).getFullYear() };
    var bindj = _v('d1_bindj') || 10;
    var isAussetzung = window.dpIsD1Tilgungsaussetzung();
    var bsparRate = _v('bspar_rate');
    var bsparZinsRate = _v('bspar_zins') / 100 / 12;

    if (D <= 0 || iAnnual <= 0) {
      box.innerHTML = '<div style="padding:30px; text-align:center; color:#7A7370">Bitte zuerst Darlehenssumme und Zinssatz im Tab Finanzierung eingeben.</div>';
      return;
    }

    var iMonth = iAnnual / 100 / 12;
    var defaultRate = isAussetzung ? (D * iAnnual / 100 / 12) : (D * (iAnnual + tInitial) / 100 / 12);
    // Anzeige: gesamte Zinsbindung + 24 Monate Anschluss-Vorausschau
    var maxMonths = Math.min(Math.round(bindj * 12) + 24, 480);
    var rs = D;
    var bsparGuth = 0;
    var anyOverride = false;

    var html =
      '<table class="phase-table tilgplan-table" style="width:100%; font-size:12.5px">' +
      '<thead style="position:sticky; top:0; z-index:5">' +
        '<tr>' +
          '<th style="text-align:left; width:42px">#</th>' +
          '<th style="text-align:left; width:90px">Datum</th>' +
          '<th class="num" style="width:130px">Rate</th>' +
          '<th class="num" style="width:130px">Zinsen</th>' +
          '<th class="num" style="width:130px">Tilgung</th>' +
          '<th class="num" style="width:140px">Restschuld</th>' +
          (isAussetzung ? '<th class="num" style="width:130px">BSV-Rate</th><th class="num" style="width:130px">BSV-Guth.</th>' : '') +
        '</tr>' +
      '</thead><tbody>';

    for (var k = 0; k < maxMonths; k++) {
      var ov = window._tilgPlanOverrides[k] || {};
      var rate = (ov.rate != null) ? ov.rate : defaultRate;
      var z = (ov.zins != null) ? ov.zins : (rs * iMonth);
      var t = (ov.tilg != null) ? ov.tilg : (isAussetzung ? 0 : (rate - z));
      if (ov.rate != null || ov.zins != null || ov.tilg != null) anyOverride = true;
      // Kein Tilgungs-Abzug wenn Aussetzung + kein Override
      if (!isAussetzung || ov.tilg != null) rs -= t;
      if (rs < 0) rs = 0;
      var ym = _addMonths(auszahl, k);

      // BSV
      bsparGuth = bsparGuth * (1 + bsparZinsRate) + (isAussetzung ? bsparRate : 0);

      var rowMod = (ov.rate != null || ov.zins != null || ov.tilg != null);
      var rowBg = rowMod ? 'rgba(201,168,76,0.10)' : '';
      var isEzbRow = k === Math.round(bindj * 12) - 1;
      if (isEzbRow) rowBg = 'rgba(250, 245, 225, 0.6)';

      html +=
        '<tr style="background:' + rowBg + '">' +
          '<td>' + (k + 1) + (rowMod ? ' <span style="color:#C9A84C; font-size:10px" title="Manuell geändert">●</span>' : '') + '</td>' +
          '<td>' + _fmtMonth(ym) + (isEzbRow ? ' <span style="font-size:9px; color:#C9A84C; font-weight:700">EZB</span>' : '') + '</td>' +
          _editCell(k, 'rate', rate) +
          _editCell(k, 'zins', z, '#B8625C') +
          _editCell(k, 'tilg', t, '#3FA56C') +
          '<td class="num" style="font-weight:600">' + Math.round(rs).toLocaleString('de-DE') + ' €</td>' +
          (isAussetzung ? '<td class="num">' + Math.round(isAussetzung ? bsparRate : 0).toLocaleString('de-DE') + ' €</td>' : '') +
          (isAussetzung ? '<td class="num" style="font-weight:600; color:#3FA56C">' + Math.round(bsparGuth).toLocaleString('de-DE') + ' €</td>' : '') +
        '</tr>';
    }
    html += '</tbody></table>';
    if (maxMonths >= 480) {
      html += '<div class="hint" style="padding:10px 0">… (Anzeige auf 480 Monate begrenzt — der gesamte Tilgungsverlauf wird intern weitergeführt.)</div>';
    }
    box.innerHTML = html;

    // Statusbar updaten
    var statusEl = document.getElementById('tilgplan-status-text');
    if (statusEl) {
      if (anyOverride) {
        var count = Object.keys(window._tilgPlanOverrides).length;
        statusEl.innerHTML = '⚡ <b>' + count + ' Zeile' + (count !== 1 ? 'n' : '') + ' manuell überschrieben</b> — abweichend von der Standard-Berechnung. ' +
          'Goldene Markierung in der Tabelle. Mit "Zurücksetzen" wieder auf den Bank-Plan.';
        var bar = document.getElementById('tilgplan-statusbar');
        if (bar) bar.style.background = 'rgba(201,168,76,0.10)';
      } else {
        statusEl.innerHTML = '✓ Plan zeigt die Standard-Berechnung deiner Bank — keine manuellen Änderungen.';
        var bar2 = document.getElementById('tilgplan-statusbar');
        if (bar2) bar2.style.background = 'rgba(63,165,108,0.08)';
      }
    }
  }

  function _editCell(idx, kind, val, color) {
    var color2 = color || '#2A2727';
    return '<td class="num" style="padding:0">' +
      '<input type="text" inputmode="decimal" data-tilg-idx="' + idx + '" data-tilg-kind="' + kind + '" ' +
      'value="' + Math.round(val).toLocaleString('de-DE') + '" ' +
      'oninput="onTilgPlanEdit(event)" ' +
      'style="width:100%; box-sizing:border-box; border:none; background:transparent; ' +
      'text-align:right; padding:6px 8px; font-size:12px; color:' + color2 + '; font-family:inherit; ' +
      'outline:none; cursor:text" ' +
      'onfocus="this.style.background=\'rgba(201,168,76,0.08)\'" ' +
      'onblur="this.style.background=\'\'"' +
      '>€</td>';
  }

  window.onTilgPlanEdit = function(e) {
    var inp = e.target;
    var idx = parseInt(inp.dataset.tilgIdx);
    var kind = inp.dataset.tilgKind;
    var raw = inp.value.replace(/\./g, '').replace(/[^\d,\-]/g, '').replace(',', '.');
    var num = parseFloat(raw);
    if (!isFinite(num)) return;
    if (!window._tilgPlanOverrides[idx]) window._tilgPlanOverrides[idx] = {};
    window._tilgPlanOverrides[idx][kind] = num;
    // Re-Render mit Verzögerung damit der User weitertippen kann
    clearTimeout(window._tilgPlanRedrawTimer);
    window._tilgPlanRedrawTimer = setTimeout(_renderTilgPlanTable, 600);
  };

  // ── (5) PDF-Import-Ziel-Auswahl ──────────────────────────────────
  window.triggerPdfImportTo = function(target) {
    // target: 'd1' | 'd2' | 'bspar'
    window._pdfImportTarget = target;
    var input = document.getElementById('pdf-import-input');
    if (!input) {
      // Fallback: erstelle einen versteckten File-Input
      input = document.createElement('input');
      input.type = 'file';
      input.id = 'pdf-import-input';
      input.accept = 'application/pdf';
      input.style.display = 'none';
      input.addEventListener('change', _handlePdfImport);
      document.body.appendChild(input);
    }
    input.click();
  };

  function _handlePdfImport(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var target = window._pdfImportTarget || 'd1';

    // Bestehender PDF-Parser nutzen falls da
    if (typeof window.dpParsePdfFinanzierung === 'function') {
      window.dpParsePdfFinanzierung(file, target);
    } else if (typeof window.importPdf === 'function') {
      window.importPdf(file, target);
    } else {
      // Fallback: einfacher Hinweis — die echte OCR-Logik liegt in pdf-import.js
      if (typeof toast === 'function') {
        toast('⚠ PDF-Import-Modul nicht geladen. Bitte Werte manuell eingeben.');
      }
    }
    e.target.value = '';
  }

  // ── (6) Empfehlungs-Engine ───────────────────────────────────────
  function _renderRecommendations() {
  // V252-04: Empfehlungen-Card entfernt — Render skipped
  return;

    var listEl = document.getElementById('fin_recommend_list');
    if (!listEl) return;
    var K = window.State && State.kpis;
    if (!K || !K.kp) {
      listEl.innerHTML = '<div class="hint" style="padding:10px">Empfehlungen erscheinen, sobald Kaufpreis &amp; Finanzierung erfasst sind.</div>';
      return;
    }

    var recs = [];
    var ltv = K.ltv || 0;
    var dscr = K.dscr || 0;
    var tilg = _v('d1t');
    var bindj = _v('d1_bindj');
    var zins = _v('d1z');
    var isAussetzung = window.dpIsD1Tilgungsaussetzung();

    // LTV
    if (ltv > 100) {
      recs.push({ type: 'warn', icon: '⚠', title: 'LTV über 100 % — kritisch',
        text: 'Dein LTV liegt bei <b>' + ltv.toFixed(1) + ' %</b>. Banken bevorzugen LTV ≤ 90 %. ' +
              'Prüfe, ob du mehr Eigenkapital einbringen kannst oder den Kaufpreis reduzieren kannst.' });
    } else if (ltv > 90) {
      recs.push({ type: 'gold', icon: '⚡', title: 'LTV grenzwertig (' + ltv.toFixed(1) + ' %)',
        text: 'Mit höherem LTV steigt der Zinssatz. Eine LTV-Reduktion auf ≤ 80 % bringt oft 0,2–0,4 % bessere Konditionen.' });
    } else if (ltv < 60) {
      recs.push({ type: 'ok', icon: '✓', title: 'LTV sehr konservativ',
        text: 'Mit ' + ltv.toFixed(1) + ' % LTV ist die Beleihung niedrig. Du bekommst die besten Zinskonditionen.' });
    }

    // DSCR
    if (dscr < 1.0) {
      recs.push({ type: 'warn', icon: '⚠', title: 'DSCR unter 1,0 — Mieten decken Rate nicht',
        text: 'DSCR = <b>' + dscr.toFixed(2) + '</b>. Die Mieteinnahmen decken den Kapitaldienst nicht. ' +
              'Optionen: Tilgung reduzieren, Eigenkapital erhöhen, oder Kaufpreis verhandeln.' });
    } else if (dscr < 1.2) {
      recs.push({ type: 'gold', icon: '⚡', title: 'DSCR knapp (' + dscr.toFixed(2) + ')',
        text: 'Banken erwarten i.d.R. DSCR ≥ 1,2. Bei Mietausfall wird es eng. ' +
              'Erhöhung der Tilgung verschlechtert DSCR weiter — über Anschluss-Tilgung von 1,0 % nachdenken.' });
    }

    // Tilgung
    if (!isAussetzung && tilg < 1.5 && bindj <= 10) {
      recs.push({ type: 'gold', icon: '💡', title: 'Niedrige Tilgung bei kurzer Zinsbindung',
        text: 'Mit nur <b>' + tilg.toFixed(2) + ' %</b> Tilgung bei ' + bindj + ' J. Zinsbindung bleibt am Ende eine hohe Restschuld. ' +
              'Bei steigenden Zinsen kann die Anschlussfinanzierung teuer werden.' });
    }
    if (!isAussetzung && tilg >= 2.5) {
      recs.push({ type: 'ok', icon: '✓', title: 'Hohe Tilgung — schneller schuldenfrei',
        text: 'Mit ' + tilg.toFixed(2) + ' % Anfangstilgung baust du schnell Eigenkapital auf. Der Cashflow bleibt aber gedrückt.' });
    }

    // Zinsbindung
    if (bindj <= 5 && zins < 4.0) {
      recs.push({ type: 'gold', icon: '💡', title: 'Kurze Zinsbindung — hohes Anschlussrisiko',
        text: 'Bei nur ' + bindj + ' Jahren Zinsbindung trägst du das volle Anschlussrisiko. ' +
              'Eine längere Bindung (15+ Jahre) sichert dir die aktuellen Konditionen.' });
    }
    if (bindj >= 20) {
      recs.push({ type: 'ok', icon: '✓', title: 'Lange Zinsbindung — Planungssicherheit',
        text: bindj + ' Jahre Zinsbindung gibt dir maximale Planungssicherheit. § 489 BGB erlaubt nach 10 J. eine Sondertilgung.' });
    }

    // Tilgungsaussetzung-spezifisch
    if (isAussetzung) {
      var bsparSum = _v('bspar_sum');
      var D = _v('d1');
      if (bsparSum > 0 && bsparSum < D * 0.95) {
        recs.push({ type: 'warn', icon: '⚠', title: 'Bausparsumme deckt Restschuld nicht',
          text: 'Bei Tilgungsaussetzung sollte die Bausparsumme die volle Darlehenssumme abdecken. ' +
                'Aktuell: BSV ' + Math.round(bsparSum).toLocaleString('de-DE') + ' € vs. Darlehen ' +
                Math.round(D).toLocaleString('de-DE') + ' €.' });
      }
    }

    // KfW-Hinweis (wenn D2 nicht aktiv)
    var d2Enable = document.getElementById('d2_enable');
    if (d2Enable && !d2Enable.checked && (parseInt(_g('baujahr')) || 9999) < 1990) {
      recs.push({ type: 'gold', icon: '💡', title: 'Prüfe KfW-Förderung',
        text: 'Bei einem Baujahr vor 1990 kommt häufig eine energetische Sanierung in Frage. ' +
              'KfW 261 (Wohngebäude-Kredit) bietet vergünstigte Zinsen für Sanierungen.' });
    }

    // Render
    if (!recs.length) {
      listEl.innerHTML = '<div class="hint" style="padding:10px">✓ Deine Finanzierung sieht solide aus — keine kritischen Hinweise.</div>';
      return;
    }
    listEl.innerHTML = recs.map(function(r) {
      var bg = r.type === 'warn' ? 'rgba(184,98,92,0.08)' :
               r.type === 'gold' ? 'rgba(201,168,76,0.10)' :
                                    'rgba(63,165,108,0.08)';
      var border = r.type === 'warn' ? '#B8625C' :
                   r.type === 'gold' ? '#C9A84C' :
                                       '#3FA56C';
      return '<div style="display:flex; gap:12px; padding:11px 14px; margin-bottom:8px; ' +
             'background:' + bg + '; border-left:3px solid ' + border + '; border-radius:6px">' +
             '<span style="font-size:16px; line-height:1">' + r.icon + '</span>' +
             '<div style="flex:1">' +
               '<div style="font-weight:600; font-size:13px; color:#2A2727; margin-bottom:3px">' + r.title + '</div>' +
               '<div style="font-size:12px; line-height:1.45; color:#555050">' + r.text + '</div>' +
             '</div>' +
             '</div>';
    }).join('');
  }

  // ── Init + Hooks ─────────────────────────────────────────────────
  // V63.54: BSV-Lifecycle-UI im Tab Finanzierung aktualisieren
  function _renderBsvLifecycleUI() {
    var lc = window.State && window.State.bsvLifecycle;
    var box = document.getElementById('bspar_zuteilung_box');
    var statusEl = document.getElementById('bspar_zuteil_status');
    var detailEl = document.getElementById('bspar_zuteil_detail');
    var dateEl = document.getElementById('bspar_zuteil_auto');
    var rateEl = document.getElementById('bspar_dar_rate');

    if (!lc || lc.bsparSum === 0) {
      if (box) box.style.display = 'none';
      if (dateEl) dateEl.textContent = '—';
      if (rateEl) rateEl.textContent = '—';
      return;
    }

    if (box) box.style.display = '';

    // Empfohlene Sparrate ausgeben
    var fmtE = function(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; };

    if (lc.zuteilStatus === 'never') {
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:#B8625C">⚠ Sparrate zu niedrig — Zuteilung in 50 Jahren nicht erreichbar</span>';
      }
      if (detailEl) {
        detailEl.innerHTML = 'Mindestguthaben: <b>' + fmtE(lc.zielGuthaben) + '</b> ' +
          '(' + (lc.bsparQuote * 100).toFixed(0) + ' % von ' + fmtE(lc.bsparSum) + '). ' +
          'Empfohlene Sparrate für Zuteilung zur Zinsbindung-Ende (Jahr ' + lc.bindj + '): ' +
          '<b>' + fmtE(lc.empfohleneSparrate) + ' / Mon</b>';
      }
    } else {
      var statusIcon, statusText, statusColor;
      if (lc.zuteilStatus === 'before_ezb') {
        statusIcon = '✓';
        statusText = 'Zuteilung vor Bindungsende — optimal';
        statusColor = '#3FA56C';
      } else if (lc.zuteilStatus === 'at_ezb') {
        statusIcon = '✓';
        statusText = 'Zuteilung exakt zum Bindungsende — passt';
        statusColor = '#3FA56C';
      } else {
        statusIcon = '⚡';
        statusText = 'Zuteilung erst nach Bindungsende — Anschlussfinanzierung der Lücke nötig';
        statusColor = '#C9A84C';
      }

      if (statusEl) {
        statusEl.innerHTML = '<span style="color:' + statusColor + '">' + statusIcon + ' ' + statusText + '</span>';
      }
      if (detailEl) {
        var msg =
          'Voraussichtl. Zuteilung in <b>' + lc.jahreBisZuteilung + ' Jahren</b> (' + lc.zuteilDate + '). ' +
          'Sparguthaben dann: <b>' + fmtE(lc.guthabenBeiZuteilung) + '</b>. ' +
          'Bauspardarlehen: <b>' + fmtE(lc.bauspardarlehen) + '</b>. ' +
          'Damit ablösbar: <b>' + fmtE(lc.abloseSumme) + '</b>';
        if (lc.luecke > 0) {
          msg += ' — <span style="color:#B8625C">Lücke ' + fmtE(lc.luecke) + ' (Anschlussfinanzierung erforderlich)</span>';
        }
        if (!lc.sparrateOk && lc.zuteilStatus !== 'before_ezb' && lc.zuteilStatus !== 'at_ezb') {
          msg += '<br><span style="color:#C9A84C">Tipp: Sparrate <b>' + fmtE(lc.empfohleneSparrate) + ' / Mon</b> würde Zuteilung exakt zum Bindungsende ermöglichen.</span>';
        }
        detailEl.innerHTML = msg;
      }
    }

    if (dateEl) dateEl.textContent = lc.zuteilDate || '—';
    if (rateEl) rateEl.textContent = lc.darRateM > 0 ? fmtE(lc.darRateM) + ' / Mon' : '—';
  }

  window.dpFinancingRefresh = function() {
    window.calcD1Volltilgung();
    _renderRecommendations();
    _renderBsvLifecycleUI();
  };

  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      // Initialer Sync (falls D1-Typ aus localStorage geladen)
      if (typeof window.onD1TypeChange === 'function') window.onD1TypeChange();
      window.dpFinancingRefresh();
    }, 200);

    // Recommendations updaten wenn calc fertig ist
    var origCalc = window.calc;
    if (typeof origCalc === 'function') {
      window.calc = function() {
        var r = origCalc.apply(this, arguments);
        try { window.dpFinancingRefresh(); } catch(e) {}
        return r;
      };
    }
  });

})();

/* ═══════════════════════════════════════════════════════════════
   v1244 · Kapitaldeckung — Testbericht Block F
   „Sollte hier die Reihenfolge nicht anders sein? Erst eintragen was für
   ein Kredit ich bekomme und den EK-Einsatz berechnet er automatisch
   (wie Immocation Tool)"

   Gemessen ergab: es gibt gar keine Reihenfolge. Eigenkapital und
   Darlehen waren zwei unabhängige Zahlen. Bei Objekt 2026-001 standen
   20.000 € EK und 180.000 € Darlehen gegen eine Gesamtinvestition von
   220.400 € — 20.400 € fehlten, und nichts sagte es. Die EK-Rendite
   rechnete weiter auf 20.000 € und sah deshalb zu gut aus.

   Diese Zeile rechnet in BEIDE Richtungen: sie zeigt die Lücke und
   bietet je einen Knopf an, sie über das Eigenkapital oder über das
   Darlehen zu schließen. Marcels Weg (erst Kredit, dann EK) ist damit
   möglich, ohne den umgekehrten zu verbauen.

   Bezugsgröße ist die GESAMTinvestition (kp + Nebenkosten + Sanierung +
   Möblierung), nicht der Kaufpreis. Genau daran ist die Lücke oben
   aufgefallen.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function _zahl(id) {
    var e = document.getElementById(id);
    if (!e) return 0;
    var s = String(e.value || '').split('.').join('').replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function _setzen(id, wert) {
    var e = document.getElementById(id);
    if (!e) return;
    e.value = Math.round(wert).toLocaleString('de-DE');
    e.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof window.calc === 'function') window.calc();
  }

  /* Die Darlehen: D2 zählt nur mit, wenn es eingeschaltet ist. */
  function _darlehenSumme() {
    var d1 = _zahl('d1');
    var d2 = 0;
    var an = document.getElementById('d2_enable');
    if (an && an.checked) d2 = _zahl('d2');
    return { d1: d1, d2: d2, summe: d1 + d2 };
  }

  function _gesamtinvestition() {
    /* State.gi ist die Wahrheit — calc.js:756 rechnet sie aus kp, nk, san
       und moebl.

       v1244b · Der Wert wird durch Number() gezwungen und gegen den
       Kaufpreis plausibilisiert, statt nur `typeof === 'number'` zu
       prüfen. Anlass war ein Messfehler von mir: ich hatte im Browser
       versehentlich die globale v() aus calc.js überschrieben, worauf
       `kp` als String zurückkam und `kp + nk` zu "20000020400"
       verkettete. Die Prüfung schlug fehl, der Fallback nahm den
       Kaufpreis — und die Zeile meldete stumm eine falsche Lücke.

       In der App tritt das nicht auf. Die Lehre gilt trotzdem: eine
       Kennzahl, die aus einer fremden Rechnung kommt, wird beim Lesen
       zur Zahl gemacht und auf Plausibilität geprüft, nicht auf ihren
       Typ. Die Gesamtinvestition kann nie kleiner als der Kaufpreis
       sein. */
    var kp = _zahl('kp');
    var roh = (window.State && State.gi != null) ? Number(State.gi) : NaN;
    if (isFinite(roh) && roh > 0 && (kp <= 0 || roh >= kp)) {
      return { wert: roh, sicher: true };
    }
    /* Zweite Quelle: der KPI-Satz führt die Gesamtinvestition ebenfalls. */
    var ausKpi = (window.State && State.kpis) ? Number(State.kpis.gi) : NaN;
    if (isFinite(ausKpi) && ausKpi > 0 && (kp <= 0 || ausKpi >= kp)) {
      return { wert: ausKpi, sicher: true };
    }
    return { wert: kp, sicher: false };
  }

  function _eur(n) {
    return Math.round(n).toLocaleString('de-DE') + ' €';
  }

  window.dpKapitalEkSetzen = function () {
    var gi = _gesamtinvestition();
    var d = _darlehenSumme();
    var neu = Math.max(0, gi.wert - d.summe);
    _setzen('ek', neu);
    if (typeof window.toast === 'function') {
      window.toast('✓ Eigenkapital auf ' + _eur(neu) + ' gesetzt — Gesamtinvestition minus Darlehen');
    }
  };

  window.dpKapitalDarlehenSetzen = function () {
    var gi = _gesamtinvestition();
    var d = _darlehenSumme();
    var neu = Math.max(0, gi.wert - _zahl('ek') - d.d2);
    _setzen('d1', neu);
    if (typeof window.toast === 'function') {
      window.toast('✓ Darlehen I auf ' + _eur(neu) + ' gesetzt — Gesamtinvestition minus Eigenkapital' + (d.d2 ? ' und Darlehen II' : ''));
    }
  };

  window.dpKapitalDeckungRender = function () {
    var box = document.getElementById('kd-box');
    var zeile = document.getElementById('kd-zeile');
    var rechnung = document.getElementById('kd-rechnung');
    if (!box || !zeile) return;

    var gi = _gesamtinvestition();
    var d = _darlehenSumme();
    var ek = _zahl('ek');
    var btnEk = document.getElementById('kd-btn-ek');
    var btnD1 = document.getElementById('kd-btn-d1');

    /* Solange nichts eingetragen ist, wird nichts behauptet. */
    if (gi.wert <= 0 || (ek === 0 && d.summe === 0)) {
      box.style.background = 'transparent';
      box.style.border = '1px solid transparent';
      zeile.innerHTML = '<span class="cf-hint">Kapitaldeckung: sobald Gesamtinvestition und Finanzierung stehen.</span>';
      rechnung.textContent = '';
      if (btnEk) btnEk.style.display = 'none';
      if (btnD1) btnD1.style.display = 'none';
      return;
    }

    var deckung = ek + d.summe;
    var diff = deckung - gi.wert;
    var toleranz = 1;   /* Rundung auf volle Euro */

    rechnung.textContent = _eur(ek) + ' Eigenkapital + ' + _eur(d.d1) + ' Darlehen I'
      + (d.d2 ? ' + ' + _eur(d.d2) + ' Darlehen II' : '')
      + ' = ' + _eur(deckung)
      + '  ·  Gesamtinvestition ' + _eur(gi.wert)
      + (gi.sicher ? '' : ' (nur Kaufpreis — noch nicht gerechnet)');

    if (Math.abs(diff) <= toleranz) {
      box.style.background = 'color-mix(in srgb, var(--green, #3FA56C) 8%, transparent)';
      box.style.border = '1px solid color-mix(in srgb, var(--green, #3FA56C) 30%, transparent)';
      zeile.innerHTML = '<b style="color:var(--green,#3FA56C)">Kapitaldeckung stimmt.</b> '
                      + 'Eigenkapital und Darlehen decken die Gesamtinvestition genau.';
      if (btnEk) btnEk.style.display = 'none';
      if (btnD1) btnD1.style.display = 'none';
      return;
    }

    if (diff < 0) {
      box.style.background = 'color-mix(in srgb, var(--red, #B8625C) 8%, transparent)';
      box.style.border = '1px solid color-mix(in srgb, var(--red, #B8625C) 32%, transparent)';
      zeile.innerHTML = '<b style="color:var(--red,#B8625C)">Es fehlen ' + _eur(-diff) + '.</b> '
                      + 'Eigenkapital und Darlehen decken die Gesamtinvestition nicht — '
                      + 'die EK-Rendite rechnet dann auf zu wenig eingesetztes Kapital und sieht zu gut aus.';
    } else {
      box.style.background = 'color-mix(in srgb, var(--gold) 8%, transparent)';
      box.style.border = '1px solid color-mix(in srgb, var(--gold) 32%, transparent)';
      zeile.innerHTML = '<b style="color:var(--gold)">' + _eur(diff) + ' zu viel.</b> '
                      + 'Eigenkapital und Darlehen liegen über der Gesamtinvestition.';
    }
    if (btnEk) btnEk.style.display = '';
    if (btnD1) btnD1.style.display = '';
  };

  /* Nach jedem Rechenlauf nachziehen. calc() ist die einzige Stelle, an
     der State.gi entsteht — deshalb hier andocken statt einen eigenen
     Zeitgeber zu bauen. */
  function _anhaengen() {
    if (typeof window.calc !== 'function' || window.calc._dpKdHook) return false;
    var alt = window.calc;
    var neu = function () {
      var r = alt.apply(this, arguments);
      try { window.dpKapitalDeckungRender(); } catch (e) {}
      return r;
    };
    /* v1244b · Marker der alten Funktion mitnehmen. window.calc ist bereits
       zweimal umhüllt — financing.js:576 (dpFinancingRefresh) und
       deal-action-readycheck.js:208 (v450). Letzteres erkennt an seinem
       eigenen Marker `_v450Wrapped`, ob es schon gewrappt hat. Ein Wrapper,
       der die Marker der alten Funktion nicht überträgt, macht sie
       unsichtbar — und der nächste Lauf wrappt ein zweites Mal, worauf
       `refresh()` doppelt feuert. deal-action-readycheck.js macht es
       richtig; das wird hier übernommen. */
    try {
      for (var k in alt) {
        if (Object.prototype.hasOwnProperty.call(alt, k)) neu[k] = alt[k];
      }
    } catch (e) {}
    neu._dpKdHook = true;
    window.calc = neu;
    return true;
  }

  var _versuche = 0;

  /* Die Feld-Listener haengen NICHT am calc-Hook: sie werden einmal
     gesetzt, egal ob calc schon da ist. Sonst haette ein Abbruch der
     Warteschleife auch sie mitgenommen — und die Zeile waere still tot. */
  function _listener() {
    ['ek', 'd1', 'd2', 'd2_enable'].forEach(function (id) {
      var e = document.getElementById(id);
      if (!e || e._dpKdBound) return;
      e._dpKdBound = true;
      e.addEventListener('input', function () { setTimeout(window.dpKapitalDeckungRender, 60); });
      e.addEventListener('change', function () { setTimeout(window.dpKapitalDeckungRender, 60); });
    });
  }

  function _start() {
    _listener();
    try { window.dpKapitalDeckungRender(); } catch (e) {}
    /* financing.js kann vor calc.js laden. Nach zwoelf Anlaeufen (rund
       fuenf Sekunden) kommt calc nicht mehr; dann bleibt die Zeile an den
       Feld-Listenern haengen, die oben schon stehen. */
    if (!_anhaengen() && ++_versuche < 12) setTimeout(_start, 400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _start);
  } else {
    _start();
  }
})();
