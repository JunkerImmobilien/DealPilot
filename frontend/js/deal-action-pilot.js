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
