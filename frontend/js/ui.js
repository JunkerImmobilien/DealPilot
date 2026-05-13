'use strict';

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
  { title: 'KI-Analyse',      sub: 'Automatische Bewertung von Lage und Investmentpotenzial.' },
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
  // V47: Tab-Wechsel triggert Save (Auto-Save ist aus)
  if (typeof window.dpTabSwitchSave === 'function') {
    try { window.dpTabSwitchSave(); } catch(e) {}
  }
  // V63.26: Spalt zwischen Tab-Bar und Workflow-Bar nachjustieren
  if (typeof window._updateWfTop === 'function') {
    setTimeout(window._updateWfTop, 30);
    setTimeout(window._updateWfTop, 200);
  }
  // Only consider visible/tab-bound sections (skip .sec-hidden like Gespeicherte Objekte)
  document.querySelectorAll('.sec:not(.sec-hidden)').forEach(function(s, j) { s.classList.toggle('active', j === i); });
  document.querySelectorAll('.sec-hidden').forEach(function(s) { s.classList.remove('active'); });
  document.querySelectorAll('.tab').forEach(function(t, j) { t.classList.toggle('active', j === i); });

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

/**
 * V26: Hauptview-Switch zwischen Einzelobjekt und Alle-Objekte-Tabelle.
 * @param {'single' | 'all'} view
 */
function setMainView(view) {
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
    if (wfBar) wfBar.style.display = '';        // V63.48: WF-Bar wieder einblenden
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
        if (typeof window.qcUpdate === 'function') {
          try { window.qcUpdate(); } catch(e) {}
        }
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

// ── IMAGES ────────────────────────────────────────────
var imgs = [];
function handleImgs(files) {
  Array.from(files).forEach(function(f) {
    if (imgs.length >= 6) return;
    var r = new FileReader();
    r.onload = function(e) { imgs.push({ src: e.target.result, name: f.name }); renderImgs(); };
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
  VERHANDLUNGSEMPFEHLUNG:   '#C9A84C',
  'KAUFPREIS-OFFERTE':      '#7A5AB5',
  'KAUFPREIS_OFFERTE':      '#7A5AB5',
  BANKARGUMENTE:            '#2A9A5A',
  FAZIT:                    '#C9A84C'
};

function saveKey() {
  var inp = document.getElementById('api-key');
  var k = inp ? inp.value.trim() : '';
  if (!k) { toast('⚠ Bitte API-Key eingeben'); return; }
  localStorage.setItem('ji_ak_oai', k);
  st('key-status', '✓ KI API-Key gespeichert (nur lokal in diesem Browser)');
  toast('✓ API-Key gespeichert');
}

function buildPrompt() {
  var K = State.kpis;
  var addr = [g('str'), g('hnr'), g('plz'), g('ort')].filter(Boolean).join(' ');
  return 'Du bist erfahrener Immobilieninvestmentberater und Sachverständiger in Deutschland mit 20+ Jahren Erfahrung. Erstelle eine ausführliche, professionelle Investmentanalyse für ein Sachverständigenbüro auf Deutsch. Sei präzise, nutze konkrete Zahlen aus den Daten und gib handlungsorientierte Empfehlungen.\n\n' +
    'OBJEKT:\n' +
    '  Adresse: ' + addr + '\n' +
    '  Typ: ' + g('objart') + ' · Fläche: ' + g('wfl') + ' m² · Baujahr: ' + g('baujahr') + ' · Kaufdatum: ' + g('kaufdat') + '\n' +
    '  Makrolage: ' + g('makrolage') + ' · Mikrolage: ' + g('mikrolage') + '\n' +
    '  Bewertung: Bank ' + fE(v('bankval')) + ', SVW ' + fE(v('svwert')) + ', Wertpuffer ' + fE(K.wp_kpi, 0, true) + '\n\n' +
    'INVESTITION:\n' +
    '  Kaufpreis: ' + fE(K.kp) + ' (' + (v('wfl') > 0 ? fE(K.kp/v('wfl')) + '/m²' : '—') + ')\n' +
    '  Gesamtinvestition: ' + fE(K.gi) + ' (Nebenkosten ' + fP((K.gi-K.kp)/K.kp*100, 1) + ')\n' +
    '  Eigenkapital: ' + fE(K.ek) + ' | LTV: ' + fP(K.ltv, 1) + '\n\n' +
    'MIETE & ERTRAG:\n' +
    '  NKM: ' + fE(K.nkm_j/12) + '/Mon. (' + fE(K.nkm_j) + '/J.) | Warmmiete: ' + fE(K.wm_j/12) + '/Mon.\n' +
    '  Bruttomietrendite: ' + fP(K.bmy) + ' | Nettomietrendite: ' + fP(K.nmy) + '\n' +
    '  CF operativ: ' + fE(K.cf_op, 0, true) + '/J. | CF nach Steuern: ' + fE(K.cf_ns, 0, true) + '/J. (' + fE(K.cf_m, 0, true) + '/Mon.)\n\n' +
    'FINANZIERUNG:\n' +
    '  Darlehen I: ' + fE(K.d1) + ' bei ' + fP(K.d1z_pct, 2) + ' Zins, ' + fP(K.d1t_pct, 2) + ' Tilgung\n' +
    '  Zinsbindung: ' + g('d1_bindj') + ' Jahre | Restschuld EZB: ' + fE(State.rs) + '\n' +
    (State.d2_enabled ? '  Darlehen II: ' + fE(State.d2) + ' (' + State.d2_type + ')\n' : '') +
    '  Anschlusszins kalkuliert: ' + fP(v('anschl_z'), 1) + ' | Zinsänderungsrisiko: ' + fE(K.zaer_m) + '/Mon.\n\n' +
    'KENNZAHLEN:\n' +
    '  DSCR: ' + fN(K.dscr, 2) + '\n' +
    '  LTV: ' + fP(K.ltv, 1) + '\n' +
    '  Faktor (KP/NKM): ' + fN(K.fak, 1) + ' | IRR: ' + fP(K.irr, 1) + ' | EM: ' + fX(K.em) + '\n' +
    '  Wertpuffer: ' + fE(K.wp_kpi, 0, true) + '\n\n' +
    '═══════════════════════════════════════════════════\n' +
    'DEALPILOT-BEWERTUNGSSKALA (verbindlich verwenden!)\n' +
    '═══════════════════════════════════════════════════\n' +
    'Halte dich strikt an diese Schwellwerte und an den unten formulierten Wortlaut.\n\n' +
    'LTV (Loan to Value) — Beleihungsauslauf:\n\n' +
    '🟢 SOLIDE — LTV unter 85 %:\n' +
    '   Marktüblicher und bankenseitig meist gut darstellbarer Finanzierungsbereich für\n' +
    '   Kapitalanleger in Deutschland. Bietet in der Regel eine solide Sicherheitsreserve\n' +
    '   und gute Finanzierungskonditionen. Ein LTV zwischen 80-85 % gilt ausdrücklich\n' +
    '   NICHT als "hoch", sondern als übliche Investmentfinanzierung.\n\n' +
    '🟡 ERHÖHT — LTV zwischen 85 % und 100 %:\n' +
    '   Erhöhte Fremdkapitalquote mit geringerer Sicherheitsreserve. Die Finanzierung\n' +
    '   reagiert sensibler auf Marktveränderungen, Zinsanstiege oder Leerstand. Banken\n' +
    '   prüfen solche Finanzierungen häufig strenger und Konditionen können sich\n' +
    '   verschlechtern.\n\n' +
    '🔴 KRITISCH — LTV über 100 %:\n' +
    '   Sehr hohe bzw. vollständige Fremdfinanzierung mit erhöhter finanzieller Belastung\n' +
    '   und geringer Absicherung. Bereits kleinere Marktwertverluste oder unerwartete\n' +
    '   Kosten können die Finanzierung deutlich belasten. Anschlussfinanzierungen und\n' +
    '   Nachbewertungen können problematisch werden.\n\n' +
    'DSCR (Debt Service Coverage Ratio):\n' +
    '🔴 KRITISCH — DSCR unter 1,0: Schuldendienst nicht durch Mieteinnahmen gedeckt.\n' +
    '🟡 KNAPP — DSCR zwischen 1,0 und 1,2: Bedienung gerade so gedeckt, kleiner Puffer.\n' +
    '🟢 SOLIDE — DSCR ab 1,2: Tilgung & Zins komfortabel gedeckt, ausreichender Puffer.\n\n' +
    'WICHTIGE INSTRUKTIONEN:\n' +
    '- Verwende die Begriffe "SOLIDE", "ERHÖHT", "KRITISCH" / "KNAPP" exakt wie oben.\n' +
    '- Ein LTV von 84 % ist SOLIDE und gehört in die Stärken — bezeichne ihn NIE als\n' +
    '  "hoch", "relativ hoch" oder "erhöht". Das ist faktisch falsch.\n' +
    '- Ein DSCR von 1,25 ist SOLIDE und damit eine STÄRKE, kein Risiko.\n\n' +
    'INVESTITIONSSTRATEGIE: ' + g('ai_strat') + '\n' +
    'VERKÄUFER-SITUATION: ' + g('ai_verk') + '\n' +
    'EIGENE RISIKOTOLERANZ: ' + g('ai_risk') + '\n' +
    'MARKTPHASE: ' + g('ai_markt') + '\n' +
    'INVESTITIONSTHESE: ' + (g('thesis') || 'Keine Angabe') + '\n\n' +
    '═══════════════════════════════════════════════════\n' +
    'GIB DEINE ANALYSE IN GENAU DIESEN 7 BLÖCKEN AUS:\n' +
    '═══════════════════════════════════════════════════\n\n' +
    '(Format: GROSSBUCHSTABEN-Überschrift, Doppelpunkt, Zeilenumbruch, dann Inhalt. Halte dich exakt daran.)\n\n' +
    'INVESTITIONSBEWERTUNG:\n' +
    '(8-12 Sätze ausführlicher Fließtext. Bewerte: Lage, Marktumfeld, Bauqualität implizit, Verhältnis von Kaufpreis zu Marktwert (Wertpuffer), Renditequalität (BMR/NMR), Cashflow-Stärke, Hebelwirkung der Finanzierung, steuerliche Vorteile, Bewirtschaftungskosten-Anteil, Zinsänderungsrisiko und Anschlussfinanzierungs-Phase. Gib am Ende ein eindeutiges Investment-Rating: SEHR ATTRAKTIV / ATTRAKTIV / NEUTRAL / KRITISCH / UNGEEIGNET. Verwende konkrete Zahlen aus den Eingaben.)\n\n' +
    'STÄRKEN:\n' +
    '(3-5 nummerierte Punkte. Jeder Punkt: Überschrift, dann Begründung mit konkreten Zahlen. Beispiel: "1. Sofortiger Wertpuffer von 57.000 € — Kauf zu 76% des Marktwerts schafft Sicherheitsmarge bei Verkauf und ermöglicht günstige Beleihung.")\n\n' +
    'RISIKEN:\n' +
    '(3-4 nummerierte Punkte. Sei ehrlich und quantifiziere wo möglich. Erkläre, was schiefgehen kann und welche Maßnahmen zur Mitigation möglich sind.)\n\n' +
    'VERHANDLUNGSEMPFEHLUNG:\n' +
    '(Konkrete Zahlen: Erstangebot in €, Zielpreis in €, Schmerzgrenze in €. Begründung mit 2-3 Argumenten basierend auf Marktwert, Mängeln, Marktphase. 5-7 Sätze.)\n\n' +
    'KAUFPREIS-OFFERTE:\n' +
    '(Vorgefertigter, professioneller Text als Vorlage für die schriftliche Kaufpreisofferte an den Verkäufer. Soll direkt verwendbar sein. Inkl. Anrede, Begründung des Angebots ohne Preisdrückerei, Wertschätzung der Immobilie, klares Angebot mit Zahl, Hinweis auf Finanzierungszusage und kurzem Notartermin als Vorteil. Etwa 200-300 Wörter, formell aber freundlich. Format als sofort kopierbares Schreiben.)\n\n' +
    'BANKARGUMENTE:\n' +
    '(Genau 3-4 starke Argumente für die Finanzierungsanfrage. Mit konkreten Zahlen. Was die Bank gerne hört: stabile Mieteinnahmen, niedriger LTV auf Marktwert, DSCR >1.5, stabile Region.)\n\n' +
    'FAZIT:\n' +
    '(2-3 Sätze klare Empfehlung: KAUFEN / NICHT KAUFEN / NUR UNTER BEDINGUNGEN. Bei letzterem: welche konkreten Bedingungen. Mit Begründung.)';
}

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
    var col = AI_COLORS[sec] || '#C9A84C';
    html += '<div class="ai-section">' +
      '<div class="ai-section-label" style="color:' + col + '">' + sec + '</div>' +
      '<div class="ai-body">' + body + '</div>' +
    '</div>';
  });
  return html || '<div class="ai-body">' + text.replace(/\n/g, '<br>') + '</div>';
}

async function runAI() {
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
      thesis: g('thesis'), risiken: g('risiken'),
      wertstg_pct: parseDe(g('wertstg')) || null,
      mietstg_pct: parseDe(g('mietstg')) || null
    },
    kennzahlen: {
      kp: k.kp, gi: k.gi, ek: k.ek, bmy: k.bmy, nmy: k.nmy,
      dscr: k.dscr, ltv: k.ltv, cf_m: k.cf_m, em: k.em
    },
    finanzierung: {
      d1z_pct: k.d1z_pct, d1t_pct: k.d1t_pct, d1: k.d1
    },
    dealscore: dealscoreSnap || {}
  };
  // User-Key aus Settings als Fallback mitschicken — Backend nutzt ihn nur
  // wenn kein Server-Key konfiguriert ist.
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
    return '⚠ KI-Analyse-Limit erreicht oder KI-Rate-Limit. Bitte später nochmal probieren.';
  }
  return '⚠ KI-Analyse fehlgeschlagen: ' + ((err && (err.message || err.error)) || err);
}
async function _runAIServer(btn) {
  btn.textContent = '⏳ Recherchiere Lage & analysiere...';
  document.getElementById('ai-content').innerHTML =
    '<div class="ai-loading">' +
      '<div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>' +
      '<span style="margin-left:10px;color:rgba(255,255,255,.5);font-size:12px">' +
      'KI recherchiert Makro-/Mikrolage, Mietspiegel und Marktdaten…</span>' +
    '</div>';
  try {
    var payload = _buildAIPayload();
    var data = await Auth.apiCall('/ai/analyze', { method: 'POST', body: payload });
    var html;
    if (data && data.analysis) {
      html = _renderAIServerAnalysis(data.analysis);
      window._aiAnalysis = data.analysis;
      window._aiText = JSON.stringify(data.analysis, null, 2);
      // V25: Mini-Block in Tab Kennzahlen mit aktualisieren
      if (typeof _renderMiniAI === 'function') _renderMiniAI(data.analysis);
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
    toast('✓ KI-Analyse mit Web-Recherche abgeschlossen');
    // V63.86: Pill aktualisieren nach Credit-Verbrauch
    if (window.AiCredits) window.AiCredits.refresh(true);
  } catch (e) {
    document.getElementById('ai-content').innerHTML =
      '<div class="ai-error">' + _formatAIError(e) + '</div>';
    // V63.86: Pill auch bei Fehler refreshen (z.B. wenn Server 402 zurückgibt)
    if (window.AiCredits) window.AiCredits.refresh(true);
  } finally {
    btn.disabled = false;
    btn.textContent = '🤖 Analyse starten';
  }
}

function _esc(s) {
  return ('' + (s == null ? '' : s))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
function _escClean(s) {
  return _esc(_stripMd(s));
}

function _renderAIServerAnalysis(a) {
  function list(arr) {
    if (!Array.isArray(arr) || !arr.length) return '<em style="opacity:.5">—</em>';
    return '<ul>' + arr.map(function(x){ return '<li>' + _escClean(x) + '</li>'; }).join('') + '</ul>';
  }
  function fitBadge(value) {
    if (!value) return '';
    var v = String(value).toLowerCase().trim();
    var color, label;
    if (v.indexOf('ja') === 0) { color = '#3FA56C'; label = 'Ja'; }
    else if (v.indexOf('nein') === 0) { color = '#B8625C'; label = 'Nein'; }
    else { color = '#C9A84C'; label = 'Teilweise'; }
    return '<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:700;background:' + color + ';color:#fff">' + label + '</span>';
  }
  function fitReason(value) {
    if (!value) return '';
    var v = String(value);
    var dash = v.indexOf('—');
    if (dash < 0) dash = v.indexOf(' - ');
    if (dash > 0) v = v.substring(dash + 1).trim();
    else if (v.toLowerCase().indexOf('ja') === 0 || v.toLowerCase().indexOf('nein') === 0 || v.toLowerCase().indexOf('teilweise') === 0) {
      var firstSpace = v.indexOf(' ');
      if (firstSpace > 0) v = v.substring(firstSpace).replace(/^[\s,—-]+/, '').trim();
    }
    return _escClean(v);
  }
  function empfehlungBadge(emp) {
    var e = String(emp || '').toLowerCase();
    var color = '#C9A84C', label = emp || '—';
    if (e.indexOf('kaufen') === 0)        { color = '#3FA56C'; label = 'KAUFEN'; }
    else if (e.indexOf('nicht') === 0)    { color = '#B8625C'; label = 'NICHT KAUFEN'; }
    else if (e.indexOf('prüfen') >= 0 || e.indexOf('pruefen') >= 0) { color = '#C9A84C'; label = 'PRÜFEN'; }
    return '<span style="display:inline-block;padding:6px 18px;border-radius:6px;font-size:14px;font-weight:800;letter-spacing:.05em;background:' + color + ';color:#fff">' + label + '</span>';
  }

  var html = '';

  // 1. Gesamtbewertung
  html += '<div class="ai-block">';
  html += '<h3>📊 Gesamtbewertung</h3>';
  html += '<p>' + _escClean(a.gesamtbewertung || a.fazit_kurz || '—') + '</p>';
  html += '</div>';

  // 2. Stärken & Schwächen
  html += '<div class="ai-block ai-block-green"><h3>✅ Stärken</h3>' + list(a.staerken) + '</div>';
  html += '<div class="ai-block ai-block-red"><h3>⚠ Risiken</h3>' + list(a.risiken) + '</div>';

  // 3. Risikoanalyse
  if (a.risikoanalyse && typeof a.risikoanalyse === 'object') {
    var ra = a.risikoanalyse;
    html += '<div class="ai-block"><h3>🛡 Risikoanalyse</h3>';
    if (ra.finanzierungsrisiko)    html += '<div class="ai-sub"><strong>Finanzierungsrisiko (LTV + DSCR):</strong> ' + _escClean(ra.finanzierungsrisiko) + '</div>';
    if (ra.cashflow_stabilitaet)   html += '<div class="ai-sub"><strong>Cashflow-Stabilität:</strong> ' + _escClean(ra.cashflow_stabilitaet) + '</div>';
    if (ra.annahmen_abhaengigkeit) html += '<div class="ai-sub"><strong>Abhängigkeit von Annahmen:</strong> ' + _escClean(ra.annahmen_abhaengigkeit) + '</div>';
    html += '</div>';
  }

  // 4. Szenario-Analyse
  if (a.szenarien && typeof a.szenarien === 'object') {
    html += '<div class="ai-block"><h3>📉📈 Szenario-Analyse</h3>';
    if (a.szenarien.worst_case) html += '<div class="ai-sub ai-scenario-worst"><strong>Worst Case</strong> (Miete -10%, Zins +1%): ' + _escClean(a.szenarien.worst_case) + '</div>';
    if (a.szenarien.best_case)  html += '<div class="ai-sub ai-scenario-best"><strong>Best Case</strong> (Miete +5%, höhere Wertsteigerung): ' + _escClean(a.szenarien.best_case) + '</div>';
    html += '</div>';
  }

  // 5. Investor-Fit
  if (a.investor_fit && typeof a.investor_fit === 'object') {
    var fit = a.investor_fit;
    html += '<div class="ai-block"><h3>👥 Investor-Fit</h3>';
    html += '<div class="ai-fit-grid">';
    if (fit.cashflow_investor)        html += '<div class="ai-fit-row"><span class="ai-fit-label">Cashflow-Investor</span>' + fitBadge(fit.cashflow_investor) + '<span class="ai-fit-reason">' + fitReason(fit.cashflow_investor) + '</span></div>';
    if (fit.wertsteigerungs_investor) html += '<div class="ai-fit-row"><span class="ai-fit-label">Wertsteigerungs-Investor</span>' + fitBadge(fit.wertsteigerungs_investor) + '<span class="ai-fit-reason">' + fitReason(fit.wertsteigerungs_investor) + '</span></div>';
    if (fit.sicherheitsorientiert)    html += '<div class="ai-fit-row"><span class="ai-fit-label">Sicherheitsorientiert</span>' + fitBadge(fit.sicherheitsorientiert) + '<span class="ai-fit-reason">' + fitReason(fit.sicherheitsorientiert) + '</span></div>';
    html += '</div></div>';
  }

  // 6. Empfehlung
  html += '<div class="ai-block ai-block-empfehlung"><h3>🎯 Empfehlung</h3>';
  html += '<div class="ai-empfehlung-row">' + empfehlungBadge(a.empfehlung || a.fazit_kurz) + '</div>';
  if (a.empfehlung_begruendung) html += '<p style="margin-top:10px">' + _escClean(a.empfehlung_begruendung) + '</p>';
  html += '</div>';

  // V29: Alte 6-Block-Struktur — Investmentbewertung / Verhandlung / Kaufpreis-Offerte / Bankargumente
  // Wenn die Felder vorhanden sind, werden sie als eigene farbige Karten gerendert.
  if (a.investmentbewertung) {
    html += '<div class="ai-block ai-block-investmentbewertung">';
    html += '<h3>📈 Investmentbewertung</h3>';
    html += '<p>' + _escClean(a.investmentbewertung) + '</p>';
    html += '</div>';
  }
  if (a.verhandlungsempfehlung) {
    html += '<div class="ai-block ai-block-verhandlung">';
    html += '<h3>🤝 Verhandlungsempfehlung</h3>';
    html += '<p>' + _escClean(a.verhandlungsempfehlung) + '</p>';
    html += '</div>';
  }
  if (a.kaufpreis_offerte && typeof a.kaufpreis_offerte === 'object') {
    var kp = a.kaufpreis_offerte;
    html += '<div class="ai-block ai-block-offerte">';
    html += '<h3>💰 Kaufpreis-Offerte</h3>';
    if (kp.empfohlen) {
      html += '<div class="ai-offerte-price">' + _escClean(kp.empfohlen) + '</div>';
    }
    if (kp.begruendung) {
      html += '<p>' + _escClean(kp.begruendung) + '</p>';
    }
    if (Array.isArray(kp.argumente) && kp.argumente.length) {
      html += '<div class="ai-sub"><strong>Argumente für die Verhandlung:</strong></div>';
      html += list(kp.argumente);
    }
    html += '</div>';
  }
  if (Array.isArray(a.bankargumente) && a.bankargumente.length) {
    html += '<div class="ai-block ai-block-bank">';
    html += '<h3>🏦 Bankargumente</h3>';
    html += list(a.bankargumente);
    html += '</div>';
  }

  // 7. DealPilot Insight
  if (a.dealpilot_insight) {
    html += '<div class="ai-block ai-block-insight">';
    html += '<h3>💡 DealPilot-Insight</h3>';
    html += '<p style="font-style:italic">' + _escClean(a.dealpilot_insight) + '</p>';
    html += '</div>';
  }

  // Lage-Recherche
  if (a.makrolage_recherche || a.mikrolage_recherche || a.mietspiegel_eur_qm || a.kaufpreisniveau) {
    html += '<div class="ai-block ai-block-research"><h3>🌍 Markt-Recherche</h3>';
    if (a.makrolage_recherche)  html += '<div class="ai-sub"><strong>Makrolage:</strong> ' + _escClean(a.makrolage_recherche) + '</div>';
    if (a.mikrolage_recherche)  html += '<div class="ai-sub"><strong>Mikrolage:</strong> ' + _escClean(a.mikrolage_recherche) + '</div>';
    if (a.mietspiegel_eur_qm)   html += '<div class="ai-sub"><strong>Mietspiegel:</strong> ' + _escClean(a.mietspiegel_eur_qm) + ' €/m²</div>';
    if (a.kaufpreisniveau)      html += '<div class="ai-sub"><strong>Kaufpreisniveau:</strong> ' + _escClean(a.kaufpreisniveau) + '</div>';
    html += '</div>';
  }

  // Quellen — _esc reicht hier, das sind URLs
  if (Array.isArray(a.quellen) && a.quellen.length) {
    html += '<div class="ai-block ai-block-sources"><h3>🔗 Quellen</h3><ul>' +
            a.quellen.map(function(q){
              var url = ('' + q).match(/https?:\/\/\S+/);
              return '<li>' + (url ? '<a href="' + _esc(url[0]) + '" target="_blank" rel="noopener">' + _esc(q) + '</a>' : _esc(q)) + '</li>';
            }).join('') + '</ul></div>';
  }

  return html;
}

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
    var e = String(emp || '').toLowerCase();
    var color = '#C9A84C', label = emp || '—';
    if (e.indexOf('kaufen') === 0)     { color = '#3FA56C'; label = 'KAUFEN'; }
    else if (e.indexOf('nicht') === 0) { color = '#B8625C'; label = 'NICHT KAUFEN'; }
    else if (e.indexOf('prüfen') >= 0 || e.indexOf('pruefen') >= 0) { color = '#C9A84C'; label = 'PRÜFEN'; }
    return '<span class="ai-mini-empf" style="background:' + color + '">' + label + '</span>';
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
  var btn = document.getElementById('ai-mini-run');
  var body = document.getElementById('ai-mini-body');
  if (!btn || !body) return;

  // Im Local-Mode (kein Backend) gibt's keine Server-KI → Hinweis zum Tab KI-Analyse
  if (typeof Auth !== 'undefined' && Auth.isApiMode && !Auth.isApiMode()) {
    if (typeof toast === 'function') toast('Server-KI nur im Backend-Modus — bitte Tab "KI-Analyse" für Client-Modus nutzen');
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
          body.innerHTML = '<div class="ai-error">⚠ KI-Analyse-Limit erreicht. Bitte upgrade deinen Plan.</div>';
          btn.disabled = false; btn.textContent = 'Analyse starten';
          return;
        }
      }
    }

    var data = await Auth.apiCall('/ai/analyze', { method: 'POST', body: payload });
    if (data && data.analysis) {
      window._aiAnalysis = data.analysis;
      window._aiText = JSON.stringify(data.analysis, null, 2);
      _renderMiniAI(data.analysis);
      // Auch den großen Block in Tab s5 mit aktualisieren
      var aiContent = document.getElementById('ai-content');
      if (aiContent) aiContent.innerHTML = _renderAIServerAnalysis(data.analysis);
      if (typeof toast === 'function') toast('✓ KI-Analyse abgeschlossen');
      // V63.69: KI-Analyse persistieren
      if (typeof saveObj === 'function') {
        try { saveObj({ silent: true }); } catch(e) { console.warn('[ai] auto-save failed:', e); }
      }
    } else if (data && data.raw_text) {
      body.innerHTML = '<div class="ai-error">JSON-Parse fehlgeschlagen — Roh-Antwort siehe Tab "KI-Analyse".</div>';
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
 * Alte Client-seitige KI-Analyse (Fallback, wenn Backend keine KI-Recherche anbietet).
 */
async function _runAIClient(btn) {
  // Read API-Key + Model from Settings (preferred), then fallback to old fields
  var apiKey = '', model = 'gpt-4o-mini';
  if (typeof Settings !== 'undefined') {
    var s = Settings.get();
    apiKey = s.openai_api_key || '';
    model = s.openai_model || 'gpt-4o-mini';
  }
  if (!apiKey) apiKey = localStorage.getItem('ji_ak_oai') || '';
  if (!apiKey) {
    var inp = document.getElementById('api-key');
    apiKey = inp ? inp.value.trim() : '';
  }
  if (!apiKey) {
    btn.disabled = false;
    btn.textContent = '🤖 Analyse starten';
    toast('⚠ Bitte API-Key in Einstellungen eintragen');
    if (typeof showSettings === 'function') setTimeout(showSettings, 800);
    return;
  }
  var modelSel = document.getElementById('oai-model');
  if (modelSel && modelSel.value) model = modelSel.value;

  btn.textContent = '⏳ ChatGPT analysiert...';
  document.getElementById('ai-content').innerHTML =
    '<div class="ai-loading">' +
      '<div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>' +
      '<span style="margin-left:10px;color:rgba(255,255,255,.5);font-size:12px">ChatGPT (' + model + ') analysiert deine Kalkulation...</span>' +
    '</div>';

  try {
    var prompt = buildPrompt();
    // Track usage (and enforce plan limit) before calling OpenAI
    if (typeof Sub !== 'undefined' && Sub.isApiMode()) {
      try {
        await Sub.trackUsage('ai_analysis');
      } catch (e) {
        if (e.status === 403) {
          var box = document.getElementById('ai-content');
          if (box) box.innerHTML = '<div class="ai-error">⚠ KI-Analyse-Limit erreicht. Bitte upgrade deinen Plan.</div>';
          if (btn) { btn.disabled = false; btn.textContent = '🤖 Analyse starten'; }
          return;
        }
        console.warn('Usage tracking failed:', e.message);
      }
    }

    var res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 3500,
        messages: [
          { role: 'system', content: 'Du bist ein erfahrener Immobilieninvestmentberater und Sachverständiger in Deutschland. Antworte präzise und handlungsorientiert auf Deutsch.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!res.ok) {
      var ed = await res.json();
      throw new Error((ed.error && ed.error.message) || 'KI API Fehler ' + res.status);
    }
    var data = await res.json();
    var text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
    if (!text) throw new Error('Keine Antwort von ChatGPT');

    window._aiText = text;
    document.getElementById('ai-content').innerHTML = renderAIResponse(text);
    toast('✓ ChatGPT-Analyse abgeschlossen');
    // V63.69: KI-Analyse persistieren
    if (typeof saveObj === 'function') {
      try { saveObj({ silent: true }); } catch(e) { console.warn('[ai] auto-save failed:', e); }
    }

  } catch(e) {
    var msg = '⚠ Fehler: ' + e.message + '<br><br>' +
      'API-Key prüfen: <a href="https://platform.openai.com/api-keys" target="_blank" style="color:#C9A84C">platform.openai.com/api-keys →</a><br><br>' +
      'Guthaben prüfen: <a href="https://platform.openai.com/settings/organization/billing" target="_blank" style="color:#C9A84C">Billing →</a>';
    document.getElementById('ai-content').innerHTML = '<div class="ai-body" style="color:#f08080">' + msg + '</div>';
  }

  btn.disabled = false;
  btn.textContent = '✦ Analyse aktualisieren';
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
      case 'view-single':   if (typeof setMainView === 'function') setMainView('single'); break;
      case 'view-all':      if (typeof setMainView === 'function') setMainView('all'); break;
      case 'quickcheck':    if (typeof enterQuickCheckMode === 'function') enterQuickCheckMode(); break;
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
    single: 'fileText', all: 'folder', quickcheck: 'sparkles', new: 'plus',
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
    // V69-fix: Akkordeon-bottom dynamisch direkt über dem Trigger andocken.
    // Sidebar ist position:relative, Akkordeon position:absolute → bottom 0 wäre
    // unten am Sidebar-Rand. Wir setzen bottom = (Sidebar-Höhe - Trigger-Top) + 4px Spalt.
    try {
      var sidebar = document.querySelector('.sidebar') || document.getElementById('sidebar');
      if (btn && sidebar) {
        var sbRect = sidebar.getBoundingClientRect();
        var btnRect = btn.getBoundingClientRect();
        var bottomPx = (sbRect.bottom - btnRect.top) + 4;
        // V73-fix: setProperty mit 'important' priority — sonst gewinnt das CSS-bottom-!important
        acc.style.setProperty('bottom', bottomPx + 'px', 'important');
      }
    } catch (e) { /* fallback to CSS bottom */ }

    _sbActionsRenderIcons();
    _sbActionsSyncActive();
    setTimeout(function() {
      document.addEventListener('click', _sbActionsOutsideClick);
      document.addEventListener('keydown', _sbActionsEscHandler);
    }, 10);
  } else {
    document.removeEventListener('click', _sbActionsOutsideClick);
    document.removeEventListener('keydown', _sbActionsEscHandler);
  }
}

function _sbActionsOutsideClick(e) {
  var acc = document.getElementById('sb-actions-accordion');
  var btn = document.getElementById('sb-actions-trigger-btn');
  if (!acc) return;
  if (acc.contains(e.target) || (btn && btn.contains(e.target))) return;
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
    single: 'fileText', all: 'folder', quickcheck: 'sparkles', new: 'plus',
    trackrec: 'trophy', bankexport: 'bank',
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
    switch (action) {
      case 'view-single':   if (typeof setMainView === 'function') setMainView('single'); break;
      case 'view-all':      if (typeof setMainView === 'function') setMainView('all'); break;
      case 'quickcheck':    if (typeof enterQuickCheckMode === 'function') enterQuickCheckMode(); break;
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

/* V63.44: Mobile-Sidebar Drawer-Toggle */
window.toggleMobileSidebar = function() {
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('mobile-overlay');
  if (!sb || !ov) return;
  var isOpen = sb.classList.toggle('sb-mobile-open');
  ov.classList.toggle('active', isOpen);
};

// Mobile-Sidebar schließt sich nach Aktion
(function() {
  function closeMobileSidebarOnAction() {
    if (window.innerWidth > 768) return;
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('mobile-overlay');
    if (sb && sb.classList.contains('sb-mobile-open')) {
      sb.classList.remove('sb-mobile-open');
      if (ov) ov.classList.remove('active');
    }
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
  }
}
window.toggleKuecheKp = toggleKuecheKp;
window.syncKuecheToMoebl = syncKuecheToMoebl;
