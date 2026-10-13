'use strict';
/* ═══════════════════════════════════════════════════════════════
   DealPilot V36 — KI-Lage-Bewertung (Makro + Mikro)
   Ruft den Backend-Endpoint /api/v1/ai/lage auf.
═══════════════════════════════════════════════════════════════ */

/* ══ v2175 · ERST MESSEN, DANN DIE KI — UND BEIDES IM VERGLEICH ═══════════
   Marcel am 13.10.2026: „Macht im Tab Objekt die ‚Lage analysieren' noch
   Sinn? ... koennen wir das mit unseren vorhandenen Daten ... besser? Oder
   vielleicht auch beides und im Vergleich?"
   GEMESSEN vorher: reine KI mit Websuche, Quellen ungeprueft, sechs Felder
   (die Box versprach acht). Jetzt holt /marktbericht/lage/gemessen vier
   Felder aus unseren Daten (Makro, Mikro, Bevoelkerung, Nachfrage) in
   rund einer Sekunde - ohne KI, in jedem Tarif. Die KI laeuft daneben und
   liefert Texte, Wertsteigerung und Entwicklung. Beim Uebernehmen gewinnt
   die Messung; wo sie fehlt, die KI. */
var _LAGE_FELDER = [
  { id: 'makrolage',          t: 'Makrolage',             ki: 'makro' },
  { id: 'mikrolage',          t: 'Mikrolage',             ki: 'mikro' },
  { id: 'ds2_bevoelkerung',   t: 'Bevölkerung',           ki: 'bevoelkerung' },
  { id: 'ds2_nachfrage',      t: 'Nachfrage',             ki: 'nachfrage' },
  { id: 'ds2_wertsteigerung', t: 'Wertsteigerung',        ki: 'wertsteigerung' },
  { id: 'ds2_entwicklung',    t: 'Entwicklung',           ki: 'entwicklung' }
];
function _lageOptText(id, val) {
  var el = document.getElementById(id);
  var o = el && val ? el.querySelector('option[value="' + val + '"]') : null;
  return o ? o.textContent.replace(/\s*\(.*\)\s*$/, '') : (val || '–');
}
function _lageMessen(str, hnr, plz, ort) {
  if (typeof Auth === 'undefined' || !Auth.apiCall) return Promise.resolve(null);
  var adr = [(str + ' ' + hnr).trim(), (plz + ' ' + ort).trim()].filter(Boolean).join(', ');
  return Auth.apiCall('/marktbericht/lage/gemessen?adresse=' + encodeURIComponent(adr)
    + '&plz=' + encodeURIComponent(plz) + '&ort=' + encodeURIComponent(ort), { method: 'GET' })
    .then(function (r) { return (r && r.felder) ? r : null; })
    .catch(function () { return null; });
}
function _lageVergleichHtml(m, ki) {
  var f = (m && m.felder) || {};
  var zeilen = _LAGE_FELDER.map(function (x) {
    var g = f[x.id];
    var k = ki && ki[x.ki] && ki[x.ki].value ? ki[x.ki].value : null;
    var gTxt = g ? '<b>' + _escKi(_lageOptText(x.id, g.stufe)) + '</b><span class="lv-w">'
      + _escKi(String(g.wert).replace('.', ',') + ' ' + g.einheit) + '</span>' : '<span class="lv-leer">nicht gemessen</span>';
    var kTxt = ki ? (k ? _escKi(_lageOptText(x.id, k)) : '–') : '<span class="lv-leer">läuft …</span>';
    var urteil = (g && k) ? (g.stufe === k ? '<span class="lv-ok" title="Messung und KI stimmen überein">✓</span>'
      : '<span class="lv-ab" title="Messung und KI weichen ab — übernommen wird die Messung">≠</span>') : '';
    var tip = g ? (g.quelle + (g.stand ? ' · Stand ' + (typeof g.stand === 'object' ? JSON.stringify(g.stand).replace(/[{}"]/g, '') : g.stand) : '')
      + (g.zusatz ? ' · ' + g.zusatz : '') + '\nSchwelle (Modellannahme): ' + g.schwelle) : 'Für dieses Merkmal gibt es keine Messung — hier zählt die KI-Einschätzung.';
    return '<tr title="' + _escKi(tip) + '"><td>' + x.t + '</td><td>' + gTxt + '</td><td>' + kTxt + '</td><td class="lv-u">' + urteil + '</td></tr>';
  }).join('');
  return '<div class="ki-lage-vergleich">'
    + '<div class="lv-kopf">Gemessen aus unseren Daten · im Vergleich zur KI</div>'
    + '<table class="lv-tab"><thead><tr><th>Merkmal</th><th>Gemessen</th><th>KI</th><th></th></tr></thead><tbody>' + zeilen + '</tbody></table>'
    + '<div class="lv-fuss">Gemessen: Regionaldatenbank, Zensus 2022, Umfeld-Analyse — Quelle und Schwelle beim Darüberfahren. '
    + 'Beim Übernehmen gilt die Messung, wo es eine gibt.</div></div>';
}
function _lageCss() {
  if (document.getElementById('ki-lage-v2175-css')) return;
  var st = document.createElement('style'); st.id = 'ki-lage-v2175-css';
  st.textContent = '.ki-lage-vergleich{margin:0 0 14px;padding:12px 14px;border:1px solid rgba(201,168,76,.35);border-radius:12px}'
    + '.lv-kopf{font:600 11px/1.4 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--wl-b8932f, #b8932f);margin-bottom:8px}'
    + '.lv-tab{width:100%;border-collapse:collapse;font-size:12.5px}.lv-tab th{text-align:left;font:500 10.5px/1.3 "JetBrains Mono",monospace;color:#8b8678;padding:4px 6px;border-bottom:1px solid rgba(140,134,120,.3)}'
    + '.lv-tab td{padding:6px;border-bottom:1px solid rgba(140,134,120,.15);vertical-align:top}.lv-tab tr{cursor:help}'
    + '.lv-w{display:block;font:400 11px/1.3 "JetBrains Mono",monospace;color:#8b8678}.lv-leer{color:#8b8678;font-style:italic}'
    + '.lv-u{text-align:center;width:28px;font-weight:700}.lv-ok{color:#3FA56C}.lv-ab{color:#B8625C}'
    + '.lv-fuss{margin-top:8px;font-size:11.5px;color:#8b8678}';
  document.head.appendChild(st);
}

function runKiLage(opts) {
  /* v2177: {ergaenzen:true} = ein Marktbericht hat die Lage schon gemessen;
     die KI ergaenzt nur, was er nicht misst. */
  var _erg = !!(opts && opts.ergaenzen);
  var btn = document.getElementById('ki-lage-btn');
  var body = document.getElementById('ki-lage-body');
  if (!body) return;

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

  /* v2175: die Messung laeuft in JEDEM Tarif und zuerst - sie kostet keine KI. */
  _lageCss();
  window._lastLageMessung = null;
  window._lastKiLageData = null;
  var _kiFertig = false;
  var _ladeKi = '<div class="ki-lage-loading"><div class="ki-lage-spinner"></div>KI ergänzt Texte, Wertsteigerung und Entwicklung …</div>';
  if (_erg) window._kiLageErgaenzt = window._currentObjKey || '';
  var _messP = (_erg ? Promise.resolve(null) : _lageMessen(str, hnr, plz, ort)).then(function (m) {
    window._lastLageMessung = m;
    if (!_kiFertig) body.innerHTML = (m ? _lageVergleichHtml(m, null) : '') + _ladeKi;
    return m;
  });
  function _nurMessung(hinweis) {
    _messP.then(function (m) {
      body.innerHTML = (m ? _lageVergleichHtml(m, null) : '<div class="ki-lage-err">⚠ Für diese Adresse liegt keine Messung vor.</div>')
        + (hinweis ? '<div class="ki-lage-err" style="margin-top:8px">' + hinweis + '</div>' : '')
        + (m ? '<div class="ki-lage-actions"><button class="btn btn-gold ki-lage-apply-btn" type="button" onclick="applyKiLageToFields()">⤓ Gemessene Werte übernehmen</button></div>' : '');
      if (btn) { btn.disabled = false; btn.textContent = 'Lage neu analysieren'; }
    });
  }

  // V63.82: KI-Credits-Gate (v2175: gilt nur noch fuer den KI-Teil)
  if (typeof Paywall !== 'undefined' && !Paywall.gate('ai_calls')) { _nurMessung(''); return; }
  // V63.82: Wenn ki_market_analysis nicht im Plan → Hinweis
  if (typeof Plan !== 'undefined' && !Plan.can('ai_market_analysis')) {
    _nurMessung('🔒 Die KI-Ergänzung (Texte, Wertsteigerung, Entwicklung) ist Teil des <strong>Investor</strong>-Plans und höher. Die Messung oben gilt in jedem Plan.');
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
    _kiFertig = true;
    if (_erg) {
      /* v2177: nur die Felder, die der Bericht NICHT gemessen hat */
      var D = window.DealPilotMB && DealPilotMB.letzter ? DealPilotMB.letzter() : null;
      var erg = { entwicklung: data.entwicklung || null, wertsteigerung: (D && D.trendRaw != null) ? null : (data.wertsteigerung || null) };
      window._kiLageErgaenzung = window._kiLageErgaenzung || {};
      window._kiLageErgaenzung[window._currentObjKey || ''] = erg;
      [['ds2_entwicklung', erg.entwicklung], ['ds2_wertsteigerung', erg.wertsteigerung]].forEach(function (p) {
        var el = document.getElementById(p[0]);
        if (el && p[1] && p[1].value && el.querySelector('option[value="' + p[1].value + '"]')) { el.value = p[1].value; el.dispatchEvent(new Event('change')); }
      });
      if (typeof dpUpdateAll === 'function') dpUpdateAll();
      window._kiLageErgaenzt = null;
      if (typeof window._kiLageBerichtZeichnen === 'function') window._kiLageBerichtZeichnen();
      if (typeof toast === 'function') toast('✓ Per Web-Recherche ergänzt — die gemessenen Felder bleiben unverändert');
      return;
    }
    /* v2175: die Messung abwarten (sie ist fast immer schon da), dann beides zeigen */
    return _messP.then(function () { _renderKiLage(data); });
  })
  .catch(function(err) {
    _kiFertig = true;
    _nurMessung('⚠ KI-Ergänzung fehlgeschlagen: ' + _escKi(err.message || 'Fehler bei der Lage-Analyse'));
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
    (window._lastLageMessung ? _lageVergleichHtml(window._lastLageMessung, data) : '') +   /* v2175 */
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
      '<span class="ki-lage-apply-hint">Befüllt die Lage-Felder: gemessene Werte zuerst, sonst die KI-Bewertung.</span>' +
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
  var d = window._lastKiLageData || {};
  var mg = (window._lastLageMessung && window._lastLageMessung.felder) || {};
  if (!window._lastKiLageData && !Object.keys(mg).length) {
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

  /* v2175: je Feld die Messung, wo es eine gibt - sonst der KI-Wert */
  var _n = { gemessen: 0, ki: 0 };
  _LAGE_FELDER.forEach(function (x) {
    var g = mg[x.id] && mg[x.id].stufe;
    var k = d[x.ki] && d[x.ki].value;
    if (g) { _setSelect(x.id, g); _n.gemessen++; }
    else if (k) { _setSelect(x.id, k); _n.ki++; }
  });

  if (typeof toast === 'function') toast('✓ Lage übernommen — ' + _n.gemessen + ' gemessen, ' + _n.ki + ' aus der KI');
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


// V229: PLZ-Halluzinationsschutz — Frontend-Helper.
// Wird bei 422-Response von /api/v1/ai/lage oder /miete oder /bodenrichtwert aufgerufen.
window._v229ShowPlzError = function(errorBody, targetEl) {
  if (!targetEl) return;
  var reason = (errorBody && errorBody.reason) || 'invalid_plz';
  var plz = (errorBody && errorBody.plz) || (document.getElementById('plz') || {}).value || '';
  var icon = '⚠';
  var title = 'PLZ-Problem';
  var hint = '';
  if (reason === 'test_plz') {
    icon = '🤖';
    title = 'PLZ sieht nach Test-Eingabe aus';
    hint = 'Die PLZ "' + plz + '" wird häufig als Demo-Wert verwendet. Damit die KI keine ' +
           'erfundenen Lage-Bewertungen liefert, ist sie geblockt. Bitte echte PLZ eintragen.';
  } else if (reason === 'out_of_range') {
    icon = '📮';
    title = 'PLZ außerhalb des deutschen Bereichs';
    hint = 'Die PLZ "' + plz + '" liegt nicht im gültigen deutschen Bereich (01067–99998).';
  } else if (reason === 'invalid_format') {
    icon = '✏';
    title = 'Ungültiges PLZ-Format';
    hint = 'Eine deutsche Postleitzahl hat genau 5 Ziffern (z.B. 32049).';
  } else {
    hint = (errorBody && errorBody.error) || 'Die KI-Analyse wurde aus PLZ-Gründen geblockt.';
  }
  targetEl.innerHTML =
    '<div class="ki-lage-err" style="text-align:left;padding:16px;background:rgba(245,180,40,0.10);border-left:3px solid #E5A847;border-radius:6px">' +
      '<div style="font-size:24px;margin-bottom:4px">' + icon + '</div>' +
      '<div style="font-weight:600;color:#9C7223;margin-bottom:6px">' + title + '</div>' +
      '<div style="font-size:13px;color:var(--muted)">' + hint + '</div>' +
      '<div style="margin-top:10px"><button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById(\'plz\').focus();document.getElementById(\'plz\').scrollIntoView({behavior:\'smooth\',block:\'center\'})">PLZ-Feld öffnen →</button></div>' +
    '</div>';
};

/* ══ v2177 · LIEGT EIN MARKTBERICHT VOR, WIRD NICHT NOCHMAL ANALYSIERT ════
   Marcel am 13.10.2026: „wenn wir einen Marktbericht abgerufen haben, der
   es bereits eingetragen hat, sollten wir die Moeglichkeit des Abrufes
   nicht mehr anbieten ... dann koennen wir dort reinschreiben als Info,
   dass wir den Stand aus Marktbericht uebernommen haben. ... man koennte
   sonst noch den Abgleich gegenueber Webrecherche anbieten, aber ist das
   sinnvoll?"
   Entschieden: der Bericht hat die Lage GEMESSEN (dealpilot-mb.js autoLage,
   dieselben Schwellen wie hier seit v2177). Eine Web-Recherche ergaenzt nur,
   was er nicht misst - die Entwicklungsmoeglichkeiten (und die Wertsteigerung,
   wenn der Bericht keine Preisreihe hatte). Fuer gemessene Felder bringt ein
   Abgleich mit dem Web nichts. */
(function () {
  'use strict';
  function bericht() {
    var D = window.DealPilotMB && typeof DealPilotMB.letzter === 'function' ? DealPilotMB.letzter() : null;
    if (!D || (D.macroRaw == null && D.microRaw == null && D.bevRaw == null && D.tageRaw == null)) return null;
    return D;
  }
  function fz(x, d) { return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toString().replace('.', ','); }
  function zeilen(D) {
    var S = (window.DealPilotMB && DealPilotMB.lageStufen) || {};
    var z = [];
    if (D.macroRaw != null) z.push(['makrolage', 'Makrolage', S.makro && S.makro(D.macroRaw), 'Score ' + Math.round(D.macroRaw)]);
    if (D.microRaw != null) z.push(['mikrolage', 'Mikrolage', S.mikro && S.mikro(D.microRaw), 'Score ' + Math.round(D.microRaw)]);
    if (D.bevRaw != null) z.push(['ds2_bevoelkerung', 'Bevölkerung', S.bev && S.bev(D.bevRaw), fz(D.bevRaw, 2) + ' %/Jahr']);
    if (D.tageRaw != null) z.push(['ds2_nachfrage', 'Nachfrage', S.nachfrage && S.nachfrage(D.tageRaw), Math.round(D.tageRaw) + ' Tage Vermarktungsdauer']);
    if (D.trendRaw != null) z.push(['ds2_wertsteigerung', 'Wertsteigerung', null, fz(D.trendRaw, 1) + ' %/Jahr Preisentwicklung']);
    return z;
  }
  function zeichnen() {
    var body = document.getElementById('ki-lage-body');
    var btn = document.getElementById('ki-lage-btn');
    var tag = document.querySelector('#ki-lage-box .ki-lage-tag');
    if (!body) return;
    var D = bericht();
    if (!D) {
      if (btn) btn.style.removeProperty('display');
      if (tag) tag.textContent = '4 gemessen · 2 KI';
      if (body.getAttribute('data-aus-bericht')) {
        body.removeAttribute('data-aus-bericht');
        body.innerHTML = '<div class="ki-lage-empty">Adresse oben eintragen, dann Button klicken — DealPilot misst Makrolage, Mikrolage, Bevölkerung und Nachfrage aus amtlichen Daten und stellt die KI-Einschätzung daneben; Wertsteigerung und Entwicklung ergänzt die KI.</div>';
      }
      return;
    }
    /* !important: eine Regel setzt .btn auf display:flex !important (gemessen) */
    if (btn) btn.style.setProperty('display', 'none', 'important');
    if (tag) tag.textContent = 'aus dem Marktbericht';
    /* v2177a · Ein Stufe-1-Bericht misst nur die Mikrolage (gemessen an
       Bismarckstr.: Makro, Bevoelkerung, Nachfrage fehlten). Was er nicht
       hat, kommt aus unserer eigenen Messung (/lage/gemessen, ohne KI) -
       einmal je Objekt, und nur in LEERE Felder, wie autoLage. */
    var k = window._currentObjKey || '';
    var fehlt = (D.macroRaw == null || D.bevRaw == null || D.tageRaw == null);
    if (fehlt && !messungen[k] && !laeuft[k]) {
      laeuft[k] = true;
      var v = function (id) { return (document.getElementById(id) || {}).value || ''; };
      _lageMessen(v('str'), v('hnr'), v('plz'), v('ort')).then(function (m) {
        messungen[k] = m || { felder: {} }; laeuft[k] = false;
        var ff = messungen[k].felder || {}, gesetzt = 0;
        [['makrolage', D.macroRaw], ['ds2_bevoelkerung', D.bevRaw], ['ds2_nachfrage', D.tageRaw]].forEach(function (p) {
          var el = document.getElementById(p[0]);
          if (p[1] == null && ff[p[0]] && el && !el.value && el.querySelector('option[value="' + ff[p[0]].stufe + '"]')) {
            el.value = ff[p[0]].stufe; el.dispatchEvent(new Event('change')); gesetzt++;
          }
        });
        if (gesetzt && typeof dpUpdateAll === 'function') dpUpdateAll();
        zeichnen();
      });
    }
    if (window._kiLageErgaenzt === (window._currentObjKey || '')) return;   /* KI-Ergaenzung steht gerade da */
    var rows = zeilen(D).map(function (r) {
      var feld = document.getElementById(r[0]);
      var jetzt = feld && feld.value ? _lageOptText(r[0], feld.value) : '–';
      var soll = r[2] ? _lageOptText(r[0], r[2]) : null;
      var anders = soll && feld && feld.value && feld.value !== r[2];
      return '<tr><td>' + r[1] + '</td><td><b>' + _escKi(jetzt) + '</b><span class="lv-w">' + _escKi(r[3]) + '</span></td>'
        + '<td class="lv-u">' + (anders ? '<span class="lv-ab" title="Im Feld steht ein anderer Wert als die Messung des Berichts (' + _escKi(soll) + ') — von Hand geändert?">≠</span>' : '<span class="lv-ok">✓</span>') + '</td></tr>';
    }).join('');
    var M = (messungen[window._currentObjKey || ''] || {}).felder || {};
    [['makrolage', 'Makrolage', D.macroRaw], ['ds2_bevoelkerung', 'Bevölkerung', D.bevRaw], ['ds2_nachfrage', 'Nachfrage', D.tageRaw]].forEach(function (p) {
      var g = M[p[0]];
      if (p[2] != null || !g) return;
      var el = document.getElementById(p[0]);
      var anders = el && el.value && el.value !== g.stufe;
      rows += '<tr title="' + _escKi(g.quelle + String.fromCharCode(10) + 'Schwelle: ' + g.schwelle) + '"><td>' + p[1] + '</td><td><b>' + _escKi(_lageOptText(p[0], el && el.value ? el.value : g.stufe)) + '</b><span class="lv-w">'
        + _escKi(String(g.wert).replace('.', ',') + ' ' + g.einheit) + ' · Regionaldaten (nicht im Bericht)</span></td><td class="lv-u">'
        + (anders ? '<span class="lv-ab" title="Im Feld steht ein anderer Wert als die Messung (' + _escKi(_lageOptText(p[0], g.stufe)) + ')">≠</span>' : '<span class="lv-ok">✓</span>') + '</td></tr>';
    });
    var E = (window._kiLageErgaenzung || {})[window._currentObjKey || ''] || {};
    [['ds2_entwicklung', 'Entwicklung', E.entwicklung], ['ds2_wertsteigerung', 'Wertsteigerung', E.wertsteigerung]].forEach(function (p) {
      if (!p[2] || !p[2].value) return;
      var q = p[2].source && p[2].source.url ? ' <a class="ki-lage-src-link" href="' + _escKi(p[2].source.url) + '" target="_blank" rel="noopener noreferrer">Quelle</a>' : '';
      rows += '<tr><td>' + p[1] + '</td><td><b>' + _escKi(_lageOptText(p[0], p[2].value)) + '</b><span class="lv-w">Web-Recherche: ' + _escKi(p[2].text || '') + '</span>' + q + '</td><td class="lv-u">KI</td></tr>';
    });
    var offen = ['ds2_entwicklung'].concat(D.trendRaw == null ? ['ds2_wertsteigerung'] : []);
    var html = '<div class="ki-lage-vergleich"><div class="lv-kopf">✓ Lage aus dem Marktbericht' + (D.bericht_datum ? ' vom ' + _escKi(D.bericht_datum) : '') + ' übernommen</div>'
      + '<table class="lv-tab"><tbody>' + rows + '</tbody></table>'
      + '<div class="lv-fuss">Gemessen im Marktbericht — eine erneute Analyse ist nicht nötig. '
      + 'Nicht gemessen werden ' + (offen.length > 1 ? 'Wertsteigerung und Entwicklungsmöglichkeiten' : 'die Entwicklungsmöglichkeiten (B-Plan, Stadtentwicklung)') + '; die ergänzt auf Wunsch eine Web-Recherche.</div>'
      + '<div class="ki-lage-actions" style="margin-top:10px"><button class="btn btn-sm" type="button" onclick="runKiLage({ergaenzen:true})">'
      + (offen.length > 1 ? 'Wertsteigerung & Entwicklung' : 'Entwicklung') + ' per Web-Recherche ergänzen</button></div></div>';
    _lageCss();
    body.setAttribute('data-aus-bericht', '1');
    if (body.innerHTML !== html) body.innerHTML = html;
  }
  window._kiLageBerichtZeichnen = zeichnen;
  var messungen = {}, laeuft = {};
  var letzterKey = null;
  function takt() {
    var k = window._currentObjKey || '';
    if (k !== letzterKey) { letzterKey = k; window._kiLageErgaenzt = null; }
    try { zeichnen(); } catch (e) {}
  }
  window.addEventListener('dp:mb-ready', function () { setTimeout(takt, 300); });
  window.addEventListener('dp:object-ready', function () { setTimeout(takt, 1500); });
  setInterval(takt, 2500);
})();
