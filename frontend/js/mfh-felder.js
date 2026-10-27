'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   mfh-felder.js — v3003 · Objekt mit Einheiten: welche Felder sich füllen

   Marcel, 27.10.2026: „Beim Mehrfamilienhaus erklären: Wer am Anfang die
   Objektart MFH wählt und Einheiten erfasst, braucht vieles nicht mehr
   anzugeben ... ‚Zustand der Wohnung': beim MFH haben wir ein ganzes Haus."

   GEMESSEN (Inventur 27.10.2026): `uebernehmen()` in mfh-einheiten.js füllt
   Wohnfläche, Einheiten, Nettokaltmiete, Zimmer und Vermietungsstand — die
   Felder blieben aber frei editierbar, und nichts sagte, woher sie kommen.
   Der „Zustand der Wohnung" wird von fünf Stellen gelesen (Deal Score,
   RND-Rückfall, AfA-Hinweis, Marktbericht, Deal-Aktion) und darf deshalb
   NICHT verschwinden; er heißt beim Haus „Zustand des Gebäudes" und wird
   aus dem Gesamtzustand der Einheiten abgeleitet (flächengewichtet).

   Was dieses Modul tut:
     · Erklärkasten unter der Objektart, nur bei Arten mit Einheiten
     · solange Einheiten erfasst sind: die gefüllten Felder schreibgeschützt
       mit „aus den Einheiten"; ohne Einheiten bleiben sie frei
     · Zustand des Gebäudes aus den Einheiten, wo sie einen Zustand führen
   Es LÖSCHT nichts und blendet nichts aus, was ein Leser braucht. Etage,
   Badezimmer, Miteigentumsanteil blendet objektart-felder.js /
   mfh-einheiten.js schon aus — hier wird es nur erklärt.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DpMfhFelder) return;
  var VERSION = 'v3003';
  var $ = function (id) { return document.getElementById(id); };
  var GESPERRT = ['wfl', 'einheiten', 'nkm', 'vermstand'];   /* zimmer sperrt mfh-einheiten.js selbst */
  var NAMEN = { wfl: 'Wohnfläche', einheiten: 'Wohneinheiten', nkm: 'Nettokaltmiete (Reiter Miete)', zimmer: 'Zimmer', vermstand: 'Vermietungsstand', ds2_zustand: 'Zustand des Gebäudes' };
  function zahl(v) { var n = parseFloat(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
  function art() { var s = $('objart'); return s ? String(s.value || '').toUpperCase() : ''; }
  function mitEinheiten() { try { return !!(window.DpMfhEinheiten && DpMfhEinheiten.artMitEinheiten(art())); } catch (e) { return false; } }
  function liste() {
    var d = window._dpMfh;
    if (!mitEinheiten() || !d || !Array.isArray(d.einheiten)) return [];
    return d.einheiten.filter(function (e) { return zahl(e.wfl) > 0 || zahl(e.ist) > 0 || String(e.lage || '').trim(); });
  }

  /* Zustand des Gebäudes aus dem „Gesamtzustand" der Einheiten (1–5), flächengewichtet.
     5 neuwertig / 4 modernisiert → gut; 3 gepflegt → normal; 2 → renovierungsbedürftig;
     1 → stark sanierungsbedürftig. „neuwertig" wird bewusst nicht „Neubau / kernsaniert":
     das löst den Hinweis auf degressive Neubau-AfA aus (afa-engine.js). */
  function zustandAus(L) {
    var s = 0, g = 0, n = 0;
    L.forEach(function (e) { var z = zahl(e.zustand); if (z >= 1 && z <= 5) { var w = zahl(e.wfl) || 1; s += z * w; g += w; n++; } });
    if (!n) return null;
    var m = Math.round(s / g);
    return { wert: m >= 4 ? 'gut' : m === 3 ? 'normal' : m === 2 ? 'renovierungsbeduerftig' : 'stark_sanierungsbeduerftig', n: n, von: L.length, mittel: s / g };
  }

  function hinweisIn(id, text) {
    var e = $(id); var f = e && e.closest ? e.closest('.f') : null; if (!f) return;
    var h = f.querySelector('.mff-aus');
    if (text) {
      if (!h) { h = document.createElement('div'); h.className = 'cf-hint mff-aus'; f.appendChild(h); }
      if (h.textContent !== text) h.textContent = text;   /* nur bei Änderung - sonst weckt es den eigenen Beobachter */
    } else if (h) h.remove();
  }
  function sperren(id, an, text) {
    var e = $(id); if (!e) return;
    if (an) {
      if (e.tagName === 'SELECT') { e.classList.add('mff-gesperrt'); e.setAttribute('tabindex', '-1'); e.setAttribute('aria-readonly', 'true'); }
      else { if (!e.hasAttribute('data-mff-ro')) e.setAttribute('data-mff-ro', e.readOnly ? '1' : '0'); e.readOnly = true; e.classList.add('mff-gesperrt'); }
      e.title = 'Aus den erfassten Einheiten — im Einheiten-Dialog ändern';
      hinweisIn(id, text || 'aus den Einheiten');
    } else {
      if (e.classList.contains('mff-gesperrt')) {
        e.classList.remove('mff-gesperrt'); e.removeAttribute('aria-readonly');
        if (e.tagName === 'SELECT') e.removeAttribute('tabindex');
        else { e.readOnly = e.getAttribute('data-mff-ro') === '1'; e.removeAttribute('data-mff-ro'); }
        e.title = '';
      }
      hinweisIn(id, null);
    }
  }
  function zustandLabel(haus) {
    var e = $('ds2_zustand'); var f = e && e.closest ? e.closest('.f') : null; var l = f && f.querySelector('label'); if (!l) return;
    var t = null;
    for (var i = 0; i < l.childNodes.length; i++) { var c = l.childNodes[i]; if (c.nodeType === 3 && /Zustand/.test(c.nodeValue)) { t = c; break; } }
    if (!t) return;
    if (t._mffOrig == null) t._mffOrig = t.nodeValue;
    t.nodeValue = haus ? t._mffOrig.replace(/Zustand der Wohnung|Zustand/, 'Zustand des Gebäudes') : t._mffOrig;
  }

  function kasten(L) {
    var o = $('objart'); var f = o && o.closest ? o.closest('.f') : null; if (!f || !f.parentNode) return;
    var k = $('mff-kasten');
    if (!mitEinheiten()) { if (k) k.remove(); return; }
    if (!k) { k = document.createElement('div'); k.id = 'mff-kasten'; k.className = 'f s2 mff-kasten'; f.parentNode.insertBefore(k, f.nextSibling); }
    var n = L.length;
    k.innerHTML = '<div class="mff-titel">' + (n ? n + ' Einheiten erfasst — diese Felder kommen aus den Einheiten' : 'Mit Einheiten erfasst du jede Wohnung einzeln') + '</div>'
      + '<div class="mff-text">' + (n ? '' : 'Daraus füllen sich ') + '<b>Wohnfläche, Wohneinheiten, Zimmer, Nettokaltmiete, Vermietungsstand</b> und — wo du den Zustand je Einheit angibst — der <b>Zustand des Gebäudes</b>. '
      + 'Nicht nötig beim ganzen Haus: Etage, Badezimmer, Miteigentumsanteil (100 %).'
      + (n ? ' Ändern im Einheiten-Dialog.' : '') + '</div>'
      + '<button type="button" class="btn btn-outline btn-sm" id="mff-oeffnen">' + (n ? 'Einheiten bearbeiten' : 'Einheiten erfassen') + '</button>';
  }

  var _lauf = false;
  function anwenden() {
    if (_lauf) return; _lauf = true;
    try {
      var L = liste(), aktiv = L.length > 0, haus = mitEinheiten();
      kasten(L);
      GESPERRT.forEach(function (id) { sperren(id, aktiv); });
      zustandLabel(haus);
      var z = aktiv ? zustandAus(L) : null, sel = $('ds2_zustand');
      if (z && sel) {
        if (sel.value !== z.wert) { sel.value = z.wert; try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {} }
        sperren('ds2_zustand', true, 'aus den Einheiten (Ø Gesamtzustand von ' + z.n + (z.n === z.von ? '' : ' der ' + z.von) + ' Einheiten)');
      } else sperren('ds2_zustand', false);
    } finally { _lauf = false; }
  }
  var _t = null;
  function spaeter() { clearTimeout(_t); _t = setTimeout(anwenden, 150); }

  function stil() {
    if ($('mff-stil')) return;
    var s = document.createElement('style'); s.id = 'mff-stil';
    s.textContent = [
      '.mff-kasten{padding:10px 12px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);border-radius:8px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 7%, transparent);font:400 12.5px/1.5 Inter,system-ui,sans-serif}',
      '.mff-titel{font-weight:600;margin-bottom:2px}',
      '.mff-text{margin-bottom:8px}',
      'input.mff-gesperrt,select.mff-gesperrt{opacity:.75;cursor:not-allowed}',
      'select.mff-gesperrt{pointer-events:none}',
      '.mff-aus{margin-top:3px}'
    ].join('');
    document.head.appendChild(s);
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('#mff-oeffnen') : null;
    if (!b) return;
    ev.preventDefault();
    try { if (window.DpMfhEinheiten && DpMfhEinheiten.oeffnen) DpMfhEinheiten.oeffnen(0); } catch (e) {}
  });
  document.addEventListener('change', function (ev) { if (ev.target && ev.target.id === 'objart') spaeter(); }, true);
  window.addEventListener('dp:object-ready', function () { setTimeout(anwenden, 300); });
  function start() {
    stil(); anwenden();
    /* mfh-einheiten.js zeichnet #mfh-einstieg nach jedem Übernehmen neu - das ist der Moment, in dem sich die Einheiten geändert haben */
    try {
      var host = $('mfh-einstieg');
      var mo = new MutationObserver(spaeter);
      if (host) mo.observe(host, { childList: true, subtree: true });
      else { var wfl = $('wfl'), f = wfl && wfl.closest ? wfl.closest('.f') : null; if (f) mo.observe(f, { childList: true, subtree: true }); }
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 50); }); else setTimeout(start, 50);

  window.DpMfhFelder = { VERSION: VERSION, anwenden: anwenden, zustandAus: zustandAus };
})();
