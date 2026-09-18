/**
 * v1370 (B5) — Wenn das Kontingent voll ist, soll man es erfahren
 * ══════════════════════════════════════════════════════════════════════
 *
 * Marcels Punkt B5: „Erste Warnstufe: sichtbare Meldung + serverseitiges
 * Sicherheitsereignis."
 *
 * Das Ereignis schreibt das Backend seit v1367. Was fehlte, war die
 * sichtbare Meldung: bei HTTP 429 warf `Auth.apiCall` einen Fehler, und
 * ob der irgendwo ankam, hing vom Aufrufer ab. In den meisten Fällen
 * passierte schlicht nichts — ein Knopf tat nichts, eine Liste blieb
 * leer, und niemand wusste warum.
 *
 * ────────────────────────────────────────────────────────────────────
 * DER TON IST HIER DIE EIGENTLICHE ARBEIT
 *
 * Marcels Auflage steht über dem ganzen Schutzsystem:
 *
 *   „Eine technische Auffälligkeit oder ein automatisch erzeugter
 *    Risikoscore darf NICHT automatisch als rechtlich bewiesener
 *    Vertragsverstoß behandelt werden."
 *
 * Für eine Meldung an den Nutzer heißt das: kein Vorwurf, keine Drohung,
 * kein Hinweis auf Konsequenzen, die es nicht gibt. Das System sperrt
 * niemanden von selbst (v1369) — also darf die Meldung auch nicht so
 * klingen, als stünde etwas bevor.
 *
 * Wer diese Meldung sieht, hat in aller Regel einfach zügig gearbeitet.
 * Genau das sagt sie ihm.
 *
 * ────────────────────────────────────────────────────────────────────
 * WARUM NICHT JEDES MAL
 *
 * Bei einem vollen Kontingent laufen oft zehn Anfragen gleichzeitig ins
 * Limit. Zehn Meldungen übereinander wären eine Bestrafung für etwas,
 * das keine ist. Es erscheint eine, und sie bleibt, bis sie abläuft.
 *
 * Wird nach auth.js geladen und legt sich um Auth.apiCall — dasselbe
 * Muster wie der 401-Handler (V156), damit es nur EINEN Ort gibt, an dem
 * solche Antworten behandelt werden.
 */
(function () {
  'use strict';

  if (!window.Auth || typeof window.Auth.apiCall !== 'function') {
    console.warn('[429-handler] Auth.apiCall nicht gefunden — Handler nicht installiert');
    return;
  }

  var originalApiCall = window.Auth.apiCall.bind(window.Auth);

  /* Eine Meldung je Ruhephase. `_bisWann` ist der Zeitpunkt, ab dem
     wieder eine gezeigt werden darf. */
  var _bisWann = 0;

  function meldung(sekunden) {
    var jetzt = Date.now();
    if (jetzt < _bisWann) return;               /* eine reicht */
    _bisWann = jetzt + Math.max(5, sekunden || 60) * 1000;

    var alt = document.getElementById('dp-limit-hinweis');
    if (alt && alt.parentNode) alt.parentNode.removeChild(alt);

    var box = document.createElement('div');
    box.id = 'dp-limit-hinweis';
    box.setAttribute('role', 'status');
    box.innerHTML =
      '<div class="dp-lh-kopf">Kurz durchatmen</div>'
      + '<div class="dp-lh-text">Du hast gerade sehr viele Anfragen in kurzer Zeit '
      + 'gestellt. DealPilot bremst das automatisch ab, damit der Dienst für alle '
      + 'schnell bleibt.</div>'
      + '<div class="dp-lh-fuss">In etwa ' + Math.max(5, sekunden || 60)
      + ' Sekunden geht es normal weiter. Es passiert nichts weiter — deinem Konto '
      + 'entsteht kein Nachteil.</div>'
      + '<button type="button" class="dp-lh-zu" aria-label="Schließen">&times;</button>';

    document.body.appendChild(box);

    var weg = function () {
      if (box.parentNode) { box.classList.add('dp-lh-aus'); setTimeout(function () {
        if (box.parentNode) box.parentNode.removeChild(box);
      }, 300); }
    };
    box.querySelector('.dp-lh-zu').addEventListener('click', weg);
    setTimeout(weg, Math.min(12000, Math.max(6000, (sekunden || 60) * 200)));
  }

  window.Auth.apiCall = async function (path, options) {
    try {
      return await originalApiCall(path, options);
    } catch (err) {
      if (err && err.status === 429) {
        var s = (err.data && err.data.retry_after_s) || 60;
        try { meldung(s); } catch (e) { /* eine Meldung darf nichts kaputtmachen */ }
      }
      throw err;
    }
  };

  /* Das Aussehen steht hier und nicht in style.css: die Meldung gehört zu
     diesem Handler, und wer ihn einmal entfernt, soll nicht eine tote
     Regel in einer 36.000-Zeilen-Datei zurücklassen. */
  var css = document.createElement('style');
  css.textContent = [
    '#dp-limit-hinweis{position:fixed;right:20px;bottom:20px;z-index:99999;max-width:330px;',
    '  padding:15px 38px 15px 17px;border-radius:12px;',
    '  background:var(--surface,#FDFCFA);color:var(--ch,#2A2727);',
    '  border:1px solid color-mix(in srgb, var(--gold,#C9A84C) 40%, transparent);',
    '  box-shadow:0 8px 28px rgba(0,0,0,.16);',
    '  font-family:"Inter",system-ui,sans-serif;',
    '  animation:dpLhAuf .28s cubic-bezier(.2,.8,.3,1)}',
    '#dp-limit-hinweis.dp-lh-aus{opacity:0;transform:translateY(6px);transition:all .3s}',
    '.dp-lh-kopf{font-size:13.5px;font-weight:700;margin-bottom:5px}',
    '.dp-lh-text{font-size:12.5px;line-height:1.5}',
    '.dp-lh-fuss{font-size:11.5px;line-height:1.5;margin-top:7px;opacity:.7}',
    '.dp-lh-zu{position:absolute;top:9px;right:11px;border:0;background:transparent;',
    '  font-size:19px;line-height:1;cursor:pointer;color:inherit;opacity:.45;padding:2px 5px}',
    '.dp-lh-zu:hover{opacity:.85}',
    '@keyframes dpLhAuf{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}',
    '@media (max-width:560px){#dp-limit-hinweis{left:14px;right:14px;max-width:none;bottom:14px}}'
  ].join('');
  document.head.appendChild(css);

  /* Prüfhaken: von außen messbar, ohne das Limit wirklich zu reißen. */
  window.DealPilotLimitHinweis = { zeigen: meldung };
})();
