/* ═══════════════════════════════════════════════════════════════════════
   einzelcheck.js · v3940 (20.11.2026) / v3941 (21.11.2026) / v3944 / v3946 (22.11.2026) / einzelcheck-3 (24.11.2026) · Einzel-Check der Landing, echter Ablauf

   einzelcheck-3 · Marcel 24.11.2026: „erst die Unterlagen auslesen und dann auch schauen, welche Werte wir ergänzen
   müssen … erst auslesen, dann die Grundangaben gucken, was noch fehlt, und dann wird der Bericht daraus erstellt“.
   Ablauf jetzt: 1 Unterlagen (oder ohne weiter) → 2 Auslesen → 3 GRUNDANGABEN, vorbelegt aus den Unterlagen, je Feld
   mit Herkunft („aus dem Exposé“, „aus dem Marktbericht“, „aus deinem Deal-Check“), Pflichtfelder ohne Wert als
   „fehlt“ markiert → 4 Ergebnis und Kauf → 5 Bericht. Widerspricht eine Unterlage einer Angabe (Deal-Check oder
   eigene Eingabe), stehen BEIDE Werte am Feld und der Käufer wählt, weiter geht es erst danach (nie still
   überschrieben). Ein Marktbericht oder Gutachten liest der Server mit eigenem Schema (services/einzelcheck.js
   istWertbericht): sein Kaufpreis heißt „aus dem Marktbericht“, seine Verfahrenswerte stehen als Hinweis daneben.

   v3946 · Marcel nach dem Testkauf 22.11.2026 („danach musste ich das Exposé wieder hochladen … Stufe drei …
   Finanzierung … Anschlussfinanzierung auf fünf Prozent … im Stil unserer sonstigen Unterlagen … nichts davor mit
   A, B und C“). GEMESSEN auf Staging (Caddy-Protokoll, Kauf e45a08cb…): Stripe öffnete in einem ZWEITEN Fenster,
   die Rückkehr landete dort, ohne die Dateien (sie lagen nur im Arbeitsspeicher des ersten Fensters). Das erste
   Fenster baute den Bericht 08:56:47 still im Hintergrund, im zweiten lud Marcel dieselben 1.759.176 Bytes neu
   hoch (08:56:59). Jetzt:
     1 GRUNDANGABEN vor dem Hochladen, getrennt „Objekt“ und „Finanzierung“ (grundFormular, grundFehlt). Vorbelegt
       aus dem Deal-Check, die Unterlagen ergänzen leere Felder und melden Abweichungen (ergaenzen).
     2 Bezahlt wird im SELBEN Tab. Vorher legt der Browser Dateien, Grundangaben und das Ergebnis des kostenlosen
       Teils in IndexedDB AUF DEM GERÄT ab (ablage), nichts geht dafür an DealPilot. Nach der Rückkehr startet der
       Bericht von selbst, danach wird die Ablage gelöscht (spätestens nach ABLAGE_STUNDEN beim nächsten Besuch).
     3 Marktbericht Stufe 3 (Bodenrichtwert, Ertrags-, Sach-, Vergleichswert, führendes Verfahren), Weissliste
       wertAus() im Backend, hier nur gesetzt (wertSeite).
     4 Finanzierung wie im Investment-PDF (finanzierungAus): Darlehen, Rate, Zins, Tilgung, Restschuld am Ende der
       Zinsbindung, Anschluss mit ANSCHLUSS_ZINS und derselben Tilgung, Cashflow vor und nach Finanzierung, DSCR.
       Gerechnet nur mit DealKpis.compute, Dscr.compute und DpDarlehenWeitere.monatsplan (Monat für Monat wie calc.js).
     5 PDF mit Deckblatt, Kopf- und Fußzeile, Kapiteln ohne Buchstaben davor (die Kapitel des KI-Texts benennt das
       Backend um, ueberschrift()).

   v3944 ·Vergleichsmiete mit Herkunft und Obergrenze für Investoren (mietpotenzialAus, mieteZeilen, mieteSaetze),
   gerechnet nur mit js/mietpotenzial-kern.js. Vergleichsmiete vom Server, ohne Treffer kein Wert.
   Vorher einzelcheck-demo.js (landing-faecher-1, nur Beispieldaten).

   Marcel 20.11.2026 (Preis entschieden: 3,99 €, Betrag kommt aus Stripe):
     1 Unterlagen wählen (bis zu vier PDFs: Exposé, Mietaufstellung, WEG-Protokoll, Energieausweis …)
     2 Kostenlos: die ERSTEN ZWEI liest der Server mit einem günstigen Modell, dazu eine grobe
       Einschätzung mit den Kernen der Startseite (DealKpis, DealScore, ScoreTier) und den Eingaben
       aus dem Deal-Check (DpDealCheck.letztes()).
     3 Kauf per Stripe Checkout (Einmalzahlung) in einem NEUEN Fenster. Dieses Fenster behält die
       Unterlagen im Arbeitsspeicher und fragt den Kaufstatus ab. Sobald bezahlt ist, liest der Server
       ALLE Unterlagen mit dem normalen Modell und holt Lage und Markt (v3941: Marktbericht Stufe 2,
       Erweiterte Marktpreisindikation mit KI-Text, KEINE Wertermittlung nach ImmoWertV, dafür der Weg
       in die App). Gescannte PDFs liest der Server seit v3941 per Texterkennung im Speicher.
     4 Der Bericht entsteht HIER im Browser (frontend/js/dp-dokument.js vom App-Host, dasselbe
       Gestaltungssystem wie Investment-PDF und Marktbericht) und wird über „Drucken / als PDF speichern“
       geholt. Auf dem Server liegt kein Bericht.
     5 Paketwahl: die Karten aus #pricing (dieselbe Quelle wie die Preise der Landing), mit
       Anrechnungs-Code (?code=, derselbe Weg wie der Flyer-Code) und den Zahlen als Fragment
       (#dc=1&…, js/dealcheck-uebernahme.js legt das Objekt im Konto an).
       v3941 · RABATT-VORRANG: der Anrechnungs-Code gewinnt (an einen echten Kauf gebunden, meist höher).
       flyer-code.js hängt einen gemerkten Flyer-Code schon an die Paketlinks der Landing; die App liest
       den ERSTEN code=/promo=/rabatt= (ausQuery) und merkt ihn statt des Flyer-Cookies. mitCode()
       entfernt deshalb jeden anderen Code und setzt nur den EC-Code. Ohne EC-Code bleibt der Link wie er ist.

   GESPEICHERT im Browser: nur das Kauf-Token in sessionStorage (dieser Tab). Keine Datei, kein Text.
   Schnittstellen: backend/src/routes/publicEinzelcheck.js, services/einzelcheck.js.
   Vertrag mit dp2-dealcheck.js: window.DpEinzelCheck.auf() und .preis (Euro, > 0 erst, wenn Stripe
   den Preis geliefert hat), Ereignis 'dp:einzelcheck-bereit'.
   Geladen nur von landing-faecher.js einzelcheckLaden() (Staging und lokal).
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpEinzelCheck) return;
  var VERSION = 'einzelcheck-3';
  var ANSCHLUSS_ZINS = 5.0;     /* v3946 · Marcel 22.11.2026: „Anschlussfinanzierung, die wir einfach auf fünf Prozent rechnen mit derselben Tilgung“ */
  var ABLAGE_STUNDEN = 2;       /* v3946 · Unterlagen im Browser höchstens so lange (die Stripe-Kasse läuft nach 60 Minuten ab) */
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
  var _laeuft = 0;   /* einzelcheck-2 · laufende Anfragen (Hochladen, Auslesen, Kauf, Bericht) */
  function holeJson(url, init) {
    var schreibt = !!(init && init.method && init.method !== 'GET');
    if (schreibt) _laeuft++;
    var fertig = function () { if (schreibt) _laeuft = Math.max(0, _laeuft - 1); };
    return fetch(url, init || {}).then(function (r) {
      return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = {}; } j._status = r.status; j._ok = r.ok; fertig(); return j; });
    }, function (e) { fertig(); throw e; });
  }

  /* ── Kerne nachladen (Buster wie frontend/index.html, tools/buster-ebenen-pruefen.mjs) ── */
  var KERNE = { DpDokument: 'js/dp-dokument.js?v=v4380', DpMietpotenzial: 'js/mietpotenzial-kern.js?v=v4220', DealScore2: 'js/dealscore2.js?v=v3254',
    DpDarlehenWeitere: 'js/darlehen-weitere.js?v=v3256',
    pdfjsLib: 'vendor/cdn/pdf.js/3.11.174/pdf.min.js' };   /* einzelcheck-2 · Fotos aus dem Exposé (wie js/pdf-import.js) */   /* v3946 · Monatsplan der Darlehen (Restschuld, Anschluss) */
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
  var S = { dateien: [], frei: null, token: null, status: null, bericht: null, abfrage: null, grund: null, adresse: '', abweichungen: [],
    herkunft: {}, ohneUnterlagen: false };   /* einzelcheck-3 · Herkunft je Feld aus dem Auslesen, Weg ohne Unterlagen */
  function tokenMerken(t) { S.token = t; try { sessionStorage.setItem(SPEICHER, t); } catch (e) {} }
  function tokenLesen() { if (S.token) return S.token; try { S.token = sessionStorage.getItem(SPEICHER) || null; } catch (e) {} return S.token; }

  /* ── v3946 · ABLAGE IM BROWSER (IndexedDB, nur auf dem Gerät des Käufers) ─────────────────────────────
     Vor der Weiterleitung zu Stripe: Dateien (als Blob), Grundangaben, freiwillige Anschrift und das Ergebnis
     des kostenlosen Teils. Nach der Rückkehr gelesen, nach dem fertigen Bericht oder bei Abbruch gelöscht,
     jeder Aufruf der Seite löscht Einträge älter als ABLAGE_STUNDEN. Nichts davon geht an einen Server.
     Ohne IndexedDB (privates Fenster, gesperrt): der Bericht rechnet mit den beim Kauf gespeicherten Zahlen. */
  var DB_NAME = 'dp-einzelcheck', DB_STORE = 'kauf', DB_KEY = 'laufend';
  function dbOeffnen() {
    return new Promise(function (ok, nein) {
      var r; try { r = window.indexedDB && indexedDB.open(DB_NAME, 1); } catch (e) { r = null; }
      if (!r) { nein(new Error('kein IndexedDB')); return; }
      r.onupgradeneeded = function () { try { r.result.createObjectStore(DB_STORE); } catch (e) {} };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { nein(r.error || new Error('IndexedDB')); };
    });
  }
  function dbTun(modus, fn) {
    return dbOeffnen().then(function (db) {
      return new Promise(function (ok, nein) {
        var tx, erg; try { tx = db.transaction(DB_STORE, modus); } catch (e) { db.close(); nein(e); return; }
        var req = fn(tx.objectStore(DB_STORE));
        if (req) req.onsuccess = function () { erg = req.result; };
        tx.oncomplete = function () { db.close(); ok(erg); };
        tx.onerror = tx.onabort = function () { db.close(); nein(tx.error || new Error('IndexedDB')); };
      });
    });
  }
  var ablage = {
    schreiben: function (rec) { return dbTun('readwrite', function (st) { return st.put(rec, DB_KEY); }); },
    lesen: function () {
      return dbTun('readonly', function (st) { return st.get(DB_KEY); }).then(function (rec) {
        if (!rec || !(Date.now() - (rec.zeit || 0) < ABLAGE_STUNDEN * 3600000)) { if (rec) ablage.loeschen(); return null; }
        return rec;
      }).catch(function () { return null; });
    },
    loeschen: function () { return dbTun('readwrite', function (st) { return st.delete(DB_KEY); }).catch(function () {}); }
  };
  function ablageAus(token) {
    return { zeit: Date.now(), token: token, grund: S.grund, adresse: S.adresse || '', frei: S.frei,
      dateien: S.dateien.map(function (f) { return { name: f.name, type: f.type || 'application/pdf', blob: f }; }) };
  }
  function ablageEin(rec) {
    S.grund = rec.grund || S.grund; S.adresse = rec.adresse || ''; S.frei = rec.frei || S.frei;
    S.dateien = (rec.dateien || []).map(function (d) {
      try { return new File([d.blob], d.name, { type: d.type || 'application/pdf' }); } catch (e) { var b = d.blob; try { b.name = d.name; } catch (x) {} return b; }
    });
  }

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
    fenster.innerHTML = '<div class="ec-dunkel"></div><div class="ec-box" role="dialog" aria-modal="true" aria-labelledby="ecTitel">'
      + '<div class="ec-leiste"><span class="ec-marke">Einzel-Check</span>' + (/(^|\.)staging\./.test(location.hostname) ? '<span class="ec-demo">Staging · Abnahme läuft</span>' : '') + '<button type="button" class="ec-x" data-zu aria-label="Schließen">×</button></div>'
      + '<ol class="ec-schritte" aria-hidden="true"><li>Unterlagen</li><li>Auslesen</li><li>Grundangaben</li><li>Ergebnis</li><li>Bericht</li></ol>'
      + '<div class="ec-inhalt" aria-live="polite"></div></div>';
    document.body.appendChild(fenster);
    inhalt = $('.ec-inhalt', fenster);
    /* einzelcheck-2 (Marcel 24.11.2026): Klick daneben schliesst NICHT mehr, nur × und Esc.
       Laeuft gerade ein Hochladen, Auslesen oder Kauf, fragt das Fenster vorher nach. */
    fenster.addEventListener('click', function (e) {
      if (e.target.closest('[data-zu-ja]')) { frageWeg(); zu(true); return; }
      if (e.target.closest('[data-zu-nein]')) { frageWeg(); return; }
      if (e.target.closest('[data-zu]')) zu();
    });
    document.addEventListener('keydown', function (e) {
      if (fenster.hidden) return;
      if (e.key === 'Escape') { if ($('.ec-frage', fenster)) frageWeg(); else zu(); return; }
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
    else if ((S.frei || S.ohneUnterlagen) && S.grund && !grundFehlt(S.grund).length) zeigeErgebnis();
    else if (S.frei || S.ohneUnterlagen) zeigeGrund();   /* einzelcheck-3 · nach dem Auslesen die Grundangaben */
    else zeigeUnterlagen();                                /* einzelcheck-3 · zuerst die Unterlagen */
  }
  function frageWeg() { var q = fenster && $('.ec-frage', fenster); if (q) q.remove(); }
  function zu(sicher) {
    if (!fenster) return;
    if (!sicher && _laeuft > 0) {
      if ($('.ec-frage', fenster)) return;
      var q = document.createElement('div'); q.className = 'ec-frage'; q.setAttribute('role', 'alertdialog');
      q.innerHTML = '<p><b>Gerade läuft noch etwas.</b> Wenn du jetzt schließt, wird das Hochladen oder Auslesen abgebrochen. Deine Angaben bleiben gespeichert.</p>'
        + '<div class="ec-frage-k"><button type="button" class="btn-p" data-zu-nein>Weiter warten</button><button type="button" class="btn-l" data-zu-ja>Trotzdem schließen</button></div>';
      $('.ec-box', fenster).appendChild(q);
      try { $('[data-zu-nein]', q).focus(); } catch (e) {}
      return;
    }
    frageWeg();
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

  /* v3946 · Ablage im Browser für die Zahlung ergänzt. Der Satz zu gescannten PDFs war seit v3941 falsch
     (die Texterkennung liest sie im Speicher) und ist ersetzt. */
  var SCHUTZ = '<div class="ec-schutz"><b>Datenschutz.</b> DealPilot liest deine Unterlagen nur im Arbeitsspeicher und speichert sie nicht. '
    + 'Bevor eine KI den Text liest, schwärzt DealPilot Namen, Geburtsdaten, Anschriften von Personen, E-Mail, Telefon und Kontodaten. '
    + 'Die Schwärzung folgt Mustern und erkennt nicht jede Schreibweise. Zum Auslesen geht nur der geschwärzte Text an einen KI-Dienst, der ihn nicht zum Training verwendet. Gescannte PDFs liest eine Texterkennung, ebenfalls nur im Arbeitsspeicher. '
    + 'Kaufst du den Bericht, speichert DealPilot nur deine Grundangaben und die ausgelesenen Zahlen, ohne Namen und ohne Anschrift, für höchstens 14 Tage. '
    + 'Für die Zahlung legt dein Browser die Unterlagen kurz auf deinem Gerät ab, damit du sie nach der Kasse nicht noch einmal hochladen musst. '
    + 'Sie gehen dabei nicht an DealPilot und werden gelöscht, sobald dein Bericht fertig ist, spätestens nach ' + ABLAGE_STUNDEN + ' Stunden.</div>';

  /* 0 · v3946 GRUNDANGABEN: Objekt und Finanzierung, Pflicht vor dem Hochladen ──────────────────────
     Marcel 22.11.2026: „man sollte auf jeden Fall den Deal-Check machen, um dann noch ein Exposé hochladen zu
     können … Man muss ja nicht die Adresse angeben … dass wir dann auch im Objekt und in Finanzierung unterscheiden.“
     Dieselben Pflichtfelder prüft der Server (services/einzelcheck.js grundFehlt). */
  var ART_LISTE = [['ETW', 'Eigentumswohnung'], ['EFH', 'Einfamilienhaus'], ['ZFH', 'Zweifamilienhaus'], ['DHH', 'Doppelhaushälfte'], ['RH', 'Reihenhaus'], ['MFH', 'Mehrfamilienhaus'], ['GEW', 'Gewerbeobjekt']];
  var GRUND_PFLICHT = ['kp', 'nkm', 'wfl', 'art', 'ek_eur', 'zins_pct', 'tilg_pct', 'bindung_j'];
  function grundFehlt(g) {
    g = g || {};
    var f = GRUND_PFLICHT.filter(function (k) {
      var v = g[k]; if (k === 'art') return !/^(ETW|EFH|ZFH|DHH|RH|MFH|GEW)$/.test(String(v || ''));
      if (!istZahl(v)) return true;
      return (k === 'ek_eur' || k === 'zins_pct') ? Number(v) < 0 : !(Number(v) > 0);
    });
    if (!/^\d{5}$/.test(String(g.plz || '')) && !(String(g.ort || '').trim().length >= 2)) f.push('plz');
    return f;
  }
  /* „250.000“ = Tausenderpunkt, „3,8“ = Komma, „3.8“ bei Prozent = Dezimalpunkt (wie dp2-dealcheck.js zahl()) */
  function zahlAus(v) {
    var s = String(v == null ? '' : v).trim().replace(/\s|€|%|m²/g, '');
    if (!s) return null;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  function feldText(n, st) { return istZahl(n) ? (st ? dez(n, st) : Math.round(n).toLocaleString('de-DE')) : ''; }
  /* einzelcheck-3 · Basis der Grundangaben: die eigene Eingabe (schon einmal bestätigt) oder der Deal-Check */
  function grundBasis() { return S.grund ? { g: S.grund, q: 'eingabe' } : { g: grundVorbelegt(), q: 'dealcheck' }; }
  function grundVorbelegt() {
    if (S.grund) return S.grund;
    var g = {}, dc = window.DpDealCheck && DpDealCheck.letztes ? DpDealCheck.letztes() : null;
    var dom = function (id) { var e = document.getElementById(id); return e ? zahlAus(e.value) : null; };
    if (dc) {
      if (dc.kp > 0) g.kp = dc.kp; if (dc.nkm > 0) g.nkm = dc.nkm; if (dc.ze > 0) g.ze = dc.ze;
      if (dc.zins >= 0) g.zins_pct = dc.zins; if (dc.tilg > 0) g.tilg_pct = dc.tilg; if (dc.bindung > 0) g.bindung_j = dc.bindung;
      if (dc.ek >= 0) g.ek_eur = dc.ek; if (dc.nkPct > 0) g.nk_pct = dc.nkPct;
    }
    var plzEl = document.getElementById('dcPlz'); if (plzEl && /^\d{5}$/.test(plzEl.value)) g.plz = plzEl.value;
    var w = dom('dcWfl'); if (w > 0) g.wfl = w;
    var b = dom('dcBj'); if (b >= 1500 && b <= 2100) g.bj = Math.round(b);
    return g;
  }
  /* einzelcheck-3 · Felder, die eine Unterlage vorbelegen kann, mit Art des Vergleichs */
  var VORBELEGBAR = { kp: 'eur', nkm: 'eur', wfl: 'qm', ze: 'eur', bj: 'jahr', gsfl: 'qm', mea_pct: 'pct', nk_pct: 'pct', plz: 'text', ort: 'text', art: 'art' };
  var AUS_ART = { 'Exposé': 'dem Exposé', 'Mietaufstellung': 'der Mietaufstellung', 'Marktbericht': 'dem Marktbericht', 'Energieausweis': 'dem Energieausweis',
    'Wirtschaftsplan': 'dem Wirtschaftsplan', 'WEG-Protokoll': 'dem WEG-Protokoll', 'Mietvertrag': 'dem Mietvertrag', 'Teilungserklärung': 'der Teilungserklärung' };
  function ausText(art) { return 'aus ' + (AUS_ART[art] || 'den Unterlagen'); }
  function gleich(art, a, b) {
    if (art === 'text' || art === 'art') return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
    return Math.abs(Number(a) - Number(b)) <= Math.max(0.5, Math.abs(Number(a)) * 0.005);
  }
  function wertText(art, w) {
    if (art === 'eur') return eur(w); if (art === 'qm') return dez(w, w % 1 ? 1 : 0) + ' m²'; if (art === 'pct') return dez(w, 2) + ' %';
    if (art === 'jahr') return String(Math.round(w));
    if (art === 'art') { var a = ART_LISTE.filter(function (y) { return y[0] === w; })[0]; return a ? a[1] : String(w); }
    return String(w);
  }
  function feldWertForm(art, w) { return art === 'jahr' ? String(Math.round(w)) : art === 'pct' ? feldText(w, 2) : art === 'qm' ? feldText(w, w % 1 ? 1 : 0) : art === 'eur' ? feldText(w) : String(w); }
  /* Je Feld: Wert, Herkunft und ob Unterlage und Angabe sich widersprechen */
  function vorbelegung() {
    var basis = grundBasis(), g = basis.g || {}, z = (S.frei && S.frei.zahlen) || {}, her = S.herkunft || {};
    var werte = {}, quelle = {}, konflikt = {};
    Object.keys(g).forEach(function (k) { if (g[k] != null && g[k] !== '') { werte[k] = g[k]; quelle[k] = basis.q; } });
    Object.keys(VORBELEGBAR).forEach(function (k) {
      var u = z[k]; if (u == null || u === '') return;
      if (werte[k] == null || werte[k] === '') { werte[k] = u; quelle[k] = her[k] || 'Unterlagen'; return; }
      if (!gleich(VORBELEGBAR[k], werte[k], u)) konflikt[k] = { a: werte[k], aq: basis.q, b: u, bq: her[k] || 'Unterlagen' };
    });
    return { werte: werte, quelle: quelle, konflikt: konflikt };
  }
  function quelleText(q) { return q === 'eingabe' ? 'deine Angabe' : q === 'dealcheck' ? 'aus deinem Deal-Check' : ausText(q); }
  function zeigeGrund(hinweis) {
    stufe(2); ++schritt;
    var vb = vorbelegung(), g = vb.werte, offen = {};
    Object.keys(vb.konflikt).forEach(function (k) { offen[k] = true; });
    var IDS = { kp: 'ecgKp', nkm: 'ecgNkm', wfl: 'ecgWfl', art: 'ecgArt', plz: 'ecgPlz', ort: 'ecgOrt', ze: 'ecgZe', bj: 'ecgBj', gsfl: 'ecgGsfl', mea_pct: 'ecgMea',
      ek_eur: 'ecgEk', nk_pct: 'ecgNk', zins_pct: 'ecgZins', tilg_pct: 'ecgTilg', bindung_j: 'ecgBind' };
    var pflicht = function (k) { return GRUND_PFLICHT.indexOf(k) >= 0 || k === 'plz'; };
    /* Zeile unter dem Feld: Herkunft, „fehlt“ oder die Wahl bei Widerspruch */
    var unter = function (k) {
      var kf = vb.konflikt[k];
      if (kf) {
        var art = VORBELEGBAR[k];
        return '<div class="ec-wahl" data-k="' + k + '"><small>Deine Unterlagen sagen etwas anderes. Welcher Wert gilt?</small>'
          + '<button type="button" class="ec-wahl-a" data-v="' + esc(kf.a) + '">' + esc(wertText(art, kf.a)) + ' <em>' + esc(quelleText(kf.aq)) + '</em></button>'
          + '<button type="button" class="ec-wahl-b" data-v="' + esc(kf.b) + '">' + esc(wertText(art, kf.b)) + ' <em>' + esc(quelleText(kf.bq)) + '</em></button></div>';
      }
      if (g[k] != null && g[k] !== '' && vb.quelle[k] && vb.quelle[k] !== 'eingabe') return '<small class="ec-her' + (vb.quelle[k] === 'dealcheck' ? '' : ' doc') + '">' + esc(quelleText(vb.quelle[k])) + '</small>';
      if ((g[k] == null || g[k] === '') && pflicht(k) && !(k === 'plz' && g.ort)) return '<small class="ec-her fehlt">fehlt, bitte ergänzen</small>';
      return '';
    };
    var f = function (id, k, label, wert, opt) {
      opt = opt || {};
      var leer = (g[k] == null || g[k] === '') && pflicht(k) && !(k === 'plz' && g.ort);
      return '<label class="ec-f' + (opt.breit ? ' breit' : '') + (leer ? ' fehlt' : '') + (vb.konflikt[k] ? ' wahl' : '') + '"><span>' + esc(label) + (opt.frei ? ' <em>optional</em>' : '') + '</span>'
        + '<div class="ec-ein"><input id="' + id + '" inputmode="' + (opt.text ? 'text' : 'decimal') + '" value="' + esc(wert) + '"' + (opt.ph ? ' placeholder="' + esc(opt.ph) + '"' : '')
        + (opt.max ? ' maxlength="' + opt.max + '"' : '') + ' autocomplete="off">' + (opt.einheit ? '<i>' + esc(opt.einheit) + '</i>' : '') + '</div>' + unter(k) + '</label>';
    };
    var artLeer = !g.art;
    var art = '<label class="ec-f' + (artLeer ? ' fehlt' : '') + (vb.konflikt.art ? ' wahl' : '') + '"><span>Objektart</span><select id="ecgArt"><option value="">Bitte wählen</option>'
      + ART_LISTE.map(function (a) { return '<option value="' + a[0] + '"' + (g.art === a[0] ? ' selected' : '') + '>' + a[1] + '</option>'; }).join('') + '</select>' + unter('art') + '</label>';
    var bind = '<label class="ec-f"><span>Zinsbindung</span><select id="ecgBind">' + [5, 10, 15, 20, 25, 30].map(function (j) {
      return '<option value="' + j + '"' + ((g.bindung_j || 10) === j ? ' selected' : '') + '>' + j + ' Jahre</option>'; }).join('') + '</select></label>';
    var strasse = S.adresse ? String(S.adresse).split(',')[0] : '';
    /* Kopf: was die Unterlagen gefüllt haben, was fehlt, wo zu wählen ist */
    var ausDok = Object.keys(vb.quelle).filter(function (k) { return vb.quelle[k] !== 'eingabe' && vb.quelle[k] !== 'dealcheck' && !vb.konflikt[k]; }).length;
    var fehltJetzt = grundFehlt(g), NAMEN = { kp: 'Kaufpreis', nkm: 'Kaltmiete', wfl: 'Wohnfläche', art: 'Objektart', plz: 'Postleitzahl oder Ort', ek_eur: 'Eigenkapital', zins_pct: 'Sollzins', tilg_pct: 'Tilgung', bindung_j: 'Zinsbindung' };
    var nWahl = Object.keys(vb.konflikt).length;
    var lead = S.frei ? (ausDok ? ausDok + (ausDok === 1 ? ' Angabe stammt' : ' Angaben stammen') + ' aus deinen Unterlagen.' : 'Aus deinen Unterlagen ließ sich keine Grundangabe ablesen.') : 'Ohne Unterlagen rechnet der Bericht mit diesen Angaben.';
    var stand = '<ul class="ec-stand">'
      + (fehltJetzt.length ? '<li class="fehlt"><b>Es fehlt noch:</b> ' + esc(fehltJetzt.map(function (k) { return NAMEN[k]; }).join(', ')) + '</li>' : '<li class="ok"><b>Alle Pflichtangaben sind da.</b></li>')
      + (nWahl ? '<li class="wahl"><b>' + nWahl + (nWahl === 1 ? ' Angabe weicht' : ' Angaben weichen') + ' ab.</b> Bitte am Feld wählen, welcher Wert gilt.</li>' : '') + '</ul>';
    var z = (S.frei && S.frei.zahlen) || {};
    var VF = { vergleichswert: 'Vergleichswert', ertragswert: 'Ertragswert', sachwert: 'Sachwert', marktpreisindikation: 'Marktpreisindikation', verkehrswert: 'Verkehrswert' };
    var wertInfo = (z.wert_bericht > 0 || z.mpi_bericht > 0) ? '<p class="ec-wertinfo"><b>Laut deinem Marktbericht</b>'
      + (z.wert_bericht > 0 ? (VF[z.wert_verfahren] || 'Wert') + (z.wert_verfahren && z.wert_verfahren !== 'verkehrswert' ? ', führend' : '') + ' ' + eur(z.wert_bericht) : '')
      + (z.wert_bericht > 0 && z.mpi_bericht > 0 ? ' · ' : '') + (z.mpi_bericht > 0 ? 'Marktpreisindikation ' + eur(z.mpi_bericht) : '')
      + '. Das sind Werte, kein Kaufpreis. Der Bericht ermittelt den Wert neu.</p>' : '';
    setze('<h3 id="ecTitel">Prüf und ergänz die Grundangaben.</h3>'
      + '<p class="ec-lead">' + esc(lead) + ' Damit rechnet der Bericht. Eine Anschrift brauchst du nicht.</p>'
      + (hinweis ? meldung(hinweis, 'warn') : '') + stand
      + '<form class="ec-grund" novalidate><fieldset><legend>Objekt</legend><div class="ec-raster">'
      + art + f('ecgKp', 'kp', 'Kaufpreis', feldText(g.kp), { einheit: '€' }) + f('ecgNkm', 'nkm', 'Kaltmiete im Monat', feldText(g.nkm), { einheit: '€' })
      + f('ecgWfl', 'wfl', 'Wohnfläche', feldText(g.wfl, g.wfl % 1 ? 1 : 0), { einheit: 'm²' }) + f('ecgPlz', 'plz', 'Postleitzahl', g.plz || '', { text: 1, max: 5, ph: '12345' })
      + f('ecgOrt', 'ort', 'Ort', g.ort || '', { text: 1, frei: 1, ph: 'wenn ohne PLZ' })
      + f('ecgZe', 'ze', 'Zusatzeinnahmen im Monat', feldText(g.ze), { einheit: '€', frei: 1, ph: 'Stellplatz, Küche' }) + f('ecgBj', 'bj', 'Baujahr', g.bj ? String(Math.round(g.bj)) : '', { frei: 1, max: 4 })
      + f('ecgGsfl', 'gsfl', 'Grundstücksfläche', feldText(g.gsfl), { einheit: 'm²', frei: 1, ph: 'bei Häusern' }) + f('ecgMea', 'mea_pct', 'Miteigentumsanteil', feldText(g.mea_pct, 2), { einheit: '%', frei: 1, ph: 'bei Wohnungen' })
      + f('ecgStr', 'strasse', 'Straße und Hausnummer', strasse, { text: 1, frei: 1, breit: 1, ph: 'nur für den Bodenrichtwert, wird nicht gespeichert' })
      + '</div>' + wertInfo + '</fieldset><fieldset><legend>Finanzierung</legend><div class="ec-raster">'
      + f('ecgEk', 'ek_eur', 'Eigenkapital', feldText(g.ek_eur), { einheit: '€' }) + f('ecgNk', 'nk_pct', 'Kaufnebenkosten', feldText(g.nk_pct != null ? g.nk_pct : 10, 1), { einheit: '%' })
      + f('ecgZins', 'zins_pct', 'Sollzins', feldText(g.zins_pct, 2), { einheit: '%' }) + f('ecgTilg', 'tilg_pct', 'Tilgung im Jahr', feldText(g.tilg_pct != null ? g.tilg_pct : 1.5, 2), { einheit: '%' }) + bind
      + '</div><p class="ec-fein">Das Darlehen ist Kaufpreis plus Nebenkosten minus Eigenkapital. Nach der Zinsbindung rechnet der Bericht die Anschlussfinanzierung mit ' + dez(ANSCHLUSS_ZINS, 1) + ' % Zins und derselben Tilgung.</p></fieldset>'
      + '<div class="ec-knoepfe"><button type="button" class="btn-l ec-zurueck">Unterlagen ändern</button><button type="submit" class="btn-p ec-weiter">Weiter zum Ergebnis</button></div></form>', 'h3');
    /* Wahl bei Widerspruch: ein Klick setzt den Wert ins Feld, eigenes Tippen gilt ebenfalls als Wahl */
    $$('.ec-wahl', inhalt).forEach(function (w) {
      var k = w.dataset.k, el = document.getElementById(IDS[k]);
      $$('button', w).forEach(function (b) { b.addEventListener('click', function () {
        var v = b.dataset.v;
        if (el) el.value = (k === 'art' || VORBELEGBAR[k] === 'text') ? v : feldWertForm(VORBELEGBAR[k], Number(v));
        $$('button', w).forEach(function (x) { x.classList.toggle('an', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        delete offen[k]; if (w.parentNode) w.parentNode.classList.remove('wahl'); standWahl();
      }); });
      if (el) el.addEventListener(k === 'art' ? 'change' : 'input', function () { delete offen[k]; if (w.parentNode) w.parentNode.classList.remove('wahl'); standWahl(); });
    });
    /* Zeile oben nachziehen, sobald gewählt ist */
    function standWahl() {
      var li = $('.ec-stand li.wahl', inhalt); if (!li) return;
      var n = Object.keys(offen).length;
      if (n) li.innerHTML = '<b>' + n + (n === 1 ? ' Angabe weicht' : ' Angaben weichen') + ' ab.</b> Bitte am Feld wählen, welcher Wert gilt.';
      else { li.className = 'ok'; li.innerHTML = '<b>Gewählt.</b> Es gilt der Wert, der im Feld steht.'; }
    }
    $('.ec-zurueck', inhalt).addEventListener('click', function () { S.ohneUnterlagen = false; zeigeUnterlagen(); });
    $('.ec-grund', inhalt).addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (id) { var x = document.getElementById(id); return x ? x.value : ''; };
      var n = { art: v('ecgArt'), kp: zahlAus(v('ecgKp')), nkm: zahlAus(v('ecgNkm')), wfl: zahlAus(v('ecgWfl')), plz: String(v('ecgPlz')).replace(/\D/g, '').slice(0, 5),
        ort: String(v('ecgOrt')).trim().slice(0, 60), ze: zahlAus(v('ecgZe')), bj: zahlAus(v('ecgBj')), gsfl: zahlAus(v('ecgGsfl')), mea_pct: zahlAus(v('ecgMea')),
        ek_eur: zahlAus(v('ecgEk')), nk_pct: zahlAus(v('ecgNk')), zins_pct: zahlAus(v('ecgZins')), tilg_pct: zahlAus(v('ecgTilg')), bindung_j: zahlAus(v('ecgBind')) };
      Object.keys(n).forEach(function (k) { if (n[k] === null || n[k] === '') delete n[k]; });
      var m = $('.ec-grund-m', inhalt); if (!m) { m = document.createElement('p'); m.className = 'ec-meldung warn ec-grund-m'; m.setAttribute('role', 'alert'); $('.ec-knoepfe', inhalt).before(m); }
      /* nie still überschreiben: erst weiter, wenn bei jedem Widerspruch gewählt ist */
      var nochOffen = Object.keys(offen);
      if (nochOffen.length) {
        var LANG = { kp: 'Kaufpreis', nkm: 'Kaltmiete', wfl: 'Wohnfläche', art: 'Objektart', plz: 'Postleitzahl', ort: 'Ort', ze: 'Zusatzeinnahmen', bj: 'Baujahr', gsfl: 'Grundstücksfläche', mea_pct: 'Miteigentumsanteil', nk_pct: 'Kaufnebenkosten' };
        m.textContent = 'Bitte wähle noch, welcher Wert gilt: ' + nochOffen.map(function (k) { return LANG[k] || k; }).join(', ') + '.';
        var w0 = $('.ec-wahl[data-k="' + nochOffen[0] + '"] button', inhalt); if (w0) try { w0.focus(); } catch (x) {}
        return;
      }
      var fehlt = grundFehlt(n);
      $$('.ec-f', inhalt).forEach(function (l) { l.classList.remove('fehlt'); });
      if (fehlt.length) {
        fehlt.forEach(function (k) { var x = document.getElementById(IDS[k]); if (x && x.parentNode) x.parentNode.classList.add('fehlt'); });
        m.textContent = 'Bitte noch eintragen: ' + fehlt.map(function (k) { return NAMEN[k]; }).join(', ') + '.';
        var erst = document.getElementById(IDS[fehlt[0]]); if (erst) try { erst.focus(); } catch (x) {}
        return;
      }
      S.grund = n; S.abweichungen = [];
      var str = String(v('ecgStr')).trim().slice(0, 100);
      S.adresse = str.length >= 3 ? str + ', ' + [n.plz, n.ort].filter(Boolean).join(' ') : '';
      zeigeErgebnis();
    });
  }
  function grundKurz(g) {
    var a = ART_LISTE.filter(function (x) { return x[0] === g.art; })[0];
    return [(a ? a[1] : ''), g.wfl ? dez(g.wfl, g.wfl % 1 ? 1 : 0) + ' m²' : '', [g.plz, g.ort].filter(Boolean).join(' '), g.kp ? 'Kaufpreis ' + eur(g.kp) : ''].filter(Boolean).join(', ')
      + '. Finanzierung mit ' + eur(g.ek_eur || 0) + ' Eigenkapital, ' + dez(g.zins_pct, 2) + ' % Zins, ' + dez(g.tilg_pct, 2) + ' % Tilgung, ' + g.bindung_j + ' Jahre Zinsbindung.';
  }

  /* 1 · Unterlagen wählen ─────────────────────────────────────────── */
  function zeigeUnterlagen(hinweis) {
    stufe(0); ++schritt;   /* einzelcheck-3 · zuerst die Unterlagen, die Grundangaben kommen nach dem Auslesen */
    var liste = S.dateien.map(function (f, i) {
      return '<li class="ec-dok' + (i < INFO.frei_max ? ' frei' : '') + '"><span class="ec-dok-i" aria-hidden="true"></span><span class="ec-dok-t"><b>' + esc(artRaten(f.name)) + '</b><small>' + esc(f.name) + ' · ' + mb(f.size) + '</small></span>'
        + '<span class="ec-dok-m">' + (i < INFO.frei_max ? 'kostenlos' : 'im Bericht') + '</span>'
        + (i > 0 ? '<button type="button" class="ec-hoch" data-i="' + i + '" aria-label="' + esc(f.name) + ' nach oben">↑</button>' : '')
        + '<button type="button" class="ec-entf" data-i="' + i + '" aria-label="' + esc(f.name) + ' entfernen">×</button></li>';
    }).join('');
    setze('<h3 id="ecTitel">Erst die Unterlagen. DealPilot liest sie aus und füllt die Grundangaben vor.</h3>'
      + '<p class="ec-lead">Zum Beispiel Exposé, Mietaufstellung, Marktbericht, WEG-Protokoll und Energieausweis. Die ersten zwei liest DealPilot kostenlos, alle vier liest der Bericht. Danach siehst du, was noch fehlt.</p>'
      + (hinweis ? meldung(hinweis, 'warn') : '')
      + '<label class="ec-ablage-zone"><input type="file" class="ec-datei" accept="application/pdf,.pdf" multiple' + (S.dateien.length >= INFO.voll_max ? ' disabled' : '') + '>'
      + '<span><b>PDF auswählen</b> oder hierher ziehen<br><small>Höchstens ' + INFO.voll_max + ' Dateien, je bis ' + INFO.max_mb + ' MB</small></span></label>'
      + (liste ? '<ol class="ec-ablage">' + liste + '</ol>' : '')
      + SCHUTZ
      + '<div class="ec-knoepfe"><button type="button" class="btn-l ec-ohne">Ohne Unterlagen weiter</button><button type="button" class="btn-p ec-los"' + (S.dateien.length ? '' : ' disabled') + '>Kostenlos auslesen</button></div>', S.dateien.length ? '.ec-los' : 'h3');
    var inp = $('.ec-datei', inhalt), zone = $('.ec-ablage-zone', inhalt);
    inp.addEventListener('change', function () { dazu(inp.files); });
    ['dragover', 'dragenter'].forEach(function (t) { zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('ueber'); }); });
    ['dragleave', 'drop'].forEach(function (t) { zone.addEventListener(t, function () { zone.classList.remove('ueber'); }); });
    zone.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer) dazu(e.dataTransfer.files); });
    $$('.ec-entf', inhalt).forEach(function (b) { b.addEventListener('click', function () { S.dateien.splice(+b.dataset.i, 1); S.frei = null; zeigeUnterlagen(); }); });
    $$('.ec-hoch', inhalt).forEach(function (b) { b.addEventListener('click', function () { var i = +b.dataset.i, x = S.dateien[i]; S.dateien[i] = S.dateien[i - 1]; S.dateien[i - 1] = x; S.frei = null; zeigeUnterlagen(); }); });
    $('.ec-los', inhalt).addEventListener('click', zeigeAuslesen);
    $('.ec-ohne', inhalt).addEventListener('click', function () { S.ohneUnterlagen = true; S.frei = null; S.herkunft = {}; zeigeGrund(); });
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
    S.frei = null; S.herkunft = {};
    zeigeUnterlagen(fehler.length ? fehler.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' ') : null);
  }
  function formular(dateien, token) {
    var fd = new FormData();
    if (token) fd.append('token', token);
    /* v3946 · Grundangaben (Pflicht, der Server prüft sie) und die freiwillige Anschrift (nur für den Bericht) */
    if (S.grund) fd.append('grund', JSON.stringify(S.grund));
    if (token && S.adresse) fd.append('adresse', S.adresse);
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
      S.frei = j; S.herkunft = j.herkunft || {}; S.ohneUnterlagen = false;
      zeigeGrund();   /* einzelcheck-3 · erst auslesen, dann die Grundangaben mit dem, was die Unterlagen wissen */
    }).catch(function () { if (nr === schritt) zeigeUnterlagen('Keine Verbindung. Bitte noch einmal versuchen.'); });
  }

  /* ── Rechnen: nur die Kerne der Startseite ─────────────────────────── */
  /* v3946 · Die Unterlagen ergänzen, was in den Grundangaben leer ist (Baujahr, Grundstück, Ort …). Weichen
     Pflichtwerte ab, gilt die Eingabe, und das Ergebnis zeigt die Abweichung mit „übernehmen“. */
  var ABGLEICH = [['kp', 'Kaufpreis', 'eur'], ['nkm', 'Kaltmiete im Monat', 'eur'], ['wfl', 'Wohnfläche', 'qm'], ['art', 'Objektart', 'text']];
  var ERGAENZBAR = ['bj', 'gsfl', 'plz', 'ort', 'ze', 'nk_pct', 'mea_pct'];
  function ergaenzen(z) {
    if (!S.grund) return;
    ERGAENZBAR.forEach(function (k) { if ((S.grund[k] == null || S.grund[k] === '') && z[k] != null && z[k] !== '') S.grund[k] = z[k]; });
    S.abweichungen = ABGLEICH.filter(function (f) {
      var a = S.grund[f[0]], b = z[f[0]];
      if (b == null || b === '' || a == null) return false;
      if (f[2] === 'text') return String(a) !== String(b);
      return Math.abs(Number(a) - Number(b)) > Math.max(0.5, Math.abs(Number(a)) * 0.005);
    }).map(function (f) { return { feld: f[0], name: f[1], art: f[2], deins: S.grund[f[0]], unterlagen: z[f[0]] }; });
  }
  function abweichungText(x, w) {
    if (x.art === 'eur') return eur(w); if (x.art === 'qm') return dez(w, w % 1 ? 1 : 0) + ' m²';
    var a = ART_LISTE.filter(function (y) { return y[0] === w; })[0]; return a ? a[1] : String(w);
  }
  function eingaben(z) {
    var dc = window.DpDealCheck && DpDealCheck.letztes ? DpDealCheck.letztes() : null;
    var herkunft = {};
    /* v3946 · Grundangaben sind Pflicht und gelten vor allem anderen (der Käufer hat sie bestätigt) */
    var g = S.grund;
    if (g && !grundFehlt(g).length) {
      return { kp: g.kp, nkm: g.nkm, ze: g.ze > 0 ? g.ze : (z.ze > 0 ? z.ze : 0), zins: g.zins_pct, tilg: g.tilg_pct, bindung: g.bindung_j,
        nkPct: g.nk_pct > 0 ? g.nk_pct : (z.nk_pct > 0 ? z.nk_pct : 10), ek: g.ek_eur, herkunft: { kp: 'eingabe', nkm: 'eingabe' }, dc: !!dc, grund: true };
    }
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
    var nk = e.kp * e.nkPct / 100, ek = e.grund ? e.ek : Math.round(e.kp * 0.10), d1 = Math.max(0, e.kp + nk - ek);
    var mitBwk = z && z.bwk_nul_jahr != null;
    var bwkNul = mitBwk ? z.bwk_nul_jahr : e.nkm * 12 * 0.17;   /* ohne Wirtschaftsplan: dieselbe Annahme wie der Deal-Check */
    var k = DealKpis.compute({ kp: e.kp, nk: nk, nkm: e.nkm, ze: e.ze, uf: 0, bwk_ul: 0, bwk_nul: bwkNul, d1: d1, d1z: e.zins, d1t: e.tilg, ek: ek });
    var ds = DealScore.computeFromKpis({ kp: e.kp, cf_m: k.cf_m, nmy: k.nmy, ltv: k.ltv, dscr: k.dscr, wp_kpi: e.kp * 0.05, mstg: 1.5,
      darlehen: (k.d_total != null && isFinite(k.d_total)) ? k.d_total : null });
    return { e: e, k: k, ds: ds, st: ScoreTier.stufe(ds.score), nk: nk, ek: ek, d1: d1, bwkNul: bwkNul, mitBwk: mitBwk };
  }
  function kundenSatz(t) { return String(t || '').replace(/\s*[—–]\s*/g, ', ').replace(/;/g, ','); }
  function annahmeText(r) {
    return (r.e.grund ? 'Finanzierung aus deinen Grundangaben: ' + eur(r.ek) + ' Eigenkapital, Darlehen ' + eur(r.d1) + ', Nebenkosten ' : 'Finanzierung wie im Deal-Check: ' + eur(r.ek) + ' Eigenkapital (10 %), Nebenkosten ') + dez(r.e.nkPct, 1) + ' %, '
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
  var GRUND = { kein_text: 'kein lesbarer Text, auch die Texterkennung fand keinen', kein_pdf: 'kein PDF', zu_gross: 'größer als 10 MB', mieter_unterlagen: 'persönliche Unterlagen eines Mieters, nicht ausgelesen',
    ki_fehler: 'nicht lesbar, bitte noch einmal versuchen', ki_unlesbar: 'nicht auswertbar', nicht_lesbar: 'nicht lesbar', im_bericht: 'liest der Bericht' };

  /* 3 · Ergebnis: grobe Einschätzung, Kauf, Pakete ─────────────────── */
  function zeigeErgebnis(hinweis) {
    stufe(3); ++schritt;
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
      kern = '<p class="ec-lead">' + (r ? 'Es fehlt ' + fehlt + '. Trag ' + fehlt + ' in den Grundangaben ein, dann rechnet die Einschätzung mit.' : 'Die Rechenkerne sind gerade nicht geladen. Lade die Seite neu.') + '</p>';
    }
    var gelesen = FELD.map(function (f) { var w = feldWert(z, f); return w ? '<li><span>' + esc(f[1]) + (S.herkunft && S.herkunft[f[0]] ? ' <small>' + esc(ausText(S.herkunft[f[0]])) + '</small>' : '') + '</span><b>' + esc(w) + '</b></li>' : ''; }).join('');
    var dok = (j.unterlagen || []).map(function (u) {
      return '<li><b>' + esc(u.art) + '</b> ' + (u.gelesen ? 'gelesen' + (u.texterkennung ? ' per Texterkennung' : '') + (u.geschwaerzt ? ', ' + u.geschwaerzt + ' Stellen geschwärzt' : '') : esc(GRUND[u.grund] || 'nicht gelesen')) + '</li>';
    }).concat(S.dateien.slice(INFO.frei_max).map(function (f) { return '<li><b>' + esc(artRaten(f.name)) + '</b> liest der Bericht</li>'; })).join('');
    var risiken = 0; (j.unterlagen || []).forEach(function (u) { risiken += (u.risiken || []).length; });
    /* v3946 · Abweichungen zwischen Grundangaben und Unterlagen, die Eingabe gilt, bis der Käufer übernimmt */
    var abw = (S.abweichungen || []).length ? '<div class="ec-abw"><span class="ec-l">Abweichung zu deinen Grundangaben</span><ul>'
      + S.abweichungen.map(function (x, i) { return '<li><span>' + esc(x.name) + ': du ' + esc(abweichungText(x, x.deins)) + ', Unterlagen ' + esc(abweichungText(x, x.unterlagen))
        + '</span><button type="button" class="btn-l ec-uebern" data-i="' + i + '">Wert aus den Unterlagen übernehmen</button></li>'; }).join('')
      + '</ul><p class="ec-fein">Gerechnet wird mit deiner Angabe, bis du übernimmst.</p></div>' : '';
    var kurz = S.grund ? '<div class="ec-grund-kurz"><span class="ec-l">Deine Grundangaben</span><p>' + esc(grundKurz(S.grund)) + '</p><button type="button" class="btn-l ec-grund-aendern">Ändern</button></div>' : '';
    setze('<h3 id="ecTitel">Deine Daten stehen bereit.</h3>' + (hinweis ? meldung(hinweis, 'warn') : '') + abw + kurz + kern
      + '<div class="ec-zwei"><div><span class="ec-l">Ausgelesen</span><ul class="ec-felder an">' + (gelesen || '<li><span>Keine Kennzahl gefunden</span><b></b></li>') + '</ul></div>'
      + '<div><span class="ec-l">Unterlagen</span><ul class="ec-dokliste">' + dok + '</ul>' + (risiken ? '<p class="ec-fein">' + risiken + (risiken === 1 ? ' Hinweis' : ' Hinweise') + ' auf Risiken stehen im Bericht.</p>' : '') + '</div></div>'
      + kaufBox()
      + '<div class="ec-pakete"><span class="ec-l">Oder gleich weitermachen</span><p class="ec-fein">Mit einem Paket legst du das Objekt mit diesen Zahlen in DealPilot an.</p><div class="ec-pk"></div></div>', 'h3');
    paketeEinsetzen($('.ec-pk', inhalt), z, r, null);
    kaufVerdrahten();
    var ga = $('.ec-grund-aendern', inhalt); if (ga) ga.addEventListener('click', function () { zeigeGrund(); });
    $$('.ec-uebern', inhalt).forEach(function (b) { b.addEventListener('click', function () {
      var x = S.abweichungen[+b.dataset.i]; if (!x || !S.grund) return;
      S.grund[x.feld] = x.unterlagen; S.abweichungen.splice(+b.dataset.i, 1); zeigeErgebnis();
    }); });
  }
  function kaufBox() {
    if (!(INFO.amount_cents > 0)) return '<div class="ec-weg ec-weg-1"><b>Bericht</b><p>Der Bericht ist gerade nicht kaufbar. Bitte später noch einmal.</p></div>';
    return '<div class="ec-weg ec-weg-1"><span class="ec-l">Der komplette Bericht</span><b>Alle ' + Math.max(S.dateien.length, 1) + ' Unterlagen, Wertermittlung, Finanzierung und Marktbericht als PDF</b>'
      + '<p>Bodenrichtwert, Ertrags-, Sach- und Vergleichswert mit dem führenden Verfahren, Finanzierung mit Restschuld und Anschlussfinanzierung, Investor Deal Score, Cashflow und DSCR, Mietpotenzial, Lage und Markt.</p>'
      + '<div class="ec-preis">' + esc(preisText()) + '<small>einmalig, kein Abo</small></div>'
      + '<p class="ec-fein">Buchst du innerhalb von ' + INFO.frist_tage + ' Tagen ein Paket, rechnet DealPilot den Betrag an.</p>'
      + '<label class="ec-haken"><input type="checkbox" class="ec-widerruf"> <span>Ich verlange ausdrücklich, dass DealPilot den Bericht sofort erstellt. Mir ist bekannt, dass mein Widerrufsrecht damit erlischt (§ 356 Abs. 5 BGB).</span></label>'
      + '<button type="button" class="btn-p ec-kaufen" disabled>Bericht kaufen · ' + esc(preisText()) + '</button>'
      + '<p class="ec-fein">Bezahlt wird bei Stripe. Danach kommst du hierher zurück und dein Bericht entsteht sofort, ohne dass du etwas noch einmal hochlädst.</p></div>';
  }
  function kaufVerdrahten() {
    var h = $('.ec-widerruf', inhalt), b = $('.ec-kaufen', inhalt);
    if (!h || !b) return;
    h.addEventListener('change', function () { b.disabled = !h.checked; });
    b.addEventListener('click', kaufen);
  }

  /* Kauf · v3946: im SELBEN Tab. Vorher legt der Browser Dateien und Angaben auf dem Gerät ab (ablage), nach der
     Rückkehr startet der Bericht von selbst. Bis v3945 öffnete Stripe ein zweites Fenster, dort fehlten die Dateien. */
  function kaufen() {
    var b = $('.ec-kaufen', inhalt); if (b) { b.disabled = true; b.textContent = 'Kasse wird vorbereitet …'; }
    var j = S.frei || {};
    holeJson(api('/kaufen'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zahlen: j.zahlen || {}, siegel: j.siegel || '', grund: S.grund || {}, widerruf_verzicht: true }) })
      .then(function (r) {
        if (!r._ok || !r.url || !r.token) { zeigeErgebnis(r.error || 'Die Kasse ist gerade nicht erreichbar.'); return; }
        tokenMerken(r.token);
        var weiter = function () { location.href = r.url; };
        /* ohne Ablage (privates Fenster) geht es trotzdem weiter: dann rechnet der Bericht mit den gespeicherten Zahlen */
        ablage.schreiben(ablageAus(r.token)).then(weiter, weiter);
      })
      .catch(function () { zeigeErgebnis('Keine Verbindung zur Kasse.'); });
  }

  /* 3b · Warten auf die Zahlung ─────────────────────────────────────── */
  function zeigeWarten(text) {
    stufe(4); var nr = ++schritt;
    setze('<h3 id="ecTitel">Die Zahlung wird bestätigt.</h3><p class="ec-lead">' + esc(text || 'Sobald Stripe die Zahlung meldet, liest DealPilot hier alle Unterlagen und baut deinen Bericht. Das dauert meist nur Sekunden.') + '</p>'
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

  /* 4 · Bericht erstellen ───────────────────────────────────────────── */
  function erstelleBericht() {
    stufe(4); var nr = ++schritt;
    clearTimeout(S.abfrage);
    var t = tokenLesen();
    setze('<h3 id="ecTitel">Zahlung erhalten. Dein Bericht entsteht.</h3><p class="ec-lead">' + (S.dateien.length ? 'DealPilot liest alle ' + S.dateien.length + ' Unterlagen und holt Lage und Markt. Das dauert bis zu drei Minuten.' : 'DealPilot rechnet mit den gespeicherten Zahlen und holt Lage und Markt.') + '</p>'
      + '<div class="ec-lesen"><div class="ec-zeile an liest"><div class="ec-z-kopf"><b>Bericht</b><span class="ec-z-st">entsteht</span></div><span class="ec-balken"><i style="width:100%"></i></span></div></div>', 'h3');
    Promise.all([holeJson(api('/bericht'), { method: 'POST', body: formular(S.dateien.slice(0, INFO.voll_max), t) }), lade('DpDokument'), lade('DpMietpotenzial'), kappungsDaten(),
      lade('DealScore2'), lade('DpDarlehenWeitere')])
      .then(function (x) {
        if (nr !== schritt) return;
        var j = x[0];
        if (!j._ok) { zeigeRueckkehr(j.code === 'berichte_aufgebraucht' ? 'Für diesen Kauf sind alle Berichte erstellt.' : (j.error || 'Der Bericht konnte nicht entstehen.')); return; }
        S.bericht = berichtDaten(j, x[3]);
        ablage.loeschen();   /* v3946 · Bericht fertig: die Unterlagen verlassen das Gerät nicht und bleiben nicht liegen */
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
    /* Mietpotenzial: zulässige Bestandsmiete nach drei Jahren und Obergrenze bei Neuvermietung (js/mietpotenzial-kern.js) */
    if (r && r.k && z.wfl > 0 && window.DpMietpotenzial) d.miete = mietpotenzialAus(window.DpMietpotenzial, kappDaten, r.e.nkm, z.wfl, m);
    /* v3946 · Finanzierung wie im Investment-PDF (nur Kerne) */
    if (r && r.k && window.DpDarlehenWeitere && window.Dscr) d.fin = finanzierungAus(r, window.DpDarlehenWeitere, window.DealKpis, window.Dscr, ANSCHLUSS_ZINS);
    return d;
  }

  /* ── v3946 · FINANZIERUNG WIE IM INVESTMENT-PDF ─────────────────────────────────────────────────────────
     Marcel 22.11.2026: „eine Finanzierung mit angeben … Anschlussfinanzierung, die wir einfach auf fünf Prozent
     rechnen mit derselben Tilgung“. Wie das Investment-PDF (dp-dokumente.js phasenVoll/dreiPhasen, calc.js):
       Heute       DealKpis.compute: Rate, Zins und Tilgung im ersten Jahr, Cashflow vor Steuern, DSCR (über Dscr)
       Bindung     DpDarlehenWeitere.monatsplan: Monat für Monat wie calc.js _jahrMonatlich (v3029), Restschuld am
                   Ende der Zinsbindung, Zinsen und Tilgung in der Bindung
       Anschluss   Restschuld × (ANSCHLUSS_ZINS + Tilgung) / 12 wie calc.js (rs × (az + at) / 12), als Darlehen in
                   DealKpis.compute (Cashflow, DSCR bei gleicher Miete) und im Monatsplan bis zur vollen Tilgung
     Cashflow vor Finanzierung = Reinertrag (Dscr.compute noi_netto: Miete minus nicht umlagefähige Kosten).
     Hier steht keine eigene Formel für Zins, Tilgung oder Restschuld. Prüfer: tools/einzelcheck-pruefen.mjs Teil O. */
  function finanzierungAus(r, DW, DK, DS, anschlussZins) {
    var e = r.e, k = r.k, bind = Math.round(e.bindung || 0);
    if (!(r.d1 > 0) || !(bind > 0)) return { ohne_darlehen: !(r.d1 > 0), d1: r.d1, ek: r.ek };
    var rein = DS.compute({ nkm_j: k.nkm_j, ze_j: 0, zins_j: k.zins_j, tilg_j: k.tilg_j, bsv_j: 0, bwk_cf: k.bwk_cf });
    var plan = DW.monatsplan({ betrag: r.d1, zins: e.zins, tilg: e.tilg }, bind * 12);
    var summe = function (l, f) { return l.reduce(function (a, x) { return a + x[f]; }, 0); };
    var rs = plan.length ? plan[plan.length - 1].rs : r.d1;
    var heute = { zins: e.zins, tilg: e.tilg, rate_m: k.rate_j / 12, zins_m: k.zins_j / 12, tilg_m: k.tilg_j / 12,
      cf_vor_m: rein.noi_netto / 12, cf_nach_m: k.cf_m, dscr: k.dscr };
    var bindung = { jahre: bind, rs: rs, zinsen: summe(plan, 'zins'), tilgung: summe(plan, 'tilg'), getilgt_pct: r.d1 > 0 ? (r.d1 - rs) / r.d1 * 100 : 0 };
    var an = null;
    if (rs > 0.5) {
      var ka = DK.compute({ kp: e.kp, nk: r.nk, nkm: e.nkm, ze: e.ze, uf: 0, bwk_ul: 0, bwk_nul: r.bwkNul, d1: rs, d1z: anschlussZins, d1t: e.tilg, ek: r.ek });
      var plan2 = DW.monatsplan({ betrag: rs, zins: anschlussZins, tilg: e.tilg }, 1200);
      var bis = -1; for (var i = 0; i < plan2.length; i++) { if (plan2[i].rs < 0.5) { bis = i + 1; break; } }
      var p10 = plan2[Math.min(plan2.length, 120) - 1];
      an = { zins: anschlussZins, tilg: e.tilg, darlehen: rs, rate_m: ka.rate_j / 12, zins_m: ka.zins_j / 12, tilg_m: ka.tilg_j / 12,
        mehr_m: ka.rate_j / 12 - k.rate_j / 12, cf_nach_m: ka.cf_m, dscr: ka.dscr,
        rs_10: p10 ? p10.rs : null, laufzeit_monate: bis > 0 ? bis : null, gesamt_jahre: bis > 0 ? bind + bis / 12 : null };
    }
    return { d1: r.d1, ek: r.ek, nk: r.nk, gi: e.kp + r.nk, heute: heute, bindung: bindung, anschluss: an };
  }

  /* ── v3944 · OBERGRENZE FÜR INVESTOREN (Marcel 22.11.2026: „Vergleichsmieten angeben und Obergrenze für
     Investoren, was max drin ist.“) ─────────────────────────────────────────────────────────────────────────
     Gerechnet NUR mit js/mietpotenzial-kern.js (kappungAus, mietpreisbremseAus, zulaessig, neuvermietung,
     zielmieteBremse), hier wird nichts nachgebaut:
       Bestand       zulaessig(): Kappungsgrenze, Vergleichsmiete, Sperrfrist (§ 558 BGB) nach drei Jahren
       Neuvermietung gilt die Mietpreisbremse und ist die Vergleichsmiete bekannt: zielmieteBremse().obergrenze_qm
                     (Vergleichsmiete + 10 %, § 556d BGB). Gilt sie nicht oder ist sie offen: die
                     Vergleichsmiete als Richtwert. Ohne Vergleichsmiete: keine Zahl.
     Die Vergleichsmiete kommt vom Server (services/einzelcheck.js vglAus, mb lib/vergleichsmiete_auszug.js):
     Mietspiegel, amtliche Mietpreisübersicht oder DealPilot-Näherung. Kein Treffer heißt kein Wert.
     Prüfer: tools/einzelcheck-pruefen.mjs Teil N (ruft diese Funktionen mit dem echten Kern). */
  var VGL_HERKUNFT = {
    mietspiegel: 'amtliche Mietdaten, Mietspiegel der Gemeinde',
    amtlich: 'amtliche Mietdaten des Gutachterausschusses',
    naeherung: 'Schätzung von DealPilot aus amtlichen Mietdaten der Gemeinde, nicht amtlich'
  };
  function mietpotenzialAus(MP, kappDaten, ist, wfl, m) {
    m = m || {};
    var ort = m.lage && m.lage.ags ? { ags: m.lage.ags } : {};
    var kapp = kappDaten ? MP.kappungAus(kappDaten, ort) : null;
    var kPct = kapp && (kapp.pct === 15 || kapp.pct === 20) && kapp.herkunft !== 'auffang' ? kapp.pct : 15;
    var vg = m.vergleichsmiete && m.vergleichsmiete.qm > 0 ? m.vergleichsmiete : null;
    var vglQm = vg ? vg.qm : null;
    var marktQm = m.markt && m.markt.miete_qm > 0 ? m.markt.miete_qm : null;
    var zul = MP.zulaessig({ ist: ist, wfl: wfl, vgl_qm: vglQm || '', kappung_pct: kPct });
    var bremse = kappDaten ? MP.mietpreisbremseAus(kappDaten, ort) : null;
    var gilt = bremse ? bremse.gilt : null;
    var neu = marktQm ? MP.neuvermietung({ markt_qm: marktQm, wfl: wfl, vgl_qm: vglQm || '', bremse: bremse }) : null;
    var grenze = vglQm ? MP.zielmieteBremse({ ziel_qm: vglQm, vgl_qm: vglQm, bremse: bremse }) : null;
    var nv;
    if (gilt === true) nv = grenze && grenze.obergrenze_qm > 0 ? { art: 'bremse', qm: grenze.obergrenze_qm } : { art: 'bremse_ohne_vgl', qm: null };
    else if (vglQm) nv = { art: gilt === false ? 'richtwert' : 'richtwert_pruefen', qm: vglQm };
    else nv = { art: 'ohne', qm: null };
    var rund = function (x) { return Math.round(x * 100) / 100; };
    if (nv.qm > 0) { nv.monat = rund(nv.qm * wfl); nv.plus_monat = rund(nv.monat - ist); nv.plus_jahr = rund(nv.plus_monat * 12); }
    var bestand = (zul && zul.miete_monat > 0) ? { monat: zul.miete_monat, plus_monat: rund(zul.miete_monat - ist), plus_jahr: rund((zul.miete_monat - ist) * 12) } : null;
    return { ist_monat: ist, ist_qm: ist / wfl, wfl: wfl, vgl: vg, vgl_qm: vglQm, vgl_herkunft: vg ? (VGL_HERKUNFT[vg.art] || null) : null,
      markt_qm: marktQm, zul: zul, bestand: bestand, kPct: kPct, kAus: !!(kapp && kapp.herkunft !== 'auffang' && kapp.pct === kPct), kVo: !!(kapp && kapp.herkunft === 'verordnung'),
      bremse: gilt, neu: neu, nv: nv };
  }
  function qmText(x, ca) { return (ca ? 'ca. ' : '') + dez(x, 2) + ' €/m²'; }
  /* Spanne der Vergleichsmiete als Satz, nur wenn unten und oben verschieden sind */
  function spanneText(vg) {
    if (!vg || !(vg.unten > 0) || !(vg.oben > 0) || !(vg.oben > vg.unten)) return '';
    return 'Spanne ' + (vg.ca ? 'ca. ' : '') + dez(vg.unten, 2) + ' bis ' + dez(vg.oben, 2) + ' €/m²';
  }
  /* Tabelle der Obergrenzen: Miete im Monat und Abstand zur Ist-Miete in Monat und Jahr */
  function mieteZeilen(mi) {
    var z = [];
    if (!mi) return z;
    z.push(['Ist-Miete heute', eur(mi.ist_monat), '', '', { det: qmText(mi.ist_qm) + ' kalt' }]);
    if (mi.bestand) z.push(['Bestandsmiete in drei Jahren', eur(mi.bestand.monat), eurS(mi.bestand.plus_monat), eurS(mi.bestand.plus_jahr),
      { det: qmText(mi.bestand.monat / mi.wfl) + ', höchstens zulässig bei laufendem Mietvertrag (§ 558 BGB)', farbe: true }]);
    if (mi.nv && mi.nv.qm > 0) z.push([mi.nv.art === 'bremse' ? 'Neuvermietung, Obergrenze' : 'Neuvermietung, Richtwert', eur(mi.nv.monat), eurS(mi.nv.plus_monat), eurS(mi.nv.plus_jahr),
      { det: qmText(mi.nv.qm, mi.vgl && mi.vgl.ca) + (mi.nv.art === 'bremse' ? ', Mietpreisbremse (Vergleichsmiete plus 10 %, § 556d BGB)' : ', ortsübliche Vergleichsmiete'), farbe: true }]);
    return z;
  }
  function mieteSaetze(mi) {
    var s = [];
    if (!mi) return s;
    var z = mi.zul, vq = mi.vgl_qm, ca = !!(mi.vgl && mi.vgl.ca), nv = mi.nv || {};
    /* Vergleichsmiete */
    if (vq) s.push('Ortsübliche Vergleichsmiete ' + qmText(vq, ca) + ' (' + mi.vgl_herkunft + (spanneText(mi.vgl) ? ', ' + spanneText(mi.vgl) : '') + ').');
    else s.push('Für diesen Ort liegen keine amtlichen Mietdaten zur Vergleichsmiete vor. DealPilot nennt deshalb keine Zahl.');
    /* Bestand nach drei Jahren */
    if (z && z.miete_monat > 0) {
      if (z.grund === 'vergleichsmiete_erreicht') s.push('Die Miete liegt schon an der ortsüblichen Vergleichsmiete. Eine Erhöhung nach § 558 BGB ist nicht möglich.');
      else if (z.plus_pct > 0.05) s.push('Zulässig in drei Jahren: ' + eur(z.miete_monat) + ' im Monat, das sind ' + dez(z.plus_pct, 1) + ' % mehr'
        + (z.grund === 'kappung' ? ', begrenzt durch die Kappungsgrenze von ' + mi.kPct + ' %.' : ', bis zur ortsüblichen Vergleichsmiete.'));
      if (z.vgl_fehlt) s.push('Gerechnet ist deshalb nur bis zur Kappungsgrenze. Liegt die Vergleichsmiete darunter, ist sie die Grenze.');
      if (z.plus_pct > 0.05) s.push('Eine Erhöhung ist frühestens 15 Monate nach Einzug oder der letzten Erhöhung möglich (§ 558 Abs. 1 BGB).');
    }
    s.push(mi.kAus ? 'Kappungsgrenze ' + mi.kPct + ' % in drei Jahren ' + (mi.kVo ? 'laut Landesverordnung.' : 'nach § 558 Abs. 3 BGB, für die Gemeinde gilt keine Landesverordnung.') : 'Kappungsgrenze vorsichtig mit 15 % angesetzt. Gilt in der Gemeinde keine Verordnung, sind es 20 %.');
    /* Neuvermietung */
    if (nv.art === 'bremse') s.push('In der Gemeinde gilt die Mietpreisbremse. Bei Neuvermietung höchstens ' + qmText(nv.qm, ca) + ', das ist die Vergleichsmiete plus 10 % (§ 556d BGB).');
    else if (nv.art === 'bremse_ohne_vgl') s.push('In der Gemeinde gilt die Mietpreisbremse. Bei Neuvermietung höchstens Vergleichsmiete plus 10 %. Ohne Vergleichsmiete nennt DealPilot hier keine Zahl.');
    else if (nv.art === 'richtwert') s.push('In der Gemeinde gilt keine Mietpreisbremse. Als Richtwert für die Neuvermietung dient die ortsübliche Vergleichsmiete von ' + qmText(nv.qm, ca) + '.');
    else if (nv.art === 'richtwert_pruefen') s.push('Ob in der Gemeinde die Mietpreisbremse gilt, bitte prüfen. Als Richtwert für die Neuvermietung dient die ortsübliche Vergleichsmiete von ' + qmText(nv.qm, ca) + '. Gilt die Bremse, sind höchstens 10 % mehr zulässig.');
    else s.push('Für die Neuvermietung nennt DealPilot ohne Vergleichsmiete keine Obergrenze.');
    if (nv.qm > 0) {
      if (nv.plus_monat > 0.5) s.push('Abstand zur Ist-Miete bei Neuvermietung: ' + eurS(nv.plus_monat) + ' im Monat, ' + eurS(nv.plus_jahr) + ' im Jahr.');
      else if (nv.art === 'bremse') s.push('Die Ist-Miete liegt schon an oder über dieser Grenze. Bei Neuvermietung darf eine höhere Vormiete weiter verlangt werden (§ 556e BGB).');
      else s.push('Die Ist-Miete liegt schon an oder über der Vergleichsmiete.');
      if (mi.markt_qm > 0 && mi.markt_qm < nv.qm - 0.004) s.push('Der aktuelle Marktdurchschnitt liegt mit ' + qmText(mi.markt_qm) + ' darunter. Ob die Grenze erreichbar ist, hängt von Wohnung und Lage ab.');
    }
    if (mi.bestand && mi.bestand.plus_monat > 0.5) s.push('Abstand zur Ist-Miete im Bestand: ' + eurS(mi.bestand.plus_monat) + ' im Monat, ' + eurS(mi.bestand.plus_jahr) + ' im Jahr.');
    s.push('Orientierung, keine Rechtsberatung.');
    return s;
  }

  /* Text für den Markt: nur, was der Dienst geliefert hat. Die Marktpreisindikation mit ihrer Kennzeichnung wie
     im Marktbericht (Abschlag auf Angebotspreise). v3946 · Boden-, Ertrags-, Sach- und Vergleichswert stehen jetzt
     im Kapitel Wertermittlung (wertSeite, Stufe 3), bis v3945 stand hier nur der Weg in die App. */
  var KOMBI = 'Ein anderer Gutscheincode lässt sich mit der Anrechnung nicht kombinieren.';
  function wertZeilen(m) {
    var z = [], mk = m && m.markt;
    if (mk && mk.wert > 0) {
      var ab = mk.abschlag && mk.abschlag.pct > 0 ? mk.abschlag : null;
      var kenn = 'indikativ, aus Angebotspreisen abgeleitet' + (ab ? ', ' + (ab.vor_abschlag > 0 ? 'aus ' + eur(ab.vor_abschlag) + ' (Angebotsniveau) abzüglich ' : 'inkl. ')
        + dez(ab.pct, ab.pct % 1 ? 1 : 0) + ' % Abschlag auf Angebotspreise (' + ab.herkunft + ')' : '');
      z.push([mk.bezeichnung || 'Erweiterte Marktpreisindikation', eur(mk.wert) + (mk.wert_von > 0 && mk.wert_bis > 0 ? ' (' + eur(mk.wert_von) + ' bis ' + eur(mk.wert_bis) + ')' : ''), kenn]);
    }
    if (mk && mk.qm > 0) z.push(['Mittlerer Angebotspreis', dez(mk.qm, 0) + ' €/m²', 'aktueller Marktdurchschnitt']);
    return z;
  }
  /* Ein- und Ausfuhr der Paketlinks: der Anrechnungs-Code ersetzt jeden anderen Code (v3941) */
  function mitCode(href, code) {
    if (!code) return href;
    var u;
    try { u = new URL(href, location.href); } catch (e) { return href; }
    ['code', 'promo', 'rabatt'].forEach(function (k) { u.searchParams.delete(k); });
    u.searchParams.set('code', code);
    return u.toString();
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
      if (code && !frei) href = mitCode(href, code).split('#')[0];
      a.setAttribute('href', href + frag);
    });
    ziel.innerHTML = ''; ziel.appendChild(g);
  }

  /* Ansicht des Berichts im Fenster + PDF ───────────────────────────── */
  function zeigeBericht(d) {
    stufe(4); ++schritt;
    var r = d.r, z = d.z, m = d.m, an = d.status && d.status.anrechnung;
    var ds2 = d.ds2 && d.ds2.r, g = ds2 && ds2.gesamt;
    var kopf = (g ? '<div class="ec-urteil" data-farbe="' + esc((window.ScoreTier ? ScoreTier.stufe(g.score).farbe : '')) + '"><div class="ec-ring"><b>' + g.score + '</b><small>/ 100</small></div>'
        + '<div><span class="ec-l">Investor Deal Score</span><div class="ec-wort">' + esc(g.empfehlung ? g.empfehlung.text : '') + '</div><p>Investment-Score ' + ds2.investment.score + ', Finanzierungs-Score ' + ds2.finanzierung.score + '.</p></div></div>'
      : (r && r.k ? '<div class="ec-urteil" data-farbe="' + esc(r.st.farbe) + '"><div class="ec-ring"><b>' + r.ds.score + '</b><small>/ 100</small></div><div><span class="ec-l">Deal Score</span><div class="ec-wort">' + esc(r.st.wort) + '</div></div></div>' : ''));
    /* v3946 · Wertindikation und Bodenrichtwert schon im Fenster */
    var w = (m && m.wert) || {}, wi = w.wertindikation, bo = w.boden || {};
    var wertZeile = (wi || bo.verfuegbar) ? '<div class="ec-kz">' + (wi ? '<div><span>Wertindikation, ' + esc(VW_KURZ[wi.verfahren] || '') + '</span><b>' + esc(eur(wi.wert_eur)) + '</b></div>' : '')
      + (bo.verfuegbar ? '<div><span>Bodenrichtwert</span><b>' + esc(dez(bo.brw_qm, 0)) + ' €/m²</b></div>' : '')
      + (d.fin && d.fin.bindung ? '<div><span>Restschuld nach ' + d.fin.bindung.jahre + ' J.</span><b>' + esc(eur(d.fin.bindung.rs)) + '</b></div>' : '')
      + (d.fin && d.fin.anschluss ? '<div><span>Rate im Anschluss</span><b>' + esc(eur(d.fin.anschluss.rate_m)) + '</b></div>' : '') + '</div>' : '';
    setze('<h3 id="ecTitel">Dein Bericht ist fertig.</h3>' + kopf + wertZeile
      + (d.aus_zahlenstand ? meldung('Gerechnet mit den gespeicherten Zahlen aus dem kostenlosen Teil. Lade alle Unterlagen noch einmal hoch, dann liest der Bericht sie vollständig.', 'warn') : '')
      + '<div class="ec-titelbild" hidden><span class="ec-l">Bild oben im Bericht</span><p class="ec-fein">Wähl ein Foto, das das Objekt selbst zeigt. Ohne Wahl steht oben die Lagekarte.</p><div class="ec-fotos"></div></div>'
      + '<div class="ec-knoepfe"><button type="button" class="btn-p ec-pdf">Bericht ansehen und als PDF speichern</button></div>'
      + mailBox(d)
      + (an ? '<div class="ec-schutz"><b>Anrechnung.</b> Buchst du bis ' + esc(datum(an.bis)) + ' ein Paket, rechnet DealPilot ' + esc(dez(an.cents / 100, 2)) + ' € an. Dein Code ' + esc(an.code) + ' steht schon in den Links unten. ' + esc(KOMBI) + ' Das Objekt kommt mit den Zahlen in dein Konto.</div>'
        : '<p class="ec-fein">Das Objekt kommt mit den Zahlen in dein Konto, wenn du über eine der Karten unten startest.</p>')
      + '<div class="ec-pakete"><span class="ec-l">Weiter in DealPilot</span><div class="ec-pk"></div></div>', '.ec-pdf');
    paketeEinsetzen($('.ec-pk', inhalt), z, r, an ? an.code : null);
    $('.ec-pdf', inhalt).addEventListener('click', function () { pdf(d); });
    mailVerdrahten(d);
    fotoWahl(d);
  }

  /* ── einzelcheck-2 · Titelbild aus dem Exposé (Marcel 24.11.2026: „wenn wir ein Bild … auslesen können, dann könnten wir
     auch das Bild auswählen. Es muss aber das Objekt zeigen. Ansonsten … diese Karte“). Ob ein Bild das Objekt zeigt,
     entscheidet der Käufer: die Fotos stehen zur Wahl, ohne Wahl gilt die Lagekarte. Gelesen wird nur im Browser. ── */
  var _fotosGeholt = null;
  function fotosHolen() {
    if (_fotosGeholt) return _fotosGeholt;
    var dateien = S.dateien.slice().sort(function (a, b) { return (artRaten(b.name) === 'Exposé') - (artRaten(a.name) === 'Exposé'); }).slice(0, 4);
    _fotosGeholt = lade('pdfjsLib').then(function (da) {
      var L = window.pdfjsLib; if (!da || !L || !dateien.length) return [];
      try { L.GlobalWorkerOptions.workerSrc = appBasis() + 'vendor/cdn/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {}
      var fotos = [];
      var eine = function (f) {
        if (fotos.length >= 6) return Promise.resolve();
        return f.arrayBuffer().then(function (buf) { return L.getDocument({ data: buf }).promise; }).then(function (doc) {
          var seiten = Math.min(doc.numPages, 6), kette = Promise.resolve();
          for (var i = 1; i <= seiten; i++) (function (n) { kette = kette.then(function () { if (fotos.length < 6) return bilderDerSeite(doc, n, fotos); }); })(i);
          return kette.then(function () { try { doc.destroy(); } catch (e) {} });
        }).catch(function () {});
      };
      return dateien.reduce(function (k, f) { return k.then(function () { return eine(f); }); }, Promise.resolve()).then(function () { return fotos; });
    }).catch(function () { return []; });
    return _fotosGeholt;
  }
  function bilderDerSeite(doc, n, fotos) {
    var OPS = (window.pdfjsLib && window.pdfjsLib.OPS) || {};
    return doc.getPage(n).then(function (page) {
      return page.getOperatorList().then(function (ops) {
        for (var k = 0; k < ops.fnArray.length && fotos.length < 6; k++) {
          if (ops.fnArray[k] !== (OPS.paintImageXObject || 85)) continue;
          var name = ops.argsArray[k] && ops.argsArray[k][0], o = null;
          try { o = page.objs.has(name) ? page.objs.get(name) : null; } catch (e) { o = null; }
          /* nur echte Fotos: groß genug, kein Strich, kein Logo (wie pdf-import.js) */
          if (!o || !o.width || !o.height || o.width < 400 || o.height < 260) continue;
          var q = o.width / o.height; if (q < 0.6 || q > 2.4) continue;
          var url = bildAlsUrl(o); if (url && fotos.indexOf(url) < 0) fotos.push(url);
        }
      });
    }).catch(function () {});
  }
  function bildAlsUrl(o) {
    try {
      var sk = Math.min(1, 1400 / o.width), c = document.createElement('canvas');
      c.width = Math.round(o.width * sk); c.height = Math.round(o.height * sk);
      var x = c.getContext('2d');
      if (o.bitmap) { x.drawImage(o.bitmap, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.85); }
      if (!o.data) return null;
      var roh = document.createElement('canvas'); roh.width = o.width; roh.height = o.height;
      var rx = roh.getContext('2d'), id = rx.createImageData(o.width, o.height), d = o.data, px = o.width * o.height;
      if (d.length === px * 4) id.data.set(d);
      else if (d.length === px * 3) { for (var i = 0, j = 0; i < px; i++, j += 3) { id.data[i * 4] = d[j]; id.data[i * 4 + 1] = d[j + 1]; id.data[i * 4 + 2] = d[j + 2]; id.data[i * 4 + 3] = 255; } }
      else return null;
      rx.putImageData(id, 0, 0); x.drawImage(roh, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.85);
    } catch (e) { return null; }
  }
  function fotoWahl(d) {
    var box = $('.ec-titelbild', inhalt); if (!box || !S.dateien.length) return;
    var nr = schritt;
    fotosHolen().then(function (fotos) {
      if (nr !== schritt || !fotos.length) return;
      S.fotos = fotos;
      var karte = d.m && d.m.karte;
      var kachel = function (src, i, text) { return '<button type="button" class="ec-foto' + ((S.fotoWahl == null ? -1 : S.fotoWahl) === i ? ' an' : '') + '" data-i="' + i + '" aria-pressed="' + ((S.fotoWahl == null ? -1 : S.fotoWahl) === i) + '">'
        + (src ? '<img src="' + src + '" alt="">' : '<span>' + esc(text) + '</span>') + '<small>' + esc(text) + '</small></button>'; };
      $('.ec-fotos', box).innerHTML = kachel(karte || null, -1, karte ? 'Lagekarte' : 'Ohne Foto') + fotos.map(function (f, i) { return kachel(f, i, 'Foto ' + (i + 1)); }).join('');
      box.hidden = false;
      $('.ec-fotos', box).addEventListener('click', function (e) {
        var b = e.target.closest('.ec-foto'); if (!b) return;
        var i = +b.getAttribute('data-i'); S.fotoWahl = i < 0 ? null : i;
        $$('.ec-foto', box).forEach(function (x) { var an = x === b; x.classList.toggle('an', an); x.setAttribute('aria-pressed', String(an)); });
      });
    });
  }

  /* ── einzelcheck-2 · Bericht per Mail (Backend: POST /public/einzelcheck/mail, PDF-Dienst, mailerService) ── */
  function mailBox(d) {
    var st = (d && d.status) || S.status || {};
    if (!tokenLesen() || st.mails_rest === 0) return '';
    return '<form class="ec-mail" novalidate><span class="ec-l">Bericht per E-Mail</span>'
      + '<p class="ec-fein">Wir schicken dir den Bericht als PDF, dazu den Weg in DealPilot' + (st.anrechnung ? ' und deinen Code für die Anrechnung' : '') + '. Die Adresse speichern wir nicht.</p>'
      + '<div class="ec-mail-z"><input type="email" class="ec-mail-in" autocomplete="email" placeholder="name@beispiel.de" aria-label="E-Mail-Adresse" required>'
      + '<button type="submit" class="btn-l ec-mail-los">Bericht senden</button></div><p class="ec-mail-m" role="status"></p></form>';
  }
  function mailVerdrahten(d) {
    var f = $('.ec-mail', inhalt); if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = $('.ec-mail-in', f), b = $('.ec-mail-los', f), m = $('.ec-mail-m', f);
      var a = String(inp.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(a)) { m.textContent = 'Bitte eine gültige E-Mail-Adresse eintragen.'; m.className = 'ec-mail-m warn'; inp.focus(); return; }
      b.disabled = true;
      logoAlsData().then(function () {
      var doc = pdf(d, true);
      if (doc) doc.html = doc.html.split(location.origin + '/fonts/').join(appBasis() + 'fonts/');
      if (!doc) { b.disabled = false; m.textContent = 'Der Bericht ließ sich gerade nicht zusammenstellen.'; m.className = 'ec-mail-m warn'; return; }
      b.disabled = true; m.textContent = 'Wird gesendet, das dauert einen Moment.'; m.className = 'ec-mail-m';
      holeJson(api('/mail'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenLesen(), email: a, html: doc.html, titel: doc.titel }) }).then(function (j) {
        if (j._ok) { m.textContent = 'Gesendet an ' + a + '. Schau auch im Spam-Ordner nach.'; m.className = 'ec-mail-m ok'; if (j.mails_rest === 0) b.disabled = true; else b.disabled = false; return; }
        m.textContent = j.error || 'Das hat gerade nicht geklappt. Bitte gleich noch einmal.'; m.className = 'ec-mail-m warn'; b.disabled = j.code === 'mails_aufgebraucht';
      }).catch(function () { m.textContent = 'Keine Verbindung. Bitte gleich noch einmal.'; m.className = 'ec-mail-m warn'; b.disabled = false; });
      });
    });
  }
  function logoAlsData() {
    if (LOGO_DATA) return Promise.resolve();
    return fetch(location.origin + '/assets/dealpilot-logo-2026.png').then(function (r) { return r.ok ? r.blob() : null; }).then(function (bl) {
      if (!bl) return;
      return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { LOGO_DATA = String(fr.result || '') || null; ok(); }; fr.onerror = function () { ok(); }; fr.readAsDataURL(bl); });
    }).catch(function () {});
  }

  /* ── v3946 · DER BERICHT ALS DOKUMENT ──────────────────────────────────────────────────────────────────
     Marcel 22.11.2026: „deutlich professioneller, möglichst so wie unser Marktbericht … im Stil unserer sonstigen
     Unterlagen … nichts davor mit A, B und C. Da kommt eine Überschrift hin, eine vernünftige.“
     Gestaltung: js/dp-dokument.js (dasselbe System wie Investment-PDF und Marktbericht): Deckblatt, Kopf mit Logo,
     Fußzeile mit Absender und Stand, Kapitel mit Überschrift. Hier wird nichts gerechnet, nur gesetzt. */
  var ART_NAME = { ETW: 'Eigentumswohnung', EFH: 'Einfamilienhaus', ZFH: 'Zweifamilienhaus', DHH: 'Doppelhaushälfte', RH: 'Reihenhaus', MFH: 'Mehrfamilienhaus', GEW: 'Gewerbeobjekt' };
  var VW_KURZ = { ertragswert: 'Ertragswert', sachwert: 'Sachwert', vergleichswert: 'Vergleichswert' };
  var VW_LANG = { ertragswert: 'Ertragswert, führend', sachwert: 'Sachwert, führend', vergleichswert: 'Vergleichswert, führend' };   /* einzelcheck-2 */
  /* einzelcheck-2 · DSCR erklärt, mit den Beträgen aus dem Kern (Reinertrag = DSCR × Kapitaldienst, nichts neu gerechnet) */
  function dscrSatz(r, f) {
    var kd = r.k.kd_dscr, re = r.k.dscr * kd;   /* Kapitaldienst aus dem Kern (Zins + Tilgung im Jahr), Reinertrag = DSCR x Kapitaldienst */
    if (!(kd > 0)) return 'DSCR ' + dez(r.k.dscr, 2) + ', volles Jahr mit den heutigen Eingaben.';
    var s = 'DSCR ' + dez(r.k.dscr, 2) + ', volles Jahr mit den heutigen Eingaben: Reinertrag ' + eur(re) + ' im Jahr (Kaltmiete und Zusatzeinnahmen minus nicht umlagefähige Kosten) geteilt durch Zins und Tilgung ' + eur(kd) + '.';
    if (f && f.bindung) s += ' In den ' + f.bindung.jahre + ' Jahren Zinsbindung bleibt er so, weil Miete und Rate gleich bleiben.';
    if (f && f.anschluss && f.anschluss.dscr > 0) s += ' Im Anschluss ' + dez(f.anschluss.dscr, 2) + ' bei ' + dez(f.anschluss.zins, 1) + ' % Zins.';
    return s;
  }
  var MARKE = { company: 'DealPilot', name: 'Junker Solution', email: 'info@dealpilot.immo' };
  /* Deckblatt-Bild: Obsidian mit Runway (Bildsprache Luftfahrt). Feste Markenfarben, var() geht in Data-URIs nicht. */
  function deckBild() {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 560" preserveAspectRatio="xMidYMid slice">'
      + '<defs><linearGradient id="r" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#E8CC7A"/><stop offset=".55" stop-color="#C9A84C"/><stop offset="1" stop-color="#b8932f"/></linearGradient>'
      + '<radialGradient id="h" cx=".72" cy=".1" r=".9"><stop offset="0" stop-color="#2a2414"/><stop offset="1" stop-color="#050505"/></radialGradient></defs>'
      + '<rect width="1200" height="560" fill="url(#h)"/>'
      + '<path d="M560 560 L760 230 L800 230 L1200 560 Z" fill="#0d0d0d"/>'
      + '<path d="M560 560 L760 230" stroke="url(#r)" stroke-width="4" fill="none"/><path d="M1200 560 L800 230" stroke="url(#r)" stroke-width="4" fill="none"/>'
      + [0, 1, 2, 3, 4, 5].map(function (i) { var t = (i + 0.5) / 6, y = 230 + t * t * 330, x = 780 + (y - 230) / 330 * 100, w = 3 + t * 9; return '<rect x="' + (x - w / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + (6 + t * 34).toFixed(1) + '" fill="#E8CC7A" opacity="' + (0.35 + t * 0.6).toFixed(2) + '"/>'; }).join('')
      + '<path d="M0 470 C 300 430, 560 420, 700 330" stroke="#C9A84C" stroke-opacity=".35" stroke-width="2" fill="none"/>'
      + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  var LOGO_DATA = null;   /* einzelcheck-2 · fuer die Mail: der PDF-Dienst laedt nur data: und Dateien der App */
  function logoUrl() { if (LOGO_DATA) return LOGO_DATA; try { return location.origin + '/assets/dealpilot-logo-2026.png';   /* v3946a · neues Logo ohne „by Junker Immobilien“ */ } catch (e) { return null; } }
  /* Überschriften des KI-Texts: nie ein Buchstabe davor (das Backend benennt sie schon um, hier zur Sicherheit) */
  function kapitel(t) {
    var K = { A: 'Zusammenfassung und Empfehlung', B: 'Objekt, Lage und Markt', C: 'Bewertung, Rendite und Ausblick', D: 'Entwicklung, Ableitung und Prognose' };
    var m = /^([A-P])\s*[).:·]\s*(.*)$/.exec(String(t || '').trim());
    return (m ? (K[m[1]] || m[2]) : String(t || '').trim()).replace(/^[A-Z]\d?\s*[).:·]\s+/, '').replace(/\s*&\s*/g, ' und ');
  }
  function stichtagText(s) { var x = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return x ? x[3] + '.' + x[2] + '.' + x[1] : ''; }
  function abstandPct(kp, wert) { return wert > 0 ? (kp / wert - 1) * 100 : null; }
  function pctS(n) { return (n >= 0 ? '+' : '−') + dez(Math.abs(n), 1) + ' %'; }

  /* Herkunft einer Zeile in der Objekttabelle: Grundangabe des Käufers, ergänzt aus den Unterlagen, gelesen */
  function objektZeilen(z, g) {
    g = g || {};
    var her = function (k) { return g[k] != null && g[k] !== '' ? 'deine Angabe' : 'aus den Unterlagen'; };
    var zl = [];
    var neu = function (k, label, wert) { if (wert) zl.push([label, wert, { det: her(k) }]); };
    var v = function (k) { return g[k] != null && g[k] !== '' ? g[k] : z[k]; };
    neu('art', 'Objektart', ART_NAME[v('art')] || '');
    neu('plz', 'Lage', [v('plz'), v('ort')].filter(Boolean).join(' '));
    if (v('wfl') > 0) neu('wfl', 'Wohnfläche', dez(v('wfl'), v('wfl') % 1 ? 1 : 0) + ' m²');
    if (v('bj') > 0) neu('bj', 'Baujahr', String(Math.round(v('bj'))));
    if (v('gsfl') > 0) neu('gsfl', 'Grundstücksfläche', dez(v('gsfl'), 0) + ' m²');
    if (v('mea_pct') > 0) neu('mea_pct', 'Miteigentumsanteil', dez(v('mea_pct'), 2) + ' %');
    if (z.einheiten > 0) zl.push(['Einheiten', dez(z.einheiten, 0) + (z.leer_einheiten > 0 ? ', davon ' + dez(z.leer_einheiten, 0) + ' ohne Miete' : ''), { det: 'aus den Unterlagen' }]);
    if (v('kp') > 0) neu('kp', 'Kaufpreis', eur(v('kp')));
    if (v('nkm') > 0) neu('nkm', 'Kaltmiete im Monat', eur(v('nkm')));
    if (v('ze') > 0) neu('ze', 'Zusatzeinnahmen im Monat', eur(v('ze')));
    if (z.hausgeld_monat > 0) zl.push(['Hausgeld im Monat', eur(z.hausgeld_monat), { det: 'aus den Unterlagen' }]);
    if (z.bwk_nul_jahr != null) zl.push(['Nicht umlagefähige Kosten im Jahr', eur(z.bwk_nul_jahr), { det: 'aus dem Wirtschaftsplan' }]);
    if (z.ruecklage_stand > 0) zl.push(['Erhaltungsrücklage', eur(z.ruecklage_stand), { det: 'aus den Unterlagen' }]);
    if (z.sonderumlagen_anzahl > 0) zl.push(['Beschlossene Sonderumlagen', dez(z.sonderumlagen_anzahl, 0) + (z.sonderumlage_eur > 0 ? ', zusammen ' + eur(z.sonderumlage_eur) : ''), { det: 'aus dem WEG-Protokoll' }]);
    return zl;
  }

  /* Finanzierung: Tabellen aus finanzierungAus (nur Kern-Ergebnisse) */
  function finanzSeite(D, f, r) {
    if (!f) return '<p>Die Finanzierung ließ sich nicht rechnen, weil der Rechenkern für den Tilgungsplan nicht geladen war.</p>';
    if (f.ohne_darlehen) return '<p>Mit diesem Eigenkapital braucht der Kauf kein Darlehen. Cashflow und Rendite stehen unter Kennzahlen.</p>';
    var h = f.heute, b = f.bindung, a = f.anschluss;
    var out = D.kacheln([{ l: 'Darlehen', v: D.eur(f.d1), s: dez(h.zins, 2) + ' % Zins, ' + dez(h.tilg, 2) + ' % Tilgung' },
      { l: 'Rate im Monat', v: D.eur(h.rate_m), s: 'Zins und Tilgung' },
      { l: 'Restschuld', v: D.eur(b.rs), s: 'nach ' + b.jahre + ' Jahren Zinsbindung' },
      a ? { l: 'Rate Anschluss', v: D.eur(a.rate_m), s: 'bei ' + dez(a.zins, 1) + ' % Zins', art: a.mehr_m > 0.5 ? 'schlecht' : '' } : { l: 'Anschluss', v: 'entfällt', s: 'nach der Bindung getilgt', art: 'gut' }]);
    out += '<div class="zwei"><div><h3>Investition</h3>' + D.liste([['Kaufpreis', D.eur(r.e.kp)], ['Kaufnebenkosten (' + dez(r.e.nkPct, 1) + ' %)', D.eur(f.nk)],
      ['Gesamtinvestition', D.eur(f.gi), { art: 'summe' }], ['Eigenkapital', D.eur(f.ek)], ['Darlehen', D.eur(f.d1), { art: 'ende' }]]) + '</div>'
      + '<div><h3>Zinsbindung</h3>' + D.liste([['Zinsbindung', b.jahre + ' Jahre'], ['Gezahlte Zinsen in der Bindung', D.eur(b.zinsen)], ['Geleistete Tilgung', D.eur(b.tilgung)],
        ['Getilgt', dez(b.getilgt_pct, 1) + ' %'], ['Restschuld am Ende der Zinsbindung', D.eur(b.rs), { art: 'ende' }]]) + '</div></div>';
    var kopfA = a ? 'Anschluss ab Jahr ' + (b.jahre + 1) : 'Anschluss';
    var zeile = function (l, x, y, o) { return [l, x, a ? y : 'entfällt', o || {}]; };
    out += '<!--PHASE--><h3>Rate und Cashflow je Phase</h3>' + D.liste([
      zeile('Sollzins', dez(h.zins, 2) + ' %', a && dez(a.zins, 2) + ' %'),
      zeile('Tilgung im Jahr', dez(h.tilg, 2) + ' %', a && dez(a.tilg, 2) + ' %', { det: 'Anschluss mit derselben Tilgung' }),
      zeile('Darlehen zu Beginn der Phase', D.eur(f.d1), a && D.eur(a.darlehen)),
      zeile('Rate im Monat', D.eur(h.rate_m), a && D.eur(a.rate_m), { art: 'summe' }),
      zeile('davon Zins', D.eur(h.zins_m), a && D.eur(a.zins_m)),
      zeile('davon Tilgung', D.eur(h.tilg_m), a && D.eur(a.tilg_m)),
      zeile('Cashflow vor Finanzierung im Monat', D.eurS(h.cf_vor_m), a && D.eurS(h.cf_vor_m), { det: 'Kaltmiete und Zusatzeinnahmen minus nicht umlagefähige Kosten', farbe: 1 }),
      zeile('Cashflow nach Finanzierung im Monat', D.eurS(h.cf_nach_m), a && D.eurS(a.cf_nach_m), { art: 'ende', farbe: 1, det: 'vor Steuern, nach Zins und Tilgung' }),
      zeile('DSCR', dez(h.dscr, 2), a && dez(a.dscr, 2), { det: 'Kapitaldienstdeckung, ab 1,2 gilt sie als solide' })
    ], ['', 'Heute', kopfA]) + '<!--/PHASE-->';
    out = out.replace(/<table>/g, '<table class="dicht">');
    if (a) {
      out += '<div class="zwei block"><div><h3>Anschlussfinanzierung</h3>' + D.liste([
        ['Annahme', dez(a.zins, 1) + ' % Zins, ' + dez(a.tilg, 2) + ' % Tilgung'],
        ['Rate gegenüber heute', Math.abs(a.mehr_m) < 0.5 ? 'gleich' : D.eur(Math.abs(a.mehr_m)) + (a.mehr_m > 0 ? ' mehr' : ' weniger') + ' im Monat', { det: 'Rate auf die Restschuld gerechnet, mit Anschlusszins und derselben Tilgung' }],
        a.rs_10 != null ? ['Restschuld zehn Jahre nach dem Anschluss', D.eur(a.rs_10)] : null,
        ['Schuldenfrei nach', a.laufzeit_monate ? dez(a.gesamt_jahre, 1) + ' Jahren ab heute' : 'mehr als 100 Jahren', { art: 'ende', det: a.laufzeit_monate ? 'davon ' + dez(a.laufzeit_monate / 12, 1) + ' Jahre im Anschluss' : 'mit dieser Tilgung' }]
      ].filter(Boolean)) + '</div><div>';
    } else out += '<div class="block"><div>';
    out += '<div class="hinweis">Gerechnet Monat für Monat wie der Tilgungsplan einer Bank, mit den Rechenkernen der App. Die Miete bleibt in allen Phasen gleich, Steuern sind nicht enthalten. '
      + 'Der Anschlusszins von ' + dez(ANSCHLUSS_ZINS, 1) + ' % ist eine vorsichtige Annahme, keine Prognose. Keine Finanzierungsberatung.</div></div></div>';
    return out;
  }

  /* Wertermittlung (Stufe 3): gesetzt aus m.wert (Backend wertAus), jede Zahl mit Herkunft */
  function wertSeite(D, m, r) {
    var w = m && m.wert;
    if (!m || !m.verfuegbar) return '<p>' + D.esc(m && m.grund === 'ohne_ort' ? 'In Grundangaben und Unterlagen stand kein Ort. Ohne Postleitzahl oder Ort rechnet die Wertermittlung nicht.' : 'Der Marktbericht war gerade nicht erreichbar. In DealPilot holst du ihn mit einem Klick nach.') + '</p>';
    if (!w || !w.verfuegbar) {
      return '<p>' + D.esc((w && w.text) || 'Für dieses Objekt liegt keine Wertermittlung vor.') + '</p>'
        + (m.markt && m.markt.wert > 0 ? '<h3>Marktpreisindikation aus Angebotspreisen</h3><p>Kein Verfahren der ImmoWertV und kein Verkehrswert. Aktuelle Angebotspreise vergleichbarer Objekte, abzüglich des üblichen Abschlags zwischen Angebots- und Kaufpreis.</p>' + D.liste(wertZeilen(m).map(function (x) { return [x[0], x[1], { det: x[2] }]; }), ['Kennzahl', 'Betrag']) : '');
    }
    var bo = w.boden || {}, wi = w.wertindikation;
    var out = D.kacheln([
      { l: 'Bodenrichtwert', v: bo.verfuegbar ? D.zahl(bo.brw_qm, 0) + ' €/m²' : 'kein Wert', s: bo.verfuegbar ? 'Stichtag ' + stichtagText(bo.stichtag) : 'kein amtlicher Wert' },
      { l: 'Bodenwert', v: bo.bodenwert_eur > 0 ? D.eur(bo.bodenwert_eur) : 'nicht ermittelt', s: bo.bodenwert_eur > 0 ? 'Fläche × Richtwert, angepasst' : 'Grundstücksfläche oder Anteil fehlt' },
      { l: 'Wertindikation', v: wi ? D.eur(wi.wert_eur) : 'keine', s: wi ? wi.name + ', führend' : 'siehe unten', art: 'hi' },
      { l: 'Kaufpreis dazu', v: wi && r && r.e.kp > 0 ? pctS(abstandPct(r.e.kp, wi.wert_eur)) : 'entfällt', s: wi ? (r.e.kp > wi.wert_eur ? 'über der Wertindikation' : 'unter der Wertindikation') : '', art: wi && r && r.e.kp > wi.wert_eur * 1.05 ? 'schlecht' : (wi && r && r.e.kp <= wi.wert_eur ? 'gut' : '') }]);
    var zl = (w.verfahren || []).map(function (v) {
      var rolle = v.art === w.fuehrend ? ' (führend)' : (v.art === w.stuetzend ? ' (stützend)' : '');
      if (!v.verfuegbar) return [v.name + rolle, 'nicht ausgewiesen', { det: v.grund || '' }];
      var det = [v.herkunft, v.stufe ? 'Stufe ' + v.stufe : '', v.art === 'ertragswert' && v.lzs_pct != null ? 'Liegenschaftszinssatz ' + dez(v.lzs_pct, 2) + ' %' : '',
        v.rnd_j && v.gnd_j ? 'Restnutzungsdauer ' + dez(v.rnd_j, v.rnd_j % 1 ? 1 : 0) + ' von ' + dez(v.gnd_j, 0) + ' Jahren' : '',
        v.miete_qm ? 'Miete ' + dez(v.miete_qm, 2) + ' €/m²' : '', v.rechnung || '', v.weg || ''].filter(Boolean).join(', ');
      /* einzelcheck-2 · ein Vergleichswert ohne amtliche Kaufpreisbasis (Stufe M) sagt das im Namen */
      return [v.name + rolle + (v.art === 'vergleichswert' && v.stufe === 'M' ? ', mangels amtlicher Kaufpreise aus Angebotspreisen' : ''), D.eur(v.wert_eur), { det: det, art: v.art === w.fuehrend ? 'ende' : '' }];
    });
    out += '<div class="block"><h3>Wertermittlung nach ImmoWertV</h3>' + D.liste(zl, ['Verfahren', 'Wert']) + '</div>';
    /* einzelcheck-2 (Marcel 24.11.2026: „klar unterscheiden … Marktpreisindikation auf Angebotspreisen und
       Vergleichswertverfahren"): eigener Block, eigene Überschrift, nie in der Verfahrenstabelle */
    if (m.markt && m.markt.wert > 0) out += '<div class="block"><h3>Marktpreisindikation aus Angebotspreisen</h3>'
      + '<p>Kein Verfahren der ImmoWertV und kein Verkehrswert. Abgeleitet aus aktuellen Angebotspreisen vergleichbarer Objekte, abzüglich des üblichen Abschlags zwischen Angebots- und Kaufpreis. Sie zeigt, wo der Markt gerade anbietet.</p>'
      + D.liste(wertZeilen(m).map(function (x) { return [x[0], x[1], { det: x[2] }]; }), ['Kennzahl', 'Betrag']) + '</div>';
    var s = [];
    if (w.fuehrend) s.push('Führend ist das ' + ({ ertragswert: 'Ertragswertverfahren', sachwert: 'Sachwertverfahren', vergleichswert: 'Vergleichswertverfahren' })[w.fuehrend] + '. ' + (w.fuehrend_grund || ''));
    if (w.stuetzend) s.push('Stützend ist das ' + ({ ertragswert: 'Ertragswertverfahren', sachwert: 'Sachwertverfahren', vergleichswert: 'Vergleichswertverfahren' })[w.stuetzend] + '.');
    if (!wi && w.wertindikation_grund) s.push(w.wertindikation_grund);
    if (bo.verfuegbar && bo.veraltet) s.push('Der Bodenrichtwert ist älter als ein Jahr. Den neueren Wert beim Gutachterausschuss prüfen.');
    (bo.hinweise || []).forEach(function (x) { s.push(x); });
    if (!bo.verfuegbar && bo.grund) s.push(bo.grund);
    out += (s.length ? '<ul>' + s.map(function (x) { return '<li>' + D.esc(x) + '</li>'; }).join('') + '</ul>' : '')
      + '<div class="hinweis">' + D.esc(w.hinweis || 'Indikative Wertermittlung, kein Verkehrswertgutachten nach § 194 BauGB.') + ' Jede Zahl nennt ihre Herkunft. Fehlt eine Angabe, rechnet das Verfahren nicht halb, DealPilot nennt dann den Grund.</div>';
    return out;
  }

  /* Kurzfazit aus den Zahlen dieses Berichts (keine KI, nur Sätze zu gerechneten Werten) */
  function fazit(d) {
    var r = d.r, f = d.fin, w = d.m && d.m.wert, s = [];
    var wi = w && w.wertindikation;
    if (wi && r && r.e.kp > 0) { var a = abstandPct(r.e.kp, wi.wert_eur); s.push('Der Kaufpreis liegt ' + dez(Math.abs(a), 1) + ' % ' + (a >= 0 ? 'über' : 'unter') + ' der Wertindikation von ' + eur(wi.wert_eur) + ' (' + VW_KURZ[wi.verfahren] + ', indikativ).'); }
    if (r && r.k) s.push('Nach Zins und Tilgung bleiben im Monat ' + eurS(r.k.cf_m) + ' vor Steuern, der DSCR liegt bei ' + dez(r.k.dscr, 2) + '.');
    if (f && f.anschluss) s.push('Nach ' + f.bindung.jahre + ' Jahren sind noch ' + eur(f.bindung.rs) + ' offen. Mit ' + dez(f.anschluss.zins, 1) + ' % im Anschluss ' + (Math.abs(f.anschluss.mehr_m) < 0.5 ? 'bleibt die Rate gleich.' : (f.anschluss.mehr_m > 0 ? 'steigt' : 'sinkt') + ' die Rate um ' + eur(Math.abs(f.anschluss.mehr_m)) + ' im Monat.'));
    if (d.miete && d.miete.bestand && d.miete.bestand.plus_monat > 0.5) s.push('Im Bestand sind in drei Jahren bis zu ' + eurS(d.miete.bestand.plus_monat) + ' Miete im Monat zulässig.');
    if (w && w.boden && w.boden.verfuegbar) s.push('Der amtliche Bodenrichtwert liegt bei ' + dez(w.boden.brw_qm, 0) + ' €/m² (Stichtag ' + stichtagText(w.boden.stichtag) + ').');
    return s;
  }

  function pdf(d, nurHtml) {
    var D = window.DpDokument;
    if (!D) { if (nurHtml) return null; alert('Die Vorlage für das PDF ist nicht geladen. Bitte die Seite neu laden.'); return; }
    var r = d.r, z = d.z, m = d.m || {}, ds2 = d.ds2 && d.ds2.r, g = ds2 && ds2.gesamt, w = m.wert || {}, gr = S.grund || {};
    var art = gr.art || z.art, ortZeile = [gr.plz || z.plz, gr.ort || z.ort || (m.lage && m.lage.ort)].filter(Boolean).join(' ');
    var titel = (ART_NAME[art] || 'Objekt') + (ortZeile ? ' in ' + ortZeile : '');
    var lg = logoUrl();
    var c = { marke: MARKE, logo: lg ? { b64: lg } : null, dokument: 'Einzel-Check', zeile: ortZeile || 'Objekt aus deinen Unterlagen', stand: d.stand };
    var seiten = [];
    var wi = w.wertindikation, bo = w.boden || {};
    var wfl = gr.wfl || z.wfl, bj = gr.bj || z.bj;

    /* Deckblatt: oben der Bodenrichtwert (Marcel: „oben … den Bodenrichtwert mit ausgeben“) */
    /* einzelcheck-2 (Marcel 24.11.2026): oben ein Foto des Objekts, wenn der Käufer eins aus dem Exposé gewählt hat,
       sonst die Lagekarte wie im Marktbericht, ohne beides das Runway-Bild */
    var deckFoto = (S.fotoWahl != null && S.fotos && S.fotos[S.fotoWahl]) ? S.fotos[S.fotoWahl] : null;
    seiten.push(D.deckblatt(c, { bild: deckFoto || m.karte || deckBild(), eyebrow: 'DealPilot Einzel-Check', titel: titel,
      unter: [wfl ? dez(wfl, 0) + ' m² Wohnfläche' : '', bj ? 'Baujahr ' + Math.round(bj) : '', r && r.e.kp ? 'Kaufpreis ' + eur(r.e.kp) : ''].filter(Boolean).join(' · '),
      wertLabel: wi ? 'Wertindikation · ' + wi.name : (g ? 'Investor Deal Score' : (r && r.k ? 'Deal Score' : null)),
      wert: wi ? eur(wi.wert_eur) : (g ? g.score + ' / 100' : (r && r.k ? r.ds.score + ' / 100' : null)),
      wertNeben: wi ? D.esc('Führendes Verfahren nach § 6 ImmoWertV, indikativ. ' + (r && r.e.kp ? 'Der Kaufpreis liegt ' + dez(Math.abs(abstandPct(r.e.kp, wi.wert_eur)), 1) + ' % ' + (r.e.kp >= wi.wert_eur ? 'darüber.' : 'darunter.') : ''))
        : (g ? D.esc(g.empfehlung ? g.empfehlung.text : '') : (r && r.k ? D.esc(r.st.wort) : '')),
      kz: [{ l: 'Bodenrichtwert', v: bo.verfuegbar ? dez(bo.brw_qm, 0) + ' €/m²' : 'kein Wert', s: bo.verfuegbar ? 'amtlich, Stichtag ' + stichtagText(bo.stichtag) : (w.grund === 'ohne_anschrift' ? 'ohne Anschrift keine Zone' : 'nicht ermittelt') },
        g ? { l: 'Investor Deal Score', v: g.score + ' / 100', s: g.empfehlung ? g.empfehlung.text : '' } : (r && r.k ? { l: 'Deal Score', v: r.ds.score + ' / 100', s: r.st.wort } : null),
        r && r.k ? { l: 'Cashflow', v: eurS(r.k.cf_m), s: 'im Monat nach Finanzierung', art: r.k.cf_m < 0 ? 'schlecht' : 'gut' } : null,
        r && r.k ? { l: 'DSCR', v: r.k.d_total > 0 ? dez(r.k.dscr, 2) : 'entfällt', s: 'volles Jahr, heutige Eingaben' } : null].filter(Boolean),
      meta: [['Stand', d.stand], ['Unterlagen', (d.unterlagen.filter(function (u) { return u.gelesen; }).length || (z.unterlagen || 0)) + ' gelesen'], ['Bewertungsstichtag', stichtagText(m.stichtag) || d.stand]],
      hinweisRechts: 'Erstellt am ' + D.esc(d.stand) + '<br>Indikativ, kein Gutachten' }));

    /* Auf einen Blick */
    var blick = fazit(d);
    seiten.push(D.seite(c, 'Auf einen Blick', D.abschnitt('Zusammenfassung', 'Auf einen Blick', 'Die wichtigsten Zahlen dieses Berichts. Die Kapitel danach zeigen, woher sie kommen.')
      /* einzelcheck-2 · Wertindikation des führenden Verfahrens und Marktpreisindikation klar getrennt,
         DSCR mit derselben Wortwahl wie die App („volles Jahr, heutige Eingaben") */
      + D.kacheln([{ l: 'Kaufpreis', v: r && r.e.kp ? eur(r.e.kp) : 'fehlt' },
        { l: wi ? (VW_LANG[wi.verfahren] || 'Wertindikation') : 'Wertindikation', v: wi ? eur(wi.wert_eur) : 'keine', s: wi ? 'führendes Verfahren, ImmoWertV' + (wi.stufe === 'M' ? ', aus Angebotspreisen abgeleitet' : '') : 'kein führendes Verfahren', art: 'hi' },
        { l: 'Marktpreisindikation', v: m.markt && m.markt.wert > 0 ? eur(m.markt.wert) : 'keine', s: 'Angebotspreise abzüglich Verhandlungsabschlag, kein Verkehrswert' }, { l: 'Bodenrichtwert', v: bo.verfuegbar ? dez(bo.brw_qm, 0) + ' €/m²' : 'kein Wert' }])
      + (r && r.k ? D.kacheln([{ l: 'Bruttorendite', v: D.pct(r.k.bmy), s: 'Faktor ' + D.zahl(r.k.fak, 1) }, { l: 'Nettorendite', v: D.pct(r.k.nmy) },
        { l: 'Cashflow', v: D.eurS(r.k.cf_m), s: 'im Monat nach Finanzierung', art: r.k.cf_m < 0 ? 'schlecht' : 'gut' }, { l: 'DSCR', v: r.k.d_total > 0 ? D.zahl(r.k.dscr, 2) : 'entfällt', s: 'volles Jahr, heutige Eingaben' }]) : '')
      + (r && r.k && r.k.d_total > 0 ? '<p class="sub">' + D.esc(dscrSatz(r, d.fin)) + '</p>' : '')
      + (g ? D.scoreRing(g.score, g.empfehlung ? g.empfehlung.text : '') : (r && r.k ? D.scoreRing(r.ds.score, r.st.wort) : ''))
      + (blick.length ? '<h3>Kurz gesagt</h3><ul>' + blick.map(function (x) { return '<li>' + D.esc(x) + '</li>'; }).join('') + '</ul>' : '')
      + '<div class="hinweis">Orientierung für deine Entscheidung, keine Rechts-, Steuer- oder Finanzierungsberatung. Alle Werte sind indikativ.</div>'));

    /* Objekt */
    seiten.push(D.seite(c, 'Objekt', D.abschnitt('Das Objekt', 'Objekt und Miete', 'Deine Grundangaben, ergänzt um das, was in deinen Unterlagen steht.')
      + D.liste(objektZeilen(z, gr), ['Merkmal', 'Wert'])
      + ((z.ek_klasse || z.endenergie > 0) ? '<h3>Energie</h3>' + D.energieSkala(z.ek_klasse, z.endenergie) : '')));

    /* Finanzierung */
    /* einzelcheck-2 · Finanzierung auf zwei ganzen Seiten statt einer übergelaufenen: Überblick und Anschluss,
       danach Rate und Cashflow je Phase mit eigenem Kopf (gemessen 24.11.2026: 327 mm auf einer A4-Seite) */
    if (r && r.k) {
      var fh = finanzSeite(D, d.fin, r), ph = /<!--PHASE-->([\s\S]*)<!--\/PHASE-->/.exec(fh);
      seiten.push(D.seite(c, 'Finanzierung', D.abschnitt('Die Finanzierung', 'Finanzierung und Anschluss', annahmeText(r)) + (ph ? fh.replace(ph[0], '') : fh)));
      if (ph) seiten.push(D.seite(c, 'Rate und Cashflow', D.abschnitt('Die Finanzierung', 'Rate und Cashflow je Phase', 'Heute und im Anschluss nach der Zinsbindung, Monat für Monat wie der Tilgungsplan einer Bank.') + ph[1].replace('<h3>Rate und Cashflow je Phase</h3>', '')));
    }

    /* Wertermittlung */
    seiten.push(D.seite(c, 'Wertermittlung', D.abschnitt('Wertermittlung nach ImmoWertV', 'Bodenrichtwert und Verfahren',
      'Wertermittlungsstichtag ' + (stichtagText(m.stichtag) || d.stand) + '. Gerechnet mit dem Marktbericht von DealPilot auf Stufe 3, mit amtlichen Werten der Gutachterausschüsse.') + wertSeite(D, m, r)));

    /* Investor Deal Score */
    if (ds2 && g) {
      var gruppen = function (t) { return (t.gruppen || []).filter(function (x) { return istZahl(x.score); }).map(function (x) { return [x.name || x.titel || x.key || '', Math.round(x.score) + ' / 100']; }); };
      seiten.push(D.seite(c, 'Investor Deal Score', D.abschnitt('Gesamturteil', 'Investor Deal Score', 'Gerechnet mit dem Kern der App (Profil Standard) aus deinen Grundangaben und Unterlagen.')
        + D.scoreRing(g.score, g.empfehlung ? g.empfehlung.text : '')
        + D.kacheln([{ l: 'Investment-Score', v: ds2.investment.score + ' / 100', s: 'Anteil ' + dez(ds2.investment.anteil, 1) + ' %', art: ds2.investment.score >= 70 ? 'gut' : '' },
          { l: 'Finanzierungs-Score', v: ds2.finanzierung.score + ' / 100', s: ds2.finanzierung.gedeckelt ? 'begrenzt durch den DSCR' : 'Anteil ' + dez(ds2.finanzierung.anteil, 1) + ' %', art: ds2.finanzierung.score >= 70 ? 'gut' : '' },
          { l: 'Gesamturteil', v: g.empfehlung ? g.empfehlung.text : 'offen', s: d.ds2.belastbar ? 'belastbar' : 'noch wenige Kennzahlen (' + d.ds2.n + ' von ' + d.ds2.von + ')', art: 'hi' }], true)
        + '<div class="zwei"><div><h3>Investment</h3>' + D.liste(gruppen(ds2.investment), ['Gruppe', 'Punkte']) + '</div><div><h3>Finanzierung</h3>' + D.liste(gruppen(ds2.finanzierung), ['Gruppe', 'Punkte']) + '</div></div>'));
    }

    /* Mietpotenzial */
    if (d.miete) {
      var mi = d.miete;
      seiten.push(D.seite(c, 'Mietpotenzial', D.abschnitt('Miete', 'Mietpotenzial und Obergrenze', 'Ist-Miete gegen die ortsübliche Vergleichsmiete und das, was rechtlich höchstens drin ist.')
        + D.kacheln([{ l: 'Ist-Miete', v: D.zahl(mi.ist_qm, 2) + ' €/m²' },
          { l: 'Vergleichsmiete', v: mi.vgl_qm ? (mi.vgl && mi.vgl.ca ? 'ca. ' : '') + D.zahl(mi.vgl_qm, 2) + ' €/m²' : 'kein Wert', s: mi.vgl_qm ? mi.vgl_herkunft : 'keine amtlichen Mietdaten für den Ort' },
          { l: 'Marktdurchschnitt', v: mi.markt_qm ? D.zahl(mi.markt_qm, 2) + ' €/m²' : 'nicht ermittelt', s: 'Angebotsmieten, Neuvermietung' }], true)
        + '<h3>Obergrenze für Investoren</h3>' + D.liste(mieteZeilen(mi), ['Miete', 'im Monat', 'Abstand im Monat', 'Abstand im Jahr'])
        + '<ul>' + mieteSaetze(mi).map(function (t) { return '<li>' + D.esc(t) + '</li>'; }).join('') + '</ul>'));
    }

    /* Lage und Markt */
    if (m.verfuegbar) {
      var lz = [];
      if (istZahl(m.lage.mikro)) lz.push({ l: 'Mikrolage', v: Math.round(m.lage.mikro) + ' / 100', s: 'Umfeld im Umkreis' });
      if (istZahl(m.lage.makro)) lz.push({ l: 'Makrolage', v: Math.round(m.lage.makro) + ' / 100', s: 'Region' });
      if (m.markt && m.markt.miete_qm > 0) lz.push({ l: 'Marktmiete', v: D.zahl(m.markt.miete_qm, 2) + ' €/m²', s: 'aktueller Marktdurchschnitt' });
      if (istZahl(m.lage.angebotsdauer_tage)) lz.push({ l: 'Angebotsdauer', v: Math.round(m.lage.angebotsdauer_tage) + ' Tage', s: 'Markttempo' });
      var tr = function (n) { return (n >= 0 ? '+' : '−') + D.zahl(Math.abs(n), 1) + ' % im Jahr'; };
      var trends = [];
      if (m.markt && istZahl(m.markt.preis_trend_pct)) trends.push('Angebotspreise ' + tr(m.markt.preis_trend_pct));
      if (m.markt && istZahl(m.markt.miete_trend_pct)) trends.push('Angebotsmieten ' + tr(m.markt.miete_trend_pct));
      seiten.push(D.seite(c, 'Lage und Markt', D.abschnitt('Der Standort', 'Lage und Markt', 'Stichtag ' + (stichtagText(m.stichtag) || d.stand) + '. Ermittelt mit dem Marktbericht von DealPilot.')
        + (lz.length ? D.kacheln(lz) : '<p>Für diesen Ort liegen keine Lagekennzahlen vor.</p>')
        + (istZahl(m.lage.bevoelkerung_trend_pct) ? '<p>Bevölkerung in der Region: ' + (m.lage.bevoelkerung_trend_pct >= 0 ? '+' : '−') + D.zahl(Math.abs(m.lage.bevoelkerung_trend_pct), 1) + ' %.</p>' : '')
        + (trends.length ? '<p>Entwicklung: ' + D.esc(trends.join(', ')) + '.</p>' : '')
        /* einzelcheck-2 · die Marktpreisindikation steht nur noch im Kapitel Wertermittlung (dort getrennt von den Verfahren) */
        + '<div class="hinweis">Indikative Werte, kein Verkehrswertgutachten nach § 194 BauGB. Jede Zahl nennt ihre Herkunft. Fehlt eine Zahl, erfindet DealPilot keine.</div>'));
      if (m.text && m.text.length) {
        var html = '', liste = [];
        var ausListe = function () { if (liste.length) { html += '<ul>' + liste.join('') + '</ul>'; liste = []; } };
        m.text.forEach(function (b) {
          if (b.art === 'li') { liste.push('<li>' + D.esc(b.text) + '</li>'); return; }
          ausListe();
          html += b.art === 'h' ? '<h3>' + D.esc(kapitel(b.text)) + '</h3>' : '<p>' + D.esc(b.text) + '</p>';
        });
        ausListe();
        seiten.push(D.seite(c, 'Einschätzung', D.abschnitt('Einordnung', 'Einschätzung zu Lage, Markt und Wert', 'Text des Marktberichts, aus den Zahlen dieses Berichts formuliert.')
          + '<div class="fliess">' + html + '</div><div class="hinweis">KI-gestützt formuliert und gegen die Zahlen des Berichts geprüft. Maßgeblich sind die Zahlen mit ihrer Herkunft. Orientierung, keine Beratung.</div>'));
      }
    } else {
      seiten.push(D.seite(c, 'Lage und Markt', D.abschnitt('Der Standort', 'Lage und Markt')
        + '<p>' + (m.grund === 'ohne_ort' ? 'In den Angaben stand kein Ort. Ohne Postleitzahl oder Ort rechnet der Marktbericht nicht.' : 'Der Marktbericht war gerade nicht erreichbar. In DealPilot holst du ihn mit einem Klick nach.') + '</p>'));
    }

    /* einzelcheck-2 (Marcel 24.11.2026: „Unterlagen und Hinweise … den können wir vielleicht rauslassen“): Seite entfällt.
       Was die Unterlagen ergeben, steht in Objekt, Finanzierung und Wertermittlung. */
    var ud = [];
    if (ud.length) {
      seiten.push(D.seite(c, 'Unterlagen', D.abschnitt('Deine Unterlagen', 'Unterlagen und Hinweise', 'Personendaten wurden vor dem Auslesen geschwärzt.')
        + ud.map(function (u) {
          return '<div class="block"><h3>' + D.esc(u.art) + '</h3>' + (u.gelesen ? (u.texterkennung ? '<p>Gescannt, per Texterkennung gelesen' + (u.texterkennung.gekuerzt ? ', die ersten ' + u.texterkennung.seiten + ' Seiten' : '') + (u.texterkennung.schwer_lesbar ? ', schwer lesbar' : '') + '.</p>' : '') : '<p>' + D.esc(GRUND[u.grund] || 'nicht gelesen') + '.</p>')
            + (u.kernpunkte && u.kernpunkte.length ? '<ul>' + u.kernpunkte.map(function (k) { return '<li>' + D.esc(kundenSatz(k)) + '</li>'; }).join('') + '</ul>' : '')
            + (u.risiken && u.risiken.length ? D.liste(u.risiken.map(function (x) { return [x.titel, x.schwere, { det: kundenSatz(x.beschreibung) }]; }), ['Hinweis', 'Gewicht']) : '') + '</div>';
        }).join('')));
    }

    /* Quellen und Methodik */
    var stufen = {};
    (w.verfahren || []).forEach(function (v) { if (v.verfuegbar && v.stufe) stufen[v.stufe] = 1; });
    var STUFE_LANG = { A: 'amtlicher Wert des zuständigen Gutachterausschusses', B: 'amtlich, mit großer Streuung oder regional', C: 'indikativ, aus amtlichen Werten abgeleitet',
      D: 'gesetzlicher Auffangwert nach § 256 BewG', E: 'eigene Angabe', M: 'aus Angebotspreisen abgeleitet, indikativ', N: 'abgeleitet aus der DealPilot-Formel, nicht amtlich' };
    var qn = (w.quellen || []);
    var quellenHtml = (D.abschnitt('Herkunft', 'Quellen und Methodik', 'Wie dieser Bericht rechnet und woher die amtlichen Werte stammen.')
      + '<ul><li>Rendite, Cashflow, DSCR und Finanzierung rechnen die Rechenkerne der DealPilot-App, Monat für Monat wie ein Tilgungsplan.</li>'
      + '<li>Die Wertermittlung folgt der ImmoWertV: Bodenrichtwert, Ertrags-, Sach- und Vergleichswertverfahren mit den Daten des zuständigen Gutachterausschusses. Das führende Verfahren richtet sich nach der Art des Objekts (§ 6 Abs. 1 ImmoWertV).</li>'
      + '<li>Mietpotenzial und Obergrenze nach §§ 556d, 558 BGB mit der ortsüblichen Vergleichsmiete und der Kappungsgrenze der Gemeinde.</li>'
      + '<li>Marktpreise und Marktmieten stammen aus dem aktuellen Marktdurchschnitt der Angebote, abzüglich eines Abschlags zwischen Angebots- und Kaufpreis.</li></ul>'
      + (Object.keys(stufen).length ? '<h3>Herkunftsstufen in diesem Bericht</h3><ul>' + Object.keys(stufen).sort().map(function (k) { return '<li><b>Stufe ' + k + '</b>: ' + D.esc(STUFE_LANG[k] || '') + '</li>'; }).join('') + '</ul>' : '')
      + (qn.length ? '<h3>Quellennachweis</h3><ol class="quellen">' + qn.map(function (q) {
          return '<li>' + D.esc(q.vermerk) + (q.kennzahlen && q.kennzahlen.length ? ' (' + D.esc(q.kennzahlen.join(' und ')) + ')' : '') + (q.jahrgang ? ', Berichtsjahr ' + D.esc(String(q.jahrgang)) : '') + (q.lizenz ? ', ' + D.esc(q.lizenz) : '') + '</li>';
        }).join('') + '</ol>' : '')
      + '<div class="hinweis">Indikative Wertermittlung, kein Verkehrswertgutachten nach § 194 BauGB. Keine Rechts-, Steuer- oder Finanzierungsberatung.</div>');

    /* Weg in die App */
    var an = d.status && d.status.anrechnung;
    /* einzelcheck-2 · Quellen und der Weg in die App teilen sich eine Seite (vorher zwei halb leere) */
    seiten.push(D.seite(c, 'Quellen und nächster Schritt', quellenHtml + '<div class="block">' + D.abschnitt('Der nächste Schritt', 'Weiter in DealPilot', 'Steuer, Finanzierung, Restnutzungsdauer und Wertermittlung im Detail.')
      + '<ul><li>Objekt anlegen: Die Zahlen dieses Berichts übernimmt DealPilot beim Start über die Pakete der Startseite.</li>'
      + (an ? '<li>Anrechnung: Buchst du bis ' + D.esc(datum(an.bis)) + ' ein Paket, rechnet DealPilot ' + D.esc(dez(an.cents / 100, 2)) + ' € an. Code ' + D.esc(an.code) + '. ' + D.esc(KOMBI) + '</li>' : '')
      + '<li>Kostenlos starten: vier Wochen voller Pro-Umfang ohne Zahlungsdaten, danach automatisch Free.</li></ul>'
      + '<p>' + D.esc(appBasis()) + '</p></div>'));
    /* einzelcheck-2 (Marcel 24.11.2026: „immer ganze Seiten … relativ abgehackt“): Überschrift nie allein am Seitenende,
       Tabellen, Kacheln und Blöcke nicht zerreißen, Zeilen etwas dichter, damit ein Kapitel auf seine Seite passt */
    var doc = D.dokument('DealPilot Einzel-Check · ' + titel, seiten, { css: 'h2,h3{break-after:avoid;page-break-after:avoid}.block,.kz,.zwei,table,.hinweis,ul{break-inside:avoid;page-break-inside:avoid}td{padding-top:1.35mm;padding-bottom:1.35mm}h3{margin-top:5mm}' });
    if (nurHtml) return { html: doc, titel: titel };   /* einzelcheck-2 · Mail: dasselbe Dokument, ohne Vorschau */
    D.vorschau(doc, 'Einzel-Check · ' + titel);
    return doc;
  }

  /* Rückkehr von Stripe (Erfolgs- und Abbruchseite) ─────────────────── */
  function zeigeRueckkehr(hinweis) {
    stufe(4); var nr = ++schritt;
    var s = S.status || {};
    if (!s.bezahlt) {
      setze('<h3 id="ecTitel">' + (s.status === 'abgelaufen' ? 'Der Kauf ist abgelaufen.' : 'Die Zahlung ist noch nicht da.') + '</h3>' + (hinweis ? meldung(hinweis, 'warn') : '')
        + '<p class="ec-lead">' + (s.status === 'abgelaufen' ? 'Ein Kauf gilt 14 Tage.' : 'Ist die Zahlung abgeschlossen, erscheint sie hier in wenigen Sekunden.') + '</p>'
        + '<div class="ec-knoepfe"><button type="button" class="btn-l ec-pruef">Noch einmal prüfen</button><button type="button" class="btn-l ec-neu">Von vorn</button></div>', 'h3');
      $('.ec-pruef', inhalt).addEventListener('click', function () { statusLaden().then(function () { if (S.status && S.status.bezahlt) zeigeRueckkehr(); else zeigeRueckkehr(); }); });
      $('.ec-neu', inhalt).addEventListener('click', function () { S.frei = null; zeigeUnterlagen(); });
      return;
    }
    /* v3946 · nur noch der Notweg: die Ablage im Browser fehlte (privates Fenster) oder der Bericht schlug fehl */
    setze('<h3 id="ecTitel">Zahlung erhalten.</h3>' + (hinweis ? meldung(hinweis, 'warn') : '')
      + '<p class="ec-lead">' + (S.dateien.length ? 'Starte den Bericht hier noch einmal.' : 'Dein Browser hat die Unterlagen nicht aufbewahrt, zum Beispiel in einem privaten Fenster. Der Bericht rechnet mit deinen Grundangaben und den schon gelesenen Zahlen. Wenn du magst, wähle die Unterlagen noch einmal, dann liest DealPilot sie vollständig.') + '</p>'
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
  /* v3946 · Grundangaben aus dem beim Kauf gespeicherten Zahlenstand (Notweg ohne Ablage im Browser) */
  var GRUND_FELDER = ['kp', 'nkm', 'wfl', 'art', 'plz', 'ort', 'bj', 'gsfl', 'ze', 'nk_pct', 'mea_pct', 'ek_eur', 'zins_pct', 'tilg_pct', 'bindung_j'];
  function grundAusZahlen(z) { var g = {}; GRUND_FELDER.forEach(function (k) { if (z && z[k] != null) g[k] = z[k]; }); return grundFehlt(g).length ? null : g; }
  function rueckkehrPruefen() {
    var q = /[?&]einzelcheck=(bezahlt|abbruch)(&|$)/.exec(location.search || '');
    var h = /[#&]ec=([A-Za-z0-9_-]{40,60})/.exec(location.hash || '');
    if (!q) { ablage.lesen(); return; }   /* ohne Rückkehr: nur alte Einträge (über ABLAGE_STUNDEN) aufräumen */
    if (h) tokenMerken(h[1]);
    /* Token und Parameter aus der Adresszeile nehmen (kein Verlauf, kein Teilen mit Token) */
    try { history.replaceState(history.state, '', location.pathname); } catch (e) {}
    oeffnen();
    stufe(4); ++schritt;
    setze('<h3 id="ecTitel">Willkommen zurück.</h3><p class="ec-lead">DealPilot prüft die Zahlung.</p>'
      + '<div class="ec-lesen"><div class="ec-zeile an liest"><div class="ec-z-kopf"><b>Zahlung</b><span class="ec-z-st">wird geprüft</span></div><span class="ec-balken"><i style="width:100%"></i></span></div></div>', 'h3');
    /* v3946 · zuerst die Ablage dieses Kaufs zurückholen (Dateien, Grundangaben, kostenloses Ergebnis) */
    ablage.lesen().then(function (rec) {
      if (rec && rec.token === tokenLesen()) ablageEin(rec);
      var versuch = 0;
      (function los() {
        statusLaden().then(function (s) {
          if ((!s || !s.bezahlt) && q[1] === 'bezahlt' && ++versuch < 6) { setTimeout(los, 2500); return; }
          S.frei = S.frei || (s && s.zahlen ? { zahlen: s.zahlen, unterlagen: [] } : null);
          if (!S.grund && s && s.zahlen) S.grund = grundAusZahlen(s.zahlen);
          if (q[1] === 'abbruch' && !(s && s.bezahlt)) {
            ablage.loeschen();   /* die Dateien sind wieder im Arbeitsspeicher, ein neuer Kauf legt sie neu ab */
            if (S.frei) zeigeErgebnis('Die Zahlung wurde abgebrochen.'); else zeigeUnterlagen('Die Zahlung wurde abgebrochen.'); return;
          }
          if (s && s.bezahlt) { erstelleBericht(); return; }   /* v3946 · der Bericht startet von selbst */
          if (q[1] === 'bezahlt') { zeigeWarten(); return; }   /* fragt selbst weiter ab (abfragen) */
          zeigeRueckkehr();
        });
      })();
    });
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

  /* v3946 · _bericht/_pdf/_fin/_grundFehlt: für das Muster unter Dateien/Einzelcheck und den Prüfer, rechnen nichts Eigenes */
  window.DpEinzelCheck = { VERSION: VERSION, auf: auf, zu: zu, rechne: rechne, preis: 0, _S: S,
    _bericht: berichtDaten, _pdf: pdf, _fin: finanzierungAus, _grundFehlt: grundFehlt, _vorbelegung: vorbelegung };
  preisLaden();
  rueckkehrPruefen();
})();
