/* ══ v3022 · EINSTELLUNGEN SCHLANK — ENTWURF HINTER EINEM SCHALTER ══════

   Marcel am 28.10.2026: „brauchen wir eigentlich unter Einstellungen die
   ganzen Parameter und Co-Pilot (KI)? … Ich möchte die Kunden nicht
   verwirren – macht das Programm die meisten Dinge nicht eh intuitiv
   nach den Angaben in den Tabs?" — „ja, mach mal einen Entwurf".

   EIN SCHALTER, Vorgabe AUS. Ohne ihn bleibt alles wie heute:
     ?einstellungen=schlank           gilt für diesen Browser-Tab (sessionStorage)
     ?einstellungen=schlank&merken    merkt es sich dauerhaft (localStorage dp_einst_schlank=1)
     ?einstellungen=voll              schaltet beides wieder ab

   Der Tab-Merker ist Absicht: andere Tabs desselben Browsers (Messe-
   Aufnahmen, PDF-Tests) teilen localStorage und sollen nichts merken.

   WAS DER ENTWURF TUT — nur Umsortieren und Ausblenden, nichts wird
   gelöscht, jeder gespeicherte Wert bleibt erhalten:
     · Reiter „Standardwerte" heißt „Mein Profil" und steht direkt nach
       Account; dazu kommen Strategie und Risikoneigung (aus dem
       Co-Pilot-Reiter HERÜBERGEHOBEN — dieselben Felder, kein Doppel)
       und eine Zeile zum Bewertungsprofil des Deal Score.
     · Co-Pilot (KI): zwei Auswahlen (Länge, Ton); Fokus, Eigene
       Anweisungen, Vorlagen und Eigenes Wissen unter „Für Profis".
       Marktphase und Verkäuferbereitschaft stehen dort nicht mehr — und
       gehen im Entwurf auch NICHT mehr in den Prompt (ui.js): was man
       nicht sieht, darf das Urteil nicht verschieben. Die
       Verkäuferbereitschaft gibt es stattdessen je Objekt im Reiter
       Pilot-Analyse (Feld ai_verk, speichert über die FIELDS-Liste von
       storage.js, die den Namen seit Langem führt).
     · Deal Score: Reiter ausgeblendet. Eigene Gewichte/Profile WIRKEN
       WEITER (kein stilles Umrechnen); ist etwas anderes als „Ausgewogen"
       aktiv, sagt es „Mein Profil" und bietet „auf Standard" an.
     · Datenraum nur, wenn genutzt oder ab Investor; Mandanten nur, wenn
       mehr als „Privat" angelegt ist oder ab Pro.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function aktiv() {
    try { if (sessionStorage.getItem('dp_einst_schlank') === '1') return true; } catch (e) {}
    try { if (localStorage.getItem('dp_einst_schlank') === '1') return true; } catch (e) {}
    return false;
  }

  /* URL-Schalter auswerten — einmal beim Laden */
  (function () {
    try {
      var q = new URLSearchParams(location.search);
      var v = q.get('einstellungen');
      if (v === 'schlank') {
        sessionStorage.setItem('dp_einst_schlank', '1');
        if (q.has('merken')) localStorage.setItem('dp_einst_schlank', '1');
      } else if (v === 'voll') {
        sessionStorage.removeItem('dp_einst_schlank');
        localStorage.removeItem('dp_einst_schlank');
      }
    } catch (e) {}
  })();

  /* Die Risikotexte, die das Einrichtungsfenster schreibt (onboarding.js
     GRENZEN.risk), und die drei der alten Auswahl. Ein gespeicherter Text,
     der in keiner Liste steht, wird als eigene Option angezeigt — nie
     still durch die erste ersetzt. */
  var RISIKO = ['Konservativ (sicherheitsorientiert)', 'Moderat (ausgewogen)', 'Chancenorientiert (höheres Risiko)'];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function profil() { return window.DealPilotInvestmentProfile || null; }

  function profilSchreiben(feld, wert) {
    var P = profil(); if (!P || !P.load || !P.save) return;
    var p = P.load() || {};
    p[feld] = wert;
    P.save(p);
    try { if (P.syncAiParamsToTab) P.syncAiParamsToTab(); } catch (e) {}
  }

  /* ── Deal-Score-Zeile: was gilt gerade, und wie kommt man zum Standard ── */
  function scoreZeileHtml() {
    var preset = 'balanced', eigen = false, name = 'Ausgewogen';
    try { if (window.DealScore2 && DealScore2.getActivePreset) preset = DealScore2.getActivePreset(); } catch (e) {}
    try { eigen = localStorage.getItem('dp_dealscore_eigen') === '1'; } catch (e) {}
    try {
      var ps = (window.DealScore2 && DealScore2.getPresets) ? DealScore2.getPresets() : [];
      ps.forEach(function (p) { if ((p.key || p.id) === preset) name = p.label || p.name || name; });
    } catch (e) {}
    var standard = (preset === 'balanced' && !eigen);
    var text;
    if (preset === 'custom' || eigen) text = '<b>Eigene Gewichtung aktiv.</b> Dein Deal Score rechnet mit selbst gesetzten Gewichten.';
    else if (standard) text = 'Dein Deal Score rechnet mit der <b>Standardgewichtung</b> (Ausgewogen).';
    else text = 'Dein Deal Score rechnet mit dem Bewertungsprofil <b>' + esc(name) + '</b> aus deiner Einrichtung.';
    return '<div class="dp-es-score" style="margin:10px 0 4px;padding:10px 12px;border:1px solid rgba(201,168,76,.35);border-radius:10px;font-size:13px;line-height:1.5">' +
      text +
      (standard ? '' : ' <button type="button" class="btn btn-sm btn-ghost dp-es-score-std" style="margin-left:6px">Auf Standard zurücksetzen</button>') +
      '</div>';
  }

  function scoreZeileVerdrahten(root) {
    var b = root.querySelector('.dp-es-score-std');
    if (!b) return;
    b.addEventListener('click', function () {
      if (!confirm('Deal Score auf die Standardgewichtung (Ausgewogen) zurücksetzen? Die Scores deiner Objekte können sich dadurch ändern.')) return;
      try { if (window.DealScore2 && DealScore2.setActivePreset) DealScore2.setActivePreset('balanced'); } catch (e) {}
      var box = root.querySelector('.dp-es-score');
      if (box) { var t = document.createElement('div'); t.innerHTML = scoreZeileHtml(); box.parentNode.replaceChild(t.firstChild, box); }
      try { if (typeof window.renderDealScore2 === 'function') window.renderDealScore2(); } catch (e) {}
      if (typeof window.toast === 'function') window.toast('✓ Deal Score rechnet wieder mit der Standardgewichtung');
    });
  }

  /* ── Umbau des fertig gebauten Einstellungsfensters ── */
  function umbauen() {
    var modal = document.getElementById('settings-modal');
    if (!modal || modal.getAttribute('data-schlank') === '1') return;
    modal.setAttribute('data-schlank', '1');
    modal.classList.add('dp-einst-schlank');

    var liste = modal.querySelector('.settings-tabs');
    function tab(k) { return modal.querySelector('.st-tab[data-tab="' + k + '"]'); }
    function pane(k) { return modal.querySelector('.st-pane[data-pane="' + k + '"]'); }
    function verstecke(el) { if (el) el.style.display = 'none'; }
    function benenne(k, titel, desc) {
      var b = tab(k); if (!b) return;
      var t = b.querySelector('.help-sidebar-item-title'), d = b.querySelector('.help-sidebar-item-desc');
      if (t) t.textContent = titel;
      if (d) d.textContent = desc;
    }

    /* Reiter: Deal Score weg, Mein Profil nach vorn */
    verstecke(tab('dealscore'));
    benenne('standardwerte', 'Mein Profil', 'Steuer, Finanzierung, Zielrendite, Haltung');
    benenne('api', 'Co-Pilot (KI)', 'Länge und Ton der Analysen');
    if (liste && tab('account') && tab('standardwerte')) liste.insertBefore(tab('standardwerte'), tab('account').nextSibling);

    /* Datenraum / Mandanten nur, wenn genutzt oder ab Plan */
    var plan = '';
    try { plan = (DealPilotConfig.pricing.currentKey() || '').toLowerCase(); } catch (e) {}
    var drGenutzt = false;
    try { var dr = JSON.parse(localStorage.getItem('dp_datenraum_v141') || '{}'); drGenutzt = !!(dr.persoenlich || (dr.objekte && Object.keys(dr.objekte).length)); } catch (e) {}
    if (!drGenutzt && ['investor', 'pro', 'partner'].indexOf(plan) < 0) verstecke(tab('datenraum'));
    var mandMehr = false;
    try { mandMehr = ((JSON.parse(localStorage.getItem('dp_mandanten') || '{}').list) || []).length > 1; } catch (e) {}
    if (!mandMehr && ['pro', 'partner'].indexOf(plan) < 0) verstecke(tab('mandanten'));

    /* Co-Pilot (KI) */
    var api = pane('api');
    if (api) {
      var hint = api.querySelector(':scope > p.hint');
      if (hint) hint.textContent = 'So schreiben deine Pilot-Analysen. Die Zahlen kommen immer aus dem Objekt — diese Auswahl ändert nur die Form, nicht das Ergebnis.';
      var h3s = api.querySelectorAll(':scope > h3.set-section-h');
      if (h3s[0]) h3s[0].textContent = 'So antwortet der Co-Pilot';
      var dl = api.querySelector('#set_ai_detail_level'), to = api.querySelector('#set_ai_tonality');
      function lbl(sel, txt) { var f = sel && sel.closest('.f'); var l = f && f.querySelector('label'); if (l) l.textContent = txt; }
      lbl(dl, 'Länge'); lbl(to, 'Ton');

      /* Strategie + Risikoneigung wandern nach „Mein Profil";
         Verkäuferbereitschaft + Marktphase verschwinden aus der Ansicht.
         Die Elemente bleiben im DOM (Speichern liest set_ai_* per id). */
      var strat = api.querySelector('#set_ai_strat'), risk = api.querySelector('#set_ai_risk');
      var verk = api.querySelector('#set_ai_verk'), markt = api.querySelector('#set_ai_markt');
      var paramGrid = strat ? strat.closest('.g2') : null;
      var paramH = null, paramHint = null;
      for (var i = 0; i < h3s.length; i++) if (/Standard-Analyseparameter/.test(h3s[i].textContent)) paramH = h3s[i];
      if (paramH) { paramHint = paramH.nextElementSibling; verstecke(paramH); if (paramHint && paramHint.matches('p.hint')) verstecke(paramHint); }

      /* „Für Profis": Fokus, Eigene Anweisungen, Vorlagen, Eigenes Wissen */
      var det = document.createElement('details');
      det.className = 'dp-es-profis';
      det.style.cssText = 'margin-top:18px;border-top:1px solid rgba(201,168,76,.3);padding-top:10px';
      det.innerHTML = '<summary style="cursor:pointer;font-weight:600;font-size:13px;padding:6px 0">Für Profis — Fokus, eigene Anweisungen, eigenes Wissen</summary>';
      var focus = api.querySelector('.ai-focus-checks'), ci = api.querySelector('#set_ai_custom_instructions'),
          sugg = api.querySelector('.ai-suggestions'), wissen = api.querySelector('#set_eigenes_wissen');
      var wissenF = wissen && wissen.closest('.f');
      var wissenH = null;
      for (var j = 0; j < h3s.length; j++) if (/Eigenes Wissen/.test(h3s[j].textContent)) wissenH = h3s[j];
      var wissenHint = wissenH ? wissenH.nextElementSibling : null;
      [focus && focus.closest('.f'), ci && ci.closest('.f'), sugg && sugg.closest('.f'), wissenH, wissenHint, wissenF].forEach(function (n) { if (n) det.appendChild(n); });
      api.appendChild(det);

      /* Mein Profil: Abschnitt „Deine Haltung" vor den Standardwerten */
      var sw = pane('standardwerte');
      var host = sw && sw.querySelector('#ip-pane-host');
      if (sw && host && strat && risk) {
        var box = document.createElement('div');
        box.className = 'dp-es-haltung';
        box.innerHTML = '<h3 class="ip-section">Deine Haltung</h3>' +
          '<p class="hint">Strategie und Risikoneigung gehen in die Pilot-Analyse ein und färben ihre Empfehlung — die Zahlen ändern sie nicht. Änderungen gelten sofort.</p>' +
          '<div class="g2 dp-es-haltung-grid"></div>' + scoreZeileHtml();
        var grid = box.querySelector('.dp-es-haltung-grid');
        /* Risikoauswahl auf die Texte des Einrichtungsfensters bringen;
           ein gespeicherter Fremdtext bleibt als eigene Option stehen. */
        var P = profil(), roh = (P && P.load && P.load()) || {};
        var aktRisk = roh.ai_risk || (P && P.get ? P.get('ai_risk') : '') || 'Moderat (ausgewogen)';
        var liste2 = RISIKO.slice(); if (aktRisk && liste2.indexOf(aktRisk) < 0) liste2.push(aktRisk);
        risk.innerHTML = liste2.map(function (o) { return '<option' + (o === aktRisk ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
        var fs = strat.closest('.f'), fr = risk.closest('.f');
        var ls = fs && fs.querySelector('label'), lr = fr && fr.querySelector('label');
        if (ls) ls.textContent = 'Strategie'; if (lr) lr.textContent = 'Risikoneigung';
        if (fs) grid.appendChild(fs); if (fr) grid.appendChild(fr);
        sw.insertBefore(box, host);
        strat.addEventListener('change', function () { profilSchreiben('ai_strat', strat.value); });
        risk.addEventListener('change', function () { profilSchreiben('ai_risk', risk.value); });
        scoreZeileVerdrahten(box);
      }
      if (paramGrid) verstecke(paramGrid);
      /* Verkäufer/Markt: im Entwurf nicht mehr gezeigt — und damit das
         globale Speichern sie nicht still mit der Vorbelegung festschreibt,
         nehmen wir ihnen die id (saveSettings prüft `if (aiVerkEl)`). */
      if (verk) verk.removeAttribute('id');
      if (markt) markt.removeAttribute('id');
    }
  }

  /* Bandtitel beim Reiterwechsel nachziehen */
  var BAND = {
    standardwerte: ['Mein Profil', 'Was in jede Rechnung einfließt — und deine Haltung für die Pilot-Analyse.'],
    api: ['Co-Pilot (KI)', 'Länge und Ton deiner Pilot-Analysen.']
  };

  function einhaengen() {
    if (typeof window.showSettings === 'function' && !window.showSettings._schlank) {
      var orig = window.showSettings;
      var neu = function () {
        var r = orig.apply(this, arguments);
        if (aktiv()) { try { umbauen(); } catch (e) { console.warn('[einst-schlank]', e); } }
        var akt = document.querySelector('#settings-modal .st-tab.active');
        if (aktiv() && akt) band(akt.getAttribute('data-tab'));
        return r;
      };
      neu._schlank = true;
      window.showSettings = neu;
    }
    if (typeof window._swSet === 'function' && !window._swSet._schlank) {
      var o2 = window._swSet;
      var n2 = function (btn) {
        var r = o2.apply(this, arguments);
        if (aktiv()) band(btn && btn.getAttribute && btn.getAttribute('data-tab'));
        return r;
      };
      n2._schlank = true;
      window._swSet = n2;
    }
  }
  function band(k) {
    var e = BAND[k]; if (!e) return;
    var t = document.getElementById('set-band-title'), s = document.getElementById('set-band-sub');
    if (t) t.textContent = e[0]; if (s) s.textContent = e[1];
  }

  /* Verkäuferbereitschaft je Objekt — nur im Entwurf, im Reiter Pilot-Analyse */
  function objektFeld() {
    if (!aktiv() || document.getElementById('ai_verk')) return;
    var btn = document.getElementById('ai-btn');
    if (!btn || !btn.parentNode) return;
    var w = document.createElement('div');
    w.className = 'f dp-es-verk';
    w.style.cssText = 'max-width:420px;margin:0 0 12px';
    w.innerHTML = '<label for="ai_verk">Verkäufer unter Zeitdruck? <span class="f-hint">(nur dieses Objekt, freiwillig)</span></label>' +
      '<select id="ai_verk"><option value="">keine Angabe</option>' +
      '<option>Hoch (dringender Verkauf, Zeitdruck)</option>' +
      '<option>Niedrig (gut situiert, kein Druck)</option></select>';
    btn.parentNode.insertBefore(w, btn);
  }

  window.DpEinstSchlank = {
    aktiv: aktiv,
    /* für ui.js: Verkäuferbereitschaft dieses Objekts ('' = keine Angabe) */
    verkaeuferObjekt: function () { var e = document.getElementById('ai_verk'); return e ? (e.value || '') : ''; }
  };

  einhaengen();
  objektFeld();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { einhaengen(); objektFeld(); });
})();
