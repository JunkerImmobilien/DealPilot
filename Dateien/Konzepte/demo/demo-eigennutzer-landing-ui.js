/* demo-eigennutzer-landing-ui.js · DEMO (FF6, 26.11.2026) · Umschalter + Eigennutzer-Karte am Cockpit-Deal-Check.
   Der echte Deal-Check (#dkKarte, dp2-dealcheck.js) bleibt unverändert, er wird nur ausgeblendet. */
(function () {
  var sec = document.getElementById('dealcheck'); if (!sec) return;
  var szene = sec.querySelector('.dk-szene'); szene.classList.add('eg-szene');
  var E = window.DemoEigennutzer;

  var um = document.createElement('div'); um.className = 'eg-umsch'; um.setAttribute('role', 'tablist');
  um.innerHTML = '<button type="button" class="an" data-m="verm" role="tab" aria-selected="true">Zum Vermieten</button>' +
                 '<button type="button" data-m="selbst" role="tab" aria-selected="false">Selbst nutzen</button>';
  szene.insertBefore(um, szene.firstChild);

  var k = document.createElement('div'); k.className = 'eg-karte';
  k.innerHTML =
    '<div class="eg-kopf"><span>Haus-Check · Selbst nutzen</span><span>Beispielrechnung</span></div>' +
    '<div class="eg-felder">' +
      '<label class="eg-f"><span>Kaufpreis</span><input id="egKp" inputmode="numeric" value="310.000"></label>' +
      '<label class="eg-f"><span>Wohnfläche m²</span><input id="egWfl" inputmode="numeric" value="130"></label>' +
      '<label class="eg-f klein"><span>Baujahr</span><input id="egBj" inputmode="numeric" value="1998"></label>' +
      '<label class="eg-f klein"><span>PLZ</span><input id="egPlz" inputmode="numeric" value="33602"></label>' +
      '<label class="eg-f klein"><span>Eigenkapital</span><input id="egEk" inputmode="numeric" value="100.000"></label>' +
      '<label class="eg-f klein"><span>Netto im Monat</span><input id="egNetto" inputmode="numeric" value="5.200"></label>' +
      '<div class="eg-opt">Eigenkapital und Einkommen sind freiwillig. Ohne Einkommen fehlt nur die Leistbarkeit.</div>' +
    '</div>' +
    '<button type="button" class="eg-start" id="egStart">Startfreigabe · Haus prüfen</button>' +
    '<div class="eg-erg" id="egErg"></div>';
  szene.appendChild(k);

  function zahl(id) { return Number(String(document.getElementById(id).value).replace(/\./g, '').replace(',', '.')) || 0; }
  function farbe(s) { return s == null ? 'rgba(255,255,255,.2)' : s >= 70 ? '#5BD98E' : s >= 50 ? 'var(--wl-c9a84c,#C9A84C)' : '#E08A7E'; }

  function zeige(r) {
    var U = 2 * Math.PI * 54, voll = U * r.gesamt / 100;
    var g = r.gruppen.map(function (x) {
      return '<div class="eg-g"><span>' + x.k + '</span><i><em data-w="' + (x.s == null ? 0 : x.s) + '" style="background:' + farbe(x.s) + '"></em></i><b>' + (x.s == null ? '–' : x.s) + '</b><small>' + x.t + '</small></div>';
    }).join('');
    var satz = r.jahr ? 'Kaufen ist nach ' + r.jahr + ' Jahren günstiger als mieten.' : 'In 20 Jahren wird Kaufen hier nicht günstiger als mieten.';
    document.getElementById('egErg').innerHTML =
      '<div class="eg-oben"><div class="eg-dial"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" cx="60" cy="60" r="54" stroke-dasharray="' + U + '" stroke-dashoffset="' + U + '"/></svg><b id="egZahl">0</b><small>von 100</small></div>' +
      '<div class="eg-urteil"><h3>Ist das Haus gut? ' + r.stufe.wort + '.</h3><p>' + (r.gebiet || '') + '. Gerechnet mit dem Zins von heute und der ortsüblichen Miete.</p></div></div>' +
      '<div class="eg-gr">' + g + '</div>' +
      '<div class="eg-zahlen"><div><b>' + E.eur(r.miete) + '</b><span>Ersparte Miete im Monat</span></div><div><b>' + E.eur(r.rate) + '</b><span>Rate im Monat</span></div><div><b>' + r.zins.toFixed(2).replace('.', ',') + ' %</b><span>Zins 10 Jahre</span></div></div>' +
      '<div class="eg-satz">' + satz + '</div>' +
      '<div class="eg-fuss">Beispielrechnung. Ersparte Miete aus ' + (r.quelle === 'Mietspiegel' ? 'dem Mietspiegel' : 'der DealPilot-Näherung') + ' mit Hauszuschlag, Wertentwicklung 1,5 % und Mietsteigerung 2 % im Jahr angenommen. Keine Finanzierungszusage.</div>';
    var erg = document.getElementById('egErg'); erg.classList.add('da');
    requestAnimationFrame(function () {
      erg.querySelector('.fg').style.strokeDashoffset = U - voll;
      [].forEach.call(erg.querySelectorAll('em[data-w]'), function (em) { em.style.width = em.getAttribute('data-w') + '%'; });
      var z = 0, el = document.getElementById('egZahl'), t = setInterval(function () { z += Math.max(1, Math.round(r.gesamt / 25)); if (z >= r.gesamt) { z = r.gesamt; clearInterval(t); } el.textContent = z; }, 30);
    });
  }

  function start() {
    var e = { kp: zahl('egKp'), wfl: zahl('egWfl'), bj: zahl('egBj'), ek: zahl('egEk'), netto: zahl('egNetto'), plz: document.getElementById('egPlz').value.trim() };
    E.daten(e.plz, e.bj, e.wfl).then(function (d) { zeige(E.rechne(e, d)); });
  }
  document.getElementById('egStart').addEventListener('click', start);

  function setze(m) {
    [].forEach.call(um.querySelectorAll('button'), function (b) { var an = b.getAttribute('data-m') === m; b.classList.toggle('an', an); b.setAttribute('aria-selected', an); });
    sec.classList.toggle('eg-an', m === 'selbst');
  }
  um.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) setze(b.getAttribute('data-m')); });
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('[data-eg-selbst]'); if (!a) return; setze('selbst');
  });
  window.DemoEgSetze = setze;
  if (/[?&]selbst=1/.test(location.search)) { setze('selbst'); start(); }

  var hinweis = document.createElement('div'); hinweis.className = 'eg-demo'; hinweis.textContent = 'Demo · Variante ' + (document.body.getAttribute('data-eg-var') || 'b').toUpperCase();
  document.body.appendChild(hinweis);
})();
