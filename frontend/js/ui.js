'use strict';
/* W31-wl-token: Gold-Literale zeigen auf die Whitelabel-Ebene
   (var(--wl-<hex>, #<hex>)). Ohne Whitelabel greift der Fallback. */


/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN – ui.js V5.2
   Tabs, Bilder, Toast, KI-Analyse (OpenAI/ChatGPT)
═══════════════════════════════════════════════════ */

// ── TOAST ────────────────────────────────────────────
function toast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(function() { t.classList.remove('show'); }, 2800);
}

// ── TABS ──────────────────────────────────────────────

// V62: Header-Action-Buttons (Verlauf, Teilen, Duplizieren) — echte Implementierungen
function showObjHistory() {
  // Springt zum Tab "Gespeicherte Objekte" — zeigt alle Objekte des Users
  if (typeof showSavedObjects === 'function') {
    showSavedObjects();
  } else if (typeof toast === 'function') {
    toast('ℹ Verlauf: Klick auf "Gespeicherte Objekte" in der Sidebar.');
  }
}

function shareObj() {
  // Generiert einen kopierbaren Link mit der Objektnummer (für interne Referenz)
  var seq = window._currentObjSeq || 'Neues Objekt';
  var addr = (function() {
    var a = document.getElementById('hdr-obj');
    return a ? a.textContent : '';
  })();
  var text = 'DealPilot-Objekt: ' + seq + (addr && addr !== 'Neues Objekt' ? ' — ' + addr : '');

  if (navigator.share) {
    navigator.share({ title: 'DealPilot Objekt', text: text }).catch(function(){});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() {
      if (typeof toast === 'function') toast('✓ Objekt-Info in Zwischenablage kopiert');
    }).catch(function() {
      if (typeof toast === 'function') toast('ℹ Bitte Browser-Berechtigung für Zwischenablage gewähren');
    });
  } else {
    if (typeof toast === 'function') toast('ℹ Teilen: ' + text);
  }
}

function duplicateObj() {
  // Dupliziert das aktuelle Objekt: speichert Kopie unter neuer Nummer
  if (!confirm('Aktuelles Objekt als Kopie speichern?\nEs wird eine neue Objektnummer vergeben.')) return;
  // Aktuelle Objektnummer + Key löschen damit als neues Objekt gespeichert wird
  window._currentObjKey = null;
  window._currentObjSeq = null;
  if (typeof ObjNumbering !== 'undefined' && typeof ObjNumbering.next === 'function') {
    window._currentObjSeq = ObjNumbering.next();
  }
  if (typeof saveObj === 'function') {
    saveObj({ silent: false });
    if (typeof toast === 'function') toast('✓ Objekt dupliziert — neue Nummer: ' + (window._currentObjSeq || ''));
  }
}

window.showObjHistory = showObjHistory;
window.shareObj = shareObj;
window.duplicateObj = duplicateObj;

// V62: Tab-Workflow-Bar — Titel + Beschreibung pro Tab
// V65.2 FIX: Tab-Indizes korrekt seit V63.76 (Quick-Check ist Standalone-View, kein Tab mehr).
// Tab 0 = Objekt, Tab 1 = Investition, etc.
var TAB_META = [
  { title: 'Objekt',          sub: 'Grunddaten, Lage und Objektfotos für den Bankexport.' },
  { title: 'Investition',     sub: 'Kaufpreis, Kaufnebenkosten und Sanierungsbudget.' },
  { title: 'Miete',           sub: 'Nettokaltmiete, Mietstruktur und Marktanalyse.' },
  { title: 'Steuer-Details',  sub: 'AfA, Werbungskosten und persönliche Steuerprognose.' },
  { title: 'Finanzierung',    sub: 'Darlehen, Zins, Tilgung und DSCR.' },
  { title: 'Bewirtschaftung', sub: 'Hausgeld, Verwaltung und Instandhaltung.' },
  { title: 'Pilot-Analyse',      sub: 'Automatische Bewertung von Lage und Investmentpotenzial.' },
  { title: 'Kennzahlen',      sub: 'Alle KPIs, Szenarien, Charts und Projektion.' },
  { title: 'Deal-Aktion',     sub: 'Empfehlung, Bietstrategie und Verhandlung.' }
];

function updateTabWorkflowBar(tabIndex) {
  var meta = TAB_META[tabIndex] || TAB_META[0];
  var titleEl = document.getElementById('wf-current-tab-title');
  var subEl = document.getElementById('wf-current-tab-sub');
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.sub;

  var pct = 0;
  if (window.DealPilotWorkflow && typeof window.DealPilotWorkflow.getStatus === 'function') {
    try {
      var status = window.DealPilotWorkflow.getStatus();
      pct = Math.round((status.complete / status.total) * 100);
    } catch(e) {}
  }
  var pctEl = document.getElementById('wf-progress-pct');
  var fillEl = document.getElementById('wf-progress-fill');
  if (pctEl) {
    var lblTxt = pct >= 100 ? 'Grunddaten vollständig — einfache Bewertung möglich' :
                 pct >=  60 ? pct + ' % Grunddaten · weitere Felder erhöhen Genauigkeit' :
                 pct + ' % Grunddaten ausgefüllt';
    pctEl.textContent = lblTxt;
  }
  if (fillEl) fillEl.style.width = pct + '%';
}
window.updateTabWorkflowBar = updateTabWorkflowBar;

// Auto-Update bei Eingaben
document.addEventListener('input', function() {
  setTimeout(function() {
    var activeTab = -1;
    document.querySelectorAll('.tab').forEach(function(t, j) {
      if (t.classList.contains('active')) activeTab = j;
    });
    if (activeTab >= 0) updateTabWorkflowBar(activeTab);
  }, 200);
});

function switchTab(i) {
  /* v652-qc-exit: Klick auf einen Tab verlaesst den inline-QuickCheck sauber */
  if (document.body.classList.contains('qc-standalone-active') && typeof exitQuickCheckMode === 'function') {
    try { exitQuickCheckMode(); } catch (e) {}
  }
  /* v645-mb-exit: Klick auf einen Tab verlaesst den inline-Marktbericht sauber */
  if (document.body.classList.contains('mb-standalone-active')) {
    document.body.classList.remove('mb-standalone-active');
    var _mbx = document.getElementById('s-marktbericht'); if (_mbx) { _mbx.classList.remove('active'); _mbx.innerHTML = ''; }
  }
  // V47: Tab-Wechsel triggert Save (Auto-Save ist aus)
  if (typeof window.dpTabSwitchSave === 'function') {
    try { window.dpTabSwitchSave(); } catch(e) {}
  }
  // V63.26: Spalt zwischen Tab-Bar und Workflow-Bar nachjustieren
  if (typeof window._updateWfTop === 'function') {
    setTimeout(window._updateWfTop, 30);
    setTimeout(window._updateWfTop, 200);
  }
  
  // V189: data-target-sec Mechanik — Tab-Bar-Reihenfolge unabhängig von DOM-Reihenfolge
  // Wenn der i-te Tab-Button ein data-target-sec hat, nutze das. Sonst alter Fallback (Index→DOM-Position).
  var tabs = document.querySelectorAll('.tab');
  var targetSecId = null;
  if (tabs[i] && tabs[i].getAttribute('data-target-sec')) {
    targetSecId = tabs[i].getAttribute('data-target-sec');
  }
  
  if (targetSecId) {
    // Neue Logik: schalte gezielt nur die ID-passende Section auf .active
    document.querySelectorAll('.sec').forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById(targetSecId);
    if (target && !target.classList.contains('sec-hidden')) {
      target.classList.add('active');
    }
  } else {
    // Alter Pfad (Backwards-Compat)
    document.querySelectorAll('.sec:not(.sec-hidden)').forEach(function(s, j) { s.classList.toggle('active', j === i); });
    document.querySelectorAll('.sec-hidden').forEach(function(s) { s.classList.remove('active'); });
  }
  
  document.querySelectorAll('.tab').forEach(function(t, j) { t.classList.toggle('active', j === i); });

  /* v1243: Der geöffnete Bereich gilt ab jetzt als angesehen. Vorher hieß das
     Häkchen nur „alle Pflichtfelder gefüllt" — und beim Steuer-Reiter genügte
     dafür der vorbelegte Grenzsteuersatz von 42 %. */
  try {
    if (tabs[i] && window.DealPilotWorkflow && DealPilotWorkflow.merkeBesuch) {
      DealPilotWorkflow.merkeBesuch(tabs[i].getAttribute('data-wf-key'));
    }
  } catch (e) {}

  // V62: Workflow-Bar Titel + Beschreibung pro Tab aktualisieren
  if (typeof updateTabWorkflowBar === 'function') {
    updateTabWorkflowBar(i);
  }
  // V65.2: Sichtbarkeit (User-Setting) nach jedem Tab-Wechsel respektieren
  if (typeof window.applyWorkflowBarVisibility === 'function') {
    setTimeout(window.applyWorkflowBarVisibility, 50);
  }
  // V51: V63.76: Tab 0 = Objekt (Quick-Check ist jetzt Standalone-View) → Live-Update der Bewertung
  // V53: V63.76: Tab 0 = Objekt (Quick-Check ist jetzt Standalone-View) → renders das volle Quick-Check-UI in den Tab-Host
  // V63.76: Quick-Check ist KEIN Tab mehr — dieser Hook ist entfernt.
  // Tab 0 ist jetzt "Objekt".

  // V63.76: Tab 7 = Kennzahlen (zuvor Tab 8 vor Quick-Check-Refactor) → build charts
  if (i === 7) {
    setTimeout(function() {
      if (typeof buildCharts === 'function') buildCharts();
      // V48: Eine Sync-Action triggert ALLE Score-Anzeigen konsistent
      if (typeof dpUpdateAll === 'function') {
        try { dpUpdateAll(); } catch(e) { console.warn('[V48] dpUpdateAll fail:', e); }
      } else {
        if (typeof renderDealScore === 'function') renderDealScore();
        if (typeof renderDealScore2 === 'function') {
          try { renderDealScore2(); } catch(e) {}
        }
        if (typeof renderDs2Readonly === 'function') {
          try { renderDs2Readonly(); } catch(e) {}
        }
      }
    }, 100);
  }
  // Saved-Objekte view (sec-hidden) is opened separately, not via tab
}

/* ═══════════════════════════════════════════════════════════════════════
   v1905 · DAS REGISTER DER HAUPTANSICHTEN   (Befund N38)

   GEMESSEN am 06.10.2026, Messkabine 390 px, Aussehen Aktenmappe, ueber den
   ECHTEN Bedienweg (die Knoepfe `.sb-act-item` im Aktionsblock):

     erst Portfolio-Cockpit, dann Portfolio-Strategie
       #dashboard-main        display:block   385,6 x 9.013,9  @ y   119,3
       #portfolio-strategie   display:block   385,6 x 1.915    @ y 9.133,2
       .main-col scrollTop    0
       data-pst-offen         "1"  (also "offen" — und trotzdem unsichtbar)

   Wer vorher im Cockpit war, sah nach dem Klick auf „Portfolio-Strategie"
   weiter das Cockpit und muesste rund 9.000 px scrollen.

   DIE URSACHE IST NICHT DAS EINE ELEMENT. `openPortfolioStrategie()`
   (portfolio-strategie.js) blendete `.sec` aus — und die zwei grossen
   Mounts sind keine `.sec`:

     index.html:3434   <div id="dashboard-main" style="display:none">
     index.html:3439   <div id="all-objects-main" class="ao-main" …>

   Jeder Oeffner fuehrte bisher SEINE EIGENE Liste der anderen Ansichten:
   `openDashboard()` kannte `.sec`, `#s-quick` und `#all-objects-main`,
   `openPortfolioStrategie()` kannte nur `.sec`, `setMainView()` kannte
   `.sec` und `#all-objects-main`. Drei Listen fuer dieselbe Frage.

   > Eine Ansicht, die ihre Geschwister selbst aufzaehlt, vergisst das
   > naechste. Ein Register vergisst keines.

   Ab hier fuehrt die Liste EINE Stelle: jede Hauptansicht meldet hier
   ihren Schliesser an, und wer umschaltet, ruft `abraeumen(ziel)` — das
   schliesst alle anderen, ohne sie zu kennen.
   ═══════════════════════════════════════════════════════════════════════ */
window.DealPilotAnsichten = (function () {
  var reg = {};
  function melde(name, schliesser) {
    if (name && typeof schliesser === 'function') reg[name] = schliesser;
  }
  /* Ein Schliesser, der wirft, darf die anderen nicht aufhalten — sonst
     haengt beim ersten Fehler die halbe Umschaltung in der Luft. */
  function abraeumen(ziel) {
    Object.keys(reg).forEach(function (n) {
      if (n === ziel) return;
      try { reg[n](); } catch (e) {}
    });
  }
  return { melde: melde, abraeumen: abraeumen, namen: function () { return Object.keys(reg); } };
})();

/* Die beiden Ansichten aus DIESER Datei melden sich selbst an:
   `single` = Reiterleiste mit den Objektbereichen, `all` = die Tabelle.
   `single` raeumt ALLE `.sec` ab (auch die `.sec-hidden`-Standalones
   Quick-Check und Marktbericht) — genau das taten `openDashboard()` und
   `openPortfolioStrategie()` vorher schon von Hand. */
window.DealPilotAnsichten.melde('single', function () {
  var tabs = document.querySelector('.tabs'); if (tabs) tabs.style.display = 'none';
  var wf = document.querySelector('.tabs-workflow-bar'); if (wf) wf.style.display = 'none';
  document.querySelectorAll('.sec').forEach(function (s) { s.style.display = 'none'; });
});
window.DealPilotAnsichten.melde('all', function () {
  var ao = document.getElementById('all-objects-main'); if (ao) ao.style.display = 'none';
});

/**
 * V26: Hauptview-Switch zwischen Einzelobjekt und Alle-Objekte-Tabelle.
 * @param {'single' | 'all'} view
 */
function setMainView(view) {
  /* v1905: ERST alle fremden Hauptansichten abraeumen (Cockpit, Strategie,
     …). Siehe das Register darueber — diese Datei muss nicht wissen,
     welche es sind. */
  try { if (window.DealPilotAnsichten) window.DealPilotAnsichten.abraeumen(view); } catch (e) {}
  var tabs = document.querySelector('.tabs');
  var wfBar = document.querySelector('.tabs-workflow-bar');
  var aoMain = document.getElementById('all-objects-main');
  var btnSingle = document.getElementById('vw-single');
  var btnAll = document.getElementById('vw-all');
  var sections = document.querySelectorAll('.sec:not(.sec-hidden)');

  // V40: Sidebar-Icon-Nav highlight
  var sbSingle = document.querySelector('.sb-iconnav-btn[data-iconnav="single"]');
  var sbAll = document.querySelector('.sb-iconnav-btn[data-iconnav="all"]');

  if (view === 'all') {
    if (tabs) tabs.style.display = 'none';
    if (wfBar) wfBar.style.display = 'none';   // V63.48: WF-Bar in All-View ausblenden
    sections.forEach(function(s) { s.style.display = 'none'; });
    if (aoMain) aoMain.style.display = 'block';
    if (btnSingle) btnSingle.classList.remove('active');
    if (btnAll) btnAll.classList.add('active');
    if (sbSingle) sbSingle.classList.remove('sb-iconnav-active');
    if (sbAll) sbAll.classList.add('sb-iconnav-active');
    if (typeof showAllObjectsView === 'function') showAllObjectsView();
  } else {
    if (tabs) tabs.style.display = '';
    /* v564-no-wfbar: alte Workflow-Bar bleibt versteckt (nicht mehr verwendet) */
    sections.forEach(function(s) { s.style.display = ''; });
    if (aoMain) aoMain.style.display = 'none';
    if (btnSingle) btnSingle.classList.add('active');
    if (btnAll) btnAll.classList.remove('active');
    if (sbSingle) sbSingle.classList.add('sb-iconnav-active');
    if (sbAll) sbAll.classList.remove('sb-iconnav-active');
    // Active-Tab wieder anzeigen (falls keiner active, dann erster)
    var activeTab = document.querySelector('.sec.active:not(.sec-hidden)');
    if (!activeTab) {
      var firstSec = document.querySelector('.sec:not(.sec-hidden)');
      if (firstSec) firstSec.classList.add('active');
      var firstTab = document.querySelector('.tab');
      if (firstTab) firstTab.classList.add('active');
    }
  }
  // V63.48: Sticky-Position neu berechnen nach View-Wechsel
  if (typeof window._updateWfTop === 'function') {
    setTimeout(window._updateWfTop, 50);
    setTimeout(window._updateWfTop, 250);
  }
}
window.setMainView = setMainView;

// ═══════════════════════════════════════════════════════════════
// V63.76: QUICK-CHECK STANDALONE-MODE
// Quick-Check ist kein Tab mehr (raus aus der Tab-Bar). Stattdessen
// öffnet die Sidebar-Action "Quick Check" eine Standalone-View, die
// Tab-Bar + Workflow-Bar verbirgt. Nach "Als Objekt speichern" oder
// "In Vollberechnung übernehmen" wird der Modus verlassen und der User
// landet im normalen Tab-Layout (Tab Objekt = Index 0).
// ═══════════════════════════════════════════════════════════════
function enterQuickCheckMode() {
  // v479 (v472-qcdash): Falls das Portfolio-Cockpit (Vollbild) offen ist, erst
  // schliessen. Sonst ueberlagert die Body-Klasse dp-dash-fullscreen den
  // Quick-Check und der Wechsel "Cockpit -> Aktion Quick Check" macht nichts.
  if (document.body.classList.contains('dp-dash-fullscreen') && window.DealPilotDashboard && typeof window.DealPilotDashboard.close === 'function') {
    try { window.DealPilotDashboard.close(); } catch (e) {}
  }
  /* v2189: dasselbe für die Marktbericht-Ansicht. Marcel, 13.10.2026: „der
     Absprung vom Prozess in den Quick-Check ging nicht, wenn vorher der
     Marktbericht offen war." Der Marktbericht schließt beim Öffnen den
     Quick-Check (marktbericht-view.js), umgekehrt fehlte es: die Klasse
     mb-standalone-active blieb, der Quick-Check lag darunter. Leise
     geschlossen — closeMarktberichtView() schaltet zusätzlich einen Reiter
     an, und genau den will der Quick-Check nicht. */
  if (document.body.classList.contains('mb-standalone-active')) {
    var _mbv = document.getElementById('s-marktbericht');
    if (_mbv) { _mbv.classList.remove('active'); _mbv.innerHTML = ''; }
    document.body.classList.remove('mb-standalone-active');
  }
  // Body-Klasse setzt CSS, das Tab-Bar + Workflow-Bar versteckt
  document.body.classList.add('qc-standalone-active');

  // Alle normalen Tabs deaktivieren (ihre .active-Klasse entfernen)
  document.querySelectorAll('.sec:not(.sec-hidden)').forEach(function(s) {
    s.classList.remove('active');
  });
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });

  // Standalone-View einblenden
  var qc = document.getElementById('s-quick');
  if (qc) {
    qc.classList.add('active');         // active für display
    qc.style.display = 'block';
  }

  // V199: Echten Header-Score minimieren via body.hdr-collapsed.
  // Das ist der "Investor Deal Score im Header" den Marcel meint:
  // hdr-v61-row2 + hdr-badges (Donut + 5 KPI-Pills).
  // V197 hat fälschlich nur die Cards in #s6 (Tab Kennzahlen) versteckt —
  // das sind aber andere Elemente, nicht der Header.
  try {
    if (!document.body.classList.contains('hdr-collapsed')) {
      document.body.classList.add('hdr-collapsed');
      document.body.dataset.qcHdrAuto = '1';   // Marker: wir haben's selbst gesetzt
    } else {
      // War vorher schon collapsed → kein Marker, beim Verlassen nichts tun
      document.body.dataset.qcHdrAuto = '0';
    }
    if (typeof window._updateHdrHeight === 'function') window._updateHdrHeight();
  } catch(e) { console.warn('[V199 hdr-collapse]', e); }

  // V197: BEIDE DealScore-Cards in #s6 (Tab Kennzahlen) verstecken — die sind im Tab,
  // nicht im Header, aber falls Tab Kennzahlen im Hintergrund sichtbar ist.
  try {
    var dsTargets = [
      document.getElementById('dealscore-card'),
      document.getElementById('dealscore2-card'),
      document.querySelector('.dealscore-card'),
      document.querySelector('.ds2-card')
    ].filter(function(el, i, arr) {
      return el && arr.indexOf(el) === i;
    });
    dsTargets.forEach(function(dsHeader) {
      if (!dsHeader.dataset.qcMinimized) {
        dsHeader.dataset.qcOrigDisplay = dsHeader.style.display || '';
        dsHeader.style.display = 'none';
        dsHeader.dataset.qcMinimized = '1';
      }
    });
  } catch(e) { console.warn('[V197 ds-hide]', e); }

  // Quick-Check-Inhalt rendern
  if (typeof showQuickCheck === 'function') {
    setTimeout(showQuickCheck, 30);
  }

  // V196: Eingaben leeren + scrollTop = 0
  setTimeout(function() {
    try {
      // Reset alle QC-Inputs (Felder beginnen mit "qc-")
      var qcRoot = document.getElementById('qc-tab-host') || qc;
      if (qcRoot) {
        qcRoot.querySelectorAll('input, select, textarea').forEach(function(el) {
          // V199: User-Set + AI-Set Marker entfernen (sonst werden ältere AI-Werte respektiert)
          if (el.dataset) {
            delete el.dataset.userSet;
            delete el.dataset.aiSet;
            delete el.dataset.userTouched;
          }
          if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = !!el.defaultChecked;
          } else if (el.tagName === 'SELECT') {
            el.selectedIndex = 0;
          } else {
            // V199: HTML-Default (value-Attribut) RESPEKTIEREN — bei Tilgung 1,5%
            // und Zins 3,8% sind das sinnvolle Startwerte
            var htmlDefault = el.getAttribute('value');
            el.value = htmlDefault || '';
          }
          try {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } catch(e) {}
        });
        // V199: AI-Source-Annotations entfernen (alte KI-Quellen-Hinweise löschen)
        qcRoot.querySelectorAll('.qc-ai-src').forEach(function(el) { el.remove(); });
        // V199: KI-Info-Box (qcAiResearchInfo-Ergebnis) zurück auf hidden
        var aiBox = qcRoot.querySelector('#qc-ai-info-box');
        if (aiBox) aiBox.style.display = 'none';
        // V202: LTV 100%-Button als Default-aktiv setzen (statt 95%)
        qcRoot.querySelectorAll('.qc-ltv-btn').forEach(function(b) {
          b.classList.toggle('active', b.getAttribute('data-ltv') === '100');
        });
        // qcCalc einmal manuell triggern für sauberen Recompute
        if (typeof window.qcCalc === 'function') {
          try { window.qcCalc(); } catch(e) {}
        }
        /* v404-qcupdate-removed: qcUpdate() lebte nur in quick-check-tab.js (entfernt). QC rechnet im iframe (QcApp). */
      }
    } catch(e) { console.warn('[V199 qc-reset]', e); }
    // Harter Scroll nach oben
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (qc) {
      qc.scrollTop = 0;
      var inner = qc.querySelector('.qc-container, .qc-main, .qc-content');
      if (inner) inner.scrollTop = 0;
    }
  }, 60);
}

function exitQuickCheckMode() {
  document.body.classList.remove('qc-standalone-active');

  var qc = document.getElementById('s-quick');
  if (qc) {
    qc.classList.remove('active');
    qc.style.display = '';   // zurück auf CSS-default
  }

  // V199: Header-Collapse wiederherstellen (nur wenn V199 es selbst gesetzt hatte)
  try {
    if (document.body.dataset.qcHdrAuto === '1') {
      document.body.classList.remove('hdr-collapsed');
      delete document.body.dataset.qcHdrAuto;
      if (typeof window._updateHdrHeight === 'function') window._updateHdrHeight();
    }
  } catch(e) {}

  // V197: Beide DealScore-Cards in #s6 wieder einblenden
  try {
    var dsRestoreTargets = [
      document.getElementById('dealscore-card'),
      document.getElementById('dealscore2-card'),
      document.querySelector('.dealscore-card'),
      document.querySelector('.ds2-card')
    ].filter(function(el, i, arr) { return el && arr.indexOf(el) === i; });
    dsRestoreTargets.forEach(function(dsHeader) {
      if (dsHeader.dataset.qcMinimized === '1') {
        dsHeader.style.display = dsHeader.dataset.qcOrigDisplay || '';
        delete dsHeader.dataset.qcMinimized;
        delete dsHeader.dataset.qcOrigDisplay;
      }
    });
  } catch(e) {}

  // Workflow-Bar-Positionierung neu rechnen
  if (typeof window._updateWfTop === 'function') {
    setTimeout(window._updateWfTop, 50);
  }
}

window.enterQuickCheckMode = enterQuickCheckMode;
window.exitQuickCheckMode  = exitQuickCheckMode;

/* v725-photo-resize: Canvas-Resize beim Upload. Bei jedem Fehler -> Original behalten. */
window._dpResizeDataUrl = function(dataUrl, maxEdge, quality) {
  return new Promise(function(resolve) {
    try {
      if (!dataUrl || typeof dataUrl !== "string" || dataUrl.indexOf("data:image") !== 0) { return resolve(dataUrl); }
      var img = new Image();
      img.onload = function() {
        try {
          var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          if (!w || !h) return resolve(dataUrl);
          var scale = (w <= maxEdge && h <= maxEdge) ? 1 : (maxEdge / Math.max(w, h));
          var nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale));
          var c = document.createElement("canvas"); c.width = nw; c.height = nh;
          var ctx = c.getContext("2d");
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, nw, nh);
          ctx.drawImage(img, 0, 0, nw, nh);
          var out = c.toDataURL("image/jpeg", quality || 0.82);
          resolve(out && out.length < dataUrl.length ? out : dataUrl);
        } catch (e) { resolve(dataUrl); }
      };
      img.onerror = function() { resolve(dataUrl); };
      img.src = dataUrl;
    } catch (e) { resolve(dataUrl); }
  });
};
// ── IMAGES ────────────────────────────────────────────
var imgs = [];
function handleImgs(files) {
  Array.from(files).forEach(function(f) {
    if (imgs.length >= 6) return;
    var r = new FileReader();
    r.onload = function(e) {
      var _raw = e.target.result;
      window._dpResizeDataUrl(_raw, 1600, 0.82).then(function(small) {
        imgs.push({ src: small || _raw, name: f.name }); renderImgs();
      });
    }; /* v725-photo-resize */
    r.readAsDataURL(f);
  });
  var inp = document.getElementById('img-inp');
  if (inp) inp.value = '';
}
// V54: globale Setter/Getter — damit Quick-Check + PDF-Import die Foto-Liste
// austauschen können. Im strict-Mode geht "window.imgs = X" nicht (bleibt undefined),
// deshalb diese expliziten Funktionen.
function dpSetImgs(arr) {
  imgs = Array.isArray(arr) ? arr.slice(0, 6) : [];
  renderImgs();
}
function dpGetImgs() { return imgs.slice(); }
window.dpSetImgs = dpSetImgs;
window.dpGetImgs = dpGetImgs;
function renderImgs() {
  var grid = document.getElementById('img-grid');
  if (!grid) return;
  grid.innerHTML = imgs.map(function(img, i) {
    var isTitle = (i === 0);
    var lblHtml = isTitle
      ? '<div class="img-lbl img-lbl-title">★ Titelbild · in Liste &amp; PDF</div>'
      : '<div class="img-lbl"><button class="img-set-title" onclick="setTitleImg(' + i + ')" title="Als Titelbild verwenden">☆ Als Titelbild</button></div>';
    return '<div class="img-thumb' + (isTitle ? ' img-thumb-title' : '') + '">' +
      '<img src="' + img.src + '" alt="Foto ' + (i+1) + '">' +
      '<button class="img-del" onclick="delImg(' + i + ')" title="Foto entfernen">×</button>' +
      lblHtml +
    '</div>';
  }).join('');
}
function delImg(i) { imgs.splice(i, 1); renderImgs(); }

// V31: Titelbild auswählen — verschiebt das Foto an Position 0.
// imgs[0] ist überall die Quelle für Titelbild (Sidebar-Card-Thumbnail + PDF-Cover).
function setTitleImg(i) {
  if (i <= 0 || i >= imgs.length) return;
  var moved = imgs.splice(i, 1)[0];
  imgs.unshift(moved);
  renderImgs();
  // Wenn der User Titel ändert, ist das Objekt "dirty" — wir signalisieren das mit einem dezenten Toast
  if (typeof toast === 'function') toast('★ Titelbild gesetzt — beim nächsten Speichern auch in der Sidebar sichtbar');
}
window.setTitleImg = setTitleImg;

// ── PDF MODAL ─────────────────────────────────────────
function showPdfModal(show) { var o = document.getElementById('pdf-overlay'); if (o) o.classList.toggle('show', show); }
function setPdfProgress(pct) { var f = document.getElementById('pdf-progress-fill'); if (f) f.style.width = pct + '%'; }

/* ═══════════════════════════════════════════════════
   KI-ANALYSE – OpenAI / ChatGPT
═══════════════════════════════════════════════════ */

// Sektion-Farben für die HTML-Anzeige
var AI_COLORS = {
  INVESTITIONSBEWERTUNG:    '#4a90d9',
  'STÄRKEN':                '#2A9A5A',
  STAERKEN:                 '#2A9A5A',
  RISIKEN:                  '#C94C4C',
  VERHANDLUNGSEMPFEHLUNG:   'var(--wl-c9a84c, #C9A84C)',
  'KAUFPREIS-OFFERTE':      '#7A5AB5',
  'KAUFPREIS_OFFERTE':      '#7A5AB5',
  BANKARGUMENTE:            '#2A9A5A',
  FAZIT:                    'var(--wl-c9a84c, #C9A84C)'
};

function saveKey() {
  var inp = document.getElementById('api-key');
  var k = inp ? inp.value.trim() : '';
  if (!k) { toast('⚠ Bitte API-Key eingeben'); return; }
  localStorage.setItem('ji_ak_oai', k);
  st('key-status', '✓ KI API-Key gespeichert (nur lokal in diesem Browser)');
  toast('✓ API-Key gespeichert');
}

/* ═══════════════════════════════════════════════════════════════════════
   v1360 · DER ANALYSE-PROMPT IST AUS DEM BROWSER VERSCHWUNDEN
   ═══════════════════════════════════════════════════════════════════════
   Hier standen 78 Zeilen Prompt: Rollendefinition, die verbindliche
   „DEALPILOT-BEWERTUNGSSKALA" mit vorgeschriebenem Wortlaut je LTV- und
   DSCR-Band, die Anti-Halluzinations-Regeln und die Sieben-Block-
   Ausgabestruktur samt Laengenvorgaben.

   Das ist Prompt-Engineering, das aus echten Fehlausgaben entstanden ist,
   und es lag im Klartext bei jedem Nutzer. Punkt B1 der Bestandsaufnahme
   nennt es als zweitteuerste Auslesestelle der ganzen Anwendung: ein
   Wettbewerber spart sich damit die Iterationsschleife UND bekommt
   denselben Ton - das, was Kunden als „die KI von DealPilot" wahrnehmen.

   DIE VERLAGERUNG WAR SCHON PASSIERT, NUR DAS AUFRAEUMEN FEHLTE.
   `backend/src/services/openaiService.js` baut denselben Prompt seit
   Langem serverseitig, ab Zeile 34, mit derselben Bewertungsskala (dort
   ab Zeile 86) und sogar ausfuehrlicheren Regeln. Gemessen an der
   laufenden Maschine:

     GET /api/v1/ai/status  ->  { available: true, accepts_user_key: true }

   `available` ist im Backend HART auf true gesetzt (ai.js:197) - das
   Backend nimmt Nutzerschluessel entgegen, auch ohne eigenen. Damit war
   `serverMode` immer wahr und dieser Prompt seit V26 unerreichbar. Er
   wurde nicht mehr ausgefuehrt, nur noch ausgeliefert.
   ═══════════════════════════════════════════════════════════════════════ */

// Antwort in farbige HTML-Sektionen umwandeln

function renderAIResponse(text) {
  var secs = ['INVESTITIONSBEWERTUNG', 'STÄRKEN', 'RISIKEN', 'VERHANDLUNGSEMPFEHLUNG', 'KAUFPREIS-OFFERTE', 'BANKARGUMENTE', 'FAZIT'];
  var html = '';
  secs.forEach(function(sec, i) {
    // Erlaube STÄRKEN oder STAERKEN
    var pattern = sec.replace('Ä', '(?:Ä|AE)');
    var nx = secs[i + 1];
    var rx = nx
      ? new RegExp(pattern + ':\\s*([\\s\\S]*?)(?=(?:' + secs.slice(i+1).map(function(s){return s.replace('Ä','(?:Ä|AE)');}).join('|') + '):)', 'i')
      : new RegExp(pattern + ':\\s*([\\s\\S]*)$', 'i');
    var m = text.match(rx);
    if (!m) return;
    var body = m[1].trim().replace(/\n/g, '<br>');
    var col = AI_COLORS[sec] || 'var(--wl-c9a84c, #C9A84C)';
    html += '<div class="ai-section">' +
      '<div class="ai-section-label" style="color:' + col + '">' + sec + '</div>' +
      '<div class="ai-body">' + body + '</div>' +
    '</div>';
  });
  return html || '<div class="ai-body">' + text.replace(/\n/g, '<br>') + '</div>';
}

async function runAI() {
  /* v950-guard
   * ────────────────────────────────────────────────────────────────────────
   * GEMESSEN: ein Klick auf #ai-btn loeste DREI /ai/analyze aus.
   *   getEventListeners('#ai-btn') -> { click: Array(2) }
   *     index.html:2410  onclick="runAI()"
   *     main.js:184      aiBtn.addEventListener('click', runAI)   <- v950 entfernt
   *   + auth-401-handler.js:182 wiederholt nach Re-Login    <- v950 nimmt aus
   * 2 Handler + 1 Retry = 3 Liter statt 1.
   *
   * Der Riegel sitzt HIER und nicht am Knopf: `btn.disabled = true` kommt zu
   * spaet — beide Handler haengen am SELBEN Click-Event und laufen nacheinander,
   * bevor disabled greift. Ein Flag beim Eintritt sieht der zweite sofort.
   *
   * Er bleibt auch dann drin, wenn main.js:184 weg ist: er deckt jeden Weg ab,
   * auch den, den jemand in vier Wochen dazubaut. Ein Riegel gegen eine bekannte
   * Ursache ist eine Kruecke — ein Riegel gegen die ganze Klasse ist eine Regel.
   */
  if (window._aiRunning) {
    try { console.warn('[v950] Pilot-Analyse läuft bereits — zweiter Aufruf verworfen (hätte 1 L gekostet).'); } catch (e) {}
    return;
  }
  window._aiRunning = true;
  try {
    return await _runAIGuarded();
  } finally {
    window._aiRunning = false;
  }
}

async function _runAIGuarded() {
  if (typeof Paywall !== 'undefined' && !Paywall.gate('ai_calls')) return;

  if (!State.kpis || !State.kpis.kp) { toast('⚠ Bitte zuerst Kaufpreis eingeben'); return; }

  var btn = document.getElementById('ai-btn');
  btn.disabled = true;

  // V22: Erst checken, ob Backend server-seitige KI mit Web-Search anbietet.
  // Falls ja → über /api/v1/ai/analyze (Lage-Recherche, Key bleibt am Server).
  // Falls nein → Client-Fallback (alter Pfad mit User-API-Key aus Settings).
  var serverMode = false;
  try {
    if (typeof Auth !== 'undefined' && Auth.isApiMode && Auth.isApiMode()) {
      var st = await Auth.apiCall('/ai/status', { method: 'GET' });
      serverMode = !!(st && st.available);
    }
  } catch (e) { /* server status unbekannt → fallback */ }

  if (serverMode) {
    return _runAIServer(btn);
  }
  return _runAIClient(btn);
}

/**
 * V26: Baut den Payload für /ai/analyze inkl. optionalem User-Key
 * aus den Settings. Server-Key hat Priorität (ist auf dem Backend gesetzt),
 * der User-Key wird nur als Fallback genutzt — wird vom Backend nie geloggt.
 */
function _buildAIPayload() {
  /* v2011 - ein leeres Textfeld ist NICHT erfasst, nicht "". Das
     Modell soll "nicht erfasst" von "leer eingetragen" trennen. */
  var txt = function (id) { var v = g(id); return (v == null || String(v).trim() === '') ? null : String(v).trim(); };
  var k = State.kpis || {};
  var dealscoreSnap = null;
  if (typeof DealScore !== 'undefined' && typeof DealScore.snapshot === 'function') {
    try { dealscoreSnap = DealScore.snapshot(); } catch (e) { /* optional */ }
  }
  var payload = {
    objekt: {
      plz: g('plz'), ort: g('ort'), str: g('str'), hnr: g('hnr'),
      objart: g('objart'), wfl: parseDe(g('wfl')) || null, baujahr: g('baujahr'),
      makrolage: g('makrolage'), mikrolage: g('mikrolage'),
      /* v2157 · Die vier Lage-Felder des Objekts fuhren nie mit — nur
         Makro- und Mikrolage. Marcel: „Wertsteigerungspotenzial,
         Nachfrageindikatoren, Bevoelkerungsentwicklung,
         Entwicklungsmoeglichkeiten ... auch gegenueberstellen." */
      lageklasse: txt('lageklasse'),
      bevoelkerung: txt('ds2_bevoelkerung'), nachfrage: txt('ds2_nachfrage'),
      wertsteigerung: txt('ds2_wertsteigerung'), entwicklung: txt('ds2_entwicklung'),
      thesis: g('thesis'), risiken: g('risiken'), notizen: g('notizen'),
      /* v3016 · die ausgewerteten Unterlagen (WEG, Grundbuch, Teilung, Energieausweis) */
      dok_unterlagen: (window.DpUnterlagen && window.DpUnterlagen.promptTeile().dok_unterlagen) || null,
      dok_risiken: (window.DpUnterlagen && window.DpUnterlagen.promptTeile().dok_risiken) || null,
      dok_weg: (window.DpUnterlagen && window.DpUnterlagen.promptTeile().dok_weg) || null,
      /* ── v1700 · DIE EINHEITEN EINES MEHRFAMILIENHAUSES ─────────────
         Marcel: „bei Mehrfamilienhaeusern gebe ich die Gesamtquadrat-
         meterzahl an, und er sagt, die Wohnungsgroesse sei mit 390 m²
         zu gross — obwohl sich die auf acht Wohnungen verteilt."

         Gesendet wurden `objart` und `wfl`, sonst nichts zur Struktur.
         Die KI sah „390 m²" und las EINE Wohnung daraus; gegen einen
         Mietspiegel, der fuer Wohnungen gilt, ist das ein grober
         Fehler.

         Der MFH-Konfigurator (`mfh-einheiten.js`) fuehrt die Einheiten
         laengst, samt Flaeche und Miete, und `storage.js:182` speichert
         sie als `_mfh`. **Sie sind nur nie mitgefahren.**

         > Eine Gesamtflaeche ohne die Zahl der Einheiten ist keine
         > Wohnungsgroesse. Wer sie als solche liest, rechnet falsch —
         > und merkt es nicht. */
      einheiten: (function () {
        try {
          var m = window._dpMfh;
          if (!m || !Array.isArray(m.einheiten) || !m.einheiten.length) return null;
          var liste = m.einheiten.filter(function (e) { return e; });
          /* ── v1700d · DEUTSCHES KOMMA ──────────────────────────────
             Der Konfigurator speichert die Flaeche so, wie sie getippt
             wurde: „97,5". `Number('97,5')` ist NaN — die Flaechen
             waren deshalb alle `null`, waehrend die Mieten ankamen
             („799" hat keine Nachkommastelle und geht durch).

             Gemessen am eigenen Payload, nachdem die vier Einheiten der
             Westerfeldstr. eingetragen waren: `wfl: null`,
             `flaeche_schnitt: null`, `miete: 799`. Ein halb gefuellter
             Datensatz ist schlimmer als ein leerer — er sieht
             vollstaendig aus.

             > Wer eine getippte Zahl weiterreicht, muss sie umrechnen.
             > Das Komma ist kein Schoenheitsfehler, es ist ein anderer
             > Zahlentyp. */
          var zahl = function (v) {
            if (v == null || v === '') return NaN;
            return Number(String(v).replace(/\./g, '').replace(',', '.'));
          };
          var fl = liste.map(function (e) { return zahl(e.wfl); })
                        .filter(function (n) { return isFinite(n) && n > 0; });
          var summe = fl.reduce(function (a, b) { return a + b; }, 0);
          return {
            anzahl: liste.length,
            flaeche_summe: fl.length ? Math.round(summe) : null,
            flaeche_schnitt: fl.length ? Math.round(summe / fl.length) : null,
            /* v1700c: Die Miete heisst `ist`, nicht `miete` oder `nkm`.
               Gemessen an `mfh-einheiten.js` — dort entsteht jede
               Einheit als `{ nr, art, status, wfl, ist, lage }`. Mein
               erster Anlauf las zwei Namen, die es nicht gibt; die
               Mieten waeren stillschweigend leer geblieben.

               `art` und `status` fahren mit, weil sie die Zahlen
               erklaeren: eine leerstehende Gewerbeeinheit ist etwas
               anderes als eine vermietete Wohnung, und ohne diese
               Angabe sieht beides gleich aus. */
            je_einheit: liste.slice(0, 20).map(function (e) {
              return {
                nr: e.nr || null,
                wfl: zahl(e.wfl) || null,
                miete: zahl(e.ist) || null,
                art: e.art || null,           /* wohnen | gewerbe */
                status: e.status || null,     /* vermietet | leer  */
                lage: e.lage || null,
                /* v2022 - was eine BEURTEILUNG traegt. Nicht alle 28
                   Felder der Wohnung: 28 x 20 waeren 560 Werte in einem
                   Prompt, der ohnehin 23.000 Zeichen hat. Kaution,
                   Mietername, Keller und Notiz bleiben draussen - der
                   Mietername hat im Prompt ohnehin nichts verloren. */
                etage: e.etage || null,
                zimmer: zahl(e.zimmer) || null,
                vertragsart: e.mv_art || null,
                letzte_erhoehung: e.mv_letzte_erhoehung || null,
                letzte_erhoehung_betrag: zahl(e.mv_letzte_erhoehung_betrag) || null,   /* v2545 */
                naechste_anpassung: e.mv_naechste_anpassung || null,
                befristet_bis: e.mv_befristet_bis || null,
                /* v2023a - `rnd_eigen`/`rnd_jahre` sind hier entfallen.
                   Das FELD ist in v2023 weggefallen (die RND kommt aus
                   Zustand je Einheit); der Sender blieb stehen und haette
                   nur noch Altdaten geliefert - die im Prompt aussehen wie
                   gepflegte. Ein Feld entfernen heisst nicht, es
                   loszuwerden. */
                zustand: e.zustand || null,
                /* ══ v2156 · SIEBEN FELDER, DIE EINE BEURTEILUNG TRAGEN ══

                   Marcel am 12.10.2026: „ob generell alle Daten, also auch
                   aus den Mehrfamilienhaeusern, aus dem Konfigurator …
                   dass auch wirklich alles damit einfliesst."

                   GEMESSEN: von 36 Feldern je Einheit reisten 13 mit. Der
                   Prompt druckte alle 13 — die Luecke lag HIER, im Sender.

                   Die Auswahl von v2022 war richtig („nicht alle 28
                   Felder"), aber sie hat die MIETE verloren: Soll-Miete,
                   Staffel/Index und Kuendigungsverzicht sind genau das,
                   woraus Mietsteigerungspotenzial entsteht. Eine Analyse,
                   die eine Staffelmiete nicht kennt, nennt als Chance,
                   was schon vertraglich vereinbart ist.

                   Draussen bleiben weiter: Kaution, Mietername (hat im
                   Prompt nichts verloren), Notiz, Bilder. Und `keller`,
                   `balkon_qm`, `stellplatz` — die tragen kein Urteil,
                   das die Objektebene nicht schon hat. */
                soll_miete: zahl(e.soll) || null,
                mietvertrag_seit: e.mv_beginn || null,
                kuendigungsverzicht_bis: e.mv_kuendigungsverzicht_bis || null,
                erhoehung_art: e.mv_erhoehung_art || null,
                erhoehung_wert: zahl(e.mv_erhoehung_wert) || null,
                erhoehung_rhythmus_jahre: zahl(e.mv_rhythmus_jahre) || null,
                /* Offene Staffelstufen: wie viele Erhoehungen noch
                   kommen, ohne dass neu verhandelt werden muss. */
                stufen_offen: zahl(e.mv_stufen_offen) || null,
                /* Was an DIESER Wohnung gemacht werden muss, und was es
                   kostet. Stand bisher nur dann im Prompt, wenn jemand
                   den Haken fuer die Steuer-Summe gesetzt hatte. */
                massnahme: e.massnahme || null,
                massnahme_kosten: zahl(e.kosten) || null
              };
            }),
            /* Die Gebaeude-Angaben des Konfigurators: Marcel wollte
               „Modernisierung und Stand erfassen". Sie liegen dort
               bereits nach Anlage 2 ImmoWertV. */
            aufgeteilt: m.aufgeteilt != null ? !!m.aufgeteilt : null,
            gnd: Number(m.gnd) || null,
            stand: m.stand || null,
            /* ══ v2156 · ROHCODES UEBERSETZEN, BEVOR SIE RAUSGEHEN ══════
               Hier stand `m.gebaeude` roh. Die Stufen sind `0`, `h`, `v`
               (mfh-einheiten.js:38), und so kamen sie im Prompt an:

                 dach=v, heizung=h, fenster=0

               GEMESSEN am 12.10.2026: der Prompt druckt sie unveraendert
               (openaiService.js:433-441). Das Modell liest „v" und muss
               raten, ob das „vor kurzem" oder „vollstaendig" heisst — und
               was „h" ist, kann niemand erraten.

               > Die Uebersetzungstabelle liegt eine Datei weiter
               > (`STUFE_ZU_OBJEKT`, mfh-einheiten.js:176) und wurde
               > serverseitig nie benutzt. Ein Code ohne seine Tabelle ist
               > kein Datum, sondern ein Rätsel.

               Uebersetzt wird HIER, beim Sender: er kennt seine eigenen
               Codes. Die Tabelle im Backend nachzubauen waere eine zweite
               Kopie, die beim naechsten Stufen-Namen auseinanderlaeuft. */
            modernisierung: (function () {
              var g2 = m.gebaeude;
              if (!g2 || typeof g2 !== 'object') return g2 || null;
              var T = (window.DpMfhEinheiten && window.DpMfhEinheiten.STUFE_ZU_OBJEKT)
                || { '0': 'Keine/Nie', h: '10 - 20 Jahre', v: '< 5 Jahre' };
              var o = {}, n = 0;
              Object.keys(g2).forEach(function (k) {
                var v2 = g2[k];
                if (v2 == null || v2 === '') return;
                /* Unbekannte Stufe NICHT verschlucken: lieber der Rohwert
                   mit Hinweis als eine stille Luecke. */
                o[k] = T[String(v2)] || (String(v2) + ' (unbekannte Stufe)');
                n++;
              });
              return n ? o : null;
            })()
          };
        } catch (e) { return null; }
      })(),
      wertstg_pct: parseDe(g('wertstg')) || null,
      mietstg_pct: parseDe(g('mietstg')) || null
    },
    kennzahlen: {
      kp: k.kp, gi: k.gi, ek: k.ek, bmy: k.bmy, nmy: k.nmy,
      dscr: k.dscr, ltv: k.ltv, cf_m: k.cf_m, em: k.em, ekr: k.ekr != null ? k.ekr : null,   /* v2832: EK-Rendite eigens, em ist das Equity Multiple */
      nkm_j: k.nkm_j != null ? k.nkm_j : null, /* v947-mbsource: Nettokaltmiete/Jahr */
      bwk: k.bwk != null ? k.bwk : null
    },
    finanzierung: {
      d1z_pct: k.d1z_pct, d1t_pct: k.d1t_pct, d1: k.d1,
      /* v2009 - Zinsbindung und Anschlusskondition. Aufgabe 13 des
         Prompts verlangt eine Anschlussfinanzierungs-Analyse; bis
         hierher reiste nur die Restschuld mit, ohne das Jahr dazu.
         Gelesen wird aus dem Formular, weil State.kpis diese drei
         nicht fuehrt. */
      d1_bindj: parseDe(g('d1_bindj')), anschl_z: parseDe(g('anschl_z')),
      anschl_t: parseDe(g('anschl_t')), anschl_bj: parseDe(g('anschl_bj')),
      restschuld_ezb: (typeof State !== 'undefined' && State.rs1 != null) ? State.rs1 : ((typeof State !== 'undefined' && State.rs != null) ? State.rs : (parseDe(g('restschuld')) || null))
    },
    /* ══ v2011 · SIEBEN BLOECKE, DIE DIE KI NIE GESEHEN HAT ═══════

       Alle 46 Felder stehen im Feldkatalog (256 Feld-Ids) - sie
       reisten nur nie mit. Der Prompt stellt Aufgaben, fuer die er
       die Daten nicht hatte: Aufgabe 8 verlangt eine Aussage zur
       Steuererstattung ohne Grenzsteuersatz, der Marktkontext-Block
       bietet den Energie-Abschlag an "wenn die Energieklasse bekannt
       ist" - sie war nie bekannt. Eine Aufgabe ohne Datengrundlage
       wird nicht unbeantwortet gelassen, sie wird GERATEN.

       `null` statt `0`: ein nicht erfasstes Feld darf nicht wie eine
       gemessene Null aussehen (CLAUDE.md: Number(null) ist 0 und
       besteht Number.isFinite). `txt()` gibt leere Felder als null. */
    /* ═══ v2067a · SANIERUNG, § 7b UND ERBPACHT REISTEN NICHT MIT ═══════
       Marcel, 10.10.2026: „Was ist mit den daten aus dem tab Steuer?
       werden diese uebergeben?"

       GEMESSEN: die Grundlagen ja - zve, Grenzsteuersatz, AfA-Satz,
       Restnutzungsdauer und der BMF-Gebaeudeanteil standen hier. Sechs
       Felder aus demselben Reiter nicht:

         san              Sanierungskosten
         san_ust          brutto oder netto
         san_tax_years    Verteilung (§ 82b EStDV: 2 bis 5 Jahre)
         san_tax_active   ob sie steuerlich angesetzt werden
         afa_sonder7b_aktiv   die Sonder-AfA nach § 7b
         erbpacht / erbbauzins

       Das sind keine Nebensaechlichkeiten: eine Sanierung ueber fuenf
       Jahre verteilt aendert den Cashflow nach Steuer in jedem einzelnen
       davon, und ein Erbbaurecht aendert, was man ueberhaupt kauft. Ein
       Pilot, der beides nicht kennt, beurteilt ein anderes Objekt.

       Die RECHNUNG bleibt unberuehrt - hier wird nur gelesen. */
    steuer: (function () {
      var an = function (id) { var e = document.getElementById(id); return !!(e && e.checked); };
      var s = {
        zve: parseDe(g('zve')), grenzsteuersatz_pct: parseDe(g('grenz')),
        afa_satz_pct: parseDe(g('afa_satz')), afa_rnd_jahre: parseDe(g('afa_rnd_jahre')),
        gebaeudeanteil_pct: parseDe(g('geb_ant')), afa_eigen_pct: parseDe(g('afa_eigen'))
      };
      var sanKosten = parseDe(g('san'));
      if (sanKosten) {
        s.sanierung = {
          kosten_eur: sanKosten,
          betrag_ist: txt('san_ust') || null,          /* brutto | netto */
          steuerlich_angesetzt: an('san_tax_active'),
          verteilung_jahre: txt('san_tax_years') || null   /* auto | 2 … 5 */
        };
      }
      if (an('afa_sonder7b_aktiv')) s.sonder_afa_7b = true;
      if (an('erbpacht')) {
        s.erbbaurecht = { ja: true, erbbauzins_eur_jahr: parseDe(g('erbbauzins')) || null };
      }
      /* ══ v2166 · DER STEUERVERLAUF ═════════════════════════════════════
         Marcel am 13.10.2026: „auch bei Steuern ist die Aussage gering …
         da auch auf Werbungskosten eingehen und wann das Objekt steuerlich
         positiv wird und was das an Abgaben bedeutet."
         Das Modell bekam bisher EINE Zahl (Steuerwirkung Jahr 1). Die
         App rechnet aber jedes Jahr (State.cfRows: Miete, Zins, BWK, AfA,
         Ergebnis, Steuer) - hier geht diese Reihe mit, FERTIG gerechnet.
         Das Modell soll erklaeren, nicht nachrechnen. */
      try {
        var R = (window.State && Array.isArray(State.cfRows)) ? State.cfRows : [];
        var z = function (v) { return (typeof v === 'number' && isFinite(v)) ? Math.round(v) : null; };
        if (R.length) {
          var r1 = R[0];
          s.werbungskosten_jahr1 = {
            schuldzinsen_eur: z(r1.zy), afa_eur: z(r1.afa_y),
            bewirtschaftung_steuerlich_eur: z(r1.bwk_st_y),
            summe_eur: z((r1.zy || 0) + (r1.afa_y || 0) + (r1.bwk_st_y || 0)),
            mieteinnahmen_eur: z(r1.nkm_y)
          };
          /* v2992 · Warnung anschaffungsnahe HK (tax.js) - als Klartext an den Pilot */
          try {
            var _ahk = window._dpAhkWarnung && State.taxTimeline ? window._dpAhkWarnung(State.taxTimeline) : '';
            if (_ahk) s.ahk_warnung = _ahk.replace(/<br>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
          } catch (e) {}
          s.verlauf = R.slice(0, 15).map(function (r) {
            return { jahr: r.cal || r.y, miete_eur: z(r.nkm_y), zinsen_eur: z(r.zy), afa_eur: z(r.afa_y),
                     bwk_steuerlich_eur: z(r.bwk_st_y), ergebnis_vuv_eur: z(r.zve_y),
                     steuer_eur: z(r.tax_y), cashflow_nach_steuer_eur: z(r.cfns_y) };
          });
          /* v2992 · Wende = ab hier DAUERHAFT positiv (wie steuer-verlauf.js auswerten).
             Bis v2991 das erste Jahr mit Gewinn - Parkstr. 9 (Kauf 12/2024): 2024 mit
             einem Monat Miete und Gewinn, dann 2025 und 2028 Verlust durch Erhaltungsaufwand.
             Der Pilot schrieb daraus „im Jahr 2026 kippt die Steuerwirkung". */
          var wIdx = -1;
          for (var k = R.length - 1; k >= 0; k--) { if (typeof R[k].zve_y === 'number' && R[k].zve_y > 0) wIdx = k; else break; }
          var wende = wIdx >= 0 ? (R[wIdx].cal || R[wIdx].y) : null, erstattBis = 0, lastAb = 0;
          for (var i = 0; i < R.length; i++) {
            var t = R[i].tax_y;
            if ((wIdx < 0 || i < wIdx) && typeof t === 'number') erstattBis += t;
            else if (typeof t === 'number' && i < 15) lastAb += t;
          }
          s.wende = {
            erstes_jahr_steuerlich_positiv: wende,
            steuerwirkung_bis_dahin_eur: z(erstattBis),          /* negativ = Erstattung */
            steuerlast_danach_bis_jahr15_eur: wende ? z(lastAb) : null,
            gerechnet_ueber_jahre: R.length
          };
        }
      } catch (e) {}
      return s;
    })(),
    bewirtschaftung: {
      hausgeld_umlagefaehig: parseDe(g('hg_ul')), hausgeld_nicht_umlagefaehig: parseDe(g('hg_nul')),
      grundsteuer: parseDe(g('grundsteuer')), weg_ruecklage: parseDe(g('weg_r')),
      eigene_ruecklage: parseDe(g('eigen_r')), mietausfall_pct: parseDe(g('mietausfall'))
    },
    /* v2026 - die Mietentwicklung sagt jetzt, WORAUS sie gerechnet ist.

       Vorher ging `modus` roh raus („einheiten") und daneben die fuenf
       Progressionsfelder, die in diesem Modus gar nicht gelten. Das
       Modell haette aus `soll_eur_qm` und `schritt_pct` gerechnet,
       waehrend die Tabelle etwas anderes zeigt.

       Ein Wert, der nicht gilt, ist im Prompt schlimmer als kein Wert. */
    mietentwicklung: (function () {
      var ME = window.MietEntwicklung;
      var m = (ME && typeof ME.getMode === 'function') ? ME.getMode() : txt('me_modus');
      var aus = {
        modus: m,
        herkunft: m === 'einheiten'
          ? 'Aus den Mietverträgen der einzelnen Wohnungen'
          : (m === 'detail' ? 'Stufenplan von Hand' : 'Gleichmaessige Steigerung je Jahr'),
        mietspiegel_eur_qm: parseDe(g('mietspiegel')),
        leerstand_pct: parseDe(g('leerstand')), umlagefaehig: parseDe(g('umlagef'))
      };
      if (m === 'einheiten' && ME && typeof ME.einheitenStand === 'function') {
        var st = ME.einheitenStand();
        aus.einheiten_gesamt = st.gesamt;
        aus.einheiten_mit_plan = st.mit;
        aus.einheiten_index = st.index;   /* deren Hoehe ist eine ANNAHME */
      } else {
        /* nur hier gelten die Progressionsfelder */
        aus.soll_eur_qm = parseDe(g('me_soll'));
        aus.schritte = parseDe(g('me_anz'));
        aus.intervall_jahre = parseDe(g('me_int'));
        aus.schritt_pct = parseDe(g('me_pct'));
      }
      return aus;
    })(),
    /* v2041 - der ANKAUF-STAND und die Abweichung. Marcel: „wenn wir
       der Pilotanalyse eine Frage stellen wie: sind wir aktuell nach
       Plan? Kannst du mir einen Soll-Ist-Vergleich machen."

       Gerechnet wird hier nichts: `abweichung()` liefert die Zeilen
       fertig, aus zwei Saetzen persistierter `_kpis_*` - jede von den
       echten Kernen zu ihrer Zeit. Das Modell soll vergleichen, nicht
       nachrechnen; sonst rechnete es alte Daten mit heutigen Regeln. */
    /* v2430 · Mieterhoehung und Zielbild: Ist/Soll/Zielbild je Wohnung,
       Massnahmen, Kosten, Kappungsgrenze und - wenn gerechnet - der
       Ertragswert je Stufe aus dem Marktbericht-Dienst. null ohne Angaben
       (dann fragt der Prompt nichts dazu). */
    potenzial: (function () {
      try { return (window.DpPotenzial && DpPotenzial.pilotPayload) ? DpPotenzial.pilotPayload() : null; }
      catch (e) { return null; }
    })(),
    ankauf: (function () {
      var AK = window.DealPilotAnkauf;
      if (!AK || !AK.vorhanden()) return null;
      var st = AK.stand(), ab = null;
      try { ab = AK.abweichung(); } catch (e) {}
      return {
        stichtag: st.stichtag,
        festgeschrieben_am: st.am,
        korrekturen: (st.korrekturen || []).length,
        kennzahlen_damals: st.kurz,
        abweichung: ab ? ab.zeilen : null
      };
    })(),
    /* v2985 · Bestand: Anschlussfinanzierung und Exit, fertig gerechnet (bestand-analyse.js).
       Nur mit Ankauf-Stand - dann beantwortet der Pilot die Bestandsfragen mit diesen Zahlen. */
    bestand: (function () {
      try {
        var AK = window.DealPilotAnkauf;
        if (!AK || !AK.vorhanden() || !window.DpBestand) return null;
        var bp = window.DpBestand.payload();
        /* v2989 · Zielerreichung je Hebel (jahresstaende.js). Der Prompt-Teil in
           openaiService.js wird nachgezogen, sobald die Datei frei ist (Journal v2989). */
        try { if (bp && window.DpJahresstaende) bp.zielerreichung = window.DpJahresstaende.payload(); } catch (e2) {}
        return bp;
      } catch (e) { return null; }
    })(),
    wohnung: {
      zimmer: parseDe(g('zimmer')), baeder: parseDe(g('bad_anz')),
      etage: txt('etage'), etagen_gesamt: parseDe(g('etagen_ges')),
      garagen: parseDe(g('garagen')), stellplaetze_aussen: parseDe(g('stellpl_aussen')),
      balkon_qm: parseDe(g('balkon_flae')), grundriss: txt('grundriss')
    },
    boden: {
      bodenrichtwert_eur_qm: parseDe(g('brw')), brw_stichtag: txt('brw_stichtag'),
      grundstueck_qm: parseDe(g('gsfl')), miteigentumsanteil_pct: parseDe(g('mea')),
      bgf_qm: parseDe(g('bgf')), standardstufe: txt('standardstufe'),
      sachwertfaktor: parseDe(g('sachwertfaktor')), liegenschaftszins_pct: parseDe(g('lzs_pct')),
      nutzungsart: txt('nutzungsart')
    },
    halter: {
      name: txt('halter'), seit: txt('halter_seit'), kaufdatum: txt('kaufdat'),
      wirtschaftlicher_uebergang: txt('wirtschaftlicher_uebergang'),
      vermietungsstand: txt('vermstand')
    },
    /* ═══ v2067 · DIE ACHT BAUTEILE EINZELN, NICHT NUR IHRE SUMME ═══════
       Marcel, 10.10.2026: „sind alle rnd daten und zustandsfelder sowie
       auch alles aus dem bmf rechner mit drin? greift das auch bei der
       pilot analyse und bei dem cockpit piloten?"

       GEMESSEN: im EXPORT stehen 22 Zustandsfelder je Objekt (mod_* fuer
       acht Bauteile, ausst_*, qual_*, standardstufe). Hier reisten vier:
       Gesamtzustand, Energieklasse, ein Freitext und die PUNKTSUMME.

       Eine Summe sagt nicht, WO die Punkte fehlen. 11 von 20 kann heissen
       „Dach und Fenster neu, Leitungen von 1960" oder „alles mittelmaessig"
       - fuer die Beurteilung eines Kaufpreises sind das zwei verschiedene
       Objekte, und der Pilot konnte sie nicht unterscheiden.

       Die acht Bauteile sind dieselben wie in Anlage 2 ImmoWertV und wie
       im RND-Wizard (`_getRndPrefill`, v1856) - gelesen wird dasselbe
       Feld, nicht ein zweites daneben.

       ── DIE WERTE SIND SCHON KLARTEXT ───────────────────────────────
       Mein erster Anlauf uebersetzte "0"/"h"/"v" in Worte - die Stufen
       des MFH-Konfigurators. GEMESSEN am Objektformular tragen die
       `mod_*`-Felder aber FUENF Klartextstufen:

         "Keine/Nie" · "> 20 Jahre" · "10 - 20 Jahre" ·
         "5 - 10 Jahre" · "< 5 Jahre"

       Das ist feiner als die Dreiteilung und schon lesbar. Die
       Uebersetzungstabelle war also nicht nur ueberfluessig, sie haette
       bei jedem Wert danebengegriffen und den Rohwert durchgereicht -
       richtig aus Versehen.

       `mfh-einheiten.js` fuehrt die Kurzcodes und uebersetzt sie selbst
       (`STUFE_ZU_OBJEKT`). Zwei Schreibweisen fuer dieselbe Sache, und
       wer sie verwechselt, merkt es nicht. */
    zustand: (function () {
      var TEILE = { mod_dach: 'Dach', mod_fenster: 'Fenster', mod_leitungen: 'Leitungen',
                    mod_heizung: 'Heizung', mod_aussenwand: 'Aussenwaende',
                    mod_baeder: 'Baeder', mod_innenausbau: 'Innenausbau',
                    mod_grundriss: 'Grundriss' };
      var bauteile = {}, n = 0;
      Object.keys(TEILE).forEach(function (id) {
        var v = String(g(id) || '').trim();
        if (!v) return;
        /* Der Wert ist die letzte Modernisierung als Zeitangabe. */
        bauteile[TEILE[id]] = v;
        n++;
      });
      var z = {
        ds2_zustand: txt('ds2_zustand'), energieklasse: txt('ds2_energie'),
        modernisierung: txt('modernis'), modernisierungspunkte: parseDe(g('mod_punkte'))
      };
      /* Nur mitschicken, was wirklich ausgefuellt ist - ein leerer Block
         sieht nach Angabe aus und ist keine. */
      if (n) z.bauteile = bauteile;
      /* `standardstufe` steht schon in `boden`, `afa_rnd_jahre` in
         `steuer`. Beide hier noch einmal zu senden waere eine Doppelung,
         die beim naechsten Umbau auseinanderlaeuft - gepruefte Stelle
         schlaegt bequeme Stelle. */
      /* v2068: das Ergebnis des RND-Wizards, falls er gelaufen ist. Es
         ist etwas anderes als `steuer.afa_rnd_jahre`: dort steht, was
         der Nutzer eingetragen hat, hier was die Bauteile hergeben.
         Weichen beide ab, ist das ein Befund und keine Doppelung. */
      try {
        var _r = window._dpRnd;
        if (_r && _r.rnd_jahre) {
          z.restnutzungsdauer_berechnet = {
            jahre: _r.rnd_jahre, gesamtnutzungsdauer: _r.gnd_jahre || null,
            alter_jahre: _r.alter_jahre || null, verfahren: _r.verfahren || null,
            stand: _r.stand || null
          };
        }
      } catch (e) {}
      return z;
    })(),
    dealscore: dealscoreSnap || {},
    /* v947-mbsource: NUR die Objekt-ID. Den Marktbericht holt /ai/analyze selbst
     * aus dem mb-Backend — der Browser soll Marktdaten weder faelschen noch
     * weglassen koennen, und es muss fuer JEDEN Aufrufer gelten, nicht nur fuer
     * die zwei, die es heute gibt (ui.js:822 / ui.js:1236). */
    objId: (typeof window._currentObjKey === 'string' && window._currentObjKey) ? window._currentObjKey : null,
    /* ═══ v1311 · Die Pilot-Analyse erfährt, WOHER die Zahlen kommen ═════
       Marcels Vorgabe vom 11.09.2026: „dass all das was wir ausgearbeitet
       haben auch nach dem Speichern im Tab Pilot-Analyse zur Verfügung
       steht und der Co-Pilot dieses Wissen dann mitnimmt."

       Die Werte kamen schon an — sie stehen im Formular. Was fehlte, ist
       ihre Herkunft: ob 90 €/m² amtlich aus BORIS stammen oder geschätzt
       sind, ob die Makrolage aus einer bezahlten Marktpreisindikation
       kommt oder aus dem Bauchgefühl, ob die Bankbewertung eine Näherung
       ist.

       Für eine Analyse ist das kein Beiwerk: eine belegte Zahl trägt eine
       Empfehlung, eine geschätzte trägt einen Vorbehalt. Der Sprechlauf
       schreibt die Herkunft nach `_dp_herkunft` (storage.js FIELDS), und
       von dort geht sie mit. */
    herkunft: (function () {
      try {
        var roh = g('_dp_herkunft');
        if (!roh) return null;
        var o = JSON.parse(roh);
        return (o && typeof o === 'object' && Object.keys(o).length) ? o : null;
      } catch (e) { return null; }
    })(),
    marktbewertung: {
      marktwert: parseDe(g('svwert')) || null,
      marktmiete_qm: parseDe(g('ds2_marktmiete')) || null
    }
  };
  // User-Key aus Settings als Fallback mitschicken — Backend nutzt ihn nur
  // wenn kein Server-Key konfiguriert ist.
  // v589: Marktradar-Indikationen (PriceHubble/Sprengnetter) aus _avm_state
  try {
    var _avmRaw = g('_avm_state');
    if (_avmRaw) {
      var _avmObj = JSON.parse(_avmRaw);
      var _avmMap = (_avmObj && _avmObj.avm) ? _avmObj.avm : {};
      var _mr = [];
      Object.keys(_avmMap).forEach(function (pk) {
        var r = _avmMap[pk] || {};
        var ent = { provider: r.provider || pk };
        if (r.marktwert != null) ent.marktwert = r.marktwert;
        if (r.low != null) ent.low = r.low;
        if (r.high != null) ent.high = r.high;
        var konf = (r.konfidenz != null) ? r.konfidenz : ((r.confidence != null) ? r.confidence : ((r.confidence_label != null) ? r.confidence_label : null));
        if (konf != null) ent.konfidenz = konf;
        _mr.push(ent);
      });
      if (_mr.length) payload.marktradar = _mr;
    }
  } catch (e) { /* optional */ }
  // v671: Inseratsalter / Vermarktungsdauer fuer Verhandlung & Offerte
  try {
    var _os = g('_immometrica_online_since');
    if (_os) {
      var _od = new Date(String(_os).slice(0, 10));
      if (!isNaN(_od.getTime())) {
        var _days = Math.max(0, Math.round((Date.now() - _od.getTime()) / 86400000));
        payload.verhandlung = { inseriert_seit: String(_os).slice(0, 10), tage_online: _days };
      }
    }
  } catch (e) { /* optional */ }
  // v746-dpmb-payload: DealPilot-Marktbewertung (Lage + Wertentwicklung) fuer die Pilot-Analyse
  try {
    var _mbRaw = g('_mb_state');
    if (_mbRaw) {
      var _mbObj = JSON.parse(_mbRaw);
      var _card = (_mbObj && _mbObj.card) ? _mbObj.card : null;
      if (_card) {
        function _v746Lbl(raw) {
          if (raw == null) return null;
          var s = raw / 10;
          var w = s >= 8 ? 'sehr_gut' : s >= 6 ? 'gut' : s >= 4 ? 'durchschnittlich' : s >= 2 ? 'schwach' : 'sehr_schwach';
          return { label: w, score: Math.round(s * 10) / 10 };
        }
        var _dpmb = {};
        var _mi = _v746Lbl(_card.microRaw);
        var _ma = _v746Lbl(_card.macroRaw);
        if (_mi) _dpmb.mikrolage = _mi;
        if (_ma) _dpmb.makrolage = _ma;
        if (_card.trendRaw != null) _dpmb.wertentwicklung_pct_pa = _card.trendRaw;
        if (_card.mw && _card.mw.med != null) _dpmb.marktwert = _card.mw.med;
        /* ═══ v1323 · Der Marktkontext gehoert in die Bewertung ═══════
           Marcels Vorgabe: "wichtig waere auch dass dem Co-Pilot und der
           Analyse diese Daten zur Bewertung zur Verfuegung stehen."

           Vermietet gegen frei, die Energieklassen-Spreizung am Ort, die
           Angebotsrendite - das sind genau die Zahlen, gegen die sich ein
           Deal einordnen laesst. Sie lagen bisher im Bericht und kamen in
           der Analyse nie an. */
        if (_card.marktkontext) _dpmb.marktkontext = _card.marktkontext;
        if (_card.erbbaurecht) _dpmb.erbbaurecht = _card.erbbaurecht;
        if (Object.keys(_dpmb).length) payload.dealpilot_marktbewertung = _dpmb;
      }
    }
  } catch (e) { /* optional */ }
    // v589: KI-Stil-Einstellungen auch fuer die Pilot-Analyse mitsenden
  try {
    if (typeof Settings !== 'undefined') {
      var _s = Settings.get() || {};
            /* ══ v2140 · DAS INVESTMENTPROFIL — SIEBEN VON 23 SCHLUESSELN ══

         Aufgabe 5 des Analyseauftrags heisst „Investor-Fit - fuer wen
         ist der Deal geeignet?" und nennt drei Archetypen. Sie nannte
         keine EINGABE: die Schwellen dieses Investors lagen im
         `localStorage` und erreichten keinen Prompt.

         Noch schlimmer: `settings.js:579` bietet als Vorlage woertlich
         „Bewerte meine Kaufentscheidung anhand meines persoenlichen
         Investmentprofils (Mindest-DSCR, Max-LTV, Mindest-Cashflow)"
         an. Die Anweisung reiste mit, die Daten nicht.

         WARUM NUR SIEBEN: die uebrigen 16 sind VORBELEGUNGEN fuer
         Formularfelder (Tilgung, EK-Quote, BWK-Quoten, Grenzsteuersatz,
         Nebenkosten, Miet- und Wertsteigerung). Sie stehen im Auftrag
         schon als OBJEKTWERT - dort EINGETRAGEN statt vorbelegt.

         > Was im Objekt steht, gilt. Das Profil liefert nur, was im
         > Objekt NICHT steht: die Schwellen und die Haltung.

         Beide zu senden waere eine stille Doppelung: zwei
         Grenzsteuersaetze fuer dieselbe Groesse. */
      try {
        var _ip = (window.DealPilotInvestmentProfile
          && typeof DealPilotInvestmentProfile.get === 'function')
          ? DealPilotInvestmentProfile : null;
        if (_ip) {
          var _prof = {
            min_dscr: _ip.get('min_dscr'),
            min_cashflow_vor_st: _ip.get('min_cashflow_vor_st'),
            max_ltv: _ip.get('max_ltv'),
            strategie: _ip.get('ai_strat'),
            risikoneigung: _ip.get('ai_risk'),
            verkaeufer_druck: _ip.get('ai_verk'),
            marktlage: _ip.get('ai_markt')
          };
          /* ══ v2140b · EINE VORGABE IST KEINE ENTSCHEIDUNG ══════════

             `get()` gibt den Vorgabewert, wenn der Nutzer nichts
             gesetzt hat. Im Browser gemessen: ein Schluessel im
             Speicher, sieben Werte aus `get()`. Als "Einstellungen des
             Nutzers" waere das eine Behauptung.

             > Eine Vorgabe als persoenliche Einstellung auszugeben,
             > behauptet eine Entscheidung.

             Die Werte gelten trotzdem - danach rechnet die App auch.
             Also beides: der WERT aus `get()`, und daneben die Liste
             dessen, was der Nutzer SELBST gesetzt hat (`load()` gibt
             nur die rohen Nutzerwerte). Der Prompt kennzeichnet dann
             je Zeile, was Entscheidung und was Vorgabe ist. */
          var _roh = (typeof _ip.load === 'function') ? (_ip.load() || {}) : {};
          var _gesetzt = [];
          var _ZU_ROH = { strategie: 'ai_strat', risikoneigung: 'ai_risk',
            verkaeufer_druck: 'ai_verk', marktlage: 'ai_markt' };
          Object.keys(_prof).forEach(function (k) {
            if (_prof[k] == null || _prof[k] === '') { delete _prof[k]; return; }
            var rk = _ZU_ROH[k] || k;
            if (_roh[rk] != null && _roh[rk] !== '') _gesetzt.push(k);
          });
          if (Object.keys(_prof).length) {
            _prof._selbst_gesetzt = _gesetzt;
            payload.investor_profil = _prof;
          }
        }
      } catch (e) { /* optional - ohne Profil laeuft die Analyse weiter */ }
      payload.aiOptions = {
        detailLevel: _s.ai_detail_level || '',
        tonality: _s.ai_tonality || '',
        focusAreas: Array.isArray(_s.ai_focus_areas) ? _s.ai_focus_areas : [],
        customInstructions: (_s.ai_custom_instructions || '').toString().slice(0, 500)
      };
    }
  } catch (e) { /* optional */ }
  // v590: Investor Deal Score (DS2) fuer Score-Vergleich, falls vorhanden
  try {
    var _d2 = window._dpLastDs2;
    /* v3016p · unter 70 % der KPIs geht kein Investor Deal Score in die Analyse - sonst nennt der Text eine Zahl, die die App selbst nicht zeigt */
    var _vqA = window.dpScoreVollstaendigkeit ? window.dpScoreVollstaendigkeit() : null;
    if (_vqA && !_vqA.belastbar) { _d2 = null; payload.score_unvollstaendig = _vqA.filled + ' von ' + _vqA.total + ' KPIs (' + _vqA.percent + ' %)'; payload.dealscore = {}; }
    if (_d2 && _d2.score != null) {
      var _cat = _d2.categories || {};
      payload.investor_score = {
        total: Math.round(_d2.score),
        label: _d2.label || null,
        rendite: _cat.scoreRendite ? Math.round(_cat.scoreRendite.score) : null,
        finanzierung: _cat.scoreFinanzierung ? Math.round(_cat.scoreFinanzierung.score) : null,
        risiko: _cat.scoreRisiko ? Math.round(_cat.scoreRisiko.score) : null,
        lage: _cat.scoreLage ? Math.round(_cat.scoreLage.score) : null
      };
    }
  } catch (e) { /* optional */ }
  if (typeof Settings !== 'undefined') {
    var s = Settings.get();
    if (s && s.openai_api_key && s.openai_api_key.indexOf('sk-') === 0) {
      payload.userApiKey = s.openai_api_key.trim();
    }
  }
  return payload;
}

/**
 * V26: Mappt Backend-Fehler auf benutzerfreundliche Texte fürs UI.
 */
function _formatAIError(err) {
  var data = (err && err.data) || {};
  if (data.needs_user_key) {
    return '⚠ ' + (data.message || data.error || 'Kein KI-Key verfügbar.') +
      ' <a href="#" onclick="event.preventDefault();if(typeof openSettings===\'function\')openSettings(\'api\');">Jetzt in Einstellungen hinterlegen →</a>';
  }
  if (err && err.status === 401) {
    return '⚠ KI-Key wurde abgelehnt. Bitte in den Einstellungen prüfen.';
  }
  if (err && err.status === 429) {
    return '⚠ Pilot-Analyse-Limit erreicht oder KI-Rate-Limit. Bitte später nochmal probieren.';
  }
  return '⚠ Pilot-Analyse fehlgeschlagen: ' + ((err && (err.message || err.error)) || err);
}
/* ══ v2013 · FOTOS FUER DIE KI ═══════════════════════════════════

   Verkleinert im Browser - auf dem Geraet, das die Bilder ohnehin
   schon hat. Der Server bekommt nur das Ergebnis.

   Vier Stueck: mehr erklaert ein Objekt nicht besser, kostet aber
   je Bild. 768 px lange Kante reicht fuer "wie sieht es aus";
   fuer eine MESSUNG reicht auch das Original nicht, und genau das
   steht als Regel im Prompt.

   ZWEI DINGE GEMESSEN, BEVOR HIER ETWAS STAND:
   - Einen Verkleinerer gibt es SCHON: `window._dpResizeDataUrl`
     (ui.js:505), benutzt von storage.js beim Speichern. Ein zweiter
     waere eine Dublette - CLAUDE.md verbietet das fuer Rechenkerne,
     und fuer eine Bildumrechnung gilt dasselbe.
   - Die Fotos stehen in `imgs` (ui.js:530), nicht in einem
     `_objPhotos`. Mein erster Entwurf griff auf einen Namen zu, den
     es nicht gibt, und haette IMMER leer zurueckgegeben - ohne Fehler,
     ohne Meldung, einfach nie ein Bild. */
var KI_FOTOS_MAX = 4;
var KI_FOTO_KANTE = 768;
async function _fotosFuerKi() {
  var roh = [];
  try {
    var q = (typeof imgs !== 'undefined' && imgs) ? imgs : (window.imgs || []);
    roh = q.map(function (i) { return i && i.src; });
  } catch (e) { roh = []; }
  roh = (roh || []).filter(function (x) { return typeof x === 'string' && x.indexOf('data:image') === 0; });
  if (!roh.length || typeof window._dpResizeDataUrl !== 'function') return [];
  var aus = [];
  for (var i = 0; i < roh.length && aus.length < KI_FOTOS_MAX; i++) {
    try {
      var k = await window._dpResizeDataUrl(roh[i], KI_FOTO_KANTE, 0.72);
      if (k && typeof k === 'string' && k.indexOf('data:image') === 0) aus.push(k);
    } catch (e) { /* ein Bild weniger ist kein Grund abzubrechen */ }
  }
  return aus;
}

/* ══ v2015 · DER STEMPEL AUF DER ANALYSE ═════════════════════════

   Gemessen: sieben Objekte trugen byte-identisch dieselbe Analyse,
   und sie sprach von einem achten. Der Bot hat es gemerkt - mit
   einer Heuristik ("nennt der Text den Ort nicht?"), die raet und
   nur im Telegram-Werkzeug sitzt.

   Beim ERZEUGEN weiss der Browser genau, fuer welches Objekt er
   rechnet. Diese eine Zeile fehlte. Jetzt kann jeder Leser exakt
   vergleichen statt zu raten - im Bot, im PDF, im Co-Pilot.

   Eine Herkunftsangabe gehoert an den ORT, an dem sie entsteht,
   nicht an den, der sie spaeter braucht. */
/* ══ v2017 · DER FINGERABDRUCK DER ZAHLEN ════════════════════════

   Genau die Felder, ueber die die Analyse urteilt. `updated_at` des
   Objekts waere der naheliegende Vergleich und der falsche: es
   aendert sich bei jedem Speichern - ein Haken, eine Notiz, ein
   Foto. Ein Banner, das nach jedem Klick "veraltet" ruft, wird nach
   drei Tagen weggesehen.

   Die Liste ist bewusst kurz und benannt: sie erlaubt es, dem Nutzer
   zu SAGEN, WAS sich geaendert hat - nicht nur DASS. */
var ANALYSE_FELDER = [
  ['kp','Kaufpreis'], ['nkm','Nettokaltmiete'], ['wfl','Wohnflaeche'],
  ['baujahr','Baujahr'], ['objart','Objektart'], ['zimmer','Zimmer'],
  ['d1z','Sollzins'], ['d1t','Tilgung'], ['ek','Eigenkapital'],
  ['gsfl','Grundstueck'], ['brw','Bodenrichtwert'], ['mea','Miteigentumsanteil'],
  ['ds2_zustand','Zustand'], ['ds2_energie','Energieklasse'],
  ['makrolage','Makrolage'], ['mikrolage','Mikrolage'], ['lageklasse','Lageklasse'],
  ['hg_nul','Hausgeld'], ['leerstand','Leerstand'], ['einheiten','Wohneinheiten']
];
function _analyseAbdruck() {
  var o = {};
  try {
    for (var i = 0; i < ANALYSE_FELDER.length; i++) {
      var id = ANALYSE_FELDER[i][0];
      var v = (typeof g === 'function') ? g(id) : '';
      o[id] = (v == null || String(v).trim() === '') ? null : String(v).trim();
    }
  } catch (e) { return null; }
  return o;
}
/* v2048 - derselbe Abdruck, andere Quelle.

   `_analyseAbdruck()` liest aus dem FORMULAR - also nur fuer das
   geoeffnete Objekt. Der Export prueft ALLE und hat nur Datensaetze.

   Dieselbe Liste `ANALYSE_FELDER`, derselbe Vergleich, nur eine
   andere Quelle. Eine zweite Feldliste waere beim naechsten Feld
   auseinandergelaufen - lautlos, weil beide Seiten plausibel
   bleiben. */
function _analyseAbdruckAus(daten) {
  if (!daten || typeof daten !== 'object') return null;
  var o = {};
  for (var i = 0; i < ANALYSE_FELDER.length; i++) {
    var id = ANALYSE_FELDER[i][0];
    var v = daten[id];
    o[id] = (v == null || String(v).trim() === '') ? null : String(v).trim();
  }
  return o;
}

/* v2048 - welche Felder haben sich seit der Analyse geaendert?
   Gibt die BESCHRIFTUNGEN zurueck. Ohne Abdruck wird NICHTS
   behauptet: eine alte Analyse ohne Stempel ist unbekannt, nicht
   veraltet. */
function _analyseAbweichungAus(daten, alt) {
  if (!alt || typeof alt !== 'object') return null;
  var jetzt = _analyseAbdruckAus(daten);
  if (!jetzt) return null;
  var raus = [];
  for (var i = 0; i < ANALYSE_FELDER.length; i++) {
    var id = ANALYSE_FELDER[i][0];
    if ((alt[id] || null) !== (jetzt[id] || null)) raus.push(ANALYSE_FELDER[i][1]);
  }
  return raus;
}
window._analyseAbdruckAus = _analyseAbdruckAus;
window._analyseAbweichungAus = _analyseAbweichungAus;

/* Was hat sich geaendert? Gibt die BESCHRIFTUNGEN zurueck, nicht die Ids. */
function _analyseAbweichung(alt) {
  if (!alt || typeof alt !== 'object') return null;   /* ohne Abdruck wird nichts behauptet */
  var jetzt = _analyseAbdruck();
  if (!jetzt) return null;
  var raus = [];
  for (var i = 0; i < ANALYSE_FELDER.length; i++) {
    var id = ANALYSE_FELDER[i][0];
    if ((alt[id] || null) !== (jetzt[id] || null)) raus.push(ANALYSE_FELDER[i][1]);
  }
  return raus;
}

function _analyseStempeln(analyse) {
  if (!analyse || typeof analyse !== 'object') return analyse;
  try {
    var adr = [g('str'), g('hnr')].filter(Boolean).join(' ');
    var ort = [g('plz'), g('ort')].filter(Boolean).join(' ');
    analyse._fuer = {
      objekt_id: window._currentObjKey || null,
      kuerzel: (typeof g === 'function' ? (g('kuerzel') || null) : null),
      adresse: [adr, ort].filter(Boolean).join(', ') || null,
      stand: new Date().toISOString(),
      /* v2017 - worauf sich die Analyse stuetzt. Ohne das laesst sich
         spaeter nur das Alter sagen, nicht die Gueltigkeit. */
      abdruck: _analyseAbdruck()
    };
  } catch (e) { /* ohne Stempel ist sie nicht schlechter als vorher */ }
  return analyse;
}
async function _runAIServer(btn) {
  var _orig = btn.innerHTML; /* v596-origbtn */
  btn.textContent = '⏳ Recherchiere Lage & analysiere...';
  document.getElementById('ai-content').innerHTML =
    '<div class="ai-loading">' +
      '<div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>' +
      '<span style="margin-left:10px;color:rgba(255,255,255,.5);font-size:12px">' +
      'KI recherchiert Makro-/Mikrolage, Mietspiegel und Marktdaten…</span>' +
    '</div>';
  try {
    /* v2430 · Ertragswerte je Stufe vorher holen (kein Kontingent, keine KI),
       damit der Pilot sie nennen kann. Hoechstens 40 s - danach ohne. */
    try {
      if (window.DpPotenzial && DpPotenzial.modell && DpPotenzial.modell().aktiv) {
        await Promise.race([DpPotenzial.rechnen(), new Promise(function (r) { setTimeout(r, 40000); })]);
      }
    } catch (e) {}
    var payload = _buildAIPayload();
    /* v2013 - die Fotos, verkleinert. Gemessen liegen sie als
       data:image/jpeg;base64 im Objekt, bis 1,8 MB je Objekt - roh
       mitzuschicken waere teuer und unnoetig. `_fotosFuerKi()` gibt
       hoechstens vier zurueck, lange Kante 768 px, JPEG 72 %. */
    try { payload.fotos = await _fotosFuerKi(); } catch (e) { payload.fotos = []; }
    var data = await Auth.apiCall('/ai/analyze', { method: 'POST', body: payload, timeout: 300000 });   /* v2986 · Websuche + zweiter Anlauf brauchen mehr als 120 s */
    var html;
    if (data && data.analysis) {
      /* v2017a - STEMPELN VOR DEM RENDERN.
       *
       * Hier stand `html = _renderAIServerAnalysis(data.analysis)` ZUERST
       * und der Stempel danach. Gemessen am echten Lauf: die frisch
       * gerechnete Analyse war korrekt gestempelt, und oben stand
       * trotzdem „Diese Analyse trägt noch kein Datum" — der Kopf aus
       * v2017 liest `a._fuer`, und das gab es zum Zeitpunkt des Renderns
       * noch nicht. Erst ein Neuladen des Objekts zeigte den Stand.
       *
       * Zwanzig Zeilen weiter unten (runMiniAI) war die Reihenfolge von
       * Anfang an richtig herum. Zwei Wege, eine Sache — und nur einer
       * stimmte.
       *
       * Gefunden hat es nicht der Prüfer, sondern der Blick auf den
       * Bildschirm nach dem Lauf. */
      window._aiAnalysis = _analyseStempeln(data.analysis);
      window._aiText = JSON.stringify(window._aiAnalysis, null, 2);
      html = _renderAIServerAnalysis(window._aiAnalysis);
      // V25: Mini-Block in Tab Kennzahlen mit aktualisieren
      var _mb = document.getElementById('ai-mini-body'); if (_mb) _mb.innerHTML = html; /* v596: Voll-Analyse in Bewertung */
      // V63.69: KI-Analyse direkt persistieren — User-Wunsch
      // Damit sie beim nächsten Öffnen des Objekts da ist
      if (typeof saveObj === 'function') {
        try { saveObj({ silent: true }); } catch(e) { console.warn('[ai] auto-save failed:', e); }
      }
    } else if (data && data.raw_text) {
      // V34: KI-Modell hat kein parsebares JSON geliefert — saubere Fehlermeldung
      // statt hässlicher Roh-JSON-Dump.
      html = '<div class="ai-error">' +
        '<div class="ai-error-title">⚠ KI-Antwort konnte nicht ausgewertet werden</div>' +
        '<div class="ai-error-msg">' +
          'Das KI-Modell hat eine Antwort geliefert, die nicht im erwarteten Format war ' +
          '(typisch bei zu langen Antworten oder Modell-Hänger). ' +
          'Versuche es bitte erneut — meistens klappt es im zweiten Anlauf.' +
        '</div>' +
        '<button class="ai-btn" onclick="runAI()" style="margin-top:14px">Analyse neu starten</button>' +
        '<details class="ai-error-details">' +
          '<summary>Technische Details (für Support)</summary>' +
          '<pre>' + _esc((data.raw_text || '').slice(0, 800)) + (data.raw_text && data.raw_text.length > 800 ? '\n…' : '') + '</pre>' +
        '</details>' +
      '</div>';
    } else {
      throw new Error('Antwort vom Server enthielt keine Analyse.');
    }
    document.getElementById('ai-content').innerHTML = html;
    /* v2167: nur bei echter Analyse „abgeschlossen". Bei einer Verweigerung
       des Modells (gemessen mit gpt-4o: „I'm sorry, but I can't assist")
       stand der Fehlerkasten da UND die Erfolgsmeldung - und wer den Kasten
       uebersah, hielt die alte Analyse fuer die neue. */
    if (data && data.analysis) toast('✓ Pilot-Analyse mit Web-Recherche abgeschlossen');
    else toast('⚠ Die KI hat keine Analyse geliefert — Details im Feld darunter');
    // V63.86: Pill aktualisieren nach Credit-Verbrauch
    if (window.AiCredits) window.AiCredits.refresh(true);
  } catch (e) {
    document.getElementById('ai-content').innerHTML =
      '<div class="ai-error">' + _formatAIError(e) + '</div>';
    // V63.86: Pill auch bei Fehler refreshen (z.B. wenn Server 402 zurückgibt)
    if (window.AiCredits) window.AiCredits.refresh(true);
  } finally {
    btn.disabled = false;
    if (typeof _orig === 'string') btn.innerHTML = _orig; /* v596-restorebtn */
  }
}

function _esc(s) {
  return ('' + (s == null ? '' : s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── v1700b · QUELLEN-LINKS LESBAR MACHEN ───────────────────────────────
   Marcel: „wenn ich die Webrecherche angemacht habe und dort Links
   zurueckgegeben werden, werden die ganz komisch angegeben. Da steht
   auch hinten irgendwie utm_source=openai."

   Zwei Dinge steckten drin:

   1. **`utm_source=openai`** haengt die Web-Suche der OpenAI-API selbst
      an jede URL. Es ist eine Herkunftsmarkierung fuer den betreibenden
      Dienst — fuer Marcel ist es Rauschen, und es macht den Link
      laenger als die Aussage.
   2. Die ganze Rohzeile wurde als LINKTEXT angezeigt. Wenn dort
      „Mietspiegel Bielefeld 2024 — https://…?utm_source=openai" stand,
      las man die URL zweimal.

   Jetzt wird die URL gesaeubert und der Text davor als Beschriftung
   genommen; steht kein Text da, erscheint der Hostname. Die volle
   Adresse bleibt im `title` — wer sie braucht, sieht sie, ohne dass
   jeder andere sie lesen muss.

   > Eine Quelle soll zeigen, WOHER etwas kommt. Eine Zeichenkette mit
   > Zaehlparametern zeigt, ueber WEN es kam. Das ist nicht dasselbe. */
function _urlSauber(u) {
  try {
    var x = new URL(u);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
     'utm_id', 'gclid', 'fbclid', 'ref', 'referrer']
      .forEach(function (p) { x.searchParams.delete(p); });
    var s = x.toString();
    return s.replace(/\?$/, '').replace(/#$/, '');
  } catch (e) { return u; }
}

/* v2157 · die Zeilen der Lage-Gegenüberstellung, robust gelesen: das
   Antwortformat zeigt dem Modell eine Musterzeile als Text ("... je eine
   Zeile fuer ..."); kommt sie zurück, ist sie kein Merkmal. */
function _lageZeilen(a) {
  var g = a && a.lage_gegenueberstellung;
  if (!Array.isArray(g)) return [];
  return g.filter(function (z) { return z && typeof z === 'object' && z.merkmal; });
}

function _quelleZeile(q) {
  var roh = '' + (q == null ? '' : q);
  /* v2947 (N78.3) · eine Portalquelle heisst „Aktueller Marktdurchschnitt", ohne Link */
  if (_DP_PORTAL_HOST.test(roh) || /\bScout\s?24\b/i.test(roh)) return '<span>Aktueller Marktdurchschnitt (Angebotsdaten)</span>';
  var m = roh.match(/https?:\/\/\S+/);
  if (!m) return _esc(roh);
  var url = _urlSauber(m[0].replace(/[),.;]+$/, ''));   /* Satzzeichen am Ende */
  /* Was vor der URL steht, ist die Beschriftung — sonst der Hostname. */
  var text = roh.slice(0, m.index).replace(/[\s–—:–—-]+$/, '').trim();
  if (!text) {
    try { text = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { text = url; }
  }
  return '<a href="' + _esc(url) + '" target="_blank" rel="noopener noreferrer" title="'
       + _esc(url) + '">' + _esc(text) + '</a>';
}

/**
 * V25.1: Markdown-Marker aus KI-Antworten entfernen, BEVOR sie im UI gerendert werden.
 * Das Modell liefert manchmal trotz expliziter Anweisung **fett** oder *kursiv* —
 * wir wandeln das in Klartext und entfernen alle übriggebliebenen Sterne aggressiv.
 */
function _stripMd(s) {
  if (s == null) return '';
  return ('' + s)
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')   // ***fett+kursiv***
    .replace(/\*\*([^*]+)\*\*/g, '$1')       // **fett**
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')  // *kursiv*
    .replace(/__([^_]+)__/g, '$1')           // __fett__
    .replace(/(?<!_)_([^_]+)_(?!_)/g, '$1')  // _kursiv_
    .replace(/`([^`]+)`/g, '$1')             // `code`
    .replace(/^\s*#{1,6}\s+/gm, '')          // # Headlines
    .replace(/^\s*[-*+]\s+/gm, '- ')         // Bulletlist normalisieren
    .replace(/\u2022/g, '-')                 // Bullet • → -
    .replace(/\*+/g, '')                     // Alle übriggebliebenen Sterne weg
    .trim();
}

/**
 * Combined: Markdown weg + HTML escape. Wird in allen AI-Render-Funktionen verwendet.
 */
function _linkify(escaped) {
  /* v588-linkify */
  if (!escaped) return escaped;
  var out = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, function (m, label, url) {
    var dom = label; try { dom = (url.replace(/^https?:\/\//, '').split('/')[0] || label).replace(/^www\./, ''); } catch (e) {}
    return '<a href="' + url + '" target="_blank" rel="noopener" class="dp-pa-srclink" title="' + url + '">' + dom + ' \u2197</a>';
  });
  out = out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, function (m, pre, url) {
    var dom = url.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
    return pre + '<a href="' + url + '" target="_blank" rel="noopener" class="dp-pa-srclink" title="' + url + '">' + dom + ' \u2197</a>';
  });
  return out;
}
/* v2947 (N78.3) · KEIN PORTALNAME NACH AUSSEN (Marcel 14.10.2026: „bitte auch keine
   Quelle wie ImmobilienScout angeben"). Der Prompt verbietet es seit v2500, gespeicherte
   Analysen davor tragen die Namen noch: gemessen 25.10.2026 an Westerfeldstr. 140 in
   Lage & Markt „laut Immowelt/Scout24", „(Scout24, Stand 04/2024)" und die Quellen
   immobilienscout24.de, wohnungsboerse.net. Dieselbe Liste wie das Backend
   (openaiService.js _neutral, v2500), dazu „Scout24" allein und Kleinanzeigen. */
var _DP_PORTAL_HOST = /(immobilienscout|immoscout|scout24|immowelt|immonet|immoportal|wohnungsboerse|wohnungsbörse|homeday|meinestadt|miete-aktuell|mietspiegel\.(com|net|org)|wohnpreis\.de|kleinanzeigen|ebay\.|ohne-makler|immopreise|wohnungsmarkt24|sprengnetter|pricehubble)/i;
function _ohnePortal(s) {
  if (s == null) return s;
  return String(s)
    .replace(/(\(\s*)?\bhttps?:\/\/\S+/gi, function (u) { return _DP_PORTAL_HOST.test(u) ? '' : u; })
    .replace(/\b(ImmobilienScout\s?24|Immobilien\s?Scout\s?24|ImmoScout\s?24|ImmoScout|Scout\s?24|Immowelt|Immonet|immoportal|Wohnungsb(oe|ö)rse(\.net)?|Homeday|meinestadt(\.de)?|miete-aktuell(\.de)?|mietspiegel\.(com|net|org)|wohnpreis(\.de)?|Kleinanzeigen)(\.de)?(\s*(\/|,|und|&)\s*(ImmobilienScout\s?24|ImmoScout\s?24|ImmoScout|Scout\s?24|Immowelt|Immonet|Wohnungsb(oe|ö)rse|Kleinanzeigen)(\.de)?)*(?![\wäöü])/gi, 'aktueller Marktdurchschnitt')
    .replace(/\b(laut|gemäß|nach|von|aus|bei) aktueller Marktdurchschnitt/g, '$1 aktuellem Marktdurchschnitt')
    .replace(/\b(Sprengnetter|PriceHubble)\b/gi, 'unabhängiger Bewertungspartner')
    .replace(/ {2,}/g, ' ');
}
try { window._dpOhnePortal = _ohnePortal; } catch (e) {}   /* pdf.js, pdf-investment-bank.js */
function _escClean(s) {
  return _linkify(_esc(_stripMd(_ohnePortal(s))));
}

/* v584-rail BEGIN */
window._dpPaTab = function (id, btn) {
  try {
    var wrap = btn && btn.closest ? btn.closest('.dp-pa-wrap') : null;
    if (!wrap) return;
    var tabs = wrap.querySelectorAll('.dp-pa-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('active', tabs[i] === btn);
    var pans = wrap.querySelectorAll('.dp-pa-panel');
    for (var j = 0; j < pans.length; j++) pans[j].classList.toggle('active', pans[j].id === 'dp-pa-' + id);
    /* v2946 · Steuerverlauf und „Ankauf gegen Bestand" wurden beim RENDERN der Analyse
       gebaut - oft bevor das Objekt fertig gerechnet war. Gemessen an Westerfeldstr. 140:
       Steuern ab Wendepunkt -109.865 € hier gegen -92.983 € im Reiter Steuer; Genau
       zeigte 15 Kennzahlen und Steuerwirkung -130 €, Einfach 16 und 0 €. Beim Oeffnen
       eines Unterreiters wird beides aus dem heutigen Stand neu gebaut. */
    try { if (window.DpSteuerVerlauf) window.DpSteuerVerlauf.mountAll(); } catch (e2) {}
    if ((id === 'anschluss' || id === 'exit') && window.DpBestand) { try { window.DpBestand.mountAll(); } catch (e3) {} }   /* v2985 */
    if (id === 'si' && window.DpJahresstaende) { try { window.DpJahresstaende.mount(); } catch (e4) {} }   /* v2989 */
    if (id === 'si' && typeof window._dpPaSollIstNeu === 'function') {
      var altH = wrap.querySelector('.abw-tafel-host');
      if (altH) {
        var tmp = document.createElement('div'); tmp.innerHTML = window._dpPaSollIstNeu();
        var neuH = tmp.querySelector('.abw-tafel-host');
        if (neuH) altH.parentNode.replaceChild(neuH, altH);
      }
    }
  } catch (e) {}
};

/* v2171: _dpQuellenAemter() (v2155) ist mit dem Quellen-Reiter gefallen. */
/* v2945 · Satz fuer den Kopf der Pilot-Analyse, wenn der letzte Marktbericht
   NACH der Analyse entstand (Quelle: DpWertZielbild.bericht(), dieselbe
   Historie wie im Tab Bewertung). Leer, wenn kein neuerer Bericht bekannt ist. */
function _paMbNeuer(stand) {
  try {
    var b = window.DpWertZielbild && window.DpWertZielbild.bericht ? window.DpWertZielbild.bericht() : null;
    if (!b || !b.created_at) return '';
    var d = new Date(b.created_at);
    if (isNaN(d) || d <= stand) return '';
    var mw = Number(b.market_value);
    return '<span data-dp-pa-mb="1">Seitdem gibt es einen <b>neueren Marktbericht vom ' + d.toLocaleDateString('de-DE') + '</b>'
      + (b.market_value != null && isFinite(mw) ? ' (Marktpreisindikation ' + Math.round(mw).toLocaleString('de-DE') + ' €)' : '')
      + ' — Werte aus dem Bericht in den Texten unten stammen aus dem älteren Stand.</span>';
  } catch (e) { return ''; }
}

/* v2985 · EINE Stelle fuer Wort und Farbe der Empfehlung (Briefing-Badge und
   Kennzahlen-Block). Im Bestand: Halten gruen, Optimieren gold, Verkauf pruefen rot;
   im Ankauf: Kaufen gruen, Pruefen gold, Nicht kaufen rot. Gruen/Rot sind
   Statusfarben (nicht tokenisiert), Gold folgt der Marke. */
function _dpEmpfStufe(emp) {
  var e = String(emp || '').toLowerCase().trim();
  var GOLD = 'var(--wl-c9a84c, #C9A84C)', GRUEN = '#3FA56C', ROT = '#B8625C';
  if (e.indexOf('halten') === 0) return { label: 'HALTEN', farbe: GRUEN };
  if (e.indexOf('optimieren') === 0) return { label: 'OPTIMIEREN', farbe: GOLD };
  if (e.indexOf('verkauf') === 0) return { label: 'VERKAUF PRÜFEN', farbe: ROT };
  if (e.indexOf('kaufen') === 0) return { label: 'KAUFEN', farbe: GRUEN };
  if (e.indexOf('nicht') === 0) return { label: 'NICHT KAUFEN', farbe: ROT };
  if (e.indexOf('prüfen') >= 0 || e.indexOf('pruefen') >= 0) return { label: 'PRÜFEN', farbe: GOLD };
  return { label: emp || '—', farbe: GOLD };
}
try { window._dpEmpfStufe = _dpEmpfStufe; } catch (e) {}
/* v2985 · Bestand heisst: Ankauf-Stand vorhanden UND Ist-Ansicht (nicht die
   Soll-Ansicht des eingefrorenen Stands, die zeigt die damalige Analyse). */
function _dpPaIstBestand() {
  try {
    if (window.DpBestand) return window.DpBestand.istBestand();
    var AK = window.DealPilotAnkauf, AA = window.DealPilotAnkaufAnsicht;
    return !!(AK && AK.vorhanden() && !(AA && AA.aktiv()));
  } catch (e) { return false; }
}
/* v2985 · Neu zeichnen, wenn die Ansicht wechselt (ankauf-ansicht.js ruft das nach
   dem Zurueckschalten: beim Laden stand die Soll-Ansicht noch auf aktiv). */
window._dpPaNeuZeichnen = function () {
  try {
    var a = window._aiAnalysis;
    if (!a || typeof a !== 'object') return;
    ['ai-content', 'ai-mini-body'].forEach(function (id) {
      var h = document.getElementById(id);
      if (h && h.querySelector('.dp-pa-wrap')) h.innerHTML = _renderAIServerAnalysis(a);
    });
  } catch (e) {}
};

function _renderAIServerAnalysis(a) {
  /* v584-rail */
  a = a || {};
  var _bestand = _dpPaIstBestand();   /* v2985 */
  function list(arr) {
    if (!Array.isArray(arr) || !arr.length) return '<em class="dp-pa-empty">\u2014</em>';
    return '<ul>' + arr.map(function (x) { return '<li>' + _escClean(x) + '</li>'; }).join('') + '</ul>';
  }
  function num(arr) {
    if (!Array.isArray(arr) || !arr.length) return '<em class="dp-pa-empty">\u2014</em>';
    return '<ol class="dp-pa-num">' + arr.map(function (x) { return '<li>' + _escClean(x) + '</li>'; }).join('') + '</ol>';
  }
  function fitBadge(value) {
    if (!value) return '';
    var v = String(value).toLowerCase().trim(), color, label;
    if (v.indexOf('ja') === 0) { color = '#2F8E5A'; label = 'Ja'; }
    else if (v.indexOf('nein') === 0) { color = '#B8625C'; label = 'Nein'; }
    else { color = 'var(--wl-c9a84c, #C9A84C)'; label = 'Teilweise'; }
    return '<span class="dp-pa-pill" style="background:' + color + '">' + label + '</span>';
  }
  function fitReason(value) {
    if (!value) return '';
    var v = String(value), dash = v.indexOf('\u2014');
    if (dash < 0) dash = v.indexOf(' - ');
    if (dash > 0) v = v.substring(dash + 1).trim();
    else if (v.toLowerCase().indexOf('ja') === 0 || v.toLowerCase().indexOf('nein') === 0 || v.toLowerCase().indexOf('teilweise') === 0) {
      var fs = v.indexOf(' ');
      if (fs > 0) v = v.substring(fs).replace(/^[\s,\u2014-]+/, '').trim();
    }
    return _escClean(v);
  }
  function empfBadge(emp) {
    var st = _dpEmpfStufe(emp);   /* v2985 · eine Stelle fuer Wort und Farbe (Bestand: Halten/Optimieren/Verkauf pruefen) */
    return '<span class="dp-pa-empf" style="background:' + st.farbe + '">' + _esc(st.label) + '</span>';
  }
  function sec(cls, icon, label) {
    return '<div class="dp-pa-sec ' + (cls || '') + '"><span class="dp-pa-bar"></span>' +
      '<span class="dp-pa-sq">' + icon + '</span><span class="dp-pa-lbl">' + label + '</span><span class="dp-pa-rule"></span></div>';
  }
  function p(t) { return t ? '<p class="dp-pa-p">' + _escClean(t) + '</p>' : ''; }
  function has(x) { return x != null && x !== ''; }
  function kv(lbl, val) { return '<div class="dp-pa-kv"><strong>' + lbl + ':</strong> ' + _escClean(val) + '</div>'; }
  /* v2985 · Fragen und Antworten des Piloten (Bestand: Anschlussfinanzierung, Exit) */
  function qa(arr) {
    var z = (Array.isArray(arr) ? arr : []).filter(function (x) { return x && typeof x === 'object' && has(x.frage) && has(x.antwort); });
    if (!z.length) return '';
    return '<div class="dp-pa-qa">' + z.map(function (x) {
      return '<div class="dp-pa-kv" style="margin-top:10px"><strong>' + _escClean(x.frage) + '</strong></div>' + p(x.antwort);
    }).join('') + '</div>';
  }

  var I = {
    brief: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 5h16M4 12h16M4 19h10"/></svg>',
    sr:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 18.6 7.1 21.2l.9-5.5-4-3.9 5.5-.8z"/></svg>',
    risk:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    loc:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    deal:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>',
    bank:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 10l9-6 9 6M5 10v8m14-8v8M9 10v8m6-8v8M3 20h18"/></svg>'
  };

  // Panel 1 — Briefing
  var pB = sec('', I.brief, 'BRIEFING');
  pB += '<div class="dp-pa-card"><div class="dp-pa-empf-row">' + empfBadge(a.empfehlung || a.fazit_kurz) + '</div>' +
        p(a.gesamtbewertung || a.fazit_kurz) + p(a.empfehlung_begruendung) + '</div>';
  /* v2985 · im Bestand gehoert die Bestandsstrategie ins Briefing (Verhandlung entfaellt) */
  if (_bestand) {
    if (a.bestand_modus && has(a.verhandlungsempfehlung))
      pB += '<div class="dp-pa-card">' + sec('', I.deal, 'BESTANDSSTRATEGIE · WAS DU JETZT TUN KANNST') + p(a.verhandlungsempfehlung) + '</div>';
    else if (!a.bestand_modus)
      pB += '<div class="dp-pa-card" data-dp-pa-bestand-alt="1"><div class="dp-pa-stand dp-pa-stand-alt" style="margin:0"><b>Diese Analyse bewertet das Objekt noch als Kaufangebot.</b> '
        + 'Sie stammt aus der Zeit, bevor der Pilot Bestandsobjekte als Halteentscheidung bewertet. Analyse neu abrufen, dann heißt die Empfehlung Halten, Optimieren oder Verkauf prüfen, '
        + 'und der Pilot beantwortet die Fragen zu Anschlussfinanzierung und Exit.</div></div>';
  }
  if (has(a.investmentbewertung))
    pB += '<div class="dp-pa-card">' + sec('', I.deal, 'INVESTMENTBEWERTUNG') + p(a.investmentbewertung) + '</div>';
  if (has(a.score_vergleich)) {
    /* v2947 (N78.5) · GLEICHER NAME, ANDERE ZAHL. Gemessen 25.10.2026 an Westerfeldstr. 140:
       DealPilot-Score 78 (DealScore-Kern), Objektkarte 73 (Investor Deal Score, DealScore2),
       Marktbericht 85 (eigene Bewertung des Berichts). Drei Rechnungen - die Zeile nennt sie
       mit dem heutigen Stand, damit 78/74 im Text nicht neben einer 73 auf der Karte stehen. */
    var _scH = [];
    try { var _d1 = DealScore.computeFromKpis(State.kpis); _d1 = _d1 && typeof _d1 === 'object' ? _d1.score : _d1; if (isFinite(_d1)) _scH.push('DealPilot-Score ' + Math.round(_d1)); } catch (e) {}
    try { if (window.DealScore2 && typeof window._buildDeal2FromState === 'function') { var _d2 = window.DealScore2.compute(window._buildDeal2FromState()); if (_d2 && isFinite(_d2.score)) _scH.push('Investor Deal Score ' + Math.round(_d2.score) + ' (steht auf der Objektkarte)'); } } catch (e) {}
    pB += '<div class="dp-pa-card">' + sec('', I.deal, 'SCORE-VERGLEICH') + p(a.score_vergleich)
      + (_scH.length ? '<div class="dp-pa-fuss">Heute: ' + _scH.join(' · ') + '. Die Zahlen im Text sind der Stand der Analyse. '
        + 'Der Score im Marktbericht ist eine eigene Bewertung des Berichts und heißt dort „Score laut Marktbericht“.</div>' : '')
      + '</div>';
  }
  if (a.investor_fit && typeof a.investor_fit === 'object') {
    var f = a.investor_fit;
    pB += '<div class="dp-pa-card">' + sec('', I.deal, 'INVESTOR-FIT') + '<div class="dp-pa-fit">';
    if (f.cashflow_investor)        pB += '<div class="dp-pa-fit-row"><span class="dp-pa-fit-l">Cashflow-Investor</span>' + fitBadge(f.cashflow_investor) + '<span class="dp-pa-fit-r">' + fitReason(f.cashflow_investor) + '</span></div>';
    if (f.wertsteigerungs_investor) pB += '<div class="dp-pa-fit-row"><span class="dp-pa-fit-l">Wertsteigerungs-Investor</span>' + fitBadge(f.wertsteigerungs_investor) + '<span class="dp-pa-fit-r">' + fitReason(f.wertsteigerungs_investor) + '</span></div>';
    if (f.sicherheitsorientiert)    pB += '<div class="dp-pa-fit-row"><span class="dp-pa-fit-l">Sicherheitsorientiert</span>' + fitBadge(f.sicherheitsorientiert) + '<span class="dp-pa-fit-r">' + fitReason(f.sicherheitsorientiert) + '</span></div>';
    pB += '</div></div>';
  }
  if (has(a.dealpilot_insight))
    pB += '<div class="dp-pa-card dp-pa-insight">' + sec('', I.deal, 'DEALPILOT-INSIGHT') + '<p class="dp-pa-p dp-pa-italic">' + _escClean(a.dealpilot_insight) + '</p></div>';

  // Panel 2 — Staerken & Risiken
  var pS = sec('', I.sr, 'ST\u00c4RKEN & RISIKEN') +
    '<div class="dp-pa-cols">' +
      '<div class="dp-pa-card">' + sec('good', I.sr, 'ST\u00c4RKEN') + list(a.staerken) + '</div>' +
      '<div class="dp-pa-card">' + sec('bad', I.risk, 'RISIKEN') + list(a.risiken) + '</div>' +
    '</div>';
  /* ══ v2156 · DER OPTISCHE EINDRUCK HATTE KEINEN LESER ════════════════
     Das Feld wird verlangt, sobald Fotos mitgehen (openaiService.js:1415,
     4-6 Saetze), und GEMESSEN am 12.10.2026 gab es im ganzen Frontend
     keine Stelle, die es ausgibt — null Treffer fuer `optischer_eindruck`
     in frontend/js.

     > Die Arbeit wurde erzeugt, bezahlt und weggeworfen. Dasselbe Muster
     > wie die `skala` von heute Morgen und die Telefonnummer der Aemter.

     Er steht bei den Staerken und Risiken, weil er genau dort hingehoert:
     ein Eindruck, der dem erfassten Zustand widerspricht, ist ein Risiko.
     Die Einordnung steht dabei — es ist ein Eindruck aus Bildern, keine
     Feststellung, und der Prompt verbietet ausdruecklich, daraus Baujahr,
     Flaeche oder Wert abzuleiten. */
  if (has(a.optischer_eindruck)) {
    pS += '<div class="dp-pa-card">' + sec('', I.sr, 'OPTISCHER EINDRUCK AUS DEN FOTOS')
       + p(a.optischer_eindruck)
       + '<div class="dp-pa-fuss">Ein visueller Eindruck aus den mitgesendeten '
       + 'Bildern — keine Feststellung. Baujahr, Fläche und Wert kommen '
       + 'aus der Erfassung, nicht aus dem Foto.</div></div>';
  }

  // Panel 3 — Risiko & Szenarien
  var pR = sec('', I.risk, 'RISIKO & SZENARIEN');
  if (a.risikoanalyse && typeof a.risikoanalyse === 'object') {
    var ra = a.risikoanalyse;
    pR += '<div class="dp-pa-card">' + sec('', I.risk, 'RISIKOANALYSE');
    if (ra.finanzierungsrisiko)    pR += kv('Finanzierungsrisiko (LTV + DSCR)', ra.finanzierungsrisiko);
    if (ra.cashflow_stabilitaet)   pR += kv('Cashflow-Stabilit\u00e4t', ra.cashflow_stabilitaet);
    if (ra.annahmen_abhaengigkeit) pR += kv('Abh\u00e4ngigkeit von Annahmen', ra.annahmen_abhaengigkeit);
    pR += '</div>';
  }
  /* v2985 · im Bestand hat die Anschlussfinanzierung einen eigenen Reiter */
  if (!_bestand && has(a.anschlussfinanzierung))
    pR += '<div class="dp-pa-card">' + sec('', I.risk, 'ANSCHLUSSFINANZIERUNG')
      + (Array.isArray(a.anschlussfinanzierung) ? qa(a.anschlussfinanzierung) : p(a.anschlussfinanzierung)) + '</div>';
  if (a.szenarien && typeof a.szenarien === 'object') {
    pR += '<div class="dp-pa-cols">' +
      '<div class="dp-pa-card dp-pa-tone-bad">' + sec('bad', I.risk, 'WORST CASE') + '<div class="dp-pa-kv-sub">Miete -10%, Zins +1%</div>' + p(a.szenarien.worst_case) + '</div>' +
      '<div class="dp-pa-card dp-pa-tone-good">' + sec('good', I.sr, 'BEST CASE') + '<div class="dp-pa-kv-sub">Miete +5%, h\u00f6here Wertsteigerung</div>' + p(a.szenarien.best_case) + '</div>' +
    '</div>';
  }

  // Panel 4 — Lage & Markt
  var pL = sec('', I.loc, 'LAGE & MARKT') + '<div class="dp-pa-card">';
  if (a.makrolage_recherche)     pL += kv('Makrolage', a.makrolage_recherche);
  if (a.mikrolage_recherche)     pL += kv('Mikrolage', a.mikrolage_recherche);
  /* v2150 \u00b7 DIE HERKUNFT STEHT AM WERT, NICHT IM KLEINGEDRUCKTEN.
     Marcel: \u201ewoher kommen die werte und daten im reiter Lage & Markt?"
     Die Antwort war: aus der KI-Recherche \u2014 auch wenn ein Marktbericht
     mit gemessenen Partnerdaten vorlag. Seit v2150 hat der Bericht
     Vorrang, und `mietspiegel_herkunft` sagt, welcher Fall vorliegt.
     Ohne diese Zeile wuesste der Leser es weiterhin nicht. */
  if (has(a.mietspiegel_eur_qm)) pL += '<div class="dp-pa-kv"><strong>Mietspiegel:</strong> '
    + _escClean(String(a.mietspiegel_eur_qm).replace(/\s*(?:\u20ac|EUR|Euro)(?:\s*\/\s*(?:m\u00b2|m2|qm))?\s*$/i, '')) + ' \u20ac/m\u00b2'   /* v2970 \u00b7 die KI liefert den Wert oft MIT Einheit - sonst "9,81 \u20ac \u20ac/m\u00b2" */
    + (a.mietspiegel_herkunft ? ' <span class="dp-pa-herk">\u00b7 ' + _esc(a.mietspiegel_herkunft) + '</span>' : '')
    + '</div>';
  if (a.kaufpreisniveau)         pL += kv('Kaufpreisniveau', a.kaufpreisniveau);
  if (!a.makrolage_recherche && !a.mikrolage_recherche && !has(a.mietspiegel_eur_qm) && !a.kaufpreisniveau)
    pL += '<em class="dp-pa-empty">\u2014 keine Lage-Daten</em>';
  pL += '</div>';
  /* v2150 \u00b7 Der Abgleich gegen den Marktbericht \u2014 eigene Karte, weil er
     eine andere Art von Aussage ist: nicht recherchiert, sondern
     gegenuebergestellt. Steht nur, wenn ein Bericht vorlag. */
  if (has(a.berichts_abgleich)) {
    pL += '<div class="dp-pa-card dp-pa-abgl">' + sec('', I.loc, 'ABGLEICH MIT DEM MARKTBERICHT')
       + p(a.berichts_abgleich)
       + '<div class="dp-pa-fuss">Sach- und Ertragswert im Bericht sind ein Plausibilit\u00e4ts-Quercheck '
       + 'nach ImmoWertV-Logik \u2014 indikativ, kein Gutachten nach \u00a7 194 BauGB.</div></div>';
  }
  /* v2157 · DIE GEGENÜBERSTELLUNG (N62.4) — je Merkmal drei Seiten:
     Objektfeld (Angabe des Investors), Marktbericht (gemessen),
     Recherche (mit ihrer Quelle in derselben Zeile). Gestapelt statt als
     Tabelle: vier Spalten tragen bei 390 px nicht. */
  var _lg = _lageZeilen(a);
  if (_lg.length) {
    pL += '<div class="dp-pa-card dp-pa-ggs">' + sec('', I.loc, 'GEGENÜBERSTELLUNG')
       + '<div class="dp-pa-kv-sub">Ihre Angabe · Marktbericht · Recherche</div>'
       + _lg.map(function (z) {
           var u = String(z.urteil || '').toLowerCase();
           var kl = /abweich|weicht/.test(u) ? 'ab' : (/stimmt/.test(u) ? 'ok' : 'offen');
           var zl = function (lbl, v) {
             return has(v) ? '<div class="dp-pa-ggs-z"><span>' + lbl + '</span>' + _escClean(v) + '</div>' : '';
           };
           var q = has(z.quelle) ? '<div class="dp-pa-ggs-z"><span>Quelle</span>' + _quelleZeile(z.quelle) + '</div>' : '';
           return '<div class="dp-pa-ggs-row">'
             + '<div class="dp-pa-ggs-kopf"><strong>' + _esc(z.merkmal || '') + '</strong>'
             + (u ? '<em class="dp-pa-ggs-u dp-pa-ggs-' + kl + '">' + _esc(z.urteil) + '</em>' : '') + '</div>'
             + zl('Ihre Angabe', z.objektfeld) + zl('Marktbericht', z.bericht) + zl('Recherche', z.recherche) + q
             + (has(z.kommentar) ? '<div class="dp-pa-ggs-k">' + _escClean(z.kommentar) + '</div>' : '')
             + '</div>';
         }).join('')
       + '<div class="dp-pa-fuss">„Ihre Angabe“ ist die Selbsteinschätzung aus dem Objekt — '
       + 'nicht gemessen. Der Marktbericht leitet die Lage aus Messdaten ab.</div></div>';
  }
  if (Array.isArray(a.quellen) && a.quellen.length) {
    pL += '<div class="dp-pa-card">' + sec('', I.loc, 'QUELLEN') + '<ul class="dp-pa-src">' +
      a.quellen.map(function (q) { return '<li>' + _quelleZeile(q) + '</li>'; })
        .filter(function (x, i, arr) { return arr.indexOf(x) === i; }).join('') +   /* v2947 · mehrere Portale = ein Eintrag */
      '</ul></div>';
  }

  // Panel 5 — Verhandlung & Offerte
  /* v2982 · im Bestand gibt es keine Verhandlung: dasselbe Feld traegt die Bestandsstrategie */
  var pV = sec('', I.deal, a.bestand_modus ? 'BESTANDSSTRATEGIE' : 'VERHANDLUNG & OFFERTE');
  if (has(a.verhandlungsempfehlung))
    pV += '<div class="dp-pa-card">' + sec('', I.deal, a.bestand_modus ? 'WAS DU JETZT TUN KANNST' : 'VERHANDLUNGSEMPFEHLUNG') + p(a.verhandlungsempfehlung) + '</div>';
  /* v2946 · DIE OFFERTE LIEGT NIE UEBER DEM KAUFPREIS - auch nicht in der Anzeige.
     Die Deckelung im Backend (openaiService.js _offerteDeckeln, v2264) greift nur beim
     Erzeugen. Gemessen 25.10.2026 an Westerfeldstr. 140 (Analyse vom 13.10.): Offerte
     910.000 € bei 545.000 € Kaufpreis, dazu eine fertige Mail „biete … 910.000 € an".
     Hier wird gegen den HEUTIGEN Kaufpreis geprueft; liegt die Offerte darueber,
     erscheint sie nicht als Zahl und die Mail wird nicht angeboten. */
  var _offUeber = null;
  try {
    var _offKp = Number((window.State && State.kpis && State.kpis.kp) || (document.getElementById('kp') || {}).value);
    var _offRoh = a.kaufpreis_offerte && a.kaufpreis_offerte.empfohlen != null ? String(a.kaufpreis_offerte.empfohlen) : '';
    var _offW = parseFloat(_offRoh.replace(/[^0-9.,]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (_offKp > 0 && isFinite(_offW) && _offW > _offKp) _offUeber = { wert: _offW, kp: _offKp };
  } catch (e) { _offUeber = null; }
  if (a.kaufpreis_offerte && typeof a.kaufpreis_offerte === 'object') {
    var kp = a.kaufpreis_offerte;
    pV += '<div class="dp-pa-card dp-pa-offerte">' + sec('', I.deal, 'KAUFPREIS-OFFERTE');
    if (_offUeber) pV += '<div class="dp-pa-stand dp-pa-stand-alt" style="margin:6px 0 10px"><b>Diese Offerte gilt nicht:</b> Die Analyse schlug '
      + Math.round(_offUeber.wert).toLocaleString('de-DE') + ' € vor, das liegt über dem Kaufpreis von '
      + Math.round(_offUeber.kp).toLocaleString('de-DE') + ' €. Eine Offerte liegt höchstens beim Kaufpreis. Bitte die Pilot-Analyse neu abrufen.</div>';
    else if (kp.empfohlen) pV += '<div class="dp-pa-price">' + _escClean(kp.empfohlen) + '</div>';
    if (kp.begruendung) pV += p(kp.begruendung);
    if (Array.isArray(kp.argumente) && kp.argumente.length)
      pV += '<div class="dp-pa-kv"><strong>Argumente f\u00fcr die Verhandlung:</strong></div>' + list(kp.argumente);
    pV += '</div>';
  }
  if (!_offUeber && !a.offerte_mail && has(a.offerte_mail_entfallen)) {
    /* v2947 (N78.1) · das Backend hat gedeckelt und die Mail weggelassen */
    pV += '<div class="dp-pa-card dp-pa-offmail">' + sec('', I.deal, 'OFFERTE ALS E-MAIL')
      + '<em class="dp-pa-empty">' + _esc(a.offerte_mail_entfallen) + ' Nach einem neuen Abruf steht sie hier.</em></div>';
  } else if (_offUeber && a.offerte_mail && typeof a.offerte_mail === 'object') {
    pV += '<div class="dp-pa-card dp-pa-offmail">' + sec('', I.deal, 'OFFERTE ALS E-MAIL')
      + '<em class="dp-pa-empty">Keine Mail: die Offerte dieser Analyse liegt über dem Kaufpreis (siehe oben). Nach einem neuen Abruf steht sie hier.</em></div>';
  } else if (a.offerte_mail && typeof a.offerte_mail === 'object') {
    var om = a.offerte_mail;
    var omRaw = (om.text || '');
    pV += '<div class="dp-pa-card dp-pa-offmail">' + sec('', I.deal, 'OFFERTE ALS E-MAIL') +
      (om.betreff ? '<div class="dp-pa-kv"><strong>Betreff:</strong> ' + _esc(om.betreff) + '</div>' : '') +
      '<div class="dp-pa-mailtext">' + _esc(omRaw) + '</div>' +
      '<div class="dp-pa-mailbtns">' +
        '<button type="button" class="dp-pa-mbtn" onclick="_dpOfferteMail(\'mail\',this)">Als E-Mail erzeugen</button>' +
        '<button type="button" class="dp-pa-mbtn ghost" onclick="_dpOfferteMail(\'copy\',this)">Text kopieren</button>' +
      '</div>' +
      '<textarea class="dp-pa-mailraw" hidden>' + _esc(omRaw) + '</textarea>' +
      '<input type="hidden" class="dp-pa-mailsubj" value="' + _esc(om.betreff || '') + '">' +
      '</div>';
  }
  if (!has(a.verhandlungsempfehlung) && !(a.kaufpreis_offerte && typeof a.kaufpreis_offerte === 'object') && !(a.offerte_mail && typeof a.offerte_mail === 'object'))
    pV += '<div class="dp-pa-card"><em class="dp-pa-empty">\u2014 keine Verhandlungsdaten</em></div>';

  // Panel 6 — Bank
  var pK = sec('', I.bank, 'BANK') + '<div class="dp-pa-card">' + sec('', I.bank, 'BANKARGUMENTE') +
    ((Array.isArray(a.bankargumente) && a.bankargumente.length) ? num(a.bankargumente) : '<em class="dp-pa-empty">\u2014 keine Bankargumente</em>') + '</div>';

  /* v2985 · BESTAND: Anschlussfinanzierung und Exit-Strategien. Der rechnerische Teil
     kommt aus bestand-analyse.js (ohne KI, gefuellt beim Oeffnen des Reiters), die
     Fragen und Antworten aus der Analyse. Eine Analyse von vor v2985 hat sie nicht -
     dann sagt der Reiter das, die Rechnung steht trotzdem. */
  var _neuAbrufen = '<div class="dp-pa-card"><div class="dp-pa-fuss" style="margin-top:0">Analyse neu abrufen, dann beantwortet der Pilot diese Fragen.</div></div>';
  var pAF = '', pEX = '';
  if (_bestand) {
    pAF = sec('', I.bank, 'ANSCHLUSSFINANZIERUNG') + '<div data-dp-bestand="anschluss"></div>';
    var _afQa = qa(a.anschlussfinanzierung);
    if (_afQa) pAF += '<div class="dp-pa-card">' + sec('', I.bank, 'PILOT: FRAGEN ZUR ANSCHLUSSFINANZIERUNG') + _afQa + '</div>';
    else if (has(a.anschlussfinanzierung) && typeof a.anschlussfinanzierung === 'string')
      pAF += '<div class="dp-pa-card">' + sec('', I.bank, 'PILOT (ÄLTERE ANALYSE)') + p(a.anschlussfinanzierung) + '</div>' + _neuAbrufen;
    else pAF += _neuAbrufen;
    if (Array.isArray(a.bankargumente) && a.bankargumente.length)
      pAF += '<div class="dp-pa-card">' + sec('', I.bank, 'ARGUMENTE FÜR DIE BANK') + num(a.bankargumente) + '</div>';
    pEX = sec('', I.deal, 'EXIT-STRATEGIEN') + '<div data-dp-bestand="exit"></div>';
    var _exQa = qa(a.exit_strategien);
    pEX += _exQa ? '<div class="dp-pa-card">' + sec('', I.deal, 'PILOT: FRAGEN ZUM EXIT') + _exQa
      + '<div class="dp-pa-fuss">Eine Einordnung aus deinen Eingaben — keine Steuer- oder Rechtsberatung. Lass Verkauf, Aufteilung oder Überführung von deinem Steuerberater prüfen.</div></div>'
      : _neuAbrufen;
    try { setTimeout(function () { if (window.DpBestand) window.DpBestand.mountAll(); }, 0); } catch (e) {}
  }

  function tab(id, label, active) {
    return '<button type="button" class="dp-pa-tab' + (active ? ' active' : '') + '" onclick="_dpPaTab(\'' + id + '\',this)">' + label + '</button>';
  }
  function panel(id, inner, active) {
    return '<section class="dp-pa-panel' + (active ? ' active' : '') + '" id="dp-pa-' + id + '">' + inner + '</section>';
  }

  /* v2042 - der Soll/Ist-Abgleich. Marcel: „zusaetzlich in der
     Pilot-Analyse dann einen Reiter Soll/Ist-Abgleich mit passendem
     Text."

     Rechnet nichts: `DealPilotAnkauf.abweichung()` liefert die Zeilen
     fertig, aus zwei Saetzen persistierter Kennzahlen. Und er nennt
     die Deckung - eine Tafel, die vollstaendig aussieht und es nicht
     ist, ist schlimmer als eine kurze. */
  function _sollIstHtml() {
    var AK = window.DealPilotAnkauf;
    if (!AK || !AK.vorhanden()) return '';
    /* v2217 · Marcel 14.10.2026: „Soll/Ist vielleicht nur anzeigen, wenn wir
       wirklich schon in Bestand überführt haben." Ein Ankauf-Stand ohne
       Gewonnen ist ein ruhender (`_ankauf_ruhend`) - dann kein Reiter. */
    /* Gemessen (v2217): beim Laden zeichnet storage.js die Analyse (Z. 765)
       BEVOR es _deal_won_state setzt (Z. 789) - das Feld trug dann noch den
       Wert des vorigen Objekts. Massgeblich ist der geladene Datensatz; das
       Feld zaehlt, wenn es in dieser Sitzung danach auf „gewonnen" steht. */
    var _wf = (document.getElementById('_deal_won_state') || {}).value;
    var _wd = window._currentObjData && (window._currentObjData._deal_won === true || window._currentObjData._deal_won === 'true');
    if (!(_wf === 'true' || _wd)) return '';
    var a = null;
    try { a = AK.abweichung(); } catch (e) {}
    if (!a) return '';
    var gesamt = (AK.KENNZAHLEN || []).length;
    function f(v, e) {
      if (v === null || v === undefined || !isFinite(v)) return '\u2013';
      if (e === 'eur') return Math.round(v).toLocaleString('de-DE') + ' \u20ac';
      if (e === 'eurqm') return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20ac/m\u00b2';   /* v2216e */
      if (e === 'stk' || e === 'score') return String(Math.round(v));   /* v2947 */
      if (e === 'pct') return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
      return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function d(z) {
      var vz = z.diff > 0 ? '+' : '';
      if (z.einheit === 'stk' || z.einheit === 'score') return vz + Math.round(z.diff);   /* v2216h */
      if (z.einheit === 'eurqm') return vz + f(z.diff, 'zahl') + ' \u20ac/m\u00b2';
      if (z.einheit === 'eur') return vz + Math.round(z.diff).toLocaleString('de-DE') + ' \u20ac';
      if (z.einheit === 'pct') return vz + f(z.diff, 'zahl') + ' %-Punkte';
      return vz + f(z.diff, 'zahl');
    }
    var t = a.stichtag ? a.stichtag.split('-').reverse().join('.') : '';
    /* v2216e · Marcel 14.10.2026: „genauer beschrieben, vielleicht auch mehr
       Felder." Die Zeilen stehen jetzt in Gruppen - Ertrag, Kosten,
       Finanzierung, Steuer, Ergebnis -, damit man sieht, WO sich etwas bewegt. */
    var GRUPPEN = ['Ertrag', 'Kosten', 'Finanzierung', 'Steuer', 'Ergebnis'];
    var reihen = GRUPPEN.map(function (g) {
      var zz = a.zeilen.filter(function (z) { return (z.gruppe || 'Ergebnis') === g; });
      if (!zz.length) return '';
      return '<tr class="abw-gruppe"><td colspan="4">' + g + '</td></tr>' + zz.map(function (z) {
        return '<tr class="abw-' + z.richtung + '"><td class="abw-wort">' + z.wort + '</td>'
          + '<td class="abw-zahl">' + f(z.ankauf, z.einheit) + '</td>'
          + '<td class="abw-zahl">' + f(z.bestand, z.einheit) + '</td>'
          + '<td class="abw-zahl abw-diff">' + (z.richtung === 'gleich' ? '–' : d(z)) + '</td></tr>';
      }).join('');
    }).join('');
    /* Die drei größten Bewegungen in Worten - nur Zeilen, die sich bewegt
       haben; der DealScore steht ohnehin als Urteil im Satz darunter. */
    var bewegt = a.zeilen.filter(function (z) { return z.richtung !== 'gleich' && z.wort !== 'DealScore' && z.pct !== null && isFinite(z.pct); })
      .sort(function (x, y) { return Math.abs(y.pct) - Math.abs(x.pct); }).slice(0, 3);
    var satz = bewegt.map(function (z) {
      var wie = z.richtung === 'besser' ? '<span class="abw-pfeil besser">besser</span>' : '<span class="abw-pfeil schlechter">schlechter</span>';
      return '<li><b>' + z.wort + '</b>: ' + f(z.ankauf, z.einheit) + ' → ' + f(z.bestand, z.einheit)
        + ' (' + (z.pct > 0 ? '+' : '') + Math.round(z.pct) + ' %) — ' + wie + '</li>';
    }).join('');
    var sc = a.zeilen.filter(function (z) { return z.wort === 'DealScore'; })[0];
    var bewegtHtml = bewegt.length
      ? '<div class="abw-bewegt"><b>Was sich bewegt hat</b><ul>' + satz + '</ul>'
        + (sc && sc.richtung !== 'gleich' ? '<div>Unterm Strich: DealScore ' + f(sc.ankauf, 'zahl').replace(',00', '') + ' → ' + f(sc.bestand, 'zahl').replace(',00', '')
            + ' — das Objekt steht ' + (sc.richtung === 'besser' ? '<b>über</b>' : '<b>unter</b>') + ' Plan.</div>' : '')
        + '</div>'
      : '';
    var schlechter = a.zeilen.filter(function (z) { return z.richtung === 'schlechter'; }).length;
    var besser = a.zeilen.filter(function (z) { return z.richtung === 'besser'; }).length;
    return '<div class="abw-tafel-host" style="margin:0">'
      + '<div class="abw-kopf"><h4>Ankauf gegen Bestand <span class="abw-sub">eingefrorener Stand gegen heute</span></h4>'
      + '<div class="abw-stand">Ankauf-Stand vom <b>' + t + '</b></div></div>'
      /* v2989 · Rechenstand: mit welcher App-Version der Ankauf gerechnet wurde */
      + (function () { try { var J = window.DpJahresstaende, st = AK.stand ? AK.stand() : null, sz = J && st ? J.rechenstandSatz(st) : '';
          return sz ? '<div class="dp-pa-fuss" data-dp-rechenstand="1" style="margin:0 0 10px">' + sz + '</div>' : ''; } catch (e) { return ''; } })()
      + '<p style="margin:0 0 12px;font:400 12.5px/1.6 Inter,system-ui,sans-serif">'
      + '<b>Ankauf</b> ist der Stand beim Nutzen-/Lastenwechsel. '   /* v2430: dein Soll/dein Ist raus - Soll heisst jetzt die Soll-Miete (Mieter bleibt) */
      + '<b>Bestand</b> ist, wie das Objekt heute dasteht. '
      + (besser || schlechter
          ? ('Von ' + a.zeilen.length + ' vergleichbaren Kennzahlen stehen <b>' + besser
             + '</b> besser und <b>' + schlechter + '</b> schlechter als beim Ankauf.')
          : 'Es hat sich nichts bewegt.')
      + '</p>'
      + bewegtHtml
      + '<style>.abw-tafel tr.abw-gruppe td{font:600 10.5px/1.2 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#8a6d1f;padding:12px 6px 4px;border-bottom:1px solid rgba(138,109,31,.25)}'
      + '.abw-bewegt{margin:0 0 14px;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 8%,transparent);font:400 12.5px/1.55 Inter,system-ui,sans-serif}'
      + '.abw-bewegt ul{margin:6px 0 4px;padding-left:18px}.abw-pfeil.besser{color:#3FA56C;font-weight:600}.abw-pfeil.schlechter{color:#B8625C;font-weight:600}</style>'
      + '<table class="abw-tafel"><thead><tr><th>Kennzahl</th><th>Ankauf</th><th>Bestand</th><th>Abweichung</th></tr></thead>'
      + '<tbody>' + reihen + '</tbody></table>'
      + '<div class="abw-deckung">' + a.zeilen.length + ' von ' + gesamt + ' Kennzahlen vergleichbar'
      + (a.zeilen.length < gesamt
          ? ' \u2014 die \u00fcbrigen lagen zu einem der beiden Zeitpunkte nicht vor und werden <b>nicht</b> gesch\u00e4tzt.'
          : '.')
      + '</div></div>';
  }
  var _siHtml = _sollIstHtml();
  window._dpPaSollIstNeu = _sollIstHtml;   /* v2946 · fuer den Neuaufbau beim Oeffnen des Unterreiters */
  /* v2430 · Ankauf · Bestand · Zielbild: die Tafel aus DpPotenzial (rechnet keinen
     Ertragswert selbst - der kommt aus dem Marktbericht-Dienst) und der Absatz des
     Piloten (potenzial_text). Ohne Soll-Miete und Zielbild bleibt es beim Abgleich. */
  var _potHtml = (function () {
    var PZ = window.DpPotenzial; var t = '';
    try { t = PZ && PZ.tafelHtml ? PZ.tafelHtml() : ''; } catch (e) { t = ''; }
    if (!t) return '';
    return '<div class="dp-pa-card">' + sec('', I.bank, 'ANKAUF \u00b7 BESTAND \u00b7 ZIELBILD') + '<div data-dp-pot-wirt="1">' + t + '</div>'
      + (has(a.potenzial_text) ? '<div style="margin-top:12px">' + sec('', I.bank, 'PILOT: WAS IM HAUS STECKT') + (function () {
          /* v2842 · Marcel: „die Texte zwischen den Tabellen sind zu lang" - zwei Sätze, der Rest aufklappbar */
          var t = String(a.potenzial_text), m = t.match(/^([\s\S]*?[.!?])\s+([\s\S]*?[.!?])\s+([\s\S]+)$/);
          if (!m) return p(t);
          return p(m[1] + ' ' + m[2]) + '<details class="dp-pot-mehr"><summary>weiterlesen</summary>' + p(m[3]) + '</details>';
        })() + '</div>' : '') + '</div>';
  })();
  /* v2217 · Marcel 14.10.2026: „haben wir die Pilot-Analyse des Objektes für
     den Soll-Stand? … wenn wir das Objekt in Bestand überführen, möchte ich
     das gegenüberstellen." Gemessen: alle 11 Ankauf-Stände auf Staging tragen
     die Analyse vom Festschreiben in `_ankauf.daten._ai` - gezeigt wurde sie
     nirgends. Hier steht sie neben der heutigen. */
  if (_siHtml) _siHtml += (function () {
    var AK = window.DealPilotAnkauf, st = AK && AK.stand ? AK.stand() : (window._dpAnkauf || null);
    var roh = st && st.daten ? st.daten._ai : null, alt = null;
    try { alt = roh ? (typeof roh === 'string' ? JSON.parse(roh) : roh) : null; } catch (e) { alt = null; }
    var kopf = sec('', I.bank, 'PILOT-ANALYSE: ANKAUF GEGEN HEUTE');
    if (!alt || typeof alt !== 'object' || !(alt.empfehlung || alt.gesamtbewertung)) {
      return '<div class="dp-pa-card" style="margin-top:12px" data-dp-si-pilot="1">' + kopf + '<p class="dp-pa-p">Beim Festschreiben des Ankauf-Stands lag keine Pilot-Analyse vor. '
        + 'Was der Pilot damals gesagt hätte, lässt sich nicht nachträglich erzeugen — eine neue Analyse beschreibt immer den heutigen Stand.</p></div>';
    }
    function dat(x) { var d = x && x._fuer && x._fuer.stand ? new Date(x._fuer.stand) : null; return d && !isNaN(d) ? d.toLocaleDateString('de-DE') : 'ohne Datum'; }
    function kp(x) { if (x && x.bestand_modus) return 'entfällt (im Bestand)'; var o = x && x.kaufpreis_offerte; return o && o.empfohlen ? _escClean(String(o.empfohlen)) : '–'; }   /* v2982 */
    function kurz(t, n) { t = String(t || ''); return t.length > n ? t.slice(0, n).replace(/\s+\S*$/, '') + ' …' : t; }
    var gleich = alt._fuer && a._fuer && alt._fuer.stand === a._fuer.stand;
    var zeile = function (wort, x, y) { return '<tr><td class="abw-wort">' + wort + '</td><td>' + x + '</td><td>' + y + '</td></tr>'; };
    return '<div class="dp-pa-card" style="margin-top:12px" data-dp-si-pilot="1">' + kopf
      + (gleich ? '<p class="dp-pa-p">Seit dem Festschreiben wurde keine neue Analyse abgerufen — beide Spalten zeigen dieselbe. Ruf sie neu ab, dann steht hier, wie der Pilot das Objekt <b>heute</b> sieht.</p>' : '')
      + '<table class="abw-tafel"><thead><tr><th></th><th>Beim Ankauf</th><th>Heute</th></tr></thead><tbody>'
      + zeile('Stand', dat(alt), dat(a))
      + zeile('Empfehlung', '<b>' + _escClean(alt.empfehlung || '–') + '</b>', '<b>' + _escClean(a.empfehlung || '–') + '</b>')
      + zeile('Empfohlener Kaufpreis', kp(alt), kp(a))
      + zeile('Begründung', _escClean(kurz(alt.empfehlung_begruendung, 260)), _escClean(kurz(a.empfehlung_begruendung, 260)))
      + '</tbody></table>'
      /* v2982 · Marcel zu Hüllhorst: „erst prüfen und jetzt kaufen? warum? ist doch schon im Bestand." */
      + (a.bestand_modus
          ? '<p class="dp-pa-p" style="margin-top:8px">Beim Ankauf war die Frage „kaufen?", heute ist sie „halten?": das Objekt ist im Bestand. Die beiden Empfehlungen beantworten deshalb verschiedene Fragen.</p>'
          : (gleich ? '' : '<p class="dp-pa-p" style="margin-top:8px"><b>Die heutige Analyse bewertet das Objekt noch als Kaufangebot.</b> Sie stammt aus der Zeit, bevor der Pilot Bestandsobjekte als Halteentscheidung bewertet. Ruf die Analyse neu ab, dann heißt die Empfehlung Halten, Optimieren oder Verkauf prüfen.</p>'))
      + '<details style="margin-top:10px"><summary style="cursor:pointer;font:600 12px Inter,sans-serif">Gesamtbewertung beim Ankauf lesen</summary>'
      + '<p class="dp-pa-p" style="margin-top:8px">' + _escClean(alt.gesamtbewertung || '') + '</p></details></div>';
  })();
  /* v2160 · N62.6 — der Steuer-Text des Modells gehoert AN die Tafel:
     die Tafel zeigt die Zahlen, der Text erklaert ihre Bewegung. */
  if (_siHtml && has(a.soll_ist_steuer)) {
    _siHtml += '<div class="dp-pa-card" style="margin-top:12px">' + sec('', I.bank, 'STEUERLICH: ANKAUF GEGEN HEUTE') + p(a.soll_ist_steuer) + '</div>';
  }
  /* v2160 · N62.6 — der Steuer-Reiter. Er steht immer: eine Analyse von
     vor v2160 hat das Feld nicht, und dann sagt er das, statt zu fehlen. */
  var pSt = sec('', I.bank, 'STEUERLICHE ZUSAMMENFASSUNG');
  pSt += has(a.steuer_zusammenfassung)
    ? '<div class="dp-pa-card">' + p(a.steuer_zusammenfassung)
      + '<div class="dp-pa-fuss">Eine Einordnung aus deinen Eingaben im Reiter Steuer — keine Steuerberatung. '
      + 'Lass sie von deinem Steuerberater bestätigen.</div></div>'
    : '<div class="dp-pa-card"><div class="dp-pa-fuss" style="margin-top:0">Diese Analyse wurde vor der steuerlichen '
      + 'Zusammenfassung erstellt. Beim nächsten Abruf steht sie hier.</div></div>';
  /* v2544 · der Steuerverlauf mit Wendepunkt (steuer-verlauf.js) auch hier - dieselben Zahlen wie im Tab Steuer */
  if (window.DpSteuerVerlauf) {
    pSt += '<div class="dp-pa-card" style="margin-top:12px">' + sec('', I.bank, 'STEUERVERLAUF · WANN DAS OBJEKT STEUERLICH POSITIV WIRD') + '<div data-dp-steuerverlauf="1"></div></div>';
    try { setTimeout(function () { window.DpSteuerVerlauf.mountAll(); }, 0); } catch (e) {}
  }

  try { setTimeout(window._dpLoadVerlauf, 0); } catch (e) {} /* v972a */
  /* v2017 - DER KOPF: Stand und Gueltigkeit, bevor irgendein Text kommt. */
  var _kopf = '';
  try {
     var _f = a._fuer || null;
     if (_f && _f.stand) {
       var _d = new Date(_f.stand);
       var _datum = isNaN(_d) ? '' : _d.toLocaleDateString('de-DE');
       var _tage = isNaN(_d) ? null : Math.max(0, Math.round((Date.now() - _d.getTime()) / 86400000));
       var _fremd = _f.objekt_id && window._currentObjKey && String(_f.objekt_id) !== String(window._currentObjKey);
       var _ab = _fremd ? null : _analyseAbweichung(_f.abdruck);
       var _klasse = 'ok', _text;
       if (_fremd) {
         _klasse = 'fremd';
         _text = '<b>Diese Analyse geh\u00f6rt zu einem anderen Objekt</b>'
               + (_f.adresse ? ' (' + _escClean(_f.adresse) + ')' : '')
               + ' \u2014 bitte neu abrufen, bevor du dich darauf st\u00fctzt.';
       } else if (_ab && _ab.length) {
         _klasse = 'alt';
         _text = '<b>Stand ' + _datum + '</b>' + (_tage ? ' (vor ' + _tage + ' Tagen)' : '')
               + ' \u2014 seitdem ' + (_ab.length === 1 ? 'hat sich ' : 'haben sich ')
               + '<b>' + _ab.map(_escClean).join(', ') + '</b> ge\u00e4ndert. '
               + 'Die Texte unten k\u00f6nnen \u00fcberholt sein \u2014 neu abrufen.';
       } else if (_ab) {
         _text = '<b>Stand ' + _datum + '</b>' + (_tage ? ' (vor ' + _tage + ' Tagen)' : '')
               + ' \u2014 die Zahlen haben sich seitdem nicht ge\u00e4ndert.';
       } else {
         /* Stempel ohne Abdruck: Alter ja, Gueltigkeit NICHT behauptet. */
         _klasse = 'unbekannt';
         _text = '<b>Stand ' + _datum + '</b>' + (_tage ? ' (vor ' + _tage + ' Tagen)' : '')
               + ' \u2014 ob sich die Zahlen seitdem ge\u00e4ndert haben, ist nicht feststellbar.';
       }
       /* v2945 · NEUERER MARKTBERICHT. Der Abdruck oben sieht nur Formularfelder.
          Gemessen an Westerfeldstr. 140: Analyse vom 13.10. zitiert im Reiter
          Lage & Markt den Bericht vom 04.10. (Marktwert 1.055.000 €, damals ohne
          Angebotsabschlag), der aktuelle Bericht vom 20.10. sagt 820.000 € - und
          der Kopf meldete nur „Zimmer, Eigenkapital, Wohneinheiten". */
       if (!_fremd && !isNaN(_d)) {
         var _mbH = _paMbNeuer(_d);
         if (_mbH) {
           if (_klasse === 'ok') _text = '<b>Stand ' + _datum + '</b>' + (_tage ? ' (vor ' + _tage + ' Tagen)' : '') + '.';
           if (_klasse !== 'fremd') _klasse = 'alt';
           _text += ' ' + _mbH;
         } else if (window.DpWertZielbild && window.DpWertZielbild.laden && !(window.DpWertZielbild.bericht && window.DpWertZielbild.bericht())) {
           /* Bericht noch nicht geladen: nachladen und den Satz anhaengen */
           try { window.DpWertZielbild.laden().then(function () {
             var h = _paMbNeuer(_d), el = document.querySelector('.dp-pa-stand[data-dp-pa-stand]');
             if (h && el && !el.querySelector('[data-dp-pa-mb]')) { el.insertAdjacentHTML('beforeend', ' ' + h); el.className = 'dp-pa-stand dp-pa-stand-alt'; }
           }); } catch (e) {}
         }
       }
       _kopf = '<div class="dp-pa-stand dp-pa-stand-' + _klasse + '" data-dp-pa-stand="1">' + _text + '</div>';
     } else {
       /* v2017 - ALTE Analysen ohne Stempel. Hier wird NICHTS behauptet:
          "aktuell" waere eine Aussage ohne Grundlage. */
       _kopf = '<div class="dp-pa-stand dp-pa-stand-unbekannt">'
             + 'Diese Analyse tr\u00e4gt noch kein Datum (vor Oktober 2026 erstellt). '
             + 'Beim n\u00e4chsten Abruf steht hier, von wann sie ist und ob sie noch gilt.</div>';
     }
  } catch (e) { _kopf = ''; }
  /* v2985 · ZWEI REITERLEISTEN. Marcel 27.10.2026: „Pilot-Analyse ist im Ankauf für
     Ankauf und im Bestand für Ankauf-Bestand-Zielbild-Vergleich, Steuer, Lage & Markt bzw.
     Wert & Marktpreis — aber vielleicht auch Exit-Strategien und Anschlussfinanzierung."
     Bestand = Ankauf-Stand vorhanden UND Ist-Ansicht. Die Soll-Ansicht zeigt die damalige
     Analyse mit den alten Reitern. Im Bestand entfallen Verhandlung & Offerte und Bank
     (Bankargumente stehen unter Anschlussfinanzierung), Staerken & Risiken stehen unter
     Risiko & Szenarien. */
  var _wertTab = '<button type="button" class="dp-pa-tab" id="dp-pa-tab-wert" style="display:none" onclick="_dpPaTab(\'wert\',this)">Wert &amp; Marktpreis</button>';
  var _wertPanel = panel('wert', '<div id="dp-pa-wert-body"></div>'   /* v2810 */
        + '<div id="dp-pa-verlauf-wrap" style="display:none;margin-top:16px"><h4 class="dp-wv-h" style="margin:0 0 8px">Verlauf · Marktberichte und Abrufe</h4>'
        + '<div class="dp-pa-card" id="dp-pa-verlauf-body"></div></div>', false);   /* v2842 */
  /* v2042 - nur wenn ein Ankauf-Stand vorliegt: ohne ihn gibt es
     nichts abzugleichen, und ein leerer Reiter verspricht etwas. */
  var _siTab = (_siHtml || _potHtml ? tab('si', 'Ankauf \u00b7 Bestand \u00b7 Zielbild', false) : '');   /* v2430 */
  /* v2840 · Marcel 22.10.2026: „für viele Kunden sehr unübersichtlich … oben einen Reiter:
     einfach und genau". Einfach = Kernaussagen + Klartext (wert-zielbild.js), Genau = alles
     Bisherige mit Sprungleiste. Ohne wert-zielbild.js bleibt es beim Bisherigen. */
  var _siPanel = (_siHtml || _potHtml ? panel('si', (function () {
        var g = _potHtml + (_potHtml && _siHtml ? '<div style="margin-top:12px"></div>' : '') + _siHtml;
        /* v2989 · Zielerreichung und Jahresstaende OBEN, in Einfach und Genau (jahresstaende.js) */
        var zh = '';
        try { zh = (_bestand && window.DpJahresstaende) ? '<div data-dp-ziel-host="1">' + window.DpJahresstaende.html() + '</div>' : ''; } catch (e) { zh = ''; }
        try { return zh + (window.DpWertZielbild ? window.DpWertZielbild.reiterHtml(g, { mitAnkauf: !!_siHtml, mitPot: !!_potHtml }) : g); } catch (e) { return zh + g; }
      })(), false) : '');   /* v2430 */
  /* v3016 · Marcel 28.10.2026: „WEG-Protokolle sollen ausgewertet werden … dafür in der
     Pilot-Analyse einen Reiter erstellen". Er liest die gespeicherte Auswertung der
     Unterlagen (#_dok_auswertung, unterlagen.js) und erscheint nur, wenn es eine gibt. */
  var _ulHtml = '';
  try { _ulHtml = window.DpUnterlagen ? window.DpUnterlagen.pilotReiterHtml() : ''; } catch (e) { _ulHtml = ''; }
  var _ulTab = _ulHtml ? tab('unterlagen', 'Unterlagen &amp; WEG', false) : '';
  var _ulPanel = _ulHtml ? panel('unterlagen', _ulHtml, false) : '';
  var _rail, _inhalt;
  if (_bestand) {
    _rail = tab('briefing', 'Briefing', true) + _siTab + _wertTab
      + tab('loc', 'Lage &amp; Markt', false) + tab('steuer', 'Steuer', false)
      + tab('anschluss', 'Anschlussfinanzierung', false) + tab('exit', 'Exit-Strategien', false)
      + tab('risk', 'Risiko &amp; Szenarien', false) + _ulTab;
    _inhalt = _ulPanel + panel('briefing', pB, true) + _siPanel + _wertPanel
      + panel('loc', pL, false) + panel('steuer', pSt, false)
      + panel('anschluss', pAF, false) + panel('exit', pEX, false)
      + panel('risk', pS + '<div style="margin-top:16px"></div>' + pR, false);
  } else {
    _rail = tab('briefing', 'Briefing', true) +
      tab('sr', 'St\u00e4rken &amp; Risiken', false) +
      tab('risk', 'Risiko &amp; Szenarien', false) +
      _ulTab +   /* v3016 */
      tab('loc', 'Lage &amp; Markt', false) +
      /* v2810 · Marktpreisindikation, Ertrags- und Sachwert gegenuebergestellt (wertvergleich.js);
         erscheint wie der Verlauf erst, wenn ein Marktbericht vorliegt */
      _wertTab +
      tab('verh', 'Verhandlung &amp; Offerte', false) +
      tab('bank', 'Bank', false) +
      tab('steuer', 'Steuer', false) +   /* v2160 */
      _siTab;
      /* v2171 · Hier stand seit v2155 der Reiter „Quellen". Marcel am
         13.10.2026: „nur unter der Pilot Analyse faellt der Reiter Quellen
         weg. ueberall soll das sonst bleiben woher die daten kommen."
         Die Quellen IN den Reitern (Lage & Markt, je Lagemerkmal) bleiben. */
      /* v2842 · Marcel 22.10.2026: „Marktbericht-Verlauf" und „Wert & Marktpreis" sind EIN Unterreiter -
         der Verlauf steht unter dem Wertvergleich (Panel 'wert'). */
    _inhalt = panel('briefing', pB, true) +
      panel('sr', pS, false) +
      panel('risk', pR, false) +
      _ulPanel +
      panel('loc', pL, false) +
      _wertPanel +
      panel('verh', pV, false) +
      panel('bank', pK, false) +
      panel('steuer', pSt, false) +
      _siPanel;
  }
  return '<div class="dp-pa-wrap' + (_bestand ? ' dp-pa-bestand' : '') + '" data-dp-pa-ansicht="' + (_bestand ? 'bestand' : 'ankauf') + '">' + _kopf +
    '<nav class="dp-pa-rail">' + _rail + '</nav>' +
    '<div class="dp-pa-content">' + _inhalt + '</div>' +
  '</div>';
}
/* v584-rail END */
/* v589-offmail */
function _dpFallbackCopy(el) {
  try { el.removeAttribute('hidden'); el.select(); document.execCommand('copy'); el.setAttribute('hidden', ''); } catch (e) {}
}
window._dpOfferteMail = function (action, btn) {
  try {
    var card = btn && btn.closest ? btn.closest('.dp-pa-offmail') : null; if (!card) return;
    var raw = card.querySelector('.dp-pa-mailraw');
    var subjEl = card.querySelector('.dp-pa-mailsubj');
    var text = raw ? raw.value : '';
    var subj = subjEl ? subjEl.value : '';
    if (action === 'copy') {
      var done = function () { var o = btn.textContent; btn.textContent = 'Kopiert \u2713'; setTimeout(function () { btn.textContent = o; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { _dpFallbackCopy(raw); done(); }); }
      else { _dpFallbackCopy(raw); done(); }
    } else {
      window.location.href = 'mailto:?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(text);
    }
  } catch (e) {}
};

/**
 * V25: Kompakter AI-Render für Tab Kennzahlen (s6).
 * Zeigt nur die wichtigsten Punkte: Empfehlung, Top-Stärken/Risiken, Insight.
 * Verwendet dieselbe JSON-Struktur wie _renderAIServerAnalysis.
 */
function _renderMiniAI(a) {
  var body = document.getElementById('ai-mini-body');
  if (!body) return;

  // V25.1: _miniEsc nutzt globalen _stripMd, damit auch im Mini-Block keine Sterne durchkommen
  function _miniEsc(s) { return _escClean(s); }
  function _miniEmpfBadge(emp) {
    var st = _dpEmpfStufe(emp);   /* v2985 · dieselbe Stelle wie das Briefing */
    return '<span class="ai-mini-empf" style="background:' + st.farbe + '">' + _esc(st.label) + '</span>';
  }
  function _miniList(arr, max) {
    if (!Array.isArray(arr) || !arr.length) return '<em style="opacity:.5">—</em>';
    return '<ul>' + arr.slice(0, max || 3).map(function(x){ return '<li>' + _miniEsc(x) + '</li>'; }).join('') + '</ul>';
  }

  var html = '';
  // Header-Zeile: Empfehlung + Gesamtbewertung
  html += '<div class="ai-mini-row ai-mini-headline">';
  html += _miniEmpfBadge(a.empfehlung || a.fazit_kurz);
  if (a.gesamtbewertung) {
    html += '<div class="ai-mini-summary">' + _miniEsc(a.gesamtbewertung) + '</div>';
  }
  html += '</div>';

  // Stärken + Risiken nebeneinander
  html += '<div class="ai-mini-grid">';
  html += '<div class="ai-mini-col ai-mini-col-good">';
  html += '<div class="ai-mini-col-title">✅ Top-Stärken</div>';
  html += _miniList(a.staerken, 3);
  html += '</div>';
  html += '<div class="ai-mini-col ai-mini-col-bad">';
  html += '<div class="ai-mini-col-title">⚠ Top-Risiken</div>';
  html += _miniList(a.risiken, 3);
  html += '</div>';
  html += '</div>';

  // DealPilot-Insight (Tool-Voice)
  if (a.dealpilot_insight) {
    html += '<div class="ai-mini-insight">';
    html += '<span class="ai-mini-insight-label">💡 DealPilot-Insight</span>';
    html += '<p>' + _miniEsc(a.dealpilot_insight) + '</p>';
    html += '</div>';
  }

  // Investor-Fit kompakt
  if (a.investor_fit && typeof a.investor_fit === 'object') {
    function _miniFitDot(value) {
      var v = String(value || '').toLowerCase();
      if (v.indexOf('ja') === 0) return '<span class="ai-mini-fit-dot good" title="Ja">●</span>';
      if (v.indexOf('nein') === 0) return '<span class="ai-mini-fit-dot bad" title="Nein">●</span>';
      return '<span class="ai-mini-fit-dot warn" title="Teilweise">●</span>';
    }
    html += '<div class="ai-mini-fit-row">';
    html += '<span class="ai-mini-fit-label">Investor-Fit:</span>';
    if (a.investor_fit.cashflow_investor)        html += _miniFitDot(a.investor_fit.cashflow_investor) + '<span class="ai-mini-fit-name">Cashflow</span>';
    if (a.investor_fit.wertsteigerungs_investor) html += _miniFitDot(a.investor_fit.wertsteigerungs_investor) + '<span class="ai-mini-fit-name">Wertsteigerung</span>';
    if (a.investor_fit.sicherheitsorientiert)    html += _miniFitDot(a.investor_fit.sicherheitsorientiert) + '<span class="ai-mini-fit-name">Sicherheit</span>';
    html += '</div>';
  }

  body.innerHTML = html;
}

/**
 * V25: AI-Analyse direkt aus Tab Kennzahlen heraus starten.
 * Ruft denselben Server-Endpoint wie _runAIServer, aktualisiert aber den
 * Mini-Block — und automatisch auch den Vollmodus in Tab s5.
 */
async function runMiniAI() {
  /* v950-guard: derselbe Endpoint, dieselbe Rechnung — derselbe Riegel.
   * Beide Knoepfe teilen sich das Flag: waehrend die grosse Analyse laeuft,
   * kann die Mini-Analyse nicht danebenfeuern und umgekehrt. */
  if (window._aiRunning) {
    try { console.warn('[v950] Pilot-Analyse läuft bereits — zweiter Aufruf verworfen.'); } catch (e) {}
    return;
  }
  window._aiRunning = true;
  try {
    return await _runMiniAIGuarded();
  } finally {
    window._aiRunning = false;
  }
}

async function _runMiniAIGuarded() {
  var btn = document.getElementById('ai-mini-run');
  var body = document.getElementById('ai-mini-body');
  if (!btn || !body) return;

  // Im Local-Mode (kein Backend) gibt's keine Server-KI → Hinweis zum Tab KI-Analyse
  if (typeof Auth !== 'undefined' && Auth.isApiMode && !Auth.isApiMode()) {
    if (typeof toast === 'function') toast('Server-KI nur im Backend-Modus — bitte Tab "Pilot-Analyse" für Client-Modus nutzen');
    if (typeof switchTab === 'function') switchTab(6); /* V51: KI-Analyse ist Tab 6 (V63.76: Quick-Check ist Standalone-View, Objekt=0) */
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ analysiere...';
  body.innerHTML =
    '<div class="ai-loading" style="padding:20px">' +
      '<div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>' +
      '<span style="margin-left:10px;color:rgba(255,255,255,.5);font-size:12px">' +
      'KI recherchiert Lage, Mietspiegel und Marktdaten…</span>' +
    '</div>';

  try {
    var payload = _buildAIPayload();

    // Track usage (analog _runAIServer)
    if (typeof Sub !== 'undefined' && Sub.isApiMode()) {
      try {
        await Sub.trackUsage('ai_analysis');
      } catch (e) {
        if (e.status === 403) {
          body.innerHTML = '<div class="ai-error">⚠ Pilot-Analyse-Limit erreicht. Bitte upgrade deinen Plan.</div>';
          btn.disabled = false; btn.textContent = 'Analyse starten';
          return;
        }
      }
    }

    var data = await Auth.apiCall('/ai/analyze', { method: 'POST', body: payload, timeout: 300000 });   /* v2986 · Websuche + zweiter Anlauf brauchen mehr als 120 s */
    if (data && data.analysis) {
      /* v2015 - stempeln, BEVOR gespeichert wird. Danach ist nicht
         mehr feststellbar, fuer welches Objekt sie gerechnet wurde. */
      window._aiAnalysis = _analyseStempeln(data.analysis);
      window._aiText = JSON.stringify(window._aiAnalysis, null, 2);
      _renderMiniAI(data.analysis);
      // Auch den großen Block in Tab s5 mit aktualisieren
      var aiContent = document.getElementById('ai-content');
      if (aiContent) aiContent.innerHTML = _renderAIServerAnalysis(data.analysis);
      if (typeof toast === 'function') toast('✓ Pilot-Analyse abgeschlossen');
      // V63.69: KI-Analyse persistieren
      if (typeof saveObj === 'function') {
        try { saveObj({ silent: true }); } catch(e) { console.warn('[ai] auto-save failed:', e); }
      }
    } else if (data && data.raw_text) {
      body.innerHTML = '<div class="ai-error">JSON-Parse fehlgeschlagen — Roh-Antwort siehe Tab "Pilot-Analyse".</div>';
      var ai = document.getElementById('ai-content');
      if (ai) ai.innerHTML = '<pre style="white-space:pre-wrap;font-size:11.5px">' + _esc(data.raw_text) + '</pre>';
    } else {
      throw new Error('Antwort vom Server enthielt keine Analyse.');
    }
  } catch (e) {
    body.innerHTML = '<div class="ai-error">' + _formatAIError(e) + '</div>';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Erneut analysieren';
  }
}

/**
 * v1360 · Frueher: „Alte Client-seitige KI-Analyse (Fallback, wenn Backend
 * keine KI-Recherche anbietet)". Sie rief `api.openai.com` DIREKT aus dem
 * Browser auf, mit einem Schluessel aus den Einstellungen.
 *
 * Drei Gruende, warum dieser Weg weg ist:
 *
 *   1. Er war unerreichbar. /ai/status meldet `available: true` fest
 *      verdrahtet, also lief immer _runAIServer.
 *   2. Er trug den vollstaendigen Analyse-Prompt im Klartext aus.
 *   3. Er lief am Backend vorbei - an jeder Zaehlung, jedem Limit und
 *      jedem Protokoll. Genau der Punkt, um den es in B21 geht.
 *
 * DIE FUNKTION IST NICHT VERLOREN: /ai/analyze nimmt seit V26 einen
 * `userApiKey` im Body entgegen (ai.js:214). Wer einen eigenen Schluessel
 * gepflegt hat, wird jetzt ueber den Server bedient - mit demselben
 * Schluessel, aber mit Zaehlung, Limit und dem Prompt, der den Server nie
 * verlaesst. `_buildAIPayload()` schickt ihn seit v1360 mit; andere Module
 * (copilot.js, ds2-ai.js) taten das laengst.
 *
 * Bleibt nur ein Fall offen: das Backend ist gar nicht erreichbar. Dann
 * gibt es eine klare Meldung statt eines stillen Umwegs - und in dem Fall
 * funktioniert ohnehin nichts anderes in der App.
 */
async function _runAIClient(btn) {
  var box = document.getElementById('ai-content');
  if (box) {
    box.innerHTML = '<div class="ai-error">\u26a0 Die Analyse ist gerade nicht erreichbar. ' +
      'Bitte pr\u00fcfe deine Verbindung und versuch es noch einmal.</div>';
  }
  if (btn) { btn.disabled = false; btn.textContent = '\u2726 Analyse starten'; }
}

// Portfolio collapse toggle

function togglePortfolio() {
  var content = document.getElementById('sb-portfolio-content');
  var arr = document.getElementById('sb-port-arrow');
  if (!content) return;
  var collapsed = content.style.display === 'none';
  content.style.display = collapsed ? 'block' : 'none';
  // V91: Portfolio klappt nach oben auf — Pfeil ▴ wenn zugeklappt (Hint: kommt von oben),
  //      ▾ wenn aufgeklappt (Hint: zuklappen)
  if (arr) arr.textContent = collapsed ? '\u25be' : '\u25b4';
}
window.togglePortfolio = togglePortfolio;

/* ═══════════════════════════════════════════════════════════════
   V39: Header-Dropdown "Mehr"
═══════════════════════════════════════════════════════════════ */

function toggleHdrMore(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  var menu = document.getElementById('hdr-more-menu');
  var btn = document.getElementById('hdr-more-btn');
  if (!menu || !btn) return;
  var isOpen = menu.classList.contains('hdr-more-open');
  if (isOpen) {
    closeHdrMore();
  } else {
    menu.classList.add('hdr-more-open');
    btn.setAttribute('aria-expanded', 'true');
    // Outside-click handler aktivieren (nur einmal binden)
    setTimeout(function() {
      document.addEventListener('click', _hdrMoreOutsideClick);
      document.addEventListener('keydown', _hdrMoreEscClose);
    }, 0);
  }
}

function closeHdrMore() {
  var menu = document.getElementById('hdr-more-menu');
  var btn = document.getElementById('hdr-more-btn');
  if (menu) menu.classList.remove('hdr-more-open');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', _hdrMoreOutsideClick);
  document.removeEventListener('keydown', _hdrMoreEscClose);
}

function _hdrMoreOutsideClick(e) {
  var wrap = document.getElementById('hdr-more-wrap');
  if (!wrap || wrap.contains(e.target)) return;
  closeHdrMore();
}
function _hdrMoreEscClose(e) {
  if (e.key === 'Escape') closeHdrMore();
}

window.toggleHdrMore = toggleHdrMore;
window.closeHdrMore  = closeHdrMore;

/* ═══════════════════════════════════════════════════════════════
   V41: Sidebar minimierbar — Standard: minimiert
═══════════════════════════════════════════════════════════════ */
function toggleSidebarV41() {
  // V61: No-op — Sidebar-Collapse ist deaktiviert. Funktion bleibt für Backwards-Compat.
}
window.toggleSidebarV41 = toggleSidebarV41;

// Beim Laden: Default = collapsed (außer User hat schon explizit aufgeklappt)
(function() {
  function applySidebarState() {
    var wrap = document.querySelector('.app-wrap');
    if (!wrap) return;
    // V61: Sidebar bleibt IMMER aufgeklappt — keine Collapse-Funktion mehr
    wrap.classList.remove('sb-collapsed');
    try { localStorage.removeItem('dp_sidebar_collapsed'); } catch(e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySidebarState);
  } else {
    setTimeout(applySidebarState, 0);
  }
})();

/* ═══════════════════════════════════════════════════════════════
   V43: Bottom-Sheet für Aktionen
   - Burger-Button unten rechts öffnet
   - Bottom-Sheet klappt von unten hoch
   - Icons werden via SVG-Lib gerendert
═══════════════════════════════════════════════════════════════ */
function bsheetToggle() {
  var overlay = document.getElementById('bsheet-overlay');
  if (!overlay) return;
  var open = overlay.classList.toggle('bsheet-open');
  document.body.classList.toggle('bsheet-body-locked', open);
  if (open) {
    // ESC zum Schließen
    document.addEventListener('keydown', _bsheetEscHandler);
    // Nach Animation: aktiven View highlighten
    _bsheetSyncActive();
  } else {
    document.removeEventListener('keydown', _bsheetEscHandler);
  }
}
function _bsheetEscHandler(e) { if (e.key === 'Escape') bsheetToggle(); }

function _bsheetSyncActive() {
  // Welcher View ist aktiv? all-objects oder single
  var aoMain = document.getElementById('all-objects-main');
  var allActive = aoMain && aoMain.style.display === 'block';
  document.querySelectorAll('.bsheet-tile[data-bsheet-view]').forEach(function(b) {
    var v = b.getAttribute('data-bsheet-view');
    var isActive = (allActive && v === 'all') || (!allActive && v === 'single');
    b.classList.toggle('bsheet-tile-active', isActive);
  });
}

function bsheetAction(action) {
  // Erst Sheet zumachen, dann Aktion ausführen
  bsheetToggle();
  setTimeout(function() {
    switch (action) {
      case 'cockpit':       if (typeof setMainView === 'function') setMainView('dashboard'); break; /* v844-cockpit-handler */
      case 'view-single':   if (typeof setMainView === 'function') setMainView('single'); break;
      case 'view-all':      if (typeof setMainView === 'function') setMainView('all'); break;
      case 'quickcheck':    if (typeof enterQuickCheckMode === 'function') enterQuickCheckMode(); break;
      case 'marktbericht':  if (typeof openMarktberichtView === 'function') openMarktberichtView(); break;
      case 'new':           if (typeof newObj === 'function') newObj(); break;
      case 'trackrec':      if (typeof showTrackRecordView === 'function') showTrackRecordView(); break;
      case 'portfolio-strategy': if (typeof showPortfolioStrategyView === 'function') showPortfolioStrategyView(); break;
      case 'bankexport':    if (typeof showBankexportView === 'function') showBankexportView(); break;
      case 'pdf':           if (typeof exportPDF === 'function') exportPDF(); break;
      case 'csv':           if (typeof exportCSV === 'function') exportCSV(); break;
      case 'settings':      if (typeof showSettings === 'function') showSettings(); break;
      case 'help':          if (typeof showHelp === 'function') showHelp(); break;
      case 'feedback':      if (typeof showFeedback === 'function') showFeedback(); break;
    }
  }, 220);
}

/**
 * V43: Bottom-Sheet Icons rendern (via Icons-Lib).
 * Wird beim DOM-Load aufgerufen.
 */
function _bsheetRenderIcons() {
  if (!window.Icons) return;
  var map = {
    single: 'house', all: 'folder', quickcheck: 'sparkles', new: 'plus', market: 'fileText',
    trackrec: 'trophy', bankexport: 'bank', pdf: 'fileText', csv: 'fileText',
    settings: 'settings', help: 'help', feedback: 'feedback'
  };
  document.querySelectorAll('.bsheet-tile-ico[data-icon]').forEach(function(el) {
    var key = el.getAttribute('data-icon');
    var iconName = map[key];
    if (iconName && Icons[iconName]) {
      el.innerHTML = Icons[iconName]({ size: 22 });
    } else if (Icons.box) {
      el.innerHTML = Icons.box({ size: 22 });
    }
  });
}

window.bsheetToggle = bsheetToggle;
window.bsheetAction = bsheetAction;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _bsheetRenderIcons);
} else {
  setTimeout(_bsheetRenderIcons, 50);
}

/* ═══════════════════════════════════════════════════════════════
   V46: Aktionen-Akkordeon in der Sidebar (klappt NACH OBEN aus)
   - Kein Overlay mehr (Bottom-Sheet entfernt)
   - Liste klappt vom Trigger aus nach oben
   - Klick außerhalb schließt
═══════════════════════════════════════════════════════════════ */
function sbActionsToggle() {
  var acc = document.getElementById('sb-actions-accordion');
  var btn = document.getElementById('sb-actions-trigger-btn');
  if (!acc) return;
  var open = acc.classList.toggle('sb-actions-open');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');

  if (open) {
    _sbActionsDock();
    _sbActionsRenderIcons();
    _sbActionsSyncActive();
    window.addEventListener('resize', _sbActionsDock);
    setTimeout(function() {
      document.addEventListener('click', _sbActionsOutsideClick);
      document.addEventListener('keydown', _sbActionsEscHandler);
    }, 10);
  } else {
    acc.style.removeProperty('bottom');
    acc.style.removeProperty('max-height');
    var _inner = acc.querySelector('.sb-actions-accordion-inner');
    if (_inner) _inner.style.removeProperty('max-height');
    window.removeEventListener('resize', _sbActionsDock);
    document.removeEventListener('click', _sbActionsOutsideClick);
    document.removeEventListener('keydown', _sbActionsEscHandler);
  }
}

/* v647 — Andocken je nach tatsaechlicher Positionierung.

   BEFUND (gemessen, 390x844, Drawer offen): Das Panel klappt korrekt nach
   OBEN auf (top 58, Inhalt bis 591, Trigger bei 709) — der Kommentar in
   ui.js stimmt also. Der Fehler sass woanders: unter dem sichtbaren Menue
   lag eine 114px hohe TOTZONE. elementFromPoint(180, 621) lieferte dort
   #sb-actions-accordion statt der Objektliste darunter.

   Ursache: das inline gesetzte bottom trug 'important'. Inline-!important
   schlaegt JEDE Stylesheet-Regel — auch das bottom:auto !important aus
   v642, das im Drawer den fixed-Overlay-Modus herstellt. Damit galten
   gleichzeitig top:58px UND bottom:139.5px auf einem fixed-Element mit
   height:auto: die Box wurde auf 647px gestreckt, der Inhalt blieb 533px.
   Der Ueberhang schluckte Klicks und schloss das Menue nicht einmal —
   _sbActionsOutsideClick ueberspringt alles, was in acc liegt.

   Fix: bottom nur setzen, wenn das Panel wirklich absolut in der Leiste
   haengt. Im fixed-Overlay (<=768px) und im statischen Rail-Modus
   (eingeklappte Leiste) macht das CSS die Position — dort wird das
   Inline-bottom entfernt statt gesetzt. */
function _sbActionsDock() {
  try {
    var acc = document.getElementById('sb-actions-accordion');
    var btn = document.getElementById('sb-actions-trigger-btn');
    if (!acc) return;
    var inner = acc.querySelector('.sb-actions-accordion-inner');
    var cs = getComputedStyle(acc);
    if (cs.position === 'fixed') {
      /* Drawer-Overlay: das CSS deckelt mit calc(100dvh - 58px - 110px). Die
         110px sind geraten — bei 390x556 lag die Unterkante des Menues bei
         446px, der Trigger begann aber schon bei 409px. Deshalb hier gegen die
         GEMESSENE Trigger-Oberkante deckeln statt gegen eine feste Zahl. */
      acc.style.removeProperty('bottom');
      if (btn) {
        var topPx = parseFloat(cs.top) || 0;
        var bRect = btn.getBoundingClientRect();
        /* v2576: im Handy-Querformat steht das Menue NEBEN der Leiste
           (style.css v2576) - dort deckelt die Fensterhoehe, nicht der
           Ausloeser. Gegen den Ausloeser blieben 232 px fuer 687 px Inhalt. */
        var neben = (parseFloat(cs.left) || 0) >= bRect.right;
        var avail = neben
          ? Math.max(160, Math.round(window.innerHeight - topPx - 8))
          : Math.max(160, Math.round(bRect.top - topPx - 8));
        acc.style.setProperty('max-height', avail + 'px', 'important');
        if (inner) inner.style.setProperty('max-height', avail + 'px', 'important');
      }
      return;
    }
    if (cs.position !== 'absolute') { acc.style.removeProperty('bottom'); return; }
    var sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!btn || !sidebar) return;
    var bottomPx = (sidebar.getBoundingClientRect().bottom - btn.getBoundingClientRect().top) + 4;
    // 'important' bleibt noetig: aside.sidebar .sb-actions-accordion setzt bottom:86px !important
    acc.style.setProperty('bottom', bottomPx + 'px', 'important');
  } catch (e) { /* fallback auf das CSS-bottom */ }
}

function _sbActionsOutsideClick(e) {
  var acc = document.getElementById('sb-actions-accordion');
  var btn = document.getElementById('sb-actions-trigger-btn');
  if (!acc) return;
  if (acc.contains(e.target) || (btn && btn.contains(e.target))) return;
  /* v2216 · Marcel 14.10.2026: „wir haben definiert, dass das Aktionsmenü
     geschlossen wird, wenn wir ein Objekt ausgewählt haben. In der Desktop-
     Version brauchen wir das nicht." Auf breiten Bildschirmen bleibt es beim
     Objektwechsel offen; am Handy (bis 900 px) schließt es wie bisher. */
  try {
    if (window.matchMedia('(min-width: 901px)').matches && e.target && e.target.closest && e.target.closest('.sb-card')) return;
  } catch (x) {}
  if (acc.classList.contains('sb-actions-open')) sbActionsToggle();
}
function _sbActionsEscHandler(e) {
  if (e.key === 'Escape') sbActionsToggle();
}

function _sbActionsSyncActive() {
  var aoMain = document.getElementById('all-objects-main');
  var allActive = aoMain && aoMain.style.display === 'block';
  document.querySelectorAll('.sb-act-item[data-act]').forEach(function(b) {
    var v = b.getAttribute('data-act');
    var isActive = (allActive && v === 'view-all') || (!allActive && v === 'view-single');
    b.classList.toggle('sb-act-active', isActive);
  });
}

function _sbActionsRenderIcons() {
  if (!window.Icons) return;
  var map = {
    single: 'house', all: 'folder', quickcheck: 'sparkles', new: 'plus', market: 'fileText',
    trackrec: 'trophy', bankexport: 'bank', cockpit: 'barChart', /* v844-cockpit-icon */
    pdf: 'fileText',
    csv: 'fileText',
    settings: 'settings',
    // V63.73: Help + Feedback in der Sidebar
    help: 'help',
    feedback: 'feedback',
    // V63.46: Hub-Icons (eigene SVGs siehe icons.js)
    'import-hub': 'upload',
    'export-hub': 'download',
    // V63.44: alte Direkt-Aktionen (Legacy, nicht mehr in Sidebar)
    'import-excel': 'upload',
    'import-json':  'upload',
    'export-json':  'download',
    'export-csv':   'download'
  };
  document.querySelectorAll('.sb-act-ico[data-icon]').forEach(function(el) {
    if (el.querySelector('svg')) return;     // schon gerendert
    var key = el.getAttribute('data-icon');
    var iconName = map[key];
    if (iconName && Icons[iconName]) el.innerHTML = Icons[iconName]({ size: 18 });
  });
}

function sbActionsAction(action) {
  // Akkordeon zumachen, dann Aktion ausführen
  if (document.getElementById('sb-actions-accordion').classList.contains('sb-actions-open')) {
    sbActionsToggle();
  }
  setTimeout(function() {
    /* v2216 · Nach dem Marktbericht blieb jede weitere Aktion „ohne Wirkung":
       Track Record, Bankexport oder ein neues Objekt öffneten sich HINTER der
       Marktbericht-Ansicht (body.mb-standalone-active blieb stehen). Vor jeder
       Aktion, die eine Ansicht wechselt, wird er deshalb leise geschlossen;
       Fenster wie Einstellungen oder Import lassen ihn stehen. */
    try {
      var _nurFenster = ['marktbericht', 'settings', 'help', 'feedback', 'hub-import', 'hub-export', 'pdf', 'csv', 'export-csv', 'import-excel', 'import-json', 'export-json'];
      if (_nurFenster.indexOf(action) < 0 && document.body.classList.contains('mb-standalone-active') && typeof window._mbLeiseSchliessen === 'function') {
        window._mbLeiseSchliessen();
        if (action === 'new' && typeof setMainView === 'function') setMainView('single');
      }
    } catch (e) {}
    switch (action) {
      case 'dashboard':   if (typeof setMainView === 'function') setMainView('dashboard'); break;
      case 'cockpit':       if (typeof setMainView === 'function') setMainView('dashboard'); break; /* v844-cockpit-handler */
      case 'view-single':   if (typeof setMainView === 'function') setMainView('single'); break;
      case 'view-all':      if (typeof setMainView === 'function') setMainView('all'); break;
      case 'quickcheck':    if (typeof enterQuickCheckMode === 'function') enterQuickCheckMode(); break;
      case 'marktbericht':  if (typeof openMarktberichtView === 'function') openMarktberichtView(); break;
      case 'new':           if (typeof newObj === 'function') newObj(); break;
      case 'trackrec':      if (typeof showTrackRecordView === 'function') showTrackRecordView(); break;
      case 'portfolio-strategy': if (typeof showPortfolioStrategyView === 'function') showPortfolioStrategyView(); break;
      case 'bankexport':    if (typeof showBankexportView === 'function') showBankexportView(); break;
      case 'pdf':           if (typeof exportPDF === 'function') exportPDF(); break;
      case 'csv':           if (typeof exportCSV === 'function') exportCSV(); break;
      case 'export-csv':    if (typeof exportCSV === 'function') exportCSV(); break;
      // V63.46: Import/Export-Hubs (Modal mit Karten)
      case 'hub-import':    if (typeof openImportHub === 'function') openImportHub(); break;
      case 'hub-export':    if (typeof openExportHub === 'function') openExportHub(); break;
      // Legacy direkte Aktionen (für externe Aufrufe noch verfügbar)
      case 'import-excel':  if (typeof triggerImportExcel === 'function') triggerImportExcel(); break;
      case 'import-json':   if (typeof triggerImportJson === 'function') triggerImportJson(); break;
      case 'export-json':   if (typeof exportAllObjectsJson === 'function') exportAllObjectsJson(); break;
      case 'settings':      if (typeof showSettings === 'function') showSettings(); break;
      case 'help':          if (typeof showHelp === 'function') showHelp(); break;
      case 'feedback':      if (typeof showFeedback === 'function') showFeedback(); break;
    }
  }, 220);
}

window.sbActionsToggle = sbActionsToggle;
window.sbActionsAction = sbActionsAction;

/* v648: Die zweite toggleMobileSidebar-Fassung (V63.44) ist ersatzlos raus.
   Sie setzte .sb-mobile-open auf dem FALSCHEN Element (#sidebar statt
   .app-wrap) und schaltete #mobile-overlay statt #sb-backdrop. Wirksam war
   sie ohnehin nie: ui.js laedt vor main.js, main.js definierte sie danach
   erneut. Genau so entstanden die vier parallelen Umschalt-Mechaniken.
   Kanonisch ist ab jetzt main.js: .app-wrap.sb-mobile-open + #sb-backdrop. */

// Mobile-Sidebar schließt sich nach Aktion
(function() {
  function closeMobileSidebarOnAction() {
    // v648: Das Drawer-Band reicht jetzt bis 900px (Tablet hoch), nicht mehr
    // nur bis 768px — sonst blieb der Drawer auf dem iPad nach Objektwahl offen.
    if (window.innerWidth > 900) return;
    // v634-autoclose: Der echte Drawer-Toggle ist .app-wrap.sb-mobile-open (main.js),
    // NICHT .sidebar.sb-mobile-open -> hier beide Mechanismen sauber schliessen,
    // sonst bleibt der Drawer nach Objektwahl/Tab-Klick offen.
    var aw = document.querySelector('.app-wrap');
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('mobile-overlay');
    var bd = document.getElementById('sb-backdrop');
    if (aw && aw.classList.contains('sb-mobile-open')) {
      aw.classList.remove('sb-mobile-open');
      if (bd) bd.style.display = 'none';
      document.body.style.overflow = '';
    }
    if (sb && sb.classList.contains('sb-mobile-open')) {
      sb.classList.remove('sb-mobile-open');
    }
    if (ov) ov.classList.remove('active');
    /* ── v1904a · DER KNOPF MUSS MITGEHEN ────────────────────────────────
       Marcel am 06.10.2026: „das ‚X' neben Neues Objekt sieht auch nicht gut
       aus. Es ruft ja auch die Menüleiste auf."

       GEMESSEN bei 390 px, „Heute", Bedienweg Menue auf -> Aktionen ->
       Einzelobjekt antippen:

         vor der Aktion   .app-wrap sb-mobile-open   #hdr-mobile-menu active
         nach der Aktion  .app-wrap                  #hdr-mobile-menu active

       Die Schublade ist zu, der Knopf zeigt weiter das X. Ein X heisst
       „schliessen" — hier OEFFNET es. Genau der Satz, den Marcel gesagt hat.

       URSACHE: `toggleMobileSidebar()` (main.js:365) fuehrt den Zustand an ZWEI
       Stellen - `.app-wrap.sb-mobile-open` UND `#hdr-mobile-menu.active`. Diese
       Routine hier kannte nur die erste. Sie laeuft bei jedem Klick auf
       `.sb-act-item`, `.tab` und `.sb-card`, also auf dem haeufigsten Weg
       ueberhaupt aus dem Menue heraus.

       > Ein Zustand, der an zwei Stellen steht, muss an beiden Stellen
       > zurueckgenommen werden - sonst zeigt das Bild etwas anderes an als
       > die Mechanik tut. */
    var hmb = document.getElementById('hdr-mobile-menu');
    if (hmb) hmb.classList.remove('active');
  }
  // V100: Expose damit andere Stellen (z.B. loadSaved nach Card-Klick) das auch nutzen können
  window.closeMobileSidebarOnAction = closeMobileSidebarOnAction;

  // Auto-close beim Klick auf einen Tab oder eine Sidebar-Aktion
  // V100: + .sb-card (Object-Auswahl in der Liste) — sonst bleibt das Burger-Menü offen
  //       wenn der User auf einer Karte tippt um's Objekt zu laden.
  function attachListeners() {
    document.querySelectorAll('.sb-act-item, .tab, .sb-card').forEach(function(el) {
      if (el.dataset.dpMobileCloseBound) return;  // doppelt-Bind verhindern
      el.dataset.dpMobileCloseBound = '1';
      el.addEventListener('click', closeMobileSidebarOnAction);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      attachListeners();
    });
  } else {
    setTimeout(attachListeners, 200);
  }
  // V100: Nach jedem renderSaved() müssen die neuen .sb-cards auch den Listener bekommen.
  //       Wir hooken in's Window-Event 'dp:saved-rendered' das renderSaved feuern soll.
  //       Als Fallback: alle 1.5s die Listener neu attachen (idempotent durch dataset-Check).
  setInterval(attachListeners, 1500);
})();

/* ═══════════════════════════════════════════════════════════════
   V63.99: Toggle "Küche im Kaufpreis enthalten"
   Zeigt/verbirgt das Eingabefeld für den Küchen-Wert.
   V113: Wert wird automatisch in das Möblierung-Feld übertragen
   damit die User-konfigurierbare Laufzeit (5/8/10/15 Jahre) greift
   und die Küche im Steuerformular Feld 6 ("bewegliche Wirtschaftsgüter")
   korrekt erscheint. Der oninput-Handler von #kp_kueche pflegt den Sync
   nach jeder Änderung.
═══════════════════════════════════════════════════════════════ */
function toggleKuecheKp() {
  var cb = document.getElementById('kueche_im_kp');
  var wrap = document.getElementById('kueche_kp_wrap');
  if (!cb || !wrap) return;
  if (cb.checked) {
    wrap.style.display = '';
    // V113: Beim Aktivieren initial syncen (auch wenn kp_kueche noch leer/0)
    syncKuecheToMoebl();
  } else {
    wrap.style.display = 'none';
    // Wert leeren wenn deaktiviert (sonst rechnet calc weiter mit altem Wert)
    var inp = document.getElementById('kp_kueche');
    if (inp) inp.value = '';
    // V116: Marcels Wunsch — wenn die Checkbox deaktiviert wird, soll der
    //   Möblierung-Bereich KOMPLETT auf Default zurück: Wert leeren UND
    //   "In Steuer-Werbungskosten übernehmen"-Checkbox abschalten. Vorher
    //   wurde nur geleert wenn der Sync der Quell-Wert war.
    var moebl = document.getElementById('moebl');
    if (moebl) {
      moebl.value = '';
      if (moebl.dataset) delete moebl.dataset.dpAutoFromKueche;
    }
    var moeblTax = document.getElementById('moebl_tax_active');
    if (moeblTax) moeblTax.checked = false;
    // V116: Marcel hat ausdrücklich auch san_tax_active erwähnt — beide
    //   Steuer-Werbungskosten-Checkboxen zurück auf Default (= aus) damit
    //   der User bei einem neuen Objekt nicht versehentlich Steuer-Effekte
    //   aus alten Sessions mitgeschleppt bekommt.
    var sanTax = document.getElementById('san_tax_active');
    if (sanTax) sanTax.checked = false;
    if (typeof calc === 'function') calc();
  }
}

/**
 * V113: Synchronisiert den Wert von #kp_kueche → #moebl wenn die Checkbox
 *   "Bewegliche Wirtschaftsgüter im Kaufpreis enthalten" aktiv ist.
 *   Aktiviert auch automatisch "moebl_tax_active" damit der Wert in der
 *   Steuerberechnung berücksichtigt wird (Marcels Wunsch).
 *
 *   Setzt das `data-dp-auto-from-kueche="1"` Flag damit beim Deaktivieren
 *   der Checkbox erkannt wird ob das Möbel-Feld aus diesem Sync stammt
 *   (dann wird's geleert) oder vom User manuell gesetzt wurde (bleibt).
 */
function syncKuecheToMoebl() {
  var cb = document.getElementById('kueche_im_kp');
  if (!cb || !cb.checked) return;
  var src = document.getElementById('kp_kueche');
  var moebl = document.getElementById('moebl');
  if (!src || !moebl) return;
  var val = src.value || '';
  moebl.value = val;
  if (moebl.dataset) moebl.dataset.dpAutoFromKueche = '1';
  // moebl_tax_active automatisch aktivieren — sonst landet der Wert nicht im Steuermodul
  var moeblTax = document.getElementById('moebl_tax_active');
  if (moeblTax && !moeblTax.checked && val && parseFloat(val.replace(',', '.')) > 0) {
    moeblTax.checked = true;
    /* v2261: auch das sichtbare, gespeicherte Kästchen - sonst ist der Haken nach dem Laden weg */
    try { var _invCb2 = document.getElementById('inv_tax_active'); if (_invCb2) _invCb2.checked = true; } catch (e) {}
  }
}
window.toggleKuecheKp = toggleKuecheKp;
window.syncKuecheToMoebl = syncKuecheToMoebl;

/* ─────────────────────────────────────────────────────────────────
 * V291.1-ui-noops-applied
 *
 * Die alten Funktionen toggleKuecheKp() und syncKuecheToMoebl()
 * werden hier als No-Ops überschrieben.
 *
 * Hintergrund: Bis V291 wurden Bewegliche Wirtschaftsgüter über eine
 * Checkbox + Input (#kueche_im_kp / #kp_kueche) eingegeben. Ab V291.1
 * gibt es nur noch die Inventar-Detail-Box (#inv_kueche etc.).
 * Die alten DOM-Elemente existieren nicht mehr, also würden die
 * Original-Funktionen TypeErrors werfen.
 *
 * Falls diese Funktionen woanders aufgerufen werden (PDF-Generator,
 * alte Event-Handler), passiert hier einfach nichts — keine Errors.
 * ───────────────────────────────────────────────────────────────── */
window.toggleKuecheKp = function(){
  /* No-Op — Checkbox+Input wurden in V291.1 entfernt.
     Eingabe erfolgt jetzt direkt in der Inventar-Detail-Box. */
};

window.syncKuecheToMoebl = function(){
  /* No-Op — Sync-Logik ist in V291 inventar-sync.js (window._syncInventarToMoebl).
     Wir delegieren defensiv falls jemand das hier noch aufruft: */
  if (typeof window._syncInventarToMoebl === 'function') {
    try { window._syncInventarToMoebl(); } catch(e) {}
  }
};

/* v569-icon: Einzelobjekt-Icon single->house */

/* v790-buildpayload-global: Hilfe-Agent nutzt denselben Objekt-Kontext wie Pilot-Analyse */
try { window._buildAIPayload = _buildAIPayload; } catch (e) {}

/* ===== v972b: Marktbericht-Verlauf (Fix + KI-Text) ===== */
/* v972b: Marktbericht-Verlauf - Lesbarkeit theme-aware (heller/dunkler Hintergrund) + KI-Trend-Text.
   Chart via window.Chart (Cockpit-Stil). Farben aus der ECHTEN Kartenhelligkeit (getComputedStyle).
   KI-Text: POST /marktbericht/verlauf-text (1 L Kerosin, Proxy+mb-backend). */
(function () {
  'use strict';
  var METRICS = [
    /* v2947 (N78.2) \u00b7 \u201enach Abschlag" fuehrt nur Berichte MIT Abschlag. Berichte vor v2367
       trugen das Angebotsniveau; im selben Zug verglichen ergab das 1.055.000 -> 820.000 \u20ac
       \u201e-22,3 %" (Westerfeldstr. 140), eine Methodenaenderung, kein Preissturz. Ueber alle
       Berichte vergleichbar ist die Zeile \u201eohne Abschlag". */
    { key: 'mpi_nach_abschlag', label: 'Marktpreisindikation nach Abschlag',   color: '#C9A84C', fmt: function (v) { return _dpVEur(v) + ' \u20ac'; } },
    /* v2842 · ohne Abschlag und der Abschlag selbst - sonst sieht der Wechsel auf den Abschlag (v2367) aus wie ein Preissturz */
    { key: 'mpi_ohne_abschlag', label: 'Marktpreisindikation ohne Abschlag', color: '#b8932f', fmt: function (v) { return _dpVEur(v) + ' \u20ac'; } },
    { key: 'abschlag_pct', label: 'Abschlag auf Angebotspreise', color: '#8b8678', fmt: function (v) { return v > 0 ? _dpVNum(v, 1) + ' %' : 'kein'; } },
    /* v2947 (N78.5) · Bericht-Werte heissen nach ihrer Herkunft: der Score des Berichts ist nicht
       der DealPilot-Score des Objekts (85 gegen 78), die Rendite des Berichts rechnet ohne
       Zusatzeinnahmen (7,03 % gegen 7,23 % mit 1.080 €). */
    { key: 'deal_score',   label: 'Score laut Marktbericht', color: '#3FA56C', fmt: function (v) { return Math.round(v) + ' / 100'; } },
    { key: 'micro_score',  label: 'Lage (Mikro)', color: '#9b6fd4', fmt: function (v) { return Math.round(v) + ' / 100'; } },
    { key: 'macro_score',  label: 'Lage (Makro)', color: '#5a7fd4', fmt: function (v) { return Math.round(v) + ' / 100'; } },
    { key: 'price_cagr_pct', label: 'Markt (Wertentw.)', color: '#c98a2f', fmt: function (v) { return _dpVNum(v, 1) + ' %'; } },
    { key: 'gross_yield_pct', label: 'Bruttomietrendite laut Marktbericht (ohne Zusatzeinnahmen)', color: '#3f8ea5', fmt: function (v) { return _dpVNum(v, 1) + ' %'; } },
    { key: 'rent_multiplier', label: 'Faktor', color: '#8a8f5a', fmt: function (v) { return _dpVNum(v, 1) + '\u00d7'; } }
  ];

  function _dpVEur(v) { try { return new Intl.NumberFormat('de-DE').format(Math.round(v)); } catch (e) { return String(v); } }
  function _dpVNum(v, d) { var n = Number(v); return isFinite(n) ? n.toFixed(d).replace('.', ',') : '\u2013'; }
  function _dpVDate(s) { try { var d = new Date(s); var p = function (x) { return (x < 10 ? '0' : '') + x; };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '. ' + p(d.getHours()) + ':' + p(d.getMinutes()); } catch (e) { return '\u2013'; } }
  function _gv(id) { var el = document.getElementById(id); return el ? String(el.value == null ? '' : el.value).trim() : ''; }
  function _numDe(s) { var n = parseFloat(String(s == null ? '' : s).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; }

  // echte Hintergrundhelligkeit der Karte -> hell/dunkel (statt Skin raten)
  function _dpVIsLight(el) {
    try {
      var node = el; for (var i = 0; i < 6 && node; i++) {
        var c = getComputedStyle(node).backgroundColor || '';
        var m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
        if (m && (m[4] === undefined || parseFloat(m[4]) > 0.2)) {
          var lum = 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3];
          return lum > 140;
        }
        node = node.parentElement;
      }
    } catch (e) {}
    return true; // Default: hell (Pilot-Analyse ist i.d.R. hell)
  }

  function _dpVActiveMetrics(hist) {
    return METRICS.filter(function (m) {
      var n = 0; hist.forEach(function (h) { if (h[m.key] != null && isFinite(Number(h[m.key]))) n++; });
      return n >= (m.key === 'mpi_nach_abschlag' ? 1 : 2);   /* v2947 · der neueste Wert nach Abschlag bleibt sichtbar */
    });
  }

  window._dpVerlaufAbgleich = function (hist) {
    var snap = hist[hist.length - 1] || {}, diffs = [];
    var snWfl = (snap.living_area != null) ? Number(snap.living_area) : null, curWfl = _numDe(_gv('wfl'));
    if (snWfl != null && curWfl != null && Math.abs(snWfl - curWfl) > 0.6)
      diffs.push('Wohnfl\u00e4che ' + _dpVNum(snWfl, 0) + ' \u2192 jetzt ' + _dpVNum(curWfl, 0) + ' m\u00b2');
    var snBj = (snap.build_year != null) ? parseInt(snap.build_year, 10) : null, curBj = _numDe(_gv('baujahr'));
    if (snBj && curBj && snBj !== curBj) diffs.push('Baujahr ' + snBj + ' \u2192 jetzt ' + Math.round(curBj));
    var checked = (snWfl != null && curWfl != null) || (snBj && curBj);
    if (!checked) return '<div class="dpv-abgl dpv-abgl-neutral"><span class="dpv-abgl-ic">\u25CB</span>Objektdaten nicht vergleichbar (Felder leer).</div>';
    if (!diffs.length) return '<div class="dpv-abgl dpv-abgl-ok"><span class="dpv-abgl-ic">\u2713</span>Neuester Bericht basiert auf den aktuellen Objektdaten (Wohnfl\u00e4che, Baujahr).</div>';
    return '<div class="dpv-abgl dpv-abgl-warn"><span class="dpv-abgl-ic">\u26A0</span>Objektdaten weichen vom neuesten Bericht ab: ' + diffs.join(' \u00b7 ') + '. Ein neuer Marktbericht w\u00e4re aussagekr\u00e4ftiger.</div>';
  };

  window._dpVerlaufHtml = function (hist) {
    var mets = _dpVActiveMetrics(hist);
    if (!mets.length) return '<p class="dp-pa-p" style="color:#8b8678">Keine vergleichbaren Kennzahlen in den Berichten.</p>';
    var chips = mets.map(function (m, i) {
      return '<button type="button" class="dpv-chip' + (i < 2 ? ' on' : '') + '" data-k="' + m.key + '" style="color:' + m.color + '"><span class="dpv-dot"></span>' + m.label + '</button>';
    }).join('');
    var head = '<tr><th>Kennzahl</th>' + hist.map(function (h, i) { return '<th>' + (i + 1) + '. \u00b7 ' + _dpVDate(h.created_at) + '</th>'; }).join('') + '<th class="dpv-dcol">\u0394 gesamt</th></tr>';
    var body = mets.map(function (m) {
      var cells = hist.map(function (h) { return '<td class="dpv-val">' + (h[m.key] != null ? m.fmt(Number(h[m.key])) : '\u2013') + '</td>'; }).join('');
      /* v2947 \u00b7 \u0394 vom ersten bis zum letzten VORHANDENEN Wert, nicht von Bericht 1 */
      var _vh = hist.filter(function (h) { return h[m.key] != null && isFinite(Number(h[m.key])); });
      var a = _vh.length ? Number(_vh[0][m.key]) : NaN, b = _vh.length ? Number(_vh[_vh.length - 1][m.key]) : NaN;
      var pct = (a && isFinite(a) && isFinite(b)) ? ((b - a) / Math.abs(a) * 100) : 0;
      var cls = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat', arr = pct > 0.5 ? '\u25b2' : pct < -0.5 ? '\u25bc' : '\u2013';
      var _dz = _vh.length < 2 ? '\u2013' : (arr + ' ' + (pct >= 0 ? '+' : '') + _dpVNum(pct, 1) + ' %'
        + (_vh.length < hist.length ? '<br><span style="font-size:10px;opacity:.7">Bericht ' + (hist.indexOf(_vh[0]) + 1) + '\u2013' + (hist.indexOf(_vh[_vh.length - 1]) + 1) + '</span>' : ''));
      return '<tr data-mrow="' + m.key + '"><td><span class="dpv-mdot" style="background:' + m.color + '"></span>' + m.label + '</td>' + cells + '<td class="dpv-dcol dpv-delta ' + cls + '">' + _dz + '</td></tr>';
    }).join('');
    return '' +
      window._dpVerlaufAbgleich(hist) +
      '<div class="dp-pa-card dpv-card">' +
        '<div class="dpv-h">Entwicklung im Zeitverlauf</div>' +
        '<div class="dpv-sub">Indexiert auf den ersten Bericht (= 100) \u2014 vergleichbar \u00fcber alle Kennzahlen</div>' +
        '<div class="dpv-chips">' + chips + '</div>' +
        '<div class="dpv-chartbox"><canvas class="dpv-canvas"></canvas></div>' +
        '<div class="dpv-note">Index 100 = Wert im ersten Bericht \u00b7 112 = +12 % seither. Absolutwerte in der Tabelle.</div>' +
      '</div>' +
      '<div class="dp-pa-card dpv-card">' +
        '<div class="dpv-h">KI-Einordnung des Verlaufs</div>' +
        '<div class="dpv-sub">Ausf\u00fchrliche Einordnung aller Berichte \u00b7 im Plan enthalten</div>' +
        /* v2171 · Hier stand ein Knopf „Trend-Text erzeugen", und der Text
           war drei bis fuenf Saetze lang. Marcel am 13.10.2026: „das sollte
           schon neu erstellt werden und auch ausfuehrlich ohne extra
           button." Der Text entsteht jetzt beim Oeffnen der Analyse von
           selbst — kostenlos war er schon (logExtract, cost 0, v1194). */
        '<div id="dpv-txt" class="dpv-txt"><p class="dpv-lade">Erstelle die Einordnung des Verlaufs \u2026</p></div>' +
      '</div>' +
      '<div class="dp-pa-card dpv-card">' +
        '<div class="dpv-h">Absolutwerte &amp; \u0394</div>' +
        '<div class="dpv-sub">Jeder Marktbericht als Spalte \u00b7 \u0394 = erster \u2192 letzter</div>' +
        '<div style="overflow-x:auto"><table class="dpv-tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      '</div>';
  };

  window._dpVerlaufWire = function (root, hist) {
    var mets = _dpVActiveMetrics(hist);
    var cv = root.querySelector('.dpv-canvas');
    var light = _dpVIsLight(root.querySelector('.dpv-card') || root);
    root.classList.toggle('dpv-light', light); root.classList.toggle('dpv-dark', !light);
    function idx(m, h) { var _b0 = hist.filter(function (x) { return x[m.key] != null && isFinite(Number(x[m.key])); })[0]; var base = _b0 ? Number(_b0[m.key]) : NaN; return (base && isFinite(base)) ? (Number(h[m.key]) / base * 100) : 100; }
    function wireChips(chart) {
      root.querySelectorAll('.dpv-chip').forEach(function (ch, i) {
        ch.addEventListener('click', function () {
          var on = !ch.classList.contains('on'); ch.classList.toggle('on', on);
          var row = root.querySelector('[data-mrow="' + ch.getAttribute('data-k') + '"]'); if (row) row.style.opacity = on ? '1' : '.45';
          if (chart) { chart.setDatasetVisibility(i, on); chart.update(); }
        });
      });
    }
    // v2171: die Einordnung entsteht von selbst, ohne Knopf
    var ktxt = root.querySelector('#dpv-txt');
    if (ktxt) _dpVerlaufKiText(hist, mets, ktxt);

    if (!cv || typeof window.Chart === 'undefined') { wireChips(null); return; }
    var gridCol = light ? 'rgba(122,115,112,.14)' : 'rgba(201,168,76,.10)';
    var axisCol = light ? '#5A5350' : 'rgba(232,226,212,.6)';
    var pointBorder = light ? '#fff' : '#0a0a0a';
    var labels = hist.map(function (h, i) { return (i + 1) + '. ' + _dpVDate(h.created_at); });
    var datasets = mets.map(function (m, i) {
      return { label: m.label, data: hist.map(function (h) { return (h[m.key] != null) ? Math.round(idx(m, h) * 10) / 10 : null; }),
        borderColor: m.color, backgroundColor: m.color + '22', tension: 0.35, fill: (i === 0),
        pointRadius: 3, pointHoverRadius: 5, pointBackgroundColor: m.color, pointBorderColor: pointBorder, pointBorderWidth: 2,
        borderWidth: 2.4, hidden: (i >= 2), _metKey: m.key };
    });
    try {
      var chart = new window.Chart(cv, { type: 'line', data: { labels: labels, datasets: datasets }, options: {
        responsive: true, maintainAspectRatio: false, devicePixelRatio: 2, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: {
          backgroundColor: 'rgba(10,8,5,.96)', titleColor: '#F2ECDC', bodyColor: '#F2ECDC', borderColor: 'rgba(201,168,76,.45)', borderWidth: 1,
          padding: 11, cornerRadius: 8, usePointStyle: true, titleFont: { size: 12, weight: '700' }, bodyFont: { size: 12, weight: '500' },
          callbacks: { label: function (ctx) { var m = mets[ctx.datasetIndex], h = hist[ctx.dataIndex];
            var abs = (h && h[m.key] != null) ? m.fmt(Number(h[m.key])) : '\u2013';
            return ' ' + m.label + ': ' + abs + ' \u00b7 Index ' + (ctx.parsed.y != null ? _dpVNum(ctx.parsed.y, 1) : '\u2013'); } } } },
        scales: { x: { grid: { color: gridCol, drawBorder: false }, ticks: { color: axisCol, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
                  y: { grid: { color: gridCol, drawBorder: false }, ticks: { color: axisCol },
                       title: { display: true, text: 'Index (1. Bericht = 100)', color: axisCol, font: { size: 10 } } } },
        animation: { duration: 800, easing: 'easeOutQuart' } } });
      wireChips(chart);
    } catch (e) { wireChips(null); }
  };

  /* v2171 · Die Einordnung entsteht von selbst und ausfuehrlich.
     Mitgeschickt wird jetzt alles, was der Verlauf je Bericht traegt
     (Spanne, Vergleichsgruppe, Sach- und Ertragswert, Liegenschaftszins,
     fuehrendes Verfahren, Bevoelkerungstrend), dazu Wohnflaeche und
     Baujahr JE BERICHT - nur so kann der Text sagen, ob sich der Markt
     bewegt hat oder die Eingabe. Und der heutige Kaufpreis.
     Zwischengespeichert wird je Objekt und Berichtsstand: ein neuer
     Marktbericht ergibt einen neuen Schluessel und damit einen neuen Text. */
  var VTXT_FELDER = ['market_value', 'market_value_low', 'market_value_high', 'median_sqm',
    'deal_score', 'micro_score', 'macro_score', 'price_cagr_pct', 'gross_yield_pct', 'rent_multiplier',
    'confidence', 'comparable_group', 'living_area', 'build_year', 'sachwert_eur', 'ertragswert_eur',
    'lzs_pct', 'lzs_stufe', 'fuehrend', 'bevoelkerung_trend_pct',
    'mpi_ohne_abschlag', 'abschlag_pct'];   /* v2947 · sonst liest der Text den Abschlag als Preissturz */
  function _dpVerlaufKiText(hist, mets, out) {
    if (typeof Auth === 'undefined' || !Auth.apiCall) { out.innerHTML = ''; return; }
    var objKey = window._currentObjKey || '';
    var stand = hist.map(function (h) { return h.id || h.report_id || h.created_at; }).join(',');
    var merk = 'dp_vtxt_v2171_' + objKey;
    try {
      var alt = JSON.parse(localStorage.getItem(merk) || 'null');
      if (alt && alt.stand === stand && alt.text) { out.innerHTML = _dpVEscP(alt.text); return; }
    } catch (e) {}
    var labels = mets.reduce(function (a, m) { a[m.key] = m.label; return a; }, {});
    var payload = {
      metrics: mets.map(function (m) { return m.key; }),
      labels: labels,
      felder: VTXT_FELDER,
      series: hist.map(function (h) {
        var o = { date: h.created_at };
        VTXT_FELDER.forEach(function (k) { if (h[k] != null && h[k] !== '') o[k] = h[k]; });
        return o;
      }),
      objekt: {
        adresse: (hist[hist.length - 1] || {}).address || null,
        objektart: (hist[hist.length - 1] || {}).property_type || null,
        wohnflaeche_heute: _numDe(_gv('wfl')),
        baujahr_heute: _numDe(_gv('baujahr')),
        kaufpreis_heute: _numDe(_gv('kp'))
      }
    };
    Auth.apiCall('/marktbericht/verlauf-text', { method: 'POST', body: payload })
      .then(function (data) {
        if (data && data.needs_credits) { out.innerHTML = '<span class="dpv-err">Die Einordnung ist gerade nicht verfügbar.</span>'; return; }
        var t = (data && (data.text || data.report_md)) || '';
        if (!t) { out.innerHTML = '<span class="dpv-err">Die Einordnung kam leer zurück.</span>'; return; }
        out.innerHTML = _dpVEscP(t);
        try { localStorage.setItem(merk, JSON.stringify({ stand: stand, text: t })); } catch (e) {}
      })
      .catch(function () { out.innerHTML = '<span class="dpv-err">Die Einordnung konnte nicht erstellt werden.</span>'; });
  }
  /* v2171: Zeilen mit „## " werden Zwischenueberschriften, „**x**" fett. */
  function _dpVEscP(t) {
    var esc = String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.split(/\n{2,}|\n(?=#{2,4} )/).map(function (p) {
      p = p.trim();
      if (!p) return '';
      var h = p.match(/^#{2,4}\s+(.+?)(?:\n([\s\S]*))?$/);
      var fett = function (x) { return x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); };
      if (h) return '<h4 class="dpv-zh">' + fett(h[1]) + '</h4>' + (h[2] ? '<p>' + fett(h[2]).replace(/\n/g, '<br>') + '</p>' : '');
      return '<p>' + fett(p).replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  window._dpLoadVerlauf = function () {
    var body = document.getElementById('dp-pa-verlauf-body');
    var tabBtn = document.getElementById('dp-pa-tab-wert');   /* v2842 · ein Unterreiter „Wert & Marktpreis" */
    var wrap = document.getElementById('dp-pa-verlauf-wrap');
    if (!body) return;
    _dpVerlaufCss();
    var objKey = (typeof window._currentObjKey === 'string' && window._currentObjKey) ? window._currentObjKey : null;
    if (!objKey || typeof Auth === 'undefined' || !Auth.apiCall) { if (tabBtn) tabBtn.style.display = 'none'; return; }
    /* v2556c · Marcel 21.10.2026: „wenn wir mehr Abrufe machen, dann auch die
       Marktberichte abgelegt werden." Die Abrufe „Marktpreise" (mb.potenzial_abrufe)
       stehen hier mit Datum und Kennzahlen neben den Marktberichten. */
    var abrufeP = Auth.apiCall('/marktbericht/potenzial/markt/verlauf?external_ref=' + encodeURIComponent(objKey))
      .then(function (r) { return (r && r.abrufe) || []; }, function () { return []; });
    Promise.all([Auth.apiCall('/marktbericht/objects/history?key=' + encodeURIComponent('dp:' + objKey), { method: 'GET' }).catch(function () { return null; }), abrufeP])
      .then(function (res) {
        var data = res[0], abrufe = res[1];
        if ((typeof window._currentObjKey === 'string' ? window._currentObjKey : null) !== objKey) return;
        var hist = (data && data.history) || [];
        hist = hist.filter(function (h) { return h && h.market_value != null; });
        /* v2842 · Marcel: „Sind da Abschläge drin?" - je Bericht der Abschlag und der Wert OHNE
           Abschlag. Berichte ohne Abschlag (vor v2367) führen das Angebotsniveau selbst. */
        hist.forEach(function (h) {
          var ab = h.angebot_abschlag_pct != null && h.angebot_abschlag_pct !== '' ? Number(h.angebot_abschlag_pct) : null;
          h.abschlag_pct = ab != null && isFinite(ab) ? ab : 0;
          h.mpi_ohne_abschlag = h.market_value_roh != null ? Number(h.market_value_roh) : (!(ab > 0) ? Number(h.market_value) : null);
          h.mpi_nach_abschlag = ab > 0 ? Number(h.market_value) : null;   /* v2947 (N78.2) */
        });
        try { if (window.DpWertvergleich) window.DpWertvergleich.fuellen(hist); } catch (e) {}   /* v2810 */
        var abHtml = _dpAbrufeHtml(abrufe);
        /* v2217 · Marcel 14.10.2026: „Marktbericht auch erst, wenn wir schon
           einen Report haben." Bis hier erschien der Reiter erst ab ZWEI
           Berichten - mit einem war er unsichtbar, obwohl es einen gab. */
        if (hist.length < 1 && !abrufe.length) { if (tabBtn) tabBtn.style.display = 'none'; if (wrap) wrap.style.display = 'none'; return; }
        if (tabBtn) tabBtn.style.display = '';   /* v2842 · erscheint, sobald Bericht ODER Abruf vorliegt */
        if (wrap) wrap.style.display = '';
        if (hist.length < 1) { body.innerHTML = abHtml; return; }
        if (hist.length === 1) {
          var h1 = hist[0], mw = Number(h1.market_value);
          body.innerHTML = '<p class="dp-pa-p"><b>Ein Marktbericht vom ' + _dpVDate(h1.created_at) + '</b> — Marktwert '
            + (isFinite(mw) ? '<b>' + Math.round(mw).toLocaleString('de-DE') + ' €</b>' : '–') + '.</p>'
            + '<p class="dp-pa-p" style="color:#8b8678">Ein Verlauf mit Wertentwicklung entsteht ab dem zweiten Bericht zu diesem Objekt.</p>' + abHtml;
          return;
        }
        body.innerHTML = window._dpVerlaufHtml(hist) + abHtml;
        window._dpVerlaufWire(body, hist);
        _dpVerlaufLocLine(hist);
      })
      .catch(function () { if (wrap) wrap.style.display = 'none'; });
  };
  /* v2556c · die abgelegten Marktpreis-Abrufe, neueste zuerst */
  function _dpAbrufeHtml(abrufe) {
    if (!abrufe || !abrufe.length) return '';
    var qm = function (m, d) { return m && m.median_qm != null ? Number(m.median_qm).toLocaleString('de-DE', { maximumFractionDigits: d }) + ' €/m²' : '–'; };
    var eur = function (x) { return x != null && isFinite(Number(x)) ? Math.round(Number(x)).toLocaleString('de-DE') + ' €' : '–'; };
    var zeilen = abrufe.map(function (a) {
      var d = a.daten || {}, M = d.markt || {}, B = (d.stufen && d.stufen.bestand) || {};
      /* v2842 · Marcel: „Sind da Abschläge drin?" - ja: die Marktpreisindikation des Abrufs steht NACH
         Abschlag auf Angebotspreise. Abschlag je Abruf aus markt bzw. mpi.angebote, ohne Abschlag ab v2842. */
      var ab = B.mpi_abschlag_pct != null ? B.mpi_abschlag_pct : (M.abschlag_pct != null ? M.abschlag_pct : (d.mpi && d.mpi.angebote ? d.mpi.angebote.abschlag_pct : null));
      ab = ab != null && isFinite(Number(ab)) ? Number(ab) : null;
      var mpi = eur(B.mpi_angebote)
        + (B.mpi_angebote != null ? '<span class="dp-wv-sub">' + (ab > 0 ? 'nach ' + _dpVNum(ab, 1) + ' % Abschlag' : (ab === 0 ? 'ohne Abschlag' : 'Abschlag nicht gespeichert'))
          + (B.mpi_angebote_roh != null && ab > 0 ? ' · ohne: ' + eur(B.mpi_angebote_roh) : '') + '</span>' : '');
      /* v2987 · Zahlen rechtsbuendig unter den rechtsbuendigen Koepfen (abw-zahl wie dp-wv-tafel) */
      return '<tr><td class="abw-wort">' + _dpVDate(a.abgerufen_am) + '</td><td class="abw-zahl">' + qm(M.kauf_haus, 0) + '</td><td class="abw-zahl">' + qm(M.kauf_etw, 0) + '</td><td class="abw-zahl">' + qm(M.miete, 2)
        + '</td><td class="abw-zahl">' + mpi + '</td><td class="abw-zahl">' + eur(B.ertragswert) + '</td></tr>';
    }).join('');
    return '<div class="dp-pa-card" style="margin-top:14px"><h4 class="dpv-h">Abgelegte Marktpreis-Abrufe (' + abrufe.length + ')</h4>'
      + '<p class="dp-pa-p" style="color:#8b8678;margin:2px 0 8px">Jeder Abruf „Marktpreise“ wird mit Datum gespeichert. Kauf- und Mietpreise sind Angebotspreise; die Marktpreisindikation steht nach Abschlag.</p>'
      + '<div style="overflow-x:auto"><table class="abw-tafel dp-wv-tafel" style="min-width:540px"><thead><tr><th>Abruf</th><th>Kauf Haus</th><th>Kauf ETW</th><th>Angebotsmiete</th><th>Marktpreisindikation Bestand<br><span style="font-weight:400;text-transform:none">nach Abschlag</span></th><th>Ertragswert Bestand</th></tr></thead><tbody>'
      + zeilen + '</tbody></table></div></div>';
  }

  // Entwicklungszeile in "Lage & Markt" (Panel dp-pa-loc), sobald History da ist
  function _dpVerlaufLocLine(hist) {
    try {
      var loc = document.getElementById('dp-pa-loc');
      if (!loc || loc.querySelector('.dpv-locdev')) return;
      /* v2947 (N78.2) \u00b7 der Trend laeuft ueber den Wert OHNE Abschlag - der ist ueber alle
         Berichte gleichartig. Fehlt er an einem Ende, steht kein Trend (kein Mischvergleich). */
      var _vg = hist.filter(function (h) { return h.mpi_ohne_abschlag != null && isFinite(h.mpi_ohne_abschlag); });
      if (_vg.length < 2) return;
      var mw0 = Number(_vg[0].mpi_ohne_abschlag), mw1 = Number(_vg[_vg.length - 1].mpi_ohne_abschlag);
      var pct = (mw0 && isFinite(mw0)) ? ((mw1 - mw0) / mw0 * 100) : 0;
      var trend = Math.abs(pct) < 0.5 ? 'stabil' : ((pct > 0 ? '+' : '') + _dpVNum(pct, 1) + ' %');
      var note = document.createElement('div'); note.className = 'dpv-locdev';
      note.style.cssText = 'margin-top:12px;padding:11px 14px;border-radius:11px;background:rgba(201,168,76,.09);border:1px solid rgba(201,168,76,.32);font-size:12.5px;line-height:1.5';
      note.innerHTML = '<b>Entwicklung \u00fcber ' + _vg.length + ' Marktberichte:</b> Marktpreisindikation ohne Abschlag auf Angebotspreise ' + _dpVEur(mw0) + ' \u2192 ' + _dpVEur(mw1) + ' \u20ac (' + trend + '). ' +
        'Vollst\u00e4ndiger Verlauf im Unterreiter \u201eWert & Marktpreis\u201c.';
      loc.appendChild(note);
    } catch (e) {}
  }

  function _dpVerlaufCss() {
    if (document.getElementById('dp-verlauf-css')) return;
    var st = document.createElement('style'); st.id = 'dp-verlauf-css';
    st.textContent = [
      '.dpv-h{font-family:"Space Grotesk",sans-serif;font-weight:600;font-size:15px;margin:0 0 2px}',
      '.dpv-light .dpv-h{color:#2A2727}.dpv-dark .dpv-h{color:#FDFCFA}',
      '.dpv-sub{color:#8b8678;font-size:12px;font-family:"JetBrains Mono",monospace;margin-bottom:14px}',
      '.dpv-abgl{display:flex;align-items:flex-start;gap:10px;padding:12px 15px;border-radius:12px;margin-bottom:16px;font-size:13px;line-height:1.5;border:1px solid rgba(140,134,120,.3)}',
      '.dpv-abgl-ic{flex:0 0 auto;font-size:15px;line-height:1.4}',
      '.dpv-abgl-ok{background:rgba(63,165,108,.12);border-color:rgba(63,165,108,.4);color:#2e7d52}',
      '.dpv-dark .dpv-abgl-ok{color:#8fd9b0}',
      '.dpv-abgl-warn{background:rgba(201,150,40,.13);border-color:rgba(201,150,40,.45);color:#96690f}',
      '.dpv-dark .dpv-abgl-warn{color:#e6c67a}',
      '.dpv-abgl-neutral{background:rgba(140,134,120,.08);color:#8b8678}',
      '.dpv-chips{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px}',
      '.dpv-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border:1px solid rgba(140,134,120,.35);border-radius:9px;background:rgba(140,134,120,.06);color:#8b8678;font-size:12px;font-weight:600;cursor:pointer;transition:.15s}',
      '.dpv-chip .dpv-dot{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.35}',
      '.dpv-chip.on{border-color:transparent;background:rgba(201,168,76,.16)}.dpv-chip.on .dpv-dot{opacity:1}',
      '.dpv-chartbox{position:relative;height:300px}.dpv-canvas{width:100%!important;height:300px!important;display:block}',
      '.dpv-note{font-family:"JetBrains Mono",monospace;font-size:11px;color:#8b8678;margin-top:10px}',
      '.dpv-txt{font-size:13.5px;line-height:1.6;margin-bottom:12px}.dpv-light .dpv-txt{color:#2A2727}.dpv-dark .dpv-txt{color:#E8E2D4}.dpv-txt p{margin:0 0 9px}',
      '.dpv-err{color:#B8625C;font-family:"JetBrains Mono",monospace;font-size:12px}',
      '.dpv-lade{color:#8b8678;font-style:italic}.dpv-zh{font-family:"Space Grotesk",sans-serif;font-size:13.5px;font-weight:600;margin:14px 0 4px}.dpv-light .dpv-zh{color:#2A2727}.dpv-dark .dpv-zh{color:#F2ECDC}',
      '.dpv-tbl{width:100%;border-collapse:collapse;font-size:12.5px}',
      /* v2987 · Marcel 27.10.2026: „Skalierung und Formatierung der Tabellen Absolutwerte und Abgelegte Marktpreis-Abrufe
         passt nicht, gleich das bitte genau ab." Gemessen: Zellen 9x11 px statt 5x8 wie die Wertuebersicht (abw-tafel),
         Kopf mit Goldlinie. Jetzt dieselben Masse, Zahlen tabellarisch. */
      '.dpv-tbl th,.dpv-tbl td{text-align:right;padding:5px 8px;border-bottom:1px solid var(--line,#E7E4DC);font-variant-numeric:tabular-nums;white-space:nowrap}',
      '.dpv-tbl th:first-child,.dpv-tbl td:first-child{text-align:left}',
      '.dpv-light .dpv-tbl td:first-child{color:#2A2727}.dpv-dark .dpv-tbl td:first-child{color:#F2ECDC}',
      '.dpv-tbl thead th{font:600 10px/1.4 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.4px;text-transform:uppercase;color:var(--ink3,#938B7F);border-bottom:1px solid var(--line,#E7E4DC);white-space:normal}',
      '.dpv-mdot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}',
      '.dpv-val,.dpv-delta{font-family:"JetBrains Mono",monospace}.dpv-light .dpv-val{color:#3a3630}.dpv-dark .dpv-val{color:#D8D2C7}.dpv-delta{font-weight:700}',
      '.dpv-up{color:#2e7d52}.dpv-dark .dpv-up{color:#3FA56C}.dpv-down{color:#B8625C}.dpv-flat{color:#8b8678}',
      '.dpv-dcol{background:rgba(201,168,76,.06)}'
    ].join('');
    document.head.appendChild(st);
  }
})();
