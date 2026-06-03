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
        renderScoreHero(); renderKpiCards(); renderHealth();
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
    if(score>=85) return {t:'top', l:'Sehr gut', col:'var(--dp-green)'};
    if(score>=70) return {t:'hi',  l:'Gut',      col:'var(--dp-green)'};
    if(score>=50) return {t:'mid', l:'Solide',   col:'var(--dp-gold)'};
    return {t:'lo', l:'Schwach', col:'var(--dp-red)'};
  }
  function catBarColor(s){ return s>=70?'var(--dp-green)':s>=50?'var(--dp-gold)':'var(--dp-red)'; }

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
    return wonList().map(function(o){ return _details[o.id||o.key]; }).filter(Boolean);
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
      host.innerHTML = '<div class="pscore-right" style="text-align:center;width:100%">'
        + '<div class="pscore-title" style="justify-content:center">'+esc(title)+'</div>'
        + '<div class="pscore-headline" style="margin-top:8px">Noch kein gewonnenes Objekt mit berechnetem Score. '
        + 'Sobald du ein Objekt auf „Gewonnen" setzt und der DealScore berechnet ist, erscheint hier dein Portfolio-Score.</div>'
        + '</div>';
      return;
    }

    var t = tierOf(ag.total);
    var arcCol = t.t==='lo'?'#B86250':t.t==='mid'?'#C9A84C':'#3FA56C';
    var arcCol2= t.t==='lo'?'#8A4538':t.t==='mid'?'#9a7f33':'#2A7E50';
    var r=70, circ=2*Math.PI*r, off=circ*(1-ag.total/100);
    var headlines={top:'Erstklassiges Portfolio',hi:'Solides, gut aufgestelltes Portfolio',mid:'Tragfaehiges Portfolio mit Optimierungspotenzial',lo:'Portfolio mit erhoehtem Handlungsbedarf'};
    var kiRat={top:'KI raet: Aktiv ausbauen',hi:'KI raet: Position halten',mid:'KI raet: Optimieren',lo:'KI raet: Restrukturieren'};

    // Tick-Marks
    var ticks='';
    for(var i=0;i<=20;i++){var ang=-90+i*18,r1=92,r2=98;
      var x1=80+r1*Math.cos(ang*Math.PI/180),y1=80+r1*Math.sin(ang*Math.PI/180);
      var x2=80+r2*Math.cos(ang*Math.PI/180),y2=80+r2*Math.sin(ang*Math.PI/180);
      var act=(i*5)<=ag.total;
      ticks+='<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="'+(act?arcCol:'rgba(201,168,76,.10)')+'" stroke-width="'+(i%2===0?1.8:1)+'" opacity="'+(act?0.9:0.35)+'"/>';
    }
    var orbits='';
    for(var o2=0;o2<3;o2++){orbits+='<circle cx="80" cy="'+(80-r)+'" r="2" fill="'+arcCol+'" style="filter:drop-shadow(0 0 6px '+arcCol+');animation:orbit 8s linear infinite;animation-delay:-'+(o2*0.7)+'s;transform-origin:80px 80px"/>';}

    var gauge='<svg viewBox="0 0 160 160" style="width:170px;height:170px"><g>'+ticks+'</g>'
      + '<g style="transform-origin:80px 80px;transform:rotate(-90deg)">'
      + '<circle cx="80" cy="80" r="78" fill="none" stroke="rgba(201,168,76,.06)" stroke-width="1"/>'
      + '<circle cx="80" cy="80" r="'+r+'" fill="none" stroke="rgba(201,168,76,.10)" stroke-width="9"/>'
      + '<circle cx="80" cy="80" r="'+r+'" fill="none" stroke="url(#dpGrad)" stroke-width="9" stroke-linecap="round" stroke-dasharray="'+circ+'" stroke-dashoffset="'+circ+'" id="dp-arc" style="transition:stroke-dashoffset 1.8s cubic-bezier(.2,.8,.2,1);filter:drop-shadow(0 0 14px '+arcCol+')"/>'
      + '</g>'
      + '<g style="transform-origin:80px 80px">'+orbits+'</g>'
      + '<circle cx="80" cy="80" r="52" fill="url(#dpCenterGlow)"/>'
      + '<defs><linearGradient id="dpGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="'+arcCol+'"/><stop offset="100%" stop-color="'+arcCol2+'"/></linearGradient>'
      + '<radialGradient id="dpCenterGlow"><stop offset="0%" stop-color="'+arcCol+'" stop-opacity=".25"/><stop offset="100%" stop-color="'+arcCol+'" stop-opacity="0"/></radialGradient></defs></svg>';

    // Kategorie-Balken (wenn Details geladen)
    var catsHtml='';
    if(ag.cats){
      catsHtml = ag.cats.map(function(c){
        var sc = c.score==null?0:c.score;
        return '<div class="pscore-cat slim"><div class="pscore-cat-head"><span class="pscore-cat-l">'+esc(c.label)+'</span>'
          + '<span class="pscore-cat-v" style="color:'+catBarColor(sc)+'">'+(c.score==null?'–':sc)+'</span></div>'
          + '<div class="pscore-bar"><div class="pscore-bar-fill" data-w="'+sc+'" style="width:0%;background:linear-gradient(90deg,'+catBarColor(sc)+'66,'+catBarColor(sc)+')"></div></div></div>';
      }).join('');
    } else {
      catsHtml = '<div class="pscore-headline" style="grid-column:1/-1">Kategorien werden geladen…</div>';
    }

    var watermark = P.demo ? '<div class="pscore-watermark">DEMO · Investor freischalten</div>' : '';

    host.innerHTML = watermark
      + '<div class="pscore-rays"></div><div class="pscore-burst" id="dp-burst"></div>'
      + '<div class="pscore-gauge">'+gauge+'<div class="pscore-num"><div class="pscore-val" id="dp-scoreval" style="color:'+arcCol+'">0</div><div class="pscore-max">/ 100</div></div></div>'
      + '<div class="pscore-right">'
      + '<div class="pscore-pill">'+(P.full?'☆ INVESTOR':'☆ DEALPILOT')+'</div>'
      + '<div class="pscore-titlebar"><span class="pscore-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>'+esc(title)+'</span>'
      + '<span class="pscore-tier"><span class="tdot" style="background:'+t.col+';color:'+t.col+'"></span>'+t.l+'</span></div>'
      + '<div class="pscore-headline">'+headlines[t.t]+' · '+ag.scored+' von '+ag.n+' Objekten bewertet</div>'
      + '<div class="pscore-cats slim">'+catsHtml+'</div>'
      + '<div class="pscore-actions"><div class="pscore-kirat" style="color:'+arcCol+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>'+kiRat[t.t]+'</div></div>'
      + '</div>';

    // v452.9: Tier-Klasse fuer Score-abhaengigen Glow (gruen bei gut/top)
    host.classList.remove('tier-gut','tier-top','tier-mid','tier-lo');
    host.classList.add(t.t==='hi'?(ag.total>=85?'tier-top':'tier-gut'):(t.t==='mid'?'tier-mid':'tier-lo'));

    // Animationen
    var burst=$('dp-burst');
    if(burst){ burst.innerHTML='';
      for(var b=0;b<12;b++){var sp=el('span','spark'); var a=(b/12)*Math.PI*2;
        sp.style.setProperty('--dx',Math.cos(a)*90+'px'); sp.style.setProperty('--dy',Math.sin(a)*90+'px');
        sp.style.background=arcCol; sp.style.boxShadow='0 0 8px '+arcCol; sp.style.animationDelay=(b*0.04)+'s'; burst.appendChild(sp);
      }
    }
    setTimeout(function(){
      var arc=$('dp-arc'); if(arc) arc.style.strokeDashoffset=off;
      host.querySelectorAll('.pscore-bar-fill').forEach(function(bf){ bf.style.width=bf.dataset.w+'%'; });
      var cur=0,tgt=ag.total,step=Math.max(1,Math.round(tgt/50)),vEl=$('dp-scoreval');
      var iv=setInterval(function(){cur+=step; if(cur>=tgt){cur=tgt;clearInterval(iv);} if(vEl)vEl.textContent=cur;},22);
    },200);
  }

  /* ════ RENDER: 5 KPI-Cards (Kategorien) ════ */
  function renderKpiCards(){
    var host=$('dp-kpi-grid'); if(!host) return;
    var ag=aggregateScore();
    var icons={rendite:'M3 17l6-6 4 4 8-8',finanzierung:'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
      risiko:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',lage:'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z',
      upside:'M4.5 16.5L12 4l7.5 12.5M8 14h8'};
    if(!ag.cats){
      host.innerHTML = '<div class="dp-chart-loading" style="grid-column:1/-1;height:90px"><span class="dp-spin"></span>Kategorien werden berechnet…</div>';
      return;
    }
    host.innerHTML = ag.cats.map(function(c){
      var sc=c.score==null?0:c.score; var t=tierOf(c.score);
      var tierBadge = c.score==null?'–':(c.score>=85?'TOP':c.score>=70?'GUT':c.score>=50?'SOLIDE':c.score>=35?'SCHWACH':'KRITISCH');
      var tierCls = c.score==null?'':(c.score>=85?'tier-top':c.score>=70?'tier-gut':c.score>=50?'tier-solide':'');
      // Sparkline neben dem Sub-Text (wie Mockup kpi-sub-row), nicht als Hintergrund
      var sparkHtml = c.score==null?'':sparkSvg(sc, t.col, sc + (c.key?c.key.length:0));
      return '<div class="kpi dp-card-dark '+tierCls+'">'
        + '<div class="kpi-head"><span class="kpi-tier" style="color:'+t.col+';border-color:'+t.col+'">'+tierBadge+'</span></div>'
        + '<div class="kpi-row"><div class="kpi-l">'+esc(c.label)+'</div>'
        + '<svg class="kpi-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+icons[c.key]+'"/></svg></div>'
        + '<div class="kpi-v" style="color:'+t.col+'">'+(c.score==null?'–':sc)+'</div>'
        + '<div class="kpi-sub-row"><div class="kpi-sub">'+(c.score==null?'keine Daten':'Kategorie-Score')+'</div>'+sparkHtml+'</div>'
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
      var s=stageOf(o), v=num(o.kaufpreis);
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
  function renderHealth(){
    var host=$('dp-health-strip'); if(!host) return;
    var arr=detailArr();
    if(!_detailsLoaded){
      host.innerHTML='<div class="dp-chart-loading" style="grid-column:1/-1;height:60px"><span class="dp-spin"></span>Portfolio-Kennzahlen werden geladen…</div>';
      return;
    }
    if(!arr.length){ host.innerHTML='<div class="health-sub" style="grid-column:1/-1">Keine Detaildaten verfuegbar.</div>'; return; }

    var nowY=new Date().getFullYear();
    var sum=function(f){return arr.reduce(function(s,o){return s+(f(o)||0);},0);};
    var totalKp=sum(function(o){return num(o._kaufpreis)||num(o.kp);});
    var totalEk=sum(function(o){return num(o.ek);});
    // Restschuld: aus persistierten KPIs oder aus Annuitaet berechnen.
    // Annuitaet: Darlehen d1+d2, Zins d1z, Tilgung d1t, Auszahlung d1_auszahl (MM.YYYY).
    function restschuldOf(o){
      var fromKpi=num(o._kpis_restschuld);
      if(fromKpi>0) return fromKpi;
      var D=num(o.d1)+num(o.d2); if(D<=0) return 0;
      var zins=num(o.d1z)/100;
      var tilg=num(o.d1t)/100;
      if(zins<=0||tilg<=0) return D;
      var i=zins/12;
      var A=D*(zins+tilg)/12;
      var m=0; var au=(o.d1_auszahl||'').toString().match(/(\d{1,2})[.\/](\d{4})/);
      if(au){ var mm=+au[1], yy=+au[2]; var now=new Date(); m=(now.getFullYear()-yy)*12+(now.getMonth()+1-mm); }
      if(m<=0) return D;
      var pow=Math.pow(1+i,m);
      var rest=D*pow - (A/i)*(pow-1);
      return rest>0?rest:0;
    }
    var totalRest=sum(restschuldOf);
    // Jahres-CF nach Steuer (gespeichert) + vor Steuer (approx ueber Steuereffekt)
    var cfNsJ=sum(function(o){return num(o._kpis_cf_ns);});
    var cfVsJ=sum(function(o){return num(o._kpis_cf_vs)!=null?num(o._kpis_cf_vs):num(o._kpis_cf_ns);}); // falls vor-Steuer fehlt: =nach
    var cfNsM=cfNsJ/12, cfVsM=cfVsJ/12;
    var roe=totalEk>0?(cfNsJ/totalEk*100):null;
    // Ø-Zins gewichtet nach Restschuld
    var zw=0,zws=0; arr.forEach(function(o){var z=num(o.d1z),r=restschuldOf(o)||1; if(z>0){zw+=r;zws+=z*r;}});
    var avgZins=zw>0?zws/zw:null;
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
    var esgW=0,esgS=0; arr.forEach(function(o){var e=(o.ds2_energie||'').toString().toUpperCase().charAt(0); if(eMap[e]!=null){esgW+=num(o._kaufpreis||o.kp);esgS+=eMap[e]*num(o._kaufpreis||o.kp);}});
    var esg=esgW>0?esgS/esgW:null;
    var leer=arr.length?sum(function(o){return num(o.leerstand);})/arr.length:null;

    function colByVal(v,good,bad){ if(v==null)return 'var(--dp-card-ch)'; return v>=good?'var(--dp-green)':v>=bad?'var(--dp-gold)':'var(--dp-red)'; }
    function eurM(v){ return (v<0?'-':'')+fmtE(Math.abs(Math.round(v)))+' €'; }
    function cfCol(v){ return v>=0?'var(--dp-green)':'var(--dp-red)'; }

    // l=Label (deutsch), v=Wert, sub=Unterzeile, tip=Tooltip-Erklaerung
    var cards=[
      {l:'Cashflow / Monat', v:eurM(cfNsM), sub:'nach Steuer', col:cfCol(cfNsM),
       tip:'Monatlicher Überschuss nach allen Kosten, Zins, Tilgung und Steuern – summiert über alle gewonnenen Objekte.'},
      {l:'Cashflow / Monat', v:eurM(cfVsM), sub:'vor Steuer', col:cfCol(cfVsM),
       tip:'Monatlicher Überschuss vor Steuern (Miete minus Bewirtschaftung, Zins und Tilgung).'},
      {l:'Cashflow / Jahr', v:eurM(cfNsJ), sub:'nach Steuer', col:cfCol(cfNsJ),
       tip:'Jährlicher Netto-Cashflow nach Steuern über das gesamte Portfolio.'},
      {l:'Cashflow / Jahr', v:eurM(cfVsJ), sub:'vor Steuer', col:cfCol(cfVsJ),
       tip:'Jährlicher Cashflow vor Steuern über das gesamte Portfolio.'},
      {l:'Eigenkapital-Rendite', v:roe==null?'–':roe.toFixed(1).replace('.',',')+' %', sub:'nach Steuer (ROE)', col:colByVal(roe,6,3),
       tip:'Return on Equity: jährlicher Cashflow nach Steuern im Verhältnis zum eingesetzten Eigenkapital. Wie stark sich dein Eigenkapital verzinst.'},
      {l:'Ø-Zinssatz', v:avgZins==null?'–':avgZins.toFixed(2).replace('.',',')+' %', sub:'nach Restschuld gewichtet', col:avgZins==null?'var(--dp-card-ch)':(avgZins<=3?'var(--dp-green)':avgZins<=4.5?'var(--dp-gold)':'var(--dp-red)'),
       tip:'Durchschnittlicher Sollzins aller Finanzierungen, gewichtet nach der jeweiligen Restschuld.'},
      {l:'Zinsbindungs-Risiko', v:!hasZinsRisk?'–':Math.round(zinsRiskPct)+' %', sub:'Bindung läuft < 3 J. aus', warn:zinsRiskPct>20, col:zinsRiskPct>20?'var(--dp-red)':'var(--dp-card-ch)',
       tip:'Anteil der Restschuld, deren Zinsbindung in den nächsten 3 Jahren ausläuft – also bald zu (evtl. höheren) Zinsen neu finanziert werden muss.'},
      {l:'Mietpotenzial', v:!hasMietPot?'–':eurM(mietPot)+' p.a.', sub:'stille Reserve', col:'var(--dp-gold)',
       tip:'Differenz zwischen ortsüblicher Marktmiete und aktueller Ist-Miete, hochgerechnet auf das Jahr. Zeigt ungenutztes Mietsteigerungs-Potenzial.'},
      {l:'Tilgungsfortschritt', v:!hasTilg?'–':Math.max(0,tilgFort).toFixed(0)+' %', sub:'Darlehen getilgt', col:'var(--dp-gold)',
       tip:'Wie viel des ursprünglichen Darlehens bereits getilgt wurde – der über die Tilgung aufgebaute Eigenkapital-Anteil.'},
      {l:'Energie-Substanz', v:esg==null?'–':Math.round(esg)+'/100', sub:'nach Energieklasse', col:colByVal(esg,70,45),
       tip:'Bewertung der energetischen Substanz aus den Energieausweis-Klassen (A=100 … H=0), gewichtet nach Kaufpreis. Indikator für Sanierungsbedarf und ESG-Tauglichkeit.'}
    ];
    host.innerHTML=cards.map(function(c){
      return '<div class="health-box'+(c.warn?' warn':'')+'" title="'+esc(c.tip||'')+'">'
        + '<div class="health-l">'+esc(c.l)+'<span class="health-i" title="'+esc(c.tip||'')+'">i</span></div>'
        + '<div class="health-v" style="color:'+(c.col||'var(--dp-card-ch)')+'">'+c.v+'</div>'
        + '<div class="health-sub">'+esc(c.sub)+'</div></div>';
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
    var scorePill = sc!=null ? '<span class="kc-pill" style="color:'+t.col+';border-color:'+t.col+'">'+sc+'</span>' : '';
    var statLine = st==='won'
      ? 'CF '+(o.cf_ns!=null?fmtE(num(o.cf_ns)/12)+' €/Mon':'–')+' · DSCR '+(o.dscr!=null?(+o.dscr).toFixed(2).replace('.',','):'–')
      : 'KP '+fmtKEU(num(o.kaufpreis))+' € · Rendite '+(o.bmy!=null?(+o.bmy).toFixed(1).replace('.',',')+'%':'–');
    return '<div class="dp-kanban-card kc-'+st+'">'
      + '<div class="kc-top"><span class="kc-name">'+esc(o.name||o.kuerzel||'Unbenannt')+'</span>'+scorePill+'</div>'
      + '<div class="kc-meta"><span>'+esc(o.kuerzel||'')+'</span><span>'+esc(o.ort||'')+'</span></div>'
      + '<div class="kc-stat">'+statLine+'</div>'
      + '<div class="pdf-row pdf-row-mini">'
      + '<button onclick="DealPilotDashboard.cardPdf(\''+esc(k)+'\',\'invest\')">Invest.</button>'
      + '<button onclick="DealPilotDashboard.cardPdf(\''+esc(k)+'\',\'bank\')">Bank</button>'
      + '<button onclick="DealPilotDashboard.cardPdf(\''+esc(k)+'\',\'wk\')">WK</button>'
      + '<button class="kc-del" onclick="DealPilotDashboard.cardDelete(\''+esc(k)+'\',\''+esc(o.name||o.kuerzel||'Objekt')+'\')" title="Löschen">✕</button>'
      + '</div>'
      + '</div>';
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
      host.innerHTML='<div class="dp-dash-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>'
        + '<h3>Noch keine Objekte</h3><p>Lege dein erstes Objekt an, dann erscheint es hier im Portfolio.</p></div>';
      return;
    }
    if(_cardView==='cards'){
      host.innerHTML='<div class="cards-grid">'+_summaries.map(objCardHtml).join('')+'</div>';
      return;
    }
    var stages=[['pruef','In Prüfung'],['won','Gewonnen'],['lost','Verloren']];
    host.innerHTML='<div class="kanban">'+stages.map(function(s){
      var items=_summaries.filter(function(o){return stageOf(o)===s[0];});
      return '<div class="kanban-col"><div class="kanban-col-head">'+s[1]+'<span class="kc-count">'+items.length+'</span></div>'
        + (items.length?items.map(kanbanCardHtml).join(''):'<div class="health-sub" style="padding:8px 2px">keine Objekte</div>')+'</div>';
    }).join('')+'</div>';
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
      loadDetails().then(function(){ renderHealth(); renderKpiCards(); renderScoreHero(); buildCharts(); renderProjTable(); });
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
    renderHealth(); renderProjTable();
  }

  /* ════ DASHBOARD-MARKUP (in #dashboard-main injecten) ════ */
  function ensureMarkup(){
    var m=$(MOUNT_ID); if(!m) return false;
    if(m.getAttribute('data-dp-built')==='1') return true;
    function chartCard(id,ico,title,sub,badge,tall){
      return '<div class="chart-card"><div class="chart-card-head">'
        + '<div class="chart-card-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+ico+'"/></svg></div>'
        + '<div class="chart-card-headtext"><div class="chart-card-t">'+title+'</div><div class="chart-card-s">'+sub+'</div></div>'
        + '<span class="chart-card-badge">'+badge+'</span></div>'
        + '<div class="chart-box'+(tall?' tall':'')+'"><canvas id="'+id+'"></canvas></div></div>';
    }
    m.innerHTML =
      '<div id="dp-dash-bgfx"><span class="dp-orb o1"></span><span class="dp-orb o2"></span><span class="dp-orb o3"></span><canvas id="dp-particles"></canvas></div>'
      + '<div class="dp-dash-header"><div><div class="dp-dash-title">Portfolio-Dashboard</div>'
      + '<div class="dp-dash-sub">Zentrale Management- und Analyseoberfläche · alle gewonnenen Objekte</div></div>'
      + '<div class="dp-dash-actions">'
      + '<button class="dp-dash-btn" onclick="DealPilotDashboard.toggleSidebar()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>Vollbreite</button>'
      + '<button class="dp-dash-btn" onclick="DealPilotDashboard.headerTrackRecord()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>Track-Record</button>'
      + '</div></div>'
      + '<div class="pscore-hero dp-card-dark" id="dp-pscore-hero"></div>'
      + '<div class="kpi-grid" id="dp-kpi-grid"></div>'
      + '<div class="health-strip dp-card-dark" id="dp-health-strip"></div>'
      + '<div class="dp-status-row" id="dp-status-row"></div>'
      + '<div class="dp-section-label">Objekte <span class="dp-view-switch" id="dp-view-switch">'
      + '<button data-v="kanban" class="active" onclick="DealPilotDashboard.setCardView(\'kanban\')">Kanban</button>'
      + '<button data-v="cards" onclick="DealPilotDashboard.setCardView(\'cards\')">Karten</button></span></div>'
      + '<div id="dp-board"></div>'
      + '<div class="dp-section-label">Projektion &amp; Verlauf <span class="dp-model-tag">Modellprojektion (vereinfacht)</span></div>'
      + '<div class="dp-dash-charts">'
      + chartCard('dpc-cashflow','M3 17l6-6 4 4 8-8','Cashflow-Verlauf','vor / nach Steuer','€/Jahr')
      + chartCard('dpc-vermoegen','M3 3v18h18M7 14l4-4 3 3 5-6','Vermögens-Schere','Wert vs. Restschuld','Mio €')
      + chartCard('dpc-mittelverw','M4 20V10M10 20V4M16 20v-7M22 20H2','Mittelverwendung','Jahr 1','Allokation')
      + chartCard('dpc-wealth','M3 21h18M6 21V9l6-4 6 4v12','Wealth-Stacks','Eigenkapital-Aufbau','Aufbau',true)
      + chartCard('dpc-klumpen','M12 2a10 10 0 1 0 10 10H12z','Klumpenrisiko','Volumen nach Lage','Diversifikation')
      + chartCard('dpc-steuer','M9 14l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z','Steuer-Verlauf','Steuereffekt','10 Jahre',true)
      + '</div>'
      + '<div class="dp-section-label">Gesamt-Projektion <span class="dp-model-tag">Modellprojektion (vereinfacht)</span>'
      + '<span class="proj-years" id="dp-proj-years">'
      + '<button data-y="10" onclick="DealPilotDashboard.setProjYears(10)">10 J.</button>'
      + '<button data-y="20" class="active" onclick="DealPilotDashboard.setProjYears(20)">20 J.</button>'
      + '<button data-y="30" onclick="DealPilotDashboard.setProjYears(30)">30 J.</button></span></div>'
      + '<div class="proj-scroll"><table class="proj-table" id="dp-proj-table"></table></div>';
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
    $('dp-kpi-grid').innerHTML='<div class="dp-chart-loading" style="grid-column:1/-1;height:90px"><span class="dp-spin"></span>laden…</div>';
    loadSummaries().then(function(){
      renderScoreHero(); renderStatus(); renderBoardOrCards();
      setTimeout(initParticles, 250);   // v452.6: nach Layout, sonst Canvas 0x0
      // Hintergrund: Details nachladen -> Health/KPIs/Charts/Tabelle
      return loadDetails();
    }).then(function(){
      renderScoreHero(); renderKpiCards(); renderHealth(); renderProjTable(); buildCharts();
    }).catch(function(e){
      $('dp-kpi-grid').innerHTML='<div class="health-sub" style="grid-column:1/-1">Daten konnten nicht geladen werden: '+esc(e.message)+'</div>';
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
    maybeStartupDashboard();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();

  /* ════ PUBLIC API ════ */
  window.DealPilotDashboard = {
    open: openDashboard, close: closeDashboard,
    setProjYears: setProjYears, setCardView: setCardView,
    cardPdf: cardPdf, cardDelete: cardDelete,
    headerTrackRecord: headerTrackRecord, exportPortfolioPdf: exportPortfolioPdf,
    toggleSidebar: toggleSidebar, setTheme: setTheme, applyTheme: applyTheme,
    _debug: function(){ return { summaries:_summaries, details:_details, loaded:_detailsLoaded }; }
  };
})();
