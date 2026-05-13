'use strict';
/* ═══════════════════════════════════════════════════
   JUNKER IMMOBILIEN – storage.js V9
   Hybrid Storage: Backend API or localStorage
═══════════════════════════════════════════════════ */

var FIELDS = [
  'plz','ort','str','hnr','objart','wfl','baujahr','kaufdat','kuerzel','ausst',
  'thesis','risiken','notizen','bankval','svwert','makrolage','mikrolage',
  'vermstand','exitstr','kp','makler_p','notar_p','gba_p','gest_p','ji_p',
  // V63.99: Küche im Kaufpreis als € (kueche_im_kp ist Checkbox → unten separat)
  'kp_kueche',
  'san','moebl','brw','mea','gsfl','mietstg','wertstg','kostenstg','leerstand',
  'btj','exit_bmy','nkm','ze','umlagef','afa_satz','geb_ant','zve','grenz',
  'ek','d1','d1z','d1t','d1_bindj','anschl_z','anschl_t','anschl_bj',
  'hg_ul','grundsteuer','ul_sonst','hg_nul','weg_r','eigen_r',
  'mietausfall','nul_sonst','kp1','kp1l','kp2','kp2l','kp3','kp3l','kp4','kp4l',
  'bank_inst','ai_strat','ai_verk','ai_risk','ai_markt',
  'd2','d2z','d2t','d2_bindj','d2_inst','d2_type','bwk_ul_pct','bwk_nul_pct','bwk_kp_pct',
  // V63.49: D1-Typ + Bausparvertrag
  'd1_type', 'd1_auszahl', 'd1_vertrag',
  'bspar_inst', 'bspar_vertrag', 'bspar_sum', 'bspar_rate', 'bspar_zuteil', 'bspar_zins',
  'bspar_quote_min', 'bspar_dar_z', 'bspar_dar_t',
  // V23: Mietentwicklung Detail-Modus
  'mietspiegel','me_modus','me_soll','me_anz','me_int','me_pct',
  // V36: DealScore 2.0 Zusatzangaben
  'ds2_zustand','ds2_energie','ds2_mietausfall','ds2_marktmiete',
  'ds2_bevoelkerung','ds2_nachfrage','ds2_marktfaktor',
  'ds2_wertsteigerung','ds2_entwicklung',
  // V37: Qualität & Zustand Sterne-Bewertung
  'rate_kueche','rate_bad','rate_boden','rate_fenster'
];

var _currentObjKey = null;  // Local mode key OR API object id
var _objCache = {};         // Cache of full object data when in API mode

function collectData() {
  var d = {};
  FIELDS.forEach(function(id) {
    var e = document.getElementById(id);
    if (e) d[id] = e.value;
  });
  // V187-h2: KI-Lage-Cache aus currentDeal mit speichern (falls vorhanden)
  try {
    if (typeof window.currentDeal === 'object' && window.currentDeal && window.currentDeal.ai_lage_cache) {
      d.ai_lage_cache = window.currentDeal.ai_lage_cache;
    }
  } catch(e){}
  // Checkboxes
  var d2enable = document.getElementById('d2_enable');
  if (d2enable) d['_d2_enabled'] = d2enable.checked;
  // V23: Mietentwicklungs-Toggle (NKM vs NKM+zE)
  var meIncZe = document.getElementById('me_inc_ze');
  if (meIncZe) d['_me_inc_ze'] = meIncZe.checked;
  // V63.99: Küche-im-Kaufpreis-Checkbox
  var kuecheImKp = document.getElementById('kueche_im_kp');
  if (kuecheImKp) d['_kueche_im_kp'] = kuecheImKp.checked;
  // BWK mode
  d['_bwk_mode'] = window._bwkMode || 'detail';
  d['_bwk_pct_mode'] = window._bwkPctMode || 'nkm';
  // V23: Objekt-Sequenznummer (Schema "JJJJ-NNN") — bleibt persistent über alle Edits
  // V63.25: Marker setzen ob ein echter Investor Deal Score 2.0 berechnet wurde.
  // Das brauchen wir damit die Sidebar-Karte das Investor-Sternchen NUR zeigt
  // wenn (a) Plan investor/pro ist UND (b) der User die DS2-Pflichtfelder ausgefüllt hat.
  var ds2Fields = ['ds2_zustand','ds2_energie','ds2_marktmiete','ds2_bevoelkerung','ds2_nachfrage'];
  var ds2Filled = ds2Fields.filter(function(id) {
    var v = (document.getElementById(id) || {}).value;
    return v && String(v).trim() !== '' && String(v).trim() !== '0';
  }).length;
  // Mindestens 3 von 5 DS2-Pflichtfeldern müssen ausgefüllt sein, sonst gilt DS2 als NICHT berechnet
  d._ds2_computed = (ds2Filled >= 3);
  // Plan-Feature-Check: hat der User überhaupt Zugriff auf DS2?
  if (window.DealPilotConfig && DealPilotConfig.pricing && typeof DealPilotConfig.pricing.hasFeature === 'function') {
    d._has_ds2_feature = DealPilotConfig.pricing.hasFeature('deal_score_v2');
  } else {
    d._has_ds2_feature = false;
  }
  // V63.26: Beide Scores beim Save persistieren — verhindert dass Karten und
  // Tab Kennzahlen unterschiedliche Zahlen zeigen weil Karte mit Listen-Endpoint-Werten
  // (bmy/dscr) eine vereinfachte computeFromKpis macht und Tab Kennzahlen mit allen
  // State.kpis. Beide Scores werden beim Speichern kalkuliert und im data-Blob abgelegt.
  try {
    if (typeof DealScore !== 'undefined' && typeof DealScore.compute === 'function') {
      var _dpRes = DealScore.compute();
      if (_dpRes && _dpRes.score) d._dealpilot_score = Math.round(_dpRes.score);
    }
  } catch(e) {}
  try {
    if (window.DealScore2 && typeof window._buildDeal2FromState === 'function' && d._ds2_computed) {
      var _ds2Deal = window._buildDeal2FromState();
      var _ds2Res = window.DealScore2.compute(_ds2Deal);
      if (_ds2Res && _ds2Res.score) d._ds2_score = Math.round(_ds2Res.score);
    }
  } catch(e) {}

  if (window._currentObjSeq) d['_obj_seq'] = window._currentObjSeq;
  // V104: Deal-Won-Status aus Hidden-Input im Tab Deal-Aktion lesen
  //       (oder aus dem aktuell geladenen Objekt übernehmen wenn Tab nicht gerendert)
  var wonEl = document.getElementById('_deal_won_state');
  if (wonEl) {
    d._deal_won = (wonEl.value === 'true');
    var wonAtEl = document.getElementById('_deal_won_at_state');
    if (wonAtEl && wonAtEl.value) d._deal_won_at = wonAtEl.value;
  } else if (window._currentObjData && typeof window._currentObjData._deal_won !== 'undefined') {
    // Tab nicht gerendert → Wert aus dem zuletzt geladenen Objekt übernehmen (kein Verlust)
    d._deal_won = !!window._currentObjData._deal_won;
    if (window._currentObjData._deal_won_at) d._deal_won_at = window._currentObjData._deal_won_at;
  }
  // Summary fields for backend indexing
  d._name = [g('str'), g('hnr'), g('ort')].filter(Boolean).join(' ') || 'Unbenannt';
  d._at = new Date().toISOString();
  d._v = '9.0';
  // Snapshot key KPIs for backend indexing
  if (typeof State !== 'undefined' && State.kpis) {
    d._kpis_bmy = State.kpis.bmy;
    d._kpis_cf_ns = State.kpis.cf_ns;
    d._kpis_dscr = State.kpis.dscr;
    d._kpis_ltv = State.kpis.ltv;       // V110: LTV mitspeichern für Sidebar-Toggle DSCR↔LTV
  }
  return d;
}

function loadData(d) {
  // V104: Globale Referenz auf den aktuell geladenen Objekt-Datenblob —
  //       wird von collectData() und renderTab() für den Won-Status genutzt
  window._currentObjData = d || {};
  // V63.33 KRITISCHER FIX: Aufaddier-Felder die in calc.js zur GI/BWK summiert werden
  // MÜSSEN beim Objektwechsel zurückgesetzt werden — sonst behalten sie den Wert
  // vom vorherigen Objekt und verfälschen NMR/Cashflow.
  // Beispiel: Objekt A hat san=12000, Objekt B hat keinen san-Wert → ohne diesen Reset
  // bleibt san=12000 im DOM → GI von B = kp_B + nk_B + 12000 (falsch).
  var resetFields = [
    'san', 'moebl',                              // GI-Aufschläge (calc.js Z.433)
    'umlagef', 'ze',                              // Mieten-Aufschläge (calc.js Z.509)
    'grundsteuer', 'ul_sonst',                    // BWK ul (calc.js Z.545)
    'eigen_r', 'mietausfall', 'nul_sonst',        // BWK nul (calc.js Z.546)
    'weg_r',                                      // WEG-Rücklage (Info)
    'kp1', 'kp2', 'kp3', 'kp4',                   // Sonderkosten (calc.js Z.545)
    'kp1l', 'kp2l', 'kp3l', 'kp4l'                // Sonderkosten Labels
  ];
  resetFields.forEach(function(id) {
    var e = document.getElementById(id);
    if (e) e.value = '';
  });
  FIELDS.forEach(function(id) {
    var e = document.getElementById(id);
    if (e && d[id] !== undefined) e.value = d[id];
  });
  // V187-h2: KI-Lage-Cache aus data ins currentDeal-Object übernehmen
  try {
    if (typeof window.currentDeal !== 'object' || !window.currentDeal) window.currentDeal = {};
    if (d.ai_lage_cache && typeof d.ai_lage_cache === 'object') {
      window.currentDeal.ai_lage_cache = d.ai_lage_cache;
    } else {
      delete window.currentDeal.ai_lage_cache;
    }
  } catch(e){}
  if (d._d2_enabled !== undefined) {
    var cb = document.getElementById('d2_enable');
    if (cb) { cb.checked = d._d2_enabled; if (typeof toggleD2 === 'function') toggleD2(); }
  }
  // V23: Mietentwicklungs-Toggle wiederherstellen
  if (d._me_inc_ze !== undefined) {
    var meCb = document.getElementById('me_inc_ze');
    if (meCb) meCb.checked = !!d._me_inc_ze;
  }
  // V63.99: Küche-im-Kaufpreis-Toggle wiederherstellen + Wrap-Sichtbarkeit
  if (d._kueche_im_kp !== undefined) {
    var kuCb = document.getElementById('kueche_im_kp');
    if (kuCb) {
      kuCb.checked = !!d._kueche_im_kp;
      if (typeof toggleKuecheKp === 'function') toggleKuecheKp();
    }
  }
  // V23: Objekt-Sequenznummer wiederherstellen (oder neu vergeben falls fehlt)
  window._currentObjSeq = d._obj_seq || null;

  if (d._bwk_mode && typeof switchBwkMode === 'function') switchBwkMode(d._bwk_mode);
  if (d._bwk_pct_mode && typeof switchBwkPctMode === 'function') switchBwkPctMode(d._bwk_pct_mode);

  window._aiText = d._ai || '';
  // V63.57: D1-Typ-Sichtbarkeit nach Load syncen — sonst bleibt Bauspar-Card
  // versteckt obwohl Tilgungsaussetzung aktiv ist
  if (typeof window.onD1TypeChange === 'function') {
    try { window.onD1TypeChange(); } catch(_) {}
  }
  // V23: Mietentwicklungs-Modus aus dem geladenen Wert übernehmen + UI synchen
  if (window.MietEntwicklung && typeof MietEntwicklung.refresh === 'function') {
    var mMode = (d.me_modus === 'detail') ? 'detail' : 'prog';
    MietEntwicklung.setMode(mMode);  // ruft intern auch calc()
  } else if (typeof calc === 'function') {
    calcNow();  /* V29: direkt — nach loadObject */
  }
  if (typeof updHeader === 'function') updHeader();
  // V37: Sterne-Bewertung re-rendern nach Load
  if (window.StarRating && typeof StarRating.refresh === 'function') {
    try { StarRating.refresh(); } catch(e) {}
  }
  // V43-Bugfix: ds2-Felder triggern programmatic kein onchange → DealScore manuell neu rendern
  if (typeof renderDealScore2 === 'function') {
    try { renderDealScore2(); } catch(e) { console.warn('renderDealScore2 nach loadData:', e.message); }
  }
  if (window._aiText) {
    // V25: Wenn _aiText valides JSON ist (Server-KI), beide Blöcke rehydrieren
    var parsedAI = null;
    try { parsedAI = JSON.parse(window._aiText); } catch (e) { /* ist Klartext aus Client-KI */ }
    if (parsedAI && typeof parsedAI === 'object' && (parsedAI.empfehlung || parsedAI.gesamtbewertung || parsedAI.staerken)) {
      window._aiAnalysis = parsedAI;
      if (typeof _renderAIServerAnalysis === 'function') {
        var aiContent = document.getElementById('ai-content');
        if (aiContent) aiContent.innerHTML = _renderAIServerAnalysis(parsedAI);
      }
      if (typeof _renderMiniAI === 'function') _renderMiniAI(parsedAI);
    } else if (typeof renderAIResponse === 'function') {
      var aiContent2 = document.getElementById('ai-content');
      if (aiContent2) aiContent2.innerHTML = renderAIResponse(window._aiText);
    }
  } else {
    // V108 BUG-FIX: Wenn das geladene Objekt KEINE KI-Analyse hat → Container leeren!
    // Vorher blieb die KI-Analyse vom vorherigen Objekt sichtbar weil der Container
    // nur gefüllt wurde wenn _aiText einen Wert hatte.
    window._aiAnalysis = null;
    var aiContentEmpty = document.getElementById('ai-content');
    if (aiContentEmpty) {
      aiContentEmpty.innerHTML = '<div style="color:var(--muted);padding:30px 20px;text-align:center">' +
        'Noch keine KI-Analyse für dieses Objekt. Klicke auf <strong>"KI-Analyse starten"</strong> um eine Investmentanalyse zu generieren.' +
        '</div>';
    }
    // Auch Mini-AI-Block leeren falls vorhanden
    var miniAi = document.getElementById('ai-mini-content');
    if (miniAi) miniAi.innerHTML = '';
  }
  // V104: Won-Status-UI im Tab Deal-Aktion (falls schon gerendert) synchronisieren
  try {
    var wonEl = document.getElementById('_deal_won_state');
    if (wonEl) {
      wonEl.value = (d && d._deal_won) ? 'true' : 'false';
      var atEl = document.getElementById('_deal_won_at_state');
      if (atEl) atEl.value = (d && d._deal_won_at) ? d._deal_won_at : '';
      if (window.DealPilotDealAction && typeof DealPilotDealAction.refreshWonUI === 'function') {
        DealPilotDealAction.refreshWonUI();
      }
    }
  } catch(e) {}
}

// ══════════════════════════════════════════════════
// SAVE / NEW
// ══════════════════════════════════════════════════
async function saveObj(opts) {
  opts = opts || {};
  var silent = !!opts.silent || !!window._autoSaveActive;
  // Paywall: Track calculation usage
  if (typeof Paywall !== 'undefined' && Paywall.gate) {
    if (!Paywall.gate('calculations')) return;  // Limit reached → modal opens
  }
  // V63.82: Objekt-Limit-Check (Plan.atLimit) — vor dem Save
  // Wir zählen die existierenden Objekte; wenn Plan-Limit erreicht UND es ist ein NEUES Objekt → Paywall
  if (typeof Plan !== 'undefined' && !window._currentObjId) {
    try {
      var existingCount = 0;
      if (Auth.isApiMode() && typeof window._serverObjList !== 'undefined') {
        existingCount = (window._serverObjList || []).length;
      } else {
        var allLocal = JSON.parse(localStorage.getItem('dp_objects') || '[]');
        existingCount = allLocal.length;
      }
      if (Plan.atLimit('objects', existingCount)) {
        if (typeof toast === 'function') toast('Objekt-Limit (' + Plan.limit('objects') + ') erreicht — Plan upgraden.');
        if (typeof openPricingModal === 'function') setTimeout(openPricingModal, 800);
        return;
      }
    } catch (e) { /* defensiv: bei Fehler einfach durchlassen */ }
  }

  // V36: Bei Save die Objekt-ID validieren und ggf. committen
  if (!window._currentObjSeq && typeof ObjNumbering !== 'undefined') {
    window._currentObjSeq = ObjNumbering.next();
  } else if (window._currentObjSeq && typeof ObjNumbering !== 'undefined') {
    // Konfliktcheck: gibt's die ID schon bei einem ANDEREN Objekt?
    var conflict = await _checkObjIdConflict(window._currentObjSeq);
    if (conflict) {
      toast('⚠ Objekt-ID "' + window._currentObjSeq + '" existiert bereits — bitte ändern.');
      return;
    }
    // V36: Counter mitziehen wenn manuell höher gesetzt
    if (typeof ObjNumbering.registerExisting === 'function') {
      ObjNumbering.registerExisting(window._currentObjSeq);
    }
    // Falls noch Preview, jetzt committen (= Counter inkrementieren wenn passt)
    if (window._objSeqIsPreview) {
      var p = ObjNumbering.parse(window._currentObjSeq);
      if (p) {
        // commit über bumpCounter (registerExisting macht das schon)
        ObjNumbering.registerExisting(window._currentObjSeq);
      }
      window._objSeqIsPreview = false;
    }
  }
  if (typeof updHeader === 'function') updHeader();

  var data = collectData();
  var aiText = window._aiText || null;
  var photos = (typeof imgs !== 'undefined') ? imgs.map(function(i){ return i.src; }) : [];

  if (Auth.isApiMode()) {
    try {
      var saved;
      if (_currentObjKey) {
        // Update existing
        saved = await Auth.apiCall('/objects/' + _currentObjKey, {
          method: 'PUT',
          body: { data: data, aiAnalysis: aiText, photos: photos }
        });
      } else {
        saved = await Auth.apiCall('/objects', {
          method: 'POST',
          body: { data: data, aiAnalysis: aiText, photos: photos }
        });
        _currentObjKey = saved.id;
      }

      // Persist tax timeline with full detail (Migration 006)
      if (State.taxTimeline && _currentObjKey && typeof _computeYearTotal === 'function') {
        try {
          var fullTimeline = State.taxTimeline.map(function(t, idx) {
            var totals = _computeYearTotal(t.year, idx);
            var v = totals.values;
            return {
              year: t.year,
              base_income: parseDe((document.getElementById('zve') || {}).value) || 65891,
              marginal_tax_rate: parseDe((document.getElementById('grenz') || {}).value) / 100 || null,
              einnahmen_vv: t.einnahmen,
              schuldzinsen: v.schuldzinsen || 0,
              bewirtschaftung: (v.nk_n_umlf || 0) + (v.betr_sonst || 0),
              afa: v.afa || 0,
              immo_result: t.immoResult,
              tax_before: null,
              tax_after: null,
              tax_delta: t.taxDelta,
              refund: t.refund,
              // Detailed fields
              kontofuehrung: v.kontofuehrung || 0,
              bereitstellung: v.bereitstellung || 0,
              notar_grundschuld: v.notar_grundschuld || 0,
              vermittlung: v.vermittlung || 0,
              finanz_sonst: v.finanz_sonst || 0,
              nk_umlf: v.nk_umlf || 0,
              nk_n_umlf: v.nk_n_umlf || 0,
              betr_sonst: v.betr_sonst || 0,
              hausverwaltung: v.hausverwaltung || 0,
              steuerber: v.steuerber || 0,
              porto: v.porto || 0,
              verw_sonst: v.verw_sonst || 0,
              fahrtkosten: v.fahrtkosten || 0,
              verpflegung: v.verpflegung || 0,
              hotel: v.hotel || 0,
              inserat: v.inserat || 0,
              gericht: v.gericht || 0,
              telefon: v.telefon || 0,
              sonst_kosten: v.sonst_kosten || 0,
              sonst_bewegl_wg: v.sonst_bewegl_wg || 0,
              anschaffungsnah: v.anschaffungsnah || 0,
              erhaltungsaufwand: v.erhaltungsaufwand || 0,
              einnahmen_km: v.einnahmen_km || 0,
              einnahmen_nk: v.einnahmen_nk || 0
            };
          });

          await Auth.apiCall('/tax-records/object/' + _currentObjKey + '/timeline', {
            method: 'PUT', body: { timeline: fullTimeline }
          });

          // Persist bemerkungen
          if (window._taxYearlyBemerkungen) {
            var bem = [];
            Object.keys(window._taxYearlyBemerkungen).forEach(function(yKey) {
              var year = parseInt(yKey.replace('y', ''));
              var fields = window._taxYearlyBemerkungen[yKey];
              Object.keys(fields).forEach(function(field) {
                if (fields[field] && fields[field].trim()) {
                  bem.push({ year: year, field: field, bemerkung: fields[field] });
                }
              });
            });
            if (bem.length > 0) {
              await Auth.apiCall('/tax-records/object/' + _currentObjKey + '/bemerkungen', {
                method: 'PUT', body: { bemerkungen: bem }
              });
            }
          }
        } catch (e) { console.warn('Tax persistence skipped:', e.message); }
      }

      if (!silent) toast('✓ Gespeichert: ' + (saved.name || 'Objekt'));
      // V62.2: Auto-saved Indikator im Header zeigen
      _showAutoSavedIndicator();
      // V98: Cache invalidieren damit nächster renderSaved() frische Daten holt
      invalidateRenderCache();
      await renderSaved({forceFresh: true, _immediate: true}); if(typeof updateSidebarPortfolio==='function') updateSidebarPortfolio();
    } catch (err) {
      toast('⚠ Fehler beim Speichern: ' + err.message);
    }
  } else {
    var d = collectData();
    d._ai = aiText || '';
    d._photos = photos;
    var keyPrefix = (typeof Auth !== 'undefined' && Auth.isLoggedIn()) ? Auth.getStorageKey('obj_') : 'ji_';
    var key = _currentObjKey || (keyPrefix + Date.now());
    localStorage.setItem(key, JSON.stringify(d));
    _currentObjKey = key;
    if (!silent) if (!silent) toast('✓ Gespeichert: ' + d._name);
    renderSaved(); if(typeof updateSidebarPortfolio==='function') updateSidebarPortfolio();
  }
}

// V63.47: Form-Reset ohne confirm — wird vom Excel-Import benutzt wenn
// gerade ein Objekt geladen ist (sonst würde der Import dessen Felder
// überschreiben statt ein neues Objekt anzulegen).
function _clearFormForNewObject() {
  FIELDS.forEach(function(id) {
    var e = document.getElementById(id);
    if (e) e.value = '';
  });
  var qcIds = ['qc_kp','qc_nkm','qc_nkm_grund','qc_nkm_stp','qc_nkm_garage','qc_nkm_sonst',
               'qc_ek','qc_knk','qc_knk_eur','qc_san','qc_zins','qc_tilg','qc_d1','qc_d1z','qc_d1t',
               'qc_str','qc_hnr','qc_plz','qc_ort','qc_wfl','qc_baujahr'];
  qcIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['qc-score-val','qc-score-label','qc-score-interpretation',
   'dealscore-box','ds2-box','hdr-cf-mon','hdr-bmy','hdr-dscr'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'INPUT') el.value = '';
      else el.textContent = '—';
    }
  });
  if (window.State && State.kpis) State.kpis = {};
  if (typeof imgs !== 'undefined') { imgs = []; if (typeof renderImgs === 'function') renderImgs(); }
  window._aiText = '';
  window._aiAnalysis = null;
  _currentObjKey = null;
  if (window.DealPilotWorkflow && typeof DealPilotWorkflow.renderProgressBar === 'function') {
    setTimeout(DealPilotWorkflow.renderProgressBar, 50);
  }
  if (typeof dpResetAllOutputs === 'function') {
    setTimeout(dpResetAllOutputs, 50);
  }
}
window._clearFormForNewObject = _clearFormForNewObject;

function newObj() {
  if (!confirm('Neues Objekt anlegen?\nAktuelle Eingaben gehen verloren, falls nicht gespeichert.')) return;
  FIELDS.forEach(function(id) {
    var e = document.getElementById(id);
    if (e) e.value = '';
  });
  // V63.22: Auch QC-Felder explizit leeren (waren nicht in FIELDS)
  // Sonst behalten qc_kp / qc_nkm_grund / qc_nkm_stp / qc_nkm_garage / qc_nkm_sonst /
  // qc_ek / qc_knk / qc_zins / qc_tilg ihre Werte → Score "merkt" sich altes Objekt
  var qcIds = ['qc_kp','qc_nkm','qc_nkm_grund','qc_nkm_stp','qc_nkm_garage','qc_nkm_sonst',
               'qc_ek','qc_knk','qc_knk_eur','qc_san','qc_zins','qc_tilg','qc_d1','qc_d1z','qc_d1t',
               'qc_str','qc_hnr','qc_plz','qc_ort','qc_wfl','qc_baujahr'];
  qcIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  // V63.22: Score-Anzeige im QC + Tab Kennzahlen + Kaufempfehlung explizit zurücksetzen
  // (sonst bleibt der vorherige Donut/Score sichtbar bis der nächste Render kommt)
  ['qc-score-val','qc-score-label','qc-score-interpretation',
   'dealscore-box','ds2-box','hdr-cf-mon','hdr-bmy','hdr-dscr'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'INPUT') el.value = '';
      else el.textContent = '—';
    }
  });
  // State.kpis nullen damit nächster compute() "Keine Daten" zurückgibt
  if (window.State && State.kpis) {
    State.kpis = {};
  }
  if (typeof imgs !== 'undefined') { imgs = []; renderImgs(); }
  window._aiText = '';
  window._aiAnalysis = null;
  _currentObjKey = null;
  // V58: Workflow-Bar zurücksetzen + Outputs nullen
  if (window.DealPilotWorkflow && typeof DealPilotWorkflow.renderProgressBar === 'function') {
    setTimeout(DealPilotWorkflow.renderProgressBar, 50);
  }
  if (typeof dpResetAllOutputs === 'function') {
    setTimeout(dpResetAllOutputs, 50);
  }
  // V36: Sofort eine vorläufige ID anzeigen (peek statt commit) — User sieht
  // direkt eine Nummer und kann sie auch sofort manuell ändern.
  if (typeof ObjNumbering !== 'undefined' && typeof ObjNumbering.peekNextLocal === 'function') {
    window._currentObjSeq = ObjNumbering.peekNextLocal();
    window._objSeqIsPreview = true;     // Flag: noch nicht in Counter committed
  } else {
    window._currentObjSeq = null;
    window._objSeqIsPreview = false;
  }
  var aiContent = document.getElementById('ai-content');
  if (aiContent) {
    aiContent.innerHTML = 'Gib deinen KI API-Key ein, wähle ein Modell und klicke "Analyse starten".';
  }
  // V25: Mini-AI-Block in Tab Kennzahlen zurücksetzen
  var miniBody = document.getElementById('ai-mini-body');
  if (miniBody) {
    miniBody.innerHTML = '<div class="ai-mini-empty">Klicke <strong>„Analyse starten"</strong>, um eine professionelle Investment-Bewertung deines Deals zu erhalten — inkl. Stärken, Risiken, Szenarien und Empfehlung.</div>';
  }
  var miniBtn = document.getElementById('ai-mini-run');
  if (miniBtn) miniBtn.textContent = 'Analyse starten';
  setDefaults();
  // V49: Statt Werte einfügen → leere Felder mit Placeholder als Beispiel
  if (typeof loadExamplePlaceholders === 'function') {
    loadExamplePlaceholders();
  } else {
    loadExample();
  }
  calcNow();
  updHeader();
  // V63.8: QC-Host als "noch nicht gerendert" markieren damit der QC für das neue Objekt neu rendert
  var qcHost = document.getElementById('qc-tab-host');
  if (qcHost) qcHost.dataset.rendered = '0';
  // V63.24 NEU: Wenn der User in der "Alle Objekte"-Übersicht war, raus da
  // — sonst bleibt er in der Übersicht und sieht das neu angelegte Einzelobjekt nicht.
  if (typeof setMainView === 'function') {
    setMainView('single');
  }
  // V63.76: Investmentprofil-Defaults anwenden (vor Quick-Check, damit beim
  // Tippen schon Tilgung/Zinsbindung/EK-Quote/Bundesland/Steuern befüllt sind).
  if (window.DealPilotInvestmentProfile && typeof window.DealPilotInvestmentProfile.applyToNewObject === 'function') {
    try { window.DealPilotInvestmentProfile.applyToNewObject(); } catch (e) {}
  }
  // V63.77 FIX: "Neues Objekt" landet im Tab "Objekt" (Index 0) mit voller Tab-Bar.
  // Falls der User vorher im Quick-Check-Standalone-Mode war, diesen sauber verlassen.
  if (typeof exitQuickCheckMode === 'function') exitQuickCheckMode();
  if (typeof switchTab === 'function') switchTab(0);
  renderSaved();
  toast('Neues Objekt angelegt — ID: ' + (window._currentObjSeq || '–'));
  // V63.32: Workflow-Bar Position robust setzen.
  // 1) Sofort manuell auf 108px (= 64 sticky-top der Tabs + 44 Höhe) damit nie ein "Sprung" passiert
  // 2) Dann via _updateWfTop() präzise messen wenn DOM-Reflow fertig ist
  document.documentElement.style.setProperty('--wf-top', '102px');
  if (typeof window._updateWfTop === 'function') {
    setTimeout(window._updateWfTop, 50);
    setTimeout(window._updateWfTop, 200);
    setTimeout(window._updateWfTop, 600);
  }
  // V65.2: Sichtbarkeit der Workflow-Bar gemäß User-Setting respektieren — sonst wird
  // sie nach Tab-Wechsel/newObj() unbeabsichtigt wieder eingeblendet.
  if (typeof window.applyWorkflowBarVisibility === 'function') {
    setTimeout(window.applyWorkflowBarVisibility, 100);
  }
}

// ══════════════════════════════════════════════════
// LIST / RENDER SIDEBAR
// ══════════════════════════════════════════════════
// V98: Performance-Optimierung
//   1) Kein "Lade..."-Flash mehr — vorherige Cards bleiben sichtbar während neue Daten geholt werden
//   2) In-Memory-Cache (TTL 60s) für die Objekt-Liste — Tab-Wechsel triggern keinen API-Call mehr
//   3) Debounce: mehrere renderSaved()-Aufrufe innerhalb von 80ms werden zu einem einzigen zusammengefasst
//   4) Wenn die DOM-Liste schon korrekte Cards zeigt und der Cache frisch ist → nur live-Daten der aktiven Karte updaten
var _renderCache = { items: null, ts: 0, ttl: 60 * 1000 };
var _renderTimer = null;
var _renderInflight = null;

function invalidateRenderCache() {
  _renderCache.items = null;
  _renderCache.ts = 0;
}
window.invalidateRenderCache = invalidateRenderCache;

async function renderSaved(opts) {
  // Debounce: wenn schon ein Aufruf in 80ms ansteht, brechen ab und merken
  opts = opts || {};
  if (_renderTimer && !opts._immediate) {
    clearTimeout(_renderTimer);
  }
  if (!opts._immediate) {
    return new Promise(function(resolve) {
      _renderTimer = setTimeout(function() {
        _renderTimer = null;
        renderSaved({_immediate: true}).then(resolve);
      }, 80);
    });
  }

  var list = document.getElementById('sb-list');
  if (!list) return;

  // V98: Helper-Functions für die neuen reichen Cards
  function _esc(s) { return ('' + (s == null ? '' : s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _fmtEUR(n) {
    if (n == null || isNaN(n)) return '—';
    return Math.round(parseFloat(n)).toLocaleString('de-DE') + ' €';
  }
  function _fmtCF(n) {
    if (n == null || isNaN(n)) return null;
    var v = parseFloat(n);
    var sign = v >= 0 ? '+' : '';
    return sign + Math.round(v).toLocaleString('de-DE') + ' €';
  }
  function _fmtPct(n) {
    if (n == null || isNaN(n)) return null;
    var v = parseFloat(n);
    if (Math.abs(v) <= 1) v = v * 100; // ratio → prozent
    return v.toFixed(2).replace('.', ',') + ' %';
  }
  function _dscrClass(d) {
    if (d == null || isNaN(d)) return 'neutral';
    var v = parseFloat(d);
    if (v >= 1.2) return 'good';
    if (v >= 1.0) return 'warn';
    return 'bad';
  }
  function _cfClass(cf) {
    if (cf == null || isNaN(cf)) return 'neutral';
    return parseFloat(cf) >= 0 ? 'good' : 'bad';
  }
  function _shortAddr(name) {
    // "Dresdenstr. 116 Herford" → { street: 'Dresdenstr. 116', city: 'Herford' }
    if (!name) return { street: 'Unbenannt', city: '' };
    // V27: "(Kopie)" und ähnliche Suffixe rausfiltern (auch falls noch in alten Daten drin)
    name = name.replace(/\s*\(Kopie\)/gi, '').trim();
    var parts = name.split(/\s+/);
    if (parts.length <= 2) return { street: name, city: '' };
    var city = parts.pop();
    return { street: parts.join(' '), city: city };
  }

  /**
   * V26: Mockup-konforme Mini-Card mit Foto-Header + Inline-Charts.
   * V63.4: Investor-Ribbon wenn ds2Score vorhanden (analog zur Header-Score-Karte)
   * opts: { key, seq, name, kp, cf_ns, dscr, bmy, photoSrc, hasAi, isActive, date, ds2Score }
   */
  function _renderRichCard(opts) {
    var addr = _shortAddr(opts.name);
    var seqHtml = opts.seq
      ? '<span class="sbc-seq' + (opts.isDuplicateSeq ? ' sbc-seq-dup' : '') + '"' +
        (opts.isDuplicateSeq ? ' title="⚠ Diese ID kommt mehrfach vor — bitte ändern (Klick auf Karte → Header → ID anklicken)"' : '') +
        '>' + _esc(opts.seq) + (opts.isDuplicateSeq ? ' ⚠' : '') + '</span>'
      : '';
    // V74: Roboter-Emoji durch professionellen Sparkle-SVG (passend zum Goldakzent) ersetzt
    var aiHtml = opts.hasAi ? '<span class="sbc-ai-badge" title="KI-Analyse vorhanden"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 0l2.5 7.5L22 10l-7.5 2.5L12 20l-2.5-7.5L2 10l7.5-2.5z" fill-opacity=".9"/><circle cx="19" cy="3" r="1.5"/><circle cx="3" cy="19" r="1.2"/></svg></span>' : '';
    // V63.25: Investor-Ribbon NUR wenn opts.showInvestor === true
    // (= Plan investor/pro UND DS2-Pflichtfelder ausgefüllt). Vorher wurde das
    // Sternchen schon angezeigt sobald ds2Score != null war (also auch im Starter
    // bei der Heuristik) — das war falsch.
    var investorRibbon = opts.showInvestor ?
      '<div class="sbc-investor-ribbon" title="Investor Deal Score berechnet">' +
        '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
        '<span>Investor</span>' +
      '</div>' : '';
    // V104: Won-Badge — grünes Häkchen + "Zuschlag" wenn dealWon=true
    var wonRibbon = opts.dealWon ?
      '<div class="sbc-won-ribbon" title="Zuschlag erhalten — landet im Track Record + Bankexport">' +
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        '<span>Won</span>' +
      '</div>' : '';
    // V63.25: Hinweis "DS2 ergänzen" wenn der Plan das Feature hat aber dieses
    // Objekt es noch nicht berechnet hat (= Upgrade-Pfad sichtbar).
    var ds2HintBadge = opts.canDs2 && !opts.showInvestor ?
      '<div class="sbc-ds2-hint" title="Dein Plan kann den Investor Deal Score — fülle die DS2-Felder aus, um diesen Deal zu vervollständigen.">⚡ DS2</div>' : '';

    // V30: Mit Foto → reines Bild (kein Icon-Overlay).
    //      Ohne Foto → Haus-Icon als Platzhalter.
    var thumb = opts.photoSrc
      ? '<div class="sbc-thumb sbc-thumb-photo" style="background-image:url(\'' + _esc(opts.photoSrc) + '\')"></div>'
      : '<div class="sbc-thumb sbc-thumb-empty">' +
          '<div class="sbc-thumb-icon">' + _houseIcon() + '</div>' +
        '</div>';

    // ── DSCR/LTV Mini-Card mit Slider + Marker ──
    // V110: Klick toggelt zwischen DSCR und LTV (Marcels Wunsch)
    var dscrVal = (opts.dscr != null && !isNaN(opts.dscr)) ? parseFloat(opts.dscr) : null;
    var ltvVal  = (opts.ltv  != null && !isNaN(opts.ltv))  ? parseFloat(opts.ltv)  : null;
    // LTV kommt als 0..1 oder 0..100 — normalisieren
    if (ltvVal != null && Math.abs(ltvVal) <= 1) ltvVal = ltvVal * 100;
    var dscrCard = '';
    if (dscrVal != null) {
      var dscrCls = _dscrClass(opts.dscr);
      // DSCR-Marker: 0 → 0%, 1.0 → 33%, 1.5 → 66%, 2+ → 100%
      var dscrMarkerPct = Math.min(100, Math.max(0, (Math.min(dscrVal, 2.0) / 2.0) * 100));
      // LTV-Klasse: <85 grün, 85-100 gold, >100 rot — DealPilot-Konvention (V21)
      var ltvCls = (ltvVal == null) ? 'neutral'
                 : ltvVal < 85 ? 'good'
                 : ltvVal <= 100 ? 'warn'
                 : 'bad';
      // LTV-Marker: 0 → 0%, 100 → 100%, > 100 → 100% (gekappt)
      var ltvMarkerPct = ltvVal == null ? 0 : Math.min(100, Math.max(0, ltvVal));
      var dscrAlertIcon = dscrCls === 'bad' ? '<span class="sbcm-alert">⚠</span>' : '';
      var ltvAlertIcon  = ltvCls  === 'bad' ? '<span class="sbcm-alert">⚠</span>' : '';
      // Toggle nur wenn LTV vorhanden ist — sonst nur DSCR-Anzeige ohne Click
      var hasToggle = (ltvVal != null);
      var toggleAttrs = hasToggle
        ? ' sbcm-toggleable" data-mode="dscr"' +
          ' data-dscr-val="' + dscrVal.toFixed(2).replace('.', ',') + '"' +
          ' data-dscr-fill="' + dscrMarkerPct.toFixed(1) + '"' +
          ' data-dscr-cls="' + dscrCls + '"' +
          ' data-ltv-val="' + ltvVal.toFixed(1).replace('.', ',') + ' %"' +
          ' data-ltv-fill="' + ltvMarkerPct.toFixed(1) + '"' +
          ' data-ltv-cls="' + ltvCls + '"' +
          ' onclick="event.stopPropagation();_toggleSbcDscr(this)"' +
          ' title="Klick: zwischen DSCR und LTV wechseln'
        : '" title="Debt Service Coverage Ratio';
      var initialLabel = 'DSCR';
      var initialVal   = dscrVal.toFixed(2).replace('.', ',');
      var initialFill  = dscrMarkerPct;
      var initialAlert = dscrAlertIcon;
      dscrCard =
        '<div class="sbcm sbcm-' + dscrCls + toggleAttrs + '">' +
          '<div class="sbcm-head"><span class="sbcm-label" data-dscr-label>' + initialLabel + '</span>' +
            (hasToggle ? '<span class="sbcm-toggle-ico">⇅</span>' : '<span class="sbcm-info">ⓘ</span>') +
          '</div>' +
          '<div class="sbcm-val-row"><span class="sbcm-val" data-dscr-out>' + initialVal + '</span>' +
            '<span data-dscr-alert>' + initialAlert + '</span>' +
          '</div>' +
          '<div class="sbcm-track">' +
            '<div class="sbcm-track-fill" data-dscr-fillel style="width:' + initialFill + '%"></div>' +
            '<div class="sbcm-track-marker" data-dscr-markerel style="left:' + initialFill + '%"></div>' +
          '</div>' +
          '<div class="sbcm-scale" data-dscr-scale><span>0</span><span>1</span><span>1,5</span><span>2+</span></div>' +
        '</div>';
    }

    // ── CF Mini-Card mit Sparkline ──
    // V63.10 KRITISCHER FIX: cf_ns ist JÄHRLICH gespeichert (State.kpis.cf_ns aus calc.js).
    // Default-Anzeige ist Jahr (nicht durch ×12 verfälscht). Klick toggelt zwischen Jahr und Monat.
    var cfVal = (opts.cf_ns != null && !isNaN(opts.cf_ns)) ? parseFloat(opts.cf_ns) : null;
    var cfCard = '';
    if (cfVal != null) {
      var cfCls = _cfClass(opts.cf_ns);
      // V63.10: cfVal IST der Jahres-Wert. Monat = cfVal / 12.
      var cfYearVal  = cfVal;
      var cfMonthVal = cfVal / 12;
      var cfYearTxt  = (cfYearVal >= 0 ? '+' : '') + Math.round(cfYearVal).toLocaleString('de-DE') + ' €';
      var cfMonthTxt = (cfMonthVal >= 0 ? '+' : '') + Math.round(cfMonthVal).toLocaleString('de-DE') + ' €';
      var trend = (opts._cfTrend && opts._cfTrend.length >= 4) ? opts._cfTrend : _synthTrend(cfVal);
      cfCard =
        '<div class="sbcm sbcm-' + cfCls + ' sbcm-toggleable" data-mode="year" data-month-val="' + _esc(cfMonthTxt) + '" data-year-val="' + _esc(cfYearTxt) + '" onclick="event.stopPropagation();_toggleSbcCf(this)" title="Klick: zwischen Jahr und Monat wechseln">' +
          '<div class="sbcm-head"><span class="sbcm-label" data-cf-label>CF/J</span><span class="sbcm-toggle-ico">⇅</span></div>' +
          '<div class="sbcm-val" data-cf-val>' + cfYearTxt + '</div>' +
          '<svg class="sbcm-spark" viewBox="0 0 100 30" preserveAspectRatio="none">' +
            _sparklinePath(trend) +
          '</svg>' +
        '</div>';
    }

    // ── BMR/NMR Mini-Card mit Bar ──
    // V63.7: Klick toggelt zwischen BMR (Brutto) und NMR (Netto)
    var bmrVal = (opts.bmy != null && !isNaN(opts.bmy)) ? parseFloat(opts.bmy) : null;
    var bmrCard = '';
    if (bmrVal != null) {
      var bmrPct = Math.abs(bmrVal) <= 1 ? bmrVal * 100 : bmrVal;
      // NMR ≈ BMR × 0.7-0.8 (nach Bewirtschaftungskosten). Heuristik wenn nicht direkt vorhanden:
      var nmrPct = (opts.nmr != null && !isNaN(opts.nmr))
        ? (Math.abs(opts.nmr) <= 1 ? opts.nmr * 100 : opts.nmr)
        : (bmrPct * 0.75);    // Heuristik: 25% Bewirtschaftungs-Anteil
      var bmrFillPct = Math.min(100, Math.max(0, (bmrPct / 10) * 100));
      var nmrFillPct = Math.min(100, Math.max(0, (nmrPct / 10) * 100));
      bmrCard =
        '<div class="sbcm sbcm-info sbcm-toggleable" data-mode="bmr" ' +
             'data-bmr-val="' + bmrPct.toFixed(2).replace('.', ',') + ' %" data-bmr-fill="' + bmrFillPct + '" ' +
             'data-nmr-val="' + nmrPct.toFixed(2).replace('.', ',') + ' %" data-nmr-fill="' + nmrFillPct + '" ' +
             'onclick="event.stopPropagation();_toggleSbcBmr(this)" title="Klick: zwischen BMR (Brutto) und NMR (Netto) wechseln">' +
          '<div class="sbcm-head"><span class="sbcm-label" data-bmr-label>BMR</span><span class="sbcm-toggle-ico">⇅</span></div>' +
          '<div class="sbcm-val" data-bmr-out>' + bmrPct.toFixed(2).replace('.', ',') + ' %</div>' +
          '<div class="sbcm-bar"><div class="sbcm-bar-fill" data-bmr-fillel style="width:' + bmrFillPct + '%"></div></div>' +
          '<div class="sbcm-scale"><span>0%</span><span>5%</span><span>10%</span></div>' +
        '</div>';
    }

    var miniCards = (dscrCard || cfCard || bmrCard)
      ? '<div class="sbc-mini-grid">' + dscrCard + cfCard + bmrCard + '</div>'
      : '';

    // V76: Adresse als EIGENE Zeile zwischen ObjektID-Header und Kaufpreis (Marcels Wunsch),
    // weiße Schrift. Vorher quetschte sich die Straße in Line 1 mit Badges → wurde abgeschnitten.
    var streetCity = addr.street + (addr.city ? (addr.street ? ', ' : '') + addr.city : '');

    // V80: Score-Block ist KEIN Kind von kp-row mehr — sitzt als position:absolute
    // Overlay rechts oben auf der Card. Damit kann der Body (Adresse + Kaufpreis)
    // sich frei nach oben/unten erstrecken und der Score überlappt nur im Notfall.
    var scoreOverlay = (opts.ds2Score != null)
      ? '<div class="sbc-score-overlay">' +
          '<div class="sbc-mini-score ' + opts.ds2ScoreCls + '" title="DealScore 2.0: ' + opts.ds2Score + '/100">' +
            '<svg viewBox="0 0 32 32" width="28" height="28"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-opacity="0.18"/>' +
            '<circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="' + (opts.ds2Score / 100 * 81.7).toFixed(1) + ' 81.7" stroke-linecap="round" transform="rotate(-90 16 16)"/></svg>' +
            '<span class="sbc-mini-score-num">' + opts.ds2Score + '</span>' +
          '</div>' +
          '<span class="sbc-score-label ' + opts.ds2ScoreCls + '">' + _scoreLabel(opts.ds2Score) + '</span>' +
        '</div>'
      : '';

    return '<div class="sb-card' + (opts.isActive ? ' active' : '') + (opts.showInvestor ? ' has-investor-ribbon' : '') + (opts.dealWon ? ' deal-won' : '') + '" data-key="' + _esc(opts.key) + '">' +
      investorRibbon +
      wonRibbon +
      scoreOverlay +
      '<div class="sbc-top">' +
        thumb +
        '<div class="sbc-top-body">' +
          '<div class="sbc-top-line1">' +
            seqHtml +
            aiHtml +
            ds2HintBadge +
            (opts.date ? '<span class="sbc-date">' + _esc(opts.date) + '</span>' : '') +
            '<span class="sbc-arrow">›</span>' +
          '</div>' +
          (streetCity ? '<div class="sbc-address" title="' + _esc(opts.name) + '">' + _esc(streetCity) + '</div>' : '') +
          '<div class="sbc-kp-row">' +
            '<div class="sbc-kp">' + _fmtEUR(opts.kp) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      miniCards +
      '<div class="sbc-actions">' +
        '<button class="sbc-btn" onclick="event.stopPropagation();dupSaved(\'' + _esc(opts.key) + '\')" title="Duplizieren">⎘</button>' +
        '<button class="sbc-btn sbc-del" onclick="event.stopPropagation();delSaved(\'' + _esc(opts.key) + '\')" title="Löschen">×</button>' +
      '</div>' +
    '</div>';
  }

  // SVG-Helper
  function _houseIcon() {
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12L12 4l9 8"/><path d="M5 11v9h14v-9"/><path d="M10 20v-5h4v5"/></svg>';
  }
  function _synthTrend(currentValue) {
    // Synthetische, leicht ansteigende Trendkurve falls keine Historie vorliegt
    var v = currentValue || 0;
    var sign = v >= 0 ? 1 : -1;
    var amp = Math.max(50, Math.abs(v) * 0.4);
    var pts = [];
    for (var i = 0; i < 12; i++) {
      // leichter Anstieg + bisschen rauschen
      var p = v - amp + (i / 11) * amp * 1.5 + (Math.sin(i * 1.3) * amp * 0.15) * sign;
      pts.push(p);
    }
    pts.push(v);
    return pts;
  }
  function _sparklinePath(values) {
    if (!values || values.length < 2) return '';
    var min = Math.min.apply(null, values);
    var max = Math.max.apply(null, values);
    var range = max - min || 1;
    var stepX = 100 / (values.length - 1);
    var pts = values.map(function(v, i) {
      var x = i * stepX;
      var y = 28 - ((v - min) / range) * 24 - 2;
      return [x, y];
    });
    var d = 'M' + pts.map(function(p){ return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L');
    var polyD = d + ' L' + pts[pts.length-1][0].toFixed(1) + ',30 L0,30 Z';
    return '<path d="' + polyD + '" fill="currentColor" opacity="0.18"/>' +
           '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>';
  }

  if (Auth.isApiMode()) {
    try {
      // V98: NUR "Lade..." zeigen wenn die Liste wirklich leer ist (erstes Render).
      //      Sonst bleiben die alten Cards sichtbar bis neue Daten kommen — kein Flash mehr.
      var listIsEmpty = !list.children.length || list.querySelector('.sb-empty');
      if (listIsEmpty && !_renderCache.items) {
        list.innerHTML = '<div class="sb-empty">Lade...</div>';
      }

      // V98: Cache nutzen wenn frisch (< 60s) und wir nicht explicit force-fresh wollen
      var now = Date.now();
      var useCache = _renderCache.items && (now - _renderCache.ts) < _renderCache.ttl && !opts.forceFresh;

      var items;
      if (useCache) {
        items = _renderCache.items;
      } else if (_renderInflight) {
        // V98: In-Flight-Dedup — wenn schon ein Fetch läuft, warten wir auf den (statt zweimal zu fetchen)
        var inflightResp = await _renderInflight;
        items = inflightResp.items || [];
      } else {
        // V30: Cache-Buster — verhindert dass Browser nach saveObj() ein gestale-tes thumbnail zeigt
        _renderInflight = Auth.apiCall('/objects?limit=100&_t=' + Date.now());
        try {
          var resp = await _renderInflight;
          items = resp.items || [];
          _renderCache.items = items;
          _renderCache.ts = now;
        } finally {
          _renderInflight = null;
        }
      }

      if (!items.length) {
        list.innerHTML = '<div class="sb-empty">Noch keine Objekte<br>gespeichert.</div>';
        return;
      }
      // V63.27: Sortierung — aktives Objekt zuerst, dann nach Sort-Modus
      var sortMode = (window.localStorage && localStorage.getItem('dp_sb_sort')) || 'recent';
      // V98: items klonen damit Sort den Cache nicht mutiert
      items = items.slice();
      items.sort(function(a, b) {
        // Aktives Objekt IMMER zuerst
        if (a.id === _currentObjKey && b.id !== _currentObjKey) return -1;
        if (b.id === _currentObjKey && a.id !== _currentObjKey) return 1;
        // Sonst nach gewähltem Modus
        if (sortMode === 'id') {
          // Nach seq_no ABsteigend (höchste/neueste ID zuerst)
          var sa = (a.seq_no || ''), sb = (b.seq_no || '');
          if (sa < sb) return 1;
          if (sa > sb) return -1;
          return 0;
        } else {
          // Default: zuletzt bearbeitet zuerst
          return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
        }
      });

      // V63.25: Duplikat-Detection — Set aller seq_no und markieren welche doppelt vorkommen
      var _seqCounts = {};
      items.forEach(function(o) {
        var s = o.seq_no || '';
        if (s) _seqCounts[s] = (_seqCounts[s] || 0) + 1;
      });
      var _dupSeqs = {};
      Object.keys(_seqCounts).forEach(function(s) {
        if (_seqCounts[s] > 1) _dupSeqs[s] = true;
      });

      list.innerHTML = items.map(function(o) {
        // V63.26: KONSISTENTER Score-Pfad
        // Plan-Gate für Investor-Sternchen
        var hasDs2Feature = false;
        if (window.DealPilotConfig && DealPilotConfig.pricing && typeof DealPilotConfig.pricing.hasFeature === 'function') {
          hasDs2Feature = DealPilotConfig.pricing.hasFeature('deal_score_v2');
        }
        var showInvestor = !!(hasDs2Feature && o.ds2_computed);

        // Score-Auswahl:
        //   - Plan kann DS2 + DS2 wirklich berechnet → DS2-Score (aus DB)
        //   - sonst → DealPilot Score (aus DB)
        var ds2Score = null, ds2Cls = '';
        var liveCf = null, liveDscr = null, liveBmy = null, liveKp = null;

        if (showInvestor && o.ds2_score_persist != null) {
          ds2Score = o.ds2_score_persist;
        } else if (o.dealpilot_score != null) {
          ds2Score = o.dealpilot_score;
        }

        // Aktive Karte: live aus DOM für Sofort-Update beim Tippen
        if (o.id === _currentObjKey) {
          try {
            var _useDs2 = showInvestor;
            if (_useDs2 && window.DealScore2 && typeof window._buildDeal2FromState === 'function') {
              var liveDeal = window._buildDeal2FromState();
              var liveResult = window.DealScore2.compute(liveDeal);
              if (liveResult && liveResult.score) ds2Score = Math.round(liveResult.score);
            } else if (typeof DealScore !== 'undefined' && typeof DealScore.compute === 'function') {
              var liveDp = DealScore.compute();
              if (liveDp && liveDp.score) ds2Score = Math.round(liveDp.score);
            }
            function _v(id) { var e = document.getElementById(id); return e ? e.value : ''; }
            function _n(id) { return (typeof parseDe === 'function') ? parseDe(_v(id)) : (parseFloat(_v(id)) || 0); }
            liveKp = _n('kp');
            var cfMonEl = document.getElementById('hdr-cf-mon');
            var dscrEl  = document.getElementById('hdr-dscr');
            var bmyEl   = document.getElementById('hdr-bmy');
            if (cfMonEl) liveCf  = parseDe((cfMonEl.textContent || '').replace(/[^\d.,-]/g, ''));
            if (dscrEl)  liveDscr = parseDe((dscrEl.textContent || '').replace(/[^\d.,-]/g, ''));
            if (bmyEl)   liveBmy  = parseDe((bmyEl.textContent || '').replace(/[^\d.,-]/g, ''));
          } catch(e) {}
        }

        // Letzter Fallback: Heuristik aus bmy für Alt-Objekte (vor V63.26) ohne persistierten Score
        if (ds2Score == null && o.bmy != null && !isNaN(o.bmy)) {
          if (typeof DealScore !== 'undefined' && typeof DealScore.computeFromKpis === 'function') {
            try {
              var bmrPct = Math.abs(o.bmy) <= 1 ? o.bmy * 100 : o.bmy;
              var nmrPct = (o.nmy != null) ? (Math.abs(o.nmy) <= 1 ? o.nmy * 100 : o.nmy) : bmrPct * 0.7;
              var cfMon  = (o.cf_ns != null) ? o.cf_ns / 12 : 0;
              var ltvPct = (o.ltv != null)   ? (Math.abs(o.ltv) <= 1 ? o.ltv * 100 : o.ltv) : 80;
              var dscrV  = (o.dscr != null)  ? o.dscr : 1.2;
              var kpVal  = o.kaufpreis || 1;
              var resCard = DealScore.computeFromKpis({
                kp: kpVal,
                cf_m: cfMon,
                nmy: nmrPct,
                ltv: ltvPct,
                dscr: dscrV,
                wp_kpi: kpVal * 0.05,
                mstg: 1.5
              });
              if (resCard && resCard.score) ds2Score = Math.round(resCard.score);
            } catch(e) {}
          }
        }
        if (ds2Score != null) {
          ds2Cls = ds2Score >= 85 ? 'sbc-score-green-strong' :
                   ds2Score >= 70 ? 'sbc-score-green' :
                   ds2Score >= 50 ? 'sbc-score-gold' : 'sbc-score-red';
        }
        return _renderRichCard({
          key: o.id,
          seq: o.seq_no || '',
          isDuplicateSeq: !!(o.seq_no && _dupSeqs[o.seq_no]),       // V63.25
          name: o.name || 'Unbenannt',
          kp: liveKp != null ? liveKp : o.kaufpreis,
          cf_ns: liveCf != null ? liveCf : o.cf_ns,
          dscr: liveDscr != null ? liveDscr : o.dscr,
          bmy: liveBmy != null ? liveBmy : o.bmy,
          ltv:  o.ltv,                          // V110: LTV für Toggle DSCR↔LTV
          ds2Score: ds2Score,
          ds2ScoreCls: ds2Cls,
          showInvestor: showInvestor,         // V63.25 NEU
          canDs2: hasDs2Feature,              // V63.25: Plan kann DS2
          dealWon: !!o.deal_won,              // V104: Won-Flag aus DB
          photoSrc: o.thumbnail || null,
          hasAi: o.has_ai,
          isActive: (o.id === _currentObjKey),
          date: o.updated_at ? new Date(o.updated_at).toLocaleDateString('de-DE') : ''
        });
      }).join('') + _addNewBtn();
      list.querySelectorAll('.sb-card').forEach(function(el) {
        el.addEventListener('click', function() {
          // V102: Burger-Menü auf Mobile sofort schließen wenn ein Objekt angeklickt wird
          if (typeof window.closeMobileSidebarOnAction === 'function') {
            window.closeMobileSidebarOnAction();
          }
          loadSaved(this.getAttribute('data-key'));
        });
      });
    } catch (err) {
      list.innerHTML = '<div class="sb-empty">⚠ Fehler: ' + err.message + '</div>' + _addNewBtn();
    }
  } else {
    // localStorage mode
    var prefix = (Auth.isLoggedIn()) ? Auth.getStorageKey('obj_') : 'ji_';
    var keys = Object.keys(localStorage)
      .filter(function(k) {
        if (Auth.isLoggedIn()) return k.startsWith(prefix);
        return k.startsWith('ji_') && !k.startsWith('ji_u_') &&
               !['ji_ak','ji_ak_oai','ji_provider','ji_sb_collapsed','ji_users','ji_session','ji_token'].includes(k);
      }).sort().reverse();

    if (!keys.length) {
      list.innerHTML = '<div class="sb-empty">Noch keine Objekte<br>gespeichert.</div>' + _addNewBtn();
      return;
    }
    list.innerHTML = keys.map(function(k) {
      var d = {};
      try { d = JSON.parse(localStorage.getItem(k) || '{}'); } catch(e) {}
      var photoSrc = null;
      if (Array.isArray(d._photos) && d._photos.length) photoSrc = d._photos[0];
      else if (d._photo) photoSrc = d._photo;
      // V40: DS2-Score berechnen (vollständige Daten lokal verfügbar)
      var ds2Score = null, ds2Cls = '';
      if (window.DealScore2 && typeof window._buildDeal2FromStateForObject === 'function') {
        try {
          var deal = window._buildDeal2FromStateForObject(d);
          var result = window.DealScore2.compute(deal);
          ds2Score = Math.round(result.score || 0);
          ds2Cls = ds2Score >= 85 ? 'sbc-score-green-strong' :
                   ds2Score >= 70 ? 'sbc-score-green' :
                   ds2Score >= 50 ? 'sbc-score-gold' : 'sbc-score-red';
        } catch(e) {}
      }
      // V63.25: Investor-Sternchen Plan-Gate auch im LocalStorage-Pfad
      var hasDs2FeatureLs = false;
      if (window.DealPilotConfig && DealPilotConfig.pricing && typeof DealPilotConfig.pricing.hasFeature === 'function') {
        hasDs2FeatureLs = DealPilotConfig.pricing.hasFeature('deal_score_v2');
      }
      var showInvestorLs = !!(hasDs2FeatureLs && d._ds2_computed);
      return _renderRichCard({
        key: k,
        seq: d._obj_seq || '',
        name: d._name || 'Unbenannt',
        kp: d.kp ? parseFloat(d.kp) : null,
        cf_ns: d._kpis_cf_ns,
        dscr: d._kpis_dscr,
        bmy: d._kpis_bmy,
        ltv: d._kpis_ltv,                     // V110: LTV für Toggle DSCR↔LTV
        ds2Score: ds2Score,
        ds2ScoreCls: ds2Cls,
        showInvestor: showInvestorLs,         // V63.25 NEU
        canDs2: hasDs2FeatureLs,              // V63.25: Plan kann DS2
        photoSrc: photoSrc,
        hasAi: !!(d._ai),
        isActive: (k === _currentObjKey),
        date: d._at ? new Date(d._at).toLocaleDateString('de-DE') : ''
      });
    }).join('') + _addNewBtn();
    list.querySelectorAll('.sb-card').forEach(function(el) {
      el.addEventListener('click', function() {
        // V102: Burger-Menü auf Mobile sofort schließen
        if (typeof window.closeMobileSidebarOnAction === 'function') {
          window.closeMobileSidebarOnAction();
        }
        loadSaved(this.getAttribute('data-key'));
      });
    });
  }
}

function _addNewBtn() {
  return '<button class="sb-add-new" onclick="newObj()">+ Neues Objekt hinzufügen</button>';
}

// ══════════════════════════════════════════════════
// LOAD / DUPLICATE / DELETE
// ══════════════════════════════════════════════════
async function loadSaved(k) {
  if (Auth.isApiMode()) {
    try {
      var obj = await Auth.apiCall('/objects/' + k);
      var d = obj.data || {};
      d._ai = obj.ai_analysis || '';
      // Restore photos
      if (typeof imgs !== 'undefined' && obj.photos) {
        imgs = (obj.photos || []).map(function(src, i){ return { src: src, name: 'photo_' + i + '.jpg' }; });
        if (typeof renderImgs === 'function') renderImgs();
      }
      loadData(d);
      _currentObjKey = k;

      // Load bemerkungen for this object (Migration 006)
      try {
        window._taxYearlyBemerkungen = {};
        var bemResp = await Auth.apiCall('/tax-records/object/' + k + '/bemerkungen');
        (bemResp.items || []).forEach(function(item) {
          var yKey = 'y' + item.year;
          if (!window._taxYearlyBemerkungen[yKey]) window._taxYearlyBemerkungen[yKey] = {};
          window._taxYearlyBemerkungen[yKey][item.field] = item.bemerkung || '';
        });
      } catch(e) { /* endpoint not yet ready */ }

      // V63.8: QC-Host als nicht-gerendert markieren — beim nächsten QC-Besuch wird neu gerendert
      var __qcH = document.getElementById('qc-tab-host'); if (__qcH) __qcH.dataset.rendered = '0';
      // V63.48: Erst auf Einzelobjekt-View wechseln (falls in "Alle Objekte" View)
      if (typeof setMainView === 'function') setMainView('single');
      // V63.77 FIX: Falls User im Quick-Check-Standalone war → diesen sauber verlassen, dann zu Tab Objekt
      if (typeof exitQuickCheckMode === 'function') exitQuickCheckMode();
      if (typeof switchTab === 'function') switchTab(0);
      // V63.48: Workflow-Bar nach Daten-Load aktualisieren (Felder sind jetzt befüllt)
      if (window.DealPilotWorkflow && typeof DealPilotWorkflow.renderProgressBar === 'function') {
        setTimeout(DealPilotWorkflow.renderProgressBar, 100);
      }
      renderSaved();
      toast('✓ Geladen: ' + (obj.name || 'Objekt'));
    } catch (err) {
      toast('⚠ Fehler beim Laden: ' + err.message);
    }
  } else {
    var d = {};
    try { d = JSON.parse(localStorage.getItem(k) || '{}'); } catch(e) {}
    if (typeof imgs !== 'undefined' && d._photos) {
      imgs = d._photos.map(function(src, i){ return { src: src, name: 'photo_' + i + '.jpg' }; });
      if (typeof renderImgs === 'function') renderImgs();
    }
    loadData(d);
    _currentObjKey = k;
    // V63.8: QC-Host als nicht-gerendert markieren — beim nächsten QC-Besuch wird neu gerendert
      var __qcH = document.getElementById('qc-tab-host'); if (__qcH) __qcH.dataset.rendered = '0';
      // V63.48: Erst auf Einzelobjekt-View wechseln, dann auf Tab Objekt + WF-Update
      if (typeof setMainView === 'function') setMainView('single');
      // V63.77 FIX: Falls User im Quick-Check-Standalone war → diesen sauber verlassen, dann zu Tab Objekt
      if (typeof exitQuickCheckMode === 'function') exitQuickCheckMode();
      if (typeof switchTab === 'function') switchTab(0);
      if (window.DealPilotWorkflow && typeof DealPilotWorkflow.renderProgressBar === 'function') {
        setTimeout(DealPilotWorkflow.renderProgressBar, 100);
      }
    renderSaved();
    toast('✓ Geladen: ' + (d._name || 'Objekt'));
  }
}

async function dupSaved(k) {
  if (Auth.isApiMode()) {
    try {
      var obj = await Auth.apiCall('/objects/' + k);
      var newData = obj.data || {};
      // V27: Kein "(Kopie)"-Suffix mehr — Marcel will saubere Anzeige.
      // Falls der User unterschiedliche Namen will, kann er sie nach dem Speichern selbst anpassen.
      newData._name = newData._name || obj.name || 'Unbenannt';
      await Auth.apiCall('/objects', {
        method: 'POST',
        body: { data: newData, aiAnalysis: obj.ai_analysis, photos: obj.photos || [] }
      });
      invalidateRenderCache();  // V98
      renderSaved({forceFresh: true, _immediate: true});
      toast('✓ Dupliziert');
    } catch (err) { toast('⚠ Fehler: ' + err.message); }
  } else {
    var d = {};
    try { d = JSON.parse(localStorage.getItem(k) || '{}'); } catch(e) {}
    // V27: Kein "(Kopie)" mehr
    d._at = new Date().toISOString();
    localStorage.setItem('ji_' + Date.now(), JSON.stringify(d));
    invalidateRenderCache();  // V98
    renderSaved();
    toast('✓ Dupliziert');
  }
}

async function delSaved(k) {
  var name = '';
  if (Auth.isApiMode()) {
    if (!confirm('Objekt wirklich löschen?')) return;
    try {
      await Auth.apiCall('/objects/' + k, { method: 'DELETE' });
      // V63.27: Wenn das aktuell geladene Objekt gelöscht wurde → Eingabemaske + Header leeren
      if (_currentObjKey === k) {
        _currentObjKey = null;
        _resetUiAfterDelete();
      }
      invalidateRenderCache();  // V98
      renderSaved({forceFresh: true, _immediate: true});
      toast('Gelöscht');
    } catch (err) { toast('⚠ Fehler: ' + err.message); }
  } else {
    var d = {};
    try { d = JSON.parse(localStorage.getItem(k) || '{}'); } catch(e) {}
    name = d._name || 'Objekt';
    if (!confirm('"' + name + '" wirklich löschen?')) return;
    localStorage.removeItem(k);
    if (_currentObjKey === k) {
      _currentObjKey = null;
      _resetUiAfterDelete();
    }
    invalidateRenderCache();  // V98
    renderSaved();
    if(typeof updateSidebarPortfolio==='function')setTimeout(updateSidebarPortfolio,300);
    toast('Gelöscht');
  }
}

// V63.27: UI-Reset nach Löschen des aktiven Objekts
function _resetUiAfterDelete() {
  // Alle Hauptfelder leeren
  if (typeof FIELDS !== 'undefined' && Array.isArray(FIELDS)) {
    FIELDS.forEach(function(id) {
      var e = document.getElementById(id);
      if (e) e.value = '';
    });
  }
  // QC-Felder
  var qcIds = ['qc_kp','qc_nkm','qc_nkm_grund','qc_nkm_stp','qc_nkm_garage','qc_nkm_kueche','qc_nkm_sonst',
               'qc_ek','qc_knk','qc_knk_eur','qc_san','qc_zins','qc_zinsen','qc_tilg','qc_d1','qc_d1z','qc_d1t',
               'qc_str','qc_hnr','qc_plz','qc_ort','qc_wfl','qc_baujahr','qc_bj','qc_adresse',
               'qc_zimmer','qc_stellplatz','qc_objektart','qc_energieklasse','qc_hg','qc_hg_split','qc_nul','qc_ul'];
  qcIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Score-Anzeigen leeren
  ['qc-score-value','qc-score-tag','dealscore-box','ds2-box','hdr-cf-mon','hdr-bmy','hdr-dscr','hdr-obj','hdr-obj-num'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'INPUT') el.value = '';
      else el.textContent = '—';
    }
  });
  // Bilder leeren
  if (typeof imgs !== 'undefined') { imgs = []; if (typeof renderImgs === 'function') renderImgs(); }
  window._aiText = '';
  window._aiAnalysis = null;
  window._currentObjSeq = null;
  // State zurücksetzen
  if (window.State && State.kpis) State.kpis = {};
  // QC-Host als nicht-gerendert markieren
  var qcHost = document.getElementById('qc-tab-host');
  if (qcHost) qcHost.dataset.rendered = '0';
  // Header neu rendern (zeigt "Neues Objekt")
  if (typeof updHeader === 'function') updHeader();
  if (typeof calc === 'function') calc();
}

// ══════════════════════════════════════════════════
// EXPORT / IMPORT
// ══════════════════════════════════════════════════
async function exportAllJSON() {
  var all = [];
  if (Auth.isApiMode()) {
    try {
      var resp = await Auth.apiCall('/objects?limit=500');
      // Need full objects, not just summaries
      for (var i = 0; i < (resp.items || []).length; i++) {
        var full = await Auth.apiCall('/objects/' + resp.items[i].id);
        all.push({
          data: full.data, ai_analysis: full.ai_analysis,
          photos: full.photos, name: full.name, created_at: full.created_at
        });
      }
    } catch (err) { toast('⚠ Export-Fehler: ' + err.message); return; }
  } else {
    var prefix = Auth.isLoggedIn() ? Auth.getStorageKey('obj_') : 'ji_';
    var keys = Object.keys(localStorage).filter(function(k) {
      if (Auth.isLoggedIn()) return k.startsWith(prefix);
      return k.startsWith('ji_') && !k.startsWith('ji_u_') &&
             !['ji_ak','ji_ak_oai','ji_provider','ji_sb_collapsed','ji_users','ji_session','ji_token'].includes(k);
    });
    all = keys.map(function(k) { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch(e) { return {}; } });
  }
  var blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Junker_Kalkulationen_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  toast('✓ ' + all.length + ' Objekte exportiert');
}

// V63.44: Direkter Alias für die neue Sidebar-Aktion
window.exportAllObjectsJson = exportAllJSON;

// ══════════════════════════════════════════════════
// V118: Pro-Objekt-Export für JSON und Excel
// ══════════════════════════════════════════════════

/**
 * V118: Exportiert ein EINZELNES Objekt als JSON.
 * Die Datei enthält denselben Datensatz wie die "alle Objekte"-Sicherung,
 * nur als Array mit einem Element. Damit lässt sie sich später wieder importieren.
 */
async function exportSingleObjectJson(objId) {
  if (!objId) { toast('⚠ Kein Objekt ausgewählt'); return; }
  var single = null;
  try {
    if (Auth.isApiMode()) {
      var full = await Auth.apiCall('/objects/' + objId);
      single = {
        data: full.data, ai_analysis: full.ai_analysis,
        photos: full.photos, name: full.name, created_at: full.created_at
      };
    } else {
      var raw = localStorage.getItem(objId);
      if (raw) single = JSON.parse(raw);
    }
  } catch (e) {
    toast('⚠ Objekt konnte nicht geladen werden: ' + e.message);
    return;
  }
  if (!single) { toast('⚠ Objekt nicht gefunden'); return; }

  // Dateiname aus Adresse / Kürzel
  var d = single.data || {};
  var nameSlug = (d.kuerzel || d.str || single.name || 'objekt')
    .toString()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 40);
  var blob = new Blob([JSON.stringify([single], null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'DealPilot_' + nameSlug + '_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  toast('✓ Objekt "' + (single.name || nameSlug) + '" als JSON gesichert');
}
window.exportSingleObjectJson = exportSingleObjectJson;

/**
 * V118: Helper — baut eine flache Daten-Zeile für die Excel-Tabelle aus einem Objekt.
 * Nutzt die gespeicherten _kpis_*-Felder (kommen aus collectData), damit kein
 * frischer calc()-Lauf nötig ist.
 */
function _buildXlsxRowForObject(o) {
  var d = o.data || {};
  var name = o.name || d.str || d.kuerzel || 'Unbenannt';
  var bmr = d._kpis_bmy != null ? d._kpis_bmy : '';
  var dscr = d._kpis_dscr != null ? d._kpis_dscr : '';
  var ltv = d._kpis_ltv != null ? d._kpis_ltv : '';
  var cfns = d._kpis_cf_ns != null ? d._kpis_cf_ns : '';
  var ds1 = d._dealpilot_score != null ? d._dealpilot_score : '';
  var ds2 = d._ds2_score != null ? d._ds2_score : '';
  return {
    Name: name,
    Kuerzel: d.kuerzel || '',
    Strasse: (d.str || '') + ' ' + (d.hnr || ''),
    PLZ: d.plz || '',
    Ort: d.ort || '',
    Objektart: d.objart || '',
    Baujahr: d.baujahr || '',
    Wohnflaeche_qm: d.wfl || '',
    Kaufpreis: d.kp || '',
    NKM_Monat: d.nkm || '',
    Eigenkapital: d.ek || '',
    Darlehen: d.d1 || '',
    Zins_pct: d.d1z || '',
    Tilgung_pct: d.d1t || '',
    Bindung_J: d.d1_bindj || '',
    Bank: d.bank_inst || '',
    BMR_pct: bmr,
    DSCR: dscr,
    LTV_pct: ltv,
    'CF_n_St_J': cfns,
    DealScore: ds1,
    InvestorScore: ds2,
    Verkehrswert: d.svwert || '',
    Bankbewertung: d.bankval || '',
    Sanierungsbedarf: d.san || '',
    Anlage: o.created_at ? o.created_at.slice(0, 10) : ''
  };
}

/**
 * V118: Exportiert ein EINZELNES Objekt als Excel (.xlsx) mit allen Kennzahlen.
 */
async function exportSingleObjectExcel(objId) {
  if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;
  if (typeof XLSX === 'undefined') { toast('⚠ Excel-Bibliothek (SheetJS) nicht geladen'); return; }
  if (!objId) { toast('⚠ Kein Objekt ausgewählt'); return; }

  var single = null;
  try {
    if (Auth.isApiMode()) {
      var full = await Auth.apiCall('/objects/' + objId);
      single = {
        data: full.data, ai_analysis: full.ai_analysis,
        photos: full.photos, name: full.name, created_at: full.created_at, id: full.id
      };
    } else {
      var raw = localStorage.getItem(objId);
      if (raw) single = JSON.parse(raw);
    }
  } catch (e) {
    toast('⚠ Objekt konnte nicht geladen werden: ' + e.message);
    return;
  }
  if (!single) { toast('⚠ Objekt nicht gefunden'); return; }

  var row = _buildXlsxRowForObject(single);
  var ws = XLSX.utils.json_to_sheet([row]);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Objekt');
  var d = single.data || {};
  var nameSlug = (d.kuerzel || d.str || single.name || 'objekt')
    .toString().replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
  XLSX.writeFile(wb, 'DealPilot_' + nameSlug + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  toast('✓ Objekt "' + (single.name || nameSlug) + '" als Excel exportiert');
}
window.exportSingleObjectExcel = exportSingleObjectExcel;

/**
 * V118: Exportiert ALLE Objekte als ein Excel-Sheet (eine Zeile pro Objekt).
 *   Zuvor war nur CSV verfügbar — Marcels Wunsch: echtes Excel.
 */
async function exportAllObjectsExcel() {
  if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;
  if (typeof XLSX === 'undefined') { toast('⚠ Excel-Bibliothek (SheetJS) nicht geladen'); return; }

  var all = [];
  try {
    if (Auth.isApiMode()) {
      var resp = await Auth.apiCall('/objects?limit=500');
      for (var i = 0; i < (resp.items || []).length; i++) {
        var full = await Auth.apiCall('/objects/' + resp.items[i].id);
        all.push({
          data: full.data, ai_analysis: full.ai_analysis,
          photos: full.photos, name: full.name, created_at: full.created_at, id: full.id
        });
      }
    } else {
      var prefix = Auth.isLoggedIn() ? Auth.getStorageKey('obj_') : 'ji_';
      var keys = Object.keys(localStorage).filter(function(k) {
        if (Auth.isLoggedIn()) return k.startsWith(prefix);
        return k.startsWith('ji_') && !k.startsWith('ji_u_') &&
               !['ji_ak','ji_ak_oai','ji_provider','ji_sb_collapsed','ji_users','ji_session','ji_token'].includes(k);
      });
      all = keys.map(function(k) { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch(e) { return {}; } });
    }
  } catch (e) { toast('⚠ Export-Fehler: ' + e.message); return; }

  if (!all.length) { toast('⚠ Keine Objekte zum Exportieren gefunden'); return; }

  var rows = all.map(_buildXlsxRowForObject);
  var ws = XLSX.utils.json_to_sheet(rows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Objekte');
  XLSX.writeFile(wb, 'DealPilot_Alle_Objekte_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  toast('✓ ' + all.length + ' Objekte als Excel exportiert');
}
window.exportAllObjectsExcel = exportAllObjectsExcel;

// V63.44: Trigger-Helfer — erzeugt versteckten File-Input und klickt ihn,
// damit der User direkt aus der Sidebar Excel/JSON importieren kann
window.triggerImportExcel = function() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xlsm,.xlsb';
  input.style.display = 'none';
  input.onchange = function() {
    if (typeof window.importImmoKalkExcel === 'function' && input.files.length) {
      window.importImmoKalkExcel(input);
    }
  };
  document.body.appendChild(input);
  input.click();
  setTimeout(function() { document.body.removeChild(input); }, 60000);
};

window.triggerImportJson = function() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';
  input.onchange = function() {
    if (typeof importJSON === 'function' && input.files.length) {
      importJSON(input);
    }
  };
  document.body.appendChild(input);
  input.click();
  setTimeout(function() { document.body.removeChild(input); }, 60000);
};

async function importJSON(inp) {
  var f = inp.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = async function(e) {
    try {
      var data = JSON.parse(e.target.result);
      var arr = Array.isArray(data) ? data : [data];
      if (Auth.isApiMode()) {
        for (var i = 0; i < arr.length; i++) {
          var item = arr[i];
          await Auth.apiCall('/objects', {
            method: 'POST',
            body: {
              data: item.data || item,
              aiAnalysis: item.ai_analysis || item._ai || null,
              photos: item.photos || item._photos || []
            }
          });
        }
      } else {
        arr.forEach(function(d) {
          localStorage.setItem('ji_' + Date.now() + '_' + Math.random().toString(36).slice(2), JSON.stringify(d));
        });
      }
      renderSaved();
      toast('✓ ' + arr.length + ' Objekte importiert');
    } catch(err) {
      toast('⚠ Importfehler: ' + err.message);
    }
  };
  r.readAsText(f);
  inp.value = '';
}

function exportCSV() {
  if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;

  if (!State.cfRows || !State.cfRows.length) {
    toast('⚠ Bitte zuerst Daten eingeben');
    return;
  }
  var h = ['Jahr','NKM/Mon','Warmmiete/Mon','BWK/Jahr','Zinsen/Jahr','Tilgung/Jahr',
    'CF operativ','CF n.Steuern','Restschuld','Immo-Wert','EK im Objekt','LTV%'];
  var rows = State.cfRows.map(function(r) {
    return [r.cal, r.nkm_m.toFixed(2), r.wm_m.toFixed(2),
      (-r.bwk_y).toFixed(0), (-r.zy).toFixed(0), (-r.ty).toFixed(0),
      r.cfop_y.toFixed(0), r.cfns_y.toFixed(0),
      r.rs.toFixed(0), r.wert_y.toFixed(0), r.eq_y.toFixed(0),
      r.ltv_y.toFixed(1)];
  });
  var csv = [h].concat(rows).map(function(r) { return r.join(';'); }).join('\n');
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Junker_Cashflow_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  toast('✓ CSV exportiert');
}


// ═══════════════════════════════════════════════════
// PORTFOLIO SUMMARY (alle gespeicherten Objekte aggregiert)
// ═══════════════════════════════════════════════════
async function getAllObjectsData() {
  var objects = [];

  if (Auth.isApiMode()) {
    try {
      var resp = await Auth.apiCall('/objects?limit=500');
      // For each summary, fetch full data
      var items = resp.items || [];
      for (var i = 0; i < items.length; i++) {
        try {
          var full = await Auth.apiCall('/objects/' + items[i].id);
          var dataObj = full.data || {};
          // V41 BUGFIX: Backend liefert photos als top-level, nicht in data._photos
          // → in dataObj einbetten damit Track Record + Sidebar drauf zugreifen können
          if (Array.isArray(full.photos) && full.photos.length) {
            dataObj._photos = full.photos;
          }
          objects.push({
            id: full.id,
            name: full.name || items[i].name,
            data: dataObj,
            kpis: extractKpisFromData(dataObj)
          });
        } catch(e) {}
      }
    } catch(e) {
      console.warn('Portfolio API error:', e.message);
    }
  } else {
    var prefix = Auth.isLoggedIn() ? Auth.getStorageKey('obj_') : 'ji_';
    var keys = Object.keys(localStorage).filter(function(k) {
      if (Auth.isLoggedIn()) return k.startsWith(prefix);
      return k.startsWith('ji_') && !k.startsWith('ji_u_') &&
             !['ji_ak','ji_ak_oai','ji_provider','ji_sb_collapsed','ji_users','ji_session','ji_token'].includes(k);
    });
    keys.forEach(function(k) {
      try {
        var d = JSON.parse(localStorage.getItem(k) || '{}');
        objects.push({
          id: k,
          name: d._name || 'Objekt',
          data: d,
          kpis: extractKpisFromData(d)
        });
      } catch(e) {}
    });
  }

  return objects;
}

// Calculates basic KPIs from a stored object's data
function extractKpisFromData(d) {
  var kp = parseFloat(d.kp) || 0;
  var nkm_m = parseFloat(d.nkm) || 0;
  var d1 = parseFloat(d.d1) || 0;
  var d1z = (parseFloat(d.d1z) || 0) / 100;
  var d1t = (parseFloat(d.d1t) || 0) / 100;
  var d2 = parseFloat(d.d2) || 0;
  var d2z = (parseFloat(d.d2z) || 0) / 100;

  var nkm_j = nkm_m * 12;
  var bmy = kp > 0 ? (nkm_j / kp * 100) : 0;
  var d1_rate_m = d1 > 0 ? (d1 * (d1z + d1t)) / 12 : 0;
  var d2_zm = d2 > 0 ? (d2 * d2z / 12) : 0;
  var d2_tm = (d._d2_enabled && d.d2_type !== 'tilgungsaussetzung') ? ((d2 * (d2z + (parseFloat(d.d2t) || 0) / 100)) / 12 - d2_zm) : 0;
  var d2_rate_m = d2_zm + d2_tm;
  var rate_total_m = d1_rate_m + d2_rate_m;
  var kd_year = rate_total_m * 12;

  // Use stored summary fields if available (from latest save)
  var stored_bmy = d._kpis_bmy != null ? parseFloat(d._kpis_bmy) : bmy;
  var stored_cf_ns = d._kpis_cf_ns != null ? parseFloat(d._kpis_cf_ns) : 0;
  var stored_dscr = d._kpis_dscr != null ? parseFloat(d._kpis_dscr) : 0;

  return {
    kp: kp,
    nkm_m: nkm_m,
    d_total: d1 + d2,
    bmy: stored_bmy,
    cf_ns_yearly: stored_cf_ns,
    cf_ns_monthly: stored_cf_ns / 12,
    dscr: stored_dscr,
    rate_total_m: rate_total_m
  };
}

// Update sidebar Portfolio panel
async function updateSidebarPortfolio() {
  var objects = await getAllObjectsData();
  var portfolioDiv = document.getElementById('sb-portfolio');
  if (!portfolioDiv) return;

  if (objects.length < 2) {
    portfolioDiv.style.display = 'none';
    return;
  }

  portfolioDiv.style.display = '';

  var totals = {
    count: objects.length,
    invest: 0, miete_m: 0, cf_m: 0,
    bmr_sum: 0, dscr_sum: 0, dscr_n: 0,
    rest_total: 0
  };

  objects.forEach(function(o) {
    totals.invest += o.kpis.kp;
    totals.miete_m += o.kpis.nkm_m;
    totals.cf_m += o.kpis.cf_ns_monthly;
    totals.bmr_sum += o.kpis.bmy;
    if (o.kpis.dscr > 0) {
      totals.dscr_sum += o.kpis.dscr;
      totals.dscr_n++;
    }
    totals.rest_total += o.kpis.d_total;
  });

  var avgBmr = totals.bmr_sum / objects.length;
  var avgDscr = totals.dscr_n > 0 ? (totals.dscr_sum / totals.dscr_n) : 0;

  document.getElementById('port-count').textContent = totals.count;
  document.getElementById('port-invest').textContent = fE(totals.invest, 0);
  document.getElementById('port-miete').textContent = fE(totals.miete_m, 0);
  var cfEl = document.getElementById('port-cf');
  cfEl.textContent = (totals.cf_m >= 0 ? '+' : '') + fE(totals.cf_m, 0);
  cfEl.classList.toggle('positive', totals.cf_m >= 0);
  cfEl.classList.toggle('negative', totals.cf_m < 0);
  document.getElementById('port-bmr').textContent = avgBmr.toFixed(2).replace('.', ',') + ' %';
  document.getElementById('port-dscr').textContent = avgDscr > 0 ? avgDscr.toFixed(2).replace('.', ',') : '—';
  document.getElementById('port-rest').textContent = fE(totals.rest_total, 0);

  // Cache for detail view
  window._portfolioCache = { objects: objects, totals: totals, avgBmr: avgBmr, avgDscr: avgDscr };
}

// Show full Portfolio detail modal
async function showPortfolioDetail() {
  // Use cache or refresh
  if (!window._portfolioCache) await updateSidebarPortfolio();
  var cache = window._portfolioCache;
  if (!cache) {
    toast('Bitte mindestens 2 Objekte speichern');
    return;
  }

  var existing = document.getElementById('portfolio-modal');
  if (existing) existing.remove();

  var t = cache.totals;
  var modal = document.createElement('div');
  modal.id = 'portfolio-modal';
  modal.className = 'portfolio-detail-overlay';
  modal.innerHTML =
    '<div class="portfolio-modal">' +
      '<button class="pricing-close" onclick="document.getElementById(\'portfolio-modal\').remove()">×</button>' +
      '<h2>Portfolio-Übersicht</h2>' +
      '<div class="portfolio-summary-grid">' +
        '<div class="port-kpi"><div class="port-kpi-label">Anzahl Objekte</div><div class="port-kpi-val">' + t.count + '</div></div>' +
        '<div class="port-kpi"><div class="port-kpi-label">Gesamt-Investment</div><div class="port-kpi-val">' + fE(t.invest, 0) + '</div></div>' +
        '<div class="port-kpi"><div class="port-kpi-label">Mieteinnahmen / Mon.</div><div class="port-kpi-val">' + fE(t.miete_m, 0) + '</div></div>' +
        '<div class="port-kpi"><div class="port-kpi-label">Cashflow / Mon. (n.St.)</div><div class="port-kpi-val ' + (t.cf_m >= 0 ? 'green' : 'red') + '">' + (t.cf_m >= 0 ? '+' : '') + fE(t.cf_m, 0) + '</div></div>' +
        '<div class="port-kpi"><div class="port-kpi-label">Ø Bruttomietrendite</div><div class="port-kpi-val">' + cache.avgBmr.toFixed(2).replace('.', ',') + ' %</div></div>' +
        '<div class="port-kpi"><div class="port-kpi-label">Ø DSCR</div><div class="port-kpi-val">' + (cache.avgDscr > 0 ? cache.avgDscr.toFixed(2).replace('.', ',') : '—') + '</div></div>' +
        '<div class="port-kpi"><div class="port-kpi-label">Gesamt-Darlehen</div><div class="port-kpi-val">' + fE(t.rest_total, 0) + '</div></div>' +
        '<div class="port-kpi"><div class="port-kpi-label">Cashflow / Jahr</div><div class="port-kpi-val ' + (t.cf_m >= 0 ? 'green' : 'red') + '">' + (t.cf_m >= 0 ? '+' : '') + fE(t.cf_m * 12, 0) + '</div></div>' +
      '</div>' +
      '<table class="portfolio-objs-table">' +
        '<thead><tr><th>Objekt</th><th class="num">Kaufpreis</th><th class="num">Miete/Mon.</th><th class="num">CF n.St./Mon.</th><th class="num">BMR</th><th class="num">DSCR</th><th class="num">Darlehen</th></tr></thead>' +
        '<tbody>' +
          cache.objects.map(function(o) {
            return '<tr>' +
              '<td>' + o.name + '</td>' +
              '<td class="num">' + fE(o.kpis.kp, 0) + '</td>' +
              '<td class="num">' + fE(o.kpis.nkm_m, 0) + '</td>' +
              '<td class="num">' + (o.kpis.cf_ns_monthly >= 0 ? '+' : '') + fE(o.kpis.cf_ns_monthly, 0) + '</td>' +
              '<td class="num">' + o.kpis.bmy.toFixed(2).replace('.', ',') + '%</td>' +
              '<td class="num">' + (o.kpis.dscr > 0 ? o.kpis.dscr.toFixed(2).replace('.', ',') : '—') + '</td>' +
              '<td class="num">' + fE(o.kpis.d_total, 0) + '</td>' +
            '</tr>';
          }).join('') +
        '</tbody>' +
      '</table>' +
      '<div style="margin-top:16px;text-align:right">' +
        '<button class="btn btn-outline" onclick="exportPortfolioCSV()">📊 Portfolio-CSV exportieren</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
}

function exportPortfolioCSV() {
  if (!window._portfolioCache) return;
  var c = window._portfolioCache;
  var rows = [['Objekt','Kaufpreis','Miete_Monat','CF_nSt_Monat','BMR_pct','DSCR','Darlehen_total']];
  c.objects.forEach(function(o){
    rows.push([
      o.name,
      o.kpis.kp.toFixed(0),
      o.kpis.nkm_m.toFixed(0),
      o.kpis.cf_ns_monthly.toFixed(0),
      o.kpis.bmy.toFixed(2),
      o.kpis.dscr.toFixed(2),
      o.kpis.d_total.toFixed(0)
    ]);
  });
  rows.push([]);
  rows.push(['SUMME', c.totals.invest.toFixed(0), c.totals.miete_m.toFixed(0), c.totals.cf_m.toFixed(0), c.avgBmr.toFixed(2) + ' (Ø)', c.avgDscr.toFixed(2) + ' (Ø)', c.totals.rest_total.toFixed(0)]);
  var csv = rows.map(function(r){ return r.map(function(x){return '"'+(''+x).replace(/"/g,'""')+'"';}).join(';'); }).join('\n');
  var blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Junker_Portfolio_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast('✓ Portfolio-CSV exportiert');
}

// ═══════════════════════════════════════════════════
// GLOBAL BANKEXPORT VIEW (alle Objekte aggregiert)
// ═══════════════════════════════════════════════════
async function showBankexportView() {
  // V63.82: Plan-Gate — Bankexport ist Investor+ (Starter hat ihn nicht; Free nur mit Wasserzeichen)
  if (typeof Plan !== 'undefined') {
    var k = Plan.key();
    if (k === 'starter') {
      if (typeof toast === 'function') toast('🔒 Bankexport ist im Investor-Plan enthalten');
      if (typeof openPricingModal === 'function') setTimeout(openPricingModal, 600);
      return;
    }
  }
  var existing = document.getElementById('bankexport-modal');
  if (existing) existing.remove();

  var allObjects = await getAllObjectsData();
  if (!allObjects.length) {
    if (typeof toast === 'function') toast('Bitte zuerst mindestens ein Objekt speichern');
    return;
  }

  // V105: Standard wie Track Record — nur Won-Deals zeigen.
  // Wenn keine Won existieren, fallen wir auf "alle" zurück damit der User nicht ratlos vor leerer Liste sitzt.
  var wonObjects = allObjects.filter(function(o) {
    return o && o.data && o.data._deal_won === true;
  });
  var includeAll = !wonObjects.length;
  if (typeof window._bankexportIncludeAll !== 'undefined') {
    includeAll = window._bankexportIncludeAll;
  } else {
    window._bankexportIncludeAll = includeAll;
  }
  var objects = includeAll ? allObjects : wonObjects;

  // Build rows nach AuswertungBank-Excel-Struktur:
  // Pro Objekt 1-4 Zeilen (Annuitätendarlehen 1, 2, Tilgungsaussetzungsdarlehen, Bauspar)
  var allRows = _buildBankExportRows(objects);

  // V105: Pro-Zeile-Auswahl. window._bankexportExcluded ist Set von rowKeys (objectId|rowType)
  //       die der User EXPLIZIT abgewählt hat. Default = alle aktiv.
  if (!window._bankexportExcluded) window._bankexportExcluded = {};
  function _rowKey(r) { return (r.objectId || '') + '|' + (r.rowType || ''); }
  function _isExcluded(r) { return !!window._bankexportExcluded[_rowKey(r)]; }
  var rows = allRows.filter(function(r) { return !_isExcluded(r); });

  // Calculate totals over selected rows
  var t = { count: objects.length, kp: 0, marktw: 0, darl: 0, rest: 0, kapdienst: 0 };
  // Eindeutige Objekte zählen (mehrere Zeilen pro Objekt → trotzdem 1x KP)
  var seenObjects = {};
  rows.forEach(function(r) {
    if (!seenObjects[r.objectId]) {
      seenObjects[r.objectId] = true;
      var obj = objects.find(function(o) { return o.id === r.objectId; });
      if (obj) {
        var d = obj.data;
        t.kp += parseFloat(d.kp) || 0;
        t.marktw += parseFloat(d.bankval) || parseFloat(d.svwert) || (parseFloat(d.kp) || 0);
      }
    }
    t.darl += r.darl_summe || 0;
    t.kapdienst += r.kapitaldienst || 0;
    t.rest += r.akt_restschuld || 0;
  });
  t.count = Object.keys(seenObjects).length;

  // V105: Filter-Bar mit Won-Toggle + Erklärung
  var filterBar =
    '<div class="bank-filter-bar" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:8px 0 14px;padding:12px 14px;background:var(--surface,#F8F6F1);border:1px solid var(--line,#E5DFD0);border-radius:8px">' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">' +
        '<input type="checkbox" id="bank-include-all" ' + (includeAll ? 'checked' : '') + ' onchange="_bankexportToggleAll(this.checked)">' +
        '<span><strong>Alle Objekte zeigen</strong> (statt nur Zuschlag-bekommen-Deals)</span>' +
      '</label>' +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted,#7A7370)">' +
        wonObjects.length + ' Won · ' + allObjects.length + ' Total · <strong>' + objects.length + ' Objekte · ' + rows.length + ' Zeilen</strong>' +
      '</span>' +
    '</div>';

  var modal = document.createElement('div');
  modal.id = 'bankexport-modal';
  modal.className = 'global-view-overlay';
  modal.innerHTML =
    '<div class="global-view-modal" style="max-width:1500px">' +
      '<button class="pricing-close" onclick="document.getElementById(\'bankexport-modal\').remove()">×</button>' +
      '<h2>🏦 Bankexport · alle Objekte (Format: AuswertungBank)</h2>' +
      filterBar +
      '<div class="bank-summary-grid">' +
        '<div class="bank-sum-card"><div class="bank-sum-label">Anzahl Objekte</div><div class="bank-sum-val">' + t.count + '</div></div>' +
        '<div class="bank-sum-card"><div class="bank-sum-label">Anzahl Darlehen</div><div class="bank-sum-val">' + rows.length + '</div></div>' +
        '<div class="bank-sum-card"><div class="bank-sum-label">Summe Kaufpreis</div><div class="bank-sum-val">' + fE(t.kp, 0) + '</div></div>' +
        '<div class="bank-sum-card"><div class="bank-sum-label">Summe Restschuld</div><div class="bank-sum-val">' + fE(t.rest, 0) + '</div></div>' +
      '</div>' +
      '<div class="global-view-actions">' +
        '<button class="btn btn-outline" onclick="exportGlobalBankCSV()">📊 CSV exportieren</button>' +
        '<button class="btn btn-outline" onclick="exportGlobalBankXLSX()">📗 Excel exportieren</button>' +
        '<button class="btn btn-outline" onclick="exportGlobalBankPDF()">📄 PDF erstellen</button>' +
      '</div>' +
      '<p class="hint" style="font-size:11.5px;margin:6px 0 4px;color:var(--muted)">Tipp: Häkchen in der ersten Spalte um einzelne Darlehen aus dem Export zu nehmen.</p>' +
      '<div style="overflow-x:auto;font-size:10.5px">' +
        '<table class="bank-table bank-table-full">' +
          '<thead><tr>' +
            '<th style="width:32px"></th>' +    // V105: Checkbox-Spalte
            '<th>Datum</th>' +
            '<th>Nr</th>' +
            '<th>PLZ</th>' +
            '<th>Ort</th>' +
            '<th>Straße</th>' +
            '<th>Hn.</th>' +
            '<th>Bezeichn.</th>' +
            '<th class="num">Größe [qm]</th>' +
            '<th class="num">Nettokaltmiete</th>' +
            '<th class="num">€/qm</th>' +
            '<th class="num">Nebenkosten</th>' +
            '<th>Bank</th>' +
            '<th>Art</th>' +
            '<th>Finanzierungsdatum</th>' +
            '<th class="num">Monate</th>' +
            '<th>Vertragsnr.</th>' +
            '<th class="num">Darlehenssumme</th>' +
            '<th class="num">Zins</th>' +
            '<th class="num">Tilgung</th>' +
            '<th class="num">Kapitaldienst</th>' +
            '<th class="num">Zinsbindung</th>' +
            '<th class="num">Akt. Restschuld</th>' +
            '<th>Laufzeit / Zuteilung</th>' +
            '<th class="num">Restschuld Ende</th>' +
            '<th>Jahr Volltilgung</th>' +
          '</tr></thead>' +
          '<tbody>' +
            allRows.map(function(r) {
              var excluded = _isExcluded(r);
              var rowKey = _rowKey(r);
              return '<tr' + (excluded ? ' style="opacity:0.4;text-decoration:line-through"' : '') + '>' +
                '<td class="center"><input type="checkbox" ' + (excluded ? '' : 'checked') + ' onchange="_bankexportToggleRow(\'' + rowKey + '\', this.checked)" title="Diese Zeile in den Export aufnehmen"></td>' +
                '<td>' + r.datum + '</td>' +
                '<td class="center">' + r.nr + '</td>' +
                '<td>' + r.plz + '</td>' +
                '<td>' + r.ort + '</td>' +
                '<td>' + r.strasse + '</td>' +
                '<td class="center">' + r.hnr + '</td>' +
                '<td>' + r.bez + '</td>' +
                '<td class="num">' + r.qm + '</td>' +
                '<td class="num">' + (r.nkm ? r.nkm.toFixed(2).replace('.', ',') + ' €' : '–') + '</td>' +
                '<td class="num">' + (r.eur_qm ? r.eur_qm.toFixed(2).replace('.', ',') + ' €' : '–') + '</td>' +
                '<td class="num">' + (r.nebenkosten ? r.nebenkosten.toFixed(2).replace('.', ',') + ' €' : '–') + '</td>' +
                '<td>' + r.bank + '</td>' +
                '<td>' + r.art + '</td>' +
                '<td>' + r.fin_datum + '</td>' +
                '<td class="num">' + (r.monate || '–') + '</td>' +
                '<td>' + r.vertragsnr + '</td>' +
                '<td class="num">' + (r.darl_summe ? fE(r.darl_summe, 0) : '–') + '</td>' +
                '<td class="num">' + (r.zins ? (r.zins * 100).toFixed(2).replace('.', ',') + ' %' : '–') + '</td>' +
                '<td class="num">' + (r.tilgung ? (r.tilgung * 100).toFixed(2).replace('.', ',') + ' %' : '–') + '</td>' +
                '<td class="num">' + (r.kapitaldienst ? fE(r.kapitaldienst, 0) : '–') + '</td>' +
                '<td class="num">' + (r.zinsbindung || '–') + ' J' + '</td>' +
                '<td class="num">' + (r.akt_restschuld ? fE(r.akt_restschuld, 0) : '–') + '</td>' +
                '<td>' + r.laufzeit + '</td>' +
                '<td class="num">' + (r.restschuld_ende ? fE(r.restschuld_ende, 0) : '–') + '</td>' +
                '<td>' + r.volltilgung + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>' +

    '</div>';
  document.body.appendChild(modal);
  // V105: Nur die nicht-excludeten Zeilen zur Export-Funktion durchreichen
  window._bankexportData = { objects: objects, rows: rows, totals: t };
}

// V105: Toggle-Helpers für Bankexport-Filter
window._bankexportToggleAll = function(checked) {
  window._bankexportIncludeAll = !!checked;
  // Excluded-Map zurücksetzen damit nicht alte Selektionen aus anderem Filter-Modus übrig bleiben
  window._bankexportExcluded = {};
  showBankexportView();
};
window._bankexportToggleRow = function(rowKey, checked) {
  if (!window._bankexportExcluded) window._bankexportExcluded = {};
  if (checked) {
    delete window._bankexportExcluded[rowKey];
  } else {
    window._bankexportExcluded[rowKey] = true;
  }
  showBankexportView();
};

function exportGlobalBankCSV() {
  if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;

  if (!window._bankexportData) return;
  var data = window._bankexportData;
  var rows = [['Objekt', 'Kaufdatum', 'Kaufpreis_EUR', 'Marktwert_EUR', 'Bank', 'Vertrag', 'Darlehen_EUR', 'Zins_pct', 'Restschuld_EUR', 'Bindung_Jahre', 'CF_nSt_p.a._EUR', 'LTV_pct']];
  data.objects.forEach(function(o) {
    var d = o.data;
    var kp = parseFloat(d.kp) || 0;
    var marktw = parseFloat(d.bankval) || parseFloat(d.svwert) || kp;
    var darl = parseFloat(d.d1) || 0;
    var ltv = marktw > 0 ? (darl / marktw * 100) : 0;
    rows.push([
      o.name || 'Objekt',
      d.kaufdat || '',
      kp.toFixed(0),
      marktw.toFixed(0),
      d.bank_inst || '',
      d.d1_vertrag || '',
      darl.toFixed(0),
      (parseFloat(d.d1z) || 0).toFixed(2),
      darl.toFixed(0),
      d.d1_bindj || '',
      (o.kpis.cf_ns_yearly || 0).toFixed(0),
      ltv.toFixed(2)
    ]);
  });
  var csv = rows.map(function(r) { return r.map(function(x) { return '"' + (''+x).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Junker_Bankexport_alle_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  toast('✓ CSV exportiert');
}

async function exportGlobalBankPDF() {
  if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;

  if (typeof window.jspdf === 'undefined') { toast('PDF-Bibliothek lädt noch...'); return; }
  if (!window._bankexportData) return;
  var data = window._bankexportData;
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(42, 39, 39);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(201, 168, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('JUNKER IMMOBILIEN · Bankexport · Portfolio-Übersicht', 12, 14);
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text('Erstellt: ' + new Date().toLocaleDateString('de-DE'), 250, 14);

  // Summary boxes
  var t = data.totals;
  var sy = 28;
  var sumBoxes = [
    ['Anzahl Objekte', '' + t.count],
    ['Summe Kaufpreis', t.kp.toLocaleString('de-DE') + ' €'],
    ['Summe Marktwert', t.marktw.toLocaleString('de-DE') + ' €'],
    ['Summe Restschuld', t.rest.toLocaleString('de-DE') + ' €']
  ];
  sumBoxes.forEach(function(b, i) {
    var x = 12 + i * 70;
    doc.setFillColor(245, 241, 230);
    doc.roundedRect(x, sy, 65, 16, 2, 2, 'F');
    doc.setDrawColor(201, 168, 76);
    doc.setLineWidth(0.4);
    doc.line(x, sy, x, sy + 16);
    doc.setTextColor(122, 115, 112);
    doc.setFontSize(7);
    doc.text(b[0].toUpperCase(), x + 3, sy + 5);
    doc.setTextColor(42, 39, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(b[1], x + 3, sy + 13);
    doc.setFont('helvetica', 'normal');
  });

  // Table
  var rows = data.objects.map(function(o) {
    var d = o.data;
    var kp = parseFloat(d.kp) || 0;
    var marktw = parseFloat(d.bankval) || parseFloat(d.svwert) || kp;
    var darl = parseFloat(d.d1) || 0;
    var ltv = marktw > 0 ? (darl / marktw * 100) : 0;
    return [
      o.name || 'Objekt',
      d.kaufdat ? new Date(d.kaufdat).toLocaleDateString('de-DE') : '–',
      kp.toLocaleString('de-DE'),
      marktw.toLocaleString('de-DE'),
      d.bank_inst || '–',
      d.d1_vertrag || '–',
      darl.toLocaleString('de-DE'),
      (parseFloat(d.d1z) || 0).toFixed(2),
      (d.d1_bindj || '–') + ' J',
      (o.kpis.cf_ns_yearly >= 0 ? '+' : '') + Math.round(o.kpis.cf_ns_yearly).toLocaleString('de-DE'),
      ltv.toFixed(1)
    ];
  });

  doc.autoTable({
    startY: 50,
    head: [['Objekt / Adresse', 'Kaufdatum', 'Kaufpreis €', 'Marktwert €', 'Bank', 'Vertrag', 'Darlehen €', 'Zins %', 'Bindung', 'CF n.St. €/J', 'LTV %']],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: [42, 39, 39], textColor: [201, 168, 76], fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8, cellPadding: 1.8 },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    columnStyles: {
      2: { halign: 'right' }, 3: { halign: 'right' }, 6: { halign: 'right' },
      7: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' }
    },
    margin: { left: 12, right: 12 }
  });

  // Footer
  var pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text((typeof _getUserContact === 'function' ? _formatContact(_getUserContact()) : 'Junker Immobilien · Hermannstr. 9 · 32609 Hüllhorst · www.junker-immobilien.io'), 12, pageHeight - 6);

  doc.save('Junker_Bankexport_Portfolio_' + new Date().toISOString().slice(0, 10) + '.pdf');
  toast('✓ PDF erstellt');
}

// ═══════════════════════════════════════════════════
// TRACK RECORD VIEW
// ═══════════════════════════════════════════════════
async function showTrackRecordView() {
  var existing = document.getElementById('trackrecord-modal');
  if (existing) existing.remove();

  var allObjects = await getAllObjectsData();
  if (!allObjects.length) {
    if (typeof toast === 'function') toast('Bitte zuerst mindestens ein Objekt speichern');
    return;
  }

  // V104: Standardmäßig nur Won-Deals (= Zuschlag bekommen). Wenn keine Won-Deals
  // existieren, fallen wir auf "alle anzeigen" zurück damit der User nicht eine leere
  // Liste sieht. Außerdem speichert window._trackRecordIncludeAll den Toggle-State.
  var wonObjects = allObjects.filter(function(o) {
    return o && o.data && o.data._deal_won === true;
  });
  var includeAll = !wonObjects.length;  // Fallback wenn keine Won → alle zeigen
  if (typeof window._trackRecordIncludeAll !== 'undefined') {
    includeAll = window._trackRecordIncludeAll;
  } else {
    window._trackRecordIncludeAll = includeAll;
  }
  var objects = includeAll ? allObjects : wonObjects;

  // Portfolio-Aggregation (auf gefilterter Liste)
  var portfolio = { count: objects.length, kpSum: 0, miete: 0, cf: 0, scoreSum: 0, scoreCount: 0 };
  objects.forEach(function(o) {
    var d = o.data || {};
    portfolio.kpSum += parseFloat((d.kp || '0').replace(',', '.')) || 0;
    portfolio.miete += parseFloat((d.nkm || '0').replace(',', '.')) || 0;
  });

  // V104: Filter-Bar mit Toggle (Won-only / Alle) und Hinweis
  var filterBar =
    '<div class="trackrec-filter-bar" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:8px 0 14px;padding:12px 14px;background:var(--surface,#F8F6F1);border:1px solid var(--line,#E5DFD0);border-radius:8px">' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">' +
        '<input type="checkbox" id="trackrec-include-all" ' + (includeAll ? 'checked' : '') + ' onchange="_trackRecordToggleAll(this.checked)">' +
        '<span><strong>Alle Objekte zeigen</strong> (statt nur Zuschlag-bekommen-Deals)</span>' +
      '</label>' +
      '<span style="margin-left:auto;font-size:12px;color:var(--muted,#7A7370)">' +
        wonObjects.length + ' Won · ' + allObjects.length + ' Total · <strong>' + objects.length + ' angezeigt</strong>' +
      '</span>' +
    '</div>';

  var modal = document.createElement('div');
  modal.id = 'trackrecord-modal';
  modal.className = 'global-view-overlay';
  modal.innerHTML =
    '<div class="global-view-modal">' +
      '<button class="pricing-close" onclick="document.getElementById(\'trackrecord-modal\').remove()">×</button>' +
      '<h2>🏆 Track Record</h2>' +
      filterBar +
      '<div class="trackrec-summary">' +
        '<div class="trackrec-sum-tile"><div class="trackrec-sum-l">Objekte</div><div class="trackrec-sum-v">' + objects.length + '</div></div>' +
        '<div class="trackrec-sum-tile"><div class="trackrec-sum-l">Gesamt-Investment</div><div class="trackrec-sum-v">' + fE(portfolio.kpSum, 0) + '</div></div>' +
        '<div class="trackrec-sum-tile"><div class="trackrec-sum-l">Mieteinnahmen / Mon</div><div class="trackrec-sum-v">' + fE(portfolio.miete, 0) + '</div></div>' +
      '</div>' +
      '<p class="hint" style="margin:14px 0 8px">Klick auf eine Karte: Einzel-PDF — oder unten Sammel-PDF.</p>' +
      '<div class="global-view-actions" style="margin-bottom:14px">' +
        '<button class="btn btn-gold" onclick="exportTrackRecordAll()">📄 Sammel-PDF (alle angezeigten Objekte)</button>' +
      '</div>' +
      '<div class="trackrec-cards-grid">' +
        (objects.length === 0
          ? '<div style="padding:40px;text-align:center;color:var(--muted)">Keine Objekte mit Zuschlag-Status. Markiere im Tab <strong>Deal-Aktion</strong> die Objekte für die du den Zuschlag bekommen hast — oder hake oben "Alle Objekte zeigen" an.</div>'
          : objects.map(function(o, i) { return _renderTrackRecordCard(o, i); }).join('')
        ) +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  window._trackRecordData = objects;
}

// V104: Toggle für "Alle vs nur Won" — re-rendert die Track-Record-View
window._trackRecordToggleAll = function(checked) {
  window._trackRecordIncludeAll = !!checked;
  showTrackRecordView();
};

/**
 * V40: Eine Track-Record-Karte rendert mit Thumbnail, Adresse, KPIs und Mini-Score.
 */
function _renderTrackRecordCard(o, idx) {
  var d = o.data || {};
  var name = o.name || 'Objekt';
  var addr = [(d.str || '') + ' ' + (d.hnr || ''), d.plz, d.ort].map(function(x){return (x||'').trim();}).filter(Boolean).join(', ');
  var kp = parseFloat((d.kp || '0').replace(',', '.')) || 0;
  var nkm = parseFloat((d.nkm || '0').replace(',', '.')) || 0;
  var bmr = (kp > 0 && nkm > 0) ? (nkm * 12 / kp * 100) : 0;
  var thumbSrc = (d._photos && d._photos[0]) ? d._photos[0] : null;
  var photoCount = (d._photos && d._photos.length) || 0;

  // Mini-DealScore-2.0 berechnen
  var score = null;
  if (window.DealScore2 && typeof window._buildDeal2FromStateForObject === 'function') {
    try {
      var deal = window._buildDeal2FromStateForObject(d);
      var result = window.DealScore2.compute(deal);
      score = Math.round(result.score || 0);
    } catch(e) {}
  }
  // Fallback wenn Helper nicht da: einfache Heuristik aus Objekt-Daten
  if (score === null && bmr > 0) {
    score = bmr >= 6 ? 75 : bmr >= 4 ? 55 : 35;
  }

  var scoreCls = score == null ? '' :
    score >= 85 ? 'tr-score-green-strong' :
    score >= 70 ? 'tr-score-green' :
    score >= 50 ? 'tr-score-gold' : 'tr-score-red';

  var thumbHtml = thumbSrc
    ? '<div class="trackrec-card-img" style="background-image:url(\'' + _escAttrTr(thumbSrc) + '\')"></div>'
    : '<div class="trackrec-card-img trackrec-card-img-empty"><span>📷</span><small>Kein Foto</small></div>';

  return '<div class="trackrec-card-v40" onclick="exportTrackRecordOne(' + idx + ')" role="button" tabindex="0">' +
    thumbHtml +
    '<div class="trackrec-card-body">' +
      '<div class="trackrec-card-head">' +
        '<div class="trackrec-card-name">' + _escHtmlTr(name) + '</div>' +
        (score != null ? '<div class="trackrec-card-score ' + scoreCls + '" title="DealScore 2.0: ' + score + '/100">' +
          '<svg viewBox="0 0 36 36" width="36" height="36"><circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3" stroke-opacity="0.18"/>' +
          '<circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="' + (score / 100 * 94.2).toFixed(1) + ' 94.2" stroke-linecap="round" transform="rotate(-90 18 18)"/></svg>' +
          '<span class="trackrec-card-score-num">' + score + '</span>' +
        '</div>' : '') +
      '</div>' +
      '<div class="trackrec-card-addr">' + _escHtmlTr(addr || '–') + '</div>' +
      '<div class="trackrec-card-kpis">' +
        '<div class="trackrec-card-kpi"><div class="trackrec-card-kpi-l">Kaufpreis</div><div class="trackrec-card-kpi-v">' + fE(kp, 0) + '</div></div>' +
        '<div class="trackrec-card-kpi"><div class="trackrec-card-kpi-l">Bruttorendite</div><div class="trackrec-card-kpi-v">' + (bmr > 0 ? bmr.toFixed(2).replace('.', ',') + ' %' : '—') + '</div></div>' +
        '<div class="trackrec-card-kpi"><div class="trackrec-card-kpi-l">Fotos</div><div class="trackrec-card-kpi-v">' + photoCount + '</div></div>' +
      '</div>' +
      '<button class="btn btn-outline btn-sm trackrec-card-pdf" onclick="event.stopPropagation();exportTrackRecordOne(' + idx + ')">📄 Einzel-PDF</button>' +
    '</div>' +
  '</div>';
}

/**
 * V40: Helper, baut DealScore2-Deal-Objekt aus einem gespeicherten Objekt-Datensatz.
 * Wird von Track Record und Sidebar-Karten verwendet.
 */
window._buildDeal2FromStateForObject = function(d) {
  function n(k) { return parseFloat((d[k] || '0').toString().replace(',', '.')) || 0; }
  function s(k) { return (d[k] || '').toString(); }

  var kp = n('kp');
  var nkm = n('nkm');
  var nkmJahr = nkm * 12;
  var marktfaktor = (kp > 0 && nkmJahr > 0) ? (kp / nkmJahr) : null;

  var mlMap = {
    'sehr_gut': 'sehr_gut', 'gut': 'gut',
    'durchschnittlich': 'mittel', 'schwach': 'einfach', 'sehr_schwach': 'problematisch'
  };

  return {
    kaufpreis: kp,
    nettokaltmiete: nkm,
    wohnflaeche: n('wfl'),
    gesamtinvestition: kp * 1.105,    // Schätzung mit 10.5% NK
    eigenkapital: n('ek'),
    zinssatz: n('d1z'),
    tilgung: n('d1t'),
    bewirtschaftungskosten: n('verwaltung'),
    instandhaltung: n('inst'),
    zustand: s('ds2_zustand') || null,
    energieklasse: s('ds2_energie') || null,
    makrolage: mlMap[s('makrolage')] || null,
    mikrolage: mlMap[s('mikrolage')] || null,
    bevoelkerung: s('ds2_bevoelkerung') || null,
    nachfrage: s('ds2_nachfrage') || null,
    marktmiete: n('ds2_marktmiete') || null,
    mietausfall: s('ds2_mietausfall') || null,
    marktfaktor: marktfaktor,
    wertsteigerung: s('ds2_wertsteigerung') || null,
    entwicklung: s('ds2_entwicklung') || null
  };
};

function _escHtmlTr(s) { return ('' + (s == null ? '' : s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _escAttrTr(s) { return _escHtmlTr(s).replace(/"/g, '&quot;'); }

async function exportTrackRecordOne(idx) {
  if (!window._trackRecordData) return;
  var obj = window._trackRecordData[idx];
  if (!obj) return;
  if (typeof exportTrackRecordPDF === 'function') {
    await exportTrackRecordPDF([obj]);
  } else {
    toast('Track-Record-PDF-Generator wird geladen...');
  }
}

async function exportTrackRecordAll() {
  if (!window._trackRecordData) return;
  if (typeof exportTrackRecordPDF === 'function') {
    await exportTrackRecordPDF(window._trackRecordData);
  } else {
    toast('Track-Record-PDF-Generator wird geladen...');
  }
}

// ═══════════════════════════════════════════════════
// AUSWERTUNGBANK: Build rows for the full Excel-style export
// 25 columns matching AuswertungBank-worksheet
// ═══════════════════════════════════════════════════
function _buildBankExportRows(objects) {
  var datum = new Date().toLocaleDateString('de-DE');
  var rows = [];
  var rowNr = 0;

  objects.forEach(function(o) {
    var d = o.data || {};
    var commonFields = {
      datum: datum,
      plz: d.plz || '–',
      ort: d.ort || '–',
      strasse: d.str || '–',
      hnr: d.hnr || '–',
      bez: d.objart || 'ETW',
      qm: parseFloat(d.wfl) || 0,
      nkm: (parseFloat(d.nkm) || 0),
      eur_qm: d.wfl > 0 ? (parseFloat(d.nkm) || 0) / parseFloat(d.wfl) : 0,
      nebenkosten: parseFloat(d.nk) || 0,
      fin_datum: d.kaufdat ? new Date(d.kaufdat).toLocaleDateString('de-DE') : '–',
      monate: d.kaufdat ? _monthsBetween(new Date(d.kaufdat), new Date()) : 0
    };

    // Row 1: Annuitätendarlehen 1 (Hauptdarlehen)
    var d1 = parseFloat(d.d1) || 0;
    if (d1 > 0) {
      rowNr++;
      var d1z = parseFloat(d.d1z) || 0;
      var d1t = parseFloat(d.d1t) || 0;
      var bindj = parseInt(d.d1_bindj) || 10;
      var rate_m = (d1 * (d1z + d1t) / 100) / 12;
      var rate_y = rate_m * 12;
      // Rough Restschuld estimate (proper calc via tilgungsplan)
      var restAfterBind = _estimateRestschuld(d1, d1z / 100, d1t / 100, bindj);
      var bindEnd = d.kaufdat ? new Date(d.kaufdat) : new Date();
      bindEnd.setFullYear(bindEnd.getFullYear() + bindj);
      var volltilg = _estimateVolltilgung(d1, d1z / 100, d1t / 100, d.kaufdat ? new Date(d.kaufdat) : new Date());

      rows.push(Object.assign({}, commonFields, {
        nr: rowNr,
        rowType: 'annuitaet1',  // V105: für Filter-UI
        objectId: o.id,
        bank: d.bank_inst || '–',
        art: 'Annuitätendarlehen 1',
        vertragsnr: d.d1_vertrag || '–',
        darl_summe: d1,
        zins: d1z / 100,
        tilgung: d1t / 100,
        kapitaldienst: rate_m,
        zinsbindung: bindj,
        akt_restschuld: d1,  // wenn Kauf gerade war = volle Summe
        laufzeit: bindEnd.toLocaleDateString('de-DE'),
        restschuld_ende: restAfterBind,
        volltilgung: volltilg
      }));
    }

    // Row 2: Annuitätendarlehen 2 (Zusatzdarlehen, falls aktiv und Annuität)
    if (d._d2_enabled && d.d2_type === 'annuitaet' && parseFloat(d.d2) > 0) {
      rowNr++;
      var d2 = parseFloat(d.d2);
      var d2z = parseFloat(d.d2z) || 0;
      var d2t = parseFloat(d.d2t) || 0;
      var d2bindj = parseInt(d.d2_bindj) || 10;
      var d2_rate_m = (d2 * (d2z + d2t) / 100) / 12;
      var d2_restEnd = _estimateRestschuld(d2, d2z / 100, d2t / 100, d2bindj);
      var d2bindEnd = d.kaufdat ? new Date(d.kaufdat) : new Date();
      d2bindEnd.setFullYear(d2bindEnd.getFullYear() + d2bindj);
      var d2_volltilg = _estimateVolltilgung(d2, d2z / 100, d2t / 100, d.kaufdat ? new Date(d.kaufdat) : new Date());

      rows.push(Object.assign({}, commonFields, {
        nr: rowNr,
        rowType: 'annuitaet2',  // V105: für Filter-UI
        objectId: o.id,
        bank: d.d2_inst || '–',
        art: 'Annuitätendarlehen 2',
        vertragsnr: d.d2_vertrag || '–',
        darl_summe: d2,
        zins: d2z / 100,
        tilgung: d2t / 100,
        kapitaldienst: d2_rate_m,
        zinsbindung: d2bindj,
        akt_restschuld: d2,
        laufzeit: d2bindEnd.toLocaleDateString('de-DE'),
        restschuld_ende: d2_restEnd,
        volltilgung: d2_volltilg
      }));
    }

    // Row 3: Tilgungsaussetzungsdarlehen
    if (d._d2_enabled && d.d2_type === 'tilgungsaussetzung' && parseFloat(d.d2) > 0) {
      rowNr++;
      var ds = parseFloat(d.d2);
      var dsz = parseFloat(d.d2z) || 0;
      var dsbindj = parseInt(d.d2_bindj) || 10;
      var ds_rate_m = (ds * dsz / 100) / 12;  // nur Zinsen
      var dsbindEnd = d.kaufdat ? new Date(d.kaufdat) : new Date();
      dsbindEnd.setFullYear(dsbindEnd.getFullYear() + dsbindj);

      rows.push(Object.assign({}, commonFields, {
        nr: rowNr,
        rowType: 'tilgungsaussetzung',  // V105: für Filter-UI
        objectId: o.id,
        bank: d.d2_inst || '–',
        art: 'Tilgungsaussetzungsdarlehen',
        vertragsnr: d.d2_vertrag || '–',
        darl_summe: ds,
        zins: dsz / 100,
        tilgung: 0,
        kapitaldienst: ds_rate_m,
        zinsbindung: dsbindj,
        akt_restschuld: ds,
        laufzeit: dsbindEnd.toLocaleDateString('de-DE'),
        restschuld_ende: ds,  // bleibt voll bis Tilgungsaussetzung endet
        volltilgung: '–'
      }));
    }

    // V105: Row 4 — Bausparvertrag IMMER als eigene Zeile wenn Bauspar-Card aktiv ist
    //       (= bspar_sum vorhanden ODER d.d2_bspar als Vertragsnummer da)
    //       Mit ECHTEN Bausparvertrag-Daten aus den bspar_* Feldern
    var bsparSum = parseFloat(d.bspar_sum) || 0;
    var bsparRate = parseFloat(d.bspar_rate) || 0;
    var bsparDarZ = parseFloat(d.bspar_dar_z) || 2.5;
    var bsparDarT = parseFloat(d.bspar_dar_t) || 6;
    var bsparActive = bsparSum > 0 || d.d2_bspar || d.bspar_vertrag;
    var bsparAussetzung = (d._d2_enabled && d.d2_type === 'tilgungsaussetzung');

    if (bsparActive) {
      rowNr++;
      // Bauspardarlehensrate (nach Zuteilung) berechnen — Annahme: Bauspardarlehen = Bausparsumme - Guthaben
      // Für Banksicht: monatliche Belastung = aktuelle Sparrate (vor Zuteilung)
      var bsparKapdienst = bsparRate;  // aktuelle Belastung = Sparrate
      var bsparName = d.bspar_inst || (bsparAussetzung ? d.d2_inst : '–') || '–';
      var bsparVertragNr = d.bspar_vertrag || d.d2_bspar || '–';

      rows.push(Object.assign({}, commonFields, {
        nr: rowNr,
        rowType: 'bauspar',                  // V105: für Filter-UI
        objectId: o.id,
        bank: bsparName,
        art: bsparAussetzung
          ? 'Bausparvertrag (Tilgungsaussetzung)'
          : 'Bausparvertrag',
        vertragsnr: bsparVertragNr,
        darl_summe: bsparSum,                 // Bausparsumme als Darlehenssumme
        zins: bsparDarZ / 100,                // Zinssatz Bauspardarlehen
        tilgung: bsparDarT / 100,             // Tilgung Bauspardarlehen
        kapitaldienst: bsparKapdienst,        // monatliche Sparrate als aktueller Kapitaldienst
        zinsbindung: 0,                       // Bausparen hat keine Zinsbindung im klassischen Sinn
        akt_restschuld: bsparSum,             // bei aktiven BSV = Bausparsumme als Ziel
        laufzeit: '–',
        restschuld_ende: 0,                   // bei voller Tilgung Bauspardarlehen = 0
        volltilgung: '–'
      }));
    }
  });

  return rows;
}

function _monthsBetween(from, to) {
  var y = to.getFullYear() - from.getFullYear();
  var m = to.getMonth() - from.getMonth();
  return Math.max(0, y * 12 + m);
}

function _estimateRestschuld(darl, zins, tilg, jahre) {
  // Annuitätendarlehen: standard Formel
  if (zins === 0) return Math.max(0, darl - darl * tilg * jahre);
  var ann = darl * (zins + tilg);
  var q = 1 + zins;
  return darl * Math.pow(q, jahre) - ann * (Math.pow(q, jahre) - 1) / zins;
}

function _estimateVolltilgung(darl, zins, tilg, startDate) {
  if (tilg <= 0) return '–';
  var rest = darl;
  var ann = darl * (zins + tilg);
  var year = startDate.getFullYear();
  var maxYears = 80;
  for (var y = 1; y <= maxYears; y++) {
    rest = rest * (1 + zins) - ann;
    year++;
    if (rest <= 0) {
      var d = new Date(startDate);
      d.setFullYear(year);
      return d.toLocaleDateString('de-DE');
    }
  }
  return 'nach ' + maxYears + ' J';
}

// ═══════════════════════════════════════════════════
// CSV-Export aller 25 Spalten
// ═══════════════════════════════════════════════════
function exportGlobalBankCSV() {
  if (!window._bankexportData) return;
  var rows = window._bankexportData.rows;
  var header = ['Datum','Nr','PLZ','Ort','Straße','Hn.','Bezeichnung','Größe_qm','Nettokaltmiete_€',
    '€_pro_qm','Nebenkosten_€','Bank','Art','Finanzierungsdatum','Monate','Vertragsnummer',
    'Darlehenssumme','Zins','Tilgung','Kapitaldienst_Monat','Zinsbindung_Jahre','Aktuelle_Restschuld',
    'Laufzeit_Zuteilung','Restschuld_Ende','Jahr_Volltilgung'];
  var lines = [header];
  rows.forEach(function(r) {
    lines.push([
      r.datum, r.nr, r.plz, r.ort, r.strasse, r.hnr, r.bez,
      r.qm.toFixed(2), r.nkm.toFixed(2), r.eur_qm.toFixed(2), r.nebenkosten.toFixed(2),
      r.bank, r.art, r.fin_datum, r.monate, r.vertragsnr,
      (r.darl_summe || 0).toFixed(0),
      (r.zins || 0).toFixed(4),
      (r.tilgung || 0).toFixed(4),
      (r.kapitaldienst || 0).toFixed(2),
      r.zinsbindung, (r.akt_restschuld || 0).toFixed(2),
      r.laufzeit, (r.restschuld_ende || 0).toFixed(2), r.volltilgung
    ]);
  });
  var csv = lines.map(function(r) {
    return r.map(function(x) { return '"' + (x == null ? '' : ('' + x)).replace(/"/g, '""') + '"'; }).join(';');
  }).join('\n');
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Junker_AuswertungBank_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  toast('✓ CSV exportiert');
}

// ═══════════════════════════════════════════════════
// Excel-Export (XLSX)
// ═══════════════════════════════════════════════════
function exportGlobalBankXLSX() {
  if (typeof Paywall !== 'undefined' && !Paywall.gate('exports')) return;

  if (typeof XLSX === 'undefined') {
    toast('⚠ Excel-Bibliothek (SheetJS) nicht geladen');
    return;
  }
  if (!window._bankexportData) return;
  var rows = window._bankexportData.rows;
  var header = ['Datum','Nr','PLZ','Ort','Straße','Hn.','Bezeichnung','Größe [qm]','Nettokaltmiete',
    '€/qm','Nebenkosten','Bank','Art','Finanzierungsdatum','Monate','Vertragsnummer',
    'Darlehenssumme','Zins','Tilgung','Kapitaldienst','Zinsbindung','Akt. Restschuld',
    'Laufzeit/Zuteilung','Restschuld Ende','Jahr Volltilgung'];
  var aoa = [header];
  rows.forEach(function(r) {
    aoa.push([
      r.datum, r.nr, r.plz, r.ort, r.strasse, r.hnr, r.bez,
      r.qm, r.nkm, r.eur_qm, r.nebenkosten,
      r.bank, r.art, r.fin_datum, r.monate, r.vertragsnr,
      r.darl_summe, r.zins, r.tilgung, r.kapitaldienst,
      r.zinsbindung, r.akt_restschuld,
      r.laufzeit, r.restschuld_ende, r.volltilgung
    ]);
  });
  var ws = XLSX.utils.aoa_to_sheet(aoa);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'AuswertungBank');
  XLSX.writeFile(wb, 'Junker_AuswertungBank_' + new Date().toISOString().slice(0, 10) + '.xlsx');
  toast('✓ Excel exportiert');
}

// ═══════════════════════════════════════════════════
// PDF-Export im Querformat (alle 25 Spalten)
// ═══════════════════════════════════════════════════
async function exportGlobalBankPDF() {
  if (typeof window.jspdf === 'undefined') { toast('PDF-Bibliothek lädt noch...'); return; }
  if (!window._bankexportData) return;
  var data = window._bankexportData;
  var jsPDF = window.jspdf.jsPDF;
  // A3 querformat, damit alle 25 Spalten passen
  var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  // Header
  doc.setFillColor(42, 39, 39);
  doc.rect(0, 0, 420, 22, 'F');
  doc.setTextColor(201, 168, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('JUNKER IMMOBILIEN · AuswertungBank · alle Objekte', 12, 14);
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text('Erstellt: ' + new Date().toLocaleDateString('de-DE'), 360, 14);

  // Summary
  var t = data.totals;
  var sy = 28;
  var sumBoxes = [
    ['Anzahl Objekte', '' + t.count],
    ['Anzahl Darlehen', '' + data.rows.length],
    ['Summe Kaufpreis', t.kp.toLocaleString('de-DE') + ' €'],
    ['Summe Restschuld', t.rest.toLocaleString('de-DE') + ' €']
  ];
  sumBoxes.forEach(function(b, i) {
    var x = 12 + i * 95;
    doc.setFillColor(245, 241, 230);
    doc.roundedRect(x, sy, 90, 14, 2, 2, 'F');
    doc.setDrawColor(201, 168, 76);
    doc.setLineWidth(0.4);
    doc.line(x, sy, x, sy + 14);
    doc.setTextColor(122, 115, 112);
    doc.setFontSize(7);
    doc.text(b[0].toUpperCase(), x + 3, sy + 5);
    doc.setTextColor(42, 39, 39);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(b[1], x + 3, sy + 11);
    doc.setFont('helvetica', 'normal');
  });

  // Build rows
  var pdfRows = data.rows.map(function(r) {
    return [
      r.datum, r.nr, r.plz, r.ort, r.strasse, r.hnr, r.bez,
      r.qm.toFixed(2),
      r.nkm.toFixed(2),
      r.eur_qm.toFixed(2),
      r.nebenkosten.toFixed(2),
      r.bank, r.art, r.fin_datum, r.monate || '', r.vertragsnr,
      (r.darl_summe || 0).toLocaleString('de-DE'),
      r.zins ? (r.zins * 100).toFixed(2) + '%' : '0%',
      r.tilgung ? (r.tilgung * 100).toFixed(2) + '%' : '0%',
      (r.kapitaldienst || 0).toFixed(2),
      (r.zinsbindung || 0) + ' J',
      (r.akt_restschuld || 0).toLocaleString('de-DE'),
      r.laufzeit, (r.restschuld_ende || 0).toLocaleString('de-DE'),
      r.volltilgung
    ];
  });

  doc.autoTable({
    startY: 47,
    head: [['Datum','Nr','PLZ','Ort','Straße','Hn.','Bez.','m²','Miete €','€/m²','NK €',
      'Bank','Art','Fin.Datum','Mon','Vertragsnr','Darlehen','Zins','Tilg.','Kap.dienst',
      'Bindg','Akt.Rest','Laufzeit/Zut.','Rest Ende','Volltilg.']],
    body: pdfRows,
    theme: 'striped',
    headStyles: { fillColor: [42, 39, 39], textColor: [201, 168, 76], fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { fontSize: 6.5, cellPadding: 1.2 },
    alternateRowStyles: { fillColor: [248, 246, 240] },
    margin: { left: 6, right: 6 },
    columnStyles: {
      7: { halign: 'right' }, 8: { halign: 'right' }, 9: { halign: 'right' }, 10: { halign: 'right' },
      16: { halign: 'right' }, 17: { halign: 'right' }, 18: { halign: 'right' },
      19: { halign: 'right' }, 21: { halign: 'right' }, 23: { halign: 'right' }
    }
  });

  // Footer
  var pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text((typeof _getUserContact === 'function' ? _formatContact(_getUserContact()) : 'Junker Immobilien · Hermannstr. 9 · 32609 Hüllhorst · www.junker-immobilien.io'), 12, pageH - 6);

  doc.save('Junker_AuswertungBank_' + new Date().toISOString().slice(0, 10) + '.pdf');
  toast('✓ PDF erstellt (A3 Querformat)');
}

/* ═══════════════════════════════════════════════════════════════
   V36: Objekt-ID Konfliktcheck + manueller Edit
═══════════════════════════════════════════════════════════════ */

/**
 * Prüft ob eine Objekt-ID bei einem ANDEREN Objekt schon vergeben ist.
 * Returns: true wenn Konflikt, false wenn frei oder zu sich selbst gehört.
 */
async function _checkObjIdConflict(seq) {
  if (!seq) return false;
  // API-Modus: Backend fragen
  if (typeof Auth !== 'undefined' && Auth.isApiMode && Auth.isApiMode()) {
    try {
      var list = await Auth.apiCall('/objects', { method: 'GET' });
      if (Array.isArray(list)) {
        for (var i = 0; i < list.length; i++) {
          var o = list[i];
          // wenn data._obj_seq === seq UND id !== aktuelles Objekt → Konflikt
          var theirSeq = (o.data && o.data._obj_seq) || o._obj_seq || null;
          if (theirSeq === seq && o.id !== _currentObjKey) return true;
        }
      }
      return false;
    } catch (e) {
      console.warn('_checkObjIdConflict API:', e);
      return false;
    }
  }
  // Local-Modus: localStorage scannen
  try {
    var prefix = (typeof Auth !== 'undefined' && Auth.getStorageKey) ? Auth.getStorageKey('obj_') : 'ji_';
    for (var k = 0; k < localStorage.length; k++) {
      var key = localStorage.key(k);
      if (!key || key.indexOf(prefix) !== 0) continue;
      // Aktuelles Objekt selbst überspringen
      if (key === _currentObjKey) continue;
      try {
        var d = JSON.parse(localStorage.getItem(key) || '{}');
        if (d && d._obj_seq === seq) return true;
      } catch (e) { /* skip */ }
    }
  } catch (e) {}
  return false;
}

/**
 * Modal zum Bearbeiten der Objekt-ID öffnen.
 */
function editObjId() {
  var current = window._currentObjSeq || '';
  var newId = prompt(
    'Objekt-ID ändern\n\n' +
    'Aktuelle ID: ' + (current || '—') + '\n' +
    'Format: JJJJ-NNN (z.B. 2026-007)\n\n' +
    'Neue ID:',
    current
  );
  if (newId === null) return;          // abgebrochen
  newId = newId.trim();
  if (!newId) return;

  // Format validieren
  if (!/^\d{4}-\d{1,4}$/.test(newId)) {
    toast('⚠ Ungültiges Format. Bitte JJJJ-NNN, z.B. 2026-007.');
    return;
  }

  // Konfliktcheck
  _checkObjIdConflict(newId).then(function(conflict) {
    if (conflict) {
      toast('⚠ Objekt-ID "' + newId + '" ist bereits vergeben.');
      return;
    }
    window._currentObjSeq = newId;
    window._objSeqIsPreview = false;   // wenn manuell gesetzt → kein Preview mehr
    if (typeof ObjNumbering !== 'undefined' && ObjNumbering.registerExisting) {
      ObjNumbering.registerExisting(newId);
    }
    if (typeof updHeader === 'function') updHeader();

    // V49: Objekt mit neuer ID speichern + Karte links sofort updaten
    Promise.resolve(typeof saveObj === 'function' ? saveObj({ silent: true }) : null)
      .then(function() {
        if (typeof renderSaved === 'function') {
          try { renderSaved(); } catch(e) { console.warn('[V49] renderSaved fail:', e); }
        }
        toast('✓ Objekt-ID auf ' + newId + ' geändert');
      })
      .catch(function(err) {
        console.warn('[V49] Save nach editObjId fehlgeschlagen:', err);
        // Zurück zur alten ID (nur lokal)
        toast('⚠ Konnte ID nicht speichern: ' + (err.message || 'Fehler'));
      });
  });
}

window.editObjId = editObjId;
window._checkObjIdConflict = _checkObjIdConflict;

/* ═══════════════════════════════════════════════════════════════
   V41: Auto-Save bei Feld-Verlassen (onblur)
═══════════════════════════════════════════════════════════════ */
(function() {
  // V47: Auto-Save IST AUS. Nur noch Dirty-Tracking + manueller Save + Tab-Wechsel-Save
  var _isSaving = false;
  var _isDirty = false;

  function setSaveStatus(state, msg) {
    // Header-Indicator (alt) — bleibt funktional aber nicht mehr Hauptanzeige
    var indicator = document.getElementById('hdr-save-indicator');
    if (indicator) {
      indicator.classList.remove('save-idle', 'save-pending', 'save-saving', 'save-saved', 'save-error');
      indicator.classList.add('save-' + state);
      var textEl = indicator.querySelector('.hdr-save-text');
      if (textEl) textEl.textContent = msg;
    }
    // V47: Floating Save-Button (neu)
    var fbtn = document.getElementById('dp-floating-save');
    if (fbtn) {
      fbtn.classList.remove('fs-idle', 'fs-dirty', 'fs-saving', 'fs-saved', 'fs-error');
      fbtn.classList.add('fs-' + (state === 'pending' ? 'dirty' : state));
      var lbl = fbtn.querySelector('.fs-label');
      if (lbl) lbl.textContent =
        state === 'saving' ? 'Speichere…' :
        state === 'saved'  ? '✓ Gespeichert' :
        state === 'pending' || state === 'dirty' ? 'Speichern' :
        state === 'error'  ? '⚠ Fehler' : 'Speichern';
    }
  }

  /**
   * V47: Bei jeder Eingabe als "dirty" markieren — nicht speichern.
   * Speichern passiert NUR via Save-Button-Klick oder Tab-Wechsel.
   */
  function markDirty() {
    _isDirty = true;
    setSaveStatus('pending', 'Änderungen erkannt…');
  }

  async function performSave(opts) {
    opts = opts || {};
    if (_isSaving) return;
    if (typeof saveObj !== 'function') return;
    // Nur speichern wenn Daten vorhanden
    var kp = document.getElementById('kp');
    var ort = document.getElementById('ort');
    var hasData = (kp && kp.value && parseFloat(kp.value.replace(',', '.')) > 0) ||
                  (ort && ort.value && ort.value.trim().length > 1);
    if (!hasData) return;

    _isSaving = true;
    setSaveStatus('saving', 'Speichere…');
    try {
      window._autoSaveActive = !!opts.silent;
      await Promise.resolve(saveObj({ silent: !!opts.silent }));
      _isDirty = false;
      setSaveStatus('saved', '✓ Gespeichert');
      setTimeout(function() {
        if (!_isSaving && !_isDirty) setSaveStatus('idle', 'Bereit');
      }, 2200);
    } catch (err) {
      console.warn('[V47] Save Fehler:', err);
      setSaveStatus('error', '⚠ Speichern fehlgeschlagen');
    } finally {
      window._autoSaveActive = false;
      _isSaving = false;
    }
  }

  function setupTracking() {
    // Dirty-Tracking auf input + change events
    document.addEventListener('input', function(e) {
      var t = e.target;
      if (!t || !t.tagName) return;
      if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (!t.id) return;
      // Quick Check, Auth, Settings, etc. nicht
      if (t.id.startsWith('qc_') || t.id.startsWith('auth-') || t.id.startsWith('set_') ||
          t.id.startsWith('beta-') || t.id.startsWith('pdfi-') || t.id.startsWith('me_')) return;
      // Modal-Felder skip
      if (t.closest('.global-view-overlay, .pricing-overlay, .qc-overlay, .ds2-bulk-overlay, .pdfi-overlay, .ds2-kpi-overlay')) return;
      // Container prüfen
      if (!t.closest('.sec, .card')) return;
      markDirty();
    }, true);

    setSaveStatus('idle', 'Bereit');
  }

  // V47: Beim Schließen des Browsers warnen wenn ungespeichert
  window.addEventListener('beforeunload', function(e) {
    if (_isDirty) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTracking);
  } else {
    setTimeout(setupTracking, 100);
  }

  // V47: Globale Funktionen für Save-Button + Tab-Wechsel
  window.dpManualSave = function() { return performSave({ silent: false }); };
  window.dpTabSwitchSave = function() {
    if (_isDirty) return performSave({ silent: true });
  };
  window.dpIsDirty = function() { return _isDirty; };
  window.setSaveStatus = setSaveStatus;
  // Backwards-compat (Code ruft das evtl noch auf — wird zu no-op)
  window.autoSaveTrigger = function() {};
})();

/**
 * V198: Score → menschenlesbares Label
 * Konsistent mit dealscore2.js calcDealScore2:
 * 85+: Sehr gut · 70+: Gut · 50+: Okay · sonst: Schwach
 */
function _scoreLabel(s) {
  if (s == null || isNaN(s)) return '–';
  if (s >= 85) return 'Sehr gut';
  if (s >= 70) return 'Gut';
  if (s >= 50) return 'Okay';
  return 'Schwach';
}

// V62.2: Auto-saved Indikator im Header zeigen + nach 4s ausblenden
function _showAutoSavedIndicator() {
  var el = document.getElementById('hdr-autosave');
  if (!el) return;
  var textEl = el.querySelector('.hdr-autosave-text');
  if (textEl) textEl.textContent = 'Auto-saved · gerade eben';
  el.style.display = 'inline-flex';
  // Nach 4 Sekunden Text auf "vor X s" updaten + nach 30s ganz ausblenden
  var startTime = Date.now();
  if (window._autoSavedInterval) clearInterval(window._autoSavedInterval);
  window._autoSavedInterval = setInterval(function() {
    var seconds = Math.round((Date.now() - startTime) / 1000);
    if (seconds > 60) {
      el.style.display = 'none';
      clearInterval(window._autoSavedInterval);
      return;
    }
    if (textEl) {
      var t = seconds < 5 ? 'gerade eben' :
              seconds < 60 ? 'vor ' + seconds + ' s' :
              'vor ' + Math.round(seconds/60) + ' min';
      textEl.textContent = 'Auto-saved · ' + t;
    }
  }, 1000);
}
window._showAutoSavedIndicator = _showAutoSavedIndicator;

// ═══════════════════════════════════════════════════════════════
// V63.7: Toggle-Funktionen für Sidebar-Karten Mini-Cards
// ═══════════════════════════════════════════════════════════════

/**
 * Toggle CF Anzeige zwischen Jahr und Monat in den Sidebar-Karten
 */
window._toggleSbcCf = function(card) {
  if (!card) return;
  var mode = card.getAttribute('data-mode') || 'year';
  var newMode = mode === 'year' ? 'month' : 'year';
  card.setAttribute('data-mode', newMode);
  var lbl = card.querySelector('[data-cf-label]');
  var val = card.querySelector('[data-cf-val]');
  if (lbl) lbl.textContent = newMode === 'year' ? 'CF/J' : 'CF/M';
  if (val) val.textContent = newMode === 'year'
    ? card.getAttribute('data-year-val')
    : card.getAttribute('data-month-val');
};

/**
 * Toggle BMR/NMR Anzeige in den Sidebar-Karten
 */
window._toggleSbcBmr = function(card) {
  if (!card) return;
  var mode = card.getAttribute('data-mode') || 'bmr';
  var newMode = mode === 'bmr' ? 'nmr' : 'bmr';
  card.setAttribute('data-mode', newMode);
  var lbl = card.querySelector('[data-bmr-label]');
  var out = card.querySelector('[data-bmr-out]');
  var fill = card.querySelector('[data-bmr-fillel]');
  if (lbl) lbl.textContent = newMode === 'bmr' ? 'BMR' : 'NMR';
  if (out) out.textContent = card.getAttribute('data-' + newMode + '-val');
  if (fill) fill.style.width = card.getAttribute('data-' + newMode + '-fill') + '%';
};

/**
 * V110: Toggle DSCR/LTV Anzeige in den Sidebar-Karten (Marcels Wunsch — Klick auf
 * DSCR-Card wechselt zur LTV-Anzeige). Skala und Farb-Klasse passen sich an.
 */
window._toggleSbcDscr = function(card) {
  if (!card) return;
  var mode = card.getAttribute('data-mode') || 'dscr';
  var newMode = mode === 'dscr' ? 'ltv' : 'dscr';
  card.setAttribute('data-mode', newMode);

  // Farb-Klasse der Card austauschen (sbcm-good/warn/bad/neutral)
  var clsTokens = ['sbcm-good', 'sbcm-warn', 'sbcm-bad', 'sbcm-neutral'];
  clsTokens.forEach(function(c) { card.classList.remove(c); });
  var newCls = card.getAttribute('data-' + newMode + '-cls') || 'neutral';
  card.classList.add('sbcm-' + newCls);

  // Label, Wert, Fill, Marker tauschen
  var lbl = card.querySelector('[data-dscr-label]');
  var out = card.querySelector('[data-dscr-out]');
  var fill = card.querySelector('[data-dscr-fillel]');
  var marker = card.querySelector('[data-dscr-markerel]');
  var alertEl = card.querySelector('[data-dscr-alert]');
  var scaleEl = card.querySelector('[data-dscr-scale]');

  if (lbl) lbl.textContent = newMode === 'dscr' ? 'DSCR' : 'LTV';
  if (out) out.textContent = card.getAttribute('data-' + newMode + '-val');
  var fillPct = card.getAttribute('data-' + newMode + '-fill') || '0';
  if (fill) fill.style.width = fillPct + '%';
  if (marker) marker.style.left = fillPct + '%';

  // Alert-Icon nur bei "bad"
  if (alertEl) {
    alertEl.innerHTML = (newCls === 'bad') ? '<span class="sbcm-alert">⚠</span>' : '';
  }
  // Skala wechseln je nach Modus
  if (scaleEl) {
    scaleEl.innerHTML = newMode === 'dscr'
      ? '<span>0</span><span>1</span><span>1,5</span><span>2+</span>'
      : '<span>0%</span><span>50%</span><span>85%</span><span>100%+</span>';
  }
};

// V63.27: Sortier-Modus für Sidebar-Liste
function setSidebarSort(mode) {
  if (mode !== 'id' && mode !== 'recent') return;
  try { localStorage.setItem('dp_sb_sort', mode); } catch(e) {}
  // Buttons-State
  document.querySelectorAll('.sb-sort-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-sort') === mode);
  });
  if (typeof renderSaved === 'function') renderSaved();
}
window.setSidebarSort = setSidebarSort;

// V63.27: Beim Laden den gespeicherten Sort-Modus visuell aktivieren
(function _initSidebarSort() {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      var mode = (window.localStorage && localStorage.getItem('dp_sb_sort')) || 'recent';
      document.querySelectorAll('.sb-sort-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.getAttribute('data-sort') === mode);
      });
    }, 200);
  });
})();
