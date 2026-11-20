/* ═══════════════════════════════════════════════════════════════════════
   einzelcheck.js · v3940 (20.11.2026) · Einzel-Check der Landing, echter Ablauf
   Vorher einzelcheck-demo.js (landing-faecher-1, nur Beispieldaten).

   Marcel 20.11.2026 (Preis entschieden: 3,99 €, Betrag kommt aus Stripe):
     1 Unterlagen wählen (bis zu vier PDFs: Exposé, Mietaufstellung, WEG-Protokoll, Energieausweis …)
     2 Kostenlos: die ERSTEN ZWEI liest der Server mit einem günstigen Modell, dazu eine grobe
       Einschätzung mit den Kernen der Startseite (DealKpis, DealScore, ScoreTier) und den Eingaben
       aus dem Deal-Check (DpDealCheck.letztes()).
     3 Kauf per Stripe Checkout (Einmalzahlung) in einem NEUEN Fenster. Dieses Fenster behält die
       Unterlagen im Arbeitsspeicher und fragt den Kaufstatus ab. Sobald bezahlt ist, liest der Server
       ALLE Unterlagen mit dem normalen Modell und holt Lage, Markt, Vergleichsmiete und Wert.
     4 Der Bericht entsteht HIER im Browser (frontend/js/dp-dokument.js vom App-Host, dasselbe
       Gestaltungssystem wie Investment-PDF und Marktbericht) und wird über „Drucken / als PDF speichern“
       geholt. Auf dem Server liegt kein Bericht.
     5 Paketwahl: die Karten aus #pricing (dieselbe Quelle wie die Preise der Landing), mit
       Anrechnungs-Code (?code=, derselbe Weg wie der Flyer-Code) und den Zahlen als Fragment
       (#dc=1&…, js/dealcheck-uebernahme.js legt das Objekt im Konto an).

   GESPEICHERT im Browser: nur das Kauf-Token in sessionStorage (dieser Tab). Keine Datei, kein Text.
   Schnittstellen: backend/src/routes/publicEinzelcheck.js, services/einzelcheck.js.
   Vertrag mit dp2-dealcheck.js: window.DpEinzelCheck.auf() und .preis (Euro, > 0 erst, wenn Stripe
   den Preis geliefert hat), Ereignis 'dp:einzelcheck-bereit'.
   Geladen nur von landing-faecher.js einzelcheckLaden() (Staging und lokal).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpEinzelCheck) return;
  var VERSION = 'v3940';
  var SPEICHER = 'dp_ec_kauf';
  var KANAL = 'dp-einzelcheck';
  var INFO = { frei_max: 2, voll_max: 4, max_mb: 10, frist_tage: 14, amount_cents: 0 };

  var ruhig = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function istZahl(v) { return v !== null && v !== undefined && v !== '' && isFinite(Number(v)); }
  function dez(n, st) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: st, maximumFractionDigits: st }); }
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function eurS(n) { return (n >= 0 ? '+' : '−') + eur(Math.abs(n)); }
  function preisText() { return INFO.amount_cents > 0 ? dez(INFO.amount_cents / 100, 2) + ' €' : ''; }
  function datum(d) { d = d ? new Date(d) : new Date(); return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear(); }
  function warte(ms) { return new Promise(function (ok) { setTimeout(ok, ruhig ? Math.min(ms, 50) : ms); }); }

  /* ── Adressen: Landing auf dealpilot.immo, App und API auf app.… (wie landing-zahlen.js) ── */
  function lokal() { var h = String(location.hostname || ''); return !h || h.indexOf('localhost') >= 0 || h.indexOf('127.0.0.1') === 0; }
  function apiBasis() {
    if (lokal()) return '/api/v1';
    var h = String(location.hostname).replace(/^www\./i, '');
    return location.protocol + '//' + (h.indexOf('app.') === 0 ? h : 'app.' + h) + '/api/v1';
  }
  function appBasis() { return /(^|\.)staging\.dealpilot\.immo$/.test(location.hostname) ? 'https://app.staging.dealpilot.immo/' : 'https://app.dealpilot.immo/'; }
  function api(p) { return apiBasis() + '/public/einzelcheck' + p; }
  function holeJson(url, init) {
    return fetch(url, init || {}).then(function (r) {
      return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = {}; } j._status = r.status; j._ok = r.ok; return j; });
    });
  }

  /* ── Kerne nachladen (Buster wie frontend/index.html, tools/buster-ebenen-pruefen.mjs) ── */
  var KERNE = { DpDokument: 'js/dp-dokument.js?v=v3223', DpMietpotenzial: 'js/mietpotenzial-kern.js?v=v3840b', DealScore2: 'js/dealscore2.js?v=v3254' };
  var _geladen = {};
  function lade(name) {
    if (window[name]) return Promise.resolve(true);
    if (_geladen[name]) return _geladen[name];
    _geladen[name] = new Promise(function (ok) {
      var s = document.createElement('script'); s.src = appBasis() + KERNE[name]; s.async = true;
      s.onload = function () { ok(!!window[name]); }; s.onerror = function () { ok(false); };
      document.body.appendChild(s);
    });
    return _geladen[name];
  }
  var _kapp = null;
  function kappungsDaten() {
    if (_kapp) return _kapp;
    _kapp = fetch(appBasis() + 'js/data/kappungsgrenzen.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    return _kapp;
  }

  /* ── Zustand: Dateien NUR im Arbeitsspeicher dieses Tabs ─────────────── */
  var S = { dateien: [], frei: null, token: null, status: null, bericht: null, abfrage: null };
  function tokenMerken(t) { S.token = t; try { sessionStorage.setItem(SPEICHER, t); } catch (e) {} }
  function tokenLesen() { if (S.token) return S.token; try { S.token = sessionStorage.getItem(SPEICHER) || null; } catch (e) {} return S.token; }
  var kanal = null; try { kanal = 'BroadcastChannel' in window ? new BroadcastChannel(KANAL) : null; } catch (e) { kanal = null; }

  function artRaten(name) {
    var n = String(name || '').toLowerCase();
    if (/expos|inserat|angebot/.test(n)) return 'Exposé';
    if (/miet(er)?liste|mietaufstell|mieter/.test(n)) return 'Mietaufstellung';
    if (/weg|protokoll|versammlung|eigent/.test(n)) return 'WEG-Protokoll';
    if (/energie/.test(n)) return 'Energieausweis';
    if (/wirtschaftsplan|hausgeld|abrechnung/.test(n)) return 'Wirtschaftsplan';
    return 'Unterlage';
  }
  function mb(b) { return dez(b / 1048576, 1) + ' MB'; }

  /* ── Fenster ──────────────────────────────────────────────────────── */
  var fenster, inhalt, zuvor = null, schritt = 0;
  function baueFenster() {
    if (fenster) return;
    fenster = document.createElement('div');
    fenster.className = 'ec-fenster';
    fenster.hidden = true;
    fenster.innerHTML = '<div class="ec-dunkel" data-zu></div><div class="ec-box" role="dialog" aria-modal="true" aria-labelledby="ecTitel">'
      + '<div class="ec-leiste"><span class="ec-marke">Einzel-Check</span><span class="ec-demo">Staging · Abnahme läuft</span><button type="button" class="ec-x" data-zu aria-label="Schließen">×</button></div>'
      + '<ol class="ec-schritte" aria-hidden="true"><li>Unterlagen</li><li>Auslesen</li><li>Ergebnis</li><li>Bericht</li></ol>'
      + '<div class="ec-inhalt" aria-live="polite"></div></div>';
    document.body.appendChild(fenster);
    inhalt = $('.ec-inhalt', fenster);
    fenster.addEventListener('click', function (e) { if (e.target.closest('[data-zu]')) zu(); });
    document.addEventListener('keydown', function (e) {
      if (fenster.hidden) return;
      if (e.key === 'Escape') { zu(); return; }
      if (e.key === 'Tab') {
        var f = $$('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]', $('.ec-box', fenster)).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }
  function oeffnen() { baueFenster(); zuvor = document.activeElement; fenster.hidden = false; document.documentElement.classList.add('ec-offen'); }
  function auf() {
    oeffnen();
    if (S.bericht) zeigeBericht(S.bericht);
    else if (S.frei) zeigeErgebnis();
    else zeigeUnterlagen();
  }
  function zu() {
    if (!fenster) return;
    fenster.hidden = true; document.documentElement.classList.remove('ec-offen');
    if (zuvor && zuvor.focus) try { zuvor.focus({ preventScroll: true }); } catch (e) {}
  }
  function stufe(i) { $$('.ec-schritte li', fenster).forEach(function (li, j) { li.classList.toggle('an', j === i); li.classList.toggle('ok', j < i); }); }
  function setze(html, fokus) {
    inhalt.innerHTML = html; $('.ec-box', fenster).scrollTop = 0;
    var f = fokus ? $(fokus, inhalt) : $('h3', inhalt);
    if (f) { if (!f.hasAttribute('tabindex') && f.tagName === 'H3') f.setAttribute('tabindex', '-1'); try { f.focus({ preventScroll: true }); } catch (e) {} }
  }
  function meldung(text, art) { return '<p class="ec-meldung' + (art ? ' ' + art : '') + '" role="alert">' + esc(text) + '</p>'; }

  var SCHUTZ = '<div class="ec-schutz"><b>Datenschutz.</b> Deine Unterlagen werden nur im Arbeitsspeicher gelesen und nicht gespeichert. '
    + 'Bevor eine KI den Text liest, schwärzt DealPilot Namen, Geburtsdaten, Anschriften von Personen, E-Mail, Telefon und Kontodaten. '
    + 'Die Schwärzung folgt Mustern und erkennt nicht jede Schreibweise. Zum Auslesen geht nur der geschwärzte Text an einen KI-Dienst, der ihn nicht zum Training verwendet. Kaufst du den Bericht, speichert DealPilot nur die ausgelesenen Zahlen, ohne Namen, für höchstens 14 Tage. '
    + 'Gescannte PDFs ohne Text kann der Einzel-Check noch nicht lesen.</div>';

  /* 1 · Unterlagen wählen ─────────────────────────────────────────── */
  function zeigeUnterlagen(hinweis) {
    stufe(0); ++schritt;
    var liste = S.dateien.map(function (f, i) {
      return '<li class="ec-dok' + (i < INFO.frei_max ? ' frei' : '') + '"><span class="ec-dok-i" aria-hidden="true"></span><span class="ec-dok-t"><b>' + esc(artRaten(f.name)) + '</b><small>' + esc(f.name) + ' · ' + mb(f.size) + '</small></span>'
        + '<span class="ec-dok-m">' + (i < INFO.frei_max ? 'kostenlos' : 'im Bericht') + '</span>'
        + (i > 0 ? '<button type="button" class="ec-hoch" data-i="' + i + '" aria-label="' + esc(f.name) + ' nach oben">↑</button>' : '')
        + '<button type="button" class="ec-entf" data-i="' + i + '" aria-label="' + esc(f.name) + ' entfernen">×</button></li>';
    }).join('');
    setze('<h3 id="ecTitel">Bis zu vier Unterlagen, und DealPilot rechnet genauer.</h3>'
      + '<p class="ec-lead">Zum Beispiel Exposé, Mietaufstellung, WEG-Protokoll und Energieausweis. Die ersten zwei liest DealPilot kostenlos. Alle vier liest erst der Bericht.</p>'
      + (hinweis ? meldung(hinweis, 'warn') : '')
      + '<label class="ec-ablage-zone"><input type="file" class="ec-datei" accept="application/pdf,.pdf" multiple' + (S.dateien.length >= INFO.voll_max ? ' disabled' : '') + '>'
      + '<span><b>PDF auswählen</b> oder hierher ziehen<br><small>Höchstens ' + INFO.voll_max + ' Dateien, je bis ' + INFO.max_mb + ' MB</small></span></label>'
      + (liste ? '<ol class="ec-ablage">' + liste + '</ol>' : '')
      + SCHUTZ
      + '<div class="ec-knoepfe"><button type="button" class="btn-p ec-los"' + (S.dateien.length ? '' : ' disabled') + '>Kostenlos auslesen</button></div>', S.dateien.length ? '.ec-los' : 'h3');
    var inp = $('.ec-datei', inhalt), zone = $('.ec-ablage-zone', inhalt);
    inp.addEventListener('change', function () { dazu(inp.files); });
    ['dragover', 'dragenter'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('ueber'); }); });
    ['dragleave', 'drop'].forEach(function (t) { zone.addEventListener(t, function () { zone.classList.remove('ueber'); }); });
    zone.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer) dazu(e.dataTransfer.files); });
    $('.ec-entf', inhalt).forEach(function (b) { b.addEventListener('click', function () { S.dateien.splice(+b.dataset.i, 1); S.frei = null; zeigeUnterlagen(); }); });
    $$('.ec-hoch', inhalt).forEach(function (b) { b.addEventListener('click', function () { var i = +b.dataset.i, x = S.dateien[i]; S.dateien[i] = S.dateien[i - 1]; S.dateien[i - 1] = x; S.frei = null; zeigeUnterlagen(); }); });
    $('.ec-los', inhalt).addEventListener('click', zeigeAuslesen);
  }
  function dazu(files) {
    var fehler = [];
    [].slice.call(files || []).forEach(function (f) {
      if (S.dateien.length >= INFO.voll_max) { fehler.push('Höchstens ' + INFO.voll_max + ' Unterlagen.'); return; }
      if (!(f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) { fehler.push(f.name + ' ist kein PDF.'); return; }
      if (f.size > INFO.max_mb * 1048576) { fehler.push(f.name + ' ist größer als ' + INFO.max_mb + ' MB.'); return; }
      if (S.dateien.some(function (x) { return x.name === f.name && x.size === f.size; })) return;
      S.dateien.push(f);
    });
    S.frei = null;
    zeigeUnterlagen(fehler.length ? fehler.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' ') : null);
  }
  function formular(dateien, token) {
    var fd = new FormData();
    if (token) fd.append('token', token);
    dateien.forEach(function (f) { fd.append('unterlagen', f, f.name); });
    return fd;
  }

  /* 2 · Kostenlos auslesen (nur die ersten zwei werden gesendet) ─────── */
  function zeigeAuslesen() {
    stufe(1); var nr = ++schritt;
    var teil = S.dateien.slice(0, INFO.frei_max);
    setze('<h3 id="ecTitel">DealPilot liest deine Unterlagen.</h3><p class="ec-lead">Die ersten zwei werden geschwärzt und ausgelesen. Das dauert etwa eine halbe Minute.</p>'
      + '<div class="ec-lesen">' + teil.map(function (f) { return '<div class="ec-zeile an liest"><div class="ec-z-kopf"><b>' + esc(artRaten(f.name)) + '</b><span class="ec-z-st">liest aus</span></div><span class="ec-balken"><i style="width:100%"></i></span><small>' + esc(f.name) + '</small></div>'; }).join('') + '</div>', 'h3');
    holeJson(api('/auslesen'), { method: 'POST', body: formular(teil) }).then(function (j) {
      if (nr !== schritt) return;
      if (!j._ok) { zeigeUnterlagen(j.error || 'Das Auslesen hat nicht geklappt.'); return; }
      S.frei = j;
      zeigeErgebnis();
    }).catch(function () { if (nr === schritt) zeigeUnterlagen('Keine Verbindung. Bitte noch einmal versuchen.'); });
  }

  /* ── Rechnen: nur die Kerne der Startseite ─────────────────────────── */
  function eingaben(z) {
    var dc = window.DpDealCheck && DpDealCheck.letztes ? DpDealCheck.letztes() : null;
    var herkunft = {};
    var kp = z.kp > 0 ? z.kp : (dc && dc.kp > 0 ? dc.kp : null); herkunft.kp = z.kp > 0 ? 'unterlagen' : (kp ? 'dealcheck' : null);
    var nkm = z.nkm > 0 ? z.nkm : (dc && dc.nkm > 0 ? dc.nkm : null); herkunft.nkm = z.nkm > 0 ? 'unterlagen' : (nkm ? 'dealcheck' : null);
    var zins = dc && dc.zins > 0 ? dc.zins : null, bindung = dc ? dc.bindung : null;
    if (!(zins > 0) && typeof window.dpGetIndicativeZins === 'function') { try { zins = window.dpGetIndicativeZins(10, 'voll'); bindung = 10; } catch (e) { zins = null; } }
    var tilg = dc && dc.tilg != null ? dc.tilg : 1.5;
    var ze = z.ze > 0 ? z.ze : (dc && dc.ze > 0 ? dc.ze : 0);
    var nkPct = z.nk_pct > 0 ? z.nk_pct : (dc && dc.nkPct > 0 ? dc.nkPct : 10);
    return { kp: kp, nkm: nkm, ze: ze, zins: zins, tilg: tilg, bindung: bindung, nkPct: nkPct, herkunft: herkunft, dc: !!dc };
  }
  function rechne(z) {
    if (!window.DealKpis || !window.DealScore || !window.ScoreTier) return null;
    var e = eingaben(z || {});
    if (!(e.kp > 0) || !(e.nkm > 0) || !(e.zins > 0)) return { fehlt: !(e.kp > 0) ? 'kp' : (!(e.nkm > 0) ? 'nkm' : 'zins'), e: e };
    var nk = e.kp * e.nkPct / 100, ek = Math.round(e.kp * 0.10), d1 = Math.max(0, e.kp + nk - ek);
    var mitBwk = z && z.bwk_nul_jahr != null;
    var bwkNul = mitBwk ? z.bwk_nul_jahr : e.nkm * 12 * 0.17;   /* ohne Wirtschaftsplan: dieselbe Annahme wie der Deal-Check */
    var k = DealKpis.compute({ kp: e.kp, nk: nk, nkm: e.nkm, ze: e.ze, uf: 0, bwk_ul: 0, bwk_nul: bwkNul, d1: d1, d1z: e.zins, d1t: e.tilg, ek: ek });
    var ds = DealScore.computeFromKpis({ kp: e.kp, cf_m: k.cf_m, nmy: k.nmy, ltv: k.ltv, dscr: k.dscr, wp_kpi: e.kp * 0.05, mstg: 1.5,
      darlehen: (k.d_total != null && isFinite(k.d_total)) ? k.d_total : null });
    return { e: e, k: k, ds: ds, st: ScoreTier.stufe(ds.score), nk: nk, ek: ek, d1: d1, bwkNul: bwkNul, mitBwk: mitBwk };
  }
  function kundenSatz(t) { return String(t || '').replace(/\s*[—–]\s*/g, ', ').replace(/;/g, ','); }
  function annahmeText(r) {
    return 'Finanzierung wie im Deal-Check: ' + eur(r.ek) + ' Eigenkapital (10 %), Nebenkosten ' + dez(r.e.nkPct, 1) + ' %, '
      + dez(r.e.zins, 2) + ' % Zins' + (r.e.bindung ? ' bei ' + r.e.bindung + ' Jahren Zinsbindung' : '') + ', ' + dez(r.e.tilg, 2) + ' % Tilgung. '
      + (r.mitBwk ? 'Nicht umlagefähige Kosten aus dem Wirtschaftsplan.' : 'Ohne Wirtschaftsplan rechnet DealPilot mit 17 % der Kaltmiete als nicht umlagefähige Kosten.')
      + (r.e.herkunft.kp === 'dealcheck' ? ' Kaufpreis aus deinem Deal-Check.' : '') + (r.e.herkunft.nkm === 'dealcheck' ? ' Kaltmiete aus deinem Deal-Check.' : '');
  }
  var FELD = [['kp', 'Kaufpreis', 'eur'], ['wfl', 'Wohnfläche', 'qm'], ['nkm', 'Kaltmiete im Monat', 'eur'], ['ze', 'Zusatzeinnahmen im Monat', 'eur'], ['bj', 'Baujahr', 'jahr'],
    ['einheiten', 'Einheiten', 'zahl'], ['leer_einheiten', 'davon ohne Miete', 'zahl'], ['hausgeld_monat', 'Hausgeld im Monat', 'eur'], ['bwk_nul_jahr', 'Nicht umlagefähig im Jahr', 'eur'],
    ['ruecklage_stand', 'Erhaltungsrücklage', 'eur'], ['sonderumlagen_anzahl', 'Beschlossene Sonderumlagen', 'zahl'], ['ek_klasse', 'Effizienzklasse', 'text'], ['endenergie', 'Endenergie kWh/(m²·a)', 'zahl'],
    ['plz', 'Postleitzahl', 'text'], ['ort', 'Ort', 'text']];
  function feldWert(z, f) {
    var v = z[f[0]]; if (v == null) return null;
    if (f[2] === 'eur') return eur(v); if (f[2] === 'qm') return dez(v, v % 1 ? 1 : 0) + ' m²'; if (f[2] === 'jahr') return String(Math.round(v));
    if (f[2] === 'zahl') return dez(v, v % 1 ? 1 : 0); return String(v);
  }
  var GRUND = { kein_text: 'ohne Textebene, vermutlich gescannt', kein_pdf: 'kein PDF', zu_gross: 'größer als 10 MB', mieter_unterlagen: 'persönliche Unterlagen eines Mieters, nicht ausgelesen',
    ki_fehler: 'nicht lesbar, bitte noch einmal versuchen', ki_unlesbar: 'nicht auswertbar', nicht_lesbar: 'nicht lesbar', im_bericht: 'liest der Bericht' };

  /* 3 · Ergebnis: grobe Einschätzung, Kauf, Pakete ─────────────────── */
  function zeigeErgebnis(hinweis) {
    stufe(2); ++schritt;
    var j = S.frei || { zahlen: {}, unterlagen: [] }, z = j.zahlen || {};
    var r = rechne(z);
    var kern;
    if (r && r.k) {
      kern = '<div class="ec-urteil" data-farbe="' + esc(r.st.farbe) + '"><div class="ec-ring"><b>' + r.ds.score + '</b><small>/ 100</small></div>'
        + '<div><span class="ec-l">Grobe Einschätzung · Deal Score</span><div class="ec-wort">' + esc(r.st.wort) + '</div><p>' + esc(kundenSatz(r.ds.interpretation)) + '</p></div></div>'
        + '<div class="ec-kz">'
        + '<div><span>Cashflow im Monat</span><b class="' + (r.k.cf_m < 0 ? 'neg' : 'pos') + '">' + eurS(r.k.cf_m) + '</b></div>'
        + '<div><span>Bruttorendite</span><b>' + dez(r.k.bmy, 2) + ' %</b></div>'
        + '<div><span>Nettorendite</span><b>' + dez(r.k.nmy, 2) + ' %</b></div>'
        + '<div><span>DSCR</span><b>' + (r.k.d_total > 0 ? dez(r.k.dscr, 2) : 'entfällt') + '</b></div></div>'
        + '<p class="ec-annahme">' + esc(annahmeText(r)) + '</p>';
    } else {
      var fehlt = r && r.fehlt === 'kp' ? 'den Kaufpreis' : (r && r.fehlt === 'nkm' ? 'die Kaltmiete' : 'den Zins');
      kern = '<p class="ec-lead">' + (r ? 'In den gelesenen Unterlagen fehlt ' + fehlt + '. Trag ' + fehlt + ' im Deal-Check ein, dann rechnet die Einschätzung mit.' : 'Die Rechenkerne sind gerade nicht geladen. Lade die Seite neu.') + '</p>';
    }
    var gelesen = FELD.map(function (f) { var w = feldWert(z, f); return w ? '<li><span>' + esc(f[1]) + '</span><b>' + esc(w) + '</b></li>' : ''; }).join('');
    var dok = (j.unterlagen || []).map(function (u) {
      return '<li><b>' + esc(u.art) + '</b> ' + (u.gelesen ? 'gelesen' + (u.geschwaerzt ? ', ' + u.geschwaerzt + ' Stellen geschwärzt' : '') : esc(GRUND[u.grund] || 'nicht gelesen')) + '</li>';
    }).concat(S.dateien.slice(INFO.frei_max).map(function (f) { return '<li><b>' + esc(artRaten(f.name)) + '</b> liest der Bericht</li>'; })).join('');
    var risiken = 0; (j.unterlagen || []).forEach(function (u) { risiken += (u.risiken || []).length; });
    setze('<h3 id="ecTitel">Deine Daten stehen bereit.</h3>' + (hinweis ? meldung(hinweis, 'warn') : '') + kern
      + '<div class="ec-zwei"><div><span class="ec-l">Ausgelesen</span><ul class="ec-felder an">' + (gelesen || '<li><span>Keine Kennzahl gefunden</span><b></b></li>') + '</ul></div>'
      + '<div><span class="ec-l">Unterlagen</span><ul class="ec-dokliste">' + dok + '</ul>' + (risiken ? '<p class="ec-fein">' + risiken + (risiken === 1 ? ' Hinweis' : ' Hinweise') + ' auf Risiken stehen im Bericht.</p>' : '') + '</div></div>'
      + kaufBox()
      + '<div class="ec-pakete"><span class="ec-l">Oder gleich weitermachen</span><p class="ec-fein">Mit einem Paket legst du das Objekt mit diesen Zahlen in DealPilot an.</p><div class="ec-pk"></div></div>', 'h3');
    paketeEinsetzen($('.ec-pk', inhalt), z, r, null);
    kaufVerdrahten();
  }
  function kaufBox() {
    if (!(INFO.amount_cents > 0)) return '<div class="ec-weg ec-weg-1"><b>Bericht</b><p>Der Bericht ist gerade nicht kaufbar. Bitte später noch einmal.</p></div>';
    return '<div class="ec-weg ec-weg-1"><span class="ec-l">Der komplette Bericht</span><b>Alle ' + Math.max(S.dateien.length, 1) + ' Unterlagen, Bewertung und Marktbericht als PDF</b>'
      + '<p>Investor Deal Score mit Investment- und Finanzierungs-Score, Cashflow, Rendite und DSCR, Mietpotenzial, Lage, Markt, Vergleichsmiete und eine Wertindikation, wo amtliche Daten vorliegen.</p>'
      + '<div class="ec-preis">' + esc(preisText()) + '<small>einmalig, kein Abo</small></div>'
      + '<p class="ec-fein">Buchst du innerhalb von ' + INFO.frist_tage + ' Tagen ein Paket, rechnet DealPilot den Betrag an.</p>'
      + '<label class="ec-haken"><input type="checkbox" class="ec-widerruf"> <span>Ich verlange ausdrücklich, dass DealPilot den Bericht sofort erstellt. Mir ist bekannt, dass mein Widerrufsrecht damit erlischt (§ 356 Abs. 5 BGB).</span></label>'
      + '<button type="button" class="btn-p ec-kaufen" disabled>Bericht kaufen · ' + esc(preisText()) + '</button>'
      + '<p class="ec-fein">Bezahlt wird bei Stripe in einem neuen Fenster. Dieses Fenster bleibt offen, hier entsteht dein Bericht.</p></div>';
  }
  function kaufVerdrahten() {
    var h = $('.ec-widerruf', inhalt), b = $('.ec-kaufen', inhalt);
    if (!h || !b) return;
    h.addEventListener('change', function () { b.disabled = !h.checked; });
    b.addEventListener('click', kaufen);
  }

  /* Kauf: das Fenster für Stripe wird IM Klick geöffnet (sonst blockt der Browser es) */
  function kaufen() {
    var b = $('.ec-kaufen', inhalt); if (b) { b.disabled = true; b.textContent = 'Kasse wird vorbereitet …'; }
    var w = null; try { w = window.open('', '_blank'); } catch (e) { w = null; }
    if (w) { try { w.document.title = 'DealPilot Kasse'; w.document.body.innerHTML = '<p style="font:16px Inter,system-ui,sans-serif;padding:24px">Die Kasse wird geladen …</p>'; } catch (e) {} }
    var j = S.frei || {};
    holeJson(api('/kaufen'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zahlen: j.zahlen || {}, siegel: j.siegel || '', widerruf_verzicht: true }) })
      .then(function (r) {
        if (!r._ok || !r.url || !r.token) { if (w) try { w.close(); } catch (e) {} zeigeErgebnis(r.error || 'Die Kasse ist gerade nicht erreichbar.'); return; }
        tokenMerken(r.token);
        if (w) { try { w.location.href = r.url; } catch (e) { location.href = r.url; return; } zeigeWarten(); }
        else location.href = r.url;   /* Fenster blockiert: in diesem Tab bezahlen, danach Unterlagen neu wählen */
      })
      .catch(function () { if (w) try { w.close(); } catch (e) {} zeigeErgebnis('Keine Verbindung zur Kasse.'); });
  }

  /* 3b · Warten auf die Zahlung ─────────────────────────────────────── */
  function zeigeWarten(text) {
    stufe(3); var nr = ++schritt;
    setze('<h3 id="ecTitel">Bezahlen im neuen Fenster.</h3><p class="ec-lead">' + esc(text || 'Sobald die Zahlung bei Stripe durch ist, liest DealPilot hier alle Unterlagen und baut deinen Bericht.') + '</p>'
      + '<div class="ec-lesen"><div class="ec-zeile an liest"><div class="ec-z-kopf"><b>Zahlung</b><span class="ec-z-st">wartet</span></div><span class="ec-balken"><i style="width:100%"></i></span></div></div>'
      + '<div class="ec-knoepfe"><button type="button" class="btn-l ec-pruef">Zahlung prüfen</button></div>', 'h3');
    $('.ec-pruef', inhalt).addEventListener('click', function () { pruefeStatus(nr, true); });
    abfragen(nr);
  }
  function abfragen(nr) {
    var start = Date.now();
    clearTimeout(S.abfrage);
    (function los() {
      if (nr !== schritt) return;
      pruefeStatus(nr, false).then(function (bezahlt) {
        if (bezahlt || nr !== schritt) return;
        if (Date.now() - start > 45 * 60 * 1000) { zeigeWarten('Die Zahlung ist noch nicht angekommen. Prüf sie mit dem Knopf unten, wenn du fertig bist.'); return; }
        S.abfrage = setTimeout(los, 4000);
      });
    })();
  }
  function pruefeStatus(nr, laut) {
    var t = tokenLesen(); if (!t) return Promise.resolve(false);
    return holeJson(api('/status'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) }).then(function (s) {
      S.status = s;
      if (s && s.bezahlt) { if (nr === schritt) erstelleBericht(); return true; }
      if (laut && nr === schritt) { var st = $('.ec-z-st', inhalt); if (st) st.textContent = s && s.status === 'abgelaufen' ? 'abgelaufen' : 'noch offen'; }
      return false;
    }).catch(function () { return false; });
  }
  if (kanal) kanal.onmessage = function (e) { if (e && e.data && e.data.bezahlt && fenster && !fenster.hidden && tokenLesen()) pruefeStatus(schritt, false); };

  /* 4 · Bericht erstellen ───────────────────────────────────────────── */
  function erstelleBericht() {
    stufe(3); var nr = ++schritt;
    clearTimeout(S.abfrage);
    var t = tokenLesen();
    setze('<h3 id="ecTitel">Zahlung erhalten. Dein Bericht entsteht.</h3><p class="ec-lead">' + (S.dateien.length ? 'DealPilot liest alle ' + S.dateien.length + ' Unterlagen und holt Lage, Markt, Vergleichsmiete und Wert. Das dauert bis zu zwei Minuten.' : 'DealPilot rechnet mit den gespeicherten Zahlen und holt Lage, Markt, Vergleichsmiete und Wert.') + '</p>'
      + '<div class="ec-lesen"><div class="ec-zeile an liest"><div class="ec-z-kopf"><b>Bericht</b><span class="ec-z-st">entsteht</span></div><span class="ec-balken"><i style="width:100%"></i></span></div></div>', 'h3');
    Promise.all([holeJson(api('/bericht'), { method: 'POST', body: formular(S.dateien.slice(0, INFO.voll_max), t) }), lade('DpDokument'), lade('DpMietpotenzial'), kappungsDaten(),
      lade('DealScore2')])
      .then(function (x) {
        if (nr !== schritt) return;
        var j = x[0];
        if (!j._ok) { zeigeRueckkehr(j.code === 'berichte_aufgebraucht' ? 'Für diesen Kauf sind alle Berichte erstellt.' : (j.error || 'Der Bericht konnte nicht entstehen.')); return; }
        S.bericht = berichtDaten(j, x[3]);
        zeigeBericht(S.bericht);
      }).catch(function () { if (nr === schritt) zeigeRueckkehr('Keine Verbindung. Bitte noch einmal versuchen.'); });
  }

  /* Alles, was der Bericht zeigt, an EINER Stelle gerechnet (nur Kerne, nichts erfunden) */
  function berichtDaten(j, kappDaten) {
    var z = j.zahlen || {}, m = j.markt || { verfuegbar: false };
    var r = rechne(z);
    var d = { z: z, m: m, r: r, unterlagen: j.unterlagen || [], aus_zahlenstand: !!j.aus_zahlenstand, status: j.status || {}, stand: datum() };
    /* Investor Deal Score: dieselbe Abbildung wie die Startbahn der Startseite (landing-faecher.js dealAus/rechne) */
    if (r && r.k && window.DpFaecher && typeof DpFaecher.rechne === 'function' && window.DealScore2) {
      var leerPct = (z.einheiten > 0 && z.leer_einheiten != null) ? z.leer_einheiten / z.einheiten * 100 : null;
      var S2 = { kp: r.e.kp, nk_pct: r.e.nkPct, nkm: r.e.nkm, wfl: z.wfl || null, bwk_nul: r.bwkNul, d1: r.d1, zins: r.e.zins, tilg: r.e.tilg };
      var vgl = m.vergleichsmiete && m.vergleichsmiete.qm; if (vgl > 0) S2.marktmiete = vgl; else if (m.markt && m.markt.miete_qm > 0) S2.marktmiete = m.markt.miete_qm;
      if (m.markt && m.markt.wert > 0) S2.marktwert = m.markt.wert;
      if (z.ek_klasse) S2.energieKlasse = z.ek_klasse;
      if (leerPct != null) S2.leerstandPct = Math.round(leerPct * 10) / 10;
      if (z.wfl > 0) { try { d.ds2 = DpFaecher.rechne(S2); } catch (e) { d.ds2 = null; } }
    }
    /* Mietpotenzial: zulässige Bestandsmiete nach drei Jahren und Neuvermietung (js/mietpotenzial-kern.js) */
    if (r && r.k && z.wfl > 0 && window.DpMietpotenzial) {
      var MP = window.DpMietpotenzial, ort = m.lage && m.lage.ags ? { ags: m.lage.ags } : {};
      var kapp = kappDaten ? MP.kappungAus(kappDaten, ort) : null;
      var kPct = kapp && (kapp.pct === 15 || kapp.pct === 20) && kapp.herkunft !== 'auffang' ? kapp.pct : 15;
      var vglQm = m.vergleichsmiete && m.vergleichsmiete.qm > 0 ? m.vergleichsmiete.qm : null;
      var zul = MP.zulaessig({ ist: r.e.nkm, wfl: z.wfl, vgl_qm: vglQm || '', kappung_pct: kPct });
      var bremse = kappDaten ? MP.mietpreisbremseAus(kappDaten, ort) : null;
      var neu = (m.markt && m.markt.miete_qm > 0) ? MP.neuvermietung({ markt_qm: m.markt.miete_qm, wfl: z.wfl, vgl_qm: vglQm || '', bremse: bremse }) : null;
      d.miete = { ist_qm: r.e.nkm / z.wfl, vgl_qm: vglQm, markt_qm: m.markt && m.markt.miete_qm > 0 ? m.markt.miete_qm : null, zul: zul, kPct: kPct,
        kAus: !!(kapp && kapp.herkunft !== 'auffang' && kapp.pct === kPct), bremse: bremse ? bremse.gilt : null, neu: neu };
    }
    return d;
  }

  function mieteSaetze(mi) {
    var s = [];
    if (!mi) return s;
    var z = mi.zul;
    if (z && z.miete_monat > 0) {
      if (z.grund === 'vergleichsmiete_erreicht') s.push('Die Miete liegt schon an der ortsüblichen Vergleichsmiete. Eine Erhöhung nach § 558 BGB ist nicht möglich.');
      else if (z.plus_pct > 0.05) s.push('Zulässig in drei Jahren: ' + eur(z.miete_monat) + ' im Monat, das sind ' + dez(z.plus_pct, 1) + ' % mehr'
        + (z.grund === 'kappung' ? ', begrenzt durch die Kappungsgrenze von ' + mi.kPct + ' %.' : ', bis zur ortsüblichen Vergleichsmiete.'));
      if (z.vgl_fehlt) s.push('Eine Vergleichsmiete lag nicht vor. Gerechnet ist deshalb nur bis zur Kappungsgrenze.');
    }
    s.push(mi.kAus ? 'Kappungsgrenze ' + mi.kPct + ' % in drei Jahren laut Landesverordnung.' : 'Kappungsgrenze vorsichtig mit 15 % angesetzt. Gilt in der Gemeinde keine Verordnung, sind es 20 %.');
    if (mi.bremse === true) s.push('In der Gemeinde gilt die Mietpreisbremse. Bei Neuvermietung höchstens Vergleichsmiete plus 10 %.');
    s.push('Orientierung, keine Rechtsberatung.');
    return s;
  }

  /* Text für Wert und Lage: nur, was der Dienst geliefert hat */
  function wertZeilen(m) {
    var w = (m && m.wert) || {}, z = [];
    if (m && m.markt && m.markt.wert > 0) z.push(['Marktpreisindikation', eur(m.markt.wert) + (m.markt.wert_von > 0 && m.markt.wert_bis > 0 ? ' (' + eur(m.markt.wert_von) + ' bis ' + eur(m.markt.wert_bis) + ')' : ''), 'indikativ, aus dem aktuellen Marktdurchschnitt']);
    if (w.ertragswert > 0) z.push(['Ertragswert', eur(w.ertragswert), 'ImmoWertV' + (w.liegenschaftszins_pct ? ', Liegenschaftszins ' + dez(w.liegenschaftszins_pct, 2) + ' %' : '') + (w.zins_herkunft ? ', ' + w.zins_herkunft : '')]);
    if (w.sachwert > 0) z.push(['Sachwert', eur(w.sachwert), 'ImmoWertV']);
    if (w.bodenrichtwert_qm > 0) z.push(['Bodenrichtwert', dez(w.bodenrichtwert_qm, 0) + ' €/m²', 'Gutachterausschuss']);
    return z;
  }

  /* Übernahme-Link: Paketkarte der Landing + Anrechnungs-Code + Zahlen als Fragment */
  function uebernahme(z, r) {
    var p = ['dc=1'];
    if (r && r.k && r.e) {
      p.push('kp=' + Math.round(r.e.kp), 'nkm=' + Math.round(r.e.nkm), 'ek=' + Math.round(r.ek), 'zins=' + (Math.round(r.e.zins * 100) / 100), 'nk=' + (Math.round(r.e.nkPct * 100) / 100),
        'tilg=' + (Math.round(r.e.tilg * 100) / 100));
      if (r.e.bindung) p.push('bind=' + r.e.bindung);
      if (r.e.ze > 0) p.push('ze=' + Math.round(r.e.ze));
    }
    if (z.wfl > 0) p.push('wfl=' + z.wfl);
    if (z.bj > 0) p.push('bj=' + Math.round(z.bj));
    if (z.plz) p.push('plz=' + encodeURIComponent(z.plz));
    if (z.ort) p.push('ort=' + encodeURIComponent(z.ort));
    if (z.art) p.push('art=' + encodeURIComponent(z.art));
    if (z.bwk_nul_jahr != null) p.push('bwkj=' + Math.round(z.bwk_nul_jahr));
    return p.length > 1 ? '#' + p.join('&') : '';
  }
  function paketeEinsetzen(ziel, z, r, code) {
    if (!ziel) return;
    var quelle = document.querySelector('#pricing #boxEinzel .tkg') || document.querySelector('#pricing .tkg');
    if (!quelle) { ziel.innerHTML = '<a class="btn-l" href="preise.html">Pakete ansehen</a>'; return; }
    var g = quelle.cloneNode(true);
    [g].concat($$('*', g)).forEach(function (x) { x.classList.remove('rv'); x.removeAttribute('id'); });
    var frag = uebernahme(z || {}, r);
    $$('.tk', g).forEach(function (tk) {
      var a = $('.tk-cta', tk); if (!a) return;
      var href = String(a.getAttribute('href') || '').split('#')[0];
      var frei = /plan=free/.test(href);
      if (code && !frei) href += (href.indexOf('?') >= 0 ? '&' : '?') + 'code=' + encodeURIComponent(code);
      a.setAttribute('href', href + frag);
    });
    ziel.innerHTML = ''; ziel.appendChild(g);
  }

  /* Ansicht des Berichts im Fenster + PDF ───────────────────────────── */
  function zeigeBericht(d) {
    stufe(3); ++schritt;
    var r = d.r, z = d.z, m = d.m, an = d.status && d.status.anrechnung;
    var ds2 = d.ds2 && d.ds2.r, g = ds2 && ds2.gesamt;
    var kopf = (g ? '<div class="ec-urteil" data-farbe="' + esc((window.ScoreTier ? ScoreTier.stufe(g.score).farbe : '')) + '"><div class="ec-ring"><b>' + g.score + '</b><small>/ 100</small></div>'
        + '<div><span class="ec-l">Investor Deal Score</span><div class="ec-wort">' + esc(g.empfehlung ? g.empfehlung.text : '') + '</div><p>Investment-Score ' + ds2.investment.score + ', Finanzierungs-Score ' + ds2.finanzierung.score + '.</p></div></div>'
      : (r && r.k ? '<div class="ec-urteil" data-farbe="' + esc(r.st.farbe) + '"><div class="ec-ring"><b>' + r.ds.score + '</b><small>/ 100</small></div><div><span class="ec-l">Deal Score</span><div class="ec-wort">' + esc(r.st.wort) + '</div></div></div>' : ''));
    setze('<h3 id="ecTitel">Dein Bericht ist fertig.</h3>' + kopf
      + (d.aus_zahlenstand ? meldung('Gerechnet mit den gespeicherten Zahlen aus dem kostenlosen Teil. Lade alle Unterlagen noch einmal hoch, dann liest der Bericht sie vollständig.', 'warn') : '')
      + '<div class="ec-knoepfe"><button type="button" class="btn-p ec-pdf">Bericht ansehen und als PDF speichern</button></div>'
      + (an ? '<div class="ec-schutz"><b>Anrechnung.</b> Buchst du bis ' + esc(datum(an.bis)) + ' ein Paket, rechnet DealPilot ' + esc(dez(an.cents / 100, 2)) + ' € an. Dein Code ' + esc(an.code) + ' steht schon in den Links unten. Das Objekt kommt mit den Zahlen in dein Konto.</div>'
        : '<p class="ec-fein">Das Objekt kommt mit den Zahlen in dein Konto, wenn du über eine der Karten unten startest.</p>')
      + '<div class="ec-pakete"><span class="ec-l">Weiter in DealPilot</span><div class="ec-pk"></div></div>', '.ec-pdf');
    paketeEinsetzen($('.ec-pk', inhalt), z, r, an ? an.code : null);
    $('.ec-pdf', inhalt).addEventListener('click', function () { pdf(d); });
  }

  function pdf(d) {
    var D = window.DpDokument;
    if (!D) { alert('Die Vorlage für das PDF ist nicht geladen. Bitte die Seite neu laden.'); return; }
    var r = d.r, z = d.z, m = d.m || {}, ds2 = d.ds2 && d.ds2.r;
    var ortZeile = [z.plz, z.ort || (m.lage && m.lage.ort)].filter(Boolean).join(' ');
    var ART = { ETW: 'Eigentumswohnung', EFH: 'Einfamilienhaus', ZFH: 'Zweifamilienhaus', DHH: 'Doppelhaushälfte', RH: 'Reihenhaus', MFH: 'Mehrfamilienhaus', GEW: 'Gewerbeobjekt' };
    var titel = (ART[z.art] || 'Objekt') + (ortZeile ? ' in ' + ortZeile : '');
    var c = { marke: { company: 'DealPilot' }, logo: null, dokument: 'Einzel-Check', zeile: ortZeile || 'Objekt aus deinen Unterlagen', stand: d.stand };
    var seiten = [];
    var g = ds2 && ds2.gesamt;
    seiten.push(D.deckblatt(c, { eyebrow: 'Einzel-Check · Bericht', titel: titel,
      unter: [z.wfl ? dez(z.wfl, 0) + ' m² Wohnfläche' : '', z.bj ? 'Baujahr ' + Math.round(z.bj) : '', r && r.e.kp ? 'Kaufpreis ' + eur(r.e.kp) : ''].filter(Boolean).join(' · '),
      wertLabel: g ? 'Investor Deal Score' : (r && r.k ? 'Deal Score' : null), wert: g ? g.score + ' / 100' : (r && r.k ? r.ds.score + ' / 100' : null),
      wertNeben: g ? D.esc(g.empfehlung ? g.empfehlung.text : '') : (r && r.k ? D.esc(r.st.wort) : ''),
      meta: [['Unterlagen', (d.unterlagen.filter(function (u) { return u.gelesen; }).length || (z.unterlagen || 0)) + ' gelesen'], ['Stand', d.stand], ['Art', 'Einzel-Check']],
      hinweisRechts: 'Erstellt am ' + D.esc(d.stand) }));

    /* Investor Deal Score */
    if (ds2 && g) {
      var gruppen = function (t) { return (t.gruppen || []).map(function (x) { return [x.name || x.titel || x.key || '', istZahl(x.score) ? Math.round(x.score) + ' / 100' : '–']; }); };
      seiten.push(D.seite(c, 'Investor Deal Score', D.abschnitt('Gesamturteil', 'Investor Deal Score', 'Gerechnet mit dem Kern der App (Profil Standard) aus deinen Unterlagen und den Eingaben des Deal-Checks.')
        + D.scoreRing(g.score, g.empfehlung ? g.empfehlung.text : '')
        + D.kacheln([{ l: 'Investment-Score', v: ds2.investment.score + ' / 100', s: 'Anteil ' + dez(ds2.investment.anteil, 1) + ' %', art: ds2.investment.score >= 70 ? 'gut' : '' },
          { l: 'Finanzierungs-Score', v: ds2.finanzierung.score + ' / 100', s: ds2.finanzierung.gedeckelt ? 'begrenzt durch den DSCR' : 'Anteil ' + dez(ds2.finanzierung.anteil, 1) + ' %', art: ds2.finanzierung.score >= 70 ? 'gut' : '' },
          { l: 'Gesamturteil', v: g.empfehlung ? g.empfehlung.text : '–', s: d.ds2.belastbar ? 'belastbar' : 'noch wenige Kennzahlen (' + d.ds2.n + ' von ' + d.ds2.von + ')', art: 'hi' }], true)
        + '<h3>Investment</h3>' + D.liste(gruppen(ds2.investment), ['Gruppe', 'Punkte'])
        + '<h3>Finanzierung</h3>' + D.liste(gruppen(ds2.finanzierung), ['Gruppe', 'Punkte'])));
    }
    /* Kennzahlen */
    if (r && r.k) {
      seiten.push(D.seite(c, 'Kennzahlen', D.abschnitt('Rendite und Finanzierung', 'Cashflow, Rendite, DSCR', annahmeText(r))
        + D.kacheln([{ l: 'Cashflow', v: D.eurS(r.k.cf_m), s: 'im Monat vor Steuern', art: r.k.cf_m < 0 ? 'schlecht' : 'gut' },
          { l: 'Bruttorendite', v: D.pct(r.k.bmy), s: 'Faktor ' + D.zahl(r.k.fak, 1) }, { l: 'Nettorendite', v: D.pct(r.k.nmy) },
          { l: 'DSCR', v: r.k.d_total > 0 ? D.zahl(r.k.dscr, 2) : 'entfällt', s: 'Kapitaldienstdeckung', art: r.k.d_total > 0 && r.k.dscr < 1 ? 'schlecht' : '' }])
        + D.liste([['Kaufpreis', eur(r.e.kp)], ['Kaufnebenkosten (' + dez(r.e.nkPct, 1) + ' %)', eur(r.nk)], ['Eigenkapital', eur(r.ek)], ['Darlehen', eur(r.d1)],
          ['Kaltmiete im Jahr', eur(r.e.nkm * 12)], r.e.ze > 0 ? ['Zusatzeinnahmen im Jahr', eur(r.e.ze * 12)] : null, ['Nicht umlagefähige Kosten im Jahr', eur(r.bwkNul)]], ['Position', 'Betrag'])
        + '<div class="hinweis">Keine Finanzierungs- oder Steuerberatung. Alle Annahmen sind in DealPilot anpassbar.</div>'));
    }
    /* Mietpotenzial */
    if (d.miete) {
      var mi = d.miete;
      seiten.push(D.seite(c, 'Mietpotenzial', D.abschnitt('Miete', 'Mietpotenzial', 'Ist-Miete aus deinen Unterlagen gegen die Vergleichsmiete und den aktuellen Marktdurchschnitt.')
        + D.kacheln([{ l: 'Ist-Miete', v: D.zahl(mi.ist_qm, 2) + ' €/m²' }, { l: 'Vergleichsmiete', v: mi.vgl_qm ? D.zahl(mi.vgl_qm, 2) + ' €/m²' : 'nicht ermittelt' },
          { l: 'Marktdurchschnitt', v: mi.markt_qm ? D.zahl(mi.markt_qm, 2) + ' €/m²' : 'nicht ermittelt', s: 'Angebotsmieten, Neuvermietung' }], true)
        + '<ul>' + mieteSaetze(mi).map(function (t) { return '<li>' + D.esc(t) + '</li>'; }).join('') + '</ul>'
        + (mi.neu && mi.neu.qm > 0 ? '<p>Bei Neuvermietung: ' + D.zahl(mi.neu.qm, 2) + ' €/m²' + (mi.neu.gedeckelt ? ', begrenzt durch die Mietpreisbremse' : '') + '.</p>' : '')));
    }
    /* Lage und Markt (Marktbericht in Kurzform) */
    if (m.verfuegbar) {
      var lz = [];
      if (istZahl(m.lage.mikro)) lz.push({ l: 'Mikrolage', v: Math.round(m.lage.mikro) + ' / 100', s: 'Umfeld im Umkreis' });
      if (istZahl(m.lage.makro)) lz.push({ l: 'Makrolage', v: Math.round(m.lage.makro) + ' / 100', s: 'Region' });
      if (m.vergleichsmiete && m.vergleichsmiete.qm > 0) lz.push({ l: 'Vergleichsmiete', v: D.zahl(m.vergleichsmiete.qm, 2) + ' €/m²', s: m.vergleichsmiete.stufe || '' });
      if (m.markt && m.markt.miete_qm > 0) lz.push({ l: 'Marktmiete', v: D.zahl(m.markt.miete_qm, 2) + ' €/m²', s: 'aktueller Marktdurchschnitt' });
      seiten.push(D.seite(c, 'Lage und Markt', D.abschnitt('Marktbericht in Kurzform', 'Lage, Markt und Vergleichsmiete', 'Stichtag ' + (m.stichtag ? D.datum(m.stichtag) : d.stand) + '. Ermittelt mit dem Marktbericht von DealPilot.')
        + (lz.length ? D.kacheln(lz) : '<p>Für diesen Ort liegen keine Lagekennzahlen vor.</p>')
        + (istZahl(m.lage.bevoelkerung_trend_pct) ? '<p>Bevölkerung in der Region: ' + (m.lage.bevoelkerung_trend_pct >= 0 ? '+' : '−') + D.zahl(Math.abs(m.lage.bevoelkerung_trend_pct), 1) + ' %.</p>' : '')
        + '<h3>Wertindikation</h3>' + (wertZeilen(m).length ? D.liste(wertZeilen(m).map(function (x) { return [x[0], x[1], { det: x[2] }]; }), ['Wert', 'Betrag']) : '<p>Eine Wertindikation lag für dieses Objekt nicht vor.</p>')
        + ((m.wert && !(m.wert.ertragswert > 0) && m.wert.ertragswert_grund) ? '<div class="hinweis">Ertragswert: ' + D.esc(m.wert.ertragswert_grund) + '</div>' : '')
        + ((m.wert && m.wert.zins_weg) ? '<div class="hinweis">' + D.esc(m.wert.zins_weg) + '</div>' : '')
        + ((m.wert && m.wert.ausschuss_link) ? '<p>Zuständiger Gutachterausschuss: ' + D.esc(m.wert.ausschuss_link.name || '') + ' · ' + D.esc(m.wert.ausschuss_link.url) + '</p>' : '')
        + '<div class="hinweis">Indikative Werte, kein Verkehrswertgutachten nach § 194 BauGB. Jede Zahl nennt ihre Herkunft. Fehlt eine amtliche Zahl, erfindet DealPilot keine.</div>'));
    } else {
      seiten.push(D.seite(c, 'Lage und Markt', D.abschnitt('Marktbericht in Kurzform', 'Lage, Markt und Vergleichsmiete')
        + '<p>' + (m.grund === 'ohne_ort' ? 'In den Unterlagen stand kein Ort. Ohne Postleitzahl rechnet der Marktbericht nicht.' : 'Der Marktbericht war gerade nicht erreichbar. In DealPilot holst du ihn mit einem Klick nach.') + '</p>'));
    }
    /* Unterlagen und Hinweise */
    var ud = d.unterlagen.length ? d.unterlagen : [];
    if (ud.length) {
      seiten.push(D.seite(c, 'Unterlagen', D.abschnitt('Was in deinen Unterlagen steht', 'Unterlagen und Hinweise', 'Personendaten wurden vor dem Auslesen geschwärzt.')
        + ud.map(function (u) {
          return '<h3>' + D.esc(u.art) + '</h3>' + (u.gelesen ? '' : '<p>' + D.esc(GRUND[u.grund] || 'nicht gelesen') + '.</p>')
            + (u.kernpunkte && u.kernpunkte.length ? '<ul>' + u.kernpunkte.map(function (k) { return '<li>' + D.esc(kundenSatz(k)) + '</li>'; }).join('') + '</ul>' : '')
            + (u.risiken && u.risiken.length ? D.liste(u.risiken.map(function (x) { return [x.titel, x.schwere, { det: kundenSatz(x.beschreibung) }]; }), ['Hinweis', 'Gewicht']) : '');
        }).join('')));
    }
    /* Weg in die App */
    var an = d.status && d.status.anrechnung;
    seiten.push(D.seite(c, 'Weiter in DealPilot', D.abschnitt('Der nächste Schritt', 'Weiter in DealPilot', 'Steuer, Finanzierung, Restnutzungsdauer und Wertermittlung im Detail.')
      + '<ul><li>Objekt anlegen: Die Zahlen dieses Berichts übernimmt DealPilot beim Start über die Pakete der Startseite.</li>'
      + (an ? '<li>Anrechnung: Buchst du bis ' + D.esc(datum(an.bis)) + ' ein Paket, rechnet DealPilot ' + D.esc(dez(an.cents / 100, 2)) + ' € an. Code ' + D.esc(an.code) + '.</li>' : '')
      + '<li>Kostenlos starten: vier Wochen voller Pro-Umfang ohne Zahlungsdaten, danach automatisch Free.</li></ul>'
      + '<p>' + D.esc(appBasis()) + '</p>'
      + '<div class="hinweis">Der Bericht ist eine Orientierung für deine Entscheidung, keine Rechts-, Steuer- oder Finanzierungsberatung. Werte sind indikativ.</div>'));
    var doc = D.dokument('DealPilot Einzel-Check · ' + titel, seiten);
    D.vorschau(doc, 'Einzel-Check · ' + titel);
  }

  /* Rückkehr von Stripe (Erfolgs- und Abbruchseite) ─────────────────── */
  function zeigeRueckkehr(hinweis) {
    stufe(3); var nr = ++schritt;
    var s = S.status || {};
    if (!s.bezahlt) {
      setze('<h3 id="ecTitel">' + (s.status === 'abgelaufen' ? 'Der Kauf ist abgelaufen.' : 'Die Zahlung ist noch nicht da.') + '</h3>' + (hinweis ? meldung(hinweis, 'warn') : '')
        + '<p class="ec-lead">' + (s.status === 'abgelaufen' ? 'Ein Kauf gilt 14 Tage.' : 'Ist die Zahlung abgeschlossen, erscheint sie hier in wenigen Sekunden.') + '</p>'
        + '<div class="ec-knoepfe"><button type="button" class="btn-l ec-pruef">Noch einmal prüfen</button><button type="button" class="btn-l ec-neu">Von vorn</button></div>', 'h3');
      $('.ec-pruef', inhalt).addEventListener('click', function () { statusLaden().then(function () { if (S.status && S.status.bezahlt) zeigeRueckkehr(); else zeigeRueckkehr(); }); });
      $('.ec-neu', inhalt).addEventListener('click', function () { S.frei = null; zeigeUnterlagen(); });
      return;
    }
    setze('<h3 id="ecTitel">Zahlung erhalten.</h3>' + (hinweis ? meldung(hinweis, 'warn') : '')
      + '<p class="ec-lead">Ist das erste Fenster noch offen, entsteht dein Bericht dort. Sonst wähle deine Unterlagen hier noch einmal, dann liest DealPilot sie vollständig.</p>'
      + '<label class="ec-ablage-zone"><input type="file" class="ec-datei" accept="application/pdf,.pdf" multiple><span><b>Unterlagen wählen</b><br><small>Bis zu ' + INFO.voll_max + ' PDFs</small></span></label>'
      + '<p class="ec-fein">' + (S.dateien.length ? S.dateien.length + ' Unterlagen gewählt.' : '') + ' Noch ' + (s.berichte_rest != null ? s.berichte_rest : '') + ' Berichte zu diesem Kauf, gültig bis ' + esc(datum(s.gueltig_bis)) + '.</p>'
      + '<div class="ec-knoepfe"><button type="button" class="btn-p ec-erst"' + (S.dateien.length ? '' : ' disabled') + '>Bericht erstellen</button><button type="button" class="btn-l ec-ohne">Ohne Unterlagen, mit den gespeicherten Zahlen</button></div>', 'h3');
    var inp = $('.ec-datei', inhalt);
    inp.addEventListener('change', function () {
      [].slice.call(inp.files || []).forEach(function (f) { if (S.dateien.length < INFO.voll_max && /pdf/i.test(f.type || f.name) && f.size <= INFO.max_mb * 1048576) S.dateien.push(f); });
      if (nr === schritt) zeigeRueckkehr();
    });
    $('.ec-erst', inhalt).addEventListener('click', erstelleBericht);
    $('.ec-ohne', inhalt).addEventListener('click', function () { S.dateien = []; erstelleBericht(); });
  }
  function statusLaden() {
    var t = tokenLesen(); if (!t) return Promise.resolve(null);
    return holeJson(api('/status'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) })
      .then(function (s) { S.status = s; return s; }).catch(function () { return null; });
  }
  function rueckkehrPruefen() {
    var q = /[?&]einzelcheck=(bezahlt|abbruch)(&|$)/.exec(location.search || '');
    var h = /[#&]ec=([A-Za-z0-9_-]{40,60})/.exec(location.hash || '');
    if (!q) return;
    if (h) tokenMerken(h[1]);
    /* Token und Parameter aus der Adresszeile nehmen (kein Verlauf, kein Teilen mit Token) */
    try { history.replaceState(history.state, '', location.pathname); } catch (e) {}
    if (q[1] === 'bezahlt' && kanal) { try { kanal.postMessage({ bezahlt: true }); } catch (e) {} }
    oeffnen();
    var versuch = 0;
    (function los() {
      statusLaden().then(function (s) {
        if ((!s || !s.bezahlt) && q[1] === 'bezahlt' && ++versuch < 6) { setTimeout(los, 2500); return; }
        S.frei = S.frei || (s && s.zahlen ? { zahlen: s.zahlen, unterlagen: [] } : null);
        if (q[1] === 'abbruch' && !(s && s.bezahlt)) { if (S.frei) zeigeErgebnis('Die Zahlung wurde abgebrochen.'); else zeigeUnterlagen('Die Zahlung wurde abgebrochen.'); return; }
        zeigeRueckkehr();
      });
    })();
  }

  /* ── Preis aus Stripe (über den Server), dann dem Deal-Check Bescheid geben ── */
  function preisLaden() {
    holeJson(api('/preis')).then(function (p) {
      if (!p._ok || !(p.amount_cents > 0)) return;
      ['frei_max', 'voll_max', 'max_mb', 'frist_tage', 'amount_cents'].forEach(function (k) { if (p[k] > 0) INFO[k] = p[k]; });
      window.DpEinzelCheck.preis = INFO.amount_cents / 100;
      try { document.dispatchEvent(new CustomEvent('dp:einzelcheck-bereit')); } catch (e) {}
      knopf();
    }).catch(function () { /* ohne Preis kein Kaufweg, der Deal-Check bleibt wie er ist */ });
  }

  /* Einstieg am Ende des Deal-Check-Ergebnisses, nur wenn der Deal-Check keinen eigenen Knopf hat (#dkBericht) */
  function knopf() {
    if (document.getElementById('dkBericht')) return;
    var erg = document.getElementById('dcErg');
    if (!erg || $('.ec-einstieg', erg) || !(INFO.amount_cents > 0)) return;
    var d = document.createElement('div'); d.className = 'ec-einstieg';
    d.innerHTML = '<button type="button" class="ec-start">Unterlagen hochladen und genauer prüfen <span aria-hidden="true">→</span></button><small>Einzel-Check · zwei Unterlagen kostenlos</small>';
    erg.appendChild(d);
    $('.ec-start', d).addEventListener('click', auf);
  }
  document.addEventListener('dp:dealcheck-ergebnis', knopf);

  window.DpEinzelCheck = { VERSION: VERSION, auf: auf, zu: zu, rechne: rechne, preis: 0, _S: S };
  preisLaden();
  rueckkehrPruefen();
})();
