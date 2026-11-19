/* partner.js · landing-partner-1 · der Aufzug der Partner-Strecke (partner.html #strecke)
   Rechts fährt man Etappe für Etappe hoch, links steht der Bildschirm still und zeigt das Bild
   der Etappe, die gerade in der Mitte des Fensters steht. Die Kabine auf der Schiene zeigt, wo
   man ist. Ohne JavaScript: erstes Bild sichtbar, alle Etappen lesbar.
   landing-partner-3 (17.11.2026): auch unter 981 px ein Aufzug. Der Schirm steht dort klein OBEN
   (sticky unter der Navigation), deshalb liegt das Messband nicht in der Fenstermitte, sondern
   knapp unter dem Schirm. Es wird aus der gemessenen Lage berechnet, nicht angenommen. */
(function () {
  'use strict';
  var liste = document.querySelector('.pt-schritte');
  if (!liste) return;
  var schritte = [].slice.call(liste.querySelectorAll('.pt-s'));
  var bilder = [].slice.call(document.querySelectorAll('.pt-schirm [data-bild]'));   /* landing-strecke-5 · auch die HTML-Karte der Etappe 1 (index.html .pt-qc) */
  var zahl = document.getElementById('ptZahl'), wer = document.getElementById('ptWer');
  var kabine = liste.querySelector('.pt-kabine'), schiene = liste.querySelector('.pt-schiene');
  var aktiv = -1;

  function setze(i) {
    if (i === aktiv || i < 0 || i >= schritte.length) return;
    aktiv = i;
    schritte.forEach(function (s, j) { s.classList.toggle('an', j === i); });
    var n = schritte[i].getAttribute('data-bild');
    bilder.forEach(function (b) { b.classList.toggle('an', b.getAttribute('data-bild') === n); });
    if (zahl) zahl.textContent = String(i + 1);
    if (wer) wer.textContent = schritte[i].getAttribute('data-wer') || '';
    var oben = schritte[i].offsetTop + 8;
    if (kabine) kabine.style.top = oben + 'px';
    if (schiene) schiene.style.height = Math.max(0, oben - 8) + 'px';
  }

  if (!('IntersectionObserver' in window)) { setze(0); return; }
  var schacht = document.querySelector('.pt-schacht'), nav = document.querySelector('.nav');
  var io = null, rand = '';
  function beobachten() {
    var m = '-45% 0px -50% 0px';
    if (window.innerWidth < 981 && schacht) {
      /* Schirm oben: Band 24 px hoch, gut ein Drittel in den freien Raum unter dem Schirm */
      var navH = nav ? nav.offsetHeight : 0;
      schacht.style.setProperty('--pt-oben', navH + 'px');
      var h = window.innerHeight, frei = navH + schacht.offsetHeight;
      var unten = Math.round(frei + 0.36 * Math.max(0, h - frei));
      m = '-' + unten + 'px 0px -' + Math.max(0, h - unten - 24) + 'px 0px';
    }
    if (m === rand && io) return;
    rand = m;
    if (io) io.disconnect();
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) setze(schritte.indexOf(e.target)); });
    }, { rootMargin: m, threshold: 0 });
    schritte.forEach(function (s) { io.observe(s); });
  }
  beobachten();
  setze(0);
  /* Kabine nach Schriftladen und Größenwechsel neu setzen (offsetTop ändert sich) */
  function neu() { beobachten(); var i = aktiv; aktiv = -1; setze(i < 0 ? 0 : i); }
  window.addEventListener('resize', neu);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(neu);
})();
