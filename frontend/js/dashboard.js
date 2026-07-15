/* ════════════════════════════════════════════════════════════════
   DealPilot Portfolio-Dashboard — v452
   window.DealPilotDashboard

   ARCHITEKTUR-PRINZIPIEN (siehe Projektanweisung):
   - Single Source of Truth: Score = PERSISTIERTE Einzel-Scores aus der
     List-API (ds2_score_persist / dealpilot_score), IV-gewichtet
     gemittelt. KEINE zweite Score-Formel im Frontend.
   - DSCR ausschliesslich window.Dscr.compute() — wird hier NICHT
     neu gerechnet (Aggregat-Mittel der gespeicherten dscr-Werte).
   - Charts/Projektion = MODELLPROJEKTION (vereinfacht), klar gelabelt.
   - Additiv: eigene Datei, kein Eingriff in calc.js/storage.js.
   - Render-Strategie: Score+KPIs+Status SOFORT aus Liste,
     Health/Sub-KPIs/Charts AUTO im Hintergrund aus /objects/:id.
   ════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MOUNT_ID = 'dashboard-main';
  var _summaries = [];     // List-API Rows (Summary)
  var _details   = {};     // key -> voller data-Blob (lazy via /objects/:id)
  var _detailsLoaded = false;
  var _charts = [];
  var _cardView = 'kanban';
  var _projYears = 20;
  var _booted = false;

  /* ── kleine Helfer ── */
  function $(id){ return document.getElementById(id); }
  function el(tag, cls, html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
  function fmtE(n,d){ if(n==null||isNaN(n))return '–'; return new Intl.NumberFormat('de-DE',{minimumFractionDigits:d||0,maximumFractionDigits:d||0}).format(d?n:Math.round(n)); }
  function fmtKEU(v){ if(v==null||isNaN(v))return '–'; var a=Math.abs(v); if(a>=1e6)return (v/1e6).toFixed(2).replace('.',',')+' Mio'; if(a>=1e3)return Math.round(v/1e3)+'k'; return Math.round(v)+''; }
  function num(v){ if(v==null)return 0; if(typeof v==='number')return v; var n=parseFloat(String(v).replace(/\./g,'').replace(',','.')); return isNaN(n)?0:n; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  /* v475: %-Felder sauber parsen (Komma ODER Punkt als Dezimal, keine Tausenderpunkte) */
  function _pct(x){ var n=parseFloat(String(x==null?'':x).replace(',','.')); return isNaN(n)?0:n; }
  /* v475: Erwerbsnebenkosten in EURO — absolut falls vorhanden, sonst aus %-Feldern (wie calc.js Z.663) */
  function _nkEuro(o){ if(num(o&&o.nk)>0) return num(o.nk); var kp=_kpEuro(o); return kp*(_pct(o&&o.notar_p)+_pct(o&&o.gest_p)+_pct(o&&o.makler_p)+_pct(o&&o.gba_p)+_pct(o&&o.ji_p))/100; }
  /* v475: heutiges Datum DD.MM.YYYY */
  function _heute(){ var d=new Date(); return ('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear(); }

  /* ── Plan-Detection ── */
  function plan(){
    var cfg = window.DealPilotConfig;
    if(!cfg || !cfg.pricing) return { full:false, demo:false, key:'free' };
    var mode = (typeof cfg.pricing.featureMode==='function') ? cfg.pricing.featureMode('deal_score_v2') : null;
    return {
      full: (typeof cfg.pricing.hasFullFeature==='function') ? cfg.pricing.hasFullFeature('deal_score_v2') : false,
      demo: (mode === 'demo'),
      key:  (typeof cfg.pricing.currentKey==='function') ? cfg.pricing.currentKey() : 'free'
    };
  }

  /* ════ PLAN-WECHSEL-WATCHER (v452.6) ════
     Wechselt der Plan waehrend das Dashboard offen ist (z.B. Pro->Starter),
     muss der Score automatisch umschalten (Investor <-> DealPilot). Wir
     pollen leicht den currentKey und re-rendern bei Aenderung. */
  var _planWatch=null, _lastPlanKey=null;
  function startPlanWatch(){
    _lastPlanKey=plan().key;
    stopPlanWatch();
    _planWatch=setInterval(function(){
      var m=$(MOUNT_ID);
      if(!m || m.style.display==='none'){ stopPlanWatch(); return; }
      var k=plan().key;
      if(k!==_lastPlanKey){
        _lastPlanKey=k;
        // Score + KPIs + Health spiegeln den neuen Plan (full? -> Investor, sonst DealPilot)
        renderScoreHero(); renderKpiCards(); renderHealth(); renderOverview();
      }
    }, 1200);
  }
  function stopPlanWatch(){ if(_planWatch){ clearInterval(_planWatch); _planWatch=null; } }

  /* ── Status aus Summary-Flags (App-Realitaet: zwei Bools) ── */
  function stageOf(o){
    if(o.deal_won || o._deal_won) return 'won';
    if(o.deal_lost || o._deal_lost) return 'lost';
    return 'pruef';
  }
  function wonList(){ return _summaries.filter(function(o){ return stageOf(o)==='won'; }); }

  /* ── persistierter Einzel-Score aus Summary ── */
  function scoreOf(o){
    var s = (o.ds2_score_persist!=null) ? o.ds2_score_persist
          : (o.dealpilot_score!=null)  ? o.dealpilot_score : null;
    return (s!=null && !isNaN(s)) ? +s : null;
  }

  /* ── Tier-Logik (1:1 wie DESIGN-DECISIONS) ── */
  function tierOf(score){
    if(score==null) return {t:'na', l:'–', col:'var(--dp-muted)'};
    var _k=(window.ScoreTier?window.ScoreTier.classify(score):(score>=85?'top':score>=70?'green':score>=50?'gold':'red'));
    if(_k==='top') return {t:'top', l:'Sehr gut', col:'var(--dp-green)'};
    if(_k==='green') return {t:'hi',  l:'Gut',      col:'var(--dp-green)'};
    if(_k==='gold') return {t:'mid', l:'Solide',   col:'var(--dp-gold)'};
    return {t:'lo', l:'Schwach', col:'var(--dp-red)'};
  }
  function catBarColor(s){ return s>=70?'var(--dp-green)':s>=50?'var(--dp-gold)':'var(--dp-red)'; }
  function _dl(){return '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>';}
  function _qrSvg(text,px){try{if(window.DpQr&&DpQr.svg)return DpQr.svg(String(text||'DealPilot'),{px:px||3,ecc:'M',border:2,dark:'#0c0b09',light:'#ffffff'});}catch(e){}return '<div style="width:74px;height:74px;border-radius:4px;background:repeating-linear-gradient(45deg,#0c0b09 0 3px,#fff 3px 6px)"></div>';}
  function _tierBg(tt){return tt==='lo'?'rgba(184,98,80,.16)':tt==='mid'?'rgba(201,168,76,.16)':'rgba(63,165,108,.16)';}
  var _passByObj = {};
  function _passRest(exp){ var ms=new Date(exp).getTime()-Date.now(); if(!(ms>0))return 'abgelaufen'; var d=Math.round(ms/86400000); return d+' Tag'+(d===1?'':'e'); }
  function loadPasses(){
    if(!window.Auth || typeof window.Auth.apiCall!=='function') return Promise.resolve();
    return window.Auth.apiCall('/passes',{method:'GET'}).then(function(r){
      var items=(r&&r.items)||[]; var now=Date.now(); var map={};
      items.forEach(function(p){ if(p.revoked_at) return; if(new Date(p.expires_at).getTime()<=now) return; var oid=p.object_id; if(oid&&!map[oid]) map[oid]=p; });
      _passByObj=map; try{ renderBoardOrCards(); }catch(e){}
    }).catch(function(){});
  }
  /* v455: KPI-Anzahl + Gewicht je Score-Kategorie (Investor-Modell, 24 KPIs). Fallback;
     echte Werte werden aus DealScore2-Breakdown gezogen (catMeta). */
  var KPICOUNT={rendite:4,finanzierung:5,risiko:6,lage:5,upside:4};
  var KPIWEIGHT={rendite:35,finanzierung:25,risiko:20,lage:10,upside:10};
  var _catMetaCache=null;
  function catMeta(){
    if(_catMetaCache) return _catMetaCache;
    var CK=['rendite','finanzierung','risiko','lage','upside']; var meta={};
    CK.forEach(function(k){ meta[k]={count:KPICOUNT[k]||0, weight:KPIWEIGHT[k]||0, names:[], kpis:[]}; });
    try{
      var arr=detailArr();
      if(arr.length && window.DealScore2 && typeof window.DealScore2.compute==='function'){
        var res=window.DealScore2.compute(buildDealFromData(arr[0]));
        var cw=(res && res.configUsed && res.configUsed.weights)?res.configUsed.weights:null;
        if(res && res.categories){ CK.forEach(function(k){
          var c=res.categories[k]; if(!c) return;
          if(Array.isArray(c.breakdown)){
            meta[k].names=c.breakdown.map(function(x){return x.name||x.key;});
            meta[k].count=c.breakdown.length;
            meta[k].kpis=c.breakdown.map(function(b){return {name:(b.name||b.key), weight:(b.weight!=null&&!isNaN(b.weight)?Math.round(+b.weight):null)};});
          }
          if(cw && cw[k]!=null && !isNaN(cw[k])){ var w=+cw[k]; meta[k].weight = w<=1?Math.round(w*100):Math.round(w); }
        }); }
      }
    }catch(e){}
    if(_detailsLoaded) _catMetaCache=meta;
    return meta;
  }

  /* ════ DATEN-LAYER ════ */

  // Summary-Liste laden (selber Endpoint wie storage.js, kein Doppel-Fetch-Risiko)
  function loadSummaries(){
    if(!window.Auth || typeof window.Auth.apiCall!=='function'){
      return Promise.reject(new Error('Auth nicht verfuegbar'));
    }
    return window.Auth.apiCall('/objects?limit=100&_t='+Date.now()).then(function(resp){
      // v452.1 FIX: Response-Form ist resp.items (wie storage.js Sidebar),
      // mit Fallbacks fuer resp.objects / direktes Array.
      var rows = (resp && resp.items) ? resp.items
               : (resp && resp.objects) ? resp.objects
               : (Array.isArray(resp) ? resp : []);
      _summaries = rows || [];
      return _summaries;
    });
  }

  // Volle Objektdaten lazy nachladen (nur fuer won-Objekte, fuer Health/Charts)
  function loadDetails(){
    var won = wonList();
    var jobs = won.map(function(o){
      var k = o.id || o.key;
      if(_details[k]) return Promise.resolve(_details[k]);
      return window.Auth.apiCall('/objects/'+k).then(function(obj){
        var d = (obj && obj.data) ? obj.data : (obj||{});
        // Summary-Felder mit reinmischen, damit ein Objekt alles hat
        d._sum = o; d._key = k; d._name = obj && (obj.name) || o.name; d._kuerzel = (obj && obj.kuerzel)||o.kuerzel;
        d._ort = (obj && obj.ort)||o.ort; d._kaufpreis = num(o.kaufpreis||d.kaufpreis||(obj&&obj.kaufpreis));
        _details[k] = d;
        return d;
      }).catch(function(){ return null; });
    });
    return Promise.all(jobs).then(function(){ _detailsLoaded = true; return _details; });
  }

  // Detail-Objekte als Array (nur erfolgreich geladene)
  function detailArr(){
    var all = wonList().map(function(o){ return _details[o.id||o.key]; }).filter(Boolean);
    all = (window.DealPilotMandanten && window.DealPilotMandanten.filterByHalter) ? window.DealPilotMandanten.filterByHalter(all) : all; /* mand-filter v803 */
    if(_dashSelIdx>=0 && _dashSelIdx<all.length) return [all[_dashSelIdx]];   // v475: Einzelobjekt-Ansicht
    return all;
  }

  /* ════ PORTFOLIO-RECHEN-SSoT ════
     EINE Stelle fuer die Aggregat-Mathematik. aggStats() ist die Quelle;
     renderOverview UND renderHealth greifen darauf zu. WICHTIG:
     o.kp = Kaufpreis in EURO (String). o._kaufpreis = Kaufpreis in CENT! */
  function _kpEuro(o){ return num(o && o.kp) || (num(o && o._kaufpreis) / 100) || 0; }
  function _restschuldOf(o){
    var fromKpi = num(o._kpis_restschuld); if(fromKpi > 0) return fromKpi;
    var D = num(o.d1) + num(o.d2); if(D <= 0) return 0;
    var zins = num(o.d1z)/100, tilg = num(o.d1t)/100; if(zins <= 0 || tilg <= 0) return D;
    var i = zins/12, A = D*(zins+tilg)/12, m = 0;
    var au = (o.d1_auszahl||'').toString().match(/(\d{1,2})[.\/](\d{4})/);
    if(au){ var mm = +au[1], yy = +au[2]; var now = new Date(); m = (now.getFullYear()-yy)*12 + (now.getMonth()+1-mm); }
    if(m <= 0) return D;
    var pow = Math.pow(1+i, m), rest = D*pow - (A/i)*(pow-1); return rest > 0 ? rest : 0;
  }
  var _cfMode = 'vs'; /* 'vs' vor Steuer | 'ns' nach Steuer (Cashflow-Karte) */
  function toggleCf(){ _cfMode = (_cfMode === 'vs') ? 'ns' : 'vs'; try{ renderOverview(); }catch(e){} }
  var _giMode = 'mit'; /* v886-dash: 'mit' = Gesamtinvestition inkl. NK | 'ohne' = nur Kaufpreis */
  function toggleGi(){ _giMode = (_giMode === 'mit') ? 'ohne' : 'mit'; try{ renderOverview(); }catch(e){} }
  /* v475: Objekt-Auswahl im Cockpit. -1 = alle aggregiert, sonst Index in wonList()/detailArr(). */
  var _dashSelIdx = -1;
  function selectObject(v){
    _dashSelIdx = (v==='__all__'||v===''||v==null) ? -1 : parseInt(v,10);
    if(isNaN(_dashSelIdx)) _dashSelIdx = -1;
    try{ renderOverview(); renderHealth(); renderScoreHero(); renderKpiCards(); }catch(e){}
  }
  /* ════ SCORE-AGGREGATION (IV-gewichtet, SSoT) ════
     Gesamt-Score = investitionsvolumen-gewichtetes Mittel der
     persistierten Einzel-Scores. Kategorie-Scores ebenso, sofern
     Detaildaten geladen sind (categories aus DealScore2.compute pro
     Objekt — die Engine bleibt Single Source). */
  function aggregateScore(){
    var won = wonList();
    var scored = won.filter(function(o){ return scoreOf(o)!=null; });
    if(!scored.length) return { total:null, hasData:false, n:won.length };

    var tw=0, ws=0;
    scored.forEach(function(o){
      var w = num(o.kaufpreis)||1;
      tw += w; ws += scoreOf(o)*w;
    });
    var total = Math.round(ws/tw);

    // Kategorie-Aufschluesselung wenn Details geladen
    var cats = null;
    if(_detailsLoaded){ cats = aggregateCategories(); }
    return { total:total, hasData:true, n:won.length, scored:scored.length, cats:cats };
  }

  /* Kategorie-Scores IV-gewichtet.
     QUELLE 1 (bevorzugt, SSoT): persistierte Kategorien aus dem data-Blob
       - Investor-Plan: _ds2_categories  (aus DealScore2.compute beim Speichern)
       - sonst:         _dp_categories   (DealPilot-Score beim Speichern)
     QUELLE 2 (Fallback, Altobjekte ohne persistierte Cats): compute() aus
       den persistierten _kpis_*-Werten. */
  function aggregateCategories(){
    var arr = detailArr();
    if(!arr.length) return null;
    var P = plan();
    var CK = ['rendite','finanzierung','risiko','lage','upside'];
    var labels = { rendite:'Rendite', finanzierung:'Finanzierung', risiko:'Risiko & Vermietung',
                   lage:'Lage & Diversifikation', upside:'Upside-Potenzial' };
    var acc = {}; CK.forEach(function(k){ acc[k]={tw:0,ws:0,any:false}; });

    arr.forEach(function(d){
      var w = num(d._kaufpreis)||1;
      var cats = pickPersistedCats(d, P.full);   // {rendite:60,...} oder null
      if(!cats){ cats = computeCatsFallback(d); } // letzter Ausweg
      if(!cats) return;
      CK.forEach(function(k){
        var sc = cats[k];
        if(sc!=null && !isNaN(sc)){ acc[k].tw+=w; acc[k].ws+=sc*w; acc[k].any=true; }
      });
    });
    return CK.map(function(k){
      var a=acc[k]; var sc = (a.any && a.tw>0) ? Math.round(a.ws/a.tw) : null;
      return { key:k, label:labels[k], score:sc };
    });
  }

  /* Persistierte Kategorien aus data-Blob lesen, normiert auf {key:score}.
     Akzeptiert beide Formen: Array [{key,score}] oder Objekt {key:{score}}. */
  function pickPersistedCats(d, full){
    var raw = full ? (d._ds2_categories || d._dp_categories)
                   : (d._dp_categories  || d._ds2_categories);
    if(!raw) return null;
    var out = {};
    if(Array.isArray(raw)){
      raw.forEach(function(c){ if(c && c.key!=null) out[c.key] = (c.score!=null?+c.score:(c.value!=null?+c.value:null)); });
    } else if(typeof raw==='object'){
      Object.keys(raw).forEach(function(k){ var c=raw[k]; out[k] = (c&&c.score!=null)?+c.score:(typeof c==='number'?c:null); });
    }
    return Object.keys(out).length ? out : null;
  }

  /* Fallback: compute() aus persistierten KPI-Werten (Altobjekte).
     Nutzt _kpis_* die im data-Blob liegen (entsprechen State.kpis beim Speichern). */
  function computeCatsFallback(d){
    if(!window.DealScore2 || typeof window.DealScore2.compute!=='function') return null;
    var deal = buildDealFromData(d);
    var res; try{ res = window.DealScore2.compute(deal); }catch(e){ return null; }
    if(!res || !res.categories) return null;
    var out={};
    Object.keys(res.categories).forEach(function(k){
      var c=res.categories[k]; var sc=(c&&c.score!=null)?c.score:(c&&c.value!=null?c.value:null);
      if(sc!=null) out[k]=sc;
    });
    return Object.keys(out).length ? out : null;
  }

  /* deal-Objekt fuer DealScore2.compute() — nutzt die persistierten _kpis_*
     (gleiche Keys wie State.kpis in _buildDeal2FromState). */
  function buildDealFromData(d){
    return {
      bruttorendite: numN(d._kpis_bmy),
      dscr:          numN(d._kpis_dscr),
      ltv:           numN(d._kpis_ltv),
      cashflowMonatlich: (d._kpis_cf_ns!=null ? num(d._kpis_cf_ns)/12 : null),
      __raw:d
    };
  }
  function numN(v){ return (v==null||v==='')?null:num(v); }

  /* ════ RENDER: Score-Hero ════ */
  function renderScoreHero(){
    var host = $('dp-pscore-hero'); if(!host) return;
    var P = plan();
    var ag = aggregateScore();
    var title = P.full ? 'Investor Portfolio Score' : 'DealPilot Portfolio Score';
    if(!ag.hasData){
      host.innerHTML = '<div class="hmain"><div class="hpre"><span class="led"></span><span class="t">Pre-Flight \u00b7 Portfolio Score</span><span class="cls">Boarding</span></div>'
        + '<div class="hbody" style="display:block;text-align:center;color:var(--c-pmut);font-family:Inter,sans-serif;font-size:13px;line-height:1.6;padding:30px 22px">'
        + 'Noch kein gewonnenes Objekt mit berechnetem Score.<br>Sobald du ein Objekt auf \u201eGewonnen\u201c setzt und der DealScore berechnet ist, erscheint hier dein Portfolio-Score.</div></div>';
      return;
    }
    var t = tierOf(ag.total);
    var S = aggStats();
    var detailsBtn = P.full
      ? '<button class="hkpi-btn" onclick="DealPilotDashboard.showScoreDetails()"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4-4M11 8v6M8 11h6"/></svg> Details &amp; alle KPIs</button>'
      : '<button class="hkpi-btn" onclick="DealPilotDashboard.showScoreUpgrade()"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Volle 24-KPI-Analyse</button>';
    var catsHtml = ag.cats ? ag.cats.map(function(c){
        var sc=c.score==null?0:c.score; var w=(KPICOUNT[c.key]||0);
        return '<div class="bar"><div class="bt"><span class="n">'+esc(c.label)+'<em>'+w+' KPIs</em></span><span class="v">'+(c.score==null?'\u2013':sc)+'</span></div>'
          + '<div class="track"><div class="fill" data-w="'+sc+'" style="width:0;background:'+catBarColor(sc)+'"></div></div></div>';
      }).join('') : '<div class="bar" style="color:var(--c-pmut);font-family:JetBrains Mono;font-size:11px">Kategorien werden geladen\u2026</div>';
    var cfM=S.cfVsM;
    host.innerHTML =
      '<div class="hmain">'
      + '<div class="hpre"><span class="led"></span><span class="t">Pre-Flight \u00b7 '+(P.full?'Investor':'DealPilot')+' Portfolio Score</span><span class="cls">Boarding</span></div>'
      + '<div class="hbody">'
      + '<div class="hgate">'
      + '<div class="gl">'+esc(title)+'</div>'
      + '<div id="dp-hero-ring"></div>'
      + '<div class="gt" style="background:'+_tierBg(t.t)+';color:'+t.col+'">'+t.l+'</div>'
      + '<div class="tot"><div><div class="k">OBJEKTE</div><div class="v">'+ag.n+'</div></div>'
      + '<div><div class="k">VOL.</div><div class="v">'+fmtKEU(S.kp)+'</div></div>'
      + '<div><div class="k">CF/MON</div><div class="v" style="color:'+(cfM>=0?'var(--c-greenl)':'var(--c-redl)')+'">'+(cfM>=0?'+':'')+fmtE(cfM)+'</div></div></div>'
      + '</div>'
      + '<div class="hbars"><div class="ttl">So setzt sich der Score zusammen</div><div id="dp-hero-bars">'+catsHtml+'</div>'+detailsBtn+'</div>'
      + '</div></div>'
      + '<div class="vperf"></div>'
      + '<div class="hpass"><div class="hp-lab">PORTFOLIO-PASS</div><div class="qb" id="dp-hero-qr"></div>'
      + '<div class="hp-code">PORTFOLIO</div><div class="hp-sub">'+ag.scored+' / '+ag.n+' bewertet<br>Stand '+_heute()+'</div></div>';
    (function(){
      var sc=ag.total, r=46, C=2*Math.PI*r, d=sc/100*C, col=t.col, ring=$('dp-hero-ring');
      if(ring) ring.innerHTML='<svg viewBox="0 0 116 116" width="116" height="116">'
        + '<circle cx="58" cy="58" r="'+r+'" fill="none" stroke="rgba(140,140,140,.18)" stroke-width="9"/>'
        + '<circle cx="58" cy="58" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+d.toFixed(1)+' '+C.toFixed(1)+'" transform="rotate(-90 58 58)"/>'
        + '<text x="58" y="56" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="34" fill="'+col+'">'+sc+'</text>'
        + '<text x="58" y="73" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#9a948a">/ 100</text></svg>';
    })();
    var qrEl=$('dp-hero-qr'); if(qrEl){ qrEl.innerHTML=_qrSvg(((window.location&&location.origin)?location.origin:'')+'/?cockpit', 3); }
    setTimeout(function(){ host.querySelectorAll('.fill').forEach(function(f){ if(f.dataset.w!=null) f.style.width=f.dataset.w+'%'; }); },140);
  }
  function renderKpiCards(){
    var host=$('dp-kpi-grid'); if(!host) return;
    var ag=aggregateScore();
    var P=plan();
    var icons={rendite:'M3 17l6-6 4 4 8-8',finanzierung:'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
      risiko:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',lage:'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z',
      upside:'M4.5 16.5L12 4l7.5 12.5M8 14h8'};
    if(!ag.cats){
      host.innerHTML = '<div class="dp-chart-loading" style="grid-column:1/-1;height:90px"><span class="dp-spin"></span>Kategorien werden berechnet…</div>';
      return;
    }
    host.innerHTML = ag.cats.map(function(c){
      var sc=c.score==null?0:c.score; var t=tierOf(c.score);
      var kn=(catMeta()[c.key]||{}).count||(KPICOUNT[c.key]||0);
      var tierBadge = c.score==null?'–':(c.score>=85?'TOP':c.score>=70?'GUT':c.score>=50?'SOLIDE':c.score>=35?'SCHWACH':'KRITISCH');
      var tierCls = c.score==null?'':(c.score>=85?'tier-top':c.score>=70?'tier-gut':c.score>=50?'tier-solide':'');
      // Sparkline neben dem Sub-Text (wie Mockup kpi-sub-row), nicht als Hintergrund
      var sparkHtml = c.score==null?'':sparkSvg(sc, t.col, sc + (c.key?c.key.length:0));
      return '<div class="kpi dp-card-dark '+tierCls+'">'
        + '<div class="kpi-head"><span class="kpi-tier" style="color:'+t.col+';border-color:'+t.col+'">'+tierBadge+'</span></div>'
        + '<div class="kpi-row"><div class="kpi-l">'+esc(c.label)+'</div>'
        + '<svg class="kpi-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+icons[c.key]+'"/></svg></div>'
        + '<div class="kpi-v" style="color:'+t.col+'">'+(c.score==null?'–':sc+' %')+'</div>'
        + '<div class="kpi-sub-row"><div class="kpi-sub">'+(c.score==null?'keine Daten':(P.full?(kn+' / '+kn+' KPIs'):'Plan-Bewertung'))+'</div>'+sparkHtml+'</div>'
        + '<div class="kpi-prog"><div class="kpi-prog-fill" data-w="'+sc+'" style="width:0%;background:'+t.col+'"></div></div>'
        + '</div>';
    }).join('');
    setTimeout(function(){ host.querySelectorAll('.kpi-prog-fill').forEach(function(f){ f.style.width=f.dataset.w+'%'; }); },120);
  }
  /* Mini-Sparkline EXAKT nach Handoff-Mockup (spark-Array Z.1189):
     weiche Welle um das Score-Niveau via sin/cos, polyline + Endpunkt.
     KEIN echter Zeitverlauf — rein visuell, wie im Mockup. */
  function sparkSvg(score, col, seed){
    var sc=Math.max(0,Math.min(100,score));
    seed=seed||sc;
    var W=60,H=18,n=8, pts=[];
    for(var i=0;i<n;i++){
      var v=sc+Math.sin((i+seed*0.01)*1.3)*5+Math.cos(i*0.7)*2;
      v=Math.max(20,Math.min(100,v));
      pts.push(v);
    }
    var minV=Math.min.apply(null,pts), maxV=Math.max.apply(null,pts), rng=(maxV-minV)||1;
    var coords=pts.map(function(v,i){
      var x=(i/(n-1))*W;
      var y=H-((v-minV)/rng)*(H-3)-1.5;
      return x.toFixed(1)+','+y.toFixed(1);
    });
    var last=coords[coords.length-1].split(',');
    return '<svg class="kpi-spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="color:'+col+'">'
      + '<polyline points="'+coords.join(' ')+'" fill="none" stroke="'+col+'" stroke-width="1.4" opacity="0.9" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<circle cx="'+last[0]+'" cy="'+last[1]+'" r="1.6" fill="'+col+'"/>'
      + '</svg>';
  }

  /* ════ RENDER: Status-Uebersicht ════ */
  function renderStatus(){
    var host=$('dp-status-row'); if(!host) return;
    var pruef=0,won=0,lost=0, pVol=0,wVol=0,lVol=0;
    _summaries.forEach(function(o){
      var s=stageOf(o), v=num(o.kaufpreis)/100;  /* v475: kaufpreis kommt aus der Liste in Cent */
      if(s==='won'){won++;wVol+=v;} else if(s==='lost'){lost++;lVol+=v;} else {pruef++;pVol+=v;}
    });
    host.innerHTML =
      tile('st-pruef','In Pruefung',pruef,pVol)
      + tile('st-won','Gewonnen',won,wVol)
      + tile('st-lost','Verloren',lost,lVol);
    function tile(cls,label,cnt,vol){
      return '<div class="dp-status-tile '+cls+'"><div class="st-l">'+label+'</div>'
        + '<div class="st-v">'+cnt+'</div>'
        + '<div class="st-sub">'+(cnt?fmtKEU(vol)+' € Volumen':'keine Objekte')+'</div></div>';
    }
  }
  /* ════ HEALTH-LEISTE (braucht Detaildaten) ════ */
  /* ══ v456: Portfolio-Uebersicht (Bestands-Hardfacts, aggregiert) ══ */
  function aggStats(){
    var arr=detailArr();
    var sum=function(f){return arr.reduce(function(s,o){return s+(f(o)||0);},0);};
    var kpSum=sum(_kpEuro);
    var giSum=sum(function(o){var g=num(o._kpis_gi); if(g>0)return g; return _kpEuro(o)+_nkEuro(o)+num(o.san)+num(o.moebl);});
    var mieteJ=sum(function(o){var m=num(o._kpis_miete_j); if(m>0)return m; return (num(o.nkm)+num(o.ze))*12;});
    var rest=sum(_restschuldOf);
    var cfNsJ=sum(function(o){return num(o._kpis_cf_ns);});
    var cfVsJ=sum(function(o){var v=o._kpis_cf_vs; return (v!=null&&!isNaN(num(v)))?num(v):num(o._kpis_cf_ns);});
    var kdSum=sum(function(o){return num(o.d1)*(num(o.d1z)+num(o.d1t))/100 + num(o.d2)*(num(o.d2z)+num(o.d2t))/100;});
    var ekSum=sum(function(o){return num(o.ek);});
    var darlSum=sum(function(o){return num(o.d1)+num(o.d2);});
    // Nettomietrendite: IV-gewichtet ueber die kanonische KPI-Engine (window.DealKpis),
    // damit der Portfolio-Wert exakt der Objekt-Berechnung entspricht.
    // Fallback: persistierte _kpis_nmy/_kpis_nmr.
    var nw=0,nws=0;
    arr.forEach(function(o){
      var v=NaN, w=_kpEuro(o)||1;
      if(window.DealKpis && typeof window.DealKpis.compute==='function'){
        try{ var k=window.DealKpis.compute(o); if(k && isFinite(k.nmy)) v=k.nmy; }catch(e){}
      }
      if(!isFinite(v)){ var raw=o._kpis_nmy; if(raw==null)raw=o._kpis_nmr; var rv=num(raw); if(raw!=null&&!isNaN(rv)) v=rv; }
      if(isFinite(v)){ nw+=w; nws+=v*w; }
    });
    var nettoCalc = nw>0 ? (nws/nw) : null;
    return {
      n:arr.length, gi:giSum, kp:kpSum, ek:ekSum, darl:darlSum,
      mieteJ:mieteJ, mieteM:mieteJ/12, rest:rest,
      cfNsJ:cfNsJ, cfVsJ:cfVsJ, cfNsM:cfNsJ/12, cfVsM:cfVsJ/12,
      brutto:(kpSum>0?(mieteJ/kpSum*100):null),
      netto:nettoCalc,
      dscr:(kdSum>0?(mieteJ/kdSum):null)
    };
  }
  function renderOverview(){
    var host=$('dp-overview-strip'); if(!host) return;
    if(!_detailsLoaded){ host.innerHTML='<div class="dp-chart-loading" style="grid-column:1/-1;height:54px"><span class="dp-spin"></span>Kennzahlen werden geladen\u2026</div>'; return; }
    var arr=detailArr(); if(!arr.length){ host.innerHTML='<div class="health-sub" style="grid-column:1/-1">Keine Detaildaten verfuegbar.</div>'; return; }
    var s=aggStats();
    /* v475: Objekt-Dropdown befuellen (volle Liste, nicht gefiltert) */
    (function(){
      var sel=document.getElementById('dp-dash-objsel'); if(!sel) return;
      var allD=wonList().map(function(o){ return _details[o.id||o.key]; }).filter(Boolean);
      var html='<option value="__all__">Alle Objekte ('+allD.length+')</option>';
      allD.forEach(function(d,i){ var nm=(d&&(d._name||d.kuerzel||d._obj_seq))||('Objekt '+(i+1)); html+='<option value="'+i+'"'+(i===_dashSelIdx?' selected':'')+'>'+esc(nm)+'</option>'; });
      if(sel.innerHTML!==html) sel.innerHTML=html;
    })();
    function M(v){ if(v==null||isNaN(v))return '\u2013'; var sg=v<0?'-':''; var a=Math.abs(v); if(a>=1e6) return sg+(a/1e6).toFixed(2).replace('.',',')+'\u00a0Mio\u00a0\u20ac'; return sg+new Intl.NumberFormat('de-DE').format(Math.round(a))+'\u00a0\u20ac'; }
    function P2(v,d){ if(v==null||isNaN(v))return '\u2013'; return v.toFixed(d==null?2:d).replace('.',',')+'\u00a0%'; }
    var green='var(--dp-green)', gold='var(--dp-gold)', red='var(--dp-red)', ch='var(--dp-card-ch)';
    function cfc(v){ return v>=0?green:red; }
    function rcol(v,g,go){ return (v==null||isNaN(v))?ch:(v>=g?green:v>=go?gold:red); }
    function half(l,v,col,sub){ return '<div class="ov-half"><span class="ov-l">'+esc(l)+'</span><div class="ov-v" style="color:'+col+'">'+v+'</div><span class="ov-sub">'+esc(sub)+'</span></div>'; }
    var cfVor = (_cfMode==='vs');
    var cfM = cfVor ? s.cfVsM : s.cfNsM, cfJ = cfVor ? s.cfVsJ : s.cfNsJ;
    var cfLabel = cfVor ? 'vor Steuer' : 'nach Steuer';
    var groups=[
      {t:'Bestand', h:[ half('Objekte', String(s.n), gold, 'im Bestand'), half('Mieteinnahmen / Monat', M(s.mieteM), green, 'netto kalt') ]},
      (function(){ var giO=(_giMode==='ohne'); return {t:'Investition', click:true, fn:'DealPilotDashboard.toggleGi()', ctitle:'Klick wechselt Gesamtinvestition mit/ohne Kaufnebenkosten', h:[ half('Gesamtinvestition', M(giO?s.kp:s.gi), ch, giO?'ohne NK \u00b7 Klick: mit NK':'Kaufpreis + NK \u00b7 Klick: ohne NK'), half('Restschuld gesamt', M(s.rest), ch, 'Verbindlichkeiten') ]}; })(),
      {t:'Mietrendite', h:[ half('Bruttomietrendite', P2(s.brutto), rcol(s.brutto,5,3.5), 'Jahresmiete / KP'), half('Nettomietrendite', P2(s.netto), rcol(s.netto,4,2.5), (s.netto==null?'k.\u00a0A.':'nach BWK')) ]},
      {t:'Cashflow \u00b7 '+cfLabel, click:true, h:[ half('/ Monat', M(cfM), cfc(cfM), cfLabel), half('/ Jahr', M(cfJ), cfc(cfJ), 'Klick: '+(cfVor?'nach':'vor')+' Steuer') ]}
    ];
    host.innerHTML=groups.map(function(g){
      var cl='ov-card ov-pair-card'+(g.click?' ov-clickable':'');
      var on=g.click?(' onclick="'+(g.fn||'DealPilotDashboard.toggleCf()')+'" title="'+esc(g.ctitle||'Klick wechselt vor/nach Steuer')+'"'):'';
      return '<div class="'+cl+'"'+on+'>'
        + '<div class="ov-card-title">'+esc(g.t)+(g.click?' <span class="ov-toggle-hint">\u21c4</span>':'')+'</div>'
        + '<div class="ov-pair">'+g.h.join('')+'</div></div>';
    }).join('');
  }
  function renderHealth(){
    var host=$('dp-health-strip'); if(!host) return;
    var arr=detailArr();
    if(!_detailsLoaded){
      host.innerHTML='<div class="dp-chart-loading" style="grid-column:1/-1;height:60px"><span class="dp-spin"></span>Portfolio-Kennzahlen werden geladen…</div>';
      return;
    }
    if(!arr.length){ host.innerHTML='<div class="health-sub" style="grid-column:1/-1">Keine Detaildaten verfuegbar.</div>'; return; }
    var P=plan();
    if(!P.full){
      /* W10-lockfix: das SVG hatte KEIN width/height -> im Grid-Container blaehte es
   sich bildschirmfuellend auf. Free-User sahen ein schwarzes Riesen-Schloss
   statt der Upsell-Botschaft. */
    host.innerHTML='<div class="health-lock" style="grid-column:1/-1;display:flex;align-items:center;gap:9px"><svg viewBox="0 0 24 24" width="18" height="18" style="flex:none" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Portfolio-Health-KPIs (ROE, Cash-on-Cash, Ø-Zins, ESG …) ab Investor-Plan freigeschaltet</div>';
      return;
    }

    var nowY=new Date().getFullYear();
    var sum=function(f){return arr.reduce(function(s,o){return s+(f(o)||0);},0);};
    var S=aggStats();                 // SSoT: exakt dieselben Zahlen wie die Portfolio-Uebersicht
    var totalKp=S.kp, totalEk=S.ek, totalRest=S.rest;
    var cfNsJ=S.cfNsJ, cfVsJ=S.cfVsJ, cfNsM=S.cfNsM, cfVsM=S.cfVsM;
    var restschuldOf=_restschuldOf;   // eine gemeinsame Restschuld-Funktion
    var roe=totalEk>0?(cfNsJ/totalEk*100):null;
    // Ø-Zins gewichtet nach Restschuld
    var zw=0,zws=0; arr.forEach(function(o){var z=num(o.d1z),r=restschuldOf(o)||1; if(z>0){zw+=r;zws+=z*r;}});
    var avgZins=zw>0?zws/zw:null;
    var coc = totalEk>0 ? (cfVsJ/totalEk*100) : null;
    var roeMode=(window._dpRoeMode==='nach')?'nach':'vor';
    var roeVal=(roeMode==='nach')?roe:coc;
    var roeCfJ=(roeMode==='nach')?cfNsJ:cfVsJ;
    // Zinsbindungs-Risiko: Bindungsende = Auszahlungsjahr (d1_auszahl MM.YYYY) + d1_bindj.
    // Risiko = Restschuld-Anteil, dessen Bindung in <=3 Jahren ausläuft.
    var riskRest=sum(function(o){
      var bindj=num(o.d1_bindj); if(!bindj)return 0;
      var startY=nowY; var au=(o.d1_auszahl||'').toString().match(/(\d{4})/);
      if(au) startY=+au[1];
      else if(o._kaufdat) startY=parseInt(String(o._kaufdat).slice(0,4),10)||nowY;
      var ende=startY+bindj;
      return (ende-nowY)<=3 ? restschuldOf(o) : 0;
    });
    var zinsRiskPct=totalRest>0?(riskRest/totalRest*100):0;
    var hasZinsRisk=arr.some(function(o){return num(o.d1_bindj)>0;});
    // Mietpotenzial: (Marktmiete €/m² * Wfl * 12) - Ist-Jahresmiete.
    // WICHTIG: nkm ist die monatliche Nettokaltmiete -> *12. Nur rechnen wenn
    // BEIDE (Marktmiete UND Ist-Miete) vorliegen, sonst ist die Differenz
    // unsinnig (sonst kaeme das gesamte Marktmiet-Volumen als "Potenzial").
    var mietPotSum=0, mietPotValid=false;
    arr.forEach(function(o){
      var mm=num(o.ds2_marktmiete);   // €/m²/Monat
      var wfl=num(o.wfl);
      var istMM=num(o._kpis_miete_j); // Jahres-Ist falls vorhanden
      var nkmM=num(o.nkm);            // monatliche Nettokaltmiete
      var istMJ = istMM>0 ? istMM : (nkmM>0 ? nkmM*12 : 0);
      if(mm>0 && wfl>0 && istMJ>0){
        var diff=(mm*wfl*12)-istMJ;
        mietPotSum += diff>0?diff:0;
        mietPotValid=true;
      }
    });
    var mietPot=mietPotSum;
    var hasMietPot=mietPotValid;
    // Tilgungsfortschritt: (Anfangsdarlehen - Restschuld)/Anfangsdarlehen
    var totalDarl=sum(function(o){return num(o.d1)+num(o.d2);});
    var tilgFort=(totalDarl>0)?((1-totalRest/totalDarl)*100):null;
    var hasTilg=totalDarl>0;
    // Energie-Substanz (ESG)
    var eMap={A:100,B:88,C:75,D:60,E:45,F:30,G:15,H:0};
    var esgW=0,esgS=0; arr.forEach(function(o){var e=(o.ds2_energie||'').toString().toUpperCase().charAt(0); if(eMap[e]!=null){esgW+=_kpEuro(o);esgS+=eMap[e]*_kpEuro(o);}});
    var esg=esgW>0?esgS/esgW:null;
    var leer=arr.length?sum(function(o){return num(o.leerstand);})/arr.length:null;

    function colByVal(v,good,bad){ if(v==null)return 'var(--dp-card-ch)'; return v>=good?'var(--dp-green)':v>=bad?'var(--dp-gold)':'var(--dp-red)'; }
    function eurM(v){ return (v<0?'-':'')+fmtE(Math.abs(Math.round(v)))+' €'; }
    function cfCol(v){ return v>=0?'var(--dp-green)':'var(--dp-red)'; }

    // l=Label, v=Wert, sub=Unterzeile, tip=Tooltip (v454: Set + Reihenfolge nach Mockup)
    var zinsMode=(window._dpZinsMode==='risiko')?'risiko':'zins';
    var cards=[
      {l:'Eigenkapital-Rendite',
       v:roeVal==null?'\u2013':roeVal.toFixed(2).replace('.',',')+'\u00a0%',
       sub:roeMode==='nach'?'nach Steuer \u00b7 ROE \u00b7 Klick: vor Steuer':'vor Steuer \u00b7 Cash-on-Cash \u00b7 Klick: nach Steuer',
       col:colByVal(roeVal,roeMode==='nach'?6:4,roeMode==='nach'?3:2),
       click:'DealPilotDashboard.toggleRoe()',
       tip:'Eigenkapital-Rendite ('+(roeMode==='nach'?'nach Steuer \u00b7 ROE':'vor Steuer \u00b7 Cash-on-Cash')+')\n= j\u00e4hrlicher Cashflow '+(roeMode==='nach'?'nach':'vor')+' Steuer \u00f7 eingesetztes Eigenkapital\n= '+eurM(roeCfJ)+' \u00f7 '+(totalEk>0?(fmtE(Math.round(totalEk))+'\u00a0\u20ac'):'\u2014')+(roeVal==null?'':(' = '+roeVal.toFixed(2).replace('.',',')+'\u00a0%'))+'\n\nVor Steuer entspricht der Cash-on-Cash-Rendite. Klick wechselt vor/nach Steuer.'},
      (zinsMode==='risiko' ? {l:'Zinsbindungs-Risiko',
        v:!hasZinsRisk?'\u2013':zinsRiskPct.toFixed(2).replace('.',',')+'\u00a0%',
        sub:'Bindung l\u00e4uft < 3 J. aus \u00b7 Klick: \u00d8-Zins',
        col:zinsRiskPct>20?'var(--dp-red)':'var(--dp-card-ch)',
        click:'DealPilotDashboard.toggleZins()',
        tip:'Zinsbindungs-Risiko: Anteil der Restschuld, deren Zinsbindung in den n\u00e4chsten 3 Jahren ausl\u00e4uft.\nKlick wechselt zum \u00d8-Zinssatz.'}
      : {l:'\u00d8-Zinssatz',
        v:avgZins==null?'\u2013':avgZins.toFixed(2).replace('.',',')+'\u00a0%',
        sub:'nach Restschuld gewichtet \u00b7 Klick: Zinsrisiko',
        col:avgZins==null?'var(--dp-card-ch)':(avgZins<=3?'var(--dp-green)':avgZins<=4.5?'var(--dp-gold)':'var(--dp-red)'),
        click:'DealPilotDashboard.toggleZins()',
        tip:'Durchschnittlicher Sollzins aller Finanzierungen, gewichtet nach der jeweiligen Restschuld.\nKlick wechselt zum Zinsbindungs-Risiko.'}),
      {l:'DSCR', v:(S.dscr==null?'\u2013':S.dscr.toFixed(2).replace('.',',')), sub:'Kapitaldienstdeckung', col:(S.dscr==null?'var(--dp-card-ch)':(S.dscr>=1.2?'var(--dp-green)':S.dscr>=1?'var(--dp-gold)':'var(--dp-red)')),
       tip:'Schuldendienstdeckungsgrad: Miet\u00fcberschuss im Verh\u00e4ltnis zum Kapitaldienst (Zins + Tilgung). Ab 1,2 komfortabel.'},
      {l:'Tilgungsfortschritt', v:!hasTilg?'\u2013':Math.max(0,tilgFort).toFixed(2).replace('.',',')+'\u00a0%', sub:'Darlehen getilgt', col:'var(--dp-gold)',
       tip:'Wie viel des urspr\u00fcnglichen Darlehens bereits getilgt wurde.'}
    ];
    host.innerHTML=cards.map(function(c){
      return '<div class="kpi'+(c.click?' kpi-click':'')+'"'+(c.click?(' onclick="'+c.click+'"'):'')+' title="'+esc(c.tip||'')+'">'
        + '<div class="k">'+esc(c.l)+(c.click?' <span class="kpi-hint">\u21c4</span>':'')+'</div>'
        + '<div class="v" style="color:'+(c.col||'var(--c-ptext)')+'">'+c.v+'</div>'
        + '<div class="h">'+esc(c.sub)+'</div></div>';
    }).join('');
  }

  /* ════ MODELLPROJEKTION (vereinfacht, klar gelabelt) ════
     Annahmen wie Mockup. NICHT die echte calc.js-Pipeline — daher
     ueberall mit „Modellprojektion" gekennzeichnet. */
  var ASSUMP={mietWg:0.015,bwkWg:0.02,wertWg:0.02,afaRate:0.02,gebAnteil:0.8,zinsApprox:0.035};
  var ZVE_BASE=78000;
  function estg2026(zve){
    zve=Math.floor(zve); if(zve<=11784)return 0;
    if(zve<=17005){var y=(zve-11784)/10000;return Math.round((922.98*y+1400)*y);}
    if(zve<=66760){var z=(zve-17005)/10000;return Math.round((181.19*z+2397)*z+1025.38);}
    if(zve<=277825)return Math.round(0.42*zve-10602.13);
    return Math.round(0.45*zve-18936.88);
  }
  function projectAll(years){
    var arr=detailArr(); var rows=[]; var cumCf=0;
    var vuvY1=arr.reduce(function(s,o){return s+(num(o._kpis_vuv)||0);},0);
    var estgOhne=estg2026(ZVE_BASE);
    for(var i=0;i<years;i++){
      var yr=2026+i, miete=0,bwk=0,zins=0,tilg=0,afa=0,rest=0,wert=0;
      arr.forEach(function(o){
        var kp=num(o._kaufpreis);
        var mieteJ=num(o.ist_miete_j)||num(o.kaltmiete_j)||num(o.jahresmiete)||kp*0.05;
        var bwkJ=num(o.bwk_j)||num(o.bewirtschaftung_j)||mieteJ*0.2;
        var zinsJ=num(o.zins_j)||(kp*(num(o._kpis_ltv)/100||0.8)*ASSUMP.zinsApprox);
        var tilgJ=num(o.tilg_j)||(kp*(num(o._kpis_ltv)/100||0.8)*0.02);
        var restschuld=num(o._kpis_restschuld)||num(o.restschuld)||kp*(num(o._kpis_ltv)/100||0.8);
        var rate=zinsJ+tilgJ;
        var restStart=Math.max(0,restschuld-tilgJ*i);
        var zinsI=Math.max(0,restStart*ASSUMP.zinsApprox);
        var tilgI=Math.min(restStart,Math.max(0,rate-zinsI));
        miete+=mieteJ*Math.pow(1+ASSUMP.mietWg,i);
        bwk+=bwkJ*Math.pow(1+ASSUMP.bwkWg,i);
        zins+=zinsI; tilg+=tilgI; afa+=kp*ASSUMP.gebAnteil*ASSUMP.afaRate;
        rest+=Math.max(0,restStart-tilgI); wert+=kp*Math.pow(1+ASSUMP.wertWg,i);
      });
      var cfVor=miete-bwk-zins-tilg;
      var vuv=miete-bwk-zins-afa;
      var estgMit=estg2026(ZVE_BASE+vuv);
      var steuereffekt=estgOhne-estgMit;
      var cfNach=cfVor+steuereffekt; cumCf+=cfNach;
      rows.push({yr:yr,miete:miete,bwk:bwk,zins:zins,tilg:tilg,afa:afa,cfVor:cfVor,vuv:vuv,
        zve:ZVE_BASE+vuv,estg:estgMit,steuereffekt:steuereffekt,cfNach:cfNach,cumCf:cumCf,rest:rest,wert:wert,eq:wert-rest});
    }
    return rows;
  }

  /* ════ CHARTS (Chart.js, Palette V3) ════ */
  function cssv(n){ var m=$(MOUNT_ID); return m?getComputedStyle(m).getPropertyValue(n).trim():''; }
  function isDark(){ return document.body.classList.contains('dp-theme-dark'); }
  function chartPalette(){
    return isDark()
      ? ['#C9A84C','#E8C964','#9a7f33','#D8D2C7','#F2ECDC','#A89F8E','#6E665A','#8F8576']
      : ['#C9A84C','#9a7f33','#2A2727','#7A7370','#B8B0A4','#5A5350','#E0BE7C','#9A9390'];
  }
  function destroyCharts(){ _charts.forEach(function(c){try{c.destroy();}catch(e){}}); _charts=[]; }

  function buildCharts(){
    if(typeof Chart==='undefined') return;
    destroyCharts();
    var arr=detailArr();
    var loadingHosts=['dpc-cashflow','dpc-vermoegen','dpc-mittelverw','dpc-wealth','dpc-klumpen','dpc-steuer'];
    if(!_detailsLoaded || !arr.length){
      loadingHosts.forEach(function(id){ var c=$(id); if(c){var box=c.closest('.chart-box'); if(box)box.innerHTML='<div class="dp-chart-loading"><span class="dp-spin"></span>laden…</div>';} });
      return;
    }
    var SER=chartPalette();
    var muted=cssv('--dp-muted')||'#7A7370';
    var gridc='rgba('+(isDark()?'201,168,76':'122,115,112')+',.10)';
    Chart.defaults.font.family='Inter,-apple-system,Segoe UI,sans-serif';
    Chart.defaults.font.size=11.5; Chart.defaults.color=muted; Chart.defaults.borderColor=gridc;
    Chart.defaults.plugins.legend.labels.usePointStyle=true; Chart.defaults.plugins.legend.labels.pointStyle='circle';
    Chart.defaults.plugins.legend.labels.boxWidth=8; Chart.defaults.plugins.legend.labels.padding=10;
    Chart.defaults.animation.easing='easeOutQuart'; Chart.defaults.animation.duration=900;
    // v452.3: Tooltips lesbar + €-formatiert, Hover ueber ganze X-Achse
    var ttBg = isDark() ? 'rgba(10,8,5,.96)' : 'rgba(20,18,14,.96)';
    Chart.defaults.plugins.tooltip.backgroundColor=ttBg;
    Chart.defaults.plugins.tooltip.titleColor='#F2ECDC';
    Chart.defaults.plugins.tooltip.bodyColor='#F2ECDC';
    Chart.defaults.plugins.tooltip.borderColor='rgba(201,168,76,.45)';
    Chart.defaults.plugins.tooltip.borderWidth=1;
    Chart.defaults.plugins.tooltip.padding=11;
    Chart.defaults.plugins.tooltip.cornerRadius=8;
    Chart.defaults.plugins.tooltip.usePointStyle=true;
    Chart.defaults.plugins.tooltip.titleFont={size:12,weight:'700'};
    Chart.defaults.plugins.tooltip.bodyFont={size:12,weight:'500'};
    Chart.defaults.interaction={mode:'index',intersect:false};
    function eurTt(){ return { callbacks:{ label:function(ctx){
      var v=ctx.parsed.y!=null?ctx.parsed.y:ctx.parsed;
      return ' '+(ctx.dataset.label?ctx.dataset.label+': ':'')+new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(Math.round(v))+' €';
    }}}; }

    var PR=projectAll(_projYears); var labels=PR.map(function(r){return r.yr;});
    // Y-Achsen-Kurzformat (90.000.000 -> "90 Mio", 500000 -> "500k")
    function yfmt(v){ var a=Math.abs(v); if(a>=1e6)return (v/1e6).toFixed(a>=1e7?0:1).replace('.',',')+' Mio'; if(a>=1e3)return Math.round(v/1e3)+'k'; return ''+Math.round(v); }
    var axisCol = isDark() ? 'rgba(232,226,212,.55)' : '#7A7370';
    var gridCol = isDark() ? 'rgba(201,168,76,.10)' : 'rgba(122,115,112,.12)';
    // gemeinsame Achsen-Optionen fuer Linien/Bar-Charts
    function axes(opts){
      opts=opts||{};
      return {
        x:{ grid:{color:gridCol,drawBorder:false}, ticks:{color:axisCol,maxRotation:0,autoSkip:true,maxTicksLimit:8} },
        y:{ grid:{color:gridCol,drawBorder:false}, ticks:{color:axisCol,callback:opts.money===false?undefined:function(v){return yfmt(v);}} }
      };
    }
    function mk(id,cfg){ var cv=$(id); if(!cv)return; cfg.options=cfg.options||{}; cfg.options.responsive=true; cfg.options.maintainAspectRatio=false; cfg.options.devicePixelRatio=2;
      if(cfg.type!=='doughnut' && cfg.type!=='pie'){
        cfg.options.scales=cfg.options.scales||axes(cfg._axesOpts);
        cfg.options.plugins=cfg.options.plugins||{};
        if(!cfg.options.plugins.tooltip) cfg.options.plugins.tooltip=eurTt();
      }
      _charts.push(new Chart(cv,cfg)); }

    // 1) Cashflow-Verlauf (vor/nach Steuer)
    mk('dpc-cashflow',{type:'line',data:{labels:labels,datasets:[
      {label:'CF vor St.',data:PR.map(function(r){return Math.round(r.cfVor);}),borderColor:SER[0],backgroundColor:SER[0]+'22',tension:.35,fill:true,pointRadius:0,borderWidth:2},
      {label:'CF nach St.',data:PR.map(function(r){return Math.round(r.cfNach);}),borderColor:SER[1],tension:.35,fill:false,pointRadius:0,borderWidth:2,borderDash:[5,4]}
    ]},options:{plugins:{legend:{display:true}}}});

    // 2) Vermoegens-Schere (Wert vs. Restschuld)
    mk('dpc-vermoegen',{type:'line',data:{labels:labels,datasets:[
      {label:'Immobilienwert',data:PR.map(function(r){return Math.round(r.wert);}),borderColor:SER[0],backgroundColor:SER[0]+'18',tension:.3,fill:true,pointRadius:0,borderWidth:2},
      {label:'Restschuld',data:PR.map(function(r){return Math.round(r.rest);}),borderColor:isDark()?SER[2]:'#2A2727',tension:.3,fill:false,pointRadius:0,borderWidth:2}
    ]},options:{plugins:{legend:{display:true}}}});

    // 3) Mittelverwendung Jahr 1 (Bars)
    var p0=PR[0]||{};
    mk('dpc-mittelverw',{type:'bar',data:{labels:['Miete','BWK','Zins','Tilgung','AfA'],datasets:[
      {data:[p0.miete,p0.bwk,p0.zins,p0.tilg,p0.afa].map(function(v){return Math.round(v||0);}),
       backgroundColor:[SER[0],SER[3],SER[2],SER[1],SER[4]],borderRadius:5}
    ]},options:{plugins:{legend:{display:false}}}});

    // 4) Wealth-Stacks (EK-Aufbau)
    mk('dpc-wealth',{type:'bar',data:{labels:labels.filter(function(_,i){return i%Math.ceil(_projYears/10)===0;}),
      datasets:[{label:'Eigenkapital',data:PR.filter(function(_,i){return i%Math.ceil(_projYears/10)===0;}).map(function(r){return Math.round(r.eq);}),backgroundColor:SER[0],borderRadius:4}]},
      options:{plugins:{legend:{display:false}}}});

    // 5) Klumpenrisiko-Donut (Vol nach Ort)
    var byOrt={}; arr.forEach(function(o){var k=o._ort||'Sonstige'; byOrt[k]=(byOrt[k]||0)+num(o._kaufpreis);});
    mk('dpc-klumpen',{type:'doughnut',data:{labels:Object.keys(byOrt),datasets:[
      {data:Object.values(byOrt),backgroundColor:SER,borderWidth:2,borderColor:cssv('--dp-surface')||'#fff',borderRadius:6,spacing:2,hoverOffset:10}
    ]},options:{cutout:'68%',plugins:{legend:{display:true,position:'right'}}}});

    // 6) Steuer-Verlauf
    var TAX_OHNE=isDark()?'#A89F8E':'#7A7370', TAX_MIT='#C9A84C';
    mk('dpc-steuer',{type:'line',data:{labels:labels,datasets:[
      {label:'Steuereffekt',data:PR.map(function(r){return Math.round(r.steuereffekt);}),borderColor:TAX_MIT,backgroundColor:TAX_MIT+'2e',tension:.3,fill:true,pointRadius:0,borderWidth:2},
      {label:'EStG mit Immo',data:PR.map(function(r){return Math.round(r.estg);}),borderColor:TAX_OHNE,tension:.3,fill:false,pointRadius:0,borderWidth:1.6,borderDash:[4,4]}
    ]},options:{plugins:{legend:{display:true}}}});
  }

  /* ════ PROJEKTIONSTABELLE ════ */
  function renderProjTable(){
    var host=$('dp-proj-table'); if(!host) return;
    if(!_detailsLoaded){ host.innerHTML='<tr><td style="padding:18px;text-align:center;color:var(--dp-muted)">Modellprojektion wird vorbereitet…</td></tr>'; return; }
    var PR=projectAll(_projYears);
    var cols=[['Jahr','yr'],['Miete','miete'],['BWK','bwk'],['Zins','zins'],['Tilgung','tilg'],['AfA','afa'],
      ['CF vor St.','cfVor'],['V+V-Erg.','vuv'],['Steuereffekt','steuereffekt'],['CF nach St.','cfNach'],
      ['Kum. CF','cumCf'],['Restschuld','rest'],['Wert','wert'],['Eigenkapital','eq']];
    var head='<thead><tr>'+cols.map(function(c){return '<th>'+c[0]+'</th>';}).join('')+'</tr></thead>';
    var body='<tbody>'+PR.map(function(r){
      var mile=(r.yr-2026)%5===0 && r.yr!==2026;
      return '<tr'+(mile?' class="milestone"':'')+'>'+cols.map(function(c){
        var v=r[c[1]]; if(c[1]==='yr')return '<td>'+v+'</td>';
        var cls=(c[1]==='cfVor'||c[1]==='cfNach'||c[1]==='steuereffekt'||c[1]==='vuv')?(v>=0?'pos':'neg'):'';
        return '<td class="'+cls+'">'+fmtE(v)+'</td>';
      }).join('')+'</tr>';
    }).join('')+'</tbody>';
    host.innerHTML=head+body;
  }
  function setProjYears(y){ _projYears=y;
    var box=$('dp-proj-years'); if(box){box.querySelectorAll('button').forEach(function(b){b.classList.toggle('active',+b.dataset.y===y);});}
    renderProjTable(); buildCharts();
  }
  /* ════ KANBAN + KARTEN ════ */
  function objImg(o){
    var src=o.thumbnail||o.photoSrc;
    if(src) return '<div class="oc-thumb" style="background-image:url(\''+esc(src)+'\')"></div>';
    return '<div class="oc-thumb oc-thumb-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/></svg></div>';
  }
  function scoreRing(sc, col){
    if(sc==null) return '';
    var dash=(sc/100*81.7).toFixed(1);
    return '<div class="oc-ring" style="color:'+col+'" title="Score '+sc+'/100">'
      + '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="rgba(201,168,76,.18)" stroke-width="2.5"/>'
      + '<circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="'+dash+' 81.7" stroke-linecap="round" transform="rotate(-90 16 16)"/></svg>'
      + '<span class="oc-ring-num">'+sc+'</span></div>';
  }
  function pdfRowHtml(k, name){
    return '<div class="pdf-row pdf-row-3">'
      + '<button onclick="DealPilotDashboard.cardPdf(\''+esc(k)+'\',\'invest\')">Investment</button>'
      + '<button onclick="DealPilotDashboard.cardPdf(\''+esc(k)+'\',\'bank\')">Bankexport</button>'
      + '<button onclick="DealPilotDashboard.cardPdf(\''+esc(k)+'\',\'wk\')">Werbungsk.</button>'
      + '</div>'
      + '<button class="oc-delete" onclick="DealPilotDashboard.cardDelete(\''+esc(k)+'\',\''+esc(name)+'\')">Löschen</button>';
  }
  function kanbanCardHtml(o){
    var st=stageOf(o); var sc=scoreOf(o); var t=tierOf(sc); var k=o.id||o.key;
    var tcls = (t.t==='lo')?'tr':((t.t==='mid')?'ty':'tg');
    var scVal = (sc==null)?'\u2013':sc;
    var cf = (o.cf_ns!=null)? (num(o.cf_ns)/100/12) : null;
    var cfStr = (cf==null)?'\u2013':((cf>=0?'+':'')+fmtE(cf)+' \u20ac');
    var dscrStr = (o.dscr!=null)?(+o.dscr).toFixed(2).replace('.',','):'\u2013';
    var bmrStr = (o.bmy!=null)?(+o.bmy).toFixed(2).replace('.',',')+' %':'\u2013';
    var nm=esc(o.name||o.kuerzel||'Unbenannt');
    var meta=esc((o.ort||o.kuerzel||'')+(o.seq_no?(' \u00b7 '+o.seq_no):''));
    var pass=_passByObj[k];
    var share = pass
      ? '<div class="kc-share"><a class="qb" href="'+(((window.location&&location.origin)?location.origin:'')+'/pass.html?c='+pass.code)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">'+_qrSvg(((window.location&&location.origin)?location.origin:'')+'/pass.html?c='+pass.code,3)+'</a>'
        + '<div class="si">Geteilter Pass<br><b>'+esc(pass.code)+'</b><br>'+_passRest(pass.expires_at)+' Restlaufzeit</div></div>'
      : '<div class="cta"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8h16v-8M12 3v13m0-13l-4 4m4-4l4 4"/></svg>Quick Boarding teilen \u2192 QR erscheint</div>';
    var pdfs='<div class="pdfs">'+'<button class="kc-openbtn" onclick="event.stopPropagation();DealPilotDashboard.openObject(\''+esc(k)+'\')">Objekt \u00f6ffnen</button>'
      + '<button onclick="event.stopPropagation();DealPilotDashboard.cardPdf(\''+esc(k)+'\',\'invest\')">'+_dl()+'Investment</button>'
      + '<button onclick="event.stopPropagation();DealPilotDashboard.cardPdf(\''+esc(k)+'\',\'wk\')">'+_dl()+'Werbungsk.</button>'
      + '<button onclick="event.stopPropagation();DealPilotDashboard.cardPdf(\''+esc(k)+'\',\'bank\')">'+_dl()+'Bank</button>'
      + '</div>';
    return '<div class="kc '+tcls+'" onclick="this.classList.toggle(\'open\')">'
      + '<div class="kc-flat"><div class="nm">'+nm+'<small>'+meta+'</small></div>'
      + '<div class="kc-scwrap" style="text-align:center"><div class="sc" style="--p:'+(sc==null?0:sc)+'"><span>'+scVal+'</span></div><div class="scl">'+t.l+'</div></div>'
      + '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg></div>'
      + '<div class="kc-body"><div class="kc-in"><div class="kc-kp">'
      + '<div><div class="kk">DSCR</div><div class="kv">'+dscrStr+'</div></div>'
      + '<div><div class="kk">CF/Mon</div><div class="kv" style="color:'+((cf!=null&&cf<0)?'var(--c-red)':'var(--c-green)')+'">'+cfStr+'</div></div>'
      + '<div><div class="kk">BMR</div><div class="kv">'+bmrStr+'</div></div>'
      + '</div>'+share+pdfs+'</div></div></div>';
  }
  function objCardHtml(o){
    var st=stageOf(o); var sc=scoreOf(o); var t=tierOf(sc); var k=o.id||o.key;
    var badge=st==='won'?'GEWONNEN':st==='lost'?'VERLOREN':'IN PRÜFUNG';
    return '<div class="dp-obj-card">'
      + '<div class="oc-row">'
      + objImg(o)
      + '<div class="oc-main"><span class="oc-badge oc-badge-'+st+'">'+badge+'</span>'
      + '<div class="oc-name">'+esc(o.name||o.kuerzel||'Unbenannt')+'</div>'
      + '<div class="oc-ort">'+esc(o.ort||o.kuerzel||'')+'</div></div>'
      + scoreRing(sc, t.col)
      + '</div>'
      + '<div class="oc-kpis">'
      + '<div><b>'+(o.dscr!=null?(+o.dscr).toFixed(2).replace('.',','):'–')+'</b><span>DSCR</span></div>'
      + '<div><b>'+(o.bmy!=null?(+o.bmy).toFixed(1).replace('.',',')+'%':'–')+'</b><span>Rendite</span></div>'
      + '<div><b>'+fmtKEU(num(o.kaufpreis))+'</b><span>Kaufpreis</span></div>'
      + '</div>'
      + pdfRowHtml(k, o.name||o.kuerzel||'Objekt')
      + '</div>';
  }
  function renderBoardOrCards(){
    var host=$('dp-board'); if(!host) return;
    if(!_summaries.length){
      host.innerHTML='<div class="gempty" style="grid-column:1/-1">Noch keine Objekte \u2013 lege dein erstes Objekt an, dann erscheint es hier.</div>';
      return;
    }
    var groups={pruef:[],won:[],lost:[]};
    _summaries.forEach(function(o){ (groups[stageOf(o)]||groups.pruef).push(o); });
    function col(title,cls,arr){
      return '<div><div class="gh '+cls+'"><span>'+title+'</span><span class="c">'+arr.length+'</span></div>'
        + '<div class="gcol">'+(arr.length?arr.map(kanbanCardHtml).join(''):'<div class="gempty">keine Objekte am Gate</div>')+'</div></div>';
    }
    host.innerHTML = col('\u229d In Pr\u00fcfung','',groups.pruef)
      + col('\u2713 Gewonnen','won',groups.won)
      + col('\u2717 Verloren','lost',groups.lost);
  }
  function setCardView(v){ _cardView=v;
    var sw=$('dp-view-switch'); if(sw){sw.querySelectorAll('button').forEach(function(b){b.classList.toggle('active',b.dataset.v===v);});}
    renderBoardOrCards();
  }

  /* ════ PER-KARTE PDF ════
     Das Objekt muss in den State geladen werden (App hat keine loadObject-Fn,
     nur Event-Delegation auf .sb-card). Der Klick wechselt aber die Ansicht ->
     Dashboard verschwindet. Loesung: nach dem PDF-Export Dashboard sofort
     wieder oeffnen (openDashboard), sodass der User nahtlos zurueck ist. */
  function _loadObjectIntoState(key){
    return new Promise(function(resolve, reject){
      var card = document.querySelector('.sb-card[data-key="'+(window.CSS&&CSS.escape?CSS.escape(key):key)+'"]');
      if(!card){
        var all=document.querySelectorAll('.sb-card');
        for(var i=0;i<all.length;i++){ if(all[i].getAttribute('data-key')===String(key)){ card=all[i]; break; } }
      }
      if(!card){ reject(new Error('Objekt-Karte nicht gefunden')); return; }
      card.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      // v452.8: auf durchgerechneten State warten (cfRows da) statt fixe Zeit.
      var tries=0, max=20;  // bis ~3s
      (function waitState(){
        tries++;
        var ready = window.State && window.State.cfRows && window.State.cfRows.length>0;
        if(ready){ setTimeout(resolve,150); return; }   // kurzer Nachlauf fuer calc
        if(tries>=max){ resolve(); return; }            // Timeout: trotzdem versuchen
        setTimeout(waitState,150);
      })();
    });
  }
  function _restoreDashboard(){
    // Dashboard nahtlos wieder einblenden (Objekt-Klick hatte es ausgeblendet)
    try { openDashboard(); } catch(e){}
  }
  function _runPdf(typ){
    if(typ==='invest'){
      var fnInv=(typeof window.exportPDF==='function')?window.exportPDF:(typeof exportPDF==='function')?exportPDF:null;
      if(fnInv){ try{ fnInv(); }catch(e){} }
      else if(typeof window.toast==='function') window.toast('Investment-PDF-Funktion nicht verfuegbar');
    } else if(typ==='bank'){
      // Bankexport: mehrere moegliche Funktionsnamen abklappern (robust)
      var fnBank=null, names=['exportBmfPdf','exportBankPdf','exportBankenPdf','exportBankPDF'];
      for(var n=0;n<names.length;n++){
        if(typeof window[names[n]]==='function'){ fnBank=window[names[n]]; break; }
        try{ if(typeof eval(names[n])==='function'){ fnBank=eval(names[n]); break; } }catch(e){}
      }
      if(fnBank){ try{ fnBank(); }catch(e){} }
      else if(typeof window.toast==='function') window.toast('Bankexport-Funktion nicht verfuegbar');
    } else if(typ==='wk-single' || typ==='wk-all'){
      var mode=(typ==='wk-all')?'all-years':'single-year';
      var fnWk=(typeof window.exportWerbungskostenPDF==='function')?window.exportWerbungskostenPDF:(typeof exportWerbungskostenPDF==='function')?exportWerbungskostenPDF:null;
      if(fnWk){ try{ fnWk(mode); }catch(e){} }
      else if(typeof window.toast==='function') window.toast('Werbungskosten-PDF-Funktion nicht verfuegbar');
    }
  }
  function cardPdf(key, typ){
    // Werbungskosten -> erst Jahr-Auswahl-Modal, dann laden+export
    if(typ==='wk'){ openWkModal(key); return; }
    _doCardPdf(key, typ);
  }
  function _doCardPdf(key, typ){
    if(typeof window.toast==='function') window.toast('PDF wird erstellt…');
    _loadObjectIntoState(key).then(function(){
      // PDF nach kurzem Tick exportieren, dann Dashboard zurueckholen
      _runPdf(typ);
      setTimeout(_restoreDashboard, 400);
    }).catch(function(e){
      _restoreDashboard();
      if(typeof window.toast==='function') window.toast('Fehler: '+e.message);
    });
  }
  /* Werbungskosten-Auswahl: Aktuelles Jahr vs. Alle Jahre (mode single-year/all-years) */
  function openWkModal(key){
    var ov=document.createElement('div'); ov.className='dp-wk-modal-ov';
    ov.innerHTML='<div class="dp-wk-modal">'
      + '<div class="dp-wk-modal-t">Werbungskosten-PDF</div>'
      + '<div class="dp-wk-modal-s">Welchen Zeitraum möchtest du exportieren?</div>'
      + '<div class="dp-wk-modal-btns">'
      + '<button data-m="single">Aktuelles Jahr</button>'
      + '<button data-m="all">Alle Jahre (bis 15 J. + Übersicht)</button>'
      + '</div>'
      + '<button class="dp-wk-modal-x">Abbrechen</button>'
      + '</div>';
    function close(){ try{document.body.removeChild(ov);}catch(e){} }
    ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
    ov.querySelector('.dp-wk-modal-x').onclick=close;
    ov.querySelectorAll('.dp-wk-modal-btns button').forEach(function(b){
      b.onclick=function(){ var m=b.getAttribute('data-m'); close(); _doCardPdf(key, m==='all'?'wk-all':'wk-single'); };
    });
    document.body.appendChild(ov);
  }
  function headerTrackRecord(){
    if(typeof window.showTrackRecordView==='function'){ closeDashboard(); window.showTrackRecordView(); return; }
    if(typeof window.exportPortfolioStrategyPDF==='function') return window.exportPortfolioStrategyPDF();
    if(typeof window.toast==='function') window.toast('Track-Record-Funktion nicht verfuegbar');
  }
  function cardDelete(key, name){
    if(!confirm('Objekt „'+name+'" wirklich loeschen? Das kann nicht rueckgaengig gemacht werden.')) return;
    if(!window.Auth||typeof window.Auth.apiCall!=='function') return;
    window.Auth.apiCall('/objects/'+key,{method:'DELETE'}).then(function(){
      _summaries=_summaries.filter(function(o){return (o.id||o.key)!==key;});
      delete _details[key]; _detailsLoaded=false;
      renderAll();
      loadDetails().then(function(){ renderHealth(); renderOverview(); renderKpiCards(); renderScoreHero(); buildCharts(); renderProjTable(); });
      if(typeof window.refreshSavedList==='function') window.refreshSavedList();
      if(typeof window.toast==='function') window.toast('Objekt geloescht');
    }).catch(function(e){ if(typeof window.toast==='function') window.toast('Loeschen fehlgeschlagen'); });
  }

  /* ════ THEME (app-weit) ════ */
  function applyTheme(){
    var th=localStorage.getItem('dp_theme')||'light';
    document.body.classList.toggle('dp-theme-dark', th==='dark');
  }
  function setTheme(th){
    localStorage.setItem('dp_theme', th==='dark'?'dark':'light');
    applyTheme();
    if($(MOUNT_ID) && $(MOUNT_ID).style.display!=='none'){ destroyCharts(); buildCharts(); renderScoreHero(); renderKpiCards(); }
    var sw=document.querySelector('.dp-theme-switch');
    if(sw){ sw.querySelectorAll('button').forEach(function(b){b.classList.toggle('active',b.dataset.th===(th||'light'));}); }
  }

  /* ════ VOLLBREITE = eigener Vollbild-Modus ════
     WICHTIG (v452.7): qc-standalone-active NICHT nutzen! Diese Klasse ist mit
     tour-engine.js + qc-bridge.js verdrahtet und triggert "Lade Quick-Check".
     Stattdessen eigene Body-Klasse dp-dash-fullscreen, die per CSS dasselbe
     erreicht (Tab-Bar/Workflow-Bar/Sidebar weg). hdr-collapsed bleibt (das ist
     nur Header-Minimierung, kein Quick-Check-Trigger). */
  var _dpFullscreen=false;
  function toggleSidebar(){
    _dpFullscreen=!_dpFullscreen;
    setFullscreen(_dpFullscreen);
    setTimeout(function(){ destroyCharts(); buildCharts(); if(_pctx)stopParticles(); setTimeout(initParticles,80); },340);
  }
  function setFullscreen(on){
    var b=document.body;
    if(on){
      b.classList.add('dp-dash-fullscreen');
      if(!b.classList.contains('hdr-collapsed')){
        b.classList.add('hdr-collapsed'); b.dataset.dpHdrAuto='1';
      } else { b.dataset.dpHdrAuto='0'; }
      if(typeof window._updateHdrHeight==='function') window._updateHdrHeight();
    } else {
      b.classList.remove('dp-dash-fullscreen');
      if(b.dataset.dpHdrAuto==='1'){ b.classList.remove('hdr-collapsed'); }
      delete b.dataset.dpHdrAuto;
      if(typeof window._updateHdrHeight==='function') window._updateHdrHeight();
    }
    var btn=document.querySelector('#dashboard-main .dp-dash-btn');
    if(btn){ btn.classList.toggle('active',on); }
  }

  /* ════ HINTERGRUND-PARTIKEL (Variante C) ════ */
  var _pctx,_pw,_ph,_particles=[],_praf,_presize;
  function initParticles(){
    var cv=$('dp-particles'); var m=$(MOUNT_ID); if(!cv||!m)return;
    _pctx=cv.getContext('2d');
    function size(){
      // v452.6: Layout kann beim ersten Aufruf 0 sein -> Fallback auf scroll/Fenster
      _pw=cv.width=Math.max(m.clientWidth||0, m.scrollWidth||0, window.innerWidth-380, 600);
      _ph=cv.height=Math.max(m.clientHeight||0, m.scrollHeight||0, window.innerHeight, 600);
    }
    size();
    _particles=[]; var N=Math.min(90,Math.max(40,Math.round(_pw*_ph/16000)));
    for(var i=0;i<N;i++)_particles.push({x:Math.random()*_pw,y:Math.random()*_ph,r:Math.random()*1.6+0.5,
      vx:(Math.random()-.5)*0.18,vy:(Math.random()-.5)*0.18,tw:Math.random()*Math.PI*2});
    cancelAnimationFrame(_praf); draw();
    // bei Fenster-Resize Canvas anpassen
    if(_presize) window.removeEventListener('resize',_presize);
    _presize=function(){ if(_pctx) size(); };
    window.addEventListener('resize',_presize);
    function draw(){
      if(!_pctx)return; _pctx.clearRect(0,0,_pw,_ph);
      var col=isDark()?'201,168,76':'167,139,54';
      _particles.forEach(function(p){
        p.x+=p.vx;p.y+=p.vy;p.tw+=0.03;
        if(p.x<0)p.x=_pw;if(p.x>_pw)p.x=0;if(p.y<0)p.y=_ph;if(p.y>_ph)p.y=0;
        var a=(0.3+Math.sin(p.tw)*0.3)*(isDark()?0.75:0.55);
        _pctx.beginPath();_pctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        _pctx.fillStyle='rgba('+col+','+a.toFixed(2)+')';_pctx.shadowBlur=6;_pctx.shadowColor='rgba('+col+',0.5)';_pctx.fill();
      });
      _pctx.shadowBlur=0; _praf=requestAnimationFrame(draw);
    }
  }
  function stopParticles(){ cancelAnimationFrame(_praf); _pctx=null; if(_presize){window.removeEventListener('resize',_presize);_presize=null;} }

  /* ════ RENDER-ORCHESTRIERUNG ════ */
  function renderAll(){
    renderScoreHero(); renderKpiCards(); renderStatus(); renderBoardOrCards();
    renderHealth(); renderOverview(); renderProjTable(); loadPasses(); if(window._dashLoadSharedPasses)window._dashLoadSharedPasses(); try{ if(window.DealPilotMandanten) DealPilotMandanten.renderHalterChips(); }catch(e){} /* mand-chips-init v803 */
  }

  /* ════ DASHBOARD-MARKUP (in #dashboard-main injecten) ════ */
  function ensureMarkup(){
    var m=$(MOUNT_ID); if(!m) return false;
    if(m.getAttribute('data-dp-built')==='1') return true;
    function chartCard(id,ico,title,sub,badge,tall){
      return '<div class="chart"><div class="ch"><div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+ico+'"/></svg></div>'
        + '<div><div class="ct">'+title+'</div><div class="cs">'+sub+'</div></div>'
        + '<span class="badge">'+badge+'</span></div>'
        + '<div class="chart-box'+(tall?' tall':'')+'"><canvas id="'+id+'"></canvas></div></div>';
    }
    m.innerHTML =
      '<div id="dp-stage" class="stage fc fc9"><div class="app">'
      + '<div class="sl sl-head"><span class="e">01</span><h2>Portfolio Score</h2><span class="tag">Quick-Boarding-Stil</span><span class="rule"></span>'
      + '<span class="cp-objsel"><span class="cp-objsel-lab">Objekt</span><select id="dp-dash-objsel" onchange="DealPilotDashboard.selectObject(this.value)"></select></span><span id="dp-halter-filter" class="mand-chips"></span></div>'  /* mand-chips v803 */
      + '<div class="hero" id="dp-pscore-hero"></div>'
      + '<div class="sl"><span class="e">02</span><h2>Kennzahlen</h2><span class="tag">Portfolio \u00b7 aggregiert</span><span class="rule"></span></div>'
      + '<div id="dp-overview-strip" class="overview-strip" style="margin-bottom:13px"></div>'
      + '<div class="kpis" id="dp-health-strip"></div>'
      + '<div class="sl"><span class="e">03</span><h2>Objekte</h2><span class="tag">Kanban \u00b7 Karte antippen = aufklappen</span><span class="rule"></span></div>'
      + '<div class="gates" id="dp-board"></div>'
      + '<div class="sl"><span class="e">04</span><h2>Geteilte Objekte</h2><span class="tag">Quick Boarding</span><span class="rule"></span></div>'
      + '<div id="dp-shared-passes" style="margin:0 0 4px"></div>'
      + '<details id="dp-charts-sec" open><summary class="sl dp-charts-summary"><span class="e">05</span><h2>Projektion &amp; Verlauf</h2><span class="tag mp-info" title="Modellprojektion mit pauschalen Annahmen \u2013 nicht die centgenaue Objekt-Rechnung:\n\u2022 Mietsteigerung +1,5 % p.a.\n\u2022 Bewirtschaftung +2,0 % p.a.\n\u2022 Wertsteigerung +2,0 % p.a.\n\u2022 AfA 2,0 % (Geb\u00e4udeanteil 80 %)\n\u2022 Kalkulationszins ~3,5 %\nDient als Trend und Gr\u00f6\u00dfenordnung; die exakte Berechnung erfolgt je Objekt im Objekt-Tab.">Modellprojektion (vereinfacht)</span><span class="yrs sl-yrs" id="dp-proj-years"><button data-y="10" onclick="event.stopPropagation();event.preventDefault();DealPilotDashboard.setProjYears(10)">10 J.</button><button data-y="20" class="active" onclick="event.stopPropagation();event.preventDefault();DealPilotDashboard.setProjYears(20)">20 J.</button><button data-y="30" onclick="event.stopPropagation();event.preventDefault();DealPilotDashboard.setProjYears(30)">30 J.</button></span><span class="dp-charts-hint">ein-/ausblenden</span></summary>'
      + '<div class="charts">'
      + chartCard('dpc-cashflow','M3 17l6-6 4 4 8-8','Cashflow-Verlauf','vor / nach Steuer','\u20ac/Jahr')
      + chartCard('dpc-vermoegen','M3 3v18h18M7 14l4-4 3 3 5-6','Verm\u00f6gens-Schere','Wert vs. Restschuld','Mio \u20ac')
      + chartCard('dpc-mittelverw','M4 20V10M10 20V4M16 20v-7M22 20H2','Mittelverwendung','Jahr 1','Allokation')
      + chartCard('dpc-wealth','M3 21h18M6 21V9l6-4 6 4v12','Wealth-Stacks','Eigenkapital-Aufbau','Aufbau',true)
      + chartCard('dpc-klumpen','M12 2a10 10 0 1 0 10 10H12z','Klumpenrisiko','Volumen nach Lage','Diversifikation')
      + chartCard('dpc-steuer','M9 14l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z','Steuer-Verlauf','Steuereffekt','10 Jahre',true)
      + '</div></details>'
      + '<div class="sl"><span class="e">06</span><h2>Gesamt-Projektion</h2><span class="tag mp-info" title="Modellprojektion mit pauschalen Annahmen \u2013 nicht die centgenaue Objekt-Rechnung:\n\u2022 Mietsteigerung +1,5 % p.a.\n\u2022 Bewirtschaftung +2,0 % p.a.\n\u2022 Wertsteigerung +2,0 % p.a.\n\u2022 AfA 2,0 % (Geb\u00e4udeanteil 80 %)\n\u2022 Kalkulationszins ~3,5 %\nDient als Trend und Gr\u00f6\u00dfenordnung; die exakte Berechnung erfolgt je Objekt im Objekt-Tab.">Modellprojektion (vereinfacht)</span><span class="rule"></span></div>'
      + '<div class="proj"><div class="ph"><span class="t">Cashflow &amp; Verm\u00f6gensaufbau</span><span class="tag">Modellprojektion</span></div>'
      + '<div class="pw"><table class="pt" id="dp-proj-table"></table></div></div>'
      + '</div></div>';
    m.setAttribute('data-dp-built','1');
    return true;
  }

  function exportPortfolioPdf(){
    // Gesamt-Portfolio-PDF: vorerst Track-Record als Gesamtdokument
    headerTrackRecord();
  }

  /* ════ DS2-Score-Leiste oben ausblenden (Handoff: gehoert im Dashboard weg) ════ */
  var _dpHidden = [];   // gemerkte Elemente fuer sauberes Restore
  var _dpHiddenSiblings = [];   // v452.12: ausgeblendete leere .body-Geschwister
  function hideDs2Bar(){
    _dpHidden = [];
    var dash = $(MOUNT_ID);
    function outsideDash(elm){ return !(dash && dash.contains(elm)); }
    function hideEl(elm){
      if(elm && outsideDash(elm) && elm.style.display!=='none'){
        _dpHidden.push([elm, elm.style.display]); elm.style.display='none';
      }
    }
    // v452.4: echte Klasse aus DOM-Diagnose = .sc-info (Container) / .sc-1 (Leiste).
    // NUR ausserhalb #dashboard-main (sonst koennte der Dashboard-Score-Hero getroffen werden).
    var sels = ['.sc-info', '.sc-1', '#dealscore2-card', '.ds2-card', '.dealscore-card', '#ds2-readonly-card'];
    sels.forEach(function(sel){
      document.querySelectorAll(sel).forEach(hideEl);
    });
    if(!_dpHidden.length){
      var cand=[].slice.call(document.querySelectorAll('div,section,aside')).filter(function(n){
        return outsideDash(n) && /INVESTOR DEAL SCORE|DEAL SCORE/i.test(n.textContent) && n.children.length<15;
      }).sort(function(a,b){return a.textContent.length-b.textContent.length;});
      if(cand[0]){ hideEl(cand[0].closest('.sc-info')||cand[0].parentElement||cand[0]); }
    }
  }
  function showDs2Bar(){
    _dpHidden.forEach(function(pair){ try{ pair[0].style.display = pair[1] || ''; }catch(e){} });
    _dpHidden = [];
  }

  /* ════ OPEN / CLOSE ════ */
  function openDashboard(){
    var m=$(MOUNT_ID); if(!m) return;
    if(!ensureMarkup()) return;
    try{ if(window._currentObjKey && typeof saveObj==='function') saveObj({silent:true}); }catch(e){} /* v886-dash: nur speichern wenn echtes aktives Objekt -> kein Phantom-Objekt beim Cockpit-Open */
    // Andere Hauptviews ausblenden — ALLE .sec (auch sec-hidden wie Quick-Check)
    var tabs=document.querySelector('.tabs'); if(tabs)tabs.style.display='none';
    var wf=document.querySelector('.tabs-workflow-bar'); if(wf)wf.style.display='none';
    document.querySelectorAll('.sec').forEach(function(s){ if(s.id!==MOUNT_ID){ s.style.display='none'; } });
    var quick=$('s-quick'); if(quick)quick.style.display='none';   // v452.3: Quick-Check explizit weg
    var ao=$('all-objects-main'); if(ao)ao.style.display='none';
    // v452.12: leeres .body-Element VOR dem Dashboard (im .main-col) ausblenden.
    // Es haelt ~90px Hoehe durch sein Padding -> der "Leerraum oben". Diagnose:
    // VOR dashboard: DIV.body h=90. Geschwister von #dashboard-main.
    _dpHiddenSiblings=[];
    var mcol=m.parentElement;
    if(mcol){
      [].forEach.call(mcol.children,function(c){
        if(c!==m && c.id!=='dashboard-main' && c.id!=='all-objects-main'
           && !/\bsec\b/.test(c.className||'') && getComputedStyle(c).display!=='none'){
          // nur leere/Content-Wrapper ausblenden, nicht Header/Toggle/Toast
          if(/\bbody\b/.test(c.className||'')){
            _dpHiddenSiblings.push([c,c.style.display]); c.style.display='none';
          }
        }
      });
    }
    hideDs2Bar();   // v452.2: DS2-Score-Leiste oben weg
    // v452.8: Header-Investor-Score IMMER minimieren wenn Dashboard offen
    // (auch beim Rueckwechsel aus einem Objekt). Marker, damit wir's beim
    // Schliessen sauber zuruecknehmen.
    if(!document.body.classList.contains('hdr-collapsed')){
      document.body.classList.add('hdr-collapsed'); document.body.dataset.dpHdrDash='1';
      if(typeof window._updateHdrHeight==='function') window._updateHdrHeight();
    }
    m.style.display='block'; m.classList.add('dp-active');
    var tog=document.querySelector('.dp-sidebar-toggle'); if(tog)tog.classList.add('dp-show');
    applyTheme();
    startPlanWatch();   // v452.6: Plan-Wechsel automatisch spiegeln

    // Sofort: Summaries laden + Score/KPI/Status/Kanban rendern
    renderScoreHero(); renderStatus();
    var _dpLoadHost=$('dp-health-strip'); if(_dpLoadHost) _dpLoadHost.innerHTML='<div class="dp-chart-loading"><span class="dp-spin"></span>laden…</div>';
    loadSummaries().then(function(){
      renderScoreHero(); renderStatus(); renderBoardOrCards(); loadPasses(); if(window._dashLoadSharedPasses)window._dashLoadSharedPasses();
      setTimeout(initParticles, 250);   // v452.6: nach Layout, sonst Canvas 0x0
      // Hintergrund: Details nachladen -> Health/KPIs/Charts/Tabelle
      return loadDetails();
    }).then(function(){
      renderScoreHero(); renderKpiCards(); renderHealth(); renderOverview(); renderProjTable(); buildCharts();
    }).catch(function(e){
      var _dpErrHost=$('dp-health-strip'); if(_dpErrHost) _dpErrHost.innerHTML='<div class="gempty">Daten konnten nicht geladen werden: '+esc(e.message)+'</div>';
    });
  }
  function closeDashboard(){
    var m=$(MOUNT_ID); if(m){m.style.display='none'; m.classList.remove('dp-active');}
    var tog=document.querySelector('.dp-sidebar-toggle'); if(tog)tog.classList.remove('dp-show');
    showDs2Bar();   // v452.2: DS2-Leiste wiederherstellen
    // v452.12: ausgeblendete .body-Geschwister wiederherstellen
    _dpHiddenSiblings.forEach(function(pair){ try{ pair[0].style.display=pair[1]||''; }catch(e){} });
    _dpHiddenSiblings=[];
    // v452.6: Fullscreen-Modus sauber verlassen (Quick-Check-Body-Klassen)
    if(_dpFullscreen){ setFullscreen(false); _dpFullscreen=false; }
    stopPlanWatch();   // v452.6
    // v452.8: vom Dashboard gesetztes hdr-collapsed zuruecknehmen
    if(document.body.dataset.dpHdrDash==='1'){
      document.body.classList.remove('hdr-collapsed'); delete document.body.dataset.dpHdrDash;
      if(typeof window._updateHdrHeight==='function') window._updateHdrHeight();
    }
    var wrap=document.querySelector('.app-wrap'); if(wrap)wrap.classList.remove('dp-sidebar-collapsed');
    var quick=$('s-quick'); if(quick)quick.style.display='';
    stopParticles(); destroyCharts();
  }

  /* ════ setMainView-WRAP (orig sichern, 'dashboard' abfangen) ════ */
  function installWrap(){
    if(window._dpDashWrapInstalled) return;
    var orig = window.setMainView;
    if(typeof orig!=='function'){ setTimeout(installWrap,300); return; }
    window.setMainView = function(view){
      if(view==='dashboard'){ openDashboard(); return; }
      closeDashboard();          // bei single/all Dashboard ausblenden
      return orig.apply(this, arguments);
    };
    window._dpDashWrapInstalled = true;
  }
  function installLoadSavedWrap(){
    if(window._dpLoadSavedWrapped) return;
    var orig = window.loadSaved;
    if(typeof orig!=='function'){ setTimeout(installLoadSavedWrap,300); return; }
    window.loadSaved = function(){
      var m=$(MOUNT_ID);
      var dashWasActive = !!(m && m.classList.contains('dp-active'));
      var r = orig.apply(this, arguments);
      if(dashWasActive){ try{ if(typeof window.setMainView==='function') window.setMainView('single'); }catch(e){} }
      return r;
    };
    window._dpLoadSavedWrapped = true;
  }

  /* ════ STARTUP-VIEW Hook (Dashboard nach Login) ════ */
  function maybeStartupDashboard(){
    try {
      var sv=localStorage.getItem('dp_startup_view');
      if(sv==='dashboard'){ setTimeout(function(){ if(typeof window.setMainView==='function') window.setMainView('dashboard'); }, 600); }
    } catch(e){}
  }

  /* ════ BOOT ════ */
  function boot(){
    if(_booted) return; _booted=true;
    applyTheme();
    installWrap();
    installLoadSavedWrap();
    maybeStartupDashboard();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();

  /* ══ v454: Score-Detail-Modal – welche KPIs fließen ein ══ */
  function _scoreModalClose(){ var ov=document.getElementById('dp-score-modal-ov'); if(ov) ov.parentNode.removeChild(ov); }
  function showScoreDetails(){
    var ag=aggregateScore();
    var cats=(ag && ag.cats)?ag.cats:null;
    var meta=catMeta();
    var totalKpi=0; Object.keys(meta).forEach(function(k){ totalKpi+=meta[k].count||0; });
    var total=(ag && ag.total!=null)?ag.total:null;
    var tcol=total==null?'var(--dp-gold)':(total>=70?'#3FA56C':total>=50?'#C9A84C':'#B86250');
    var tlab=total==null?'\u2013':(total>=85?'Sehr gut':total>=70?'Gut':total>=50?'Solide':'Schwach');
    var head='<div class="dp-sd-total">Gesamt <b style="color:'+tcol+'">'+(total==null?'\u2013':total)+'/100</b> \u00b7 '+tlab
      +' \u2014 gewichteter Durchschnitt \u00fcber alle Kategorien und '+totalKpi+' KPIs</div>';
    var rows=(cats||[]).map(function(c){
      var scN=c.score==null?0:c.score; var sc=c.score==null?'\u2013':c.score;
      var col=catBarColor(scN); var m=meta[c.key]||{count:0,weight:0,names:[]};
      var kl=(m.kpis&&m.kpis.length)?m.kpis:((m.names||[]).map(function(n){return {name:n,weight:null};}));
      var chips=kl.length
        ? kl.map(function(b){ var wv=(b.weight!=null)?'<span class="dp-sd-kw">'+b.weight+'\u00a0%</span>':''; return '<div class="dp-sd-krow"><span class="dp-sd-kn">'+esc(b.name)+'</span>'+wv+'</div>'; }).join('')
        : '<div class="dp-sd-krow dim">'+(m.count||0)+' KPIs</div>';
      return '<div class="dp-sd-cat">'
        + '<div class="dp-sd-cat-head"><span>'+esc(c.label)+' <span class="dp-sd-weight">'+(m.weight||0)+'%</span></span>'
        + '<span class="dp-sd-cat-score" style="color:'+col+'">'+sc+'/100</span></div>'
        + '<div class="dp-sd-bar"><div class="dp-sd-bar-fill" style="width:'+scN+'%;background:'+col+'"></div></div>'
        + '<div class="dp-sd-klist">'+chips+'</div></div>';
    }).join('');
    var ov=document.createElement('div'); ov.id='dp-score-modal-ov'; ov.className='dp-wk-modal-ov';
    ov.innerHTML='<div class="dp-wk-modal dp-sd-modal" style="max-width:520px;max-height:84vh;overflow:auto">'
      + '<div class="dp-wk-modal-t">Investor Portfolio Score \u00b7 Aufschl\u00fcsselung</div>'
      + head
      + (rows||'<div class="dp-wk-modal-s">Kategorien werden noch geladen.</div>')
      + '<button class="dp-wk-modal-x" onclick="DealPilotDashboard.closeScoreModal()">Schlie\u00dfen</button></div>';
    ov.addEventListener('click',function(e){ if(e.target===ov) _scoreModalClose(); });
    document.body.appendChild(ov);
  }
  function showScoreUpgrade(){
    var ov=document.createElement('div'); ov.id='dp-score-modal-ov'; ov.className='dp-wk-modal-ov';
    ov.innerHTML='<div class="dp-wk-modal" style="max-width:430px">'
      + '<div class="dp-wk-modal-t">Volle 24-KPI-Analyse</div>'
      + '<div class="dp-wk-modal-s">Im Investor-Plan fließen 24 Einzel-KPIs (ROE, Cash-on-Cash, DSCR, WALT, ESG …) in den Portfolio-Score und die Health-Leiste ein. Im Starter-Plan siehst du die Plan-Bewertung der fünf Kategorien.</div>'
      + '<button class="dp-wk-modal-x" onclick="DealPilotDashboard.closeScoreModal()">Verstanden</button></div>';
    ov.addEventListener('click',function(e){ if(e.target===ov) _scoreModalClose(); });
    document.body.appendChild(ov);
  }

  /* ════ PUBLIC API ════ */
  window.DealPilotDashboard = {
    open: openDashboard, close: closeDashboard,
    setProjYears: setProjYears, setCardView: setCardView,
    cardPdf: cardPdf, cardDelete: cardDelete,
    headerTrackRecord: headerTrackRecord, exportPortfolioPdf: exportPortfolioPdf,
    toggleSidebar: toggleSidebar, setTheme: setTheme, applyTheme: applyTheme,
    showScoreDetails: showScoreDetails, showScoreUpgrade: showScoreUpgrade, closeScoreModal: _scoreModalClose,
    toggleCf: toggleCf,
    toggleGi: toggleGi,
    toggleRoe: function(){ window._dpRoeMode=(window._dpRoeMode==='nach')?'vor':'nach'; try{ renderHealth(); }catch(e){} },
    openObject: function(k){ try{ if(typeof window.loadSaved==='function') window.loadSaved(k); }catch(e){} },
    toggleZins: function(){ window._dpZinsMode=(window._dpZinsMode==='risiko')?'zins':'risiko'; try{ renderHealth(); }catch(e){} },
    selectObject: selectObject,
    applyHalterFilter: function(id){ try{ window._dpHalterFilter=id; }catch(e){} try{ renderScoreHero(); }catch(e){} try{ renderOverview(); }catch(e){} try{ renderHealth(); }catch(e){} try{ renderKpiCards(); }catch(e){} try{ buildCharts(); }catch(e){} try{ renderProjTable(); }catch(e){} try{ if(window.DealPilotMandanten) DealPilotMandanten.renderHalterChips(); }catch(e){} },  /* mand-export v803 */
    _debug: function(){ return { summaries:_summaries, details:_details, loaded:_detailsLoaded }; }
  };
})();


/* ==== dpfk-f3-dash-v1 : F3 Geteilte Objekte im Portfolio-Cockpit (dashboard.js / #dp-shared-passes) ==== */
(function(){
  if (window._dashLoadSharedPasses) return;
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function fmtD(s){ try{ return new Date(s).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}); }catch(e){ return '\u2013'; } }
  function restLabel(exp){
    var ms=new Date(exp).getTime()-Date.now();
    if(!(ms>0)) return '<span style="color:#B86250">abgelaufen</span>';
    var d=Math.round(ms/86400000);
    return d+' Tag'+(d===1?'':'e');
  }
  var BTN="background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.35);color:#E8CC7A;border-radius:7px;padding:3px 9px;font-size:11.5px;cursor:pointer";
  var BTN_D="background:rgba(184,98,80,0.12);border:1px solid rgba(184,98,80,0.40);color:#D9685F;border-radius:7px;padding:3px 9px;font-size:11.5px;cursor:pointer;margin-left:6px";
  var LABEL='<div class="dp-section-label">Geteilte Objekte <span class="dp-model-tag">Quick Boarding</span></div>';
  function host(){ return document.getElementById('dp-shared-passes'); }
  var _shView='peek', _shItems=[];
  window._dpShared=function(m){ _shView=m; render(_shItems); };
  var _shView='peek', _shItems=[];
  window._dpShared=function(m){ _shView=m; render(_shItems); };
  function render(items){
    var h=host(); if(!h) return;
    _shItems=items||[];
    if(!_shItems.length){
      h.innerHTML='<div class="gempty">Aktuell ist kein Objekt geteilt. Teile ein Objekt im Objekt-Tab \u00fcber \u201eQuick Boarding teilen\u201c \u2013 der Pass erscheint dann hier.</div>';
      return;
    }
    var n=_shItems.length;
    var show=(_shView==='all')?_shItems:((_shView==='min')?[]:_shItems.slice(0,3));
    var base=((window.location&&location.origin)?location.origin:'');
    var cards=show.map(function(p){
      var url=base+'/pass.html?c='+p.code;
      var qr='';
      try{ if(window.DpQr&&DpQr.svg){ qr=DpQr.svg(url,{px:2,ecc:'M',border:1,dark:'#0c0b09',light:'#ffffff'}); } }catch(e){}
      var qrHtml=qr?('<span class="shr-qr">'+qr+'</span>'):'<span class="shr-qr"><span class="shr-qr-ph"></span></span>';
      return '<div class="shr2">'
        +'<div class="shr-body">'
          +'<div class="o">'+esc(p.title||'Objekt')+'<small>geteilt am '+fmtD(p.created_at)+'</small></div>'
          +'<div class="shr-meta"><span class="cd">'+esc(p.code)+'</span><span class="rt">'+restLabel(p.expires_at)+'</span></div>'
          +'<div class="ac"><button class="e" onclick="window._dpfkPassExtend(\''+esc(p.code)+'\')">Verl\u00e4ngern</button>'
          +'<button class="r" onclick="window._dpfkPassRevoke(\''+esc(p.code)+'\')">Beenden</button></div>'
        +'</div>'
        +'<a class="shr-stub" href="'+url+'" target="_blank" rel="noopener" title="Objekt \u00f6ffnen">'+qrHtml+'<span class="shr-stub-lab">Scan</span></a>'
      +'</div>';
    }).join('');
    var ctrl;
    if(_shView==='min'){ ctrl='<button class="shb" onclick="window._dpShared(\'peek\')">Anzeigen</button>'; }
    else if(_shView==='all'){ ctrl='<button class="shb" onclick="window._dpShared(\'peek\')">Weniger</button><button class="shb shb-m" onclick="window._dpShared(\'min\')">Minimieren</button>'; }
    else { ctrl=(n>3?'<button class="shb" onclick="window._dpShared(\'all\')">Alle '+n+' anzeigen</button>':'')+'<button class="shb shb-m" onclick="window._dpShared(\'min\')">Minimieren</button>'; }
    h.innerHTML='<div class="shared2"><div class="sh-bar"><span class="sh-cnt">'+n+' geteilte Objekte</span><span class="sh-ctrl">'+ctrl+'</span></div>'+(cards?'<div class="sh-grid">'+cards+'</div>':'')+'</div>';
  }
  function load(){
    var h=host(); if(!h) return;
    if(!window.Auth||typeof window.Auth.apiCall!=='function'){ h.innerHTML=''; return; }
    window.Auth.apiCall('/passes',{method:'GET'}).then(function(r){
      var items=(r&&r.items)||[];
      var now=Date.now();
      items=items.filter(function(p){ return !p.revoked_at && new Date(p.expires_at).getTime()>now; });
      render(items);
    }).catch(function(){ h.innerHTML=''; });
  }
  window._dashLoadSharedPasses=load;
  window._dpfkPassExtend=function(code){
    if(!window.Auth||!window.Auth.apiCall) return;
    window.Auth.apiCall('/passes/'+encodeURIComponent(code)+'/extend',{method:'POST',body:{days:30}}).then(load).catch(load);
  };
  window._dpfkPassRevoke=function(code){
    if(!window.Auth||!window.Auth.apiCall) return;
    if(!confirm('Diesen Pass beenden? Der \u00f6ffentliche Link wird ung\u00fcltig.')) return;
    window.Auth.apiCall('/passes/'+encodeURIComponent(code),{method:'DELETE'}).then(load).catch(load);
  };
})();
