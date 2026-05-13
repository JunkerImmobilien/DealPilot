'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V56 — Workflow-System
   
   Zwei Modi um den User durch die App zu führen:
   
   1. WIZARD (Vollbild-Stepper)
      Modal-Overlay mit 5 (einfach) oder 9 (detailliert) Steps.
      User klickt sich durch, am Ende wird alles in die Tabs übernommen.
   
   2. TAB-WORKFLOW (Progress-Bar)
      Tabs bleiben sichtbar, aber oben ist eine Fortschritts-Anzeige
      "3 / 8 Tabs ausgefüllt". Pro Tab gibt's einen "Weiter"-Button
      der zum nächsten relevanten Tab springt.
   
   Beide Modi nutzen dieselbe Pflichtfeld-Definition.
   
   Aktivierung: über Settings → "Workflow-Assistent"
═══════════════════════════════════════════════════════════════ */

window.DealPilotWorkflow = (function() {

  // ───────────── Pflichtfelder pro Tab ─────────────
  // (Ein Tab gilt als "ausgefüllt" wenn ALLE Pflichtfelder gefüllt sind.)
  // Modi: 'einfach' = nur essentielle Felder, 'detailliert' = alle Felder

  // V63.29: Pflichtfelder so kalibriert, dass nach "Als Objekt speichern" aus dem
  // Quick-Check ALLE Tabs grün sind, sofern qcSaveAsObject die Felder befüllt.
  var FIELD_GROUPS = {
    objekt: {
      name: 'Objekt',
      tabIndex: 1,
      einfach: ['ort', 'wfl', 'baujahr', 'objart'],
      detailliert: ['plz', 'ort', 'str', 'hnr', 'wfl', 'baujahr', 'objart', 'kaufdat', 'makrolage', 'mikrolage']
    },
    investition: {
      name: 'Investition',
      tabIndex: 2,
      einfach: ['kp'],
      detailliert: ['kp', 'notar_p', 'gest_p', 'ji_p']
    },
    miete: {
      name: 'Miete',
      tabIndex: 3,
      einfach: ['nkm'],
      detailliert: ['nkm', 'ze']
    },
    finanzierung: {
      name: 'Finanzierung',
      tabIndex: 5,
      einfach: ['ek', 'd1', 'd1z', 'd1t'],
      detailliert: ['ek', 'd1', 'd1z', 'd1t']
    },
    bewirtschaftung: {
      name: 'Bewirtschaftung',
      tabIndex: 6,
      einfach: ['hg_ul'],
      detailliert: ['hg_ul', 'hg_nul', 'verwaltung', 'grundsteuer']
    },
    steuer: {
      name: 'Steuer',
      tabIndex: 4,
      // V63.29: Steuer-Tab gilt als ausgefüllt wenn 'grenz' (Grenzsteuersatz) gesetzt ist —
      // hat einen Default-Wert (42 %) der schon beim Init steht. Vorher 'zve' das nie befüllt wurde.
      einfach: ['grenz'],
      detailliert: ['grenz']
    }
  };

  function _getCurrentMode() {
    try {
      var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
      return s.workflow_detail_level || 'einfach';
    } catch(e) { return 'einfach'; }
  }

  function _isFieldFilled(id) {
    var e = document.getElementById(id);
    if (!e) return false;   // V63.47: Feld nicht im DOM → NICHT als ausgefüllt zählen
    var v = (e.value || '').trim();
    if (v === '') return false;
    return true;
  }

  // V63.47: Erkennt ob das Objekt "leer" ist (frischer App-Start oder neues Objekt).
  // Solange kein einziges der Kern-Identitätsfelder gefüllt ist, gilt KEINE Gruppe als
  // complete — auch nicht solche mit Default-Werten (Steuer/grenz=42%).
  function _isObjectEmpty() {
    var coreFields = ['ort', 'str', 'kp', 'nkm', 'd1', 'wfl'];
    return coreFields.every(function(id) {
      var e = document.getElementById(id);
      if (!e) return true;
      return (e.value || '').trim() === '';
    });
  }

  function _isGroupComplete(groupKey) {
    var g = FIELD_GROUPS[groupKey];
    if (!g) return false;
    // V63.47: Bei leerem Objekt zählt nichts als complete (auch nicht Default-Werte)
    if (_isObjectEmpty()) return false;
    var fields = g[_getCurrentMode()] || g.einfach;
    return fields.every(_isFieldFilled);
  }

  function _getCompletionStatus() {
    var keys = Object.keys(FIELD_GROUPS);
    var complete = keys.filter(_isGroupComplete);
    return {
      total: keys.length,
      complete: complete.length,
      groups: keys.map(function(k) {
        return {
          key: k,
          name: FIELD_GROUPS[k].name,
          tabIndex: FIELD_GROUPS[k].tabIndex,
          complete: _isGroupComplete(k),
          missingFields: (FIELD_GROUPS[k][_getCurrentMode()] || []).filter(function(id) {
            return !_isFieldFilled(id);
          })
        };
      })
    };
  }

  // ───────────── Modus B: Tab-Workflow ─────────────
  // Render Progress-Bar oberhalb der Tabs

  function renderProgressBar() {
    var status = _getCompletionStatus();
    var pct = Math.round(status.complete / status.total * 100);

    // V62.2: Update auch die NEUE Tab-Workflow-Bar (#wf-progress-fill, #wf-progress-pct)
    var fillEl = document.getElementById('wf-progress-fill');
    var pctEl = document.getElementById('wf-progress-pct');
    if (fillEl) fillEl.style.width = pct + '%';
    if (pctEl) {
      var label = status.complete + ' / ' + status.total + ' Bereiche · ' + pct + ' %';
      if (pct >= 100) label += ' — einfache Bewertung möglich';
      else if (pct >= 60) label += ' · weitere Felder erhöhen Genauigkeit';
      pctEl.textContent = label;
    }

    // V75: Status-Badge in der Tab-Bar (rechts) befüllen
    var statusFill = document.getElementById('tabs-status-fill');
    var statusText = document.getElementById('tabs-status-text');
    var statusBadge = document.getElementById('tabs-status-badge');
    if (statusFill) statusFill.style.width = pct + '%';
    if (statusText) {
      // V75: kompakter Text — passt in die Tab-Bar
      statusText.textContent = status.complete + ' / ' + status.total + ' · ' + pct + ' %';
    }
    if (statusBadge) {
      statusBadge.classList.toggle('tabs-status-done', pct >= 100);
      statusBadge.title = pct >= 100
        ? 'Alle ' + status.total + ' Bereiche vollständig — einfache Bewertung möglich'
        : status.complete + ' von ' + status.total + ' Bereichen vollständig (' + pct + ' %)';
    }

    // V75: Häkchen direkt an die Tabs hängen (statt separate Workflow-Steps).
    // Mapping per data-wf-key (im HTML gesetzt): objekt/investition/miete/steuer/finanzierung/bewirtschaftung
    try {
      var byKey = {};
      status.groups.forEach(function(g) {
        // g.key kommt aus FIELD_GROUPS-Schlüssel (objekt, investition, ...)
        if (g.key) byKey[g.key] = g.complete;
      });
      document.querySelectorAll('.tab[data-wf-key]').forEach(function(tab) {
        var k = tab.getAttribute('data-wf-key');
        var done = !!byKey[k];
        tab.classList.toggle('tab-wf-done', done);
        // Bestehendes Häkchen entfernen, neu setzen
        var oldCheck = tab.querySelector('.tab-wf-check');
        if (oldCheck) oldCheck.remove();
        if (done) {
          var check = document.createElement('span');
          check.className = 'tab-wf-check';
          check.setAttribute('aria-hidden', 'true');
          check.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
          tab.appendChild(check);
        }
      });
    } catch (e) {}

    // V62.2: Step-Indikatoren in #wf-tab-steps (sichtbar im Header der Tabs)
    var stepsEl = document.getElementById('wf-tab-steps');
    if (stepsEl) {
      stepsEl.innerHTML = status.groups.map(function(g, i) {
        var stateCls = g.complete ? 'wf-tstep-done' : 'wf-tstep-todo';
        return '<button type="button" class="wf-tstep ' + stateCls + '" data-tab="' + g.tabIndex + '" title="' +
               (g.complete ? 'Vollständig' : 'Noch ausfüllen: ' + (g.missingFields.join(', ') || 'alle')) + '">' +
               '<span class="wf-tstep-num">' + (i+1) + '</span>' +
               '<span class="wf-tstep-name">' + g.name + '</span>' +
               (g.complete ? '<span class="wf-tstep-check">✓</span>' : '') +
               '</button>';
      }).join('');
      stepsEl.querySelectorAll('.wf-tstep').forEach(function(btn) {
        btn.onclick = function() {
          var idx = parseInt(btn.dataset.tab);
          if (typeof switchTab === 'function') switchTab(idx);
        };
      });
    }

    // Falls auch die alte #workflow-progress noch da ist (Backwards-Compat) — auch befüllen
    var container = document.getElementById('workflow-progress');
    if (!container) return;

    container.innerHTML =
      '<div class="wf-progress-row">' +
        '<div class="wf-progress-bar"><div class="wf-progress-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="wf-progress-text">' + status.complete + ' / ' + status.total + ' Bereiche</div>' +
      '</div>' +
      '<div class="wf-progress-steps">' +
        status.groups.map(function(g, i) {
          var stateCls = g.complete ? 'wf-step-done' : (i === 0 ? 'wf-step-current' : 'wf-step-todo');
          return '<button type="button" class="wf-step ' + stateCls + '" data-tab="' + g.tabIndex + '" title="' +
                 (g.complete ? 'Vollständig' : 'Noch ausfüllen: ' + (g.missingFields.join(', ') || 'alle')) + '">' +
                 '<span class="wf-step-num">' + (i+1) + '</span>' +
                 '<span class="wf-step-name">' + g.name + '</span>' +
                 (g.complete ? '<span class="wf-step-check">✓</span>' : '') +
                 '</button>';
        }).join('') +
      '</div>';

    // Click-Handler: zum entsprechenden Tab springen
    container.querySelectorAll('.wf-step').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(btn.dataset.tab);
        if (typeof switchTab === 'function') switchTab(idx);
      });
    });
  }

  // ───────────── Modus A: Wizard (Vollbild-Stepper) ─────────────

  var WIZARD_STEPS_EINFACH = [
    {
      title: 'Wo liegt das Objekt?',
      sub: 'Damit die KI später die Lage analysieren kann, brauchen wir die Adresse.',
      fields: [
        { id: 'plz', label: 'PLZ', type: 'text', placeholder: '32052' },
        { id: 'ort', label: 'Ort', type: 'text', placeholder: 'Herford', required: true },
        { id: 'str', label: 'Straße', type: 'text', placeholder: 'Dresdenstraße' },
        { id: 'hnr', label: 'Hausnummer', type: 'text', placeholder: '116' }
      ]
    },
    {
      title: 'Was für ein Objekt ist es?',
      sub: 'Grunddaten zum Objekt — Wohnfläche, Baujahr, Objektart.',
      fields: [
        { id: 'objart', label: 'Objektart', type: 'select', required: true,
          options: ['ETW', 'EFH', 'MFH', 'Gewerbe'] },
        { id: 'wfl', label: 'Wohnfläche (m²)', type: 'number', placeholder: '96', required: true },
        { id: 'baujahr', label: 'Baujahr', type: 'number', placeholder: '1997', required: true }
      ]
    },
    {
      title: 'Was kostet das Objekt?',
      sub: 'Kaufpreis und Mieteinnahmen — die wichtigsten Zahlen für die Renditeberechnung.',
      fields: [
        { id: 'kp', label: 'Kaufpreis (€)', type: 'number', placeholder: '180000', required: true },
        { id: 'nkm', label: 'Nettokaltmiete / Monat (€)', type: 'number', placeholder: '850', required: true }
      ]
    },
    {
      title: 'Wie wird finanziert?',
      sub: 'Eigenkapital, Darlehen, Zins, Tilgung — die Bank-Konditionen.',
      fields: [
        { id: 'ek', label: 'Eigenkapital (€)', type: 'number', placeholder: '20000', required: true },
        { id: 'd1', label: 'Darlehen (€)', type: 'number', placeholder: '180000', required: true },
        { id: 'd1z', label: 'Zinssatz (%)', type: 'number', placeholder: '3.8', required: true },
        { id: 'd1t', label: 'Tilgung (%)', type: 'number', placeholder: '2.0', required: true }
      ]
    },
    {
      title: 'Bewirtschaftung & Steuer',
      sub: 'Hausgeld + zu versteuerndes Einkommen für die Steuerprognose.',
      fields: [
        { id: 'hg_ul', label: 'Hausgeld umlagefähig / Jahr (€)', type: 'number', placeholder: '1391' },
        { id: 'hg_nul', label: 'Hausgeld nicht-umlagefähig / Jahr (€)', type: 'number', placeholder: '1539' },
        { id: 'zve', label: 'Zu versteuerndes Einkommen (€/Jahr)', type: 'number', placeholder: '60000', required: true }
      ]
    }
  ];

  var _wizardCurrentStep = 0;

  function startWizard() {
    _wizardCurrentStep = 0;
    var ov = document.getElementById('wizard-overlay');
    if (ov) ov.remove();

    ov = document.createElement('div');
    ov.id = 'wizard-overlay';
    ov.className = 'wizard-overlay';
    ov.innerHTML = '<div class="wizard-modal" id="wizard-modal"></div>';
    document.body.appendChild(ov);

    _renderWizardStep();
  }

  function _renderWizardStep() {
    var modal = document.getElementById('wizard-modal');
    if (!modal) return;
    var step = WIZARD_STEPS_EINFACH[_wizardCurrentStep];
    var totalSteps = WIZARD_STEPS_EINFACH.length;
    var pct = Math.round((_wizardCurrentStep + 1) / totalSteps * 100);

    var fieldsHtml = step.fields.map(function(f) {
      var current = (document.getElementById(f.id) || {}).value || '';
      var requiredMark = f.required ? '<span class="wf-req">*</span>' : '';
      var input;
      if (f.type === 'select') {
        var opts = f.options.map(function(o) {
          return '<option value="' + o + '"' + (current === o ? ' selected' : '') + '>' + o + '</option>';
        }).join('');
        input = '<select class="wf-input" data-target="' + f.id + '"><option value="">– bitte wählen –</option>' + opts + '</select>';
      } else {
        input = '<input type="' + (f.type === 'number' ? 'text' : f.type) + '"' +
                ' inputmode="' + (f.type === 'number' ? 'decimal' : 'text') + '"' +
                ' class="wf-input" data-target="' + f.id + '"' +
                ' placeholder="' + (f.placeholder || '') + '"' +
                ' value="' + current + '">';
      }
      return '<div class="wf-field">' +
               '<label>' + f.label + ' ' + requiredMark + '</label>' +
               input +
             '</div>';
    }).join('');

    modal.innerHTML =
      '<div class="wizard-header">' +
        '<div class="wizard-progress">' +
          '<div class="wizard-progress-bar"><div class="wizard-progress-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="wizard-progress-text">Schritt ' + (_wizardCurrentStep + 1) + ' von ' + totalSteps + '</div>' +
        '</div>' +
        '<button class="wizard-close" type="button" onclick="DealPilotWorkflow.closeWizard()">×</button>' +
      '</div>' +
      '<div class="wizard-body">' +
        '<h2 class="wizard-title">' + step.title + '</h2>' +
        '<p class="wizard-sub">' + step.sub + '</p>' +
        '<div class="wf-fields">' + fieldsHtml + '</div>' +
      '</div>' +
      '<div class="wizard-footer">' +
        (_wizardCurrentStep > 0 ? '<button class="btn btn-outline" type="button" onclick="DealPilotWorkflow.prevWizardStep()">← Zurück</button>' : '<div></div>') +
        '<div style="flex:1"></div>' +
        (_wizardCurrentStep < totalSteps - 1 ?
          '<button class="btn btn-gold" type="button" onclick="DealPilotWorkflow.nextWizardStep()">Weiter →</button>' :
          '<button class="btn btn-gold" type="button" onclick="DealPilotWorkflow.finishWizard()">✓ Fertigstellen</button>') +
      '</div>';
  }

  function _saveCurrentStepValues() {
    var modal = document.getElementById('wizard-modal');
    if (!modal) return;
    modal.querySelectorAll('.wf-input[data-target]').forEach(function(inp) {
      var target = document.getElementById(inp.dataset.target);
      if (target) {
        target.value = inp.value;
        target.classList.remove('dp-example-placeholder');
      }
    });
  }

  function nextWizardStep() {
    _saveCurrentStepValues();
    _wizardCurrentStep++;
    _renderWizardStep();
  }

  function prevWizardStep() {
    _saveCurrentStepValues();
    _wizardCurrentStep--;
    _renderWizardStep();
  }

  function finishWizard() {
    _saveCurrentStepValues();
    closeWizard();
    if (typeof calc === 'function') calc();
    if (typeof toast === 'function') toast('✓ Wizard abgeschlossen — alle Werte sind in den Tabs übernommen.');
    if (typeof switchTab === 'function') switchTab(7); // V63.76: Springe zu Kennzahlen (Tab 7 nach Quick-Check-Refactor)
  }

  function closeWizard() {
    var ov = document.getElementById('wizard-overlay');
    if (ov) ov.remove();
  }

  // ───────────── Public API ─────────────
  return {
    renderProgressBar: renderProgressBar,
    startWizard: startWizard,
    closeWizard: closeWizard,
    nextWizardStep: nextWizardStep,
    prevWizardStep: prevWizardStep,
    finishWizard: finishWizard,
    getStatus: _getCompletionStatus
  };
})();

// Auto-Update Progress-Bar bei jedem Calc-Run
(function() {
  function _initWorkflowAutoUpdate() {
    DealPilotWorkflow.renderProgressBar();
    document.addEventListener('input', function(e) {
      if (e.target && e.target.id) {
        setTimeout(DealPilotWorkflow.renderProgressBar, 100);
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _initWorkflowAutoUpdate);
  } else {
    // DOM schon ready — direkt initialisieren
    setTimeout(_initWorkflowAutoUpdate, 50);
  }
})();
