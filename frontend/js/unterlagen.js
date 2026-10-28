'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   unterlagen.js — v3016 · Die Unterlagen eines Objekts lesen und auswerten

   Marcel, 28.10.2026: „Unter Exposé/Marktbericht in der Datenaufnahmekarte wäre es
   toll, wenn wir auch diese Dokumente auslesen könnten und in dem Feld ‚Bekannte
   Risiken' die Risiken aus den WEG-Protokollen und auch Baulasten oder etwas aus dem
   Grundbuch reingeschrieben werden. Auch eine Investitionsthese … Es soll einfach
   alles Verwertbare aus allen Dokumenten entnommen werden … WEG-Protokolle sollen
   ausgewertet werden … dafür in der Pilot-Analyse einen Reiter."

   GEMESSEN an seinem Ordner Sachsenstr (15 PDFs): 14 sind Scans ohne Textschicht.
   Der alte Weg (Tesseract im Browser) las höchstens 6 Seiten — ein WEG-Protokoll hat
   10, die Teilungserklärung 36. Deshalb liest dieses Modul gescannte Seiten über die
   KI (POST /ai/seiten-lesen, je Aufruf 3 Seiten); Personennamen ersetzt schon das
   Modell, danach schwärzt der Server.

   Persönliche Unterlagen eines Mieters (Mietzahlungsbestätigung, Rentenbescheid,
   Selbstauskunft …) gehören nicht zum Objekt: nach den ersten zwei Seiten erkannt,
   der Rest wird gar nicht erst gelesen.

   Was dieses Modul NICHT tut: Felder schreiben. Das macht der Import (object-actions.js)
   über seine Abgleichtabelle — gleich, abweichend, leer — wie bei jedem Dokument.
   Hier liegen Lesen, die Gesamtauswertung, die Anzeige und das Gedächtnis
   (#_dok_auswertung, mit dem Objekt gespeichert).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DpUnterlagen) return;

  var MAX_SEITEN = 40, JE_AUFRUF = 3, PARALLEL = 2;
  var PERSOENLICH = /Mietzahlungsbest(ä|ae)tigung|Mietschuldenfreiheit|Selbstauskunft|Rentenbescheid|Gehaltsabrechnung|Lohnabrechnung|Verdienstabrechnung|SCHUFA|Bonit(ä|ae)tsauskunft|Entsch(ä|ae)digungsrente|Personalausweis|Kontoauszug/i;
  var GOLD = 'var(--wl-c9a84c, #C9A84C)';

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function zahl(v) { if (v == null || v === '') return null; var n = Number(v); return isFinite(n) ? n : null; }
  function eur(v) { var n = zahl(v); return n == null ? '' : n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'; }

  /* ── 1 · Gescannte Seiten lesen ─────────────────────────────────────────── */
  function pdfjs() {
    return new Promise(function (ok, nein) {
      if (window.pdfjsLib) { ok(window.pdfjsLib); return; }
      var s = document.createElement('script');
      s.src = '/vendor/cdn/pdf.js/3.11.174/pdf.min.js';
      s.onload = function () { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/cdn/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {} ok(window.pdfjsLib); };
      s.onerror = function () { nein(new Error('pdf.js konnte nicht geladen werden')); };
      document.head.appendChild(s);
    });
  }
  async function seiteAlsBild(pdf, nr) {
    var page = await pdf.getPage(nr);
    var vp0 = page.getViewport({ scale: 1 });
    var vp = page.getViewport({ scale: Math.min(2.2, 1500 / vp0.width) });
    var cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: cx, viewport: vp }).promise;
    return cv.toDataURL('image/jpeg', 0.72);
  }
  async function bilderLesen(pdf, nrs) {
    var bilder = [];
    for (var i = 0; i < nrs.length; i++) bilder.push(await seiteAlsBild(pdf, nrs[i]));
    var r = await window.Auth.apiCall('/ai/seiten-lesen', { method: 'POST', body: { bilder: bilder } });
    if (!r || !r.success) throw new Error((r && r.error) || 'Seiten konnten nicht gelesen werden.');
    return String(r.text || '');
  }
  /** file → { text, seiten, gelesen, persoenlich, gekuerzt } */
  async function seitenLesen(file, status) {
    var lib = await pdfjs();
    var pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    var n = Math.min(pdf.numPages, MAX_SEITEN);
    var say = function (t) { try { if (status) status(t); } catch (e) {} };
    say('Scan · Seite 1–' + Math.min(2, n) + ' von ' + n);
    var erste = await bilderLesen(pdf, n >= 2 ? [1, 2] : [1]);
    if (PERSOENLICH.test(erste)) return { text: '', seiten: pdf.numPages, gelesen: Math.min(2, n), persoenlich: true };
    var pakete = [];
    for (var s = 3; s <= n; s += JE_AUFRUF) { var p = []; for (var k = s; k < s + JE_AUFRUF && k <= n; k++) p.push(k); pakete.push(p); }
    var teile = new Array(pakete.length), naechstes = 0, fertig = 0;
    async function arbeiter() {
      while (naechstes < pakete.length) {
        var i = naechstes++;
        try { teile[i] = await bilderLesen(pdf, pakete[i]); } catch (e) { teile[i] = '[Seiten ' + pakete[i].join(', ') + ' nicht lesbar]'; }
        fertig++; say('Scan · ' + Math.min(n, 2 + fertig * JE_AUFRUF) + ' von ' + n + ' Seiten');
      }
    }
    var a = []; for (var w = 0; w < PARALLEL; w++) a.push(arbeiter());
    await Promise.all(a);
    return { text: [erste].concat(teile).join('\n\n'), seiten: pdf.numPages, gelesen: n, persoenlich: false, gekuerzt: pdf.numPages > MAX_SEITEN };
  }
  /** Erkennt persönliche Unterlagen auch in einem PDF MIT Textschicht. */
  function istPersoenlich(text) { return PERSOENLICH.test(String(text || '').slice(0, 4000)); }

  /* ── 2 · Felder aus den gelesenen Daten ─────────────────────────────────── */
  /** "125,5/1.000" | "125.5/1000" → 12.55 (Prozent), sonst null */
  function meaProzent(v) {
    var m = String(v == null ? '' : v).replace(/\s/g, '').match(/^([\d.,]+)\/([\d.,]+)/);
    if (!m) return null;
    var z = function (x) { x = x.indexOf(',') >= 0 ? x.replace(/\./g, '').replace(',', '.') : (/^\d{1,3}(\.\d{3})+$/.test(x) ? x.replace(/\./g, '') : x); return parseFloat(x); };
    var a = z(m[1]), b = z(m[2]);
    return (a > 0 && b > 0 && a < b) ? Math.round(a / b * 10000) / 100 : null;
  }
  function datumIso(v) {
    var m = String(v || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  }
  var VERTRAG = { unbefristet: 'unbefristet', staffel: 'staffel', index: 'index', zeitmiete: 'zeitmiete', gewerbe: 'gewerbe' };
  /** Einheiten für das MFH-Fenster aus Mieterliste oder Teilungserklärung */
  function einheitenAus(typ, ext) {
    var liste = (ext && Array.isArray(ext.einheiten)) ? ext.einheiten : [];
    var aus = [];
    liste.forEach(function (w, i) {
      if (!w) return;
      var art = String(w.nutzung || w.art || '').toLowerCase();
      if (/stellplatz|garage|keller/.test(art)) return;
      var e = { nr: String(w.nr || (i + 1)).replace(/^(we|wohnung|nr\.?)\s*/i, ''), lage: w.lage || '' };
      if (/gewerbe/.test(art)) e.art = 'gewerbe';
      if (zahl(w.wfl_m2)) e.wfl = String(w.wfl_m2).replace('.', ',');
      if (zahl(w.zimmer)) e.zimmer = String(w.zimmer).replace('.', ',');
      if (typ === 'mietaufstellung') {
        if (zahl(w.kaltmiete_eur) > 0) { e.ist = String(Math.round(w.kaltmiete_eur)); e.status = 'vermietet'; }
        if (String(w.status || '').toLowerCase() === 'leer') { e.status = 'leer'; }
        if (VERTRAG[w.vertragsart]) e.mv_art = VERTRAG[w.vertragsart];
        if (datumIso(w.mietbeginn)) e.mv_beginn = datumIso(w.mietbeginn);
        if (datumIso(w.letzte_erhoehung)) e.mv_letzte_erhoehung = datumIso(w.letzte_erhoehung);
        if (zahl(w.nk_vorauszahlung_eur)) e.nk_vorauszahlung = String(Math.round(w.nk_vorauszahlung_eur));
        if (zahl(w.kaution_eur)) e.mv_kaution = String(Math.round(w.kaution_eur));
      }
      if (w.mea) { var mp = meaProzent(w.mea); if (mp != null) e.mea_anteil = String(mp).replace('.', ','); }
      aus.push(e);
    });
    return aus;
  }

  /* ── 3 · Gedächtnis: #_dok_auswertung ───────────────────────────────────── */
  function laden() { var f = el('_dok_auswertung'); if (!f || !f.value) return null; try { return JSON.parse(f.value); } catch (e) { return null; } }
  function merken(o) {
    var f = el('_dok_auswertung'); if (!f) return;
    f.value = o ? JSON.stringify(o) : '';
    try { f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    neuZeichnen();   /* v3021k */
  }
  /* v3021k · GEMESSEN 28.10.2026 (Webinar-Mitschnitt, Lindenallee 14): nach „Unterlagen nachreichen“
     standen 3 Änderungen in #_dok_auswertung, im Reiter aber keine - und Baulasten weiter „liegt nicht
     vor“. Der Reiter ist Teil der gezeichneten Pilot-Analyse und las die Auswertung nur beim Zeichnen.
     Jetzt wird die Analyse neu gezeichnet; war „Unterlagen & WEG“ offen, bleibt er offen. */
  function neuZeichnen() {
    try {
      if (typeof window._dpPaNeuZeichnen !== 'function') return;
      var offen = [].some.call(document.querySelectorAll('.dp-pa-tab.active'), function (b) { return b.offsetWidth && /Unterlagen/.test(b.textContent || ''); });
      window._dpPaNeuZeichnen();
      if (offen) [].forEach.call(document.querySelectorAll('#ai-content .dp-pa-tab'), function (b) { if (/Unterlagen/.test(b.textContent || '')) b.click(); });
    } catch (e) {}
  }
  function v(id) { var e = el(id); return e ? String(e.value || '').trim() : ''; }
  /* v3017 · Marcel 28.10.2026: „werden bei den Maßnahmen auch die Kosten für eine einzelne ETW über den
     Miteigentumsanteil runtergebrochen?" - jetzt fest gerechnet, nicht der KI überlassen: ETW mit MEA im
     Objekt → Gesamtkosten × MEA; ganzes Haus → 100 %. */
  function anteil(gesamt) {
    var g = zahl(gesamt); if (g == null) return null;
    var mea = parseFloat(String(v('mea')).replace(/\./g, '').replace(',', '.'));
    if (v('objart') === 'ETW') return mea > 0 ? { eur: g * mea / 100, wie: 'MEA ' + String(mea).replace('.', ',') + ' %' } : null;
    return { eur: g, wie: 'ganzes Haus' };
  }
  function nachreichen() {   /* v3017 · Unterlagen in der Pilot-Analyse nachreichen */
    if (window.ObjectActions && typeof window.ObjectActions.openImport === 'function') window.ObjectActions.openImport(null, { ergaenzen: true });
  }
  async function auswerten(dokumente, opts) {
    var objekt = { objektart: v('objart'), adresse: [v('str'), v('hnr'), v('plz'), v('ort')].join(' ').trim(), kaufpreis: v('kp'), wohnflaeche: v('wfl'),
      baujahr: v('baujahr'), nettokaltmiete_monat: v('nkm'), miteigentumsanteil_pct: v('mea'), einheiten: v('einheiten'), hausgeld_ul_jahr: v('hg_ul'), hausgeld_nul_jahr: v('hg_nul') };
    /* v3016f · gemessen am Demo-Set Lindenallee (MFH, alle 6 Einheiten im Paket): die Auswertung
       rechnete die Sonderumlage mit dem MEA EINES Grundbuchblatts (204/1.000 → 9.466 statt 46.400 €).
       Ohne eigenen MEA im Objekt wird das ganze Gebäude gekauft. */
    objekt.kauf_umfang = (v('mea') && v('objart') === 'ETW') ? 'eine Einheit, Anteil laut Miteigentumsanteil' : (v('mea') ? 'Anteil laut Miteigentumsanteil' : 'ganzes Gebaeude, alle Einheiten (Anteil 100 %)');
    var body = { dokumente: dokumente, objekt: objekt };
    var alt = opts && opts.ergaenzen ? laden() : null;   /* v3017 · zusammenführen statt ersetzen */
    if (alt && alt.auswertung) { body.vorher = alt.auswertung; body.vorherDokumente = (alt.dokumente || []).map(function (x) { return x.label + (x.datum ? ' ' + x.datum : ''); }); }
    var r = await window.Auth.apiCall('/ai/dokumente-auswerten', { method: 'POST', body: body });
    if (!r || !r.success) throw new Error((r && r.error) || 'Auswertung fehlgeschlagen.');
    return r.auswertung || {};
  }
  /** Was in den Prompt der Pilot-Analyse geht (ui.js _buildAIPayload) */
  function promptTeile() {
    var d = laden(); if (!d || !d.auswertung) return {};
    var a = d.auswertung;
    var r = (a.risiken || []).slice(0, 12).map(function (x) { return '[' + (x.schwere || '') + '] ' + x.titel + ': ' + x.beschreibung + (x.kosten_eur ? ' (' + eur(x.kosten_eur) + ')' : '') + ' — ' + (x.quelle || ''); }).join(' | ');
    var w = a.weg ? [(a.weg.kernpunkte || []).join(' · '), a.weg.ruecklage ? 'Rücklage: ' + a.weg.ruecklage : '', a.weg.fazit || ''].filter(Boolean).join(' | ') : '';
    return {
      dok_unterlagen: (d.dokumente || []).map(function (x) { return x.label + (x.datum ? ' ' + x.datum : ''); }).join(', ') || null,
      dok_risiken: r || null,
      dok_weg: w || null
    };
  }

  /* ── 4 · Anzeige ────────────────────────────────────────────────────────── */
  function stil() {
    if (el('dpu-stil')) return;
    var s = document.createElement('style'); s.id = 'dpu-stil';
    s.textContent = [
      '.dpu-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 8px}',
      '.dpu-tab{border:1px solid rgba(42,39,39,.18);background:#fff;border-radius:999px;padding:4px 11px;font-size:12px;cursor:pointer;color:#2A2727;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dpu-tab.on{background:#2A2727;color:#fff;border-color:#2A2727}',
      '.dpu-nach{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:8px 0 10px;font-size:12px;color:#7A7370}',
      '.dpu-nach-btn{border:1px solid var(--gold,#C9A84C);background:#fff;color:#2A2727;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer;min-height:40px}',
      '.dpu-nach-btn:hover{background:#FBF6E9}',
      '.dpu-nach span{flex:1 1 260px;line-height:1.4}',
      '.dpu-aend{margin:0 0 10px;padding:9px 12px;border-radius:8px;background:#FBF6E9;border-left:3px solid var(--gold,#C9A84C);font-size:12.5px}',
      '.dpu-aend ul{margin:4px 0 0;padding-left:18px}',
      '.dpu-tab .dpu-n{display:inline-block;margin-left:5px;padding:0 5px;border-radius:8px;background:rgba(184,98,92,.15);color:#B8625C;font-size:10.5px}',
      '.dpu-tab.on .dpu-n{background:rgba(255,255,255,.2);color:#fff}',
      '.dpu-dl{display:grid;grid-template-columns:minmax(120px,38%) 1fr;gap:3px 12px;font-size:12.5px;margin:6px 0}',
      '.dpu-dl dt{color:#7A7370}.dpu-dl dd{margin:0;color:#2A2727}',
      '.dpu-ul{margin:4px 0 8px 18px;padding:0;font-size:12.5px;line-height:1.45}',
      '.dpu-tbl{border-collapse:collapse;font-size:12px;margin:4px 0 10px;width:100%}',
      '.dpu-tbl th,.dpu-tbl td{border-bottom:1px solid rgba(42,39,39,.1);padding:3px 6px;text-align:left;vertical-align:top}',
      '.dpu-tbl th{color:#7A7370;font-weight:600}',
      '.dpu-h{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#7A7370;margin:12px 0 4px;font-weight:600}',
      '.dpu-risiko{border:1px solid rgba(42,39,39,.12);border-left:4px solid #B8625C;border-radius:8px;padding:8px 10px;margin:6px 0;background:#fff}',
      '.dpu-risiko.mittel{border-left-color:' + GOLD + '}.dpu-risiko.niedrig{border-left-color:#3FA56C}',
      '.dpu-risiko b{font-size:13px}.dpu-risiko p{margin:3px 0 0;font-size:12.5px;line-height:1.45}',
      '.dpu-pill{display:inline-block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:1px 7px;border-radius:999px;margin-left:6px;vertical-align:1px;background:rgba(184,98,92,.14);color:#B8625C}',
      '.dpu-pill.mittel{background:color-mix(in srgb, ' + GOLD + ' 18%, transparent);color:#8a6d1f}.dpu-pill.niedrig{background:rgba(63,165,108,.14);color:#2f7d52}',
      '.dpu-quelle{font-size:11.5px;color:#7A7370;margin-top:3px}',
      '.dpu-these{border-left:3px solid ' + GOLD + ';padding:6px 10px;background:#FBF6E9;border-radius:6px;font-size:13px;line-height:1.5}',
      '.dpu-hinweis{font-size:12px;color:#7A7370;margin:6px 0}',
      '.dpu-gesperrt{padding:9px 11px;border-radius:8px;border:1px dashed rgba(42,39,39,.3);font-size:12.5px;background:#fff}',
      /* v3016x · WEG-Blöcke */
      '.dpu-weg{margin:14px 0 6px;border:1px solid rgba(42,39,39,.12);border-radius:12px;overflow:hidden;background:#fff}',
      '.dpu-weg-kopf{background:#2A2727;color:#fff;font:600 12px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;padding:9px 14px}',
      '.dpu-weg-blk{padding:12px 14px;border-top:1px solid rgba(42,39,39,.08)}.dpu-weg-blk:first-of-type{border-top:0}',
      '.dpu-weg-t{font:600 11.5px Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#7A7370;margin:0 0 8px}',
      '.dpu-zeit{list-style:none;margin:0;padding:0 0 0 14px;border-left:2px solid ' + GOLD + '}',
      '.dpu-zeit li{position:relative;margin:0 0 7px;font-size:12.8px;line-height:1.45}.dpu-zeit li::before{content:"";position:absolute;left:-19px;top:6px;width:8px;height:8px;border-radius:50%;background:' + GOLD + '}',
      '.dpu-zeit li b{display:inline-block;min-width:64px;margin-right:6px;color:#2A2727}',
      '.dpu-weg-geld{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}',
      '.dpu-weg-geld div{background:#FBF6E9;border-radius:10px;padding:10px 12px}.dpu-weg-geld span{font:600 11px Inter,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#7A7370}.dpu-weg-geld p{margin:4px 0 0;font-size:12.8px;line-height:1.45}',
      '.dpu-tbl .r{text-align:right;white-space:nowrap}',
      '.dpu-st{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;background:rgba(42,39,39,.07)}.dpu-st-beschlossen{background:rgba(184,98,92,.13);color:#B8625C}.dpu-st-geplant{background:color-mix(in srgb, ' + GOLD + ' 18%, transparent);color:#8a6d1f}.dpu-st-erledigt{background:rgba(63,165,108,.14);color:#2f7d52}',
      '.dpu-weg-p{margin:0;font-size:13px;line-height:1.5}.dpu-weg-fazit{background:#FBFAF7}',
      /* v3016r · Einfach/Genau */
      '.dpu-umschalter{display:inline-flex;border:1px solid rgba(42,39,39,.18);border-radius:999px;overflow:hidden;margin:0 0 12px}',
      '.dpu-umschalter button{border:0;background:#fff;padding:5px 14px;font-size:12.5px;cursor:pointer;color:#2A2727}',
      '.dpu-umschalter button.on{background:#2A2727;color:#fff}',
      '.dpu-ampel{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 12px}',
      '.dpu-ampel div{border-radius:12px;padding:12px 14px;background:#fff;border:1px solid rgba(42,39,39,.1);text-align:center}',
      '.dpu-ampel b{display:block;font-size:26px;line-height:1.1}.dpu-ampel span{font-size:11.5px;color:#7A7370;text-transform:uppercase;letter-spacing:.06em}',
      '.dpu-ampel .hoch b{color:#B8625C}.dpu-ampel .mittel b{color:#8a6d1f}.dpu-ampel .niedrig b{color:#3FA56C}',
      '.dpu-karten{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin:0 0 12px}',
      '.dpu-karte{border-radius:12px;padding:12px 14px;background:#fff;border:1px solid rgba(42,39,39,.1);border-top:4px solid #B8625C}',
      '.dpu-karte.mittel{border-top-color:' + GOLD + '}.dpu-karte.niedrig{border-top-color:#3FA56C}.dpu-karte.neutral{border-top-color:#2A2727}',
      '.dpu-karte h4{margin:0 0 4px;font-size:14px}.dpu-karte p{margin:0;font-size:12.5px;line-height:1.45;color:#3a3633}',
      '.dpu-karte .dpu-gross{font-size:22px;font-weight:700;margin:2px 0 4px}',
      '.dpu-karte .dpu-quelle{margin-top:6px}'
    ].join('\n');
    document.head.appendChild(s);
  }
  var NAMEN = {
    amtsgericht: 'Amtsgericht', blatt_nr: 'Blatt', eigentuemer_anzahl: 'Eigentümer (Anzahl)', eigentuemer_anteile: 'Anteile', flurstuecke: 'Flurstücke',
    abt_ii: 'Abteilung II (Lasten)', abt_iii: 'Abteilung III (Grundpfandrechte)', grundschulden_gesamt_eur: 'Grundschulden gesamt', wohnungsgrundbuch: 'Wohnungsgrundbuch',
    miteigentumsanteil: 'Miteigentumsanteil', sondereigentum: 'Sondereigentum', sondernutzungsrechte: 'Sondernutzungsrechte', gemarkung: 'Gemarkung', flur: 'Flur', flurstueck: 'Flurstück',
    grundstuecksflaeche_m2: 'Grundstücksfläche', versammlungsdatum: 'Versammlung am', verwalter: 'Verwalter', art: 'Art', instandhaltungsruecklage_eur: 'Erhaltungsrücklage',
    ruecklage_stand_eur: 'Rücklage (Stand)', ruecklage_zufuehrung_jahr_eur: 'Zuführung je Jahr', hausgeld_monatlich_eur: 'Hausgeld je Monat', wirtschaftsplan_gesamt_eur: 'Wirtschaftsplan gesamt',
    sonderumlagen_geplant: 'Sonderumlagen', beschluesse_wichtig: 'Wichtige Beschlüsse', geplante_sanierungen: 'Geplante Sanierungen', kernpunkte: 'Kernpunkte', maengel: 'Mängel',
    rechtsstreitigkeiten: 'Rechtsstreitigkeiten', hausgeldrueckstaende: 'Hausgeldrückstände', verwalterwechsel: 'Verwalterwechsel', ausweisart: 'Ausweisart', gueltig_bis: 'Gültig bis',
    energieeffizienzklasse: 'Effizienzklasse', endenergie_kwh_m2a: 'Endenergie (kWh/m²·a)', primaerenergie_kwh_m2a: 'Primärenergie (kWh/m²·a)', wesentlicher_energietraeger: 'Energieträger',
    baujahr_gebaeude: 'Baujahr Gebäude', baujahr_waermeerzeuger: 'Baujahr Wärmeerzeuger', anzahl_wohnungen: 'Wohnungen', gebaeudenutzflaeche_m2: 'Gebäudenutzfläche (m²)',
    modernisierungsempfehlungen: 'Modernisierungsempfehlungen', urkunde_datum: 'Urkunde vom', dokumentteil: 'Teil', einheiten_anzahl: 'Einheiten', einheiten: 'Einheiten', mea_nenner: 'MEA-Nenner',
    kostenverteilung: 'Kostenverteilung', gebrauchsregeln: 'Gebrauchsregeln', nachtraege: 'Nachträge', baubeschreibung: 'Baubeschreibung', baujahr: 'Baujahr', mietbeginn: 'Mietbeginn',
    vertragsart: 'Vertragsart', befristet_bis: 'Befristet bis', kuendigungsverzicht_bis: 'Kündigungsverzicht bis', kaltmiete_eur: 'Kaltmiete', nebenkosten_vorauszahlung_eur: 'NK-Vorauszahlung',
    heizkosten_vorauszahlung_eur: 'Heizkosten-Vorauszahlung', kaution_eur: 'Kaution', stellplatz_miete_eur: 'Stellplatzmiete', wohnflaeche_m2: 'Wohnfläche (m²)', zimmer: 'Zimmer',
    lage_einheit: 'Lage', adresse: 'Anschrift', staffeln: 'Staffeln', letzte_erhoehung: 'Letzte Erhöhung', besonderheiten: 'Besonderheiten', stichtag: 'Stichtag',
    summe_kaltmiete_monat_eur: 'Summe Kaltmiete/Monat', summe_wfl_m2: 'Summe Wohnfläche (m²)', nutzung: 'Nutzung', lfd_nr: 'Nr.', berechtigter_art: 'Berechtigt', eingetragen_am: 'eingetragen',
    betrag_eur: 'Betrag', glaubiger: 'Gläubiger', flaeche_m2: 'Fläche (m²)', beschreibung: 'Beschreibung', jahr: 'Jahr', gewerk: 'Gewerk', kosten_geschaetzt_eur: 'Kosten (geschätzt)',
    nr: 'Nr.', lage: 'Lage', mea: 'MEA', wfl_m2: 'm²', status: 'Status', nk_vorauszahlung_eur: 'NK', ab: 'ab'
  };
  /* v3017a · Marcel 28.10.2026: „prüf … ob das richtig angezeigt wird, ob das auch richtig formatiert ist" -
     gemessen: Wirtschaftsplan und Baulasten zeigten Rohschlüssel („kosten jahr eur", „behoerde", „beguenstigt") */
  var NAMEN2 = {
    umfang: 'Umfang', einheit: 'Wohnung', kosten_jahr_eur: 'Kosten / Jahr', umlagefaehig_jahr_eur: 'umlagefähig / Jahr',
    nicht_umlagefaehig_jahr_eur: 'nicht umlagefähig / Jahr (ohne Rücklage)', ruecklage_zufuehrung_jahr_eur: 'Zuführung Rücklage / Jahr',
    verwaltung_jahr_eur: 'Verwaltung / Jahr', hausgeld_monat_eur: 'Hausgeld / Monat', ruecklage_stand_eur: 'Rücklage (Stand)',
    ruecklage_entnahmen: 'Entnahmen aus der Rücklage', sonderumlagen: 'Sonderumlagen', abrechnungsergebnis_eur: 'Abrechnungsergebnis',
    positionen: 'Positionen', bezeichnung: 'Position', betrag_gesamt_eur: 'Betrag Gemeinschaft', betrag_einheit_eur: 'Betrag Wohnung',
    umlagefaehig: 'umlagefähig', zweck: 'Zweck', faellig: 'fällig', betrag_eur: 'Betrag',
    auskunft_datum: 'Auskunft vom', behoerde: 'Behörde', keine_baulasten: 'keine Baulasten eingetragen', baulasten: 'Baulasten',
    blatt: 'Blatt', rolle: 'dieses Grundstück', inhalt: 'Inhalt', art: 'Art', jahr: 'Jahr'
  };
  var BLOCK = { gesamt: 'Gesamtplan der Gemeinschaft', einzel: 'Einzelplan der Wohnung' };
  var WORT = { beguenstigt: 'begünstigt', belastet: 'belastet', einzel: 'Einzelplan einer Wohnung', gesamt: 'Gesamtplan der Gemeinschaft', beides: 'Gesamt- und Einzelplan' };
  function name(k) { return NAMEN2[k] || NAMEN[k] || String(k).replace(/_/g, ' '); }
  function wert(k, x) {
    if (x === true) return 'ja'; if (x === false) return 'nein';
    /* v3016y · Jahreszahlen und Nummern nie durch toLocaleString („2.026“) */
    if (typeof x === 'number') {
      if (/_eur$/.test(k)) return eur(x);
      if (/jahr|(^|_)(nr|plz)(_|$)/.test(k)) return String(x);
      /* v3017d · Einheit aus dem Feldnamen */
      var f = x.toLocaleString('de-DE', { maximumFractionDigits: 2 });
      if (/_eur_m2$|_eur_qm$/.test(k)) return f + ' €/m²';
      if (/(_m2|_qm|flaeche)$/.test(k)) return f + ' m²';
      if (/_pct$|_prozent$/.test(k)) return f + ' %';
      if (/kwh/.test(k)) return f + ' kWh/(m²·a)';
      return f;
    }
    return WORT[x] || String(x);   /* v3017a */
  }
  function risikoHtml(x) {
    var s = String(x.schwere || 'mittel').toLowerCase();
    return '<div class="dpu-risiko ' + esc(s) + '"><b>' + esc(x.titel || 'Risiko') + '</b><span class="dpu-pill ' + esc(s) + '">' + esc(s) + '</span>'
      + (x.kosten_eur ? ' <span style="font-size:12px;color:#2A2727">· ' + esc(eur(x.kosten_eur)) + '</span>' : '') + (x.jahr ? ' <span style="font-size:12px;color:#7A7370">· ' + esc(x.jahr) + '</span>' : '')
      + '<p>' + esc(x.beschreibung || '') + '</p>' + ((x.quelle || x.fundstelle) ? '<div class="dpu-quelle">Quelle: ' + esc(x.quelle || x.fundstelle) + '</div>' : '') + '</div>';
  }
  /** Ein gelesenes Dokument lesbar (Reiter im Import-Fenster) */
  function dokHtml(ext) {
    stil();
    var dl = [], bloecke = [], risiken = [];
    Object.keys(ext || {}).forEach(function (k) {
      var x = ext[k];
      if (x == null || x === '' || (Array.isArray(x) && !x.length)) return;
      if (k === 'risiken' && Array.isArray(x)) { risiken = x.filter(function (r) { return r && typeof r === 'object'; }); if (risiken.length) return; }
      if (Array.isArray(x)) {
        if (x.every(function (y) { return typeof y !== 'object'; })) { bloecke.push('<div class="dpu-h">' + esc(name(k)) + '</div><ul class="dpu-ul">' + x.map(function (y) { return '<li>' + esc(y) + '</li>'; }).join('') + '</ul>'); return; }
        var cols = []; x.forEach(function (y) { Object.keys(y || {}).forEach(function (c) { if (cols.indexOf(c) < 0 && cols.length < 8) cols.push(c); }); });
        bloecke.push('<div class="dpu-h">' + esc(name(k)) + ' (' + x.length + ')</div><table class="dpu-tbl"><tr>' + cols.map(function (c) { return '<th>' + esc(name(c)) + '</th>'; }).join('') + '</tr>'
          + x.map(function (y) { return '<tr>' + cols.map(function (c) { var z = (y || {})[c]; return '<td>' + (z == null ? '' : esc(wert(c, z))) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>');
        return;
      }
      /* v3017a · benannte Unterobjekte (Gesamt-/Einzelplan) als eigener Block statt flach dazwischen */
      if (typeof x === 'object' && BLOCK[k]) {
        var z = Object.keys(x).filter(function (k2) { return x[k2] != null && x[k2] !== '' && typeof x[k2] !== 'object'; });
        if (z.length) bloecke.push('<div class="dpu-h">' + esc(BLOCK[k]) + '</div><dl class="dpu-dl">' + z.map(function (k2) { return '<dt>' + esc(name(k2)) + '</dt><dd>' + esc(wert(k2, x[k2])) + '</dd>'; }).join('') + '</dl>');
        return;
      }
      if (typeof x === 'object') { Object.keys(x).forEach(function (k2) { if (x[k2] != null && x[k2] !== '' && typeof x[k2] !== 'object') dl.push('<dt>' + esc(name(k2)) + '</dt><dd>' + esc(wert(k2, x[k2])) + '</dd>'); }); return; }
      dl.push('<dt>' + esc(name(k)) + '</dt><dd>' + esc(wert(k, x)) + '</dd>');
    });
    return (dl.length ? '<dl class="dpu-dl">' + dl.join('') + '</dl>' : '') + bloecke.join('')
      + (risiken.length ? '<div class="dpu-h">Risiken aus diesem Dokument</div>' + risiken.map(risikoHtml).join('') : '');
  }
  /** Gesamtauswertung (Import-Fenster und Pilot-Reiter) */
  function auswertungHtml(a) {
    stil();
    if (!a) return '';
    var h = '';
    if (a.investitionsthese) h += '<div class="dpu-h">Investitionsthese aus den Unterlagen</div><div class="dpu-these">' + esc(a.investitionsthese) + '</div>';
    var r = (a.risiken || []).slice().sort(function (x, y) { var o = { hoch: 0, mittel: 1, niedrig: 2 }; return (o[x.schwere] == null ? 1 : o[x.schwere]) - (o[y.schwere] == null ? 1 : o[y.schwere]); });
    if (r.length) h += '<div class="dpu-h">Risiken (' + r.length + ')</div>' + r.map(risikoHtml).join('');
    var w = a.weg;
    if (w) {
      /* v3016x · Marcel 28.10.2026: „den Tab ab WEG Eigentümergemeinschaft besser angeben, Übergang zu
         Erhaltungsrücklage nicht schön … klar trennen die Bereiche". Bis hier liefen Kernpunkte, Rücklage,
         Hausgeld und Verwaltung als lose Liste ineinander. Jetzt fünf Blöcke mit eigener Überschrift. */
      h += '<div class="dpu-weg">';
      h += '<div class="dpu-weg-kopf">WEG · Eigentümergemeinschaft</div>';
      if ((w.kernpunkte || []).length) h += '<div class="dpu-weg-blk"><div class="dpu-weg-t">1 · Verlauf aus den Protokollen</div><ol class="dpu-zeit">'
        + w.kernpunkte.map(function (y) { var m = String(y).match(/^\s*((?:19|20)\d\d(?:\s*[\/–-]\s*(?:19|20)?\d\d)?)\s*[:–-]\s*([\s\S]*)$/); return '<li>' + (m ? '<b>' + esc(m[1]) + '</b>' + esc(m[2]) : '<b>–</b>' + esc(y)) + '</li>'; }).join('') + '</ol></div>';
      var geld = [];
      if (w.ruecklage) geld.push(['Erhaltungsrücklage', w.ruecklage]);
      if (w.hausgeld) geld.push(['Hausgeld', w.hausgeld]);
      if ((w.sonderumlagen || []).length) geld.push(['Sonderumlagen', w.sonderumlagen.join(' · ')]);
      if (geld.length) h += '<div class="dpu-weg-blk"><div class="dpu-weg-t">2 · Geld der Gemeinschaft</div><div class="dpu-weg-geld">'
        + geld.map(function (x) { return '<div><span>' + esc(x[0]) + '</span><p>' + esc(x[1]) + '</p></div>'; }).join('') + '</div></div>';
      if ((w.sanierungen || []).length) h += '<div class="dpu-weg-blk"><div class="dpu-weg-t">3 · Maßnahmen am Gemeinschaftseigentum</div><table class="dpu-tbl"><tr><th>Maßnahmen</th><th>Status</th><th>Jahr</th><th class="r">Kosten gesamt</th><th class="r">Dein Anteil</th></tr>'
        + w.sanierungen.map(function (s) { var st = String(s.status || ''); return '<tr><td>' + esc(s.massnahme) + '</td><td><span class="dpu-st dpu-st-' + esc(st) + '">' + esc(st || '–') + '</span></td><td>' + esc(s.jahr || '') + '</td><td class="r">' + esc(eur(s.kosten_eur)) + '</td><td class="r">' + esc((function () { var a = anteil(s.kosten_eur); return a ? eur(a.eur) : eur(s.anteil_objekt_eur); })()) + '</td></tr>'; }).join('') + '</table>'
          + (anteil(1) ? '<p class="dpu-weg-p" style="font-size:11.5px;margin-top:4px">Dein Anteil: ' + esc(anteil(1).wie === 'ganzes Haus' ? 'ganzes Haus, 100 % der Kosten der Gemeinschaft' : 'Gesamtkosten × Miteigentumsanteil (' + anteil(1).wie + ')') + '.</p>' : '') + '</div>';
      if (w.verwaltung) h += '<div class="dpu-weg-blk"><div class="dpu-weg-t">4 · Verwaltung</div><p class="dpu-weg-p">' + esc(w.verwaltung) + '</p></div>';
      if (w.fazit) h += '<div class="dpu-weg-blk dpu-weg-fazit"><div class="dpu-weg-t">5 · Fazit</div><p class="dpu-weg-p">' + esc(w.fazit) + '</p></div>';
      h += '</div>';
    }
    var g = a.grundbuch;
    if (g && ((g.lasten || []).length || g.grundschulden)) {
      h += '<div class="dpu-h">Grundbuch</div>' + ((g.lasten || []).length ? '<ul class="dpu-ul">' + g.lasten.map(function (y) { return '<li>' + esc(y) + '</li>'; }).join('') + '</ul>' : '')
        + (g.grundschulden ? '<p style="font-size:12.5px;margin:4px 0">' + esc(g.grundschulden) + '</p>' : '');
    }
    /* v3017 · Baulasten (eigene Auskunft, nicht im Grundbuch) */
    var bl = a.baulasten;
    if (bl && (bl.keine || (bl.eintraege || []).length)) {
      h += '<div class="dpu-h">Baulasten</div>' + (bl.keine && !(bl.eintraege || []).length ? '<p style="font-size:12.5px;margin:4px 0">Laut Auskunft aus dem Baulastenverzeichnis sind keine Baulasten eingetragen.</p>'
        : '<ul class="dpu-ul">' + bl.eintraege.map(function (y) { return '<li>' + esc(y) + '</li>'; }).join('') + '</ul>');
    } else if (g && (g.lasten || []).length) {
      h += '<div class="dpu-h">Baulasten</div><p style="font-size:12.5px;margin:4px 0">Baulasten stehen nicht im Grundbuch, sondern im Baulastenverzeichnis der Bauaufsicht. Eine Auskunft liegt nicht vor – du kannst sie nachreichen.</p>';
    }
    if ((a.offene_fragen || []).length) h += '<div class="dpu-h">Beim Verwalter oder Verkäufer anfragen</div><ul class="dpu-ul">' + a.offene_fragen.map(function (y) { return '<li>' + esc(y) + '</li>'; }).join('') + '</ul>';
    return h;
  }
  /* v3016r · Marcel 28.10.2026: „können wir die Unterlagen & WEG einfacher darstellen? auch mit
     Karten? vlt wieder eine Version zum Umschalten einfach und genau." Einfach = Ampel, was
     absehbar Geld kostet, die drei wichtigsten Risiken, WEG und These als Karten; Genau = alles. */
  /* erster Satz - ohne an Abkürzungen („ca.", „z. B.", „Nr.", „Abt.") abzubrechen */
  var ABK = /(?:\b(?:ca|bzw|ggf|inkl|zzgl|gem|Nr|Abt|Abs|Bj|Mio|Tsd|Whg|St|Str|vgl|evtl|max|min|rd|u\.a|z\.\s?B|d\.\s?h)\.|\b[A-ZÄÖÜa-zäöü]\.)$/;
  function kurzSatz(t, n) {
    t = String(t || '').trim(); n = n || 170;
    var re = /[.!?](?=\s+[A-ZÄÖÜ„"]|$)/g, m, ende = -1;
    while ((m = re.exec(t))) { if (!ABK.test(t.slice(0, m.index + 1))) { ende = m.index + 1; break; } }
    var s = ende > 0 ? t.slice(0, ende) : t;
    return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s;
  }
  function einfachHtml(a) {
    var r = (a.risiken || []).slice();
    var n = { hoch: 0, mittel: 0, niedrig: 0 };
    r.forEach(function (x) { var s = String(x.schwere || 'mittel').toLowerCase(); if (n[s] != null) n[s]++; });
    var ord = { hoch: 0, mittel: 1, niedrig: 2 };
    r.sort(function (x, y) { return (ord[x.schwere] == null ? 1 : ord[x.schwere]) - (ord[y.schwere] == null ? 1 : ord[y.schwere]) || (Number(y.kosten_eur) || 0) - (Number(x.kosten_eur) || 0); });
    var jahr = new Date().getFullYear();
    /* Grundschulden/Hypotheken sind Belastungen des Verkäufers, die mit dem Kaufpreis abgelöst werden - keine Kosten */
    var kosten = r.filter(function (x) { return zahl(x.kosten_eur) > 0 && String(x.schwere) !== 'niedrig' && (!x.jahr || (x.jahr >= jahr - 1 && x.jahr <= jahr + 2)) && !/grundschuld|hypothek|abt\.?\s*iii/i.test((x.titel || '') + ' ' + (x.quelle || '')); });
    /* v3016y · eine Sonderumlage ist der Weg, eine Maßnahme zu bezahlen, keine eigene Ausgabe: steht im
       selben Jahr eine Maßnahme mit mindestens dieser Summe, ist sie darin enthalten (Lindenallee 14:
       Dach 92.000 € inkl. Sonderumlage 42.000 € ergab 160.300 € statt 118.300 €) */
    var SU = /sonderumlage/i;
    kosten = kosten.filter(function (x) {
      if (!SU.test(x.titel || '')) return true;
      return !kosten.some(function (y) { return y !== x && !SU.test(y.titel || '') && zahl(y.kosten_eur) >= zahl(x.kosten_eur) && (!x.jahr || !y.jahr || String(x.jahr) === String(y.jahr)); });
    });
    /* v3017 · Gemeinschaftskosten fest auf den Anteil gerechnet, wo die Auswertung sie gesamt führt */
    kosten.forEach(function (x) { var a = zahl(x.kosten_gesamt_eur) > 0 ? anteil(x.kosten_gesamt_eur) : null; x._betrag = a ? a.eur : zahl(x.kosten_eur); });
    var summe = kosten.reduce(function (s, x) { return s + (x._betrag || 0); }, 0);
    var h = '<div class="dpu-ampel"><div class="hoch"><b>' + n.hoch + '</b><span>hoch</span></div><div class="mittel"><b>' + n.mittel + '</b><span>mittel</span></div><div class="niedrig"><b>' + n.niedrig + '</b><span>niedrig</span></div></div>';
    h += '<div class="dpu-karten">';
    h += '<div class="dpu-karte' + (summe ? '' : ' niedrig') + '"><h4>Was absehbar Geld kostet</h4>'
      + (summe ? '<div class="dpu-gross">' + esc(eur(summe)) + '</div><p>' + kosten.slice(0, 3).map(function (x) { return esc(x.titel) + (x.jahr ? ' (' + esc(x.jahr) + ')' : ''); }).join(' · ') + '</p>'
               : '<p>In den Unterlagen steht keine beschlossene oder bezifferte Ausgabe für die nächsten Jahre.</p>') + '</div>';
    if (a.weg) {
      var w = a.weg, san = (w.sanierungen || []).filter(function (s) { return /beschlossen|geplant/.test(String(s.status || '')); });
      h += '<div class="dpu-karte neutral"><h4>Eigentümergemeinschaft</h4><p>' + esc(kurzSatz(w.fazit || (w.kernpunkte || [])[0] || '', 190)) + '</p>'
        + (w.ruecklage ? '<p style="margin-top:6px"><b>Rücklage:</b> ' + esc(kurzSatz(w.ruecklage, 120)) + '</p>' : '')
        + (san.length ? '<p style="margin-top:6px"><b>Beschlossen/geplant:</b> ' + san.slice(0, 3).map(function (s) { return esc(s.massnahme) + (s.kosten_eur ? ' ' + esc(eur(s.kosten_eur)) : ''); }).join(' · ') + '</p>' : '') + '</div>';
    }
    if (a.investitionsthese) h += '<div class="dpu-karte neutral" style="border-top-color:' + GOLD + '"><h4>Investitionsthese</h4><p>' + esc(kurzSatz(a.investitionsthese, 230)) + '</p></div>';
    h += '</div>';
    if (r.length) {
      h += '<div class="dpu-h">Die wichtigsten Risiken</div><div class="dpu-karten">' + r.slice(0, 3).map(function (x) {
        var s = String(x.schwere || 'mittel').toLowerCase();
        return '<div class="dpu-karte ' + esc(s) + '"><h4>' + esc(x.titel) + '</h4>'
          + (x.kosten_eur ? '<div class="dpu-gross" style="font-size:18px">' + esc(eur(x.kosten_eur)) + '</div>' : '')
          + '<p>' + esc(kurzSatz(x.beschreibung, 150)) + '</p>' + ((x.quelle || x.fundstelle) ? '<div class="dpu-quelle">Quelle: ' + esc(x.quelle || x.fundstelle) + '</div>' : '') + '</div>';
      }).join('') + '</div>'
        + (r.length > 3 ? '<p class="dpu-hinweis">' + (r.length - 3) + ' weitere Risiken und alle Einzelheiten unter <b>Genau</b>.</p>' : '');
    }
    if ((a.offene_fragen || []).length) h += '<p class="dpu-hinweis"><b>' + a.offene_fragen.length + ' Fragen</b> an Verwalter oder Verkäufer stehen unter <b>Genau</b>.</p>';
    return h;
  }
  function ansichtLesen() { try { return localStorage.getItem('dp_unterlagen_ansicht') || 'einfach'; } catch (e) { return 'einfach'; } }
  function ansicht(btn, art) {
    try { localStorage.setItem('dp_unterlagen_ansicht', art); } catch (e) {}
    var w = btn && btn.closest ? btn.closest('.dpu-wrap') : null; if (!w) return;
    w.querySelectorAll('[data-dpu-ansicht]').forEach(function (x) { x.style.display = x.getAttribute('data-dpu-ansicht') === art ? '' : 'none'; });
    w.querySelectorAll('.dpu-umschalter button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-art') === art); });
  }
  /** Reiter „Unterlagen & WEG" der Pilot-Analyse */
  function hatAuswertung() { var d = laden(); return !!(d && d.auswertung); }
  function pilotReiterHtml() {
    var d = laden();
    if (!d || !d.auswertung) return '';
    var datum = '';
    try { datum = new Date(d.stand).toLocaleDateString('de-DE'); } catch (e) {}
    stil();
    var art = ansichtLesen();
    return '<div class="dp-pa-card dpu-wrap">'
      + '<div class="dpu-umschalter"><button type="button" data-art="einfach" class="' + (art === 'einfach' ? 'on' : '') + '" onclick="DpUnterlagen.ansicht(this,\'einfach\')">Einfach</button>'
      + '<button type="button" data-art="genau" class="' + (art === 'genau' ? 'on' : '') + '" onclick="DpUnterlagen.ansicht(this,\'genau\')">Genau</button></div>'
      + '<div class="dpu-hinweis">Ausgewertet am ' + esc(datum) + ' aus ' + (d.dokumente || []).length + ' Unterlagen: '
      + (d.dokumente || []).map(function (x) { return esc(x.label) + (x.datum ? ' ' + esc(x.datum) : ''); }).join(' · ') + '. '
      + '</div>'
      /* v3017 · Marcel 28.10.2026: Unterlagen nachreichen - fließen in Risiken, These, Hausgeld und Steuer */
      + '<div class="dpu-nach"><button type="button" class="dpu-nach-btn" onclick="DpUnterlagen.nachreichen()">+ Unterlagen nachreichen</button>'
      + '<span>z. B. Wirtschaftsplan, Hausgeldabrechnung, Baulastenauskunft, neues Protokoll – die Auswertung wird ergänzt, nicht ersetzt. Vor der Übernahme siehst du jede Änderung an Risiken, These, Hausgeld und Steuer.</span></div>'
      + ((d.auswertung.aenderungen || []).length ? '<div class="dpu-aend"><b>Zuletzt nachgereicht – das hat sich geändert:</b><ul>' + d.auswertung.aenderungen.map(function (y) { return '<li>' + esc(y) + '</li>'; }).join('') + '</ul></div>' : '')
      + '<div data-dpu-ansicht="einfach"' + (art === 'einfach' ? '' : ' style="display:none"') + '>' + einfachHtml(d.auswertung) + '</div>'
      + '<div data-dpu-ansicht="genau"' + (art === 'genau' ? '' : ' style="display:none"') + '>' + auswertungHtml(d.auswertung) + '</div>'
      + '<div class="dpu-hinweis" style="margin-top:10px">Gelesen und zusammengefasst aus den Unterlagen — keine Rechtsberatung. Prüfe Beschlüsse und Lasten im Original.</div>'
      + '</div>';
  }

  window.DpUnterlagen = {
    seitenLesen: seitenLesen, istPersoenlich: istPersoenlich, meaProzent: meaProzent, einheitenAus: einheitenAus,
    auswerten: auswerten, laden: laden, merken: merken, promptTeile: promptTeile,
    dokHtml: dokHtml, auswertungHtml: auswertungHtml, pilotReiterHtml: pilotReiterHtml, hatAuswertung: hatAuswertung, stil: stil,
    einfachHtml: einfachHtml, ansicht: ansicht,   /* v3016r */
    anteil: anteil, nachreichen: nachreichen   /* v3017 */
  };
})();
