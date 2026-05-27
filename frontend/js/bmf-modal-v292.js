/* ═══════════════════════════════════════════════════════════════════════
 * V292 BMF-Modal Refactor — Pipeline-basiert mit 3 Varianten
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Was V292 macht:
 *   - Modal-Open triggert die V290-Backend-Pipeline (POST /pipeline)
 *   - Pane 1: Read-only Anzeige der AK-Berechnung aus Phase 2/3
 *   - Pane 2: KI-GAA bleibt editierbar, debounced 500ms triggert Pipeline neu
 *   - Pane 3: 3-Spalten-Varianten-Vergleich (Konservativ / Optimiert / Aggressiv)
 *   - Pane 4: Variant-Wahl (Radio) + Risikoampel + Klausel + Übernehmen
 *   - applyToTax() ersetzt: schreibt gewählten Boden/Gebäude-% in #geb_ant
 *
 * Globale Variablen (alle als window._v292*):
 *   _v292State            { response, selectedVariant, isLoading }
 *   _v292DebounceTimer    setTimeout-Handle
 *   _v292CollectInputs()  liest DOM-Werte
 *   _v292Pipeline()       debounced POST /api/v1/bmf/pipeline
 *   _v292RenderAll()      rendert alle 4 Panes aus State
 *   _v292Apply()          übernimmt gewählte Variante ins Steuermodul
 *
 * Singletons:
 *   window.applyToTax = _v292Apply  (overrides V289.2.5)
 *
 * Engine-Version: v292.0.0
 * ═══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────
  window._v292State = {
    response: null,           // Backend-Response von /pipeline
    selectedVariant: 'konservativ',
    isLoading: false,
    lastError: null,
    lastInputs: null
  };

  var _debounceTimer = null;
  var DEBOUNCE_MS = 500;

  // ─── Helpers ─────────────────────────────────────────────────────────
  function _v(id){
    var el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }

  function _parseDe(s){
    if (s == null) return 0;
    s = String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
    var v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  }

  function _fmtEur(v, decimals){
    if (decimals == null) decimals = 0;
    if (!isFinite(v)) return '—';
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(v) + ' €';
  }

  function _fmtPct(v, decimals){
    if (decimals == null) decimals = 2;
    if (!isFinite(v)) return '—';
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(v) + ' %';
  }

  function _authHeaders(){
    /* V292.1-auth-fix: nutze vorhandene _authHeaders aus V289 wenn da,
     * sonst Fallback auf ji_token (der echte Key, nicht dp_token). */
    try {
      // V289 hat eine globale _authHeaders Funktion in bmf-modal.js
      // sie ist nicht window-exported, aber im selben Scope sichtbar
      if (typeof window.__bmfAuthHeaders === 'function') {
        return window.__bmfAuthHeaders();
      }
    } catch(e) {}
    var token = localStorage.getItem('ji_token') || localStorage.getItem('dp_token') || '';
    var h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  // ─── Phase 1: Inputs aus DOM sammeln ─────────────────────────────────
  window._v292CollectInputs = function(){
    // Inventar-Detail-Box (V291)
    var inventar = {
      kueche:     _parseDe(_v('inv_kueche')),
      moebel:     _parseDe(_v('inv_moebel')),
      geraete:    _parseDe(_v('inv_geraete')),
      pv:         _parseDe(_v('inv_pv')),
      stellplatz: _parseDe(_v('inv_stellplatz')),
      sonstiges:  _parseDe(_v('inv_sonst'))
    };

    // Investition (Tab Investition)
    var investition = {
      kp_brutto:  _parseDe(_v('kp')),
      gest_e:     _parseDe(_v('gest_e')),
      notar_e:    _parseDe(_v('notar_e')),
      gba_e:      _parseDe(_v('gba_e')),
      makler_e:   _parseDe(_v('makler_e')),
      ji_sonst_e: _parseDe(_v('ji_e')),
      kaufdat:    _v('kaufdat')
    };

    // Objekt (Tab Objekt)
    var objekt = {
      plz:        _v('plz'),
      ort:        _v('ort'),
      str:        _v('str'),
      hnr:        _v('hnr'),
      objart_bmf: 'Wohnungseigentum [WE]',
      wfl:        _parseDe(_v('wfl')),
      baujahr:    parseInt(_v('baujahr'), 10) || 0,
      gsfl:       _parseDe(_v('gsfl')),
      brw:        _parseDe(_v('brw'))
    };

    // Miete (Tab Miete)
    var miete = {
      nkm:           _parseDe(_v('nkm')),
      marktmiete_qm: _parseDe(_v('ds2_marktmiete')),
      leerstand:     (document.getElementById('leerstand') || {}).checked === true
    };

    // GAA (KI-GAA-Block im Pane 2, falls editiert)
    var gaa = {
      brw_user:           _parseDe(_v('bmf_brw')),
      vergleichsmiete_low: _parseDe(_v('bmf_vm_low')),
      vergleichsmiete_high: _parseDe(_v('bmf_vm_high')),
      sachwertfaktor:     _parseDe(_v('bmf_lzs')) || 1
    };

    // Renovierung
    var renovierung = {
      san_geplant_3j:         _parseDe(_v('san')),
      moebl_verteilung_jahre: 10  // Default — könnte aus moebl_tax_years gelesen werden
    };
    var moeblYearsEl = document.getElementById('moebl_tax_years');
    if (moeblYearsEl && moeblYearsEl.value) {
      var y = parseInt(moeblYearsEl.value, 10);
      if (y > 0) renovierung.moebl_verteilung_jahre = y;
    }

    return {
      phase1_inputs: {
        objekt: objekt,
        investition: investition,
        inventar: inventar,
        renovierung: renovierung,
        miete: miete,
        gaa: gaa
      }
    };
  };

  // ─── Phase 4: Pipeline-Call (debounced) ──────────────────────────────
  function _doPipelineCall(){
    var inputs = window._v292CollectInputs();
    window._v292State.lastInputs = inputs;

    // Pflichtfelder-Check
    var obj = inputs.phase1_inputs.objekt;
    var missing = [];
    if (!obj.wfl)       missing.push('Wohnfläche');
    if (!obj.baujahr)   missing.push('Baujahr');
    if (!obj.plz)       missing.push('PLZ');
    if (!obj.ort)       missing.push('Ort');
    if (!obj.str)       missing.push('Straße');
    if (!inputs.phase1_inputs.investition.kp_brutto) missing.push('Kaufpreis');

    if (missing.length) {
      _v292ShowError('Pflichtfelder fehlen: ' + missing.join(', '));
      return;
    }

    window._v292State.isLoading = true;
    window._v292State.lastError = null;
    _v292RenderLoading();

    fetch('/api/v1/bmf/pipeline', {
      method: 'POST',
      headers: _authHeaders(),
      body: JSON.stringify(inputs)
    })
    .then(function(r){
      if (!r.ok) {
        return r.json().then(function(e){
          throw new Error(e.error || ('HTTP ' + r.status));
        });
      }
      return r.json();
    })
    .then(function(data){
      if (!data.ok) {
        throw new Error(data.error || 'Pipeline-Response nicht ok');
      }
      window._v292State.response = data;
      window._v292State.isLoading = false;
      window._v292State.lastError = null;
      window._v292RenderAll();
    })
    .catch(function(err){
      console.error('[v292] Pipeline-Fehler:', err);
      window._v292State.isLoading = false;
      window._v292State.lastError = err.message;
      _v292ShowError(err.message);
    });
  }

  window._v292Pipeline = function(){
    // Debounced: clear vorheriger Timer, neuer Timer 500ms
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(function(){
      _debounceTimer = null;
      _doPipelineCall();
    }, DEBOUNCE_MS);
  };

  // ─── Variant-Wahl ────────────────────────────────────────────────────
  window._v292SelectVariant = function(name){
    if (!['konservativ', 'optimiert', 'aggressiv'].includes(name)) return;
    window._v292State.selectedVariant = name;
    window._v292RenderAll();
  };

  // ─── Render: Pane 1 (Anschaffungskosten) ─────────────────────────────
  function _renderPane1(){
    var r = window._v292State.response;
    if (!r || !r.ok) return;

    var p2 = r.phase2_inventar;
    var p3 = r.phase3_prognose_ak;

    // Read-only Box oben in Pane 1 finden/erstellen
    var box = document.getElementById('v292_ak_summary');
    if (!box) {
      var paneAk = document.getElementById('p-ak');
      if (!paneAk) return;
      box = document.createElement('div');
      box.id = 'v292_ak_summary';
      box.className = 'v292-summary-box';
      paneAk.insertBefore(box, paneAk.firstChild);
    }

    // Bestehende Inputs in Pane 1 ausblenden (alte Eingabefelder bleiben unverändert
    // im DOM für Rückwärtskompatibilität, sind aber visuell ausgeblendet)
    var bannerInfo = document.querySelector('#p-ak .banner.info');
    if (bannerInfo) bannerInfo.style.display = 'none';
    /* V292.5-accordion-fix: ENTFERNT — alte Inputs bleiben sichtbar.
     * Vorher: blendete <div class="g2"> INSIDE <details class="fold"> mit aus
     *         → Fahrtkosten-Helfer + Weitere Positionen liessen sich nicht öffnen.
     * Jetzt: Summary-Box oben dient als Übersicht,
     *        Eingabefelder bleiben darunter editierbar verfügbar.
     */

    /* V292.4-pane1-compact: kompakter + Reisekosten-Zeile */
    function _domVal(id){
      var el = document.getElementById(id);
      if (!el) return 0;
      var s = (el.value || el.textContent || '').toString();
      s = s.replace(/\./g,'').replace(',','.').replace(/[^\d.\-]/g,'');
      var v = parseFloat(s);
      return isNaN(v) ? 0 : v;
    }
    var reiseFahrt   = _domVal('ak_fahrt');
    var reiseVerpfl  = _domVal('ak_verpfl');
    var reiseHotel   = _domVal('ak_hotel');
    var reiseTotal   = reiseFahrt + reiseVerpfl + reiseHotel;
    var sonstGuta    = _domVal('ak_gutachten');
    var sonstAnwalt  = _domVal('ak_anwalt');
    var sonstAndere  = _domVal('ak_sonst');
    var sonstTotal   = sonstGuta + sonstAnwalt + sonstAndere;
    var bruttoKp = p2.aufschluesselung.kueche + p2.aufschluesselung.moebel +
                   p2.aufschluesselung.geraete + p2.aufschluesselung.pv +
                   p2.aufschluesselung.stellplatz + p2.aufschluesselung.sonstiges +
                   p2.immobilien_kp;
    box.innerHTML =
      '<div class="v292-summary-banner v292-compact">' +
        'Werte aus Tab Investition + Inventar-Detail-Box. Änderungen bitte dort.' +
      '</div>' +
      '<div class="v292-summary-grid v292-compact">' +
        '<div class="v292-row"><span>Brutto-Kaufpreis</span><span>' + _fmtEur(bruttoKp) + '</span></div>' +
        '<div class="v292-row v292-row-minus"><span>− Inventar (Detail-Box)</span><span>' + _fmtEur(p2.inventar_gesamt) + '</span></div>' +
        '<div class="v292-row v292-row-result"><span><b>= Immobilien-KP</b> <span class="v292-arrow">→ Basis für BMF</span></span><span><b>' + _fmtEur(p2.immobilien_kp) + '</b></span></div>' +
        '<div class="v292-row v292-row-plus"><span>+ Nebenkosten</span><span>' + _fmtEur(p3.nk_gesamt) + '</span></div>' +
        '<div class="v292-nk-detail">' +
          '<div>├ Grunderwerbsteuer: <b>' + _fmtEur(p3.nk_aufschluesselung.grest) + '</b></div>' +
          '<div>├ Notar: <b>' + _fmtEur(p3.nk_aufschluesselung.notar) + '</b></div>' +
          '<div>├ Grundbuchamt: <b>' + _fmtEur(p3.nk_aufschluesselung.gba) + '</b></div>' +
          '<div>├ Makler: <b>' + _fmtEur(p3.nk_aufschluesselung.makler) + '</b></div>' +
          '<div>└ Sonstiges (ji_e): <b>' + _fmtEur(p3.nk_aufschluesselung.ji_sonst) + '</b></div>' +
        '</div>' +
        (reiseTotal > 0 ?
          '<div class="v292-row v292-row-plus"><span>+ Reise & Aufwand <span class="v292-info-tag">in NK enthalten</span></span><span>' + _fmtEur(reiseTotal) + '</span></div>' +
          '<div class="v292-nk-detail">' +
            (reiseFahrt > 0 ? '<div>├ Fahrtkosten: <b>' + _fmtEur(reiseFahrt, 2) + '</b></div>' : '') +
            (reiseVerpfl > 0 ? '<div>├ Verpflegungsmehraufwand: <b>' + _fmtEur(reiseVerpfl, 2) + '</b></div>' : '') +
            (reiseHotel > 0 ? '<div>└ Unterkunft: <b>' + _fmtEur(reiseHotel, 2) + '</b></div>' : '') +
          '</div>'
          : '') +
        (sonstTotal > 0 ?
          '<div class="v292-row v292-row-plus"><span>+ Gutachten/Anwalt/Sonstiges <span class="v292-info-tag">in NK enthalten</span></span><span>' + _fmtEur(sonstTotal) + '</span></div>'
          : '') +
        '<div class="v292-row v292-row-final"><span><b>= Prognose-AK</b> <span class="v292-arrow">→ Basis für AfA</span></span><span class="v292-final-value"><b>' + _fmtEur(p3.prognose_ak) + '</b></span></div>' +
      '</div>';

    // Inventar-Aufschlüsselung anzeigen wenn > 0
    if (p2.inventar_gesamt > 0) {
      var detail = [];
      var a = p2.aufschluesselung;
      if (a.kueche > 0)     detail.push('Küche ' + _fmtEur(a.kueche));
      if (a.moebel > 0)     detail.push('Möbel ' + _fmtEur(a.moebel));
      if (a.geraete > 0)    detail.push('Geräte ' + _fmtEur(a.geraete));
      if (a.pv > 0)         detail.push('PV ' + _fmtEur(a.pv));
      if (a.stellplatz > 0) detail.push('Stellplatz ' + _fmtEur(a.stellplatz));
      if (a.sonstiges > 0)  detail.push('Sonstiges ' + _fmtEur(a.sonstiges));

      var invHint = document.createElement('div');
      invHint.className = 'v292-inv-hint';
      invHint.innerHTML = '<small><b>Inventar-Aufschlüsselung:</b> ' + detail.join(' · ') + '</small>';
      box.querySelector('.v292-summary-grid').appendChild(invHint);
    }
  }

  // ─── Render: Pane 2 (BMF-Aufteilung) ─────────────────────────────────
  function _renderPane2(){
    var r = window._v292State.response;
    if (!r || !r.ok) return;

    var p4 = r.phase4_bmf;

    // Aktualisiere die bestehenden Output-Felder
    var elGebPct = document.getElementById('bmf_geb_anteil');
    if (elGebPct) elGebPct.textContent = _fmtPct(p4.gebaeudeanteil_prozent);

    var elAfaBasis = document.getElementById('bmf_afa_basis');
    if (elAfaBasis) elAfaBasis.textContent = _fmtEur(p4.gebaeudewert);

    // Verfahren-Anzeige
    var verfMap = {
      'ertragswert': 'Ertragswert',
      'sachwert':    'Sachwert (marktangepasst)',
      'vergleichswert': 'Vergleichswert'
    };
    var verfLabel = verfMap[p4.verfahren] || p4.verfahren;

    // Verfahren-Anzeige aktualisieren
    var elHint = document.getElementById('bmfAutoHint');
    if (elHint) {
      elHint.textContent = '✓ Maßgebend: ' + verfLabel + ' (' + _fmtPct(p4.gebaeudeanteil_prozent) + ' Gebäude)';
      elHint.style.color = '';
    }

    // Verfahren-Toggle-Buttons: maßgebendes Verfahren markieren
    var verfBtnMap = { ertragswert: 'vb-ertrag', sachwert: 'vb-sach', vergleichswert: 'vb-vergl' };
    document.querySelectorAll('.bmfmo-verf-btn').forEach(function(b){ b.classList.remove('active'); });
    var activeBtn = document.getElementById(verfBtnMap[p4.verfahren]);
    if (activeBtn) activeBtn.classList.add('active');
  }

  // ─── Render: Pane 3 (3-Spalten-Varianten-Vergleich) ──────────────────
  function _renderPane3(){
    var r = window._v292State.response;
    if (!r || !r.ok) return;

    var paneAfa = document.getElementById('p-afa');
    if (!paneAfa) return;

    // Pane 3 komplett ersetzen mit V292-Varianten-Vergleich
    var v292Container = document.getElementById('v292_pane3_container');
    if (!v292Container) {
      // Alte Inhalte ausblenden
      [].forEach.call(paneAfa.children, function(child){
        child.style.display = 'none';
      });
      v292Container = document.createElement('div');
      v292Container.id = 'v292_pane3_container';
      paneAfa.appendChild(v292Container);
    }

    var p5  = r.phase5_varianten;
    var p8  = r.phase8_finale_ak;
    var p9  = r.phase9_15pct;
    var p10 = r.phase10_afa;
    var p11 = r.phase11_risiko;

    var ampelEmoji = { gruen: '🟢', gelb: '🟡', rot: '🔴' };
    var variants = ['konservativ', 'optimiert', 'aggressiv'];
    var labels = {
      konservativ: { name: 'Konservativ', sub: '× 1,00 · BMF-Wert' },
      optimiert:   { name: 'Optimiert',   sub: '× 0,85 · Boden −15 %' },
      aggressiv:   { name: 'Aggressiv',   sub: '× 0,75 · Boden −25 %' }
    };

    var html = '<div class="v292-pane3-header">' +
      '<div class="banner info"><strong>Drei Vertragsvarianten — wählen Sie in Pane 4 die für Ihre Risikobereitschaft passende.</strong> ' +
      'Alle Werte basieren auf der BMF-Berechnung (' + _fmtPct(r.phase4_bmf.gebaeudeanteil_prozent) + ' Gebäude per Ertragswertverfahren).</div>' +
      '</div>' +
      '<table class="v292-vergleich-tbl">' +
      '<thead><tr><th>Kennzahl</th>';

    variants.forEach(function(name){
      var risk = p11[name];
      html += '<th class="v292-th-' + risk.ampel + '">' +
        ampelEmoji[risk.ampel] + ' ' + labels[name].name +
        '<div class="v292-th-sub">' + labels[name].sub + '</div></th>';
    });
    html += '</tr></thead><tbody>';

    function _row(label, values, opts){
      opts = opts || {};
      var cls = opts.bold ? 'v292-row-bold' : '';
      var s = '<tr class="' + cls + '"><td>' + label + '</td>';
      values.forEach(function(v){ s += '<td>' + v + '</td>'; });
      s += '</tr>';
      return s;
    }

    html += _row('Gebäude %', variants.map(function(n){ return _fmtPct(p5[n].gebaeude_pct); }));
    html += _row('Boden %', variants.map(function(n){ return _fmtPct(p5[n].boden_pct); }));
    html += _row('Gebäude im Vertrag', variants.map(function(n){ return _fmtEur(p5[n].gebaeude_eur_vertrag); }));
    html += _row('Boden im Vertrag', variants.map(function(n){ return _fmtEur(p5[n].boden_eur_vertrag); }));
    html += _row('Gebäude-AK (mit NK)', variants.map(function(n){ return _fmtEur(p8[n].gebaeude_ak); }), { bold: true });
    html += _row('15-%-Grenze (max. Sanierung)', variants.map(function(n){ return _fmtEur(p9[n].max); }));
    html += _row('AfA-Satz', variants.map(function(n){ return _fmtPct(p10[n].afa_satz_pct, 1); }));
    html += _row('AfA Gebäude/Jahr', variants.map(function(n){ return _fmtEur(p10[n].afa_jahr); }));
    html += _row('AfA Inventar/Jahr', variants.map(function(n){ return _fmtEur(p10[n].inventar_afa_jahr); }));
    html += _row('Σ AfA pro Jahr', variants.map(function(n){ return _fmtEur(p10[n].afa_summe_jahr); }), { bold: true });
    html += _row('Steuerersparnis/Jahr (~40 %)', variants.map(function(n){ return _fmtEur(p10[n].steuerersparnis_jahr); }));

    // Risiko-Begründung
    html += '<tr class="v292-row-risiko"><td>Risiko-Begründung</td>';
    variants.forEach(function(name){
      var risk = p11[name];
      html += '<td class="v292-risk-cell"><b>Score ' + risk.score + '</b><br><small>' + risk.begruendungen.join('<br>') + '</small></td>';
    });
    html += '</tr>';

    html += '</tbody></table>' +
      '<p class="hint" style="margin-top:14px">Bitte beachten: <strong>Konservativ</strong> entspricht exakt dem BMF-Wert und ist FA-konform. ' +
      '<strong>Aggressiv</strong> kann bei Prüfung beanstandet werden. Empfehlung in Pane 4 wählen.</p>';

    v292Container.innerHTML = html;
  }

  // ─── Render: Pane 4 (Variant-Wahl + Übernehmen) ──────────────────────
  function _renderPane4(){
    var r = window._v292State.response;
    if (!r || !r.ok) return;

    // Varianten-Grid (existiert schon als #varGrid)
    var varGrid = document.getElementById('varGrid');
    if (!varGrid) return;

    var p5  = r.phase5_varianten;
    var p10 = r.phase10_afa;
    var p11 = r.phase11_risiko;
    var selected = window._v292State.selectedVariant;

    var ampelEmoji = { gruen: '🟢', gelb: '🟡', rot: '🔴' };
    var labels = {
      konservativ: 'Konservativ',
      optimiert:   'Optimiert',
      aggressiv:   'Aggressiv'
    };
    var subLabels = {
      konservativ: '× 1,00 · BMF-Referenz',
      optimiert:   '× 0,85 · Boden −15 %',
      aggressiv:   '× 0,75 · Boden −25 %'
    };

    var html = '';
    ['konservativ', 'optimiert', 'aggressiv'].forEach(function(name){
      var v = p5[name];
      var afa = p10[name];
      var risk = p11[name];
      var isSelected = name === selected;
      /* V292.5-variant-eur: €-Werte zusätzlich neben % anzeigen */
      var card =
        '<div class="v292-var-card v292-var-' + risk.ampel + (isSelected ? ' v292-var-selected' : '') + '" ' +
             'onclick="window._v292SelectVariant(\'' + name + '\')">' +
          '<div class="v292-var-radio">' +
            '<input type="radio" name="v292_variant" value="' + name + '" ' + (isSelected ? 'checked' : '') + ' onclick="event.stopPropagation();window._v292SelectVariant(\'' + name + '\')">' +
            '<span class="v292-var-ampel">' + ampelEmoji[risk.ampel] + '</span>' +
            '<span class="v292-var-name">' + labels[name] + '</span>' +
          '</div>' +
          '<div class="v292-var-sub">' + subLabels[name] + '</div>' +
          '<div class="v292-var-row v292-var-row-2line">' +
            '<span>Gebäude</span>' +
            '<span class="v292-var-2line"><b>' + _fmtPct(v.gebaeude_pct) + '</b><small>' + _fmtEur(v.gebaeude_eur_vertrag) + '</small></span>' +
          '</div>' +
          '<div class="v292-var-row v292-var-row-2line">' +
            '<span>Boden</span>' +
            '<span class="v292-var-2line"><b>' + _fmtPct(v.boden_pct) + '</b><small>' + _fmtEur(v.boden_eur_vertrag) + '</small></span>' +
          '</div>' +
          '<div class="v292-var-row v292-var-row-hi"><span>AfA / Jahr</span><b>' + _fmtEur(afa.afa_summe_jahr) + '</b></div>' +
          '<div class="v292-var-row"><span>Steuerersparnis</span><b>~' + _fmtEur(afa.steuerersparnis_jahr) + '</b></div>' +
          '<div class="v292-var-risk"><small>Risiko Score ' + risk.score + '</small></div>' +
        '</div>';
      html += card;
    });
    varGrid.innerHTML = html;

    // 15-%-Grenze für gewählte Variante
    var p9 = r.phase9_15pct[selected];
    var p8 = r.phase8_finale_ak[selected];
    var g15max = document.getElementById('g15_max');
    var g15basis = document.getElementById('g15_basis');
    var g15puffer = document.getElementById('g15_puffer');
    var g15status = document.getElementById('g15_status');
    var g15bar = document.getElementById('g15_bar');
    var g15geplant = document.getElementById('g15_geplant');

    if (g15max)    g15max.textContent = _fmtEur(p9.max);
    if (g15basis)  g15basis.textContent = _fmtEur(p8.gebaeude_ak);
    if (g15puffer) g15puffer.textContent = _fmtEur(p9.puffer);
    if (g15geplant) g15geplant.value = _fmtEur(p9.geplant).replace(' €', '').trim();
    if (g15status) {
      var statusText = { puffer: '🟢 Puffer', eng: '🟡 Knapp', ueberschritten: '🔴 Überschritten' };
      g15status.textContent = statusText[p9.status] || p9.status;
    }
    if (g15bar) {
      var pct = p9.max > 0 ? Math.min(100, (p9.geplant / p9.max) * 100) : 0;
      g15bar.style.width = pct + '%';
      g15bar.style.background = p9.status === 'ueberschritten' ? '#B8625C' : (p9.status === 'eng' ? '#E0A030' : '#3FA56C');
    }

    // Inventar-Hint (V292.2-bugfixes-applied — Scope-Fix für afa)
    var invHint = document.getElementById('invDisclaimerText');
    if (invHint) {
      var selectedAfa = r.phase10_afa[selected] || {};
      var invYears = selectedAfa.inventar_afa_jahre || 10;
      invHint.textContent = _fmtEur(r.phase2_inventar.inventar_gesamt) +
        ' (aus Inventar-Detail-Box · ' +
        invYears + ' Jahre AfA, separat in Pane 4 ausgewiesen)';
    }

    // V292.2 Bug C: bestehende Sanierung-Viz aus V289.2.5 triggern
    try {
      if (typeof window._syncSanierungViz === 'function') {
        window._syncSanierungViz();
      } else if (typeof _syncSanierungViz === 'function') {
        _syncSanierungViz();
      }
    } catch(e) { console.warn('[v292.2] _syncSanierungViz:', e); }

    // V292.2 Bug D: Klausel initial triggern wenn noch nicht geschehen
    try {
      var klauselTextEl = document.getElementById('klauselText');
      if (klauselTextEl && (!klauselTextEl.innerHTML || klauselTextEl.innerHTML.trim() === '')) {
        if (typeof window.selectKlausel === 'function') {
          window.selectKlausel(selected === 'konservativ' ? 'konservativ' : (selected === 'aggressiv' ? 'aggressiv' : 'moderat'));
        }
      }
    } catch(e) { console.warn('[v292.2] selectKlausel:', e); }
  }

  function _renderLoading(){
    var hint = document.getElementById('bmfAutoHint');
    if (hint) {
      hint.textContent = '⏳ Pipeline berechnet (LibreOffice + Risiko + 3 Varianten)...';
      hint.style.color = 'var(--gold-d)';
    }
  }
  window._v292RenderLoading = _renderLoading;

  function _showError(msg){
    var hint = document.getElementById('bmfAutoHint');
    if (hint) {
      hint.textContent = '✗ ' + msg;
      hint.style.color = 'var(--red, #B8625C)';
    }
  }
  window._v292ShowError = _showError;

  // ─── Master-Render ───────────────────────────────────────────────────
  window._v292RenderAll = function(){
    try {
      _renderPane1();
      _renderPane2();
      _renderPane3();
      _renderPane4();
    } catch(e) {
      console.error('[v292] Render-Fehler:', e);
    }
  };

  // ─── Apply: Variante → Steuermodul ──────────────────────────────────
  window._v292Apply = function(){
    var st = window._v292State;
    if (!st.response || !st.response.ok) {
      if (typeof toast === 'function') toast('Bitte warten — Pipeline-Berechnung läuft noch');
      return;
    }

    var selected = st.selectedVariant;
    var v = st.response.phase5_varianten[selected];
    var afa = st.response.phase10_afa[selected];

    // Gebäudeanteil-% ins Steuermodul schreiben
    var gebAntEl = document.getElementById('geb_ant');
    if (gebAntEl) {
      gebAntEl.value = v.gebaeude_pct.toFixed(2).replace('.', ',');
      gebAntEl.classList.add('from-bmf-v292');
      gebAntEl.style.background = 'var(--gold-bg, #FFF7E0)';
      gebAntEl.style.borderColor = 'var(--gold, #C9A84C)';
      gebAntEl.title = 'Aus BMF-Pipeline V292 übernommen · Variante: ' + selected + ' · ' + new Date().toLocaleString('de-DE');
      gebAntEl.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Label-Badge setzen
    var label = gebAntEl && gebAntEl.closest('.f') && gebAntEl.closest('.f').querySelector('label');
    if (label) {
      var existingBadge = label.querySelector('.v292-bmf-badge');
      if (!existingBadge) {
        var badge = document.createElement('span');
        badge.className = 'v292-bmf-badge';
        badge.title = 'Aus BMF-Pipeline V292 übernommen';
        badge.innerHTML = '🤖 BMF';
        badge.style.cssText = 'margin-left:6px;padding:2px 6px;background:var(--gold,#C9A84C);color:#fff;border-radius:3px;font-size:10px;font-weight:600;letter-spacing:.05em';
        label.appendChild(badge);
      } else {
        existingBadge.textContent = '🤖 BMF · ' + ({konservativ:'Kons',optimiert:'Opt',aggressiv:'Aggr'}[selected] || selected);
      }
    }

    // calc() triggern
    if (typeof window.calc === 'function') window.calc();

    /* V292.2-bugfixes-applied: tax-snapshots-Persistenz entfernt.
     * Backend-Endpoint POST /api/v1/tax-snapshots/:id/bmf existiert nicht.
     * Persistenz erfolgt implizit über calc() + Object-Save im Tab.
     */

    // V292.2 Bonus: Reset-Button hinzufügen
    _v292InjectResetButton(gebAntEl);

    // Toast
    if (typeof toast === 'function') {
      toast('✓ Variante "' + selected + '" übernommen — Gebäudeanteil ' + _fmtPct(v.gebaeude_pct) + ' im Steuermodul');
    }

    // Modal schließen
    if (typeof closeBMFModal === 'function') closeBMFModal();
  };

  // V292.2: Reset-Button im AfA-Konfig — erscheint nach Übernehmen
  function _v292InjectResetButton(gebAntEl){
    if (!gebAntEl) return;
    var wrap = gebAntEl.closest('.iw') || gebAntEl.parentElement;
    if (!wrap) return;
    if (wrap.querySelector('.v292-reset-btn')) return;  // schon da

    var btn = document.createElement('button');
    btn.className = 'v292-reset-btn';
    btn.type = 'button';
    btn.title = 'BMF-Wert zurücksetzen auf Standard 80 %';
    btn.innerHTML = '↺';
    btn.style.cssText = 'margin-left:6px;padding:4px 9px;background:transparent;border:1px solid var(--gold,#C9A84C);color:var(--gold-d,#8A7340);border-radius:4px;cursor:pointer;font-size:14px;font-weight:600;line-height:1;vertical-align:middle';
    btn.onclick = function(){
      // Bestätigung
      if (!confirm('Gebäudeanteil zurücksetzen auf 80 % (Standard)?\nDie BMF-Berechnung bleibt erhalten — du kannst sie wieder übernehmen.')) return;
      // Wert zurücksetzen
      gebAntEl.value = '80,00';
      gebAntEl.classList.remove('from-bmf-v292');
      gebAntEl.style.background = '';
      gebAntEl.style.borderColor = '';
      gebAntEl.title = '';
      // Badge entfernen
      var label = gebAntEl.closest('.f') && gebAntEl.closest('.f').querySelector('label');
      if (label) {
        var badge = label.querySelector('.v292-bmf-badge');
        if (badge) badge.remove();
      }
      // Reset-Button selbst entfernen
      btn.remove();
      // calc() triggern
      gebAntEl.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof window.calc === 'function') window.calc();
      if (typeof toast === 'function') toast('↺ Gebäudeanteil zurückgesetzt auf 80 %');
    };
    wrap.appendChild(btn);
  }

  function _currentObjectIdSafe(){
    try {
      if (typeof _currentObjectId === 'function') return _currentObjectId();
    } catch(e) {}
    return null;
  }

  // ─── Hook in openBMFModal: V292-Init nach Lazy-Load ─────────────────
  // Wir wrappen die bestehende openBMFModal-Funktion
  var _origOpenBMFModal = window.openBMFModal;
  window.openBMFModal = function(){
    if (typeof _origOpenBMFModal === 'function') {
      _origOpenBMFModal();
    }
    // Nach Lazy-Load: V292-Init + erster Pipeline-Call
    setTimeout(function(){
      var ov = document.getElementById('bmfOverlay');
      if (!ov || !ov.classList.contains('open')) return;

      // V292 Banner: zeigt dass Pipeline läuft
      _renderLoading();

      // Ersten Pipeline-Call triggern (direkt, nicht debounced)
      _doPipelineCall();

      // Event-Listener für Live-Berechnung bei Pane 2 GAA-Änderungen
      _attachLivePipelineListeners();
    }, 100);
  };

  function _attachLivePipelineListeners(){
    // Verhindere doppeltes Anhängen
    if (window._v292ListenersAttached) return;
    window._v292ListenersAttached = true;

    // Pane 2: bei jeder GAA-Eingabe → debounced Pipeline-Call
    var gaaIds = ['bmf_brw', 'bmf_vm_low', 'bmf_vm_high', 'bmf_lzs', 'bmf_mea',
                  'bmf_wfl', 'bmf_gsfl', 'bmf_bj', 'bmf_datum', 'bmf_miete'];
    gaaIds.forEach(function(id){
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', window._v292Pipeline);
        el.addEventListener('change', window._v292Pipeline);
      }
    });
  }

  // ─── applyToTax-Override ─────────────────────────────────────────────
  // V289.2.5 applyToTax wird durch V292 ersetzt
  window.applyToTax = window._v292Apply;

  console.log('[v292] BMF-Modal-Refactor V292 geladen — Pipeline-basiert, 3 Varianten, Live-Debounced 500ms');

})();
