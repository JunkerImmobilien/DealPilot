/* ============================================================================
   admin-gutachtenauftraege.js — v3590
   Admin › Gutachtenaufträge: RND-Gutachten, die Kunden in DealPilot über Junker
   Immobilien bei gutachten.org beauftragt haben (Marcel 16.11.2026). Nur lesend.
   ========================================================================= */
(function () {
  'use strict';
  var BASE = '/api/v1/admin-gutachtenauftraege';
  var geladen = false;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return Number(x || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
  function zeit(d) { try { return new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return ''; } }
  var BES = { keine: '–', aussen: 'Außen', innen_aussen: 'Innen + außen' };
  var MAIL = { gesendet: 'Mail gesendet', staging_unterdrueckt: 'Staging – keine Mail', testadresse_nicht_gesendet: 'Testadresse', fehler: 'Mail-Fehler' };

  async function laden() {
    var body = document.getElementById('ga-body'); if (!body) return;
    body.innerHTML = '<p style="color:#7a7468">wird geladen …</p>';
    try {
      var r = await fetch(BASE, { headers: { 'X-Admin-Token': localStorage.getItem('dp_admin_token') || '' } });
      var d = await r.json();
      if (!r.ok) throw new Error((d && (d.message || d.error)) || ('HTTP ' + r.status));
      var l = d.auftraege || [];
      geladen = true;
      if (!l.length) { body.innerHTML = '<p style="color:#7a7468">Noch keine Gutachtenaufträge.</p>'; return; }
      var summe = l.filter(function (a) { return (a.status === 'beauftragt' || a.status === 'bestellt') && a.umgebung !== 'test'; }).reduce(function (s, a) { return s + Number(a.endpreis || 0); }, 0);
      body.innerHTML = '<p style="font-size:13px;margin:0 0 10px">' + l.length + ' Aufträge · bestellt/beauftragt (Produktivumgebung): ' + eur(summe) + '</p>'
        + '<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr>'
        + ['Zeit', 'Stand', 'Kunde', 'Objekt', 'Leistung', 'Rabatt', 'Endpreis', 'gutachten.org', 'Mail', 'Konto'].map(function (h) { return '<th style="text-align:left;padding:6px 8px;border-bottom:1px solid #ddd;font:700 10px monospace;letter-spacing:.08em;text-transform:uppercase">' + h + '</th>'; }).join('')
        + '</tr></thead><tbody>' + l.map(function (a) {
          var k = a.kunde || {}, w = a.auswahl || {}, p = a.preis || {};
          return '<tr>' + [
            zeit(a.beauftragt_at || a.created_at),
            esc({ beauftragt: 'an gutachten.org abgesendet', bestellt: 'bestellt – bei gutachten.org absenden' }[a.status] || 'Entwurf') + (a.umgebung === 'test' ? ' · Test' : ''),
            esc([k.firma, [k.vorname, k.nachname].filter(Boolean).join(' ')].filter(Boolean).join(', ')) + '<br><span style="color:#888">' + esc(k.email || '') + (k.telefon ? ' · ' + esc(k.telefon) : '') + '<br>' + esc([k.strasse, k.hnr].filter(Boolean).join(' ') + ', ' + [k.plz, k.ort].filter(Boolean).join(' ')) + '</span>',
            esc(a.objekt_text || '–') + (p.flaeche ? '<br><span style="color:#888">' + esc(p.flaeche) + ' m² · ' + esc(p.stufe || '') + '</span>' : ''),
            esc(BES[w.besichtigung] || '–') + (w.express ? ' · Express' : ''),
            p.rabatt ? esc(p.rabatt.text) + ' −' + eur(p.rabatt.betrag) : '–',
            '<b>' + eur(a.endpreis) + '</b>',
            esc(a.request_number || '–'),
            esc(a.benachrichtigung ? (MAIL[a.benachrichtigung.status] || a.benachrichtigung.status) : '–'),
            esc(a.konto || '')
          ].map(function (c) { return '<td style="padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top">' + c + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    } catch (e) { body.innerHTML = '<p style="color:#B8625C">Konnte nicht geladen werden: ' + esc(e.message) + '</p>'; }
  }
  function init() {
    var link = document.querySelector('.nav-link[data-view="gutachtenauftraege"]');
    if (link) link.addEventListener('click', function () { setTimeout(function () { if (!geladen) laden(); }, 30); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
