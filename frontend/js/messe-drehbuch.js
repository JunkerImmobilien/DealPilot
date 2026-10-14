'use strict';
/* ═══════════════════════════════════════════════════════════════════
   messe-drehbuch.js — v2219 · Selbstlaufende Drehbücher für Messe-Videos

   Marcel, 14.10.2026: „ich brauche Messe-Videos … mach mal so ein Drehbuch
   fertig." Vorschlag (angenommen): kein abgefilmtes Klicken, sondern ein
   Drehbuch IN der App. Es bedient die echte Oberfläche, legt einen Lichtkegel
   auf die Stelle und schreibt eine Untertitelzeile darunter. Aufnehmen mit
   OBS oder Win+Alt+R; am Stand kann es auch live in Schleife laufen.

   Drehbücher: parkstrasse (v2219), quickcheck (v2222: Datenaufnahme mit zwei
   PDFs, Marktwertindikation, Spanne, Bewertung, Lage), quickcheck-tippen (v2221)
   Start:  ?messe=parkstrasse            einmal
           ?messe=parkstrasse&schleife   immer wieder (Messebildschirm)
           DealPilotMesse.start('parkstrasse')
   Ende:   Esc oder der ■-Knopf unten rechts.

   REGEL: Jede Zahl im Untertitel wird LIVE aus der App gelesen (Ankauf-Stand,
   Abweichung, Steuerverlauf) - nichts ist abgetippt. Fehlt eine Zahl, fällt der
   Satzteil weg, statt eine erfundene einzusetzen.

   Das Drehbuch ÄNDERT nichts am Objekt: es klickt nur Reiter und den Ist/Soll-
   Umschalter und stellt am Ende „Ist" wieder her.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DealPilotMesse) return;
  var G = 'var(--wl-c9a84c, #C9A84C)', GH = 'var(--wl-e8cc7a, #E8CC7A)', GL = 'var(--wl-b8932f, #b8932f)';
  function mix(c, p) { return 'color-mix(in srgb, ' + c + ' ' + p + '%, transparent)'; }
  function de(n, st) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: st || 0, maximumFractionDigits: st || 0 }); }
  function eur(n) { return (n == null || !isFinite(n)) ? null : de(Math.round(n)) + ' €'; }
  function datum(iso) { var t = String(iso || '').split('-'); return t.length === 3 ? t[2] + '.' + t[1] + '.' + t[0] : ''; }
  function warte(ms) { return new Promise(function (r, x) { var l = lauf; setTimeout(function () { l === lauf ? r() : x('stopp'); }, ms); }); }
  function q(sel) { return document.querySelector(sel); }
  /* v2219 · nur SICHTBARE Treffer: #ai-content steht zweimal im Dokument, die
     erste Kopie war unsichtbar - der Lichtkegel fiel auf 16 x 16 px zusammen. */
  function qs(sel) { return [].filter.call(document.querySelectorAll(sel), function (e) { var r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })[0] || null; }

  /* ── Bühne: Lichtkegel, Untertitel, Titelkarte ─────────────────── */
  function css() {
    if (q('#dpm-css')) return;
    var st = document.createElement('style'); st.id = 'dpm-css';
    st.textContent = [
      '#dpm-kegel{position:fixed;z-index:10070;pointer-events:none;border-radius:14px;box-shadow:0 0 0 9999px rgba(5,5,5,.58),0 0 0 3px ' + GH + ',0 0 40px 6px ' + mix(GH, 45) + ';transition:all .7s cubic-bezier(.5,0,.2,1);opacity:0}',
      '#dpm-kegel.an{opacity:1}',
      '#dpm-zeile{position:fixed;z-index:10072;left:50%;bottom:34px;transform:translate(-50%,20px);max-width:min(980px,92vw);padding:16px 26px 18px;border-radius:16px;background:rgba(10,9,7,.94);border:1px solid ' + mix(G, 60) + ';box-shadow:0 20px 60px rgba(0,0,0,.6);opacity:0;transition:opacity .4s,transform .4s;text-align:center}',
      '#dpm-zeile.an{opacity:1;transform:translate(-50%,0)}',
      '#dpm-zeile .k{font:600 11px "JetBrains Mono",monospace;letter-spacing:.2em;text-transform:uppercase;color:' + G + '}',
      '#dpm-zeile .t{font:600 26px/1.3 "Space Grotesk",sans-serif;color:#FDFCFA;margin-top:4px}',
      '#dpm-zeile .t b{color:' + GH + '}',
      '#dpm-zeile .p{display:flex;gap:6px;justify-content:center;margin-top:10px}',
      '#dpm-zeile .p i{width:22px;height:3px;border-radius:2px;background:#3a3324}',
      '#dpm-zeile .p i.an{background:' + GH + '}',
      '#dpm-karte{position:fixed;inset:0;z-index:10074;display:grid;place-items:center;text-align:center;background:radial-gradient(120% 80% at 20% 0%,' + mix(GH, 16) + ',transparent 60%),#050505;opacity:0;pointer-events:none;transition:opacity .6s}',
      '#dpm-karte.an{opacity:1;pointer-events:auto}',
      '#dpm-karte .k{font:600 13px "JetBrains Mono",monospace;letter-spacing:.26em;text-transform:uppercase;color:' + G + '}',
      '#dpm-karte h1{font:700 64px/1.05 "Space Grotesk",sans-serif;margin:14px 0 10px;letter-spacing:-.02em;background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');-webkit-background-clip:text;background-clip:text;color:transparent}',
      '#dpm-karte p{font:400 20px/1.5 Inter,sans-serif;color:#d9cfb8;margin:0}',
      '#dpm-karte .m{margin-top:34px;font:700 18px "Space Grotesk",sans-serif;color:#FDFCFA}',
      '#dpm-karte .m b{background:linear-gradient(110deg,' + GH + ',' + G + ' 55%,' + GL + ');-webkit-background-clip:text;background-clip:text;color:transparent}',
      '#dpm-stopp{position:fixed;z-index:10076;right:14px;bottom:14px;border:1px solid ' + mix(G, 50) + ';background:rgba(10,9,7,.8);color:' + GH + ';border-radius:8px;padding:4px 10px;font:600 12px "JetBrains Mono",monospace;cursor:pointer;opacity:.35}',
      '#dpm-stopp:hover{opacity:1}',
      '@media (max-width:640px){#dpm-zeile .t{font-size:18px}#dpm-karte h1{font-size:40px}#dpm-karte p{font-size:16px}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  function el(id, tag) { var e = document.getElementById(id); if (!e) { e = document.createElement(tag || 'div'); e.id = id; document.body.appendChild(e); } return e; }
  /* v2221 · Ziele im Quick-Check liegen in einem iframe (eigenes Dokument):
     ihr Rechteck ist relativ zum iframe - für den Kegel im Hauptdokument
     wird der Rahmen jeder Ebene dazugerechnet. */
  function rect(e) {
    var r = e.getBoundingClientRect(), x = r.left, y = r.top;
    for (var fe = e.ownerDocument.defaultView.frameElement; fe; fe = fe.ownerDocument.defaultView.frameElement) {
      var fr = fe.getBoundingClientRect(); x += fr.left + fe.clientLeft; y += fr.top + fe.clientTop;
    }
    return { left: x, top: y, width: r.width, height: r.height, bottom: y + r.height, right: x + r.width };
  }
  function kegel(ziel, pad) {
    var k = el('dpm-kegel');
    if (!ziel) { k.classList.remove('an'); return; }
    var r = rect(ziel); pad = pad == null ? 10 : pad;
    k.style.left = (r.left - pad) + 'px'; k.style.top = (r.top - pad) + 'px';
    k.style.width = (r.width + pad * 2) + 'px'; k.style.height = (r.height + pad * 2) + 'px';
    k.classList.add('an');
  }
  function zeile(kick, text, i, n) {
    var z = el('dpm-zeile');
    z.innerHTML = '<div class="k">' + kick + '</div><div class="t">' + text + '</div><div class="p">'
      + Array.apply(null, { length: n }).map(function (_, j) { return '<i class="' + (j <= i ? 'an' : '') + '"></i>'; }).join('') + '</div>';
    z.classList.add('an');
  }
  function zeileWeg() { var z = q('#dpm-zeile'); if (z) z.classList.remove('an'); }
  function karte(html) { var k = el('dpm-karte'); if (html == null) { k.classList.remove('an'); return; } k.innerHTML = '<div>' + html + '</div>'; k.classList.add('an'); }
  /* v2219b · Der Kegel FOLGT seinem Ziel: über einen Selektor, alle 200 ms neu
     aufgelöst. GEMESSEN: der Umschalter Ist/Soll baut sich beim Klick neu (der
     alte Knoten ist ausgehängt, Rechteck 0 x 0), und Reiter rendern nach - ein
     einmal gemessenes Rechteck war in vier von fünf Szenen 16 x 16 px. */
  var _ziel = null, _pad = 10, _folge = null;
  function zielEl() {
    if (!_ziel) return null;
    if (typeof _ziel === 'string') return qs(_ziel);
    if (typeof _ziel === 'function') { var f = _ziel(); return (f && f.getBoundingClientRect().width > 0) ? f : null; }
    return (_ziel.isConnected && _ziel.getBoundingClientRect().width > 0) ? _ziel : null;
  }
  /* v2219e/f · Ein Ziel, das nach dem Scrollen noch wächst (Soll/Ist-Kasten: 89 ->
     163 px), kann aus dem freien Bereich rutschen; dann wird nachgescrollt -
     höchstens dreimal je Ziel, frühestens alle 1,2 s, ohne Animation.
     ZURÜCKGENOMMEN: "Unterkante 9 px unter dem Fensterrand" war ein Messfehler -
     CSS-Pixel gegen die Höhe des Bildschirmfotos (726) verglichen; das Fenster
     hat bei 90 % Zoom 987 CSS-px, der Kasten lag frei. Immer innerHeight messen. */
  var _nachScroll = 0, _letzterScroll = 0;
  function frei(r) { return r.top >= 70 && r.bottom <= innerHeight - 170; }
  /* v2219f · scrollIntoView(smooth) kam im Drehbuch gemessen NIE an (Kasten blieb
     bei 572-736 stehen; dieselbe Zeile ohne smooth scrollte sofort). Gescrollt wird
     deshalb der Container selbst (.main-col), mittig in den freien Bereich. */
  function scroller(e) {
    /* v2221 · durch iframes hindurch: das Quick-Check-Dokument scrollt nicht
       selbst (es ist so hoch wie sein Inhalt), gescrollt wird .main-col */
    for (var a = e; a; a = a.ownerDocument.defaultView.frameElement) {
      var w = a.ownerDocument.defaultView;
      for (var s = a.parentElement; s && s !== a.ownerDocument.body; s = s.parentElement) {
        if (/auto|scroll/.test(w.getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight + 5) return s;
      }
    }
    return document.scrollingElement;
  }
  function holen(e, sanft) {
    var r = rect(e), s = scroller(e), mitte = (70 + innerHeight - 170) / 2;
    var d = r.height > innerHeight - 260 ? r.top - 80 : (r.top + r.height / 2) - mitte;
    try { s.scrollTo({ top: s.scrollTop + d, behavior: sanft ? 'smooth' : 'auto' }); } catch (x) { s.scrollTop += d; }
  }
  function folgen() {
    if (_folge) return;
    _folge = setInterval(function () {
      var z = zielEl(); if (!z) { kegel(null); return; }
      var r = rect(z);
      if (!frei(r) && _nachScroll < 3 && Date.now() - _letzterScroll > 1200) {
        _nachScroll++; _letzterScroll = Date.now();
        holen(z, false);
      }
      kegel(z, _pad);
    }, 200);
  }
  async function zeige(ziel, pad) {
    _ziel = ziel || null; _pad = pad == null ? 10 : pad;
    /* v2219d · Szenenwechsel: die alte Zeile geht mit dem alten Ziel (sie stand
       gemessen 2-3 s über dem nächsten Reiter) */
    if (!_ziel) { kegel(null); zeileWeg(); return; }
    var z = zielEl();
    /* nur scrollen, wenn das Ziel nicht frei sichtbar ist - sonst schiebt es den
       Umschalter oben aus dem Bild; unten liegt die Zeile (rund 160 px) */
    _nachScroll = 0; _letzterScroll = 0;
    if (z && !frei(rect(z))) { _letzterScroll = Date.now(); holen(z, true); }
    folgen();
    await warte(750);
  }
  /* v2219f · jeder Reiter beginnt oben: die Scrollposition des vorigen blieb
     stehen, der kürzere Steuer-Reiter zeigte gemessen eine leere Fläche */
  function reiter(sec) { var t = q('.tab[data-target-sec="' + sec + '"]'); if (t) t.click(); var m = q('.main-col'); if (m) m.scrollTop = 0; }
  /* v2221 · Quick-Check: Dokument, Feld, Tippen wie von Hand (Zeichen für
     Zeichen mit input-Ereignis - der Quick-Check rechnet bei jedem Zeichen) */
  function qcDoc() { var f = q('#qc-v17-frame'); try { return f && f.contentDocument; } catch (e) { return null; } }
  function qcEl(id) { var d = qcDoc(); return d && d.getElementById(id); }
  function qcGruppe(k) { var i = qcEl('ico-grp-' + k); return i && i.closest('.card'); }
  async function tippe(id, text, ms) {
    var e = qcEl(id); if (!e) return; var w = e.ownerDocument.defaultView;
    function los(typ) { e.dispatchEvent(new w.Event(typ, { bubbles: true })); }
    if (e.tagName === 'SELECT') { e.value = text; los('input'); los('change'); await warte(ms || 300); return; }
    e.value = ''; los('input');
    for (var i = 0; i < text.length; i++) { e.value = text.slice(0, i + 1); los('input'); await warte(ms || 70); }
    los('change');
  }
  function qcText(id) { var e = qcEl(id); return e ? e.innerText.replace(/\s+/g, ' ').trim() : ''; }
  /* KPI-Kachel: "Cashflow/Mo-147€Ziel ≥0€" -> der Wert zwischen Titel und "Ziel" */
  function qcKpi(id, titel) { var t = qcText(id); var m = t.replace(titel, '').split('Ziel')[0].trim(); return m || null; }
  function qcWin() { var f = q('#qc-v17-frame'); return f && f.contentWindow; }
  function qcSetze(id, v) {
    var e = qcEl(id); if (!e) return; var w = e.ownerDocument.defaultView;
    e.value = v; e.dispatchEvent(new w.Event('input', { bubbles: true })); e.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
  function qcSel(sel) { var d = qcDoc(); return d && d.querySelector(sel); }
  function qcScore() { return { n: qcText('sb-num'), stufe: qcText('sb-tier'), urteil: qcText('ai-verdict-headline') }; }
  function qcAufraeumen() {
    /* „Neuer Vorgang": löscht den Boarding-Pass, den der Quick-Check beim ersten
       Score selbst anlegt, und leert das Fenster - sonst hinterlässt jede
       Schleife einen Pass (gemessen: DELETE /passes/<code>) */
    try { window.postMessage({ source: 'dp-qc', type: 'qc-reset-buffer' }, '*'); } catch (e) {}
  }
  function nkmFeld() { var n = q('#nkm'); return n && n.closest('.f'); }
  async function warteAuf(fn, ms) { var t0 = Date.now(); while (Date.now() - t0 < (ms || 6000)) { var v = fn(); if (v) return v; await warte(150); } return null; }

  /* ── Objekt finden: über die Anschrift, nicht über eine Kennung ─────
     Die UUID auf Staging ist auf Prod eine andere. */
  async function objektFinden(muster) {
    var r = await Auth.apiCall('/objects', { method: 'GET' });
    var l = Array.isArray(r) ? r : (r.data || r.items || r.objects || Object.values(r).filter(Array.isArray)[0] || []);
    var o = l.filter(function (x) { return muster.test(JSON.stringify(x)); })[0];
    return o ? o.id : null;
  }

  /* ═══ DREHBUCH 1 · PARKSTRASSE 9 — ALTBAU MIT HEBEL ══════════════════ */
  var DREHBUECHER = {
    parkstrasse: {
      titel: 'Altbau mit Hebel',
      unterzeile: 'Parkstraße 9 · Bad Oeynhausen · Mehrfamilienhaus von 1905',
      objekt: /Parkstr(\.|aße|asse) ?9/i,
      szenen: [
        async function (s) {
          reiter('s0'); await warte(600);
          await zeige('.ank-ansicht-kopf', 8);
          var A = window.DealPilotAnkauf && DealPilotAnkauf.stand();
          var kp = A && A.kurz ? eur(A.kurz.kp) : null;
          s.zeile('Gekauft', 'Gekauft am <b>' + datum(A && A.stichtag) + '</b>' + (kp ? ' für <b>' + kp + '</b>' : '') + ' — im Bestand.');
          await warte(5200);
        },
        async function (s) {
          /* v2219d · Der Kegel zeigt erst den Umschalter, dann die Miete selbst:
             vorher stand die Zahl nur in der Zeile, in der App sah man sie nicht */
          await zeige(null); reiter('s2'); await warte(900);
          var seg = await warteAuf(function () { return [].filter.call(document.querySelectorAll('.ank-wahl .ank-seg'), function (b) { return /Soll/.test(b.textContent); })[0]; });
          await zeige('.ank-wahl', 8);
          if (seg) seg.click();
          await warteAuf(function () { return window.DealPilotAnkaufAnsicht && DealPilotAnkaufAnsicht.aktiv(); }, 8000);
          await warte(500);
          await zeige(nkmFeld, 10);
          var K = (DealPilotAnkauf.stand() || {}).kurz || {};
          var teile = [];
          if (K.nkm != null) teile.push('<b>' + eur(K.nkm) + '</b> Nettokaltmiete');
          if (K._leer_einheiten) teile.push('<b>' + K._leer_einheiten + '</b> ' + (K._leer_einheiten === 1 ? 'Wohnung' : 'Wohnungen') + ' leer');
          if (K._kpis_dscr != null) teile.push('DSCR <b>' + de(K._kpis_dscr, 2) + '</b>');
          s.zeile('Soll · der Plan beim Kauf', 'Eingefroren mit dem Nutzen-/Lastenwechsel: ' + teile.join(', ') + '.');
          await warte(6500);
        },
        async function (s) {
          var seg = [].filter.call(document.querySelectorAll('.ank-wahl .ank-seg'), function (b) { return /Ist/.test(b.textContent); })[0];
          zeileWeg(); await zeige('.ank-wahl', 8);
          if (seg) seg.click();
          /* erst weiter, wenn die Ankauf-Ansicht wirklich gelöst ist (der Ist-Stand neu geladen) */
          await warteAuf(function () { return window.DealPilotAnkaufAnsicht && !DealPilotAnkaufAnsicht.aktiv(); }, 8000);
          await warte(400);
          /* gemessen: das Zurückladen des Ist springt auf den Reiter Objekt */
          reiter('s2'); await warte(700);
          await zeige(nkmFeld, 10);
          var nkm = parseFloat(String((q('#nkm') || {}).value || '').replace(/\./g, '').replace(',', '.'));
          s.zeile('Ist · heute', 'Eine Wohnung saniert und neu vermietet: <b>' + (isFinite(nkm) ? eur(nkm) : '–') + '</b> Nettokaltmiete.');
          await warte(5500);
        },
        async function (s) {
          await zeige(null); reiter('s5'); await warte(1200);
          var tab = await warteAuf(function () { return [].filter.call(document.querySelectorAll('#ai-content .dp-pa-tab'), function (b) { return /Soll\/Ist/.test(b.textContent) && b.getBoundingClientRect().width > 0; })[0]; });
          if (tab) tab.click();
          await warte(600);
          var a = null; try { a = DealPilotAnkauf.abweichung(); } catch (e) {}
          function z(wort) { return a && a.zeilen.filter(function (x) { return x.wort === wort; })[0]; }
          var teile = [], d = z('DSCR'), c = z('Cashflow n. Steuer'), sc = z('DealScore');
          if (d) teile.push('DSCR <b>' + de(d.ankauf, 2) + ' → ' + de(d.bestand, 2) + '</b>');
          /* v2219d · kürzer: mit "Cashflow n. St." und "DealScore" brach die Zeile
             bei 1568 px um, die 59 stand allein in der zweiten */
          if (c) teile.push('Cashflow <b>' + eur(c.ankauf) + ' → ' + eur(c.bestand) + '</b>');
          if (sc) teile.push('Score <b>' + de(sc.ankauf) + ' → ' + de(sc.bestand) + '</b>');
          await zeige(qs('#ai-content .abw-bewegt') ? '#ai-content .abw-bewegt' : '#ai-content .abw-tafel', 10);
          s.zeile('Soll gegen Ist · automatisch', teile.join(' · ') || 'Plan gegen heute, Kennzahl für Kennzahl.');
          await warte(7500);
        },
        async function (s) {
          await zeige(null); reiter('s3-tax'); await warte(1400);
          /* der Steuerverlauf baut sich nach dem Laden der Steuerdaten NEU - das
             Ziel wird deshalb bei jedem Nachführen frisch gesucht */
          var balken2025 = function () { return [].filter.call(document.querySelectorAll('#s3-tax .tax-tl-bar'), function (b) { return /^\s*2025/.test(b.textContent) && b.getBoundingClientRect().width > 0; })[0] || null; };
          var bar = await warteAuf(balken2025, 8000);
          await warte(800);
          bar = balken2025() || bar;
          var betrag = bar ? (bar.querySelector('.tax-tl-amount') || {}).textContent : null;
          await zeige(bar ? balken2025 : '#s3-tax .tax-timeline-card', 8);
          s.zeile('Steuer 2025', 'Die Sanierung als Erhaltungsaufwand sofort abgesetzt' + (betrag ? ' — Erstattung <b>' + String(betrag).replace(/^\+/, '').trim() + '</b>' : '') + '.');
          await warte(7500);   /* v2219e: der Weg zum Balken 2025 kostet gemessen gut 2 s Scrollen */
        }
      ],
      schluss: '<div class="k">DealPilot</div><h1>Plan gegen Ist.</h1><p>Der Ankauf bleibt stehen — jedes Jahr misst sich daran.</p><div class="m">Deal<b>Pilot</b> · dealpilot.immo</div>'
    },

    /* ═══ DREHBUCH 2 · QUICK-CHECK — LOHNT SICH DAS EXPOSÉ? (v2221) ════════
       Beispielwohnung, bewusst als solche erkennbar (Musterweg). Nur die
       getippten Eingaben stehen fest; Score und Kennzahlen rechnet der echte
       Quick-Check und das Drehbuch liest sie ab. Kein „Abrufen" - das kostet
       Kontingent. Am Ende „Neuer Vorgang" (räumt den Boarding-Pass ab). */
    'quickcheck-tippen': {
      titel: 'Lohnt sich das Exposé?',
      unterzeile: 'Quick Boarding · eine Wohnung, eine Minute, ein Urteil',
      objekt: null,
      aufraeumen: function () { qcAufraeumen(); reiter('s0'); },
      szenen: [
        async function (s) {
          if (typeof window.sbActionsAction === 'function') sbActionsAction('quickcheck');
          await warteAuf(function () { var d = qcDoc(); return d && d.readyState === 'complete' && qcEl('qc_kp') && !qcEl('qc_kp').value; }, 10000);
          await warte(900);
          var m = q('.main-col'); if (m) m.scrollTop = 0;
          await zeige(function () { return qcGruppe('adr'); }, 6);
          s.zeile('Exposé auf dem Tisch', 'Eine Eigentumswohnung in Bielefeld — die Eckdaten aus dem Exposé.');
          await tippe('qc_str', 'Musterweg'); await tippe('qc_hnr', '7'); await tippe('qc_plz', '33602'); await tippe('qc_ort', 'Bielefeld');
          await zeige(function () { return qcGruppe('obj'); }, 6);
          await tippe('qc_objektart', 'ETW'); await tippe('qc_wfl', '72'); await tippe('qc_bj', '1994');
          await zeige(function () { return qcGruppe('miete'); }, 6);
          await tippe('qc_nkm_grund', '680');
          await zeige(function () { return qcGruppe('bewirt'); }, 6);
          await tippe('qc_hg', '230');
          await zeige(function () { return qcGruppe('fin'); }, 6);
          s.zeile('Exposé auf dem Tisch', 'Kaufpreis laut Exposé: <b>159.000 €</b>. Eigenkapital, Zins und Tilgung kommen aus deinen Standardwerten.');
          await tippe('qc_kp', '159000', 90);
          await warte(1800);
        },
        async function (s) {
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warteAuf(function () { return /\d/.test(qcText('sb-num')); }, 5000);
          await warte(900);
          var sc = qcText('sb-num'), st = qcText('sb-tier'), dscr = qcKpi('kpi-dscr', 'DSCR'), cf = qcKpi('kpi-cf', 'Cashflow/Mo');
          s.zeile('Das Urteil · in Sekunden', 'Score <b>' + sc + '</b> · ' + st + (dscr ? ' — DSCR <b>' + dscr + '</b>' : '') + (cf ? ', Cashflow <b>' + cf + '</b> im Monat' : '') + '.');
          await warte(6500);
        },
        async function (s) {
          await zeige(function () { return qcGruppe('fin'); }, 6);
          s.zeile('Und wenn der Preis fällt?', 'Verhandelt auf <b>129.000 €</b> …');
          await tippe('qc_kp', '129000', 110);
          await warte(1200);
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warte(1200);
          var sc = qcText('sb-num'), st = qcText('sb-tier'), dscr = qcKpi('kpi-dscr', 'DSCR'), cf = qcKpi('kpi-cf', 'Cashflow/Mo');
          s.zeile('Und wenn der Preis fällt?', 'Bei 129.000 €: Score <b>' + sc + '</b> · ' + st + (dscr ? ' — DSCR <b>' + dscr + '</b>' : '') + (cf ? ', Cashflow <b>' + cf + '</b>' : '') + '. Jetzt lohnt die Besichtigung.');
          await warte(7500);
        }
      ],
      schluss: '<div class="k">DealPilot</div><h1>Erst rechnen, dann besichtigen.</h1><p>Quick Boarding prüft ein Exposé, bevor du ins Auto steigst.</p><div class="m">Deal<b>Pilot</b> · dealpilot.immo</div>'
    },

    /* ═══ DREHBUCH 3 · QUICK BOARDING MIT DATENAUFNAHME (v2222) ════════════
       Marcel 14.10.2026: „mit der Datenaufnahme … ein Exposé laden und auch
       die Marktwertindikation abrufen … wo dann auch Spanne reingeht … den
       Score zeigen mit schwach, solide und gut, unten die Bewertung und wie
       der Lagewert eingeht" - mit seinen zwei PDFs aus Dokumente/Expose.

       ZWEI MITSCHNITTE, beide am 14.10.2026 echt erzeugt und hier nur
       wiedergegeben (kein KI-, kein Marktbericht-Abruf je Durchgang):
       QC_IMPORT  = ObjectActions._voice.mitschnitt() nach dem echten Einlesen
                    beider PDFs (Typ-Erkennung und KI-Auslese wie im Betrieb).
                    Dateinamen neutral; die Auslesewerte sind unverändert -
                    auch der Fehler „wertentwicklung_3jahre_pct 14,1" (im PDF
                    steht -1,65 %), er erscheint im Quick-Check nicht.
       MB_KARTE   = #_mb_state.card nach DealPilotMBQc.run() für dieses Objekt.
       Alles danach rechnet der echte Quick-Check; Score, Urteil, Zielpreis
       und Lagesatz liest das Drehbuch ab. Die Klicks auf die Spanne ändern
       qc_span_config im Browser - der Wert wird vorher gesichert und beim
       Aufräumen zurückgeschrieben. */
    quickcheck: {
      titel: 'Exposé rein, Urteil raus',
      unterzeile: 'Quick Boarding · zwei PDFs, eine Marktwertindikation, ein Urteil',
      objekt: null,
      aufraeumen: function () {
        var ov = q('#oabi-ov'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
        try { if (_spanVorher === null) localStorage.removeItem('qc_span_config'); else if (_spanVorher !== undefined) localStorage.setItem('qc_span_config', _spanVorher); } catch (e) {}
        _spanVorher = undefined;
        qcAufraeumen(); reiter('s0');
      },
      szenen: [
        async function (s) {   /* 1 · Datenaufnahme: zwei PDFs */
          try { _spanVorher = localStorage.getItem('qc_span_config'); } catch (e) { _spanVorher = undefined; }
          if (typeof window.sbActionsAction === 'function') sbActionsAction('quickcheck');
          await warteAuf(function () { var d = qcDoc(); return d && d.readyState === 'complete' && qcEl('qc_kp') && !qcEl('qc_kp').value && qcEl('qc7-sources'); }, 10000);
          await warte(900);
          var m = q('.main-col'); if (m) m.scrollTop = 0;
          await zeige(function () { return qcEl('qc7-sources'); }, 6);
          s.zeile('Datenaufnahme', 'Zwei PDFs zur Wohnung: das Exposé vom Makler und ein Marktbericht.');
          await warte(2600);
          window.postMessage({ source: 'dp-qc', type: 'qc-import-pdf' }, '*');
          await warteAuf(function () { return q('#oabi-files'); }, 5000);
          await warte(700);
          ObjectActions._voice.wiedergabe(QC_IMPORT);
          await zeige('#oabi-files', 8);
          s.zeile('Datenaufnahme', 'Beide auf einmal eingelesen — DealPilot erkennt selbst, was Exposé und was Marktbericht ist.');
          await warte(3600);
        },
        async function (s) {   /* 2 · Adresskonflikt */
          var kasten = function () {
            return [].filter.call(document.querySelectorAll('#oabi-result div'), function (d) {
              return /Unterschiedliche Adressen/.test(d.textContent) && d.querySelector('input[type=radio]');
            }).sort(function (a, b) { return a.getBoundingClientRect().height - b.getBoundingClientRect().height; })[0] || null;
          };
          await zeige(kasten, 8);
          s.zeile('Zwei Adressen?', 'Die PDFs nennen zwei verschiedene Adressen — DealPilot merkt es und fragt, welche gilt.');
          await warte(3200);
          var r = [].filter.call(document.querySelectorAll('#oabi-result input[type=radio]'), function (x) { return /Exposé/.test(x.parentElement.textContent); })[0];
          if (r) r.click();
          await warte(1500);
        },
        async function (s) {   /* 3 · Tabelle, übernehmen */
          await zeige(function () { return q('#oabi-result .oabi-tbl'); }, 6);
          s.zeile('Jeder Wert mit Quelle', 'Kaufpreis und Hausgeld aus dem Exposé, Fläche, Baujahr und Lage aus dem Marktbericht — ein Klick übernimmt.');
          await warte(4600);
          var ap = q('#oabi-apply'); if (ap) ap.click();
          await warte(1400);
          await zeige(function () { return qcGruppe('obj'); }, 6);
          s.zeile('Übernommen', 'Alles steht im Quick-Check. Nur die Miete fehlt — die Wohnung ist leer.');
          await warte(3600);
        },
        async function (s) {   /* 4 · Marktwertindikation (Mitschnitt) */
          await zeige(function () { return qcEl('qc7-sources'); }, 6);
          var st = qcEl('_mb_state');
          if (!st) { var d = qcDoc(); st = d.createElement('input'); st.type = 'hidden'; st.id = '_mb_state'; d.body.appendChild(st); }
          st.value = JSON.stringify({ ts: Date.now(), card: MB_KARTE, mode: 'med', collapsed: false });
          try { qcWin()._oabFeedTrigger(); } catch (e) {}
          await warte(900);
          await zeige(function () { return qcEl('oab-results'); }, 6);
          var mw = MB_KARTE.mw, mm = MB_KARTE.mm;
          s.zeile('Marktwertindikation', 'DealPilot schätzt den Markt: Marktwert <b>' + eur(mw.low) + ' – ' + eur(mw.high) + '</b>, Miete <b>' + eur(mm.low) + ' – ' + eur(mm.high) + '</b> kalt.');
          await warte(5200);
        },
        async function (s) {   /* 5 · vorsichtig: Zensus-Bestandsmiete -> Kritisch */
          var wfl = parseFloat(String((qcEl('qc_wfl') || {}).value || '').replace(',', '.'));
          var z = MB_KARTE.zensus && MB_KARTE.zensus.miete;
          var miete = (z && isFinite(wfl)) ? Math.round(z * wfl) : null;
          if (!miete) return;
          await zeige(function () { return qcGruppe('miete'); }, 6);
          s.zeile('Erst vorsichtig', 'Mit der Bestandsmiete laut Zensus — ' + de(z, 2) + ' €/m² — wären es <b>' + eur(miete) + '</b> …');
          await tippe('qc_nkm_grund', String(miete), 110);
          await warte(900);
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warte(900);
          var sc = qcScore();
          s.zeile('Erst vorsichtig', 'Bestandsmiete ' + eur(miete) + ': Score <b>' + sc.n + '</b> · ' + sc.stufe + ' — „' + sc.urteil + '“.');
          await warte(4600);
        },
        async function (s) {   /* 6 · Spanne Unten -> Solide */
          await zeige(function () { return qcSel('.avs-spanne'); }, 8);
          s.zeile('Die Spanne', 'Ein Klick auf „Unten“ — die vorsichtige Marktmiete geht in die Rechnung.');
          await warte(2000);
          var t = qcSel('.avs-spanne [data-spanne="low"]'); if (t) t.click();
          await warte(700);
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warte(900);
          var sc = qcScore();
          s.zeile('Die Spanne', 'Unten: Miete <b>' + eur(MB_KARTE.mm.low) + '</b> → Score <b>' + sc.n + '</b> · ' + sc.stufe + '.');
          await warte(4200);
        },
        async function (s) {   /* 7 · Bewertung und Lage */
          qcSetze('qc_lageklasse', 'B');
          await warte(700);
          await zeige(function () { return qcEl('ai-card'); }, 6);
          function lagesatz() { var m = qcText('ai-opinion').match(/Bruttomietrendite von ([\d,]+ ?%) liegt ([^.]*?) deinem Ziel von ([\d,]+ ?%) für die ([ABC])-Lage/); return m; }
          var a = lagesatz();
          s.zeile('Die Bewertung', 'Urteil, Verhandlungsrat, Pro und Contra — gerechnet. ' + (a ? 'In der <b>B-Lage</b> (Ziel ' + a[3] + ') liegt die Rendite von ' + a[1] + ' ' + a[2] + ' dem Ziel.' : ''));
          await warte(5200);
          var lf = function () { var e = qcEl('qc_lageklasse'); return e && (e.closest('.field,.f,.fg') || e.parentElement); };
          await zeige(lf, 8);
          s.zeile('Und die Lage?', 'Dieselbe Wohnung in der <b>C-Lage</b> …');
          await warte(1200);
          qcSetze('qc_lageklasse', 'C');
          await warte(1000);
          await zeige(function () { return qcEl('ai-card'); }, 6);
          var b = lagesatz(), ziel = (qcText('ai-negotiate-v').match(/auf ([\d.]+ €)/) || [])[1];
          s.zeile('Und die Lage?', 'C-Lage: Ziel ' + (b ? b[3] : '–') + ' — ' + (b ? b[2] + ' dem Ziel' : '') + '. Verhandlungsziel jetzt <b>' + (ziel || '–') + '</b>.');
          await warte(5600);
        },
        async function (s) {   /* 8 · Oben + Eigenkapital -> Gut */
          await zeige(function () { return qcSel('.avs-spanne'); }, 8);
          s.zeile('Und wenn es gut läuft?', 'Marktmiete „Oben“ …');
          await warte(1400);
          var t = qcSel('.avs-spanne [data-spanne="high"]'); if (t) t.click();
          await warte(900);
          await zeige(function () { return qcGruppe('fin'); }, 6);
          s.zeile('Und wenn es gut läuft?', 'Marktmiete „Oben“ und 20 % Eigenkapital …');
          await warte(1400);
          var b80 = [].filter.call((qcDoc() || document).querySelectorAll('.ltv-btn'), function (x) { return /^80/.test(x.textContent.trim()); })[0];
          if (b80) b80.click();
          await warte(900);
          await zeige(function () { return qcEl('score-block'); }, 4);
          await warte(900);
          var sc = qcScore();
          s.zeile('Und wenn es gut läuft?', 'Miete ' + eur(MB_KARTE.mm.high) + ', 20 % Eigenkapital: Score <b>' + sc.n + '</b> · ' + sc.stufe + ' — „' + sc.urteil + '“.');
          await warte(6000);
        }
      ],
      schluss: '<div class="k">DealPilot</div><h1>Exposé rein. Urteil raus.</h1><p>Quick Boarding liest, schätzt und bewertet — bevor du ins Auto steigst.</p><div class="m">Deal<b>Pilot</b> · dealpilot.immo</div>'
    }
  };

  /* v2222 · die beiden Mitschnitte (siehe Drehbuch 3) */
  var _spanVorher;
  var QC_IMPORT = {"files":[{"name":"Expose.pdf","type":"expose","userType":null,"cache":{"expose":{"adresse":"Hölderlinstr. 1, 32547 Bad Oeynhausen","plz":"32547","ort":"Bad Oeynhausen","objektart":"Eigentumswohnung","energieklasse":"D","heizungsart":"Gas-Zentralheizung","stellplatz":"Tiefgarage","kaufpreis":139000,"wohnflaeche":73.31,"baujahr":1983,"zimmer":2,"hausgeld":415,"energieverbrauch":117.7,"balkon":true,"keller":true}}},{"name":"Marktbericht.pdf","type":"market","userType":null,"cache":{"market":{"adresse":"Sachsenstraße 16, 32052 Herford","plz":"32052","ort":"Herford","objektart":"Wohnung","bewertungsdatum":"2025-10-15","konfidenz":"Gut","makrolage":"gut","mikrolage":"gut","bevoelkerung_entwicklung":"stabil","nachfrage":"mittel","wertsteigerung":"mittel","entwicklung":"begrenzt","kueche_qualitaet":"Gehoben","bad_qualitaet":"Normal","boden_qualitaet":"Standard","fenster_qualitaet":"Gehoben","kueche_zustand":"Neu / kürzlich modernisiert","bad_zustand":"Gut in Stand gehalten","boden_zustand":"Gut in Stand gehalten","fenster_zustand":"Gut in Stand gehalten","badezimmer":"1","etage":"1","etagen":"3","modernisierungsjahr":"2025","garagen":"1","balkon_flaeche":"10","energie_label":"B","wohnflaeche":96,"baujahr":1994,"sanierungsjahr":2025,"zimmer":3,"verkehrswert":215200,"verkehrswert_min":196000,"verkehrswert_max":233000,"preis_pro_qm":2242,"lage_geraeusch":5,"lage_einkaufen":4.7,"lage_bildung":4.3,"lage_gastronomie":4.2,"lage_gesundheit":4.6,"lage_freizeit":2.8,"wertentwicklung_3jahre_pct":14.1,"wertentwicklung_1jahr_pct":4.17,"prognose_naechstes_jahr_pct":3.49,"markt_durchschnittspreis":279000,"markt_tage_auf_dem_markt":139}}}]};
  var MB_KARTE = {"area":96,"rating":"Attraktiv","conf":{"label":"Niedrig","pct":43},"mikro":"Sehr gut · 8,2","makro":"Gut · 6,0","microRaw":82,"macroRaw":60,"trendRaw":null,"trend":"–","zensus":{"ebene":"Gemeinde","name":"Bad Oeynhausen, Stadt","leer":3.6,"eig":47.3,"miete":5.73},"brw":{"wert":200,"quelle":"BORIS-NRW","stichtag":"2026-01-01"},"makroGemessen":4,"mw":{"low":199000,"med":251000,"high":351000,"sqm":"2.615 €/m²"},"mm":{"low":766,"med":881,"high":1012,"sqm":"9,18 €/m² kalt"}};

  /* ── Ablauf ───────────────────────────────────────────────────── */
  var lauf = 0, _aktiv = null;
  function stopp() {
    /* v2221 · auch bei Esc mitten im Lauf aufräumen (Boarding-Pass) */
    if (_aktiv && _aktiv.aufraeumen) { try { _aktiv.aufraeumen(); } catch (e) {} }
    _aktiv = null;
    lauf = 0; _ziel = null; if (_folge) { clearInterval(_folge); _folge = null; } kegel(null); zeileWeg(); karte(null);
    var s = q('#dpm-stopp'); if (s) s.remove();
    document.removeEventListener('keydown', esc, true);
  }
  function esc(e) { if (e.key === 'Escape') { e.stopPropagation(); stopp(); } }
  async function start(name, opts) {
    var D = DREHBUECHER[name]; if (!D) { console.warn('[messe] unbekanntes Drehbuch: ' + name); return; }
    css(); stopp();
    var g = lauf = Date.now(); _aktiv = D;
    var b = el('dpm-stopp', 'button'); b.type = 'button'; b.textContent = '■'; b.title = 'Drehbuch beenden (Esc)'; b.onclick = stopp;
    document.addEventListener('keydown', esc, true);
    var n = D.szenen.length;
    try {
      do {
        karte('<div class="k">DealPilot · Geschichte</div><h1>' + D.titel + '</h1><p>' + D.unterzeile + '</p>');
        if (D.objekt) {   /* v2221: der Quick-Check braucht kein Objekt */
          var id = await objektFinden(D.objekt);
          if (!id) { karte('<h1>Objekt fehlt</h1><p>Für dieses Drehbuch fehlt das Demo-Objekt in diesem Konto.</p>'); await warte(4000); break; }
          if (window._currentObjKey !== id && typeof window.loadSaved === 'function') await window.loadSaved(id);
        }
        await warte(3200);
        karte(null); await warte(700);
        for (var i = 0; i < n; i++) {
          var ii = i;
          await D.szenen[i]({ zeile: function (k, t) { zeile(k, t, ii, n); } });
        }
        _ziel = null; kegel(null); zeileWeg();
        if (D.aufraeumen) D.aufraeumen(); else reiter('s0');
        karte(D.schluss); await warte(5500);
        karte(null); await warte(600);
      } while (opts && opts.schleife && g === lauf);
    } catch (e) { if (e !== 'stopp') console.warn('[messe]', e); }
    if (g === lauf) stopp();
  }
  /* v2221c · Kein Boarding-Pass aus dem Drehbuch - die Sperre steht in
     qc-bridge.js an der Weiche für 'qc-autopass' und fragt laeuft().
     ZURÜCKGENOMMEN (v2221b): ein Erfassungs-Empfänger hier, der die Nachricht
     vor qc-bridge abfangen sollte. Gemessen: am Fenster gilt die Reihenfolge
     der Anmeldung, nicht „Erfassung zuerst" - qc-bridge lädt früher. */

  window.DealPilotMesse = { start: start, stopp: stopp, drehbuecher: function () { return Object.keys(DREHBUECHER); },
    laeuft: function () { return !!lauf; } };   /* v2221: qc-ai-bridge setzt die KI-Bewertung so lange aus */

  /* ?messe=<name>[&schleife] — erst nach Anmeldung und geladenem Plan */
  try {
    var p = new URLSearchParams(location.search), name = p.get('messe');
    if (name) {
      var los = function () { setTimeout(function () { start(name, { schleife: p.has('schleife') }); }, 1500); };
      var bereit = function () { return window.Auth && Auth.isLoggedIn && Auth.isLoggedIn() && !document.getElementById('auth-modal') && typeof window.loadSaved === 'function'; };
      var t = setInterval(function () { if (bereit()) { clearInterval(t); los(); } }, 500);
    }
  } catch (e) {}
})();
