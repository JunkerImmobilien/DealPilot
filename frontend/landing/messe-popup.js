/* ═══════════════════════════════════════════════════════════════════════
   messe-popup.js · v1944 · EINBAUFERTIG, NOCH NICHT EINGEBAUT
   ───────────────────────────────────────────────────────────────────────
   Der Boarding-Pass zum Abreissen: DealPilot auf dem immocation Festival
   2026, Leipziger Messe, Halle 3 · Stand 106, 31.10.–01.11.2026.

   ╔═══════════════════════════════════════════════════════════════════╗
   ║  SO KOMMT ES AUF DIE LANDING PAGE — zwei Handgriffe:              ║
   ║                                                                   ║
   ║  1 · Diese Datei nach  frontend/landing/messe-popup.js  kopieren  ║
   ║  2 · In frontend/landing/index.html, direkt NACH der Zeile        ║
   ║        <script src="erstflug-popup.js?v=v1595d"></script>         ║
   ║      einfuegen:                                                   ║
   ║        <script src="messe-popup.js?v=v1944"></script>             ║
   ║                                                                   ║
   ║  Mehr ist nicht noetig: das Modul bringt Stil und Markup selbst   ║
   ║  mit. Es braucht nur assets/bsfz-siegel-2026.svg - das liegt      ║
   ║  dort schon (die Landing nutzt es im Vertrauensband).             ║
   ║                                                                   ║
   ║  Ich (der Unterlauf) durfte frontend/ nicht anfassen - der        ║
   ║  Schreibzugriff auf den Produktionsordner ist gesperrt. Deshalb   ║
   ║  liegt die Datei hier und nicht dort.                             ║
   ╚═══════════════════════════════════════════════════════════════════╝

   Marcel am 07.10.2026:
     "auf der Landing Page vielleicht noch irgendwie so ein Pop-up, dass
      wir auf der Ocation Festival Messe in Leipzig sind … dass die Leute,
      die an den Stand kommen, Rabatt bekommen. Also wir sollten nicht den
      Code nennen, weil ich möchte gerne, dass die kommen."
     "das abriss 01 ist mega gut … dort jetzt bitte nichts mit ERSTFLUG
      drauf weil das ja unser Rabattcode ist."
     "wenn man auf in den Kalender klickt wird es automatisch mit den
      Informationen in den Kalender eingetragen."

   ── DER CODE STEHT NIRGENDS ─────────────────────────────────────────────
   Weder im sichtbaren Text noch als Zierwort auf dem Abriss. Der Code
   heisst wie die gedruckte Karte, deshalb heisst sie hier "Bordkarte".
   Wer das aendert, nimmt dem Pop-up seinen Zweck: die Leute sollen an den
   STAND kommen, nicht den Code mitnehmen.

   ── WARUM DER ABRISS AUS ZWEI TEILEN BESTEHT ────────────────────────────
   .mp-stamm und .mp-abriss sind getrennte Elemente mit KOMPLEMENTAEREN
   clip-path-Zacken; die Tiefen ergaenzen sich auf 9 px:
       Stamm  x = calc(100% - D px)      Abriss x = (9 - D) px
   bei margin-left:-9px und D = 0,7,1,5,0,8,2,4,0,7,1,6,0,8,2,5,0,7,1,4,0.
   Nur so koennen sich beide Teile VERSCHIEDEN bewegen - eine einzige
   Bewegung auf einem Element liest sich als Schieben, nicht als Reissen.
   Die Lochung sitzt in derselben 9-px-Zone: right:196px ist GERECHNET
   (206 px breiter Abriss, 10 px Lochbreite), nicht geschaetzt. Mit 201
   lag sie 5 px daneben - gemessen am 07.10.2026 im Browser.

   ── SELBSTABSCHALTUNG ───────────────────────────────────────────────────
   Nach dem 01.11.2026 zeigt sich das Fenster nicht mehr. Eine
   Messeeinladung, die im Dezember noch aufgeht, ist schlimmer als keine -
   und niemand erinnert sich im Dezember daran, sie abzuschalten.

   ── ES WEICHT DEM FLYER-FENSTER ─────────────────────────────────────────
   Wer ueber /erstflug hereinkommt, bekommt erstflug-popup.js. Zwei
   Fenster uebereinander waeren beides kaputt.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var ID = 'dp-messe-popup';
  var GESEHEN = 'dp_messe_popup_gesehen';

  /* ── Die belegten Angaben ────────────────────────────────────────────
     Quellen: Dateien/Messe/dealpilot-erstflug-karte-DRUCK-DINlang-212x100mm.pdf
     (Druckdatei vom 22.09.2026) und das Veranstalter-Material
     "Instagram Post - personalisierbar.png". Beide nennen unabhaengig
     voneinander Halle 3 · Stand 106 und 31.10. & 01.11.2026.
     ACHTUNG: claude/projektanweisung-hauptapp.md:1583 sagt noch
     "Stand 23" - das ist der aeltere Stand und gehoert nachgezogen. */
  var MESSE = {
    name:   'immocation FESTIVAL 2026',
    ort:    'Leipziger Messe',
    stadt:  'Leipzig',
    halle:  'Halle 3',
    stand:  'Stand 106',
    vonISO: '20261031',
    bisISO: '20261102',          /* ICS-Ende ist exklusiv: zwei Messetage */
    spanne: '31.10.–01.11.2026',
    kurz:   '31.10.–01.11.26',
    endeMs: Date.UTC(2026, 10, 1, 23, 0, 0)   /* 01.11.2026, 24:00 MEZ */
  };

  /* Der Prozentsatz steht gedruckt auf der Karte, die am Stand verteilt
     wird. Auf der OFFENEN Seite war das bisher bewusst nicht beworben
     (promo-erstflug.js: ANZEIGE_AKTIV = false, Entscheidung vom
     07.09.2026). Hier ist es ein Messeangebot MIT ENDDATUM, kein
     Dauerbanner - deshalb an. Wer das anders will, setzt diese eine
     Zeile auf false; dann steht auf dem Abriss "Dein Vorteil" statt
     einer Zahl, und sonst aendert sich nichts. */
  /* v1947a · AUS. Marcel am 07.10.2026 auf die Frage, ob die Zahl offen
     stehen darf: "Zahl raus". Damit bleibt seine Entscheidung vom
     22.09.2026 unberuehrt - "direkt ausgewiesen, wenn man auf die Seite
     klickt, soll er nicht sein". Ein Messeangebot mit Enddatum aendert
     daran nichts: wer die Seite offen aufruft, sieht keine Rabattzahl.
     Auf dem Abriss steht "Dein Vorteil", der Code weiterhin nur am Stand. */
  var ZEIGE_PROZENT = false;
  var PROZENT = 15;

  function zeitVorbei() { return Date.now() > MESSE.endeMs; }

  function ueberFlyer() {
    if (/\/erstflug\/?$/i.test(location.pathname)) return true;
    try { if (sessionStorage.getItem('dp_flyer_frisch') === '1') return true; } catch (e) {}
    return false;
  }

  function schonGesehen() {
    try { return sessionStorage.getItem(GESEHEN) === '1'; } catch (e) { return false; }
  }
  function merken() {
    try { sessionStorage.setItem(GESEHEN, '1'); } catch (e) {}
  }

  /* ── Der Kalendereintrag ─────────────────────────────────────────────
     Eine .ics-Datei, die jedes Kalenderprogramm versteht. Zeilen werden
     mit CRLF getrennt (RFC 5545), Kommas und Semikolons im Text sind
     maskiert - sonst zerlegt der Kalender die Zeile an der falschen
     Stelle und der Termin landet ohne Ort im Kalender. */
  function icsText() {
    function esc(s) { return String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n'); }
    var jetzt = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    var ort = MESSE.ort + ', ' + MESSE.halle + ', ' + MESSE.stand + ', ' + MESSE.stadt;
    var text = 'DealPilot ist auf dem ' + MESSE.name + '.\n'
             + 'Du findest uns in ' + MESSE.halle + ' an ' + MESSE.stand + '.\n'
             + 'Am Stand liegt deine Bordkarte mit Abriss - persoenlich abzuholen.\n'
             + 'https://dealpilot.immo';
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//DealPilot//Messe//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:messe-immocation-2026@dealpilot.immo',
      'DTSTAMP:' + jetzt,
      'DTSTART;VALUE=DATE:' + MESSE.vonISO,
      'DTEND;VALUE=DATE:' + MESSE.bisISO,
      'SUMMARY:' + esc('DealPilot auf dem ' + MESSE.name),
      'LOCATION:' + esc(ort),
      'DESCRIPTION:' + esc(text),
      'URL:https://dealpilot.immo',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      'DESCRIPTION:' + esc('Morgen: DealPilot am ' + MESSE.stand + ', ' + MESSE.halle),
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  function inDenKalender() {
    var txt = icsText();
    var name = 'dealpilot-immocation-festival-2026.ics';
    try {
      var blob = new Blob([txt], { type: 'text/calendar;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name; a.rel = 'noopener';
      document.body.appendChild(a); a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 400);
    } catch (e) {
      /* Fallback fuer Browser ohne Blob-Download (aeltere iOS-Fassungen):
         die Datei direkt als data-URI oeffnen. */
      location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(txt);
    }
  }

  /* ── Stil ────────────────────────────────────────────────────────────
     Eigene Werte statt der dp2.css-Variablen: das Fenster soll auch
     stehen, wenn dp2.css sich aendert. Farben sind die der Marke. */
  function stil() {
    if (document.getElementById(ID + '-stil')) return;
    var s = document.createElement('style');
    s.id = ID + '-stil';
    s.textContent = [
      '#' + ID + '{position:fixed;inset:0;z-index:99998;display:flex;align-items:center;',
      '  justify-content:center;padding:22px;background:rgba(5,5,5,.74);',
      '  -webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);opacity:0;',
      '  transition:opacity .3s cubic-bezier(.2,.7,.3,1);overflow-y:auto}',
      '#' + ID + '.an{opacity:1}',
      '#' + ID + ' .mp-karte{width:100%;max-width:720px;position:relative;margin:auto;',
      '  transform:translateY(20px) scale(.97);transition:transform .42s cubic-bezier(.2,.72,.2,1);',
      '  box-shadow:0 30px 80px rgba(0,0,0,.5)}',
      '#' + ID + '.an .mp-karte{transform:none}',
      '#' + ID + ' .mp-zu{position:absolute;top:-15px;right:-7px;z-index:8;width:34px;height:34px;',
      '  background:#050505;color:#E8CC7A;font:400 18px/1 Inter,system-ui,sans-serif;cursor:pointer;',
      '  border:1px solid rgba(201,168,76,.4)}',
      '#' + ID + ' .mp-zu:hover{background:#0c0b09}',
      '#' + ID + ' .mp-kopf{background:#050505;color:#E8CC7A;padding:12px 20px;display:flex;',
      '  justify-content:space-between;gap:12px;flex-wrap:wrap;',
      '  font:700 10px/1.4 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.18em}',
      '#' + ID + ' .mp-kopf .re{color:rgba(232,204,122,.62)}',
      /* Pass */
      '#' + ID + ' .mp-leib{display:flex;background:#EDE7DA;position:relative;overflow:hidden;touch-action:pan-y}',
      '#' + ID + ' .mp-darunter{position:absolute;top:0;right:0;bottom:0;width:206px;z-index:1;',
      '  background:#EDE7DA;display:flex;flex-direction:column;align-items:center;',
      '  justify-content:center;text-align:center;padding:22px 16px;gap:5px}',
      '#' + ID + ' .mp-darunter .k{font:700 8.5px/1.5 "JetBrains Mono",ui-monospace,monospace;',
      '  letter-spacing:.16em;color:#6f685b}',
      '#' + ID + ' .mp-darunter .gross{font:700 25px/1.06 "Space Grotesk",system-ui,sans-serif;',
      '  color:#16130d;letter-spacing:-.8px}',
      '#' + ID + ' .mp-darunter .gross b{color:#b8932f}',
      /* Rot ist eine Statusfarbe - sie bleibt in jeder Marke rot. */
      '#' + ID + ' .mp-stempel{margin-top:10px;border:2px solid #B86250;color:#B86250;',
      '  font:700 9.5px/1.35 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.13em;padding:8px 10px;',
      '  transform:rotate(-7deg) scale(2.8);opacity:0;',
      '  transition:transform .3s cubic-bezier(.2,.72,.2,1),opacity .18s}',
      '#' + ID + ' .mp-leib.ab .mp-stempel{transform:rotate(-7deg) scale(1);opacity:.92;transition-delay:.34s}',
      /* Der Stamm - Zacken rechts */
      '#' + ID + ' .mp-stamm{flex:1;min-width:0;padding:30px 30px 26px;position:relative;z-index:2;background:#fff;',
      '  clip-path:polygon(0 0,100% 0,',
      '    calc(100% - 7px) 5%,calc(100% - 1px) 10%,calc(100% - 5px) 15%,100% 20%,',
      '    calc(100% - 8px) 25%,calc(100% - 2px) 30%,calc(100% - 4px) 35%,100% 40%,',
      '    calc(100% - 7px) 45%,calc(100% - 1px) 50%,calc(100% - 6px) 55%,100% 60%,',
      '    calc(100% - 8px) 65%,calc(100% - 2px) 70%,calc(100% - 5px) 75%,100% 80%,',
      '    calc(100% - 7px) 85%,calc(100% - 1px) 90%,calc(100% - 4px) 95%,100% 100%,0 100%)}',
      '#' + ID + ' .mp-leib.ruck .mp-stamm{animation:mpRuck .11s linear}',
      '@keyframes mpRuck{0%{transform:translateX(0)}40%{transform:translateX(-4px)}',
      '  70%{transform:translateX(2px)}100%{transform:translateX(0)}}',
      '#' + ID + ' .mp-kurve{position:absolute;inset:0;z-index:-1;opacity:.45;pointer-events:none}',
      '#' + ID + ' .mp-stamm .mini{font:700 9.5px/1 "JetBrains Mono",ui-monospace,monospace;',
      '  letter-spacing:.2em;color:#8a6c1e;margin-bottom:14px}',
      '#' + ID + ' .mp-stamm h2{font:700 clamp(23px,3.3vw,31px)/1.1 "Space Grotesk",system-ui,sans-serif;',
      '  letter-spacing:-.025em;margin:0 0 10px;color:#16130d}',
      '#' + ID + ' .mp-stamm h2 em{font-style:normal;color:#b8932f}',
      '#' + ID + ' .mp-stamm .sub{margin:0;font:14.5px/1.6 Inter,system-ui,sans-serif;color:#4a4536;max-width:38ch}',
      '#' + ID + ' .mp-felder{display:flex;gap:26px;flex-wrap:wrap;margin-top:24px}',
      '#' + ID + ' .mp-felder .k{font:700 9px/1 "JetBrains Mono",ui-monospace,monospace;',
      '  letter-spacing:.17em;color:#6f685b;margin-bottom:6px}',
      '#' + ID + ' .mp-felder .v{font:700 17px/1.15 "Space Grotesk",system-ui,sans-serif;color:#16130d}',
      '#' + ID + ' .mp-felder .v.gold{color:#b8932f}',
      /* Lochung - right:196px ist gerechnet, siehe Kopfkommentar */
      '#' + ID + ' .mp-lochung{position:absolute;top:0;bottom:0;right:196px;width:10px;z-index:3;',
      '  pointer-events:none;transition:opacity .09s linear;',
      '  background:radial-gradient(circle at 5px 9px,rgba(0,0,0,.30) 2.3px,transparent 2.6px) 0 0/10px 18px repeat-y}',
      '#' + ID + ' .mp-leib.ruck .mp-lochung,#' + ID + ' .mp-leib.ab .mp-lochung{opacity:0}',
      /* Der Abriss - Gegenzacken */
      '#' + ID + ' .mp-abriss{width:206px;flex:none;margin-left:-9px;position:relative;z-index:4;',
      '  background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#221a06;',
      '  padding:26px 16px 24px 22px;text-align:center;cursor:grab;',
      '  -webkit-user-select:none;user-select:none;touch-action:none;transform-origin:18% 12%;',
      '  transition:transform .22s cubic-bezier(.2,.7,.3,1);',
      '  clip-path:polygon(9px 0,100% 0,100% 100%,9px 100%,',
      '    5px 95%,8px 90%,2px 85%,9px 80%,4px 75%,7px 70%,1px 65%,9px 60%,',
      '    3px 55%,8px 50%,2px 45%,9px 40%,5px 35%,7px 30%,1px 25%,9px 20%,',
      '    4px 15%,8px 10%,2px 5%)}',
      '#' + ID + ' .mp-abriss:active{cursor:grabbing}',
      '#' + ID + ' .mp-abriss.zieht{transition:none}',
      '#' + ID + ' .mp-leib.ab .mp-abriss{transform:translate(72px,330px) rotate(27deg);opacity:0;',
      '  transition:transform .4s cubic-bezier(.5,.02,.9,.4),opacity .24s linear .17s;pointer-events:none}',
      '#' + ID + ' .mp-abriss .k{font:700 8.5px/1 "JetBrains Mono",ui-monospace,monospace;',
      '  letter-spacing:.15em;color:#5a4a14;margin-bottom:10px}',
      '#' + ID + ' .mp-abriss .pz{font:700 42px/1 "Space Grotesk",system-ui,sans-serif;',
      '  letter-spacing:-2px;color:#1a1407}',
      '#' + ID + ' .mp-abriss .pz small{font-size:25px}',
      '#' + ID + ' .mp-abriss .s{font:600 12.8px/1.45 Inter,system-ui,sans-serif;color:#2c2208;margin-top:3px}',
      '#' + ID + ' .mp-abriss .siegel{margin-top:13px;background:#050505;color:#E8CC7A;',
      '  font:700 10.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.18em;padding:11px 8px}',
      '#' + ID + ' .mp-abriss .zieh{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);',
      '  font:700 8px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.1em;color:#E8CC7A;',
      '  background:rgba(10,9,7,.82);padding:5px 9px;white-space:nowrap;',
      '  animation:mpWink 2.4s ease-in-out infinite;transition:opacity .12s}',
      '@keyframes mpWink{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-46%,0)}}',
      '#' + ID + ' .mp-abriss .zieh .q{display:none}',
      '#' + ID + ' .mp-leib.ruck .mp-abriss .zieh,#' + ID + ' .mp-leib.ab .mp-abriss .zieh{opacity:0}',
      /* Vertrauensband - woertlich wie .tband in index.html, nur leiser */
      '#' + ID + ' .mp-tband{background:#0a0a0a;border-top:1px solid rgba(201,168,76,.24);',
      /* v1947b · DIE FUE-SPALTE BRAUCHT MEHR PLATZ ALS DIE ANDEREN
         Marcel am 07.10.2026: "schau dass das fue auch komplett auf der karte ist."
         GEMESSEN im Browser: der Eintrag lief 7 px ueber die Karte hinaus
         (x 1224..1320 bei Kartenende 1313) und der Text war um 7 px
         abgeschnitten (scrollWidth 151 > clientWidth 144).
         Ursache: repeat(5,1fr) gibt allen Spalten dieselbe Breite - aber
         der FuE-Eintrag traegt ein 34-px-SIEGEL, die vier anderen nur ein
         16-px-Symbol. Gleiche Breite bei doppelt so breitem Bild heisst
         halb so viel Platz fuer den Text.
         Ein Band aus gleichen Spalten passt nur zu gleichen Inhalten. */
      '  display:grid;grid-template-columns:repeat(4,1fr) 1.38fr}',
      '#' + ID + ' .mp-tband > div:last-child{padding-right:14px}',
      '#' + ID + ' .mp-tband b,#' + ID + ' .mp-tband span{overflow-wrap:anywhere}',
      '#' + ID + ' .mp-tband > div{display:flex;gap:9px;align-items:center;padding:13px 12px;',
      '  border-right:1px solid rgba(255,255,255,.06);min-width:0}',
      '#' + ID + ' .mp-tband > div:last-child{border-right:0}',
      '#' + ID + ' .mp-tband svg{width:16px;height:16px;color:#E8CC7A;flex:none;stroke:currentColor;',
      '  fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}',
      '#' + ID + ' .mp-tband b{display:block;font:600 11px/1.25 Inter,system-ui,sans-serif;color:#fff}',
      '#' + ID + ' .mp-tband span{display:block;font-size:9.6px;line-height:1.35;',
      '  color:rgba(255,255,255,.42);margin-top:2px}',
      '#' + ID + ' .mp-tband img{width:34px;height:34px;flex:none;border-radius:50%;background:#fff;',
      '  padding:2px;box-shadow:0 0 0 1px rgba(201,168,76,.24)}',
      /* Fuss */
      '#' + ID + ' .mp-fuss{background:#050505;color:#ece6d6;padding:18px 22px;display:flex;',
      '  align-items:center;gap:16px;flex-wrap:wrap;justify-content:space-between}',
      '#' + ID + ' .mp-fuss .wo{font:500 13px/1.5 Inter,system-ui,sans-serif;',
      '  color:rgba(255,255,255,.66);max-width:46ch}',
      '#' + ID + ' .mp-fuss .wo b{color:#E8CC7A;font-weight:700}',
      '#' + ID + ' .mp-btn{background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#14100a;',
      '  padding:13px 24px;font:600 14.5px Inter,system-ui,sans-serif;border:0;cursor:pointer;transition:.22s}',
      '#' + ID + ' .mp-btn:hover{transform:translateY(-2px)}',
      '#' + ID + ' .mp-btn-l{border:1px solid rgba(236,230,214,.3);color:#ece6d6;padding:12px 20px;',
      '  font:500 14px Inter,system-ui,sans-serif;background:none;cursor:pointer;transition:.22s}',
      '#' + ID + ' .mp-btn-l:hover{border-color:#C9A84C;background:rgba(201,168,76,.1)}',
      /* Handy: der Abriss liegt UEBER dem, was darunter steht - sonst
         waere die Pointe schon vor dem Riss zu lesen (gemessen 07.10.). */
      '@media(max-width:760px){',
      '  #' + ID + '{padding:12px;align-items:flex-start}',
      '  #' + ID + ' .mp-leib{flex-direction:column}',
      '  #' + ID + ' .mp-stamm{padding:22px 18px 20px;clip-path:polygon(0 0,100% 0,100% 100%,',
      '    95% calc(100% - 4px),90% calc(100% - 1px),85% calc(100% - 7px),80% 100%,',
      '    75% calc(100% - 5px),70% calc(100% - 2px),65% calc(100% - 8px),60% 100%,',
      '    55% calc(100% - 6px),50% calc(100% - 1px),45% calc(100% - 7px),40% 100%,',
      '    35% calc(100% - 4px),30% calc(100% - 2px),25% calc(100% - 8px),20% 100%,',
      '    15% calc(100% - 5px),10% calc(100% - 1px),5% calc(100% - 7px),0 100%)}',
      '  #' + ID + ' .mp-leib.ruck .mp-stamm{animation:mpRuckQ .11s linear}',
      '  #' + ID + ' .mp-darunter{position:static;width:100%;padding:20px 18px;order:3;min-height:200px}',
      '  #' + ID + ' .mp-lochung{display:none}',
      '  #' + ID + ' .mp-abriss{position:absolute;left:0;right:0;bottom:0;top:auto;width:auto;',
      '    height:209px;margin-left:0;padding:18px 18px 30px;transform-origin:50% 10%;',
      '    clip-path:polygon(0 9px,5% 2px,10% 8px,15% 4px,20% 9px,25% 1px,30% 7px,35% 5px,',
      '      40% 9px,45% 2px,50% 8px,55% 3px,60% 9px,65% 1px,70% 7px,75% 4px,',
      '      80% 9px,85% 2px,90% 8px,95% 5px,100% 9px,100% 100%,0 100%)}',
      '  #' + ID + ' .mp-leib.ab .mp-abriss{transform:translate(-14px,250px) rotate(-13deg)}',
      '  #' + ID + ' .mp-abriss .zieh .d{display:none}',
      '  #' + ID + ' .mp-abriss .zieh .q{display:inline}',
      '  #' + ID + ' .mp-felder{gap:18px}',
      /* Auf 390 px traegt das Band drei Eintraege statt fuenf. */
      '  #' + ID + ' .mp-tband{grid-template-columns:repeat(3,1fr)}',
      '  #' + ID + ' .mp-tband .weg-handy{display:none}',
      '  #' + ID + ' .mp-tband > div{padding:11px 8px;gap:7px;flex-direction:column;align-items:flex-start}',
      '  #' + ID + ' .mp-tband b{font-size:10px}',
      '  #' + ID + ' .mp-tband span{font-size:8.6px}',
      '  #' + ID + ' .mp-tband img{width:26px;height:26px}',
      '  #' + ID + ' .mp-fuss{flex-direction:column;align-items:stretch;padding:16px}',
      '  #' + ID + ' .mp-fuss .mp-btn,#' + ID + ' .mp-fuss .mp-btn-l{text-align:center}',
      '}',
      '@keyframes mpRuckQ{0%{transform:translateY(0)}40%{transform:translateY(-3px)}',
      '  70%{transform:translateY(2px)}100%{transform:translateY(0)}}',
      '@media(prefers-reduced-motion:reduce){',
      '  #' + ID + ',#' + ID + ' .mp-karte,#' + ID + ' .mp-abriss,#' + ID + ' .mp-stempel,',
      '  #' + ID + ' .mp-lochung{transition:none}',
      '  #' + ID + ' .mp-leib.ruck .mp-stamm{animation:none}',
      '  #' + ID + ' .mp-abriss .zieh{animation:none}',
      '}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Markup ──────────────────────────────────────────────────────── */
  function bauen() {
    var pz;
    if (ZEIGE_PROZENT) {
      pz = '<div class="pz">−' + PROZENT + '<small>%</small></div>'
         + '<div class="s">Dauerhaft.<br>Auf jedes Paket.</div>';
    } else {
      pz = '<div class="pz" style="font-size:27px;letter-spacing:-1px">Dein<br>Vorteil</div>'
         + '<div class="s">Dauerhaft.<br>Auf jedes Paket.</div>';
    }

    var el = document.createElement('div');
    el.id = ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'DealPilot auf dem ' + MESSE.name);
    el.innerHTML =
      '<div class="mp-karte">'
      + '<button class="mp-zu" aria-label="Schließen">&times;</button>'
      + '<div class="mp-kopf"><span>BOARDING PASS · IMMOCATION FESTIVAL 2026</span>'
      +   '<span class="re">HALLE 3 · STAND 106</span></div>'
      + '<div class="mp-leib">'
      +   '<div class="mp-darunter">'
      +     '<div class="k">DEIN ABRISS LIEGT</div>'
      +     '<div class="gross">Halle&nbsp;3<br><b>Stand&nbsp;106</b></div>'
      +     '<div class="k">PERSÖNLICH ABZUHOLEN</div>'
      +     '<div class="mp-stempel">NUR AM STAND</div>'
      +   '</div>'
      +   '<div class="mp-stamm">'
      +     '<svg class="mp-kurve" viewBox="0 0 420 220" preserveAspectRatio="none" aria-hidden="true">'
      +       '<path d="M-10 215 C 120 205, 260 150, 410 22" fill="none" stroke="#C9A84C" '
      +       'stroke-width="7" stroke-linecap="round" opacity=".35"/></svg>'
      +     '<div class="mini">' + MESSE.spanne + ' · LEIPZIGER MESSE</div>'
      +     '<h2>Wir sind da. Und wir haben <em>etwas für dich dabei</em>.</h2>'
      +     '<p class="sub">Am Stand liegt deine Bordkarte — mit echtem Abriss. '
      +       'Den gibt es nur dort, von Hand.</p>'
      +     '<div class="mp-felder">'
      +       '<div><div class="k">BOARDING</div><div class="v">' + MESSE.kurz + '</div></div>'
      +       '<div><div class="k">ORT</div><div class="v">' + MESSE.ort + '</div></div>'
      +       '<div><div class="k">GATE</div><div class="v gold">Halle 3 · 106</div></div>'
      +     '</div>'
      +   '</div>'
      +   '<span class="mp-lochung" aria-hidden="true"></span>'
      +   '<div class="mp-abriss" role="button" tabindex="0" '
      +        'aria-label="Abriss abreißen — zeigt, wo du ihn bekommst">'
      +     '<div class="k">ABRISS — DEIN VORTEIL</div>'
      +     pz
      /* Hier stand im Entwurf der Codename. Er ist raus und bleibt raus. */
      +     '<div class="siegel">CODE AM STAND</div>'
      +     '<div class="zieh"><span class="d">← ZIEHEN ZUM ABREISSEN</span>'
      +       '<span class="q">NACH UNTEN WISCHEN ↓</span></div>'
      +   '</div>'
      + '</div>'
      + '<div class="mp-tband">'
      +   '<div><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="7" rx="1"/>'
      +     '<rect x="3" y="13" width="18" height="7" rx="1"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>'
      +     '<div><b>Server in Deutschland</b><span>Hosting bei Hetzner · DSGVO-konform</span></div></div>'
      +   '<div class="weg-handy"><svg viewBox="0 0 24 24"><path d="M7 3h10v6a5 5 0 0 1-10 0V3Z"/>'
      +     '<path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9 21h6M12 14v7"/></svg>'
      +     '<div><b>Aus der Gutachtenpraxis</b><span>DESAG-zertifizierter Sachverständiger</span></div></div>'
      +   '<div><svg viewBox="0 0 24 24"><path d="M12 2 4 5.5v6c0 5 3.4 8.9 8 10.5 4.6-1.6 8-5.5 8-10.5v-6L12 2Z"/>'
      +     '<path d="m9 12 2.2 2.2L15.5 10"/></svg>'
      +     '<div><b>Ihre Daten bleiben Ihre</b><span>Kein Weiterverkauf, keine Profilbildung</span></div></div>'
      +   '<div class="weg-handy"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/>'
      +     '<path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>'
      +     '<div><b>Made in Germany</b><span>Entwickelt in Nordrhein-Westfalen</span></div></div>'
      +   '<div><img src="assets/bsfz-siegel-2026.svg" width="34" height="34" loading="lazy" '
      +     'alt="FuE-Siegel 2026 der Bescheinigungsstelle Forschungszulage">'
      +     '<div><b>FuE-Siegel 2026</b><span>Bescheinigungsstelle Forschungszulage (BSFZ)</span></div></div>'
      + '</div>'
      + '<div class="mp-fuss">'
      +   '<div class="wo">Komm vorbei, hol dir die Karte — und wir rechnen dein '
      +     'nächstes Objekt gemeinsam durch. <b>Halle 3 · Stand 106.</b></div>'
      +   '<div><button class="mp-btn-l" data-zu>Vielleicht später</button> '
      +     '<button class="mp-btn" data-kal>In den Kalender →</button></div>'
      + '</div>'
      + '</div>';
    return el;
  }

  /* ── Verhalten ───────────────────────────────────────────────────── */
  function verdrahten(el) {
    var leib = el.querySelector('.mp-leib');
    var ab = el.querySelector('.mp-abriss');
    var sanft = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var gerissen = false, zieht = false, x0 = 0, y0 = 0;
    var SCHWELLE = 54;

    function reiss() {
      if (gerissen) return;
      gerissen = true;
      ab.classList.remove('zieht'); ab.style.transform = '';
      if (sanft) { leib.classList.add('ab'); return; }
      /* Erst der Ruck (das Trennen), dann der Fall - zwei Schritte, weil
         EINE Bewegung wie Schieben aussieht, nicht wie Reissen. */
      leib.classList.add('ruck');
      setTimeout(function () { leib.classList.add('ab'); }, 110);
    }

    function zu() {
      el.classList.remove('an');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
      document.removeEventListener('keydown', aufEsc);
    }
    function aufEsc(e) { if (e.key === 'Escape') zu(); }

    function quer() { return window.innerWidth <= 760; }

    ab.addEventListener('pointerdown', function (e) {
      if (gerissen) return;
      zieht = true; x0 = e.clientX; y0 = e.clientY;
      ab.classList.add('zieht');
      try { ab.setPointerCapture(e.pointerId); } catch (err) {}
    });
    ab.addEventListener('pointermove', function (e) {
      if (!zieht || gerissen) return;
      var dx = e.clientX - x0, dy = e.clientY - y0;
      var weg = quer() ? dy : dx;
      if (weg < 0) weg = weg * 0.25;     /* gegen die Reissrichtung zaeh */
      if (quer()) ab.style.transform = 'translate(' + (dx * 0.3) + 'px,' + weg + 'px) rotate(' + (-weg * 0.035) + 'deg)';
      else        ab.style.transform = 'translate(' + weg + 'px,' + (dy * 0.3) + 'px) rotate(' + (weg * 0.05) + 'deg)';
      if (Math.abs(weg) > SCHWELLE) { zieht = false; reiss(); }
    });
    function los() { if (!zieht) return; zieht = false; ab.classList.remove('zieht'); ab.style.transform = ''; }
    ab.addEventListener('pointerup', los);
    ab.addEventListener('pointercancel', los);
    /* Ein Klick reicht auch: eine Zieh-Geste, die hakt, waere schlechter
       als ein Klick mit guter Animation. */
    ab.addEventListener('click', function () { if (!gerissen) reiss(); });
    ab.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reiss(); }
    });

    el.querySelector('.mp-zu').addEventListener('click', zu);
    Array.prototype.forEach.call(el.querySelectorAll('[data-zu]'), function (b) {
      b.addEventListener('click', zu);
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-kal]'), function (b) {
      b.addEventListener('click', inDenKalender);
    });
    el.addEventListener('click', function (e) { if (e.target === el) zu(); });
    document.addEventListener('keydown', aufEsc);
  }

  function zeigen() {
    stil();
    var el = bauen();
    document.body.appendChild(el);
    verdrahten(el);
    requestAnimationFrame(function () { el.classList.add('an'); });
    merken();
  }

  function start() {
    if (document.getElementById(ID)) return;
    if (zeitVorbei()) return;      /* nach dem 01.11.2026 nie wieder */
    if (ueberFlyer()) return;      /* erstflug-popup.js hat Vorrang */
    if (schonGesehen()) return;
    setTimeout(zeigen, 1400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  /* Zum Ansehen ohne zu warten: DealPilotMessePopup.zeigen() in der Konsole. */
  window.DealPilotMessePopup = { zeigen: zeigen, ics: icsText, kalender: inDenKalender };
})();
