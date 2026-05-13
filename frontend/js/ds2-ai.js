'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   DealPilot V38 — DS2 KI-Vorschläge + Read-Only-Übersicht in Tab Kennzahlen
   
   Public API:
     ds2AiSuggest(fieldId)  — KI-Empfehlung für ein einzelnes Feld
     ds2AiFillAll()         — KI füllt alle ds2-Felder
     renderDs2Readonly()    — rendert die Read-Only-Übersicht in Tab Kennzahlen
   
   Backend-Endpoint: POST /api/v1/ai/ds2-suggest
═══════════════════════════════════════════════════════════════════════════ */

(function() {

  // Mapping: feldId → menschenlesbares Label + erlaubte Werte (Enum)
  var DS2_FIELDS = {
    'ds2_zustand': {
      label: 'Zustand der Wohnung',
      values: ['neubau', 'gut', 'normal', 'renovierungsbeduerftig', 'stark_sanierungsbeduerftig'],
      valueLabels: {
        'neubau': 'Neubau / kernsaniert',
        'gut': 'Guter Zustand',
        'normal': 'Normaler Zustand',
        'renovierungsbeduerftig': 'Renovierungsbedürftig',
        'stark_sanierungsbeduerftig': 'Stark sanierungsbedürftig'
      }
    },
    'ds2_energie': {
      label: 'Energieklasse',
      values: ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      valueLabels: { 'A+': 'A+', 'A': 'A', 'B': 'B', 'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G', 'H': 'H' }
    },
    'ds2_mietausfall': {
      label: 'Mietausfall-Risiko',
      values: ['sehr_niedrig', 'niedrig', 'mittel', 'erhoeht', 'hoch'],
      valueLabels: {
        'sehr_niedrig': 'Sehr niedrig', 'niedrig': 'Niedrig',
        'mittel': 'Mittel', 'erhoeht': 'Erhöht', 'hoch': 'Hoch'
      }
    },
    'ds2_marktmiete': {
      label: 'Marktmiete (€/m²)',
      type: 'number',
      unit: '€/m²',
      hint: 'Reine Zahl, z.B. 9.50'
    },
    'ds2_bevoelkerung': {
      label: 'Bevölkerungsentwicklung',
      values: ['stark_wachsend', 'wachsend', 'stabil', 'leicht_fallend', 'stark_fallend'],
      valueLabels: {
        'stark_wachsend': 'Stark wachsend', 'wachsend': 'Wachsend',
        'stabil': 'Stabil', 'leicht_fallend': 'Leicht fallend', 'stark_fallend': 'Stark fallend'
      }
    },
    'ds2_nachfrage': {
      label: 'Nachfrage-Indikatoren',
      values: ['sehr_stark', 'stark', 'mittel', 'schwach', 'sehr_schwach'],
      valueLabels: {
        'sehr_stark': 'Sehr stark', 'stark': 'Stark',
        'mittel': 'Mittel', 'schwach': 'Schwach', 'sehr_schwach': 'Sehr schwach'
      }
    },
    'ds2_marktfaktor': {
      label: 'Markt-Faktor (KP/Jahresmiete)',
      type: 'number',
      unit: '',
      hint: 'Üblicher Faktor in der Region, z.B. 22'
    },
    'ds2_wertsteigerung': {
      label: 'Wertsteigerungs-Potenzial',
      values: ['sehr_hoch', 'hoch', 'mittel', 'niedrig', 'keines'],
      valueLabels: {
        'sehr_hoch': 'Sehr hoch', 'hoch': 'Hoch',
        'mittel': 'Mittel', 'niedrig': 'Niedrig', 'keines': 'Keines'
      }
    },
    'ds2_entwicklung': {
      label: 'Entwicklungsmöglichkeiten',
      values: ['mehrere', 'eine_starke', 'begrenzt', 'kaum', 'keine'],
      valueLabels: {
        'mehrere': 'Mehrere klare Möglichkeiten', 'eine_starke': 'Eine starke Möglichkeit',
        'begrenzt': 'Begrenzt', 'kaum': 'Kaum', 'keine': 'Keine'
      }
    }
  };

  /* ─────────────────────────────────────────────────────────────
     Context für die KI sammeln (Adresse, Kennzahlen, Objektart)
   ─────────────────────────────────────────────────────────────*/
  function _buildContext() {
    function v(id) { var e = document.getElementById(id); return e ? e.value : ''; }
    function n(id) { return (typeof parseDe === 'function') ? parseDe(v(id)) : (parseFloat(v(id)) || 0); }

    // V44: Beste verfügbare Bewertung — Bankbewertung > Sachverständigenwert > Kaufpreis
    var bankval = n('bankval');
    var svwert  = n('svwert');
    var kp      = n('kp');
    var bewertung = bankval || svwert || kp;

    var ctx = {
      adresse: [v('str') + ' ' + v('hnr'), v('plz') + ' ' + v('ort')]
        .map(function(s) { return s.trim(); }).filter(Boolean).join(', '),
      strasse: v('str'),
      hausnr: v('hnr'),
      plz: v('plz'),
      ort: v('ort'),
      objektart: v('objart'),
      baujahr: v('baujahr'),
      wohnflaeche: n('wfl'),
      kaufpreis: kp,
      nettokaltmiete: n('nkm'),
      makrolage: v('makrolage'),
      mikrolage: v('mikrolage'),
      // V44: Immobilienwert für Lage-Beurteilung (überteuert/marktgerecht/Schnäppchen)
      bewertung: bewertung,
      bankbewertung: bankval || null,
      sachverstaendigenwert: svwert || null
    };
    return ctx;
  }

  function _getToken() {
    return localStorage.getItem('ji_token') || '';
  }
  function _getUserApiKey() {
    try {
      var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
      // V51: Sowohl openai_api_key (neu) als auch openaiApiKey (alt) unterstützen
      return s.openai_api_key || s.openaiApiKey || '';
    } catch(e) { return ''; }
  }
  // V51: Determinismus + Stil aus Settings ziehen
  function _getAiOptions() {
    try {
      var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
      return {
        temperature: s.ai_temperature != null ? parseFloat(s.ai_temperature) : 0,
        seed:        s.ai_seed != null ? (parseInt(s.ai_seed, 10) || 42) : 42,
        tone:        s.ai_tone || '',
        riskBias:    s.ai_risk_bias || '',
        length:      s.ai_length || '',
        // V63.21: Prompt-Qualitätseinstellungen
        detailLevel: s.ai_detail_level || '',
        tonality:    s.ai_tonality || '',
        focusAreas:  Array.isArray(s.ai_focus_areas) ? s.ai_focus_areas : [],
        customInstructions: (s.ai_custom_instructions || '').toString().slice(0, 500)
      };
    } catch(e) {
      return { temperature: 0, seed: 42, tone: '', riskBias: '', length: '',
               detailLevel: '', tonality: '', focusAreas: [], customInstructions: '' };
    }
  }

  /* ─────────────────────────────────────────────────────────────
     KI-Vorschlag für ein einzelnes Feld
   ─────────────────────────────────────────────────────────────*/
  async function ds2AiSuggest(fieldId) {
    var spec = DS2_FIELDS[fieldId];
    if (!spec) {
      if (typeof toast === 'function') toast('⚠ Unbekanntes Feld: ' + fieldId);
      return;
    }
    var input = document.getElementById(fieldId);
    if (!input) return;

    // Adress-Check — ohne Adresse keine sinnvolle KI-Antwort
    var ctx = _buildContext();
    if (!ctx.ort) {
      if (typeof toast === 'function') toast('⚠ Bitte zuerst Adresse (mind. Ort) im Tab Objekt eintragen.');
      return;
    }

    // Indikator: Feld highlight
    input.classList.add('ds2-loading');
    var origPlaceholder = input.placeholder;
    if (input.tagName === 'INPUT') input.placeholder = 'KI denkt nach…';

    try {
      var res = await fetch('/api/v1/ai/ds2-suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + _getToken()
        },
        body: JSON.stringify({
          fields: [fieldId],
          fieldSpecs: { [fieldId]: spec },
          context: ctx,
          userApiKey: _getUserApiKey(),
          aiOptions: _getAiOptions()
        })
      });
      var data;
      try { data = await res.json(); } catch(e) { data = {}; }
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));

      var s = data.suggestions && data.suggestions[fieldId];
      if (!s) throw new Error('Keine Empfehlung erhalten');

      // Inline-Suggest-Box anzeigen
      _showSuggestionBox(fieldId, s);
    } catch (err) {
      if (typeof toast === 'function') toast('⚠ KI-Fehler: ' + (err.message || 'unbekannt'));
    } finally {
      input.classList.remove('ds2-loading');
      if (input.tagName === 'INPUT') input.placeholder = origPlaceholder;
    }
  }

  /* ─────────────────────────────────────────────────────────────
     KI füllt alle Felder auf einmal
   ─────────────────────────────────────────────────────────────*/
  async function ds2AiFillAll() {
    var ctx = _buildContext();
    if (!ctx.ort) {
      if (typeof toast === 'function') toast('⚠ Bitte zuerst Adresse (mind. Ort) im Tab Objekt eintragen.');
      return;
    }

    var btn = document.getElementById('ds2-ai-fill-btn');
    if (btn) { btn.disabled = true; btn.textContent = '✨ KI denkt nach…'; }

    var allFields = Object.keys(DS2_FIELDS);
    try {
      var res = await fetch('/api/v1/ai/ds2-suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + _getToken()
        },
        body: JSON.stringify({
          fields: allFields,
          fieldSpecs: DS2_FIELDS,
          context: ctx,
          userApiKey: _getUserApiKey(),
          aiOptions: _getAiOptions()
        })
      });
      var data;
      try { data = await res.json(); } catch(e) { data = {}; }
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));

      // Alle Empfehlungen in einem zentralen Modal anzeigen für Bulk-Übernahme
      _showBulkSuggestionsModal(data.suggestions || {});
    } catch (err) {
      if (typeof toast === 'function') toast('⚠ KI-Fehler: ' + (err.message || 'unbekannt'));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '✨ Mit KI ausfüllen'; }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     UI: Inline-Suggestion-Box (für Einzelfeld-Vorschlag)
   ─────────────────────────────────────────────────────────────*/
  function _showSuggestionBox(fieldId, sugg) {
    // Existierende entfernen
    var existing = document.getElementById('ds2-sugg-' + fieldId);
    if (existing) existing.remove();

    var input = document.getElementById(fieldId);
    if (!input) return;

    var spec = DS2_FIELDS[fieldId];
    var displayValue = (spec.valueLabels && spec.valueLabels[sugg.value]) || sugg.value;

    var box = document.createElement('div');
    box.id = 'ds2-sugg-' + fieldId;
    box.className = 'ds2-sugg-box';
    box.innerHTML =
      '<div class="ds2-sugg-head">' +
        '<span class="ds2-sugg-icon">✨</span>' +
        '<span class="ds2-sugg-label">KI-Vorschlag: <strong>' + _escHtml(displayValue) + '</strong></span>' +
        '<button type="button" class="ds2-sugg-close" aria-label="Schließen">×</button>' +
      '</div>' +
      (sugg.reasoning ? '<div class="ds2-sugg-reason">' + _escHtml(sugg.reasoning) + '</div>' : '') +
      (sugg.source ? '<div class="ds2-sugg-source">📎 Quelle: ' + _renderSourceWithLink(sugg.source) + '</div>' : '') +
      '<div class="ds2-sugg-actions">' +
        '<button type="button" class="btn btn-gold btn-sm ds2-sugg-apply">Übernehmen</button>' +
        '<button type="button" class="btn btn-ghost btn-sm ds2-sugg-skip">Verwerfen</button>' +
      '</div>';

    // Direkt nach dem Feld einsetzen
    var parent = input.closest('.f') || input.parentElement;
    parent.appendChild(box);

    box.querySelector('.ds2-sugg-close').onclick = function() { box.remove(); };
    box.querySelector('.ds2-sugg-skip').onclick  = function() { box.remove(); };
    box.querySelector('.ds2-sugg-apply').onclick = function() {
      _applyValue(fieldId, sugg.value, { source: sugg.source, reasoning: sugg.reasoning });
      box.remove();
      if (typeof toast === 'function') toast('✓ ' + spec.label + ': ' + displayValue);
    };
  }

  /* ─────────────────────────────────────────────────────────────
     UI: Bulk-Modal für "Alle ausfüllen"
   ─────────────────────────────────────────────────────────────*/
  function _showBulkSuggestionsModal(suggestions) {
    var existing = document.getElementById('ds2-bulk-modal');
    if (existing) existing.remove();

    var rows = '';
    var any = false;
    Object.keys(DS2_FIELDS).forEach(function(fid) {
      var spec = DS2_FIELDS[fid];
      var sugg = suggestions[fid];
      if (!sugg || !sugg.value) {
        rows += '<tr class="ds2-bulk-row ds2-bulk-row-empty">' +
          '<td>' + _escHtml(spec.label) + '</td>' +
          '<td colspan="2"><em class="muted">Keine KI-Empfehlung</em></td>' +
        '</tr>';
        return;
      }
      any = true;
      var displayVal = (spec.valueLabels && spec.valueLabels[sugg.value]) || sugg.value;
      var current = (document.getElementById(fid) || {}).value || '';
      var currentDisplay = (spec.valueLabels && spec.valueLabels[current]) || current || '–';
      rows += '<tr class="ds2-bulk-row">' +
        '<td>' + _escHtml(spec.label) + '</td>' +
        '<td><span class="ds2-bulk-current">' + _escHtml(currentDisplay) + '</span></td>' +
        '<td><label class="ds2-bulk-cell">' +
          '<input type="checkbox" class="ds2-bulk-cb" data-fid="' + fid + '" data-val="' + _escAttr(sugg.value) +
          '" data-src="' + _escAttr(sugg.source || '') + '" data-rsn="' + _escAttr(sugg.reasoning || '') + '" checked>' +
          '<span class="ds2-bulk-new">' + _escHtml(displayVal) + '</span>' +
          (sugg.source ? '<span class="ds2-bulk-source">📎 ' + _renderSourceWithLink(sugg.source) + '</span>' : '') +
          (sugg.reasoning ? '<span class="ds2-bulk-reason">' + _escHtml(sugg.reasoning) + '</span>' : '') +
        '</label></td>' +
      '</tr>';
    });

    var ov = document.createElement('div');
    ov.id = 'ds2-bulk-modal';
    ov.className = 'ds2-bulk-overlay';
    ov.innerHTML =
      '<div class="ds2-bulk-modal" role="dialog">' +
        '<div class="ds2-bulk-header">' +
          '<h3>✨ KI-Empfehlungen für Investor-Score</h3>' +
          '<button class="bmf-close" onclick="document.getElementById(\'ds2-bulk-modal\').remove()" type="button">×</button>' +
        '</div>' +
        '<div class="ds2-bulk-body">' +
          (any ? '' : '<p class="ds2-bulk-warn">Die KI hatte zu wenig Kontext. Bitte mehr Felder im Objekt-Tab ausfüllen und nochmal probieren.</p>') +
          '<table class="ds2-bulk-table">' +
            '<thead><tr><th>Feld</th><th>Aktuell</th><th>KI-Vorschlag</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
        '<div class="ds2-bulk-footer">' +
          '<button class="btn btn-ghost" onclick="document.getElementById(\'ds2-bulk-modal\').remove()" type="button">Abbrechen</button>' +
          '<div style="flex:1"></div>' +
          '<button class="btn btn-gold" id="ds2-bulk-apply" type="button">Ausgewählte übernehmen</button>' +
        '</div>' +
      '</div>';

    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);

    document.getElementById('ds2-bulk-apply').onclick = function() {
      var applied = 0;
      ov.querySelectorAll('.ds2-bulk-cb:checked').forEach(function(cb) {
        var fid = cb.getAttribute('data-fid');
        var val = cb.getAttribute('data-val');
        var src = cb.getAttribute('data-src');
        var rsn = cb.getAttribute('data-rsn');
        if (_applyValue(fid, val, { source: src, reasoning: rsn })) applied++;
      });
      ov.remove();
      if (typeof toast === 'function') toast('✓ ' + applied + ' KI-Empfehlung(en) übernommen');
    };
  }

  /* ─────────────────────────────────────────────────────────────
     Wert in ein Feld setzen + Score neu rechnen + Source persistent anzeigen
   ─────────────────────────────────────────────────────────────*/
  function _applyValue(fieldId, value, sourceMeta) {
    var input = document.getElementById(fieldId);
    if (!input) return false;

    if (input.tagName === 'SELECT') {
      var found = false;
      for (var i = 0; i < input.options.length; i++) {
        if (input.options[i].value === value) {
          input.selectedIndex = i;
          found = true;
          break;
        }
      }
      if (!found) {
        console.warn('ds2AiSuggest: invalid enum value', value, 'for', fieldId);
        return false;
      }
    } else {
      input.value = value;
    }
    // V39: Source persistent unter dem Feld anzeigen
    if (sourceMeta && (sourceMeta.source || sourceMeta.reasoning)) {
      _showFieldSource(fieldId, sourceMeta);
    }
    var evt = new Event('change', { bubbles: true });
    input.dispatchEvent(evt);
    if (typeof renderDealScore2 === 'function') {
      try { renderDealScore2(); } catch(e) {}
    }
    if (typeof renderDs2Readonly === 'function') {
      try { renderDs2Readonly(); } catch(e) {}
    }
    return true;
  }

  /**
   * Persistente Source-Anzeige unter einem ds2-Feld (überschreibt vorherige).
   */
  function _showFieldSource(fieldId, meta) {
    var input = document.getElementById(fieldId);
    if (!input) return;
    var parent = input.closest('.f') || input.parentElement;
    if (!parent) return;
    // Existierende Source entfernen
    var existing = parent.querySelector('.ds2-field-source');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.className = 'ds2-field-source';
    var sourceHtml = _renderSourceWithLink(meta.source);
    el.innerHTML =
      '<span class="ds2-field-source-icon">📎</span>' +
      '<span class="ds2-field-source-text">' +
        sourceHtml +
        (meta.reasoning ? ' · ' + _escHtml(meta.reasoning) : '') +
      '</span>' +
      '<button type="button" class="ds2-field-source-x" onclick="this.parentElement.remove()" aria-label="Quelle ausblenden">×</button>';
    parent.appendChild(el);
  }

  /**
   * V40: Source-Text → klickbarer Link wenn bekannte Quelle.
   * Mappt z.B. "Mietspiegel Herford 2024" auf eine Stadt-Suche.
   */
  function _renderSourceWithLink(src) {
    src = src || 'KI-Marktbewertung';
    var srcEsc = _escHtml(src);
    var url = _resolveSourceUrl(src);
    if (!url) return '<strong>' + srcEsc + '</strong>';
    return '<a href="' + _escAttr(url) + '" target="_blank" rel="noopener" class="ds2-source-link"><strong>' + srcEsc + '</strong> ↗</a>';
  }

  /**
   * Best-Effort-URL-Resolver für bekannte Quellen.
   * Gibt null zurück wenn keine sinnvolle URL bestimmbar.
   */
  function _resolveSourceUrl(src) {
    if (!src) return null;
    var s = src.toLowerCase();

    // Wenn die Source bereits eine URL ist
    var urlMatch = src.match(/(https?:\/\/[^\s)]+)/);
    if (urlMatch) return urlMatch[1];

    // Mietspiegel: extract Stadt-Name → Google-Suche
    var msMatch = src.match(/mietspiegel\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)/i);
    if (msMatch) {
      return 'https://www.google.com/search?q=' + encodeURIComponent('Mietspiegel ' + msMatch[1] + ' aktuell');
    }

    // Bekannte Quellen
    if (s.indexOf('interhyp') >= 0) return 'https://www.interhyp.de/baufinanzierung/zinsen/zinsentwicklung.html';
    if (s.indexOf('dr. klein') >= 0 || s.indexOf('dr klein') >= 0) return 'https://www.drklein.de/zinsen.html';
    if (s.indexOf('fmh') >= 0) return 'https://www.fmh.de/finanzberatung/baugeld';
    if (s.indexOf('statistisches bundesamt') >= 0 || s.indexOf('destatis') >= 0) return 'https://www.destatis.de';
    if (s.indexOf('bbsr') >= 0) return 'https://www.bbsr.bund.de';
    if (s.indexOf('immowelt') >= 0) return 'https://www.immowelt.de/immobilienpreise';
    if (s.indexOf('immoscout') >= 0 || s.indexOf('immobilienscout') >= 0) return 'https://www.immobilienscout24.de/immobilienpreise.html';
    if (s.indexOf('ivd') >= 0) return 'https://ivd.net';
    if (s.indexOf('haufe') >= 0) return 'https://www.haufe.de/immobilien';
    if (s.indexOf('lbs research') >= 0) return 'https://www.lbs.de/research/';

    // Generischer Fallback bei "KI-Marktbewertung" / "Branchenüblich" → kein Link
    if (s.indexOf('ki-marktbewertung') >= 0) return null;
    if (s.indexOf('branchenüblich') >= 0) return null;

    // Letzter Fallback: Google-Suche nach dem Source-Text
    return 'https://www.google.com/search?q=' + encodeURIComponent(src);
  }

  // Globaler Export für andere Module (Quick Check etc.)
  window._ds2RenderSourceLink = _renderSourceWithLink;
  window._ds2ResolveSourceUrl = _resolveSourceUrl;

  /* ─────────────────────────────────────────────────────────────
     Read-Only-Render in Tab Kennzahlen
   ─────────────────────────────────────────────────────────────*/
  function renderDs2Readonly() {
    var grid = document.getElementById('ds2-readonly-grid');
    if (!grid) return;

    var html = '';
    Object.keys(DS2_FIELDS).forEach(function(fid) {
      var spec = DS2_FIELDS[fid];
      var input = document.getElementById(fid);
      var raw = input ? input.value : '';
      var display;
      var hasValue;
      if (spec.values) {
        // Enum
        if (raw && spec.valueLabels[raw]) {
          display = spec.valueLabels[raw];
          hasValue = true;
        } else {
          display = '– keine Angabe –';
          hasValue = false;
        }
      } else {
        // Number
        var n = (typeof parseDe === 'function') ? parseDe(raw) : parseFloat(raw);
        if (n && !isNaN(n) && n !== 0) {
          display = n.toLocaleString('de-DE') + (spec.unit ? ' ' + spec.unit : '');
          hasValue = true;
        } else {
          display = '– keine Angabe –';
          hasValue = false;
        }
      }
      // Tab-Hinweis: wo wird editiert?
      var tabHint = _getTabHintForField(fid);
      html += '<div class="ds2-ro-row' + (hasValue ? '' : ' ds2-ro-empty') + '">' +
        '<div class="ds2-ro-label">' + _escHtml(spec.label) + '</div>' +
        '<div class="ds2-ro-value">' + _escHtml(display) + '</div>' +
        '<div class="ds2-ro-hint">' + tabHint + '</div>' +
      '</div>';
    });

    // V46: Berechnete KPIs (Upside) — Mietsteigerungs-Potenzial + Faktor vs. Markt
    function _val(id) {
      var e = document.getElementById(id);
      var raw = e ? e.value : '';
      return (typeof parseDe === 'function') ? parseDe(raw) : parseFloat(raw);
    }
    var nkm = _val('nkm') || 0;
    var wfl = _val('wfl') || 0;
    var kp  = _val('kp')  || 0;
    var marktMieteQm = _val('ds2_marktmiete') || 0;

    // Mietsteigerungs-Potenzial = (Marktmiete - Ist-Miete-€/qm) / Ist-Miete-€/qm × 100
    var msPotDisplay = '– fülle Marktmiete im Tab Miete um Wert zu sehen –';
    var msPotHas = false;
    if (nkm > 0 && wfl > 0 && marktMieteQm > 0) {
      var istQm = nkm / wfl;
      var msPot = (marktMieteQm - istQm) / istQm * 100;
      msPotDisplay = (msPot >= 0 ? '+' : '') + msPot.toFixed(1).replace('.', ',') + ' %';
      msPotHas = true;
    }

    // Faktor vs. Markt = KP / Markt-Jahresmiete
    var fvmDisplay = '– fülle Marktmiete + Wohnfläche um Wert zu sehen –';
    var fvmHas = false;
    if (kp > 0 && marktMieteQm > 0 && wfl > 0) {
      var marktJahr = marktMieteQm * wfl * 12;
      var fvm = kp / marktJahr;
      fvmDisplay = fvm.toFixed(1).replace('.', ',') + 'x · vs. Marktmiete';
      fvmHas = true;
    }

    html += '<div class="ds2-ro-row ds2-ro-derived' + (msPotHas ? '' : ' ds2-ro-empty') + '">' +
      '<div class="ds2-ro-label">Mietsteigerungs-Potenzial</div>' +
      '<div class="ds2-ro-value">' + _escHtml(msPotDisplay) + '</div>' +
      '<div class="ds2-ro-hint">Berechnet · Tab Miete</div>' +
    '</div>';
    html += '<div class="ds2-ro-row ds2-ro-derived' + (fvmHas ? '' : ' ds2-ro-empty') + '">' +
      '<div class="ds2-ro-label">Faktor vs. Markt</div>' +
      '<div class="ds2-ro-value">' + _escHtml(fvmDisplay) + '</div>' +
      '<div class="ds2-ro-hint">Berechnet · Tab Miete</div>' +
    '</div>';

    grid.innerHTML = html;
  }

  function _getTabHintForField(fid) {
    // Tab-Mapping
    var tabIdx = {
      'ds2_zustand': 0,    'ds2_energie': 0,
      'ds2_bevoelkerung': 1, 'ds2_nachfrage': 1,
      'ds2_wertsteigerung': 1, 'ds2_entwicklung': 1,
      'ds2_marktmiete': 3, 'ds2_mietausfall': 3,
      'ds2_marktfaktor': 2
    };
    /* V51: Tabs sind jetzt [Quick, Objekt, Investition, Miete, Steuer, Finanzierung, BWK, KI, Kennzahlen] */
    var tabNames = ['Quick-Check', 'Objekt', 'Investition', 'Miete', 'Steuer', 'Finanzierung', 'BWK', 'KI', 'Kennzahlen'];
    var idx = tabIdx[fid];
    if (idx == null) return '';
    return '<button type="button" class="ds2-ro-jump" onclick="switchTab(' + idx + ')">' + tabNames[idx] + ' →</button>';
  }

  /* ─────────────────────────────────────────────────────────────
     Helpers
   ─────────────────────────────────────────────────────────────*/
  function _escHtml(s) {
    return ('' + (s == null ? '' : s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function _escAttr(s) {
    return _escHtml(s).replace(/"/g, '&quot;');
  }

  // Hook: Read-Only nach jedem Tab-Wechsel auf Kennzahlen aktualisieren
  // + nach Render von DealScore2 + nach jedem Save/Load
  function _autoRefresh() {
    // Wenn Tab Kennzahlen aktiv ist, refresh
    var s6 = document.getElementById('s6');
    if (s6 && s6.classList.contains('active')) {
      renderDs2Readonly();
    }
  }

  // Alle Selects mit ds2_-Prefix → bei change auch readonly refreshen
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      _hookFieldChanges();
      renderDs2Readonly();
    });
  } else {
    setTimeout(function() {
      _hookFieldChanges();
      renderDs2Readonly();
    }, 0);
  }

  function _hookFieldChanges() {
    Object.keys(DS2_FIELDS).forEach(function(fid) {
      var el = document.getElementById(fid);
      if (el && !el.dataset.ds2Hooked) {
        el.dataset.ds2Hooked = '1';
        el.addEventListener('change', _autoRefresh);
        el.addEventListener('input', _autoRefresh);
      }
    });
  }

  // Globale Exports
  window.ds2AiSuggest    = ds2AiSuggest;
  window.ds2AiFillAll    = ds2AiFillAll;
  window.renderDs2Readonly = renderDs2Readonly;
  window.DS2_FIELDS      = DS2_FIELDS;
  window._dpDs2Fields    = DS2_FIELDS;     // V44: Alias für gebündelten Lage-Call
})();

/* ═══════════════════════════════════════════════════════════════
   V44: Lage-KI als EIN gebündelter Call (statt 4 sequentiell)
   Wie /api/v1/ai/lage — eine Anfrage mit allen 4 Feldern + Bewertung
═══════════════════════════════════════════════════════════════ */
async function ds2AiSuggestAllLage() {
  var btn = document.getElementById('ds2-ai-all-lage');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="font-size:13px">⏳</span> KI recherchiert…'; }

  var fields = ['ds2_bevoelkerung', 'ds2_nachfrage', 'ds2_wertsteigerung', 'ds2_entwicklung',
                'ds2_marktmiete', 'ds2_mietausfall'];     // V46: Marktmiete + Mietausfall mit rein

  // Context aus dem Window-internen _buildContext bauen wir hier nochmal selbst
  // weil das in einem IIFE ist (nicht direkt zugänglich)
  function v(id) { var e = document.getElementById(id); return e ? e.value : ''; }
  function n(id) { return (typeof parseDe === 'function') ? parseDe(v(id)) : (parseFloat(v(id)) || 0); }

  var bankval = n('bankval'), svwert = n('svwert'), kp = n('kp');
  var ctx = {
    adresse: [v('str') + ' ' + v('hnr'), v('plz') + ' ' + v('ort')]
      .map(function(s) { return s.trim(); }).filter(Boolean).join(', '),
    strasse: v('str'),
    hausnr: v('hnr'),
    plz: v('plz'),
    ort: v('ort'),
    objektart: v('objart'),
    baujahr: v('baujahr'),
    wohnflaeche: n('wfl'),
    kaufpreis: kp,
    nettokaltmiete: n('nkm'),
    makrolage: v('makrolage'),
    mikrolage: v('mikrolage'),
    bewertung: bankval || svwert || kp,
    bankbewertung: bankval || null,
    sachverstaendigenwert: svwert || null
  };

  if (!ctx.ort) {
    if (typeof toast === 'function') toast('⚠ Bitte zuerst Adresse (mind. Ort) eintragen.');
    if (btn) { btn.disabled = false; btn.innerHTML = '<span style="font-size:13px">✨</span> Alle Lage-Felder mit KI ausfüllen'; }
    return;
  }

  // FieldSpecs für die 4 Felder zusammenstellen
  var fieldSpecs = {};
  if (window._dpDs2Fields) {
    fields.forEach(function(f) { if (window._dpDs2Fields[f]) fieldSpecs[f] = window._dpDs2Fields[f]; });
  }

  // Loading-Indicator auf jedem der 4 Felder
  fields.forEach(function(fid) {
    var inp = document.getElementById(fid);
    if (inp) inp.classList.add('ds2-loading');
  });

  var token = localStorage.getItem('ji_token') || '';
  var userApiKey = '';
  try { userApiKey = (JSON.parse(localStorage.getItem('dp_user_settings') || '{}').openaiApiKey) || ''; } catch(e){}

  try {
    var res = await fetch('/api/v1/ai/ds2-suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        fields: fields,
        fieldSpecs: fieldSpecs,
        context: ctx,
        userApiKey: userApiKey,
        aiOptions: _getAiOptions()
      })
    });
    var data;
    try { data = await res.json(); } catch(e) { data = {}; }
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));

    var applied = 0;
    fields.forEach(function(fid) {
      var s = data.suggestions && data.suggestions[fid];
      if (!s) return;
      var inp = document.getElementById(fid);
      if (inp && s.value) {
        // Select-Field: value setzen
        inp.value = s.value;
        // Source-Box anhängen falls Helper da
        if (typeof window._ds2RenderSourceBox === 'function') {
          window._ds2RenderSourceBox(fid, s);
        } else if (typeof window._ds2RenderSourceLink === 'function') {
          var par = inp.closest('.f') || inp.parentElement;
          if (par) {
            var existing = par.querySelector('.ds2-source-box');
            if (existing) existing.remove();
            var box = document.createElement('div');
            box.className = 'ds2-source-box';
            box.innerHTML = '<span style="font-size:13px">✨</span> ' + window._ds2RenderSourceLink(s.source || 'KI') +
              (s.reasoning ? ' · ' + s.reasoning.replace(/</g, '&lt;') : '');
            par.appendChild(box);
          }
        }
        applied++;
      }
    });

    if (typeof renderDealScore2 === 'function') renderDealScore2();

    if (typeof toast === 'function') {
      toast('✓ ' + applied + ' / ' + fields.length + ' Lage-Felder mit KI befüllt');
    }
  } catch (err) {
    if (typeof toast === 'function') toast('⚠ KI-Fehler: ' + (err.message || 'unbekannt'));
  } finally {
    fields.forEach(function(fid) {
      var inp = document.getElementById(fid);
      if (inp) inp.classList.remove('ds2-loading');
    });
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span style="font-size:13px">✨</span> Alle Lage-Felder mit KI ausfüllen';
    }
  }
}
window.ds2AiSuggestAllLage = ds2AiSuggestAllLage;
