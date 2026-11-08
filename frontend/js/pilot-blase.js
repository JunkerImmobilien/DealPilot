'use strict';
/* ═════════════════════════════════════════════════════════════════════
   pilot-blase.js — v3218 · W-4 · EINE Pilot-Blase in jeder Ansicht

   Wunsch des Entwicklungspartners (W-4, Staging 06.11.2026): der Chat soll
   ueberall erreichbar sein, nicht nur im Reiter Pilot-Analyse. Marcels
   Entscheidung 08.11.2026: Hilfe-Pilot (F1, pilot-tower.js) und Co-Pilot-
   Chat (copilot.js) werden EINE Blase unten rechts.

   NICHTS DOPPELT. Diese Datei baut nur das Gehaeuse:
     · den runden Knopf unten rechts und das Fenster darueber
     · copilot.js montiert seinen Chat (#dp-cp) HIER statt in #s5 - derselbe
       Endpunkt /ai/copilot, dieselbe Aenderungs-Logik (copilot-aenderungen.js:
       Feldkatalog reist mit, Vorschlag, Uebernehmen/Verwerfen), dieselben
       Grenzen (Monatszaehler in copilot.js, Tageslimit 429 am Server)
     · den Bezug: das offene Objekt (window._currentObjKey). Ohne Objekt geht
       kein Feldkatalog mit (copilot.js prueft das selbst) - also nur Fragen.
     · Datei anhaengen: KEINE neue Auslesung - die Datei geht an den
       Unterlagen-Eingang (unterlagen-eingang.js -> ObjectActions.openImport),
       dort zeigt das Pruef-Fenster, was gelesen wurde.
     · F1 / ? bleibt die Taste fuer die Feld-Hilfe (pilot-tower.js). Die
       ruhende Figur ist kein zweiter Knopf mehr: pilot-tower.js ruht immer
       unsichtbar und erscheint nur noch auf F1.

   Platz unten rechts (gemessen im Code, 08.11.2026):
     #dp-bb-fab   Bordbuch-Mechaniker right:18 bottom:14, 46x76 - nur fuer
                  Entwicklungspartner; er rueckt hier nach links.
     #dp-kv-panel / .dpl-schalter  Ansichtswerkzeuge, unter 900 px aus;
                  wo sie stehen, steigt die Blase ueber sie (platz()).
     unter 641 px die Datenaufnahme-Schublade (.dp-pf-scroll.dp-pf-open,
                  z 1100): offen tritt die Blase zurueck.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DealPilotBlase) return;

  var G = 'var(--wl-c9a84c, #C9A84C)', GH = 'var(--wl-e8cc7a, #E8CC7A)', GL = 'var(--wl-b8932f, #b8932f)';
  var fab = null, fenster = null, offen = false;

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function css() {
    if (el('dp-blase-css')) return;
    var st = document.createElement('style'); st.id = 'dp-blase-css';
    st.textContent = [
      '#dp-blase-fab{position:fixed;right:18px;bottom:18px;width:56px;height:56px;border-radius:50%;z-index:10055;cursor:pointer;padding:0;overflow:hidden;background:#141210;border:2px solid ' + G + ';box-shadow:0 8px 22px rgba(0,0,0,.38);display:none;transition:transform .15s,bottom .25s}',
      '#dp-blase-fab.an{display:block}',
      '#dp-blase-fab:hover{transform:translateY(-2px)}',
      '#dp-blase-fab:focus-visible{outline:3px solid ' + GH + ';outline-offset:2px}',
      '#dp-blase-fab .pf-wrap{display:block;width:92px;height:148px;margin:-4px 0 0 -20px;pointer-events:none}',
      '#dp-blase-fab .pf-wrap svg{width:100%;height:100%;display:block}',
      '#dp-blase-fab .pf .schatten{display:none}',
      '#dp-blase-fab .ersatz{display:grid;place-items:center;width:100%;height:100%;color:' + GH + '}',
      '#dp-blase-fab .ersatz svg{width:24px;height:24px}',
      '#dp-blase-fab.auf{box-shadow:0 0 0 4px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent),0 8px 22px rgba(0,0,0,.38)}',
      /* Bordbuch-Mechaniker (nur Entwicklungspartner) rueckt links neben die Blase */
      '#dp-bb-fab{right:86px !important}',
      '#dp-blase{position:fixed;right:18px;bottom:86px;z-index:10054;width:min(430px,calc(100vw - 24px));height:min(640px,calc(100vh - 120px));display:none;flex-direction:column;background:#fff;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent);border-radius:16px;box-shadow:0 30px 80px -20px rgba(0,0,0,.45);overflow:hidden;font-family:Inter,system-ui,sans-serif}',
      '#dp-blase.an{display:flex;animation:dpb-auf .22s cubic-bezier(.2,1.2,.4,1)}',
      '@keyframes dpb-auf{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}',
      '#dp-blase .dpb-k{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#141210;color:#f3ead0}',
      '#dp-blase .dpb-tt{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.2}',
      '#dp-blase .dpb-t{font:600 14px "Space Grotesk",sans-serif;color:' + GH + '}',
      '#dp-blase .dpb-s{font:500 10.5px "JetBrains Mono",monospace;color:#b9ad8f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#dp-blase .dpb-f1{border:1px solid ' + G + ';background:transparent;color:' + GH + ';border-radius:7px;padding:4px 8px;font:600 11px Inter,sans-serif;cursor:pointer;white-space:nowrap}',
      '#dp-blase .dpb-zu{background:none;border:0;color:#b9ad8f;font-size:22px;line-height:1;cursor:pointer;padding:0 4px}',
      '#dp-blase .dpb-rumpf{flex:1 1 auto;min-height:0;display:flex;flex-direction:column}',
      /* copilot.js baut #dp-cp als Karte (style.css) - im Fenster fuellt er die Hoehe */
      '#dp-blase #dp-cp{margin:0 !important;border:0 !important;border-radius:0 !important;box-shadow:none !important;flex:1 1 auto;min-height:0;display:flex;flex-direction:column}',
      '#dp-blase #dp-cp .dp-cp-head{display:none}',
      '#dp-blase .dpb-leiste{display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid #EFECE4;background:#FBFAF6;font-size:11.5px;color:#5C554E}',
      '#dp-blase .dpb-leiste .dp-cp-badge{margin-right:auto}',
      '#dp-blase #dp-cp .dp-cp-log{flex:1 1 auto;max-height:none;min-height:0}',
      '#dp-blase.ohne-objekt .dp-cpp{display:none}',
      '#dp-blase .dpb-anh{flex:0 0 auto;border:1px solid #E7E4DC;background:#fff;color:#5C554E;border-radius:9px;width:38px;cursor:pointer;display:grid;place-items:center}',
      '#dp-blase .dpb-anh:hover{border-color:' + G + ';color:' + GL + '}',
      '#dp-blase .dpb-anh svg{width:17px;height:17px}',
      '#dp-blase.zieht{outline:3px dashed ' + G + ';outline-offset:-6px}',
      '#dp-cp-verweis{margin-top:18px;padding:12px 16px;border:1px dashed color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 55%, transparent);border-radius:14px;background:#FBFAF6;font:13px/1.5 Inter,sans-serif;color:#5C554E;display:flex;gap:12px;align-items:center;flex-wrap:wrap}',
      '#dp-cp-verweis button{border:0;border-radius:9px;background:' + G + ';color:#1a1407;font:600 12.5px Inter,sans-serif;padding:7px 12px;cursor:pointer}',
      '@media (max-width:640px){#dp-blase-fab{right:12px;bottom:12px;width:50px;height:50px}#dp-blase-fab .pf-wrap{width:82px;height:132px;margin:-4px 0 0 -18px}'
        + '#dp-blase{left:8px;right:8px !important;bottom:8px !important;width:auto;height:min(80vh,calc(100vh - 70px));z-index:10056}'
        + '#dp-blase .dp-cp-in{font-size:16px !important}#dp-blase .dpb-f1{display:none}#dp-bb-fab{right:72px !important}}',
      '@media (prefers-reduced-motion:reduce){#dp-blase.an{animation:none}#dp-blase-fab{transition:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  var KLAMMER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>';
  var FLIEGER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>';

  /* ── Bau: synchron beim Laden, damit copilot.js seinen Chat hier findet ── */
  function bauen() {
    if (fab || !document.body) return;
    css();
    fab = document.createElement('button');
    fab.type = 'button'; fab.id = 'dp-blase-fab';
    fab.title = 'Pilot: Fragen und Änderungen per Chat (F1 erklärt das Feld)';
    fab.setAttribute('aria-label', 'Pilot-Chat öffnen');
    fab.setAttribute('aria-expanded', 'false');
    try {
      if (window.DealPilotFigur) { DealPilotFigur.css(); fab.innerHTML = '<span class="pf-wrap">' + DealPilotFigur.svg({}) + '</span>'; }
      else fab.innerHTML = '<span class="ersatz">' + FLIEGER + '</span>';
    } catch (e) { fab.innerHTML = '<span class="ersatz">' + FLIEGER + '</span>'; }
    fab.addEventListener('click', function () { offen ? zu() : auf(); });

    fenster = document.createElement('div');
    fenster.id = 'dp-blase'; fenster.setAttribute('role', 'dialog'); fenster.setAttribute('aria-label', 'Pilot');
    fenster.innerHTML = '<div class="dpb-k"><div class="dpb-tt"><span class="dpb-t">Pilot</span><span class="dpb-s" id="dp-blase-bezug"></span></div>'
      + '<button type="button" class="dpb-f1" title="Erklärt das Feld unter Maus oder Cursor - überall auch mit F1 oder ?">Feld erklären · F1</button>'
      + '<button type="button" class="dpb-zu" aria-label="Schließen">×</button></div>'
      + '<div class="dpb-rumpf" id="dp-blase-rumpf"></div>';
    document.body.appendChild(fenster);
    document.body.appendChild(fab);
    fenster.querySelector('.dpb-zu').addEventListener('click', zu);
    fenster.querySelector('.dpb-f1').addEventListener('click', function () {
      zu();
      try { if (window.DealPilotPilot && DealPilotPilot.rufen) DealPilotPilot.rufen(); } catch (e) {}
    });
    /* Datei auf das Fenster ziehen = anhaengen */
    fenster.addEventListener('dragover', function (e) { if (e.dataTransfer && [].indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) { e.preventDefault(); fenster.classList.add('zieht'); } });
    fenster.addEventListener('dragleave', function (e) { if (!fenster.contains(e.relatedTarget)) fenster.classList.remove('zieht'); });
    fenster.addEventListener('drop', function (e) {
      fenster.classList.remove('zieht');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); anhaengen(e.dataTransfer.files); }
    });
  }

  /* ── Der Chat: copilot.js montiert ihn hier; wir ergaenzen Leiste und Klammer ── */
  function ausstatten() {
    var cp = el('dp-cp');
    if (!cp || !fenster || !fenster.contains(cp) || cp.getAttribute('data-blase')) return !!(cp && cp.getAttribute('data-blase'));
    cp.setAttribute('data-blase', '1');
    /* Kontingent-Pille und Web-Recherche aus dem (ausgeblendeten) Kopf in eine schmale Leiste */
    var head = cp.querySelector('.dp-cp-head'), leiste = document.createElement('div');
    leiste.className = 'dpb-leiste';
    var badge = head && head.querySelector('.dp-cp-badge'), web = head && head.querySelector('.dp-cp-web');
    if (badge) leiste.appendChild(badge);
    if (web) leiste.appendChild(web);
    if (head) head.parentNode.insertBefore(leiste, head.nextSibling); else cp.insertBefore(leiste, cp.firstChild);
    /* Klammer vor dem Senden-Knopf */
    var bar = cp.querySelector('.dp-cp-bar'), snd = el('dp-cp-send');
    if (bar && !bar.querySelector('.dpb-anh')) {
      var k = document.createElement('button');
      k.type = 'button'; k.className = 'dpb-anh'; k.innerHTML = KLAMMER;
      k.title = 'Datei anhängen: Mietvertrag, Wirtschaftsplan, Protokoll, Rechnung … – geht in den Unterlagen-Eingang';
      k.setAttribute('aria-label', 'Datei anhängen');
      var inp = document.createElement('input');
      inp.type = 'file'; inp.multiple = true; inp.style.display = 'none';
      inp.accept = 'application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
      inp.addEventListener('change', function () { if (inp.files && inp.files.length) anhaengen(inp.files); inp.value = ''; });
      k.addEventListener('click', function () {
        if (!window._currentObjKey) { sag('Unterlagen gehören zu einem Objekt. Öffne zuerst das Objekt, dann nehme ich die Datei entgegen.'); return; }
        inp.click();
      });
      bar.insertBefore(k, snd || null);
      bar.appendChild(inp);
    }
    bezug();
    return true;
  }

  function sag(text) {
    try { if (typeof window.__dpCpAddMsg === 'function') { window.__dpCpAddMsg('assistant', text); return; } } catch (e) {}
    try { if (window.showToast) showToast(text); } catch (e) {}
  }

  /* ── Datei anhaengen: an den bestehenden Unterlagen-Eingang ─────────── */
  function anhaengen(files) {
    var liste = [].slice.call(files || []);
    if (!liste.length) return;
    if (!window._currentObjKey) { sag('Unterlagen gehören zu einem Objekt. Öffne zuerst das Objekt, dann nehme ich die Datei entgegen.'); return; }
    if (!(window.DpEingang && typeof DpEingang.oeffnen === 'function')) { sag('Der Unterlagen-Eingang ist gerade nicht geladen – lade die Seite bitte neu.'); return; }
    var namen = liste.map(function (f) { return '„' + f.name + '“'; }).join(', ');
    zu();
    DpEingang.oeffnen();
    var eingabe = el('oabi-input'), uebergeben = false;
    try {
      if (eingabe && typeof DataTransfer === 'function') {
        var dt = new DataTransfer();
        liste.forEach(function (f) { dt.items.add(f); });
        eingabe.files = dt.files;
        eingabe.dispatchEvent(new Event('change', { bubbles: true }));
        uebergeben = true;
      }
    } catch (e) { uebergeben = false; }
    sag(uebergeben
      ? 'Ich habe ' + namen + ' an den Unterlagen-Eingang gegeben. Im Fenster siehst du, was ausgelesen wurde, und entscheidest selbst, was übernommen wird.'
      : 'Der Unterlagen-Eingang ist offen – wähle ' + namen + ' dort bitte noch einmal aus (dein Browser lässt die Übergabe nicht zu).');
  }

  /* ── Bezug: welches Objekt, oder nur Fragen ─────────────────────────── */
  function bezug() {
    if (!fenster) return;
    var mit = !!window._currentObjKey;
    fenster.classList.toggle('ohne-objekt', !mit);
    var s = el('dp-blase-bezug');
    if (s) {
      var nr = el('hdr-obj-num'), nm = el('hdr-obj');
      var txt = mit ? ((nr && nr.textContent.trim() ? nr.textContent.trim() + ' · ' : '') + (nm ? nm.textContent.trim() : '')) : '';
      s.textContent = mit ? 'zu ' + (txt || 'diesem Objekt') + ' · Fragen und Änderungen' : 'kein Objekt offen · nur Fragen';
      s.title = s.textContent;
    }
    var inp = el('dp-cp-in');
    if (inp && fenster.contains(inp)) inp.placeholder = mit ? 'Frage oder Änderung – z. B. „Miete auf 9 €/m² erhöhen“' : 'Frage an den Piloten …';
    var hint = fenster.querySelector('.dp-cp-hint');
    if (hint) hint.textContent = mit
      ? 'Frag mich zu Lage, Verhandlung, Finanzierung oder Bank – ich arbeite mit den Daten dieses Objekts. Änderungen wie „Miete auf 9 €/m² erhöhen“ schlage ich vor, du bestätigst. Mit der Klammer gibst du eine Unterlage in den Eingang.'
      : 'Es ist kein Objekt offen – ich beantworte Fragen zu DealPilot, Kennzahlen und Vorgehen. Für Änderungen und Unterlagen öffne zuerst ein Objekt.';
  }

  function auf() {
    bauen();
    if (!el('dp-cp') && typeof window._dpCopilotMount === 'function') { try { window._dpCopilotMount(); } catch (e) {} }
    ausstatten();
    bezug();
    offen = true;
    fenster.classList.add('an'); fab.classList.add('auf'); fab.setAttribute('aria-expanded', 'true');
    var inp = el('dp-cp-in');
    setTimeout(function () { try { if (inp) inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
    var log = el('dp-cp-log'); if (log) log.scrollTop = log.scrollHeight;
  }
  function zu() {
    if (!fenster) return;
    offen = false;
    fenster.classList.remove('an'); if (fab) { fab.classList.remove('auf'); fab.setAttribute('aria-expanded', 'false'); }
  }

  /* ── Verweis im Reiter Pilot-Analyse: dort stand der Chat bis v3217 ── */
  function verweis() {
    var s5 = el('s5');
    if (!s5 || el('dp-cp-verweis')) return;
    var d = document.createElement('div'); d.id = 'dp-cp-verweis';
    d.innerHTML = '<span style="flex:1 1 260px">Der <b>Co-Pilot</b> sitzt jetzt in der Pilot-Blase unten rechts – in jeder Ansicht, mit denselben Fragen, Änderungen und Unterlagen.</span>'
      + '<button type="button">Co-Pilot öffnen</button>';
    d.querySelector('button').addEventListener('click', auf);
    s5.appendChild(d);
  }

  /* ── Sichtbarkeit und Platz ─────────────────────────────────────────── */
  function angemeldet() {
    if (el('auth-modal')) return false;
    try { return !!(window.Auth && typeof Auth.isLoggedIn === 'function' && Auth.isLoggedIn()); } catch (e) { return false; }
  }
  function sichtbar(x) {
    if (!x) return false;
    var cs = getComputedStyle(x);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    var r = x.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  }
  var GRUND = 18;
  function platz() {
    if (!fab) return;
    var an = angemeldet();
    /* Handy: offene Datenaufnahme-Schublade (z 1100, von unten) hat Vorrang */
    var schublade = innerWidth <= 640 && document.querySelector('.dp-pf-scroll.dp-pf-open');
    var zeigen = an && !schublade;
    /* liegt ein Fenster ueber dem Platz (Einstellungen, Hilfe, Import), tritt die Blase zurueck */
    if (zeigen && !offen) {
      var r = fab.classList.contains('an') ? fab.getBoundingClientRect() : null, unter = null;
      if (r && r.width) {
        try { unter = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).filter(function (x) { return x !== fab && !fab.contains(x); })[0]; } catch (e) {}
        if (unter && unter.closest && unter.closest('.global-view-overlay, .modal-backdrop, .oabi-ov, #dp-atlas, #dp-tower, [role="dialog"]:not(#dp-blase)')) zeigen = false;
      }
    }
    fab.classList.toggle('an', zeigen);
    if (!an && offen) zu();
    if (!zeigen) return;
    /* Werkzeuge unten rechts: die Blase steigt ueber sie */
    var grund = innerWidth <= 640 ? 12 : GRUND, boden = grund;
    ['.dpl-schalter', '#dp-kv-panel', '.dp-pf-mtrigger'].forEach(function (sel) {
      var x = document.querySelector(sel);
      if (!x || !sichtbar(x)) return;
      var rr = x.getBoundingClientRect();
      if (rr.right > innerWidth - 90 && rr.bottom > innerHeight - 140 && getComputedStyle(x).position === 'fixed') boden = Math.max(boden, Math.round(innerHeight - rr.top + 10));
    });
    var px = boden + 'px';
    if (fab.style.bottom !== px) fab.style.bottom = px;
    if (fenster && innerWidth > 640) { var fb = (boden + 68) + 'px'; if (fenster.style.bottom !== fb) fenster.style.bottom = fb; }
  }

  /* ── Tasten ─────────────────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && offen) {
      var t = document.getElementById('dp-tower');
      if (t && t.classList.contains('an')) return;   /* der Tower schliesst zuerst */
      zu();
    }
  });

  /* Objektwechsel: Kopfzeile neu lesen. Kein eigenes Ereignis noetig - beim Oeffnen
     und im Takt von platz() wird der Bezug nachgezogen, solange das Fenster offen ist. */
  function start() {
    bauen();
    verweis();
    platz();
    setInterval(function () { platz(); if (offen) bezug(); }, 1000);
    var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(platz, 150); });
    /* copilot.js baut seinen Chat beim DOMContentLoaded - danach ausstatten */
    if (!ausstatten()) {
      var mo = new MutationObserver(function () { if (ausstatten()) { try { mo.disconnect(); } catch (e) {} } });
      try { mo.observe(fenster, { childList: true, subtree: true }); } catch (e) {}
    }
  }

  bauen();   /* synchron: der Rumpf muss stehen, bevor copilot.js montiert */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.DealPilotBlase = { VERSION: 'v3218', auf: auf, zu: zu, anhaengen: anhaengen, platz: platz,
    istOffen: function () { return offen; } };
})();
