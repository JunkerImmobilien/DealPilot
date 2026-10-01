/* ═══════════════════════════════════════════════════════════════════════
   v1754 · DER SPRECHLAUF IN DEN PILOTEN
   ═══════════════════════════════════════════════════════════════════════

   Marcel am 01.10.2026: „Bei der Pilot-Analyse für das einzelne Objekt,
   aber auch beim Portfolio-Piloten, dass man per Sprache etwas diktieren
   kann. Wenn man Änderungen beim Objekt hat oder etwas hinzufügen möchte,
   dann kann ich das Objekt sagen und die Änderungen, und er füllt die
   Felder aus oder ergänzt sie."

   ERST GEMESSEN, DANN GEBAUT. Was es am 01.10.2026 schon gab:

     window.FIELDS                221 Felder, 213 im DOM, 192 Eingaben
     VoiceImport.open(fertig,opts) der ganze Sprechlauf
     VoiceImport._konfliktZeigen  „das Feld ist schon gefüllt"
     VoiceImport._gleicherWert    erkennt, wenn sich nichts ändert
     VoiceImport._ueberspringen   der Weg daran vorbei
     VoiceImport._kontingent      Kosten und Restguthaben

   Damit sind V3 (belegte Felder bestätigen lassen), V5 (Kosten ansagen)
   und V7 (jedes Feld erreichbar) im Kern vorhanden — V7 sogar
   strukturell: der Katalog entsteht aus `window.FIELDS`, nicht aus einer
   gepflegten Liste im Sprachmodul. Ein neues Feld steht damit von allein
   drin.

   > Deshalb wird hier NICHTS nachgebaut. Erreichbar war der Sprechlauf
   > bisher nur aus der Datenaufnahme-Karte (`object-actions.js`) und dem
   > QuickBoarding (`qc-bridge.js`). Was fehlte, war der Einstieg an den
   > beiden Piloten — nicht die Maschine dahinter. Ein zweiter Sprechweg
   > daneben liefe auseinander, sobald einer von beiden gepflegt wird.

   Der Unterschied der beiden Orte:

     Pilot-Analyse (s5)   ein Objekt ist geladen → direkt diktieren
     Portfolio-Cockpit    kein Objekt → erst eines wählen (V2)

   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var MARKE = 'dp-pilot-sprache';

  function el(id) { return document.getElementById(id); }

  function toast(t) {
    try { if (typeof window.toast === 'function') return window.toast(t); } catch (e) {}
    console.log('[PilotSprache]', t);
  }

  /* Welches Objekt ist offen? `window._currentObjKey` ist laut CLAUDE.md die
     einzige verlaessliche Referenz — der Kopftext ist nur Anzeige. */
  function objektOffen() {
    try { return !!window._currentObjKey; } catch (e) { return false; }
  }

  function objektName() {
    var h = el('hdr-obj');
    var t = h ? (h.textContent || '').trim() : '';
    return (t && t !== 'Neues Objekt') ? t : null;
  }

  /* ── Der Sprechlauf selbst ──────────────────────────────────────────
     Gerufen wird derselbe Einstieg wie in der Datenaufnahme. `vorlauf`
     bleibt leer: hier kommt kein Import davor, der schon Felder gefuellt
     haette. */
  function diktieren(opt) {
    opt = opt || {};
    if (!(window.VoiceImport && typeof window.VoiceImport.open === 'function')) {
      toast('Sprechlauf nicht geladen.');
      return;
    }
    if (!objektOffen() && !opt.ohneObjekt) {
      toast('Erst ein Objekt öffnen — dann weiß DealPilot, wohin die Angaben gehören.');
      return;
    }
    window.VoiceImport.open(function (erg) {
      /* Nach dem Lauf neu rechnen, damit die Analyse auf den neuen Zahlen
         steht. `calc()` ist der vorhandene Weg; nichts nachrechnen. */
      try { if (typeof window.calc === 'function') window.calc(); } catch (e) {}
      try { if (typeof window.autoSave === 'function') window.autoSave(); } catch (e) {}
      if (erg && erg.applied) toast('Übernommen. Die Analyse rechnet mit den neuen Angaben.');
    }, { gefuehrt: !!opt.gefuehrt, vorlauf: [], vorlaufFelder: [] });
  }

  /* ── Der Knopf ──────────────────────────────────────────────────────
     Er sitzt NEBEN „Pilot-Analyse starten", nicht darin: die Analyse
     kostet Kerosin, das Diktat auch — zwei Kosten hinter einem Knopf
     waeren wieder der Wuerfel aus v1731. */
  function knopfBauen() {
    if (el(MARKE)) return true;
    var start = el('ai-btn');
    if (!start || !start.parentNode) return false;

    var b = document.createElement('button');
    b.type = 'button';
    b.id = MARKE;
    b.className = 'ai-btn ' + MARKE + '-btn';
    b.innerHTML =
      '<svg class="ai-btn-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
      + 'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'
      + '<path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>'
      + '<path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/>'
      + '</svg><span>Änderungen diktieren</span>';
    b.addEventListener('click', function () { diktieren({}); });

    start.parentNode.insertBefore(b, start.nextSibling);

    /* Ein Satz, der sagt WAS passiert — sonst ist es ein Knopf ohne
       Versprechen. */
    var p = document.createElement('p');
    p.className = MARKE + '-hinweis';
    p.textContent = 'Sag, was sich geändert hat — DealPilot trägt es in die passenden '
      + 'Felder ein. Steht dort schon etwas, fragt es nach, bevor es überschreibt.';
    b.parentNode.insertBefore(p, b.nextSibling);
    return true;
  }

  function stil() {
    if (el(MARKE + '-stil')) return;
    var s = document.createElement('style');
    s.id = MARKE + '-stil';
    s.textContent = [
      '#' + MARKE + '{margin-top:8px;background:transparent;'
        + 'border:1px solid var(--wl-c9a84c,#C9A84C);color:var(--wl-c9a84c,#C9A84C)}',
      '#' + MARKE + ':hover{background:var(--wl-c9a84c,#C9A84C);color:#0A0A09}',
      '.' + MARKE + '-hinweis{margin:7px 0 0;font-size:11.5px;line-height:1.55;opacity:.72}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* Die Abschnitte entstehen nicht alle beim Laden — deshalb beobachten
     statt einmal zu versuchen. Der Beobachter haelt sich selbst an:
     sobald der Knopf steht, ist er fertig. */
  function start() {
    stil();
    if (knopfBauen()) return;
    var mo = new MutationObserver(function () {
      if (knopfBauen()) { try { mo.disconnect(); } catch (e) {} }
    });
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    /* Nach 20 s aufhoeren — ein Beobachter, der ewig laeuft, kostet still. */
    setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 20000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else { start(); }

  window.DealPilotPilotSprache = {
    diktieren: diktieren,
    objektOffen: objektOffen,
    objektName: objektName,
    knopfBauen: knopfBauen
  };
})();
