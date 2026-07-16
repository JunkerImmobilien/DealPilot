'use strict';
/**
 * rp-pdf-engine.js (W27) — echte Engine-PDFs fuer freigegebene Objekte
 *
 * WARUM: Das Objekt-Modal im Partner-Portal baute bisher ein EIGENES, schlankes
 * PDF aus den Freigabe-Daten (P21). Ein Steuerberater braucht aber das echte
 * Investment-PDF und vor allem die Werbungskosten-Aufstellung PRO JAHR fuer die
 * Anlage V — beides kann nur die Rechen-Engine.
 *
 * WIE: Dasselbe Muster wie MA27 (Mobile-App). Ein verstecktes iframe laedt
 * /index.html, wartet, bis window.loadSaved und die Export-Funktion da sind,
 * laedt das Objekt und ruft den Export. Kein zweiter Rechenweg, keine
 * Doppel-Wahrheit — es ist buchstaeblich dieselbe Engine.
 *
 * ZUGRIFF: Das iframe laedt ueber GET /objects/:id. Der Partner bekommt es dort
 * nur, wenn eine AKTIVE Freigabe besteht (W27-sharedget im Backend). Wird die
 * Freigabe widerrufen, faellt der Zugriff sofort weg — auch hier.
 *
 * BEWUSST OHNE Track Record: der enthaelt das GANZE Portfolio des Mandanten,
 * nicht nur das freigegebene Objekt. "Pro Objekt freigegeben" heisst
 * "pro Objekt sichtbar" — Entscheidung Marcel, 16.07.
 */
(function () {
  var FN = {
    invest: { fn: 'exportPDF',                 args: [],      label: 'Investment-PDF' },
    tax:    { fn: 'exportWerbungskostenPDF',   args: ['all'], label: 'Werbungskosten-PDF' }
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function toastSafe(m) { try { if (typeof toast === 'function') toast(m); } catch (e) {} }

  /* ── Overlay ──────────────────────────────────────────────── */
  function ov(main, sub) {
    var g = document.getElementById('rp-pdf-ov');
    if (!g) {
      g = document.createElement('div'); g.id = 'rp-pdf-ov';
      g.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(6,5,4,.88);display:flex;' +
        'flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px;gap:12px';
      document.body.appendChild(g);
    }
    g.innerHTML = '<div style="font:600 16px \'Space Grotesk\',sans-serif;color:var(--gold-hi,#E8CC7A)">' + esc(main) + '</div>' +
      (sub ? '<div style="font:400 12px \'JetBrains Mono\',monospace;color:#8a8473;max-width:420px;line-height:1.55">' + esc(sub) + '</div>' : '') +
      '<div style="width:34px;height:34px;border:3px solid #2a2727;border-top-color:var(--gold,#C9A84C);border-radius:50%;animation:rpspin .9s linear infinite;margin-top:6px"></div>';
    if (!document.getElementById('rp-spin')) {
      var st = document.createElement('style'); st.id = 'rp-spin';
      st.textContent = '@keyframes rpspin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    return g;
  }
  function hideOv() { var g = document.getElementById('rp-pdf-ov'); if (g) g.remove(); }
  function errOv(msg) {
    var g = ov('', '');
    g.innerHTML = '<div style="font:600 15px \'Space Grotesk\',sans-serif;color:#B86250">' + esc(msg) + '</div>' +
      '<button id="rp-pdf-x" style="margin-top:10px;background:#1a1a1a;color:#e8e2d6;border:1px solid #2a2727;' +
      'border-radius:10px;padding:10px 18px;font:600 13px Inter;cursor:pointer">Schlie\u00dfen</button>';
    var x = document.getElementById('rp-pdf-x'); if (x) x.addEventListener('click', hideOv);
  }

  /* ── Die Engine (MA27-Muster) ─────────────────────────────── */
  function run(objId, spec, done) {
    var old = document.getElementById('rp-pdf-frame');
    if (old) { try { old.remove(); } catch (e) {} }
    var f = document.createElement('iframe'); f.id = 'rp-pdf-frame';
    f.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:900px;opacity:0;pointer-events:none;border:0';
    f.src = '/index.html';
    document.body.appendChild(f);

    var settled = false;
    function finish(ok, why) {
      if (settled) return; settled = true;
      done(ok, why);
      setTimeout(function () { try { f.remove(); } catch (e) {} }, ok ? 5000 : 500);
    }
    var guard = setTimeout(function () { finish(false, 'Zeit\u00fcberschreitung'); }, 40000);

    f.onload = function () {
      var win; try { win = f.contentWindow; } catch (e) { clearTimeout(guard); return finish(false, 'Frame'); }
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        var ready = false;
        try { ready = win && typeof win.loadSaved === 'function' && typeof win[spec.fn] === 'function'; } catch (e) {}
        if (ready) {
          clearInterval(iv); clearTimeout(guard);
          try {
            Promise.resolve(win.loadSaved(objId)).then(function () {
              /* der Engine kurz Zeit geben, State + KPIs aufzubauen */
              setTimeout(function () {
                try {
                  Promise.resolve(win[spec.fn].apply(win, spec.args)).then(function () {
                    finish(true);
                  }).catch(function (e) { finish(false, (e && e.message) || 'Export'); });
                } catch (e) { finish(false, (e && e.message) || 'Export'); }
              }, 900);
            }).catch(function (e) {
              finish(false, (e && e.message) || 'Objekt konnte nicht geladen werden');
            });
          } catch (e) { finish(false, (e && e.message) || 'Laden'); }
        } else if (tries > 120) {           // ~30 s
          clearInterval(iv); clearTimeout(guard); finish(false, 'Engine nicht bereit');
        }
      }, 250);
    };
    f.onerror = function () { clearTimeout(guard); finish(false, 'Frame konnte nicht laden'); };
  }

  /* ── Oeffentlich ──────────────────────────────────────────── */
  window.DealPilotResellerPdf = {
    /** kind: 'invest' | 'tax' ; year: undefined | 'all' | '2025' */
    export: function (kind, objId, year) {
      var base = FN[kind]; if (!base || !objId) return;
      var spec = { fn: base.fn, args: base.args.slice(), label: base.label };
      if (kind === 'tax') spec.args = [year && year !== 'all' ? String(year) : 'all'];
      ov('PDF wird erzeugt \u2026',
         'Die Rechen-Engine l\u00e4dt einmalig im Hintergrund \u2014 beim ersten Mal dauert es einen Moment. ' +
         'Es ist dieselbe Engine, die dein Mandant benutzt.');
      run(objId, spec, function (ok, why) {
        if (ok) { hideOv(); toastSafe('\u2713 ' + spec.label + ' \u2014 Download l\u00e4uft.'); }
        else { errOv('PDF konnte nicht erzeugt werden' + (why ? ' (' + why + ')' : '') + '.'); }
      });
    },
    /** Jahre aus den Objektdaten ableiten — fuer die Anlage-V-Auswahl. */
    yearsFor: function (o) {
      var out = [], d = (o && o.data) || {};
      var start = null;
      try {
        var kd = d.kaufdat || d.d1 || '';
        var m = String(kd).match(/(\d{4})/);
        if (m) start = parseInt(m[1], 10);
      } catch (e) {}
      var now = new Date().getFullYear();
      if (!start || start < 1990 || start > now + 1) start = now;
      for (var y = start; y <= now; y++) out.push(String(y));
      if (!out.length) out.push(String(now));
      return out.reverse();
    }
  };
})();
