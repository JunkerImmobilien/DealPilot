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
  /* pp6 · Karte zum Umdrehen (Marcel 26.11.2026): vorne die Eingaben, hinten das Ergebnis. Pflichtfelder zuerst,
     der Rest unter „Weitere Angaben“. IDs bleiben, haus-check-kauf.js liest sie. */
  var TIP = 'Dein monatliches Netto-Haushaltseinkommen, also alles, was nach Steuern und Sozialabgaben auf dem Konto ankommt, von allen Personen, die mitfinanzieren. Freiwillig. Wir nutzen es nur für die Leistbarkeit und speichern es nicht.';
  k.innerHTML =
    '<div class="eg-flip" id="egFlip">' +
    '<div class="eg-vorne" id="egVorne">' +
    '<div class="eg-kopf"><span>Haus-Check · Selbst nutzen</span><span>Beispielrechnung</span></div>' +
    '<div class="eg-felder">' +
      '<label class="eg-f"><span>Kaufpreis</span><input id="egKp" inputmode="numeric" value="310.000"></label>' +
      '<label class="eg-f"><span>Wohnfläche m²</span><input id="egWfl" inputmode="numeric" value="130"></label>' +
      '<label class="eg-f klein"><span>Baujahr</span><input id="egBj" inputmode="numeric" value="1998"></label>' +
      '<label class="eg-f klein"><span>PLZ</span><input id="egPlz" inputmode="numeric" value="33602"></label>' +
      '<label class="eg-f klein eg-breit"><span>Objekt</span><select id="egArt"><option value="efh">Einfamilienhaus</option><option value="zfh">Zweifamilienhaus</option><option value="dhh">Doppelhaushälfte</option><option value="rh">Reihenhaus</option><option value="etw">Eigentumswohnung</option><option value="mfh">Mehrfamilienhaus</option></select></label>' +
    '</div>' +
    '<details class="eg-mehr" id="egMehr"><summary>Weitere Angaben <small>Eigenkapital, Einkommen, Adresse und Haus</small></summary>' +
    '<div class="eg-felder">' +
      '<label class="eg-f klein"><span>Eigenkapital</span><input id="egEk" inputmode="numeric" value="100.000"></label>' +
      '<div class="eg-f klein eg-mit-tip"><label for="egNetto"><span>Netto im Monat</span></label>' +
        '<button type="button" class="eg-i" id="egNettoI" aria-label="Was heißt Netto im Monat?" aria-describedby="egNettoTip" aria-expanded="false">ⓘ</button>' +
        '<span class="eg-tip" id="egNettoTip" role="tooltip">' + TIP + '</span>' +
        '<input id="egNetto" inputmode="numeric" value="5.200"></div>' +
      '<label class="eg-f eg-breit"><span>Straße und Nr.</span><input id="egStr" placeholder="Musterstraße 1"></label>' +
      '<label class="eg-f klein" id="egGsflF"><span>Grundstück m²</span><input id="egGsfl" inputmode="numeric" value="600"></label>' +
      /* v5130 KK6 · für den Sachwert nach NHK 2010 (Gebäudetyp und Standardstufe), beim Haus */
      '<label class="eg-f klein"><span>Keller</span><select id="egKeller"><option value="ja">unterkellert</option><option value="nein">ohne Keller</option></select></label>' +
      '<label class="eg-f klein"><span>Geschosse</span><select id="egGeschosse"><option value="2">Erd- und Obergeschoss</option><option value="1">nur Erdgeschoss</option></select></label>' +
      '<label class="eg-f klein"><span>Dach</span><select id="egDach"><option value="1">Dachgeschoss ausgebaut</option><option value="2">Dachgeschoss nicht ausgebaut</option><option value="3">Flachdach</option></select></label>' +
      '<label class="eg-f klein eg-breit"><span>Ausstattung</span><select id="egAusst"><option value="normal">normal</option><option value="einfach">einfach</option><option value="gehoben">gehoben</option></select></label>' +
      '<div class="eg-opt">Eigenkapital und Einkommen sind freiwillig. Straße und Grundstück braucht der Bericht für den Wert.</div>' +
    '</div></details>' +
    '<button type="button" class="eg-start" id="egStart">Startfreigabe · Haus prüfen</button>' +
    '</div>' +
    '<div class="eg-hinten" id="egHinten" hidden>' +
    '<div class="eg-kopf"><span>Haus-Check · Ergebnis</span><button type="button" class="eg-zurueck" id="egZurueck">Eingaben ändern</button></div>' +
    '<div class="eg-erg" id="egErg"></div>' +
    '</div>' +
    '</div>';
  szene.appendChild(k);

  function zahl(id) { return Number(String(document.getElementById(id).value).replace(/\./g, '').replace(',', '.')) || 0; }
  function farbe(s) { return s == null ? 'rgba(255,255,255,.2)' : s >= 70 ? '#5BD98E' : s >= 50 ? 'var(--wl-c9a84c,#C9A84C)' : '#E08A7E'; }

  function zeige(r) {
    var U = 2 * Math.PI * 54, voll = U * r.gesamt / 100;
    var g = r.gruppen.filter(function (x) { return x.k !== 'Lage'; }).map(function (x) {   /* pp6 · Lage steht im Bericht */
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
    /* pp6 · Monatsrechnung: Rate, Eigentümerkosten, Heizung, Nebenkosten als Summe, die Posten einzeln eingeklappt.
       Lage, Umfeld und Wert stehen nur im Bericht (Marcel 26.11.2026), nicht auf der Karte. */
    var AU = r.kern && r.kern.leistbarkeit && r.kern.leistbarkeit.aufstellung;
    if (AU && AU.length) {
      var haupt = AU.filter(function (x) { return !x.teil; }), teile = AU.filter(function (x) { return x.teil; });
      h += '<div class="eg-nk"><b>Im Monat</b><div class="eg-mon">' + haupt.map(function (x) {
        var l = x.k === 'uebrige' ? 'Nebenkosten ohne Heizung' : x.l.replace(/ \(.*\)$/, '');
        return '<div' + (x.summe ? ' class="eg-sum"' : '') + '><span>' + l + '</span><b>' + E.eur(x.eur) + '</b></div>';
      }).join('') + '</div>'
        + (teile.length ? '<details class="eg-teile"><summary>Nebenkosten einzeln</summary>' + teile.map(function (x) {
          return '<div><span>' + x.l.replace(/^davon /, '') + ' <small>' + x.herkunft + '</small></span><b>' + E.eur(x.eur) + '</b></div>'; }).join('') + '</details>' : '')
        + (r.quote != null ? '<div class="eg-klein">Anteil vom Netto ' + Math.round(r.quote) + ' %</div>' : '') + '</div>';
    }
    h += '<div class="eg-bericht">Lage, Umfeld und der Wert nach ImmoWertV stehen im Bericht.</div>';
    box.innerHTML = h; erg.appendChild(box);
  }
  function start() {
    var e = { kp: zahl('egKp'), wfl: zahl('egWfl'), bj: zahl('egBj'), ek: zahl('egEk'), netto: zahl('egNetto'), plz: document.getElementById('egPlz').value.trim(),
      objektart: document.getElementById('egArt').value };
    if (e.objektart === 'mfh') { var erg0 = document.getElementById('egErg'); erg0.innerHTML = '<div class="eg-satz">' + E.MFH_HINWEIS + '</div>'; erg0.classList.add('da'); drehe(true); return; }
    /* pp6 · während die Daten kommen, sagt der Knopf, dass gerechnet wird; gedreht wird erst mit dem fertigen Ergebnis */
    var sb = document.getElementById('egStart'), sbText = sb.textContent; sb.disabled = true; sb.textContent = 'Wird geprüft …';
    var fertig = function () { sb.disabled = false; sb.textContent = sbText; };
    E.daten(e.plz, e.bj, e.wfl).then(function (d) { fertig(); var r = E.rechne(e, d); if (!r.ok) return; zeige(r); zusatz(r, d, e); drehe(true); }, fertig);
  }
  document.getElementById('egStart').addEventListener('click', start);

  /* pp6 · Umdrehen wie die Karten der Objektmatrix: halbe Drehung, Seite tauschen, zurück. Die Höhe folgt der sichtbaren Seite.
     Mit prefers-reduced-motion nur der Wechsel. */
  var flip = document.getElementById('egFlip'), vorne = document.getElementById('egVorne'), hinten = document.getElementById('egHinten'), hintenAn = false;
  var still = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function drehe(zurErg) {
    if (zurErg === hintenAn) return; hintenAn = zurErg;
    var fokus = function () { var z = document.getElementById(zurErg ? 'egZurueck' : 'egStart'); if (z) try { z.focus({ preventScroll: true }); } catch (x) {} };
    var tausch = function () { vorne.hidden = zurErg; hinten.hidden = !zurErg; k.classList.toggle('eg-gedreht', zurErg); };
    var hoch = function () { var o = k.getBoundingClientRect().top; if (o < 0) k.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' }); };
    if (still) { tausch(); hoch(); fokus(); return; }
    flip.classList.add('eg-dreht-weg');
    setTimeout(function () {
      tausch(); flip.classList.remove('eg-dreht-weg'); flip.classList.add('eg-dreht-her');
      void flip.offsetWidth; flip.classList.remove('eg-dreht-her'); hoch(); fokus();
    }, 230);
  }
  document.getElementById('egZurueck').addEventListener('click', function () { drehe(false); });
  window.DemoEgDrehe = drehe;

  /* pp6 · Erklärung zu „Netto im Monat“: Maus darüber zeigt sie (CSS), Tippen auf ⓘ schaltet sie */
  var ib = document.getElementById('egNettoI');
  function tipAus() { ib.setAttribute('aria-expanded', 'false'); ib.parentNode.classList.remove('eg-tip-an'); }
  ib.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); var an = ib.getAttribute('aria-expanded') !== 'true'; ib.setAttribute('aria-expanded', String(an)); ib.parentNode.classList.toggle('eg-tip-an', an); });
  document.addEventListener('click', function (ev) { if (!ev.target.closest('.eg-mit-tip')) tipAus(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') tipAus(); });

  function setze(m) {
    [].forEach.call(um.querySelectorAll('button'), function (b) { var an = b.getAttribute('data-m') === m; b.classList.toggle('an', an); b.setAttribute('aria-selected', an); });
    sec.classList.toggle('eg-an', m === 'selbst');
  }
  um.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (b) setze(b.getAttribute('data-m')); });
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('[data-eg-selbst]'); if (!a) return; setze('selbst');
  });
  window.DemoEgSetze = setze;
  if (/[?&]selbst=1/.test(location.search) || document.body.getAttribute('data-hc-seite') === '1') { setze('selbst'); }   /* pp6 · kein Selbststart mehr: vorne stehen die Eingaben, gerechnet wird mit Startfreigabe */
  /* v5130 KK6 · nach dem Kauf zeichnet haus-check-kauf.js das Ergebnis mit dem Wert nach ImmoWertV neu: derselbe Score wie im PDF */
  window.DemoEgZeige = function (r, d, e) { zeige(r); zusatz(r, d, e); };

})();
