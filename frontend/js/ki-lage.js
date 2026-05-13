'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V36 — KI-Lage-Bewertung (Makro + Mikro)
   Ruft den Backend-Endpoint /api/v1/ai/lage auf.
═══════════════════════════════════════════════════════════════ */

function runKiLage() {
  var btn = document.getElementById('ki-lage-btn');
  var body = document.getElementById('ki-lage-body');
  if (!body) return;

  // V63.82: KI-Credits-Gate
  if (typeof Paywall !== 'undefined' && !Paywall.gate('ai_calls')) {
    if (btn) { btn.disabled = false; btn.textContent = 'Lage analysieren'; }
    return;
  }

  // V63.82: Wenn ki_market_analysis nicht im Plan → Hinweis
  if (typeof Plan !== 'undefined' && !Plan.can('ai_market_analysis')) {
    body.innerHTML = '<div class="ki-lage-err">' +
      '🔒 KI-Lagebewertung ist Teil des <strong>Investor</strong>-Plans und höher.<br>' +
      '<button class="btn btn-gold" style="margin-top:10px" onclick="if(typeof openPricingModal===\'function\') openPricingModal();">Plan ansehen</button>' +
    '</div>';
    if (btn) { btn.disabled = false; btn.textContent = 'Lage analysieren'; }
    return;
  }

  // Adresse aus den Feldern bauen
  var str = (document.getElementById('str') || {}).value || '';
  var hnr = (document.getElementById('hnr') || {}).value || '';
  var plz = (document.getElementById('plz') || {}).value || '';
  var ort = (document.getElementById('ort') || {}).value || '';
  var adresse = [str + ' ' + hnr, plz + ' ' + ort].map(function(s) { return s.trim(); }).filter(Boolean).join(', ');
  if (!adresse) {
    body.innerHTML = '<div class="ki-lage-err">⚠ Bitte zuerst eine Adresse im Tab Objekt eintragen.</div>';
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Analysiere…'; }
  body.innerHTML = '<div class="ki-lage-loading">' +
    '<div class="ki-lage-spinner"></div>' +
    'KI recherchiert Makro- und Mikrolage…' +
  '</div>';
  // V187-h2: merken welche Adresse benutzt wurde (für Cache + Banner)
  window._kiLageCurrentRequest = { adresse: adresse, str: str, hnr: hnr, plz: plz, ort: ort, ts: Date.now() };

  // User-Key aus Settings (falls gesetzt) als Fallback mitgeben
  var userApiKey = '';
  // V51: Determinismus + Stil aus Settings ziehen
  var aiTemp = 0, aiSeed = 42, aiTone = '', aiRiskBias = '', aiLength = '';
  // V63.21: Prompt-Qualitätseinstellungen
  var aiDetailLevel = '', aiTonality = '', aiFocusAreas = [], aiCustomInstructions = '';
  try {
    var settings = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
    userApiKey = settings.openai_api_key || settings.openaiApiKey || '';
    if (settings.ai_temperature != null) aiTemp = parseFloat(settings.ai_temperature);
    if (settings.ai_seed != null)        aiSeed = parseInt(settings.ai_seed, 10) || 42;
    aiTone     = settings.ai_tone || '';
    aiRiskBias = settings.ai_risk_bias || '';
    aiLength   = settings.ai_length || '';
    // V63.21
    aiDetailLevel = settings.ai_detail_level || '';
    aiTonality    = settings.ai_tonality || '';
    aiFocusAreas  = Array.isArray(settings.ai_focus_areas) ? settings.ai_focus_areas : [];
    aiCustomInstructions = (settings.ai_custom_instructions || '').toString().slice(0, 500);
  } catch (e) {}

  var token = localStorage.getItem('ji_token') || '';

  // V63.6: Zusätzliche Daten mitsenden für die Deal-Bewertung
  function _kn(id) {
    var e = document.getElementById(id);
    if (!e) return null;
    return (typeof parseDe === 'function') ? parseDe(e.value) || null : (parseFloat((e.value||'').replace(',','.')) || null);
  }
  var kpForLage     = _kn('kp');
  var wflForLage    = _kn('wfl');
  var nkmForLage    = _kn('nkm');

  fetch('/api/v1/ai/lage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      adresse: adresse,
      str: str, hnr: hnr, plz: plz, ort: ort,
      kaufpreis:      kpForLage,
      wohnflaeche:    wflForLage,
      nettokaltmiete: nkmForLage,
      userApiKey: userApiKey,
      // V51: Determinismus + Stil
      aiOptions: {
        temperature: aiTemp,
        seed: aiSeed,
        tone: aiTone,
        riskBias: aiRiskBias,
        length: aiLength,
        // V63.21: Prompt-Qualitätseinstellungen
        detailLevel: aiDetailLevel,
        tonality: aiTonality,
        focusAreas: aiFocusAreas,
        customInstructions: aiCustomInstructions
      }
    })
  })
  .then(function(r) {
    if (!r.ok) {
      // V56: Bessere Fehlermeldung — auch wenn keine JSON-Antwort kommt
      return r.text().then(function(text) {
        var msg;
        try { msg = JSON.parse(text).error || ('HTTP ' + r.status); }
        catch(e) { msg = 'HTTP ' + r.status + ' — Backend nicht erreichbar oder Server-Fehler.'; }
        console.error('[KI-Lage] Backend-Antwort:', r.status, text);
        throw new Error(msg);
      });
    }
    return r.json();
  })
  .then(function(data) {
    if (!data.success || (!data.makro && !data.mikro)) {
      throw new Error(data.error || 'Keine Daten zurückgekommen');
    }
    _renderKiLage(data);
  })
  .catch(function(err) {
    body.innerHTML = '<div class="ki-lage-err">⚠ ' + (err.message || 'Fehler bei der Lage-Analyse') + '</div>';
  })
  .finally(function() {
    if (btn) { btn.disabled = false; btn.textContent = 'Lage neu analysieren'; }
  });
}

function _renderKiLage(data) {
  var body = document.getElementById('ki-lage-body');
  if (!body) return;

  // V63.8: Helper für Quelle pro Kategorie (klickbarer Link)
  function _renderSourceLink(source) {
    if (!source || !source.label) return '';
    if (source.url) {
      return '<a class="ki-lage-src-link" href="' + _escKi(source.url) + '" target="_blank" rel="noopener noreferrer" title="Quelle öffnen">📚 Quelle: ' + _escKi(source.label) + '</a>';
    }
    return '<span class="ki-lage-src-link ki-lage-src-link-inert">📚 Quelle: ' + _escKi(source.label) + '</span>';
  }

  function renderBox(title, kind, d) {
    if (!d) return '';
    var score = parseInt(d.score) || 0;
    var color = score >= 85 ? '#10A65C' : score >= 70 ? '#2FBE6E' : score >= 50 ? '#E5BD53' : '#D55B5B';
    return '<div class="ki-lage-card ki-lage-card-' + kind + '">' +
      '<div class="ki-lage-card-head">' +
        '<div class="ki-lage-card-title">' + title + '</div>' +
        '<div class="ki-lage-score" style="color:' + color + ';border-color:' + color + '">' + score + '<span>/100</span></div>' +
      '</div>' +
      '<div class="ki-lage-card-label" style="color:' + color + '">' + _escKi(d.label || '') + '</div>' +
      '<div class="ki-lage-card-text">' + _escKi(d.text || '') + '</div>' +
      _renderSourceLink(d.source) +
    '</div>';
  }

  // V63.6/8: Erweiterte Bewertungs-Box für die zusätzlichen Aspekte
  function renderAspect(title, kind, d, fieldId) {
    if (!d) return '';
    var score = parseInt(d.score) || 0;
    var color = score >= 85 ? '#10A65C' : score >= 70 ? '#2FBE6E' : score >= 50 ? '#E5BD53' : '#D55B5B';
    return '<div class="ki-lage-aspect-card">' +
      '<div class="ki-lage-aspect-head">' +
        '<span class="ki-lage-aspect-title">' + title + '</span>' +
        '<span class="ki-lage-aspect-score" style="color:' + color + '">' + (d.label || score + '/100') + '</span>' +
      '</div>' +
      '<div class="ki-lage-aspect-bar">' +
        '<div class="ki-lage-aspect-bar-fill" style="width:' + score + '%;background:' + color + '"></div>' +
      '</div>' +
      '<div class="ki-lage-aspect-text">' + _escKi(d.text || '') + '</div>' +
      _renderSourceLink(d.source) +
    '</div>';
  }

  // Kaufpreis-Bewertung
  function renderDealVerdict(verdict) {
    if (!verdict) return '';
    var color = verdict.tier === 'good' ? '#10A65C' :
                verdict.tier === 'fair' ? '#E5BD53' :
                verdict.tier === 'poor' ? '#D55B5B' : '#999';
    var icon  = verdict.tier === 'good' ? '✓' :
                verdict.tier === 'fair' ? '~' :
                verdict.tier === 'poor' ? '!' : '?';
    return '<div class="ki-lage-deal-verdict" style="border-color:' + color + '">' +
      '<div class="ki-lage-deal-icon" style="color:' + color + '">' + icon + '</div>' +
      '<div class="ki-lage-deal-body">' +
        '<div class="ki-lage-deal-headline" style="color:' + color + '">' + _escKi(verdict.headline || 'Deal-Bewertung') + '</div>' +
        '<div class="ki-lage-deal-text">' + _escKi(verdict.text || '') + '</div>' +
      '</div>' +
    '</div>';
  }

  // V63.6/8: 4 Zusatz-Aspekte als Grid
  var aspectsHtml = '';
  if (data.bevoelkerung || data.nachfrage || data.wertsteigerung || data.entwicklung) {
    aspectsHtml = '<div class="ki-lage-aspects-grid">' +
      renderAspect('Bevölkerungsentwicklung', 'bevoelkerung',  data.bevoelkerung, 'ds2_bevoelkerung') +
      renderAspect('Nachfrage-Indikatoren',   'nachfrage',     data.nachfrage,    'ds2_nachfrage') +
      renderAspect('Wertsteigerungs-Potenzial','wertsteigerung',data.wertsteigerung,'ds2_wertsteigerung') +
      renderAspect('Entwicklungs-Möglichkeiten','entwicklung', data.entwicklung,  'ds2_entwicklung') +
    '</div>';
  }

  body.innerHTML =
    (typeof window.KiLage !== 'undefined' && typeof window.KiLage.getAccuracyBanner === 'function'
      ? window.KiLage.getAccuracyBanner() : '') +
    '<div class="ki-lage-grid">' +
      renderBox('Makrolage', 'makro', data.makro) +
      renderBox('Mikrolage', 'mikro', data.mikro) +
    '</div>' +
    aspectsHtml +
    // V63.9: Kaufpreis-Bewertung (deal_verdict) wird hier NICHT mehr angezeigt — User-Wunsch
    '<div class="ki-lage-actions">' +
      '<button class="btn btn-gold ki-lage-apply-btn" type="button" onclick="applyKiLageToFields()">' +
        '⤓ In Felder übernehmen' +
      '</button>' +
      '<span class="ki-lage-apply-hint">Befüllt die Lage-Dropdowns im Tab Objekt mit den KI-Bewertungen.</span>' +
    '</div>';

  // V63.6: Daten zwischenspeichern für späteres "In Felder übernehmen"
  window._lastKiLageData = data;
  // V187-h2: Cache in currentDeal speichern
  try { if (window.KiLage && typeof window.KiLage.cacheResult === 'function') window.KiLage.cacheResult(); } catch(e){}
}

/**
 * V63.6/V63.8: KI-Lage-Daten in DS2-Felder im Tab Objekt übernehmen.
 * V63.8: Nutzt direkt die KI-gelieferten ENUM-Werte (keine Score-Mapping mehr).
 */
function applyKiLageToFields() {
  var d = window._lastKiLageData;
  if (!d) {
    if (typeof toast === 'function') toast('⚠ Keine KI-Lage-Daten verfügbar — bitte zuerst "Lage analysieren"');
    return;
  }

  function _setSelect(id, value) {
    var el = document.getElementById(id);
    if (!el || !value) return;
    // Prüfen ob die Option im Select existiert
    var opt = el.querySelector('option[value="' + value + '"]');
    if (opt) {
      el.value = value;
      el.dispatchEvent(new Event('change'));
    } else {
      console.warn('[applyKiLage] Option "' + value + '" nicht im Select #' + id);
    }
  }

  // V63.8: Direkter ENUM-Wert vom Backend (keine Score-Mapping mehr)
  if (d.makro && d.makro.value)         _setSelect('makrolage',          d.makro.value);
  if (d.mikro && d.mikro.value)         _setSelect('mikrolage',          d.mikro.value);
  if (d.bevoelkerung && d.bevoelkerung.value)   _setSelect('ds2_bevoelkerung',   d.bevoelkerung.value);
  if (d.nachfrage && d.nachfrage.value)         _setSelect('ds2_nachfrage',      d.nachfrage.value);
  if (d.wertsteigerung && d.wertsteigerung.value)_setSelect('ds2_wertsteigerung',d.wertsteigerung.value);
  if (d.entwicklung && d.entwicklung.value)     _setSelect('ds2_entwicklung',    d.entwicklung.value);

  if (typeof toast === 'function') toast('✓ Lage-Bewertung in Felder übernommen');
  if (typeof dpUpdateAll === 'function') dpUpdateAll();
}
window.applyKiLageToFields = applyKiLageToFields;

function _escKi(s) {
  return ('' + (s == null ? '' : s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Sparkles-Icon einsetzen
(function() {
  function fillIcon() {
    var el = document.getElementById('ki-lage-icon');
    if (el && window.Icons && window.Icons.sparkles) {
      el.innerHTML = window.Icons.sparkles({ size: 18 });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fillIcon);
  else setTimeout(fillIcon, 100);
})();

window.runKiLage = runKiLage;


// ═══════════════════════════════════════════════════════════════
// V187-h2: KI-Lage API für Object-Switch + Cache + Kontext-Banner
// ═══════════════════════════════════════════════════════════════
(function() {
  'use strict';
  
  function _getBody() { return document.getElementById('ki-lage-body'); }
  function _getBtn() { return document.getElementById('ki-lage-btn'); }
  
  function _getCurrentAddress() {
    var str = (document.getElementById('str') || {}).value || '';
    var hnr = (document.getElementById('hnr') || {}).value || '';
    var plz = (document.getElementById('plz') || {}).value || '';
    var ort = (document.getElementById('ort') || {}).value || '';
    return { str: str.trim(), hnr: hnr.trim(), plz: plz.trim(), ort: ort.trim() };
  }
  
  function _buildAccuracyBanner(addr) {
    if (!addr) addr = _getCurrentAddress();
    var hasStrasse = addr.str && addr.str.length > 0;
    var hasHnr = addr.hnr && addr.hnr.length > 0;
    var hasPlzOrt = addr.plz && addr.ort;
    
    var cls, icon, title, text;
    if (hasStrasse && hasHnr && hasPlzOrt) {
      cls = 'high';
      icon = '✓';
      title = 'Detailanalyse';
      text = 'Mit Straße + Hausnummer + PLZ/Ort — die KI liefert eine Mikrolagen-Analyse auf Straßenebene.';
    } else if (hasStrasse && hasPlzOrt) {
      cls = 'medium';
      icon = '◐';
      title = 'Detaillierte Analyse';
      text = 'Mit Straße + PLZ/Ort — die KI bewertet die Straßenebene. Für noch präzisere Ergebnisse die Hausnummer ergänzen.';
    } else if (hasPlzOrt) {
      cls = 'low';
      icon = 'ℹ';
      title = 'Generelle Lage-Einschätzung';
      text = 'Nur PLZ + Ort vorhanden — die Analyse ist generisch für das Quartier/die Stadt. Für eine präzisere Mikrolagen-Bewertung Straße und Hausnummer im Tab Objekt ergänzen.';
    } else {
      cls = 'low';
      icon = '⚠';
      title = 'Wenig Daten';
      text = 'Die Adressdaten sind unvollständig. Bitte PLZ und Ort eintragen.';
    }
    
    var bgColor, textColor, borderColor;
    if (cls === 'high') {
      bgColor = 'rgba(63, 165, 108, 0.08)';
      borderColor = 'rgba(63, 165, 108, 0.35)';
      textColor = '#2a6e48';
    } else if (cls === 'medium') {
      bgColor = 'rgba(201, 168, 76, 0.08)';
      borderColor = 'rgba(201, 168, 76, 0.35)';
      textColor = '#8b7330';
    } else {
      bgColor = 'rgba(201, 168, 76, 0.06)';
      borderColor = 'rgba(0, 0, 0, 0.10)';
      textColor = '#5f5e5a';
    }
    
    return (
      '<div style="background:' + bgColor + ';border:0.5px solid ' + borderColor + ';' +
      'border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;display:flex;' +
      'gap:8px;align-items:flex-start;color:' + textColor + ';">' +
        '<div style="font-size:14px;line-height:1;margin-top:2px">' + icon + '</div>' +
        '<div>' +
          '<div style="font-weight:600;margin-bottom:2px">' + title + '</div>' +
          '<div style="line-height:1.4">' + text + '</div>' +
        '</div>' +
      '</div>'
    );
  }
  
  // Public API
  window.KiLage = {
    // Beim Object-Switch: Anzeige zurücksetzen auf Initial-Stand
    clearResult: function() {
      var body = _getBody();
      var btn = _getBtn();
      if (body) {
        body.innerHTML = '<div class="ki-lage-empty" style="color:#888780;font-size:13px;padding:14px 0">' +
          'Klicke "Lage analysieren" für eine KI-gestützte Makro- und Mikrolagen-Bewertung.' +
        '</div>';
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Lage analysieren';
      }
      window._kiLageCurrentRequest = null;
    },
    
    // Beim Object-Load: Cache hydrieren wenn vorhanden
    hydrate: function(cache) {
      if (!cache || !cache.html) {
        this.clearResult();
        return;
      }
      var body = _getBody();
      var btn = _getBtn();
      if (!body) return;
      
      var ageMs = cache.ts ? (Date.now() - cache.ts) : 0;
      var ageDays = Math.round(ageMs / 86400000);
      var ageTxt = ageDays === 0 ? 'heute' : ageDays === 1 ? 'gestern' : 'vor ' + ageDays + ' Tagen';
      
      var addrTxt = cache.address || '(unbekannte Adresse)';
      
      var cacheBanner = 
        '<div style="background:rgba(63,165,108,0.06);border:0.5px solid rgba(63,165,108,0.30);' +
        'border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;display:flex;' +
        'gap:8px;align-items:center;justify-content:space-between;color:#2a6e48;">' +
          '<div>' +
            '<strong>Gespeicherte KI-Analyse</strong> für ' + addrTxt + ' · ' + ageTxt +
          '</div>' +
          '<button type="button" onclick="if(typeof runKiLage===\'function\')runKiLage()" ' +
          'style="background:transparent;border:0.5px solid rgba(63,165,108,0.4);' +
          'border-radius:6px;padding:4px 10px;font-size:11px;color:#2a6e48;cursor:pointer;white-space:nowrap">' +
          '↻ Neu analysieren</button>' +
        '</div>';
      
      body.innerHTML = cacheBanner + cache.html;
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Lage neu analysieren';
      }
    },
    
    // Nach erfolgreicher Analyse: Cache in currentDeal speichern
    cacheResult: function() {
      try {
        if (typeof window.currentDeal !== 'object' || !window.currentDeal) return;
        var body = _getBody();
        if (!body) return;
        var req = window._kiLageCurrentRequest;
        if (!req) return;
        
        // HTML im Body merken (ohne Banner — die werden bei Hydrate neu gemacht)
        var html = body.innerHTML;
        // Falls Loading/Empty/Error noch drin: nicht speichern
        if (html.indexOf('ki-lage-loading') >= 0 || html.indexOf('ki-lage-err') >= 0 || html.indexOf('ki-lage-empty') >= 0) {
          return;
        }
        
        window.currentDeal.ai_lage_cache = {
          html: html,
          ts: Date.now(),
          address: req.adresse,
          str: req.str, hnr: req.hnr, plz: req.plz, ort: req.ort
        };
        // Trigger save (debounced via storage.js)
        if (typeof scheduleSave === 'function') scheduleSave();
      } catch (e) {
        console.warn('[KiLage] cacheResult fail:', e);
      }
    },
    
    // Genauigkeits-Banner für Anzeige
    getAccuracyBanner: _buildAccuracyBanner
  };
})();
