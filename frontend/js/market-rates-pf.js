'use strict';
/* ═══════════════════════════════════════════════════
   DealPilot V210 – market-rates-pf.js

   Indikative Bauzinsen für 5/10/15/20 Jahre.

   v2245 · MARKTFORMEL (backend/src/services/bauzinsService.js):
     Bauzins(b, LTV) = Bundesanleihe_b (Tag) + Marktaufschlag_b (Monat,
                       MFI-Zinsstatistik minus Bund) + K + Zuschlag(LTV)
   Stufen = feste Beleihungen: premium 60 %, standard 80 %, schwach 90 %.
   Die Zahlen kommen fertig aus dem Backend (indicativeRates + formel);
   STATIC_FALLBACK_PF unten ist nur noch Rueckfall und rechnet mit
   derselben Formel (dpBauzinsRechnen aus indicative-zins.js).
   Bis v2242: Pfandbrief + feste Marge 0,25 / 0,40 / 0,80.

   Diese Werte sind INDIKATIONEN, keine Konditions-Quoten.
   ═══════════════════════════════════════════════════ */

var MarketRatesPF = (function() {

  // State
  var _currentData = null;
  var _activeMargin = 'standard';   // Default

  // Bucket-Konfiguration für UI (Farben aus V209 wiederverwendet)
  var BUCKETS_PF = [
    { key: '5',  label: '5 Jahre',  color: '#5BA89F' },
    { key: '10', label: '10 Jahre', color: '#C9A84C' },
    { key: '15', label: '15 Jahre', color: '#D89567' },
    { key: '20', label: '20 Jahre', color: '#B8625C' }
  ];

  // Sane Defaults — falls Backend nie antwortet.
  // v2245: NUR NOCH Altmodell-Rueckfall (Pfandbrief-Kurve); gerechnet wird
  // ueber die Marktformel aus config.js marketRates.bauzins.
  var STATIC_FALLBACK_PF = {
    yields:  { '5': 3.68, '10': 3.93, '15': 4.05, '20': 4.11 },
    margins: { premium: 0.25, standard: 0.40, schwach: 0.80, voll: 1.03 }
  };

  async function _fetchFromBackend() {
    var apiBase = (typeof Auth !== 'undefined' && Auth.getApiBase) ? Auth.getApiBase() : '/api/v1';
    try {
      var headers = { 'Accept': 'application/json' };
      var tok = (typeof Auth !== 'undefined' && Auth.getToken) ? Auth.getToken() : null;
      if (tok) headers['Authorization'] = 'Bearer ' + tok;
      var res = await fetch(apiBase + '/market-rates/pfandbrief?maturities=5,10,15,20', { headers: headers });
      if (!res.ok) {
        console.warn('[V210 pfandbrief] HTTP ' + res.status);
        return null;
      }
      return await res.json();
    } catch (e) {
      console.warn('[V210 pfandbrief] fetch error:', e.message);
      return null;
    }
  }

  function _buildFromFallback() {
    // Wird genutzt wenn Backend gar nicht antwortet — minimal aber konsistent
    var f = STATIC_FALLBACK_PF;
    var indicative = {};
    /* v2245: dieselbe Marktformel wie das Backend, mit dem statischen Stand */
    var formel = null;
    try { formel = (typeof window.dpBauzinsFormel === 'function') ? window.dpBauzinsFormel() : null; } catch (e) {}
    var STL = (formel && formel.stufen_ltv) || { premium: 60, standard: 80, schwach: 90, voll: 100 };
    if (STL.voll == null) STL.voll = 100;   /* v2254 */
    Object.keys(f.yields).forEach(function(m) {
      if (formel && typeof window.dpBauzinsRechnen === 'function') {
        indicative[m] = {
          premium:  window.dpBauzinsRechnen(formel, m, STL.premium),
          standard: window.dpBauzinsRechnen(formel, m, STL.standard),
          schwach:  window.dpBauzinsRechnen(formel, m, STL.schwach),
          voll:     window.dpBauzinsRechnen(formel, m, STL.voll)
        };
        if (indicative[m].standard != null) return;
      }
      indicative[m] = {
        premium:  Math.round((f.yields[m] + f.margins.premium)  * 100) / 100,
        standard: Math.round((f.yields[m] + f.margins.standard) * 100) / 100,
        schwach:  Math.round((f.yields[m] + f.margins.schwach)  * 100) / 100,
        voll:     Math.round((f.yields[m] + f.margins.voll)     * 100) / 100
      };
    });
    return {
      maturities: ['5', '10', '15', '20'],
      modell: formel ? 'bund+aufschlag' : 'pfandbrief+marge',
      formel: formel,
      stufen_ltv: STL,
      yields: f.yields,
      margins: f.margins,
      indicativeRates: indicative,
      sources: { '5': 'static', '10': 'static', '15': 'static', '20': 'static' },
      periods: { '5': null, '10': null, '15': null, '20': null },
      source: 'static',
      sourceInfo: { name: 'Frontend-Fallback (Backend nicht erreichbar)', url: '' },
      asOf: new Date(),
      _frontendFallback: true
    };
  }

  async function _refresh() {
    var data = await _fetchFromBackend();
    if (!data) data = _buildFromFallback();
    /* v2254: liefert das Backend noch keine Stufe `voll`, wird sie aus
       derselben Formel nachgerechnet - die Kachel zeigt sonst „–". */
    try {
      if (data && data.formel && data.indicativeRates && typeof window.dpBauzinsRechnen === 'function') {
        data.stufen_ltv = Object.assign({ voll: 100 }, data.stufen_ltv || {});
        Object.keys(data.indicativeRates).forEach(function (m) {
          var ir = data.indicativeRates[m];
          if (ir && ir.voll == null) ir.voll = window.dpBauzinsRechnen(data.formel, m, data.stufen_ltv.voll);
        });
      }
    } catch (e) {}
    _currentData = data;
    _renderUI();
    try { _syncTopStrip(); } catch(e){}
    try { if (typeof window.dpMarktzinsHinweis === 'function') window.dpMarktzinsHinweis(); } catch(e){}   /* v2245 */
  }

  /* v2245: Zerlegung einer Kachel in ihre Bausteine (fuer Unterzeile + Tooltip).
     Marktaufschlag = gemessener MFI-Aufschlag + K, damit die Zahlen aufgehen:
     Zins = Bundesanleihe + Marktaufschlag + Zuschlag nach Beleihung. */
  function _pz(x) { return (x == null || !isFinite(x)) ? '–' : x.toFixed(2).replace('.', ','); }
  function _monat(m) {
    if (!m) return '';
    var p = String(m).split('-');
    return p.length >= 2 ? p[1] + '/' + p[0] : String(m);
  }
  function _zerlegung(d, key, stufe) {
    var f = d && d.formel;
    if (!f || !f.bund || f.bund[key] == null || f.aufschlag == null || f.aufschlag[key] == null) return null;
    var ltv = (d.stufen_ltv && d.stufen_ltv[stufe]) || ({ premium: 60, standard: 80, schwach: 90, voll: 100 })[stufe] || 80;
    var z = (typeof window.dpBauzinsZuschlag === 'function') ? window.dpBauzinsZuschlag(ltv, f.zuschlaege) : 0;
    /* Angezeigter Marktaufschlag = Zins - Bundesanleihe - Zuschlag: so geht
       die Unterzeile auf den Cent genau auf (getrennt gerundet wuerde z. B.
       0,385 + 0,27 = 0,655 zu 0,65 und die Summe stimmte nicht). Dieselbe
       Ableitung steht in landing/dp2-inhalt.js. */
    var ir = d.indicativeRates && d.indicativeRates[key];
    var zins = ir && typeof ir[stufe] === 'number' ? ir[stufe] : null;
    return {
      bund: f.bund[key], aufschlagMfi: f.aufschlag[key], k: f.k,
      markt: zins != null ? Math.round((zins - f.bund[key] - z) * 100) / 100 : Math.round((f.aufschlag[key] + f.k) * 100) / 100,
      zuschlag: z, ltv: ltv,
      monat: (f.aufschlag_monat_je && f.aufschlag_monat_je[key]) || f.aufschlag_monat || ''
    };
  }
  function _detailText(d, key, stufe) {
    var z = _zerlegung(d, key, stufe);
    if (!z) return null;
    var s = 'Bundesanleihe ' + _pz(z.bund) + ' % + Marktaufschlag ' + _pz(z.markt)
          + (z.monat ? ' (Stand ' + _monat(z.monat) + ')' : '');
    if (Math.abs(z.zuschlag) >= 0.005) s += (z.zuschlag > 0 ? ' + ' : ' − ') + 'Beleihung ' + _pz(Math.abs(z.zuschlag));
    return s;
  }
  window.dpBauzinsDetailText = function (key, stufe) { try { return _detailText(_currentData, String(key), stufe || _activeMargin); } catch (e) { return null; } };

  function setMargin(marginKey) {
    if (!['premium', 'standard', 'schwach', 'voll'].includes(marginKey)) return;   /* v2254: voll */
    _activeMargin = marginKey;
    // Buttons visuell
    document.querySelectorAll('.mr-pf-margin-btn').forEach(function(b) {
      b.classList.toggle('active', b.getAttribute('data-margin') === marginKey);
    });
    _renderUI();
    try { _syncTopStrip(); } catch(e){}
  }
  window.setPfandbriefMargin = setMargin;
  /* v829-pf-expose: aktuell geladene Live-Pfandbrief-Daten (yields+margins) global bereitstellen,
     damit dpGetIndicativeZins dieselbe Quelle wie die Kacheln nutzt (statt config-static). */
  window.dpGetPfData = function () {
    try { if (_currentData && _currentData.yields && _currentData.margins) return _currentData; } catch (e) {}
    return null;
  };

  function refreshPfandbriefRates() {
    return _refresh();
  }
  window.refreshPfandbriefRates = refreshPfandbriefRates;

  // v358-top-sync: spiegelt die Pfandbrief-Tiles in die schlanke Top-Leiste (#mrpf-top-*)
  function _syncTopStrip() {
    if (!_currentData) return;
    var d = _currentData;
    ['5','10','15','20'].forEach(function(key) {
      var srcRate = document.getElementById('mr-pf-rate-' + key);
      var srcSrc  = document.getElementById('mr-pf-src-' + key);
      var srcDet  = document.getElementById('mr-pf-detail-' + key);
      var topRate = document.getElementById('mrpf-top-rate-' + key);
      var topSrc  = document.getElementById('mrpf-top-src-' + key);
      var topDet  = document.getElementById('mrpf-top-detail-' + key);
      if (topRate && srcRate) topRate.textContent = srcRate.textContent;
      if (topDet  && srcDet)  topDet.textContent  = srcDet.textContent;
      if (topSrc  && srcSrc)  {
        topSrc.textContent = srcSrc.textContent;
        topSrc.className   = srcSrc.className.replace('mr-pf-tile-src', 'mrpf-top-src');
      }
    });
  }
  window._mrPfSyncTopStrip = _syncTopStrip;

  function _renderUI() {
    if (!_currentData) return;
    var d = _currentData;

    // ── Tiles ─────────────────────────────────────────────
    BUCKETS_PF.forEach(function(b) {
      var rateEl   = document.getElementById('mr-pf-rate-' + b.key);
      var srcEl    = document.getElementById('mr-pf-src-' + b.key);
      var detailEl = document.getElementById('mr-pf-detail-' + b.key);
      if (!rateEl) return;

      var yield_ = d.yields[b.key];
      var indic  = d.indicativeRates[b.key];
      var src    = d.sources[b.key] || 'static';
      var _neu   = !!(d.formel && d.formel.bund);   /* v2245: Marktformel */

      if ((!_neu && typeof yield_ !== 'number') || !indic || typeof indic[_activeMargin] !== 'number') {
        rateEl.textContent = '–';
        if (srcEl) { srcEl.textContent = '–'; srcEl.className = 'mr-pf-tile-src'; }
        if (detailEl) detailEl.textContent = 'Keine Daten';
        return;
      }

      var indicVal = indic[_activeMargin];
      rateEl.textContent = indicVal.toFixed(2).replace('.', ',') + ' %';

      if (srcEl) {
        srcEl.textContent = src === 'live' ? 'Live' : 'Hinterlegt';
        srcEl.className = 'mr-pf-tile-src ' + src;
        srcEl.setAttribute('title', src === 'live'
          ? 'Live aus Bundesbank-API'
          : 'Hinterlegter Wert · Stand ' + (d.periods[b.key] || '–'));
      }
      if (detailEl) {
        var _dt = _neu ? _detailText(d, b.key, _activeMargin) : null;
        if (_dt) {
          detailEl.textContent = _dt;
        } else {
          var marginVal = d.margins[_activeMargin];
          detailEl.textContent = 'Pfandbrief ' + yield_.toFixed(2).replace('.', ',') + '% + Marge ' + marginVal.toFixed(2).replace('.', ',') + '%';
        }
      }
    });

    // ── Source-Box ──────────────────────────────────────────
    var sourceBox = document.getElementById('mr-pf-source');
    if (sourceBox) {
      var srcKey = d.source || 'static';
      var badgeText;
      if (srcKey === 'live')        badgeText = '● Live · Bundesbank';
      else if (srcKey === 'static') badgeText = '📌 Hinterlegt';
      else if (srcKey === 'mixed')  badgeText = '◐ Gemischt (Live + Hinterlegt)';
      else                           badgeText = '⚠ Nicht verfügbar';

      var srcName = (d.sourceInfo && d.sourceInfo.name) || 'Bundesbank';
      var srcUrl  = (d.sourceInfo && d.sourceInfo.url)  || '';
      var asOfStr = '';
      if (d.asOf) {
        try {
          var dt = new Date(d.asOf);
          asOfStr = ' · Stand ' + dt.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });
        } catch(e){}
      }
      sourceBox.innerHTML =
        '<span class="mr-pf-source-badge ' + srcKey + '">' + badgeText + '</span>' +
        'Quelle: ' + (srcUrl ? '<a href="' + srcUrl + '" target="_blank" rel="noopener">' + srcName + '</a>' : srcName) +
        asOfStr;
    }

    // ── Header-Badge ──────────────────────────────────────
    var headerBadge = document.getElementById('mr-pf-source-badge');
    if (headerBadge) {
      var srcKey2 = d.source || 'static';
      var _nm = (d.formel && d.formel.bund) ? 'Bundesanleihe + Marktaufschlag' : 'Pfandbrief + Marge';   /* v2245 */
      if (srcKey2 === 'live')      headerBadge.textContent = _nm + ' · Live';
      else if (srcKey2 === 'mixed') headerBadge.textContent = _nm + ' · Live + Hinterlegt';
      else                          headerBadge.textContent = _nm + ' · Hinterlegt';
    }

    // V213: Sublabel  (v2245: der indikative Zins der aktiven Stufe, nicht mehr die Pfandbrief-Rendite)
    if (window.CollapsibleCards && window.CollapsibleCards.setSublabel) {
      var _i10 = d.indicativeRates && d.indicativeRates['10'], _i20 = d.indicativeRates && d.indicativeRates['20'];
      var y10 = _i10 ? _i10[_activeMargin] : null;
      var y20 = _i20 ? _i20[_activeMargin] : null;
      var bits = [];
      if (y10 != null) bits.push('10J ' + y10.toFixed(2).replace('.', ',') + '%');
      if (y20 != null) bits.push('20J ' + y20.toFixed(2).replace('.', ',') + '%');
      window.CollapsibleCards.setSublabel('mr-pf', bits.join(' · '));
    }

    // ── Bar-Chart ─────────────────────────────────────────
    _renderBarChart(d);
  }

  function _renderBarChart(d) {
    var canvas = document.getElementById('mr-pf-chart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (window._mrPfChartInstance) {
      try { window._mrPfChartInstance.destroy(); } catch(e){}
    }

    var labels = BUCKETS_PF.map(function(b) { return b.label; });
    var values = BUCKETS_PF.map(function(b) {
      var ind = d.indicativeRates[b.key];
      return ind ? ind[_activeMargin] : null;
    });
    var colors = BUCKETS_PF.map(function(b) { return b.color; });

    window._mrPfChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.map(function(c) { return c + 'CC'; }),
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 4,
          barThickness: 'flex',
          maxBarThickness: 90
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(42,39,39,0.96)',
            padding: 10,
            titleFont: { size: 11, weight: '600' },
            bodyFont: { size: 13, weight: '700' },
            displayColors: false,
            cornerRadius: 6,
            callbacks: {
              label: function(ctx) {
                if (ctx.parsed.y == null) return '–';
                var bk = BUCKETS_PF[ctx.dataIndex].key;
                var zl = _zerlegung(d, bk, _activeMargin);   /* v2245 */
                if (zl) {
                  return [
                    'Indikativ: ' + ctx.parsed.y.toFixed(2).replace('.', ',') + ' % (Beleihung ' + zl.ltv + ' %)',
                    'davon Bundesanleihe: ' + _pz(zl.bund) + ' %',
                    'davon Marktaufschlag: ' + _pz(zl.markt) + (zl.monat ? ' (Stand ' + _monat(zl.monat) + ')' : ''),
                    'davon Zuschlag nach Beleihung: ' + (zl.zuschlag >= 0 ? '+' : '−') + _pz(Math.abs(zl.zuschlag))
                  ];
                }
                var yld = d.yields[bk];
                var mar = d.margins[_activeMargin];
                return [
                  'Indikativ: ' + ctx.parsed.y.toFixed(2).replace('.', ',') + ' %',
                  'davon Pfandbrief: ' + (yld != null ? yld.toFixed(2).replace('.', ',') + '%' : '–'),
                  'davon Marge: ' + mar.toFixed(2).replace('.', ',') + '%'
                ];
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: 'rgba(42,39,39,0.6)' }
          },
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(42,39,39,0.06)', drawBorder: false },
            ticks: {
              font: { size: 10 },
              color: 'rgba(42,39,39,0.55)',
              maxTicksLimit: 5,
              callback: function(v) { return v.toFixed(2).replace('.', ',') + '%'; }
            }
          }
        }
      }
    });
  }

  // Auto-Load mit Verzögerung damit Auth + Chart.js bereit sind
  function _schedule() {
    setTimeout(_refresh, 900);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _schedule);
  } else {
    _schedule();
  }

  return {
    refresh: _refresh,
    setMargin: setMargin
  };
})();


/* === dpfk-konditionen-v3 BEGIN — alleiniger Kopfzeilen-Builder (finanz-card-merge ist deaktiviert) === */
(function(){
  var PLANE='<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><path d="M21.5 2.5l-7 19.5-3.8-8.2-8.2-3.8z"/></svg>';
  /* v2245: die Stufen SIND feste Beleihungen der Marktformel (60 / 80 / 90 %) */
  var LBL={ premium:'LTV 60 %', standard:'LTV 80 %', schwach:'LTV 90 %', voll:'LTV 100 %' };
  function activeKey(){
    var a=document.querySelector('.mr-pf-margin-btn.active');
    return a ? a.getAttribute('data-margin') : 'standard';
  }
  function syncActive(key){
    var band=document.getElementById('dpfk-band'); if(!band) return;
    band.querySelectorAll('.dpfk-ltv-btn').forEach(function(x){ x.classList.toggle('active', x.getAttribute('data-margin')===key); });
    var lab=document.getElementById('dpfk-ltvlabel'); if(lab) lab.textContent=LBL[key]||'';
  }
  function deco(){
    var strip=document.getElementById('mrpf-top-strip'); if(!strip) return;
    /* Reste der alten Merge-Kopfzeile entfernen (falls je gelaufen) */
    document.querySelectorAll('.v443-cond-row').forEach(function(r){ try{r.remove();}catch(e){} });
    var band=document.getElementById('dpfk-band');
    if(!band){
      band=document.createElement('div'); band.className='dpfk-band'; band.id='dpfk-band';
      band.innerHTML=
        '<div class="dpfk-stub"><span class="dpfk-bp">PRE-FLIGHT</span><span class="dpfk-pf">KONDI&shy;TIONEN</span><span class="dpfk-fl" id="dpfk-ltvlabel">LTV 80 %</span><span class="dpfk-bc"></span></div>'+
        '<div class="dpfk-perf"></div>'+
        '<div class="dpfk-body"><div class="dpfk-head">'+
          '<span class="dpfk-title"><span class="dpfk-plane">'+PLANE+'</span>Indikative Konditionen nach Zinsbindung</span>'+
          '<span class="dpfk-ctrl"><span class="dpfk-ltv">'+
            '<button type="button" class="dpfk-ltv-btn" data-margin="premium" title="Beleihung 60 %">60&nbsp;%</button>'+
            '<button type="button" class="dpfk-ltv-btn" data-margin="standard" title="Beleihung 80 %">80&nbsp;%</button>'+
            '<button type="button" class="dpfk-ltv-btn" data-margin="schwach" title="Beleihung 90 %">90&nbsp;%</button>'+
            '<button type="button" class="dpfk-ltv-btn" data-margin="voll" title="Beleihung 100 % (Vollfinanzierung)">100&nbsp;%</button>'+
          '</span></span>'+
        '</div></div>';
      strip.parentNode.insertBefore(band, strip);
      band.querySelector('.dpfk-body').appendChild(strip);
      strip.classList.add('dpfk-strip');
      band.querySelector('.dpfk-ltv').addEventListener('click', function(e){
        var b=e.target.closest('.dpfk-ltv-btn'); if(!b) return;
        var key=b.getAttribute('data-margin');
        if(typeof window.setPfandbriefMargin==='function') window.setPfandbriefMargin(key);
        syncActive(key);
      });
    } else if(!band.querySelector('#mrpf-top-strip')){
      strip.classList.add('dpfk-strip');
      band.querySelector('.dpfk-body').appendChild(strip);
    }
    /* Marktdaten-Button dezent in den Gold-Kopf ziehen (Handler V10.openMarketModal bleibt) */
    var head=band.querySelector('.dpfk-head');
    var btn=document.querySelector('.v10-zc-btn');
    if(btn && head && !head.contains(btn)){
      btn.classList.add('dpfk-mkt');
      var ctrl=head.querySelector('.dpfk-ctrl'); if(ctrl) ctrl.appendChild(btn);
      var row1=document.querySelector('.v10-zc-row1'); if(row1) row1.style.display='none';
    }
    syncActive(activeKey());
  }
  function boot(){ deco(); setTimeout(deco, 600); setTimeout(deco, 1600); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
/* === dpfk-konditionen-v3 END === */
