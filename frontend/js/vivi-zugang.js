/* ════════════════════════════════════════════════════════════════════
   v4350 · WER DARF VIVI? (Marcel 24.11.2026: „ab Investor“, inklusive Testphase)

   Bis v4340 war ViVi eine Vorschau-Funktion (DpVorschau.frei('vivi')). Jetzt ist
   es ein Plan-Merkmal: plans.features.vivi (Migration 128) — Investor, Pro,
   Partner ja, Free und Starter nein. Die Testphase läuft als Pro und ist damit
   dabei. Admin immer. Das Backend sperrt /api/v1/vivi genauso (routes/vivi.js
   viviZugang), das hier ist nur die Oberfläche.

     DpViviZugang.frei()     -> Promise<boolean>   (ohne Antwort: false)
     DpViviZugang.istFrei()  -> boolean | null       (null = noch nicht geladen)
     DpViviZugang.upgradeHtml() -> Hinweis für Starter/Free mit Knopf zur Preisübersicht

   Neu geladen bei dp:plan-ready (Planwechsel, Anmeldung).
   ════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpViviZugang) return;
  var _stand = null, _laeuft = null;

  function admin() { try { var se = global.Auth && Auth.getSession && Auth.getSession(); return !!(se && se.role === 'admin'); } catch (e) { return false; } }

  function frei() {
    if (_stand !== null) return Promise.resolve(_stand);
    if (_laeuft) return _laeuft;
    if (admin()) { _stand = true; return Promise.resolve(true); }
    var S = global.Sub;
    if (!S || typeof S.getCurrent !== 'function') return Promise.resolve(false);
    try { if (!(global.Auth && Auth.isLoggedIn && Auth.isLoggedIn())) return Promise.resolve(false); } catch (e) { return Promise.resolve(false); }
    /* nur eine echte Plan-Antwort merken: der Rueckfall (_fallback, Plan noch unbekannt) waere sonst bis zum Neuladen „gesperrt“ */
    _laeuft = S.getCurrent().then(function (sub) { var v = !!(sub && sub.plan_features && sub.plan_features.vivi); if (sub && !sub._fallback) _stand = v; return v; })
      .catch(function () { return false; }).then(function (v) { _laeuft = null; return v; });
    return _laeuft;
  }
  function istFrei() { return _stand; }

  function upgradeHtml() {
    return '<div class="vivi-upgrade" style="border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);border-radius:10px;padding:12px 14px;font:400 13px/1.45 Inter,system-ui,sans-serif">'
      + '<div style="font:600 11px/1 \'JetBrains Mono\',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px">ViVi-Anbindung</div>'
      + '<div>Verbinde DealPilot mit deiner Objektverwaltung ViVi. Objekte und Mieter übertragen, Mieterhöhung und Nebenkosten direkt nach ViVi schreiben, Jahresabgleich mit den Werten aus ViVi. Enthalten ab dem Paket Investor.</div>'
      + '<button type="button" class="btn btn-sm btn-gold" style="margin-top:10px" onclick="if(window.openPricingModal)window.openPricingModal();">Pakete ansehen</button>'
      + '</div>';
  }

  try { global.addEventListener('dp:plan-ready', function () { _stand = null; _laeuft = null; }); } catch (e) {}

  global.DpViviZugang = { frei: frei, istFrei: istFrei, upgradeHtml: upgradeHtml };
})(window);
