/**
 * DealPilot — Restnutzungsdauer UI V2
 * ======================================
 * Renderer für RND-Rechner mit:
 *   - Allen 6 Verfahren in Ergebnis-Anzeige
 *   - Schadens-Eingabe-Card mit Toggle für Abschlag-Anwendung
 *   - Gutachten-Metadaten-Sektion (für PDF-Export)
 *   - Vollständigem Gutachten-Export-Button
 *   - Import-API für DealPilot-Objekte
 *
 * Plan-Gating, Grenzsteuer-Toggle, Branding aus V1 übernommen.
 *
 * Public API:
 *   DealPilotRND_UI.render(containerEl, options)
 *   DealPilotRND_UI.getCurrentResult()
 *   DealPilotRND_UI.loadObject(dealPilotObject)  // NEU: Import aus DealPilot
 */
(function (global) {
  'use strict';

  const RND = global.DealPilotRND;
  const GND = global.DealPilotRND_GND;

  let currentState = null;
  let currentResult = null;
  let currentAfa = null;
  let renderTarget = null;
  let renderOptions = null;

  const DEFAULT_OPTIONS = {
    showPlanGate: true,
    requirePlan: ['pro', 'business'],
    initialData: null,
    onRecalc: null,
    grenzsteuerSource: 'manual',
    grenzsteuerAuto: 0.42
  };

  // ============================================================
  // PLAN CHECK
  // ============================================================
  function getCurrentPlanId() {
    try {
      if (global.DealPilotConfig && global.DealPilotConfig.pricing
          && typeof global.DealPilotConfig.pricing.current === 'function') {
        const p = global.DealPilotConfig.pricing.current();
        return (p && p.id) ? String(p.id).toLowerCase() : 'free';
      }
    } catch (e) {}
    try {
      const o = localStorage.getItem('dp_plan_override');
      if (o) return String(o).toLowerCase();
    } catch (e) {}
    return 'free';
  }

  function hasAccess(opts) {
    if (!opts.showPlanGate) return true;
    const planId = getCurrentPlanId();
    return opts.requirePlan.indexOf(planId) >= 0;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================
  function render(container, options) {
    if (!container) {
      console.error('[DealPilotRND_UI] container is required');
      return;
    }
    renderTarget = container;
    renderOptions = Object.assign({}, DEFAULT_OPTIONS, options || {});

    if (!hasAccess(renderOptions)) {
      renderPlanGate(container);
      return;
    }

    currentState = buildInitialState(renderOptions.initialData);
    renderFull(container);
  }

  function getCurrentResult() {
    return { state: currentState, result: currentResult, afa: currentAfa };
  }

  /**
   * Importiert ein DealPilot-Objekt und füllt das Formular vor.
   * Erwartetes Format (lose):
   *   { baujahr, objektTyp, kaufdatum, kaufpreis, grundstueckswert,
   *     adresse, einheit, wohnflaeche, eigentuemer, ... }
   */
  function loadObject(dealPilotObject) {
    if (!dealPilotObject) return;
    // Nutzt die zentrale Mapping-Funktion aus calc.js (V3)
    // Akzeptiert: {data: {...}}, [{data: {...}}], oder direktes Objekt
    let raw = dealPilotObject;
    if (Array.isArray(raw) && raw.length > 0) raw = raw[0];
    const initial = (typeof DealPilotRND.mapDealPilotObject === 'function')
      ? DealPilotRND.mapDealPilotObject(raw)
      : mapDealPilotLegacy(raw);
    if (!renderTarget) return;
    renderOptions.initialData = initial;
    currentState = buildInitialState(initial);
    renderFull(renderTarget);
  }

  // Fallback für ältere Objekte ohne rate_*-Felder
  function mapDealPilotLegacy(d) {
    return {
      baujahr: d.baujahr,
      stichtag: d.stichtag || d.kaufdatum || todayISO(),
      objektTyp: d.objektTyp || d.objekt_typ,
      gebaeudeanteil: d.gebaeudeanteil
        || ((d.kaufpreis || 0) - (d.grundstueckswert || 0)),
      objekt_adresse: d.adresse || d.objekt_adresse,
      objekt_einheit: d.einheit || d.objekt_einheit,
      wohnflaeche: d.wohnflaeche || d.wohnflache,
      auftraggeber_name: d.auftraggeber_name || d.eigentuemer
        || (d.kontakt && d.kontakt.name),
      eigentuemer_name: d.eigentuemer || d.auftraggeber_name,
      grenzsteuerMode: d.grenzsteuerMode || 'manual',
      zveAuto: d.zve_geschaetzt || 60000
    };
  }

  // ============================================================
  // STATE
  // ============================================================
  function buildInitialState(initial) {
    initial = initial || {};
    const stichtagJahr = new Date().getFullYear();
    const baujahr = Number(initial.baujahr) || stichtagJahr - 30;
    const objType = initial.objektTyp || 'mfh';
    const gndCategory = GND.suggestFromObjectType(objType);
    const defaultGnd = GND.getDefault(gndCategory);

    const gewerkeBewertung = {};
    RND.GEWERKE.forEach(function (g) {
      gewerkeBewertung[g.id] = 'standard';
    });

    return {
      // Basis
      baujahr: baujahr,
      stichtag: initial.stichtag || todayISO(),
      gndCategory: gndCategory,
      gnd: Number(initial.gnd) || defaultGnd,

      // Modernisierung
      modElements: initElementPoints(initial.modElements),

      // Technische Bewertung
      gewerkeBewertung: Object.assign({}, gewerkeBewertung, initial.gewerkeBewertung || {}),

      // Schäden
      schaeden: initial.schaeden || [],
      applySchadensAbschlag: initial.applySchadensAbschlag === true,

      // Gutachten-Override
      reelleRndOverride: initial.reelleRndOverride || null,

      // AfA
      gebaeudeanteil: Number(initial.gebaeudeanteil) || 200000,
      gutachterkosten: Number(initial.gutachterkosten) || 999,
      standardAfaSatz: Number(initial.standardAfaSatz) || 0.02,
      abzinsung: Number(initial.abzinsung) || 0.03,

      grenzsteuerMode: initial.grenzsteuerMode || 'manual',
      grenzsteuerManual: Number(initial.grenzsteuerManual) || 0.42,
      zveAuto: Number(initial.zveAuto) || 60000,

      // Gutachten-Metadaten (für PDF-Export)
      objekt_typ: initial.objekt_typ || mapTypLabel(objType),
      objekt_adresse: initial.objekt_adresse || '',
      objekt_einheit: initial.objekt_einheit || '',
      wohnflaeche: initial.wohnflaeche || '',
      bauweise: initial.bauweise || 'Massiv',
      energieklasse: initial.energieklasse || '',
      auftraggeber_name: initial.auftraggeber_name || '',
      auftraggeber_adresse: initial.auftraggeber_adresse || '',
      eigentuemer_name: initial.eigentuemer_name || '',
      eigentuemer_adresse: initial.eigentuemer_adresse || '',
      sv_name: initial.sv_name || '',

      // Erweiterte Gutachten-Metadaten (vom Wizard befüllt)
      besichtigungsdatum: initial.besichtigungsdatum || '',
      aktenzeichen: initial.aktenzeichen || '',
      unterkellerung: initial.unterkellerung || '',
      vollgeschosse: initial.vollgeschosse || '',
      einheiten_gesamt: initial.einheiten_gesamt || '',
      bedachung: initial.bedachung || '',
      fenster: initial.fenster || '',
      heizungsart: initial.heizungsart || '',
      anzahl_baeder: initial.anzahl_baeder || '1',
      besonderheiten: initial.besonderheiten || 'Keine',
      bel: initial.bel || 'Herkömmliche Fensterlüftung',
      brennstoff: initial.brennstoff || '',
      warmwasser: initial.warmwasser || '',
      erneuerbare: initial.erneuerbare || 'Keine',
      erschliessung: initial.erschliessung || 'erschlossen',
      // Modernisierungs-Texte (Klartext für die PDF-Tabelle in Kap. 2.2 e)
      mod_dach: initial.mod_dach || '',
      mod_fenster: initial.mod_fenster || '',
      mod_leitungen: initial.mod_leitungen || '',
      mod_heizung: initial.mod_heizung || '',
      mod_aussenwand: initial.mod_aussenwand || '',
      mod_baeder: initial.mod_baeder || '',
      mod_innenausbau: initial.mod_innenausbau || '',
      mod_technik: initial.mod_technik || '',
      mod_grundriss: initial.mod_grundriss || '',
      // Sachverständigen-Daten
      sv_titel: initial.sv_titel || '',
      sv_unternehmen: initial.sv_unternehmen || 'Junker Immobilien',
      sv_adresse_z1: initial.sv_adresse_z1 || 'Hermannstraße 9',
      sv_adresse_z2: initial.sv_adresse_z2 || '32609 Hüllhorst',
      sv_email: initial.sv_email || '',
      erstellungsort: initial.erstellungsort || 'Hüllhorst',
      erstellungsdatum: initial.erstellungsdatum || new Date().toLocaleDateString('de-DE')
    };
  }

  function mapTypLabel(t) {
    const map = {
      etw: 'Eigentumswohnung', mfh: 'Mehrfamilienhaus',
      efh: 'Einfamilienhaus', buero: 'Bürogebäude',
      hotel: 'Hotel'
    };
    return map[t] || 'Wohngebäude';
  }

  function initElementPoints(initial) {
    const out = {};
    RND.MOD_ELEMENTS.forEach(function (e) {
      out[e.id] = (initial && initial[e.id] != null) ? Number(initial[e.id]) : 0;
    });
    return out;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // ============================================================
  // PLAN GATE
  // ============================================================
  function renderPlanGate(container) {
    container.innerHTML = ''
      + '<div class="rnd-gate">'
      + '  <div class="rnd-gate-icon">🔒</div>'
      + '  <h3>Restnutzungsdauer-Analyse</h3>'
      + '  <p>Diese Funktion ist Teil des <strong>Pro</strong>- und <strong>Business</strong>-Plans.</p>'
      + '  <p class="rnd-gate-sub">Berechne nach 6 Verfahren und ermittle, ob ein Restnutzungs'
      + 'dauer-Gutachten nach § 7 Abs. 4 Satz 2 EStG für dein Objekt steuerlich lohnt.</p>'
      + '  <button class="rnd-btn rnd-btn-primary" data-act="upgrade">Auf Pro upgraden</button>'
      + '</div>';
    const btn = container.querySelector('[data-act="upgrade"]');
    if (btn) btn.addEventListener('click', function () {
      try {
        if (global.DealPilotConfig && global.DealPilotConfig.pricing
            && typeof global.DealPilotConfig.pricing.openUpgrade === 'function') {
          global.DealPilotConfig.pricing.openUpgrade('pro');
        } else {
          alert('Bitte im Settings unter "Plan" auf Pro wechseln.');
        }
      } catch (e) {
        alert('Bitte im Settings unter "Plan" auf Pro wechseln.');
      }
    });
  }

  // ============================================================
  // FULL UI
  // ============================================================
  function renderFull(container) {
    container.innerHTML = buildHTML();
    bindEvents(container);
    recalculate();
  }

  function buildHTML() {
    return ''
      + '<div class="rnd-root">'
      + buildHeader()
      + '<div class="rnd-grid">'
      +   '<div class="rnd-col rnd-col-input">'
      +     buildBasisCard()
      +     buildModCard()
      +     buildGewerkeCard()
      +     buildSchaedenCard()
      +     buildGutachtenMetaCard()
      +     buildAfaCard()
      +     buildOverrideCard()
      +   '</div>'
      +   '<div class="rnd-col rnd-col-result">'
      +     '<div id="rnd-results"></div>'
      +     buildExportCard()
      +   '</div>'
      + '</div>'
      + buildDisclaimer()
      + '</div>';
  }

  function buildHeader() {
    return ''
      + '<div class="rnd-header">'
      + '  <div>'
      + '    <h2>Restnutzungsdauer-Analyse</h2>'
      + '    <p class="rnd-sub">6 Verfahren · ImmoWertV / SW-RL · § 7 Abs. 4 Satz 2 EStG</p>'
      + '  </div>'
      + '  <span class="rnd-badge rnd-badge-pro">PRO</span>'
      + '</div>';
  }

  function buildBasisCard() {
    const gndOptions = GND.list().map(function (g) {
      return '<option value="' + g.id + '"' + (g.id === currentState.gndCategory ? ' selected' : '')
           + '>' + g.label + ' (' + g.gnd_default + ' J.)</option>';
    }).join('');

    return ''
      + '<div class="rnd-card">'
      + '  <h3>Objektdaten</h3>'
      + '  <div class="rnd-row">'
      + '    <label>Baujahr<input type="number" data-field="baujahr" value="' + currentState.baujahr
      +       '" min="1850" max="2050" /></label>'
      + '    <label>Bewertungsstichtag<input type="date" data-field="stichtag" value="'
      +       currentState.stichtag + '" /></label>'
      + '  </div>'
      + '  <div class="rnd-row">'
      + '    <label class="rnd-grow">Gebäudetyp<select data-field="gndCategory">'
      +       gndOptions + '</select></label>'
      + '    <label>GND (Jahre)<input type="number" data-field="gnd" value="' + currentState.gnd
      +       '" min="10" max="150" /></label>'
      + '  </div>'
      + '</div>';
  }

  function buildModCard() {
    let elementsHTML = '';
    RND.MOD_ELEMENTS.forEach(function (e) {
      const val = currentState.modElements[e.id] || 0;
      elementsHTML += ''
        + '<div class="rnd-mod-row">'
        + '  <span class="rnd-mod-label">' + e.label + '</span>'
        + '  <span class="rnd-mod-control">'
        + '    <input type="range" min="0" max="' + e.max + '" step="1" value="' + val
        +       '" data-mod="' + e.id + '" />'
        + '    <span class="rnd-mod-val" data-mod-val="' + e.id + '">' + val + '/' + e.max + '</span>'
        + '  </span>'
        + '</div>';
    });

    return ''
      + '<div class="rnd-card">'
      + '  <h3>Modernisierungspunkte (0–20)</h3>'
      + '  <p class="rnd-help">Punkte je Gewerk → höherer Modernisierungsgrad verlängert die '
      +    'RND nach Punktrastermethode.</p>'
      +    elementsHTML
      + '  <div class="rnd-mod-total">'
      + '    Gesamt: <strong id="rnd-mod-total-val">' + sumModPoints() + '/20</strong>'
      + '    <span id="rnd-mod-total-grad" class="rnd-pill"></span>'
      + '  </div>'
      + '</div>';
  }

  function buildGewerkeCard() {
    let rows = '';
    RND.GEWERKE.forEach(function (g) {
      const sel = currentState.gewerkeBewertung[g.id] || 'standard';
      rows += ''
        + '<div class="rnd-gewerk-row">'
        + '  <span class="rnd-gewerk-label">' + g.label + ' <span class="rnd-weight">('
        +    g.weight + '%)</span></span>'
        + '  <select data-gewerk="' + g.id + '">'
        + '    <option value="veraltet"' + (sel === 'veraltet' ? ' selected' : '')
        +       '>niedrig / veraltet</option>'
        + '    <option value="standard"' + (sel === 'standard' ? ' selected' : '')
        +       '>aktueller Standard</option>'
        + '    <option value="gehoben"'  + (sel === 'gehoben'  ? ' selected' : '')
        +       '>zukunftsorientiert / gehoben</option>'
        + '  </select>'
        + '</div>';
    });

    return ''
      + '<div class="rnd-card">'
      + '  <h3>Technische Bewertung der 9 Gewerke</h3>'
      + '  <p class="rnd-help">"Veraltet" verkürzt die technische RND deutlich, "gehoben" '
      +    'verlängert sie.</p>'
      +    rows
      + '</div>';
  }

  function buildSchaedenCard() {
    let rows = '';
    RND.SCHADEN_KATALOG.forEach(function (s) {
      const checked = currentState.schaeden.indexOf(s.id) >= 0
                   || currentState.schaeden.some(function (x) { return x && x.id === s.id; });
      rows += ''
        + '<label class="rnd-schaden-row">'
        + '  <input type="checkbox" data-schaden="' + s.id + '"' + (checked ? ' checked' : '') + ' />'
        + '  <span class="rnd-schaden-label">' + s.label + '</span>'
        + '  <span class="rnd-schaden-pct">−' + s.abschlag + '%</span>'
        + '</label>';
    });

    return ''
      + '<div class="rnd-card">'
      + '  <h3>Erfasste Mängel und Schäden</h3>'
      + '  <p class="rnd-help">Mängel werden im PDF-Gutachten erfasst. Toggle aktiviert '
      +    'optional einen prozentualen RND-Abschlag (Cap bei 50%).</p>'
      +    rows
      + '  <div class="rnd-toggle-group" style="margin-top:12px;">'
      + '    <span class="rnd-toggle-label">RND-Abschlag anwenden?</span>'
      + '    <button class="rnd-toggle' + (!currentState.applySchadensAbschlag ? ' is-active' : '')
      +       '" data-schaden-mode="off">Nein (nur erfassen)</button>'
      + '    <button class="rnd-toggle' + (currentState.applySchadensAbschlag ? ' is-active' : '')
      +       '" data-schaden-mode="on">Ja (Abschlag aktiv)</button>'
      + '  </div>'
      + '</div>';
  }

  function buildGutachtenMetaCard() {
    return ''
      + '<div class="rnd-card rnd-card-meta">'
      + '  <h3>Gutachten-Daten <span class="rnd-pill">für PDF-Export</span></h3>'
      + '  <p class="rnd-help">Diese Daten erscheinen im vollständigen Gutachten-PDF.</p>'
      + '  <div class="rnd-row">'
      + '    <label class="rnd-grow">Objekt-Typ (Klartext)<input type="text" data-field="objekt_typ" value="'
      +       esc(currentState.objekt_typ) + '" placeholder="z.B. Eigentumswohnung" /></label>'
      + '  </div>'
      + '  <div class="rnd-row">'
      + '    <label class="rnd-grow">Objekt-Adresse<input type="text" data-field="objekt_adresse" value="'
      +       esc(currentState.objekt_adresse) + '" placeholder="Straße, PLZ Ort" /></label>'
      + '  </div>'
      + '  <div class="rnd-row">'
      + '    <label class="rnd-grow">Einheit<input type="text" data-field="objekt_einheit" value="'
      +       esc(currentState.objekt_einheit) + '" placeholder="z.B. WE 03 / 3.OG links" /></label>'
      + '    <label>Wohnfläche (m²)<input type="number" data-field="wohnflaeche" value="'
      +       esc(currentState.wohnflaeche) + '" /></label>'
      + '  </div>'
      + '  <div class="rnd-row">'
      + '    <label class="rnd-grow">Auftraggeber (Name)<input type="text" data-field="auftraggeber_name" value="'
      +       esc(currentState.auftraggeber_name) + '" /></label>'
      + '  </div>'
      + '  <div class="rnd-row">'
      + '    <label class="rnd-grow">Auftraggeber-Adresse<input type="text" data-field="auftraggeber_adresse" value="'
      +       esc(currentState.auftraggeber_adresse) + '" /></label>'
      + '  </div>'
      + '  <div class="rnd-row">'
      + '    <label class="rnd-grow">Sachverständiger / Erstellt von<input type="text" data-field="sv_name" value="'
      +       esc(currentState.sv_name) + '" /></label>'
      + '  </div>'
      + '</div>';
  }

  function buildAfaCard() {
    const isAuto = currentState.grenzsteuerMode === 'auto';
    return ''
      + '<div class="rnd-card">'
      + '  <h3>AfA-Vergleich (Lohnt sich ein Gutachten?)</h3>'
      + '  <div class="rnd-row">'
      + '    <label>Gebäudeanteil (€)<input type="number" data-field="gebaeudeanteil" value="'
      +       currentState.gebaeudeanteil + '" min="0" step="1000" /></label>'
      + '    <label>Standard-AfA<select data-field="standardAfaSatz">'
      + '      <option value="0.02"'  + (currentState.standardAfaSatz === 0.02  ? ' selected' : '')
      +         '>2,0% (Standard)</option>'
      + '      <option value="0.025"' + (currentState.standardAfaSatz === 0.025 ? ' selected' : '')
      +         '>2,5% (Bestand vor 1925)</option>'
      + '      <option value="0.03"'  + (currentState.standardAfaSatz === 0.03  ? ' selected' : '')
      +         '>3,0% (Neubau ab 2023)</option>'
      + '    </select></label>'
      + '  </div>'
      + '  <div class="rnd-row">'
      + '    <label>Gutachterkosten (€)<input type="number" data-field="gutachterkosten" value="'
      +       currentState.gutachterkosten + '" min="0" step="50" /></label>'
      + '    <label>Diskontsatz<input type="number" data-field="abzinsung" value="'
      +       (currentState.abzinsung * 100) + '" min="0" max="10" step="0.5" /> %</label>'
      + '  </div>'
      + '  <div class="rnd-toggle-group">'
      + '    <span class="rnd-toggle-label">Grenzsteuersatz:</span>'
      + '    <button class="rnd-toggle' + (!isAuto ? ' is-active' : '')
      +       '" data-grenz-mode="manual">Manuell</button>'
      + '    <button class="rnd-toggle' + (isAuto ? ' is-active' : '')
      +       '" data-grenz-mode="auto">Auto (aus zvE)</button>'
      + '  </div>'
      + '  <div class="rnd-row">'
      + (isAuto
          ? '    <label class="rnd-grow">zvE (€)<input type="number" data-field="zveAuto" value="'
            + currentState.zveAuto + '" min="0" step="1000" /></label>'
            + '    <label>Grenzsteuer<input type="text" id="rnd-grenz-display" disabled value="'
            + (RND.estimateGrenzsteuersatz(currentState.zveAuto) * 100).toFixed(2) + '%" /></label>'
          : '    <label class="rnd-grow">Grenzsteuersatz<input type="number" '
            + 'data-field="grenzsteuerManual" value="' + (currentState.grenzsteuerManual * 100)
            + '" min="0" max="50" step="0.5" /> %</label>')
      + '  </div>'
      + '</div>';
  }

  function buildOverrideCard() {
    const v = currentState.reelleRndOverride || '';
    return ''
      + '<div class="rnd-card">'
      + '  <h3>Sachverständigen-Override (optional)</h3>'
      + '  <p class="rnd-help">Eine vom Sachverständigen abweichend festgelegte "reelle RND" '
      +    'überschreibt die Berechnung. Im Original-Gutachten ergibt sich daraus die finale RND.</p>'
      + '  <div class="rnd-row">'
      + '    <label class="rnd-grow">Reelle RND (Jahre)<input type="number" data-field="reelleRndOverride" '
      +       'value="' + v + '" min="0" step="0.5" placeholder="leer = berechneter Wert" /></label>'
      + '  </div>'
      + '</div>';
  }

  function buildExportCard() {
    // V185: PDF-Export entfernt — User darf das Gutachten nicht selbst herunterladen.
    // Stattdessen "Anfrage stellen" — RND-Daten + Objekt-JSON gehen als Mail an
    // info@junker-immobilien.io. Antwort/Gutachten kommt per Mail vom Sachverständigen.
    return ''
      + '<div class="rnd-card rnd-export-card">'
      + '  <h3>Restnutzungsdauer-Gutachten anfragen</h3>'
      + '  <p class="rnd-help" style="margin-bottom:12px;">Mit einem Klick gehen alle eingegebenen '
      +    'Daten an Junker Immobilien. Du erhältst nach Prüfung per Mail Rückmeldung mit '
      +    'einem Angebot für das offizielle Gutachten.</p>'
      + '  <button class="rnd-btn rnd-btn-primary" data-act="rnd-submit-request">'
      + '    ✉ Anfrage an Junker Immobilien senden'
      + '  </button>'
      + '  <div class="rnd-help" style="margin-top:10px;font-size:11px;color:#8c7a4a;">'
      +    '<strong>Datenversand:</strong> Übermittelt werden die Adresse, Bewertungs-Eingaben '
      +    'und das vollständige Objekt-Datenblatt (JSON) an '
      +    '<strong>info@junker-immobilien.io</strong>. Eine Kopie geht an deine '
      +    'hinterlegte E-Mail-Adresse.'
      + '  </div>'
      + '</div>';
  }

  function buildDisclaimer() {
    return ''
      + '<div class="rnd-disclaimer">'
      + '  <strong>§ 6 StBerG-Hinweis:</strong> Diese Berechnung dient ausschließlich der '
      + '  überschlägigen Investitionsbeurteilung und ersetzt weder eine steuerliche Beratung '
      + '  noch ein qualifiziertes Restnutzungsdauer-Gutachten. Die tatsächliche steuerliche '
      + '  Anerkennung einer kürzeren Restnutzungsdauer nach § 7 Abs. 4 Satz 2 EStG erfordert '
      + '  ein Gutachten eines fachkundigen Sachverständigen sowie die Würdigung durch das '
      + '  Finanzamt (BFH IX R 25/19, BFH IX R 48/11).'
      + '</div>';
  }

  // ============================================================
  // EVENTS
  // ============================================================
  function bindEvents(container) {
    container.querySelectorAll('[data-field]').forEach(function (el) {
      el.addEventListener('input', function () { onFieldChange(el); });
      el.addEventListener('change', function () { onFieldChange(el); });
    });
    container.querySelectorAll('[data-mod]').forEach(function (el) {
      el.addEventListener('input', function () { onModChange(el); });
    });
    container.querySelectorAll('[data-gewerk]').forEach(function (el) {
      el.addEventListener('change', function () { onGewerkChange(el); });
    });
    container.querySelectorAll('[data-schaden]').forEach(function (el) {
      el.addEventListener('change', function () { onSchadenChange(el); });
    });
    container.querySelectorAll('[data-grenz-mode]').forEach(function (el) {
      el.addEventListener('click', function () { onGrenzModeChange(el); });
    });
    container.querySelectorAll('[data-schaden-mode]').forEach(function (el) {
      el.addEventListener('click', function () { onSchadenModeChange(el); });
    });
    const exportBtn = container.querySelector('[data-act="export-full"]');
    if (exportBtn) exportBtn.addEventListener('click', onExportFull);
    // V185: Neuer „Anfrage stellen"-Button
    const submitBtn = container.querySelector('[data-act="rnd-submit-request"]');
    if (submitBtn) submitBtn.addEventListener('click', onSubmitRequest);
  }

  function onFieldChange(el) {
    const field = el.dataset.field;
    const val = el.value;

    if (field === 'gndCategory') {
      currentState.gndCategory = val;
      currentState.gnd = GND.getDefault(val);
      const gndInput = renderTarget.querySelector('[data-field="gnd"]');
      if (gndInput) gndInput.value = currentState.gnd;
    } else if (field === 'stichtag') {
      currentState.stichtag = val;
    } else if (field === 'standardAfaSatz') {
      currentState[field] = parseFloat(val);
    } else if (field === 'grenzsteuerManual' || field === 'abzinsung') {
      currentState[field] = parseFloat(val) / 100;
    } else if (field === 'reelleRndOverride') {
      currentState[field] = val ? parseFloat(val) : null;
    } else if (['objekt_typ', 'objekt_adresse', 'objekt_einheit', 'wohnflaeche',
                'auftraggeber_name', 'auftraggeber_adresse', 'eigentuemer_name',
                'eigentuemer_adresse', 'sv_name', 'bauweise'].indexOf(field) >= 0) {
      currentState[field] = val;
    } else {
      currentState[field] = parseFloat(val) || 0;
    }
    recalculate();
  }

  function onModChange(el) {
    const id = el.dataset.mod;
    const val = parseInt(el.value, 10);
    currentState.modElements[id] = val;
    const valEl = renderTarget.querySelector('[data-mod-val="' + id + '"]');
    if (valEl) {
      const max = RND.MOD_ELEMENTS.find(function (e) { return e.id === id; }).max;
      valEl.textContent = val + '/' + max;
    }
    recalculate();
  }

  function onGewerkChange(el) {
    currentState.gewerkeBewertung[el.dataset.gewerk] = el.value;
    recalculate();
  }

  function onSchadenChange(el) {
    const id = el.dataset.schaden;
    if (el.checked) {
      // hinzufügen wenn nicht vorhanden
      if (!currentState.schaeden.some(function (s) {
            return (typeof s === 'string' ? s : s && s.id) === id; })) {
        currentState.schaeden.push(id);
      }
    } else {
      currentState.schaeden = currentState.schaeden.filter(function (s) {
        return (typeof s === 'string' ? s : s && s.id) !== id;
      });
    }
    recalculate();
  }

  function onGrenzModeChange(el) {
    currentState.grenzsteuerMode = el.dataset.grenzMode;
    renderFull(renderTarget);
  }

  function onSchadenModeChange(el) {
    currentState.applySchadensAbschlag = (el.dataset.schadenMode === 'on');
    renderFull(renderTarget);
  }

  // V185: RND-Anfrage stellen — sendet alle Daten als Mail an info@junker-immobilien.io.
  // V186: Nutzt jetzt den dedizierten /api/v1/rnd-request-Endpoint (statt
  // /api/v1/deal-action/submit zu hijacken). Mailto-Fallback bei Backend-Fehler.
  function onSubmitRequest() {
    if (!currentResult) {
      alert('Bitte erst die Berechnung durchlaufen (alle Pflichtfelder ausfüllen).');
      return;
    }
    const submitBtn = renderTarget && renderTarget.querySelector('[data-act="rnd-submit-request"]');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sende…'; }

    // Vollständiges Objekt-JSON aus DealPilot
    const objSnapshot = (typeof global._currentObjData === 'object' && global._currentObjData)
      ? JSON.parse(JSON.stringify(global._currentObjData))
      : null;

    const payload = {
      typ: 'rnd_gutachten_anfrage',
      version: 'V189',
      timestamp: new Date().toISOString(),
      wizard_state: currentState || {},
      wizard_result: currentResult || {},
      wizard_afa: currentAfa || {},
      meta: {
        user_agent: navigator.userAgent,
        absender: (currentState && currentState.auftraggeber_name) || '',
        dealpilot_object: objSnapshot
      }
    };

    // Token aus localStorage holen
    const token = (function(){
      try { return localStorage.getItem('ji_token') || ''; } catch(e){ return ''; }
    })();

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    fetch('/api/v1/rnd-request', {
      method: 'POST',
      headers: headers,
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      if (submitBtn) { submitBtn.textContent = '✓ Anfrage gesendet'; submitBtn.style.background = '#3FA56C'; }
      _showRndSuccessModal(data && data.request_id);
    })
    .catch(function(err) {
      console.warn('[rnd-anfrage] Backend-Submit fehlgeschlagen, mailto-Fallback:', err.message);
      _showRndErrorFallback(payload, err);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✉ Anfrage an Junker Immobilien senden'; }
    });
  }

  function _showRndSuccessModal(requestId) {
    if (!renderTarget) return;
    const card = renderTarget.querySelector('.rnd-export-card');
    if (!card) return;
    card.innerHTML =
      '<div style="text-align:center;padding:20px 12px">' +
        '<div style="font-size:32px;color:#3FA56C;margin-bottom:8px">✓</div>' +
        '<h3 style="margin:0 0 6px;color:#3FA56C">Anfrage erfolgreich gesendet</h3>' +
        '<p style="color:#666;font-size:13px;line-height:1.5;margin:0">' +
          'Junker Immobilien wurde benachrichtigt. Du erhältst in Kürze eine Mail mit Rückmeldung.' +
          (requestId ? '<br><span style="color:#999;font-size:11px;font-family:monospace">Ref: ' + requestId + '</span>' : '') +
        '</p>' +
      '</div>';
  }

  function _showRndErrorFallback(payload, err) {
    if (!renderTarget) return;
    const card = renderTarget.querySelector('.rnd-export-card');
    if (!card) return;
    const errMsg = (err && err.message) || 'Unbekannter Fehler';
    card.innerHTML =
      '<div style="padding:16px 12px">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
          '<div style="width:36px;height:36px;background:#E8B84F;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;flex-shrink:0">!</div>' +
          '<div>' +
            '<h3 style="margin:0;color:#2A2727;font-size:15px;font-weight:600">Versand fehlgeschlagen</h3>' +
            '<p style="margin:2px 0 0;font-size:11px;color:#a04943;font-family:monospace">' + esc(errMsg) + '</p>' +
          '</div>' +
        '</div>' +
        '<p style="margin:0 0 14px;font-size:13px;color:#555;line-height:1.5">' +
          'Bitte versuchen Sie es in einem Moment erneut.' +
        '</p>' +
        '<div style="display:flex;gap:8px">' +
          '<button class="rnd-btn rnd-btn-primary" data-act="rnd-submit-request">↻ Erneut versuchen</button>' +
        '</div>' +
      '</div>';
    // Re-bind retry-Button
    const retry = card.querySelector('[data-act="rnd-submit-request"]');
    if (retry) retry.addEventListener('click', onSubmitRequest);
  }

  function onExportFull() {
    if (!currentResult) {
      alert('Bitte erst eine Berechnung durchführen.');
      return;
    }
    if (typeof global.jspdf === 'undefined' || !global.jspdf.jsPDF) {
      alert('jsPDF ist nicht geladen. Bitte jspdf.umd.min.js + jspdf.plugin.autotable.min.js einbinden.');
      return;
    }

    const gutachtenData = {
      objekt_typ: currentState.objekt_typ,
      objekt_adresse: currentState.objekt_adresse,
      objekt_einheit: currentState.objekt_einheit,
      wohnflaeche: currentState.wohnflaeche,
      bauweise: currentState.bauweise,
      stichtag: currentState.stichtag,
      besichtigungsdatum: currentState.besichtigungsdatum,
      aktenzeichen: currentState.aktenzeichen,
      unterkellerung: currentState.unterkellerung,
      vollgeschosse: currentState.vollgeschosse,
      einheiten_gesamt: currentState.einheiten_gesamt,
      bedachung: currentState.bedachung,
      fenster: currentState.fenster,
      heizungsart: currentState.heizungsart,
      anzahl_baeder: currentState.anzahl_baeder,
      besonderheiten: currentState.besonderheiten,
      bel: currentState.bel,
      brennstoff: currentState.brennstoff,
      warmwasser: currentState.warmwasser,
      erneuerbare: currentState.erneuerbare,
      energieklasse: currentState.energieklasse,
      erschliessung: currentState.erschliessung,
      auftraggeber_name: currentState.auftraggeber_name,
      auftraggeber_adresse: currentState.auftraggeber_adresse,
      eigentuemer_name: currentState.eigentuemer_name || currentState.auftraggeber_name,
      eigentuemer_adresse: currentState.eigentuemer_adresse || currentState.auftraggeber_adresse,
      sv_name: currentState.sv_name,
      sv_titel: currentState.sv_titel,
      sv_unternehmen: currentState.sv_unternehmen,
      sv_adresse_z1: currentState.sv_adresse_z1,
      sv_adresse_z2: currentState.sv_adresse_z2,
      sv_email: currentState.sv_email,
      erstellungsort: currentState.erstellungsort,
      erstellungsdatum: currentState.erstellungsdatum,
      // Modernisierungs-Texte: vorzugsweise Wizard-Text, sonst aus modElements ableiten
      mod_dach: currentState.mod_dach
                || (currentState.modElements.dach > 0
                    ? 'Modernisiert (' + currentState.modElements.dach + ' Punkt'
                      + (currentState.modElements.dach > 1 ? 'e' : '') + ')'
                    : 'Keine/Nie'),
      mod_fenster: currentState.mod_fenster
                || (currentState.modElements.fenster > 0
                    ? 'Modernisiert (' + currentState.modElements.fenster + ' Punkt'
                      + (currentState.modElements.fenster > 1 ? 'e' : '') + ')'
                    : 'Keine/Nie'),
      mod_leitungen: currentState.mod_leitungen
                || (currentState.modElements.leitungen > 0 ? 'Modernisiert' : 'Keine/Nie'),
      mod_heizung: currentState.mod_heizung
                || (currentState.modElements.heizung > 0 ? 'Modernisiert' : 'Keine/Nie'),
      mod_aussenwand: currentState.mod_aussenwand
                || (currentState.modElements.aussenwand > 0 ? 'Modernisiert' : 'Keine/Nie'),
      mod_baeder: currentState.mod_baeder
                || (currentState.modElements.baeder > 0 ? 'Modernisiert' : 'Keine/Nie'),
      mod_innenausbau: currentState.mod_innenausbau
                || (currentState.modElements.innenausbau > 0 ? 'Modernisiert' : 'Keine/Nie'),
      mod_technik: currentState.mod_technik || 'Keine/Nie',
      mod_grundriss: currentState.mod_grundriss
                || (currentState.modElements.grundriss > 0 ? 'Modernisiert' : 'Keine/Nie')
    };

    try {
      // gewerkeBewertung in gutachtenData injizieren — wird vom PDF für die X-Markierungen genutzt
      gutachtenData.__gewerkeBewertung = currentState.gewerkeBewertung;
      const doc = global.DealPilotRND_PDF.generateGutachten({
        gutachtenData: gutachtenData,
        result: currentResult,
        afa: currentAfa
      });
      const filename = 'Restnutzungsdauer-Gutachten_'
        + (currentState.objekt_adresse || 'Objekt').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)
        + '_' + new Date().toISOString().slice(0, 10) + '.pdf';
      doc.save(filename);
    } catch (e) {
      console.error('PDF-Export-Fehler:', e);
      alert('Fehler beim PDF-Export: ' + e.message);
    }
  }

  // ============================================================
  // RECALC
  // ============================================================
  function sumModPoints() {
    let s = 0;
    Object.keys(currentState.modElements).forEach(function (k) {
      s += Number(currentState.modElements[k]) || 0;
    });
    return Math.min(20, s);
  }

  function getEffectiveGrenzsteuersatz() {
    if (currentState.grenzsteuerMode === 'auto') {
      return RND.estimateGrenzsteuersatz(currentState.zveAuto);
    }
    return currentState.grenzsteuerManual;
  }

  function recalculate() {
    if (!currentState) return;

    const totalMod = sumModPoints();

    currentResult = RND.calcAll({
      baujahr: currentState.baujahr,
      stichtag: currentState.stichtag,
      gnd: currentState.gnd,
      modPoints: totalMod,
      gewerkeBewertung: currentState.gewerkeBewertung,
      schaeden: currentState.schaeden,
      applySchadensAbschlag: currentState.applySchadensAbschlag,
      reelleRND: currentState.reelleRndOverride
    });

    const grenz = getEffectiveGrenzsteuersatz();
    currentAfa = RND.calcAfaVergleich({
      gebaeudeanteil: currentState.gebaeudeanteil,
      rnd: currentResult.final_rnd,
      grenzsteuersatz: grenz,
      standardAfaSatz: currentState.standardAfaSatz,
      gutachterkosten: currentState.gutachterkosten,
      abzinsung: currentState.abzinsung
    });

    const totEl = renderTarget.querySelector('#rnd-mod-total-val');
    if (totEl) totEl.textContent = totalMod + '/20';
    const gradEl = renderTarget.querySelector('#rnd-mod-total-grad');
    if (gradEl) gradEl.textContent = RND.punkteToGrad(totalMod);

    const grenzDisp = renderTarget.querySelector('#rnd-grenz-display');
    if (grenzDisp) grenzDisp.value = (grenz * 100).toFixed(2) + '%';

    renderResults();

    if (typeof renderOptions.onRecalc === 'function') {
      try { renderOptions.onRecalc(currentResult, currentAfa); }
      catch (e) { console.error(e); }
    }
  }

  function renderResults() {
    const target = renderTarget.querySelector('#rnd-results');
    if (!target) return;
    const r = currentResult;
    const afa = currentAfa;
    // V187: Hero oben, dann sofort Vorteils-Tabelle (zeigt was sich rechnet),
    // dann Ampel-Card, Methoden-Tabelle, AfA-Detail.
    target.innerHTML = ''
      + buildHeroCard(r, afa)
      + buildVorteilsCard(afa)
      + buildAmpelCard(afa)
      + buildMethodsCard(r)
      + buildAfaDetailCard(afa);
  }

  // V187: Vorteils-Card direkt unter Hero — kompakte Übersicht
  // der Steuerersparnis und Gutachterkosten.
  function buildVorteilsCard(afa) {
    if (!afa || !afa.valid) return '';
    return ''
      + '<div class="rnd-vorteil-card">'
      + '  <h3>Was sich rechnet</h3>'
      + '  <table class="rnd-vorteil-table">'
      + '    <tr>'
      + '      <td>Mehr-AfA pro Jahr</td>'
      + '      <td>+' + fmtEUR(afa.mehr_afa_jahr) + '</td>'
      + '    </tr>'
      + '    <tr>'
      + '      <td>Steuerersparnis pro Jahr (' + afa.input.grenzsteuersatz_pct + ' % Grenzsteuer)</td>'
      + '      <td>' + fmtEUR(afa.steuerersparnis_jahr) + '</td>'
      + '    </tr>'
      + '    <tr class="rnd-vorteil-divider">'
      + '      <td>Barwert über ' + afa.input.rnd + ' Jahre (' + afa.input.abzinsung_pct + ' % Diskont)</td>'
      + '      <td>' + fmtEUR(afa.steuerersparnis_barwert) + '</td>'
      + '    </tr>'
      + '    <tr class="rnd-vorteil-cost">'
      + '      <td>− Gutachterkosten</td>'
      + '      <td>−' + fmtEUR(afa.gutachterkosten) + '</td>'
      + '    </tr>'
      + '    <tr class="rnd-vorteil-total">'
      + '      <td>Netto-Vorteil</td>'
      + '      <td>' + fmtEUR(afa.netto_vorteil) + '</td>'
      + '    </tr>'
      + '  </table>'
      + '</div>';
  }

  // V186: Schwarze Highlight-Box mit goldener Zahl — RND prominent darstellen.
  // Ersetzt die alte buildFinalCard mit der dezenten Variante.
  function buildHeroCard(r, afa) {
    const subText = r.final_source || 'Restnutzungsdauer nach DealPilot-Methodik';
    let kpisHtml = '';
    if (afa && afa.valid) {
      kpisHtml =
        '<div class="rnd-result-hero-kpis">' +
        '  <div class="rnd-result-hero-kpi">' +
        '    <div class="rnd-result-hero-kpi-label">Mehr-AfA / Jahr</div>' +
        '    <div class="rnd-result-hero-kpi-value">+' + fmtEUR(afa.mehr_afa_jahr) + '</div>' +
        '  </div>' +
        '  <div class="rnd-result-hero-kpi">' +
        '    <div class="rnd-result-hero-kpi-label">Steuerersparnis / Jahr</div>' +
        '    <div class="rnd-result-hero-kpi-value">' + fmtEUR(afa.steuerersparnis_jahr) + '</div>' +
        '  </div>' +
        '  <div class="rnd-result-hero-kpi">' +
        '    <div class="rnd-result-hero-kpi-label">Netto-Vorteil (Barwert)</div>' +
        '    <div class="rnd-result-hero-kpi-value">' + fmtEUR(afa.netto_vorteil) + '</div>' +
        '  </div>' +
        '</div>';
    }
    return ''
      + '<div class="rnd-result-hero">'
      + '  <p class="rnd-result-hero-label">Empfohlene Restnutzungsdauer</p>'
      + '  <h2 class="rnd-result-hero-value">' + r.final_rnd
      +     '<span class="rnd-result-hero-unit">Jahre</span></h2>'
      + '  <p class="rnd-result-hero-sub">' + esc(subText) + '</p>'
      +    kpisHtml
      + '</div>';
  }

  function buildFinalCard(r) {
    // V186: buildFinalCard ist deprecated zugunsten der Hero-Box.
    // Aufrufe sollten auf buildHeroCard umgestellt werden.
    return '';
  }

  function buildAmpelCard(afa) {
    if (!afa.valid) return '';
    const ampelClass = 'rnd-ampel-' + afa.ampel;
    return ''
      + '<div class="rnd-card rnd-ampel ' + ampelClass + '">'
      + '  <div class="rnd-ampel-icon">' + ampelIcon(afa.ampel) + '</div>'
      + '  <div class="rnd-ampel-body">'
      + '    <h3>' + (afa.ampel === 'gruen' ? 'Lohnt sich' :
                       afa.ampel === 'gelb' ? 'Grenzfall' : 'Lohnt sich nicht') + '</h3>'
      + '    <p>' + afa.empfehlung + '</p>'
      + '    <div class="rnd-ampel-stats">'
      + '      <div><span>Netto-Vorteil</span><strong>' + fmtEUR(afa.netto_vorteil) + '</strong></div>'
      + '      <div><span>ROI</span><strong>' + afa.roi_factor + '×</strong></div>'
      + '      <div><span>Steuerersp./Jahr</span><strong>' + fmtEUR(afa.steuerersparnis_jahr) + '</strong></div>'
      + '    </div>'
      + '  </div>'
      + '</div>';
  }

  function buildMethodsCard(r) {
    const m = r.methods;
    return ''
      + '<div class="rnd-card">'
      + '  <h3>Alle 6 Verfahren im Vergleich</h3>'
      + '  <table class="rnd-methods-table">'
      + '    <thead><tr><th>Verfahren</th><th>RND</th><th>AWM %</th></tr></thead>'
      + '    <tbody>'
      + buildMethodRow('Linear', m.linear)
      + buildMethodRow('Vogels', m.vogels)
      + buildMethodRow('Ross (historisch)', m.ross)
      + buildMethodRow('Parabel', m.parabel)
      + buildMethodRow('Punktraster', m.punktraster)
      + buildMethodRow('Technisch (vorrangig)', m.technisch, true)
      + '    </tbody>'
      + '  </table>'
      + '  <p class="rnd-help">Alter: ' + r.input.alter + ' Jahre · GND: ' + r.input.gnd
      +    ' Jahre · Modernisierungspunkte: ' + r.input.modPoints + '</p>'
      + '</div>';
  }

  function buildMethodRow(label, m, isPrimary) {
    return ''
      + '<tr' + (isPrimary ? ' class="rnd-primary-row"' : '') + '>'
      + '  <td>' + label + '</td>'
      + '  <td><strong>' + m.restnutzungsdauer + ' J.</strong></td>'
      + '  <td>' + m.alterswertminderung_pct + '%</td>'
      + '</tr>';
  }

  function buildAfaDetailCard(afa) {
    if (!afa.valid) return '';
    return ''
      + '<div class="rnd-card">'
      + '  <h3>AfA-Vergleich im Detail</h3>'
      + '  <table class="rnd-afa-table">'
      + '    <tr><td>Standard-AfA (' + afa.afa_standard.satz_pct + '%)</td>'
      +      '<td>' + fmtEUR(afa.afa_standard.jahresbetrag) + '/Jahr</td></tr>'
      + '    <tr><td>RND-AfA (' + afa.afa_kurz.satz_pct + '%)</td>'
      +      '<td>' + fmtEUR(afa.afa_kurz.jahresbetrag) + '/Jahr</td></tr>'
      + '    <tr class="rnd-afa-diff"><td>Mehr-AfA pro Jahr</td>'
      +      '<td><strong>+' + fmtEUR(afa.mehr_afa_jahr) + '</strong></td></tr>'
      + '    <tr><td>Steuerersparnis pro Jahr (' + afa.input.grenzsteuersatz_pct + '% Grenz)</td>'
      +      '<td>' + fmtEUR(afa.steuerersparnis_jahr) + '</td></tr>'
      + '    <tr><td>Barwert über ' + afa.input.rnd + ' Jahre ('
      +      afa.input.abzinsung_pct + '% Diskont)</td>'
      +      '<td>' + fmtEUR(afa.steuerersparnis_barwert) + '</td></tr>'
      + '    <tr><td>− Gutachterkosten</td>'
      +      '<td>−' + fmtEUR(afa.gutachterkosten) + '</td></tr>'
      + '    <tr class="rnd-afa-total"><td><strong>Netto-Vorteil</strong></td>'
      +      '<td><strong>' + fmtEUR(afa.netto_vorteil) + '</strong></td></tr>'
      + '  </table>'
      + '</div>';
  }

  // HELPERS
  function fmtEUR(n) {
    if (typeof n !== 'number' || !isFinite(n)) return '–';
    return n.toLocaleString('de-DE', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    });
  }
  function ampelIcon(a) {
    if (a === 'gruen') return '✓';
    if (a === 'gelb') return '!';
    return '✗';
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  global.DealPilotRND_UI = {
    render: render,
    getCurrentResult: getCurrentResult,
    loadObject: loadObject
  };
})(typeof window !== 'undefined' ? window : globalThis);
