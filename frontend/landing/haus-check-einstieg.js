/* haus-check-einstieg.js · v5130 KK6 · Startseite, Variante A (Marcel 26.11.2026): Reiter „Vermieten · Selbst nutzen“
   über dem Cockpit-Deal-Check. „Zum Vermieten“ bleibt hier (der Deal-Check ist unverändert), „Selbst nutzen“ führt zum
   Haus-Check (haus-check.html). Erscheint nur, wenn der Haus-Check auf diesem Server kaufbar ist (GET /public/hauscheck/preis
   antwortet 200, Schalter HAUSCHECK_AKTIV) - sonst bleibt die Startseite wie sie ist. */
(function () {
  'use strict';
  var sec = document.getElementById('dealcheck'); if (!sec) return;
  var szene = sec.querySelector('.dk-szene'); if (!szene) return;
  var host = location.hostname;
  var api = (/^app\./.test(host) || host === 'localhost' ? location.origin : (/staging/.test(host) ? 'https://app.staging.dealpilot.immo' : 'https://app.dealpilot.immo')) + '/api/v1/public/hauscheck/preis';
  fetch(api).then(function (r) { if (r.ok) einbauen(); }).catch(function () {});
  function einbauen() {
    if (szene.querySelector('.eg-umsch')) return;
    document.body.setAttribute('data-eg-var', 'a');
    var um = document.createElement('div'); um.className = 'eg-umsch'; um.setAttribute('role', 'tablist');
    um.innerHTML = '<button type="button" class="an" role="tab" aria-selected="true">Zum Vermieten</button>'
      + '<a role="tab" aria-selected="false" href="haus-check.html#dealcheck" style="display:flex;align-items:center;justify-content:center;text-decoration:none;color:rgba(236,230,214,.62);font:600 12px/1 var(--mono,JetBrains Mono,monospace);letter-spacing:.1em;text-transform:uppercase;padding:13px 10px;border-radius:12px 12px 0 0;min-height:40px">Selbst nutzen</a>';
    szene.insertBefore(um, szene.firstChild);
  }
})();
