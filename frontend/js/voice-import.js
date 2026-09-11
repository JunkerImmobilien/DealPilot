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
  /* v1293: Was vor dem Sprechlauf lief (Pre-Flight-Kette), und ob die
     Marktbewertung dort mit angehakt war. */
  var _vorlauf = [], _mbGewollt = false, _mbGeholt = false, _vorlaufFelder = null;
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

      /* ═══ v1300c · Der freie Weg wird geteilt ═══════════════════════════
         Marcels Vorgabe: „wenn ich frei erzähle, dass wir dort dann auch
         einmal, was schon steht, dass wir das dort halt auch einmal
         auflisten."

         DIESE REGELN STANDEN IN `_rfStil()` — GEMESSEN: das Style-Tag
         `vi-rf-stil` existiert im freien Weg GAR NICHT, es wird nur für den
         geführten Dialog eingehängt. `.vi-frei-buehne` stand deshalb auf
         `display:block` statt Grid, und die Spalte lief über die volle
         Breite. Dieselbe Sorte wie der falsche Anker in `v1296b`: eine
         Regel am Ort, den der Code nie erreicht.

         Sie gehören hierher, in `vi-style` — der Block wird bei JEDEM
         Öffnen gesetzt, für beide Wege.

         `min-width:0` am linken Kind ist Pflicht: ein Grid-Kind schrumpft
         sonst nicht unter seinen Inhalt, und der Orbit drückt die Spalte
         aus dem Bild. */
      /* ═══ v1301 · Die Aufnahme ist so breit wie der geführte Dialog ══════
         Marcels Vorgabe vom 11.09.2026: „bei der Sprachaufzeichnung darf
         das Modal schon breiter sein, also so breit wie bei dem anderen
         Sprechlauf auch."

         GEMESSEN: die Breitenregel `width:min(1240px,100%)` steht in
         `_rfStil()` — im Block `vi-rf-stil`, den NUR der geführte Dialog
         einhängt. Der freie Weg blieb deshalb bei der Basisregel aus
         `vi-style`: 760 px. Dieselbe Ursache wie bei der geteilten Ansicht
         eine Version zuvor, nur an einer anderen Eigenschaft.

         Die Breite hängt am Zustand, nicht am Fenster: `vi-breit` wird
         gesetzt, sobald die Aufnahme läuft. Die Wahlseite davor („Wie
         möchtest du das Objekt aufnehmen?") bleibt schmal — zwei Karten
         nebeneinander brauchen keine 1360 px, und ein Dialog, der beim
         Klick die Breite wechselt, wirkt unruhig. */
      '.oabi-ov.vi-mode.vi-breit .oabi-modal{width:min(1360px,100%);max-height:97vh}',
      '@media(max-width:1400px){.oabi-ov.vi-mode.vi-breit .oabi-modal{width:min(1180px,100%)}}',
      '@media(max-width:1200px){.oabi-ov.vi-mode.vi-breit .oabi-modal{width:min(960px,100%)}}',
      '.vi-frei-buehne{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start}',
      '.vi-frei-buehne > #vi-rec{min-width:0}',
      '.oabi-ov.vi-mode #vi-frei-stand{min-height:0;max-height:min(62vh,560px);',
      '  border:1px solid var(--vi-line);border-radius:12px;background:var(--vi-card);',
      '  display:flex;flex-direction:column;overflow:hidden;color:var(--vi-text)}',
      '.oabi-ov.vi-mode #vi-frei-stand .vi-rf-stand-kopf{display:flex;align-items:center;',
      '  justify-content:space-between;gap:8px;padding:10px 13px 9px;flex:0 0 auto;',
      '  border-bottom:1px solid var(--vi-line);',
      '  font:700 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;',
      '  text-transform:uppercase;color:var(--vi-accent)}',
      '.oabi-ov.vi-mode #vi-frei-stand .vi-rf-stand-body{flex:1 1 auto;min-height:0;',
      '  overflow-y:auto;padding:7px 11px 11px}',
      '.oabi-ov.vi-mode #vi-frei-stand .vi-rf-gr{display:flex;align-items:center;gap:7px;',
      '  margin:9px 0 4px;font:700 9px/1 "JetBrains Mono",ui-monospace,monospace;',
      '  letter-spacing:.1em;text-transform:uppercase;color:var(--vi-muted)}',
      '.oabi-ov.vi-mode #vi-frei-stand .vi-rf-gr-n{flex:1;min-width:0}',
      '.oabi-ov.vi-mode #vi-frei-stand .vi-rf-st{display:flex;align-items:baseline;gap:7px;',
      '  padding:3px 0;font:400 11.5px/1.4 Inter,system-ui,sans-serif;color:var(--vi-text)}',
      '.oabi-ov.vi-mode #vi-frei-stand .vi-rf-st.ok{color:var(--vi-donetx)}',
      '.oabi-ov.vi-mode #vi-frei-stand .vi-rf-st-z{flex:0 0 auto;width:11px;opacity:.7}',
      '.oabi-ov.vi-mode #vi-frei-stand .vi-rf-st-n{flex:1;min-width:0}',
      '.oabi-ov.vi-mode #vi-frei-stand .vi-rf-st-v{flex:0 0 auto;max-width:52%;text-align:right;',
      '  font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10.5px;',
      '  color:var(--vi-accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      /* Unter 900 px trägt die Breite keine zwei Spalten. Die Liste wandert
         nach UNTEN, nicht nach oben: beim freien Erzählen ist das Mikrofon
         das Hauptelement — anders als im geführten Weg. */
      '@media(max-width:900px){.vi-frei-buehne{grid-template-columns:1fr}',
      '  .oabi-ov.vi-mode #vi-frei-stand{max-height:210px}}',

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
  /* ═══════════════════════════════════════════════════════════════════
     v1293e · DAS MIKROFON LIEF NACH DEM ABBRECHEN WEITER
     ═══════════════════════════════════════════════════════════════════
     Beim Durchgehen der Quellen-Kombinationen gemessen — mit einem
     synthetischen Audiostrom, damit der Recorder echt laeuft:

       vor  „Abbrechen":  recState recording · phase spricht · chunks 5
       nach „Abbrechen":  recState recording · phase spricht · chunks 8

     Der Recorder lief weiter, die Stuecke wuchsen, und `_rf` stand noch
     komplett da. Im Browser bleibt damit das Aufnahme-Symbol an —
     **jemand hat den Dialog beendet, und sein Mikrofon horcht weiter.**

     Das ist kein Schoenheitsfehler. Ein laufendes Mikrofon, von dem der
     Nutzer glaubt, es sei aus, ist ein Vertrauensbruch.

     URSACHE: der Abbrechen-Knopf rief `stopAll()` — das ist die Aufnahme
     des FREIEN Weges — und `done()`. Der Freisprech-Strom des DIALOGS
     (`_fs`) hat damit nichts zu tun und blieb unberuehrt. Beim zweiten
     Weg hinaus, `OA.apply()`, ist es dasselbe: dort schliesst ein
     anderes Modul das Fenster und weiss von `_fs` gar nichts.

     ZWEI RIEGEL, weil einer nicht reicht:

       1. `_viAufraeumen()` — eine Stelle, die alles abraeumt, gerufen von
          jedem bekannten Weg hinaus.
       2. EIN BEOBACHTER auf dem Overlay. Verschwindet es auf IRGENDEINEM
          Weg — Abbrechen, X, Uebernehmen, ein fremdes Modul, ein Fehler
          mittendrin —, raeumt er auf. Ein Mikrofon darf nicht davon
          abhaengen, dass jemand an eine Codezeile gedacht hat. */
  function _viAufraeumen(grund) {
    try { _fsStopHoeren(); } catch (e) {}
    try { _fsAus(); } catch (e) {}
    try { stopAll(); } catch (e) {}
    _rf = null;
    _vorlauf = []; _vorlaufFelder = null; _mbGewollt = false;
    /* `_mbGeholt` NICHT hier zuruecksetzen — es wird nach dem Schliessen
       noch gelesen (die Kette fragt ueber `done`, ob der Abruf lief).
       Geloescht wird es am ANFANG des naechsten Dialogs (v1293c). */
    try { if (_viWache) { _viWache.disconnect(); _viWache = null; } } catch (e) {}
    try { console.log('[voice] aufgeraeumt (' + (grund || '?') + ')'); } catch (e) {}
  }

  var _viWache = null;
  function _viWacheStarten() {
    try {
      if (_viWache) { _viWache.disconnect(); _viWache = null; }
      if (typeof MutationObserver !== 'function') return;
      _viWache = new MutationObserver(function () {
        if (!document.getElementById('oabi-ov')) _viAufraeumen('Overlay verschwunden');
      });
      _viWache.observe(document.body, { childList: true });
    } catch (e) {}
  }

  function open(onDone, opts) {
    injectCss();
    var OA = window.ObjectActions && window.ObjectActions._voice;
    if (!OA) { toast('Sprachmodul nicht bereit \u2014 Seite neu laden'); if (typeof onDone === 'function') onDone(); return; }
    if ($('oabi-ov')) { if (typeof onDone === 'function') onDone(); return; }

    _doneFired = false;
    var done = function (payload) {
      if (_doneFired) return; _doneFired = true;
      /* v1293: Der Aufrufer (die Pre-Flight-Kette) muss erfahren, ob die
         Marktbewertung hier schon gelaufen ist — sonst startet er sie ein
         zweites Mal, und zweimal abrufen heisst zweimal bezahlen. */
      var p = payload || {};
      try { p.marktGeholt = !!_mbGeholt; } catch (e) {}
      try { if (typeof onDone === 'function') onDone(p); } catch (e) {}
    };
    _qcTarget = !!(opts && opts.target === 'qc');  /* v506-qc-items */
    /* v1293: Was vor dem Sprechlauf lief, und ob die Marktbewertung auf
       der Pre-Flight-Karte mit angehakt war. */
    _vorlauf = (opts && Array.isArray(opts.vorlauf)) ? opts.vorlauf.slice() : [];
    _mbGewollt = !!(opts && opts.marktbewertung);
    _vorlaufFelder = (opts && Array.isArray(opts.vorlaufFelder)) ? opts.vorlaufFelder.slice() : null;
    /* v1293c: MODULVARIABLE — beim zweiten Oeffnen zuruecksetzen.
       Gemessen: der zweite Sprechlauf meldete "schon geholt", obwohl
       er selbst nichts geholt hatte; die Kette haette daraufhin ihren
       eigenen Abruf uebersprungen und der Nutzer stuende ohne
       Marktbewertung da. Ein Zustand, der einen Dialog ueberlebt, gehoert
       an dessen Anfang geloescht. */
    _mbGeholt = false;
    OA.reset();
    OA.setMode(!!(opts && opts.target === 'qc'), done);

    var ov = document.createElement('div');
    ov.className = 'oabi-ov vi-mode'; ov.id = 'oabi-ov';  /* v504-white: gescopter Restyle */
    ov.innerHTML =
      '<div class="oabi-modal">' +
        '<div class="oabi-head"><span style="color:var(--gold,#C9A84C)">' + micSvg(22) + '</span><h3>Sprachaufzeichnung</h3></div>' +
        '<div class="oabi-sub">Objekt frei einsprechen \u2014 Adresse, Kaufpreis, Fl\u00e4chen, Miete und Zusatzeinnahmen, Zustand, Lage, Bodenrichtwert, Annahmen, Bewirtschaftung, Finanzierung \u2014 und was du davon h\u00e4ltst: Risiken, deine These. Freie Formulierungen werden auf die passenden Felder gebr\u00fcckt. Bis zu 4 Minuten.</div>' +
        '<div class="oabi-body">' +
          /* v1300b: geteilte Ansicht \u2014 links das Mikrofon, rechts \u201ewas
             schon steht". Der Beh\u00e4lter ist ein Grid, das bei schmalem
             Fenster auf eine Spalte f\u00e4llt (CSS weiter unten). */
          '<div class="vi-frei-buehne">' +
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
          /* v1300b: dieselbe Spalte wie im geführten Weg, gefüllt aus dem
             Formular und dem, was die laufende Auswertung erkannt hat. */
          '<div class="vi-rf-stand" id="vi-frei-stand"></div>' +
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
      _viAufraeumen('Abbrechen');   /* v1293e: samt Mikrofon */
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

    _viWacheStarten();  /* v1293e: raeumt auf, egal wer das Fenster schliesst */
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
      '  background:var(--wl-fbf8f2, #FBF8F2);color:inherit;transition:background .16s ease, box-shadow .16s ease}',   /* v1290c: heller Grund */
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

  /* ═══ v1302 · Die Spalte geht MIT der Aufnahme ══════════════════════════
     Marcels Befund vom 11.09.2026: „da siehst du ein merkwürdiges Feld
     rechts in schwarz, und wenn ich Eingaben gemacht habe und auf
     Übernehmen klicke, dann ist das Eingabefenster weg."

     Beides derselbe Fehler, und er ist meiner aus `v1300b`. Die neue
     Spalte „Was schon steht" hängt in `.vi-frei-buehne`, einem Grid mit
     zwei Spalten. An DREI Stellen wird `vi-rec` auf `display:none`
     gesetzt — beim Start der Startkarte, beim Aufbau des geführten
     Dialogs und nach der Auswertung.

     Die Spalte blieb dabei stehen: ein leerer, fast schwarzer Kasten
     (`--vi-card` auf `--vi-surface`) an der rechten Seite. Und weil das
     Grid weiter zwei Spalten aufspannte, bekam der nachfolgende Inhalt
     nur noch die linke — das „Eingabefenster weg".

     `_recAus()` räumt jetzt beides zusammen ab. Wer das Aufnahmefenster
     versteckt, versteckt seine Spalte mit; die Bühne fällt auf eine
     Spalte zurück, damit das, was danach kommt, die volle Breite hat. */
  function _recAus() {
    var rec = $('vi-rec'); if (rec) rec.style.display = 'none';
    var st = $('vi-frei-stand'); if (st) st.style.display = 'none';
    var b = document.querySelector('.vi-frei-buehne');
    if (b) b.style.display = 'block';
  }

  /* Das Gegenstück. Beide gehören zusammen: `''` statt eines festen Wertes,
     damit wieder gilt, was im Stylesheet steht — die Bühne ist dort ein
     Grid, und auf schmalen Geräten eine einzelne Spalte. Ein hier
     hartgesetztes `grid` würde die Media-Query aushebeln. */
  function _recAn() {
    var rec = $('vi-rec'); if (rec) rec.style.display = '';
    var st = $('vi-frei-stand'); if (st) st.style.display = '';
    var b = document.querySelector('.vi-frei-buehne');
    if (b) b.style.display = '';
  }

  function _startkarte(OA) {
    _startkarteStil();
    _recAus();
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
      /* v1302: `_recAus()` hat beim Zeigen der Startkarte auch die Spalte
         und das Grid abgeräumt — beides muss hier zurück. Ein Ausblenden
         ohne passendes Einblenden ist keine halbe Lösung, sondern eine
         neue Falle: gemessen war nach diesem Klick die ganze Aufnahme
         unsichtbar. */
      _recAn();
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
    /* v1290: Der Kopf sagt jetzt, welcher Weg laeuft. Bis hierher stand
       ueber dem gefuehrten Dialog „FREI EINSPRECHEN · Sprachaufzeichnung"
       — der Titel des ANDEREN Weges (design/mockups/sprechlauf2.png). */
    _rfKopfSetzen('CO-PILOT · GEFÜHRTE AUFNAHME', 'Objekt aufnehmen',
      'Ich frage der Reihe nach und rechne unterwegs mit. Antworten kannst du sprechen oder tippen — ' +
      '„Weiß ich nicht" überspringt, „Fertig" bringt dich jederzeit zur Übersicht.');
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
        /* v1300b: die Spalte steht von Anfang an da — mit dem, was aus dem
           Formular schon bekannt ist. Erst dadurch sieht man beim Sprechen,
           was noch fehlt, statt es am Ende zu erfahren. */
        _viFrei = {};
        /* v1301: ab jetzt breit — die Aufnahme trägt zwei Spalten. */
        try { document.querySelector('.oabi-ov.vi-mode').classList.add('vi-breit'); } catch (e) {}
        /* v1300c: zweimal — sofort und im nächsten Bild. Beim Messen blieb
           die Spalte leer, obwohl die Funktion fehlerfrei läuft: zu diesem
           Zeitpunkt ist `vi-frei-stand` je nach Startweg noch nicht im DOM.
           Ein `try/catch` verschluckt das lautlos, deshalb der zweite
           Anlauf statt einer stillen Niederlage. */
        try { _freiStandZeichnen(); } catch (e) {}
        setTimeout(function () { try { _freiStandZeichnen(); } catch (e) {} }, 0);
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
    { id:'wirtschaftlicher_uebergang', g:1, label:'Wirtsch. Übergang', kw:['wirtschaftlicher uebergang','nutzen lasten','nutzen und lasten','lastenwechsel','besitzuebergang','uebergang'] },

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
    /* v1300b: dieselben Werte füllen die Spalte „Was schon steht". Sie
       lebt neben dem Orbit und beantwortet, was die Chips nicht können:
       nicht „was wurde gerade erkannt", sondern „was steht insgesamt und
       was fehlt noch". */
    if (!_viFrei) _viFrei = {};
    Object.keys(fields || {}).forEach(function (id) {
      if (fields[id] != null && String(fields[id]).trim() !== '') _viFrei[id] = fields[id];
      var chip = host.querySelector('.vi-chip[data-cid="' + id + '"]');
      if (chip) chip.classList.add('on');
    });
    try { _freiStandZeichnen(); } catch (e) {}
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
          1600 ms lang, seit v1290). Kuerzer waere falsch: zwischen
          „vierhundert" und „neunzig" liegt eine Pause — und zwischen
          „das Objekt steht in" und „Huellhorst" auch.
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
  /* ═══════════════════════════════════════════════════════════════════
     v1290 · DAS FREISPRECHEN, NEU GEBAUT
     ═══════════════════════════════════════════════════════════════════
     Marcels Durchlauf am 10.09.2026 (design/mockups/sprechlauf2.png und
     sprechlauf3.png), drei Befunde in einer Kette:

       1. „Bei der ersten Frage hat er nur die Hälfte aufgenommen."
          Im Bild: „Oh, das Objekt steht in…" — mitten im Satz abgeschnitten.
       2. „Dann wollte ich es nochmal sagen. Er hat mir aber gar nicht mehr
          zugehört."
       3. „Transkription fehlgeschlagen (HTTP 400): Audio file might be
          corrupted or unsupported"

     ── URSACHE 1: DER RINGPUFFER WARF DEN CONTAINER-HEADER WEG ──────────

     `rec.start(500)` liefert Zeitscheiben. **Das erste Stück ist der
     WebM-Header** (EBML, Segment-Info, Track-Definition); alle weiteren
     sind Cluster — reine Fortsetzungen, die für sich genommen keine Datei
     ergeben.

     `_fsRingBegrenzen()` hielt die Größe mit `chunks.slice(-max)` in
     Schranken. Das schneidet die ÄLTESTEN Stücke ab — also nach 40
     Sekunden Lauschen genau den Header. Was danach zusammengesetzt wurde,
     war ein Haufen Cluster ohne Container: **„Audio file might be
     corrupted or unsupported"**, wörtlich.

     Der Riegel aus v1285 war richtig gedacht und an genau einer Stelle
     falsch: der Kopf ist kein Ballast, er ist die Datei.

     ── URSACHE 2: `_fsHoeren()` LEERTE DEN PUFFER MITTEN IM STROM ───────

     14 Stellen im Code rufen `_fsHoeren()` auf. Jede setzte `chunks = []`
     und startete den Recorder, falls er inaktiv war. Kamen zwei Aufrufe
     kurz hintereinander — nach einer Rückfrage, nach einer beantworteten
     Zwischenfrage, nach einem Abruf —, wurde der Puffer geleert, WÄHREND
     der Recorder lief. Der Header war damit weg, obwohl der Ring gar nicht
     gegriffen hatte. Zweiter Weg in denselben Fehler.

     ── URSACHE 3: 1,1 SEKUNDEN SIND KEINE DENKPAUSE ────────────────────

     v1286 hat die Stillepause von 1,4 auf 1,1 s gesenkt, um Zeit zu
     sparen. Bei „Oh, das Objekt steht in… ähm…" ist das zu wenig. Der
     Satz ging weg, bevor er zu Ende war.

     ── DIE NEUE MECHANIK ───────────────────────────────────────────────

     DER RECORDER LÄUFT DURCH. Einmal gestartet, bis der Dialog endet. Kein
     stop/start-Zyklus mehr — jeder davon ist eine Gelegenheit, den Header
     zu verlieren.

       _fs.kopf     das erste Stück, für immer aufgehoben
       _fs.chunks   der laufende Abschnitt (Ring, ohne den Kopf)

     Ein Abschnitt wird mit `requestData()` geschnitten, nicht mit `stop()`.
     Der Blob ist `[kopf].concat(chunks)` — immer eine vollständige Datei.

     DAMIT KOMMT DER NACHSCHLAG GESCHENKT. Weil das Mikrofon nach dem
     Absenden weiterläuft, kann man einfach weiterreden. Genau das ist
     Marcels Wunsch: „notfalls auch, dass man es einfach nochmal sagen
     kann, sodass er da direkt mithört."

     UND EIN ANGEFANGENER SATZ WIRD NICHT AUSGEWERTET, sondern gemerkt.
     Endet das Transkript offen („… steht in", „… und", „… bei"), fragt der
     Co-Pilot nicht nach, sondern sagt „ich höre weiter zu" und hängt den
     nächsten Abschnitt an. Zwei Hälften ergeben einen Satz. */

  var _fs = {
    an: true,        /* Freisprechen eingeschaltet? */
    stream: null, ctx: null, analyser: null, daten: null,
    rec: null,
    kopf: null,      /* v1290: das erste Stueck = Container-Header, NIE wegwerfen */
    chunks: [], uhr: null,
    phase: '',       /* 'ruhe' | 'rauschen' | 'warte' | 'spricht' | 'aus' */
    rausch: 0, schwelle: 0.012, t0: 0, tSprach: 0, tStill: 0, aufnahme: false,
    sprechMs: 0,     /* v1290: wie lange wirklich gesprochen wurde */
    rest: '',        /* v1290: ein angefangener Satz, der auf seine Fortsetzung wartet */
    laeuft: 0        /* v1290: eine Auswertung ist unterwegs */
  };

  /* v1290: 1,6 s statt 1,1 s. Marcels „Oh, das Objekt steht in… ähm…" ist
     eine Denkpause, kein Satzende. Die 0,5 s, die v1286 gespart hat,
     kosten einen halben Satz — das ist der schlechteste Tausch von allen.
     FS_MIN_SPRECH_MS: was kuerzer ist als ein Wort, wird nicht gesendet;
     ein Huesteln erzeugt sonst einen Aufruf und eine Fehlermeldung. */
  var FS_MIN_SCHWELLE = 0.012, FS_SPRACHE_MS = 160, FS_STILLE_MS = 1600,
      FS_RAUSCH_MS = 400, FS_GEDULD_MS = 30000, FS_MAX_MS = 25000,
      FS_MIN_SPRECH_MS = 350;
  var FS_SCHEIBE_MS = 500;      /* Länge eines Stücks */
  var FS_RING_MS = 40000;       /* so weit reicht der Puffer zurück */
  var FS_MAX_BYTES = 8 * 1024 * 1024;   /* was größer ist, geht nicht raus */

  /* Der Ring gilt fuer die CLUSTER, nie fuer den Kopf. */
  function _fsRingBegrenzen() {
    var max = Math.ceil(FS_RING_MS / FS_SCHEIBE_MS);
    if (_fs.chunks.length > max) _fs.chunks = _fs.chunks.slice(-max);
  }

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
    _fs.kopf = null; _fs.chunks = []; _fs.rest = ''; _fs.laeuft = 0;
    _fs.phase = 'aus'; _fs.aufnahme = false;
  }

  /* Einmal öffnen, für den ganzen Dialog — und einmal starten. */
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
      _fs.kopf = null; _fs.chunks = [];
      _fs.rec.ondataavailable = function (ev) {
        if (!ev.data || !ev.data.size) return;
        /* v1290: Das ERSTE Stueck ist der Container-Header. Es wandert
           nicht in den Ring, sondern in `kopf` — und bleibt dort, solange
           der Recorder laeuft. Ohne ihn ist jeder Blob ein Fragment. */
        if (!_fs.kopf) { _fs.kopf = ev.data; return; }
        _fs.chunks.push(ev.data);
        _fsRingBegrenzen();
      };
      try { _fs.rec.start(FS_SCHEIBE_MS); _fs.aufnahme = true; } catch (e) { return false; }
      return true;
    }).catch(function () { return false; });
  }

  /* Für EINE Frage zuhören. Endet von selbst - durch Stille oder Geduld.
     v1290: Der Recorder LAEUFT WEITER; hier beginnt nur ein neuer
     Abschnitt. Wird waehrend eines laufenden Abschnitts noch einmal
     gerufen (14 Aufrufstellen im Code), passiert nichts — sonst ginge
     mitten im Satz der Puffer verloren. */
  function _fsHoeren(neu) {
    if (!_fs.an || !_fs.stream || !_fs.rec) return;
    if (!neu && (_fs.phase === 'warte' || _fs.phase === 'spricht' || _fs.phase === 'rauschen')) return;
    if (_fs.uhr) { clearInterval(_fs.uhr); _fs.uhr = null; }
    _fs.chunks = [];                 /* der KOPF bleibt */
    _fs.phase = 'rauschen'; _fs.rausch = 0; _fs.t0 = Date.now();
    _fs.tSprach = 0; _fs.tStill = 0; _fs.sprechMs = 0;
    var proben = 0, summe = 0;
    /* Sollte der Recorder wider Erwarten stehen, wieder anwerfen — dann
       liefert er auch einen frischen Kopf. */
    try {
      if (_fs.rec.state === 'inactive') { _fs.kopf = null; _fs.rec.start(FS_SCHEIBE_MS); _fs.aufnahme = true; }
    } catch (e) { return; }
    _fsMikroKasten(true,
      _fs.rest ? 'Ich höre weiter zu — sag den Rest.' : 'Ich höre zu — sprich einfach los.',
      _fs.rest ? 'Deinen Satzanfang habe ich mir gemerkt.' : 'Ich merke selbst, wenn du fertig bist.');

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
            _fsMikroKasten(true, 'Ich höre dich …', 'Sprich in Ruhe zu Ende — ich warte auf die Pause.'); }
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
        } else { _fs.tStill = 0; _fs.sprechMs += 80; }
        /* Notbremse: eine Antwort auf eine gezielte Frage ist kurz. */
        if (jetzt - _fs.t0 > FS_MAX_MS) { _fsAbschnittFertig(); }
      }
    }, 80);
  }

  function _fsStopHoeren() {
    if (_fs.uhr) { clearInterval(_fs.uhr); _fs.uhr = null; }
    _fs.phase = '';
    /* v1290: Der Recorder wird NICHT gestoppt — er laeuft durch, und der
       Kopf bleibt gueltig. Nur der laufende Abschnitt wird verworfen. */
    _fs.chunks = [];
  }

  /* Spricht der Nutzer gerade? Dann darf die naechste Frage warten. */
  function _fsSprichtGerade() { return _fs.an && (_fs.phase === 'spricht'); }

  /* v1290 · Endet der Satz offen, ist er nicht zu Ende.
     „Oh, das Objekt steht in" — da kommt noch was. Ein Co-Pilot, der
     darauf mit „daraus konnte ich nichts entnehmen" antwortet, hat recht
     und hilft trotzdem nicht. */
  var FS_OFFEN_ENDE = new RegExp(
    '\\b(' +
    'in|im|an|am|auf|bei|beim|von|vom|zu|zum|zur|mit|nach|ueber|über|unter|fuer|für|' +
    'und|oder|aber|dass|weil|wenn|also|dann|noch|etwa|circa|ca|rund|' +
    'der|die|das|den|dem|des|ein|eine|einen|einem|einer|' +
    'ist|sind|war|waren|hat|habe|haben|wird|werden|steht|liegt|kostet|betraegt|beträgt|' +
    'ungefaehr|ungefähr|so|ganz|sehr|mehr|weniger|etwas' +
    ')\\s*$', 'i');
  function _fsOffenesEnde(t) {
    var s = String(t || '').trim().replace(/[.,;!?…]+$/, '').trim();
    if (!s) return false;
    if (s.split(/\s+/).length < 2) return false;   /* ein Wort ist eine Antwort */
    return FS_OFFEN_ENDE.test(s);
  }

  function _fsAbschnittFertig() {
    if (_fs.uhr) { clearInterval(_fs.uhr); _fs.uhr = null; }
    _fs.phase = '';
    if (!_fs.rec || _fs.rec.state !== 'recording') return;
    /* v1290: Was kuerzer ist als ein Wort, war ein Geraeusch. Kein Aufruf,
       keine Fehlermeldung, einfach weiter zuhoeren. */
    if (_fs.sprechMs < FS_MIN_SPRECH_MS) { _fsHoeren(true); return; }
    var eintrag = _rf && _rf.offen[_rf.i];

    /* v1290: Geschnitten wird mit requestData(), NICHT mit stop(). Der
       Recorder laeuft weiter — damit bleibt der Kopf gueltig und der
       Nutzer kann sofort nachschieben. */
    var fertig = function () {
      var stuecke = _fs.kopf ? [_fs.kopf].concat(_fs.chunks) : _fs.chunks.slice();
      var blob = new Blob(stuecke, { type: (_fs.rec && _fs.rec.mimeType) || 'audio/webm' });
      _fs.chunks = [];
      /* Sofort wieder lauschen: wer nachschieben will, soll nicht warten. */
      _fsHoeren(true);
      if (!_rf || !eintrag || _rf.offen[_rf.i] !== eintrag) return;
      if (blob && blob.size > FS_MAX_BYTES) {
        try { console.warn('[voice] Abschnitt zu gross:', blob.size, 'Bytes - verworfen'); } catch (e) {}
        _rfBlase('co', 'Das war zu lang für eine Antwort — sag es bitte kürzer.');
        return;
      }
      if (!blob || blob.size < 1200) {   /* nichts Verwertbares im Puffer */
        try { console.warn('[voice] Abschnitt zu klein:', blob && blob.size); } catch (e) {}
        return;
      }
      _fs.laeuft++;
      _rfMelden('', true);
      blobToB64(blob).then(function (b64) {
        return Auth.apiCall('/ai/extract-voice', {
          method: 'POST',
          body: { audio: b64, mime: blob.type, catalog: _rfKatalog(eintrag, _rf.catalog), kontext: _rfKontext() }
        });
      }).then(function (r) {
        _fs.laeuft--;
        if (!_rf || _rf.offen[_rf.i] !== eintrag) return;
        var txt = (r && r.transcript) ? String(r.transcript).trim() : '';
        /* v1290: Der gemerkte Satzanfang wird vorangestellt. */
        if (_fs.rest) { txt = (_fs.rest + ' ' + txt).replace(/\s+/g, ' ').trim(); _fs.rest = ''; }
        if (txt) {
          try { console.log('[voice-import] Freisprech-Antwort:', txt); } catch (x) {}
          _rfDenkt(false);
          /* ═══ v1306 · Warten hat eine Grenze ═══════════════════════════
             Marcels Bild `design/mockups/sanierung.png`: zweimal
             hintereinander nur „Ich höre weiter zu — sag den Rest." Der
             Satz endete jedes Mal so, dass `_fsOffenesEnde` ihn für
             angefangen hielt — und es gab keine Obergrenze. Wer in diese
             Schleife gerät, kommt allein nicht mehr heraus: jeder
             Nachschlag verlängert den Satz und endet wieder offen.

             Zweimal warten ist Geduld, dreimal ist Sturheit. Nach dem
             zweiten Nachschub wird ausgewertet, wie der Satz auch endet —
             im Zweifel versteht das Modell einen Satz zu viel, und das
             ist allemal besser, als den Sprecher hängen zu lassen. */
          if (_fsOffenesEnde(txt) && (_fs.warten || 0) < 2) {
            _fs.warten = (_fs.warten || 0) + 1;
            _fs.rest = txt;
            _rfBlase('ich', escH(txt) + ' <span style="opacity:.5">…</span>');
            _rfBlase('co', '<span style="opacity:.75">Ich höre weiter zu — sag den Rest.</span>');
            _fsHoeren(true);
            return;
          }
          _fs.warten = 0;
          if (_rfVorabErkennen(txt, true)) return;
          _rfBlase('ich', escH(txt));   /* v1276c: was verstanden wurde, steht da */
        }
        _rfUebernehmen(r && r.fields, true, txt);
      }).catch(function (err) {
        _fs.laeuft--;
        _rfDenkt(false);
        _rfBlase('co', _fsFehlerText(err));
        _fsHoeren(true);
      });
    };
    try {
      _fs.rec.onstop = null;
      var einmal = false;
      var alt = _fs.rec.ondataavailable;
      _fs.rec.ondataavailable = function (ev) {
        alt(ev);
        if (einmal) return;
        einmal = true;
        _fs.rec.ondataavailable = alt;
        setTimeout(fertig, 0);
      };
      _fs.rec.requestData();
    } catch (e) { fertig(); }
  }

  /* v1290 · Eine rohe API-Antwort gehoert nicht in einen Chat.
     Im Bild sprechlauf3.png steht woertlich:
       „Transkription fehlgeschlagen (HTTP 400): { "error": { "message":
        "Audio file might be corrupted or unsupported", "type":
        "invalid_request_error", "param": "file", ... } }"
     Das ist ein Protokolleintrag, keine Auskunft. Der Nutzer erfaehrt
     daraus nicht, was er tun soll — und dass er es einfach nochmal sagen
     kann, steht nirgends. Die Einzelheiten bleiben in der Konsole. */
  function _fsFehlerText(err) {
    var roh = (err && (err.message || err.error)) || '';
    try { console.warn('[voice] Freisprechen:', roh, err); } catch (e) {}
    if (/corrupt|unsupported|invalid_value|invalid_request/i.test(roh)) {
      return 'Die Aufnahme kam nicht sauber an — <b>sag es einfach nochmal</b>, ich höre schon zu.';
    }
    if (/timeout|nicht erreichbar|network/i.test(roh)) {
      return 'Die Verbindung hat gehakt — <b>sag es nochmal</b>, ich höre zu.';
    }
    if (/413|zu lang|zu gross|zu groß/i.test(roh)) {
      return 'Das war zu lang für eine Antwort — sag es bitte kürzer.';
    }
    return 'Das habe ich nicht verstanden — <b>sag es nochmal</b> oder tippe es.';
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
  /* ═══ v1286 · Zwei, drei Stichwörter auf einmal ════════════════════════
     Marcels Wunsch: „Baujahr und Kaufpreis, sowas könnte man jetzt auch
     zusammen abfragen, sodass man immer so zwei, drei Keywords gleichzeitig
     abfragt."

     Aus 13 Blöcken werden 10. Zusammengelegt wird, was man in EINEM Satz
     sagt: „Baujahr 1965, kostet 200.000" ist ein Satz, keine zwei Fragen.
     Objektart wandert zur Größe („Was für ein Objekt, wie groß?").

     ZWEI ORDNUNGEN, ein Grund: der geführte Weg fragt in der Reihenfolge,
     in der ein Mensch erzählt. Die Rückfragen nach einem freien Diktat
     sortieren nach `rang` — dort zählt das Gewicht für die Rechnung, weil
     nur drei Fragen gestellt werden. */
  /* ═══════════════════════════════════════════════════════════════════
     v1288 · DIE ETAPPEN — aus einer Fragenliste wird ein Sprechlauf
     ═══════════════════════════════════════════════════════════════════
     Marcels Plan vom 10.09.2026: „Im Sprachlauf könnte erst mal sein, dass
     wir die Standardfelder abfragen, dass wir dann einen Deal-Score
     bekommen und einen Deal-Score 2 … dass wir im Deal-Score schon mal
     sagen: okay, wohin geht die Reise, lohnt sich das, lohnt sich das
     nicht."

     Bis v1287 war der Dialog EINE flache Liste: elf Fragen, danach die
     Tabelle. Wer bei Frage 7 war, wusste nicht, wozu die Fragen 1-6 gut
     waren — es gab kein Zwischenergebnis, nur ein Ende.

     JETZT: fünf Etappen mit einem Halt dazwischen. Jeder Halt ist ein
     Ergebnis, das ohne die nächste Etappe schon etwas wert ist:

       1 Basis          Adresse, Objekt, Preis, Miete
       2 Geld           Finanzierung, Kaufnebenkosten   -> DEAL SCORE
       3 Lage & Zustand Lage, Zustand, Grundstück       -> DEAL SCORE 2
       4 Feinschliff    Bewirtschaftung, Entwicklung, Steuer
       5 Deine Sicht    These, Risiken
       6 Feinheiten     alle übrigen Felder (nur auf Wunsch)

     WARUM DIE REIHENFOLGE SO IST: der Deal Score braucht Kaufpreis,
     Miete, Nebenkosten und Finanzierung — mehr nicht. Das ist genau
     Etappe 1 + 2. Der Deal Score 2 braucht zusätzlich Lage, Zustand und
     Energie — Etappe 3. Alles danach verfeinert, entscheidet aber nichts
     mehr. Wer nach Etappe 2 abbricht, hat trotzdem eine Antwort auf
     „lohnt sich das".

     `et` ist die Etappe, `rang` bleibt das Gewicht für die Rechnung.
     ZWEI ORDNUNGEN, ein Grund (seit v1286): der geführte Weg fragt nach
     Etappe und Erzähl-Logik, die Rückfragen nach einem freien Diktat
     sortieren nach `rang` — dort zählt das Gewicht, weil nur drei Fragen
     gestellt werden. */
  var ETAPPEN = [
    { nr: 1, name: 'Basis',          ziel: 'Objekt, Preis und Miete' },
    { nr: 2, name: 'Geld',           ziel: 'Finanzierung und Kaufnebenkosten' },
    { nr: 3, name: 'Lage & Zustand', ziel: 'wo es steht und wie es dasteht' },
    { nr: 4, name: 'Feinschliff',    ziel: 'Bewirtschaftung, Entwicklung, Steuer' },
    { nr: 5, name: 'Deine Sicht',    ziel: 'These und Risiken' },
    { nr: 6, name: 'Feinheiten',     ziel: 'alle übrigen Felder' }
  ];

  var RFRAGEN = [
    /* ── Etappe 1 · Basis ─────────────────────────────────────────────
       Was jede Rechnung braucht. Ohne diese vier Blöcke gibt es keinen
       Score, keine Marktpreisindikation und keinen Bodenrichtwert. */
    { et: 1, ids: ['plz', 'ort', 'str', 'hnr'],     rang: 5,
      frage: 'Wo steht das Objekt? Straße, Hausnummer, PLZ und Ort.' },
    { et: 1, ids: ['objart', 'wfl', 'zimmer'],      rang: 3,
      frage: 'Was für ein Objekt ist es, und wie groß? Art, Wohnfläche, Zimmer.' },
    { et: 1, ids: ['baujahr', 'kp'],                rang: 1,
      frage: 'Baujahr und Kaufpreis?' },
    { et: 1, ids: ['nkm', 'ze'],                    rang: 2,
      frage: 'Was kommt monatlich rein? Kaltmiete und Zusatzeinnahmen wie Stellplatz.' },

    /* ── Etappe 2 · Geld ──────────────────────────────────────────────
       v1288: Die Kaufnebenkosten sind NEU im Dialog. Marcels Wort:
       „natürlich musst du auch Nebenkosten, natürlich musst du
       nachfragen. Wir können auch die Standards nehmen, da kann auch
       erst mal nach den Einstellungen fragen. Ansonsten kann man aber
       auch sagen 10 Prozent vom Kaufpreis oder Sonstiges."
       Bis v1287 rechnete der Zwischenstand still mit einer Vorbelegung,
       die niemand bestätigt hat — genau der Fehler aus v1273c, nur eine
       Etage tiefer. */
    { et: 2, ids: ['ek', 'd1z', 'd1t', 'd1_bindj'], rang: 4, vorbelegt: 1, profil: 'finanzierung',
      frage: 'Wie finanzierst du? Eigenkapital, Zinssatz, Tilgung und Zinsbindung.' },
    { et: 2, ids: ['makler_p', 'notar_p', 'gba_p', 'gest_p'], rang: 6, vorbelegt: 1, profil: 'nebenkosten',
      frage: 'Die Kaufnebenkosten — Makler, Notar, Grundbuch und Grunderwerbsteuer, jeweils in Prozent vom Kaufpreis.' },

    /* ── Etappe 3 · Lage & Zustand ────────────────────────────────────
       Was der Deal Score 2 zusätzlich braucht. `skalen` heisst: die
       Stufen stehen IN der Frage — wir bewerten danach, also soll der
       Nutzer sie kennen, statt Freitext zu raten (v1288, Backlog-Punkt 2).
       `abruf` heisst: das kann der Co-Pilot selbst holen. */
    { et: 3, ids: ['makrolage', 'mikrolage'],       rang: 12, skalen: 1, abruf: 'lage',
      frage: 'Wie schätzt du die Lage ein — erst die Region, dann die Straße?' },
    { et: 3, ids: ['ds2_zustand', 'ds2_energie'],   rang: 12, skalen: 1,
      frage: 'Wie ist der Zustand der Wohnung, und was steht im Energieausweis?' },
    { et: 3, ids: ['san', 'moebl'],                 rang: 9,
      frage: 'Muss etwas saniert werden, und wird etwas mitverkauft — Küche, Möbel?' },
    { et: 3, ids: ['brw', 'gsfl', 'mea'],           rang: 11, abruf: 'brw',
      frage: 'Was weißt du zum Grundstück — Bodenrichtwert, Fläche, Miteigentumsanteil?' },

    /* ── Etappe 4 · Feinschliff ───────────────────────────────────────
       Verfeinert die Rechnung, entscheidet aber nichts mehr. */
    { et: 4, ids: ['hg_ul', 'hg_nul'],              rang: 8, vorbelegt: 1, profil: 'bewirtschaftung',
      frage: 'Wie hoch ist das Hausgeld pro Jahr, und wie viel davon ist nicht umlagefähig?' },
    { et: 4, ids: ['mietstg', 'wertstg', 'leerstand'], rang: 14, vorbelegt: 1,
      frage: 'Womit rechnest du langfristig — Mietsteigerung, Wertsteigerung und Leerstand in Prozent?' },
    { et: 4, ids: ['ds2_bevoelkerung', 'ds2_nachfrage', 'ds2_wertsteigerung', 'ds2_entwicklung'],
      rang: 15, skalen: 1,
      frage: 'Wie entwickelt sich der Ort — Bevölkerung, Nachfrage, Wertsteigerung, Entwicklungsmöglichkeiten?' },
    { et: 4, ids: ['kaufdat', 'wirtschaftlicher_uebergang'], rang: 10,
      frage: 'Wann wird gekauft, und ab wann gehören dir Mieten und Kosten?' },
    { et: 4, ids: ['afa_satz', 'geb_ant', 'grenz'], rang: 16, vorbelegt: 1, profil: 'steuer',
      frage: 'Zur Steuer — AfA-Satz, Gebäudeanteil und dein Grenzsteuersatz.' },

    /* ── Etappe 5 · Deine Sicht ───────────────────────────────────── */
    { et: 5, ids: ['thesis', 'risiken', 'notizen'], rang: 13,
      frage: 'Warum lohnt sich das Objekt für dich, was könnte schiefgehen, und was ist sonst wichtig?' }
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

  /* v1288 · Zahlen aus dem Investmentprofil, tolerant gelesen.
     `P.get` liefert den eigenen Wert oder die Vorgabe aus
     DealPilotConfig.investmentProfileDefaults. Was dort nicht als Zahl
     ankommt, wird hier zu null — NICHT zu 0. `Number(null)` ist 0 und
     besteht `Number.isFinite`; ein Nebenkostensatz von 0 % saehe aus wie
     eine Angabe und waere eine Luecke (FALLEN.md). */
  function _profilZahl(schluessel) {
    try {
      var P = window.DealPilotInvestmentProfile;
      if (!P || typeof P.get !== 'function') return null;
      var v = P.get(schluessel);
      if (v === null || v === undefined || v === '') return null;
      var n = parseFloat(String(v).replace(',', '.'));
      return isFinite(n) ? n : null;
    } catch (e) { return null; }
  }

  /* Eine deutsche Zahl aus einem Feld- oder Sprachwert. Gibt null zurueck,
     wenn nichts dasteht — nie 0. */
  function _rfNum(v) {
    if (v === undefined || v === null) return null;
    var s = String(v).trim();
    if (!s) return null;
    s = s.replace(/[^\d,.\-]/g, '');
    if (!s || s === '-' || s === '.' || s === ',') return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  /* Ein Feldwert aus dem Gespraech, sonst aus dem Formular. */
  function _rfFeld(id) {
    var v = (_rf && _rf.data && _rf.data.fields) ? _rf.data.fields[id] : undefined;
    if (v === undefined || v === null || v === '') {
      var el = document.getElementById(id);
      v = el ? String(el.value || '').trim() : '';
    }
    return (v === '' || v === null || v === undefined) ? null : v;
  }

  function _rfKp() { return _rfNum(_rfFeld('kp')); }

  function _euroKurz(n) {
    if (n == null || !isFinite(n)) return '–';
    try { return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' €'; }
    catch (e) { return Math.round(n) + ' €'; }
  }

  /* ═══ v1280/v1288 · „Oder soll ich die aus deinen Einstellungen nehmen?"
     Marcels Wunsch war zuerst die Finanzierung, mit v1288 kommen die
     Kaufnebenkosten, die Bewirtschaftung und die Steuer dazu:

       „Also natuerlich musst du auch Nebenkosten, natuerlich musst du
        nachfragen. Wir koennen auch die Standards nehmen, da kann auch
        erst mal nach den Einstellungen fragen. Ansonsten kann man aber
        auch sagen 10 Prozent vom Kaufpreis oder Sonstiges."

     Die Werte liegen laengst bereit:
       DealPilotInvestmentProfile.get('tilgung_default' | 'zinsbindung_default'
         | 'ek_quote_default' | 'notar_grundbuch' | 'maklerkosten'
         | 'bwk_ul_pct_default' | 'bwk_anteil_default' | 'grenzsteuersatz')
       DealPilotInvestmentProfile.getZins()  — der EFFEKTIVE Zins: eigener
         Wert, sonst der indikative Pfandbrief-Satz zur eingestellten
         Zinsbindung samt Marge (window.dpGetIndicativeZins)
       DealPilotGrest.forPlz(plz)            — der AMTLICHE Satz des
         Bundeslands zur Postleitzahl, ohne Netz und ohne Kosten

     Der Unterschied zu v1273c ist wichtig: dort ging es um Werte, die schon
     IM FELD stehen. Hier geht es um Werte, die in den EINSTELLUNGEN stehen
     und noch nirgends eingetragen sind. Beides wird angeboten, nie
     stillschweigend genommen — der Knopf sagt, was er eintraegt.

     Das Eigenkapital kommt aus der EK-Quote mal Kaufpreis: eine Quote ohne
     Kaufpreis ist keine Zahl, deshalb erscheint es nur, wenn der Kaufpreis
     schon steht. Dasselbe gilt fuer die Nebenkosten in Euro. */
  function _rfProfilVorschlag(eintrag) {
    if (!eintrag || !eintrag.profil) return null;
    var P = window.DealPilotInvestmentProfile;
    if (!P || typeof P.get !== 'function') return null;
    try {
      if (eintrag.profil === 'finanzierung')    return _pvFinanzierung(P);
      if (eintrag.profil === 'nebenkosten')     return _pvNebenkosten();
      if (eintrag.profil === 'bewirtschaftung') return _pvBewirtschaftung();
      if (eintrag.profil === 'steuer')          return _pvSteuer();
    } catch (e) { return null; }
    return null;
  }

  function _pvFinanzierung(P) {
    var w = {}, teile = [];
    var zins = (typeof P.getZins === 'function') ? P.getZins() : null;
    if (typeof zins === 'number' && isFinite(zins) && zins > 0) {
      w.d1z = String(zins).replace('.', ',');
      teile.push(w.d1z + ' % Zins');
    }
    var tilg = _profilZahl('tilgung_default');
    if (tilg != null) { w.d1t = String(tilg).replace('.', ','); teile.push(w.d1t + ' % Tilgung'); }
    var bind = _profilZahl('zinsbindung_default');
    if (bind != null) { w.d1_bindj = String(bind); teile.push(bind + ' Jahre fest'); }
    var qu = _profilZahl('ek_quote_default'), kp = _rfKp();
    if (qu != null && kp != null && kp > 0) {
      w.ek = String(Math.round(kp * qu / 100));
      teile.push(qu + ' % Eigenkapital');
    }
    if (!teile.length) return null;
    return { werte: w, text: teile.join(' · ') };
  }

  /* Die Grunderwerbsteuer kommt NICHT aus dem Profil, sondern aus der
     Postleitzahl: sie ist Landesrecht, kein Geschmack. Steht keine PLZ,
     bleibt das Feld offen statt auf einer 6,5-%-Vorbelegung zu sitzen,
     die in acht Bundeslaendern falsch ist. */
  function _pvNebenkosten() {
    var w = {}, teile = [];
    var mak = _profilZahl('maklerkosten');
    if (mak != null) { w.makler_p = String(mak).replace('.', ','); teile.push(w.makler_p + ' % Makler'); }
    /* notar_grundbuch ist EIN Satz fuer beides. Aufgeteilt wird nach der
       Vorbelegung des Formulars: 0,5 % Grundbuchamt, der Rest Notar. */
    var ng = _profilZahl('notar_grundbuch');
    if (ng != null) {
      var gba = Math.min(0.5, ng), notar = Math.round((ng - gba) * 100) / 100;
      w.gba_p = String(gba).replace('.', ',');
      w.notar_p = String(notar).replace('.', ',');
      teile.push(w.notar_p + ' % Notar', w.gba_p + ' % Grundbuch');
    }
    var g = _rfGrest();
    if (g) { w.gest_p = String(g.rate).replace('.', ','); teile.push(w.gest_p + ' % Grunderwerbsteuer (' + g.name + ')'); }
    if (!teile.length) return null;
    var kp = _rfKp(), summe = 0;
    Object.keys(w).forEach(function (id) { summe += (_rfNum(w[id]) || 0); });
    var text = teile.join(' · ');
    if (kp != null && kp > 0 && summe > 0) {
      text += ' — zusammen ' + _euroKurz(kp * summe / 100) +
              ' (' + String(Math.round(summe * 100) / 100).replace('.', ',') + ' %)';
    }
    return { werte: w, text: text };
  }

  /* Der amtliche Grunderwerbsteuersatz zur Postleitzahl. Ohne Netz,
     ohne Kosten, ohne KI — DealPilotGrest fuehrt die 16 Saetze (V226). */
  function _rfGrest() {
    try {
      var plz = _rfFeld('plz');
      if (!plz) return null;
      plz = String(plz).trim();
      if (!/^\d{5}$/.test(plz)) return null;
      if (!window.DealPilotGrest || typeof window.DealPilotGrest.forPlz !== 'function') return null;
      return window.DealPilotGrest.forPlz(plz);
    } catch (e) { return null; }
  }

  /* Hausgeld als Quote der Jahres-Kaltmiete — so steht es in den
     Einstellungen (bwk_ul_pct_default / bwk_anteil_default, % der NKM).
     Ohne Miete keine Zahl. */
  function _pvBewirtschaftung() {
    var nkm = _rfNum(_rfFeld('nkm'));
    if (nkm == null || nkm <= 0) return null;
    var ul = _profilZahl('bwk_ul_pct_default'), nul = _profilZahl('bwk_anteil_default');
    var w = {}, teile = [];
    if (ul != null)  { w.hg_ul  = String(Math.round(nkm * 12 * ul / 100));  teile.push(_euroKurz(_rfNum(w.hg_ul)) + ' umlagefähig'); }
    if (nul != null) { w.hg_nul = String(Math.round(nkm * 12 * nul / 100)); teile.push(_euroKurz(_rfNum(w.hg_nul)) + ' nicht umlagefähig'); }
    if (!teile.length) return null;
    return { werte: w, text: teile.join(' · ') + ' pro Jahr (' + (ul || 0) + ' / ' + (nul || 0) + ' % der Kaltmiete)' };
  }

  function _pvSteuer() {
    var w = {}, teile = [];
    var gr = _profilZahl('grenzsteuersatz');
    if (gr != null) { w.grenz = String(gr).replace('.', ','); teile.push(w.grenz + ' % Grenzsteuersatz'); }
    /* AfA-Satz nach Baujahr: 2 % ab 1925, 2,5 % davor (§ 7 Abs. 4 EStG).
       Das ist Gesetz, keine Einstellung — deshalb wird es nur dann
       vorgeschlagen, wenn das Baujahr auch wirklich bekannt ist. */
    var bj = _rfNum(_rfFeld('baujahr'));
    if (bj != null && bj > 1500 && bj < 2200) {
      w.afa_satz = (bj < 1925) ? '2,5' : '2';
      teile.push(w.afa_satz + ' % AfA (Baujahr ' + bj + ')');
    }
    if (!teile.length) return null;
    return { werte: w, text: teile.join(' · ') };
  }

  /* Derselbe Wert, nur lesbar. "3.5" ist eine Zahl aus einem Eingabefeld,
     "3,5 %" ist eine Angabe. */
  function _rfLesbar(wert, eintrag) {
    var v = String(wert).replace('.', ',');
    var kat = (_rf && _rf.catalog || []).filter(function (c) { return c.id === eintrag.ids[0]; })[0];
    if (kat && /%/.test(kat.label || '') && !/%/.test(v)) v += ' %';
    return v;
  }

  /* Mini-Katalog: nur die gefragten Felder. Das ist der halbe
     Kostenvorteil - der volle Katalog traegt ueber 6000 Token. */
  /* ═══ v1288b · Der Co-Pilot bekommt seinen Kontext in KLARTEXT ════════
     Gemessen am 10.09.2026: auf die Frage „Warum ist der Cashflow so
     negativ?" antwortete er unter anderem „fuer eine saubere Erklaerung
     fehlt mir aber noch der Zinssatz, die Tilgung" — beides stand seit
     zwei Fragen im Gespraech (4,09 % und 1 %).

     Die Werte WAREN im Kontext, aber als `d1z = 4,09` und `d1t = 1`.
     Das sind unsere internen Feldnamen, keine Sprache. Ein Modell, das
     „d1z" nicht als Zinssatz erkennt, haelt den Zinssatz fuer unbekannt —
     und benennt die Luecke dann korrekt, nur eben faelschlich.

     ZWEI KONTEXTE, ZWEI ZWECKE, und der Unterschied ist wichtig:

       `_rfKontext()`      geht an /ai/extract-text. Dort MUESSEN es die
                           Feld-ids sein: der Prompt rechnet mit ihnen
                           („10 Prozent vom Kaufpreis" bei kp=200000).
                           Bleibt unveraendert.
       `_rfKontextKlar()`  geht an /ai/copilot-frage. Dort spricht jemand
                           mit einem Menschen. Bezeichnung statt id, dazu
                           die abgeleiteten Groessen, die im Formular gar
                           nicht stehen: Score, Cashflow, Rendite, DSCR,
                           Marktwert — genau die Zahlen, nach denen
                           gefragt wird.

     Erfunden wird dabei nichts: alles kommt aus derselben Rechnung, die
     auch die Score-Karte zeigt. Was sich nicht rechnen laesst, fehlt. */
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

  /* Alles, was gerade bekannt ist — mit Namen, die ein Mensch versteht. */
  var KLAR_NAME = {
    plz: 'Postleitzahl', ort: 'Ort', str: 'Straße', hnr: 'Hausnummer',
    objart: 'Objektart', wfl: 'Wohnfläche (m²)', zimmer: 'Zimmer', baujahr: 'Baujahr',
    kp: 'Kaufpreis (€)', nkm: 'Nettokaltmiete (€/Monat)', ze: 'Zusatzeinnahmen (€/Monat)',
    ek: 'Eigenkapital (€)', d1z: 'Sollzins (% p.a.)', d1t: 'Anfangstilgung (% p.a.)',
    d1_bindj: 'Zinsbindung (Jahre)',
    makler_p: 'Maklerprovision (%)', notar_p: 'Notarkosten (%)',
    gba_p: 'Grundbuchamt (%)', gest_p: 'Grunderwerbsteuer (%)', ji_p: 'Sonstige Kaufnebenkosten (%)',
    hg_ul: 'Hausgeld umlagefähig (€/Jahr)', hg_nul: 'Hausgeld nicht umlagefähig (€/Jahr)',
    brw: 'Bodenrichtwert (€/m²)', gsfl: 'Grundstücksfläche (m²)', mea: 'Miteigentumsanteil',
    san: 'Sanierungskosten (€)', moebl: 'Möblierung (€)',
    makrolage: 'Makrolage', mikrolage: 'Mikrolage', ds2_zustand: 'Zustand',
    ds2_energie: 'Energieklasse', ds2_marktmiete: 'Marktmiete (€/m²)',
    ds2_bevoelkerung: 'Bevölkerungsentwicklung', ds2_nachfrage: 'Nachfrage',
    ds2_wertsteigerung: 'Wertsteigerungserwartung', ds2_entwicklung: 'Entwicklungsmöglichkeiten',
    mietstg: 'Mietsteigerung (% p.a.)', wertstg: 'Wertsteigerung (% p.a.)',
    leerstand: 'Leerstand (%)', afa_satz: 'AfA-Satz (%)', geb_ant: 'Gebäudeanteil (%)',
    grenz: 'Grenzsteuersatz (%)', svwert: 'Marktwert / Verkehrswert (€)',
    kaufdat: 'Kaufdatum', wirtschaftlicher_uebergang: 'Wirtschaftlicher Übergang',
    thesis: 'Investitionsthese', risiken: 'Bekannte Risiken', notizen: 'Notizen'
  };

  function _rfKontextKlar() {
    var k = {};
    try {
      var f = (_rf && _rf.data && _rf.data.fields) || {};
      Object.keys(f).forEach(function (id) {
        var v = f[id];
        if (v === '' || v === null || v === undefined) return;
        var name = KLAR_NAME[id];
        if (!name) {
          var kat = (_rf.catalog || []).filter(function (c) { return c.id === id; })[0];
          name = kat ? String(kat.label) : id;
        }
        var q = (_rf.quelle || {})[id];
        k[name] = String(v) + (q ? '  [Quelle: ' + q + ']' : '');
      });
      /* Die abgeleiteten Groessen — sie stehen in keinem Feld, aber genau
         nach ihnen wird gefragt. Dieselbe Rechnung wie auf der Karte. */
      var Z = null;
      try { Z = _rfKennzahlen(); } catch (e) {}
      if (Z && Z.K) {
        var K = Z.K;
        k['Gesamtinvestition (€)']       = Math.round(Z.gi);
        k['Kaufnebenkosten (€)']         = Math.round(Z.nkEur) + ' (' + _pz(Z.nk.pct) + ' %, ' + Z.nk.quelle + ')';
        k['Darlehen (€)']                = Math.round(Z.d1) + ' (angenommen: Gesamtinvestition minus Eigenkapital)';
        if (K.cf_m   != null) k['Cashflow vor Steuer (€/Monat)'] = Math.round(K.cf_m);
        if (K.cf_ns_m!= null) k['Cashflow nach Steuer (€/Monat)'] = Math.round(K.cf_ns_m);
        if (K.bmy    != null) k['Bruttomietrendite (%)'] = Math.round(K.bmy * 100) / 100;
        if (K.nmy    != null) k['Nettomietrendite (%)']  = Math.round(K.nmy * 100) / 100;
        if (K.fak    != null) k['Kaufpreisfaktor']       = Math.round(K.fak * 10) / 10;
        if (K.ltv    != null) k['LTV (%)']               = Math.round(K.ltv * 10) / 10;
        if (K.dscr   != null) k['DSCR']                  = Math.round(K.dscr * 100) / 100;
        if (K.rate_j != null) k['Kapitaldienst (€/Jahr)'] = Math.round(K.rate_j);
        if (K.bwk    != null) k['Bewirtschaftungskosten (€/Jahr)'] = Math.round(K.bwk);
      }
      try {
        var s1 = _rfScore1();
        if (s1) k['Deal Score (0-100)'] = s1.S.score + ' — ' + _stufe(s1.S.score).kamel;
        var s2 = _rfScore2();
        if (s2) k['Investor Deal Score 2.0 (0-100)'] = Math.round(s2.R.score) + ' — ' + _stufe(s2.R.score).kamel;
      } catch (e) {}
      if (_rf && _rf.markt && _rf.markt.mw != null) {
        k['Marktpreisindikation Marktwert (€)'] = Math.round(_rf.markt.mw);
        if (_rf.markt.sqm) k['Marktpreisindikation (€/m²)'] = Math.round(_rf.markt.sqm);
      }
    } catch (e) {}
    return Object.keys(k).length ? k : null;
  }

  /* ═══ v1299 · Hören, was gesagt wird — nicht nur, was gefragt war ══════
     Marcels Gesamtziel vom 11.09.2026: „der sollte das schon verstehen, was
     ich ihm sage, auch wenn es nicht zu der Frage passt. Dann sollte er
     nicht immer eine Standardfrage nehmen, sondern gucken, was kann er
     damit machen, um dann in der App das Passende damit zu gestalten."

     Bis hierher ging an die Auswertung NUR der Katalog der aktuellen Frage.
     Wer bei der Miete das Baujahr mitnennt, dessen Angabe fiel durch —
     nicht weil das Modell sie nicht erkannt hätte, sondern weil sie in der
     Liste der erlaubten Felder gar nicht vorkam. Danach stand da „nichts
     gefunden, was hierher passt", und der Nutzer sagte es beim nächsten
     Mal noch einmal.

     WARUM NICHT EINFACH ALLES: mit 192 Feldern im Katalog fängt ein Modell
     an zu raten — es findet für jedes Wort irgendein Feld. Genau davor
     schützte die enge Liste, und dieser Schutz bleibt richtig.

     Der Mittelweg ist die REICHWEITE: gefragte Felder zuerst, dann die
     der nächsten Blöcke, gedeckelt. Was in den nächsten Fragen ohnehin
     drankommt, darf jetzt schon gehört werden; was weit weg liegt, nicht.
     Ein früh gesagtes Baujahr landet damit im Feld, und die Frage danach
     entfällt — `_rfOffeneBloecke` überspringt, was schon steht.

     Die Reihenfolge zählt: das Backend liest die Liste von oben, und was
     zuerst steht, gewinnt bei Mehrdeutigkeit. Die gefragten Felder stehen
     deshalb vorn. */
  var RF_REICHWEITE = 24;   /* Felder insgesamt, inkl. der gefragten */

  function _rfKatalog(eintrag, catalog) {
    var alle = catalog || [];
    var ids  = eintrag.ids || [];
    var dran = alle.filter(function (c) { return ids.indexOf(c.id) >= 0; });
    if (!_rf || !_rf.offen) return dran;

    /* Die Felder der noch offenen Blöcke, in ihrer Reihenfolge — das ist
       die Strecke, die ohnehin vor uns liegt. */
    var kommt = [], gesehen = {};
    ids.forEach(function (id) { gesehen[id] = 1; });
    for (var i = _rf.i + 1; i < _rf.offen.length && dran.length + kommt.length < RF_REICHWEITE; i++) {
      var b = _rf.offen[i];
      (b && b.ids || []).forEach(function (id) {
        if (gesehen[id]) return;
        gesehen[id] = 1;
        var c = alle.filter(function (x) { return x.id === id; })[0];
        if (c && dran.length + kommt.length < RF_REICHWEITE) kommt.push(c);
      });
    }
    return dran.concat(kommt);
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
      /* v1286: Marcels Befund "das Modal ist generell ein bisschen klein" -
         auch nach v1283. Jetzt 1240 px breit und bis 94 vh hoch; die Spalte
         bekommt 330, der Verlauf 410 px. Damit passen 11 Bloecke ohne
         Scrollen ins Bild. */
      /* ═══ v1290 · Das Modal atmet mit dem Fenster ═════════════════════
         Feste 410 px fuer Verlauf und Spalte waren der Grund, warum von
         16 Bloecken nur 11 zu sehen waren (gemessen: Inhalt 644 px). Jetzt
         wachsen beide mit der Fensterhoehe und bleiben gleich hoch. */
      '.oabi-ov.vi-mode .oabi-modal{width:min(1240px,100%);max-height:94vh}',
      '@media(max-width:1280px){.oabi-ov.vi-mode .oabi-modal{width:min(1000px,100%)}}',
      '@media(max-width:1040px){.oabi-ov.vi-mode .oabi-modal{width:min(860px,100%)}}',
      /* v1300: Marcels zweiter Weg — „oder wir machen das Modal noch ein
         bisschen größer". Im geführten Dialog von 94 auf 97 vh; bei 987 px
         Fensterhöhe sind das 30 px mehr, die direkt in die Bühne fließen.
         Weiter als 97 wäre falsch: das Modal braucht sichtbaren Rand, sonst
         sieht es aus wie eine eigene Seite und der Weg zurück fehlt. */
      '.oabi-ov.vi-mode.vi-dialog .oabi-modal{max-height:97vh;width:min(1360px,100%)}',


      /* ═══ v1290 · DIE ÜBERSICHTSSPALTE ════════════════════════════════
         EINE Regel je Klasse. Vorher standen zwei `.vi-rf-st`-Regeln im
         selben Stylesheet (`display:block` und `display:flex`); bei
         gleicher Spezifitaet gewinnt die spaetere, und damit stand der
         Blockname NEBEN den Werten statt darueber. Der Kaskaden-Walker
         hat es gezeigt, `matches()` haette es verschwiegen. */
      '.vi-rf-stand{border:1px solid rgba(42,39,39,.14);border-radius:12px;',
      '  padding:0;background:var(--wl-fbf8f2, #FBF8F2);display:flex;flex-direction:column;',
      '  height:min(58vh,560px);overflow:hidden}',
      '.vi-rf-stand-kopf{display:flex;align-items:center;justify-content:space-between;gap:8px;',
      '  padding:10px 13px 9px;flex:0 0 auto;',
      '  border-bottom:1px solid rgba(42,39,39,.13);',
      '  font:700 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;',
      '  text-transform:uppercase;color:var(--wl-c9a84c, #C9A84C);opacity:.9}',
      '.vi-rf-stand-kopf b{letter-spacing:.04em;opacity:.85}',
      /* Flex-Kind in einem overflow-Container schrumpft, statt zu scrollen
         (FALLEN.md) — deshalb min-height:0 und flex:1 1 auto. */
      '.vi-rf-stand-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:7px 11px 11px}',

      /* Die Etappen-Ueberschrift in der Spalte. */
      '.vi-rf-gr{display:flex;align-items:center;gap:7px;margin:11px 0 4px;',
      '  font:700 9px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.1em;',
      '  text-transform:uppercase;opacity:.68}',
      '.vi-rf-gr:first-child{margin-top:1px}',
      '.vi-rf-gr-nr{width:14px;height:14px;flex:0 0 14px;border-radius:50%;display:flex;',
      '  align-items:center;justify-content:center;background:rgba(42,39,39,.09);font-size:8px}',
      '.vi-rf-gr-n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.vi-rf-gr-z{opacity:.7}',

      /* Eine Zeile je Block: Zeichen · Name · Werte kompakt. */
      '.vi-rf-st{display:block;padding:0;opacity:.62;',
      '  font:400 12px/1.3 Inter,system-ui,sans-serif}',
      '.vi-rf-st-k{display:flex;align-items:baseline;gap:6px;padding:3px 0;border-radius:6px}',
      '.vi-rf-st.hatwerte .vi-rf-st-k{cursor:pointer}',
      '.vi-rf-st.hatwerte:hover .vi-rf-st-k{background:rgba(42,39,39,.055)}',
      '.vi-rf-st .z{width:10px;flex:0 0 10px;text-align:center;',
      '  font:600 10px/1.35 "JetBrains Mono",ui-monospace,monospace}',
      '.vi-rf-st .n{flex:0 0 auto;max-width:47%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.vi-rf-st .v{flex:1 1 auto;min-width:0;text-align:right;overflow:hidden;',
      '  text-overflow:ellipsis;white-space:nowrap;',
      '  font:600 11px/1.35 "JetBrains Mono",ui-monospace,monospace;color:#3FA56C}',
      '.vi-rf-st .v.vorbelegt{color:#8A837F;font-weight:400}',
      '.vi-rf-st.ok{opacity:1} .vi-rf-st.ok .z{color:#3FA56C}',
      '.vi-rf-st.vor{opacity:.78} .vi-rf-st.vor .z{color:#8A837F}',
      '.vi-rf-st.weg{opacity:.4} .vi-rf-st.weg .z{color:#B8625C}',
      '.vi-rf-st.dran{opacity:1;font-weight:600} .vi-rf-st.dran .z{color:var(--wl-c9a84c, #C9A84C)}',
      '.vi-rf-st.dran .n{color:var(--wl-e8cc7a, #E8CC7A)}',
      /* Die Einzelwerte: erst beim Klick, dann sauber im Raster. */
      '.vi-rf-st-w{display:none}',
      '.vi-rf-st.auf .vi-rf-st-w{display:grid;grid-template-columns:minmax(0,1fr) auto;',
      '  gap:1px 10px;align-items:baseline;margin:2px 0 6px 16px;',
      '  padding:5px 8px;border-radius:7px;background:rgba(42,39,39,.055)}',
      '.vi-rf-st-w span{display:contents}',
      '.vi-rf-st-w i{font-style:normal;opacity:.6;font:400 10.5px/1.5 Inter,system-ui,sans-serif;',
      '  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.vi-rf-st-w b{font:600 11px/1.5 "JetBrains Mono",ui-monospace,monospace;color:#3FA56C;',
      '  text-align:right;white-space:nowrap}',
      '.vi-rf-st-w b.vorbelegt{color:#8A837F;font-weight:400}',

      /* ═══ v1290b · Das Modal scrollt nicht mehr ═══════════════════════
         Gemessen: Buehne 560 + Band 24 + Kopfzeile 33 + Mikro 59 +
         Eingabe 43 + Knoepfe 33 = 752 px in einem Body von 699. Man
         musste scrollen, um das Mikrofon zu sehen — bei einem Dialog,
         dessen ganzer Sinn das Mikrofon ist.
         Jetzt bestimmt der PLATZ die Hoehe des Verlaufs, nicht eine feste
         Zahl: alles ausser der Buehne ist `flex:0 0 auto`, die Buehne
         nimmt den Rest. `min-height:0` ist dabei Pflicht — ein Flex-Kind
         schrumpft sonst nicht unter seinen Inhalt (FALLEN.md). */
      '.oabi-ov.vi-mode.vi-dialog .oabi-body{display:flex;flex-direction:column;overflow:hidden}',
      '.oabi-ov.vi-mode.vi-dialog #vi-frage{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-kopfzeile,',
      '.oabi-ov.vi-mode.vi-dialog #vi-rf-band,',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-dran,',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-mikro,',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-zeile,',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-neben{flex:0 0 auto}',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-buehne{flex:1 1 auto;min-height:0}',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-chat,',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-stand{height:100%;min-height:180px}',
      /* ═══ v1303 · Tablet: die Liste war breiter als das Gespräch ═════════
         Marcels Vorgabe vom 11.09.2026: „wichtig ist auch, dass beide
         Sprachaufzeichnungen für Tablet und Handy funktionieren."

         GEMESSEN im gleich-Origin-iframe bei 767 px (Tablet hochkant):
         der Umbruch stand bei 720 px und griff deshalb NICHT. Ergebnis
         zweispaltig — Gespräch **330 px**, Liste **340 px**. Die
         Nebenspalte war breiter als die Hauptsache.

         Der Umbruch liegt jetzt bei 900 px, genau wie beim freien Weg
         (`.vi-frei-buehne`). Zwei Wege mit demselben Problem sollen
         denselben Schwellenwert haben — sonst bricht das eine Fenster um
         und das andere nicht, auf demselben Gerät.

         Dazwischen, zwischen 900 und 1100 px, wird die Liste schmaler
         statt zu verschwinden: 340 px sind für einen 1000-px-Dialog zu
         viel, aber die Spalte ganz zu opfern wäre zu früh. */
      '.vi-rf-buehne{display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:stretch}',
      '@media(max-width:1100px){.vi-rf-buehne{grid-template-columns:1fr 270px;gap:12px}}',
      '@media(max-width:900px){.vi-rf-buehne{grid-template-columns:1fr;gap:12px}',
      '  .vi-rf-stand{order:-1}',
      '  .oabi-ov.vi-mode.vi-dialog .vi-rf-stand{height:auto;max-height:150px}}',
      '.vi-rf-chat{height:min(58vh,560px);overflow-y:auto;display:flex;flex-direction:column;gap:11px;',
      '  padding:2px 4px 2px 2px}',
      '.vi-rf-blase{max-width:82%;padding:11px 14px;border-radius:14px;font-size:14px;line-height:1.45;',
      '  animation:viRfAuf .3s ease both}',
      '@keyframes viRfAuf{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}',
      '.vi-rf-co{align-self:flex-start;background:var(--wl-fffdf7, #FFFDF7);border-top-left-radius:5px;',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 26%, transparent)}',

      /* ═══ v1306 · Die Frage, die GERADE gilt ═══════════════════════════
         Marcels Vorgabe: „das wäre gut, dass man sieht, dass man das
         nochmal visualisiert, was gerade aktuell ist … vielleicht einfach
         den Hintergrund farblich anders darstellen oder ein bisschen
         aufleuchten lassen, den Rahmen aufscheinen lassen."

         Im Verlauf sehen alle Co-Pilot-Blasen gleich aus — die Frage von
         vor drei Antworten so wie die, die gerade offen ist. Wer nach
         einer längeren Auskunft zurückkommt, sucht.

         Die aktuelle Frage bekommt deshalb einen goldenen Rand und einen
         kurzen Puls. `animation` läuft EINMAL, nicht dauernd: ein Rahmen,
         der pulsiert, solange man tippt, ist Unruhe, kein Hinweis. */
      '.vi-rf-blase.vi-rf-dran-blase{border-color:var(--wl-c9a84c, #C9A84C);',
      '  box-shadow:0 0 0 1px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent),',
      '  0 3px 16px -6px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 60%, transparent);',
      '  animation:viDranAuf .9s ease-out 1}',
      '@keyframes viDranAuf{',
      '  0%{box-shadow:0 0 0 0 color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 70%, transparent)}',
      '  55%{box-shadow:0 0 0 5px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 22%, transparent)}',
      '  100%{box-shadow:0 0 0 1px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent),',
      '       0 3px 16px -6px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 60%, transparent)}}',
      '@media (prefers-reduced-motion: reduce){.vi-rf-blase.vi-rf-dran-blase{animation:none}}',
      '.vi-rf-ich{align-self:flex-end;border-top-right-radius:5px;',
      '  background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 14%, transparent);',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent)}',
      '.vi-rf-wer{font:700 9px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;',
      '  text-transform:uppercase;margin-bottom:6px;opacity:.65}',
      '.vi-rf-co .vi-rf-wer{color:var(--wl-c9a84c, #C9A84C);opacity:.85}',
      '.vi-rf-ich .vi-rf-wer{text-align:right}',
      '.vi-rf-treffer{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(42,39,39,.16);',
      '  font:600 11.5px/1.5 "JetBrains Mono",ui-monospace,monospace;color:#3FA56C}',
      '.vi-rf-zaehler{font:600 10.5px/1 "JetBrains Mono",monospace;opacity:.5;margin-top:7px}',

      /* ═══ v1299 · Die Pillen mit den Schlagwörtern ═══════════════════════
         Marcels Vorgabe: „hinter den Fragen noch Pillen mit den
         Schlagwörtern, die gefragt sind."

         SIE WAREN IN v1298 SCHON DA — ohne eine einzige CSS-Regel. Im
         Browser stand deshalb „PLZOrtStraßeHausnummer" als ein Wort.
         Genau die Falle, die ich am selben Tag in FALLEN.md geschrieben
         habe: eine Existenzprüfung ist keine Abnahme. Vier `.vi-rf-pille`
         im DOM heißt nicht, dass man vier Pillen sieht. */
      '.vi-rf-pillen{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}',
      '.vi-rf-pille{display:inline-flex;align-items:center;gap:4px;',
      '  padding:3px 9px;border-radius:99px;white-space:nowrap;',
      '  font:600 11px/1.35 Inter,system-ui,sans-serif;',
      '  border:1px solid rgba(42,39,39,.20);color:rgba(42,39,39,.78);',
      '  background:rgba(42,39,39,.035)}',
      /* Was schon steht, ist gruen und abgehakt — Statusfarben bleiben in
         jeder Marke gleich (CLAUDE.md), deshalb kein --wl-Token. */
      '.vi-rf-pille.da{border-color:rgba(63,165,108,.45);color:#2f7d51;',
      '  background:rgba(63,165,108,.10)}',
      '.vi-rf-pille.da i{font-style:normal;font-size:10px;line-height:1}',

      /* ═══ v1299 · Mehr Platz für Gespräch und Liste ══════════════════════
         Marcels Befund: „das kann man alles ein bisschen kleiner machen,
         dass das Feld, wo die Ein- und Ausgaben gemacht werden, ein
         bisschen größer zu sehen ist."

         GEMESSEN im laufenden Dialog (Fenster 987 px hoch):

           Modal gesamt      929
             Markenleiste     60
             Kopf mit Titel  101
             Körper          699  ← davon Bühne nur 367
             Fußleiste        66

         Es fehlt nicht an Platz — er wird oben und unten verbraucht. Der
         Kopf trägt bei JEDEM Durchlauf denselben Erklärtext, den man
         einmal liest; die Bühne darunter trägt das Gespräch.

         Alles hier gilt NUR im Sprechlauf-Dialog (`.vi-mode.vi-dialog`),
         damit andere Modale mit derselben Hülle unberührt bleiben. */
      '.oabi-ov.vi-mode.vi-dialog .bdg-brand{padding-top:8px;padding-bottom:8px}',
      '.oabi-ov.vi-mode.vi-dialog .bdg-hero{padding:9px 22px 8px}',
      '.oabi-ov.vi-mode.vi-dialog .oabi-head h3{font-size:17px;margin:1px 0 0}',
      /* NACHGEMESSEN: der Erklärsatz ist `.oabi-sub`, kein `<p>` — eine
         Regel auf `p` traf hier gar nichts, und `.bdg-hero` wuchs dabei
         von 101 auf 120 px, statt zu schrumpfen.

         Er verschwindet jetzt ganz, und zwar NUR im geführten Dialog: was
         er sagt („ich frage der Reihe nach, ‚Weiß ich nicht‘ überspringt,
         ‚Fertig‘ bringt dich zur Übersicht"), steht zwei Zeilen weiter
         unten in der ersten Co-Pilot-Blase UND auf den Knöpfen selbst.
         Dreimal derselbe Hinweis kostet 38 px an der Stelle, an der
         Marcel mehr sehen will. */
      '.oabi-ov.vi-mode.vi-dialog .oabi-sub{display:none}',
      '.oabi-ov.vi-mode.vi-dialog .oabi-foot{padding-top:9px;padding-bottom:9px}',
      /* Der Mikrofon-Streifen: flacher, ohne an Treffsicherheit zu verlieren.
         Die Fläche zum Klicken bleibt über 40 px hoch. */
      /* ═══ v1300 · Der untere Rand, so flach wie möglich ═════════════════
         Marcels Vorgabe: „genauso wie da drunter ‚Ich höre weiter zu‘ und
         allem und auch, ja, wenn man tippen möchte … dass man das alles ein
         bisschen flacher macht, dass dieses Visualisierungsfenster, wo der
         Co-Pilot antwortet, dass das größer ist."

         GEMESSEN vorher: Mikro 53 + Tippzeile 43 + Nebenknöpfe 33 = 129 px
         plus Abstände. Alles davon ist Bedienung, die man kennt, sobald man
         sie einmal gesehen hat.

         Die Klickflächen bleiben über 36 px hoch — flacher wäre auf dem
         Handy nicht mehr sicher zu treffen. */
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-mikro{margin:6px 2px 6px;padding:6px 12px;gap:10px}',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-zeile input{padding:8px 13px;font-size:13.5px}',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-neben{margin-top:6px;gap:6px}',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-neben button{padding:5px 11px;font-size:11.5px}',

      /* ═══ v1299 · Die Liste soll man am Stück sehen ═════════════════════
         Marcels Vorgabe: „dass man die Liste auf einer Seite auf jeden Fall
         komplett sehen kann."

         NACHGEMESSEN: `.vi-rf-stand-body` scrollt längst (`overflow-y:auto`,
         Zeile 2606) — erreichbar war also alles. Der Eindruck entstand
         anders: die Liste endete mitten in „Etappe 4", und eine Liste, die
         ohne Kante abbricht, sieht aus wie eine, die etwas verschweigt.

         Zwei Dinge helfen, nicht eins: mehr Höhe (kommt aus dem
         kompakteren Kopf oben) und eine sichtbare UNTERKANTE, die sagt
         „hier geht es weiter". Der Verlauf steht am Rahmen, nicht am
         scrollenden Inhalt — sonst scrollt er mit und verschwindet.

         `position:relative` am Rahmen ist Pflicht, sonst hängt das
         Pseudoelement am nächsten positionierten Vorfahren — irgendwo
         weit oben im Modal. */
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-stand{min-height:220px;position:relative}',
      '.oabi-ov.vi-mode.vi-dialog .vi-rf-stand::after{content:"";position:absolute;',
      '  left:1px;right:1px;bottom:1px;height:26px;pointer-events:none;border-radius:0 0 11px 11px;',
      '  background:linear-gradient(to top, var(--wl-fbf8f2, #FBF8F2) 22%, transparent)}',
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
      '  background:#fff;color:inherit;font:400 14.5px Inter,system-ui,sans-serif}',
      '.vi-rf-zeile input:focus{outline:none;border-color:var(--wl-c9a84c, #C9A84C)}',
      '.vi-rf-btn{border-radius:11px;padding:0 15px;cursor:pointer;white-space:nowrap;',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);',
      '  background:transparent;color:var(--wl-c9a84c, #C9A84C);',
      '  font:600 12px "JetBrains Mono",ui-monospace,monospace}',
      '.vi-rf-btn:hover{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 12%, transparent)}',
      '.vi-rf-neben{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}',
      '.vi-rf-neben button{background:rgba(42,39,39,.04);border:1px solid rgba(42,39,39,.16);',
      '  color:inherit;opacity:.75;border-radius:9px;padding:7px 12px;cursor:pointer;',
      '  font:400 12.5px Inter,system-ui,sans-serif}',
      '.vi-rf-neben button:hover{opacity:1}',
      /* ═══ v1291 · Die Aktionsleiste ═══════════════════════════════════
         Marcels Befund: Angebote in einer Chatblase wandern mit dem
         Verlauf aus dem Bild, und dann weiss niemand, dass noch etwas
         offen ist. Diese Leiste steht fest zwischen Verlauf und Mikrofon.
         Sie traegt IMMER die aktuelle Frage und, wenn es welche gibt, die
         Angebote — an EINEM Ort, gold umrandet, nicht zu uebersehen. */
      '.vi-rf-dran{margin:12px 2px 2px;border-radius:12px;overflow:hidden;',
      '  border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 34%, transparent);',
      '  background:var(--wl-fffdf7, #FFFDF7)}',
      /* v1300: flacher. Die Zeile mit der Frage trug 9 px oben und unten
         und eine Zeilenhöhe von 1.45 — zusammen fast 40 px für einen Satz. */
      '.vi-dran-f{display:flex;gap:8px;align-items:baseline;padding:6px 13px;',
      '  font:400 12px/1.35 Inter,system-ui,sans-serif}',
      '.vi-dran-f i{font-style:normal;color:var(--wl-c9a84c, #C9A84C);font-weight:700}',
      '.vi-dran-f span{flex:1;min-width:0}',
      '.vi-dran-f b{font-weight:700}',
      /* Die Knopfreihe liegt jetzt in EINER Zeile mit ihrer Beschriftung —
         das spart die 7 px Abstand darunter und eine ganze Textzeile. */
      '.vi-dran-a{display:flex;align-items:center;flex-wrap:wrap;gap:6px;',
      '  padding:6px 13px 6px;border-top:1px dashed rgba(42,39,39,.14);',
      '  background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 9%, transparent)}',
      '.vi-dran-lbl{flex:0 0 auto;margin:0 3px 0 0;',
      '  font:700 9px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.11em;',
      '  text-transform:uppercase;color:var(--wl-b8932f, #b8932f)}',
      '.vi-dran-btn{display:inline-flex;align-items:center;gap:7px;margin:0;',
      '  border-radius:10px;padding:8px 14px;cursor:pointer;',
      '  border:1px solid var(--wl-c9a84c, #C9A84C);',
      '  background:linear-gradient(160deg, var(--wl-e8cc7a, #E8CC7A), var(--wl-c9a84c, #C9A84C));',
      '  color:#221c08;font:700 12.5px Inter,system-ui,sans-serif;',
      '  box-shadow:0 1px 3px rgba(42,39,39,.14);transition:transform .12s ease, box-shadow .12s ease}',
      '.vi-dran-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 3px 9px rgba(42,39,39,.2)}',
      '.vi-dran-btn:disabled,.vi-dran-btn.laeuft{opacity:.5;cursor:default;transform:none}',
      '.vi-dran-btn b{font-size:14px;line-height:1}',
      '.vi-dran-btn i{font-style:normal;font-size:10px;font-weight:600;padding:2px 7px;',
      '  border-radius:99px;background:rgba(42,39,39,.14)}',
      /* v1300: EINE Zeile, die dem Zeiger folgt — nicht mehr eine je Knopf.
         Zwei Zeilen Höhe sind der Deckel: was länger ist, wird abgeschnitten
         statt die Leiste wachsen zu lassen. Der volle Text steht im
         `title` des Knopfes. */
      '.vi-dran-t{margin:0;padding:5px 13px 7px;font:400 11.5px/1.4 Inter,system-ui,sans-serif;',
      '  opacity:.72;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 9%, transparent);',
      '  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      /* Die Begruendungen der Lage-Recherche. */
      '.vi-lg-t{margin:7px 0 0;font:400 11.5px/1.55 Inter,system-ui,sans-serif;opacity:.85}',
      '.vi-lg-t b{display:block;font:700 9.5px/1 "JetBrains Mono",ui-monospace,monospace;',
      '  letter-spacing:.09em;text-transform:uppercase;color:var(--wl-b8932f, #b8932f);margin-bottom:3px}',
      '.vi-adr{display:inline-block;padding:3px 10px;border-radius:8px;',
      '  background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 16%, transparent);',
      '  font:700 13.5px/1.35 "JetBrains Mono",ui-monospace,monospace}',
      /* ═══ v1288 · Das Etappenband ══════════════════════════════════════
         Steht ueber dem Verlauf und beantwortet die Frage, die ein
         Fragezaehler nicht beantwortet: nicht „die wievielte Frage",
         sondern „wovon handelt das hier gerade und was kommt danach". */
      /* ═══ v1290 · Das Etappenband als Weg, nicht als Etikettenreihe ═══
         Verbindungslinie, runder Punkt, Fortschritt je Etappe. Erst die
         Linie macht aus einer Reihe von Namen einen Weg, auf dem man
         sieht, wie weit man ist. */
      '#vi-rf-band{margin:0 2px 14px}',
      '.vi-et-band{display:flex;align-items:flex-start;gap:0;flex-wrap:wrap}',
      '.vi-et{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0;opacity:.52}',
      '.vi-et-linie{flex:1 1 auto;min-width:12px;height:2px;border-radius:2px;',
      '  background:rgba(42,39,39,.15);margin:0 4px}',
      '.vi-et.fertig .vi-et-linie,.vi-et.jetzt .vi-et-linie{background:var(--wl-c9a84c, #C9A84C);opacity:.55}',
      '.vi-et-punkt{width:22px;height:22px;flex:0 0 22px;border-radius:50%;display:flex;',
      '  align-items:center;justify-content:center;background:rgba(42,39,39,.07);',
      '  border:1px solid rgba(42,39,39,.18);',
      '  font:700 10px/1 "JetBrains Mono",ui-monospace,monospace}',
      '.vi-et-txt{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.vi-et-txt b{font:600 11px/1.2 Inter,system-ui,sans-serif;white-space:nowrap;',
      '  overflow:hidden;text-overflow:ellipsis}',
      '.vi-et-txt small{font:600 9px/1 "JetBrains Mono",ui-monospace,monospace;opacity:.6}',
      '.vi-et.fertig{opacity:.9}',
      '.vi-et.fertig .vi-et-punkt{background:#3FA56C;border-color:#3FA56C;color:#08130c}',
      '.vi-et.jetzt{opacity:1}',
      '.vi-et.jetzt .vi-et-punkt{border-color:var(--wl-c9a84c, #C9A84C);color:#100e08;',
      '  background:linear-gradient(160deg, var(--wl-e8cc7a, #E8CC7A), var(--wl-c9a84c, #C9A84C));',
      '  box-shadow:0 0 0 3px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 18%, transparent)}',
      '.vi-et.jetzt .vi-et-txt b{color:var(--wl-e8cc7a, #E8CC7A)}',
      '@media(max-width:820px){.vi-et-txt small{display:none}}',
      /* ═══ v1288 · Die Score-Karte im Verlauf ══════════════════════════
         Sie sitzt IN einer Co-Pilot-Blase, deshalb kein eigener Rahmen um
         das Ganze, sondern eine abgesetzte Flaeche darin. */
      /* v1299: Volle Breite für Blasen, die eine Score-Karte tragen —
         siehe `_rfBlase`. Die Zahl darf nicht eingerückt sitzen. */
      '.vi-rf-blase.vi-rf-karte{max-width:100%;width:100%}',
      '.vi-sc{margin:11px -4px 2px;padding:14px 15px;border-radius:12px;',
      '  background:var(--wl-fbf6e9, #FBF6E9);border:1px solid rgba(42,39,39,.20);',
      /* Ein Hauch Schatten hebt die Karte aus der Blase heraus. Ohne ihn
         steht Creme auf Creme und die Kante verschwindet — genau das
         „schlecht sehen" aus Marcels Rückmeldung. */
      '  box-shadow:0 2px 10px -4px rgba(27,24,21,.22)}',
      '.vi-sc-kopf{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:2px}',
      '.vi-sc-titel{font:700 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;',
      '  text-transform:uppercase;color:var(--wl-c9a84c, #C9A84C);opacity:.9}',
      '.vi-sc-pille{border:1px solid;border-radius:99px;padding:3px 9px;',
      '  font:700 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.1em}',
      /* ═══ v1292 · Die grosse Zahl ══════════════════════════════════════
         Sie zaehlt hoch, sie leuchtet, und darunter faehrt ein Balken aus.
         Das Leuchten haengt an der STUFE: ab 85 kraeftig, ab 70
         zurueckhaltend, darunter gar nicht — ein schwacher Deal, der
         leuchtet, waere eine Luege in Lichtform. */
      '.vi-sc-zahl{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;',
      '  font:700 40px/1.05 "Space Grotesk",system-ui,sans-serif;margin:6px 0 8px}',
      '.vi-sc-zahl-n{font-variant-numeric:tabular-nums;letter-spacing:-.02em}',
      '.vi-sc-zahl small{font:600 12px/1 "JetBrains Mono",ui-monospace,monospace;opacity:.4}',
      '.vi-sc-zahl em{font-style:normal;margin-left:auto;font:700 11px/1 "JetBrains Mono",ui-monospace,monospace;',
      '  letter-spacing:.1em;text-transform:uppercase;opacity:.55;align-self:center}',
      '.vi-sc-zahl.gut .vi-sc-zahl-n{text-shadow:0 0 14px color-mix(in srgb, currentColor 45%, transparent)}',
      '.vi-sc-zahl.top .vi-sc-zahl-n{text-shadow:0 0 10px color-mix(in srgb, currentColor 60%, transparent),',
      '  0 0 28px color-mix(in srgb, currentColor 40%, transparent);animation:viScGlanz 2.6s ease-in-out infinite}',
      '@keyframes viScGlanz{0%,100%{filter:brightness(1)}50%{filter:brightness(1.18)}}',
      '@media (prefers-reduced-motion: reduce){.vi-sc-zahl.top .vi-sc-zahl-n{animation:none}}',
      '.vi-sc-bar{height:5px;border-radius:99px;background:rgba(42,39,39,.09);overflow:hidden;margin:0 0 12px}',
      '.vi-sc-bar i{display:block;height:100%;width:0;border-radius:99px;',
      '  transition:width 1.1s cubic-bezier(.22,.9,.3,1)}',
      /* Das Fazit in einem Satz — das erste, was man liest. */
      '.vi-sc-fazit{margin:0 0 11px;padding:9px 12px;border-radius:9px;',
      '  font:400 13px/1.5 Inter,system-ui,sans-serif;',
      '  background:rgba(42,39,39,.05);border-left:3px solid rgba(42,39,39,.2)}',
      '.vi-sc-fazit.top{background:rgba(63,165,108,.13);border-left-color:#3FA56C}',
      '.vi-sc-fazit.gut{background:rgba(63,165,108,.08);border-left-color:#3FA56C}',
      '.vi-sc-fazit.schwach{background:rgba(184,98,92,.1);border-left-color:#B8625C}',
      /* Break-even */
      '.vi-sc-be{margin-top:11px;padding:9px 12px;border-radius:9px;',
      '  background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 10%, transparent);',
      '  font:400 12.5px/1.55 Inter,system-ui,sans-serif}',
      '.vi-sc-be>b{display:inline-block;margin-right:7px;',
      '  font:700 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.1em;',
      '  text-transform:uppercase;color:var(--wl-b8932f, #b8932f)}',
      '.vi-sc-be small{display:block;margin-top:6px;font-size:10.5px;line-height:1.5;opacity:.62}',
      /* Mietpotenzial */
      '.vi-sc-mp{margin-top:11px;padding:10px 12px;border-radius:9px;',
      '  font:400 12.5px/1.6 Inter,system-ui,sans-serif}',
      '.vi-sc-mp.plus{background:rgba(63,165,108,.1);border:1px solid rgba(63,165,108,.28)}',
      '.vi-sc-mp.minus{background:rgba(184,98,92,.09);border:1px solid rgba(184,98,92,.28)}',
      '.vi-sc-mp>b:first-child{display:block;margin-bottom:4px;',
      '  font:700 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase}',
      /* v1295 · Wie viel vom Potenzial wirklich erreichbar ist. */
      '.vi-mp-teil{margin-top:10px;padding-top:9px;border-top:1px dashed rgba(42,39,39,.18)}',
      '.vi-mp-z{display:flex;align-items:baseline;justify-content:space-between;gap:10px;',
      '  padding:3px 0;font:400 12.5px/1.5 Inter,system-ui,sans-serif}',
      '.vi-mp-z i{font-style:normal;opacity:.72}',
      '.vi-mp-z b{font:700 13px/1.4 "JetBrains Mono",ui-monospace,monospace;white-space:nowrap}',
      '.vi-mp-teil small{display:block;margin-top:7px;font-size:11px;line-height:1.55;opacity:.68}',
      '.vi-sc-mp.plus>b:first-child{color:#2F7D51}.vi-sc-mp.minus>b:first-child{color:#9E4A45}',
      /* Die Hebel */
      '.vi-sc-hebel{margin-top:12px;padding-top:10px;border-top:1px dashed rgba(42,39,39,.16)}',
      '.vi-sc-hebel>b{display:block;margin-bottom:8px;',
      '  font:700 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.1em;',
      '  text-transform:uppercase;color:var(--wl-b8932f, #b8932f)}',
      '.vi-sc-hebel>small{display:block;margin-top:8px;font-size:10.5px;opacity:.55}',
      '.vi-hb{display:flex;align-items:flex-start;gap:10px;padding:6px 0;',
      '  border-bottom:1px solid rgba(42,39,39,.06)}',
      '.vi-hb:last-of-type{border-bottom:none}',
      '.vi-hb-p{flex:0 0 auto;min-width:34px;text-align:center;padding:3px 7px;border-radius:7px;',
      '  background:rgba(63,165,108,.16);color:#2F7D51;',
      '  font:700 12px/1.25 "JetBrains Mono",ui-monospace,monospace}',
      '.vi-hb-t{flex:1;min-width:0;font:400 12.5px/1.45 Inter,system-ui,sans-serif}',
      '.vi-hb-t small{display:block;margin-top:2px;font-size:11px;opacity:.62}',
      '.vi-hb-z{flex:0 0 auto;align-self:center;font:700 12px/1 "JetBrains Mono",ui-monospace,monospace;',
      '  opacity:.5}',
      '.vi-sc-gitter{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 16px}',
      '@media(max-width:560px){.vi-sc-gitter{grid-template-columns:1fr}}',
      '.vi-sc-z{display:flex;align-items:baseline;justify-content:space-between;gap:8px;',
      '  padding:3px 0;border-bottom:1px solid rgba(42,39,39,.08)}',
      '.vi-sc-z i{font-style:normal;opacity:.6;font:400 11.5px/1.4 Inter,system-ui,sans-serif}',
      '.vi-sc-z b{font:600 12px/1.4 "JetBrains Mono",ui-monospace,monospace;white-space:nowrap}',
      '.vi-sc-z.gut b{color:#3FA56C} .vi-sc-z.schlecht b{color:#B8625C}',
      '.vi-sc-text{margin-top:10px;font:400 12.5px/1.5 Inter,system-ui,sans-serif;opacity:.9}',
      '.vi-sc-annahmen{margin-top:9px;padding-top:8px;border-top:1px dashed rgba(42,39,39,.16);',
      '  font:400 11px/1.5 Inter,system-ui,sans-serif;opacity:.72}',
      '.vi-sc-annahmen b{opacity:.9}',
      '.vi-sc-weiter{margin-top:10px;font:400 12.5px/1.45 Inter,system-ui,sans-serif;opacity:.8}',
      /* v1290: der Fliesstext der vollen Stufe — eingeklappt, damit er die
         Karte nicht sprengt, aber vorhanden. Wer dafuer bezahlt, soll ihn
         auch sehen koennen. */
      '.vi-sc-mehr{margin-top:11px;border-top:1px dashed rgba(42,39,39,.16);padding-top:9px}',
      '.vi-sc-mehr summary{cursor:pointer;font:600 10px/1 "JetBrains Mono",ui-monospace,monospace;',
      '  letter-spacing:.1em;text-transform:uppercase;color:var(--wl-c9a84c, #C9A84C);opacity:.9}',
      '.vi-sc-mehr p{margin:9px 0 0;font:400 12px/1.6 Inter,system-ui,sans-serif;opacity:.82;',
      '  max-height:220px;overflow-y:auto}',
      /* Die Stufen einer Auswahl, in der Frage genannt (Backlog-Punkt 2). */
      '.vi-rf-skala{margin-top:9px;padding:8px 11px;border-radius:9px;',
      '  font:400 12px/1.55 Inter,system-ui,sans-serif;',
      '  background:rgba(42,39,39,.04);border:1px solid rgba(42,39,39,.12)}',
      '.vi-rf-skala b{font:700 9.5px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.1em;',
      '  text-transform:uppercase;color:var(--wl-c9a84c, #C9A84C);opacity:.85}',
      '.vi-rf-skala i{font-style:normal;font-weight:600;opacity:.85}',
      /* ═══ v1288 · Das Abruf-Angebot in der Frage ═════════════════════
         Kein Modal, kein zweiter Dialog: der Knopf steht dort, wo die
         Frage steht. Wer ihn nicht braucht, redet einfach weiter. */
      '.vi-rf-abruf{margin-top:10px;padding:9px 11px;border-radius:9px;',
      '  font:400 12.5px/1.5 Inter,system-ui,sans-serif;',
      '  background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 9%, transparent);',
      '  border:1px dashed color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 34%, transparent)}',
      '.vi-rf-abruf.laeuft{border-style:solid;opacity:.75}',
      '.vi-rf-abruf small{display:block;margin-top:6px;opacity:.55;font-size:11px}',
      '.vi-rf-abruf-btn{display:inline-flex;align-items:center;gap:7px;margin:8px 8px 0 0;',
      '  border-radius:9px;padding:7px 13px;cursor:pointer;',
      '  border:1px solid var(--wl-c9a84c, #C9A84C);background:transparent;',
      '  color:var(--wl-c9a84c, #C9A84C);font:600 12px "JetBrains Mono",ui-monospace,monospace}',
      '.vi-rf-abruf-btn:hover:not(:disabled){background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 16%, transparent)}',
      '.vi-rf-abruf-btn:disabled{opacity:.45;cursor:default}',
      '.vi-rf-abruf-btn i{font-style:normal;font-size:10px;opacity:.7;',
      '  padding:2px 6px;border-radius:99px;background:rgba(42,39,39,.08)}',
      /* Der Knopf zur Tabelle am Abschluss traegt Gewicht — er beendet den
         Sprechlauf, waehrend „Weiss ich nicht" nur eine Frage beendet. */
      '#vi-rf-zur-tabelle{border-color:var(--wl-c9a84c, #C9A84C) !important;',
      '  color:var(--wl-e8cc7a, #E8CC7A) !important;opacity:1 !important;',
      '  background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 14%, transparent) !important;',
      '  font-weight:600 !important}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ═══ v1304 · `vi-frage` gehört DIREKT in den Körper ════════════════════
     Marcels Befund vom 11.09.2026 (Bild `design/mockups/sp2.png`): „nach
     Eingabe der Adresse per Sprache kann ich unten nicht auswählen, man
     kann auch nicht runter scrollen."

     Im Bild ist die Aktionsleiste angeschnitten, und Mikrofonzeile,
     Eingabefeld und Knöpfe fehlen ganz — das Modal ist höher als das
     Fenster, und nichts davon scrollt.

     URSACHE, und sie ist meine aus `v1300b`: hier stand

         rec.parentNode.insertBefore(h, rec.nextSibling)

     — der geführte Dialog wurde als GESCHWISTER von `vi-rec` eingehängt.
     Bis `v1300b` war dessen Elternteil `oabi-body`; seit ich
     `.vi-frei-buehne` um `vi-rec` gelegt habe, ist es die Bühne. Der ganze
     Dialog landete also IN meinem Behälter für den freien Weg.

     Damit riss die Flex-Kette, die ihn scrollen lässt:

         .vi-dialog .oabi-body{display:flex;flex-direction:column;overflow:hidden}
         .vi-dialog #vi-frage{flex:1 1 auto;min-height:0}

     Beide setzen voraus, dass `#vi-frage` ein DIREKTES Kind von
     `.oabi-body` ist. Eine Ebene dazwischen, und der Chat wächst
     unbegrenzt, statt seine Höhe vom Körper zu bekommen — das Modal wird
     zu hoch, und unten fällt heraus, was nicht mehr hineinpasst.

     `insertBefore` an einem Geschwister ist bequem, macht die Einhängung
     aber von einer Struktur abhängig, die jemand später ändert. Deshalb
     jetzt AUSDRÜCKLICH am Körper. */
  function _rfHost() {
    var h = $('vi-frage');
    if (!h) {
      _rfStil();
      h = document.createElement('div');
      h.id = 'vi-frage';
      h.style.display = 'none';
      var body = document.querySelector('.oabi-ov.vi-mode .oabi-body');
      if (body) {
        /* Hinter die Bühne des freien Wegs, falls es sie gibt — sonst ans
           Ende. In beiden Fällen als direktes Kind. */
        var buehne = body.querySelector(':scope > .vi-frei-buehne');
        if (buehne) body.insertBefore(h, buehne.nextSibling);
        else body.appendChild(h);
      } else {
        var rec = $('vi-rec');
        if (rec && rec.parentNode) rec.parentNode.insertBefore(h, rec.nextSibling);
      }
    }
    return h;
  }

  /* ═══ v1300 · Der Verlauf muss WIRKLICH unten stehen ════════════════════
     Marcels Befund vom 11.09.2026: „das Feld, wo jetzt die Ausgaben
     drinne stehen, das muss immer ganz nach unten gescrollt werden. Das
     ist mir aufgefallen, dass das manchmal nicht so ist."

     „Manchmal" ist der Hinweis auf die Ursache. `scrollTop = scrollHeight`
     direkt nach `appendChild` misst die Höhe in DEM Moment — und in dem
     Moment stimmt sie oft noch nicht:

       · die Einblend-Animation startet mit `translateY(7px)`,
       · Schriften können noch nachladen und Zeilen umbrechen,
       · eine Score-Karte wächst, während ihre Balken ausfahren,
       · Bilder und `<details>` ändern die Höhe nach dem Einhängen.

     Deshalb wird jetzt DREIMAL ans Ende gefahren: sofort, im nächsten
     Bild (nach Layout), und noch einmal nach 260 ms — da ist auch die
     Karten-Animation durch. Das ist billiger als ein ResizeObserver und
     deckt alle vier Fälle ab.

     WER SELBST HOCHGESCROLLT HAT, WIRD NICHT ZURÜCKGERISSEN. Wer im
     Verlauf nach oben liest, während eine Antwort eintrifft, soll dort
     bleiben — sonst springt ihm die Ansicht mitten im Lesen weg. */
  function _rfAnsEnde(chat, erzwingen) {
    if (!chat) return;
    var nah = (chat.scrollHeight - chat.clientHeight - chat.scrollTop) < 120;
    if (!nah && !erzwingen) return;
    var tu = function () { chat.scrollTop = chat.scrollHeight; };
    tu();
    if (window.requestAnimationFrame) requestAnimationFrame(tu);
    setTimeout(tu, 260);
  }

  /* ── Der Verlauf ─────────────────────────────────────────────────── */
  function _rfBlase(wer, html, treffer) {
    var chat = $('vi-rf-chat'); if (!chat) return null;
    var d = document.createElement('div');
    d.className = 'vi-rf-blase ' + (wer === 'co' ? 'vi-rf-co' : 'vi-rf-ich');
    d.innerHTML = '<div class="vi-rf-wer">' + (wer === 'co' ? 'Co-Pilot' : 'Du') + '</div>' + html +
      (treffer ? '<div class="vi-rf-treffer">✓ ' + treffer + '</div>' : '');
    chat.appendChild(d);
    /* Eine neue Blase ist immer gewollt sichtbar — auch wenn der Nutzer
       gerade oben liest, denn er hat sie selbst ausgeloest. */
    _rfAnsEnde(chat, true);
    /* ═══ v1299 · Eine Score-Karte ist keine Sprechblase ═════════════════
       Marcels Befund: „Dann ist das irgendwie ein bisschen komisch
       eingerückt. Also man kann den Deal Score und den Investor Deal Score
       schlecht sehen."

       Die Ursache steht in `.vi-rf-blase{max-width:82%}` — richtig für
       Gesprochenes, das links steht und rechts Luft lässt. Eine Karte mit
       Zahl, Balken und Kennzahlen ist aber kein Redebeitrag: sie verliert
       bei 82 % Breite fast ein Fünftel, und die grosse Zahl sitzt dann
       eingerückt statt am Rand.

       Trägt die Blase eine Karte, bekommt sie die volle Breite. */
    try {
      if (d.querySelector('.vi-sc')) d.classList.add('vi-rf-karte');
      if (d.querySelector(".vi-sc-zahl-n,.vi-sc-bar")) _rfKarteBeleben(d);
    } catch (e) {}
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
    _rfAnsEnde(chat);
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

  /* ═══ v1288b · Eine Verneinung darf auch ein SATZ sein ═════════════════
     Gemessen am 10.09.2026 im Sprechlauf. Auf „Muss etwas saniert werden,
     und wird etwas mitverkauft?" die Antwort:

       „Nichts zu sanieren, nichts wird mitverkauft"

     Ergebnis: ein KI-Aufruf, zwei Sekunden, und „Daraus konnte ich nichts
     entnehmen." Zwei Verneinungen auf eine Doppelfrage — die natuerlichste
     Antwort, die es auf diese Frage gibt.

     `RF_NEIN` verlangt, dass die Verneinung den GANZEN Text ausmacht. Das
     ist die richtige Vorsicht (v1283): „nichts unter 300.000" darf nicht
     als Verneinung durchgehen, sonst geht eine Angabe verloren. Aber der
     Satz oben besteht aus ZWEI Teilen, und jeder einzelne ist eine
     Verneinung.

     Also: an Komma, „und", „auch" und Punkt trennen, und nur dann
     verneinen, wenn JEDER Teil fuer sich eine Verneinung ist. Ein einziger
     Teil mit Inhalt — „nichts zu sanieren, Kueche bleibt drin" — und der
     ganze Satz geht wie bisher an die Auswertung.

     Die Ergaenzungen im Muster sind genau die Wendungen, die auf eine
     Doppelfrage passen: „nichts zu sanieren", „nichts wird mitverkauft",
     „nichts davon", „ist nichts", „alles in Ordnung", „alles gut". */
  var RF_NEIN_TEIL = new RegExp(
    '^(ist |war |wird |wurde |sind |es |da |dazu |davon |hier )*' +
    '(nichts|keine[rsn]?|kein|nein|nee|ne)' +
    '( (zu|weiter|davon|dabei|dazu|drin|dran|mit)?[a-zäöüß]*)*' +
    '( (zu )?(sanieren|machen|tun|erneuern|renovieren))?' +
    '( (wird|werden|ist|sind|war|waren)?( (mit)?(verkauft|uebernommen|übernommen|geplant|noetig|nötig|vorhanden|bekannt))?)*' +
    '[\\s.!]*$', 'i');
  var RF_ALLES_GUT = /^(alles (in ordnung|gut|ok|okay|klar|frisch|neu|saniert))[\s.!]*$/i;

  function _rfIstVerneinung(text) {
    var t = String(text || '').trim();
    if (!t) return false;
    if (RF_NEIN.test(t)) return true;
    /* Nur kurze Antworten: ein langer Satz mit einer Verneinung darin ist
       fast immer eine Angabe mit Einschraenkung, keine Absage. */
    if (t.split(/\s+/).length > 12) return false;
    var teile = t.split(/\s*(?:,|;|\bund\b|\bauch\b|\.|\/)\s*/i)
                 .map(function (s) { return s.trim(); })
                 .filter(function (s) { return s.length > 0; });
    if (teile.length < 2) return false;
    for (var i = 0; i < teile.length; i++) {
      if (!RF_NEIN.test(teile[i]) && !RF_NEIN_TEIL.test(teile[i]) && !RF_ALLES_GUT.test(teile[i])) return false;
    }
    return true;
  }

  /* ═══ v1286 · Ein Satz, zwei Anliegen ══════════════════════════════════
     Marcels Bild (design/mockups/sprechlauf.png). Er sagt:

       „Ich finanziere über die Sparkasse und du kannst es aus den
        Einstellungen übernehmen. Eigenkapital sind 10% vom Kaufpreis."

     Antwort: „Daraus konnte ich nichts entnehmen." Zwei Fehler auf einmal:

     1. Das Muster für die Profil-Übernahme verlangte die Wörter in FESTER
        Reihenfolge — erst „übernimm", dann „Einstellungen". Marcel sagt es
        andersherum („aus den Einstellungen übernehmen"), also griff es
        nicht. Jetzt zählt nur, dass BEIDE Teile vorkommen: eine
        Übernahme-Absicht und ein Wort für die Quelle. In welcher Folge,
        ist Sache des Sprechers.

     2. Selbst wenn es gegriffen hätte, wäre der zweite Satzteil verloren
        gewesen — die Übernahme sprang sofort zur nächsten Frage. Ein Satz
        kann aber zwei Anliegen tragen. Jetzt wird erst das Profil
        eingetragen und DANACH derselbe Satz ausgewertet; was ausdrücklich
        gesagt wurde, gewinnt gegen die Vorbelegung. „Eigenkapital sind
        10 % vom Kaufpreis" überschreibt also die 20 % aus den
        Einstellungen — und wird mit dem bekannten Kaufpreis gerechnet. */
  /* ═══ v1298 · „oder kann genauso bleiben" ══════════════════════════════
     Marcels Befund vom 11.09.2026 zu den Kaufnebenkosten: „das kannst du
     aus den Einstellungen übernehmen oder kann genauso bleiben. Das hat er
     überhaupt gar nicht verstanden."

     Der Satz trägt DREI Signale, und keines davon war vollständig erfasst:

     1. „aus den Einstellungen übernehmen" — das griff seit v1286, ABER nur
        wenn für diese Frage überhaupt ein Vorschlag vorliegt. Liefert
        `_pvNebenkosten()` nichts (kein Maklersatz im Profil, keine PLZ für
        die Grunderwerbsteuer), war `profilVorschlag` null und die Funktion
        stieg in Zeile eins aus. Der Nutzer bekam „nichts entnehmen" zu
        hören, obwohl er klar und richtig gesprochen hatte.
     2. „kann genauso bleiben" — eine Zustimmung zur VORBELEGUNG, die im
        Feld steht. Sie stand in keinem Muster.
     3. Das „oder" dazwischen: er nennt zwei Wege und überlässt die Wahl.
        Beide enden am selben Punkt — nimm, was du hast, frag mich nicht.

     `_rfWillProfil` erkennt jetzt alle drei. Ob am Ende etwas zu übernehmen
     IST, entscheidet der Aufrufer — und sagt es, wenn nicht. Eine Absicht
     nicht zu erkennen ist ein Fehler; sie zu erkennen und ehrlich zu
     melden, dass nichts hinterlegt ist, ist eine Auskunft. */
  function _rfWillProfil(text) {
    var t = String(text || '');
    if (!_rf) return false;
    /* Kurzform: „ja", „passt", „ok" - allein stehend. Nur sinnvoll, wenn
       tatsaechlich ein Vorschlag danebensteht, auf den sie sich beziehen. */
    if (_rf.profilVorschlag &&
        /^(ja|jo|jup|okay|ok|passt|gerne|gern|klar|mach das|einverstanden)\b[\s.!,]*$/i.test(t.trim())) return true;
    var quelle = /(einstellung|profil|vorgabe|standard|vorschlag|voreinstellung)/i.test(t);
    var wille  = /(übernimm|uebernimm|übernehmen|uebernehmen|nimm|nehmen|verwende|benutz|kannst du|kannst es|kannst die|hol|zieh)/i.test(t);
    if (quelle && wille) return true;
    /* „kann genauso bleiben", „lass es so", „so lassen", „bleibt wie es ist" */
    if (/\b(genauso|so)\s+(bleiben|lassen)\b/i.test(t)) return true;
    if (/\b(l(a|ä)ss?t?|lassen)\s+(es|das|die|den)?\s*(einfach\s+)?so\b/i.test(t)) return true;
    if (/\bbleibt?\s+(so|wie es ist|wies ist)\b/i.test(t)) return true;
    return false;
  }

  /* Profil eintragen, ohne die Frage abzuschliessen - der Satz kann noch
     mehr enthalten. Gibt zurueck, was eingetragen wurde. */

  /* v1288b · Werte aus den Einstellungen tragen IHRE Herkunft.
     Gemessen am 10.09.2026 im Sprechlauf: Zinssatz, Tilgung, Zinsbindung,
     Eigenkapital und alle vier Nebenkostensaetze standen in der
     Uebernahme-Tabelle unter „Sprachaufzeichnung" — gesprochen hatte
     davon niemand ein Wort. Es war ein Knopfdruck auf „Einstellungen
     uebernehmen". Derselbe Fehler wie bei einem abgerufenen Wert, nur
     eine Quelle weiter: was nicht gesagt wurde, darf nicht so aussehen. */
  function _rfProfilWerte(pv, herkunft) {
    if (!pv || !pv.werte || !_rf) return;
    if (!_rf.quelle) _rf.quelle = {};
    Object.keys(pv.werte).forEach(function (id) {
      _rf.data.fields[id] = pv.werte[id];
      _rf.quelle[id] = herkunft || 'Deine Einstellungen';
    });
  }
  function _rfProfilEintragen() {
    var pv = _rf && _rf.profilVorschlag;
    if (!pv || !pv.werte) return null;
    _rfProfilWerte(pv);
    _rf.profilVorschlag = null;
    var pb = $('vi-rf-passt'); if (pb) pb.style.display = 'none';
    return pv;
  }
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

  /* ═══════════════════════════════════════════════════════════════════
     v1290 · DIE ÜBERSICHTSSPALTE, NEU
     ═══════════════════════════════════════════════════════════════════
     Marcels Befund zu design/mockups/sprechlauf2.png: „Ich finde, dass es
     unübersichtlich ist. Wir sollten das deutlich übersichtlicher machen,
     was schon steht. Da stehen schon irgendwelche Werte drin. Man kann
     nicht alles sehen direkt."

     Zwei Ursachen, beide gemessen.

     ── 1. EIN KASKADEN-KONFLIKT, den nur der Walker zeigt ───────────────

     `.vi-rf-st` stand ZWEIMAL im selben Stylesheet:

         .vi-rf-st { display: block; padding: 6px 0 }        (v1286)
         .vi-rf-st { display: flex; gap: 7px; ... }          (aelter, spaeter notiert)

     **Bei gleicher Spezifitaet gewinnt die spaetere Regel** (CLAUDE.md) —
     also `flex`. Damit standen Blockname und Werte NEBENEINANDER statt
     untereinander, und die Werte wurden in eine 64 px schmale Spalte
     gequetscht, waehrend rechts daneben 250 px leer blieben. Genau das
     Bild, das Marcel geschickt hat.

     Die v1286-Regel „die Werte fluchten" war damit seit ihrer Einfuehrung
     wirkungslos. `element.matches()` haette beide Regeln gefunden und
     nichts darueber gesagt, welche gewinnt.

     ── 2. NUR 11 VON 16 ZEILEN WAREN SICHTBAR ──────────────────────────

     Gemessen: Spalte 410 px hoch, Inhalt 644 px. Fuenf Bloecke standen
     unter dem Rand. Eine Uebersicht, die man scrollen muss, um sie zu
     ueberblicken, ist keine.

     ── DIE NEUE SPALTE ─────────────────────────────────────────────────

     EINE ZEILE JE BLOCK, gruppiert nach ETAPPE. Die Werte stehen kompakt
     in derselben Zeile — nicht als Liste darunter, sondern als eine
     Zusammenfassung, die der Klick aufklappt. Damit passen alle Bloecke
     samt Etappenkoepfen ins Bild, und die Struktur des Sprechlaufs ist
     auf einen Blick da: wo war ich, wo bin ich, was kommt.

     Je Etappe steht rechts, wie viel davon beantwortet ist. Das ist der
     Fortschritt, den ein blosser Gesamtzaehler verschweigt. */

  /* Kompakte Fassung der Werte eines Blocks: „ETW · 100 m² · 3". */
  function _rfWerteKurz(werte) {
    return werte.map(function (w) { return w.v; }).join(' · ');
  }

  /* ═══ v1300b · „Was schon steht" auch beim freien Erzählen ══════════════
     Marcels Vorgabe vom 11.09.2026: „das können wir ja natürlich auch für
     den normalen Sprachabruf machen. Also wenn ich frei erzähle, dass wir
     dort dann auch einmal, was schon steht, dass wir das dort halt auch
     einmal auflisten."

     Der geführte Weg hat die Spalte seit `v1290`. Der freie hatte nur die
     Chips im Orbit — sie zeigen, was GERADE erkannt wurde, aber nicht, was
     insgesamt steht und was noch fehlt. Wer vier Minuten frei spricht, weiß
     am Ende nicht, ob er das Baujahr genannt hat.

     WARUM EINE EIGENE FUNKTION UND KEIN AUFRUF VON `_rfStandZeichnen`:
     die hängt an `_rf` — an Blockreihenfolge, aktuellem Index,
     übersprungenen Fragen. Nichts davon gibt es beim freien Erzählen. Was
     beide teilen, ist die DARSTELLUNG (dieselben CSS-Klassen) und die
     Gliederung nach Etappen; die Quelle ist eine andere.

     `_viFrei` sammelt, was die laufende Auswertung erkannt hat. Steht
     nichts darin, gilt das Formular — dieselbe Regel wie im geführten
     Weg. */
  var _viFrei = null;

  function _freiWerte(e) {
    var out = [];
    (e.ids || []).forEach(function (id) {
      var v = (_viFrei && _viFrei[id] != null && String(_viFrei[id]).trim() !== '')
        ? _viFrei[id] : null;
      var ausFormular = false;
      if (v == null) {
        var el = document.getElementById(id);
        v = el ? String(el.value || '').trim() : '';
        ausFormular = true;
      }
      if (v === '' || v == null) return;
      var el2 = document.getElementById(id);
      var name = id;
      try {
        var lab = el2 && el2.closest ? el2.closest('.fg,.form-group,label') : null;
        var l = lab ? lab.querySelector('label') : null;
        if (l) name = String(l.textContent || id).replace(/\s*\(.*?\)\s*$/, '').replace(/\*/g, '').trim();
      } catch (x) {}
      var anzeige = String(v);
      if (anzeige.indexOf(',') < 0 && /^-?[0-9]+\.[0-9]+$/.test(anzeige)) anzeige = anzeige.replace('.', ',');
      out.push({ n: name, v: anzeige, f: ausFormular });
    });
    return out;
  }

  function _freiStandZeichnen() {
    var host = $('vi-frei-stand'); if (!host) return;
    var gruppen = [], nachNr = {}, fertigN = 0, gesamtN = 0;
    RFRAGEN.forEach(function (e) {
      var werte = _freiWerte(e);
      /* Erledigt heisst: wenigstens ein Wert, der NICHT aus dem Formular
         kommt — also etwas, das in diesem Lauf gesprochen wurde. */
      var erledigt = werte.some(function (w) { return !w.f; });
      gesamtN++;
      if (erledigt) fertigN++;
      var nr = e.et || 0;
      if (!nachNr[nr]) { nachNr[nr] = { nr: nr, name: _etName(nr), zeilen: [], fertig: 0 }; gruppen.push(nachNr[nr]); }
      if (erledigt) nachNr[nr].fertig++;
      nachNr[nr].zeilen.push({ e: e, werte: werte, erledigt: erledigt });
    });

    var html = gruppen.map(function (g) {
      var kopf = g.nr
        ? '<div class="vi-rf-gr"><span class="vi-rf-gr-nr">' + g.nr + '</span>' +
          '<span class="vi-rf-gr-n">' + escH(g.name) + '</span>' +
          '<span class="vi-rf-gr-z">' + g.fertig + '/' + g.zeilen.length + '</span></div>'
        : '';
      return kopf + g.zeilen.map(function (z) {
        var zeichen = z.erledigt ? '✓' : (z.werte.length ? '◦' : '·');
        var wert = z.werte.length
          ? '<span class="vi-rf-st-v">' + escH(z.werte.map(function (w) { return w.v; }).join(' · ')) + '</span>'
          : '';
        return '<div class="vi-rf-st' + (z.erledigt ? ' ok' : '') + '">' +
               '<span class="vi-rf-st-z">' + zeichen + '</span>' +
               '<span class="vi-rf-st-n">' + escH(_rfKurzname(z.e)) + '</span>' + wert + '</div>';
      }).join('');
    }).join('');

    host.innerHTML =
      '<div class="vi-rf-stand-kopf">Was schon steht' +
        '<b>' + fertigN + ' / ' + gesamtN + '</b></div>' +
      '<div class="vi-rf-stand-body">' + html + '</div>';
  }

  function _rfStandZeichnen() {
    var host = $('vi-rf-stand'); if (!host || !_rf) return;
    /* v1283d: ALLE Blöcke, nicht nur die offenen. */
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

    /* Ein Block gilt als erledigt, wenn wenigstens EIN Wert nicht aus dem
       Formular kommt (`w.f` markiert die Formularherkunft, v1283d/v1288b). */
    function _echt(werte) {
      for (var i = 0; i < werte.length; i++) { if (!werte[i].f) return true; }
      return false;
    }

    /* Nach Etappe gruppieren; was keine trägt (freier Weg), kommt in eine
       namenlose Gruppe — dann sieht die Spalte aus wie bisher. */
    var gruppen = [], nachNr = {};
    var fertigN = 0, gesamtN = alle.length;
    alle.forEach(function (e, idx) {
      var werte = _rfWerteZuBlock(e);
      var i = idx - offenAb;
      var erledigt = _echt(werte);
      if (erledigt) fertigN++;
      var nr = e.et || 0;
      if (!nachNr[nr]) { nachNr[nr] = { nr: nr, name: _etName(nr), zeilen: [], fertig: 0 }; gruppen.push(nachNr[nr]); }
      if (erledigt) nachNr[nr].fertig++;
      nachNr[nr].zeilen.push({ e: e, werte: werte, i: i, erledigt: erledigt });
    });

    var html = gruppen.map(function (g) {
      var kopf = g.nr
        ? '<div class="vi-rf-gr"><span class="vi-rf-gr-nr">' + g.nr + '</span>' +
          '<span class="vi-rf-gr-n">' + escH(g.name) + '</span>' +
          '<span class="vi-rf-gr-z">' + g.fertig + '/' + g.zeilen.length + '</span></div>'
        : '';
      return kopf + g.zeilen.map(function (z) {
        var e = z.e, werte = z.werte, i = z.i;
        var dran = (i === _rf.i) && !z.erledigt;
        var uebersprungen = !!(_rf.weg && i >= 0 && _rf.weg[i]);
        var zeichen = z.erledigt ? '✓'
                    : (uebersprungen ? '–'
                    : (dran ? '▸' : (werte.length ? '◦' : '·')));
        var klasse = z.erledigt ? 'ok'
                   : (uebersprungen ? 'weg'
                   : (dran ? 'dran' : (werte.length ? 'vor' : '')));
        var kurz = werte.length ? _rfWerteKurz(werte) : '';
        var detail = werte.length
          ? '<div class="vi-rf-st-w">' + werte.map(function (w) {
              return '<span><i>' + escH(w.n) + '</i><b' + (w.f ? ' class="vorbelegt"' : '') + '>' +
                     escH(w.v) + '</b></span>';
            }).join('') + '</div>'
          : '';
        return '<div class="vi-rf-st ' + klasse + (werte.length ? ' hatwerte' : '') + '"' +
               (werte.length ? ' title="' + escH(kurz) + '"' : '') + '>' +
               '<div class="vi-rf-st-k">' +
                 '<span class="z">' + zeichen + '</span>' +
                 '<span class="n">' + escH(_rfKurzname(e)) + '</span>' +
                 (kurz ? '<span class="v' + (z.erledigt ? '' : ' vorbelegt') + '">' + escH(kurz) + '</span>' : '') +
               '</div>' + detail + '</div>';
      }).join('');
    }).join('');

    host.innerHTML =
      '<div class="vi-rf-stand-kopf">Was schon steht' +
        '<b>' + fertigN + ' / ' + gesamtN + '</b></div>' +
      '<div class="vi-rf-stand-body">' + html + '</div>';

    /* Ein Klick klappt die Einzelwerte auf — die Zusammenfassung in der
       Zeile reicht zum Ueberblicken, nicht zum Nachpruefen. */
    [].slice.call(host.querySelectorAll('.vi-rf-st.hatwerte')).forEach(function (z) {
      z.addEventListener('click', function () { z.classList.toggle('auf'); });
    });
    try {
      var dranEl = host.querySelector('.vi-rf-st.dran');
      if (dranEl) dranEl.scrollIntoView({ block: 'nearest' });
    } catch (ex) {}
  }

  /* Aus „Wie finanzierst du? Eigenkapital, Zinssatz, …" wird „Finanzierung".
     Die ganze Frage passt nicht in eine 210 px breite Spalte, und eine
     abgeschnittene Frage ist schlechter als ein kurzer Name. */
  var RF_KURZ = {
    plz: 'Adresse', objart: 'Objekt & Größe', baujahr: 'Baujahr & Kaufpreis',
    san: 'Sanierung & Inventar', nkm: 'Mieteinnahmen', hg_ul: 'Hausgeld',
    ek: 'Finanzierung', kaufdat: 'Kauf & Übergang', brw: 'Grundstück',
    makrolage: 'Lage', thesis: 'Deine Einschätzung',
    /* v1288 · die neuen Blöcke */
    makler_p: 'Kaufnebenkosten', ds2_zustand: 'Zustand & Energie',
    mietstg: 'Entwicklung', ds2_bevoelkerung: 'Markt & Potenzial',
    afa_satz: 'Steuer'
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

  /* ═══════════════════════════════════════════════════════════════════
     v1288 · DIE HALTE — was nach jeder Etappe herauskommt
     ═══════════════════════════════════════════════════════════════════
     Marcel: „dass wir im Deal-Score schon mal sagen: okay, wohin geht die
     Reise, lohnt sich das, lohnt sich das nicht."

     DIE ENTSCHEIDENDE REGEL: gerechnet wird aus dem GESPRAECH, nicht aus
     dem Formular. `DealScore.compute()` und `_buildDeal2FromState()` lesen
     beide aus dem DOM — sie sind hier unbrauchbar, denn im Sprechlauf
     steht noch nichts im Formular. Wuerden wir die Werte vorher
     hineinschreiben, um rechnen zu koennen, waere die Uebernahme-Tabelle
     am Ende sinnlos und der Schutz aus v1267 (Warnung vor dem
     Ueberschreiben) umgangen. Also: die REINEN Rechenkerne benutzen —
     `DealKpis.compute(i)` und `DealScore.computeFromKpis(k)` nehmen beide
     ein einfaches Objekt entgegen und fassen kein DOM an.

     Fuer den Deal Score 2 gibt es keinen solchen reinen Weg: sein
     Datenmodell ist ein eigenes (`kaufpreis`, `dscr`, `zustand`, `lage` …).
     Deshalb wird es hier gebaut — aus denselben KPIs plus den Lage- und
     Zustandsfeldern des Gespraechs. `DealScore2.compute(deal)` selbst
     bleibt unberuehrt; es ist der Rechenkern, und Rechenkerne werden nie
     dupliziert (CLAUDE.md).

     WAS ANGENOMMEN WIRD, STEHT DA. Jede Karte fuehrt ihre Annahmen mit:
     welcher Nebenkostensatz, woher der kommt, und dass das Darlehen als
     „Gesamtinvestition minus Eigenkapital" gerechnet ist. Eine Zahl ohne
     Herkunft ist im Sprechlauf dasselbe Problem wie im Marktbericht. */

  /* Die Stufen der Objektkarte (js/dashboard.js:390) — dieselben Worte,
     dieselben Schwellen. Versalien auf der Pille, Kamelschrift im Text. */
  function _stufe(score) {
    var s = Number(score);
    if (!isFinite(s)) return { wort: '–', kamel: '–', farbe: '#7A7370' };
    if (s >= 85) return { wort: 'TOP',       kamel: 'Top',       farbe: '#3FA56C' };
    if (s >= 70) return { wort: 'GUT',       kamel: 'Gut',       farbe: '#3FA56C' };
    if (s >= 50) return { wort: 'SOLIDE',    kamel: 'Solide',    farbe: 'var(--wl-b8932f, #b8932f)' };   /* v1290c: auf hellem Grund traegt das helle Gold nicht */
    if (s >= 35) return { wort: 'SCHWACH',   kamel: 'Schwach',   farbe: '#B8625C' };
    return          { wort: 'KRITISCH',  kamel: 'Kritisch',  farbe: '#D8564C' };
  }

  /* ── Die Kaufnebenkosten, die der Rechnung zugrunde liegen ──────────
     Drei Quellen in dieser Reihenfolge, und die Karte sagt, welche es war:
       1. gesagt      — der Nutzer hat die Saetze genannt
       2. Einstellung — Investmentprofil + amtlicher GrESt-Satz zur PLZ
       3. Pauschale   — 10 % vom Kaufpreis, Marcels ausdrueckliche Vorgabe
                        („Ansonsten kann man aber auch sagen 10 Prozent
                         vom Kaufpreis oder Sonstiges") */
  var NK_IDS = ['makler_p', 'notar_p', 'gba_p', 'gest_p', 'ji_p'];
  function _rfNkAnnahme() {
    var summe = 0, gesagt = 0, ausProfil = 0;
    NK_IDS.forEach(function (id) {
      var v = (_rf && _rf.data && _rf.data.fields) ? _rf.data.fields[id] : undefined;
      var n = _rfNum(v);
      if (n == null) return;
      summe += n; gesagt++;
      /* v1288b: WOHER der Wert kommt, steht in `_rf.quelle`. Ohne diese
         Unterscheidung meldete die Karte „von dir genannt" an Saetzen,
         die aus einem Knopfdruck auf „Einstellungen uebernehmen" kamen —
         gemessen am 10.09.2026: 12,27 %, kein Wort davon gesprochen. */
      var q = (_rf && _rf.quelle) ? _rf.quelle[id] : null;
      if (q) ausProfil++;
    });
    if (gesagt) {
      var alleAusProfil = (ausProfil === gesagt);
      return { pct: summe, quelle: alleAusProfil ? 'profil' : 'gesagt',
               text: 'Kaufnebenkosten ' + _pz(summe) + ' % — ' +
                     (alleAusProfil ? 'aus deinen Einstellungen übernommen' : 'von dir genannt') };
    }

    var pv = null;
    try { pv = _pvNebenkosten(); } catch (e) { pv = null; }
    if (pv && pv.werte) {
      var s2 = 0;
      Object.keys(pv.werte).forEach(function (id) { s2 += (_rfNum(pv.werte[id]) || 0); });
      if (s2 > 0) {
        var g = _rfGrest();
        return { pct: s2, quelle: 'profil',
                 text: 'Kaufnebenkosten ' + _pz(s2) + ' % — aus deinen Einstellungen' +
                       (g ? ', Grunderwerbsteuer ' + _pz(g.rate) + ' % für ' + g.name : '') };
      }
    }
    return { pct: 10, quelle: 'pauschal', text: 'Kaufnebenkosten 10 % pauschal — angenommen, nicht gesagt' };
  }

  function _pz(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }

  /* ── Die Kennzahlen aus dem Gespraech ───────────────────────────────
     Gibt null zurueck, wenn Kaufpreis oder Miete fehlen. Kein halber
     Score: „Wo die Quelle endet, endet die Rechnung." */
  function _rfKennzahlen() {
    if (!window.DealKpis || typeof window.DealKpis.compute !== 'function') return null;
    var kp  = _rfNum(_rfFeld('kp'));
    var nkm = _rfNum(_rfFeld('nkm'));
    if (kp == null || kp <= 0 || nkm == null || nkm <= 0) return null;

    var nk = _rfNkAnnahme();
    var nkEur = kp * nk.pct / 100;
    var san   = _rfNum(_rfFeld('san')) || 0;
    var moebl = _rfNum(_rfFeld('moebl')) || 0;
    var ze    = _rfNum(_rfFeld('ze')) || 0;
    var gi    = kp + nkEur + san + moebl;

    /* Eigenkapital: gesagt, sonst aus der EK-Quote der Einstellungen. */
    var ek = _rfNum(_rfFeld('ek')), ekQuelle = 'gesagt';
    if (ek == null) {
      var q = _profilZahl('ek_quote_default');
      if (q != null) { ek = kp * q / 100; ekQuelle = 'profil'; }
      else { ek = 0; ekQuelle = 'null'; }
    }
    /* Das Darlehen wird im Sprechlauf nicht gefragt — dort geht es um
       Eigenkapital. Also die Gegenrechnung: was nicht Eigenkapital ist,
       ist finanziert. Das steht als Annahme auf der Karte. */
    var d1 = Math.max(0, gi - ek);
    var d1z = _rfNum(_rfFeld('d1z'));
    var d1t = _rfNum(_rfFeld('d1t'));
    var zinsQuelle = 'gesagt';
    if (d1z == null) {
      try {
        var P = window.DealPilotInvestmentProfile;
        var z = (P && typeof P.getZins === 'function') ? P.getZins() : null;
        if (typeof z === 'number' && isFinite(z) && z > 0) { d1z = z; zinsQuelle = 'profil'; }
      } catch (e) {}
    }
    if (d1t == null) { d1t = _profilZahl('tilgung_default'); if (d1t != null) zinsQuelle = (zinsQuelle === 'gesagt' ? 'gemischt' : zinsQuelle); }

    /* Bewirtschaftung — dieselbe Aufteilung wie calc.js:1157/1158.
       Steht nichts, greifen die Quoten aus den Einstellungen. */
    var ul  = (_rfNum(_rfFeld('hg_ul'))  || 0) + (_rfNum(_rfFeld('grundsteuer')) || 0) + (_rfNum(_rfFeld('ul_sonst')) || 0);
    var nul = (_rfNum(_rfFeld('hg_nul')) || 0) + (_rfNum(_rfFeld('eigen_r'))     || 0) +
              (_rfNum(_rfFeld('mietausfall')) || 0) + (_rfNum(_rfFeld('nul_sonst')) || 0);
    var bwkQuelle = (ul || nul) ? 'gesagt' : 'profil';
    if (!ul && !nul) {
      var qUl = _profilZahl('bwk_ul_pct_default'), qNul = _profilZahl('bwk_anteil_default');
      if (qUl != null)  ul  = nkm * 12 * qUl / 100;
      if (qNul != null) nul = nkm * 12 * qNul / 100;
    }

    var afaSatz = _rfNum(_rfFeld('afa_satz'));
    var gebAnt  = _rfNum(_rfFeld('geb_ant'));
    var afa = 0;
    if (afaSatz != null && gebAnt != null) afa = gi * gebAnt / 100 * afaSatz / 100;

    var K = window.DealKpis.compute({
      kp: kp, nk: nkEur, san: san, moebl: moebl,
      nkm: nkm, ze: ze,
      bwk_ul: ul, bwk_nul: nul,
      d1: d1, d1z: d1z || 0, d1t: d1t || 0,
      ek: ek, afa: afa, grenz: _rfNum(_rfFeld('grenz')) || 0
    });

    /* Wertpuffer: nur, wenn es einen Verkehrswert GIBT. Ohne
       Marktpreisindikation gibt es keinen — dann ist der Puffer 0 und
       nicht etwa „unbekannt gleich gut" (calc.js:1506 macht es genauso). */
    var svw = _rfNum(_rfFeld('svwert'));
    if (svw == null && _rf && _rf.markt && _rf.markt.mw) svw = _rf.markt.mw;
    var wp = (svw != null && svw > 0) ? (svw - kp) : 0;

    return {
      K: K, kp: kp, nkm: nkm, ze: ze, gi: gi, ek: ek, d1: d1,
      d1z: d1z, d1t: d1t, nk: nk, nkEur: nkEur, wp: wp, svw: svw,
      quellen: { ek: ekQuelle, zins: zinsQuelle, bwk: bwkQuelle }
    };
  }

  /* ── Deal Score (Stufe 1) ─────────────────────────────────────────── */
  function _rfScore1() {
    var Z = _rfKennzahlen();
    if (!Z || !window.DealScore || typeof window.DealScore.computeFromKpis !== 'function') return null;
    var S = window.DealScore.computeFromKpis({
      kp: Z.kp, cf_m: Z.K.cf_m || 0, nmy: Z.K.nmy || 0, ltv: Z.K.ltv || 0,
      dscr: Z.K.dscr || 0, wp_kpi: Z.wp, mstg: _rfNum(_rfFeld('mietstg')) || 1.5
    });
    return { S: S, Z: Z };
  }

  /* ── Deal Score 2 (Stufe 2) ───────────────────────────────────────── */
  var _ML_MAP = { sehr_gut: 'sehr_gut', gut: 'gut', durchschnittlich: 'mittel',
                  schwach: 'einfach', sehr_schwach: 'problematisch' };
  function _rfScore2() {
    var Z = _rfKennzahlen();
    if (!Z || !window.DealScore2 || typeof window.DealScore2.compute !== 'function') return null;
    var K = Z.K, wfl = _rfNum(_rfFeld('wfl'));
    var deal = {};
    deal.bruttorendite = K.bmy;
    deal.nettorendite  = K.nmy;
    deal.cashflowMonatlich = K.cf_m;
    deal.cashOnCash = (Z.ek > 0 && K.cf_ns != null) ? (K.cf_ns / Z.ek) * 100
                    : (K.cf_ns > 0 ? 999 : (K.cf_ns < 0 ? -50 : 0));
    deal.dscr = K.dscr;
    deal.ltv  = K.ltv;
    deal.zinsSatz = Z.d1z;
    deal.tilgung  = Z.d1t;
    deal.eigenkapitalQuote = (Z.gi > 0) ? (Z.ek / Z.gi) * 100 : null;
    deal.leerstandPct = _rfNum(_rfFeld('leerstand'));
    if (K.bwk_nul > 0 && Z.nkm > 0) deal.instandhaltungPctNkm = (K.bwk_nul * 0.35) / (Z.nkm * 12) * 100;
    deal.zustand       = _rfFeld('ds2_zustand') || null;
    deal.energieKlasse = _rfFeld('ds2_energie') || null;
    deal.mietausfallRisiko = _rfFeld('ds2_mietausfall') || null;
    if (wfl != null && wfl > 0) deal.istMieteEurQm = (Z.nkm + Z.ze) / wfl;
    deal.marktmieteEurQm = _rfNum(_rfFeld('ds2_marktmiete'));
    if (deal.marktmieteEurQm == null && _rf && _rf.markt && _rf.markt.mietSqm) deal.marktmieteEurQm = _rf.markt.mietSqm;
    deal.mietwachstumPct = _rfNum(_rfFeld('mietstg'));
    deal.bevoelkerung = _rfFeld('ds2_bevoelkerung') || null;
    deal.nachfrage    = _rfFeld('ds2_nachfrage') || null;
    deal.mikrolage    = _ML_MAP[_rfFeld('mikrolage')] || null;
    if (Z.kp > 0 && Z.nkm > 0) deal.eigenerFaktor = Z.kp / (Z.nkm * 12);
    deal.marktFaktor = _rfNum(_rfFeld('ds2_marktfaktor'));
    deal.wertsteigerung = _rfFeld('ds2_wertsteigerung') || null;
    deal.entwicklungsmoeglichkeiten = _rfFeld('ds2_entwicklung') || null;
    var R = window.DealScore2.compute(deal);
    return { R: R, Z: Z, deal: deal };
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1292 · AUS ZAHLEN WIRD EINE ENTSCHEIDUNG
     ═══════════════════════════════════════════════════════════════════
     Marcels Auftrag: „Mach da einfach was richtig Geiles, dass man, wenn
     man da durchgeführt wird, direkt eine Kaufentscheidung treffen kann."

     Ein Score allein trifft keine Entscheidung. Was fehlt, sind drei
     Dinge, und alle drei lassen sich RECHNEN — keins davon ist geraten:

       1. WANN LOHNT ES SICH?      Break-even.
       2. WAS IST NOCH DRIN?       Mietpotenzial gegen die Marktmiete.
       3. WAS MUESSTE SICH AENDERN? Die Hebel, mit ihrer Wirkung in Punkten.

     ── 1. BREAK-EVEN ───────────────────────────────────────────────────
     `IrrEngine.breakEven(cfReihe, ek)` ist ein reiner Rechenkern — er
     nimmt eine Zahlungsreihe und gibt drei Jahre zurueck: wann der
     Cashflow positiv wird, wann die Summe positiv wird, wann das
     Eigenkapital zurueck ist. Denselben, den die Kennzahlen-Kachel nutzt.

     Die REIHE muss der Sprechlauf bauen, und dabei ist er ehrlich: er
     rechnet mit Mietsteigerung und Kostensteigerung, aber ohne
     Tilgungsverlauf, Steuerwirkung und Anschlussfinanzierung — die
     braeuchten Angaben, die im Gespraech nicht alle fallen. Das steht
     als Annahme auf der Karte. Eine Naeherung, die sich als solche zeigt,
     ist brauchbar; eine, die sich als Rechnung ausgibt, nicht.

     ── 2. MIETPOTENZIAL ────────────────────────────────────────────────
     Marcel: „mit der Marktpreisindikation holen wir uns ja auch gleich
     passend die Marktmieten mit rein. Dass wir das einmal abgleichen,
     dann auch Mietpotenzial angeben und vielleicht auch eine Steigerung."

     Die Marktmiete kommt aus der Marktpreisindikation (`rent.median_per_sqm`),
     die Ist-Miete aus dem Gespraech. Die Luecke dazwischen ist das
     Potenzial — in Euro je Monat und im Jahr.

     UND DANN WIRD ES MIETRECHT, nicht Rechnen. Marcels Punkt: „je nachdem,
     was du vorhast, die Wohnung ist ja vermietet, was das fuer ein
     Mietvertrag ist … wenn's ein Indexmietvertrag ist, dann kannst du
     halt keine Renovierungsmassnahmen geltend machen … ansonsten
     koenntest du vielleicht nach drei Jahren erhoehen. Vielleicht schaut
     man dann in der Region auch, ob's da eine Kappungsgrenze ist."

     Was hier steht, ist BEWUSST allgemein gehalten und als Hinweis
     gekennzeichnet — es ist keine Rechtsberatung, und die Kappungsgrenze
     haengt an einer Verordnung des jeweiligen Landes, die wir nicht
     fuehren. Der Co-Pilot sagt, WAS zu pruefen ist, und rechnet, WAS es
     brachte. Das Pruefen bleibt beim Nutzer.

     ── 3. DIE HEBEL ────────────────────────────────────────────────────
     Marcel: „wenn das und das, die und die Werte sind nicht so gut, wenn
     du die und die steigern koenntest, dann waere es super."

     Das laesst sich BEWEISEN statt behaupten: `DealScore2.compute(deal)`
     ist rein. Also wird der Deal einmal mit einer realistischen Aenderung
     nachgerechnet und die Differenz gezeigt — „Kaufpreis 5 % tiefer:
     Score +7". Keine Faustregel, kein Gefuehl: dieselbe Rechnung, ein
     Wert anders.

     Gezeigt werden nur Hebel, die wirklich etwas bewegen (>= 2 Punkte),
     hoechstens vier, der staerkste zuerst. */

  /* Die Zahlungsreihe fuer den Break-even. Bewusst schlicht und benannt. */
  function _rfCfReihe(Z, jahre) {
    if (!Z || !Z.K) return null;
    jahre = jahre || 15;
    var mietStg = (_rfNum(_rfFeld('mietstg')) || 1.5) / 100;
    var kostStg = (_rfNum(_rfFeld('kostenstg')) || 2.0) / 100;
    var K = Z.K;
    var mieteJ = K.nkm_j || 0;
    var bwkJ   = K.bwk_cf || 0;
    var rateJ  = K.rate_j || 0;
    var reihe = [];
    for (var i = 0; i < jahre; i++) {
      var m = mieteJ * Math.pow(1 + mietStg, i);
      var b = bwkJ   * Math.pow(1 + kostStg, i);
      reihe.push(m - b - rateJ);
    }
    return reihe;
  }

  function _rfBreakEven(Z) {
    try {
      if (!window.IrrEngine || typeof window.IrrEngine.breakEven !== 'function') return null;
      var reihe = _rfCfReihe(Z, 20);
      if (!reihe) return null;
      var be = window.IrrEngine.breakEven(reihe, Z.ek || 0);
      return { cf: be.cf, kum: be.kum, kumEk: be.kumEk, reihe: reihe };
    } catch (e) { return null; }
  }

  /* ── Mietpotenzial ───────────────────────────────────────────────── */
  function _rfMietPotenzial(Z) {
    var wfl = _rfNum(_rfFeld('wfl'));
    if (!Z || !wfl || wfl <= 0) return null;
    var ist = (Z.nkm || 0) / wfl;
    var markt = _rfNum(_rfFeld('ds2_marktmiete'));
    if (markt == null && _rf && _rf.markt && _rf.markt.mietSqm != null) markt = _rf.markt.mietSqm;
    if (markt == null || markt <= 0) return null;
    var diffQm = markt - ist;
    var diffMon = diffQm * wfl;
    return {
      ist: ist, markt: markt, diffQm: diffQm, diffMon: diffMon,
      diffJahr: diffMon * 12,
      pct: ist > 0 ? (diffQm / ist * 100) : null,
      /* v1292b: WOHER die Marktmiete kommt, steht in _rf.quelle — nicht
         daran, ob das Feld gefuellt ist. Die Marktpreisindikation FUELLT
         es ja; die alte Pruefung meldete deshalb „deine Angabe" an einem
         Wert, den der Co-Pilot selbst geholt hatte. */
      quelle: (_rf && _rf.quelle && _rf.quelle['ds2_marktmiete']) || 'deine Angabe'
    };
  }

  /* ═══ v1295 · Wie viel davon ist WIRKLICH erreichbar ═══════════════════
     Marcels Punkt: „Vielleicht schaut man dann in der Region auch, ob's da
     eine Kappungsgrenze ist und ob man dann schon oben liegt und ob man da
     noch erhoehen koennte."

     Das Mietpotenzial allein beantwortet das nicht. 292 € im Monat klingen
     nach 292 € — im laufenden Vertrag sind es aber hoechstens, was die
     KAPPUNGSGRENZE zulaesst: +20 % in drei Jahren, in Gebieten mit
     angespanntem Wohnungsmarkt +15 %, und in beiden Faellen nie ueber die
     ortsuebliche Vergleichsmiete hinaus.

     Also wird die Luecke GETEILT:

       im Vertrag erreichbar  = min(Marktmiete, Ist x 1,20) - Ist
       erst bei Neuvermietung = der Rest

     GERECHNET WIRD MIT 20 %, nicht mit 15. Ob ein Ort als angespannt gilt,
     steht in einer Verordnung des jeweiligen Landes, die wir nicht fuehren
     — und die 15 % zu unterstellen, wo sie vielleicht nicht gelten, waere
     eine erfundene Einschraenkung. Der Hinweis steht daneben: wer in einem
     solchen Gebiet kauft, rechnet mit 15.

     DIE MARKTMIETE IST DIE GRENZE, nicht ein Wunsch: liegt die Ist-Miete
     schon nahe am Markt, ist die Kappungsgrenze gar nicht das Hindernis —
     dann steht da „du liegst schon fast oben", und das ist die ehrlichere
     Auskunft als eine Prozentzahl. */
  function _rfMietSpielraum(P) {
    if (!P || !P.ist || !P.markt || P.diffMon <= 0) return null;
    var wfl = _rfNum(_rfFeld('wfl'));
    if (!wfl || wfl <= 0) return null;
    var istMon    = P.ist * wfl;
    var marktMon  = P.markt * wfl;
    var kappMon   = istMon * 1.20;              /* Kappungsgrenze, Regelfall */
    var kapp15Mon = istMon * 1.15;              /* angespannter Markt */
    var imVertrag   = Math.max(0, Math.min(marktMon, kappMon) - istMon);
    var imVertrag15 = Math.max(0, Math.min(marktMon, kapp15Mon) - istMon);
    var rest        = Math.max(0, marktMon - istMon - imVertrag);
    return {
      istMon: istMon, marktMon: marktMon,
      imVertrag: imVertrag, imVertrag15: imVertrag15, rest: rest,
      /* Bremst die Kappungsgrenze, oder ist der Markt schon fast erreicht? */
      gebremst: kappMon < marktMon,
      ausgereizt: (marktMon - istMon) / istMon < 0.05
    };
  }

  /* Was mit dem Potenzial anzufangen ist — Mietrecht in Stichworten,
     ausdruecklich als Hinweis, nicht als Beratung. */
  function _rfMietWege(P) {
    if (!P || P.diffMon <= 20) return '';
    var S = _rfMietSpielraum(P);
    var kopf = '';
    if (S) {
      kopf = '<div class="vi-mp-teil">' +
        (S.gebremst
          ? '<div class="vi-mp-z"><i>Im laufenden Vertrag</i><b>bis ' + _euroKurz(S.imVertrag) + '/Mon</b></div>' +
            '<div class="vi-mp-z"><i>Erst bei Neuvermietung</i><b>' + _euroKurz(S.rest) + '/Mon</b></div>' +
            '<small>Die <b>Kappungsgrenze</b> deckelt die Anhebung auf 20 % in drei Jahren — und nie über ' +
            'die ortsübliche Vergleichsmiete hinaus. In Gebieten mit angespanntem Wohnungsmarkt sind es ' +
            'nur 15 %, dann wären es <b>' + _euroKurz(S.imVertrag15) + '/Mon</b>. Ob dein Ort dazugehört, ' +
            'steht in der Verordnung deines Bundeslandes.</small>'
          : '<div class="vi-mp-z"><i>Im laufenden Vertrag erreichbar</i><b>' + _euroKurz(S.imVertrag) + '/Mon</b></div>' +
            '<small>Die Kappungsgrenze (20 % in drei Jahren) bremst hier <b>nicht</b> — der Abstand zur ' +
            'ortsüblichen Vergleichsmiete ist kleiner als das, was sie zuließe. Die Miete ist die Grenze, ' +
            'nicht das Gesetz.</small>') +
        '</div>';
    }
    var wege = [];
    wege.push('<b>Bei Neuvermietung</b> ist der Sprung sofort möglich — dort begrenzt nur eine ' +
              'etwaige Mietpreisbremse, nicht die Kappungsgrenze.');
    wege.push('<b>Im laufenden Vertrag</b> geht eine Anhebung zur ortsüblichen Vergleichsmiete ' +
              'frühestens 15 Monate nach der letzten Änderung, und die <b>Kappungsgrenze</b> ' +
              'deckelt sie auf 20 % in drei Jahren — in Gebieten mit angespanntem Wohnungsmarkt ' +
              'auf 15 %. Ob dein Ort dazugehört, steht in der Verordnung deines Bundeslandes.');
    wege.push('<b>Index- oder Staffelmietvertrag?</b> Dann gilt die Vereinbarung statt der ' +
              'Vergleichsmiete — und bei einem Indexmietvertrag lässt sich eine Modernisierung ' +
              '<b>nicht</b> zusätzlich umlegen. Das ändert die Rechnung für eine Sanierung.');
    wege.push('<b>Nach einer Modernisierung</b> sind bis zu 8 % der Kosten jährlich umlegbar, ' +
              'gedeckelt auf 3 €/m² in sechs Jahren (bei Mieten unter 7 €/m²: 2 €).');
    return kopf +
           '<details class="vi-sc-mehr"><summary>Wie du da hinkommst</summary>' +
           wege.map(function (w) { return '<div class="vi-lg-t">' + w + '</div>'; }).join('') +
           '<div class="vi-lg-t" style="opacity:.6">Das sind Anhaltspunkte, keine Rechtsberatung — ' +
           'welcher Weg offensteht, hängt an deinem Mietvertrag und am Ort.</div>' +
           '</details>';
  }

  /* ── Die Hebel: gerechnet, nicht geraten ─────────────────────────────
     v1292b · IN STUFEN, nicht mit einem festen Schritt.

     Gemessen am Testobjekt (200.000 € bei 490 € Miete, Score 53): ein
     Kaufpreis 5 % tiefer aenderte den Score um **null Punkte**. Kein
     Fehler — bei einem so schwachen Objekt liegen die Renditekennzahlen
     am unteren Anschlag, und dort ist die Interpolation flach. Vom Boden
     faellt man nicht tiefer, aber man steigt auch nicht leicht auf.

     Ergebnis war eine LEERE Hebel-Liste — ausgerechnet dort, wo man sie
     am dringendsten braucht. Ein Ratgeber, der bei einem schlechten Deal
     schweigt, ist kein Ratgeber.

     Jetzt wird je Hebel eine STAFFEL probiert und der KLEINSTE Schritt
     gezeigt, der wirklich etwas bewegt. „Kaufpreis 15 % tiefer: +6" sagt
     mehr als Schweigen — und es ist dieselbe Rechnung, nur ehrlicher
     dosiert.

     Und die Miete bekommt einen eigenen Zielwert: liegt eine Marktmiete
     vor, wird auf sie gerechnet statt auf einen Prozentsatz. „Miete auf
     Marktniveau (782 €): +9" ist ein Satz, mit dem man etwas anfangen
     kann. Damit hängen Mietpotenzial und Hebel an derselben Zahl. */
  function _rfHebelProben() {
    var kp = _rfNum(_rfFeld('kp')), nkm = _rfNum(_rfFeld('nkm'));
    var ek = _rfNum(_rfFeld('ek')) || 0, d1z = _rfNum(_rfFeld('d1z')), d1t = _rfNum(_rfFeld('d1t'));
    var wfl = _rfNum(_rfFeld('wfl'));
    var P = null; try { P = _rfMietPotenzial(_rfKennzahlen()); } catch (e) {}
    var proben = [];

    if (kp > 0) proben.push({ id: 'kp', wie: 'Verhandeln — der stärkste Hebel, den du selbst in der Hand hast.',
      stufen: [0.05, 0.10, 0.15, 0.20].map(function (q) {
        return { wert: Math.round(kp * (1 - q)),
                 txt: 'Kaufpreis <b>' + Math.round(q * 100) + ' % tiefer</b> (' + _euroKurz(kp * (1 - q)) + ')' };
      }) });

    if (nkm > 0) {
      var mietStufen = [];
      /* Der Marktwert zuerst: er ist kein Wunsch, sondern eine Zahl. */
      if (P && P.diffMon > 20 && wfl > 0) {
        mietStufen.push({ wert: Math.round(P.markt * wfl),
          txt: 'Miete auf <b>Marktniveau</b> (' + _euroKurz(P.markt * wfl) + '/Mon)' });
      }
      [0.10, 0.20, 0.30].forEach(function (q) {
        mietStufen.push({ wert: Math.round(nkm * (1 + q)),
          txt: 'Miete <b>' + Math.round(q * 100) + ' % höher</b> (' + _euroKurz(nkm * (1 + q)) + '/Mon)' });
      });
      proben.push({ id: 'nkm', stufen: mietStufen,
        wie: 'Über Neuvermietung, Anhebung zur Vergleichsmiete oder Modernisierung.' });
    }

    if (kp > 0) proben.push({ id: 'ek', wie: 'Senkt LTV und Kapitaldienst — wirkt auf Finanzierung und Risiko zugleich.',
      stufen: [0.10, 0.20, 0.30].map(function (q) {
        return { wert: Math.round(ek + kp * q),
                 txt: '<b>' + Math.round(q * 100) + ' % mehr Eigenkapital</b> (' + _euroKurz(ek + kp * q) + ')' };
      }) });

    if (d1z > 0) proben.push({ id: 'd1z', wie: 'Mehrere Banken anfragen, Eigenkapital oder Sicherheiten nachlegen.',
      stufen: [0.5, 1.0].filter(function (s) { return d1z - s > 0.3; }).map(function (s) {
        return { wert: String(Math.round((d1z - s) * 100) / 100).replace('.', ','),
                 txt: 'Zins <b>' + _pz(s) + ' Punkt' + (s === 1 ? '' : 'e') + ' tiefer</b> (' + _pz(d1z - s) + ' %)' };
      }) });

    if (d1t > 0) proben.push({ id: 'd1t', wie: 'Kostet Cashflow, bringt Entschuldung — der Score wägt beides ab.',
      stufen: [1, 2].map(function (s) {
        return { wert: String(Math.round((d1t + s) * 100) / 100).replace('.', ','),
                 txt: 'Tilgung <b>' + _pz(s) + ' Punkt' + (s === 1 ? '' : 'e') + ' höher</b> (' + _pz(d1t + s) + ' %)' };
      }) });

    return proben.filter(function (p) { return p.stufen && p.stufen.length; });
  }

  function _rfHebel() {
    var basis = _rfScore2();
    if (!basis || !basis.R) return [];
    var b = Math.round(basis.R.score);
    var raus = [];
    _rfHebelProben().forEach(function (p) {
      var alt = _rf.data.fields[p.id];
      var treffer = null;
      for (var i = 0; i < p.stufen.length; i++) {
        var s = p.stufen[i];
        _rf.data.fields[p.id] = String(s.wert);
        var neu = null;
        try { var r = _rfScore2(); neu = r ? Math.round(r.R.score) : null; } catch (e) {}
        if (neu != null && (neu - b) >= 2) { treffer = { txt: s.txt, plus: neu - b, ziel: neu }; break; }
      }
      if (alt === undefined) delete _rf.data.fields[p.id]; else _rf.data.fields[p.id] = alt;
      if (treffer) { treffer.wie = p.wie; raus.push(treffer); }
    });
    raus.sort(function (x, y) { return y.plus - x.plus; });
    return raus.slice(0, 4);
  }

  /* ── Die Karten ───────────────────────────────────────────────────── */
  function _zeile(name, wert, ton) {
    return '<span class="vi-sc-z' + (ton ? ' ' + ton : '') + '"><i>' + escH(name) + '</i><b>' + escH(wert) + '</b></span>';
  }
  function _pctTxt(n, d) {
    if (n == null || !isFinite(n)) return '–';
    return String(Math.round(n * Math.pow(10, d || 1)) / Math.pow(10, d || 1)).replace('.', ',') + ' %';
  }

  /* ═══ v1292 · Die Zahl zaehlt hoch, und ein Top-Deal leuchtet ══════════
     Marcels Wunsch: „Deal Score und Deal Score zwei muss richtig geil son
     bisschen animiert werden mit den Zahlen, vielleicht der Deal Score
     etwas leuchtend oder so."

     Die Animation laeuft ueber `requestAnimationFrame` — aber NUR, wenn
     der Reiter sichtbar ist: im verborgenen Tab feuert rAF nie, und die
     Zahl bliebe auf 0 stehen (FALLEN.md). Deshalb prueft `_zahlAnimieren`
     `document.visibilityState` und setzt sonst sofort den Endwert.

     Das Leuchten haengt an der STUFE, nicht am Geschmack: ab 85 (TOP) ein
     kraeftiger Schein, ab 70 (GUT) ein zurueckhaltender. Darunter gar
     keiner — ein schwacher Deal, der leuchtet, waere eine Luege in
     Lichtform. */
  function _zahlAnimieren(el, ziel, dauer) {
    if (!el) return;
    var end = Number(ziel) || 0;
    try {
      if (document.visibilityState === 'hidden') { el.textContent = String(end); return; }
    } catch (e) {}
    var t0 = null, ms = dauer || 1100;
    function schritt(t) {
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / ms);
      /* Weich auslaufend — die letzten Punkte sollen "ankommen", nicht
         durchrauschen. */
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(end * e));
      if (p < 1) requestAnimationFrame(schritt);
      else el.textContent = String(end);
    }
    try { requestAnimationFrame(schritt); } catch (e) { el.textContent = String(end); }
  }

  /* Nach dem Einfuegen einer Karte: Zahlen animieren, Balken fuellen. */
  function _rfKarteBeleben(wurzel) {
    if (!wurzel) return;
    [].slice.call(wurzel.querySelectorAll('.vi-sc-zahl-n[data-ziel]')).forEach(function (el) {
      _zahlAnimieren(el, parseInt(el.getAttribute('data-ziel'), 10) || 0);
    });
    [].slice.call(wurzel.querySelectorAll('.vi-sc-bar i[data-w]')).forEach(function (b, i) {
      setTimeout(function () { b.style.width = b.getAttribute('data-w') + '%'; }, 90 + i * 70);
    });
  }

  /* Der Kopf einer Score-Karte: grosse Zahl, Stufe, Leuchten. */
  function _scoreKopf(titel, score, st, unter) {
    var glanz = score >= 85 ? ' top' : (score >= 70 ? ' gut' : '');
    return '<div class="vi-sc-kopf"><span class="vi-sc-titel">' + escH(titel) + '</span>' +
      '<span class="vi-sc-pille" style="color:' + st.farbe + ';border-color:' + st.farbe + '">' + st.wort + '</span></div>' +
      '<div class="vi-sc-zahl' + glanz + '" style="color:' + st.farbe + '">' +
        '<span class="vi-sc-zahl-n" data-ziel="' + Math.round(score) + '">0</span>' +
        '<small>/ 100</small>' +
        (unter ? '<em>' + escH(unter) + '</em>' : '') +
      '</div>' +
      '<div class="vi-sc-bar"><i data-w="' + Math.max(0, Math.min(100, Math.round(score))) +
        '" style="background:' + st.farbe + '"></i></div>';
  }

  function _rfScore1Karte() {
    var r = _rfScore1();
    if (!r) return null;
    var S = r.S, Z = r.Z, K = Z.K, st = _stufe(S.score);
    var cf = K.cf_m || 0;
    var annahmen = [Z.nk.text];
    if (Z.quellen.ek === 'profil')   annahmen.push('Eigenkapital aus deiner Standard-Quote');
    if (Z.quellen.zins !== 'gesagt') annahmen.push('Zins und Tilgung aus deinen Einstellungen');
    if (Z.quellen.bwk === 'profil')  annahmen.push('Bewirtschaftung als Quote der Kaltmiete');
    annahmen.push('Darlehen = Gesamtinvestition minus Eigenkapital');

    /* v1292: Break-even — „ab wann lohnt es sich" ist die Frage, die ein
       Score allein nicht beantwortet. */
    var be = _rfBreakEven(Z), beZeile = '';
    if (be) {
      var teile = [];
      if (be.cf)    teile.push('Cashflow ab Jahr <b>' + be.cf + '</b>');
      else          teile.push('Cashflow bleibt in 20 Jahren negativ');
      if (be.kum)   teile.push('Summe im Plus ab Jahr <b>' + be.kum + '</b>');
      if (be.kumEk) teile.push('Eigenkapital zurück in Jahr <b>' + be.kumEk + '</b>');
      beZeile = '<div class="vi-sc-be"><b>Break-even</b> ' + teile.join(' · ') +
        '<small>Gerechnet mit ' + _pctTxt(_rfNum(_rfFeld('mietstg')) || 1.5) + ' Mietsteigerung und ' +
        _pctTxt(_rfNum(_rfFeld('kostenstg')) || 2.0) + ' Kostensteigerung, ohne Tilgungsverlauf, ' +
        'Steuerwirkung und Anschlussfinanzierung — die kommen in der vollen Rechnung dazu.</small></div>';
    }

    return '<div class="vi-sc">' +
      _scoreKopf('Deal Score · Zwischenstand', S.score, st, S.label) +
      '<div class="vi-sc-gitter">' +
        _zeile('Cashflow', _euroKurz(cf) + '/Mon', cf >= 0 ? 'gut' : 'schlecht') +
        _zeile('Nettomietrendite', _pctTxt(K.nmy, 2)) +
        _zeile('Faktor', K.fak != null ? String(Math.round(K.fak * 10) / 10).replace('.', ',') : '–') +
        _zeile('LTV', _pctTxt(K.ltv, 1)) +
        _zeile('DSCR', K.dscr != null ? String(Math.round(K.dscr * 100) / 100).replace('.', ',') : '–',
               (K.dscr || 0) >= 1.1 ? 'gut' : 'schlecht') +
        _zeile('Gesamtinvestition', _euroKurz(Z.gi)) +
      '</div>' + beZeile +
      '<div class="vi-sc-text">' + escH(S.interpretation || '') + '</div>' +
      '<div class="vi-sc-annahmen"><b>Gerechnet mit:</b> ' + escH(annahmen.join(' · ')) + '</div>' +
    '</div>';
  }

  function _rfScore2Karte() {
    var r = _rfScore2();
    if (!r) return null;
    var R = r.R, Z = r.Z, st = _stufe(R.score);
    var cats = R.categories || {};
    var namen = { rendite: 'Rendite', finanzierung: 'Finanzierung', risiko: 'Risiko', lage: 'Lage', upside: 'Upside' };
    var gitter = Object.keys(namen).map(function (k) {
      var c = cats[k];
      if (!c) return '';
      var s = Math.round(c.score || 0);
      return _zeile(namen[k], s + ' / 100', s >= 70 ? 'gut' : (s < 50 ? 'schlecht' : ''));
    }).join('');
    var vollst = '';
    try {
      var av = 0, ge = 0;
      Object.keys(cats).forEach(function (k) { av += (cats[k].availableKpis || 0); ge += (cats[k].totalKpis || 0); });
      if (ge) vollst = av + ' von ' + ge + ' Kennzahlen belegt';
    } catch (e) {}

    /* v1292 · Mietpotenzial gegen die Marktmiete. */
    var P = _rfMietPotenzial(Z), mp = '';
    if (P && Math.abs(P.diffMon) >= 15) {
      var hoch = P.diffMon > 0;
      mp = '<div class="vi-sc-mp' + (hoch ? ' plus' : ' minus') + '">' +
        '<b>' + (hoch ? 'Mietpotenzial' : 'Über Marktniveau') + '</b> ' +
        'Du liegst bei <b>' + escH(String(Math.round(P.ist * 100) / 100).replace('.', ',')) + ' €/m²</b>, ' +
        'der Markt bei <b>' + escH(String(Math.round(P.markt * 100) / 100).replace('.', ',')) + ' €/m²</b>' +
        ' <span style="opacity:.6">(' + escH(P.quelle) + ')</span>. ' +
        (hoch
          ? 'Das sind <b>' + _euroKurz(P.diffMon) + ' im Monat</b> oder ' + _euroKurz(P.diffJahr) +
            ' im Jahr, die noch nicht in der Rechnung stehen.'
          : 'Die Miete liegt <b>' + _euroKurz(-P.diffMon) + '/Mon über</b> dem Marktniveau — ' +
            'bei einem Mieterwechsel könnte sie sinken. Das ist ein Risiko, kein Potenzial.') +
        (hoch ? _rfMietWege(P) : '') +
      '</div>';
    }

    /* v1292 · Die Hebel — gerechnet, nicht geraten. */
    var hebel = [], hb = '';
    try { hebel = _rfHebel(); } catch (e) {}
    if (hebel.length) {
      hb = '<div class="vi-sc-hebel"><b>Was den Score hebt</b>' +
        hebel.map(function (h) {
          return '<div class="vi-hb"><span class="vi-hb-p">+' + h.plus + '</span>' +
                 '<span class="vi-hb-t">' + h.txt + '<small>' + escH(h.wie) + '</small></span>' +
                 '<span class="vi-hb-z">' + h.ziel + '</span></div>';
        }).join('') +
        '<small>Jede Zeile ist nachgerechnet: derselbe Score, ein Wert geändert.</small></div>';
    }

    var fazit = R.score >= 85
      ? '<div class="vi-sc-fazit top">Das ist ein <b>Top-Deal</b> — die Zahlen tragen sich selbst.</div>'
      : (R.score >= 70
        ? '<div class="vi-sc-fazit gut">Ein <b>guter Deal</b>. Mit den Hebeln unten wird mehr daraus.</div>'
        : (R.score >= 50
          ? '<div class="vi-sc-fazit">Ein <b>solider Deal</b> — er trägt, aber er verzeiht wenig. Sieh dir die Hebel an.</div>'
          : '<div class="vi-sc-fazit schwach">So wie er dasteht, rechnet er sich <b>nicht</b>. Die Hebel zeigen, was fehlt.</div>'));

    return '<div class="vi-sc">' +
      _scoreKopf('Investor Deal Score 2.0', R.score, st, st.kamel) +
      fazit +
      '<div class="vi-sc-gitter">' + gitter + '</div>' + mp + hb +
      (R.explanation ? '<div class="vi-sc-text">' + escH(String(R.explanation).replace(/\s+/g, ' ').slice(0, 420)) + '</div>' : '') +
      (vollst ? '<div class="vi-sc-annahmen"><b>Datenlage:</b> ' + escH(vollst) +
                ' — was fehlt, zählt nicht gegen dich, es zählt gar nicht.</div>' : '') +
    '</div>';
  }

  /* ── Der Halt zwischen zwei Etappen ─────────────────────────────────
     Kommt NIE ungefragt in den Weg: laesst sich der Score nicht rechnen,
     faellt der Halt aus und der Dialog geht weiter, als haette es ihn nie
     gegeben. Ein Halt, der „leider keine Daten" sagt, ist ein Umweg. */
  function _rfHalt(nachEtappe) {
    if (!_rf) return false;
    if (!_rf.halte) _rf.halte = {};
    if (_rf.halte[nachEtappe]) return false;

    var karte = null, satz = '';
    if (nachEtappe >= 3 && !_rf.halte.s1) {
      karte = _rfScore1Karte();
      if (karte) {
        _rf.halte.s1 = 1;
        satz = 'Das reicht schon für eine erste Antwort auf <b>„lohnt sich das?"</b>';
      }
    }
    if (!karte && nachEtappe >= 4 && !_rf.halte.s2) {
      karte = _rfScore2Karte();
      if (karte) {
        _rf.halte.s2 = 1;
        satz = 'Mit Lage und Zustand wird aus der Rechnung eine <b>Einschätzung</b> — das ist derselbe Score, den du in der Pilotanalyse siehst.';
      }
    }
    if (!karte) return false;
    _rf.halte[nachEtappe] = 1;
    var b = _rfBlase('co', satz + karte +
      '<div class="vi-sc-weiter"><i>▸</i> Weiter geht es mit <b>' + escH(_etName(nachEtappe)) + '</b> — ' +
      escH(_etZiel(nachEtappe)) + '.</div>');

    /* ═══ v1306 · Die Score-Karte muss man SEHEN ════════════════════════
       Marcels Befund (design/mockups/dealscore2.png): „der hat jetzt ganz
       runtergescrollt … man weiß gar nicht genau, mache ich jetzt einfach
       weiter? Man könnte das vielleicht überlesen."

       Im Bild ist genau das passiert: von der Karte ist nur das Ende zu
       sehen, die grosse Zahl steht oben ausserhalb des Bildes, und
       darunter läuft schon die nächste Frage.

       Ursache ist `_rfAnsEnde` — richtig für ein Gespräch, falsch für
       einen Zwischenstand. Eine Antwort will man unten sehen, eine Karte
       von OBEN: dort steht die Zahl, um die es geht.

       Deshalb wird hier der KARTENANFANG in den Blick geholt, nicht das
       Ende des Verlaufs. Und weil die nächste Frage unmittelbar folgt und
       den Blick sonst weiterzieht, geschieht das erst im nächsten Bild —
       nach ihr. Wer weiterlesen will, scrollt; wer nur den Score wollte,
       hat ihn vor sich. */
    if (b) {
      var hin = function () {
        try {
          var chat = $('vi-rf-chat'); if (!chat) return;
          chat.scrollTop = Math.max(0, b.offsetTop - 8);
        } catch (e) {}
      };
      if (window.requestAnimationFrame) requestAnimationFrame(hin);
      setTimeout(hin, 320);   /* nach der Zähl-Animation der Karte */
    }
    return true;
  }

  function _etName(nr) { for (var i = 0; i < ETAPPEN.length; i++) if (ETAPPEN[i].nr === nr) return ETAPPEN[i].name; return ''; }
  function _etZiel(nr) { for (var i = 0; i < ETAPPEN.length; i++) if (ETAPPEN[i].nr === nr) return ETAPPEN[i].ziel; return ''; }

  /* ═══════════════════════════════════════════════════════════════════
     v1290 · DER KOPF SAGT, WO MAN IST
     ═══════════════════════════════════════════════════════════════════
     Im Bild sprechlauf2.png steht ueber dem gefuehrten Dialog „FREI
     EINSPRECHEN · Sprachaufzeichnung". Das ist der Titel des ANDEREN
     Weges — der Nutzer hat gerade „Frag mich durch" gewaehlt. Ein Kopf,
     der den falschen Modus nennt, ist schlimmer als keiner.

     Der Kicker kommt aus modal-boarding-skin.js und wird dort einmal beim
     Oeffnen aus dem <h3> abgeleitet. Statt jenes Modul umzubauen (es
     bedient fuenf andere Dialoge mit), wird der Text hier gesetzt, wenn
     die Wahl gefallen ist. */
  function _rfKopfSetzen(kick, titel, unter) {
    try {
      var k = document.querySelector('.oabi-ov.vi-mode .bdg-kick');
      if (k && kick) k.textContent = kick;
      var h = document.querySelector('.oabi-ov.vi-mode .oabi-head h3');
      if (h && titel) h.textContent = titel;
      var s = document.querySelector('.oabi-ov.vi-mode .oabi-sub');
      if (s && unter) s.textContent = unter;
    } catch (e) {}
  }

  /* ── Das Etappenband ────────────────────────────────────────────────
     Gezeigt werden nur Etappen, die auch wirklich Fragen haben. Im freien
     Weg sind das oft nur zwei — dann steht da auch nur zwei. Ein Band mit
     sechs Punkten, von denen vier nie kommen, waere ein Versprechen.

     v1290: Mit Verbindungslinie und Fortschritt je Etappe. Ein Band ohne
     Linie ist eine Reihe von Etiketten; erst die Linie macht daraus einen
     Weg, auf dem man sieht, wie weit man ist. */
  function _rfBandZeichnen() {
    var host = $('vi-rf-band'); if (!host || !_rf) return;
    var da = {}, fertig = {}, gesamt = {};
    _rf.offen.forEach(function (e, i) {
      if (!e.et) return;
      da[e.et] = 1;
      gesamt[e.et] = (gesamt[e.et] || 0) + 1;
      var w = _rfWerteZuBlock(e);
      var echt = w.some(function (x) { return !x.f; });
      if (echt) fertig[e.et] = (fertig[e.et] || 0) + 1;
    });
    var akt = (_rf.offen[_rf.i] && _rf.offen[_rf.i].et) || 0;
    var liste = ETAPPEN.filter(function (E) { return da[E.nr]; });
    if (liste.length < 2) { host.innerHTML = ''; host.style.display = 'none'; return; }
    host.style.display = '';
    var eigen = 0;
    liste.forEach(function (E) { if (E.nr === akt) eigen = 1; });
    host.innerHTML =
      '<div class="vi-et-band">' +
      liste.map(function (E, i) {
        var durch = E.nr < akt, jetzt = E.nr === akt;
        var zu = durch ? 'fertig' : (jetzt ? 'jetzt' : '');
        var f = fertig[E.nr] || 0, g = gesamt[E.nr] || 0;
        return '<span class="vi-et ' + zu + '">' +
          (i ? '<i class="vi-et-linie"></i>' : '') +
          '<span class="vi-et-punkt">' + (durch ? '✓' : E.nr) + '</span>' +
          '<span class="vi-et-txt"><b>' + escH(E.name) + '</b>' +
          '<small>' + f + ' / ' + g + '</small></span>' +
          '</span>';
      }).join('') + '</div>';
    /* Die Kopfzeile links nennt die Etappe samt Ziel — „DER CO-PILOT
       FRAGT" sagt nur, dass jemand fragt, nicht worueber. */
    var kopf = document.querySelector('.oabi-ov.vi-mode .vi-rf-kopf');
    if (kopf) {
      kopf.textContent = akt
        ? 'Etappe ' + akt + ' von ' + liste.length + ' · ' + _etName(akt)
        : (_rf.alle ? 'Der Co-Pilot fragt' : 'Noch offen');
      kopf.title = akt ? _etZiel(akt) : '';
    }
  }

  /* ── Die Skalen in der Frage nennen (Backlog-Punkt 2) ───────────────
     Wir bewerten nach diesen Stufen — also soll der Nutzer sie hoeren,
     statt Freitext zu raten, den die Auswertung dann irgendwie zuordnet.
     Gelesen wird das `<select>` im DOM, nicht eine zweite Liste: eine
     Zweitliste veraltet beim ersten neuen Eintrag, und niemand merkt es. */
  /* ═══ v1298 · Pillen mit den Schlagwörtern ═════════════════════════════
     Marcels Vorgabe vom 11.09.2026: „Vielleicht wäre es auch gut, wenn wir
     hinter den Fragen noch Pillen machen mit den Schlagwörtern, die gefragt
     sind. Dann kann man das noch besser verstehen."

     Eine Frage wie „Was kommt monatlich rein? Kaltmiete und Zusatzeinnahmen
     wie Stellplatz." nennt zwei Felder im Fließtext. Wer schnell hört, hört
     eins. Die Pillen zeigen ohne Lesen, WIE VIELE Angaben erwartet werden —
     und welche davon schon stehen.

     GEFÜLLTE FELDER BEKOMMEN EINEN HAKEN. Das ist der eigentliche Gewinn:
     bei einem Block, aus dem das Exposé schon die Hälfte geliefert hat,
     sieht man sofort, was noch fehlt, statt die Antwort zu wiederholen. */
  function _rfPillen(eintrag) {
    if (!eintrag || !eintrag.ids || !eintrag.ids.length) return '';
    var kat = (_rf && _rf.catalog) || [];
    var teile = (eintrag.ids).map(function (id) {
      var c = kat.filter(function (x) { return x.id === id; })[0];
      /* Klammerzusätze raus — „Wohnfläche (m²)" wird zu „Wohnfläche".
         Auf einer Pille zählt das Wort, nicht die Einheit. */
      var name = c ? String(c.label).replace(/\s*\(.*?\)\s*$/, '').trim() : id;
      var da = _rf && _rf.data && _rf.data.fields &&
               _rf.data.fields[id] != null && String(_rf.data.fields[id]).trim() !== '';
      if (!da) { var v = _rfFeld(id); da = (v != null && String(v).trim() !== ''); }
      return '<span class="vi-rf-pille' + (da ? ' da' : '') + '">' +
             (da ? '<i>✓</i>' : '') + escH(name) + '</span>';
    });
    return '<div class="vi-rf-pillen">' + teile.join('') + '</div>';
  }

  function _rfSkalen(eintrag) {
    if (!eintrag || !eintrag.skalen) return '';
    var teile = [];
    (eintrag.ids || []).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.tagName !== 'SELECT') return;
      var opts = [].slice.call(el.options || [])
        .filter(function (o) { return String(o.value || '') !== ''; })
        .map(function (o) { return String(o.text || '').replace(/\s+/g, ' ').trim(); })
        .filter(function (t) { return t && t.charAt(0) !== '–'; });
      if (!opts.length || opts.length > 12) return;
      var kat = (_rf && _rf.catalog || []).filter(function (c) { return c.id === id; })[0];
      var name = kat ? String(kat.label).replace(/\s*\(.*?\)\s*$/, '') : id;
      teile.push('<i>' + escH(name) + '</i> ' + escH(opts.join(' · ')));
    });
    if (!teile.length) return '';
    return '<div class="vi-rf-skala"><b>Die Stufen:</b><br>' + teile.join('<br>') + '</div>';
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1288 · ABRUFEN STATT FRAGEN
     ═══════════════════════════════════════════════════════════════════
     Marcel: „Makro-, Mikrolage. Ich meine, das koennen wir abdecken und
     abfragen ueber unsere Schnittstelle und auch den Bodenrichtwert, dass
     diese Sachen erfragt werden."

     Wir haben die Quellen laengst — sie standen nur nie im Gespraech:

       Bodenrichtwert   DealPilotBrw.borisHolen()   amtlich, 0,4-0,5 s, gratis
       Grunderwerbsteuer DealPilotGrest.forPlz()    Landesrecht, ohne Netz
       Lage & Marktwert  /marktbericht/reports/from-dealpilot

     DIE HERKUNFTSREGEL GILT HIER DOPPELT. Sobald der Co-Pilot selbst Daten
     beschafft, darf in der Uebernahme-Tabelle nicht „Sprachaufzeichnung"
     an einer Zahl stehen, die niemand ausgesprochen hat. Deshalb fuehrt
     `_rf.quelle` je Feld die Herkunft mit, und `showResults` zeigt sie
     statt der Pauschale.

     UND: ein Ja genuegt. Kein Modal, kein zweiter Dialog — der Knopf steht
     in der Frage, „ja" tut es auch gesprochen. */

  /* ═══════════════════════════════════════════════════════════════════
     v1291 · DIE AKTIONSLEISTE — was jetzt dran ist, steht UNTEN
     ═══════════════════════════════════════════════════════════════════
     Marcels Befund: „ab und zu haben wir sowas wie Bodenrichtwert abholen
     und solche Sachen und erweiterte Marktpreisindikation. Die stehen dann
     meistens darunter und dann weiß man nicht, dass man jetzt weitermachen
     soll."

     Er hat recht, und die Ursache ist der Ort. Ein Angebot, das IN einer
     Chatblase steht, wandert mit dem Verlauf nach oben und ist zwei
     Antworten später aus dem Bild. Der Nutzer sieht unten das Mikrofon,
     hört „ich höre zu" — und weiss nicht, dass oben noch eine
     Entscheidung offen liegt.

     JETZT: eine feste Leiste zwischen Verlauf und Mikrofon. Dort steht
       - was gerade GEFRAGT ist (immer, in einer Zeile), und
       - was gerade ANGEBOTEN wird (Knöpfe, wenn es welche gibt).
     Sie scrollt nicht mit. Was dort steht, ist offen; was verschwindet,
     ist erledigt.

     EIN ORT FÜR ALLE ENTSCHEIDUNGEN: Bodenrichtwert, Lage-Recherche,
     Marktpreisindikation, ihre Vertiefung, die Feinheiten-Frage und der
     Weg zur Übersicht. Vorher lagen die an vier verschiedenen Stellen —
     mal in der Blase, mal unter den Nebenknöpfen. */

  /* Eine Aktion anmelden. Gleiche `art` ersetzt die vorige — ein Angebot
     gibt es nie zweimal. */
  function _rfAktion(art, txt, knopf, extra) {
    if (!_rf) return;
    if (!_rf.aktionen) _rf.aktionen = [];
    _rf.aktionen = _rf.aktionen.filter(function (a) { return a.art !== art; });
    _rf.aktionen.push(Object.assign({ art: art, txt: txt, knopf: knopf }, extra || {}));
    _rfDranZeichnen();
  }
  function _rfAktionWeg(art) {
    if (!_rf || !_rf.aktionen) return;
    var vorher = _rf.aktionen.length;
    _rf.aktionen = _rf.aktionen.filter(function (a) { return a.art !== art; });
    if (vorher !== _rf.aktionen.length) _rfDranZeichnen();
  }
  function _rfAktionenLeeren() {
    if (!_rf) return;
    _rf.aktionen = [];
    _rfDranZeichnen();
  }

  var AKT_ICON = {
    brw: '📍', lage: '🌍', markt: '📊', markt2: '📈',
    tiefe: '＋', tabelle: '✓', adresse: '📮'
  };

  function _rfDranZeichnen() {
    var host = $('vi-rf-dran'); if (!host || !_rf) return;
    var e = _rf.offen[_rf.i];
    var akt = (_rf.aktionen || []);
    /* Die Frage steht immer da — auch ohne Angebot. Wer nach einer langen
       Auskunft wieder hinsieht, muss nicht nach oben scrollen, um zu
       wissen, was gerade gefragt war. */
    var frage = '';
    if (_rf.abschlussOffen) {
      frage = '<b>Fertig</b> — deine Werte warten in der Übersicht. Fragen darfst du mich weiter.';
    } else if (_rf.adresseFrage) {
      frage = '<b>Stimmt die Adresse?</b> Sag „ja" — oder nenn sie mir noch einmal.';
    } else if (e) {
      frage = '<b>Jetzt dran</b> · ' + escH(_rfKurzname(e)) + ' — ' + escH(e.frage);
    }
    if (!frage && !akt.length) { host.style.display = 'none'; host.innerHTML = ''; return; }
    host.style.display = '';
    host.innerHTML =
      (frage ? '<div class="vi-dran-f"><i>▸</i><span>' + frage + '</span></div>' : '') +
      (akt.length
        ? '<div class="vi-dran-a">' +
          '<span class="vi-dran-lbl">Ich kann das für dich holen:</span>' +
          /* ═══ v1300 · EINE Erklärzeile statt einer je Knopf ══════════════
             Marcels Befund vom 11.09.2026: „der Balken für Marktindikation,
             erweiterte Marktindikation und Lage recherchieren ist recht
             breit. Vielleicht können wir das ein bisschen flacher machen."

             Hier stand `akt.map(...)` — für JEDE Aktion ein eigener
             Absatz. Bei drei Angeboten also drei Textblöcke untereinander,
             dauerhaft sichtbar, zusammen über 70 px. Sie erklären etwas,
             das man einmal liest und danach nie wieder braucht.

             Die Texte gehen nicht verloren: sie stehen jetzt in EINER
             Zeile, die zeigt, was zum gerade berührten Knopf gehört. Ohne
             Berührung steht dort der Text der ersten Aktion. Drei Absätze
             werden so zu einer Zeile — und beim Überfahren sagt sie mehr
             als vorher, weil sie zum Knopf gehört, auf den man zeigt. */
          akt.map(function (a, i) {
            return '<button type="button" class="vi-dran-btn" data-akt="' + escH(a.art) + '"' +
                   ' data-i="' + i + '"' +
                   (a.hinweis ? ' title="' + escH(a.hinweis) + '"' : '') + '>' +
                   '<b>' + (AKT_ICON[a.art] || '›') + '</b>' + escH(a.knopf) +
                   (a.frei != null ? '<i>' + escH(String(a.frei)) + ' frei</i>' : '') +
                   '</button>';
          }).join('') +
          '</div>' +
          (function () {
            var mit = akt.filter(function (a) { return a.txt; });
            if (!mit.length) return '';
            return '<div class="vi-dran-t" data-dran-t>' + mit[0].txt + '</div>';
          })()
        : '');
    var tz = host.querySelector('[data-dran-t]');
    [].slice.call(host.querySelectorAll('.vi-dran-btn')).forEach(function (b) {
      b.addEventListener('click', function () { _rfAktionKlick(b.getAttribute('data-akt'), b); });
      /* Die Zeile folgt dem Zeiger — auch der Tastatur, damit sie nicht
         nur mit Maus erreichbar ist. */
      if (!tz) return;
      var i = parseInt(b.getAttribute('data-i'), 10);
      var zeig = function () { if (akt[i] && akt[i].txt) tz.innerHTML = akt[i].txt; };
      b.addEventListener('mouseenter', zeig);
      b.addEventListener('focus', zeig);
    });
  }
  /* EIN Klickweg für alle Angebote. Vorher hatte jedes seinen eigenen —
     und der des Markt-Angebots vergass, den Dialog fortzusetzen (v1290).

     v1291b: Eine `art` OHNE Zweig fiel hier still durch — der Knopf war
     danach weg, und nichts geschah. Gemessen an genau dem Fall: der
     Adress-Knopf hatte keinen Handler, der Dialog stand. Ein stiller
     Ausfall in einem Verteiler ist der teuerste, den es gibt; deshalb
     protestiert er jetzt, statt zu schweigen. */
  function _rfAktionKlick(art, knopf) {
    if (!_rf || !art) return;
    if (knopf) { knopf.disabled = true; knopf.classList.add('laeuft'); }
    var a = (_rf.aktionen || []).filter(function (x) { return x.art === art; })[0] || {};
    _rfAktionWeg(art);
    if (art === 'adresse') {
      _rf.adresseFrage = 0;
      _rfBlase('ich', 'Ja, stimmt.');
      _rfWeiter();
      return;
    }
    if (art === 'tabelle')  { _rfZurTabelle(); return; }
    if (art === 'tiefe')    { _rf.tiefeOffen = 0; _rfBlase('ich', 'Ja, lass uns weitermachen.'); _rfTiefeStarten(); return; }
    if (art === 'brw')      { _rfBlase('ich', 'Hol den Bodenrichtwert.'); _rfBrwHolen(); return; }
    if (art === 'lage')     { _rfBlase('ich', 'Recherchier die Lage.'); _rfLageRecherche(); return; }
    if (art === 'markt' || art === 'markt2') {
      var st = a.stufe || (art === 'markt2' ? 2 : 1);
      _rfBlase('ich', st >= 2 ? 'Nimm die erweiterte.' : 'Ja, hol sie.');
      var wartete = _rf.wartetAufMarkt;
      _rfMarktWaehlen(st);
      if (wartete) _rfNachAngebot();
      return;
    }
    try { console.error('[voice] Aktion ohne Zweig:', art); } catch (e) {}
    _rfBlase('co', '<span style="opacity:.6">Das hat nicht funktioniert — sag es mir bitte selbst.</span>');
    if (_fs.an && _fs.stream) _fsHoeren(true);
  }

  /* Gesprochen oder getippt: „ja" gilt fuer die OBERSTE offene Aktion.
     Steht mehr als eine zur Wahl, wird nachgefragt statt geraten — eine
     falsch verstandene Zusage kostet ein Kontingent. */
  function _rfAktionJa(text) {
    var akt = (_rf && _rf.aktionen) || [];
    if (!akt.length) return false;
    if (akt.length > 1) {
      /* „hol den bodenrichtwert" / „die lage" — wer die Aktion NENNT,
         bekommt sie; sonst fragt der Co-Pilot einmal nach. */
      var t = _de(text);
      var treffer = akt.filter(function (a) {
        return t.indexOf(_de(a.knopf.split(' ')[0])) >= 0 ||
               (a.art === 'brw' && /bodenrichtwert|boris/.test(t)) ||
               (a.art === 'lage' && /lage|umgebung|region|stadtteil/.test(t)) ||
               (a.art === 'markt' && /markt|indikation|preis/.test(t)) ||
               (a.art === 'markt2' && /erweitert|voll|gross|gr(oe|ö)ss/.test(t));
      });
      if (treffer.length === 1) { _rfBlase('ich', escH(text)); _rfAktionKlick(treffer[0].art); return true; }
      _rfBlase('ich', escH(text));
      _rfBlase('co', 'Beides kann ich holen — sag mir welches: ' +
        akt.map(function (a) { return '<b>' + escH(a.knopf) + '</b>'; }).join(' oder ') + '.');
      return true;
    }
    _rfBlase('ich', escH(text));
    _rfAktionKlick(akt[0].art);
    return true;
  }

  /* Ein Wert plus seine Herkunft. Ueberschreibt NICHT, was gesagt wurde:
     wer den Bodenrichtwert selbst genannt hat, behaelt seinen. */
  function _rfSetzen(id, wert, quelle) {
    if (!_rf || wert === null || wert === undefined || wert === '') return false;
    if (!_rf.data.fields) _rf.data.fields = {};
    var alt = _rf.data.fields[id];
    if (alt !== undefined && alt !== null && alt !== '') return false;
    _rf.data.fields[id] = wert;
    if (!_rf.quelle) _rf.quelle = {};
    if (quelle) _rf.quelle[id] = quelle;
    return true;
  }

  /* ── Die Angebote zu einer Frage ──────────────────────────────────
     v1291: Sie erscheinen nicht mehr IN der Frageblase, sondern in der
     Aktionsleiste unten. Was hier passiert, ist deshalb nur noch
     anmelden — das Zeichnen macht `_rfDranZeichnen`. */
  function _rfAbrufAngebot(eintrag) {
    if (!eintrag || !_rf) return '';
    if (!eintrag.abruf) return '';
    if (_rf.abrufGetan && _rf.abrufGetan[eintrag.abruf]) return '';
    if (eintrag.abruf === 'brw') {
      if (!_rfBrwMoeglich()) return '';
      _rfAktion('brw', 'Amtlich aus BORIS, mit Stichtag und Zone — kostet nichts.',
                'Bodenrichtwert holen');
      _rf.abrufOffen = 'brw';
      return '';
    }
    if (eintrag.abruf === 'lage') {
      if (_rf.markt) {
        _rfAktion('lage', 'Aus der Marktpreisindikation liegen Makro- und Mikrolage vor.',
                  'Lagewerte übernehmen');
      } else if (_rfLageMoeglich()) {
        _rfAktion('lage', 'Ich recherchiere Makrolage, Mikrolage, Bevölkerungsentwicklung, ' +
                  'Nachfrage, Wertsteigerung und Entwicklung — mit Quellenangabe.',
                  'Lage recherchieren');
      } else return '';
      _rf.abrufOffen = 'lage';
      return '';
    }
    return '';
  }

  function _rfBrwMoeglich() {
    try {
      var plz = _rfFeld('plz');
      if (!plz || !/^\d{5}$/.test(String(plz).trim())) return false;
      var B = window.DealPilotBrw;
      if (!B || typeof B.borisHolen !== 'function') return false;
      if (typeof B.verfuegbarFuerPlz === 'function' && !B.verfuegbarFuerPlz(String(plz).trim())) return false;
      return true;
    } catch (e) { return false; }
  }

  function _rfLageMoeglich() {
    var plz = _rfFeld('plz'), ort = _rfFeld('ort');
    return !!(plz || ort);
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1291 · DIE LAGE RECHERCHIEREN — sechs Dimensionen auf einmal
     ═══════════════════════════════════════════════════════════════════
     Marcels Wunsch: „er soll auch micro und makrolage einzeln abrufen
     können … vielleicht auch Bevölkerungsentwicklung. Das kann er
     einerseits über unsere Schnittstelle Marktbewertung machen, aber auch
     über KI aus dem Netz."

     BEIDES GIBT ES SCHON, und sie ergaenzen sich:

       Marktpreisindikation   Makro und Mikro als SCORE (0-100), aus
                              Marktdaten gerechnet. Kostet ein Kontingent.
       /ai/lage               SECHS Dimensionen mit Quelle und Begruendung,
                              recherchiert. Kostet einen KI-Aufruf.

     `/ai/lage` liefert genau die Enum-Werte, die unsere Felder fuehren —
     im Browser Feld fuer Feld gegengeprueft, alle sechs stimmen ueberein:

       makro          -> makrolage           sehr_gut … sehr_schwach
       mikro          -> mikrolage           sehr_gut … sehr_schwach
       bevoelkerung   -> ds2_bevoelkerung    stark_wachsend … stark_fallend
       nachfrage      -> ds2_nachfrage       sehr_stark … sehr_schwach
       wertsteigerung -> ds2_wertsteigerung  sehr_hoch … keines
       entwicklung    -> ds2_entwicklung     mehrere … keine

     Das sind SECHS Felder des Deal Score 2 aus einem Aufruf — und mit
     Quellenangabe, also mit einer Herkunft, die den Namen verdient.

     WAS NICHT UEBERSCHRIEBEN WIRD: was der Nutzer selbst gesagt hat.
     `_rfSetzen` laesst bestehende Werte stehen; die Recherche fuellt nur
     Luecken. Wer die Lage selbst einschaetzt, behaelt seine Einschaetzung. */
  var LAGE_ZIEL = {
    makro: 'makrolage', mikro: 'mikrolage', bevoelkerung: 'ds2_bevoelkerung',
    nachfrage: 'ds2_nachfrage', wertsteigerung: 'ds2_wertsteigerung',
    entwicklung: 'ds2_entwicklung'
  };
  var LAGE_NAME = {
    makro: 'Makrolage', mikro: 'Mikrolage', bevoelkerung: 'Bevölkerung',
    nachfrage: 'Nachfrage', wertsteigerung: 'Wertsteigerung', entwicklung: 'Entwicklung'
  };

  function _rfLageRecherche() {
    if (!_rf) return;
    if (!_rf.abrufGetan) _rf.abrufGetan = {};
    _rf.abrufGetan.lage = 1;
    _rf.abrufOffen = null;
    /* Liegen die Werte schon aus der Marktpreisindikation vor, wird nichts
       nachgeholt — zwei Quellen fuer dieselbe Zahl ist eine zu viel. */
    if (_rf.markt) return _rfLageUebernehmen();

    var adr = [ _rfFeld('str'), _rfFeld('hnr') ].filter(Boolean).join(' ');
    var ortT = [ _rfFeld('plz'), _rfFeld('ort') ].filter(Boolean).join(' ');
    _rfBlase('co', '<span style="opacity:.75">Ich sehe mir die Lage an — Region, Stadtteil, ' +
      'Bevölkerung, Nachfrage. Das dauert einen Moment.</span>');
    _rfMelden('', true);
    return Auth.apiCall('/ai/lage', {
      method: 'POST', timeout: 150000,
      body: {
        adresse: [adr, ortT].filter(Boolean).join(', '),
        str: _rfFeld('str') || '', hnr: _rfFeld('hnr') || '',
        plz: _rfFeld('plz') || '', ort: _rfFeld('ort') || '',
        kaufpreis: _rfNum(_rfFeld('kp')),
        wohnflaeche: _rfNum(_rfFeld('wfl')),
        nettokaltmiete: _rfNum(_rfFeld('nkm'))
      }
    }).then(function (r) {
      _rfDenkt(false);
      if (!r || !r.success) throw new Error((r && r.error) || 'Keine Daten zurückgekommen');
      _rf.lage = r;
      var Q = 'Lage-Recherche';
      var zeilen = [], quellen = [], gesetzt = [];
      Object.keys(LAGE_ZIEL).forEach(function (k) {
        var d = r[k];
        if (!d || !d.value) return;
        var feld = LAGE_ZIEL[k];
        var wort = _optionText(feld, d.value) || d.label || d.value;
        zeilen.push(_zeile(LAGE_NAME[k], wort,
                    (d.score != null && d.score >= 70) ? 'gut' : ((d.score != null && d.score < 40) ? 'schlecht' : '')));
        if (_rfSetzen(feld, d.value, Q + (d.source && d.source.label ? ' · ' + d.source.label : ''))) gesetzt.push(LAGE_NAME[k]);
        if (d.source && d.source.label && quellen.indexOf(d.source.label) < 0) quellen.push(d.source.label);
      });
      if (!zeilen.length) throw new Error('Die Recherche kam ohne verwertbare Angaben zurück');
      /* Die Begruendungen: kurz, aber DA. Wer eine Lagebewertung
         uebernimmt, soll lesen koennen, worauf sie beruht. */
      var texte = Object.keys(LAGE_ZIEL).map(function (k) {
        var d = r[k];
        if (!d || !d.text) return '';
        return '<div class="vi-lg-t"><b>' + escH(LAGE_NAME[k]) + '</b> ' + escH(String(d.text).slice(0, 260)) + '</div>';
      }).filter(Boolean).join('');
      _rfBlase('co', '<b>Die Lage-Recherche ist da.</b>' +
        '<div class="vi-sc"><div class="vi-sc-kopf"><span class="vi-sc-titel">Lage · recherchiert</span></div>' +
        '<div class="vi-sc-gitter">' + zeilen.join('') + '</div>' +
        (texte ? '<details class="vi-sc-mehr"><summary>Woran das liegt</summary>' + texte + '</details>' : '') +
        (gesetzt.length
          ? '<div class="vi-sc-annahmen"><b>Übernommen:</b> ' + escH(gesetzt.join(', ')) +
            (quellen.length ? ' · <b>Quellen:</b> ' + escH(quellen.slice(0, 4).join(', ')) : '') +
            '</div>'
          : '<div class="vi-sc-annahmen">Deine eigenen Angaben bleiben stehen — ich habe nur ergänzt, was fehlte.</div>') +
        '</div>');
      _rfStandZeichnen();
      _rfLageWeiter();
    }).catch(function (err) {
      _rfDenkt(false);
      var m = (err && err.data && err.data.error) || (err && err.message) || '';
      try { console.warn('[voice] Lage-Recherche:', m, err); } catch (e) {}
      _rfBlase('co', 'Die Lage-Recherche hat nicht geklappt' +
        (m ? ' (' + escH(String(m).slice(0, 100)) + ')' : '') +
        ' — sag mir einfach, wie du die Lage einschätzt.');
      if (_fs.an && _fs.stream) _fsHoeren(true);
    });
  }

  /* Der Klartext einer Auswahl — aus dem <select>, nicht aus einer
     zweiten Liste. */
  function _optionText(feldId, wert) {
    try {
      var el = document.getElementById(feldId);
      if (!el || el.tagName !== 'SELECT') return null;
      for (var i = 0; i < el.options.length; i++) {
        if (String(el.options[i].value) === String(wert)) return String(el.options[i].text).trim();
      }
    } catch (e) {}
    return null;
  }

  /* Ist die Frage damit beantwortet, geht es weiter. */
  function _rfLageWeiter() {
    try {
      var e = _rf.offen[_rf.i];
      if (e && !_rfFehlt(e, _rf.data.fields)) {
        _rfBlase('co', '<span style="opacity:.7">Damit habe ich die Lage — weiter.</span>');
        return setTimeout(_rfWeiter, 500);
      }
    } catch (ex) {}
    if (_fs.an && _fs.stream) _fsHoeren(true);
  }
  function _rfBrwHolen() {
    var adr = { plz: _rfFeld('plz'), ort: _rfFeld('ort'), str: _rfFeld('str') };
    _rfMelden('', true);
    return Promise.resolve(window.DealPilotBrw.borisHolen(adr)).then(function (r) {
      _rfDenkt(false);
      if (!r || !r.ok) {
        _rfBlase('co', 'Der amtliche Abruf hat nichts geliefert' +
          (r && r.fehler ? ' (' + escH(r.fehler) + ')' : '') +
          ' — sag mir den Bodenrichtwert, wenn du ihn kennst, sonst überspringen wir ihn.');
        if (_fs.an && _fs.stream) _fsHoeren(true);
        return;
      }
      var herkunft = 'BORIS' + (r.stichtag ? ' ' + r.stichtag : '') + (r.zone ? ' · Zone ' + r.zone : '');
      _rfSetzen('brw', String(r.wert).replace('.', ','), herkunft);
      _rfBlase('co', '<b>' + escH(String(r.wert).replace('.', ',')) + ' €/m²</b> — amtlicher Bodenrichtwert. ' +
        '<span style="opacity:.7">' + escH(herkunft) + '</span>' +
        '<div class="vi-rf-zaehler">Herkunft steht in der Übersicht — nicht „Sprachaufzeichnung".</div>');
      _rfStandZeichnen();
      _rfFrageNochmal();     /* v1306 */
      if (_fs.an && _fs.stream) _fsHoeren(true);
    }).catch(function (e) {
      _rfDenkt(false);
      _rfBlase('co', 'Der Abruf ist fehlgeschlagen — sag mir den Bodenrichtwert einfach selbst.');
      if (_fs.an && _fs.stream) _fsHoeren(true);
    });
  }

  /* ═══ v1306 · Nach einem Abruf steht die Frage wieder da ════════════════
     Marcels Vorgabe (design/mockups/fragen.png): „die Frage vom Co-Piloten
     danach, die muss darunter gestellt werden."

     Im Bild hat „Hol den Bodenrichtwert" sauber funktioniert — der Wert
     kam, 90 €/m² aus BORIS. Danach stand aber nur noch der Wert da. Die
     Frage („Was weisst du zum Grundstueck?") war nach oben weggerutscht,
     und was als Naechstes zu tun ist, stand nur klein in der Leiste.

     Ein Abruf beantwortet EINEN Teil der Frage. Solange andere Felder
     desselben Blocks offen sind, gehoert die Frage wieder hin — mit den
     Pillen, die zeigen, was jetzt noch fehlt.

     Steht nichts mehr offen, wird NICHT wiederholt: dann ist der Block
     fertig, und die Frage noch einmal zu stellen waere eine Aufforderung
     zu etwas, das es nicht mehr gibt. */
  /* Genau EINE Blase trägt die Hervorhebung — die Frage, die gerade gilt.
     Die vorige verliert sie, sonst leuchtet nach zehn Fragen der halbe
     Verlauf und die Auszeichnung sagt nichts mehr. */
  function _rfDranBlase(b) {
    try {
      var chat = $('vi-rf-chat');
      if (chat) [].slice.call(chat.querySelectorAll('.vi-rf-dran-blase'))
        .forEach(function (x) { x.classList.remove('vi-rf-dran-blase'); });
      if (b) b.classList.add('vi-rf-dran-blase');
    } catch (e) {}
    return b;
  }

  function _rfFrageNochmal() {
    if (!_rf) return;
    var e = _rf.offen[_rf.i];
    if (!e || !e.ids) return;
    var fehlt = e.ids.filter(function (id) {
      var v = _rf.data.fields[id];
      if (v != null && String(v).trim() !== '') return false;
      var el = document.getElementById(id);
      return !(el && String(el.value || '').trim() !== '');
    });
    if (!fehlt.length) return;
    _rfDranBlase(_rfBlase('co', escH(e.frage) + _rfPillen(e) +
      '<div class="vi-rf-zaehler">Noch offen: ' + escH(_rfFelderNamen(fehlt)) + '</div>'));
    _rfDranZeichnen();
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1288 · DIE MARKTPREISINDIKATION LAEUFT IM HINTERGRUND
     ═══════════════════════════════════════════════════════════════════
     Marcels Kern-Idee: „Vorher aber auch eine Marktpreisindikation, die man
     vorher auswaehlen kann … Je nachdem, welchen Plan man hat, wird das
     angeboten oder auch nicht. Vor allen Dingen auch wenn man da noch
     Kontingent zur Verfuegung hat, wird es einmal abgerufen: wir haben noch
     so und so viel frei."

     DREI REGELN:

     1. GEFRAGT WIRD FRUEH, GESTARTET WIRD NACH DER BASIS. Der Abruf
        braucht Adresse, Flaeche, Baujahr und Kaufpreis — das ist Etappe 1.
        Gefragt wird trotzdem gleich nach der Adresse, damit die Entscheidung
        gefallen ist, bevor es losgeht.

     2. DER ABLAUF WARTET NIE. Der Abruf laeuft neben dem Gespraech.
        Kommt nichts zurueck, merkt es niemand ausser im Protokoll; kommt
        etwas, ist es ein Gewinn mitten im Satz.

     3. OHNE KONTINGENT KEIN ANGEBOT. Wer nichts frei hat, bekommt keinen
        Knopf, der ihn zu einer Bezahlschranke fuehrt — er wird ganz normal
        gefragt. Ein Angebot, das man nicht annehmen kann, ist Werbung. */
  /* ═══════════════════════════════════════════════════════════════════
     v1290 · DIE STUFEN HOLEN SICH ZU IHRER ZEIT
     ═══════════════════════════════════════════════════════════════════
     Marcels Frage: „funktionieren die Abrufe, je nach Plan die
     Marktpreisindikation oder die erweiterte? Je nachdem wie es abgestuft
     ist, müssen bis dahin ja die richtigen Fragen gestellt worden sein."

     GEMESSEN am 10.09.2026, im Container statt im Repo (der Repo-Stand
     fuehrte auf eine falsche Faehrte — `fast` steht dort scheinbar neben
     `overrides`, tatsaechlich schickt der laufende Code es DARIN, und der
     Microservice reicht `overrides` durch):

       Stufe 1  `fast: true`      -> `ai_mode=schnell`, 850 ms.
                Nur Marktwert und Miete samt Spanne. KI-Bericht,
                Preishistorie und Makro-Statistik werden UEBERSPRUNGEN.
       Stufe 2  `wert_stufe: 2`   -> voller Bericht: KI-Text,
                Preishistorie, amtliche Makrolage.

     Die Stufen funktionieren also. ABER Marcels Schluss stimmt trotzdem —
     der volle Bericht liest deutlich mehr aus dem Objekt, und im
     Sprechlauf entsteht das erst spaeter:

       address, property_type, living_area, rooms, build_year   Etappe 1
       purchase_price, monthly_net_rent                         Etappe 1
       condition   (ds2_zustand)                                Etappe 3
       energy_class (ds2_energie)                               Etappe 3
       land_value_manual (brw)                                  Etappe 3
       mikrolage / makrolage / ds2_bevoelkerung / ds2_nachfrage
         / ds2_entwicklung / ds2_wertsteigerung  (assessment)   Etappe 3+4

     Und `condition` faellt ohne Angabe auf **'gepflegt'** zurueck — eine
     stille Annahme, die in einen bezahlten Bericht einfliesst.

     DESHALB: jede Stufe startet dort, wo ihre Angaben stehen.

       Stufe 1  Ende Etappe 1 — sie braucht nicht mehr.
       Stufe 2  Ende Etappe 4 — dann sind Zustand, Energieausweis,
                Bodenrichtwert und die ganze Lagebewertung da.

     Wer Stufe 1 gezogen hat, wird am Ende von Etappe 4 noch einmal
     gefragt: dann ist alles beisammen, und der Server rechnet die
     Vertiefung als DIFFERENZ ab (v1154), nicht als zweiten vollen Abruf. */
  function _rfKontingent() {
    try {
      var A = window.AiCredits;
      if (!A || typeof A.getStatus !== 'function') return null;
      var s = A.getStatus();
      if (!s || !s.arten) return null;
      function rest(k) {
        var a = s.arten[k];
        if (!a) return 0;
        var r = (a.rest != null) ? a.rest : null;
        return (r == null) ? 0 : r;
      }
      return { plan: s.plan || null, mpi: rest('mpi'), mpi_plus: rest('mpi_plus') };
    } catch (e) { return null; }
  }

  function _rfMarktAnbieten() {
    if (!_rf || _rf.marktGefragt) return;
    var plz = _rfFeld('plz'), ort = _rfFeld('ort');
    if (!plz && !ort) return;                 /* ohne Adresse kein Abruf */
    var kg = _rfKontingent();
    if (!kg) {
      /* v1293d: Kein Kontingentstand — ein technischer Ausfall, keine
         Plan-Auskunft. Gemessen mit abgelaufenem Token (HTTP 401): der
         Abruf scheiterte einmal, `marktGefragt` wurde gesetzt, und damit
         gab es im GANZEN Dialog kein Angebot mehr — auch nachdem die
         Anmeldung wieder stand.
         Jetzt wird NICHT gemerkt, dass gefragt wurde: einmal wird der
         Stand nachgeladen und danach erneut angeboten. Klappt auch das
         nicht, bleibt es still — eine Fehlermeldung ueber ein Angebot,
         das niemand angefordert hat, ist reine Beunruhigung. */
      if (!_rf.kontingentVersuch) {
        _rf.kontingentVersuch = 1;
        try {
          if (window.AiCredits && typeof window.AiCredits.refresh === 'function') {
            Promise.resolve(window.AiCredits.refresh(true)).then(function () {
              if (_rf && !_rf.marktGefragt) { try { _rfMarktAnbieten(); } catch (e) {} }
            }).catch(function () {});
          }
        } catch (e) {}
      }
      return;                                 /* KEIN marktGefragt = 1 */
    }
    if (!kg.mpi && !kg.mpi_plus) {
      /* Einmal sagen, nicht draengen. Danach laeuft der Dialog normal
         weiter und fragt die Werte, statt sie zu holen. Ein Angebot, das
         man nicht annehmen kann, ist Werbung. */
      if (!_rf.marktGesagt) {
        _rf.marktGesagt = 1;
        _rfBlase('co', '<span style="opacity:.75">Eine Marktpreisindikation ist in deinem Plan gerade nicht frei — ' +
          'ich frage die Werte stattdessen ab. Nachkaufen kannst du sie jederzeit im Marktbericht.</span>');
      }
      _rf.marktGefragt = 1;
      return;
    }
    _rf.marktGefragt = 1;
    _rf.abrufOffen = 'markt';
    /* v1291: Die Angebote stehen in der Aktionsleiste unten, nicht in der
       Blase — dort wandern sie mit dem Verlauf aus dem Bild.
       v1293: Wurde die Marktbewertung auf der Pre-Flight-Karte MIT
       angehakt, ist sie hier keine Frage mehr, sondern eine Wahl: der
       Nutzer hat sie schon gewollt, offen ist nur noch die Stufe. Und
       laeuft sie hier, faellt sie nach dem Sprechlauf aus — sonst
       kostete sie zweimal. */
    _rfBlase('co', (_mbGewollt
        ? 'Du hast die <b>Marktbewertung</b> mit ausgewählt — ich hole sie hier gleich mit, ' +
          'dann landen ihre Werte in derselben Übersicht wie alles andere. ' +
          '<b>Welche Stufe?</b>'
        : 'Für diese Adresse kann ich eine <b>Marktpreisindikation</b> holen — ' +
          'Kaufpreisniveau, <b>Marktmiete</b> und die Lagebewertung. ') +
      ' Sie läuft im Hintergrund; wir machen solange weiter.');
    /* v1306: Die Leistungen heissen, wie sie heissen. „Einfach" und
       „Erweitert" waren Kurzformen fuer die Stufenwahl — auf einem Knopf,
       der neben „Lage recherchieren" steht, sagen sie nichts. Marcels
       Vorgabe: „ich habe zum Beispiel die erweiterte Marktpreisindikation,
       so sollte die auch heissen. Du nennst die nur erweiterte." */
    if (kg.mpi) _rfAktion('markt',
      'Kaufpreisniveau, Marktmiete, Makro- und Mikrolage — läuft gleich im Hintergrund.',
      'Marktpreisindikation', { frei: kg.mpi, stufe: 1 });
    if (kg.mpi_plus) _rfAktion('markt2',
      'Zusätzlich Preishistorie, amtliche Makrolage und eine Einordnung im Fließtext. ' +
      'Sie liest auch Zustand, Energieausweis, Bodenrichtwert und deine Lagebewertung — ' +
      'die kommen erst in den nächsten Etappen, deshalb hole ich sie am Ende von Etappe 4.',
      'Erweiterte Marktpreisindikation', { frei: kg.mpi_plus, stufe: 2 });
  }

  function _rfMarktWaehlen(stufe) {
    if (!_rf) return;
    _rf.marktStufe = stufe;
    _rf.marktGewollt = 1;
    var chat = $('vi-rf-chat');
    if (chat) [].slice.call(chat.querySelectorAll('.vi-rf-abruf-btn[data-markt]'))
      .forEach(function (b) { b.disabled = true; });

    /* ═══ v1298 · Die Wahl schliesst BEIDE Angebote ══════════════════════
       Marcels Befund vom 11.09.2026: „mir ist aufgefallen, dass er das
       Modal mit ‚Ich kann das für dich holen, Marktpreisindikation‘ und so
       offen lässt, obwohl ich erweiterte Marktpreisindikation angeklickt
       habe. Und das könnte er dann zuklappen, weil man braucht es ja nicht
       mehr."

       Er hat recht, und die Ursache stand eine Ebene hoeher: beim
       Frageuebergang werden alle Angebote abgeraeumt AUSSER `markt` und
       `markt2` (v1291) — die sollten den ganzen Dialog ueberdauern, weil
       sie nicht zu einer einzelnen Frage gehoeren.

       Richtig ist das, SOLANGE NICHTS GEWAEHLT WURDE. Sobald eine Stufe
       steht, ist die Frage beantwortet; beide Knoepfe daneben sind dann
       nur noch Angebote fuer eine Entscheidung, die schon gefallen ist.
       Die Ausnahme galt zu lange, nicht zu breit. */
    _rfAktionWeg('markt');
    _rfAktionWeg('markt2');
    _rfDranZeichnen();
    if (stufe >= 2) {
      _rfBlase('co', '<span style="opacity:.8">Gemerkt. Die erweiterte hole ich am Ende von ' +
        '<b>Etappe 4</b> — dann kennt sie Zustand, Energieausweis, Bodenrichtwert und deine ' +
        'Lagebewertung. Vorher gerechnet wäre sie schlechter, als sie sein kann.</span>');
      return;
    }
    /* Stehen Flaeche, Baujahr und Kaufpreis schon, geht es sofort los —
       sonst wartet der Start auf das Ende von Etappe 1. */
    if (_rfMarktBereit()) _rfMarktStarten();
    else _rfBlase('co', '<span style="opacity:.75">Merke ich mir — ich starte sie, sobald ich Fläche, ' +
                        'Baujahr und Kaufpreis habe.</span>');
  }

  function _rfMarktBereit() {
    return !!(_rfFeld('plz') || _rfFeld('ort')) && _rfNum(_rfFeld('wfl')) != null;
  }

  /* Nach Etappe 4: alles da, was der volle Bericht liest. Wer Stufe 1
     gezogen hat, bekommt hier das Angebot zur Vertiefung — der Server
     rechnet sie als Differenz ab, nicht als zweiten vollen Abruf. */
  function _rfMarktStufe2Faellig() {
    if (!_rf || _rf.marktPlusGetan) return;
    if (_rf.marktStufe >= 2 && _rf.marktGewollt && !_rf.markt2) {
      _rf.marktPlusGetan = 1;
      _rfMarktStarten(2);
      return;
    }
    /* Stufe 1 lief schon: einmal die Vertiefung anbieten. */
    if (_rf.markt && !_rf.markt2 && !_rf.marktPlusGefragt) {
      var kg = _rfKontingent();
      if (!kg || !kg.mpi_plus) return;
      _rf.marktPlusGefragt = 1;
      _rf.abrufOffen = 'markt2';
      _rfBlase('co', 'Jetzt hätte ich alles beisammen für die <b>erweiterte Marktpreisindikation</b> — ' +
        'Zustand, Energieausweis, Bodenrichtwert und deine Lagebewertung. Sie bringt zusätzlich ' +
        'die Preishistorie, die amtliche Makrolage und eine Einordnung im Fließtext.');
      _rfAktion('markt2', 'Die Vertiefung kostet nur die Differenz — die erste Stufe ist schon bezahlt.',
                'Erweiterte holen', { frei: kg.mpi_plus, stufe: 2 });
    }
  }

  function _rfMarktStarten(stufeErzwungen) {
    if (!_rf) return;
    var stufe = stufeErzwungen || _rf.marktStufe || 1;
    if (stufe < 2 && (_rf.marktLaeuft || _rf.markt)) return;
    if (stufe >= 2 && (_rf.marktLaeuft || _rf.markt2)) return;
    if (!_rf.marktGewollt) return;
    _rf.marktLaeuft = stufe;
    var obj = {
      plz: _rfFeld('plz') || '', ort: _rfFeld('ort') || '',
      str: _rfFeld('str') || '', hnr: _rfFeld('hnr') || '',
      objart: _rfFeld('objart') || '', objektart: _rfFeld('objart') || '',
      wfl: _rfNum(_rfFeld('wfl')), zimmer: _rfNum(_rfFeld('zimmer')),
      baujahr: _rfNum(_rfFeld('baujahr')), kp: _rfNum(_rfFeld('kp')),
      nkm: _rfNum(_rfFeld('nkm'))
    };
    /* v1290: Was der VOLLE Bericht zusaetzlich liest, geht nur bei Stufe 2
       mit — bei Stufe 1 wird es ohnehin nicht ausgewertet, und ein Feld,
       das nichts bewirkt, gehoert nicht in den Aufruf. */
    if (stufe >= 2) {
      ['ds2_zustand', 'ds2_energie', 'brw', 'etage', 'mikrolage', 'makrolage',
       'ds2_bevoelkerung', 'ds2_nachfrage', 'ds2_entwicklung', 'ds2_wertsteigerung',
       'ds2_mietausfall', 'ds2_marktmiete', 'ausst', 'vermstand', 'gsfl', 'mea'
      ].forEach(function (id) {
        var v = _rfFeld(id);
        if (v !== null && v !== undefined && v !== '') obj[id] = v;
      });
    }
    var koerper = (stufe >= 2) ? { wert_stufe: 2, object: obj } : { fast: true, object: obj };
    try { koerper.external_ref = window._currentObjKey || null; } catch (e) {}
    _rfBlase('co', '<span style="opacity:.75">' +
      (stufe >= 2 ? 'Die erweiterte Marktpreisindikation läuft — sie rechnet länger, weil sie ' +
                    'Preishistorie und Makrolage mitnimmt. '
                  : 'Die Marktpreisindikation läuft — ich melde mich, sobald sie da ist. ') +
      'Weiter im Text:</span>');
    /* Auth.apiCall geht durch den zentralen 401-Handler; nacktes fetch
       wuerde ihn umgehen (FALLEN.md). 90 s statt der 15 s Vorgabe: der
       Marktbericht rechnet, und ein Zeitueberlauf saehe hier aus wie ein
       Fehler, waere aber Ungeduld. */
    Auth.apiCall('/marktbericht/reports/from-dealpilot',
                 { method: 'POST', body: koerper, timeout: (stufe >= 2 ? 180000 : 90000) })
      .then(function (d) { if (_rf) _rfMarktFertig(d, stufe); })
      .catch(function (err) { if (_rf) _rfMarktFehler(err, stufe); });
  }

  function _rfMarktFehler(err, stufe) {
    _rf.marktLaeuft = 0;
    var d = (err && err.data) || {};
    var m = d.message || d.error || (err && err.message) || '';
    try { console.warn('[voice] Marktpreisindikation fehlgeschlagen:', m, err); } catch (e) {}
    var was = (stufe >= 2) ? 'erweiterte Marktpreisindikation' : 'Marktpreisindikation';
    /* Leise. Der Ablauf darf nie auf einen Abruf warten — und er darf auch
       nicht von einem gescheiterten Abruf gestoert werden. Ein fehlendes
       Kontingent wird trotzdem BENANNT: es ist kein Fehler, sondern eine
       Auskunft, und der Nutzer soll wissen, warum nichts kam. */
    if (d.error === 'kein_kontingent') {
      _rfBlase('co', '<span style="opacity:.7">Für die ' + escH(was) + ' ist dein Kontingent ' +
        'aufgebraucht — es wurde nichts abgebucht. Ich frage die Werte stattdessen ab.</span>');
      return;
    }
    _rfBlase('co', '<span style="opacity:.6">Die ' + escH(was) + ' kam nicht durch' +
      (m ? ' (' + escH(String(m).slice(0, 120)) + ')' : '') +
      ' — es wurde nichts abgebucht. Wir machen ohne sie weiter.</span>');
  }

  function _rfMarktFertig(d, stufe) {
    stufe = stufe || 1;
    _rf.marktLaeuft = 0;
    var was = (stufe >= 2) ? 'Erweiterte Marktpreisindikation' : 'Marktpreisindikation';
    if (!d || d.no_data) {
      _rfBlase('co', '<span style="opacity:.6">Für diese Adresse liegen keine Marktdaten vor — ' +
                     'es wurde nichts abgebucht.</span>');
      return;
    }
    var p = d.data || d;
    var mv = (p.valuation && p.valuation.market_value) || {};
    var rent = p.rent || {};
    var wfl = _rfNum(_rfFeld('wfl'));
    var M = {
      stufe: stufe,
      mw: (mv.estimated != null) ? mv.estimated : null,
      low: mv.low != null ? mv.low : null, high: mv.high != null ? mv.high : null,
      sqm: (mv.basis_median_sqm != null) ? mv.basis_median_sqm
           : ((mv.estimated != null && wfl) ? Math.round(mv.estimated / wfl) : null),
      mikroRaw: (p.micro && p.micro.score != null) ? p.micro.score : null,
      makroRaw: (p.macro && p.macro.score != null) ? p.macro.score : null,
      mietSqm: (rent.median_per_sqm != null) ? rent.median_per_sqm
               : (((p.valuation && p.valuation.inputs) || {}).market_rent_sqm != null
                  ? p.valuation.inputs.market_rent_sqm : null),
      trend: (p.price_trend_pct != null) ? p.price_trend_pct : null,
      konfidenz: mv.confidence_label || null,
      /* v1290: nur die volle Stufe liefert Fliesstext und Historie. */
      text: (p.report_md && !/Schnell-Modus/.test(String(p.report_md))) ? String(p.report_md) : null
    };
    _rf.markt = M;
    if (stufe >= 2) _rf.markt2 = M;
    _mbGeholt = true;   /* v1293: die Pre-Flight-Kette ueberspringt den eigenen Abruf */

    /* Die Lagestufen: 0-100 vom Marktbericht auf die fuenf Stufen des
       Formulars. Die Grenzen sind dieselben wie in dealpilot-mb.js
       (_v746lbl, Skala 0-10): >=8 sehr gut, >=6 gut, >=4 durchschnittlich,
       >=2 schwach, darunter sehr schwach. EINE Umrechnung, nicht zwei. */
    M.makro = _lageStufe(M.makroRaw);
    M.mikro = _lageStufe(M.mikroRaw);

    var zeilen = [];
    if (M.mw != null) zeilen.push(_zeile('Marktwert', _euroKurz(M.mw) + (M.sqm ? ' · ' + _euroKurz(M.sqm) + '/m²' : '')));
    var kp = _rfNum(_rfFeld('kp'));
    if (M.mw != null && kp != null && kp > 0) {
      var abw = (kp - M.mw) / M.mw * 100;
      zeilen.push(_zeile('Dein Preis', (abw >= 0 ? '+' : '') + _pctTxt(abw, 1) + (abw <= 0 ? ' darunter' : ' darüber'),
                         abw <= 0 ? 'gut' : 'schlecht'));
    }
    if (M.mietSqm != null) zeilen.push(_zeile('Mietniveau', String(Math.round(M.mietSqm * 100) / 100).replace('.', ',') + ' €/m²'));
    if (M.makro) zeilen.push(_zeile('Makrolage', _lageWort(M.makro)));
    if (M.mikro) zeilen.push(_zeile('Mikrolage', _lageWort(M.mikro)));
    if (M.trend != null) zeilen.push(_zeile('Preistrend', (M.trend >= 0 ? '+' : '') + _pctTxt(M.trend, 1) + ' p.a.'));

    var Q = (stufe >= 2) ? 'Marktpreisindikation (erweitert)' : 'Marktpreisindikation';
    var eingetragen = [];
    if (M.makro && _rfSetzen('makrolage', M.makro, Q)) eingetragen.push('Makrolage');
    if (M.mikro && _rfSetzen('mikrolage', M.mikro, Q)) eingetragen.push('Mikrolage');
    if (M.mietSqm != null && _rfSetzen('ds2_marktmiete', String(Math.round(M.mietSqm * 100) / 100).replace('.', ','), Q)) eingetragen.push('Marktmiete');
    if (M.mw != null && _rfSetzen('svwert', String(Math.round(M.mw)), Q)) eingetragen.push('Marktwert');

    /* v1290: Wer fuer die volle Stufe bezahlt, bekommt auch zu sehen, was
       sie mehr kann. Ein Fliesstext, der nur in der Antwort steht und
       nirgends erscheint, ist bezahlte Unsichtbarkeit. */
    var text = '';
    if (M.text) {
      var kurz = M.text.replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim();
      text = '<details class="vi-sc-mehr"><summary>Einordnung im Fließtext</summary>' +
             '<p>' + escH(kurz.slice(0, 1400)) + (kurz.length > 1400 ? ' …' : '') + '</p></details>';
    }

    _rfBlase('co', '<b>Die ' + escH(was) + ' ist da.</b>' +
      '<div class="vi-sc"><div class="vi-sc-kopf"><span class="vi-sc-titel">' + escH(was) +
        (M.konfidenz ? ' · ' + escH(M.konfidenz) : '') + '</span></div>' +
      '<div class="vi-sc-gitter">' + zeilen.join('') + '</div>' + text +
      (eingetragen.length
        ? '<div class="vi-sc-annahmen"><b>Übernommen:</b> ' + escH(eingetragen.join(', ')) +
          ' — in der Übersicht mit Herkunft „' + escH(Q) + '", nicht als etwas, das du gesagt hast.</div>'
        : '') +
      '</div>');
    _rfStandZeichnen();
    /* v1288: Steht die Lage-Frage gerade an, ist sie damit beantwortet. */
    try {
      var e = _rf.offen[_rf.i];
      if (e && e.abruf === 'lage' && !_rfFehlt(e, _rf.data.fields)) {
        _rfBlase('co', '<span style="opacity:.7">Die Lage habe ich damit — weiter.</span>');
        setTimeout(_rfWeiter, 400);
      }
    } catch (ex) {}
  }

  function _lageStufe(raw) {
    if (raw == null || !isFinite(raw)) return null;
    var s = raw / 10;
    if (s >= 8) return 'sehr_gut';
    if (s >= 6) return 'gut';
    if (s >= 4) return 'durchschnittlich';
    if (s >= 2) return 'schwach';
    return 'sehr_schwach';
  }
  var _LAGE_WORT = { sehr_gut: 'Sehr gut', gut: 'Gut', durchschnittlich: 'Durchschnittlich',
                     schwach: 'Schwach', sehr_schwach: 'Sehr schwach' };
  function _lageWort(k) { return _LAGE_WORT[k] || '–'; }

  function _rfLageUebernehmen() {
    var M = _rf && _rf.markt;
    if (!M) return;
    var Q = 'Marktpreisindikation';
    var n = [];
    if (M.makro && _rfSetzen('makrolage', M.makro, Q)) n.push('Makrolage ' + _lageWort(M.makro));
    if (M.mikro && _rfSetzen('mikrolage', M.mikro, Q)) n.push('Mikrolage ' + _lageWort(M.mikro));
    _rfBlase('co', n.length
      ? 'Übernommen: <b>' + escH(n.join(' · ')) + '</b> — Herkunft ' + escH(Q) + '.'
      : 'Die Lagewerte standen schon — ich lasse sie, wie du sie gesagt hast.');
    _rfStandZeichnen();
    setTimeout(_rfWeiter, 300);
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
      /* v1288: das Etappenband - wo im Sprechlauf stehen wir gerade. */
      '<div id="vi-rf-band" style="display:none"></div>' +
      /* v1281: Verlauf und Stand nebeneinander - der Chat zeigt was WAR,
         die Spalte zeigt was IST. */
      '<div class="vi-rf-buehne">' +
        '<div class="vi-rf-chat" id="vi-rf-chat"></div>' +
        '<div class="vi-rf-stand" id="vi-rf-stand"></div>' +
      '</div>' +
      /* v1291: Die Aktionsleiste — was jetzt dran ist und was der Co-Pilot
         anbietet. Fest zwischen Verlauf und Mikrofon, scrollt nicht mit. */
      '<div class="vi-rf-dran" id="vi-rf-dran" style="display:none"></div>' +
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
      '<div class="vi-rf-neben" id="vi-rf-neben">' +
        '<button type="button" id="vi-rf-nix">Weiß ich nicht</button>' +
        '<button type="button" id="vi-rf-passt" style="display:none"></button>' +
        '<button type="button" id="vi-rf-ende">Fertig — zur Übersicht</button>' +
      '</div>' +
      '<div id="vi-rf-gesagt" style="display:none"></div>';
    h.style.display = '';
    /* v1290b: Der Dialog-Modus schaltet das Flex-Layout ein — der Verlauf
       nimmt den Platz, der uebrig ist, statt einer festen Hoehe. */
    try { var _ov = $('oabi-ov'); if (_ov) _ov.classList.add('vi-dialog'); } catch (e) {}

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
        _rfProfilWerte(pv);   /* v1288b: samt Herkunft */
        Object.keys(pv.werte).forEach(function (id) {
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
        /* v1288b: Ein Wert, der schon im Formular stand, ist keine Aussage
           des Nutzers — er hat ihn nur bestaetigt. */
        if (!_rf.quelle) _rf.quelle = {};
        _rf.quelle[e.ids[0]] = 'Vorbelegung, von dir bestätigt';
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
      if (_fs.an) { _fsStart().then(function (ok) { if (ok) _fsHoeren(true); else _fsMikroKasten(false, 'Mikrofon nicht verfügbar', 'Bitte tippen.'); }); }
      else { _fsStopHoeren(); _fsAus(); _fsMikroKasten(false, 'Freisprechen ist aus', 'Tippe deine Antworten.'); }
    });
  }

  /* ── Eine Frage stellen ──────────────────────────────────────────── */
  function _rfFrage() {
    if (_rf.i >= _rf.offen.length) return _rfFertig();
    var e = _rf.offen[_rf.i];
    /* v1288: Was inzwischen VON SELBST hereingekommen ist — der amtliche
       Bodenrichtwert, die Lagewerte aus der Marktpreisindikation — wird
       nicht noch einmal gefragt. Ein Co-Pilot, der nach etwas fragt, das
       er gerade selbst geholt hat, wirkt nicht schlau, sondern taub.
       Geprueft wird nur, was IN DIESEM Gespraech zusammengekommen ist;
       das Formular zaehlt hier nicht mit (das hat schon `_rfFehlt` beim
       Zusammenstellen der Liste getan). */
    var alleDa = (e.ids || []).length > 0 && (e.ids || []).every(function (id) {
      var v = _rf.data.fields[id];
      return v !== undefined && v !== null && v !== '';
    });
    if (alleDa) { _rfStandZeichnen(); return _rfWeiter(); }
    /* v1288: Ein Angebot gilt nur fuer die Frage, in der es steht. Sonst
       nimmt die naechste Frage ein "ja" entgegen, das dem alten Knopf galt. */
    _rf.abrufOffen = null;
    _rf.nachgehakt = 0;   /* v1290: Nachhaken gilt nur fuer die Frage, in der es passiert ist */
    /* v1291: Angebote gelten fuer IHRE Frage. Was bleibt, ist der
       Marktabruf — der laeuft ueber den ganzen Dialog. */
    (_rf.aktionen || []).slice().forEach(function (a) {
      if (a.art !== 'markt' && a.art !== 'markt2') _rfAktionWeg(a.art);
    });
    /* v1280: Der Vorschlag aus den Einstellungen steht IN der Frage - nicht
       als stiller Knopf daneben. Wer gefragt wird, soll sehen, was der
       Co-Pilot vorhat, bevor er ja sagt. */
    var pv = _rfProfilVorschlag(e);
    /* v1288: Bei einer Auswahl stehen die STUFEN in der Frage. Wir bewerten
       danach - also soll der Nutzer sie hoeren, statt Freitext zu raten. */
    _rfDranBlase(_rfBlase('co', escH(e.frage) + _rfPillen(e) + _rfSkalen(e) +
      (pv ? '<div class="vi-rf-vorschlag">Aus deinen Einstellungen hätte ich: <b>' +
            escH(pv.text) + '</b></div>' : '') +
      _rfAbrufAngebot(e) +
      '<div class="vi-rf-zaehler">Frage ' + (_rf.i + 1) + ' von ' + _rf.offen.length +
        (e.et ? ' · Etappe ' + e.et + ' · ' + escH(_etName(e.et)) : '') + '</div>'));
    _rf.profilVorschlag = pv;
    _rfStandZeichnen();   /* v1281 */
    _rfBandZeichnen();    /* v1288 */
    _rfDranZeichnen();    /* v1291: die Aktionsleiste unten */

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
    if (_fs.an && _fs.stream) _fsHoeren(true);
  }

  /* ═══ v1288 · Der Uebergang zwischen zwei Etappen ═════════════════════
     Wechselt die Etappe, kann ein HALT dazwischen stehen: eine Karte mit
     dem Score, der aus dem bisher Gesagten schon rechenbar ist. Der Halt
     stellt keine Frage - er wird gezeigt, und die naechste Frage kommt
     unmittelbar danach. Wer nichts wissen will, ueberliest ihn.

     Der Dialog darf dabei NIE stehenbleiben: `_rfHalt` gibt false zurueck,
     wenn sich nichts rechnen laesst, und dann geht es weiter, als haette
     es den Halt nie gegeben. */
  function _rfWeiter() {
    _fsStopHoeren();
    var vorher = _rf.offen[_rf.i];
    _rf.i++;
    if (_rf.i >= _rf.offen.length) return _rfFertig();
    /* v1288: Direkt nach der Adresse faellt die Entscheidung ueber die
       Marktpreisindikation — dort weiss der Abruf genug ueber das WO, und
       die Entscheidung steht, bevor irgendetwas laeuft. Gefragt wird
       einmal; wer ablehnt, wird nicht wieder gefragt. */
    /* v1291b: Der Dialog HAELT HIER NICHT MEHR AN. Das Angebot steht in
       der Aktionsleiste und bleibt dort sichtbar, bis es angenommen oder
       eine Frage weiter ist — genau dafuer ist die Leiste da. Vorher
       wartete der Ablauf auf eine Entscheidung, und wer sie nicht traf,
       sass fest. Jetzt laeuft er weiter, und das Angebot laeuft mit. */
    if (vorher && vorher.ids && vorher.ids.indexOf('plz') >= 0 && !_rf.marktGefragt) {
      try { _rfMarktAnbieten(); } catch (ex) { try { console.warn('[voice] Marktangebot', ex); } catch (e2) {} }
    }
    var jetzt = _rf.offen[_rf.i];
    if (vorher && jetzt && vorher.et && jetzt.et && jetzt.et > vorher.et) {
      /* Ende der Basis: jetzt kennt der Abruf Flaeche, Baujahr und Preis. */
      /* v1290: jede Stufe startet dort, wo ihre Angaben stehen. */
      if (vorher.et === 1) { try { _rfMarktStarten(1); } catch (ex) {} }
      if (vorher.et === 4) { try { _rfMarktStufe2Faellig(); } catch (ex) {} }
      try { _rfHalt(jetzt.et); } catch (ex) { try { console.warn('[voice] Halt uebersprungen', ex); } catch (e2) {} }
    }
    _rfFrage();
  }

  /* Zuhoeren, ohne eine neue Frage zu stellen — fuer die Momente, in denen
     ein Angebot offen steht und nur ein Ja oder Nein fehlt. */
  function _rfLauschen() {
    var inp = $('vi-rf-in'); if (inp) { inp.value = ''; inp.disabled = false; }
    var pb = $('vi-rf-passt'); if (pb) pb.style.display = 'none';
    if (_fs.an && _fs.stream) _fsHoeren(true);
  }

  /* Nach einer Entscheidung ueber ein Angebot geht es dort weiter, wo der
     Ablauf stand — samt Etappenwechsel, falls einer faellig war. */
  function _rfNachAngebot() {
    _rf.wartetAufMarkt = 0;
    var jetzt = _rf.offen[_rf.i];
    if (!jetzt) { _rfFertig(); return true; }
    var vorher = (_rf.i > 0) ? _rf.offen[_rf.i - 1] : null;
    if (vorher && vorher.et && jetzt.et && jetzt.et > vorher.et) {
      /* v1290: jede Stufe startet dort, wo ihre Angaben stehen. */
      if (vorher.et === 1) { try { _rfMarktStarten(1); } catch (ex) {} }
      if (vorher.et === 4) { try { _rfMarktStufe2Faellig(); } catch (ex) {} }
      try { _rfHalt(jetzt.et); } catch (ex) {}
    }
    _rfFrage();
    return true;
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
  /* ═══════════════════════════════════════════════════════════════════
     v1289 · DIE FEINHEITEN NACH THEMA, NICHT NACH REIHENFOLGE
     ═══════════════════════════════════════════════════════════════════
     Der letzte offene Punkt aus Marcels Plan vom 10.09.2026.

     Bis v1288b entstanden die Feinheiten stumpf: vier Felder je Frage, in
     der Reihenfolge des Formulars, gruppiert nur nach ABSCHNITT. Das ergab
     Fragen wie

       „Objekt: Kuerzel, Bankbewertung, Bevoelkerungsentwicklung,
        Nachfrage-Indikatoren?"

     Vier Dinge, die inhaltlich nichts miteinander zu tun haben — eine
     Frage, die man nicht in einem Satz beantworten kann.

     DER ANKER IST DIE KARTEN-UEBERSCHRIFT, gemessen am 10.09.2026 im
     Browser: `.ct` sitzt in `.card`, und `.card` traegt die `.f`-Felder.
     37 solche Ueberschriften gibt es in den sechs Abschnitten, und sie
     sind bereits das, was wir suchen — echte Themen:

       Objektdaten · Qualitaet & Zustand · Lage- & Markt-Indikatoren ·
       Grund & Boden · Kaufpreis & Nebenkosten · Sanierung · Inventar ·
       Mietstruktur · Mietpreis-Analyse · Mietentwicklung · Persoenliche
       Steuer · Darlehen I · Bauspardarlehen · Umlagefaehige Kosten ·
       Nicht umlagefaehige Kosten · Detailpositionen

     WARUM AUS DEM DOM UND NICHT AUS EINER LISTE: das war der Vorbehalt aus
     v1282, und er gilt weiter. Eine gepflegte Zweitliste von 145 Feldern
     veraltet beim ersten neuen Feld, und niemand merkt es. Die
     Ueberschrift steht ohnehin da, sie wird nur bisher nicht gelesen.

     WO KEINE UEBERSCHRIFT IST, greift wie bisher der Abschnittsname. Das
     ist kein Rueckschritt, sondern der Rueckfall — und er faellt auf,
     weil der Block dann den Bereichsnamen traegt statt eines Themas.

     DIE UEBERSCHRIFT MUSS GESAEUBERT WERDEN. `.ct` enthaelt neben dem
     Titel oft einen Knopf oder eine Live-Marke: gemessen ergaben
     `textContent` die Titel „Sanierung Sanierungsbedarf einschaetzen" und
     „Markt-Kontext (EZB & Geldmarkt) Live · ECB E…". Gelesen werden
     deshalb nur die DIREKTEN Textknoten. */
  var TIEFE_SEC = {
    s0: 'Objekt', s1: 'Kaufpreis & Nebenkosten', s2: 'Miete & Entwicklung',
    s3: 'Finanzierung', 's3-tax': 'Steuer', s4: 'Bewirtschaftung'
  };
  var TIEFE_PRO_FRAGE = 4;

  /* Der Titel steht in der `.ct` — aber nicht allein.
     GEMESSEN am 10.09.2026 an der Inventar-Karte, Kind fuer Kind:

       TEXT ""  ·  SPAN.ct-ico  ·  SPAN (der Titel)  ·  LABEL (ein Schalter)

     Die direkten TEXTKNOTEN sind leer — der Titel steckt in einem <span>.
     Der erste Versuch (nur direkte Textknoten lesen, sonst
     firstElementChild) lieferte deshalb nichts und fiel auf den
     Abschnittsnamen zurueck: „Kaufpreis & Nebenkosten — Kueche, Moebel,
     Geraete, PV-Anlage?" statt „Inventar — …".

     Jetzt andersherum: den ganzen Text nehmen und das entfernen, was
     KEIN Titel ist — Knopf, Schalter, Symbol, Live-Marke, Eingabefeld.
     Gegengeprueft an allen 21 Karten mit Feldern; jede traegt danach
     einen sauberen Namen (Objektdaten · Qualitaet & Zustand · Grund &
     Boden · Inventar · Sanierung · Mietstruktur · Persoenliche Steuer ·
     Darlehen I – Hauptdarlehen · Umlagefaehige Kosten / Jahr · …). */
  var CT_KEIN_TITEL = 'button,a,label,svg,input,select,textarea,.btn,.ct-ico,.live,.chip,.badge,.pill';
  function _kartenTitel(karte) {
    if (!karte) return '';
    var ct = karte.querySelector('.ct');
    if (!ct) return '';
    var t = '';
    try {
      var k = ct.cloneNode(true);
      [].slice.call(k.querySelectorAll(CT_KEIN_TITEL)).forEach(function (x) { x.remove(); });
      t = String(k.textContent || '');
    } catch (e) { t = String(ct.textContent || ''); }
    t = t.replace(/\s+/g, ' ').trim().replace(/[·:\-–—]+$/, '').trim();
    if (t.length > 38) t = t.slice(0, 38).replace(/\s+\S*$/, '') + '…';
    return t;
  }

  /* ═══ v1289b · Was der Sprechlauf NICHT fragt ══════════════════════════
     Gemessen im ersten Durchlauf: 93 Felder in 29 Fragen — davon **37 in
     zehn Fragen allein aus der Karte „Wertermittlung (Marktbericht)"**.
     Das sind Saetze wie „Aussenwaende · 23 %", „Standardstufe (NHK 2010)",
     „Modernisierungsgrad (Anlage 2)", „Liegenschaftszinssatz".

     DAS IST EINE EIGENE STRECKE, und sie gehoert nicht ins Diktat.
     CLAUDE.md ist dort eindeutig: jeder Parameter traegt einen
     Modellvermerk, jede Zahl ihre Herkunft (Stufe A–E, Ausschuss), und
     „kein Verfahren rechnet halb". Ein gesprochener Wert kaeme in der
     Uebernahme-Tabelle als „Sprachaufzeichnung" an — eine Herkunft, die
     nach § 10 ImmoWertV keine ist. Wer die Wertermittlung fuellen will,
     tut das im Marktbericht, wo die Vermerke mitlaufen.

     Dazu die Ueberfuehrungsfelder (`ueberf_*`, `verkehrswert_ueberf`,
     `gesellschafterdarlehen`): sie gehoeren zum Ueberfuehrungs-Wizard
     einer Gesellschaft, nicht zur Aufnahme eines Objekts.

     Ausgeschlossen wird ueber den KARTENTITEL, nicht ueber Feld-ids: die
     Karte ist die Einheit, die der Nutzer sieht, und eine neue Zeile
     darin faellt damit automatisch mit heraus. Bei den
     Ueberfuehrungsfeldern geht es umgekehrt — sie stehen mitten in
     „Objektdaten", also bleibt nur die id. */
  var TIEFE_NICHT_KARTE = /^(Wertermittlung \(Marktbericht\))/i;
  var TIEFE_NICHT_ID = /^(ueberf_|_ueberf|verkehrswert_ueberf|gesellschafterdarlehen|obj_herkunft|halter)/;

  function _rfTiefeBloecke() {
    var schon = {};
    RFRAGEN.forEach(function (e) { e.ids.forEach(function (id) { schon[id] = 1; }); });
    /* v1289: gesammelt wird je KARTE, die Reihenfolge der Abschnitte
       bleibt die des Formulars — dort ist sie eine Erzaehl-Logik. */
    var proKarte = {}, folge = [];
    (window.FIELDS || []).forEach(function (id) {
      if (schon[id]) return;
      if (TIEFE_NICHT_ID.test(id)) return;                    /* v1289b */
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
      var karte = el.closest('.card');
      var titel = _kartenTitel(karte);
      if (titel && TIEFE_NICHT_KARTE.test(titel)) return;      /* v1289b */
      if (!titel) titel = TIEFE_SEC[k];
      var schluessel = k + ' ' + titel;
      if (!proKarte[schluessel]) {
        proKarte[schluessel] = { sec: k, titel: titel, felder: [] };
        folge.push(schluessel);
      }
      proKarte[schluessel].felder.push({ id: id, label: name });
    });

    /* Die Abschnitts-Reihenfolge aus TIEFE_SEC gewinnt, innerhalb bleibt
       die Reihenfolge der Karten im Formular. */
    var secFolge = Object.keys(TIEFE_SEC);
    folge.sort(function (a, b) {
      return secFolge.indexOf(proKarte[a].sec) - secFolge.indexOf(proKarte[b].sec);
    });

    var bloecke = [];
    folge.forEach(function (schluessel) {
      var K = proKarte[schluessel];
      var teile = Math.ceil(K.felder.length / TIEFE_PRO_FRAGE);
      for (var i = 0, nr = 1; i < K.felder.length; i += TIEFE_PRO_FRAGE, nr++) {
        var teil = K.felder.slice(i, i + TIEFE_PRO_FRAGE);
        /* Der Bereich steht VOR der Frage, nicht als Doppelpunkt-Praefix:
           „Inventar — Kueche, Moebel, Geraete?" liest sich wie eine Frage,
           „Inventar: Kueche, Moebel, Geraete?" wie eine Tabellenzeile. */
        var zusatz = (teile > 1) ? ' (' + nr + ' von ' + teile + ')' : '';
        bloecke.push({
          ids: teil.map(function (x) { return x.id; }),
          tiefe: 1, et: 6,   /* v1288: die Feinheiten sind eine eigene Etappe */
          bereich: K.titel + zusatz,
          frage: K.titel + zusatz + ' — ' +
                 teil.map(function (x) { return x.label; }).join(', ') + '?'
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
    /* v1291: Auch diese Frage steht jetzt in der Aktionsleiste unten —
       ein Angebot, das man erst suchen muss, ist keins (Marcels Befund).
       Damit entfaellt auch die Sackgasse aus v1287: die Leiste gibt es
       immer, sie ist Teil des Aufbaus. */
    _rfAktion('tiefe', bloecke.length + ' weitere Fragen · ' + felder + ' Angaben.',
              'Ja, weiter ins Detail');
    /* v1287: „ja" darf man auch SAGEN oder tippen - nicht nur klicken. */
    _rf.tiefeOffen = 1;
    var pb = $('vi-rf-passt'); if (pb) pb.style.display = 'none';
    var inp = $('vi-rf-in'); if (inp) { inp.disabled = false; }
    if (_fs.an && _fs.stream) _fsHoeren(true);
    return true;
  }

  function _rfTiefeStarten() {
    var bloecke = _rf.tiefeBloecke || _rfTiefeBloecke();
    if (!bloecke.length) return _rfFertig();
    _rfKatalogErgaenzen(bloecke);
    _rf.offen = _rf.offen.concat(_rfAufKatalog(bloecke, _rf.catalog));   /* v1293g */
    _rf.tiefeAn = 1;
    _rf.tiefeBloecke = null;
    _rfStandZeichnen();
    _rfFrage();
  }

  /* ═══ v1288 · Der Abschluss ═══════════════════════════════════════════
     Vor der Tabelle steht die Antwort auf die Frage, mit der Marcel den
     ganzen Umbau begonnen hat: „wohin geht die Reise, lohnt sich das,
     lohnt sich das nicht." Beide Scores nebeneinander, mit dem, was der
     Score NICHT weiss.

     Er kommt auch dann, wenn der Nutzer „Fertig" gedrueckt hat — wer
     abbricht, hat trotzdem ein Recht auf das Ergebnis dessen, was er
     schon gesagt hat. Was er nicht bekommt, ist eine weitere FRAGE;
     deshalb steht hier nur ein Knopf und keine Rueckfrage.

     Laesst sich nichts rechnen (kein Kaufpreis, keine Miete), faellt der
     Abschluss aus und es geht direkt zur Tabelle. Ein Fazit, das „keine
     Daten" sagt, ist ein Umweg. */
  function _rfFertig(erzwungen) {
    /* v1282: Ist die Pflichtstrecke durch, wird EINMAL nach den Feinheiten
       gefragt - aber nur im gefuehrten Weg und nur, wenn der Nutzer nicht
       selbst „Fertig" gedrueckt hat. Wer abbricht, will abbrechen. */
    if (!erzwungen && _rf && _rf.alle && !_rf.tiefeAn && !_rf.tiefeGefragt) {
      _rf.tiefeGefragt = 1;
      if (_rfTiefeAnbieten()) return;   /* v1287: nur wenn der Knopf wirklich steht */
    }
    if (_rf && !_rf.abschlussGezeigt) {
      _rf.abschlussGezeigt = 1;
      if (_rfAbschluss()) return;       /* wartet auf „Zur Übersicht" */
    }
    _rfZurTabelle();
  }

  function _rfZurTabelle() {
    if (!_rf) return;
    _fsStopHoeren(); _fsAus();
    var h = $('vi-frage'); if (h) h.style.display = 'none';
    try { var _ov = $('oabi-ov'); if (_ov) _ov.classList.remove('vi-dialog'); } catch (e) {}   /* v1290b: die Tabelle scrollt wieder normal */
    /* v1288: Die Herkunft je Feld geht mit in die Tabelle. Ohne sie stuende
       dort „Sprachaufzeichnung" an Zahlen, die der Co-Pilot selbst geholt
       hat — und genau das war der Vorbehalt im Backlog. */
    if (_rf.quelle) _rf.data.quellen = _rf.quelle;
    showResults(_rf.OA, _rf.data, _rf.catalog);
    _rf = null;
  }

  function _rfAbschluss() {
    var k1 = null, k2 = null;
    try { k1 = _rfScore1Karte(); } catch (e) {}
    try { k2 = _rfScore2Karte(); } catch (e) {}
    if (!k1 && !k2) return false;

    /* Was der Score NICHT weiss. Die Luecken werden benannt, nicht
       weggerechnet — ein Score aus halben Daten ist kein besserer Score,
       er sieht nur so aus. */
    var fehlt = [];
    var pruef = [
      ['kp', 'Kaufpreis'], ['nkm', 'Kaltmiete'], ['wfl', 'Wohnfläche'],
      ['ek', 'Eigenkapital'], ['d1z', 'Zinssatz'], ['hg_nul', 'Hausgeld nicht umlagefähig'],
      ['makrolage', 'Makrolage'], ['mikrolage', 'Mikrolage'],
      ['ds2_zustand', 'Zustand'], ['ds2_energie', 'Energieausweis'],
      ['ds2_bevoelkerung', 'Bevölkerungsentwicklung'], ['ds2_nachfrage', 'Nachfrage']
    ];
    pruef.forEach(function (p) { if (_rfFeld(p[0]) == null) fehlt.push(p[1]); });

    var nk = null;
    try { nk = _rfNkAnnahme(); } catch (e) {}

    _rfBlase('co',
      '<b>Das ist der Stand.</b> Beide Scores rechnen mit dem, was du gesagt hast — ' +
      'nichts davon steht schon im Objekt; das entscheidest du gleich in der Übersicht.' +
      (k1 || '') + (k2 || '') +
      (fehlt.length
        ? '<div class="vi-sc-annahmen" style="margin-top:12px"><b>Was ich nicht weiß:</b> ' +
          escH(fehlt.slice(0, 8).join(', ')) +
          (fehlt.length > 8 ? ' und ' + (fehlt.length - 8) + ' weitere' : '') +
          '. Diese Kennzahlen zählen im Score gar nicht mit — weder für dich noch gegen dich.</div>'
        : '') +
      (nk && nk.quelle === 'pauschal'
        ? '<div class="vi-sc-annahmen"><b>Achtung:</b> die Kaufnebenkosten sind mit 10 % pauschal ' +
          'angenommen. Sag mir die echten Sätze, und die Rechnung stimmt.</div>'
        : ''));

    /* v1291: Der Weg zur Tabelle steht in der Aktionsleiste — dort, wo
       alle Entscheidungen stehen, und nicht zwischen den Nebenknöpfen. */
    _rf.abschlussOffen = 1;
    _rfAktion('tabelle', 'Nichts davon steht schon im Objekt — in der Übersicht wählst du Zeile für Zeile.',
              'Zur Übersicht — Werte übernehmen');
    var inp = $('vi-rf-in'); if (inp) inp.disabled = false;
    if (_fs.an && _fs.stream) _fsHoeren(true);
    return true;
  }
  /* Antwort verarbeiten - egal ob getippt oder gesprochen. */
  function _rfUebernehmen(neu, ausSprache, txt) {
    _rfDenkt(false);
    var e = _rf.offen[_rf.i];
    if (!e) return;
    var namen = [], teil = [], extra = [];
    Object.keys(neu || {}).forEach(function (id) {
      var v = neu[id];
      if (v === '' || v == null) return;
      /* ═══ v1299 · Was nebenbei gesagt wurde, wird BEHALTEN ═════════════
         Hier stand `if (e.ids.indexOf(id) < 0) return;` — „nur was gefragt
         war". Zusammen mit dem engen Katalog hiess das: wer bei der Miete
         das Baujahr mitnennt, sagt es zweimal.

         Jetzt reicht `_rfKatalog` die Felder der naechsten Bloecke mit
         (RF_REICHWEITE), und was davon zurueckkommt, wird eingetragen
         statt verworfen. Die Frage selbst gilt weiter erst als
         beantwortet, wenn IHRE Felder stehen — `teil` prueft unveraendert
         nur `e.ids`. Nebenbei Gesagtes beschleunigt also, es ueberspringt
         nichts. */
      var gefragt = e.ids.indexOf(id) >= 0;
      _rf.data.fields[id] = v;
      var kat = _rf.catalog.filter(function (c) { return c.id === id; })[0];
      var name = (kat ? kat.label : id) + ' = ' + v;
      if (gefragt) namen.push(name); else extra.push(name);
    });
    /* Nebenbei Gesagtes allein traegt die Frage nicht — aber es soll auch
       nicht stillschweigend verschwinden. Wer es sagt, sieht, dass es
       angekommen ist. */
    if (extra.length) {
      _rfBlase('co', '<span style="opacity:.85">Das nehme ich gleich mit: <b>' +
        escH(extra.join(' · ')) + '</b></span>');
      _rfStandZeichnen();
    }
    if (!namen.length && extra.length) {
      /* Die Frage steht noch offen, aber der Satz war nicht umsonst. */
      var fehlt = (e.ids || []).filter(function (id) {
        var w = _rf.data.fields[id];
        return w === undefined || w === null || w === '';
      });
      if (!fehlt.length) { _rfStandZeichnen(); return _rfWeiterGleich(); }
      _rfBlase('co', 'Hier fehlt mir noch: <b>' + escH(_rfFelderNamen(fehlt)) + '</b>.');
      if (ausSprache && _fs.an) _fsHoeren(true);
      return;
    }
    if (!namen.length) {
      /* v1286: Wurde vorher schon das Profil eingetragen, ist die Frage
         beantwortet - dann ist "nichts entnommen" falsch und verwirrend.
         Der Satz trug eben nur die Zusage und sonst nichts Zaehlbares. */
      if (_rf.profilSchonDrin) {
        _rf.profilSchonDrin = 0;
        _rfBlase('co', 'Übernommen — in der Tabelle kannst du sie noch ändern.');
        _rfStandZeichnen();
        return _rfWeiterGleich();
      }
      /* v1290: Wer nichts entnehmen konnte, sagt WAS er gehoert hat und
         WAS er sucht. „Daraus konnte ich nichts entnehmen" laesst einen
         raten, ob das Mikrofon, das Verstaendnis oder die Frage schuld
         war. Und der Hinweis, dass man es einfach nochmal sagen kann,
         gehoert dazu — das Mikrofon laeuft ja weiter. */
      _rfBlase('co', (txt
          ? 'Ich habe „' + escH(String(txt).slice(0, 90)) + '" verstanden, aber nichts gefunden, was hierher passt.'
          : 'Da war nichts zu verstehen.') +
        '<div style="margin-top:7px">Gesucht ist: <b>' + escH(_rfWasGesucht(e)) + '</b>.</div>' +
        '<div style="margin-top:5px;opacity:.75">Sag es einfach nochmal — ich höre schon zu.</div>');
      if (ausSprache && _fs.an) _fsHoeren(true);
      return;
    }
    _rf.profilSchonDrin = 0;
    /* v1290: Wurde nur EIN TEIL des Blocks verstanden, wird nicht
       weitergesprungen — sonst geht die andere Haelfte verloren, und genau
       das ist Marcel passiert („er hat nur die Haelfte aufgenommen").
       Gefragt wird gezielt nach dem Rest. */
    (e.ids || []).forEach(function (id) {
      var v = _rf.data.fields[id];
      if (v === undefined || v === null || v === '') teil.push(id);
    });
    _rfStandZeichnen();
    if (ausSprache && teil.length && teil.length < (e.ids || []).length && !_rf.nachgehakt) {
      _rf.nachgehakt = 1;
      _rfBlase('co', 'Das habe ich. Fehlt noch: <b>' + escH(_rfFelderNamen(teil)) + '</b>.');
      if (_fs.an) _fsHoeren(true);
      return;
    }
    /* v1291: Die Adresse wird bestaetigt, bevor Bodenrichtwert, Marktdaten
       und Lage darauf aufbauen. Die einzige Rueckfrage im ganzen Dialog. */
    if (e.ids && e.ids.indexOf("plz") >= 0 && _rfAdresseBestaetigen()) return;
    _rf.nachgehakt = 0;
    _rfWeiterGleich();
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1291 · DIE ADRESSE WIRD BESTÄTIGT, BEVOR ETWAS DARAUF AUFBAUT
     ═══════════════════════════════════════════════════════════════════
     Marcels Wunsch: „die Adresse sollte man nochmal bestätigen und eine
     Rückfrage stellen."

     Und er hat den wunden Punkt getroffen. Ein Strassenname ist das, was
     eine Transkription am haeufigsten verfehlt — „Hermannstrasse" wird zu
     „Hermann Strasse", „Herrmannstrasse", „Hermanns Trasse". Bei einer
     Zahl faellt das auf; bei einem Namen nicht.

     UND AN DER ADRESSE HAENGT ALLES, was danach kommt: der amtliche
     Bodenrichtwert (Geokodierung), die Marktpreisindikation
     (Adress-Treffer), die Lage-Recherche, die Grunderwerbsteuer. Eine
     falsch verstandene Strasse macht aus vier richtigen Abrufen vier
     falsche — und keiner davon meldet einen Fehler, denn die Nachbarstadt
     hat auch Marktdaten.

     Deshalb ist das hier die EINZIGE Stelle im ganzen Dialog, an der
     zurueckgefragt wird. Ueberall sonst gilt „lieber weiter als
     nachhaken"; hier ist es umgekehrt. */
  function _rfAdresseBestaetigen() {
    if (!_rf || _rf.adresseGeprueft) return false;
    var str = _rfFeld('str'), hnr = _rfFeld('hnr'), plz = _rfFeld('plz'), ort = _rfFeld('ort');
    if (!str && !ort) return false;
    _rf.adresseGeprueft = 1;
    _rf.adresseFrage = 1;
    var zeile = [ [str, hnr].filter(Boolean).join(' '), [plz, ort].filter(Boolean).join(' ') ]
                .filter(Boolean).join(', ');
    var fehlt = [];
    if (!str) fehlt.push('Straße');
    if (!hnr) fehlt.push('Hausnummer');
    if (!plz) fehlt.push('Postleitzahl');
    if (!ort) fehlt.push('Ort');
    var g = _rfGrest();
    _rfBlase('co',
      'Ich habe verstanden: <b class="vi-adr">' + escH(zeile) + '</b>' +
      (g ? '<div class="vi-rf-zaehler">' + escH(g.name) + ' · Grunderwerbsteuer ' +
           escH(_pz(g.rate)) + ' %</div>' : '') +
      (fehlt.length
        ? '<div style="margin-top:8px">Mir fehlt noch: <b>' + escH(fehlt.join(', ')) + '</b>. ' +
          'Sag sie mir einfach — oder „passt so", wenn du sie nicht hast.</div>'
        : '<div style="margin-top:8px"><b>Stimmt das so?</b> Sag „ja" — oder sag mir die Adresse ' +
          'nochmal, wenn ich etwas falsch verstanden habe. ' +
          '<span style="opacity:.7">Daran hängen der Bodenrichtwert, die Marktdaten und die Lage.</span></div>'));
    _rfAktion('adresse', 'Danach hole ich Bodenrichtwert, Marktdaten und Lage zu genau dieser Adresse.',
              fehlt.length ? 'Passt so, weiter' : 'Ja, stimmt');
    if (_fs.an && _fs.stream) _fsHoeren(true);
    return true;
  }

  /* Die Antwort auf die Adress-Rueckfrage. „ja" geht weiter, alles andere
     wird als NEUE Adresse gelesen — wer korrigiert, sagt die Adresse noch
     einmal, nicht das Wort „nein". */
  function _rfAdresseAntwort(t, ausSprache) {
    if (!_rf || !_rf.adresseFrage) return false;
    /* v1305: `_istZustimmung` statt eines Musters, das auf ein einzelnes
       Wort endet — gesprochen sagt niemand nur „ja". */
    if (RF_JA.test(t) || _istZustimmung(t)) {
      _rf.adresseFrage = 0;
      _rfAktionWeg('adresse');
      _rfBlase('ich', escH(t));
      _rfWeiter();
      return true;
    }
    /* v1305: dasselbe für die Ablehnung. „nein stimmt nicht", „nein das
       ist falsch" — auch hier endet der Satz selten beim „nein". */
    if (RF_NEIN_ANGEBOT.test(t) || _istAblehnung(t) ||
        /^(nein|falsch|nicht ganz|so nicht)\b[\s.!,]*$/i.test(t)) {
      _rfBlase('ich', escH(t));
      _rfBlase('co', 'Dann sag mir die Adresse bitte noch einmal — Straße, Hausnummer, Postleitzahl und Ort.');
      /* Die alten Werte raus: sonst mischt sich die falsche Strasse mit
         der neuen Hausnummer. */
      ['str', 'hnr', 'plz', 'ort'].forEach(function (id) { delete _rf.data.fields[id]; });
      _rf.adresseFrage = 0; _rf.adresseGeprueft = 0;
      _rfAktionWeg('adresse');
      _rfStandZeichnen();
      if (ausSprache && _fs.an) _fsHoeren(true);
      return true;
    }
    /* Alles andere ist eine Korrektur — sie geht durch die normale
       Auswertung und ueberschreibt, was dort steht. */
    _rf.adresseFrage = 0; _rf.adresseGeprueft = 0;
    _rfAktionWeg('adresse');
    return false;
  }

  /* v1290: Nicht weitergehen, solange jemand redet. Der Recorder laeuft
     durch — wer nachschiebt, soll noch zur GLEICHEN Frage gehoert werden.
     Ohne das landet der Nachschlag bei der naechsten. */
  function _rfWeiterGleich() {
    var versuche = 0;
    (function warte() {
      if (!_rf) return;
      if ((_fsSprichtGerade() || _fs.laeuft > 0) && versuche++ < 40) {
        return setTimeout(warte, 150);
      }
      _rfWeiter();
    })();
  }

  /* Die Namen der Felder eines Blocks, lesbar. */
  function _rfFelderNamen(ids) {
    return (ids || []).map(function (id) {
      var kat = (_rf && _rf.catalog || []).filter(function (c) { return c.id === id; })[0];
      return kat ? String(kat.label).replace(/\s*\(.*?\)\s*$/, '') : id;
    }).join(', ');
  }
  function _rfWasGesucht(e) { return _rfFelderNamen(e && e.ids); }

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
      body: { frage: text, kontext: _rfKontextKlar() || _rfKontext() }
    }).then(function (r) {
      _rfDenkt(false);
      _rfBlase('co', escH((r && r.antwort) || 'Dazu weiß ich gerade nichts.'));
      /* Nach der Auskunft geht es weiter, wo es aufgehoert hat - die Frage,
         die offen war, ist immer noch offen. */
      var e = _rf.offen[_rf.i];
      if (e) _rfBlase('co', '<span style="opacity:.7">Zurück zur Frage:</span> ' + escH(e.frage));
      if (_fs.an && _fs.stream) _fsHoeren(true);
    }).catch(function (err) {
      _rfDenkt(false);
      _rfBlase('co', escH((err && err.message) || 'Das konnte ich gerade nicht beantworten.'));
      if (_fs.an && _fs.stream) _fsHoeren(true);
    });
  }

  /* v1288 · Ein Angebot annehmen darf man auch SAGEN. Erkannt wird nur
     eine klare, alleinstehende Zusage — „ja, hol den mal" ja, „ja, der
     Bodenrichtwert liegt bei 320" nein. Im Zweifel gilt der Satz als
     Angabe: eine falsch als Zusage verstandene Zahl waere verloren, ein
     nicht erkanntes Ja kostet nur einen Klick. */
  var RF_JA = /^(ja|jo|jup|klar|gerne|gern|okay|ok|mach(\s+(das|mal))?|los|bitte|hol(\s+(sie|ihn|das|den|mal))?|holen|unbedingt|auf jeden fall|ja bitte|ja gerne|ja klar)\b[\s.!,]*$/i;
  var RF_NEIN_ANGEBOT = /^(nein|nee|ne|danke|nein danke|kein bedarf|brauch(e)? ich nicht|lass mal|lass(en)? wir|sp(ä|ae)ter|nicht n(ö|oe)tig|ohne)\b[\s.!,]*$/i;

  /* ═══ v1305 · „ja stimmt" ist auch ein Ja ═══════════════════════════════
     Marcels Befund vom 11.09.2026: „dann hab ich die Adresse diktiert, er
     fragt ‚Stimmt das so?‘, ich sage ‚ja stimmt‘ — und er fängt wieder an,
     nach der Adresse zu fragen. Die Bestätigung muss auch per Sprache
     gehen."

     `RF_JA` verlangt, dass der Satz MIT dem Ja ENDET (`\b[\s.!,]*$`).
     „ja stimmt" hat ein Wort zu viel; das zweite Muster verlangte
     „stimmt" am ANFANG. Der Satz fiel durch beide, galt damit als
     Korrektur, ging an die Auswertung — und die fand in „ja stimmt" keine
     Adresse. Also kam die Frage noch einmal.

     GESPROCHEN SAGT NIEMAND NUR „JA". Man sagt „ja stimmt", „ja genau so",
     „passt so", „jo, richtig". Ein Muster, das auf ein einzelnes Wort
     endet, ist für getippte Antworten gebaut, nicht für gesprochene.

     `_istZustimmung` prüft deshalb, ob der Satz AUSSCHLIESSLICH aus
     Zustimmungswörtern besteht — in beliebiger Zahl und Folge.

     DIE GRENZE IST WICHTIG: „ja, aber die Hausnummer ist zwölf" darf KEINE
     Bestätigung sein. Deshalb steigt die Prüfung bei jedem Wort aus, das
     nicht in der Liste steht — und Ziffern stehen nie darin. Ein „aber"
     ebenso wenig. Wer einschränkt, bestätigt nicht. */
  var RF_ZU_WORT = /^(ja|jo|jup|jawohl|yep|yes|genau|stimmt|stimmts|richtig|korrekt|passt|passt?e|perfekt|super|prima|gut|klar|sicher|absolut|exakt|so|das|es|ist|war|alles|voll|total|sehr|schon|damit|einverstanden|bestaetigt|best(ä|ae)tigt|ok|okay|okey|joa|mhm|hm|aha|eben)$/i;

  /* Das Gegenstück. Wer „nein, stimmt nicht" sagt, lehnt ab — auch wenn
     „nicht" darin steht, das die Zustimmung ausschliesst. Deshalb eine
     eigene Wortliste statt einer Verneinung der ersten.

     Ziffern beenden auch hier die Prüfung: „nein, Hausnummer zwölf" ist
     eine Korrektur mit Inhalt und gehört an die Auswertung, nicht in die
     Schleife „sag es noch einmal". */
  var RF_AB_WORT = /^(nein|nee|ne|n(ö|oe)|falsch|nicht|nichts|stimmt|so|das|es|ist|war|leider|garnicht|gar|quatsch|unsinn|bl(ö|oe)dsinn|daneben|vertan|versprochen|ganz)$/i;

  function _istAblehnung(text) {
    var t = String(text || '').trim();
    if (!t) return false;
    if (/\d/.test(t)) return false;
    var worte = t.toLowerCase().replace(/[.,!?;:„“"']/g, ' ').split(/\s+/).filter(Boolean);
    if (!worte.length || worte.length > 6) return false;
    var kern = 0;
    for (var i = 0; i < worte.length; i++) {
      if (!RF_AB_WORT.test(worte[i])) return false;
      if (/^(nein|nee|ne|n(ö|oe)|falsch|quatsch|unsinn|bl(ö|oe)dsinn|daneben)$/i.test(worte[i])) kern++;
    }
    return kern > 0;
  }

  function _istZustimmung(text) {
    var t = String(text || '').trim();
    if (!t) return false;
    if (/\d/.test(t)) return false;              /* Zahlen = Korrektur */
    if (/\b(aber|jedoch|allerdings|nur|au(ss|ß)er|nicht|kein)\b/i.test(t)) return false;
    var worte = t.toLowerCase().replace(/[.,!?;:„“"']/g, ' ').split(/\s+/).filter(Boolean);
    if (!worte.length || worte.length > 6) return false;
    /* Mindestens EIN echtes Zustimmungswort — „so ist das" allein wäre
       sonst eine Bestätigung, obwohl darin keine steht. */
    var kern = 0;
    for (var i = 0; i < worte.length; i++) {
      if (!RF_ZU_WORT.test(worte[i])) return false;
      if (/^(ja|jo|jup|jawohl|yep|yes|genau|stimmt|stimmts|richtig|korrekt|passt|perfekt|einverstanden|ok|okay|okey|exakt|absolut)$/i.test(worte[i])) kern++;
    }
    return kern > 0;
  }

  function _rfVorabErkennen(text, ausSprache) {
    var t = String(text || '').trim();
    if (!t) return true;

    /* v1291: Die Adress-Rueckfrage hat Vorrang vor allem anderen. */    if (_rf.adresseFrage && _rfAdresseAntwort(t, ausSprache)) return true;
    /* v1291: Steht ein Angebot in der Aktionsleiste, ist „ja" die Antwort
       darauf. EIN Weg fuer alle Angebote — vorher hatte jedes seinen
       eigenen, und einer davon vergass die Fortsetzung (v1290). Wer die
       Aktion beim Namen nennt („hol den Bodenrichtwert"), bekommt sie
       auch dann, wenn mehrere offenstehen. */
    /* v1305: auch hier ein gesprochenes „ja gerne, mach das" statt nur „ja". */
    if ((_rf.aktionen || []).length && (RF_JA.test(t) || _istZustimmung(t))) {
      if (_rfAktionJa(t)) return true;
    }
    if ((_rf.aktionen || []).length > 1 && /^(hol|nimm|mach|recherchier|bodenrichtwert|die lage|marktpreis)/i.test(t)) {
      if (_rfAktionJa(t)) return true;
    }
    /* v1291b: „nein danke" raeumt die Angebote weg, ohne die Frage zu
       ueberspringen. Wer ein Angebot ablehnt, will nicht die Frage
       ueberspringen — er will nur den Abruf nicht. */
    if ((_rf.aktionen || []).length && (RF_NEIN_ANGEBOT.test(t) || _istAblehnung(t))) {
      _rf.abrufOffen = null;
      (_rf.aktionen || []).slice().forEach(function (a) { _rfAktionWeg(a.art); });
      _rfBlase('ich', escH(t));
      _rfBlase('co', '<span style="opacity:.7">Alles klar — dann frage ich die Werte ganz normal ab.</span>');
      if (ausSprache && _fs.an) _fsHoeren(true);
      return true;
    }
    /* v1288: Am Abschluss steht keine Feldfrage mehr offen. Eine Zusage
       fuehrt zur Tabelle, alles andere ist eine FRAGE — dort will niemand
       mehr Werte nennen, dort will man wissen, was die Zahlen bedeuten.
       Genau das war Marcels Wunsch: „dass man aber auch andere Sachen
       fragen kann dann zu der Wohnung." */
    if (_rf.abschlussOffen) {
      if (RF_JA.test(t) || _istZustimmung(t) ||
          /^(weiter|(ü|ue)bersicht|zur (tabelle|(ü|ue)bersicht)|fertig|passt|(ü|ue)bernehmen)\b[\s.!,]*$/i.test(t)) {
        _rfBlase('ich', escH(t));
        _rfZurTabelle();
        return true;
      }
      _rfFrageBeantworten(t);
      return true;
    }



    /* v1287: Steht die Feinheiten-Frage offen, ist „ja" die Antwort darauf -
       nicht eine Angabe zu einem Feld. Auch gesprochen. */
    if (_rf.tiefeOffen) {
      if (/^(ja|jo|klar|gerne|gern|okay|ok|mach|weiter ins detail|los)\b/i.test(t)) {
        _rf.tiefeOffen = 0;
        var jb = $('vi-rf-tiefe-ja'); if (jb) jb.remove();
        _rfBlase('ich', escH(t));
        _rfTiefeStarten();
        return true;
      }
      if (RF_NEIN.test(t) || /^(nein|nee|reicht|fertig|passt so|das reicht)\b/i.test(t)) {
        _rf.tiefeOffen = 0;
        _rfBlase('ich', escH(t));
        _rfFertig(true);
        return true;
      }
    }

    /* 1. Frage? Dann beantworten statt eintragen. */
    if (_rfIstFrage(t)) { _rfFrageBeantworten(t); return true; }

    /* 2. Verneinung: „haben wir nicht", „kommt nicht in Frage", „weiter". */
    if (_rfIstVerneinung(t)) {   /* v1288b: auch satzweise */
      _rfBlase('ich', escH(t));
      _rfUeberspringen(true);
      return true;
    }

    /* 3. v1286 · „… aus den Einstellungen übernehmen" — in beliebiger
       Wortstellung. Ist der Satz damit erschöpft (kurze Zusage), sind wir
       fertig. Trägt er noch mehr („Eigenkapital sind 10 % vom Kaufpreis"),
       wird das Profil eingetragen UND der Satz danach ausgewertet: was
       ausdrücklich gesagt wurde, gewinnt gegen die Vorbelegung. */
    if (_rfWillProfil(t)) {
      var pv = _rfProfilEintragen();
      _rfBlase('ich', escH(t));
      /* v1298: Kein Vorschlag da? Dann steht vielleicht eine VORBELEGUNG im
         Feld — „kann genauso bleiben" meint genau die. Und wenn auch die
         fehlt, wird das gesagt, statt so zu tun, als sei etwas passiert.
         Vorher lief beides in denselben Satz „Übernommen", auch wenn
         nichts übernommen wurde. */
      if (!pv) {
        var e0 = _rf.offen[_rf.i];
        var vb = e0 ? _rfVorschlag(e0) : null;
        if (vb) {
          _rf.data.fields[e0.ids[0]] = vb;
          if (!_rf.quelle) _rf.quelle = {};
          _rf.quelle[e0.ids[0]] = 'Vorbelegung, von dir bestätigt';
          _rfBlase('co', 'Bleibt bei <b>' + escH(_rfLesbar(vb, e0)) + '</b> — in der Tabelle kannst du das noch ändern.');
        } else {
          _rfBlase('co', 'Dazu ist in deinen Einstellungen nichts hinterlegt, und im Feld steht auch ' +
            'noch nichts. Sag mir einen Wert, oder sag <b>überspringen</b> — dann lasse ich es offen.');
          _rfDranZeichnen();
          return true;   /* NICHT weitergehen: die Frage ist unbeantwortet */
        }
        _rfStandZeichnen();
        _rfWeiter();
        return true;
      }
      var nurZusage = t.split(/\s+/).length <= 8;
      if (nurZusage) {
        _rfBlase('co', 'Übernommen — in der Tabelle kannst du sie noch ändern.');
        _rfStandZeichnen();
        _rfWeiter();
        return true;
      }
      /* Weiter im Text: derselbe Satz geht zusätzlich an die Auswertung. */
      _rf.profilSchonDrin = 1;
      _rfMelden('', true);
      _rfAuswerten(t, ausSprache);
      return true;
    }
    return false;
  }

  /* v1286: Ein Weg für beide Eingaben - getippt und gesprochen laufen
     seit jeher durch dieselbe Auswertung, aber an zwei Stellen im Code.
     Zwei Stellen heisst zwei Verhaltensweisen, sobald eine sich aendert. */
  function _rfAuswerten(text, ausSprache) {
    var e = _rf.offen[_rf.i];
    if (!e) return;   /* v1288: nach dem letzten Block gibt es nichts mehr einzuordnen */
    return Auth.apiCall('/ai/extract-text', {
      method: 'POST',
      body: { text: text, catalog: _rfKatalog(e, _rf.catalog), kontext: _rfKontext() }
    }).then(function (r) {
      var inp = $('vi-rf-in'); if (inp) inp.disabled = false;
      _rfUebernehmen(r && r.fields, ausSprache);
    }).catch(function (err) {
      var inp = $('vi-rf-in'); if (inp) inp.disabled = false;
      _rfDenkt(false);
      _rfBlase('co', '⚠ ' + escH((err && err.message) || 'Das hat gerade nicht geklappt.'));
    });
  }

  function _rfSenden() {
    var inp = $('vi-rf-in'); if (!inp) return;
    var text = String(inp.value || '').trim();
    if (!text) return;
    _fsStopHoeren();
    inp.value = '';
    if (_rfVorabErkennen(text, false)) return;
    inp.disabled = true;
    _rfBlase('ich', escH(text));
    _rfMelden('', true);
    _rfAuswerten(text, false);
  }

  /* ═══════════════════════════════════════════════════════════════════
     v1293 · DER SPRECHLAUF WEISS, WAS VORHER LIEF
     ═══════════════════════════════════════════════════════════════════
     Marcels Auftrag: die Daten aus Exposé und Marktbericht sollen im
     Sprechlauf „mit integriert" werden, und gefragt wird „nur noch, was
     uns fehlt".

     DAS ÜBERSPRINGEN GAB ES SCHON — `rueckfragen(..., alle)` filtert mit
     `_rfFehlt`, und das prueft neben dem Gespraech auch das Formular.
     Wer ein Exposé eingelesen hat, wird nach dem Kaufpreis nicht mehr
     gefragt. WAS FEHLTE, war zweierlei:

       1. Der Co-Pilot SAGTE es nicht. Er begann bei „16 Fragen in 5
          Etappen", obwohl neun davon schon beantwortet waren. Wer gerade
          ein Exposé hochgeladen hat und dann dieselbe Begruessung
          bekommt wie beim leeren Objekt, glaubt, der Import sei
          verpufft.
       2. Die Uebersichtsspalte nannte die Werte „VORBELEGT" — dasselbe
          Wort wie fuer eine Formular-Vorgabe aus `index.html`. Ein Wert
          aus dem Exposé ist aber etwas ganz anderes als eine Vorgabe:
          er ist eine ANGABE, nur eben keine gesprochene.

     Beides haengt an derselben Kleinigkeit: der Sprechlauf wusste nicht,
     dass vor ihm etwas lief. Jetzt bekommt er es gesagt.

     GEZAEHLT wird nur, was die KETTE als neu meldet — siehe unten. */
  /* v1293f: Die Namen der Quellen. Standen bis v1293c ueber
     _rfVorbefuellt und sind beim Umbau mit dem Kommentarblock
     verschwunden — ein ReferenceError, den `node --check` nicht findet
     und der den ganzen gefuehrten Weg lahmlegte, sobald die Kette lief.
     „Vertraege prueft nur ein echter Lauf" (CLAUDE.md). */
  var VORLAUF_NAME = { import: 'Exposé / Marktbericht', immometrica: 'ImmoMetrica',
                       voice: 'Sprachaufzeichnung' };
  /* v1293d: OHNE die Liste der Kette gibt es KEINEN Vorlauf-Satz.
     Gemessen an einem frisch angelegten Objekt: „61 Angaben stehen schon
     im Objekt" — bei leerem Formular. Gezaehlt wurden die Vorgaben aus
     `index.html` (Notar 2,20 %, Grunderwerbsteuer 6,50 %, die acht
     Sanierungsgewerke, die Bauspar-Saetze …).

     Es ist derselbe Fehler wie in v1293b, nur im anderen Zweig: dort hat
     ihn die Kette behoben, hier fiel er auf „alles im Formular" zurueck.
     Der Rueckfall ist damit erledigt — nur wer sagen kann, WOHER die
     Werte kommen, sagt ueberhaupt etwas. Wer den Sprechlauf direkt
     oeffnet, bekommt keinen Satz, und das ist richtig: er weiss ja
     selbst, was in seinem Objekt steht. */
  function _rfVorbefuellt(catalog) {
    var out = {};
    if (!_vorlaufFelder) return out;
    var nurDiese = {};
    _vorlaufFelder.forEach(function (id) { nurDiese[id] = 1; });
    (catalog || []).forEach(function (e) {
      if (!nurDiese[e.id]) return;
      var el = document.getElementById(e.id);
      if (!el) return;
      var v = String(el.value || '').trim();
      if (v !== '') out[e.id] = v;
    });
    return out;
  }
  /* ═══ v1293g · Nur fragen, was auch ankommen kann ═══════════════════
     Gemessen im Quick-Check-Ziel (`target: 'qc'`): der Katalog fuehrt
     dort **19** Felder, der Dialog stellte aber **13 Fragen — neun davon
     zu Feldern, die es im QC-Katalog gar nicht gibt**: Kaufnebenkosten,
     Lage, Sanierung, Grundstueck, Entwicklung, Steuer, These.

     Das ist nicht nur unnuetz, es ist ein harter Fehler. `_rfKatalog()`
     filtert die Frage auf die Katalogfelder — bei diesen Bloecken bleibt
     ein LEERES Array, und das Backend antwortet darauf mit

         HTTP 400 · „Feld-Katalog fehlt oder ist leer."

     Neun Fragen, von denen jede Antwort in einer Fehlermeldung endet.

     Jetzt werden die Bloecke vor dem Start am Katalog gemessen: was kein
     einziges Feld darin hat, wird nicht gefragt. Bloecke, von denen nur
     ein TEIL im Katalog steht, bleiben — dort kommt wenigstens etwas an,
     und der Rest faellt beim Uebernehmen ohnehin weg.

     Der Objekt-Weg ist davon nicht betroffen: `buildFullCatalog()` kennt
     alle Felder, also aendert der Filter dort nichts. Gegengeprueft. */
  function _rfAufKatalog(bloecke, catalog) {
    var da = {};
    (catalog || []).forEach(function (c) { da[c.id] = 1; });
    var raus = [];
    (bloecke || []).forEach(function (e) {
      var ids = (e.ids || []).filter(function (id) { return da[id]; });
      if (!ids.length) return;
      if (ids.length === (e.ids || []).length) { raus.push(e); return; }
      var kopie = {}; Object.keys(e).forEach(function (k) { kopie[k] = e[k]; });
      kopie.ids = ids;
      raus.push(kopie);
    });
    return raus;
  }

  /* Einstieg: nach der Auswertung (Lücken) oder von Anfang an (geführt). */
  function rueckfragen(OA, data, catalog, alle) {
    var fields = (data && data.fields) || {};
    var luecken = alle
      ? RFRAGEN.filter(function (e) { return _rfFehlt(e, fields); })
      : _rfLuecken(fields);
    /* v1293g: Was der Katalog nicht kennt, wird nicht gefragt. */
    luecken = _rfAufKatalog(luecken, catalog);
    if (!luecken.length) return showResults(OA, data, catalog);   /* nichts offen */
    _rf = { offen: luecken, i: 0, data: data, catalog: catalog, OA: OA, alle: !!alle,
            quelle: {}, halte: {}, abrufGetan: {} };   /* v1288 */
    if (!_rf.data.fields) _rf.data.fields = {};
    _recAus();   /* v1302: Aufnahmefenster UND seine Spalte */
    var nx = $('vi-next'); if (nx) nx.style.display = 'none';
    _rfAufbau();

    var gefunden = Object.keys(_rf.data.fields).length;
    /* v1293: Was schon im Formular steht, wird beim Start gezaehlt — und
       gesagt. Wer gerade ein Exposé eingelesen hat und dann dieselbe
       Begruessung bekommt wie beim leeren Objekt, glaubt, der Import sei
       verpufft. */
    _rf.vorbefuellt = _rfVorbefuellt(catalog);
    _rf.vorlauf = _vorlauf.slice();
    var vorN = Object.keys(_rf.vorbefuellt).length;
    var vorQuelle = _vorlauf.filter(function (q) { return q !== 'voice'; })
                            .map(function (q) { return VORLAUF_NAME[q] || q; }).join(' und ');
    var vorTxt = '';
    if (vorN && vorQuelle) {
      vorTxt = 'Aus <b>' + escH(vorQuelle) + '</b> stehen schon <b>' + vorN + ' Angaben</b> — ' +
               'die frage ich nicht noch einmal. ';
    } else if (vorN) {
      vorTxt = '<b>' + vorN + ' Angaben</b> waren schon da — die frage ich nicht noch einmal. ';
    }

    /* v1288: Der geführte Weg sagt jetzt, WOHIN er führt — nicht nur, wie
       viele Fragen kommen. Eine Zahl allein ist eine Zumutung, ein Ziel
       ist eine Einladung. */
    var etDa = {};
    luecken.forEach(function (e) { if (e.et) etDa[e.et] = 1; });
    var etTxt = ETAPPEN.filter(function (E) { return etDa[E.nr]; })
                       .map(function (E) { return E.name; }).join(' · ');
    _rfBlase('co', alle
      ? vorTxt + 'Ich führe dich durch — <b>' + luecken.length + '</b> ' +
        (luecken.length === 1 ? 'Frage' : 'Fragen') + ' in ' +
        Object.keys(etDa).length + ' Etappen: <b>' + escH(etTxt) + '</b>. ' +
        'Nach der Finanzierung siehst du deinen <b>Deal Score</b>, nach Lage und Zustand den ' +
        '<b>Investor Deal Score 2.0</b>. ' +
        'Sprich einfach los — was du nicht weißt, überspringen wir, und fragen darfst du mich jederzeit.'
      : 'Ich habe <b>' + gefunden + ' Angaben</b> aus deiner Aufnahme gelesen. ' + vorTxt +
        (luecken.length === 1 ? 'Für die Rechnung fehlt mir noch eine.'
                              : 'Für die Rechnung fehlen mir noch ' + luecken.length + '.'));

    _fs.an = true;
    /* Das Kontingent wird MIT dem Mikrofon geladen, nicht danach: das
       Angebot für die Marktpreisindikation braucht die Zahl, und ein
       Angebot, das zu spät kommt, kommt gar nicht. */
    var kg = Promise.resolve(null);
    try {
      if (window.AiCredits && typeof window.AiCredits.refresh === 'function') {
        kg = Promise.resolve(window.AiCredits.refresh()).catch(function () { return null; });
      }
    } catch (e) {}
    Promise.all([_fsStart(), kg]).then(function (r) {
      if (!_rf) return;
      if (!r[0]) {
        var s = $('vi-rf-fs'); if (s) { s.checked = false; s.disabled = true; }
        _fs.an = false;
        _fsMikroKasten(false, 'Mikrofon nicht verfügbar', 'Tippe deine Antworten — oder gib das Mikrofon im Browser frei und öffne neu.');
      }
      /* v1288: Steht die Adresse schon (freier Weg, oder ein Objekt war
         offen), fällt die Entscheidung über die Marktpreisindikation VOR
         der ersten Frage — dann läuft sie über den ganzen Dialog. */
      if (!_rf.marktGefragt && (_rfFeld('plz') || _rfFeld('ort'))) {
        try { _rfMarktAnbieten(); } catch (ex) { try { console.warn('[voice] Marktangebot', ex); } catch (e2) {} }
        _rfBandZeichnen();   /* v1291b: kein Anhalten mehr — das Angebot steht in der Leiste */
      }
      _rfFrage();
    });
  }

  /* Ergebnisse in die ECHTE Import-Tabelle (gleiche Optik, gleicher Schreibweg) */
  function showResults(OA, data, catalog) {
    var fields = (data && data.fields) || {};
    var unsicher = (data && data.unsicher) || [];
    var S = 'Sprachaufzeichnung';
    /* v1288: Was der Co-Pilot SELBST geholt hat, traegt seine eigene
       Herkunft — BORIS mit Stichtag, Marktpreisindikation, Einstellungen.
       Eine abgerufene Zahl als „Sprachaufzeichnung" auszuweisen waere
       falsch: niemand hat sie ausgesprochen. Genau das war der Vorbehalt
       im Backlog zu „abrufen statt fragen". */
    var QUELLEN = (data && data.quellen) || {};
    var _q = function (id) { return QUELLEN[id] || S; };

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
        if (n >= 1 && n <= 5) OA.addRow(id, entry.label, n + ' \u2605' + mark, n, _q(id), 'star');
        return;
      }
      if (entry.kind === 'select') {
        var opt = null;
        for (var i = 0; i < (entry.options || []).length; i++) { if (entry.options[i].v === String(v)) { opt = entry.options[i]; break; } }
        OA.addRow(id, entry.label, (opt ? opt.t : String(v)) + mark, v, _q(id), 'select');
        return;
      }
      /* v1168-VBOOL: Der Server laesst nur JA-Antworten durch, hier kommt
         also nie ein false an. Angezeigt wird trotzdem Klartext — „true" in
         einer Import-Tabelle liest niemand gern. */
      if (entry.kind === 'bool') {
        OA.addRow(id, entry.label, 'Ja' + mark, true, _q(id), 'bool');
        return;
      }
      var raw = v, disp = String(v);
      if (typeof v === 'number' && !Number.isInteger(v)) { raw = String(v).replace('.', ','); disp = raw; }
      OA.addRow(id, entry.label, disp + mark, raw, _q(id), 'input');
    });

    /* Aufnahme-Panel weg, Tabelle rein, Footer umschalten.
       v1302: samt der Spalte 'Was schon steht' - sonst bleibt sie als
       schwarzer Kasten neben der Uebernahme-Tabelle stehen. */
    _recAus();
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
  /* v1259/v1273/v1288 · Pruefhaken, keine Bedienwege. Ohne sie liesse sich
     der Sprechlauf nur mit echtem Sprechen erreichen — und echtes Sprechen
     laesst sich nicht automatisiert nachmessen. `_kennzahlen`, `_score1`
     und `_score2` rechnen aus dem laufenden Gespraech; `_etappen` und
     `_fragen` geben die Struktur heraus, damit die Zuordnung Feld ->
     Etappe pruefbar ist, ohne sie ein zweites Mal aufzuschreiben. */
  window.VoiceImport = { srcLabel: srcLabel, open: open, _orbit: chipOrbit,
                         _rueckfragen: rueckfragen, _luecken: _rfLuecken,
                         _text: updateChipsFromText,   /* v1274: Live-Weg pruefbar */
                         _gefuehrt: _gefuehrt,         /* v1275 */
                         _etappen: ETAPPEN,            /* v1288 */
                         _fragen: RFRAGEN,
                         _kennzahlen: _rfKennzahlen,
                         _score1: _rfScore1, _score2: _rfScore2,
                         _nkAnnahme: _rfNkAnnahme,
                         _hebel: _rfHebel,             /* v1292b */
                         _breakEven: function () { return _rfBreakEven(_rfKennzahlen()); },
                         _mietPotenzial: function () { return _rfMietPotenzial(_rfKennzahlen()); },
                         _score2Karte: _rfScore2Karte,
                         _kontingent: _rfKontingent,
                         _verneinung: _rfIstVerneinung,  /* v1288b */
                         _kontextKlar: _rfKontextKlar,
                         _offenesEnde: _fsOffenesEnde,   /* v1290 */
                         _fsStand: function () { return { phase: _fs.phase, kopf: !!_fs.kopf,
                             chunks: _fs.chunks.length, rest: _fs.rest, laeuft: _fs.laeuft,
                             recState: _fs.rec ? _fs.rec.state : null }; },
                         _stand: function () { return _rf; } };
})();
