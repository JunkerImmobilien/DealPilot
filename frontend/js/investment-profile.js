'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V63.76 — investment-profile.js
   Persönliches Investmentprofil: Standard-Annahmen, die bei jedem
   neuen Objekt vor-eingefüllt werden.

   Persistierung: localStorage 'dp_investment_profile'
   Default-Schema: DealPilotConfig.investmentProfileDefaults
═══════════════════════════════════════════════════════════════ */

window.DealPilotInvestmentProfile = (function() {

  var STORAGE_KEY = 'dp_investment_profile';

  function defaults() {
    return (window.DealPilotConfig && window.DealPilotConfig.investmentProfileDefaults) || {};
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) { return {}; }
  }

  function save(profile) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      return true;
    } catch (e) { return false; }
  }

  // Liefert den effektiven Wert: User-Override hat Vorrang vor Default.
  function get(key) {
    var p = load();
    if (p[key] !== undefined && p[key] !== null && p[key] !== '') return p[key];
    var d = defaults();
    return d[key];
  }

  // Wendet das Profil auf ein neu angelegtes Objekt an. Wird von newObj()
  // oder von Quick-Check beim ersten Tippen aufgerufen.
  // Nur SETZEN wenn das Feld noch leer ist — wir überschreiben keine User-Eingaben.
  function applyToNewObject() {
    var p = load();
    var d = defaults();
    var merged = {};
    Object.keys(d).forEach(function(k) { merged[k] = p[k] || d[k]; });

    function setIfEmpty(id, value) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.value && String(el.value).trim()) return;   // bereits gesetzt
      el.value = value;
      // Change-Event für calc()
      try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    }

    setIfEmpty('tilgung',     merged.tilgung_default);
    setIfEmpty('zinsbindung', merged.zinsbindung_default);
    // ek-Quote → ek-Wert (sobald kp existiert)
    var kp = parseFloat((document.getElementById('kp') || {}).value || '');
    if (kp && merged.ek_quote_default) {
      setIfEmpty('ek', Math.round(kp * merged.ek_quote_default / 100));
    }
    setIfEmpty('grenzsteuersatz', merged.grenzsteuersatz);
    // Notar/Grundbuch + Makler nur falls Inputs existieren (Investition-Tab)
    setIfEmpty('notar_pct',  merged.notar_grundbuch);
    setIfEmpty('makler_pct', merged.maklerkosten);
    // Bundesland für GrESt
    var blEl = document.getElementById('bundesland');
    if (blEl && !blEl.value && merged.bundesland) {
      blEl.value = merged.bundesland;
      try { blEl.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    }

    // V63.90: KI-Analyse-Standards aus Profil → hidden inputs + Display
    syncAiParamsToTab();
  }

  /**
   * V63.90: Synchronisiert die KI-Analyse-Parameter aus dem Profil
   * - Schreibt sie in die hidden inputs (#ai_strat, #ai_verk, #ai_risk, #ai_markt)
   *   sodass der bestehende Prompt-Builder weiter g('ai_strat') etc. nutzen kann.
   * - Aktualisiert die Display-Spans im KI-Tab.
   * Wird aufgerufen aus applyToNewObject() und nach Speichern in Settings.
   */
  function syncAiParamsToTab() {
    var p = load();
    var d = defaults();
    var aiStrat = p.ai_strat || d.ai_strat || 'Buy & Hold (Langfristig halten)';
    var aiVerk  = p.ai_verk  || d.ai_verk  || 'Mittel (normale Situation)';
    var aiRisk  = p.ai_risk  || d.ai_risk  || 'Moderat (ausgewogen)';
    var aiMarkt = p.ai_markt || d.ai_markt || 'Ausgeglichen (stabil)';
    function setVal(id, val) { var el = document.getElementById(id); if (el) el.value = val; }
    function setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }
    setVal('ai_strat', aiStrat);
    setVal('ai_verk',  aiVerk);
    setVal('ai_risk',  aiRisk);
    setVal('ai_markt', aiMarkt);
    setText('ai-param-strat-display', aiStrat);
    setText('ai-param-verk-display',  aiVerk);
    setText('ai-param-risk-display',  aiRisk);
    setText('ai-param-markt-display', aiMarkt);
  }

  // Pretty-Render: Settings-Pane HTML
  function renderPaneHtml() {
    var p = Object.assign({}, defaults(), load());
    function field(id, label, value, suffix, hint) {
      return [
        '<div class="ip-field">',
        '  <label for="', id, '">', label, '</label>',
        '  <div class="ip-field-row">',
        '    <input type="number" step="any" id="', id, '" value="', (value!=null?value:''), '">',
        suffix ? '<span class="ip-suffix">' + suffix + '</span>' : '',
        '  </div>',
        hint ? '<div class="ip-hint">' + hint + '</div>' : '',
        '</div>'
      ].join('');
    }
    function blEl() {
      var bls = [
        ['BW','Baden-Württemberg (5,0 %)'], ['BY','Bayern (3,5 %)'],
        ['BE','Berlin (6,0 %)'], ['BB','Brandenburg (6,5 %)'],
        ['HB','Bremen (5,0 %)'], ['HH','Hamburg (5,5 %)'],
        ['HE','Hessen (6,0 %)'], ['MV','Mecklenburg-Vorpommern (6,0 %)'],
        ['NI','Niedersachsen (5,0 %)'], ['NW','Nordrhein-Westfalen (6,5 %)'],
        ['RP','Rheinland-Pfalz (5,0 %)'], ['SL','Saarland (6,5 %)'],
        ['SN','Sachsen (3,5 %)'], ['ST','Sachsen-Anhalt (5,0 %)'],
        ['SH','Schleswig-Holstein (6,5 %)'], ['TH','Thüringen (5,0 %)']
      ];
      var current = p.bundesland || 'NW';
      return [
        '<div class="ip-field">',
        '  <label for="ip_bundesland">Bundesland (für Grunderwerbsteuer)</label>',
        '  <select id="ip_bundesland">',
        bls.map(function(b){ return '<option value="' + b[0] + '"' + (b[0]===current?' selected':'') + '>' + b[1] + '</option>'; }).join(''),
        '  </select>',
        '</div>'
      ].join('');
    }
    return [
      '<p class="hint" style="margin-bottom:18px">Deine persönlichen Standard-Annahmen. Werden bei jedem neuen Objekt automatisch vor-eingefüllt — du kannst sie pro Objekt jederzeit überschreiben.</p>',

      '<h3 class="ip-section">Finanzierung</h3>',
      '<div class="ip-grid">',
        field('ip_tilgung_default',     'Standard-Tilgung',          p.tilgung_default,     '% p.a.', 'z.B. 2,5 %'),
        field('ip_zinsbindung_default', 'Standard-Zinsbindung',      p.zinsbindung_default, 'Jahre',  'z.B. 10 Jahre'),
        field('ip_ek_quote_default',    'Standard-Eigenkapital',     p.ek_quote_default,    '% v. KP', 'wird automatisch in € umgerechnet'),
      '</div>',

      '<h3 class="ip-section">Bewirtschaftung</h3>',
      '<div class="ip-grid">',
        field('ip_bwk_anteil_default', 'Bewirtschaftungs-Anteil', p.bwk_anteil_default, '% der NKM', 'nicht-umlagefähig, Schätzwert'),
      '</div>',

      '<h3 class="ip-section">Persönliche Mindest-Schwellen</h3>',
      '<p class="hint">Diese Werte erscheinen ab V63.77 als farbliche Marker in den Kennzahlen — „grün" wenn dein persönliches Ziel erreicht ist.</p>',
      '<div class="ip-grid">',
        field('ip_min_dscr',            'Mindest-DSCR',           p.min_dscr,            '',      'z.B. 1,20'),
        field('ip_min_cashflow_vor_st', 'Mindest-Cashflow / Monat', p.min_cashflow_vor_st, '€',   'vor Steuer'),
        field('ip_max_ltv',             'Maximaler LTV',           p.max_ltv,             '%',    'Beleihungsauslauf'),
      '</div>',

      '<h3 class="ip-section">Steuer</h3>',
      '<div class="ip-grid">',
        field('ip_grenzsteuersatz', 'Grenzsteuersatz', p.grenzsteuersatz, '%', 'für Steuer-Modul'),
      '</div>',

      '<h3 class="ip-section">Standort & Nebenkosten</h3>',
      '<div class="ip-grid">',
        blEl(),
        field('ip_notar_grundbuch', 'Notar & Grundbuch', p.notar_grundbuch, '%', 'pauschal vom Kaufpreis'),
        field('ip_maklerkosten',    'Maklergebühr',      p.maklerkosten,    '%', 'inkl. MwSt'),
      '</div>',

      // V63.96: KI-Analyse-Parameter wandern in den Settings-Tab "KI" (Marcels Wunsch).
      // Vorher hier — jetzt zwischen Eigene Anweisungen und Vorlagen im KI-Tab.

      '<div class="ip-actions">',
      '  <button type="button" class="btn btn-primary" onclick="DealPilotInvestmentProfile.saveFromForm()">Profil speichern</button>',
      '  <button type="button" class="btn btn-outline" onclick="DealPilotInvestmentProfile.resetToDefaults()">Auf Defaults zurücksetzen</button>',
      '</div>'
    ].join('');
  }

  function saveFromForm() {
    function v(id) {
      var el = document.getElementById(id);
      if (!el) return null;
      var raw = (el.value || '').trim();
      if (raw === '') return null;
      var n = parseFloat(raw.replace(',', '.'));
      return isFinite(n) ? n : null;
    }
    function s(id) {
      var el = document.getElementById(id);
      return el ? el.value : null;
    }
    var p = {
      tilgung_default:        v('ip_tilgung_default'),
      zinsbindung_default:    v('ip_zinsbindung_default'),
      ek_quote_default:       v('ip_ek_quote_default'),
      bwk_anteil_default:     v('ip_bwk_anteil_default'),
      min_dscr:               v('ip_min_dscr'),
      min_cashflow_vor_st:    v('ip_min_cashflow_vor_st'),
      max_ltv:                v('ip_max_ltv'),
      grenzsteuersatz:        v('ip_grenzsteuersatz'),
      notar_grundbuch:        v('ip_notar_grundbuch'),
      maklerkosten:           v('ip_maklerkosten'),
      bundesland:             s('ip_bundesland'),
      // V63.90: KI-Analyse-Standards
      ai_strat:               s('ip_ai_strat'),
      ai_verk:                s('ip_ai_verk'),
      ai_risk:                s('ip_ai_risk'),
      ai_markt:               s('ip_ai_markt')
    };
    // Nullen rausfiltern (User hat das Feld leer gelassen → fällt auf Default zurück)
    Object.keys(p).forEach(function(k) { if (p[k] === null) delete p[k]; });
    save(p);
    // V63.90: KI-Tab Display & hidden Inputs sofort updaten
    syncAiParamsToTab();
    if (typeof toast === 'function') toast('✓ Investmentprofil gespeichert');
  }

  function resetToDefaults() {
    if (!confirm('Investmentprofil auf Default-Werte zurücksetzen?')) return;
    save({});
    if (typeof closeSettings === 'function') closeSettings();
    setTimeout(function() {
      if (typeof showSettings === 'function') showSettings('investmentprofile');
    }, 100);
  }

  return {
    load: load,
    get: get,
    save: save,                     // V63.96: für Settings-KI-Tab-Persist
    applyToNewObject: applyToNewObject,
    syncAiParamsToTab: syncAiParamsToTab,
    renderPaneHtml: renderPaneHtml,
    saveFromForm: saveFromForm,
    resetToDefaults: resetToDefaults
  };
})();
