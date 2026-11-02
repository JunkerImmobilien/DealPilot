/* ══════════════════════════════════════════════════════════════════════
 * frontend/js/detailgrad.js — v3073
 *
 * DETAILGRAD DES ARBEITSBEREICHS: Einsteiger · Fortgeschritten · Experte
 *
 * Marcel 02.11.2026: „Ich wollte den Arbeitsbereich und Detailgrad der
 * einzelnen Tabs im Arbeitsbereich vereinfacht haben." Entschieden:
 *
 *   - EIN Schalter. Er ersetzt die Eingabetiefe 1/2/3 (Einfach · Mittel ·
 *     Ausgiebig, Merker dp_zielstufe) und den Haken „weitere Objektdetails".
 *   - gekoppelt an den Marktbericht: Einsteiger = Stufe 1, Fortgeschritten =
 *     Stufe 2, Experte = Stufe 3 (Wertermittlung nach ImmoWertV nur hier).
 *     Die Pflichtfelder je Stufe bleiben in objekt-reiter.js pflichtFuer().
 *   - gemerkt JE OBJEKT im Feld #dp_stufe (storage.js FIELDS). Ein neues
 *     Objekt bekommt die zuletzt gewählte Stufe, ein ganz neuer Nutzer
 *     Einsteiger. Ein BESTANDSOBJEKT ohne das Feld ist Experte — für
 *     Bestandskunden ändert sich nichts.
 *   - Ausblenden ist NUR Anzeige. Ein ausgeblendetes Feld behält seinen
 *     Wert und rechnet weiter; nichts wird geleert.
 *
 * Welche Karte und welches Feld ab welcher Stufe erscheint, steht in
 * js/data/detailgrad-zuordnung.js (erzeugt aus der geprüften JSON in
 * design/Vorschläge/, Prüfer tools/detailgrad-pruefen.mjs). Was dort
 * nicht steht, ist Experte.
 *
 * WIE AUSGEBLENDET WIRD: dieses Modul schreibt data-dp-dg="2" oder "3" an
 * Karten, Bereiche und Feldhüllen (.f, .ass-row, label) und setzt am
 * <body> die Klasse dp-dg-1/2/3. Die Regel in style.css blendet aus, was
 * über der gewählten Stufe liegt. Kein Inline-Stil: andere Module setzen
 * style.display selbst (Bausparvertrag, Darlehen II, BWK-Modus), und ein
 * Inline-Wert würde ihren überschreiben oder von ihnen überschrieben.
 *
 * Karten, die ein Modul erst später einhängt (Mietleiter #zb-leiter,
 * Mietrecht #dp-mietrecht-karte, Wert & Zielbild, die ganze Deal-Aktion),
 * erfasst ein MutationObserver auf den Reitern, gebündelt.
 *
 * API  window.DpDetailgrad
 *   stufe()                 1 | 2 | 3
 *   setzen(n, {still, fluechtig})   still: ohne Hinweis; fluechtig: nur
 *                           für diese Ansicht (nicht am Objekt, nicht als
 *                           Vorgabe) — für Drehbücher und Bildaufnahmen
 *   anwenden()              neu markieren (nach eigenem Einhängen)
 *   ebene(el)               ab welcher Stufe el sichtbar ist (1–3)
 *   ausgeblendet(el)        el liegt über der gewählten Stufe
 *   feldZeigen(el)          hebt die Stufe, bis el sichtbar ist
 *   NAMEN, MB               Beschriftungen
 * Ereignis  window 'dp:detailgrad'  detail {stufe, alt}
 *
 * v3077 · Marcel 02.11.2026: „die Einstellung Einsteiger bis Profi soll in
 * die Einstellungen und nicht in den Tab Objekt." Seitdem gilt der
 * Detailgrad JE NUTZER (Merker dp_detailgrad_zuletzt), nicht mehr je
 * Objekt. Der Schalter steht in Einstellungen › Mein Profil; im Reiter
 * Objekt steht nur noch die Stufe mit dem Weg dorthin, über den Reitern
 * gar nichts mehr. Das Objektfeld #dp_stufe wird weiter mitgeschrieben
 * (der Marktbericht-Abruf liest es), entscheidet aber nichts mehr.
 * Bestandsnutzer ohne Merker: das erste geöffnete Objekt setzt Experte
 * (für sie ändert sich nichts), ein ganz neuer Nutzer startet Einsteiger
 * bzw. mit seiner Wahl aus der Ersteinrichtung.
 *
 * v3077 · Die Datenaufnahme-Leiste (#obj-action-bar: DealPilot, Exposé,
 * Sprache, ImmoMetrica, Geführte Eingabe) wird NIE ausgeblendet. Sie stand
 * nicht in der Zuordnung, galt damit als Experte und war in Einsteiger und
 * Fortgeschritten verschwunden — Marcel: „nur bei Stufe 3 ist die
 * Datenaufnahme-Karte nutzbar".
 * ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpDetailgrad) return;

  var NAMEN = { 1: 'Einsteiger', 2: 'Fortgeschritten', 3: 'Experte' };
  var MB = { 1: 'Marktbericht Stufe 1 · Marktpreisindikation', 2: 'Marktbericht Stufe 2 · erweiterte Indikation', 3: 'Marktbericht Stufe 3 · Wertermittlung nach ImmoWertV' };
  var FELD_ID = 'dp_stufe';
  var LS = 'dp_detailgrad_zuletzt';
  var REITER = ['s0', 's1', 's2', 's3', 's4', 's3-tax', 's5', 's6', 's8'];
  /* Was in einem Reiter als „Karte" zählt, wenn es keine .card ist: die
     Deal-Aktion baut Tafeln (.dab-panel) und Bühnen (.da-stage). */
  var UNIVERSUM = { s8: '.dab-panel, .da-stage' };
  var FELD_SEL = 'input:not([type="hidden"]), select, textarea';
  /* nie markieren: eigene Bausteine und die Datenaufnahme-Leiste (v3077) */
  var NIE = '.dp-dg-weiter, [data-dp-detailgrad], #obj-action-bar';

  function gueltig(v) { var n = parseInt(v, 10); return (n >= 1 && n <= 3) ? n : null; }
  function lsGet() { try { return localStorage.getItem(LS); } catch (e) { return null; } }
  function lsSet(v) { try { localStorage.setItem(LS, String(v)); } catch (e) {} }

  /* Einmalig: die alte Eingabetiefe wird die Vorgabe für neue Objekte, dann
     verschwinden beide alten Merker. Danach liest niemand sie mehr. */
  try {
    if (localStorage.getItem(LS) == null) {
      var alt = gueltig(localStorage.getItem('dp_zielstufe'));
      if (alt) localStorage.setItem(LS, String(alt));
    }
    localStorage.removeItem('dp_zielstufe');
    localStorage.removeItem('dp_details');
  } catch (e) {}

  function vorgabe() { return gueltig(lsGet()) || 1; }
  function feld() { return document.getElementById(FELD_ID); }
  var _stufe = null, _fluechtig = null;

  /* v3077 · je Nutzer: Merker > zuletzt bestimmt > Einsteiger */
  function stufe() {
    if (_fluechtig) return _fluechtig;
    return gueltig(lsGet()) || _stufe || 1;
  }

  /* Objektwechsel: die Stufe des Nutzers gilt; das Objektfeld zieht nur
     nach (ohne Speicherereignis). Bestandsnutzer ohne Merker: ein
     geöffnetes Objekt macht sie zu Experten — einmal, dann gilt der Merker. */
  function ermitteln(key) {
    var vorher = stufe();
    _fluechtig = null;
    if (!gueltig(lsGet()) && key) lsSet(3);
    var v = stufe(), f = feld();
    if (f && f.value !== String(v)) f.value = String(v);
    _stufe = v;
    anwenden();
    if (v !== vorher) melden(vorher, v);
  }

  function setzen(n, opt) {
    n = gueltig(n); if (!n) return;
    opt = opt || {};
    var alt = stufe();
    if (opt.fluechtig) {
      _fluechtig = n;
    } else {
      _fluechtig = null; _stufe = n; lsSet(n);
      var f = feld();
      if (f && f.value !== String(n)) {
        f.value = String(n);
        /* gespeichert wird über den Dirty-Tracker (storage.js setupTracking,
           Ereignis input auf ein Feld in .sec). Bei einem noch nie
           gespeicherten Objekt nicht: der Wechsel allein soll kein leeres
           Objekt anlegen — der Wert steht im Feld und geht mit der ersten
           echten Speicherung mit. */
        if (window._currentObjKey) { try { f.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {} }
      }
    }
    anwenden();
    if (n !== alt) {
      if (!opt.still) hinweisWechsel(alt, n);
      melden(alt, n);
    }
  }

  function melden(alt, n) {
    try { window.dispatchEvent(new CustomEvent('dp:detailgrad', { detail: { stufe: n, alt: alt } })); } catch (e) {}
  }

  /* ── Markieren ───────────────────────────────────────────────────── */
  function zuordnung(id) {
    var Z = window.DpDetailgradZuordnung;
    return (Z && Z.reiter && Z.reiter[id]) || {};
  }

  function aufloesen(sec, k) {
    var el = null;
    try {
      if (/^#[\w-]+$/.test(k.s)) el = document.getElementById(k.s.slice(1));
      else el = sec.querySelectorAll(k.s)[k.nr || 0] || null;
    } catch (e) { return null; }
    if (!el || !sec.contains(el)) return null;
    if (k.art === 'kind') el = el.closest('.card') || el;
    /* Deal-Aktion: der Bereich sitzt in einer Tafel unter einem Band —
       ausgeblendet wird die Tafel (das Band folgt ihr, siehe unten). */
    var tafel = el.closest('.dab-panel');
    if (tafel && sec.contains(tafel)) el = tafel;
    return el;
  }

  function huelle(f, sec) {
    var w = f.closest('.f, .ass-row, label') || f.parentElement;
    if (!w || w === sec || !sec.contains(w) || w.classList.contains('card') || w.querySelector('.card')) return f;
    return w;
  }

  function markierenReiter(id) {
    var sec = document.getElementById(id); if (!sec) return;
    var R = zuordnung(id);
    var feldStufe = {}, expl = new Map();
    [1, 2, 3].forEach(function (L) {
      var t = R[L]; if (!t) return;
      (t.felder || []).forEach(function (fid) { if (!feldStufe[fid] || L < feldStufe[fid]) feldStufe[fid] = L; });
      (t.karten || []).forEach(function (k) {
        var el = aufloesen(sec, k); if (!el) return;
        if (!expl.has(el) || L < expl.get(el)) expl.set(el, L);
      });
    });
    var lvl = function (f) { return (f.id && feldStufe[f.id]) || 3; };
    var felder = [].slice.call(sec.querySelectorAll(FELD_SEL)).filter(function (f) { return !f.closest(NIE); });

    /* Behälter: jede Karte (und was im Reiter als Karte gilt) plus die
       gelisteten Bereiche. Ein Behälter erscheint so früh wie das früheste
       Feld oder der früheste gelistete Bereich in ihm — ein gelistetes
       Feld wird nie von seiner Karte verschluckt. */
    var beh = [].slice.call(sec.querySelectorAll('.card' + (UNIVERSUM[id] ? ', ' + UNIVERSUM[id] : '')));
    expl.forEach(function (L, el) { if (beh.indexOf(el) < 0) beh.push(el); });
    beh = beh.filter(function (b) { return !b.closest(NIE) && !b.querySelector('#obj-action-bar'); });
    var soll = new Map();
    beh.forEach(function (b) {
      var L = expl.has(b) ? expl.get(b) : 3;
      for (var i = 0; i < felder.length && L > 1; i++) if (b.contains(felder[i])) L = Math.min(L, lvl(felder[i]));
      expl.forEach(function (L2, e2) { if (e2 !== b && b.contains(e2) && L2 < L) L = L2; });
      soll.set(b, L);
    });
    /* Feldhüllen: nur wo das Feld später kommt als sein Behälter */
    felder.forEach(function (f) {
      var L = lvl(f), ctx = 1;
      soll.forEach(function (Lb, b) { if (Lb > ctx && b.contains(f)) ctx = Lb; });
      if (L <= ctx) return;
      var w = huelle(f, sec);
      var m = L;
      if (w !== f) [].slice.call(w.querySelectorAll(FELD_SEL)).forEach(function (g) { m = Math.min(m, lvl(g)); });
      if (m > ctx && !soll.has(w)) soll.set(w, m);
    });
    /* Deal-Aktion: das Band über einer Tafel folgt ihr */
    soll.forEach(function (L, b) {
      if (!b.classList.contains('dab-panel')) return;
      var band = b.previousElementSibling;
      if (band && band.classList.contains('dab-band') && !soll.has(band)) soll.set(band, L);
    });

    [].slice.call(sec.querySelectorAll('[data-dp-dg]')).forEach(function (e) {
      if (!soll.has(e) || soll.get(e) < 2) e.removeAttribute('data-dp-dg');
    });
    soll.forEach(function (L, e) {
      if (L >= 2 && e.getAttribute('data-dp-dg') !== String(L)) e.setAttribute('data-dp-dg', String(L));
    });
  }

  /* ab welcher Stufe el sichtbar ist: die höchste Marke auf dem Weg nach oben */
  function ebene(el) {
    var L = 1;
    for (var e = el; e && e.nodeType === 1; e = e.parentElement) {
      var v = gueltig(e.getAttribute('data-dp-dg'));
      if (v && v > L) L = v;
      if (e.classList && e.classList.contains('sec')) break;
    }
    return L;
  }
  function ausgeblendet(el) { return !!el && ebene(el) > stufe(); }
  function gefuellt(f) {
    /* Haken und Selects tragen immer einen Zustand (oft ab Werk, z. B. die
       PDF-Bausteine) - sie zählen nicht als „erfasst". Gemessen 02.11.: mit
       Haken meldete Pilot-Analyse 18 „Werte" in Einsteiger, alle Vorgaben. */
    if (f.type === 'checkbox' || f.type === 'radio' || f.tagName === 'SELECT') return false;
    return String(f.value || '').trim() !== '';
  }
  function felderIn(root) {
    return [].slice.call(root.querySelectorAll(FELD_SEL)).filter(function (f) { return !f.closest(NIE); });
  }

  /* ── Fußzeile je Reiter: „+ n weitere Felder in …" ─────────────────── */
  function fusszeile(sec) {
    var s = stufe();
    var fuss = sec.querySelector(':scope > .dp-dg-weiter');
    /* v3080 · Marcel 02.11.2026: „das braucht man dann ja gar nicht mehr — nur umschaltbar
       in den Einstellungen". Keine Fußzeile „+ n weitere Felder" mehr in den Reitern. */
    if (fuss) fuss.remove();
    return;
    if (s >= 3) { if (fuss) fuss.remove(); return; }
    var n = { 2: 0, 3: 0 }, k = { 2: 0, 3: 0 }, erfasst = 0;
    felderIn(sec).forEach(function (f) {
      var L = ebene(f);
      if (L > s) { n[L]++; if (gefuellt(f)) erfasst++; }
    });
    [].slice.call(sec.querySelectorAll('[data-dp-dg]')).forEach(function (e) {
      if (!(e.classList.contains('card') || e.classList.contains('dab-panel') || e.classList.contains('da-stage'))) return;
      var L = gueltig(e.getAttribute('data-dp-dg'));
      var oben = e.parentElement && e.parentElement.closest('[data-dp-dg]');
      if (L > s && !(oben && sec.contains(oben) && ebene(oben) >= L)) k[L]++;
    });
    var teile = [];
    for (var L = s + 1; L <= 3; L++) {
      if (!n[L] && !k[L]) continue;
      var was = n[L] ? (n[L] + (n[L] === 1 ? ' weiteres Feld' : ' weitere Felder')) : '';
      if (!n[L] && k[L]) was = k[L] + (k[L] === 1 ? ' weitere Karte' : ' weitere Karten');
      teile.push('<button type="button" class="dp-dg-mehr" data-dp-dg-setzen="' + L + '"><b>+ ' + was + '</b> in ' + NAMEN[L] + '</button>');
    }
    var html = teile.length
      ? teile.join('') + (erfasst ? '<span class="dp-dg-erfasst">' + erfasst + (erfasst === 1 ? ' ausgeblendetes Feld hat' : ' ausgeblendete Felder haben') + ' einen Wert und rechne' + (erfasst === 1 ? 't' : 'n') + ' weiter.</span>' : '')
      : '';
    if (!html) { if (fuss) fuss.remove(); return; }
    if (!fuss) { fuss = document.createElement('div'); fuss.className = 'dp-dg-weiter'; sec.appendChild(fuss); }
    else if (fuss !== sec.lastElementChild) sec.appendChild(fuss);
    if (fuss.innerHTML !== html) fuss.innerHTML = html;
  }

  /* ── Schalter ────────────────────────────────────────────────────── */
  /* Von jedem Reiter erreichbar: ein Schalter rechts über dem Reitertitel.
     NICHT in der Reiterleiste: gemessen 02.11.2026 (Aktenmappe, 1523 px)
     füllen neun Reiter und die Fortschrittsanzeige die Leiste bis auf 27 px
     (scrollWidth = clientWidth = 1270) — der Schalter lag zur Hälfte
     ausserhalb des Bildes. Im Reiter Objekt steht der grosse Schalter in
     der Abrufleiste (index.html #oe-ziel), dort entfällt dieser. */
  function reiterSchalter() {
    /* v3077 · aus: der Schalter steht in den Einstellungen (Marcel 02.11.2026) */
    [].slice.call(document.querySelectorAll('[data-dp-detailgrad="reiter"]')).forEach(function (h) { h.remove(); });
    return;
    REITER.forEach(function (id) {
      if (id === 's0') return;
      var sec = document.getElementById(id); if (!sec) return;
      if (sec.querySelector('[data-dp-detailgrad="reiter"]')) return;
      var h2 = sec.querySelector('.sec-title'); if (!h2 || !h2.parentNode) return;
      var host = document.createElement('div');
      host.className = 'dp-dg-host dp-dg-reiter';
      host.setAttribute('data-dp-detailgrad', 'reiter');
      h2.parentNode.insertBefore(host, h2);
    });
  }
  function schalterZeichnen() {
    var s = stufe();
    reiterSchalter();
    [].slice.call(document.querySelectorAll('[data-dp-detailgrad]')).forEach(function (host) {
      var art = host.getAttribute('data-dp-detailgrad');
      if (!host.querySelector('.dp-dg-schalter')) {
        host.innerHTML = (art === 'reiter' ? '<span class="dp-dg-lbl">Detailgrad</span>' : '')
          + '<span class="dp-dg-schalter" role="group" aria-label="Detailgrad">'
          + [1, 2, 3].map(function (i) {
            return '<button type="button" class="dp-dg-knopf" data-dp-dg-setzen="' + i + '" title="' + NAMEN[i] + ' · ' + MB[i] + '">'
              + '<b>' + NAMEN[i] + '</b>' + (art === 'reiter' ? '' : '<small>Stufe ' + i + '</small>') + '</button>';
          }).join('') + '</span>';
      }
      [].slice.call(host.querySelectorAll('[data-dp-dg-setzen]')).forEach(function (b) {
        var on = parseInt(b.getAttribute('data-dp-dg-setzen'), 10) === s;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
  }

  /* ── Hinweis beim Wechsel ────────────────────────────────────────── */
  var _tt = null;
  function hinweis(text) {
    var t = document.getElementById('dp-dg-toast');
    if (!t) { t = document.createElement('div'); t.id = 'dp-dg-toast'; t.className = 'dp-dg-toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = text;
    t.classList.add('zeig');
    clearTimeout(_tt);
    _tt = setTimeout(function () { t.classList.remove('zeig'); }, 5200);
  }
  function hinweisWechsel(alt, n) {
    var dazu = 0, weg = 0;
    REITER.forEach(function (id) {
      var sec = document.getElementById(id); if (!sec) return;
      felderIn(sec).forEach(function (f) {
        var L = ebene(f);
        if (n > alt && L > alt && L <= n) dazu++;
        if (n < alt && L > n && L <= alt && gefuellt(f)) weg++;
      });
    });
    if (n > alt) hinweis('Auf ' + NAMEN[n] + ' erweitert: ' + dazu + (dazu === 1 ? ' Feld' : ' Felder') + ' dazu. Deine Angaben bleiben, wie sie sind.' + (n === 3 ? ' Die Wertermittlung (Stufe 3) ist jetzt abrufbar.' : ''));
    else hinweis('Auf ' + NAMEN[n] + ' vereinfacht. ' + (weg ? weg + (weg === 1 ? ' ausgefülltes Feld ist' : ' ausgefüllte Felder sind') + ' ausgeblendet und rechne' + (weg === 1 ? 't' : 'n') + ' weiter — nichts wird gelöscht.' : 'Keine ausgefüllten Felder ausgeblendet.'));
  }

  /* ── Anwenden ────────────────────────────────────────────────────── */
  function anwenden() {
    var s = stufe();
    var b = document.body; if (!b) return;
    [1, 2, 3].forEach(function (i) { b.classList.toggle('dp-dg-' + i, i === s); });
    REITER.forEach(function (id) { try { markierenReiter(id); } catch (e) { try { console.warn('[detailgrad]', id, e); } catch (_) {} } });
    REITER.forEach(function (id) { var sec = document.getElementById(id); if (sec) { try { fusszeile(sec); } catch (e) {} } });
    schalterZeichnen();
  }

  /* ── Annahmen für die PDFs (v3073) ─────────────────────────────────
     Marcel 02.11.2026: „Passen sich die PDFs an, das Investment-PDF?"
     Das PDF nennt die Stufe und listet, welche AUSGEBLENDETEN Felder mit
     einem Wert rechnen — mit dem Wert, der im Feld steht (nie erfunden),
     und der Stelle, aus der die Vorgabe kommt. Leere ausgeblendete
     Score-Merkmale (ds2_*) gehen neutral ein und werden gezählt.
     Nur Latin-1 in den Texten: jsPDF/helvetica kennt keinen Gedankenstrich. */
  var QUELLEN = [
    [/^(gest_p|notar_p|gba_p|makler_p|ji_p)$/, 'Nebenkosten-Sätze (Einstellungen)'],
    [/^(ek|d1z|d1t|d1_bindj|anschl_z|anschl_t|anschl_j|mietstg|wertstg|kostenstg|leerstand|btj|exit_bmy|mietausfall|geb_ant|grenz)$/, 'Investmentprofil (Einstellungen)'],
    [/^(hg_ul|hg_nul|eigen_r|weg_r|grundsteuer|bwk_ul_pct|bwk_nul_pct|bwk_kp_pct)$/, 'BWK-Profil je Objektart'],
    [/^afa_satz$/, 'AfA nach Baujahr (§ 7 EStG)'],
    [/^d1$/, 'Gesamtinvestition minus Eigenkapital'],
    [/^brw$/, 'Bodenrichtwert (BORIS)']
  ];
  function quelleFuer(id) {
    for (var i = 0; i < QUELLEN.length; i++) if (QUELLEN[i][0].test(id)) return QUELLEN[i][1];
    return 'im Objekt erfasst';
  }
  function beschriftung(f) {
    var w = f.closest('.f, .ass-row') || f.parentElement;
    var l = w && (w.querySelector('label, .ass-l'));
    var t = l ? l.textContent : (f.getAttribute('aria-label') || f.id);
    return String(t || f.id).replace(/[ℹ*]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  }
  function anzeigeWert(f) {
    if (f.tagName === 'SELECT') { var o = f.options[f.selectedIndex]; return o ? String(o.text || '').trim() : ''; }
    var v = String(f.value || '').trim();
    var w = f.closest('.f, .ass-row, .ass-inp');
    var u = w && w.querySelector('.unit');
    return v + (u && u.textContent.trim() ? ' ' + u.textContent.trim() : '');
  }
  function annahmen() {
    var s = stufe(), zeilen = [], neutral = 0, weitere = 0, gesehen = {};
    if (s < 3) {
      REITER.forEach(function (id) {
        if (id === 's5' || id === 's6' || id === 's8') return;   /* Ausgabe-Reiter: keine Rechenfelder */
        var sec = document.getElementById(id); if (!sec) return;
        felderIn(sec).forEach(function (f) {
          if (!f.id || gesehen[f.id] || ebene(f) <= s) return;
          if (f.type === 'checkbox' || f.type === 'radio' || f.type === 'file' || f.disabled) return;
          var leer = f.tagName === 'SELECT' ? !f.value : String(f.value || '').trim() === '';
          if (leer) { if (/^ds2_/.test(f.id)) neutral++; return; }
          gesehen[f.id] = 1;
          /* Zeile nur für Werte mit benannter Vorgabe-Quelle. Alles andere
             (abgeleitete Euro-Beträge, Auswahlfelder, früher Erfasstes) wird
             gezählt - gemessen 02.11.2026: ohne diese Trennung trug ein frisch
             angelegtes Einsteiger-Objekt 51 Zeilen, und die Tabelle war nicht
             mehr „einfach und übersichtlich". */
          var q = quelleFuer(f.id);
          if (q === 'im Objekt erfasst') { weitere++; return; }
          zeilen.push({ id: f.id, label: beschriftung(f), wert: anzeigeWert(f), quelle: q, reiter: id });
        });
      });
    }
    return { stufe: s, name: NAMEN[s], mb: MB[s], zeilen: zeilen, neutral: neutral, weitere: weitere };
  }

  function feldZeigen(el) {
    if (!el) return stufe();
    var L = ebene(el);
    if (L > stufe()) setzen(L);
    return L;
  }

  /* ── Verdrahtung ─────────────────────────────────────────────────── */
  var _spaeter = null;
  function spaeter() { clearTimeout(_spaeter); _spaeter = setTimeout(anwenden, 300); }

  function beobachten() {
    if (typeof MutationObserver !== 'function') return;
    var mo = new MutationObserver(function (liste) {
      for (var i = 0; i < liste.length; i++) {
        var t = liste[i].target;
        if (t && t.closest && t.closest('.dp-dg-weiter, [data-dp-detailgrad]')) continue;
        spaeter(); return;
      }
    });
    REITER.forEach(function (id) { var sec = document.getElementById(id); if (sec) mo.observe(sec, { childList: true, subtree: true }); });
  }

  /* Ein Klick auf irgendeinen Stufen-Knopf (Schalter, Pille im Pre-Flight,
     Fußzeile, „Auf Experte schalten"). Capture, damit die Pille in der
     Pre-Flight-Kachel die Kachel nicht mit an- oder abwählt. */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-dp-dg-setzen]') : null;
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    setzen(parseInt(b.getAttribute('data-dp-dg-setzen'), 10));
  }, true);
  /* Reiterwechsel: frisch eingehängte Karten sofort erfassen */
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.tab[data-target-sec]')) setTimeout(anwenden, 60);
  });
  /* v3077 · „ändern ›" im Reiter Objekt: Einstellungen › Mein Profil, zum Schalter */
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest || !e.target.closest('#oe-dg-einst, [data-dp-dg-einst]')) return;
    e.preventDefault(); e.stopPropagation();   /* v3078: gesperrte Pille in der Kachel */
    try { if (typeof window.showSettings === 'function') window.showSettings(); } catch (_) {}
    setTimeout(function () {
      var t = document.querySelector('#settings-modal .st-tab[data-tab="standardwerte"]');
      if (t && typeof window._swSet === 'function') window._swSet(t);
      setTimeout(function () {
        var h = document.querySelector('#settings-modal .dp-es-detailgrad');
        if (h && h.scrollIntoView) h.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 120);
    }, 80);
  }, true);
  window.addEventListener('dp:object-ready', function (e) {
    ermitteln((e && e.detail && e.detail.key) || window._currentObjKey || null);
  });

  function start() {
    ermitteln(window._currentObjKey || null);
    beobachten();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.DpDetailgrad = {
    stufe: stufe, setzen: setzen, anwenden: anwenden, ebene: ebene,
    ausgeblendet: ausgeblendet, feldZeigen: feldZeigen, NAMEN: NAMEN, MB: MB,
    annahmen: annahmen,   /* Investment-PDF (pdf.js) und Bankfassung (pdf-investment-bank.js) */
    /* Ersteinrichtung (onboarding.js): seit v3077 ist das die Stufe des Nutzers */
    vorgabeSetzen: function (n) { n = gueltig(n); if (n) { lsSet(n); anwenden(); } return n; }
  };
})();
