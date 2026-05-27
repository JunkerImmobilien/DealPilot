'use strict';

/* ──────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────── */
function parseDe(s){
  if(s==null) return 0;
  s = String(s).trim();
  if(!s) return 0;
  if(s.indexOf(',')>=0){ s = s.replace(/\./g,'').replace(',','.'); }
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
function fmtEur(v, dec){
  if(v==null||!isFinite(v)) return '—';
  dec = dec==null ? 2 : dec;
  return new Intl.NumberFormat('de-DE',{minimumFractionDigits:dec,maximumFractionDigits:dec}).format(v) + ' €';
}
function fmtEurInt(v){ return fmtEur(v,0); }
function fmtPct(v, dec){
  if(v==null||!isFinite(v)) return '—';
  dec = dec==null ? 2 : dec;
  return new Intl.NumberFormat('de-DE',{minimumFractionDigits:dec,maximumFractionDigits:dec}).format(v) + ' %';
}
function $(id){ return document.getElementById(id); }
function setText(id,t){ var e=$(id); if(e) e.textContent = t; }
function toast(msg){
  // V289.2: nutze DealPilot's eigenes Toast-System
  if(typeof window.toast === 'function' && window.toast !== toast){
    window.toast(msg); return;
  }
  // Fallback: Eigenes Toast falls window.toast fehlt
  var t = $('toast'); if(!t){ console.log('[bmf]', msg); return; }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 2400);
}


/* ──────────────────────────────────────────────────────
   Modal Steuerung — direkter Modus-Wechsel von der Card aus
   ────────────────────────────────────────────────────── */

// V289.2 PRODUCTION: Plan-Check via DealPilotConfig statt _SIMULATED_PLAN
function _hasBmfAdvanced(){
  try {
    if(window.DealPilotConfig && DealPilotConfig.pricing && typeof DealPilotConfig.pricing.hasFeature === 'function'){
      return DealPilotConfig.pricing.hasFeature('bmf_advanced');
    }
  } catch(_) {}
  return false;
}
function _currentObjectId(){
  return (window.State && State.objectId) || window._currentObjectId
       || (/\/object\/([0-9a-f-]+)/i.exec(window.location.pathname) || [])[1] || null;
}
function _token(){
  if(window.Sub && typeof Sub.getToken === 'function') return Sub.getToken();
  return localStorage.getItem('ji_token') || localStorage.getItem('auth_token') || localStorage.getItem('token');
}
function _authHeaders(){
  var t = _token();
  var h = { 'Content-Type': 'application/json' };
  if(t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

function openBMFFromMode(mode){
  // V289.2: Echter Plan-Check
  if(mode === 'advanced' && !_hasBmfAdvanced()){
    toast('🔒 Detaillierte Berechnung ist Teil des Pro-Plans');
    return;
  }
  if(mode === 'simple' && !_hasBmfAdvanced()){
    toast('🔒 BMF-Rechner ist Teil des Investor-Plans oder höher');
    return;
  }

  if(mode === 'simple'){
    // In der echten App: bestehender JS-BMF-Rechner (bmf-ui.js openBMFRechner)
    toast('Einfacher Modus — öffnet in der App den bestehenden BMF-Rechner');
    return;
  }

  // Detaillierter Modus: Werte aus Tab Investition lesen, dann Modal öffnen
  syncFromTabInvest();
  $('bmfOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function _mockupCloseBMFModal_unused(){
  $('bmfOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

/* ──────────────────────────────────────────────────────
   BIDIREKTIONALE SYNC Tab Investition ↔ BMF-Modal
   ────────────────────────────────────────────────────── */
function syncFromTabInvest(){
  // V289.2: Echte DealPilot-IDs → Modal-IDs mit .from-tab Markierung
  function _val(id){ var e = $(id); return e ? (e.value || '') : ''; }
  function _setField(id, val, isAuto){
    var e = $(id); if(!e) return;
    e.value = val;
    if(isAuto){
      e.classList.add('from-tab');
    }
  }
  function _formatEur(v){
    if(!v || !isFinite(v) || v === 0) return '';
    return new Intl.NumberFormat('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}).format(v);
  }

  // EUR-Felder aus Tab Investition (Nebenkosten)
  var eurPairs = [
    ['kp',       'ak_kp'],
    ['gest_e',   'ak_grest'],
    ['notar_e',  'ak_notar'],
    ['gba_e',    'ak_gba'],
    ['makler_e', 'ak_makler'],
    ['ji_e',     'ak_sonst'],   // ji_e ist 'Sonstige (€)' in Tab Investition
    ['san',      'ak_ahk']      // Sanierung als anschaffungsnahe HK
  ];
  eurPairs.forEach(function(p){
    var v = parseDe(_val(p[0]));
    if(v > 0) _setField(p[1], _formatEur(v), true);
  });

  // Eckdaten aus Tab Objekt (BMF-Aufteilung)
  _setField('bmf_bj', _val('baujahr'), true);
  _setField('bmf_datum', _val('kaufdat'), true);
  // Wohnfläche mit Komma-Format
  var wfl = parseDe(_val('wfl'));
  if(wfl > 0){
    _setField('bmf_wfl', wfl.toString().replace('.', ','), true);
  }
  // Grundstücksfläche
  var gsfl = parseDe(_val('gsfl'));
  if(gsfl > 0){
    _setField('bmf_gsfl', new Intl.NumberFormat('de-DE').format(gsfl), true);
  }
  // Bodenrichtwert
  var brw = parseDe(_val('brw'));
  if(brw > 0){
    _setField('bmf_brw', brw.toString().replace('.', ','), true);
  }
  // MEA (Prozent als String wie "7,10")
  var mea = parseDe(_val('mea'));
  if(mea > 0){
    _setField('bmf_mea', mea.toString().replace('.', ','), true);
  }

  // Cascade
  if(typeof calcAk === 'function') setTimeout(calcAk, 50);

  // Auto-Trigger BMF wenn alle Pflichtfelder voll
  setTimeout(_maybeAutoTriggerBmf, 200);
}

// V289.2: Auto-Berechnen wenn alle Pflichtfelder ausgefüllt
function _maybeAutoTriggerBmf(){
  var required = ['ak_kp', 'bmf_bj', 'bmf_datum', 'bmf_wfl', 'bmf_brw'];
  for(var i = 0; i < required.length; i++){
    var v = ($(required[i]) || {}).value || '';
    if(!v.trim()) return; // noch nicht alle Pflicht-Felder
  }
  // Alle Pflichtfelder voll → runBmf() automatisch
  if(typeof runBmf === 'function'){
    runBmf();
  }
}

function syncToTabInvest(){
  // Beim "Übernehmen": #g15_geplant → Tab Investition #san_invest
  var g15 = parseDe(($('g15_geplant') || {}).value);
  var sanEl = $('san_invest');
  if(sanEl){
    sanEl.value = g15 > 0 ? g15.toFixed(0) : '';
    // Live-Update der Anzeige im Tab Investition
    if(typeof updateTabInvestSync === 'function') updateTabInvestSync();
  }
}

document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && $('bmfOverlay').classList.contains('open')){
    closeBMFModal();
  }
});

function switchPane(id){
  // V289.2.3: Klassen-Fix — beim Mockup-Rename wurden HTML-Klassen .mtab → .bmfmo-tab
  // umbenannt, aber diese JS-Selektoren nicht mit gefixt → Tabs ohne Funktion.
  document.querySelectorAll('.bmfmo-tab').forEach(function(b){
    b.classList.toggle('active', b.dataset.pane === id);
  });
  document.querySelectorAll('.bmfmo-pane').forEach(function(p){
    p.classList.toggle('active', p.id === id);
  });
  // V289.2.3: Footer-Navigation aktualisieren
  if(typeof _updateFooterNav === 'function') _updateFooterNav(id);

  // V289.2.5: Pane-spezifische Render-Funktionen
  if(id === 'p-afa' && typeof _renderVergleich === 'function'){
    setTimeout(_renderVergleich, 30);
  }
  if(id === 'p-hebel'){
    if(typeof _syncSanierungViz === 'function') setTimeout(_syncSanierungViz, 30);
    if(typeof _renderKlauselText === 'function') setTimeout(_renderKlauselText, 30);
  }
  // Hebel-Tab: bei Aktivierung neu rendern (BMF-Werte könnten sich geändert haben)
  if(id === 'p-hebel'){
    updateInv();  // Triggert Cascade: Varianten, 15%, Risiko, Empfehlung, Klausel
  }
}


/* ──────────────────────────────────────────────────────
   Anschaffungskosten — Live-Summe
   ────────────────────────────────────────────────────── */
function calcAk(){
  var fields = ['ak_kp','ak_ahk','ak_grest','ak_notar','ak_gba','ak_makler','ak_ji',
                'ak_fahrt','ak_verpfl','ak_hotel',
                'ak_gutachten','ak_anwalt','ak_sonst'];
  var total = 0;
  fields.forEach(function(id){
    var el = $(id); if(!el) return;
    total += parseDe(el.value);
  });
  setText('ak_total', '€ ' + fmtEur(total,2).replace(' €',''));
  setText('r_ak_show', fmtEur(total,2));
  // AfA-Vorschau aktualisieren
  updateAfaPreview(total);
}

function calcFahrt(){
  var km = parseDe($('ak_fahrt_km').value);
  var satz = parseDe($('ak_fahrt_satz').value);
  if(km > 0 && satz > 0){
    var total = km * satz;
    $('ak_fahrt').value = fmtEur(total,2).replace(' €','').trim();
    calcAk();
  }
}


/* ──────────────────────────────────────────────────────
   Verfahrens-Toggle
   ────────────────────────────────────────────────────── */
var VERF_INFOS = {
  auto: '<strong>Automatik</strong> — BMF-Logik wählt das passende Verfahren: bekannter Vergleichsfaktor → Vergleichswert, sonst bekannte Miete → Ertragswert, sonst Sachwert.',
  ertrag: '<strong>Ertragswertverfahren</strong> — Standard für Renditeobjekte mit bekannter Miete. Wird vom Finanzamt anerkannt, wenn ein lokaler Liegenschaftszinssatz vorliegt.',
  sach: '<strong>Sachwertverfahren</strong> — Fallback für Eigennutzung (EFH/ZFH ohne Vermietung). Basiert auf Bodenwert + Gebäudesachwert nach BGF-Kostenkennwerten.',
  vergl: '<strong>Vergleichswertverfahren</strong> — Nur wenn lokaler Vergleichsfaktor des Gutachterausschusses vorliegt. Bei ETW oft am genauesten.'
};
function setVerf(v){
  document.querySelectorAll('.verf-btn').forEach(function(b){
    b.classList.toggle('active', b.dataset.verf === v);
  });
  $('verf-info').innerHTML = VERF_INFOS[v];
}


/* ──────────────────────────────────────────────────────
   BMF-Demos (gecachte Werte aus realem Roundtrip)
   ────────────────────────────────────────────────────── */
var DEMOS = {
  etw1998: {
    art:'Wohnungseigentum [WE]', datum:'2021-09-23', kp:'139.178,00', bj:1998, wfl:'118',
    gsfl:'2.393', brw:'130', mea:'7,10', miete:'753,00',
    result: { bodenwert:22087.39, sachwert:213483.39, ertragswert:182257.50, vergleichswert:0,
              verkehr:182257.50, geb_pct:87.89, kp_grund:16854.46, kp_geb:122323.54 }
  },
  real1: {
    art:'Wohnungseigentum [WE]', datum:'2021-09-23', kp:'91.656,00', bj:1998, wfl:'68',
    gsfl:'2.393', brw:'130', mea:'4,10', miete:'541,00',
    result: { bodenwert:12754.69, sachwert:123050.69, ertragswert:132884.96, vergleichswert:0,
              verkehr:132884.96, geb_pct:90.41, kp_grund:8789.81, kp_geb:82866.19 }
  },
  real2: {
    art:'Wohnungseigentum [WE]', datum:'2021-09-23', kp:'138.519,34', bj:1998, wfl:'118',
    gsfl:'2.393', brw:'130', mea:'7,10', miete:'935,00',
    result: { bodenwert:22087.39, sachwert:213483.39, ertragswert:236065.15, vergleichswert:0,
              verkehr:236065.15, geb_pct:90.65, kp_grund:12951.56, kp_geb:125567.78 }
  },
  real3: {
    art:'Wohnungseigentum [WE]', datum:'2024-12-18', kp:'186.936,47', bj:1994, wfl:'96,2',
    gsfl:'1.570', brw:'120', mea:'7,10', miete:'748,80',
    result: { bodenwert:13376.40, sachwert:151616.40, ertragswert:158696.68, vergleichswert:0,
              verkehr:158696.68, geb_pct:91.58, kp_grund:15740.05, kp_geb:171196.42 }
  }
};

function loadDemo(key){
  var d = DEMOS[key]; if(!d) return;
  $('bmf_art').value = d.art;
  $('bmf_datum').value = d.datum;
  $('bmf_bj').value = d.bj;
  $('bmf_wfl').value = d.wfl;
  $('bmf_gsfl').value = d.gsfl;
  $('bmf_brw').value = d.brw;
  $('bmf_mea').value = d.mea;
  $('bmf_miete').value = d.miete;
  // Reset modernisierungs-Selects
  ['mod_dach','mod_fenster','mod_leit','mod_heiz','mod_daemm','mod_bad','mod_innen','mod_grdr'].forEach(function(id){
    if($(id)) $(id).value = 'nein';
  });
  $('bmfResult').style.display = 'none';
  $('bmfStatus').className = 'banner info';
  $('bmfStatus').innerHTML = '<strong>Demo geladen:</strong> ' + key.toUpperCase() + ' — auf „Berechnen" tippen.';
  $('btnDl').disabled = true;
  toast('Demo ' + key + ' geladen');
}

function runBmf(){
  // V289.2: Echter Backend-Call statt Mock
  // V289.2.5 Issue #5/6: Lage aus echten DealPilot-Feldern (plz/ort/str/hnr) statt ak_plz/etc.
  //                       + _lastBmfInputs persistieren für XLSX-Download
  var btn = $('btnBmf');
  var hint = $('bmfAutoHint');
  if(btn){ btn.disabled = true; }
  if(hint){ hint.textContent = 'Berechnung läuft...'; }

  function _v(id){ var e = document.getElementById(id); return e ? (e.value || '').trim() : ''; }
  var inputs = {
    lage: (_v('str') + ' ' + _v('hnr')).trim() + ', ' + (_v('plz') + ' ' + _v('ort')).trim(),
    grundstuecksart: ($('bmf_art') || {}).value || 'Wohnungseigentum [WE]',
    kaufdatum: ($('bmf_datum') || {}).value || _v('kaufdat') || '',
    kaufpreis: parseDe(($('ak_kp') || {}).value) || parseDe(_v('kp')),
    baujahr: parseInt(($('bmf_bj') || {}).value || _v('baujahr')) || 0,
    wohnflaeche: parseDe(($('bmf_wfl') || {}).value || _v('wfl')),
    grundstuecksgroesse: parseDe(($('bmf_gsfl') || {}).value || _v('gsfl')),
    bodenrichtwert: parseDe(($('bmf_brw') || {}).value || _v('brw')),
    mea_zaehler: 0,
    mea_nenner: 0,
    miete_bekannt: ($('bmf_miete') && parseDe($('bmf_miete').value) > 0) ? 'Ja' : 'Nein',
    miete_monatlich: parseDe(($('bmf_miete') || {}).value),
    vergleichsfaktor_vorhanden: 'Nein',
    regionalfaktor: 1,
    sachwertfaktor: parseDe(($('bmf_lzs') || {}).value) > 0 ? parseDe(($('bmf_lzs') || {}).value) : 1
  };

  // V289.2.5 Issue #6: für späteren XLSX-Download
  window._lastBmfInputs = inputs;

  fetch('/api/v1/bmf/aufteilung', {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({ inputs: inputs, include_file: false })
  })
  .then(function(r){
    if(!r.ok){ return r.json().then(function(e){ throw new Error(e.error || 'HTTP ' + r.status); }); }
    return r.json();
  })
  .then(function(data){
    if(!data.ok || !data.results){
      throw new Error('Unerwartete Antwort vom Backend');
    }
    window._lastBmfResults = data.results;
    renderBmfResult(data.results, null);
    if(hint){ hint.textContent = '✓ Berechnung aktualisiert (' + new Date().toLocaleTimeString('de-DE') + ')'; }
    // Persistenz
    _persistBmfState();
  })
  .catch(function(err){
    console.error('[bmf] runBmf failed:', err);
    if(hint){ hint.textContent = 'Fehler: ' + err.message; hint.style.color = 'var(--red,#B8625C)'; }
    toast('Fehler bei BMF-Berechnung: ' + err.message);
  })
  .finally(function(){
    if(btn){ btn.disabled = false; }
  });
}

function renderBmfResult(results, demoLabel){
  if(!results) return;
  function val(key){ var r = results[key]; return r && (typeof r.value !== 'undefined') ? r.value : null; }
  var afaBasis = val('kaufpreisanteil_gebaeude');
  var gebanteil = val('gebaeudeanteil_prozent');
  // updateAfaPreview falls vorhanden
  if(typeof updateAfaPreview === 'function'){
    updateAfaPreview(afaBasis || 0);
  }
  // Mockup-Helfer: setText auf div-IDs
  if(typeof setText === 'function'){
    setText('bmf_geb_anteil', gebanteil != null ? gebanteil.toFixed(2).replace('.', ',') + ' %' : '—');
    setText('bmf_afa_basis', afaBasis != null ? fmtEur(afaBasis, 2) : '—');
  }
  // PDF-Button aktivieren
  var pdfBtn = $('btnBmfPdf');
  if(pdfBtn) pdfBtn.disabled = false;
}

function exportBmfPdf(){
  if(!window._lastBmfResults){
    toast('Bitte erst Berechnen lassen');
    return;
  }
  if(typeof window.generateBmfPdfAnlage !== 'function'){
    toast('PDF-Modul nicht geladen');
    return;
  }
  var state = {
    inputs: {
      lage: ($('ak_str') ? $('ak_str').value : '') + ', ' + ($('ak_plz') ? $('ak_plz').value : '') + ' ' + ($('ak_ort') ? $('ak_ort').value : ''),
      grundstuecksart: ($('bmf_art') || {}).value || '',
      kaufdatum: ($('bmf_datum') || {}).value || '',
      kaufpreis: parseDe(($('ak_kp') || {}).value),
      baujahr: parseInt(($('bmf_bj') || {}).value) || 0,
      wohnflaeche: parseDe(($('bmf_wfl') || {}).value),
      grundstuecksgroesse: parseDe(($('bmf_gsfl') || {}).value),
      bodenrichtwert: parseDe(($('bmf_brw') || {}).value)
    },
    results: window._lastBmfResults,
    gaa: window._lastGaa || null
  };
  window.generateBmfPdfAnlage(state);
}

function _mockupRenderBmfResult(r, demoLabel){
  setText('r_geb_pct', fmtPct(r.geb_pct));
  setText('r_grund_pct', fmtPct(100 - r.geb_pct));

  $('bar_grund').style.width = (100 - r.geb_pct).toFixed(2) + '%';
  $('bar_geb').style.width = r.geb_pct.toFixed(2) + '%';
  setText('leg_grund', fmtPct(100 - r.geb_pct));
  setText('leg_geb', fmtPct(r.geb_pct));

  // KP-Anteile auf die AKTUELLE AK-Summe rechnen (nicht nur den Notarpreis-KP)
  var akTotal = parseDe($('ak_total').textContent.replace('€','').trim()) || parseDe($('ak_kp').value);
  var kpGeb = akTotal * r.geb_pct / 100;
  var kpGrund = akTotal - kpGeb;
  setText('r_kp_grund', fmtEur(kpGrund,2));
  setText('r_kp_geb', fmtEur(kpGeb,2));
  setText('r_ak_show', fmtEur(akTotal,2));

  setText('r_bw', fmtEurInt(r.bodenwert));
  setText('r_sw', fmtEurInt(r.sachwert));
  setText('r_ew', fmtEurInt(r.ertragswert));
  setText('r_vw', fmtEurInt(r.verkehr));

  $('bmfResult').style.display = '';
  $('btnDl').disabled = false;

  var sb = $('bmfStatus');
  sb.className = 'banner ok';
  sb.innerHTML = '<strong>✓ Berechnung abgeschlossen.</strong> Quelle: BMF-Vorlage Fassung Juni 2023 — Ertragswertverfahren als maßgebend. ' +
    '<br><span style="font-size:11.5px;color:var(--muted);font-style:italic">Gebäudeanteil ' + fmtPct(r.geb_pct) + ', AfA-Basis ' + fmtEur(kpGeb,2) + '</span>';

  toast('BMF-Ergebnis: ' + fmtPct(r.geb_pct) + ' Gebäudeanteil');

  window._lastBmf = r;
  // AfA-Vorschau aktualisieren
  updateAfaPreview(akTotal);
}

function downloadXlsx(){
  // V289.2: Echter Backend-Call mit include_file:true
  var inputs = window._lastBmfInputs;
  if(!inputs){ toast('Bitte erst Berechnen'); return; }
  toast('XLSX wird generiert...');
  fetch('/api/v1/bmf/aufteilung', {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify({ inputs: inputs, include_file: true })
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    if(!data.ok || !data.file_base64){ throw new Error('Kein File in Antwort'); }
    var bytes = atob(data.file_base64);
    var buf = new Uint8Array(bytes.length);
    for(var i = 0; i < bytes.length; i++){ buf[i] = bytes.charCodeAt(i); }
    var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = data.file_name || 'BMF_Aufteilung.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('XLSX heruntergeladen');
  })
  .catch(function(err){ toast('Download-Fehler: ' + err.message); });
}


/* ──────────────────────────────────────────────────────
   AfA-Vorschau
   ────────────────────────────────────────────────────── */
function updateAfaPreview(ak_total){
  var r = window._lastBmf;
  var ak = ak_total != null ? ak_total : 94224.83;
  var geb_pct = r ? r.geb_pct : 80;
  var afa_satz = parseDe($('afa_satz').value) || 3.0;

  var afa_basis = ak * geb_pct / 100;
  var afa_jahr = afa_basis * afa_satz / 100;
  var grenz = 0.4045;
  var save = afa_jahr * grenz;
  var save50 = save * 50;

  setText('afa_show_ak', fmtEur(ak,2));
  setText('afa_show_pct', fmtPct(geb_pct));
  setText('afa_show_satz', fmtPct(afa_satz,1));
  setText('afa_show_save', fmtEur(save,0));
  setText('afa_show_save50', '~' + fmtEur(save50,0).replace(' €','').trim() + ' €');
  setText('afa_basis', fmtEurInt(afa_basis));
  setText('afa_jahr_big', fmtEur(afa_jahr,2));
  setText('afa_total', fmtEurInt(afa_jahr * 50));
}


/* ──────────────────────────────────────────────────────
   Übernehmen → in den Steuer-Tab
   ────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────
   V282 — AfA-Optimierung (Spec-konform)
   Schritte aus Spec:
     1. Inventar abziehen
     2. BMF-/Marktvergleich
     3. 3 Varianten (Konservativ/Moderat/Optimiert)
     4. Kaufvertrag-Ausgabe
     5. NK-Verteilung
     6. 15-%-Grenze
     7. Steuer-Vorteilsauswertung
     8. Risikoampel
     9. Empfehlung
     10. Disclaimer
   ────────────────────────────────────────────────────── */

var _varChoice = 'konservativ';   // Default: BMF-Standard

// ── 1) Inventar ──────────────────────────────────────────
function updateInv(){
  /* V292.3-v289-bugfixes: defensive Null-Checks + V291-Field-Mapping
   * Vorher: $('inv_moebl').value (gibts nicht; heißt 'inv_moebel')
   * Vorher: Crash wenn Element null
   * Jetzt: alle 6 V291-Felder, mit Null-Safe Pattern
   */
  function _safeVal(id){
    var el = document.getElementById(id);
    return (el && el.value) ? parseDe(el.value) : 0;
  }
  var k  = _safeVal('inv_kueche');
  var m  = _safeVal('inv_moebel') || _safeVal('inv_moebl'); /* V291 hat 'moebel', V289 Bug nutzte 'moebl' */
  var g  = _safeVal('inv_geraete');
  var p  = _safeVal('inv_pv');
  var sp = _safeVal('inv_stellplatz');
  var s  = _safeVal('inv_sonst');
  var total = k + m + g + p + sp + s;

  // Brutto-KP (laut Notarvertrag, aus ak_kp Tab oder Default)
  var bruttoKp = parseDe($('ak_kp').value) || 87569.13;

  setText('imm_brutto', fmtEur(bruttoKp,2));
  setText('imm_inv', '− ' + fmtEur(total,2));
  setText('imm_netto', fmtEur(bruttoKp - total,2));

  // Disclaimer-Text anpassen
  var txt = 'Aus Tab Investition übernommen: <strong>' + fmtEur(total,2) + '</strong> bewegliche Wirtschaftsgüter';
  var parts = [];
  if(k > 0) parts.push('Küche ' + fmtEur(k,0));
  if(m > 0) parts.push('Möbel ' + fmtEur(m,0));
  if(p > 0) parts.push('PV ' + fmtEur(p,0));
  if(s > 0) parts.push('Sonstiges ' + fmtEur(s,0));
  if(parts.length) txt += ' <span style="color:var(--muted);font-style:italic">(' + parts.join(', ') + ')</span>';
  txt += '. Diese werden separat über 10 Jahre abgeschrieben und nicht in die Grund/Boden/Gebäude-Aufteilung einbezogen.';
  $('invDisclaimerText').innerHTML = txt;

  // Plausibilitäts-Warnung: Inventar > 15 % vom Brutto-KP = auffällig
  var invQuote = bruttoKp > 0 ? (total / bruttoKp) * 100 : 0;
  var warnEl = $('invWarning');
  var warnText = $('invWarningText');
  if(invQuote > 15){
    warnEl.style.display = '';
    warnText.innerHTML = 'Inventaranteil von <strong>' + fmtPct(invQuote,1) + '</strong> ist ungewöhnlich hoch und kann vom Finanzamt hinterfragt werden. Empfohlen: Wertgutachten oder Einzelnachweise (Rechnungen, Kaufbelege) bereithalten.';
  } else if(invQuote > 8){
    /* V292.4-v289-bugs-5-6: defensive null-checks */
    if (warnEl) {
      warnEl.style.display = '';
      warnEl.className = 'banner gold';
      warnEl.style.marginTop = '10px';
      warnEl.style.marginBottom = '0';
      warnEl.style.fontSize = '11.5px';
    }
    if (warnText) {
      warnText.innerHTML = 'Inventaranteil <strong>' + fmtPct(invQuote,1) + '</strong> — erklärungsbedürftig, aber belegbar. Belege/Wertnachweise empfohlen.';
    }
  } else {
    if (warnEl) warnEl.style.display = 'none';
  }

  // Cascading-Render: Varianten + 15% + Risiko + Klausel
  renderVarGrid();
  updateG15();
  renderRiskGrid();
  renderEmpfehlung();
  renderKlausel();
}


// ── 2-3) Varianten (Konservativ / Moderat / Optimiert) ──
function _varianten(){
  var r = window._lastBmf;
  if(!r) return [];

  // Immobilien-KP = Brutto-KP − Inventar
  var bruttoKp = parseDe($('ak_kp').value) || 87569.13;
  var inv = (parseDe($('inv_kueche').value) || 0) +
            (parseDe($('inv_moebl').value)  || 0) +
            (parseDe($('inv_pv').value)     || 0) +
            (parseDe($('inv_sonst').value)  || 0);
  var immoKp = Math.max(0, bruttoKp - inv);

  // BMF-Aufteilung
  var bmfGebPct = r.geb_pct;
  var bmfBodenPct = 100 - bmfGebPct;
  var bmfBodenEur = immoKp * bmfBodenPct / 100;
  var bmfGebEur = immoKp - bmfBodenEur;

  // Moderat: Bodenanteil × 0,90 (= −10 %) — geringfügige Abweichung, BFH-konform
  var modBodenEur = bmfBodenEur * 0.90;
  var modGebEur = immoKp - modBodenEur;
  var modGebPct = immoKp > 0 ? (modGebEur / immoKp) * 100 : 0;
  var modBodenPct = 100 - modGebPct;

  // Optimiert: Bodenanteil × 0,75 (= −25 %) — Plausibilitätsgrenze
  var optBodenEur = bmfBodenEur * 0.75;
  var optGebEur = immoKp - optBodenEur;
  var optGebPct = immoKp > 0 ? (optGebEur / immoKp) * 100 : 0;
  var optBodenPct = 100 - optGebPct;

  return [
    {
      key:'konservativ',
      stufe:'Variante 1',
      label:'Konservativ',
      sub:'Aufteilung exakt nach BMF',
      immoKp: immoKp,
      bodenPct: bmfBodenPct,
      gebPct: bmfGebPct,
      bodenEur: bmfBodenEur,
      gebEur: bmfGebEur,
      risk:'green',
      riskLabel:'Anerkannt — keine Begründung nötig'
    },
    {
      key:'moderat',
      stufe:'Variante 2',
      label:'Moderat',
      sub:'Bodenanteil −10 % · BFH-konform',
      immoKp: immoKp,
      bodenPct: modBodenPct,
      gebPct: modGebPct,
      bodenEur: modBodenEur,
      gebEur: modGebEur,
      risk:'green',
      riskLabel:'Geringfügige Abweichung (BFH IX R 12/14)'
    },
    {
      key:'optimiert',
      stufe:'Variante 3',
      label:'Optimiert',
      sub:'Bodenanteil −25 % · Begründung empfohlen',
      immoKp: immoKp,
      bodenPct: optBodenPct,
      gebPct: optGebPct,
      bodenEur: optBodenEur,
      gebEur: optGebEur,
      risk:'gold',
      riskLabel:'Begründung empfohlen (BFH IX R 26/19)'
    }
  ];
}


function renderVarGrid(){
  var grid = $('varGrid');
  if(!grid) return;
  var varianten = _varianten();
  if(varianten.length === 0){
    grid.innerHTML = '<div class="banner err">Bitte zuerst eine BMF-Berechnung durchführen (Pane „BMF-Aufteilung")</div>';
    return;
  }

  // AfA-Satz aus Steuer-Tab
  var afaSatz = parseDe($('afa_satz').value) || 2.0;

  // NK-Anteil pro Variante: Gebäude-NK = immobilienbezogene NK × Gebäudequote
  // (immobilienbezogene NK = AK-Total − Brutto-Kaufpreis, also nur die NK ohne KP)
  var akTotal = parseDe($('ak_total').textContent.replace('€','').trim()) || 94224.83;
  var bruttoKp = parseDe($('ak_kp').value) || 87569.13;
  var nkImmo = Math.max(0, akTotal - bruttoKp);

  // BMF-Variante als Referenz für Delta
  var bmfAfa = (varianten[0].gebEur + nkImmo * varianten[0].gebPct/100) * afaSatz/100;

  var html = '';
  varianten.forEach(function(va){
    var gebAk = va.gebEur + (nkImmo * va.gebPct/100);
    var afaJahr = gebAk * afaSatz/100;
    var delta = afaJahr - bmfAfa;
    var isActive = (va.key === _varChoice);

    html += '<button class="var-card' + (isActive ? ' active' : '') + '" onclick="chooseVar(\'' + va.key + '\')" type="button">' +
      '<div class="var-stufe">' + va.stufe + ' · ' + va.label + '</div>' +
      '<div class="var-h">' + va.sub + '</div>' +
      '<div class="var-pct-row"><span>Grund &amp; Boden</span><span class="v">' + fmtPct(va.bodenPct,1) + '</span></div>' +
      '<div class="var-pct-row"><span>Gebäude</span><span class="v">' + fmtPct(va.gebPct,1) + '</span></div>' +
      '<div class="var-divider"></div>' +
      '<div class="var-afa"><span>AfA / Jahr</span><span class="v">' + fmtEur(afaJahr,0) + '</span></div>' +
      (delta > 0 ? '<div class="var-delta">▲ +' + fmtEur(delta,0).replace('€','').trim() + ' €/J vs. BMF</div>'
                 : (delta < 0 ? '<div class="var-delta neg">▼ ' + fmtEur(delta,0) + '/J vs. BMF</div>'
                              : '<div class="var-delta neg">Basis-Variante</div>')) +
      '<div class="var-risk">' +
        '<span class="var-risk-dot ' + va.risk + '"></span>' +
        '<span class="var-risk-label">' + va.riskLabel + '</span>' +
      '</div>' +
    '</button>';
  });
  grid.innerHTML = html;
  renderVarImpact();
}


function chooseVar(key){
  _varChoice = key;
  renderVarGrid();
  updateG15();
  renderRiskGrid();
  renderEmpfehlung();
  renderKlausel();
}


function renderVarImpact(){
  // V3: Element wurde aus Pane 4 entfernt — graceful no-op
  var box = $('varImpact');
  if(!box) return;

  var varianten = _varianten();
  var chosen = varianten.find(function(v){ return v.key === _varChoice; }) || varianten[0];
  if(!chosen) return;
  var bmf = varianten[0];
  var afaSatz = parseDe($('afa_satz').value) || 2.0;
  var akTotal = parseDe($('ak_total').textContent.replace('€','').trim()) || 94224.83;
  var bruttoKp = parseDe($('ak_kp').value) || 87569.13;
  var nkImmo = Math.max(0, akTotal - bruttoKp);
  var grenz = 0.4045;

  var gebAkChosen = chosen.gebEur + (nkImmo * chosen.gebPct/100);
  var gebAkBmf = bmf.gebEur + (nkImmo * bmf.gebPct/100);
  var afaChosen = gebAkChosen * afaSatz/100;
  var afaBmf = gebAkBmf * afaSatz/100;
  var deltaAfa = afaChosen - afaBmf;
  var deltaSpar = deltaAfa * grenz;
  var rnd = Math.round(100/afaSatz);
  var deltaTotal = deltaSpar * rnd;

  var txtEl = $('varImpactText');
  if(!txtEl) return;
  if(chosen.key === 'konservativ'){
    txtEl.innerHTML = 'BMF-Standard-Aufteilung. Gebäude-AK: <strong>' +
      fmtEur(gebAkChosen,0) + '</strong>, jährliche AfA: <strong>' + fmtEur(afaChosen,0) + '</strong>.';
  } else {
    txtEl.innerHTML =
      'Gegenüber BMF: <strong style="color:var(--gold-d)">+' + fmtEur(deltaAfa,0) + ' AfA/Jahr</strong> · ' +
      'bei 40,45 % Grenzsteuer = <strong style="color:var(--green)">+' + fmtEur(deltaSpar,0) + '/J</strong> · ' +
      'kumuliert über ' + rnd + ' Jahre: <strong>~' + fmtEur(deltaTotal,0) + '</strong>.';
  }
}


// ── 6) 15-%-Grenze ─────────────────────────────────────
function updateG15(){
  var varianten = _varianten();
  var chosen = varianten.find(function(v){ return v.key === _varChoice; }) || varianten[0];
  if(!chosen) return;
  var akTotal = parseDe($('ak_total').textContent.replace('€','').trim()) || 94224.83;
  var bruttoKp = parseDe($('ak_kp').value) || 87569.13;
  var nkImmo = Math.max(0, akTotal - bruttoKp);
  var gebAk = chosen.gebEur + (nkImmo * chosen.gebPct/100);
  var max15 = gebAk * 0.15;

  var geplant = parseDe($('g15_geplant').value) || 0;
  var puffer = max15 - geplant;
  var quote = max15 > 0 ? (geplant / max15) * 100 : 0;

  setText('g15_max', fmtEur(max15,2));
  setText('g15_basis', fmtEur(gebAk,2));

  // Puffer/Überschreitung
  var pufferEl = $('g15_puffer');
  var statusEl = $('g15_status');
  var barEl = $('g15_bar');

  if (pufferEl) pufferEl.textContent = fmtEur(Math.abs(puffer),2); /* V292.4-v289-bugs-5-6 */
  if(puffer >= max15 * 0.30){
    pufferEl.style.color = 'var(--green)';
    statusEl.textContent = 'Genug Puffer';
    statusEl.style.color = 'var(--green)';
    barEl.style.background = 'var(--green)';
  } else if(puffer >= 0){
    pufferEl.style.color = 'var(--gold-d)';
    statusEl.textContent = 'Knapp am Limit';
    statusEl.style.color = 'var(--gold-d)';
    barEl.style.background = 'var(--gold)';
  } else {
    pufferEl.style.color = 'var(--red)';
    pufferEl.textContent = '+ ' + fmtEur(Math.abs(puffer),2);
    statusEl.innerHTML = '<strong>Überschritten</strong>';
    statusEl.style.color = 'var(--red)';
    barEl.style.background = 'var(--red)';
  }
  barEl.style.width = Math.min(100, quote) + '%';

  // V3: Mock Tab Investition synchron halten (zeigt Max-Grenze)
  var maxEl = $('san_limit_max_invest');
  if(maxEl) maxEl.textContent = fmtEur(max15,2);
}


/* ──────────────────────────────────────────────────────
   V3: Mock Tab Investition Sync
   ────────────────────────────────────────────────────── */
function updateTabInvestSync(){
  // Wenn der User direkt im Tab Investition #san_invest tippt
  var sanInvest = parseDe(($('san_invest') || {}).value);
  var g15El = $('g15_geplant');
  var statusEl = $('san_invest_status');
  var statusTxt = $('san_invest_status_text');

  // Live in den BMF-Rechner spiegeln (falls Modal offen)
  if(g15El && sanInvest !== parseDe(g15El.value)){
    g15El.value = sanInvest > 0 ? sanInvest.toFixed(0) : '';
    if(typeof updateG15 === 'function') updateG15();
  }

  // Status-Banner
  if(statusEl && statusTxt){
    if(sanInvest === 0){
      statusEl.style.display = 'none';
    } else {
      // Max-Limit aus aktueller Variante
      var varianten = (typeof _varianten === 'function') ? _varianten() : [];
      var chosen = varianten.find(function(v){ return v.key === _varChoice; }) || varianten[0];
      if(chosen){
        var akTotal = parseDe($('ak_total').textContent.replace('€','').trim()) || 94224.83;
        var bruttoKp = parseDe($('ak_kp').value) || 87569.13;
        var nkImmo = Math.max(0, akTotal - bruttoKp);
        var gebAk = chosen.gebEur + (nkImmo * chosen.gebPct/100);
        var max15 = gebAk * 0.15;
        statusEl.style.display = '';
        if(sanInvest > max15){
          statusEl.className = 'banner err';
          statusEl.style.marginTop = '10px';
          statusEl.style.fontSize = '11.5px';
          statusTxt.innerHTML = '<strong>15-%-Grenze überschritten</strong> · ' +
            fmtEur(sanInvest,0) + ' > ' + fmtEur(max15,0) + ' (Max). Renovierung wird zu AHK · 50-Jahre-AfA.';
        } else if(sanInvest > max15 * 0.80){
          statusEl.className = 'banner gold';
          statusEl.style.marginTop = '10px';
          statusEl.style.fontSize = '11.5px';
          statusTxt.innerHTML = '<strong>Knapp am Limit</strong> · ' +
            fmtEur(sanInvest,0) + ' von ' + fmtEur(max15,0) + ' (Max).';
        } else {
          statusEl.className = 'banner ok';
          statusEl.style.marginTop = '10px';
          statusEl.style.fontSize = '11.5px';
          statusTxt.innerHTML = '<strong>Im grünen Bereich</strong> · ' +
            fmtEur(sanInvest,0) + ' von ' + fmtEur(max15,0) + ' (Max). Voll absetzbar als Werbungskosten.';
        }
      }
    }
  }
}


// ── 8) Risikoampel (V3: aus Pane 4 entfernt, no-op wenn Elemente fehlen) ──
function renderRiskGrid(){
  // Schnell-Exit wenn Risiko-Grid nicht im DOM
  if(!$('risk_aufteilung')) return;

  var varianten = _varianten();
  var chosen = varianten.find(function(v){ return v.key === _varChoice; }) || varianten[0];
  if(!chosen) return;

  // 1) Vertragsaufteilung
  var aufDot = $('risk_aufteilung').querySelector('.risk-dot');
  var aufSub = $('risk_aufteilung').querySelector('.risk-sub');
  if(aufDot) aufDot.className = 'risk-dot ' + chosen.risk;
  if(aufSub) aufSub.textContent = chosen.riskLabel;

  // 2) Inventarwerte
  var inv = (parseDe($('inv_kueche').value) || 0) +
            (parseDe($('inv_moebl').value) || 0) +
            (parseDe($('inv_pv').value) || 0) +
            (parseDe($('inv_sonst').value) || 0);
  var bruttoKp = parseDe($('ak_kp').value) || 87569.13;
  var invQuote = bruttoKp > 0 ? (inv / bruttoKp) * 100 : 0;
  if($('risk_inv')){
    var invDot = $('risk_inv').querySelector('.risk-dot');
    var invSub = $('risk_inv').querySelector('.risk-sub');
    if(invQuote > 15){
      if(invDot) invDot.className = 'risk-dot red';
      if(invSub) invSub.textContent = 'Sehr hoch · ' + fmtPct(invQuote,1);
    } else if(invQuote > 8){
      if(invDot) invDot.className = 'risk-dot gold';
      if(invSub) invSub.textContent = 'Erklärungsbedürftig · ' + fmtPct(invQuote,1);
    } else {
      if(invDot) invDot.className = 'risk-dot green';
      if(invSub) invSub.textContent = 'Plausibel · ' + fmtPct(invQuote,1) + ' vom Kaufpreis';
    }
  }

  // 3) 15-%-Grenze
  if($('risk_15')){
    var akTotal = parseDe($('ak_total').textContent.replace('€','').trim()) || 94224.83;
    var nkImmo = Math.max(0, akTotal - bruttoKp);
    var gebAk = chosen.gebEur + (nkImmo * chosen.gebPct/100);
    var max15 = gebAk * 0.15;
    var geplant = parseDe($('g15_geplant').value) || 0;
    var quote = max15 > 0 ? (geplant / max15) * 100 : 0;
    var g15Dot = $('risk_15').querySelector('.risk-dot');
    var g15Sub = $('risk_15').querySelector('.risk-sub');
    if(geplant === 0){
      if(g15Dot) g15Dot.className = 'risk-dot green';
      if(g15Sub) g15Sub.textContent = 'Nicht aktiv (keine Renovierung)';
    } else if(quote > 100){
      if(g15Dot) g15Dot.className = 'risk-dot red';
      if(g15Sub) g15Sub.textContent = 'Überschritten · alles wird zu AHK';
    } else if(quote > 80){
      if(g15Dot) g15Dot.className = 'risk-dot gold';
      if(g15Sub) g15Sub.textContent = 'Knapp · ' + fmtPct(quote,0) + ' der Grenze';
    } else {
      if(g15Dot) g15Dot.className = 'risk-dot green';
      if(g15Sub) g15Sub.textContent = 'Eingehalten · ' + fmtPct(quote,0) + ' der Grenze';
    }
  }
}


// ── 9) Handlungsempfehlung (V3: aus Pane 4 entfernt, no-op wenn fehlt) ──
function renderEmpfehlung(){
  if(!$('empfText')) return;   // Pane 4 hat empfText nicht mehr → kein Render
  var varianten = _varianten();
  var chosen = varianten.find(function(v){ return v.key === _varChoice; }) || varianten[0];
  if(!chosen) return;
  var bruttoKp = parseDe($('ak_kp').value) || 87569.13;
  var inv = (parseDe($('inv_kueche').value) || 0) +
            (parseDe($('inv_moebl').value) || 0) +
            (parseDe($('inv_pv').value) || 0) +
            (parseDe($('inv_sonst').value) || 0);
  var invQuote = bruttoKp > 0 ? (inv / bruttoKp) * 100 : 0;

  var mainHtml = '', listItems = [];

  if(chosen.key === 'konservativ'){
    mainHtml = '<p><strong>Konservative Variante:</strong> Aufteilung nach BMF übernehmen. Diese Variante ist vom Finanzamt anerkennungsfähig ohne weitere Begründung.</p>';
    listItems = [
      'Notarvertrag-Klausel siehe unten — direkt einfügbar.',
      'Keine zusätzlichen Nachweise erforderlich.',
      'Standardvariante für Erstkäufer und konservatives Reporting.'
    ];
  } else if(chosen.key === 'moderat'){
    mainHtml = '<p><strong>Moderate Variante:</strong> Bodenanteil reduziert um 10 % gegenüber BMF. Geringfügige Abweichung — vom Finanzamt nach BFH IX R 12/14 anerkennungsfähig ohne aufwändige Begründung.</p>';
    listItems = [
      'Notarvertrag-Klausel mit kurzem Begründungs-Zusatz einfügen.',
      'Modernisierungsstand kurz dokumentieren (Heizung, Fenster, Dach).',
      'Keine Gutachten zwingend — Belege als Vorsorge empfohlen.'
    ];
  } else if(chosen.key === 'optimiert'){
    mainHtml = '<p><strong>Optimierte Variante:</strong> Bodenanteil reduziert um 25 % gegenüber BMF. Plausibilitätsgrenze der Rechtsprechung — Begründung notwendig, aber vertretbar (BFH IX R 26/19).</p>';
    listItems = [
      'Notarvertrag-Klausel mit ausführlichem Begründungs-Zusatz einfügen.',
      'Modernisierungsstand detailliert dokumentieren (mit Belegen).',
      'Vergleichsverkäufe in der Lage als Anlage zur Steuererklärung sammeln.',
      'Vor Beurkundung: Steuerberater drüberschauen lassen.',
      'Optional: RND-Gutachten (§ 7 Abs. 4 Satz 2 EStG) zur Untermauerung.'
    ];
  }

  // Inventar-Empfehlungen ergänzen
  if(invQuote > 15){
    listItems.push('Inventaranteil ' + fmtPct(invQuote,1) + ' ist hoch — Wertgutachten + Einzelrechnungen vorbereiten.');
  } else if(invQuote > 8){
    listItems.push('Inventaranteil ' + fmtPct(invQuote,1) + ' ist erklärungsbedürftig — Kaufbelege beifügen.');
  }

  // 15-%-Grenze
  var akTotal = parseDe($('ak_total').textContent.replace('€','').trim()) || 94224.83;
  var nkImmo = Math.max(0, akTotal - bruttoKp);
  var gebAk = chosen.gebEur + (nkImmo * chosen.gebPct/100);
  var max15 = gebAk * 0.15;
  var geplant = parseDe($('g15_geplant').value) || 0;
  if(geplant > max15){
    listItems.push('15-%-Grenze überschritten — geplante Renovierung wird zu AHK (keine sofortige Werbungskosten-Wirksamkeit).');
  } else if(geplant > max15 * 0.80 && geplant > 0){
    listItems.push('15-%-Grenze knapp — Renovierungen ggf. auf Jahr 4 verschieben.');
  }

  $('empfText').innerHTML = mainHtml;
  $('empfList').innerHTML = listItems.map(function(li){ return '<li>' + li + '</li>'; }).join('');
}


// ── 4) Notarvertrag-Klausel ────────────────────────────
function renderKlausel(){
  var varianten = _varianten();
  var chosen = varianten.find(function(v){ return v.key === _varChoice; }) || varianten[0];
  if(!chosen) return;

  // Klausel-Header-Label aktualisieren
  var klauselVarEl = $('klauselVar');
  if(klauselVarEl) klauselVarEl.textContent = chosen.label;

  var bruttoKp = parseDe($('ak_kp').value) || 87569.13;
  var inv = (parseDe($('inv_kueche').value) || 0) +
            (parseDe($('inv_moebl').value) || 0) +
            (parseDe($('inv_pv').value) || 0) +
            (parseDe($('inv_sonst').value) || 0);
  var immoKp = Math.max(0, bruttoKp - inv);

  // Begründungs-Zusatz je nach Variante
  var begruendung = '';
  if(chosen.key === 'moderat'){
    begruendung = '\n\nDie Aufteilung berücksichtigt den modernisierungsbedingt höheren Gebäudewert (insbesondere Heizung, Fenster, Sanitär) und liegt im Rahmen der geringfügigen Abweichung von der BMF-Arbeitshilfe, die nach BFH-Urteil vom 16.09.2015 (IX R 12/14) anzuerkennen ist.';
  } else if(chosen.key === 'optimiert'){
    begruendung = '\n\nDie vertragliche Aufteilung folgt der wirtschaftlichen Werterelation der baulichen Anlagen unter Berücksichtigung wesentlicher Modernisierungen, der konkreten Lage sowie der erwartbaren Restnutzungsdauer. Die BMF-Arbeitshilfe stellt nach BFH-Urteil vom 21.07.2020 (IX R 26/19) keine bindende Rechtsnorm dar; sie ist lediglich Hilfsmittel der Finanzverwaltung.';
  }

  // Klausel-Aufbau gemäß Spec
  var html;
  if(inv > 0){
    html =
      '<strong>§ X &nbsp; Kaufpreisaufteilung</strong>\n\n' +
      'Die Vertragsparteien sind sich einig, dass sich der vereinbarte Gesamtkaufpreis in Höhe von ' +
      '<span class="num">' + fmtEur(bruttoKp,2) + '</span> wie folgt aufteilt:\n\n' +
      '<strong>(1)</strong> Auf das mit veräußerte <em>Inventar</em> (bewegliche Wirtschaftsgüter — insbesondere Einbauküche, Möblierung und Geräte) entfällt ein Anteil in Höhe von ' +
      '<span class="num">' + fmtEur(inv,2) + '</span>.\n\n' +
      '<strong>(2)</strong> Auf den verbleibenden Immobilien-Kaufpreis in Höhe von ' +
      '<span class="num">' + fmtEur(immoKp,2) + '</span> entfallen:\n\n' +
      '<strong>(2a)</strong> auf das <em>Gebäude</em> einschließlich sämtlicher wesentlicher Bestandteile ' +
      '<span class="num">' + fmtEur(chosen.gebEur,2) + '</span> (entspricht ' +
      '<span class="num">' + fmtPct(chosen.gebPct,2) + '</span> des Immobilien-Kaufpreises);\n\n' +
      '<strong>(2b)</strong> auf den <em>Grund und Boden</em> ' +
      '<span class="num">' + fmtEur(chosen.bodenEur,2) + '</span> (entspricht ' +
      '<span class="num">' + fmtPct(chosen.bodenPct,2) + '</span> des Immobilien-Kaufpreises).' +
      begruendung +
      '\n\nDie Parteien sind sich bewusst, dass diese Aufteilung die Grundlage für die Bemessung der Absetzung für Abnutzung nach § 7 Abs. 4 EStG bildet.';
  } else {
    html =
      '<strong>§ X &nbsp; Kaufpreisaufteilung</strong>\n\n' +
      'Die Vertragsparteien sind sich einig, dass sich der vereinbarte Gesamtkaufpreis in Höhe von ' +
      '<span class="num">' + fmtEur(bruttoKp,2) + '</span> wie folgt aufteilt:\n\n' +
      '<strong>(1)</strong> Auf das <em>Gebäude</em> einschließlich sämtlicher wesentlicher Bestandteile entfällt ein Anteil in Höhe von ' +
      '<span class="num">' + fmtEur(chosen.gebEur,2) + '</span> (entspricht ' +
      '<span class="num">' + fmtPct(chosen.gebPct,2) + '</span> des Kaufpreises).\n\n' +
      '<strong>(2)</strong> Auf den <em>Grund und Boden</em> entfällt ein Anteil in Höhe von ' +
      '<span class="num">' + fmtEur(chosen.bodenEur,2) + '</span> (entspricht ' +
      '<span class="num">' + fmtPct(chosen.bodenPct,2) + '</span> des Kaufpreises).' +
      begruendung +
      '\n\nDie Parteien sind sich bewusst, dass diese Aufteilung die Grundlage für die Bemessung der Absetzung für Abnutzung nach § 7 Abs. 4 EStG bildet.';
  }

  $('klauselText').innerHTML = html;
}


function copyKlausel(){
  // Plain-Text-Version generieren (ohne HTML-Tags)
  var html = $('klauselText').innerHTML;
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  var text = tmp.textContent || tmp.innerText || '';
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  // In Zwischenablage kopieren
  try {
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text);
    } else {
      // Fallback für ältere Browser
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    var btn = document.querySelector('.klausel-copy');
    btn.classList.add('copied');
    btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>Kopiert';
    setTimeout(function(){
      btn.classList.remove('copied');
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Kopieren';
    }, 2200);
    toast('✓ Notarvertrag-Klausel in Zwischenablage kopiert');
  } catch(e){
    toast('⚠ Kopieren fehlgeschlagen — bitte manuell markieren');
  }
}


/* ──────────────────────────────────────────────────────
   Übernehmen → in den Steuer-Tab
   ────────────────────────────────────────────────────── */
function _mockupApplyToTax_unused(){
  var r = window._lastBmf;
  if(!r){
    toast('Bitte zuerst eine BMF-Berechnung durchführen');
    switchPane('p-bmf');
    return;
  }

  // V3: Gebäudeanteil aus aktuell GEWÄHLTER Variante übernehmen (nicht BMF-Default)
  var varianten = _varianten();
  var chosen = varianten.find(function(v){ return v.key === _varChoice; }) || varianten[0];
  var gebPctOut = chosen ? chosen.gebPct : r.geb_pct;

  // 1) Gebäudeanteil setzen (mit Komma als Dezimaltrenner)
  $('geb_ant').value = gebPctOut.toFixed(2).replace('.', ',');

  // 2) AfA-Satz aus Baujahr ableiten + auf passende Option setzen
  var bj = parseInt($('bmf_bj').value) || 0;
  var afaSatz = defaultAfaSatzForBaujahr(bj);
  var sel = $('afa_satz');
  for (var i=0; i<sel.options.length; i++){
    if (Math.abs(parseFloat(sel.options[i].value) - afaSatz) < 0.05){
      sel.selectedIndex = i;
      break;
    }
  }

  // 3) V3: Sanierungs-Wert zurück in Tab Investition (#san_invest)
  syncToTabInvest();

  // 4) Modal schließen + Live-Berechnung im Steuer-Tab aktualisieren
  closeBMFModal();
  updateAfaCalc();

  var varLabel = chosen ? chosen.label : 'BMF';
  toast('✓ Übernommen: ' + varLabel + ' · ' + fmtPct(gebPctOut,1) + ' Gebäudeanteil · AfA ' + fmtPct(afaSatz,1));
}


/* ──────────────────────────────────────────────────────
   AfA-Satz aus Baujahr (§ 7 Abs. 4 EStG) — BUG-FIX
   In Production: anschJahr > 2022 statt baujahr > 2022 = falsch.
   ────────────────────────────────────────────────────── */
function defaultAfaSatzForBaujahr(bj){
  if(!bj || bj < 100) return 2.0;
  if(bj < 1925) return 2.5;           // § 7 Abs. 4 Nr. 2c EStG
  if(bj > 2022) return 3.0;           // § 7 Abs. 4 Nr. 2a EStG (Fertigstellung!)
  return 2.0;                         // § 7 Abs. 4 Nr. 2b EStG (Bestand 1925-2022)
}


/* ──────────────────────────────────────────────────────
   Live-Berechnung: AfA / Jahr in der AfA-Konfig-Card
   ────────────────────────────────────────────────────── */
function updateAfaCalc(){
  var r = window._lastBmf;
  // Wenn BMF gerechnet wurde, KP aus AK übernehmen, sonst Default-KP
  var akEl = $('ak_total');
  var ak = akEl ? parseDe(akEl.textContent.replace('€','').trim()) : 87569.13;
  if (!ak || !isFinite(ak)) ak = 87569.13;

  var gebPct = parseDe($('geb_ant').value) || 80;
  var afaSatz = parseDe($('afa_satz').value) || 2.0;

  var gebAnteil = ak * gebPct / 100;
  var afaJahr = gebAnteil * afaSatz / 100;

  setText('afa_jahr_calc', fmtEur(afaJahr,2));
  setText('afa_satz_show', fmtPct(afaSatz,1));
}


/* ──────────────────────────────────────────────────────
   Init
   ────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', function(){
  // V282: Sachsenstr-Demo-Werte SOFORT vorab laden (synchron, vor allem anderen)
  // damit Pane 4 (AfA-Hebel) ohne manuelle BMF-Berechnung funktioniert
  if(typeof DEMOS !== 'undefined' && DEMOS.real3){
    window._lastBmf = DEMOS.real3.result;
  }

  // AK-Summe rechnen (für Steuer-Tab + Modal)
  calcAk();
  setVerf('ertrag');

  // Default-AfA-Satz aus Baujahr (Bug-Fix sichtbar machen):
  // Sachsenstr BJ 1994 → 2,0 % (nicht 3,0 % wie aktuell in Production)
  var bj = parseInt($('bmf_bj').value) || 1994;
  var defSatz = defaultAfaSatzForBaujahr(bj);
  var sel = $('afa_satz');
  for(var i=0; i<sel.options.length; i++){
    if(Math.abs(parseFloat(sel.options[i].value) - defSatz) < 0.05){
      sel.selectedIndex = i;
      break;
    }
  }

  // Live-Berechnung initial
  updateAfaCalc();

  // Live-Berechnung wenn Gebäudeanteil oder AfA-Satz geändert wird
  ['afa_satz','geb_ant'].forEach(function(id){
    var el = $(id);
    if(el){
      el.addEventListener('input', updateAfaCalc);
      el.addEventListener('change', updateAfaCalc);
    }
  });

  // V282: BMF-Pane sichtbar rendern (für Tab 2)
  setTimeout(function(){
    if(window._lastBmf && typeof renderBmfResult === 'function'){
      renderBmfResult(window._lastBmf, 'real3');
    }
    // Pane 4 Cascade — die einzelne Funktionen direkt aufrufen
    if(typeof updateInv === 'function') updateInv();
  }, 50);

  // 15-%-Grenze: bei Änderung Risiko + Empfehlung neu rendern
  var g15El = $('g15_geplant');
  if(g15El){
    g15El.addEventListener('input', function(){
      updateG15();
      renderRiskGrid();
      renderEmpfehlung();
    });
  }
});


// ═══════════════════════════════════════════════════════════════
// V289.2 — Persistenz + KI-GAA + Modal-Steuerung
// ═══════════════════════════════════════════════════════════════
var _persistTimer = null;
function _persistBmfState(){
  /* V292.3-v289-bugfixes: No-Op
   * Original rief POST /api/v1/tax-snapshots/:id/bmf — Endpoint existiert nicht (404).
   * Persistenz erfolgt implizit über calc() + normaler Object-Save im Tab.
   */
  return;
}

function suggestGaaBmf(){
  var btn = $('btnGaaSuggest');
  if(btn){ btn.disabled = true; btn.textContent = 'KI fragt...'; }

  // V289.2.5 Issue #5: Adresse direkt aus Tab Objekt (das Modal hat keine ak_plz/ak_ort Felder)
  function _val(id){ var e = document.getElementById(id); return e ? (e.value || '').trim() : ''; }
  var payload = {
    plz: _val('plz'),
    ort: _val('ort'),
    str: _val('str'),
    hnr: _val('hnr'),
    baujahr: parseInt(_val('bmf_bj') || _val('baujahr')) || null,
    wohnflaeche: parseDe(_val('bmf_wfl') || _val('wfl')),
    grundstuecksart: ($('bmf_art') || {}).value || ''
  };

  // Vorab-Validierung: ohne PLZ + Ort macht's keinen Sinn
  if(!payload.plz || !payload.ort){
    toast('KI-Vorschlag braucht PLZ und Ort — bitte erst im Tab Objekt eintragen');
    if(btn){ btn.disabled = false; btn.textContent = 'KI-Vorschlag (1 Credit)'; }
    return;
  }

  fetch('/api/v1/ai/bmf-gaa', {
    method: 'POST',
    headers: _authHeaders(),
    body: JSON.stringify(payload)
  })
  .then(function(r){
    if(r.status === 402){ throw new Error('credits'); }
    if(!r.ok){ return r.json().then(function(e){ throw new Error(e.error || 'HTTP ' + r.status); }); }
    return r.json();
  })
  .then(function(g){
    window._lastGaa = g;
    function fill(id, v){ var e = $(id); if(e && v != null) e.value = v; }
    fill('gaa_brw', g.brw);
    if(g.vergleichsmiete_range){
      fill('gaa_vm_low', g.vergleichsmiete_range.low);
      fill('gaa_vm_high', g.vergleichsmiete_range.high);
    }
    fill('gaa_lzs', g.liegenschaftszins);
    fill('gaa_swf', g.sachwertfaktor);

    // V289.3: Confidence-Badge sichtbar machen + farbcodiert
    var badge = $('gaa_confidence_badge');
    if(badge){
      var conf = g.confidence || '?';
      var colors = {
        'hoch':    {bg:'#EAF7F0', col:'#3FA56C', txt:'Hoch'},
        'mittel':  {bg:'#FAF5E8', col:'#9A7F33', txt:'Mittel'},
        'niedrig': {bg:'#FBF1F0', col:'#B8625C', txt:'Niedrig'}
      };
      var c = colors[conf] || colors.niedrig;
      badge.textContent = 'Confidence: ' + c.txt;
      badge.style.display = '';
      badge.style.background = c.bg;
      badge.style.color = c.col;
      badge.style.border = '1px solid ' + c.col;
    }
    // Reasoning anzeigen
    var rEl = $('gaa_reasoning');
    if(rEl && g.reasoning){
      rEl.textContent = '💡 ' + g.reasoning;
    }

    toast('GAA-Werte von KI vorgeschlagen — Confidence: ' + (g.confidence || '?'));
    _persistBmfState();
  })
  .catch(function(err){
    if(err.message === 'credits'){ toast('Keine KI-Credits verfügbar'); }
    else { toast('KI-Fehler: ' + err.message); }
  })
  .finally(function(){
    if(btn){ btn.disabled = false; btn.textContent = 'KI-Vorschlag (1 Credit)'; }
  });
}

// V289.2.2: Modal-HTML lazy-loaden bevor wir öffnen
var _bmfModalLoading = false;
function _ensureModalLoaded(callback){
  var ov = document.getElementById('bmfOverlay');
  if(ov){ callback(true); return; }

  if(_bmfModalLoading){
    // Bereits am Laden — warte 100ms und probier nochmal
    setTimeout(function(){ _ensureModalLoaded(callback); }, 100);
    return;
  }

  _bmfModalLoading = true;
  console.log('[bmf-modal] Modal-HTML wird geladen...');

  fetch('/js/bmf-modal-html.html?v=289.2.2', { cache: 'no-store' })
    .then(function(r){
      if(!r.ok){ throw new Error('HTTP ' + r.status); }
      return r.text();
    })
    .then(function(html){
      var container = document.createElement('div');
      container.id = 'bmf-modal-container';
      container.innerHTML = html;
      document.body.appendChild(container);
      _bmfModalLoading = false;
      console.log('[bmf-modal] Modal-HTML im DOM. #bmfOverlay:', !!document.getElementById('bmfOverlay'));
      callback(true);
    })
    .catch(function(err){
      _bmfModalLoading = false;
      console.error('[bmf-modal] Modal-HTML konnte nicht geladen werden:', err);
      toast('Fehler: Modal-HTML konnte nicht geladen werden (' + err.message + ')');
      callback(false);
    });
}

function openBMFModal(){
  // V289.2.1: Plan-Check defensiv beim Klick
  // _hasBmfAdvanced() returnt initial false weil Sub.hasCachedFeature async lädt.
  if(!_hasBmfAdvanced()){
    toast('🔒 Detaillierte Berechnung ist Teil des Pro-Plans — Upgrade in Settings');
    console.warn('[bmf-modal] bmf_advanced feature not available — user not Pro?');
    return;
  }

  // V289.2.2: Lazy-Load Modal-HTML falls noch nicht im DOM
  _ensureModalLoaded(function(ok){
    if(!ok) return;
    var ov = $('bmfOverlay');
    if(!ov){
      console.error('[bmf] bmfOverlay immer noch nicht im DOM nach Load');
      toast('Fehler: Modal-Container fehlt');
      return;
    }

    // Modal öffnen
    ov.classList.add('open');

    // V289.2.3: Pane 1 als Start aktivieren + Footer initialisieren
    setTimeout(function(){
      if(typeof switchPane === 'function'){
        switchPane('p-ak');
      } else if(typeof _updateFooterNav === 'function'){
        _updateFooterNav('p-ak');
      }
    }, 10);

    // Auto-Sync beim Öffnen
    if(typeof syncFromTabInvest === 'function'){
      setTimeout(syncFromTabInvest, 50);
    }

    // Persistenten State laden
    var objId = _currentObjectId();
    if(objId){
      fetch('/api/v1/tax-snapshots/' + objId + '/bmf', { headers: _authHeaders() })
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(d){
          if(d && d.bmf_advanced){
            if(d.bmf_advanced.results){
              window._lastBmfResults = d.bmf_advanced.results;
              renderBmfResult(d.bmf_advanced.results, null);
            }
            if(d.bmf_advanced.gaa){
              window._lastGaa = d.bmf_advanced.gaa;
              var g = d.bmf_advanced.gaa;
              function fill(id, v){ var e = $(id); if(e && v != null) e.value = v; }
              fill('gaa_brw', g.brw);
              fill('gaa_lzs', g.liegenschaftszins);
              fill('gaa_swf', g.sachwertfaktor);
            }
          }
        })
        .catch(function(){});
    }
  });  // _ensureModalLoaded callback ende
}

function closeBMFModal(){
  var ov = $('bmfOverlay');
  if(ov) ov.classList.remove('open');
  _persistBmfState();
}

function applyToTax(){
  // V289.2.5 Issue #10: BMF-Ergebnisse in AfA-Konfig-Card schreiben
  //   - Gebäudeanteil → #geb_ant
  //   - AfA-Satz NICHT überschreiben (bleibt gesetzlich 2,0/3,0 %)
  //   - Auto-Badge ins Label
  //   - Hover-Tooltip "Aus BMF-Berechnung übernommen"
  var bmfApplied = _applyBmfToAfaConfig();

  // Bestehende Logik: Sanierung zurück ins Tab Investition (nur falls AHK > 0)
  var ahk = parseDe(($('ak_ahk') || {}).value);
  var sanField = $('san');
  if(sanField && ahk > 0 && ahk !== parseDe(sanField.value)){
    sanField.value = ahk.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if(typeof window.syncSanTaxOnSanInput === 'function') window.syncSanTaxOnSanInput();
  }

  // calc() neu triggern damit AfA-Vorschau + Gesamtberechnung aktualisiert wird
  if(typeof window.calc === 'function') window.calc();

  if(bmfApplied){
    toast('✓ BMF-Werte übernommen — Gebäudeanteil ' + (window._lastBmfResults.gebaeudeanteil_prozent.value.toFixed(1) + ' %').replace('.', ',') + ' im Steuermodul');
  } else {
    toast('Bitte erst Berechnung in Pane 2 durchführen');
    return;  // nicht schließen wenn nichts zu übernehmen
  }
  closeBMFModal();
}

// Export ins window
window.openBMFModal = openBMFModal;
window.openBMFFromMode = openBMFFromMode;
window.closeBMFModal = closeBMFModal;
window.applyToTax = applyToTax;
window.suggestGaaBmf = suggestGaaBmf;
window.exportBmfPdf = exportBmfPdf;
// V289.2.5: neue Funktionen
window.selectKlausel = selectKlausel;
window.copyKlausel = copyKlausel;
window.downloadXlsx = downloadXlsx;

// AfA-Card-Button initialisieren beim DOM-Load
function _initBmfAdvancedButton(){
  var btn = document.getElementById('btnBmfAdvanced');
  if(!btn) return;
  // V289.2.1: Button IMMER sichtbar (auch für Investor/Free).
  // Plan-Check passiert beim Klick (siehe openBMFModal).
  // Gründe:
  //  - DealPilotConfig.pricing.hasFeature lädt async — initial false trotz Pro-Plan
  //  - Investor-User sehen den Pro-Button als Upgrade-Anreiz (Konversion)
  //  - Click-Handler zeigt klaren Toast wenn nicht berechtigt
  btn.style.display = '';
  console.log('[bmf-modal] Button initialisiert — Plan-Check beim Klick');
}
document.addEventListener('DOMContentLoaded', _initBmfAdvancedButton);
if(document.readyState === 'complete' || document.readyState === 'interactive'){
  setTimeout(_initBmfAdvancedButton, 100);
}
// Sicherheits-Polling: falls Button später ins DOM kommt (z.B. nach Tab-Wechsel)
setTimeout(_initBmfAdvancedButton, 500);
setTimeout(_initBmfAdvancedButton, 1500);

// ─────────────────────────────────────────────────────────────────
// V289.2.3: Pane-Navigation Footer
// ─────────────────────────────────────────────────────────────────
var _BMF_PANE_ORDER = ['p-ak', 'p-bmf', 'p-afa', 'p-hebel'];

function _currentPaneId(){
  var active = document.querySelector('.bmfmo-pane.active');
  return active ? active.id : 'p-ak';
}

function _updateFooterNav(paneId){
  paneId = paneId || _currentPaneId();
  var idx = _BMF_PANE_ORDER.indexOf(paneId);
  var isFirst = idx <= 0;
  var isLast = idx === _BMF_PANE_ORDER.length - 1;

  function _show(id, show){
    var el = document.getElementById(id);
    if(el) el.style.display = show ? '' : 'none';
  }

  // V292.4-footer-back-fix: Zurück explizit hidden auf Pane 1 (p-ak)
  _show('btnBmfBack', paneId !== 'p-ak' && !isFirst);
  // Weiter: bis Pane 3
  _show('btnBmfNext', !isLast);
  // Übernehmen + PDF: nur auf letzter Pane
  _show('btnBmfApply', isLast);
  _show('btnBmfPdf', isLast);
  // Abbrechen: immer
  _show('btnBmfCancel', true);

  // Footer-Hint-Text je Pane
  var hint = document.getElementById('bmfmoFooterHint');
  if(hint){
    var hints = {
      'p-ak':    '<b>Schritt 1 / 4:</b> Anschaffungskosten — Brutto-KP, Inventar, Nebenkosten ergeben die Prognose-AK (V292-Pipeline).',
      'p-bmf':   '<b>Schritt 2 / 4:</b> BMF-Eckdaten + KI-GAA. Änderungen lösen automatisch eine neue Berechnung aus (500ms debounced).',
      'p-afa':   '<b>Schritt 3 / 4:</b> 3-Spalten-Vergleich der Varianten (Konservativ / Optimiert / Aggressiv) — wählen Sie in Pane 4.',
      'p-hebel': '<b>Schritt 4 / 4:</b> Wählen Sie die Variante per Klick auf eine Karte. Bei „Übernehmen" wird der Gebäudeanteil ins Steuermodul geschrieben.'
    }; /* V292-footer-hints */
    hint.innerHTML = hints[paneId] || hints['p-ak'];
  }
}

function bmfPaneNext(){
  var idx = _BMF_PANE_ORDER.indexOf(_currentPaneId());
  var nextIdx = Math.min(idx + 1, _BMF_PANE_ORDER.length - 1);
  switchPane(_BMF_PANE_ORDER[nextIdx]);
}

function bmfPaneBack(){
  var idx = _BMF_PANE_ORDER.indexOf(_currentPaneId());
  var prevIdx = Math.max(idx - 1, 0);
  switchPane(_BMF_PANE_ORDER[prevIdx]);
}

window.bmfPaneNext = bmfPaneNext;
window.bmfPaneBack = bmfPaneBack;

// ESC schließt
// ═════════════════════════════════════════════════════════════════
// V289.2.5: Issue #7,9,10,12 — Sync, Vergleich, Übernehmen
// ═════════════════════════════════════════════════════════════════

// Issue #7: Sanierung-Visualisierung in Pane 4 aus Tab Investition
function _syncSanierungViz(){
  function _v(id){ var e = document.getElementById(id); return e ? (e.value || '') : ''; }
  var san = parseDe(_v('san'));
  var moebl = parseDe(_v('moebl'));

  // Verteilung-Selects in Tab Investition haben keine festen IDs — wir suchen sie strukturell.
  // Aus Diagnose: 2 selects, erstes hat option "5 Jahre (Standard §82b)" → Sanierung
  //               zweites hat option "15 Jahre" → Möblierung
  var sanDist = 5, moeblDist = 10;
  var selects = document.querySelectorAll('#s5 select, #s_invest select, select');
  for(var i = 0; i < selects.length; i++){
    var s = selects[i];
    var optsText = Array.from(s.options || []).map(function(o){ return o.text; }).join('|');
    if(/§82b/i.test(optsText) || /5 Jahre.*Standard/i.test(optsText)){
      sanDist = parseInt(s.value) || 5;
    } else if(/15 Jahre/i.test(optsText) && /10 Jahre/i.test(optsText) && /Möbl|Inventar|gerin/i.test(optsText)){
      moeblDist = parseInt(s.value) || 10;
    }
  }

  // g15_geplant befüllen mit san
  var g15 = $('g15_geplant');
  if(g15){
    g15.value = san > 0 ? fmtForInput(san, 2) : '0,00';
  }

  // Verteilung anzeigen
  setText('san_dist_view', sanDist + ' Jahre');
  setText('moebl_dist_view', moebl > 0 ? moeblDist + ' Jahre' : '— Jahre');

  if(san > 0 && sanDist > 0){
    var wkPa = san / sanDist;
    setText('san_wk_pa', fmtEur(wkPa, 0));
    setText('san_wk_calc', fmtEur(san, 0) + ' ÷ ' + sanDist + ' Jahre');
  } else {
    setText('san_wk_pa', '— €');
    setText('san_wk_calc', 'Keine Sanierung im Tab Investition');
  }

  // Trigger Cascade (g15 puffer etc)
  if(typeof updateG15 === 'function') updateG15();
}

// Issue #9: 3-Spalten-Vergleich Standard 80/20 vs BMF
function _renderVergleich(){
  function _v(id){ var e = document.getElementById(id); return e ? (e.value || '') : ''; }
  var kp = parseDe(_v('ak_kp')) || parseDe(_v('kp'));
  var bmfPct = window._lastBmfResults && window._lastBmfResults.gebaeudeanteil_prozent
    && window._lastBmfResults.gebaeudeanteil_prozent.value;
  var afaSatz = parseFloat((($('afa_satz') || {}).value || '2').replace(',', '.')) || 2;
  if(!bmfPct){ bmfPct = 88; }  // Fallback

  // Standard 80/20
  var basis80 = kp * 0.80;
  var afa80 = basis80 * afaSatz / 100;
  var save80 = afa80 * 0.4045;  // ~40,45 % Grenzsteuersatz

  // BMF
  var basisBmf = kp * bmfPct / 100;
  var afaBmf = basisBmf * afaSatz / 100;
  var saveBmf = afaBmf * 0.4045;

  // Diff
  function diff(v1, v2, unit){
    var d = v2 - v1;
    var sign = d > 0 ? '+' : '';
    var clr = d > 0 ? 'var(--green,#3FA56C)' : (d < 0 ? 'var(--red,#B8625C)' : 'var(--muted)');
    if(unit === '€'){
      return '<span style="color:' + clr + '">' + sign + new Intl.NumberFormat('de-DE',{maximumFractionDigits:0}).format(d) + ' €</span>';
    } else if(unit === '%'){
      return '<span style="color:' + clr + '">' + sign + d.toFixed(2).replace('.', ',') + ' %-Pkt.</span>';
    }
    return d.toFixed(0);
  }

  setText('cmp_pct_std', '80,00 %');
  document.getElementById('cmp_pct_bmf').textContent = bmfPct.toFixed(2).replace('.', ',') + ' %';
  document.getElementById('cmp_pct_diff').innerHTML = diff(80, bmfPct, '%');

  setText('cmp_basis_std', fmtEur(basis80, 0));
  setText('cmp_basis_bmf', fmtEur(basisBmf, 0));
  document.getElementById('cmp_basis_diff').innerHTML = diff(basis80, basisBmf, '€');

  setText('cmp_afa_std', fmtEur(afa80, 0));
  setText('cmp_afa_bmf', fmtEur(afaBmf, 0));
  document.getElementById('cmp_afa_diff').innerHTML = diff(afa80, afaBmf, '€');

  setText('cmp_save_std', fmtEur(save80, 0));
  setText('cmp_save_bmf', fmtEur(saveBmf, 0));
  document.getElementById('cmp_save_diff').innerHTML = diff(save80, saveBmf, '€');

  // Empfehlung
  var diffEur = saveBmf - save80;
  var rec = '';
  if(diffEur > 200){
    rec = '<strong style="color:var(--green,#3FA56C)">✓ Empfehlung: BMF-Berechnung anwenden.</strong> Die BMF-Aufteilung bringt dir ~' + Math.round(diffEur) + ' € mehr Steuerersparnis pro Jahr (' + Math.round(diffEur * 50) + ' € über 50 J).';
  } else if(diffEur < -200){
    rec = '<strong style="color:var(--muted)">Hinweis: Standard 80/20 wäre günstiger.</strong> BMF rechnet ~' + Math.abs(Math.round(diffEur)) + ' € weniger AfA pro Jahr — selten der Fall, prüfe deine Eingaben.';
  } else {
    rec = '<strong style="color:var(--muted)">Hinweis:</strong> Beide Methoden liegen sehr nah beieinander (~' + Math.round(Math.abs(diffEur)) + ' € Diff). Standard 80/20 ist FA-freundlicher und einfacher.';
  }
  var recEl = document.getElementById('cmp_recommendation');
  if(recEl) recEl.innerHTML = rec;

  // Issue #12: Vergleichsbalken
  var gebPctRounded = Math.round(bmfPct);
  var grundPct = 100 - gebPctRounded;
  var barGeb = document.getElementById('cmp_bar_geb');
  var barGrund = document.getElementById('cmp_bar_grund');
  if(barGeb && barGrund){
    barGeb.style.width = gebPctRounded + '%';
    barGeb.textContent = 'Gebäude ' + gebPctRounded + ' %';
    barGrund.style.width = grundPct + '%';
    barGrund.textContent = 'Boden ' + grundPct + ' %';
  }
  setText('cmp_kp_eur', fmtEur(kp, 0));
  setText('cmp_geb_eur', fmtEur(basisBmf, 0));
  setText('cmp_grund_eur', fmtEur(kp - basisBmf, 0));
}

// Issue #8: 3 Notarvertrag-Klausel-Varianten
var _currentKlauselVariant = 'konservativ';
function selectKlausel(variant){
  _currentKlauselVariant = variant;
  document.querySelectorAll('[data-klausel]').forEach(function(b){
    b.classList.toggle('active', b.dataset.klausel === variant);
  });
  setText('klauselVar', variant.charAt(0).toUpperCase() + variant.slice(1));
  _renderKlauselText();
}

function _renderKlauselText(){
  function _v(id){ var e = document.getElementById(id); return e ? (e.value || '') : ''; }
  var kp = parseDe(_v('ak_kp')) || parseDe(_v('kp'));
  var bmfPct = (window._lastBmfResults && window._lastBmfResults.gebaeudeanteil_prozent
    && window._lastBmfResults.gebaeudeanteil_prozent.value) || 0;
  var basisGeb = kp * bmfPct / 100;
  var basisGrund = kp - basisGeb;

  var addr = (_v('str') + ' ' + _v('hnr')).trim() + ', ' + (_v('plz') + ' ' + _v('ort')).trim();
  var datum = new Date().toLocaleDateString('de-DE');

  function _eur(v){ return new Intl.NumberFormat('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v) + ' €'; }
  function _pct(v){ return v.toFixed(2).replace('.', ',') + ' %'; }

  var texts = {
    konservativ:
      '<p><strong>Kaufpreisaufteilung (Konservativ — FA-freundlich)</strong></p>' +
      '<p>Die Vertragsparteien teilen den Gesamtkaufpreis in Höhe von <strong>' + _eur(kp) + '</strong> ' +
      'für das Objekt <em>' + (addr || '[Objektadresse]') + '</em> wie folgt auf:</p>' +
      '<ul style="margin:8px 0;padding-left:22px"><li>Auf den Grund und Boden entfallen <strong>' + _eur(basisGrund) + '</strong> (' + _pct(100 - bmfPct) + ').</li>' +
      '<li>Auf das Gebäude entfallen <strong>' + _eur(basisGeb) + '</strong> (' + _pct(bmfPct) + ').</li></ul>' +
      '<p>Die Aufteilung wurde anhand der BMF-Arbeitshilfe (Juni 2023) ermittelt und gilt vorbehaltlich abweichender Feststellung durch das Finanzamt. Sie ist Grundlage für die Absetzung für Abnutzung (AfA) nach § 7 Abs. 4 EStG.</p>',

    moderat:
      '<p><strong>Kaufpreisaufteilung (Moderat — empfohlen)</strong></p>' +
      '<p>Die Vertragsparteien sind sich darüber einig, dass sich der vereinbarte Gesamtkaufpreis in Höhe von <strong>' + _eur(kp) + '</strong> ' +
      'für das Objekt <em>' + (addr || '[Objektadresse]') + '</em> aus folgenden Komponenten zusammensetzt:</p>' +
      '<ul style="margin:8px 0;padding-left:22px"><li>Grund und Boden: <strong>' + _eur(basisGrund) + '</strong> (' + _pct(100 - bmfPct) + ')</li>' +
      '<li>Gebäudesubstanz (abnutzbares Wirtschaftsgut): <strong>' + _eur(basisGeb) + '</strong> (' + _pct(bmfPct) + ')</li></ul>' +
      '<p>Die Aufteilung berücksichtigt den nach BMF-Arbeitshilfe (Juni 2023) ermittelten Sachwertanteil unter Beachtung von Baujahr, Wohnfläche, Bodenrichtwert und Lage. ' +
      'Die Vertragsparteien sind übereingekommen, dass diese Aufteilung der wirtschaftlichen Wertverteilung entspricht und der steuerlichen Behandlung — insbesondere der AfA-Berechnung — zugrunde gelegt wird. ' +
      'Stand: ' + datum + '.</p>',

    aggressiv:
      '<p><strong>Kaufpreisaufteilung (Aggressiv — max. AfA)</strong></p>' +
      '<p>Hiermit erklären die Vertragsparteien rechtsverbindlich: Der vereinbarte Gesamtkaufpreis in Höhe von <strong>' + _eur(kp) + '</strong> für das in der Vertragsurkunde näher bezeichnete Objekt <em>' + (addr || '[Objektadresse]') + '</em> entfällt nach übereinstimmender Bewertung wie folgt:</p>' +
      '<ul style="margin:8px 0;padding-left:22px"><li>Grund und Boden: <strong>' + _eur(basisGrund) + '</strong> (entspricht ' + _pct(100 - bmfPct) + ' des Gesamtkaufpreises)</li>' +
      '<li>Gebäude inkl. wesentlicher Gebäudeteile: <strong>' + _eur(basisGeb) + '</strong> (entspricht ' + _pct(bmfPct) + ')</li></ul>' +
      '<p>Diese Aufteilung wurde im Rahmen einer Sachwertermittlung nach BMF-Arbeitshilfe (Juni 2023) unter Heranziehung lagespezifischer Bodenrichtwerte, der tatsächlichen Restnutzungsdauer des Gebäudes sowie ggf. vorgenommener Modernisierungen erstellt. ' +
      '<strong>Sie hat verbindlichen Charakter</strong> und gilt insbesondere als wirtschaftlich angemessen i.S.d. BFH-Rechtsprechung (BFH IX R 26/19 v. 21.07.2020). ' +
      'Die Parteien sind sich einig, dass eine pauschale 80/20-Aufteilung im konkreten Fall nicht sachgerecht wäre. ' +
      'Eine abweichende Wertfeststellung durch das Finanzamt setzt eine substantiierte Gegenbewertung voraus (vgl. § 199 BewG). Stand: ' + datum + '.</p>'
  };

  var el = document.getElementById('klauselText');
  if(el) el.innerHTML = texts[_currentKlauselVariant] || texts.konservativ; /* V292.3-v289-bugfixes: 'variant' nicht im Scope, nutze _currentKlauselVariant */
}

function copyKlausel_unused_v292(){
  // V289.2.5: hier durch Mockup-Original (Z.1051) ersetzt — bessere Animation
  console.warn('Call to copyKlausel_unused — using Mockup-Original');
}

// Issue #10: Übernehmen schreibt Gebäudeanteil + AfA-Satz in AfA-Konfig-Card
//             + AUTO-Badge + Tooltip
function _applyBmfToAfaConfig(){
  var bmfPct = window._lastBmfResults && window._lastBmfResults.gebaeudeanteil_prozent
    && window._lastBmfResults.gebaeudeanteil_prozent.value;
  if(!bmfPct){ return false; }

  // Gebäudeanteil in #geb_ant überschreiben
  var gebEl = document.getElementById('geb_ant');
  if(gebEl){
    gebEl.value = bmfPct.toFixed(0);
    gebEl.classList.add('from-bmf');
    gebEl.setAttribute('title', 'Aus BMF-Berechnung übernommen · ' + bmfPct.toFixed(2) + ' %');
    gebEl.style.borderColor = 'var(--gold)';
    gebEl.style.background = 'var(--gold-bg)';

    // Auto-Badge ins Label hängen
    var lbl = gebEl.closest('.f') && gebEl.closest('.f').querySelector('label');
    if(lbl && !lbl.querySelector('.bmf-auto-badge')){
      var badge = document.createElement('span');
      badge.className = 'auto bmf-auto-badge';
      badge.title = 'Aus BMF-Berechnung übernommen';
      badge.style.cssText = 'margin-left:8px;font-size:9.5px;padding:2px 6px;background:var(--gold-bg);border:1px solid var(--gold);color:var(--gold-d);border-radius:99px;font-weight:600;letter-spacing:.05em';
      badge.textContent = '🤖 BMF';
      lbl.appendChild(badge);
    }
  }

  // AfA-Satz NICHT überschreiben — der bleibt gesetzlich (2,0 / 3,0 %)
  // Wir triggern aber calc() damit die Anzeige neu berechnet wird
  if(typeof window.calc === 'function') window.calc();

  return true;
}


// V289.2.5: ESC-Listener (Sicherheit — falls Mockup-Listener nicht greift)
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){
    var ov = document.getElementById('bmfOverlay');
    if(ov && ov.classList.contains('open')) closeBMFModal();
  }
});

/* V292.1-auth-export: Export _authHeaders + _token für V292-Modul */
try {
  if (typeof _authHeaders === 'function') window.__bmfAuthHeaders = _authHeaders;
  if (typeof _token === 'function') window.__bmfToken = _token;
} catch(e) { console.warn('[bmf-modal] V292.1 auth-export:', e); }

/* V292.2-export-syncSan: Export für V292-Modul */
try {
  if (typeof _syncSanierungViz === 'function') window._syncSanierungViz = _syncSanierungViz;
  if (typeof updateG15 === 'function') window.__updateG15 = updateG15;
  if (typeof _renderKlauselText === 'function') window.__renderKlauselText = _renderKlauselText;
} catch(e) { console.warn('[bmf-modal] V292.2 sync-export:', e); }

/* V292.3-v289-bugfixes: Globaler Helper fmtForInput
 * V289 _syncSanierungViz nutzt fmtForInput aber Funktion war nie definiert.
 * Definition: wie fmtEur, aber ohne €-Symbol (für Input-Feld-Anzeige).
 */
if (typeof window.fmtForInput !== 'function') {
  window.fmtForInput = function(v, decimals){
    if (decimals == null) decimals = 2;
    if (typeof v !== 'number' || !isFinite(v)) return '0,00';
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(v);
  };
}
