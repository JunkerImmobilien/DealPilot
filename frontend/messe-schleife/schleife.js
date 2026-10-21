/* ═══════════════════════════════════════════════════════════════════════
   messe-schleife.js · messe-schleife-1 — Dauerschleife für den Messestand
   Aufruf: ohne Parameter (oder ?idee=rundgang) der Rundgang (rundgang.js, seit messe-schleife-4)
           ?idee=auswahl die Auswahl · ?idee=1 … 6 · ?idee=alle (jede eine Runde)
           In jeder Idee: Leiste bei Mausbewegung, Tasten R, 1–6, A, Esc.
           Läuft auch direkt von der Platte (file://): keine Abrufe, alles relativ.
           &tempo=1.4 streckt alle Wartezeiten (Vorgabe 1)

   Die Zahlen sind KEINE Erfindung: jede steht so im Kapitelband eines
   Videos der Videoreihe (Demo-Objekte des Kontos info@ auf Staging) und
   wurde dort am 21.10.2026 abgelesen — Modulnummer je Block unten. Die
   Clips unter messe-schleife/clips/ sind Ausschnitte genau dieser Videos.
   Score-Wort und -Farbe kommen aus js/score-tiers.js (ScoreTier.stufe).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var VER = 'messe-schleife-4';
  var Q = new URLSearchParams(location.search);
  var TEMPO = Math.max(0.3, Math.min(4, parseFloat(Q.get('tempo')) || 1));
  var GRUEN = '#3FA56C', ROT = '#B8625C', GOLD = 'var(--wl-c9a84c,#C9A84C)';
  var FLIEGER = '<svg viewBox="0 0 64 64"><path d="M32 2c2 0 3 3 3 6v16l22 12v6l-22-6v12l7 5v4l-10-3-10 3v-4l7-5V36L7 42v-6l22-12V8c0-3 1-6 3-6z"/></svg>';

  /* ── Demo-Zahlen je Funktion (Quelle: Kapitelband des genannten Moduls) ── */
  var F = [
    { id: 'qc', nr: 1, modul: 'Ü1', kick: 'Quick-Check', titel: 'Vom Exposé zum Urteil',
      zahl: '178.000 €', zahlLab: 'realistischer Marktwert',
      text: 'Spanne <b>144.000–261.000 €</b>, Angebotspreise minus <b>5,8 %</b>.',
      score: 59, clip: 'qc-score',
      vorher: ['Exposé abtippen.', 'Tabelle bauen, Marktwert raten.'] },
    { id: 'score', nr: 2, modul: '12', kick: 'Deal Score', titel: '78 von 100 · Gut',
      zahl: '78 / 100', zahlLab: 'DealPilot Score',
      text: 'Cashflow <b>100</b> · Rendite <b>100</b> · DSCR <b>100</b> · LTV <b>67</b> · Potenzial <b>42</b>',
      score: 78, clip: 'score-deal', clip2: 'score-investor',
      vorher: ['Bauchgefühl.', 'Passt das Objekt? Vielleicht.'] },
    { id: 'pilot', nr: 3, modul: '11', kick: 'Pilot-Analyse', titel: 'Kaufen — zu welchem Preis',
      zahl: '530.000 €', zahlLab: 'Offerte statt 545.000 €',
      text: '<b>5 Stärken, 5 Risiken</b> — in ganzen Sätzen, mit deinen Zahlen.',
      clip: 'pilot-offerte', clip2: 'pilot-urteil',
      vorher: ['Was biete ich an?', 'Und wie begründe ich das?'] },
    { id: 'mb', nr: 4, modul: '18', kick: 'Marktbericht · Wertermittlung', titel: 'Marktwert mit Rechenweg',
      zahl: '487.000 €', zahlLab: 'Marktwert-Indikation',
      text: 'Ertragswert <b>332.000 €</b> · Sachwert <b>295.000 €</b> · Liegenschaftszins <b>2,9 %</b>',
      score: 50, clip: 'mb-marktwert', clip2: 'mb-wertermittlung',
      vorher: ['Bodenrichtwert suchen.', 'Zins, Faktor, Rechenweg — selbst.'] },
    { id: 'steuer', nr: 5, modul: '27', kick: 'Steuerverlauf', titel: 'Wendepunkt 2027',
      zahl: '2027', zahlLab: 'ab hier zahlst du Steuern',
      text: '2026: Ergebnis <b>−31.998 €</b>, Erstattung <b>+11.459 €</b>. 2027: <b>+7.208 €</b>.',
      clip: 'steuer-wendepunkt',
      vorher: ['Wann kostet das Haus Steuern?', 'Das sagt dir erst der Bescheid.'] },
    { id: 'zielbild', nr: 6, modul: '26', kick: 'Mieterhöhung · Zielbild', titel: 'Was im Haus steckt',
      zahl: '770.000 €', zahlLab: 'Ertragswert im Zielbild',
      text: 'Bestand <b>595.000 €</b> → Mieterhöhung <b>620.000 €</b> → Zielbild <b>770.000 €</b>',
      clip: 'zielbild-pdf',
      vorher: ['Jede Wohnung eine Notiz.', 'Potenzial? Geschätzt.'] },
    { id: 'bank', nr: 7, modul: '19', kick: 'Bank-PDF', titel: 'Investment Case für die Bank',
      zahl: '8 Seiten', zahlLab: 'ein Klick, jedes Mal aktuell',
      text: 'DSCR <b>1,67</b> · Bruttorendite <b>7,23 %</b> · Belastungsprobe inklusive',
      score: 78, clip: 'bank-kennzahlen',
      vorher: ['Ordner für die Bank.', 'Zahlen abtippen, Seite für Seite.'] },
    { id: 'bot', nr: 8, modul: '22', kick: 'Telegram-Bot', titel: 'Frag dein Portfolio',
      zahl: '39 Objekte', zahlLab: '„Welche Objekte habe ich?“',
      text: 'Soll gegen Ist: Cashflow nach Steuer <b>−6.193 → 775 EUR</b>, 8 von 10 Kennzahlen besser.',
      clip: 'telegram-liste', clip2: 'telegram-sollist',
      vorher: ['Unterwegs?', 'Dann eben später nachsehen.'] },
    { id: 'portfolio', nr: 9, modul: '21', kick: 'Portfolio-Cockpit', titel: 'Alle Objekte, ein Score',
      zahl: '69 · Solide', zahlLab: 'Portfolio-Score über 11 Objekte',
      text: 'Volumen <b>6,38 Mio €</b> · Cashflow <b>+1.920 €</b> im Monat · Restschuld <b>5,24 Mio €</b>',
      score: 69, clip: 'portfolio-score', clip2: 'portfolio-steuer',
      vorher: ['Jedes Objekt eine Datei.', 'Das Ganze sieht keiner.'] }
  ];

  /* Instrumente je Funktion (Cockpit). null = für dieses Objekt nicht im Video
     genannt -> Strich, Nadel in Ruhe. [von, bis] = Bewegung innerhalb der Szene. */
  var INSTR = {
    qc:        { score: 59, dscr: 1.27, cf: 20,   rendite: 5.9,  ltv: null, invest: null },   // Ü1 Kap. 11-12
    score:     { score: 78, dscr: 1.67, cf: 677,  rendite: 7.23, ltv: 83.3, invest: 74 },     // M12
    pilot:     { score: 78, dscr: 1.67, cf: 677,  rendite: 7.23, ltv: 83.3, invest: 74 },     // M11 = M12-Objekt
    mb:        { score: 50, dscr: null, cf: null, rendite: 4.92, ltv: null, invest: null },   // M18
    steuer:    { score: null, dscr: null, cf: null, rendite: null, ltv: null, invest: null }, // M27 (Steuer, keine KPIs)
    zielbild:  { score: null, dscr: [0.75, 1.32], cf: null, rendite: [4.54, 6.92], ltv: null, invest: null }, // M26 PDF-Seite
    bank:      { score: 78, dscr: 1.67, cf: 677,  rendite: 7.23, ltv: 83.3, invest: 74 },     // M19
    bot:       { score: null, dscr: [0.90, 1.23], cf: null, rendite: [3.7, 5.1], ltv: 131.4, invest: null }, // M22 Soll-Ist
    portfolio: { score: 69, dscr: 1.28, cf: 1920, rendite: null, ltv: null, invest: null }    // M21
  };

  /* ── Werkzeuge ── */
  var buehne, funkenAus = null;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  /* window.DPS_HALT = true hält die Schleife nach der laufenden Wartezeit an (nur zum Prüfen von Standbildern). */
  function warte(ms) { return new Promise(function (r) { setTimeout(function w() { if (window.DPS_HALT) setTimeout(w, 200); else r(); }, ms * TEMPO); }); }
  function rahmen() { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var NF0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  function fmt(n, dez) { return new Intl.NumberFormat('de-DE', { minimumFractionDigits: dez || 0, maximumFractionDigits: dez || 0 }).format(n); }
  function zaehle(node, von, bis, ms, f) {
    var t0 = performance.now(); ms = ms * TEMPO;
    (function s(t) { var p = Math.max(0, Math.min(1, (t - t0) / ms)), e = 1 - Math.pow(1 - p, 3); node.textContent = f(von + (bis - von) * e); if (p < 1 && node.isConnected) requestAnimationFrame(s); })(t0);
  }
  function stufe(score) {
    var st = (window.ScoreTier && window.ScoreTier.stufe) ? window.ScoreTier.stufe(score) : { wort: '–', versal: '–', farbe: 'na' };
    st.css = { top: GRUEN, green: GRUEN, gold: GOLD, red: ROT }[st.farbe] || '#8c8578';
    return st;
  }
  function ring(score, px) {
    var st = stufe(score);
    var r = el('div', 'ring');
    r.style.setProperty('--px', px + 'px'); r.style.setProperty('--farbe', st.css); r.style.setProperty('--ziel', score);
    r.innerHTML = '<svg viewBox="0 0 120 120"><circle class="bahn" cx="60" cy="60" r="52"/><circle class="wert" cx="60" cy="60" r="52" pathLength="100"/></svg>'
      + '<div class="ring-mitte"><div class="ring-zahl">0</div><div class="ring-von">/ 100</div></div>';
    r.zuenden = function () { r.classList.add('an'); zaehle(r.querySelector('.ring-zahl'), 0, score, 2000, function (v) { return Math.round(v); }); };
    r.stufe = st;
    return r;
  }
  function video(name, cls) {
    var v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = true; v.preload = 'auto';
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    v.src = 'messe-schleife/clips/' + name + '.mp4?v=' + VER;
    if (cls) v.className = cls;
    return v;
  }
  function spiel(v) { try { v.currentTime = 0; } catch (e) { /* noch nicht geladen */ } var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  function fuss(txt) { var f = el('div', 'fuss', txt || 'Beispielzahlen aus den <b>DealPilot</b>-Demo-Objekten'); buehne.appendChild(f); return f; }
  /* „Alle im Wechsel“: nach einer vollen Runde die nächste Idee. Gewechselt
     wird per Neuladen — jede Idee hat eigene Schleifen, Takte und Videos, ein
     frisches Dokument räumt sie vollständig ab (auch unter file://). */
  var ALLE = Q.get('idee') === 'alle', wechselt = false;
  function status(idee, runde, szene) {
    window.DPS = { idee: idee, runde: runde, szene: szene, zeit: Date.now(), alle: ALLE };
    if (ALLE && runde > 1 && !wechselt) { wechselt = true; geh('?idee=alle&n=' + (idee % 6 + 1) + (Q.get('tempo') ? '&tempo=' + Q.get('tempo') : ''), true); }
  }
  function geh(q, ersetzen) {
    document.body.classList.add('raus');
    setTimeout(function () { if (ersetzen) location.replace(q); else location.href = q; }, 600);
  }
  function zurAuswahl() {
    if (window.parent !== window) { try { window.parent.postMessage({ dps: 'auswahl' }, '*'); return; } catch (e) { /* weiter */ } }
    geh(location.href.split('?')[0].split('#')[0] + '?idee=auswahl');
  }

  /* Goldstaub im Hintergrund — Canvas kann kein var(), also Token auslesen. */
  function funken() {
    var c = el('canvas'); c.id = 'funken'; c.width = 1920; c.height = 1080; buehne.appendChild(c);
    var x = c.getContext('2d');
    var farbe = (getComputedStyle(document.documentElement).getPropertyValue('--wl-c9a84c') || '').trim() || '#C9A84C';
    var P = [];
    for (var i = 0; i < 90; i++) P.push({ x: Math.random() * 1920, y: Math.random() * 1080, r: Math.random() * 2.2 + .4, v: Math.random() * .35 + .08, a: Math.random() * .5 + .1, p: Math.random() * 6 });
    var lauf = true;
    (function m(t) {
      if (!lauf) return;
      x.clearRect(0, 0, 1920, 1080); x.fillStyle = farbe;
      for (var j = 0; j < P.length; j++) {
        var q = P[j]; q.y -= q.v; q.x += Math.sin(t / 2400 + q.p) * .25;
        if (q.y < -10) { q.y = 1090; q.x = Math.random() * 1920; }
        x.globalAlpha = q.a * (.6 + .4 * Math.sin(t / 700 + q.p)); x.beginPath(); x.arc(q.x, q.y, q.r, 0, 7); x.fill();
      }
      requestAnimationFrame(m);
    })(0);
    return function () { lauf = false; };
  }

  /* ══════════════ Idee 1 · Kinetik ══════════════ */
  function idee1() {
    buehne.appendChild(el('div', 'k1-strahl')); buehne.appendChild(el('div', 'k1-raster'));
    funkenAus = funken();
    var zaehler = el('div', 'k1-zaehler'); buehne.appendChild(zaehler);
    fuss();
    function worte(txt, start) { return txt.split(' ').map(function (w, i) { return '<span class="w"><i style="--i:' + (i + (start || 0)) + '">' + esc(w) + '</i></span>'; }).join(' '); }
    var T = [
      function (k) { k.innerHTML = '<div class="k1-marke marke">Deal<b>Pilot</b></div><div class="k1-claim">Immobilien prüfen wie ein <em>Pilot</em>.</div>'; return 5200; },
      function (k) { k.innerHTML = '<div class="kick">Quick-Check</div><div class="k1-wort">' + worte('Exposé rein.') + '</div><div class="k1-wort gold">' + worte('Urteil raus.', 2) + '</div>'; return 5000; },
      function (k) { k.innerHTML = '<div class="kick">Quick-Check · Marktwert</div><div class="k1-zahl gold">0 €</div><div class="k1-strich"></div><div class="k1-sub">realistisch — Angebotspreise minus <b>5,8 %</b></div>';
        setTimeout(function () { zaehle(k.querySelector('.k1-zahl'), 0, 178000, 1800, function (v) { return NF0.format(Math.round(v / 1000) * 1000) + ' €'; }); }, 200); return 6000; },
      function (k) { k.innerHTML = '<div class="kick">Wertpuffer</div><div class="k1-zahl">+0 €</div><div class="k1-strich"></div><div class="k1-sub">gekauft für <b>139.000 €</b>, realistisch wert rund <b>178.000 €</b></div>';
        setTimeout(function () { zaehle(k.querySelector('.k1-zahl'), 0, 39000, 1600, function (v) { return '+' + NF0.format(Math.round(v / 100) * 100) + ' €'; }); }, 200); return 6000; },
      function (k) { var r = ring(78, 440); var z = el('div', 'k1-ringzeile'); z.appendChild(r);
        var re = el('div', 'rechts', '<div class="kick">Deal Score</div><div class="ring-titel">Ein Urteil.</div><span class="pille" style="--farbe:' + r.stufe.css + '">' + r.stufe.versal + '</span>');
        z.appendChild(re); k.appendChild(z);
        k.appendChild(el('div', 'k1-chips', ['Cashflow <b>100</b>', 'Rendite <b>100</b>', 'DSCR <b>100</b>', 'LTV <b>67</b>', 'Potenzial <b>42</b>'].map(function (s, i) { return '<span style="--i:' + i + '">' + s + '</span>'; }).join('')));
        setTimeout(r.zuenden, 300); return 6800; },
      function (k) { k.innerHTML = '<div class="kick">Pilot-Analyse · Gesamturteil</div><div class="k1-wort gold" style="font-size:300px">' + worte('KAUFEN.') + '</div><div class="k1-sub"><b>5 Stärken, 5 Risiken</b> — in ganzen Sätzen, mit deinen Zahlen.</div>'; return 5600; },
      function (k) { k.innerHTML = '<div class="kick">Pilot-Analyse · Offerte</div><div class="k1-tausch"><span class="alt">545.000 €</span><span class="pfeil">→</span><span class="neu gold">530.000 €</span></div><div class="k1-sub">mit Begründung, die du dem Verkäufer nennen kannst</div>'; return 6400; },
      function (k) { k.innerHTML = '<div class="kick">Marktbericht · Wertermittlung</div><div class="k1-zahl m gold">0 €</div><div class="k1-strich"></div>';
        k.appendChild(el('div', 'k1-chips', ['Ertragswert <b>332.000 €</b>', 'Sachwert <b>295.000 €</b>', 'Bodenwert <b>178.582 €</b>', 'Zins <b>2,9 %</b>'].map(function (s, i) { return '<span style="--i:' + i + '">' + s + '</span>'; }).join('')));
        setTimeout(function () { zaehle(k.querySelector('.k1-zahl'), 0, 487000, 1800, function (v) { return NF0.format(Math.round(v / 1000) * 1000) + ' €'; }); }, 200); return 6600; },
      function (k) { var b = ''; var h = [60, 110, 130, 170], hg = [36, 58, 60, 62, 64, 66, 26, 28, 30];
        h.forEach(function (x, i) { b += '<i class="v" style="--i:' + i + ';--h:' + x + 'px"></i>'; });
        hg.forEach(function (x, i) { b += '<i class="g" style="--i:' + (i + 4) + ';--h:' + x + 'px"></i>'; });
        k.innerHTML = '<div class="kick">Steuerverlauf</div><div class="k1-zahl m">2027</div><div class="k1-balken">' + b + '<span class="wende" style="left:270px"></span></div><div class="k1-sub" style="margin-top:20px">Erst nach <b>4 Verlustjahren</b> dreht das Ergebnis — ab hier zahlst du Steuern.</div>'; return 6800; },
      function (k) { var w = [['Bestand', 595000, 300, 1], ['Mieterhöhung', 620000, 312, 0], ['Zielbild', 770000, 388, 0]];
        k.innerHTML = '<div class="kick">Mieterhöhung · Zielbild · Ertragswert</div>';
        var t = el('div', 'k1-trio'); w.forEach(function (x, i) { t.appendChild(el('div', '', '<div class="betrag' + (i === 2 ? ' gold' : '') + '">' + NF0.format(x[1]) + ' €</div><div class="saeule' + (x[3] ? ' blass' : '') + '" style="--i:' + i + ';--h:' + x[2] + 'px"></div><div class="lab">' + x[0] + '</div>')); t.lastChild.style.setProperty('--i', i); });
        k.appendChild(t); return 6800; },
      function (k) { k.innerHTML = '<div class="kick">Bank-PDF · Investment Case</div><div class="k1-wort">' + worte('8 Seiten') + '</div><div class="k1-wort m gold">' + worte('für die Bank.', 2) + '</div>';
        k.appendChild(el('div', 'k1-chips', ['DSCR <b>1,67</b>', 'Cashflow <b>+677 €</b>/Monat', 'Belastungsprobe'].map(function (s, i) { return '<span style="--i:' + i + '">' + s + '</span>'; }).join(''))); return 6000; },
      function (k) { k.innerHTML = '<div class="kick" style="margin-bottom:50px">Telegram-Bot</div><div class="k1-chat"><div class="blase frage">Welche Objekte habe ich?</div><div class="k1-tippt"><i></i><i></i><i></i></div><div class="blase antwort">Du hast aktuell <b>39</b> Objekte — die stärksten zuerst.</div></div>'; return 6400; },
      function (k) { var r = ring(69, 440); var z = el('div', 'k1-ringzeile'); z.appendChild(r);
        z.appendChild(el('div', 'rechts', '<div class="kick">Portfolio-Cockpit</div><div class="ring-titel">11 Objekte.</div><span class="pille" style="--farbe:' + r.stufe.css + '">' + r.stufe.versal + '</span>'));
        k.appendChild(z);
        k.appendChild(el('div', 'k1-chips', ['Volumen <b>6,38 Mio €</b>', 'Cashflow <b>+1.920 €</b>/Monat', 'Restschuld <b>5,24 Mio €</b>'].map(function (s, i) { return '<span style="--i:' + i + '">' + s + '</span>'; }).join('')));
        setTimeout(r.zuenden, 300); return 6800; },
      function (k) { k.innerHTML = '<div class="k1-marke marke">Deal<b>Pilot</b></div><div class="k1-claim">Der Co-Pilot hat gesprochen — <em>entscheiden tust du.</em></div><div class="k1-url">dealpilot.immo</div>'; return 6000; }
    ];
    T.forEach(function () { zaehler.appendChild(el('i')); });
    var runde = 0;
    (async function lauf() {
      for (;;) {
        runde++;
        for (var i = 0; i < T.length; i++) {
          status(1, runde, i + 1);
          [].forEach.call(zaehler.children, function (z, j) { z.classList.toggle('an', j <= i); });
          var k = el('div', 'k1'); buehne.appendChild(k);
          var dauer = T[i](k);
          await rahmen(); k.classList.add('an');
          await warte(dauer);
          k.classList.add('weg'); await warte(550); k.remove();
        }
      }
    })();
  }

  /* ══════════════ Idee 2 · Cockpit ══════════════ */
  function idee2() {
    funkenAus = funken();
    var kopf = el('div', 'c2-kopf', '<div class="marke">Deal<b>Pilot</b></div><div class="mitte">FLIGHT DECK · <b>●</b> IM FLUG</div><div class="c2-uhr"></div>');
    buehne.appendChild(kopf);
    var uhr = kopf.querySelector('.c2-uhr');
    function uhrStellen() { uhr.textContent = new Date().toLocaleTimeString('de-DE'); }
    uhrStellen(); setInterval(uhrStellen, 500);
    var DEF = [
      { k: 'score', lab: 'Deal Score', min: 0, max: 100, dez: 0, einh: '' },
      { k: 'dscr', lab: 'DSCR', min: 0, max: 2.5, dez: 2, einh: '', gruen: 1.2 },
      { k: 'cf', lab: 'Cashflow', min: -500, max: 2000, dez: 0, einh: '€/M', gruen: 0 },
      { k: 'rendite', lab: 'Rendite', min: 0, max: 10, dez: 2, einh: '%' },
      { k: 'ltv', lab: 'Beleihung', min: 0, max: 140, dez: 1, einh: '%' },
      { k: 'invest', lab: 'Investor', min: 0, max: 100, dez: 0, einh: '' }
    ];
    var L = el('div', 'c2-spalte l'), R = el('div', 'c2-spalte r'); buehne.appendChild(L); buehne.appendChild(R);
    var A0 = -120, A1 = 120;  // Zeigerweg in Grad
    function polar(a, r) { var t = (a - 90) * Math.PI / 180; return [115 + r * Math.cos(t), 115 + r * Math.sin(t)]; }
    var instr = DEF.map(function (d, i) {
      var b = el('div', 'c2-instr leer'); var ticks = '';
      for (var j = 0; j <= 24; j++) { var a = A0 + (A1 - A0) * j / 24, p1 = polar(a, j % 4 ? 92 : 86), p2 = polar(a, 100); ticks += '<line class="tick' + (j % 4 ? '' : ' g') + '" x1="' + p1[0].toFixed(1) + '" y1="' + p1[1].toFixed(1) + '" x2="' + p2[0].toFixed(1) + '" y2="' + p2[1].toFixed(1) + '"/>'; }
      var s = polar(A0, 74), e = polar(A1, 74);
      var bogen = 'M' + s[0].toFixed(1) + ' ' + s[1].toFixed(1) + ' A74 74 0 1 1 ' + e[0].toFixed(1) + ' ' + e[1].toFixed(1);
      b.innerHTML = '<svg viewBox="0 0 230 230"><path class="bogen" d="' + bogen + '"/><path class="bogenwert" d="' + bogen + '" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>' + ticks
        + '<g class="c2-nadel" style="transform:rotate(' + A0 + 'deg)"><path d="M112 115 L115 30 L118 115 Z"/><circle cx="115" cy="115" r="9" fill="#2b2619" stroke="currentColor"/></g></svg>'
        + '<div class="wert"><span class="z">—</span><small></small></div><div class="lab">' + d.lab + '</div>';
      (i < 3 ? L : R).appendChild(b);
      return { d: d, b: b, nadel: b.querySelector('.c2-nadel'), bw: b.querySelector('.bogenwert'), wert: b.querySelector('.wert .z'), einh: b.querySelector('.wert small') };
    });
    function setze(I, v) {
      var d = I.d;
      if (v == null) { I.b.classList.add('leer'); I.nadel.style.transform = 'rotate(' + A0 + 'deg)'; I.bw.setAttribute('stroke-dashoffset', 100); I.wert.textContent = '—'; I.einh.textContent = ''; return; }
      I.b.classList.remove('leer');
      var p = Math.max(0, Math.min(1, (v - d.min) / (d.max - d.min)));
      I.nadel.style.transform = 'rotate(' + (A0 + (A1 - A0) * p).toFixed(1) + 'deg)';
      I.bw.setAttribute('stroke-dashoffset', (100 - p * 100).toFixed(1));
      var farbe = GOLD;
      if (d.k === 'score' || d.k === 'invest') farbe = stufe(v).css;
      else if (d.gruen != null) farbe = v >= d.gruen ? GRUEN : ROT;
      I.bw.style.stroke = farbe;
      var alt = parseFloat(I.wert.getAttribute('data-v')); if (!isFinite(alt)) alt = d.min < 0 ? 0 : d.min;
      I.wert.setAttribute('data-v', v);
      // so viele Nachkommastellen wie die Quelle nennt (5,9 bleibt 5,9)
      var dez = d.k === 'dscr' ? 2 : Math.min(d.dez, (String(v).split('.')[1] || '').length);
      I.einh.textContent = d.einh;
      zaehle(I.wert, alt, v, 1500, function (x) { return (d.k === 'cf' && x > 0.5 ? '+' : '') + fmt(x, dez); });
    }
    var schirm = el('div', 'c2-schirm', '<div class="innen"><div class="scan"></div><div class="oben"></div></div>'); buehne.appendChild(schirm);
    var innen = schirm.querySelector('.innen'), oben = schirm.querySelector('.oben');
    var text = el('div', 'c2-text weg', '<div class="kick"></div><h2></h2><p></p>'); buehne.appendChild(text);
    var pilot = el('div', 'c2-pilot'); buehne.appendChild(pilot);
    if (window.DealPilotFigur) { var fig = window.DealPilotFigur.bauen({}); pilot.appendChild(fig); window.DealPilotFigur.zustand(fig, 'winkt'); }
    var liste = el('div', 'c2-liste', '<div class="kopf">PRE-FLIGHT-CHECKLISTE</div><div class="c2-punkte"></div><div class="c2-bahn"><div class="voll" style="width:0"></div><span class="flieger" style="left:0">' + FLIEGER + '</span></div>');
    buehne.appendChild(liste);
    var punkte = liste.querySelector('.c2-punkte'), voll = liste.querySelector('.voll'), flieger = liste.querySelector('.flieger');
    var KURZ = ['QUICK-CHECK', 'SCORE', 'PILOT', 'MARKT', 'STEUER', 'ZIELBILD', 'BANK', 'BOT', 'COCKPIT'];
    F.forEach(function (f, i) { punkte.appendChild(el('span', '', '<i>✓</i>' + KURZ[i])); });
    fuss().style.bottom = '0px';
    var vids = F.map(function (f) { var v = video(f.clip); innen.insertBefore(v, innen.firstChild); return v; });
    var runde = 0;
    (async function lauf() {
      for (;;) {
        runde++;
        for (var i = 0; i < F.length; i++) {
          var f = F[i]; status(2, runde, i + 1);
          [].forEach.call(punkte.children, function (p, j) { p.className = j < i ? 'fertig' : (j === i ? 'jetzt' : ''); });
          var pr = (i + .5) / F.length * 100; voll.style.width = pr + '%'; flieger.style.left = pr + '%';
          vids.forEach(function (v, j) { if (j === i) { spiel(v); v.classList.add('an'); } else { v.classList.remove('an'); v.pause(); } });
          oben.textContent = 'KAPITEL ' + (i + 1) + ' / ' + F.length + ' · ' + f.kick.toUpperCase();
          text.querySelector('.kick').textContent = f.kick; text.querySelector('h2').textContent = f.titel; text.querySelector('p').innerHTML = f.text;
          text.classList.remove('weg');
          var w = INSTR[f.id];
          instr.forEach(function (I) { var v = w[I.d.k]; setze(I, Array.isArray(v) ? v[0] : v); });
          if (window.DealPilotFigur && pilot.firstChild) window.DealPilotFigur.zeigeAuf(pilot.firstChild, schirm.getBoundingClientRect());
          await warte(4200);
          instr.forEach(function (I) { var v = w[I.d.k]; if (Array.isArray(v)) setze(I, v[1]); });
          await warte(5200);
          text.classList.add('weg');
          await warte(600);
        }
        [].forEach.call(punkte.children, function (p) { p.className = 'fertig'; });
        voll.style.width = '100%'; flieger.style.left = '100%';
        await warte(1600);
        voll.style.transition = 'none'; flieger.style.transition = 'none'; voll.style.width = '0'; flieger.style.left = '0';
        await rahmen(); voll.style.transition = ''; flieger.style.transition = '';
      }
    })();
  }

  /* ══════════════ Idee 3 · Vorher / Nachher ══════════════ */
  function idee3() {
    var PAARE = [0, 1, 2, 4, 6, 5, 8];   // Funktionen in dieser Reihenfolge
    var runde = 0;
    fuss();
    (async function lauf() {
      for (;;) {
        runde++;
        for (var n = 0; n < PAARE.length; n++) {
          var f = F[PAARE[n]]; status(3, runde, n + 1);
          var s = el('div', 'ebene s3');
          var vh = el('div', 's3-vorher');
          [[180, 150, -8], [330, 110, 5], [1180, 170, 9], [1350, 380, -4]].forEach(function (p) { var d = el('div', 'papier'); d.style.left = p[0] + 'px'; d.style.top = p[1] + 'px'; d.style.setProperty('--r', p[2] + 'deg'); d.style.transform = 'rotate(' + p[2] + 'deg)'; vh.appendChild(d); });
          vh.appendChild(el('div', 'tabelle'));
          vh.appendChild(el('div', 'frage', '?'));
          vh.appendChild(el('div', 'text', '<div class="kick">Ohne DealPilot</div><h2>' + esc(f.vorher[0]) + '</h2><p>' + esc(f.vorher[1]) + '</p>'));
          s.appendChild(vh);
          s.appendChild(el('div', 's3-etikett l', 'VORHER'));
          s.appendChild(el('div', 's3-etikett r', 'MIT DEALPILOT'));
          var nh = el('div', 's3-nachher');
          nh.appendChild(el('span', 'kick', esc(f.kick)));
          var c = el('div', 'clip'); var v = video(f.clip); c.appendChild(v); nh.appendChild(c);
          nh.appendChild(el('h2', 'gold', esc(f.zahl)));
          nh.appendChild(el('p', '', esc(f.zahlLab) + ' — ' + f.text));
          s.appendChild(nh);
          s.appendChild(el('div', 's3-trenner', '<div class="griff">' + FLIEGER + '</div>'));
          buehne.appendChild(s);
          await warte(3600);
          spiel(v); s.classList.add('an');
          await warte(8400);
          s.classList.add('weg'); await warte(700); s.remove();
        }
      }
    })();
  }

  /* ══════════════ Idee 4 · Abflugtafel ══════════════ */
  function idee4() {
    funkenAus = funken();
    var ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789.,-/·€ ';
    var ZIEL = ['MARKTWERT 178.000 €', 'SCORE 78 · GUT', 'KAUFEN · 530.000 €', 'WERT 487.000 €', 'WENDEPUNKT 2027', 'ZIELBILD 770.000 €', '8 SEITEN · DSCR 1,67', '39 OBJEKTE', 'SCORE 69 · SOLIDE'];
    var NAME = ['QUICK-CHECK', 'DEAL SCORE', 'PILOT-ANALYSE', 'MARKTBERICHT', 'STEUERVERLAUF', 'ZIELBILD', 'BANK-PDF', 'TELEGRAM-BOT', 'COCKPIT'];
    var GATE = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3'];
    var tafel = el('div', 't4-tafel', '<div class="t4-kopf"><h1>' + FLIEGER + 'Abflug <small>DEPARTURES · DEALPILOT</small></h1><div class="t4-uhr"></div></div>'
      + '<div class="t4-spalten"><span>FLUG</span><span>ZIEL</span><span>ERGEBNIS</span><span>GATE</span><span>STATUS</span></div>');
    buehne.appendChild(tafel);
    var uhr = tafel.querySelector('.t4-uhr');
    function uhrStellen() { uhr.textContent = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
    uhrStellen(); setInterval(uhrStellen, 1000);
    function feld(n, cls) { var f = el('div', 't4-feld' + (cls ? ' ' + cls : '')); for (var i = 0; i < n; i++) f.appendChild(el('span', 'fl', ' ')); return f; }
    function klappe(f, txt) {
      var z = f.children; txt = (txt + ' '.repeat(z.length)).slice(0, z.length).toUpperCase();
      [].forEach.call(z, function (c, i) {
        var soll = txt[i]; if (c.textContent === soll) return;
        var schritte = 4 + Math.floor(Math.random() * 7), s = 0;
        var t = setInterval(function () {
          c.classList.remove('k'); void c.offsetWidth; c.classList.add('k');
          s++; c.textContent = s >= schritte ? soll : ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)];
          if (s >= schritte) clearInterval(t);
        }, 70 + i * 2);
      });
    }
    var zeilen = F.map(function (f, i) {
      var z = el('div', 't4-zeile');
      var c = [feld(6), feld(14), feld(20, 'gold'), feld(3), feld(10, 'status')];
      c.forEach(function (x) { z.appendChild(x); });
      tafel.appendChild(z);
      return { z: z, c: c };
    });
    var gate = el('div', 't4-gate', '<div class="clip"></div><div class="t4-pass"><div class="k">BORDKARTE · DEALPILOT</div><div class="zeilen"><div><small>FLUG</small><span class="fl1"></span></div><div><small>GATE</small><span class="gt"></span></div><div><small>SITZ</small>1A</div></div><h2></h2><div class="gross"></div><p></p><div class="strich"></div></div>');
    buehne.appendChild(gate);
    var gClip = gate.querySelector('.clip');
    fuss();
    function st(i, aktiv) { return i < aktiv ? 'GESTARTET' : (i === aktiv ? 'BOARDING' : 'PLANMÄSSIG'); }
    var runde = 0;
    (async function lauf() {
      for (;;) {
        runde++;
        zeilen.forEach(function (Z, i) { setTimeout(function () {
          klappe(Z.c[0], 'DP ' + (101 + i)); klappe(Z.c[1], NAME[i]); klappe(Z.c[2], ZIEL[i]); klappe(Z.c[3], GATE[i]); klappe(Z.c[4], st(i, 0));
        }, i * 260 * TEMPO); });
        await warte(3200);
        for (var i = 0; i < F.length; i++) {
          var f = F[i]; status(4, runde, i + 1);
          zeilen.forEach(function (Z, j) { Z.z.classList.toggle('aktiv', j === i); Z.c[4].classList.toggle('boarding', j === i); klappe(Z.c[4], st(j, i)); });
          await warte(3400);
          gClip.innerHTML = ''; var v = video(runde % 2 === 0 && f.clip2 ? f.clip2 : f.clip); gClip.appendChild(v); spiel(v);
          gate.querySelector('.fl1').textContent = 'DP ' + (101 + i); gate.querySelector('.gt').textContent = GATE[i];
          gate.querySelector('h2').textContent = f.kick; gate.querySelector('.gross').textContent = f.zahl; gate.querySelector('p').innerHTML = f.zahlLab + ' — ' + f.text.replace(/<\/?b>/g, '');
          tafel.classList.add('raus'); gate.classList.add('an');
          await warte(9000);
          tafel.classList.remove('raus'); gate.classList.remove('an');
          await warte(1200);
        }
        zeilen.forEach(function (Z) { Z.z.classList.remove('aktiv'); Z.c[4].classList.remove('boarding'); });
      }
    })();
  }

  /* ══════════════ Idee 5 · Video-Collage mit Kapitelband ══════════════ */
  function idee5() {
    var raster = el('div', 'v5-raster'); buehne.appendChild(raster);
    var kacheln = F.map(function (f) {
      var k = el('div', 'v5-kachel'); var v = video(f.clip); k.appendChild(v);
      k.appendChild(el('div', 'lab', '<b>' + f.nr + '</b><span>' + esc(f.kick) + '</span>'));
      raster.appendChild(k); spiel(v); return k;
    });
    var band = el('div', 'v5-band', '<div class="nr"></div><div class="txt"><div class="kick"></div><h2></h2><p></p></div><div class="rechts"><div class="marke">Deal<b>Pilot</b></div><div class="v5-punkte"></div></div><div class="v5-fort"></div>');
    buehne.appendChild(band);
    var pk = band.querySelector('.v5-punkte'); F.forEach(function () { pk.appendChild(el('i')); });
    var fort = band.querySelector('.v5-fort');
    fuss();
    // Lage der Kacheln in Bühnenkoordinaten (Raster: 30 px Rand, 18 px Lücke)
    var KW = (1920 - 60 - 36) / 3, KH = (1080 - 60 - 36) / 3;
    function lage(i) { return { l: 30 + (i % 3) * (KW + 18), t: 30 + Math.floor(i / 3) * (KH + 18), w: KW, h: KH }; }
    function setz(e, r) { e.style.left = r.l + 'px'; e.style.top = r.t + 'px'; e.style.width = r.w + 'px'; e.style.height = r.h + 'px'; }
    var ZIEL = { l: 200, t: 34, w: 1520, h: 760 };
    var runde = 0;
    (async function lauf() {
      for (;;) {
        runde++;
        await warte(2400);
        for (var i = 0; i < F.length; i++) {
          var f = F[i]; status(5, runde, i + 1);
          var held = el('div', 'v5-held'); var v = video(f.clip2 || f.clip); held.appendChild(v);
          setz(held, lage(i)); buehne.appendChild(held); spiel(v);
          await rahmen();
          raster.classList.add('dunkel'); setz(held, ZIEL);
          band.querySelector('.nr').textContent = f.nr; band.querySelector('.kick').textContent = f.kick;
          band.querySelector('h2').textContent = f.titel + ' — ' + f.zahl; band.querySelector('p').innerHTML = f.text;
          [].forEach.call(pk.children, function (p, j) { p.classList.toggle('an', j <= i); });
          await warte(700);
          band.classList.add('an');
          fort.classList.remove('lauf'); fort.style.width = '0'; await rahmen();
          fort.classList.add('lauf'); fort.style.transitionDuration = (8.6 * TEMPO) + 's'; fort.style.width = '100%';
          await warte(8600);
          band.classList.remove('an'); setz(held, lage(i)); raster.classList.remove('dunkel');
          await warte(1000); held.remove();
          spiel(kacheln[i].querySelector('video'));
          await warte(500);
        }
      }
    })();
  }

  /* ══════════════ Idee 6 · 3D-Kartenkarussell ══════════════ */
  function idee6() {
    funkenAus = funken();
    buehne.appendChild(el('div', 'r6-boden'));
    var szene = el('div', 'r6-szene'); var ringEl = el('div', 'r6-ring'); szene.appendChild(ringEl); buehne.appendChild(szene);
    var N = F.length, WINKEL = 360 / N, RADIUS = 1180;
    var karten = F.map(function (f, i) {
      var k = el('div', 'r6-karte hinten');
      var c = el('div', 'clip'); var v = video(f.clip); v.loop = true; c.appendChild(v); k.appendChild(c);
      v.addEventListener('loadeddata', function () { if (v.paused) try { v.currentTime = 2; } catch (e) {} }, { once: true });
      var pill = '';
      if (f.score != null) { var st = stufe(f.score); pill = ' <span class="pille" style="--farbe:' + st.css + ';font-size:22px;vertical-align:middle">' + st.versal + '</span>'; }
      k.appendChild(el('div', 'inhalt', '<div class="kick">' + esc(f.kick) + '</div><h3>' + esc(f.titel) + '</h3><div class="zahl gold">' + esc(f.zahl) + '</div><div class="neben">' + esc(f.zahlLab) + pill + '</div>'));
      k.appendChild(el('div', 'glanz'));
      k.style.transform = 'rotateY(' + (i * WINKEL) + 'deg) translateZ(' + RADIUS + 'px)';
      ringEl.appendChild(k);
      return { k: k, v: v };
    });
    var text = el('div', 'r6-text weg', '<div class="kick"></div><h2></h2><p></p>'); buehne.appendChild(text);
    fuss();
    var schritt = 0, runde = 0;
    function dreh() { ringEl.style.transform = 'translateZ(-' + (RADIUS + 300) + 'px) rotateY(' + (-schritt * WINKEL) + 'deg)'; }
    dreh();
    (async function lauf() {
      for (;;) {
        var i = ((schritt % N) + N) % N;
        if (i === 0) runde++;
        var f = F[i]; status(6, runde, i + 1);
        karten.forEach(function (K, j) { var vorn = j === i; K.k.classList.toggle('vorn', vorn); K.k.classList.toggle('hinten', !vorn); if (vorn) spiel(K.v); else K.v.pause(); });
        text.querySelector('.kick').textContent = f.kick; text.querySelector('h2').textContent = f.titel; text.querySelector('p').innerHTML = f.text;
        await warte(900); text.classList.remove('weg');
        await warte(6600);
        text.classList.add('weg');
        schritt++; dreh();
        await warte(1300);
      }
    })();
  }

  /* ══════════════ Auswahlseite ══════════════ */
  var IDEEN = [
    { n: 1, name: 'Kinetik', text: 'Große Zahlen und Worte fliegen ins Bild — Marktwert, Score, KAUFEN, Wendepunkt — wie ein Trailer.', f: idee1 },
    { n: 2, name: 'Flight Deck', text: 'Ein Cockpit: sechs Instrumente schlagen für jedes Kapitel aus, in der Mitte läuft die App, unten die Pre-Flight-Checkliste.', f: idee2 },
    { n: 3, name: 'Vorher / Nachher', text: 'Links grau die Handarbeit, dann wischt die Goldlinie DealPilot ins Bild — Clip und Ergebnis.', f: idee3 },
    { n: 4, name: 'Abflugtafel', text: 'Split-Flap-Tafel mit neun Flügen; jeder Flug geht an sein Gate: Clip und Bordkarte mit der Zahl.', f: idee4 },
    { n: 5, name: 'Video-Collage', text: 'Neun Clips laufen im Raster, einer nach dem anderen zoomt groß, mit Kapitelband wie in der Videoreihe.', f: idee5 },
    { n: 6, name: '3D-Karussell', text: 'Neun Karten im Raum drehen sich nach vorn — vorne läuft der Clip, darunter Titel und Zahl.', f: idee6 }
  ];
  /* Auswahl: sechs Vorschaukarten (Standbild, beim Überfahren läuft die Idee
     klein im Rahmen) und „Alle im Wechsel“. Ein Klick holt den Vollbildmodus
     (braucht die Geste) und spielt die Idee in einem Rahmen über der Seite —
     so bleibt der Vollbildmodus auch beim Wechseln zwischen den Ideen stehen. */
  function wahl() {
    funkenAus = funken();
    var w = el('div', 'wahl ebene');
    w.innerHTML = '<div class="wahl-kopf"><div><div class="kick">Messe-Schleife · Auswahl</div><h1>Deal<span class="gold">Pilot</span> am Stand</h1></div>'
      + '<a class="wahl-alle" data-idee="alle"><b>A</b>Alle im Wechsel<small>jede Idee eine Runde, endlos</small></a></div>'
      + '<p class="unter">Dauerschleifen für den großen Bildschirm — stumm, ohne Bedienung. Klick startet im Vollbild; Tasten <b>R</b>, <b>1–6</b>, <b>A</b>, <b>Esc</b> zurück.</p>'
      + '<a class="wahl-rundgang" data-idee="rundgang" href="?idee=rundgang"><img alt="" src="messe-schleife/vorschau/rundgang.jpg?v=' + VER + '"><b class="taste">R</b><div><h2>Rundgang durch die App</h2>'
      + '<p>' + (window.DealPilotRundgang ? window.DealPilotRundgang.abschnitte.length : 12) + ' Stationen aus der Videothek — Quick-Check, ImmoMetrica, Mehrfamilienhaus, Marktbericht, Pilot-Analyse, Finanzierung, Steuer, Portfolio. Startansicht.</p></div></a>'
      + '<div class="wahl-weitere">Weitere Schleifen</div>';
    var r = el('div', 'wahl-raster');
    IDEEN.forEach(function (d) {
      var a = el('a', 'wahl-karte', '<div class="bild"><img alt="" src="messe-schleife/vorschau/idee-' + d.n + '.jpg?v=' + VER + '"><span class="nr">' + d.n + '</span></div><h2>' + d.name + '</h2><p>' + d.text + '</p>');
      a.setAttribute('data-idee', d.n); a.href = '?idee=' + d.n;
      var live = null, t = null;
      a.addEventListener('mouseenter', function () { t = setTimeout(function () { live = el('iframe', 'live'); live.src = '?idee=' + d.n + '&vorschau=1'; live.setAttribute('tabindex', '-1'); a.querySelector('.bild').appendChild(live); }, 350); });
      a.addEventListener('mouseleave', function () { clearTimeout(t); if (live) { live.remove(); live = null; } });
      r.appendChild(a);
    });
    w.appendChild(r);
    w.appendChild(el('div', 'wahl-hinweis', '<b>Am Stand ohne Netz:</b> Ordner „Messe-Schleife“ auf den Rechner kopieren, <b>messe-schleife.html</b> doppelklicken, Idee anklicken (oder F11).'));
    buehne.appendChild(w);
    w.querySelector('.wahl-alle').href = '?idee=alle';
    document.body.classList.remove('laeuft');

    var spieler = null;
    function spiele(id) {
      var q = '?idee=' + id;
      var el0 = document.documentElement;
      if (el0.requestFullscreen && !document.fullscreenElement) { try { var p = el0.requestFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ohne Vollbild weiter */ } }
      if (!spieler) { spieler = el('iframe', 'spieler'); spieler.setAttribute('allow', 'fullscreen; autoplay'); document.body.appendChild(spieler); }
      spieler.src = q; spieler.focus();
      document.body.classList.add('spielt');
    }
    function schliesse() {
      if (!spieler) return;
      spieler.remove(); spieler = null; document.body.classList.remove('spielt');
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
    }
    w.addEventListener('click', function (e) {
      var a = e.target.closest('[data-idee]'); if (!a) return;
      e.preventDefault(); spiele(a.getAttribute('data-idee'));
    });
    addEventListener('message', function (e) { if (e.data && e.data.dps === 'auswahl') schliesse(); });
    document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement) schliesse(); });
    addEventListener('keydown', function (e) {
      if (spieler) { if (e.key === 'Escape') schliesse(); return; }
      if (/^[1-6]$/.test(e.key)) spiele(e.key);
      else if (e.key === 'a' || e.key === 'A') spiele('alle');
      else if (e.key === 'r' || e.key === 'R') spiele('rundgang');
    });
  }

  /* Umschalter in jeder Idee: erscheint erst bei Mausbewegung, geht nach 3 s. */
  function umschalter(aktiv) {
    var l = el('nav', 'umschalter');
    var html = '<a data-q="?idee=rundgang"' + (aktiv === 'R' ? ' class="an"' : '') + '><b>R</b>Rundgang</a>';
    IDEEN.forEach(function (d) { html += '<a data-q="?idee=' + d.n + '"' + (aktiv === d.n ? ' class="an"' : '') + '><b>' + d.n + '</b>' + d.name + '</a>'; });
    html += '<a data-q="?idee=alle"' + (ALLE ? ' class="an"' : '') + '><b>A</b>Alle im Wechsel</a><a data-q="auswahl"><b>Esc</b>Zur Auswahl</a>';
    l.innerHTML = html; document.body.appendChild(l);
    var t = null;
    function zeig() { document.body.classList.add('maus'); clearTimeout(t); t = setTimeout(function () { document.body.classList.remove('maus'); }, 3000); }
    addEventListener('mousemove', zeig);
    l.addEventListener('click', function (e) {
      var a = e.target.closest('a'); if (!a) return; e.preventDefault();
      var q = a.getAttribute('data-q'); if (q === 'auswahl') zurAuswahl(); else geh(q);
    });
    addEventListener('keydown', function (e) {
      if (/^[1-6]$/.test(e.key)) geh('?idee=' + e.key);
      else if (e.key === 'r' || e.key === 'R') geh('?idee=rundgang');
      else if (e.key === 'a' || e.key === 'A') geh('?idee=alle');
      else if (e.key === 'Escape') zurAuswahl();
    });
  }

  /* ── Start ── */
  function skaliere() { var s = Math.min(innerWidth / 1920, innerHeight / 1080); buehne.style.transform = 'translate(-50%,-50%) scale(' + s + ')'; }
  function start() {
    buehne = document.getElementById('buehne');
    skaliere(); addEventListener('resize', skaliere);
    /* messe-schleife-4: ohne Parameter startet der Rundgang (Marcel 21.10.2026), die Auswahl unter ?idee=auswahl */
    var idee = Q.get('idee');
    if ((!idee || idee === 'rundgang') && window.DealPilotRundgang) {
      document.title = 'DealPilot · Rundgang';
      document.body.classList.add('laeuft');
      if (!Q.has('vorschau')) umschalter('R');
      window.DealPilotRundgang.start(buehne);
      return;
    }
    var n = ALLE ? (parseInt(Q.get('n'), 10) || 1) : parseInt(idee, 10);
    var d = IDEEN.filter(function (x) { return x.n === n; })[0];
    if (!d) { wahl(); return; }
    document.title = 'DealPilot · Messe-Schleife ' + (ALLE ? 'alle · ' : '') + d.n + ' · ' + d.name;
    document.body.classList.add('laeuft');
    if (!Q.has('vorschau')) umschalter(ALLE ? 0 : d.n);
    d.f();
  }
  window.DealPilotMesseSchleife = { ideen: IDEEN, funktionen: F, instrumente: INSTR, version: VER };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
