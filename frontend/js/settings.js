'use strict';
/* ═══════════════════════════════════════════════════
   DEALPILOT – settings.js
   Eigener Settings-Bereich für:
   - Persönliche Daten (Name, Firma, Steuernummer)
   - Kontaktdaten (Adresse, Telefon, E-Mail) für PDF-Footer
   - Eigenes Logo für PDFs
   - API-Key (OpenAI für KI-Analyse)
   - Deal-Score-Parameter (Gewichtung)
═══════════════════════════════════════════════════ */

var Settings = (function() {

  var STORAGE_KEY = 'dp_user_settings';

  var DEFAULTS = {
    user_name: '', user_company: '', user_role: '', user_steuernummer: '', user_uid: '',
    pdf_address: '', pdf_plz: '', pdf_city: '', pdf_phone: '', pdf_email: '', pdf_website: '',
    pdf_logo_b64: '',
    openai_api_key: '',
    openai_model: 'gpt-4o-mini',
    // V51: KI-Determinismus + Stil
    ai_temperature: 0,
    ai_seed: 42,
    ai_tone: 'sachlich-professionell',
    ai_risk_bias: 'neutral',
    ai_length: 'detailliert',
    // V63.21: KI-Prompt-Qualitätseinstellungen (Tab "KI" — V22-Spec)
    ai_detail_level: 'mittel',           // kurz / mittel / ausführlich
    ai_tonality: 'sachlich',             // sachlich / beratend / kritisch
    ai_focus_areas: ['Lage', 'Mietmarkt', 'Risiken'],  // Multi-Select
    ai_custom_instructions: '',          // max 500 Zeichen
    // V63.72: UI-Anzeige-Optionen
    show_workflow_bar: true               // Workflow-Bar unter den Tabs ein/aus
  };

  function get() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch(e) {}
    return Object.assign({}, DEFAULTS);
  }

  function save(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
  }

  return { get: get, save: save, reset: reset, DEFAULTS: DEFAULTS };
})();

// V26: Modul-globaler Draft-State für die Settings-Form. Hält ungespeicherte
// Änderungen über Tab-Wechsel/Re-Renders, damit der User keine Eingaben verliert.
//   _draft = null     → kein Modal offen
//   _draft = {...}    → Modal offen, ggf. mit Änderungen vs. Settings.get()
window._SetDraft = window._SetDraft || { current: null, dirty: false };

function _setIsDirty() {
  if (!window._SetDraft.current) return false;
  var saved = Settings.get();
  var d = window._SetDraft.current;
  for (var k in d) {
    if (d.hasOwnProperty(k) && d[k] !== saved[k]) return true;
  }
  return false;
}

/**
 * V26: Liest alle aktuell sichtbaren (und unsichtbaren via display:none)
 * Form-Inputs und merged sie in den Draft. Wird vor Tab-Wechseln und vor
 * Re-Renders aufgerufen, damit nichts verloren geht.
 */
function _setCollectFormIntoDraft() {
  if (!window._SetDraft.current) return;
  var d = window._SetDraft.current;
  var fields = [
    ['user_name','set_user_name'], ['user_role','set_user_role'], ['user_company','set_user_company'],
    ['user_steuernummer','set_user_steuernummer'], ['user_uid','set_user_uid'],
    ['pdf_address','set_pdf_address'], ['pdf_plz','set_pdf_plz'], ['pdf_city','set_pdf_city'],
    ['pdf_phone','set_pdf_phone'], ['pdf_email','set_pdf_email'], ['pdf_website','set_pdf_website'],
    ['openai_api_key','set_openai_api_key'], ['openai_model','set_openai_model'],
    // V51 — KI-Determinismus + Stil
    ['ai_temperature','set_ai_temperature'], ['ai_seed','set_ai_seed'],
    ['ai_tone','set_ai_tone'], ['ai_risk_bias','set_ai_risk_bias'], ['ai_length','set_ai_length'],
    // V63.21 — KI-Prompt-Qualität
    ['ai_detail_level','set_ai_detail_level'], ['ai_tonality','set_ai_tonality'],
    ['ai_custom_instructions','set_ai_custom_instructions']
  ];
  fields.forEach(function(f) {
    var el = document.getElementById(f[1]);
    if (el != null) d[f[0]] = el.value;
  });
  // V63.21: Multi-Select Fokus-Schwerpunkte (Checkbox-Gruppe)
  var focusBoxes = document.querySelectorAll('input[name="set_ai_focus"]:checked');
  if (focusBoxes && focusBoxes.length >= 0) {
    d.ai_focus_areas = Array.prototype.slice.call(focusBoxes).map(function(b) { return b.value; });
  }
  // V63.72: Workflow-Bar-Toggle (Checkbox)
  var wfEl = document.getElementById('set_show_workflow_bar');
  if (wfEl) d.show_workflow_bar = !!wfEl.checked;
  window._SetDraft.dirty = _setIsDirty();
  _setUpdateDirtyHint();
}

function _setUpdateDirtyHint() {
  var hint = document.getElementById('settings-dirty-hint');
  if (hint) hint.style.display = window._SetDraft.dirty ? 'inline-flex' : 'none';
}

// ═══════════════════════════════════════════════════
// UI: Settings-Modal
// ═══════════════════════════════════════════════════
function showSettings(initialTab) {
  // V26: Wenn das Modal bereits offen ist und wir nur den Tab wechseln wollen,
  // den Draft NICHT re-initialisieren — sonst gehen ungespeicherte Eingaben verloren.
  var existing = document.getElementById('settings-modal');
  var modalAlreadyOpen = !!existing;
  if (existing) {
    _setCollectFormIntoDraft();
    existing.remove();
  }

  var s = Settings.get();

  // V26: Draft anlegen (falls noch nicht vorhanden) — sonst auf bestehendem Draft aufbauen
  if (!window._SetDraft.current) {
    window._SetDraft.current = Object.assign({}, s);
    window._SetDraft.dirty = false;
  }
  var draft = window._SetDraft.current;

  // Was im Form angezeigt wird = Draft (kann ungespeicherte Änderungen enthalten)
  var view = Object.assign({}, s, draft);

  var dsW = (typeof DealScore !== 'undefined') ? DealScore.getWeights() : { cashflow: 30, rendite: 25, ltv: 15, risiko: 15, potenzial: 15 };

  var modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.className = 'global-view-overlay';
  modal.innerHTML =
    '<div class="global-view-modal settings-modal set-modal-v2 set-modal-cream">' +
      // V87: Cream-Classic Split-Layout — Sidebar links (Header + Tabs + User-Foot),
      // Content rechts (Pane mit Header + Save-Row als Grid-Footer).
      '<aside class="modal-side">' +
        '<div class="ms-h">' +
          '<div class="ms-title">' +
            '<span class="ic"><svg width="18" height="18"><use href="#i-settings"/></svg></span>' +
            '<span class="gold">Einstellungen</span>' +
          '</div>' +
          '<div class="ms-sub">Account, KI, Deal Score-Gewichtung</div>' +
        '</div>' +

      '<div class="settings-tabs ms-tabs">' +
        '<button class="st-tab ms-tab active" data-tab="account" onclick="_swSet(this)"><span class="ic"><svg width="15" height="15"><use href="#i-user"/></svg></span>Account</button>' +
        '<button class="st-tab ms-tab" data-tab="security" onclick="_swSet(this)"><span class="ic"><svg width="15" height="15"><use href="#i-shield"/></svg></span>Sicherheit</button>' +
        '<button class="st-tab ms-tab" data-tab="contact" onclick="_swSet(this)"><span class="ic"><svg width="15" height="15"><use href="#i-pin"/></svg></span>Kontakt &amp; Logo</button>' +
        '<button class="st-tab ms-tab" data-tab="api" onclick="_swSet(this)"><span class="ic"><svg width="15" height="15"><use href="#i-brain"/></svg></span>KI</button>' +
        '<button class="st-tab ms-tab" data-tab="dealscore" onclick="_swSet(this)"><span class="ic"><svg width="15" height="15"><use href="#i-bar"/></svg></span>Deal Score</button>' +
        '<button class="st-tab ms-tab" data-tab="profilanzeige" onclick="_swSet(this)"><span class="ic"><svg width="15" height="15"><use href="#i-target"/></svg></span>Profil &amp; Anzeige</button>' +
        '<button class="st-tab ms-tab" data-tab="datenraum" onclick="_swSet(this)"><span class="ic"><svg width="15" height="15"><use href="#i-share"/></svg></span>Datenraum</button>' +
        // V63.57: Daten-Tab entfernt — Import/Export jetzt direkt aus der Sidebar
        '<button class="st-tab ms-tab" data-tab="plan" onclick="closeSettings(); if(typeof openPricingModal===\'function\') openPricingModal();"><span class="ic"><svg width="15" height="15"><use href="#i-star"/></svg></span>Plan</button>' +
        '<button class="st-tab ms-tab" data-tab="info" onclick="_swSet(this)"><span class="ic"><svg width="15" height="15"><use href="#i-info"/></svg></span>Info</button>' +
        '<button class="st-tab ms-tab" data-tab="rechtliches" onclick="_swSet(this)"><span class="ic"><svg width="15" height="15"><use href="#i-book"/></svg></span>Rechtliches</button>' +
        '<button class="st-tab ms-tab" data-tab="help" onclick="closeSettings(); if(typeof showHelp===\'function\') showHelp();"><span class="ic"><svg width="15" height="15"><use href="#i-help"/></svg></span>Hilfe</button>' +
      '</div>' +

      // V87: User-Foot in der Sidebar (Avatar + Name + E-Mail + Plan-Pille)
      '<div class="ms-foot">' +
        '<div class="av">' + _esc(((view.user_name || _getCurrentUserEmail() || 'U').charAt(0).toUpperCase())) + '</div>' +
        '<div>' +
          '<div class="nm">' + _esc(view.user_name || 'User') + '</div>' +
          '<div class="ml">' + _esc(_getCurrentUserEmail() || '') + '</div>' +
          '<span class="pl"><span class="ic"><svg width="8" height="8"><use href="#i-star"/></svg></span>' + _esc(_getCurrentPlanLabel() || 'Free') + '</span>' +
        '</div>' +
      '</div>' +
      '</aside>' +

      // V87: Content-Container rechts (Pane oben, Save-Row als Grid-Footer)
      '<div class="set-modal-content">' +
        // V108: X-Button oben rechts zum Schließen (wie bei anderen Modals)
        '<button type="button" class="set-modal-close" onclick="closeSettings()" aria-label="Schließen" title="Schließen (ESC)">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
        '<div class="pane-wrap">' +

      // Tab 1: Account (V63.21: umbenannt von "Personal" + Passwort + Logout + Plan-Anzeige)
      '<div class="st-pane active" data-pane="account">' +
        '<p class="hint">Account-Daten und Anmeldeinformationen. Diese Daten erscheinen auf deinen PDF-Exporten als Ersteller.</p>' +

        // Account-Info Block
        '<h3 class="set-section-h">Account-Info</h3>' +
        '<div class="g2">' +
          '<div class="f"><label>Name</label><input id="set_user_name" type="text" value="' + _esc(view.user_name) + '" placeholder="Max Mustermann"></div>' +
          '<div class="f"><label>E-Mail (Login)</label><input id="set_user_email_readonly" type="email" value="' + _esc(_getCurrentUserEmail()) + '" readonly style="opacity:0.7;cursor:not-allowed"></div>' +
        '</div>' +
        '<div class="g2">' +
          '<div class="f"><label>Rolle / Funktion</label><input id="set_user_role" type="text" value="' + _esc(view.user_role) + '" placeholder="Investor, Geschäftsführer"></div>' +
          '<div class="f"><label>Firma</label><input id="set_user_company" type="text" value="' + _esc(view.user_company) + '" placeholder="z.B. Mustermann GmbH"></div>' +
        '</div>' +
        '<div class="g2">' +
          '<div class="f"><label>Steuernummer</label><input id="set_user_steuernummer" type="text" value="' + _esc(view.user_steuernummer) + '" placeholder="DE123/456/7890"></div>' +
          '<div class="f"><label>USt-IdNr.</label><input id="set_user_uid" type="text" value="' + _esc(view.user_uid) + '" placeholder="DE123456789"></div>' +
        '</div>' +

        // Plan-Anzeige (read-only mit Link zum Plan-Tab)
        '<hr class="dvd">' +
        '<h3 class="set-section-h">Aktueller Plan</h3>' +
        '<div class="account-plan-box plan-box">' +
          '<div class="account-plan-name-wrap">' +
            '<div class="account-plan-name pl-name" id="account-plan-name"><span class="ic"><svg width="14" height="14"><use href="#i-star"/></svg></span>' + _esc(_getCurrentPlanLabel()) + '</div>' +
            '<div class="account-plan-meta pl-meta" id="account-plan-meta">' + _getCurrentPlanMeta() + '</div>' +
          '</div>' +
          '<button type="button" class="account-plan-link btn btn-ghost" onclick="closeSettings(); if(typeof openPricingModal===\'function\') openPricingModal();">Plan ändern <span class="ic"><svg width="12" height="12"><use href="#i-chevr"/></svg></span></button>' +
        '</div>' +

        // Passwort ändern Block (nur API-Mode)
        (typeof Auth !== 'undefined' && Auth.isApiMode && Auth.isApiMode() ?
          '<hr class="dvd">' +
          '<h3 class="set-section-h">Passwort ändern</h3>' +
          '<div class="g3">' +
            '<div class="f"><label>Aktuelles Passwort</label><input id="set_pwd_old" type="password" autocomplete="current-password"></div>' +
            '<div class="f"><label>Neues Passwort</label><input id="set_pwd_new" type="password" autocomplete="new-password"></div>' +
            '<div class="f"><label>Bestätigen</label><input id="set_pwd_new2" type="password" autocomplete="new-password"></div>' +
          '</div>' +
          '<div class="account-pw-actions">' +
            '<button type="button" class="btn btn-sm" onclick="_changePassword()">Passwort ändern</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" onclick="_resetPasswordEmail()" title="Passwort zurücksetzen per E-Mail">Vergessen?</button>' +
            '<span id="account-pw-msg" class="account-pw-msg"></span>' +
          '</div>'
        : '') +

        // Logout-Button (nur API-Mode)
        (typeof Auth !== 'undefined' && Auth.isApiMode && Auth.isApiMode() ?
          '<hr class="dvd">' +
          '<div class="account-logout-row">' +
            '<button type="button" class="btn-logout" onclick="_doLogout()">' + (window.Icons && Icons.logOut ? Icons.logOut({size:14}) : '') + ' Abmelden</button>' +
          '</div>' +
          // V63.76: Danger-Zone — Account-Löschung
          '<hr class="dvd">' +
          '<h3 class="set-section-h" style="color:var(--red,#B8625C)">Account löschen</h3>' +
          '<div class="danger-zone">' +
            '<div class="danger-text">' +
              '<strong>Achtung:</strong> Wenn du deinen Account löschst, werden ' +
              '<u>alle deine Objekte, Steuer-Records und Einstellungen</u> ' +
              'unwiderruflich gelöscht. Eine Wiederherstellung ist nicht möglich.' +
            '</div>' +
            '<button type="button" class="btn-delete-account" onclick="_deleteAccount()">' + (window.Icons && Icons.trash ? Icons.trash({size:14}) : '') + ' Account endgültig löschen</button>' +
          '</div>'
        : '') +

      '</div>' +

      // V63.80: Sicherheit-Tab — Zwei-Faktor-Authentifizierung
      '<div class="st-pane" data-pane="security" style="display:none">' +
        '<p class="hint">Schütze deinen Account mit Zwei-Faktor-Authentifizierung. Du brauchst dafür eine Authenticator-App auf deinem Smartphone (Google Authenticator, Authy, 1Password, Microsoft Authenticator).</p>' +
        '<div id="sec-2fa-host"><!-- wird beim Tab-Wechsel von _renderTwoFactor() befüllt --></div>' +
      '</div>' +

      // Tab 2: Contact & Logo
      '<div class="st-pane" data-pane="contact" style="display:none">' +
        '<p class="hint">Diese Kontaktdaten + Logo erscheinen im PDF-Footer und auf Track-Records.</p>' +

        // V63.21: Plan-Hinweis-Box (welche Felder werden in welchem Plan auf PDFs übernommen)
        (function() {
          var planKey = 'free';
          try {
            if (window.DealPilotConfig && DealPilotConfig.pricing) {
              planKey = DealPilotConfig.pricing.currentKey() || 'free';
            }
          } catch(e) {}
          var planMsgs = {
            free: { cls: 'plan-hint-free', icon: '🔒', title: 'Free-Plan', text: 'Kein eigenes Branding auf PDFs — nur DealPilot-Logo + Wasserzeichen.' },
            starter: { cls: 'plan-hint-starter', icon: '✓', title: 'Starter-Plan', text: 'Nur Name, E-Mail und Telefon werden auf PDFs übernommen. Logo, Adresse und Website nicht.' },
            investor: { cls: 'plan-hint-investor', icon: '✓', title: 'Investor-Plan', text: 'Vollständiges Branding inkl. Logo, Adresse, Website wird übernommen.' },
            pro: { cls: 'plan-hint-pro', icon: '✓', title: 'Pro-Plan', text: 'Vollständiges Branding inkl. Logo, Adresse, Website + erweiterte PDF-Features.' }
          };
          var msg = planMsgs[planKey] || planMsgs.free;
          return '<div class="plan-hint-box ' + msg.cls + '">' +
                   '<span class="plan-hint-icon">' + msg.icon + '</span>' +
                   '<div class="plan-hint-content">' +
                     '<strong>' + msg.title + '</strong>: ' + msg.text +
                   '</div>' +
                 '</div>';
        })() +

        '<div class="f"><label>Straße + Hausnummer</label><input id="set_pdf_address" type="text" value="' + _esc(view.pdf_address) + '" placeholder="z.B. Musterstraße 12"></div>' +
        '<div class="g2">' +
          '<div class="f"><label>PLZ</label><input id="set_pdf_plz" type="text" value="' + _esc(view.pdf_plz) + '" placeholder="32609"></div>' +
          '<div class="f"><label>Ort</label><input id="set_pdf_city" type="text" value="' + _esc(view.pdf_city) + '" placeholder="z.B. Musterstadt"></div>' +
        '</div>' +
        '<div class="g2">' +
          '<div class="f"><label>Telefon</label><input id="set_pdf_phone" type="text" value="' + _esc(view.pdf_phone) + '" placeholder="+49 151 ..."></div>' +
          '<div class="f"><label>E-Mail</label><input id="set_pdf_email" type="email" value="' + _esc(view.pdf_email) + '" placeholder="info@firma.de"></div>' +
        '</div>' +
        '<div class="f"><label>Webseite</label><input id="set_pdf_website" type="text" value="' + _esc(view.pdf_website) + '" placeholder="www.firma.de"></div>' +

        '<hr class="dvd"><h3 style="font-size:14px;margin:8px 0">Eigenes Logo für PDFs</h3>' +
        // V63.5: Hartes Feature-Gating — Logo-Upload nur bei custom_logo-Feature
        (function() {
          var hasCustomLogo = window.DealPilotConfig && DealPilotConfig.pricing &&
                              DealPilotConfig.pricing.hasFeature &&
                              DealPilotConfig.pricing.hasFeature('custom_logo');
          if (!hasCustomLogo) {
            return '<div class="feature-gate-card">' +
                     '<div class="feature-gate-icon">🔒</div>' +
                     '<div class="feature-gate-text">' +
                       '<strong>Eigenes Logo nur in Investor / Pro</strong><br>' +
                       'In den Plänen Free und Starter wird das DealPilot-Logo verwendet. ' +
                       'Upgrade auf Investor oder Pro um dein eigenes Logo zu hinterlegen.' +
                     '</div>' +
                     '<button class="btn btn-gold btn-sm" type="button" onclick="closeSettings();openPricingModal()">Upgrade</button>' +
                   '</div>';
          }
          return '<p class="hint">Wird im PDF-Header verwendet. Empfohlen: PNG, 300×100 px.</p>' +
            '<div class="set-logo-row">' +
              '<div class="set-logo-preview">' +
                (view.pdf_logo_b64 ? '<img src="' + view.pdf_logo_b64 + '" alt="Logo">' : '<span class="set-logo-empty">Kein Logo gesetzt</span>') +
              '</div>' +
              '<div>' +
                '<label class="btn-outline" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">' + (window.Icons && Icons.upload ? Icons.upload({size:14}) : '') + ' Logo hochladen<input type="file" id="set_logo_file" accept="image/*" onchange="_uploadLogo(this)" style="display:none"></label>' +
                (view.pdf_logo_b64 ? '<button class="btn-ghost" onclick="_removeLogo()" style="margin-left:6px;display:inline-flex;align-items:center;gap:6px">' + (window.Icons && Icons.trash ? Icons.trash({size:14}) : '') + ' Entfernen</button>' : '') +
              '</div>' +
            '</div>';
        })() +
      '</div>' +

      // Tab 3: KI — V63.22: Nur Prompt-Qualität (User-Wunsch: API-Key kommt vom Server,
      // User soll da nichts einstellen können). Determinismus + alte Stil-Settings entfernt.
      '<div class="st-pane" data-pane="api" style="display:none">' +
        // V63.86: KI-Credits-Übersicht oben in der KI-Pane
        '<h3 class="set-section-h">KI-Credits</h3>' +
        '<div id="set-ai-credits-host"><div class="hint">Lädt…</div></div>' +
        '<hr class="dvd">' +
        '<p class="hint">Diese Einstellungen werden allen KI-Analysen (KI-Lage, Quick-Check, Investor Deal Score AI) angehängt.</p>' +

        '<h3 class="set-section-h">Prompt-Qualität</h3>' +

        '<div class="g2">' +
          '<div class="f">' +
            '<label>Detailgrad</label>' +
            '<select id="set_ai_detail_level">' +
              [['kurz','kurz (Stichpunkte)'], ['mittel','mittel (1–2 Sätze pro Punkt)'], ['ausfuehrlich','ausführlich (mit Begründung)']].map(function(o) {
                return '<option value="' + o[0] + '"' + (view.ai_detail_level === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
          '<div class="f">' +
            '<label>Tonalität</label>' +
            '<select id="set_ai_tonality">' +
              [['sachlich','sachlich (neutral)'], ['beratend','beratend (Empfehlungen)'], ['kritisch','kritisch (Risiken zuerst)']].map(function(o) {
                return '<option value="' + o[0] + '"' + (view.ai_tonality === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +

        '<div class="f">' +
          '<label>Fokus-Schwerpunkte (Mehrfachauswahl)</label>' +
          '<div class="ai-focus-checks">' +
            ['Lage','Mietmarkt','Risiken','Sanierung','Steuern','Exit-Strategie'].map(function(f) {
              var checked = (Array.isArray(view.ai_focus_areas) && view.ai_focus_areas.indexOf(f) >= 0) ? ' checked' : '';
              return '<label class="ai-focus-check"><input type="checkbox" name="set_ai_focus" value="' + f + '"' + checked + '> ' + f + '</label>';
            }).join('') +
          '</div>' +
        '</div>' +

        '<div class="f">' +
          '<label>Eigene Anweisungen <span class="f-hint">(max. 500 Zeichen — wird allen Prompts angehängt)</span></label>' +
          '<textarea id="set_ai_custom_instructions" rows="3" maxlength="500" placeholder="z.B. \'z.B. Berücksichtige meinen lokalen Markt und meine Investment-Strategie.\'">' + _esc(view.ai_custom_instructions || '') + '</textarea>' +
        '</div>' +

        // V63.96: Standard-Analyseparameter aus dem Profile-Tab hierher verschoben (Marcels Wunsch).
        // V63.99 BUG-FIX: get() benötigt einen Key. Vorher hieß es DealPilotInvestmentProfile.get()
        // ohne Argument → undefined. Das warf TypeError beim Zugriff auf .ai_strat und
        // verhinderte das gesamte Settings-Modal-Render. Jetzt direkt einzelne Keys abfragen.
        '<h3 class="set-section-h" style="margin-top:24px">Standard-Analyseparameter</h3>' +
        '<p class="hint" style="margin-top:-6px;margin-bottom:14px">Diese Werte fließen in jeden KI-Analyse-Prompt ein. Sie sind pro Objekt im KI-Tab überschreibbar.</p>' +
        (function() {
          var ipApi = (window.DealPilotInvestmentProfile && DealPilotInvestmentProfile.get) ? DealPilotInvestmentProfile : null;
          var aiStrat = (ipApi ? ipApi.get('ai_strat') : null) || 'Buy & Hold (Langfristig halten)';
          var aiVerk  = (ipApi ? ipApi.get('ai_verk')  : null) || 'Mittel (normale Situation)';
          var aiRisk  = (ipApi ? ipApi.get('ai_risk')  : null) || 'Moderat (ausgewogen)';
          var aiMarkt = (ipApi ? ipApi.get('ai_markt') : null) || 'Ausgeglichen (stabil)';
          function opts(arr, sel) {
            return arr.map(function(o){
              return '<option' + (o === sel ? ' selected' : '') + '>' + o + '</option>';
            }).join('');
          }
          return '<div class="g2">' +
            '<div class="f">' +
              '<label>Investitionsstrategie</label>' +
              '<select id="set_ai_strat">' + opts(['Buy & Hold (Langfristig halten)','Value-Add (Aufwertung & halten)','Cash-Flow-Fokus (maximaler CF)','Wertsteigerungs-Fokus'], aiStrat) + '</select>' +
            '</div>' +
            '<div class="f">' +
              '<label>Verkäuferbereitschaft</label>' +
              '<select id="set_ai_verk">' + opts(['Hoch (dringender Verkauf, Zeitdruck)','Mittel (normale Situation)','Niedrig (gut situiert, kein Druck)'], aiVerk) + '</select>' +
            '</div>' +
            '<div class="f">' +
              '<label>Eigene Risikotoleranz</label>' +
              '<select id="set_ai_risk">' + opts(['Konservativ (Sicherheit ist wichtigst)','Moderat (ausgewogen)','Aggressiv (hohe Rendite ist wichtig)'], aiRisk) + '</select>' +
            '</div>' +
            '<div class="f">' +
              '<label>Aktuelle Marktphase</label>' +
              '<select id="set_ai_markt">' + opts(['Käufermarkt (Preise fallen)','Ausgeglichen (stabil)','Verkäufermarkt (Preise steigen)'], aiMarkt) + '</select>' +
            '</div>' +
          '</div>';
        })() +

        '<div class="f">' +
          // V63.78: Vorlagen kategorisiert mit Multi-Select-Checkboxes
          '<div class="ai-suggestions">' +
            '<div class="ai-sugg-head">' +
              'Vorlagen nach Kategorie — wähle aus, was dir wichtig ist' +
              '<button type="button" class="ai-sugg-apply" onclick="_aiSuggApplySelected()">' +
                (window.Icons && Icons.check ? Icons.check({size:13}) : '') + ' Auswahl übernehmen' +
              '</button>' +
            '</div>' +
            // 4 Kategorien als zusammenklappbare Sektionen
            (function() {
              var cats = [
                { k: 'kpi', icon: 'barChart', label: 'Kennzahlen-Fokus', items: [
                  'Bewerte meine Kaufentscheidung anhand meines persönlichen Investmentprofils (Mindest-DSCR, Max-LTV, Mindest-Cashflow).',
                  'Beziehe alle DealPilot-Kennzahlen (DSCR, LTV, Cashflow vor/nach Steuer, Bruttorendite) explizit in deine Begründung ein.',
                  'Berücksichtige den Investor-DealScore: gewichte Cashflow, Rendite und Risiko gemäß meiner Settings.'
                ]},
                { k: 'lage', icon: 'compass', label: 'Lage & Markt', items: [
                  'Lege besonderen Fokus auf Lage, Mikrolage und langfristiges Mietsteigerungspotenzial.',
                  'Berücksichtige meinen lokalen Markt (Region NRW/OWL) und vergleichbare Mietspiegel.',
                  'Vergleiche das Objekt mit aktuellen Marktmieten der gleichen Lage und Baujahr-Klasse.'
                ]},
                { k: 'risiko', icon: 'alert', label: 'Risiko & Konservativität', items: [
                  'Beziehe Zinsbindungs-Risiko und Zinsänderungsszenario nach Auslauf der Sollzinsbindung mit ein.',
                  'Bewerte konservativ — gehe von 5 % Mietausfall und höheren Bewirtschaftungskosten als Standard aus.',
                  'Stelle Worst-Case- und Best-Case-Szenarien gegenüber.'
                ]},
                { k: 'bank', icon: 'building', label: 'Bank & Finanzierung', items: [
                  'Erkläre Bankargumente in Profi-Sprache — als ob du der Verhandler beim Finanzierungsgespräch wärst.',
                  'Identifiziere die wichtigsten Argumente, mit denen die Bank überzeugt wird.',
                  'Bewerte ob die Finanzierungsstruktur tragfähig ist und schlage Optimierungen vor.'
                ]}
              ];
              return cats.map(function(c) {
                var iconHtml = (window.Icons && Icons[c.icon]) ? Icons[c.icon]({size:14}) : '';
                return '<div class="ai-sugg-cat">' +
                  '<div class="ai-sugg-cat-head">' +
                    '<span class="ai-sugg-cat-icon">' + iconHtml + '</span>' +
                    '<span>' + c.label + '</span>' +
                  '</div>' +
                  '<div class="ai-sugg-cat-items">' +
                    c.items.map(function(t, i) {
                      var id = 'ai-sugg-' + c.k + '-' + i;
                      var dataAttr = ' data-text="' + _esc(t).replace(/"/g, '&quot;') + '"';
                      return '<label class="ai-sugg-item" for="' + id + '">' +
                        '<input type="checkbox" id="' + id + '" class="ai-sugg-cb"' + dataAttr + '>' +
                        '<span>' + _esc(t) + '</span>' +
                      '</label>';
                    }).join('') +
                  '</div>' +
                '</div>';
              }).join('');
            })() +
          '</div>' +
        '</div>' +

      '</div>' +

      // Tab 4: DealScore
      '<div class="st-pane" data-pane="dealscore" style="display:none">' +

        // V111: DS1 + DS2 schließen sich gegenseitig aus — Plan-Konfig steuert was sichtbar ist
        // ───── DEALPILOT SCORE (klassisch) — nur wenn deal_score_basic aktiv ─────
        ((window.DealPilotConfig && DealPilotConfig.pricing &&
          DealPilotConfig.pricing.hasFeature('deal_score_basic'))
        ? (
        '<div class="ds-pane-section">' +
          '<div class="ds-pane-header">' +
            '<div class="ds-pane-icon-wrap ds-pane-icon-classic">' + (window.Icons && Icons.barChart ? Icons.barChart({size:18}) : '') + '</div>' +
            '<div>' +
              '<h3 class="ds-pane-title">DealPilot Score (Quick-Check)</h3>' +
              '<p class="ds-pane-sub">5 Hauptfaktoren · IMMER sichtbar · entspricht dem Quick-Check Score</p>' +
            '</div>' +
          '</div>' +
          '<div class="ds-settings-grid">' +
            ['cashflow','rendite','ltv','risiko','potenzial'].map(function(k) {
              var labels = {
                cashflow: 'Cashflow',
                rendite:  'Rendite (Nettomietrendite)',
                ltv:      'Beleihung (LTV)',
                risiko:   'Risiko (DSCR)',
                potenzial:'Potenzial (Bruttofaktor)'
              };
              return '<div class="ds-setting-row">' +
                '<label>' + labels[k] + '</label>' +
                '<div class="ds-setting-input">' +
                  '<input id="set-ds-' + k + '" type="range" min="0" max="60" value="' + dsW[k] + '" oninput="_updateSetDsLabel(this)">' +
                  '<span class="ds-w-val" id="set-ds-' + k + '-val">' + dsW[k] + '%</span>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
          '<div class="ds-sum-row"><span>Summe der Gewichtungen:</span><span id="set-ds-sum">100%</span></div>' +
          '<div class="ds-pane-actions">' +
            '<button class="btn btn-outline btn-sm" onclick="_resetDsWeights()">↺ Standard wiederherstellen</button>' +
          '</div>' +
        '</div>'
        ) : '') +

        // ───── INVESTOR DEAL SCORE (DS2) — nur wenn deal_score_v2 aktiv ─────
        ((window.DealPilotConfig && DealPilotConfig.pricing &&
          DealPilotConfig.pricing.hasFeature('deal_score_v2'))
        ? (
        '<div class="ds-pane-section ds-pane-section-investor">' +
          '<div class="ds-pane-header">' +
            '<div class="ds-pane-icon-wrap ds-pane-icon-investor">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
            '</div>' +
            '<div>' +
              '<h3 class="ds-pane-title">Investor Deal Score</h3>' +
              '<p class="ds-pane-sub">Erweiterter Score mit 24 KPIs · ab 70% KPI-Vollständigkeit sichtbar · Investor/Pro-Plan</p>' +
            '</div>' +
          '</div>' +
          // V63.21: INLINE-Konfiguration (statt Modal-über-Modal — User-Wunsch V22)
          '<div id="ds2-settings-body-inline" class="ds2-settings-body-inline">' +
            '<p class="hint">Lade Investor Deal Score Konfiguration...</p>' +
          '</div>' +
          '<div class="ds-pane-actions">' +
            '<button class="btn btn-ghost btn-sm" type="button" onclick="ds2ResetConfigFromSettings()">' +
              '↺ Auf Standard zurücksetzen' +
            '</button>' +
          '</div>' +
        '</div>'
        ) : '') +

      '</div>' +

      // V63.57: Daten-Tab entfernt — Import/Export jetzt direkt aus der Sidebar

      // V63.5: Plan-Tab raus aus Settings — geöffnet wird über User-Submenü als eigenständiges Modal (pricing-modal.js)
      // V51 — Tab 7: Info
      '<div class="st-pane" data-pane="info" style="display:none">' +
        _renderInfoPane() +
      '</div>' +

      // V142: Tab Rechtliches — Impressum + Datenschutz dauerhaft ausgeklappt
      '<div class="st-pane" data-pane="rechtliches" style="display:none">' +
        _renderRechtlichesPane() +
      '</div>' +

      // V63.78: "Profil & Anzeige" — vereint Investmentprofil + Anzeige-Toggles
      '<div class="st-pane" data-pane="datenraum" style="display:none">' +
        '<h2 class="set-section-h2">Datenraum</h2>' +
        '<div id="dr-settings-host"><!-- wird beim Tab-Wechsel befüllt --></div>' +
      '</div>' +

      '<div class="st-pane" data-pane="profilanzeige" style="display:none">' +
        '<div id="ip-pane-host"><!-- wird beim Tab-Wechsel von DealPilotInvestmentProfile.renderPaneHtml() befüllt --></div>' +
        '<hr class="dvd" style="margin:32px 0 22px">' +
        '<h2 class="set-section-h2">Anzeige-Optionen</h2>' +
        '<p class="hint">Steuere, welche UI-Elemente in der App angezeigt werden.</p>' +

        // V63.77: App-Start-View konfigurierbar
        '<h3 class="set-section-h">Beim Start öffnen</h3>' +
        '<div class="f startup-view-row">' +
          '<div class="startup-view-desc">' +
            'Welcher Bereich soll geöffnet werden, wenn du die App startest?' +
          '</div>' +
          '<select id="set_startup_view" onchange="_setStartupView(this.value)">' +
            '<option value="objekt">Tab "Objekt" (Default)</option>' +
            '<option value="quickcheck">Quick-Check (Standalone)</option>' +
            '<option value="all-objects">Alle Objekte (Übersicht)</option>' +
          '</select>' +
        '</div>' +

        /* V76: Workflow-Bar-Section entfernt — Steps + Fortschritt sind jetzt direkt
           in der Tab-Bar integriert (Häkchen + Status-Badge). */

        '<h3 class="set-section-h" style="margin-top:24px">Hilfe & Dokumentation</h3>' +
        '<div class="f setting-row-card setting-row-card-gold">' +
          '<div>' +
            '<div class="setting-row-title setting-row-title-gold">' + (window.Icons && Icons.help ? Icons.help({size:14}) : '') + ' DealPilot-Hilfe öffnen</div>' +
            '<div class="setting-row-desc">9 Themen mit Erklärungen zu Kennzahlen, Finanzierung, Steuern, Charts, KI-Analyse, FAQ und Glossar. Mit Suche und KI-Assistent.</div>' +
          '</div>' +
          '<button class="btn btn-gold" type="button" onclick="closeSettings(); if(typeof showHelp===\'function\') showHelp();">Öffnen →</button>' +
        '</div>' +
        /* === V213 collapse-toggle profilanzeige START === */
        '<hr class="dvd">' +
        '<h3 class="set-section-h">Markt-Daten im Tab Finanzierung</h3>' +
        '<div class="v213-set-toggle" style="padding:12px 14px;background:#FAF9F4;border-radius:8px;border:1px solid rgba(201,168,76,0.25)">' +
          '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">' +
            '<input type="checkbox" id="set_collapse_market_cards"' + (_v213IsChecked()?' checked':'') + ' style="margin-top:3px;flex-shrink:0;cursor:pointer;" onchange="_v213OnToggleChange(this)">' +
            '<span>' +
              '<span style="display:block;font-size:13px;color:var(--ch,#2A2727);font-weight:500">Markt-Daten-Cards standardmäßig zugeklappt</span>' +
              '<span style="display:block;font-size:11.5px;color:var(--muted,#5F5E5A);margin-top:2px;line-height:1.5;font-weight:400">Wenn aktiviert: Markt-Kontext, Marktzinsen und Pfandbrief-Card im Finanzierung-Tab werden beim Laden zugeklappt. Du kannst sie jederzeit einzeln per Klick öffnen.</span>' +
            '</span>' +
          '</label>' +
          '<div style="margin-top:10px;text-align:right">' +
            '<button type="button" class="btn btn-sm btn-ghost" onclick="_v213ResetCards()" title="Verwirft alle manuellen Klapp-Entscheidungen">Alle Karten zurücksetzen</button>' +
          '</div>' +
        '</div>' +
        /* === V213 collapse-toggle profilanzeige END === */
      '</div>' +
      '</div>' +    // pane-wrap Ende
      '<div class="settings-footer save-row">' +
        '<div class="save-info">' +
          '<span id="settings-dirty-hint" class="settings-dirty-hint" style="display:none">● ungespeicherte Änderungen</span>' +
          '<span class="save-info-text">Auto-Save aktiv · Änderungen werden direkt übernommen</span>' +
        '</div>' +
        '<div class="btns">' +
          '<button class="btn btn-ghost" onclick="closeSettings()">Abbrechen</button>' +
          '<button class="btn btn-gold" onclick="_saveSettings()"><span class="ic"><svg width="12" height="12"><use href="#i-check"/></svg></span>Speichern</button>' +
        '</div>' +
      '</div>' +
      '</div>' +    // set-modal-content Ende
    '</div>';
  document.body.appendChild(modal);

  // V108: Backdrop-Klick + ESC-Taste schließen das Settings-Modal
  //       Marcel-Wunsch: schließbar ohne extra "Abbrechen" zu drücken
  modal.addEventListener('click', function(e) {
    // Nur wenn auf Backdrop geklickt wird (nicht auf Inhalt)
    if (e.target === modal) {
      closeSettings();
    }
  });
  // ESC-Handler — wird beim Schließen wieder entfernt (in closeSettings)
  window._setEscHandler = function(e) {
    if (e.key === 'Escape' || e.keyCode === 27) {
      closeSettings();
    }
  };
  document.addEventListener('keydown', window._setEscHandler);

  // V26: oninput an alle Form-Inputs binden, damit Draft live updated wird
  modal.querySelectorAll('input, select, textarea').forEach(function(el) {
    if (el.type === 'file') return;        // Files separat behandelt
    el.addEventListener('input', _setOnInput);
    el.addEventListener('change', _setOnInput);
  });

  // V26: Tab-Initialwahl
  if (initialTab) {
    var btn = modal.querySelector('.st-tab[data-tab="' + initialTab + '"]');
    if (btn) _swSet(btn);
  }

  setTimeout(_updateSetDsSum, 100);
  _setUpdateDirtyHint();

  // V63.57/V63.74: SVG-Icons in Settings-Tabs + Header rendern
  if (window.Icons) {
    document.querySelectorAll('.st-tab-ico[data-icon], .set-head-icon[data-icon]').forEach(function(el) {
      if (el.querySelector('svg')) return;
      var key = el.getAttribute('data-icon');
      var size = el.classList.contains('set-head-icon') ? 22 : 14;
      if (Icons[key]) el.innerHTML = Icons[key]({ size: size });
    });
  }

  // V63.26: Plan-Anzeige asynchron aktualisieren — Sub.getCurrent() ist async,
  // beim ersten Render zeigt _getCurrentPlanLabel() ggf. nur den localStorage-Override
  // bzw. 'Free'. Sobald die echte Subscription geladen ist, Label refreshen.
  setTimeout(function() {
    if (typeof Sub !== 'undefined' && typeof Sub.getCurrent === 'function') {
      Sub.getCurrent().then(function(sub) {
        var labelEl = document.getElementById('account-plan-name');
        if (labelEl && sub) {
          // V63.27/28: Sub.getCurrent() returns Objekt {plan_id, plan_name, ...}
          var planKey = (sub.plan_id || '').toLowerCase();
          // V63.28: Legacy-Plan-IDs auf free mappen
          if (planKey === 'business' || planKey === 'enterprise') {
            planKey = 'free';
          }
          var map = { free: 'Free', starter: 'Starter', investor: 'Investor', pro: 'Pro' };
          // Bevorzugt: Mapping aus map[planKey] (saubere deutsche Labels), nicht plan_name
          // (plan_name kann aus der DB "Business"/"Enterprise" kommen — Legacy)
          labelEl.textContent = map[planKey] || (planKey ? (planKey.charAt(0).toUpperCase() + planKey.slice(1)) : 'Free');
        }
      }).catch(function(){});
    } else {
      // Fallback: noch mal lokal lesen falls beim ersten Render zu früh
      var labelEl2 = document.getElementById('account-plan-name');
      if (labelEl2) labelEl2.textContent = _getCurrentPlanLabel();
    }
  }, 150);
}

function _esc(v) { return (v || '').toString().replace(/"/g, '&quot;'); }

// V63.21: Account-Helpers — User-Email aus Session
function _getCurrentUserEmail() {
  try {
    var session = JSON.parse(localStorage.getItem('ji_session') || '{}');
    if (session && session.email) return session.email;
  } catch(e) {}
  return '—';
}

function _getCurrentPlanLabel() {
  try {
    if (typeof DealPilotConfig !== 'undefined' && DealPilotConfig.pricing) {
      var key = DealPilotConfig.pricing.currentKey() || 'free';
      var plan = DealPilotConfig.pricing.get ? DealPilotConfig.pricing.get(key) : null;
      if (plan && plan.label) return plan.label;
      // Fallback Mapping
      var map = { free: 'Free', starter: 'Starter', investor: 'Investor', pro: 'Pro' };
      return map[key] || key;
    }
  } catch(e) {}
  return 'Free';
}

// V63.82: Meta-Info-Zeile unter dem Plan-Namen (Objekte, KI-Credits)
function _getCurrentPlanMeta() {
  try {
    if (typeof Plan === 'undefined') return '';
    var objLimit = Plan.limit('objects');
    var aiLimit  = Plan.limit('ai_credits');
    var parts = [];
    if (objLimit > 0)        parts.push(objLimit + ' Objekt' + (objLimit === 1 ? '' : 'e'));
    else if (objLimit < 0)   parts.push('unbegrenzte Objekte');
    if (aiLimit > 0)         parts.push(aiLimit + ' KI-Credits / Monat');
    else if (aiLimit === 1)  parts.push('1 KI-Analyse');
    return _esc(parts.join(' · '));
  } catch(e) { return ''; }
}

// V63.21: Passwort ändern (API-Mode)
async function _changePassword() {
  var msgEl = document.getElementById('account-pw-msg');
  function _msg(text, isError) {
    if (msgEl) {
      msgEl.textContent = text;
      msgEl.className = 'account-pw-msg' + (isError ? ' err' : ' ok');
    }
  }
  var oldPwd = document.getElementById('set_pwd_old').value;
  var newPwd = document.getElementById('set_pwd_new').value;
  var newPwd2 = document.getElementById('set_pwd_new2').value;
  if (!oldPwd) { _msg('Aktuelles Passwort fehlt', true); return; }
  if (!newPwd) { _msg('Neues Passwort fehlt', true); return; }
  if (newPwd.length < 6) { _msg('Neues Passwort muss mindestens 6 Zeichen haben', true); return; }
  if (newPwd !== newPwd2) { _msg('Neues Passwort und Bestätigung stimmen nicht überein', true); return; }
  try {
    // V63.22 Fix: Backend-Schema erwartet camelCase oldPassword / newPassword (NICHT snake_case)
    await Auth.apiCall('/auth/change-password', {
      method: 'POST',
      body: { oldPassword: oldPwd, newPassword: newPwd }
    });
    _msg('✓ Passwort geändert', false);
    document.getElementById('set_pwd_old').value = '';
    document.getElementById('set_pwd_new').value = '';
    document.getElementById('set_pwd_new2').value = '';
  } catch(e) {
    var em = e.message || 'Unbekannt';
    // Bei "Validation failed" oder "Invalid input" → spezifischere Hinweise
    if (/validation|invalid input/i.test(em)) {
      _msg('Ungültige Eingabe — Passwort prüfen (mind. 6 Zeichen, max 128)', true);
    } else if (/incorrect|wrong|invalid/i.test(em)) {
      _msg('Aktuelles Passwort ist falsch', true);
    } else {
      _msg('Fehler: ' + em, true);
    }
  }
}
window._changePassword = _changePassword;

async function _resetPasswordEmail() {
  var email = _getCurrentUserEmail();
  if (!email || email === '—') return;
  if (!confirm('Soll ein Passwort-Reset-Link an ' + email + ' gesendet werden?')) return;
  try {
    await Auth.apiCall('/auth/request-password-reset', {
      method: 'POST',
      body: { email: email }
    });
    alert('Reset-Link wurde an ' + email + ' gesendet (falls die Adresse registriert ist).');
  } catch(e) {
    alert('Fehler: ' + (e.message || 'Unbekannt'));
  }
}
window._resetPasswordEmail = _resetPasswordEmail;

function _doLogout() {
  if (!confirm('Wirklich abmelden?')) return;
  try {
    if (typeof Auth !== 'undefined' && Auth.logout) Auth.logout();
    localStorage.removeItem('ji_token');
    localStorage.removeItem('ji_session');
    location.reload();
  } catch(e) {
    location.reload();
  }
}
window._doLogout = _doLogout;

function _swSet(btn) {
  // V26: Vor Tab-Wechsel aktuellen Form-Stand in Draft übernehmen
  _setCollectFormIntoDraft();
  var pane = btn.dataset.tab;
  document.querySelectorAll('.st-tab').forEach(function(t) { t.classList.toggle('active', t === btn); });
  document.querySelectorAll('.st-pane').forEach(function(p) {
    var show = p.dataset.pane === pane;
    p.classList.toggle('active', show);
    p.style.display = show ? '' : 'none';
  });
  // V63.2: Modal breiter machen wenn Plan-Tab aktiv ist
  var modal = document.querySelector('.settings-modal');
  if (modal) {
    if (pane === 'plan') modal.classList.add('is-plan-tab');
    else modal.classList.remove('is-plan-tab');
  }
  // V63.21: Bei Wechsel auf DealScore-Tab das DS2-Inline-Form rendern
  if (pane === 'dealscore' && typeof _ds2FillSettingsForm === 'function') {
    setTimeout(_ds2FillSettingsForm, 30);
  }
  // V63.86: KI-Tab — Credits-Box rendern
  if (pane === 'api' && window.AiCredits) {
    var creditsHost = document.getElementById('set-ai-credits-host');
    if (creditsHost) {
      window.AiCredits.refresh(true).then(function(){
        window.AiCredits.renderSettingsBox(creditsHost);
      });
    }
  }
  // V63.76: Bei Wechsel auf Investmentprofil-Tab das Pane lazy rendern
  // V63.78: vereinter Tab "Profil & Anzeige" — beide Panes initialisieren
  // V63.80: Sicherheit-Pane — 2FA-Status laden + UI rendern
  if (pane === 'security') {
    if (typeof _renderTwoFactor === 'function') _renderTwoFactor();
  }

  // V140: Datenraum-Pane lazy rendern
  if (pane === 'datenraum') {
    if (window.DealPilotDatenraum) {
      var drHost = document.getElementById('dr-settings-host');
      if (drHost) drHost.innerHTML = window.DealPilotDatenraum.renderSettingsTab();
    }
  }

  // V63.78: vereinter Tab "Profil & Anzeige" — beide Panes initialisieren
  if (pane === 'profilanzeige') {
    if (window.DealPilotInvestmentProfile) {
      var host = document.getElementById('ip-pane-host');
      if (host) host.innerHTML = window.DealPilotInvestmentProfile.renderPaneHtml();
    }
    var sel = document.getElementById('set_startup_view');
    if (sel) {
      try {
        var current = localStorage.getItem('dp_startup_view') || 'objekt';
        sel.value = current;
      } catch (e) {}
    }
  }
  _setUpdateDirtyHint();
}

/**
 * V26: Wird von Form-Inputs bei jedem Keystroke aufgerufen, um Draft live zu aktualisieren.
 */
function _setOnInput() {
  _setCollectFormIntoDraft();
}

function closeSettings() {
  if (window._SetDraft && window._SetDraft.dirty) {
    if (!confirm('Du hast ungespeicherte Änderungen. Trotzdem schließen?')) return;
  }
  var m = document.getElementById('settings-modal');
  if (m) m.remove();
  window._SetDraft.current = null;
  window._SetDraft.dirty = false;
  // V108: ESC-Handler entfernen damit nicht alle Schließen-Tasten kumulieren
  if (window._setEscHandler) {
    document.removeEventListener('keydown', window._setEscHandler);
    window._setEscHandler = null;
  }
}

function _uploadLogo(input) {
  // V63.5: Hartes Feature-Gate als Server-side-Backup
  if (window.DealPilotConfig && DealPilotConfig.pricing && DealPilotConfig.pricing.hasFeature &&
      !DealPilotConfig.pricing.hasFeature('custom_logo')) {
    if (typeof toast === 'function') toast('🔒 Eigenes Logo nur in Investor/Pro-Plan');
    if (input) input.value = '';
    return;
  }
  var f = input.files[0];
  if (!f) return;
  if (f.size > 1024 * 1024) {
    alert('Bild zu groß (max. 1 MB)');
    return;
  }
  // V26: Form-Werte in Draft sichern bevor wir Logo speichern
  _setCollectFormIntoDraft();
  var reader = new FileReader();
  reader.onload = function(e) {
    var s = Settings.get();
    s.pdf_logo_b64 = e.target.result;
    Settings.save(s);
    // Draft auch updaten, damit beim Re-Render das neue Logo angezeigt wird
    if (window._SetDraft.current) window._SetDraft.current.pdf_logo_b64 = e.target.result;
    showSettings('contact');
  };
  reader.readAsDataURL(f);
}

function _removeLogo() {
  _setCollectFormIntoDraft();
  var s = Settings.get();
  s.pdf_logo_b64 = '';
  Settings.save(s);
  if (window._SetDraft.current) window._SetDraft.current.pdf_logo_b64 = '';
  showSettings('contact');
}

async function _testApi() {
  var key = document.getElementById('set_openai_api_key').value.trim();
  var status = document.getElementById('api-test-status');
  if (!key) {
    status.innerHTML = '<span style="color:var(--red)">⚠ Bitte erst Key eingeben</span>';
    return;
  }
  status.innerHTML = '<span style="color:var(--muted)">⏳ Teste Verbindung...</span>';
  try {
    var resp = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    if (resp.ok) {
      status.innerHTML = '<span style="color:var(--green)">✓ Verbindung erfolgreich</span>';
    } else {
      status.innerHTML = '<span style="color:var(--red)">✗ Fehler: ' + resp.status + ' ' + resp.statusText + '</span>';
    }
  } catch (e) {
    status.innerHTML = '<span style="color:var(--red)">✗ ' + e.message + '</span>';
  }
}

function _updateSetDsLabel(input) {
  var lbl = document.getElementById(input.id + '-val');
  if (lbl) lbl.textContent = input.value + '%';
  _updateSetDsSum();
  // V26: DS-Slider zählt auch als ungespeicherte Änderung
  if (window._SetDraft) { window._SetDraft.dirty = true; _setUpdateDirtyHint(); }
}

function _updateSetDsSum() {
  var sum = 0;
  ['cashflow','rendite','ltv','risiko','potenzial'].forEach(function(k) {
    var inp = document.getElementById('set-ds-' + k);
    if (inp) sum += parseInt(inp.value) || 0;
  });
  var sumEl = document.getElementById('set-ds-sum');
  if (sumEl) {
    sumEl.textContent = sum + '%';
    sumEl.style.color = Math.abs(sum - 100) < 0.5 ? 'var(--green)' : 'var(--red)';
  }
}

function _resetDsWeights() {
  if (typeof DealScore === 'undefined') return;
  var d = DealScore.getDefaults();
  ['cashflow','rendite','ltv','risiko','potenzial'].forEach(function(k) {
    var inp = document.getElementById('set-ds-' + k);
    if (inp) {
      inp.value = d[k];
      _updateSetDsLabel(inp);
    }
  });
}

function _saveSettings() {
  // V26: Sicherstellen, dass aktuelle Form-Werte im Draft sind, bevor wir speichern
  _setCollectFormIntoDraft();

  var s = Settings.get();
  var d = (window._SetDraft && window._SetDraft.current) || {};

  // Werte aus Draft übernehmen (covers alle Tabs, auch wenn aktueller Tab woanders ist)
  ['user_name','user_role','user_company','user_steuernummer','user_uid',
   'pdf_address','pdf_plz','pdf_city','pdf_phone','pdf_email','pdf_website',
   'openai_api_key','openai_model','pdf_logo_b64',
   // V51 KI
   'ai_temperature','ai_seed','ai_tone','ai_risk_bias','ai_length',
   // V63.21 KI Prompt-Qualität
   'ai_detail_level','ai_tonality','ai_custom_instructions',
   // V63.72 UI
   'show_workflow_bar'
  ].forEach(function(k) {
    if (d[k] != null) s[k] = d[k];
  });
  // V63.21: ai_focus_areas ist Array, nicht aus Form-Field sondern aus Draft direkt
  if (Array.isArray(d.ai_focus_areas)) s.ai_focus_areas = d.ai_focus_areas;

  Settings.save(s);

  // V63.96: Standard-Analyseparameter (set_ai_strat etc.) jetzt im KI-Tab.
  // V63.99 BUG-FIX: load() statt get() — get() braucht einen Key.
  (function() {
    var aiStratEl = document.getElementById('set_ai_strat');
    var aiVerkEl  = document.getElementById('set_ai_verk');
    var aiRiskEl  = document.getElementById('set_ai_risk');
    var aiMarktEl = document.getElementById('set_ai_markt');
    if (aiStratEl && window.DealPilotInvestmentProfile) {
      try {
        var ip = (DealPilotInvestmentProfile.load && DealPilotInvestmentProfile.load()) || {};
        ip.ai_strat = aiStratEl.value;
        if (aiVerkEl)  ip.ai_verk  = aiVerkEl.value;
        if (aiRiskEl)  ip.ai_risk  = aiRiskEl.value;
        if (aiMarktEl) ip.ai_markt = aiMarktEl.value;
        if (DealPilotInvestmentProfile.save) {
          DealPilotInvestmentProfile.save(ip);
        } else {
          try { localStorage.setItem('dp_investment_profile', JSON.stringify(ip)); } catch(e) {}
        }
        if (DealPilotInvestmentProfile.syncAiParamsToTab) {
          DealPilotInvestmentProfile.syncAiParamsToTab();
        }
      } catch (e) { console.warn('[settings] AI-Standardparameter persist:', e); }
    }
  })();

  // V63.72: Workflow-Bar-Sichtbarkeit sofort anwenden
  if (typeof applyWorkflowBarVisibility === 'function') {
    try { applyWorkflowBarVisibility(); } catch(e) { console.warn('[wf-bar]', e); }
  }

  // V63.21: Wenn DS2-Inline-Form sichtbar ist, auch DS2-Config speichern
  if (document.getElementById('ds2-settings-body-inline') && typeof ds2SaveConfig === 'function') {
    try { ds2SaveConfig(); } catch(e) { console.warn('[DS2 inline save]', e); }
  }

  // Save dealscore weights
  if (typeof DealScore !== 'undefined') {
    var w = {};
    ['cashflow','rendite','ltv','risiko','potenzial'].forEach(function(k) {
      var inp = document.getElementById('set-ds-' + k);
      if (inp) w[k] = parseInt(inp.value) || 0;
    });
    if (Object.keys(w).length === 5) {
      try { DealScore.setWeights(w); } catch (e) { alert(e.message); return; }
    }
  }

  // V60: Completeness-Threshold persistieren
  var compInp = document.getElementById('set-ds-completeness');
  if (compInp) {
    var compVal = parseInt(compInp.value) / 100;
    s.completeness_threshold = compVal;
    Settings.save(s);
    if (window.DealPilotConfig) {
      window.DealPilotConfig.completenessThreshold = compVal;
    }
    // Sofort neu rendern
    if (typeof renderDealScore2 === 'function') {
      try { renderDealScore2(); } catch(e) {}
    }
    if (typeof updHeaderBadges === 'function') {
      try { updHeaderBadges(); } catch(e) {}
    }
  }

  // V63.90: Investmentprofil (inkl. KI-Analyse-Standard-Parameter) mit speichern.
  // Wenn der User auf dem Tab "Profil & Anzeige" war, sind die ip_*-Felder im DOM —
  // wir delegieren an die zuständige Save-Funktion. saveFromForm filtert leere Felder.
  if (window.DealPilotInvestmentProfile && typeof window.DealPilotInvestmentProfile.saveFromForm === 'function') {
    try {
      // Nur wenn die ip-Felder existieren (Pane wurde mindestens einmal geöffnet)
      if (document.getElementById('ip_tilgung_default') || document.getElementById('ip_ai_strat')) {
        window.DealPilotInvestmentProfile.saveFromForm();
      }
    } catch (e) { console.warn('[settings] InvestmentProfile-Save fehlgeschlagen:', e); }
  }

  // Draft = aktueller Stand, also nicht mehr dirty
  window._SetDraft.current = Object.assign({}, s);
  window._SetDraft.dirty = false;
  _setUpdateDirtyHint();

  if (typeof toast === 'function') toast('✓ Einstellungen gespeichert');
  if (typeof renderDealScore === 'function') renderDealScore();

  // Visual feedback at save button
  var btn = document.querySelector('.settings-footer .btn-gold');
  if (btn) {
    var orig = btn.innerHTML;
    btn.innerHTML = '✓ Gespeichert';
    btn.disabled = true;
    setTimeout(function() { btn.innerHTML = orig; btn.disabled = false; }, 1500);
  }
}

window.Settings = Settings;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window._swSet = _swSet;

// V63.76: KI-Anweisungs-Vorschlag in Textarea einfügen
function _aiSuggInsert(text) {
  var ta = document.getElementById('set_ai_custom_instructions');
  if (!ta) return;
  var current = (ta.value || '').trim();
  // Verhindern dass exakt derselbe Text mehrfach drin ist
  if (current.indexOf(text) >= 0) {
    if (typeof toast === 'function') toast('Vorlage ist bereits eingefügt');
    return;
  }
  ta.value = current ? current + '\n' + text : text;
  // Falls über Maxlength → trunc
  if (ta.maxLength && ta.value.length > ta.maxLength) {
    ta.value = ta.value.substring(0, ta.maxLength);
    if (typeof toast === 'function') toast('Auf 500 Zeichen gekürzt');
  }
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.focus();
}
window._aiSuggInsert = _aiSuggInsert;

// V63.78: Mehrere Vorlagen auf einmal aus den Checkboxen anwenden
function _aiSuggApplySelected() {
  var ta = document.getElementById('set_ai_custom_instructions');
  if (!ta) return;
  var checked = document.querySelectorAll('.ai-sugg-cb:checked');
  if (!checked.length) {
    if (typeof toast === 'function') toast('Bitte Vorlagen mit Häkchen markieren');
    return;
  }
  var current = (ta.value || '').trim();
  var added = 0;
  checked.forEach(function(cb) {
    var text = cb.getAttribute('data-text');
    if (!text) return;
    if (current.indexOf(text) >= 0) return;        // schon drin
    current = current ? current + '\n' + text : text;
    added++;
  });
  if (ta.maxLength && current.length > ta.maxLength) {
    current = current.substring(0, ta.maxLength);
    if (typeof toast === 'function') toast('Auf 500 Zeichen gekürzt');
  }
  ta.value = current;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  // Checkboxen abhaken (bleiben aber sichtbar)
  checked.forEach(function(cb) { cb.checked = false; });
  if (typeof toast === 'function') {
    toast(added ? '✓ ' + added + ' Vorlage' + (added===1?'':'n') + ' übernommen' : 'Bereits eingefügt');
  }
}
window._aiSuggApplySelected = _aiSuggApplySelected;

// V63.76: Account-Löschung — 2-stufige Bestätigung, dann Backend-Call
function _deleteAccount() {
  // Stufe 1: einfache Bestätigung
  var ok1 = confirm(
    'Möchtest du deinen Account WIRKLICH endgültig löschen?\n\n' +
    'Es werden gelöscht:\n' +
    '  • Alle deine Objekte\n' +
    '  • Alle Steuer-Records\n' +
    '  • Alle persönlichen Einstellungen\n' +
    '  • Dein Login\n\n' +
    'Eine Wiederherstellung ist nicht möglich.'
  );
  if (!ok1) return;

  // Stufe 2: Confirm-String tippen lassen
  var typed = prompt(
    'Zur finalen Bestätigung tippe bitte: LÖSCHEN\n\n' +
    '(Genau dieses Wort, in Großbuchstaben.)'
  );
  if (typed !== 'LÖSCHEN' && typed !== 'LOESCHEN') {
    if (typed !== null) alert('Falsches Bestätigungswort. Vorgang abgebrochen.');
    return;
  }

  // Token holen
  var token = null;
  try { token = localStorage.getItem('ji_token'); } catch (e) {}
  if (!token) {
    alert('Du bist nicht angemeldet.');
    return;
  }

  fetch('/api/v1/auth/me', {
    method: 'DELETE',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ confirm: 'DELETE_MY_ACCOUNT' })
  })
    .then(function(r) {
      if (!r.ok) return r.json().then(function(j) { throw new Error(j.error || ('HTTP ' + r.status)); });
      return r.json();
    })
    .then(function() {
      alert('Dein Account wurde gelöscht. Du wirst abgemeldet.');
      // Local-Storage clearen + Hard-Reload zur Login-Seite
      try {
        localStorage.removeItem('ji_token');
        localStorage.removeItem('ji_session');
      } catch (e) {}
      window.location.href = '/';
    })
    .catch(function(e) {
      alert('Account-Löschung fehlgeschlagen: ' + (e.message || 'unbekannter Fehler'));
    });
}
window._deleteAccount = _deleteAccount;

// V63.77: Startup-View speichern (User-Preference)
function _setStartupView(value) {
  try {
    localStorage.setItem('dp_startup_view', value);
    if (typeof toast === 'function') toast('✓ Start-Ansicht gespeichert');
  } catch (e) {}
}
window._setStartupView = _setStartupView;
window._setOnInput = _setOnInput;
window._uploadLogo = _uploadLogo;
window._removeLogo = _removeLogo;
window._testApi = _testApi;
window._updateSetDsLabel = _updateSetDsLabel;

// V60: Completeness-Threshold Slider Live-Update
function _updateCompletenessLabel(input) {
  var val = parseInt(input.value);
  var lbl = document.getElementById('set-ds-completeness-val');
  if (lbl) lbl.textContent = val + '%';
}
window._updateCompletenessLabel = _updateCompletenessLabel;
window._resetDsWeights = _resetDsWeights;
window._saveSettings = _saveSettings;


function _renderPlanPane() {
  if (!window.DealPilotConfig || !DealPilotConfig.pricing) {
    return '<p class="hint">Pricing-Konfiguration nicht geladen.</p>';
  }
  var plans = DealPilotConfig.pricing.plans;
  var current = DealPilotConfig.pricing.currentKey();
  var allowSwitch = DealPilotConfig.dev.flags.SHOW_PLAN_SWITCHER || DealPilotConfig.dev.isDev();

  var billingCycle = window._planBillingCycle || 'monthly';   // 'monthly' | 'yearly'
  var creditPacks = DealPilotConfig.pricing.aiCreditPackages || [];
  var yearlyBonus = DealPilotConfig.pricing.yearlyBonus || {};

  var html = '';
  if (plans[current]) {
    html += '<p class="hint">Aktueller Plan: <strong>' + plans[current].label + '</strong>';
    if (DealPilotConfig.dev.isDev()) html += ' <span class="dev-badge">DEV</span>';
    html += '</p>';
  }

  // V63.1: Toggle Monatlich/Jährlich
  html += '<div class="plan-billing-toggle">' +
    '<button class="plan-toggle-btn ' + (billingCycle === 'monthly' ? 'active' : '') + '" ' +
            'onclick="_setBillingCycle(\'monthly\')" type="button">Monatlich</button>' +
    '<button class="plan-toggle-btn ' + (billingCycle === 'yearly' ? 'active' : '') + '" ' +
            'onclick="_setBillingCycle(\'yearly\')" type="button">' +
      'Jährlich · <span class="plan-toggle-bonus">2 Monate gratis + Bonus</span>' +
    '</button>' +
  '</div>';

  if (billingCycle === 'yearly') {
    html += '<div class="plan-yearly-bonus-banner">' +
      '<strong>Jahres-Vorteile:</strong> ' +
      (yearlyBonus.free_months || 2) + ' Monate gratis · ' +
      (yearlyBonus.bonus_ai_credits || 50) + ' Bonus-KI-Credits einmalig · ' +
      'Preisgarantie ' + (yearlyBonus.price_lock_months || 24) + ' Monate' +
    '</div>';
  }

  html += '<div class="plan-grid plan-grid-v63">';
  ['free','starter','investor','pro'].forEach(function(key) {
    var p = plans[key];
    if (!p) return;     // Defensiv falls Plan-Key nicht existiert
    var isCurrent = key === current;
    var price = billingCycle === 'monthly' ? p.price_monthly_eur : (p.price_yearly_eur ? Math.round(p.price_yearly_eur / 12) : p.price_monthly_eur);
    var priceLabel = price === 0 ? 'Free' : price + ' €/Mo';
    var subPriceLabel = '';
    if (billingCycle === 'yearly' && p.price_yearly_eur > 0) {
      subPriceLabel = '<span class="plan-price-sub">' + p.price_yearly_eur + ' € / Jahr</span>';
    }

    var bestseller = p.highlight ? '<span class="plan-bestseller">Bestseller</span>' : '';

    html += '<div class="plan-card' + (isCurrent ? ' plan-current' : '') + (p.highlight ? ' plan-highlight' : '') + '">';
    html += bestseller;
    html += '<div class="plan-card-head">' +
              '<strong>' + p.label + '</strong>' +
              '<div class="plan-tagline">' + (p.tagline || '') + '</div>' +
              '<div class="plan-price-row">' +
                '<span class="plan-price">' + priceLabel + '</span>' +
                subPriceLabel +
              '</div>' +
            '</div>';

    var l = p.limits || {};
    var f = p.features || {};
    html += '<ul class="plan-features">';

    // Objekte
    html += '<li><strong>' + (l.objects === -1 ? 'Unbegrenzt' : l.objects) + '</strong> Objekt' + (l.objects === 1 ? '' : 'e') + '</li>';
    // KI-Credits
    if (l.ai_credits === -1) {
      html += '<li>Unbegrenzte KI-Analysen</li>';
    } else if (l.ai_credits > 0) {
      html += '<li><strong>' + l.ai_credits + '</strong> KI-Credits / Monat</li>';
    } else if (l.ai_credits === 0) {
      html += '<li><em>KI nur als Credit-Paket dazubuchbar</em></li>';
    } else {
      html += '<li>' + l.ai_credits + ' KI-Analyse einmalig</li>';
    }
    // Wasserzeichen
    html += '<li>PDF ' + (l.watermark ? '<em>mit Wasserzeichen</em>' : '<strong>ohne Wasserzeichen</strong>') + '</li>';
    // Max-Saves
    if (l.max_saves !== -1 && l.max_saves != null) {
      html += '<li>Max. ' + l.max_saves + ' Speicherungen</li>';
    }

    // Features (nur die echten Goodies anzeigen) — keine Emojis mehr (wirkt billig)
    var featLabels = {
      deal_score_v2:              'Deal Score 2.0 (24 KPIs)',
      deal_score_basic:           'Deal Score Basic (5 Faktoren)',
      bank_pdf_a3:                'Bank-PDF A3-Format',
      track_record_pdf:           'Track-Record-PDF',
      track_record_custom_cover:  'Custom Track-Record-Cover',
      werbungskosten_pdf:         'Werbungskosten-PDF (Finanzamt)',
      steuer_modul:               'Steuer-Modul (voll)',
      custom_logo:                'Eigenes Logo',
      live_market_rates:          'Live-Marktzinsen',
      premium_pdf_layouts:        'Premium-PDF-Layouts',
      api_access:                 'API-Zugang',
      priority_support:           'Priorisierter Support',
      investment_thesis_ai:       'Investment-Thesis (KI)'
    };
    Object.keys(featLabels).forEach(function(featKey) {
      if (f[featKey]) {
        html += '<li>' + featLabels[featKey] + '</li>';
      }
    });
    html += '</ul>';

    if (allowSwitch) {
      html += '<button class="btn ' + (isCurrent ? 'btn-outline' : 'btn-gold') + ' btn-sm" ' +
              'onclick="_switchPlan(\'' + key + '\')" ' + (isCurrent ? 'disabled' : '') + '>' +
              (isCurrent ? '✓ Aktiv' : (price === 0 ? 'Aktivieren' : 'Wechseln')) + '</button>';
    } else {
      html += '<button class="btn btn-outline btn-sm" disabled>' +
              (isCurrent ? '✓ Aktueller Plan' : 'Im Live-Mode via Stripe') + '</button>';
    }
    html += '</div>';
  });
  html += '</div>';

  // V63.1: KI-Credit-Pakete
  if (creditPacks.length > 0) {
    html += '<div class="plan-credits-section">' +
      '<h3 class="plan-credits-title">KI-Credit-Pakete</h3>' +
      '<p class="plan-credits-desc">Brauchst du mehr KI-Analysen? Pakete sind einmalig zubuchbar und verfallen nicht.</p>' +
      '<div class="plan-credits-grid">';
    creditPacks.forEach(function(pack) {
      html += '<div class="plan-credit-card' + (pack.highlight ? ' plan-credit-highlight' : '') + '">' +
        (pack.highlight ? '<span class="plan-credit-best">Beliebt</span>' : '') +
        '<div class="plan-credit-num">' + pack.credits + '</div>' +
        '<div class="plan-credit-label">Credits</div>' +
        '<div class="plan-credit-price">' + pack.price_eur + ' €</div>' +
        '<div class="plan-credit-sub">≈ ' + pack.per_credit.toFixed(2).replace('.', ',') + ' € / Credit</div>' +
        (allowSwitch
          ? '<button class="btn btn-outline btn-sm" onclick="_buyCreditPack(\'' + pack.key + '\')">Dazubuchen</button>'
          : '<button class="btn btn-outline btn-sm" disabled>Im Live-Mode aktiv</button>') +
      '</div>';
    });
    html += '</div></div>';
  }

  if (allowSwitch) {
    html += '<p class="hint" style="margin-top:14px"><strong>Hinweis:</strong> Plan-Switcher nur im Entwicklungsmodus aktiv. ' +
            'In Produktion erfolgt der Wechsel via Stripe-Checkout.</p>';
  }
  return html;
}

// V63.1: Toggle für Monatlich/Jährlich
function _setBillingCycle(cycle) {
  window._planBillingCycle = cycle;
  // Plan-Pane neu rendern
  var pane = document.getElementById('st-pane-plan');
  if (pane) pane.innerHTML = _renderPlanPane();
}
window._setBillingCycle = _setBillingCycle;

// V63.1: Credit-Pack kaufen (Demo — nur Toast)
function _buyCreditPack(packKey) {
  var packs = DealPilotConfig.pricing.aiCreditPackages || [];
  var pack = packs.find(function(p){ return p.key === packKey; });
  if (!pack) return;
  if (typeof toast === 'function') {
    toast('💳 Credit-Pack "' + pack.label + '" — ' + pack.price_eur + ' € (Stripe-Checkout im Live-Mode)');
  }
}
window._buyCreditPack = _buyCreditPack;

function _switchPlan(key) {
  DealPilotConfig.pricing.setOverride(key);
  // V63.92: Im API-Mode auch Backend-Subscription updaten (Demo-Endpoint).
  // V203 BUGFIX: Auth.apiCall macht selbst JSON.stringify auf options.body.
  // Vorher wurde HIER schon stringified → Backend bekam einen JSON-encoded String
  // statt eines Objects → Pfad hing potenziell.
  if (typeof Auth !== 'undefined' && Auth.isApiMode && Auth.isApiMode()) {
    try {
      // V203: AbortController mit Timeout — verhindert Endlos-Hänger
      var ctrl = new AbortController();
      var timeoutId = setTimeout(function() { ctrl.abort(); }, 8000);

      Auth.apiCall('/subscription/demo-change-plan', {
        method: 'POST',
        body: { planId: key },     // V203: kein JSON.stringify mehr (apiCall macht das selbst)
        signal: ctrl.signal
      }).then(function(resp) {
        clearTimeout(timeoutId);
        // Credits-Pill sofort aktualisieren mit dem neuen Status
        if (window.AiCredits && resp && resp.credits) {
          try { window.AiCredits.render(resp.credits); } catch(e) {}
        }
        var settingsBox = document.getElementById('ai-credits-settings-host');
        if (settingsBox && window.AiCredits && window.AiCredits.renderSettingsBox) {
          try { window.AiCredits.renderSettingsBox(settingsBox); } catch(e) {}
        }
      }).catch(function(e) {
        clearTimeout(timeoutId);
        console.warn('[plan-switch] Backend-Sync fehlgeschlagen (lokaler Override greift trotzdem):', e.message);
      });
    } catch (e) {
      console.warn('[plan-switch] Backend-Sync Exception:', e);
    }
  }
  if (typeof toast === 'function') toast('✓ Plan auf "' + DealPilotConfig.pricing.get(key).label + '" gewechselt');
  // V203: Sub-Cache invalidieren BEVOR Modal neu gerendert wird, sonst zeigt Modal
  // den alten Plan
  if (typeof Sub !== 'undefined' && typeof Sub.invalidateCache === 'function') {
    Sub.invalidateCache();
  }
  // Refresh the modal pane
  var btn = document.querySelector('.st-tab[data-tab="plan"]');
  if (btn) {
    showSettings();
    setTimeout(function() { _swSet(document.querySelector('.st-tab[data-tab="plan"]')); }, 50);
  }
  // V63.2: Sidebar-Plan-Pill nach Plan-Wechsel aktualisieren
  setTimeout(function() {
    if (typeof renderSubscriptionBadge === 'function') {
      renderSubscriptionBadge();
    } else if (typeof window.renderSubscriptionBadge === 'function') {
      window.renderSubscriptionBadge();
    }
    var pill = document.querySelector('.sb-user-plan-pill');
    if (pill) {
      var p = DealPilotConfig.pricing.get(key);
      if (p) {
        pill.textContent = p.label.toUpperCase();
        pill.className = 'sb-user-plan-pill plan-' + key;
      }
    }
  }, 100);
  if (window.AiCredits && typeof window.AiCredits.refresh === 'function') {
    setTimeout(function(){ try { window.AiCredits.refresh(); } catch(e) {} }, 350);
  }
  // V203: Plan-Visibility neu anwenden (Free-Demo vs. paid)
  if (window.DealPilotPlanVisibility && typeof window.DealPilotPlanVisibility.apply === 'function') {
    try { window.DealPilotPlanVisibility.apply(); } catch(e) {}
  }
  // Feature-Gate Engine triggern
  if (typeof applyFeatureGates === 'function') {
    applyFeatureGates();
  } else if (typeof window.applyFeatureGates === 'function') {
    window.applyFeatureGates();
  }
  // Header neu rendern (Feature-Gating)
  if (typeof updHeaderBadges === 'function') updHeaderBadges();
  // V203: DS2-Card neu rendern (im Free-Demo soll sie sichtbar bleiben)
  if (typeof renderDealScore2 === 'function') {
    try { renderDealScore2(); } catch(e) {}
  }
  if (typeof Paywall !== 'undefined' && Paywall.renderUsageBadge) Paywall.renderUsageBadge();
}
window._renderPlanPane = _renderPlanPane;
window._switchPlan = _switchPlan;

// V40: DS2-Reset aus Settings-Modal heraus
function ds2ResetConfigFromSettings() {
  if (!confirm('Investor Deal Score 2.0 — Gewichtungen + Schwellen auf Standard zurücksetzen?')) return;
  if (window.DealScore2 && typeof window.DealScore2.resetConfig === 'function') {
    window.DealScore2.resetConfig();
    if (typeof toast === 'function') toast('✓ DS2-Konfiguration zurückgesetzt.');
    if (typeof renderDealScore2 === 'function') {
      try { renderDealScore2(); } catch(e) {}
    }
  }
}
window.ds2ResetConfigFromSettings = ds2ResetConfigFromSettings;

/* ═══════════════════════════════════════════════════════════════
   V51: Info-Tab — Version, Plan, Diagnose, Links, Lizenz
   ═══════════════════════════════════════════════════════════════ */
function _renderInfoPane() {
  var ver = (window.DealPilotVersion && DealPilotVersion.label) || 'V63.57';
  var build = (window.DealPilotVersion && DealPilotVersion.build) || '2026-05-02';
  var channel = (window.DealPilotVersion && DealPilotVersion.channel) || 'stable';

  // Plan
  var planLabel = '—';
  try {
    if (window.DealPilotConfig && DealPilotConfig.pricing) {
      var p = DealPilotConfig.pricing.current();
      planLabel = (p && p.label) ? p.label : '—';
    }
  } catch(e) {}

  // Browser/OS-Erkennung (rudimentär — reicht für Diagnose)
  var ua = (navigator.userAgent || '');
  var browser = /Edg\//.test(ua) ? 'Edge' :
                /Chrome\//.test(ua) ? 'Chrome' :
                /Firefox\//.test(ua) ? 'Firefox' :
                /Safari\//.test(ua) ? 'Safari' : 'Unbekannt';
  var os = /Windows/.test(ua) ? 'Windows' :
           /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
           /Android/.test(ua) ? 'Android' :
           /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
           /Linux/.test(ua) ? 'Linux' : 'Unbekannt';

  // Objekt-Anzahl (best effort)
  var objCount = '—';
  try {
    if (window.AllObjects && typeof AllObjects.list === 'function') {
      var l = AllObjects.list();
      if (l && l.length != null) objCount = String(l.length);
    } else {
      // Local-Mode-Fallback
      var locKeys = Object.keys(localStorage).filter(function(k) { return k.indexOf('ji_calc_objs:') === 0; });
      if (locKeys.length) objCount = String(locKeys.length);
    }
  } catch(e) {}

  // API-Key gesetzt?
  var hasKey = false;
  try {
    var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
    hasKey = !!(s.openai_api_key || s.openaiApiKey);
  } catch(e) {}

  // Diagnose-Text
  var diag = [
    '── DealPilot Diagnose ──',
    'Version:      ' + ver + ' (' + build + ', ' + channel + ')',
    'Plan:         ' + planLabel,
    'Objekte:      ' + objCount,
    'Browser:      ' + browser,
    'Betriebssyst: ' + os,
    'Bildschirm:   ' + window.innerWidth + ' × ' + window.innerHeight + ' px',
    'Sprache:      ' + (navigator.language || '—'),
    'API-Key:      ' + (hasKey ? '✓ gesetzt' : '— nicht gesetzt'),
    'Zeitstempel:  ' + new Date().toISOString(),
    '',
    'User-Agent: ' + ua
  ].join('\n');

  return (
    '<p class="hint">Versions-Info, Diagnose und Hilfreiches. Den Diagnose-Block kannst du kopieren oder als Datei laden, falls du Support kontaktierst.</p>' +

    '<div class="info-grid">' +
      '<div class="info-card"><div class="info-label">Version</div><div class="info-val">' + _esc(ver) + '</div><div class="info-sub">Build ' + _esc(build) + '</div></div>' +
      '<div class="info-card"><div class="info-label">Plan</div><div class="info-val">' + _esc(planLabel) + '</div><div class="info-sub">aktiv</div></div>' +
      '<div class="info-card"><div class="info-label">Objekte</div><div class="info-val">' + _esc(objCount) + '</div><div class="info-sub">gespeichert</div></div>' +
      '<div class="info-card"><div class="info-label">Umgebung</div><div class="info-val">' + _esc(browser) + '</div><div class="info-sub">' + _esc(os) + ' · ' + window.innerWidth + ' × ' + window.innerHeight + '</div></div>' +
    '</div>' +

    // V142: Schnellzugriff zum neuen Rechtliches-Tab (Impressum + Datenschutz dort)
    '<div class="info-quick-links">' +
      '<button type="button" class="info-quick-btn" onclick="_swSet(document.querySelector(\'.st-tab[data-tab=&quot;rechtliches&quot;]\'))">📋 Impressum &amp; Datenschutz</button>' +
    '</div>' +

    '<div class="info-section">' +
      '<div class="info-section-title">⚖ Lizenz &amp; Hinweise</div>' +
      '<div class="info-license">' +
        '<strong>DealPilot ' + _esc(ver) + '</strong> — Investmentanalyse für deutsche Wohnimmobilien.<br>' +
        'Steuerberechnungen sind Schätzungen nach §6 StBerG und ersetzen keine Steuerberatung. ' +
        'Berechnungen ohne Gewähr.' +
      '</div>' +
    '</div>' +

    '<div class="info-section">' +
      '<div class="info-section-title">📋 Diagnose-Info (für Support)</div>' +
      '<textarea class="info-textarea" id="info-diag" readonly>' + _esc(diag) + '</textarea>' +
      '<div class="info-actions">' +
        '<button class="btn btn-outline btn-sm" type="button" onclick="_copyDiag()">📋 Kopieren</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" onclick="_downloadDiag()">⬇ Als Datei</button>' +
      '</div>' +
    '</div>'
  );
}

// V142: Rechtliches-Pane mit Impressum + Datenschutz dauerhaft ausgeklappt
function _renderRechtlichesPane() {
  return (
    '<h2 class="set-section-h2">Rechtliches</h2>' +
    '<p style="margin:-4px 0 18px 0;font-size:13px;color:var(--muted)">Impressum nach § 5 TMG und Datenschutzerklärung gemäß DSGVO.</p>' +

    // Impressum
    '<div class="info-section" id="info-section-imp">' +
      '<div class="info-section-title" style="font-weight:600;font-size:15px;margin-bottom:8px">📋 Impressum</div>' +
      '<div class="info-legal-text">' +
        '<h4>Angaben gemäß § 5 TMG</h4>' +
        '<p>Junker Immobilien<br>' +
        'Inhaber: Marcel Junker<br>' +
        'Hermannstraße 9<br>' +
        '32609 Hüllhorst<br>' +
        'Deutschland</p>' +

        '<h4>Kontakt</h4>' +
        '<p>Telefon: +49 151 29820057<br>' +
        'E-Mail: info@junker-immobilien.io<br>' +
        'Website: www.junker-immobilien.io</p>' +

        '<h4>Umsatzsteuer</h4>' +
        '<p>Gemäß § 19 UStG (Kleinunternehmerregelung) wird keine Umsatzsteuer berechnet und ausgewiesen.</p>' +

        '<h4>Inhaltlich Verantwortlicher gemäß § 18 Abs. 2 MStV</h4>' +
        '<p>Marcel Junker, Hermannstraße 9, 32609 Hüllhorst, Deutschland</p>' +

        '<h4>Streitschlichtung</h4>' +
        '<p>Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>' +

        '<h4>Haftung für Inhalte</h4>' +
        '<p>Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden entsprechender Rechtsverletzungen werden diese Inhalte umgehend entfernt.</p>' +

        '<h4>Haftung für Links</h4>' +
        '<p>Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zu diesem Zeitpunkt nicht erkennbar. Eine dauerhafte inhaltliche Kontrolle ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden derartige Links umgehend entfernt.</p>' +

        '<h4>Urheberrecht</h4>' +
        '<p>Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. Soweit Inhalte nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet und entsprechend gekennzeichnet. Bei Bekanntwerden von Rechtsverletzungen werden derartige Inhalte umgehend entfernt.</p>' +

        '<h4>Hinweis</h4>' +
        '<p>Mit Unterstützung von Funck-IT – IT-Dienstleistungen aus Oberhausen.</p>' +
      '</div>' +
    '</div>' +

    // Datenschutz
    '<div class="info-section" id="info-section-ds" style="margin-top:24px">' +
      '<div class="info-section-title" style="font-weight:600;font-size:15px;margin-bottom:8px">🔒 Datenschutzerklärung</div>' +
      '<div class="info-legal-text">' +
        '<h4>1. Verantwortlicher</h4>' +
        '<p>Junker Immobilien, Inhaber: Marcel Junker, Hermannstraße 9, 32609 Hüllhorst, Deutschland<br>' +
        'Telefon: +49 151 29820057, E-Mail: info@junker-immobilien.io</p>' +

        '<h4>2. Allgemeine Hinweise zur Datenverarbeitung</h4>' +
        '<p>Wir verarbeiten personenbezogene Daten ausschließlich im Rahmen der geltenden Datenschutzgesetze (insbesondere DSGVO). Personenbezogene Daten sind alle Informationen, mit denen Sie persönlich identifiziert werden können.</p>' +

        '<h4>3. Datenverarbeitung bei Nutzung der App / Website</h4>' +
        '<p><strong>a) Zugriffsdaten (Server-Logfiles):</strong> IP-Adresse, Datum/Uhrzeit, Endgerät/Betriebssystem, Browsertyp, aufgerufene Seiten/Features. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).<br>' +
        '<strong>b) Kontaktaufnahme:</strong> Bei E-Mail/Telefon werden Ihre Angaben zur Bearbeitung der Anfrage gespeichert. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>' +

        '<h4>4. Nutzung in der App</h4>' +
        '<p>Verarbeitet werden ggf.: Nutzerkonto-Daten (Name, E-Mail), gespeicherte Favoriten / Immobilienanfragen, technische Geräteinformationen — zur Bereitstellung der App-Funktionen.</p>' +

        '<h4>5. Zahlungsabwicklung durch Stripe</h4>' +
        '<p>Für Zahlungen verwenden wir Stripe. Verarbeitet werden Zahlungsinformationen (Kreditkartendaten, Bankverbindungen), Rechnungsadresse (Name, Adresse, E-Mail) sowie Transaktionsdaten (Betrag, Transaktions-ID). Stripe speichert diese Daten auf eigenen Servern. Rechtsgrundlage: Art. 6 Abs. 1 lit. b und f DSGVO. Stripe kann Daten in Drittländer (z. B. USA) übermitteln und stellt die Einhaltung der DSGVO sicher. Details: Stripe-Datenschutzrichtlinie.</p>' +

        '<h4>6. Cookies / Tracking</h4>' +
        '<p>Cookies werden nur zur technischen Funktionalität oder nach Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) eingesetzt.</p>' +

        '<h4>7. Weitergabe von Daten</h4>' +
        '<p>Nur wenn gesetzlich erlaubt, zur Vertragserfüllung oder mit ausdrücklicher Einwilligung.</p>' +

        '<h4>8. Speicherdauer</h4>' +
        '<p>Daten werden nur so lange gespeichert, wie es für den Zweck erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.</p>' +

        '<h4>9. Ihre Rechte</h4>' +
        '<p>Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20), Widerspruch (Art. 21) DSGVO.</p>' +

        '<h4>10. Widerruf einer Einwilligung</h4>' +
        '<p>Eine erteilte Einwilligung kann jederzeit mit Wirkung für die Zukunft widerrufen werden.</p>' +

        '<h4>11. Datensicherheit</h4>' +
        '<p>Wir verwenden technische und organisatorische Sicherheitsmaßnahmen gegen Manipulation, Verlust oder unbefugten Zugriff.</p>' +

        '<h4>12. Änderungen dieser Datenschutzerklärung</h4>' +
        '<p>Anpassungen behalten wir uns bei Bedarf vor, um stets den aktuellen rechtlichen Anforderungen zu entsprechen.</p>' +

        '<h4>Hinweis zu externen Links und Drittanbietern</h4>' +
        '<p>Unsere App enthält Links zu externen Seiten. Diese Datenschutzerklärung gilt nicht für die verlinkten Seiten — bitte dort die jeweilige Datenschutzerklärung lesen.</p>' +
      '</div>' +
    '</div>'
  );
}


function _copyDiag() {
  var ta = document.getElementById('info-diag');
  if (!ta) return;
  ta.select();
  try {
    document.execCommand('copy');
    if (typeof toast === 'function') toast('✓ Diagnose kopiert');
  } catch(e) {
    if (typeof toast === 'function') toast('⚠ Kopieren fehlgeschlagen');
  }
  if (window.getSelection) window.getSelection().removeAllRanges();
}

function _downloadDiag() {
  var ta = document.getElementById('info-diag');
  if (!ta) return;
  var blob = new Blob([ta.value], { type: 'text/plain' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'dealpilot-diagnose.txt';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() { URL.revokeObjectURL(url); a.remove(); }, 100);
}

window._renderInfoPane = _renderInfoPane;
window._copyDiag = _copyDiag;
window._downloadDiag = _downloadDiag;

// ═══════════════════════════════════════════════════════════════
// V63.21 — CSV-Komplettexport aller Objekte
// Format: Semikolon-getrennt, UTF-8 mit BOM (Excel-DE-kompatibel)
// Filename: DealPilot_Objekte_Export_<YYYY-MM-DD>.csv
// ═══════════════════════════════════════════════════════════════
async function _exportAllCSV() {
  if (typeof getAllObjectsData !== 'function') {
    alert('Export nicht verfügbar (getAllObjectsData fehlt)');
    return;
  }

  function _csv(v) {
    if (v == null || v === undefined) return '';
    var s = String(v);
    // Semikolon, Anführungszeichen, Zeilenumbruch → quotieren
    if (/[;"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function _num(v) {
    if (v == null || v === '' || isNaN(v)) return '';
    // Deutsche Zahlen-Formatierung mit Komma als Dezimaltrennzeichen
    return String(v).replace('.', ',');
  }

  function _date(v) {
    if (!v) return '';
    try {
      var d = new Date(v);
      if (isNaN(d.getTime())) return v;
      return d.toLocaleDateString('de-DE');
    } catch(e) { return v; }
  }

  try {
    var btn = document.querySelector('button[onclick="_exportAllCSV()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Lade Objekte...'; }

    var objs = await getAllObjectsData();
    if (!objs || !objs.length) {
      alert('Keine Objekte zum Exportieren gefunden.');
      if (btn) { btn.disabled = false; btn.textContent = 'CSV-Export starten'; }
      return;
    }

    // Header
    var headers = [
      'Lfd_Nr', 'Bezeichnung', 'Strasse', 'PLZ', 'Ort',
      'Kaufpreis', 'KNK', 'Sanierung', 'Eigenkapital', 'Wohnflaeche_qm',
      'Miete_NKM_Monat', 'Miete_NKM_Jahr',
      'Cashflow_Monat', 'Cashflow_Jahr',
      'EK_Rendite_pct', 'Brutto_Mietrendite_pct', 'Netto_Mietrendite_pct',
      'DSCR', 'LTV_pct',
      'Deal_Score_klassisch', 'Investor_Deal_Score',
      'Status', 'Erstellt_am', 'Geaendert_am'
    ];

    var rows = [headers.map(_csv).join(';')];

    objs.forEach(function(o, idx) {
      var d = o.data || {};
      var k = o.kpis || {};
      var addr = d._addr || {};

      var ds_classic = (typeof DealScore !== 'undefined' && DealScore.compute) ?
                        Math.round((DealScore.compute(d).score || 0)) : '';
      var ds2 = (typeof DealScore2 !== 'undefined' && DealScore2.compute && typeof window._buildDeal2FromState === 'function') ?
                  '' : ''; // DS2 braucht Live-State, nicht aus rohen Daten

      var row = [
        d._seq_no || (idx + 1),
        o.name || 'Unbenannt',
        addr.street || '',
        addr.plz || '',
        addr.city || '',
        _num(d.kp || k.kp),
        _num(d.knk || k.knk),
        _num(d.san || k.san),
        _num(d.ek || k.ek),
        _num(d.wfl || k.wfl),
        _num(d.nkm || k.nkm),
        _num((d.nkm || k.nkm || 0) * 12),
        _num(k.cf_m || (k.cf_ns ? k.cf_ns / 12 : '')),
        _num(k.cf_ns),
        _num(k.ek_rend || k.ekr),
        _num(k.bmy || k.bmr),
        _num(k.nmy || k.nmr),
        _num(k.dscr),
        _num(k.ltv),
        ds_classic,
        ds2,
        d._status || 'aktiv',
        _date(o.created_at || d._created_at),
        _date(o.updated_at || d._updated_at)
      ];
      rows.push(row.map(_csv).join(';'));
    });

    // UTF-8 BOM + CSV-Content
    var bom = '\ufeff';
    var csv = bom + rows.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    var fname = 'DealPilot_Objekte_Export_' + yyyy + '-' + mm + '-' + dd + '.csv';

    var a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      URL.revokeObjectURL(url);
      a.remove();
    }, 200);

    if (typeof toast === 'function') toast('✓ ' + objs.length + ' Objekte als CSV exportiert');
    if (btn) { btn.disabled = false; btn.textContent = 'CSV-Export starten'; }
  } catch(e) {
    console.error('[CSV-Export V63.21]', e);
    alert('CSV-Export fehlgeschlagen: ' + (e.message || 'Unbekannt'));
    var btn2 = document.querySelector('button[onclick="_exportAllCSV()"]');
    if (btn2) { btn2.disabled = false; btn2.textContent = 'CSV-Export starten'; }
  }
}
window._exportAllCSV = _exportAllCSV;

// V63.22: Info-Tab Schnellzugriff — öffnet Impressum/Datenschutz und scrollt hin
function _openInfoLegal(which) {
  var sectionId = which === 'imp' ? 'info-section-imp' : 'info-section-ds';
  var section = document.getElementById(sectionId);
  if (!section) return;
  var title = section.querySelector('.info-section-title-collapsible');
  var content = title ? title.nextElementSibling : null;
  if (title && !title.classList.contains('open')) {
    title.classList.add('open');
    if (content) content.style.display = 'block';
  }
  // Scrollen
  setTimeout(function() {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}
window._openInfoLegal = _openInfoLegal;

// V63.72: Workflow-Bar ein/ausblenden basierend auf Settings
// V76: Workflow-Bar wird IMMER ausgeblendet — Steps + Status sind in die Tab-Bar gewandert.
//      Setting-Toggle ist aus den Einstellungen entfernt; Funktion bleibt als No-Op-Stub
//      damit Aufrufer (ui.js) nicht crashen.
function applyWorkflowBarVisibility() {
  var bar = document.querySelector('.tabs-workflow-bar');
  if (bar) bar.style.display = 'none';
}
window.applyWorkflowBarVisibility = applyWorkflowBarVisibility;

// Beim Page-Load anwenden
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyWorkflowBarVisibility);
} else {
  applyWorkflowBarVisibility();
}

// ─────────────────────────────────────────────────────────────
// V63.80: 2FA-Sicherheit-Tab UI
// ─────────────────────────────────────────────────────────────
async function _renderTwoFactor() {
  var host = document.getElementById('sec-2fa-host');
  if (!host) return;

  // Im Local-Mode (kein API) → Hinweis
  if (typeof Auth === 'undefined' || !Auth.isApiMode || !Auth.isApiMode()) {
    host.innerHTML = '<div class="sec-2fa-empty">' +
      '<p>2FA ist nur im Server-Modus verfügbar (eingeloggter Account).</p>' +
      '<p class="muted" style="font-size:12px;margin-top:8px">Im lokalen Demo-Modus kein Login-Schutz nötig.</p>' +
    '</div>';
    return;
  }

  host.innerHTML = '<div class="sec-2fa-loading">Lade Status…</div>';

  try {
    var status = await _api2faStatus();
    if (status.enabled) {
      _render2faActive(host, status);
    } else {
      _render2faInactive(host);
    }
  } catch (e) {
    host.innerHTML = '<div class="sec-2fa-error">Status konnte nicht geladen werden: ' +
      _esc(e.message || 'Server-Fehler') + '</div>';
  }
}
window._renderTwoFactor = _renderTwoFactor;

function _render2faInactive(host) {
  host.innerHTML =
    '<div class="sec-2fa-card sec-2fa-inactive">' +
      '<div class="sec-2fa-row">' +
        '<div class="sec-2fa-icon-wrap">' + (window.Icons && Icons.shield ? Icons.shield({size:24}) : '🛡') + '</div>' +
        '<div class="sec-2fa-text">' +
          '<div class="sec-2fa-title">Zwei-Faktor-Authentifizierung ist NICHT aktiv</div>' +
          '<div class="sec-2fa-sub">Aktiviere 2FA, um deinen Account zusätzlich zum Passwort mit einem 6-stelligen Code aus deiner Authenticator-App zu schützen.</div>' +
        '</div>' +
      '</div>' +
      '<div class="sec-2fa-actions">' +
        '<button class="btn btn-gold" onclick="_2faStartSetup()">' +
          (window.Icons && Icons.shieldCheck ? Icons.shieldCheck({size:14}) : '') +
          ' 2FA jetzt aktivieren' +
        '</button>' +
      '</div>' +
    '</div>';
}

function _render2faActive(host, status) {
  var setupDate = status.setupAt ? new Date(status.setupAt).toLocaleDateString('de-DE') : '—';
  var codesLeft = status.recoveryCodesRemaining != null ? status.recoveryCodesRemaining : '?';
  var lowCodes = status.recoveryCodesRemaining != null && status.recoveryCodesRemaining <= 2;

  host.innerHTML =
    '<div class="sec-2fa-card sec-2fa-active">' +
      '<div class="sec-2fa-row">' +
        '<div class="sec-2fa-icon-wrap sec-2fa-icon-ok">' +
          (window.Icons && Icons.shieldCheck ? Icons.shieldCheck({size:24}) : '✓') +
        '</div>' +
        '<div class="sec-2fa-text">' +
          '<div class="sec-2fa-title">2FA ist aktiv</div>' +
          '<div class="sec-2fa-sub">Aktiviert am ' + setupDate + ' · ' +
            '<span class="' + (lowCodes ? 'sec-2fa-warn' : '') + '">' +
            codesLeft + ' ungenutzte Recovery-Codes' +
            '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      (lowCodes ? '<div class="sec-2fa-warn-banner">⚠ Du hast nur noch ' + codesLeft + ' Recovery-Codes übrig. Generiere neue, bevor du den Zugang verlierst.</div>' : '') +
      '<div class="sec-2fa-actions">' +
        '<button class="btn btn-outline" onclick="_2faRegenerateCodes()">' +
          (window.Icons && Icons.refresh ? Icons.refresh({size:13}) : '') + ' Recovery-Codes neu generieren' +
        '</button>' +
        '<button class="btn btn-danger" onclick="_2faStartDisable()">' +
          (window.Icons && Icons.x ? Icons.x({size:13}) : '') + ' 2FA deaktivieren' +
        '</button>' +
      '</div>' +
    '</div>';
}

// ─────── Setup-Flow ───────
async function _2faStartSetup() {
  var host = document.getElementById('sec-2fa-host');
  if (!host) return;
  host.innerHTML = '<div class="sec-2fa-loading">Generiere QR-Code…</div>';

  try {
    var res = await _api2faSetup();
    host.innerHTML =
      '<div class="sec-2fa-card sec-2fa-setup">' +
        '<div class="sec-2fa-step-h">Schritt 1 von 2 — Authenticator-App einrichten</div>' +
        '<p class="sec-2fa-instructions">Scanne diesen QR-Code mit deiner Authenticator-App (Google Authenticator, Authy, 1Password, Microsoft Authenticator).</p>' +
        '<div class="sec-2fa-qr-wrap">' +
          '<img src="' + _esc(res.qrDataUrl) + '" alt="2FA QR-Code" class="sec-2fa-qr" />' +
        '</div>' +
        '<details class="sec-2fa-manual">' +
          '<summary>Kein QR-Scanner? Code manuell eingeben</summary>' +
          '<div class="sec-2fa-secret-box">' +
            '<code>' + _esc(res.secret) + '</code>' +
            '<button type="button" class="btn-mini" onclick="_2faCopySecret(this, \'' + _esc(res.secret) + '\')">Kopieren</button>' +
          '</div>' +
          '<div class="sec-2fa-issuer-hint">Issuer: DealPilot · Typ: Time-based (TOTP) · Algorithmus: SHA-1 · Stellen: 6</div>' +
        '</details>' +
        '<div class="sec-2fa-step-h" style="margin-top:24px">Schritt 2 von 2 — Code zur Bestätigung eingeben</div>' +
        '<p class="sec-2fa-instructions">Gib den 6-stelligen Code aus deiner App ein, um die Aktivierung abzuschließen.</p>' +
        '<div class="sec-2fa-code-row">' +
          '<input type="text" id="sec-2fa-confirm-code" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="000000" autocomplete="one-time-code" />' +
          '<button class="btn btn-gold" onclick="_2faConfirmSetup()">Bestätigen &amp; aktivieren</button>' +
        '</div>' +
        '<div class="sec-2fa-actions" style="margin-top:16px">' +
          '<button class="btn btn-outline" onclick="_renderTwoFactor()">Abbrechen</button>' +
        '</div>' +
      '</div>';
    setTimeout(function() {
      var inp = document.getElementById('sec-2fa-confirm-code');
      if (inp) inp.focus();
    }, 60);
  } catch (e) {
    host.innerHTML = '<div class="sec-2fa-error">Setup fehlgeschlagen: ' + _esc(e.message || 'Server-Fehler') + '</div>';
  }
}
window._2faStartSetup = _2faStartSetup;

async function _2faConfirmSetup() {
  var inp = document.getElementById('sec-2fa-confirm-code');
  if (!inp) return;
  var code = (inp.value || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) {
    if (typeof toast === 'function') toast('Bitte 6-stelligen Code eingeben');
    inp.focus();
    return;
  }

  try {
    var res = await _api2faConfirm(code);
    if (res.success && res.recoveryCodes) {
      _render2faRecoveryCodes(res.recoveryCodes, /*isFirstSetup*/true);
    } else {
      if (typeof toast === 'function') toast('Aktivierung fehlgeschlagen');
    }
  } catch (e) {
    if (typeof toast === 'function') toast('✗ ' + (e.message || 'Code ungültig'));
    inp.value = '';
    inp.focus();
  }
}
window._2faConfirmSetup = _2faConfirmSetup;

function _render2faRecoveryCodes(codes, isFirstSetup) {
  var host = document.getElementById('sec-2fa-host');
  if (!host) return;
  var codesText = codes.join('\n');
  host.innerHTML =
    '<div class="sec-2fa-card sec-2fa-recovery">' +
      '<div class="sec-2fa-step-h">' +
        (isFirstSetup ? '✓ 2FA aktiviert — Speichere deine Recovery-Codes' : 'Neue Recovery-Codes') +
      '</div>' +
      '<div class="sec-2fa-recovery-warn">' +
        '<strong>Wichtig:</strong> Diese Codes werden NUR EINMAL angezeigt. Speichere sie an einem sicheren Ort (Passwort-Manager, ausgedruckt im Tresor). ' +
        'Mit jedem dieser Codes kannst du dich einmalig anmelden, falls du den Zugriff auf deine Authenticator-App verlierst.' +
      '</div>' +
      '<div class="sec-2fa-recovery-codes">' +
        '<textarea id="sec-2fa-recovery-text" readonly rows="4">' + _esc(codesText) + '</textarea>' +
        '<div class="sec-2fa-recovery-actions">' +
          '<button class="btn btn-gold" onclick="_2faCopyCodes()">' +
            (window.Icons && Icons.copy ? Icons.copy({size:13}) : '') + ' Alle Codes kopieren' +
          '</button>' +
          '<button class="btn btn-outline" onclick="_2faSelectCodes()">Alles markieren</button>' +
        '</div>' +
      '</div>' +
      '<label class="sec-2fa-confirm-saved">' +
        '<input type="checkbox" id="sec-2fa-saved-cb" /> ' +
        'Ich habe die Codes sicher gespeichert' +
      '</label>' +
      '<div class="sec-2fa-actions">' +
        '<button class="btn btn-primary" id="sec-2fa-done-btn" disabled onclick="_renderTwoFactor()">Fertig</button>' +
      '</div>' +
    '</div>';
  // Done-Button erst aktivieren wenn Checkbox gesetzt
  setTimeout(function() {
    var cb = document.getElementById('sec-2fa-saved-cb');
    var btn = document.getElementById('sec-2fa-done-btn');
    if (cb && btn) {
      cb.addEventListener('change', function() { btn.disabled = !cb.checked; });
    }
  }, 60);
}

function _2faCopyCodes() {
  var ta = document.getElementById('sec-2fa-recovery-text');
  if (!ta) return;
  ta.select(); ta.setSelectionRange(0, 99999);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ta.value).then(function() {
        if (typeof toast === 'function') toast('✓ Codes in Zwischenablage kopiert');
      });
    } else {
      document.execCommand('copy');
      if (typeof toast === 'function') toast('✓ Codes kopiert');
    }
  } catch (e) {
    if (typeof toast === 'function') toast('Kopieren fehlgeschlagen — bitte manuell markieren');
  }
}
window._2faCopyCodes = _2faCopyCodes;

function _2faSelectCodes() {
  var ta = document.getElementById('sec-2fa-recovery-text');
  if (ta) { ta.focus(); ta.select(); ta.setSelectionRange(0, 99999); }
}
window._2faSelectCodes = _2faSelectCodes;

function _2faCopySecret(btn, secret) {
  try {
    navigator.clipboard.writeText(secret);
    btn.textContent = '✓ kopiert';
    setTimeout(function() { btn.textContent = 'Kopieren'; }, 1500);
  } catch (e) {}
}
window._2faCopySecret = _2faCopySecret;

// ─────── Disable-Flow ───────
function _2faStartDisable() {
  var host = document.getElementById('sec-2fa-host');
  if (!host) return;
  host.innerHTML =
    '<div class="sec-2fa-card sec-2fa-disable">' +
      '<div class="sec-2fa-step-h" style="color:#E47A7A">2FA deaktivieren</div>' +
      '<p class="sec-2fa-instructions">Zur Bestätigung benötigen wir deinen aktuellen 6-stelligen Code aus der Authenticator-App.</p>' +
      '<div class="sec-2fa-code-row">' +
        '<input type="text" id="sec-2fa-disable-code" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="000000" autocomplete="one-time-code" />' +
        '<button class="btn btn-danger" onclick="_2faConfirmDisable()">2FA deaktivieren</button>' +
      '</div>' +
      '<div class="sec-2fa-actions" style="margin-top:16px">' +
        '<button class="btn btn-outline" onclick="_renderTwoFactor()">Abbrechen</button>' +
      '</div>' +
    '</div>';
  setTimeout(function() {
    var inp = document.getElementById('sec-2fa-disable-code');
    if (inp) inp.focus();
  }, 60);
}
window._2faStartDisable = _2faStartDisable;

async function _2faConfirmDisable() {
  var inp = document.getElementById('sec-2fa-disable-code');
  if (!inp) return;
  var code = (inp.value || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) {
    if (typeof toast === 'function') toast('Bitte 6-stelligen Code eingeben');
    return;
  }
  try {
    await _api2faDisable(code);
    if (typeof toast === 'function') toast('✓ 2FA deaktiviert');
    _renderTwoFactor();
  } catch (e) {
    if (typeof toast === 'function') toast('✗ ' + (e.message || 'Code ungültig'));
    inp.value = '';
    inp.focus();
  }
}
window._2faConfirmDisable = _2faConfirmDisable;

// ─────── Recovery-Codes neu generieren ───────
async function _2faRegenerateCodes() {
  // Mini-Modal in der Karte: Code eingeben + bestätigen
  var host = document.getElementById('sec-2fa-host');
  if (!host) return;
  var prev = host.innerHTML;
  host.innerHTML =
    '<div class="sec-2fa-card sec-2fa-disable">' +
      '<div class="sec-2fa-step-h">Recovery-Codes neu generieren</div>' +
      '<p class="sec-2fa-instructions">Zur Bestätigung den aktuellen 6-stelligen Code aus deiner Authenticator-App eingeben. Die alten Codes werden ungültig.</p>' +
      '<div class="sec-2fa-code-row">' +
        '<input type="text" id="sec-2fa-regen-code" maxlength="6" inputmode="numeric" pattern="[0-9]*" placeholder="000000" autocomplete="one-time-code" />' +
        '<button class="btn btn-gold" onclick="_2faDoRegenerate()">Neue Codes generieren</button>' +
      '</div>' +
      '<div class="sec-2fa-actions" style="margin-top:16px">' +
        '<button class="btn btn-outline" onclick="_renderTwoFactor()">Abbrechen</button>' +
      '</div>' +
    '</div>';
  setTimeout(function() {
    var inp = document.getElementById('sec-2fa-regen-code');
    if (inp) inp.focus();
  }, 60);
}
window._2faRegenerateCodes = _2faRegenerateCodes;

async function _2faDoRegenerate() {
  var inp = document.getElementById('sec-2fa-regen-code');
  if (!inp) return;
  var code = (inp.value || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code)) {
    if (typeof toast === 'function') toast('Bitte 6-stelligen Code eingeben');
    return;
  }
  try {
    var res = await _api2faRegenerateCodes(code);
    if (res.recoveryCodes) {
      _render2faRecoveryCodes(res.recoveryCodes, /*isFirstSetup*/false);
    }
  } catch (e) {
    if (typeof toast === 'function') toast('✗ ' + (e.message || 'Code ungültig'));
    inp.value = '';
    inp.focus();
  }
}
window._2faDoRegenerate = _2faDoRegenerate;

// ─────── API-Wrapper ───────
// V63.81: nutzt denselben API-Base wie Auth.apiCall — meta-tag oder window.JI_API_BASE
function _api2faBase() {
  var token = localStorage.getItem('ji_token');
  if (!token) throw new Error('Nicht eingeloggt');
  var base = window.JI_API_BASE;
  if (!base) {
    var meta = document.querySelector('meta[name="ji-api-base"]');
    if (meta && meta.content) base = meta.content;
  }
  if (!base) throw new Error('API-Base nicht konfiguriert');
  return { base: base, token: token };
}

async function _api2faStatus() {
  var c = _api2faBase();
  var r = await fetch(c.base + '/auth/2fa/status', {
    headers: { 'Authorization': 'Bearer ' + c.token }
  });
  if (!r.ok) {
    var j = {};
    try { j = await r.json(); } catch (e) {}
    throw new Error(j.error || ('Status ' + r.status));
  }
  return r.json();
}
async function _api2faSetup() {
  var c = _api2faBase();
  var r = await fetch(c.base + '/auth/2fa/setup', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + c.token, 'Content-Type': 'application/json' },
    body: '{}'
  });
  var j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Setup-Anfrage fehlgeschlagen');
  return j;
}
async function _api2faConfirm(code) {
  var c = _api2faBase();
  var r = await fetch(c.base + '/auth/2fa/confirm', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code })
  });
  var j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Bestätigung fehlgeschlagen');
  return j;
}
async function _api2faDisable(code) {
  var c = _api2faBase();
  var r = await fetch(c.base + '/auth/2fa/disable', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code })
  });
  var j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Deaktivierung fehlgeschlagen');
  return j;
}
async function _api2faRegenerateCodes(code) {
  var c = _api2faBase();
  var r = await fetch(c.base + '/auth/2fa/regenerate-codes', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code })
  });
  var j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Regenerierung fehlgeschlagen');
  return j;
}

/* === V212 collapse-market-cards toggle START === */
// V212: Markt-Cards Default-Collapse-Toggle
(function() {
  function _readSettings() {
    try { return JSON.parse(localStorage.getItem('dp_user_settings') || '{}'); }
    catch(e) { return {}; }
  }
  function _writeSettings(patch) {
    var s = _readSettings();
    Object.assign(s, patch);
    try { localStorage.setItem('dp_user_settings', JSON.stringify(s)); } catch(e) {}
  }

  // Wird bei Settings-Modal-Render aufgerufen
  window.renderV212CollapseToggle = function(containerId) {
    var container = typeof containerId === 'string'
      ? document.getElementById(containerId) : containerId;
    if (!container) return;
    if (container.querySelector('[data-v212-collapse-toggle]')) return; // bereits da

    var s = _readSettings();
    // Default: true = zugeklappt
    var checked = (typeof s.collapseMarketCards === 'boolean')
      ? s.collapseMarketCards : true;

    var wrap = document.createElement('div');
    wrap.setAttribute('data-v212-collapse-toggle', '1');
    wrap.style.cssText = 'margin:14px 0;padding:12px 14px;background:#FAF9F4;border-radius:8px;border:1px solid rgba(201,168,76,0.25);';
    wrap.innerHTML =
      '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-weight:500;">' +
      '  <input type="checkbox" id="v212-collapse-market-cards"' + (checked ? ' checked' : '') + ' style="margin-top:3px;flex-shrink:0;cursor:pointer;">' +
      '  <span>' +
      '    <span style="display:block;font-size:13px;color:var(--ch);">Markt-Daten-Cards standardmäßig zugeklappt</span>' +
      '    <span style="display:block;font-size:11.5px;color:var(--muted);margin-top:2px;line-height:1.5;">' +
      '      Wenn aktiviert, werden die Markt-Kontext-, Marktzinsen- und Pfandbrief-Cards im Finanzierung-Tab beim Laden automatisch zugeklappt. Du kannst sie jederzeit einzeln per Klick öffnen.' +
      '    </span>' +
      '  </span>' +
      '</label>' +
      '<div style="margin-top:10px;text-align:right">' +
      '  <button type="button" class="btn btn-outline btn-sm" onclick="window.resetV212CardOverrides()" title="Verwirft alle manuellen Ein-/Ausklapp-Entscheidungen">Alle Karten zurücksetzen</button>' +
      '</div>';

    container.appendChild(wrap);

    var cb = wrap.querySelector('#v212-collapse-market-cards');
    cb.addEventListener('change', function() {
      _writeSettings({ collapseMarketCards: cb.checked });
      if (window.CollapsibleCards && window.CollapsibleCards.applyDefaultFromSettings) {
        window.CollapsibleCards.applyDefaultFromSettings(cb.checked);
      }
    });
  };

  window.resetV212CardOverrides = function() {
    if (window.CollapsibleCards && window.CollapsibleCards.resetAllOverrides) {
      window.CollapsibleCards.resetAllOverrides();
    }
  };
})();
/* === V212 collapse-market-cards toggle END === */

/* === V213 collapse-toggle helpers (global) START === */
function _v213IsChecked() {
  try {
    var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
    return (typeof s.collapseMarketCards === 'boolean') ? s.collapseMarketCards : true;
  } catch(e) { return true; }
}
function _v213OnToggleChange(cb) {
  try {
    var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
    s.collapseMarketCards = cb.checked;
    localStorage.setItem('dp_user_settings', JSON.stringify(s));
    if (window.CollapsibleCards && window.CollapsibleCards.applyDefaultFromSettings) {
      window.CollapsibleCards.applyDefaultFromSettings(cb.checked);
    }
  } catch(e) {}
}
function _v213ResetCards() {
  if (window.CollapsibleCards && window.CollapsibleCards.resetAllOverrides) {
    window.CollapsibleCards.resetAllOverrides();
  }
}
/* === V213 collapse-toggle helpers (global) END === */
