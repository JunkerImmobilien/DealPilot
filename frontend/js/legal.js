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
     - Disclaimer-Version V1.1 (24.05.2026) — V271a
     - Bei Änderung der Disclaimer-Texte: Version hochzählen
       → User muss erneut zustimmen.

   QUELLE
     Übernommen + angepasst aus portfolio-strategy-v153.6
   ════════════════════════════════════════════════════════════════ */

(function(global) {
  'use strict';

  // V271a-legal-12-sections + V272-no-autoshow: rechtssichere Texte + kein Auto-Modal
  var DISCLAIMER_VERSION = '1.1';
  var STORAGE_KEY = 'dp_legal_accepted';

  // ─── DISCLAIMER-TEXTE (zentral, 12 Sections, Stand: 24.05.2026) ──
  var TEXTS = {
    headline: 'Wichtiger Hinweis zur Nutzung von DealPilot',

    intro: 'DealPilot ist ein <strong>Software-as-a-Service-Werkzeug</strong> ' +
           'zur Modell-Berechnung von Immobilien-Investitionen. Es ermöglicht die ' +
           'Berechnung von Cashflows, Renditen, Tilgungsplänen und steuerlichen Effekten ' +
           'auf Basis von Eingaben des Nutzers und liefert KI-gestützte Bewertungen. ' +
           'Bitte lies die folgenden Hinweise aufmerksam — sie sind wesentliche Grundlage ' +
           'für die Nutzung der Plattform.',

    sections: [
      {
        titel: '1. Keine Rechts-, Steuer-, Finanz- oder Anlageberatung',
        text: 'DealPilot leistet <strong>keine</strong> Steuer-, Rechts-, Finanz- oder Anlageberatung ' +
              'im Sinne des Rechtsdienstleistungsgesetzes (RDG), des Steuerberatungsgesetzes (StBerG) ' +
              'oder des Wertpapierhandelsgesetzes (WpHG). Alle ausgegebenen Werte sind ' +
              'Modell-Berechnungen — keine verbindlichen Aussagen oder Empfehlungen.'
      },
      {
        titel: '2. Diskussionsanstöße statt Empfehlungen',
        text: 'Die Berechnungen zeigen mögliche Szenarien und Hebel auf. Was als „Empfehlung", ' +
              '„Maßnahme" oder „Handlungsempfehlung" formuliert ist, ist als ' +
              '<strong>Anreiz für ein Gespräch mit Steuerberater, Notar oder Finanzierer</strong> ' +
              'zu verstehen — nicht als individuelle Beratungs-Empfehlung.'
      },
      {
        titel: '3. KI-generierte Inhalte (OpenAI)',
        text: 'Der KI-Stratege basiert auf Sprachmodellen der <strong>OpenAI, L.L.C.</strong> (USA). ' +
              'Die generierten Texte und Bewertungen entstehen auf statistischer Basis und können ' +
              '<strong>Fehler oder ungenaue Darstellungen enthalten</strong>. Jede KI-Aussage muss ' +
              'durch einen qualifizierten Berater verifiziert werden. Details zur Datenübermittlung ' +
              'an OpenAI siehe <a href="/datenschutz.html#openai" target="_blank">Datenschutzerklärung Ziffer 6</a>.'
      },
      {
        titel: '4. Pflicht zur Beraterkonsultation',
        text: 'Vor jeder Entscheidung mit steuerlicher, rechtlicher oder finanzieller Tragweite ist ' +
              'zwingend ein <strong>Steuerberater, Rechtsanwalt oder Notar</strong> zu konsultieren. ' +
              'Dies gilt insbesondere für: AfA-Wahlrechte, § 7b Sonderabschreibung, Strukturwechsel ' +
              '(GmbH-Gründung, vermögensverwaltende Strukturen), Erbschafts-/Schenkungsthemen, ' +
              'Refinanzierungen sowie Anlage V und steuerliche Erklärungen.'
      },
      {
        titel: '5. Software-as-a-Service-Lizenz (Vertragstyp)',
        text: 'Mit der Registrierung schließen Sie einen Software-as-a-Service-Nutzungsvertrag mit ' +
              '<strong>Junker Immobilien</strong> (Marcel Junker, Hermannstr. 9, 32609 Hüllhorst). ' +
              'Sie erhalten ein zeitlich befristetes, nicht ausschließliches und nicht übertragbares ' +
              'Nutzungsrecht an der Plattform. Eigentum oder Lizenzen am Quellcode oder am Design ' +
              'werden nicht übertragen.'
      },
      {
        titel: '6. Widerrufsrecht für Verbraucher (§ 355 BGB)',
        text: '<strong>Hinweis für Verbraucher:</strong> Wenn Sie als Verbraucher i.S.d. § 13 BGB ' +
              'einen kostenpflichtigen Plan buchen, haben Sie ein 14-tägiges Widerrufsrecht ohne ' +
              'Angabe von Gründen. Das Widerrufsrecht <strong>erlischt vorzeitig</strong>, sobald ' +
              'Sie der sofortigen Vertragsausführung ausdrücklich zugestimmt haben und die Plattform ' +
              'aktiv nutzen (§ 356 Abs. 5 BGB). Diese Zustimmung erfolgt im Bestellvorgang über eine ' +
              'gesonderte Checkbox. Details siehe <a href="/agb.html" target="_blank">AGB Ziffer V</a>.'
      },
      {
        titel: '7. Vertragslaufzeit und Kündigung',
        text: 'Der unentgeltliche Free-Plan ist jederzeit ohne Frist kündbar (durch Kontolöschung). ' +
              'Kostenpflichtige Pläne haben eine Mindestlaufzeit von einem Monat (monatliche ' +
              'Abrechnung) oder einem Jahr (jährliche Abrechnung). Verbraucher können kostenpflichtige ' +
              'Verträge nach der ersten Mindestlaufzeit jederzeit mit einer Frist von einem Monat ' +
              'zum Monatsende kündigen. Kündigung über das Stripe-Customer-Portal oder per E-Mail an ' +
              '<a href="mailto:info@junker-immobilien.io">info@junker-immobilien.io</a>.'
      },
      {
        titel: '8. Datenverarbeitung (DSGVO)',
        text: 'Junker Immobilien verarbeitet personenbezogene Daten ausschließlich gemäß der ' +
              '<a href="/datenschutz.html" target="_blank">Datenschutzerklärung</a>. ' +
              'Es werden <strong>technisch notwendige Cookies</strong> verwendet, keine Tracking-Cookies. ' +
              'Daten werden in Deutschland gehostet (Hetzner). Eingaben in KI-Funktionen werden an ' +
              'OpenAI in den USA übermittelt; OpenAI verwendet diese Daten nicht zum Training ihrer Modelle.'
      },
      {
        titel: '9. Haftungsausschluss',
        text: 'Junker Immobilien übernimmt <strong>keine Haftung</strong> für direkte oder indirekte ' +
              'Schäden, die aus der Nutzung der Modell-Berechnungen oder daraus abgeleiteten ' +
              'Entscheidungen entstehen. Die Haftung ist bei leichter Fahrlässigkeit auf den ' +
              'vorhersehbaren, vertragstypischen Schaden bei Verletzung von Kardinalpflichten ' +
              'beschränkt. Unberührt bleibt die Haftung bei Vorsatz, grober Fahrlässigkeit, ' +
              'Verletzung von Leben/Körper/Gesundheit sowie nach dem Produkthaftungsgesetz. ' +
              'Details siehe <a href="/agb.html" target="_blank">AGB Ziffer X</a>.'
      },
      {
        titel: '10. Verantwortung für eingegebene Daten Dritter',
        text: 'Falls Sie in DealPilot personenbezogene Daten <strong>Dritter</strong> eingeben ' +
              '(z.B. potenzielle Mieter, Verkäufer), sind Sie selbst datenschutzrechtlich ' +
              'Verantwortlicher. Sie müssen sicherstellen, dass Sie zur Verarbeitung dieser Daten ' +
              'berechtigt sind (Einwilligung oder gesetzliche Erlaubnis).'
      },
      {
        titel: '11. Gerichtsstand und anwendbares Recht',
        text: 'Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. ' +
              'Gerichtsstand für Unternehmer ist der Sitz des Anbieters (Hüllhorst). ' +
              'Bei Verbrauchern bleibt der Schutz durch zwingende Bestimmungen des Aufenthaltslandes ' +
              'unberührt.'
      },
      {
        titel: '12. Stand und Versions-Hinweis',
        text: '<strong>Stand dieser Hinweise:</strong> 24. Mai 2026 · Version ' + '1.1' + '. ' +
              'Bei wesentlichen Änderungen wirst du per E-Mail informiert und musst die ' +
              'aktualisierten Hinweise erneut bestätigen. Du kannst diese Hinweise jederzeit in ' +
              'den Einstellungen unter „Rechtliches" erneut einsehen. ' +
              'Es gelten zudem die <a href="/agb.html" target="_blank">AGB</a>, die ' +
              '<a href="/datenschutz.html" target="_blank">Datenschutzerklärung</a> und das ' +
              '<a href="/impressum.html" target="_blank">Impressum</a>.'
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
  // V272-no-autoshow: KEIN Modal mehr automatisch nach Login.
  // Pflicht-Checkbox bei Registrierung (V271a) ersetzt das Auto-Modal.
  // Manuell erreichbar via DealPilotLegal.showInfo() aus Settings → Rechtliches.
  function maybeShowAfterLogin() {
    return;
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
    // V271a-legacy-marker: Wenn eingeloggt und noch kein Eintrag → legacy-v0
    // → Bestandsuser sehen kein erneutes Modal nach V1.1-Update
    setTimeout(function() {
      if (isAccepted()) return;
      if (global.Auth && global.Auth.isLoggedIn && global.Auth.isLoggedIn()) {
        // Eingeloggt + nichts akzeptiert = Bestandsuser
        // Markiere als legacy-v0 (überspringt das Modal)
        try {
          var legacyRecord = {
            version: 'legacy-v0',
            accepted_at: new Date().toISOString(),
            ua: (navigator.userAgent || '').substring(0, 200),
            legacy: true
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyRecord));
          if (console && console.info) {
            console.info('[DealPilotLegal] Bestandsuser als legacy-v0 markiert');
          }
        } catch(e) {}
        // KEIN Modal — Bestandsuser sieht's nicht
      }
      // Wenn nicht eingeloggt → kein Modal. Wird nach Login von auth.js getriggert.
    }, 1000);
  }

  init();

})(window);
