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
  /* v2305 · Zins- und Tilgungssaetze (d1z, d1t, d2z, d2t) laufen ueber _pct, nie ueber num():
     num() entfernt jeden Punkt als Tausendertrenner - gespeichertes "3.5" wurde 35 %, "2.50" 250 %.
     Gemessen 16.10.2026: Portfolio-DSCR 0,87 bei Cashflow vor Steuer +23.034 EUR/Jahr (Konto info@,
     gemischte Schreibweise "4,0"/"3.5" in denselben Feldern). Betroffen: Kapitaldienst, Tilgung, Zins,
     Restschuld, mittlerer Zins und die Objektwerte an die Portfolio-Analyse. */
  /* v475: Erwerbsnebenkosten in EURO — absolut falls vorhanden, sonst aus %-Feldern (wie calc.js Z.663) */
  function _nkEuro(o){ if(num(o&&o.nk)>0) return num(o.nk); var kp=_kpEuro(o); if(window.DealKpis&&DealKpis.nebenkosten){ /* v3006c: GrESt ohne Inventar */ return DealKpis.nebenkosten({kp:kp,inventar:Math.max(num(o&&o.inv_kueche)||0,num(o&&o.moebl)||0),makler_p:_pct(o&&o.makler_p),notar_p:_pct(o&&o.notar_p),gba_p:_pct(o&&o.gba_p),gest_p:_pct(o&&o.gest_p),ji_p:_pct(o&&o.ji_p)}).summe; } return kp*(_pct(o&&o.notar_p)+_pct(o&&o.gest_p)+_pct(o&&o.makler_p)+_pct(o&&o.gba_p)+_pct(o&&o.ji_p))/100; }
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
    /* v1861 · Marcel: „das muss überall gleich sein." Das Wort kommt aus der
       EINEN Kette (score-tiers.js: Top · Gut · Solide · Schwach · Kritisch),
       nicht mehr aus einer eigenen Liste je Anzeige. */
    var _k=(window.ScoreTier?window.ScoreTier.classify(score):(score>=85?'top':score>=70?'green':score>=50?'gold':'red'));
    var _w=(window.ScoreTier&&ScoreTier.stufe)?ScoreTier.stufe(score).wort:null;
    if(_k==='top') return {t:'top', l:_w||'Top', col:'var(--dp-green-txt)'};
    if(_k==='green') return {t:'hi',  l:_w||'Gut',      col:'var(--dp-green-txt)'};
    if(_k==='gold') return {t:'mid', l:_w||'Solide',   col:'var(--dp-gold-txt)'};
    return {t:'lo', l:_w||'Schwach', col:'var(--dp-red-txt)'};
  }
  function catBarColor(s){ return s>=70?'var(--dp-green)':s>=50?'var(--dp-gold)':'var(--dp-red)'; }
  function _dl(){return '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>';}
  function _qrSvg(text,px){try{if(window.DpQr&&DpQr.svg)return DpQr.svg(String(text||'DealPilot'),{px:px||3,ecc:'M',border:2,dark:'#0c0b09',light:'#ffffff'});}catch(e){}return '<div style="width:74px;height:74px;border-radius:4px;background:repeating-linear-gradient(45deg,#0c0b09 0 3px,#fff 3px 6px)"></div>';}
  /* W30-wl-token: Whitelabel-Farbe zur Laufzeit aufloesen.
     Chart.js malt auf Canvas, SVG-Praesentationsattribute sind keine CSS-Props —
     beide verstehen KEIN var(). Ohne Whitelabel liefert _wlc() das Literal zurueck. */
  function _wlc(h) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--wl-' + h.slice(1).toLowerCase());
      v = (v || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    } catch (e) {}
    return h;
  }
  function _wlrgba(a) {
    var h = _wlc('#C9A84C');
    return 'rgba(' + parseInt(h.substr(1, 2), 16) + ',' + parseInt(h.substr(3, 2), 16) + ',' + parseInt(h.substr(5, 2), 16) + ',' + a + ')';
  }

  function _tierBg(tt){return tt==='lo'?'rgba(184,98,80,.16)':tt==='mid'?'color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 16%, transparent)':'rgba(63,165,108,.16)';}
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
      return Promise.reject(new Error('Auth nicht verfügbar'));
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
        /* v2170b: die Analyse-SPALTE mitnehmen - die Kopie in data._ai war bei 4 von 8
           Objekten veraltet (Spalte 13.10., Kopie 09.10.; gemessen auf Staging). */
        d._ai_spalte = obj && obj.ai_analysis;
        _details[k] = d;
        return d;
      }).catch(function(){ return null; });
    });
    return Promise.all(jobs).then(function(){ _detailsLoaded = true; return _details; });
  }

  // Detail-Objekte als Array (nur erfolgreich geladene)
  /* v1813: `alleTrotzAuswahl` uebergeht die Einzelobjekt-Auswahl. Sie ist
     ein ANSICHTSFILTER — fuer den Portfolio-Spiegel, der dem Bot als
     Tatsache gilt, darf sie nicht gelten. Gemessen: mit gesetzter Auswahl
     schrieb der Spiegel ein Portfolio aus einem Haus. */
  function detailArr(alleTrotzAuswahl){
    var all = wonList().map(function(o){ return _details[o.id||o.key]; }).filter(Boolean);
    all = (window.DealPilotMandanten && window.DealPilotMandanten.filterByHalter) ? window.DealPilotMandanten.filterByHalter(all) : all; /* mand-filter v803 */
    if(!alleTrotzAuswahl && _dashSelIdx>=0 && _dashSelIdx<all.length) return [all[_dashSelIdx]];   // v475: Einzelobjekt-Ansicht
    return all;
  }

  /* ════ PORTFOLIO-RECHEN-SSoT ════
     EINE Stelle fuer die Aggregat-Mathematik. aggStats() ist die Quelle;
     renderOverview UND renderHealth greifen darauf zu. WICHTIG:
     o.kp = Kaufpreis in EURO (String). o._kaufpreis = Kaufpreis in CENT! */
  /* v3215 · W-17: weitere Darlehen eines gespeicherten Objekts (ab Kauf), nur ueber den Kern */
  var _DW0 = { betrag: 0, rate_m: 0, zins_j: 0, tilg_j: 0 };
  function _dwO(o){ try { return (window.DpDarlehenWeitere && o) ? DpDarlehenWeitere.ausObjekt(o.__raw || o) : _DW0; } catch(e){ return _DW0; } }
  function _kpEuro(o){ return num(o && o.kp) || (num(o && o._kaufpreis) / 100) || 0; }
  function _restschuldOf(o){
    var fromKpi = num(o._kpis_restschuld); if(fromKpi > 0) return fromKpi;
    var D = num(o.d1) + num(o.d2) + _dwO(o).betrag; if(D <= 0) return 0;   /* v3215 */
    var zins = _pct(o.d1z)/100, tilg = _pct(o.d1t)/100; if(zins <= 0 || tilg <= 0) return D;
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

  /* ══ v2099 · SUMMEN WAHLWEISE AUF ANKAUF ODER BESTAND ════════════════
     Backlog N60.16: „Summen und Kennzahlen wahlweise auf Ankauf oder
     Bestand - heute rechnet es nur den laufenden Stand."

     GERECHNET WIRD NICHT ZWEIMAL. `_ankauf.daten` ist eine VOLLSTAENDIGE
     Kopie des Datensatzes (`ankauf.js:_datensatzJetzt` - alles ausser
     `_ankauf` selbst und `_thumb`). Also laeuft dieselbe `aggStats()`
     einmal ueber die heutigen und einmal ueber die eingefrorenen
     Datensaetze. Eine eigene Ankauf-Summenrechnung waere eine zweite
     Wahrheit - und `kurz` allein haette dafuer nicht gereicht: es fuehrt
     neun Kennzahlen, die Summen brauchen aber auch `d1`, `d1t`, `san`,
     `moebl` und ein Dutzend weitere.

     DIE GRUNDMENGE WECHSELT MIT, und das muss dastehen: Objekte ohne
     eingefrorenen Stand fallen im Ankauf-Modus heraus. Eine Summe ueber
     vier von acht Objekten, die aussieht wie eine ueber acht, ist
     falsch - `doppelkarte.js` sagt es fuer die Karten schon so: „eine
     Karte, die im Ankauf-Modus ihre HEUTIGEN Zahlen zeigt, ohne das zu
     sagen, waere eine Luege im Nebensatz."

     Der Schalter erscheint nur, wenn es ueberhaupt etwas zu schalten
     gibt - ein Schalter, der nichts tut, ist schlimmer als keiner. */
  var _standMode = 'bestand';   /* 'bestand' | 'ankauf' */
  function toggleStand(){
    _standMode = (_standMode === 'bestand') ? 'ankauf' : 'bestand';
    try{ renderOverview(); }catch(e){}
  }
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
      dscr:          numN((window.Dscr && Dscr.ausGespeichert ? Dscr.ausGespeichert(d) : d._kpis_dscr)),   /* v3031 */
      ltv:           numN(d._kpis_ltv),
      cashflowMonatlich: (d._kpis_cf_ns!=null ? num(d._kpis_cf_ns)/12 : null),
      /* v2144: ohne Darlehen entfallen DSCR und LTV im Investor Deal
         Score. Gelesen wird der GESPEICHERTE Stand (d1 + d2) - was am
         Objekt steht, gilt; eine Ableitung gaebe es hier nicht.

         Steht gar nichts, bleibt es `null` und alles rechnet wie vor
         v2144 - `Number(null)` waere 0 und damit ein Barkauf, den
         niemand erklaert hat. */
      darlehen: (function(){
        var a = numN(d.d1), b = numN(d.d2), c = _dwO(d).betrag;   /* v3215: + weitere Darlehen */
        if (a == null && b == null && !(c > 0)) return null;
        return (a || 0) + (b || 0) + c;
      })(),
      __raw:d
    };
  }
  function numN(v){ return (v==null||v==='')?null:num(v); }

  /* ════ v3234 · ZWEI SCORES IM COCKPIT ════
     Marcel 09.11.2026: „den Score auch aufteilen wie beim Investor Dealscore? Wenn
     in den Einstellungen dieser getrennt ist, dann auch im Portfolio Cockpit."
     Anzeige-Merker wie im Objekt (dealscore2-ui.js window._dpScoreAnsicht,
     dpsh-score-hero.js scoreAnsicht). KEINE eigene Rechnung: je Objekt teilt
     DealScore2._zweiScores() (derselbe Kern wie DealScore2.compute im Objekt) die am
     Objekt gespeicherten Kategorien (_ds2_categories, beim Speichern aus
     DealScore2.compute) mit dem aktiven Bewertungsprofil auf. Ueber das Portfolio
     dann nach Kaufpreis gewichtet - wie aggregateCategories(). Objekte ohne
     belastbar gespeicherten Investor Deal Score (_ds2_score) zaehlen nicht mit. */
  function _zweiAnsicht(){
    if (typeof window._dpScoreAnsicht === 'function') { try { return window._dpScoreAnsicht(); } catch (e) {} }
    try { return localStorage.getItem('dp_score_ansicht') === 'zwei' ? 'zwei' : 'eins'; } catch (e) { return 'eins'; }
  }
  function _zweiJeObjekt(d){
    var D2 = window.DealScore2;
    if (!d || d._ds2_score == null || !D2 || typeof D2._zweiScores !== 'function' || typeof D2.loadConfig !== 'function') return null;
    var cats = d._ds2_categories;
    if (typeof cats === 'string') { try { cats = JSON.parse(cats); } catch (e) { cats = null; } }
    if (!cats || typeof cats !== 'object' || Array.isArray(cats)) return null;
    if (!Object.keys(cats).some(function(k){ return cats[k] && Array.isArray(cats[k].breakdown); })) return null;
    try {
      var z = D2._zweiScores(cats, D2.loadConfig(), buildDealFromData(d), null);
      if (!z || !z.investment || !z.finanzierung || z.investment.score == null || z.finanzierung.score == null) return null;
      return { inv: z.investment.score, fin: z.finanzierung.score,
        invG: z.investment.gruppen || [], finG: z.finanzierung.gruppen || [],   /* v3248 */
        invA: Number(z.investment.anteil) || 0, finA: Number(z.finanzierung.anteil) || 0,   /* v3254 */
        dscrGrenze: !!z.finanzierung.deckel };   /* v3254 · DSCR unter 1,2: die Staffel begrenzt dieses Objekt */
    } catch (e) { return null; }
  }
  /* v3248 \u00b7 Marcel 09.11.2026: \u201eim Portfolio-Cockpit genauso aufteilen, auch von den KPIs
     wie im Tab Bewertung beim Investor-Deal-Score". Die Gruppen (Name, Kennzahlen, Anteil)
     kommen fertig aus DealScore2._zweiScores() je Objekt - dieselbe Zuordnung
     (DealScore2.ZWEI_ZUORDNUNG) und dieselben Namen wie in der Bewertung
     (dpsh-score-hero.js zKarte/zBalken). Hier wird nur ueber das Portfolio nach
     Kaufpreis gewichtet, wie die Teil-Scores selbst (_zweiAgg). */
  function _zweiGruppenSammeln(acc, gruppen, w){
    (gruppen || []).forEach(function(g, i){
      if (!g || g.score == null || !isFinite(g.score)) return;
      var a = acc[g.key];
      if (!a) a = acc[g.key] = { key: g.key, name: g.name, pos: i, s: 0, w: 0, an: 0, kpis: g.kpis || [], total: 0, n: 0 };
      a.s += g.score * w; a.an += (Number(g.anteil) || 0) * w; a.w += w; a.n++;
      a.total = Math.max(a.total, g.totalKpis || 0);
      if ((g.kpis || []).length > a.kpis.length) a.kpis = g.kpis;
    });
  }
  function _zweiGruppenListe(acc){
    return Object.keys(acc).map(function(k){ return acc[k]; }).sort(function(a, b){ return a.pos - b.pos; })
      .map(function(a){ return { key: a.key, name: a.name, score: Math.round(a.s / a.w), anteil: Math.round(a.an / a.w * 10) / 10,
        kpis: a.kpis, total: a.total, n: a.n }; });
  }
  function _zweiAgg(){
    if (!_detailsLoaded) return { n: 0, von: wonList().length, laedt: true };
    var arr = detailArr(), tw = 0, si = 0, sf = 0, n = 0, gI = {}, gF = {}, sa = 0, sb = 0, nGrenze = 0;
    arr.forEach(function(d){
      var z = _zweiJeObjekt(d); if (!z) return;
      var w = num(d._kaufpreis) || 1;
      tw += w; si += z.inv * w; sf += z.fin * w; n++;
      sa += z.invA * w; sb += z.finA * w; if (z.dscrGrenze) nGrenze++;   /* v3254 */
      _zweiGruppenSammeln(gI, z.invG, w); _zweiGruppenSammeln(gF, z.finG, w);   /* v3248 */
    });
    if (!n) return { n: 0, von: arr.length };
    return { n: n, von: arr.length, inv: Math.round(si / tw), fin: Math.round(sf / tw),
      invG: _zweiGruppenListe(gI), finG: _zweiGruppenListe(gF),
      invA: Math.round(sa / tw * 10) / 10, finA: Math.round(sb / tw * 10) / 10, nGrenze: nGrenze };   /* v3254 */
  }
  /* Ring wie die Bordkarte (116 px) bzw. klein fuer die zwei Teil-Scores. Farben als
     style, nicht als Attribut - var() greift in SVG-Praesentationsattributen nicht. */
  function _ringSvg(sc, col, px){
    var r = 46, C = 2 * Math.PI * r, d = Math.max(0, Math.min(100, sc)) / 100 * C;
    return '<svg viewBox="0 0 116 116" width="' + px + '" height="' + px + '" aria-hidden="true">'
      + '<circle cx="58" cy="58" r="' + r + '" fill="none" stroke="rgba(140,140,140,.18)" stroke-width="9"/>'
      + '<circle cx="58" cy="58" r="' + r + '" fill="none" style="stroke:' + col + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + d.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 58 58)"/>'
      + '<text x="58" y="56" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="34" style="fill:' + col + '">' + sc + '</text>'
      + '<text x="58" y="73" text-anchor="middle" font-family="JetBrains Mono" font-size="9" fill="#9a948a">/ 100</text></svg>';
  }
  /* v3254 · Marcel 09.11.2026: „So wie wir im Reiter Bewertung den Investment-Score und
     Finanzierungs-Score aufgebaut haben, so wollte ich das eigentlich auch im Portfolio-Cockpit
     haben. Also auf zwei getrennten Karten mit dem Gesamturteil auch vom Gesamtportfolio.“
     Hier standen _zweiKarte (v3234, zwei kleine Ringe) und darunter die Bereichsbalken (v3248).
     Beides ist ersetzt durch DIESELBE Ansicht wie im Reiter Bewertung:
     DealPilotScoreHero.zweiAnsicht(r2, opt) aus dpsh-score-hero.js - ein Markup fuer beide
     Stellen. Hier wird nur das Datenobjekt gebaut: Teil-Scores, Anteile und Bereiche je Objekt
     aus DealScore2._zweiScores(), nach Kaufpreis gewichtet (_zweiAgg); das Gesamturteil ist der
     Portfolio-Score (aggregateScore, die gespeicherten Investor Deal Scores), das Wort aus
     ScoreTier. Eine Empfehlung (Kaufen/Verhandeln) gibt es fuer den Bestand nicht. */
  function _zweiPortfolioHtml(Z2, ag, S){
    var SH = window.DealPilotScoreHero;
    if (!SH || typeof SH.zweiAnsicht !== 'function') return '';
    var stufe = function(x){ return (window.ScoreTier && ScoreTier.stufe) ? ScoreTier.stufe(x).wort : tierOf(x).l; };
    var gr = function(L){ return (L || []).map(function(g){
      return { name: g.name, anteil: g.anteil, score: g.score, kpis: g.kpis, totalKpis: g.total, availableKpis: null,
        hinweis: g.n < Z2.n ? g.n + ' von ' + Z2.n + ' Objekten' : null };
    }); };
    var r2 = {
      investment:   { score: Z2.inv, stufe: stufe(Z2.inv), anteil: Z2.invA, gruppen: gr(Z2.invG) },
      finanzierung: { score: Z2.fin, stufe: stufe(Z2.fin), anteil: Z2.finA, gruppen: gr(Z2.finG) },
      gesamt:       { score: ag.total, stufe: stufe(ag.total) }
    };
    var obj = Z2.n + ' von ' + Z2.von + ' Objekt' + (Z2.von === 1 ? '' : 'en');
    var cfM = S.cfVsM;
    var eck = '<div class="dpz-eck"><div><span class="k">OBJEKTE</span><span class="v">' + ag.n + '</span></div>'
      + '<div><span class="k">VOL.</span><span class="v">' + fmtKEU(S.kp) + '</span></div>'
      + '<div><span class="k">CF/MON</span><span class="v" style="color:' + (cfM >= 0 ? 'var(--c-greenl)' : 'var(--c-redl)') + '">' + (cfM >= 0 ? '+' : '') + fmtE(cfM) + '</span></div></div>';
    var wie = ['Je Objekt teilt der Kern den Investor Deal Score in Investment und Finanzierung auf \u2013 dieselbe Rechnung wie im Reiter Bewertung. '
      + '\u00dcber das Portfolio z\u00e4hlt jedes Objekt mit seinem Kaufpreis (' + esc(obj) + ' mit gespeicherter Aufteilung).'];
    if (Z2.nGrenze) wie.push('Bei ' + Z2.nGrenze + ' Objekt' + (Z2.nGrenze === 1 ? '' : 'en') + ' deckt die Miete den Kapitaldienst nur knapp oder nicht; f\u00fcr sie gilt die Grenze unten. Ob sie den Score dort wirklich senkt, steht im Reiter Bewertung des Objekts.');
    return SH.zweiAnsicht(r2, {
      lbl: 'Gesamturteil \u00b7 Investor Portfolio Score',
      warum: 'Gesamt aus Investment <b>' + Z2.inv + '</b> (' + String(Z2.invA).replace('.', ',') + '\u00a0%) und Finanzierung <b>' + Z2.fin + '</b> ('
        + String(Z2.finA).replace('.', ',') + '\u00a0%) \u2013 ' + esc(obj) + ', nach Kaufpreis gewichtet.',
      kopfZusatz: eck,
      knoepfe: '<button class="dpz-knopf" type="button" onclick="DealPilotDashboard.showScoreDetails()">Details &amp; alle KPIs</button>'
        + '<button class="dpz-knopf" type="button" onclick="DealPilotScoreHero.action(\'classic\')" title="Einstellungen \u203a Deal Score \u203a Bewertung als">Ansicht</button>',
      invFrage: 'Wie gut sind die Immobilien, egal wie sie finanziert sind?',
      finFrage: 'Tr\u00e4gt die Finanzierung den Bestand?',
      invFuss: 'Z\u00e4hlt ' + String(Z2.invA).replace('.', ',') + '\u00a0% \u2013 gemittelt \u00fcber die Objekte.',
      finFuss: 'Z\u00e4hlt ' + String(Z2.finA).replace('.', ',') + '\u00a0% \u2013 gemittelt \u00fcber die Objekte.',
      faktoren: false,
      wie: wie
    });
  }

  /* ════ RENDER: Score-Hero ════ */
  function renderScoreHero(){
    var host = $('dp-pscore-hero'); if(!host) return;
    var P = plan();
    var ag = aggregateScore();
    var title = P.full ? 'Investor Portfolio Score' : 'DealPilot Portfolio Score';
    /* v3227 (bis v3233) machte hieraus eine schlichte Karte ohne Ring und mit
       eingeklappten Bereichen - auf Marcels Wunsch v3234 zurueckgenommen, s. u.
       Haken fuer das Messe-Drehbuch bleiben: .hbody, .hgate, .hbars und der
       Text \u201e\u2026 SCORE nn / 100 STUFE OBJEKTE n VOL. \u2026 CF/MON \u2026". */
    /* v3234 \u00b7 Marcel 09.11.2026: \u201eBitte auch die Optik der Karte wieder zur\u00fcck, du hast
       den irgendwie umgebaut." Die Bordkarte von vor v3227 ist zur\u00fcck (Pre-Flight-Kopf,
       Ring, Stufe, Eckdaten, f\u00fcnf Bereiche, Portfolio-Pass). Die Kennzahlen p. a. bleiben in
       Abschnitt 02 (v3227) - die Kennzahl-Spalte .hkz kommt nicht zur\u00fcck.
       Neu: ist in den Einstellungen \u201eZwei Scores\u201c gew\u00e4hlt (Merker dp_score_ansicht, wie
       im Objekt), stehen Investment- und Finanzierungs-Score unter dem Gesamtscore
       (_zweiAgg, aus dem Kern DealScore2._zweiScores). */
    host.classList.remove('cp-hero'); host.classList.remove('hz-dpz');   /* v3254 */
    if(!ag.hasData){
      host.innerHTML = '<div class="hmain"><div class="hpre"><span class="led"></span><span class="t">Pre-Flight \u00b7 Portfolio Score</span><span class="cls">Boarding</span></div>'
        + '<div class="hbody" style="display:block;text-align:center;color:var(--c-pmut);font-family:Inter,sans-serif;font-size:13px;line-height:1.6;padding:30px 22px">'
        + 'Noch kein gewonnenes Objekt mit berechnetem Score.<br>Sobald du ein Objekt auf \u201eGewonnen\u201c setzt und der DealScore berechnet ist, erscheint hier dein Portfolio-Score.</div></div>';
      return;
    }
    var t = tierOf(ag.total);
    var S = aggStats();
    var Z2 = (P.full && _zweiAnsicht() === 'zwei') ? _zweiAgg() : null;
    /* v3254 · Zwei Scores (Einstellung) UND Investor-Plan UND mindestens ein Objekt mit gespeicherter
       Aufteilung: dieselbe Ansicht wie im Reiter Bewertung. Sonst - auch solange die Details laden -
       die normale Portfolio-Score-Karte wie vor v3234. */
    var zweiAns = (Z2 && Z2.n) ? _zweiPortfolioHtml(Z2, ag, S) : '';
    host.classList.toggle('hz-dpz', !!zweiAns);
    if (zweiAns) {
      host.innerHTML = zweiAns;
      if(_detailsLoaded){ try{ _mbHistLaden(detailArr()); }catch(e){} }
      return;
    }
    var detailsBtn = P.full
      ? '<button class="hkpi-btn" onclick="DealPilotDashboard.showScoreDetails()"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4-4M11 8v6M8 11h6"/></svg> Details &amp; alle KPIs</button>'
      : '<button class="hkpi-btn" onclick="DealPilotDashboard.showScoreUpgrade()"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Volle 24-KPI-Analyse</button>';
    var catsHtml = ag.cats ? ag.cats.map(function(c){
        var sc=c.score==null?0:c.score; var w=(KPICOUNT[c.key]||0);
        /* v1735 \u00b7 \u201eauch die KPIs anzeigen passend" \u2014 die Score-Karte im Tab
           Bewertung schreibt hinter jeden Wert ein kleines \u201e/100"
           (dpsh-score-hero.js). Ohne das steht die Zahl ohne Bezug da: 61
           kann alles heissen. Die Rohwerte, die dort zusaetzlich unter dem
           Balken stehen (-103 EUR/Mon, DSCR 1.04), gibt es auf
           Portfolio-Ebene nicht \u2014 sie waeren hier erfunden. */
        /* v3216 · W-3: „Rendite" ist die Deal-Score-KATEGORIE, nicht die
           Bruttomietrendite - der Tooltip sagt es. Das Info-Zeichen steht als
           ::after im CSS, damit der Text (Messe-Drehbuch liest ihn per Regex)
           unveraendert bleibt. */
        var _tip = c.key === 'rendite' ? _renditeTip() : '';
        return '<div class="bar"><div class="bt"><span class="n'+(_tip?' hinfo':'')+'"'+(_tip?' tabindex="0" title="'+esc(_tip)+'"':'')+'>'+esc(c.label)+'<em>'+w+' KPIs</em></span><span class="v">'+(c.score==null?'\u2013':sc+'<i>/100</i>')+'</span></div>'
          + '<div class="track"><div class="fill" data-w="'+sc+'" style="width:0;background:'+catBarColor(sc)+'"></div></div></div>';
      }).join('') : '<div class="bar" style="color:var(--c-pmut);font-family:JetBrains Mono;font-size:11px">Kategorien werden geladen\u2026</div>';
    /* v3254 · hier standen die v3248-Bereichsbalken (zweiBars) und die v3234-Kleinringe (zweiHtml)
       - beides steckt jetzt in der Zwei-Score-Ansicht oben (_zweiPortfolioHtml). */
    var cfM=S.cfVsM;
    var ringCol = t.col;
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
      + '<div class="hbars"><div class="ttl">So setzt sich der Score zusammen</div><div id="dp-hero-bars">'+catsHtml+'</div>' + detailsBtn + '</div>'
      + '</div></div>'
      + '<div class="vperf"></div>'
      + '<div class="hpass"><div class="hp-lab">PORTFOLIO-PASS</div><div class="qb" id="dp-hero-qr"></div>'
      + '<div class="hp-code">PORTFOLIO</div><div class="hp-sub">'+ag.scored+' / '+ag.n+' bewertet<br>Stand '+_heute()+'</div></div>';
    /* v3234 \u00b7 Ring wie vor v3227 - Farbe jetzt als style statt als SVG-Attribut: t.col ist
       ein var(), und var() greift in Praesentationsattributen nicht (CLAUDE.md, CSS). */
    var ring=$('dp-hero-ring'); if(ring) ring.innerHTML=_ringSvg(ag.total, ringCol, 116);
    var qrEl=$('dp-hero-qr'); if(qrEl){ qrEl.innerHTML=_qrSvg(((window.location&&location.origin)?location.origin:'')+'/?cockpit', 3); }
    setTimeout(function(){ host.querySelectorAll('.fill').forEach(function(f){ if(f.dataset.w!=null) f.style.width=f.dataset.w+'%'; }); },140);
    /* v3216 · den letzten Marktbericht je Objekt nachladen (GET, kein
       Kontingent) - derselbe Speicher wie die Gesamtbewertung (_mbHist) */
    if(_detailsLoaded){ try{ _mbHistLaden(detailArr()); }catch(e){} }
  }

  /* ══ v3216 · W-3 (Entwicklungspartner): Kennzahl-Spalte im Score-Kopf ══
     „eingesetztes Kapital gegen Cashflow vor/nach Steuer, Tilgung und das
     Delta vom ursprünglichen Darlehen zur aktuellen Bewertung".
     KEINE neue Rechnung: alles aus aggStats() (dieselben Summen wie die
     Kacheln darunter) bzw. aus den am Objekt gespeicherten Kernwerten.
     EK-Rendite = dieselbe Definition wie am Objekt (calc.js ekr/ekr_ns,
     DealKpis ekr: Cashflow nach Tilgung / eingesetztes EK), über den
     Bestand kapitalgewichtet: Summe Cashflow / Summe EK.
     Heutiger Wert (Marcel): letzter Marktbericht des Objekts
     (Marktpreisindikation), sonst Kaufpreis - je Objekt mit Quelle. */
  function _renditeTip(){
    var sw = { bruttorendite:25, nettorendite:30, cashflow:25, cashOnCash:20 }, gw = 35;
    try {
      var cfg = window.DealScore2 && DealScore2.loadConfig ? DealScore2.loadConfig() : null;
      if (cfg && cfg.subWeights && cfg.subWeights.rendite) sw = cfg.subWeights.rendite;
      if (cfg && cfg.weights && cfg.weights.rendite != null) gw = cfg.weights.rendite;
    } catch (e) {}
    var n = function(v){ return Math.round(num(v)); };
    return 'Rendite = Kategorie des Deal-Scores (' + n(gw) + ' % des Gesamt-Scores), NICHT die Bruttomietrendite. '
      + 'Je Objekt 0–100 Punkte aus vier Kennzahlen: Bruttomietrendite ' + n(sw.bruttorendite) + ' %, Nettomietrendite '
      + n(sw.nettorendite) + ' %, Cashflow ' + n(sw.cashflow) + ' %, Cash-on-Cash ' + n(sw.cashOnCash)
      + ' %. Über den Bestand nach Kaufpreis gewichtet.';
  }
  function _wertHeuteJeObjekt(arr){
    return arr.map(function(o){
      var k = o._key, h = (k && _mbHist[k]) || null, kp = _kpEuro(o);
      var mw = h && num(h.market_value) > 0 ? num(h.market_value) : null;
      var darl = num(o.d1) + num(o.d2);   /* wie aggStats().darl: ursprüngliche Darlehenssumme */
      return { key: k, name: _objName(o), kp: kp, darl: darl,
        wert: mw != null ? mw : kp,
        quelle: mw != null ? 'mb' : (k && !(k in _mbHist) ? 'laedt' : 'kp'),
        stand: h && h.created_at ? _fDat(h.created_at) : '' };
    });
  }
  /* v3227 · Kennzahlen als EINE Karte im Stil des Reiters Objekt: Kopf mit
     kleiner Versalien-Ueberschrift, darunter eine ruhige Kachelreihe in drei
     Gruppen. Alles aus aggStats() (dieselben Summen wie bisher in den
     Paar-Kacheln, der Health-Leiste und der Kennzahl-Spalte von v3216) und
     _healthKacheln() (Oe-Zins/Zinsrisiko, DSCR, Tilgungsfortschritt). Keine
     neue Rechnung. Der Text „MIETEINNAHMEN / MONAT …", „GESAMTINVESTITION …",
     „RESTSCHULD GESAMT …" bleibt fuer das Messe-Drehbuch lesbar. */
  function _heroKzHtml(S){
    S = S || aggStats();
    if (!S || !S.n) return '';
    var arr = detailArr();
    var W = _wertHeuteJeObjekt(arr);
    var wSum = 0, dSum = 0, nMb = 0, nKp = 0, nLaedt = 0;
    W.forEach(function(x){ wSum += x.wert; dSum += x.darl; if (x.quelle === 'mb') nMb++; else { nKp++; if (x.quelle === 'laedt') nLaedt++; } });
    var delta = wSum - dSum, deltaP = wSum > 0 ? delta / wSum * 100 : null;
    var ek = S.ek, ekOk = ek > 100;
    var r = function(z){ return ekOk ? z / ek * 100 : null; };
    var ekrVs = r(S.cfVsJ), ekrNs = r(S.cfNsJ), ekrTg = r(S.cfVsJ + S.tilgJ);
    var ton = function(v){ return v == null ? '' : (v >= 0 ? ' pos' : ' neg'); };
    var pr = function(v){ return ekOk ? _fPr(v, 1) : '∞'; };
    var EKt = ekOk ? '' : ' (kaum Eigenkapital eingesetzt)';
    var fE = _fEK;
    var sg = function(v){ return (v >= 0 ? '+' : '−') + fE(Math.abs(v)).replace(/^−/, ''); };
    function k(l, v, cls, tip, sub, click){
      return '<div class="cpt' + (click ? ' cpt-click' : '') + '"' + (tip ? ' title="' + esc(tip) + '"' : '')
        + (click ? ' role="button" tabindex="0" onclick="' + click + '"' : '') + '>'
        + '<span class="cpt-l">' + l + '</span>'
        + '<span class="cpt-v' + (cls || '') + '">' + v + '</span>'
        + (sub ? '<span class="cpt-s">' + sub + '</span>' : '') + '</div>';
    }
    var st = S.stand || { modus: 'bestand', schaltbar: false };
    var imAnkauf = st.modus === 'ankauf';
    var giO = (_giMode === 'ohne');
    var rc = function(v, g, go){ return v == null ? '' : (v >= g ? ' pos' : v >= go ? ' mid' : ' neg'); };
    var tipEkr = 'EK-Rendite wie am Objekt (Kennzahlen-Kachel), über den Bestand kapitalgewichtet: Summe Cashflow ÷ Summe eingesetztes Eigenkapital × 100.';
    var quelleTxt = nMb + '× Marktbericht, ' + nKp + '× Kaufpreis' + (nLaedt ? ' (' + nLaedt + ' wird geladen)' : '');

    var g1 = k('Objekte', String(S.n), '', imAnkauf ? 'Gerechnet über die eingefrorenen Ankauf-Datensätze' : 'Gerechnet über die heutigen Datensätze',
          imAnkauf ? (st.genutzt + ' von ' + st.gesamt + (st.ohne ? ' · ' + st.ohne + ' ohne Ankauf-Stand' : '') + ' · ⇄ heute')
                   : ('im Bestand' + (st.schaltbar ? ' · ⇄ Ankauf-Stand' : '')),
          st.schaltbar ? 'DealPilotDashboard.toggleStand()' : '')
      + k('Mieteinnahmen / Monat', _fE(S.mieteM), '', 'Nettokaltmiete plus Zusatzeinnahmen aller Objekte, je Monat.', 'netto kalt · ' + fE(S.mieteJ) + ' im Jahr')
      + k('Cashflow v. St.', sg(S.cfVsJ), ton(S.cfVsJ), 'Summe Cashflow vor Steuer der Objekte (nach Zins, Tilgung, Bewirtschaftung), je Jahr.', (S.cfVsM >= 0 ? '+' : '−') + _fE(Math.abs(S.cfVsM)) + ' im Monat')
      + k('Cashflow n. St.', sg(S.cfNsJ), ton(S.cfNsJ), 'Summe Cashflow nach Steuer der Objekte, je Jahr.', (S.cfNsM >= 0 ? '+' : '−') + _fE(Math.abs(S.cfNsM)) + ' im Monat')
      + k('Mietrendite', _fPr(S.brutto, 2), rc(S.brutto, 5, 3.5), 'Bruttomietrendite = Jahresmiete ÷ Kaufpreise. Nettomietrendite nach Bewirtschaftungskosten, nach Kaufpreis gewichtet.', 'brutto · netto ' + (S.netto == null ? 'k. A.' : _fPr(S.netto, 2)));
    var g2 = k('Gesamtinvestition', fE(giO ? S.kp : S.gi), '', 'Kaufpreise + Nebenkosten + Sanierung/Inventar. Klick wechselt mit/ohne Kaufnebenkosten.',
          (giO ? 'ohne Nebenkosten' : 'mit Nebenkosten') + ' · ⇄', 'DealPilotDashboard.toggleGi()')
      + k('Finanziert', fE(S.darl), '', 'Ursprüngliche Darlehenssumme beim Ankauf (alle Darlehen).', 'Darlehen beim Ankauf')
      + k('Eingesetztes EK', fE(S.ek), '', 'Eigenkapital laut Objekt-Eingabe, Summe.', 'laut Objekten')
      + k('Restschuld gesamt', fE(S.rest), '', 'Offener Teil der Darlehen heute.', 'Verbindlichkeiten heute')
      + k('Darlehen ↔ Wert heute', sg(delta), ton(delta),
          'Abstand = Wert heute − ursprüngliches Darlehen; Prozent = Abstand ÷ Wert heute. Wert heute je Objekt: letzter Marktbericht (Marktpreisindikation), sonst Kaufpreis.',
          (deltaP != null ? _fPr(deltaP, 1) + ' des Werts · ' : '') + 'Wert ' + fE(wSum));
    var g3 = k('EK-Rendite v. St.', pr(ekrVs), ton(ekrVs), tipEkr + ' Cashflow vor Steuer.' + EKt,
          'n. St. ' + pr(ekrNs) + ' · inkl. Tilgung ' + pr(ekrTg))
      + k('Tilgung p. a.', fE(S.tilgJ), '', 'Summe Darlehen × anfängliche Tilgung, je Jahr – Vermögensaufbau, der im Cashflow schon abgezogen ist.', 'Vermögensaufbau');
    var HK = null; try { HK = _healthKacheln(); } catch (e) { HK = null; }
    if (HK && HK.lock) {
      g3 += '<div class="cpt cpt-lock"><span class="cpt-l">Finanzierung</span><span class="cpt-s">Ø-Zins, Zinsbindungs-Risiko, DSCR und Tilgungsfortschritt ab Investor-Plan</span></div>';
    } else if (HK && HK.length) {
      g3 += HK.map(function(c){
        return '<div class="cpt' + (c.click ? ' cpt-click' : '') + '" title="' + esc(c.tip || '') + '"' + (c.click ? ' role="button" tabindex="0" onclick="' + c.click + '"' : '') + '>'
          + '<span class="cpt-l">' + esc(c.l) + '</span>'
          + '<span class="cpt-v" style="color:' + (c.col || 'var(--c-ptext)') + '">' + c.v + '</span>'
          + '<span class="cpt-s">' + esc(String(c.sub || '').replace(/ · Klick: /, ' · ⇄ ')) + '</span></div>';
      }).join('');
    }
    var liste = W.map(function(x){
      var q = x.quelle === 'mb' ? 'Marktbericht' + (x.stand ? ' vom ' + x.stand : '') : (x.quelle === 'laedt' ? 'Kaufpreis (Marktbericht wird geladen …)' : 'Kaufpreis (kein Marktbericht)');
      var dd = x.wert - x.darl;
      return '<li><span class="kz-on">' + esc(x.name) + '<small>' + esc(q) + '</small></span><span class="kz-ow">' + _fE(x.wert)
        + '<small class="' + (dd >= 0 ? 'pos' : 'neg') + '">' + (dd >= 0 ? '+' : '−') + _fE(Math.abs(dd)).replace(/^−/, '') + ' zum Darlehen</small></span></li>';
    }).join('');
    var _det = $('dp-kz-det'), _detOffen = !!(_det && _det.open);
    return '<div class="cpk-h"><span class="cpk-ico"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span>'
      + '<span>Kennzahlen p. a.</span><em>' + (imAnkauf ? 'Ankauf-Stand' : 'alle ' + S.n + ' Objekte') + '</em></div>'
      + '<div class="cpk-g">Ertrag</div><div class="cpt-grid">' + g1 + '</div>'
      + '<div class="cpk-g">Kapital</div><div class="cpt-grid">' + g2 + '</div>'
      + '<div class="cpk-g">Rendite &amp; Finanzierung</div><div class="cpt-grid">' + g3 + '</div>'
      + _seitZeileHtml()   /* v3321: „Seit dem Kauf" als Zeile unter den Kennzahlen */
      + '<details class="cpk-det" id="dp-kz-det"' + (_detOffen ? ' open' : '') + '><summary>Wert heute je Objekt · ' + esc(quelleTxt) + '</summary><ul class="kz-liste">' + liste + '</ul>'
      + '<p>EK-Rendite = Cashflow ÷ eingesetztes Eigenkapital (wie am Objekt). Inkl. Tilgung = (Cashflow v. St. + Tilgung) ÷ EK. Abstand = Wert heute − ursprüngliches Darlehen.</p></details>';
  }
  function _renderHeroKz(){
    var el = $('dp-kz-card'); if (!el) return;
    try { el.innerHTML = _heroKzHtml(); } catch (e) {}
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
      /* v2191: die Kette aus score-tiers.js - hier stand noch 'TOP' (seit v1863 heisst die Stufe SEHR GUT) */
      var tierBadge = c.score==null?'–':((window.ScoreTier&&ScoreTier.stufe)?ScoreTier.stufe(c.score).versal:(c.score>=85?'SEHR GUT':c.score>=70?'GUT':c.score>=50?'SOLIDE':c.score>=35?'SCHWACH':'KRITISCH'));
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
  function aggStats(alleTrotzAuswahl){
    var arr=detailArr(alleTrotzAuswahl);
    /* v2099: im Ankauf-Modus rechnet dieselbe Aggregation ueber die
       EINGEFRORENEN Datensaetze. `stand` reist mit, damit die Kacheln
       sagen koennen, worueber gerechnet wurde - siehe Begruendung an
       `toggleStand()`. */
    var _standN = 0;
    for (var _i = 0; _i < arr.length; _i++) {
      if (arr[_i] && arr[_i]._ankauf && arr[_i]._ankauf.daten) _standN++;
    }
    var stand = { modus: _standMode, gesamt: arr.length,
                  mitStand: _standN, genutzt: arr.length, ohne: 0,
                  schaltbar: _standN > 0 };
    if (_standMode === 'ankauf' && _standN > 0) {
      var _frozen = [];
      arr.forEach(function(o){
        if (o && o._ankauf && o._ankauf.daten) _frozen.push(o._ankauf.daten);
      });
      stand.genutzt = _frozen.length;
      stand.ohne = arr.length - _frozen.length;
      arr = _frozen;
    } else if (_standMode === 'ankauf') {
      /* Kein Objekt mit Stand: NICHT auf Nullen rechnen. Der Modus faellt
         zurueck und sagt es - eine Summe von 0 EUR waere eine Behauptung. */
      stand.modus = 'bestand';
      stand.zurueckgefallen = true;
    }
    var sum=function(f){return arr.reduce(function(s,o){return s+(f(o)||0);},0);};
    var kpSum=sum(_kpEuro);
    var giSum=sum(function(o){var g=num(o._kpis_gi); if(g>0)return g; return _kpEuro(o)+_nkEuro(o)+num(o.san); /* v2261: Inventar ist Teil des Kaufpreises */});
    var mieteJ=sum(function(o){var m=num(o._kpis_miete_j); if(m>0)return m; return (num(o.nkm)+num(o.ze))*12;});
    var rest=sum(_restschuldOf);
    var cfNsJ=sum(function(o){return num(o._kpis_cf_ns);});
    var cfVsJ=sum(function(o){var v=o._kpis_cf_vs; return (v!=null&&!isNaN(num(v)))?num(v):num(o._kpis_cf_ns);});
    var kdSum=sum(function(o){return num(o.d1)*(_pct(o.d1z)+_pct(o.d1t))/100 + num(o.d2)*(_pct(o.d2z)+_pct(o.d2t))/100 + _dwO(o).rate_m*12;});   /* v3215 */
    var ekSum=sum(function(o){return num(o.ek);});
    var darlSum=sum(function(o){return num(o.d1)+num(o.d2)+_dwO(o).betrag;});   /* v3215 */
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
    /* v1802 · Tilgung und Zins getrennt. `kdSum` fuehrt beide zusammen als
       Kapitaldienst — fuer den DSCR richtig, fuer die Frage "wie hoch ist
       meine Gesamttilgung" nicht. Dieselbe Rechnung, nur einzeln. */
    var tilgSum=sum(function(o){return num(o.d1)*_pct(o.d1t)/100 + num(o.d2)*_pct(o.d2t)/100 + _dwO(o).tilg_j;});   /* v3215 */
    var zinsSum=sum(function(o){return num(o.d1)*_pct(o.d1z)/100 + num(o.d2)*_pct(o.d2z)/100 + _dwO(o).zins_j;});   /* v3215 */
    return {
      n:arr.length, gi:giSum, kp:kpSum, ek:ekSum, darl:darlSum,
      mieteJ:mieteJ, mieteM:mieteJ/12, rest:rest,
      cfNsJ:cfNsJ, cfVsJ:cfVsJ, cfNsM:cfNsJ/12, cfVsM:cfVsJ/12,
      tilgJ:tilgSum, zinsJ:zinsSum, kdJ:kdSum,
      brutto:(kpSum>0?(mieteJ/kpSum*100):null),
      netto:nettoCalc,
      dscr:(kdSum>0?(mieteJ/kdSum):null),
      /* v2099: worueber gerechnet wurde. Ohne dieses Feld koennten die
         Kacheln die Grundmenge nicht nennen - und eine Summe ueber vier
         von acht Objekten, die aussieht wie eine ueber acht, ist falsch. */
      stand:stand
    };
  }
  function renderOverview(){
    var host=$('dp-overview-strip'); if(!host) return;
    if(!_detailsLoaded){ host.innerHTML='<div class="dp-chart-loading" style="grid-column:1/-1;height:54px"><span class="dp-spin"></span>Kennzahlen werden geladen\u2026</div>'; return; }
    var arr=detailArr(); if(!arr.length){ host.innerHTML='<div class="health-sub" style="grid-column:1/-1">Keine Detaildaten verfügbar.</div>'; return; }
    var s=aggStats();
    /* v475: Objekt-Dropdown befuellen (volle Liste, nicht gefiltert) */
    (function(){
      var sel=document.getElementById('dp-dash-objsel'); if(!sel) return;
      var allD=wonList().map(function(o){ return _details[o.id||o.key]; }).filter(Boolean);
      var html='<option value="__all__">Alle Objekte ('+allD.length+')</option>';
      allD.forEach(function(d,i){ var nm=(d&&(d._name||d.kuerzel||d._obj_seq))||('Objekt '+(i+1)); html+='<option value="'+i+'"'+(i===_dashSelIdx?' selected':'')+'>'+esc(nm)+'</option>'; });
      if(sel.innerHTML!==html) sel.innerHTML=html;
    })();
    /* v3227 · Marcel 08.11.2026: „die Kennzahlen … einfacher darstellen …
       wie im Tab Objekt". Die vier Paar-Kacheln, die Health-Leiste und die
       Kennzahl-Spalte im Score-Kopf (v3216) sind EINE Karte mit einer ruhigen
       Kachelreihe geworden (_heroKzHtml). Gerechnet wird dort nichts neu -
       dieselben Summen aus aggStats(). Hier bleibt nur „Seit dem Kauf". */

    /* ── v2098 · SEIT ANKAUF, UEBER DEN GANZEN BESTAND ────────────────
     * Backlog N60.16: „die Abweichung ueber den ganzen Bestand - wie
     * viele Objekte stehen besser, wie viele schlechter als beim Ankauf".
     *
     * Gerechnet wird NICHT hier, sondern von
     * `DealPilotAnkauf.abweichungFuer(daten)` - derselben Funktion, die
     * der Reiter Soll/Ist benutzt. Eine zweite Fassung waere hier
     * besonders teuer: `KENNZAHLEN` fuehrt die Richtung je Kennzahl, und
     * bei ZWEI davon (Kaufpreis, LTV) ist KLEINER besser. Wer das
     * nachbaut, erklaert einen gestiegenen Kaufpreis zur Verbesserung.
     * `tools/ankauf-abweichung-pruefen.mjs` prueft alle 18 Richtungen.
     *
     * Das Urteil je Objekt haengt am DealScore - der eigenen
     * Gesamtkennzahl. Kein erfundenes Gewicht ueber die neun Kennzahlen:
     * welche davon schwerer zaehlt, ist eine Bewertungsfrage, und der
     * Score ist die Antwort, die das Produkt ohnehin gibt. Die Kachel
     * sagt das im Titel-Hinweis, damit niemand eine andere Rechnung
     * dahinter vermutet.
     *
     * Die Kachel erscheint NUR, wenn es Objekte mit eingefrorenem
     * Ankauf-Stand gibt. Eine Kachel mit „0 von 0" ist keine Auskunft,
     * sondern eine leere Zeile. */
    (function(){
      var A = window.DealPilotAnkauf;
      if (!A || typeof A.abweichungFuer !== 'function') return;
      var besser = 0, schlechter = 0, gleich = 0, ohneScore = 0, mitStand = 0;
      var liste = [];
      arr.forEach(function(o){
        var r = null;
        try { r = A.abweichungFuer(o); } catch (e) { return; }
        if (!r) return;
        mitStand++;
        if (r.urteil === 'besser') besser++;
        else if (r.urteil === 'schlechter') schlechter++;
        else if (r.urteil === 'gleich') gleich++;
        else ohneScore++;
        liste.push({ name: _objName(o), urteil: r.urteil || null, ankauf: r.scoreAnkauf, heute: r.scoreJetzt, stichtag: r.stichtag || null });
      });
      if (!mitStand) { _seitListe = []; return; }
      _seitListe = liste;
      /* v3321 · Marcel 12.11.2026: „seit dem Kauf … brauchen wir nicht so groß … vielleicht
         unter die Kennzahlen". Keine eigene Karte mehr - eine schmale Zeile am Fuß der
         Kennzahlen-Karte (_seitZeileHtml, aus _heroKzHtml), dieselbe Liste zum Aufklappen. */
      /* (bis v3317 stand hier die Karte .cp-seit, v2950) */
    })();

    host.classList.add('cp-kz-wrap');
    host.innerHTML = '<div class="cpk" id="dp-kz-card">' + _heroKzHtml(s) + '</div>';
    try { renderZielbild(); } catch (e) { console.warn('[v2950] Bestand & Zielbild', e); }
    try { renderGesamtbew(); } catch (e) { console.warn('[v2951] Gesamtbewertung', e); }
    try { renderEinfach(); } catch (e) { console.warn('[v2951] Einfach', e); }
  }

  /* ── v2950 · Liste zur Karte „Seit dem Kauf" ── */
  var _seitListe = [], _seitOffen = false;
  function toggleSeitAnkauf(){ _seitOffen = !_seitOffen; try{ renderOverview(); }catch(e){} }
  /* v3321 · Zaehlung aus _seitListe (gerechnet nur von DealPilotAnkauf.abweichungFuer) */
  function _seitZahlen(){
    var z = { b:0, g:0, s:0, o:0, n:_seitListe.length };
    _seitListe.forEach(function(x){ if (x.urteil==='besser') z.b++; else if (x.urteil==='gleich') z.g++; else if (x.urteil==='schlechter') z.s++; else z.o++; });
    return z;
  }
  /* v3321 · schmale Zeile „Seit dem Kauf" - Fuß der Kennzahlen-Karte (Genau) und
     Kopfkarte der Ansicht Einfach. Kleiner Balken besser/gleich/schlechter, Klick = Liste. */
  function _seitZeileHtml(mitListe){
    if (!_seitListe.length) return '';
    var z = _seitZahlen(), n = z.n || 1;
    function seg(cls, v){ return v ? '<i class="sz-' + cls + '" style="flex:' + v + ' 1 0"></i>' : ''; }
    return '<div class="cp-sz">'
      + '<button type="button" class="cp-sz-z" onclick="DealPilotDashboard.toggleSeitAnkauf()" aria-expanded="' + (_seitOffen ? 'true' : 'false') + '" title="DealScore heute gegen den Stand beim Kauf – Liste der Objekte ein- oder ausblenden">'
      +   '<span class="cp-sz-t">Seit dem Kauf<small>DealScore heute gegen Ankauf</small></span>'
      +   '<span class="cp-sz-bar" aria-hidden="true">' + seg('b', z.b) + seg('g', z.g) + seg('s', z.s) + seg('o', z.o) + '</span>'
      +   '<span class="cp-sz-w"><b class="pos">' + z.b + '</b> besser · <b>' + z.g + '</b> gleich · <b class="neg">' + z.s + '</b> schlechter</span>'
      +   '<span class="cp-sz-m">' + (_seitOffen ? 'schließen ▴' : 'Objekte ▾') + '</span>'
      + '</button>'
      + (mitListe !== false && _seitOffen ? _seitListeHtml() : '') + '</div>';
  }
  function _objName(o){
    var n = (o && (o._name || o.name || o.kuerzel || o._obj_seq)) || 'Objekt';
    return String(n);
  }
  function _seitListeHtml(){
    var rang = { schlechter: 0, gleich: 1, besser: 2 };
    var L = _seitListe.slice().sort(function(a, b){
      var ra = rang[a.urteil] != null ? rang[a.urteil] : 3, rb = rang[b.urteil] != null ? rang[b.urteil] : 3;
      if (ra !== rb) return ra - rb;
      return ((a.heute||0)-(a.ankauf||0)) - ((b.heute||0)-(b.ankauf||0));
    });
    function sc(v){ return (v==null||!isFinite(v)) ? '–' : String(Math.round(v)); }
    function dat(iso){ return /^\d{4}-\d{2}-\d{2}/.test(iso||'') ? iso.slice(0,10).split('-').reverse().join('.') : ''; }
    var rows = L.map(function(x){
      var d = (x.heute!=null && x.ankauf!=null) ? Math.round(x.heute) - Math.round(x.ankauf) : null;
      var cls = x.urteil === 'besser' ? 'pos' : (x.urteil === 'schlechter' ? 'neg' : 'neu');
      var pf = x.urteil === 'besser' ? '↗' : (x.urteil === 'schlechter' ? '↘' : '→');
      return '<div class="sa-row sa-'+cls+'"><span class="sa-n" title="'+esc(x.name)+'">'+esc(x.name)
        + (x.stichtag ? '<small>Ankauf-Stand '+esc(dat(x.stichtag))+'</small>' : '') + '</span>'
        + '<span class="sa-s">'+sc(x.ankauf)+' <i>'+pf+'</i> '+sc(x.heute)+'</span>'
        + '<span class="sa-d">'+(d==null?'ohne Score':(d>0?'+':d<0?'−':'±')+Math.abs(d)+' Pkt.')+'</span></div>';
    }).join('');
    return '<div class="sa-liste" style="grid-column:1/-1">'
      + '<div class="sa-kopf"><span>Objekt</span><span>DealScore Kauf → heute</span><span>Veränderung</span></div>'
      + rows + '</div>';
  }

  /* ════ v2950/v2951 · BESTAND GEGEN ZIELBILD — DAS GANZE PORTFOLIO ════
     Marcel 25.10.2026: „können wir im Portfolio Cockpit auch den Vergleich
     machen mit Bestand und Zielbild für das gesamte Portfolio mit Auswertung
     darunter? Vielleicht auch eine tolle Grafik dazu." — und in Runde 2:
     „warum gewisse Objekte nicht mit drin sind", „wie wird die Auswertung
     neu berechnet?", „Bestand heute 5,27 Mio – woher kommt das?".

     GERECHNET WIRD HIER NICHTS NEU. Je Objekt liest
     `DpWertZielbild.zielbildFuer(daten)` die Stufen, die potenzial.js beim
     letzten Lauf am Objekt abgelegt hat (Miete, Maßnahmen, Ertragswert aus
     dem Marktbericht-Dienst); `zielbildGrund(daten)` sagt, warum ein Objekt
     fehlt. Hier wird nur SUMMIERT, und Verhältnisse aus diesen Summen. */
  function _fE(v){ if(v==null||!isFinite(v)) return '–'; return (v<0?'−':'')+new Intl.NumberFormat('de-DE').format(Math.round(Math.abs(v)))+' €'; }
  function _fEK(v){ if(v==null||!isFinite(v)) return '–'; var a=Math.abs(v); if(a>=1e6) return (v<0?'−':'')+(a/1e6).toFixed(2).replace('.',',')+' Mio €'; return _fE(v); }
  function _fVZ(v){ if(v==null||!isFinite(v)) return '–'; return (v>0?'+ ':v<0?'− ':'')+_fEK(Math.abs(v)); }
  function _fP(v,d){ if(v==null||!isFinite(v)) return '–'; return (v>=0?'+':'−')+Math.abs(v).toFixed(d==null?1:d).replace('.',',')+' %'; }
  function _fPr(v,d){ if(v==null||!isFinite(v)) return '–'; return v.toFixed(d==null?1:d).replace('.',',')+' %'; }
  function _fDat(iso){ return /^\d{4}-\d{2}-\d{2}/.test(iso||'') ? iso.slice(0,10).split('-').reverse().join('.') : ''; }
  /* dieselbe Mietkette wie aggStats() - als Funktion, damit der Abgleich
     „Kachel 02 gegen Zielbild" dieselbe Zahl liest und keine zweite */
  function _mieteJOf(o){ var m=num(o._kpis_miete_j); if(m>0) return m; return (num(o.nkm)+num(o.ze))*12; }
  /* Vermoegensbilanz heute: Wertansatz Kaufpreis, Restschuld - dieselben
     Helfer, ueber die aggStats() summiert (_kpEuro, _restschuldOf) */
  function _bilanzHeute(arr){
    var objs = arr.map(function(o){
      var w=_kpEuro(o), r=_restschuldOf(o);
      return { name:_objName(o), key:o._key, ort:(o._ort||o.ort||'ohne Ort'), wert:w, rest:r, ek:w-r };
    }).filter(function(x){ return x.wert>0 || x.rest>0; });
    var H = objs.reduce(function(s,x){ s.wert+=x.wert; s.rest+=x.rest; return s; }, {wert:0,rest:0});
    H.ek = H.wert - H.rest; H.objs = objs;
    return H;
  }
  function _zielbildAgg(arr){
    var W = window.DpWertZielbild;
    var A = { n: arr.length, mit: [], ohne: [], nZiel: 0, nMh: 0,
      mieteB: 0, mieteM: 0, mieteZ: 0, kosten: 0, kostenM: 0, kpMit: 0, mieteObjMit: 0,
      ewN: 0, ewB: 0, ewZ: 0, ewKosten: 0, zuw: 0, kpEw: 0, mpiN: 0, mpiB: 0, kpMpi: 0,
      ohneEw: [], hinweise: [], staende: [], unv: [] };
    if (!W || typeof W.zielbildFuer !== 'function') return null;
    arr.forEach(function(o){
      var z = null; try { z = W.zielbildFuer(o); } catch (e) { z = null; }
      var g = null; try { g = W.zielbildGrund ? W.zielbildGrund(o) : null; } catch (e) { g = null; }
      var basis = { name: _objName(o), key: o._key, kp: _kpEuro(o) };
      /* v2987 · Marcel 27.10.2026: „Objekte ohne Zielbild - kann das Zielbild dann die normale Entwicklung
         aus dem Objekt sein, also unverändert? Das muss einfach zu verstehen sein." Hat das Objekt eine Miete,
         zaehlt es jetzt mit: Bestand = Mieterhoehung = Zielbild, keine Massnahmen, kein Wertzuwachs. Ohne
         Miete bleibt es bei „nicht enthalten" mit Grund. */
      if (!z) {
        var _mJ = _mieteJOf(o);
        if (_mJ > 0) {
          A.mieteB += _mJ; A.mieteM += _mJ; A.mieteZ += _mJ; A.kpMit += basis.kp; A.mieteObjMit += _mJ;
          var eU = { name: basis.name, key: o._key, kp: basis.kp, top: 'bestand', mB: _mJ, mM: _mJ, mZ: _mJ, kosten: 0,
            ewB: null, ewZ: null, zuw: null, unveraendert: true, grund: 'Kein Zielbild eingetragen: gerechnet wie heute, Miete unverändert, keine Maßnahmen.' };
          A.unv.push(eU); A.mit.push(eU); return;
        }
        basis.grund = g ? g.text : 'Keine Angaben.'; basis.code = g ? g.code : null; A.ohne.push(basis); return;
      }
      var S = z.stufen, B = S.bestand, M = S.mieterhoehung || B, T = S[z.top];
      if (S.zielbild) A.nZiel++; else A.nMh++;
      A.mieteB += B.miete_jahr || 0; A.mieteM += M.miete_jahr || 0; A.mieteZ += T.miete_jahr || 0;
      A.kosten += T.kosten || 0; A.kostenM += (S.mieterhoehung ? S.mieterhoehung.kosten : 0) || 0;
      A.kpMit += basis.kp; A.mieteObjMit += _mieteJOf(o);
      var zw = z.wertzuwachs_nach_kosten[z.top];
      var e = { name: basis.name, key: o._key, kp: basis.kp, top: z.top, stand: z.stand, mB: B.miete_jahr, mM: M.miete_jahr, mZ: T.miete_jahr,
        kosten: T.kosten || 0, ewB: B.ertragswert, ewZ: T.ertragswert, zuw: zw, gesperrt: z.ertragswert_gesperrt,
        mpiB: B.marktpreisindikation, rndB: B.rnd, rndZ: T.rnd, grund: g ? g.text : null, code: g ? g.code : null,
        /* v3234 · fuer die Objekt-Tabelle (_zbObjTabelle): Soll-Stufe und Herkunft der Spalten, nur gelesen */
        ewM: M.ertragswert, mpiM: M.marktpreisindikation, mpiZ: T.marktpreisindikation, kostenM: (S.mieterhoehung ? S.mieterhoehung.kosten : 0) || 0,
        hatMh: !!S.mieterhoehung, hatZb: !!S.zielbild,
        auf: z.aufteilung || null };   /* v3322 · aufgeteilt: Vergleichswert je Einheit (zielbildFuer) */
      /* v2988 · woher das Zielbild kommt, und ob es von der Investition (san) abweicht */
      try { e.herk = (window.DpPotenzial && DpPotenzial.herkunftAusDaten) ? DpPotenzial.herkunftAusDaten(o) : null; } catch (x) { e.herk = null; }
      if (zw != null && B.ertragswert != null && T.ertragswert != null) {
        A.ewN++; A.ewB += B.ertragswert; A.ewZ += T.ertragswert; A.ewKosten += T.kosten || 0; A.zuw += zw; A.kpEw += basis.kp;
      } else A.ohneEw.push(e);
      if (B.marktpreisindikation != null) { A.mpiN++; A.mpiB += B.marktpreisindikation; A.kpMpi += basis.kp; }
      if (g && g.code === 'nur_mh') A.hinweise.push(e);
      if (z.stand) A.staende.push(z.stand);
      A.mit.push(e);
    });
    A.staende.sort();
    return A;
  }

  /* ── Sprung ins Objekt (Bewertung · Wert & Zielbild) ──
     Der Potenzial-Lauf (POST /marktbericht/potenzial) kostet KEIN Kontingent
     (routes/marktbericht.js: „kein Bericht, kein Kontingent, keine KI"), aber
     er braucht das offene Formular - er rechnet aus den Einheiten im Objekt.
     wert-zielbild.js stoesst ihn beim Oeffnen der Karte selbst an (autoRechnen);
     gespeichert wird er mit dem naechsten Sichern des Objekts. */
  /* v2951 · `neu`: den Lauf erzwingen und das Objekt danach sichern - der Weg,
     den Marcel „immer wieder neu antriggern" will. Kostenlos (s. o.). Der Reiter wird
     ueber seinen Knopf gewaehlt (data-target-sec="s6"), nicht ueber eine Nummer:
     switchTab(6) traf gemessen die Pilot-Analyse. */
  function zumZielbild(key, neu){
    if (!key || typeof window.loadSaved !== 'function') return;
    Promise.resolve(window.loadSaved(key)).then(function(){
      setTimeout(function(){
        try { var t = document.querySelector('nav.tabs .tab[data-target-sec="s6"]'); if (t) t.click(); } catch (e) {}
        setTimeout(function(){ var c = document.getElementById('card-wert-zielbild'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 700);
        if (neu && window.DpPotenzial && typeof DpPotenzial.rechnen === 'function') {
          setTimeout(function(){
            Promise.resolve(DpPotenzial.rechnen({ erzwingen: true })).then(function(){
              if (window._currentObjKey === key && typeof window.saveObj === 'function') { try { window.saveObj(); } catch (e) {} }
              _details = {}; _detailsLoaded = false;   /* das Cockpit liest beim naechsten Oeffnen frisch */
            });
          }, 1800);
        }
      }, 500);
    });
  }

  /* v3227: hier stand _bruecke() - der horizontale Wasserfall (Kaltmiete und
     Ertragswert, v2950). Seit Bestand & Zielbild eine Vergleichstabelle ist,
     ruft ihn niemand mehr; wiederherstellen ueber git (v3219). */

  /* v2951b · Die Auswertung als Saetze - EINE Stelle fuer die Anzeige und fuer die
     Fakten des Portfolio-Piloten (gemessen 25.10.2026: der Pilot ordnete ohne sie
     „13,7 %" den 34.000 € zu und nannte den Mehrwert „Wertzuwachs nach Kosten"). */
  function _zbSaetze(A){
    var E=_fE, VZ=_fVZ, P=_fP, nMit=A.mit.length, mehrM=A.mieteM-A.mieteB, mehrZ=A.mieteZ-A.mieteB;
    var bmyB = A.kpMit > 0 ? A.mieteB / A.kpMit * 100 : null, bmyZ = (A.kpMit + A.kosten) > 0 ? A.mieteZ / (A.kpMit + A.kosten) * 100 : null;
    /* Auswertung: fest formulierte Sätze, nur aus den Summen oben */
    var t = [];
    t.push('Für ' + (nMit - A.unv.length) + ' von ' + A.n + ' Objekten liegen Angaben zu Mieterhöhung oder Zielbild vor (' + A.nZiel + ' mit Zielbild'
      + (A.nMh ? ', ' + A.nMh + ' nur mit Mieterhöhung' : '') + ').'
      + (A.unv.length ? ' ' + A.unv.length + ' weitere zählen unverändert mit ihrer heutigen Miete mit (kein Zielbild eingetragen).' : '')
      + (A.ohne.length ? ' Nicht enthalten: ' + A.ohne.map(function(x){ return x.name; }).join(', ') + ' – die Gründe stehen oben.' : ''));
    t.push('Über diese Objekte steigt die Kaltmiete von ' + E(A.mieteB) + ' auf ' + E(A.mieteZ) + ' im Jahr (' + VZ(mehrZ) + ', ' + P(A.mieteB?mehrZ/A.mieteB*100:null) + ')'
      + (mehrZ > 0 ? '; davon ' + E(mehrM) + ' ohne Mieterwechsel, ' + E(A.mieteZ - A.mieteM) + ' nach Umbau oder Neuvermietung.' : '.'));
    t.push(A.kosten ? 'Eingeplant sind Maßnahmen von ' + E(A.kosten) + (A.kostenM ? ', davon ' + E(A.kostenM) + ' schon für die Mieterhöhung' : '') + '. Die Bruttomietrendite geht damit von ' + _fPr(bmyB,2) + ' auf ' + _fPr(bmyZ,2) + '.'
      : 'Maßnahmen sind keine eingetragen – es steigt nur die Miete.');
    if (A.ewN) {
      t.push('Der Ertragswert steigt über ' + A.ewN + ' Objekt' + (A.ewN===1?'':'e') + ' von ' + E(A.ewB) + ' auf ' + E(A.ewZ)
        + '; nach Abzug der Maßnahmen bleibt ' + (A.zuw >= 0 ? 'ein Wertzuwachs von ' + E(A.zuw) + ' – die Maßnahmen bringen mehr Ertragswert, als sie kosten.'
          : 'ein Minus von ' + E(-A.zuw) + ' – die Maßnahmen kosten mehr, als sie an Ertragswert bringen.'));
      /* v2953b · zweiter Pilot-Lauf las den Abstand als Anteil („21,8 % der Kaufpreise … Überbewertung") -
         der Satz steht jetzt fertig da, mit Richtung in Worten */
      if (A.kpEw) { var _abK = (A.ewB / A.kpEw - 1) * 100;
        t.push('Der Ertragswert im Bestand dieser Objekte liegt ' + _fPr(Math.abs(_abK),1) + (_abK >= 0 ? ' über' : ' unter') + ' ihren Kaufpreisen (' + E(A.ewB) + ' gegen ' + E(A.kpEw) + ')'
          + (_abK >= 0 ? ' – gemessen an den Mieten wurde günstiger gekauft, als die Objekte heute wert sind.' : ' – gemessen an den Mieten wurde teurer gekauft, als die Objekte heute wert sind.')); }
      var mitZ = A.mit.filter(function(e){ return e.zuw != null; }).sort(function(a,b){ return b.zuw - a.zuw; });
      if (mitZ.length > 1 && mitZ[0].zuw > 0) t.push('Den größten Beitrag liefert ' + mitZ[0].name + ' mit ' + VZ(mitZ[0].zuw) + '.');
      var neg = mitZ.filter(function(e){ return e.zuw < 0; });
      if (neg.length) t.push('Bei ' + neg.map(function(e){ return e.name; }).join(', ') + ' kosten die Maßnahmen mehr, als sie an Ertragswert bringen.');
    }

    return t;
  }
  /* ════ v3234 · ZIELBILD JE OBJEKT ALS TABELLE ════
     Vorbild: die Tafel „Ankauf · Bestand · Zielbild" der Pilot-Analyse
     (wert-zielbild.js zielTafel - Kennzahlen als Zeilen, Stufen als Spalten). Im
     Cockpit stehen die Objekte als Zeilen, je Kennzahl die Stufen Bestand · Soll
     (Mieterhoehung) · Zielbild als Spalten, dazu die Abweichung Bestand → Zielbild.
     Alle Werte aus _zielbildAgg (gespeicherter Lauf je Objekt, zielbildFuer); die
     Summenzeile nimmt die Summen von dort - dieselben wie Tabelle oben und Saetze. */
  /* v3248 \u00b7 Ertragswert Soll ueber dieselben Objekte wie A.ewB/A.ewZ (beide Werte da) - bis
     v3247 in der Summenzeile von _zbObjTabelle, jetzt fuer die Zusammenfassung oben. Nur
     addiert, was zielbildFuer() je Objekt gespeichert hat; fehlt es bei einem, kein Wert. */
  function _zbEwSoll(A){
    var mitEw = (A.mit || []).filter(function(e){ return !e.unveraendert && e.zuw != null; });
    if (!mitEw.length || !mitEw.every(function(e){ return e.ewM != null; })) return null;
    return mitEw.reduce(function(t, e){ return t + e.ewM; }, 0);
  }
  function _zbObjTabelle(A){
    var E = _fE, VZ = _fVZ, P = _fP, dat = _fDat;
    function td(v, cls, klein){ return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + v + (klein ? '<small>' + klein + '</small>' : '') + '</td>'; }
    function ton(v){ return v == null ? '' : (v >= 0 ? 'zb-pos' : 'zb-neg'); }
    function abw(z, b){ return (z != null && b != null) ? z - b : null; }
    function pz(z, b){ return (z != null && b) ? (z - b) / b * 100 : null; }
    function rnd(v){ return v != null ? 'RND ' + Math.round(v) + ' J.' : ''; }
    var mit = A.mit.filter(function(e){ return !e.unveraendert; })
      .sort(function(a,b){ return ((b.mZ-b.mB)/(b.mB||1)) - ((a.mZ-a.mB)/(a.mB||1)); });
    var unv = A.unv || [];
    var rows = mit.map(function(e){
      var art = e.top === 'zielbild' ? (e.hatMh ? 'Soll und Zielbild' : 'Zielbild') : 'nur Mieterhöhung';
      var tip = art + (e.stand ? ' · gerechnet am ' + dat(e.stand) : '')
        + (e.herk && e.herk.text ? ' · ' + e.herk.text + (e.herk.san > 0 && e.kosten && Math.abs(e.herk.san - e.kosten) >= 1 ? ' (Investition ' + E(e.herk.san) + ', Zielbild-Maßnahmen ' + E(e.kosten) + ')' : '') : '')
        + (e.ewB != null && e.ewZ === e.ewB && e.mZ > e.mB ? ' · Mehrmiete liegt über der marktüblichen Miete – im Ertragswert nicht angesetzt' : '');
      var dm = abw(e.mZ, e.mB), dw = abw(e.ewZ, e.ewB);
      var ewFehlt = e.ewB == null || e.ewZ == null;
      var ewGrund = e.gesperrt ? 'mit Stufe 3' : 'nicht gerechnet';
      return '<tr title="' + esc(tip) + '">'
        + '<th scope="row">' + esc(e.name) + '<small>' + esc(art) + (e.stand ? ' · ' + esc(dat(e.stand)) : '') + '</small>'
        /* v3322 · Marcel 12.11.2026: aufgeteilt → führend der Vergleichswert je Einheit, der Ertragswert stützt */
        + (e.auf ? '<small class="zb-ot-auf">' + (e.auf.wert != null ? 'aufgeteilt · führend: Vergleichswert je Einheit ' + esc(E(e.auf.wert)) + (e.auf.n ? ' (' + e.auf.n + ' WE' + (e.auf.vollstaendig ? '' : ', unvollständig') + ')' : '') + ' · Ertragswert stützend' : 'aufgeteilt · ' + esc(e.auf.gesperrt)) + '</small>' : '')
        + '</th>'
        + td(E(e.mB))
        + td(E(e.mM), e.hatMh ? '' : 'zb-ot-gl', e.hatMh ? '' : 'wie Bestand')
        + td(E(e.mZ), e.hatZb ? '' : 'zb-ot-gl', e.hatZb ? '' : 'wie Soll')
        + td(VZ(dm), 'zb-ot-abw ' + ton(dm), P(pz(e.mZ, e.mB)))
        + td(e.kosten ? E(e.kosten) : 'keine', '', e.kostenM ? 'davon Soll ' + E(e.kostenM) : '')
        + td(e.ewB != null ? E(e.ewB) : '–', '', rnd(e.rndB))
        + td(e.ewM != null ? E(e.ewM) : '–', e.hatMh ? '' : 'zb-ot-gl', e.hatMh || e.ewM == null ? '' : 'wie Bestand')
        + td(e.ewZ != null ? E(e.ewZ) : '–', '', rnd(e.rndZ))
        + (ewFehlt ? td('–', 'zb-ot-abw', ewGrund) : td(VZ(dw), 'zb-ot-abw ' + ton(dw), P(pz(e.ewZ, e.ewB))))
        + td(e.mpiB != null ? E(e.mpiB) : '–')
        + (e.zuw == null ? td('–', '', ewGrund) : td('<b>' + VZ(e.zuw) + '</b>', ton(e.zuw)))
        + '<td class="zb-ot-akt"><button type="button" class="zb-neu-btn" title="Öffnet das Objekt, rechnet die Ertragswerte je Stufe neu (kostenlos, kein Kontingent) und speichert" onclick="DealPilotDashboard.zumZielbild(\'' + esc(e.key) + '\',true)">neu rechnen ↻</button></td>'
        + '</tr>';
    }).join('');
    if (unv.length) {
      var uS = unv.reduce(function(t, x){ return t + (x.mB || 0); }, 0);
      rows += '<tr class="zb-ot-unv"><th scope="row">Ohne Zielbild · ' + unv.length + ' Objekt' + (unv.length === 1 ? '' : 'e') + '<small>gerechnet wie heute – Liste darunter</small></th>'
        + td(E(uS)) + td(E(uS), 'zb-ot-gl') + td(E(uS), 'zb-ot-gl') + td('±0 €', 'zb-ot-abw')
        + td('keine') + td('–') + td('–') + td('–') + td('–', 'zb-ot-abw') + td('–') + td('–') + '<td></td></tr>';
    }
    /* v3248 \u00b7 Marcel 09.11.2026: \u201eIst das nicht dasselbe? Nicht, dass wir was doppelt drin
       haben." Gemessen: die Summenzeile hier wiederholte die Tabelle darueber (Kaltmiete
       Bestand/Zielbild, Abweichung, Massnahmen, Ertragswert Bestand/Zielbild, Wertzuwachs;
       Kaltmiete Soll stand dort als \u201edavon ohne Mieterwechsel"). Sie ist raus - die Summen
       stehen EINMAL in der Zusammenfassung oben (Spalten Bestand | Soll | Zielbild), auch die
       drei Werte, die nur hier standen (Ertragswert Soll, Marktpreisindikation, Massnahmen der
       Objekte mit Ertragswert). */
    var nMit = A.mit.length;
    return '<div class="zb-ot">'
      + '<div class="zb-ot-t">Je Objekt · Bestand → Soll → Zielbild<em>wie die Tabelle der Pilot-Analyse, für alle Objekte</em></div>'
      + '<div class="zb-ot-scroll"><table class="zb-ot-tab"><thead>'
      +   '<tr class="zb-ot-g"><th rowspan="2" scope="col">Objekt</th><th colspan="4" scope="colgroup">Kaltmiete p. a.</th><th rowspan="2" scope="col">Maßnahmen<small>bis zum Zielbild</small></th>'
      +   '<th colspan="4" scope="colgroup">Ertragswert</th><th rowspan="2" scope="col">Marktpreis&shy;indikation<small>Bestand</small></th><th rowspan="2" scope="col">Wertzuwachs<small>nach Kosten</small></th><th rowspan="2" scope="col"></th></tr>'
      +   '<tr><th scope="col">Bestand</th><th scope="col">Soll</th><th scope="col">Zielbild</th><th scope="col" class="zb-ot-abw">Abw.</th>'
      +   '<th scope="col">Bestand</th><th scope="col">Soll</th><th scope="col">Zielbild</th><th scope="col" class="zb-ot-abw">Abw.</th></tr>'
      + '</thead><tbody>' + rows + '</tbody></table></div>'
      + '<p class="zb-det-satz"><b>Die Summen über alle Objekte stehen oben in der Zusammenfassung.</b> Soll = Mieterhöhung bei gleichen Mietern bis zur Vergleichsmiete. Abw. = Zielbild gegen Bestand. Wertzuwachs = Ertragswert-Plus − Maßnahmen. Ausblick, kein Verkehrswert.</p>'
      + '</div>';
  }

  /* v3227 · Marcel 08.11.2026: „auch den Bestand und das Zielbild [einfacher]?
     Die Einheiten ohne Zielbild angeben, aber kompakter und zum Einblenden.
     Alles im Design und Stil wie im Tab Objekt." Statt Kacheln, zwei
     Bruecken-Grafiken und einer breiten Objektspalte: EINE Vergleichstabelle
     Bestand ↔ Zielbild, darunter die Objekte und die Objekte ohne Zielbild je
     als eingeklappte Liste mit einer Zeile je Objekt. Dieselben Summen aus
     _zielbildAgg(), dieselben Saetze aus _zbSaetze() - nichts neu gerechnet. */
  function renderZielbild(){
    var host = $('dp-zielbild'); if (!host) return;
    if (!_detailsLoaded) { host.innerHTML = '<div class="dp-chart-loading" style="height:60px"><span class="dp-spin"></span>Zielbild wird geladen…</div>'; return; }
    var arr = detailArr();
    var A = _zielbildAgg(arr);
    if (!A) { host.innerHTML = '<div class="zb-leer">Der Vergleich ist gerade nicht verfügbar – Seite neu laden.</div>'; return; }
    var E=_fE, EK=_fEK, VZ=_fVZ, P=_fP, dat=_fDat;
    var nMit = A.mit.length;
    /* aufgeklappte Listen bleiben beim Neuzeichnen offen */
    var offen = {}; [].forEach.call(host.querySelectorAll('details[data-zb]'), function(d){ offen[d.getAttribute('data-zb')] = d.open; });
    function det(id, titel, inhalt, standardOffen){
      var o = (id in offen) ? offen[id] : !!standardOffen;
      return '<details class="cpk-det zb-det" data-zb="' + id + '"' + (o ? ' open' : '') + '><summary>' + titel + '</summary>' + inhalt + '</details>';
    }
    var kopfZahl = '<b>' + A.nZiel + ' von ' + A.n + '</b> mit Zielbild'
      + (A.nMh ? ' · ' + A.nMh + ' nur mit Mieterhöhung' : '')
      + (A.unv.length ? ' · ' + A.unv.length + ' ohne Zielbild' : '')
      + (A.ohne.length ? ' · ' + A.ohne.length + ' ohne Angaben' : '');
    var KZ = (window.DpPotenzial && DpPotenzial.KENNZEICHNUNG) || 'Die Ertragswerte nach Mieterhöhung und im Zielbild sind ein Ausblick, kein Verkehrswert nach § 194 BauGB.';
    var kopf = '<div class="cpk-h"><span class="cpk-ico"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg></span>'
      + '<span>Bestand &amp; Zielbild</span><em title="' + esc(KZ) + '">Potenzialwert · Plan, kein Verkehrswert</em></div>'
      + '<div class="zb-zahl">' + kopfZahl + '</div>';
    function knopf(key, txt){ return key ? '<button type="button" class="zb-btn" onclick="DealPilotDashboard.zumZielbild(\''+esc(key)+'\')">'+(txt||'Im Objekt öffnen')+' ›</button>' : ''; }
    /* v3321 · Marcel 12.11.2026: „Am Markt und Bäckerstraße … Im Objekt öffnen - das verstehe
       ich nicht." Die Objekte „nur Mieterhöhung" (A.hinweise) stehen schon in der Tabelle mit
       genau diesem Vermerk - hier stehen nur noch Objekte, denen wirklich etwas FEHLT. */
    var gruende = A.ohne.concat(A.ohneEw.filter(function(e){ return A.ohne.indexOf(e) < 0; }));
    gruende = gruende.filter(function(x){ return !x.unveraendert; });
    /* Objekte ohne Zielbild: kompakt, eine Zeile je Objekt, eingeklappt */
    var unvHtml = A.unv.length ? det('unv', 'Ohne Zielbild · anzeigen (' + A.unv.length + ')',
        '<p class="zb-det-satz">Gerechnet wie heute: Miete bleibt, keine Maßnahmen. Mit einem Zielbild rechnet das Objekt mit seinem Potenzial.</p>'
        + '<div class="zb-liste">' + A.unv.map(function(x){ return '<div class="zb-zl"><span class="zb-zl-n" title="'+esc(x.name)+'">'+esc(x.name)+'</span><span class="zb-zl-w">'+EK(x.mB)+' / Jahr</span>'+knopf(x.key, 'Zielbild anlegen')+'</div>'; }).join('') + '</div>') : '';
    var gruendeHtml = gruende.length ? '<div class="zb-gr"><div class="zb-gr-t">Fehlt im Vergleich · ' + gruende.length + ' Objekt' + (gruende.length === 1 ? '' : 'e') + '</div>'
      + gruende.map(function(x){ var g = x.grund || (A.ohne.indexOf(x) < 0 ? 'Kein Ertragswert gerechnet – im Objekt unter Bewertung › Wert & Zielbild neu rechnen.' : ''); return '<div class="zb-gr-row"><span class="zb-gr-n">'+esc(x.name)+'</span><span class="zb-gr-g">'+esc(g)+'</span>'+knopf(x.key, 'Objekt öffnen')+'</div>'; }).join('')
      + '</div>' : '';
    var neuSatz = '<p class="zb-det-satz"><b>Neu rechnen:</b> Der Vergleich liest die Berechnungen, die am Objekt gespeichert sind'
      + (A.staende.length ? ' (Stand ' + (A.staende[0] === A.staende[A.staende.length-1] ? dat(A.staende[0]) : dat(A.staende[0]) + ' bis ' + dat(A.staende[A.staende.length-1])) + ')' : '')
      + '. <b>„neu rechnen ↻“</b> an jedem Objekt öffnet es, rechnet die Ertragswerte je Stufe <b>kostenlos</b> neu (kein Kontingent) und speichert; danach das Cockpit wieder öffnen. Dasselbe geschieht im Objekt unter <i>Bewertung › Wert &amp; Zielbild</i>. Kostenpflichtig (ein Kontingent) ist nur ein neuer Marktbericht.</p>';
    if (!nMit) {
      host.innerHTML = '<div class="cpk zb-card">' + kopf
        + '<p class="zb-text">Für keines der ' + A.n + ' Objekte sind Mieterhöhung oder Zielbild erfasst. Eintragen lässt es sich im Objekt im Reiter Objekt, Karte „Mieterhöhung und Zielbild“.</p>'
        + gruendeHtml + unvHtml + det('wie', 'Wie wird gerechnet?', neuSatz) + '</div>';
      return;
    }
    var mehrM = A.mieteM - A.mieteB, mehrZ = A.mieteZ - A.mieteB;
    var bmyB = A.kpMit > 0 ? A.mieteB / A.kpMit * 100 : null, bmyZ = (A.kpMit + A.kosten) > 0 ? A.mieteZ / (A.kpMit + A.kosten) * 100 : null;
    function tonV(v){ return v == null ? '' : (v >= 0 ? ' class="zb-pos"' : ' class="zb-neg"'); }
    /* v3248 \u00b7 DIE Zusammenfassung: Bestand | Soll | Zielbild | Veraenderung (Zielbild gegen
       Bestand). Soll = Stufe Mieterhoehung aus _zielbildAgg (A.mieteM, A.kostenM) - nichts neu
       gerechnet. Die Tabelle je Objekt darunter fuehrt keine eigene Summenzeile mehr. */
    function zeile(l, b, m, z, d, dv, sub){
      return '<tr><th scope="row">' + l + (sub ? '<small>' + sub + '</small>' : '') + '</th><td>' + b + '</td><td>' + m + '</td><td>' + z + '</td><td' + tonV(dv) + '>' + d + '</td></tr>';
    }
    var bmyD = (bmyB != null && bmyZ != null) ? bmyZ - bmyB : null;
    var bmyM = (A.kpMit + A.kostenM) > 0 ? A.mieteM / (A.kpMit + A.kostenM) * 100 : null;
    var ewMs = A.ewN ? _zbEwSoll(A) : null;
    /* v3321 · Marcel 12.11.2026: „Bestand und Zielbild … die Unterrechnung … noch besser
       darstellen" und „Marktpreisindikation … nur Bestand … verstehe ich nicht". Die zwei
       Zeilen „davon …" mit drei Strichen sind in die Zellen gewandert (Schritt je Stufe klein
       unter dem Wert: Soll = + Mieterhoehung, Zielbild = + Umbau/Neuvermietung), dazu oben ein
       Balken „Woher das Plus kommt". Die Zeile Marktpreisindikation ist raus: sie stand nur im
       Bestand (kein Vergleich Bestand → Zielbild) und ueber eine andere Objektmenge als die
       Gesamtbewertung - dort steht sie fuer alle Objekte. Je Objekt bleibt die Spalte. */
    function zelle(v, schritt){ return v + (schritt ? '<small>' + schritt + '</small>' : ''); }
    var ewM0 = ewMs != null ? ewMs : null;
    var tab = '<div class="zb-vgl-scroll"><table class="zb-vgl zb-vgl-4"><thead><tr><th></th><th>Bestand<small>heute</small></th><th>Soll<small>nach Mieterhöhung</small></th><th>Zielbild<small>nach Umbau/Neuvermietung</small></th><th>Veränderung<small>Zielbild − Bestand</small></th></tr></thead><tbody>'
      + zeile('Kaltmiete im Jahr', EK(A.mieteB), zelle(EK(A.mieteM), Math.abs(mehrM) >= 1 ? VZ(mehrM) : ''), zelle(EK(A.mieteZ), Math.abs(A.mieteZ - A.mieteM) >= 1 ? VZ(A.mieteZ - A.mieteM) : ''), VZ(mehrZ) + ' · ' + P(A.mieteB ? mehrZ / A.mieteB * 100 : null), mehrZ, nMit + ' Objekte')
      + zeile('Bruttomietrendite', _fPr(bmyB, 2), _fPr(bmyM, 2), _fPr(bmyZ, 2), bmyD == null ? '–' : (bmyD >= 0 ? '+' : '−') + Math.abs(bmyD).toFixed(2).replace('.', ',') + ' Pkt.', bmyD, 'Miete ÷ (Kaufpreis + Maßnahmen)')
      + zeile('Maßnahmen', '–', A.kostenM ? EK(A.kostenM) : 'keine', A.kosten ? EK(A.kosten) : 'keine', A.kosten ? VZ(-A.kosten) : '–', A.kosten ? -1 : null, 'Kosten bis zur Stufe')
      + (A.ewN ? zeile('Ertragswert', EK(A.ewB), ewM0 != null ? zelle(EK(ewM0), VZ(ewM0 - A.ewB)) : '–', zelle(EK(A.ewZ), ewM0 != null ? VZ(A.ewZ - ewM0) : ''), VZ(A.ewZ - A.ewB) + ' · ' + P(A.ewB ? (A.ewZ - A.ewB) / A.ewB * 100 : null), A.ewZ - A.ewB, A.ewN + ' von ' + A.n + ' Objekten mit Ertragswert')
               + '<tr class="zb-vgl-sum"><th scope="row">Wertzuwachs nach Kosten<small>Ertragswert-Plus − ' + EK(A.ewKosten) + ' Maßnahmen</small></th><td colspan="3"></td><td' + tonV(A.zuw) + '><b>' + VZ(A.zuw) + '</b></td></tr>'
               : zeile('Ertragswert', 'noch keiner', '', '', '–', null, 'je Objekt unter Bewertung rechnen'))
      + '</tbody></table></div>';
    /* Balken: woher das Plus der Kaltmiete kommt (nur aus den Summen oben) */
    var stufM = Math.max(0, mehrM), stufZ = Math.max(0, A.mieteZ - A.mieteM);
    var bruecke = (mehrZ > 0 && (stufM + stufZ) > 0) ? '<div class="zb-wh">'
      + '<div class="zb-wh-t">Woher das Plus von ' + EK(mehrZ) + ' Kaltmiete im Jahr kommt</div>'
      + '<div class="zb-wh-bar">' + (stufM ? '<i class="zb-wh-m" style="flex:' + stufM + ' 1 0"></i>' : '') + (stufZ ? '<i class="zb-wh-z" style="flex:' + stufZ + ' 1 0"></i>' : '') + '</div>'
      + '<div class="zb-wh-l">' + (stufM ? '<span><i class="zb-wh-m"></i>Mieterhöhung bei gleichen Mietern <b>' + VZ(stufM) + '</b></span>' : '')
      + (stufZ ? '<span><i class="zb-wh-z"></i>Umbau oder Neuvermietung <b>' + VZ(stufZ) + '</b></span>' : '') + '</div></div>' : '';

    /* v3234 · Marcel 09.11.2026: „Zielbild-Tabelle wie unter Pilot-Analyse mit der Tabelle,
       nur für alle Objekte … darf gerne noch genauer." Die Tafel der Pilot-Analyse
       (wert-zielbild.js zielTafel: Kaltmiete p. a., Maßnahmen, Ertragswert, Markt-
       preisindikation, Wertzuwachs nach Kosten je Stufe) jetzt als EINE Zeile je Objekt,
       Spalten Bestand · Soll · Zielbild, dazu die Abweichung Bestand → Zielbild und eine
       Summenzeile. Gelesen wird dieselbe Quelle wie dort, nur gespeichert:
       DpWertZielbild.zielbildFuer(o) über _zielbildAgg() - nichts neu gerechnet; die
       Summen sind die von _zielbildAgg (A.mieteB/M/Z, A.kosten, A.ewB/ewZ, A.zuw, A.mpiB). */
    var objTab = _zbObjTabelle(A);

    /* v3321 · „Wie wird gerechnet?" knapp, drei Punkte (Marcel 12.11.2026: „so gut wie möglich
       beschreiben, aber auch nicht zu viel"). Inhalt wie bis v3317, nur kürzer. */
    var wieTxt = '<ul class="zb-wie">'
      + '<li><b>Drei Stände je Objekt</b> aus „Mieterhöhung und Zielbild“: Bestand (heutige Mieten), Soll (gleiche Mieter, Mieterhöhung bis zur Vergleichsmiete), Zielbild (nach Umbau oder Neuvermietung). Hier addiert über alle Objekte.</li>'
      + '<li><b>Ertragswert</b> je Stand nach ImmoWertV aus der Wertermittlung des Objekts – ein Ausblick, kein Verkehrswert. Wertzuwachs nach Kosten = Ertragswert-Plus minus Maßnahmen.'
      + (A.ewN && A.kpEw ? ' Zum Vergleich: diese ' + A.ewN + ' Objekte kosteten ' + EK(A.kpEw) + ', der Ertragswert heute liegt ' + P((A.ewB / A.kpEw - 1) * 100) + ' daneben.' : '') + '</li>'
      + '<li><b>Miete:</b> gerechnet wird nur mit den Wohnungsmieten je Einheit (' + E(A.mieteB) + '); die Kennzahlen oben nehmen Zusatzeinnahmen und Stellplätze mit'
      + (Math.abs(A.mieteObjMit - A.mieteB) >= 1 ? ' (' + E(A.mieteObjMit) + ')' : '') + '. Daher weicht die Bruttomietrendite leicht ab.</li>'
      + '<li><b>Neu rechnen</b>'
      + (A.staende.length ? ' (Stand ' + (A.staende[0] === A.staende[A.staende.length-1] ? dat(A.staende[0]) : dat(A.staende[0]) + ' bis ' + dat(A.staende[A.staende.length-1])) + ')' : '')
      + ': „neu rechnen ↻“ am Objekt rechnet die Ertragswerte kostenlos neu und speichert. Ein Kontingent kostet nur ein neuer Marktbericht.</li></ul>';

    host.innerHTML = '<div class="cpk zb-card">' + kopf
      + bruecke + tab
      + objTab + gruendeHtml + unvHtml
      + det('wie', 'Wie wird gerechnet?', wieTxt)
      /* v3248 \u00b7 Marcel 09.11.2026: \u201eDie Auswertung - also die Gesamtauswertung fuers Portfolio -
         die muss da nicht hin. Die koennten wir im Portfolio-Cockpit erfragen." Der Block
         \u201eAuswertung" (die Saetze aus _zbSaetze und der Knopf \u201eVom Portfolio-Piloten ausfuehrlich
         erklaeren lassen") ist raus. Die Saetze gehen weiter als Fakten an den Piloten
         (_zbPayload); fragen laesst es sich in der Liste \u201ePilot fragen" darunter (portfolio-pilot.js). */
      + '<div class="zb-fuss">' + esc(KZ) + '</div>'
      + '</div>';
  }

  /* ════ v2951 · GESAMTBEWERTUNG — WIE DIE ZAHLEN ZUEINANDER STEHEN ════
     Marcel 25.10.2026: „Bestand heute 5,27 Mio – woher kommt das? … wir haben
     eine Gesamtinvestition mit 8,01 Mio mit Nebenkosten. Da muss eine
     Gesamtbewertung hin. Wie stehen die Zahlen zueinander?"
     Drei Blöcke, alle aus vorhandenen Summen: was investiert wurde
     (aggStats), was es heute in der Bilanz ist (_bilanzHeute), was es nach
     Bewertung ist (Ertragswert/Marktpreisindikation der Potenzial-Läufe) -
     jeweils mit der Objektmenge, über die gerechnet wurde. */
  function _gesamtDaten(arr){
    var s = aggStats(), H = _bilanzHeute(arr), A = _zielbildAgg(arr) || {};
    var nk = arr.reduce(function(t,o){ return t + (_nkEuro(o)||0); }, 0);
    var sonst = s.gi - s.kp - nk;
    return { s: s, H: H, A: A, nk: nk, sonst: sonst, n: arr.length };
  }
  /* v2953 · BEWERTUNG JE OBJEKT. Marcel 25.10.2026: „Ist das wirklich passend
     mit den Kaufpreisen? … hier steht nur acht von zwölf Objekten … es muss
     ersichtlicher sein, wenn Objekte fehlen." Bis v2952 kam der Ertragswert NUR
     aus dem Zielbild-Lauf - ein Objekt ohne Soll-Miete fehlte, auch wenn sein
     Marktbericht einen Ertragswert hat. Jetzt: Zielbild-Lauf, sonst der letzte
     Marktbericht (GET, kein Kontingent). Marktpreisindikation genauso. */
  var _mbHist = {}, _mbHistLaedt = null;
  function _mbHistLaden(arr){
    var fehlt = arr.map(function(o){ return o._key; }).filter(function(k){ return k && !(k in _mbHist); });
    if (!fehlt.length || _mbHistLaedt || !window.Auth || typeof Auth.apiCall !== 'function') return;
    _mbHistLaedt = Promise.all(fehlt.map(function(k){
      return Auth.apiCall('/marktbericht/objects/history?key=' + encodeURIComponent('dp:' + k), { method: 'GET' }).then(function(j){
        var l = null;
        ((j && j.history) || []).forEach(function(h){ if (h && h.market_value != null && (!l || new Date(h.created_at) >= new Date(l.created_at))) l = h; });
        _mbHist[k] = l || false;
      }, function(){ _mbHist[k] = false; });
    })).then(function(){ _mbHistLaedt = null; renderGesamtbew(); _renderHeroKz(); /* v3216 */ try { renderEinfach(); } catch (e) {} /* v3321 */ });
  }
  function _bewertungJeObjekt(arr, A){
    var zb = {}; ((A && A.mit) || []).forEach(function(e){ zb[e.key] = e; });
    return arr.map(function(o){
      var h = _mbHist[o._key] || null, e = zb[o._key] || null;
      var ew = e && e.ewB != null ? e.ewB : (h && num(h.ertragswert_eur) > 0 ? num(h.ertragswert_eur) : null);
      var mpi = e && e.mpiB != null ? e.mpiB : (h && num(h.market_value) > 0 ? num(h.market_value) : null);
      /* v2999 · Vergleichswert auf Gutachterbasis (Vergleichsfaktor/Immobilienrichtwert des Ausschusses) neben der Angebotsindikation */
      var vw = h ? (num(h.irw_vergleichswert_eur) > 0 ? num(h.irw_vergleichswert_eur) : (h.vergleichsfaktor_amtlich && num(h.vergleichswert_eur) > 0 ? num(h.vergleichswert_eur) : null)) : null;
      var grund = null;
      if (ew == null) grund = !(o._key in _mbHist) ? 'wird geladen …'
        : (!h ? 'Noch kein Marktbericht – im Objekt unter Bewertung abrufen.'
          : 'Der Marktbericht weist keinen Ertragswert aus – Stufe 1, oder es fehlt eine Pflichtangabe (z. B. Grundstücksfläche); der Grund steht im Bericht.');
      return { key: o._key, name: _objName(o), kp: _kpEuro(o), ew: ew, mpi: mpi, vw: vw,
        ewQuelle: ew == null ? null : (e && e.ewB != null ? 'Zielbild-Lauf' : 'Marktbericht'),
        stand: h && h.created_at ? _fDat(h.created_at) : '', grund: grund };
    });
  }
  /* v3321 · die Summen des Blocks „Nach Bewertung" als EINE Stelle - fuer die Gesamtbewertung
     (Genau) und die Karte Gesamtbewertung der Ansicht Einfach. Nur addiert. */
  function _bewSummen(BW){
    var mitEw = BW.filter(function(x){ return x.ew != null; }), mitMpi = BW.filter(function(x){ return x.mpi != null; });
    var sum = function(L, f){ return L.reduce(function(t, x){ return t + (x[f] || 0); }, 0); };
    var R = { mitEw: mitEw, mitMpi: mitMpi, ewS: sum(mitEw, 'ew'), kpEwS: sum(mitEw, 'kp'), mpiS: sum(mitMpi, 'mpi'), kpMpiS: sum(mitMpi, 'kp'),
      ohneEw: BW.filter(function(x){ return x.ew == null; }) };
    R.abst = R.kpEwS ? (R.ewS / R.kpEwS - 1) * 100 : null;
    return R;
  }
  function _bewertungTabelle(B){
    var P = function(a, b){ return a != null && b > 0 ? _fP((a / b - 1) * 100) : '–'; };
    var ton = function(a, b){ return a != null && b > 0 ? (a >= b ? ' gb-pos' : ' gb-neg') : ''; };
    var rows = B.map(function(x){
      return '<tr' + (x.ew == null ? ' class="gb-fehlt"' : '') + '><td>' + esc(x.name) + (x.grund ? '<small>' + esc(x.grund)
          + ' <button type="button" class="zb-btn" onclick="DealPilotDashboard.zumZielbild(\'' + esc(x.key) + '\')">Im Objekt öffnen ›</button></small>' : '') + '</td>'
        + '<td>' + _fE(x.kp) + '</td>'
        + '<td>' + (x.mpi != null ? _fE(x.mpi) + '<small class="' + ton(x.mpi, x.kp) + '">' + P(x.mpi, x.kp) + '</small>' : '–') + '</td>'
        + '<td>' + (x.vw != null ? _fE(x.vw) + '<small class="' + ton(x.vw, x.kp) + '">' + P(x.vw, x.kp) + '</small>' : '<small>kein amtl. Faktor</small>') + '</td>'
        + '<td>' + (x.ew != null ? _fE(x.ew) + '<small class="' + ton(x.ew, x.kp) + '">' + P(x.ew, x.kp) + '</small>' : '<b class="gb-neg">fehlt</b>') + '</td>'
        + '<td>' + esc(x.stand || '') + '</td></tr>';
    }).join('');
    /* v3234 · steht jetzt eingeklappt unter „Wie wird gerechnet?" (renderGesamtbew) -
       kein eigenes details mehr, das bei fehlendem Ertragswert von selbst aufging */
    return '<div class="gb-tab"><div class="gb-tab-t">Bewertung je Objekt – Kaufpreis, Marktpreisindikation, Vergleichswert, Ertragswert</div>'
      + '<div class="gb-tab-scroll"><table><thead><tr><th>Objekt</th><th>Kaufpreis</th><th>Marktpreisindikation</th><th>Vergleichswert (amtlich)</th><th>Ertragswert</th><th>Bericht vom</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<p class="cp-erkl">Prozent = Abstand zum Kaufpreis. Marktpreisindikation = Angebotspreise nach Abschlag; Vergleichswert = Vergleichsfaktor bzw. Immobilienrichtwert des Gutachterausschusses aus Kaufpreisen (§ 20, § 24 ImmoWertV), nur wo er vorliegt. Ertragswert aus dem Zielbild-Lauf des Objekts, sonst aus dem letzten Marktbericht. Werte so, wie der Bericht sie ausweist – nichts nachträglich verändert.</p></div>';
  }
  function renderGesamtbew(){
    var host = $('dp-gesamtbew'); if (!host || !_detailsLoaded) return;
    var arr = detailArr(); if (!arr.length) { host.innerHTML = ''; return; }
    _mbHistLaden(arr);
    var G = _gesamtDaten(arr), s = G.s, H = G.H, A = G.A, EK = _fEK;
    var imAnkauf = s.stand && s.stand.modus === 'ankauf';
    /* v3227 · Marcel 08.11.2026: „die Gesamtbewertung einfacher darstellen".
       Dieselben drei Bloecke (investiert · Bilanz heute · nach Bewertung) mit
       denselben Zahlen, aber als schlichte Zeilen in einer Karte wie im Reiter
       Objekt; die Erklaerungen liegen eingeklappt unter „Wie wird gerechnet?" (v3234 mit der Tabelle). */
    function z(l, v, cls, sub){ return '<div class="gb-z'+(cls?' '+cls:'')+'"><span class="gb-l">'+l+(sub?'<small>'+sub+'</small>':'')+'</span><span class="gb-v">'+v+'</span></div>'; }
    var b1 = '<div class="gb-k"><div class="gb-t"><span>1</span>Investiert</div>'
      + z('Kaufpreise', EK(s.kp), '', G.n + ' Objekte')
      + z('+ Nebenkosten', EK(G.nk))
      + (Math.abs(G.sonst) >= 1 ? z('+ Sanierung, Inventar u. a.', EK(G.sonst)) : '')
      + z('= Gesamtinvestition', EK(s.gi), 'gb-sum')
      /* v2951d · gemessen: Darlehen + Eigenkapital geht nicht immer genau auf
         die Gesamtinvestition auf - die Luecke wird genannt statt verschwiegen. */
      + z('Darlehen', EK(s.darl), 'gb-sub') + z('Eigenkapital (laut Objekten)', EK(s.ek), 'gb-sub')
      + (Math.abs(s.gi - s.darl - s.ek) >= 1 ? z((s.gi - s.darl - s.ek > 0 ? 'nicht zugeordnet' : 'mehr finanziert als investiert'), _fE(Math.abs(s.gi - s.darl - s.ek)), 'gb-sub', 'Reiter Finanzierung prüfen') : '')
      + '</div>';
    var b2 = '<div class="gb-k"><div class="gb-t"><span>2</span>Bilanz heute</div>'
      + z('Objektwerte (Kaufpreis)', EK(H.wert), '', H.objs.length + ' Objekte')
      + z('− Restschuld', EK(H.rest))
      + z('= Eigenkapital im Bestand', EK(H.ek), 'gb-sum', 'Quote ' + _fPr(H.wert ? H.ek / H.wert * 100 : null))
      + '</div>';
    /* v2953 · je Objekt: Zielbild-Lauf, sonst Marktbericht (_bewertungJeObjekt) */
    var BW = _bewertungJeObjekt(arr, A);
    var BS = _bewSummen(BW);   /* v3321 */
    var mitEw = BS.mitEw, mitMpi = BS.mitMpi, ewS = BS.ewS, kpEwS = BS.kpEwS, mpiS = BS.mpiS, kpMpiS = BS.kpMpiS, ohneEw = BS.ohneEw, abst = BS.abst;
    var b3 = '<div class="gb-k"><div class="gb-t"><span>3</span>Nach Bewertung</div>'
      + (mitEw.length ? z('Ertragswert', EK(ewS), '', mitEw.length + ' von ' + G.n + ' Objekten')
          + z('Kaufpreise derselben Objekte', EK(kpEwS), 'gb-sub')
          + z('Abstand', '<span class="' + (abst == null ? '' : (abst >= 0 ? 'gb-pos' : 'gb-neg')) + '">' + _fP(abst) + '</span>', 'gb-sum', 'Ertragswert gegen Kaufpreis') : z('Ertragswert', 'noch keiner', '', 'kein Objekt berechnet'))
      + (mitMpi.length ? z('Marktpreisindikation', EK(mpiS), '', mitMpi.length + ' von ' + G.n + ' Objekten') + z('Abstand zu deren Kaufpreisen', _fP(kpMpiS ? (mpiS / kpMpiS - 1) * 100 : null), 'gb-sub') : '')
      + '</div>';
    var fehlt = ohneEw.length ? '<div class="gb-fehlt-box"><b>' + ohneEw.length + ' von ' + G.n + ' Objekten ohne Ertragswert</b> – nicht in der Summe: '
          + ohneEw.map(function(x){ return esc(x.name); }).join(' · ') + '. Die Gründe stehen je Objekt unter „Wie wird gerechnet?“.</div>' : '';
    var _wg = host.querySelector('details.gb-wie'), _wgOffen = !!(_wg && _wg.open);
    /* v3234 · Marcel 09.11.2026: „Bei der Gesamtbewertung darf es gerne unter ‚wie wird
       gerechnet' auch eingeklappt werden." Erklaerung UND die Tabelle „Bewertung je Objekt"
       liegen in einem eingeklappten Block; offen nur, wenn der Nutzer ihn aufgeklappt hat. */
    var wie = '<details class="cpk-det gb-wie"' + (_wgOffen ? ' open' : '') + '><summary>Wie wird gerechnet? · Bewertung je Objekt</summary>'
      /* v3321: knapper, Inhalt unveraendert */
      + '<ul class="zb-wie"><li><b>Investiert:</b> alles, was in die Objekte geflossen ist. Nebenkosten (Grunderwerbsteuer, Notar, Makler) sind bezahlt, aber kein Vermögenswert.</li>'
      + '<li><b>Bilanz heute:</b> Wert minus Restschuld = dein Eigenkapital. Als Wert zählt der Kaufpreis, kein Gutachten.</li>'
      + '<li><b>Nach Bewertung:</b> Ertragswert (aus den Mieten, ImmoWertV) und Marktpreisindikation (Angebotspreise vergleichbarer Objekte minus üblichem Verhandlungsabschlag), je verglichen mit den Kaufpreisen <b>derselben</b> Objekte.</li></ul>' + _bewertungTabelle(BW) + '</details>';
    host.innerHTML = '<div class="cpk gb-wrap"><div class="cpk-h"><span class="cpk-ico"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V9h4v12M13 21V5h4v16"/></svg></span><span>Gesamtbewertung</span><em>Investition · Bilanz · Bewertung</em></div>'
      + (imAnkauf ? '<div class="gb-hin">Kacheln oben im Ankauf-Stand – die Bilanz rechnet mit heute</div>' : '')
      + '<div class="gb-grid">' + b1 + b2 + b3 + '</div>' + fehlt + wie + '</div>';
  }

  /* ════ v2951 · EINFACH | GENAU ════
     Marcel 25.10.2026: „ähnlich wie im Pilot-Analyse-Tab ‚Ankauf · Bestand ·
     Zielbild' – da haben wir einen Umschalter mit Einfach und Genau".
     Vorbild wert-zielbild.js (Merker dp_pa_si_ansicht); hier eigener Merker. */
  var ANSICHT_MERKER = 'dp_cockpit_ansicht';
  function _ansicht(){ try { var v = localStorage.getItem(ANSICHT_MERKER); return v === 'genau' ? 'genau' : 'einfach'; } catch (e) { return 'einfach'; } }
  function ansicht(a, sprung){
    if (a) { try { localStorage.setItem(ANSICHT_MERKER, a); } catch (e) {} }
    var st = $('dp-stage'); if (!st) return;
    var v = _ansicht();
    st.classList.toggle('cp-einfach', v === 'einfach'); st.classList.toggle('cp-genau', v === 'genau');
    [].forEach.call(st.querySelectorAll('.cp-ans-sw button'), function(b){ b.classList.toggle('on', b.getAttribute('data-a') === v); b.setAttribute('aria-pressed', b.getAttribute('data-a') === v ? 'true' : 'false'); });
    if (v === 'genau' && _detailsLoaded) { try { destroyCharts(); buildCharts(); } catch (e) {} try { renderSteuerKette(); } catch (e) {} }   /* v3248: auch die Steuerkette */
    if (sprung) { var z = st.querySelector('.cp-sek[data-sek="' + sprung + '"]'); if (z) { z.classList.remove('cp-zu'); _zuMerken(); setTimeout(function(){ z.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); } }
  }
  /* ════ v3321 · EINFACH MIT ROTEM FADEN ════
     Marcel 12.11.2026: „in der einfachen Ansicht … kompakter, dass da ein roter Faden ist …
     haben wir jetzt ja fast gar nichts mehr drauf … Gesamtbewertung (Investiert, Bilanz,
     Nachbewertung) … die Gegenüberstellung mit Zielbild … seit dem Kauf … mit unterarbeiten."
     Vier nummerierte Karten statt sieben gleich großer Kacheln: 1 Heute · 2 Gesamtbewertung ·
     3 Bestand → Zielbild · 4 Steuer & Ausblick. Gerechnet wird NICHTS neu: aggStats(),
     _bilanzHeute(), _bewertungJeObjekt()/_bewSummen() (dieselben Summen wie die Gesamtbewertung),
     _zielbildAgg(), steuerKette() und projectAll() - die Quellen der Ansicht Genau. */
  function renderEinfach(){
    var host = $('dp-einfach'); if (!host) return;
    if (!_detailsLoaded) { host.innerHTML = '<div class="dp-chart-loading" style="height:60px"><span class="dp-spin"></span>Kernaussagen werden geladen…</div>'; return; }
    var arr = detailArr(); if (!arr.length) { host.innerHTML = '<div class="health-sub">Keine gewonnenen Objekte.</div>'; return; }
    var s = aggStats(), H = _bilanzHeute(arr), A = _zielbildAgg(arr) || { mit: [], unv: [] };
    var PR = []; try { PR = projectAll(_projYears); } catch (e) {}
    var L = PR[PR.length-1] || {};
    _mbHistLaden(arr);
    var BS = _bewSummen(_bewertungJeObjekt(arr, A));
    var EK = _fEK, n = arr.length;
    function karte(nr, titel, sek, inhalt, satz, cls){
      return '<section class="ke2-k' + (cls ? ' ' + cls : '') + '">'
        + '<div class="ke2-h"><span class="ke2-nr">' + nr + '</span><span class="ke2-t">' + titel + '</span>'
        + '<button type="button" class="ke2-mehr" onclick="DealPilotDashboard.ansicht(\'genau\',\'' + sek + '\')">Genau ›</button></div>'
        + inhalt + (satz ? '<p class="ke2-satz">' + satz + '</p>' : '') + '</section>';
    }
    function w(l, v, sub, ton){ return '<div class="ke2-w"><span class="ke2-l">' + l + '</span><span class="ke2-v' + (ton ? ' ke-' + ton : '') + '">' + v + '</span>' + (sub ? '<span class="ke2-s">' + sub + '</span>' : '') + '</div>'; }
    var pfeil = '<span class="ke2-pf" aria-hidden="true">→</span>';
    var sg = function(v){ return (v >= 0 ? '+' : '−') + _fE(Math.abs(v)).replace(/^−/, ''); };

    /* 1 · Heute */
    var k1 = karte(1, 'Heute', 'kennzahlen',
      '<div class="ke2-row ke2-4">'
      + w('Eigenkapital', EK(H.ek), 'Quote ' + _fPr(H.wert ? H.ek / H.wert * 100 : null), H.ek >= 0 ? 'pos' : 'neg')
      + w('Miete im Monat', _fE(s.mieteM), 'Rendite ' + _fPr(s.brutto, 2) + ' brutto')
      + w('Cashflow im Monat', sg(s.cfVsM), 'nach Steuer ' + sg(s.cfNsM), s.cfVsM >= 0 ? 'pos' : 'neg')
      + w('Kapitaldienst gedeckt', s.dscr != null ? s.dscr.toFixed(2).replace('.', ',') + '-fach' : '–', 'DSCR · Miete ÷ Zins und Tilgung')
      + '</div>' + _seitZeileHtml(),
      n + ' Objekte. Nach Bewirtschaftung, Zins und Tilgung bleiben ' + sg(s.cfVsM) + ' im Monat' + (s.cfNsM > s.cfVsM ? ', nach Steuer sogar mehr' : '') + '.', 'ke2-voll');

    /* 2 · Gesamtbewertung */
    var ewTxt = BS.mitEw.length ? EK(BS.ewS) : 'noch keiner';
    var k2 = karte(2, 'Gesamtbewertung', 'kennzahlen',
      '<div class="ke2-row ke2-fluss">'
      + w('Investiert', EK(s.gi), 'mit Nebenkosten')
      + pfeil + w('Dir gehört heute', EK(H.ek), 'Kaufpreise ' + EK(H.wert) + ' − Restschuld ' + EK(H.rest))
      + pfeil + w('Wert nach Ertrag', ewTxt, BS.mitEw.length ? (BS.abst != null ? _fP(BS.abst) + ' zum Kaufpreis' : '') + (BS.mitEw.length < n ? ' · ' + BS.mitEw.length + ' von ' + n + ' Objekten' : '') : 'im Objekt unter Bewertung rechnen', BS.abst == null ? null : (BS.abst >= 0 ? 'pos' : 'neg'))
      + '</div>'
      /* zweite Reihe: woher das Geld kam und der zweite Bewertungsweg (dieselben Zahlen wie Genau) */
      + '<div class="ke2-row ke2-2">' + w('Davon eigenes Geld', EK(s.ek), 'Darlehen ' + EK(s.darl))
      + (BS.mitMpi.length ? w('Wert nach Angeboten', EK(BS.mpiS), (BS.kpMpiS ? _fP((BS.mpiS / BS.kpMpiS - 1) * 100) + ' zum Kaufpreis' : '') + (BS.mitMpi.length < n ? ' · ' + BS.mitMpi.length + ' von ' + n + ' Objekten' : ''), BS.kpMpiS ? (BS.mpiS >= BS.kpMpiS ? 'pos' : 'neg') : null) : w('Restschuld', EK(H.rest), 'offene Darlehen heute'))
      + '</div>',
      BS.mitEw.length && BS.abst != null
        ? 'Gemessen an den Mieten sind ' + (BS.mitEw.length < n ? 'diese ' + BS.mitEw.length + ' Objekte' : 'deine Objekte') + ' ' + _fPr(Math.abs(BS.abst), 1) + (BS.abst >= 0 ? ' mehr wert, als du bezahlt hast.' : ' weniger wert, als du bezahlt hast.')
        : '');

    /* 3 · Bestand → Zielbild */
    var k3;
    var mitPlan = (A.mit || []).length - (A.unv || []).length;
    if (mitPlan > 0) {
      var mz = A.mieteZ - A.mieteB;
      k3 = karte(3, 'Bestand → Zielbild', 'zielbild',
        '<div class="ke2-row ke2-fluss">'
        + w('Kaltmiete heute', EK(A.mieteB), 'im Jahr') + pfeil
        + w('Kaltmiete Zielbild', EK(A.mieteZ), _fVZ(mz) + ' · ' + _fP(A.mieteB ? mz / A.mieteB * 100 : null), mz >= 0 ? 'pos' : 'neg')
        + '</div>'
        + (A.ewN ? '<div class="ke2-row ke2-2">' + w('Maßnahmen', A.kosten ? EK(A.kosten) : 'keine') + w('Wertzuwachs nach Kosten', _fVZ(A.zuw), A.ewN + ' Objekte mit Ertragswert', A.zuw >= 0 ? 'pos' : 'neg') + '</div>' : ''),
        A.nZiel + ' von ' + A.n + ' Objekten mit Zielbild' + (A.nMh ? ', ' + A.nMh + ' nur mit Mieterhöhung' : '') + '.'
          + (A.ewN ? (A.zuw >= 0 ? ' Die Maßnahmen bringen mehr Wert, als sie kosten.' : ' Die Maßnahmen kosten mehr, als sie an Ertragswert bringen.') : '') + ' Ein Ausblick, kein Verkehrswert.');
    } else {
      k3 = karte(3, 'Bestand → Zielbild', 'zielbild', '<div class="ke2-leer">Noch kein Zielbild erfasst.</div>', 'Mieterhöhung und Zielbild trägst du im Objekt unter Bewertung ein – dann steht hier, was dein Bestand kann.');
    }

    /* 4 · Steuer & Ausblick */
    var stW = '', stSatz = '';
    try {
      var _sk = steuerKette(_kettenJahr());
      if (!_sk.geladen) _ketteNachladen();
      if (_sk.geladen && _sk.toepfe.length) {
        var _skS = 0, _skBez = true;
        _sk.toepfe.forEach(function(tp){ if (tp.estPflichtig || tp.satz != null) _skS += tp.summe; else _skBez = false; });
        stW = w('Steuerwirkung ' + _kettenJahr(), (_skS >= 0 ? '+' : '−') + _fE(Math.abs(_skS)), _skS >= 0 ? 'gespart, alle Objekte' : 'Mehrsteuer, alle Objekte', _skS >= 0 ? 'pos' : 'neg');
        stSatz = (_skS >= 0 ? 'Deine Objekte senken deine Steuer' : 'Deine Objekte erhöhen deine Steuer') + ' – aus den Ergebnissen im Reiter Steuer, mit Progression.' + (_skBez ? '' : ' Für eine Gesellschaft fehlt der Steuersatz.');
      } else if (_sk.geladen) {
        stW = w('Steuerwirkung ' + _kettenJahr(), 'noch keine', 'kein Objekt mit Ergebnis');
      }
    } catch (e) {}
    var auW = L.eq != null ? w('Eigenkapital ' + L.yr, EK(L.eq), _fVZ(L.eq - H.ek) + ' in ' + PR.length + ' Jahren', 'gold') : '';
    var k4sek = stW ? 'steuer' : 'projektion';
    var k4 = (stW || auW) ? karte(4, 'Steuer &amp; Ausblick', k4sek,
      '<div class="ke2-row ke2-2">' + stW + auW + '</div>'
      + '<button type="button" class="ke2-link" onclick="DealPilotDashboard.ansicht(\'genau\',\'steuer\')">Steuer-Mappe (PDF für die Anlage V) ›</button>',
      (stSatz ? stSatz + ' ' : '') + (auW ? 'Der Ausblick ist eine Modellrechnung (Wert +2 % im Jahr, Tilgung wie vereinbart), keine Zusage.' : '')) : '';

    host.innerHTML = '<div class="ke2">' + k1 + '<div class="ke2-paar">' + k2 + k3 + '</div>' + k4 + '</div>';
  }

  /* ════ v2951 · ABSCHNITTE EINKLAPPEN ════
     Marcel 25.10.2026: „die geteilten Objekte … in dem gelben Streifen
     komplett einklappen können. Auch bei Steuer über alle Objekte".
     ensureMarkup() fasst jede Überschrift mit ihrem Inhalt in ein
     .cp-sek[data-sek]; ein Klick auf den gelben Streifen klappt es, der
     Zustand steht je Abschnitt im Merker dp_cockpit_zu. */
  var ZU_MERKER = 'dp_cockpit_zu';
  function _zuLesen(){ try { return JSON.parse(localStorage.getItem(ZU_MERKER) || '{}') || {}; } catch (e) { return {}; } }
  function _zuMerken(){
    var st = $('dp-stage'); if (!st) return; var o = {};
    [].forEach.call(st.querySelectorAll('.cp-sek[data-sek]'), function(s){ if (s.classList.contains('cp-zu')) o[s.getAttribute('data-sek')] = 1; });
    try { localStorage.setItem(ZU_MERKER, JSON.stringify(o)); } catch (e) {}
  }
  function _sekGruppieren(app){
    var zu = _zuLesen();
    var kids = [].slice.call(app.children), cur = null;
    kids.forEach(function(el){
      var key = el.getAttribute('data-sek');
      if (key) {
        cur = document.createElement('div');
        cur.className = 'cp-sek' + (zu[key] ? ' cp-zu' : '');
        cur.setAttribute('data-sek', key);
        if (el.getAttribute('data-cp')) cur.setAttribute('data-cp', el.getAttribute('data-cp'));
        app.insertBefore(cur, el); cur.appendChild(el);
        var kopf = el.tagName === 'DETAILS' ? null : el;
        if (kopf) { var c = document.createElement('span'); c.className = 'cp-chev'; c.setAttribute('aria-hidden', 'true'); kopf.appendChild(c); kopf.setAttribute('role', 'button'); kopf.setAttribute('tabindex', '0'); kopf.setAttribute('title', 'Abschnitt ein- oder ausklappen'); }
        return;
      }
      if (el.classList.contains('cp-frei')) { cur = null; return; }
      if (cur) cur.appendChild(el);
    });
    app.addEventListener('click', function(ev){
      var kopf = ev.target.closest && ev.target.closest('.cp-sek > .sl');
      if (!kopf || ev.target.closest('button,select,input,a,label,.cp-objsel,.mand-chips')) return;
      kopf.parentNode.classList.toggle('cp-zu'); _zuMerken();
      if (!kopf.parentNode.classList.contains('cp-zu')) { try { if (kopf.parentNode.getAttribute('data-sek') === 'gesamtproj') { destroyCharts(); buildCharts(); } } catch (e) {} }
    });
    app.addEventListener('keydown', function(ev){
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      var kopf = ev.target.closest && ev.target.closest('.cp-sek > .sl'); if (!kopf || ev.target !== kopf) return;
      ev.preventDefault(); kopf.click();
    });
  }

  /* ════ v2951 · Gesamt-Projektion: Tabelle | Chart ════ */
  var _projAnsicht = 'tabelle';
  function projAnsicht(a){
    _projAnsicht = a === 'chart' ? 'chart' : 'tabelle';
    var p = $('dp-proj-box'); if (!p) return;
    p.classList.toggle('pj-chart-an', _projAnsicht === 'chart');
    [].forEach.call(p.querySelectorAll('.pj-sw button'), function(b){ b.classList.toggle('on', b.getAttribute('data-a') === _projAnsicht); });
    if (_projAnsicht === 'chart') { try { destroyCharts(); buildCharts(); } catch (e) {} }
  }

  /* ════ v2951 · Daten für den Portfolio-Piloten (Bestand & Zielbild) ════
     Alles, was der Pilot erklären soll, FERTIG gerechnet - Summen,
     Differenzen, Prozente in beide Richtungen, je Objekt. Er wertet aus, er
     rechnet nicht (Vorbild lib/ki_text_pruefung.js). */
  function _zbPayload(arr){
    var A = _zielbildAgg(arr), G = _gesamtDaten(arr);
    if (!A) return null;
    function r(v){ return v == null || !isFinite(v) ? null : Math.round(v); }
    function r2(v){ return v == null || !isFinite(v) ? null : Math.round(v * 100) / 100; }
    function r1(v){ return v == null || !isFinite(v) ? null : Math.round(v * 10) / 10; }
    var mehrZ = A.mieteZ - A.mieteB;
    return {
      kennzeichnung: 'Potenzialwert / Plan, kein Verkehrswert. Maßgeblich für den heutigen Wert ist der Ertragswert im Bestand.',
      fakten: _zbSaetze(A),
      massnahmen_teurer_als_wert: A.mit.filter(function(e){ return e.zuw != null && e.zuw < 0; }).map(function(e){ return e.name; }),
      massnahmen_lohnen_sich: A.mit.filter(function(e){ return e.zuw != null && e.zuw > 0; }).map(function(e){ return e.name; }),
      objekte_gesamt: A.n, objekte_mit_angaben: A.mit.length, mit_zielbild: A.nZiel, nur_mieterhoehung: A.nMh,
      objekte_mit_ertragswert: A.ewN,
      kaltmiete_jahr: { bestand: r(A.mieteB), nach_mieterhoehung: r(A.mieteM), zielbild: r(A.mieteZ),
        mehr_durch_mieterhoehung: r(A.mieteM - A.mieteB), mehr_durch_umbau_neuvermietung: r(A.mieteZ - A.mieteM),
        mehr_gesamt: r(mehrZ), mehr_gesamt_prozent: r1(A.mieteB ? mehrZ / A.mieteB * 100 : null),
        mehr_durch_mieterhoehung_prozent: r1(A.mieteB ? (A.mieteM - A.mieteB) / A.mieteB * 100 : null),
        mehr_durch_umbau_neuvermietung_prozent: r1(A.mieteB ? (A.mieteZ - A.mieteM) / A.mieteB * 100 : null) },
      abweichung_objektdaten_grund: 'Die Objektdaten fuehren Kaltmiete plus Zusatzeinnahmen (Stellplaetze u. a.); das Potenzial-Modul rechnet nur die Wohnungsmieten je Einheit.',
      kaltmiete_laut_objektdaten_derselben_objekte: r(A.mieteObjMit),
      kaufpreise_derselben_objekte: r(A.kpMit),
      bruttomietrendite_prozent: { bestand: r2(A.kpMit ? A.mieteB / A.kpMit * 100 : null), zielbild_auf_kaufpreis_plus_massnahmen: r2((A.kpMit + A.kosten) ? A.mieteZ / (A.kpMit + A.kosten) * 100 : null) },
      massnahmen_gesamt: r(A.kosten), massnahmen_fuer_mieterhoehung: r(A.kostenM),
      ertragswert: A.ewN ? { bestand: r(A.ewB), zielbild: r(A.ewZ), mehrwert: r(A.ewZ - A.ewB), massnahmen_dieser_objekte: r(A.ewKosten),
        nach_kosten: r(A.ewB + A.zuw), wertzuwachs_nach_kosten: r(A.zuw),
        kaufpreise_dieser_objekte: r(A.kpEw), ertragswert_bestand_gegen_kaufpreis_prozent: r1(A.kpEw ? (A.ewB / A.kpEw - 1) * 100 : null),
        kaufpreis_gegen_ertragswert_bestand_prozent: r1(A.ewB ? (A.kpEw / A.ewB - 1) * 100 : null) } : null,
      marktpreisindikation_bestand: A.mpiN ? { summe: r(A.mpiB), objekte: A.mpiN, kaufpreise_dieser_objekte: r(A.kpMpi),
        gegen_kaufpreis_prozent: r1(A.kpMpi ? (A.mpiB / A.kpMpi - 1) * 100 : null) } : null,
      laeufe_stand: A.staende.length ? { aeltester: A.staende[0], juengster: A.staende[A.staende.length-1] } : null,
      neu_rechnen: 'Im Objekt unter Bewertung > Wert & Zielbild rechnet DealPilot die Ertragswerte je Stufe kostenlos neu (kein Kontingent); gespeichert wird mit dem Objekt. Ein neuer Marktbericht kostet ein Kontingent.',
      je_objekt: A.mit.map(function(e){ return { name: e.name, id: e.key, hoechste_stufe: e.top, lauf_vom: e.stand,
        kaufpreis: r(e.kp), kaltmiete_bestand: r(e.mB), kaltmiete_zielbild: r(e.mZ), mehr_miete: r(e.mZ - e.mB),
        mehr_miete_prozent: r1(e.mB ? (e.mZ - e.mB) / e.mB * 100 : null), massnahmen: r(e.kosten),
        ertragswert_bestand: r(e.ewB), ertragswert_zielbild: r(e.ewZ), wertzuwachs_nach_kosten: r(e.zuw),
        restnutzungsdauer_bestand: e.rndB, restnutzungsdauer_zielbild: e.rndZ, hinweis: e.grund }; }),
      nicht_enthalten: A.ohne.map(function(x){ return { name: x.name, id: x.key, grund: x.grund }; }),
      ohne_ertragswert: A.ohneEw.map(function(x){ return { name: x.name, grund: x.grund }; }),
      gesamtbewertung: { objekte: G.n, kaufpreise: r(G.s.kp), nebenkosten: r(G.nk), sanierung_inventar_sonstiges: r(G.sonst),
        gesamtinvestition: r(G.s.gi), darlehen_aufgenommen: r(G.s.darl), eigenkapital_eingesetzt: r(G.s.ek),
        objektwerte_wertansatz_kaufpreis: r(G.H.wert), restschuld_heute: r(G.H.rest), eigenkapital_im_bestand: r(G.H.ek),
        eigenkapitalquote_prozent: r1(G.H.wert ? G.H.ek / G.H.wert * 100 : null),
        erklaerung: 'Gesamtinvestition = Kaufpreise + Nebenkosten + Sanierung/Inventar. Die Vermögensbilanz setzt die Objekte mit dem Kaufpreis an (Nebenkosten sind kein Vermögenswert); Eigenkapital im Bestand = Objektwerte - Restschuld. Der Ertragswert gilt nur für die Objekte mit Lauf und wird mit den Kaufpreisen derselben Objekte verglichen.' }
    };
  }
  function pilotZielbild(){
    var P = window.DealPilotPortfolioPilot;
    if (P && typeof P.zielbildErklaeren === 'function') P.zielbildErklaeren();
    var b = document.getElementById('dp-pp'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  /* v3227 · Die Health-Leiste (#dp-health-strip) ist in der Kachelreihe der
     Kennzahlen aufgegangen (_heroKzHtml). renderHealth bleibt als Name, weil
     toggleRoe/toggleZins und applyHalterFilter ihn rufen - er zeichnet die
     Kennzahlen neu. Die Rechnung steht unveraendert in _healthKacheln(). */
  function renderHealth(){ try { _renderHeroKz(); } catch (e) {} }
  /* liefert die Kacheln {l,v,sub,col,click,tip}; null = noch nichts zu zeigen;
     {lock:true} = erst ab Investor-Plan */
  function _healthKacheln(){
    var arr=detailArr();
    if(!_detailsLoaded || !arr.length) return null;
    var P=plan();
    if(!P.full){
      /* W10-lockfix: das SVG hatte KEIN width/height -> im Grid-Container blaehte es
   sich bildschirmfuellend auf. Free-User sahen ein schwarzes Riesen-Schloss
   statt der Upsell-Botschaft. */
      return { lock: true };
    }

    var nowY=new Date().getFullYear();
    var sum=function(f){return arr.reduce(function(s,o){return s+(f(o)||0);},0);};
    var S=aggStats();                 // SSoT: exakt dieselben Zahlen wie die Portfolio-Uebersicht
    var totalKp=S.kp, totalEk=S.ek, totalRest=S.rest;
    var cfNsJ=S.cfNsJ, cfVsJ=S.cfVsJ, cfNsM=S.cfNsM, cfVsM=S.cfVsM;
    var restschuldOf=_restschuldOf;   // eine gemeinsame Restschuld-Funktion
    var roe=totalEk>0?(cfNsJ/totalEk*100):null;
    // Ø-Zins gewichtet nach Restschuld
    var zw=0,zws=0; arr.forEach(function(o){var z=_pct(o.d1z),r=restschuldOf(o)||1; if(z>0){zw+=r;zws+=z*r;}});
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
    var totalDarl=sum(function(o){return num(o.d1)+num(o.d2)+_dwO(o).betrag;});   /* v3215 */
    var tilgFort=(totalDarl>0)?((1-totalRest/totalDarl)*100):null;
    var hasTilg=totalDarl>0;
    // Energie-Substanz (ESG)
    var eMap={A:100,B:88,C:75,D:60,E:45,F:30,G:15,H:0};
    var esgW=0,esgS=0; arr.forEach(function(o){var e=(o.ds2_energie||'').toString().toUpperCase().charAt(0); if(eMap[e]!=null){esgW+=_kpEuro(o);esgS+=eMap[e]*_kpEuro(o);}});
    var esg=esgW>0?esgS/esgW:null;
    var leer=arr.length?sum(function(o){return num(o.leerstand);})/arr.length:null;

    function colByVal(v,good,bad){ if(v==null)return 'var(--dp-card-ch)'; return v>=good?'var(--dp-green-txt)':v>=bad?'var(--dp-gold-txt)':'var(--dp-red-txt)'; }
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
        col:avgZins==null?'var(--dp-card-ch)':(avgZins<=3?'var(--dp-green-txt)':avgZins<=4.5?'var(--dp-gold-txt)':'var(--dp-red-txt)'),
        click:'DealPilotDashboard.toggleZins()',
        tip:'Durchschnittlicher Sollzins aller Finanzierungen, gewichtet nach der jeweiligen Restschuld.\nKlick wechselt zum Zinsbindungs-Risiko.'}),
      /* v2240 \u00b7 Ampel nach den persoenlichen Mindest-Schwellen (DealPilotSchwellen), Einstufung im Kern */
      (function(){
        var sw = window.DealPilotSchwellen ? DealPilotSchwellen.get() : null;
        var k = (S.dscr==null) ? null : (window.Dscr ? Dscr.classify(S.dscr, sw) : (S.dscr>=1.2?'good':S.dscr>=1?'warn':'bad'));
        var ab = sw ? DealPilotSchwellen.fmtDscr(sw.dscrGruen) : '1,20';
        return {l:'DSCR', v:(S.dscr==null?'\u2013':S.dscr.toFixed(2).replace('.',',')), sub:'Kapitaldienstdeckung',
          col:(k==null?'var(--dp-card-ch)':(k==='good'?'var(--dp-green)':k==='warn'?'var(--dp-gold)':'var(--dp-red)')),
          tip:'Schuldendienstdeckungsgrad: Miet\u00fcberschuss im Verh\u00e4ltnis zum Kapitaldienst (Zins + Tilgung). Ab '+ab+' gr\u00fcn (deine Mindest-Schwelle).'};
      })(),
      {l:'Tilgungsfortschritt', v:!hasTilg?'\u2013':Math.max(0,tilgFort).toFixed(2).replace('.',',')+'\u00a0%', sub:'Darlehen getilgt', col:'var(--dp-gold)',
       tip:'Wie viel des urspr\u00fcnglichen Darlehens bereits getilgt wurde.'}
    ];
    /* v3227: die Eigenkapital-Rendite (erste Kachel) steht schon in der
       Kachelreihe (EK-Rendite v./n. St., dieselbe Definition) - hier nur die drei
       Finanzierungs-Kacheln */
    return cards.slice(1);
  }

  /* ════ MODELLPROJEKTION (vereinfacht, klar gelabelt) ════
     Annahmen wie Mockup. NICHT die echte calc.js-Pipeline — daher
     ueberall mit „Modellprojektion" gekennzeichnet. */
  var ASSUMP={mietWg:0.015,bwkWg:0.02,wertWg:0.02,afaRate:0.02,gebAnteil:0.8,zinsApprox:0.035};
  /* ═══ v1397 · DAS zvE DES NUTZERS, NICHT 78.000 ═══════════════════════
   *
   * Hier stand `var ZVE_BASE=78000;` — eine feste Zahl, gegen die die
   * Modellprojektion des Cockpits ihre komplette Steuerwirkung rechnete.
   * Fuer JEDEN Nutzer dieselbe, unabhaengig davon, was im Tab Steuern
   * eingetragen ist.
   *
   * Was das anrichtet: die Steuerwirkung ist die Differenz zweier
   * Tarifberechnungen, und die haengt am Einkommen. Wer 45.000 EUR zvE hat,
   * bekam die Entlastung eines Gutverdieners vorgerechnet; wer 200.000 hat,
   * eine zu niedrige. Der Fehler war unsichtbar, weil die Zahl fuer einen
   * mittleren Fall plausibel aussieht.
   *
   * Das zvE liegt seit jeher im Profil — `DealPilotZvE.getForYear(jahr)`
   * kennt sogar die HISTORIE, also verschiedene Einkommen in verschiedenen
   * Jahren. Genau das braucht eine Projektion ueber fuenfzehn Jahre.
   *
   * Die 78.000 bleiben als letzter Rueckfall, damit die Projektion nicht
   * verschwindet, wenn kein Profil geladen ist. */
  var ZVE_FALLBACK=78000;
  function zveFuer(jahr){
    /* v2891: derselbe zvE-Weg wie Tab Steuern (Steuerzeitraum, letzter
       frueherer, Feld, Ersatz) - bis v2890 las das Cockpit nur das Profil. */
    try{
      if(typeof window._dpZveFuerJahr==='function'){
        var _z=window._dpZveFuerJahr(jahr);
        if(_z && _z.zve>0) return _z.zve;
      }
    }catch(_e0){}
    try{
      if(window.DealPilotZvE){
        if(typeof jahr==='number' && jahr>1900 && typeof DealPilotZvE.getForYear==='function'){
          var a=DealPilotZvE.getForYear(jahr);
          if(typeof a==='number' && a>0) return a;
        }
        if(typeof DealPilotZvE.getCurrent==='function'){
          var b=DealPilotZvE.getCurrent();
          if(typeof b==='number' && b>0) return b;
        }
      }
    }catch(_e){}
    return ZVE_FALLBACK;
  }
  /* ═══ v1361 · EIN TARIF, NICHT ZWEI ═══════════════════════════════════
     Hier stand eine zweite, eigene Fassung des §-32a-Tarifs. Sie ist
     nicht nur ueberfluessig - sie war bereits AUSEINANDERGELAUFEN. Beide
     Fassungen durchgerechnet, Code aus den echten Dateien gelesen:

       Grundfreibetrag   tax.js 11.604   ·   hier 11.784
       Rundung           tax.js floor    ·   hier round

     Die Folge, gemessen an neunzehn Stuetzstellen: bis zu 43 EUR
     Abweichung in der Eingangszone und 1 EUR ueberall dort, wo die
     Rundung kippt. § 32a EStG schreibt ABRUNDUNG vor - `tax.js` macht es
     richtig, diese Fassung nicht.

     Der Betrag ist klein, der strukturelle Fehler nicht: wer den Tarif
     aktualisiert, muss es sonst an zwei Stellen tun, und die zweite
     vergisst man. Genau so ist der Unterschied entstanden.

     CLAUDE.md sagt es unter „Rechenkerne - nie duplizieren". Der Tarif
     kommt jetzt aus `Tax.calcEStG()`; tax.js laedt 110 Zeilen vor dieser
     Datei, ist also immer da. Faellt es doch einmal aus, sagt die Konsole
     es - statt still eine andere Zahl zu rechnen als der Rest der App. */
  /* v2891: die ganze Steuerlast (ESt + Soli + Kirchensteuer, Splitting) aus
     den Steuerangaben - derselbe Kern wie Tab Steuern und calc.js. */
  function estg2026(zve, jahr){
    if (typeof Tax !== 'undefined' && Tax && typeof Tax.steuerLast === 'function') {
      return Tax.steuerLast(zve, jahr).gesamt;
    }
    if (typeof Tax !== 'undefined' && Tax && typeof Tax.calcEStG === 'function') {
      return Tax.calcEStG(zve);
    }
    console.warn('[v1361] Tax.calcEStG fehlt - Modellprojektion ohne Steuertarif');
    return 0;
  }

  function projectAll(years, alleTrotzAuswahl){
    var arr=detailArr(alleTrotzAuswahl); var rows=[]; var cumCf=0;
    /* v1397: `vuvY1` stand hier und las `_kpis_vuv` — ein Feld, das NIRGENDS
       im Frontend gesetzt wird. Die Summe war damit immer 0, und verwendet
       wurde sie ohnehin nie. Ersatzlos entfernt: toter Code, der aussieht,
       als werde hier das steuerliche Ergebnis aggregiert. */
    /* v2891 · U7: DIE STEUERSEITE AUS DEN ECHTEN JAHRESERGEBNISSEN.
       Jedes Objekt hinterlegt beim Rechnen sein steuerliches Ergebnis je Jahr
       (wk_per_year, Tab Steuern). Wo es vorliegt, ersetzt es die Pauschale
       (AfA 2 % auf 80 % des Kaufpreises, Zins 3,5 %); nur wo es fehlt, bleibt
       das Modell. Und die Sphaeren werden getrennt wie in der Steuerkette:
       Privat und GbR (mit Anteil) in die Einkommensteuer, eine GmbH/UG mit
       ihrem Satz auf den Gewinn, Verlust als Vortrag. Bis v2890 floss alles
       in die private Progression. */
    var _snap={};
    try{
      var _alleWk=(window.DealPilotWKAggregator&&DealPilotWKAggregator.getAllObjectsWithWK)?DealPilotWKAggregator.getAllObjectsWithWK():null;
      if(Array.isArray(_alleWk)) _alleWk.forEach(function(w){ if(w&&w.id) _snap[w.id]=w; });
    }catch(_eS){}
    var _kVortrag={};
    for(var i=0;i<years;i++){
      var vuvEst=0, vuvKoerp={};
      /* v1898: `bwkSt` ist die Bewirtschaftung der STEUERZEILE (ohne
         Mietausfallwagnis). `bwk` bleibt die des Cashflows. Ohne getrennt
         erfassten Mietausfall sind beide gleich und die Tabelle rechnet
         bitgleich zu vorher. */
      var yr=2026+i, miete=0,bwk=0,bwkSt=0,zins=0,tilg=0,afa=0,rest=0,wert=0;
      arr.forEach(function(o){
        /* -- v1704b � DIE PROJEKTION RECHNETE IN CENT ----------------
           Hier stand `num(o._kaufpreis)`. Der Kommentar an der SSoT
           weiter oben sagt es ausdruecklich: `o.kp` ist EURO,
           `o._kaufpreis` ist CENT. Da alle Folgewerte aus `kp` abgeleitet
           werden (Miete, Zins, Tilgung, AfA, Restschuld, Wert), stand die
           GANZE Projektion um Faktor 100 zu hoch.

           Gemessen am 29.09.2026 auf Staging, 5 Objekte mit 848.000 EUR
           Kaufpreissumme - die Tabelle zeigte:
             Wert 84.800.000 | Restschuld 70.725.374 | Miete 4.240.000
           Richtig waeren rund 848.000 / 820.000 / 42.400.

           > Aufgefallen ist es erst, weil der Portfolio-Pilot dieselbe
           > Funktion liest und seine Zahlen neben `aggStats()` standen.
           > Eine Zahl allein sieht nie falsch aus; erst die zweite,
           > die dasselbe meint, verraet sie.

           `_kpEuro()` ist die Stelle, die das seit jeher richtig macht -
           genommen wird sie, nicht eine zweite Umrechnung daneben. */
        var kp=_kpEuro(o);
        /* v1704c: dieselbe Mietkette wie `aggStats()`. Hier standen drei
           Feldnamen, die im Frontend NIRGENDS gesetzt werden - es griff
           immer der Notnagel `kp*0.05`. Gemessen: die Projektion rechnete
           mit 42.400 EUR, waehrend das Cockpit daneben 49.980 EUR anzeigte.

           > Zwei Zahlen fuer dieselbe Miete in einer Ansicht. Die eine
           > ist gemessen, die andere geschaetzt - und nichts sagte, welche.
           Der Notnagel bleibt als LETZTER Zweig: wo keine Miete erfasst ist,
           ist eine Modellannahme ehrlicher als eine Null. */
        var mieteJ=num(o._kpis_miete_j)||((num(o.nkm)+num(o.ze))*12)
                 ||num(o.ist_miete_j)||num(o.kaltmiete_j)||num(o.jahresmiete)||kp*0.05;
        /* ═══ v1898 · DIE ZWEITE BEWIRTSCHAFTUNGS-PAUSCHALE ═══════════════
           Hier stand:  num(o.bwk_j) || num(o.bewirtschaftung_j) || mieteJ*0.2

           BEIDE Feldnamen gibt es NIRGENDS. Gemessen am 06.10.2026 ueber die
           API: `bwk_j` 0 von 20 Objekten, `bewirtschaftung_j` 0 von 20, und
           repoweit ist diese Zeile der einzige Treffer. Der Notnagel griff
           also IMMER - wie schon bei der Miete eine Zeile darueber (v1704c),
           dieselbe Falle zweimal in derselben Funktion.

           Was er anrichtete: 20 % der Miete, wo der Objekt-Reiter 16 %
           rechnet. Gemessen im Cockpit Jahr 1: Miete 289.224, BWK 57.845 -
           exakt 289.224 x 0,2. Zwei Zahlen fuer dieselbe Bewirtschaftung in
           einer Anwendung, und die geschaetzte war die sichtbare.

           DIE KETTE, von gemessen nach geschaetzt:
             1. `_kpis_bwk_nul_st_y` / `_kpis_bwk_nul_y` - vom Rechenkern
                gestempelt (storage.js). Steuerzeile und Cashflowzeile
                getrennt, genau wie im Objekt-Reiter.
             2. Profilwert `bwk_anteil_default` (16 %, Marcels Einstellung)
                statt der erfundenen 20. `_dpProfilWert` ist global (main.js).

           `_kpis_bwk_y` steht BEWUSST NICHT in der Kette: das ist die
           GESAMT-BWK inklusive umlagefaehigem Teil. Die von der Miete
           abzuziehen waere doppelt falsch - den Teil zahlt der Mieter.

           ALTBESTAND: kein Objekt trug die neuen Felder am Tag der
           Umstellung (0 von 20 gemessen). Fuer sie gilt Zweig 2, bis sie
           einmal neu gerechnet und gespeichert sind. `Number(null)` ist 0
           und bestaende `isFinite` - darum wird auf ABWESENHEIT geprueft,
           nicht per `||`: eine Bewirtschaftung von 0 ist eine Angabe. */
        var _bwkQuote=(typeof window._dpProfilWert==='function')
          ? (num(window._dpProfilWert('bwk_anteil_default',16))||16)/100 : 0.16;
        function _bwkFeld(k){ var x=o[k]; return (x==null||x==='')?null:(isFinite(num(x))?num(x):null); }
        var _bwkSt=_bwkFeld('_kpis_bwk_nul_st_y');
        var _bwkCf=_bwkFeld('_kpis_bwk_nul_y');
        /* Der Cashflow nimmt den Wagnis-Betrag mit, die Steuer nicht.
           Fehlt die eine Zahl, gilt die andere - lieber die benachbarte
           gemessene als die Quote. */
        var bwkJ   =(_bwkCf!=null)?_bwkCf:((_bwkSt!=null)?_bwkSt:mieteJ*_bwkQuote);
        var bwkStJ =(_bwkSt!=null)?_bwkSt:((_bwkCf!=null)?_bwkCf:mieteJ*_bwkQuote);
        var zinsJ=num(o.zins_j)||(kp*(num(o._kpis_ltv)/100||0.8)*ASSUMP.zinsApprox);
        var tilgJ=num(o.tilg_j)||(kp*(num(o._kpis_ltv)/100||0.8)*0.02);
        /* Auch hier war die Einheit gemischt: der erste Zweig liefert EURO,
           der Fallback rechnete aus dem CENT-Kaufpreis. `_restschuldOf()` ist
           die SSoT und fuehrt beide Wege in Euro. */
        var restschuld=_restschuldOf(o)||kp*(num(o._kpis_ltv)/100||0.8);
        var rate=zinsJ+tilgJ;
        var restStart=Math.max(0,restschuld-tilgJ*i);
        var zinsI=Math.max(0,restStart*ASSUMP.zinsApprox);
        var tilgI=Math.min(restStart,Math.max(0,rate-zinsI));
        miete+=mieteJ*Math.pow(1+ASSUMP.mietWg,i);
        bwk+=bwkJ*Math.pow(1+ASSUMP.bwkWg,i);
        bwkSt+=bwkStJ*Math.pow(1+ASSUMP.bwkWg,i);   /* v1898 */
        zins+=zinsI; tilg+=tilgI; afa+=kp*ASSUMP.gebAnteil*ASSUMP.afaRate;
        /* v2891: steuerliches Ergebnis des Objekts in diesem Jahr */
        var _w=_snap[o._key], _wv=(_w&&_w.wk_per_year)?Number(_w.wk_per_year[String(yr)]):NaN;
        var _vuvO=isFinite(_wv)?_wv:(mieteJ*Math.pow(1+ASSUMP.mietWg,i)-bwkStJ*Math.pow(1+ASSUMP.bwkWg,i)-zinsI-kp*ASSUMP.gebAnteil*ASSUMP.afaRate);
        var _sp=_sphaereVon(o.halter);
        if(_sp==='est'||!_istKoerperschaft(_sp)) vuvEst+=_vuvO*_anteilVon(o.halter);
        else vuvKoerp[_sp]=(vuvKoerp[_sp]||0)+_vuvO;
        rest+=Math.max(0,restStart-tilgI); wert+=kp*Math.pow(1+ASSUMP.wertWg,i);
      });
      var cfVor=miete-bwk-zins-tilg;
      /* v1898: das V+V-Ergebnis zieht `bwkSt` ab, nicht `bwk` - das
         Mietausfallwagnis ist kein Werbungskostenabzug (§ 9 Abs. 1 Satz 1
         EStG verlangt eine Aufwendung). Der Cashflow eine Zeile darueber
         behaelt es. Dieselbe Trennung wie calc.js und tax.js. */
      var vuv=miete-bwkSt-zins-afa;
      /* v1397: zvE des JEWEILIGEN Jahres, nicht ein fester Wert fuers Cockpit. */
      var _zveJ=zveFuer(yr);
      var estgOhne=estg2026(_zveJ, yr);
      var estgMit=estg2026(Math.max(0,_zveJ+vuvEst), yr);
      var steuereffekt=estgOhne-estgMit;
      Object.keys(vuvKoerp).forEach(function(h){
        var e=vuvKoerp[h], vt=_kVortrag[h]||0;
        if(e<0){ _kVortrag[h]=vt-e; return; }
        var gen=Math.min(vt,e); _kVortrag[h]=vt-gen;
        var satz=_halterSatz(h); if(satz>0) steuereffekt-=(e-gen)*satz;
      });
      vuv=vuvEst+Object.keys(vuvKoerp).reduce(function(a,h){return a+vuvKoerp[h];},0);
      var cfNach=cfVor+steuereffekt; cumCf+=cfNach;
      rows.push({yr:yr,miete:miete,bwk:bwk,zins:zins,tilg:tilg,afa:afa,cfVor:cfVor,vuv:vuv,
        zve:_zveJ+vuvEst,estg:estgMit,steuereffekt:steuereffekt,cfNach:cfNach,cumCf:cumCf,rest:rest,wert:wert,eq:wert-rest});
    }
    return rows;
  }

  /* ════ CHARTS (Chart.js, Palette V3) ════ */
  function cssv(n){ var m=$(MOUNT_ID); return m?getComputedStyle(m).getPropertyValue(n).trim():''; }
  function isDark(){ return document.body.classList.contains('dp-theme-dark'); }
  function chartPalette(){
    return isDark()
      ? [_wlc('#C9A84C'),_wlc('#E8C964'),_wlc('#9a7f33'),'#D8D2C7','#F2ECDC','#A89F8E','#6E665A','#8F8576']
      : [_wlc('#C9A84C'),_wlc('#9a7f33'),'#2A2727','#7A7370','#B8B0A4','#5A5350',_wlc('#E0BE7C'),'#9A9390'];
  }
  function destroyCharts(){ _charts.forEach(function(c){try{c.destroy();}catch(e){}}); _charts=[]; }

  function buildCharts(){
    if(typeof Chart==='undefined') return;
    destroyCharts();
    var arr=detailArr();
    var loadingHosts=['dpc-vb-eq','dpc-vb-quellen'];
    if(!_detailsLoaded || !arr.length){
      /* v2951: das Canvas NICHT mehr durch einen Lade-Hinweis ersetzen - ein spaeterer
         buildCharts() faende es sonst nicht wieder (ansicht() baut auch vor dem Laden). */
      void loadingHosts;
      /* v2950: ohne Objekte sagen es auch die HTML-Karten, statt ewig zu laden */
      if(_detailsLoaded) ['dp-vb-bilanz','dp-vb-objekte'].forEach(function(id){ var h=$(id); if(h) h.innerHTML='<div class="health-sub">Keine gewonnenen Objekte mit Daten.</div>'; });
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
    Chart.defaults.plugins.tooltip.borderColor=_wlrgba(.45);
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
    var gridCol = isDark() ? _wlrgba(.10) : 'rgba(122,115,112,.12)';
    // gemeinsame Achsen-Optionen fuer Linien/Bar-Charts
    function axes(opts){
      opts=opts||{};
      return {
        x:{ grid:{color:gridCol,drawBorder:false}, ticks:{color:axisCol,maxRotation:0,autoSkip:true,maxTicksLimit:8} },
        y:{ grid:{color:gridCol,drawBorder:false}, ticks:{color:axisCol,callback:opts.money===false?undefined:function(v){return yfmt(v);}} }
      };
    }
    /* v1736 · Endwert an die Kurve schreiben.
       Ein Verlauf ohne Zahl zwingt zum Zielen mit der Maus - und auf dem
       Handy gibt es keinen Hover. Beschriftet wird nur der LETZTE Punkt
       jeder Reihe: er traegt die Aussage ("wo stehe ich am Ende"), alles
       davor ist Weg dorthin. */
    function _endLabel(){
      return {
        id: 'dpEndLabel',
        afterDatasetsDraw: function (chart) {
          var ctx = chart.ctx;
          ctx.save();
          ctx.font = '600 10px JetBrains Mono, monospace';
          ctx.textBaseline = 'middle';
          chart.data.datasets.forEach(function (ds, di) {
            var meta = chart.getDatasetMeta(di);
            if (!meta || meta.hidden || !meta.data || !meta.data.length) return;
            var pt = meta.data[meta.data.length - 1];
            if (!pt) return;
            var v = ds.data[ds.data.length - 1];
            if (typeof v !== 'number' || !isFinite(v)) return;
            var txt = yfmt(v) + ' €';
            var w = ctx.measureText(txt).width;
            var x = pt.x - w - 7, y = pt.y;
            if (x < chart.chartArea.left + 2) x = chart.chartArea.left + 2;
            if (y < chart.chartArea.top + 8) y = chart.chartArea.top + 8;
            if (y > chart.chartArea.bottom - 8) y = chart.chartArea.bottom - 8;
            ctx.fillStyle = isDark() ? 'rgba(12,11,9,.82)' : 'rgba(255,255,255,.88)';
            ctx.fillRect(x - 4, y - 8, w + 8, 16);
            ctx.fillStyle = ds.borderColor || ds.backgroundColor || axisCol;
            ctx.fillText(txt, x, y);
          });
          ctx.restore();
        }
      };
    }

    function mk(id,cfg){ var cv=$(id); if(!cv)return; cfg.options=cfg.options||{}; cfg.options.responsive=true; cfg.options.maintainAspectRatio=false; cfg.options.devicePixelRatio=2;
      if(cfg.type!=='doughnut' && cfg.type!=='pie'){
        cfg.options.scales=cfg.options.scales||axes(cfg._axesOpts);
        cfg.options.plugins=cfg.options.plugins||{};
        if(!cfg.options.plugins.tooltip) cfg.options.plugins.tooltip=eurTt();
      }
      _charts.push(new Chart(cv,cfg)); }

    /* ══ v2950 · VERMOEGENSBERICHT STATT SIEBEN DIAGRAMMEN ══════════════
       Marcel 25.10.2026: „Die anderen Grafiken unter Projektion und Verlauf
       können raus und setzen dort eher professionelle Grafiken rein, die in
       Richtung Vermögensbilanz gehen und gesamte Portfolio-Auswertung."

       Raus: Cashflow-Verlauf, Vermögens-Schere, Vermögensbilanz (Säulen),
       Mittelverwendung, Wealth-Stacks, Klumpenrisiko, Steuer-Verlauf.
       Die Jahreszahlen dazu stehen weiter in der Tabelle „Gesamt-Projektion".

       Rein, aus DENSELBEN Rechnungen (keine zweite):
         · Kennzahlen-Leiste       heute + Endjahr der Projektion
         · Vermögensbilanz heute   Aktiva je Objekt / Passiva Restschuld + EK
                                   (`_kpEuro`, `_restschuldOf` - die Helfer, über
                                   die auch aggStats() summiert)
         · Eigenkapital-Entwicklung projectAll(): Restschuld + EK = Objektwert
         · Woraus das Vermögen wächst projectAll(): Tilgung, Wertänderung,
                                   Cashflow nach Steuer je Jahr
         · Vermögen nach Objekt    wie die Bilanz, je Objekt + Lage-Anteil
       Wertansatz der Objekte ist - wie in der Projektion seit jeher - der
       Kaufpreis; das steht an jeder Grafik. */
    var EURF = function(v){ return new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(Math.round(v||0)); };
    function MK(v){ if(v==null||!isFinite(v)) return '–'; var a=Math.abs(v), sg=v<0?'−':''; if(a>=1e6) return sg+(a/1e6).toFixed(2).replace('.',',')+' Mio €'; return sg+EURF(a)+' €'; }
    function PZ(v,d){ return (v==null||!isFinite(v)) ? '–' : v.toFixed(d==null?1:d).replace('.',',')+' %'; }
    var GOLD=_wlc('#C9A84C'), GOLD_HI=_wlc('#E8CC7A'), GOLD_LO=_wlc('#b8932f');
    var DEBT = isDark() ? 'rgba(232,226,212,.30)' : 'rgba(42,39,39,.78)';
    var DEBT_FILL = isDark() ? 'rgba(232,226,212,.10)' : 'rgba(42,39,39,.10)';

    /* Objekte heute - dieselben Helfer wie aggStats() */
    var H = _bilanzHeute(arr), objs = H.objs;   /* v2951: ein Helfer fuer Bilanz, Gesamtbewertung, Einfach */
    var last = PR[PR.length-1] || {};
    var cumNach = last.cumCf;

    /* 1) Kennzahlen-Leiste */
    var strip=$('dp-vb-strip');
    if(strip){
      var nJ=PR.length, jEnd=last.yr;
      function kt(l,v,s,ton){ return '<div class="vb-k"><span class="vb-kl">'+l+'</span><span class="vb-kv'+(ton?' vb-'+ton:'')+'">'+v+'</span><span class="vb-ks">'+s+'</span></div>'; }
      strip.innerHTML =
          kt('Objektwerte heute', MK(H.wert), objs.length+' Objekte · Wertansatz Kaufpreis')
        + kt('Restschuld heute', MK(H.rest), 'Beleihung '+PZ(H.wert>0?H.rest/H.wert*100:null)+' vom Wertansatz')
        + kt('Eigenkapital heute', MK(H.ek), 'Quote '+PZ(H.wert>0?H.ek/H.wert*100:null), H.ek>=0?'pos':'neg')
        + kt('Eigenkapital '+jEnd, MK(last.eq), (last.eq!=null?(last.eq-H.ek>=0?'+ ':'− ')+MK(Math.abs(last.eq-H.ek))+' in '+nJ+' Jahren':''), 'gold')
        + kt('Cashflow nach Steuer', MK(cumNach), 'Summe '+(PR[0]?PR[0].yr:'')+'–'+jEnd, cumNach>=0?'pos':'neg');
    }

    /* 2) Vermoegensbilanz heute - T-Konto */
    var bil=$('dp-vb-bilanz');
    if(bil){
      var tot=Math.max(H.wert, H.rest + Math.max(H.ek,0)) || 1;
      var sorted=objs.slice().sort(function(a,b){ return b.wert-a.wert; });
      var tones=[GOLD, GOLD_LO, GOLD_HI];
      var akt = sorted.map(function(x,i){
        var h=x.wert/tot*100; var bg=tones[i%3];
        return '<div class="vb-seg" style="height:'+h.toFixed(3)+'%;background:'+bg+';opacity:'+(1-Math.min(i,6)*0.06).toFixed(2)+'" title="'+esc(x.name)+': '+MK(x.wert)+'"></div>';
      }).join('');
      var restH=H.rest/tot*100, ekH=Math.max(H.ek,0)/tot*100;
      var pas = '<div class="vb-seg vb-seg-ek" style="height:'+ekH.toFixed(3)+'%;background:'+GOLD+'"><span>Eigenkapital</span></div>'
              + '<div class="vb-seg vb-seg-fk" style="height:'+restH.toFixed(3)+'%;background:'+DEBT+'"><span>Restschuld</span></div>';
      var aktList = sorted.map(function(x,i){
        return '<li><i style="background:'+tones[i%3]+';opacity:'+(1-Math.min(i,6)*0.06).toFixed(2)+'"></i><span class="vb-ln">'+esc(x.name)+'</span><span class="vb-lv">'+MK(x.wert)+'</span></li>';
      }).join('');
      bil.innerHTML =
          '<div class="vb-t">'
        +   '<div class="vb-side"><div class="vb-sh"><span>Aktiva</span><b>'+MK(H.wert)+'</b></div>'
        +     '<div class="vb-col">'+akt+'</div>'
        +     '<ul class="vb-list">'+aktList+'</ul></div>'
        +   '<div class="vb-side"><div class="vb-sh"><span>Passiva</span><b>'+MK(H.rest+H.ek)+'</b></div>'
        +     '<div class="vb-col">'+pas+'</div>'
        +     '<ul class="vb-list">'
        +       '<li><i style="background:'+GOLD+'"></i><span class="vb-ln">Eigenkapital</span><span class="vb-lv">'+MK(H.ek)+'</span></li>'
        +       '<li><i style="background:'+DEBT+'"></i><span class="vb-ln">Restschuld (Darlehen)</span><span class="vb-lv">'+MK(H.rest)+'</span></li>'
        +       '<li class="vb-sum"><span class="vb-ln">Eigenkapitalquote</span><span class="vb-lv">'+PZ(H.wert>0?H.ek/H.wert*100:null)+'</span></li>'
        +     '</ul></div>'
        + '</div>'
        + (H.ek<0 ? '<div class="vb-hin">Die Restschuld liegt über dem Wertansatz – das Eigenkapital ist negativ.</div>' : '');
    }

    /* 3) Eigenkapital-Entwicklung: gestapelte Flaeche, Oberkante = Objektwert */
    var _eqAxes = axes(); _eqAxes.y.stacked = true; _eqAxes.y.beginAtZero = true; _eqAxes.y.min = 0;
    /* v2950a: Endwerte als Klartext am rechten Rand - Objektwert oben, EK in der Mitte
       seines Bandes, Restschuld in ihrem. _endLabel() schrieb den EK-Wert an die
       Oberkante (= Objektwert) - gestapelt las sich das wie der falsche Wert. */
    var _eqLabel = { id:'dpVbEqLabel', afterDatasetsDraw:function(chart){
      var c=chart.ctx, y=chart.scales.y, ca=chart.chartArea, L=PR.length-1; if(L<0) return;
      var r=PR[L].rest, e=PR[L].eq, w=r+e;
      var T=[['Objektwert '+yfmt(w)+' \u20ac', y.getPixelForValue(w)-9, axisCol],
             ['EK '+yfmt(e)+' \u20ac', y.getPixelForValue(r+e/2), GOLD_LO],
             ['Restschuld '+yfmt(r)+' \u20ac', y.getPixelForValue(r/2), axisCol]];
      c.save(); c.font='600 10px JetBrains Mono, monospace'; c.textBaseline='middle'; c.textAlign='right';
      T.forEach(function(t){ var yy=Math.max(ca.top+7,Math.min(ca.bottom-7,t[1])); var tw=c.measureText(t[0]).width;
        c.fillStyle=isDark()?'rgba(12,11,9,.82)':'rgba(255,255,255,.88)'; c.fillRect(ca.right-tw-10,yy-8,tw+8,16);
        c.fillStyle=t[2]; c.fillText(t[0],ca.right-6,yy); });
      c.restore(); } };
    mk('dpc-vb-eq',{type:'line',data:{labels:labels,datasets:[
      {label:'Restschuld',data:PR.map(function(r){return Math.round(r.rest);}),borderColor:DEBT,backgroundColor:DEBT_FILL,fill:'origin',tension:.3,pointRadius:0,borderWidth:1.6,stack:'v'},
      {label:'Eigenkapital',data:PR.map(function(r){return Math.round(r.eq);}),borderColor:GOLD,backgroundColor:_wlrgba(.30),fill:'-1',tension:.3,pointRadius:0,borderWidth:2.4,stack:'v'}
    ]},options:{scales:_eqAxes,plugins:{legend:{display:true},tooltip:{callbacks:{
      label:function(c){ return ' '+c.dataset.label+': '+EURF(c.parsed.y)+' €'; },
      footer:function(items){ var s=0; items.forEach(function(i){ s+=i.parsed.y; }); return 'Objektwert: '+EURF(s)+' €'; }
    }}}},plugins:[_eqLabel]});

    /* 4) Woraus das Vermoegen waechst: je Jahr Tilgung + Wertaenderung + CF n. St. */
    var _wAxes = axes(); _wAxes.x.stacked = true; _wAxes.y.stacked = true;
    mk('dpc-vb-quellen',{type:'bar',data:{labels:labels,datasets:[
      {label:'Schuldenabbau (Tilgung)',data:PR.map(function(r){return Math.round(r.tilg);}),backgroundColor:DEBT,stack:'q',borderRadius:2},
      {label:'Wertsteigerung (+2 % p.a.)',data:PR.map(function(r,i){return Math.round(i?r.wert-PR[i-1].wert:0);}),backgroundColor:GOLD,stack:'q',borderRadius:2},
      {label:'Überschuss nach Steuer',data:PR.map(function(r){return Math.round(r.cfNach);}),backgroundColor:GOLD_HI,stack:'q',borderRadius:2}
    ]},options:{scales:_wAxes,plugins:{legend:{display:true},tooltip:{callbacks:{
      label:function(c){ return ' '+c.dataset.label+': '+EURF(c.parsed.y)+' €'; },
      footer:function(items){ var s=0; items.forEach(function(i){ s+=i.parsed.y; }); return 'Zuwachs im Jahr: '+EURF(s)+' €'; }
    }}}}});

    /* 6) v2951 · Gesamt-Projektion als Chart (Marcel: „die Ansicht wechseln und
       ein Chart abbilden, wo mehrere Sachen drin sind"). Dieselben Reihen wie
       die Tabelle (projectAll), zwei Achsen: Fluesse links, Bestaende rechts. */
    if ($('dpc-proj-mix') && _projAnsicht === 'chart') {
      var _mx = axes();
      _mx.y.title = { display:true, text:'Miete · Cashflow (€/Jahr)', color:axisCol, font:{size:10} };
      _mx.y2 = { position:'right', grid:{ drawOnChartArea:false }, ticks:{ color:axisCol, callback:function(v){ return yfmt(v); } },
                 title:{ display:true, text:'Restschuld · Eigenkapital (€)', color:axisCol, font:{size:10} } };
      mk('dpc-proj-mix',{type:'bar',data:{labels:labels,datasets:[
        {type:'bar',label:'Miete',data:PR.map(function(r){return Math.round(r.miete);}),backgroundColor:_wlrgba(.28),borderRadius:2,yAxisID:'y',order:4},
        {type:'line',label:'Cashflow vor Steuer',data:PR.map(function(r){return Math.round(r.cfVor);}),borderColor:'#7A7370',backgroundColor:'#7A7370',pointRadius:0,borderWidth:2,tension:.3,yAxisID:'y',order:1},
        {type:'line',label:'Cashflow nach Steuer',data:PR.map(function(r){return Math.round(r.cfNach);}),borderColor:'#3FA56C',backgroundColor:'#3FA56C',borderDash:[5,4],pointRadius:0,borderWidth:2,tension:.3,yAxisID:'y',order:1},
        {type:'line',label:'Restschuld',data:PR.map(function(r){return Math.round(r.rest);}),borderColor:DEBT,backgroundColor:DEBT,pointRadius:0,borderWidth:2,tension:.3,yAxisID:'y2',order:2},
        {type:'line',label:'Eigenkapital',data:PR.map(function(r){return Math.round(r.eq);}),borderColor:GOLD,backgroundColor:GOLD,pointRadius:0,borderWidth:2.6,tension:.3,yAxisID:'y2',order:2}
      ]},options:{scales:_mx,plugins:{legend:{display:true},tooltip:{callbacks:{label:function(c){ return ' '+c.dataset.label+': '+EURF(c.parsed.y)+' €'; }}}}}});
    }

    /* 5) Vermoegen nach Objekt + Lage */
    var vo=$('dp-vb-objekte');
    if(vo){
      var mx=0; objs.forEach(function(x){ mx=Math.max(mx,x.wert,x.rest); }); mx=mx||1;
      var rows=objs.slice().sort(function(a,b){ return b.wert-a.wert; }).map(function(x){
        var ekP=Math.max(x.ek,0)/mx*100, rsP=Math.min(x.rest,x.wert)/mx*100, ueb=Math.max(x.rest-x.wert,0)/mx*100;
        return '<div class="vb-o"><div class="vb-on" title="'+esc(x.name)+'">'+esc(x.name)+'<small>'+esc(x.ort)+' · '+PZ(H.wert>0?x.wert/H.wert*100:null)+'</small></div>'
          + '<div class="vb-ob"><span style="width:'+rsP.toFixed(2)+'%;background:'+DEBT+'"></span><span style="width:'+ekP.toFixed(2)+'%;background:'+GOLD+'"></span>'
          + (ueb>0?'<span class="vb-ueb" style="width:'+ueb.toFixed(2)+'%"></span>':'')+'</div>'
          + '<div class="vb-ov">'+MK(x.wert)+'<small class="'+(x.ek>=0?'vb-pos':'vb-neg')+'">EK '+MK(x.ek)+'</small></div></div>';
      }).join('');
      var byOrt={}; objs.forEach(function(x){ byOrt[x.ort]=(byOrt[x.ort]||0)+x.wert; });
      var orte=Object.keys(byOrt).sort(function(a,b){ return byOrt[b]-byOrt[a]; });
      var ortBar=orte.map(function(k,i){ var p=H.wert>0?byOrt[k]/H.wert*100:0;
        return '<span title="'+esc(k)+': '+PZ(p)+'" style="width:'+p.toFixed(2)+'%;background:'+[GOLD,GOLD_LO,GOLD_HI,DEBT][i%4]+';opacity:'+(1-Math.floor(i/4)*0.25).toFixed(2)+'"></span>'; }).join('');
      var ortLeg=orte.slice(0,6).map(function(k,i){ return '<li><i style="background:'+[GOLD,GOLD_LO,GOLD_HI,DEBT][i%4]+';opacity:'+(1-Math.floor(i/4)*0.25).toFixed(2)+'"></i>'+esc(k)+' <b>'+PZ(H.wert>0?byOrt[k]/H.wert*100:null,0)+'</b></li>'; }).join('')
        + (orte.length>6?'<li>+ '+(orte.length-6)+' weitere</li>':'');
      var top1=objs.slice().sort(function(a,b){ return b.wert-a.wert; })[0];
      vo.innerHTML='<div class="vb-objs">'+rows+'</div>'
        + '<div class="vb-ort"><div class="vb-ort-t">Verteilung nach Lage · '+orte.length+' Ort'+(orte.length===1?'':'e')+'</div><div class="vb-ort-bar">'+ortBar+'</div><ul class="vb-ort-leg">'+ortLeg+'</ul>'
        + (top1&&H.wert>0?'<div class="vb-hin">Größtes Objekt: '+esc(top1.name)+' mit '+PZ(top1.wert/H.wert*100)+' der Objektwerte; größter Ort: '+esc(orte[0])+' mit '+PZ(byOrt[orte[0]]/H.wert*100)+'.</div>':'')
        + '</div>';
    }
  }


  /* ═══════════════════════════════════════════════════════════════════════
     v1400 · DIE STEUERKETTE ÜBER ALLE OBJEKTE
     ═══════════════════════════════════════════════════════════════════════
     Marcels Auftrag: „ich möchte das du im portfolio cockpit auch die
     gesamt steuer über alle objekte prüfst und auf unser jetziges modell
     anpasst … eine grafik über die progression zu haben und zu sehen
     welches objekt einen um wieviel weiter den steuersatz gesenkt hat."

     WAS DAS VON DER MODELLPROJEKTION UNTERSCHEIDET: `projectAll()` rechnet
     mit pauschalen Annahmen (ASSUMP: Miete +1,5 %, AfA 2 %, Zins 3,5 %).
     DIESE Rechnung nimmt die ECHTEN steuerlichen Ergebnisse, die jedes
     Objekt beim Rechnen selbst hinterlegt hat (`wk_per_year` über den
     WK-Aggregator) — dieselbe Quelle, aus der auch der Tab Steuern seinen
     Bestandssaldo zieht. Deshalb steht sie in einem eigenen Abschnitt und
     NICHT unter „Modellprojektion (vereinfacht)".

     DIE TRENNUNG DER STEUERSPHÄREN (v1400, Marcels Frage „können wir
     sauber trennen?"):

       privat                  Einkommensteuer, § 32a — Progression
       GbR, Einzelunternehmen  ebenfalls Einkommensteuer (transparent),
                               aber als EIGENER Topf geführt
       GmbH, UG                Körperschaftsteuer — PROPORTIONAL, keine
                               Progression, eigene Sphäre

     Eine Kapitalgesellschaft bekommt deshalb keine Treppe, sondern einen
     festen Satz. Ihr Verlust senkt NICHT das private Einkommen — erst eine
     Ausschüttung verbände die beiden, und die steht hier nirgends.        */

  function _kettenJahr() { return new Date().getFullYear(); }

  /** Der Steuersatz eines Halters, oder null wenn er der Einkommensteuer
   *  unterliegt (privat, GbR, Einzelunternehmen). */
  function _halterSatz(id) {
    try {
      if (window.DealPilotMandanten && DealPilotMandanten.effRate) {
        var r = DealPilotMandanten.effRate(id);
        return (r != null && isFinite(r)) ? r : null;
      }
    } catch (e) {}
    return null;
  }
  function _halterName(id) {
    /* v1404: 'est' ist kein Halter, sondern eine Sphaere — der Topf, in dem
       das Privatvermoegen und alle transparenten Gesellschaften gemeinsam
       durch die Progression laufen. Der Name wird unten aus den tatsaechlich
       enthaltenen Haltern gebildet, damit dort nicht "Privat" steht, wenn
       eine GbR mit drinsteckt. */
    if (id === 'est') return 'Einkommensteuer';
    try {
      if (window.DealPilotMandanten && DealPilotMandanten.get) {
        var m = DealPilotMandanten.get(id);
        if (m && m.name) return m.name;
      }
    } catch (e) {}
    return id === 'privat' ? 'Privat' : id;
  }

  /* v1404 · Sphaere und Anteil — beide aus mandanten.js, nicht nachgebaut.
     Faellt das Modul aus, gilt der Halter selbst als Sphaere und der Anteil
     als voll: dann wird eher zu fein getrennt als vermischt. */
  function _sphaereVon(h) {
    try {
      if (window.DealPilotMandanten && DealPilotMandanten.sphaere) {
        return DealPilotMandanten.sphaere(h || 'privat');
      }
    } catch (e) {}
    return String(h || 'privat');
  }
  function _anteilVon(h) {
    try {
      if (window.DealPilotMandanten && DealPilotMandanten.anteil) {
        var a = DealPilotMandanten.anteil(h || 'privat');
        return (typeof a === 'number' && isFinite(a) && a > 0) ? a : 1;
      }
    } catch (e) {}
    return 1;
  }

  function _istKoerperschaft(h) {
    try {
      if (window.DealPilotMandanten && DealPilotMandanten.istKoerperschaft) {
        return !!DealPilotMandanten.istKoerperschaft(h);
      }
    } catch (e) {}
    return false;
  }

  /** Wie der ESt-Topf heisst. „Privat" steht nur davor, wenn wirklich
   *  privates Vermoegen darin liegt — sonst hiess der Topf einer reinen
   *  GbR faelschlich „Privat + …". Auch das kam aus der Pruefstrecke. */
  function _estTopfName(liste) {
    var privatDrin = false, namen = [];
    (liste || []).forEach(function (o) {
      var h = String((o && o.halter) || 'privat');
      if (h === 'privat') { privatDrin = true; return; }
      var n = _halterName(h);
      if (namen.indexOf(n) < 0) namen.push(n);
    });
    if (!namen.length) return 'Privat';
    return (privatDrin ? 'Privat + ' : '') + namen.join(' + ');
  }

  /**
   * Die Kette je Halter.
   * @returns {{toepfe:Array, geladen:boolean}}
   *   toepfe[] = { halter, name, estPflichtig, satz, zve, schritte[], summe }
   *   schritte[] = { id, name, datum, erg, basisVor, basisNach,
   *                  wirkung, satzVor, satzNach }
   */
  function steuerKette(jahr) {
    var erg = { toepfe: [], geladen: false };
    if (!window.DealPilotWKAggregator) return erg;
    var alle;
    try { alle = DealPilotWKAggregator.getAllObjectsWithWK(); } catch (e) { return erg; }
    if (!Array.isArray(alle)) return erg;
    /* v3248 \u00b7 Marcel 09.11.2026: \u201eIrgendwie ist die Steuer ueber alle Objekte raus."
       Gemessen: getAllObjectsWithWK() (wk-aggregator.js) gibt [] zurueck, solange NIEMAND
       loadAll() gerufen hat - nicht null. Bis v3247 galt [] hier als \u201egeladen, leer": der
       Abschnitt zeigte \u201eNoch keine gespeicherten Bestandsobjekte \u2026" und lud nie nach
       (_ketteNachladen lief nur bei !geladen). Gefuellt war er nur, wenn vorher calc.js
       (offenes Objekt, Reiter Steuern) den Aggregator geladen hatte. Jetzt: leer und noch
       nicht nachgeladen = noch nicht geladen. */
    if (!alle.length && !_ketteNachgeladen) return erg;
    erg.geladen = true;
    if (!alle.length) return erg;

    var y = (typeof jahr === 'number' && jahr > 1900) ? jahr : _kettenJahr();
    var yk = String(y);

    /* Nach Halter gruppieren. Fehlt die Angabe, gilt `privat` — so liefert
       es auch das Backend. */
    /* ═══ v1404 · GRUPPIERT WIRD NACH SPHAERE, NICHT NACH HALTER ══════════
       Bis v1403 bekam jeder Halter einen eigenen Topf. Fuer GmbH und UG ist
       das richtig — fuer die GbR nicht: sie zahlt keine Einkommensteuer, ihr
       Ergebnis fliesst beim Gesellschafter in DASSELBE zvE wie das
       Privatvermoegen. Zwei Toepfe hiessen zweimal dieselbe Progression von
       vorn, und das waren an einem Beispiel 9,6 Prozent zu viel.

       `sphaere()` und `anteil()` liegen in mandanten.js — dort, wo die
       Rechtsformen stehen. Hier wird nur gefragt. */
    var gruppen = {};
    alle.forEach(function (o) {
      if (!o || !o.id) return;
      var sp = _sphaereVon(o.halter);
      (gruppen[sp] = gruppen[sp] || []).push(o);
    });

    Object.keys(gruppen).forEach(function (h) {
      /* Bei 'est' steht kein Halter hinter dem Schluessel — der Satz kommt
         dann aus keinem Mandanten, und genau das ist gemeint: Progression. */
      /* ═══ v1404b · DIE RECHTSFORM ENTSCHEIDET DAS REGIME, NICHT DER TARIF
         Hier stand `estPflichtig = (satz == null)`. Das ging solange gut, wie
         `effRate()` immer einen Satz lieferte — sie liefert aber `null`, wenn
         KEIN PRO-ABO vorliegt (v806). Damit rutschte eine GmbH in die
         Einkommensteuer-Progression des Nutzers, und der Topf hiess auch noch
         "Privat + GmbH". Gefunden von der Pruefstrecke, nicht beim Bauen.
         Jetzt: die Rechtsform sagt, WELCHE Steuer gilt; der Tarif sagt nur,
         ob wir ihn beziffern koennen. Fehlt er, steht der Topf trotzdem als
         Koerperschaft da — nur ohne Betrag. */
      var istKoerp = (h !== 'est') && _istKoerperschaft(h);
      var satz = istKoerp ? _halterSatz(h) : null;
      var estPflichtig = !istKoerp;
      var liste = gruppen[h].slice().sort(function (a, b) {
        var _d = String(a.purchase_date || '9999').localeCompare(String(b.purchase_date || '9999'));
        /* v2891: bei gleichem Kaufdatum die Anlage-Reihenfolge, wie im Tab Steuern */
        return _d || ((a.rang == null ? 1e9 : a.rang) - (b.rang == null ? 1e9 : b.rang));
      });

      var topf = { halter: h, name: estPflichtig ? _estTopfName(liste) : _halterName(h), estPflichtig: estPflichtig,
                   satz: satz, zve: 0, schritte: [], summe: 0, ohne: [] };   /* v3321: ohne = Objekte ohne Ergebnis im Jahr */

      if (estPflichtig) {
        topf.zve = zveFuer(y);
        var basis = topf.zve;
        liste.forEach(function (o) {
          /* v1404: nur DEIN Anteil. Bei einer GbR mit 50 Prozent zaehlt ein
             Verlust von 20.000 bei dir mit 10.000. Privat liefert immer 1. */
          var v = ((o.wk_per_year && Number(o.wk_per_year[yk])) || 0) * _anteilVon(o.halter);
          if (!v) { topf.ohne.push(o.address || 'Objekt'); return; }   /* kein Ergebnis in diesem Jahr - v3321: genannt statt verschwiegen */
          var vor = Math.max(0, basis);
          var nach = Math.max(0, basis + v);
          var wirkung = estg2026(vor, y) - estg2026(nach, y);
          topf.schritte.push({
            id: o.id, name: o.address || 'Objekt',
            datum: (o.purchase_date || '').substring(0, 10),
            erg: v, basisVor: vor, basisNach: nach, wirkung: wirkung,
            satzVor: _grenzsatz(vor), satzNach: _grenzsatz(nach)
          });
          topf.summe += wirkung;
          basis = basis + v;
        });
      } else {
        /* Kapitalgesellschaft: proportional, keine Treppe. Und KEINE
           Erstattung bei Verlust — dieselbe Regel wie in calc.js (_mtx). */
        var basisK = 0;
        liste.forEach(function (o) {
          var v = (o.wk_per_year && Number(o.wk_per_year[yk])) || 0;
          if (!v) { topf.ohne.push(o.address || 'Objekt'); return; }   /* v3321 */
          basisK += v;
          topf.schritte.push({
            id: o.id, name: o.address || 'Objekt',
            datum: (o.purchase_date || '').substring(0, 10),
            /* ═══ v1400b · KEINE STEUERWIRKUNG JE OBJEKT IN EINER GESELLSCHAFT
               Beim Prueflauf aufgefallen, und es war mein eigener Denkfehler:
               ich hatte hier `-(v * satz)` stehen, also eine Wirkung je Objekt.
               Das geht nur auf, solange das Gesamtergebnis positiv ist. Macht
               die Gesellschaft insgesamt Verlust, zeigte jede Zeile eine
               "Ersparnis" — die Summe darunter aber 0. Zwei Zahlen, die sich
               widersprechen, und die falsche sieht plausibler aus.
               Fachlich ist es eindeutig: die Koerperschaftsteuer steht auf dem
               ERGEBNIS DER GESELLSCHAFT, nicht auf einem einzelnen Objekt. Ein
               Objekt hat dort kein eigenes zvE, das man verschieben koennte.
               Deshalb `null` — die Tabelle zeigt dann einen Strich. */
            erg: v, basisVor: null, basisNach: null,
            wirkung: null, satzVor: satz, satzNach: satz
          });
        });
        /* Die Steuer der Gesellschaft steht auf dem GESAMTergebnis, nicht
           je Objekt — nur ein Gewinn wird besteuert. */
        topf.summe = (basisK > 0) ? -(basisK * satz) : 0;
        topf.gesamtergebnis = basisK;
      }
      if (topf.schritte.length) erg.toepfe.push(topf);
    });

    /* Privat zuerst, dann nach Zahl der Objekte. */
    erg.toepfe.sort(function (a, b) {
      if (a.halter === 'privat') return -1;
      if (b.halter === 'privat') return 1;
      return b.schritte.length - a.schritte.length;
    });
    return erg;
  }

  /* Der Grenzsteuersatz aus tax.js — EIN Tarif, nicht zwei (v1361). */
  function _grenzsatz(zve) {
    try {
      if (typeof Tax !== 'undefined' && Tax && typeof Tax.grenzsatzGesamt === 'function') {
        var r = Tax.grenzsatzGesamt(Math.max(0, zve));   /* v2891: inkl. Soli/Kirchensteuer */
        return (isFinite(r) ? r : 0) * 100;
      }
    } catch (e) {}
    return 0;
  }

  /* Einmal nachladen, wenn der Aggregator noch nichts hat — derselbe
     Merker-Gedanke wie in calc.js v1398: genau ein Anlauf, keine Schleife. */
  /* v3248 · _ketteNachgeladen heisst jetzt: der eine Anlauf ist FERTIG (auch erfolglos) -
     erst dann gilt eine leere Liste in steuerKette() als „wirklich leer". _ketteLaeuft
     verhindert den zweiten Anlauf waehrend des ersten. */
  var _ketteNachgeladen = false, _ketteLaeuft = false;
  function _ketteNachladen() {
    if (_ketteNachgeladen || _ketteLaeuft) return;
    if (!window.DealPilotWKAggregator || typeof DealPilotWKAggregator.loadAll !== 'function') { _ketteNachgeladen = true; return; }
    _ketteLaeuft = true;
    var fertig = function () {
      _ketteLaeuft = false; _ketteNachgeladen = true;
      setTimeout(function () { try { renderSteuerKette(); } catch (e) {} try { renderEinfach(); } catch (e) {} }, 120);
    };
    DealPilotWKAggregator.loadAll(false).then(fertig, fertig);
  }

  /* ═══ v1400 · Die Steuerkette zeichnen ═══════════════════════════════════
     Zwei Darstellungen, weil sie zwei Fragen beantworten:
       die GRAFIK  — wie weit sinkt der Satz, Objekt für Objekt
       die TABELLE — welches Objekt genau, mit welchem Ergebnis
     Beide aus derselben Rechnung; keine Zahl wird zweimal ermittelt.    */
  /* ═══ v1405 · DIE PROGRESSIONSKURVE ══════════════════════════════════════
     Marcels Bild: „die Progressionskurve, das sind ja mehrere lineare
     Gleichungen, die aneinandergesetzt sind, wo du dann den Grenzsteuersatz
     auf der linken Seite hast und dann könnte man dort die Punkte setzen,
     wie weit das runtergegangen ist."

     Genau das. Die X-Achse ist das zu versteuernde Einkommen, die Y-Achse der
     Grenzsteuersatz, und auf der Kurve sitzt je ein Punkt für jedes Objekt —
     dort, wo es dich hingeschoben hat. Die Balkenansicht bleibt daneben; die
     eine zeigt den BETRAG je Objekt, die andere den WEG auf der Kurve.

     GERECHNET WIRD NICHT HIER. Jeder Punkt der Kurve kommt aus
     `Tax.calcGrenzsteuersatz()` — derselbe Kern, der auch die Steuerwirkung
     rechnet. Ein zweiter Tarif in dieser Datei wäre genau der Fehler, den
     v1361 aufgeräumt hat.

     DIE KNICKE STEHEN IM TARIF, nicht in der Zeichnung: Grundfreibetrag,
     Ende der ersten und zweiten Progressionszone, Beginn der
     „Reichensteuer". Sie werden als Stützstellen ausdrücklich mitgenommen,
     damit die Kurve dort wirklich knickt und nicht rundgeschliffen wird. */
  var _ketteAnsicht = 'stufen';   /* 'stufen' | 'kurve' */

  /* Die Eckwerte des Tarifs — aus tax.js, nicht aus dem Gedächtnis. */
  function _tarifEcken(jahr) {
    try {
      if (typeof Tax !== 'undefined' && Tax && typeof Tax.tarifInfo === 'function') {
        var t = Tax.tarifInfo(jahr);
        if (t && t.grundfreibetrag) {
          var z = t.zonen || {};
          return [t.grundfreibetrag, z.z2bis, z.z3bis, z.z4bis]
            .filter(function (v) { return typeof v === 'number' && v > 0; });
        }
      }
    } catch (e) {}
    /* Rückfall: die Zonengrenzen 2026. Sie stehen hier NUR, damit die Kurve
       auch dann knickt, wenn tarifInfo() fehlt — gerechnet wird weiterhin
       ausschliesslich mit Tax.calcGrenzsteuersatz(). */
    return [12348, 17799, 69878, 277825];
  }

  /** Stützstellen für die Kurve: gleichmäßig plus die Knicke, sortiert. */
  function _kurvenStuetzen(maxX, jahr) {
    var ecken = _tarifEcken(jahr);
    var pts = [];
    var n = 90;
    for (var i = 0; i <= n; i++) pts.push(Math.round(maxX * i / n));
    ecken.forEach(function (e) {
      if (e <= maxX) { pts.push(e - 1); pts.push(e); pts.push(e + 1); }
    });
    pts = pts.filter(function (v) { return v >= 0 && v <= maxX; });
    pts.sort(function (a, b) { return a - b; });
    /* Dubletten raus — sonst zeichnet Chart.js Punkte doppelt. */
    var out = [];
    for (var j = 0; j < pts.length; j++) if (j === 0 || pts[j] !== pts[j - 1]) out.push(pts[j]);
    return out;
  }

  function _kurveBauen(cv, t, SER, axisCol, gridCol, eur, pz) {
    var jahr = _kettenJahr();
    var letzter = t.schritte[t.schritte.length - 1];
    /* Die Kurve reicht ein Stück über das Ausgangs-zvE hinaus, damit der
       Startpunkt nicht am rechten Rand klebt. */
    var maxX = Math.max(t.zve * 1.25, (letzter ? letzter.basisNach : 0) * 1.25, 30000);
    /* v3321 · Marcel 12.11.2026: „Progressionskurve … aussagekräftig?" Gemessen: die Punkte
       lagen alle zwischen 67k und 95k € auf einer Achse von 0 bis 113k - acht Punkte auf
       einem Viertel der Breite, übereinander. Die Achse zeigt jetzt den Bereich, in dem
       sich deine Objekte bewegen (mit Rand), die Punkte tragen die Nummer der Tabelle. */
    var _xs = [t.zve].concat(t.schritte.map(function (s) { return s.basisNach; }));
    var _lo = Math.min.apply(null, _xs), _hi = Math.max.apply(null, _xs);
    var _pad = Math.max((_hi - _lo) * 0.45, 12000);
    var minX = Math.max(0, Math.floor((_lo - _pad) / 5000) * 5000);
    maxX = Math.ceil((_hi + _pad * 0.6) / 5000) * 5000;
    var stuetzen = _kurvenStuetzen(maxX, jahr).filter(function (x) { return x >= minX; });
    if (stuetzen[0] !== minX) stuetzen.unshift(minX);
    var kurve = stuetzen.map(function (x) { return { x: x, y: _grenzsatz(x) }; });
    var _ys = kurve.map(function (p) { return p.y; });
    var minY = Math.max(0, Math.floor((Math.min.apply(null, _ys) - 6) / 5) * 5);

    /* Je Objekt ein Punkt — dort, wo es dich hingeschoben hat. Dazu der
       Ausgangspunkt, damit die Strecke sichtbar wird. */
    var GRUEN = '#3FA56C', ROT = '#B8625C';
    var punkte = [{ x: t.zve, y: _grenzsatz(t.zve), _lab: 'Ausgangslage', _erg: null }];
    t.schritte.forEach(function (s) {
      punkte.push({ x: s.basisNach, y: s.satzNach, _lab: s.name, _erg: s.erg });
    });

    _ketteCharts.push(new Chart(cv, {
      type: 'line',
      data: { datasets: [
        { label: 'Tarif § 32a EStG', data: kurve, parsing: false,
          borderColor: SER[0], borderWidth: 2, pointRadius: 0, tension: 0,
          fill: false, order: 3 },
        { label: 'Weg deiner Objekte', data: punkte, parsing: false,
          showLine: true, borderColor: isDark() ? 'rgba(232,226,212,.45)' : 'rgba(42,39,39,.35)',
          borderWidth: 1.4, borderDash: [4, 3],
          pointRadius: 10, pointHoverRadius: 12,   /* v3321: Platz fuer die Nummer */
          pointBackgroundColor: punkte.map(function (p, i) {
            if (i === 0) return isDark() ? '#E8E2D4' : '#2A2727';
            return (p._erg < 0) ? GRUEN : ROT;
          }),
          pointBorderColor: isDark() ? '#0a0805' : '#fff', pointBorderWidth: 2,
          order: 1 }
      ]},
      plugins: [{ id: 'skNummern', afterDatasetsDraw: function (ch) {
        var meta = ch.getDatasetMeta(1); if (!meta || meta.hidden) return;
        var ctx = ch.ctx; ctx.save();
        ctx.font = '700 10px "JetBrains Mono", ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        meta.data.forEach(function (pt, i) { ctx.fillStyle = i === 0 ? (isDark() ? '#0a0805' : '#fff') : '#fff'; ctx.fillText(i === 0 ? 'A' : String(i), pt.x, pt.y + 0.5); });
        ctx.restore();
      } }],
      options: {
        responsive: true, maintainAspectRatio: false, devicePixelRatio: 2,
        interaction: { mode: 'nearest', intersect: true },
        plugins: {
          legend: { display: true },
          tooltip: { callbacks: {
            title: function (ctx) {
              var p = ctx[0] && ctx[0].raw;
              return p && p._lab ? p._lab : '';
            },
            label: function (ctx) {
              var p = ctx.raw;
              if (ctx.datasetIndex === 0) {
                return ' bei ' + eur(p.x) + ' zvE: Grenzsatz ' + pz(p.y);
              }
              var z = [' zvE danach: ' + eur(p.x), ' Grenzsteuersatz: ' + pz(p.y)];
              if (p._erg != null) z.unshift(' Ergebnis V+V: ' + eur(p._erg));
              return z;
            }
          } }
        },
        scales: {
          x: { type: 'linear', min: minX, max: maxX,
               grid: { color: gridCol, drawBorder: false },
               ticks: { color: axisCol, maxTicksLimit: 7,
                        callback: function (v) { return Math.round(v / 1000) + 'k €'; } },
               title: { display: true, text: 'zu versteuerndes Einkommen', color: axisCol } },
          y: { min: minY, suggestedMax: 50,
               grid: { color: gridCol, drawBorder: false },
               ticks: { color: SER[0], callback: function (v) { return Math.round(v) + ' %'; } },
               title: { display: true, text: 'Grenzsteuersatz', color: SER[0] } }
        }
      }
    }));
  }
  var _ketteCharts = [];
  function _ketteChartsWeg() {
    _ketteCharts.forEach(function (c) { try { c.destroy(); } catch (e) {} });
    _ketteCharts = [];
  }


  /* ═══ v1400 · Eigener Stilblock statt Eingriff in style.css ═══════════════
     style.css hat 36.929 Zeilen und 4.198 !important; eine neue Regel dort
     unterzubringen heisst, gegen die Kaskade zu arbeiten. Dieser Block haengt
     sich einmal ein und trifft nur `.sk-`-Klassen, die es sonst nirgends gibt.
     Gold als var(--wl-…) — Whitelabel-Pflicht. Gruen und Rot hart: eine
     Statusfarbe bleibt in jeder Marke dieselbe.                            */
  function _ketteStil() {
    if ($('dp-sk-stil')) return;
    var s = document.createElement('style');
    s.id = 'dp-sk-stil';
    s.textContent = [
      '.sk-wrap{display:flex;flex-direction:column;gap:16px;margin:0 0 20px}',
      '.sk-topf{border:1px solid rgba(122,115,112,.18);border-radius:12px;padding:16px 16px 14px;',
      '  background:var(--dp-card,rgba(255,255,255,.02))}',
      '.sk-kopf{display:flex;align-items:baseline;justify-content:space-between;gap:12px;',
      '  flex-wrap:wrap;margin-bottom:13px}',
      '.sk-titel{font:600 15px/1.2 "Space Grotesk",Inter,sans-serif;color:var(--dp-text,inherit)}',
      '.sk-art{font:600 10px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.09em;',
      /* v2101b: Weg (c) - `.sk-art` ist eine Pille, kein Fliesstext.
         Der Ton bleibt, der Grund wird dunkel (wie `.ds2-tag`, v2089). */
      '  text-transform:uppercase;color:var(--wl-c9a84c,#C9A84C);background:#1A1714;',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 38%, transparent);',
      '  border-radius:999px;padding:5px 10px;white-space:nowrap}',
      '.sk-art-kst{color:#7A9CC6;border-color:rgba(122,156,198,.34)}',
      /* Kacheln: gleiche Breite, gleiche Grundlinie — eine Reihe, kein Flickenteppich */
      '.sk-zahlen{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}',
      '.sk-k{border:1px solid rgba(122,115,112,.14);border-radius:9px;padding:9px 11px}',
      '.sk-k-l{font:500 10.5px/1.3 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.06em;',
      '  text-transform:uppercase;color:var(--dp-muted-txt, var(--dp-muted,#7A7370));margin-bottom:4px}',
      '.sk-k-v{font:600 15px/1.2 Inter,sans-serif;font-variant-numeric:tabular-nums;color:var(--dp-text,inherit)}',
      /* v2101b: Weg (a). Gemessen 2,23 auf rgb(253,252,250). Der
         gestaffelte Rueckfall haelt das Gold ausserhalb des Cockpits. */
      '.sk-k-akzent .sk-k-v{color:var(--dp-gold-txt, var(--wl-c9a84c,#C9A84C))}',
      '.sk-k-gut .sk-k-v{color:#3FA56C}',
      '.sk-k-schlecht .sk-k-v{color:#B8625C}',
      '.sk-box{height:260px;margin-bottom:14px}',
      '.sk-box-h{min-height:200px}',
      '.sk-nr{display:inline-block;min-width:17px;height:17px;line-height:17px;border-radius:50%;background:#2A2727;color:#fff;font:700 9.5px ui-monospace,monospace;text-align:center;margin-right:7px;vertical-align:1px}',   /* v3321: Hoehe je nach Zahl der Objekte (inline) */
      '.sk-ueber{font-size:12.5px;line-height:1.5;color:var(--c-mut,#6b6660);margin:0 2px 10px}',
      '.sk-ueber b{color:var(--c-ink,#1b1815)}',
      '.sk-ohne{font-size:11.5px;line-height:1.45;color:var(--c-mut,#6b6660);margin:-6px 0 12px;padding:7px 10px;border-radius:7px;background:rgba(184,98,92,.07);border-left:3px solid #B8625C}',
      /* v1405 · Umschalter ueber der Grafik */
      '.sk-umsch{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:10px}',
      '.sk-u-btn{font:600 11.5px/1 Inter,sans-serif;padding:7px 12px;border-radius:7px;cursor:pointer;',
      '  border:1px solid rgba(122,115,112,.24);background:transparent;color:var(--dp-muted-txt, var(--dp-muted,#7A7370));',
      '  transition:background .15s,color .15s,border-color .15s}',
      '.sk-u-btn:hover{border-color:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent);color:var(--wl-c9a84c,#C9A84C)}',
      '.sk-u-an{background:var(--wl-c9a84c,#C9A84C);border-color:var(--wl-c9a84c,#C9A84C);color:#2c2410}',
      '.sk-u-an:hover{color:#2c2410}',
      '.sk-u-btn:focus-visible{outline:2px solid var(--wl-c9a84c,#C9A84C);outline-offset:2px}',
      '.sk-u-hint{flex:1 1 220px;min-width:180px;font-size:11.5px;line-height:1.45;',
      '  color:var(--dp-muted-txt, var(--dp-muted,#7A7370))}',
      /* Die Tabelle scrollt in ihrem eigenen Kasten — die Seite nie quer */
      '.sk-tabwrap{overflow-x:auto;-webkit-overflow-scrolling:touch}',
      '.sk-tab{width:100%;border-collapse:collapse;font-size:12.5px;min-width:520px}',
      '.sk-tab th{font:600 10px/1.3 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.07em;',
      '  text-transform:uppercase;color:var(--dp-muted-txt, var(--dp-muted,#7A7370));text-align:left;padding:0 10px 7px;',
      '  border-bottom:1px solid rgba(122,115,112,.20);white-space:nowrap}',
      '.sk-tab th.r,.sk-tab td.r{text-align:right}',
      '.sk-tab td{padding:8px 10px;border-bottom:1px solid rgba(122,115,112,.10);',
      '  font-variant-numeric:tabular-nums;vertical-align:baseline}',
      '.sk-tab tr:last-child td{border-bottom:none}',
      '.sk-name{max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}',
      '.sk-dat{color:var(--dp-muted-txt, var(--dp-muted,#7A7370));white-space:nowrap}',
      '.sk-grau{color:var(--dp-muted-txt, var(--dp-muted,#7A7370))}',
      /* v2101d: Weg (a), 3,01 auf hellem Grund. Staffelung wie beim Grau. */
      '.sk-gruen{color:var(--dp-green-txt,#2e784f)}',
      '.sk-rot{color:var(--dp-red-txt,#a05550)}',
      '.sk-satz{white-space:nowrap;color:var(--dp-muted-txt, var(--dp-muted,#7A7370))}',
      /* v2101b: Weg (a), gemessen 2,23 bei 8 Traegern. */
      '.sk-satz b{color:var(--dp-gold-txt, var(--wl-c9a84c,#C9A84C));font-weight:600}',
      '.sk-pfeil{color:#3FA56C;font-weight:700;margin-left:5px}',
      '.sk-fuss{margin-top:11px;padding-top:10px;border-top:1px solid rgba(122,115,112,.12);',
      '  font-size:11.5px;line-height:1.55;color:var(--dp-muted-txt, var(--dp-muted,#7A7370))}',
      '.sk-leer{border:1px dashed rgba(122,115,112,.26);border-radius:11px;padding:20px;',
      '  font-size:12.5px;line-height:1.55;color:var(--dp-muted-txt, var(--dp-muted,#7A7370));text-align:center}',
      '@media(max-width:640px){.sk-box:not(.sk-box-h){height:220px}.sk-topf{padding:13px 12px 12px}}'
    ].join('');
    document.head.appendChild(s);
  }
  function renderSteuerKette() {
    _ketteStil();
    var host = $('dp-steuerkette');
    if (!host) return;
    _ketteChartsWeg();

    var k = steuerKette(_kettenJahr());
    if (!k.geladen) {
      _ketteNachladen();
      host.innerHTML = '<div class="dp-chart-loading"><span class="dp-spin"></span>Steuerdaten deiner Objekte werden geladen…</div>';
      return;
    }
    if (!k.toepfe.length) {
      host.innerHTML = '<div class="sk-leer">Noch keine gespeicherten Bestandsobjekte mit steuerlichem Ergebnis für '
        + _kettenJahr() + '. Sobald ein Objekt im Tab Steuern gerechnet und gespeichert ist, erscheint es hier.</div>';
      return;
    }

    var eur = function (n) {
      return (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('de-DE') + ' €';
    };
    var pz = function (n) { return n.toFixed(2).replace('.', ',') + ' %'; };

    var html = '';
    /* v3321 · Marcel 12.11.2026: „haben wir überhaupt auf Wirkung je Objekt alles drauf?"
       Gemessen: im Topf Privat stehen nur Objekte mit Ergebnis im Jahr, die Objekte einer
       Gesellschaft stehen in deren eigenem Topf. Die Zeile sagt jetzt, wo jedes Objekt steht. */
    var _nAlle = 0;
    k.toepfe.forEach(function (t) { _nAlle += t.schritte.length + (t.ohne ? t.ohne.length : 0); });
    html += '<div class="sk-ueber">' + _kettenJahr() + ' · ' + _nAlle + ' Objekt' + (_nAlle === 1 ? '' : 'e') + ': '
      + k.toepfe.map(function (t) {
          return '<b>' + t.schritte.length + '</b> ' + _esc(t.estPflichtig ? 'privat (Einkommensteuer)' : t.name)
            + (t.ohne && t.ohne.length ? ' + ' + t.ohne.length + ' ohne Ergebnis' : '');
        }).join(' · ') + '</div>';
    k.toepfe.forEach(function (t, idx) {
      var cid = 'dpc-kette-' + idx;
      var istEst = t.estPflichtig;
      html += '<div class="sk-topf">'
        + '<div class="sk-kopf">'
        +   '<div class="sk-titel">' + _esc(t.name) + '</div>'
        +   '<span class="sk-art' + (istEst ? '' : ' sk-art-kst') + '">'
        /* v1404b: ein UNBEKANNTER Satz ist nicht null Prozent. `effRate()`
           liefert ohne Pro-Abo nichts — dann steht hier der Hinweis, nicht
           eine Zahl, die eine Steuerfreiheit behauptet. */
        +     (istEst ? 'Einkommensteuer · § 32a · mit Progression'
                      : (t.satz != null
                          ? 'Körperschaftsteuer · ' + pz(t.satz * 100) + ' · proportional'
                          : 'Körperschaftsteuer · Satz nicht hinterlegt'))
        +   '</span>'
        + '</div>';

      if (istEst) {
        var letzter = t.schritte[t.schritte.length - 1];
        html += '<div class="sk-zahlen">'
          + _kachel('Ausgangs-zvE', eur(t.zve), '')
          + _kachel('nach allen Objekten', eur(letzter.basisNach), 'sk-k-akzent')
          + _kachel('Grenzsatz', pz(_grenzsatz(t.zve)) + ' → ' + pz(letzter.satzNach), 'sk-k-akzent')
          + _kachel('Steuerwirkung gesamt', eur(t.summe), t.summe > 0 ? 'sk-k-gut' : 'sk-k-schlecht')
          + '</div>'
          /* v1405 · Umschalter zwischen den beiden Ansichten. Er steht direkt
             ueber der Grafik, weil er nur sie betrifft — und er sagt in einem
             Satz, was die jeweils andere zeigt. */
          + '<div class="sk-umsch">'
          +   '<button type="button" class="sk-u-btn' + (_ketteAnsicht === 'stufen' ? ' sk-u-an' : '') + '"'
          +     ' onclick="DealPilotDashboard.ketteAnsicht(\'stufen\')"'
          +     ' title="Wie viel Steuer jedes Objekt spart oder kostet — als Betrag.">Wirkung je Objekt</button>'
          +   '<button type="button" class="sk-u-btn' + (_ketteAnsicht === 'kurve' ? ' sk-u-an' : '') + '"'
          +     ' onclick="DealPilotDashboard.ketteAnsicht(\'kurve\')"'
          +     ' title="Der Tarif des § 32a EStG als Kurve — und wo deine Objekte dich darauf hinschieben.">Progressionskurve</button>'
          +   '<span class="sk-u-hint">'
          +     (_ketteAnsicht === 'kurve'
                  ? 'Die Linie ist der Steuertarif. A ist dein Einkommen ohne Objekte, jede Nummer ein Objekt aus der Tabelle – dort, wo dein Einkommen danach liegt.'
                  : 'Je Objekt die Steuer, die es spart (grün) oder kostet (rot) – in der Reihenfolge des Kaufs, unten die Summe.')
          +   '</span>'
          + '</div>'
          + '<div class="chart-box sk-box' + (_ketteAnsicht === 'kurve' ? '' : ' sk-box-h') + '"' + (_ketteAnsicht === 'kurve' ? '' : ' style="height:' + (60 + (t.schritte.length + 1) * 34) + 'px"') + '><canvas id="' + cid + '"></canvas></div>'
          + (t.ohne && t.ohne.length ? '<div class="sk-ohne">Ohne Ergebnis ' + _kettenJahr() + ' (im Reiter Steuer noch nicht gerechnet oder gespeichert): ' + t.ohne.map(_esc).join(' · ') + '</div>' : '');
      } else {
        html += '<div class="sk-zahlen">'
          + _kachel('Ergebnis der Gesellschaft', eur(t.gesamtergebnis || 0), '')
          + _kachel('Steuersatz', t.satz != null ? pz(t.satz * 100) : 'nicht hinterlegt',
                    t.satz != null ? 'sk-k-akzent' : '')
          + _kachel('Körperschaftsteuer',
                    t.satz != null ? eur(t.summe) : '—',
                    t.satz != null ? (t.summe > 0 ? 'sk-k-gut' : 'sk-k-schlecht') : '')
          + '</div>'
          + (t.ohne && t.ohne.length ? '<div class="sk-ohne">Ohne Ergebnis ' + _kettenJahr() + ': ' + t.ohne.map(_esc).join(' · ') + '</div>' : '')
          + (t.satz == null
              ? '<div class="sk-fuss">Für diese Gesellschaft ist <b>kein Steuersatz hinterlegt</b> — '
                + 'Körperschaftsteuer und Gewerbesteuer-Hebesatz stehen unter '
                + '<b>Einstellungen / Mandanten</b> (ab Detailgrad Experte). Das Ergebnis der Objekte ist oben trotzdem '
                + 'richtig; nur die Steuer darauf lässt sich ohne Satz nicht beziffern.</div>'
              : '');
      }

      /* Die Tabelle — je Objekt eine Zeile. */
      html += '<div class="sk-tabwrap"><table class="sk-tab"><thead><tr>'
        + '<th>Objekt</th><th>gekauft</th><th class="r">Ergebnis V+V</th>'
        + (istEst ? '<th class="r">Basis vorher</th><th class="r">Basis nachher</th>' : '')
        + '<th class="r">Steuerwirkung</th>'
        + (istEst ? '<th class="r">Grenzsatz</th>' : '')
        + '</tr></thead><tbody>';
      t.schritte.forEach(function (s) {
        var gefallen = istEst && (s.satzNach < s.satzVor - 0.005);
        html += '<tr>'
          + '<td class="sk-name" title="' + _esc(s.name) + '">' + (istEst ? '<span class="sk-nr">' + (t.schritte.indexOf(s) + 1) + '</span>' : '') + _esc(s.name) + '</td>'
          + '<td class="sk-dat">' + (s.datum ? _datDe(s.datum) : '—') + '</td>'
          + '<td class="r ' + (s.erg < 0 ? 'sk-rot' : 'sk-gruen') + '">' + eur(s.erg) + '</td>'
          + (istEst ? '<td class="r sk-grau">' + eur(s.basisVor) + '</td>'
                    + '<td class="r sk-grau">' + eur(s.basisNach) + '</td>' : '')
          /* v1400b: `null` heisst "in dieser Sphaere gibt es keine Wirkung
             je Objekt" — nicht "null Euro". Der Strich sagt das. */
          + (s.wirkung == null
              ? '<td class="r sk-grau" title="Die Körperschaftsteuer steht auf dem Ergebnis der Gesellschaft, nicht auf dem einzelnen Objekt.">—</td>'
              : '<td class="r ' + (s.wirkung > 0 ? 'sk-gruen' : 'sk-rot') + '">' + eur(s.wirkung) + '</td>')
          + (istEst ? '<td class="r sk-satz">' + pz(s.satzVor) + ' → <b>' + pz(s.satzNach) + '</b>'
                    + (gefallen ? '<span class="sk-pfeil" title="Dieses Objekt hat deinen Grenzsteuersatz gesenkt">↓</span>' : '')
                    + '</td>' : '')
          + '</tr>';
      });
      html += '</tbody></table></div>';

      if (istEst) {
        html += '<div class="sk-fuss">Die Objekte stehen in der Reihenfolge ihres Kaufs. '
          + 'Jedes trifft auf das Einkommen, das die vorherigen bereits verschoben haben — '
          + 'so, wie sie in der Steuererklärung zusammenfließen. '
          + '<b>Die Summe ist die echte Gesamtwirkung</b>; die Aufteilung auf die einzelnen '
          + 'Objekte folgt dem Kaufzeitpunkt.</div>';
      } else {
        html += '<div class="sk-fuss">Die Gesellschaft rechnet <b>getrennt von deinem privaten Einkommen</b>. '
          + 'Ihr Satz ist proportional — es gibt keine Progression und keinen Verlustrücktrag auf dein zvE. '
          + 'Ein Verlust mindert hier nur das Ergebnis der Gesellschaft.</div>'
          /* v3270 · unter Detailgrad Experte: die Gesellschaft selbst ist ab Experte bearbeitbar */
          + (function () { try { return (window.DealPilotMandanten && DealPilotMandanten.hinweisHtml) ? DealPilotMandanten.hinweisHtml(t.halter, 'cockpit') : ''; } catch (e) { return ''; } })();
      }
      html += '</div>';
    });

    host.innerHTML = html;

    /* Die Grafiken erst nach dem Einhängen — Canvas braucht seinen Platz. */
    if (typeof Chart === 'undefined') return;
    var SER = chartPalette();
    var GRUEN = '#3FA56C', ROT = '#B8625C';
    var axisCol = isDark() ? 'rgba(232,226,212,.55)' : '#7A7370';
    var gridCol = isDark() ? _wlrgba(.10) : 'rgba(122,115,112,.12)';

    k.toepfe.forEach(function (t, idx) {
      if (!t.estPflichtig) return;
      var cv = $('dpc-kette-' + idx);
      if (!cv) return;
      /* v1405: zwei Ansichten auf dieselbe Rechnung. Die Balken zeigen den
         BETRAG je Objekt, die Kurve den WEG auf dem Tarif. Umgeschaltet wird
         oben im Kopf des Topfes. */
      if (_ketteAnsicht === "kurve") {
        _kurveBauen(cv, t, SER, axisCol, gridCol, eur, pz);
        return;
      }
      /* v3321 · Marcel 12.11.2026: „die Wirkung je Objekt … ob man das noch professioneller
         darstellen kann … ist das aussagekräftig?" Bis v3317: senkrechte Säulen plus eine
         geglättete Grenzsatz-Linie (tension .25) - sie bog sich zwischen den Punkten unter den
         echten Satz und erfand einen Verlauf, den es nicht gibt. Jetzt waagerechte Balken mit
         vollem Objektnamen, Betrag am Balken und die Summe als eigener Balken. Der Grenzsatz
         steht in der Tabelle darunter und in der Progressionskurve. Zahlen unverändert aus
         steuerKette() (s.wirkung, t.summe). */
      var labels = t.schritte.map(function (s, i) { var n = String(s.name || ''); return (i + 1) + '  ' + (n.length > 32 ? n.substring(0, 30) + '…' : n); }).concat(['Summe aller Objekte']);
      var wirkReihe = t.schritte.map(function (s) { return Math.round(s.wirkung); }).concat([Math.round(t.summe)]);
      var nS = t.schritte.length;
      var GOLD = SER[0];
      var farben = wirkReihe.map(function (v, i) {
        if (i === nS) return isDark() ? '#E8E2D4' : '#2A2727';
        return v > 0 ? GRUEN + 'd9' : (v < 0 ? ROT + 'd9' : 'rgba(0,0,0,.15)');
      });
      var wertText = {
        id: 'skWerte',
        afterDatasetsDraw: function (ch) {
          var ctx = ch.ctx, meta = ch.getDatasetMeta(0);
          ctx.save();
          ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
          ctx.textBaseline = 'middle';
          meta.data.forEach(function (bar, i) {
            var v = wirkReihe[i]; if (v == null) return;
            var txt = (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toLocaleString('de-DE') + ' €';
            var rechts = v >= 0;
            ctx.fillStyle = i === nS ? (isDark() ? '#E8E2D4' : '#2A2727') : (v > 0 ? '#2f7d52' : v < 0 ? '#9a4b45' : axisCol);
            ctx.textAlign = rechts ? 'left' : 'right';
            ctx.fillText(txt, bar.x + (rechts ? 6 : -6), bar.y);
          });
          ctx.restore();
        }
      };
      var maxAbs = Math.max.apply(null, wirkReihe.map(function (v) { return Math.abs(v); }).concat([1]));
      var rand = maxAbs * 0.32;
      var minX = Math.min(0, Math.min.apply(null, wirkReihe)) - (Math.min.apply(null, wirkReihe) < 0 ? rand : 0);
      var maxX = Math.max(0, Math.max.apply(null, wirkReihe)) + (Math.max.apply(null, wirkReihe) > 0 ? rand : 0);

      _ketteCharts.push(new Chart(cv, {
        type: 'bar',
        plugins: [wertText],
        data: { labels: labels, datasets: [
          { label: 'Steuerwirkung', data: wirkReihe, backgroundColor: farben,
            borderRadius: 4, borderSkipped: false, barPercentage: .72, categoryPercentage: .9, maxBarThickness: 22 }
        ]},
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false, devicePixelRatio: 2,
          layout: { padding: { right: 8 } },
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: function (ctx) { var i = ctx[0] && ctx[0].dataIndex; return i === nS ? 'Summe aller Objekte' : (t.schritte[i] ? t.schritte[i].name : ''); },
              label: function (ctx) {
                if (ctx.dataIndex === nS) return ' Steuerwirkung gesamt: ' + eur(t.summe);
                var s = t.schritte[ctx.dataIndex];
                if (!s) return '';
                return [' Ergebnis V+V: ' + eur(s.erg),
                        ' Steuerwirkung: ' + eur(s.wirkung),
                        ' Grenzsatz: ' + pz(s.satzVor) + ' → ' + pz(s.satzNach)];
              } } }
          },
          scales: {
            x: { min: minX, max: maxX, grid: { color: function (c) { return c.tick && c.tick.value === 0 ? (isDark() ? 'rgba(232,226,212,.5)' : 'rgba(42,39,39,.45)') : gridCol; }, drawBorder: false },
                 ticks: { color: axisCol, maxTicksLimit: 7, callback: function (v) { return (v < 0 ? '−' : v > 0 ? '+' : '') + Math.round(Math.abs(v) / 1000) + 'k €'; } },
                 title: { display: true, text: 'Steuer gespart (+) bzw. mehr gezahlt (−) im Jahr ' + _kettenJahr(), color: axisCol } },
            y: { grid: { display: false }, ticks: { color: function (c) { return c.index === nS ? (isDark() ? '#E8E2D4' : '#2A2727') : axisCol; },
                 font: function (c) { return c.index === nS ? { weight: '700' } : {}; }, autoSkip: false } }
          }
        }
      }));
    });
  }

  function _kachel(label, wert, cls) {
    return '<div class="sk-k ' + (cls || '') + '"><div class="sk-k-l">' + label + '</div>'
         + '<div class="sk-k-v">' + wert + '</div></div>';
  }
  function _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _kurz(s) {
    s = String(s || '');
    return s.length > 22 ? s.substring(0, 20) + '…' : s;
  }
  function _datDe(iso) {
    var p = String(iso).substring(0, 10).split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : iso;
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
    /* v2953c · die Einfach-Kachel „Entwicklung · Eigenkapital" rechnet mit _projYears,
       wurde beim Umschalten aber nicht neu gezeichnet - gemessen: 30 J. gewaehlt, Kachel blieb 2045 */
    try { renderEinfach(); } catch (e) {}
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
      + '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke='+"'"+_wlrgba(.18)+"'"+' stroke-width="2.5"/>'
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
    /* \u2550\u2550 v1737 \u00b7 DER KNOPF \u201eBANK" LUD DIE KAUFPREISAUFTEILUNG \u2550\u2550
       Gefunden beim Messen der Handy-Breite, nicht gesucht: vier Knoepfe in
       einem `flex`-Container mit `nowrap` liefen bei 390 px um 25 px aus
       der Karte. Beim Nachsehen, welcher Knopf da ueberhaupt steht, fiel
       der eigentliche Fehler auf.

       `_runPdf('bank')` klapperte vier moegliche Funktionsnamen ab:

         ['exportBmfPdf','exportBankPdf','exportBankenPdf','exportBankPDF']

       Gemessen existieren davon ZWEI \u2014 die erste und die letzte. Genommen
       wird die erste, und das ist `exportBmfPdf` aus `bmf-modal.js`: die
       KAUFPREISAUFTEILUNG fuers Finanzamt. Die Bankfassung ist
       `exportBankPDF` (calc.js) bzw. heute `exportPDFBank`.

       > Auf dem Knopf stand Bank, geliefert wurde Finanzamt. Eine Liste
       > von Namen, die \u201erobust" sein soll, trifft genau dann zuverlaessig
       > das Falsche, wenn mehr als einer existiert.

       Der Knopf entfaellt \u2014 konsistent zu v1733: \u201eInvestment" ruft
       `exportPDF`, und das ist seit v1636 umhuellt, fragt also nach der
       Fassung (Bank / hell / Obsidian). Ein eigener Bank-Knopf beschreibt
       denselben Weg ein zweites Mal. Nebenbei passen drei Knoepfe auf
       390 px, vier nicht. */
    var pdfs='<div class="pdfs">'+'<button class="kc-openbtn" onclick="event.stopPropagation();DealPilotDashboard.openObject(\''+esc(k)+'\')">Objekt \u00f6ffnen</button>'
      + '<button onclick="event.stopPropagation();DealPilotDashboard.cardPdf(\''+esc(k)+'\',\'invest\')">'+_dl()+'Investment</button>'
      + '<button onclick="event.stopPropagation();DealPilotDashboard.cardPdf(\''+esc(k)+'\',\'wk\')">'+_dl()+'Werbungsk.</button>'
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
      else if(typeof window.toast==='function') window.toast('Investment-PDF-Funktion nicht verfügbar');
    } else if(typ==='bank'){
      /* v1737 · Hier klapperte eine Namensliste vier Kandidaten ab und nahm
         den ersten Treffer — `exportBmfPdf`, also die Kaufpreisaufteilung
         fuers Finanzamt. Auf dem Knopf stand „Bank". Der Knopf ist weg;
         der Zweig bleibt fuer Altaufrufer und ruft jetzt die RICHTIGE
         Funktion, mit `exportPDFBank` zuerst (seit v1636 umhuellt, fragt
         also nach der Fassung). Das `eval()` entfaellt mit. */
      var fnBank = (typeof window.exportPDFBank === 'function') ? window.exportPDFBank
                 : (typeof window.exportBankPDF === 'function') ? window.exportBankPDF : null;
      if(fnBank){ try{ fnBank(); }catch(e){} }
      else if(typeof window.toast==='function') window.toast('Bankexport-Funktion nicht verfügbar');
    } else if(typ==='wk-single' || typ==='wk-all'){
      var mode=(typ==='wk-all')?'all-years':'single-year';
      var fnWk=(typeof window.exportWerbungskostenPDF==='function')?window.exportWerbungskostenPDF:(typeof exportWerbungskostenPDF==='function')?exportWerbungskostenPDF:null;
      if(fnWk){ try{ fnWk(mode); }catch(e){} }
      else if(typeof window.toast==='function') window.toast('Werbungskosten-PDF-Funktion nicht verfügbar');
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
    if(typeof window.toast==='function') window.toast('Track-Record-Funktion nicht verfügbar');
  }
  function cardDelete(key, name){
    if(!confirm('Objekt „'+name+'" wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return;
    if(!window.Auth||typeof window.Auth.apiCall!=='function') return;
    window.Auth.apiCall('/objects/'+key,{method:'DELETE'}).then(function(){
      _summaries=_summaries.filter(function(o){return (o.id||o.key)!==key;});
      delete _details[key]; _detailsLoaded=false;
      renderAll();
      loadDetails().then(function(){ renderHealth(); renderOverview(); renderKpiCards(); renderScoreHero(); buildCharts(); renderProjTable(); try{renderSteuerKette();}catch(e){} });
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
    if($(MOUNT_ID) && $(MOUNT_ID).style.display!=='none'){ destroyCharts(); buildCharts(); renderScoreHero(); renderKpiCards(); try{renderSteuerKette();}catch(e){} }
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
  /* ── v1903 · DIE TEILCHEN GEHOEREN ZU „HEUTE", NICHT ZU JEDER ANSICHT ─────────────
     Marcel am 06.10.2026: „Wir haben, wenn man das Menue aufmacht, immer noch in der
     Portfolio-Ansicht den Obsidian-Hintergrund mit den Partikeln."

     ZWEI DIAGNOSEN VORHER WAREN FALSCH, UND BEIDE NEHME ICH HIERMIT ZURUECK:

       (1) „Der Canvas ist layoutblind."  Widerlegt — er war in der gemessenen Ansicht
           gar nicht im DOM.
       (2) „Seine Hoehe ist die Ursache."  Behoben in v1900a/v1900b, und die Reparatur
           HAELT: gemessen am 06.10.2026 auf Staging, 390 px, Aktenmappe,
           Portfolio-Cockpit — Canvas 383 x 9014, Puffer 383 x 9014, Mount 383 x 9014.
           Die Flaeche stimmt also auf den Pixel.

     Marcel sieht es trotzdem, und der Grund ist ein anderer: die Teilchen sind ueberhaupt
     da. `#dashboard-main` ist der Mount des Portfolio-Cockpits, und das Cockpit gibt es in
     JEDER Ansicht — auch in der Aktenmappe, wo es seinen Obsidian-Grund und seine Teilchen
     mitbringt, waehrend die uebrige Arbeitsflaeche dort rgb(244,242,237) fuehrt.

     > Eine Gestaltung, die zu EINER Ansicht gehoert, darf nicht mitwandern, nur weil die
     > Flaeche dieselbe ist. Das ist derselbe Befund wie bei den Objektkarten, die in der
     > Aktenmappe wie „Heute" aussahen (v1885) — nur in die andere Richtung.

     Abgeschaltet wird hier, nicht per CSS: ein `display:none` liesse den Zeichenlauf
     weiterlaufen und auf einem Handy Strom kosten, ohne dass jemand etwas davon haette.
     Ein schon vorhandener Canvas wird dabei abgeraeumt — wer das Aussehen zur Laufzeit
     wechselt, soll ihn nicht behalten.

     NUR AUF DEM HANDY (<= 900 px), und das ist eine GRENZE, keine halbe Sache: Marcel hat
     zur Web-Ansicht am Computer gesagt „die Optik die wir aktuell haben ist gut so". Die
     Begruendung oben gilt zwar breitenunabhaengig, aber am Schreibtisch hat er die Teilchen
     in der Aktenmappe bisher und will nichts anders. Gemessen bei 1180 px: Schiene, Register
     und Typografie sind vor und nach v1903 Zeile fuer Zeile dieselben - das soll so bleiben.

     > Eine Aufraeumung, die ueber ihren Auftrag hinausgeht, ist keine Aufraeumung mehr.

     ── v1904 · DEN SATZ, DER HIER STAND, NEHME ICH ZURUECK ────────────────────────
     Hier stand: „OFFEN UND ABSICHTLICH NICHT HIER: der Obsidian-GRUND von
     `#dashboard-main` bleibt, wie er ist." **Diesen Grund gibt es nicht.** Gemessen
     am 06.10.2026 bei 390 px in der Aktenmappe, Cockpit offen:

       #dashboard-main          rgba(0,0,0,0)      transparent
       #dp-stage.stage.fc.fc9   rgb(253,252,250)   Creme #FDFCFA
       .main-col                rgb(244,242,237)   die Arbeitsflaeche

     23 Proben ueber die ganze Cockpit-Hoehe trafen genau EINMAL auf Obsidian — das
     Band `.hpass` im Hero. Der Satz war eine Annahme, keine Messung, und wurde von
     v1903a ins Journal (57) weitergereicht.

     Der echte Unterschied ist der eigene helle Ton des Cockpits; gebunden wird er in
     `css/layout-varianten.css` ueber `--page-bg` (v1904), unter 901 px und nur mit
     Layout-Attribut. Welche Farbe die Arbeitsflaeche traegt, bleibt Marcels
     Entscheidung — sie steht jetzt an EINER Stelle, naemlich dort. */
  /* v1931 · DIE BREITENBEDINGUNG IST RAUS — und das war der ganze Fehler.

     Marcel am 07.10.2026: „zudem ist immer noch dieser Partikel Hintergrund da.
     den moechte ich in der Aktenmappe Ansicht nicht haben!"

     Er hatte recht, und zwar seit drei Anlaeufen. Gemessen am Schreibtisch
     (1177 px, Layout v1b, Cockpit offen):

       #dp-particles   925 x 5843 px, opacity 1, z 0, in #dashboard-main
       layoutAktiv()   false   (Attribut=true, aber <=900px=FALSE)

     Die Abraeumung lief also NUR auf dem Handy. Am Schreibtisch zeichnete der
     Canvas in jeder Aktenmappen-Ansicht weiter — genau dort, wo Marcel ihn sah.

     > Ich habe dreimal in der Schublade auf dem Handy gemessen und jedesmal
     > „keine Partikel" gemeldet. Der Befund war wahr fuer die Flaeche, die ich
     > angesehen hatte, und trotzdem falsch fuer den Schirm. Wer eine Verneinung
     > meldet, muss sagen WO er gesucht hat.

     Die Breite stammte aus v1904, wo der helle Cockpit-Ton unter 901 px gebunden
     wurde. Fuer die Partikel ist sie sachfremd: die Aktenmappe ist eine ANSICHT,
     keine Bildschirmgroesse. Das Attribut allein entscheidet. */
  function layoutAktiv(){
    try{
      return document.documentElement.hasAttribute('data-dp-layout');
    }catch(e){ return false; }
  }
  function initParticles(){
    var m=$(MOUNT_ID); if(!m) return;
    if(layoutAktiv()){
      var alt=$('dp-particles');
      if(alt){ try{ stopParticles(); }catch(e){} if(alt.parentNode) alt.parentNode.removeChild(alt); }
      return;
    }
    /* v1896 · Den Canvas gibt es im Markup nicht — er wird hier angelegt. Vorher stand hier
       `var cv=$('dp-particles'); if(!cv||!m)return;`, und weil das Element nirgends im Frontend
       vorkam (gemessen: null Treffer in index.html, allen js/ und allen css/), kehrte die
       Routine immer in ihrer ersten Zeile zurück. Die Teilchen liefen nie. */
    var cv=$('dp-particles');
    if(!cv){
      cv=document.createElement('canvas');
      cv.id='dp-particles';
      /* Hinter den Inhalt, ohne Klicks zu fangen. Die Flaeche traegt der Mount selbst.
         ── v1900a · MIT !important, UND ZWAR WEGEN EINER FREMDEN REGEL ──────
         Gemessen am 06.10.2026 auf Staging bei 387 px: der Canvas war 383x192,
         obwohl der Mount 9026 px hoch ist. Ursache ist eine Sammelregel in
         `css/dashboard.css:795` (@media max-width:768px):

             #dashboard-main canvas,
             #dashboard-main .chart svg { max-width:100% !important; height:auto !important }

         Sie ist fuer die DIAGRAMM-Canvas gedacht, die sonst ueber die Spalte
         hinauslaufen — der Partikel-Canvas ist seit v1896 nur ein neues Mitglied
         derselben Menge. `height:auto` laesst ihn auf seine Attributhoehe fallen,
         und die hatte `size()` gerade aus seiner Flaeche genommen: eine
         Rueckkopplung, die ihn auf dem ersten gemessenen Wert einfriert.

           > Eine Sammelregel auf Container-Kinder trifft auch die Kinder, die es
           > bei ihrer Entstehung noch nicht gab.

         Inline mit `important` gesetzt, nicht als zweite CSS-Regel: der Canvas
         entsteht hier, also gehoert seine Geometrie hierher, und so haengt sie
         nicht an Ladereihenfolge oder Cache-Buster eines Stylesheets. */
      ['position:absolute','top:0','right:0','bottom:0','left:0','width:100%','height:100%',
       'max-width:none','z-index:0','pointer-events:none'].forEach(function(paar){
        var i=paar.indexOf(':');
        cv.style.setProperty(paar.slice(0,i), paar.slice(i+1), 'important');
      });
      if(getComputedStyle(m).position==='static') m.style.position='relative';
      m.insertBefore(cv, m.firstChild);
      /* Alles, was der Mount sonst enthaelt, gehoert ueber die Teilchen. */
      [].forEach.call(m.children, function(k){
        if(k!==cv && getComputedStyle(k).position==='static') k.style.position='relative';
      });
    }
    _pctx=cv.getContext('2d');
    function size(){
      /* v1900 · DER PUFFER MUSS DIE FLAECHE SEIN, DIE DER CANVAS EINNIMMT.
         Gemessen am 06.10.2026 auf Staging, erster Lauf ueberhaupt (bis v1896
         kehrte die Routine in Zeile 1 um): CSS-Flaeche 893x5703, Pixelpuffer
         946x5379. Der Browser zieht den Puffer dann auf die Flaeche — die
         Teilchen liefen 6 % zu breit und 6 % zu flach, und alles, was rechts
         von 893 gezeichnet wurde, lag ausserhalb.

         Ursache war die alte Rueckfallkette: sie nahm `window.innerWidth-380`
         (die Schiene am Schreibtisch) und `scrollHeight` zu einem Zeitpunkt,
         an dem das Markup noch nicht fertig war. Seit v1896 traegt der Canvas
         `width:100%;height:100%` — er KENNT seine Flaeche also selbst, sobald
         er im Dokument haengt. Die wird jetzt zuerst gefragt; die alte Kette
         bleibt als Rueckfall fuer den Fall, dass noch nichts gelayoutet ist. */
      var rc = cv.getBoundingClientRect();
      _pw = cv.width  = Math.round(rc.width)  || Math.max(m.clientWidth||0,  m.scrollWidth||0,  window.innerWidth-380, 600);
      _ph = cv.height = Math.round(rc.height) || Math.max(m.clientHeight||0, m.scrollHeight||0, window.innerHeight,    600);
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
    /* ── v1900b · DER PUFFER WIRD IM ZEICHENLAUF NACHGEZOGEN ───────────────
       Die Hoehe des Cockpits waechst, waehrend Karten und Diagramme nachrendern
       — ohne dass das Fenster sich aendert. Ein Horcher nur auf `resize`
       bekommt davon nichts mit.

       Hier stand bis v1900a ein `ResizeObserver`. GEMESSEN am 06.10.2026 auf
       Staging bei 387 px blieb der Puffer damit auf 8499 stehen, waehrend die
       Flaeche 9026 war, und holte das auch nach Minuten nicht nach: das Setzen
       von `cv.height` IM Rueckruf aendert die Eigengroesse des Canvas, der
       Browser wertet das als Schleife und verwirft die letzte Meldung
       stillschweigend.

         > Ein Beobachter, den die eigene Antwort auf seine Meldung zum
         > Schweigen bringt, meldet genau den letzten Schritt nicht.

       Statt dessen alle 30 Bilder (rund eine halbe Sekunde) nachsehen und nur
       bei echter Abweichung neu setzen. Das kann nicht in eine Schleife laufen,
       heilt sich selbst und kostet zwei Layout-Lesungen je Sekunde. */
    var _ptick=0;
    function draw(){
      if(!_pctx)return;
      if((++_ptick % 30)===0){                       /* v1900b, siehe Block oben */
        var rr=cv.getBoundingClientRect();
        if(rr.height>0 && (Math.abs(rr.width-cv.width)>1 || Math.abs(rr.height-cv.height)>1)) size();
      }
      _pctx.clearRect(0,0,_pw,_ph);
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
  function stopParticles(){ cancelAnimationFrame(_praf); _pctx=null; if(_presize){window.removeEventListener('resize',_presize);_presize=null;}
    /* v1900b: einen etwaigen Beobachter aus v1900/v1900a abraeumen — die
       Nachfuehrung laeuft seitdem im Zeichenlauf, aber ein Tab, der die alte
       Fassung noch im Speicher hat, soll ihn nicht behalten. */
    try{ var _cv=$('dp-particles'); if(_cv&&_cv._dpRo){ _cv._dpRo.disconnect(); _cv._dpRo=null; } }catch(e){} }

  /* ════ RENDER-ORCHESTRIERUNG ════ */
  function renderAll(){
    renderScoreHero(); renderKpiCards(); renderStatus(); renderBoardOrCards(); try{renderSteuerKette();}catch(e){}
    renderOverview(); renderProjTable(); loadPasses(); if(window._dashLoadSharedPasses)window._dashLoadSharedPasses(); try{ if(window.DealPilotMandanten) DealPilotMandanten.renderHalterChips(); }catch(e){} /* mand-chips-init v803 */
  }

  /* ════ DASHBOARD-MARKUP (in #dashboard-main injecten) ════ */
  function ensureMarkup(){
    var m=$(MOUNT_ID); if(!m) return false;
    if(m.getAttribute('data-dp-built')==='1') return true;
    function chartCard(id,ico,title,sub,badge,tall,erkl){
      return '<div class="chart"><div class="ch"><div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+ico+'"/></svg></div>'
        + '<div><div class="ct">'+title+'</div><div class="cs">'+sub+'</div></div>'
        + '<span class="badge">'+badge+'</span></div>'
        + '<div class="chart-box'+(tall?' tall':'')+'"><canvas id="'+id+'"></canvas></div>'+(erkl?'<p class="cp-erkl">'+erkl+'</p>':'')+'</div>';   /* v2951: Erklaerung unter jedem Chart */
    }
    /* v2950 \u00b7 Karte im Stil von chartCard, aber mit HTML-Koerper statt Canvas */
    function htmlCard(id,ico,title,sub,badge,erkl){
      return '<div class="chart vb-card"><div class="ch"><div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+ico+'"/></svg></div>'
        + '<div><div class="ct">'+title+'</div><div class="cs">'+sub+'</div></div>'
        + '<span class="badge">'+badge+'</span></div>'
        + '<div id="'+id+'" class="vb-body"><div class="dp-chart-loading"><span class="dp-spin"></span>laden\u2026</div></div>'+(erkl?'<p class="cp-erkl">'+erkl+'</p>':'')+'</div>';
    }
    m.innerHTML =
      '<div id="dp-stage" class="stage fc fc9"><div class="app">'
      + '<div class="sl sl-head"><span class="e">01</span><h2>Portfolio Score</h2><span class="tag">Gesamtbewertung</span><span class="rule"></span>'
      + '<span class="cp-objsel"><span class="cp-objsel-lab">Objekt</span><select id="dp-dash-objsel" onchange="DealPilotDashboard.selectObject(this.value)"></select></span><span id="dp-halter-filter" class="mand-chips"></span></div>'  /* mand-chips v803 */
      + '<div class="hero" id="dp-pscore-hero"></div>'
      /* v2951 \u00b7 Umschalter Einfach | Genau (Merker dp_cockpit_ansicht) und die Kernaussagen */
      + '<div class="cp-frei cp-ansicht"><div class="cp-ans-t"><b>Ansicht</b><span><b>Einfach:</b> das Wichtigste auf einen Blick. <b>Genau:</b> alle Zahlen, Tabellen und Grafiken.</span></div>'
      +   '<div class="cp-ans-sw" role="group" aria-label="Ansicht"><button type="button" data-a="einfach" onclick="DealPilotDashboard.ansicht(\'einfach\')">Einfach</button><button type="button" data-a="genau" onclick="DealPilotDashboard.ansicht(\'genau\')">Genau</button></div></div>'
      + '<div id="dp-einfach" class="cp-frei cp-nur-einfach"></div>'
      + '<div class="sl" data-sek="kennzahlen" data-cp="genau"><span class="e">02</span><h2>Kennzahlen</h2><span class="tag">Portfolio \u00b7 aggregiert</span><span class="rule"></span></div>'
      + '<div id="dp-overview-strip" class="overview-strip cp-kz-wrap"></div>'   /* v3227: Kennzahlen-Karte, die Health-Leiste ist darin aufgegangen */
      + '<div id="dp-gesamtbew"></div>'   /* v2951 \u00b7 Gesamtbewertung */
      /* v2950 \u00b7 Abschnitt 03 \u2014 Bestand gegen Zielbild fuer das ganze Portfolio (renderZielbild).
         Die Abschnitte dahinter ruecken eine Nummer auf (04 Geteilte Objekte \u2026 09 Jahresabschluss). */
      + '<div class="sl" data-sek="zielbild" data-cp="genau"><span class="e">03</span><h2>Bestand &amp; Zielbild</h2><span class="tag">Potenzial \u00b7 alle Objekte</span><span class="rule"></span></div>'
      + '<div id="dp-zielbild" class="zb-wrap"></div>'
      /* v2951 \u00b7 hier haengt sich der Portfolio-Pilot ein (portfolio-pilot.js mount) - in beiden Ansichten */
      + '<div id="dp-pp-slot" class="cp-frei"></div>'
      /* v2410 \u00b7 19.10.2026 \u00b7 DAS KANBAN-BOARD IST ABGESCHALTET (Marcel: \u201edas
         Kanban-Board erst mal rausnehmen"). Der Abschnitt \u201e03 Objekte"
         (In Pruefung / Gewonnen / Verloren, kanbanCardHtml) wird nicht mehr
         eingebaut; renderBoardOrCards() findet #dp-board nicht und kehrt
         sofort zurueck. Der Code bleibt stehen, Daten sind nicht betroffen
         (der Deal-Status lebt im Objekt). Die Abschnitte dahinter r\u00fccken
         eine Nummer auf (03 Geteilte Objekte \u2026 08 Jahresabschluss).
         Wiederherstellen: die zwei Zeilen unten wieder einkommentieren und
         die Nummern zurueckziehen (help.js, prozess-atlas.js mitziehen).
      + '<div class="sl"><span class="e">03</span><h2>Objekte</h2><span class="tag">Kanban \u00b7 Karte antippen = aufklappen</span><span class="rule"></span></div>'
      + '<div class="gates" id="dp-board"></div>'
      */
      /* v3234 \u00b7 Marcel 09.11.2026: \u201eIm Portfolio Cockpit bitte geteilte Objekte rausnehmen.\u201c
         Der Abschnitt 04 \u201eGeteilte Objekte\u201c (#dp-shared-passes) ist raus, auch wenn noch
         P\u00e4sse bestehen; der Lader unten (dpfk-f3-dash-v1) findet keinen Platz mehr und
         kehrt sofort zur\u00fcck. Die Abschnitte dahinter r\u00fccken eine Nummer auf
         (04 Steuer \u2026 07 Steuer-Mappe; help.js und prozess-atlas.js mitgezogen). */
      /* v1400 · Abschnitt 05 — die ECHTEN Zahlen, nicht die Modellprojektion.
         Deshalb steht er VOR „Projektion & Verlauf" und traegt kein
         „vereinfacht": er rechnet mit den steuerlichen Ergebnissen, die
         jedes Objekt selbst hinterlegt hat. */
      + '<div class="sl" data-sek="steuer" data-cp="genau"><span class="e">04</span><h2>Steuer \u00fcber alle Objekte</h2>'
      +   '<span class="tag" title="Rechnet mit den ECHTEN steuerlichen Ergebnissen deiner Objekte (Tab Steuern), nicht mit den pauschalen Annahmen der Modellprojektion.\n\nDie Objekte stehen in der Reihenfolge ihres Kaufs \u2014 jedes trifft auf das Einkommen, das die vorherigen bereits verschoben haben.\n\nGesellschaften werden getrennt gef\u00fchrt: K\u00f6rperschaftsteuer ist proportional und wirkt nicht auf dein privates Einkommen.">Echte Objektdaten \u00b7 \u00a7 32a / \u00a7 8 KStG</span>'
      +   '<span class="rule"></span></div>'
      + '<div id="dp-steuerkette" class="sk-wrap"></div>'
      /* v3321 · Marcel 12.11.2026: „Steuer über alle Objekte und unten nochmal die Steuermappe -
         vielleicht kann man das kombinieren.“ Die Mappe steht jetzt im Abschnitt 04 unter der
         Steuerkette (eigener Kopf .dp-mappe-k); der Abschnitt 07 ist weg. */
      + '<div class="dp-mappe"><div class="dp-mappe-k">Steuer-Mappe <span>PDF für die Anlage V · § 21 EStG</span></div>'
      +   '<div class="dp-mappe-t">Ein PDF über <b>alle</b> Objekte mit erfassten Steuerdaten — je Objekt eine Aufstellung der Werbungskosten, am Ende eine Zusammenfassung mit Summe.</div>'
      +   '<div class="dp-mappe-r">'
      +     '<label class="dp-mappe-l">Veranlagungsjahr</label>'
      +     '<select id="dp-mappe-jahr" class="dp-mappe-sel"></select>'
      +     '<label class="dp-mappe-cb"><input type="checkbox" id="dp-mappe-av" checked> Anlage-V-Zuordnung anhängen</label>'
      +     '<button class="dp-mappe-btn" onclick="DealPilotDashboard.steuerMappe()">Steuer-Mappe erstellen</button>'
      +   '</div>'
      /* v1218b · Der Hinweis stammte aus v1215, als es die Zuordnung noch
         nicht gab. Seit v1217/v1218 gibt es sie — und damit stand direkt
         unter der Checkbox „Anlage-V-Zuordnung anhängen" der Satz, sie sei
         „nicht enthalten". Ein Widerspruch in einer Zeile Abstand. */
      +   '<div class="dp-mappe-h">Zeilennummern aus dem amtlichen Formular des Jahres – für Jahre ohne hinterlegte Zuordnung entfällt die Anlage-V-Ansicht, statt zu raten.</div>'
      + '</div>'
      + '<details id="dp-charts-sec" data-sek="projektion" data-cp="genau" open><summary class="sl dp-charts-summary"><span class="e">05</span><h2>Projektion &amp; Verlauf</h2><span class="tag mp-info" title="Modellprojektion mit pauschalen Annahmen \u2013 nicht die centgenaue Objekt-Rechnung:\n\u2022 Mietsteigerung +1,5 % p.a.\n\u2022 Bewirtschaftung +2,0 % p.a.\n\u2022 Wertsteigerung +2,0 % p.a.\n\u2022 AfA 2,0 % (Geb\u00e4udeanteil 80 %)\n\u2022 Kalkulationszins ~3,5 %\nDient als Trend und Gr\u00f6\u00dfenordnung; die exakte Berechnung erfolgt je Objekt im Objekt-Tab.">Modellprojektion (vereinfacht)</span><span class="yrs sl-yrs" id="dp-proj-years"><button data-y="10" onclick="event.stopPropagation();event.preventDefault();DealPilotDashboard.setProjYears(10)">10 J.</button><button data-y="20" class="active" onclick="event.stopPropagation();event.preventDefault();DealPilotDashboard.setProjYears(20)">20 J.</button><button data-y="30" onclick="event.stopPropagation();event.preventDefault();DealPilotDashboard.setProjYears(30)">30 J.</button></span><span class="dp-charts-hint">ein-/ausblenden</span></summary>'
      /* v2950 \u00b7 Vermoegensbericht statt sieben Diagrammen (buildCharts) */
      + '<div class="charts vb-charts">'
      + '<div id="dp-vb-strip" class="vb-strip"></div>'
      + '<p class="cp-erkl vb-strip-erkl">Wert = Summe der Kaufpreise, Eigenkapital = Wert − Restschuld. Rechts der Stand am Ende der Projektion.</p>'
      + htmlCard('dp-vb-bilanz','M3 21h18M5 21V9h4v12M13 21V5h4v16','Verm\u00f6gensbilanz heute','Aktiva je Objekt \u00b7 Passiva Restschuld und Eigenkapital','Bilanz','<b>So liest du sie:</b> Links steht, was du besitzt (jedes Objekt mit seinem Kaufpreis), rechts, wem es geh\u00f6rt \u2013 der Bank (Restschuld) und dir (Eigenkapital). Beide Seiten sind immer gleich hoch, weil Eigenkapital genau der Rest ist: Wert minus Schulden.')
      + chartCard('dpc-vb-eq','M3 17l6-6 4 4 8-8','Eigenkapital-Entwicklung','Restschuld + Eigenkapital = Objektwert','Modell',true,'Die ganze Fl\u00e4che ist der Objektwert. Unten der Teil der Bank (Restschuld), oben dein Teil (Eigenkapital). Mit jeder Tilgung schrumpft der dunkle Teil, mit jeder Wertsteigerung w\u00e4chst der goldene \u2013 die Achse beginnt bei null.')
      + chartCard('dpc-vb-quellen','M4 20V10M10 20V4M16 20v-7M22 20H2','Woraus das Verm\u00f6gen w\u00e4chst','je Jahr: Schuldenabbau, Wertsteigerung, \u00dcberschuss','\u20ac/Jahr',true,'Jede S\u00e4ule ist der Verm\u00f6genszuwachs eines Jahres aus drei Quellen: <b>Schuldenabbau</b> (Tilgung \u2013 die Mieter zahlen deinen Kredit ab), <b>Wertsteigerung</b> der Objekte (Modell +2 % im Jahr; im ersten Jahr steht der Wert noch auf dem Kaufpreis) und der <b>\u00dcberschuss nach Steuer</b>, der dir bar bleibt. Ein negativer Teil unter null hei\u00dft: in dem Jahr musst du zuschie\u00dfen.')
      + htmlCard('dp-vb-objekte','M12 2a10 10 0 1 0 10 10H12z','Verm\u00f6gen nach Objekt','Objektwert = Restschuld + Eigenkapital \u00b7 Verteilung nach Lage','Struktur','Je Objekt ein Balken: dunkel der Teil der Bank, gold dein Eigenkapital. Darunter, wie sich die Objektwerte auf die Orte verteilen \u2013 ein Ort mit gro\u00dfem Anteil ist ein Klumpen: entwickelt sich dieser Markt schlecht, trifft es einen gro\u00dfen Teil des Verm\u00f6gens.')
      + '<div class="vb-fuss">Wertansatz der Objekte ist der Kaufpreis; die Entwicklung folgt der Modellprojektion (Wert +2,0 % p.a., Miete +1,5 % p.a., Zins rund 3,5 %). Kein Verkehrswert. Die Zahlen Jahr f\u00fcr Jahr stehen in der Tabelle 06.</div>'
      + '</div></details>'
      + '<div class="sl" data-sek="gesamtproj" data-cp="genau"><span class="e">06</span><h2>Gesamt-Projektion</h2><span class="tag mp-info" title="Modellprojektion mit pauschalen Annahmen \u2013 nicht die centgenaue Objekt-Rechnung:\n\u2022 Mietsteigerung +1,5 % p.a.\n\u2022 Bewirtschaftung +2,0 % p.a.\n\u2022 Wertsteigerung +2,0 % p.a.\n\u2022 AfA 2,0 % (Geb\u00e4udeanteil 80 %)\n\u2022 Kalkulationszins ~3,5 %\nDient als Trend und Gr\u00f6\u00dfenordnung; die exakte Berechnung erfolgt je Objekt im Objekt-Tab.">Modellprojektion (vereinfacht)</span><span class="rule"></span></div>'
      + '<div class="proj" id="dp-proj-box"><div class="ph"><span class="t">Cashflow &amp; Verm\u00f6gensaufbau</span><span class="tag">Modellprojektion</span>'
      +   '<span class="pj-sw" role="group" aria-label="Darstellung"><button type="button" data-a="tabelle" class="on" onclick="DealPilotDashboard.projAnsicht(\'tabelle\')">Tabelle</button><button type="button" data-a="chart" onclick="DealPilotDashboard.projAnsicht(\'chart\')">Chart</button></span></div>'
      + '<div class="pw"><table class="pt" id="dp-proj-table"></table></div>'
      + '<div class="pj-chart"><div class="pj-box"><canvas id="dpc-proj-mix"></canvas></div><p class="cp-erkl">Alle Reihen der Tabelle in einem Bild: <b>Miete</b> als S\u00e4ulen und <b>Cashflow vor und nach Steuer</b> auf der linken Achse, <b>Restschuld</b> und <b>Eigenkapital</b> auf der rechten. Ein Klick auf einen Eintrag der Legende blendet die Reihe aus oder ein.</p></div></div>'
      /* v1215-mappe · (bis v3317 Abschnitt 07, seit v3321 in 04) — der erste Export-Knopf im Cockpit.
         Gemessen am 03.09.2026: das Cockpit hatte keinen einzigen. Marcels
         Entscheidung vom 30.08.: die Auswahl gehoert hierher, zusammen mit
         dem Jahr. Die Objektauswahl kann der Export bereits (opts.objectIds),
         die Oberflaeche dafuer fehlt noch — deshalb steht hier, dass ALLE
         Objekte des Jahres genommen werden, statt es offenzulassen. */
      /* v3228 · Abschnitt 09 „Jahresabschluss“ ist nach Einstellungen / Mandanten gewandert
         (Knopf an der Karte der GmbH/UG, Marcel 08.11.2026). Seit v3321 endet das Cockpit mit 06 Gesamt-Projektion; die Steuer-Mappe steht in 04. */
      + '</div></div>';
    m.setAttribute('data-dp-built','1');
    /* v1215-mappe: Stil und Jahresliste erst hier — vorher gibt es das
       Dropdown nicht, und die Liste kommt aus echten Saetzen. */
    try { _mappeCss(); _mappeJahreLaden(); } catch (e) {}
    /* v2951: Abschnitte gruppieren (Einklappen), Ansicht Einfach|Genau setzen */
    try { var _app = m.querySelector('#dp-stage > .app'); if (_app) _sekGruppieren(_app); ansicht(); } catch (e) { console.warn('[v2951] Abschnitte', e); }
    return true;
  }

  function exportPortfolioPdf(){
    // Gesamt-Portfolio-PDF: vorerst Track-Record als Gesamtdokument
    headerTrackRecord();
  }

  /* ════ DS2-Score-Leiste oben ausblenden (Handoff: gehoert im Dashboard weg) ════ */
  var _dpHidden = [];   // gemerkte Elemente fuer sauberes Restore
  var _dpHiddenSiblings = [];   // v452.12: ausgeblendete leere .body-Geschwister
  var _dpQuickVorher = null;    // v1905: inline-display von #s-quick VOR dem Cockpit
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
    /* v452.3: Quick-Check explizit weg.
       v1905: und zwar mit GEMERKTEM Vorzustand. `closeDashboard()` setzte ihn
       blind auf '' zurueck — ein Schliesser, der etwas anderes OEFFNET. Solange
       nur `setMainView` ihn rief, fiel das nicht auf; seit die Strategie ihn
       ueber das Ansichts-Register mitruft, wuerde er den Quick-Check
       (`.sec-hidden.active{display:block}`, style.css:4049) wieder aufmachen. */
    var quick=$('s-quick');
    if(quick){ if(_dpQuickVorher===null) _dpQuickVorher=quick.style.display; quick.style.display='none'; }
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
    /* v1896a · Die Teilchen haengen nicht mehr am Laden der Daten.
       Vorher stand ihr einziger Aufruf in loadSummaries().then(...) — schlug der Abruf fehl
       oder kam die Kette nicht dorthin, lief die Animation nie, und niemand sah einen Fehler.
       Teilchen brauchen keine Zahlen; sie starten, sobald die Flaeche steht. Der spaetere
       Aufruf in der Kette bleibt stehen und ist dann ein billiger Nachzieher (initParticles
       legt den Canvas nur an, wenn es ihn noch nicht gibt). */
    setTimeout(initParticles, 120);
    var tog=document.querySelector('.dp-sidebar-toggle'); if(tog)tog.classList.add('dp-show');
    applyTheme();
    startPlanWatch();   // v452.6: Plan-Wechsel automatisch spiegeln

    // Sofort: Summaries laden + Score/KPI/Status/Kanban rendern
    renderScoreHero(); renderStatus();
    var _dpLoadHost=$('dp-overview-strip'); if(_dpLoadHost) _dpLoadHost.innerHTML='<div class="dp-chart-loading"><span class="dp-spin"></span>laden…</div>';
    loadSummaries().then(function(){
      renderScoreHero(); renderStatus(); renderBoardOrCards(); loadPasses(); if(window._dashLoadSharedPasses)window._dashLoadSharedPasses();
      setTimeout(initParticles, 250);   // v452.6: nach Layout, sonst Canvas 0x0
      // Hintergrund: Details nachladen -> Health/KPIs/Charts/Tabelle
      return loadDetails();
    }).then(function(){
      renderScoreHero(); renderKpiCards(); renderOverview(); renderProjTable(); buildCharts(); try{renderSteuerKette();}catch(e){}
    }).catch(function(e){
      var _dpErrHost=$('dp-overview-strip'); if(_dpErrHost) _dpErrHost.innerHTML='<div class="gempty">Daten konnten nicht geladen werden: '+esc(e.message)+'</div>';
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
    /* v1905: zurueck auf den gemerkten Vorzustand statt pauschal auf '' — siehe
       die Begruendung in openDashboard(). Ohne Merker ist nichts zu tun. */
    var quick=$('s-quick');
    if(quick && _dpQuickVorher!==null){ quick.style.display=_dpQuickVorher; _dpQuickVorher=null; }
    stopParticles(); destroyCharts();
  }

  /* ════ setMainView-WRAP (orig sichern, 'dashboard' abfangen) ════ */
  function installWrap(){
    if(window._dpDashWrapInstalled) return;
    var orig = window.setMainView;
    if(typeof orig!=='function'){ setTimeout(installWrap,300); return; }
    window.setMainView = function(view){
      if(view==='dashboard'){
        /* v1905: Das Cockpit ist die EINZIGE Ansicht, die diesen Wrap nimmt und
           `orig` nie erreicht — es muss die anderen deshalb selbst abraeumen.
           Ueber das Register, nicht ueber eine eigene Liste. */
        try{ if(window.DealPilotAnsichten) window.DealPilotAnsichten.abraeumen('dashboard'); }catch(e){}
        openDashboard(); return;
      }
      closeDashboard();          // bei single/all Dashboard ausblenden
      return orig.apply(this, arguments);
    };
    /* v1905: …und damit JEDE andere Ansicht das Cockpit zumachen kann, ohne es
       zu kennen (Befund N38: die Portfolio-Strategie konnte es nicht). */
    try{ if(window.DealPilotAnsichten) window.DealPilotAnsichten.melde('dashboard', closeDashboard); }catch(e){}
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
    var tcol=total==null?'var(--dp-gold)':(total>=70?'#3FA56C':total>=50?'var(--wl-c9a84c, #C9A84C)':'#B86250');
    /* v1861: ein Wort, eine Kette (score-tiers.js) */
    var tlab=total==null?'\u2013':((window.ScoreTier&&ScoreTier.stufe)?ScoreTier.stufe(total).wort:(total>=85?'Sehr gut':total>=70?'Gut':total>=50?'Solide':total>=35?'Schwach':'Kritisch'));
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

  /* ════ v1215-mappe · Steuer-Mappe im Cockpit ════
     Das Jahr-Dropdown wird aus den WIRKLICH vorhandenen Steuersätzen gefüllt,
     nicht aus einer geratenen Jahresliste: wer ein Jahr wählen kann, für das
     es keine Daten gibt, bekommt ein leeres PDF und sucht den Fehler bei sich.
     Voreingestellt ist das jüngste Jahr, für das Sätze da sind. */
  var _mappeJahre = null;
  async function _mappeJahreLaden() {
    var sel = document.getElementById('dp-mappe-jahr');
    if (!sel || sel.dataset.gefuellt === '1') return;
    sel.innerHTML = '<option value="">lädt…</option>';
    try {
      var r = await Auth.apiCall('/tax-records?from=2000&to=2100');
      var recs = (r && r.records) || [];
      _mappeJahre = {};
      recs.forEach(function (s) { _mappeJahre[s.year] = (_mappeJahre[s.year] || 0) + 1; });
      var jahre = Object.keys(_mappeJahre).map(Number).sort(function (a, b) { return b - a; });
      if (!jahre.length) {
        sel.innerHTML = '<option value="">keine Steuerdaten erfasst</option>';
        sel.disabled = true;
        var b = document.querySelector('.dp-mappe-btn');
        if (b) { b.disabled = true; b.style.opacity = '.45'; b.style.cursor = 'not-allowed'; }
        sel.dataset.gefuellt = '1';
        return;
      }
      /* v1215c · Vorausgewählt ist das VERANLAGUNGSJAHR, nicht das jüngste.
         Die gespeicherten Sätze reichen bis 2040, weil sie auch die Projektion
         tragen — im Feld stand deshalb "2040 · 4 Objekte". Für eine
         Steuermappe will das niemand. Genommen wird das letzte abgeschlossene
         Jahr, wenn es dafür Sätze gibt, sonst das nächstkleinere vorhandene. */
      var _ziel = new Date().getFullYear() - 1;
      var _vor = (jahre.indexOf(_ziel) >= 0) ? _ziel
               : (jahre.filter(function (j) { return j <= _ziel; })[0] || jahre[0]);
      sel.innerHTML = jahre.map(function (j) {
        return '<option value="' + j + '">' + j + '  ·  ' + _mappeJahre[j]
             + ' Objekt' + (_mappeJahre[j] === 1 ? '' : 'e') + '</option>';
      }).join('');
      sel.value = String(_vor);
      sel.disabled = false;
      sel.dataset.gefuellt = '1';
    } catch (e) {
      sel.innerHTML = '<option value="">nicht abrufbar</option>';
    }
  }

  async function steuerMappe() {
    var sel = document.getElementById('dp-mappe-jahr');
    var jahr = sel && sel.value ? parseInt(sel.value, 10) : 0;
    if (!jahr) {
      if (typeof toast === 'function') toast('Bitte erst ein Veranlagungsjahr wählen.');
      return;
    }
    if (typeof exportSteuerMappePDF !== 'function') {
      if (typeof toast === 'function') toast('✗ Steuer-Modul nicht geladen — Seite neu laden.');
      return;
    }
    var btn = document.querySelector('.dp-mappe-btn');
    var alt = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'erstelle…'; }
    var avEl = document.getElementById("dp-mappe-av");
    try { await exportSteuerMappePDF(jahr, { anlageV: !!(avEl && avEl.checked) }); }
    catch (e) { if (typeof toast === 'function') toast('✗ ' + (e.message || e)); }
    finally { if (btn) { btn.disabled = false; btn.textContent = alt; } }
  }

  /* v3228 · Hier standen bis v3227 _abschlussInit(), _abschlussJahre() und
     jahresabschluss() fuer Abschnitt 09 „Jahresabschluss“. Marcel 08.11.2026:
     „Jahresabschluss bitte unter Mandanten zu der jeweiligen Gesellschaft.“
     Der einzige Weg ist jetzt der Knopf an der Karte der GmbH/UG unter
     Einstellungen / Mandanten (mandanten.js openJahresabschluss). */

  function _mappeCss() {
    if (document.getElementById('dp-mappe-css')) return;
    var s = document.createElement('style');
    s.id = 'dp-mappe-css';
    s.textContent =
      '.dp-mappe{padding:14px 16px 16px;border:1px solid rgba(128,128,128,.22);border-radius:9px;margin:2px 0 18px}'
    + '.dp-mappe-t{font-size:13.5px;line-height:1.55;margin-bottom:12px}'
    + '.dp-mappe-r{display:flex;align-items:center;gap:10px;flex-wrap:wrap}'
    + '.dp-mappe-l{font:600 10px ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;opacity:.7}'
    + '.dp-mappe-sel{padding:7px 10px;border-radius:6px;border:1px solid rgba(128,128,128,.35);'
    +   'background:transparent;color:inherit;font-size:13px;width:auto;min-width:200px;max-width:270px}'
    + '.dp-mappe-btn{padding:8px 16px;border-radius:6px;border:0;cursor:pointer;font-size:13px;font-weight:600;'
    +   'background:var(--wl-c9a84c,#C9A84C);color:#141417}'
    + '.dp-mappe-btn:hover{filter:brightness(1.06)}'
    + '.dp-mappe-cb{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;cursor:pointer;opacity:.9}'
    + '.dp-mappe-cb input{accent-color:var(--wl-c9a84c,#C9A84C);cursor:pointer}'
    + '.dp-mappe-h{margin-top:11px;font-size:11.5px;line-height:1.5;opacity:.65}';
    document.head.appendChild(s);
  }

  /* ════ PUBLIC API ════ */

  /* ══════════════════════════════════════════════════════════════════
     v1704 · DER PAYLOAD FUER DEN PORTFOLIO-PILOTEN
     ══════════════════════════════════════════════════════════════════
     Marcel: „im Portfolio Cockpit auch einen Piloten ... der mir zu jeder
     Immobilie aber auch zur Vermoegensbilanz des gesamten Portfolios
     Fragen beantworten kann."

     Beides steht hier schon: `aggStats()` ist die Aggregat-SSoT,
     `projectAll()` fuehrt Restschuld, Wert und Eigenkapital ueber die
     Jahre fort, `aggregateScore()` gewichtet die Einzel-Scores. Der
     Pilot rechnet davon NICHTS nach - er liest.

     > Eine zweite Aggregation waere eine zweite Wahrheit. Das Cockpit
     > hat davon schon drei (`aggStats`, `updateSidebarPortfolio`,
     > `_renderPortfolioHeader`), und sie laufen bereits auseinander.

     JE OBJEKT werden nur die Kernfelder mitgegeben, nicht der rohe
     data-Blob: der Prompt hat eine Grenze, und ein Payload, der sie
     reisst, faellt genau dann um, wenn das Portfolio gross genug ist,
     um interessant zu werden. */
  var PP_MAX_OBJEKTE = 60;

  /* ══ v2164 · DIE PILOT-ANALYSE JE OBJEKT GEHT MIT ═════════════════════
     Marcel am 13.10.2026: „Pruefe danach die Portfolio Piloten, ob der jetzt
     auch alle Infos aus den Pilot-Analysen der einzelnen Objekte bekommt."
     Gemessen: NEIN. Alle neun gewonnenen Objekte auf Staging tragen eine
     Analyse (`_ai`), der Auszug unten las sie nie - der Portfolio-Pilot
     sah nur Rohzahlen und sollte trotzdem sagen, „welche tragen, welche
     belasten".

     Ein AUSZUG, nicht die ganze Analyse: der Deckel liegt bei 60 Objekten
     (v2014). Gekuerzt wird hart, und der Stand steht dabei - eine alte
     Analyse darf nicht wie eine neue gelesen werden. */
  function _ppAnalyse(o) {
    function lies(roh) { if (!roh) return null; if (typeof roh === 'string') { try { roh = JSON.parse(roh); } catch (e) { return null; } } return (roh && typeof roh === 'object') ? roh : null; }
    function stand(x) { return (x && x._fuer && x._fuer.stand) || ''; }
    var k1 = lies(o && o._ai_spalte), k2 = lies(o && o._ai);
    /* v2170b: die NEUERE von Spalte und Kopie */
    var a = (k1 && k2) ? (stand(k1) >= stand(k2) ? k1 : k2) : (k1 || k2);
    if (!a) return null;
    function k(t, n) { t = (t == null) ? '' : String(t).replace(/\s+/g, ' ').trim(); return t ? (t.length > n ? t.slice(0, n - 1) + '\u2026' : t) : null; }
    function liste(x, m, n) {
      if (!Array.isArray(x)) return null;
      var r = x.slice(0, m).map(function (e) {
        return k(typeof e === 'string' ? e : (e && (e.titel || e.text || e.punkt || e.risiko || JSON.stringify(e))), n);
      }).filter(Boolean);
      return r.length ? r : null;
    }
    var f = a._fuer || {};
    return {
      stand: f.stand ? String(f.stand).slice(0, 10) : null,
      empfehlung: k(a.empfehlung, 40),
      fazit: k(a.gesamtbewertung || a.fazit_kurz, 420),   /* v2170: fazit_kurz ist nur das Urteilswort */
      risiken: liste(a.risiken, 3, 140),
      staerken: liste(a.staerken, 3, 140),
      steuer: k(a.steuer_zusammenfassung, 260),
      soll_ist_steuer: k(a.soll_ist_steuer, 220)
    };
  }

  function _ppZahl(v) {
    var n = num(v);
    return (v == null || v === '' || !isFinite(n)) ? null : n;
  }

  function portfolioPayload() {
    /* v1813 · IMMER das ganze Portfolio, auch wenn im Cockpit gerade ein
       einzelnes Objekt ausgewaehlt ist. */
    var arr = detailArr(true);
    var a = aggStats(true);

    var objekte = arr.slice(0, PP_MAX_OBJEKTE).map(function (o, i) {
      var kp = _kpEuro(o);
      var mieteJ = _ppZahl(o._kpis_miete_j);
      if (mieteJ == null) { var mm = num(o.nkm) + num(o.ze); mieteJ = mm > 0 ? mm * 12 : null; }
      return {
        /* v1813 · DIE ID IST DIE REFERENZ, NICHT DIE NUMMER.
           Gemessen: Bot-Liste Nr 8 und Spiegel nr 8 sind verschiedene
           Haeuser, und zwei Objekte tragen denselben Namen. Ohne diese
           Zeile beantwortet der Bot eine Frage zum falschen Objekt — und
           die Antwort sieht aus wie die richtige. */
        id: o._key || (o._sum && (o._sum.id || o._sum.key)) || null,
        nr: i + 1,
        name: o.name || o._name || null,
        ort: o.ort || null,
        objektart: o.objart || o.objektart || null,
        /* == v2014 - SECHS FELDER ZUR SUBSTANZ ======================

           Der Analyse-Auftrag des Cockpits verlangt woertlich
           "Klumpenrisiken - Lage, Objektart, Finanzierung, auslaufende
           Zinsbindungen". Dafuer standen hier bisher 24 Felder, alles
           Zahlen und Namen: als "Lage" nur `ort`, kein Zustand, keine
           Energieklasse, kein Leerstand, keine Einheitenzahl.

           Nicht alle 46 Felder der Einzelanalyse (v2011): der Deckel
           liegt bei 60 Objekten, das waeren 2.760 zusaetzliche Werte -
           ein Auftrag, in dem man die Frage nicht mehr findet.
           Diese sechs sind die, nach denen gefragt wird. */
        lageklasse: o.lageklasse || null,
        zustand: o.ds2_zustand || null,
        energieklasse: o.ds2_energie || null,
        leerstand_pct: _ppZahl(o.leerstand),
        wohneinheiten: _ppZahl(o.einheiten),
        bodenrichtwert_eur_qm: _ppZahl(o.brw),
        baujahr: _ppZahl(o.baujahr),
        wohnflaeche_qm: _ppZahl(o.wfl),
        kaufpreis_eur: kp || null,
        miete_kalt_eur_jahr: mieteJ,
        cashflow_nach_steuer_eur_jahr: _ppZahl(o._kpis_cf_ns),
        cashflow_vor_steuer_eur_jahr: _ppZahl(o._kpis_cf_vs),
        eigenkapital_eur: _ppZahl(o.ek),
        darlehen_eur: (num(o.d1) + num(o.d2) + _dwO(o).betrag) || null,   /* v3215 */
        restschuld_eur: Math.round(_restschuldOf(o)) || null,
        zins_prozent: _ppZahl(o.d1z),
        tilgung_prozent: _ppZahl(o.d1t),
        /* v1802 · DIE TILGUNG IN EURO, NICHT NUR IN PROZENT.
           Marcel fragte den Bot nach der "Gesamttilgung aller Objekte".
           Er bekam eine Liste von Prozentsaetzen und die Rueckfrage, ob
           er rechnen solle — denn aus "1 %" allein wird keine Summe.

           > Eine Zahl, die das Modell jedes Mal neu ausrechnet, ist jedes
           > Mal eine neue Gelegenheit, sie anders auszurechnen. Was
           > benannt ist, wird gelesen; was gelesen wird, stimmt.

           Gerechnet wird hier, wo auch alles andere gerechnet wird — der
           anfaengliche Tilgungsbetrag ist Darlehenssumme mal Satz. Beide
           Darlehen werden einzeln genommen, weil sie verschiedene Saetze
           haben koennen. */
        tilgung_eur_jahr: (function () {
          var t = num(o.d1) * _pct(o.d1t) / 100 + num(o.d2) * _pct(o.d2t) / 100 + _dwO(o).tilg_j;   /* v3215 */
          return t > 0 ? Math.round(t) : null;
        })(),
        zins_eur_jahr: (function () {
          var z = num(o.d1) * _pct(o.d1z) / 100 + num(o.d2) * _pct(o.d2z) / 100 + _dwO(o).zins_j;   /* v3215 */
          return z > 0 ? Math.round(z) : null;
        })(),
        zinsbindung_bis: o.d1_zbind || o.d1_zinsbindung || null,
        dscr: _ppZahl(window.Dscr && Dscr.ausGespeichert ? Dscr.ausGespeichert(o) : o._kpis_dscr),   /* v3031 */
        ltv_prozent: _ppZahl(o.ltv) != null ? _ppZahl(o.ltv) : _ppZahl(o._kpis_ltv),
        bruttomietrendite_prozent: _ppZahl(o._kpis_bmy),
        dealpilot_score: _ppZahl(o._dealpilot_score),
        investor_deal_score: _ppZahl(o._ds2_score),
        pilot_analyse: _ppAnalyse(o)   /* v2164 */
      };
    });

    /* Die Projektion in Stuetzjahren statt Jahr fuer Jahr - 1, 5, 10.
       Wer zehn Zeilen liest, sieht dieselbe Kurve wie bei dreissig. */
    var proj = null;
    try {
      var p = projectAll(10, true);
      if (Array.isArray(p) && p.length) {
        proj = [1, 5, 10].map(function (j) {
          var z = p[j - 1] || p[p.length - 1];
          if (!z) return null;
          return { jahr: j, restschuld_eur: Math.round(z.rest || 0),
                   objektwert_eur: Math.round(z.wert || 0),
                   eigenkapital_eur: Math.round(z.eq != null ? z.eq : (z.wert || 0) - (z.rest || 0)) };
        }).filter(Boolean);
      }
    } catch (e) { proj = null; }

    var score = null;
    /* aggregateScore() gibt {total, hasData, n, scored, cats} - NICHT .score.
         Ausgelesen an dashboard.js:248, nicht angenommen. */
      try { var s = aggregateScore(); if (s && s.hasData && s.total != null) score = s.total; } catch (e) {}

    return {
      art: 'portfolio',
      stand: new Date().toISOString().slice(0, 10),
      anzahl_objekte: a.n,
      /* v1704: die Zahl der WIRKLICH mitgegebenen Objekte steht daneben.
         Sonst rechnet das Modell bei einem grossen Bestand gegen eine
         Summe, zu der es die Posten nicht hat - und merkt es nicht. */
      objekte_im_payload: objekte.length,
      vermoegensbilanz: {
        gesamtinvestition_eur: Math.round(a.gi) || null,
        kaufpreissumme_eur: Math.round(a.kp) || null,
        eigenkapital_eingesetzt_eur: Math.round(a.ek) || null,
        darlehen_aufgenommen_eur: Math.round(a.darl) || null,
        restschuld_heute_eur: Math.round(a.rest) || null,
        /* v1802 · Dieselbe Zahl unter dem Namen, unter dem Marcel danach
           fragt. "Aktuelle Verbindlichkeiten" IST die Restschuld — aber
           wer so fragt, soll nicht darauf angewiesen sein, dass ein
           Modell die Gleichsetzung errät. */
        verbindlichkeiten_eur: Math.round(a.rest) || null,
        tilgung_eur_jahr: Math.round(a.tilgJ) || null,
        zins_eur_jahr: Math.round(a.zinsJ) || null,
        kapitaldienst_eur_jahr: Math.round(a.kdJ) || null,
        miete_kalt_eur_jahr: Math.round(a.mieteJ) || null,
        miete_kalt_eur_monat: Math.round(a.mieteM) || null,
        cashflow_nach_steuer_eur_jahr: Math.round(a.cfNsJ) || null,
        cashflow_vor_steuer_eur_jahr: Math.round(a.cfVsJ) || null,
        bruttomietrendite_prozent: a.brutto != null ? +a.brutto.toFixed(2) : null,
        nettomietrendite_prozent: a.netto != null ? +a.netto.toFixed(2) : null,
        dscr_portfolio: a.dscr != null ? +a.dscr.toFixed(2) : null
      },
      portfolio_score: score,
      projektion: proj,
      /* v2951 \u00b7 Bestand & Zielbild und Gesamtbewertung, fertig gerechnet (Portfolio-Pilot) */
      bestand_zielbild: (function(){ try { return _zbPayload(arr); } catch (e) { return null; } })(),
      objekte: objekte
    };
  }

  window.DealPilotDashboard = {
    /* v1704: der Portfolio-Pilot liest hier - er rechnet nichts nach. */
    portfolioPayload: portfolioPayload,
    /* v2170: die Detailkopien werden sonst nur beim LOESCHEN erneuert - eine
       Pilot-Analyse aus derselben Sitzung kam beim Portfolio-Piloten nie an
       (gemessen: Stand 09.10. statt 13.10.). Vor jeder Pilot-Anfrage frisch. */
    frisch: function () { _details = {}; _detailsLoaded = false;   /* ganze Kette, s. portfolioLaden (v1793b) */
      return loadSummaries().then(function () { return loadDetails(); }); },
    /* v1793 · GEMESSEN: portfolioPayload() gibt 0 Objekte zurueck, solange
       das Dashboard nicht einmal offen war. Grund ist `_details` - ein
       Cache, den nur `loadDetails()` fuellt, und das lief bisher
       ausschliesslich in `openDashboard`. Am 02.10.2026 auf Staging
       gemessen: 17 Karten in der Seitenleiste, 9 davon gewonnen,
       `anzahl_objekte: 0`.

       > Eine Funktion, die ohne Vorbereitung eine PLAUSIBLE Null liefert,
       > ist gefaehrlicher als eine, die wirft. Der Portfolio-Spiegel
       > haette eine leere Vermoegensbilanz abgelegt, und der Bot haette
       > "du hast kein Portfolio" gesagt.

       Deshalb geht der Lader mit nach aussen. `portfolioPayload()` bleibt
       unveraendert synchron - wer die Zahlen will, laedt vorher.

       v1793b · UND ZWAR DIE GANZE KETTE. Mein erster Versuch exportierte
       nur `loadDetails` - danach stand da immer noch 0, weil die Kette
       einen Schritt frueher beginnt:

         loadSummaries()  fuellt _summaries  (die Liste vom Server)
              v
         wonList()        filtert auf 'won'
              v
         loadDetails()    fuellt _details    (die vollen Datensaetze)
              v
         detailArr()      -> aggStats() -> portfolioPayload()

       > Eine Vorbereitung auf jedem Einzelschritt ergibt keine
       > Vorbereitung auf dem Ganzen. Wer nur den letzten Schritt
       > exportiert, laedt Details zu einer Liste, die es noch nicht gibt -
       > und bekommt wieder eine plausible Null.

       Deshalb EINE Funktion, die beides tut. Sie laesst sich nicht
       halb aufrufen. */
    portfolioLaden: function () {
      return loadSummaries().then(function () { return loadDetails(); });
    },
    /* v3217 · W-11 Vermögensaufstellung (vermoegen.js): die Objekte im Bestand mit
       denselben Helfern wie die Vermögensbilanz (_kpEuro, _restschuldOf) - keine
       zweite Rechnung. Marktwert nach DpWertangabe.marktwert (ohne Wert-Anker der
       Kaufpreis, wie im Track Record). Vorher portfolioLaden() aufrufen. */
    vermoegenObjekte: function () {
      return detailArr(true).map(function (o) {
        var kp = _kpEuro(o), mw = kp, hat = false;
        try { if (window.DpWertangabe) { var r = window.DpWertangabe.aufloesen(o); hat = !!(r && r.wert && r.herkunft !== 'indikation'); mw = window.DpWertangabe.marktwert(o, kp) || kp; } } catch (e) {}
        return { key: o._key, name: _objName(o), ort: (o._ort || o.ort || ''), kaufpreis: kp, marktwert: mw, hatMarktwert: hat, rest: _restschuldOf(o) };
      }).filter(function (x) { return x.kaufpreis > 0 || x.rest > 0; });
    },
    open: openDashboard, close: closeDashboard,
    setProjYears: setProjYears, setCardView: setCardView,
    steuerMappe: steuerMappe,   /* v1215-mappe */
    /* v3228 · jahresabschluss() ist nach Einstellungen / Mandanten gewandert: DealPilotMandanten.openJahresabschluss(id) */
    cardPdf: cardPdf, cardDelete: cardDelete,
    headerTrackRecord: headerTrackRecord, exportPortfolioPdf: exportPortfolioPdf,
    toggleSidebar: toggleSidebar, setTheme: setTheme, applyTheme: applyTheme,
    showScoreDetails: showScoreDetails, showScoreUpgrade: showScoreUpgrade, closeScoreModal: _scoreModalClose,
    toggleCf: toggleCf,
    toggleGi: toggleGi,
    /* v2099: die Bestand-Kachel ruft es per onclick-Zeichenkette - ohne
       diesen Export waere der Schalter ein toter Klick. */
    toggleStand: toggleStand,
    toggleSeitAnkauf: toggleSeitAnkauf,   /* v2950 */
    ansicht: ansicht, zumZielbild: zumZielbild, projAnsicht: projAnsicht, pilotZielbild: pilotZielbild,   /* v2951 */
    zielbildPayload: function(){ return _zbPayload(detailArr(true)); },   /* v2951 · Portfolio-Pilot */
    toggleRoe: function(){ window._dpRoeMode=(window._dpRoeMode==='nach')?'vor':'nach'; try{ renderHealth(); }catch(e){} },
    openObject: function(k){ try{ if(typeof window.loadSaved==='function') window.loadSaved(k); }catch(e){} },
    toggleZins: function(){ window._dpZinsMode=(window._dpZinsMode==='risiko')?'zins':'risiko'; try{ renderHealth(); }catch(e){} },
    selectObject: selectObject,
    /* v1400: nach aussen, damit die Kette pruefbar ist — der Prueflauf im
       Container ruft genau diese Funktion, nicht eine Nachbildung. */
    steuerKette: function(jahr){ return steuerKette(jahr); },
    renderSteuerKette: function(){ try{ renderSteuerKette(); }catch(e){} },
    /* v1405: Ansicht der Steuerkette umschalten — 'stufen' oder 'kurve'. */
    ketteAnsicht: function(v){ _ketteAnsicht = (v === 'kurve') ? 'kurve' : 'stufen'; try{ renderSteuerKette(); }catch(e){} },
    applyHalterFilter: function(id){ try{ window._dpHalterFilter=id; }catch(e){} try{ renderScoreHero(); }catch(e){} try{ renderOverview(); }catch(e){} try{ renderKpiCards(); }catch(e){} try{ buildCharts(); }catch(e){} try{ renderProjTable(); }catch(e){} try{ if(window.DealPilotMandanten) DealPilotMandanten.renderHalterChips(); }catch(e){} },  /* mand-export v803 */
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
  var BTN="background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 12%, transparent);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);color:var(--wl-e8cc7a, #E8CC7A);border-radius:7px;padding:3px 9px;font-size:11.5px;cursor:pointer";
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
      /* v3224 \u00b7 Marcel 08.11.2026: Teilen raus - der Satz verwies auf den Knopf \u201eQuick Boarding teilen\u201c, den es nicht mehr gibt.
         Bestehende P\u00e4sse stehen weiter hier (Verl\u00e4ngern / Beenden). */
      /* v3230: ohne geteilte Objekte verschwindet der ganze Abschnitt 04 (Marcel: Teilen raus) */
      h.innerHTML=''; h.style.display='none';
      var _sl=document.querySelector('.sl[data-sek="geteilt"]'); if(_sl) _sl.style.display='none';
      return;
    }
    h.style.display=''; var _sl2=document.querySelector('.sl[data-sek="geteilt"]'); if(_sl2) _sl2.style.display='';
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
