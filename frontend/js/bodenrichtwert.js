'use strict';
/* ═══════════════════════════════════════════════════════════════
   V187-h4 — Bodenrichtwert-Helper (erweiterte Result-Box)
   
   - BORIS-Link pro Bundesland (PLZ-Erkennung)
   - KI-Button: schickt Adresse an Backend /ai/bodenrichtwert
   - Übernimmt KI-Wert direkt ins #brw-Feld
═══════════════════════════════════════════════════════════════ */
(function() {
  'use strict';

  // ── PLZ → Bundesland-Mapping ─────────────────────────────────
  // Quellen: amtliche PLZ-Vergaberegeln Deutsche Post
  function _plzToBundesland(plz) {
    var p = parseInt(plz, 10);
    if (isNaN(p) || p < 1000 || p > 99999) return null;

    // Sachsen
    if (p >= 1000 && p <= 9999)  return 'SN';
    // Brandenburg (östlich) + Berlin
    if (p >= 10000 && p <= 14999) return 'BB-BE';
    if (p >= 15000 && p <= 16999) return 'BB';
    // Mecklenburg-Vorpommern
    if (p >= 17000 && p <= 19999) return 'MV';
    // Hamburg + Schleswig-Holstein
    if (p >= 20000 && p <= 21999) return 'HH';
    if (p >= 22000 && p <= 22999) return 'HH-SH';  // Hamburg-Umland
    if (p >= 23000 && p <= 25999) return 'SH';
    // Bremen + Niedersachsen
    if (p >= 26000 && p <= 26999) return 'NI';
    if (p >= 27000 && p <= 27999) return 'HB-NI';  // Bremen-Umland
    if (p >= 28000 && p <= 28999) return 'HB';
    if (p >= 29000 && p <= 31999) return 'NI';
    // NRW (Nord) + Niedersachsen (Süd)
    if (p >= 32000 && p <= 33999) return 'NRW-NI';  // Bielefeld/Detmold/Paderborn
    if (p >= 34000 && p <= 37999) return 'HE-NI';   // Kassel/Göttingen
    if (p >= 38000 && p <= 38999) return 'NI';
    // NRW
    if (p >= 40000 && p <= 48999) return 'NRW';
    // Hessen
    if (p >= 60000 && p <= 65999) return 'HE';
    // Rheinland-Pfalz + Saarland
    if (p >= 54000 && p <= 56999) return 'RP';
    if (p >= 66000 && p <= 66999) return 'SL-RP';
    if (p >= 67000 && p <= 67999) return 'RP';
    // Baden-Württemberg
    if (p >= 68000 && p <= 79999) return 'BW';
    // Bayern
    if (p >= 80000 && p <= 87999) return 'BY';
    if (p >= 90000 && p <= 96999) return 'BY';
    // Thüringen
    if (p >= 98000 && p <= 99999) return 'TH';
    if (p >= 99000 && p <= 99999) return 'TH';
    // Sachsen-Anhalt
    if (p >= 6000 && p <= 6999)   return 'ST';   // Halle, Magdeburg
    if (p >= 38800 && p <= 39999) return 'ST';

    return null;
  }

  // ── BORIS-URLs pro Bundesland ────────────────────────────────
  var BORIS_URLS = {
    'BW':    { name: 'Baden-Württemberg', url: 'https://www.gutachterausschuesse-bw.de/borisbw/' },
    'BY':    { name: 'Bayern',            url: 'https://www.boris-bayern.de/' },
    'BE':    { name: 'Berlin',            url: 'https://fbinter.stadt-berlin.de/boris/' },
    'BB':    { name: 'Brandenburg',       url: 'https://service.brandenburg.de/lis/list.php?page=boris_brb' },
    'BB-BE': { name: 'Berlin/Brandenburg',url: 'https://fbinter.stadt-berlin.de/boris/' },
    'HB':    { name: 'Bremen',            url: 'https://www.boris.bremen.de/' },
    'HH':    { name: 'Hamburg',           url: 'https://www.boris-hamburg.de/boris/' },
    'HH-SH': { name: 'Hamburg/SH',        url: 'https://www.boris-hamburg.de/boris/' },
    'HE':    { name: 'Hessen',            url: 'https://www.gutachterausschuss.hessen.de/' },
    'HE-NI': { name: 'Hessen/Niedersachsen', url: 'https://www.gutachterausschuss.hessen.de/' },
    'MV':    { name: 'Mecklenburg-Vorpommern', url: 'https://www.geoportal-mv.de/portal/' },
    'NI':    { name: 'Niedersachsen',     url: 'https://immobilienmarkt.niedersachsen.de/' },
    'HB-NI': { name: 'Bremen/Niedersachsen', url: 'https://immobilienmarkt.niedersachsen.de/' },
    'NRW':   { name: 'Nordrhein-Westfalen', url: 'https://www.boris.nrw.de/' },
    'NRW-NI':{ name: 'NRW/Niedersachsen', url: 'https://www.boris.nrw.de/' },
    'RP':    { name: 'Rheinland-Pfalz',   url: 'https://www.gutachterausschuesse.rlp.de/' },
    'SL':    { name: 'Saarland',          url: 'https://geoportal.saarland.de/' },
    'SL-RP': { name: 'Saarland/RLP',      url: 'https://geoportal.saarland.de/' },
    'SN':    { name: 'Sachsen',           url: 'https://www.boris.sachsen.de/' },
    'ST':    { name: 'Sachsen-Anhalt',    url: 'https://www.lvermgeo.sachsen-anhalt.de/' },
    'SH':    { name: 'Schleswig-Holstein',url: 'https://danord.gdi-sh.de/' },
    'TH':    { name: 'Thüringen',         url: 'https://www.geoportal-th.de/' }
  };

  // Fallback: BORIS-Plus deutschlandweit
  var BORIS_FALLBACK = {
    name: 'Deutschland (BORIS-Plus)',
    url:  'https://www.bodenrichtwerte-boris.de/borisplus/?lang=de'
  };

  // ── DOM-Helpers ──────────────────────────────────────────────
  function _el(id) { return document.getElementById(id); }
  function _val(id) {
    var el = _el(id);
    return el ? (el.value || '').trim() : '';
  }
  function _apiBase() {
    var m = document.querySelector('meta[name="ji-api-base"]');
    return m ? m.content : '';
  }
  function _token() {
    return localStorage.getItem('ji_token') || '';
  }

  // ── Status-Anzeige ───────────────────────────────────────────
  function _setStatus(text, cls) {
    var s = _el('brw-ai-status');
    if (!s) return;
    s.textContent = text || '';
    s.className = 'brw-ai-status' + (cls ? ' ' + cls : '');
  }

  // ── BORIS-Link öffnen ────────────────────────────────────────
  function openBoris() {
    var plz = _val('plz');
    var ort = _val('ort');
    var str = _val('str');
    
    var bl = _plzToBundesland(plz);
    var target = bl && BORIS_URLS[bl] ? BORIS_URLS[bl] : BORIS_FALLBACK;
    
    if (typeof toast === 'function') {
      var hint = 'BORIS ' + target.name;
      if (str && plz && ort) {
        hint += ' — suche: ' + str + ', ' + plz + ' ' + ort;
      } else if (plz && ort) {
        hint += ' — suche: ' + plz + ' ' + ort;
      }
      toast('🔗 ' + hint);
    }
    
    window.open(target.url, '_blank', 'noopener,noreferrer');
  }

  // ── KI-Anfrage ───────────────────────────────────────────────
  async function askAi() {
    var btn = document.getElementById('brw-ai-btn');
    
    var plz = _val('plz');
    var ort = _val('ort');
    var str = _val('str');
    
    if (!plz || !ort) {
      _setStatus('⚠ Erst PLZ + Ort eingeben', 'err');
      if (typeof toast === 'function') toast('⚠ Bitte erst PLZ + Ort eingeben');
      return;
    }
    
    var token = _token();
    if (!token) {
      _setStatus('⚠ Bitte einloggen', 'err');
      return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="btn-brw-icon">⏳</span> KI sucht…'; }
    _setStatus('Anfrage läuft…', '');
    
    try {
      var resp = await fetch(_apiBase() + '/ai/bodenrichtwert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ str: str, plz: plz, ort: ort })
      });
      
      var data;
      try { data = await resp.json(); } catch (e) { data = null; }
      
      if (!resp.ok) {
        var msg = (data && (data.error || data.message)) || ('Fehler ' + resp.status);
        throw new Error(msg);
      }
      
      if (data && data.value && data.value > 0) {
        var brwEl = _el('brw');
        if (brwEl) {
          brwEl.value = String(data.value).replace('.', ',');
          var ev = new Event('input', { bubbles: true });
          brwEl.dispatchEvent(ev);
        }
        // V187-h4: kurzer Status + ausführliche Result-Box
        _setStatus('✓ KI-Schätzung übernommen', 'ok');
        _renderResult(data);
        if (typeof toast === 'function') {
          toast('✓ Bodenrichtwert übernommen: ' + data.value + ' €/m²');
        }
      } else {
        _setStatus('⚠ Keine sinnvolle Schätzung möglich', 'err');
        _clearResult();
        if (typeof toast === 'function') toast('⚠ KI konnte keinen Wert ermitteln');
      }
    } catch (err) {
      console.error('[brw-ai]', err);
      _setStatus('⚠ ' + (err.message || 'Fehler'), 'err');
      _clearResult();
      if (typeof toast === 'function') toast('⚠ ' + (err.message || 'KI-Fehler'));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span class="btn-brw-icon">✨</span> KI versuchen'; }
    }
  }


  // ── V187-h4: Erweiterte Result-Box mit Kontext + Quelle ─────
  function _renderResult(data) {
    var box = _el('brw-ki-result');
    if (!box) return;
    
    if (!data || !data.value || data.value <= 0) {
      box.innerHTML = '';
      box.style.display = 'none';
      return;
    }
    
    var conf = (data.confidence || 'niedrig').toLowerCase();
    var confColor, confBg, confLabel, confIcon;
    if (conf === 'hoch') {
      confColor = '#2a6e48'; confBg = 'rgba(63,165,108,0.10)';
      confLabel = 'Hohe Konfidenz'; confIcon = '✓';
    } else if (conf === 'mittel') {
      confColor = '#8b7330'; confBg = 'rgba(201,168,76,0.10)';
      confLabel = 'Mittlere Konfidenz'; confIcon = '◐';
    } else {
      confColor = '#8b5a3c'; confBg = 'rgba(184,98,92,0.10)';
      confLabel = 'Niedrige Konfidenz'; confIcon = 'ℹ';
    }
    
    var srcUrl = (data.source_url && /^https?:\/\//.test(data.source_url)) ? data.source_url : '';
    var srcText = data.source || 'KI-Schätzung';
    
    // Plausibilität-Hinweis je nach confidence
    var plausHint = '';
    if (conf === 'hoch') {
      plausHint = 'Auf BORIS recherchierte oder mit hoher Sicherheit eingeschätzt. Trotzdem zur Sicherheit auf dem Bundesland-Portal verifizieren.';
    } else if (conf === 'mittel') {
      plausHint = 'Vergleichswerte für das Gebiet vorhanden, aber keine exakte BORIS-Karte. Bitte auf dem BORIS-Portal des Bundeslandes verifizieren.';
    } else {
      plausHint = 'Nur grobe Schätzung basierend auf Bundesland-Durchschnitt. Echte BORIS-Werte können erheblich abweichen — bitte Portal aufrufen!';
    }
    
    var html = '';
    html += '<div class="brw-ki-card">';
    
    // Header: Wert + Confidence
    html += '<div class="brw-ki-head">';
    html += '<div class="brw-ki-value">' + data.value.toLocaleString('de-DE') + ' <span class="brw-ki-unit">€/m²</span></div>';
    html += '<div class="brw-ki-conf" style="color:' + confColor + ';background:' + confBg + '">';
    html += '<span class="brw-ki-conf-ico">' + confIcon + '</span>' + confLabel;
    html += '</div>';
    html += '</div>';
    
    // Reasoning (Begründung)
    if (data.reasoning) {
      html += '<div class="brw-ki-reasoning">';
      html += '<span class="brw-ki-label">Begründung:</span> ';
      html += _escHtml(data.reasoning);
      html += '</div>';
    }
    
    // Quelle
    html += '<div class="brw-ki-source">';
    html += '<span class="brw-ki-label">Quelle:</span> ';
    if (srcUrl) {
      html += '<a href="' + _escAttr(srcUrl) + '" target="_blank" rel="noopener noreferrer" class="brw-ki-srclink">';
      html += _escHtml(srcText) + ' ↗';
      html += '</a>';
    } else {
      html += _escHtml(srcText);
    }
    html += '</div>';
    
    // Plausibilitäts-Hinweis
    html += '<div class="brw-ki-hint">' + _escHtml(plausHint) + '</div>';
    
    // BORIS-Verify-Button
    html += '<div class="brw-ki-actions">';
    html += '<button type="button" class="brw-ki-verify-btn" onclick="DealPilotBrw.openBoris()">';
    html += '🔗 Auf BORIS verifizieren';
    html += '</button>';
    html += '</div>';
    
    html += '</div>';
    
    box.innerHTML = html;
    box.style.display = 'block';
  }
  
  function _escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function _escAttr(s) {
    return _escHtml(s);
  }
  
  function _clearResult() {
    var box = _el('brw-ki-result');
    if (box) {
      box.innerHTML = '';
      box.style.display = 'none';
    }
  }

  // ── Public API ───────────────────────────────────────────────
  window.DealPilotBrw = {
    openBoris: openBoris,
    askAi: askAi,
    _debug: { plzToBundesland: _plzToBundesland, BORIS_URLS: BORIS_URLS }
  };
})();
