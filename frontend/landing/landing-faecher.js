/* ═══════════════════════════════════════════════════════════════════════
   landing-faecher.js · landing-faecher-1 (20.11.2026)
   Variante 5 „Fächer“ aus design/Vorschläge/landing-neu-6 als echter Teil
   der Startseite (Vorlage: gemeinsam.js dort). Übernommen ohne Vorlagen-
   Teile: kein <base>, kein Abfangen von fetch und Video-Quellen, kein
   Hinweisband. Vier Bausteine:

   1 STREIFEN unter dem Hero (#n6st). Marcel 20.11.2026: auf den Bildern
     kein Play-Zeichen und keine Zeit- oder Kapitelmarke mehr, nur die
     Bilder. Ein Klick springt in die Videothek (#live) zum Kapitel und zur
     Sekunde, der Hinweis steht nur noch in title und aria-label. Zuordnung
     Bild → Video → Kapitel → Sekunde wie landing-neu-6/index.html (15
     Einträge mit Etappe 01), Kapitel und Sekunden geprüft gegen
     assets/videothek/videos.json (dieselben Zahlen wie
     messe-schleife/videothek-liste.js).
   2 VIDEOTHEK als Slider (#n6vt in #live). Liste, Vorschaubilder, Datei mit
     oder ohne Sprecher, Dauer und Kapitel kommen aus dp2-live.js
     (window.DpVideoQuelle): derselbe Weg wie die Videothek-Seite,
     basis_medien (medien/videothek/) + datei_ton bzw. datei + Buster.
   3 RISS der Hero-Karte in Investment- und Finanzierungs-Score. Marcel
     20.11.2026: die Risslinie erscheint etwa 1 bis 1,5 s nach dem Laden, danach startet
     alles nach 10 s neu, als Schleife, ohne Knopf. Bei „weniger Bewegung“
     keine Schleife, sondern ruhig der Endzustand (die zwei Scores).
     landing-faecher-2 · Marcel 20.11.2026: der Riss beginnt etwa 2 s später (Risslinie bei rund 3 s), oben
     steht das Gesamturteil als schwarze Leiste wie in der App (dpsh-score-hero.js .dpz-kopf).
     Zahlen 87 / 81 / 97 und Anteile 59,3 / 40,8: DealScore2.compute() am
     Beispielobjekt der Hero-Karte (siehe BEISPIEL unten), Profil Standard.
   4 STARTBAHN „Fächer“ (#einlesen). Marcel 20.11.2026: bei jeder Unterlage
     wächst der Score sichtbar mit, er startet erst, wenn genug Kennzahlen
     da sind. Gerechnet wird NICHTS hier: nach jeder Unterlage rufen wir
     DealKpis.compute() und DealScore2.compute() (dealscore2.js, geladen von
     dealcheck-laden.js mit dem Buster der App) mit den bis dahin gelesenen
     Beispielwerten. Die SCHWELLE ist die der App: der Investor Deal Score
     gilt als belastbar ab 70 % KPI-Vollständigkeit
     (frontend/js/dealscore2-ui.js:336 window._dpDs2Schwelle, V63.1, gezählt
     mit DealScore2.getKpiCompleteness, dealscore2.js:1113). Darunter steht
     „sammelt Kennzahlen“. Die Datei dealscore2-ui.js ist eine reine Ansicht
     der App und wird hier nicht geladen, deshalb steht die 0,70 unten als
     SCHWELLE mit dieser Fundstelle.
     Reihenfolge der Unterlagen so, dass der Kern den Score von der Schwelle
     an steigen lässt (gemessen 20.11.2026 in Node mit den echten Kernen):
       Exposé 2/24 · Darlehensvertrag 9/24 · Marktbericht 16/24 · sammelt
       Energieausweis 18/24 (75 %) → 83 · Grundbuch 18/24 → 83
       WEG-Protokoll 20/24 → 86 · Mieterliste 22/24 → 87 · Objektfotos 24/24 → 87
     Der Endstand ist die Hero-Karte: 87 Sehr gut, Investment 81, Finanzierung 97.

   Dazu der Schalter für die Demo „Einzel-Check“ (einzelcheck-demo.js): sie
   wird NUR auf Staging (staging.dealpilot.immo) oder lokal geladen, auf den
   Produktionsadressen nie, auch nicht mit ?demo=einzelcheck.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var ruhig = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (ruhig) document.documentElement.classList.add('n6-ruhig');

  /* ── Hilfen ───────────────────────────────────────────────────────── */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function warte(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ein3(t) { return 1 - Math.pow(1 - t, 3); }
  function fmt(n) { return Number(n).toLocaleString('de-DE'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mmss(s) { s = Math.max(0, Math.round(s || 0)); return s >= 3600 ? Math.floor(s / 3600) + ':' + ('0' + Math.floor(s % 3600 / 60)).slice(-2) + ':' + ('0' + s % 60).slice(-2) : Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  /* Kundentext: nur Punkt und Komma */
  function sauber(t) { return String(t || '').replace(/\s*[—–]\s*/g, ', ').replace(/;/g, ','); }
  function anim(el, kf, o) {
    if (!el || ruhig || !el.animate) return Promise.resolve();
    o = Object.assign({ duration: 600, easing: 'cubic-bezier(.2,.72,.2,1)', fill: 'both' }, o || {});
    return el.animate(kf, o).finished.catch(function () {});
  }
  function sichtbar(el, fn, schwelle) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(el); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fn(e.target); } });
    }, { threshold: schwelle == null ? .3 : schwelle });
    io.observe(el);
  }
  function zaehle(el, ziel, ms, opt) {
    opt = opt || {};
    var von = opt.von || 0, t0 = null, nach = opt.nach || '';
    if (ruhig || !ms) { el.textContent = fmt(ziel) + nach; return Promise.resolve(); }
    return new Promise(function (ok) {
      function s(t) {
        if (t0 == null) t0 = t;
        var x = Math.min(1, (t - t0) / ms);
        el.textContent = fmt(Math.round(von + (ziel - von) * ein3(x))) + nach;
        if (x < 1) requestAnimationFrame(s); else ok();
      }
      requestAnimationFrame(s);
    });
  }
  function rel(el, bezug) { var a = el.getBoundingClientRect(), b = bezug.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; }

  var GRN = '#3FA56C', GOLD = 'var(--gd)';   /* Status-Grün nie tokenisieren (CLAUDE.md), Gold nur als Token */

  /* ══ Daten ═══════════════════════════════════════════════════════════ */
  var D = {
    /* Kategorien der Karte = die fünf des Investor Deal Score (dealscore2.js), Gewichte Profil Standard.
       [Schlüssel im Kern, Name, Gewicht, Rückfall-Punkte wie dp2.js CATS] */
    kat: [['rendite', 'Rendite', 35, 98], ['finanzierung', 'Finanzierung', 25, 96], ['risiko', 'Risiko', 20, 88],
      ['lage', 'Lage & Markt', 10, 60], ['upside', 'Upside / Potenzial', 10, 53]],
    /* Zwei Scores der Hero-Karte, DealScore2.compute() am BEISPIEL (Gruppen aus _zweiScores) */
    inv: { key: 'inv', titel: 'Investment-Score', score: 81, anteil: '59,3', gruppen: [['Objektrendite', '32,5', 98], ['Risiko & Zustand', '33,8', 88], ['Lage & Markt', '16,9', 60], ['Potenzial & Preis', '16,9', 53]] },
    fin: { key: 'fin', titel: 'Finanzierungs-Score', score: 97, anteil: '40,8', gruppen: [['Kapitaldienst & Beleihung', '61,3', 96], ['Cashflow & EK-Rendite', '38,7', 97]] },

    /* 1 · Streifen: [Bild, Ausschnitt (Größe, x, y) oder null, Etikett, Titel, Video-ID, Kapitel, Sekunde] */
    streifen: [
      ['01-objekt-erfassen.webp', null, 'Etappe 02 · Erfassen', 'Objekt erfassen', 'modul-03-datenaufnahme-vier-wege', 'Anhaken, dann Abrufen', 26],
      ['02-score.webp', null, 'Etappe 03 · Prüfen', 'Rendite und Investor Deal Score', 'modul-12-bewertung-und-kpis', 'Das Gesamturteil', 27],
      ['02-score.webp', [205, 0, 62], 'Auszug · Etappe 03', 'Investment-Score', 'modul-12-bewertung-und-kpis', 'Investment', 69],
      ['02-score.webp', [205, 100, 50], 'Auszug · Etappe 03', 'Finanzierungs-Score', 'modul-12-bewertung-und-kpis', 'Finanzierung', 91],
      ['03-unterlagen.webp', null, 'Etappe 04 · Prüfen', 'Unterlagen lesen', 'modul-28-unterlagen-einlesen', 'Die Auswertung', 189],
      ['04-finanzierung.webp', null, 'Etappe 05 · Rechnen', 'Finanzierung und Cashflow', 'modul-08-finanzierung', 'Der indikative Zins', 32],
      ['04-finanzierung.webp', [190, 100, 10], 'Auszug · Etappe 05', 'Zins je Zinsbindung und Beleihung', 'modul-08-finanzierung', 'Zuschlag nach Beleihung', 54],
      ['05-steuer.webp', null, 'Etappe 06 · Rechnen', 'Steuer, AfA und Restnutzungsdauer', 'modul-27-steuerverlauf-mit-wendepunkt', 'Steuerverlauf', 50],
      ['05-steuer.webp', [200, 0, 14], 'Auszug · Etappe 06', 'Der Zeitpunkt fürs nächste Investment', 'modul-27-steuerverlauf-mit-wendepunkt', 'Der Zeitpunkt fürs nächste Investment', 213],
      ['06-wertermittlung.webp', null, 'Etappe 07 · Bewerten', 'Wertermittlung nach ImmoWertV', 'ueberblick-3-komplettbeispiel-mehrfamilienhaus', 'Kapitel 7 · Marktbericht und Wertermittlung', 1250],
      ['06-wertermittlung.webp', [200, 50, 8], 'Auszug · Etappe 07', 'Ertragswert mit Liegenschaftszins', 'ueberblick-3-komplettbeispiel-mehrfamilienhaus', 'Der Liegenschaftszins', 1419],
      ['06-wertermittlung.webp', [200, 0, 100], 'Auszug · Etappe 07', 'Bodenrichtwert', 'ueberblick-3-komplettbeispiel-mehrfamilienhaus', 'Bodenrichtwert und Modernisierung', 318],
      ['07-zielbild.webp', null, 'Etappe 08 · Planen', 'Mieterhöhung und Zielbild', 'modul-26-mieterhoehung-und-zielbild', 'Tab Bewertung', 649],
      ['08-bestand.webp', null, 'Etappe 09 · Halten', 'Vom Ankauf in den Bestand', 'modul-14-ankauf-in-den-bestand', 'Was sich bewegt hat', 119]
    ],
    /* Etappe 01 der Strecke (HTML-Karte, kein Bild): Urteil gegen das eigene Ziel */
    etappeQc: ['ueberblick-1-quick-boarding', 'Gegen deine Lage', 141],

    /* 4 · Unterlagen, die DealPilot nachweislich ausliest (Fundstelle je Art), mit den Beispielwerten.
       felder: [Bezeichnung, Wert, Ziel in der Karte: 'kp' | Kategorie | null]
       daten:  was der Rechenkern daraus bekommt (BEISPIEL, landing-neu-3/gemeinsam.js Z.10-16) */
    unterlagen: [
      { id: 'expose', art: 'Exposé', titel: 'Ruhige Lage, solide vermietet', unter: 'Eigentumswohnung · Beispieldaten', foto: 'assets/bild/haus-640.webp',
        quelle: 'backend/src/routes/ai.js POST /ai/extract-expose',
        felder: [['Kaufpreis', '180.000 €', 'kp'], ['Wohnfläche', '100 m²', 'lage'], ['Kaltmiete', '1.300 € / Monat', 'rendite'], ['Kaufnebenkosten', '10,5 %', 'rendite'], ['Lage', 'mittel', 'lage']],
        daten: { kp: 180000, nk_pct: 10.5, nkm: 1300, wfl: 100, mikrolage: 'mittel' } },
      { id: 'darlehen', art: 'Darlehensvertrag', titel: 'Darlehensvertrag der Bank', unter: 'PDF der Bank · Beispiel',
        quelle: 'frontend/js/financing-pdf.js (Sollzins, Darlehen, Tilgung, Bindung)',
        felder: [['Darlehenssumme', '168.900 €', 'finanzierung'], ['Sollzins', '3,6 %', 'finanzierung'], ['Tilgung', '2 %', 'finanzierung'], ['Zinsbindung', '10 Jahre', 'finanzierung']],
        daten: { d1: 168900, zins: 3.6, tilg: 2 } },
      { id: 'marktbericht', art: 'Marktbericht', titel: 'Grundstücksmarktbericht', unter: 'des Gutachterausschusses · Beispiel',
        quelle: 'backend/src/services/dokumentSchemas.js (Typ marktbericht)',
        felder: [['Durchschnittsmiete', '12,00 € / m²', 'lage'], ['Mietentwicklung', '+1,5 % im Jahr', 'lage'], ['Vergleichswert', '200.000 €', 'upside'], ['Preisentwicklung', 'steigend', 'upside'], ['Bevölkerung', 'stabil', 'lage'], ['Nachfrage', 'stark', 'lage']],
        daten: { marktmiete: 12, mietwachstumPct: 1.5, marktwert: 200000, wertsteigerung: 'hoch', bevoelkerung: 'stabil', nachfrage: 'stark' } },
      { id: 'energie', art: 'Energieausweis', titel: 'Energieausweis nach GEG', unter: 'Bedarf oder Verbrauch · Beispiel',
        quelle: 'dokumentSchemas.js (Typ energieausweis)',
        felder: [['Effizienzklasse', 'D', 'risiko'], ['Modernisierungsbedarf', 'gering', 'upside']],
        daten: { energieKlasse: 'D', entwicklungsmoeglichkeiten: 'begrenzt' } },
      { id: 'grundbuch', art: 'Grundbuch', titel: 'Grundbuchauszug', unter: 'Personendaten geschwärzt', text: 1,
        quelle: 'dokumentSchemas.js (Typ grundbuch, Text vorher geschwärzt, services/schwaerzen.js)',
        felder: [['Abteilung II, Lasten', '', null], ['Abteilung III, Grundschulden', '', null], ['Miteigentumsanteil', '', null]],
        daten: {} },
      { id: 'weg', art: 'WEG-Protokoll', titel: 'Protokoll der Eigentümerversammlung', unter: 'Beschlüsse und Rücklage · Beispiel',
        quelle: 'dokumentSchemas.js (Typ weg_protokoll)',
        felder: [['Hausgeld nicht umlagefähig', '1.500 € / Jahr', 'rendite'], ['Instandhaltung', '8,5 % der Miete', 'risiko'], ['Erhaltungsrücklage', '', null], ['Sonderumlagen', 'keine', null]],
        daten: { bwk_nul: 1500, instandhaltungPctNkm: 8.5 } },
      { id: 'mieter', art: 'Mieterliste', titel: 'Mietaufstellung', unter: 'jede Einheit, ohne Mieternamen',
        quelle: 'dokumentSchemas.js (Typ mietaufstellung)',
        felder: [['Einheiten', '1', null], ['Kaltmiete', '1.300 € / Monat', 'rendite'], ['Leerstandsquote', '2,5 %', 'risiko'], ['Mietausfallrisiko', 'mittel', 'risiko']],
        daten: { leerstandPct: 2.5, mietausfallRisiko: 'mittel' } },
      { id: 'fotos', art: 'Objektfotos', titel: 'Zustand je Gewerk', unter: 'aus bis zu acht Fotos', fotos: ['assets/bild/haus-640.webp', 'assets/bild/mfh-gerberstrasse-240.webp', 'assets/bild/mfh-gerberstrasse-alt-240.webp', 'assets/bild/hero.jpg'],
        quelle: 'backend/src/routes/ai.js POST /ai/extract-zustand-bilder',
        felder: [['Dach und Fenster', '', null], ['Bäder und Innenausbau', '', null], ['Zustand', 'gut', 'risiko'], ['Ausstattung', '5 von 5', 'risiko']],
        daten: { zustand: 'gut', qualitaetSterne: 5 } }
    ]
  };
  /* Schwelle der App, siehe Kopf (dealscore2-ui.js:336 window._dpDs2Schwelle, Standard 0,70) */
  var SCHWELLE = (typeof window._dpDs2Schwelle === 'function') ? window._dpDs2Schwelle() : 0.70;

  /* ══ Rechnen nur mit den Kernen der App ═════════════════════════════
     Abbildung wie tools/zwei-scores-pruefen.mjs dealFuer() und landing-neu-4 (dort 87/81/97 am
     vollständigen Beispiel). Felder, die noch keine Unterlage geliefert hat, fehlen im deal und
     zählen im Kern nicht (DealScore2 _aggregate: b.applied). */
  function kerneDa() { return !!(window.DealKpis && window.DealScore2 && window.ScoreTier); }
  function dealAus(S) {
    var d = {};
    if (!S.kp) return d;
    var nk = S.kp * S.nk_pct / 100, fin = S.d1 != null, gi = S.kp + nk, ek = fin ? gi - S.d1 : gi;
    var k = DealKpis.compute({ kp: S.kp, nk: nk, nkm: S.nkm, ze: 0, bwk_ul: 0, bwk_nul: S.bwk_nul || 0, d1: fin ? S.d1 : 0, d1z: S.zins || 0, d1t: S.tilg || 0, ek: ek, svw: 0, afa: 0, grenz: 0, ekInklNkLtv: false });
    d.bruttorendite = k.bmy;
    if (S.bwk_nul != null) d.nettorendite = k.nmy;
    if (fin) {
      /* v4760 · EK-Rendite Stufe 2 wie die App (dealscore2-ui.js); ohne Steuerangaben ist steuer 0 */
      var e2 = (window.DpEkRendite && ek > 0) ? DpEkRendite.rechne({ cf_op: k.cf_op, steuer: 0, tilg: k.tilg_j || 0, bspar: 0, ek: ek }) : null;
      d.cashflowMonatlich = k.cf_m; d.cashOnCash = (e2 && e2.k2 != null && isFinite(e2.k2)) ? e2.k2 : k.ekr; d.darlehen = k.d_total; d.dscr = k.dscr; d.ltv = k.ltv;
      d.zinsSatz = S.zins; d.tilgung = S.tilg; d.eigenkapitalQuote = ek / k.gi * 100;
    }
    d.istMieteEurQm = S.nkm / S.wfl; d.eigenerFaktor = S.kp / (S.nkm * 12);
    if (S.marktmiete) d.marktmieteEurQm = S.marktmiete;
    if (S.marktwert) { d.marktFaktor = S.marktwert / (S.nkm * 12); d.marktwert = S.marktwert; }
    ['mikrolage', 'mietwachstumPct', 'bevoelkerung', 'nachfrage', 'wertsteigerung', 'instandhaltungPctNkm', 'leerstandPct',
      'mietausfallRisiko', 'energieKlasse', 'entwicklungsmoeglichkeiten', 'zustand', 'qualitaetSterne'].forEach(function (x) { if (S[x] != null) d[x] = S[x]; });
    return d;
  }
  function rechne(S) {
    var deal = dealAus(S), cfg = DealScore2.getDefaults ? DealScore2.getDefaults() : undefined;
    var r = DealScore2.compute(JSON.parse(JSON.stringify(deal)), cfg);
    var c = DealScore2.getKpiCompleteness ? DealScore2.getKpiCompleteness(JSON.parse(JSON.stringify(deal))) : null;
    var pct = c ? c.percent : Math.round((r.availableKpis || 0) / (r.totalKpis || 24) * 100);
    return { r: r, n: r.availableKpis || 0, von: r.totalKpis || 24, pct: pct, belastbar: pct >= SCHWELLE * 100 };
  }

  /* ══ Score-Karte (Markup wie index.html .idscard) ════════════════════ */
  function qrSvg() {
    var n = 11, cell = 3, svg = '<svg width="33" height="33" viewBox="0 0 33 33" aria-hidden="true">', seed = 7;
    function fp(x, y) { return '<rect x="' + x + '" y="' + y + '" width="21" height="21" fill="#0c0b09"/><rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="15" height="15" fill="#fff"/><rect x="' + (x + 6) + '" y="' + (y + 6) + '" width="9" height="9" fill="#0c0b09"/>'; }
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if ((x < 7 && y < 7) || (x > 3 && y < 7 && x >= n - 7)) continue;
      if (rnd() > 0.55) svg += '<rect x="' + (x * cell) + '" y="' + (y * cell) + '" width="3" height="3" fill="#0c0b09"/>';
    }
    return '<div style="background:#fff;padding:3px">' + svg + fp(0, 0) + fp(12, 0) + '</svg></div>';
  }
  function karteHtml() {
    var bars = D.kat.map(function (c) {
      return '<div class="ids-bar" data-kat="' + c[0] + '"><div class="top"><span class="nm">' + esc(c[1]) + '<span class="wt">' + c[2] + '%</span></span>'
        + '<span class="sc"><span data-sc>–</span><small>/100</small></span></div>'
        + '<span class="track"><i></i></span><div class="kp" data-n>0 KPIs</div></div>';
    }).join('');
    return '<span class="abflug">Cleared for take-off</span><div class="idscard" role="img" aria-label="Investor Deal Score, wird aus den Unterlagen gerechnet">'
      + '<div class="ids-band"><span class="l"><i class="dot"></i>Pre-Flight · Investor Deal Score</span><span class="cleared">Cleared</span></div>'
      + '<div class="ids-head"><span class="ids-title">Investor <b>Deal Score</b></span><span class="ids-allkpi">☰ Alle KPIs</span></div>'
      + '<div class="ids-body"><div class="ids-left"><div class="ids-dial"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="tr" cx="60" cy="60" r="53"></circle>'
      + '<circle class="pg" cx="60" cy="60" r="53" style="stroke-dashoffset:333"></circle></svg><div class="ids-dv"><b data-ring>0</b><small>/&thinsp;100</small><span class="sammelt">sammelt Kennzahlen</span></div></div>'
      + '<div class="ids-badge weg">◆ <span data-wort>Sehr gut</span></div>'
      + '<div class="ids-stats"><div><b data-stat="kp">0&nbsp;€</b><span>Kaufpreis</span></div><div><b data-stat="kpi">0/24</b><span>KPIs</span></div><div><b data-stat="tiefe">0&thinsp;%</b><span>Tiefe</span></div></div>'
      + '</div><div class="ids-right"><div class="ids-h">So setzt sich der Score zusammen</div><div>' + bars + '</div></div></div>'
      + '<div class="ids-tear"><span class="nl"></span><span class="nr"></span></div>'
      + '<div class="ids-foot"><div class="lab">PASSENGER<b>DealPilot Co-Pilot</b></div><div class="lab" style="text-align:center">FLIGHT<b>DP · BOARDING</b></div><div class="ids-qr">' + qrSvg() + '</div></div></div><span class="spur"></span>';
  }
  var VOLL = 333;
  function karte(host) {
    host.classList.add('n6-karte');
    host.innerHTML = karteHtml();
    var el = $('.idscard', host), pg = $('.ids-dial .pg', el), zahl = $('[data-ring]', el);
    var st = { score: 0, n: 0, belastbar: false, kat: {} };
    function bar(k) { return $('.ids-bar[data-kat="' + k + '"]', el); }
    var c = {
      el: el, host: host,
      leer: function () {
        st = { score: 0, n: 0, belastbar: false, kat: {} };
        host.classList.remove('fertig', 'hebt'); host.classList.add('sammelt');
        pg.style.strokeDashoffset = VOLL; pg.style.stroke = GOLD; zahl.textContent = '0';
        D.kat.forEach(function (k) { var b = bar(k[0]); var i = $('.track i', b); i.style.width = '0%'; i.classList.add('daten'); i.style.background = GOLD; $('[data-sc]', b).textContent = '–'; $('[data-sc]', b).parentNode.style.color = ''; $('[data-n]', b).textContent = '0 KPIs'; });
        $('[data-stat="kp"]', el).innerHTML = '<span style="color:#cfc6b2">0&nbsp;€</span>';
        $('[data-stat="kpi"]', el).textContent = '0/24'; $('[data-stat="tiefe"]', el).innerHTML = '0&thinsp;%';
        $('.ids-badge', el).classList.add('weg');
        var cl = $('.cleared', el); cl.textContent = 'Wartet'; cl.classList.add('wartet');
        el.setAttribute('aria-label', 'Investor Deal Score, sammelt Kennzahlen');
      },
      kp: function (text) { var b = $('[data-stat="kp"]', el); b.innerHTML = esc(text).replace(' ', '&nbsp;'); anim(b, [{ transform: 'scale(1.3)', color: 'var(--gdd)' }, { transform: 'none', color: '#16130d' }]); },
      /* Ein Stand des Kerns: Kennzahlen, Kategorien und, ab der Schwelle, der Score */
      stand: function (R, ms) {
        ms = ms || 800;
        var alt = st, p = [];
        D.kat.forEach(function (k) {
          var cat = R.r.categories && R.r.categories[k[0]], b = bar(k[0]), i = $('.track i', b), sc = $('[data-sc]', b);
          var a = cat ? cat.availableKpis : 0, t = cat ? cat.totalKpis : 0, w = cat ? Math.round(cat.score) : 0;
          $('[data-n]', b).textContent = a + '/' + t + ' KPIs';
          var vorher = alt.kat[k[0]] || { breit: 0, w: null };
          var breit, farbe;
          if (R.belastbar) { breit = w; farbe = w >= 70 ? GRN : GOLD; i.classList.remove('daten'); sc.parentNode.style.color = farbe; }
          else { breit = t ? Math.round(a / t * 100) : 0; farbe = GOLD; i.classList.add('daten'); sc.parentNode.style.color = ''; }
          i.style.background = farbe;
          if (R.belastbar) p.push(zaehle(sc, w, ms, { von: vorher.w == null ? 0 : vorher.w })); else sc.textContent = '–';
          if (breit !== vorher.breit) { b.classList.add('trifft'); setTimeout(function () { b.classList.remove('trifft'); }, ms + 200); }
          i.style.width = breit + '%';
          p.push(anim(i, [{ width: vorher.breit + '%' }, { width: breit + '%' }], { duration: ms }));
          st.kat[k[0]] = { breit: breit, w: R.belastbar ? w : null };
        });
        p.push(zaehle($('[data-stat="kpi"]', el), R.n, ms * .6, { nach: '/' + R.von, von: alt.n }));
        $('[data-stat="tiefe"]', el).innerHTML = R.pct + '&thinsp;%';
        st.n = R.n;
        if (R.belastbar) {
          var s = R.r.score, ziel = VOLL * (1 - s / 100), vonOff = alt.belastbar ? VOLL * (1 - alt.score / 100) : VOLL;
          if (!alt.belastbar) { host.classList.remove('sammelt'); zahl.classList.remove('springt'); void zahl.offsetWidth; zahl.classList.add('springt'); }
          pg.style.stroke = ''; pg.style.strokeDashoffset = ziel;
          p.push(anim(pg, [{ strokeDashoffset: vonOff }, { strokeDashoffset: ziel }], { duration: ms + 300 }));
          p.push(zaehle(zahl, s, ms + 200, { von: alt.belastbar ? alt.score : 0 }));
          var wort = window.ScoreTier ? ScoreTier.stufe(s).wort : '';
          $('[data-wort]', el).textContent = wort; $('.ids-badge', el).classList.remove('weg');
          el.setAttribute('aria-label', 'Investor Deal Score ' + s + ' von 100, ' + wort + ', aus ' + R.n + ' von ' + R.von + ' Kennzahlen');
          st.score = s; st.belastbar = true;
        } else {
          /* bis zur Schwelle zeigt der Ring, wie weit die Kennzahlen sind (Gold), keine Zahl */
          var zO = VOLL * (1 - R.pct / 100);
          pg.style.stroke = GOLD; pg.style.strokeDashoffset = zO;
          p.push(anim(pg, [{ strokeDashoffset: VOLL * (1 - (alt.n / R.von)) }, { strokeDashoffset: zO }], { duration: ms }));
          el.setAttribute('aria-label', 'Investor Deal Score, sammelt Kennzahlen, ' + R.n + ' von ' + R.von);
        }
        return Promise.all(p);
      },
      abheben: function () {
        host.classList.add('fertig');
        var cl = $('.cleared', el); cl.textContent = 'Cleared'; cl.classList.remove('wartet');
        if (ruhig) return Promise.resolve();
        host.classList.remove('hebt'); void host.offsetWidth; host.classList.add('hebt');
        return anim(el, [{ transform: 'none' }, { transform: 'translateY(-26px) rotate(-1.6deg)', offset: .45 }, { transform: 'translateY(-14px) rotate(-.6deg)', offset: .75 }, { transform: 'none' }],
          { duration: 2000, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'none' });
      },
      /* Rückfall ohne Kerne: der Endstand der Hero-Karte (dp2.js CATS), keine Zwischenwerte */
      rueckfall: function () {
        host.classList.remove('sammelt'); host.classList.add('fertig');
        pg.style.stroke = ''; pg.style.strokeDashoffset = VOLL * (1 - .87); zahl.textContent = '87';
        D.kat.forEach(function (k) { var b = bar(k[0]), i = $('.track i', b); i.classList.remove('daten'); i.style.width = k[3] + '%'; i.style.background = k[3] >= 70 ? GRN : GOLD; $('[data-sc]', b).textContent = k[3]; $('[data-n]', b).textContent = ''; });
        $('[data-stat="kp"]', el).innerHTML = '180.000&nbsp;€'; $('[data-stat="kpi"]', el).textContent = '24/24'; $('[data-stat="tiefe"]', el).innerHTML = '100&thinsp;%';
        $('[data-wort]', el).textContent = 'Sehr gut'; $('.ids-badge', el).classList.remove('weg');
        var cl = $('.cleared', el); cl.textContent = 'Cleared'; cl.classList.remove('wartet');
      },
      ziel: function (k) { return k === 'kp' ? $('[data-stat="kp"]', el) : k ? $('.track', bar(k)) : $('[data-stat="kpi"]', el); }
    };
    return c;
  }

  /* ══ 1 · Streifen mit Absprung ══════════════════════════════════════ */
  /* landing-tempo-1 (22.11.2026) · der Streifen ist höchstens 267 px breit (--h 150 px), der Ausschnitt mit 205 %
     also 547 px: die Kacheln laden eine 1100 px breite Fassung (assets/dp-strecke/*-1100.webp, rund 380 statt
     690 KB für alle acht). Der Schirm der Strecke in index.html behält die 1600er Originale.
     Ebenso die Fotos der Unterlagen-Karten (Exposé 205 px, Objektfotos 54 px): haus-640.webp statt haus.jpg
     (20 statt 174 KB), mfh-gerberstrasse(-alt)-240.webp statt der 1024er (je 7 statt 80 KB). */
  function streifenHtml(liste) {
    return liste.map(function (x, i) {
      var klein = x[0].replace(/\.webp$/, '-1100.webp');
      var bild = x[1]
        ? '<span class="bild" style="background-image:url(assets/dp-strecke/' + klein + '?v=landing-tempo-1);background-size:' + x[1][0] + '% auto;background-position:' + x[1][1] + '% ' + x[1][2] + '%"></span>'
        : '<span class="bild"><img src="assets/dp-strecke/' + klein + '?v=landing-tempo-1" alt="" loading="lazy" decoding="async" width="1600" height="900"></span>';
      var hinweis = esc(x[3]) + ': Video ab ' + mmss(x[6]) + ', Kapitel ' + esc(x[5]);
      return '<a class="st" href="videothek.html?v=' + x[4] + '&amp;t=' + x[6] + '" data-v="' + x[4] + '" data-t="' + x[6] + '" title="' + hinweis + '" aria-label="' + hinweis + '">'
        + bild + '<figcaption aria-hidden="true">' + esc(x[2]) + '<b>' + esc(x[3]) + '</b></figcaption></a>';
    }).join('');
  }
  function streifen(el, opt) {
    if (!el) return;
    opt = opt || {};
    var liste = D.streifen.slice(), halb = streifenHtml(liste);
    el.classList.add('n6-streifen');
    el.innerHTML = '<div class="zug">' + halb + (ruhig ? '' : halb) + '</div>';
    $$('.st', el).forEach(function (a, i) { if (i >= liste.length) { a.setAttribute('tabindex', '-1'); a.setAttribute('aria-hidden', 'true'); } });
    var zug = $('.zug', el);
    if (ruhig) return;
    var x = 0, t0 = null, sicht = true, tempo = opt.tempo || 26, k = opt.scroll == null ? .35 : opt.scroll, sy0 = scrollY, halt = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { sicht = es[0].isIntersecting; }).observe(el);
    el.addEventListener('mouseenter', function () { halt = true; });
    el.addEventListener('mouseleave', function () { halt = false; });
    el.addEventListener('focusin', function () { halt = true; });
    el.addEventListener('focusout', function () { halt = false; });
    /* Touch: beim Antippen kurz anhalten, damit das Bild unter dem Finger bleibt */
    el.addEventListener('touchstart', function () { halt = true; }, { passive: true });
    el.addEventListener('touchend', function () { setTimeout(function () { halt = false; }, 900); }, { passive: true });
    (function lauf(t) {
      if (t0 == null) t0 = t;
      var dt = Math.min(64, t - t0); t0 = t;
      if (sicht) {
        var w = zug.scrollWidth / 2 || 1;
        x += (halt ? tempo * .12 : tempo) * dt / 1000 + Math.abs(scrollY - sy0) * k; sy0 = scrollY;
        var v = (x % w + w) % w;
        zug.style.transform = 'translate3d(' + (-v).toFixed(1) + 'px,0,0)';
      } else sy0 = scrollY;
      requestAnimationFrame(lauf);
    })(performance.now());
  }

  /* ══ 2 · Videothek als Slider ═══════════════════════════════════════ */
  var vt = (function () {
    var host, Q, J, V = [], cur = -1, filter = 'alle', vid, schirm, kapListe, info, spiel, warteschlange = null, bereit = false, auto = null;
    function liste() { return filter === 'alle' ? V : V.filter(function (v) { return v.kategorie === filter; }); }
    function katName(id) { var k = ((J && J.kategorien) || []).filter(function (x) { return x.id === id; })[0]; return k ? k.name : id; }
    function bild(v) { return Q.bild(v, J); }
    function dauer(v) { return Q.dauer(v) || 0; }
    function kap(v) { return Q.kapitel(v).filter(function (k) { return k.t != null; }); }
    function kapitelBei(v, t) { var k = null; kap(v).forEach(function (x) { if (x.t <= t) k = x; }); return k; }
    function etikett(v) { return (v.nr === 'Spot' ? 'Spot' : 'Video ' + v.nr) + ' · ' + sauber(katName(v.kategorie)); }
    function baueSlider() {
      var L = liste(), box = $('.n6-vt-slider', host);
      var it = L.map(function (v, i) {
        return '<button class="it" type="button" data-id="' + esc(v.id) + '" data-i="' + i + '"><span class="b"><img src="' + esc(bild(v)) + '" alt="" loading="lazy" width="480" height="270"><span class="d">' + mmss(dauer(v)) + '</span></span>'
          + '<span class="t"><small>' + esc(etikett(v)).toUpperCase() + '</small><b>' + esc(sauber(v.titel)) + '</b></span></button>';
      }).join('');
      box.innerHTML = '<div class="n6-flow" tabindex="0" aria-roledescription="Karussell" aria-label="Videos der Videothek">' + it + '</div>'
        + '<div class="n6-steuer"><button type="button" data-zur aria-label="Vorheriges Video">←</button><span data-pos></span><button type="button" data-vor aria-label="Nächstes Video">→</button></div>';
      $('[data-zur]', box).onclick = function () { stopp(); waehle(pos() - 1); };
      $('[data-vor]', box).onclick = function () { stopp(); waehle(pos() + 1); };
      $$('.it', box).forEach(function (b) {
        b.addEventListener('click', function () { stopp(); var L2 = liste(), i = +b.dataset.i; if (L2[i] && L2[i].id === aktuellId()) starte(0); else waehle(i, true); });
      });
      var fl = $('.n6-flow', box), x0 = null;
      fl.addEventListener('pointerdown', function (e) { x0 = e.clientX; });
      fl.addEventListener('pointerup', function (e) { if (x0 == null) return; var d = e.clientX - x0; x0 = null; if (Math.abs(d) > 40) { stopp(); waehle(pos() + (d < 0 ? 1 : -1)); } });
      fl.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { stopp(); waehle(pos() + 1); } if (e.key === 'ArrowLeft') { stopp(); waehle(pos() - 1); } });
    }
    function aktuellId() { return cur >= 0 && V[cur] ? V[cur].id : null; }
    function pos() { var L = liste(), id = aktuellId(); for (var i = 0; i < L.length; i++) if (L[i].id === id) return i; return 0; }
    function zeigeSlider(i) {
      var L = liste(), n = L.length, box = $('.n6-vt-slider', host), its = $$('.it', box);
      its.forEach(function (it, j) {
        var o = j - i; if (o > n / 2) o -= n; if (o < -n / 2) o += n;
        it.classList.toggle('mitte', o === 0);
        var a = Math.abs(o), sg = Math.sign(o), abst = innerWidth < 700 ? 120 : 250;
        it.style.transform = o === 0 ? 'translateZ(50px)' : 'translateX(' + (sg * (abst + (a - 1) * abst * .55)) + 'px) translateZ(' + (-120 - a * 90) + 'px) rotateY(' + (-sg * 48) + 'deg)';
        it.style.zIndex = 50 - a; it.style.opacity = a > 3 ? 0 : 1; it.style.filter = o ? 'saturate(.55) brightness(' + (.9 - a * .08) + ')' : 'none';
        it.style.visibility = a > 3 ? 'hidden' : '';
        it.tabIndex = o === 0 ? 0 : -1;
      });
      var p = $('[data-pos]', box); if (p) p.textContent = (i + 1) + ' / ' + n;
    }
    function waehle(i, mitStart) {
      var L = liste(); if (!L.length) return;
      i = (i + L.length) % L.length;
      var v = L[i]; cur = V.indexOf(v);
      zeigeSlider(i); fuelle(v, 0);
      if (mitStart) starte(0);
    }
    function halteVideo() { if (vid) { try { vid.pause(); } catch (e) {} vid.removeAttribute('src'); try { vid.load(); } catch (e) {} vid.style.display = 'none'; } spiel.classList.remove('spielt'); }
    function fuelle(v, t) {
      halteVideo();
      $('img', schirm).src = bild(v);
      info.querySelector('small').textContent = etikett(v) + ' · ' + mmss(dauer(v));
      info.querySelector('h3').textContent = sauber(v.titel);
      kapListe.innerHTML = kap(v).map(function (k) { return '<li data-t="' + k.t + '"><button type="button"><span>' + mmss(k.t) + '</span>' + esc(sauber(k.titel)) + '</button></li>'; }).join('');
      $$('li', kapListe).forEach(function (li) { $('button', li).onclick = function () { stopp(); starte(+li.dataset.t); }; });
      $('.n6-vt-bahn', host).innerHTML = '<span class="lauf"></span>' + kap(v).map(function (k) { return '<span class="mk" style="left:' + (k.t / (dauer(v) || 1) * 100).toFixed(2) + '%"></span>'; }).join('') + '<span class="kopf"></span>';
      setzeKopf(v, t || 0, false);
      $('.absprung', info).innerHTML = '';
    }
    function setzeKopf(v, t, weich) {
      var p = clamp(t / (dauer(v) || 1), 0, 1) * 100, k = kapitelBei(v, t);
      var lauf = $('.n6-vt-bahn .lauf', host), kopf = $('.n6-vt-bahn .kopf', host);
      if (weich && !ruhig) { anim(lauf, [{ width: lauf.style.width || '0%' }, { width: p + '%' }], { duration: 900, fill: 'none' }); anim(kopf, [{ left: kopf.style.left || '0%' }, { left: p + '%' }], { duration: 900, fill: 'none' }); }
      lauf.style.width = p + '%'; kopf.style.left = p + '%';
      $('.n6-vt-zeit', host).innerHTML = '<span>' + mmss(t) + '</span><span>' + mmss(dauer(v)) + '</span>';
      $('.kap', schirm).innerHTML = (k ? 'Kapitel · ' + mmss(k.t) : 'Anfang') + '<b>' + esc(sauber(k ? k.titel : v.titel)) + '</b>';
      $$('li', kapListe).forEach(function (li) { li.classList.toggle('an', !!k && +li.dataset.t === k.t); });
      /* landing-handy-1 · Marcel 22.11.2026 (IMG_2055): timeupdate rief das hier mehrmals je Sekunde und setzte die
         Liste jedes Mal zurueck, man konnte waehrend des Videos nicht hochscrollen. Nur noch beim Kapitelwechsel. */
      var an = $('li.an', kapListe), anT = an ? an.dataset.t : null;
      if (an && anT !== kapListe.dataset.zuletzt) { kapListe.dataset.zuletzt = anT; kapListe.scrollTop = an.offsetTop - kapListe.offsetTop - 40; }
    }
    /* Start an Sekunde t: dieselbe Datei wie die Videothek-Seite (dp2-live.js datei(): mit oder ohne Sprecher) */
    function starte(t) {
      var v = V[cur]; if (!v) return;
      setzeKopf(v, t, true);
      var k = kapitelBei(v, t);
      $('.absprung', info).innerHTML = 'Start bei <b>' + mmss(t) + '</b>' + (k ? ', ' + (/^Kapitel/.test(k.titel) ? '' : 'Kapitel ') + '<b>' + esc(sauber(k.titel)) + '</b>' : '');
      vid.style.display = 'block'; vid.poster = bild(v);
      /* landing-handy-1 · am Handy steht der Schirm ueber Kapiteln und Slider: nach oben holen, wenn er nicht ganz zu sehen ist */
      var rs = schirm.getBoundingClientRect(); if (rs.top < 70 || rs.bottom > innerHeight) schirm.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
      /* landing-faecher-1b · gemessen auf Staging 20.11.2026: mit preload="none" laedt ein gesetztes src NICHTS,
         loadedmetadata kam nie, das Video blieb bei readyState 0 stehen. Darum: Sekunde als Medienfragment
         (#t=) in die Adresse, play() sofort (noch in der Klick-Geste), currentTime nach loadedmetadata als
         Absicherung. */
      vid.preload = 'auto';
      vid.src = (J.basis_medien || 'medien/videothek/') + Q.datei(v) + '#t=' + Math.max(0, +t || 0);
      spiel.classList.add('spielt');
      vid.addEventListener('loadedmetadata', function f() { vid.removeEventListener('loadedmetadata', f); try { if (Math.abs(vid.currentTime - t) > 1) vid.currentTime = t; } catch (e) {} });
      var p = vid.play(); if (p && p.catch) p.catch(function () { spiel.classList.remove('spielt'); });
    }
    function oeffne(id, t) {
      if (!bereit) { warteschlange = [id, t]; if (host) host.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' }); return true; }
      stopp();
      var L = liste(), i = -1, j;
      for (j = 0; j < L.length; j++) if (L[j].id === id) i = j;
      if (i < 0) { filter = 'alle'; markiereReiter(); baueSlider(); L = liste(); for (j = 0; j < L.length; j++) if (L[j].id === id) i = j; }
      if (i < 0) return false;
      host.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'start' });
      waehle(i, false);
      setTimeout(function () { starte(+t || 0); }, ruhig ? 0 : 650);
      return true;
    }
    function markiereReiter() { $$('.n6-vt-reiter button', host).forEach(function (b) { var an = b.dataset.k === filter; b.classList.toggle('an', an); b.setAttribute('aria-selected', an ? 'true' : 'false'); }); }
    function stopp() { if (auto) { clearInterval(auto); auto = null; } }
    function baue(el) {
      host = el; Q = window.DpVideoQuelle;
      if (!el || !Q) { if (el) { var s = el.closest('section'); if (s) s.hidden = true; } return; }
      el.classList.add('n6-vt');
      el.innerHTML = '<div class="n6-vt-kopf"><div><div class="eye">Videothek · Kapitel für Kapitel</div><h2>Sieh zu, bevor du <span class="ac">einsteigst.</span></h2></div><div class="n6-vt-reiter" role="tablist" aria-label="Reihen der Videothek"></div></div>'
        + '<div class="n6-vt-spiel"><div class="n6-vt-schirm"><img alt="" width="1280" height="720"><video playsinline controls preload="none" style="display:none"></video>'
        + '<button class="n6-vt-start" type="button" aria-label="Video starten"></button>'
        + '<div class="ueber"><div class="kap"></div><div class="n6-vt-bahn" role="slider" aria-label="Stelle im Video" aria-valuemin="0" aria-valuemax="100"></div><div class="n6-vt-zeit"></div></div></div>'
        + '<div class="n6-vt-info"><div class="innen"><small></small><h3></h3><p class="absprung" aria-live="polite"></p><ol class="n6-vt-kapitel"></ol></div></div></div>'
        + '<div class="n6-vt-slider"></div>'
        + '<p class="n6-vt-alle"><a class="btn-l" href="videothek.html">Zur ganzen Videothek · <span data-umfang="videos">40</span> Videos, <span data-umfang="video_stunden">3,7</span> Stunden</a></p>';
      schirm = $('.n6-vt-schirm', el); vid = $('video', schirm); info = $('.n6-vt-info', el); kapListe = $('.n6-vt-kapitel', el); spiel = $('.n6-vt-spiel', el);
      /* Fehlt die Datei, antwortet der Server mit index.html und 200: es zählt das error-Ereignis (wie dp2-live.js) */
      vid.addEventListener('error', function () {
        var v = V[cur]; if (!v || !vid.getAttribute('src')) return;
        halteVideo();
        $('.absprung', info).innerHTML = 'Das Video lädt hier gerade nicht. <a href="videothek.html?v=' + encodeURIComponent(v.id) + '">In der Videothek öffnen</a>';
      });
      vid.addEventListener('timeupdate', function () { var v = V[cur]; if (v && !vid.paused) setzeKopf(v, vid.currentTime || 0, false); });
      $('.n6-vt-start', el).onclick = function () { stopp(); var k = $('li.an', kapListe); starte(k ? +k.dataset.t : 0); };
      $('.n6-vt-bahn', el).addEventListener('click', function (e) { var v = V[cur]; if (!v) return; stopp(); var r = this.getBoundingClientRect(); starte(Math.round((e.clientX - r.left) / r.width * dauer(v))); });
      return Q.laden().then(function (j) {
        J = j || {};
        /* wie dp2-live.js: Platzhalter („geplant“ oder ohne Datei) stehen nicht im Slider */
        V = (J.videos || []).filter(function (v) { return !v.geplant && v.datei && v.poster && dauer(v); });
        if (!V.length) throw new Error('leer');
        var kat = []; V.forEach(function (v) { if (kat.indexOf(v.kategorie) < 0) kat.push(v.kategorie); });
        $('.n6-vt-reiter', el).innerHTML = '<button type="button" role="tab" data-k="alle" class="an" aria-selected="true">Alle<small>' + V.length + '</small></button>' + kat.map(function (k) {
          return '<button type="button" role="tab" aria-selected="false" data-k="' + esc(k) + '">' + esc(sauber(katName(k))) + '<small>' + V.filter(function (v) { return v.kategorie === k; }).length + '</small></button>';
        }).join('');
        $$('.n6-vt-reiter button', el).forEach(function (b) { b.onclick = function () { stopp(); filter = b.dataset.k; markiereReiter(); baueSlider(); waehle(0); }; });
        baueSlider(); waehle(0);
        addEventListener('resize', function () { zeigeSlider(pos()); });
        bereit = true;
        if (warteschlange) { var w = warteschlange; warteschlange = null; oeffne(w[0], w[1]); }
        else if (!ruhig) sichtbar($('.n6-vt-slider', el), function () { auto = setInterval(function () { if (!spiel.classList.contains('spielt')) waehle(pos() + 1); }, 4200); }, .5);
      }).catch(function () {
        /* Ohne Liste kein Abschnitt, lieber nichts als ein leerer Rahmen (wie dp2-live.js) */
        var s = el.closest('section'); if (s) s.hidden = true;
      });
    }
    return { baue: baue, oeffne: oeffne };
  })();

  /* Jeder Verweis in die Videothek auf dieser Seite landet im Slider (#live) */
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href*="videothek.html?v="]');
    if (!a || !$('.n6-vt')) return;
    var u = new URL(a.getAttribute('href'), location.href), id = u.searchParams.get('v'), t = +u.searchParams.get('t') || 0;
    /* Etappen-Verweise der Strecke ohne Sekunde: die Stelle aus der Streifen-Zuordnung derselben Ansicht */
    var li = a.closest('.pt-s'), ersatz = null;
    if (li && !u.searchParams.get('t')) {
      var b = li.getAttribute('data-bild');
      if (b === 'qc') ersatz = [D.etappeQc[0], D.etappeQc[2]];
      else { var nr = ('0' + b).slice(-2), m = D.streifen.filter(function (x) { return !x[1] && x[0].indexOf(nr + '-') === 0; })[0]; if (m) ersatz = [m[4], m[6]]; }
      if (ersatz && ersatz[0] === id) { t = ersatz[1]; ersatz = null; }
    }
    /* Steht das verlinkte Video noch nicht in der Liste (z. B. „geplant“), die Stelle derselben Ansicht aus dem Streifen */
    if (vt.oeffne(id, t) === false && !(ersatz && vt.oeffne(ersatz[0], ersatz[1]) !== false)) return;
    e.preventDefault();
  });

  /* ══ 3 · Riss und Aufklappen der Hero-Karte, als Schleife ═══════════ */
  var RU = 276.5;
  function zKarte(t) {
    var grp = t.gruppen.map(function (g) {
      var f = g[2] >= 70 ? GRN : GOLD;
      return '<div class="zs-kz"><span class="zs-t">' + esc(g[0]) + ' <span class="zs-anteil">' + g[1] + '&nbsp;%</span></span>'
        + '<span class="zs-p"><b data-zahl="' + g[2] + '">' + g[2] + '</b> / 100</span><span class="zs-bar"><i data-n6breit="' + g[2] + '" style="background:' + f + ';width:' + g[2] + '%"></i></span></div>';
    }).join('');
    return '<div class="zs-karte" data-karte="' + t.key + '"><div class="zs-band"></div><div class="zs-pad">'
      + '<div class="zs-score"><div class="zs-ring"><svg viewBox="0 0 104 104" aria-hidden="true"><circle class="tr" cx="52" cy="52" r="44"/>'
      + '<circle class="pg" cx="52" cy="52" r="44" data-ring="' + t.score + '" style="stroke:' + GRN + ';stroke-dashoffset:' + (RU * (1 - t.score / 100)).toFixed(1) + '"/></svg>'
      + '<div class="zs-n" data-zahl="' + t.score + '">' + t.score + '</div></div>'
      + '<div><h3 class="zs-h3">' + t.titel + '</h3><span class="zs-pill g">' + (t.score >= 85 ? 'SEHR GUT' : 'GUT') + '</span></div></div>'
      + '<div class="zs-kat">' + grp + '</div><div class="zs-summe">Zählt ' + t.anteil + '&nbsp;% zum Gesamtscore 87.</div></div></div>';
  }
  function zweiHtml() {
    /* landing-faecher-2 · Marcel 20.11.2026: „oben das Gesamturteil, genau so wie in der App, dort ist er schwarz“.
       Aufbau, Klassen-Rollen, Farben, Schrift, Pille und Satz wie die Gesamturteil-Leiste der App
       (frontend/js/dpsh-score-hero.js zweiAnsichtHtml() Z. 422 ff., CSS dort Z. 695-713: .dpz-kopf #050505,
       .dpz-lbl, .dpz-wort + .dpz-wert, .dpz-empf-ja Runway, .dpz-warum). Empfehlung „Kaufen“ und Schwellen 70/50
       aus DealScore2 (dealscore2.js Z. 840 ZWEI_SCHWELLE, Z. 930 ff.). Die Knöpfe „Alle KPIs“/„Ansicht“ und
       „Wie wird gerechnet?“ der App fehlen hier bewusst: sie öffnen App-Fenster, die es auf der Landing nicht gibt. */
    return '<div class="zs" role="img" aria-label="Gesamturteil Investor Deal Score: Sehr gut, 87 von 100. Empfehlung Kaufen. Investment-Score 81, Finanzierungs-Score 97."><div class="zs-kopf">'
      + '<div class="zs-kopf-l"><div class="zs-lbl">Gesamturteil · Investor Deal Score</div><div class="zs-wort">Sehr gut <span class="zs-wert"><span data-zahl="87">87</span> / 100</span></div></div>'
      + '<span class="zs-empf zs-empf-ja" data-t>Kaufen</span>'
      + '<div class="zs-warum" data-t>Gesamt aus Investment <b>81</b> (59,3&nbsp;%) und Finanzierung <b>97</b> (40,8&nbsp;%). Empfehlung nach Schwellen: Investment ab 70, Finanzierung ab 50. Beide Schwellen erreicht.</div></div>'
      + '<div class="zs-zwei">' + zKarte(D.inv) + zKarte(D.fin) + '</div></div>';
  }
  function zielNull(root) {
    $$('[data-zahl]', root).forEach(function (e) { e.textContent = '0'; });
    $$('[data-n6breit]', root).forEach(function (e) { e.style.width = '0%'; });
    $$('[data-ring]', root).forEach(function (e) { e.style.strokeDashoffset = RU; });
  }
  function zielFertig(root) {
    $$('[data-zahl]', root).forEach(function (e) { e.textContent = e.dataset.zahl; });
    $$('[data-n6breit]', root).forEach(function (e) { e.style.width = e.dataset.n6breit + '%'; });
    $$('[data-ring]', root).forEach(function (e) { e.style.strokeDashoffset = (RU * (1 - e.dataset.ring / 100)).toFixed(1); });
  }
  function fuelleZwei(root, ms) {
    var p = [];
    $$('[data-ring]', root).forEach(function (r) { var z = (RU * (1 - r.dataset.ring / 100)).toFixed(1); r.style.strokeDashoffset = z; p.push(anim(r, [{ strokeDashoffset: RU }, { strokeDashoffset: z }], { duration: ms + 300 })); });
    $$('[data-zahl]', root).forEach(function (z) { p.push(zaehle(z, +z.dataset.zahl, ms + 200)); });
    $$('[data-n6breit]', root).forEach(function (b, i) { b.style.width = b.dataset.n6breit + '%'; p.push(anim(b, [{ width: '0%' }, { width: b.dataset.n6breit + '%' }], { duration: ms, delay: i * 110 })); });
    return Promise.all(p);
  }
  function zickzack(n, mitte, aus, seed) {
    var s = seed || 3, pts = [[mitte, 0]];
    function rnd() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = 1; i < n; i++) pts.push([mitte + (rnd() - .5) * 2 * aus, i / n]);
    pts.push([mitte + (rnd() - .5) * aus, 1]);
    return pts;
  }
  function spalte(card, bezug, punkte) {
    var r = rel(card, bezug);
    var P = punkte.map(function (p) { return (p[0] * 100).toFixed(2) + '% ' + (p[1] * 100).toFixed(2) + '%'; }).join(',');
    function klon(clip) {
      var h = document.createElement('div'); h.className = 'haelfte';
      h.style.cssText = 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px;clip-path:' + clip;
      var k = card.cloneNode(true); k.style.width = r.w + 'px'; k.style.height = r.h + 'px'; k.style.margin = '0'; k.style.visibility = ''; k.removeAttribute('role');
      [k].concat($$('[id]', k)).forEach(function (x) { x.removeAttribute('id'); });
      h.appendChild(k); h.setAttribute('aria-hidden', 'true'); bezug.appendChild(h); return h;
    }
    var Lh = klon('polygon(0 0,' + P + ',0 100%)'), Rh = klon('polygon(100% 0,' + P + ',100% 100%)');
    var ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'riss-svg'); svg.setAttribute('width', r.w); svg.setAttribute('height', r.h); svg.setAttribute('aria-hidden', 'true');
    svg.style.left = r.x + 'px'; svg.style.top = r.y + 'px';
    var d = punkte.map(function (p, i) { return (i ? 'L' : 'M') + (p[0] * r.w).toFixed(1) + ' ' + (p[1] * r.h).toFixed(1); }).join(' ');
    /* Farben per style (var() wirkt nicht in SVG-Präsentationsattributen) */
    svg.innerHTML = '<defs><filter id="n6glut" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
      + '<path d="' + d + '" fill="none" style="stroke:var(--gdh)" stroke-width="8" opacity=".7" filter="url(#n6glut)"/><path d="' + d + '" fill="none" style="stroke:var(--gdd)" stroke-width="2.2"/>';
    bezug.appendChild(svg);
    var pfade = $$('path', svg), len = pfade[1].getTotalLength();
    pfade.forEach(function (p) { p.style.strokeDasharray = len; p.style.strokeDashoffset = len; });
    return { L: Lh, R: Rh, svg: svg, pfade: pfade, len: len, rect: r };
  }
  function welle(b, x, y, d) {
    var r = document.createElement('i'); r.className = 'welle';
    r.style.cssText = 'left:' + (x - d / 2) + 'px;top:' + (y - d / 2) + 'px;width:' + d + 'px;height:' + d + 'px';
    b.appendChild(r);
    return anim(r, [{ transform: 'scale(.05)', opacity: 1, borderWidth: '10px' }, { transform: 'scale(1)', opacity: 0, borderWidth: '1px' }], { duration: 900, easing: 'cubic-bezier(.1,.7,.3,1)' }).then(function () { r.remove(); });
  }
  function funken(b, x, y, n, weite) {
    for (var i = 0; i < n; i++) {
      var f = document.createElement('i'); f.className = 'funke'; f.style.left = x + 'px'; f.style.top = y + 'px'; b.appendChild(f);
      var w = Math.random() * Math.PI * 2, rr = (weite || 140) * (.35 + Math.random() * .8);
      anim(f, [{ transform: 'translate(-50%,-50%) scale(1.2)', opacity: 1 }, { transform: 'translate(calc(-50% + ' + (Math.cos(w) * rr).toFixed(0) + 'px),calc(-50% + ' + (Math.sin(w) * rr + 30).toFixed(0) + 'px)) scale(0)', opacity: 0 }],
        { duration: 600 + Math.random() * 600, easing: 'cubic-bezier(.1,.7,.3,1)' }).then((function (el) { return function () { el.remove(); }; })(f));
    }
  }
  /* opt.erst: ms nach dem Laden bis zum Anwackeln (danach 0,8 s Wackeln, dann die Risslinie: seit landing-faecher-2 bei etwa 3 s),
     opt.verzug: ms nach jedem Neustart (die Karte steigt wieder ein, dp2-hero.css rise), opt.halten: ms offen bis zum Neustart */
  function heroRiss(opt) {
    opt = opt || {};
    var card = $('.hero .idscard'); if (!card) return;
    var hk = document.createElement('div'); hk.className = 'n6-hk';
    card.parentNode.insertBefore(hk, card); hk.appendChild(card);
    hk.insertAdjacentHTML('beforeend', '<div class="n6-hk-zwei" style="display:none">' + zweiHtml() + '</div>');
    var zw = $('.n6-hk-zwei', hk), zs = $('.zs', zw), lauf = 0, imBlick = true, wartend = null;
    /* Feste Höhe aus beiden Zuständen: die Schleife soll den Inhalt darunter nicht alle 10 s verschieben */
    function hoehe() {
      hk.style.minHeight = '';
      /* Nur zweispaltig (dp2-hero.css bricht unter 1180 px auf eine Spalte): am Handy wären die zwei Scores
         doppelt so hoch wie die Karte und ließen unter ihr eine leere Fläche. Dort wächst der Hero beim Aufklappen,
         die Schleife läuft nur, solange die Karte im Blick ist, und die Scroll-Verankerung hält die Stelle. */
      if (innerWidth < 1180) return;
      var h1 = card.style.display === 'none' ? 0 : card.offsetHeight;
      var alt = zw.style.cssText; zw.style.cssText = 'display:block;visibility:hidden;position:absolute;left:0;right:0;top:0';
      var h2 = zw.offsetHeight; zw.style.cssText = alt;
      hk.style.minHeight = Math.max(h1, h2) + 'px';
    }
    function zurueck() {
      lauf++; $$('.haelfte,.riss-svg,.lichtspalt,.welle,.funke', hk).forEach(function (x) { x.remove(); });
      zw.style.display = 'none'; card.style.display = ''; card.style.visibility = '';
    }
    if (ruhig) {
      /* ruhiger Endzustand: gleich die zwei Scores, keine Schleife */
      card.style.display = 'none'; zw.style.display = ''; zielFertig(zs);
      return;
    }
    function reiss() {
      var nr = ++lauf; function lebt() { return nr === lauf; }
      return anim(card, [{ transform: 'none' }, { transform: 'translateY(-8px) rotate(-.6deg)' }, { transform: 'translateY(-4px) rotate(.4deg)' }, { transform: 'none' }], { duration: 800, easing: 'ease-in-out', fill: 'none' }).then(function () {
        if (!lebt()) return;
        var sp = spalte(card, hk, zickzack(10, .5, .04, 11)), r = sp.rect; card.style.visibility = 'hidden';
        var zit = [sp.L, sp.R].map(function (h) { return anim(h, [{ transform: 'none' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(2px,-1px)' }, { transform: 'none' }], { duration: 240, delay: 480, easing: 'linear', fill: 'none' }); });
        return Promise.all(sp.pfade.map(function (p) { return anim(p, [{ strokeDashoffset: sp.len }, { strokeDashoffset: 0 }], { duration: 720, easing: 'cubic-bezier(.6,0,.3,1)' }); }).concat(zit)).then(function () {
          if (!lebt()) return;
          var mx = r.x + r.w / 2;
          welle(hk, mx, r.y + r.h / 2, Math.max(r.w, r.h) * 1.2); funken(hk, mx, r.y + r.h * .45, 22, 160);
          var spalt = document.createElement('div'); spalt.className = 'lichtspalt';
          spalt.style.cssText = 'left:' + (mx - 40) + 'px;top:' + (r.y - 20) + 'px;width:80px;height:' + (r.h + 40) + 'px'; hk.appendChild(spalt);
          var auf = Math.min(60, r.w * .08);
          return Promise.all([
            anim(spalt, [{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'scaleX(1.5)' }], { duration: 650 }),
            anim(sp.svg, [{ opacity: 1 }, { opacity: 0 }], { duration: 420 }),
            anim(sp.L, [{ transform: 'none' }, { transform: 'translateX(' + (-auf) + 'px) rotate(-2.5deg)' }], { duration: 760, easing: 'cubic-bezier(.3,1.4,.5,1)' }),
            anim(sp.R, [{ transform: 'none' }, { transform: 'translateX(' + auf + 'px) rotate(2.5deg)' }], { duration: 760, easing: 'cubic-bezier(.3,1.4,.5,1)' })
          ]).then(function () { return warte(500); }).then(function () {
            if (!lebt()) return;
            card.style.display = 'none'; zw.style.display = ''; zielNull(zs);
            var kopf = $('.zs-kopf', zs), ki = $('[data-karte="inv"]', zs), kf = $('[data-karte="fin"]', zs), teile = $$('[data-t]', zs);
            kopf.style.opacity = 0; teile.forEach(function (t) { t.style.opacity = 0; });
            var Ti = rel(ki, hk), Tf = rel(kf, hk);
            var Hi = { x: r.x - auf, y: r.y, w: r.w / 2, h: r.h }, Hf = { x: r.x + r.w / 2 + auf, y: r.y, w: r.w / 2, h: r.h };
            function von(H, T, rot) { return 'translate(' + (H.x - T.x).toFixed(1) + 'px,' + (H.y - T.y).toFixed(1) + 'px) scale(' + (H.w / T.w).toFixed(3) + ',' + (H.h / T.h).toFixed(3) + ') rotate(' + rot + 'deg)'; }
            [ki, kf].forEach(function (x) { x.style.transformOrigin = '0 0'; });
            sp.L.style.transformOrigin = '0 0'; sp.R.style.transformOrigin = '100% 0';
            var feder = 'cubic-bezier(.3,1.32,.45,1)';
            return Promise.all([
              anim(ki, [{ transform: von(Hi, Ti, -2.5) }, { transform: 'none' }], { duration: 1000, easing: feder, fill: 'none' }),
              anim($('.zs-pad', ki), [{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 450, delay: 520, fill: 'backwards' }),
              anim(kf, [{ transform: von(Hf, Tf, 2.5) }, { transform: 'none' }], { duration: 1000, easing: feder, fill: 'none' }),
              anim($('.zs-pad', kf), [{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 450, delay: 520, fill: 'backwards' }),
              anim(sp.L, [{ transform: 'translateX(' + (-auf) + 'px) rotate(-2.5deg)', opacity: 1 }, { transform: 'translate(' + (Ti.x - r.x) + 'px,' + (Ti.y - r.y) + 'px) scale(' + (Ti.w / (r.w / 2)).toFixed(3) + ',' + (Ti.h / r.h).toFixed(3) + ')', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.5,0,.3,1)' }),
              anim(sp.R, [{ transform: 'translateX(' + auf + 'px) rotate(2.5deg)', opacity: 1 }, { transform: 'translate(' + (Tf.x + Tf.w - r.x - r.w) + 'px,' + (Tf.y - r.y) + 'px) scale(' + (Tf.w / (r.w / 2)).toFixed(3) + ',' + (Tf.h / r.h).toFixed(3) + ')', opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.5,0,.3,1)' }),
              anim(spalt, [{ opacity: 1 }, { opacity: 0 }], { duration: 700 }),
              warte(320).then(function () { return fuelleZwei($('.zs-zwei', zs), 1300); })
            ]).then(function () {
              sp.L.remove(); sp.R.remove(); sp.svg.remove(); spalt.remove();
              if (!lebt()) return;
              kopf.style.opacity = '';
              return Promise.all([
                anim(kopf, [{ opacity: 0, transform: 'translateY(26px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 750, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'none' }),
                zaehle($('.zs-wert [data-zahl]', kopf), 87, 1100),
                Promise.all(teile.map(function (t, i) { return anim(t, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 420 + i * 180, fill: 'backwards' }).then(function () { t.style.opacity = ''; }); }))
              ]);
            });
          });
        });
      });
    }
    /* Schleife: Riss nach opt.verzug, offen halten opt.halten, zurück zur Karte, wieder von vorn.
       Außerhalb des Blicks wartet sie und läuft weiter, sobald der Hero wieder zu sehen ist. */
    function naechster(ms, fn) {
      clearTimeout(wartend);
      wartend = setTimeout(function () {
        if (imBlick && !document.hidden) fn(); else naechster(400, fn);
      }, ms);
    }
    function zyklus() {
      reiss().then(function () { naechster(opt.halten || 10000, function () { zurueck(); naechster(opt.verzug || 1200, zyklus); }); });
    }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { imBlick = es[0].isIntersecting; }, { threshold: .25 }).observe(hk);
    var rs = null; addEventListener('resize', function () { clearTimeout(rs); rs = setTimeout(hoehe, 200); });
    var los = function () { hoehe(); naechster(opt.erst == null ? 250 : opt.erst, zyklus); };
    if (document.readyState === 'complete') los(); else addEventListener('load', los);
  }

  /* ══ 4 · Startbahn „Fächer“ ═════════════════════════════════════════ */
  function docHtml(u, i) {
    var mitte = '';
    if (u.foto) mitte = '<div class="foto" style="background-image:url(' + u.foto + ')"></div>';
    if (u.fotos) mitte = '<div class="fotos">' + u.fotos.map(function (f) { return '<i style="background-image:url(' + f + ')"></i>'; }).join('') + '</div>';
    if (u.text) mitte = '<div class="text" aria-hidden="true"><i></i><i class="schwarz"></i><i></i><i class="schwarz"></i><i></i></div>';
    return '<div class="n6-doc" data-doc="' + i + '" role="img" aria-label="' + esc(u.art) + ', ' + u.felder.map(function (f) { return esc(f[0]) + ' ' + esc(f[1] || 'erkannt'); }).join(', ') + '"><span class="strahl" aria-hidden="true"></span>'
      + '<div class="kopf"><span>' + esc(u.art) + '</span><em>' + (i + 1) + ' / ' + D.unterlagen.length + '</em></div>'
      + '<h4>' + esc(u.titel) + '</h4><div class="unter">' + esc(u.unter) + '</div>' + mitte
      + u.felder.map(function (f) { var w = f[1] || 'erkannt ✓'; return '<div class="f" data-ziel="' + (f[2] || '') + '"><span>' + esc(f[0]) + '</span><b data-wert="' + esc(w) + '">' + esc(w) + '</b></div>'; }).join('')
      + '<div class="rest" aria-hidden="true"></div><div class="stempel" aria-hidden="true">GELESEN</div></div>';
  }
  function fliege(von, nach, html, ms, hub) {
    if (!von || !nach || ruhig) return Promise.resolve();
    var a = von.getBoundingClientRect(), b = nach.getBoundingClientRect();
    if (!a.width || !b.width) return Promise.resolve();
    var chip = document.createElement('div'); chip.className = 'n6-chip'; chip.setAttribute('aria-hidden', 'true'); chip.innerHTML = html; document.body.appendChild(chip);
    var w = chip.offsetWidth, h = chip.offsetHeight, rand = document.documentElement.clientWidth - w - 8;
    var x0 = clamp(a.left + scrollX + a.width / 2 - w / 2, 8, rand), y0 = a.top + scrollY + a.height / 2 - h / 2;
    var x1 = clamp(b.left + scrollX + Math.min(b.width / 2, 60) - w / 2, 8, rand), y1 = b.top + scrollY + b.height / 2 - h / 2;
    chip.style.left = x0 + 'px'; chip.style.top = y0 + 'px';
    var dx = x1 - x0, dy = y1 - y0, hb = hub == null ? -70 : hub;
    return anim(chip, [
      { transform: 'translate(0,0) scale(.7)', opacity: 0 }, { transform: 'translate(0,-10px) scale(1.06)', opacity: 1, offset: .12 },
      { transform: 'translate(' + (dx * .5) + 'px,' + (dy * .5 + hb) + 'px) scale(1) rotate(' + (dx > 0 ? 4 : -4) + 'deg)', opacity: 1, offset: .55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.55)', opacity: 0 }
    ], { duration: ms || 780, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'forwards' }).then(function () { chip.remove(); });
  }
  /* Wechsel „Fächer“: alle Unterlagen liegen als Fächer, jede hebt sich heraus und dreht sich gelesen zurück */
  var FAECHER = {
    auf: function (st) {
      var n = st.docs.length;
      /* landing-faecher-1b · gemessen bei 390 px auf Staging: mit 7° je Blatt ragte das letzte Blatt bis 425 px
         hinaus und war abgeschnitten. Schmal: 3,5° und etwas kleiner. */
      var breite = (st.docs[0] && st.docs[0].parentElement && st.docs[0].parentElement.clientWidth) || window.innerWidth;
      var schmal = breite < 520, schritt = schmal ? 3.5 : 7, mass = schmal ? .72 : .78;
      st.docs.forEach(function (d, i) {
        var w = (i - (n - 1) / 2) * schritt; d.style.transformOrigin = '50% 115%'; d.style.zIndex = i;
        d.dataset.ruhe = 'translateY(-62%) rotate(' + w + 'deg) scale(' + mass + ')'; d.style.transform = d.dataset.ruhe; d.style.opacity = 1; d.style.filter = '';
      });
    },
    rein: function (d) {
      d.style.zIndex = 100;
      return anim(d, [{ transform: d.dataset.ruhe }, { transform: 'translateY(-50%) rotate(0) scale(1)' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.3,1)' }).then(function () { d.style.transform = 'translateY(-50%)'; });
    },
    raus: function (d) {
      return anim(d, [{ transform: 'translateY(-50%) perspective(1200px) rotateY(0)' }, { transform: 'translateY(-50%) perspective(1200px) rotateY(180deg) scale(.9)', offset: .5 }, { transform: d.dataset.ruhe + ' perspective(1200px) rotateY(360deg)' }], { duration: 900, easing: 'cubic-bezier(.5,0,.3,1)' })
        .then(function () { d.style.transform = d.dataset.ruhe; d.style.zIndex = 1; d.style.filter = 'grayscale(.7) brightness(.8)'; });
    }
  };
  function startbahn(host) {
    if (!host) return;
    var ablage = $('.n6-ablage', host);
    ablage.innerHTML = '<div class="n6-trommel" style="position:absolute;inset:0">' + D.unterlagen.map(docHtml).join('') + '</div>';
    var st = { docs: $$('.n6-doc', ablage) };
    function hoehe() {
      st.docs.forEach(function (d) { d.style.minHeight = ''; });
      var h = Math.max.apply(null, st.docs.map(function (d) { return d.offsetHeight; }));
      st.docs.forEach(function (d) { d.style.minHeight = h + 'px'; });
    }
    hoehe(); addEventListener('resize', hoehe);
    var k = karte($('.n6-karte', host)), zl = $('.n6-zaehler', host), standEl = $('.n6-sb-stand', host), lauf = 0;
    if (zl) zl.innerHTML = D.unterlagen.map(function (u) { return '<span>' + esc(u.art) + '</span>'; }).join('');
    function markiere(i, ok) { if (zl) $$('span', zl).forEach(function (s, j) { s.classList.toggle('an', j === i && !ok); if (ok && j === i) s.classList.add('ok'); }); }
    function standText(R) {
      if (!standEl) return;
      standEl.innerHTML = R ? (R.belastbar
        ? 'Rechenkern von DealPilot: <b>' + R.r.score + ' von 100</b>, aus ' + R.n + ' von ' + R.von + ' Kennzahlen.'
        : 'Rechenkern von DealPilot: ' + R.n + ' von ' + R.von + ' Kennzahlen. Der Score startet ab ' + Math.round(SCHWELLE * 100) + ' %.') : '';
    }
    function lies(i, nr, S) {
      var d = st.docs[i], u = D.unterlagen[i], felder = $$('.f', d), stp = $('.stempel', d);
      function lebt() { return nr === lauf; }
      markiere(i, false);
      felder.forEach(function (f) { var b = $('b', f); b.classList.add('leer'); b.classList.remove('ok'); });
      stp.classList.remove('an');
      return FAECHER.rein(d).then(function () {
        if (!lebt()) return;
        d.classList.add('liest');
        return felder.reduce(function (p, f, j) {
          return p.then(function () { if (!lebt()) return; var b = $('b', f); b.classList.remove('leer'); if (!u.felder[j][1]) b.classList.add('ok'); return warte(170); });
        }, Promise.resolve());
      }).then(function () {
        if (!lebt()) return;
        d.classList.remove('liest'); stp.classList.add('an');
        return warte(250).then(function () {
          return Promise.all(felder.map(function (f, j) {
            f.classList.add('quelle');
            return warte(j * 90).then(function () { return fliege($('b', f), k.ziel(u.felder[j][2]), '<small>' + esc(u.art) + '</small>' + esc($('span', f).textContent), 760); }).then(function () { f.classList.remove('quelle'); });
          }));
        });
      }).then(function () {
        if (!lebt()) return;
        Object.assign(S, u.daten);
        var kpf = u.felder.filter(function (f) { return f[2] === 'kp'; })[0];
        if (kpf) k.kp(kpf[1]);
        markiere(i, true);
        var R = rechne(S); standText(R);
        return Promise.all([k.stand(R, 800), warte(350).then(function () { return FAECHER.raus(d); })]);
      });
    }
    function neu() {
      var nr = ++lauf, S = {};
      k.leer(); FAECHER.auf(st); standText(null);
      st.docs.forEach(function (d) { $('.stempel', d).classList.remove('an'); });
      if (zl) $$('span', zl).forEach(function (s) { s.className = ''; });
      if (!kerneDa()) { k.rueckfall(); D.unterlagen.forEach(function (u, i) { markiere(i, true); }); return Promise.resolve(); }
      if (ruhig) {
        /* weniger Bewegung: gleich der Endstand, gerechnet wie sonst Schritt für Schritt */
        D.unterlagen.forEach(function (u, i) { Object.assign(S, u.daten); markiere(i, true); });
        st.docs.forEach(function (d) { $$('.f b', d).forEach(function (b) { if (b.dataset.wert.indexOf('erkannt') === 0) b.classList.add('ok'); }); });
        var kpf = D.unterlagen[0].felder[0]; k.kp(kpf[1]);
        var R = rechne(S); standText(R); k.stand(R, 0); k.abheben();
        return Promise.resolve();
      }
      var kette = Promise.resolve();
      D.unterlagen.forEach(function (u, i) { kette = kette.then(function () { if (nr === lauf) return lies(i, nr, S); }); });
      return kette.then(function () { if (nr === lauf) return k.abheben(); });
    }
    var b = $('.n6-nochmal', host); if (b) b.addEventListener('click', function () { neu(); });
    k.leer(); FAECHER.auf(st);
    /* Die Kerne lädt dealcheck-laden.js nach; die Startbahn beginnt, wenn sie da ist und der Abschnitt im Blick */
    function sobaldKerne(fn) {
      var n = 0;
      (function p() { if (kerneDa() || ++n > 40) fn(); else setTimeout(p, 250); })();
    }
    sichtbar(host, function () { sobaldKerne(function () { setTimeout(neu, 200); }); }, .3);
  }

  /* ══ 5 · Datenbasis: Zusammensetzung und Tabelle der Quellen ═════════
     landing-faecher-2 · Marcel 20.11.2026: „die amtlichen Datenpunkte und wie sie sich zusammensetzen
     animiert hochlaufen lassen“ und „Klick auf die acht Quellen öffnet eine Tabellenansicht“.
     ZAHLEN: nichts hier. Die acht Posten sind teile aus GET /public/datenumfang (window.DPS_ZAHLEN_LIVE,
     gesetzt von landing-zahlen.js), sonst teile aus datenumfang.js (tools/datenumfang-messen.mjs, derselbe
     Rechenweg backend/src/services/datenumfang.js zusammensetzen()). Gezeigt wird die Zusammensetzung nur,
     wenn die Summe der Posten GENAU die Gesamtzahl kopf.amtlich_gesamt ergibt. Die großen Zahlen darüber
     zählt dp2.js hoch (data-zaehl, Endwert = gemessene Zahl, live nachgezogen über DP2_setzeZahl).
     NAMEN: nur die, die heute schon auf der Startseite und in methodik.html stehen. */
  var TEILE = [
    ['zensus', 'Gebäude- und Wohnungszählung'], ['regional', 'Amtliche Regionalstatistik'], ['bau', 'Bautätigkeit und Bauland'],
    ['akoga', 'Landesweite Marktspannen'], ['register', 'Gutachterausschüsse, Register'],
    ['kennzahlen_gaa', 'Parameter der Wertermittlung'], ['zinsen', 'Amtliche Zinsdaten'], ['indizes', 'Amtliche Preisindizes']
  ];
  function ladeSkript(src) {
    return new Promise(function (ok) { var s = document.createElement('script'); s.src = src; s.onload = s.onerror = function () { ok(); }; document.head.appendChild(s); });
  }
  function umfangDaten() {
    var fertig = window.DPS_ZAHLEN_FERTIG && window.DPS_ZAHLEN_FERTIG.then ? window.DPS_ZAHLEN_FERTIG : Promise.resolve();
    return fertig.catch(function () {}).then(function () {
      var L = window.DPS_ZAHLEN_LIVE;
      if (L && L.teile && L.kopf) return L;
      return (window.DPS_UMFANG ? Promise.resolve() : ladeSkript('datenumfang.js?v=landing-faecher-2')).then(function () { return window.DPS_UMFANG || null; });
    });
  }
  function datenbasis(sec) {
    if (!sec) return;
    umfangDaten().then(function (U) {
      if (!U || !U.teile || !U.kopf) return;
      var T = U.teile, summe = 0, ok = true;
      TEILE.forEach(function (t) { var v = T[t[0]]; if (typeof v !== 'number' || !isFinite(v)) ok = false; else summe += v; });
      var ges = U.kopf.amtlich_gesamt;
      /* Zinswerte für die Tabelle (stehen nicht im Kopf der Antwort, daher nicht über data-umfang) */
      $$('[data-teil]', sec).forEach(function (b) {
        var v = T[b.getAttribute('data-teil')];
        if (typeof v === 'number' && isFinite(v)) b.textContent = fmt(v); else b.style.display = 'none';
      });
      /* landing-zahlen-raus · Marcel 25.11.2026: Zusammensetzung (Balken „So setzen sie sich zusammen“) entfernt, nur noch Tabellenzahlen */
    });
    /* Tabelle im Fenster */
    var auf = $('#dtQuellenAuf', sec), dlg = $('#dtQuellen', sec);
    if (!auf || !dlg) return;
    function zu() { if (dlg.open && dlg.close) dlg.close(); else dlg.removeAttribute('open'); document.documentElement.classList.remove('dt-offen'); }
    auf.addEventListener('click', function () {
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      document.documentElement.classList.add('dt-offen');
      var zeilen = $$('tbody tr', dlg);
      zeilen.forEach(function (tr, i) {
        var b = $('td.z b', tr), z = b ? parseInt(String(b.textContent).replace(/\D/g, ''), 10) : NaN;
        if (ruhig) return;
        anim(tr, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 60 + i * 60, fill: 'backwards' });
        if (b && isFinite(z) && b.offsetParent !== null) { b.textContent = '0'; setTimeout(function () { zaehle(b, z, 1200); }, 60 + i * 60); }
      });
      var f = $('[data-zu]', dlg); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg || (e.target.closest && e.target.closest('[data-zu]'))) zu(); });
    dlg.addEventListener('close', function () { document.documentElement.classList.remove('dt-offen'); try { auf.focus({ preventScroll: true }); } catch (e) {} });
  }

  /* ══ 6 · Partner-Laufband als Karten ═══════════════════════════════
     landing-faecher-2 · Marcel 20.11.2026: zwei Reihen Karten, gegenläufig und verschieden schnell.
     Damit der Lauf nahtlos ist, steht jede Reihe 2k-mal hintereinander und die Animation pmarq
     (dp2-hero.css, translateX 0 → −50 %) schiebt genau k Sätze weiter. k so, dass k Sätze mindestens
     die Bildschirmbreite füllen. Kopien sind aria-hidden. Tempo in px/s, damit beide Reihen auf jeder
     Breite gleich ruhig laufen. Bei „weniger Bewegung“ keine Kopie und kein Lauf (CSS). */
  function partnerband() {
    if (ruhig) return;
    $$('.pk-reihe .pmarq-track').forEach(function (tr, r) {
      var orig = $$('.pk', tr); if (!orig.length) return;
      var satz = tr.scrollWidth; if (!satz) return;
      var breit = Math.max(innerWidth || 0, (screen && screen.width) || 0, 1280);
      var k = Math.max(1, Math.ceil(breit / satz)), html = '';
      for (var i = 1; i < 2 * k; i++) html += orig.map(function (o) { return o.outerHTML.replace('<div class="plogo pk"', '<div class="plogo pk" aria-hidden="true"'); }).join('');
      tr.insertAdjacentHTML('beforeend', html);
      tr.style.animationDuration = (k * satz / (r ? 26 : 38)).toFixed(1) + 's';
    });
  }

  /* ══ Demo „Einzel-Check“: nur Staging und lokal ═════════════════════
     Produktion: dealpilot.immo, www.dealpilot.immo, app.dealpilot.immo und
     app.dealpilot.junker-immobilien.io (CLAUDE.md, Speicher „Prod hat zwei
     Adressen“). Staging: staging.dealpilot.immo (dealcheck-laden.js,
     assets/umgebung.js, tools/landing-zahlen-pruefen.mjs). Auf einer
     Produktionsadresse wird die Datei nicht einmal geladen. */
  /* einzelcheck-2 (Marcel 24.11.2026: „auf Prod fehlt das mit dem kompletten Bericht für 3,99"): die Sperre liegt
     jetzt allein im Server (EINZELCHECK_AKTIV in routes/publicEinzelcheck.js, dazu der Stripe-Preis
     dp_einzelcheck_399). Die Datei laedt ueberall, ohne Freigabe antwortet /preis mit 404 und der zweite Weg
     bleibt unsichtbar (einzelcheck.js preisLaden). So schaltet ein Eintrag in der .env Produktion frei, ohne Rollout. */
  function einzelcheckErlaubt() {
    return true;
  }
  function einzelcheckErlaubtAlt() {
    var h = String(location.hostname || '').toLowerCase();
    var staging = /(^|\.)staging\.dealpilot\.immo$/.test(h);
    var prod = !staging && /(^|\.)dealpilot\.immo$|(^|\.)junker-immobilien\.io$/.test(h);
    var lokal = location.protocol === 'file:' || h === 'localhost' || h === '127.0.0.1' || h === '';
    var param = /[?&]demo=einzelcheck(&|$)/.test(location.search);
    return staging || (!prod && (lokal || param));
  }
  function einzelcheckLaden() {
    if (!einzelcheckErlaubt() || !document.getElementById('dealcheck')) return;
    /* v3940 · echter Ablauf statt Demo (einzelcheck.js/.css, Backend routes/publicEinzelcheck.js) */
    /* v3946 · Grundangaben, Bezahlen im selben Tab, Stufe 3, Finanzierung: beide Buster neu */
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'einzelcheck.css?v=einzelcheck-4c'; document.head.appendChild(l);
    var s = document.createElement('script'); s.src = 'einzelcheck.js?v=einzelcheck-10a'; s.async = true;
    /* landing-faecher-2 · der Deal-Check zeigt den zweiten Weg „Bericht holen“ erst, wenn der Einzel-Check da ist */
    s.onload = function () { try { document.dispatchEvent(new CustomEvent('dp:einzelcheck-bereit')); } catch (e) {} };
    document.body.appendChild(s);
  }

  /* ══ Start ══════════════════════════════════════════════════════════ */
  /* landing-faecher-2 · Marcel 20.11.2026: der Riss beginnt rund 2 s später. erst 250 → 2250 ms, danach 0,8 s Wackeln:
     die Risslinie zeichnet sich ab etwa 3,05 s (vorher 1,05 s). Verzug nach jedem Neustart und die 10-s-Schleife bleiben. */
  heroRiss({ erst: 2250, verzug: 1500, halten: 10000 });
  streifen($('#n6st'), { tempo: 30, scroll: .4 });
  vt.baue($('#n6vt'));
  startbahn($('#einlesen'));
  einzelcheckLaden();
  datenbasis($('#daten'));
  partnerband();
  window.DpFaecher = { D: D, rechne: rechne, dealAus: dealAus, schwelle: SCHWELLE, vt: vt };
})();
