'use strict';
/* ══════════════════════════════════════════════════════════════════════
   DealPilot v2137 — verify-frist.js
   Backlog N60.3, Frontend-Hälfte der Gnadenfrist

   Marcel: „Bei der Erstanmeldung besteht die Möglichkeit, dass der Kunde
   direkt Zugang zur App bekommt und spätestens 6 Stunden nach
   Erstanmeldung bestätigen muss, sonst wird der Account gesperrt. **Der
   Hinweis muss natürlich mit der Erstanmeldung kommen**, aber so kann
   ein User direkt, ohne dass er jetzt in seine Mails gehen muss, schon
   was sehen."

   Das Backend (`v2136`) trägt die Frist:

     POST /auth/register-with-verify  ->  token, verifyDeadline, verifyGraceHours
     jede Anfrage, in der Frist       ->  Kopfzeile X-DP-Verify-Deadline
     jede Anfrage, nach Ablauf        ->  403 code VERIFY_EXPIRED
     POST /auth/resend-verify         ->  immer neutral 200

   ── WAS HIER NICHT PASSIERT ────────────────────────────────────────
   Die Frist wird **nicht gerechnet**. Der Ablaufzeitpunkt kommt vom
   Server, und zwar als ISO-Zeitstempel. Eine zweite Rechnung im Browser
   wäre eine zweite Wahrheit — und die Uhr des Nutzers ist nicht die
   unsere.

   > Gezählt wird nur die Differenz zu `Date.now()`, und auch die nur
   > für die Anzeige. Ob der Zugang noch gilt, entscheidet in jedem Fall
   > der Server.

   ── DREI ORTE, EIN ZUSTAND ─────────────────────────────────────────
   1. Nach der Anmeldung: Merker setzen, Band zeigen.
   2. Bei jeder Antwort mit `X-DP-Verify-Deadline`: Merker nachziehen.
      So überlebt das Band einen Neustart des Browsers, ohne dass die
      App dafür eine eigene Abfrage braucht.
   3. Bei `VERIFY_EXPIRED`: Band wird zur Sperre, mit dem Weg zurück.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  var MERKER = 'dp_verify_frist';      /* ISO-Zeitstempel oder leer */
  var MAIL   = 'dp_verify_mail';       /* für „erneut senden"        */
  var band = null, ticker = null;

  function lese() {
    try { return localStorage.getItem(MERKER) || ''; } catch (e) { return ''; }
  }
  function schreibe(iso, mail) {
    try {
      if (iso) localStorage.setItem(MERKER, iso); else localStorage.removeItem(MERKER);
      if (mail) localStorage.setItem(MAIL, mail);
    } catch (e) {}
  }
  function mailAdresse() {
    try {
      var m = localStorage.getItem(MAIL);
      if (m) return m;
      var s = JSON.parse(localStorage.getItem('ji_session') || 'null');
      return (s && s.email) || '';
    } catch (e) { return ''; }
  }

  /* ── Die Restzeit als Text ──────────────────────────────────────────
     Keine Sekunden. Eine Frist von sechs Stunden, die sekundenweise
     herunterzählt, macht Druck ohne Nutzen — und erzeugt jede Sekunde
     ein Neuzeichnen. */
  function restText(ms) {
    if (ms <= 0) return null;
    var min = Math.floor(ms / 60000);
    var h = Math.floor(min / 60), m = min % 60;
    if (h >= 1) return h + ' Std. ' + (m < 10 ? '0' : '') + m + ' Min.';
    if (min >= 1) return min + ' Min.';
    return 'weniger als eine Minute';
  }

  function baue() {
    if (band) return band;
    band = document.createElement('div');
    band.id = 'dp-verify-band';
    band.setAttribute('role', 'status');
    band.innerHTML =
      '<span class="dvb-ico" aria-hidden="true">✉</span>' +
      '<span class="dvb-txt"></span>' +
      '<button type="button" class="dvb-send">Mail erneut senden</button>' +
      '<button type="button" class="dvb-zu" aria-label="Hinweis ausblenden">×</button>';
    document.body.appendChild(band);
    band.querySelector('.dvb-send').addEventListener('click', nachsenden);
    band.querySelector('.dvb-zu').addEventListener('click', function () {
      band.classList.add('dvb-klein');
    });
    return band;
  }

  function zeichne() {
    var iso = lese();
    if (!iso) {
      if (band) band.style.display = 'none';
      try {
        document.documentElement.removeAttribute('data-dp-verify');
        document.documentElement.style.removeProperty('--dp-verify-band-h');
      } catch (e) {}
      return;
    }
    var rest = new Date(iso).getTime() - Date.now();
    var txt = restText(rest);
    var b = baue();
    b.style.display = 'flex';
    /* ══ v2137a · DAS BAND NIMMT PLATZ, STATT ZU SCHWEBEN ═══════════
       GEMESSEN bei 360 und 390 px: das Band lag ueber DREI bzw. ZWEI
       Knoepfen der Datenaufnahme (button.oe-btn). Ein position:fixed-
       Element am unteren Rand verdeckt, was dort steht - genau der
       Fall, den ich mir selbst als Falle notiert habe (das
       Werkzeugpanel lag auf 390 px ueber der Datenaufnahme).

       > Ein Hinweis, der eine Bedienung verdeckt, ist kein Hinweis
       > mehr, sondern ein Hindernis.

       Deshalb bekommt der Inhalt unten Platz: die gemessene Hoehe des
       Bandes wandert als Variable an das Wurzelelement, und eine Regel
       in style.css gibt sie an .body weiter. Gemessen statt geraten -
       das Band ist auf 360 px 195 px hoch und auf 1180 px 89. */
    try {
      var hoehe = Math.ceil(b.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--dp-verify-band-h', hoehe + 'px');
      document.documentElement.setAttribute('data-dp-verify', '1');
    } catch (e) {}
    if (txt === null) {
      /* Abgelaufen. Der Server sperrt; hier steht nur, was zu tun ist. */
      b.classList.add('dvb-aus');
      b.classList.remove('dvb-klein');
      b.querySelector('.dvb-txt').innerHTML =
        '<b>Bestätigungsfrist abgelaufen.</b> Lass dir die Mail erneut schicken — '
        + 'danach ist der Zugang sofort wieder da.';
    } else {
      b.classList.remove('dvb-aus');
      b.querySelector('.dvb-txt').innerHTML =
        '<b>Bitte E-Mail-Adresse bestätigen.</b> Du kannst weiterarbeiten, '
        + 'der Zugang bleibt noch <b class="dvb-rest">' + txt + '</b> offen.';
    }
  }

  function nachsenden() {
    var b = baue();
    var knopf = b.querySelector('.dvb-send');
    var adr = mailAdresse();
    if (!adr) {
      b.querySelector('.dvb-txt').textContent =
        'Für das Nachsenden fehlt die Adresse — bitte melde dich einmal neu an.';
      return;
    }
    knopf.disabled = true;
    var alt = knopf.textContent;
    knopf.textContent = 'Wird gesendet…';
    /* Nacktes fetch wäre hier falsch: der 401-Handler sitzt in Auth.
       Dieser Weg ist aber ANONYM (kein Token nötig) und darf deshalb
       direkt gehen — er ist der einzige, der auch nach Ablauf der
       Frist noch funktionieren muss, wenn jede andere Anfrage 403
       bekommt. */
    var basis = (typeof getApiBase === 'function') ? getApiBase() : '/api/v1';
    fetch(basis + '/auth/resend-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adr })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        knopf.textContent = '✓ Gesendet';
        b.querySelector('.dvb-txt').textContent =
          (d && d.message) || 'Falls für diese Adresse eine Bestätigung offen ist, haben wir sie erneut verschickt.';
        setTimeout(function () { knopf.disabled = false; knopf.textContent = alt; zeichne(); }, 9000);
      })
      .catch(function () {
        knopf.disabled = false; knopf.textContent = alt;
        b.querySelector('.dvb-txt').textContent =
          'Das Senden hat nicht geklappt — bitte später noch einmal versuchen.';
      });
  }

  function start(iso, mail) {
    schreibe(iso, mail);
    zeichne();
    if (ticker) clearInterval(ticker);
    /* Minütlich reicht: die Anzeige nennt Minuten. */
    ticker = setInterval(zeichne, 60000);
  }

  function stop() {
    schreibe('', null);
    if (ticker) { clearInterval(ticker); ticker = null; }
    if (band) band.style.display = 'none';
    /* v2137a: der Platz muss mit dem Band gehen, sonst bleibt unten
       eine Luecke stehen, die niemand erklaeren kann. */
    try {
      document.documentElement.removeAttribute('data-dp-verify');
      document.documentElement.style.removeProperty('--dp-verify-band-h');
    } catch (e) {}
  }

  /* ── Die Kopfzeile jeder Antwort mitlesen ───────────────────────────
     `Auth.apiCall` ist der EINE Weg nach draußen (CLAUDE.md: nacktes
     fetch umgeht den 401-Handler). Hier wird nicht ersetzt, sondern
     `window.fetch` umhüllt — so sehen wir die Kopfzeile unabhängig
     davon, welcher Aufrufer sie ausgelöst hat.

     > Ein Aufsatz, der nur EINEN Aufrufer kennt, verpasst die anderen.
     > Dieselbe Überlegung wie beim Beobachter in karten-stil.js. */
  var origFetch = window.fetch;
  window.fetch = function (eingabe, opt) {
    return origFetch.apply(this, arguments).then(function (resp) {
      try {
        var d = resp.headers && resp.headers.get && resp.headers.get('X-DP-Verify-Deadline');
        if (d) {
          if (lese() !== d) schreibe(d, null);
          zeichne();
          if (!ticker) ticker = setInterval(zeichne, 60000);
        }
      } catch (e) {}
      return resp;
    });
  };

  /* Nach der Anmeldung ruft register-easter-egg.js hier herein. */
  window.DealPilotVerifyFrist = {
    start: start,
    stop: stop,
    zeichne: zeichne,
    /* Für den Fall VERIFY_EXPIRED: Band auf „abgelaufen" stellen, ohne
       auf den nächsten Minutentakt zu warten. */
    abgelaufen: function () {
      var iso = lese();
      if (!iso || new Date(iso).getTime() > Date.now()) {
        schreibe(new Date(Date.now() - 1000).toISOString(), null);
      }
      zeichne();
    }
  };

  /* Beim Laden: falls ein Merker liegt, Band zeigen. */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { if (lese()) start(lese(), null); });
  } else if (lese()) {
    start(lese(), null);
  }
})();
