'use strict';
/* ═══════════════════════════════════════════════════════════════════
   prozess-atlas-gesamt.js — v2218 · Der Gesamt-Atlas

   Marcel, 14.10.2026, zur Demo design/Vorschläge/prozessatlas/
   atlas-gesamt.html: „am besten so starten wie der Atlas jetzt startet,
   nur mit allem drauf, und dann den gesamten Ablauf" — und nach der
   Demo: „so wie es in der Demo ist, ist es super."

   Dieses Modul baut NICHTS neu, was prozess-atlas.js schon kann. Es setzt
   sich auf den fertigen Atlas:
     · Start ohne Ziel (Hilfe → „Atlas öffnen") im GESAMTNETZ: alle Abläufe
       in der Kartenoptik des Atlas, nach Phasen, mit Kapitän und
       Datum-Suche. Ein Klick auf eine Linie zoomt in ihren Netzplan.
     · In der Seitenleiste jeder Station: „Was du davon hast", die
       Daten-Spur je Datum (woher, wohin) und — wo es eine gibt — die
       abspielbare Unterkarte (frontend/atlas/*.html, im Fenster).
     · Reiter „Zusammenspiel" und „Beispielflug" (Parkstraße, Demo-Objekt 2026-1056) am Ende, der Knopf
       „Gesamtflug" spielt alles am Stück (Messe).
   Mit Ziel geöffnet (Pilot, Hilfe-Verweis) bleibt alles wie bisher.

   Whitelabel: jedes Gold als var(--wl-<hex>, #<hex>) — das Modul wird von
   index.html geladen und vom Gold-Audit gelesen.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  var A = window.DealPilotAtlas;
  if (!A || A._gesamt) return;
  A._gesamt = true;
  var PZ = A.PROZESSE;

  var G = 'var(--wl-c9a84c, #C9A84C)', GH = 'var(--wl-e8cc7a, #E8CC7A)', GL = 'var(--wl-b8932f, #b8932f)';
  function mix(c, p) { return 'color-mix(in srgb, ' + c + ' ' + p + '%, transparent)'; }
  function sort(p) { return p.knoten.slice().sort(function (a, b) { return a.s - b.s || a.z - b.z; }); }
  function P(id) { return PZ.filter(function (p) { return p.id === id; })[0]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* Was du davon hast — je Ablauf ein Satz, nur was der Code hält */
  var NUTZEN = {
    reise: 'Ein Objekt, ein Datensatz vom Inserat bis zur Steuer — nichts wird zweimal eingegeben.',
    quickcheck: 'In einer Minute weißt du, ob sich der zweite Blick lohnt — und zu welchem Preis.',
    sprache: 'Objekt erzählen statt tippen. Du bestätigst, was übernommen wird; nichts wird still überschrieben.',
    dokumente: 'Exposé, Grundbuch, Gutachten lesen statt abtippen — Personendaten werden vor der KI geschwärzt, Abweichungen gemeldet.',
    boarding: 'Jede Stufe schaltet frei, was ohne sie nicht rechnen darf: keine Kennzahl auf geschätzter Grundlage.',
    marktbericht: 'Ein Wert mit Herkunft: jede amtliche Zahl mit Ausschuss, Lizenz und Stichtag.',
    scores: 'Eine Stufenleiter für alles — dasselbe Objekt trägt überall dieselbe Note.',
    deal: 'Der Plan beim Kauf bleibt stehen. Später siehst du schwarz auf weiß, was daraus geworden ist.',
    steuer: 'Anlage V und Werbungskosten aus denselben Zahlen, die schon im Objekt stehen.',
    telegram: 'DealPilot in der Hosentasche: Kennzahlen, Soll/Ist und Anlegen per Sprachnachricht — mit denselben Rechenkernen wie die App.'
  };
  /* Unterkarten: welche Station spielt welche Seite ab (frontend/atlas/) */
  var UNTER = {
    'sprache:*': ['atlas/2-sprechlauf.html', 'Sprechlauf', 'Ein Diktat läuft ab — Wörter fliegen ins Feld'],
    'dokumente:*': ['atlas/3-dokumentenfluss.html', 'Dokument-Import', 'Lesen, schwärzen, auslesen, vergleichen'],
    'reise:an1': ['atlas/2-sprechlauf.html', 'Sprechlauf', 'Die Datenaufnahme per Stimme'],
    'boarding:e1': ['atlas/3-dokumentenfluss.html', 'Dokument-Import', 'Die Basis aus dem Kaufvertrag lesen'],
    'steuer:s3': ['atlas/3-dokumentenfluss.html', 'Dokument-Import', 'Belege einlesen statt abtippen'],
    'deal:d4': ['atlas/6-flugschreiber.html', 'Beispielflug Parkstraße', 'Was nach „Gewonnen" an einem echten Objekt passiert'],
    'deal:d6': ['atlas/6-flugschreiber.html', 'Beispielflug Parkstraße', 'Soll gegen Ist an der Parkstraße'],
    'reise:be2': ['atlas/6-flugschreiber.html', 'Beispielflug Parkstraße', 'Ist pflegen an der Parkstraße']
  };
  var BUSTER = 'v2218';
  function unterFuer(pid, kid) { return UNTER[pid + ':' + kid] || UNTER[pid + ':*']; }
  var PHASEN = [['PRÜFEN', ['reise', 'quickcheck', 'sprache', 'dokumente']], ['ANALYSIEREN', ['boarding', 'marktbericht', 'scores', 'deal']],
                ['HALTEN', ['steuer']], ['UNTERWEGS', ['telegram']]];

  /* Daten-Spur */
  function norm(s) { return String(s).toLowerCase().replace(/[^a-zäöüß0-9]/g, ''); }
  function passt(a, n) { a = norm(a); return a === n || (n.length > 5 && a.length > 4 && (a.indexOf(n) >= 0 || n.indexOf(a) >= 0)); }
  function spur(d) {
    var n = norm(d), her = [], hin = [];
    PZ.forEach(function (p) { p.knoten.forEach(function (k) {
      if ((k.aus || []).some(function (a) { return passt(a, n); })) her.push([p, k]);
      if ((k.ein || []).some(function (a) { return passt(a, n); })) hin.push([p, k]);
    }); });
    return { her: her, hin: hin };
  }
  function spurHtml(d) {
    var s = spur(d), abl = {};
    s.her.concat(s.hin).forEach(function (e) { abl[e[0].id] = 1; });
    function l(x, c) { return x.length ? x.map(function (e) { return '<button type="button" class="' + c + '" data-spring="' + e[0].id + ':' + e[1].id + '">' + esc(e[1].t) + '<small>' + esc(e[0].name) + '</small></button>'; }).join('') : '<div class="leer">' + (c === 'h' ? 'Eingabe — keine Station erzeugt es.' : 'Endergebnis — geht nicht weiter.') + '</div>'; }
    return '<div class="ag-spur"><div class="kp"><b>' + esc(d) + '</b><span>' + (s.her.length + s.hin.length) + ' Stationen · ' + Object.keys(abl).length + ' Abläufe</span></div>'
      + '<div class="sp2"><div><h5>entsteht in</h5>' + l(s.her, 'h') + '</div><div><h5>gebraucht in</h5>' + l(s.hin, 'g') + '</div></div></div>';
  }

  function css() {
    if (document.getElementById('dp-atlas-gesamt-css')) return;
    var st = document.createElement('style'); st.id = 'dp-atlas-gesamt-css';
    st.textContent = [
      '#dp-atlas .atl-wahl button.ext{border-style:dashed}#dp-atlas .atl-wahl button.ext.an{border-style:solid}',
      '#dp-atlas .atl-wahl .trenn{flex:0 0 auto;width:1px;background:' + mix(G, 30) + ';margin:4px 4px}',
      '#dp-atlas .atl-wahl .neu{font:700 8.5px "JetBrains Mono",monospace;color:#3FA56C;margin-left:4px}',
      '#dp-atlas .atl-btn.gf{background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');color:#1a1407;border-color:transparent}',
      '#dp-atlas .atl-rumpf{position:relative}',
      '#dp-atlas .ag{position:absolute;inset:0 20px 18px;display:none;z-index:4;grid-template-columns:minmax(0,1fr) 380px;gap:14px}',
      '#dp-atlas .ag.an{display:grid}#dp-atlas .ag.voll{grid-template-columns:1fr}',
      '#dp-atlas .atl-rumpf.ag-modus > .atl-netz,#dp-atlas .atl-rumpf.ag-modus > .atl-panel{visibility:hidden}',
      '#dp-atlas .ag iframe{width:100%;height:100%;border:0;border-radius:16px;background:#050505}',
      '#dp-atlas .ag-fl{position:relative;padding:16px 18px 30px;min-width:max-content}',
      '#dp-atlas .ag-phase{font:600 10px "JetBrains Mono",monospace;letter-spacing:.2em;color:' + G + ';margin:18px 0 6px 2px;display:flex;align-items:center;gap:10px}',
      '#dp-atlas .ag-phase::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,' + mix(G, 40) + ',transparent);min-width:300px}',
      '#dp-atlas .ag-bahn{display:flex;align-items:center;padding:7px 0;position:relative;border-radius:14px;transition:background .3s}',
      '#dp-atlas .ag-bahn.an{background:' + mix(G, 7) + '}',
      '#dp-atlas .ag-kopf{flex:0 0 200px;padding:8px 12px;border-radius:12px;cursor:pointer;border:1px solid transparent;margin-right:54px;position:relative;z-index:1}',
      '#dp-atlas .ag-kopf:hover{border-color:' + GH + ';background:rgba(20,18,16,.8)}',
      '#dp-atlas .ag-kopf b{display:block;font:600 15px "Space Grotesk",sans-serif;color:#fdfcfa}',
      '#dp-atlas .ag-kopf span{display:block;font:500 9.5px "JetBrains Mono",monospace;color:#a99d84;letter-spacing:.06em;margin-top:2px}',
      '#dp-atlas .ag-kopf i{font-style:normal;color:' + GH + '}',
      '#dp-atlas .ag-reihe{display:flex;gap:16px;position:relative}',
      '#dp-atlas .ag-reihe::before{content:"";position:absolute;left:10px;right:10px;top:50%;height:2px;background:repeating-linear-gradient(90deg,' + mix(G, 55) + ' 0 6px,transparent 6px 14px);animation:ag-lauf 1.2s linear infinite}',
      '@keyframes ag-lauf{to{background-position:14px 0}}',
      '#dp-atlas .ag-k{position:relative;width:148px;height:62px;box-sizing:border-box;padding:8px 10px;border-radius:12px;background:linear-gradient(160deg,#1f1b16,#15120f);border:1px solid ' + mix(G, 42) + ';cursor:pointer;opacity:0;transform:scale(.6);animation:ag-pop .5s cubic-bezier(.2,1.4,.4,1) forwards;transition:border-color .2s,box-shadow .25s,opacity .3s}',
      '#dp-atlas .ag-k:hover{border-color:' + GH + ';box-shadow:0 12px 30px -12px ' + mix(G, 45) + '}',
      '#dp-atlas .ag-k.opt{border-style:dashed}',
      '#dp-atlas .ag-k .kk{font:500 8.5px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#a99d84;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#dp-atlas .ag-k .tt{font:600 12.5px/1.2 "Space Grotesk",sans-serif;color:#fdfcfa;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '#dp-atlas .ag-k.treffer{border-color:' + GH + ';background:linear-gradient(160deg,#3a301c,#1f1a10);box-shadow:0 0 0 2px ' + mix(GH, 55) + ',0 0 24px -4px ' + mix(GH, 50) + '}',
      '#dp-atlas .ag-k.leise{opacity:.28!important}',
      '@keyframes ag-pop{to{opacity:1;transform:scale(1)}}',
      '#dp-atlas .ag-kap{position:absolute;left:224px;top:0;width:40px;height:64px;z-index:3;pointer-events:none;transition:top .9s cubic-bezier(.45,0,.3,1)}',
      '#dp-atlas .ag-kap .pf-wrap{display:block;width:100%;height:100%}#dp-atlas .ag-kap svg.pf{width:100%;height:100%}',
      '#dp-atlas .ag-zahl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}',
      '#dp-atlas .ag-zahl div{border:1px solid #3a3227;border-radius:10px;padding:8px;text-align:center}',
      '#dp-atlas .ag-zahl b{display:block;font:700 22px "Space Grotesk",sans-serif;color:' + GH + '}',
      '#dp-atlas .ag-zahl span{font:500 9.5px "JetBrains Mono",monospace;color:#a99d84;letter-spacing:.08em}',
      '#dp-atlas .ag-such{width:100%;box-sizing:border-box;margin-top:6px;padding:9px 11px;border-radius:9px;border:1px solid ' + mix(G, 45) + ';background:#0e0c0a;color:#fdfcfa;font:500 13px Inter,sans-serif}',
      '#dp-atlas .ag-vor{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}',
      '#dp-atlas .ag-vor button{border:1px dashed ' + mix(G, 45) + ';background:transparent;color:#e8dcc0;border-radius:7px;padding:3px 8px;font:500 11.5px Inter,sans-serif;cursor:pointer}',
      '#dp-atlas .atl-panel .atl-chip{cursor:pointer}#dp-atlas .atl-panel .atl-chip:hover{border-color:' + GH + '}',
      '#dp-atlas .ag-nutzen{margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(63,165,108,.10);border:1px solid rgba(63,165,108,.4);color:#d6eedf;font-size:13px}',
      '#dp-atlas .ag-nutzen b{display:block;font:500 9.5px "JetBrains Mono",monospace;letter-spacing:.14em;color:#7fd3a0;margin-bottom:3px}',
      '#dp-atlas .ag-unter{margin-top:12px;width:100%;padding:10px;border-radius:10px;border:1px solid ' + GH + ';background:' + mix(GH, 8) + ';color:' + GH + ';font:600 13px "Space Grotesk",sans-serif;cursor:pointer;text-align:left}',
      '#dp-atlas .ag-unter small{display:block;font:400 11.5px Inter,sans-serif;color:#b9ad8f;margin-top:2px}',
      '.ag-spur{margin-top:12px;border:1px solid ' + mix(G, 40) + ';border-radius:12px;padding:10px 12px;background:#0e0c0a;animation:ag-ein .35s ease}',
      '@keyframes ag-ein{from{opacity:0;transform:translateY(6px)}}',
      '.ag-spur .kp{display:flex;justify-content:space-between;align-items:center}',
      '.ag-spur .kp b{font:600 14px "Space Grotesk",sans-serif;color:#fdfcfa}.ag-spur .kp span{font:500 10px "JetBrains Mono",monospace;color:#a99d84}',
      '.ag-spur .sp2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}',
      '.ag-spur h5{margin:0 0 5px;font:600 9.5px "JetBrains Mono",monospace;letter-spacing:.12em;color:#a99d84;text-transform:uppercase}',
      '.ag-spur button{display:block;width:100%;text-align:left;margin-bottom:5px;border:1px solid #3a3227;background:#15120f;border-radius:8px;padding:5px 8px;color:#efe6d2;font:500 12px Inter,sans-serif;cursor:pointer}',
      '.ag-spur button:hover{border-color:' + GH + '}.ag-spur button small{display:block;color:#7f7663;font:500 9.5px "JetBrains Mono",monospace}',
      '.ag-spur .h{border-left:3px solid #7fd3a0}.ag-spur .g{border-left:3px solid ' + G + '}.ag-spur .leer{color:#7f7663;font-size:12px}',
      '#ag-uk{position:fixed;inset:0;z-index:10060;display:none;background:rgba(5,5,5,.78);backdrop-filter:blur(4px);padding:3vh 3vw}',
      '#ag-uk.an{display:block;animation:ag-ein .3s ease}',
      '#ag-uk .rahmen{position:relative;height:100%;border:1px solid ' + GH + ';border-radius:18px;overflow:hidden;background:#050505;box-shadow:0 30px 80px rgba(0,0,0,.7)}',
      '#ag-uk iframe{width:100%;height:100%;border:0}',
      '#ag-uk .zu{position:absolute;right:14px;top:12px;z-index:2;border:1px solid ' + G + ';background:#15120f;color:' + GH + ';border-radius:9px;padding:5px 11px;font:600 18px Inter,sans-serif;cursor:pointer}',
      '#ag-uk .tt{position:absolute;left:18px;top:14px;z-index:2;font:600 10px "JetBrains Mono",monospace;letter-spacing:.16em;color:' + G + ';text-transform:uppercase}',
      '.ag-zoomer{position:fixed;z-index:10055;border:2px solid ' + GH + ';border-radius:16px;background:' + mix(GH, 6) + ';pointer-events:none;transition:all .5s cubic-bezier(.6,0,.2,1)}',
      '#ag-band{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:10058;display:none;align-items:center;gap:12px;padding:9px 16px;border-radius:999px;border:1px solid ' + GH + ';background:rgba(14,12,10,.94);font:600 12px "JetBrains Mono",monospace;color:' + GH + ';box-shadow:0 12px 30px rgba(0,0,0,.6)}',
      '#ag-band.an{display:flex}#ag-band i{width:8px;height:8px;border-radius:50%;background:#D8564C;animation:ag-pk 1.2s infinite}',
      '@keyframes ag-pk{50%{opacity:.25}}#ag-band span{color:#f3ead0;font-weight:500}',
      '#ag-band button{border:1px solid ' + mix(G, 55) + ';background:transparent;color:' + GH + ';border-radius:7px;padding:2px 9px;cursor:pointer}',
      '@media (max-width:900px){#dp-atlas .ag{grid-template-columns:1fr;grid-template-rows:minmax(300px,1fr) auto;overflow:auto;inset:0 12px 14px}#dp-atlas .ag-kopf{flex-basis:150px;margin-right:46px}#dp-atlas .ag-kap{left:166px}}',
      '@media (prefers-reduced-motion:reduce){#dp-atlas .ag-k{animation:none;opacity:1;transform:none}#dp-atlas .ag-reihe::before{animation:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  var root = null, ag = null, modus = null, kap = null, _kopfAlt = null;
  function geheZu(pid, kid) { setzeModus(null); A.oeffne(pid, kid); }

  function erweitern() {
    root = document.getElementById('dp-atlas');
    if (!root || root.getAttribute('data-gesamt')) return !!root;
    root.setAttribute('data-gesamt', '1');
    css();
    var rumpf = root.querySelector('.atl-rumpf');
    ag = document.createElement('div'); ag.className = 'ag'; rumpf.appendChild(ag);
    var gf = document.createElement('button'); gf.type = 'button'; gf.className = 'atl-btn gf'; gf.textContent = '✈ Gesamtflug';
    root.querySelector('.atl-kopf .rechts').insertBefore(gf, root.querySelector('.atl-btn.sp'));
    gf.addEventListener('click', function () { flug ? stoppFlug() : gesamtflug(); });
    root.querySelector('.atl-btn.zu').addEventListener('click', function () { stoppFlug(); setzeModus(null); });
    var wahl = root.querySelector('.atl-wahl');
    new MutationObserver(reiter).observe(wahl, { childList: true });
    wahl.addEventListener('click', function (e) {
      var x = e.target.closest('[data-x]'); if (x) { e.stopPropagation(); setzeModus(x.getAttribute('data-x')); return; }
      if (e.target.closest('[data-p]')) setzeModus(null);
    }, true);
    var pan = rumpf.querySelector('.atl-panel');
    new MutationObserver(function () { if (!pan.querySelector('.ag-ext') && pan.querySelector('h3')) panelExtra(pan); }).observe(pan, { childList: true });
    pan.addEventListener('click', panelKlick);
    ag.addEventListener('click', agKlick);
    ag.addEventListener('mouseover', function (e) { var b = e.target.closest('[data-bahn]'); if (b) kapZu(b.getAttribute('data-bahn')); });
    reiter();
    return true;
  }
  function reiter() {
    var wahl = root.querySelector('.atl-wahl');
    if (wahl.querySelector('[data-x]')) return;
    wahl.insertAdjacentHTML('afterbegin', '<button type="button" class="ext" data-x="gesamt">◎ Gesamtnetz</button><span class="trenn"></span>');
    wahl.insertAdjacentHTML('beforeend', '<span class="trenn"></span><button type="button" class="ext" data-x="zusammen">⟲ Zusammenspiel</button><button type="button" class="ext" data-x="flug">✈ Beispielflug</button>');
    markiere();
  }
  function markiere() {
    root.querySelectorAll('.atl-wahl button').forEach(function (b) {
      if (b.hasAttribute('data-x')) b.classList.toggle('an', b.getAttribute('data-x') === modus);
      else if (modus) b.classList.remove('an');
    });
  }
  function setzeModus(m) {
    if (!root || !ag) return;
    modus = m;
    ag.classList.toggle('an', !!m); ag.parentNode.classList.toggle('ag-modus', !!m);
    ag.classList.toggle('voll', m === 'zusammen' || m === 'flug');
    if (!m) {
      if (_kopfAlt) { root.querySelector('.nm').textContent = _kopfAlt[0]; root.querySelector('.s').textContent = _kopfAlt[1]; _kopfAlt = null; }
      ag.innerHTML = ''; markiere(); return;
    }
    if (!_kopfAlt) _kopfAlt = [root.querySelector('.nm').textContent, root.querySelector('.s').textContent];
    var T = { gesamt: ['Alles auf einer Fläche', 'Alle Abläufe nach Phasen — Klick auf eine Linie zoomt hinein, Klick auf eine Station öffnet sie'],
              zusammen: ['Das Zusammenspiel', 'Ein Objekt, sechs Rechenkerne, alle Abläufe — und was du in der Hand hältst'],
              flug: ['Beispielflug · Parkstraße 9', 'Ein Objekt aus den Demo-Daten fliegt durch die Abläufe — scroll mit'] }[m];
    root.querySelector('.nm').textContent = T[0]; root.querySelector('.s').textContent = T[1];
    if (m === 'gesamt') gesamtnetz();
    if (m === 'zusammen') ag.innerHTML = '<iframe src="atlas/5-zusammenspiel.html?eingebettet&v=' + BUSTER + '" title="Zusammenspiel"></iframe>';
    if (m === 'flug') ag.innerHTML = '<iframe src="atlas/6-flugschreiber.html?eingebettet&v=' + BUSTER + '" title="Flug Parkstraße"></iframe>';
    markiere();
  }

  function gesamtnetz() {
    var n = 0, d = {};
    PZ.forEach(function (p) { n += p.knoten.length; p.knoten.forEach(function (k) { (k.ein || []).concat(k.aus || []).forEach(function (x) { d[x] = 1; }); }); });
    var verz = 0, h = '<div class="ag-fl">', drin = {};
    PHASEN.forEach(function (ph) {
      var bahnen = ph[1].filter(function (pid) { return P(pid); });
      if (!bahnen.length) return;
      h += '<div class="ag-phase">' + ph[0] + '</div>';
      bahnen.forEach(function (pid) { drin[pid] = 1; h += bahn(P(pid)); });
    });
    /* Ein neuer Ablauf ohne Phase fällt nicht still weg */
    var rest = PZ.filter(function (p) { return !drin[p.id]; });
    if (rest.length) { h += '<div class="ag-phase">WEITERE</div>'; rest.forEach(function (p) { h += bahn(p); }); }
    h += '</div>';
    function bahn(p) {
      return '<div class="ag-bahn" data-bahn="' + p.id + '"><div class="ag-kopf" data-zoom="' + p.id + '"><b>' + esc(p.name) + '</b><span>' + p.knoten.length + ' Stationen · <i>hineinzoomen ›</i></span></div><div class="ag-reihe">'
        + sort(p).map(function (k) { verz += 12; return '<div class="ag-k' + (k.opt ? ' opt' : '') + '" data-sp="' + p.id + ':' + k.id + '" style="animation-delay:' + verz + 'ms" title="' + esc(k.d) + '"><div class="kk">' + esc(k.k || '') + '</div><div class="tt">' + esc(k.t) + '</div></div>'; }).join('')
        + '</div></div>';
    }
    var alle = Object.keys(d).sort();
    var vor = ['Kaufpreis', 'Wohnfläche', 'Nettokaltmiete', 'Bodenrichtwert', 'DSCR', 'Werbungskosten'].filter(function (x) { return alle.some(function (a) { return passt(a, norm(x)); }); });
    ag.innerHTML = '<div class="atl-netz">' + h + '</div><div class="atl-panel"><div class="u">Prozess-Atlas · Gesamtnetz</div><h3>Alles, was DealPilot tut — auf einer Fläche</h3>'
      + '<div class="d">Oben die ganze Reise, darunter jeder Ablauf als eigene Linie, geordnet nach Phasen. Die gestrichelte Spur läuft in Flugrichtung.</div>'
      + '<div class="ag-zahl"><div><b>' + PZ.length + '</b><span>ABLÄUFE</span></div><div><b>' + n + '</b><span>STATIONEN</span></div><div><b>' + alle.length + '</b><span>DATEN</span></div></div>'
      + '<div class="bl">Ein Datum verfolgen</div><input class="ag-such" id="ag-such" list="ag-liste" placeholder="z. B. Kaufpreis, DSCR, Wohnfläche …"><datalist id="ag-liste">' + alle.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist>'
      + '<div class="ag-vor">' + vor.map(function (x) { return '<button type="button" data-such="' + x + '">' + x + '</button>'; }).join('') + '</div>'
      + '<div id="ag-spur"></div>'
      + '<div class="bl">So geht es weiter</div><div class="d" style="font-size:12.5px">Klick auf einen Ablauf zoomt in seinen Netzplan. Dort klappt jede Station ihre Schritte auf, die Daten fliegen ein — und jedes Datum lässt sich anklicken. Am Ende: <b>Zusammenspiel</b> und der <b>Flug</b> eines Objekts aus den Demo-Daten.</div></div>';
    if (window.DealPilotFigur) { kap = document.createElement('div'); kap.className = 'ag-kap'; kap.appendChild(DealPilotFigur.bauen({ koffer: true })); ag.querySelector('.ag-fl').appendChild(kap); kapZu('reise'); }
    ag.querySelector('#ag-such').addEventListener('input', function () { suche(this.value); });
  }
  function kapZu(pid) {
    var b = ag && ag.querySelector('[data-bahn="' + pid + '"]'); if (!b || !kap) return;
    ag.querySelectorAll('.ag-bahn').forEach(function (x) { x.classList.toggle('an', x === b); });
    kap.style.top = (b.offsetTop + b.offsetHeight / 2 - 34) + 'px';
  }
  function suche(d) {
    var n = norm(d), box = ag.querySelector('#ag-spur');
    ag.querySelectorAll('.ag-k').forEach(function (k) { k.classList.remove('treffer', 'leise'); });
    if (!d || n.length < 3) { box.innerHTML = ''; return; }
    var s = spur(d), ids = {};
    s.her.concat(s.hin).forEach(function (e) { ids[e[0].id + ':' + e[1].id] = 1; });
    ag.querySelectorAll('.ag-k').forEach(function (k) { var t = ids[k.getAttribute('data-sp')]; k.classList.toggle('treffer', !!t); k.classList.toggle('leise', !t); });
    box.innerHTML = spurHtml(d);
  }
  function agKlick(e) {
    var z = e.target.closest('[data-zoom]'); if (z) return zoom(z.closest('.ag-bahn'), z.getAttribute('data-zoom'));
    var k = e.target.closest('[data-sp]'); if (k) { var a = k.getAttribute('data-sp').split(':'); return zoom(k, a[0], a[1]); }
    var v = e.target.closest('[data-such]'); if (v) { ag.querySelector('#ag-such').value = v.getAttribute('data-such'); return suche(v.getAttribute('data-such')); }
    var s = e.target.closest('[data-spring]'); if (s) { var b = s.getAttribute('data-spring').split(':'); return geheZu(b[0], b[1]); }
  }
  function zoom(vonEl, pid, kid) {
    var a = vonEl.getBoundingClientRect(), b = root.querySelector('.atl-rumpf > .atl-netz').getBoundingClientRect();
    var z = document.createElement('div'); z.className = 'ag-zoomer';
    z.style.cssText = 'left:' + a.left + 'px;top:' + a.top + 'px;width:' + a.width + 'px;height:' + a.height + 'px';
    document.body.appendChild(z);
    requestAnimationFrame(function () { requestAnimationFrame(function () { z.style.left = b.left + 'px'; z.style.top = b.top + 'px'; z.style.width = b.width + 'px'; z.style.height = b.height + 'px'; }); });
    setTimeout(function () { geheZu(pid, kid); z.style.opacity = '0'; }, 480);
    setTimeout(function () { z.remove(); }, 1000);
  }

  /* Seitenleiste im Einzelablauf */
  function panelExtra(pan) {
    var b = root.querySelector('.atl-wahl button.an[data-p]'); if (!b) return;
    var pid = b.getAttribute('data-p');
    var k = root.querySelector('.atl-rumpf > .atl-netz .atl-k.an'), kid = k && k.getAttribute('data-k');
    var ext = document.createElement('div'); ext.className = 'ag-ext';
    var u = unterFuer(pid, kid), h = '';
    if (u) h += '<button type="button" class="ag-unter" data-uk="' + u[0] + '" data-ukt="' + esc(u[1]) + '">▶ Unterkarte: ' + esc(u[1]) + '<small>' + esc(u[2]) + '</small></button>';
    if (NUTZEN[pid]) h += '<div class="ag-nutzen"><b>WAS DU DAVON HAST</b>' + esc(NUTZEN[pid]) + '</div>';
    h += '<div class="bl" style="margin-top:14px">Daten verfolgen</div><div class="d" style="font-size:12px;color:#a99d84">Klick auf ein Datum oben: woher es kommt, wohin es geht.</div><div class="ag-ext-spur"></div>';
    ext.innerHTML = h;
    pan.insertBefore(ext, pan.querySelector('.atl-beleg') || null);
  }
  function panelKlick(e) {
    var pan = root.querySelector('.atl-rumpf > .atl-panel');
    var c = e.target.closest('.atl-chip');
    if (c && !c.classList.contains('flug')) { var box = pan.querySelector('.ag-ext-spur'); if (box) { box.innerHTML = spurHtml(c.textContent.trim()); try { box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (er) {} } return; }
    var s = e.target.closest('[data-spring]'); if (s) { var b = s.getAttribute('data-spring').split(':'); geheZu(b[0], b[1]); return; }
    var u = e.target.closest('[data-uk]'); if (u) unterkarte(u.getAttribute('data-uk'), u.getAttribute('data-ukt'));
  }

  /* Unterkarte im Fenster */
  function ukBauen() {
    var uk = document.getElementById('ag-uk'); if (uk) return uk;
    uk = document.createElement('div'); uk.id = 'ag-uk';
    uk.innerHTML = '<div class="rahmen"><span class="tt"></span><button type="button" class="zu" aria-label="Schließen">×</button><iframe title="Unterkarte"></iframe></div>';
    document.body.appendChild(uk);
    uk.querySelector('.zu').addEventListener('click', ukZu);
    uk.addEventListener('click', function (e) { if (e.target === uk) ukZu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && uk.classList.contains('an')) { e.stopPropagation(); ukZu(); } }, true);
    return uk;
  }
  function unterkarte(datei, titel) {
    var uk = ukBauen();
    uk.querySelector('.tt').textContent = 'Unterkarte · ' + titel;
    uk.querySelector('iframe').src = datei + '?eingebettet&v=' + BUSTER;
    uk.classList.add('an');
  }
  function ukZu() { var uk = document.getElementById('ag-uk'); if (!uk) return; uk.classList.remove('an'); uk.querySelector('iframe').src = 'about:blank'; }

  /* Gesamtflug: Gesamtnetz → jeder Ablauf → Unterkarten → Zusammenspiel → Flug */
  var flug = 0;
  function band(t) {
    var b = document.getElementById('ag-band');
    if (!b) { b = document.createElement('div'); b.id = 'ag-band'; b.innerHTML = '<i></i>GESAMTFLUG <span></span><button type="button">■</button>'; document.body.appendChild(b); b.querySelector('button').addEventListener('click', stoppFlug); }
    b.querySelector('span').textContent = t; b.classList.add('an');
  }
  function stoppFlug() {
    flug = 0; var b = document.getElementById('ag-band'); if (b) b.classList.remove('an');
    var gf = root && root.querySelector('.atl-btn.gf'); if (gf) gf.textContent = '✈ Gesamtflug';
  }
  function warte(ms, g) { return new Promise(function (r, x) { setTimeout(function () { g === flug ? r() : x('stopp'); }, ms); }); }
  async function gesamtflug() {
    var g = flug = Date.now();
    root.querySelector('.atl-btn.gf').textContent = '■ Gesamtflug';
    try {
      band('Gesamtnetz'); setzeModus('gesamt'); await warte(1400, g);
      var bahnen = [].map.call(ag.querySelectorAll('.ag-bahn'), function (b) { return b.getAttribute('data-bahn'); });
      for (var i = 0; i < bahnen.length; i++) { kapZu(bahnen[i]); await warte(550, g); }
      ag.querySelector('#ag-such').value = 'Kaufpreis'; suche('Kaufpreis'); band('Daten-Spur · Kaufpreis'); await warte(3000, g); suche('');
      for (var j = 0; j < bahnen.length; j++) {
        var pid = bahnen[j], p = P(pid);
        band(p.name + ' · ' + (j + 1) + ' von ' + bahnen.length);
        zoom(ag.querySelector('[data-bahn="' + pid + '"] .ag-kopf'), pid);
        await warte(1500, g);
        var reihe = sort(p), wahl = reihe.length <= 4 ? reihe : [reihe[0], reihe[Math.floor(reihe.length / 3)], reihe[Math.floor(reihe.length * 2 / 3)], reihe[reihe.length - 1]];
        for (var s = 1; s < wahl.length; s++) {
          var el = root.querySelector('.atl-rumpf > .atl-netz .atl-k[data-k="' + wahl[s].id + '"]'); if (el) el.click();
          await warte(2300, g);
        }
        if (pid === 'sprache' || pid === 'dokumente') {
          var u = unterFuer(pid, '*'); band('Unterkarte · ' + u[1]); unterkarte(u[0], u[1]);
          await warte(pid === 'sprache' ? 19000 : 16000, g); ukZu();
        }
        setzeModus('gesamt'); await warte(700, g);
      }
      band('Zusammenspiel'); setzeModus('zusammen'); await warte(1500, g);
      try { ag.querySelector('iframe').contentDocument.getElementById('runde').click(); } catch (e) {}
      await warte(14000, g);
      band('Beispielflug Parkstraße'); setzeModus('flug'); await warte(1500, g);
      var kap6 = []; try { kap6 = ag.querySelector('iframe').contentWindow.document.querySelectorAll('.kap'); } catch (e) {}
      for (var q = 1; q < kap6.length; q++) { kap6[q].scrollIntoView({ behavior: 'smooth', block: 'center' }); await warte(3800, g); }
      band('Ende — danke fürs Mitfliegen'); await warte(2500, g);
    } catch (e) { if (e !== 'stopp') throw e; }
    if (g === flug) stoppFlug();
  }

  /* Der Start: ohne Ziel ins Gesamtnetz, mit Ziel wie bisher */
  var _oeffne = A.oeffne;
  A.oeffne = function (pid, station) {
    _oeffne(pid, station);
    /* prozess-atlas.js zeigt nach 16 ms (setTimeout statt rAF) - danach ansetzen */
    setTimeout(function () {
      if (!erweitern()) return;
      reiter();
      if (!pid && !station) setzeModus('gesamt'); else setzeModus(null);
    }, 40);
  };
  A.gesamt = { modus: function (m) { erweitern(); setzeModus(m); }, flug: function () { erweitern(); gesamtflug(); } };
})();
