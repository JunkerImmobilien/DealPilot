/* ============================================================================
   admin-rabatte.js — Rabattcodes sehen, abschalten, neu anlegen (v1423)

   Marcel am 16.09.2026: einen Counter sehen, den Code „einfach rausnehmen"
   koennen, und bei Bedarf einen neuen mit eigenem Namen anlegen.

   Die Wahrheit steht in Stripe, nicht in einer eigenen Tabelle. Diese
   Ansicht liest und schreibt ausschliesslich dort — eine zweite Liste
   waere schon am naechsten Tag eine andere.

   Drei Dinge, die die Oberflaeche ausspricht, weil sie sonst teuer werden:
     · Abschalten nimmt niemandem seinen Rabatt weg. Wer eingeloest hat,
       behaelt ihn, solange sein Abo laeuft.
     · Ein Prozentsatz laesst sich nicht aendern. Anders geht nur: alten
       abschalten, neuen anlegen.
     · Ein Coupon ohne Code ist fuer Kunden unerreichbar. Genau so lag
       ERSTFLUG15 monatelang herum — deshalb werden solche Leichen hier
       angezeigt statt verschwiegen.
   ========================================================================= */
(function () {
  'use strict';

  var BASE = '/api/v1/admin-rabatte';
  var geladen = false;

  function _token() { return localStorage.getItem('dp_admin_token') || ''; }

  async function _call(method, pfad, body) {
    var headers = {};
    var t = _token();
    if (t) headers['X-Admin-Token'] = t;
    if (body) headers['Content-Type'] = 'application/json';
    var r = await fetch(BASE + pfad, {
      method: method, headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });
    var d = null;
    try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((d && (d.message || d.error)) || ('HTTP ' + r.status));
    return d;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function dauerText(r) {
    if (r.dauer === 'forever') return 'dauerhaft';
    if (r.dauer === 'once') return 'einmalig';
    if (r.dauer === 'repeating') return r.dauer_monate + ' Monate lang';
    return '–';
  }

  function wertText(r) {
    if (r.prozent != null) return r.prozent + ' %';
    if (r.betrag != null) return r.betrag.toFixed(2).replace('.', ',') + ' ' + (r.waehrung || '');
    return '–';
  }

  function stil() {
    if (document.getElementById('rb-css')) return;
    var s = document.createElement('style');
    s.id = 'rb-css';
    s.textContent = [
      '#view-rabatte .rb-kopf{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:14px}',
      '#view-rabatte .rb-modus{font:700 10px/1 monospace;letter-spacing:.14em;padding:5px 9px;border-radius:3px}',
      '#view-rabatte .rb-modus.live{background:rgba(216,86,76,.14);color:#D8564C;border:1px solid rgba(216,86,76,.4)}',
      '#view-rabatte .rb-modus.test{background:rgba(63,165,108,.14);color:#3FA56C;border:1px solid rgba(63,165,108,.4)}',
      '#view-rabatte table{width:100%;border-collapse:collapse;font-size:13px}',
      '#view-rabatte th{text-align:left;font:700 10px/1.4 monospace;letter-spacing:.1em;',
      ' text-transform:uppercase;color:#8a8376;padding:9px 10px;border-bottom:1px solid #332f28}',
      '#view-rabatte td{padding:11px 10px;border-bottom:1px solid #26231d;vertical-align:middle}',
      '#view-rabatte tr.aus td{opacity:.5}',
      '#view-rabatte .rb-code{font-family:monospace;font-weight:700;font-size:14px;',
      ' color:var(--wl-e8cc7a, #E8CC7A);letter-spacing:.06em}',
      '#view-rabatte .rb-zaehler{font-family:monospace;font-size:15px;font-weight:700}',
      '#view-rabatte .rb-von{color:#8a8376;font-size:12px;font-weight:400}',
      '#view-rabatte .rb-pill{display:inline-block;font:700 9.5px/1 monospace;letter-spacing:.1em;',
      ' padding:4px 8px;border-radius:2px;text-transform:uppercase}',
      '#view-rabatte .rb-pill.an{background:rgba(63,165,108,.16);color:#3FA56C}',
      '#view-rabatte .rb-pill.aus{background:rgba(138,131,118,.16);color:#8a8376}',
      '#view-rabatte button.rb-akt{font:600 12px/1 Inter,sans-serif;padding:7px 13px;border-radius:3px;',
      ' cursor:pointer;border:1px solid #403a30;background:#1a1815;color:#d9d2c2}',
      '#view-rabatte button.rb-akt:hover{border-color:var(--wl-c9a84c, #C9A84C);color:#fff}',
      '#view-rabatte .rb-neu{margin-top:26px;padding:18px;border:1px solid #332f28;border-radius:5px;background:#16140f}',
      '#view-rabatte .rb-neu h3{margin:0 0 4px;font-size:15px}',
      '#view-rabatte .rb-neu p.hin{margin:0 0 16px;color:#8a8376;font-size:12.5px;line-height:1.5}',
      '#view-rabatte .rb-felder{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end}',
      '#view-rabatte .rb-feld{display:flex;flex-direction:column;gap:5px}',
      '#view-rabatte .rb-feld label{font:700 9.5px/1 monospace;letter-spacing:.1em;',
      ' text-transform:uppercase;color:#8a8376}',
      '#view-rabatte .rb-feld input,#view-rabatte .rb-feld select{background:#0e0d0b;border:1px solid #403a30;',
      ' color:#EFEAE0;border-radius:3px;padding:8px 10px;font-size:13px;font-family:inherit}',
      '#view-rabatte .rb-feld input:focus,#view-rabatte .rb-feld select:focus{outline:none;',
      ' border-color:var(--wl-c9a84c, #C9A84C)}',
      '#view-rabatte .rb-anlegen{background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),',
      ' var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));color:#050505;font-weight:700;',
      ' border:0;border-radius:3px;padding:9px 18px;cursor:pointer;font-size:13px}',
      '#view-rabatte .rb-meldung{margin-top:12px;padding:11px 14px;border-radius:3px;font-size:13px;line-height:1.5}',
      '#view-rabatte .rb-meldung.gut{background:rgba(63,165,108,.12);color:#8fd8b0;border-left:3px solid #3FA56C}',
      '#view-rabatte .rb-meldung.schlecht{background:rgba(216,86,76,.12);color:#e8a29b;border-left:3px solid #D8564C}',
      '#view-rabatte .rb-leichen{margin-top:20px;padding:13px 15px;border-left:3px solid #E8B84F;',
      ' background:rgba(232,184,79,.08);font-size:12.5px;line-height:1.6;color:#d8c9a0}',
      '#view-rabatte .rb-leer{color:#7a7468}'
    ].join('');
    document.head.appendChild(s);
  }

  function zeile(r) {
    var grenze = r.grenze == null
      ? '<span class="rb-von">unbegrenzt</span>'
      : '<span class="rb-von">von ' + r.grenze + '</span>';
    return '<tr class="' + (r.aktiv ? '' : 'aus') + '" data-id="' + esc(r.id) + '">' +
      '<td><span class="rb-code">' + esc(r.code) + '</span>' +
        (r.nur_fuer ? '<br><span class="rb-von">nur fuer bestimmte Produkte</span>' : '') + '</td>' +
      '<td>' + esc(wertText(r)) + '</td>' +
      '<td>' + esc(dauerText(r)) + '</td>' +
      '<td><span class="rb-zaehler">' + r.eingeloest + '</span> ' + grenze + '</td>' +
      '<td><span class="rb-pill ' + (r.aktiv ? 'an' : 'aus') + '">' +
        (r.aktiv ? 'aktiv' : 'abgeschaltet') + '</span></td>' +
      '<td><button class="rb-akt" data-id="' + esc(r.id) + '" data-an="' + (r.aktiv ? '0' : '1') + '">' +
        (r.aktiv ? 'Abschalten' : 'Wieder einschalten') + '</button></td>' +
    '</tr>';
  }

  function melde(text, gut) {
    var m = document.getElementById('rb-meldung');
    if (!m) return;
    m.className = 'rb-meldung ' + (gut ? 'gut' : 'schlecht');
    m.innerHTML = esc(text);
    m.style.display = 'block';
  }

  function zeichne(d) {
    var body = document.getElementById('rb-body');
    if (!body) return;
    var liste = d.rabatte || [];

    var leichen = '';
    if (d.verwaiste_coupons && d.verwaiste_coupons.length) {
      leichen = '<div class="rb-leichen"><b>' + d.verwaiste_coupons.length +
        ' Rabatt' + (d.verwaiste_coupons.length === 1 ? '' : 'e') +
        ' ohne Code:</b> ' +
        d.verwaiste_coupons.map(function (c) {
          return esc(c.name || c.coupon_id) + (c.prozent != null ? ' (' + c.prozent + ' %)' : '');
        }).join(', ') +
        '. Sie sind angelegt, aber an keinen Namen gebunden — <b>kein Kunde kann sie einloesen</b>. ' +
        'Zum Nutzen unten einen Code mit demselben Prozentsatz anlegen.</div>';
    }

    body.innerHTML =
      '<div class="rb-kopf">' +
        '<span class="rb-modus ' + (d.modus === 'live' ? 'live' : 'test') + '">' +
          (d.modus === 'live' ? 'ECHTGELD' : 'TESTKONTO') + '</span>' +
        '<span class="rb-von">' + liste.filter(function (r) { return r.aktiv; }).length +
        ' aktiv, ' + liste.length + ' insgesamt</span>' +
      '</div>' +
      (liste.length
        ? '<table><thead><tr><th>Code</th><th>Rabatt</th><th>Gilt</th>' +
          '<th>Eingeloest</th><th>Status</th><th></th></tr></thead><tbody>' +
          liste.map(zeile).join('') + '</tbody></table>'
        : '<p class="rb-leer">Noch kein Rabattcode angelegt.</p>') +
      leichen +
      '<div class="rb-neu">' +
        '<h3>Neuen Rabatt anlegen</h3>' +
        '<p class="hin">Der Name ist das, was der Kunde tippt oder was auf dem Flyer steht ' +
        '(und als <code>dealpilot.immo/NAME</code> funktioniert). ' +
        'Ein Prozentsatz laesst sich spaeter <b>nicht</b> aendern — fuer einen anderen Wert ' +
        'den alten abschalten und hier einen neuen anlegen.</p>' +
        '<div class="rb-felder">' +
          '<div class="rb-feld"><label for="rb-code">Name</label>' +
            '<input id="rb-code" type="text" placeholder="MESSE26" maxlength="50" style="width:150px;text-transform:uppercase"></div>' +
          '<div class="rb-feld"><label for="rb-prozent">Rabatt in %</label>' +
            '<input id="rb-prozent" type="number" min="1" max="100" value="15" style="width:90px"></div>' +
          '<div class="rb-feld"><label for="rb-dauer">Gilt</label>' +
            '<select id="rb-dauer">' +
              '<option value="forever">dauerhaft</option>' +
              '<option value="once">nur die erste Rechnung</option>' +
              '<option value="repeating">eine Weile</option>' +
            '</select></div>' +
          '<div class="rb-feld" id="rb-monate-feld" style="display:none"><label for="rb-monate">Monate</label>' +
            '<input id="rb-monate" type="number" min="1" max="36" value="12" style="width:80px"></div>' +
          '<div class="rb-feld"><label for="rb-grenze">Hoechstens … mal</label>' +
            '<input id="rb-grenze" type="number" min="1" placeholder="unbegrenzt" style="width:120px"></div>' +
          '<button class="rb-anlegen" id="rb-anlegen" type="button">Anlegen</button>' +
        '</div>' +
        '<div class="rb-meldung" id="rb-meldung" style="display:none"></div>' +
      '</div>';

    binde();
  }

  function binde() {
    var dauer = document.getElementById('rb-dauer');
    if (dauer) dauer.addEventListener('change', function () {
      var f = document.getElementById('rb-monate-feld');
      if (f) f.style.display = dauer.value === 'repeating' ? 'flex' : 'none';
    });

    Array.prototype.forEach.call(document.querySelectorAll('#view-rabatte button.rb-akt'), function (b) {
      b.addEventListener('click', async function () {
        var an = b.getAttribute('data-an') === '1';
        if (!an && !confirm('Diesen Code abschalten?\n\nNeue Kunden koennen ihn dann nicht mehr einloesen. ' +
            'Wer ihn bereits hat, behaelt seinen Rabatt, solange sein Abo laeuft.')) return;
        b.disabled = true;
        try {
          await _call('POST', '/' + encodeURIComponent(b.getAttribute('data-id')) + '/aktiv', { aktiv: an });
          await laden(true);
        } catch (e) {
          b.disabled = false;
          melde('Ging nicht: ' + e.message, false);
        }
      });
    });

    var knopf = document.getElementById('rb-anlegen');
    if (knopf) knopf.addEventListener('click', async function () {
      var code = (document.getElementById('rb-code').value || '').trim().toUpperCase();
      var prozent = document.getElementById('rb-prozent').value;
      var d = document.getElementById('rb-dauer').value;
      var monate = document.getElementById('rb-monate').value;
      var grenze = (document.getElementById('rb-grenze').value || '').trim();

      knopf.disabled = true;
      try {
        var r = await _call('POST', '/anlegen', {
          code: code, prozent: prozent, dauer: d,
          monate: monate, grenze: grenze === '' ? null : grenze
        });
        await laden(true);
        melde('Angelegt: ' + r.rabatt.code + ' mit ' + wertText(r.rabatt) + ', ' + dauerText(r.rabatt) +
          '. Der Code wirkt sofort — auch ueber dealpilot.immo/' + r.rabatt.code.toLowerCase() + '.', true);
      } catch (e) {
        knopf.disabled = false;
        melde(e.message, false);
      }
    });
  }

  async function laden(still) {
    var body = document.getElementById('rb-body');
    if (!body) return;
    if (!still) body.innerHTML = '<p class="rb-leer">wird geladen …</p>';
    try {
      stil();
      var d = await _call('GET', '/');
      zeichne(d || {});
      geladen = true;
    } catch (e) {
      body.innerHTML = '<p class="rb-leer">Konnte nicht geladen werden: ' + esc(e.message) + '</p>';
    }
  }

  function init() {
    var link = document.querySelector('.nav-link[data-view="rabatte"]');
    if (link) link.addEventListener('click', function () {
      setTimeout(function () { if (!geladen) laden(); }, 30);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
