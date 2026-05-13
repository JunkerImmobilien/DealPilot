/**
 * feedback-modal.js — DealPilot Feedback & Support V63.74
 *
 * V63.74-Erweiterungen (Marcel-Feedback):
 *   - Diagnose enthält jetzt User-Name, E-Mail, Plan, Demo-Modus
 *   - Support: Bilder/Screenshots anhängen (max 5, je 5 MB)
 *   - Support: aktuelles Objekt als JSON anhängen (Toggle)
 *   - Feedback-Kriterien erweitert: Workflow, Kennzahlen, Score, Onboarding
 *   - Submit über /api/v1/feedback (multipart/form-data)
 *   - Mailto-Fallback wenn Backend nicht erreichbar
 */
(function() {
  'use strict';

  var CRITERIA = [
    { key: 'ux',          label: 'Bedienung & UX',            icon: 'compass',   desc: 'Wie intuitiv ist die App?' },
    { key: 'workflow',    label: 'Workflow-Verständlichkeit', icon: 'route',     desc: 'Ist der Ablauf nachvollziehbar?' },
    { key: 'onboarding',  label: 'Onboarding / Einstieg',     icon: 'flag',      desc: 'Wie einfach war der Start?' },
    { key: 'kpis',        label: 'Kennzahlen-Aufbereitung',   icon: 'barChart',  desc: 'Verständlich präsentiert?' },
    { key: 'score',       label: 'DealScore-Logik',           icon: 'target',    desc: 'Trifft die Bewertung?' },
    { key: 'pdf',         label: 'PDF-Qualität',              icon: 'fileText',  desc: 'Wie gut sind die Exporte?' },
    { key: 'ai',          label: 'KI-Analyse',                icon: 'brain',     desc: 'Trifft die KI-Bewertung?' },
    { key: 'performance', label: 'Geschwindigkeit',           icon: 'zap',       desc: 'Wie schnell läuft alles?' }
  ];

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _icon(name, size) {
    size = size || 18;
    if (window.Icons && typeof window.Icons[name] === 'function') {
      try { return window.Icons[name]({ size: size }); } catch (e) {}
    }
    return '<span class="fb-icon-fallback"></span>';
  }

  function _collectDiagnostics() {
    var version = (window.DealPilotVersion && window.DealPilotVersion.label) || 'unbekannt';
    var build   = (window.DealPilotVersion && window.DealPilotVersion.build) || '';
    var ua      = navigator.userAgent || '-';
    var lang    = navigator.language || '-';
    var screen  = window.screen ? (window.screen.width + 'x' + window.screen.height) : '-';
    var viewport = window.innerWidth + 'x' + window.innerHeight;

    var userName = '-', userEmail = '-', userId = '-', authMode = 'unknown', isDemo = false;
    try {
      if (typeof Auth !== 'undefined' && Auth.getSession) {
        var s = Auth.getSession();
        if (s) {
          userName  = s.name || '-';
          userEmail = s.email || '-';
          userId    = s.id || s.user_id || '-';
          authMode  = (Auth.isApiMode && Auth.isApiMode()) ? 'api' : 'local';
          isDemo    = (s.email || '').toLowerCase().indexOf('demo') >= 0 || s.demo === true;
        }
      }
    } catch (e) {}

    var planKey = '-', planName = '-';
    try {
      if (window.DealPilotConfig && window.DealPilotConfig.pricing) {
        var p = window.DealPilotConfig.pricing.current && window.DealPilotConfig.pricing.current();
        if (p) { planKey = p.key || '-'; planName = p.name || '-'; }
      }
    } catch (e) {}

    var objKuerzel = '-', objAdresse = '-';
    try {
      var k = document.getElementById('kuerzel'); if (k && k.value) objKuerzel = k.value;
      var ort = document.getElementById('ort');   if (ort && ort.value) objAdresse = ort.value;
    } catch (e) {}

    return {
      version: version, build: build,
      user_name: userName, user_email: userEmail, user_id: userId,
      plan_key: planKey, plan_name: planName,
      auth_mode: authMode, demo_mode: isDemo,
      browser: ua.substring(0, 140),
      language: lang, screen: screen, viewport: viewport,
      url: window.location.pathname + window.location.hash,
      timestamp: new Date().toISOString(),
      object_kuerzel: objKuerzel, object_ort: objAdresse
    };
  }

  function _collectCurrentObject() {
    try {
      if (typeof window.collectAllFields === 'function') return window.collectAllFields();
      var data = {};
      document.querySelectorAll('input[id], select[id], textarea[id]').forEach(function(el) {
        if (!el.id || el.id.startsWith('fb-') || el.id.startsWith('da-')) return;
        if (el.type === 'file' || el.type === 'button' || el.type === 'submit') return;
        if (el.type === 'checkbox' || el.type === 'radio') {
          if (el.checked) data[el.id] = el.value || true;
        } else if (el.value) {
          data[el.id] = el.value;
        }
      });
      return data;
    } catch (e) { return null; }
  }

  function showFeedback() {
    if (document.getElementById('feedback-modal')) return;

    var modal = document.createElement('div');
    modal.id = 'feedback-modal';
    modal.className = 'fb-overlay';

    var ICON_MAP = {
      compass:   'i-compass',
      route:     'i-route',
      flag:      'i-flag',
      barChart:  'i-bar',
      target:    'i-target',
      fileText:  'i-file',
      brain:     'i-brain',
      zap:       'i-rocket'
    };
    function _spriteIcon(name) {
      var id = ICON_MAP[name] || ('i-' + name);
      return '<span class="ic"><svg><use href="#' + id + '"/></svg></span>';
    }

    // V114: Detail-Tiles im 2-Spalten-Grid. Letzter Eintrag (KI-Analyse) als full-width Spotlight.
    //   Klassen: .detail (neu, Glassmorphic) + .fb-criterion (alt, JS-Bindings nicht angefasst).
    //   Die Stars-Gruppe behält die .fb-crit-stars-Klasse für die JS-Selektoren.
    var lastIdx = CRITERIA.length - 1;
    var criteriaHtml = CRITERIA.map(function(c, i) {
      var span = (i === lastIdx) ? ' style="grid-column:span 2"' : '';
      return '<div class="detail fb-criterion" data-key="' + c.key + '"' + span + '>' +
        '<div class="detail-ic">' + _spriteIcon(c.icon) + '</div>' +
        '<div class="detail-info">' +
          '<div class="detail-l">' + _esc(c.label) + '</div>' +
          '<div class="detail-d">' + _esc(c.desc) + '</div>' +
        '</div>' +
        '<div class="detail-stars fb-crit-stars" data-key="' + c.key + '">' +
          [1,2,3,4,5].map(function(n) {
            return '<button type="button" class="star fb-mini-star" data-value="' + n + '" aria-label="' + n + ' Sterne">★</button>';
          }).join('') +
        '</div>' +
      '</div>';
    }).join('');

    var diag = _collectDiagnostics();

    modal.innerHTML =
      '<div class="fb-modal modal">' +
        '<button class="fb-close close" type="button" onclick="closeFeedback()" aria-label="Schließen">' +
          '<span class="ic"><svg><use href="#i-x"/></svg></span>' +
        '</button>' +

        // V114: Hero — Cat-Pill + Serif-Italic-Heading + Sub-Description
        '<div class="fb-head hero">' +
          '<div class="hero-cat"><span class="ic"><svg><use href="#i-spark"/></svg></span>Deine Stimme zählt</div>' +
          '<h2 class="hero-h">Feedback &amp; <span class="gold">Support</span></h2>' +
          '<p class="hero-d">Hilf uns, DealPilot besser zu machen — oder hol dir schnelle Hilfe wenn was nicht läuft.</p>' +
        '</div>' +

        // V114: Body-Wrapper (scrollbar) + Toggle-Row + Sections
        // V115: Klasse "body" entfernt — kollidierte mit body.plan-free .body::before
        //       (Free-Watermark "DealPilot Free" wurde im Modal gerendert).
        '<div class="fb-body fb-modal-body">' +

          // Toggle-Row Feedback / Support
          '<div class="toggle-row fb-type-tabs">' +
            '<button type="button" class="toggle fb-type-tab fb-type-tab-active act" data-type="feedback" onclick="_fbSwitchType(this)">' +
              '<div class="toggle-ic fb-type-icon"><span class="ic"><svg><use href="#i-bulb"/></svg></span></div>' +
              '<div class="fb-type-text">' +
                '<div class="toggle-l fb-type-l">Feedback geben</div>' +
                '<div class="toggle-d fb-type-d">Wünsche, Kritik, Lob</div>' +
              '</div>' +
            '</button>' +
            '<button type="button" class="toggle fb-type-tab" data-type="support" onclick="_fbSwitchType(this)">' +
              '<div class="toggle-ic fb-type-icon"><span class="ic"><svg><use href="#i-life"/></svg></span></div>' +
              '<div class="fb-type-text">' +
                '<div class="toggle-l fb-type-l">Support anfragen</div>' +
                '<div class="toggle-d fb-type-d">Bug oder Frage</div>' +
              '</div>' +
            '</button>' +
          '</div>' +

          // Pane: Feedback
          '<div class="fb-pane fb-pane-active" data-pane="feedback">' +
            '<div class="section fb-section">' +
              '<div class="section-h"><div class="section-h-num">1</div><div class="section-l fb-section-l">Gesamtzufriedenheit</div></div>' +
              '<div class="section-d fb-section-d">Wie zufrieden bist du insgesamt mit DealPilot?</div>' +
              '<div class="stars-big fb-stars" id="fb-overall-stars">' +
                [1,2,3,4,5].map(function(n) {
                  return '<button type="button" class="star fb-star" data-value="' + n + '" aria-label="' + n + ' Sterne">★</button>';
                }).join('') +
                '<span class="stars-label fb-stars-label" id="fb-overall-label">Klick einen Stern</span>' +
              '</div>' +
            '</div>' +
            '<div class="section fb-section">' +
              '<div class="section-h"><div class="section-h-num">2</div><div class="section-l fb-section-l">Im Detail</div></div>' +
              '<div class="section-d fb-section-d">Bewerte einzelne Bereiche (optional)</div>' +
              '<div class="detail-grid fb-criteria">' + criteriaHtml + '</div>' +
            '</div>' +
            '<div class="section fb-section">' +
              '<div class="section-h"><div class="section-h-num">3</div><div class="section-l fb-section-l">Was möchtest du loswerden?</div></div>' +
              '<div class="section-d fb-section-d">Verbesserungsvorschläge, Lob, oder was dir wichtig ist (optional)</div>' +
              '<textarea class="ta" id="fb-text-feedback" rows="4" maxlength="2000" placeholder="z.B. Was würdest du dir noch wünschen? Was läuft besonders gut?"></textarea>' +
              '<div class="fb-textcount"><span id="fb-text-feedback-count">0</span> / 2000</div>' +
            '</div>' +
          '</div>' +

          // Pane: Support
          '<div class="fb-pane" data-pane="support" style="display:none">' +
            '<div class="section fb-section">' +
              '<div class="section-h"><div class="section-h-num">1</div><div class="section-l fb-section-l">Worum geht es?</div></div>' +
              '<div class="section-d fb-section-d">Wähle die passende Kategorie</div>' +
              '<div class="fb-cat-grid">' +
                [
                  { v: 'bug',     i: 'bug',        sprite: 'i-rocket',    l: 'Bug / Fehler',          d: 'Etwas funktioniert nicht' },
                  { v: 'how',     i: 'helpCircle', sprite: 'i-help',      l: 'Wie funktioniert das?', d: 'Bedienungsfrage' },
                  { v: 'data',    i: 'database',   sprite: 'i-portfolio', l: 'Daten / Account',       d: 'Speichern, Login, Export' },
                  { v: 'billing', i: 'creditCard', sprite: 'i-coins',     l: 'Plan / Abrechnung',     d: 'Upgrade, Rechnung' },
                  { v: 'other',   i: 'mail',       sprite: 'i-file',      l: 'Sonstiges',             d: 'Was anderes' }
                ].map(function(c) {
                  return '<button type="button" class="fb-cat detail" data-value="' + c.v + '" onclick="_fbSelectCat(this)">' +
                    '<span class="detail-ic fb-cat-icon"><span class="ic"><svg><use href="#' + c.sprite + '"/></svg></span></span>' +
                    '<div class="detail-info fb-cat-text">' +
                      '<div class="detail-l fb-cat-l">' + _esc(c.l) + '</div>' +
                      '<div class="detail-d fb-cat-d">' + _esc(c.d) + '</div>' +
                    '</div>' +
                  '</button>';
                }).join('') +
              '</div>' +
            '</div>' +

            '<div class="section fb-section">' +
              '<div class="section-h"><div class="section-h-num">2</div><div class="section-l fb-section-l">Was ist passiert?</div></div>' +
              '<div class="section-d fb-section-d">Beschreibe das Problem so genau wie möglich. Bei Bugs: Was hast du erwartet, was war die Realität?</div>' +
              '<textarea class="ta" id="fb-text-support" rows="5" maxlength="3000" placeholder="z.B. Ich wollte ein PDF exportieren, aber der Download startet nicht…"></textarea>' +
              '<div class="fb-textcount"><span id="fb-text-support-count">0</span> / 3000</div>' +
            '</div>' +

            '<div class="section fb-section">' +
              '<div class="section-h"><div class="section-h-num">3</div><div class="section-l fb-section-l">Screenshots / Bilder anhängen <span class="fb-section-opt">(optional)</span></div></div>' +
              '<div class="section-d fb-section-d">Hilft uns enorm beim Nachstellen — Fenster, Fehlermeldung, Auffälligkeiten</div>' +
              '<div class="fb-attach-row">' +
                '<input type="file" id="fb-screenshots" multiple accept="image/*" style="display:none" onchange="_fbOnScreenshots(this)">' +
                '<button type="button" class="fb-attach-btn" onclick="document.getElementById(\'fb-screenshots\').click()">' +
                  '<span class="ic"><svg><use href="#i-file"/></svg></span> Bilder auswählen' +
                '</button>' +
                '<span class="fb-attach-info" id="fb-screenshots-info">Max. 5 Bilder · je max. 5 MB</span>' +
              '</div>' +
              '<div class="fb-attach-list" id="fb-screenshots-list"></div>' +
            '</div>' +

            '<div class="section fb-section">' +
              '<div class="section-h"><div class="section-h-num">4</div><div class="section-l fb-section-l">Aktuelles Objekt anhängen <span class="fb-section-opt">(optional)</span></div></div>' +
              '<div class="section-d fb-section-d">Schickt deine aktuellen Eingaben als JSON mit — hilft beim Reproduzieren</div>' +
              '<label class="fb-toggle-row">' +
                '<input type="checkbox" id="fb-attach-object" class="fb-toggle-cb">' +
                '<span class="fb-toggle-text" id="fb-attach-object-text">Objekt nicht anhängen</span>' +
              '</label>' +
            '</div>' +

            '<div class="section fb-section">' +
              '<div class="section-h"><div class="section-h-num">5</div><div class="section-l fb-section-l">Antwort an</div></div>' +
              '<div class="section-d fb-section-d">Wir melden uns bei dieser E-Mail (Standard: deine Account-Mail)</div>' +
              '<input class="ta" type="email" id="fb-contact-email" placeholder="dein@email.de" value="' + _esc(diag.user_email !== '-' ? diag.user_email : '') + '">' +
            '</div>' +
          '</div>' +

          '<div class="section fb-section fb-diag">' +
            '<details>' +
              '<summary><span class="ic"><svg><use href="#i-help"/></svg></span> Diagnose-Daten anhängen <span class="fb-hint">(hilft uns beim Debugging)</span></summary>' +
              '<div class="fb-diag-content" id="fb-diag-content"></div>' +
            '</details>' +
          '</div>' +
        '</div>' +

        // V114: Footer mit Verschlüsselt-Badge + Submit-Button im neuen Look
        '<div class="footer fb-foot">' +
          '<div class="footer-info fb-foot-hint" id="fb-foot-hint"><span class="ic"><svg><use href="#i-shield"/></svg></span>Verschlüsselt &amp; vertraulich · Vielen Dank für deine Zeit</div>' +
          '<div class="fb-foot-actions">' +
            '<button type="button" class="fb-btn fb-btn-ghost" onclick="closeFeedback()">Abbrechen</button>' +
            '<button type="button" class="submit-btn fb-btn fb-btn-gold" id="fb-submit-btn" onclick="_fbSubmit()">' +
              '<span class="ic"><svg><use href="#i-send"/></svg></span>Feedback senden' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    // V115: Body-Klasse setzen damit das Free-Watermark (body.plan-free .body::before)
    //       nicht durchs Modal scheint — siehe CSS-Selektor body.fb-modal-open.plan-free
    document.body.classList.add('fb-modal-open');

    window._fbState = {
      type: 'feedback', overall: 0, criteria: {}, cat: '',
      screenshots: [], diagnostics: diag
    };

    document.querySelectorAll('#fb-overall-stars .fb-star').forEach(function(s) {
      s.addEventListener('click', function() {
        var v = parseInt(s.getAttribute('data-value'));
        window._fbState.overall = v;
        _fbUpdateStars('#fb-overall-stars', v);
        var labels = ['', 'Sehr unzufrieden', 'Geht so', 'Okay', 'Gut', 'Begeistert'];
        var lbl = document.getElementById('fb-overall-label');
        if (lbl) lbl.textContent = labels[v] || '';
      });
    });

    document.querySelectorAll('.fb-crit-stars').forEach(function(grp) {
      var key = grp.getAttribute('data-key');
      grp.querySelectorAll('.fb-mini-star').forEach(function(s) {
        s.addEventListener('click', function() {
          var v = parseInt(s.getAttribute('data-value'));
          window._fbState.criteria[key] = v;
          _fbUpdateMiniStars(grp, v);
        });
      });
    });

    ['feedback', 'support'].forEach(function(t) {
      var ta = document.getElementById('fb-text-' + t);
      var cnt = document.getElementById('fb-text-' + t + '-count');
      if (ta && cnt) {
        ta.addEventListener('input', function() { cnt.textContent = ta.value.length; });
      }
    });

    var objCb = document.getElementById('fb-attach-object');
    if (objCb) {
      objCb.addEventListener('change', function() {
        var t = document.getElementById('fb-attach-object-text');
        if (t) t.textContent = objCb.checked ? 'Objekt wird angehängt (JSON)' : 'Objekt nicht anhängen';
      });
    }

    _fbFillDiag(diag);

    modal.addEventListener('click', function(e) {
      if (e.target === modal) closeFeedback();
    });
    document.addEventListener('keydown', _fbEscHandler);
  }

  function _fbEscHandler(e) {
    if (e.key === 'Escape' && document.getElementById('feedback-modal')) closeFeedback();
  }

  function _fbUpdateStars(selector, value) {
    document.querySelectorAll(selector + ' .fb-star').forEach(function(s) {
      var v = parseInt(s.getAttribute('data-value'));
      var on = v <= value;
      s.classList.toggle('fb-star-active', on);
      s.classList.toggle('f', on);  // V114: Glassmorphic-Star-Style
    });
  }
  function _fbUpdateMiniStars(group, value) {
    group.querySelectorAll('.fb-mini-star').forEach(function(s) {
      var v = parseInt(s.getAttribute('data-value'));
      var on = v <= value;
      s.classList.toggle('fb-mini-star-active', on);
      s.classList.toggle('f', on);  // V114: Glassmorphic-Star-Style
    });
  }

  function _fbSwitchType(btn) {
    var t = btn.getAttribute('data-type');
    window._fbState.type = t;
    document.querySelectorAll('.fb-type-tab').forEach(function(b) {
      b.classList.toggle('fb-type-tab-active', b === btn);
      // V114: Glassmorphic-Look — .act-Klasse aktiv synchronisieren
      b.classList.toggle('act', b === btn);
    });
    document.querySelectorAll('.fb-pane').forEach(function(p) {
      var match = p.getAttribute('data-pane') === t;
      p.style.display = match ? '' : 'none';
      p.classList.toggle('fb-pane-active', match);
    });
    var hint = document.getElementById('fb-foot-hint');
    if (hint) {
      // V114: Footer-Hint mit Shield-Icon vor dem Text — innerHTML statt textContent
      var shield = '<span class="ic"><svg><use href="#i-shield"/></svg></span>';
      hint.innerHTML = shield + (t === 'support'
        ? 'Verschlüsselt &amp; vertraulich · Wir antworten innerhalb von 48h auf Support-Anfragen'
        : 'Verschlüsselt &amp; vertraulich · Vielen Dank für deine Zeit');
    }
    // V114: Submit-Button-Label Mode-abhängig
    var submitBtn = document.getElementById('fb-submit-btn');
    if (submitBtn) {
      var sendIco = '<span class="ic"><svg><use href="#i-send"/></svg></span>';
      submitBtn.innerHTML = sendIco + (t === 'support' ? 'Anfrage senden' : 'Feedback senden');
    }
  }

  function _fbSelectCat(btn) {
    var v = btn.getAttribute('data-value');
    window._fbState.cat = v;
    document.querySelectorAll('.fb-cat').forEach(function(b) {
      var on = (b === btn);
      b.classList.toggle('fb-cat-active', on);
      b.classList.toggle('act', on);  // V114: Glassmorphic-Look
    });
  }

  function _fbOnScreenshots(input) {
    var files = Array.prototype.slice.call(input.files || []);
    var max = 5; var maxSize = 5 * 1024 * 1024;
    var valid = [];
    for (var i = 0; i < files.length && valid.length < max; i++) {
      if (files[i].size > maxSize) continue;
      valid.push(files[i]);
    }
    window._fbState.screenshots = valid;
    _fbRenderScreenshotList();
  }

  function _fbRenderScreenshotList() {
    var arr = (window._fbState && window._fbState.screenshots) || [];
    var info = document.getElementById('fb-screenshots-info');
    var list = document.getElementById('fb-screenshots-list');
    if (info) {
      info.textContent = arr.length
        ? arr.length + ' Bild' + (arr.length === 1 ? '' : 'er') + ' ausgewählt'
        : 'Max. 5 Bilder · je max. 5 MB';
    }
    if (list) {
      list.innerHTML = arr.map(function(f, i) {
        var kb = Math.round(f.size / 1024);
        return '<div class="fb-attach-item"><span class="fb-attach-name">' + _esc(f.name) +
               '</span><span class="fb-attach-size">' + kb + ' KB</span>' +
               '<button type="button" class="fb-attach-rm" onclick="_fbRmScreenshot(' + i + ')" aria-label="Entfernen">×</button></div>';
      }).join('');
    }
  }

  function _fbRmScreenshot(idx) {
    if (!window._fbState || !window._fbState.screenshots) return;
    window._fbState.screenshots.splice(idx, 1);
    _fbRenderScreenshotList();
  }

  function _fbFillDiag(diag) {
    var el = document.getElementById('fb-diag-content');
    if (!el) return;
    var rows = [
      ['Version', diag.version + (diag.build ? ' (' + diag.build + ')' : '')],
      ['User', diag.user_name + (diag.user_email !== '-' ? ' · ' + diag.user_email : '')],
      ['Plan', diag.plan_name + (diag.demo_mode ? ' (Demo)' : '')],
      ['Auth-Modus', diag.auth_mode],
      ['Browser', diag.browser],
      ['Sprache', diag.language],
      ['Bildschirm', diag.screen + ' · Viewport ' + diag.viewport],
      ['Aktuelles Objekt', diag.object_kuerzel + (diag.object_ort !== '-' ? ' · ' + diag.object_ort : '')],
      ['URL', diag.url],
      ['Datum', diag.timestamp]
    ];
    el.innerHTML = rows.map(function(r) {
      return '<div class="fb-diag-line"><span class="fb-diag-k">' + _esc(r[0]) + ':</span> <span class="fb-diag-v">' + _esc(r[1]) + '</span></div>';
    }).join('');
  }

  function _fbCollectPayload() {
    var s = window._fbState || {};
    var feedbackText = (document.getElementById('fb-text-feedback') || {}).value || '';
    var supportText  = (document.getElementById('fb-text-support')  || {}).value || '';
    var contactEmail = (document.getElementById('fb-contact-email') || {}).value || '';

    return {
      type: s.type || 'feedback',
      overall_rating: s.overall || 0,
      criteria: s.criteria || {},
      category: s.cat || '',
      message: s.type === 'support' ? supportText : feedbackText,
      contact_email: contactEmail,
      diagnostics: s.diagnostics || _collectDiagnostics(),
      screenshots: s.screenshots || []
    };
  }

  function _fbValidate(p) {
    if (p.type === 'feedback') {
      if (!p.overall_rating && !(p.message || '').trim()) {
        return 'Bitte gib mindestens eine Sterne-Bewertung oder einen Kommentar ab.';
      }
    } else {
      if (!p.category) return 'Bitte wähle eine Support-Kategorie.';
      if (!(p.message || '').trim() || p.message.trim().length < 10) {
        return 'Bitte beschreibe dein Anliegen mit mindestens 10 Zeichen.';
      }
    }
    return null;
  }

  function _fbSubmit() {
    var btn = document.getElementById('fb-submit-btn');
    if (!btn) return;
    var payload = _fbCollectPayload();
    var err = _fbValidate(payload);
    if (err) { _fbShowToast(err, 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Sende…';

    var fd = new FormData();
    fd.append('type', payload.type);
    fd.append('overall_rating', String(payload.overall_rating || 0));
    fd.append('criteria', JSON.stringify(payload.criteria || {}));
    fd.append('category', payload.category || '');
    fd.append('message', payload.message || '');
    fd.append('contact_email', payload.contact_email || '');
    fd.append('diagnostics', JSON.stringify(payload.diagnostics || {}));

    if (payload.type === 'support') {
      (payload.screenshots || []).forEach(function(f, i) {
        fd.append('screenshots', f, f.name || ('screenshot_' + i + '.png'));
      });
      var objCb = document.getElementById('fb-attach-object');
      if (objCb && objCb.checked) {
        var obj = _collectCurrentObject();
        if (obj) fd.append('object_json', JSON.stringify(obj));
      }
    }

    var token = null;
    try { token = localStorage.getItem('ji_token'); } catch (e) {}
    var headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch('/api/v1/feedback', { method: 'POST', headers: headers, body: fd })
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function() { _fbShowSuccess(payload); })
      .catch(function(e) { _fbShowMailtoFallback(payload, e.message || 'Server nicht erreichbar'); });
  }

  function _fbShowSuccess(payload) {
    var modal = document.getElementById('feedback-modal');
    if (!modal) return;
    var inner = modal.querySelector('.fb-modal');
    if (!inner) return;
    var title = payload.type === 'support' ? 'Support-Anfrage gesendet!' : 'Vielen Dank für dein Feedback!';
    var sub = payload.type === 'support'
      ? 'Wir melden uns innerhalb von 48 Stunden bei dir.'
      : 'Dein Feedback hilft uns, DealPilot besser zu machen.';
    inner.innerHTML =
      '<div class="fb-success">' +
        '<div class="fb-success-icon">' + _icon('check', 32) + '</div>' +
        '<h2 class="fb-success-title">' + title + '</h2>' +
        '<p class="fb-success-sub">' + sub + '</p>' +
        '<button type="button" class="fb-btn fb-btn-gold" onclick="closeFeedback()">Schließen</button>' +
      '</div>';
  }

  function _fbShowMailtoFallback(payload, reason) {
    var subject = payload.type === 'support'
      ? '[DealPilot Support] ' + (payload.category ? payload.category : 'Anfrage')
      : '[DealPilot Feedback]' + (payload.overall_rating ? ' ' + payload.overall_rating + '★' : '');

    var body = '';
    if (payload.type === 'feedback') {
      body += 'Gesamtzufriedenheit: ' + (payload.overall_rating || '-') + ' / 5\n\n';
      if (Object.keys(payload.criteria || {}).length) {
        body += 'Im Detail:\n';
        Object.keys(payload.criteria).forEach(function(k) {
          body += '  - ' + k + ': ' + payload.criteria[k] + ' / 5\n';
        });
        body += '\n';
      }
    } else {
      body += 'Kategorie: ' + (payload.category || '-') + '\n\n';
    }
    body += 'Nachricht:\n' + (payload.message || '') + '\n\n';
    if (payload.contact_email) body += 'Antwort an: ' + payload.contact_email + '\n\n';
    body += '— Diagnose —\n';
    Object.keys(payload.diagnostics || {}).forEach(function(k) {
      body += k + ': ' + payload.diagnostics[k] + '\n';
    });
    if ((payload.screenshots || []).length) {
      body += '\nHinweis: ' + payload.screenshots.length + ' Screenshot(s) waren ausgewählt — bitte manuell anhängen!\n';
    }

    // V63.77: Adressen typspezifisch — Support an support@, Feedback an dealpilot@
    var mailtoTo = payload.type === 'support'
      ? 'support@junker-immobilien.io'
      : 'dealpilot@junker-immobilien.io';
    var mailto = 'mailto:' + mailtoTo + '?subject=' +
      encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

    var modal = document.getElementById('feedback-modal');
    if (!modal) return;
    var inner = modal.querySelector('.fb-modal');
    if (!inner) return;
    inner.innerHTML =
      '<div class="fb-success">' +
        '<div class="fb-success-icon" style="background:rgba(201,168,76,0.18);color:#E2C97E;">' + _icon('mail', 30) + '</div>' +
        '<h2 class="fb-success-title">E-Mail-Programm öffnen</h2>' +
        '<p class="fb-success-sub">Der direkte Server-Versand ist gerade nicht verfügbar. Wir öffnen dein E-Mail-Programm mit allen Daten vorbereitet — du musst nur noch auf "Senden" klicken.</p>' +
        '<a class="fb-btn fb-btn-gold" href="' + mailto + '" onclick="setTimeout(closeFeedback,500)">' + _icon('mail', 16) + ' E-Mail öffnen</a>' +
        '<button type="button" class="fb-btn fb-btn-ghost" style="margin-top:8px" onclick="closeFeedback()">Abbrechen</button>' +
      '</div>';
  }

  function _fbShowToast(msg, type) {
    var t = document.createElement('div');
    t.className = 'fb-toast fb-toast-' + (type || 'info');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.classList.add('fb-toast-show'); }, 10);
    setTimeout(function() {
      t.classList.remove('fb-toast-show');
      setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 250);
    }, 3500);
  }

  function closeFeedback() {
    var m = document.getElementById('feedback-modal');
    if (m) m.remove();
    document.body.classList.remove('fb-modal-open');  // V115
    document.removeEventListener('keydown', _fbEscHandler);
  }

  window.showFeedback = showFeedback;
  window.closeFeedback = closeFeedback;
  window._fbSwitchType = _fbSwitchType;
  window._fbSelectCat = _fbSelectCat;
  window._fbSubmit = _fbSubmit;
  window._fbOnScreenshots = _fbOnScreenshots;
  window._fbRmScreenshot = _fbRmScreenshot;
})();
