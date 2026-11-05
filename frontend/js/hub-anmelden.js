/* ═══════════════════════════════════════════════════════════════════════
   hub-anmelden.js · v3190 — Seite „Makler-Hub mit deinem DealPilot-Konto verbinden"

   Vertrag: Dateien/Makler-Hub/Anmeldung-Schnittstelle.md, Abschnitt 1 (GET /hub/anmelden).
   Der Hub leitet auf https://<app>/hub/anmelden?client_id&redirect_uri&state&code_challenge&code_challenge_method=S256.
   Caddy liefert für jeden unbekannten Pfad die App aus (try_files {path} /index.html) - die Seite ist deshalb
   eine Ebene IN der App: die App erledigt die Anmeldung samt Zwei-Faktor, danach erscheint die Ebene.

   - client_id unbekannt oder redirect_uri nicht freigegeben: Fehlerseite, KEINE Weiterleitung.
   - Paket ohne Makler-Hub: „Paket wählen" statt „Verbinden".
   - „Verbinden": POST /api/v1/hub/code, dann redirect_uri?code=…&state=…
   - „Abbrechen": redirect_uri?error=access_denied&state=…
   Die Parameter liegen zusätzlich 15 Minuten in sessionStorage, falls die Anmeldung die Adresse umschreibt.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var SK = 'dp_hub_anmelden';

  function parameter() {
    var q = new URLSearchParams(location.search);
    if (q.get('hub_anmelden') === '1') {   /* index.html leitet /hub/anmelden?… hierher um (relative Skriptpfade) */
      var p = { client_id: q.get('client_id') || '', redirect_uri: q.get('redirect_uri') || '', state: q.get('state') || '',
        code_challenge: q.get('code_challenge') || '', methode: q.get('code_challenge_method') || '', t: Date.now() };
      try { sessionStorage.setItem(SK, JSON.stringify(p)); } catch (e) {}
      return p;
    }
    try {
      var g = JSON.parse(sessionStorage.getItem(SK) || 'null');
      if (g && Date.now() - g.t < 15 * 60 * 1000) return g;
    } catch (e) {}
    return null;
  }
  var P = parameter();
  if (!P) return;

  function basis() { try { if (window.Auth && typeof Auth.getApiBase === 'function') return Auth.getApiBase(); } catch (e) {} return '/api/v1'; }
  function token() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mit(url, werte) {
    var u = new URL(url);
    Object.keys(werte).forEach(function (k) { if (werte[k] != null && werte[k] !== '') u.searchParams.set(k, werte[k]); });
    return u.toString();
  }
  function fertig() { try { sessionStorage.removeItem(SK); } catch (e) {} }

  function ebene(html) {
    var ov = document.getElementById('dp-hub-ebene');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'dp-hub-ebene';
      ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(10,10,12,.72);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Inter,system-ui,sans-serif';
      document.body.appendChild(ov);
    }
    ov.innerHTML = '<div role="dialog" aria-modal="true" style="width:100%;max-width:460px;background:#FFFFFF;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.35);overflow:hidden">'
      + '<div style="padding:16px 20px;background:#0B0B0D;color:#fff;font:600 15px \'Space Grotesk\',Inter,sans-serif">DealPilot</div>'
      + '<div style="padding:20px">' + html + '</div></div>';
    return ov;
  }
  var KNOPF = 'padding:11px 18px;border-radius:10px;font:600 14px Inter,sans-serif;cursor:pointer';

  function fehlerSeite(grund) {
    fertig();
    ebene('<h2 style="margin:0 0 8px;font:600 19px \'Space Grotesk\',Inter,sans-serif;color:#1a1814">Verbindung nicht möglich</h2>'
      + '<p style="margin:0 0 14px;font-size:13.5px;line-height:1.55;color:#3a352b">' + esc(grund) + '</p>'
      + '<p style="margin:0 0 16px;font-size:12px;color:#6B6356">Aus Sicherheitsgründen wird nicht zurückgeleitet. Bitte im Makler-Hub erneut auf „Mit DealPilot anmelden" klicken.</p>'
      + '<button type="button" id="dp-hub-zu" style="' + KNOPF + ';border:1px solid #CFC9BC;background:#fff;color:#2A2727">Zur App</button>');
    document.getElementById('dp-hub-zu').onclick = function () { var o = document.getElementById('dp-hub-ebene'); if (o) o.remove(); history.replaceState(null, '', '/'); };
  }

  function abbrechen() { fertig(); location.href = mit(P.redirect_uri, { error: 'access_denied', state: P.state }); }

  function verbindenSeite(d) {
    var k = d.konto || {}, p = d.paket || {}, kt = d.kontingent || {};
    var kz = function (a, n) { var x = kt[a]; return x ? n + ' ' + x.rest + ' von ' + x.limit : null; };
    var kont = [kz('mpi', 'Stufe 1'), kz('mpi_plus', 'Stufe 2'), kz('wev', 'Stufe 3')].filter(Boolean).join(' · ');
    var mitHub = !!p.makler_hub;
    ebene('<h2 style="margin:0 0 6px;font:600 19px \'Space Grotesk\',Inter,sans-serif;color:#1a1814">Makler-Hub mit deinem DealPilot-Konto verbinden</h2>'
      + '<div style="margin:12px 0;padding:12px 14px;border:1px solid #E6E0D3;border-radius:10px;background:#FBFAF7;font-size:13px;line-height:1.6;color:#2A2727">'
      + '<b>' + esc(k.name || k.email) + '</b><br>' + esc(k.email) + '<br>Paket: ' + esc(p.plan_id || '–') + (mitHub ? ' · Makler-Hub inklusive · ' + esc(p.plaetze) + ' Platz' + (p.plaetze === 1 ? '' : 'e') : ' · <span style="color:#B8625C">ohne Makler-Hub</span>')
      + (kont ? '<br>Berichte diesen Monat: ' + esc(kont) : '') + '</div>'
      + (mitHub
        ? '<p style="margin:0 0 6px;font-size:12.5px;color:#3a352b">Der Makler-Hub erhält:</p><ul style="margin:0 0 16px;padding-left:18px;font-size:12.5px;line-height:1.6;color:#3a352b"><li>Name und E-Mail</li><li>Paket und Kontingent</li><li>einen API-Schlüssel für Marktberichte (jederzeit widerrufbar)</li></ul>'
          + '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" id="dp-hub-ab" style="' + KNOPF + ';border:1px solid #CFC9BC;background:#fff;color:#2A2727">Abbrechen</button>'
          + '<button type="button" id="dp-hub-ok" style="' + KNOPF + ';border:none;background:var(--wl-c9a84c, #C9A84C);color:#050505">Verbinden</button></div>'
        : '<p style="margin:0 0 16px;font-size:13px;line-height:1.55;color:#3a352b">Der Makler-Hub ist im Partner-Paket enthalten. Wähle das Paket, danach kannst du hier verbinden.</p>'
          + '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" id="dp-hub-ab" style="' + KNOPF + ';border:1px solid #CFC9BC;background:#fff;color:#2A2727">Abbrechen</button>'
          + '<button type="button" id="dp-hub-paket" style="' + KNOPF + ';border:none;background:var(--wl-c9a84c, #C9A84C);color:#050505">Paket wählen</button></div>')
      + '<div id="dp-hub-meld" style="margin-top:10px;font-size:12px;color:#B8625C"></div>');
    document.getElementById('dp-hub-ab').onclick = abbrechen;
    var pk = document.getElementById('dp-hub-paket');
    if (pk) pk.onclick = function () { var o = document.getElementById('dp-hub-ebene'); if (o) o.style.display = 'none'; if (typeof window.openPricingModal === 'function') window.openPricingModal(); };
    var ok = document.getElementById('dp-hub-ok');
    if (ok) ok.onclick = function () {
      ok.disabled = true; ok.textContent = 'Verbinde …';
      fetch(basis() + '/hub/code', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
        body: JSON.stringify({ client_id: P.client_id, redirect_uri: P.redirect_uri, code_challenge: P.code_challenge }) })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (x) {
          if (x.s !== 200 || !x.j.code) throw new Error((x.j && x.j.error) || ('Fehler ' + x.s));
          fertig();
          location.href = mit(P.redirect_uri, { code: x.j.code, state: P.state });
        })
        .catch(function (e) { ok.disabled = false; ok.textContent = 'Verbinden'; document.getElementById('dp-hub-meld').textContent = 'Nicht verbunden: ' + e.message; });
    };
  }

  var gezeigt = false;
  function versuchen() {
    if (gezeigt || !token()) return;
    fetch(basis() + '/hub/status', { headers: { Authorization: 'Bearer ' + token() } })
      .then(function (r) { if (r.status === 401) return null; return r.json(); })
      .then(function (d) { if (!d || gezeigt) return; gezeigt = true; verbindenSeite(d); })
      .catch(function () {});
  }

  function start() {
    if (P.methode && P.methode !== 'S256') return fehlerSeite('Nur das Verfahren S256 wird unterstützt.');
    if (!P.state || !P.code_challenge) return fehlerSeite('Die Anfrage des Makler-Hubs ist unvollständig.');
    fetch(basis() + '/hub/pruefen?client_id=' + encodeURIComponent(P.client_id) + '&redirect_uri=' + encodeURIComponent(P.redirect_uri))
      .then(function (r) { return r.json(); })
      .then(function (p) {
        if (!p || !p.ok) return fehlerSeite((p && p.grund) || 'Die Anfrage konnte nicht geprüft werden.');
        versuchen();
        /* nicht angemeldet: die App zeigt ihre Anmeldung (mit Zwei-Faktor) - danach geht es hier weiter */
        try { window.addEventListener('dp:plan-ready', versuchen); } catch (e) {}
        var n = 0, iv = setInterval(function () { versuchen(); if (gezeigt || ++n > 300) clearInterval(iv); }, 2000);
      })
      .catch(function () { fehlerSeite('Die Anfrage konnte nicht geprüft werden.'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
