/* beleg-lupe.js · v4470 (24.11.2026)
   Marcel: „wenn ich einlese und mir das PDF angezeigt wird, dass wenn ich draufklicke, ich das auch nochmal groß sehe“.
   Ein Klick auf eine Seitenansicht im Prüffenster der Belege (.bi-bild, beleg-import.js) oder in der Prüfansicht des
   Eingangs ([data-bilder], unterlagen-eingang.js vorschau) öffnet die Seite groß: blättern bei mehrseitigen PDFs,
   zoomen, Schließen nur über × oder Esc (kein Klick daneben). Die Bilder sind die schon gerenderten Seiten
   (data:-URLs), es wird nichts neu geladen oder gespeichert. */
(function () {
  'use strict';
  if (window.DpBelegLupe) return;
  var ZIEL = '.bi-bild img, [data-bilder] img';

  function css() {
    if (document.getElementById('dp-beleg-lupe-css')) return;
    var s = document.createElement('style'); s.id = 'dp-beleg-lupe-css';
    s.textContent = '.bi-bild img,[data-bilder] img{cursor:zoom-in}'
      + '#dp-beleg-lupe{position:fixed;inset:0;z-index:100200;background:rgba(5,5,5,.86);display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif;color:#F8F6F1}'
      + '#dp-beleg-lupe .bl-kopf{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 45%, transparent);flex:0 0 auto}'
      + '#dp-beleg-lupe .bl-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 13px/1.3 Inter,system-ui,sans-serif}'
      + "#dp-beleg-lupe .bl-s{font:600 12px/1 'JetBrains Mono',monospace;color:var(--wl-e8cc7a, #E8CC7A);white-space:nowrap}"
      + '#dp-beleg-lupe button{border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 55%, transparent);background:transparent;color:inherit;border-radius:8px;min-width:34px;height:34px;padding:0 10px;font:600 15px/1 Inter,system-ui,sans-serif;cursor:pointer}'
      + '#dp-beleg-lupe button:disabled{opacity:.35;cursor:default}'
      + '#dp-beleg-lupe .bl-zu{font-size:22px}'
      + '#dp-beleg-lupe .bl-flaeche{flex:1 1 auto;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:16px}'
      + '#dp-beleg-lupe .bl-flaeche.fit{align-items:center}'
      + '#dp-beleg-lupe img{display:block;background:#fff;border-radius:4px;box-shadow:0 6px 30px rgba(0,0,0,.5);cursor:zoom-in}'
      + '#dp-beleg-lupe .fit img{max-width:100%;max-height:100%;width:auto;height:auto}'
      + '#dp-beleg-lupe .bl-flaeche:not(.fit) img{cursor:zoom-out}'
      + '@media (max-width:640px){#dp-beleg-lupe .bl-kopf{flex-wrap:wrap}#dp-beleg-lupe .bl-t{flex-basis:100%;order:-1}}';
    document.head.appendChild(s);
  }

  var _zu = null;
  function oeffnen(bilder, start, titel) {
    bilder = (bilder || []).filter(Boolean);
    if (!bilder.length) return;
    css();
    if (_zu) _zu();
    var i = Math.max(0, Math.min(bilder.length - 1, Number(start) || 0)), zoom = 0;   /* 0 = einpassen, sonst Faktor der Bildbreite */
    var ov = document.createElement('div'); ov.id = 'dp-beleg-lupe';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Beleg groß ansehen');
    ov.innerHTML = '<div class="bl-kopf"><span class="bl-t"></span>'
      + '<button type="button" data-bl="zurueck" aria-label="Vorige Seite">‹</button><span class="bl-s"></span><button type="button" data-bl="vor" aria-label="Nächste Seite">›</button>'
      + '<button type="button" data-bl="klein" aria-label="Kleiner">−</button><button type="button" data-bl="gross" aria-label="Größer">+</button>'
      + '<button type="button" data-bl="fit">Einpassen</button><button type="button" class="bl-zu" data-bl="zu" aria-label="Schließen">×</button></div>'
      + '<div class="bl-flaeche fit"><img alt=""></div>';
    document.body.appendChild(ov);
    var img = ov.querySelector('img'), fl = ov.querySelector('.bl-flaeche');
    function zeichnen() {
      img.src = bilder[i]; img.alt = 'Seite ' + (i + 1);
      ov.querySelector('.bl-t').textContent = titel || 'Beleg';
      ov.querySelector('.bl-s').textContent = 'Seite ' + (i + 1) + ' von ' + bilder.length;
      ov.querySelector('[data-bl="zurueck"]').disabled = i === 0;
      ov.querySelector('[data-bl="vor"]').disabled = i === bilder.length - 1;
      fl.classList.toggle('fit', !zoom);
      img.style.width = zoom ? Math.round(zoom * 100) + '%' : '';
      img.style.maxWidth = zoom ? 'none' : '';
      img.style.maxHeight = zoom ? 'none' : '';
      fl.style.justifyContent = zoom > 1 ? 'flex-start' : 'center';
    }
    function blaettern(d) { var n = i + d; if (n < 0 || n >= bilder.length) return; i = n; fl.scrollTop = 0; zeichnen(); }
    function zoomen(f) { zoom = f; zeichnen(); }
    function zu() { try { ov.remove(); } catch (e) {} document.removeEventListener('keydown', taste, true); _zu = null; }
    function taste(e) {
      if (!document.getElementById('dp-beleg-lupe')) return;
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); zu(); }
      else if (e.key === 'ArrowRight') blaettern(1);
      else if (e.key === 'ArrowLeft') blaettern(-1);
      else if (e.key === '+') zoomen(Math.min(4, (zoom || 1) * 1.25));
      else if (e.key === '-') zoomen(zoom ? Math.max(0.5, zoom / 1.25) : 0);
    }
    ov.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-bl]');
      if (b) {
        var a = b.getAttribute('data-bl');
        if (a === 'zu') zu(); else if (a === 'vor') blaettern(1); else if (a === 'zurueck') blaettern(-1);
        else if (a === 'gross') zoomen(Math.min(4, (zoom || 1) * 1.25));
        else if (a === 'klein') zoomen(zoom ? Math.max(0.5, zoom / 1.25) : 0);
        else if (a === 'fit') zoomen(0);
        return;
      }
      if (e.target === img) zoomen(zoom ? 0 : 1);   /* Klick aufs Bild: Originalbreite ↔ einpassen. Klick daneben schließt NICHT. */
    });
    document.addEventListener('keydown', taste, true);
    _zu = zu;
    zeichnen();
    return ov;
  }

  /* Ein Klick auf eine Seitenansicht: alle Seiten desselben Belegs mitnehmen, damit geblättert werden kann */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || !t.matches || !t.matches(ZIEL) || (t.closest && t.closest('#dp-beleg-lupe'))) return;
    var box = t.closest('.bi-bild, [data-bilder]'); if (!box) return;
    var alle = [].slice.call(box.querySelectorAll('img'));
    var titel = '';
    try {
      var vo = t.closest('#dp-eg-vorschau'); if (vo) { var bt = vo.querySelector('b'); titel = bt ? bt.textContent : ''; }
      var bi = t.closest('#beleg-import-ov'); if (bi) { var an = bi.querySelector('.bi-beleg.an b'); titel = an ? an.textContent : ''; }
    } catch (x) {}
    e.preventDefault(); e.stopPropagation();
    oeffnen(alle.map(function (x) { return x.getAttribute('src'); }), alle.indexOf(t), titel);
  }, true);
  css();

  window.DpBelegLupe = { VERSION: 'v4470', oeffnen: oeffnen };
})();
