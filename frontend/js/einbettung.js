/* ═══════════════════════════════════════════════════════════════════════
   einbettung.js · v2998 — die Anmeldekarte der App, eingebettet in die
   Landingpage (Abschnitt „Einchecken" unter dem Hero).

   Marcel 27.10.2026: „Haben wir auch die Möglichkeit, das einfach direkt
   ohne Umwege auch auf die Landingpage zu setzen … unter dem Hero-Bereich
   gleich das Anmelden machen und Konto erstellen … ohne diese Extraseite."

   Warum einbetten statt nachbauen: Anmeldung UND Registrierung (Einwilligungen,
   Bestätigungs-Mail, Frist, Einladungscodes) bleiben genau EINE Logik in der
   App. Die Landingpage lädt `https://app…/?einbettung=1[&register=1]` in einem
   iframe; App und Landingpage sind dieselbe Site (dealpilot.immo), das Token
   landet also im Speicher der App, und der Wechsel in die App ist danach
   schon angemeldet.

   Was diese Datei tut (nur im iframe mit ?einbettung=1):
     · blendet alles außer den Anmeldekarten aus, Hintergrund durchsichtig
     · meldet der Landingpage die Höhe der Karte (iframe passt sich an)
     · meldet „angemeldet", sobald eine Sitzung besteht - die Landingpage
       wechselt dann in die App
     · nimmt „ansicht: anmelden | registrieren" von der Landingpage an
   Erlaubt sind nur die eigenen Landingpages als Elternseite (der Webserver
   erlaubt das Einbetten ebenfalls nur dort: frame-ancestors).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var oben = true;
  try { oben = window.top === window; } catch (e) { oben = false; }
  if (oben) { try { sessionStorage.removeItem('dp_einbettung'); } catch (e) {} return; }

  var aktiv = false;
  try {
    aktiv = new URLSearchParams(location.search).get('einbettung') === '1' || sessionStorage.getItem('dp_einbettung') === '1';
    if (aktiv) sessionStorage.setItem('dp_einbettung', '1');
  } catch (e) {}
  if (!aktiv) return;

  var ERLAUBT = /^https:\/\/(www\.)?(staging\.)?dealpilot\.immo$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  var eltern = null;
  try { var r = document.referrer ? new URL(document.referrer).origin : null; if (r && ERLAUBT.test(r)) eltern = r; } catch (e) {}
  function senden(nachricht) {
    if (!eltern) return;
    try { window.parent.postMessage(Object.assign({ dpEinbettung: true }, nachricht), eltern); } catch (e) {}
  }

  window._dpEinbettung = true;
  document.documentElement.classList.add('dp-einbettung');
  var css = [
    'html.dp-einbettung,html.dp-einbettung body{background:transparent!important;overflow:hidden!important;min-height:0!important;height:auto!important}',
    'html.dp-einbettung body>*:not(.auth-overlay-v39){display:none!important}',
    'html.dp-einbettung .auth-overlay-v39{position:static!important;inset:auto!important;background:transparent!important;padding:4px 0 8px!important;justify-content:center!important;align-items:flex-start!important;min-height:0!important;overflow:visible!important;z-index:auto!important}',
    'html.dp-einbettung .auth-bg-v39,html.dp-einbettung #dp-register-close{display:none!important}',
    'html.dp-einbettung .auth-card-v39{margin:0 auto!important;max-width:440px!important;width:100%!important}',
    /* die App legt bei ?register=1 die Registrierung UEBER die Anmeldekarte - eingebettet gilt nur die oberste */
    'html.dp-einbettung body:has(#dp-register-modal) #auth-modal{display:none!important}'
  ].join('');
  var st = document.createElement('style'); st.id = 'dp-einbettung-stil'; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* Höhe: sichtbare Karte messen, nur bei Änderung melden */
  var letzteH = 0;
  function hoehe() {
    var o = [].filter.call(document.querySelectorAll('.auth-overlay-v39'), function (x) { return getComputedStyle(x).display !== 'none' && x.getClientRects().length; });
    var el = o.length ? o[o.length - 1] : null;
    var h = el ? Math.ceil(el.getBoundingClientRect().height) + 8 : 0;
    if (h && Math.abs(h - letzteH) > 2) { letzteH = h; senden({ typ: 'hoehe', h: h }); }
  }
  /* Sitzung da? Dann in die App wechseln lassen. */
  var gemeldet = false;
  function sitzung() {
    if (gemeldet) return;
    var t = null; try { t = localStorage.getItem('ji_token'); } catch (e) {}
    if (t) { gemeldet = true; senden({ typ: 'angemeldet' }); }
  }
  setInterval(function () { hoehe(); sitzung(); }, 400);

  window.addEventListener('message', function (e) {
    if (!eltern || e.origin !== eltern || !e.data || !e.data.dpEinbettung) return;
    if (e.data.typ === 'ansicht') {
      try {
        if (e.data.wert === 'registrieren' && window.DealPilotRegister) window.DealPilotRegister.show();
        else if (typeof window.showAuthModal === 'function') {
          var reg = document.getElementById('dp-register-modal'); if (reg) reg.remove();
          window.showAuthModal('login');
        }
      } catch (x) {}
    }
  });
  senden({ typ: 'bereit' });
})();
