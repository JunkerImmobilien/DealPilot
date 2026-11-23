'use strict';
/* ═══ js/vivi-import.js — v4050 · OBJEKTE AUS ViVi ÜBERNEHMEN ═══════════════════════════════════════════════════
 *
 * Marcel 23.11.2026: „haben wir dann alle wichtigen Sachen, wenn wir ein Objekt aus ViVi übernehmen … kann man das auch
 * rückwirkend machen? Sodass wir dann auch irgendwie einen Ankauf einfrieren können? … wie macht man das aus den
 * Einstellungen heraus … welche Objekte man alle übernehmen möchte? Ob alle, nur einzelne?“
 *
 * Zwei Teile:
 *   karte(host)            Einstellungen › Externe Anbieter › ViVi: Liste der ViVi-Objekte ohne Verknüpfung, Häkchen
 *                          (alle oder einzeln), Übernehmen mit Fortschritt, danach je Objekt „öffnen“ und was für die
 *                          Bewertung noch fehlt. Backend: GET /vivi/importierbar, POST /vivi/importieren (ein Objekt je Aufruf).
 *   vorAnwenden(key, r)    js/vivi.js ruft es, BEVOR die Werte von heute aus ViVi gesetzt werden. Beim ersten Öffnen eines
 *                          importierten Objekts steht im Formular der Stand ZUM KAUFDATUM (viviMapping.importDaten). Genau
 *                          der wird hier als Ankauf festgeschrieben (Stichtag = Kaufdatum), mit Vermerk „rückwirkend aus
 *                          ViVi“. Danach legt js/vivi.js die Werte von heute darüber, und das Speichern nimmt beides mit.
 *
 * Der Ankauf wird von den echten Kernen gerechnet (calc), nicht hier. Vorher wird auf die Steuergrundlagen gewartet,
 * damit der Cashflow nach Steuern nicht vorläufig eingefroren wird (DpSteuerGrundlagen, wk-aggregator.js).
 * Kundentexte ohne Gedankenstrich und Semikolon, keine Datenquellennamen.
 * ═════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DpViviImport) return;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function api(pfad, opt) {
    if (!(window.Auth && typeof window.Auth.apiCall === 'function')) return Promise.reject(new Error('Nicht angemeldet'));
    return window.Auth.apiCall(pfad, opt || { method: 'GET' });
  }
  function datum(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function eur(n) { return n == null ? '' : Math.round(n).toLocaleString('de-DE') + ' €'; }
  var ART = { ETW: 'Wohnung', EFH: 'Haus', ZFH: 'Zweifamilienhaus', MFH: 'Mehrfamilienhaus', GESCH: 'Gewerbe', GRST: 'Grundstück' };

  function stil() {
    if ($('vivi-import-stil')) return;
    var s = document.createElement('style'); s.id = 'vivi-import-stil';
    s.textContent = [
      '#pk-vivi-import{margin-top:14px;padding-top:12px;border-top:1px solid rgba(42,39,39,.1)}',
      '#pk-vivi-import .vi-kopf{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:space-between}',
      '#pk-vivi-import .vi-titel{font-weight:700;font-size:14px}',
      '#pk-vivi-import .vi-liste{margin-top:10px;display:flex;flex-direction:column;gap:6px}',
      '#pk-vivi-import .vi-zeile{display:grid;grid-template-columns:22px 1fr auto;gap:4px 10px;align-items:start;padding:8px 10px;border:1px solid rgba(42,39,39,.1);border-radius:9px;font-size:12.5px;line-height:1.4}',
      '#pk-vivi-import .vi-zeile input{margin-top:3px}',
      '#pk-vivi-import .vi-name{font-weight:600}',
      '#pk-vivi-import .vi-info{color:#7A7370;font-size:11.5px}',
      '#pk-vivi-import .vi-fehlt{color:#7A7370;font-size:11.5px;grid-column:2/4}',
      '#pk-vivi-import .vi-st{font:600 10.5px/1.2 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.04em;white-space:nowrap}',
      '#pk-vivi-import .vi-st.ok{color:#3FA56C}#pk-vivi-import .vi-st.err{color:#B8625C}',
      '#pk-vivi-import .vi-fuss{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}',
      '#pk-vivi-import .vi-alle{display:flex;gap:6px;align-items:center;font-size:12px}',
      '@media (max-width:640px){#pk-vivi-import .vi-zeile{grid-template-columns:22px 1fr}#pk-vivi-import .vi-st{grid-column:2}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Einstellungen ─────────────────────────────────────────────── */
  var _liste = [], _laeuft = false;
  function frei() {
    return (window.DpVorschau && typeof window.DpVorschau.frei === 'function') ? window.DpVorschau.frei('vivi').catch(function () { return false; }) : Promise.resolve(false);
  }
  function karte(host) {
    if (!host) return;
    frei().then(function (ok) { if (ok) karteZeichnen(host); else host.innerHTML = ''; });
  }
  function karteZeichnen(host) {
    stil();
    host.innerHTML = '<div id="pk-vivi-import"><div class="vi-kopf"><span class="vi-titel">Objekte aus ViVi übernehmen</span>'
      + '<button type="button" class="btn btn-sm btn-ghost" data-vi="laden">ViVi-Objekte anzeigen</button></div>'
      + '<p class="hint" style="margin:4px 0 0">Objekte, die schon in ViVi verwaltet werden, legst du hier als Bestandsobjekte in DealPilot an. Der Ankauf wird rückwirkend zum Kaufdatum festgeschrieben, danach kommen die Werte von heute aus ViVi. ViVi wird dabei nur gelesen.</p>'
      + '<div id="vi-inhalt"></div></div>';
  }
  function laden() {
    var z = $('vi-inhalt'); if (!z) return;
    z.innerHTML = '<p class="hint">Frage ViVi, das kann bei vielen Objekten eine Minute dauern…</p>';
    api('/vivi/importierbar', { method: 'GET', timeout: 120000 }).then(function (r) {
      _liste = (r && r.objekte) || [];
      zeichnen(r || {});
    }).catch(function (e) { z.innerHTML = '<p class="hint">' + esc((e && e.message) || 'ViVi ist gerade nicht erreichbar.') + '</p>'; });
  }
  function zeichnen(r) {
    var z = $('vi-inhalt'); if (!z) return;
    if (!_liste.length) {
      z.innerHTML = '<p class="hint" style="margin-top:8px">In ViVi gibt es kein Objekt, das noch nicht mit DealPilot verknüpft ist.' + (r.verknuepft ? ' Verknüpft sind ' + r.verknuepft + '.' : '') + '</p>';
      return;
    }
    var html = '<div class="vi-liste">' + _liste.map(function (o, i) {
      var info = [ART[o.objart] || 'Art unbekannt', o.einheiten + (o.einheiten === 1 ? ' Einheit' : ' Einheiten') + ', ' + o.vermietet_heute + ' vermietet',
        o.kaufdatum ? 'gekauft ' + datum(o.kaufdatum) : 'ohne Kaufdatum', o.kaufpreis ? eur(o.kaufpreis) : 'ohne Kaufpreis',
        o.miete_heute ? 'Miete heute ' + eur(o.miete_heute) : null].filter(Boolean).join(' · ');
      return '<label class="vi-zeile" data-vi-zeile="' + i + '"><input type="checkbox" data-vi-wahl="' + i + '"' + (o.importierbar ? '' : ' disabled') + '>'
        + '<span><span class="vi-name">' + esc(o.name || 'ViVi-Objekt') + '</span><br><span class="vi-info">' + esc(info) + '</span></span>'
        + '<span class="vi-st" data-vi-st="' + i + '">' + (o.importierbar ? '' : esc(o.grund || 'nicht möglich')) + '</span>'
        + (o.fehlt && o.fehlt.length ? '<span class="vi-fehlt">Für die Bewertung fehlt danach noch: ' + esc(o.fehlt.join(', ')) + '</span>' : '')
        + '</label>';
    }).join('') + '</div>'
      + (r.weitere ? '<p class="hint">Weitere ' + r.weitere + ' Objekte folgen nach dem Übernehmen dieser.</p>' : '')
      + '<div class="vi-fuss"><label class="vi-alle"><input type="checkbox" data-vi="alle"> Alle auswählen</label>'
      + '<button type="button" class="btn btn-sm btn-gold" data-vi="los" disabled>Übernehmen</button>'
      + '<span class="hint" id="vi-fortschritt"></span></div>';
    z.innerHTML = html;
  }
  function gewaehlt() {
    return Array.prototype.filter.call(document.querySelectorAll('#pk-vivi-import [data-vi-wahl]'), function (c) { return c.checked && !c.disabled; })
      .map(function (c) { return +c.getAttribute('data-vi-wahl'); });
  }
  function knopf() {
    var b = document.querySelector('#pk-vivi-import [data-vi="los"]'); if (!b) return;
    var n = gewaehlt().length;
    b.disabled = _laeuft || !n;
    b.textContent = n > 1 ? n + ' Objekte übernehmen' : 'Übernehmen';
  }
  function los() {
    var L = gewaehlt(); if (!L.length || _laeuft) return;
    _laeuft = true; knopf();
    var fort = $('vi-fortschritt'), fertig = 0, fehler = 0;
    var schritt = function (k) {
      if (k >= L.length) {
        _laeuft = false; knopf();
        if (fort) fort.textContent = fertig + ' übernommen' + (fehler ? ', ' + fehler + ' nicht' : '') + '.';
        try { if (typeof window.renderSaved === 'function') window.renderSaved({ forceFresh: true, _immediate: true }); } catch (e) {}
        return;
      }
      var i = L[k], o = _liste[i], st = document.querySelector('#pk-vivi-import [data-vi-st="' + i + '"]');
      if (fort) fort.textContent = (k + 1) + ' von ' + L.length + ': ' + (o.name || '') + ' …';
      if (st) { st.className = 'vi-st'; st.textContent = 'läuft'; }
      api('/vivi/importieren', { method: 'POST', body: { vivi_id: o.vivi_id }, timeout: 180000 }).then(function (r) {
        fertig++;
        var c = document.querySelector('#pk-vivi-import [data-vi-wahl="' + i + '"]'); if (c) { c.checked = false; c.disabled = true; }
        if (st) {
          st.className = 'vi-st ok';
          st.innerHTML = esc((r.seq || '') + ' angelegt') + ' · <a href="#" data-vi-oeffnen="' + esc(r.objekt_id) + '">öffnen</a>';
        }
        var zl = document.querySelector('#pk-vivi-import [data-vi-zeile="' + i + '"]');
        var fe = zl && zl.querySelector('.vi-fehlt');
        var t = (r.fehlt_bewertung || []).map(function (x) { return x.text; });
        var satz = 'Ankauf zum ' + datum(r.stichtag) + ' festgeschrieben, sobald du das Objekt öffnest.' + (t.length ? ' Für die Bewertung fehlt noch: ' + t.join(', ') + '.' : '')
          + (r.abgleich && !r.abgleich.ok ? ' Die Werte von heute kommen beim nächsten Abgleich.' : '');
        if (fe) fe.textContent = satz;
        else if (zl) { var sp = document.createElement('span'); sp.className = 'vi-fehlt'; sp.textContent = satz; zl.appendChild(sp); }
      }).catch(function (e) {
        fehler++;
        if (st) { st.className = 'vi-st err'; st.textContent = (e && e.message) || 'Fehler'; }
      }).then(function () { schritt(k + 1); });
    };
    schritt(0);
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target; if (!t || !t.closest) return;
    var b = t.closest('#pk-vivi-import [data-vi]');
    if (b) {
      var was = b.getAttribute('data-vi');
      if (was === 'laden') { ev.preventDefault(); laden(); }
      else if (was === 'los') { ev.preventDefault(); los(); }
      else if (was === 'alle') {
        Array.prototype.forEach.call(document.querySelectorAll('#pk-vivi-import [data-vi-wahl]'), function (c) { if (!c.disabled) c.checked = b.checked; });
        knopf();
      }
      return;
    }
    var a = t.closest('#pk-vivi-import [data-vi-oeffnen]');
    if (a) {
      ev.preventDefault();
      var id = a.getAttribute('data-vi-oeffnen');
      try { if (typeof window.closeSettings === 'function') window.closeSettings(); } catch (e) {}
      try { if (typeof window.loadSaved === 'function') window.loadSaved(id); } catch (e) {}
    }
  });
  document.addEventListener('change', function (ev) {
    if (ev.target && ev.target.matches && ev.target.matches('#pk-vivi-import [data-vi-wahl]')) knopf();
  });

  /* ── Ankauf rückwirkend ────────────────────────────────────────── */
  function warten(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function grundlagen() {
    var G = window.DpSteuerGrundlagen;
    if (!G || typeof G.warten !== 'function') return Promise.resolve();
    return Promise.race([Promise.resolve(G.warten()).catch(function () {}), warten(8000)]);
  }
  function gewonnen() { return ($('_deal_won_state') || {}).value === 'true'; }
  /**
   * Wird von js/vivi.js vor dem Setzen der ViVi-Werte gerufen. Gibt ein Promise zurück und wirft nie.
   * Nur bei importierten Objekten (herkunft 'importiert'), gewonnen, ohne Ankauf-Stand.
   */
  function vorAnwenden(key, r) {
    try {
      if (!r || r.herkunft !== 'importiert' || !window.DealPilotAnkauf) return Promise.resolve(false);
      var kauf = r.import && r.import.kaufdatum;
      var A = window.DealPilotAnkauf;
      if (A.vorhanden()) {
        /* schon festgeschrieben (z. B. vom automatischen Einfrieren beim Laden, derselbe Formularstand): nur den Vermerk */
        var a0 = A.stand();
        if (a0 && !a0.vermerk && kauf && a0.stichtag === kauf) { a0.vermerk = 'Rückwirkend aus ViVi zum ' + datum(kauf); a0.quelle = 'vivi-import'; }
        return Promise.resolve(false);
      }
      if (!gewonnen() || !/^\d{4}-\d{2}-\d{2}$/.test(String(kauf || ''))) return Promise.resolve(false);
      return grundlagen().then(function () {
        if (window._currentObjKey !== key || A.vorhanden()) return false;
        try { if (typeof window.calc === 'function') window.calc(); } catch (e) {}
        var a = A.festschreiben(kauf);
        a.vermerk = 'Rückwirkend aus ViVi zum ' + datum(kauf);
        a.quelle = 'vivi-import';
        window._dpAnkaufAuto = true;
        try { if (typeof window.toast === 'function') window.toast('✓ Ankauf rückwirkend zum ' + datum(kauf) + ' festgeschrieben'); } catch (e) {}
        return true;
      }).catch(function (e) { try { console.warn('[vivi-import] Ankauf:', e && e.message); } catch (x) {} return false; });
    } catch (e) { return Promise.resolve(false); }
  }

  window.DpViviImport = { karte: karte, laden: laden, vorAnwenden: vorAnwenden, _meta: 'v4050' };
})();
