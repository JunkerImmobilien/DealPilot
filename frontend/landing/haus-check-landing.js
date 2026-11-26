/* haus-check-landing.js · v5130 KK6 · aus demo-eigennutzer-landing-ui.js (FF6, 26.11.2026) · Umschalter + Eigennutzer-Karte am Cockpit-Deal-Check.
   Der echte Deal-Check (#dkKarte, dp2-dealcheck.js) bleibt unverändert, er wird nur ausgeblendet. */
(function () {
  var sec = document.getElementById('dealcheck'); if (!sec) return;
  var szene = sec.querySelector('.dk-szene'); szene.classList.add('eg-szene');
  var E = window.DpEigennutzerKern || window.DemoEigennutzer;   /* v5130 · KK6 · echter Kern */

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
      '<label class="eg-f klein" id="egGsflF"><span>Grundstück m²</span><input id="egGsfl" inputmode="numeric" value="600"></label>' +
      /* v5130 KK6 · für den Sachwert nach NHK 2010 (Gebäudetyp und Standardstufe), beim Haus */
      '<label class="eg-f klein"><span>Keller</span><select id="egKeller"><option value="ja">unterkellert</option><option value="nein">ohne Keller</option></select></label>' +
      '<label class="eg-f klein"><span>Geschosse</span><select id="egGeschosse"><option value="2">Erd- und Obergeschoss</option><option value="1">nur Erdgeschoss</option></select></label>' +
      '<label class="eg-f klein"><span>Dach</span><select id="egDach"><option value="1">Dachgeschoss ausgebaut</option><option value="2">Dachgeschoss nicht ausgebaut</option><option value="3">Flachdach</option></select></label>' +
      '<label class="eg-f klein"><span>Ausstattung</span><select id="egAusst"><option value="normal">normal</option><option value="einfach">einfach</option><option value="gehoben">gehoben</option></select></label>' +
      '<label class="eg-f klein"><span>Baujahr</span><input id="egBj" inputmode="numeric" value="1998"></label>' +
      '<label class="eg-f klein"><span>Objekt</span><select id="egArt"><option value="efh">Einfamilienhaus</option><option value="zfh">Zweifamilienhaus</option><option value="dhh">Doppelhaushälfte</option><option value="rh">Reihenhaus</option><option value="etw">Eigentumswohnung</option><option value="mfh">Mehrfamilienhaus</option></select></label>' +
      '<label class="eg-f klein"><span>PLZ</span><input id="egPlz" inputmode="numeric" value="33602"></label>' +
      '<label class="eg-f"><span>Straße und Nr. (für das Umfeld)</span><input id="egStr" placeholder="Musterstraße 1"></label>' +
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
      (r.kern && r.kern.haus.gruppen.preis && r.kern.haus.gruppen.preis.wert_score != null ? '<div class="eg-fuss"><b>Mit dem Wert nach ImmoWertV gerechnet</b>, derselbe Haus-Score wie im PDF.</div>' : '<div class="eg-fuss">Kostenlose Schnellrechnung ohne den Wert nach ImmoWertV. Der Haus-Check rechnet den Preis zusätzlich gegen den ermittelten Wert, der Score kann sich dadurch ändern.</div>') +
      '<div class="eg-fuss">Beispielrechnung. Ersparte Miete aus ' + (r.quelle === 'Mietspiegel' ? 'dem Mietspiegel' : 'der DealPilot-Näherung') + ' mit Hauszuschlag, Wertentwicklung 1,5 % und Mietsteigerung 2 % im Jahr angenommen. Keine Finanzierungszusage.</div>';
    var erg = document.getElementById('egErg'); erg.classList.add('da');
    requestAnimationFrame(function () {
      erg.querySelector('.fg').style.strokeDashoffset = U - voll;
      [].forEach.call(erg.querySelectorAll('em[data-w]'), function (em) { em.style.width = em.getAttribute('data-w') + '%'; });
      var z = 0, el = document.getElementById('egZahl'), t = setInterval(function () { z += Math.max(1, Math.round(r.gesamt / 25)); if (z >= r.gesamt) { z = r.gesamt; clearInterval(t); } el.textContent = z; }, 30);
    });
  }

  /* v5130 · KK6 · Leistbarkeit als eigene Ampel, Kurzurteil und Umfeld (OSM) unter dem Ergebnis */
  var AMPEL = { gruen: ['#5BD98E', 'gut tragbar'], gelb: ['var(--wl-c9a84c,#C9A84C)', 'knapp'], rot: ['#E08A7E', 'zu hoch'] };
  function zusatz(r, d, e) {
    var erg = document.getElementById('egErg'); if (!erg) return;
    var box = document.createElement('div'); box.className = 'eg-zusatz';
    var a = r.ampel ? AMPEL[r.ampel] : null;
    var h = '<div class="eg-amp"><i style="background:' + (a ? a[0] : 'rgba(255,255,255,.2)') + '"></i><b>Passt es zu mir?</b> '
      + (a ? 'Wohnkosten ' + Math.round(r.quote) + ' % vom Netto, ' + a[1] + '.' : 'Netto-Einkommen eintragen, dann zeigen wir die Belastung.') + '</div>';
    var AU = r.kern && r.kern.leistbarkeit && r.kern.leistbarkeit.aufstellung;
    if (AU && AU.length) h += '<div class="eg-nk"><b>Im Monat</b><br>' + AU.map(function (x) { return (x.summe ? '<b>' : '') + x.l.replace(/ \(.*\)$/, '') + ' ' + E.eur(x.eur) + (x.summe ? '</b>' : ''); }).join('<br>')
      + (r.quote != null ? '<br>Anteil vom Netto ' + Math.round(r.quote) + ' %' : '') + '</div>';
    if (r.urteil && r.urteil.length) h += '<ul class="eg-urt">' + r.urteil.slice(1, 6).map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
    if (r.nebenkosten) h += '<div class="eg-nk">Kaufnebenkosten ' + E.eur(r.nebenkosten.summe) + ' (' + String(r.nebenkosten.pct).replace('.', ',') + ' %): Grunderwerbsteuer ' + E.eur(r.nebenkosten.grest) + ', Notar ' + E.eur(r.nebenkosten.notar) + ', Grundbuch ' + E.eur(r.nebenkosten.grundbuch) + ', Makler ' + E.eur(r.nebenkosten.makler) + '.</div>';
    h += '<div class="eg-umf" id="egUmf"><b>Was ist in der Nähe?</b><p>Umfeld wird geladen …</p></div>';
    box.innerHTML = h; erg.appendChild(box);
    var str = document.getElementById('egStr').value.trim();
    var adr = (str ? str + ', ' : '') + e.plz + ' ' + (d.gebiet || '').replace(/,.*$/, '');
    E.umfeld(adr).then(function (u) {
      var el = document.getElementById('egUmf'); if (!el) return;
      if (!u || !u.ok) { el.innerHTML = '<b>Was ist in der Nähe?</b><p>Umfeld gerade nicht abrufbar.</p>'; return; }
      el.innerHTML = '<b>Was ist in der Nähe?</b>' + (str ? '' : '<p class="eg-klein">Ohne Straße rund um die Mitte der PLZ.</p>') + '<div class="eg-umf-g">' + u.kategorien.map(function (k) {
        var n = k.naechster;
        return '<div><span>' + k.label + '</span><b>' + (k.nicht_ermittelt ? 'nicht ermittelt' : n ? (n.luftlinie_m < 1000 ? n.luftlinie_m + ' m' : String(Math.round(n.luftlinie_m / 100) / 10).replace('.', ',') + ' km') : 'nicht im Umkreis') + '</b>'
          + (n ? '<small>' + (n.name ? n.name + ' · ' : '') + 'ca. ' + n.fuss_min + ' Min. zu Fuß</small>' : '') + '</div>';
      }).join('') + '</div><p class="eg-klein">' + u.hinweis + ' Kartendaten ' + u.vermerk + '.</p>';
    });
  }
  function start() {
    var e = { kp: zahl('egKp'), wfl: zahl('egWfl'), bj: zahl('egBj'), ek: zahl('egEk'), netto: zahl('egNetto'), plz: document.getElementById('egPlz').value.trim(),
      objektart: document.getElementById('egArt').value };
    if (e.objektart === 'mfh') { var erg0 = document.getElementById('egErg'); erg0.innerHTML = '<div class="eg-satz">' + E.MFH_HINWEIS + '</div>'; erg0.classList.add('da'); return; }
    E.daten(e.plz, e.bj, e.wfl).then(function (d) { var r = E.rechne(e, d); if (!r.ok) return; zeige(r); zusatz(r, d, e); });
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
  if (/[?&]selbst=1/.test(location.search) || document.body.getAttribute('data-hc-seite') === '1') { setze('selbst'); if (!/(?:^#|&)hc=/.test(location.hash)) start(); }
  /* v5130 KK6 · nach dem Kauf zeichnet haus-check-kauf.js das Ergebnis mit dem Wert nach ImmoWertV neu: derselbe Score wie im PDF */
  window.DemoEgZeige = function (r, d, e) { zeige(r); zusatz(r, d, e); };

})();
