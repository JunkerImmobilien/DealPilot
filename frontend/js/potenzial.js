/* ════════════════════════════════════════════════════════════════════
   potenzial.js · v2430 — MIETERHÖHUNG UND ZIELBILD
   ════════════════════════════════════════════════════════════════════
   Marcel 19.10.2026: „Der Investor zeigt der Bank das versteckte Kapital
   im Haus." Je Wohnung bis zu drei Mieten:

     Ist           was heute gezahlt wird
     Soll-Miete    normale Mieterhöhung, der Mieter BLEIBT (§ 558 BGB:
                   bis zur Vergleichsmiete, frühestens 15 Monate nach der
                   letzten Erhöhung, höchstens Kappungsgrenze; dazu § 559
                   für Modernisierung im bewohnten Zustand)
     Zielbild      nach Umbau oder Neuvermietung

   Soll und Zielbild sind freiwillig („kann, nicht muss"). Ohne Angabe sieht
   niemand etwas Neues.

   WAS HIER NICHT STEHT — mit Absicht:
   · Kein Ertragswert. Er kommt aus dem Marktbericht-Dienst
     (POST /marktbericht/potenzial), derselbe Kern und dieselbe Parameter-
     Auflösung wie im Bericht Stufe 3; hier wird nur die Miete je Stufe und
     der Gewinn an Modernisierungspunkten zusammengestellt.
   · Keine Restnutzungsdauer. Sie rechnet derselbe Dienst nach Anlage 2.
   · Keine zweite Punktetabelle. Punkte je Gewerk kommen aus
     DpMfhEinheiten (rnd-calc.js MOD_ELEMENTS).
   · Kein Score, kein Verkehrswert: beide rechnen weiter mit dem Bestand.

   Kennzeichnung überall: „Potenzialwert nach Mieterhöhung bzw. Zielbild,
   keine Verkehrswertermittlung".

   Persistenz: MFH je Wohnung in `_dpMfh.einheiten[]` (Felder `soll`,
   `soll_ab`, `vgl_qm`, `ziel_qm`, `ziel_wann`, `massnahmen[]`), am Objekt
   die Felder `zb_*` (storage.js FIELDS), das letzte Ergebnis in
   `window._dpPotenzial` (storage.js `_potenzial`).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpPotenzial) return;
  /* v3075 · die reinen Mietrechts-Regeln (Kappung, Bremse, Termine, Soll-Miete) liegen im Kern
     js/mietpotenzial-kern.js - er wird in index.html VOR dieser Datei geladen. */
  var K = window.DpMietpotenzial;
  if (!K) { try { console.error('[potenzial] js/mietpotenzial-kern.js fehlt - Mieterhöhung nicht rechenbar'); } catch (e) {} return; }

  /* v2870 · Marcel 22.10.2026: der alte Satz („Potenzialwert …, keine Verkehrswertermittlung“) sagte nicht, was gemeint war */
  /* v3151 · seit v3150 ist die Stufe Mieterhöhung ein Wert zum Stichtag (N114) - gleicher Wortlaut wie PotenzialService */
  var KENNZEICHNUNG = 'Der Ertragswert nach Mieterhöhung bezieht sich auf den heutigen Stichtag: die nach § 558 BGB zulässigen Erhöhungen zählen erst ab ihrer Wirksamkeit und sind abgezinst, Gebäudezustand und Restnutzungsdauer sind die des Bestands. Der Ertragswert im Zielbild ist ein Ausblick: er unterstellt, dass die Maßnahmen umgesetzt sind, und ist kein Verkehrswert nach § 194 BauGB zum heutigen Stichtag.';
  /* v2431 · Marcel 19.10.2026 (Geld): Ertragswert nur mit Stufe 3 - geprueft im
     Haupt-Backend (services/ertragswertFreigabe.js). Ohne Freigabe kommt
     `ertragswert_gesperrt` zurueck; Mieten, Zielbild, Kosten und Rendite bleiben. */
  /* v3018d · Ein Text ohne Zielbild. Fuer Objekte OHNE angelegtes Zielbild (modell().hat_ziel):
     erst die festen Wendungen auf die Mieterhoehung kuerzen, dann jeden Satz streichen, der das
     Zielbild noch nennt. EINE Stelle fuer beide PDFs (pdf.js, pdf-investment-bank.js) und das
     Segment Wert & Zielbild (pdf-wert-zielbild.js) - auch fuer Texte aus dem Marktbericht-Dienst
     (PotenzialService), die das Zielbild nennen, obwohl keines angelegt ist. */
  function ohneZielbild(s) {
    var t = String(s == null ? '' : s);
    if (!/Zielbild/.test(t)) return t;
    [[/Mieterhöhung und Zielbild rechnen/g, 'Die Mieterhöhung rechnet'], [/erzielt bzw\. die Maßnahmen umgesetzt sind/g, 'erzielt wird'],
     [/,\s*Zielbild mit Zustand[^.;]*/g, ''],
     [/nach Mieterhöhung und im Zielbild/g, 'nach Mieterhöhung'], [/Mieterhöhung und Zielbild/g, 'Mieterhöhung'],
     [/Mieterhöhung oder Zielbild/g, 'Mieterhöhung'], [/\(Ist, Soll, Zielbild\)/g, '(Ist, Soll)'],
     [/Ist · Soll · Zielbild/g, 'Ist · Soll'], [/Ist \/ Soll \/ Zielbild/g, 'Ist / Soll'],
     [/ bzw\. die Maßnahmen umgesetzt sind/g, ''], [/,\s*Zielbild (?:offen|\d{4})[^.;]*(?=\.)/g, '']].forEach(function (p) { t = t.replace(p[0], p[1]); });
    return t.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"])/).map(function (satz) {
      if (!/Zielbild/.test(satz)) return satz;
      /* Aufzaehlung mit Semikolon: nur das Glied mit dem Zielbild faellt */
      if (/;/.test(satz)) { var g = satz.split(/;\s*/).filter(function (x) { return !/Zielbild/.test(x); }); return g.length ? g.join('; ').replace(/[,;\s]*$/, '') + (/[.!?]$/.test(g[g.length - 1]) ? '' : '.') : ''; }
      return '';
    }).filter(Boolean).join(' ').replace(/\s{2,}/g, ' ').trim();
  }
  var GESPERRT_KURZ = 'Ertragswert je Stufe mit DealPilot Stufe 3';
  var GESPERRT_LANG = 'Der Ertragswert gehört zur Wertermittlung nach ImmoWertV (Stufe 3). Er erscheint hier, sobald für dieses Objekt ein Marktbericht Stufe 3 vorliegt oder dein Tarif Stufe 3 enthält.';
  function gesperrt(r) { return !!(r && r.ertragswert_gesperrt); }
  /* v2577 · Grund eines gespeicherten Laufs ohne Ertragswert. Vor v2556 trug der
     Dienst dort den allgemeinen Hinweis „Vereinfachtes Sachwert-/Ertragswert-
     verfahren … Indikativ" - das ist kein Grund (gemessen 21.10.2026 an
     Bismarckstr. 27, gespeichert im Objekt). Solche Altstände zeigen keinen Grund. */
  function grundGespeichert() {
    var e = window._dpPotenzial && window._dpPotenzial.ergebnis;
    var g = e && !e.verfuegbar ? String(e.grund || '') : '';
    return /^Vereinfachtes Sachwert-\/Ertragswertverfahren/.test(g) ? '' : g;
  }
  var KAPP_URL = 'js/data/kappungsgrenzen.json';
  var AUFTEILUNG_JE_WE = 1800;   /* Vorbelegung: Notar, Grundbuch, Teilungserklärung, Abgeschlossenheit */
  var PRAEFIX = { '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE', '07': 'RP', '08': 'BW',
                  '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB', '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH' };
  /* Maßnahmen-Katalog. `gewerk` verweist auf Anlage 2 ImmoWertV (rnd-calc.js
     MOD_ELEMENTS); ohne Gewerk trägt die Maßnahme keine Punkte. `einheit`:
     kann eine einzelne Wohnung das allein? Dach, Fassade, Heizung und
     Leitungen gehören dem Haus (dieselbe Teilung wie mfh-einheiten.js). */
  var MASSNAHMEN = [
    { id: 'bad',        t: 'Bad',                 gewerk: 'baeder',      einheit: true },
    /* v2966 · N80 (Marcel 26.10.2026 „ja bitte“): `haus` = waehlbar als Massnahme am GANZEN Haus
       beim MFH (Schritt „Gebäude“). Kosten nach Flaeche auf die Wohnungen, Punkte je Wohnung -
       zusammen mit deren eigenen Massnahmen je Gewerk hoechstens einmal (punkteGewinn). */
    { id: 'fenster',    t: 'Fenster',             gewerk: 'fenster',     einheit: true, haus: true },
    { id: 'boeden',     t: 'Böden/Innenausbau',   gewerk: 'innenausbau', einheit: true },
    { id: 'grundriss',  t: 'Grundriss',           gewerk: 'grundriss',   einheit: true },
    /* v2938 · Elektrik ist ein Teil des Elements „Leitungssysteme (Strom, Gas, Wasser, Abwasser)" der
       Anlage 2: 1 von 2 Punkten (Teilpunkte wie das Modell Sachsen-Anhalt, Gebäudefaktoren: Strom/Gas 1,
       Wasser/Abwasser 1). Bis v2937 zählte sie gar nicht. */
    { id: 'elektrik',   t: 'Elektrik',            gewerk: 'leitungen',   einheit: true, haus: true, max: 1, hinweis: 'Teil der Leitungssysteme (Anlage 2): 1 von 2 Punkten' },
    { id: 'renovierung', t: 'Renovierung',        gewerk: null,          einheit: true },
    { id: 'kueche',     t: 'Küche',               gewerk: null,          einheit: true },
    { id: 'dach',       t: 'Dach',                gewerk: 'dach',        einheit: false, haus: true },
    { id: 'fassade',    t: 'Fassade/Dämmung',     gewerk: 'aussenwand',  einheit: false, haus: true },
    { id: 'heizung',    t: 'Heizung',             gewerk: 'heizung',     einheit: false, haus: true },
    { id: 'leitungen',  t: 'Leitungen',           gewerk: 'leitungen',   einheit: false, haus: true },
    /* v3001 (Marcel 27.10.2026: „da hat man nur so ein paar Sachen, Dach und allen“): weitere Massnahmen
       am ganzen Haus. Punkte NUR, wo Anlage 2 Tabelle 1 das Element nennt und die Massnahme es ganz
       erfuellt - Eingangstuer und Treppenhaus sind nur TEILE eines Elements („Fenster und Aussentueren“,
       „Innenausbau, z. B. Decken, Fussboeden, Treppen“) und tragen allein keine Punkte; alles andere
       ist kein Element der Anlage 2. Kosten zaehlen trotzdem (Zielbild, Umlage, Bank-PDF). */
    { id: 'eingang',    t: 'Hauseingang/Außentüren', gewerk: null,       einheit: false, haus: true, hinweis: 'Teil von „Fenster und Außentüren“ (Anlage 2) — allein keine Punkte' },
    { id: 'treppenhaus', t: 'Treppenhaus',        gewerk: null,          einheit: false, haus: true, hinweis: 'Teil des Innenausbaus (Anlage 2: Decken, Fußböden, Treppen) — allein keine Punkte' },
    { id: 'geschossdecke', t: 'Dämmung oberste Geschossdecke/Kellerdecke', gewerk: null, einheit: false, haus: true, hinweis: 'kein eigenes Element der Anlage 2 — keine Punkte' },
    { id: 'balkone',    t: 'Balkone/Loggien',     gewerk: null,          einheit: false, haus: true, hinweis: 'kein Element der Anlage 2 — keine Punkte' },
    { id: 'aufzug',     t: 'Aufzug',              gewerk: null,          einheit: false, haus: true, hinweis: 'kein Element der Anlage 2 — keine Punkte' },
    { id: 'pv',         t: 'Photovoltaik',        gewerk: null,          einheit: false, haus: true, hinweis: 'kein Element der Anlage 2 — keine Punkte' },
    { id: 'aussenanlagen', t: 'Außenanlagen/Stellplätze', gewerk: null,  einheit: false, haus: true, hinweis: 'kein Element der Anlage 2 — keine Punkte' },
    { id: 'sonst',      t: 'Sonstiges',           gewerk: null,          einheit: true, haus: true }
  ];

  function el(id) { return document.getElementById(id); }
  function wert(id) { var e = el(id); return e ? String(e.value == null ? '' : e.value).trim() : ''; }
  function zahl(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).trim(); if (!s) return 0;
    var n = (typeof window.parseDe === 'function') ? window.parseDe(s) : parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(n) { return (n == null || !isFinite(n)) ? '—' : Math.round(n).toLocaleString('de-DE') + ' €'; }
  function eur2(n) { return (n == null || !isFinite(n)) ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
  function pct(n, d) { return (n == null || !isFinite(n)) ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }) + ' %'; }
  function dez(n, d) { return (n == null || !isFinite(n)) ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  var MON = ['Jan', 'Feb', 'Mrz', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  function monatText(ym) { if (!/^\d{4}-\d{2}/.test(ym || '')) return ''; return MON[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4); }
  function heuteYm() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

  /* ── Kappungsgrenze (§ 558 Abs. 3 BGB) ───────────────────────────────
     Die Liste der Landesverordnungen pflegt ein eigener Erntestrang
     (frontend/js/data/kappungsgrenzen.json, Prüfer tools/kappungsgrenzen-
     pruefen.mjs). Hier wird sie nur GELESEN. Fehlt sie, ist die Gemeinde
     unbekannt oder das Land unsicher, gilt das Gesetz (20 %) — mit dem
     Hinweis, es zu prüfen. Eine eigene Angabe am Objekt geht vor. */
  var _kapp = null, _kappLauf = null;
  function kappungLaden() {
    if (_kappLauf) return _kappLauf;
    _kappLauf = (typeof fetch === 'function'
      ? fetch(KAPP_URL, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
      : Promise.resolve(null))
      .catch(function () { return null; })
      .then(function (d) { _kapp = (d && d.laender) ? d : null; return _kapp; });
    return _kappLauf;
  }
  function deDatum(iso) { return /^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? iso.split('-').reverse().join('.') : ''; }
  /* v3075 · die Regel liegt in js/mietpotenzial-kern.js (kappungAus, Texte woertlich), damit der
     Quick-Check dieselbe Liste liest. Hier nur noch: die eigene Angabe am Objekt und die AGS. */
  function kappung(ags) {
    var eigen = zahl(wert('zb_kappung_pct')) || zahl(window._dpMfh && window._dpMfh.kappung_pct);
    return K.kappungAus(_kapp, { ags: ags }, { eigen_pct: eigen });
  }
  function kappungDaten() { return _kapp; }   /* v3075 · fuer den Quick-Check (quick-check.js) */



  /* ══ v3064 · STANDARDHEBUNG — DIE FESH-REGEL ═══════════════════════════
     Marcel 02.11.2026: „die FESH-Regel, also Fenster, Elektrik, Sanitär, Heizung
     einhalten und den Kunden hinweisen, dass wenn wir darüber kommen und den
     Standard in über zwei Gewerken heben, wir über 50 Jahre bzw. die
     Abschreibungszeit verteilen müssen und es kein Erhaltungsaufwand ist."
     Rechtsgrundlage: BMF-Schreiben vom 26.01.2026 (ersetzt die Schreiben vom
     18.07.2003 und 20.10.2017): Standardhebung = wesentliche Verbesserung, wenn ein
     Maßnahmenbündel mindestens DREI der vier zentralen Bereiche Heizung, Sanitär,
     Elektro, Fenster deutlich verbessert — maßgeblich ausschließlich diese vier.
     Dann Herstellungskosten (AfA), kein Erhaltungsaufwand. Eine Wärmepumpe allein
     hebt den Standard nicht; energetische Wirkung allein reicht nicht.
     DealPilot kann nicht sehen, ob „deutlich gehoben" oder „zeitgemäß ersetzt" —
     deshalb ein HINWEIS, keine stille Umbuchung. Leitungen zählen vorsichtig für
     Sanitär UND Elektro (sie umfassen Wasser/Abwasser und Strom). */
  var FESH = { fenster: ['F'], elektrik: ['E'], bad: ['S'], leitungen: ['S', 'E'], heizung: ['H'] };
  var FESH_NAME = { F: 'Fenster', E: 'Elektro', S: 'Sanitär', H: 'Heizung' };
  function afaJahre() {
    try {
      var v = wert('afa_satz') || '2.0';
      var p = (window.Afa && Afa.parseSelectValue) ? Afa.parseSelectValue(v) : { methode: 'linear', satzPct: parseFloat(String(v).replace(',', '.')) || 2 };
      var s = (p.methode !== 'linear') ? 3 : p.satzPct;
      if (!(s > 0)) return 50;
      return Math.round(100 / s * 10) / 10;
    } catch (e) { return 50; }
  }
  function standardhebung(liste, buchstaben) {
    var set = {};
    (liste || []).forEach(function (m) { (FESH[m && m.id] || []).forEach(function (b) { set[b] = 1; }); });
    String(buchstaben || '').split(/[,\s]+/).forEach(function (b) { if (FESH_NAME[b]) set[b] = 1; });
    var b = ['F', 'E', 'S', 'H'].filter(function (x) { return set[x]; });
    return { bereiche: b.map(function (x) { return FESH_NAME[x]; }), anzahl: b.length, hebung: b.length >= 3 };
  }
  function standardhebungHtml(liste, buchstaben) {
    var r = standardhebung(liste, buchstaben);
    if (r.anzahl < 2) return '';
    var j = afaJahre(), jt = (Math.abs(j - 100 / 3) < 0.1) ? '33⅓' : String(j).replace('.', ',');
    var sz = String(Math.round(10000 / j) / 100).replace('.', ',');   /* v3064a: den Satz mitnennen (eigener Satz aus Gutachten z. B. 6,25 % = 16 J.) */
    var stil = 'margin:10px 0 0;padding:9px 12px;border-radius:8px;font-size:12.5px;line-height:1.5;';
    if (!r.hebung) return '<div class="dp-fesh dp-fesh-2" style="' + stil + 'background:color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 10%,#fff);border:1px solid color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 35%,transparent)">'
      + '<b>Steuer · 2 von 4 zentralen Bereichen</b> (' + esc(r.bereiche.join(', ')) + '). Kommt ein dritter dazu — Fenster, Elektro, Sanitär oder Heizung — '
      + 'und wird der Standard dabei deutlich gehoben, sind die Kosten Herstellungskosten (AfA über ' + jt + ' Jahre), kein Erhaltungsaufwand (BMF-Schreiben vom 26.01.2026).</div>';
    return '<div class="dp-fesh dp-fesh-3" style="' + stil + 'background:color-mix(in srgb,#B8625C 8%,#fff);border:1px solid color-mix(in srgb,#B8625C 35%,transparent)">'
      + '<b style="color:#B8625C">Steuer · Standardhebung: ' + r.anzahl + ' von 4 zentralen Bereichen</b> (' + esc(r.bereiche.join(', ')) + '). '
      + 'Wird dabei der Standard jeweils deutlich gehoben (nicht nur zeitgemäß ersetzt), sind die Kosten <b>Herstellungskosten</b>: '
      + 'sie laufen über die AfA des Gebäudes (bei deinem AfA-Satz von ' + sz + ' % rund ' + jt + ' Jahre) und sind <b>kein sofort abziehbarer Erhaltungsaufwand</b> — '
      + 'auch unterhalb der 15-%-Grenze. Eine neue Wärmepumpe allein hebt den Standard nicht. Grundlage: BMF-Schreiben vom 26.01.2026; bitte mit dem Steuerberater abstimmen.</div>';
  }
  /* v3065 · Der Hinweis hängt an den VORHANDENEN Kacheln des Blocks „Sanierungsbedarf" (Tab
     Investition, fesh_f/e/s/h, Bäder fesh_b zählt als Sanitär) - nicht an eigenen Haken wie in v3064. */
  var FESH_KACHEL = { fesh_f: 'F', fesh_e: 'E', fesh_s: 'S', fesh_b: 'S', fesh_h: 'H' };
  function feshBinden() {
    var h = el('san-fesh-hinweis'); if (!h) return;
    function zeichnen() {
      var b = Object.keys(FESH_KACHEL).filter(function (id) { var c = el(id); return c && c.checked; }).map(function (id) { return FESH_KACHEL[id]; }).join(',');
      var html = standardhebungHtml([], b);
      var zb = standardhebung(objektMassnahmen());
      if (!html && zb.anzahl >= 2) html = '<div class="hint" style="margin-top:6px">Laut Zielbild-Maßnahmen betroffen: ' + esc(zb.bereiche.join(', ')) + ' — die Steuerfolge prüft der Hinweis, sobald die Bereiche oben angekreuzt sind.</div>';
      h.innerHTML = html;
    }
    Object.keys(FESH_KACHEL).forEach(function (id) { var c = el(id); if (c && !c._dpFesh) { c._dpFesh = true; c.addEventListener('change', zeichnen); } });
    zeichnen();
  }


  /* ══ v3067 · DIE MIETLEITER — EINE FÜR ETW UND MFH-WOHNUNG ═════════════
     Marcel 02.11.2026: „was geht und wann zum Übernehmen" — erst im MFH-Fenster
     (v3066), jetzt auch für ETW/EFH/ZFH. Der Bau steht HIER, damit beide dieselbe
     Leiter zeigen; die Aufrufer geben nur ihre Felder (f.sollSetzen, f.zielSetzen).
     Rechnet nichts selbst: Soll/Termine aus sollFuer (modell), Kappung und
     Mietpreisbremse aus mietrechtDaten. */
  function leiterZeilen(m, idx, f) {
    var w = m && m.wohnungen && m.wohnungen[idx]; if (!w) return [];
    f = f || {};
    var wfl = zahl(w.wfl), ist = zahl(w.ist), so = w.soll || {};
    var d = mietrechtDaten(m, idx);
    var qm = function (x) { return wfl > 0 ? ' · ' + eur2(x / wfl) + '/m²' : ''; };
    var z = [];
    z.push({ c: 'heute', t: 'Heute', v: ist > 0 ? eur(ist) + '/Monat' + qm(ist) : 'leer',
      u: f.mv_beginn ? 'Mietvertrag seit ' + deDatum(String(f.mv_beginn).slice(0, 10)) : '' });
    if (!(ist > 0)) z.push({ c: 'soll', t: 'Mieterhöhung', v: '—', u: 'nicht vermietet — es zählt die Neuvermietung' });
    else if (so.vertrag) z.push({ c: 'soll', t: 'Mieterhöhung', v: vertragZeileV(so, ist, qm), u: vertragZeileU(so) });   /* v3244 */
    else if (so.miete != null && so.miete > ist + 0.01) {
      var eigenS = /^eigene Angabe/.test(so.herkunft || ''), wirk = so.termine && so.termine.wirksam_ab;
      z.push({ c: 'soll', t: 'Mieterhöhung', v: 'auf ' + eur(so.miete) + '/Monat' + qm(so.miete),
        u: (so.termine ? so.termine.text : '') + (so.grenze ? ' · Grenze ' + so.grenze : '')
          + (so.umlage559 && so.umlage559.monat > 0 ? ' · darin Umlage § 559 ' + eur(so.umlage559.monat) : '')
          + (so.termine && so.termine.letzte_fehlt ? ' · letzte Erhöhung nicht eingetragen' : ''),
        tag: eigenS ? 'eigene Angabe' : 'DealPilot rechnet vor',
        k: (eigenS || !f.sollSetzen) ? null : { lbl: 'übernehmen', fn: function () { f.sollSetzen(so.miete, wirk); } } });
    } else z.push({ c: 'soll', t: 'Mieterhöhung', v: 'kein Spielraum', u: so.grund || '' });
    var br = d.bremse, og = d.obergrenze;
    if (br && br.gilt === true && og) z.push({ c: 'neu', t: 'Bei Neuvermietung', v: 'höchstens ' + eur2(og) + '/m²',
      u: 'Mietpreisbremse gilt' + (br.bis ? ' bis ' + deDatum(br.bis) : '') + ' · Vergleichsmiete + 10 %',
      k: f.zielSetzen ? { lbl: 'als Zielmiete', fn: function () { f.zielSetzen(og); } } : null });
    else if (br && br.gilt === false) z.push({ c: 'neu', t: 'Bei Neuvermietung', v: 'frei', u: 'keine Mietpreisbremse an dieser Adresse' });
    else z.push({ c: 'neu', t: 'Bei Neuvermietung', v: 'bitte prüfen', u: (br && br.text) || '' });
    /* v3130 · N115 · Vorschlag Zielmiete nach Sanierung (nur Vorschlag, „übernehmen" setzt das Feld) */
    var zv = vorschlagFuer(m, idx);
    if (zv && zv.qm != null) z.push({ c: 'ziel', t: 'Vorschlag nach Sanierung', tag: 'DealPilot schlägt vor',
      v: eur2(zv.qm) + '/m²' + (wfl ? ' · ' + eur(zv.monat) + '/Monat' : ''),
      u: zv.herkunft + (zv.gedeckelt ? ' · gedeckelt durch die Mietpreisbremse' : zv.ungeprueft ? ' · Mietpreisbremse bitte prüfen' : ''),
      k: f.zielSetzen && Math.abs(zahl(f.ziel_qm) - zv.qm) > 0.004 ? { lbl: 'übernehmen', fn: function () { f.zielSetzen(zv.qm); } } : null });
    else if (zv && zv.fehlt) z.push({ c: 'ziel', t: 'Vorschlag nach Sanierung', v: 'noch keine Marktmiete', u: VORSCHLAG_FEHLT });
    var zq = zahl(f.ziel_qm), bad = !!(og && br && br.gilt === true && zq > og + 0.004);
    z.push({ c: 'ziel', t: 'Zielbild', v: zq > 0 ? eur2(zq) + '/m²' + (wfl ? ' · ' + eur(zq * wfl) + '/Monat' : '') : 'noch keine Zielmiete', bad: bad,
      u: bad ? 'über der Mietpreisbremse — nur mit höherer Vormiete (§ 556e) oder nach umfassender Modernisierung (§ 556f)'
        : (f.ziel_wann ? String(f.ziel_wann) : 'Zielmiete und Maßnahmen darunter eintragen') });
    z._kapp = d.kapp && d.kapp.text;
    /* v3071 · Marcel 02.11.2026: „ein Balkendiagramm IST / nach Mieterhöhung (wenn möglich,
       sonst weglassen) / Zielbild". Werte €/Monat aus denselben Zeilen - nichts neu gerechnet. */
    z._balken = [];
    if (ist > 0) z._balken.push({ c: 'heute', t: 'Ist', v: ist });
    if (ist > 0 && so.miete != null && so.miete > ist + 0.01) z._balken.push({ c: 'soll', t: 'nach Mieterhöhung', v: so.miete });
    if (zq > 0 && wfl > 0) z._balken.push({ c: 'ziel', t: 'Zielbild', v: zq * wfl, bad: bad });
    return z;
  }
  function balkenHtml(b) {
    if (!b || b.length < 2) return '';   /* ein Balken allein sagt nichts */
    var max = Math.max.apply(null, b.map(function (x) { return x.v; })) || 1, basis = b[0].v;
    return '<div class="dp-mb" role="img" aria-label="Miete je Monat: ' + b.map(function (x) { return x.t + ' ' + eur(x.v); }).join(', ') + '">'
      + b.map(function (x) {
        var dif = (x !== b[0] && basis > 0) ? ' <small>' + (x.v >= basis ? '+' : '') + Math.round((x.v / basis - 1) * 100) + ' %</small>' : '';
        return '<div class="dp-mb-s dp-mb-' + x.c + (x.bad ? ' dp-mb-bad' : '') + '"><b>' + eur(x.v) + dif + '</b>'
          + '<span class="dp-mb-bar" style="height:' + Math.max(8, Math.round(x.v / max * 92)) + 'px"></span><i>' + esc(x.t) + '</i></div>';
      }).join('') + '</div>';
  }
  function leiterHtml(z) {
    leiterStil();
    return balkenHtml(z._balken) + '<div class="dp-ml">' + z.map(function (r, j) {
      return '<div class="dp-ml-z dp-ml-' + r.c + (r.bad ? ' dp-ml-bad' : '') + '"><span class="dp-ml-p"></span>'
        + '<div class="dp-ml-txt"><span class="dp-ml-t">' + esc(r.t) + (r.tag ? ' <i>' + esc(r.tag) + '</i>' : '') + '</span>'
        + '<b class="dp-ml-v">' + esc(r.v) + '</b>' + (r.u ? '<span class="dp-ml-u">' + esc(r.u) + '</span>' : '') + '</div>'
        + (r.k ? '<button type="button" class="dp-ml-k" data-ml="' + j + '">' + esc(r.k.lbl) + ' ›</button>' : '') + '</div>';
    }).join('') + '</div>' + (z._kapp ? '<p class="dp-ml-fuss">' + esc(z._kapp) + '</p>' : '');
  }
  function leiterBinden(host, z) {
    host.querySelectorAll('[data-ml]').forEach(function (b) {
      var r = z[+b.getAttribute('data-ml')];
      b.addEventListener('click', function () { if (r && r.k) r.k.fn(); });
    });
  }
  function leiterStil() {
    if (el('dp-ml-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-ml-stil';
    s.textContent = [
      '.dp-ml{display:flex;flex-direction:column;border:1px solid #EFE7D6;border-radius:10px;padding:2px 12px;background:#fff}',
      '.dp-ml-z{display:grid;grid-template-columns:18px 1fr auto;gap:10px;align-items:start;padding:8px 0;border-top:1px solid #F1ECE1}',
      '.dp-ml-z:first-child{border-top:none}',
      '.dp-ml-p{width:10px;height:10px;border-radius:50%;margin:5px 0 0 4px;background:#8A8272}',
      '.dp-ml-soll .dp-ml-p{background:#3d6fa8}.dp-ml-neu .dp-ml-p{background:var(--wl-c9a84c, #C9A84C)}.dp-ml-ziel .dp-ml-p{background:#2f7d55}',
      '.dp-ml-txt{display:flex;flex-direction:column;gap:1px;min-width:0}',
      '.dp-ml-t{font:600 10.5px/1.3 "JetBrains Mono",monospace;letter-spacing:.07em;text-transform:uppercase;color:#7A7370}',
      '.dp-ml-t i{font:400 10.5px Inter,sans-serif;letter-spacing:0;text-transform:none;color:#8A8272;font-style:normal}',
      '.dp-ml-v{font:600 14px/1.35 "Space Grotesk",sans-serif;color:#2A2727}',
      '.dp-ml-u{font-size:11.5px;color:#7A7370;line-height:1.4}',
      '.dp-ml-bad .dp-ml-v{color:#B8625C}.dp-ml-bad .dp-ml-p{background:#B8625C}',
      '.dp-ml-k{border:1px solid var(--wl-c9a84c, #C9A84C);background:#fff;color:#2A2727;border-radius:7px;padding:5px 9px;font:500 12px Inter,sans-serif;cursor:pointer;white-space:nowrap}',
      '.dp-ml-k:hover{background:color-mix(in srgb,var(--wl-c9a84c, #C9A84C) 12%,#fff)}',
      '.dp-ml-fuss{font-size:11.5px;color:#8A8272;margin:6px 0 0;line-height:1.45}',
      /* v3071 · Balken Ist / nach Mieterhöhung / Zielbild */
      '.dp-mb{display:flex;align-items:flex-end;gap:14px;padding:10px 14px 8px;margin:0 0 10px;border:1px solid #EFE7D6;border-radius:10px;background:#fff}',
      '.dp-mb-s{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}',
      '.dp-mb-s b{font:600 13px/1.2 "Space Grotesk",sans-serif;color:#2A2727;white-space:nowrap}',
      '.dp-mb-s b small{font:500 11px Inter,sans-serif;color:#2f7d55}',
      '.dp-mb-bar{display:block;width:100%;max-width:70px;border-radius:6px 6px 2px 2px;background:#8A8272}',
      '.dp-mb-soll .dp-mb-bar{background:#3d6fa8}.dp-mb-ziel .dp-mb-bar{background:#2f7d55}.dp-mb-bad .dp-mb-bar{background:#B8625C}',
      '.dp-mb-s i{font:500 10.5px/1.2 "JetBrains Mono",monospace;letter-spacing:.05em;text-transform:uppercase;color:#7A7370;font-style:normal;text-align:center}'
    ].join('');
    document.head.appendChild(s);
  }
  /* ETW/EFH/ZFH: die Leiter oben in der Karte „Mieterhöhung und Zielbild" (Tab Investition). */
  function objektLeiter(m) {
    var einzel = el('zb-einzel'); if (!einzel) return;
    var host = el('zb-leiter');
    if (!host) { host = document.createElement('div'); host.id = 'zb-leiter'; host.style.margin = '0 0 12px'; einzel.insertBefore(host, einzel.firstChild); }
    var wfl = zahl(wert('wfl'));
    function setz(id, v) { var e = el(id); if (!e) return; e.value = v; try { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {} }
    var z = leiterZeilen(m, 0, {
      mv_beginn: wert('mv_beginn'), ziel_qm: wert('zb_ziel_qm'), ziel_wann: wert('zb_ziel_wann'),
      sollSetzen: function (miete, ab) { if (wfl > 0) setz('zb_soll_qm', (miete / wfl).toFixed(2).replace('.', ',')); if (ab) setz('zb_soll_ab', ab); },
      zielSetzen: function (og) { setz('zb_ziel_qm', og.toFixed(2).replace('.', ',')); if (!wert('zb_ziel_wann')) setz('zb_ziel_wann', 'bei Mieterwechsel'); }
    });
    host.innerHTML = leiterHtml(z);
    leiterBinden(host, z);
  }

  /* ══ v3130 · N115 · ZIELMIETE NACH SANIERUNG JE WOHNUNG — VORSCHLAG ═════
     Marcel 03.11.2026 („Nummer vier, das können wir umsetzen"). Leitplanken:
     nur VORSCHLAG, nie vorbelegt - je Wohnung „übernehmen" (und „alle übernehmen");
     Grundlage die Marktmiete der DealPilot-Marktbewertung des Objekts (beim MFH für
     die mittlere Wohnungsgröße abgefragt, v2556b), für den sanierten Zustand die
     obere Spanne; gedeckelt durch die Mietpreisbremse (Kern: zielmieteVorschlag ->
     neuvermietung). Eine eigene „marktübliche Miete nach Modernisierung" (zb_markt_qm)
     geht vor. Ohne Marktmiete: kein Vorschlag, sondern der Weg zur Marktbewertung.
     Nach außen keine Quellennamen - „aktueller Marktdurchschnitt". */
  var VORSCHLAG_FEHLT = 'Marktbewertung abrufen (Reiter Objekt, „Marktbericht abrufen“ – Stufe 1 genügt), dann schlägt DealPilot je Wohnung eine Zielmiete vor.';
  function qmDe(x) { return x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function marktSaniert(m) {
    var eig = zahl(wert('zb_markt_qm'));
    if (eig > 0) return { qm: Math.round(eig * 100) / 100, art: 'eigen', herkunft: 'eigene Angabe: marktübliche Miete nach Modernisierung (Tab Investition)' };
    var st = null; try { st = JSON.parse(wert('_mb_state') || 'null'); } catch (e) { st = null; }
    var c = st && st.card, key = window._currentObjKey || null;
    if (!c || !c.mm || (st.fuer && st.fuer.key && key && st.fuer.key !== key)) return null;   /* fremde Karte: kein Wert */
    var area = zahl(c.area);
    var mitte = zahl(c.mm.qm) || (area > 0 && c.mm.med ? c.mm.med / area : 0);
    /* obere Spanne: neue Karten führen q75_qm (oder null); ältere nur high - war das der Ersatz
       „Mitte × 1,1" (mapCard ohne q75), ist es keine gemessene Spanne */
    var oben = ('q75_qm' in c.mm) ? zahl(c.mm.q75_qm)
      : ((area > 0 && c.mm.high && c.mm.med && Math.abs(c.mm.high / c.mm.med - 1.1) > 0.003) ? c.mm.high / area : 0);
    if (!(mitte > 0)) return null;
    var W = (m && m.wohnungen || []).filter(function (w) { return w.art !== 'gewerbe' && w.wfl > 0; });
    var ds = W.length ? W.reduce(function (a, w) { return a + w.wfl; }, 0) / W.length : 0;
    var qm = Math.round((oben > mitte ? oben : mitte) * 100) / 100;
    return { qm: qm, mitte: Math.round(mitte * 100) / 100, art: oben > mitte ? 'oben' : 'mitte', wfl_schnitt: ds || null, datum: c.bericht_datum || null,
      herkunft: 'aktueller Marktdurchschnitt' + (ds > 0 ? ' für Wohnungen um ' + Math.round(ds) + ' m²' : '')
        + (oben > mitte ? ', obere Spanne als Ansatz für den sanierten Zustand (Mitte ' + qmDe(mitte) + ' €/m²)' : ' (Mitte; keine Spanne in der Marktbewertung)')
        + (c.bericht_datum ? ' · Marktbewertung vom ' + c.bericht_datum : '') };
  }
  function vorschlagFuer(m, idx) {
    var w = m && m.wohnungen && m.wohnungen[idx];
    if (!w || !K || !K.zielmieteVorschlag) return null;
    var b = marktSaniert(m), d = mietrechtDaten(m, idx);
    var r = K.zielmieteVorschlag({ wfl: w.wfl, basis_qm: b ? b.qm : 0, art: w.art, vermietet: w.ist > 0 && w.status !== 'leer', bremse: d.bremse, vgl_qm: d.vgl_qm });
    if (!r || r.qm == null) return r;
    r.herkunft = b.herkunft; r.basis_art = b.art;
    /* die Marktmiete gilt für die mittlere Wohnungsgröße - weicht diese Wohnung deutlich ab, sagt es der Vorschlag */
    if (b.wfl_schnitt > 0 && Math.abs(w.wfl / b.wfl_schnitt - 1) > 0.35) r.groesse = 'Wohnung deutlich ' + (w.wfl > b.wfl_schnitt ? 'größer' : 'kleiner') + ' als der Durchschnitt — Marktmiete je m² weicht dann meist ab';
    return r;
  }
  /** v3130 · alle Wohnungen des Arbeitsstands: { markt, zeilen:[{ i, nr, lage, wfl, ist, ziel_qm, v }] } */
  function zielVorschlaege(opts) {
    var m = modell(opts);
    return { markt: marktSaniert(m), bremse: mietpreisbremse(agsJetzt()), zeilen: m.wohnungen.map(function (w, j) {
      return { i: w.i, nr: w.nr, lage: w.lage, art: w.art, wfl: w.wfl, ist: w.ist, status: w.status, ziel_qm: w.ziel_qm, v: vorschlagFuer(m, j) };
    }) };
  }
  function zielVorschlagHtml(res) {
    zvStil();
    if (!res || !res.zeilen || !res.zeilen.length) return '';
    var kopf = '<div class="dp-zv-kopf"><b>Zielmiete nach Sanierung · Vorschlag</b><span>nur ein Vorschlag — übernommen wird nur, was du anklickst</span></div>';
    if (!res.markt) return '<div class="dp-zv">' + kopf + '<p class="dp-zv-fehlt">' + esc(VORSCHLAG_FEHLT) + '</p></div>';
    var offen = 0;
    var zeilen = res.zeilen.map(function (z) {
      var name = (z.nr ? 'Nr. ' + z.nr : '#' + (z.i + 1)) + (z.lage ? ' · ' + z.lage : '');
      var v = z.v, rechts;
      if (!v) rechts = '<span class="dp-zv-leer">' + (z.art === 'gewerbe' ? 'Gewerbe — kein Vorschlag' : 'Fläche fehlt') + '</span>';
      else if (v.qm == null) rechts = '<span class="dp-zv-leer">—</span>';
      else {
        var gleich = z.ziel_qm != null && Math.abs(z.ziel_qm - v.qm) < 0.005;
        if (!gleich) offen++;
        rechts = gleich ? '<span class="dp-zv-ok">übernommen</span>'
          : '<button type="button" class="dp-ml-k" data-zv="' + z.i + '" data-zv-qm="' + v.qm + '">übernehmen ›</button>';
      }
      var mitte = v && v.qm != null
        ? '<b>' + esc(qmDe(v.qm)) + ' €/m²</b> · ' + esc(eur(v.monat)) + '/Monat'
          + (v.gedeckelt ? ' <i class="dp-zv-deckel" title="' + esc(v.text) + '">Mietpreisbremse</i>' : v.ungeprueft ? ' <i class="dp-zv-pruef" title="' + esc(v.text) + '">Bremse prüfen</i>' : '')
          + '<small>' + (z.ist > 0 && z.wfl > 0 ? 'heute ' + esc(qmDe(z.ist / z.wfl)) + ' €/m²' : 'leer') + (z.ziel_qm ? ' · eingetragen ' + esc(qmDe(z.ziel_qm)) + ' €/m²' : '')
          + (v.groesse ? ' · ' + esc(v.groesse) : '') + '</small>'
        : '';
      return '<div class="dp-zv-z"><span class="dp-zv-n">' + esc(name) + '<small>' + (z.wfl ? Math.round(z.wfl) + ' m²' : '') + '</small></span>'
        + '<span class="dp-zv-v">' + mitte + '</span><span class="dp-zv-k">' + rechts + '</span></div>';
    }).join('');
    var br = res.bremse || {};
    return '<div class="dp-zv">' + kopf
      + '<p class="dp-zv-her">Grundlage: ' + esc(res.markt.herkunft) + '.</p>'
      + '<div class="dp-zv-liste">' + zeilen + '</div>'
      + (offen > 1 ? '<div class="dp-zv-alle"><button type="button" class="dp-ml-k" data-zv-alle="1">alle ' + offen + ' übernehmen ›</button></div>' : '')
      + '<p class="dp-zv-fuss">' + esc(br.gilt === true ? 'Mietpreisbremse gilt hier: bei Neuvermietung höchstens ortsübliche Vergleichsmiete + 10 % (§ 556d BGB); ausgenommen die erste Vermietung nach umfassender Modernisierung (§ 556f BGB).'
          : br.gilt === false ? 'Keine Mietpreisbremse an dieser Adresse.' : 'Mietpreisbremse bitte prüfen — wo sie gilt, höchstens Vergleichsmiete + 10 % (§ 556d BGB).')
        + ' Laufende Mietverträge: bis zur Neuvermietung gilt die zulässige Miete (Kappungsgrenze, § 558 BGB); mehr nur über die Modernisierungsumlage (§ 559 BGB). Die Zielmiete geht nur in Zielbild, Pilot-Analyse und PDF, nicht in die Mietentwicklung.</p></div>';
  }
  function zvStil() {
    leiterStil();
    if (el('dp-zv-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-zv-stil';
    s.textContent = [
      '.dp-zv{margin:14px 0 4px;border:1px solid #EFE7D6;border-radius:10px;padding:10px 12px;background:#fff}',
      '.dp-zv-kopf{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}',
      '.dp-zv-kopf b{font:600 11px/1.3 "JetBrains Mono",monospace;letter-spacing:.07em;text-transform:uppercase;color:#2f7d55}',
      '.dp-zv-kopf span{font-size:11.5px;color:#8A8272}',
      '.dp-zv-her,.dp-zv-fuss,.dp-zv-fehlt{font-size:11.5px;color:#7A7370;line-height:1.45;margin:6px 0}',
      '.dp-zv-fehlt{color:#2A2727}',
      '.dp-zv-z{display:grid;grid-template-columns:minmax(90px,1.1fr) 2.4fr auto;gap:6px 12px;align-items:center;padding:7px 0;border-top:1px solid #F1ECE1}',
      '.dp-zv-n{font-size:12.5px;color:#2A2727;min-width:0}.dp-zv-n small{display:block;color:#8A8272;font-size:11px}',
      '.dp-zv-v{font-size:12.5px;color:#2A2727;min-width:0}.dp-zv-v b{font:600 13.5px "Space Grotesk",sans-serif}',
      '.dp-zv-v small{display:block;color:#8A8272;font-size:11px;line-height:1.35}',
      '.dp-zv-v i{font-style:normal;font-size:10.5px;padding:1px 6px;border-radius:999px;margin-left:4px;white-space:nowrap}',
      '.dp-zv-deckel{background:#EAF3EE;color:#2f7d55}.dp-zv-pruef{background:#F8EDEC;color:#B8625C}',
      '.dp-zv-ok{font-size:11.5px;color:#2f7d55;white-space:nowrap}.dp-zv-leer{font-size:11.5px;color:#8A8272}',
      '.dp-zv-alle{text-align:right;padding-top:6px;border-top:1px solid #F1ECE1}',
      '@media (max-width:560px){.dp-zv-z{grid-template-columns:1fr auto}.dp-zv-v{grid-column:1/-1;grid-row:2}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ══ v3062 · MIETPREISBREMSE UND MIETRECHT AUF EINEN BLICK ══════════════
     Marcel 02.11.2026: „ja, die Mietpreisbremse kannst du umsetzen und die
     Kappungsgrenzen — und stellst du es auch einfacher dar?"
     Gemessen vorher: die Bremse stand in kappungsgrenzen.json (759 Gemeinden,
     je mit mietpreisbremse_gueltig_bis), aber KEIN Code las sie. Die Kappung
     und die Termine rechnete potenzial.js, sie standen aber nur in der
     zugeklappten Zielbild-Karte im Tab Investition und im MFH-Fenster als
     langer Satz — nicht dort, wo der Mietvertrag eingetragen wird.
     Rechnet NICHTS Neues zur Miete: Kappung, Termine und Soll kommen aus
     kappung()/sollFuer() über modell(). Neu ist nur die Bremse (§ 556d Abs. 1
     BGB: bei Mietbeginn höchstens ortsübliche Vergleichsmiete + 10 %). */
  function mietpreisbremse(ags) { return K.mietpreisbremseAus(_kapp, { ags: ags }); }   /* v3075 · Regel im Kern */

  /* Eine Wohnung des Modells (m.wohnungen[i]) als höchstens vier Zeilen. */
  function mietrechtDaten(m, i) {
    var w = (m && m.wohnungen && m.wohnungen[i || 0]) || null;
    var kapp = (m && m.kappung) || kappung(agsJetzt());
    var br = mietpreisbremse(agsJetzt());
    var s = (w && w.soll) || {};
    var vglQm = zahl(s.vgl_qm) || zahl(w && w.vgl_qm) || zahl(m && m.vgl && m.vgl.qm);
    var vglHer = s.vgl_herkunft || (m && m.vgl && m.vgl.herkunft) || '';
    var z = [];
    /* 1 · Kappungsgrenze */
    z.push({ k: 'Kappungsgrenze', v: kapp.pct + ' % in 3 Jahren',
      u: kapp.herkunft === 'verordnung' ? (kapp.verordnung || 'Landesverordnung') : kapp.herkunft === 'eigen' ? 'eigene Angabe'
        : kapp.herkunft === 'gesetz' ? 'gesetzlich (§ 558 Abs. 3 BGB)' : 'bitte prüfen',
      warn: !!kapp.pruefen, lang: kapp.text });
    /* 2 · Nächste Erhöhung (§ 558) — aus sollFuer, nichts nachgerechnet */
    if (w) {
      var ist = zahl(w.ist), wfl = zahl(w.wfl);
      if (s.vertrag) z.push({ k: 'Nächste Erhöhung', v: vertragZeileV(s, ist, function (x) { return wfl ? ' (' + eur2(x / wfl) + '/m²)' : ''; }), u: vertragZeileU(s) });   /* v3244 */
      else if (!(ist > 0)) z.push({ k: 'Nächste Erhöhung', v: '—', u: 'nicht vermietet' });
      else if (s.miete != null && s.miete > ist + 0.01) z.push({ k: 'Nächste Erhöhung',
        v: 'auf ' + eur(s.miete) + '/Monat' + (wfl ? ' (' + eur2(s.miete / wfl) + '/m²)' : ''),
        /* v3062a · die § 559-Umlage gehört in die Zeile: Wohnung 3 Westerfeldstr. stieg auf 9,92 €/m² bei
           Vergleichsmiete 8,40 - 588 € nach § 558 plus 107 € Umlage. „Grenze: Vergleichsmiete" allein war falsch. */
        u: (s.termine ? s.termine.text : '') + (s.grenze ? ' · Grenze § 558: ' + s.grenze : '')
          + (s.umlage559 && s.umlage559.monat > 0 ? ' · darin Modernisierungsumlage § 559: ' + eur(s.umlage559.monat) + '/Monat'
              + (s.umlage559.ohne_erh ? ' (Erhaltungsanteil nicht eingetragen — 0 % abgezogen)' : '') : '')
          + (/^eigene Angabe/.test(s.herkunft || '') ? ' · eigene Angabe' : ''),
        warn: !!(s.termine && s.termine.letzte_fehlt) || !!(s.hinweise && s.hinweise.length),
        lang: [s.termine && s.termine.sperre, (s.hinweise || []).join(', ')].filter(Boolean).join(' · ') });
      else {
        var fr = s.termine ? (s.termine.letzte_fehlt ? 'Datum der letzten Erhöhung eintragen — Sperrfrist sonst nicht geprüft'
          : (s.termine.verlangbar_sofort ? 'Sperrfrist abgelaufen' : 'Sperrfrist bis ' + mmjj(s.termine.verlangbar_ab))) : '';
        z.push({ k: 'Nächste Erhöhung', v: 'kein Spielraum',
          u: (s.grund || '') + (fr ? ' · ' + fr : ''), warn: !!(s.termine && s.termine.letzte_fehlt) });
      }
    }
    /* 3 · Mietpreisbremse bei Neuvermietung */
    var obergrenze = (br.gilt && vglQm > 0) ? Math.round(vglQm * 1.1 * 100) / 100 : null;
    var markt = /Marktmiete/i.test(vglHer);
    z.push({ k: 'Mietpreisbremse', v: br.gilt === true ? 'gilt' + (br.bis ? ' bis ' + deDatum(br.bis) : '') : br.gilt === false ? 'gilt hier nicht' : 'bitte prüfen',
      u: br.gilt === true
        ? (obergrenze ? 'bei Neuvermietung höchstens ' + eur2(obergrenze) + '/m² (Vergleichsmiete ' + eur2(vglQm) + ' + 10 %'
            + (vglHer ? ', ' + vglHer : '') + ')' : 'Vergleichsmiete eintragen — dann rechnet DealPilot die Obergrenze')
        : br.gilt === false ? 'Neuvermietung ohne Obergrenze nach § 556d' : '',
      warn: br.gilt === null || !!br.pruefen || (br.gilt === true && markt), lang: br.text
        + (br.gilt === true && markt ? ' Die Obergrenze ist auf der Marktmiete gerechnet, nicht auf der ortsüblichen Vergleichsmiete (Mietspiegel) — die kann niedriger liegen.' : '')
        + (br.gilt === true ? ' Ausnahmen: höhere Vormiete (§ 556e BGB), erste Vermietung nach umfassender Modernisierung oder Neubau (§ 556f BGB).' : '') });
    /* 4 · Zielmiete gegen die Bremse */
    var zq = zahl(w && w.ziel_qm);
    if (obergrenze && zq > obergrenze + 0.004) z.push({ k: 'Zielmiete', v: eur2(zq) + '/m² liegt über der Bremse', bad: true,
      u: 'zulässig nur mit höherer Vormiete (§ 556e) oder nach umfassender Modernisierung (§ 556f) — sonst höchstens ' + eur2(obergrenze) + '/m²' });
    /* v3158 · was hier gilt, am Objekt merken (Schnittstelle) - auch ohne Potenzial-Rechnung; nur fuer das Objekt selbst (i == null) */
    try { if (!i && window.dpMarktdatenMerken) window.dpMarktdatenMerken({ kappung: kapp ? Object.assign({ ags: agsJetzt() }, kapp) : null, mietpreisbremse: br ? Object.assign({ ags: agsJetzt(), obergrenze_qm: obergrenze || null }, br) : null, vergleichsmiete_genutzt: vglQm ? { qm: vglQm, herkunft: vglHer || null } : null }); } catch (e) {}   /* v3245: eigener Schluessel - unter 'vergleichsmiete' las objektVgl() die Marktmiete als amtlich zurueck */
    return { zeilen: z, bremse: br, obergrenze: obergrenze, kapp: kapp, vgl_qm: vglQm || null, vgl_herkunft: vglHer || null };   /* v3130: vgl fuer den Zielmiete-Vorschlag */
  }

  function mietrechtHtml(m, i, o) {
    o = o || {};
    mietrechtStil();
    var d = mietrechtDaten(m, i);
    return '<div class="dp-mr' + (o.eng ? ' dp-mr-eng' : '') + '">' + d.zeilen.map(function (r) {
      return '<div class="dp-mr-z' + (r.bad ? ' dp-mr-bad' : r.warn ? ' dp-mr-warn' : '') + '"' + (r.lang ? ' title="' + esc(r.lang) + '"' : '') + '>'
        + '<span class="dp-mr-k">' + esc(r.k) + '</span><b class="dp-mr-v">' + esc(r.v) + '</b>'
        + (r.u ? '<span class="dp-mr-u">' + esc(r.u) + '</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  function mietrechtStil() {
    if (el('dp-mr-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-mr-stil';
    s.textContent = [
      '.dp-mr{display:flex;flex-direction:column;gap:0;border:1px solid #E6E0D3;border-radius:10px;overflow:hidden;background:#fff}',
      '.dp-mr-z{display:grid;grid-template-columns:150px minmax(0,auto) 1fr;gap:4px 14px;align-items:baseline;padding:9px 14px;border-top:1px solid #EFEBE3;font-size:13px}',
      '.dp-mr-z:first-child{border-top:none}',
      '.dp-mr-k{font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:#7A7370}',
      '.dp-mr-v{font-family:"Space Grotesk",sans-serif;font-weight:600;color:#2A2727;white-space:nowrap}',
      '.dp-mr-u{color:#6B6356;font-size:12px;line-height:1.45}',
      '.dp-mr-warn .dp-mr-k::after{content:" ⚠";color:var(--wl-b8932f, #b8932f)}',
      '.dp-mr-bad{background:color-mix(in srgb,#B8625C 7%,#fff)}',
      '.dp-mr-bad .dp-mr-v{color:#B8625C}',
      '.dp-mr-eng .dp-mr-z{grid-template-columns:130px 1fr;}',
      '.dp-mr-eng .dp-mr-u{grid-column:2}',
      '.dp-mr-liste{margin-top:10px;border:1px solid #E6E0D3;border-radius:10px;overflow:hidden;background:#fff}',
      '.dp-mr-w{padding:8px 12px;border-top:1px solid #EFEBE3}',
      '.dp-mr-w:first-child{border-top:none}',
      '.dp-mr-w1{display:flex;gap:10px;align-items:baseline;font-size:12.5px}',
      '.dp-mr-w1 b{font-family:"Space Grotesk",sans-serif;font-weight:600;color:#2A2727;white-space:nowrap}',
      '.dp-mr-w1 span{white-space:nowrap;color:#6B6356}',
      '.dp-mr-w1 .dp-mr-w-v{margin-left:auto;color:#2A2727;font-weight:600}',
      '.dp-mr-w2{font-size:11.5px;color:#7A7370;line-height:1.45;margin-top:2px}',
      '.dp-mr-w.dp-mr-bad .dp-mr-w2 b{color:#B8625C}',
      '@media(max-width:700px){.dp-mr-z{grid-template-columns:1fr}.dp-mr-v{white-space:normal}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* Karte im Tab Miete, direkt unter dem Mietvertrag (#mv-objekt-karte). */
  function mietrechtKarte() {
    var anker = el('mv-objekt-karte'); if (!anker || !anker.parentNode) return;
    mietrechtStil();
    var k = el('dp-mietrecht-karte');
    if (!k) {
      k = document.createElement('div'); k.className = 'card'; k.id = 'dp-mietrecht-karte'; k.style.marginBottom = '14px';
      anker.parentNode.insertBefore(k, anker.nextSibling);
    }
    var m = modell();
    var ort = wert('ort');
    var kopf = '<div class="ct ct-pro"><span class="ct-ico"><svg width="22" height="22"><use href="#i-doc"/></svg></span>Mietrecht an dieser Adresse'
      + '<span class="oe-ct-hint">' + esc(ort || 'Ort fehlt') + ' · aus den Landesverordnungen</span></div>';
    if (m.art === 'mfh') {
      var W = m.wohnungen || [];
      /* v3062b · je Wohnung zwei Zeilen statt einer Tabelle: die Karte steht im Tab Miete in der
         schmalen rechten Spalte (gemessen ~390 px), dort brach „8,43 €/m²" um. */
      var zeilen = W.map(function (w, j) {
        var d = mietrechtDaten(m, j);
        var naechst = d.zeilen.filter(function (r) { return r.k === 'Nächste Erhöhung'; })[0];
        var ziel = d.zeilen.filter(function (r) { return r.k === 'Zielmiete'; })[0];
        var istQm = w.ist > 0 && w.wfl > 0 ? eur2(w.ist / w.wfl) + '/m²' : (w.status === 'leer' ? 'leer' : '—');
        return '<div class="dp-mr-w' + (ziel ? ' dp-mr-bad' : '') + '">'
          + '<div class="dp-mr-w1"><b>' + esc(w.nr) + (w.lage ? ' · ' + esc(w.lage) : '') + '</b><span>' + istQm + '</span>'
          + '<span class="dp-mr-w-v">' + esc(naechst ? naechst.v : '—') + '</span></div>'
          + '<div class="dp-mr-w2">' + esc(naechst && naechst.u ? naechst.u : '')
          + (w.ziel_qm ? '<br>Zielmiete ' + eur2(w.ziel_qm) + '/m²' + (ziel ? ' — <b>über der Mietpreisbremse</b> (höchstens ' + eur2(d.obergrenze) + '/m², außer § 556e/§ 556f)' : '') : '') + '</div></div>';
      }).join('');
      k.innerHTML = kopf + mietrechtHtml({ kappung: m.kappung, vgl: m.vgl, wohnungen: [] }, 0)
        + (W.length ? '<div class="dp-mr-liste">' + zeilen + '</div><p class="hint" style="margin:6px 0 0">Ändern je Wohnung im Fenster „Einheiten erfassen“ › Details.</p>' : '');
      return;
    }
    k.innerHTML = kopf + mietrechtHtml(m, 0);
  }

  /* ── Gemeindeschlüssel ────────────────────────────────────────────────
     Kommt aus dem Marktbericht-Dienst (/wertparameter/zinssatz, dieselbe
     Auflösung PLZ → Gemeinde wie im Bericht) und reist mit dem Ergebnis im
     Objekt, damit die Kappungsgrenze beim nächsten Öffnen ohne Abruf steht. */
  var _agsLauf = {};
  function agsJetzt() { var p = window._dpPotenzial; return (p && p.ags && p.plz === wert('plz')) ? p.ags : null; }
  function agsHolen() {
    var plz = wert('plz');
    if (!plz) return Promise.resolve(null);
    var schon = agsJetzt(); if (schon) return Promise.resolve(schon);
    if (_agsLauf[plz]) return _agsLauf[plz];
    if (!window.Auth || typeof Auth.apiCall !== 'function') return Promise.resolve(null);
    _agsLauf[plz] = Auth.apiCall('/marktbericht/wertparameter/zinssatz', { method: 'POST',
      body: { object: { plz: plz, ort: wert('ort'), objart: wert('objart'), baujahr: wert('baujahr'), einheiten: wert('einheiten'), wfl: wert('wfl') } } })
      .then(function (r) {
        var a = r && r.ags ? String(r.ags) : null;
        if (a) { window._dpPotenzial = Object.assign({}, window._dpPotenzial || {}, { ags: a, plz: plz }); }
        return a;
      }).catch(function () { return null; });
    return _agsLauf[plz];
  }

  /* ── Punkte (Anlage 2) ─────────────────────────────────────────────── */
  function M() { return window.DpMfhEinheiten || {}; }
  function maxP(g) { return (M().maxPunkte ? M().maxPunkte(g) : 2); }
  function katalog(id) { return MASSNAHMEN.filter(function (m) { return m.id === id; })[0] || null; }
  /** Heutige Punkte eines Gewerks: in der Wohnung (eigen, sonst Haus) oder am Objekt. */
  /* v2966 · N80 · GEMESSEN Parkstr. 9 (26.10.2026): im Reiter Objekt Heizung, Leitungen, Bäder,
     Innenausbau „< 5 Jahre" (mod_punkte 8 - damit rechnet der Dienst die RND im Bestand), im MFH-Fenster
     stand der Gebaeude-Zustand aber auf „nicht modernisiert". Der Chip bot +2 fuer Heizung an, die schon
     im Bestand zaehlt - doppelt. Heute gilt deshalb das Hoehere aus Wohnung/Gebaeude und Objektfeld:
     dieselbe Basis, auf die der Dienst den Gewinn aufschlaegt. */
  function punkteJetzt(gewerk, e, geb) {
    var MM = M(), p = 0;
    if ((e || geb) && MM.punkteVon) p = MM.punkteVon(gewerk, (e && e.mod && e.mod[gewerk]) || (geb && geb[gewerk]) || '0');
    if (MM.punkteObjekt) { var o = wert('mod_' + gewerk); if (o) p = Math.max(p, MM.punkteObjekt(gewerk, o) || 0); }
    return p;
  }
  /** Gewinn an Punkten aus einer Maßnahmenliste: je Gewerk höchstens bis zum
      Anlage-2-Maximum, nie doppelt gezählt. */
  function punkteGewinn(liste, e, geb, nurBewohnt) {
    var je = {};
    (liste || []).forEach(function (m) {
      if (nurBewohnt && !m.bewohnt) return;
      var k = katalog(m.id); var g = k && k.gewerk;
      if (!g) return;
      /* v2938 · Teilmaßnahme (k.max, z. B. Elektrik 1 von 2) zählt nur ihren Teil; mehrere
         Maßnahmen desselben Elements: das Höchste, nie die Summe über das Maximum */
      var ziel = k.max != null ? Math.min(maxP(g), k.max) : maxP(g);
      je[g] = Math.max(je[g] || 0, Math.max(0, ziel - punkteJetzt(g, e, geb)));
    });
    return Object.keys(je).reduce(function (a, g) { return a + je[g]; }, 0);
  }

  /* ── Maßnahmen einer Wohnung: alte Felder → neue Liste ────────────────
     Bis v2429 trug eine Wohnung EIN Textfeld `massnahme` und EINE Zahl
     `kosten`. Sie werden beim Lesen zur Liste; beim Speichern schreibt das
     Wohnungsfenster beide alten Felder mit (Titel verbunden, Summe), damit
     jeder alte Leser (Summenzeile, Bank-PDF, Prompt) weiter stimmt. */
  /* v2938/v2938a · FREITEXT -> KATALOG. Gemessen Parkstr. 9: „Bad, Böden, Elektro“ stand als
     EINE Maßnahme „Sonstiges“ (alter Text, beim Speichern in die Liste übernommen) und brachte
     0 Modernisierungspunkte - die RND blieb im Zielbild bei 11,8 J., obwohl Bäder und Innenausbau
     nach Anlage 2 modernisiert werden. Erkannte Begriffe werden zu Katalog-Maßnahmen, die Kosten
     gleichmäßig verteilt (Summe bleibt). Gilt für das alte Textfeld UND für „Sonstiges“ in der Liste;
     eine echte Katalog-Maßnahme bleibt, wie sie ist. */
  var WORT = [[/bad|sanit/i, 'bad'], [/b(ö|oe)den|boden|innenausbau|decke|treppe/i, 'boeden'], [/fenster|t(ü|ue)r/i, 'fenster'],
    [/elektr|strom/i, 'elektrik'], [/leitung|wasser|abwasser|gasleitung/i, 'leitungen'], [/heiz/i, 'heizung'], [/dach/i, 'dach'],
    [/fassade|d(ä|ae)mm|au(ß|ss)enwand|wdvs/i, 'fassade'], [/grundriss/i, 'grundriss'], [/k(ü|ue)che/i, 'kueche'], [/renov|maler|tapez/i, 'renovierung']];
  function textZuKatalog(t, k, bewohnt) {
    var ids = [];
    String(t || '').split(/[,;\/+&]|\bund\b/i).forEach(function (teil) {
      WORT.forEach(function (w) { if (w[0].test(teil) && ids.indexOf(w[1]) < 0) ids.push(w[1]); });
    });
    if (!ids.length) return null;
    var je = k ? Math.floor(k / ids.length) : 0;
    return ids.map(function (id, i) {
      var kk = katalog(id);
      return { id: id, t: kk ? kk.t : id, k: k ? (i === ids.length - 1 ? k - je * (ids.length - 1) : je) : 0, bewohnt: !!bewohnt, alt: true };
    });
  }
  function massnahmenVon(e) {
    if (!e) return [];
    if (Array.isArray(e.massnahmen)) {
      var aus = [];
      e.massnahmen.forEach(function (m) {
        if (!m || !(m.id || m.t)) return;
        var z = (m.id === 'sonst' && m.t) ? textZuKatalog(m.t, zahl(m.k), m.bewohnt) : null;
        if (z) aus = aus.concat(z); else aus.push(m);
      });
      return aus;
    }
    var t = String(e.massnahme || '').trim(), k = zahl(e.kosten);
    if (!t && !k) return [];
    return textZuKatalog(t, k, false) || [{ id: 'sonst', t: t || 'Maßnahme', k: k, bewohnt: false, alt: true }];
  }
  function massnahmenSpiegeln(e) {
    var l = massnahmenVon(e);
    e.massnahmen = l.map(function (m) { var c = Object.assign({}, m); delete c.alt; return c; });
    e.massnahme = l.map(function (m) { return m.t; }).join(', ');
    var k = l.reduce(function (a, m) { return a + zahl(m.k); }, 0);
    e.kosten = k ? String(Math.round(k)) : '';
    return e;
  }

  /* ── § 558 / § 559: die Soll-Miete einer Wohnung ─────────────────────── */
  /* v3075 · TERMINE, § 559-UMLAGE, VERTRAGSGRENZEN UND SOLL-MIETE liegen in js/mietpotenzial-kern.js
     (woertlich, mit dem Gesetzeswortlaut aus v3028/v3001/v3016t). Der Quick-Check rechnet damit die
     zulaessige Miete nach drei Jahren - EINE Rechnung fuer Objekt und Quick-Check. Die Namen bleiben,
     damit alle Aufrufer in dieser Datei und DpPotenzial unveraendert lesen. */
  var plusMonate = K.plusMonate, TERMIN_REGEL = K.TERMIN_REGEL, mmjj = K.mmjj;
  var wirksamNachZugang = K.wirksamNachZugang, mhTermine = K.mhTermine;
  var umlage559 = K.umlage559, vertragGrenzen = K.vertragGrenzen;
  /* v3026 · Indexmiete (§ 557b BGB): mögliche Anpassung je Jahr aus dem VPI. Rechnet der Kern
     js/indexmiete.js; die VPI-Reihe kommt aus js/indexreihen.js (Server-Cache, nie GENESIS),
     die Zukunftsannahme aus dem Investmentprofil (indexmiete_vpi_pct, Vorgabe 2,0 % p. a.).
     Ändert nichts an sollFuer: bei Index bleibt § 558/§ 559 aus (vertragGrenzen). */
  function indexAnnahme() {
    var P = window.DealPilotInvestmentProfile, a = null;
    try { a = P && P.get ? P.get('indexmiete_vpi_pct') : null; } catch (x) {}
    var n = (a == null || a === '') ? NaN : Number(String(a).replace(',', '.'));
    return isFinite(n) && n > -5 && n < 15 ? n : null;
  }
  function indexmieteFuer(e) {
    var I = window.DpIndexmiete;
    if (!I || !e || vertragGrenzen(e).art !== 'index' || e.status === 'leer') return null;
    var R = window.DpIndexreihen, vpi = R && R.reihe ? R.reihe('vpi') : null;
    return I.rechne({ miete: zahl(e.ist), beginn: e.mv_beginn, letzte: e.mv_letzte_erhoehung, vpi: vpi, annahme_pct: indexAnnahme() });
  }
  /* v3075 · Rechnung im Kern; hier kommt nur die Katalog-Aufloesung der Massnahmen dazu. */
  function sollFuer(e, ctx) {
    return K.sollFuer(e, Object.assign({}, ctx || {}, { massnahmenVon: massnahmenVon }));
  }

  /* ── Das Modell: Wohnungen und Stufen ───────────────────────────────── */
  /* v3150 · N114 Punkt 2 (Marcel 03.11.2026): die Mieterhöhung nach § 558 endet an der ORTSÜBLICHEN
     VERGLEICHSMIETE, nicht an der Neuvermietungsmiete. Deshalb der Mietspiegel VOR der Marktmiete;
     die Marktmiete bleibt nur Ersatz und ist markiert (marktmiete: true) - der Wertkern nimmt dann
     die marktübliche Miete der Wertermittlung statt ihrer (PotenzialService stufe558). */
  /* v3244 · NEUE RANGFOLGE (Prüfer-Befund 09.11.2026, Bismarckstr. 27 Detmold):
       1 eigene Vergleichsmiete (zb_vgl_qm)
       2 amtliche ortsübliche Vergleichsmiete am Objekt (_dpMarktdaten.vergleichsmiete, gemerkt aus dem
         Marktbericht bzw. der Pilot-Recherche: Mietpreisübersicht des Gutachterausschusses, oder ein
         Mietspiegel mit art 'mietspiegel_qualifiziert' | 'mietspiegel_einfach', sobald eine Quelle das liefert)
       3 Marktmiete (ds2_marktmiete) nur als markierter Ersatz - und NIE, wenn ein qualifizierter
         Mietspiegel vorliegt (dann zählt dessen Wert, ein Angebotswert ist kein Begründungsmittel).
     me_soll („Soll-Mietspiegel", Tab Miete) ist RAUS: das Einheitenfenster schreibt dort den Durchschnitt
     der eigenen Soll-Mieten hinein (mfh-einheiten.js uebernehmen), also Angebots-/Zielniveau - die Erhöhung
     maß sich damit an sich selbst. Ob der Wert von Hand oder vom Fenster stammt, ist am Feld nicht zu
     erkennen; deshalb zählt er für § 558 gar nicht mehr. Er bleibt Eingabe der Mietentwicklung (Detail). */
  var VGL_ART = { mietspiegel_qualifiziert: 'qualifizierter Mietspiegel (§ 558d BGB)', mietspiegel_einfach: 'einfacher Mietspiegel (§ 558c BGB)',
    mietpreisuebersicht: 'amtliche Mietpreisübersicht des Gutachterausschusses' };
  function amtlicheVgl() {
    var md = window._dpMarktdaten, v = md && md.vergleichsmiete;
    if (!v || !(zahl(v.qm) > 0)) return null;
    /* v3245 · nur amtliche Arten (Mietspiegel, Mietpreisuebersicht). Ohne Art stammt der Eintrag aus v3158 (mietrecht()
       merkte dort die GENUTZTE Vergleichsmiete, oft die Marktmiete) - gemessen 09.11.: Bismarckstr. 10,72 als „amtlich“. */
    if (!VGL_ART[v.art]) return null;
    if (md.fuer && window._currentObjKey && md.fuer !== window._currentObjKey) return null;
    return v;
  }
  function objektVgl() {
    var v = zahl(wert('zb_vgl_qm'));
    if (v > 0) return { qm: v, herkunft: 'eigene Angabe (Tab Investition)', art: 'eigen' };
    var a = amtlicheVgl();
    if (a) {
      var t = VGL_ART[a.art] || 'amtliche Vergleichsmiete';
      return { qm: zahl(a.qm), art: a.art || 'amtlich', qualifiziert: a.art === 'mietspiegel_qualifiziert',
        herkunft: t + (a.quelle ? ' — ' + a.quelle : '') + ((a.datum || a.stand) ? ', Stand ' + deDatum(String(a.datum || a.stand).slice(0, 10)) : '') + (a.ausserhalb ? ', außerhalb der Tabelle' : '') };
    }
    v = zahl(wert('ds2_marktmiete'));
    if (v > 0) return { qm: v, herkunft: 'Marktmiete (Tab Miete) — Ersatz, keine ortsübliche Vergleichsmiete', marktmiete: true, art: 'marktmiete' };
    return { qm: 0, herkunft: null };
  }
  /* v3150 · der Teil der Soll-Miete nach § 558 (ohne Modernisierungsumlage § 559).
     v3244 · Rechnung im Kern (teil558): bei Staffel/Index/Gewerbe ist er Ist. */
  function soll558(w) { return w ? K.teil558(w.soll, w.ist) : 0; }
  /* v3244 · die vertragliche Erhöhung (Staffel/Index/Gewerbe, eigene Soll-Angabe) als eigener Posten */
  function sollVertrag(w) { return w ? K.teilVertrag(w.soll, w.ist) : null; }
  /* v3244 · Miete der Stufe Mieterhöhung je Wohnung: § 558-Anteil plus vertragliche Erhöhung */
  function mhMiete(w) { var v = sollVertrag(w); return soll558(w) + (v ? v.plus : 0); }
  function vertragZeileV(so, ist, qm) {
    var v = K.teilVertrag(so, ist);
    return v && v.plus > 0 ? 'nach Vertrag auf ' + eur(v.monat) + '/Monat' + (qm ? qm(v.monat) : '') : 'nach Vertrag';
  }
  function vertragZeileU(so) {
    var v = K.teilVertrag(so, 0);
    return v ? v.norm + ' — keine Erhöhung nach § 558 BGB' + (v.monat ? ' · Betrag: eigene Angabe' : ' · ' + (so.grund || v.text)) : (so.grund || '');
  }
  function artMitEinheiten() { return !!(M().artMitEinheiten && M().artMitEinheiten()); }
  function objektMassnahmen() { try { var l = JSON.parse(wert('zb_massnahmen') || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } }

  /**
   * modell(opts) — rechnet nichts Wertrechtliches, stellt zusammen.
   * opts.einheiten / gebaeude / aufgeteilt / aufteilungskosten: Arbeitsstand
   * des MFH-Fensters (sonst der gespeicherte `_dpMfh`).
   */
  function modell(opts) {
    opts = opts || {};
    var ags = agsJetzt();
    var kapp = kappung(ags);
    var vg = objektVgl();
    var ctx = { kapp: kapp, vgl_qm: vg.qm, vgl_herkunft: vg.herkunft };
    var D = window._dpMfh || {};
    var liste = opts.einheiten || (artMitEinheiten() && Array.isArray(D.einheiten) ? D.einheiten : null);
    var geb = opts.gebaeude || D.gebaeude || {};
    var out = { art: liste && liste.length ? 'mfh' : 'einzel', kappung: kapp, vgl: vg, wohnungen: [],
                hat_soll: false, hat_ziel: false, kennzeichnung: KENNZEICHNUNG };
    if (liste && liste.length) {
      var flSum = 0;
      /* v2966 · N80 · Massnahmen am ganzen Haus. Jede Wohnung traegt ihren FLAECHENANTEIL der Kosten
         (Summe = Hauskosten, ungerundet) und das Gewerk fuer ihre Punkte; punkteGewinn nimmt je Gewerk
         das Hoechste aus Wohnungs- und Hausmassnahme (Elektrik 1 + Leitungen 2 = 2, nie 3). Bewohnt
         modernisiert: der Anteil geht in die § 559-Umlage der Wohnung. Der Gebaeude-Zustand bleibt
         der Ausgangspunkt (heute), die Massnahme ist das Ziel. */
      var hausL = (opts.haus_massnahmen || D.haus_massnahmen || []).filter(function (m) { var k = m && katalog(m.id); return k && k.haus; });
      var flAll = liste.reduce(function (a, e) { return a + ((e && (zahl(e.wfl) > 0 || zahl(e.ist) > 0)) ? zahl(e.wfl) : 0); }, 0);
      out.haus = { massnahmen: hausL.map(function (m) { return { id: m.id, t: m.t, k: zahl(m.k), bewohnt: !!m.bewohnt, erh: zahl(m.erh) }; }),
        kosten: hausL.reduce(function (a, m) { return a + zahl(m.k); }, 0) };
      out.wohnungen = liste.map(function (e, i) { return { e: e, i: i }; }).filter(function (o) { return o.e && (zahl(o.e.wfl) > 0 || zahl(o.e.ist) > 0); }).map(function (o) {
        var e = o.e, i = o.i;
        var wfl = zahl(e.wfl), ist = e.status === 'leer' ? 0 : zahl(e.ist);
        var anteil = flAll > 0 ? wfl / flAll : 0;
        var mlEigen = massnahmenVon(e);
        var ml = mlEigen.concat(hausL.map(function (m) { return { id: m.id, t: m.t, k: zahl(m.k) * anteil, bewohnt: !!m.bewohnt, erh: zahl(m.erh), haus: true }; }));
        var s = sollFuer(hausL.length ? Object.assign({}, e, { massnahmen: ml }) : e, ctx);
        var zielQm = zahl(e.ziel_qm);
        var zielM = zielQm > 0 && wfl > 0 ? zielQm * wfl : 0;
        var kAlle = ml.reduce(function (a, m) { return a + zahl(m.k); }, 0);
        var kBew = ml.filter(function (m) { return m.bewohnt; }).reduce(function (a, m) { return a + zahl(m.k); }, 0);
        flSum += wfl;
        if (s.miete != null && s.miete > ist) out.hat_soll = true;
        if (zielM > 0 || ml.length) out.hat_ziel = true;
        return { i: i, nr: e.nr || String(i + 1), lage: e.lage || '', art: e.art || 'wohnen', wfl: wfl, zimmer: zahl(e.zimmer) || null,
          status: e.status || 'vermietet', ist: ist, soll: s, ziel: zielM || null, ziel_qm: zielQm || null, ziel_wann: e.ziel_wann || '',
          massnahmen: mlEigen, kosten: kAlle, kosten_bewohnt: kBew, mea: zahl(e.mea_anteil) || null,
          kosten_haus: ml.filter(function (m) { return m.haus; }).reduce(function (a, m) { return a + m.k; }, 0),   /* v2966 */
          plus_soll: Math.min(20, punkteGewinn(ml, e, geb, true)), plus_ziel: Math.min(20, punkteGewinn(ml, e, geb, false)),
          vgl_qm: s.vgl_qm || null, index: indexmieteFuer(e),   /* v3026 */
          letzte: e.mv_letzte_erhoehung || null, letzte_betrag: zahl(e.mv_letzte_erhoehung_betrag) || null, mv_art: e.mv_art || null };   /* v3150 */
      });
      out.wfl = flSum;
      out.aufgeteilt = opts.aufgeteilt != null ? !!opts.aufgeteilt : !!D.aufgeteilt;
      var nWohnen = out.wohnungen.filter(function (w) { return w.art !== 'gewerbe'; }).length;
      var ak = opts.aufteilungskosten != null ? opts.aufteilungskosten : D.aufteilungskosten;
      out.aufteilungskosten = (ak != null && String(ak).trim() !== '') ? zahl(ak) : nWohnen * AUFTEILUNG_JE_WE;
      out.aufteilungskosten_herkunft = (ak != null && String(ak).trim() !== '') ? 'eigene Angabe'
        : 'Vorbelegung ' + AUFTEILUNG_JE_WE.toLocaleString('de-DE') + ' € je Wohnung (Notar, Grundbuch, Teilungserklärung, Abgeschlossenheit) — bitte prüfen';
    } else {
      var wflO = zahl(wert('wfl')), istO = zahl(wert('nkm'));
      var eO = { ist: istO, wfl: wflO, status: istO > 0 ? 'vermietet' : 'leer',
        soll: zahl(wert('zb_soll_qm')) > 0 && wflO > 0 ? zahl(wert('zb_soll_qm')) * wflO : 0,
        soll_ab: wert('zb_soll_ab'), vgl_qm: 0, mv_letzte_erhoehung: wert('mv_letzte_erhoehung'), mv_letzte_erhoehung_betrag: wert('mv_letzte_erhoehung_betrag'),
        mv_art: wert('mv_art'), mv_beginn: wert('mv_beginn'),   /* v3026 · bis hier sah die Objektebene ihre Vertragsart nicht */
        massnahmen: objektMassnahmen() };
      var sO = sollFuer(eO, ctx);
      var zQ = zahl(wert('zb_ziel_qm'));
      var mlO = eO.massnahmen;
      out.wfl = wflO;
      out.wohnungen = [{ i: 0, nr: '', lage: '', art: 'wohnen', wfl: wflO, status: eO.status, ist: istO, soll: sO,
        ziel: zQ > 0 && wflO > 0 ? zQ * wflO : null, ziel_qm: zQ || null, ziel_wann: wert('zb_ziel_wann'),
        massnahmen: mlO, kosten: mlO.reduce(function (a, m) { return a + zahl(m.k); }, 0),
        kosten_bewohnt: mlO.filter(function (m) { return m.bewohnt; }).reduce(function (a, m) { return a + zahl(m.k); }, 0),
        plus_soll: Math.min(20, punkteGewinn(mlO, null, null, true)), plus_ziel: Math.min(20, punkteGewinn(mlO, null, null, false)),
        index: istO > 0 ? indexmieteFuer(eO) : null,   /* v3026 */
        letzte: eO.mv_letzte_erhoehung || null, letzte_betrag: zahl(eO.mv_letzte_erhoehung_betrag) || null, mv_art: eO.mv_art || null }];   /* v3150 */
      if (sO.miete != null && sO.miete > istO) out.hat_soll = true;
      if (zQ > 0 || mlO.length) out.hat_ziel = true;
    }
    /* Summen je Stufe. Mieterhöhung: Mieter bleiben (Leerstand bleibt leer).
       Zielbild: Zielmiete, sonst Soll, sonst Ist. */
    var W = out.wohnungen, fl = out.wfl || 0;
    function gew(k) { return fl > 0 ? W.reduce(function (a, w) { return a + (w[k] || 0) * w.wfl; }, 0) / fl : 0; }
    var istS = W.reduce(function (a, w) { return a + w.ist; }, 0);
    /* v3150 · N114 Punkt 1: die Stufe Mieterhöhung ist der Bestand mit den Erhöhungen nach § 558 BGB -
       geplante Modernisierungen (Kosten, Umlage § 559, Punkte und damit eine längere RND) gehören ins Zielbild */
    /* v3244 · § 558 nur, wo § 558 gilt; die vertragliche Erhöhung (Staffel/Index/Gewerbe) steht als eigener
       Posten in derselben Stufe (Mieter bleibt), damit die Summe nicht still kleiner wird */
    var s558 = W.reduce(function (a, w) { return a + soll558(w); }, 0);
    var sVer = W.reduce(function (a, w) { var v = sollVertrag(w); return a + (v ? v.plus : 0); }, 0);
    var sollS = s558 + sVer;
    var hat558 = W.some(function (w) { return mhMiete(w) > w.ist + 0.005; });
    var zielS = W.reduce(function (a, w) { return a + (w.ziel != null ? w.ziel : ((w.soll && w.soll.miete > w.ist) ? w.soll.miete : w.ist)); }, 0);
    out.stufen = {
      bestand: { miete_m: istS, kosten: 0, plus: 0 },
      mieterhoehung: hat558 ? { miete_m: sollS, kosten: 0, plus: 0, plus558_m: Math.round((s558 - istS) * 100) / 100, vertrag_m: Math.round(sVer * 100) / 100 } : null,   /* v3150, v3244 */
      zielbild: out.hat_ziel ? { miete_m: zielS, kosten: W.reduce(function (a, w) { return a + w.kosten; }, 0),
        plus: Math.round(gew('plus_ziel') * 10) / 10 } : null
    };
    out.aktiv = !!(out.hat_soll || out.hat_ziel);
    /* v3026 · Indexmiete: Summe je Haus (nur Wohnungen mit gerechneter Tabelle) */
    out.hat_index = W.some(function (w) { return !!w.index; });
    out.indexmiete = out.hat_index && window.DpIndexmiete ? window.DpIndexmiete.haus(W.map(function (w) { return w.index; })) : null;
    return out;
  }

  /* v3026 · Indexmiete - Tabellen je Wohnung und die Summe; '' ohne Indexvertrag */
  function indexmieteHtml(m) {
    m = m || modell();
    var I = window.DpIndexmiete;
    if (!I || !m.hat_index) return '';
    I.stil();
    var mehr = m.wohnungen.length > 1 || m.art === 'mfh';
    var t = m.wohnungen.filter(function (w) { return w.index; }).map(function (w) {
      return '<div class="dp-idx-wrap">' + I.tabelleHtml(w.index, mehr ? 'Wohnung ' + (w.nr || (w.i + 1)) + (w.lage ? ' · ' + w.lage : '') : 'Indexmiete (§ 557b BGB)') + '</div>';
    }).join('');
    var z = m.indexmiete ? '<div class="dp-zb-sum"><b>' + esc(I.zeileText(m.indexmiete)) + '</b></div>' : '';
    return '<div class="dp-idx-block" style="margin-top:10px">' + (mehr ? '<div class="dp-idx-t">Indexmiete (§ 557b BGB) je Wohnung</div>' : '') + t + z + '</div>';
  }
  /** v3026 · für Pilot-Prompt, Pilot-Analyse und PDF: null ohne Indexvertrag */
  function indexmieteDaten() {
    var m = modell(), I = window.DpIndexmiete;
    if (!m.hat_index || !I) return null;
    var R = window.DpIndexreihen, v = R && R.reihe ? R.reihe('vpi') : null;
    return {
      zeile: m.indexmiete ? I.zeileText(m.indexmiete) : null,
      haus: m.indexmiete,
      vpi_stand: v ? { bis: v.bis, abgerufen_am: v.abgerufen_am || null } : null,
      wohnungen: m.wohnungen.filter(function (w) { return w.index; }).map(function (w) {
        var x = w.index;
        return { nr: w.nr || String(w.i + 1), lage: w.lage || '', ok: !!x.ok, fehlt: x.ok ? null : x.fehlt,
          miete_heute: x.miete || null, basis: x.basis || null,
          schritte: x.ok ? x.schritte.map(function (s) { return { jahr: Number(s.wirksam.slice(0, 4)), wirksam_ab: s.wirksam, erklaerung_bis: s.erklaerung,
            indexmonat: s.indexmonat, index: s.index, annahme: s.annahme, miete_neu: s.miete_neu, plus_monat: s.plus_monat, plus_jahr: s.plus_jahr }; }) : [] };
      }),
      annahme: m.indexmiete ? (m.indexmiete.annahme ? 'Zukunftswerte = Annahme ' + m.indexmiete.annahme_pct + ' % VPI p. a., kein amtlicher Wert' : null) : null
    };
  }

  /* ── Abruf beim Marktbericht-Dienst ─────────────────────────────────── */
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0); }
  function auftrag(m, opts) {
    var obj = (window.DealPilotMB && typeof window.DealPilotMB.inputs === 'function') ? window.DealPilotMB.inputs() : null;
    if (!obj) return null;
    if (opts && opts.einheiten) {
      obj._mfh_einheiten = opts.einheiten.map(function (e) {
        /* v2820 · Nummer und Lage reisen mit: ohne sie nannte die Nutzungsart-Nachfrage
                   im Bericht „GE 1" statt der Einheit, wie sie im Formular heisst */
          return { nr: e.nr || null, lage: e.lage || null, art: e.art || 'wohnen', wfl: e.wfl, ist: e.ist, soll: e.soll, status: e.status || 'vermietet',
                 nutzung_gew: e.nutzung_gew || null, markt_qm: e.markt_qm || null,
                   /* v2600 · E2/E3 · Restlaufzeit der Mietabweichung, waehlbarer Leerstandsabzug */
                   mv_art: e.mv_art || null, mv_befristet_bis: e.mv_befristet_bis || null, mv_kuendigungsverzicht_bis: e.mv_kuendigungsverzicht_bis || null,
                   mv_abw_jahre: e.mv_abw_jahre || null, leer_abzug: e.leer_abzug === true, leer_monate: e.leer_monate || null, herrichtung_eur: e.herrichtung_eur || null,
                   /* v3150 · Wartefrist und Kappungs-Anrechnung reisen auch im Arbeitsstand des Fensters mit */
                   mv_letzte_erhoehung: e.mv_letzte_erhoehung || null, mv_letzte_erhoehung_betrag: e.mv_letzte_erhoehung_betrag || null };
      });
      /* v2487 · GEMESSEN (Mitschnitt-Lauf Modul 26, neues MFH): im Wohnungsfenster VOR dem
         ersten „Übernehmen" sind Wohnfläche und Kaltmiete im Reiter Objekt noch leer - der
         Dienst rechnete keinen Ertragswert (verfuegbar false, „es fehlen Pflichtangaben"), das
         Fenster zeigte nur „Die Angaben haben sich geändert". Leere Felder werden aus den
         Einheiten gefüllt, genau wie uebernehmen() sie gleich schreiben wird (Fläche aller,
         Ist der vermieteten). Ein gesetztes Feld bleibt unberührt. */
      var flS = 0, istS = 0, nW = 0;
      opts.einheiten.forEach(function (e) { flS += zahl(e.wfl); if (e.art !== 'gewerbe') nW++; if (e.status !== 'leer') istS += zahl(e.ist); });
      if (!(zahl(obj.wfl) > 0) && flS > 0) obj.wfl = flS;
      if (!(zahl(obj.nkm) > 0) && istS > 0) obj.nkm = String(Math.round(istS * 100) / 100);
      if (!(zahl(obj.einheiten) > 0) && nW > 0) obj.einheiten = String(nW);
    }
    var istW = function (w) { return w.art === 'gewerbe' ? 0 : 1; };
    var wohnMiete = function (k) {
      return m.wohnungen.reduce(function (a, w) {
        if (!istW(w)) return a;
        var x = k === 'bestand' ? w.ist : (k === 'mieterhoehung'
          ? mhMiete(w)   /* v3150, v3244: § 558 plus vertragliche Erhöhung, wie die Stufe */
          : (w.ziel != null ? w.ziel : ((w.soll && w.soll.miete > w.ist) ? w.soll.miete : w.ist)));
        return a + x;
      }, 0) * 12;
    };
    var varianten = [];
    ['mieterhoehung', 'zielbild'].forEach(function (k) {
      var s = m.stufen[k]; if (!s) return;
      varianten.push({ key: k, miete_wohnen_jahr: Math.round(wohnMiete(k)), mod_punkte_plus: s.plus, kosten: Math.round(s.kosten) });
    });
    /* v2431 · die Objektkennung: an ihr haengt ein schon vorliegender Bericht Stufe 3 */
    var body = { object: obj, varianten: varianten, external_ref: (typeof window._currentObjKey === 'string' && window._currentObjKey) || null };
    /* v2988 · eigene Angabe „Marktübliche Miete nach Modernisierung" (€/m²) - nur gesetzt im Auftrag,
       damit der Pruefwert aller Objekte ohne dieses Feld gleich bleibt */
    var _zmq = zahl(wert('zb_markt_qm'));
    if (_zmq > 0) body.zielbild_markt_qm = Math.round(_zmq * 100) / 100;
    /* v3150 · N114 · je Wohnung: ortsübliche Vergleichsmiete (Ziel der Stufe), ihre Herkunft, die
       Soll-Miete nach § 558 und die Erhöhungshistorie - der Wertkern rechnet den Pfad selbst */
    /* v3152 · N117 · Stufe Neuvermietung: die Neuvermietungsmiete der Wohnung im HEUTIGEN Zustand =
       Mitte des aktuellen Marktdurchschnitts (nicht die obere Spanne - die gilt für saniert), sonst die
       Marktmiete aus dem Reiter Miete; gedeckelt durch die Mietpreisbremse (Kern neuvermietung). */
    var _ms = marktSaniert(m), _br = mietpreisbremse(agsJetzt());
    /* v3158 · was hier gilt, am Objekt merken (Schnittstelle, Export) - Kappung, Mietpreisbremse, Marktmiete */
    try {
      if (window.dpMarktdatenMerken) {
        var _kp = kappung(agsJetzt());
        window.dpMarktdatenMerken({
          kappung: _kp ? Object.assign({ ags: agsJetzt() }, _kp) : null,   /* ganze Auskunft des Kerns (Satz, Gebiet, Frist, Quelle) */
          mietpreisbremse: _br ? Object.assign({ ags: agsJetzt() }, _br) : null,   /* gilt: true | false | null (= bitte prüfen) */
          marktmiete: _ms ? { qm: _ms.qm != null ? _ms.qm : null, mitte_qm: _ms.mitte != null ? _ms.mitte : null, art: _ms.art || null, herkunft: _ms.art === 'eigen' ? 'eigene Angabe' : 'aktueller Marktdurchschnitt' } : null
        });
      }
    } catch (e) {}
    var _nvQm = _ms && _ms.art !== 'eigen' && _ms.mitte > 0 ? _ms.mitte : zahl(wert('ds2_marktmiete'));
    var _nvHer = _ms && _ms.art !== 'eigen' && _ms.mitte > 0 ? 'aktueller Marktdurchschnitt (Mitte)' : (_nvQm > 0 ? 'Marktmiete (Tab Miete)' : null);
    var nv = function (w) {
      if (!(_nvQm > 0) || !(w.wfl > 0) || w.art === 'gewerbe' || !K || !K.neuvermietung) return {};
      var vq = w.soll && w.soll.vgl_qm > 0 ? w.soll.vgl_qm : zahl(m.vgl && !m.vgl.marktmiete ? m.vgl.qm : 0);
      var r = K.neuvermietung({ markt_qm: _nvQm, wfl: w.wfl, vgl_qm: vq, bremse: _br });
      return r ? { neu_jahr: Math.round(r.jahr), neu_qm: r.qm, neu_herkunft: _nvHer, neu_bremse: r.text || null, neu_gedeckelt: !!r.gedeckelt } : {};
    };
    var d558 = function (w) {
      var vq = w.soll && w.soll.vgl_qm > 0 ? w.soll.vgl_qm : 0;
      var vh = w.soll ? w.soll.vgl_herkunft || null : null;
      var e = w.e || {};
      var vt = sollVertrag(w);
      var o = { vgl_jahr: vq > 0 && w.wfl > 0 ? Math.round(vq * w.wfl * 12) : null, vgl_herkunft: vh,
        vgl_marktmiete: !!(vq > 0 && vh && vh === m.vgl.herkunft && m.vgl.marktmiete),
        soll558_jahr: Math.round(soll558(w) * 12), letzte: w.letzte || null, letzte_betrag: w.letzte_betrag || null, mv_art: w.mv_art || null };
      /* v3244 · nur gesetzt bei Staffel/Index/Gewerbe mit eigener Soll-Angabe - der Prüfwert der übrigen bleibt */
      if (vt && vt.monat) o.soll_vertrag_jahr = Math.round(vt.monat * 12);
      return o;
    };
    if (m.art === 'mfh') {
      body.wohnungen = m.wohnungen.map(function (w) {
        var sm = (w.soll && w.soll.miete > w.ist) ? w.soll.miete : w.ist;
        var _e = w.e || {};   /* v3200 · Merkmale der Wohnung für den Vergleichswert (Aufteilerwert) */
        return Object.assign({ nr: w.nr, art: w.art, wfl: w.wfl, mea_pct: w.mea || null,
          lage: _e.lage || null, zimmer: zahl(_e.zimmer) || null, kueche: _e.aus_kueche || null, leer: _e.status === 'leer',
          miete_jahr: { bestand: Math.round(w.ist * 12), mieterhoehung: Math.round(mhMiete(w) * 12),
                        zielbild: Math.round((w.ziel != null ? w.ziel : sm) * 12) } }, d558(w), nv(w));   /* v3152 */
      });
      body.aufteilung = { aktiv: !!m.aufgeteilt, kosten_eur: Math.round(m.aufteilungskosten || 0), kosten_herkunft: m.aufteilungskosten_herkunft };
      body.aufzug = wert('eq_elevator') || null;   /* v3200 · ausdrücklich ja/nein - leer ist keine Aussage */
    } else if (m.wohnungen[0]) body.einzel558 = Object.assign(d558(m.wohnungen[0]), nv(m.wohnungen[0]));   /* v3150, v3152 */
    /* v3152 · N117 · Marcel 03.11.2026: „wir haben ein Feld Leerstand in Prozent, das könnte man nehmen" */
    var _lq = zahl(wert('leerstand'));
    if (_lq >= 0 && String(wert('leerstand') || '').trim() !== '') body.leerstand_pct = Math.round(_lq * 100) / 100;
    return body;
  }
  var _lauf = null;
  /** Ertragswerte holen. Gibt das Ergebnis zurück; legt es mit seinem
      Prüfwert in `window._dpPotenzial` ab (reist mit dem Objekt). */
  function rechnen(opts) {
    opts = opts || {};
    return kappungLaden().then(function () { return agsHolen(); }).then(function () {
      var m = modell(opts);
      if (!m.aktiv) return null;
      var body = auftrag(m, opts);
      if (!body) return null;
      var h = hash(JSON.stringify(body));
      var alt = window._dpPotenzial;
      /* v2431 · ein gespeicherter Ertragswert gilt einen Tag: aendert sich die
         Freigabe (Tarif, Testphase), fragt der naechste Tag den Dienst neu. */
      var frisch = alt && alt.stand && (Date.now() - Date.parse(alt.stand)) < 864e5;
      if (!opts.erzwingen && alt && alt.hash === h && alt.ergebnis && alt.ergebnis.verfuegbar && frisch) return alt.ergebnis;
      if (_lauf && _lauf.h === h) return _lauf.p;
      if (!window.Auth || typeof Auth.apiCall !== 'function') return null;
      var key = window._currentObjKey || null;
      var p = Auth.apiCall('/marktbericht/potenzial', { method: 'POST', body: body }).then(function (r) {
        _lauf = null;
        if (!r) return null;
        /* Gehört das Ergebnis noch zum offenen Objekt? Sonst verwerfen. */
        if ((window._currentObjKey || null) !== key) return r;
        window._dpPotenzial = { hash: h, stand: new Date().toISOString(), ags: r.ags || agsJetzt(), plz: wert('plz'),
          ergebnis: r, zusammenfassung: zusammenfassung(m, r) };
        try { window.dispatchEvent(new CustomEvent('dp:potenzial', { detail: { ergebnis: r } })); } catch (e) {}
        return r;
      }, function (e) { _lauf = null; return { verfuegbar: false, grund: (e && e.message) || 'Dienst nicht erreichbar' }; });
      _lauf = { h: h, p: p };
      return p;
    });
  }
  /** Das gespeicherte Ergebnis, wenn es zum heutigen Stand passt. */
  function ergebnis(opts) {
    var p = window._dpPotenzial;
    if (!p || !p.ergebnis) return null;
    try { var m = modell(opts); var b = auftrag(m, opts); if (b && hash(JSON.stringify(b)) === p.hash) return p.ergebnis; } catch (e) {}
    return null;
  }
  function ergebnisVeraltet() { var p = window._dpPotenzial; return !!(p && p.ergebnis) && !ergebnis(); }

  /** Ergebnis einer Wohnung (Originalindex in der Einheitenliste). Der Dienst
      fuehrt nur Wohnungen mit Flaeche, in derselben Reihenfolge. */
  function wohnungErgebnis(r, m, idx) {
    if (!r || !Array.isArray(r.wohnungen) || !m) return null;
    var mitFl = m.wohnungen.filter(function (w) { return w.wfl > 0; });
    for (var n = 0; n < mitFl.length; n++) if (mitFl[n].i === idx) return r.wohnungen[n] || null;
    return null;
  }

  /* ── Kennzahlen je Stufe (dieselben Kerne wie die Tafel Ist gegen Soll) ── */
  function kennzahlen(m) {
    var K = (window.State && window.State.kpis) || {};
    var ze = zahl(wert('ze'));
    var kp = K.kp || zahl(wert('kp'));
    var out = {};
    var istM = m.stufen.bestand.miete_m;
    /* Bestand = die Zahlen des Objekts selbst (calc.js), nicht nachgerechnet. */
    var basisNkm = zahl(wert('nkm')) || istM;
    ['bestand', 'mieterhoehung', 'zielbild'].forEach(function (k) {
      var s = m.stufen[k]; if (!s) return;
      /* Stufe = Miete des Objekts plus der Zuwachs aus den Wohnungen - so
         stehen alle Spalten auf derselben Basis, auch wenn das Feld
         Nettokaltmiete von der Summe der Wohnungen abweicht. */
      var nkm = k === 'bestand' ? basisNkm : basisNkm + (s.miete_m - istM);
      var bmy = (window.DealKpis && kp > 0) ? window.DealKpis.compute({ kp: kp + (s.kosten || 0), nkm: nkm, ze: ze }).bmy : null;
      var dscr = k === 'bestand' ? (K.dscr != null ? K.dscr : null)
        : ((window.Dscr && window.Dscr.compute) ? window.Dscr.compute({ nkm_j: nkm * 12, ze_j: ze * 12, zins_j: K.zins_j, tilg_j: K.tilg_j,
            bsv_j: K.d1IsAussetzung ? (K.bspar_j || 0) : 0, bwk_cf: K.bwk_cf }).netto : null);   /* v3031 */
      if (dscr === 0 && !(K.zins_j > 0 || K.tilg_j > 0)) dscr = null;   /* v2430a: ohne Darlehen kein DSCR (die Kerne liefern 0) */
      var cfB = K.cf_op != null ? K.cf_op / 12 : null;
      out[k] = { miete_j: nkm * 12, miete_qm: m.wfl > 0 ? nkm / m.wfl : null, bmy: bmy, dscr: dscr,
        cf_m: cfB == null ? null : cfB + (nkm - basisNkm), kosten: s.kosten || 0, plus: s.plus || 0 };
    });
    return out;
  }
  /* ── v2541 · Jahre je Stufe (Marcel 20.10.2026: „ein Jahr für Ankauf, für Soll
     und für das Zielbild") ─ Ankauf = Kaufdatum (Reiter Objekt), Mieterhöhung =
     frühester Termin der Soll-Mieten (§ 558: 15 Monate nach der letzten Erhöhung
     oder eigene Angabe), Zielbild = Feld „Zielbild fertig (Jahr)"; ohne Angabe null
     („offen"), nie geraten. */
  function jahre(m) {
    var kd = String(wert('kaufdat') || '');
    var ankauf = /^\d{4}/.test(kd) ? +kd.slice(0, 4) : null;
    var abs = (m.wohnungen || []).map(function (w) { return w.soll && w.soll.miete > w.ist && w.soll.ab ? w.soll.ab : null; }).filter(Boolean).sort();
    var mh = m.stufen.mieterhoehung ? (abs.length ? +String(abs[0] <= heuteYm() ? heuteYm() : abs[0]).slice(0, 4) : new Date().getFullYear()) : null;
    var zf = parseInt(String(wert('zb_fertig_jahr') || '').trim(), 10);
    return { ankauf: ankauf, mieterhoehung: mh, mieterhoehung_herkunft: abs.length ? 'frühestes Wirksamwerden der Soll-Mieten, § 558b/§ 559b BGB' : 'ohne Termin – laufendes Jahr',   /* v3028: Jahr = WIRKSAM, nicht verlangbar */
             zielbild: m.stufen.zielbild && zf >= 1990 && zf <= 2100 ? zf : null };
  }
  /* ── v3213 · W-6 · Ziel-Bruttomietrendite in Stufen (Entwicklungspartner) ──
     Die Stufen (z. B. nach 1 Jahr 5 %, nach 3 Jahren 6 %) stehen im Anlegerprofil
     (investment-profile.js zielBmrStufen) und kommen hier als PARAMETER an - diese
     beiden Funktionen lesen keine Einstellungen. Gilt in einem Jahr die Stufe mit dem
     höchsten „nach n Jahren", das schon erreicht ist; vor der ersten Stufe gibt es kein
     Ziel. Verglichen wird die Bruttomietrendite der Spalte (Ankauf, Bestand = heute,
     Mieterhöhung, Zielbild) im Jahr der Spalte. */
  function zielBmrAn(stufen, nachJahren) {
    if (!Array.isArray(stufen) || typeof nachJahren !== 'number' || !isFinite(nachJahren) || nachJahren < 0) return null;
    var z = null;
    stufen.forEach(function (s) {
      if (!s || typeof s.jahr !== 'number' || typeof s.pct !== 'number' || !isFinite(s.pct)) return;
      if (s.jahr <= nachJahren && (z === null || s.jahr >= z.jahr)) z = s;
    });
    return z;
  }
  /* punkte: [{ k, jahr (Kalenderjahr), bmy (%) }] → { k: { jahr, nach, ziel, ziel_ab, bmy, erreicht } } */
  function zielBmrPruefen(stufen, kaufjahr, punkte) {
    var aus = {};
    if (!Array.isArray(stufen) || !stufen.length || typeof kaufjahr !== 'number' || !isFinite(kaufjahr)) return aus;
    (punkte || []).forEach(function (p) {
      if (!p || !p.k || typeof p.jahr !== 'number' || !isFinite(p.jahr)) return;
      var nach = p.jahr - kaufjahr, z = zielBmrAn(stufen, nach);
      var bmy = (typeof p.bmy === 'number' && isFinite(p.bmy)) ? p.bmy : null;
      aus[p.k] = { jahr: p.jahr, nach: nach, ziel: z ? z.pct : null, ziel_ab: z ? z.jahr : null, bmy: bmy,
        erreicht: z && bmy != null ? bmy >= z.pct - 1e-9 : null };
    });
    return aus;
  }
  function zielBmrStufenAusProfil() {
    try { var IP = window.DealPilotInvestmentProfile; return IP && IP.zielBmrStufen ? IP.zielBmrStufen() : []; } catch (e) { return []; }
  }
  /* v2541 · Fußzeilen: woher die Marktpreisindikationen und die Jahre kommen */
  function mpiFuss(M) {
    var t = [];
    if (M.angebote && M.angebote.verfuegbar) t.push('Marktpreisindikation: Angebotspreise am Ort × Wohnfläche × Objektfaktoren, abzüglich '
      + (M.angebote.abschlag_pct != null ? String(Math.round(Number(M.angebote.abschlag_pct) * 10) / 10).replace('.', ',') + ' % ' : '') + 'Abschlag auf Angebotspreise; Mieterhöhung wie Bestand (Angebotspreise hängen nicht an der Miete), Zielbild mit Zustand „modernisiert".');
    if (M.rohertragsfaktor && M.rohertragsfaktor.verfuegbar) t.push('Rohertragsfaktor ' + dez(M.rohertragsfaktor.faktor, 1).replace(',0', '') + ' des '
      + String(M.rohertragsfaktor.ausschuss || 'Gutachterausschusses').replace(/^Der\s+/, '') + (M.rohertragsfaktor.berichtsjahr ? ' (' + M.rohertragsfaktor.berichtsjahr + ')' : '')
      + ' × Jahresnettokaltmiete der Stufe — Durchschnitt aus Kauffällen, eine Gegenprobe.');
    else if (M.rohertragsfaktor) t.push('Rohertragsfaktor: ' + (M.rohertragsfaktor.grund || 'nicht veröffentlicht') + '');
    return t.join(' ');
  }
  function jahreFuss(J) {
    return 'Jahre: Bestand ab Kaufdatum' + (J.ankauf ? ' (' + J.ankauf + ')' : ' (nicht eingetragen)')
      + (J.mieterhoehung ? ', Mieterhöhung ' + J.mieterhoehung + ' (' + J.mieterhoehung_herkunft + ')' : '')
      + ', Zielbild ' + (J.zielbild ? J.zielbild + ' (eigene Angabe)' : 'offen — Feld „Zielbild fertig (Jahr)"') + '.';
  }
  function ankaufKurz() {
    var AK = window.DealPilotAnkauf, st = null;
    try { st = AK && AK.stand ? AK.stand() : null; } catch (e) {}
    var k = st && st.kurz ? st.kurz : null;
    if (!k) return null;
    /* v2947 (N78.6) · die Kurzfassung des Ankauf-Stands fuehrt nicht jede Kennzahl
       (Westerfeldstr. 140: kein _kpis_cf_vs, die Spalte zeigte „—"), der volle Stand
       in `daten` schon (8.119 € p. a.). Fehlendes von dort, nichts neu gerechnet. */
    var d = st.daten || {};
    k = Object.assign({}, d, k);
    ['_kpis_cf_vs', '_kpis_bmy', '_kpis_dscr', '_nkm_qm', 'nkm'].forEach(function (s) { if (k[s] == null && d[s] != null) k[s] = d[s]; });
    var nkm = zahl(k.nkm);
    return { stichtag: st.stichtag || null, miete_j: nkm ? nkm * 12 : null, miete_qm: zahl(k._nkm_qm) || null,
      bmy: k._kpis_bmy != null ? Number(k._kpis_bmy) : null, dscr: k._kpis_dscr != null ? Number(k._kpis_dscr) : null,
      cf_m: k._kpis_cf_vs != null ? Number(k._kpis_cf_vs) / 12 : null };
  }

  /* ══ v2988 · WOHER DAS ZIELBILD KOMMT (Marcel 27.10.2026, Parkstr. 9) ══════════
     Gemessen: Investition `san` 137.000 €, Zielbild-Maßnahmen 136.000 € (Summe der
     Maßnahmen von fünf Wohnungen) - zwei Zahlen, die gleich aussehen und Verschiedenes
     sagen. `san` gehört zur Investition (Ankauf; bis zur Ausführung offener
     Instandhaltungsrückstau, § 8 Abs. 3 ImmoWertV), die Zielbild-Maßnahmen sind die
     Kosten, die das Zielbild NOCH braucht (im Wertzuwachs abgezogen). Ist die Sanierung
     dieselbe Arbeit, steht sie doppelt. herkunftAus() arbeitet auf den Rohdaten
     (Cockpit: gespeichertes Objekt), herkunft() auf dem offenen Formular. */
  function herkunftAus(einheiten, hausL, objListe, san) {
    var sumL = function (l) { return (l || []).reduce(function (a, x) { return a + zahl(x && x.k); }, 0); };
    var out = { art: null, n_wohnungen: 0, n_einheiten: 0, summe_wohnungen: 0, haus: 0, haus_n: 0, summe: 0, san: zahl(san) || 0, text: '', unterschied: null };
    if (Array.isArray(einheiten) && einheiten.length) {
      out.art = 'mfh';
      einheiten.forEach(function (e) {
        if (!e || !(zahl(e.wfl) > 0 || zahl(e.ist) > 0)) return;
        out.n_einheiten++;
        var l = massnahmenVon(e), k = sumL(l);
        if (l.length && k >= 0) { out.n_wohnungen++; out.summe_wohnungen += k; }
      });
      var hl = (hausL || []).filter(function (m) { var kk = m && katalog(m.id); return kk && kk.haus; });
      out.haus = sumL(hl); out.haus_n = hl.length;
      out.summe = out.summe_wohnungen + out.haus;
      var t = [];
      if (out.n_wohnungen) t.push('den Maßnahmen von ' + out.n_wohnungen + (out.n_wohnungen === 1 ? ' Wohnung' : ' Wohnungen') + ' (Summe ' + eur(out.summe_wohnungen) + ')');
      if (out.haus_n) t.push('den Hausmaßnahmen (' + eur(out.haus) + ')');
      out.text = t.length ? 'Zielbild aus ' + t.join(' und ') + '.' : '';
    } else {
      out.art = 'einzel';
      var l2 = Array.isArray(objListe) ? objListe : [];
      out.summe = sumL(l2);
      out.text = l2.length ? 'Zielbild aus den Maßnahmen am Objekt (' + l2.length + ', Summe ' + eur(out.summe) + ').' : '';
    }
    if (out.san > 0 && out.summe > 0) {
      out.unterschied = 'Investition (Sanierungskosten) ' + eur(out.san) + ' · Zielbild-Maßnahmen ' + eur(out.summe)
        + ' — zwei getrennte Angaben: die Sanierungskosten (Reiter Investition) gehören zum Ankauf und gelten bis zur Ausführung als offener Instandhaltungsrückstau;'
        + ' die Zielbild-Maßnahmen sind die Kosten, die das Zielbild noch braucht, und werden vom Wertzuwachs abgezogen.'
        + ' Ist es dieselbe Arbeit, steht sie doppelt — dann eine der beiden Angaben leeren.';
    }
    return out;
  }
  function herkunft() {
    var D = window._dpMfh || {};
    var mfh = artMitEinheiten() && Array.isArray(D.einheiten) && D.einheiten.length;
    return herkunftAus(mfh ? D.einheiten : null, mfh ? D.haus_massnahmen : null, mfh ? null : objektMassnahmen(), wert('san'));
  }
  function herkunftAusDaten(d) {
    d = d || {};
    var M = d._mfh && Array.isArray(d._mfh.einheiten) && d._mfh.einheiten.length ? d._mfh : null;
    var ol = []; try { ol = JSON.parse(d.zb_massnahmen || '[]'); } catch (e) { ol = []; }
    return herkunftAus(M ? M.einheiten : null, M ? M.haus_massnahmen : null, M ? null : ol, d.san);
  }
  /** Ein Block für Reiter Objekt und Wert & Zielbild: Herkunft, Unterschied zu `san`,
      marktübliche Miete nach Modernisierung, Regel der Sanierungskosten, Knopf „Zielbild leeren". */
  function herkunftHtml(opts) {
    opts = opts || {};
    var H = herkunft(), r = ergebnis(), zl = r && r.haus && r.haus.zielbild ? r.haus.zielbild : null;
    var mnm = zl && zl.miete_nach_modernisierung ? zl.miete_nach_modernisierung : null;
    var mh = r && r.haus && r.haus.mieterhoehung && r.haus.mieterhoehung.rechenweg558 ? r.haus.mieterhoehung.rechenweg558 : null;   /* v3150 */
    var z = [];
    if (mh && mh.satz) z.push('<b>Mieterhöhung:</b> ' + esc(mh.satz) + (mh.verschoben ? ' ' + esc(mh.verschoben) : ''));
    var nvE = r && r.haus && r.haus.neuvermietung;   /* v3152 · N117 */
    if (nvE && nvE.satz) z.push('<b>Neuvermietung:</b> ' + esc(nvE.satz));
    if (H.text) z.push('<b>' + esc(H.text) + '</b>');
    if (H.unterschied) z.push(esc(H.unterschied));
    if (mnm && mnm.satz) z.push((mnm.wirkt ? '' : '<b>Miete im Zielbild:</b> ') + esc(mnm.satz));
    if (r && r.sanierung && r.sanierung.text) z.push('<b>Sanierungskosten:</b> ' + esc(r.sanierung.text));
    if (!z.length) return '';
    return '<div class="dp-zb-herkunft" style="font-size:12px;line-height:1.5;margin:8px 0;padding:8px 10px;border-left:3px solid var(--wl-c9a84c, #C9A84C);background:rgba(127,127,127,.06)">'
      + z.map(function (x) { return '<div style="margin:2px 0">' + x + '</div>'; }).join('')
      + (opts.ohneKnopf || !(H.summe > 0 || modell().aktiv) ? '' : '<button type="button" class="btn btn-sm" data-dp-zb-leeren="1" style="margin-top:6px">Zielbild leeren</button>')
      + '</div>';
  }
  /** Leert Maßnahmen, Soll- und Zielmieten (Objekt und Einheiten) - nur nach Rückfrage.
      Nichts in der Datenbank direkt: die Felder werden geleert und das Objekt wie bei
      jeder Eingabe gespeichert (saveObj). */
  function leeren() {
    var H = herkunft();
    var frage = 'Zielbild leeren?\n\nEntfernt werden: alle Maßnahmen (' + eur(H.summe) + (H.n_wohnungen ? ', ' + H.n_wohnungen + ' Wohnungen' : '') + (H.haus_n ? ', Hausmaßnahmen' : '')
      + '), Soll- und Zielmieten, „Zielbild ab wann" und die marktübliche Miete nach Modernisierung.\n'
      + 'Nicht berührt: Ist-Mieten, Flächen, Sanierungskosten im Reiter Investition.';
    if (!window.confirm(frage)) return false;
    var D = window._dpMfh;
    if (D && Array.isArray(D.einheiten)) {
      D.einheiten.forEach(function (e) { if (!e) return; e.massnahmen = []; e.massnahme = ''; e.kosten = ''; e.soll = ''; e.ziel_qm = ''; e.ziel_wann = ''; });
      D.haus_massnahmen = [];
    }
    ['zb_massnahmen', 'zb_soll_qm', 'zb_soll_ab', 'zb_ziel_qm', 'zb_ziel_wann', 'zb_markt_qm', 'zb_fertig_jahr'].forEach(function (id) {
      var f = el(id); if (!f) return; f.value = '';
      try { f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    });
    _objListe = [];
    try { objektKarte(); } catch (e) {}
    try { if (typeof window.saveObj === 'function') window.saveObj({ silent: true }); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('dp:potenzial', { detail: { geleert: true } })); } catch (e) {}
    return true;
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-dp-zb-leeren]') : null;
    if (!t) return;
    ev.preventDefault();
    leeren();
  });

  /* Für Prompt, Portfolio-Pilot und PDF: das Wesentliche in einem Satz Zahlen. */
  function zusammenfassung(m, r) {
    var kz = kennzahlen(m), h = (r && r.haus) || {};
    var z = { stand: new Date().toISOString().slice(0, 10), art: m.art, kennzeichnung: KENNZEICHNUNG,
      kappung: { pct: m.kappung.pct, text: m.kappung.text }, stufen: {} };
    ['bestand', 'mieterhoehung', 'zielbild'].forEach(function (k) {
      if (!m.stufen[k]) return;
      z.stufen[k] = { kaltmiete_monat: Math.round(m.stufen[k].miete_m), kaltmiete_jahr: Math.round(m.stufen[k].miete_m * 12),
        kosten: Math.round(m.stufen[k].kosten || 0), punkte_plus: m.stufen[k].plus || 0,
        bmy: kz[k] && kz[k].bmy != null ? Math.round(kz[k].bmy * 100) / 100 : null,
        dscr: kz[k] && kz[k].dscr != null ? Math.round(kz[k].dscr * 100) / 100 : null,
        ertragswert: h[k] ? h[k].wert : null, rnd: h[k] ? h[k].rnd : null,
        /* v2488 · die Miete, mit der der Ertragswert der Stufe rechnet, und ihre Anhebung gegen den Bestand */
        rohertrag_ertragswert: h[k] && h[k].miete_wohnen_jahr != null ? Math.round(h[k].miete_wohnen_jahr) : null,
        anhebung_ertragswert: h[k] && h[k].anhebung_jahr != null ? Math.round(h[k].anhebung_jahr) : null,
        /* v2541 · Jahr der Stufe und beide Marktpreisindikationen */
        jahr: k === 'bestand' ? (jahre(m).ankauf || null) : (jahre(m)[k] || null),
        marktpreisindikation_angebote: h[k] && h[k].mpi_angebote != null ? h[k].mpi_angebote : null,
        rohertragsfaktor_x_miete: h[k] && h[k].mpi_rohertrag ? h[k].mpi_rohertrag.wert : null };
    });
    /* v2541 */
    z.jahre = jahre(m);
    if (r && r.mpi) z.marktpreisindikation = { angebote: r.mpi.angebote || null, rohertragsfaktor: r.mpi.rohertragsfaktor || null, kauffaelle: r.mpi.kauffaelle || null };   /* v3041: kauffaelle */
    if (r && r.basis && r.basis.bestandsbasis) z.ertragswert_basis = r.basis.bestandsbasis.hinweis;   /* v2488 */
    if (gesperrt(r)) { z.ertragswert_gesperrt = true; z.ertragswert_hinweis = GESPERRT_KURZ + '. ' + GESPERRT_LANG; }
    if (r && r.aufteilung && r.aufteilung.je_stufe) {
      var zb = r.aufteilung.zins && r.aufteilung.zins.bestand;
      z.aufteilung = { kosten: r.aufteilung.kosten_eur, je_stufe: r.aufteilung.je_stufe,
        zins_etw: zb ? zb.pct : null, zins_etw_ausschuss: zb ? zb.ausschuss || null : null,
        zins_haus: r.basis ? r.basis.lzs_pct : null,
        negativ_hinweis: r.aufteilung.negativ_hinweis || null,   /* v2431 */
        marktpreisindikation_etw: r.aufteilung.mpi_etw || null };   /* v2541 */
    }
    if (m.haus && m.haus.massnahmen.length) z.haus_massnahmen = { kosten: Math.round(m.haus.kosten),   /* v2966 */
      text: m.haus.massnahmen.map(function (x) { return x.t + (x.k ? ' ' + Math.round(x.k) + ' €' : '') + (x.bewohnt ? ' (umgelegt nach § 559 BGB' + (zahl(x.erh) ? ', davon ' + zahl(x.erh) + ' % Erhaltung' : '') + ')' : ''); }).join(', '),
      hinweis: 'Kosten nach Wohnfläche auf die Wohnungen verteilt und in deren Kosten enthalten.' };
    /* v2988 · die Maßnahmen im Zielbild sind NICHT die Sanierungskosten - beide Zahlen getrennt */
    try {
      var _H = herkunft();
      z.massnahmen_herkunft = { text: _H.text || null, summe: Math.round(_H.summe), n_wohnungen: _H.n_wohnungen, haus: Math.round(_H.haus),
        sanierungskosten_investition: _H.san > 0 ? Math.round(_H.san) : null, unterschied: _H.unterschied };
    } catch (e) { /* nur Auskunft */ }
    var _zl = h.zielbild && h.zielbild.miete_nach_modernisierung;
    if (_zl) z.miete_nach_modernisierung = { satz: _zl.satz, weg: _zl.weg, wirkt: !!_zl.wirkt, qm_vorher: _zl.qm_vorher, qm_nachher: _zl.qm_nachher };
    /* v3150 · N114 · der Rechenweg der Stufe Mieterhöhung (Wert zum Stichtag) */
    var _mh = h.mieterhoehung && h.mieterhoehung.rechenweg558;
    if (h.neuvermietung) z.neuvermietung = { wert: h.neuvermietung.wert, barwert_eur: h.neuvermietung.barwert_eur, satz: h.neuvermietung.satz,
      annahmen: h.neuvermietung.annahmen, wohnungen: h.neuvermietung.wohnungen };   /* v3152 */
    if (_mh) z.mieterhoehung_rechenweg = { satz: _mh.satz + (_mh.verschoben ? ' ' + _mh.verschoben : ''), mindermiete_eur: _mh.mindermiete_eur,
      sensitiv_eur: _mh.sensitiv_eur, rnd_jahre: _mh.rnd_jahre, kappung_text: _mh.kappung_text,
      wohnungen: (_mh.wohnungen || []).map(function (x) { return { nr: x.nr, ist: x.ist_monat, ziel: x.ziel_monat, ziel_herkunft: x.ziel_herkunft,
        erste: x.erste_anhebung, jahre: x.jahre_bis_ziel, barwert: x.mindermiete_barwert_eur, annahme: x.annahmen || x.grund || null,
        sensitiv: x.sensitiv ? x.sensitiv.text + ' (' + Math.round(x.sensitiv.unterschied_eur).toLocaleString('de-DE') + ' €)' : null }; }) };
    if (r && r.sanierung && r.sanierung.text) z.sanierung_regel = r.sanierung.text + (r.sanierung.hinweis ? ' ' + r.sanierung.hinweis : '');
    z.wohnungen = m.wohnungen.slice(0, 30).map(function (w) {
      return { nr: w.nr, lage: w.lage, wfl: w.wfl, status: w.status, ist: Math.round(w.ist),
        soll: w.soll && w.soll.miete != null ? Math.round(w.soll.miete) : null, soll_ab: w.soll ? w.soll.ab_text || null : null,
        /* v3028 · beide Termine als Felder - objektWissen.js (Bot, Co-Pilot, Cockpit-Pilot) liest sie statt den Text zu deuten */
        soll_verlangbar_ab: w.soll && w.soll.termine ? w.soll.termine.verlangbar_ab : null,
        soll_verlangbar_sofort: w.soll && w.soll.termine ? w.soll.termine.verlangbar_sofort : null,
        soll_wirksam_ab: w.soll && w.soll.termine ? w.soll.termine.wirksam_ab : null,
        soll_termin: w.soll && w.soll.termine ? w.soll.termine.text_lang : null,
        soll_herkunft: w.soll ? w.soll.herkunft : null, ziel: w.ziel != null ? Math.round(w.ziel) : null, ziel_wann: w.ziel_wann || null,
        /* v3244 · getrennt: Teil nach § 558 BGB und vertragliche Erhöhung (Staffel/Index/Gewerbe) */
        soll558: Math.round(soll558(w)), soll_vertrag: (function () { var v = sollVertrag(w); return v ? { art: v.art, monat: v.monat != null ? Math.round(v.monat) : null, norm: v.norm, text: v.text } : null; })(),
        massnahmen: w.massnahmen.map(function (x) { return x.t + (zahl(x.k) ? ' ' + Math.round(zahl(x.k)) + ' €' : '') + (x.bewohnt ? ' (umgelegt nach § 559 BGB' + (zahl(x.erh) ? ', davon ' + zahl(x.erh) + ' % Erhaltung' : '') + ')' : ''); }).join(', ') || null,
        kosten: Math.round(w.kosten) || 0,
        /* v3025 · die nächste Indexanpassung (v3026, js/indexmiete.js) mit dem Objekt speichern - sonst
           erreicht sie weder Telegram-Bot noch Portfolio-Pilot (objektWissen.js liest `index`) */
        index: w.index && w.index.ok && w.index.naechste ? { miete: w.index.naechste.miete_neu, ab: w.index.naechste.wirksam,
          erklaerung_ab: w.index.naechste.erklaerung, plus_monat: w.index.naechste.plus_monat, annahme: !!w.index.naechste.annahme,
          herkunft: 'Indexmiete § 557b BGB, gerechnet in DealPilot (VPI' + (w.index.naechste.annahme ? ', Annahme ' + w.index.annahme_pct + ' % p. a.' : '') + ')' } : null,
        /* v2541 · je Wohnung als ETW: Ertragswert und Marktpreisindikation nebeneinander */
        etw: (function () { var we = wohnungErgebnis(r, m, w.i); if (!we || (!we.als_etw && !we.mpi_etw)) return null;
          return { ertragswert: we.als_etw || null, marktpreisindikation: we.mpi_etw ? { bestand: we.mpi_etw.bestand, zielbild: we.mpi_etw.zielbild } : null }; })() };
    });
    return z;
  }
  function pilotPayload() {
    var m = modell(); if (!m.aktiv) return null;
    var r = ergebnis();
    var z = zusammenfassung(m, r);
    z.ertragswert_gerechnet = !!(r && r.verfuegbar);
    if (r && r.basis) z.zins = { pct: r.basis.lzs_pct, stufe: r.basis.lzs_stufe };
    if (!r) {
      /* v2431 · noch nichts gerechnet: ohne Freigabe keine Ertragswerte erwaehnen */
      var alt = window._dpPotenzial;
      if (alt && gesperrt(alt.ergebnis)) { z.ertragswert_gesperrt = true; z.ertragswert_hinweis = GESPERRT_KURZ + '. ' + GESPERRT_LANG; }
    }
    return z;
  }

  /* ── Darstellung: die Tafel „Ankauf · Bestand · Zielbild" ─────────────
     v2577 · Marcel 21.10.2026: „grundsätzlich gut, aber teilweise unübersichtlich.
     Auch viel Text. … Abschläge gleich mit in den Text in kleiner."
     Umgeordnet, nichts gestrichen:
       - EINE Vergleichstafel oben, zwei Gruppen: Miete & Rendite, darunter Wert
         (Ertragswert, Marktpreisindikation, Rohertragsfaktor × Miete). €/m²,
         Restnutzungsdauer, Spanne, Angebotsabschlag und Liegenschaftszins stehen
         klein an ihrer Zahl statt in eigenen Zeilen.
       - Eine Zeile, die in keiner Spalte einen Wert hat, entfällt (vorher
         „— — — —" für Restnutzungsdauer, Ertragswert, Modernisierungspunkte).
       - Der Erläuterungsabsatz steht eingeklappt unter „So ist gerechnet"; die
         Kennzeichnung „keine Verkehrswertermittlung" bleibt sichtbar.
       - Liegt kein aktueller Ertragswert-Lauf vor, aber ein Abruf „Marktpreise",
         kommen die Wertzeilen aus dem Abruf - mit Datum gekennzeichnet. Vorher
         standen sie nur unten im Abschnitt Marktpreise, und oben stand „—".
       - Neu sichtbar: warum Marktpreisindikation und Ertragswert auseinander
         liegen (Vielfaches der Jahresmiete), die leeren Wohnungen im Rohertrag
         und das Etikett des Liegenschaftszinses unterhalb Stufe A. */
  function stilEinhaengen() {
    if (el('dp-pot-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-pot-stil';
    s.textContent = [
      /* v2842 · Abrufleiste */
      '.dp-abr{border:1px solid #E6DCC2;border-radius:10px;background:#FBF6E9;padding:8px 12px;margin:0 0 12px}',
      '.dp-abr-kopf{font:600 10px "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#6B645A;margin:0 0 4px}',
      '.dp-abr-z{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:4px 14px;align-items:center;padding:7px 0;border-top:1px solid #EDE3C8}',
      '.dp-abr-z:first-of-type{border-top:0}',
      '.dp-abr-t>b{display:block;font:600 12.5px Inter,sans-serif;color:#2A2727}.dp-abr-t>span{display:block;font:400 11.5px/1.4 Inter,sans-serif;color:#4a4436}.dp-abr-t>span b{font-weight:600;color:#2A2727}',
      '.dp-abr-k{font:500 10.5px "JetBrains Mono",monospace;color:#6B645A;white-space:nowrap}',
      '.dp-abr-b{white-space:nowrap}',
      '@media (max-width:640px){.dp-abr-z{grid-template-columns:minmax(0,1fr) auto}.dp-abr-t{grid-column:1 / -1}.dp-abr-k{grid-column:1;white-space:normal}.dp-abr-b{grid-column:2}}',
      '.dp-pot{font:400 13px/1.5 Inter,system-ui,sans-serif;color:#1d1a14}',
      '.dp-pot table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}',
      '.dp-pot th,.dp-pot td{padding:6px 8px;text-align:right;border-bottom:1px solid #E6DCC2;white-space:nowrap;vertical-align:top}',
      '.dp-pot th:first-child,.dp-pot td:first-child{text-align:left;white-space:normal}',
      '.dp-pot thead th{font:500 10.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6c6450;vertical-align:bottom}',
      /* v2543 · Stufenfarben aus der Marke (Marcel 20.10.2026): Bestand Obsidian, Mieterhöhung helles Gold,
         Zielbild dunkles Gold - als Kante, nie als Schriftfarbe (helles Gold auf Weiß ist nicht lesbar) */
      '.dp-pot th.c-soll{box-shadow:inset 0 -3px 0 var(--wl-e8cc7a, #E8CC7A)}.dp-pot th.c-ziel{box-shadow:inset 0 -3px 0 var(--wl-b8932f, #b8932f)}',
      '.dp-pot .c-soll,.dp-pot .c-ziel{color:#1d1a14}',
      '.dp-pot td.c-soll,.dp-pot td.c-ziel{font-weight:600}',
      '.dp-pot .dp-pot-scroll{overflow-x:auto}',
      '.dp-pot .dp-pot-hin{font-size:11.5px;color:#6c6450;margin:8px 0 0}',
      '.dp-pot .dp-pot-kz{font:500 11px "JetBrains Mono",monospace;color:#2f7d55;border:1px solid #2f7d55;border-radius:999px;padding:1px 8px;margin-left:8px;white-space:nowrap}',
      '.dp-pot .dp-pot-knopf{border:1px solid var(--wl-c9a84c, #C9A84C);background:#fff;color:#1d1a14;border-radius:8px;padding:6px 12px;font:600 12px Inter,sans-serif;cursor:pointer}',
      '.dp-pot .dp-pot-knopf:focus-visible{outline:2px solid var(--wl-c9a84c, #C9A84C);outline-offset:2px}',
      '.dp-pot tr.dp-pot-sum td{font-weight:700;border-top:2px solid #E6DCC2}',
      /* v2431 */
      '.dp-pot .dp-pot-stufe3{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;margin:10px 0 0;padding:10px 12px;border:1px solid #E6DCC2;border-radius:10px;background:#FBF6E9;font-size:12.5px;color:#4a4436}',
      '.dp-pot .dp-pot-stufe3 b{color:#1d1a14;flex:1 1 100%}',
      '.dp-pot .dp-pot-stufe3 span{flex:1 1 260px}',
      '.dp-pot td.dp-pot-neg{color:#6c6450 !important;font-weight:500 !important;white-space:normal}',
      /* v2542 · Abschnitt Marktpreise */
      '.dp-pot .dp-markt{border-top:1px solid #E6DCC2;padding-top:12px;display:grid;gap:6px}',
      '.dp-pot .dp-markt-kopf{display:grid;gap:2px}.dp-pot .dp-markt-kopf b{font:700 12px "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#6c6450}',
      '.dp-pot .dp-markt-kopf span{font-size:12px;color:#6c6450;max-width:80ch}',
      '.dp-pot .dp-markt .dp-pot-knopf{justify-self:start}',
      '.dp-pot th .dp-pot-jahr{display:block;font:400 10px "JetBrains Mono",monospace;letter-spacing:.04em;color:#8A8272;text-transform:none}',   /* v2541 */
      /* v2577 · die kleine Zeile an der Zahl, Gruppenköpfe, „So ist gerechnet" */
      '.dp-pot .dp-pot-z{display:inline-block;text-align:inherit}',
      '.dp-pot .dp-pot-u{display:block;font:400 10.5px/1.35 Inter,system-ui,sans-serif;color:#6c6450;white-space:normal;letter-spacing:0;text-transform:none}',
      '.dp-pot thead th{white-space:normal}.dp-pot th,.dp-pot td{padding-left:6px;padding-right:6px}',
      '.dp-pot tr.dp-pot-gr td{font:600 10px/1.2 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#8A8272;padding:12px 8px 4px;text-align:left}',
      '.dp-pot .dp-pot-kenn{font-size:11.5px;color:#4a4436;margin:8px 0 0}',
      '.dp-pot details.dp-pot-mehr{margin:6px 0 0;font-size:11.5px;line-height:1.5;color:#6c6450}',
      '.dp-pot details.dp-pot-mehr>summary{cursor:pointer;font:600 11.5px Inter,system-ui,sans-serif;color:#4a4436;padding:3px 0;list-style-position:inside}',
      '.dp-pot details.dp-pot-mehr>summary:focus-visible{outline:2px solid var(--wl-c9a84c, #C9A84C);outline-offset:2px}',
      '.dp-pot details.dp-pot-mehr ul{margin:4px 0 2px;padding-left:18px}.dp-pot details.dp-pot-mehr li{margin:2px 0}',
      '.dp-pot details.dp-pot-mehr .dp-pot-scroll{margin-top:6px}',
      '.dp-pot .dp-markt-knopfzeile{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}.dp-pot .dp-markt-knopfzeile .dp-pot-u{display:inline;flex:1 1 220px}',
      /* v2595 · Bestand im Vergleich: zwei gleichrangige Karten, Differenz, Einordnung, Ursachen */
      '.dp-pot .dp-vgl{margin:12px 0 0;display:grid;gap:8px}',
      '.dp-pot .dp-vgl-karten{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
      '.dp-pot .dp-vgl-k{border:1px solid #E6DCC2;border-radius:10px;padding:8px 12px;background:#fff;min-width:0}',
      '.dp-pot .dp-vgl-k b.t{display:block;font:500 10px/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6c6450}',
      '.dp-pot .dp-vgl-k .w{display:block;font:700 18px/1.25 "Space Grotesk",Inter,sans-serif;color:#1d1a14;font-variant-numeric:tabular-nums}',
      '.dp-pot .dp-vgl-k .q{display:block;font-size:11.5px;color:#4a4436;font-variant-numeric:tabular-nums}',
      '.dp-pot .dp-vgl-diff{border-left:3px solid var(--wl-b8932f, #b8932f);padding:4px 10px;font-size:12.5px;color:#1d1a14;font-variant-numeric:tabular-nums}',
      '.dp-pot .dp-vgl-diff b{font-weight:700}',
      '.dp-pot .dp-vgl-ein{margin:0;padding:0;list-style:none;display:grid;gap:3px;font-size:11.5px;line-height:1.45;color:#4a4436}',
      '.dp-pot .dp-vgl-ein li b{font-weight:600;color:#1d1a14}',
      '.dp-pot .dp-vgl-mp{font-size:11.5px;line-height:1.45;color:#4a4436;padding:6px 10px;border-radius:8px;background:#FBF6E9;border:1px solid #E6DCC2}',
      '.dp-pot .dp-vgl-mp.ab{background:#FBEFEC;border-color:#E9C9C3;color:#5b2f2b}',
      '.dp-pot .dp-vgl-urs{margin:0;padding:0;list-style:none;display:grid;gap:3px;font-size:11.5px;line-height:1.45;color:#4a4436}',
      '.dp-pot .dp-vgl-urs li{display:flex;gap:6px;align-items:baseline}',
      '.dp-pot .dp-vgl-st{flex:0 0 auto;font:500 9.5px/1.4 "JetBrains Mono",monospace;letter-spacing:.04em;border-radius:999px;padding:0 6px;border:1px solid #8A8272;color:#4a4436;white-space:nowrap}',
      '.dp-pot .dp-vgl-st.nw{border-color:#2f7d55;color:#2f7d55}.dp-pot .dp-vgl-st.np{border-style:dashed}',
      '.dp-pot .dp-vgl-kopf{font:600 10px/1.2 "JetBrains Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:#8A8272;margin:4px 0 0}',
      '@media(max-width:640px){.dp-pot .dp-vgl-karten{grid-template-columns:minmax(0,1fr)}.dp-pot .dp-vgl-k .w{font-size:17px}}',
      /* auf dem Handy macht tabellen-karten.js aus jeder Kennzahl eine Karte - die Gruppenköpfe wären dort leere Karten */
      '@media(max-width:600px){.dp-pot table.dptk tbody tr.dp-pot-gr{border:0;background:none;padding:8px 2px 0;margin:0}'
        + '.dp-pot table.dptk tbody tr.dp-pot-gr td{justify-content:flex-start;text-align:left;font:600 10px/1.2 "JetBrains Mono",monospace;letter-spacing:.1em;padding:0 !important;margin:0;border:0 !important}'
        + '.dp-pot table.dptk tbody td:first-child{display:block;text-align:left}.dp-pot table.dptk tbody td:first-child::before{content:none}'
        + '.dp-pot table.dptk tbody td:first-child .dp-pot-z{display:block}}'
    ].join('');
    document.head.appendChild(s);
  }
  function u(t) { return t ? '<span class="dp-pot-u">' + t + '</span>' : ''; }
  function zz(haupt, unter) { return '<span class="dp-pot-z">' + haupt + u(unter) + '</span>'; }
  function pk(n) { return dez(n, 1).replace(',0', ''); }   /* Punkte ohne „,0" */
  /* v2577 · Herkunft des Angebotsabschlags in zwei Worten (die volle Herkunft steht unter „So ist gerechnet") */
  /* v2578 · dazu der Ausschuss mit Jahrgang (k), wo der Abschlag örtlich gemessen ist */
  /* v3041 · Unterzeile „1.245 €/m² × 427 m² · Gutachterausschuss … 2025 · 41 Kauffälle“ */
  function kauffaelleUnter(K) {
    if (!K) return '';
    return [K.kaufpreis_eur_qm ? Math.round(K.kaufpreis_eur_qm).toLocaleString('de-DE') + ' €/m² × Wohnfläche' : '',
      K.ausschuss ? esc(String(K.ausschuss).replace(/^Der\s+/, '')) + (K.berichtsjahr ? ' ' + esc(String(K.berichtsjahr)) : '') : '',
      K.faelle ? esc(String(K.faelle)) + ' Kauffälle' : '', 'Gegenprobe, kein Verkehrswert'].filter(Boolean).join(' · ');
  }
  function abschlagKurz(h, k) { h = String(h || ''); return /^örtlich/.test(h) ? 'örtlich gemessen' + (k ? ', ' + esc(String(k)) : '') : (/eigene/.test(h) ? 'eigene Angabe' : (h ? 'Marktdurchschnitt' : '')); }
  function abschlagPct(p) { return p == null ? null : String(Math.round(Number(p) * 10) / 10).replace('.', ','); }

  /* v2577 · Wert je Stufe: aus dem aktuellen Ertragswert-Lauf, sonst aus dem
     letzten gespeicherten Abruf „Marktpreise" (dann mit Datum gekennzeichnet). */
  function wertQuelle(r) {
    var T = ['bestand', 'mieterhoehung', 'zielbild'], S = {};
    if (r && r.verfuegbar && r.haus && r.haus.bestand) {
      T.forEach(function (k) { var h = r.haus[k]; if (!h) return;
        S[k] = { ew: h.wert, rnd: h.rnd, mod: h.mod_punkte, mpi: h.mpi_angebote, spanne: h.mpi_angebote_spanne || null,
                 rf: h.mpi_rohertrag ? h.mpi_rohertrag.wert : null, roh: h.rohertrag != null ? h.rohertrag : h.miete_wohnen_jahr,
                 /* v2842 · Abschlag und Wert ohne Abschlag; v2854 · Sanierungsstau der Stufe */
                 mpiAb: h.mpi_abschlag_pct != null ? h.mpi_abschlag_pct : (r.mpi && r.mpi.angebote ? r.mpi.angebote.abschlag_pct : null),
                 mpiOhne: h.mpi_angebote_roh != null ? h.mpi_angebote_roh : null, stau: h.sanierungsstau || null }; });
      return { quelle: 'lauf', S: S, mpi: r.mpi || null, leer: r.basis && r.basis.bestandsbasis ? (r.basis.bestandsbasis.leer || 0) : 0,
               lzs: r.basis ? { pct: r.basis.lzs_pct, stufe: r.basis.lzs_stufe, etikett: r.basis.lzs_etikett } : null };
    }
    var A = (_markt.key === marktKey()) ? _markt.daten : null;
    var D = A && A.daten;
    if (!D || !D.stufen || !D.stufen.bestand) return null;
    T.forEach(function (k) { var s = D.stufen[k]; if (!s) return;
      S[k] = { ew: s.ertragswert, rnd: s.rnd, mod: null, mpi: s.mpi_angebote, spanne: s.mpi_spanne || null, rf: s.rohertragsfaktor_x_miete, roh: s.miete_jahr,
        mpiAb: s.mpi_abschlag_pct != null ? s.mpi_abschlag_pct : (D.markt && D.markt.abschlag_pct != null ? D.markt.abschlag_pct : (D.mpi && D.mpi.angebote ? D.mpi.angebote.abschlag_pct : null)),
        mpiOhne: s.mpi_angebote_roh != null ? s.mpi_angebote_roh : null, stau: s.sanierungsstau || null }; });   /* v2842 */
    return { quelle: 'abruf', datum: new Date(A.abgerufen_am).toLocaleDateString('de-DE'), S: S, mpi: D.mpi || null, leer: 0,
             lzs: D.lzs_pct != null ? { pct: D.lzs_pct } : null };
  }
  function lzsKurz(L) {
    if (!L || L.pct == null) return '';
    return 'Liegenschaftszins ' + pct(L.pct) + (L.stufe ? ' · Stufe ' + esc(L.stufe) : '')
      + (L.etikett && L.etikett !== 'amtlich' ? ' · ' + esc(L.etikett) : '');
  }
  /* v2577 · Marcel 21.10.2026: „warum sind die Marktpreisindikation unter dem
     Ertragswert?" - die Antwort gehört an die Tafel: der Ertragswert rechnet aus
     der Miete dieses Hauses, die Marktpreisindikation aus Angebotspreisen
     vergleichbarer Häuser und kennt die Miete nicht. Gezeigt als Vielfaches der
     Jahresmiete, beide auf denselben Rohertrag bezogen. */
  /* v2595 · Gutachterprüfung 21.10.2026: der pauschale Satz oben („sie kennt die Miete
     nicht …") sagte für jedes Objekt dasselbe und stand eingeklappt. Er ist ersetzt durch
     den Bestandsvergleich aus PotenzialService (vergleich): zwei gleichrangige Karten mit
     €/m² auf dieselbe Bezugsfläche, die Differenz mit Vorzeichen in € und % vom Ertragswert,
     Stufe des Zinses und Herkunft der Miete in je einem Satz, die Modellprüfung als
     Hinweiszeile und die Ursachen mit Status (nachgewiesen / plausibel / nicht prüfbar). */
  var ST = { nachgewiesen: ['nachgewiesen', 'nw'], plausibel: ['plausibel', 'pl'], nicht_pruefbar: ['nicht prüfbar', 'np'] };
  function vergleichHtml(V) {
    if (!V || !V.ertragswert || V.ertragswert.wert == null) return '';
    var E = V.ertragswert, Mp = V.mpi || {}, D = V.differenz, B = V.bezugsflaeche;
    var bez = B ? ' Wohnfläche' : '';
    var qm = function (w) { return w != null ? Math.round(w).toLocaleString('de-DE') + ' €/m²' + bez : '—'; };
    var karte = function (titel, wert, q, unter) {
      return '<div class="dp-vgl-k"><b class="t">' + titel + '</b><span class="w">' + wert + '</span><span class="q">' + q + '</span>'
        + (unter ? '<span class="dp-pot-u">' + unter + '</span>' : '') + '</div>';
    };
    var ab = Mp.abschlag_pct != null ? abschlagPct(Mp.abschlag_pct) : null;
    var h = '<div class="dp-vgl" data-dp-vgl="1"><div class="dp-vgl-kopf">Bestand im Vergleich' + (B ? ' · Bezugsfläche ' + esc(B.art) + ' ' + Math.round(B.qm).toLocaleString('de-DE') + ' m²' : '') + '</div>'
      + '<div class="dp-vgl-karten">'
      + karte(V.vorlaeufig_vor_bog ? 'Ertragswert · vorläufig' : 'Ertragswert', eur(E.wert), qm(E.eur_qm), V.lzs ? 'Liegenschaftszins ' + pct(E.lzs_pct) + ' · Stufe ' + esc(V.lzs.stufe) + (E.belastbarkeit ? ' · Belastbarkeit ' + E.belastbarkeit.pct + ' %' : '') : '')
      + (Mp.wert != null
        ? karte('Marktpreisindikation', eur(Mp.wert), qm(Mp.eur_qm), 'Angebotspreise am Ort' + (ab ? ', abzüglich ' + ab + ' % (' + abschlagKurz(Mp.abschlag_herkunft) + ')' : '') + (Mp.spanne ? ' · ' + spanneTsd(Mp.spanne[0], Mp.spanne[1]) : ''))
        : karte('Marktpreisindikation', '—', 'keine Angebotspreise am Ort', ''))
      + '</div>';
    if (D) {
      var vz = D.absolut_eur > 0 ? '+' : (D.absolut_eur < 0 ? '−' : '±');
      h += '<div class="dp-vgl-diff">Differenz Marktpreisindikation − Ertragswert: <b>' + vz + eur(Math.abs(D.absolut_eur)) + '</b> · <b>' + vz
        + pct(Math.abs(D.relativ_pct), 1) + '</b> vom Ertragswert</div>';
    }
    var ein = [];
    if (V.lzs && V.lzs.satz) ein.push('<li><b>Zins:</b> ' + esc(V.lzs.satz) + '</li>');
    if (V.miete && V.miete.satz) ein.push('<li><b>Miete:</b> ' + esc(V.miete.satz) + '</li>');
    /* v2600 · E2/E3 · Mietabweichung und Leerstand als besonderes Merkmal; E4 · Spanne der Stufe N */
    if (V.bog && V.bog.satz) ein.push('<li><b>Besondere Merkmale:</b> ' + esc(V.bog.satz) + '</li>');
    else if (V.vorlaeufig_vor_bog) ein.push('<li><b>Besondere Merkmale:</b> leere Wohnungen voll vermietet, ohne Mietausfall und Herrichtung.</li>');
    if (V.lzs_spanne && V.lzs_spanne.text) ein.push('<li><b>Spanne:</b> ' + esc(V.lzs_spanne.text) + '</li>');
    /* v2660 · E7 · Vergleichswert aus dem Immobilienrichtwert - eine Zeile, nur wo ein Richtwert vorliegt */
    var VW = V.vergleichswert;
    if (VW && VW.verfuegbar) ein.push('<li data-dp-vgl-irw="1"><b>Vergleichswert:</b> ' + eur(VW.wert) + ' (' + Math.round(VW.eur_qm).toLocaleString('de-DE')
      + ' €/m², Immobilienrichtwert, Stufe A' + (VW.fuehrend ? ', führend' : '') + ')</li>');
    else if (VW && VW.irw_qm != null) ein.push('<li data-dp-vgl-irw="1"><b>Vergleichswert:</b> nicht gerechnet'
      + (VW.fehlt && VW.fehlt.length ? ' — fehlt: ' + esc(VW.fehlt.join(', ')) : '') + '.</li>');
    /* v2842 · Marcel: Texte zwischen den Tabellen kürzen - Zins, Miete, Merkmale und Modellprüfung aufklappbar */
    var MP0 = V.modellpruefung || {};
    var mpZeile = (MP0.kurz || MP0.text) ? 1 : 0;
    if (ein.length || mpZeile) h += '<details class="dp-pot-mehr"><summary>Zins, Miete und Merkmale (' + (ein.length + mpZeile) + ')</summary>';
    if (ein.length) h += '<ul class="dp-vgl-ein">' + ein.join('') + '</ul>';
    var MP = V.modellpruefung || {};
    if (MP.kurz || MP.text) {
      var abw = MP.abweichend && MP.abweichend.length;
      /* v2600 · im Modell: eine kurze Zeile (Ausschuss und Schwellenart nur bei Abweichung) */
      h += '<div class="dp-vgl-mp' + (abw ? ' ab' : '') + '"><b>Modellprüfung des Zinses:</b> '
        + esc(abw ? MP.text : (MP.kurz || MP.text) + '.')
        + (abw && MP.schwellen_art ? ' <span class="dp-pot-u" style="display:inline">Schwellen: ' + esc(MP.schwellen_art) + '.</span>' : '') + '</div>';
    }
    if (ein.length || mpZeile) h += '</details>';
    var U = Array.isArray(V.ursachen) ? V.ursachen : [];
    if (D && U.length) {
      /* eingeklappt, die Zählung im Kopf sichtbar - die Tafel v2577 bleibt kompakt */
      var zahl = {}; U.forEach(function (x) { zahl[x.status] = (zahl[x.status] || 0) + 1; });
      h += '<details class="dp-pot-mehr" data-dp-vgl-urs="1"><summary>Warum die Werte auseinanderliegen: '
        + ['nachgewiesen', 'plausibel', 'nicht_pruefbar'].filter(function (k) { return zahl[k]; }).map(function (k) { return zahl[k] + ' ' + ST[k][0]; }).join(' · ')
        + ' <span class="dp-pot-u" style="display:inline">(Anteile nicht bezifferbar)</span></summary><ul class="dp-vgl-urs">'
        + U.map(function (x) { var s = ST[x.status] || [x.status, '']; return '<li><span class="dp-vgl-st ' + s[1] + '">' + esc(s[0]) + '</span><span>' + esc(x.text) + '</span></li>'; }).join('')
        + '</ul></details>';
    }
    return h + '</div>';
  }

  /* ── v2842 · ABRUFLEISTE (Marcel 22.10.2026: „die Abrufe müssen schlüssiger sein") ──
     Ein Bereich oben: je Abruf Stand/Datum, was er kostet, ein Knopf. Die Rückfrage
     und der Lauf des Marktpreis-Abrufs stehen in derselben Zeile. */
  var KURZ_AUSBLICK = 'Mieterhöhung: Wert zum heutigen Stichtag, Erhöhungen erst ab Wirksamkeit und abgezinst. Zielbild: Ausblick mit umgesetzten Maßnahmen – kein heutiger Verkehrswert.';   /* v3151 */
  function abrufLeiste(r, zu, W) {
    var z1, b1;
    if (zu) { z1 = 'Gehört zu Stufe 3 (Wertermittlung nach ImmoWertV).'; b1 = '<button type="button" class="dp-pot-knopf" data-dp-pot-stufe3="1">Stufe 3 im Tab Objekt</button>'; }
    else {
      var veraltet = ergebnisVeraltet(), grund = grundGespeichert();
      z1 = (r && r.verfuegbar) ? '<b>aktuell</b> · mit den heutigen Angaben gerechnet'
        : (veraltet ? '<b>veraltet</b> · die Angaben haben sich seit der letzten Rechnung geändert'
          : (grund ? esc(grund) : (W && W.quelle === 'abruf' ? 'noch nicht gerechnet · die Tafel zeigt den Abruf vom ' + esc(W.datum) : 'noch nicht gerechnet')));
      b1 = '<button type="button" class="dp-pot-knopf" data-dp-pot-rechnen="1">' + (r && r.verfuegbar ? 'Neu rechnen' : 'Ertragswerte rechnen') + '</button>';
    }
    var n = (_markt.abrufe || []).length, z2, b2;
    if (_markt.zustand === 'frage') {
      z2 = '<b>Jetzt abrufen?</b> Kostet 1 × erweiterte Marktpreisindikation; Ergebnis und Datum werden gespeichert.';
      b2 = '<button type="button" class="dp-pot-knopf" data-dp-markt-ja="1">Ja, abrufen</button> <button type="button" class="dp-pot-knopf" data-dp-markt-nein="1">Abbrechen</button>';
    } else if (_markt.zustand === 'laeuft') { z2 = 'wird abgerufen …'; b2 = ''; }
    else {
      z2 = _markt.daten ? 'letzter Abruf <b>' + esc(new Date(_markt.daten.abgerufen_am).toLocaleDateString('de-DE')) + '</b>' + (n > 1 ? ' · ' + n + ' Abrufe im Verlauf' : '')
        : 'noch kein Abruf';
      if (_markt.fehler) z2 += ' · <span style="color:#7a3f3a">' + esc(_markt.fehler) + '</span>';
      b2 = '<button type="button" class="dp-pot-knopf" data-dp-markt-abruf="1">' + (_markt.daten ? 'Neu abrufen' : 'Marktpreise abrufen') + '</button>';
    }
    var zeile = function (t, stand, kosten, knopf) {
      return '<div class="dp-abr-z"><div class="dp-abr-t"><b>' + t + '</b><span>' + stand + '</span></div><div class="dp-abr-k">' + kosten + '</div><div class="dp-abr-b">' + knopf + '</div></div>';
    };
    return '<div class="dp-abr" data-dp-abruf="1"><div class="dp-abr-kopf">Abrufe für dieses Objekt</div>'
      + zeile('1 · Ertragswerte je Stufe', z1, zu ? 'Stufe 3' : 'ohne Kontingent', b1)
      + zeile('2 · Marktpreise am Ort', z2, '1 × erweiterte Marktpreisindikation', b2)
      + '</div>';
  }
  function tafelHtml(o) {
    o = o || {};
    stilEinhaengen();
    var m = modell(); if (!m.aktiv) return '';
    var r = ergebnis();
    var kz = kennzahlen(m), A = o.ohneAnkauf ? null : ankaufKurz();
    var cols = [];
    if (A) cols.push({ k: 'ankauf', t: 'Ankauf', c: '' });
    cols.push({ k: 'bestand', t: 'Bestand', c: '' });
    if (m.stufen.mieterhoehung) cols.push({ k: 'mieterhoehung', t: 'Mieterhöhung', c: 'c-soll', z: 'Mieter bleibt' });
    if (m.stufen.zielbild) cols.push({ k: 'zielbild', t: 'Zielbild', c: 'c-ziel', z: 'nach Umbau' });
    /* v2431 · ohne Stufe 3 keine Wertzeilen (auch die Restnutzungsdauer kommt
       aus dem Kern) - statt „—" als scheinbarer Wert steht der Hinweis unten. */
    var zu = gesperrt(r);
    var W = zu ? null : wertQuelle(r), WS = (W && W.S) || {};
    /* ein Abruf führt die Zahl der leeren Wohnungen nicht mit - dann aus der Wohnungsliste */
    if (W && W.quelle === 'abruf') W.leer = (m.wohnungen || []).filter(function (w) { return w.status === 'leer' && w.art !== 'gewerbe' && w.wfl > 0; }).length;
    var MPI = W && W.mpi ? W.mpi : null;
    var mpiDa = !!(MPI && MPI.angebote && MPI.angebote.verfuegbar);
    var rfDa = !!(MPI && MPI.rohertragsfaktor && MPI.rohertragsfaktor.verfuegbar);
    var kfDa = !!(MPI && MPI.kauffaelle && MPI.kauffaelle.verfuegbar);   /* v3041 · Ø Kaufpreis aus Kauffällen */
    function x(k) { return k === 'ankauf' ? A : kz[k]; }
    /* v3213 · W-6: Ziel-Bruttomietrendite je Spalte (Stufen als Parameter in den Rechenteil) */
    var JA6 = jahre(m), ZB6 = zielBmrStufenAusProfil();
    var ZB = zielBmrPruefen(ZB6, JA6.ankauf, cols.map(function (c) {
      var j = c.k === 'ankauf' ? JA6.ankauf : c.k === 'bestand' ? new Date().getFullYear() : JA6[c.k];
      var v = x(c.k); return { k: c.k, jahr: j, bmy: v && v.bmy != null ? Number(v.bmy) : null };
    }));
    var rows = [
      { gr: 'Miete & Rendite' },
      { t: 'Kaltmiete p. a.', f: function (k) { var v = x(k); return v && v.miete_j != null ? zz(eur(v.miete_j), v.miete_qm ? eur2(v.miete_qm) + '/m²' : '') : null; } },
      { t: 'Bruttomietrendite', u: 'auf Kaufpreis + Maßnahmen', f: function (k) { var v = x(k); return v && v.bmy != null ? pct(v.bmy) : null; } },
      /* v3213 · W-6: Ziellinie aus dem Anlegerprofil, je Spalte im Jahr der Spalte */
      { t: 'Ziel-Bruttomietrendite', u: 'Ziellinie im Anlegerprofil', f: function (k) {
          var e = ZB[k]; if (!e) return null;
          if (e.ziel == null) return zz('—', e.nach < 0 ? 'vor dem Kauf' : 'noch keine Stufe (Jahr ' + e.nach + ')');
          var wort = e.erreicht == null ? '' : (e.erreicht ? '<span style="color:#3FA56C;font-weight:600">✓ erreicht</span>' : '<span style="color:#B8625C;font-weight:600">nicht erreicht</span>');
          return zz(pct(e.ziel, 1) + ' <span class="dp-pot-jahr">ab Jahr ' + e.ziel_ab + '</span>', wort); } },
      { t: 'Cashflow / Monat', u: 'vor Steuer', f: function (k) { var v = x(k); return v && v.cf_m != null ? eur(v.cf_m) : null; } },
      { t: 'DSCR', f: function (k) { var v = x(k); return v && v.dscr != null ? dez(v.dscr, 2) : null; } },
      { t: 'Maßnahmenkosten', f: function (k) { var v = x(k); return k !== 'ankauf' && v && v.kosten ? eur(v.kosten) : null; } },
      { t: 'Modernisierungspunkte', u: 'Anlage 2 ImmoWertV', f: function (k) {
          var v = x(k), w = WS[k], mp = w && W.quelle === 'lauf' ? w.mod : null, plus = k !== 'ankauf' && v && v.plus ? v.plus : 0;
          return mp != null ? pk(mp) + (plus ? ' (+' + pk(plus) + ')' : '') : (plus ? '+' + pk(plus) : null); } }
    ];
    if (W) {
      var ab = mpiDa ? abschlagPct(MPI.angebote.abschlag_pct) : null;
      var lzsT = lzsKurz(W.lzs);
      rows.push({ gr: 'Wert' + (W.quelle === 'abruf' ? ' · laut Abruf Marktpreise vom ' + esc(W.datum) : '') });
      rows.push({ t: 'Ertragswert', u: [lzsT, W.leer ? W.leer + ' leere Wohnung' + (W.leer === 1 ? '' : 'en') + ' mit marktüblicher Miete' : ''].filter(Boolean).join(' · '),
        f: function (k) { var w = WS[k]; return w && w.ew != null ? zz('<b>' + eur(w.ew) + '</b>', w.rnd != null ? '<abbr title="Restnutzungsdauer" style="text-decoration:none">RND</abbr>&nbsp;' + dez(w.rnd, 0) + '&nbsp;J.' : '') : null; } });
      if (mpiDa) rows.push({ t: 'Marktpreisindikation', u: 'Angebote am Ort' + (ab ? ', abzüglich ' + ab + ' % Abschlag (' + abschlagKurz(MPI.angebote.abschlag_herkunft, MPI.angebote.abschlag_kurz) + ')' : ''),
        f: function (k) { var w = WS[k]; if (!w || w.mpi == null) return null;
          /* v2842 · Marcel: „Sind da Abschläge drin?" - der Wert ohne Abschlag steht klein darunter */
          var oh = w.mpiOhne != null ? 'ohne Abschlag ' + eur(w.mpiOhne) : '';
          return zz(eur(w.mpi), [k === 'mieterhoehung' ? 'wie Bestand' : (w.spanne ? spanneTsd(w.spanne[0], w.spanne[1]) : ''), oh].filter(Boolean).join('<br>')); } });
      /* v2854/v2842 · Sanierungsstau: durch die Maßnahmen der Stufe behoben, Rest */
      if (['bestand', 'mieterhoehung', 'zielbild'].some(function (k) { return WS[k] && stauDaten(WS[k].stau); }))
        rows.push({ t: 'Sanierungsstau', u: 'boG nach § 8 Abs. 3; Maßnahmen der Stufe beheben ihn', f: function (k) { var w = WS[k]; return w ? stauZeile(w.stau) : null; } });
      if (rfDa) rows.push({ t: 'Rohertragsfaktor × Miete', u: 'Faktor ' + pk(MPI.rohertragsfaktor.faktor) + ' · '
          + esc(String(MPI.rohertragsfaktor.ausschuss || 'Gutachterausschuss').replace(/^Der\s+/, '')) + (MPI.rohertragsfaktor.berichtsjahr ? ' ' + esc(MPI.rohertragsfaktor.berichtsjahr) : ''),
        f: function (k) { var w = WS[k]; return w && w.rf != null ? eur(w.rf) : null; } });
      /* v3041 · Marcel 29.10.2026: „wenn Vergleichswerte möglich, dann auf jeden Fall mit angeben, auch in den Pilot-Analyse-Tabs“ */
      if (kfDa) rows.push({ t: 'Ø Kaufpreis aus Kauffällen', u: kauffaelleUnter(MPI.kauffaelle),
        f: function (k) { return WS[k] ? zz(eur(MPI.kauffaelle.wert), k === 'bestand' ? '' : 'unabhängig von Miete und Maßnahmen') : null; } });
    }
    var JA = jahre(m);   /* v2541 · Jahr je Stufe im Spaltenkopf */
    var jahrVon = function (k) { var j = k === 'ankauf' || k === 'bestand' ? JA.ankauf : JA[k]; return j ? String(j) : (k === 'zielbild' ? 'Jahr offen' : ''); };
    var n = cols.length + 1;
    /* dptk-alle: tabellen-karten.js klappt auf dem Handy ab der 5. Spalte ein - hier wäre das das Zielbild */
    var html = '<div class="dp-pot">' + (o.ohneLeiste ? '' : abrufLeiste(r, zu, W)) + '<div class="dp-pot-scroll"><table class="dptk-alle"><thead><tr><th>Kennzahl</th>'
      + cols.map(function (c) { var j = c.k === 'bestand' && A ? 'heute' : jahrVon(c.k);
          return '<th class="' + c.c + '">' + c.t + ((j || c.z) ? ' <span class="dp-pot-jahr">' + esc([j, c.z].filter(Boolean).join(' · ')) + '</span>' : '') + '</th>'; }).join('')
      + '</tr></thead><tbody>'
      + rows.map(function (row) {
          if (row.gr) return '<tr class="dp-pot-gr"><td colspan="' + n + '">' + row.gr + '</td></tr>';
          var zellen = cols.map(function (c) { var v = null; try { v = row.f(c.k); } catch (e) { v = null; } return v; });
          if (!zellen.some(function (v) { return v != null && v !== ''; })) return '';   /* v2577 · keine Zeile aus lauter „—" */
          return '<tr><td>' + zz(row.t, row.u) + '</td>' + cols.map(function (c, i) { return '<td class="' + c.c + '">' + (zellen[i] != null && zellen[i] !== '' ? zellen[i] : '—') + '</td>'; }).join('') + '</tr>';
        }).join('');
    var HB = WS.bestand;
    if (HB && HB.ew != null && (WS.zielbild || WS.mieterhoehung)) {
      html += '<tr class="dp-pot-sum"><td>' + zz('Wertzuwachs nach Kosten', 'Ertragswert der Stufe − Bestand − Maßnahmen') + '</td>' + cols.map(function (c) {
        if (c.k === 'ankauf' || c.k === 'bestand') return '<td></td>';
        var h = WS[c.k], kk = (m.stufen[c.k] && m.stufen[c.k].kosten) || 0;
        return '<td class="' + c.c + '">' + (h && h.ew != null ? (h.ew - HB.ew - kk >= 0 ? '+' : '') + eur(h.ew - HB.ew - kk) : '—') + '</td>';
      }).join('') + '</tr>';
    }
    html += '</tbody></table></div>';
    /* v2595 · Bestand im Vergleich - aus dem Lauf, sonst aus dem gespeicherten Abruf */
    if (W) html += vergleichHtml((r && r.verfuegbar && r.vergleich) || (W.mpi && W.mpi.vergleich) || null);
    var auf = r && r.verfuegbar && r.aufteilung && r.aufteilung.je_stufe && r.aufteilung.je_stufe.bestand;
    if (auf) html += aufteilungHtml(m, r, cols);
    /* Sichtbar bleibt die Kennzeichnung; alles Weitere eingeklappt */
    /* v2842 · kurz sichtbar, der volle Wortlaut (v2870) steht unter „So ist gerechnet" */
    html += '<p class="dp-pot-kenn">' + KURZ_AUSBLICK + '</p>';
    var li = [esc(KENNZEICHNUNG)];
    li.push('Score und Verkehrswert rechnen mit dem Bestand.');
    if (r && r.verfuegbar && r.basis) li.push('Liegenschaftszins ' + esc(pct(r.basis.lzs_pct)) + (r.basis.lzs_stufe ? ' (Stufe ' + esc(r.basis.lzs_stufe) + ')' : '')
      + ', Bewirtschaftung, Gesamtnutzungsdauer und Bodenwert wie im Marktbericht Stufe 3; je Stufe wechseln Miete und Restnutzungsdauer (Anlage 2 ImmoWertV).');
    if (r && r.verfuegbar && r.basis && r.basis.bestandsbasis && r.basis.bestandsbasis.hinweis) li.push(esc(r.basis.bestandsbasis.hinweis));
    if (W && W.leer) li.push('Leere Wohnungen gehen mit der marktüblichen Miete in den Rohertrag ein (§ 31 Abs. 2 ImmoWertV). Mietausfall bis zur Wiedervermietung und Kosten der Herrichtung sind nicht abgezogen — sie sind als besonderes objektspezifisches Grundstücksmerkmal (§ 8 Abs. 3 ImmoWertV) zu würdigen.');
    if (W && W.quelle === 'abruf') li.push('Die Wertzeilen stammen aus dem Abruf „Marktpreise" vom ' + esc(W.datum) + ' und sind mit den damaligen Angaben gerechnet; „Ertragswerte rechnen" rechnet sie mit den heutigen.');
    li.push('Cashflow und DSCR bei gleicher Finanzierung und gleichen Kosten.');
    if (m.kappung && m.kappung.text) li.push(esc(m.kappung.text));
    if (MPI) { var mf = mpiFuss(MPI); if (mf) li.push(esc(mf)); }
    if (mpiDa && MPI.angebote.abschlag_herkunft && /^örtlich/.test(MPI.angebote.abschlag_herkunft)) li.push('Abschlag auf Angebotspreise ' + esc(MPI.angebote.abschlag_herkunft) + '.');
    li.push(esc(jahreFuss(JA)));
    /* v3213 · W-6 */
    if (ZB6.length) li.push(esc('Ziel-Bruttomietrendite aus deinem Anlegerprofil: ' + ZB6.map(function (s) { return 'nach ' + s.jahr + (s.jahr === 1 ? ' Jahr ' : ' Jahren ') + pct(s.pct, 1); }).join(', ')
      + (JA.ankauf ? ' — gezählt ab dem Kaufjahr ' + JA.ankauf + '; je Spalte gilt die Stufe ihres Jahres (Bestand = heute, Zielbild = „Zielbild fertig (Jahr)").' : ' — ohne Kaufdatum (Reiter Objekt) lässt sich kein Jahr zuordnen.')));
    if (auf) li = li.concat(aufteilungFuss(m, r));
    html += '<details class="dp-pot-mehr"><summary>So ist gerechnet</summary><ul>' + li.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></details>';
    /* v2842 · Knöpfe „Ertragswerte rechnen" und „Stufe 3" stehen jetzt in der Abrufleiste oben */
    if (o.ohneLeiste && zu) {
      html += '<div class="dp-pot-stufe3"><b>' + esc(GESPERRT_KURZ) + '</b><span>' + esc(GESPERRT_LANG) + '</span>'
        + '<button type="button" class="dp-pot-knopf" data-dp-pot-stufe3="1">Stufe 3 im Tab Objekt</button></div>';
    } else if (o.ohneLeiste && (!r || !r.verfuegbar)) {
      html += '<p class="dp-pot-hin"><button type="button" class="dp-pot-knopf" data-dp-pot-rechnen="1">Ertragswerte rechnen</button></p>';
    }
    if (!o.ohneMarkt) html += '<div data-dp-pot-markt="1" style="margin-top:16px">' + marktHtml() + '</div>';   /* v2542 */
    return html + '</div>';
  }
  /* ══ v2542 · ABRUF „MARKTPREISE" UND VERLAUF (Tab Pilot-Analyse) ═════════════
     Marcel 20.10.2026: Spannen, Mieten und €/m² vollumfänglich; abrufbar aus der
     Pilot-Analyse, kostet 1 × erweiterte Marktpreisindikation, geht mit in den
     Marktbericht, mehrere Abrufe werden als Verlauf bewertet. Gespeichert wird im
     Marktbericht-Dienst (mb.potenzial_abrufe); hier wird nur angezeigt. */
  var _markt = { key: null, laedt: false, daten: null, einordnung: null, abrufe: [], zustand: 'ruhe', fehler: null };
  function marktKey() { return (typeof window._currentObjKey === 'string' && window._currentObjKey) || null; }
  function marktVerlaufLaden(neuZeichnen) {
    var key = marktKey();
    if (!key || !window.Auth || typeof Auth.apiCall !== 'function') return;
    if (_markt.laedt && _markt.key === key) return;
    _markt.laedt = true; _markt.key = key;
    Auth.apiCall('/marktbericht/potenzial/markt/verlauf?external_ref=' + encodeURIComponent(key)).then(function (r) {
      _markt.laedt = false;
      if (marktKey() !== key) return;
      _markt.abrufe = (r && r.abrufe) || [];
      _markt.daten = _markt.abrufe.length ? _markt.abrufe[0] : null;
      _markt.einordnung = (r && r.einordnung) || null;
      if (neuZeichnen !== false) marktNeuZeichnen();
      try { window.dispatchEvent(new CustomEvent('dp:potenzial-markt')); } catch (e) {}   /* v2840 */
    }, function () { _markt.laedt = false; });
  }
  /* v2577 · die Tafel oben kann ihre Wertzeilen aus dem Abruf nehmen - nach dem
     Laden des Verlaufs wird deshalb die ganze Tafel neu gezeichnet, nicht nur
     der Abschnitt Marktpreise (sonst klappte unten „Je Stufe" ein, und oben
     fehlten die Zahlen noch). */
  function marktNeuZeichnen() {
    var h = document.querySelectorAll('[data-dp-pot-markt]');
    for (var i = 0; i < h.length; i++) {
      var w = h[i].closest ? h[i].closest('[data-dp-pot-wirt]') : null;
      if (w) { try { w.innerHTML = tafelHtml(); continue; } catch (e) {} }
      h[i].innerHTML = marktHtml();
    }
  }
  function spanne(a, b, f) { return a != null && b != null ? f(a) + ' – ' + f(b) : '—'; }
  /* v2577 · Spanne klein unter der Zahl: in Tausend (die Werte sind auf 1.000/5.000 € gerundet - kein Verlust) */
  function spanneTsd(a, b) {
    if (a == null || b == null) return '';
    if (!(a >= 100000 && b >= 100000)) return 'Spanne ' + spanne(a, b, eur);
    return 'Spanne <span style="white-space:nowrap">' + Math.round(a / 1000).toLocaleString('de-DE') + '–' + Math.round(b / 1000).toLocaleString('de-DE') + '&nbsp;Tsd.&nbsp;€</span>';
  }
  function aufklapp(titel, inhalt) { return '<details class="dp-pot-mehr"><summary>' + titel + '</summary>' + inhalt + '</details>'; }
  function marktHtml() {
    var key = marktKey();
    if (_markt.key !== key) { _markt.daten = null; _markt.abrufe = []; _markt.einordnung = null; _markt.zustand = 'ruhe'; marktVerlaufLaden(); }
    var knopf = '';   /* v2842 · Knopf, Rückfrage und Lauf stehen in der Abrufleiste oben (abrufLeiste) */
    var kopf = '<div class="dp-markt-kopf"><b>Marktpreise</b><span>Kaufpreise und Angebotsmieten am Ort, Marktpreisindikation je Stufe und je Wohnung — mit Spannen.</span></div>';
    if (!_markt.daten) return '<div class="dp-markt">' + kopf + '<p class="dp-pot-hin">Für dieses Objekt liegt noch kein Abruf vor — oben unter „Abrufe" abrufen.</p></div>';
    var D = _markt.daten.daten || {}, M = D.markt || {}, S = D.stufen || {};
    /* v2842 · Abschlag des Abrufs an jeder Marktpreisindikation */
    var abP = M.abschlag_pct != null ? M.abschlag_pct : (D.mpi && D.mpi.angebote ? D.mpi.angebote.abschlag_pct : null);
    var nachAb = abP != null && Number(abP) > 0 ? ', nach ' + esc(String(Math.round(Number(abP) * 10) / 10).replace('.', ',')) + ' % Abschlag' : '';
    var dt = new Date(_markt.daten.abgerufen_am).toLocaleDateString('de-DE');
    var qm0 = function (v) { return v == null ? '—' : Math.round(v).toLocaleString('de-DE') + ' €/m²'; };
    var qm2 = function (v) { return v == null ? '—' : eur2(v) + '/m²'; };
    var zm = function (t, x, f, zus) { return '<tr><td>' + t + '</td><td>' + (x ? f(x.median_qm) : '—') + '</td><td>' + (x ? spanne(x.q25_qm, x.q75_qm, f) : '—') + '</td><td>'
      + (x && x.angebote != null ? x.angebote + (x.radius_km ? ' · ' + dez(x.radius_km, 1).replace(',0', '') + ' km' : '') : '—') + (zus || '') + '</td></tr>'; };
    var html = '<div class="dp-markt">' + kopf + '<p class="dp-pot-hin" style="margin-top:0">Abruf vom <b>' + esc(dt) + '</b>'
      + (M.abschlag_pct != null ? ' · Abschlag auf Angebotspreise ' + esc(String(M.abschlag_pct).replace('.', ',')) + ' %' : '') + '</p>'
      + '<div class="dp-pot-scroll"><table><thead><tr><th>Markt am Ort</th><th>Median</th><th>Spanne (Q25–Q75)</th><th>Angebote · Umkreis</th></tr></thead><tbody>'
      + zm('Kaufpreis ' + (M.kauf_haus && /mfh|mehrfam/i.test(M.kauf_haus.segment || '') ? 'Mehrfamilienhaus' : 'Haus/Objekt'), M.kauf_haus, qm0)
      + zm('Kaufpreis Eigentumswohnung', M.kauf_etw, qm0)
      + zm('Angebotsmiete', M.miete, qm2)
      + '</tbody></table></div>';
    var sp = ['bestand', 'mieterhoehung', 'zielbild'].filter(function (k) { return S[k]; });
    var T = { bestand: 'Bestand', mieterhoehung: 'Mieterhöhung', zielbild: 'Zielbild' };
    /* v2577 · „Je Stufe": steht die Tafel oben schon auf DIESEM Abruf, wäre die
       Tabelle eine Wiederholung - dann entfällt sie. Steht die Tafel auf einem
       aktuellen Ertragswert-Lauf, klappt die Fassung des Abrufs ein. */
    var rr = ergebnis(), zuM = gesperrt(rr), Wq = zuM ? null : wertQuelle(rr);
    if (sp.length && !(Wq && Wq.quelle === 'abruf')) {
      var jeStufe = '<div class="dp-pot-scroll"' + (Wq ? '' : ' style="margin-top:10px"') + '><table><thead><tr><th>Je Stufe</th>' + sp.map(function (k) { return '<th>' + T[k] + '</th>'; }).join('') + '</tr></thead><tbody>'
        + '<tr><td>Ertragswert</td>' + sp.map(function (k) { return '<td>' + (S[k].ertragswert != null ? eur(S[k].ertragswert) : '—') + '</td>'; }).join('') + '</tr>'
        + '<tr><td>Marktpreisindikation (Angebote' + nachAb + ')</td>' + sp.map(function (k) { return '<td><b>' + (S[k].mpi_angebote != null ? eur(S[k].mpi_angebote) : '—') + '</b></td>'; }).join('') + '</tr>'
        + '<tr><td>Spanne</td>' + sp.map(function (k) { var s = S[k].mpi_spanne; return '<td>' + (s ? spanne(s[0], s[1], eur) : '—') + '</td>'; }).join('') + '</tr>'
        + '<tr><td>Rohertragsfaktor × Miete</td>' + sp.map(function (k) { return '<td>' + (S[k].rohertragsfaktor_x_miete != null ? eur(S[k].rohertragsfaktor_x_miete) : '—') + '</td>'; }).join('') + '</tr>'
        + '</tbody></table></div>';
      html += Wq ? aufklapp('Je Stufe laut diesem Abruf (die Tafel oben rechnet mit den heutigen Angaben)', jeStufe) : jeStufe;
    }
    var W = (D.wohnungen || []).filter(function (w) { return w.art !== 'gewerbe' && w.mpi_etw; });
    if (W.length) {
      html += aufklapp('Je Wohnung als Eigentumswohnung (' + W.length + ')', '<div class="dp-pot-scroll"><table><thead><tr><th>Je Wohnung als ETW</th><th>m²</th><th>Ertragswert</th><th>Marktpreisindikation' + (nachAb ? '<br><span style="font-weight:400;text-transform:none">' + nachAb.slice(2) + '</span>' : '') + '</th><th>Spanne</th><th>€/m² (Median)</th></tr></thead><tbody>'
        + W.map(function (w) { var e = w.mpi_etw;
            return '<tr><td>' + esc(w.nr || '') + '</td><td>' + dez(w.wfl, 0) + '</td><td>' + (w.als_etw && w.als_etw.bestand != null ? eur(w.als_etw.bestand) : '—') + '</td><td><b>'
              + (e.bestand != null ? eur(e.bestand) : '—') + '</b></td><td>' + spanne(e.low, e.high, eur) + '</td><td>' + qm0(e.median_qm) + '</td></tr>'; }).join('')
        + (D.etw_markt && D.etw_markt.summe_bestand != null ? '<tr class="dp-pot-sum"><td>Summe</td><td></td><td>' + (D.wohnungen.some(function (w) { return w.als_etw; })
            ? eur(D.wohnungen.reduce(function (a, w) { return a + ((w.als_etw && w.als_etw.bestand) || 0); }, 0)) : '—') + '</td><td>' + eur(D.etw_markt.summe_bestand) + '</td><td>'
            + spanne(D.etw_markt.summe_low, D.etw_markt.summe_high, eur) + '</td><td></td></tr>' : '')
        + '</tbody></table></div>'
        + '<p class="dp-pot-hin">Angebote für Eigentumswohnungen gleichen Baujahrs in der Flächenklasse der Wohnung.</p>');
    }
    var Z = _markt.abrufe || [], E = _markt.einordnung;
    html += aufklapp('Verlauf · ' + Z.length + ' Abruf' + (Z.length === 1 ? '' : 'e'), '<div class="dp-pot-scroll"><table><thead><tr><th>Verlauf</th><th>Kauf Haus</th><th>Kauf ETW</th><th>Angebotsmiete</th><th>Marktpreisindikation (nach Abschlag)</th></tr></thead><tbody>'
      + Z.slice(0, 12).map(function (z) { var d = z.daten || {}, m = d.markt || {}, b = d.stufen && d.stufen.bestand;
          return '<tr><td>' + esc(new Date(z.abgerufen_am).toLocaleDateString('de-DE')) + '</td><td>' + qm0(m.kauf_haus && m.kauf_haus.median_qm) + '</td><td>'
            + qm0(m.kauf_etw && m.kauf_etw.median_qm) + '</td><td>' + qm2(m.miete && m.miete.median_qm) + '</td><td>' + (b && b.mpi_angebote != null ? eur(b.mpi_angebote) : '—') + '</td></tr>'; }).join('')
      + '</tbody></table></div>'
      + (E && E.text ? '<p class="dp-pot-hin" style="color:#4a4436">' + esc(E.text) + '</p>' : ''));
    html += '<p class="dp-pot-hin" style="font-size:10.5px">Angebotspreise und -mieten, keine Kaufpreise; die Marktpreisindikation zieht den Abschlag auf Angebotspreise ab. Zielbild mit Zustand „modernisiert".</p>'
      + '</div>';
    return html;
  }
  /* v2556c · Marcel 21.10.2026: „Es muss gezeigt werden, ob die Marktpreis-
     indikation gerade läuft." Ein Abruf dauert 10-40 s; der Hinweis im Block
     stand oft ausserhalb des Sichtbaren. Jetzt ein Fenster mit Sekundenzaehler,
     das erst mit dem Ergebnis geht - und solange keinen zweiten Klick zulaesst. */
  var _lauf2 = null;
  function laufAnzeige(an, titel, text) {
    var ov = document.getElementById('dp-pot-lauf');
    if (!an) { if (_lauf2) clearInterval(_lauf2); _lauf2 = null; if (ov) ov.remove(); return; }
    if (!document.getElementById('dp-pot-lauf-css')) {
      var st = document.createElement('style'); st.id = 'dp-pot-lauf-css';
      st.textContent = '#dp-pot-lauf{position:fixed;inset:0;z-index:2147483000;background:rgba(5,5,5,.55);display:flex;align-items:center;justify-content:center;padding:16px}'
        + '#dp-pot-lauf .k{background:#FDFCFA;color:#2A2727;border-radius:14px;padding:22px 24px;max-width:420px;width:100%;box-shadow:0 18px 50px rgba(0,0,0,.35);border-top:3px solid var(--wl-c9a84c, #C9A84C);font:400 13.5px/1.5 Inter,sans-serif}'
        + '#dp-pot-lauf b{display:block;font:600 16px "Space Grotesk",sans-serif;margin-bottom:6px}'
        + '#dp-pot-lauf .r{width:34px;height:34px;border-radius:50%;border:3px solid #EFE6CC;border-top-color:var(--wl-c9a84c, #C9A84C);animation:dpPotDreh 1s linear infinite;margin-bottom:12px}'
        + '#dp-pot-lauf .z{margin-top:10px;font:500 11px "JetBrains Mono",monospace;color:#6B645A}'
        + '@keyframes dpPotDreh{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){#dp-pot-lauf .r{animation:none}}';
      document.head.appendChild(st);
    }
    if (!ov) { ov = document.createElement('div'); ov.id = 'dp-pot-lauf'; ov.setAttribute('role', 'status'); ov.setAttribute('aria-live', 'polite'); document.body.appendChild(ov); }
    var t0 = Date.now();
    ov.innerHTML = '<div class="k"><div class="r"></div><b>' + esc(titel) + '</b>' + esc(text) + '<div class="z">läuft seit 0 s</div></div>';
    if (_lauf2) clearInterval(_lauf2);
    _lauf2 = setInterval(function () { var z = ov.querySelector('.z'); if (z) z.textContent = 'läuft seit ' + Math.round((Date.now() - t0) / 1000) + ' s'; }, 1000);
  }
  function marktAbrufen() {
    var m = modell(); if (!m.aktiv) return;
    var body = auftrag(m, {}); if (!body) return;
    if (_markt.zustand === 'laeuft') return;
    _markt.zustand = 'laeuft'; _markt.fehler = null; marktNeuZeichnen();
    laufAnzeige(true, 'Marktpreisindikation läuft', 'Kaufpreise und Mieten am Ort werden abgerufen und je Stufe und Wohnung gerechnet. Das dauert meist 10 bis 40 Sekunden.');
    var key = marktKey();
    Auth.apiCall('/marktbericht/potenzial/markt', { method: 'POST', body: body }).then(function (r) {
      _markt.zustand = 'ruhe'; laufAnzeige(false);
      if (marktKey() !== key) return;
      if (!r || r.error) { _markt.fehler = (r && (r.message || r.error)) || 'Abruf nicht möglich.'; marktNeuZeichnen(); return; }
      /* v2556c · leer = nicht gespeichert, nicht abgerechnet: kein Erfolg melden */
      if (r.leer || !r.abruf) { _markt.fehler = r.grund || 'Für dieses Objekt kamen keine Marktdaten zurück.'; marktNeuZeichnen(); return; }
      if (typeof window.toast === 'function') window.toast('✓ Marktpreise abgerufen' + (r._kontingent && r._kontingent.charged ? ' · 1 × erweiterte Marktpreisindikation' : ''));
      _markt.key = null; marktVerlaufLaden();
      try { if (typeof window._dpLoadVerlauf === "function") window._dpLoadVerlauf(); } catch (e) {}   /* v2556c: Ablage sofort sichtbar */
    }, function (e) {
      _markt.zustand = 'ruhe'; laufAnzeige(false);
      _markt.fehler = /kontingent|402/i.test(String(e && e.message)) ? 'Für den Abruf ist dein Kontingent „erweiterte Marktpreisindikation" aufgebraucht.' : ('Abruf nicht möglich: ' + ((e && e.message) || 'Dienst nicht erreichbar'));
      marktNeuZeichnen();
    });
  }
  function aufteilungHtml(m, r, cols) {
    var a = r.aufteilung, H = r.haus;
    var sc = cols.filter(function (c) { return c.k !== 'ankauf'; });
    var z = function (t, f) { return '<tr><td>' + t + '</td>' + sc.map(function (c) { return '<td class="' + c.c + '">' + f(c.k) + '</td>'; }).join('') + '</tr>'; };
    var n = m.wohnungen.filter(function (w) { return w.art !== 'gewerbe'; }).length;
    var zi = a.zins && a.zins.bestand && a.zins.bestand.pct != null ? pct(a.zins.bestand.pct) : '—';
    /* v2431 · Herkunft des ETW-Zinses (der oertliche Ausschuss) steht seit v2577 in aufteilungFuss() */
    return '<div class="dp-pot-scroll" style="margin-top:12px"><table><thead><tr><th>Aufteilung</th>' + sc.map(function (c) { return '<th class="' + c.c + '">' + c.t + '</th>'; }).join('') + '</tr></thead><tbody>'
      + z('Haus als Ganzes', function (k) { return H[k] ? eur(H[k].wert) : '—'; })
      /* v3200 · führend der Vergleichswert je Wohnung, stützend der Ertragswert als Eigentumswohnung */
      + (a.aufteiler ? z(n + ' Wohnungen nach Vergleichswert <small>(führend)</small>', function (k) { var t = a.aufteiler[k]; return t ? eur(t.summe) + (t.vollstaendig ? '' : '*') : '—'; }) : '')
      + z(n + ' Eigentumswohnungen nach Ertragswert' + (a.aufteiler ? ' <small>(stützend)</small>' : '') + ' (Zins ' + zi + ')', function (k) { var s = a.je_stufe[k]; return s ? eur(s.summe) + (s.vollstaendig ? '' : '*') : '—'; })
      + z('− Kosten der Aufteilung', function () { return eur(-a.kosten_eur); })
      + (a.aufteiler ? '<tr class="dp-pot-sum"><td>Aufteilerwert</td>' + sc.map(function (c) { var t = a.aufteiler[c.k]; return '<td class="' + c.c + '">' + (t ? eur(t.wert) : '—') + '</td>'; }).join('') + '</tr>' : '')
      /* v2541 · dieselben Wohnungen nach Angebotspreisen für Eigentumswohnungen */
      + (a.mpi_etw && a.mpi_etw.summe_bestand != null ? z(n + ' Eigentumswohnungen nach Angeboten (Summe)', function (k) {
          var v = k === 'zielbild' ? a.mpi_etw.summe_zielbild : a.mpi_etw.summe_bestand; return v != null ? eur(v) : '—'; }) : '')
      /* v2431 · Marcel 19.10.2026: ein negatives Potenzial nicht als Zahl mit Minus
         in Gruen, sondern als „kein Potenzial" mit der Erklaerung darunter */
      + '<tr class="dp-pot-sum"><td>Aufteilungspotenzial</td>' + sc.map(function (c) {
          var s = a.aufteiler && a.aufteiler[c.k] ? a.aufteiler[c.k] : a.je_stufe[c.k];   /* v3200 · aus dem Aufteilerwert */
          if (s && s.potenzial < 0) return '<td class="dp-pot-neg">kein Potenzial</td>';
          return '<td class="' + c.c + '">' + (s ? '+' + eur(s.potenzial) : '—') + '</td>'; }).join('') + '</tr>'
      + '</tbody></table></div>'
      + (a.negativ_hinweis && !a.aufteiler ? '<p class="dp-pot-hin" style="color:#4a4436">' + esc(a.negativ_hinweis) + '</p>' : '')
      + (a.aufteiler && a.aufteiler.bestand ? '<p class="dp-pot-hin">Führendes Verfahren je Wohnung (Bestand): ' + verfahrenText(a.aufteiler.bestand.zaehl) + '.</p>' : '');
  }
  /* v3200 · wie viele Wohnungen nach welchem Verfahren */
  function verfahrenText(z) {
    if (!z) return '';
    var t = [];
    if (z.amtlich) t.push(z.amtlich + ' × Vergleichswert aus dem amtlichen Vergleichsfaktor');
    if (z.angebote) t.push(z.angebote + ' × Vergleichswert aus Angeboten (abzüglich Angebotsabschlag)');
    if (z.ertragswert) t.push(z.ertragswert + ' × Ertragswert als Eigentumswohnung (kein Vergleichswert verfügbar)');
    if (z.gewerbe) t.push(z.gewerbe + ' × Gewerbe mit Anteil am Haus');
    if (z.fehlt) t.push(z.fehlt + ' × ohne Wert');
    return t.join(' · ');
  }
  /* v2577 · der Fußtext der Aufteilung steht jetzt unter „So ist gerechnet" */
  function aufteilungFuss(m, r) {
    var a = r.aufteilung;
    var zA = a.zins && a.zins.bestand && a.zins.bestand.ausschuss ? String(a.zins.bestand.ausschuss).replace(/^Der\s+/, '') : '';
    return [a.aufteiler_hinweis ? esc(a.aufteiler_hinweis) : '', esc(a.hinweis || '') + (zA ? ' Zins für vermietetes Wohnungseigentum: ' + esc(zA) + '.' : ''),
      'Kosten der Aufteilung: ' + esc(m.aufteilungskosten_herkunft || a.kosten_herkunft || '') + '.'].filter(function (t) { return t && t !== '.'; });
  }

  /* ── v2840 · Wert je Stufe als reines Datenobjekt (Segment „Wert & Zielbild",
     Einfach-Ansicht der Pilot-Analyse). Dieselbe Quelle wie die Tafel: der aktuelle
     Ertragswert-Lauf, sonst der letzte Abruf „Marktpreise" (mit Datum). Lädt den
     Verlauf der Abrufe nach, wenn er für dieses Objekt fehlt (Leseroute, kein
     Kontingent) - danach kommt das Ereignis dp:potenzial-markt. */
  /* v2854-Feld je Stufe {stau_eur, kosten_eur, behoben_eur, rest_eur, text} als Datenobjekt (v2842) */
  function stauDaten(x) {
    if (!x || typeof x !== 'object') return null;
    var n = function (v) { return v == null || v === '' || !isFinite(Number(v)) ? null : Number(v); };
    var st = n(x.stau_eur != null ? x.stau_eur : x.stau);
    if (st == null) return null;
    return { stau: Math.abs(st), kosten: n(x.kosten_eur != null ? x.kosten_eur : x.kosten), behoben: n(x.behoben_eur != null ? x.behoben_eur : x.behoben),
      rest: n(x.rest_eur != null ? x.rest_eur : x.rest) != null ? Math.abs(n(x.rest_eur != null ? x.rest_eur : x.rest)) : null, satz: String(x.text || x.satz || '') };
  }
  function stauZeile(x) {
    var d = stauDaten(x); if (!d) return null;
    if (d.behoben > 0) return eur(d.behoben) + ' behoben, Rest ' + eur(d.rest || 0);
    return eur(d.stau) + ' offen';
  }
  function stufenWerte() {
    var r = null; try { r = ergebnis(); } catch (e) { r = null; }
    var alt = window._dpPotenzial;
    if (gesperrt(r) || (!r && alt && gesperrt(alt.ergebnis) && !ergebnisVeraltet())) return { gesperrt: true, quelle: null, S: {} };
    var key = marktKey();
    if (key && _markt.key !== key) { _markt.daten = null; _markt.abrufe = []; _markt.einordnung = null; _markt.zustand = 'ruhe'; marktVerlaufLaden(false); }
    var W = null; try { W = wertQuelle(r); } catch (e) { W = null; }
    var veraltet = false; try { veraltet = ergebnisVeraltet(); } catch (e) {}
    if (!W) return { gesperrt: false, quelle: null, S: {}, veraltet: veraltet };
    var S = {};
    Object.keys(W.S).forEach(function (k) { var w = W.S[k]; S[k] = { ertragswert: w.ew != null ? w.ew : null, rnd: w.rnd != null ? w.rnd : null,
      marktpreisindikation: w.mpi != null ? w.mpi : null, mpi_spanne: w.spanne || null, rohertragsfaktor_x_miete: w.rf != null ? w.rf : null,
      mpi_abschlag_pct: w.mpiAb != null && isFinite(Number(w.mpiAb)) ? Number(w.mpiAb) : null, mpi_ohne_abschlag: w.mpiOhne != null ? w.mpiOhne : null,
      sanierungsstau: stauDaten(w.stau) }; });
    return { gesperrt: false, quelle: W.quelle, datum: W.datum || null, veraltet: W.quelle === 'lauf' ? false : veraltet,
      lzs: W.lzs || null, S: S };
  }

  /* ── Daten für beide PDFs (Bank und Investment) ─────────────────────── */
  function pdfDaten() {
    var m = modell(); if (!m.aktiv) return null;
    var r = ergebnis();
    var kz = kennzahlen(m), H = (r && r.verfuegbar && r.haus) || {};
    var S = m.stufen;
    var d = { kennzeichnung: KENNZEICHNUNG, art: m.art, kappung: m.kappung.text,
      spalten: ['bestand'].concat(S.mieterhoehung ? ['mieterhoehung'] : []).concat(S.zielbild ? ['zielbild'] : []),
      titel: { bestand: 'Bestand', mieterhoehung: 'Mieterhöhung', zielbild: 'Zielbild' } };
    /* v2541 · Jahr je Stufe: im Spaltenkopf beider PDFs und der Karte im Tab Bewertung */
    var JA = jahre(m);
    d.jahre = JA;
    /* v2543a · Bestand ist der Stand HEUTE (das Kaufjahr steht in der Fußzeile und in der Pilot-Tafel unter „Ankauf") */
    d.titel_jahr = { bestand: 'Bestand ' + new Date().getFullYear(), mieterhoehung: 'Mieterhöhung' + (JA.mieterhoehung ? ' ' + JA.mieterhoehung : ''),
      zielbild: 'Zielbild' + (JA.zielbild ? ' ' + JA.zielbild : '') };
    d.titel = d.titel_jahr;   /* Spaltenköpfe in Karte und beiden PDFs; ohne Jahr nennt die Fußzeile „offen" */
    var mehr1 = S.mieterhoehung ? (S.mieterhoehung.miete_m - S.bestand.miete_m) * 12 : 0;
    var mehr2 = S.zielbild ? (S.zielbild.miete_m - (S.mieterhoehung ? S.mieterhoehung.miete_m : S.bestand.miete_m)) * 12 : 0;
    var abs = m.wohnungen.map(function (w) { return w.soll && w.soll.ab && w.soll.miete > w.ist ? w.soll.ab : null; }).filter(Boolean).sort();
    d.satz_bank = (S.mieterhoehung ? 'Ohne Mieterwechsel ist ' + (abs.length ? 'ab ' + mmjj(abs[0]) + ' (frühestes Wirksamwerden nach § 558b/§ 559b BGB) ' : '') + 'ein Mehrertrag von ' + eur(mehr1) + ' p. a. erreichbar' : 'Eine Mieterhöhung im Bestand ist nicht angesetzt')
      + (S.zielbild ? (S.mieterhoehung ? ', mit den geplanten Maßnahmen weitere ' : '; mit den geplanten Maßnahmen ') + eur(mehr2) + ' p. a.' : '.')
      + (S.zielbild && S.zielbild.kosten ? ' Maßnahmenkosten ' + eur(S.zielbild.kosten)
        + (m.haus && m.haus.kosten ? ', davon am ganzen Haus ' + eur(m.haus.kosten) + ' (' + m.haus.massnahmen.map(function (x) { return x.t; }).join(', ') + ')' : '') + '.' : '');   /* v2966 */
    d.haus_massnahmen = m.haus && m.haus.massnahmen.length ? m.haus : null;
    var zu = gesperrt(r);   /* v2431 */
    d.ertragswert_gesperrt = zu;
    d.satz_invest = zu ? 'Drei Stufen der Mietentwicklung mit Kosten und Rendite je Stufe.'
      : 'Drei Stufen der Mietentwicklung mit Ertragswert je Stufe' + (r && r.aufteilung ? ' und der Wirkung einer Aufteilung in Eigentumswohnungen.' : '.');
    d.wohnungen = m.wohnungen.map(function (w) {
      return { we: (w.nr ? w.nr + ' ' : '') + (w.lage || ''), wfl: w.wfl, ist: w.ist > 0 ? eur(w.ist) : (w.status === 'leer' ? 'leer' : '—'),
        soll: w.soll && w.soll.miete > w.ist ? eur(w.soll.miete) + (w.soll.vertrag ? ' · nach Vertrag (' + K.teilVertrag(w.soll, w.ist).norm + '), nicht § 558' : '') + (w.soll.termine ? ' · verlangbar ' + (w.soll.termine.verlangbar_sofort ? 'sofort' : 'ab ' + mmjj(w.soll.termine.verlangbar_ab)) + ' · wirksam ab ' + mmjj(w.soll.termine.wirksam_ab) : '') : '—',   /* v2430a: lange Termintexte liefen in die Nachbarspalten; v3028: beide Termine, die Spalte bricht in beiden PDFs um (pdf.js _tab, pdf-investment-bank.js 'w') */
        ziel: w.ziel != null ? eur(w.ziel) : '—',
        massnahmen: w.massnahmen.map(function (x) { return x.t; }).join(', ') || '—' };
    });
    d.kennzahlen = [
      [zahl(wert('ze')) > 0 ? 'Kaltmiete p. a. ohne Zuschläge' : 'Kaltmiete p. a.', function (k) { return eur(kz[k].miete_j); }],   /* v2460: Zuschläge (Stellplatz) stehen nicht in den Stufen */
      ['Bruttomietrendite', function (k) { return kz[k].bmy != null ? pct(kz[k].bmy) : '—'; }],
      ['DSCR', function (k) { return kz[k].dscr != null ? dez(kz[k].dscr, 2) : '—'; }],
      ['Maßnahmenkosten', function (k) { return kz[k].kosten ? eur(kz[k].kosten) : '—'; }],
      ['Restnutzungsdauer', function (k) { return H[k] && H[k].rnd != null ? dez(H[k].rnd, 0) + ' J.' : '—'; }],
      /* v2488 · die Miete im Ertragswert (Wohnen) und ihre Anhebung - erklärt, warum sie von der Kaltmiete abweicht */
      ['Miete im Ertragswert p. a.', function (k) { return H[k] && H[k].miete_wohnen_jahr != null ? eur(H[k].miete_wohnen_jahr) : '—'; }],
      ['davon Anhebung gegen Bestand', function (k) { return k === 'bestand' || !H[k] || H[k].anhebung_jahr == null ? '—' : '+' + eur(H[k].anhebung_jahr); }],
      [m.art === 'mfh' ? 'Ertragswert (Haus als Ganzes)' : 'Ertragswert', function (k) { return H[k] && H[k].wert != null ? eur(H[k].wert) : '—'; }],
      /* v2541 · Marktpreisindikation je Stufe, beide Wege */
      ['Marktpreisindikation (Angebote)', function (k) { return H[k] && H[k].mpi_angebote != null ? eur(H[k].mpi_angebote) : '—'; }],
      ['Rohertragsfaktor × Miete', function (k) { return H[k] && H[k].mpi_rohertrag ? eur(H[k].mpi_rohertrag.wert) : '—'; }],
      ['Ø Kaufpreis aus Kauffällen', function (k) { var K = r && r.mpi && r.mpi.kauffaelle; return K && K.verfuegbar && H[k] ? eur(K.wert) : '—'; }]   /* v3041 */
    ].filter(function (z) { return !zu || (z[0] !== 'Restnutzungsdauer' && !/^Ertragswert|^Miete im Ertragswert|^davon Anhebung|^Marktpreis|^Rohertragsfaktor|^Ø Kaufpreis/.test(z[0])); })   /* v2431, v2488, v2541 */
      .filter(function (z) {   /* v2541 · eine Zeile ohne Quelle erscheint nicht */
        var M = r && r.mpi;
        if (z[0] === 'Marktpreisindikation (Angebote)') return !!(M && M.angebote && M.angebote.verfuegbar);
        if (z[0] === 'Rohertragsfaktor × Miete') return !!(M && M.rohertragsfaktor && M.rohertragsfaktor.verfuegbar);
        if (z[0] === 'Ø Kaufpreis aus Kauffällen') return !!(M && M.kauffaelle && M.kauffaelle.verfuegbar);   /* v3041 */
        return true;
      })
      .map(function (z) { return [z[0]].concat(d.spalten.map(z[1])); });
    if (r && r.verfuegbar && r.aufteilung && r.aufteilung.je_stufe && r.aufteilung.je_stufe.bestand) {
      var n = m.wohnungen.filter(function (w) { return w.art !== 'gewerbe'; }).length;
      var AT = r.aufteilung.aufteiler;   /* v3200 · Aufteilerwert (Vergleichswert führend) */
      if (AT) d.kennzahlen.push(['Aufteilerwert (' + n + ' ETW nach Vergleichswert, abzgl. ' + eur(r.aufteilung.kosten_eur) + ')'].concat(d.spalten.map(function (k) {
        var t = AT[k]; return t ? eur(t.wert) : '—'; })));
      d.kennzahlen.push([(AT ? 'stützend: ' : '') + 'nach Aufteilung als Ertragswert (' + n + ' ETW, abzgl. ' + eur(r.aufteilung.kosten_eur) + ')'].concat(d.spalten.map(function (k) {
        var s = r.aufteilung.je_stufe[k]; return s ? eur(s.summe - r.aufteilung.kosten_eur) : '—'; })));
      /* v2431 · Aufteilungspotenzial: positiv als Zahl, negativ als Wort - die Erklaerung steht im Fuss */
      /* v2541 · die Wohnungen nach Angebotspreisen für Eigentumswohnungen */
      var ME = r.aufteilung.mpi_etw;
      if (ME && ME.summe_bestand != null) d.kennzahlen.push(['ETW nach Angeboten (Summe)'].concat(d.spalten.map(function (k) {
        var v = k === 'zielbild' ? ME.summe_zielbild : ME.summe_bestand; return v != null ? eur(v) : '—'; })));
      d.kennzahlen.push(['Aufteilungspotenzial'].concat(d.spalten.map(function (k) {
        var s = AT && AT[k] ? AT[k] : r.aufteilung.je_stufe[k]; return !s ? '—' : (s.potenzial < 0 ? 'kein Potenzial' : '+' + eur(s.potenzial)); })));
      d.aufteilung_hinweis = r.aufteilung.negativ_hinweis || null;
    }
    d.fuss = KENNZEICHNUNG + ' Der Score rechnet ebenfalls mit dem Bestand.'
      + (r && r.verfuegbar && r.basis ? ' Liegenschaftszins ' + pct(r.basis.lzs_pct) + ' (Haus)'
        + (r.aufteilung && r.aufteilung.zins && r.aufteilung.zins.bestand && r.aufteilung.zins.bestand.pct != null ? ' bzw. ' + pct(r.aufteilung.zins.bestand.pct) + ' (Wohnungseigentum, vermietet)' : '')
        + ', Restnutzungsdauer nach Modernisierungspunkten (Anlage 2 ImmoWertV).'
        + (r.basis.bestandsbasis && r.basis.bestandsbasis.hinweis ? ' ' + r.basis.bestandsbasis.hinweis : '')   /* v2488 */
        : (zu ? ' ' + GESPERRT_KURZ + ' (Wertermittlung nach ImmoWertV).' : ' Ertragswerte nicht gerechnet.'))
      + ' ' + m.kappung.text
      + (r && r.verfuegbar && r.mpi && !zu ? ' ' + mpiFuss(r.mpi) : '') + ' ' + jahreFuss(JA);   /* v2541 */
    if (d.aufteilung_hinweis) d.fuss = 'Aufteilung: ' + d.aufteilung_hinweis + ' ' + d.fuss;
    d.gerechnet = !!(r && r.verfuegbar);
    /* v2460 · Wertbrücke und Ertragswert-Kacheln - dieselben Zahlen für den
       Tab Bewertung und beide PDFs (gezeichnet wird je Ausgabe, gerechnet hier). */
    d.bruecke = zu ? null : brueckeDaten(m, r);
    d.kaufpreis = zahl(wert('kp')) || ((window.State && window.State.kpis && window.State.kpis.kp) || null);
    /* v3018d · Marcel 28.10.2026: „wenn wir kein Zielbild angegeben haben, das auch nicht im PDF
       steht." Zielbild angegeben heisst hier dasselbe wie in modell(): eine Zielmiete (ziel_qm)
       oder eine Massnahme an einer Wohnung bzw. am Haus (hat_ziel). Ohne das bleibt die
       Mieterhoehung nach § 558 BGB - sie ist aus dem Ist gerechnet und ein eigener Teil -, aber
       kein Wort Zielbild, keine Massnahmenkosten-Zeile mit Strichen und kein „Zielbild offen". */
    d.hat_ziel = !!m.hat_ziel;
    if (!d.hat_ziel) {
      d.satz_invest = (S.mieterhoehung ? 'Zwei Stufen der Mietentwicklung (Bestand und Mieterhöhung)' : 'Die Miete im Bestand')
        + (zu ? ' mit Kosten und Rendite.' : ' mit Ertragswert' + (S.mieterhoehung ? ' je Stufe' : '') + (r && r.aufteilung ? ' und der Wirkung einer Aufteilung in Eigentumswohnungen.' : '.'));
      d.kennzeichnung = ohneZielbild(d.kennzeichnung);
      d.fuss = ohneZielbild(d.fuss);
      d.kennzahlen = (d.kennzahlen || []).filter(function (z) { return z[0] !== 'Maßnahmenkosten'; });
    }
    d.zins_etw = (r && r.verfuegbar && r.aufteilung && r.aufteilung.zins && r.aufteilung.zins.bestand) ? r.aufteilung.zins.bestand : null;
    return d;
  }

  /* ── v2460 · Wertbrücke: Bestand → Mieterhöhung → Zielbild → Kosten → netto ──
     Nur mit gerechnetem Ertragswert (Stufe 3). Jede Stufe ist ein Balken von a
     nach b; Summenbalken (`summe`) stehen auf null, Schritte schweben. */
  function brueckeDaten(m, r) {
    if (!r || !r.verfuegbar || gesperrt(r) || !r.haus || !r.haus.bestand || r.haus.bestand.wert == null) return null;
    var H = r.haus, S = m.stufen;
    var B = H.bestand.wert;
    var Sw = S.mieterhoehung && H.mieterhoehung && H.mieterhoehung.wert != null ? H.mieterhoehung.wert : null;
    var Zw = S.zielbild && H.zielbild && H.zielbild.wert != null ? H.zielbild.wert : null;
    if (Sw == null && Zw == null) return null;
    var top = Zw != null ? Zw : Sw;
    var kosten = (Zw != null ? S.zielbild.kosten : S.mieterhoehung.kosten) || 0;
    var netto = top - B - kosten;
    var st = [{ t: 'Bestand', a: 0, b: B, art: 'bestand', summe: true, wert: B }];
    if (Sw != null) st.push({ t: 'Mieterhöhung', a: B, b: Sw, art: 'soll', wert: Sw - B, schritt: true });
    if (Zw != null) st.push({ t: Sw != null ? 'Umbau, Wechsel' : 'Zielbild', a: Sw != null ? Sw : B, b: Zw, art: 'ziel', wert: Zw - (Sw != null ? Sw : B), schritt: true });
    st.push({ t: Zw != null ? 'Zielbild' : 'nach Erhöhung', a: 0, b: top, art: Zw != null ? 'ziel' : 'soll', summe: true, wert: top });
    if (kosten > 0) st.push({ t: '− Maßnahmen', a: top - kosten, b: top, art: 'kosten', wert: -kosten, schritt: true });
    st.push({ t: 'Potenzial netto', a: B, b: B + netto, art: netto >= 0 ? 'netto' : 'kosten', wert: netto, schritt: true });
    return { stufen: st, bestand: B, mieterhoehung: Sw, zielbild: Zw, top: top, kosten: kosten, netto: netto,
      kacheln: [
        { t: 'Ertragswert Bestand', w: B, art: 'bestand' },
        Sw != null ? { t: 'Ertragswert Mieterhöhung', w: Sw, art: 'soll' } : null,
        Zw != null ? { t: 'Ertragswert Zielbild', w: Zw, art: 'ziel' } : null,
        { t: 'Potenzial netto', w: netto, art: 'netto', unter: kosten > 0 ? 'nach ' + eur(kosten) + ' Maßnahmenkosten' : 'ohne Maßnahmenkosten' }
      ].filter(Boolean) };
  }
  /** Achse der Brücke: Untergrenze glatt unter dem kleinsten Stand, Obergrenze
      darüber. Die Achse beginnt NICHT bei null (sonst verschwinden die Schritte) -
      deshalb trägt jede Ausgabe die Achsenwerte mit. */
  function brueckeAchse(br) {
    var werte = [];
    br.stufen.forEach(function (s) { if (!s.summe) { werte.push(s.a, s.b); } else werte.push(s.b); });
    var lo = Math.min.apply(null, werte), hi = Math.max.apply(null, werte);
    var span = Math.max(hi - lo, Math.abs(hi) * 0.05, 1);
    var roh = span / 4, p = Math.pow(10, Math.floor(Math.log(roh) / Math.LN10)), f = roh / p;
    var schritt = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
    var min = Math.floor((lo - span * 0.25) / schritt) * schritt;
    if (min < 0) min = 0;
    var max = Math.ceil((hi + span * 0.08) / schritt) * schritt;
    var ticks = []; for (var v = min; v <= max + 1e-6; v += schritt) ticks.push(v);
    return { min: min, max: max, ticks: ticks };
  }
  function tEur(n, vz) { var s = Math.round(Math.abs(n) / 1000).toLocaleString('de-DE') + ' T€'; return (n < 0 ? '− ' : (vz ? '+ ' : '')) + s; }

  /* ── v2460 · Tab Bewertung: Abschnitt „Mieterhöhung und Zielbild" ──────
     Marcel 20.10.2026: „Das Zielbild und das, was du ins Investment-PDF
     überführst, muss auch unter den Tab Bewertung." Inhalt = die PDF-Seite
     (pdfDaten), dazu die Wertbrücke. Ohne Soll-Miete und Zielbild keine Karte.
     Die Karte wird hier gebaut und hinter die Bewertungshistorie gesetzt -
     index.html bleibt unberührt. */
  function bwStil() {
    if (el('dp-wp-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-wp-stil';
    s.textContent = [
      '#card-wertpotenzial{color:#2A2727}',
      '#card-wertpotenzial .dp-wp-kz{font:600 9.5px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#2f7d55;border:1px solid #2f7d55;border-radius:999px;padding:1px 8px;margin-left:auto;white-space:nowrap}',
      '#card-wertpotenzial .ct{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '#card-wertpotenzial .dp-wp-satz{font:400 13px/1.55 Inter,system-ui,sans-serif;color:#2A2727;margin:0 0 10px;max-width:78ch}',
      '#card-wertpotenzial .dp-wp-h{font:700 10px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#6B645A;margin:18px 0 8px}',
      '#card-wertpotenzial .dp-wp-kacheln{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:4px 0 6px}',
      '#card-wertpotenzial .dp-wp-k{border-top:2px solid #D9D2C3;padding:8px 2px 2px;display:grid;gap:2px;min-width:0}',
      '#card-wertpotenzial .dp-wp-k span{font:500 10.5px Inter,system-ui,sans-serif;color:#6B645A;text-transform:uppercase;letter-spacing:.04em}',
      '#card-wertpotenzial .dp-wp-k b{font:700 20px "Space Grotesk",Inter,sans-serif;font-variant-numeric:tabular-nums;color:#2A2727;overflow-wrap:anywhere}',
      '#card-wertpotenzial .dp-wp-k em{font:400 11.5px Inter,sans-serif;font-style:normal;color:#6B645A}',
      /* v2543 · Kachelkante in der Stufenfarbe der Marke, Zahl in Textfarbe */
      '#card-wertpotenzial .dp-wp-k.bestand{border-color:#2A2727}',
      '#card-wertpotenzial .dp-wp-k.soll{border-color:var(--wl-e8cc7a, #E8CC7A)}',
      '#card-wertpotenzial .dp-wp-k.ziel{border-color:var(--wl-b8932f, #b8932f)}',
      '#card-wertpotenzial .dp-wp-k.netto b{color:#2f7d55}',
      /* v2543 · Wertüberleitung (ersetzt die Wertbrücke): Stände als Zeilen mit Summenstrich,
         Veränderungen als Balken auf einer Skala um null - keine gekürzte Achse */
      '#card-wertpotenzial table.dp-wp-ueb{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;min-width:460px}',
      '#card-wertpotenzial .dp-wp-ueb td{padding:8px 6px;border-bottom:1px solid #F0ECE4;vertical-align:middle;text-align:left;white-space:normal}',
      '#card-wertpotenzial .dp-wp-ueb td.l{width:38%;font:500 12.5px Inter,system-ui,sans-serif;color:#2A2727}',
      '#card-wertpotenzial .dp-wp-ueb td.l small{display:block;font:400 10.5px Inter,sans-serif;color:#8A8272}',
      '#card-wertpotenzial .dp-wp-ueb td.bar{width:40%}',
      '#card-wertpotenzial .dp-wp-ueb td.v{width:22%;text-align:right;font:600 13px Inter,sans-serif;white-space:nowrap;color:#2A2727}',
      '#card-wertpotenzial .dp-wp-ueb tr.summe td{border-top:1.5px solid #2A2727;border-bottom:1px solid #E6DCC2;font-weight:700}',
      '#card-wertpotenzial .dp-wp-ueb tr.summe td.v{font:700 14px "Space Grotesk",Inter,sans-serif}',
      '#card-wertpotenzial .dp-wp-ueb tr.netto td{background:#FBF6E9;border-top:2px solid var(--wl-c9a84c, #C9A84C);border-bottom:0}',
      '#card-wertpotenzial .dp-wp-ueb tr.netto td.v{font:700 16px "Space Grotesk",Inter,sans-serif}',
      '#card-wertpotenzial .dp-wp-ueb .pos{color:#2f7d55}#card-wertpotenzial .dp-wp-ueb .neg{color:#B8625C}',
      '#card-wertpotenzial .dp-wp-ueb i.dot{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:8px;vertical-align:0}',
      '#card-wertpotenzial .dp-wp-ueb svg{display:block;width:100%;height:18px}',
      '#card-wertpotenzial .dp-wp-k.netto{border-color:var(--wl-c9a84c, #C9A84C)}',
      '#card-wertpotenzial .dp-wp-k.neg b{color:#B8625C}',
      '#card-wertpotenzial svg.dp-wp-br{display:block;width:100%;max-width:860px;height:auto;margin:6px 0 2px}',
      '#card-wertpotenzial svg.dp-wp-br text{font-family:Inter,system-ui,sans-serif}',
      '#card-wertpotenzial svg.dp-wp-br .ax{font:500 10px "JetBrains Mono",monospace;fill:#8A8272}',
      '#card-wertpotenzial svg.dp-wp-br .gl{stroke:#EEE8DC;stroke-width:1}',
      '#card-wertpotenzial svg.dp-wp-br .vb{stroke:#B8B0A0;stroke-width:1;stroke-dasharray:3 3}',
      '#card-wertpotenzial svg.dp-wp-br .lab{font-size:12px;font-weight:600;fill:#2A2727}',
      '#card-wertpotenzial svg.dp-wp-br .cat{font-size:11px;fill:#6B645A}',
      '#card-wertpotenzial svg.dp-wp-br.eng .cat{font-size:10px}#card-wertpotenzial svg.dp-wp-br.eng .lab{font-size:10.5px}',
      '#card-wertpotenzial svg.dp-wp-br .b-bestand{fill:#8a8272}',
      '#card-wertpotenzial svg.dp-wp-br .b-soll{fill:#3d6fa8}',
      '#card-wertpotenzial svg.dp-wp-br .b-ziel{fill:#2f7d55}',
      '#card-wertpotenzial svg.dp-wp-br .b-kosten{fill:#B8625C}',
      '#card-wertpotenzial svg.dp-wp-br .b-netto{fill:var(--wl-c9a84c, #C9A84C)}',
      '#card-wertpotenzial .dp-wp-achse{font:400 11px Inter,sans-serif;color:#8A8272;margin:0 0 4px}',
      '#card-wertpotenzial .dp-pot td.dp-pot-neg{color:#6B645A !important;font-weight:500 !important}',
      '#card-wertpotenzial .dp-wp-fuss{font:400 11.5px/1.5 Inter,sans-serif;color:#6B645A;margin:12px 0 0;padding-top:10px;border-top:1px solid #F0ECE4}',
      '#card-wertpotenzial .dp-wp-neg{font:400 12.5px/1.5 Inter,sans-serif;color:#4a4436;background:#FBF6E9;border-left:3px solid #D9D2C3;padding:8px 12px;margin:8px 0 0}',
      '#card-wertpotenzial .dp-pot table td:last-child,#card-wertpotenzial .dp-pot table th:last-child{white-space:normal}',
      '#card-wertpotenzial .dp-wp-we td:last-child{min-width:160px;text-align:left}',
      '#card-wertpotenzial .dp-wp-we th:last-child{text-align:left}',
      '@media (max-width:640px){#card-wertpotenzial .dp-wp-k b{font-size:17px}#card-wertpotenzial .dp-wp-kacheln{grid-template-columns:repeat(2,minmax(0,1fr))}'
        + '#card-wertpotenzial .dp-pot th,#card-wertpotenzial .dp-pot td{padding:5px 3px;font-size:11px;white-space:normal}#card-wertpotenzial .dp-pot td:not(:first-child):not(.dp-pot-neg){white-space:nowrap}'
        + '#card-wertpotenzial .dp-pot thead th{font-size:9px;letter-spacing:.04em}#card-wertpotenzial .dp-pot td:first-child{min-width:92px}}'
    ].join('');
    document.head.appendChild(s);
  }
  /* v2460a · gemessen bei 390 px: mit fester viewBox 760 schrumpfte die Schrift
     auf rund 4 px. Die Zeichenfläche nimmt jetzt die echte Breite der Karte,
     die Schrift bleibt in Pixeln. */
  function brueckeSvg(br, breite) {
    var A = brueckeAchse(br);
    var W = Math.max(330, Math.min(760, Math.round(breite || 760))), eng = W < 560;
    var H = eng ? 250 : 270, L = eng ? 50 : 58, R = 6, T = 22, U = 44;
    var y = function (v) { return T + (H - T - U) * (1 - (v - A.min) / ((A.max - A.min) || 1)); };
    var n = br.stufen.length, gap = (W - L - R) / n, bw = Math.min(70, gap * 0.62), s = '';
    A.ticks.forEach(function (t) {
      s += '<line class="gl" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '"/>'
        + '<text class="ax" x="' + (L - 6) + '" y="' + (y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + esc(tEur(t)) + '</text>';
    });
    br.stufen.forEach(function (st, i) {
      var x = L + i * gap + (gap - bw) / 2;
      var lo = st.summe ? A.min : Math.min(st.a, st.b), hi = st.summe ? st.b : Math.max(st.a, st.b);
      var top = y(hi), bot = y(lo), h = Math.max(2, bot - top);
      s += '<rect class="b-' + st.art + '" x="' + x.toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2"' + (st.summe && st.art === 'bestand' ? ' opacity=".85"' : '') + '/>';
      if (i < n - 1 && !br.stufen[i + 1].summe && br.stufen[i + 1].t !== 'Potenzial netto') {
        var yv = y(st.summe ? st.b : st.b);
        s += '<line class="vb" x1="' + (x + bw).toFixed(1) + '" x2="' + (x + gap).toFixed(1) + '" y1="' + yv.toFixed(1) + '" y2="' + yv.toFixed(1) + '"/>';
      }
      var lab = st.summe ? tEur(st.wert) : tEur(st.wert, true);
      s += '<text class="lab" x="' + (x + bw / 2).toFixed(1) + '" y="' + (top - 6).toFixed(1) + '" text-anchor="middle">' + esc(lab) + '</text>';
      var worte = String(st.t).split(' '), zeilen = [];
      worte.forEach(function (w) { var l = zeilen[zeilen.length - 1]; if (l && (l + ' ' + w).length <= 13) zeilen[zeilen.length - 1] = l + ' ' + w; else zeilen.push(w); });
      var KURZ = { 'Mieterhöhung': 'Erhöhung', 'Umbau, Wechsel': 'Umbau', '− Maßnahmen': 'Kosten', 'Potenzial netto': 'netto', 'nach Erhöhung': 'Erhöhung' };
      if (eng && KURZ[st.t]) worte = [KURZ[st.t]];
      if (eng) { zeilen = []; worte.forEach(function (w) { var l = zeilen[zeilen.length - 1]; if (l && (l + ' ' + w).length <= 9) zeilen[zeilen.length - 1] = l + ' ' + w; else zeilen.push(w); }); }
      zeilen.slice(0, 2).forEach(function (z, j) {
        s += '<text class="cat" x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - U + 17 + j * 13) + '" text-anchor="middle">' + esc(z) + '</text>';
      });
    });
    return '<svg class="dp-wp-br' + (eng ? ' eng' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Wertbrücke: Ertragswert Bestand ' + esc(eur(br.bestand))
      + (br.mieterhoehung != null ? ', nach Mieterhöhung ' + esc(eur(br.mieterhoehung)) : '') + (br.zielbild != null ? ', Zielbild ' + esc(eur(br.zielbild)) : '')
      + ', Maßnahmen ' + esc(eur(br.kosten)) + ', Potenzial netto ' + esc(eur(br.netto)) + '">' + s + '</svg>';
  }
  /* v2543 · DIE WERTÜBERLEITUNG (Marcel 20.10.2026: Variante B, Farben der Marke).
     Bis v2542 eine Wertbrücke mit gekürzter Achse (ab 680 T€): +15 T€ sahen aus wie
     der halbe Bestand, „Potenzial netto" stand als Balken von der Achse bis zum
     Bestand, ein Schritt von 0 € war ein Strich. Jetzt: Stände als Zeilen mit
     Summenstrich, Veränderungen als Balken auf einer gemeinsamen Skala um null. */
  var STUFE_FARBE = { bestand: '#2A2727', soll: 'var(--wl-e8cc7a, #E8CC7A)', ziel: 'var(--wl-b8932f, #b8932f)', kosten: '#C98A84' };
  function ueberleitungZeilen(br) {
    var B = br.bestand, Sw = br.mieterhoehung, Zw = br.zielbild, top = br.top, z = [];
    z.push({ t: 'Ertragswert Bestand', klein: 'Ist-Miete je Wohnung im Band', w: B, art: 'bestand', summe: true });
    if (Sw != null) z.push({ t: '+ Mieterhöhung', klein: 'Mieter bleibt, § 558 BGB', w: Sw - B, art: 'soll', schritt: true });
    if (Zw != null) z.push({ t: Sw != null ? '+ Umbau, Wechsel' : '+ Zielbild', klein: 'Zielmiete nach Maßnahmen', w: Zw - (Sw != null ? Sw : B), art: 'ziel', schritt: true });
    z.push({ t: Zw != null ? 'Ertragswert Zielbild' : 'Ertragswert nach Mieterhöhung', w: top, art: Zw != null ? 'ziel' : 'soll', summe: true });
    if (br.kosten > 0) z.push({ t: '− Maßnahmenkosten', w: -br.kosten, art: 'kosten', schritt: true });
    z.push({ t: 'Potenzial netto', klein: (Zw != null ? 'Zielbild' : 'Mieterhöhung') + ' − Bestand − Kosten', w: br.netto, art: 'netto', schritt: true, netto: true });
    return z;
  }
  function ueberleitungHtml(br) {
    var Z = ueberleitungZeilen(br);
    var M = Math.max.apply(null, Z.filter(function (z) { return z.schritt; }).map(function (z) { return Math.abs(z.w); }).concat([1])) * 1.08;
    var bar = function (v, farbe) {
      if (Math.abs(v) < 500) return '<svg viewBox="0 0 300 18" aria-hidden="true"><line x1="150" x2="150" y1="1" y2="17" stroke="#D9D2C3"/><text x="158" y="13" style="font:500 9.5px \'JetBrains Mono\',monospace;fill:#8A8272">unverändert</text></svg>';
      var w = Math.abs(v) / M * 146, x = v >= 0 ? 150 : 150 - w;
      return '<svg viewBox="0 0 300 18" aria-hidden="true"><line x1="150" x2="150" y1="0" y2="18" stroke="#E6DCC2"/><rect x="' + x.toFixed(1) + '" y="3" width="' + w.toFixed(1) + '" height="12" rx="2" style="fill:' + farbe + '"/></svg>';
    };
    return '<div class="dp-pot-scroll"><table class="dp-wp-ueb" aria-label="Wertüberleitung: Ertragswert je Stufe und Potenzial netto"><tbody>'
      + Z.map(function (z) {
          var farbe = z.netto ? (z.w >= 0 ? '#2f7d55' : '#B8625C') : STUFE_FARBE[z.art];
          /* v2543a · ein Vorzeichen-Stil: „+ 15.000 €" / „− 48.000 €" */
          var vz = function (n) { return (n < 0 ? '− ' : (n > 0 ? '+ ' : '')) + esc(eur(Math.abs(n))); };
          var wert = z.netto ? '<span class="' + (z.w >= 0 ? 'pos' : 'neg') + '">' + vz(z.w) + '</span>'
            : (z.schritt ? vz(z.w) : esc(eur(z.w)));
          return '<tr class="' + (z.summe ? 'summe' : '') + (z.netto ? ' netto' : '') + '"><td class="l">' + (z.netto ? '' : '<i class="dot" style="background:' + farbe + '"></i>') + esc(z.t)
            + (z.klein ? '<small>' + esc(z.klein) + '</small>' : '') + '</td><td class="bar">' + (z.schritt ? bar(z.w, farbe) : '') + '</td><td class="v">' + wert + '</td></tr>';
        }).join('') + '</tbody></table></div>';
  }
  /* v2840 · LEG stand bis v2577 oben bei der Tafel und fiel dort mit weg - seitdem warf
     bewertungHtml() „LEG is not defined", und die Karte im Tab Bewertung blieb leer
     (gemessen 22.10.2026 an Westerfeldstr. 140: 42 px hoch, ohne Inhalt). */
  var LEG = '<div class="dp-pot-leg"><span><i style="background:#2A2727"></i>Ist / Bestand</span><span><i style="background:var(--wl-e8cc7a, #E8CC7A)"></i>Mieterhöhung · Mieter bleibt</span><span><i style="background:var(--wl-b8932f, #b8932f)"></i>Zielbild · nach Umbau</span></div>';
  function bewertungHtml(breite) {
    var m = modell(); if (!m.aktiv) return '';
    var d = pdfDaten(); if (!d) return '';
    var r = ergebnis();
    var cls = { mieterhoehung: 'c-soll', zielbild: 'c-ziel', bestand: '' };
    var html = '<div class="ct ct-pro"><span class="ct-ico"><svg width="22" height="22"><use href="#i-trending-up"/></svg></span>Mieterhöhung und Zielbild · Wertpotenzial'
      + '<span class="dp-wp-kz" title="' + esc(KENNZEICHNUNG) + '">Ausblick</span></div>'
      + '<p class="dp-wp-satz">' + esc(d.satz_bank) + '</p><div class="dp-pot">' + LEG;
    if (d.art === 'mfh' && d.wohnungen.length) {
      html += '<div class="dp-wp-h">Wohnungen · Ist, Soll-Miete und Zielbild</div><div class="dp-pot-scroll"><table class="dp-wp-we"><thead><tr><th>WE</th><th>m²</th><th>Ist / Monat</th><th class="c-soll">Mieterhöhung</th><th class="c-ziel">Zielmiete</th><th>Maßnahmen</th></tr></thead><tbody>'
        + d.wohnungen.map(function (w) {
            return '<tr><td>' + esc(w.we || '—') + '</td><td>' + esc(dez(w.wfl, 0)) + '</td><td>' + esc(w.ist) + '</td><td class="c-soll">' + esc(w.soll) + '</td><td class="c-ziel">' + esc(w.ziel) + '</td><td>' + esc(w.massnahmen) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        + (d.haus_massnahmen ? '<p class="dp-pot-hin">Am ganzen Haus: ' + esc(d.haus_massnahmen.massnahmen.map(function (x) { return x.t + (x.k ? ' ' + eur(x.k) : ''); }).join(', '))
          + ' — Kosten nach Wohnfläche auf die Wohnungen verteilt, Modernisierungspunkte für jede Wohnung.</p>' : '');   /* v2966 */
    }
    if (d.bruecke) {
      html += '<div class="dp-wp-h">Ertragswert je Stufe</div><div class="dp-wp-kacheln">'
        + d.bruecke.kacheln.map(function (k) {
            return '<div class="dp-wp-k ' + k.art + (k.art === 'netto' && k.w < 0 ? ' neg' : '') + '"><span>' + esc(k.t) + '</span><b>' + (k.art === 'netto' && k.w > 0 ? '+' : '') + esc(eur(k.w)) + '</b>'
              + (k.unter ? '<em>' + esc(k.unter) + '</em>' : '') + '</div>';
          }).join('') + '</div>'
        + '<div class="dp-wp-h">Wertüberleitung</div>' + ueberleitungHtml(d.bruecke)
        + '<p class="dp-wp-achse">Balken: Veränderung gegen die Zeile darüber, gemeinsame Skala um null.</p>';
    }
    html += '<div class="dp-wp-h">Kennzahlen je Stufe</div><div class="dp-pot-scroll"><table><thead><tr><th>Kennzahl</th>'
      + d.spalten.map(function (k) { return '<th class="' + cls[k] + '">' + esc(d.titel[k]) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + d.kennzahlen.map(function (z) {
          var fett = /^Ertragswert|^nach Aufteilung/.test(z[0]);
          return '<tr' + (fett ? ' class="dp-pot-sum"' : '') + '><td>' + esc(z[0]) + '</td>' + z.slice(1).map(function (v, i) {
            var neg = v === 'kein Potenzial';
            return '<td class="' + (neg ? 'dp-pot-neg' : cls[d.spalten[i]]) + '">' + esc(v) + '</td>';
          }).join('') + '</tr>';
        }).join('')
      + (d.kaufpreis ? '<tr><td>Kaufpreis</td><td>' + esc(eur(d.kaufpreis)) + '</td>' + d.spalten.slice(1).map(function () { return '<td></td>'; }).join('') + '</tr>' : '')
      + '</tbody></table></div>';
    if (d.aufteilung_hinweis) html += '<p class="dp-wp-neg"><b>Aufteilung:</b> ' + esc(d.aufteilung_hinweis) + '</p>';
    if (d.zins_etw && d.zins_etw.pct != null) {
      html += '<p class="dp-pot-hin">Aufteilung gerechnet mit dem Liegenschaftszins für <b>vermietete</b> Eigentumswohnungen: ' + esc(pct(d.zins_etw.pct))
        + (d.zins_etw.ausschuss ? ' (' + esc(String(d.zins_etw.ausschuss).replace(/^Der\s+/, '')) + ')' : '') + '.</p>';
    }
    if (d.ertragswert_gesperrt) {
      html += '<div class="dp-pot-stufe3"><b>' + esc(GESPERRT_KURZ) + '</b><span>' + esc(GESPERRT_LANG) + '</span>'
        + '<button type="button" class="dp-pot-knopf" data-dp-pot-stufe3="1">Stufe 3 im Tab Objekt</button></div>';
    } else if (!d.gerechnet) {
      var lauf = !!_bwLauf;
      var grund = grundGespeichert();
      html += '<p class="dp-pot-hin">' + (lauf ? 'Die Ertragswerte werden gerechnet (bis 40 Sekunden) …'
          : (ergebnisVeraltet() ? 'Die Angaben haben sich geändert — die Ertragswerte sind neu zu rechnen. ' : (grund ? esc(grund) + ' ' : ''))
            + ' <button type="button" class="dp-pot-knopf" data-dp-wp-rechnen="1">Ertragswerte rechnen</button>') + '</p>';
    }
    /* Die Aufteilungs-Erklärung steht oben schon hervorgehoben - im Fuss nicht noch einmal. */
    var fuss = d.aufteilung_hinweis ? String(d.fuss).replace('Aufteilung: ' + d.aufteilung_hinweis + ' ', '') : d.fuss;
    html += '</div><p class="dp-wp-fuss">' + esc(fuss) + '</p>';
    void r;
    return html;
  }
  var _bwLauf = null, _bwVersucht = {};
  function bewertungKarte() {
    var sec = el('s6'); if (!sec) return;
    var karte = el('card-wertpotenzial');
    var m = null; try { m = modell(); } catch (e) { m = null; }
    if (!m || !m.aktiv) { if (karte) karte.remove(); return; }
    bwStil(); stilEinhaengen();
    /* v2840 · im Segment „Wert & Zielbild" (wert-zielbild.js) steht die Karte als Detail */
    if (!karte && window.DpWertZielbild && typeof window.DpWertZielbild.potenzialHost === 'function') {
      try { karte = window.DpWertZielbild.potenzialHost(); } catch (e) { karte = null; }
    }
    if (!karte) {
      karte = document.createElement('div');
      karte.className = 'card'; karte.id = 'card-wertpotenzial';
      var nach = el('avm-history-host');
      if (nach && nach.parentNode === sec) sec.insertBefore(karte, nach.nextSibling); else sec.appendChild(karte);
    }
    var breite = karte.clientWidth ? karte.clientWidth - 40 : 760;
    karte.innerHTML = bewertungHtml(breite);
    karte._dpWpBreite = breite;
    /* Einmal je Stand selbst rechnen (kein Kontingent; ohne Stufe 3 sagt der
       Dienst „gesperrt" und es bleibt beim Hinweis). */
    var r = ergebnis(), alt = window._dpPotenzial;
    var zu = !r && alt && gesperrt(alt.ergebnis) && !ergebnisVeraltet();
    if (!r && !zu && !_bwLauf && sec.classList.contains('active')) {
      var h = ''; try { h = hash(JSON.stringify(auftrag(m))); } catch (e) {}
      if (h && !_bwVersucht[h]) { _bwVersucht[h] = 1; bwRechnen(); }
    }
  }
  function bwRechnen() {
    var key = window._currentObjKey || null;
    _bwLauf = rechnen().then(function (r) {
      _bwLauf = null;
      if ((window._currentObjKey || null) === key) { try { bewertungKarte(); } catch (e) {} }
      return r;
    }, function () { _bwLauf = null; });
    try { bewertungKarte(); } catch (e) {}
  }

  /* ── Mietentwicklung: Soll je Wohnung und ihr Startjahr ─────────────── */
  function sollFuerMietentwicklung(e, basisJahr) {
    if (!e || e.status === 'leer') return null;
    var vg = objektVgl();
    var s = sollFuer(e, { kapp: kappung(agsJetzt()), vgl_qm: vg.qm });
    if (s.miete == null || !(s.miete > zahl(e.ist))) return null;
    var idx = null;
    var D = window._dpMfh || {};
    var jEig = /^\d{4}-\d{2}/.test(e.soll_ab || '') ? +String(e.soll_ab).slice(0, 4) : null;
    var jFrist = s.ab ? +s.ab.slice(0, 4) : null;
    var jObj = Math.round(Number(D.sollAbJahr) || 0);
    var by = basisJahr || new Date().getFullYear();
    if (jEig) idx = jEig - by;
    else if (jObj > 0) { var jo = jObj >= 1900 ? jObj : by + jObj; idx = Math.max(jo, jFrist || 0) - by; }
    else if (jFrist && e.mv_letzte_erhoehung) idx = jFrist - by;
    if (idx == null) return { miete: s.miete, jahrIndex: null };
    return { miete: s.miete, jahrIndex: Math.max(1, idx) };
  }

  /* ── Tab Objekt: „Mieterhöhung und Zielbild (optional)" ──────────────── */
  function chipsHtml(liste, mitPunkte, e, geb, fuerEinheit, fuerHaus) {
    return '<div class="dp-zb-chips">' + MASSNAHMEN.filter(function (k) { return fuerHaus ? k.haus : (fuerEinheit ? k.einheit : true); }).map(function (k) {
      var m = (liste || []).filter(function (x) { return x.id === k.id; })[0];
      var p = k.gewerk ? Math.max(0, (k.max != null ? Math.min(maxP(k.gewerk), k.max) : maxP(k.gewerk)) - punkteJetzt(k.gewerk, e, geb)) : 0;   /* v3001a: Teilmassnahme (Elektrik 1 von 2) zeigt ihren Teil, wie punkteGewinn rechnet */
      return '<button type="button" class="dp-zb-chip' + (m ? ' on' : '') + '" data-zb-chip="' + k.id + '" aria-pressed="' + (m ? 'true' : 'false') + '"'
        + ' title="' + esc(k.gewerk ? (p ? '+' + p + ' Modernisierungspunkte (Anlage 2)' : 'Gewerk schon voll modernisiert — keine weiteren Punkte') : (k.hinweis || 'ohne Modernisierungspunkte')) + '">'
        + esc(k.t) + (mitPunkte && k.gewerk && p ? ' <em>+' + p + ' P.</em>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function massnahmenZeilen(liste, e) {
    var vg = e ? vertragGrenzen(e) : { s559: true };   /* v3016t */
    return (liste || []).map(function (m, i) {
      return '<div class="dp-zb-mz" data-zb-i="' + i + '"><span class="dp-zb-mt">' + esc(m.t) + '</span>'
        + '<label><span>Kosten €</span><input data-zb-k="' + i + '" inputmode="decimal" value="' + esc(m.k ? String(Math.round(zahl(m.k))) : '') + '" placeholder="0"></label>'
        /* v3001 · Marcel 27.10.2026: „bewohnen und irgendein Paragraph, wo keiner weiss, was gemeint ist“ -
           das Kaestchen sagt jetzt, was es tut: die Kosten als Modernisierungsumlage auf die laufende Miete. */
        + (m.id === 'renovierung' ? '<span class="dp-zb-bew-nein">Renovierung ist Erhaltung — nicht auf die Miete umlegbar</span>'
          : !vg.s559 ? '<span class="dp-zb-bew-nein"><b>Nicht auf die Miete umlegbar.</b> ' + esc(vg.text) + ' Die Maßnahme zählt zum Zielbild (nach Auszug, Neuvermietung).</span>'
          : '<label class="dp-zb-bew"><input type="checkbox" data-zb-b="' + i + '"' + (m.bewohnt ? ' checked' : '') + '> Mieter bleibt drin — Kosten auf die Miete umlegen</label>'
          + (m.bewohnt ? '<label><span>davon Erhaltung %</span><input data-zb-e="' + i + '" inputmode="decimal" value="' + esc(m.erh ? String(zahl(m.erh)) : '') + '" placeholder="0" style="width:70px"></label>'
            + '<span class="dp-zb-bew-info">Modernisierungsumlage (§ 559 BGB): 8 % der Kosten pro Jahr auf die Miete, ohne den Anteil für Erhaltung (z. B. ohnehin fällige Reparatur), höchstens 3 €/m² — bei Miete unter 7 €/m² 2 €/m² — in 6 Jahren. Geht in die Soll-Miete ein.</span>'
            /* v3016s · Marcel 28.10.2026: „was soll das heißen? Mieter bleibt drin — Kosten auf die Miete
               umlegen, was passiert, wenn ich das auswähle?" Jetzt steht auch OHNE Haken, was gilt. */
            : '<span class="dp-zb-bew-info"><b>Ohne Haken</b> gehört die Maßnahme zum <b>Zielbild</b>: Die Wohnung wird nach einem Auszug saniert und zur Zielmiete neu vermietet – die laufende Miete ändert sich bis dahin nicht. <b>Mit Haken</b> bleibt der Mieter wohnen, und 8 % der Kosten pro Jahr kommen als Modernisierungsumlage (§ 559 BGB) auf seine Miete.</span>'))
        + (m.id === 'sonst' ? '<label><span>Bezeichnung</span><input data-zb-t="' + i + '" value="' + esc(m.t) + '"></label>' : '')
        + '</div>';
    }).join('');
  }
  function chipStil() {
    if (el('dp-zb-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-zb-stil';
    s.textContent = [
      '.dp-zb-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 8px}',
      '.dp-zb-chip{font:500 12px Inter,sans-serif;border:1px solid #E6DCC2;border-radius:999px;padding:4px 10px;background:#fff;color:#2A2727;cursor:pointer}',
      '.dp-zb-chip em{font-style:normal;color:#6c6450;margin-left:2px}',
      /* v2430b: style.css faerbt Knoepfe in Karten golden (gemessen: Rahmen Gold 30 %, Grund weiss) -
         der gewaehlte Chip war vom freien nicht zu unterscheiden. Darum mit Anker und !important. */
      '#zb-karte .dp-zb-chip.on,#mfh-we-ov .dp-zb-chip.on,.dp-zb-chip.on{border-color:#2f7d55 !important;color:#2f7d55 !important;background:color-mix(in srgb,#2f7d55 9%,#fff) !important;font-weight:600 !important}',
      '.dp-zb-chip:focus-visible{outline:2px solid var(--wl-c9a84c, #C9A84C);outline-offset:2px}',
      /* v3016s · Marcel: „Zielbild auch besser darstellen, einfacher mit Karten" - jede Maßnahme eine Karte */
      '.dp-zb-mz{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:flex-end;padding:10px 12px;margin:8px 0;border:1px solid #E6DCC2;border-radius:12px;background:#fff;box-shadow:0 1px 3px rgba(42,39,39,.05);font-size:12.5px}',
      '.dp-zb-mz .dp-zb-mt{flex-basis:100%;font-size:13.5px}',
      '.dp-zb-mz:has(.dp-zb-bew input:checked){border-left:4px solid #3FA56C}',
      '.dp-zb-mz .dp-zb-mt{font-weight:600;min-width:110px}',
      '.dp-zb-mz label{display:flex;flex-direction:column;gap:2px;font-size:11.5px;color:#6B6356}',
      '.dp-zb-mz label.dp-zb-bew{flex-direction:row;align-items:center;gap:6px;color:#2A2727}',
      '.dp-zb-bew-info,.dp-zb-bew-nein{flex-basis:100%;font-size:11.5px;line-height:1.4;color:#6B6356}',
      '.dp-zb-mz input:not([type=checkbox]){width:110px;border:1px solid #E6E0D3;border-radius:8px;padding:5px 8px;font:13px Inter,sans-serif}',
      '.dp-zb-sum{font-size:12.5px;color:#6B6356;margin-top:8px}',
      '.dp-zb-sum b.c-soll{color:#3d6fa8}.dp-zb-sum b.c-ziel{color:#2f7d55}'
    ].join('');
    document.head.appendChild(s);
  }
  /** Chips und Kostenzeilen an einen Wirt binden. liste: Array (wird verändert). */
  function massnahmenBinden(host, liste, opts) {
    opts = opts || {};
    chipStil();
    function zeichne() {
      host.innerHTML = chipsHtml(liste, true, opts.e || null, opts.geb || null, !!opts.fuerEinheit, !!opts.fuerHaus)
        + '<div class="dp-zb-mliste">' + massnahmenZeilen(liste, opts.e || null) + '</div>';
      host.querySelectorAll('[data-zb-chip]').forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-zb-chip'), k = katalog(id);
          var i = -1; liste.forEach(function (m, n) { if (m.id === id) i = n; });
          if (i >= 0) liste.splice(i, 1); else liste.push({ id: id, t: k ? k.t : id, k: 0, bewohnt: false });
          zeichne(); if (opts.geaendert) opts.geaendert();
        };
      });
      host.querySelectorAll('[data-zb-k]').forEach(function (inp) {
        inp.oninput = function () { liste[+inp.getAttribute('data-zb-k')].k = zahl(inp.value); if (opts.geaendert) opts.geaendert(true); };
      });
      host.querySelectorAll('[data-zb-b]').forEach(function (cb) {
        cb.onchange = function () { liste[+cb.getAttribute('data-zb-b')].bewohnt = !!cb.checked; if (opts.geaendert) opts.geaendert(true); };
      });
      host.querySelectorAll('[data-zb-b]').forEach(function (cb) { cb.addEventListener('change', zeichne); });   /* v3001: Erhaltungsfeld ein-/ausblenden */
      host.querySelectorAll('[data-zb-e]').forEach(function (inp) {
        inp.oninput = function () { liste[+inp.getAttribute('data-zb-e')].erh = zahl(inp.value); if (opts.geaendert) opts.geaendert(true); };
      });
      host.querySelectorAll('[data-zb-t]').forEach(function (inp) {
        inp.oninput = function () { liste[+inp.getAttribute('data-zb-t')].t = inp.value || 'Sonstiges'; if (opts.geaendert) opts.geaendert(true); };
      });
    }
    zeichne();
    return zeichne;
  }

  var _objListe = null;
  function objektKarte() {
    var karte = el('zb-karte'); if (!karte) return;
    /* v2430b · die Gemeinde gleich holen (Leseroute, kein Kontingent) - sonst
       stand bis zum ersten Rechnen „20 %, Gemeinde noch nicht ermittelt". */
    if (!agsJetzt() && wert('plz')) agsHolen().then(function (a) { if (a) { try { objektSumme(); } catch (e) {} try { mietrechtKarte(); } catch (e) {} } });
    var mfh = artMitEinheiten() && window._dpMfh && Array.isArray(window._dpMfh.einheiten) && window._dpMfh.einheiten.length;
    var sumHost = el('zb-mfh-summe'), einzel = el('zb-einzel');
    if (mfh) {
      if (einzel) einzel.style.display = 'none';
      if (sumHost) {
        var m = modell();
        sumHost.style.display = '';
        sumHost.innerHTML = '<p class="sec-desc" style="margin:0 0 8px">Beim Mehrfamilienhaus stehen Soll-Miete und Zielbild je Wohnung — hier nur die Summe <b>aus den Wohnungen</b>. Ändern im Fenster „Einheiten erfassen" (Wohnung anklicken).</p>'
          + '<div class="dp-zb-sum">Ist <b>' + eur(m.stufen.bestand.miete_m) + '</b>/Monat'
          + (m.stufen.mieterhoehung ? ' · Mieterhöhung <b class="c-soll">' + eur(m.stufen.mieterhoehung.miete_m) + '</b>/Monat' + (m.stufen.mieterhoehung.vertrag_m > 0 ? ' (darin nach Vertrag, Staffel/Index — nicht § 558: ' + eur(m.stufen.mieterhoehung.vertrag_m) + ')' : '') : '')
          + (m.stufen.zielbild ? ' · Zielbild <b class="c-ziel">' + eur(m.stufen.zielbild.miete_m) + '</b>/Monat · Maßnahmen ' + eur(m.stufen.zielbild.kosten) : '')
          + (m.aktiv ? '' : ' · noch keine Soll-Miete oder kein Zielbild eingetragen') + '</div>'
          + herkunftHtml()   /* v2988 */
          + indexmieteHtml(m);   /* v3026 */
      }
      try { feshBinden(); } catch (e) {}   /* v3064 */
      try { mietrechtKarte(); } catch (e) { console.warn('[mietrecht]', e); }   /* v3062 */
      return;
    }
    if (sumHost) sumHost.style.display = 'none';
    if (einzel) einzel.style.display = '';
    var host = el('zb-massnahmen-host'), fld = el('zb_massnahmen');
    if (!host || !fld) return;
    _objListe = objektMassnahmen();
    massnahmenBinden(host, _objListe, { geaendert: function () {
      fld.value = _objListe.length ? JSON.stringify(_objListe) : '';
      objektSumme();
    } });
    objektSumme();
  }
  function objektSumme() {
    var host = el('zb-summe'); if (!host) return;
    var m = modell(), w = m.wohnungen[0] || {};
    if (m.art !== 'mfh') { try { objektLeiter(m); } catch (e) { console.warn('[leiter]', e); } }   /* v3067 */
    var s = w.soll || {};
    var vor = el('zb-soll-vorschlag');
    if (vor) vor.innerHTML = s.herkunft && !/^eigene Angabe/.test(s.herkunft) && s.miete   /* v3244: auch „eigene Angabe (Staffelmiete …)" */
      ? 'DealPilot rechnet vor: <b>' + eur2(s.miete / (m.wfl || 1)) + '/m²</b> (' + esc(s.grenze || s.herkunft) + ')' + (s.termine ? ', ' + esc(s.termine.text_lang) : '')   /* v3028: verlangbar ab · wirksam ab */ + '. Eigene Angabe überschreibt.' + (s.hinweise && s.hinweise.length ? ' Hinweis: ' + esc(s.hinweise.join(', ')) + '.' : '')
      : (s.grund && s.grund !== 'leer' ? esc(s.grund) : (s.hinweise && s.hinweise.length ? 'Hinweis: ' + esc(s.hinweise.join(', ')) : ''));
    host.innerHTML = !m.aktiv ? 'Ohne Angaben bleibt alles beim Bestand.'
      : 'Ist <b>' + eur(m.stufen.bestand.miete_m) + '</b>/Monat'
        + (m.stufen.mieterhoehung ? ' · Mieterhöhung <b class="c-soll">' + eur(m.stufen.mieterhoehung.miete_m) + '</b>/Monat' + (m.stufen.mieterhoehung.vertrag_m > 0 ? ' (darin nach Vertrag, Staffel/Index — nicht § 558: ' + eur(m.stufen.mieterhoehung.vertrag_m) + ')' : '') : '')
        + (m.stufen.zielbild ? ' · Zielbild <b class="c-ziel">' + eur(m.stufen.zielbild.miete_m) + '</b>/Monat' + (m.stufen.zielbild.kosten ? ' · Maßnahmen ' + eur(m.stufen.zielbild.kosten) : '') + (m.stufen.zielbild.plus ? ' · +' + dez(m.stufen.zielbild.plus, 1).replace(',0', '') + ' Modernisierungspunkte' : '') : '')
        + '<br>' + esc(m.kappung.text) + ' Die Ertragswerte stehen in der Pilot-Analyse (Reiter „Ankauf · Bestand · Zielbild") und in beiden PDFs.';
    if (m.aktiv) host.innerHTML += herkunftHtml();   /* v2988 */
    var ih = indexmieteHtml(m);   /* v3026 */
    if (ih) host.innerHTML = (m.aktiv ? host.innerHTML : '') + ih;
    host.innerHTML += standardhebungHtml(objektMassnahmen());   /* v3064 */
    try { feshBinden(); } catch (e) {}
    try { mietrechtKarte(); } catch (e) { console.warn('[mietrecht]', e); }   /* v3062 */
  }
  function bindeObjektFelder() {
    ['zb_soll_qm', 'zb_ziel_qm', 'zb_soll_ab', 'zb_vgl_qm', 'zb_ziel_wann', 'zb_fertig_jahr', 'zb_markt_qm', 'san', 'kaufdat', 'nkm', 'wfl', 'ds2_marktmiete', 'me_soll', 'mv_letzte_erhoehung', 'mv_letzte_erhoehung_betrag', 'mv_art', 'mv_beginn'].forEach(function (id) {   /* v3026: mv_art, mv_beginn */
      var e = el(id); if (!e || e._dpZb) return; e._dpZb = true;
      e.addEventListener('input', function () { objektSumme(); });
      e.addEventListener('change', function () { objektSumme(); });
    });
  }
  function start() {
    kappungLaden().then(function () { objektKarte(); });
    bindeObjektFelder();
    objektKarte();
    try { feshBinden(); } catch (e) {}   /* v3064 */
    var a = el('objart'); if (a && !a._dpZb) { a._dpZb = true; a.addEventListener('change', objektKarte); }
    /* me_modus ist ein verstecktes Feld: setzt es die Übernahme aus Sprache
       oder Import, folgt der Modus (Knöpfe, Rechnung) hier. */
    var mm = el('me_modus');
    if (mm && !mm._dpZb) {
      mm._dpZb = true;
      var folgen = function () { var ME = window.MietEntwicklung; if (ME && ME.setMode && ME.getMode && mm.value && ME.getMode() !== mm.value) ME.setMode(mm.value); };
      mm.addEventListener('input', folgen); mm.addEventListener('change', folgen);
    }
    /* Der Knopf „Ertragswerte rechnen" steht in fremden Ansichten (Pilot-
       Analyse) — ein delegierter Behandler erreicht jede. */
    /* v2431 · der vorhandene Weg zu Stufe 3: Zielstufe 3 setzen und in den Tab
       Objekt wechseln, wo die Pflichtfelder und der Abruf stehen. Abgerufen
       (und abgerechnet) wird hier NICHTS. */
    document.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-dp-pot-stufe3]') : null;
      if (!b) return;
      /* v3078 · Stufe 3 wählen, wenn der Detailgrad sie freigibt — sonst zeigt
         der Reiter Objekt den Weg in die Einstellungen. Kein Hochschalten. */
      try { var _OR = window.DealPilotObjektReiter; if (_OR && _OR.mbWaehlen && !_OR.mbWaehlen(3) && _OR.stufeAbrufen) _OR.stufeAbrufen(3); } catch (e) {}
      try { if (typeof window.switchTab === 'function') window.switchTab(0); } catch (e) {}
      setTimeout(function () { var z = el('oe-ziel-status'); if (z && z.scrollIntoView) z.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 250);
    });
    /* v2542 · Abruf „Marktpreise": erst fragen (kostet Kontingent), dann abrufen */
    document.addEventListener('click', function (ev) {
      var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
      if (t.closest('[data-dp-markt-abruf]')) { _markt.zustand = 'frage'; marktNeuZeichnen(); return; }
      if (t.closest('[data-dp-markt-nein]')) { _markt.zustand = 'ruhe'; marktNeuZeichnen(); return; }
      if (t.closest('[data-dp-markt-ja]')) { marktAbrufen(); return; }
    });
    document.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-dp-pot-rechnen]') : null;
      if (!b) return;
      b.disabled = true; b.textContent = 'wird gerechnet …';
      laufAnzeige(true, 'Ertragswerte werden gerechnet', 'Bestand, Mieterhöhung und Zielbild nach ImmoWertV — mit den Werten des Gutachterausschusses. Das dauert meist 5 bis 30 Sekunden.');
      rechnen({ erzwingen: true }).then(function (r) {
        laufAnzeige(false);
        var host = b.closest('[data-dp-pot-wirt]');
        if (host) host.innerHTML = tafelHtml();
        else { b.disabled = false; b.textContent = (r && r.verfuegbar) ? 'gerechnet — Ansicht neu öffnen' : 'nicht verfügbar'; }
        if (r && !r.verfuegbar && !gesperrt(r) && typeof window.toast === 'function') window.toast('Ertragswert: ' + (r.grund || 'nicht verfügbar'));
      }, function () { laufAnzeige(false); b.disabled = false; b.textContent = 'Ertragswerte rechnen'; });   /* v2556c */
    });
  }
  window.addEventListener('dp:object-ready', function () { setTimeout(objektKarte, 300); setTimeout(function () { try { bewertungKarte(); } catch (e) {} }, 400); });
  /* v2460 · Tab Bewertung: beim Öffnen des Tabs, nach jedem Ertragswert-Lauf
     und auf Knopfdruck neu zeichnen. */
  var _bwRs = null;
  window.addEventListener('resize', function () {
    clearTimeout(_bwRs);
    _bwRs = setTimeout(function () { var k = el('card-wertpotenzial'); if (k && k.clientWidth && Math.abs((k.clientWidth - 40) - (k._dpWpBreite || 0)) > 40) { try { bewertungKarte(); } catch (e) {} } }, 250);
  });
  window.addEventListener('dp:potenzial', function () { setTimeout(function () { try { bewertungKarte(); } catch (e) {} }, 0); });
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-target-sec="s6"],[data-dp-wp-rechnen]') : null;
    if (!t) return;
    if (t.hasAttribute('data-dp-wp-rechnen')) { _bwVersucht = {}; bwRechnen(); return; }
    setTimeout(function () { try { bewertungKarte(); } catch (e) {} }, 120);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ── Sprache / geführte Eingabe: Wohnungen aus einer Antwort ───────────
     voice-import.js fragt beim MFH freiwillig je Wohnung nach Fläche, Ist,
     Soll-Miete, Zielmiete und letzter Erhöhung (Katalogfeld `mfh_wohnungen`,
     Format „Nr | Lage | m² | Ist €/Monat | Soll €/Monat | Ziel €/m² |
     letzte Erhöhung", eine Zeile je Wohnung; JSON geht auch). Hier wird
     daraus `_dpMfh.einheiten` — bestehende Wohnungen (gleiche Nummer oder
     Lage) werden ergänzt, nie geleert. */
  var MONATE = { jan: 1, feb: 2, 'mär': 3, mar: 3, mrz: 3, apr: 4, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dez: 12, dec: 12 };
  function datumAus(t) {
    t = String(t || '').trim().toLowerCase(); if (!t) return '';
    var m = /(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(t);
    if (m) return m[1] + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+(m[3] || 1)).padStart(2, '0');
    m = /(?:(\d{1,2})\.)?(\d{1,2})[.\/](\d{4})/.exec(t);
    if (m) return m[3] + '-' + String(+m[2]).padStart(2, '0') + '-' + String(+(m[1] || 1)).padStart(2, '0');
    m = /([a-zäöü]{3})[a-zäöü]*\.?\s*(\d{4})/.exec(t);
    if (m && MONATE[m[1]]) return m[2] + '-' + String(MONATE[m[1]]).padStart(2, '0') + '-01';
    m = /(\d{4})/.exec(t); if (m) return m[1] + '-01-01';
    return '';
  }
  function wohnungenAusText(roh) {
    var zeilen = [];
    try { var j = typeof roh === 'string' ? JSON.parse(roh) : roh; if (Array.isArray(j)) zeilen = j; } catch (e) { zeilen = []; }
    if (!zeilen.length) {
      zeilen = String(roh || '').split(/\n|;/).map(function (z) { return z.trim(); }).filter(Boolean).map(function (z) {
        var t = z.split('|').map(function (x) { return x.trim(); });
        return { nr: t[0], lage: t[1], wfl: t[2], ist: t[3], soll: t[4], ziel_qm: t[5], letzte: t[6] };
      });
    }
    var D = window._dpMfh && Array.isArray(window._dpMfh.einheiten) ? window._dpMfh : { einheiten: [], gebaeude: {} };
    var n = 0;
    zeilen.forEach(function (w) {
      if (!w) return;
      var nr = String(w.nr || '').replace(/^(we|wohnung|nr\.?)\s*/i, '').trim(), lage = String(w.lage || '').trim();
      var zz = function (v) { var x = zahl(String(v == null ? '' : v).replace(/[^\d,.\-]/g, '')); return x > 0 ? x : 0; };
      if (!nr && !lage && !zz(w.wfl) && !zz(w.ist)) return;
      var e = D.einheiten.filter(function (x) { return (nr && String(x.nr || '') === nr) || (lage && String(x.lage || '').toLowerCase() === lage.toLowerCase()); })[0];
      if (!e) { e = { nr: nr || String(D.einheiten.length + 1), lage: lage, art: 'wohnen', status: 'vermietet' }; D.einheiten.push(e); }
      if (lage && !e.lage) e.lage = lage;
      if (zz(w.wfl)) e.wfl = String(zz(w.wfl)).replace('.', ',');
      if (zz(w.ist)) { e.ist = String(Math.round(zz(w.ist))); e.status = 'vermietet'; }
      else if (/leer/i.test(String(w.ist || ''))) e.status = 'leer';
      if (zz(w.soll)) e.soll = String(Math.round(zz(w.soll)));
      if (zz(w.ziel_qm)) e.ziel_qm = String(zz(w.ziel_qm)).replace('.', ',');
      var dt = datumAus(w.letzte || w.letzte_erhoehung || w.mv_letzte_erhoehung);
      if (dt) e.mv_letzte_erhoehung = dt;
      n++;
    });
    if (n) {
      window._dpMfh = D;
      try { if (M().knopf) M().knopf(); } catch (e) {}
      try { objektKarte(); } catch (e) {}
    }
    return n;
  }

  /* v3026 · kommt die VPI-Reihe nach dem ersten Zeichnen, die Indexmiete nachziehen */
  window.addEventListener('dp:indexreihen', function () { try { objektKarte(); } catch (e) {} });

  window.DpPotenzial = {
    mietpreisbremse: mietpreisbremse, mietrechtDaten: mietrechtDaten, mietrechtHtml: mietrechtHtml, mietrechtKarte: mietrechtKarte,   /* v3062 */
    mietrechtOrt: function () { var g = agsJetzt(); return { ags: g, kapp: kappung(g), bremse: mietpreisbremse(g) }; },   /* v3082: fuer die Pilot-Mietpreis-Analyse */
    standardhebung: standardhebung, standardhebungHtml: standardhebungHtml, feshBinden: feshBinden,   /* v3064 */
    leiterZeilen: leiterZeilen, leiterHtml: leiterHtml, leiterBinden: leiterBinden,   /* v3067 */
    marktSaniert: marktSaniert, vorschlagFuer: vorschlagFuer, zielVorschlaege: zielVorschlaege, zielVorschlagHtml: zielVorschlagHtml,   /* v3130 · N115 */
    wohnungenAusText: wohnungenAusText, _datumAus: datumAus,
    ohneZielbild: ohneZielbild,   /* v3018d */
    KENNZEICHNUNG: KENNZEICHNUNG, GESPERRT_KURZ: GESPERRT_KURZ, GESPERRT_LANG: GESPERRT_LANG, gesperrt: gesperrt, MASSNAHMEN: MASSNAHMEN, AUFTEILUNG_JE_WE: AUFTEILUNG_JE_WE,
    kappung: kappung, kappungLaden: kappungLaden, kappungDaten: kappungDaten, agsHolen: agsHolen,   /* v3075: kappungDaten */
    massnahmenVon: massnahmenVon, massnahmenSpiegeln: massnahmenSpiegeln, massnahmenBinden: massnahmenBinden,
    katalog: katalog,   /* v3161 · Gewerk je Massnahme fuer die Schnittstelle (storage.js _soll_einheiten) */
    punkteGewinn: punkteGewinn, sollFuer: sollFuer, umlage559: umlage559,
    soll558: soll558, sollVertrag: sollVertrag, objektVgl: objektVgl,   /* v3244 */
    modell: modell, rechnen: rechnen, ergebnis: ergebnis, ergebnisVeraltet: ergebnisVeraltet,
    wohnungErgebnis: wohnungErgebnis, kennzahlen: kennzahlen, tafelHtml: tafelHtml, pdfDaten: pdfDaten, pilotPayload: pilotPayload,
    brueckeDaten: brueckeDaten, brueckeAchse: brueckeAchse, ueberleitungZeilen: ueberleitungZeilen, STUFE_FARBE: STUFE_FARBE, bewertungKarte: bewertungKarte, bewertungHtml: bewertungHtml, stufenWerte: stufenWerte, KURZ_AUSBLICK: KURZ_AUSBLICK,
    sollFuerMietentwicklung: sollFuerMietentwicklung, objektKarte: objektKarte,
    herkunft: herkunft, herkunftAusDaten: herkunftAusDaten, herkunftHtml: herkunftHtml, leeren: leeren,   /* v2988 */
    indexmieteFuer: indexmieteFuer, indexmieteHtml: indexmieteHtml, indexmieteDaten: indexmieteDaten,   /* v3026 */
    mhTermine: mhTermine, wirksamNachZugang: wirksamNachZugang, TERMIN_REGEL: TERMIN_REGEL, mmjj: mmjj,   /* v3028 */
    zielBmrAn: zielBmrAn, zielBmrPruefen: zielBmrPruefen,   /* v3213 · W-6 */
    _hash: hash, _auftrag: auftrag
  };
})();
