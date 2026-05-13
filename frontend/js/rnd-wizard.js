/**
 * DealPilot — Restnutzungsdauer-Wizard V3
 * =========================================
 * 8-Schritt-Wizard zur strukturierten Daten-Erfassung für ein RND-Gutachten,
 * inspiriert vom Original-Wizard auf dergutachter.net.
 *
 * Verwendung:
 *   DealPilotRND_Wizard.open({
 *     prefill: { ... }                      // optional, z.B. aus DealPilot-JSON
 *     onComplete: function (gutachtenState) {
 *       DealPilotRND_UI.mount(target, gutachtenState);
 *     }
 *   });
 *
 * Modal-Overlay über die ganze Seite, schließbar mit Escape oder X-Button.
 */
(function (global) {
  'use strict';

  let currentStep = 1;
  const TOTAL_STEPS = 9;
  let state = null;
  let onCompleteCb = null;
  let overlayEl = null;

  // ============================================================
  // STEP-DEFINITIONEN
  // ============================================================
  const STEPS = [
    { num: 1, title: 'Objekt-Basis',
      sub: 'Welche Immobilie soll bewertet werden?', render: renderStep1,
      validate: function () {
        const e = [];
        if (!state.objekt_typ) e.push(['objekt_typ', 'Bitte Objekttyp wählen']);
        if (!state.str || !state.str.trim()) e.push(['str', 'Straße fehlt']);
        if (!state.hnr || !String(state.hnr).trim()) e.push(['hnr', 'Hausnr. fehlt']);
        if (!state.plz || !String(state.plz).trim()) e.push(['plz', 'PLZ fehlt']);
        if (!state.ort || !state.ort.trim()) e.push(['ort', 'Ort fehlt']);
        const bj = parseInt(state.baujahr, 10);
        if (!bj || bj < 1800 || bj > new Date().getFullYear())
          e.push(['baujahr', 'Bitte Baujahr eingeben (1800–heute)']);
        if (!state.wohnflaeche || parseFloat(String(state.wohnflaeche).replace(',', '.')) <= 0)
          e.push(['wohnflaeche', 'Wohnfläche fehlt']);
        return e;
      } },
    { num: 2, title: 'Auftraggeber & Stichtag',
      sub: 'Wer beauftragt das Gutachten?', render: renderStep2,
      validate: function () {
        const e = [];
        if (!state.auftraggeber_name || !state.auftraggeber_name.trim())
          e.push(['auftraggeber_name', 'Name des Auftraggebers fehlt']);
        if (!state.auftraggeber_strasse || !state.auftraggeber_strasse.trim())
          e.push(['auftraggeber_strasse', 'Adresse des Auftraggebers fehlt']);
        if (!state.auftraggeber_plz || !String(state.auftraggeber_plz).trim())
          e.push(['auftraggeber_plz', 'PLZ fehlt']);
        if (!state.auftraggeber_ort || !state.auftraggeber_ort.trim())
          e.push(['auftraggeber_ort', 'Ort fehlt']);
        if (!state.stichtag) e.push(['stichtag', 'Bewertungsstichtag fehlt']);
        if (state.eigentuemer_abweichend) {
          if (!state.eigentuemer_name || !state.eigentuemer_name.trim())
            e.push(['eigentuemer_name', 'Name des Eigentümers fehlt']);
        }
        return e;
      } },
    { num: 3, title: 'Bauliche Anlagen',
      sub: 'Aufbau und Konstruktion des Gebäudes', render: renderStep3,
      validate: function () {
        const e = [];
        if (!state.bedachung) e.push(['bedachung', 'Bedachung wählen']);
        if (!state.fenster) e.push(['fenster', 'Fenstertyp wählen']);
        if (!state.heizungsart) e.push(['heizungsart', 'Heizungsart wählen']);
        return e;
      } },
    { num: 4, title: 'Gebäudetechnik',
      sub: 'Heizung, Energie, Erschließung', render: renderStep4,
      validate: function () {
        const e = [];
        if (!state.brennstoff) e.push(['brennstoff', 'Energieträger wählen']);
        if (!state.warmwasser) e.push(['warmwasser', 'Warmwasserbereitung wählen']);
        return e;
      } },
    { num: 5, title: 'Modernisierungen',
      sub: 'Welche Modernisierungen wurden durchgeführt?', render: renderStep5,
      validate: function () { return []; } /* alles vorbefüllt */ },
    { num: 6, title: 'Zustand der Gewerke',
      sub: 'Wie ist der aktuelle Zustand jedes Gewerks?', render: renderStep6,
      validate: function () { return []; } /* alles vorbefüllt */ },
    { num: 7, title: 'Schäden & Mängel',
      sub: 'Erfassen Sie sichtbare Mängel (optional)', render: renderStep7,
      validate: function () { return []; } /* optional */ },
    { num: 8, title: 'Sachverständiger',
      sub: 'Wer erstellt das Gutachten?', render: renderStep8,
      validate: function () {
        const e = [];
        if (!state.sv_name || !state.sv_name.trim())
          e.push(['sv_name', 'Name des Sachverständigen fehlt']);
        if (!state.sv_email || !state.sv_email.trim())
          e.push(['sv_email', 'E-Mail ist erforderlich für den Versand']);
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.sv_email))
          e.push(['sv_email', 'Bitte gültige E-Mail-Adresse eingeben']);
        if (!state.erstellungsort || !state.erstellungsort.trim())
          e.push(['erstellungsort', 'Erstellungsort fehlt']);
        return e;
      } },
    { num: 9, title: 'Ergebnis & Empfehlung',
      sub: 'Restnutzungsdauer berechnet — Export oder direkt übernehmen',
      render: renderStep9, validate: function () { return []; } }
  ];

  // ============================================================
  // INIT & PUBLIC API
  // ============================================================
  function open(opts) {
    opts = opts || {};
    onCompleteCb = opts.onComplete || null;
    state = buildInitialState(opts.prefill || {});
    currentStep = 1;
    mountOverlay();
    renderCurrentStep();
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onEscape);
  }

  function close() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onEscape);
  }

  function onEscape(e) {
    if (e.key === 'Escape') close();
  }

  // ============================================================
  // STATE-MANAGEMENT — Defaults + Vorbefüllung
  // ============================================================
  function buildInitialState(prefill) {
    const today = new Date().toISOString().slice(0, 10);
    const dateStrDE = new Date().toLocaleDateString('de-DE');

    const defaults = {
      // Step 1: Objekt
      objekt_typ: 'Eigentumswohnung',
      str: '', hnr: '', plz: '', ort: '',
      einheit: '',
      baujahr: '',
      wohnflaeche: '',
      vollgeschosse: 1,
      einheiten_gesamt: 1,

      // Step 2: Auftraggeber
      auftraggeber_name: '',
      auftraggeber_strasse: '',
      auftraggeber_plz: '',
      auftraggeber_ort: '',
      eigentuemer_abweichend: false,
      eigentuemer_name: '',
      eigentuemer_strasse: '',
      eigentuemer_plz: '',
      eigentuemer_ort: '',
      stichtag: today,
      besichtigungsdatum: today,
      aktenzeichen: 'JI-' + Date.now().toString().slice(-7),

      // Step 3: Bauliche Anlagen
      bauweise: 'Massiv',
      unterkellerung: 'vollunterkellert',
      bedachung: '',
      fenster: '',
      heizungsart: '',
      anzahl_baeder: '1',
      besonderheiten: 'Keine',

      // Step 4: Gebäudetechnik
      belueftung: 'Herkömmliche Fensterlüftung',
      brennstoff: '',
      warmwasser: '',
      erneuerbare: 'Keine',
      energieklasse: '',
      erschliessung: 'erschlossen',

      // Step 5: Modernisierungen (für Punktraster)
      mod: {
        dach: 'Keine/Nie',
        fenster: 'Keine/Nie',
        leitungen: 'Keine/Nie',
        heizung: 'Keine/Nie',
        aussenwand: 'Keine/Nie',
        baeder: 'Keine/Nie',
        innenausbau: 'Keine/Nie',
        technik: 'Keine/Nie',
        grundriss: ''
      },

      // Step 6: Zustand Gewerke (für Technische RND)
      gewerke: {
        dach: 'veraltet',
        fenster: 'veraltet',
        leitungen: 'veraltet',
        heizung: 'veraltet',
        aussenwand: 'veraltet',
        baeder: 'veraltet',
        decken: 'veraltet',
        technik: 'standard',
        grundriss: 'veraltet'
      },

      // Step 7: Schäden
      schaeden_ids: [],
      applyAbschlag: false,

      // Step 8: Sachverständiger
      sv_name: 'Marcel Junker',
      sv_titel: 'Immobilienberater',
      sv_unternehmen: 'Junker Immobilien',
      sv_adresse_z1: 'Hermannstraße 9',
      sv_adresse_z2: '32609 Hüllhorst',
      sv_email: '',
      erstellungsort: 'Hüllhorst',
      erstellungsdatum: dateStrDE
    };

    // Deep merge
    const merged = JSON.parse(JSON.stringify(defaults));
    Object.keys(prefill).forEach(function (k) {
      if (prefill[k] && typeof prefill[k] === 'object' && !Array.isArray(prefill[k])) {
        merged[k] = Object.assign(merged[k] || {}, prefill[k]);
      } else if (prefill[k] !== undefined && prefill[k] !== null && prefill[k] !== '') {
        merged[k] = prefill[k];
      }
    });
    return merged;
  }

  /**
   * Wandelt ein DealPilot-JSON-Objekt in Wizard-Prefill.
   * Nutzt die mapDealPilotObject()-Heuristik aus rnd-calc.js zusätzlich.
   */
  function prefillFromDealPilot(dpObj) {
    if (!dpObj) return {};
    if (dpObj.data) dpObj = dpObj.data;

    const mapped = global.DealPilotRND
      ? global.DealPilotRND.mapDealPilotObject(dpObj) : null;

    const prefill = {
      objekt_typ: dpObj.objart === 'ETW' ? 'Eigentumswohnung'
                : dpObj.objart === 'MFH' ? 'Mehrfamilienhaus'
                : dpObj.objart === 'EFH' ? 'Einfamilienhaus'
                : dpObj.objart || 'Eigentumswohnung',
      str: dpObj.str || '',
      hnr: dpObj.hnr || '',
      plz: dpObj.plz || '',
      ort: dpObj.ort || '',
      einheit: dpObj._name || '',
      baujahr: dpObj.baujahr || '',
      wohnflaeche: dpObj.wfl || '',
      energieklasse: dpObj.ds2_energie || '',
      stichtag: dpObj.kaufdat || new Date().toISOString().slice(0, 10),
      aktenzeichen: 'DP-' + (dpObj.kuerzel || Date.now().toString().slice(-7))
    };

    // Gewerke-Mapping aus rate_*-Feldern
    if (mapped && mapped.gewerkeBewertung) {
      prefill.gewerke = mapped.gewerkeBewertung;
    }

    // Für AfA-Vergleich: Gebäudeanteil + Grenzsteuersatz aus DealPilot
    const kp = parseFloat(String(dpObj.kp || dpObj.kaufpreis || 0).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
    const gaPct = parseFloat(String(dpObj.geb_ant || 80).replace(',', '.')) || 80;
    if (kp > 0) prefill._dpGebaeudeanteil = kp * gaPct / 100;
    const grenz = parseFloat(String(dpObj.grenz || 42).replace(',', '.')) || 42;
    prefill._dpGrenzsteuersatz = grenz / 100;

    return prefill;
  }

  // ============================================================
  // OVERLAY-RENDERING
  // ============================================================
  function mountOverlay() {
    overlayEl = document.createElement('div');
    overlayEl.className = 'rnd-wiz-overlay';
    overlayEl.innerHTML =
      '<div class="rnd-wiz-modal">' +
        '<div class="rnd-wiz-header">' +
          '<div class="rnd-wiz-title">' +
            '<h2 id="rnd-wiz-step-title"></h2>' +
            '<p id="rnd-wiz-step-sub" class="rnd-wiz-sub"></p>' +
          '</div>' +
          '<button class="rnd-wiz-close" aria-label="Schließen">&times;</button>' +
        '</div>' +
        '<div class="rnd-wiz-progress">' +
          '<div class="rnd-wiz-progress-bar" id="rnd-wiz-progress"></div>' +
          '<div class="rnd-wiz-steps" id="rnd-wiz-steps"></div>' +
        '</div>' +
        '<div class="rnd-wiz-body" id="rnd-wiz-body"></div>' +
        '<div class="rnd-wiz-footer">' +
          '<button class="rnd-wiz-btn rnd-wiz-btn-sec" id="rnd-wiz-back">← Zurück</button>' +
          '<div class="rnd-wiz-counter" id="rnd-wiz-counter"></div>' +
          '<button class="rnd-wiz-btn rnd-wiz-btn-pri" id="rnd-wiz-next">Weiter →</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlayEl);

    overlayEl.querySelector('.rnd-wiz-close').onclick = close;
    overlayEl.querySelector('#rnd-wiz-back').onclick = goBack;
    overlayEl.querySelector('#rnd-wiz-next').onclick = goNext;

    // Klick außerhalb schließt
    overlayEl.addEventListener('click', function (e) {
      if (e.target === overlayEl) close();
    });
  }

  function renderCurrentStep() {
    const step = STEPS[currentStep - 1];
    document.getElementById('rnd-wiz-step-title').textContent =
      'Schritt ' + currentStep + ': ' + step.title;
    document.getElementById('rnd-wiz-step-sub').textContent = step.sub;

    // Progress
    const pct = (currentStep / TOTAL_STEPS) * 100;
    document.getElementById('rnd-wiz-progress').style.width = pct + '%';

    // Step-Dots
    const stepsEl = document.getElementById('rnd-wiz-steps');
    stepsEl.innerHTML = '';
    STEPS.forEach(function (s) {
      const dot = document.createElement('div');
      const isCurrent = s.num === currentStep;
      const isDone = s.num < currentStep;
      dot.className = 'rnd-wiz-step'
                    + (isCurrent ? ' active' : '')
                    + (isDone ? ' done' : '');
      dot.textContent = isDone ? '✓' : s.num;
      dot.title = s.title;
      dot.onclick = function () {
        if (s.num <= currentStep) {
          currentStep = s.num;
          renderCurrentStep();
        }
      };
      stepsEl.appendChild(dot);
    });

    // Counter + Button-Labels
    document.getElementById('rnd-wiz-counter').textContent =
      currentStep + ' von ' + TOTAL_STEPS;
    document.getElementById('rnd-wiz-back').style.visibility =
      currentStep > 1 ? 'visible' : 'hidden';
    const nextBtn = document.getElementById('rnd-wiz-next');
    if (currentStep === 8) {
      nextBtn.textContent = 'Berechnen →';
    } else if (currentStep === TOTAL_STEPS) {
      // V194: "In Editor übernehmen" raus — direkt zum Anfrage-Versand
      nextBtn.textContent = '✉ Anfrage senden →';
    } else {
      nextBtn.textContent = 'Weiter →';
    }

    // Body
    const body = document.getElementById('rnd-wiz-body');
    body.innerHTML = '';
    step.render(body);

    // Inputs an State binden
    bindInputs(body);

    body.scrollTop = 0;
  }

  function bindInputs(container) {
    container.querySelectorAll('[data-state]').forEach(function (el) {
      const key = el.dataset.state;
      const path = key.split('.');

      // Initialer Wert in das Feld
      const val = getNested(state, path);
      if (el.type === 'checkbox') el.checked = !!val;
      else if (el.type === 'radio') el.checked = String(val) === el.value;
      else el.value = val == null ? '' : val;

      el.addEventListener('change', function () {
        let v;
        if (el.type === 'checkbox') v = el.checked;
        else if (el.type === 'number') v = el.value === '' ? '' : Number(el.value);
        else v = el.value;
        setNested(state, path, v);

        // Trigger re-render bei bestimmten Toggles
        if (key === 'eigentuemer_abweichend') {
          renderCurrentStep();
        }
      });
      // Bei Text-Inputs zusätzlich input-Event
      if (el.type === 'text' || el.tagName === 'TEXTAREA' || el.type === 'number') {
        el.addEventListener('input', function () {
          let v = el.type === 'number' && el.value !== '' ? Number(el.value) : el.value;
          setNested(state, path, v);
        });
      }
    });

    // Schadens-Checkboxen separat (Array)
    container.querySelectorAll('[data-schaden]').forEach(function (el) {
      const id = el.dataset.schaden;
      el.checked = state.schaeden_ids.indexOf(id) >= 0;
      el.addEventListener('change', function () {
        if (el.checked) {
          if (state.schaeden_ids.indexOf(id) < 0) state.schaeden_ids.push(id);
        } else {
          state.schaeden_ids = state.schaeden_ids.filter(function (x) { return x !== id; });
        }
      });
    });
  }

  function getNested(obj, path) {
    let v = obj;
    for (let i = 0; i < path.length; i++) {
      if (v == null) return undefined;
      v = v[path[i]];
    }
    return v;
  }
  function setNested(obj, path, val) {
    for (let i = 0; i < path.length - 1; i++) {
      if (obj[path[i]] == null) obj[path[i]] = {};
      obj = obj[path[i]];
    }
    obj[path[path.length - 1]] = val;
  }

  function goBack() {
    if (currentStep > 1) {
      // Beim Zurückspringen Fehler löschen
      clearErrors();
      currentStep--;
      renderCurrentStep();
    }
  }
  function goNext() {
    if (!state) return; // Sicherheitscheck
    // Validieren bevor Weiter
    const step = STEPS[currentStep - 1];
    const errors = step.validate ? step.validate() : [];
    if (errors.length > 0) {
      showValidationErrors(errors);
      return;
    }
    clearErrors();
    if (currentStep < TOTAL_STEPS) { currentStep++; renderCurrentStep(); }
    else {
      // V194: Letzter Step → direkt Anfrage senden (statt zum Editor zu wechseln)
      _submitWizardAsRequest();
    }
  }

  // V194: Anfrage direkt aus Wizard senden — kein Editor mehr.
  // Modal schließen, Hand-off an deal-action._rndOrderExpert wenn vorhanden.
  function _submitWizardAsRequest() {
    var result = state._computedResult || computeFinalResult();
    var afa = state._computedAfa || computeAfaEstimate(result);
    // Übergabe-Paket für deal-action.js
    window._lastRndResult = {
      state: state,
      result: result,
      afa: afa
    };
    closeWizardOverlay();
    // Hand-off — wenn DealAction da ist, dort den Anfrage-Submit triggern
    if (window.DealPilotDealAction && typeof window.DealPilotDealAction._rndOrderExpert === 'function') {
      setTimeout(function() {
        try { window.DealPilotDealAction._rndOrderExpert(); }
        catch(e) { console.error('[wizard] _rndOrderExpert FAIL:', e); }
      }, 200);
    } else {
      alert('Anfrage-Versand-Modul nicht verfügbar.');
    }
  }

  function closeWizardOverlay() {
    if (overlayEl) {
      try { overlayEl.remove(); } catch(e) {}
      overlayEl = null;
    }
  }

  function showValidationErrors(errors) {
    // Alte Fehler-Markierungen entfernen
    clearErrors();
    // Fehler-Banner über Footer
    let banner = document.getElementById('rnd-wiz-errors');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'rnd-wiz-errors';
      banner.className = 'rnd-wiz-error-banner';
      const footer = overlayEl.querySelector('.rnd-wiz-footer');
      footer.parentNode.insertBefore(banner, footer);
    }
    banner.innerHTML = '<strong>Bitte ergänzen:</strong><ul>'
      + errors.map(function (e) { return '<li>' + e[1] + '</li>'; }).join('')
      + '</ul>';
    // Felder rot markieren
    errors.forEach(function (e) {
      const key = e[0];
      const el = overlayEl.querySelector('[data-state="' + key + '"]');
      if (el) {
        el.classList.add('rnd-wiz-error');
        el.addEventListener('input', function clearOnInput() {
          el.classList.remove('rnd-wiz-error');
          el.removeEventListener('input', clearOnInput);
        });
      }
    });
    // Scroll zum ersten Fehler
    const firstErr = overlayEl.querySelector('.rnd-wiz-error');
    if (firstErr) firstErr.focus();
  }

  function clearErrors() {
    if (!overlayEl) return;
    const banner = document.getElementById('rnd-wiz-errors');
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    overlayEl.querySelectorAll('.rnd-wiz-error').forEach(function (el) {
      el.classList.remove('rnd-wiz-error');
    });
  }

  function finishWizard() {
    // Wizard-State in ein vom UI-Modul verständliches Format übersetzen
    const result = buildResultPackage();
    // Berechnung sofort durchführen für Ergebnis-Screen
    const calc = computeRND(result);
    showResultScreen(result, calc);
  }

  function buildResultPackage() {
    return {
      // Für DealPilotRND_UI.mount() — passt zu mount(selector, initial)
      objekt_typ: state.objekt_typ,
      objekt_adresse: [state.str, state.hnr].filter(Boolean).join(' ')
                    + (state.plz || state.ort ? ', ' + state.plz + ' ' + state.ort : ''),
      objekt_einheit: state.einheit,
      baujahr: parseInt(state.baujahr, 10) || new Date().getFullYear(),
      wohnflaeche: state.wohnflaeche,
      stichtag: state.stichtag,
      besichtigungsdatum: state.besichtigungsdatum,
      aktenzeichen: state.aktenzeichen,
      bauweise: state.bauweise,
      unterkellerung: state.unterkellerung,
      vollgeschosse: state.vollgeschosse,
      einheiten_gesamt: state.einheiten_gesamt,
      bedachung: state.bedachung,
      fenster: state.fenster,
      heizungsart: state.heizungsart,
      anzahl_baeder: state.anzahl_baeder,
      besonderheiten: state.besonderheiten,
      bel: state.belueftung,
      brennstoff: state.brennstoff,
      warmwasser: state.warmwasser,
      erneuerbare: state.erneuerbare,
      energieklasse: state.energieklasse,
      erschliessung: state.erschliessung,
      mod_dach: state.mod.dach,
      mod_fenster: state.mod.fenster,
      mod_leitungen: state.mod.leitungen,
      mod_heizung: state.mod.heizung,
      mod_aussenwand: state.mod.aussenwand,
      mod_baeder: state.mod.baeder,
      mod_innenausbau: state.mod.innenausbau,
      mod_technik: state.mod.technik,
      mod_grundriss: state.mod.grundriss,
      gewerkeBewertung: state.gewerke,
      schaeden: state.schaeden_ids.slice(),
      applySchadensAbschlag: state.applyAbschlag,
      // Auftraggeber/Eigentümer
      auftraggeber_name: state.auftraggeber_name,
      auftraggeber_adresse: [state.auftraggeber_strasse, state.auftraggeber_plz + ' ' + state.auftraggeber_ort]
                            .filter(function (s) { return s.trim().length > 0; }).join(', '),
      eigentuemer_name: state.eigentuemer_abweichend ? state.eigentuemer_name : state.auftraggeber_name,
      eigentuemer_adresse: state.eigentuemer_abweichend
        ? [state.eigentuemer_strasse, state.eigentuemer_plz + ' ' + state.eigentuemer_ort]
            .filter(function (s) { return s.trim().length > 0; }).join(', ')
        : [state.auftraggeber_strasse, state.auftraggeber_plz + ' ' + state.auftraggeber_ort]
            .filter(function (s) { return s.trim().length > 0; }).join(', '),
      // Sachverständiger
      sv_name: state.sv_name,
      sv_titel: state.sv_titel,
      sv_unternehmen: state.sv_unternehmen,
      sv_adresse_z1: state.sv_adresse_z1,
      sv_adresse_z2: state.sv_adresse_z2,
      sv_email: state.sv_email,
      erstellungsort: state.erstellungsort,
      erstellungsdatum: state.erstellungsdatum,
      // Punktraster auto-berechnen aus mod-Werten
      modPoints: computeModPoints(state.mod).total,
      modElements: computeModPoints(state.mod).elements,
      // GND aus Objekttyp
      gnd: gndFromObjektTyp(state.objekt_typ)
    };
  }

  // Sofortige RND-Berechnung für Ergebnis-Screen
  function computeRND(pkg) {
    if (!global.DealPilotRND) return null;
    const RND = global.DealPilotRND;
    const result = RND.calcAll({
      baujahr: pkg.baujahr,
      stichtag: pkg.stichtag,
      gnd: pkg.gnd,
      modPoints: pkg.modPoints,
      gewerkeBewertung: pkg.gewerkeBewertung,
      schaeden: pkg.schaeden,
      applySchadensAbschlag: pkg.applySchadensAbschlag
    });
    // Optionale AfA-Berechnung wenn der Wizard-State Gebäudeanteil hatte
    // (Default-Annahme für Demo: 200.000 EUR Gebäudeanteil, 42% Grenz, Standard-AfA 2%)
    const afa = RND.calcAfaVergleich({
      gebaeudeanteil: 200000,
      rnd: result.final_rnd,
      grenzsteuersatz: 0.42,
      standardAfaSatz: 0.02,
      gutachterkosten: 999,
      abzinsung: 0.02
    });
    return { result: result, afa: afa };
  }

  function showResultScreen(pkg, calc) {
    // Header umbenennen
    document.getElementById('rnd-wiz-step-title').textContent = '✓ Ergebnis';
    document.getElementById('rnd-wiz-step-sub').textContent =
      'Ihre Restnutzungsdauer-Analyse ist fertig';

    // Progress 100%
    document.getElementById('rnd-wiz-progress').style.width = '100%';

    // Steps alle als done markieren
    const stepsEl = document.getElementById('rnd-wiz-steps');
    stepsEl.innerHTML = '';
    STEPS.forEach(function () {
      const dot = document.createElement('div');
      dot.className = 'rnd-wiz-step done';
      dot.textContent = '✓';
      stepsEl.appendChild(dot);
    });

    // Footer-Counter
    document.getElementById('rnd-wiz-counter').textContent = 'Ergebnis';

    const body = document.getElementById('rnd-wiz-body');
    const r = calc.result;
    const a = calc.afa;

    let ampelClass, ampelLabel, ampelIcon;
    if (a.ampel === 'gruen') {
      ampelClass = 'green'; ampelLabel = 'Lohnt sich klar'; ampelIcon = '✓';
    } else if (a.ampel === 'gelb') {
      ampelClass = 'yellow'; ampelLabel = 'Lohnt sich bedingt'; ampelIcon = '!';
    } else {
      ampelClass = 'red'; ampelLabel = 'Lohnt sich nicht'; ampelIcon = '✗';
    }

    let html = '<div class="rnd-wiz-result">';

    // Hauptergebnis: RND
    html += '<div class="rnd-wiz-result-hero">'
      + '<div class="rnd-wiz-result-hero-label">Restnutzungsdauer</div>'
      + '<div class="rnd-wiz-result-hero-value">' + r.final_rnd + ' Jahre</div>'
      + '<div class="rnd-wiz-result-hero-sub">'
      +   'Objekt: ' + escapeHTML(pkg.objekt_adresse) + (pkg.objekt_einheit ? ' (' + escapeHTML(pkg.objekt_einheit) + ')' : '')
      + '</div>'
      + '</div>';

    // Verfahrensübersicht
    html += '<div class="rnd-wiz-result-grid">'
      + '<div class="rnd-wiz-result-card">'
      + '<div class="rnd-wiz-result-card-label">Linear</div>'
      + '<div class="rnd-wiz-result-card-value">' + r.methods.linear.restnutzungsdauer + '</div>'
      + '<div class="rnd-wiz-result-card-unit">Jahre</div>'
      + '</div>'
      + '<div class="rnd-wiz-result-card">'
      + '<div class="rnd-wiz-result-card-label">Punktraster</div>'
      + '<div class="rnd-wiz-result-card-value">' + r.methods.punktraster.restnutzungsdauer + '</div>'
      + '<div class="rnd-wiz-result-card-unit">Jahre · ' + r.methods.punktraster.modernisierungspunkte + ' P.</div>'
      + '</div>'
      + '<div class="rnd-wiz-result-card highlight">'
      + '<div class="rnd-wiz-result-card-label">Technisch ★</div>'
      + '<div class="rnd-wiz-result-card-value">' + r.methods.technisch.restnutzungsdauer + '</div>'
      + '<div class="rnd-wiz-result-card-unit">Jahre · maßgeblich</div>'
      + '</div>'
      + '</div>';

    // Lohnt sich AfA?
    html += '<div class="rnd-wiz-result-ampel rnd-wiz-ampel-' + ampelClass + '">'
      + '<div class="rnd-wiz-ampel-icon">' + ampelIcon + '</div>'
      + '<div class="rnd-wiz-ampel-content">'
      + '<div class="rnd-wiz-ampel-title">' + ampelLabel + '</div>'
      + '<div class="rnd-wiz-ampel-text">' + escapeHTML(a.empfehlung) + '</div>'
      + '</div>'
      + '</div>';

    // AfA-Vorteil — Aufschlüsselung
    html += '<details class="rnd-wiz-result-details" open>'
      + '<summary>Steuerliche Auswirkung im Detail</summary>'
      + '<table class="rnd-wiz-result-table">'
      + '<tr><td>Standard-AfA (' + a.afa_standard.satz_pct + ' %)</td>'
      +   '<td class="num">' + fmtEUR(a.afa_standard.jahresbetrag) + ' / Jahr</td></tr>'
      + '<tr><td>RND-AfA (' + a.afa_kurz.satz_pct + ' %)</td>'
      +   '<td class="num">' + fmtEUR(a.afa_kurz.jahresbetrag) + ' / Jahr</td></tr>'
      + '<tr class="hi"><td>Mehr-AfA pro Jahr</td>'
      +   '<td class="num pos">+ ' + fmtEUR(a.mehr_afa_jahr) + '</td></tr>'
      + '<tr><td>Steuerersparnis/Jahr (42 % Grenz)</td>'
      +   '<td class="num">' + fmtEUR(a.steuerersparnis_jahr) + '</td></tr>'
      + '<tr><td>Barwert über ' + a.input.rnd + ' Jahre</td>'
      +   '<td class="num">' + fmtEUR(a.steuerersparnis_barwert) + '</td></tr>'
      + '<tr><td>- Gutachterkosten</td>'
      +   '<td class="num neg">- ' + fmtEUR(a.gutachterkosten) + '</td></tr>'
      + '<tr class="total"><td>Netto-Vorteil</td>'
      +   '<td class="num">' + fmtEUR(a.netto_vorteil) + '</td></tr>'
      + '</table>'
      + '<p class="rnd-wiz-result-hint">Annahmen: Gebäudeanteil 200.000 €, Grenzsteuersatz 42 %, '
      + 'Diskontsatz 2 %. Exakte Berechnung im Rechner unten anpassbar.</p>'
      + '</details>';

    // Action-Buttons
    html += '<div class="rnd-wiz-result-actions">'
      + '<button class="rnd-wiz-btn rnd-wiz-btn-pri" id="rnd-wiz-action-pdf">📄 Gutachten als PDF</button>'
      + '<button class="rnd-wiz-btn rnd-wiz-btn-pri" id="rnd-wiz-action-docx">📝 Gutachten als Word (DOCX)</button>'
      + '<button class="rnd-wiz-btn rnd-wiz-btn-sec" id="rnd-wiz-action-edit">✏️ Im Rechner öffnen & anpassen</button>'
      + '</div>';

    html += '</div>';
    body.innerHTML = html;

    // Footer-Buttons umbauen
    document.getElementById('rnd-wiz-back').style.visibility = 'visible';
    document.getElementById('rnd-wiz-next').textContent = 'Fertig ✓';
    document.getElementById('rnd-wiz-next').onclick = function () {
      close();
      // Daten dennoch ins UI laden (für späteres Anpassen)
      if (onCompleteCb) onCompleteCb(pkg);
    };

    // Action-Handler
    document.getElementById('rnd-wiz-action-pdf').onclick = function () {
      generatePDF(pkg, calc);
    };
    document.getElementById('rnd-wiz-action-docx').onclick = function () {
      generateDOCX(pkg, calc);
    };
    document.getElementById('rnd-wiz-action-edit').onclick = function () {
      close();
      if (onCompleteCb) onCompleteCb(pkg);
    };
  }

  function generatePDF(pkg, calc) {
    if (!global.DealPilotRND_PDF) {
      alert('PDF-Modul nicht geladen.');
      return;
    }
    try {
      const gutachtenData = Object.assign({}, pkg);
      gutachtenData.__gewerkeBewertung = pkg.gewerkeBewertung;
      const doc = global.DealPilotRND_PDF.generateGutachten({
        gutachtenData: gutachtenData,
        result: calc.result,
        afa: calc.afa
      });
      const filename = 'Restnutzungsdauer-Gutachten_'
        + (pkg.objekt_adresse || 'Objekt').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)
        + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
      doc.save(filename);
    } catch (e) {
      console.error('PDF-Export-Fehler:', e);
      alert('Fehler beim PDF-Export: ' + e.message);
    }
  }

  function generateDOCX(pkg, calc) {
    if (!global.DealPilotRND_DOCX) {
      alert('DOCX-Modul nicht geladen. Bitte rnd-docx.js einbinden.');
      return;
    }
    try {
      global.DealPilotRND_DOCX.generate({
        gutachtenData: pkg,
        result: calc.result,
        afa: calc.afa
      });
    } catch (e) {
      console.error('DOCX-Export-Fehler:', e);
      alert('Fehler beim DOCX-Export: ' + e.message);
    }
  }

  function fmtEUR(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '–';
    return n.toLocaleString('de-DE', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    });
  }

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;',
               '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function computeModPoints(mod) {
    // Vereinfachte Heuristik:
    // <5 J / kernsaniert = volle Punkte, 5-10 J = halb, 10-20 J = wenig, >20 J / Keine = 0
    const max = { dach: 4, fenster: 2, leitungen: 2, heizung: 2,
                  aussenwand: 4, baeder: 2, innenausbau: 2, grundriss: 2 };
    const elements = {};
    let total = 0;
    Object.keys(max).forEach(function (key) {
      const z = mod[key] || 'Keine/Nie';
      let p = 0;
      if (z.indexOf('< 5') >= 0 || z.indexOf('kernsaniert') >= 0
          || z.indexOf('Kernsanierung') >= 0) p = max[key];
      else if (z.indexOf('5 - 10') >= 0 || z.indexOf('5-10') >= 0)
        p = Math.round(max[key] * 0.7);
      else if (z.indexOf('10 - 20') >= 0 || z.indexOf('10-20') >= 0)
        p = Math.round(max[key] * 0.4);
      elements[key] = p;
      total += p;
    });
    return { total: Math.min(20, total), elements: elements };
  }

  function gndFromObjektTyp(typ) {
    if (!typ) return 70;
    const t = String(typ).toLowerCase();
    if (t.indexOf('hotel') >= 0 || t.indexOf('budget') >= 0) return 40;
    if (t.indexOf('büro') >= 0 || t.indexOf('buero') >= 0 || t.indexOf('geschäft') >= 0) return 60;
    if (t.indexOf('industrie') >= 0 || t.indexOf('lager') >= 0 || t.indexOf('werk') >= 0) return 40;
    if (t.indexOf('garage') >= 0) return 60;
    return 70; // ETW, MFH, EFH
  }

  // ============================================================
  // STEP-RENDERERS
  // ============================================================
  function renderStep1(body) {
    body.innerHTML = `
      <div class="rnd-wiz-grid">
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Welche Art von Immobilie?</label>
          <select data-state="objekt_typ">
            <option>Eigentumswohnung</option>
            <option>Einfamilienhaus</option>
            <option>Mehrfamilienhaus</option>
            <option>Doppelhaushälfte</option>
            <option>Reihenhaus</option>
            <option>Bürogebäude</option>
            <option>Geschäftshaus</option>
            <option>Hotel</option>
            <option>Gewerbe-/Industriegebäude</option>
            <option>Garage / Stellplatz</option>
          </select>
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Straße + Hausnummer</label>
          <div style="display:flex;gap:8px">
            <input type="text" data-state="str" placeholder="Musterstraße" style="flex:3">
            <input type="text" data-state="hnr" placeholder="12a" style="flex:1">
          </div>
        </div>
        <div class="rnd-wiz-field">
          <label>PLZ</label>
          <input type="text" data-state="plz" placeholder="12345">
        </div>
        <div class="rnd-wiz-field">
          <label>Ort</label>
          <input type="text" data-state="ort" placeholder="Musterstadt">
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Einheit / Bezeichnung <span class="rnd-wiz-hint">(z.B. „WE 02", „EG links")</span></label>
          <input type="text" data-state="einheit" placeholder="WE 02">
        </div>
        <div class="rnd-wiz-field">
          <label>Baujahr</label>
          <input type="number" data-state="baujahr" placeholder="1994" min="1800" max="${new Date().getFullYear()}">
        </div>
        <div class="rnd-wiz-field">
          <label>Wohnfläche (m²)</label>
          <input type="number" data-state="wohnflaeche" placeholder="52,60" step="0.01">
        </div>
        <div class="rnd-wiz-field">
          <label>Vollgeschosse</label>
          <input type="number" data-state="vollgeschosse" min="1" max="50">
        </div>
        <div class="rnd-wiz-field">
          <label>Anzahl Einheiten gesamt</label>
          <input type="number" data-state="einheiten_gesamt" min="1">
        </div>
      </div>
    `;
  }

  function renderStep2(body) {
    body.innerHTML = `
      <div class="rnd-wiz-grid">
        <div class="rnd-wiz-section">
          <h3>Auftraggeber</h3>
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Name</label>
          <input type="text" data-state="auftraggeber_name" placeholder="Max Mustermann">
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Straße + Hausnummer</label>
          <input type="text" data-state="auftraggeber_strasse" placeholder="Musterweg 5">
        </div>
        <div class="rnd-wiz-field">
          <label>PLZ</label>
          <input type="text" data-state="auftraggeber_plz">
        </div>
        <div class="rnd-wiz-field">
          <label>Ort</label>
          <input type="text" data-state="auftraggeber_ort">
        </div>

        <div class="rnd-wiz-section">
          <label class="rnd-wiz-checkbox">
            <input type="checkbox" data-state="eigentuemer_abweichend">
            <span>Eigentümer weicht vom Auftraggeber ab</span>
          </label>
        </div>

        ${state.eigentuemer_abweichend ? `
        <div class="rnd-wiz-section">
          <h3>Eigentümer</h3>
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Name Eigentümer</label>
          <input type="text" data-state="eigentuemer_name">
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Straße + Hausnummer</label>
          <input type="text" data-state="eigentuemer_strasse">
        </div>
        <div class="rnd-wiz-field">
          <label>PLZ</label>
          <input type="text" data-state="eigentuemer_plz">
        </div>
        <div class="rnd-wiz-field">
          <label>Ort</label>
          <input type="text" data-state="eigentuemer_ort">
        </div>
        ` : ''}

        <div class="rnd-wiz-section">
          <h3>Termine & Aktenzeichen</h3>
        </div>
        <div class="rnd-wiz-field">
          <label>Bewertungsstichtag</label>
          <input type="date" data-state="stichtag">
        </div>
        <div class="rnd-wiz-field">
          <label>Besichtigungsdatum</label>
          <input type="date" data-state="besichtigungsdatum">
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Aktenzeichen</label>
          <input type="text" data-state="aktenzeichen">
        </div>
      </div>
    `;
  }

  function renderStep3(body) {
    body.innerHTML = `
      <div class="rnd-wiz-grid">
        <div class="rnd-wiz-field">
          <label>Bauweise</label>
          <select data-state="bauweise">
            <option>Massiv</option>
            <option>Holz / Fachwerk</option>
            <option>Stahl- / Stahlbeton-Konstruktion</option>
            <option>Holzrahmenbau</option>
            <option>Mischbauweise</option>
          </select>
        </div>
        <div class="rnd-wiz-field">
          <label>Unterkellerung</label>
          <select data-state="unterkellerung">
            <option>vollunterkellert</option>
            <option>teilunterkellert</option>
            <option>nicht unterkellert</option>
            <option>Kellerersatzraum</option>
          </select>
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Bedachung</label>
          <select data-state="bedachung">
            <option value="">— bitte wählen —</option>
            <option>Satteldach mit Tonziegeln</option>
            <option>Satteldach mit Betonziegeln</option>
            <option>Walmdach mit Tonziegeln</option>
            <option>Walmdach mit Betonziegeln</option>
            <option>Krüppelwalmdach</option>
            <option>Pultdach</option>
            <option>Flachdach (Bitumen)</option>
            <option>Flachdach (Folie)</option>
            <option>Flachdach (begrünt)</option>
            <option>Mansarddach</option>
            <option>Zeltdach</option>
            <option>Schieferdach</option>
            <option>Reetdach</option>
            <option>Metalldach (Zink/Kupfer)</option>
            <option>Schmetterlingsdach</option>
          </select>
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Fenster</label>
          <select data-state="fenster">
            <option value="">— bitte wählen —</option>
            <option>2-fach Verglasung, Kunststoff</option>
            <option>2-fach Verglasung, Holz</option>
            <option>2-fach Verglasung, Aluminium</option>
            <option>3-fach Verglasung, Kunststoff</option>
            <option>3-fach Verglasung, Holz</option>
            <option>3-fach Verglasung, Aluminium</option>
            <option>einfach verglast</option>
          </select>
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Heizungsart</label>
          <select data-state="heizungsart">
            <option value="">— bitte wählen —</option>
            <option>Gas-Zentralheizung</option>
            <option>Gas-Brennwertheizung</option>
            <option>Öl-Zentralheizung</option>
            <option>Fernwärme</option>
            <option>Luft-Wärmepumpe</option>
            <option>Erdwärme-Wärmepumpe</option>
            <option>Pelletheizung</option>
            <option>Elektroheizung</option>
            <option>Etagenheizung</option>
            <option>Einzelöfen</option>
          </select>
        </div>
        <div class="rnd-wiz-field">
          <label>Anzahl Bäder</label>
          <input type="number" data-state="anzahl_baeder" min="0" max="20">
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Besonderheiten <span class="rnd-wiz-hint">(optional)</span></label>
          <input type="text" data-state="besonderheiten" placeholder="z.B. Balkon mit Südausrichtung">
        </div>
      </div>
    `;
  }

  function renderStep4(body) {
    body.innerHTML = `
      <div class="rnd-wiz-grid">
        <div class="rnd-wiz-field">
          <label>Belüftung</label>
          <select data-state="belueftung">
            <option>Herkömmliche Fensterlüftung</option>
            <option>Lüftungsanlage mit Wärmerückgewinnung</option>
            <option>Lüftungsanlage ohne Wärmerückgewinnung</option>
            <option>Dezentrale Lüftungsgeräte</option>
          </select>
        </div>
        <div class="rnd-wiz-field">
          <label>Energieträger</label>
          <select data-state="brennstoff">
            <option value="">— bitte wählen —</option>
            <option>Erdgas</option>
            <option>Heizöl</option>
            <option>Fernwärme</option>
            <option>Strom</option>
            <option>Pellets / Holz</option>
            <option>Solarthermie</option>
          </select>
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Warmwasserbereitung</label>
          <select data-state="warmwasser">
            <option value="">— bitte wählen —</option>
            <option>zentral über Heizkessel</option>
            <option>Boiler / Speicher</option>
            <option>Durchlauferhitzer (elektrisch)</option>
            <option>Durchlauferhitzer (Gas)</option>
            <option>Solarthermie</option>
            <option>Wärmepumpe</option>
          </select>
        </div>
        <div class="rnd-wiz-field">
          <label>Erneuerbare Energien</label>
          <select data-state="erneuerbare">
            <option>Keine</option>
            <option>Photovoltaik</option>
            <option>Solarthermie</option>
            <option>Wärmepumpe</option>
            <option>Mehrere Quellen</option>
          </select>
        </div>
        <div class="rnd-wiz-field">
          <label>Energieklasse</label>
          <select data-state="energieklasse">
            <option value="">— unbekannt —</option>
            <option value="A+">A+ (höchste Effizienz)</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
            <option value="F">F</option>
            <option value="G">G</option>
            <option value="H">H (niedrigste Effizienz)</option>
          </select>
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Erschließungssituation</label>
          <select data-state="erschliessung">
            <option>erschlossen</option>
            <option>voll erschlossen</option>
            <option>teilerschlossen</option>
            <option>unerschlossen</option>
          </select>
        </div>
      </div>
    `;
  }

  function renderStep5(body) {
    const modOptions = [
      'Keine/Nie',
      '> 20 Jahre',
      '10 - 20 Jahre',
      '5 - 10 Jahre',
      '< 5 Jahre',
      'Kernsanierung'
    ];

    const sections = [
      ['dach',        'Dacherneuerung inkl. Wärmedämmung'],
      ['fenster',     'Fenster und Außentüren'],
      ['leitungen',   'Leitungssysteme (Strom, Gas, Wasser, Abwasser)'],
      ['heizung',     'Heizungsanlage'],
      ['aussenwand',  'Wärmedämmung Außenwände'],
      ['baeder',      'Bäder'],
      ['innenausbau', 'Innenausbau (Decken, Fußböden, Treppen)'],
      ['technik',     'Technische Ausstattung']
    ];

    let html = '<div class="rnd-wiz-info-box">'
      + '<strong>Wann wurden diese Bauteile zuletzt modernisiert?</strong><br>'
      + 'Daraus berechnen wir automatisch die Modernisierungs-Punktzahl (0–20) '
      + 'für die Punktrastermethode.'
      + '</div>'
      + '<div class="rnd-wiz-mod-list">';

    sections.forEach(function (s) {
      const key = s[0];
      html += '<div class="rnd-wiz-mod-row">'
        + '<label>' + s[1] + '</label>'
        + '<select data-state="mod.' + key + '">'
        + modOptions.map(function (o) {
            return '<option' + (state.mod[key] === o ? ' selected' : '')
                 + '>' + o + '</option>';
          }).join('')
        + '</select>'
        + '</div>';
    });

    html += '</div>';

    // Live-Anzeige der berechneten Punktzahl
    const punkte = computeModPoints(state.mod).total;
    let grad;
    if (punkte <= 1) grad = 'nicht modernisiert';
    else if (punkte <= 5) grad = 'kleine Modernisierungen';
    else if (punkte <= 10) grad = 'mittlerer Modernisierungsgrad';
    else if (punkte <= 17) grad = 'überwiegend modernisiert';
    else grad = 'umfassend modernisiert';

    html += '<div class="rnd-wiz-result-bar">'
      + 'Berechnete Modernisierungs-Punkte: <strong>' + punkte + ' / 20</strong>'
      + ' &nbsp;·&nbsp; <em>' + grad + '</em>'
      + '</div>';

    body.innerHTML = html;
  }

  function renderStep6(body) {
    const gewerke = [
      ['dach',        'Dachkonstruktion inkl. Wärmedämmung', 15],
      ['fenster',     'Fenster / Außentüren',                15],
      ['leitungen',   'Leitungssysteme',                     5],
      ['heizung',     'Heizungsanlage',                      15],
      ['aussenwand',  'Außenwände inkl. Wärmedämmung',       10],
      ['baeder',      'Ausbau Bäder',                        5],
      ['decken',      'Deckenkonstruktion inkl. Wärmedämmung', 5],
      ['technik',     'Technische Ausstattung',              15],
      ['grundriss',   'Wesentliche Veränderung Grundriss',   15]
    ];

    let html = '<div class="rnd-wiz-info-box">'
      + '<strong>Wie ist der aktuelle Zustand jedes Gewerks?</strong><br>'
      + '„niedrig/veraltet" = nicht zeitgemäß · „aktueller Standard" = entspricht heutigen '
      + 'Anforderungen · „zukunftsorientiert/gehoben" = übersteigt aktuellen Standard.'
      + '</div>';

    html += '<table class="rnd-wiz-gewerke-tab">'
      + '<thead><tr>'
      + '<th>Gewerk</th>'
      + '<th>Gewicht</th>'
      + '<th>veraltet</th>'
      + '<th>Standard</th>'
      + '<th>gehoben</th>'
      + '</tr></thead><tbody>';

    gewerke.forEach(function (g) {
      const id = g[0];
      const label = g[1];
      const w = g[2];
      const cur = state.gewerke[id] || 'standard';
      html += '<tr>'
        + '<td>' + label + '</td>'
        + '<td class="center">' + w + '%</td>'
        + ['veraltet', 'standard', 'gehoben'].map(function (grad) {
            return '<td class="center"><input type="radio" name="gw_' + id + '" value="' + grad
              + '"' + (cur === grad ? ' checked' : '') + ' data-gewerk="' + id + '"></td>';
          }).join('')
        + '</tr>';
    });

    html += '</tbody></table>';
    body.innerHTML = html;

    // Radio-Buttons binden
    body.querySelectorAll('input[data-gewerk]').forEach(function (el) {
      el.addEventListener('change', function () {
        state.gewerke[el.dataset.gewerk] = el.value;
      });
    });
  }

  function renderStep7(body) {
    const SCHAEDEN = (global.DealPilotRND && global.DealPilotRND.SCHADEN_KATALOG) || [];

    let html = '<div class="rnd-wiz-info-box">'
      + '<strong>Wurden sichtbare Mängel oder Schäden festgestellt?</strong><br>'
      + 'Mehrfachauswahl möglich. Im Standardfall werden die Schäden nur im Gutachten '
      + 'dokumentiert — das ist die übliche Vorgehensweise.'
      + '</div>';

    html += '<div class="rnd-wiz-schaden-list">';
    SCHAEDEN.forEach(function (s) {
      html += '<label class="rnd-wiz-schaden-row">'
        + '<input type="checkbox" data-schaden="' + s.id + '">'
        + '<span class="rnd-wiz-schaden-label">' + s.label + '</span>'
        + '</label>';
    });
    html += '</div>';

    // V194: Textbox "Weitere Mängel" zurück (Marcels Wunsch)
    html += '<div class="rnd-wiz-field" style="margin-top:18px">'
      + '<label>Weitere Mängel <span class="rnd-wiz-hint-inline">(Freitext, optional)</span></label>'
      + '<textarea data-state="weitere_maengel" rows="3" '
      + 'placeholder="z.B. besondere Schadensbilder, Sanierungsstau, Bauzustands-Notizen…" '
      + 'style="width:100%;min-height:80px;padding:10px 12px;font-family:inherit;'
      + 'font-size:13.5px;line-height:1.5;border:1px solid #E0DBD3;border-radius:8px;'
      + 'background:#fff;color:#2A2727;resize:vertical">'
      + (state.weitere_maengel || '')
      + '</textarea>'
      + '</div>';

    body.innerHTML = html;
  }

  function renderStep8(body) {
    body.innerHTML = `
      <div class="rnd-wiz-grid">
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Name Sachverständiger</label>
          <input type="text" data-state="sv_name" placeholder="Marcel Junker">
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Titel / Qualifikation</label>
          <input type="text" data-state="sv_titel" placeholder="z.B. Immobilienberater">
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Firma</label>
          <input type="text" data-state="sv_unternehmen" placeholder="Junker Immobilien">
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Adresse Zeile 1</label>
          <input type="text" data-state="sv_adresse_z1" placeholder="Hermannstraße 9">
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>Adresse Zeile 2</label>
          <input type="text" data-state="sv_adresse_z2" placeholder="32609 Hüllhorst">
        </div>
        <div class="rnd-wiz-field rnd-wiz-col-2">
          <label>E-Mail <span class="rnd-wiz-hint">(erforderlich für den Versand des Gutachtens)</span></label>
          <input type="email" data-state="sv_email" placeholder="kontakt@junker-immobilien.de">
        </div>
        <div class="rnd-wiz-field">
          <label>Erstellungsort</label>
          <input type="text" data-state="erstellungsort">
        </div>
        <div class="rnd-wiz-field">
          <label>Erstellungsdatum</label>
          <input type="text" data-state="erstellungsdatum" placeholder="TT.MM.JJJJ">
        </div>
      </div>
    `;
  }

  // ============================================================
  // STEP 9 — Ergebnis, Empfehlung, Export
  // ============================================================
  function renderStep9(body) {
    // Berechnung ausführen
    const result = computeFinalResult();
    const afa = computeAfaEstimate(result);

    // Result im State speichern (für submit-Hand-off)
    state._computedResult = result;
    state._computedAfa = afa;

    const m = result.methods;
    const RND = global.DealPilotRND;
    const fmtJ = function (n) { return RND.fmtNum2(n).replace(',00', ''); };

    // V194: Komplett neu — Hero-Box mit Animation + saubere Tabelle. KEINE Exports.
    var lohntText = (afa && afa.empfehlung) ? afa.empfehlung
      : 'Detaillierte AfA-Berechnung im Gutachten.';

    let html = ''
      // ─── Hero-Box mit Skalier-Animation + Sternschnuppen ──────────────
      + '<div style="position:relative;overflow:hidden;background:linear-gradient(135deg,#0d0c0c 0%,#2A2727 50%,#1a1818 100%);color:#fff;border-radius:16px;padding:42px 36px 36px;margin-bottom:20px;box-shadow:0 12px 36px rgba(0,0,0,0.32),0 0 0 1px rgba(201,168,76,0.18) inset">'
      + '  <div style="position:absolute;top:-60%;right:-15%;width:480px;height:480px;background:radial-gradient(circle,rgba(201,168,76,0.22) 0%,transparent 65%);pointer-events:none;z-index:0"></div>'
      // 6 Sternschnuppen
      + '  <span class="rndw-spark" style="position:absolute;top:18%;left:12%;width:6px;height:6px;border-radius:50%;background:#FFE680;box-shadow:0 0 8px 2px #FFE680;animation:rndw-spark 2.8s ease-out 0.0s infinite;z-index:1"></span>'
      + '  <span class="rndw-spark" style="position:absolute;top:32%;left:78%;width:5px;height:5px;border-radius:50%;background:#FFD66B;box-shadow:0 0 8px 2px #FFD66B;animation:rndw-spark 3.2s ease-out 0.6s infinite;z-index:1"></span>'
      + '  <span class="rndw-spark" style="position:absolute;top:64%;left:22%;width:4px;height:4px;border-radius:50%;background:#FFEC9C;box-shadow:0 0 6px 2px #FFEC9C;animation:rndw-spark 3.5s ease-out 1.2s infinite;z-index:1"></span>'
      + '  <span class="rndw-spark" style="position:absolute;top:48%;left:88%;width:5px;height:5px;border-radius:50%;background:#FFD66B;box-shadow:0 0 7px 2px #FFD66B;animation:rndw-spark 3.0s ease-out 1.8s infinite;z-index:1"></span>'
      + '  <span class="rndw-spark" style="position:absolute;top:78%;left:55%;width:5px;height:5px;border-radius:50%;background:#FFE680;box-shadow:0 0 8px 2px #FFE680;animation:rndw-spark 2.5s ease-out 0.3s infinite;z-index:1"></span>'
      + '  <span class="rndw-spark" style="position:absolute;top:24%;left:48%;width:4px;height:4px;border-radius:50%;background:#FFEC9C;box-shadow:0 0 6px 2px #FFEC9C;animation:rndw-spark 3.4s ease-out 2.1s infinite;z-index:1"></span>'
      + '  <div style="position:relative;z-index:2">'
      + '    <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:rgba(201,168,76,0.85);font-weight:700;margin:0 0 4px;text-align:center">Geschätzte Restnutzungsdauer</p>'
      + '    <p style="font-size:10px;color:rgba(255,255,255,0.45);text-align:center;margin:0 0 14px;font-style:italic">(Ersteinschätzung — verbindliche Berechnung im Gutachten)</p>'
      + '    <h2 style="font-family:Cormorant Garamond,serif;font-size:110px;font-weight:600;color:#C9A84C;line-height:0.95;letter-spacing:-2px;margin:0;text-align:center;text-shadow:0 0 30px rgba(201,168,76,0.45),0 0 60px rgba(201,168,76,0.22),0 4px 16px rgba(0,0,0,0.4);transform-origin:center;animation:rndw-zoom-in 1.2s cubic-bezier(0.34,1.56,0.64,1) 0.2s both, rndw-pulse 4s ease-in-out 1.4s infinite">'
      + fmtJ(result.final_rnd)
      + '<span style="font-family:DM Sans,sans-serif;font-size:24px;font-weight:500;color:#C9A84C;margin-left:10px;letter-spacing:0.5px;vertical-align:middle;opacity:0.85">Jahre</span>'
      + '    </h2>'
      + '    <p style="margin:14px 0 0;font-size:13px;color:rgba(255,255,255,0.7);line-height:1.5;text-align:center;font-style:italic;animation:rndw-fade-in 0.8s ease-out 1.2s both">'
      + escapeHtml(lohntText)
      + '    </p>'
      + '  </div>'
      + '  <style>'
      + '    @keyframes rndw-zoom-in { 0%{transform:scale(0.15);opacity:0;filter:blur(8px)} 50%{opacity:1;filter:blur(0)} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1;filter:blur(0)} }'
      + '    @keyframes rndw-spark { 0%{transform:scale(0);opacity:0} 20%{transform:scale(1.4);opacity:1} 60%{transform:scale(0.8);opacity:0.6} 100%{transform:scale(0);opacity:0} }'
      + '    @keyframes rndw-pulse { 0%,100%{text-shadow:0 0 30px rgba(201,168,76,0.45),0 0 60px rgba(201,168,76,0.22),0 4px 16px rgba(0,0,0,0.4)} 50%{text-shadow:0 0 40px rgba(201,168,76,0.6),0 0 80px rgba(201,168,76,0.35),0 4px 16px rgba(0,0,0,0.4)} }'
      + '    @keyframes rndw-fade-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }'
      + '  </style>'
      + '</div>';

    // ─── Tabelle "Wie die Schätzung zustande kommt" ────────────────
    html += '<div style="background:#fff;border:1px solid rgba(201,168,76,0.22);border-radius:12px;padding:20px 24px;margin-bottom:16px;box-shadow:0 2px 12px rgba(42,39,39,0.08);animation:rndw-fade-in 0.8s ease-out 1.8s both">'
      + '  <h3 style="margin:0 0 14px;font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:0.15em;text-transform:uppercase;padding-bottom:10px;border-bottom:1px solid rgba(201,168,76,0.22);display:flex;align-items:center;gap:8px">'
      + '    <span style="display:block;width:3px;height:12px;background:#C9A84C;border-radius:2px"></span>Wie die Schätzung zustande kommt'
      + '  </h3>'
      + '  <table style="width:100%;border-collapse:collapse;font-size:13px">'
      + '    <tr><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;color:#7A7370">Linear-Verfahren</td><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;text-align:right;font-variant-numeric:tabular-nums;color:#2A2727">' + fmtJ(m.linear.restnutzungsdauer) + ' J. (' + RND.fmtNum2(m.linear.alterswertminderung_pct) + ' % AWM)</td></tr>'
      + '    <tr><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;color:#7A7370">Punktraster-Verfahren</td><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;text-align:right;font-variant-numeric:tabular-nums;color:#2A2727">' + fmtJ(m.punktraster.restnutzungsdauer) + ' J. (' + RND.fmtNum2(m.punktraster.alterswertminderung_pct) + ' % AWM)</td></tr>'
      + '    <tr><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;color:#7A7370">Technisches Verfahren</td><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;text-align:right;font-variant-numeric:tabular-nums;color:#2A2727">' + fmtJ(m.technisch.restnutzungsdauer) + ' J. (' + RND.fmtNum2(m.technisch.alterswertminderung_pct) + ' % AWM)</td></tr>'
      + '    <tr><td style="padding:10px 4px;border-bottom:2px solid #C9A84C;color:#2A2727;font-weight:600">= Geschätzte RND <span style="color:#7A7370;font-size:11.5px;font-weight:400">(' + result.final_source + ')</span></td><td style="padding:10px 4px;border-bottom:2px solid #C9A84C;text-align:right;font-variant-numeric:tabular-nums;color:#C9A84C;font-weight:700;font-family:Cormorant Garamond,serif;font-size:16px">' + fmtJ(result.final_rnd) + ' Jahre</td></tr>';

    if (afa && afa.valid) {
      html += ''
        + '    <tr><td colspan="2" style="padding:16px 0 6px;color:#C9A84C;font-size:9.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">AfA-Vergleich</td></tr>'
        + '    <tr><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;color:#7A7370;font-size:12px">Standard-AfA <span style="color:#C9A84C;font-weight:600">' + afa.afa_standard.satz_pct + ' %</span> × Gebäudeanteil</td><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;text-align:right;font-variant-numeric:tabular-nums;color:#2A2727">' + fmtEUR(afa.afa_standard.jahresbetrag) + ' / Jahr</td></tr>'
        + '    <tr><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;color:#7A7370;font-size:12px">Reduzierte AfA <span style="color:#C9A84C;font-weight:600">' + afa.afa_kurz.satz_pct + ' %</span> × Gebäudeanteil</td><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;text-align:right;font-variant-numeric:tabular-nums;color:#2A2727">' + fmtEUR(afa.afa_kurz.jahresbetrag) + ' / Jahr</td></tr>'
        + '    <tr><td style="padding:10px 4px;border-bottom:1.5px solid #E0DBD3;color:#2A2727;font-weight:600">= Mehr-AfA pro Jahr</td><td style="padding:10px 4px;border-bottom:1.5px solid #E0DBD3;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:#3FA56C">+' + fmtEUR(afa.mehr_afa_jahr) + '</td></tr>'
        + '    <tr><td colspan="2" style="padding:16px 0 6px;color:#C9A84C;font-size:9.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase">Steuerlicher Vorteil <span style="color:#7A7370;font-weight:500;text-transform:none;letter-spacing:0.05em">(Grenzsteuersatz ' + afa.input.grenzsteuersatz_pct + ' %)</span></td></tr>'
        + '    <tr><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;color:#2A2727">Steuerersparnis pro Jahr</td><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#2A2727">' + fmtEUR(afa.steuerersparnis_jahr) + '</td></tr>'
        + '    <tr><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;color:#2A2727">Steuerersparnis Gesamt <span style="color:#7A7370;font-size:11.5px">(über ' + afa.input.rnd + ' Jahre)</span></td><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#2A2727">' + fmtEUR(afa.steuerersparnis_barwert) + '</td></tr>'
        + '    <tr><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;color:#B8625C">− Gutachterkosten <span style="color:#7A7370;font-size:11.5px;font-style:italic">(999 € ohne Außenbesichtigung)</span></td><td style="padding:8px 4px;border-bottom:1px solid #F0ECE4;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#B8625C">−' + fmtEUR(afa.gutachterkosten) + '</td></tr>'
        + '    <tr style="background:linear-gradient(90deg,rgba(201,168,76,0.18) 0%,rgba(201,168,76,0.08) 100%)"><td style="padding:16px 10px;color:#C9A84C;font-family:Cormorant Garamond,serif;font-size:18px;font-weight:600;border-radius:8px 0 0 8px">= Netto-Vorteil</td><td style="padding:16px 10px;text-align:right;font-variant-numeric:tabular-nums;color:#C9A84C;font-family:Cormorant Garamond,serif;font-size:22px;font-weight:700;border-radius:0 8px 8px 0">' + fmtEUR(afa.netto_vorteil) + '</td></tr>';
    }

    html += '  </table></div>';

    // ─── Rechtliche Basis ──────────────────────────────────────────
    html += '<div style="padding:14px 18px;background:#FAF6E8;border-radius:8px;font-size:12px;color:#7A7370;line-height:1.5;border-left:3px solid #C9A84C">'
      + '<strong style="color:#2A2727">Rechtliche Basis:</strong> §7 Abs. 4 Satz 2 EStG, BFH IX R 25/19 (28.07.2021). Eine kürzere RND als die Standard-50-J. ist anerkennungsfähig durch Sachverständigen-Gutachten.'
      + '</div>';

    body.innerHTML = html;

    // V194: KEINE Export-Buttons mehr. Der Submit erfolgt über den
    // Wizard-Footer (siehe gotoStep + handleStepFooter).
  }

  // V194: HTML-Escape Helper
  function escapeHtml(s) {
    if (typeof s !== 'string') return s;
    return s.replace(/[&<>"']/g, function(c) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
    });
  }

  function fmtEUR(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '–';
    return n.toLocaleString('de-DE', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    });
  }

  // ============================================================
  // BERECHNUNGEN
  // ============================================================
  function computeFinalResult() {
    if (!global.DealPilotRND) return null;
    const RND = global.DealPilotRND;
    const modPunkte = computeModPoints(state.mod);
    return RND.calcAll({
      baujahr: parseInt(state.baujahr, 10) || new Date().getFullYear() - 30,
      stichtag: state.stichtag,
      gnd: gndFromObjektTyp(state.objekt_typ),
      modPoints: modPunkte.total,
      gewerkeBewertung: state.gewerke,
      schaeden: state.schaeden_ids,
      applySchadensAbschlag: state.applyAbschlag
    });
  }

  function computeAfaEstimate(result) {
    if (!global.DealPilotRND || !result) return null;
    const RND = global.DealPilotRND;
    // V195: Werte aus DealPilot-Prefill (gesetzt durch _getRndPrefill in deal-action)
    const gebAnteil = state._dpGebaeudeanteil || 200000;
    const grenz = state._dpGrenzsteuersatz || 0.42;
    const standardSatz = state._dpStandardAfaSatz || 0.02;
    return RND.calcAfaVergleich({
      gebaeudeanteil: gebAnteil,
      rnd: result.final_rnd,
      grenzsteuersatz: grenz,
      standardAfaSatz: standardSatz,
      gutachterkosten: 999,
      abzinsung: 0.02
    });
  }

  // ============================================================
  // EXPORT-FUNKTIONEN
  // ============================================================
  function exportAsPDF(result, afa) {
    if (!global.DealPilotRND_PDF) {
      alert('PDF-Modul nicht geladen. Bitte rnd-pdf.js einbinden.');
      return;
    }
    if (typeof global.jspdf === 'undefined') {
      alert('jsPDF ist nicht geladen.');
      return;
    }
    const data = buildExportPayload();
    data.__gewerkeBewertung = state.gewerke;
    try {
      const doc = global.DealPilotRND_PDF.generateGutachten({
        gutachtenData: data,
        result: result,
        afa: afa && afa.valid ? afa : null
      });
      const filename = 'Restnutzungsdauer-Gutachten_'
        + slugify(data.objekt_adresse || 'Objekt')
        + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
      doc.save(filename);
    } catch (e) {
      console.error('PDF-Export-Fehler:', e);
      alert('PDF-Fehler: ' + e.message);
    }
  }

  function exportAsDOCX(result, afa) {
    if (!global.DealPilotRND_DOCX) {
      alert('DOCX-Modul nicht geladen. Bitte rnd-docx.js einbinden.');
      return;
    }
    const data = buildExportPayload();
    try {
      global.DealPilotRND_DOCX.generateGutachten({
        gutachtenData: data,
        result: result,
        afa: afa && afa.valid ? afa : null
      });
    } catch (e) {
      console.error('DOCX-Export-Fehler:', e);
      alert('DOCX-Fehler: ' + e.message);
    }
  }

  function slugify(s) {
    return String(s).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 40);
  }

  function buildExportPayload() {
    // Identisch zum finishWizard-Output, aber direkt für Export
    return {
      objekt_typ: state.objekt_typ,
      objekt_adresse: [state.str, state.hnr].filter(Boolean).join(' ')
                    + (state.plz || state.ort ? ', ' + state.plz + ' ' + state.ort : ''),
      objekt_einheit: state.einheit,
      baujahr: parseInt(state.baujahr, 10) || new Date().getFullYear(),
      wohnflaeche: state.wohnflaeche,
      stichtag: state.stichtag,
      besichtigungsdatum: state.besichtigungsdatum,
      aktenzeichen: state.aktenzeichen,
      bauweise: state.bauweise,
      unterkellerung: state.unterkellerung,
      vollgeschosse: state.vollgeschosse,
      einheiten_gesamt: state.einheiten_gesamt,
      bedachung: state.bedachung,
      fenster: state.fenster,
      heizungsart: state.heizungsart,
      anzahl_baeder: state.anzahl_baeder,
      besonderheiten: state.besonderheiten,
      bel: state.belueftung,
      brennstoff: state.brennstoff,
      warmwasser: state.warmwasser,
      erneuerbare: state.erneuerbare,
      energieklasse: state.energieklasse,
      erschliessung: state.erschliessung,
      mod_dach: state.mod.dach, mod_fenster: state.mod.fenster,
      mod_leitungen: state.mod.leitungen, mod_heizung: state.mod.heizung,
      mod_aussenwand: state.mod.aussenwand, mod_baeder: state.mod.baeder,
      mod_innenausbau: state.mod.innenausbau, mod_technik: state.mod.technik,
      mod_grundriss: state.mod.grundriss,
      auftraggeber_name: state.auftraggeber_name,
      auftraggeber_adresse: [state.auftraggeber_strasse,
        state.auftraggeber_plz + ' ' + state.auftraggeber_ort]
        .filter(function (s) { return s.trim().length > 0; }).join(', '),
      eigentuemer_name: state.eigentuemer_abweichend
        ? state.eigentuemer_name : state.auftraggeber_name,
      eigentuemer_adresse: state.eigentuemer_abweichend
        ? [state.eigentuemer_strasse, state.eigentuemer_plz + ' ' + state.eigentuemer_ort]
            .filter(function (s) { return s.trim().length > 0; }).join(', ')
        : [state.auftraggeber_strasse, state.auftraggeber_plz + ' ' + state.auftraggeber_ort]
            .filter(function (s) { return s.trim().length > 0; }).join(', '),
      sv_name: state.sv_name,
      sv_titel: state.sv_titel,
      sv_unternehmen: state.sv_unternehmen,
      sv_adresse_z1: state.sv_adresse_z1,
      sv_adresse_z2: state.sv_adresse_z2,
      sv_email: state.sv_email,
      erstellungsort: state.erstellungsort,
      erstellungsdatum: state.erstellungsdatum
    };
  }

  // ============================================================
  // EXPORT
  // ============================================================
  global.DealPilotRND_Wizard = {
    open: open,
    close: close,
    prefillFromDealPilot: prefillFromDealPilot,
    STEPS: STEPS
  };
})(typeof window !== 'undefined' ? window : globalThis);
