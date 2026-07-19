/* ════════════════════════════════════════════════════════════════════
 * voice-import.js — v504-voice (Label-Fix + Weiss-Restyle) (ersetzt v501/v502)
 * Sprachaufzeichnung als vollwertige Quelle im Aktionen-Bereich.
 *
 * FLOW:
 *   Checkbox "Sprachaufzeichnung" frei mit Expose/Marktbericht/AVM
 *   kombinierbar. "Abrufen" -> runSelected fuehrt Quellen in fester
 *   Reihenfolge aus: voice -> import -> pricehubble -> sprengnetter.
 *   Quelle voice oeffnet DIESES Modal (oabi-Optik wie der PDF-Import):
 *     - Aufnahme startet sofort (Status + Timer oben)
 *     - Live-Textbox: gesprochener Text erscheint waehrend des Sprechens
 *       (Web Speech API als Vorschau; Browser ohne Web Speech: Pegel +
 *       Hinweis). MASSGEBLICH ist immer die Audio-Aufnahme am Backend.
 *     - Recorder-Buttons: Pause / Fortsetzen / Stopp
 *     - "Weiter \u2014 auswerten (1 L)" -> Audio + Laufzeit-Feldkatalog an
 *       POST /api/v1/ai/extract-voice
 *   Ergebnis laeuft ueber die ECHTE Import-Mechanik (ObjectActions._voice
 *   Bridge, v503-voice-bridge): renderMergedTable (gleiche Tabelle/Optik
 *   wie Expose/Marktbericht, an-/abwaehlbar) + applyMerged (gleicher
 *   Schreibweg inkl. Selects, Sterne via StarRating, QC-Bucket-Logik).
 *
 * FELD-KATALOG: zur Laufzeit aus window.FIELDS + DOM (alle Tabs). Selects
 * liefern echte Optionen mit -> KI brueckt "Zustand ist gut" auf den
 * passenden Optionswert. rate_* werden als Sterne (1-5) behandelt.
 * ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.VoiceImport) return;

  var TOKEN_KEY = 'ji_token';
  var MAX_SEC = 120;  /* v512: Aufnahme auf 2 Minuten begrenzt (Kostenkontrolle) */
  var API_TIMEOUT = 180000;

  var st = {
    stream: null, rec: null, chunks: [], mime: '',
    speech: null, finalText: '',
    timer: null, elapsed: 0, lastTick: 0,
    running: false, paused: false, stopped: false,
    analyser: null, audioCtx: null
  };
  var _doneFired = false;
  var _qcTarget = false;  /* v506-qc-items: Quick-Check-Kontext */
  /* v507-stream: Live-Transkription per WebSocket (ueberall lauffaehig, auch App) */
  var sx = { ws: null, ctx: null, src: null, proc: null, on: false, finalText: '', delta: '' };
  var _catalog = [];  /* fuer Chip-Wolke + finale Markierung */
  /* v513: Live-KI-Zwischenauswertung (event-gesteuert, hart begrenzt) */
  var qm = { calls: 0, max: 6, lastLen: 0, inflight: false, timer: null };

  function $(id) { return document.getElementById(id); }

  /* ── Semantik-Hinweise (Bedeutung/Einheit; Select-Optionen kommen aus dem DOM) ── */
  var HINTS = {
    str: 'Strasse', hnr: 'Hausnummer', plz: 'Postleitzahl', ort: 'Ort',
    objart: 'Objektart', wfl: 'Wohnflaeche in m2', gsfl: 'Grundstuecksflaeche in m2',
    baujahr: 'Baujahr', kaufdat: 'Kaufdatum', wirtschaftlicher_uebergang: 'Wirtschaftlicher Uebergang (Datum)',
    kuerzel: 'Objekt-Kuerzel/Spitzname', ausst: 'Ausstattungsbeschreibung',
    thesis: 'Investment-These', risiken: 'Risiken', notizen: 'Sonstige Bemerkungen/Notizen',
    bankval: 'Bankbewertung in Euro', svwert: 'Marktwert/Verkehrswert in Euro',
    makrolage: 'Makrolage (Stadt/Region, Wirtschaft, Infrastruktur)',
    mikrolage: 'Mikrolage (Viertel, Strasse, Umfeld)',
    vermstand: 'Vermietungsstand', exitstr: 'Exit-Strategie',
    kp: 'Kaufpreis in Euro', makler_p: 'Maklerprovision in Prozent', notar_p: 'Notarkosten in Prozent',
    gba_p: 'Grundbuchamt in Prozent', gest_p: 'Grunderwerbsteuer in Prozent',
    san: 'Sanierungskosten in Euro', moebl: 'Moeblierungskosten in Euro',
    inv_kueche: 'Investition Kueche in Euro', inv_moebel: 'Investition Moebel in Euro',
    inv_geraete: 'Investition Geraete in Euro', inv_pv: 'Investition Photovoltaik in Euro',
    inv_stellplatz: 'Investition Stellplatz in Euro', inv_sonst: 'Investition Sonstiges in Euro',
    brw: 'Bodenrichtwert in Euro pro m2', mea: 'Miteigentumsanteil',
    mietstg: 'Mietsteigerung in Prozent pro Jahr', wertstg: 'Wertsteigerung in Prozent pro Jahr',
    kostenstg: 'Kostensteigerung in Prozent pro Jahr', leerstand: 'Leerstand in Prozent',
    btj: 'Betrachtungszeitraum in Jahren', exit_bmy: 'Exit-Mietmultiplikator',
    nkm: 'Nettokaltmiete in Euro pro Monat',
    ze: 'Zusatzeinnahmen in Euro pro Monat \u2014 SUMME aller Posten (z.B. Kuechenmiete, Stellplatz, Garage)',
    ze_stp: 'Stellplatz-/Garagenmiete in Euro pro Monat (Einzelposten)',
    ze_kueche: 'Kuechenmiete in Euro pro Monat (Einzelposten)',
    ze_sonst: 'Sonstige Zusatzeinnahmen in Euro pro Monat (Einzelposten)',
    umlagef: 'Umlagefaehige Nebenkosten in Euro pro Monat',
    afa_satz: 'AfA-Satz in Prozent', geb_ant: 'Gebaeudeanteil in Prozent',
    zve: 'Zu versteuerndes Einkommen in Euro pro Jahr', grenz: 'Grenzsteuersatz in Prozent',
    ek: 'Eigenkapital in Euro', d1: 'Darlehen 1 Summe in Euro', d1z: 'Darlehen 1 Sollzins in Prozent',
    d1t: 'Darlehen 1 anfaengliche Tilgung in Prozent', d1_bindj: 'Darlehen 1 Zinsbindung in Jahren',
    d1_type: 'Darlehen 1 Typ', d1_auszahl: 'Darlehen 1 Auszahlungsdatum',
    anschl_z: 'Anschlusszins in Prozent', anschl_t: 'Anschlusstilgung in Prozent',
    d2: 'Darlehen 2 Summe in Euro', d2z: 'Darlehen 2 Sollzins in Prozent',
    d2t: 'Darlehen 2 Tilgung in Prozent', d2_bindj: 'Darlehen 2 Zinsbindung in Jahren',
    bspar_sum: 'Bausparsumme in Euro', bspar_rate: 'Bauspar-Sparrate in Euro pro Monat',
    bspar_zins: 'Bauspar-Guthabenzins in Prozent', bspar_zuteil: 'Bauspar-Zuteilung',
    bspar_dar_z: 'Bauspardarlehen Zins in Prozent', bspar_dar_t: 'Bauspardarlehen Tilgung in Prozent',
    hg_ul: 'Hausgeld umlagefaehig in Euro pro Monat', hg_nul: 'Hausgeld nicht umlagefaehig in Euro pro Monat',
    grundsteuer: 'Grundsteuer in Euro pro Jahr', ul_sonst: 'Sonstige umlagefaehige Kosten in Euro pro Monat',
    weg_r: 'WEG-Ruecklage in Euro pro Monat', eigen_r: 'Eigene Ruecklage in Euro pro Monat',
    mietausfall: 'Mietausfallwagnis in Prozent', nul_sonst: 'Sonstige nicht umlagefaehige Kosten in Euro pro Monat',
    bwk_ul_pct: 'Bewirtschaftungskosten umlagefaehig in Prozent', bwk_nul_pct: 'Bewirtschaftungskosten nicht umlagefaehig in Prozent',
    bwk_kp_pct: 'Bewirtschaftungskosten in Prozent vom Kaufpreis',
    mietspiegel: 'Mietspiegel in Euro pro m2', me_soll: 'Soll-Miete in Euro pro m2',
    me_anz: 'Anzahl Mieterhoehungen', me_int: 'Intervall Mieterhoehung in Jahren', me_pct: 'Mieterhoehung in Prozent',
    ds2_zustand: 'Zustand des Objekts/der Wohnung', ds2_energie: 'Energieeffizienz/Energieklasse',
    ds2_mietausfall: 'Mietausfall-Risiko', ds2_marktmiete: 'Marktmiete in Euro pro m2',
    ds2_bevoelkerung: 'Bevoelkerungsentwicklung am Standort', ds2_nachfrage: 'Nachfrage-Indikator am Standort',
    ds2_marktfaktor: 'Marktfaktor', ds2_wertsteigerung: 'Wertsteigerungs-Erwartung', ds2_entwicklung: 'Entwicklung der Lage',
    rate_kueche: 'Zustand Kueche (Sterne 1-5)', rate_bad: 'Zustand Bad (Sterne 1-5)',
    rate_boden: 'Zustand Boden (Sterne 1-5)', rate_fenster: 'Zustand Fenster (Sterne 1-5)',
    qual_kueche: 'Qualitaet Kueche', qual_bad: 'Qualitaet Bad', qual_boden: 'Qualitaet Boden', qual_fenster: 'Qualitaet Fenster',
    zimmer: 'Anzahl Zimmer', bad_anz: 'Anzahl Baeder', etage: 'Etage', etagen_ges: 'Etagen gesamt',
    einheiten: 'Anzahl Wohneinheiten', garagen: 'Anzahl Garagen/TG-Stellplaetze',
    stellpl_aussen: 'Anzahl Aussenstellplaetze', balkon_flae: 'Balkon-/Terrassenflaeche in m2',
    modernis: 'Modernisierungen/Sanierungsjahr'
  };
  var FALLBACK_IDS = Object.keys(HINTS);

  /* ── eigene Zusatz-Styles (oabi-Basis kommt aus object-actions #oab-style) ── */
  function injectCss() {
    if ($('vi-style')) return;
    var s = document.createElement('style');
    s.id = 'vi-style';
    s.textContent = [
      /* v974-voice-orbit: Sprachaufzeichnung als Mikro-Orbit, theme-aware */
      '.oabi-ov.vi-mode{--vi-surface:#0a0a0a;--vi-card:#151412;--vi-text:#FDFCFA;--vi-muted:#A89F8E;--vi-line:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 22%, transparent);--vi-track:#1c1a16;--vi-accent:var(--wl-c9a84c, #C9A84C);--vi-donebd:rgba(63,165,108,.7);--vi-donebg:rgba(63,165,108,.14);--vi-donetx:#c9f0d8}',
      'body[data-dp-skin="hell"] .oabi-ov.vi-mode{--vi-surface:#FDFCFA;--vi-card:#FFFFFF;--vi-text:#1e1a12;--vi-muted:#8a8272;--vi-line:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);--vi-track:#ECE4D2;--vi-accent:#9a7a24;--vi-donebd:rgba(63,165,108,.6);--vi-donebg:rgba(63,165,108,.14);--vi-donetx:#1c6b41}',
      '.oabi-ov.vi-mode .oabi-modal{background:var(--vi-surface)}',
      '.oabi-ov.vi-mode .oabi-head h3{color:var(--vi-text)}',
      '.oabi-ov.vi-mode .oabi-sub{color:var(--vi-muted)}',
      '.oabi-ov.vi-mode .oabi-foot{background:var(--vi-surface);border-top:1px solid var(--vi-line)}',
      '.oabi-ov.vi-mode .oabi-btn{border-radius:10px}',
      /* Recorder-Status (kompakt) */
      '.oabi-ov.vi-mode .vi-status{display:flex;align-items:center;gap:9px;margin:2px 0 8px;font:600 12.5px/1 "DM Sans",Inter,system-ui,sans-serif;color:var(--vi-muted)}',
      '.vi-dot{width:9px;height:9px;border-radius:50%;background:#D9685F;animation:viPulse 1.2s infinite;flex:none}',
      '.vi-status.paused .vi-dot{animation:none;background:#E5A847}',
      '.vi-status.stopped .vi-dot{animation:none;background:#3FA56C}',
      '.vi-time{font-variant-numeric:tabular-nums;color:var(--vi-accent)}',
      '@keyframes viPulse{0%,100%{box-shadow:0 0 0 0 rgba(217,104,95,.45)}50%{box-shadow:0 0 0 7px rgba(217,104,95,0)}}',
      /* Kategorie-Zeile */
      '.vi-catline{text-align:center;font:600 12px/1.3 "JetBrains Mono",monospace;letter-spacing:.18em;color:var(--vi-accent);margin:4px 0 2px}',
      '.vi-catline b{letter-spacing:.22em}',
      '.vi-catsub{display:block;font-size:10.5px;letter-spacing:.08em;color:var(--vi-muted);margin-top:3px}',
      /* Orbit-Buehne */
      '.vi-orbit{position:relative;width:100%;max-width:480px;height:446px;margin:2px auto 0}',
      '.vi-rings{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}',
      '.vi-rings i{position:absolute;width:150px;height:150px;border-radius:50%;border:1.5px solid var(--vi-line);animation:viRing 2.6s ease-out infinite}',
      '.vi-rings i:nth-child(2){animation-delay:.9s}.vi-rings i:nth-child(3){animation-delay:1.8s}',
      '@keyframes viRing{0%{transform:scale(.8);opacity:.5}100%{transform:scale(2.4);opacity:0}}',
      '.vi-status.stopped ~ .vi-orbit .vi-rings i{animation:none;opacity:.25}',
      '.vi-mic{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:110px;height:110px;border-radius:50%;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));display:grid;place-items:center;box-shadow:0 14px 40px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent),inset 0 0 0 1px rgba(255,255,255,.25);z-index:3}',
      '.vi-mic svg{width:40px;height:40px}',
      /* Chips im Orbit (absolut positioniert per JS) */
      '.oabi-ov.vi-mode .vi-chips{position:absolute;inset:0;margin:0;max-height:none;overflow:visible;display:block}',
      /* v975-voice-nachzug: coolere, immer lesbare Chips */
      '.oabi-ov.vi-mode .vi-chip{position:absolute;width:auto;max-width:134px;transform:translate(-50%,-50%);background:linear-gradient(180deg,#413b32,#332e27);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 42%, transparent);border-radius:12px;padding:6px 9px;text-align:left;white-space:nowrap;font:600 10.5px/1.2 "JetBrains Mono",monospace;color:#fff;opacity:.94;box-shadow:0 4px 13px rgba(0,0,0,.2);transition:all .3s ease;z-index:2}',
      '.oabi-ov.vi-darkbg .vi-chip{background:linear-gradient(180deg,#1b1a17,#121110);border-color:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);box-shadow:0 4px 13px rgba(0,0,0,.5)}',
      '.oabi-ov.vi-mode .vi-chip .vi-ck{display:inline-block;color:#3FA56C;font-weight:700;opacity:0;margin-right:3px}',
      '.oabi-ov.vi-mode .vi-chip.on,.oabi-ov.vi-mode .vi-chip.pre{opacity:1;border-color:#2f8f5c;background:linear-gradient(180deg,#37a06a,#2f8f5c);color:#fff;box-shadow:0 6px 18px rgba(47,143,92,.45);transform:translate(-50%,-50%) scale(1.06)}',
      '.oabi-ov.vi-mode .vi-chip.on .vi-ck,.oabi-ov.vi-mode .vi-chip.pre .vi-ck{color:#fff}',
      '.oabi-ov.vi-mode .vi-chip.on .vi-ck,.oabi-ov.vi-mode .vi-chip.pre .vi-ck{opacity:1}',
      /* Hoert-zu Zeile + Punkte */
      '.vi-listen{text-align:center;font:600 11px/1 "JetBrains Mono",monospace;letter-spacing:.24em;text-transform:uppercase;color:var(--vi-muted);margin:6px 0 14px}',
      '.vi-dots{display:inline-flex;gap:3px;margin-left:6px}',
      '.vi-dots i{width:4px;height:4px;border-radius:50%;background:var(--vi-accent);animation:viBlink 1.4s infinite}',
      '.vi-dots i:nth-child(2){animation-delay:.2s}.vi-dots i:nth-child(3){animation-delay:.4s}',
      '@keyframes viBlink{0%,60%,100%{opacity:.25}30%{opacity:1}}',
      /* Fortschrittsbalken (statt Tachos) */
      '.vi-prog{max-width:440px;margin:0 auto 4px}',
      '.vi-prog-row{display:flex;justify-content:space-between;font:600 11px/1 "JetBrains Mono",monospace;letter-spacing:.06em;color:var(--vi-muted);margin-bottom:6px}',
      '.vi-prog-row b{color:var(--vi-accent)}',
      '#vi-prog-pct{color:var(--vi-accent)}',
      '.vi-track{height:9px;border-radius:99px;background:var(--vi-track);overflow:hidden;border:1px solid var(--vi-line)}',
      '#vi-fill{display:block;height:100%;width:0;border-radius:99px;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));transition:width .4s ease}',
      '.vi-nkhint{max-width:440px;margin:8px auto 0;font-size:10.5px;color:var(--vi-muted);text-align:center;line-height:1.4;font-style:italic}',
      /* Transkript einklappbar (Default zu) */
      '.oabi-ov.vi-mode .vi-transcript{max-width:520px;margin:12px auto 2px;border-top:1px solid var(--vi-line);padding-top:8px}',
      '.oabi-ov.vi-mode .vi-transcript>summary{cursor:pointer;font:600 11.5px/1 "JetBrains Mono",monospace;letter-spacing:.08em;color:var(--wl-b8932f, #b8932f);text-decoration:underline;list-style:none;text-align:center}',
      '.oabi-ov.vi-mode .vi-transcript>summary::-webkit-details-marker{display:none}',
      '#vi-level{height:6px;border-radius:3px;background:var(--vi-track);overflow:hidden;margin:8px 0}',
      '#vi-level i{display:block;height:100%;width:0%;background:linear-gradient(90deg,var(--wl-c9a84c, #C9A84C),var(--wl-e8cc7a, #E8CC7A));transition:width .08s linear}',
      '.oabi-ov.vi-mode #vi-live{width:100%;min-height:90px;max-height:200px;resize:vertical;border:1px solid #e2ddd2;border-radius:8px;padding:9px 11px;font:13px/1.5 "DM Sans",Inter,system-ui,sans-serif;color:#2A2727;background:#faf7f0}',
      '.oabi-ov.vi-mode #vi-live:focus{outline:none;border-color:var(--wl-c9a84c, #C9A84C);background:#fff}',
      '.oabi-ov.vi-darkbg #vi-live{color:#FDFCFA;background:#151412;border-color:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 25%, transparent)}',
      '.oabi-ov.vi-mode #vi-live:focus{outline:none;border-color:var(--vi-accent)}',
      '.vi-livehint{font-size:10.5px;color:var(--vi-muted);margin:4px 0 0}',
      /* Recorder-Knoepfe */
      '.vi-recbtns{display:flex;gap:8px;justify-content:center;margin:12px 0 2px}',
      '.oabi-ov.vi-mode .vi-rbtn{display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border:1px solid #cdbf9a;border-radius:10px;background:#fff;font:600 12px/1 "DM Sans",Inter,system-ui,sans-serif;cursor:pointer;color:#2A2727}',
      '.oabi-ov.vi-darkbg .vi-rbtn{background:#1b1a17;border-color:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);color:#FDFCFA}',
      '.oabi-ov.vi-mode .vi-rbtn:hover{border-color:var(--vi-accent);color:var(--vi-accent)}',
      '.vi-rbtn[disabled]{opacity:.45;cursor:not-allowed}',
      '.vi-rbtn svg{flex:none}',
      '#vi-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#161310;color:var(--wl-e8cc7a, #E8CC7A);padding:10px 18px;border-radius:999px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 50%, transparent);font-size:13px;font-weight:600;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.4)}',
      /* Modal groesser + Footer sichtbar (Body scrollt) */
      '.oabi-ov.vi-mode .oabi-modal{width:min(760px,100%);max-height:94vh;overflow:hidden;display:flex;flex-direction:column}',
      '.oabi-ov.vi-mode .oabi-body{flex:1 1 auto;min-height:0;overflow:auto}',
      '.oabi-ov.vi-mode .oabi-foot{flex:none}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ── SVGs (Recorder-Symbole, Stroke-Stil, NIE Emoji) ──────────────── */
  function micSvg(sz, col) {
    return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="' + (col || 'currentColor') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>';
  }
  function pauseSvg() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/></svg>'; }
  function playSvg() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><polygon points="7 4 19 12 7 20 7 4"/></svg>'; }
  function stopSvg() { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>'; }
  function checkSvg() { return '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'; }
  function escH(x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* Checkbox-Label im qc7-src-Format (von object-actions render() eingebunden) */
  function srcLabel() {
    return '<label class="qc7-src" data-src="voice" title="Objekt frei einsprechen \u2014 1 L Kerosin pro Auswertung">' +
      '<input type="checkbox" value="voice">' +
      '<span class="qc7-box">' + checkSvg() + '</span>' +
      '<span class="qc7-ic">' + micSvg(14) + '</span> Sprachaufzeichnung</label>';
  }

  /* ── Feld-Katalog (window.FIELDS + DOM, alle Tabs) ────────────────── */
  function labelFor(id, el) {
    /* v504-label-fix: NIE den Placeholder nehmen — die App nutzt Musterwerte
       ("Musterstadt", "12345", "z.B. 1") als Placeholder. Reihenfolge:
       echtes label[for] -> HINTS-Map -> title -> id. */
    try {
      var l = document.querySelector('label[for="' + id + '"]');
      if (l && l.textContent && l.textContent.trim()) return l.textContent.trim().replace(/\s+/g, ' ').slice(0, 80);
    } catch (e) {}
    if (HINTS[id]) return HINTS[id];
    if (el && el.title && el.title.trim()) return el.title.trim().slice(0, 80);
    return id;
  }

  function buildCatalog() {
    /* v510: nur kuratierte Whitelist (statt aller 123 FIELDS). DOM liefert
       weiterhin kind/Optionen fuer Selects. */
    var cat = [];
    WL.forEach(function (w) {
      var id = w.id;
      if (_qcTarget && QC_IDS.indexOf(id) < 0) return;  /* v517: QC nur QC-Felder */
      var el = $(id);
      if (!el) {
        /* Sterne o.ae. haben kein klassisches Feld — hier nicht in WL, also skip */
        return;
      }
      var tag = el.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return;
      if (el.type === 'checkbox' || el.type === 'hidden') return;
      var entry = { id: id, label: w.label, g: w.g };
      if (w.noc) entry.noc = 1;  /* v514: nicht als Chip zeigen/zaehlen, aber beim Auswerten fuellbar */
      if (HINTS[id]) entry.hint = HINTS[id];
      if (tag === 'SELECT') {
        entry.kind = 'select';
        entry.options = [];
        for (var i = 0; i < el.options.length; i++) {
          var o = el.options[i];
          if (o.value === '') continue;
          entry.options.push({ v: String(o.value).slice(0, 60), t: String(o.text || '').trim().slice(0, 60) });
        }
        if (!entry.options.length) return;
      } else {
        entry.kind = (el.type === 'date') ? 'date' : (el.type === 'number' ? 'num' : 'text');
      }
      cat.push(entry);
    });
    /* QC-Einzelposten (virtuell) zusaetzlich */
    if (_qcTarget) {
      WL_VIRT.forEach(function (w) {
        cat.push({ id: w.id, kind: 'num', label: w.label, g: w.g, hint: 'Nur den Einzelposten; Summe gehoert zusaetzlich in ze' });
      });
    }
    return cat;
  }
  /* v519: VOLLER Feld-Katalog fuer die AUSWERTUNG (alle window.FIELDS) -> auch
     Felder ausserhalb der Chip-Whitelist werden gefuellt, wenn man sie nennt
     (z.B. bank_inst "Volksbank", d1_type "Annuitaetendarlehen", Bauspar-Felder,
     Investment-These, Risiken ...). Die Chip-Wolke bleibt kuratiert (buildCatalog).
     Nur Objekt-Modus; im Quick Check bleibt es bei den QC-Feldern. */
  function buildFullCatalog() {
    var ids = (window.FIELDS && window.FIELDS.length) ? window.FIELDS.slice() : [];
    var cat = [], seen = {};
    ids.forEach(function (id) {
      if (seen[id]) return; seen[id] = 1;
      if (/^_/.test(id) || /^ai_/.test(id)) return;  /* interne/KI-Felder raus */
      var el = $(id);
      if (!el) return;
      var tag = el.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return;
      if (el.type === 'checkbox' || el.type === 'hidden') return;
      var wl = WL_MAP[id];
      var entry = { id: id, label: wl ? wl.label : labelFor(id, el) };
      if (HINTS[id]) entry.hint = HINTS[id];
      if (tag === 'SELECT') {
        entry.kind = 'select';
        entry.options = [];
        for (var i = 0; i < el.options.length; i++) {
          var o = el.options[i];
          if (o.value === '') continue;
          entry.options.push({ v: String(o.value).slice(0, 60), t: String(o.text || '').trim().slice(0, 60) });
        }
        if (!entry.options.length) return;
      } else {
        entry.kind = (el.type === 'date') ? 'date' : (el.type === 'number' ? 'num' : 'text');
      }
      cat.push(entry);
    });
    return cat;
  }
  function catalogEntry(catalog, id) {
    for (var i = 0; i < catalog.length; i++) { if (catalog[i].id === id) return catalog[i]; }
    return null;
  }

  /* ── Modal oeffnen (wird aus runSelected awaited, wie der Import) ──── */
  function open(onDone, opts) {
    injectCss();
    var OA = window.ObjectActions && window.ObjectActions._voice;
    if (!OA) { toast('Sprachmodul nicht bereit \u2014 Seite neu laden'); if (typeof onDone === 'function') onDone(); return; }
    if ($('oabi-ov')) { if (typeof onDone === 'function') onDone(); return; }

    _doneFired = false;
    var done = function (payload) {
      if (_doneFired) return; _doneFired = true;
      try { if (typeof onDone === 'function') onDone(payload); } catch (e) {}
    };
    _qcTarget = !!(opts && opts.target === 'qc');  /* v506-qc-items */
    OA.reset();
    OA.setMode(!!(opts && opts.target === 'qc'), done);

    var ov = document.createElement('div');
    ov.className = 'oabi-ov vi-mode'; ov.id = 'oabi-ov';  /* v504-white: gescopter Restyle */
    ov.innerHTML =
      '<div class="oabi-modal">' +
        '<div class="oabi-head"><span style="color:var(--gold,#C9A84C)">' + micSvg(22) + '</span><h3>Sprachaufzeichnung</h3></div>' +
        '<div class="oabi-sub">Objekt frei einsprechen \u2014 Adresse, Kaufpreis, Fl\u00e4chen, Miete und Zusatzeinnahmen, Zustand, Lage, Bodenrichtwert, Annahmen, Bewirtschaftung, Finanzierung. Freie Formulierungen werden auf die passenden Felder gebr\u00fcckt.</div>' +
        '<div class="oabi-body">' +
          '<div id="vi-rec">' +
            '<div class="vi-status" id="vi-status"><span class="vi-dot"></span><span class="vi-time" id="vi-time">00:00</span><span id="vi-statetxt">Aufnahme l\u00e4uft \u2026</span></div>' +
            '<div class="vi-catline" id="vi-catline"></div>' +
            '<div class="vi-orbit" id="vi-orbit">' +
              '<div class="vi-rings"><i></i><i></i><i></i></div>' +
              '<div class="vi-mic" id="vi-mic">' + micSvg(40, '#1a1508') + '</div>' +
              '<div class="vi-chips" id="vi-chips"></div>' +
            '</div>' +
            '<div class="vi-listen" id="vi-listen"><span id="vi-listen-txt">H\u00f6rt zu</span><span class="vi-dots"><i></i><i></i><i></i></span></div>' +
            '<div class="vi-prog"><div class="vi-prog-row"><span id="vi-chips-count"></span><span id="vi-prog-pct"></span></div><div class="vi-track"><i id="vi-fill"></i></div></div>' +
            '<div class="vi-nkhint" id="vi-nkhint"></div>' +
            '<details class="vi-transcript">' +
              '<summary>Mitschrift anzeigen / bearbeiten</summary>' +
              '<div id="vi-level"><i></i></div>' +
              '<textarea id="vi-live" placeholder="Gesprochener Text erscheint hier \u2026 (editierbar)"></textarea>' +
              '<div class="vi-livehint" id="vi-livehint">Live-Mitschrift \u2014 ausgewertet wird beim Klick auf Weiter die Audio-Aufnahme.</div>' +
            '</details>' +
            '<div class="vi-recbtns">' +
              '<button type="button" class="vi-rbtn" id="vi-pause">' + pauseSvg() + ' Pause</button>' +
              '<button type="button" class="vi-rbtn" id="vi-stop">' + stopSvg() + ' Stopp</button>' +
            '</div>' +
          '</div>' +
          '<div id="oabi-result"></div>' +
        '</div>' +
        '<div class="oabi-foot">' +
          '<button type="button" class="oabi-btn" id="oabi-cancel">Abbrechen</button>' +
          '<button type="button" class="oabi-btn primary" id="vi-next">Weiter \u2014 auswerten (1\u00a0L)</button>' +
          '<button type="button" class="oabi-btn primary" id="oabi-apply" disabled style="display:none">' + checkSvg() + ' Ausgew\u00e4hlte \u00fcbernehmen</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    $('oabi-cancel').addEventListener('click', function () {
      stopAll();
      var x = $('oabi-ov'); if (x) x.remove();
      OA.setMode(false, null);
      done();
    });
    $('vi-pause').addEventListener('click', togglePause);
    $('vi-stop').addEventListener('click', stopRecordingKeep);
    $('vi-next').addEventListener('click', function () { evaluate(OA); });
    $('oabi-apply').addEventListener('click', function () {
      OA.apply();  /* applyMerged: schreibt, schliesst, fired done */
      /* v514: nach Sprach-Uebernahme das Objekt einmal speichern (nur Objekt-Kontext) */
      if (!_qcTarget) {
        try { if (typeof window.saveObj === 'function') Promise.resolve(window.saveObj({ silent: true })); } catch (e) {}
      }
    });

    startRecording();
  }

  /* ── Aufnahme + Live-Vorschau ─────────────────────────────────────── */
  function pickMime() {
    var cands = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    for (var i = 0; i < cands.length; i++) { if (MediaRecorder.isTypeSupported(cands[i])) return cands[i]; }
    return '';
  }

  function startRecording() {
    st.chunks = []; st.elapsed = 0; st.finalText = '';
    st.running = false; st.paused = false; st.stopped = false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      setState('stopped', 'Aufnahme wird von diesem Browser nicht unterst\u00fctzt');
      var nx = $('vi-next'); if (nx) nx.disabled = true;
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      .then(function (stream) {
        st.stream = stream;
        st.mime = pickMime() || 'audio/webm';
        /* v535-singleconsumer: MediaRecorder NICHT mehr direkt am Mic (Dual-Consumer ->
           Browser "muted" einen Zweig -> Live-PCM peak=0). Recorder wird in startStream
           aus dem AudioContext-Graphen gespeist (genau ein Mic-Consumer). */
        st.running = true;
        st.lastTick = Date.now();
        st.timer = setInterval(tick, 300);
        _catalog = buildCatalog();
        buildChips();
        startStream(stream);  /* v507: Streaming statt Web Speech */
        setState('rec', 'Aufnahme l\u00e4uft \u2026');
      })
      .catch(function (err) {
        setState('stopped', 'Mikrofon-Zugriff fehlgeschlagen: ' + ((err && err.name) || err));
        var nx = $('vi-next'); if (nx) nx.disabled = true;
      });
  }

  function setState(mode, txt) {
    var s = $('vi-status'); if (!s) return;
    s.classList.toggle('paused', mode === 'paused');
    s.classList.toggle('stopped', mode === 'stopped');
    var t = $('vi-statetxt'); if (t) t.textContent = txt;
  }

  function tick() {
    if (!$('oabi-ov')) { stopAll(); return; }  /* Modal anderweitig geschlossen */
    if (st.running && !st.paused) {
      var now = Date.now();
      st.elapsed += (now - st.lastTick) / 1000;
      st.lastTick = now;
      if (st.elapsed >= MAX_SEC) { stopRecordingKeep(); setState('stopped', '2-Minuten-Limit erreicht \u2014 jetzt auswerten'); }
    } else {
      st.lastTick = Date.now();
    }
    var tEl = $('vi-time');
    if (tEl) { var sec = Math.min(Math.floor(st.elapsed), MAX_SEC); var m = Math.floor(sec / 60), r = sec % 60; tEl.textContent = (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
  }

  function startLevelMeter(stream) {
    try {
      st.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var src = st.audioCtx.createMediaStreamSource(stream);
      st.analyser = st.audioCtx.createAnalyser();
      st.analyser.fftSize = 512;
      src.connect(st.analyser);
      var data = new Uint8Array(st.analyser.frequencyBinCount);
      (function loop() {
        if (!st.analyser || !$('vi-level')) return;
        st.analyser.getByteTimeDomainData(data);
        var sum = 0;
        for (var i = 0; i < data.length; i += 4) { var d = (data[i] - 128) / 128; sum += d * d; }
        var rms = Math.sqrt(sum / (data.length / 4));
        var bar = document.querySelector('#vi-level i');
        if (bar) bar.style.width = (st.paused || st.stopped ? 0 : Math.min(100, Math.round(rms * 380))) + '%';
        requestAnimationFrame(loop);
      })();
    } catch (e) {}
  }

  /* v507: Live-Streaming an /api/v1/ai/voice-stream -> OpenAI Realtime.
     Liefert den Live-Text in JEDEM Browser + speist die Chip-Wolke. Parallel
     laeuft MediaRecorder weiter (Audio-Blob fuer die finale Auswertung). */
    function startStream(stream) {
    /* v536-livechunks: Web-Audio liefert auf manchen Geraeten Stille -> Realtime-WS
       unbrauchbar (peak=0). Live-Mitschrift kommt jetzt aus dem MediaRecorder-Pfad
       (hat nachweislich Ton): Recorder laeuft DIREKT am Mic; alle ~5s wird der
       bisherige Mitschnitt via POST /transcribe-chunk transkribiert und angezeigt.
       Die finale, exakte Auswertung bleibt unveraendert (collectBlob -> extract-voice). */
    try { st.rec = st.mime ? new MediaRecorder(stream, { mimeType: st.mime }) : new MediaRecorder(stream); }
    catch (e) { try { st.rec = new MediaRecorder(stream); } catch (e2) { st.rec = null; } }
    if (st.rec) {
      st.rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) st.chunks.push(ev.data); };
      try { st.rec.start(1000); } catch (e) {}
    }
    sx.finalText = ''; sx.delta = '';
    /* v537-qmreset: quickMatch-State je Aufnahme zuruecksetzen (Greening + Cap) */
    qm.calls = 0; qm.lastLen = 0; qm.inflight = false;
    if (qm.timer) { clearTimeout(qm.timer); qm.timer = null; }
    if (typeof qm.max !== 'number') qm.max = 60;
    if (sx.liveTimer) { clearInterval(sx.liveTimer); sx.liveTimer = null; }
    sx.liveBusy = false; sx.liveLastLen = 0;
    sx.liveTimer = setInterval(function () {
      if (st.paused || st.stopped || sx.liveBusy) return;
      if (!st.chunks || !st.chunks.length || st.chunks.length === sx.liveLastLen) return;
      sx.liveLastLen = st.chunks.length; sx.liveBusy = true;
      var blob; try { blob = new Blob(st.chunks, { type: st.mime || 'audio/webm' }); } catch (e) { sx.liveBusy = false; return; }
      if (!blob || blob.size < 1200) { sx.liveBusy = false; return; }
      var r = new FileReader();
      r.onloadend = function () {
        var b64 = String(r.result || '').split(',')[1] || '';
        if (!b64) { sx.liveBusy = false; return; }
        var tok = ''; try { tok = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
        fetch('/api/v1/ai/transcribe-chunk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
          body: JSON.stringify({ audio: b64, mime: st.mime || 'audio/webm' })
        }).then(function (res) { return res.json().catch(function () { return {}; }); })
          .then(function (data) {
            var t = (data && data.text) || '';
            if (t) { sx.finalText = t; sx.delta = ''; try { renderLive(); } catch (e) {} try { scheduleQuickMatch(); } catch (e) {} }
            sx.liveBusy = false;
          }).catch(function () { sx.liveBusy = false; });
      };
      r.onerror = function () { sx.liveBusy = false; };
      r.readAsDataURL(blob);
    }, 5000);
  }

  function renderLive() {
    var ta = $('vi-live');
    if (ta) { ta.value = (sx.finalText + (sx.delta ? ' ' + sx.delta : '')).trim(); ta.scrollTop = ta.scrollHeight; }
    updateChipsFromText((sx.finalText + ' ' + sx.delta).toLowerCase());
  }

  function stopStream() {
    sx.on = false;
    try { if (sx.ws && sx.ws.readyState <= 1) sx.ws.close(); } catch (e) {}
    sx.ws = null;
    try { if (sx.proc) sx.proc.disconnect(); } catch (e) {}
    try { if (sx.src) sx.src.disconnect(); } catch (e) {}
    try { if (sx.ctx) sx.ctx.close(); } catch (e) {}
    sx.proc = null; sx.src = null; sx.ctx = null;
  }

  /* Float32 -> Int16 PCM mit Resampling auf 24 kHz */
  function downsamplePcm16(buf, fromRate, toRate) {
    if (fromRate === toRate) { var o = new Int16Array(buf.length); for (var i=0;i<buf.length;i++){var s2=Math.max(-1,Math.min(1,buf[i]));o[i]=s2<0?s2*0x8000:s2*0x7FFF;} return o; }
    var ratio = fromRate / toRate, n = Math.floor(buf.length / ratio), out = new Int16Array(n), pos = 0;
    for (var k=0;k<n;k++){ var nx=Math.round((k+1)*ratio), sum=0, c=0; for(var j=pos;j<nx&&j<buf.length;j++){sum+=buf[j];c++;} var v=c?sum/c:0; v=Math.max(-1,Math.min(1,v)); out[k]=v<0?v*0x8000:v*0x7FFF; pos=nx; }
    return out;
  }

  /* ── Chip-Wolke: "beantwortet?" -> gruen ───────────────────────── */
  /* v510: Kuratierte Whitelist der EINSPRECHBAREN Felder mit Klartext-Labels +
     Gruppen. Interne/kryptische Felder (_*, ai_*, kp1..kp4l, d2_az, bspar_*,
     me_*, rate_*, ji_p, kuerzel, thesis, exitstr, bankval ...) sind bewusst NICHT
     dabei. Reihenfolge = Anzeigereihenfolge; DS2/Markt kommt ans Ende. */
  /* v979-voice-merge: 5 -> 3 Kategorien; Kauf(1)+Finanzierung(3)+Lage(4) zusammengelegt */
  var WL_GROUPS = ['Stammdaten', 'Kauf & Nebenkosten', 'Miete', 'Finanzierung', 'Lage & Bewertung'];  /* v998-groups: zurueck auf 5 */
  var WL = [
    /* v977-voice-layout: Reihenfolge Objektart->Adresse->Flaechen; Aussenstellpl./Etage/Garagen ohne Chip; Kaufdatum/Uebergang -> Kauf */
    { id:'objart',     g:0, label:'Objektart',           kw:['eigentumswohnung','mehrfamilien','einfamilien','wohnung','haus','etw','mfh','efh','reihenhaus'] },
    { id:'str',        g:0, label:'Strasse',             kw:['strasse','str'] },
    { id:'hnr',        g:0, label:'Hausnummer',          kw:['hausnummer','nummer'] },
    { id:'plz',        g:0, label:'PLZ',                 kw:['postleitzahl','plz'] },
    { id:'ort',        g:0, label:'Ort',                 kw:['ort','stadt','gemeinde'] },
    { id:'wfl',        g:0, label:'Wohnflaeche',         kw:['wohnflaeche','quadratmeter','qm','quadrat'] },
    { id:'zimmer',     g:0, label:'Zimmer',              kw:['zimmer'] },
    { id:'baujahr',    g:0, label:'Baujahr',             kw:['baujahr','gebaut','errichtet'] },
    { id:'etage',      g:0, noc:1, label:'Etage',               kw:['etage','stock','geschoss','obergeschoss'] },
    { id:'stellpl_aussen', g:0, noc:1, label:'Aussenstellplaetze', kw:['stellplatz','aussenstellplatz','parkplatz'] },
    { id:'garagen',    g:0, noc:1, label:'Garagen',             kw:['garage','tiefgarage'] },
    { id:'kaufdat',    g:1, label:'Kaufdatum',           kw:['kaufdatum','gekauft','erworben'] },
    { id:'wirtschaftlicher_uebergang', g:1, label:'Wirtsch. Uebergang', kw:['wirtschaftlicher uebergang','nutzen lasten','nutzen und lasten','lastenwechsel','besitzuebergang','uebergang'] },

    { id:'kp',         g:1, label:'Kaufpreis',           kw:['kaufpreis','kostet','preis','kaufsumme'] },
    { id:'makler_p',   g:1, noc:1, label:'Maklerprovision %',   kw:['makler','maklerprovision','courtage'] },
    { id:'notar_p',    g:1, noc:1, label:'Notarkosten %',       kw:['notar','notarkosten'] },
    { id:'gba_p',      g:1, noc:1, label:'Grundbuch %',         kw:['grundbuch'] },
    { id:'gest_p',     g:1, noc:1, label:'Grunderwerbsteuer %', kw:['grunderwerbsteuer','grunderwerb'] },
    { id:'san',        g:1, label:'Sanierungskosten',    kw:['sanierung','sanierungskosten','renovierung'] },
    { id:'moebl',      g:1, label:'Moeblierung',         kw:['moeblierung','inventar','einrichtung'] },

    { id:'nkm',        g:2, label:'Kaltmiete',           kw:['kaltmiete','miete','nettokaltmiete','grundmiete'] },
    { id:'ze',         g:2, label:'Zusatzeinnahmen',     kw:['zusatzeinnahmen','zusatz'] },
    { id:'hg_ul',      g:2, label:'Hausgeld',            kw:['hausgeld'] },
    { id:'hg_nul',     g:2, label:'davon nicht umlagef.',kw:['nicht umlagefaehig','nicht umlagefahig'] },
    { id:'grundsteuer',g:2, noc:1, label:'Grundsteuer',         kw:['grundsteuer'] },

    { id:'ek',         g:3, label:'Eigenkapital',        kw:['eigenkapital','eigenmittel'] },
    { id:'d1z',        g:3, label:'Zinssatz',            kw:['zins','zinssatz','sollzins'] },
    { id:'d1t',        g:3, label:'Tilgung',             kw:['tilgung','anfangstilgung'] },
    { id:'d1_bindj',   g:3, label:'Zinsbindung (J.)',    kw:['zinsbindung','bindung','sollzinsbindung'] },

    { id:'brw',        g:4, label:'Bodenrichtwert',      kw:['bodenrichtwert'] },
    { id:'mea',        g:4, label:'Miteigentumsanteil',  kw:['miteigentumsanteil','mea'] },
    { id:'gsfl',       g:4, label:'Grundstuecksflaeche', kw:['grundstueck','grundstuecksflaeche'] },
    { id:'makrolage',  g:4, label:'Makrolage',           kw:['makrolage','makro','region'] },
    { id:'mikrolage',  g:4, label:'Mikrolage',           kw:['mikrolage','mikro','viertel','umfeld'] },
    { id:'ds2_zustand',g:4, label:'Zustand',             kw:['zustand'] },
    { id:'ds2_energie',g:4, label:'Energieklasse',       kw:['energie','energieklasse','effizienz'] },

    { id:'ds2_nachfrage',    g:5, noc:1, label:'Nachfrage',           kw:['nachfrage'] },
    { id:'ds2_bevoelkerung', g:5, noc:1, label:'Bevoelkerung',        kw:['bevoelkerung','einwohner'] },
    { id:'ds2_marktmiete',   g:5, noc:1, label:'Marktmiete',          kw:['marktmiete'] },
    { id:'mietstg',          g:5, noc:1, label:'Mietsteigerung %',    kw:['mietsteigerung'] },
    { id:'wertstg',          g:5, noc:1, label:'Wertsteigerung %',    kw:['wertsteigerung'] },
    { id:'ds2_mietausfall',  g:5, noc:1, label:'Mietausfallwagnis',   kw:['mietausfall','mietausfallwagnis'] }
  ];
  var WL_MAP = {}; WL.forEach(function (w) { WL_MAP[w.id] = w; });
  /* v517: Quick-Check-Felder (= Keys aus object-actions OBJ2QC + ze_*). Im QC
     zeigt die Chip-Wolke NUR diese; Objekt-Modus = volle WL (zwei Sessions). */
  var QC_IDS = ['str','hnr','plz','ort','wfl','baujahr','zimmer','objart','kp','nkm',
    'hg_ul','ek','ds2_energie','stellpl_aussen','d1z','d1t','ze_stp','ze_kueche','ze_sonst'];

  /* v521: Kurz-Erklaerungen fuer Tooltips (Maus ueber Chip). Fallback = Label. */
  var EXPLAIN = {
    plz:'Postleitzahl des Objekts', ort:'Stadt / Gemeinde', str:'Strassenname',
    hnr:'Hausnummer', objart:'Art des Objekts (z.B. Eigentumswohnung, Mehrfamilienhaus)',
    wfl:'Wohnflaeche in m\u00b2', baujahr:'Baujahr des Gebaeudes',
    kaufdat:'Datum des Kaufvertrags (Beurkundung)',
    wirtschaftlicher_uebergang:'Nutzen-/Lastenwechsel: ab wann Mieten & Kosten dir zufliessen \u2014 oft nach dem Kaufdatum',
    zimmer:'Anzahl Zimmer', etage:'Etage / Geschoss',
    stellpl_aussen:'Anzahl Aussenstellplaetze', garagen:'Anzahl Garagen / Tiefgaragen',
    kp:'Kaufpreis in Euro', san:'Geplante Sanierungs-/Renovierungskosten in Euro',
    moebl:'Wert der Moeblierung / Inventar in Euro',
    nkm:'Netto-Kaltmiete (ohne Nebenkosten)', ze:'Zusatzeinnahmen pro Monat (Stellplatz, Kueche \u2026) \u2014 Summe',
    hg_ul:'Hausgeld-Anteil, der auf den Mieter UMLEGBAR ist',
    hg_nul:'Hausgeld-Anteil, der NICHT umlegbar ist (traegt der Eigentuemer)',
    grundsteuer:'Grundsteuer pro Jahr',
    ek:'Eingesetztes Eigenkapital in Euro', d1z:'Sollzinssatz des Darlehens in %',
    d1t:'Anfaengliche Tilgung in %', d1_bindj:'Zinsbindung in Jahren',
    brw:'Bodenrichtwert pro m\u00b2', mea:'Miteigentumsanteil in %',
    gsfl:'Grundstuecksflaeche in m\u00b2',
    makrolage:'Lage im Grossen (Stadt / Region / Wirtschaft)',
    mikrolage:'Lage im Kleinen (Viertel / Strasse / Umfeld)',
    ds2_zustand:'Zustand der Wohnung', ds2_energie:'Energieeffizienzklasse',
    ze_stp:'Stellplatzmiete pro Monat', ze_kueche:'Kuechen-/Inventarmiete pro Monat',
    ze_sonst:'Sonstige Zusatzeinnahmen pro Monat'
  };
  /* QC-Einzelposten (virtuell) — Gruppe Miete */
  var WL_VIRT = [
    { id:'ze_stp',    g:2, label:'Stellplatzmiete', kw:['stellplatz','garage','parkplatz','tiefgarage'] },
    { id:'ze_kueche', g:2, label:'Kuechenmiete',    kw:['kueche','kuche'] },
    { id:'ze_sonst',  g:2, label:'Sonstige Einnahmen', kw:['sonstige einnahmen','sonstiges'] }
  ];

  /* Pflichtfelder fuer die Tacho-Anzeige (je Kontext). Sub-Array = EINE
     Anforderung, erfuellt wenn IRGENDEINE der ids markiert ist. */
  var REQ_QC  = [['kp'], ['wfl'], ['nkm'], ['plz', 'ort']];
  var REQ_OBJ = [['kp'], ['wfl'], ['nkm'], ['baujahr'], ['plz', 'ort']];

  function _de(x){ return String(x||'').toLowerCase().replace(/\u00e4/g,'ae').replace(/\u00f6/g,'oe').replace(/\u00fc/g,'ue').replace(/\u00df/g,'ss'); }
  function chipMeta(id){ return WL_MAP[id] || null; }
  function chipKeywords(entry) {
    var meta = WL_MAP[entry.id];
    var kw = (meta && meta.kw) ? meta.kw.slice() : [];
    var lbl = (meta && meta.label) || entry.label || '';
    _de(lbl).split(/[^a-z0-9]+/).forEach(function (w) { if (w.length >= 4) kw.push(w); });
    return kw;
  }
  function fieldHasValue(id) {
    try { var el = document.getElementById(id); if (el && String(el.value || '').trim() !== '') return true; } catch (e) {}
    return false;
  }
  function buildChips() {
    var host = $('vi-chips'); if (!host) return;
    /* v975-voice-nachzug: echte Body-Helligkeit messen (nicht Skin raten) */
    setTimeout(function(){ try{ var ov=document.querySelector('.oabi-ov.vi-mode'); if(!ov) return;
      var m=ov.querySelector('.oabi-modal')||ov; var bg=getComputedStyle(m).backgroundColor;
      var c=/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(bg||'');
      if(c){ var lum=0.299*+c[1]+0.587*+c[2]+0.114*+c[3]; ov.classList.toggle('vi-darkbg', lum<128); } }catch(e){} }, 60);
    _activeGrp = -1;
    var byGroup = {};
    _catalog.forEach(function (e) {
      if (e.noc) return;  /* NK-Einzelfelder/Markt nicht als Chip */
      var g0 = (typeof e.g === 'number') ? e.g : 0;
      var g = g0;  /* v998-groups: Original-Zuordnung (v979-Remap zurueckgebaut) */
      (byGroup[g] = byGroup[g] || []).push(e);
    });
    var html = '';
    for (var gi = 0; gi < WL_GROUPS.length; gi++) {
      var items = byGroup[gi]; if (!items || !items.length) continue;
      html += items.map(function (e) {
        var short = (e.label || e.id).split('(')[0].trim();
        if (short.length > 22) short = short.slice(0, 21) + '\u2026';
        return '<span class="vi-chip" data-cid="' + escH(e.id) + '" data-g="' + gi + '" title="' + escH(EXPLAIN[e.id] || e.label || e.id) + '"><span class="vi-ck">\u2713</span>' + escH(short) + '</span>';
      }).join('');
    }
    host.innerHTML = html;
    var nk = $('vi-nkhint');
    if (nk) nk.textContent = _qcTarget ? '' : 'Kaufnebenkosten (Makler/Notar/Grundbuch/Grunderwerbsteuer) werden automatisch gef\u00fcllt, wenn du sie nennst.';
    updateChipsCount();
  }
  function updateChipsFromText(txt) {
    if (!txt) return;
    var t = _de(txt);
    var host = $('vi-chips'); if (!host) return;
    /* v510: ein paar kontextuelle Muster (Live = grobe Vorschau; exakt beim Auswerten) */
    var hasPlz = /(^|\D)\d{5}(\D|$)/.test(txt);
    /* v512: Hausnummer = 'strasse <zahl>'; Ort = Wort direkt nach 5-stelliger PLZ */
    var hasHnr = /stra(ss|\u00df)e?\.?\s+\d{1,4}/i.test(txt) || /\bnummer\s+\d{1,4}/i.test(txt) || /\bhausnummer\b/i.test(txt);
    var mOrt = txt.match(/\b\d{5}\s+([A-Z\u00c4\u00d6\u00dc][a-z\u00e4\u00f6\u00fc\u00df-]{2,})/);
    var hasOrt = !!mOrt;
    _catalog.forEach(function (e) {
      var chip = host.querySelector('.vi-chip[data-cid="' + e.id + '"]');
      if (!chip || chip.classList.contains('on')) return;
      if (e.id === 'plz' && hasPlz) { chip.classList.add('on'); return; }
      if (e.id === 'hnr' && hasHnr) { chip.classList.add('on'); return; }
      if (e.id === 'ort' && hasOrt) { chip.classList.add('on'); return; }
      var kws = chipKeywords(e);
      for (var i = 0; i < kws.length; i++) { if (kws[i] && t.indexOf(_de(kws[i])) >= 0) { chip.classList.add('on'); break; } }
    });
    updateChipsCount();
  }
  function markChipsFinal(fields) {
    var host = $('vi-chips'); if (!host) return;
    Object.keys(fields || {}).forEach(function (id) {
      var chip = host.querySelector('.vi-chip[data-cid="' + id + '"]');
      if (chip) chip.classList.add('on');
    });
    updateChipsCount();
  }
  var _activeGrp = -1;  /* v517 */
  /* v517: markiert komplette Gruppen + scrollt zur ersten offenen Gruppe (gefuehrte Hilfe) */
  function refreshGroupProgress() {
    var host = $('vi-chips'); if (!host) return;
    var chips = host.querySelectorAll('.vi-chip');
    if (!chips.length) return;
    var groups = {};
    Array.prototype.forEach.call(chips, function (c) {
      var g = +c.getAttribute('data-g');
      (groups[g] = groups[g] || []).push(c);
    });
    var order = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    function filled(c) { return c.classList.contains('on') || c.classList.contains('pre'); }
    var active = order[order.length - 1];
    for (var i = 0; i < order.length; i++) {
      if (groups[order[i]].some(function (c) { return !filled(c); })) { active = order[i]; break; }
    }
    _activeGrp = active;
    var cl = $('vi-catline');
    if (cl) {
      cl.innerHTML = '<b>' + escH((WL_GROUPS[active] || '').toUpperCase()) + '</b>' +
        '<span class="vi-catsub">Kategorie ' + (order.indexOf(active) + 1) + ' / ' + order.length + '</span>';
    }
    var ring = groups[active] || [];
    var n = ring.length;
    Array.prototype.forEach.call(chips, function (c) {
      c.style.display = (+c.getAttribute('data-g') === active) ? '' : 'none';
    });
    if (n <= 9) {
      var R = Math.min(168, 116 + n * 6);
      ring.forEach(function (c, i) {
        var ang = (-90 + i * 360 / n) * Math.PI / 180;
        c.style.left = 'calc(50% + ' + Math.round(R * Math.cos(ang)) + 'px)';
        c.style.top  = 'calc(50% + ' + Math.round(R * Math.sin(ang)) + 'px)';
      });
    } else {
      /* v979-voice-merge: zwei Ringe fuer volle Merge-Orbits */
      var inN = Math.ceil(n / 2);
      ring.forEach(function (c, i) {
        var inner = i < inN, idx = inner ? i : (i - inN), cnt = inner ? inN : (n - inN);
        var R = inner ? 112 : 178, off = inner ? 0 : (180 / cnt);
        var ang = (-90 + off + idx * 360 / cnt) * Math.PI / 180;
        c.style.left = 'calc(50% + ' + Math.round(R * Math.cos(ang)) + 'px)';
        c.style.top  = 'calc(50% + ' + Math.round(R * Math.sin(ang)) + 'px)';
      });
    }
  }
    function updateChipsCount() {
    var host = $('vi-chips'); if (!host) return;
    var on  = host.querySelectorAll('.vi-chip.on,.vi-chip.pre').length;
    var tot = host.querySelectorAll('.vi-chip').length;
    var c = $('vi-chips-count'); if (c) c.innerHTML = '<b>' + on + '</b> / ' + tot + ' Felder';
    var pct = tot ? Math.round(on / tot * 100) : 0;
    var fill = $('vi-fill'); if (fill) fill.style.width = pct + '%';
    var pc = $('vi-prog-pct'); if (pc) pc.textContent = pct + ' %';
    var lt = $('vi-listen-txt'); if (lt) lt.textContent = (tot && on >= tot) ? 'Alle Felder erkannt' : 'H\u00f6rt zu';
    refreshGroupProgress();
  }
    function _chipMarked(id) {
    var host = $('vi-chips'); if (!host) return false;
    var chip = host.querySelector('.vi-chip[data-cid="' + id + '"]');
    return !!(chip && (chip.classList.contains('on') || chip.classList.contains('pre')));
  }
  /* v510: Tacho — Pflichtfelder erfuellt? (je Kontext) */
  /* ── v514: Glow-Instrument-Gauges (DealPilot-Aviation-Stil) ───────── */
  var _UID = 0;
  function _arcPts(cx, cy, r, t0, t1, n) {
    var p = [];
    for (var i = 0; i <= n; i++) { var t = t0 + (t1 - t0) * i / n, w = Math.PI * (1 - t); p.push((cx + r * Math.cos(w)).toFixed(1) + ',' + (cy - r * Math.sin(w)).toFixed(1)); }
    return p.join(' ');
  }
  var _ZD = [['#B86250', '#FF8E72', 0, 0.5], ['#C9A84C', '#FFE49A', 0.5, 0.7], ['#3FA56C', '#74FFB8', 0.7, 1]];
  function _glow(p) { return p >= 70 ? '#56E89A' : p >= 50 ? '#F2CF6C' : '#FF6E54'; }
  function _gaugeMain(score) {
    var id = ++_UID, cx = 110, cy = 104, r = 84, sw = 12, t = Math.max(0, Math.min(1, score / 100)), g = _glow(score);
    var grads = _ZD.map(function (z, i) { return '<linearGradient id="zg' + id + '_' + i + '" x1="0" x2="1"><stop offset="0" stop-color="' + z[0] + '"/><stop offset="1" stop-color="' + z[1] + '"/></linearGradient>'; }).join('');
    var arcs = _ZD.map(function (z, i) { return '<polyline points="' + _arcPts(cx, cy, r, z[2], z[3], 18) + '" fill="none" stroke="url(#zg' + id + '_' + i + ')" stroke-width="' + sw + '" filter="url(#gl' + id + ')"/>'; }).join('');
    var ticks = ''; for (var k = 0; k <= 10; k++) { var w0 = Math.PI * (1 - k / 10), r1 = r - sw / 2 - 3, r2 = r - sw / 2 - (k % 5 === 0 ? 10 : 6); ticks += '<line x1="' + (cx + r1 * Math.cos(w0)).toFixed(1) + '" y1="' + (cy - r1 * Math.sin(w0)).toFixed(1) + '" x2="' + (cx + r2 * Math.cos(w0)).toFixed(1) + '" y2="' + (cy - r2 * Math.sin(w0)).toFixed(1) + '" stroke="#54545e" stroke-width="' + (k % 5 === 0 ? 1.6 : 1) + '"/>'; }
    var w = Math.PI * (1 - t), nx = cx + (r - 11) * Math.cos(w), ny = cy - (r - 11) * Math.sin(w);
    return '<svg viewBox="0 0 220 122" style="width:100%;max-width:168px;display:block;overflow:visible">' +
      '<defs>' + grads + '<filter id="gl' + id + '" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<filter id="ng' + id + '"><feGaussianBlur stdDeviation="2.2"/></filter></defs>' +
      ticks + arcs +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="' + g + '" stroke-width="3.6" stroke-linecap="round" filter="url(#ng' + id + ')" opacity=".8"/>' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="5.5" fill="' + g + '" filter="url(#ng' + id + ')"/><circle cx="' + cx + '" cy="' + cy + '" r="4.5" fill="#fff"/><circle cx="' + cx + '" cy="' + cy + '" r="2" fill="#0a0a0c"/>' +
      '<text x="' + cx + '" y="' + (cy - 16) + '" text-anchor="middle" fill="#fff" font-family="Space Grotesk" font-weight="700" font-size="28" style="filter:drop-shadow(0 0 9px ' + g + '88)">' + Math.round(score) + '%</text>' +
      '</svg>';
  }
  function _gaugeMini(score) {
    var id = ++_UID, cx = 70, cy = 62, r = 50, sw = 8.5, t = Math.max(0, Math.min(1, score / 100)), g = _glow(score);
    var grads = _ZD.map(function (z, i) { return '<linearGradient id="mg' + id + '_' + i + '" x1="0" x2="1"><stop offset="0" stop-color="' + z[0] + '"/><stop offset="1" stop-color="' + z[1] + '"/></linearGradient>'; }).join('');
    var arcs = _ZD.map(function (z, i) { return '<polyline points="' + _arcPts(cx, cy, r, z[2], z[3], 14) + '" fill="none" stroke="url(#mg' + id + '_' + i + ')" stroke-width="' + sw + '" filter="url(#ml' + id + ')"/>'; }).join('');
    var w = Math.PI * (1 - t), nx = cx + (r - 8) * Math.cos(w), ny = cy - (r - 8) * Math.sin(w);
    return '<svg viewBox="0 0 140 76" style="width:100%;max-width:108px;overflow:visible">' +
      '<defs>' + grads + '<filter id="ml' + id + '" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      arcs +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="#fff" stroke-width="1.8" stroke-linecap="round" style="filter:drop-shadow(0 0 3px ' + g + ')"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="3.4" fill="#fff"/>' +
      '<text x="' + cx + '" y="' + (cy - 5) + '" text-anchor="middle" fill="' + g + '" font-family="Space Grotesk" font-weight="700" font-size="20" style="filter:drop-shadow(0 0 6px ' + g + '88)">' + Math.round(score) + '</text></svg>';
  }
  /* leichte, langsame Goldpartikel im Karten-Hintergrund (Pure-Obsidian-Feeling) */
  function _startParts(canvas) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var ctx = canvas.getContext('2d'), dots = [], DPR = Math.min(2, window.devicePixelRatio || 1);
    function size() { var r = canvas.getBoundingClientRect(); canvas.width = Math.max(1, r.width * DPR); canvas.height = Math.max(1, r.height * DPR); }
    size();
    var N = 14;  /* v525: dezenter */
    for (var i = 0; i < N; i++) dots.push({ x: Math.random(), y: Math.random(), r: (Math.random() * 1.2 + 0.4) * DPR, s: Math.random() * 0.10 + 0.02, a: Math.random() * 0.32 + 0.10, c: Math.random() < 0.7 });  /* v525: dezenter */
    function frame() {
      if (!canvas.isConnected) return;  /* Modal zu -> Schleife endet */
      var W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      for (var j = 0; j < dots.length; j++) {
        var d = dots[j]; d.y -= d.s / 100; if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
        var px = d.x * W, py = d.y * H;
        ctx.beginPath(); ctx.arc(px, py, d.r, 0, 6.283);
        ctx.fillStyle = (d.c ? 'rgba(201,168,76,' : 'rgba(120,255,184,') + d.a.toFixed(2) + ')';
        ctx.shadowBlur = 3 * DPR; ctx.shadowColor = d.c ? '#C9A84C' : '#3FA56C';  /* v525: weniger Glow */
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    window.addEventListener('resize', size);
    requestAnimationFrame(frame);
  }
  function renderGauge() {
    var host = $('vi-gauge'); if (!host) return;
    /* Shell (dunkle Karte + Partikel-Canvas + Body) einmalig bauen */
    if (!host.querySelector('.vi-dark-body')) {
      host.innerHTML = '<canvas class="vi-parts"></canvas><div class="vi-dark-body"></div>';
      var cv = host.querySelector('.vi-parts');
      try { _startParts(cv); } catch (e) {}
    }
    var body = host.querySelector('.vi-dark-body');
    var req = _qcTarget ? REQ_QC : REQ_OBJ;
    var met = 0;
    req.forEach(function (alt) { if (alt.some(function (id) { return _chipMarked(id); })) met++; });
    var tot = req.length, pct = tot ? Math.round(met / tot * 100) : 0;
    var status = pct >= 100 ? 'Bereit zur Auswertung' : pct >= 50 ? 'Fast komplett' : 'Pflichtfelder offen';
    /* Bereiche: gesamt/erledigt + bis zu 2 fehlende (noc-Felder zaehlen NICHT) */
    var grpTot = {}, grpOn = {}, grpMiss = {};
    _catalog.forEach(function (e) {
      if (e.noc) return;
      var g = (typeof e.g === 'number') ? e.g : 0;
      grpTot[g] = (grpTot[g] || 0) + 1;
      if (_chipMarked(e.id)) grpOn[g] = (grpOn[g] || 0) + 1;
      else (grpMiss[g] = grpMiss[g] || []).push(e.label);
    });
    function groupBlock(gi) {
      if (!grpTot[gi]) return '';
      var gp = Math.round((grpOn[gi] || 0) / grpTot[gi] * 100);
      var miss = (grpMiss[gi] || []).slice(0, 2);
      var sugg = miss.length
        ? '<div class="vi-grp-sugg">' + miss.map(function (l) { return '<span>' + escH(l) + '</span>'; }).join('') + '</div>'
        : '<div class="vi-grp-sugg vi-grp-ok">\u2713 komplett</div>';
      return '<div class="vi-grpcard">' + sugg + _gaugeMini(gp) +
        '<div class="vi-grp-name">' + escH((WL_GROUPS[gi] || '').split(' ')[0]) + '</div></div>';
    }
    var blocks = '';
    for (var gi = 0; gi < WL_GROUPS.length; gi++) blocks += groupBlock(gi);
    body.innerHTML =
      '<div class="vi-gauge-row">' + _gaugeMain(pct) +
        '<div><div class="vg-status" style="color:' + _glow(pct) + '">' + status + '</div>' +
        '<div class="vg-txt">Pflichtfelder ' + met + ' / ' + tot + (_qcTarget ? ' (Quick Check)' : ' (Objekt)') + '</div></div>' +
      '</div>' +
      '<div class="vi-grpcards">' + blocks + '</div>';
  }

  /* ── v513: Live-KI-Zwischenauswertung ─────────────────────────────
     Event-gesteuert (nach abgeschlossenem Sprachsegment), debounced,
     hart auf qm.max Calls/Aufnahme begrenzt. Faerbt Chips EXAKT aus dem
     Kontext (Strasse/Hausnummer ohne Schluesselwort). KEIN Kerosin. */
  function scheduleQuickMatch() {
    if (qm.calls >= qm.max) return;
    if (qm.timer) clearTimeout(qm.timer);
    qm.timer = setTimeout(runQuickMatch, 600);  /* v996: schneller gruen */
  }
  function runQuickMatch() {
    if (qm.inflight || qm.calls >= qm.max) return;
    var txt = (sx.finalText || '').trim();
    if (txt.length < 8 || txt.length === qm.lastLen) return;  /* nichts Neues */
    qm.inflight = true; qm.calls++; qm.lastLen = txt.length;
    var tok = ''; try { tok = localStorage.getItem(TOKEN_KEY) || ''; } catch (e) {}
    var cat = _catalog.map(function (e) { return { id: e.id, label: e.label }; });
    fetch('/api/v1/ai/voice-quickmatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
      body: JSON.stringify({ transcript: txt, catalog: cat })
    }).then(function (r) { return r.ok ? r.json() : { ids: [] }; })
      .then(function (d) { markChipsByIds((d && d.ids) || []); })
      .catch(function () {})
      .then(function () { qm.inflight = false; });
  }
  function markChipsByIds(ids) {
    var host = $('vi-chips'); if (!host || !ids || !ids.length) return;
    ids.forEach(function (id) {
      var chip = host.querySelector('.vi-chip[data-cid="' + id + '"]');
      if (chip) chip.classList.add('on');
    });
    updateChipsCount();
  }


  function togglePause() {
    if (!st.running || st.stopped) return;
    var btn = $('vi-pause');
    if (!st.paused) {
      st.paused = true;
      try { if (st.rec && st.rec.state === 'recording') st.rec.pause(); } catch (e) {}
      sx.on = false;  /* v507: Stream pausieren */
      setState('paused', 'Pausiert \u2014 Fortsetzen oder auswerten');
      if (btn) btn.innerHTML = playSvg() + ' Fortsetzen';
    } else {
      st.paused = false;
      st.lastTick = Date.now();
      try { if (st.rec && st.rec.state === 'paused') st.rec.resume(); } catch (e) {}
      sx.on = true;  /* v507: Stream fortsetzen */
      setState('rec', 'Aufnahme l\u00e4uft \u2026');
      if (btn) btn.innerHTML = pauseSvg() + ' Pause';
    }
  }

  function stopRecordingKeep() {
    if (st.stopped) return;
    st.stopped = true; st.running = false;
    stopStream();
    try { if (st.rec && st.rec.state !== 'inactive') st.rec.stop(); } catch (e) {}
    if (st.stream) { try { st.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    setState('stopped', 'Aufnahme beendet \u2014 jetzt auswerten');
    var p = $('vi-pause'); if (p) p.disabled = true;
    var sp = $('vi-stop'); if (sp) sp.disabled = true;
  }

  function stopAll() {
    if (sx.liveTimer) { clearInterval(sx.liveTimer); sx.liveTimer = null; }  /* v536-stopclean */
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    stopStream();
    try { if (st.rec && st.rec.state !== 'inactive') st.rec.stop(); } catch (e) {}
    if (st.stream) { try { st.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} st.stream = null; }
    try { if (st.audioCtx) st.audioCtx.close(); } catch (e) {}
    st.audioCtx = null; st.analyser = null;
    st.running = false; st.paused = false;
  }

  function collectBlob() {
    return new Promise(function (resolve) {
      if (st.rec && st.rec.state !== 'inactive') {
        st.rec.onstop = function () { resolve(new Blob(st.chunks, { type: st.mime })); };
        try { st.rec.stop(); } catch (e) { resolve(new Blob(st.chunks, { type: st.mime })); }
      } else {
        resolve(st.chunks.length ? new Blob(st.chunks, { type: st.mime }) : null);
      }
    });
  }
  function blobToB64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('Audio konnte nicht gelesen werden')); };
      r.readAsDataURL(blob);
    });
  }

  /* ── Auswertung: Audio + Katalog -> Backend -> Import-Tabelle ─────── */
  function evaluate(OA) {
    var nx = $('vi-next'); if (nx) { nx.disabled = true; nx.textContent = 'Auswertung l\u00e4uft \u2026'; }
    /* v519: Objekt-Modus wertet den VOLLEN Feldkatalog aus (alles Gesagte fuellen);
       QC bleibt auf seine Felder beschraenkt. */
    var catalog = _qcTarget ? buildCatalog() : buildFullCatalog();
    stopRecordingKeep();
    if (st.timer) { clearInterval(st.timer); st.timer = null; }
    collectBlob().then(function (blob) {
      stopAll();
      if (!blob || blob.size < 2000) {
        toast('Aufnahme zu kurz \u2014 keine Auswertung (kein Kerosin verbraucht)');
        if (nx) { nx.disabled = false; nx.textContent = 'Weiter \u2014 auswerten (1\u00a0L)'; }
        return;
      }
      return blobToB64(blob)
        .then(function (b64) { return post(b64, blob.type || st.mime, catalog); })
        .then(function (data) {
          try { console.log('[voice-import] Transkript:', data && data.transcript); } catch (e) {}
          showResults(OA, data, catalog);
        });
    }).catch(function (err) {
      if (err && err.needs_credits) {
        toast('Nicht genug Kerosin im Tank (1\u00a0L ben\u00f6tigt) \u2014 bitte tanken');
        try { if (typeof window.showSettings === 'function') window.showSettings('plan'); } catch (e) {}
      } else {
        toast('Sprachauswertung fehlgeschlagen: ' + ((err && err.message) || err));
      }
      if (nx) { nx.disabled = false; nx.textContent = 'Weiter \u2014 auswerten (1\u00a0L)'; }
    });
  }

  function post(audioB64, mime, catalog) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var to = ctrl ? setTimeout(function () { ctrl.abort(); }, API_TIMEOUT) : null;
    var headers = { 'Content-Type': 'application/json' };
    try { var tok = localStorage.getItem(TOKEN_KEY); if (tok) headers['Authorization'] = 'Bearer ' + tok; } catch (e) {}
    return fetch('/api/v1/ai/extract-voice', {
      method: 'POST', headers: headers,
      body: JSON.stringify({ audio: audioB64, mime: mime, catalog: catalog }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (to) clearTimeout(to);
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && (data.message || data.error)) || ('HTTP ' + res.status));
          err.needs_credits = !!(data && data.needs_credits);
          throw err;
        }
        return data;
      });
    }, function (err) {
      if (to) clearTimeout(to);
      throw (err && err.name === 'AbortError') ? new Error('Zeit\u00fcberschreitung (180 s)') : err;
    });
  }

  /* Ergebnisse in die ECHTE Import-Tabelle (gleiche Optik, gleicher Schreibweg) */
  function showResults(OA, data, catalog) {
    var fields = (data && data.fields) || {};
    var unsicher = (data && data.unsicher) || [];
    var S = 'Sprachaufzeichnung';

    OA.reset();  /* _merged leeren (Mode/done bleiben gesetzt) */
    markChipsFinal(fields);  /* v507: erkannte Felder gruen */
    catalog.forEach(function (entry) {
      var id = entry.id;
      if (!(id in fields)) return;
      var v = fields[id];
      var uns = unsicher.indexOf(id) !== -1;
      var mark = uns ? ' \u26A0' : '';
      if (/^rate_/.test(id)) {
        var n = parseInt(v, 10);
        if (n >= 1 && n <= 5) OA.addRow(id, entry.label, n + ' \u2605' + mark, n, S, 'star');
        return;
      }
      if (entry.kind === 'select') {
        var opt = null;
        for (var i = 0; i < (entry.options || []).length; i++) { if (entry.options[i].v === String(v)) { opt = entry.options[i]; break; } }
        OA.addRow(id, entry.label, (opt ? opt.t : String(v)) + mark, v, S, 'select');
        return;
      }
      var raw = v, disp = String(v);
      if (typeof v === 'number' && !Number.isInteger(v)) { raw = String(v).replace('.', ','); disp = raw; }
      OA.addRow(id, entry.label, disp + mark, raw, S, 'input');
    });

    /* Aufnahme-Panel weg, Tabelle rein, Footer umschalten */
    var rec = $('vi-rec'); if (rec) rec.style.display = 'none';
    var nx = $('vi-next'); if (nx) nx.style.display = 'none';
    var ap = $('oabi-apply'); if (ap) ap.style.display = '';
    OA.render();  /* renderMergedTable -> #oabi-result, aktiviert oabi-apply */

    var host = $('oabi-result');
    if (host && data && data.transcript) {
      var det = document.createElement('details');
      det.className = 'vi-trans';
      det.style.cssText = 'margin:10px 0 4px;font-size:12px;color:#7A7370';
      det.innerHTML = '<summary style="cursor:pointer;font-weight:600;color:#9a7f33">Transkript anzeigen</summary><p style="margin:8px 0 0;line-height:1.5;background:rgba(229,168,71,.08);border:1px solid rgba(229,168,71,.3);border-radius:8px;padding:10px">' + escH(data.transcript) + '</p>';
      host.appendChild(det);
    }
  }

  function toast(msg) {
    try { if (typeof window.toast === 'function') { window.toast(msg); return; } } catch (e) {}
    var old = $('vi-toast'); if (old) old.remove();
    var d = document.createElement('div'); d.id = 'vi-toast'; d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function () { var x = $('vi-toast'); if (x) x.remove(); }, 4500);
  }

  injectCss();
  window.VoiceImport = { srcLabel: srcLabel, open: open };
})();
