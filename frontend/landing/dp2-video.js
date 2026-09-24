/* ═══════════════════════════════════════════════════════════════════════
   dp2-video.js · v1557 · Der Videobereich
   ───────────────────────────────────────────────────────────────────────
   Marcel am 23.09.2026: "Ich brauche auch einen Videobereich oder wo wir
   DealPilot-Videos laufen lassen koennen."

   Die Liste unten ist die einzige Stelle, an der ein Film eingetragen
   wird - Datei, Titel, ein Satz, Dauer. Alles andere ergibt sich daraus:
   die Auswahlliste, die Nummern, der Text ueber dem Bild.

   Geladen wird erst beim Anklicken (preload="none"). Ein Video, das
   niemand ansieht, soll die Seite nicht aufhalten.
   ═══════════════════════════════════════════════════════════════════════ */
window.DP_VIDEOS = [
  {
    datei: 'assets/video/dp-hero-flug.mp4',
    bild: 'assets/bild/hero.jpg',
    titel: 'Der Anflug',
    text: 'Was DealPilot ist — in einer Minute.',
    dauer: '0:58',
  },
  {
    datei: 'assets/video/dp-intro-cockpit.mp4',
    bild: 'assets/bild/bank.jpg',
    titel: 'Das Cockpit',
    text: 'Ein Objekt vom Exposé bis zum Deal Score.',
    dauer: '0:24',
  },
];

(function () {
  'use strict';
  var V = window.DP_VIDEOS || [];
  var liste = document.getElementById('vidListe');
  var spieler = document.getElementById('vidPlayer');
  if (!liste || !spieler || !V.length) return;

  liste.innerHTML = V.map(function (v, i) {
    return '<button class="vid-w' + (i === 0 ? ' on' : '') + '" data-i="' + i + '">'
      + '<span class="vid-wn">' + String(i + 1).padStart(2, '0') + '</span>'
      + '<span class="vid-wt"><b>' + v.titel + '</b><span>' + v.text + '</span></span>'
      + '<span class="vid-wd">' + v.dauer + '</span>'
      + '</button>';
  }).join('');

  function waehle(i) {
    var v = V[i]; if (!v) return;
    spieler.pause();
    spieler.setAttribute('poster', v.bild);
    spieler.setAttribute('src', v.datei);
    spieler.load();
    document.getElementById('vidNr').textContent = String(i + 1).padStart(2, '0');
    document.getElementById('vidTitel').textContent = v.titel;
    document.getElementById('vidText').textContent = v.text;
    liste.querySelectorAll('.vid-w').forEach(function (b, j) {
      b.classList.toggle('on', j === i);
    });
    /* Nur abspielen, wenn das Fenster auch vorn ist - im verborgenen Tab
       laedt ein Video ohnehin nicht (networkState bleibt auf 2). */
    if (document.visibilityState === 'visible') {
      var p = spieler.play();
      if (p && p.catch) p.catch(function () { /* Autoplay abgelehnt - dann eben von Hand */ });
    }
  }

  liste.addEventListener('click', function (e) {
    var b = e.target.closest('.vid-w[data-i]');
    if (b) waehle(parseInt(b.dataset.i, 10));
  });
})();
