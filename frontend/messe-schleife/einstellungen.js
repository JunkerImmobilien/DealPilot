/* ═══════════════════════════════════════════════════════════════════════
   einstellungen.js · messe-schleife-6 — DAS MENÜ AM STAND (v2937)
   Marcel 23.10.2026: „ein Menü, damit ich gewisse Dinge einstellen kann
   wie Gewinnspiel etc."

   Öffnen:  Taste E  ·  oder dreimal schnell oben rechts in die Ecke tippen
            (Touch-Bildschirm ohne Tastatur)  ·  Schließen: Esc / „Fertig"
   Gespeichert im Browser des Messe-Rechners (localStorage), gilt also auch
   nach einem Neustart. „Zurücksetzen" stellt die Vorgaben wieder her.
   Vorrang: Menü > gewinnspiel.js. Taste G schaltet das Gewinnspiel weiter
   sofort um und schreibt es jetzt auch hierher.

   Läuft auch von der Platte (file://), ohne Netz.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var SCHLUESSEL = 'dps_einstellungen';
  var G = window.MESSE_GEWINNSPIEL || {};
  var VORGABE = {
    gewinnspiel: !!G.an,                 /* Gewinnspiel-Tafel zeigen */
    gewinnspiel_sek: Number(G.sekunden) || 15,
    register: true,                      /* Register-Tafel (amtliche Werte) */
    register_nach: 10,                   /* Videothek: nach jedem n-ten Video */
    app: true,                           /* Tafel „DealPilot in Zahlen" */
    app_nach: 5,                         /* Videothek: nach jedem n-ten Video */
    app_sek: 16,
    aufruf: true,                        /* Aufruf-Tafel „Jetzt kostenlos testen" */
    start: 'rundgang',                   /* Startkanal ohne ?idee=: rundgang | videothek | auswahl */
    leiste: true                         /* Leiste unten bei Mausbewegung */
  };
  var E = Object.assign({}, VORGABE);
  try { var roh = JSON.parse(localStorage.getItem(SCHLUESSEL) || 'null'); if (roh && typeof roh === 'object') Object.keys(VORGABE).forEach(function (k) { if (roh[k] !== undefined) E[k] = roh[k]; }); } catch (e) { /* ohne Speicher: Vorgaben */ }

  function speichern() { try { localStorage.setItem(SCHLUESSEL, JSON.stringify(E)); } catch (e) { /* ohne Speicher */ } }
  function setze(k, v) { E[k] = v; speichern(); try { window.dispatchEvent(new CustomEvent('dps:einstellungen', { detail: { k: k, v: v } })); } catch (e) {} }

  var FELDER = [
    ['Tafeln', null],
    ['gewinnspiel', 'Gewinnspiel-Tafel (QR immocation)', 'schalter'],
    ['gewinnspiel_sek', 'Gewinnspiel: Sekunden', 'zahl', 5, 60],
    ['app', 'Tafel „DealPilot in Zahlen“', 'schalter'],
    ['app_sek', 'DealPilot in Zahlen: Sekunden', 'zahl', 8, 40],
    ['register', 'Register-Tafel (amtliche Werte)', 'schalter'],
    ['aufruf', 'Aufruf „Jetzt kostenlos testen“', 'schalter'],
    ['Videothek', null],
    ['app_nach', 'DealPilot in Zahlen nach jedem … Video', 'zahl', 1, 30],
    ['register_nach', 'Register-Tafel nach jedem … Video', 'zahl', 1, 30],
    ['Start', null],
    ['start', 'Kanal beim Öffnen', 'wahl', [['rundgang', 'Rundgang'], ['videothek', 'Videothek'], ['auswahl', 'Auswahl']]],
    ['leiste', 'Leiste bei Mausbewegung', 'schalter']
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var offen = null;
  function zu() { if (offen) { offen.remove(); offen = null; } }
  function auf() {
    if (offen) return zu();
    var w = document.createElement('div');
    w.className = 'dps-menue';
    var h = '<div class="dps-menue-k"><div class="dps-menue-kopf"><b>Einstellungen</b><span>Messe-Schleife · gespeichert auf diesem Rechner</span></div><div class="dps-menue-liste">';
    FELDER.forEach(function (f) {
      if (f[1] === null) { h += '<div class="dps-menue-gr">' + esc(f[0]) + '</div>'; return; }
      var k = f[0], v = E[k];
      h += '<label class="dps-menue-z"><span>' + esc(f[1]) + '</span>';
      if (f[2] === 'schalter') h += '<input type="checkbox" data-k="' + k + '"' + (v ? ' checked' : '') + '><i class="dps-sw"></i>';
      else if (f[2] === 'zahl') h += '<span class="dps-zahl"><button type="button" data-k="' + k + '" data-d="-1">−</button><b data-zk="' + k + '">' + esc(v) + '</b><button type="button" data-k="' + k + '" data-d="1">+</button></span>';
      else h += '<select data-k="' + k + '">' + f[3].map(function (o) { return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
      h += '</label>';
    });
    h += '</div><div class="dps-menue-fuss"><button type="button" data-a="reset">Zurücksetzen</button><button type="button" data-a="neu">Neu starten</button><button type="button" data-a="zu" class="dps-ja">Fertig</button></div>'
      + '<div class="dps-menue-hilfe">Tasten: E Menü · G Gewinnspiel · N nächstes · F Vollbild · R Rundgang · V Videothek</div></div>';
    w.innerHTML = h;
    w.addEventListener('change', function (ev) {
      var t = ev.target, k = t.getAttribute('data-k'); if (!k) return;
      setze(k, t.type === 'checkbox' ? t.checked : t.value);
    });
    w.addEventListener('click', function (ev) {
      var t = ev.target;
      if (t === w) return zu();
      var d = t.getAttribute('data-d');
      if (d) {
        var k = t.getAttribute('data-k'), f = FELDER.filter(function (x) { return x[0] === k; })[0];
        var n = Math.max(f[3], Math.min(f[4], (Number(E[k]) || 0) + Number(d)));
        setze(k, n); w.querySelector('[data-zk="' + k + '"]').textContent = n; return;
      }
      var a = t.getAttribute('data-a');
      if (a === 'zu') zu();
      else if (a === 'reset') { E = Object.assign({}, VORGABE); speichern(); zu(); auf(); }
      else if (a === 'neu') location.reload();
    });
    document.body.appendChild(w); offen = w;
  }
  /* capture + stopImmediatePropagation: solange das Menü offen ist, kommt keine
     Taste bei den Kanälen an (Esc hieße dort sonst „zur Auswahl"). */
  addEventListener('keydown', function (e) {
    if (offen) {
      if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') zu();
      e.stopImmediatePropagation();
      return;
    }
    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); e.stopImmediatePropagation(); auf(); }
  }, true);
  /* dreimal oben rechts tippen (innerhalb 1,5 s) */
  var tipps = [];
  addEventListener('pointerdown', function (e) {
    if (e.clientX < innerWidth - 120 || e.clientY > 120) return;
    var t = Date.now(); tipps = tipps.filter(function (x) { return t - x < 1500; }); tipps.push(t);
    if (tipps.length >= 3) { tipps = []; auf(); }
  }, true);

  window.DPS_EINST = { get: function (k) { return E[k]; }, set: setze, alle: function () { return Object.assign({}, E); }, auf: auf, vorgabe: VORGABE };
})();
