// V63.27: KI-Mietpreis-Analyse für Tab Miete
// Eigene Implementation analog runKiLage in ki-lage.js — Vorschläge werden in der
// KI-Mietpreis-Analyse-Box gerendert (nicht inline am Feld).

async function runKiMiete() {
  var btn = document.getElementById('ki-miete-btn');
  var body = document.getElementById('ki-miete-body');
  if (!body) return;

  // V63.82: KI-Credits-Gate
  if (typeof Paywall !== 'undefined' && !Paywall.gate('ai_calls')) {
    if (btn) { btn.disabled = false; btn.textContent = 'Marktmiete recherchieren'; }
    return;
  }

  var str = (document.getElementById('str') || {}).value || '';
  var hnr = (document.getElementById('hnr') || {}).value || '';
  var plz = (document.getElementById('plz') || {}).value || '';
  var ort = (document.getElementById('ort') || {}).value || '';
  if (!str || !ort) {
    body.innerHTML = '<div class="ki-miete-err">⚠ Bitte zuerst Adresse (Straße + Ort) im Tab Objekt eintragen.</div>';
    return;
  }

  function _vN(id) {
    var e = document.getElementById(id);
    if (!e) return 0;
    return (typeof parseDe === 'function') ? parseDe(e.value) : (parseFloat((e.value||'').replace(',','.')) || 0);
  }
  var wfl = _vN('wfl');
  if (wfl <= 0) {
    body.innerHTML = '<div class="ki-miete-err">⚠ Bitte zuerst die Wohnfläche im Tab Objekt eintragen.</div>';
    return;
  }
  var nkm = _vN('nkm');

  if (btn) { btn.disabled = true; btn.innerHTML = '<span style="font-size:13px">⏳</span> Analysiere…'; }
  body.innerHTML = '<div class="ki-miete-loading">' +
    '<div class="ki-miete-spinner"></div>' +
    'KI recherchiert Marktmiete und Mietausfall-Risiko…' +
  '</div>';

  var aiTemp = 0, aiSeed = 42, aiTone = '', aiRiskBias = '', aiLength = '';
  var aiDetailLevel = '', aiTonality = '', aiFocusAreas = [], aiCustomInstructions = '';
  var userApiKey = '';
  try {
    var settings = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
    userApiKey = settings.openai_api_key || settings.openaiApiKey || '';
    if (settings.ai_temperature != null) aiTemp = parseFloat(settings.ai_temperature);
    if (settings.ai_seed != null)        aiSeed = parseInt(settings.ai_seed, 10) || 42;
    aiTone     = settings.ai_tone || '';
    aiRiskBias = settings.ai_risk_bias || '';
    aiLength   = settings.ai_length || '';
    aiDetailLevel = settings.ai_detail_level || '';
    aiTonality    = settings.ai_tonality || '';
    aiFocusAreas  = Array.isArray(settings.ai_focus_areas) ? settings.ai_focus_areas : [];
    aiCustomInstructions = (settings.ai_custom_instructions || '').toString().slice(0, 500);
  } catch (e) {}

  var token = localStorage.getItem('ji_token') || '';

  var fieldSpecs = {
    ds2_marktmiete: {
      type: 'number',
      label: 'Marktmiete (€/m²)',
      hint: 'Markt-übliche Kaltmiete für die Region',
      domain: 'mietmarkt'
    },
    ds2_mietausfall: {
      type: 'enum',
      label: 'Mietausfall-Risiko',
      values: ['sehr_niedrig', 'niedrig', 'mittel', 'erhoeht', 'hoch'],
      valueLabels: {
        sehr_niedrig: 'Sehr niedrig',
        niedrig: 'Niedrig',
        mittel: 'Mittel',
        erhoeht: 'Erhöht',
        hoch: 'Hoch'
      },
      hint: 'Risiko von Mietausfällen oder Leerstand am Markt',
      domain: 'mietmarkt'
    }
  };

  var ctx = {
    adresse: [str + ' ' + hnr, plz + ' ' + ort].map(function(s){return s.trim()}).filter(Boolean).join(', '),
    str: str, hnr: hnr, plz: plz, ort: ort,
    kaufpreis: _vN('kp') || null,
    wohnflaeche: wfl,
    nettokaltmiete: nkm
  };

  try {
    var res = await fetch('/api/v1/ai/ds2-suggest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        fields: ['ds2_marktmiete', 'ds2_mietausfall'],
        fieldSpecs: fieldSpecs,
        context: ctx,
        userApiKey: userApiKey,
        aiOptions: {
          temperature: aiTemp,
          seed: aiSeed,
          tone: aiTone,
          riskBias: aiRiskBias,
          length: aiLength,
          detailLevel: aiDetailLevel,
          tonality: aiTonality,
          focusAreas: aiFocusAreas,
          customInstructions: aiCustomInstructions
        }
      })
    });

    var data;
    try { data = await res.json(); } catch(e) { data = {}; }
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));

    var sugMarkt = (data.suggestions || {}).ds2_marktmiete || null;
    var sugAusfall = (data.suggestions || {}).ds2_mietausfall || null;

    var istQm = wfl > 0 ? (nkm / wfl) : 0;
    var marktVal = sugMarkt && sugMarkt.value ? parseFloat(String(sugMarkt.value).replace(',', '.')) : null;
    var ausfallVal = sugAusfall && sugAusfall.value ? sugAusfall.value : null;

    var ausfallMap = {
      sehr_niedrig: { label: 'Sehr niedrig', col: '#3FA56C' },
      niedrig:      { label: 'Niedrig', col: '#3FA56C' },
      mittel:       { label: 'Mittel', col: '#C9A84C' },
      erhoeht:      { label: 'Erhöht', col: '#B8625C' },
      hoch:         { label: 'Hoch', col: '#B8625C' }
    };

    function _esc(s) { return ('' + (s == null ? '' : s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    var html = '';

    if (marktVal != null && !isNaN(marktVal)) {
      var diff = marktVal - istQm;
      var diffPct = istQm > 0 ? (diff / istQm * 100) : 0;
      var marktAbs = marktVal * wfl;
      var diffCol = diffPct > 5 ? '#3FA56C' : diffPct < -5 ? '#B8625C' : '#C9A84C';
      var diffSign = diffPct > 0 ? '+' : '';

      html += '<div class="ki-miete-block">';
      html += '<div class="ki-miete-block-header">' +
                '<span class="ki-miete-block-icon">💰</span>' +
                '<span class="ki-miete-block-title">Marktmiete</span>' +
                '<span class="ki-miete-block-value">' + marktVal.toFixed(2).replace('.', ',') + ' €/m²</span>' +
              '</div>';

      html += '<div class="ki-miete-compare">' +
                '<div class="ki-miete-compare-row">' +
                  '<span>Marktmiete (KI):</span>' +
                  '<strong>' + marktVal.toFixed(2).replace('.', ',') + ' €/m² · ' + Math.round(marktAbs).toLocaleString('de-DE') + ' €/Mon</strong>' +
                '</div>' +
                '<div class="ki-miete-compare-row">' +
                  '<span>Deine Ist-Miete:</span>' +
                  '<strong>' + istQm.toFixed(2).replace('.', ',') + ' €/m² · ' + Math.round(nkm).toLocaleString('de-DE') + ' €/Mon</strong>' +
                '</div>' +
                '<div class="ki-miete-compare-row" style="color:' + diffCol + '">' +
                  '<span>Differenz:</span>' +
                  '<strong>' + diffSign + diff.toFixed(2).replace('.', ',') + ' €/m² (' + diffSign + diffPct.toFixed(1).replace('.', ',') + ' %)</strong>' +
                '</div>' +
              '</div>';

      if (sugMarkt.reasoning) {
        html += '<div class="ki-miete-reasoning">' + _esc(sugMarkt.reasoning) + '</div>';
      }
      if (sugMarkt.source) {
        html += '<div class="ki-miete-source">📎 Quelle: ' + _renderSrcLink(sugMarkt.source) + '</div>';
      }

      html += '<div class="ki-miete-actions">';
      html += '<button type="button" class="btn btn-gold btn-sm" onclick="kiMieteApplyMarktmiete(' + marktVal + ')">Marktmiete (€/m²) übernehmen</button>';
      var newNkm = Math.round(marktVal * wfl);
      if (Math.abs(newNkm - nkm) > 5) {
        html += '<button type="button" class="btn btn-outline btn-sm" onclick="kiMieteApplyNkm(' + newNkm + ')">NKM auf ' + newNkm.toLocaleString('de-DE') + ' € setzen</button>';
      }
      html += '</div>';
      html += '</div>';
    }

    if (ausfallVal && ausfallMap[ausfallVal]) {
      var info = ausfallMap[ausfallVal];
      html += '<div class="ki-miete-block">';
      html += '<div class="ki-miete-block-header">' +
                '<span class="ki-miete-block-icon">🛡</span>' +
                '<span class="ki-miete-block-title">Mietausfall-Risiko</span>' +
                '<span class="ki-miete-block-value" style="color:' + info.col + '">' + info.label + '</span>' +
              '</div>';
      if (sugAusfall.reasoning) {
        html += '<div class="ki-miete-reasoning">' + _esc(sugAusfall.reasoning) + '</div>';
      }
      if (sugAusfall.source) {
        html += '<div class="ki-miete-source">📎 Quelle: ' + _renderSrcLink(sugAusfall.source) + '</div>';
      }
      html += '<div class="ki-miete-actions">';
      html += '<button type="button" class="btn btn-gold btn-sm" onclick="kiMieteApplyAusfall(\'' + _esc(ausfallVal) + '\')">Risiko-Einstufung übernehmen</button>';
      html += '</div>';
      html += '</div>';
    }

    if (!html) {
      html = '<div class="ki-miete-err">Keine Empfehlungen erhalten.</div>';
    } else {
      html += '<div class="ki-miete-disclaimer">Werte gelten als KI-Schätzung — vor Verwendung gegen Mietspiegel/Vergleichsmieten prüfen.</div>';
    }

    body.innerHTML = html;

  } catch (err) {
    body.innerHTML = '<div class="ki-miete-err">⚠ Fehler bei der Analyse: ' + (err.message || err) + '</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<span data-ico="sparkles" data-ico-size="14"></span> Mietpreis recherchieren'; }
    if (typeof refreshDataIcos === 'function') setTimeout(refreshDataIcos, 10);
  }
}

function _renderSrcLink(src) {
  if (!src) return '';
  if (typeof src === 'object') {
    var label = src.label || src.title || src.name || src.url || 'Quelle';
    var url = src.url || src.href || '';
    if (url) return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + ' ↗</a>';
    return label;
  }
  if (/^https?:\/\//i.test(src)) {
    return '<a href="' + src + '" target="_blank" rel="noopener noreferrer">' + src + ' ↗</a>';
  }
  return src;
}

function kiMieteApplyMarktmiete(value) {
  var el = document.getElementById('ds2_marktmiete');
  if (el) {
    el.value = value.toFixed(2).replace('.', ',');
    if (typeof dpUpdateAll === 'function') dpUpdateAll();
    else if (typeof renderDealScore2 === 'function') renderDealScore2();
    if (typeof toast === 'function') toast('✓ Marktmiete ' + value.toFixed(2).replace('.', ',') + ' €/m² übernommen');
  }
}

function kiMieteApplyNkm(value) {
  var el = document.getElementById('nkm');
  if (el) {
    el.value = String(value);
    if (typeof calc === 'function') calc();
    if (typeof toast === 'function') toast('✓ Nettokaltmiete ' + value.toLocaleString('de-DE') + ' € übernommen');
  }
}

function kiMieteApplyAusfall(value) {
  var el = document.getElementById('ds2_mietausfall');
  if (el) {
    el.value = value;
    if (typeof dpUpdateAll === 'function') dpUpdateAll();
    else if (typeof renderDealScore2 === 'function') renderDealScore2();
    var labelMap = {
      sehr_niedrig: 'Sehr niedrig', niedrig: 'Niedrig', mittel: 'Mittel', erhoeht: 'Erhöht', hoch: 'Hoch'
    };
    if (typeof toast === 'function') toast('✓ Mietausfall-Risiko: ' + (labelMap[value] || value));
  }
}

window.runKiMiete = runKiMiete;
window.kiMieteApplyMarktmiete = kiMieteApplyMarktmiete;
window.kiMieteApplyNkm = kiMieteApplyNkm;
window.kiMieteApplyAusfall = kiMieteApplyAusfall;
