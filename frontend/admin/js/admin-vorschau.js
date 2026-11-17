/* ============================================================================
   admin-vorschau.js — v3600
   Admin › Vorschau: was in der App derzeit ausgeblendet ist (Marcel 17.11.2026).
   Die Liste kommt aus backend/src/services/vorschau-funktionen.json (GET /admin-vorschau):
   Schlüssel, Bezeichnung, seit, für wen sichtbar; je Funktion der Schalter „für alle“,
   darunter die Freigabeliste (Konten mit Zusatz „vorschau“).
   ========================================================================= */
(function () {
  'use strict';
  var BASE = '/api/v1/admin-vorschau';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function zeit(d) { try { return new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } }
  function ruf(methode, pfad, body) {
    return fetch(BASE + pfad, { method: methode, headers: { 'Content-Type': 'application/json', 'X-Admin-Token': localStorage.getItem('dp_admin_token') || '' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error((d && (d.message || d.error)) || ('HTTP ' + r.status)); return d; }); });
  }
  var TH = 'text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;font:700 10px monospace;letter-spacing:.08em;text-transform:uppercase';
  var TD = 'padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top';

  function laden() {
    var body = document.getElementById('vs-body'); if (!body) return;
    body.innerHTML = '<p style="color:#7a7468">wird geladen …</p>';
    ruf('GET', '').then(function (d) {
      var f = d.funktionen || [];
      body.innerHTML = '<p style="font-size:13px;margin:0 0 10px">Diese Funktionen sind gebaut, aber noch nicht für Kunden freigegeben. '
        + 'Sie sind in der App ausgeblendet <b>und</b> ihre Routen antworten mit 403 – auf Staging und Produktion gleich. '
        + 'Die Liste steht im Code (<code>backend/src/services/vorschau-funktionen.json</code>); „Für alle freigeben“ hebt die Sperre ohne Rollout auf.</p>'
        + '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr>'
        + ['Schlüssel', 'Funktion', 'seit', 'sichtbar für', 'für alle'].map(function (h) { return '<th style="' + TH + '">' + h + '</th>'; }).join('')
        + '</tr></thead><tbody>' + f.map(function (e) {
          var wer = e.fuer_alle ? '<b>alle Konten</b>' : e.gruppen.map(function (g) {
            return esc(g.text) + ': ' + (g.konten.length ? esc(g.konten.join(', ')) : '<span style="color:#888">niemand</span>');
          }).join('<br>');
          return '<tr>' + [
            '<code>' + esc(e.schluessel) + '</code>',
            '<b>' + esc(e.bezeichnung) + '</b><br><span style="color:#666">' + esc(e.beschreibung) + '</span>'
              + (e.routen.length ? '<br><span style="color:#888">Routen: ' + esc(e.routen.join(', ')) + '</span>' : ''),
            esc(e.seit),
            wer,
            '<label style="display:flex;gap:6px;align-items:center;white-space:nowrap"><input type="checkbox" data-vs-alle="' + esc(e.schluessel) + '"' + (e.fuer_alle ? ' checked' : '') + '> für alle</label>'
              + (e.geaendert_am ? '<span style="color:#888;font-size:11px">' + esc(zeit(e.geaendert_am)) + (e.geaendert_von ? ' · ' + esc(e.geaendert_von) : '') + '</span>' : '')
          ].map(function (c) { return '<td style="' + TD + '">' + c + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>'
        + '<h3 style="margin:22px 0 6px;font-size:15px">Freigabeliste Vorschau</h3>'
        + '<p style="font-size:12.5px;color:#666;margin:0 0 8px">Konten, die alle Vorschau-Funktionen mit der Gruppe „Freigabeliste“ sehen (Zusatz „vorschau“). Admin-Konten sehen sie ohnehin.</p>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px"><input type="email" id="vs-mail" placeholder="E-Mail des Kontos" style="min-width:260px;padding:6px 8px">'
        + '<button class="btn btn-primary btn-sm" id="vs-add">Hinzufügen</button><span id="vs-meld" style="font-size:12px"></span></div>'
        + ((d.freigabeliste || []).length ? '<table style="border-collapse:collapse;font-size:12.5px"><tbody>' + d.freigabeliste.map(function (k) {
          return '<tr><td style="' + TD + '">' + esc(k.email) + '</td><td style="' + TD + ';color:#888">' + esc(zeit(k.updated_at)) + (k.geaendert_von ? ' · ' + esc(k.geaendert_von) : '') + '</td>'
            + '<td style="' + TD + '"><button class="btn btn-sm" data-vs-weg="' + esc(k.email) + '">Entfernen</button></td></tr>';
        }).join('') + '</tbody></table>' : '<p style="color:#888;font-size:12.5px">Noch niemand auf der Freigabeliste.</p>');
      body.querySelectorAll('[data-vs-alle]').forEach(function (cb) {
        cb.addEventListener('change', function () {
          var k = cb.getAttribute('data-vs-alle');
          if (cb.checked && !confirm('„' + k + '“ für ALLE Konten freigeben? Kunden sehen die Funktion dann sofort.')) { cb.checked = false; return; }
          ruf('POST', '/' + encodeURIComponent(k) + '/fuer-alle', { an: cb.checked }).then(laden).catch(function (e) { alert(e.message); laden(); });
        });
      });
      var add = document.getElementById('vs-add');
      if (add) add.addEventListener('click', function () {
        var m = (document.getElementById('vs-mail').value || '').trim();
        if (!m) return;
        ruf('POST', '/konten', { email: m, aktiv: true }).then(laden).catch(function (e) { var x = document.getElementById('vs-meld'); if (x) { x.style.color = '#B8625C'; x.textContent = e.message; } });
      });
      body.querySelectorAll('[data-vs-weg]').forEach(function (b) {
        b.addEventListener('click', function () { ruf('POST', '/konten', { email: b.getAttribute('data-vs-weg'), aktiv: false }).then(laden).catch(function (e) { alert(e.message); }); });
      });
    }).catch(function (e) { body.innerHTML = '<p style="color:#B8625C">Konnte nicht geladen werden: ' + esc(e.message) + '</p>'; });
  }
  function init() {
    var link = document.querySelector('.nav-link[data-view="vorschau"]');
    if (link) link.addEventListener('click', function () { setTimeout(laden, 30); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.DpAdminVorschau = { laden: laden };
})();
