/* landing-motion.js — Cockpit-Intro (loest Licht-Intro ab) + Hero-Video.
   Der Rabatt lebt seit ERSTFLUG in promo-erstflug.js (Landing UND App, eine Wahrheit).
   Additiv: kein Eingriff ins bestehende Markup, alles zur Laufzeit. */
(function(){'use strict';
 var V='assets/video/', ONCE=true;      /* Intro einmal pro Session */

 document.body.classList.add('dpm-on');            /* legt Licht-Intro stumm */
 document.body.classList.remove('intro-lock');

 /* ═══ HERO-VIDEO ═══ */
 function hero(){
   var h=document.querySelector('.hero'); if(!h||document.getElementById('dpm-flug'))return;
   var v=document.createElement('video');
   v.id='dpm-flug'; v.autoplay=true; v.muted=true; v.loop=true; v.playsInline=true;
   v.setAttribute('playsinline',''); v.src=V+'dp-hero-flug.mp4';
   h.insertBefore(v,h.firstChild);
 }


 /* ═══ DEALSCORE-KARTE ═══
    Animiert die ECHTE Karte im Hero (Ring, Zahlen, Balken) statt ein Video
    darueberzulegen: bleibt scharf, skaliert mit, kostet keine Bandbreite.
    Die Balken werden von der Seite per JS erzeugt -> erst warten, dann messen. */
 function dealscore(){
   var card=document.querySelector('.qbcard.idscard'); if(!card||card._dpm)return false;
   var ring=card.querySelector('.ids-dial .pg');
   var bars=card.querySelectorAll('.ids-bar .track i');
   if(!ring||!bars.length)return false;            /* noch nicht gerendert */
   card._dpm=1; card.classList.add('dpm-anim');

   /* Ziel-Zustaende einsammeln, BEVOR wir sie auf 0 setzen */
   var dash=(getComputedStyle(ring).strokeDasharray||'').split(/[ ,]+/);
   var len=parseFloat(dash[0])||0;                 /* sichtbarer Bogen */
   var num=card.querySelector('.ids-dv b');
   var goalNum=num?parseInt(num.textContent,10):0;
   var goals=[];
   Array.prototype.forEach.call(bars,function(i){
     goals.push(i.style.width||getComputedStyle(i).width);
     i.style.width='0%';
   });
   var scores=[];
   Array.prototype.forEach.call(card.querySelectorAll('.ids-bar .sc'),function(el){
     var m=(el.textContent||'').match(/\d+/);
     scores.push({el:el,to:m?parseInt(m[0],10):0,html:el.innerHTML});
   });

   if(len)ring.style.strokeDashoffset=len;         /* Ring zu */
   if(num)num.textContent='0';

   var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches;

   function run(){
     card.classList.add('dpm-in');
     if(reduce){
       if(len)ring.style.strokeDashoffset=0;
       if(num)num.textContent=goalNum;
       Array.prototype.forEach.call(bars,function(i,k){i.style.width=goals[k];});
       scores.forEach(function(s){s.el.innerHTML=s.html;});
       return;
     }
     setTimeout(function(){ if(len)ring.style.strokeDashoffset=0; },120);
     count(num,goalNum,1500,140);
     Array.prototype.forEach.call(bars,function(i,k){
       setTimeout(function(){ i.style.width=goals[k]; },260+k*110);
     });
     scores.forEach(function(s,k){ count2(s,900,260+k*110); });
   }

   function count(el,to,dur,delay){
     if(!el)return;
     setTimeout(function(){var t0=performance.now();
       (function step(t){var p=Math.min((t-t0)/dur,1);
         el.textContent=Math.round(to*(1-Math.pow(1-p,3)));
         if(p<1)requestAnimationFrame(step); else el.textContent=to;
       })(performance.now());},delay||0);
   }
   /* Score-Zeile ist '98<small>/100</small>' -> nur die Zahl zaehlen, Rest behalten */
   function count2(s,dur,delay){
     var tail=s.html.replace(/^\s*\d+/,'');
     setTimeout(function(){var t0=performance.now();
       (function step(t){var p=Math.min((t-t0)/dur,1);
         s.el.innerHTML=Math.round(s.to*(1-Math.pow(1-p,3)))+tail;
         if(p<1)requestAnimationFrame(step); else s.el.innerHTML=s.html;
       })(performance.now());},delay||0);
   }

   /* v3: alle 10 s neu abspielen, solange die Karte im Bild ist.
      Der Timer laeuft NUR bei Sichtbarkeit — kein Rechnen im Hintergrund. */
   var timer=null, seen=false;
   function reset(){
     if(len)ring.style.strokeDashoffset=len;
     if(num)num.textContent='0';
     Array.prototype.forEach.call(bars,function(i){ i.style.width='0%'; });
     scores.forEach(function(s){ s.el.innerHTML=s.html.replace(/^\s*\d+/,'0'); });
     card.classList.remove('dpm-in');
   }
   function loop(){ reset(); setTimeout(run,60); }
   try{
     new IntersectionObserver(function(e){e.forEach(function(x){
       if(x.isIntersecting){
         if(!seen){ seen=true; run(); }
         if(!timer && !reduce) timer=setInterval(loop,10000);
       } else {
         if(timer){ clearInterval(timer); timer=null; }
       }});},{threshold:.25}).observe(card);
   }catch(e){ run(); }
   return true;
 }
 /* Karte wird teils erst nach dem Seiten-JS befuellt -> kurz nachfassen */
 function dealscoreWait(){
   var n=0;
   (function tick(){ if(dealscore())return; if(++n>120)return; setTimeout(tick,50); })();
 }

 /* ═══ COCKPIT-INTRO ═══ */
 function intro(){
   if(ONCE && sessionStorage.getItem('dpm-intro')==='1')return;
   if(window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches)return;
   sessionStorage.setItem('dpm-intro','1');

   var d=document.createElement('div'); d.id='dp-intro';
   d.innerHTML=
    '<video class="bg" muted playsinline></video><div class="tint"></div>'+
    '<div class="feed"><video class="cam" playsinline></video>'+
      '<div class="lab"><span class="dot"></span>CAM 01 \u00b7 PRE-FLIGHT</div></div>'+

    '<button class="skip" type="button">Intro \u00fcberspringen \u00d7</button>'+
    '<div class="scan"></div>'+
    '<div class="br a"></div><div class="br b"></div><div class="br c"></div><div class="br d"></div>'+
    '<div class="ro l">PRE-FLIGHT&nbsp;&nbsp;<s>OK</s><br>AVM-LINK&nbsp;&nbsp;<s>VERBUNDEN</s><br>'+
      'DSCR-ENGINE&nbsp;&nbsp;<s>BEREIT</s><br><u>OBJEKT 2026-999 \u00b7 DEALHAUSEN</u></div>'+
    '<div class="ro r"><u>KAUFPREIS</u>&nbsp;&nbsp;180.000&nbsp;\u20AC<br><u>DSCR</u>&nbsp;&nbsp;1,25<br>'+
      '<u>CASHFLOW</u>&nbsp;&nbsp;+760&nbsp;\u20AC<br><u>24 / 24 FELDER</u>&nbsp;&nbsp;<s>100 %</s></div>'+
    '<div class="ret h"></div><div class="ret v"></div>'+
    '<div class="core"><div><div class="rw"><svg width="230" height="230" viewBox="0 0 230 230">'+
      '<defs><linearGradient id="dpmRg" x1="0" y1="0" x2="1" y2="1">'+
      '<stop offset="0" stop-color="#E8CC7A"/><stop offset=".55" stop-color="#C9A84C"/>'+
      '<stop offset="1" stop-color="#b8932f"/></linearGradient></defs>'+
      '<circle class="trk" cx="115" cy="115" r="107"/><circle class="val" cx="115" cy="115" r="107"/></svg>'+
      '<div class="num"><div><b>0</b><small>INVESTOR DEAL SCORE</small></div></div></div>'+
      '<div class="wmk">Deal<span>Pilot</span></div>'+
      '<div class="clm">Immobilienentscheidungen sind zu gro\u00df f\u00fcr <em>ein Bauchgef\u00fchl.</em></div>'+
    '</div></div><div class="sweep"></div><div class="flash"></div>';
   document.body.appendChild(d);
   var q=function(s){return d.querySelector(s);};
   var cam=q('.cam'), bg=q('.bg');
   cam.src=V+'dp-intro-cockpit.mp4'; bg.src=V+'dp-intro-cockpit.mp4';
   document.documentElement.style.overflow='hidden';

   var T=[], at=function(f,ms){T.push(setTimeout(f,ms));};
   var val=q('.val'), sc=q('.num b'), feed=q('.feed'), rw=q('.rw'), wm=q('.wmk'), cm=q('.clm'),
       scan=q('.scan'), rh=q('.ret.h'), rv=q('.ret.v'), fl=q('.flash'), sw=q('.sweep'),
       skip=q('.skip'), tint=q('.tint'), lab=q('.lab');
   /* v7: Ton-Button entfernt (Marcel). Die Aufrufe bleiben stehen und laufen
      gegen ein stilles Dummy-Objekt — so bleibt der Rest der Ablaufsteuerung
      unveraendert und es gibt keine Null-Zugriffe. */
   var snd = { classList: { toggle: function(){}, remove: function(){} } };

   function fade(el,ms,tr){at(function(){el.style.transition='opacity .62s ease,transform .78s cubic-bezier(.2,.85,.25,1)';
     el.style.opacity=1; if(tr)el.style.transform=tr;},ms);}
   function count(to,dur){var t0=performance.now();
     (function s(t){var p=Math.min((t-t0)/dur,1);
       sc.textContent=Math.round(to*(1-Math.pow(1-p,3)));
       if(p<1)requestAnimationFrame(s);})(performance.now());}
   function done(){T.forEach(clearTimeout);T=[];
     d.classList.add('dpm-out');
     setTimeout(function(){try{cam.pause();}catch(e){} d.remove();
       document.documentElement.style.overflow='';},1150);}

   function fly(){
     var v=cam.volume, f=setInterval(function(){v=Math.max(0,v-.03);cam.volume=v;if(v<=0)clearInterval(f);},50);
     [q('.ro.l'),q('.ro.r'),lab].forEach(function(e){e.style.transition='opacity .45s';e.style.opacity=0;});
     d.querySelectorAll('.br').forEach(function(b){b.style.transition='opacity .45s,transform .7s ease';
       b.style.opacity=0;b.style.transform='scale(1.25)';});
     at(function(){sw.style.opacity=1;sw.style.transition='left .95s cubic-bezier(.55,0,.35,1)';sw.style.left='120%';},120);
     at(function(){rw.style.transition='opacity .8s ease,transform 1.1s cubic-bezier(.5,0,.35,1)';
       rw.style.transform='scale(2.6)';rw.style.opacity=0;rw.style.filter='blur(6px)';},300);
     at(function(){[wm,cm].forEach(function(e){e.style.transition='opacity .7s ease,transform .95s cubic-bezier(.4,0,.3,1)';
       e.style.opacity=0;e.style.transform='translateY(-26px)';});},420);
     at(function(){feed.style.transition='transform 1.25s cubic-bezier(.5,0,.3,1),opacity .95s ease .12s,filter 1.1s ease';
       feed.style.transform='translate(-50%,-50%) scale(1.9)';feed.style.opacity=0;feed.style.filter='blur(16px)';
       bg.style.opacity=0;bg.style.transform='scale(1.14)';tint.style.opacity=0;},300);
     at(done,560);
   }

   function run(sound){
     cam.muted=!sound; cam.volume=1; bg.muted=true; cam.currentTime=0; bg.currentTime=0;
     bg.play().catch(function(){});
     /* v6: Ton ist der Standard — aber Browser erlauben Autoplay mit Ton nur nach
        Interaktion bzw. bei Seiten mit genug "Media Engagement". Deshalb wird es
        VERSUCHT und faellt sauber auf stumm zurueck, falls der Browser ablehnt.
        Dann kommt der Ton-Button wieder hoch. Kein Bruch, nur ein Fallback. */
     var pr = cam.play();
     if (pr && typeof pr.catch === 'function') {
       pr.catch(function () {
         if (!sound) return;                 /* stumm abgelehnt -> nichts zu retten */
         cam.muted = true;
         cam.play().catch(function () {});
         snd.classList.remove('hide');       /* Button zurueck: "Mit Ton abspielen" */
       });
     }
     snd.classList.toggle('hide',!!sound);
     fade(feed,60,'translate(-50%,-50%) scale(1)');
     d.querySelectorAll('.br').forEach(function(b,i){at(function(){
       b.style.transition='opacity .45s,transform .62s cubic-bezier(.2,.9,.3,1)';
       b.style.opacity=.85;b.style.transform='scale(1)';},320+i*90);});
     at(function(){scan.style.transition='top 1.4s cubic-bezier(.4,0,.5,1)';scan.style.top='110%';},480);
     at(function(){q('.ro.l').style.transition='opacity .55s';q('.ro.l').style.opacity=1;},700);
     at(function(){q('.ro.r').style.transition='opacity .55s';q('.ro.r').style.opacity=1;},860);
     at(function(){rh.style.transition='width .85s cubic-bezier(.2,.9,.25,1)';rh.style.width='min(620px,78vw)';},1050);
     at(function(){rv.style.transition='height .85s cubic-bezier(.2,.9,.25,1)';rv.style.height='min(400px,54vh)';},1150);
     at(function(){fl.style.transition='opacity .09s';fl.style.opacity=.14;
       at(function(){fl.style.transition='opacity .4s';fl.style.opacity=0;},100);},1650);
     fade(rw,1650,'scale(1)');
     at(function(){val.style.transition='stroke-dashoffset 1500ms cubic-bezier(.2,.9,.25,1)';
       val.style.strokeDashoffset=672*(1-.86);count(86,1500);},1740);
     at(function(){[rh,rv].forEach(function(r){r.style.transition='opacity .6s';r.style.opacity=0;});},2750);
     fade(wm,2900,'translateY(0)');
     fade(cm,3120,'translateY(0)');
     at(fly,3750);
   }
   skip.onclick=function(e){e.stopPropagation();done();};
   /* v5: Klick irgendwo im Intro fuehrt direkt zur Landingpage.
      Die beiden Buttons stoppen die Weitergabe selbst (stopPropagation),
      damit "Mit Ton abspielen" nicht gleichzeitig abbricht. */
   d.style.cursor='pointer';
   d.addEventListener('click',function(){ done(); });
   document.addEventListener('keydown',function(e){if(e.key==='Escape')done();});
   run(true);   /* v6: Standard MIT Ton, Fallback in run() */
 }

 function boot(){ hero(); dealscoreWait(); intro(); }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot); else boot();
})();
