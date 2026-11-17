/* avv-zustimmung.js · v3620 — Auftragsverarbeitungsvertrag (AVV) abhaken, Art. 28 DSGVO (Marcel 17.11.2026)
 *
 * Version, Stand, Link und Haekchentext kommen vom Server (GET /consent/avv, services/avvService.js),
 * nicht aus dieser Datei - eine zweite Versionsnummer im Browser liefe beim naechsten Hochziehen auseinander.
 *
 *   DpAvv.stand()            -> Promise { version, stand, link, text, zugestimmt, aktuell }
 *   DpAvv.haekchenHtml(st)   -> Text mit Link fuer das Kauf-Fenster (DpWiderruf.einholen(..., { zusatz }))
 *   DpAvv.einholen(st)       -> Fenster fuer bestehende Partner (Partner-Cockpit), schreibt POST /consent/avv,
 *                               Promise true (abgeschlossen) | false (nicht jetzt)
 */
(function () {
  'use strict';
  function api(p, o) { return Auth.apiCall(p, o || {}); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function datum(iso) { var t = String(iso || '').split('-'); return t.length === 3 ? t[2] + '.' + t[1] + '.' + t[0] : String(iso || ''); }

  function stand() { return api('/consent/avv'); }

  function haekchenHtml(st) {
    /* v3620b · Linkfarbe ausdruecklich: im Fenster kam sonst das Browser-Blau an (gemessen im Screenshot) */
    return 'Ich schließe den <a href="' + esc(st.link) + '" target="_blank" rel="noopener" style="color:var(--wl-b8932f, #b8932f);text-decoration:underline">Auftragsverarbeitungsvertrag</a> (Version ' +
      esc(st.version) + ' vom ' + esc(datum(st.stand)) + ') mit Junker Solution ab.';
  }

  function einholen(st) {
    return new Promise(function (fertig) {
      var alt = document.getElementById('dp-avv'); if (alt) alt.remove();
      var neu = !!(st.zugestimmt && st.zugestimmt.version && st.zugestimmt.version !== st.version);
      var w = document.createElement('div');
      w.id = 'dp-avv';
      w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'dp-avv-titel');
      w.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(5,5,5,.72);padding:16px';
      w.innerHTML =
        '<div style="max-width:540px;width:100%;max-height:calc(100vh - 32px);overflow:auto;background:#FDFCFA;color:#1a1a1a;border-radius:14px;border-top:4px solid var(--wl-c9a84c, #C9A84C);padding:22px 22px 18px;font:14px/1.5 Inter,system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.4)">'
        + '<div style="font:600 11px/1 \'JetBrains Mono\',monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--wl-b8932f, #b8932f);margin-bottom:8px">Partner-Cockpit · Datenschutz</div>'
        + '<div id="dp-avv-titel" style="font:700 18px/1.3 \'Space Grotesk\',Inter,sans-serif;margin-bottom:10px">' + (neu ? 'Neue Version des Auftragsverarbeitungsvertrags' : 'Auftragsverarbeitungsvertrag abschließen') + '</div>'
        + '<p style="margin:0 0 12px">' + (neu
            ? 'Der Vertrag liegt in Version ' + esc(st.version) + ' vor. Du hattest Version ' + esc(st.zugestimmt.version) + ' abgeschlossen. Bitte lies die neue Fassung und schließe sie ab.'
            : 'Im Partner-Cockpit verarbeitest du Daten deiner Kunden in DealPilot. Dafür schließen wir einen Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO. Das geht hier mit einem Häkchen, der elektronische Abschluss ist nach Art. 28 Abs. 9 DSGVO zulässig.')
        + '</p>'
        + '<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer">'
        + '<input type="checkbox" id="dp-avv-cb" style="margin-top:3px;width:18px;height:18px;flex:0 0 auto;accent-color:var(--wl-c9a84c, #C9A84C)">'
        + '<span>' + haekchenHtml(st) + '</span></label>'
        + '<div style="font-size:12px;color:#666;margin-top:10px">Gespeichert werden dein Konto, die Version und der Zeitpunkt. Den Vertrag kannst du jederzeit unter dem Link lesen und als PDF drucken.</div>'
        + '<div id="dp-avv-fehler" style="display:none;font-size:13px;color:#B8625C;margin-top:10px"></div>'
        + '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap">'
        + '<button type="button" id="dp-avv-nein" style="padding:9px 16px;border-radius:8px;border:1px solid #ccc;background:#fff;color:#1a1a1a;cursor:pointer">Nicht jetzt</button>'
        + '<button type="button" id="dp-avv-ja" disabled style="padding:9px 16px;border-radius:8px;border:0;background:var(--wl-c9a84c, #C9A84C);color:#050505;font-weight:600;cursor:pointer;opacity:.5">Abschließen und weiter</button>'
        + '</div></div>';
      document.body.appendChild(w);
      var cb = w.querySelector('#dp-avv-cb'), ja = w.querySelector('#dp-avv-ja'), f = w.querySelector('#dp-avv-fehler');
      cb.addEventListener('change', function () { ja.disabled = !cb.checked; ja.style.opacity = cb.checked ? '1' : '.5'; });
      function zu(erg) { w.remove(); fertig(erg); }
      w.querySelector('#dp-avv-nein').addEventListener('click', function () { zu(false); });
      ja.addEventListener('click', function () {
        if (!cb.checked) return;
        ja.disabled = true; ja.textContent = 'Speichert …';
        api('/consent/avv', { method: 'POST', body: { zugestimmt: true, version: st.version, weg: 'cockpit' } }).then(function (r) {
          if (r && r.aktuell) return zu(true);
          throw new Error('Die Zustimmung wurde nicht gespeichert.');
        }).catch(function (e) {
          f.style.display = ''; f.textContent = (e && e.data && e.data.message) || (e && e.message) || 'Das hat nicht geklappt.';
          ja.disabled = false; ja.textContent = 'Abschließen und weiter';
        });
      });
    });
  }

  window.DpAvv = { stand: stand, haekchenHtml: haekchenHtml, einholen: einholen };
})();
