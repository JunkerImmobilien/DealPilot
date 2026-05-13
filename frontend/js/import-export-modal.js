'use strict';

/* ═══════════════════════════════════════════════════════════════════
   DealPilot — import-export-modal.js V63.46

   Zwei zentrale Hubs:
   - openImportHub() — zeigt Import-Optionen (Excel, JSON-Backup)
   - openExportHub() — zeigt Export-Optionen (PDF einzelnes Objekt,
                       JSON-Backup gesamt, CSV-Komplettexport, CSV einzeln)

   UI: Modal im Settings-Stil mit Karten, Beschreibung pro Aktion.
   Bei objekt-spezifischen Aktionen (PDF einzeln, CSV einzeln) öffnet
   sich eine zweite Stage mit Objekt-Auswahl.
═══════════════════════════════════════════════════════════════════ */

(function() {

  function _icon(name, size) {
    if (window.Icons && Icons[name]) return Icons[name]({ size: size || 22 });
    return '';
  }

  function _modalShell(title, subtitle, bodyHTML) {
    var existing = document.getElementById('iexp-modal');
    if (existing) existing.remove();

    var wrap = document.createElement('div');
    wrap.id = 'iexp-modal';
    wrap.className = 'iexp-overlay';
    wrap.innerHTML =
      '<div class="iexp-modal" role="dialog" aria-label="' + title + '">' +
        '<div class="iexp-header">' +
          '<div class="iexp-h-text">' +
            '<h2>' + title + '</h2>' +
            '<p>' + (subtitle || '') + '</p>' +
          '</div>' +
          '<button class="iexp-close" type="button" onclick="closeIexpModal()" aria-label="Schließen">' +
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
              '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="iexp-body" id="iexp-body">' +
          bodyHTML +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    // ESC schließt
    setTimeout(function() {
      document.addEventListener('keydown', _escHandler);
    }, 50);

    // Klick außerhalb schließt
    wrap.addEventListener('click', function(e) {
      if (e.target === wrap) closeIexpModal();
    });
  }

  function _escHandler(e) {
    if (e.key === 'Escape') closeIexpModal();
  }

  window.closeIexpModal = function() {
    var m = document.getElementById('iexp-modal');
    if (m) m.remove();
    document.removeEventListener('keydown', _escHandler);
  };

  // ══════════════════════════════════════════════════════════════════
  // IMPORT-HUB
  // ══════════════════════════════════════════════════════════════════
  function _renderImportCards() {
    return (
      '<div class="iexp-grid">' +

        // Excel-Import
        '<div class="iexp-card" onclick="iexpImportExcel()">' +
          '<div class="iexp-card-ico iexp-ico-blue">' + _icon('upload', 22) + '</div>' +
          '<div class="iexp-card-tag">Excel · ImmoKalk · immocation</div>' +
          '<h3>Excel-Kalkulation importieren</h3>' +
          '<p>Übernimmt alle Eingaben aus einer Excel-Datei in das aktuell geöffnete Objekt. ' +
          'Drei Formate werden automatisch erkannt:</p>' +
          '<ul class="iexp-bullets">' +
            '<li><b>ImmoKalk</b> (Sheet "Immobilienkalkulation")</li>' +
            '<li><b>immocation Roter Faden</b> (Gratis-Version)</li>' +
            '<li><b>immocation Pro</b> (Cockpit Pro)</li>' +
          '</ul>' +
          '<p class="iexp-warn">⚠ Bestehende Eingaben im aktuellen Objekt werden überschrieben.</p>' +
          '<div class="iexp-card-cta">Datei wählen <span>›</span></div>' +
        '</div>' +

        // JSON-Backup-Import
        '<div class="iexp-card" onclick="iexpImportJson()">' +
          '<div class="iexp-card-ico iexp-ico-gold">' + _icon('upload', 22) + '</div>' +
          '<div class="iexp-card-tag">DealPilot-Format · .json</div>' +
          '<h3>JSON-Backup importieren</h3>' +
          '<p>Importiert ein zuvor exportiertes DealPilot-Backup (Sammeldatei mit allen Objekten). ' +
          'Bestehende Objekte mit gleichem Namen werden überschrieben.</p>' +
          '<ul class="iexp-bullets">' +
            '<li>Alle Eingaben &amp; Berechnungen pro Objekt</li>' +
            '<li>Sterne-Bewertungen, Annotationen, KI-Analysen</li>' +
            '<li>Objektfotos (falls in Backup enthalten)</li>' +
          '</ul>' +
          '<p class="iexp-warn">⚠ Stripe/Plan-Daten sind <em>nicht</em> enthalten — nur Objekte.</p>' +
          '<div class="iexp-card-cta">Datei wählen <span>›</span></div>' +
        '</div>' +

      '</div>'
    );
  }

  window.openImportHub = function() {
    _modalShell(
      'Daten importieren',
      'Eingaben aus Excel laden oder ein DealPilot-Backup wiederherstellen.',
      _renderImportCards()
    );
  };

  window.iexpImportExcel = function() {
    closeIexpModal();
    if (typeof window.triggerImportExcel === 'function') window.triggerImportExcel();
    else if (typeof toast === 'function') toast('⚠ Excel-Import nicht verfügbar');
  };

  window.iexpImportJson = function() {
    closeIexpModal();
    if (typeof window.triggerImportJson === 'function') window.triggerImportJson();
    else if (typeof toast === 'function') toast('⚠ JSON-Import nicht verfügbar');
  };

  // ══════════════════════════════════════════════════════════════════
  // EXPORT-HUB
  // ══════════════════════════════════════════════════════════════════
  function _renderExportCards() {
    return (
      '<div class="iexp-grid">' +

        // PDF einzelnes Objekt
        '<div class="iexp-card" onclick="iexpExportPdf()">' +
          '<div class="iexp-card-ico iexp-ico-red">' + _icon('fileText', 22) + '</div>' +
          '<div class="iexp-card-tag">PDF · Investment-Case</div>' +
          '<h3>PDF-Report für Objekt</h3>' +
          '<p>Erzeugt einen professionellen Investment-Case (mehrseitig) für <b>ein einzelnes Objekt</b>. ' +
          'Der Report ist für Banken &amp; Investoren formatiert.</p>' +
          '<ul class="iexp-bullets">' +
            '<li>Deckblatt mit Hauptkennzahlen + Foto</li>' +
            '<li>Cashflow heute · Ende Zinsbindung · Anschluss</li>' +
            '<li>Charts (Cashflow, Wertverlauf, Equity-Schere)</li>' +
            '<li>Vermögensaufbau, KI-Analyse, Annahmen</li>' +
          '</ul>' +
          '<div class="iexp-card-cta">Objekt wählen <span>›</span></div>' +
        '</div>' +

        // V118: JSON-Sicherung mit Auswahl pro Objekt oder alle
        '<div class="iexp-card" onclick="iexpExportJsonChoose()">' +
          '<div class="iexp-card-ico iexp-ico-gold">' + _icon('download', 22) + '</div>' +
          '<div class="iexp-card-tag">Sicherung · einzeln oder alle</div>' +
          '<h3>JSON-Sicherung</h3>' +
          '<p>Exportiere <b>ein einzelnes Objekt</b> oder <b>alle</b> als JSON-Backup. ' +
          'Empfohlen vor jedem App-Update als Sicherheits-Backup.</p>' +
          '<ul class="iexp-bullets">' +
            '<li>Komplette Eingaben + Berechnungen</li>' +
            '<li>KI-Analysen, Sterne, Bemerkungen</li>' +
            '<li>Objektfotos (Base64 eingebettet)</li>' +
          '</ul>' +
          '<p class="iexp-warn">⚠ Datei ist nicht verschlüsselt — sicher aufbewahren.</p>' +
          '<div class="iexp-card-cta">Auswahl ‹ einzeln / alle › <span>›</span></div>' +
        '</div>' +

        // V118: Excel-Export mit Auswahl pro Objekt oder alle
        '<div class="iexp-card" onclick="iexpExportExcelChoose()">' +
          '<div class="iexp-card-ico iexp-ico-green">' + _icon('download', 22) + '</div>' +
          '<div class="iexp-card-tag">Excel · einzeln oder alle</div>' +
          '<h3>Excel-Export</h3>' +
          '<p>Exportiere <b>ein einzelnes Objekt</b> oder <b>alle</b> als Excel-Tabelle. ' +
          'Direkt in Excel-DE öffenbar.</p>' +
          '<ul class="iexp-bullets">' +
            '<li>Eine Zeile pro Objekt mit allen Kennzahlen</li>' +
            '<li>Adresse, Cashflow, DealScore, Finanzierung</li>' +
            '<li>Für Portfolio-Analysen &amp; Bankgespräche</li>' +
          '</ul>' +
          '<div class="iexp-card-cta">Auswahl ‹ einzeln / alle › <span>›</span></div>' +
        '</div>' +

      '</div>'
    );
  }

  window.openExportHub = function() {
    _modalShell(
      'Daten exportieren',
      'PDF-Report für ein Objekt erstellen, Backup ziehen oder Portfolio nach Excel exportieren.',
      _renderExportCards()
    );
  };

  // ── PDF-Export mit Objekt-Auswahl ─────────────────────────────────
  window.iexpExportPdf = async function() {
    var bodyEl = document.getElementById('iexp-body');
    if (!bodyEl) return;
    bodyEl.innerHTML = '<div class="iexp-loading">Lade Objektliste…</div>';

    var objects = [];
    try {
      if (typeof getAllObjectsData === 'function') {
        objects = await getAllObjectsData();
      }
    } catch (e) {
      bodyEl.innerHTML = '<p class="iexp-empty">⚠ Objekte konnten nicht geladen werden.</p>';
      return;
    }

    // Aktuelles Objekt zuerst (wenn geladen)
    var currentKey = window._currentObjKey;
    objects.sort(function(a, b) {
      if (a.id === currentKey) return -1;
      if (b.id === currentKey) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    if (!objects.length) {
      bodyEl.innerHTML =
        '<div class="iexp-back" onclick="openExportHub()">‹ Zurück</div>' +
        '<p class="iexp-empty">Noch keine gespeicherten Objekte vorhanden.<br>' +
        'Lege zuerst ein Objekt an und speichere es, bevor du einen PDF-Report erstellst.</p>';
      return;
    }

    var listHtml = objects.map(function(o) {
      var k = (o.kpis || {});
      var isCurrent = (o.id === currentKey);
      var name = o.name || (o.data && (o.data.str || o.data.kuerzel)) || 'Unbenannt';
      var sub = [
        (o.data && o.data.str) ? (o.data.str + ' ' + (o.data.hnr || '')) : '',
        (o.data && o.data.ort) ? o.data.ort : ''
      ].filter(Boolean).join(', ');
      var kpiLine = [
        k.kp ? (Math.round(k.kp).toLocaleString('de-DE') + ' € KP') : '',
        k.bmr ? (k.bmr.toFixed(2).replace('.', ',') + ' % BMR') : ''
      ].filter(Boolean).join(' · ');

      return (
        '<div class="iexp-obj-row' + (isCurrent ? ' iexp-obj-current' : '') + '" ' +
             'onclick="iexpDoExportPdf(' + JSON.stringify(o.id).replace(/"/g, '&quot;') + ')">' +
          '<div class="iexp-obj-info">' +
            '<div class="iexp-obj-name">' + _escape(name) +
              (isCurrent ? ' <span class="iexp-obj-badge">aktuell geladen</span>' : '') +
            '</div>' +
            (sub ? '<div class="iexp-obj-sub">' + _escape(sub) + '</div>' : '') +
            (kpiLine ? '<div class="iexp-obj-kpi">' + _escape(kpiLine) + '</div>' : '') +
          '</div>' +
          '<div class="iexp-obj-arrow">›</div>' +
        '</div>'
      );
    }).join('');

    bodyEl.innerHTML =
      '<div class="iexp-back" onclick="openExportHub()">‹ Zurück</div>' +
      '<h3 class="iexp-stage-title">Welches Objekt soll als PDF exportiert werden?</h3>' +
      '<p class="iexp-stage-sub">Klicke auf ein Objekt — der PDF-Report wird sofort generiert.</p>' +
      '<div class="iexp-obj-list">' + listHtml + '</div>';
  };

  function _escape(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.iexpDoExportPdf = async function(objId) {
    var currentKey = window._currentObjKey;
    closeIexpModal();
    try {
      // Objekt laden, wenn nicht bereits aktiv
      if (objId !== currentKey) {
        if (typeof toast === 'function') toast('⏳ Lade Objekt…');
        if (typeof loadSaved === 'function') {
          await loadSaved(objId);
          // Kurz warten bis State aktualisiert ist
          await new Promise(function(r) { setTimeout(r, 250); });
        }
      }
      if (typeof exportPDF === 'function') {
        await exportPDF();
      }
    } catch (e) {
      if (typeof toast === 'function') toast('⚠ PDF-Export-Fehler: ' + e.message);
    }
  };

  window.iexpExportJson = function() {
    closeIexpModal();
    if (typeof exportAllObjectsJson === 'function') exportAllObjectsJson();
    else if (typeof exportAllJSON === 'function') exportAllJSON();
  };

  window.iexpExportCsvAll = function() {
    closeIexpModal();
    if (typeof exportCSV === 'function') exportCSV();
  };

  // ── V118: JSON-Export mit Objekt-Auswahl ─────────────────────────────
  window.iexpExportJsonChoose = function() {
    var bodyEl = document.getElementById('iexp-body');
    if (!bodyEl) return;
    bodyEl.innerHTML =
      '<div class="iexp-back" onclick="openExportHub()">‹ Zurück</div>' +
      '<h3 class="iexp-stage-title">Welche Objekte sollen gesichert werden?</h3>' +
      '<p class="iexp-stage-sub">Wähle, ob du <b>alle Objekte</b> sichern möchtest oder ein einzelnes auswählst.</p>' +
      '<div class="iexp-choice-row">' +
        '<button class="iexp-choice-btn" onclick="iexpDoExportJsonAll()">' +
          '<span class="iexp-choice-ico">' + _icon('download', 24) + '</span>' +
          '<span class="iexp-choice-l">Alle Objekte sichern</span>' +
          '<span class="iexp-choice-d">Komplettes JSON-Backup</span>' +
        '</button>' +
        '<button class="iexp-choice-btn" onclick="iexpExportJsonSingle()">' +
          '<span class="iexp-choice-ico">' + _icon('fileText', 24) + '</span>' +
          '<span class="iexp-choice-l">Einzelnes Objekt sichern</span>' +
          '<span class="iexp-choice-d">Auswahl aus Liste</span>' +
        '</button>' +
      '</div>';
  };

  window.iexpDoExportJsonAll = function() {
    closeIexpModal();
    if (typeof exportAllObjectsJson === 'function') exportAllObjectsJson();
    else if (typeof exportAllJSON === 'function') exportAllJSON();
  };

  window.iexpExportJsonSingle = async function() {
    var bodyEl = document.getElementById('iexp-body');
    if (!bodyEl) return;
    bodyEl.innerHTML = '<div class="iexp-loading">Lade Objektliste…</div>';

    var objects = [];
    try {
      if (typeof getAllObjectsData === 'function') {
        objects = await getAllObjectsData();
      }
    } catch (e) {
      bodyEl.innerHTML = '<p class="iexp-empty">⚠ Objekte konnten nicht geladen werden.</p>';
      return;
    }

    var currentKey = window._currentObjKey;
    objects.sort(function(a, b) {
      if (a.id === currentKey) return -1;
      if (b.id === currentKey) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    if (!objects.length) {
      bodyEl.innerHTML =
        '<div class="iexp-back" onclick="iexpExportJsonChoose()">‹ Zurück</div>' +
        '<p class="iexp-empty">Noch keine gespeicherten Objekte vorhanden.</p>';
      return;
    }

    var listHtml = objects.map(function(o) {
      var k = (o.kpis || {});
      var isCurrent = (o.id === currentKey);
      var name = o.name || (o.data && (o.data.str || o.data.kuerzel)) || 'Unbenannt';
      var sub = [
        (o.data && o.data.str) ? (o.data.str + ' ' + (o.data.hnr || '')) : '',
        (o.data && o.data.ort) ? o.data.ort : ''
      ].filter(Boolean).join(', ');
      var kpiLine = [
        k.kp ? (Math.round(k.kp).toLocaleString('de-DE') + ' € KP') : '',
        k.bmr ? (k.bmr.toFixed(2).replace('.', ',') + ' % BMR') : ''
      ].filter(Boolean).join(' · ');
      return (
        '<div class="iexp-obj-row' + (isCurrent ? ' iexp-obj-current' : '') + '" ' +
             'onclick="iexpDoExportJsonSingle(' + JSON.stringify(o.id).replace(/"/g, '&quot;') + ')">' +
          '<div class="iexp-obj-info">' +
            '<div class="iexp-obj-name">' + _escape(name) +
              (isCurrent ? ' <span class="iexp-obj-badge">aktuell geladen</span>' : '') +
            '</div>' +
            (sub ? '<div class="iexp-obj-sub">' + _escape(sub) + '</div>' : '') +
            (kpiLine ? '<div class="iexp-obj-kpi">' + _escape(kpiLine) + '</div>' : '') +
          '</div>' +
          '<div class="iexp-obj-arrow">›</div>' +
        '</div>'
      );
    }).join('');

    bodyEl.innerHTML =
      '<div class="iexp-back" onclick="iexpExportJsonChoose()">‹ Zurück</div>' +
      '<h3 class="iexp-stage-title">Welches Objekt sichern?</h3>' +
      '<p class="iexp-stage-sub">Klicke auf ein Objekt — die JSON-Datei wird sofort generiert.</p>' +
      '<div class="iexp-obj-list">' + listHtml + '</div>';
  };

  window.iexpDoExportJsonSingle = async function(objId) {
    closeIexpModal();
    if (typeof exportSingleObjectJson === 'function') {
      try { await exportSingleObjectJson(objId); }
      catch (e) { if (typeof toast === 'function') toast('⚠ JSON-Export-Fehler: ' + e.message); }
    }
  };

  // ── V118: Excel-Export mit Objekt-Auswahl ────────────────────────────
  window.iexpExportExcelChoose = function() {
    var bodyEl = document.getElementById('iexp-body');
    if (!bodyEl) return;
    bodyEl.innerHTML =
      '<div class="iexp-back" onclick="openExportHub()">‹ Zurück</div>' +
      '<h3 class="iexp-stage-title">Excel-Export — welche Objekte?</h3>' +
      '<p class="iexp-stage-sub">Wähle, ob du <b>alle Objekte</b> als Tabelle exportieren möchtest oder ein einzelnes.</p>' +
      '<div class="iexp-choice-row">' +
        '<button class="iexp-choice-btn" onclick="iexpDoExportExcelAll()">' +
          '<span class="iexp-choice-ico">' + _icon('download', 24) + '</span>' +
          '<span class="iexp-choice-l">Alle Objekte exportieren</span>' +
          '<span class="iexp-choice-d">Eine Zeile pro Objekt</span>' +
        '</button>' +
        '<button class="iexp-choice-btn" onclick="iexpExportExcelSingle()">' +
          '<span class="iexp-choice-ico">' + _icon('fileText', 24) + '</span>' +
          '<span class="iexp-choice-l">Einzelnes Objekt exportieren</span>' +
          '<span class="iexp-choice-d">Auswahl aus Liste</span>' +
        '</button>' +
      '</div>';
  };

  window.iexpDoExportExcelAll = function() {
    closeIexpModal();
    if (typeof exportAllObjectsExcel === 'function') exportAllObjectsExcel();
    else if (typeof exportCSV === 'function') exportCSV();
  };

  window.iexpExportExcelSingle = async function() {
    var bodyEl = document.getElementById('iexp-body');
    if (!bodyEl) return;
    bodyEl.innerHTML = '<div class="iexp-loading">Lade Objektliste…</div>';

    var objects = [];
    try {
      if (typeof getAllObjectsData === 'function') {
        objects = await getAllObjectsData();
      }
    } catch (e) {
      bodyEl.innerHTML = '<p class="iexp-empty">⚠ Objekte konnten nicht geladen werden.</p>';
      return;
    }

    var currentKey = window._currentObjKey;
    objects.sort(function(a, b) {
      if (a.id === currentKey) return -1;
      if (b.id === currentKey) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    if (!objects.length) {
      bodyEl.innerHTML =
        '<div class="iexp-back" onclick="iexpExportExcelChoose()">‹ Zurück</div>' +
        '<p class="iexp-empty">Noch keine gespeicherten Objekte vorhanden.</p>';
      return;
    }

    var listHtml = objects.map(function(o) {
      var k = (o.kpis || {});
      var isCurrent = (o.id === currentKey);
      var name = o.name || (o.data && (o.data.str || o.data.kuerzel)) || 'Unbenannt';
      var sub = [
        (o.data && o.data.str) ? (o.data.str + ' ' + (o.data.hnr || '')) : '',
        (o.data && o.data.ort) ? o.data.ort : ''
      ].filter(Boolean).join(', ');
      var kpiLine = [
        k.kp ? (Math.round(k.kp).toLocaleString('de-DE') + ' € KP') : '',
        k.bmr ? (k.bmr.toFixed(2).replace('.', ',') + ' % BMR') : ''
      ].filter(Boolean).join(' · ');
      return (
        '<div class="iexp-obj-row' + (isCurrent ? ' iexp-obj-current' : '') + '" ' +
             'onclick="iexpDoExportExcelSingle(' + JSON.stringify(o.id).replace(/"/g, '&quot;') + ')">' +
          '<div class="iexp-obj-info">' +
            '<div class="iexp-obj-name">' + _escape(name) +
              (isCurrent ? ' <span class="iexp-obj-badge">aktuell geladen</span>' : '') +
            '</div>' +
            (sub ? '<div class="iexp-obj-sub">' + _escape(sub) + '</div>' : '') +
            (kpiLine ? '<div class="iexp-obj-kpi">' + _escape(kpiLine) + '</div>' : '') +
          '</div>' +
          '<div class="iexp-obj-arrow">›</div>' +
        '</div>'
      );
    }).join('');

    bodyEl.innerHTML =
      '<div class="iexp-back" onclick="iexpExportExcelChoose()">‹ Zurück</div>' +
      '<h3 class="iexp-stage-title">Welches Objekt exportieren?</h3>' +
      '<p class="iexp-stage-sub">Klicke auf ein Objekt — die Excel-Datei wird sofort generiert.</p>' +
      '<div class="iexp-obj-list">' + listHtml + '</div>';
  };

  window.iexpDoExportExcelSingle = async function(objId) {
    closeIexpModal();
    if (typeof exportSingleObjectExcel === 'function') {
      try { await exportSingleObjectExcel(objId); }
      catch (e) { if (typeof toast === 'function') toast('⚠ Excel-Export-Fehler: ' + e.message); }
    }
  };

})();
