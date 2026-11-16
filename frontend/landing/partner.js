/* partner.js · landing-partner-1 · der Aufzug der Partner-Strecke (partner.html #strecke)
   Rechts fährt man Etappe für Etappe hoch, links steht der Bildschirm still und zeigt das Bild
   der Etappe, die gerade in der Mitte des Fensters steht. Die Kabine auf der Schiene zeigt, wo
   man ist. Ohne JavaScript: erstes Bild sichtbar, alle Etappen lesbar. Unter 981 px blendet das
   CSS den Schacht aus, dort trägt jede Etappe ihr eigenes Bild. */
(function () {
  'use strict';
  var liste = document.querySelector('.pt-schritte');
  if (!liste) return;
  var schritte = [].slice.call(liste.querySelectorAll('.pt-s'));
  var bilder = [].slice.call(document.querySelectorAll('.pt-schirm img'));
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
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) setze(schritte.indexOf(e.target)); });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
  schritte.forEach(function (s) { io.observe(s); });
  setze(0);
  /* Kabine nach Schriftladen und Größenwechsel neu setzen (offsetTop ändert sich) */
  function neu() { var i = aktiv; aktiv = -1; setze(i < 0 ? 0 : i); }
  window.addEventListener('resize', neu);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(neu);
})();
