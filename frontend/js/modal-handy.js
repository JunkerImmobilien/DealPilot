'use strict';
/* v2201 · N63.3 / N63.4 · Hilfe und Einstellungen auf dem Handy
   ─────────────────────────────────────────────────────────────────────
   Marcel, 13.10.2026: „wenn wir das auf dem Handy aufmachen, finde ich das
   Modal nicht gut dargestellt … genauso wie unter Einstellungen".

   Gemessen in der Messkabine bei 390 px: zwei Titelzeilen übereinander
   (schwarzes Band + goldene Fläche), darunter 17 Themen bzw. 13 Bereiche
   als waagerechte Leiste mit Scrollbalken, dann der Inhalt in einem
   eigenen Kasten. Man sieht nie, welche Themen es gibt.

   Jetzt das Muster jeder Handy-App: erst die LISTE (Symbol, Titel,
   Kurzbeschreibung, antippen), dann der INHALT mit einer Zurück-Zeile
   „‹ Alle Themen · <Titel>". Der Zustand steht als data-mob am Overlay
   (#help-modal / #settings-modal); die Gestaltung in style.css (v2201).
   Ab 769 px tut dieses Modul nichts.

   Die Hilfe öffnet direkt im Inhalt „Einstieg, Abläufe & Pilot" (Marcel:
   „wenn wir die Hilfe öffnen, dann auch direkt die Abläufe … anzeigen").
   Die Einstellungen öffnen im Inhalt, wenn ein Bereich mitgegeben wurde
   (z. B. „Plan" von der Kontingent-Pille), sonst in der Liste. */
(function () {
  if (window.DealPilotModalHandy) return;
  var MQ = window.matchMedia ? window.matchMedia('(max-width: 768px)') : { matches: false };
  var MODALE = {
    'help-modal': { liste: '#help-sidebar', eintrag: '.help-sidebar-item', inhalt: '.help-modal-content', zurueck: 'Alle Themen' },
    'settings-modal': { liste: '.settings-tabs', eintrag: '.st-tab', inhalt: '.set-modal-content', zurueck: 'Alle Bereiche' }
  };

  function titelVon(btn) {
    if (!btn) return '';
    var t = btn.querySelector('.help-sidebar-item-title');
    return String((t || btn).textContent || '').replace(/\s+/g, ' ').trim();
  }
  function aktiv(ov, cfg) {
    return ov.querySelector(cfg.liste + ' ' + cfg.eintrag + '.active') || ov.querySelector(cfg.liste + ' ' + cfg.eintrag + '.help-sidebar-item-active');
  }
  function leiste(ov, cfg) {
    var host = ov.querySelector(cfg.inhalt); if (!host) return null;
    var z = host.querySelector(':scope > .mh-zurueck');
    if (!z) {
      z = document.createElement('button');
      z.type = 'button'; z.className = 'mh-zurueck';
      z.innerHTML = '<span class="mh-pfeil" aria-hidden="true">‹</span><span class="mh-wohin"></span><span class="mh-titel"></span>';
      z.addEventListener('click', function () { setze(ov, 'liste'); });
      host.insertBefore(z, host.firstChild);
    }
    z.querySelector('.mh-wohin').textContent = cfg.zurueck;
    return z;
  }
  function setze(ov, art) {
    var cfg = MODALE[ov.id]; if (!cfg) return;
    if (!MQ.matches) { ov.removeAttribute('data-mob'); return; }
    ov.setAttribute('data-mob', art);
    var z = leiste(ov, cfg);
    if (z) z.querySelector('.mh-titel').textContent = titelVon(aktiv(ov, cfg));
    var sc = art === 'liste' ? ov.querySelector(cfg.liste) : ov.querySelector(cfg.inhalt);
    try { if (sc) sc.scrollTop = 0; var pw = ov.querySelector(cfg.inhalt + ' .pane-wrap'); if (pw && art === 'inhalt') pw.scrollTop = 0; } catch (e) {}
  }
  /* Klick auf einen Eintrag der Liste -> Inhalt. Delegiert am Dokument,
     weil beide Fenster ihre Leisten erst beim Öffnen bauen und Module
     (Partner-Portal, Netzwerk) später Einträge anhängen. Läuft NACH dem
     eigenen onclick der Einträge (Bubbling), die Markierung steht dann. */
  document.addEventListener('click', function (e) {
    if (!MQ.matches) return;
    for (var id in MODALE) {
      var cfg = MODALE[id];
      var btn = e.target.closest && e.target.closest('#' + id + ' ' + cfg.liste + ' ' + cfg.eintrag);
      if (btn) { var ov = document.getElementById(id); setTimeout(function () { setze(ov, 'inhalt'); }, 0); return; }
    }
  }, false);
  /* Suche in der Hilfe: Treffer stehen im Inhalt */
  document.addEventListener('input', function (e) {
    if (!MQ.matches || !e.target || e.target.id !== 'help-search-input') return;
    var ov = document.getElementById('help-modal'); if (!ov) return;
    if (String(e.target.value || '').trim().length >= 2) setze(ov, 'inhalt');
  }, true);

  function umhuellen(name, start) {
    var orig = window[name];
    if (typeof orig !== 'function' || orig._mh) return false;
    var neu = function () {
      var r = orig.apply(this, arguments);
      var args = arguments;
      setTimeout(function () { var ov = document.getElementById(name === 'showHelp' ? 'help-modal' : 'settings-modal'); if (ov) setze(ov, start(args)); }, 0);
      return r;
    };
    neu._mh = 1;
    window[name] = neu;
    return true;
  }
  function verdrahten() {
    var a = umhuellen('showHelp', function () { return 'inhalt'; });
    var b = umhuellen('showSettings', function (args) { return args && args[0] ? 'inhalt' : 'liste'; });
    return a && b;
  }
  if (!verdrahten()) {
    var n = 0, t = setInterval(function () { if (verdrahten() || ++n > 40) clearInterval(t); }, 250);
  }
  /* Drehen / Fenster ändern: Zustand passt sich an */
  try {
    var wechsel = function () {
      for (var id in MODALE) { var ov = document.getElementById(id); if (ov) { if (MQ.matches) { if (!ov.getAttribute('data-mob')) setze(ov, 'inhalt'); } else ov.removeAttribute('data-mob'); } }
    };
    if (MQ.addEventListener) MQ.addEventListener('change', wechsel); else if (MQ.addListener) MQ.addListener(wechsel);
  } catch (e) {}

  window.DealPilotModalHandy = { setze: setze };
})();
