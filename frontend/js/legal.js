/* ════════════════════════════════════════════════════════════════
   legal.js                                              (V270.3)
   ──────────────────────────────────────────────────────────────
   App-weiter Disclaimer für DealPilot.

   ZWECK
     Beim ersten Login einen Hinweis zeigen, dass DealPilot
     keine Steuer-/Rechts-/Anlageberatung ist (RDG, StBerG, WpHG).

   KOMPONENTEN
     1. First-Visit-Modal (nach Login) mit Consent-Pflicht (Checkbox)
     2. Backend-Logging des Consent-Zeitpunkts (Best-Effort)
     3. localStorage-Persistierung (Versions-spezifisch)

   STAND
     - Disclaimer-Version V1.0 (24.05.2026)
     - Bei Änderung der Disclaimer-Texte: Version hochzählen
       → User muss erneut zustimmen.

   QUELLE
     Übernommen + angepasst aus portfolio-strategy-v153.6
   ════════════════════════════════════════════════════════════════ */

(function(global) {
  'use strict';

  var DISCLAIMER_VERSION = '1.0';
  var STORAGE_KEY = 'dp_legal_accepted';

  // ─── DISCLAIMER-TEXTE (zentral, für Reuse) ──────
  var TEXTS = {
    headline: 'Wichtiger Hinweis zur Nutzung von DealPilot',

    intro: 'DealPilot ist ein <strong>Analyse- und Berechnungs-Werkzeug</strong> ' +
           'für Immobilien-Investments. Es erstellt Modell-Rechnungen auf Basis ' +
           'deiner Eingaben (Kaufpreis, Miete, Finanzierung, Annahmen) und ' +
           'visualisiert Cashflows, Renditen und Steuer-Effekte.',

    sections: [
      {
        titel: 'Keine Beratung im Rechtssinne',
        text: 'DealPilot leistet <strong>keine Steuer-, Rechts-, Finanz- oder Anlageberatung</strong> ' +
              'im Sinne des Rechtsdienstleistungsgesetzes (RDG) oder Steuerberatungsgesetzes (StBerG). ' +
              'Alle ausgegebenen Werte sind Modell-Berechnungen — keine verbindlichen Aussagen.'
      },
      {
        titel: 'Keine Empfehlungen, sondern Diskussionsanstöße',
        text: 'Die Berechnungen zeigen mögliche Szenarien und Hebel auf. ' +
              'Was als „Empfehlung" oder „Maßnahme" formuliert ist, ist immer als ' +
              '<strong>Anreiz für dein nächstes Gespräch mit Steuerberater, Notar oder Finanzierer</strong> zu verstehen — ' +
              'nicht als individuelle Beratungs-Empfehlung im Sinne des §1 Abs. 1a WpHG.'
      },
      {
        titel: 'KI-generierte Inhalte',
        text: 'Der KI-Stratege (basierend auf GPT-Sprachmodellen) erstellt Texte und Bewertungen auf ' +
              'statistischer Basis. Diese können <strong>Fehler enthalten oder Sachverhalte falsch darstellen</strong>. ' +
              'Jede KI-Aussage muss durch einen qualifizierten Berater verifiziert werden.'
      },
      {
        titel: 'Pflicht zur Beraterkonsultation',
        text: 'Vor jeder Entscheidung mit steuerlicher, rechtlicher oder finanzieller Tragweite ' +
              'konsultiere zwingend einen <strong>Steuerberater, Rechtsanwalt oder Notar</strong>. ' +
              'Insbesondere bei: AfA-Wahlrechten, Strukturwechsel (z.B. GmbH-Gründung), ' +
              'Erbschafts-/Schenkungsthemen, Refinanzierungen, Anlage V Einreichung.'
      },
      {
        titel: 'Haftungsausschluss',
        text: 'Anbieter, Entwickler und Junker Immobilien übernehmen <strong>keine Haftung</strong> ' +
              'für direkte oder indirekte Schäden, die aus der Nutzung der Modell-Berechnungen ' +
              'oder daraus abgeleiteten Entscheidungen entstehen. Es gelten ' +
              '<a href="/impressum.html" target="_blank">Impressum</a>, ' +
              '<a href="/agb.html" target="_blank">AGB</a> und ' +
              '<a href="/datenschutz.html" target="_blank">Datenschutzerklärung</a>.'
      }
    ]
  };

  // ─── Helper ───────────────────────────────────────────────────
  function isAccepted() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;
      var data = JSON.parse(stored);
      return data && data.version === DISCLAIMER_VERSION;
    } catch(e) { return false; }
  }

  function setAccepted() {
    var record = {
      version:     DISCLAIMER_VERSION,
      accepted_at: new Date().toISOString(),
      ua:          (navigator.userAgent || '').substring(0, 200)
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); } catch(e) {}

    // Backend-Log (best-effort, blockt nicht)
    // Endpoint /api/v1/consent kommt später als V272 — heute nur try/catch
    if (global.Auth && global.Auth.isLoggedIn && global.Auth.isLoggedIn()) {
      try {
        fetch('/api/v1/consent', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            disclaimer_version: DISCLAIMER_VERSION,
            accepted_at: record.accepted_at
          })
        }).catch(function() { /* still OK if endpoint not yet exists */ });
      } catch(e) {}
    }
  }

  function getAcceptedRecord() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch(e) { return null; }
  }

  // ─── Modal ────────────────────────────────────────────────────
  function showConsentModal() {
    if (document.getElementById('dp-legal-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'dp-legal-modal';
    modal.className = 'dp-legal-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    var html = '';
    html += '<div class="dp-legal-backdrop"></div>';
    html += '<div class="dp-legal-dialog">';
    html += '  <div class="dp-legal-header">';
    html += '    <div class="dp-legal-eyebrow">Rechtlicher Hinweis · Version ' + DISCLAIMER_VERSION + '</div>';
    html += '    <h2 class="dp-legal-title">' + TEXTS.headline + '</h2>';
    html += '  </div>';
    html += '  <div class="dp-legal-body">';
    html += '    <p class="dp-legal-intro">' + TEXTS.intro + '</p>';
    TEXTS.sections.forEach(function(s) {
      html += '<section class="dp-legal-section">';
      html += '  <h3>' + s.titel + '</h3>';
      html += '  <p>' + s.text + '</p>';
      html += '</section>';
    });
    html += '  </div>';
    html += '  <div class="dp-legal-footer">';
    html += '    <label class="dp-legal-checkbox">';
    html += '      <input type="checkbox" id="dp-legal-check"> ';
    html += '      <span>Ich habe die Hinweise gelesen und verstanden. Mir ist bewusst, dass DealPilot <strong>keine Beratung</strong> ist und ich vor jeder Umsetzung einen Steuerberater oder Notar konsultieren muss.</span>';
    html += '    </label>';
    html += '    <div class="dp-legal-actions">';
    html += '      <button class="dp-legal-btn dp-legal-btn-primary" id="dp-legal-accept" disabled>Verstanden — DealPilot nutzen</button>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    modal.innerHTML = html;
    document.body.appendChild(modal);

    var check = document.getElementById('dp-legal-check');
    var btn   = document.getElementById('dp-legal-accept');

    check.addEventListener('change', function() {
      btn.disabled = !check.checked;
    });

    btn.addEventListener('click', function() {
      if (!check.checked) return;
      setAccepted();
      modal.classList.add('dp-legal-closing');
      setTimeout(function() { modal.remove(); }, 300);
    });

    // ESC und Backdrop-Klick blocken bewusst — User MUSS klicken
  }

  // ─── Info-Reopen (z.B. aus Settings) ─────────────────────────
  function showInfo() {
    if (document.getElementById('dp-legal-info-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'dp-legal-info-modal';
    modal.className = 'dp-legal-modal';

    var html = '';
    html += '<div class="dp-legal-backdrop" onclick="DealPilotLegal._closeInfo()"></div>';
    html += '<div class="dp-legal-dialog">';
    html += '  <button class="dp-legal-close" onclick="DealPilotLegal._closeInfo()" aria-label="Schließen">×</button>';
    html += '  <div class="dp-legal-header">';
    html += '    <div class="dp-legal-eyebrow">Rechtlicher Hinweis · Version ' + DISCLAIMER_VERSION + '</div>';
    html += '    <h2 class="dp-legal-title">' + TEXTS.headline + '</h2>';
    html += '  </div>';
    html += '  <div class="dp-legal-body">';
    html += '    <p class="dp-legal-intro">' + TEXTS.intro + '</p>';
    TEXTS.sections.forEach(function(s) {
      html += '<section class="dp-legal-section">';
      html += '  <h3>' + s.titel + '</h3>';
      html += '  <p>' + s.text + '</p>';
      html += '</section>';
    });
    var record = getAcceptedRecord();
    if (record && record.accepted_at) {
      html += '<section class="dp-legal-section">';
      html += '  <h3>Dein Zustimmungs-Eintrag</h3>';
      html += '  <p>Hinweis-Version ' + record.version + ' akzeptiert am ' +
              new Date(record.accepted_at).toLocaleString('de-DE') + '.</p>';
      html += '</section>';
    }
    html += '  </div>';
    html += '</div>';
    modal.innerHTML = html;
    document.body.appendChild(modal);
  }

  function _closeInfo() {
    var m = document.getElementById('dp-legal-info-modal');
    if (m) m.remove();
  }

  // ─── Trigger nach Login ───────────────────────────────────────
  // Wird von auth.js nach erfolgreichem Login aufgerufen.
  // ODER manuell beim Page-Load wenn schon eingeloggt + nicht akzeptiert.
  function maybeShowAfterLogin() {
    if (isAccepted()) return;
    // Kurze Verzögerung damit App-UI da ist
    setTimeout(showConsentModal, 400);
  }

  // ─── Public API ────────────────────────────────────────────────
  global.DealPilotLegal = {
    VERSION:           DISCLAIMER_VERSION,
    TEXTS:             TEXTS,
    isAccepted:        isAccepted,
    setAccepted:       setAccepted,
    getAcceptedRecord: getAcceptedRecord,
    showConsentModal:  showConsentModal,
    showInfo:          showInfo,
    maybeShowAfterLogin: maybeShowAfterLogin,
    _closeInfo:        _closeInfo
  };

  // ─── Auto-Init: prüft Login-Status beim Page-Load ──────────────
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoCheck);
    } else {
      autoCheck();
    }
  }

  function autoCheck() {
    // Wenn User schon eingeloggt ist (z.B. nach Page-Reload) und noch nicht akzeptiert:
    // Modal nach 1s zeigen (App-Init abwarten)
    setTimeout(function() {
      if (isAccepted()) return;
      if (global.Auth && global.Auth.isLoggedIn && global.Auth.isLoggedIn()) {
        showConsentModal();
      }
      // Wenn nicht eingeloggt → kein Modal. Wird nach Login von auth.js getriggert.
    }, 1000);
  }

  init();

})(window);
