/* ════════════════════════════════════════════════════════════════════
   dp2-dealcheck-d3.js · Deal-Check im Cockpit-Look (landing-dealcheck-d3-1, 26.11.2026, Marcel: freigegeben)
   Nur Gestaltung und Anordnung. Rechnet NICHTS selbst: Score, Ring, Stufe
   und Kennzahlen schreibt weiter dp2-dealcheck.js. Diese Datei
     1. ordnet die Vorderseite: Kaufpreis und Kaltmiete als große Anzeigen,
        Zinsbindung sichtbar, alles Übrige unter „Weitere Angaben“
        (Elemente werden verschoben, nicht neu gebaut, die IDs bleiben),
     2. macht aus „Deal prüfen“ eine Startfreigabe,
     3. legt eine Skala um den Score-Ring und Messbalken unter die drei
        Kennzahlen. Die Balken lesen das Ergebnis aus dem Ereignis
        dp:dealcheck-ergebnis (detail.k) und zeigen es nur an.
   Greift nur, wenn <section id="dealcheck"> die Klasse dk-d3 trägt.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var box = document.getElementById('dealcheck');
  if (!box || !box.classList.contains('dk-d3')) return;

  function ordnen() {
    var karte = document.getElementById('dkKarte'), vorn = document.getElementById('dkVorn');
    if (!karte || !vorn) return false;
    if (karte.getAttribute('data-d3') === '1') return true;
    karte.setAttribute('data-d3', '1');

    var nr = vorn.querySelector('.dk-nr'); if (nr) nr.textContent = 'Pre-Flight';
    var hn = document.querySelector('#dcErg .dk-marke'); if (hn) hn.textContent = 'Flugdaten';

    /* 1 · Kaufpreis und Kaltmiete nebeneinander */
    var kp = document.getElementById('dcKp'), nkm = document.getElementById('dcNkm');
    var fKp = kp && kp.closest('.dk-f'), fNkm = nkm && nkm.closest('.dk-f');
    if (fKp && fNkm) {
      var h = document.createElement('div'); h.className = 'd3-haupt';
      fKp.parentNode.insertBefore(h, fKp); h.appendChild(fKp); h.appendChild(fNkm);
    }
    /* 2 · Weitere Angaben einklappen (Zusatzeinnahmen, Tilgung, PLZ, Baujahr, Fläche) */
    var bind = vorn.querySelector('.dk-bind');
    var teile = [vorn.querySelector('.dk-tilg'), document.getElementById('dkZusatz'), vorn.querySelector('.dk-plz'), document.getElementById('dkObj')];
    if (bind) {
      var d = document.createElement('details'); d.className = 'd3-mehr';
      d.innerHTML = '<summary><span>Weitere Angaben</span><em>Tilgung, Zusatzeinnahmen, PLZ, Baujahr, Fläche</em></summary><div class="d3-mehr-in"></div>';
      var inn = d.querySelector('.d3-mehr-in');
      bind.parentNode.insertBefore(d, bind.nextSibling);
      teile.forEach(function (e) { if (e) inn.appendChild(e); });
    }
    /* 3 · Startfreigabe */
    var los = document.getElementById('dkDreh');
    if (los) los.innerHTML = '<span class="d3-frei">Startfreigabe</span>Deal prüfen<span class="d3-pfeil" aria-hidden="true">→</span><span class="d3-bahn" aria-hidden="true"></span>';

    /* 4 · Skala um den Ring (60 Striche, jeder fünfte länger) */
    var ring = document.getElementById('dcRing');
    if (ring && !ring.querySelector('.d3-skala')) {
      var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('viewBox', '0 0 200 200'); svg.setAttribute('class', 'd3-skala'); svg.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < 60; i++) {
        var a = (i / 60) * Math.PI * 2 - Math.PI / 2, gr = i % 5 === 0, r1 = 97, r2 = gr ? 89 : 93;
        var l = document.createElementNS(ns, 'line');
        l.setAttribute('x1', (100 + r1 * Math.cos(a)).toFixed(2)); l.setAttribute('y1', (100 + r1 * Math.sin(a)).toFixed(2));
        l.setAttribute('x2', (100 + r2 * Math.cos(a)).toFixed(2)); l.setAttribute('y2', (100 + r2 * Math.sin(a)).toFixed(2));
        if (gr) l.setAttribute('class', 'gr');
        svg.appendChild(l);
      }
      ring.appendChild(svg);
    }
    /* 5 · Messbalken unter den Kennzahlen */
    [].forEach.call(document.querySelectorAll('#dcErg .dk-kpi > div'), function (k) {
      if (!k.querySelector('.d3-mess')) { var m = document.createElement('span'); m.className = 'd3-mess'; m.setAttribute('aria-hidden', 'true'); m.innerHTML = '<i></i>'; k.appendChild(m); }
    });
    return true;
  }

  /* Anzeige der Messbalken: nur Darstellung des schon gerechneten Ergebnisses */
  function balken(k) {
    if (!k) return;
    var setze = function (id, anteil, ton) {
      var b = document.getElementById(id); if (!b) return;
      var hull = b.closest('div'), i = hull && hull.querySelector('.d3-mess i'); if (!i) return;
      i.className = ton || '';
      i.style.transform = 'scaleX(0)';
      requestAnimationFrame(function () { requestAnimationFrame(function () { i.style.transform = 'scaleX(' + Math.max(0.04, Math.min(1, anteil)) + ')'; }); });
    };
    if (isFinite(k.cf_m)) setze('dcCf', Math.abs(k.cf_m) / 400, k.cf_m >= 0 ? 'gut' : 'schlecht');
    if (isFinite(k.bmy)) setze('dcBmy', k.bmy / 10, k.bmy >= 5 ? 'gut' : '');
    if (isFinite(k.nmy)) setze('dcNmy', k.nmy / 8, k.nmy >= 3.5 ? 'gut' : '');
    if (isFinite(k.fak)) setze('dcFak', 1 - Math.min(1, k.fak / 40), k.fak <= 20 ? 'gut' : '');
    if (isFinite(k.dscr) && k.d_total > 0) setze('dcDscr', k.dscr / 2, k.dscr >= 1.2 ? 'gut' : (k.dscr < 1 ? 'schlecht' : ''));
  }
  document.addEventListener('dp:dealcheck-ergebnis', function (e) { ordnen(); balken(e.detail && e.detail.k); });

  if (!ordnen()) {
    var mo = new MutationObserver(function () { if (ordnen()) mo.disconnect(); });
    var k = document.getElementById('dkKarte');
    if (k) mo.observe(k, { childList: true });
    var n = 0, t = setInterval(function () { if (ordnen() || ++n > 40) clearInterval(t); }, 250);
  }
})();
