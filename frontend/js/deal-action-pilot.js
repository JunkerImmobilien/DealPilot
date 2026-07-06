/* deal-action-pilot.js — Boarding-Effekte fuer die Deal-Status-Gates (dpfk-da-v5)
   Rein additiv: haengt sich per Delegation an document, faesst setStatus NICHT an.
   Aktiv-Klasse + Maximal-Effekt (Flieger-Takeoff / rotes Wackeln / Radar; kein Konfetti). */
(function(){
  'use strict';
  function onClick(e){
    var t = e.target.closest && e.target.closest('#s8 .da-status-tile');
    if(!t) return;
    var wrap = t.parentNode;
    if(wrap){ wrap.querySelectorAll('.da-status-tile').forEach(function(x){ x.classList.remove('active'); }); }
    t.classList.add('active');
    var st  = t.getAttribute('data-status');
    var ico = t.querySelector('.da-stat-ico');
    if(st === 'won'){
      if(ico){ ico.classList.remove('dpfk-flyoff'); void ico.offsetWidth; ico.classList.add('dpfk-flyoff');
        setTimeout(function(){ ico.classList.remove('dpfk-flyoff'); }, 900); }
    } else if(st === 'lost'){
      t.classList.remove('dpfk-shake'); void t.offsetWidth; t.classList.add('dpfk-shake');
      setTimeout(function(){ t.classList.remove('dpfk-shake'); }, 450);
    } else {
      if(ico && ico.animate){ ico.animate([{transform:'rotate(0)'},{transform:'rotate(360deg)'}],{duration:700,easing:'ease-in-out'}); }
    }
  }
  document.addEventListener('click', onClick, false);
})();


/* F4/dpfk-da-share-v1 — Teilen-Status + QR am Ende der Deal-Aktion (#s8). Additiv, poll-basiert.
   Nutzt window.DpQr (v721), window.Auth.apiCall, window._currentObjKey. */
(function(){
  'use strict';
  function restLabel(exp){ var ms=new Date(exp).getTime()-Date.now(); if(!isFinite(ms)||ms<=0) return 'abgelaufen';
    var days=ms/86400000; if(days>=1){ var d=Math.round(days); return d+' Tag'+(d===1?'':'e'); } var h=Math.max(1,Math.round(ms/3600000)); return h+' Std'; }
  function esc(s){ return (''+(s||'')).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;'); }
  function render(sec){
    var objId = window._currentObjKey;
    if(!objId || !window.Auth || typeof window.Auth.apiCall!=='function'){ sec.innerHTML=''; return; }
    window.Auth.apiCall('/passes',{method:'GET'}).then(function(res){
      var items=(res&&res.items)||[], now=Date.now(), m=null;
      for(var i=0;i<items.length;i++){ var p=items[i]; if(p.object_id===objId && !p.revoked_at && new Date(p.expires_at).getTime()>now){ m=p; break; } }
      var head='<div style="font:700 13px/1.2 \'Space Grotesk\',sans-serif;color:#E8CC7A;margin:0 0 10px;display:flex;align-items:center;gap:7px"><span>\u2708</span> Boarding-Pass teilen</div>';
      if(m && window.DpQr){
        var url=location.origin+'/pass.html?c='+encodeURIComponent(m.code);
        var qr=window.DpQr.svg(url,{ecc:'M',border:1,dark:'#141210',light:'#fff'});
        sec.innerHTML='<div style="margin:20px 0 4px;padding:16px;border-radius:14px;background:#0c0c0c;border:1px solid rgba(201,168,76,.28)">'+head+
          '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">'+
            '<a href="'+url+'" target="_blank" rel="noopener" style="flex:0 0 auto;width:96px;height:96px;background:#fff;border-radius:10px;padding:6px;display:block">'+qr+'</a>'+
            '<div style="flex:1 1 180px;min-width:160px">'+
              '<div style="color:#d8d4cc;font-size:13px;line-height:1.5">Dieses Objekt ist geteilt \u2014 wer Code oder QR hat, sieht den \u00f6ffentlichen Boarding-Pass.</div>'+
              '<div style="margin-top:8px;font:600 12px/1.4 \'JetBrains Mono\',monospace;color:#E8CC7A">Pass '+esc(m.code)+'</div>'+
              '<div style="color:#9a8a52;font-size:11.5px">g\u00fcltig noch '+restLabel(m.expires_at)+'</div>'+
              '<button type="button" onclick="window._dpEndShare(\''+esc(m.code)+'\')" style="margin-top:10px;padding:7px 13px;border-radius:9px;border:1px solid rgba(217,104,95,.55);background:transparent;color:#D9685F;font:600 12px/1 \'Space Grotesk\',sans-serif;cursor:pointer">Teilen beenden</button>'+
            '</div>'+
          '</div></div>';
      } else {
        sec.innerHTML='<div style="margin:20px 0 4px;padding:16px;border-radius:14px;background:#0c0c0c;border:1px solid rgba(201,168,76,.18)">'+head+
          '<div style="color:#bdb8ae;font-size:13px;line-height:1.5">Dieses Objekt ist noch nicht geteilt. Erzeuge hier direkt einen Link + QR-Code \u2014 oder wie gewohnt \u00fcber den Boarding-Pass im Tab Objekt.</div>'+
          '<button type="button" onclick="window._dpStartShare()" style="margin-top:12px;padding:9px 16px;border-radius:10px;border:none;background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#1a1508;font:700 13px/1 \'Space Grotesk\',sans-serif;cursor:pointer">\u2708 Jetzt teilen</button></div>';
      }
    }).catch(function(){ sec.innerHTML=''; });
  }
  function ensure(){
    var s8=document.getElementById('s8'); if(!s8 || s8.offsetParent===null) return;
    /* v856-share-slot: bevorzugt in den Cockpit-Slot (unter der Departure-Tafel) */
    var slot=document.getElementById('dab-share-slot');
    var sec=document.getElementById('da-share-section');
    if(!sec){ sec=document.createElement('div'); sec.id='da-share-section'; (slot||s8).appendChild(sec); }
    else if(slot){ if(sec.parentNode!==slot) slot.appendChild(sec); }
    else if(sec!==s8.lastElementChild){ s8.appendChild(sec); }
    render(sec);
  }
  var lastKey=null, lastVis=false;
  setInterval(function(){
    var s8=document.getElementById('s8');
    var vis = !!(s8 && s8.offsetParent!==null);
    var key = window._currentObjKey;
    var secMissing = vis && !document.getElementById('da-share-section');
    if(vis && (!lastVis || key!==lastKey || secMissing)){ try{ ensure(); }catch(e){} }
    lastVis=vis; lastKey=key;
  }, 1200);
  /* v871: Teilen direkt hier beenden (Pass widerrufen) — nicht nur uebers Cockpit */
  window._dpEndShare = function (code) {
    if (!window.confirm('Teilen beenden? Link und QR-Code werden sofort ung\u00fcltig.')) return;
    function done() { try { ensure(); } catch (e) {} }
    window.Auth.apiCall('/passes/' + encodeURIComponent(code), { method: 'DELETE' })
      .then(done)
      .catch(function () {
        window.Auth.apiCall('/passes/' + encodeURIComponent(code) + '/revoke', { method: 'POST' })
          .then(done).catch(done);
      });
  };
  /* v876-share-modal: "Jetzt teilen" oeffnet dasselbe Modal wie im Objekt-Tab
     (QuickBoardingShare) statt eines stillen POST. Danach die Kachel nachziehen. */
  window._dpStartShare = function () {
    if (!window._currentObjKey) { window.alert('Bitte zuerst ein Objekt laden.'); return; }
    if (window.QuickBoardingShare && typeof window.QuickBoardingShare.open === 'function') {
      window.QuickBoardingShare.open();
      var n = 0, iv = setInterval(function () { try { ensure(); } catch (e) {} if (++n >= 12) clearInterval(iv); }, 700);
      return;
    }
    /* Fallback (Modal nicht geladen): alter Direkt-POST */
    window.Auth.apiCall('/passes', { method: 'POST', body: { objectId: window._currentObjKey } })
      .then(function () { try { ensure(); } catch (e) {} })
      .catch(function () {
        window.alert('Teilen hier gerade nicht m\u00f6glich \u2014 bitte einmal \u00fcber den Boarding-Pass im Tab Objekt teilen.');
      });
  };
  window._dpDealShareRefresh = ensure;
})();
