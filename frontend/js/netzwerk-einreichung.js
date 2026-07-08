/* ============================================================================
   DealPilot v856 – netzwerk-einreichung.js  (NEU, additiv, laedt nach settings.js)
   Settings-Tab "Netzwerk-Partner" (nur Pro-Plan aktiv, sonst Teaser):
   Pro-Nutzer reichen eine Partnerkarte ein (Kategorie aus Bestand ODER
   Wunsch-Kategorie als Freitext, Logo-Upload mit Auto-Verkleinerung).
   Die Karte landet als "eingereicht" (nicht sichtbar) — Freigabe im Admin.
   Tab-Injektion per MutationObserver: klont den Mandanten-Tab (gleiche Optik),
   Pane haengt sich in .pane-wrap, _swSet uebernimmt das Umschalten generisch.
   ============================================================================ */
(function () {
  'use strict';
  var PANE = 'netzwerkpartner';
  var _logoData = '';
  var _cats = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function toast(m) { try { if (typeof window.toast === 'function') window.toast(m); } catch (e) {} }
  function token() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function isPro() {
    try {
      if (window.DealPilotConfig && DealPilotConfig.pricing && typeof DealPilotConfig.pricing.currentKey === 'function') {
        return DealPilotConfig.pricing.currentKey() === 'pro';
      }
    } catch (e) {}
    return false;
  }
  function fileToDataUrl(file, maxPx, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var f = Math.min(1, maxPx / Math.max(img.width, img.height));
        var cw = Math.max(1, Math.round(img.width * f)), ch = Math.max(1, Math.round(img.height * f));
        var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
        cb(cv.toDataURL('image/png'));
      };
      img.onerror = function () { toast('Bild konnte nicht gelesen werden'); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function loadCats(cb) {
    if (_cats) return cb(_cats);
    var headers = {};
    var t = token(); if (t) headers['Authorization'] = 'Bearer ' + t;
    fetch('/api/v1/network-cards', { headers: headers })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (d) { _cats = (d && d.categories) || []; cb(_cats); })
      .catch(function () { cb([]); });
  }

  function paneHtml() {
    if (!isPro()) {
      return '' +
        '<h2 class="set-section-h2">Netzwerk-Partner werden</h2>' +
        '<div style="margin-top:14px;padding:20px 22px;border:1px solid var(--gold,#C9A84C);border-radius:14px;background:#FAF9F4">' +
          '<div style="font:700 13px/1 \'Space Grotesk\',sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:#b8932f;margin-bottom:8px">Pro-Funktion</div>' +
          '<p style="margin:0 0 14px;color:#2A2727;font-size:14px;line-height:1.55">Als <b>Pro</b>-Nutzer kannst du eine eigene Partnerkarte f\u00fcr das DealPilot-Netzwerk einreichen \u2014 sichtbar f\u00fcr alle Investoren im Deal-Aktion-Tab, direkt im Moment der Finanzierungs- und Gutachten-Entscheidung.</p>' +
          '<button type="button" class="btn btn-gold" onclick="(function(){var b=document.querySelector(\'.st-tab[data-tab=&quot;plan&quot;]\');if(b)b.click();})()">Pro freischalten</button>' +
        '</div>';
    }
    return '' +
      '<h2 class="set-section-h2">Netzwerk-Partner werden</h2>' +
      '<p class="hint">Reiche deine Partnerkarte f\u00fcr das DealPilot-Netzwerk ein (Deal-Aktion-Tab). Jede Karte wird von DealPilot <b>gepr\u00fcft und freigegeben</b>, bevor sie erscheint \u2014 du bekommst R\u00fcckmeldung per E-Mail.</p>' +
      '<div style="display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:22px;align-items:start;margin-top:14px" class="dpne-grid">' +
      '<div id="dpne-form" style="display:grid;gap:12px;min-width:0">' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div><label class="dpne-l">Kategorie</label><select id="dpne-kat" class="dpne-i"></select></div>' +
          '<div><label class="dpne-l">\u2026 oder Wunsch-Kategorie (neu)</label><input id="dpne-wunsch" class="dpne-i" placeholder="z.B. Steuerberater"></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div><label class="dpne-l">Name *</label><input id="dpne-name" class="dpne-i" placeholder="Firmenname"></div>' +
          '<div><label class="dpne-l">Rolle / Untertitel</label><input id="dpne-rolle" class="dpne-i" placeholder="z.B. Baufinanzierung"></div>' +
        '</div>' +
        '<div><label class="dpne-l">Beschreibung</label><textarea id="dpne-desc" class="dpne-i" style="min-height:60px;resize:vertical" placeholder="Kurzer Nutzen-Satz f\u00fcr Investoren \u2026"></textarea></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div><label class="dpne-l">Tags (Komma-getrennt)</label><input id="dpne-tags" class="dpne-i" placeholder="ungebunden, bundesweit"></div>' +
          '<div><label class="dpne-l">Webseite</label><input id="dpne-web" class="dpne-i" placeholder="deine-website.de"></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
          '<div><label class="dpne-l">Ziel-E-Mail f\u00fcr Anfragen *</label><input id="dpne-email" class="dpne-i" placeholder="anfragen@firma.de"></div>' +
          '<div><label class="dpne-l">Akzentfarbe</label><input id="dpne-akzent" type="color" value="#5a9bc4" class="dpne-i" style="height:38px;padding:2px"></div>' +
        '</div>' +
        '<div><label class="dpne-l">Logo (PNG/JPG, wird verkleinert)</label>' +
          '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input type="file" id="dpne-logo" accept="image/*" style="font-size:12px"><span id="dpne-logo-st" style="font-size:11px;color:#7A7370">kein Logo</span></div></div>' +
        '<div style="font-size:11.5px;color:#7A7370;line-height:1.5">Mit dem Einreichen best\u00e4tigst du, dass du zur Nutzung von Namen und Logo berechtigt bist. Optik (Kante, Hintergrund) gestaltet DealPilot im Rahmen der Freigabe.</div>' +
        '<div><button type="button" class="btn btn-gold" id="dpne-send">Karte zur Pr\u00fcfung einreichen</button></div>' +
      '</div>' +
      '<div><div style="font:700 10px/1 \'Space Grotesk\',sans-serif;letter-spacing:1.2px;text-transform:uppercase;color:#b8932f;margin-bottom:9px">Live-Vorschau</div><div id="dpne-preview"></div></div>' +
      '</div>' +
      '<div id="dpne-done" style="display:none;margin-top:14px;padding:18px 20px;border:1px solid #3FA56C;border-radius:12px;background:#f2faf5;color:#2A2727">' +
        '<b style="color:#3FA56C">\u2713 Eingereicht!</b> Deine Karte liegt jetzt bei DealPilot zur Pr\u00fcfung. Nach der Freigabe erscheint sie im Deal-Aktion-Tab \u2014 du bekommst eine R\u00fcckmeldung per E-Mail.' +
      '</div>';
  }

  function renderPreview(pane) {
    var host = pane.querySelector('#dpne-preview');
    if (!host) return;
    var v = function (id) { var e = pane.querySelector('#' + id); return e ? String(e.value || '').trim() : ''; };
    var acc = v('dpne-akzent') || '#5a9bc4';
    var name = v('dpne-name') || 'Dein Firmenname';
    var kz = (name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3) || 'DP').toUpperCase();
    var tags = v('dpne-tags').split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 4)
      .map(function (t) { return '<span style="font:500 9px/1.4 \'JetBrains Mono\',monospace;padding:2px 7px;border-radius:5px;background:#F8F6F1;color:#9a7f33;border:1px solid rgba(201,168,76,.22);white-space:nowrap">' + esc(t) + '</span>'; }).join('');
    var web = v('dpne-web') ? '<div style="font:500 9.5px/1 \'JetBrains Mono\',monospace;color:#9a7f33;margin-bottom:8px">\ud83c\udf10 ' + esc(v('dpne-web').replace(/^https?:\/\//i, '')) + '</div>' : '';
    var logo = _logoData
      ? '<img src="' + _logoData + '" alt="" style="width:100%;height:100%;object-fit:cover;background:#fff">'
      : '<span style="color:#fff;font:700 22px \'Space Grotesk\',sans-serif">' + esc(kz) + '</span>';
    host.innerHTML =
      '<div style="display:flex;background:#fff;color:#2A2727;border:1px solid rgba(201,168,76,.28);border-radius:15px;overflow:hidden;box-shadow:0 4px 16px rgba(42,39,39,.09);font-family:Inter,sans-serif">' +
        '<div style="flex:1;padding:14px;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">' +
            '<div style="width:64px;height:64px;border-radius:12px;flex-shrink:0;overflow:hidden;border:1px solid rgba(42,39,39,.1);background:' + esc(acc) + ';display:flex;align-items:center;justify-content:center">' + logo + '</div>' +
            '<div style="min-width:0"><div style="font:700 13px/1.2 \'Space Grotesk\',sans-serif">' + esc(name) + ' <span style="font:700 8px/1 sans-serif;letter-spacing:.4px;text-transform:uppercase;color:#3FA56C;background:rgba(63,165,108,.1);border:1px solid rgba(63,165,108,.3);border-radius:99px;padding:2px 6px;vertical-align:2px">\u2713 Gepr\u00fcft</span></div>' +
            '<div style="font-size:10px;color:#7A7370;margin-top:2px">' + esc(v('dpne-rolle') || 'Rolle / Untertitel') + '</div></div>' +
          '</div>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">' + tags + '</div>' +
          '<div style="font-size:11px;color:#7A7370;line-height:1.5;margin-bottom:8px">' + esc(v('dpne-desc') || 'Beschreibung \u2026') + '</div>' +
          web +
          '<div style="border:none;border-radius:9px;padding:8px;background:linear-gradient(110deg,' + esc(acc) + ',#333);color:#fff;text-align:center;font:700 12px \'Space Grotesk\',sans-serif">Anfrage senden</div>' +
        '</div>' +
        '<div style="width:0;border-left:2px dashed rgba(42,39,39,.16)"></div>' +
        '<div style="width:46px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#F8F6F1;color:' + esc(acc) + '">' +
          '<span style="writing-mode:vertical-rl;font:700 9px \'JetBrains Mono\',monospace;letter-spacing:2px">' + esc(kz) + '</span>' +
          '<span style="width:20px;height:36px;background:repeating-linear-gradient(0deg,#2A2727 0 1.5px,transparent 1.5px 3px);opacity:.5;border-radius:2px"></span>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:10.5px;color:#7A7370;margin-top:8px;line-height:1.5">Finale Optik (Abrisskante, Hintergrund) gestaltet DealPilot bei der Freigabe.</div>';
  }
  function wirePane(pane) {
    if (!isPro()) return;
    loadCats(function (cats) {
      var sel = pane.querySelector('#dpne-kat');
      if (sel) sel.innerHTML = (cats.length ? cats : [{ key: 'finanzierung', label: 'Finanzierung & Banken' }, { key: 'gutachter', label: 'Gutachter & Sachverstaendige' }])
        .map(function (c) { return '<option value="' + esc(c.key) + '">' + esc(c.label) + '</option>'; }).join('');
    });
    renderPreview(pane);
    ['dpne-kat', 'dpne-wunsch', 'dpne-name', 'dpne-rolle', 'dpne-desc', 'dpne-tags', 'dpne-web', 'dpne-email', 'dpne-akzent'].forEach(function (id) {
      var e = pane.querySelector('#' + id);
      if (e) { e.addEventListener('input', function () { renderPreview(pane); }); e.addEventListener('change', function () { renderPreview(pane); }); }
    });
    var lf = pane.querySelector('#dpne-logo');
    if (lf) lf.addEventListener('change', function () {
      if (!lf.files || !lf.files[0]) return;
      fileToDataUrl(lf.files[0], 240, function (durl) {
        _logoData = durl;
        var st = pane.querySelector('#dpne-logo-st'); if (st) st.textContent = '\u2713 Logo \u00fcbernommen';
        renderPreview(pane);
      });
    });
    var btn = pane.querySelector('#dpne-send');
    if (btn) btn.addEventListener('click', function () {
      var v = function (id) { var e = pane.querySelector('#' + id); return e ? String(e.value || '').trim() : ''; };
      if (!v('dpne-name')) { toast('Bitte Name angeben'); return; }
      if (!v('dpne-email')) { toast('Bitte Ziel-E-Mail angeben'); return; }
      btn.disabled = true; btn.textContent = 'Wird eingereicht \u2026';
      var headers = { 'Content-Type': 'application/json' };
      var t = token(); if (t) headers['Authorization'] = 'Bearer ' + t;
      fetch('/api/v1/network-cards/einreichen', {
        method: 'POST', headers: headers,
        body: JSON.stringify({
          kategorie: v('dpne-kat') || 'finanzierung',
          wunsch_kategorie: v('dpne-wunsch'),
          name: v('dpne-name'), rolle: v('dpne-rolle'),
          beschreibung: v('dpne-desc'), tags: v('dpne-tags'),
          website: v('dpne-web'), ziel_email: v('dpne-email'),
          akzent: v('dpne-akzent') || '#5a9bc4', logo_data: _logoData
        })
      }).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
        .then(function () {
          var f = pane.querySelector('#dpne-form'), d = pane.querySelector('#dpne-done');
          if (f) f.style.display = 'none';
          if (d) d.style.display = 'block';
          toast('Karte eingereicht \u2708');
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = 'Karte zur Pr\u00fcfung einreichen';
          toast('Einreichen fehlgeschlagen \u2014 bitte sp\u00e4ter erneut versuchen.');
        });
    });
  }

  function injectCss() {
    if (document.getElementById('dpne-css')) return;
    var st = document.createElement('style');
    st.id = 'dpne-css';
    st.textContent = '.dpne-l{display:block;font-size:12px;font-weight:700;color:#555;margin-bottom:4px}' +
      '.dpne-i{width:100%;padding:8px 10px;border:1px solid #d8d2c6;border-radius:7px;font:inherit;font-size:13px;box-sizing:border-box;background:#fff}' +
      '@media(max-width:980px){.dpne-grid{grid-template-columns:1fr !important}}';
    document.head.appendChild(st);
  }

  function ensureTab() {
    var tabs = document.querySelector('.settings-tabs');
    if (!tabs) return;
    if (tabs.querySelector('.st-tab[data-tab="' + PANE + '"]')) return;
    var src = tabs.querySelector('.st-tab[data-tab="mandanten"]') || tabs.querySelector('.st-tab[data-tab="plan"]');
    if (!src) return;
    var wrap = document.querySelector('.pane-wrap');
    if (!wrap) return;
    injectCss();
    var btn = src.cloneNode(true);
    btn.setAttribute('data-tab', PANE);
    if (btn.dataset) btn.dataset.tab = PANE;
    btn.classList.remove('active');
    var title = btn.querySelector('.help-sidebar-item-title');
    if (title) title.textContent = 'Netzwerk-Partner'; else btn.textContent = 'Netzwerk-Partner';
    /* v857: geklonten Untertitel ("Steuerregime, Buchhaltung") korrigieren */
    try {
      var els = btn.querySelectorAll('span,div,small,p');
      for (var i = 0; i < els.length; i++) {
        if (els[i] !== title && els[i].children.length === 0 && els[i].textContent && els[i].textContent !== 'Netzwerk-Partner') {
          els[i].textContent = 'Partnerkarte einreichen';
        }
      }
    } catch (e) {}
    src.parentNode.insertBefore(btn, src.nextSibling);
    btn.addEventListener('click', function () {
      setTimeout(function () {
        var t = document.getElementById('set-band-title'), s = document.getElementById('set-band-sub');
        if (t) t.textContent = 'Netzwerk-Partner';
        if (s) s.textContent = 'Deine Partnerkarte f\u00fcr das DealPilot-Netzwerk einreichen.';
        var p = document.querySelector('.st-pane[data-pane="' + PANE + '"]');
        if (p && !p.getAttribute('data-wired')) { p.setAttribute('data-wired', '1'); wirePane(p); }
      }, 30);
    });
    var pane = document.createElement('div');
    pane.className = 'st-pane';
    pane.setAttribute('data-pane', PANE);
    pane.style.display = 'none';
    pane.innerHTML = paneHtml();
    wrap.appendChild(pane);
  }

  var mo = new MutationObserver(function () { try { ensureTab(); } catch (e) {} });
  function boot() {
    return; /* v893p-off: Netzwerk-Partner-Tab vorerst aus den Einstellungen entfernt (spaeter: return raus) */
    try { mo.observe(document.body, { childList: true, subtree: true }); ensureTab(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
