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
 *     - "Weiter \u2014 auswerten" -> Audio + Laufzeit-Feldkatalog an
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
  /* v1259 · Sprechdauer 2 -> 4 Minuten. Marcels Auftrag vom 08.09.2026.
     Die 120 s standen seit v512 als "Kostenkontrolle" da. Gemessen kostet
     die Transkription 0,003 $/Minute (gpt-4o-mini-transcribe) — zwei
     Minuten mehr sind ein halber Cent. Der teure Teil ist die Extraktion,
     und die haengt am Feldkatalog, nicht an der Laenge des Diktats.
     Das Backend-Limit liegt bei 26 MB Base64 (~10 Minuten Opus), 4 Minuten
     bleiben also weit darunter. */
  var MAX_SEC = 240;
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
  var qm = { calls: 0, max: 6, lastLen: 0, inflight: false, timer: null, kostenCent: 0 };  /* v1259: kostenCent */

  /* v1259 · Schalter fuer die Kostenanzeige. `?kosten=1` schaltet ein und
     merkt es sich, `?kosten=0` aus. Ein Kunde soll die Zahl nicht sehen —
     fuer ihn ist die Auswertung im Plan enthalten, eine Cent-Angabe wuerde
     ihn nur fragen lassen, was sie ihm abzieht. */
  function _kostenZeigen() {
    try {
      var p = new URLSearchParams(location.search).get('kosten');
      if (p === '1') { localStorage.setItem('dp_voice_kosten', '1'); return true; }
      if (p === '0') { localStorage.removeItem('dp_voice_kosten'); return false; }
      return localStorage.getItem('dp_voice_kosten') === '1';
    } catch (e) { return false; }
  }

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
    san: 'Sanierungskosten in Euro',
    /* ── v1262 · moebl ist die SUMME, nicht ein Posten ──────────────────────
       Gemessen am 08.09.2026 mit einem Testdiktat: „Die Kueche wird fuer
       8.000 Euro mitgekauft, die uebrige Moeblierung kostet 3.000 Euro."
       Die KI setzte inv_kueche=8000 UND moebl=3000 — beides fuer sich
       plausibel. Im Formular stand danach moebl=8.000.

       Der Grund liegt nicht in der Auswertung: inventar-sync.js macht
       `moebl` zur Summe der inv_*-Felder und sperrt es, sobald EIN
       Detailfeld gefuellt ist (V291, „Inventar-Detail-Box ist Single Source
       of Truth"). Der diktierte moebl-Wert wird also von der Summe
       ueberschrieben — die 3.000 Euro waren weg, und weil in `moebl` danach
       der Kuechenbetrag stand, sah es aus, als sei die Kueche falsch
       gelandet.

       Die Auswertung darf `moebl` deshalb nur noch fuellen, wenn EIN
       Gesamtbetrag ohne Einzelposten genannt wird. Der Hinweis sagt das —
       er landet ueber buildFullCatalog im Prompt. Die zweite Haelfte steht
       als Regel 14 im Backend-Prompt; ein Hinweis allein wird gern
       ueberlesen, wenn zwei Felder fast gleich heissen. */
    moebl: 'GESAMTSUMME Inventar (Kueche + Moebel + Geraete). NUR nutzen, wenn EIN Gesamtbetrag genannt wird. Werden Einzelposten genannt, stattdessen inv_kueche / inv_moebel / inv_geraete fuellen und dieses Feld WEGLASSEN',
    inv_kueche: 'Kueche als Einzelposten in Euro', inv_moebel: 'Moebel/Einrichtung als Einzelposten in Euro (ohne Kueche)',
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
    me_anz: 'Anzahl Mieterhöhungen', me_int: 'Intervall Mieterhöhung in Jahren', me_pct: 'Mieterhöhung in Prozent',
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
      '.vi-catline b{letter-spacing:.16em;font-size:15px}',   /* v1274: der Zaehler ist die Hauptzahl im Fenster */
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
      /* v1169-VFENSTER: ausgeblendet wird ueber display:none, nicht ueber
         Sichtbarkeit — ein `visibility:hidden`-Chip haelt seinen Platz und
         die Wolke bliebe genauso gross. */
      '.vi-chip.vi-aus,.vi-chip.vi-weg{display:none}',
      /* Das erkannte Wort bekommt einen kurzen Abgang, damit das Verschwinden
         als Bestaetigung gelesen wird und nicht als Fehler. */
      '.vi-chip.on{animation:viAb 2s ease forwards}',   /* v1274: so lang wie CHIP_NACHLEUCHTEN */
      '@keyframes viAb{0%,72%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-6px) scale(.94)}}',   /* v1274: 72 % von 2 s = 1,44 s voll sichtbar */
      /* v975-voice-nachzug: coolere, immer lesbare Chips */
      '.oabi-ov.vi-mode .vi-chip{position:absolute;width:auto;max-width:134px;transform:translate(-50%,-50%);background:linear-gradient(180deg,#413b32,#332e27);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 42%, transparent);border-radius:12px;padding:6px 9px;text-align:left;white-space:nowrap;font:600 10.5px/1.2 "JetBrains Mono",monospace;color:#fff;opacity:.94;box-shadow:0 4px 13px rgba(0,0,0,.2);transition:all .3s ease;z-index:2}',
      '.oabi-ov.vi-darkbg .vi-chip{background:linear-gradient(180deg,#1b1a17,#121110);border-color:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);box-shadow:0 4px 13px rgba(0,0,0,.5)}',
      '.oabi-ov.vi-mode .vi-chip .vi-ck{display:inline-block;color:#3FA56C;font-weight:700;opacity:0;margin-right:3px}',
      '.oabi-ov.vi-mode .vi-chip.on,.oabi-ov.vi-mode .vi-chip.pre{opacity:1;border-color:#2f8f5c;background:linear-gradient(180deg,#37a06a,#2f8f5c);color:#fff;box-shadow:0 6px 18px rgba(47,143,92,.45);transform:translate(-50%,-50%) scale(1.06)}',
      '.oabi-ov.vi-mode .vi-chip.on .vi-ck,.oabi-ov.vi-mode .vi-chip.pre .vi-ck{color:#fff}',
      '.oabi-ov.vi-mode .vi-chip.on .vi-ck,.oabi-ov.vi-mode .vi-chip.pre .vi-ck{opacity:1}',
      /* v1272: Auf- und Abtritt beim Weiterdrehen. Ohne sie taeuschten die
         Pillen einen Sprung vor - sie waren einfach woanders. Die Klassen
         sitzen ABSICHTLICH auf .oabi-ov.vi-mode .vi-chip.X (0,4,0): die
         Grundregel darueber ist 0,3,0 und wuerde sonst gewinnen. */
      '.oabi-ov.vi-mode .vi-chip.vi-fort{animation:viFort .28s ease forwards;pointer-events:none}',
      '.oabi-ov.vi-mode .vi-chip.vi-ein{animation:viEin .38s ease both}',
      '@keyframes viFort{to{opacity:0;transform:translate(-50%,-50%) scale(.72)}}',
      '@keyframes viEin{from{opacity:0;transform:translate(-50%,-50%) scale(.72)}to{opacity:.94;transform:translate(-50%,-50%)}}',
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
    return '<label class="qc7-src" data-src="voice" title="Objekt frei einsprechen 2014 im Plan enthalten">' +
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
      if (w.frage) entry.frage = w.frage;  /* v1259: Freitextfelder werden gefragt, nicht beschriftet */
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
  /* ── v1231 · Der Sanierungsbedarf war nie diktierbar ────────────────────
     Gemessen am 04.09.2026: von 235 Formularfeldern kennt die Auswertung 203,
     und die groesste Luecke ist EIN Block — die acht Gewerke im Reiter
     Investition, Karte „Sanierung". „Das Dach muss neu, fuenfzehntausend"
     ist genau das, was man vor Ort sagt, und es traf bis hierher nichts.

     Sie stehen bewusst NICHT in window.FIELDS: die Kachelwerte werden gar
     nicht gespeichert (im Datensatz steht nur `san`, die Summe). Der Block
     ist ein Rechner mit Richtwerten aus dem HTML — anhaken, Betrag anpassen,
     „In Sanierungskosten uebernehmen" druecken. Wer die Kacheln in FIELDS
     aufnaehme, baute einen zweiten Speicherweg fuer Werte, die keiner sein
     sollen (dieselbe Falle, vor der WM_FIELDS in storage.js warnt).

     Deshalb: nur in den AUSWERTUNGS-Katalog, nicht in die Speicherliste.
     Was danach mit der Summe passiert, entscheidet applyMerged(). */
  var SAN_GEWERKE = [
    ['f', 'Fenster'], ['e', 'Elektrik'], ['s', 'Sanitär'], ['h', 'Heizung'],
    ['d', 'Dach/Fassade'], ['b', 'Bäder'], ['k', 'Küche'], ['o', 'Sonstiges']
  ];
  function sanKatalog() {
    var out = [];
    SAN_GEWERKE.forEach(function (g) {
      out.push({ id: 'fesh_' + g[0], kind: 'bool',
                 label: 'Sanierungsbedarf ' + g[1],
                 hint: 'true, wenn ' + g[1] + ' saniert werden muss' });
      out.push({ id: 'fesh_' + g[0] + '_cost', kind: 'num',
                 label: 'Sanierungskosten ' + g[1] + ' (€)',
                 hint: 'geschaetzte Kosten fuer ' + g[1] + ', nur wenn eine Zahl genannt wird' });
    });
    return out;
  }
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
      if (el.type === 'hidden') return;
      var wl = WL_MAP[id];
      var entry = { id: id, label: wl ? wl.label : labelFor(id, el) };
      if (HINTS[id]) entry.hint = HINTS[id];
      /* v1168-VBOOL: Checkboxen waren hier ausgeschlossen — „alle Felder"
         schloss sie aber ein. Sie brauchen den ganzen Weg: 'bool' in der
         Katalog-Whitelist des Backends (sonst faellt es still auf 'text'),
         eine eigene Prompt-Zeile, eine Normalisierung, und in
         object-actions.js einen eigenen Zweig in applyMerged() — setInput()
         schreibt in .value und laesst ein Haekchen unberuehrt.
         Nur die AUSWERTUNG; die Chip-Wolke (buildCatalog) bleibt kuratiert. */
      if (el.type === 'checkbox') {
        cat.push({ id: id, kind: 'bool', label: entry.label, hint: entry.hint });
        return;
      }
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
    /* v1231: die Sanierungs-Gewerke kommen aus sanKatalog(), nicht aus FIELDS
       — und nur, wenn sie im DOM stehen. Sonst meldete der Katalog Felder,
       die es auf dieser Seite gar nicht gibt, und das Modell ordnete ins
       Leere zu. */
    sanKatalog().forEach(function (e) { if ($(e.id)) cat.push(e); });
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
        '<div class="oabi-sub">Objekt frei einsprechen \u2014 Adresse, Kaufpreis, Fl\u00e4chen, Miete und Zusatzeinnahmen, Zustand, Lage, Bodenrichtwert, Annahmen, Bewirtschaftung, Finanzierung \u2014 und was du davon h\u00e4ltst: Risiken, deine These. Freie Formulierungen werden auf die passenden Felder gebr\u00fcckt. Bis zu 4 Minuten.</div>' +
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
          '<button type="button" class="oabi-btn primary" id="vi-next">Weiter \u2014 auswerten</button>' +
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
      /* ═══ v1267 · Warnen, bevor ein GEFÜLLTES Objekt überschrieben wird ═══
         Am 08.09.2026 selbst hineingelaufen: Objekt 2026-001 war geöffnet,
         ein Sprechlauf-Test lief, und mit dem Übernehmen-Knopf wurden
         17 Felder eines fremden Datensatzes überschrieben — Adresse,
         Wohnfläche, Baujahr, Kaufpreis, Miete. Die Zeile darunter (v514)
         speichert anschliessend SOFORT und ohne Rückfrage; damit war der
         alte Stand weg, bevor irgendetwas auffiel.

         Das ist keine Ungeschicklichkeit, sondern eine Falle im Ablauf:
         Wer ein Objekt offen hat und eine Aufnahme macht, will fast immer
         DIESES Objekt ergänzen — aber eben nicht seine Stammdaten
         überschreiben. Und es gibt keinen Rückweg: die Objekt-Historie
         speichert nur Metadaten, ein Rückgängig gibt es nicht.

         Gewarnt wird NUR, wenn wirklich etwas auf dem Spiel steht: das
         Objekt trägt bereits Kerndaten UND die Übernahme würde mindestens
         eines davon ändern. Bei einem leeren Objekt — dem Normalfall nach
         „Objekt anlegen" — kommt keine Frage. */
      /* Gelesen wird die gerenderte Tabelle, nicht `_merged` — das ist
         modul-intern in object-actions.js, und die Bridge gibt es nicht
         heraus (sie kennt nur reset/setMode/addRow/render/apply). Der
         angezeigte Wert reicht: er ist genau das, was der Nutzer gleich
         übernimmt. Nur ANGEHAKTE Zeilen zählen — abgewählte ändern nichts. */
      var _kern = ['str', 'hnr', 'plz', 'ort', 'wfl', 'baujahr', 'kp', 'nkm'];
      var _kollision = [];
      try {
        var _ovT = $('oabi-ov');
        _kern.forEach(function (id) {
          var el = document.getElementById(id);
          var alt = el ? String(el.value || '').trim() : '';
          if (!alt) return;                       /* leer: nichts zu verlieren */
          var cb = _ovT && _ovT.querySelector('.oabi-tbl input[type="checkbox"][data-id="' + id + '"]');
          if (!cb || !cb.checked) return;         /* wird gar nicht übernommen */
          var zeile = cb.closest('tr');
          /* v1267b: NICHT die letzte Zelle — die traegt die Quelle
             („Sprachaufzeichnung"). Im Browser gemessen ist die Reihenfolge
             Haken · Label · WERT · Quelle(.src). Also die Zelle vor `.src`,
             mit der vorletzten als Rueckfall, falls die Klasse mal fehlt. */
          var kommt = '';
          if (zeile) {
            var srcTd = zeile.querySelector('td.src');
            var wertTd = srcTd ? srcTd.previousElementSibling : null;
            if (!wertTd) {
              var alle = zeile.querySelectorAll('td');
              wertTd = alle.length >= 2 ? alle[alle.length - 2] : null;
            }
            kommt = wertTd ? String(wertTd.textContent || '').trim() : '';
          }
          /* Ziffern vergleichen, damit „200.000" und „200000" nicht als
             Änderung durchgehen — sonst warnt es bei jeder Formatierung. */
          var nurZiffern = function (s) { return s.replace(/[^0-9a-zA-ZäöüÄÖÜß]/g, '').toLowerCase(); };
          if (kommt && nurZiffern(kommt) !== nurZiffern(alt)) {
            _kollision.push(labelFor(id) + ': ' + alt + ' → ' + kommt);
          }
        });
      } catch (e) { _kollision = []; }

      if (_kollision.length) {
        var frage = 'Dieses Objekt hat bereits Stammdaten. Die Übernahme ändert:\n\n  ' +
          _kollision.slice(0, 8).join('\n  ') +
          (_kollision.length > 8 ? '\n  … und ' + (_kollision.length - 8) + ' weitere' : '') +
          '\n\nDas lässt sich nicht rückgängig machen. Wirklich überschreiben?';
        /* confirm() blockiert und ist hier genau richtig: es geht um einen
           Datenverlust, der sonst unbemerkt bliebe. */
        if (!window.confirm(frage)) return;
      }

      OA.apply();  /* applyMerged: schreibt, schliesst, fired done */
      /* v514: nach Sprach-Uebernahme das Objekt einmal speichern (nur Objekt-Kontext) */
      if (!_qcTarget) {
        try { if (typeof window.saveObj === 'function') Promise.resolve(window.saveObj({ silent: true })); } catch (e) {}
      }
    });

    _startkarte(OA);   /* v1275: erst die Wahl, dann die Aufnahme */
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1275 · DIE WAHL BEIM ÖFFNEN — frei erzählen oder durchfragen lassen
     ═══════════════════════════════════════════════════════════════════
     Marcels Entscheidung zur Demo (design/Vorschlaege/sprechlauf-dialog-*):
     „das kann man auswaehlen ob co pilot oder frei sprechen." Das ist
     Variante C aus dem Konzept.

     Bis v1274 startete die Aufnahme sofort beim Oeffnen. Wer nicht weiss,
     was DealPilot hoeren will, stand damit vor einem laufenden Mikrofon -
     der unfreundlichste Moment der ganzen App.

     Jetzt steht davor eine Frage mit zwei Antworten:

       Ich erzaehle frei   -> alles wie bisher (Aufnahme, Orbit, Auswertung,
                              danach die Rueckfragen aus v1273)
       Frag mich durch     -> derselbe Fragen-Ablauf, nur von Anfang an und
                              ueber ALLE Bloecke statt nur ueber die Luecken

     Der geführte Weg braucht KEINE neue Maschinerie: er ist der
     Rueckfragen-Zustand aus v1273 mit `alle = true`. Deshalb gelten dort
     auch dieselben Regeln - tippen oder sprechen, „Weiss ich nicht"
     beendet eine Frage, „Fertig" springt jederzeit zur Tabelle.

     Kein Modus wird gemerkt: die Wahl faellt bei jedem Oeffnen neu. Ein
     gemerkter Modus waere genau dann falsch, wenn er am meisten stoert -
     beim naechsten Objekt, das anders liegt als das letzte. */
  function _startkarteStil() {
    if ($('vi-sk-stil')) return;
    var s = document.createElement('style');
    s.id = 'vi-sk-stil';
    s.textContent = [
      '#vi-start{padding:6px 2px 2px}',
      '.vi-sk-frage{font:600 19px/1.35 "Space Grotesk",system-ui,sans-serif;margin:0 0 4px}',
      '.vi-sk-sub{font:400 13.5px/1.5 Inter,system-ui,sans-serif;opacity:.75;margin:0 0 18px}',
      '.vi-sk-wahl{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '@media(max-width:620px){.vi-sk-wahl{grid-template-columns:1fr}}',
      '.vi-sk-btn{text-align:left;cursor:pointer;border-radius:14px;padding:16px 18px;',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 38%, transparent);',
      '  background:rgba(0,0,0,.22);color:inherit;transition:background .16s ease, box-shadow .16s ease}',
      '.vi-sk-btn:hover{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 12%, transparent);',
      '  box-shadow:0 0 0 3px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 14%, transparent)}',
      '.vi-sk-btn .t{display:block;font:700 14.5px/1.2 "Space Grotesk",system-ui,sans-serif;',
      '  color:var(--wl-c9a84c, #C9A84C);margin-bottom:6px}',
      '.vi-sk-btn .u{display:block;font:400 12.5px/1.45 Inter,system-ui,sans-serif;opacity:.72}',
      '.vi-sk-btn .z{display:block;margin-top:9px;font:600 10px/1 "JetBrains Mono",ui-monospace,monospace;',
      '  letter-spacing:.1em;text-transform:uppercase;opacity:.5}'
    ].join('');
    document.head.appendChild(s);
  }

  function _startkarte(OA) {
    _startkarteStil();
    var rec = $('vi-rec'); if (rec) rec.style.display = 'none';
    var nx = $('vi-next'); if (nx) nx.style.display = 'none';
    var body = document.querySelector('.oabi-ov.vi-mode .oabi-body');
    if (!body) { startRecording(); return; }   /* im Zweifel wie bisher */
    /* v1275b: Der Kopftext beschreibt bis hierher NUR das freie Einsprechen
       („Bis zu 4 Minuten"). Vor der Wahl waere das eine halbe Auskunft -
       also neutral, und nach der Wahl der Text, der zum Weg passt. */
    var sub = document.querySelector('.oabi-ov.vi-mode .oabi-sub');
    var subOriginal = sub ? sub.textContent : '';
    if (sub) sub.textContent = 'Zwei Wege, dasselbe Ziel: sprich frei über das Objekt, ' +
      'oder lass dich Frage für Frage durchführen.';
    var h = document.createElement('div');
    h.id = 'vi-start';
    h.innerHTML =
      '<div class="vi-sk-frage">Wie möchtest du das Objekt aufnehmen?</div>' +
      '<div class="vi-sk-sub">Beide Wege enden gleich — in der Übernahme-Tabelle, ' +
        'in der du jede Zeile noch abwählen kannst.</div>' +
      '<div class="vi-sk-wahl">' +
        '<button type="button" class="vi-sk-btn" id="vi-sk-frei">' +
          '<span class="t">Ich erzähle frei</span>' +
          '<span class="u">Sprich einfach los — Adresse, Preis, Miete, Zustand, was dir einfällt. ' +
            'Danach frage ich nach, was für die Rechnung noch fehlt.</span>' +
          '<span class="z">Bis zu 4 Minuten · schnellster Weg</span>' +
        '</button>' +
        '<button type="button" class="vi-sk-btn" id="vi-sk-fuehr">' +
          '<span class="t">Frag mich durch</span>' +
          '<span class="u">Ich frage der Reihe nach — Preis, Miete, Fläche, Adresse und den Rest. ' +
            'Antworten kannst du tippen oder sprechen.</span>' +
          '<span class="z">Frage für Frage · nichts vergessen</span>' +
        '</button>' +
      '</div>';
    body.insertBefore(h, body.firstChild);
    $('vi-sk-frei').addEventListener('click', function () {
      h.remove();
      if (sub) sub.textContent = subOriginal;   /* v1275b: wieder der Text zum freien Weg */
      if (rec) rec.style.display = '';
      if (nx) nx.style.display = '';
      startRecording();
    });
    $('vi-sk-fuehr').addEventListener('click', function () {
      h.remove();
      _gefuehrt(OA);
    });
  }

  /* Der geführte Weg: derselbe Fragen-Ablauf wie die Rückfragen, nur über
     ALLE Blöcke und ohne Aufnahme davor. */
  function _gefuehrt(OA) {
    var sub = document.querySelector('.oabi-ov.vi-mode .oabi-sub');
    if (sub) sub.textContent = 'Der Co-Pilot fragt der Reihe nach. Antworten kannst du tippen oder ' +
      'sprechen — „Weiß ich nicht" überspringt, „Fertig" bringt dich jederzeit zur Übersicht.';
    var catalog = _qcTarget ? buildCatalog() : buildFullCatalog();
    rueckfragen(OA, { transcript: '', fields: {}, unsicher: [] }, catalog, true);
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
      if (st.elapsed >= MAX_SEC) { stopRecordingKeep(); setState('stopped', '4-Minuten-Limit erreicht \u2014 jetzt auswerten'); }
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
    qm.calls = 0; qm.lastLen = 0; qm.inflight = false; qm.kostenCent = 0;  /* v1259: auch die Rechnung */
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
  /* v1259 · Zwei Gruppen dazu. Gemessen am 08.09.2026: die Liste hatte fuenf
     Eintraege, aber WL kannte laengst ein `g:5` (Nachfrage, Bevoelkerung,
     Marktmiete, Miet-/Wertsteigerung, Mietausfallwagnis). Beide Schleifen
     laufen `gi < WL_GROUPS.length` — Gruppe 5 wurde also NIE gerendert. Das
     fiel nie auf, weil alle sechs `noc:1` tragen und ohnehin nicht als Chip
     erscheinen. Meine drei neuen Frage-Pillen hatten dasselbe g:5 und waren
     damit unsichtbar: 28 Chips statt 31, im Browser gezaehlt.
     Jetzt heisst 5 'Markt' (was es immer war) und die Einschaetzung bekommt
     eine eigene Gruppe 6. */
  var WL_GROUPS = ['Stammdaten', 'Kauf & Nebenkosten', 'Miete', 'Finanzierung',
                   'Lage & Bewertung', 'Markt', 'Einschätzung'];
  var WL = [
    /* v977-voice-layout: Reihenfolge Objektart->Adresse->Flaechen; Aussenstellpl./Etage/Garagen ohne Chip; Kaufdatum/Uebergang -> Kauf */
    { id:'objart',     g:0, label:'Objektart',           kw:['eigentumswohnung','mehrfamilien','einfamilien','wohnung','haus','etw','mfh','efh','reihenhaus'] },
    { id:'str',        g:0, label:'Straße',             kw:['strasse','str'] },
    { id:'hnr',        g:0, label:'Hausnummer',          kw:['hausnummer','nummer'] },
    { id:'plz',        g:0, label:'PLZ',                 kw:['postleitzahl','plz'] },
    { id:'ort',        g:0, label:'Ort',                 kw:['ort','stadt','gemeinde'] },
    { id:'wfl',        g:0, label:'Wohnfläche',         kw:['wohnflaeche','quadratmeter','qm','quadrat'] },
    { id:'zimmer',     g:0, label:'Zimmer',              kw:['zimmer'] },
    { id:'baujahr',    g:0, label:'Baujahr',             kw:['baujahr','gebaut','errichtet'] },
    { id:'etage',      g:0, noc:1, label:'Etage',               kw:['etage','stock','geschoss','obergeschoss'] },
    { id:'stellpl_aussen', g:0, noc:1, label:'Außenstellplätze', kw:['stellplatz','aussenstellplatz','parkplatz'] },
    { id:'garagen',    g:0, noc:1, label:'Garagen',             kw:['garage','tiefgarage'] },
    { id:'kaufdat',    g:1, label:'Kaufdatum',           kw:['kaufdatum','gekauft','erworben'] },
    { id:'wirtschaftlicher_uebergang', g:1, label:'Wirtsch. Uebergang', kw:['wirtschaftlicher uebergang','nutzen lasten','nutzen und lasten','lastenwechsel','besitzuebergang','uebergang'] },

    { id:'kp',         g:1, label:'Kaufpreis',           kw:['kaufpreis','kostet','preis','kaufsumme'] },
    { id:'makler_p',   g:1, noc:1, label:'Maklerprovision %',   kw:['makler','maklerprovision','courtage'] },
    { id:'notar_p',    g:1, noc:1, label:'Notarkosten %',       kw:['notar','notarkosten'] },
    { id:'gba_p',      g:1, noc:1, label:'Grundbuch %',         kw:['grundbuch'] },
    { id:'gest_p',     g:1, noc:1, label:'Grunderwerbsteuer %', kw:['grunderwerbsteuer','grunderwerb'] },
    { id:'san',        g:1, label:'Sanierungskosten',    kw:['sanierung','sanierungskosten','renovierung'] },
    { id:'moebl',      g:1, frage:'Was wird mitverkauft?', label:'Möblierung', kw:['moeblierung','inventar','einrichtung'] },

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
    { id:'gsfl',       g:4, label:'Grundstücksfläche', kw:['grundstueck','grundstuecksflaeche'] },
    { id:'makrolage',  g:4, frage:'Wie ist die Region?',  label:'Makrolage', kw:['makrolage','makro','region'] },
    { id:'mikrolage',  g:4, frage:'Wie ist die Straße?', label:'Mikrolage', kw:['mikrolage','mikro','viertel','umfeld'] },
    { id:'ds2_zustand',g:4, frage:'In welchem Zustand?',  label:'Zustand',   kw:['zustand'] },
    { id:'ds2_energie',g:4, label:'Energieklasse',       kw:['energie','energieklasse','effizienz'] },

    { id:'ds2_nachfrage',    g:5, noc:1, label:'Nachfrage',           kw:['nachfrage'] },
    { id:'ds2_bevoelkerung', g:5, noc:1, label:'Bevölkerung',        kw:['bevoelkerung','einwohner'] },
    { id:'ds2_marktmiete',   g:5, noc:1, label:'Marktmiete',          kw:['marktmiete'] },
    { id:'mietstg',          g:5, noc:1, label:'Mietsteigerung %',    kw:['mietsteigerung'] },
    { id:'wertstg',          g:5, noc:1, label:'Wertsteigerung %',    kw:['wertsteigerung'] },
    { id:'ds2_mietausfall',  g:5, noc:1, label:'Mietausfallwagnis',   kw:['mietausfall','mietausfallwagnis'] },

    /* ── v1259 · Die drei Freitextfelder, gefragt statt beschriftet ────────
       Marcels Auftrag vom 08.09.2026: „Felder wie bekannte Risiken,
       Investitionsthese — das sind ja keine Schlagwoerter, sondern
       vielleicht Fragen: Gibt es Risiken? Welche Moeblierung wird
       mitverkauft?"

       Der Unterschied ist nicht kosmetisch. „Risiken" als Pille sagt einem
       Sprechenden nicht, was er tun soll — „Gibt es Risiken?" schon. Bei
       Zahlenfeldern bleibt es beim Schlagwort: „Kaufpreis" ist als Pille
       kuerzer und genauso klar wie „Was kostet es?".

       Diese drei standen bisher in KEINEM Chip. Ausgewertet wurden sie
       schon (der volle Katalog aus v519 kennt sie), aber niemand wurde
       aufgefordert, sie zu sagen — deshalb blieben sie fast immer leer. */
    { id:'thesis',  g:6, frage:'Warum dieses Objekt?', label:'Investment-These',
      kw:['these','investmentthese','strategie','warum'] },
    { id:'risiken', g:6, frage:'Gibt es Risiken?',     label:'Risiken',
      kw:['risiko','risiken','gefahr','problem','schwachstelle'] },
    { id:'notizen', g:6, frage:'Sonst noch etwas?',    label:'Notizen',
      kw:['notiz','anmerkung','bemerkung','uebrigens'] }
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
    moebl:'Was wird mitverkauft? Kueche, Moebel, Geraete — Wert in Euro',
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
    ze_sonst:'Sonstige Zusatzeinnahmen pro Monat',
    /* v1259 — bei den Frage-Pillen erklaert der Tooltip, WAS gemeint ist */
    thesis:'Warum lohnt sich dieses Objekt? Deine Investment-These in einem Satz',
    risiken:'Was koennte schiefgehen? Sanierungsstau, Mieter, Lage, Recht …',
    notizen:'Alles, was sonst noch wichtig ist und kein eigenes Feld hat'
  };
  /* QC-Einzelposten (virtuell) — Gruppe Miete */
  var WL_VIRT = [
    { id:'ze_stp',    g:2, label:'Stellplatzmiete', kw:['stellplatz','garage','parkplatz','tiefgarage'] },
    { id:'ze_kueche', g:2, label:'Küchenmiete',    kw:['kueche','kuche'] },
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
    _slots = [];  /* v1259: Plaetze fuer den neuen Aufbau leeren */
    /* v1272: Standzeiten und Endauswertungs-Merker gehoeren dazu - sonst
       traegt der zweite Sprechlauf die Uhren des ersten. */
    _bis = []; _final = 0;
    if (_tick) { clearTimeout(_tick); _tick = null; }
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
        /* v1259: Fragen gewinnen. `split('(')` darf hier nicht laufen \u2014 eine
           Frage traegt keine Klammer, ein Label wie \u201eZinsbindung (J.)" schon.
           Und Fragen duerfen ein paar Zeichen laenger sein: "Was wird
           mitverkauft?" hat 21, die alte Grenze haette es angeschnitten. */
        var short = e.frage ? e.frage.trim() : (e.label || e.id).split('(')[0].trim();
        var grenze = e.frage ? 26 : 22;
        if (short.length > grenze) short = short.slice(0, grenze - 1) + '\u2026';
        return '<span class="vi-chip" data-cid="' + escH(e.id) + '" data-g="' + gi + '" title="' + escH(EXPLAIN[e.id] || e.label || e.id) + '"><span class="vi-ck">\u2713</span>' + escH(short) + '</span>';
      }).join('');
    }
    host.innerHTML = html;
    var nk = $('vi-nkhint');
    if (nk) nk.textContent = _qcTarget ? '' : 'Kaufnebenkosten (Makler/Notar/Grundbuch/Grunderwerbsteuer) werden automatisch gef\u00fcllt, wenn du sie nennst.';
    updateChipsCount();
    chipOrbit();   /* v1259 */
  }
  /* ═══ v1169-VFENSTER · Immer nur ein Fenster von Stichwoertern ══════════
     Bisher standen ALLE Chips gleichzeitig da (je nach Modus 30+). Wer
     spricht, sucht darin sein naechstes Stichwort — die Wolke wurde mit
     jedem erkannten Feld nur bunter, nicht kuerzer.

     Jetzt: hoechstens FENSTER Stichwoerter sichtbar. Ein erkanntes bleibt
     noch kurz gruen stehen (damit man die Bestaetigung SIEHT), verschwindet
     dann, und von hinten rueckt eins nach.

     Bewusst nur die SICHTBARKEIT: alle Chips bleiben im DOM. updateChipsFromText,
     markChipsFinal und die Gruppen-Navigation suchen per Selektor
     `.vi-chip[data-cid=...]` — wer hier Elemente entfernt, bricht drei
     Stellen still. Und der Fortschrittszaehler zaehlt weiter ALLE, nicht die
     sichtbaren; sonst staende dort dauernd „9". */
  /* v1274 · Marcels Vorgabe vom 09.09.2026: „die sachen die gesagt wurden
     sollen gruen werden und nach 2 sekunden dann verschwinden."
     Vorher 900 ms. Das war die Zeit einer Bestaetigung, die man sieht, wenn
     man hinsieht - nicht die Zeit einer Bestaetigung, die man BEMERKT,
     waehrend man spricht und woandershin schaut. */
  var CHIP_NACHLEUCHTEN = 2000;   /* ms, in denen das erkannte Wort gruen stehen bleibt */

  /* ═══ v1259 · EIN Orbit, keine Etappen ═════════════════════════════════
     Marcels Auftrag vom 08.09.2026: „Toll waere, wenn wir einfach die
     Sprachaufzeichnung haben und um dem Sprechsymbol erscheinen einfach
     Punkte, die wir noch nicht gesagt haben, und die, die gruen sind, die
     verschwinden dann einfach automatisch."

     WAS WEG IST: die fuenf Kategorien. Bis v1258 zeigte der Orbit immer nur
     EINE Gruppe (refreshGroupProgress blendete alle anderen per
     style.display aus) und sprang weiter, sobald sie voll war. Wer beim
     Sprechen den Kaufpreis nachschob, waehrend der Orbit schon bei
     „Finanzierung" stand, sah seine Bestaetigung nicht — sie lag in einer
     ausgeblendeten Gruppe.

     WAS BLEIBT: das Fenster. Nicht 35 Pillen gleichzeitig, sondern SLOT_N
     Plaetze. Neu daran ist, dass es PLAETZE sind und keine Positionen:
     jeder Platz hat eine feste Koordinate, ein Chip belegt ihn, und erst
     wenn es gruen war und verschwindet, rueckt das naechste GENAU DORT
     nach. Wuerde ich stattdessen bei jedem Nachruecken neu im Kreis
     verteilen, huepfte bei jedem erkannten Wort die ganze Wolke.

     Reihenfolge = DOM-Reihenfolge = die WL-Liste, also weiterhin
     Stammdaten zuerst. Die Gruppen leben in WL weiter (die Auswertungs-
     Karten am Ende nutzen sie), sie steuern nur die Anzeige nicht mehr.

     Alle Chips bleiben im DOM — updateChipsFromText, markChipsFinal und
     markChipsByIds suchen per `.vi-chip[data-cid=...]`. Wer hier Elemente
     entfernt, bricht drei Stellen still. */
  var SLOT_N = 8;
  var _slots = [];   /* Platz-Index -> Chip-id ('' = frei) */

  /* ═══ v1272 · Der Orbit wartet nicht mehr auf eine Antwort ══════════════
     Marcels Punkt 3: "Pillen unterschiedlich lang einblenden - nicht jeder
     Punkt wird gesagt, der Orbit darf nicht auf eine Antwort warten."

     Bis v1271 wurde ein Platz NUR frei, wenn sein Stichwort erkannt wurde.
     Wer ueber Denkmalschutz nichts sagt, bekam die Pille bis zum Ende der
     Aufnahme angezeigt - und die restlichen rund 27 Stichwoerter dahinter
     nie zu sehen. Der Kranz stand still und wartete auf etwas, das nie kam.

     Jetzt hat jeder Platz eine STANDZEIT. Laeuft sie ab und wartet noch
     etwas, rueckt das naechste nach; das Verdraengte geht ans Ende der
     Schlange und kommt spaeter wieder. So dreht der Kranz einmal durch
     alles, was noch offen ist.

     Die Standzeiten sind BEWUSST verschieden (6,5 s + 0,8 s je Platz + bis
     1,5 s Streuung, also rund 6,5 bis 15 s): waeren sie gleich, wechselte
     der ganze Kranz im Gleichtakt und das Auge haette nichts mehr, woran es
     sich festhaelt. Genau das meint "unterschiedlich lang".

     Drei Dinge bleiben, wie sie waren:
     - Gedreht wird NUR waehrend der Aufnahme (nicht pausiert, nicht
       gestoppt) und nur, wenn ueberhaupt jemand wartet. Ein Kranz, in dem
       alles Platz hat, steht still.
     - Erkanntes leuchtet gruen nach und verschwindet dann (v1259).
     - Alle Chips bleiben im DOM; nur die Sichtbarkeit wandert. */
  var STAND_MIN = 6500, STAND_STUFE = 800, STAND_STREU = 1500, ROT_ABGANG = 280;
  var _bis = [];      /* Platz-Index -> Zeitpunkt, ab dem der Platz raeumen darf */
  var _tick = null;   /* Uhr, die den Ablauf prueft */
  var _final = 0;     /* 1 ab der Endauswertung: dann nicht mehr drehen */

  function _standzeit(i) {
    return STAND_MIN + i * STAND_STUFE + Math.round(Math.random() * STAND_STREU);
  }

  function _laeuft() { return !!(st.running && !st.paused && !st.stopped); }

  function _tickPlan(wartende) {
    if (_tick) { clearTimeout(_tick); _tick = null; }
    if (_final || !wartende || !_laeuft() || !$('vi-chips')) return;
    _tick = setTimeout(chipOrbit, 600);
  }

  function _slotPos(i, n) {
    var R = 168, ang = (-90 + i * 360 / n) * Math.PI / 180;
    return { l: 'calc(50% + ' + Math.round(R * Math.cos(ang)) + 'px)',
             t: 'calc(50% + ' + Math.round(R * Math.sin(ang)) + 'px)' };
  }

  function chipOrbit() {
    if (_tick) { clearTimeout(_tick); _tick = null; }
    var host = $('vi-chips'); if (!host) return;
    var chips = Array.prototype.slice.call(host.querySelectorAll('.vi-chip'));
    if (!chips.length) return;
    var jetzt = Date.now();
    var byId = {};
    chips.forEach(function (c) { byId[c.getAttribute('data-cid')] = c; });

    /* 1) Erkannt: kurz gruen stehen lassen, dann raeumen. _weg verhindert,
          dass bei jedem Neuaufruf ein zweiter Timer auf dasselbe Chip laeuft. */
    chips.forEach(function (c) {
      if (!c.classList.contains('on') || c._weg) return;
      c._weg = 1;
      setTimeout(function () { c.classList.add('vi-weg'); chipOrbit(); }, CHIP_NACHLEUCHTEN);
    });

    var platz = {};
    _slots.forEach(function (id, i) { if (id) platz[id] = i; });

    /* 1b) v1272: erkannt, aber gerade nicht im Kranz -> Platz verschaffen.
           Sonst bliebe die Bestaetigung unsichtbar, und genau die ist der
           Sinn der Sache. In der Endauswertung nicht: dort kommen 17 auf
           einmal, das waere ein Flackern statt einer Rueckmeldung. */
    if (!_final) {
      chips.forEach(function (c) {
        var id = c.getAttribute('data-cid');
        if (!c.classList.contains('on') || c.classList.contains('vi-weg') || platz[id] !== undefined) return;
        var j = -1, aelt = Infinity;
        for (var q = 0; q < SLOT_N; q++) {
          if (!_slots[q]) { j = q; break; }
          var cq = byId[_slots[q]];
          if (cq && cq.classList.contains('on')) continue;   /* andere Bestaetigung nicht verdraengen */
          if ((_bis[q] || 0) < aelt) { aelt = _bis[q] || 0; j = q; }
        }
        if (j < 0) return;
        if (_slots[j]) {
          var alt = byId[_slots[j]];
          if (alt) { alt.classList.add('vi-aus'); alt.classList.remove('vi-ein'); alt._zuletzt = jetzt; }
          delete platz[_slots[j]];
        }
        _slots[j] = id; _bis[j] = jetzt + CHIP_NACHLEUCHTEN + 400; platz[id] = j;
      });
    }

    /* 2) Plaetze freigeben, deren Chip abgeraeumt ist */
    for (var i = 0; i < SLOT_N; i++) {
      var c0 = _slots[i] ? byId[_slots[i]] : null;
      if (!c0 || c0.classList.contains('vi-weg')) {
        if (_slots[i]) delete platz[_slots[i]];
        _slots[i] = ''; _bis[i] = 0;
      }
    }

    /* 3) Wer wartet? Alles, was offen ist und gerade keinen Platz hat. */
    var wartend = chips.filter(function (c) {
      return platz[c.getAttribute('data-cid')] === undefined &&
             !c.classList.contains('vi-weg') && !c.classList.contains('on') && !c._fort;
    });

    /* 3b) v1272: abgelaufene Plaetze weiterdrehen - aber nur, wenn jemand
           wartet. Ohne Wartende waere das Ausblenden ein reiner Verlust. */
    if (!_final && _laeuft() && wartend.length) {
      for (var r = 0; r < SLOT_N; r++) {
        if (!_slots[r] || !_bis[r] || _bis[r] > jetzt) continue;
        var cr = byId[_slots[r]];
        if (!cr || cr.classList.contains('on') || cr._fort) continue;
        _bis[r] = jetzt + 60000;   /* nicht ein zweites Mal ausloesen */
        (function (chip, idx) {
          chip._fort = 1;
          chip.classList.add('vi-fort');
          setTimeout(function () {
            chip._fort = 0;
            chip.classList.remove('vi-fort');
            chip.classList.remove('vi-ein');
            chip.classList.add('vi-aus');
            chip._zuletzt = Date.now();
            if (_slots[idx] === chip.getAttribute('data-cid')) { _slots[idx] = ''; _bis[idx] = 0; }
            chipOrbit();
          }, ROT_ABGANG);
        })(cr, r);
      }
    }

    /* 4) Freie Plaetze nachbesetzen. Wer schon steht, BLEIBT stehen.
          Reihenfolge: wer noch nie dran war zuerst, dann der am laengsten
          Verdraengte - so dreht der Kranz durch ALLE offenen Angaben, statt
          zwischen denselben zwei zu pendeln. */
    wartend.sort(function (a, b) { return (a._zuletzt || 0) - (b._zuletzt || 0); });
    var neu = 0;
    for (var k = 0; k < SLOT_N && wartend.length; k++) {
      if (_slots[k]) continue;
      var c1 = wartend.shift();
      var id1 = c1.getAttribute('data-cid');
      _slots[k] = id1; _bis[k] = jetzt + _standzeit(k); platz[id1] = k;
      var p1 = _slotPos(k, SLOT_N);
      c1.style.left = p1.l; c1.style.top = p1.t;
      c1.classList.remove('vi-aus'); c1.classList.remove('vi-fort');
      /* Auftritt neu anstossen: Klasse weg, Reflow, Klasse hin. */
      c1.classList.remove('vi-ein');
      void c1.offsetWidth;
      c1.style.animationDelay = (neu * 70) + 'ms';
      c1.classList.add('vi-ein');
      neu++;
    }

    /* 5) Anzeigen - nur wer einen Platz hat, und zwar auf seinem Platz.
          Sichtbarkeit ueber die Klasse, nicht ueber style.display: bis v1258
          setzte refreshGroupProgress hier inline, und ein inline 'none'
          schlaegt jede spaetere CSS-Regel. */
    chips.forEach(function (c) {
      var idx = platz[c.getAttribute('data-cid')];
      if (idx === undefined) { c.classList.add('vi-aus'); return; }
      c.classList.remove('vi-aus');
      var p = _slotPos(idx, SLOT_N);
      c.style.left = p.l; c.style.top = p.t;
    });

    /* 6) v1274b: beide Zähler aus EINER Funktion — siehe _zaehlerZeichnen. */
    _zaehlerZeichnen();

    /* 7) v1272: Uhr weiterstellen, solange gesprochen wird und jemand wartet. */
    _tickPlan(wartend.length > 0);
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
    chipOrbit();   /* v1259 */
  }
  function markChipsFinal(fields) {
    /* v1272: ab hier nicht mehr drehen - die Auswertung markiert alle Felder
       auf einmal, ein rotierender Kranz waere dabei nur Unruhe. */
    _final = 1;
    if (_tick) { clearTimeout(_tick); _tick = null; }
    var host = $('vi-chips'); if (!host) return;
    Object.keys(fields || {}).forEach(function (id) {
      var chip = host.querySelector('.vi-chip[data-cid="' + id + '"]');
      if (chip) chip.classList.add('on');
    });
    updateChipsCount();
    chipOrbit();   /* v1259 */
  }
  /* ═══ v1274b · EINE Zahl, eine Quelle ═══════════════════════════════
     Im Fenster standen zwei Zaehler mit zwei Rechenwegen: die Kopfzeile
     ueber dem Orbit (aus chipOrbit) und die Leiste darunter (aus
     updateChipsCount). Gemessen am 09.09.2026 zeigten sie gleichzeitig
     „10 VON 31" und „5 / 31 Felder" - dieselbe Sache, zwei Zahlen.

     Zwei Zaehler koennen nur so lange stimmen, wie beide bei jeder
     Aenderung laufen. Einer davon lief nicht. Jetzt zaehlt eine Funktion,
     und beide Anzeigen lesen von ihr. */
  function _zaehlerZeichnen() {
    var host = $('vi-chips'); if (!host) return;
    var tot = host.querySelectorAll('.vi-chip').length;
    var on  = host.querySelectorAll('.vi-chip.on,.vi-chip.pre').length;
    var offen = tot - on;

    /* Kopfzeile ueber dem Orbit - der Blick WAEHREND des Sprechens.
       Marcels Vorgabe: „ein Zaehler mit maximal anzahl und wieviel wir
       schon haben". Bis v1273 stand hier die Gegenrichtung („NOCH OFFEN"),
       die sagt nicht, wie weit man ist, sondern wie weit man noch nicht
       ist. Wer spricht, will das Wachsen sehen. */
    var cl = $('vi-catline');
    if (cl) {
      cl.innerHTML = (tot > 0 && on >= tot)
        ? '<b>ALLES ERKANNT</b><span class="vi-catsub">' + tot + ' von ' + tot + '</span>'
        : '<b>' + on + ' VON ' + tot + '</b><span class="vi-catsub">Angaben erkannt · noch ' +
          offen + ' offen</span>';
    }

    /* Leiste darunter - der Blick DANACH. */
    var c = $('vi-chips-count'); if (c) c.innerHTML = '<b>' + on + '</b> / ' + tot + ' Felder';
    var pct = tot ? Math.round(on / tot * 100) : 0;
    var fill = $('vi-fill'); if (fill) fill.style.width = pct + '%';
    var pc = $('vi-prog-pct'); if (pc) pc.textContent = pct + ' %';
    var lt = $('vi-listen-txt'); if (lt) lt.textContent = (tot && on >= tot) ? 'Alle Felder erkannt' : 'Hört zu';
  }

    function updateChipsCount() {
    _zaehlerZeichnen();   /* v1274b */
    chipOrbit();   /* v1259 */
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
      .then(function (d) {
        markChipsByIds((d && d.ids) || []);
        /* v1259: die Live-Hilfe laeuft bis zu sechsmal je Aufnahme und kostet
           jedes Mal — ohne sie zaehlte die Rechnung nur die Haelfte. */
        try { if (d && d.kosten && d.kosten.eur_cent) qm.kostenCent += d.kosten.eur_cent; } catch (e) {}
      })
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
    chipOrbit();   /* v1259 */
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
        toast('Aufnahme zu kurz \u2014 keine Auswertung');
        if (nx) { nx.disabled = false; nx.textContent = 'Weiter \u2014 auswerten'; }
        return;
      }
      return blobToB64(blob)
        .then(function (b64) { return post(b64, blob.type || st.mime, catalog); })
        .then(function (data) {
          try { console.log('[voice-import] Transkript:', data && data.transcript); } catch (e) {}
          rueckfragen(OA, data, catalog);   /* v1273: erst nachfragen, dann Tabelle */
        });
    }).catch(function (err) {
      if (err && err.needs_credits) {
        toast('Spracheingabe gerade nicht verf00fcgbar');
        try { if (typeof window.showSettings === 'function') window.showSettings('plan'); } catch (e) {}
      } else {
        toast('Sprachauswertung fehlgeschlagen: ' + ((err && err.message) || err));
      }
      if (nx) { nx.disabled = false; nx.textContent = 'Weiter \u2014 auswerten'; }
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
  /* ═══════════════════════════════════════════════════════════════════
     v1276 · FREISPRECHEN — das Mikrofon bleibt an
     ═══════════════════════════════════════════════════════════════════
     Marcels Befund nach dem ersten Durchlauf: „Man muss jedes Mal auf
     Sprechen klicken und dann fragt er wieder nach. Das wäre irgendwie
     toll, wenn man das einfach bestehen lässt und dann die Frage
     automatisch weitergeht."

     Er hat recht: ein Gespräch, in dem man vor jeder Antwort einen Knopf
     drückt, ist kein Gespräch. Es ist ein Formular mit Umweg.

     Jetzt läuft das Mikrofon durch. Je Frage wird ein Abschnitt
     aufgenommen; das Ende erkennt eine Pegelmessung, kein Klick:

       1. Grundrauschen messen (die ersten 500 ms nach der Frage).
          Schwelle = Rauschen x 2,5, mindestens 0,012. Eine feste Schwelle
          taugt nicht - ein Laptoplüfter ist lauter als ein stiller Raum.
       2. Warten, bis jemand SPRICHT (Pegel über Schwelle, 180 ms lang).
       3. Danach warten, bis er FERTIG ist (Pegel unter Schwelle,
          1400 ms lang). Kürzer wäre falsch: zwischen „vierhundert" und
          „neunzig" liegt eine Pause.
       4. Abschnitt auswerten, Ergebnis zeigen, nächste Frage - von selbst.

     WARUM setInterval UND NICHT requestAnimationFrame: rAF steht still,
     sobald der Tab in den Hintergrund geht. Wer beim Sprechen kurz ins
     Exposé schaut, würde sonst mitten im Satz nicht mehr gehört.

     WER LIEBER TIPPT, tippt: das Eingabefeld bleibt, und sobald jemand
     hineinschreibt, hört die Automatik für diese Frage auf zu lauschen.
     Der Schalter oben rechts hält sie ganz an.

     EIN Stream, EIN MediaRecorder für den ganzen Dialog - nicht je Frage
     neu. Jede getUserMedia-Anfrage ist eine Zäsur (Berechtigung, Anlauf,
     verlorene erste Silbe). */
  var _fs = {
    an: true,        /* Freisprechen eingeschaltet? */
    stream: null, ctx: null, analyser: null, daten: null,
    rec: null, chunks: [], uhr: null,
    phase: '',       /* 'ruhe' | 'rauschen' | 'warte' | 'spricht' | 'aus' */
    rausch: 0, schwelle: 0.012, t0: 0, tSprach: 0, tStill: 0, aufnahme: false
  };
  var FS_MIN_SCHWELLE = 0.012, FS_SPRACHE_MS = 180, FS_STILLE_MS = 1400,
      FS_RAUSCH_MS = 500, FS_GEDULD_MS = 30000, FS_MAX_MS = 25000;

  function _fsPegel() {
    if (!_fs.analyser || !_fs.daten) return 0;
    _fs.analyser.getByteTimeDomainData(_fs.daten);
    var summe = 0;
    for (var i = 0; i < _fs.daten.length; i++) {
      var v = (_fs.daten[i] - 128) / 128;
      summe += v * v;
    }
    return Math.sqrt(summe / _fs.daten.length);
  }

  function _fsAus() {
    try { if (_fs.uhr) { clearInterval(_fs.uhr); _fs.uhr = null; } } catch (e) {}
    try { if (_fs.rec && _fs.rec.state === 'recording') { _fs.rec.onstop = null; _fs.rec.stop(); } } catch (e) {}
    try { (_fs.stream ? _fs.stream.getTracks() : []).forEach(function (t) { t.stop(); }); } catch (e) {}
    try { if (_fs.ctx && _fs.ctx.state !== 'closed') _fs.ctx.close(); } catch (e) {}
    _fs.stream = null; _fs.ctx = null; _fs.analyser = null; _fs.rec = null;
    _fs.phase = 'aus'; _fs.aufnahme = false;
  }

  /* Einmal öffnen, für den ganzen Dialog. */
  function _fsStart() {
    if (!_fs.an) return Promise.resolve(false);
    if (_fs.stream) return Promise.resolve(true);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      return Promise.resolve(false);
    }
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      _fs.stream = stream;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        _fs.ctx = new AC();
        var src = _fs.ctx.createMediaStreamSource(stream);
        _fs.analyser = _fs.ctx.createAnalyser();
        _fs.analyser.fftSize = 1024;
        _fs.daten = new Uint8Array(_fs.analyser.fftSize);
        src.connect(_fs.analyser);
      } catch (e) { _fs.analyser = null; }
      var mime = (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
        ? 'audio/webm;codecs=opus'
        : ((MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm')) ? 'audio/webm' : '');
      _fs.rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      _fs.rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) _fs.chunks.push(ev.data); };
      return true;
    }).catch(function () { return false; });
  }

  /* Für EINE Frage zuhören. Endet von selbst - durch Stille oder Geduld. */
  function _fsHoeren() {
    if (!_fs.an || !_fs.stream || !_fs.rec) return;
    if (_fs.uhr) { clearInterval(_fs.uhr); _fs.uhr = null; }
    _fs.chunks = [];
    _fs.phase = 'rauschen'; _fs.rausch = 0; _fs.t0 = Date.now();
    _fs.tSprach = 0; _fs.tStill = 0;
    var proben = 0, summe = 0;
    try { if (_fs.rec.state === 'inactive') { _fs.rec.start(); _fs.aufnahme = true; } } catch (e) { return; }
    _fsMikroKasten(true, 'Ich höre zu — sprich einfach los.', 'Ich merke selbst, wenn du fertig bist.');

    _fs.uhr = setInterval(function () {
      if (!_rf || !_fs.an) { return; }
      var p = _fsPegel(), jetzt = Date.now(), seit = jetzt - _fs.t0;
      _fsPegelZeigen(p);   /* v1277: der Ausschlag beantwortet "hoert er mich?" */

      if (_fs.phase === 'rauschen') {
        summe += p; proben++;
        if (seit >= FS_RAUSCH_MS) {
          _fs.rausch = proben ? summe / proben : 0;
          _fs.schwelle = Math.max(FS_MIN_SCHWELLE, _fs.rausch * 2.5);
          _fs.phase = 'warte';
        }
        return;
      }

      if (_fs.phase === 'warte') {
        if (p > _fs.schwelle) {
          if (!_fs.tSprach) _fs.tSprach = jetzt;
          if (jetzt - _fs.tSprach >= FS_SPRACHE_MS) { _fs.phase = 'spricht'; _fs.tStill = 0;
            _fsMikroKasten(true, 'Ich höre dich …', 'Sprich zu Ende — ich warte auf die Pause.'); }
        } else { _fs.tSprach = 0; }
        /* Geduld: wer nicht spricht, wird nicht gedrängt - aber irgendwann
           soll der Hinweis kommen, dass Tippen auch geht. */
        if (seit > FS_GEDULD_MS) {
          _fsHinweis('Ich höre nichts — du kannst auch tippen.');
          _fs.t0 = jetzt;   /* Uhr zurückstellen, weiter lauschen */
        }
        return;
      }

      if (_fs.phase === 'spricht') {
        if (p <= _fs.schwelle) {
          if (!_fs.tStill) _fs.tStill = jetzt;
          if (jetzt - _fs.tStill >= FS_STILLE_MS) { _fsAbschnittFertig(); return; }
        } else { _fs.tStill = 0; }
        /* Notbremse: eine Antwort auf eine gezielte Frage ist kurz. */
        if (jetzt - _fs.t0 > FS_MAX_MS) { _fsAbschnittFertig(); }
      }
    }, 80);
  }

  function _fsStopHoeren() {
    if (_fs.uhr) { clearInterval(_fs.uhr); _fs.uhr = null; }
    _fs.phase = '';
    try { if (_fs.rec && _fs.rec.state === 'recording') { _fs.rec.onstop = null; _fs.rec.stop(); _fs.aufnahme = false; } } catch (e) {}
  }

  function _fsAbschnittFertig() {
    if (_fs.uhr) { clearInterval(_fs.uhr); _fs.uhr = null; }
    _fs.phase = '';
    if (!_fs.rec || _fs.rec.state !== 'recording') return;
    var eintrag = _rf && _rf.offen[_rf.i];
    _fs.rec.onstop = function () {
      _fs.aufnahme = false;
      var blob = new Blob(_fs.chunks, { type: _fs.rec.mimeType || 'audio/webm' });
      _fs.chunks = [];
      if (!_rf || !eintrag || _rf.offen[_rf.i] !== eintrag) return;   /* Frage inzwischen weiter */
      /* v1276c: Ein Fehlversuch gehoert in den VERLAUF, nicht in die
         Lauschzeile - die wird von der naechsten Runde sofort
         ueberschrieben. Eine Antwort, die spurlos verschwindet, laesst
         einen ratlos zurueck: hat er mich gehoert oder nicht? */
      if (!blob || blob.size < 1500) {
        _rfBlase('co', 'Das war zu kurz — sag es gern nochmal.');
        _fsHoeren(); return;
      }
      _rfMelden('', true);
      blobToB64(blob).then(function (b64) {
        return Auth.apiCall('/ai/extract-voice', {
          method: 'POST',
          body: { audio: b64, mime: blob.type, catalog: _rfKatalog(eintrag, _rf.catalog), kontext: _rfKontext() }
        });
      }).then(function (r) {
        if (!_rf || _rf.offen[_rf.i] !== eintrag) return;
        if (r && r.transcript) {
          try { console.log('[voice-import] Freisprech-Antwort:', r.transcript); } catch (x) {}
          _rfDenkt(false);
          /* v1283: Verneinung, Profil-Ja und Frage werden auch GESPROCHEN
             erkannt - und zwar hier, nachdem das Transkript da ist. Die
             Extraktion lief zwar schon mit, aber ihr Ergebnis wird dann
             verworfen: „haben wir nicht" darf keine Zahl erzeugen. */
          if (_rfVorabErkennen(r.transcript, true)) return;
          _rfBlase('ich', escH(r.transcript));   /* v1276c: was verstanden wurde, steht da */
        }
        _rfUebernehmen(r && r.fields, true);
      }).catch(function (err) {
        _rfDenkt(false);
        _rfBlase('co', escH((err && err.message) || 'Das habe ich nicht verstanden — nochmal, oder tippe es.'));
        _fsHoeren();
      });
    };
    try { _fs.rec.stop(); } catch (e) {}
  }

  /* Was verstanden wurde, sichtbar machen - eine Antwort, die stumm
     verschwindet, lässt einen ratlos zurück. */
  function _fsGesagt(text) {
    var e = $('vi-rf-gesagt');
    if (e) e.textContent = '„' + String(text).slice(0, 160) + '"';
  }
  /* v1277 · Der Pegel, der sich bewegt.
     „Hoert er mich?" ist die einzige Frage, die ein Sprecher wirklich hat.
     Ein Ausschlag beantwortet sie ohne ein Wort - deutlicher als jeder
     Hinweistext, den man beim Sprechen ohnehin nicht liest.
     Acht Balken, in der Mitte am hoechsten, wie es ein Pegel eben tut. */
  function _fsPegelZeigen(p) {
    var host = $('vi-rf-pegel'); if (!host) return;
    var balken = host.children, n = balken.length;
    var voll = Math.max(0, Math.min(1, p / Math.max(0.06, _fs.schwelle * 6)));
    for (var i = 0; i < n; i++) {
      var mitte = 1 - Math.abs((i - (n - 1) / 2)) / ((n - 1) / 2);   /* 0 aussen, 1 mittig */
      var h = 3 + Math.round(voll * (5 + mitte * 18));
      balken[i].style.height = h + 'px';
      balken[i].style.opacity = (0.3 + voll * 0.7).toFixed(2);
    }
    var kasten = $('vi-rf-mikro');
    if (kasten) kasten.classList.toggle('hoert', p > _fs.schwelle);
  }

  function _fsMikroKasten(an, text, unter) {
    var k = $('vi-rf-mikro');
    if (k) k.classList.toggle('taub', !an);
    if (text) _fsHinweis(text);
    var s = $('vi-rf-mikro-sub');
    if (s && unter !== undefined) s.textContent = unter;
  }

  function _fsHinweis(text) {
    var e = $('vi-rf-lausch');
    if (e) e.textContent = text;
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1276 · DER DIALOG — Chat-Verlauf, Freisprechen, alle Felder
     ═══════════════════════════════════════════════════════════════════
     Marcels drei Befunde nach dem ersten Durchlauf:

     1. „Man muss jedes Mal auf Sprechen klicken." Ein Gespräch, in dem man
        vor jeder Antwort einen Knopf drückt, ist kein Gespräch - es ist
        ein Formular mit Umweg. Das Mikrofon bleibt jetzt an; das Ende
        einer Antwort erkennt eine Pegelmessung, kein Klick.
     2. „Kannst du Variante A umsetzen aus der Demo." Die Demo zeigte einen
        CHAT-Verlauf mit Blasen, die Umsetzung war eine Fragekarte, die
        sich selbst überschreibt. Jetzt bleibt stehen, was gesagt wurde -
        beim Freisprechen ist genau das der Beweis, dass richtig verstanden
        wurde.
     3. „Wir haben irgendwie auch nur acht Felder drin." Stimmt. Jetzt
        18 Blöcke über alle 31 Katalogfelder (siehe RFRAGEN).

     Der Ablauf ist in beiden Wegen derselbe: nach dem freien Diktat als
     Lückenfüller (höchstens drei Fragen, nach `rang` sortiert), im
  /* ═══ v1280 · Weniger Fragen, mehr Zusammenhang ════════════════════════
     Marcels Wunsch: „ich würde mir wünschen, dass dieser Co-Pilot, der die
     Fragen stellt, ein paar mehr Sachen zusammennimmt … zum Beispiel Zins,
     Tilgung, also wie sind die Finanzierungskonditionen."

     Aus 18 Blöcken werden 13: Finanzierung ist EINE Frage (Eigenkapital,
     Zins, Tilgung, Zinsbindung), Grundstück ist EINE Frage, Lage und
     Zustand rücken zusammen.

     ZWEI ORDNUNGEN, ein Grund: der geführte Weg fragt in der Reihenfolge,
     in der ein Mensch von einem Objekt erzählt. Die Rückfragen nach einem
     freien Diktat sortieren nach `rang` — dort zählt das Gewicht für die
     Rechnung, weil nur drei Fragen gestellt werden.

     `profil` markiert die Blöcke, für die es in den Einstellungen
     hinterlegte Werte gibt. Dort bietet der Co-Pilot sie an, statt sie
     stillschweigend zu nehmen — siehe _rfProfilVorschlag. */
  var RFRAGEN = [
    { ids: ['objart'],                       rang: 9,  frage: 'Was für ein Objekt ist es — Eigentumswohnung, Haus, Mehrfamilienhaus?' },
    { ids: ['plz', 'ort', 'str', 'hnr'],     rang: 5,  frage: 'Wo steht das Objekt? Straße, Hausnummer, PLZ und Ort.' },
    { ids: ['wfl', 'zimmer'],                rang: 3,  frage: 'Wie groß ist es? Wohnfläche und Zimmerzahl.' },
    { ids: ['baujahr'],                      rang: 4,  frage: 'Aus welchem Jahr stammt das Gebäude?' },
    { ids: ['kp'],                           rang: 1,  frage: 'Was soll das Objekt kosten?' },
    { ids: ['san', 'moebl'],                 rang: 11, frage: 'Muss etwas saniert werden, und wird etwas mitverkauft — Küche, Möbel?' },
    { ids: ['nkm', 'ze'],                    rang: 2,  frage: 'Was kommt monatlich rein? Kaltmiete und Zusatzeinnahmen wie Stellplatz.' },
    { ids: ['hg_ul', 'hg_nul'],              rang: 10, frage: 'Wie hoch ist das Hausgeld, und wie viel davon ist nicht umlagefähig?' },
    /* v1280: Finanzierung als EIN Block — vier Einzelfragen nach EK, Zins,
       Tilgung und Bindung sind vier Mal dasselbe Thema. */
    { ids: ['ek', 'd1z', 'd1t', 'd1_bindj'], rang: 6, vorbelegt: 1, profil: 'finanzierung',
      frage: 'Wie finanzierst du? Eigenkapital, Zinssatz, Tilgung und Zinsbindung.' },
    { ids: ['kaufdat', 'wirtschaftlicher_uebergang'], rang: 12,
      frage: 'Wann wird gekauft, und ab wann gehören dir Mieten und Kosten?' },
    { ids: ['brw', 'gsfl', 'mea'],           rang: 14, frage: 'Was weißt du zum Grundstück — Bodenrichtwert, Fläche, Miteigentumsanteil?' },
    { ids: ['makrolage', 'mikrolage', 'ds2_zustand', 'ds2_energie'], rang: 16,
      frage: 'Wie ist die Lage und der Zustand — Region, Straße, Wohnung, Energieausweis?' },
    { ids: ['thesis', 'risiken', 'notizen'], rang: 18, frage: 'Warum lohnt sich das Objekt für dich, was könnte schiefgehen, und was ist sonst wichtig?' }
  ];

  var RF_MAX = 3;
  var _rf = null;   /* { offen:[], i:0, data:{}, catalog:[], OA:{}, alle:bool } */

  function _rfFehlt(eintrag, fields) {
    for (var i = 0; i < eintrag.ids.length; i++) {
      var id = eintrag.ids[i];
      var gesagt = !!(fields && (id in fields) && fields[id] !== '' && fields[id] != null);
      /* v1273c · VORBELEGTE Felder zaehlen NICHT als Angabe.
         Gemessen am 09.09.2026: die Lueckenpruefung meldete nichts offen,
         obwohl weder Zins noch Tilgung gesagt worden waren - beide standen
         als Wert im Formular, gesetzt vom Investmentprofil (V63.76). Nach
         der urspruenglichen Regel „was im Formular steht, ist keine Luecke"
         galten sie als beantwortet, und die Rechnung haette stillschweigend
         mit einer Vorbelegung gerechnet, die niemand bestaetigt hat. */
      var da = eintrag.vorbelegt ? gesagt : (gesagt || fieldHasValue(id));
      if (!da) return true;   /* eine Luecke im Block genuegt */
    }
    return false;
  }

  /* v1276: Bei nur drei Fragen entscheidet die Reihenfolge, ob die
     wichtigste dabei ist. Deshalb hier nach `rang` (Gewicht fuer die
     Rechnung), nicht nach Listenreihenfolge (Erzaehl-Logik). */
  function _rfLuecken(fields) {
    var offen = RFRAGEN.filter(function (e) { return _rfFehlt(e, fields); });
    offen.sort(function (a, b) { return (a.rang || 99) - (b.rang || 99); });
    return offen.slice(0, RF_MAX);
  }

  /* Was steht gerade im Formular? Fuer den „Passt so"-Knopf. */
  function _rfVorschlag(eintrag) {
    if (!eintrag.vorbelegt) return null;
    var el = document.getElementById(eintrag.ids[0]);
    var v = el ? String(el.value || '').trim() : '';
    return v || null;
  }

  /* Derselbe Wert, nur lesbar. „3.5" ist eine Zahl aus einem Eingabefeld,
     „3,5 %" ist eine Angabe. */
  /* ═══ v1280 · „Oder soll ich die aus deinen Einstellungen nehmen?" ══════
     Marcels Wunsch: „dass wir das vielleicht auch koppeln und er fragt:
     Oder soll ich die Zinskonditionen aus den Einstellungen nehmen? … wir
     haben ja auch diese Kondition im Tab Finanzierung … und dass er dann
     den passenden Zins zieht aus dieser indikativen Konditionsberechnung."

     Die Werte liegen längst bereit:
       DealPilotInvestmentProfile.get('tilgung_default' | 'zinsbindung_default'
         | 'ek_quote_default')      — was der Nutzer als Standard gesetzt hat
       DealPilotInvestmentProfile.getZins()  — der EFFEKTIVE Zins: eigener
         Wert, sonst der indikative Pfandbrief-Satz zur eingestellten
         Zinsbindung samt Marge (window.dpGetIndicativeZins)

     Der Unterschied zu v1273c ist wichtig: dort ging es um Werte, die schon
     IM FELD stehen. Hier geht es um Werte, die in den EINSTELLUNGEN stehen
     und noch nirgends eingetragen sind. Beides wird angeboten, nie
     stillschweigend genommen — der Knopf sagt, was er einträgt.

     Das Eigenkapital kommt aus der EK-Quote mal Kaufpreis: eine Quote ohne
     Kaufpreis ist keine Zahl, deshalb erscheint es nur, wenn der Kaufpreis
     schon steht. */
  function _rfProfilVorschlag(eintrag) {
    if (!eintrag || eintrag.profil !== 'finanzierung') return null;
    var P = window.DealPilotInvestmentProfile;
    if (!P || typeof P.get !== 'function') return null;
    var w = {}, teile = [];
    try {
      var zins = (typeof P.getZins === 'function') ? P.getZins() : null;
      if (typeof zins === 'number' && isFinite(zins) && zins > 0) {
        w.d1z = String(zins).replace('.', ',');
        teile.push(w.d1z + ' % Zins');
      }
      var tilg = P.get('tilgung_default');
      if (tilg) { w.d1t = String(tilg).replace('.', ','); teile.push(w.d1t + ' % Tilgung'); }
      var bind = P.get('zinsbindung_default');
      if (bind) { w.d1_bindj = String(bind); teile.push(bind + ' Jahre fest'); }
      var qu = P.get('ek_quote_default');
      var kpEl = document.getElementById('kp');
      var kp = kpEl ? parseFloat(String(kpEl.value || '').replace(/\./g, '').replace(',', '.')) : NaN;
      if (qu && isFinite(kp) && kp > 0) {
        w.ek = String(Math.round(kp * qu / 100));
        teile.push(qu + ' % Eigenkapital');
      }
    } catch (e) { return null; }
    if (!teile.length) return null;
    return { werte: w, text: teile.join(' · ') };
  }

  function _rfLesbar(wert, eintrag) {
    var v = String(wert).replace('.', ',');
    var kat = (_rf && _rf.catalog || []).filter(function (c) { return c.id === eintrag.ids[0]; })[0];
    if (kat && /%/.test(kat.label || '') && !/%/.test(v)) v += ' %';
    return v;
  }

  /* Mini-Katalog: nur die gefragten Felder. Das ist der halbe
     Kostenvorteil - der volle Katalog traegt ueber 6000 Token. */
  /* v1280 · Was der Co-Pilot ueber dieses Objekt schon weiss.
     Geht als Kontext an die Auswertung - erst damit wird aus „10 Prozent
     vom Kaufpreis" eine Zahl. Quelle ist beides: was im Gespraech schon
     gefallen ist UND was im Formular steht. Nur gefuellte Felder, und nur
     die, die als Bezugsgroesse taugen. */
  var KONTEXT_IDS = ['kp', 'nkm', 'wfl', 'zimmer', 'baujahr', 'ze', 'hg_ul', 'ek',
                     'd1', 'd1z', 'd1t', 'gsfl', 'brw', 'plz', 'ort', 'str'];
  function _rfKontext() {
    var k = {};
    try {
      KONTEXT_IDS.forEach(function (id) {
        var v = (_rf && _rf.data && _rf.data.fields && _rf.data.fields[id]);
        if (v === undefined || v === '' || v === null) {
          var el = document.getElementById(id);
          v = el ? String(el.value || '').trim() : '';
        }
        if (v !== '' && v !== null && v !== undefined) k[id] = v;
      });
    } catch (e) {}
    return Object.keys(k).length ? k : null;
  }

  function _rfKatalog(eintrag, catalog) {
    return (catalog || []).filter(function (e) { return eintrag.ids.indexOf(e.id) >= 0; });
  }

  function _rfStil() {
    if ($('vi-rf-stil')) return;
    var s = document.createElement('style');
    s.id = 'vi-rf-stil';
    s.textContent = [
      '#vi-frage{padding:2px 2px 0}',
      '.vi-rf-kopfzeile{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}',
      '.vi-rf-kopf{font:700 10.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;',
      '  text-transform:uppercase;color:var(--wl-c9a84c, #C9A84C)}',
      '.vi-rf-schalter{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
      '.vi-rf-fs{display:flex;align-items:center;gap:7px;cursor:pointer;',
      '  font:600 10.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.06em;opacity:.75}',
      '.vi-rf-fs input{accent-color:var(--wl-c9a84c, #C9A84C)}',
      /* Der Verlauf. Feste Hoehe, damit das Fenster beim Wachsen nicht springt. */
      /* v1281: zwei Spalten - links der Verlauf, rechts der Stand. Unter
         720 px untereinander; die Spalte wandert dann NACH OBEN, weil sie
         dort die Frage einordnet, statt sie zu verdecken. */
      /* v1283: Marcels Punkt „das Modal ist sehr klein". 740 px waren fuer
         EINE Spalte gedacht; seit v1281 stehen zwei nebeneinander, und der
         rechten blieben 196 px - genug fuer einen Oberbegriff, zu wenig
         fuer die Werte. Jetzt 1080 px, die Spalte bekommt 300. Nur im
         Sprechlauf-Modus: die anderen Dialoge sind schmal richtig. */
      '.oabi-ov.vi-mode .oabi-modal{width:min(1080px,100%)}',
      '@media(max-width:1120px){.oabi-ov.vi-mode .oabi-modal{width:min(860px,100%)}}',
      /* Die Spalte zeigt jetzt Werte, nicht nur Namen. */
      '.vi-rf-st{display:block;padding:6px 0}',
      '.vi-rf-st-k{display:flex;gap:7px;align-items:center}',
      '.vi-rf-st-w{margin:3px 0 0 18px;display:flex;flex-direction:column;gap:2px}',
      '.vi-rf-st-w span{font:500 11.5px/1.35 "JetBrains Mono",ui-monospace,monospace;',
      '  color:#3FA56C;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.vi-rf-st-w i{font-style:normal;opacity:.55;font-weight:400}',
      '.vi-rf-st.weg{opacity:.4} .vi-rf-st.weg .z{color:#B8625C}',
      '.vi-rf-buehne{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}',
      '@media(max-width:720px){.vi-rf-buehne{grid-template-columns:1fr}',
      '  .vi-rf-stand{order:-1;max-height:132px}}',
      '.vi-rf-stand{border:1px solid rgba(255,255,255,.09);border-radius:12px;padding:11px 13px;',
      '  max-height:340px;overflow-y:auto;background:rgba(255,255,255,.03)}',
      '.vi-rf-stand-kopf{font:700 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;',
      '  text-transform:uppercase;color:var(--wl-c9a84c, #C9A84C);opacity:.85;margin-bottom:9px}',
      '.vi-rf-st{display:flex;gap:7px;align-items:center;padding:4px 0;font:400 12.5px/1.3 Inter,system-ui,sans-serif;opacity:.55}',
      '.vi-rf-st .z{width:11px;flex:0 0 11px;text-align:center;font:600 11px/1 "JetBrains Mono",monospace}',
      '.vi-rf-st.ok{opacity:1} .vi-rf-st.ok .z{color:#3FA56C}',
      '.vi-rf-st.dran{opacity:1;font-weight:600} .vi-rf-st.dran .z{color:var(--wl-c9a84c, #C9A84C)}',
      '.vi-rf-st.dran .n{color:var(--wl-e8cc7a, #E8CC7A)}',
      '.vi-rf-stand-fuss{margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.09);',
      '  font:600 11px/1 "JetBrains Mono",ui-monospace,monospace;opacity:.6}',
      '.vi-rf-stand-fuss b{color:var(--wl-c9a84c, #C9A84C)}',
      '.vi-rf-chat{height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:11px;',
      '  padding:2px 4px 2px 2px}',
      '.vi-rf-blase{max-width:82%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.45;',
      '  animation:viRfAuf .3s ease both}',
      '@keyframes viRfAuf{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}',
      '.vi-rf-co{align-self:flex-start;background:rgba(255,255,255,.055);border-top-left-radius:5px;',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 26%, transparent)}',
      '.vi-rf-ich{align-self:flex-end;border-top-right-radius:5px;',
      '  background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 14%, transparent);',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent)}',
      '.vi-rf-wer{font:700 9px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;',
      '  text-transform:uppercase;margin-bottom:6px;opacity:.65}',
      '.vi-rf-co .vi-rf-wer{color:var(--wl-c9a84c, #C9A84C);opacity:.85}',
      '.vi-rf-ich .vi-rf-wer{text-align:right}',
      '.vi-rf-treffer{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(255,255,255,.14);',
      '  font:600 11.5px/1.5 "JetBrains Mono",ui-monospace,monospace;color:#3FA56C}',
      '.vi-rf-zaehler{font:600 10.5px/1 "JetBrains Mono",monospace;opacity:.5;margin-top:7px}',
      '.vi-rf-vorschlag{margin-top:9px;padding:8px 11px;border-radius:9px;font:400 12.5px/1.45 Inter,system-ui,sans-serif;',
      '  background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 10%, transparent);',
      '  border:1px dashed color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent)}',
      '.vi-rf-vorschlag b{color:var(--wl-e8cc7a, #E8CC7A)}',
      '.vi-rf-denkt{align-self:flex-start;opacity:.55;font-size:13px;padding:2px}',
      '.vi-rf-denkt i{display:inline-block;width:5px;height:5px;border-radius:50%;',
      '  background:var(--wl-c9a84c, #C9A84C);margin-right:3px;animation:viRfPp 1.1s infinite}',
      '.vi-rf-denkt i:nth-child(2){animation-delay:.18s}.vi-rf-denkt i:nth-child(3){animation-delay:.36s}',
      '@keyframes viRfPp{0%,60%,100%{opacity:.25}30%{opacity:1}}',
      /* Fuss: Lauschzeile und Eingabe */
      /* ═══ v1277 · Sprechen ist der Hauptweg, Tippen der Nebenweg ═══════
         Marcels Frage: „koennte man das jetzt so machen dass man direkt
         sprechen kann anstatt tippen?" - Es GING schon, aber es sah nicht
         so aus: der Cursor sprang ins Tippfeld, und dass das Mikrofon
         laeuft, stand als graue Zeile in 12 px darunter. Wer ein blinkendes
         Textfeld sieht, tippt.

         Jetzt steht die Mikrofon-Anzeige gross und mittig ueber der
         Eingabe, mit einem Pegel, der sich BEWEGT, wenn man spricht. Ein
         Ausschlag, den man sieht, beantwortet die Frage „hoert er mich?"
         ohne ein Wort. Das Tippfeld rueckt darunter und heisst nur noch
         „... oder tippen". Und der Fokus springt nicht mehr hinein. */
      '.vi-rf-mikro{display:flex;align-items:center;gap:12px;margin:12px 2px 10px;padding:11px 14px;',
      '  border-radius:12px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);',
      '  background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 7%, transparent);transition:border-color .2s ease}',
      '.vi-rf-mikro.hoert{border-color:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 70%, transparent)}',
      '.vi-rf-mikro.taub{opacity:.55}',
      '.vi-rf-mikro-icon{width:30px;height:30px;border-radius:50%;flex:0 0 30px;display:flex;',
      '  align-items:center;justify-content:center;font-size:15px;',
      '  background:linear-gradient(160deg, var(--wl-e8cc7a, #E8CC7A), var(--wl-c9a84c, #C9A84C));color:#100e08}',
      '.vi-rf-mikro.hoert .vi-rf-mikro-icon{animation:viRfPuls 1.4s ease-in-out infinite}',
      '@keyframes viRfPuls{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent)}',
      '  60%{box-shadow:0 0 0 9px transparent}}',
      '.vi-rf-mikro-txt{flex:1;min-width:0;font:600 13px/1.35 Inter,system-ui,sans-serif}',
      '.vi-rf-mikro-txt small{display:block;font:400 11.5px/1.3 Inter,system-ui,sans-serif;opacity:.6;margin-top:2px}',
      /* Der Pegel: acht Balken, die der Lautstaerke folgen. */
      '.vi-rf-pegel{display:flex;align-items:flex-end;gap:3px;height:26px;flex:0 0 auto}',
      '.vi-rf-pegel i{width:3px;height:3px;border-radius:2px;background:var(--wl-c9a84c, #C9A84C);',
      '  opacity:.35;transition:height .09s linear, opacity .09s linear}',
      '.vi-rf-lausch{min-height:16px;margin:10px 2px 6px;font:400 12px/1.3 Inter,system-ui,sans-serif;',
      '  opacity:.6;display:flex;align-items:center;gap:7px}',
      '.vi-rf-welle{display:inline-flex;align-items:flex-end;gap:2px;height:12px}',
      '.vi-rf-welle i{width:2px;background:var(--wl-c9a84c, #C9A84C);border-radius:1px;height:3px;',
      '  animation:viRfW .9s ease-in-out infinite}',
      '.vi-rf-welle i:nth-child(2){animation-delay:.15s}.vi-rf-welle i:nth-child(3){animation-delay:.3s}',
      '.vi-rf-welle i:nth-child(4){animation-delay:.45s}',
      '@keyframes viRfW{0%,100%{height:3px}50%{height:12px}}',
      '.vi-rf-zeile{display:flex;gap:8px;align-items:stretch}',
      '.vi-rf-zeile input{flex:1;min-width:0;border-radius:11px;padding:11px 14px;',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);',
      '  background:rgba(0,0,0,.25);color:inherit;font:400 14.5px Inter,system-ui,sans-serif}',
      '.vi-rf-zeile input:focus{outline:none;border-color:var(--wl-c9a84c, #C9A84C)}',
      '.vi-rf-btn{border-radius:11px;padding:0 15px;cursor:pointer;white-space:nowrap;',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);',
      '  background:transparent;color:var(--wl-c9a84c, #C9A84C);',
      '  font:600 12px "JetBrains Mono",ui-monospace,monospace}',
      '.vi-rf-btn:hover{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 12%, transparent)}',
      '.vi-rf-neben{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}',
      '.vi-rf-neben button{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);',
      '  color:inherit;opacity:.75;border-radius:9px;padding:7px 12px;cursor:pointer;',
      '  font:400 12.5px Inter,system-ui,sans-serif}',
      '.vi-rf-neben button:hover{opacity:1}'
    ].join('');
    document.head.appendChild(s);
  }

  function _rfHost() {
    var h = $('vi-frage');
    if (!h) {
      _rfStil();
      var rec = $('vi-rec');
      h = document.createElement('div');
      h.id = 'vi-frage';
      h.style.display = 'none';
      if (rec && rec.parentNode) rec.parentNode.insertBefore(h, rec.nextSibling);
      else { var b = document.querySelector('.oabi-ov.vi-mode .oabi-body'); if (b) b.appendChild(h); }
    }
    return h;
  }

  /* ── Der Verlauf ─────────────────────────────────────────────────── */
  function _rfBlase(wer, html, treffer) {
    var chat = $('vi-rf-chat'); if (!chat) return null;
    var d = document.createElement('div');
    d.className = 'vi-rf-blase ' + (wer === 'co' ? 'vi-rf-co' : 'vi-rf-ich');
    d.innerHTML = '<div class="vi-rf-wer">' + (wer === 'co' ? 'Co-Pilot' : 'Du') + '</div>' + html +
      (treffer ? '<div class="vi-rf-treffer">✓ ' + treffer + '</div>' : '');
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
    return d;
  }

  function _rfDenkt(an) {
    var chat = $('vi-rf-chat'); if (!chat) return;
    var alt = chat.querySelector('.vi-rf-denkt');
    if (!an) { if (alt) alt.remove(); return; }
    if (alt) return;
    var d = document.createElement('div');
    d.className = 'vi-rf-denkt';
    d.innerHTML = '<i></i><i></i><i></i> einen Moment …';
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
  }

  function _rfMelden(text, warte) {
    _rfDenkt(!!warte);
    if (!warte && text) _fsHinweis(text);
  }

  /* ── Aufbau der Ansicht (einmal je Dialog) ───────────────────────── */
  /* ═══════════════════════════════════════════════════════════════════
     v1283 · SCHNELLER, BREITER, SCHLAUER
     ═══════════════════════════════════════════════════════════════════
     Marcels Befund nach dem ersten echten Sprechlauf, fünf Punkte:

     1. „Das Modal ist sehr klein." → 740 auf 1080 px. Zwei Spalten
        brauchen Platz; bei 740 px blieben der Spalte 196 px, und darin
        passte nur ein Oberbegriff.

     2. „Da steht nur die Oberbegriffe und gar nicht das, was ich gesagt
        habe." → Die Spalte zeigt jetzt die WERTE, Feld für Feld, grün mit
        Haken. Sie ist damit nicht mehr ein Inhaltsverzeichnis, sondern das
        Protokoll.

     3. „Bei Sanierung und Inventar habe ich gesagt: Haben wir nicht. Das
        hat er nicht erkannt." → Verneinungen werden jetzt VOR dem KI-Aufruf
        erkannt: „haben wir nicht", „gibt es nicht", „kommt nicht in Frage",
        „brauchen wir nicht", „nichts", „weiter", „überspringen", „passt",
        „nein". Das spart nicht nur den Fehler, sondern auch den Aufruf —
        eine Verneinung braucht keine Auswertung.

     4. „Bei den Zinssätzen sollte man sagen können: übernimm die aus den
        Einstellungen." → Auch das wird vor dem Aufruf erkannt, wenn ein
        Vorschlag offen steht.

     5. „Wir brauchen dazwischen nicht mehr 'erkannt wurde das und das in
        Grün'." → Die Bestätigungsblase entfällt. Was erkannt wurde, steht
        in der Spalte; die nächste Frage kommt sofort statt nach 650 ms.

     ALLE VIER ERKENNUNGEN LAUFEN OHNE KI. Das ist der eigentliche
     Geschwindigkeitsgewinn: eine Verneinung, die früher 2 Sekunden und
     0,1 Cent gekostet hat, kostet jetzt nichts und dauert nichts. */
  var RF_NEIN = /^(nein|nee|ne|nichts|kein[es]?|keine[rs]?|gibt('s| es)? (hier )?(nicht|keine)|haben wir (nicht|keine)|hab(e)? ich (nicht|keine)|brauchen wir (nicht|keine)|kommt nicht in frage|entf(ä|ae)llt|weiter|(ü|ue)berspringen|(ü|ue)berspring|weiss nicht|wei(ß|ss) ich nicht|keine ahnung|passt so|passt|unbekannt|k\.?a\.?)\b[\s.!]*$/i;

  var RF_PROFIL_JA = /(übernimm|uebernimm|nimm|nehmen|übernehmen|uebernehmen|ja bitte|ja gern|einverstanden)\b.*(einstellung|profil|vorschlag|vorgabe|standard)|^(ja|okay|ok|passt|gerne|klar)\b[\s.!]*$/i;
  /* Was steht zu diesem Block — aus dem Gespräch ODER aus dem Formular?
     v1283d: auch das Formular zählt. Wer den Kaufpreis vorher eingetippt
     hat, bekommt ihn nicht mehr gefragt — dann darf er in der Übersicht
     aber auch nicht FEHLEN. Eine Liste, die „was schon steht" heißt und
     ausgerechnet das Eingetippte verschweigt, ist keine Übersicht. */
  function _rfWerteZuBlock(e) {
    var out = [];
    (e.ids || []).forEach(function (id) {
      var v = _rf && _rf.data && _rf.data.fields ? _rf.data.fields[id] : null;
      var ausFormular = false;
      if (v === undefined || v === null || v === '') {
        var el = document.getElementById(id);
        v = el ? String(el.value || '').trim() : '';
        ausFormular = true;
      }
      if (v === '' || v === null || v === undefined) return;
      var kat = (_rf.catalog || []).filter(function (c) { return c.id === id; })[0];
      var name = kat ? String(kat.label).replace(/\s*\(.*?\)\s*$/, '') : id;
      /* v1284: Zahlen lesbar - "3.5" ist ein Feldwert, "3,5" eine Angabe. */
      var anzeige = String(v);
      if (anzeige.indexOf(",") < 0 && /^-?[0-9]+\.[0-9]+$/.test(anzeige)) anzeige = anzeige.replace(".", ",");
      out.push({ n: name, v: anzeige, f: ausFormular });
    });
    return out;
  }

  function _rfStandZeichnen() {
    var host = $('vi-rf-stand'); if (!host || !_rf) return;
    /* v1283d: ALLE Blöcke, nicht nur die offenen. Die Reihenfolge ist die
       der Fragen; was vorher schon stand, steht davor. */
    var alle = _rf.offen.slice();
    var drin = {};
    _rf.offen.forEach(function (e) { drin[e.ids.join(',')] = 1; });
    var vorher = [];
    RFRAGEN.forEach(function (e) {
      if (drin[e.ids.join(',')]) return;
      if (_rfWerteZuBlock(e).length) vorher.push(e);
    });
    alle = vorher.concat(alle);
    var offenAb = vorher.length;

    var zeilen = alle.map(function (e, idx) {
      var werte = _rfWerteZuBlock(e);
      var i = idx - offenAb;                         /* Index in _rf.offen */
      var dran = (i === _rf.i) && !werte.length;
      var uebersprungen = !!(_rf.weg && i >= 0 && _rf.weg[i]);
      var zeichen = werte.length ? '✓' : (uebersprungen ? '–' : (dran ? '▸' : '·'));
      var klasse = werte.length ? 'ok' : (uebersprungen ? 'weg' : (dran ? 'dran' : ''));
      var detail = werte.length
        ? '<div class="vi-rf-st-w">' + werte.map(function (w) {
            return '<span><i>' + escH(w.n) + '</i> ' + escH(w.v) + '</span>';
          }).join('') + '</div>'
        : '';
      return '<div class="vi-rf-st ' + klasse + '">' +
             '<div class="vi-rf-st-k"><span class="z">' + zeichen + '</span>' +
             '<span class="n">' + escH(_rfKurzname(e)) + '</span></div>' + detail + '</div>';
    }).join('');
    var fertigN = alle.filter(function (e) { return _rfWerteZuBlock(e).length > 0; }).length;
    host.innerHTML =
      '<div class="vi-rf-stand-kopf">Was schon steht</div>' + zeilen +
      '<div class="vi-rf-stand-fuss"><b>' + fertigN + '</b> von ' + alle.length + '</div>';
    try {
      var dranEl = host.querySelector('.vi-rf-st.dran');
      if (dranEl) dranEl.scrollIntoView({ block: 'nearest' });
    } catch (ex) {}
  }


  /* Aus „Wie finanzierst du? Eigenkapital, Zinssatz, …" wird „Finanzierung".
     Die ganze Frage passt nicht in eine 210 px breite Spalte, und eine
     abgeschnittene Frage ist schlechter als ein kurzer Name. */
  var RF_KURZ = {
    objart: 'Objektart', plz: 'Adresse', wfl: 'Größe', baujahr: 'Baujahr', kp: 'Kaufpreis',
    san: 'Sanierung & Inventar', nkm: 'Mieteinnahmen', hg_ul: 'Hausgeld',
    ek: 'Finanzierung', kaufdat: 'Kauf & Übergang', brw: 'Grundstück',
    makrolage: 'Lage & Zustand', thesis: 'Deine Einschätzung'
  };
  function _rfKurzname(e) {
    /* v1282: Die Feinheiten-Bloecke tragen ihren Bereich, nicht die halbe
       Frage. "Objekt: Kuerzel, Wertsteigerung, Anzahl Etagen" passt nicht
       in 196 px - "Objekt · Detail" schon, und mehr braucht die Spalte
       nicht: welche Felder es sind, steht in der Frage selbst. */
    if (e.tiefe && e.bereich) return e.bereich;
    for (var i = 0; i < e.ids.length; i++) { if (RF_KURZ[e.ids[i]]) return RF_KURZ[e.ids[i]]; }
    return String(e.frage).split(/[?,–—]/)[0].slice(0, 22);
  }

  function _rfAufbau() {
    var h = _rfHost();
    h.innerHTML =
      '<div class="vi-rf-kopfzeile">' +
        '<span class="vi-rf-kopf">' + (_rf.alle ? 'Der Co-Pilot fragt' : 'Noch offen') + '</span>' +
        '<span class="vi-rf-schalter">' +
          '<label class="vi-rf-fs"><input type="checkbox" id="vi-rf-fs" checked> Freisprechen</label>' +
          /* v1282: Wer gleich alles will, muss nicht erst die Pflichtstrecke
             abwarten. Der Schalter haengt die Feinheiten sofort an. */
          '<label class="vi-rf-fs" id="vi-rf-alles-w"><input type="checkbox" id="vi-rf-alles"> Alle Felder</label>' +
        '</span>' +
      '</div>' +
      /* v1281: Verlauf und Stand nebeneinander - der Chat zeigt was WAR,
         die Spalte zeigt was IST. */
      '<div class="vi-rf-buehne">' +
        '<div class="vi-rf-chat" id="vi-rf-chat"></div>' +
        '<div class="vi-rf-stand" id="vi-rf-stand"></div>' +
      '</div>' +
      /* v1277: Sprechen ist der Hauptweg — er steht auch so da. */
      '<div class="vi-rf-mikro" id="vi-rf-mikro">' +
        '<span class="vi-rf-mikro-icon">🎤</span>' +
        '<span class="vi-rf-mikro-txt"><span id="vi-rf-lausch">Ich höre zu — sprich einfach los.</span>' +
          '<small id="vi-rf-mikro-sub">Ich merke selbst, wenn du fertig bist.</small></span>' +
        '<span class="vi-rf-pegel" id="vi-rf-pegel">' +
          '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>' +
      '</div>' +
      '<div class="vi-rf-zeile">' +
        '<input id="vi-rf-in" placeholder="… oder tippen — du darfst mich auch etwas fragen" autocomplete="off">' +
        '<button type="button" class="vi-rf-btn" id="vi-rf-ok">Übernehmen</button>' +
      '</div>' +
      '<div class="vi-rf-neben">' +
        '<button type="button" id="vi-rf-nix">Weiß ich nicht</button>' +
        '<button type="button" id="vi-rf-passt" style="display:none"></button>' +
        '<button type="button" id="vi-rf-ende">Fertig — zur Übersicht</button>' +
      '</div>' +
      '<div id="vi-rf-gesagt" style="display:none"></div>';
    h.style.display = '';

    var inp = $('vi-rf-in');
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); _rfSenden(); } });
    /* Wer tippt, will nicht gleichzeitig belauscht werden. */
    inp.addEventListener('input', function () { if (inp.value.trim()) _fsStopHoeren(); });
    $('vi-rf-ok').addEventListener('click', _rfSenden);
    $('vi-rf-nix').addEventListener('click', function () { _rfUeberspringen(); });
    $('vi-rf-ende').addEventListener('click', function () { _rfFertig(true); });   /* v1282: ausdruecklich beendet - nicht nach den Feinheiten fragen */
    $('vi-rf-passt').addEventListener('click', function () {
      var e = _rf.offen[_rf.i];
      _fsStopHoeren();
      /* v1280: Zwei Faelle hinter demselben Knopf, und der Unterschied ist
         wichtig. `profilVorschlag` traegt Werte aus den EINSTELLUNGEN, die
         noch nirgends stehen - da kommen mehrere Felder auf einmal.
         `_rfVorschlag` traegt einen Wert, der schon IM FELD steht (v1273c).
         Beides wird angeboten, nie stillschweigend genommen. */
      var pv = _rf.profilVorschlag;
      if (pv && pv.werte) {
        var namen = [];
        Object.keys(pv.werte).forEach(function (id) {
          _rf.data.fields[id] = pv.werte[id];
          var kat = _rf.catalog.filter(function (c) { return c.id === id; })[0];
          namen.push((kat ? kat.label : id) + ' = ' + pv.werte[id]);
        });
        /* v1283b: Wer den Wunsch selbst gesagt hat, hat seine Blase schon -
           sonst steht sein Satz zweimal da, einmal in eigenen Worten und
           einmal in unseren. */
        if (!_rf.stummeUebernahme) _rfBlase('ich', 'Nimm die aus meinen Einstellungen.');
        _rfBlase('co', 'Übernommen — in der Tabelle kannst du sie noch ändern.');
        _rf.stummeUebernahme = 0;
        _rf.profilVorschlag = null;
        _rfStandZeichnen();   /* v1283b: der Haken sofort */
        return _rfWeiter();
      }
      var v = _rfVorschlag(e);
      if (v) {
        _rf.data.fields[e.ids[0]] = v;
        if (!_rf.stummeUebernahme) _rfBlase('ich', 'Passt so.');
        _rf.stummeUebernahme = 0;
      }
      _rfWeiter();
    });
    /* v1282: „Alle Felder" haengt die Feinheiten sofort an - und wieder ab,
       solange sie noch nicht dran waren. Wer schon mitten drin ist, behaelt
       sie: eine Frage zurueckzunehmen, die gerade gestellt wird, waere
       verwirrender als eine zu viel. */
    var alles = $('vi-rf-alles');
    if (alles) alles.addEventListener('change', function () {
      if (this.checked) {
        if (_rf.tiefeAn) return;
        _rf.tiefeGefragt = 1;
        _rfTiefeStarten();
      } else if (_rf.tiefeAn) {
        var vorher = _rf.offen.length;
        _rf.offen = _rf.offen.filter(function (e, i) { return !e.tiefe || i <= _rf.i; });
        _rf.tiefeAn = 0; _rf.tiefeGefragt = 0;
        if (vorher !== _rf.offen.length) _rfStandZeichnen();
      }
    });
    $('vi-rf-fs').addEventListener('change', function () {
      _fs.an = this.checked;
      if (_fs.an) { _fsStart().then(function (ok) { if (ok) _fsHoeren(); else _fsMikroKasten(false, 'Mikrofon nicht verfügbar', 'Bitte tippen.'); }); }
      else { _fsStopHoeren(); _fsAus(); _fsMikroKasten(false, 'Freisprechen ist aus', 'Tippe deine Antworten.'); }
    });
  }

  /* ── Eine Frage stellen ──────────────────────────────────────────── */
  function _rfFrage() {
    if (_rf.i >= _rf.offen.length) return _rfFertig();
    var e = _rf.offen[_rf.i];
    /* v1280: Der Vorschlag aus den Einstellungen steht IN der Frage - nicht
       als stiller Knopf daneben. Wer gefragt wird, soll sehen, was der
       Co-Pilot vorhat, bevor er ja sagt. */
    var pv = _rfProfilVorschlag(e);
    _rfBlase('co', escH(e.frage) +
      (pv ? '<div class="vi-rf-vorschlag">Aus deinen Einstellungen hätte ich: <b>' +
            escH(pv.text) + '</b></div>' : '') +
      '<div class="vi-rf-zaehler">Frage ' + (_rf.i + 1) + ' von ' + _rf.offen.length + '</div>');
    _rf.profilVorschlag = pv;
    _rfStandZeichnen();   /* v1281 */

    var v = _rfVorschlag(e), pb = $('vi-rf-passt');
    if (pb) {
      if (pv) { pb.textContent = 'Einstellungen übernehmen'; pb.style.display = ''; }
      else if (v) { pb.textContent = 'Passt so (' + _rfLesbar(v, e) + ')'; pb.style.display = ''; }
      else { pb.style.display = 'none'; }
    }
    var inp = $('vi-rf-in');
    /* v1277: KEIN Fokus ins Tippfeld - wer einen blinkenden Cursor sieht,
       tippt. Gesprochen wird trotzdem gehoert; wer tippen will, klickt. */
    if (inp) { inp.value = ''; inp.disabled = false; }
    if (_fs.an && _fs.stream) _fsHoeren();
  }

  function _rfWeiter() {
    _fsStopHoeren();
    _rf.i++;
    if (_rf.i >= _rf.offen.length) return _rfFertig();
    _rfFrage();
  }

  function _rfUeberspringen(stumm) {
    _fsStopHoeren();
    /* v1283: Beim Ueberspringen keine zwei Blasen mehr. Wer „haben wir
       nicht" gesagt hat, hat seine Blase schon; eine Quittung darauf ist
       eine Zeile, die niemand liest. Die Spalte merkt sich den Strich. */
    if (!stumm) _rfBlase('ich', 'Weiß ich nicht.');
    if (!_rf.weg) _rf.weg = {};
    _rf.weg[_rf.i] = 1;
    _rfStandZeichnen();
    _rfWeiter();
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1282 · DIE FEINHEITEN — der Co-Pilot fragt auch den Rest ab
     ═══════════════════════════════════════════════════════════════════
     Marcels Wunsch: „können wir das auch mit dem Sprechlauf so
     weiterentwickeln, dass er auch alle anderen Felder entgegennimmt, wenn
     man das will? Du hast ja alles vorbereitet dafür."

     Stimmt - vorbereitet war es. Die 13 festen Blöcke decken 31 Felder ab;
     `window.FIELDS` führt aber **204**, davon rund 145 frei ausfüllbar
     (gemessen am 10.09.2026: s0 Objekt 72 · s3 Finanzierung 25 · s4
     Bewirtschaftung 17 · s1 Investition 14 · s2 Miete 13 · Steuer 4).

     WARUM NICHT EINFACH ALLES FRAGEN: 145 Fragen sind kein Gespräch, das
     ist ein Fragebogen. Die 13 Blöcke bleiben der Weg; die Feinheiten
     kommen NACH ihnen und nur, wenn jemand sie will.

     Zwei Wege dorthin:
       - Am Ende der Pflichtstrecke fragt der Co-Pilot einmal nach.
       - Wer es gleich weiss, schaltet oben „Alles fragen" ein.

     GEBILDET werden die Blöcke aus dem DOM, nicht aus einer zweiten Liste:
     Abschnitt (.sec) gibt das Thema, das Label gibt den Namen, je vier
     Felder eine Frage. Eine gepflegte Zweitliste von 145 Feldern würde
     beim ersten neuen Feld veralten - und niemand würde es merken.

     WAS NICHT GEFRAGT WIRD: berechnete Felder (readonly), gesperrte,
     versteckte, bereits gefüllte und die 31 aus der Pflichtstrecke. Wer
     schon geantwortet hat, wird nicht zweimal gefragt. */
  var TIEFE_SEC = {
    s0: 'Objekt', s1: 'Kaufpreis & Nebenkosten', s2: 'Miete & Entwicklung',
    s3: 'Finanzierung', 's3-tax': 'Steuer', s4: 'Bewirtschaftung'
  };
  var TIEFE_PRO_FRAGE = 4;

  function _rfTiefeBloecke() {
    var schon = {};
    RFRAGEN.forEach(function (e) { e.ids.forEach(function (id) { schon[id] = 1; }); });
    var proSec = {};
    (window.FIELDS || []).forEach(function (id) {
      if (schon[id]) return;
      var el = document.getElementById(id);
      if (!el) return;
      if (el.readOnly || el.disabled || el.type === 'hidden') return;
      if (String(el.value || '').trim() !== '') return;      /* steht schon */
      var sec = el.closest('.sec');
      var k = sec ? sec.id : '';
      if (!TIEFE_SEC[k]) return;                              /* nur bekannte Bereiche */
      var f = el.closest('.f');
      var lab = f && f.querySelector('label');
      var name = lab ? lab.textContent.replace(/\s+/g, ' ').replace(/\s*ℹ.*$/, '').trim() : id;
      if (!name || name.length > 42) return;                  /* ohne Namen keine Frage */
      (proSec[k] = proSec[k] || []).push({ id: id, label: name });
    });
    var bloecke = [];
    Object.keys(TIEFE_SEC).forEach(function (k) {
      var liste = proSec[k] || [];
      for (var i = 0; i < liste.length; i += TIEFE_PRO_FRAGE) {
        var teil = liste.slice(i, i + TIEFE_PRO_FRAGE);
        bloecke.push({
          ids: teil.map(function (x) { return x.id; }),
          tiefe: 1,
          bereich: TIEFE_SEC[k],
          frage: TIEFE_SEC[k] + ': ' + teil.map(function (x) { return x.label; }).join(', ') + '?'
        });
      }
    });
    return bloecke;
  }

  /* Der Katalog muss die Felder auch KENNEN - sonst hat die Auswertung
     kein Fach, in das sie den Wert legen kann. */
  function _rfKatalogErgaenzen(bloecke) {
    var da = {};
    (_rf.catalog || []).forEach(function (e) { da[e.id] = 1; });
    bloecke.forEach(function (b) {
      b.ids.forEach(function (id) {
        if (da[id]) return;
        var el = document.getElementById(id);
        if (!el) return;
        var f = el.closest('.f');
        var lab = f && f.querySelector('label');
        var eintrag = {
          id: id,
          label: lab ? lab.textContent.replace(/\s+/g, ' ').replace(/\s*ℹ.*$/, '').trim() : id,
          kind: (el.tagName === 'SELECT') ? 'select' : (el.tagName === 'TEXTAREA' ? 'input' : 'input')
        };
        if (eintrag.kind === 'select') {
          eintrag.options = [].slice.call(el.options || []).slice(0, 40).map(function (o) {
            return { v: o.value, t: o.text };
          }).filter(function (o) { return o.v !== ''; });
        }
        _rf.catalog.push(eintrag);
        da[id] = 1;
      });
    });
  }

  /* Nach der Pflichtstrecke: einmal fragen, nicht einfach weitermachen. */
  function _rfTiefeAnbieten() {
    var bloecke = _rfTiefeBloecke();
    if (!bloecke.length) return false;
    var felder = bloecke.reduce(function (n, b) { return n + b.ids.length; }, 0);
    _rf.tiefeBloecke = bloecke;
    _rfBlase('co', 'Das Wichtigste steht. Willst du die Feinheiten auch noch durchgehen? ' +
      'Das sind <b>' + felder + ' weitere Angaben</b> in ' + bloecke.length + ' Fragen — ' +
      'Kaufnebenkosten, Bewirtschaftung, Steuer, Entwicklung. ' +
      '<span style="opacity:.7">Du kannst jederzeit „Fertig" sagen.</span>');
    var neben = $('vi-rf-neben');
    if (neben) {
      neben.insertAdjacentHTML('afterbegin',
        '<button type="button" id="vi-rf-tiefe-ja">Ja, weiter ins Detail</button>');
      var b = $('vi-rf-tiefe-ja');
      if (b) b.addEventListener('click', function () {
        b.remove();
        _rfBlase('ich', 'Ja, lass uns weitermachen.');
        _rfTiefeStarten();
      });
    }
    var pb = $('vi-rf-passt'); if (pb) pb.style.display = 'none';
    _fsStopHoeren();
    return true;
  }

  function _rfTiefeStarten() {
    var bloecke = _rf.tiefeBloecke || _rfTiefeBloecke();
    if (!bloecke.length) return _rfFertig();
    _rfKatalogErgaenzen(bloecke);
    _rf.offen = _rf.offen.concat(bloecke);
    _rf.tiefeAn = 1;
    _rf.tiefeBloecke = null;
    _rfStandZeichnen();
    _rfFrage();
  }

  function _rfFertig(erzwungen) {
    /* v1282: Ist die Pflichtstrecke durch, wird EINMAL nach den Feinheiten
       gefragt - aber nur im gefuehrten Weg und nur, wenn der Nutzer nicht
       selbst „Fertig" gedrueckt hat. Wer abbricht, will abbrechen. */
    if (!erzwungen && _rf && _rf.alle && !_rf.tiefeAn && !_rf.tiefeGefragt) {
      _rf.tiefeGefragt = 1;
      if (_rfTiefeAnbieten()) return;
    }
    _fsStopHoeren(); _fsAus();
    var h = $('vi-frage'); if (h) h.style.display = 'none';
    showResults(_rf.OA, _rf.data, _rf.catalog);
    _rf = null;
  }
  /* Antwort verarbeiten - egal ob getippt oder gesprochen. */
  function _rfUebernehmen(neu, ausSprache) {
    _rfDenkt(false);
    var e = _rf.offen[_rf.i];
    var namen = [];
    Object.keys(neu || {}).forEach(function (id) {
      if (e.ids.indexOf(id) < 0) return;            /* nur was gefragt war */
      var v = neu[id];
      if (v === '' || v == null) return;
      _rf.data.fields[id] = v;
      var kat = _rf.catalog.filter(function (c) { return c.id === id; })[0];
      namen.push((kat ? kat.label : id) + ' = ' + v);
    });
    if (!namen.length) {
      _rfBlase('co', 'Daraus konnte ich nichts entnehmen — sag es gern nochmal oder tippe es.');
      if (ausSprache && _fs.an) _fsHoeren();
      return;
    }
    /* v1283: KEINE Bestaetigungsblase mehr. Marcels Punkt: "wir brauchen
       dazwischen nicht mehr erkannt wurde das und das in Gruen, sondern wenn
       wir die Liste haben, kann man das ja gleich dort eintragen". Der
       Verlauf bleibt dadurch lesbar - er zeigt das GESPRAECH, nicht die
       Quittungen. */
    _rfStandZeichnen();
    setTimeout(_rfWeiter, 120);   /* v1283: zuegiger - die Bestaetigung steht ja schon in der Spalte */
  }

  /* ═══ v1281 · Wenn der Nutzer selbst fragt ═════════════════════════════
     Marcels Wunsch: „dann wäre es cool, wenn man ihm vielleicht auch
     einfach Fragen stellen könnte … und dass er darauf dann antwortet zu
     dem Kontext, den er bis dahin hat."

     Der Dialog hat bis hierher nur ZUGEHOERT. Alles, was hereinkam, war
     eine Antwort auf seine Frage. Jetzt muss er unterscheiden: „490 Euro"
     ist eine Antwort, „ist das viel für die Lage?" ist eine Frage.

     Die Unterscheidung ist absichtlich VORSICHTIG: erkannt wird nur, was
     deutlich nach Frage aussieht - Fragezeichen oder ein Fragewort am
     Anfang. Im Zweifel gilt es als Antwort, denn eine falsch als Frage
     verstandene Angabe geht verloren, eine falsch als Angabe verstandene
     Frage steht wenigstens in der Tabelle und faellt auf.

     „Wie hoch ist die Miete?" waere ein Grenzfall - aber wer im Dialog
     nach seiner eigenen Miete fragt, will tatsaechlich eine Auskunft. */
  var RF_FRAGEWORT = /^(was|wie|wieso|warum|weshalb|wer|wo|wann|welche[rsn]?|kannst du|kannst|koenntest|könntest|erklaer|erklär|rechne|zeig|sag mir|ist das|macht das|lohnt|passt das|waere|wäre|soll ich|hab ich|habe ich)\b/i;

  function _rfIstFrage(text) {
    var t = String(text || '').trim();
    if (!t) return false;
    if (/\?\s*$/.test(t)) return true;
    if (RF_FRAGEWORT.test(t) && t.split(/\s+/).length >= 3) return true;
    return false;
  }

  function _rfFrageBeantworten(text) {
    _rfBlase('ich', escH(text));
    _rfMelden('', true);
    return Auth.apiCall('/ai/copilot-frage', {
      method: 'POST',
      body: { frage: text, kontext: _rfKontext() }
    }).then(function (r) {
      _rfDenkt(false);
      _rfBlase('co', escH((r && r.antwort) || 'Dazu weiß ich gerade nichts.'));
      /* Nach der Auskunft geht es weiter, wo es aufgehoert hat - die Frage,
         die offen war, ist immer noch offen. */
      var e = _rf.offen[_rf.i];
      if (e) _rfBlase('co', '<span style="opacity:.7">Zurück zur Frage:</span> ' + escH(e.frage));
      if (_fs.an && _fs.stream) _fsHoeren();
    }).catch(function (err) {
      _rfDenkt(false);
      _rfBlase('co', escH((err && err.message) || 'Das konnte ich gerade nicht beantworten.'));
      if (_fs.an && _fs.stream) _fsHoeren();
    });
  }

  /* v1283 · Was ohne KI entschieden werden kann, wird ohne KI entschieden.
     Drei Fälle fängt diese Funktion ab, bevor irgendein Aufruf losgeht:
     eine Verneinung, ein „ja, nimm die Einstellungen" und eine Frage.
     Das ist der Geschwindigkeitsgewinn, den Marcel meint - eine
     Verneinung kostete vorher zwei Sekunden und 0,1 Cent. */
  function _rfVorabErkennen(text, ausSprache) {
    var t = String(text || '').trim();
    if (!t) return true;

    /* 1. Frage? Dann beantworten statt eintragen. */
    if (_rfIstFrage(t)) { _rfFrageBeantworten(t); return true; }

    /* 2. „Ja, nimm die aus den Einstellungen" - nur wenn einer offen ist. */
    if (_rf.profilVorschlag && RF_PROFIL_JA.test(t)) {
      _rfBlase('ich', escH(t));
      var pb = $('vi-rf-passt');
      if (pb) { _rf.stummeUebernahme = 1; pb.click(); return true; }
    }

    /* 3. Verneinung: „haben wir nicht", „kommt nicht in Frage", „weiter".
       Marcels Fall - „Bei Sanierung und Inventar habe ich gesagt: Haben wir
       nicht. Das hat er nicht erkannt." */
    if (RF_NEIN.test(t)) {
      _rfBlase('ich', escH(t));
      _rfUeberspringen(true);
      return true;
    }
    return false;
  }

  function _rfSenden() {
    var inp = $('vi-rf-in'); if (!inp) return;
    var text = String(inp.value || '').trim();
    if (!text) return;
    _fsStopHoeren();
    inp.value = '';
    if (_rfVorabErkennen(text, false)) return;   /* v1283 */
    var e = _rf.offen[_rf.i];
    inp.disabled = true;
    _rfBlase('ich', escH(text));
    _rfMelden('', true);
    Auth.apiCall('/ai/extract-text', {
      method: 'POST',
      body: { text: text, catalog: _rfKatalog(e, _rf.catalog), kontext: _rfKontext() }
    }).then(function (r) {
      inp.disabled = false;
      _rfUebernehmen(r && r.fields, false);
    }).catch(function (err) {
      inp.disabled = false;
      _rfDenkt(false);
      _rfBlase('co', '⚠ ' + escH((err && err.message) || 'Das hat gerade nicht geklappt.'));
    });
  }

  /* Einstieg: nach der Auswertung (Lücken) oder von Anfang an (geführt). */
  function rueckfragen(OA, data, catalog, alle) {
    var fields = (data && data.fields) || {};
    var luecken = alle
      ? RFRAGEN.filter(function (e) { return _rfFehlt(e, fields); })
      : _rfLuecken(fields);
    if (!luecken.length) return showResults(OA, data, catalog);   /* nichts offen */
    _rf = { offen: luecken, i: 0, data: data, catalog: catalog, OA: OA, alle: !!alle };
    if (!_rf.data.fields) _rf.data.fields = {};
    var rec = $('vi-rec'); if (rec) rec.style.display = 'none';
    var nx = $('vi-next'); if (nx) nx.style.display = 'none';
    _rfAufbau();

    var gefunden = Object.keys(_rf.data.fields).length;
    _rfBlase('co', alle
      ? 'Ich gehe die Angaben der Reihe nach durch — <b>' + luecken.length + '</b> Fragen. ' +
        'Sprich einfach los, ich höre mit. Was du nicht weißt, überspringen wir.'
      : 'Ich habe <b>' + gefunden + ' Angaben</b> aus deiner Aufnahme gelesen. ' +
        (luecken.length === 1 ? 'Für die Rechnung fehlt mir noch eine.'
                              : 'Für die Rechnung fehlen mir noch ' + luecken.length + '.'));

    _fs.an = true;
    _fsStart().then(function (ok) {
      if (!ok) {
        var s = $('vi-rf-fs'); if (s) { s.checked = false; s.disabled = true; }
        _fs.an = false;
        _fsMikroKasten(false, 'Mikrofon nicht verfügbar', 'Tippe deine Antworten — oder gib das Mikrofon im Browser frei und öffne neu.');
      }
      _rfFrage();
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
      /* v1168-VBOOL: Der Server laesst nur JA-Antworten durch, hier kommt
         also nie ein false an. Angezeigt wird trotzdem Klartext — „true" in
         einer Import-Tabelle liest niemand gern. */
      if (entry.kind === 'bool') {
        OA.addRow(id, entry.label, 'Ja' + mark, true, S, 'bool');
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

    /* ── v1259 · Was hat diese Aufnahme gekostet? ────────────────────────
       Marcels Frage vom 08.09.2026. Die Zahlen kommen vom Backend, das sie
       aus den `usage`-Angaben jeder OpenAI-Antwort einsammelt; die
       Live-Hilfe waehrend des Sprechens ist eingerechnet (qm.kostenCent).

       NICHT fuer jeden sichtbar: fuer einen Kunden ist die Auswertung im
       Plan enthalten, eine Cent-Angabe wuerde ihn nur fragen lassen, was
       sie ihm abzieht. Anzeigen mit `?kosten=1` an der Adresse (merkt sich
       das Fenster), abschalten mit `?kosten=0`. In der Browser-Konsole und
       im Server-Log steht sie immer. */
    try {
      var k = data && data.kosten;
      if (k) {
        var centGesamt = (k.eur_cent || 0) + (qm.kostenCent || 0);
        console.log('[voice-import] Kosten: ' + centGesamt.toFixed(2) + ' ct' +
          (k.vollstaendig ? '' : ' (ohne Preis: ' + (k.ohne_preis || []).join(', ') + ')'),
          { auswertung: k, liveHilfe_ct: qm.kostenCent, laeufe: qm.calls });
        if (_kostenZeigen()) {
          var kh = $('oabi-result');
          if (kh) {
            var zeilen = (k.posten || []).map(function (p) {
              return '<div style="display:flex;justify-content:space-between;gap:12px">' +
                '<span>' + escH(p.schritt) + ' <span style="opacity:.6">' + escH(p.modell || '') + '</span></span>' +
                '<span>' + (p.ein || 0) + ' ein' +
                (p.einCached ? ' (davon ' + p.einCached + ' aus dem Zwischenspeicher)' : '') +
                ' / ' + (p.aus || 0) + ' aus' +
                (p.bepreist ? '' : ' <b>· kein Preis hinterlegt</b>') + '</span></div>';
            }).join('');
            if (qm.calls) {
              zeilen += '<div style="display:flex;justify-content:space-between;gap:12px">' +
                '<span>Live-Hilfe waehrend des Sprechens</span><span>' + qm.calls + ' Laufe' + '</span></div>';
            }
            var kd = document.createElement('details');
            kd.style.cssText = 'margin:10px 0 4px;font-size:12px;color:#7A7370';
            /* v1259e: tokenisiert. Der Gold-Audit hat diese Zeile gefangen,
               eine Stunde nachdem seine Basislinie gebaut war — ich hatte das
               #9a7f33 aus der Zeile darunter kopiert. Genau dafuer ist er da. */
            kd.innerHTML = '<summary style="cursor:pointer;font-weight:600;color:var(--wl-9a7f33, #9a7f33)">Kosten dieser Aufnahme: ' +
              centGesamt.toFixed(2).replace('.', ',') + ' Cent' +
              (k.vollstaendig ? '' : ' (unvollständig)') + '</summary>' +
              '<div style="margin:8px 0 0;line-height:1.7;background:rgba(229,168,71,.08);border:1px solid rgba(229,168,71,.3);border-radius:8px;padding:10px">' +
              zeilen +
              (k.vollstaendig ? '' :
                '<div style="margin-top:8px"><b>Nicht bepreist:</b> ' + escH((k.ohne_preis || []).join(', ')) +
                ' — die Tokenzahlen sind gemessen, der Listenpreis dieser Modelle ist nicht hinterlegt.</div>') +
              '<div style="margin-top:8px;opacity:.7">Kurs 1&nbsp;USD = ' + String(k.kurs).replace('.', ',') + '&nbsp;EUR</div>' +
              '</div>';
            kh.appendChild(kd);
          }
        }
      }
    } catch (e) {}

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
  /* v1259 · `_orbit` ist ein Pruef-Haken, kein Bedienweg. Das Nachruecken der
     Pillen laesst sich sonst nur durch echtes Sprechen ausloesen — im
     automatisierten Browser gibt es kein Mikrofon, und damit bliebe die
     Kernmechanik des Umbaus unbeweisbar. Mit dem Haken kann man einen Chip
     auf `on` setzen und zusehen, ob der Platz frei wird und der naechste
     genau dort nachrueckt. Vorbild: window._dpDispSkin. */
  /* v1259 & v1273 · Pruefhaken, keine Bedienwege. Ohne sie liesse sich der
     Rueckfragen-Zustand nur mit echtem Sprechen erreichen - und echtes
     Sprechen laesst sich nicht automatisiert nachmessen. */
  window.VoiceImport = { srcLabel: srcLabel, open: open, _orbit: chipOrbit,
                         _rueckfragen: rueckfragen, _luecken: _rfLuecken,
                         _text: updateChipsFromText,   /* v1274: Live-Weg pruefbar */
                         _gefuehrt: _gefuehrt };       /* v1275 */
})();
