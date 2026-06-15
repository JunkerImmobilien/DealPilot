'use strict';
/* DealPilotProviderKeys – Settings-Reiter "Externe Anbieter".
   Tresor-UX fuer ImmoMetrica-Token gegen /api/v1/immometrica/credentials. */
(function () {
  var API = '/api/v1/immometrica';

  function tok() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function hdr() { return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok() }; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  function renderPane() {
    return '' +
      '<h3 class="set-section-h">API-Keys externer Anbieter</h3>' +
      '<p class="hint" style="margin-bottom:14px">Hinterlege deine eigenen Zugaenge. Gespeicherte Keys werden maskiert; Anzeigen nur nach Passwort. Ohne Zugang sind die Buttons in der PRE-FLIGHT-Karte ausgegraut.</p>' +
      '<div id="pk-imo" style="border:1px solid rgba(201,168,76,.3);border-radius:12px;padding:14px 15px;background:#FAF9F4">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">' +
          '<span style="font-weight:700;font-size:15px"><span style="color:#C9A84C">Immo</span>Metrica</span>' +
          '<span id="pk-imo-badge" style="margin-left:auto;font-size:11px;font-family:ui-monospace,monospace;padding:3px 9px;border-radius:999px;border:1px solid #ddd;color:#888">…</span>' +
        '</div>' +
        '<p class="hint" style="margin:0 0 12px">Meta-Suche fuer Off-Market-Deals. Erfordert ein <b>Investor-Pro-Abo</b> bei ImmoMetrica – den API-Token findest du dort im Dashboard.</p>' +
        '<div id="pk-imo-body"></div>' +
      '</div>' +
      '<p class="hint" style="margin-top:12px;font-size:11px;color:var(--muted,#5F5E5A)">Weitere Anbieter (PriceHubble) folgen.</p>';
  }

  function setBadge(state) {
    var b = document.getElementById('pk-imo-badge'); if (!b) return;
    if (state === 'on') { b.textContent = 'Verbunden'; b.style.color = '#3FA56C'; b.style.borderColor = '#bfe3cd'; }
    else { b.textContent = 'Nicht verbunden'; b.style.color = '#888'; b.style.borderColor = '#ddd'; }
  }

  function bodyEmpty() {
    return '' +
      '<label style="display:block;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.1em;color:#888;text-transform:uppercase;margin-bottom:5px">API-Token</label>' +
      '<input id="pk-imo-input" type="text" autocomplete="off" spellcheck="false" placeholder="Token aus dem ImmoMetrica-Dashboard" ' +
        'style="width:100%;border:1px solid #ddd;border-radius:8px;padding:10px 11px;font-family:ui-monospace,monospace;font-size:13px">' +
      '<div style="margin-top:11px"><button type="button" class="btn btn-gold" onclick="DealPilotProviderKeys.save()">Speichern &amp; verbinden</button></div>';
  }

  function bodySaved(hint) {
    return '' +
      '<label style="display:block;font-family:ui-monospace,monospace;font-size:10px;letter-spacing:.1em;color:#888;text-transform:uppercase;margin-bottom:5px">API-Token (gespeichert)</label>' +
      '<input id="pk-imo-mask" type="text" disabled value="' + esc('••••••••••••' + (hint || '')) + '" ' +
        'style="width:100%;border:1px solid #ddd;border-radius:8px;padding:10px 11px;font-family:ui-monospace,monospace;font-size:13px;color:#777;background:#f4f3ee">' +
      '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:11px">' +
        '<button type="button" class="btn btn-sm btn-ghost" onclick="DealPilotProviderKeys.reveal()">Anzeigen</button>' +
        '<button type="button" class="btn btn-sm btn-ghost" onclick="DealPilotProviderKeys.copy()">Kopieren</button>' +
        '<button type="button" class="btn btn-sm" style="color:#B86250;border:1px solid #e3c9c4;background:#fff" onclick="DealPilotProviderKeys.del()">Loeschen</button>' +
      '</div>' +
      '<p class="hint" style="margin-top:8px;font-size:11px">Verschluesselt im Backend gespeichert · „Anzeigen" verlangt dein Konto-Passwort.</p>';
  }

  function load() {
    var body = document.getElementById('pk-imo-body');
    if (body) body.innerHTML = '<p class="hint">Lade Status…</p>';
    fetch(API + '/credentials', { headers: hdr() })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var m = (d && d.immometrica) || { exists: false };
        if (m.exists) { document.getElementById('pk-imo-body').innerHTML = bodySaved(m.hint); setBadge('on'); }
        else { document.getElementById('pk-imo-body').innerHTML = bodyEmpty(); setBadge('off'); }
      })
      .catch(function () {
        var b = document.getElementById('pk-imo-body');
        if (b) b.innerHTML = bodyEmpty(); setBadge('off');
      });
  }

  var api = {
    renderPane: renderPane,
    afterRender: load,
    save: function () {
      var inp = document.getElementById('pk-imo-input'); if (!inp) return;
      var v = (inp.value || '').trim(); if (!v) { alert('Bitte Token eingeben.'); return; }
      fetch(API + '/credentials', { method: 'PUT', headers: hdr(), body: JSON.stringify({ token: v }) })
        .then(function (r) { if (!r.ok) throw new Error('save'); return r.json(); })
        .then(function () { load(); if (window.toast) toast('ImmoMetrica verbunden'); })
        .catch(function () { alert('Speichern fehlgeschlagen.'); });
    },
    reveal: function () {
      var pw = prompt('Konto-Passwort zur Anzeige eingeben:'); if (pw == null || pw === '') return;
      fetch(API + '/credentials/reveal', { method: 'POST', headers: hdr(), body: JSON.stringify({ password: pw }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok) { alert(x.j && x.j.error || 'Anzeige fehlgeschlagen.'); return; }
          var m = document.getElementById('pk-imo-mask');
          if (m) { m.value = x.j.token; setTimeout(function () { load(); }, 8000); }
        })
        .catch(function () { alert('Anzeige fehlgeschlagen.'); });
    },
    copy: function () {
      var pw = prompt('Konto-Passwort zum Kopieren eingeben:'); if (pw == null || pw === '') return;
      fetch(API + '/credentials/reveal', { method: 'POST', headers: hdr(), body: JSON.stringify({ password: pw }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok) { alert(x.j && x.j.error || 'Kopieren fehlgeschlagen.'); return; }
          if (navigator.clipboard) navigator.clipboard.writeText(x.j.token);
          if (window.toast) toast('Token kopiert'); else alert('Token kopiert.');
        })
        .catch(function () { alert('Kopieren fehlgeschlagen.'); });
    },
    del: function () {
      if (!confirm('ImmoMetrica-Zugang wirklich loeschen?')) return;
      fetch(API + '/credentials', { method: 'DELETE', headers: hdr() })
        .then(function () { load(); if (window.toast) toast('Zugang geloescht'); })
        .catch(function () { alert('Loeschen fehlgeschlagen.'); });
    },
  };

  window.DealPilotProviderKeys = api;
})();
