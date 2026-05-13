'use strict';
/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN – main.js V5.2
   Initialisierung und Event-Binding
═══════════════════════════════════════════════════ */

function setDefaults() {
  sv('notar_p', 2.20);
  sv('gest_p',  6.50);
  sv('ji_p',    1.50);
  sv('d1z',     3.50);
  sv('d1t',     1.00);
  sv('d1_bindj',10);
  sv('mietstg', 3.0);
  sv('wertstg', 1.5);
  sv('kostenstg', 1.0);
  sv('leerstand', 0.0);
  sv('exit_bmy', 5.0);
  sv('anschl_z', 5.0);
  sv('anschl_t', 1.0);
  sv('anschl_bj', 15);
  // zaer wird automatisch aus anschl_z - d1z berechnet
  sv('geb_ant',  80);
  sv('grenz',    40.45);
  sv('btj', '15');
}

function loadExample() {
  // V157: Neutrale Beispielwerte — keine echten Stadt-/Straßen-Bezüge
  sv('kp',        200000);
  sv('ort',       'Musterstadt');
  sv('str',       'Musterstraße');
  sv('hnr',       '12');
  sv('plz',       '12345');
  sv('kuerzel',   'MS_MUS_12');
  sv('wfl',       80);
  sv('baujahr',   1995);
  sv('kaufdat',   '2024-12-23');
  sv('svwert',    250000);
  sv('bankval',   250000);
  sv('nkm',       800);
  sv('ze',        50);
  sv('umlagef',   150);
  sv('ek',        20000);
  sv('d1',        200000);
  sv('hg_ul',     1200);
  sv('grundsteuer', 300);
  sv('hg_nul',    1500);
  sv('weg_r',     800);
  sv('zve',       50000);
  sv('mea',       5);
  sv('gsfl',      500);
  sv('brw',       200);
  sv('thesis',    'ETW unter Marktwert – sofortiger Wertpuffer 50.000 €. Positiver Cashflow nach Steuern. Buy & Hold.');
}

/**
 * V49: Wie loadExample, aber Werte sind nur Placeholder (grauer Hint im Feld).
 * Beim ersten Klick verschwindet der Hint, User tippt ein.
 * Wird bei "Neues Objekt anlegen" verwendet.
 *
 * V157: Adress-Beispiele auf neutrale Werte umgestellt — keine echten
 * Stadt-/Straßen-Bezüge mehr.
 */
function loadExamplePlaceholders() {
  var examples = {
    kp:          '200000',
    ort:         'Musterstadt',
    str:         'Musterstraße',
    hnr:         '12',
    plz:         '12345',
    kuerzel:     'MS_MUS_12',
    wfl:         '80',
    baujahr:     '1995',
    kaufdat:     '',
    svwert:      '250000',
    bankval:     '250000',
    nkm:         '800',
    ze:          '50',
    umlagef:     '150',
    ek:          '20000',
    d1:          '200000',
    hg_ul:       '1200',
    grundsteuer: '300',
    hg_nul:      '1500',
    weg_r:       '800',
    zve:         '50000',
    mea:         '5',
    gsfl:        '500',
    brw:         '200',
    thesis:      'z.B. ETW unter Marktwert – Buy & Hold-Strategie'
  };
  Object.keys(examples).forEach(function(id) {
    var e = document.getElementById(id);
    if (!e) return;
    e.value = '';
    e.placeholder = examples[id];
    // Goldener Hauch im Placeholder
    e.classList.add('dp-example-placeholder');
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // Init Auth - if not logged in, show login modal
  if (typeof initAuth === 'function') {
    var loggedIn = initAuth();
    if (loggedIn && typeof renderSubscriptionBadge === 'function') {
      setTimeout(renderSubscriptionBadge, 300);
    }
  }

  setDefaults();
  // V172: Frischer Start → leere Felder mit Placeholder (statt echte Werte einzufüllen).
  // Verhindert dass neu registrierte User scheinbar "vorausgefüllte" Objekte sehen.
  if (typeof loadExamplePlaceholders === 'function') {
    loadExamplePlaceholders();
  } else {
    loadExample();  // Fallback
  }

  // V36: Beim ersten Start sofort eine Preview-ID anzeigen,
  // wenn noch kein Objekt geladen ist
  if (!window._currentObjSeq && typeof ObjNumbering !== 'undefined' && ObjNumbering.peekNextLocal) {
    window._currentObjSeq = ObjNumbering.peekNextLocal();
    window._objSeqIsPreview = true;
    if (typeof updHeader === 'function') updHeader();
  }

  // OpenAI API-Key laden
  var savedKey = localStorage.getItem('ji_ak_oai');
  if (savedKey) {
    var keyInp = document.getElementById('api-key');
    if (keyInp) keyInp.value = savedKey;
    st('key-status', '✓ OpenAI API-Key gespeichert (nur lokal)');
  }

  // Drag & Drop
  var dz = document.getElementById('drop-zone') || document.getElementById('dz');
  if (dz) {
    dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', function() { dz.classList.remove('drag'); });
    dz.addEventListener('drop', function(e) {
      e.preventDefault(); dz.classList.remove('drag');
      handleImgs(e.dataTransfer.files);
    });
  }

  // Tabs (nutzt switchTab aus ui.js, oder data-tab Attribut)
  document.querySelectorAll('.tab').forEach(function(tab, i) {
    tab.addEventListener('click', function() {
      var idx = parseInt(this.getAttribute('data-tab') || i || '0');
      if (typeof switchTab === 'function') switchTab(idx);
    });
  });

  // Header-Buttons
  var btnMap = {
    'btn-new':         newObj,
    'btn-csv':         exportCSV,
    'btn-pdf':         exportPDF,
    'btn-save':        saveObj,
    'btn-new2':        newObj,
    'btn-export-json': exportAllJSON,
    // Sidebar buttons
    'btn-save-sb':     saveObj,
    'btn-new-sb':      newObj,
    'sb-btn-export':   exportAllJSON
  };
  Object.keys(btnMap).forEach(function(id) {
    var e = document.getElementById(id);
    if (e) e.addEventListener('click', btnMap[id]);
  });

  // AI Button
  var aiBtn = document.getElementById('ai-btn');
  if (aiBtn) aiBtn.addEventListener('click', runAI);

  var btnIJ = document.getElementById('btn-import-json');
  var impFile = document.getElementById('imp-file');
  if (btnIJ && impFile) {
    btnIJ.addEventListener('click', function() { impFile.click(); });
    impFile.addEventListener('change', function() { importJSON(this); });
  }

  // Input-Events für Live-Berechnung
  var calcTriggers = ['kp','makler_p','notar_p','gba_p','gest_p','ji_p','san','moebl',
    'brw','mea','gsfl','nkm','ze','umlagef','afa_satz','geb_ant','zve','grenz',
    'ek','d1','d1z','d1t','d1_bindj','anschl_z','anschl_t','anschl_bj',
    'hg_ul','grundsteuer','ul_sonst','hg_nul','weg_r','eigen_r','mietausfall','nul_sonst',
    'kp1','kp2','kp3','kp4','mietstg','wertstg','kostenstg','leerstand','exit_bmy','btj',
    'svwert','bankval','wfl'];
  calcTriggers.forEach(function(id) {
    var e = document.getElementById(id);
    if (e) { e.addEventListener('input', calc); e.addEventListener('change', calc); }
  });

  // Header-Update
  ['str','hnr','ort','plz'].forEach(function(id) {
    var e = document.getElementById(id);
    if (e) e.addEventListener('input', updHeader);
  });


  // V22: Sidebar nicht mehr einklappbar — alte Settings cleanen
  var appWrap = document.querySelector('.app-wrap');
  if (appWrap) {
    appWrap.classList.remove('sb-collapsed');
    localStorage.removeItem('ji_sb_collapsed');
  }

  // V35: Mobile Sidebar Toggle (Off-Canvas <1024px)
  window.toggleMobileSidebar = function() {
    var aw = document.querySelector('.app-wrap');
    var bd = document.getElementById('sb-backdrop');
    var btn = document.getElementById('hdr-mobile-menu');
    if (!aw) return;
    var isOpen = aw.classList.toggle('sb-mobile-open');
    if (bd) bd.style.display = isOpen ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', isOpen);
    // Body-Scroll blocken wenn Sidebar offen
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  // Auf Resize: wenn auf Desktop zurück, Mobile-State zurücksetzen
  window.addEventListener('resize', function() {
    if (window.innerWidth > 1024) {
      var aw = document.querySelector('.app-wrap');
      var bd = document.getElementById('sb-backdrop');
      if (aw && aw.classList.contains('sb-mobile-open')) {
        aw.classList.remove('sb-mobile-open');
        if (bd) bd.style.display = 'none';
        document.body.style.overflow = '';
      }
    }
  });

  // Sidebar import button
  var sbBtnImport = document.getElementById('sb-btn-import');
  var sbImpFile = document.getElementById('sb-imp-file');
  if (sbBtnImport && sbImpFile) {
    sbBtnImport.addEventListener('click', function() { sbImpFile.click(); });
    sbImpFile.addEventListener('change', function() { importJSON(this); });
  }

  // Initial sidebar render
  if (typeof renderSaved === 'function') renderSaved();

  // Erste Berechnung
  calcNow();

  console.log('✓ Junker Immobilien Kalkulations-App V5.2 bereit');
});


// Wird von auth.js nach erfolgreichem Login aufgerufen
function onLoginSuccess(session) {
  // Update sidebar user display
  if (typeof updateUserDisplay === 'function') updateUserDisplay(session);
  // Show subscription badge in sidebar
  if (typeof renderSubscriptionBadge === 'function') {
    setTimeout(renderSubscriptionBadge, 200);
  }
  // Reload saved objects (user-specific now)
  if (typeof renderSaved === 'function') renderSaved();
  // Refresh portfolio summary
  if (typeof updateSidebarPortfolio === 'function') setTimeout(updateSidebarPortfolio, 600);

  // V49: Erstes Objekt automatisch laden (statt leeres Formular)
  setTimeout(function() {
    try {
      // Erste Card aus der Sidebar finden
      var firstCard = document.querySelector('.sb-list .sb-card[data-key]');
      if (firstCard && typeof loadSaved === 'function') {
        var key = firstCard.getAttribute('data-key');
        if (key) {
          loadSaved(key).catch(function(e) { console.warn('[V49] Auto-Load fail:', e); });
        }
      } else if (typeof calcNow === 'function') {
        // Kein Objekt vorhanden → leeres Formular bleibt + calc
        calcNow();
      }
    } catch (e) {
      console.warn('[V49] Auto-Load erstes Objekt fail:', e);
      if (typeof calcNow === 'function') calcNow();
    }
  }, 800);
}
