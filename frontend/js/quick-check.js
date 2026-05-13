'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   DealPilot V41 — Quick Check (komplett neu)

   Änderungen V41:
   - EINE zentrale "✨ Mit KI ausfüllen"-Aktion statt 3 Pro-Sektion-Buttons
   - Score-Visualisierung wie DS2 (Donut + 5 Mini-Bars)
   - Bilder-Upload (max 6) + automatisch aus PDF-Import
   - Bewirtschaftung: umlagefähig + nicht-umlagefähig (statt Instandhaltung+Verwaltung)
   - Quellen-Anzeige mit klickbarem Link
═══════════════════════════════════════════════════════════════════════════ */

(function() {

  var _qcImgs = [];

  // V197: PLZ-Bereiche → Bundesland-Mapping (vereinfacht, gängige Bereiche)
  // Quelle: Deutsche Post PLZ-Leitzonen-Konvention
  function _qcPlzToBundesland(plz) {
    if (!plz || !/^\d{5}$/.test(plz)) return null;
    var p = parseInt(plz, 10);
    // 01xxx-09xxx: SAC (Sachsen) — 01000-09999
    if (p <= 9999) return 'SAC';
    // 10xxx-14xxx: BLN (Berlin) + BRB
    if (p <= 14999) {
      if (p < 12000) return 'BLN';
      if (p < 13000) return 'BLN';
      if (p < 14000) return 'BLN';
      return 'BRB'; // 14xxx ist meist Brandenburg
    }
    // 15xxx-16xxx: BRB
    if (p <= 16999) return 'BRB';
    // 17xxx-19xxx: MVP (Mecklenburg-Vorpommern) — 17000-19999
    if (p <= 19999) return 'MVP';
    // 20xxx-22xxx: HAM (Hamburg) — 20000-22999
    if (p <= 22999) return 'HAM';
    // 23xxx-24xxx: SHL (Schleswig-Holstein)
    if (p <= 24999) return 'SHL';
    // 25xxx: SHL
    if (p <= 25999) return 'SHL';
    // 26xxx-29xxx: NDS (Niedersachsen) inkl. Bremen-Umland — 26000-29999
    if (p <= 29999) {
      // 28xxx ist Bremen
      if (p >= 28000 && p <= 28999) return 'BRE';
      return 'NDS';
    }
    // 30xxx-31xxx: NDS — 30000-31999
    if (p <= 31999) return 'NDS';
    // 32xxx-33xxx: NRW (Ostwestfalen-Lippe) — 32000-33999
    if (p <= 33999) return 'NRW';
    // 34xxx: HES (Nordhessen) — 34000-34999
    if (p <= 34999) return 'HES';
    // 35xxx: HES — 35000-35999
    if (p <= 35999) return 'HES';
    // 36xxx: HES/THÜ
    if (p <= 36999) return p < 36400 ? 'HES' : 'THÜ';
    // 37xxx-38xxx: NDS — 37000-38999
    if (p <= 38999) return 'NDS';
    // 39xxx: SAH (Sachsen-Anhalt) — 39000-39999
    if (p <= 39999) return 'SAH';
    // 40xxx-48xxx: NRW — 40000-48999
    if (p <= 48999) return 'NRW';
    // 49xxx: NDS
    if (p <= 49999) return 'NDS';
    // 50xxx-53xxx: NRW (Köln/Bonn) — 50000-53999
    if (p <= 53999) return 'NRW';
    // 54xxx: RLP — 54000-54999
    if (p <= 54999) return 'RLP';
    // 55xxx-56xxx: RLP
    if (p <= 56999) return 'RLP';
    // 57xxx: NRW (Siegen) — meistens NRW
    if (p <= 57999) return 'NRW';
    // 58xxx-59xxx: NRW
    if (p <= 59999) return 'NRW';
    // 60xxx-65xxx: HES (Frankfurt) — 60000-65999
    if (p <= 65999) return 'HES';
    // 66xxx: SLD (Saarland) + RLP
    if (p <= 66999) return p < 66500 ? 'SLD' : 'RLP';
    // 67xxx: RLP
    if (p <= 67999) return 'RLP';
    // 68xxx-69xxx: BAW (Baden-Württemberg) — 68000-69999
    if (p <= 69999) return 'BAW';
    // 70xxx-89xxx: BAW (Stuttgart) — 70000-79999 + BAY ab 80000
    if (p <= 79999) return 'BAW';
    // 80xxx-87xxx: BAY (Bayern)
    if (p <= 87999) return 'BAY';
    // 88xxx: BAW
    if (p <= 88999) return 'BAW';
    // 89xxx: BAW oder BAY (Ulm)
    if (p <= 89999) return 'BAW';
    // 90xxx-96xxx: BAY (Nürnberg, Bamberg)
    if (p <= 96999) return 'BAY';
    // 97xxx: BAY (Würzburg)
    if (p <= 97999) return 'BAY';
    // 98xxx-99xxx: THÜ (Thüringen)
    if (p <= 99999) return 'THÜ';
    return null;
  }

  // V197: Grunderwerbsteuer-Sätze nach Bundesland (Stand 2025)
  // Quelle: Finanzministerien der Länder
  var _qcGrEStByLand = {
    'BAW': 5.0,   // Baden-Württemberg
    'BAY': 3.5,   // Bayern (niedrigster Satz)
    'BLN': 6.0,   // Berlin
    'BRB': 6.5,   // Brandenburg
    'BRE': 5.0,   // Bremen
    'HAM': 5.5,   // Hamburg
    'HES': 6.0,   // Hessen
    'MVP': 6.0,   // Mecklenburg-Vorpommern
    'NDS': 5.0,   // Niedersachsen
    'NRW': 6.5,   // Nordrhein-Westfalen (höchster Satz)
    'RLP': 5.0,   // Rheinland-Pfalz
    'SAA': 6.5,   // Saarland — Fix Code 'SLD' unten
    'SLD': 6.5,   // Saarland (alternativer Code)
    'SAC': 5.5,   // Sachsen
    'SAH': 5.0,   // Sachsen-Anhalt
    'SHL': 6.5,   // Schleswig-Holstein
    'THÜ': 6.5    // Thüringen
  };

  // V197: KNK aus PLZ ermitteln — GrESt + Notar/Grundbuch (~1,5-2%) + Makler (~3,57%)
  function _qcKnkFromPlz(plz) {
    var land = _qcPlzToBundesland(plz);
    if (!land) return null;
    var grest = _qcGrEStByLand[land];
    if (typeof grest !== 'number') return null;
    var notar = 1.5;  // Notar + Grundbuch ~1,5%
    // Makler aus User-Settings holen, sonst default 3,57% (üblich Käuferanteil bei geteilten Provisionen)
    var makler = 3.57;
    try {
      var s = JSON.parse(localStorage.getItem('dp_user_settings') || '{}');
      if (s && typeof s.makler_kaufer_pct === 'number') makler = s.makler_kaufer_pct;
    } catch(e) {}
    return grest + notar + makler;
  }

  // V202: Save-Button-State updaten basierend auf Pflichtfeld-Liste
  function _updateQcSaveButton(missing) {
    var saveBtn = document.getElementById('qc-save-btn');
    if (!saveBtn) return;
    if (missing && missing.length > 0) {
      saveBtn.disabled = true;
      saveBtn.title = 'Pflichtfelder fehlen: ' + missing.join(', ');
      saveBtn.style.opacity = '0.5';
      saveBtn.style.cursor = 'not-allowed';
    } else {
      saveBtn.disabled = false;
      saveBtn.title = '';
      saveBtn.style.opacity = '';
      saveBtn.style.cursor = '';
    }
  }


  function showQuickCheck() {
    // V53: Statt Modal-Overlay rendern wir direkt in den Quick-Check-Tab.
    // _qcImgs nur leeren wenn der Tab gerade frisch geöffnet wird (nicht bei Re-Render)
    var hostId = 'qc-tab-host';
    var host = document.getElementById(hostId);
    if (!host) {
      // Tab existiert nicht? Fallback: alte Modal-Variante
      var existing = document.getElementById('qc-modal');
      if (existing) existing.remove();
    } else {
      // Bei erneutem Render NICHT _qcImgs leeren — bleibt erhalten
      if (host.dataset.rendered !== '1') {
        _qcImgs = [];
      }
    }

    var inner =
        // Kein Header mit Schließen-Button mehr — das ist ein Tab, kein Modal.
        // Statt-dessen: kompakter Header mit Icon + Subline.
        '<div class="qc-tab-header">' +
          '<span class="qc-tab-icon" data-ico="zap" data-ico-size="28"></span>' +
          '<div class="qc-tab-title-block">' +
            '<h2 class="sec-title" style="margin:0">Quick-Check</h2>' +
            '<div class="qc-sub">Schnellbewertung mit den wichtigsten Werten — Live-Score wie der Investor Deal Score. PDF-Import + KI-Ausfüllen integriert.</div>' +
          '</div>' +
        '</div>' +

        '<div class="qc-body qc-body-tab">' +

          '<div class="qc-form">' +

            // V196: "Von URL laden" entfernt (Marcels Wunsch — funktioniert nicht
            // zuverlässig). PDF-Import bleibt mit OCR-Fallback (siehe pdf-import.js).
            '<div class="qc-top-actions">' +
              '<button type="button" class="btn btn-outline" onclick="qcImportPdfTrigger()" title="Exposé als PDF importieren (mit OCR-Fallback bei gescannten PDFs)">' +
                '📄 PDF importieren' +
              '</button>' +
              // V197: KI-Recherche-Button direkt daneben
              '<button type="button" class="btn btn-gold" onclick="qcAiResearchInfo()" id="qc-ai-research-btn" title="KI recherchiert Marktmiete, Bodenrichtwert, Lage-Score">' +
                '✨ Werte mit KI recherchieren' +
              '</button>' +
            '</div>' +
            // V197: KI-Info-Box (initial versteckt, wird nach Recherche ausgeklappt)
            '<div id="qc-ai-info-box" class="qc-ai-info-box" style="display:none">' +
              '<div class="qc-ai-info-header">' +
                '<span class="qc-ai-info-title">✨ KI-Recherche Ergebnis</span>' +
                '<button type="button" class="qc-ai-info-close" onclick="qcCloseAiInfo()">×</button>' +
              '</div>' +
              '<div id="qc-ai-info-content"></div>' +
              '<div class="qc-ai-disclaimer">' +
                '<strong>Hinweis:</strong> KI-Werte sind Schätzungen aus öffentlichen Quellen. ' +
                'Bei niedrigem Konfidenz-Score ggf. manuell prüfen.' +
              '</div>' +
            '</div>' +

            // V197: Adresse aufgesplittet — Straße/HNR + PLZ + Ort separat
            '<div class="qc-section">' +
              '<div class="qc-section-title">Adresse</div>' +
              '<div class="qc-row qc-row-adr">' +
                '<div class="qc-field" style="flex:3">' +
                  '<label>Straße</label>' +
                  '<input type="text" id="qc_str" placeholder="z.B. Dresdenstraße" oninput="qcCalc()">' +
                '</div>' +
                '<div class="qc-field" style="flex:1">' +
                  '<label>Hausnr.</label>' +
                  '<input type="text" id="qc_hnr" placeholder="116" oninput="qcCalc()">' +
                '</div>' +
              '</div>' +
              '<div class="qc-row qc-row-adr">' +
                '<div class="qc-field" style="flex:1">' +
                  '<label class="qc-required">PLZ</label>' +
                  '<input type="text" inputmode="numeric" id="qc_plz" placeholder="32052" maxlength="5" oninput="qcCalc()">' +
                '</div>' +
                '<div class="qc-field" style="flex:3">' +
                  '<label class="qc-required">Ort</label>' +
                  '<input type="text" id="qc_ort" placeholder="Herford" oninput="qcCalc()">' +
                '</div>' +
              '</div>' +
              // Versteckter Combined-Adresse-Input für Backward-Compat
              '<input type="hidden" id="qc_adresse">' +
            '</div>' +

            '<div class="qc-row qc-row-3">' +
              '<div class="qc-field">' +
                '<label class="qc-required">Wohnfläche (m²)</label>' +
                '<input type="text" inputmode="decimal" id="qc_wfl" placeholder="96" oninput="qcCalc()">' +
              '</div>' +
              '<div class="qc-field">' +
                '<label>Baujahr</label>' +
                '<input type="text" inputmode="numeric" id="qc_bj" placeholder="1997" oninput="qcCalc()">' +
              '</div>' +
              '<div class="qc-field">' +
                '<label>Zimmer</label>' +
                '<input type="text" inputmode="decimal" id="qc_zimmer" placeholder="2" oninput="qcCalc()">' +
              '</div>' +
            '</div>' +

            // V54: Optionale Eigenschaften (aus PDF-Import befüllbar)
            '<details class="qc-optional-block" id="qc-optional-block">' +
              '<summary>+ Weitere Eigenschaften (optional)</summary>' +
              '<div class="qc-row qc-row-2">' +
                '<div class="qc-field">' +
                  '<label>Objektart</label>' +
                  '<select id="qc_objektart" onchange="qcCalc()">' +
                    '<option value="">– bitte wählen –</option>' +
                    '<option value="ETW">Eigentumswohnung</option>' +
                    '<option value="EFH">Einfamilienhaus</option>' +
                    '<option value="MFH">Mehrfamilienhaus</option>' +
                    '<option value="DHH">Doppelhaushälfte</option>' +
                    '<option value="RH">Reihenhaus</option>' +
                    '<option value="Gewerbe">Gewerbe</option>' +
                  '</select>' +
                '</div>' +
                '<div class="qc-field">' +
                  '<label>Energieklasse</label>' +
                  '<select id="qc_energieklasse" onchange="qcCalc()">' +
                    '<option value="">– keine Angabe –</option>' +
                    '<option>A+</option><option>A</option><option>B</option><option>C</option>' +
                    '<option>D</option><option>E</option><option>F</option><option>G</option><option>H</option>' +
                  '</select>' +
                '</div>' +
              '</div>' +
              '<div class="qc-row qc-row-2">' +
                '<div class="qc-field">' +
                  '<label>Stellplatz</label>' +
                  '<input type="text" id="qc_stellplatz" placeholder="z.B. Tiefgarage / Außenstellplatz" oninput="qcCalc()">' +
                '</div>' +
                // V63.8: "Eigenkapital-Anteil aus Exposé" Feld ENTFERNT (User-Wunsch)
              '</div>' +
            '</details>' +

            '<div class="qc-section">' +
              '<div class="qc-section-title">Kaufpreis</div>' +
              '<div class="qc-row qc-row-2">' +
                '<div class="qc-field">' +
                  '<label class="qc-required">Kaufpreis (€)</label>' +
                  '<input type="text" inputmode="decimal" id="qc_kp" placeholder="180000" oninput="qcCalc()">' +
                '</div>' +
                '<div class="qc-field">' +
                  '<label>Kaufnebenkosten (%)</label>' +
                  '<input type="text" inputmode="decimal" id="qc_knk" value="10,5" placeholder="10,5" oninput="qcCalc()">' +
                  '<span class="qc-hint">Notar + GrESt + Makler — Default 10,5%</span>' +
                '</div>' +
              '</div>' +
            '</div>' +

            // V197: KI-Button verschoben nach oben neben PDF-Import.
            // Der alte qcAiFillAll-Pfad bleibt funktional erreichbar.

            '<div class="qc-section">' +
              '<div class="qc-section-title">Mieteinnahmen / Monat</div>' +
              // V63.24: Strukturierte Einnahmen — Grundmiete + Stellplatz/Garage + Küche + Sonstige
              '<div class="qc-row qc-row-2">' +
                '<div class="qc-field">' +
                  '<label>Grundmiete (€)</label>' +
                  '<input type="text" inputmode="decimal" id="qc_nkm_grund" placeholder="780" oninput="qcMieteAddUp()">' +
                  '<span class="qc-hint">Reine Kaltmiete der Wohnung — optional, falls aufgeschlüsselt</span>' +
                '</div>' +
                '<div class="qc-field">' +
                  '<label>Stellplatz / Garage (€)</label>' +
                  '<input type="text" inputmode="decimal" id="qc_nkm_stp" placeholder="0" oninput="qcMieteAddUp()">' +
                  '<span class="qc-hint">Stellplatz oder Garage zusammen</span>' +
                '</div>' +
              '</div>' +
              '<div class="qc-row qc-row-2">' +
                '<div class="qc-field">' +
                  '<label>Küche (€)</label>' +
                  '<input type="text" inputmode="decimal" id="qc_nkm_kueche" placeholder="0" oninput="qcMieteAddUp()">' +
                  '<span class="qc-hint">z.B. Einbauküche-Zuschlag</span>' +
                '</div>' +
                '<div class="qc-field">' +
                  '<label>Sonstige (€)</label>' +
                  '<input type="text" inputmode="decimal" id="qc_nkm_sonst" placeholder="0" oninput="qcMieteAddUp()">' +
                  '<span class="qc-hint">z.B. Werbeflächen, Antenne</span>' +
                '</div>' +
              '</div>' +
              // qc_nkm_garage als verstecktes Feld (für Backwards-Compat des PDF-Imports)
              '<input type="hidden" id="qc_nkm_garage" value="0">' +
              '<div class="qc-field">' +
                '<label class="qc-required">Nettokaltmiete gesamt / Monat (€) <span class="qc-hint qc-hint-inline">— wird automatisch summiert</span></label>' +
                '<input type="text" inputmode="decimal" id="qc_nkm" placeholder="850" oninput="qcCalc()">' +
              '</div>' +
            '</div>' +

            '<div class="qc-section">' +
              '<div class="qc-section-title">Bewirtschaftungskosten</div>' +
              '<p class="qc-hint" style="margin:0 0 10px">Hausgeld vom Verwalter, davon ein Teil nicht-umlagefähig (Rücklage + Verwaltung).</p>' +

              // V207: Modi-Picker raus. Eine Logik:
              //   Hausgeld €/Mon + NUL-Split % vom HG (UL = Rest)
              //   Bezugsgröße für UI immer: vom HAUSGELD
              '<input type="hidden" id="qc_bewirt_mode" value="hg">' +

              '<div class="qc-row qc-row-2">' +
                '<div class="qc-field">' +
                  '<label class="qc-required">Hausgeld / Monat (€)</label>' +
                  '<input type="text" inputmode="decimal" id="qc_hg" placeholder="221" oninput="qcCalc()">' +
                  '<span class="qc-hint">Inkl. Heizung + Rücklagen — wie auf Exposé. Faustregel: 26% der NKM/Mo · KI füllt automatisch.</span>' +
                '</div>' +
                '<div class="qc-field">' +
                  '<label class="qc-required">Nicht-umlagefähig (% vom HG)</label>' +
                  '<input type="text" inputmode="decimal" id="qc_hg_split" value="22" placeholder="22" oninput="qcCalc()">' +
                  '<span class="qc-hint">üblich 12-30%, Faustregel 22%. Rest wird auf Mieter umgelegt.</span>' +
                '</div>' +
              '</div>' +

              // Live-Anzeige: aus den 2 Feldern berechnete Aufschlüsselung
              '<div class="qc-bewirt-derived" id="qc-bewirt-derived" style="margin-top:8px;padding:8px 12px;background:#F8F6F1;border-radius:6px;font-size:12px;color:#6B6764">' +
                '<span id="qc-bewirt-derived-text">Tragen Sie Hausgeld und NUL-Anteil ein …</span>' +
              '</div>' +
            '</div>' +

            '<div class="qc-section">' +
              '<div class="qc-section-title">Finanzierung</div>' +
              '<div class="qc-ltv-row">' +
                '<span class="qc-ltv-l">Beleihung (LTV):</span>' +
                '<button type="button" class="qc-ltv-btn active" data-ltv="100" onclick="qcSetLtv(100)" title="100% Finanzierung (Standard)">100%</button>' +
                '<button type="button" class="qc-ltv-btn" data-ltv="95" onclick="qcSetLtv(95)">95%</button>' +
                '<button type="button" class="qc-ltv-btn" data-ltv="90" onclick="qcSetLtv(90)">90%</button>' +
                '<button type="button" class="qc-ltv-btn" data-ltv="85" onclick="qcSetLtv(85)">85%</button>' +
                '<button type="button" class="qc-ltv-btn" data-ltv="80" onclick="qcSetLtv(80)">80%</button>' +
              '</div>' +
              '<div class="qc-row qc-row-3">' +
                '<div class="qc-field">' +
                  '<label class="qc-required">Eigenkapital (€)</label>' +
                  '<input type="text" inputmode="decimal" id="qc_ek" placeholder="20000" oninput="qcEkChanged()">' +
                  '<span class="qc-hint" id="qc-ek-hint">~ 10% des Kaufpreises + NK</span>' +
                '</div>' +
                '<div class="qc-field">' +
                  '<label class="qc-required">Zinssatz (%)</label>' +
                  '<input type="text" inputmode="decimal" id="qc_zins" value="3,8" placeholder="3,8" oninput="qcCalc()">' +
                '</div>' +
                '<div class="qc-field">' +
                  '<label class="qc-required">Tilgung (%)</label>' +
                  '<input type="text" inputmode="decimal" id="qc_tilg" value="1,5" placeholder="1,5" oninput="qcCalc()">' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="qc-section">' +
              '<div class="qc-section-title">Objektfotos (optional, max 6)</div>' +
              '<div class="qc-photos-drop" id="qc-photos-drop" onclick="document.getElementById(\'qc-photos-inp\').click()">' +
                '<input type="file" id="qc-photos-inp" accept="image/*" multiple style="display:none" onchange="qcHandlePhotos(this.files)">' +
                '<div class="qc-photos-drop-l">📷 Fotos hochladen oder hierher ziehen</div>' +
              '</div>' +
              '<div class="qc-photos-grid" id="qc-photos-grid"></div>' +
              '<p class="qc-hint" style="margin-top:6px">Werden beim "Als Objekt speichern" mit übernommen.</p>' +
            '</div>' +
          '</div>' +

          '<div class="qc-result" id="qc-result">' +
            // V44: Layout 1:1 wie Investor Deal Score in Kennzahlen
            '<div class="ds-mockup ds2-mockup qc-ds-mockup">' +
              '<div class="ds-top">' +
                '<div class="ds-brand">' +
                  '<div class="ds-brand-name">Quick <span class="ds-brand-accent">Check Score</span></div>' +
                '</div>' +
                '<div class="ds-top-deal ds2-explanation" id="qc-top-deal">' +
                  '<div class="ds-top-deal-icon" id="qc-top-deal-icon"></div>' +
                  '<div class="ds-top-deal-text">' +
                    '<div class="ds-top-deal-label" id="qc-score-tag" style="color:rgba(255,255,255,0.55)">DATEN EINGEBEN</div>' +
                    '<div class="ds-top-deal-desc" id="qc-top-deal-desc">Sobald Adresse, Kaufpreis, Wohnfläche und Nettokaltmiete eingetragen sind, siehst du eine erste Bewertung.</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +

              '<div class="ds-middle">' +
                '<div class="ds-donut-wrap">' +
                  '<svg class="ds-donut" viewBox="0 0 120 120" id="qc-score-circle">' +
                    '<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>' +
                    '<circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-dasharray="0 327" transform="rotate(-90 60 60)" id="qc-score-ring" style="transition:stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)"/>' +
                  '</svg>' +
                  '<div class="ds-donut-text">' +
                    '<div class="ds-donut-score" id="qc-score-value">–</div>' +
                    '<div class="ds-donut-max">/ 100</div>' +
                  '</div>' +
                  '<div class="ds-donut-pill" id="qc-score-pill" style="display:none">–</div>' +
                '</div>' +

                '<div class="ds-metrics ds2-metrics" id="qc-cats-grid">' +
                  '<div class="ds2-metric qc-cat-bar" id="qc-cat-rendite">' +
                    '<div class="ds2-metric-icon" data-qc-icon="trendingUp" style="color:#9C9C9C;border-color:#9C9C9C40"></div>' +
                    '<div class="ds2-metric-body">' +
                      '<div class="ds2-metric-head">' +
                        '<span class="ds2-metric-label qc-cat-l">Rendite</span>' +
                        '<span class="ds2-metric-score qc-cat-v">– / 100</span>' +
                      '</div>' +
                      '<div class="ds2-metric-bar"><div class="ds2-metric-bar-fill qc-cat-bar-fill" style="width:0%"></div></div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="ds2-metric qc-cat-bar" id="qc-cat-cashflow">' +
                    '<div class="ds2-metric-icon" data-qc-icon="trendingUp" style="color:#9C9C9C;border-color:#9C9C9C40"></div>' +
                    '<div class="ds2-metric-body">' +
                      '<div class="ds2-metric-head">' +
                        '<span class="ds2-metric-label qc-cat-l">Cashflow</span>' +
                        '<span class="ds2-metric-score qc-cat-v">– / 100</span>' +
                      '</div>' +
                      '<div class="ds2-metric-bar"><div class="ds2-metric-bar-fill qc-cat-bar-fill" style="width:0%"></div></div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="ds2-metric qc-cat-bar" id="qc-cat-sicherheit">' +
                    '<div class="ds2-metric-icon" data-qc-icon="shield" style="color:#9C9C9C;border-color:#9C9C9C40"></div>' +
                    '<div class="ds2-metric-body">' +
                      '<div class="ds2-metric-head">' +
                        '<span class="ds2-metric-label qc-cat-l">Sicherheit</span>' +
                        '<span class="ds2-metric-score qc-cat-v">– / 100</span>' +
                      '</div>' +
                      '<div class="ds2-metric-bar"><div class="ds2-metric-bar-fill qc-cat-bar-fill" style="width:0%"></div></div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="ds2-metric qc-cat-bar" id="qc-cat-finanzierung">' +
                    '<div class="ds2-metric-icon" data-qc-icon="bank" style="color:#9C9C9C;border-color:#9C9C9C40"></div>' +
                    '<div class="ds2-metric-body">' +
                      '<div class="ds2-metric-head">' +
                        '<span class="ds2-metric-label qc-cat-l">Finanzierung</span>' +
                        '<span class="ds2-metric-score qc-cat-v">– / 100</span>' +
                      '</div>' +
                      '<div class="ds2-metric-bar"><div class="ds2-metric-bar-fill qc-cat-bar-fill" style="width:0%"></div></div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="ds2-metric qc-cat-bar" id="qc-cat-bewirt">' +
                    '<div class="ds2-metric-icon" data-qc-icon="settings" style="color:#9C9C9C;border-color:#9C9C9C40"></div>' +
                    '<div class="ds2-metric-body">' +
                      '<div class="ds2-metric-head">' +
                        '<span class="ds2-metric-label qc-cat-l">Effizienz</span>' +
                        '<span class="ds2-metric-score qc-cat-v">– / 100</span>' +
                      '</div>' +
                      '<div class="ds2-metric-bar"><div class="ds2-metric-bar-fill qc-cat-bar-fill" style="width:0%"></div></div>' +
                    '</div>' +
                  '</div>' +
                '</div>' +

                // V56: Berechnungs-Werte als visuelle KPI-Karten-Grid (statt 1-Zeilen-Hint)
                '<div class="qc-score-kpis" id="qc-score-kpis">' +
                  '<div class="qc-score-kpi" data-kpi="bmr">' +
                    '<div class="qc-score-kpi-l">Bruttomietrendite</div>' +
                    '<div class="qc-score-kpi-v">—</div>' +
                    '<div class="qc-score-kpi-h">Ziel: ≥ 5%</div>' +
                  '</div>' +
                  '<div class="qc-score-kpi" data-kpi="nmr">' +
                    '<div class="qc-score-kpi-l">Nettomietrendite</div>' +
                    '<div class="qc-score-kpi-v">—</div>' +
                    '<div class="qc-score-kpi-h">Ziel: ≥ 3%</div>' +
                  '</div>' +
                  '<div class="qc-score-kpi" data-kpi="ekr">' +
                    '<div class="qc-score-kpi-l">EK-Rendite</div>' +
                    '<div class="qc-score-kpi-v">—</div>' +
                    '<div class="qc-score-kpi-h">Ziel: ≥ 7%</div>' +
                  '</div>' +
                  '<div class="qc-score-kpi" data-kpi="cf">' +
                    '<div class="qc-score-kpi-l">Cashflow / Mon.</div>' +
                    '<div class="qc-score-kpi-v">—</div>' +
                    '<div class="qc-score-kpi-h">Ziel: ≥ 0 €</div>' +
                  '</div>' +
                  '<div class="qc-score-kpi" data-kpi="dscr">' +
                    '<div class="qc-score-kpi-l">DSCR</div>' +
                    '<div class="qc-score-kpi-v">—</div>' +
                    '<div class="qc-score-kpi-h">Ziel: ≥ 1,2</div>' +
                  '</div>' +
                  '<div class="qc-score-kpi" data-kpi="ltv">' +
                    '<div class="qc-score-kpi-l">LTV</div>' +
                    '<div class="qc-score-kpi-v">—</div>' +
                    '<div class="qc-score-kpi-h">Ziel: < 90%</div>' +
                  '</div>' +
                  '<div class="qc-score-kpi" data-kpi="bwk">' +
                    '<div class="qc-score-kpi-l">Bewirtschaftung</div>' +
                    '<div class="qc-score-kpi-v">—</div>' +
                    '<div class="qc-score-kpi-h">Ziel: 18-35%</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            // V44: KI-Detail-Box wie unter Lage/Markt — direkt unter Donut, anstatt Source-Boxen
            '<div class="qc-ki-detail" id="qc-ki-detail" style="display:none">' +
              '<div class="qc-ki-detail-head">' +
                '<span class="qc-ki-detail-icon">✨</span>' +
                '<span class="qc-ki-detail-title">KI-Recherche</span>' +
                '<span class="qc-ki-detail-tag">Quellen + Reasoning</span>' +
              '</div>' +
              '<div class="qc-ki-detail-body" id="qc-ki-detail-body"></div>' +
            '</div>' +

            '<div class="qc-eval" id="qc-eval" style="display:none">' +
            '</div>' +

            // V63.23: Berechnungs-Info — zeigt welche Werte in den Score eingehen
            // Hilft Bugs wie "PDF-KP 145000 ≠ Score-KP 140000" sichtbar zu machen
            '<div class="qc-calc-info" id="qc-calc-info" style="display:none">' +
              '<div class="qc-calc-info-title">📐 So setzt sich die Berechnung zusammen</div>' +
              '<div class="qc-calc-info-grid" id="qc-calc-info-body"></div>' +
            '</div>' +

            // V54: Kauf-Empfehlung — was tun, bei welchem KP lohnt es?
            '<div class="qc-recommendation" id="qc-recommendation" style="display:none">' +
              '<div class="qc-rec-header">' +
                '<span class="qc-rec-icon" data-ico="target" data-ico-size="22"></span>' +
                '<span class="qc-rec-title">Empfehlung</span>' +
              '</div>' +
              '<div class="qc-rec-body" id="qc-rec-body"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // V53: Footer mit "Schließen"-Button entfällt — wir sind in einem Tab.
        // "Als Objekt speichern" wandert direkt in den qc-actions-Bereich.
        '<div class="qc-tab-footer">' +
          '<div style="flex:1"></div>' +
          '<button type="button" class="btn btn-gold" id="qc-save-btn" onclick="qcSaveAsObject()">' +
            '<span data-ico="save" data-ico-size="14"></span> Als Objekt speichern' +
          '</button>' +
        '</div>' +
      '</div>';

    // V53: Inplace im Tab rendern statt Modal-Overlay
    // V63.8: KRITISCHER BUGFIX — wenn schon gerendert, nicht neu rendern (sonst gehen alle Werte verloren).
    // Stattdessen nur die Sync-Logik aufrufen damit aktuelle Werte gezogen werden.
    if (host) {
      if (host.dataset.rendered !== '1') {
        // V197: Inline-Styles für neue Klassen (CSS-File bleibt unverändert)
        if (!document.getElementById('qc-v197-styles')) {
          var st = document.createElement('style');
          st.id = 'qc-v197-styles';
          st.textContent =
            '.qc-row-adr{display:flex;gap:10px;margin-bottom:10px}' +
            '.qc-row-adr .qc-field{margin:0}' +
            '.qc-ai-info-box{margin:12px 0 16px;padding:16px;background:#FAF6E8;border:1px solid rgba(201,168,76,0.25);border-radius:10px}' +
            '.qc-ai-info-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(201,168,76,0.25)}' +
            '.qc-ai-info-title{font-weight:600;color:#2A2727;font-size:14px}' +
            '.qc-ai-info-close{background:none;border:none;font-size:20px;cursor:pointer;color:#7A7370;padding:0 6px;line-height:1}' +
            '.qc-ai-info-close:hover{color:#2A2727}' +
            '.qc-ai-disclaimer{margin-top:10px;padding:8px 10px;background:rgba(255,255,255,0.6);border-radius:6px;font-size:11.5px;color:#7A7370;line-height:1.4}' +
            '.qc-ai-result-card{background:#fff;border:1px solid #E0DBD3;border-radius:8px;padding:12px 14px;margin-bottom:10px}' +
            '.qc-ai-result-card-low{background:rgba(184,98,92,0.04);border-color:rgba(184,98,92,0.25)}' +
            '.qc-ai-result-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}' +
            '.qc-ai-result-icon{font-size:16px}' +
            '.qc-ai-result-label{font-weight:600;color:#2A2727;font-size:13px;flex:1}' +
            '.qc-ai-conf-badge{font-size:10.5px;padding:2px 8px;border-radius:10px;font-weight:600;white-space:nowrap}' +
            '.qc-ai-result-value{font-size:18px;color:#2A2727;font-weight:600;margin:4px 0}' +
            '.qc-ai-result-sub{font-size:13px;color:#7A7370;font-weight:400}' +
            '.qc-ai-result-source{font-size:11.5px;color:#7A7370;font-style:italic;margin-top:4px}' +
            '.qc-ai-result-source a{color:#C9A84C;text-decoration:underline;font-style:normal;font-weight:500}' +
            '.qc-ai-result-source a:hover{color:#A88A3D}' +
            '.qc-ai-result-reasoning{font-size:12px;color:#7A7370;margin-top:4px;line-height:1.4}' +
            '.qc-ai-apply{margin-top:8px;font-size:12px;padding:6px 12px}' +
            '.qc-bewirt-advanced{margin-top:14px;padding:10px;background:rgba(201,168,76,0.04);border-radius:6px}' +
            '.qc-bewirt-advanced summary{cursor:pointer;font-size:12.5px;color:#7A7370;font-weight:500;padding:4px}' +
            '.qc-bewirt-advanced summary:hover{color:#2A2727}' +
            '.qc-bewirt-advanced[open] summary{margin-bottom:8px}' +
            '';
          document.head.appendChild(st);
        }

        host.innerHTML = inner;
        host.dataset.rendered = '1';
      }
      // V199: Listener IMMER (re-)attachen — auch wenn DOM erhalten bleibt.
      // Vorher: Listener wurde nur einmal pro Tab-Lifetime gesetzt, was nach
      // bestimmten Pfaden (z.B. Modal-Replace, qcReset) verloren ging.
      // Idempotenz via Marker auf host selbst.
      if (host.dataset.listenerAttached !== '1') {
        host.addEventListener('input', function(e) {
          if (e.target && (e.target.id || '').indexOf('qc_') === 0) {
            if (typeof qcCalc === 'function') qcCalc();
          }
        });
        host.addEventListener('change', function(e) {
          if (e.target && (e.target.id || '').indexOf('qc_') === 0) {
            if (typeof qcCalc === 'function') qcCalc();
          }
        });
        host.dataset.listenerAttached = '1';
      }
    } else {
      // Fallback nur falls Tab-Host wirklich fehlt
      var ov = document.createElement('div');
      ov.id = 'qc-modal';
      ov.className = 'qc-overlay';
      ov.innerHTML = '<div class="qc-modal" role="dialog">' + inner + '</div>';
      ov.addEventListener('click', function(e) { if (e.target === ov) closeQuickCheck(); });
      document.body.appendChild(ov);
    }

    // SVG-Icons in den frisch gerenderten Tab-Inhalt einsetzen
    if (typeof window.refreshDataIcos === 'function') {
      setTimeout(window.refreshDataIcos, 10);
    }

    setTimeout(function() {
      var f = document.getElementById('qc_adresse');
      if (f) f.focus();
      if (typeof qcCalc === 'function') qcCalc();
      // V59: Wenn _qcImgs schon befüllt war (von vorherigem PDF-Import), Foto-Grid neu rendern
      if (_qcImgs && _qcImgs.length > 0) {
        _qcRenderPhotos();
      }
    }, 100);
  }

  function closeQuickCheck() {
    // V53: Im Tab-Modus — nichts zu schließen, einfach ignorieren wenn Modal nicht da
    // V54: _qcImgs NICHT mehr löschen — Fotos sollen im QC bleiben bis User explizit auf "Zurücksetzen"
    var m = document.getElementById('qc-modal');
    if (m) m.remove();
  }

  function qcCalc() {
    function v(id) { var e = document.getElementById(id); return e ? e.value : ''; }
    function n(id) { return (typeof parseDe === 'function') ? parseDe(v(id)) : (parseFloat((v(id)||'').replace(',', '.')) || 0); }

    // V197: Adresse aus den 4 Einzelfeldern zusammenbauen (für Backward-Compat
    // mit Pfaden die qc_adresse erwarten)
    try {
      var parts = [];
      var str = v('qc_str'), hnr = v('qc_hnr'), plz = v('qc_plz'), ort = v('qc_ort');
      var strHnr = (str + (hnr ? ' ' + hnr : '')).trim();
      var plzOrt = ((plz || '') + ' ' + (ort || '')).trim();
      if (strHnr) parts.push(strHnr);
      if (plzOrt) parts.push(plzOrt);
      var combined = parts.join(', ');
      var hidden = document.getElementById('qc_adresse');
      if (hidden) hidden.value = combined;
    } catch(e) {}

    // V197: Bei PLZ-Eingabe → Kaufnebenkosten automatisch nach Bundesland setzen
    try {
      if (event && event.target && event.target.id === 'qc_plz') {
        var plzVal = (v('qc_plz') || '').trim();
        if (/^\d{5}$/.test(plzVal)) {
          var knkField = document.getElementById('qc_knk');
          // Nur überschreiben wenn User nicht selbst was eingetragen hat
          if (knkField && !knkField.dataset.userSet) {
            var knk = _qcKnkFromPlz(plzVal);
            if (knk) {
              knkField.value = knk.toFixed(1).replace('.', ',');
              // Source-Annotation
              var parent2 = knkField.closest('.qc-field');
              if (parent2 && !parent2.querySelector('.qc-ai-src')) {
                var src = document.createElement('span');
                src.className = 'qc-ai-src';
                src.style.cssText = 'display:block;font-size:11px;color:#7A7370;margin-top:4px;font-style:italic';
                src.textContent = '📍 Aus PLZ → ' + knk.toFixed(1).replace('.', ',') + ' % (GrESt + Notar + Makler)';
                parent2.appendChild(src);
              }
            }
          }
        }
      }
    } catch(e) {}

    // V43: Wenn User in einem Feld tippt, AI-Set-Marker entfernen + User-Set markieren
    if (event && event.target && event.target.id) {
      var t = event.target;
      if (t.dataset) {
        delete t.dataset.aiSet;
        t.dataset.userSet = '1';
        // Source-Annotation entfernen wenn User überschreibt
        var parent = t.closest('.qc-field');
        if (parent) {
          var src = parent.querySelector('.qc-ai-src');
          if (src) src.remove();
        }
      }
    }

    // V62.3: Quick-Check Score = DealPilot Score (Tab Kennzahlen) — IMMER identisch.
    // Strategie: wenn Hauptfelder (#kp, #nkm) befüllt sind, nutze die — NICHT die QC-eigenen.
    // Das stellt sicher dass beide Scores nie auseinanderlaufen können.
    function _mainV(id) {
      var e = document.getElementById(id);
      if (!e) return 0;
      return (typeof parseDe === 'function') ? parseDe(e.value) : (parseFloat((e.value||'').replace(',','.')) || 0);
    }

    // V63.24: KEIN Auto-Sync von QC → Hauptfeldern mehr.
    // Vorher: qcCalc rief _syncToMain auf, was qc_-Werte direkt in Hauptfelder schrieb.
    // Konsequenz: Workflow-Bar wurde nach PDF-Import VORZEITIG grün, weil die
    // Hauptfelder befüllt aussahen — obwohl der User das Objekt noch nicht gespeichert hatte.
    // Lösung: Sync passiert NUR beim expliziten "Als Objekt speichern" (qcSaveAsObject).
    // QC und Hauptobjekt sind unabhängig (siehe V63.23 Bug-1-Fix).

    // V63.17: KEIN calc() mehr aufrufen — das verursachte qcCalc → calc → qcCalc Endlos-Loop.
    // Bug 4 (DealScore updatet nicht im QC) wird später anders gelöst (z.B. nur DealScore.compute neu rufen,
    // ohne den ganzen calc() durchlauf zu triggern).

    // V63.23 KRITISCHER FIX (Score-Sprung Wurzel):
    // V62.3 las "kp = mainKp || n('qc_kp')" — d.h. wenn das Hauptfeld befüllt war, wurde
    // dieser Wert genommen statt der QC-Wert. Nach "Als Objekt speichern" sind die Hauptfelder
    // befüllt → QC zeigt plötzlich Werte aus dem Hauptobjekt (z.B. d1z=3.8 default statt qc_zins=3.5).
    // → Score springt.
    //
    // Lösung: QC liest IMMER NUR qc_-Werte. Die Hauptfelder sind die "Vollbild-Sicht",
    // der QC ist die "QC-Sicht". Beide sind unabhängig.
    var kp   = n('qc_kp');
    var nkm  = n('qc_nkm');
    var knkP = n('qc_knk') || 10.5;
    var nulRaw = n('qc_nul');
    var ulRaw  = n('qc_ul');
    var ek   = n('qc_ek');
    var zinsP = n('qc_zins') || n('qc_zinsen') || 3.8;
    var tilgP = n('qc_tilg') || 1.5;

    // V57: Auto-EK setzen wenn KP eingegeben wurde aber EK noch leer ist
    // V206: Auto-EK setzen oder aktualisieren wenn nicht user-/ai-gesetzt.
    // FIX: vorher griff der Block nur wenn EK-Feld leer war (!ekInp.value).
    // Problem: Beim Wechsel des Objekts (oder PDF-Import mit anderem KP) blieb
    // der alte EK-Wert stehen, weil das Feld nicht mehr leer war.
    // Jetzt: wenn EK weder userSet noch aiSet ist → ist es ein automatisch
    // berechneter Wert und darf bei KP/LTV-Änderung neu gerechnet werden.
    if (kp > 0) {
      var ekInp = document.getElementById('qc_ek');
      var isAuto = ekInp && ekInp.dataset.userSet !== '1' && ekInp.dataset.aiSet !== '1';
      if (ekInp && isAuto) {
        var activeBtn = document.querySelector('.qc-ltv-btn.active');
        var ltvDef = activeBtn ? parseInt(activeBtn.getAttribute('data-ltv')) : 100;
        var nkAbs = kp * (knkP / 100);
        var ekKpPart = kp * (1 - ltvDef / 100);
        var ekAuto = Math.round(ekKpPart + nkAbs);
        // Nur überschreiben wenn sich der berechnete Wert vom aktuellen Feld unterscheidet
        if (String(ekAuto) !== ekInp.value) {
          ekInp.value = String(ekAuto);
        }
        ek = ekAuto;
      }
    }

    var bewirtMode = v('qc_bewirt_mode') || 'hg';
    var bewirtPeriod = v('qc_bewirt_period') || 'y';     // V63.24: y=Jahr, m=Monat
    var nkmJahrTmp = nkm * 12;
    var nul, ul;
    if (bewirtMode === 'pct') {
      nul = nkmJahrTmp * (nulRaw / 100);
      ul  = nkmJahrTmp * (ulRaw / 100);
    } else if (bewirtMode === 'hg') {
      // V54: Hausgeld-Direkt-Modus
      var hgM = n('qc_hg');           // Hausgeld pro Monat
      var splitNul = n('qc_hg_split'); // % nicht-umlagefähig (Default 60)
      if (!splitNul) splitNul = 60;
      var hgY = hgM * 12;
      nul = hgY * splitNul / 100;
      ul  = hgY * (100 - splitNul) / 100;
    } else {
      // V63.24: Period-Toggle — wenn Monat, ×12 für Jahresberechnung
      if (bewirtPeriod === 'm') {
        nul = nulRaw * 12;
        ul  = ulRaw * 12;
      } else {
        nul = nulRaw;
        ul  = ulRaw;
      }
    }
    // V63.28: Echte User-BWK speichern BEVOR Defaults greifen — für NMR
    var nulOrig = nul || 0;
    var ulOrig  = ul || 0;
    if (!nul && kp > 0) nul = kp * 0.01;
    if (!ul && nkm > 0) ul = nkm * 12 * 0.10;
    var nulReal = nulOrig;
    var ulReal  = ulOrig;
    var bwkReal = nulReal + ulReal;

    var scoreVal = document.getElementById('qc-score-value');
    var scoreTag = document.getElementById('qc-score-tag');
    var scoreCircle = document.getElementById('qc-score-circle');
    var scoreRing = document.getElementById('qc-score-ring');
    var evalBox = document.getElementById('qc-eval');

    // V207: Pflichtfeld-Check für plausible Score-Berechnung.
    // Marcels Pflichtfelder: PLZ, Ort, Wfl, KP, NKM, EK, Zinssatz, Tilgung, Hausgeld, NUL-Split.
    // V207 hat nur EINEN Bewirt-Mode (Hausgeld + Split) — kein qc_nul/qc_ul mehr.
    var pflichtFehlt = [];
    if (!v('qc_plz').trim())   pflichtFehlt.push('PLZ');
    if (!v('qc_ort').trim())   pflichtFehlt.push('Ort');
    if (!n('qc_wfl'))          pflichtFehlt.push('Wohnfläche');
    if (!kp)                   pflichtFehlt.push('Kaufpreis');
    if (!nkm)                  pflichtFehlt.push('Nettokaltmiete');
    if (!n('qc_ek'))           pflichtFehlt.push('Eigenkapital');
    if (!n('qc_zins'))         pflichtFehlt.push('Zinssatz');
    if (!n('qc_tilg'))         pflichtFehlt.push('Tilgung');
    if (!n('qc_hg'))           pflichtFehlt.push('Hausgeld');
    // qc_hg_split hat Default 22 — wird also nie leer sein, kein Check nötig

    // V207: Live-Preview der Aufschlüsselung anzeigen (auch wenn Pflicht-Check noch nicht durch)
    try {
      var hgM = n('qc_hg');
      var splitNul = n('qc_hg_split');
      var derivedBox = document.getElementById('qc-bewirt-derived-text');
      if (derivedBox) {
        if (hgM > 0 && splitNul > 0) {
          var hgY = hgM * 12;
          var nulY = Math.round(hgY * splitNul / 100);
          var ulY  = Math.round(hgY * (100 - splitNul) / 100);
          var pctNkm = nkm > 0 ? (hgY / (nkm * 12) * 100).toFixed(0) : '–';
          derivedBox.innerHTML =
            '<strong>' + hgY.toLocaleString('de-DE') + ' €/Jahr</strong> gesamt ' +
            '(' + pctNkm + '% der NKM) · ' +
            '<span style="color:#B8625C">nicht-umlagef.: ' + nulY.toLocaleString('de-DE') + ' €/Jahr</span> · ' +
            '<span style="color:#3FA56C">umlagef.: ' + ulY.toLocaleString('de-DE') + ' €/Jahr</span>';
        } else {
          derivedBox.textContent = 'Tragen Sie Hausgeld und NUL-Anteil ein …';
        }
      }
    } catch (e) { /* nicht kritisch */ }

    // Auch globalen Save-Button-State updaten
    _updateQcSaveButton(pflichtFehlt);

    if (pflichtFehlt.length > 0) {
      if (scoreVal) scoreVal.textContent = '–';
      if (scoreTag) scoreTag.textContent = 'Pflichtfelder fehlen';
      if (scoreCircle) scoreCircle.setAttribute('class', 'qc-score-circle-v41');
      if (scoreRing) scoreRing.setAttribute('stroke-dasharray', '0 314');
      _setQcCat('rendite', null);
      _setQcCat('cashflow', null);
      _setQcCat('sicherheit', null);
      _setQcCat('finanzierung', null);
      _setQcCat('bewirt', null);
      if (evalBox) {
        evalBox.innerHTML = '<div class="qc-eval-empty" style="padding:24px;text-align:center">' +
          '<div style="font-size:28px;margin-bottom:10px">📝</div>' +
          '<div style="font-weight:600;color:#2A2727;font-size:14px;margin-bottom:8px">Erst Pflichtfelder ausfüllen</div>' +
          '<div style="font-size:12.5px;color:#7A7370;line-height:1.6">' +
            'Für eine plausible Bewertung fehlen noch:<br><strong style="color:#B8625C">' +
            pflichtFehlt.join(', ') +
          '</strong></div>' +
          '<div style="font-size:11px;color:#9C9893;margin-top:10px;font-style:italic">' +
            'Der Quick-Check Score wird erst angezeigt, wenn alle Pflichtfelder befüllt sind.' +
          '</div>' +
        '</div>';
      }
      return;
    }

    if (!kp || !nkm) {
      if (scoreVal) scoreVal.textContent = '–';
      if (scoreTag) scoreTag.textContent = 'Kaufpreis + Miete fehlt';
      if (scoreCircle) scoreCircle.setAttribute('class', 'qc-score-circle-v41');
      if (scoreRing) scoreRing.setAttribute('stroke-dasharray', '0 314');
      _setQcCat('rendite', null);
      _setQcCat('cashflow', null);
      _setQcCat('sicherheit', null);
      _setQcCat('finanzierung', null);
      _setQcCat('bewirt', null);
      if (evalBox) evalBox.innerHTML = '<div class="qc-eval-empty">Sobald Kaufpreis und Nettokaltmiete eingetragen sind, siehst du eine erste Bewertung.</div>';
      return;
    }

    // ════════════════════════════════════════════════════════════════
    // V63.30 ZENTRALE BERECHNUNG via DealKpis.compute()
    // Identische Pipeline wie Tab Kennzahlen (calc.js) — beide rufen
    // dieselbe reine Funktion mit denselben Inputs.
    // ════════════════════════════════════════════════════════════════
    //
    // QC-Variablen-Mapping → DealKpis-Inputs:
    //   qc_nkm_grund   → nkm    (Grundmiete monatlich)
    //   stp+gar+kü+so  → ze     (Zusatzeinnahmen)
    //   uf = 0                  (Umlagen — gibt's im QC nicht)
    //   nulOrig+ulOrig → bwk_ul/bwk_nul  (echte User-BWK ohne QC-Defaults)
    //   knkAbs = kp×knkP/100    → nk     (Erwerbsnebenkosten)
    //   san=0, moebl=0          (im QC nicht separat)
    //   darlehen = gi − ek      → d1
    //   qc_zins                 → d1z (%)
    //   qc_tilg                 → d1t (%)

    var nkmGrundMon = n('qc_nkm_grund') || nkm; // Fallback: gesamte qc_nkm als Grundmiete
    var zeMon = (n('qc_nkm_stp') || 0) + (n('qc_nkm_garage') || 0) +
                (n('qc_nkm_kueche') || 0) + (n('qc_nkm_sonst') || 0);
    // Wenn qc_nkm_grund nicht existiert aber qc_nkm gefüllt: alles als Grundmiete behandeln
    if (!n('qc_nkm_grund') && nkm > 0) {
      nkmGrundMon = nkm;
      zeMon = 0;
    }
    var knkAbs = kp * (knkP / 100);
    var gi = kp + knkAbs;
    var darlehen = Math.max(0, gi - ek);

    // V63.30: AfA + Grenzsteuersatz aus Hauptfeldern lesen (falls vorhanden) damit
    // QC und Tab Kennzahlen IDENTISCHE cf_ns/cf_m liefern. Im reinen QC-Modus (ohne
    // Hauptobjekt-Felder befüllt) bleiben afa=0, grenz=0 → Brutto-Cashflow = Netto-Cashflow.
    var afaQc = 0;
    var grenzQc = 0;
    try {
      var afaSatzEl = document.getElementById('afa_satz');
      var gebAntEl = document.getElementById('geb_ant');
      if (afaSatzEl && gebAntEl) {
        var afaSatz = parseDe(afaSatzEl.value || '2') || 2;
        var gebAnt = parseDe(gebAntEl.value || '0') || 0;
        if (gebAnt > 0) afaQc = kp * (gebAnt / 100) * (afaSatz / 100);
      }
      var grenzEl = document.getElementById('grenz');
      if (grenzEl) grenzQc = parseDe(grenzEl.value || '0') || 0;
    } catch(e) {}

    // V63.35.1: LTV-Bezug aus Haupt-Checkbox übernehmen (Konsistenz Quick-Check ↔ DealPilot Score)
    var _qc_ekInklNkLtv = !!(document.getElementById('ek_inkl_nk') && document.getElementById('ek_inkl_nk').checked);
    // V63.36: SVW aus Hauptfeld übernehmen (für 3-stufige LTV-Logik)
    var _qc_svw = 0;
    var svwEl = document.getElementById('svwert');
    if (svwEl) _qc_svw = parseFloat((svwEl.value || '0').replace(',','.')) || 0;
    var kpis = (window.DealKpis && DealKpis.compute) ? DealKpis.compute({
      kp:      kp,
      nk:      knkAbs,
      san:     0,
      moebl:   0,
      nkm:     nkmGrundMon,
      ze:      zeMon,
      uf:      0,
      bwk_ul:  ulOrig  || 0,
      bwk_nul: nulOrig || 0,
      d1:      darlehen,
      d1z:     zinsP,
      d1t:     tilgP,
      ek:      ek,
      afa:     afaQc,
      grenz:   grenzQc,
      ekInklNkLtv: _qc_ekInklNkLtv,
      svw:     _qc_svw
    }) : null;

    // KPIs aus DealKpis übernehmen (gleicher Pfad wie Tab Kennzahlen)
    var bmr        = kpis ? kpis.bmy : 0;
    var nmr        = kpis ? kpis.nmy : 0;
    var ltvPct     = kpis ? kpis.ltv : 0;
    var dscr       = kpis ? kpis.dscr : 0;
    var zinsJahr   = kpis ? kpis.zins_j : 0;
    var tilgJahr   = kpis ? kpis.tilg_j : 0;
    var rateJahr   = kpis ? kpis.rate_j : 0;
    var cfOpJahr   = kpis ? kpis.cf_op : 0;
    var cfMon      = kpis ? kpis.cf_m : 0;             // ← geht in Score
    var cfBankerJahr = kpis ? kpis.cf_banker_j : 0;
    var cfBankerMon  = kpis ? kpis.cf_banker_m : 0;
    var ekr        = kpis ? kpis.ekr : 0;
    var nkmJahr    = kpis ? kpis.nkm_j : 0;
    // V63.35: Excel-Logik — NOI = NKM − NUL (UL durchlaufend)
    var noiJahr    = kpis ? (kpis.nkm_j - (kpis.bwk_cf || 0)) : 0;
    // bewirtPctNkm bleibt auf Brutto-BWK (Anzeige-Quote)
    var bewirtPctNkm = nkmJahr > 0 && kpis ? (kpis.bwk / nkmJahr * 100) : 0;

    function lerp(x, x1, x2, y1, y2) {
      if (x <= x1) return y1; if (x >= x2) return y2;
      return y1 + (x - x1) * (y2 - y1) / (x2 - x1);
    }

    // V63.22 KRITISCHER FIX (User-Bug "Score springt nach Save"):
    // V62.3 hatte einen Doppel-Pfad: bei vollen Hauptfeldern → DealScore.compute() (State.kpis),
    // sonst → computeFromKpis(qc-Werte). Das Problem: nach "Als Objekt speichern" sind die
    // Hauptfelder ausgefüllt → der QC zeigt plötzlich den State.kpis-Score (mit Default-KNK,
    // Hausgeld, Verwaltung, etc.) der HÖHER ist als der reine QC-Score.
    // → Score "springt" von z.B. 76 auf 87 nach Save + Tab-Wechsel.
    //
    // Lösung: QC zeigt IMMER den Score basierend auf den QC-Eingaben (computeFromKpis).
    // Der Vollbild-Score in Tab Kennzahlen ist eine eigene, präzisere Sicht — die beiden
    // dürfen sich unterscheiden, müssen aber jeweils stabil sein.
    var dsResult = null;
    var score, sRendite, sCashflow, sSicherheit, sFinanz, sBewirt;

    if (typeof window.DealScore !== 'undefined' && typeof window.DealScore.computeFromKpis === 'function') {
      try {
        var wpEstimate = kp * 0.05;
        dsResult = window.DealScore.computeFromKpis({
          kp: kp,
          cf_m: cfMon,
          nmy: nmr,
          ltv: ltvPct,
          dscr: dscr,
          wp_kpi: wpEstimate,
          mstg: 1.5
        });
        score = dsResult.score;
        var bd = dsResult.breakdown || [];
        function _bdScore(key) {
          var b = bd.find(function(x){ return x.key === key; });
          return b ? Math.round(b.score) : 50;
        }
        sCashflow   = _bdScore('cashflow');
        sRendite    = _bdScore('rendite');
        sFinanz     = _bdScore('ltv');
        sSicherheit = _bdScore('risiko');
        sBewirt     = _bdScore('potenzial');
      } catch(e) {
        console.warn('[QC-Score V63.22] computeFromKpis failed, fallback:', e.message);
        dsResult = null;
      }
    }


    if (dsResult === null) {
      // Fallback (alte interne Formel)
      sRendite      = (bmr <= 3 ? 0 : bmr >= 7 ? 100 : lerp(bmr, 3, 7, 0, 100)) * 0.4 +
                      (nmr <= 1 ? 0 : nmr >= 5 ? 100 : lerp(nmr, 1, 5, 0, 100)) * 0.4 +
                      (ekr <= 0 ? 0 : ekr >= 12 ? 100 : lerp(ekr, 0, 12, 0, 100)) * 0.2;
      sCashflow     = cfMon <= -200 ? 0 : cfMon >= 300 ? 100 : lerp(cfMon, -200, 300, 0, 100);
      sSicherheit   = dscr <= 0.9 ? 0 : dscr >= 1.4 ? 100 : lerp(dscr, 0.9, 1.4, 0, 100);
      sFinanz       = (ltvPct >= 100 ? 30 : ltvPct >= 90 ? 60 : ltvPct >= 80 ? 80 : 90);
      sBewirt       = bewirtPctNkm <= 18 ? 100 : bewirtPctNkm >= 40 ? 30 : lerp(bewirtPctNkm, 18, 40, 100, 30);
      score = Math.round(
        sRendite * 0.30 + sCashflow * 0.25 + sSicherheit * 0.20 +
        sFinanz * 0.15 + sBewirt * 0.10
      );
    }
    score = Math.max(0, Math.min(100, score));

    // V63.1: WICHTIG — Quick-Check zeigt den klassischen DealPilot Score
    // (Cashflow/Rendite/LTV/Risiko/Potenzial). Der bleibt IMMER sichtbar — nicht ab 70% gesperrt.
    // Die 70%-Sperre gilt NUR für den Investor Deal Score (DS2, 24 KPIs) im Tab Kennzahlen.

    var tag, cls, ringColor;
    if (score >= 80)      { tag = 'Sehr gut'; cls = 'ds-score-green-strong'; ringColor = '#10A65C'; }
    else if (score >= 65) { tag = 'Gut';      cls = 'ds-score-green';        ringColor = '#2FBE6E'; }
    else if (score >= 50) { tag = 'Solide';   cls = 'ds-score-gold';         ringColor = '#E5BD53'; }
    else                  { tag = 'Schwach';  cls = 'ds-score-red';          ringColor = '#D55B5B'; }

    if (scoreVal) scoreVal.textContent = score;
    if (scoreTag) {
      scoreTag.textContent = tag.toUpperCase();
      scoreTag.style.color = ringColor;
    }
    var topDescAct = document.getElementById('qc-top-deal-desc');
    if (topDescAct) {
      topDescAct.textContent =
        score >= 80 ? 'Quick-Check zeigt sehr gute Kennzahlen. Im Objekt-Modus genauer prüfen für vollen Score.' :
        score >= 65 ? 'Quick-Check signalisiert solide bis gute Eckwerte. Detail-Analyse empfohlen.' :
        score >= 50 ? 'Brauchbare Basis aber mit Schwächen. Genaue Prüfung notwendig.' :
                      'Quick-Check zeigt Schwächen. Im Detail-Modus analysieren ob das Bild kippt.';
    }
    if (scoreRing) {
      var dash = (score / 100 * 327).toFixed(1);
      scoreRing.setAttribute('stroke-dasharray', dash + ' 327');
      scoreRing.setAttribute('stroke', ringColor);
    }
    var pill = document.getElementById('qc-score-pill');
    if (pill) {
      pill.textContent = tag;
      pill.style.color = ringColor;
      pill.style.borderColor = ringColor;
      pill.style.display = '';
    }
    var topIcon = document.getElementById('qc-top-deal-icon');
    if (topIcon && window.Icons && Icons.brain) topIcon.innerHTML = Icons.brain({ size: 22 });

    // V56: Berechnungs-Werte in den 7 KPI-Karten anzeigen (statt 1-Zeilen-Hint)
    function _setKpi(kpi, valText, ratioGood) {
      var card = document.querySelector('.qc-score-kpi[data-kpi="' + kpi + '"]');
      if (!card) return;
      var v = card.querySelector('.qc-score-kpi-v');
      if (v) v.textContent = valText;
      card.classList.remove('qc-kpi-good', 'qc-kpi-mid', 'qc-kpi-bad');
      if (ratioGood == null) return;
      if (ratioGood >= 0.75) card.classList.add('qc-kpi-good');
      else if (ratioGood >= 0.4) card.classList.add('qc-kpi-mid');
      else card.classList.add('qc-kpi-bad');
    }

    if (kp > 0 && nkm > 0) {
      // Skalen wie im Score
      _setKpi('bmr',  bmr.toFixed(2).replace('.', ',') + '%',
              (bmr <= 3 ? 0 : bmr >= 7 ? 1 : (bmr - 3) / 4));
      _setKpi('nmr',  nmr.toFixed(2).replace('.', ',') + '%',
              (nmr <= 1 ? 0 : nmr >= 5 ? 1 : (nmr - 1) / 4));
      _setKpi('ekr',  ekr.toFixed(2).replace('.', ',') + '%',
              (ekr <= 0 ? 0 : ekr >= 12 ? 1 : ekr / 12));
      _setKpi('cf',   (cfMon >= 0 ? '+' : '') + Math.round(cfMon) + ' €',
              (cfMon <= -200 ? 0 : cfMon >= 300 ? 1 : (cfMon + 200) / 500));
      _setKpi('dscr', dscr ? dscr.toFixed(2).replace('.', ',') : '—',
              (dscr <= 0.9 ? 0 : dscr >= 1.4 ? 1 : (dscr - 0.9) / 0.5));
      _setKpi('ltv',  ltvPct.toFixed(0) + '%',
              (ltvPct >= 100 ? 0 : ltvPct >= 90 ? 0.4 : ltvPct >= 80 ? 0.7 : 1));
      _setKpi('bwk',  bewirtPctNkm.toFixed(0) + '%',
              (bewirtPctNkm <= 18 ? 1 : bewirtPctNkm >= 40 ? 0 : (40 - bewirtPctNkm) / 22));
    } else {
      ['bmr','nmr','ekr','cf','dscr','ltv','bwk'].forEach(function(k){ _setKpi(k, '—', null); });
    }

    // V54: Score-Werte mit ausführlichen Tooltips — User sieht beim Hover welche
    // Werte herangezogen werden und wie der Score zustande kommt.
    _setQcCat('rendite',      Math.round(sRendite),    bmr.toFixed(2).replace('.', ',') + '% BMR · ' + nmr.toFixed(2).replace('.', ',') + '% NMR',
      'Berechnung Rendite (' + Math.round(sRendite) + '/100):\n' +
      '• Bruttomietrendite (BMR): ' + bmr.toFixed(2).replace('.', ',') + '% — Skala: 3% = 0 Pkt, 7% = 100 Pkt (Gewicht 40%)\n' +
      '• Nettomietrendite (NMR): ' + nmr.toFixed(2).replace('.', ',') + '% — Skala: 1% = 0 Pkt, 5% = 100 Pkt (Gewicht 40%)\n' +
      '• Eigenkapitalrendite (EKR): ' + ekr.toFixed(2).replace('.', ',') + '% — Skala: 0% = 0 Pkt, 12% = 100 Pkt (Gewicht 20%)');
    _setQcCat('cashflow',     Math.round(sCashflow),   (cfMon >= 0 ? '+' : '') + Math.round(cfMon).toLocaleString('de-DE') + ' €/Mon',
      'Berechnung Cashflow (' + Math.round(sCashflow) + '/100):\n' +
      '• CF vor Steuern: ' + (cfMon >= 0 ? '+' : '') + Math.round(cfMon).toLocaleString('de-DE') + ' €/Monat\n' +
      '• Skala: −200 €/Mon = 0 Pkt, +300 €/Mon = 100 Pkt (linear)\n' +
      '• Formel: NKM − Annuität − BWK_NUL/12');
    _setQcCat('sicherheit',   Math.round(sSicherheit), 'DSCR ' + (dscr ? dscr.toFixed(2).replace('.', ',') : '–'),
      'Berechnung Sicherheit (' + Math.round(sSicherheit) + '/100):\n' +
      '• DSCR (Debt Service Coverage Ratio): ' + (dscr ? dscr.toFixed(2).replace('.', ',') : '–') + '\n' +
      '• Skala: 0,9 = 0 Pkt, 1,4 = 100 Pkt\n' +
      '• Formel: (NKM × 12 − BWK_NUL) / Annuität\n' +
      '• Faustregel Bank: ≥ 1,2 = guter Deckungsgrad');
    _setQcCat('finanzierung', Math.round(sFinanz),     'LTV ' + ltvPct.toFixed(0) + '%',
      'Berechnung Finanzierung (' + Math.round(sFinanz) + '/100):\n' +
      '• Loan-to-Value (LTV): ' + ltvPct.toFixed(0) + '%\n' +
      '• Stufen:\n' +
      '   ≥ 100% LTV → 30 Pkt (kein EK eingesetzt = riskant)\n' +
      '   ≥  90% LTV → 60 Pkt\n' +
      '   ≥  80% LTV → 80 Pkt\n' +
      '   <  80% LTV → 90 Pkt');
    _setQcCat('bewirt',       Math.round(sBewirt),    bewirtPctNkm.toFixed(0) + '% der NKM',
      'Berechnung Effizienz (' + Math.round(sBewirt) + '/100):\n' +
      '• Bewirtschaftungskosten: ' + bewirtPctNkm.toFixed(0) + '% der Nettokaltmiete\n' +
      '• Skala: 18% = 100 Pkt, 40% = 30 Pkt (linear, dazwischen)\n' +
      '• IVD-Empfehlung ETW: 18-35% gesamt\n' +
      '• Formel: (BWK_NUL + BWK_UL) / NKM_jährlich × 100');

    var msgs = [];
    if (bmr < 4) msgs.push('Bruttorendite unter 4% — preislich teuer für die Region oder Miete zu niedrig.');
    if (nmr < 2) msgs.push('Nettorendite unter 2% — nach Bewirtschaftungskosten bleibt sehr wenig.');
    if (cfMon < 0) msgs.push('Negativer Cashflow von ' + Math.round(cfMon) + ' €/Mon — Deal kostet dich Geld jeden Monat.');
    if (dscr > 0 && dscr < 1.0) msgs.push('DSCR < 1,0 — Mieteinnahmen decken nicht mal die Bankrate.');
    if (bewirtPctNkm > 35) msgs.push('Bewirtschaftungskosten über 35% der NKM — IVD-Empfehlung wäre 18-35%.');
    if (ekr > 8 && cfMon > 100) msgs.push('Sehr starke EK-Rendite und positiver Cashflow — solider Deal.');
    if (msgs.length === 0) msgs.push('Solide Eckdaten ohne offensichtliche Probleme. Im vollen Objekt-Modus siehst du den vollständigen Investor Deal Score 2.0 mit ~22 KPIs.');

    if (evalBox) {
      evalBox.innerHTML = msgs.map(function(m) {
        return '<div class="qc-eval-line">• ' + m + '</div>';
      }).join('');
    }

    // V54: Kauf-Empfehlung — pragmatisch + handlungsorientiert
    _renderQcRecommendation({
      score: score, kp: kp, nkm: nkm, bmr: bmr, nmr: nmr, cfMon: cfMon,
      dscr: dscr, ltv: ltvPct, ekr: ekr
    });

    // V63.23: Berechnungs-Info — zeigt was in den Score eingeht
    _renderQcCalcInfo({
      kp: kp,
      nkm: nkm,
      nkm_grund: n('qc_nkm_grund'),
      nkm_stp: n('qc_nkm_stp'),
      nkm_garage: n('qc_nkm_garage'),
      nkm_sonst: n('qc_nkm_sonst'),
      ek: ek,
      knkP: knkP,
      knk: kp * (knkP / 100),
      d1: Math.max(0, kp * (1 + knkP/100) - ek),
      zinsP: zinsP,
      tilgP: tilgP,
      cfMon: cfMon,
      bmr: bmr,
      nmr: nmr,
      ltvPct: ltvPct,
      dscr: dscr
    });
  }

  // V63.23: Info-Box "So setzt sich die Berechnung zusammen"
  function _renderQcCalcInfo(d) {
    var box = document.getElementById('qc-calc-info');
    var body = document.getElementById('qc-calc-info-body');
    if (!box || !body) return;
    if (!d.kp || !d.nkm) {
      box.style.display = 'none';
      return;
    }
    function fmt(v, suffix) {
      suffix = suffix || '';
      if (v == null || isNaN(v)) return '–';
      var s = Math.round(v).toLocaleString('de-DE');
      return s + suffix;
    }
    function fmtP(v) { return (v == null || isNaN(v)) ? '–' : v.toFixed(2).replace('.', ',') + ' %'; }
    function fmtR(v) { return (v == null || isNaN(v)) ? '–' : v.toFixed(2).replace('.', ','); }

    // NKM-Komponenten — wenn Komponenten eingegeben sind, zeige Summe
    var nkmSum = (d.nkm_grund || 0) + (d.nkm_stp || 0) + (d.nkm_garage || 0) + (d.nkm_sonst || 0);
    var nkmDetail = '';
    if (nkmSum > 0 && Math.abs(nkmSum - d.nkm) < 1) {
      var parts = [];
      if (d.nkm_grund)  parts.push(fmt(d.nkm_grund) + ' € Grund');
      if (d.nkm_stp)    parts.push(fmt(d.nkm_stp) + ' € Stp');
      if (d.nkm_garage) parts.push(fmt(d.nkm_garage) + ' € Garage');
      if (d.nkm_sonst)  parts.push(fmt(d.nkm_sonst) + ' € Sonst');
      nkmDetail = ' (' + parts.join(' + ') + ')';
    } else if (nkmSum > 0 && Math.abs(nkmSum - d.nkm) > 1) {
      nkmDetail = ' ⚠ Komponenten-Summe ' + fmt(nkmSum) + ' € weicht ab!';
    }

    body.innerHTML =
      '<div class="qc-calc-row"><span class="qc-calc-label">Kaufpreis:</span><span class="qc-calc-val">' + fmt(d.kp, ' €') + '</span></div>' +
      '<div class="qc-calc-row"><span class="qc-calc-label">+ Kaufnebenkosten (' + fmtP(d.knkP) + '):</span><span class="qc-calc-val">' + fmt(d.knk, ' €') + '</span></div>' +
      '<div class="qc-calc-row qc-calc-row-strong"><span class="qc-calc-label">= Gesamtinvestition:</span><span class="qc-calc-val">' + fmt(d.kp + d.knk, ' €') + '</span></div>' +
      '<div class="qc-calc-row"><span class="qc-calc-label">– Eigenkapital:</span><span class="qc-calc-val">' + fmt(d.ek, ' €') + '</span></div>' +
      '<div class="qc-calc-row qc-calc-row-strong"><span class="qc-calc-label">= Darlehen:</span><span class="qc-calc-val">' + fmt(d.d1, ' €') + ' @ ' + fmtP(d.zinsP) + ' / ' + fmtP(d.tilgP) + ' Tilg.</span></div>' +
      '<div class="qc-calc-row"><span class="qc-calc-label">Nettokaltmiete (Mon):</span><span class="qc-calc-val">' + fmt(d.nkm, ' €') + nkmDetail + '</span></div>' +
      '<div class="qc-calc-row"><span class="qc-calc-label">Bruttomietrendite:</span><span class="qc-calc-val">' + fmtP(d.bmr) + '</span></div>' +
      '<div class="qc-calc-row"><span class="qc-calc-label">Nettomietrendite:</span><span class="qc-calc-val">' + fmtP(d.nmr) + '</span></div>' +
      '<div class="qc-calc-row"><span class="qc-calc-label">Cashflow / Monat:</span><span class="qc-calc-val">' + fmt(d.cfMon, ' €') + '</span></div>' +
      '<div class="qc-calc-row"><span class="qc-calc-label">DSCR:</span><span class="qc-calc-val">' + fmtR(d.dscr) + '</span></div>' +
      '<div class="qc-calc-row"><span class="qc-calc-label">LTV:</span><span class="qc-calc-val">' + fmtP(d.ltvPct) + '</span></div>';
    box.style.display = 'block';
  }

  /**
   * V54: Erzeugt eine Kauf-Empfehlung mit konkretem Handlungsvorschlag.
   * - Bei guter Lage: KAUF
   * - Bei mittlerer: VERHANDELN — und sagt bei welchem KP der Deal solide wird
   * - Bei schlechter: PASS — und bei welchem KP die Schmerzschwelle wäre
   */
  function _renderQcRecommendation(d) {
    var box = document.getElementById('qc-recommendation');
    var body = document.getElementById('qc-rec-body');
    if (!box || !body) return;

    // V63.2: Leerzustand — wenn weder KP noch NKM ist, Empfehlungsbox KOMPLETT verstecken.
    if (!d.kp || !d.nkm) {
      box.style.display = 'none';
      // V63.3: Auch Kennzahlen-Empfehlungsbox verstecken
      var kRec0 = document.getElementById('kennzahlen-qc-recommendation');
      if (kRec0) kRec0.style.display = 'none';
      return;
    }
    box.style.display = '';

    if (!isFinite(d.score)) {
      box.style.display = 'none';
      var kRec1 = document.getElementById('kennzahlen-qc-recommendation');
      if (kRec1) kRec1.style.display = 'none';
      return;
    }

    // V63.25 NEU: Schmerzschwellen-KP korrekt berechnen.
    // Vorher: kpFor55 = nkmYear / 0.055 (= BMR-5,5%-Ziel) — Bug: bei hoher Ist-BMR
    // empfahl das System einen HÖHEREN KP mit "negativem Nachlass". Sinnlos.
    //
    // Neue Logik: Finde KP bei dem die Rechnung "wenigstens halbwegs trägt":
    //   - Ziel BMR ≥ 6% (klar besser als der typische schwache Deal)
    //   - Cashflow ≥ 0 €/Mon (Annuität wird mindestens gedeckt)
    //   - DSCR ≥ 1.1 (Sicherheitspolster)
    // Wir nehmen den HÖCHSTEN KP, der ALLE drei erfüllt — das ist der echte Schmerzschwellen-Preis.
    var nkmYear = d.nkm * 12;
    var kpForBmr = nkmYear / 0.06;                   // KP bei BMR=6%
    // Annuität pro Jahr aus Zins+Tilg (von qc_zins/qc_tilg in d nicht direkt — nähern):
    // Wenn d.cfMon und d.kp bekannt sind, bestimmen wir Annuität implizit:
    //   nkm * 12 - bewirt - annuität = cfMon * 12
    //   → annuität ≈ nkm*12 - bewirt - cfMon*12
    // KP bei CF=0 → annuitätsBudget = nkm*12 - bewirt
    // Vereinfacht: aus DSCR rückwärts (DSCR = nkmJahr / annuitätJahr)
    var annuitaetJahr;
    if (d.dscr && d.dscr > 0) {
      annuitaetJahr = nkmYear / d.dscr;
    } else {
      annuitaetJahr = nkmYear * 0.6;                 // Fallback ~60% der NKM
    }
    // Bei CF=0 darf annuität so groß sein wie (nkmJahr - bewirtAnteil). Nähern: ~70% der NKM verfügbar.
    var annBudget = nkmYear * 0.70;
    // Annuitätsfaktor (Zins+Tilg gesamt). Aus heutiger Annuität / heutigem Darlehen.
    var heutigeKnk = d.kp * 0.105;
    var heutigesDarlehen = Math.max(1, d.kp + heutigeKnk - (d.kp * 0.05)); // grobe EK-Annahme 5%
    // Verbessert: nutze CF-Differenz als Lever
    // KP bei CF=0:  delta_kp = cfMon * 12 / annuitätsfaktor_jahr
    var annuitaetsFaktor = annuitaetJahr / heutigesDarlehen;   // z.B. 0.058 (5,8%)
    if (annuitaetsFaktor < 0.04) annuitaetsFaktor = 0.058;
    var deltaKp = (d.cfMon < 0)
      ? Math.abs(d.cfMon) * 12 / annuitaetsFaktor
      : 0;
    var kpForCf0 = d.kp - deltaKp;

    // Schmerzschwelle = Maximum aus (BMR-Ziel-KP, CF=0-KP) — also der STRENGERE
    // Aber nur wenn er TATSÄCHLICH UNTER dem aktuellen KP liegt (sonst Empfehlung sinnlos)
    var ziel = Math.min(kpForBmr, kpForCf0);
    if (!isFinite(ziel) || ziel <= 0 || ziel >= d.kp) {
      // Wenn KP schon unter den Zielen → keine Preissenkung nötig
      ziel = d.kp;
    }
    var verdict, color, advice;

    if (d.score >= 75) {
      verdict = 'KAUFEN';
      color = 'qc-rec-green';
      advice = 'Die Kennzahlen passen — Kauf bei <strong>' + _fmtEur(d.kp) + '</strong> ist gerechtfertigt. ' +
               'Vor Kaufvertrag noch: Bonität checken, Hausgeld-Aufstellung anfordern, ' +
               'Eigentümerprotokolle der letzten 3 Jahre prüfen, Energieausweis verifizieren.';
    } else if (d.score >= 60) {
      verdict = 'VERHANDELN';
      color = 'qc-rec-gold';
      if (ziel < d.kp) {
        var diffPct = Math.round((1 - ziel / d.kp) * 100);
        var diffEur = Math.round(d.kp - ziel);
        advice = 'Aktuell solide aber mit Spielraum. Bei einem Kaufpreis von <strong>' + _fmtEur(ziel) + '</strong> ' +
                 '(' + diffPct + '% Nachlass = ' + _fmtEur(diffEur) + ' weniger) wäre der Deal klar gut. ' +
                 'Empfehlung: Verhandle den KP runter oder schau ob du die Miete steigern kannst.';
      } else {
        advice = 'Solide Kennzahlen — am aktuellen Preis brauchst du nicht viel Verhandlungs-Spielraum. ' +
                 'Trotzdem: Hausgeld-Aufstellung, Protokolle, Energieausweis prüfen.';
      }
    } else if (d.score >= 40) {
      verdict = 'KRITISCH';
      color = 'qc-rec-red';
      if (ziel < d.kp) {
        var diffPct2 = Math.round((1 - ziel / d.kp) * 100);
        var diffEur2 = Math.round(d.kp - ziel);
        advice = 'Die Kennzahlen sind zu schwach. Damit es ein Investment wird, müsste der Kaufpreis auf ' +
                 '<strong>' + _fmtEur(ziel) + '</strong> (' + diffPct2 + '% Nachlass = ' + _fmtEur(diffEur2) + ' weniger) runter — ' +
                 'oder die Miete deutlich steigen. ' +
                 (d.cfMon < 0 ? 'Negativer Cashflow von ' + Math.round(d.cfMon) + ' €/Mon ist ein klares Warnsignal. ' : '') +
                 'Eher passen oder hart verhandeln.';
      } else {
        advice = 'Die Kennzahlen sind schwach trotz angemessenem Preis — die Schwäche kommt aus anderen Faktoren ' +
                 '(Bewirtschaftung, Finanzierung, LTV). ' +
                 (d.cfMon < 0 ? 'Negativer Cashflow von ' + Math.round(d.cfMon) + ' €/Mon. ' : '') +
                 'Empfehlung: EK erhöhen, bessere Konditionen verhandeln oder anderes Objekt suchen.';
      }
    } else {
      verdict = 'PASS';
      color = 'qc-rec-red';
      advice = 'Klares Pass. Die Kennzahlen sind so weit weg von solide, dass auch starkes Verhandeln das nicht rettet. ' +
               (ziel < d.kp ? 'Bei einem Kaufpreis unter <strong>' + _fmtEur(ziel) + '</strong> könnte man drüber reden. ' : '') +
               'Empfehlung: Such ein anderes Objekt mit besserer Substanz.';
    }

    body.innerHTML =
      '<div class="qc-rec-verdict ' + color + '">' + verdict + '</div>' +
      '<div class="qc-rec-text">' + advice + '</div>';

    // V63.8: Empfehlung NICHT mehr im Tab Kennzahlen spiegeln (User-Wunsch).
    // Die Empfehlung erscheint nur noch im Quick-Check selbst.
    var kennzahlenBox = document.getElementById('kennzahlen-qc-recommendation');
    if (kennzahlenBox) {
      kennzahlenBox.style.display = 'none';
      kennzahlenBox.innerHTML = '';
    }
  }

  function _fmtEur(n) {
    if (!isFinite(n)) return '—';
    return Math.round(n).toLocaleString('de-DE') + ' €';
  }

  function _setQcCat(catId, score, valueText, details) {
    var box = document.getElementById('qc-cat-' + catId);
    if (!box) return;
    var bar = box.querySelector('.qc-cat-bar-fill') || box.querySelector('.ds2-metric-bar-fill');
    var val = box.querySelector('.qc-cat-v') || box.querySelector('.ds2-metric-score');
    var icoBox = box.querySelector('.ds2-metric-icon');

    if (score == null) {
      if (bar) bar.style.width = '0%';
      if (val) val.innerHTML = '<span class="qc-cat-num">–</span><span class="qc-cat-max">/100</span>';
      if (icoBox) { icoBox.style.color = '#9C9C9C'; icoBox.style.borderColor = '#9C9C9C40'; }
      box.classList.remove('qc-cat-green', 'qc-cat-gold', 'qc-cat-red');
      box.removeAttribute('title');
      return;
    }

    var color = score >= 75 ? '#2FBE6E' : score >= 50 ? '#E5BD53' : '#D55B5B';
    if (bar) {
      bar.style.width = score + '%';
      bar.style.background = color;
    }
    // V54: Score-Wert klar getrennt formatieren — große Zahl gold, "/100" klein/gedämpft
    if (val) {
      val.innerHTML = '<span class="qc-cat-num">' + score + '</span><span class="qc-cat-max">/100</span>';
    }
    // V54: Tooltip mit Berechnungsdetails (welche Werte fließen ein)
    if (details) {
      box.setAttribute('title', details);
    }
    if (icoBox) {
      icoBox.style.color = color;
      icoBox.style.borderColor = color + '40';
      // Icon nachladen falls Icons-Lib da ist
      if (!icoBox.querySelector('svg') && window.Icons) {
        var iconName = icoBox.getAttribute('data-qc-icon');
        if (iconName && Icons[iconName]) icoBox.innerHTML = Icons[iconName]({ size: 20 });
      }
    }
    box.classList.remove('qc-cat-green', 'qc-cat-gold', 'qc-cat-red');
    if (score >= 75) box.classList.add('qc-cat-green');
    else if (score >= 50) box.classList.add('qc-cat-gold');
    else box.classList.add('qc-cat-red');
    if (valueText) box.title = valueText;
  }

  function qcSetLtv(ltvPct) {
    function v(id) { var e = document.getElementById(id); return e ? e.value : ''; }
    function n(id) { return (typeof parseDe === 'function') ? parseDe(v(id)) : (parseFloat((v(id)||'').replace(',', '.')) || 0); }

    var kp = n('qc_kp');
    var knkP = n('qc_knk') || 10.5;

    document.querySelectorAll('.qc-ltv-btn').forEach(function(b) {
      b.classList.toggle('active', parseInt(b.getAttribute('data-ltv')) === ltvPct);
    });

    if (!kp) {
      var hint = document.getElementById('qc-ek-hint');
      if (hint) hint.textContent = 'Erst Kaufpreis eintragen';
      return;
    }

    // V43: Wenn EK-Feld bereits manuell oder per KI befüllt ist, nicht überschreiben.
    // Erkennbar an: Feld hat Wert UND data-user-set="1" oder data-ai-set="1"
    var inp = document.getElementById('qc_ek');
    if (inp && inp.value && (inp.dataset.userSet === '1' || inp.dataset.aiSet === '1')) {
      // User hat schon einen Wert eingetragen — bestätigen ob überschreiben
      if (!confirm('Eigenkapital ist bereits gesetzt (' + inp.value + ' €). Trotzdem überschreiben?')) {
        // Active-Button-Markierung zurück
        document.querySelectorAll('.qc-ltv-btn').forEach(function(b) { b.classList.remove('active'); });
        return;
      }
    }

    var nk = kp * (knkP / 100);
    var ekKp = kp * (1 - ltvPct / 100);
    var ek = ekKp + nk;
    if (inp) {
      inp.value = String(Math.round(ek));
      delete inp.dataset.userSet;
      delete inp.dataset.aiSet;
    }
    var hint2 = document.getElementById('qc-ek-hint');
    if (hint2) {
      if (ltvPct === 100) {
        hint2.innerHTML = '100% LTV: nur Nebenkosten ' + Math.round(nk).toLocaleString('de-DE') + ' € als EK';
      } else {
        hint2.innerHTML = ltvPct + '% LTV: ' + Math.round(ekKp).toLocaleString('de-DE') + ' € EK + ' + Math.round(nk).toLocaleString('de-DE') + ' € NK';
      }
    }
    qcCalc();
  }

  function qcEkChanged() {
    document.querySelectorAll('.qc-ltv-btn').forEach(function(b) { b.classList.remove('active'); });
    // V43: Markieren als user-gesetzt
    var ekInp = document.getElementById('qc_ek');
    if (ekInp) ekInp.dataset.userSet = '1';
    var hint = document.getElementById('qc-ek-hint');
    if (hint) hint.textContent = 'Manuell — LTV-Buttons setzen automatisch passenden Wert';
    qcCalc();
  }

  // V63.24: Monat/Jahr-Umschaltung für EUR-Modus
  function qcBewirtPeriod(period) {
    // 'y' = Jahr (Default), 'm' = Monat
    var hidden = document.getElementById('qc_bewirt_period');
    var btnY = document.getElementById('qc-bewirt-period-y');
    var btnM = document.getElementById('qc-bewirt-period-m');
    var labels = document.querySelectorAll('.qc-bewirt-period-label');
    if (!hidden) return;
    var oldPeriod = hidden.value || 'y';
    if (oldPeriod === period) return;
    hidden.value = period;
    if (btnY && btnM) {
      btnY.classList.toggle('active', period === 'y');
      btnM.classList.toggle('active', period === 'm');
    }
    labels.forEach(function(el) { el.textContent = (period === 'm' ? 'Monat' : 'Jahr'); });
    // Werte umrechnen wenn schon befüllt
    function _val(id) {
      var e = document.getElementById(id);
      if (!e) return 0;
      return (typeof parseDe === 'function') ? parseDe(e.value) : (parseFloat((e.value||'').replace(',','.')) || 0);
    }
    var nul = _val('qc_nul');
    var ul  = _val('qc_ul');
    var nulInp = document.getElementById('qc_nul');
    var ulInp  = document.getElementById('qc_ul');
    if (period === 'm' && oldPeriod === 'y') {
      // Jahr → Monat
      if (nulInp && nul) nulInp.value = String(Math.round(nul / 12));
      if (ulInp  && ul)  ulInp.value  = String(Math.round(ul / 12));
    } else if (period === 'y' && oldPeriod === 'm') {
      // Monat → Jahr
      if (nulInp && nul) nulInp.value = String(Math.round(nul * 12));
      if (ulInp  && ul)  ulInp.value  = String(Math.round(ul * 12));
    }
    if (typeof qcCalc === 'function') qcCalc();
  }
  window.qcBewirtPeriod = qcBewirtPeriod;

  // V207: qcBewirtMode war für Modi-Picker — Picker ist raus, Mode ist immer 'hg'.
  // Funktion bleibt als No-Op für alte Saves / externe Code-Pfade (no-throw).
  function qcBewirtMode(mode) {
    // No-Op — Modi-Picker wurde in V207 entfernt.
    // Sicherheitshalber Mode-Feld auf 'hg' setzen falls jemand was anderes versucht.
    var modeInp = document.getElementById('qc_bewirt_mode');
    if (modeInp) modeInp.value = 'hg';
    if (typeof qcCalc === 'function') qcCalc();
  }

  async function qcAiFillAll() {
    function v(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
    function n(id) { return (typeof parseDe === 'function') ? parseDe(v(id)) : (parseFloat((v(id)||'').replace(',', '.')) || 0); }

    var ctx = {
      adresse: v('qc_adresse'),
      ort: '',
      kaufpreis: n('qc_kp'),
      wohnflaeche: n('qc_wfl'),
      baujahr: parseInt(v('qc_bj')) || 0
    };
    if (ctx.adresse) {
      var m = ctx.adresse.match(/(\d{5})\s+(.+?)(?:[,;]|$)/);
      if (m) ctx.ort = m[2].trim();
      else {
        var p = ctx.adresse.split(',');
        if (p.length >= 2) ctx.ort = p[p.length - 1].replace(/\d{5}/, '').trim();
      }
    }
    if (!ctx.ort && !ctx.adresse) {
      if (typeof toast === 'function') toast('⚠ Bitte zuerst Adresse oder PLZ+Ort eintragen.');
      return;
    }

    var btn = document.getElementById('qc-ai-fill-all');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span style="font-size:14px">⏳</span> KI recherchiert…'; }

    try {
      var groups = ['rent', 'mgmt', 'finance'];
      var results = await Promise.all(groups.map(function(g) {
        return fetch('/api/v1/ai/qc-suggest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (localStorage.getItem('ji_token') || '')
          },
          body: JSON.stringify({ group: g, context: ctx, userApiKey: _userApiKey() })
        }).then(function(r) { return r.json().catch(function(){ return {}; }); });
      }));

      var combined = {};
      results.forEach(function(r) {
        if (r && r.suggestions) Object.assign(combined, r.suggestions);
      });

      // V44: Source-Sammlung statt Mini-Boxen pro Feld → in qc-ki-detail unter Donut
      var collected = [];

      if (combined.nettokaltmiete) {
        var inp = document.getElementById('qc_nkm');
        if (inp) { inp.value = String(Math.round(combined.nettokaltmiete.value)); inp.dataset.aiSet = '1'; }
        collected.push({ label: 'Nettokaltmiete', value: Math.round(combined.nettokaltmiete.value) + ' €/Mon', sugg: combined.nettokaltmiete });
      }
      if (combined.instandhaltung_pct || combined.verwaltung_pct) {
        qcBewirtMode('pct');
        var nulPct = ((combined.verwaltung_pct && combined.verwaltung_pct.value) || 4) +
                     ((combined.instandhaltung_pct && combined.instandhaltung_pct.value) || 8) + 2;
        var ulPct = 8;
        var nulInp = document.getElementById('qc_nul');
        var ulInp  = document.getElementById('qc_ul');
        if (nulInp) { nulInp.value = nulPct.toFixed(1).replace('.', ','); nulInp.dataset.aiSet = '1'; }
        if (ulInp)  { ulInp.value  = ulPct.toFixed(1).replace('.', ',');  ulInp.dataset.aiSet  = '1'; }
        if (combined.verwaltung_pct) collected.push({
          label: 'Bewirtschaftung (nicht umlagefähig)',
          value: nulPct.toFixed(1).replace('.', ',') + ' % NKM',
          sugg: combined.verwaltung_pct
        });
        if (combined.instandhaltung_pct) collected.push({
          label: 'Instandhaltung',
          value: combined.instandhaltung_pct.value.toFixed(1).replace('.', ',') + ' % NKM',
          sugg: combined.instandhaltung_pct
        });
      }
      if (combined.zinssatz) {
        var z = document.getElementById('qc_zins');
        if (z) { z.value = combined.zinssatz.value.toFixed(2).replace('.', ','); z.dataset.aiSet = '1'; }
        collected.push({ label: 'Zinssatz', value: combined.zinssatz.value.toFixed(2).replace('.', ',') + ' %', sugg: combined.zinssatz });
      }
      if (combined.tilgung) {
        var t = document.getElementById('qc_tilg');
        if (t) { t.value = combined.tilgung.value.toFixed(1).replace('.', ','); t.dataset.aiSet = '1'; }
        collected.push({ label: 'Tilgung', value: combined.tilgung.value.toFixed(1).replace('.', ',') + ' %', sugg: combined.tilgung });
      }
      _qcRenderKiDetail(collected);
      qcCalc();
      var nn = Object.keys(combined).length;
      if (typeof toast === 'function') toast('✓ KI hat ' + nn + ' Feld' + (nn===1?'':'er') + ' befüllt — Quellen unter dem Score');
    } catch (err) {
      if (typeof toast === 'function') toast('⚠ KI-Fehler: ' + (err.message || 'unbekannt'));
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<span style="font-size:14px">✨</span> Werte mit KI recherchieren'; }
    }
  }

  /**
   * V44: KI-Detail-Box rendern mit allen Quellen + Reasoning
   * (ersetzt die einzelnen Mini-Source-Boxen unter den Feldern)
   */
  function _qcRenderKiDetail(items) {
    var box = document.getElementById('qc-ki-detail');
    var body = document.getElementById('qc-ki-detail-body');
    if (!box || !body) return;
    if (!items || items.length === 0) { box.style.display = 'none'; return; }

    body.innerHTML = items.map(function(it) {
      var src = it.sugg && it.sugg.source ? it.sugg.source : 'KI-Recherche';
      var reasoning = it.sugg && it.sugg.reasoning ? it.sugg.reasoning : '';
      var srcHtml;
      if (typeof window._ds2RenderSourceLink === 'function') {
        srcHtml = window._ds2RenderSourceLink(src);
      } else {
        srcHtml = '<strong>' + _escHtmlQc(src) + '</strong>';
      }
      return '<div class="qc-ki-detail-row">' +
        '<div class="qc-ki-detail-label">' + _escHtmlQc(it.label) + '</div>' +
        '<div class="qc-ki-detail-value">' + _escHtmlQc(it.value) + '</div>' +
        '<div class="qc-ki-detail-src">' + srcHtml + (reasoning ? ' · <span class="qc-ki-detail-reason">' + _escHtmlQc(reasoning) + '</span>' : '') + '</div>' +
      '</div>';
    }).join('');
    box.style.display = '';
  }

  function _userApiKey() {
    try { return JSON.parse(localStorage.getItem('dp_user_settings') || '{}').openaiApiKey || ''; }
    catch(e) { return ''; }
  }

  function _qcShowMiniSrc(fieldId, sugg) {
    var inp = document.getElementById(fieldId);
    if (!inp) return;
    var parent = inp.closest('.qc-field') || inp.parentElement;
    if (!parent) return;
    var existing = parent.querySelector('.qc-ai-src');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.className = 'qc-ai-src';
    var src = sugg.source || 'KI-Recherche';
    var reasoning = sugg.reasoning || '';
    var srcHtml;
    if (typeof window._ds2RenderSourceLink === 'function') {
      srcHtml = window._ds2RenderSourceLink(src);
    } else {
      srcHtml = '<strong>' + _escHtmlQc(src) + '</strong>';
    }
    el.innerHTML = '<span class="qc-ai-src-icon">✨</span><span class="qc-ai-src-text">' + srcHtml + (reasoning ? ' · ' + _escHtmlQc(reasoning) : '') + '</span>';
    parent.appendChild(el);

    // V43: Wenn User das Feld manuell editiert → KI-Markierung + Source-Box entfernen
    // (sonst zeigt die Source eine Quelle die nicht mehr zum Wert passt)
    inp.dataset.aiSet = '1';
    inp.dataset.userTouched = '0';
    var aiValue = inp.value;
    var onUserEdit = function() {
      if (inp.value !== aiValue && inp.dataset.userTouched !== '1') {
        inp.dataset.userTouched = '1';
        inp.dataset.aiSet = '0';
        var box = parent.querySelector('.qc-ai-src');
        if (box) box.remove();
      }
    };
    inp.addEventListener('input', onUserEdit);
  }

  // V197: Schließt die KI-Info-Box
  function qcCloseAiInfo() {
    var box = document.getElementById('qc-ai-info-box');
    if (box) box.style.display = 'none';
  }

  // V197: KI-Recherche mit Quellen + Konfidenz-Score.
  // Holt Marktmiete (übernehmbar in qc_nkm) + Lage-Score + Bodenrichtwert
  // + Wertentwicklung (informativ, kein Feld). Bei Konfidenz < 60% wird
  // statt einem Wert ein "Nicht aussagekräftig"-Hinweis gezeigt.
  async function qcAiResearchInfo() {
    function v(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
    function n(id) { return (typeof parseDe === 'function') ? parseDe(v(id)) : (parseFloat((v(id)||'').replace(',', '.')) || 0); }

    var plz = v('qc_plz');
    var ort = v('qc_ort');
    var str = v('qc_str');
    var hnr = v('qc_hnr');

    if (!plz && !ort) {
      if (typeof toast === 'function') toast('⚠ Bitte zuerst PLZ + Ort eintragen.');
      return;
    }

    var ctx = {
      adresse: (str + (hnr ? ' ' + hnr : '') + (str || hnr ? ', ' : '') + plz + ' ' + ort).trim(),
      plz: plz,
      ort: ort,
      strasse: str,
      hausnr: hnr,
      kaufpreis: n('qc_kp'),
      wohnflaeche: n('qc_wfl'),
      baujahr: parseInt(v('qc_bj')) || 0,
      objektart: v('qc_objektart') || ''
    };

    var btn = document.getElementById('qc-ai-research-btn');
    var origBtnText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span style="font-size:14px">⏳</span> KI recherchiert…';
    }

    // Info-Box öffnen mit Loading-State
    var box = document.getElementById('qc-ai-info-box');
    var content = document.getElementById('qc-ai-info-content');
    if (box) box.style.display = 'block';
    if (content) {
      content.innerHTML = '<div style="padding:20px;text-align:center;color:#7A7370">' +
        '<div style="font-size:24px;margin-bottom:8px">⏳</div>' +
        '<div>KI recherchiert Marktmiete, Lage-Score, Bodenrichtwert…</div>' +
        '<div style="font-size:12px;margin-top:6px;font-style:italic">Dauert ~5-15 Sekunden</div>' +
      '</div>';
    }

    try {
      // V199: Parallel alle 3 Groups holen (rent + mgmt + finance) für volle
      // Recherche inkl. Bewirtschaftungs-Annahme + Marktzins.
      var groups = ['rent', 'mgmt', 'finance'];
      var results = await Promise.all(groups.map(function(g) {
        return fetch('/api/v1/ai/qc-suggest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (localStorage.getItem('ji_token') || '')
          },
          body: JSON.stringify({
            group: g,
            context: ctx,
            userApiKey: _userApiKey(),
            extra: g === 'rent' ? ['lage_score', 'bodenrichtwert', 'wertentwicklung'] : undefined
          })
        }).then(function(r) { return r.json().catch(function(){ return {}; }); });
      }));

      // Alle Suggestions zusammenführen
      var suggestions = {};
      results.forEach(function(r) {
        if (r && r.suggestions) Object.assign(suggestions, r.suggestions);
      });

      // V199: Source-Link-Helper — nutzt _ds2RenderSourceLink wenn verfügbar,
      // sonst plain text. Liefert renderbares HTML für die Source-Zeile.
      function _renderSrcLine(label, source) {
        if (!source) return '';
        var srcHtml;
        if (typeof window._ds2RenderSourceLink === 'function') {
          srcHtml = window._ds2RenderSourceLink(source);
        } else {
          srcHtml = _escHtmlQc(source);
        }
        return '<div class="qc-ai-result-source">' + label + ': ' + srcHtml + '</div>';
      }

      // V207: Bewirtschaftung übernehmen — single mode (Hausgeld + NUL-Split).
      // Backend liefert ab V207: hausgeld_pct (% NKM) + nul_pct (% vom HG).
      // Backward-Compat: instandhaltung_pct/verwaltung_pct werden alternativ akzeptiert.
      try {
        var hgSugg  = suggestions.hausgeld_pct;
        var nulSugg = suggestions.nul_pct;
        // Backward-Compat zu V206-Antwort
        var legacyNul = suggestions.instandhaltung_pct;
        var legacyUl  = suggestions.verwaltung_pct || suggestions.umlagefaehig_pct;

        console.log('[V207 bewirt] KI-Suggestions:', { hg: hgSugg, nul: nulSugg, legacyNul, legacyUl });

        var nkmMon = n('qc_nkm');
        if (nkmMon <= 0) {
          console.log('[V207 bewirt] qc_nkm leer/0 — kann nichts berechnen');
        } else {
          // Werte ermitteln
          var hgPctVal, nulPctVal, quelle, isAi;

          if (hgSugg && hgSugg.value != null && nulSugg && nulSugg.value != null) {
            // V207 Backend
            hgPctVal  = Number(hgSugg.value);
            nulPctVal = Number(nulSugg.value);
            quelle = hgSugg.source || nulSugg.source || 'KI-Schätzung';
            isAi = true;
            console.log('[V207 bewirt] Aus V207-KI: HG=' + hgPctVal + '% NKM, NUL=' + nulPctVal + '% vom HG');
          } else if (legacyNul && legacyNul.value != null) {
            // V206-Backend-Antwort: instandhaltung_pct = % NKM (nicht-umlagef.)
            // → konvertieren: Gesamt-HG schätzen aus (NUL + UL), NUL-Anteil davon ableiten
            var legNul = Number(legacyNul.value);
            var legUl  = (legacyUl && legacyUl.value != null) ? Number(legacyUl.value) : 4.5;
            var totalPctNkm = legNul + legUl;
            hgPctVal = totalPctNkm;
            nulPctVal = totalPctNkm > 0 ? Math.round(legNul / totalPctNkm * 100) : 22;
            quelle = legacyNul.source || legacyUl?.source || 'KI-Schätzung (Legacy-Format)';
            isAi = true;
            console.log('[V207 bewirt] Legacy-V206-Format konvertiert: HG=' + hgPctVal + '%, NUL=' + nulPctVal + '%');
          } else {
            // Faustregel-Fallback
            hgPctVal  = 26;
            nulPctVal = 22;
            quelle = 'Faustregel IVD (Hausgeld 26% NKM · nicht-umlagef. 22% vom HG)';
            isAi = false;
            console.log('[V207 bewirt] Faustregel-Fallback: HG=26%, NUL=22%');
          }

          // In Felder schreiben (nur wenn nicht user-gesetzt)
          var hgInput = document.getElementById('qc_hg');
          var hgSplit = document.getElementById('qc_hg_split');
          var hgMon = Math.round(nkmMon * (hgPctVal / 100));

          if (hgInput && hgInput.dataset.userSet !== '1') {
            hgInput.value = String(hgMon);
            hgInput.dataset.aiSet = '1';
            try { hgInput.dispatchEvent(new Event('input', { bubbles: true })); } catch(e){}
          }
          if (hgSplit && hgSplit.dataset.userSet !== '1') {
            hgSplit.value = String(Math.round(nulPctVal));
            hgSplit.dataset.aiSet = '1';
            try { hgSplit.dispatchEvent(new Event('input', { bubbles: true })); } catch(e){}
          }

          // Source-Annotation
          if (hgInput) {
            var hgParent = hgInput.closest('.qc-field');
            if (hgParent) {
              var ex = hgParent.querySelector('.qc-ai-src');
              if (ex) ex.remove();
              var hgSrc = document.createElement('div');
              hgSrc.className = 'qc-ai-src';
              hgSrc.style.cssText = 'display:block;font-size:11px;color:#7A7370;margin-top:4px;font-style:italic';
              var lbl = isAi ? '✨ KI-Schätzung' : '📐 Faustregel';
              hgSrc.innerHTML = lbl + ' — ' +
                (typeof window._ds2RenderSourceLink === 'function' && isAi ?
                  window._ds2RenderSourceLink(quelle) : _escHtmlQc(quelle));
              hgParent.appendChild(hgSrc);
            }
          }
          console.log('[V207 bewirt] OK — HG=' + hgMon + '€/Mo (=' + hgPctVal + '% NKM), Split=' + nulPctVal + '%');

          // In KI-Info-Box eine Bewirt-Karte zeigen
          suggestions._bewirtCard = {
            hausgeld: hgMon, hgPct: hgPctVal, nulPct: nulPctVal,
            source: quelle, isAi: isAi
          };
        }
      } catch(e) { console.warn('[v207 bewirt-apply]', e); }

      // V199: Marktzinsen automatisch übernehmen
      try {
        var zins = suggestions.zinssatz || suggestions.zins;
        var zinsInput = document.getElementById('qc_zins');
        if (zins && zins.value && zinsInput && !zinsInput.dataset.userSet) {
          var zinsVal = Number(zins.value);
          if (zinsVal > 0 && zinsVal < 15) { // Sanity 0-15%
            zinsInput.value = zinsVal.toFixed(2).replace('.', ',');
            zinsInput.dataset.aiSet = '1';
            var zinsParent = zinsInput.closest('.qc-field');
            if (zinsParent && !zinsParent.querySelector('.qc-ai-src')) {
              var zinsSrc = document.createElement('span');
              zinsSrc.className = 'qc-ai-src';
              zinsSrc.style.cssText = 'display:block;font-size:11px;color:#7A7370;margin-top:4px;font-style:italic';
              zinsSrc.innerHTML = '✨ Marktzins — Quelle: ' +
                (typeof window._ds2RenderSourceLink === 'function' ?
                  window._ds2RenderSourceLink(zins.source || 'Interhyp') :
                  _escHtmlQc(zins.source || 'Interhyp'));
              zinsParent.appendChild(zinsSrc);
            }
          }
        }
      } catch(e) { console.warn('[v199 zins-apply]', e); }

      // V199: qcCalc triggern, damit Score-Anzeige + KPIs sich aktualisieren
      try { if (typeof qcCalc === 'function') qcCalc(); } catch(e){}

      // Konfidenz-Scores extrahieren (Backend liefert evtl. confidence 0-1)
      // Schwellwert: < 0.6 = nicht aussagekräftig
      var CONFIDENCE_THRESHOLD = 0.6;

      var html = '';

      // ────── 1) MARKTMIETE (übernehmbar) ─────────────────────────────
      var nkmSugg = suggestions.nettokaltmiete || suggestions.marktmiete;
      if (nkmSugg && nkmSugg.value) {
        var conf = typeof nkmSugg.confidence === 'number' ? nkmSugg.confidence : 0.7;
        var wfl = ctx.wohnflaeche || 0;
        var miePerSqm = wfl > 0 ? (nkmSugg.value / wfl) : null;
        if (conf >= CONFIDENCE_THRESHOLD) {
          html += '<div class="qc-ai-result-card">' +
            '<div class="qc-ai-result-head">' +
              '<span class="qc-ai-result-icon">💶</span>' +
              '<span class="qc-ai-result-label">Marktmiete (NKM)</span>' +
              _renderConfBadge(conf) +
            '</div>' +
            '<div class="qc-ai-result-value">' +
              Math.round(nkmSugg.value).toLocaleString('de-DE') + ' € / Monat' +
              (miePerSqm ? ' <span class="qc-ai-result-sub">≈ ' + miePerSqm.toFixed(2).replace('.', ',') + ' €/m²</span>' : '') +
            '</div>' +
            _renderSrcLine('Quelle', nkmSugg.source) +
            (nkmSugg.reasoning ? '<div class="qc-ai-result-reasoning">' + _escHtmlQc(nkmSugg.reasoning) + '</div>' : '') +
            '<button type="button" class="btn btn-gold btn-sm qc-ai-apply" onclick="qcApplyAiMiete(' + Math.round(nkmSugg.value) + ')">' +
              '✓ In Mietfeld übernehmen' +
            '</button>' +
          '</div>';
        } else {
          html += _renderLowConfCard('Marktmiete', conf, nkmSugg.source);
        }
      }

      // ────── 2) LAGE-SCORE (informativ) ──────────────────────────────
      var lage = suggestions.lage_score || suggestions.lagescore;
      if (lage && lage.value != null) {
        var lconf = typeof lage.confidence === 'number' ? lage.confidence : 0.7;
        if (lconf >= CONFIDENCE_THRESHOLD) {
          var lageVal = Math.round(lage.value);
          var lageColor = lageVal >= 7 ? '#3FA56C' : lageVal >= 4 ? '#C9A84C' : '#B8625C';
          html += '<div class="qc-ai-result-card">' +
            '<div class="qc-ai-result-head">' +
              '<span class="qc-ai-result-icon">📍</span>' +
              '<span class="qc-ai-result-label">Lage-Score</span>' +
              _renderConfBadge(lconf) +
            '</div>' +
            '<div class="qc-ai-result-value">' +
              '<span style="color:' + lageColor + '">' + lageVal + '</span>' +
              ' <span class="qc-ai-result-sub">/ 10</span>' +
            '</div>' +
            _renderSrcLine('Quelle', lage.source) +
            (lage.reasoning ? '<div class="qc-ai-result-reasoning">' + _escHtmlQc(lage.reasoning) + '</div>' : '') +
          '</div>';
        } else {
          html += _renderLowConfCard('Lage-Score', lconf, lage.source);
        }
      }

      // ────── 3) BODENRICHTWERT (informativ) ──────────────────────────
      var bw = suggestions.bodenrichtwert;
      if (bw && bw.value) {
        var bconf = typeof bw.confidence === 'number' ? bw.confidence : 0.7;
        if (bconf >= CONFIDENCE_THRESHOLD) {
          html += '<div class="qc-ai-result-card">' +
            '<div class="qc-ai-result-head">' +
              '<span class="qc-ai-result-icon">🗺️</span>' +
              '<span class="qc-ai-result-label">Bodenrichtwert</span>' +
              _renderConfBadge(bconf) +
            '</div>' +
            '<div class="qc-ai-result-value">' +
              Math.round(bw.value).toLocaleString('de-DE') + ' € / m²' +
            '</div>' +
            _renderSrcLine('Quelle', bw.source) +
            (bw.reasoning ? '<div class="qc-ai-result-reasoning">' + _escHtmlQc(bw.reasoning) + '</div>' : '') +
          '</div>';
        } else {
          html += _renderLowConfCard('Bodenrichtwert', bconf, bw.source);
        }
      }

      // ────── 4) WERTENTWICKLUNG-PROGNOSE (informativ) ────────────────
      var wert = suggestions.wertentwicklung || suggestions.wertentwicklung_prognose;
      if (wert && (wert.value != null || wert.text)) {
        var wconf = typeof wert.confidence === 'number' ? wert.confidence : 0.6;
        if (wconf >= CONFIDENCE_THRESHOLD) {
          var wertText = wert.text || (wert.value > 0 ? '+' + wert.value : wert.value) + ' % p.a.';
          html += '<div class="qc-ai-result-card">' +
            '<div class="qc-ai-result-head">' +
              '<span class="qc-ai-result-icon">📈</span>' +
              '<span class="qc-ai-result-label">Wertentwicklung-Prognose</span>' +
              _renderConfBadge(wconf) +
            '</div>' +
            '<div class="qc-ai-result-value">' + _escHtmlQc(wertText) + '</div>' +
            _renderSrcLine('Quelle', wert.source) +
            (wert.reasoning ? '<div class="qc-ai-result-reasoning">' + _escHtmlQc(wert.reasoning) + '</div>' : '') +
          '</div>';
        } else {
          html += _renderLowConfCard('Wertentwicklung-Prognose', wconf, wert.source);
        }
      }

      // V207: Bewirtschaftungs-Karte zeigen wenn übernommen
      var bewirtCard = suggestions._bewirtCard;
      if (bewirtCard) {
        var bIsFaust = !bewirtCard.isAi;
        var hgPctVisual  = bewirtCard.hgPct != null ? bewirtCard.hgPct : (bewirtCard.totalPct || 0);
        var nulPctVisual = bewirtCard.nulPct != null ? bewirtCard.nulPct : 22;
        html += '<div class="qc-ai-result-card">' +
          '<div class="qc-ai-result-head">' +
            '<span class="qc-ai-result-icon">' + (bIsFaust ? '📐' : '🏠') + '</span>' +
            '<span class="qc-ai-result-label">Bewirtschaftung übernommen</span>' +
            (bIsFaust ?
              '<span class="qc-ai-conf-badge" style="background:#C9A84C20;color:#C9A84C;border:1px solid #C9A84C40">Faustregel</span>' :
              '<span class="qc-ai-conf-badge" style="background:#3FA56C20;color:#3FA56C;border:1px solid #3FA56C40">KI-Schätzung</span>') +
          '</div>' +
          '<div class="qc-ai-result-value">' +
            (bewirtCard.hausgeld || 0).toLocaleString('de-DE') + ' € / Monat' +
            ' <span class="qc-ai-result-sub">≈ ' + (Number(hgPctVisual)).toFixed(0) + ' % der NKM</span>' +
          '</div>' +
          '<div class="qc-ai-result-reasoning">' +
            'Davon nicht-umlagefähig: ' + Math.round(nulPctVisual) + ' % vom Hausgeld' +
            (bIsFaust ? ' · Faustregel: HG 26% NKM · NUL 22% vom HG' : '') +
          '</div>' +
          _renderSrcLine('Quelle', bewirtCard.source) +
        '</div>';
      }

      if (!html) {
        html = '<div style="padding:20px;text-align:center;color:#7A7370">' +
          '<div style="font-size:24px;margin-bottom:8px">⚠️</div>' +
          '<div>KI konnte keine verlässlichen Werte ermitteln.</div>' +
          '<div style="font-size:12px;margin-top:6px;font-style:italic">Bitte Adresse + Eckdaten prüfen oder Werte manuell eintragen.</div>' +
        '</div>';
      }

      if (content) content.innerHTML = html;

    } catch (err) {
      console.error('[qc-ai-research]', err);
      if (content) {
        content.innerHTML = '<div style="padding:20px;text-align:center;color:#B8625C">' +
          '<div style="font-size:24px;margin-bottom:8px">⚠️</div>' +
          '<div>Fehler bei der KI-Recherche</div>' +
          '<div style="font-size:12px;margin-top:6px">' + _escHtmlQc(err.message || 'Unbekannter Fehler') + '</div>' +
        '</div>';
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origBtnText;
      }
    }
  }

  // V197: Konfidenz-Badge (visualisiert 0-1 als Prozent + Farbe)
  function _renderConfBadge(conf) {
    var pct = Math.round(conf * 100);
    var color, label;
    if (pct >= 80) { color = '#3FA56C'; label = 'Hoch'; }
    else if (pct >= 60) { color = '#C9A84C'; label = 'Mittel'; }
    else { color = '#B8625C'; label = 'Niedrig'; }
    return '<span class="qc-ai-conf-badge" style="background:' + color + '20;color:' + color + ';border:1px solid ' + color + '40">' +
      'Konfidenz: ' + pct + ' % (' + label + ')' +
    '</span>';
  }

  // V197: "Nicht aussagekräftig"-Karte für Konfidenz < 60%
  function _renderLowConfCard(label, conf, source) {
    var pct = Math.round(conf * 100);
    return '<div class="qc-ai-result-card qc-ai-result-card-low">' +
      '<div class="qc-ai-result-head">' +
        '<span class="qc-ai-result-icon">⚠️</span>' +
        '<span class="qc-ai-result-label">' + _escHtmlQc(label) + '</span>' +
        '<span class="qc-ai-conf-badge" style="background:#B8625C20;color:#B8625C;border:1px solid #B8625C40">' +
          'Konfidenz: ' + pct + ' %' +
        '</span>' +
      '</div>' +
      '<div class="qc-ai-result-value" style="color:#7A7370;font-style:italic;font-size:13px">' +
        'Nicht aussagekräftig — KI hat zu wenig verlässliche Datenpunkte.' +
      '</div>' +
      (source ? '<div class="qc-ai-result-source">' +
        (typeof window._ds2RenderSourceLink === 'function' ?
          window._ds2RenderSourceLink(source) : _escHtmlQc(source)) +
      '</div>' : '') +
    '</div>';
  }

  // V197: Übernimmt KI-Marktmiete in qc_nkm-Feld
  function qcApplyAiMiete(value) {
    var inp = document.getElementById('qc_nkm');
    if (!inp) return;
    inp.value = String(Math.round(value));
    inp.dataset.aiSet = '1';
    try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch(e){}
    if (typeof toast === 'function') toast('✓ Marktmiete übernommen');
    // Source-Annotation am Feld
    var parent = inp.closest('.qc-field');
    if (parent) {
      var existing = parent.querySelector('.qc-ai-src');
      if (existing) existing.remove();
      var el = document.createElement('div');
      el.className = 'qc-ai-src';
      el.innerHTML = '<span class="qc-ai-src-icon">✨</span><span class="qc-ai-src-text">Aus KI-Recherche übernommen</span>';
      parent.appendChild(el);
    }
  }

  function _escHtmlQc(s) {
    return ('' + (s == null ? '' : s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function qcHandlePhotos(files) {
    Array.from(files).forEach(function(f) {
      if (_qcImgs.length >= 6) return;
      var r = new FileReader();
      r.onload = function(e) {
        _qcImgs.push({ src: e.target.result, name: f.name });
        _qcRenderPhotos();
      };
      r.readAsDataURL(f);
    });
    var inp = document.getElementById('qc-photos-inp');
    if (inp) inp.value = '';
  }

  function _qcRenderPhotos() {
    function _doRender() {
      var grid = document.getElementById('qc-photos-grid');
      if (!grid) return false;
      grid.innerHTML = _qcImgs.map(function(img, i) {
        return '<div class="qc-photo-thumb">' +
          '<img src="' + img.src + '" alt="">' +
          '<button type="button" class="qc-photo-del" onclick="qcDelPhoto(' + i + ')" title="Foto entfernen">×</button>' +
        '</div>';
      }).join('');
      console.log('[QC] qc-photos-grid mit', _qcImgs.length, 'Fotos befüllt');
      return true;
    }
    // V61: Robust — sofort + 50ms + 200ms + 500ms versuchen
    if (_doRender()) return;
    setTimeout(function() { if (!_doRender()) {
      setTimeout(function() { if (!_doRender()) {
        setTimeout(_doRender, 500);
      } }, 200);
    } }, 50);
  }

  function qcDelPhoto(i) {
    _qcImgs.splice(i, 1);
    _qcRenderPhotos();
  }

  function qcSaveAsObject() {
    function v(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
    function n(id) { return (typeof parseDe === 'function') ? parseDe(v(id)) : (parseFloat((v(id)||'').replace(',', '.')) || 0); }

    // V63.9 KRITISCHER FIX: Erst ALLE qc_-Werte in einen Snapshot sammeln,
    // BEVOR newObj() die Felder leert. Dann den Snapshot zurück in die Hauptfelder schreiben.
    var snapshot = {
      // Pflichtfelder
      kp:           n('qc_kp'),
      nkm:          n('qc_nkm'),
      // Adresse
      adresse:      v('qc_adresse'),
      // Mieteinnahmen-Komponenten (V63.24: nkm_kueche dazu)
      nkm_grund:    n('qc_nkm_grund'),
      nkm_stp:      n('qc_nkm_stp'),
      nkm_garage:   n('qc_nkm_garage'),    // Backwards-Compat
      nkm_kueche:   n('qc_nkm_kueche'),
      nkm_sonst:    n('qc_nkm_sonst'),
      // Objektdaten
      wfl:          n('qc_wfl'),
      bj:           n('qc_bj'),
      ek:           n('qc_ek'),
      knk_pct:      n('qc_knk'),
      d1z:          n('qc_zins') || n('qc_zinsen'),
      d1t:          n('qc_tilg'),
      // Optional
      objektart:    v('qc_objektart'),
      energieklasse:v('qc_energieklasse'),
      zimmer:       v('qc_zimmer'),
      stellplatz:   v('qc_stellplatz'),
      bewirt_mode:  v('qc_bewirt_mode') || 'hg',
      bewirt_period: v('qc_bewirt_period') || 'y',     // V63.24
      nul_raw:      n('qc_nul'),
      ul_raw:       n('qc_ul')
    };

    if (!snapshot.kp || !snapshot.nkm) {
      if (typeof toast === 'function') toast('⚠ Kaufpreis und Nettokaltmiete sind Pflichtfelder.');
      return;
    }

    // V202: Vollständige Pflichtfeld-Validierung (Marcels Liste)
    // WICHTIG: Wir prüfen den ROHEN Feld-Wert über n(), das gibt 0 zurück wenn leer.
    // snapshot.d1z hat schon den Fallback eingebaut — daher hier nochmal direkt prüfen.
    var saveFehlt = [];
    if (!v('qc_plz').trim()) saveFehlt.push('PLZ');
    if (!v('qc_ort').trim()) saveFehlt.push('Ort');
    if (!n('qc_wfl'))        saveFehlt.push('Wohnfläche');
    if (!n('qc_ek'))         saveFehlt.push('Eigenkapital');
    if (!n('qc_zins'))       saveFehlt.push('Zinssatz');
    if (!n('qc_tilg'))       saveFehlt.push('Tilgung');
    if (!n('qc_hg'))         saveFehlt.push('Hausgeld');
    if (saveFehlt.length > 0) {
      var msg = '⚠ Bitte erst alle Pflichtfelder ausfüllen:\n\n' + saveFehlt.join(', ');
      if (typeof toast === 'function') {
        toast(msg);
      } else {
        alert(msg);
      }
      return;
    }

    // Adresse parsen
    var plz = '', ort = '', str = '', hnr = '';
    if (snapshot.adresse) {
      var parts = snapshot.adresse.split(',');
      if (parts.length >= 1) {
        var streetPart = parts[0].trim();
        var m = streetPart.match(/^(.+?)\s+(\d+\w*)$/);
        if (m) { str = m[1]; hnr = m[2]; } else { str = streetPart; }
      }
      if (parts.length >= 2) {
        var locPart = parts[1].trim();
        var m2 = locPart.match(/^(\d{5})\s+(.+)$/);
        if (m2) { plz = m2[1]; ort = m2[2]; } else { ort = locPart; }
      }
    }

    function set(id, val) { var e = document.getElementById(id); if (e) { e.value = val; } }

    // V63.9 KRITISCHER FIX: KEIN newObj() mehr aufrufen!
    // newObj() löscht alle DOM-Felder + setzt Defaults — das überschreibt unsere QC-Werte.
    // Stattdessen: nur die Hauptfelder befüllen, Werte bleiben in qc_-Feldern unangetastet.
    // Wenn der User noch nicht in einem aktiven Objekt war, bekommen wir trotzdem
    // eine gültige Objekt-Numerierung weil _currentObjSeq bereits gesetzt ist (Preview-Mode).

    // V63.9: Jetzt ALLE Werte aus Snapshot in Hauptfelder zurückschreiben
    if (str) set('str', str);
    if (hnr) set('hnr', hnr);
    if (plz) set('plz', plz);
    if (ort) set('ort', ort);
    set('kp',  String(snapshot.kp));
    // V63.24: NKM-Differenzierung
    // Tab Miete hat zwei Felder: nkm (Grundmiete) + ze (Zusatzeinnahmen).
    // Wenn Komponenten im QC ausgefüllt sind: nkm = nkm_grund, ze = stp+garage+kueche+sonst.
    // Sonst (Legacy) Gesamtbetrag in nkm und ze auf 0.
    var qcZusatz = (snapshot.nkm_stp || 0) + (snapshot.nkm_garage || 0) +
                   (snapshot.nkm_kueche || 0) + (snapshot.nkm_sonst || 0);
    if (snapshot.nkm_grund > 0) {
      set('nkm', String(Math.round(snapshot.nkm_grund)));
      if (qcZusatz > 0) set('ze', String(Math.round(qcZusatz)));
    } else {
      // Legacy: User hat nur Gesamtbetrag im qc_nkm
      set('nkm', String(snapshot.nkm));
    }
    if (snapshot.wfl)  set('wfl', String(snapshot.wfl));
    if (snapshot.bj)   set('baujahr', String(snapshot.bj));
    if (snapshot.ek)   set('ek', String(snapshot.ek));
    if (snapshot.d1z)  set('d1z', String(snapshot.d1z));
    if (snapshot.d1t)  set('d1t', String(snapshot.d1t));
    if (snapshot.knk_pct) set('ji_p', String(snapshot.knk_pct));

    // V63.53: Quick-Check übernimmt standardmäßig Annuitätendarlehen-Default
    // + Auszahlungsdatum aus Kaufdatum (falls vorhanden, sonst aktueller Monat)
    var d1TypeEl = document.getElementById('d1_type');
    if (d1TypeEl && !d1TypeEl.value) {
      d1TypeEl.value = 'annuitaet';
      try { d1TypeEl.dispatchEvent(new Event('change', { bubbles: true })); } catch(_) {}
    }
    var d1AuszahlEl = document.getElementById('d1_auszahl');
    if (d1AuszahlEl && !d1AuszahlEl.value) {
      var kaufdat = (document.getElementById('kaufdat') || {}).value;
      if (kaufdat && /^\d{2}\.\d{2}\.\d{4}$/.test(kaufdat)) {
        // DD.MM.YYYY → MM.YYYY
        var kdParts = kaufdat.split('.');
        d1AuszahlEl.value = kdParts[1] + '.' + kdParts[2];
      } else {
        var nowD = new Date();
        var mm = String(nowD.getMonth() + 1).padStart(2, '0');
        d1AuszahlEl.value = mm + '.' + nowD.getFullYear();
      }
    }
    // Anschluss-Defaults: optimistische Werte falls noch leer
    var anschlZEl = document.getElementById('anschl_z');
    if (anschlZEl && (!anschlZEl.value || parseFloat(anschlZEl.value) === 0)) {
      anschlZEl.value = '5';
    }
    var anschlTEl = document.getElementById('anschl_t');
    if (anschlTEl && (!anschlTEl.value || parseFloat(anschlTEl.value) === 0)) {
      anschlTEl.value = '1';
    }

    // Darlehen aus EK + KP
    if (snapshot.ek && snapshot.kp) {
      var darlehen = Math.max(0, snapshot.kp * 1.105 - snapshot.ek);
      set('d1', String(Math.round(darlehen)));
    }

    // Objektart
    if (snapshot.objektart) {
      var sel = document.getElementById('objart');
      if (sel) {
        var lowMap = { 'ETW': 'ETW', 'EFH': 'EFH', 'MFH': 'MFH', 'DHH': 'EFH', 'RH': 'EFH', 'Gewerbe': 'Gewerbe' };
        var target = lowMap[snapshot.objektart] || snapshot.objektart;
        for (var oi = 0; oi < sel.options.length; oi++) {
          if (sel.options[oi].value === target || sel.options[oi].text === target) {
            sel.selectedIndex = oi; break;
          }
        }
      }
    } else {
      // V63.31: Default ETW wenn der User keine Objektart gewählt hat
      // → sonst bleibt der Objekt-Tab im Workflow grau auch nach Save.
      var selDef = document.getElementById('objart');
      if (selDef && !selDef.value) {
        for (var oj = 0; oj < selDef.options.length; oj++) {
          if (selDef.options[oj].value === 'ETW') { selDef.selectedIndex = oj; break; }
        }
      }
    }
    if (snapshot.energieklasse) set('ds2_energie', snapshot.energieklasse.toUpperCase());

    // Zimmer + Stellplatz in 'thesis'
    var notesParts = [];
    if (snapshot.zimmer)     notesParts.push(snapshot.zimmer + '-Zimmer');
    if (snapshot.stellplatz) notesParts.push('Stellplatz: ' + snapshot.stellplatz);
    if (notesParts.length && !v('thesis')) {
      set('thesis', notesParts.join(' · '));
    }

    // V63.24 KOMPLETT NEU: Bewirtschaftungs-Sync
    // Tab Bewirtschaftung erwartet ALLE Werte in JÄHRLICHEN Beträgen.
    // QC-Modi:
    //   eur: qc_nul/qc_ul sind JÄHRLICH → 1:1 mappen
    //   pct: Anteile von NKM-Jahr → in € umrechnen, dann jährlich
    //   hg:  qc_hg ist MONATLICH → ×12 = Jahresbetrag → mit Split aufteilen
    // Ziel-Hauptfelder (alle JÄHRLICH):
    //   hg_ul       = umlagefähig (Hausgeld-Anteil)
    //   hg_nul      = nicht umlagefähig (Hausgeld-Anteil)
    //   mietausfall = kalk. Mietausfall (separater Bereich, nicht aus QC)
    //   nul_sonst   = Sonderverwaltung (Sammelfeld für Rest, nicht aus QC)
    //
    // Vorher (Bug): nul/12 wurde in nicht existierendes 'verwaltung'-Feld geschrieben.
    // ul/12 wurde in hg_ul (jährlich) geschrieben → ergab z.B. 138 statt 1660 €.

    var bewirtMode = snapshot.bewirt_mode;
    var nkmJahr = snapshot.nkm_grund > 0
                  ? snapshot.nkm_grund * 12       // Bei differenzierter NKM nur Grundmiete
                  : snapshot.nkm * 12;             // Legacy
    var nulY, ulY;       // Jahresbeträge

    if (bewirtMode === 'pct') {
      var nulPct = snapshot.nul_raw || 0;
      var ulPct  = snapshot.ul_raw || 0;
      nulY = nkmJahr * (nulPct / 100);
      ulY  = nkmJahr * (ulPct / 100);
    } else if (bewirtMode === 'hg') {
      // Hausgeld monatlich → Jahr → Split
      var hgM       = n('qc_hg');           // monatlich
      var splitNul  = n('qc_hg_split') || 60; // % nicht-umlagefähig
      var hgY       = hgM * 12;             // jährlich
      nulY = hgY * (splitNul / 100);
      ulY  = hgY * ((100 - splitNul) / 100);
    } else {
      // eur-Modus: Period-Toggle berücksichtigen
      var rawNul = snapshot.nul_raw || 0;
      var rawUl  = snapshot.ul_raw || 0;
      if (snapshot.bewirt_period === 'm') {
        nulY = rawNul * 12;
        ulY  = rawUl * 12;
      } else {
        nulY = rawNul;
        ulY  = rawUl;
      }
    }

    // V63.31: hg_ul und hg_nul IMMER setzen (auch wenn 0), damit der Workflow den
    // Bewirtschaftungs-Tab als ausgefüllt erkennt (Pflichtfeld 'hg_ul' im einfach-Modus).
    set('hg_ul',  String(Math.round(ulY  || 0)));
    // V187: auch in Miete-Tab #umlagef schreiben (Monatswert)
    if (ulY > 0) set('umlagef', (ulY / 12).toFixed(2).replace('.', ','));
    set('hg_nul', String(Math.round(nulY || 0)));
    // V63.31 KRITISCHER FIX: Alle anderen BWK-Felder müssen auf 0 gesetzt werden,
    // sonst summiert calc.js sie zu hg_ul/hg_nul dazu → andere BWK → andere NMR/Cashflow.
    // calc.js Z.545–547:
    //   ul  = hg_ul + grundsteuer + ul_sonst + kp1+kp2+kp3+kp4
    //   nul = hg_nul + eigen_r + mietausfall + nul_sonst
    // Wenn das vorherige Objekt grundsteuer=336 hatte, wird's bei neuem QC-Save nicht überschrieben.
    set('grundsteuer', '0');
    set('ul_sonst',    '0');
    set('eigen_r',     '0');
    set('mietausfall', '0');
    set('nul_sonst',   '0');
    set('weg_r',       '0');
    set('kp1',         '0');
    set('kp2',         '0');
    set('kp3',         '0');
    set('kp4',         '0');
    // V63.31: Umlagen — gibt's im QC nicht, also auf 0 (sonst verfälscht das wm_j → NMR)
    set('umlagef',     '0');
    // V63.32 KRITISCHER FIX: san und moebl explizit auf 0 setzen.
    // calc.js Z.433: gi = kp + nk + san + moebl. Wenn san/moebl vom Demo-Datensatz
    // oder vorherigen Objekt befüllt sind, wird GI größer als im QC angezeigt → NMR/LTV stimmen nicht.
    set('san',   '0');
    set('moebl', '0');
    // V63.32: ze (Zusatzeinnahmen) auf 0 wenn keine Komponenten — sonst Demo-Wert ze=90
    if (!qcZusatz) {
      set('ze', '0');
    }
    // V63.31: BWK-Modus auf 'detail' setzen damit hg_ul/hg_nul tatsächlich genutzt werden.
    // Wenn vorher ein Objekt im 'percent'-Modus war, bleibt window._bwkMode='percent' → hg_ul/hg_nul werden ignoriert!
    if (typeof window !== 'undefined') {
      window._bwkMode = 'detail';
      // Buttons im Bewirtschaftungs-Tab visuell auf "Detail" setzen falls vorhanden
      try {
        document.querySelectorAll('.bwk-mode-btn').forEach(function(b) {
          b.classList.toggle('active', b.getAttribute('data-mode') === 'detail');
        });
        var detailBlock = document.getElementById('bwk-detail-block');
        var pctBlock    = document.getElementById('bwk-percent-block');
        if (detailBlock) detailBlock.style.display = '';
        if (pctBlock)    pctBlock.style.display = 'none';
      } catch(e) {}
    }
    // Sonderfelder (Mietausfall, Sonderverwaltung) bleiben leer — kommen aus dem
    // Vollbild-Bewirtschaftungs-Tab, nicht aus dem QC.

    // V59: Foto-Sync — triple-redundant um sicher zu gehen dass die Fotos
    // im Tab Objekt landen, egal in welchem Zustand newObj() das hinterlässt
    function _qcSyncPhotos() {
      if (_qcImgs.length === 0) return;
      var photos = _qcImgs.slice();
      console.log('[QC-Save] Sync', photos.length, 'Fotos → Tab Objekt');
      if (typeof window.dpSetImgs === 'function') {
        window.dpSetImgs(photos);
      }
    }

    // 1. sofort
    _qcSyncPhotos();
    // 2. nach 150ms (failsafe gegen newObj-Side-Effects)
    setTimeout(_qcSyncPhotos, 150);
    // 3. nach 500ms (final, falls async-Renders noch laufen)
    setTimeout(_qcSyncPhotos, 500);

    if (typeof calc === 'function') calc();
    // V63.76: Standalone-Mode verlassen, in normale Tab-Ansicht (Objekt = Tab 0) wechseln.
    // Vorher (V63.9): User blieb im Quick-Check. Jetzt explizit: Quick-Check-Übernahme = Workflow weiter.
    if (typeof toast === 'function') toast('✓ Übernommen — du bist jetzt im Tab Objekt.');
    if (typeof exitQuickCheckMode === 'function') {
      setTimeout(function() {
        exitQuickCheckMode();
        if (typeof switchTab === 'function') switchTab(0);
      }, 200);
    }
    if (typeof autoSaveTrigger === 'function') setTimeout(autoSaveTrigger, 250);
    // V63.29: Workflow-Bar (Tab-Status grün/grau) explizit refreshen nachdem Felder gesetzt wurden
    if (window.DealPilotWorkflow && typeof DealPilotWorkflow.renderProgressBar === 'function') {
      setTimeout(DealPilotWorkflow.renderProgressBar, 100);
      setTimeout(DealPilotWorkflow.renderProgressBar, 500);
    }
  }

  function qcImportPdfTrigger() {
    if (typeof showPdfImport === 'function') {
      showPdfImport(function(extracted) {
        function set(id, val) { var e = document.getElementById(id); if (e && val) e.value = val; }
        function setSel(id, val) {
          var e = document.getElementById(id); if (!e || !val) return;
          var raw = String(val).trim().toLowerCase();
          for (var i = 0; i < e.options.length; i++) {
            var t = (e.options[i].text || '').toLowerCase();
            var vv = (e.options[i].value || '').toLowerCase();
            if (t === raw || vv === raw || t.indexOf(raw) >= 0 || raw.indexOf(t) >= 0) {
              e.selectedIndex = i; return;
            }
          }
        }

        // Pflicht-/Standardfelder
        if (extracted.kaufpreis)      set('qc_kp',      extracted.kaufpreis);
        if (extracted.wohnflaeche)    set('qc_wfl',     extracted.wohnflaeche);
        if (extracted.baujahr)        set('qc_bj',      extracted.baujahr);
        if (extracted.nettokaltmiete) set('qc_nkm',     extracted.nettokaltmiete);
        if (extracted.adresse || extracted.strasse || extracted.plz || extracted.ort) {
          // V199: Defensiv — Backend liefert evtl. separate Felder ODER kombinierte Adresse
          console.log('[V199 pdf-import] adresse fields:', {
            adresse: extracted.adresse,
            strasse: extracted.strasse,
            hausnummer: extracted.hausnummer || extracted.hausnr,
            plz: extracted.plz,
            ort: extracted.ort
          });

          // Priorität 1: separate Felder vom Backend
          if (extracted.strasse)     set('qc_str', extracted.strasse);
          if (extracted.hausnummer)  set('qc_hnr', extracted.hausnummer);
          if (extracted.hausnr)      set('qc_hnr', extracted.hausnr);
          if (extracted.plz)         set('qc_plz', String(extracted.plz));
          if (extracted.ort)         set('qc_ort', extracted.ort);

          // Priorität 2: aus kombinierter Adresse splitten (Lücken füllen)
          if (extracted.adresse) {
            var addr = String(extracted.adresse).trim();
            // Match: "Straße HNR, PLZ Ort" (typisches Format)
            var m = addr.match(/^(.+?)\s+(\d+[a-zA-Z]?)(?:\s*,\s*|\s+)(\d{5})\s+(.+)$/);
            if (m) {
              if (!document.getElementById('qc_str').value) set('qc_str', m[1].trim());
              if (!document.getElementById('qc_hnr').value) set('qc_hnr', m[2].trim());
              if (!document.getElementById('qc_plz').value) set('qc_plz', m[3].trim());
              if (!document.getElementById('qc_ort').value) set('qc_ort', m[4].trim());
            } else {
              var m2 = addr.match(/^(.+?)\s*,\s*(\d{5})\s+(.+)$/);
              if (m2) {
                if (!document.getElementById('qc_str').value) set('qc_str', m2[1].trim());
                if (!document.getElementById('qc_plz').value) set('qc_plz', m2[2].trim());
                if (!document.getElementById('qc_ort').value) set('qc_ort', m2[3].trim());
              } else {
                var m3 = addr.match(/(\d{5})\s+(.+?)(?:[,;]|$)/);
                if (m3) {
                  if (!document.getElementById('qc_plz').value) set('qc_plz', m3[1].trim());
                  if (!document.getElementById('qc_ort').value) set('qc_ort', m3[2].trim());
                  // Versuche Straße separat aus dem Anfang zu ziehen
                  var beforePlz = addr.split(/\d{5}/)[0].replace(/[,;]\s*$/, '').trim();
                  if (beforePlz) {
                    // Straße + HNR splitten
                    var sm = beforePlz.match(/^(.+?)\s+(\d+[a-zA-Z]?)\s*$/);
                    if (sm) {
                      if (!document.getElementById('qc_str').value) set('qc_str', sm[1].trim());
                      if (!document.getElementById('qc_hnr').value) set('qc_hnr', sm[2].trim());
                    } else {
                      if (!document.getElementById('qc_str').value) set('qc_str', beforePlz);
                    }
                  }
                } else {
                  if (!document.getElementById('qc_str').value) set('qc_str', addr);
                }
              }
            }
            set('qc_adresse', addr);
          } else {
            // Kombinierte Adresse zusammenbauen für Backward-Compat
            var combined = [
              ((extracted.strasse || '') + ' ' + (extracted.hausnummer || extracted.hausnr || '')).trim(),
              ((extracted.plz || '') + ' ' + (extracted.ort || '')).trim()
            ].filter(Boolean).join(', ');
            if (combined) set('qc_adresse', combined);
          }

          // V199: Nach Adresse-Setzen direkt qcCalc triggern (KNK aus PLZ etc.)
          if (typeof qcCalc === 'function') qcCalc();
        }

        // V54: Optionale Felder
        if (extracted.zimmer)         set('qc_zimmer',       extracted.zimmer);
        if (extracted.energieklasse)  setSel('qc_energieklasse', extracted.energieklasse);
        if (extracted.objektart)      setSel('qc_objektart',     extracted.objektart);
        if (extracted.stellplatz)     set('qc_stellplatz',   extracted.stellplatz);
        // V63.8: qc_ek_pdf Feld entfernt
        if (extracted.kaufnebenkosten) set('qc_knk',         extracted.kaufnebenkosten);

        // V54: Hausgeld → automatisch HG-Direkt-Modus aktivieren
        if (extracted.hausgeld) {
          set('qc_hg', extracted.hausgeld);
          if (typeof qcBewirtMode === 'function') qcBewirtMode('hg');
        }
        // Verwaltung + Instandhaltung → in NUL aufaddieren (falls HG nicht da)
        if (!extracted.hausgeld && (extracted.verwaltung || extracted.instandhaltung)) {
          var verw = parseFloat((extracted.verwaltung || '0').toString().replace(',', '.')) || 0;
          var inst = parseFloat((extracted.instandhaltung || '0').toString().replace(',', '.')) || 0;
          var nulY = (verw + inst) * 12; // monatlich → jährlich
          if (nulY > 0) {
            set('qc_nul', String(Math.round(nulY)));
          }
        }
        // Optionales: Eigenkapital aus PDF in qc_ek übernehmen wenn dort noch nichts steht
        // V206: Wenn aus PDF, als aiSet markieren — verhindert Auto-Überschreibung beim LTV-Wechsel
        if (extracted.eigenkapital && !document.getElementById('qc_ek').value) {
          set('qc_ek', extracted.eigenkapital);
          var ekInpPdf = document.getElementById('qc_ek');
          if (ekInpPdf) ekInpPdf.dataset.aiSet = '1';
        }

        // Open the optional details if any optional field came in
        var hasOptional = extracted.zimmer || extracted.energieklasse || extracted.objektart ||
                          extracted.stellplatz || extracted.eigenkapital;
        if (hasOptional) {
          var det = document.getElementById('qc-optional-block');
          if (det) det.open = true;
        }

        if (Array.isArray(extracted._photos) && extracted._photos.length) {
          // V58: extracted._photos zusätzlich auch in _qcImgs übernehmen + sichtbar machen
          extracted._photos.forEach(function(src) {
            if (_qcImgs.length < 6) _qcImgs.push({ src: src, name: 'pdf_extracted.jpg' });
          });
          _qcRenderPhotos();
          // V58: ZUSÄTZLICH direkt in das Haupt-Foto-Grid (Tab Objekt) schreiben
          // Damit der User sofort sieht, dass die Fotos auch im Tab Objekt landen
          if (typeof window.dpSetImgs === 'function') {
            window.dpSetImgs(_qcImgs.slice());
            console.log('[QC-PDF] ' + _qcImgs.length + ' Fotos auch in Haupt-Grid (imgs) geschrieben');
          }
        }
        qcCalc();
        if (typeof toast === 'function') {
          var pn = (extracted._photos && extracted._photos.length) || 0;
          toast('✓ ' + Object.keys(extracted).length + ' Felder' +
                (pn > 0 ? ' + ' + pn + ' Foto' + (pn===1?'':'s') : '') + ' aus PDF übernommen');
        }
      });
    } else {
      if (typeof toast === 'function') toast('PDF-Import wird gerade geladen — bitte erneut probieren.');
    }
  }

  // V63.85: URL-Import — Inserat-URL → Backend Scraper → Felder befüllen
  function qcImportFromUrl() {
    var row = document.getElementById('qc-url-import-row');
    if (!row) return;
    row.style.display = 'flex';
    var input = document.getElementById('qc_url_input');
    if (input) input.focus();
  }
  function qcCancelUrlImport() {
    var row = document.getElementById('qc-url-import-row');
    if (row) row.style.display = 'none';
    var st = document.getElementById('qc-url-status');
    if (st) { st.textContent = ''; st.className = 'qc-url-status'; }
    var input = document.getElementById('qc_url_input');
    if (input) input.value = '';
  }
  async function qcRunUrlImport() {
    var input = document.getElementById('qc_url_input');
    var status = document.getElementById('qc-url-status');
    var url = input ? input.value.trim() : '';
    if (!url) {
      if (status) { status.textContent = 'Bitte URL eingeben.'; status.className = 'qc-url-status qc-url-err'; }
      return;
    }
    if (status) { status.textContent = 'Lade Inserat…'; status.className = 'qc-url-status qc-url-info'; }

    try {
      var apiBase = (document.querySelector('meta[name="ji-api-base"]') || {}).content || '';
      var token = localStorage.getItem('ji_token');
      var headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      var resp = await fetch(apiBase + '/listing/scrape', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ url: url })
      });
      var json = await resp.json();
      if (!resp.ok) {
        var msg = json.error || ('HTTP ' + resp.status);
        if (json.hint) msg += ' — ' + json.hint;
        if (status) { status.textContent = '✗ ' + msg; status.className = 'qc-url-status qc-url-err'; }
        return;
      }
      if (!json.success) {
        // V63.91: is_search_page → klar erklären dass das eine Liste ist
        if (json.is_search_page) {
          if (status) {
            status.innerHTML = '<strong>⚠ Suchergebnis-Seite erkannt</strong><br>' +
              '<span style="font-size:12px;line-height:1.5;display:block;margin-top:6px">' +
              (json.note || 'Diese URL ist eine Liste, kein einzelnes Inserat.') +
              '</span>';
            status.className = 'qc-url-status qc-url-warn';
          }
          return;
        }
        // V63.87: is_blocked → prominent Workaround zeigen, nicht nur als Status-Text
        if (json.is_blocked) {
          var note = json.note || 'Diese Plattform blockiert automatische Abfragen.';
          var platform = json.platform || 'Diese Plattform';
          if (status) {
            status.innerHTML = '<strong>⚠ ' + platform + ' blockiert automatischen Abruf.</strong><br>' +
              '<span style="font-size:12px;line-height:1.5;display:block;margin-top:6px">' +
              note + '</span>' +
              '<button type="button" class="btn btn-gold btn-sm" style="margin-top:10px" ' +
              'onclick="qcCancelUrlImport(); qcImportPdfTrigger();">📄 Stattdessen PDF importieren</button>';
            status.className = 'qc-url-status qc-url-blocked';
          }
          return;
        }
        var note2 = (json.note || 'Strukturierte Daten nicht gefunden. Bitte manuell eintragen.');
        if (status) { status.textContent = '⚠ ' + note2; status.className = 'qc-url-status qc-url-warn'; }
        // Trotzdem partial-Daten ggf. einsetzen
        if (json.partial) _qcApplyImported(json.partial);
        return;
      }
      _qcApplyImported(json.data);
      // V63.91: missing_fields anzeigen — User weiß was er manuell ergänzen muss
      if (json.partial && Array.isArray(json.missing_fields) && json.missing_fields.length > 0) {
        if (status) {
          status.innerHTML = '<strong>✓ Daten teilweise übernommen.</strong><br>' +
            '<span style="font-size:12px;line-height:1.5;display:block;margin-top:6px">' +
            'Bitte ergänzen: <b>' + json.missing_fields.join(', ') + '</b>. ' +
            'Tipp: Wenn die Plattform Daten nicht freigibt, das Inserat als PDF speichern (Strg+P) und ' +
            'mit "PDF importieren" hochladen — die KI extrahiert dann zuverlässig alle Felder.' +
            '</span>';
          status.className = 'qc-url-status qc-url-warn';
        }
      } else if (status) {
        status.textContent = '✓ Daten übernommen — bitte prüfen.';
        status.className = 'qc-url-status qc-url-ok';
      }
      qcCalc();
    } catch (e) {
      if (status) { status.textContent = '✗ Fehler: ' + (e.message || 'unbekannt'); status.className = 'qc-url-status qc-url-err'; }
    }
  }
  function _qcApplyImported(d) {
    function _set(id, val) {
      var el = document.getElementById(id);
      if (!el || val == null || val === '') return;
      el.value = String(val).replace('.', ',');
    }
    if (d.address) {
      // V197: Adresse auf qc_str/qc_hnr/qc_plz/qc_ort splitten
      var addr = String(d.address).trim();
      var m = addr.match(/^(.+?)\s+(\d+[a-zA-Z]?)(?:\s*,\s*|\s+)(\d{5})\s+(.+)$/);
      if (m) {
        _set('qc_str', m[1].trim());
        _set('qc_hnr', m[2].trim());
        _set('qc_plz', m[3].trim());
        _set('qc_ort', m[4].trim());
      } else {
        var m2 = addr.match(/^(.+?)\s*,\s*(\d{5})\s+(.+)$/);
        if (m2) {
          _set('qc_str', m2[1].trim());
          _set('qc_plz', m2[2].trim());
          _set('qc_ort', m2[3].trim());
        } else {
          var m3 = addr.match(/(\d{5})\s+(.+)/);
          if (m3) { _set('qc_plz', m3[1].trim()); _set('qc_ort', m3[2].trim()); }
          else _set('qc_str', addr);
        }
      }
      _set('qc_adresse', addr);
    }
    if (d.livingArea) _set('qc_wfl', d.livingArea);
    if (d.yearBuilt)  _set('qc_bj', d.yearBuilt);
    if (d.rooms)      _set('qc_zimmer', d.rooms);
    if (d.price)      _set('qc_kp', d.price);
    if (d.rentNet)    _set('qc_nkm', d.rentNet);
  }

  window.showQuickCheck    = showQuickCheck;
  window.closeQuickCheck   = closeQuickCheck;
  window.qcCalc            = qcCalc;
  window.qcSaveAsObject    = qcSaveAsObject;
  window.qcImportPdfTrigger = qcImportPdfTrigger;
  window.qcSetLtv          = qcSetLtv;
  window.qcEkChanged       = qcEkChanged;
  window.qcBewirtMode      = qcBewirtMode;
  window.qcAiFillAll       = qcAiFillAll;
  window.qcHandlePhotos    = qcHandlePhotos;
  window.qcDelPhoto        = qcDelPhoto;
  // V197: KI-Recherche-Info-Box + Übernehmen
  window.qcAiResearchInfo  = qcAiResearchInfo;
  window.qcCloseAiInfo     = qcCloseAiInfo;
  window.qcApplyAiMiete    = qcApplyAiMiete;
  // V63.85 (Stubs für alten URL-Loader — bleiben für Backward-Compat)
  window.qcImportFromUrl   = qcImportFromUrl;
  window.qcRunUrlImport    = qcRunUrlImport;
  window.qcCancelUrlImport = qcCancelUrlImport;
})();

// ═══════════════════════════════════════════════════════════════
// V63.4: QC-Sync — Hauptfeld-Werte in qc_-Felder übernehmen.
// Wird bei Tab-Wechsel zum QC-Tab aufgerufen damit der QC
// IMMER den aktuellen Stand zeigt (nicht alte qc_-Werte).
// ═══════════════════════════════════════════════════════════════
function _qcSyncFromMain() {
  function _setVal(qcId, mainId) {
    var qcEl = document.getElementById(qcId);
    var mainEl = document.getElementById(mainId);
    if (!qcEl || !mainEl) return;
    var mainVal = (mainEl.value || '').trim();
    if (!mainVal) return;
    // Nur überschreiben wenn der Wert sich unterscheidet (verhindert Cursor-Sprung)
    if (qcEl.value !== mainVal) {
      qcEl.value = mainVal;
    }
  }
  // KP, NKM, Wohnfläche, Baujahr, Adresse — alles vom Hauptobjekt übernehmen
  _setVal('qc_kp',      'kp');
  _setVal('qc_nkm',     'nkm');
  _setVal('qc_wfl',     'wfl');
  _setVal('qc_bj',      'bj');
  _setVal('qc_adresse', 'adresse');
  _setVal('qc_zinsen',  'd1z');
  _setVal('qc_zins',    'd1z');     // Alias
  _setVal('qc_tilg',    'd1t');
  _setVal('qc_ek',      'ek');
  _setVal('qc_knk',     'knk');

  // Bewirtschaftung: aus den echten Bewirt-Feldern den NU-Wert (nicht-umlagefähig) ziehen
  // (qc_nul / qc_ul = unbenutzt im neuen UI, aber für Konsistenz setzen)
  function _n(id) {
    var e = document.getElementById(id);
    if (!e) return 0;
    return (typeof parseDe === 'function') ? parseDe(e.value) : (parseFloat((e.value||'').replace(',','.')) || 0);
  }
  var ulSum  = _n('hg_ul')  + _n('ul_sonst');
  var nulSum = _n('hg_nul') + _n('mietausfall') + _n('nul_sonst');
  var qcUlEl  = document.getElementById('qc_ul');
  var qcNulEl = document.getElementById('qc_nul');
  if (qcUlEl  && ulSum  > 0 && qcUlEl.value !== '') qcUlEl.value  = (ulSum / 12).toFixed(0);
  if (qcNulEl && nulSum > 0 && qcNulEl.value !== '') qcNulEl.value = (nulSum / 12).toFixed(0);

  // Nach dem Sync neuen QC-Score berechnen
  if (typeof qcCalc === 'function') {
    setTimeout(qcCalc, 30);
  }
}
window._qcSyncFromMain = _qcSyncFromMain;

// ═══════════════════════════════════════════════════════════════
// V63.8: Mieteinnahmen automatisch summieren wenn die einzelnen
// Komponenten (Grund/Stellplatz/Garage/Sonstige) eingegeben werden.
// User kann den Gesamt-NKM-Wert auch direkt überschreiben.
// ═══════════════════════════════════════════════════════════════
function qcMieteAddUp() {
  function _val(id) {
    var e = document.getElementById(id);
    if (!e) return 0;
    return (typeof parseDe === 'function') ? parseDe(e.value) : (parseFloat((e.value||'').replace(',','.')) || 0);
  }
  var grund   = _val('qc_nkm_grund');
  var stp     = _val('qc_nkm_stp');
  var garage  = _val('qc_nkm_garage');     // Backwards-Compat (alter PDF-Import)
  var kueche  = _val('qc_nkm_kueche');     // V63.24 NEU
  var sonst   = _val('qc_nkm_sonst');
  var sum = grund + stp + garage + kueche + sonst;
  if (sum > 0) {
    // V63.24: NUR qc_nkm setzen, NICHT mehr Hauptfeld 'nkm' (Auto-Sync raus, siehe Punkt 2)
    var nkmEl = document.getElementById('qc_nkm');
    if (nkmEl) nkmEl.value = Math.round(sum);
    if (typeof qcCalc === 'function') qcCalc();
  }
}
window.qcMieteAddUp = qcMieteAddUp;
