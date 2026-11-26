/* demo-eigennutzer-upload.js · DEMO (HH6, 26.11.2026) · Variante A: Unterlagen hochladen + Bericht holen.
   NUR DEMO-ABLAUF. Keine Datei verlässt den Browser, nichts wird ausgelesen oder gespeichert.
   Ablauf wie im Deal-Check: erst Unterlagen einlesen, dann Grundangaben bestätigen, dann rechnen.
   Gewählte Dateien werden nur mit Namen angezeigt, die "gelesenen" Angaben sind feste Beispielwerte
   (Muster-Unterlagen Musterstraße 12, siehe Dateien/Konzepte/Eigennutzer-Bericht-Muster/bericht.html). */
(function () {
  var karte = document.querySelector('.eg-karte'); if (!karte) return;
  var css = document.createElement('style');
  css.textContent =
    '.eu-up{margin:0 0 14px;border:1px dashed color-mix(in srgb,var(--wl-e8cc7a,#E8CC7A) 45%,transparent);border-radius:12px;padding:12px 14px;background:rgba(255,255,255,.03)}' +
    '.eu-up h4{margin:0 0 4px;font:700 14px/1.3 var(--disp,"Space Grotesk",sans-serif);color:#fff}' +
    '.eu-up p{margin:0 0 10px;font:400 12px/1.45 var(--body,Inter,sans-serif);color:rgba(236,230,214,.62)}' +
    '.eu-knoepfe{display:flex;flex-wrap:wrap;gap:8px}' +
    '.eu-knoepfe label,.eu-knoepfe button{cursor:pointer;border-radius:9px;padding:9px 12px;font:600 12.5px/1 var(--body,Inter,sans-serif);border:1px solid color-mix(in srgb,var(--wl-e8cc7a,#E8CC7A) 40%,transparent);background:transparent;color:var(--wl-e8cc7a,#E8CC7A)}' +
    '.eu-knoepfe label input{display:none}' +
    '.eu-liste{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:6px}' +
    '.eu-liste li{display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:center;font:400 12px/1.35 var(--body,Inter,sans-serif);color:rgba(236,230,214,.8)}' +
    '.eu-liste li i{width:14px;height:14px;border-radius:50%;border:2px solid rgba(236,230,214,.25);border-top-color:var(--wl-c9a84c,#C9A84C);animation:eu-dreh .8s linear infinite}' +
    '.eu-liste li.ok i{animation:none;border:0;background:#3FA56C;position:relative}' +
    '.eu-liste li.ok i::after{content:"";position:absolute;left:4.5px;top:2.5px;width:3px;height:6px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}' +
    '.eu-liste li b{font:500 11px/1 var(--mono,"JetBrains Mono",monospace);color:rgba(236,230,214,.5)}' +
    '.eu-fazit{margin-top:10px;font:500 12.5px/1.45 var(--body,Inter,sans-serif);color:#fff}' +
    '.eu-fazit em{font-style:normal;color:#E8B04A}' +
    '.eu-bericht{margin-top:14px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;border-top:1px solid rgba(236,230,214,.12);padding-top:14px}' +
    '.eu-bericht div{font:400 12px/1.45 var(--body,Inter,sans-serif);color:rgba(236,230,214,.7)}' +
    '.eu-bericht div b{display:block;color:#fff;font:700 14px/1.3 var(--disp,"Space Grotesk",sans-serif)}' +
    '.eu-bericht a.k{display:inline-block;text-decoration:none;border-radius:10px;padding:12px 16px;font:700 13.5px/1 var(--disp,"Space Grotesk",sans-serif);color:#0a0907;background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));white-space:nowrap}' +
    '.eu-bericht a.m{grid-column:1/-1;font:500 12px/1 var(--body,Inter,sans-serif);color:var(--wl-e8cc7a,#E8CC7A)}' +
    '.eu-hinweis{grid-column:1/-1;font:400 11.5px/1.4 var(--body,Inter,sans-serif);color:rgba(236,230,214,.55);display:none}' +
    '@keyframes eu-dreh{to{transform:rotate(360deg)}}' +
    '@media (max-width:520px){.eu-bericht{grid-template-columns:1fr}.eu-bericht a.k{text-align:center}}';
  document.head.appendChild(css);

  var up = document.createElement('div'); up.className = 'eu-up';
  up.innerHTML =
    '<h4>Unterlagen reinladen, wir lesen sie aus</h4>' +
    '<p>Exposé, Energieausweis, Grundriss, Modernisierungsliste. Bei einer Wohnung dazu Protokolle, Wirtschaftsplan und Teilungserklärung. Du bestätigst danach nur noch die Grundangaben.</p>' +
    '<div class="eu-knoepfe"><label>Dateien wählen<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png"></label><button type="button" data-eu-beispiel>Beispielunterlagen nehmen</button></div>' +
    '<ul class="eu-liste"></ul><div class="eu-fazit"></div>';
  var felder = karte.querySelector('.eg-felder');
  karte.insertBefore(up, felder);

  var BEISPIEL = [
    { n: 'Exposé.pdf', a: '8 Angaben' }, { n: 'Energieausweis.pdf', a: '5 Angaben' },
    { n: 'Grundriss.pdf', a: '3 Angaben' }, { n: 'Modernisierungsliste.pdf', a: '3 Angaben' }, { n: 'Flurkarte.pdf', a: '1 Angabe' }
  ];
  function setze(id, v) { var e = document.getElementById(id); if (e) e.value = v; }
  function lese(dateien) {
    var liste = up.querySelector('.eu-liste'), fazit = up.querySelector('.eu-fazit');
    liste.innerHTML = dateien.map(function (d) { return '<li><i></i><span>' + d.n + '</span><b>liest …</b></li>'; }).join('');
    fazit.textContent = '';
    [].forEach.call(liste.children, function (li, i) {
      setTimeout(function () { li.classList.add('ok'); li.querySelector('b').textContent = dateien[i].a || 'gelesen'; }, 500 + i * 420);
    });
    setTimeout(function () {
      setze('egKp', '310.000'); setze('egWfl', '130'); setze('egBj', '1998'); setze('egPlz', '33602');
      fazit.innerHTML = dateien.length + ' Unterlagen gelesen, Grundangaben eingetragen. <em>Bitte prüfen: Exposé nennt 135 m², der Grundriss ergibt 130 m².</em>';
    }, 700 + dateien.length * 420);
  }
  up.querySelector('[data-eu-beispiel]').addEventListener('click', function () { lese(BEISPIEL); });
  up.querySelector('input[type=file]').addEventListener('change', function (ev) {
    var f = [].slice.call(ev.target.files || []).slice(0, 8);
    if (!f.length) return;
    lese(f.map(function (x, i) { return { n: x.name, a: BEISPIEL[i % BEISPIEL.length].a }; }));
  });

  /* Nach dem Ergebnis: Bericht holen (Demo-Knopf ohne Kauf) + Muster ansehen */
  var erg = document.getElementById('egErg');
  function bericht() {
    if (!erg || erg.querySelector('.eu-bericht') || !erg.children.length) return;
    var b = document.createElement('div'); b.className = 'eu-bericht';
    b.innerHTML = '<div><b>Kompletter Haus-Check als PDF</b>Wert mit Rechenweg, Kaufen oder mieten, Leistbarkeit, Zustand und Sanierung, Förderung, Nebenkosten und Checkliste für die Besichtigung. 13 Seiten.</div>' +
      '<a class="k" href="#" data-eu-kauf>Bericht holen</a>' +
      '<a class="m" href="demo-eigennutzer-bericht.pdf" target="_blank" rel="noopener">Muster ansehen</a>' +
      '<div class="eu-hinweis">Demo: Hier würde der Kauf starten. Preis legt Marcel fest.</div>';
    erg.appendChild(b);
    b.querySelector('[data-eu-kauf]').addEventListener('click', function (ev) { ev.preventDefault(); b.querySelector('.eu-hinweis').style.display = 'block'; });
  }
  if (erg) new MutationObserver(bericht).observe(erg, { childList: true });
  if (/[?&]upload=1/.test(location.search)) lese(BEISPIEL);
})();
