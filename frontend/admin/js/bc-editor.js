/* DealPilot Admin — Massenmail-Editor (v778f + v780b Datei-Bilder + v780c Bild-Resize/Loeschen)
   Self-contained: injiziert eigenes CSS, kein CDN. Ersetzt sichtbar die
   Textarea #bc-body, spiegelt HTML in die (versteckte) Textarea zurueck. */
(function () {
  'use strict';
  if (window._bcEditorInit) return;

  var DEFAULT_HTML =
    '<p>Hallo,</p><p>kurze Info aus dem DealPilot-Team:</p><p><br></p>' +
    '<p>Viele Gr\u00fc\u00dfe<br>Dein DealPilot-Team</p>';

  function injectCss() {
    if (document.getElementById('bc-editor-css')) return;
    var st = document.createElement('style');
    st.id = 'bc-editor-css';
    st.textContent = [
      '#bc-editor-host{border:1px solid #ddd;border-radius:8px;overflow:hidden;background:#fff;margin-top:4px;}',
      '#bc-editor-tb{display:flex;flex-wrap:wrap;gap:3px;padding:6px 8px;border-bottom:1px solid #eee;background:#fbf9f4;}',
      '#bc-editor-tb .g{display:flex;gap:2px;align-items:center;padding:0 5px;border-right:1px solid #e7e1d4;}',
      '#bc-editor-tb .g:last-child{border-right:0;}',
      '#bc-editor-tb button{height:30px;min-width:30px;padding:0 8px;border:1px solid transparent;border-radius:6px;background:transparent;cursor:pointer;font-size:13px;color:#1b1815;display:inline-flex;align-items:center;justify-content:center;gap:5px;}',
      '#bc-editor-tb button:hover{background:#fff;border-color:#e7e1d4;}',
      '#bc-editor-tb button.on{background:#1b1815;color:#fff;border-color:#1b1815;}',
      '#bc-editor-tb select,#bc-editor-tb input[type=color]{height:30px;border:1px solid #e7e1d4;border-radius:6px;background:#fff;font-size:12.5px;cursor:pointer;}',
      '#bc-editor-tb input[type=color]{width:30px;padding:2px;}',
      '#bc-editor{position:relative;min-height:200px;max-height:340px;overflow:auto;padding:14px 16px;font-size:14px;line-height:1.6;outline:none;font-family:Inter,Arial,sans-serif;color:#1b1815;}',
      '#bc-editor:empty:before{content:attr(data-ph);color:#9a9184;}',
      '#bc-editor img{max-width:100%;border-radius:6px;}',
      '#bc-editor img.bc-img-sel{outline:2px solid #C9A84C;outline-offset:1px;}',
      '#bc-editor a{color:#b8932f;}',
      '#bc-editor blockquote{border-left:3px solid #C9A84C;margin:8px 0;padding:3px 12px;color:#6f675b;}',
      '#bc-editor hr{border:none;border-top:1px solid #e7e1d4;margin:12px 0;}',
      /* Resize-Griffe (Overlay) */
      '#bc-img-handles{position:absolute;border:1px solid #C9A84C;pointer-events:none;z-index:5;display:none;}',
      '#bc-img-handles .h{position:absolute;width:12px;height:12px;background:#fff;border:2px solid #C9A84C;border-radius:50%;pointer-events:auto;}',
      '#bc-img-handles .h.nw{left:-7px;top:-7px;cursor:nwse-resize;}',
      '#bc-img-handles .h.ne{right:-7px;top:-7px;cursor:nesw-resize;}',
      '#bc-img-handles .h.sw{left:-7px;bottom:-7px;cursor:nesw-resize;}',
      '#bc-img-handles .h.se{right:-7px;bottom:-7px;cursor:nwse-resize;}',
      '#bc-img-handles .sz{position:absolute;right:0;top:-22px;background:#1b1815;color:#fff;font:11px/1.4 JetBrains Mono,monospace;padding:1px 6px;border-radius:4px;white-space:nowrap;}'
    ].join('');
    document.head.appendChild(st);
  }

  function btn(label, title, fn, mark) {
    var b = document.createElement('button');
    b.type = 'button'; b.title = title; b.innerHTML = label;
    if (mark) b.setAttribute('data-mark', mark);
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    b.addEventListener('click', function (e) { e.preventDefault(); fn(); });
    return b;
  }

  function resizeImage(dataUrl, maxPx, cb) {
    try {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        if (!w || !h || (w <= maxPx && h <= maxPx)) { cb(dataUrl); return; }
        var scale = Math.min(maxPx / w, maxPx / h);
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var c = document.createElement('canvas'); c.width = cw; c.height = ch;
        c.getContext('2d').drawImage(img, 0, 0, cw, ch);
        var isPng = /^data:image\/png/i.test(dataUrl);
        try { cb(c.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.85)); }
        catch (e) { cb(dataUrl); }
      };
      img.onerror = function () { cb(dataUrl); };
      img.src = dataUrl;
    } catch (e) { cb(dataUrl); }
  }

  function build(host, ta) {
    injectCss();
    try { document.execCommand('styleWithCSS', false, true); } catch (e) {}

    var tb = document.createElement('div'); tb.id = 'bc-editor-tb';
    var ed = document.createElement('div');
    ed.id = 'bc-editor'; ed.contentEditable = 'true';
    ed.setAttribute('data-ph', 'Hier die Nachricht schreiben \u2026');

    function sync() {
      // Mail-HTML OHNE Resize-Overlay und ohne Auswahl-Markierung spiegeln
      var clone = ed.cloneNode(true);
      var hh = clone.querySelector('#bc-img-handles'); if (hh && hh.parentNode) hh.parentNode.removeChild(hh);
      var seld = clone.querySelectorAll('img.bc-img-sel');
      for (var i = 0; i < seld.length; i++) seld[i].classList.remove('bc-img-sel');
      ta.value = clone.innerHTML;
      try { ta.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {
        var ev = document.createEvent('Event'); ev.initEvent('input', true, true); ta.dispatchEvent(ev);
      }
    }
    function exec(cmd, val) { ed.focus(); document.execCommand(cmd, false, val || null); sync(); states(); }

    // Schrift
    var g1 = document.createElement('div'); g1.className = 'g';
    var fSel = document.createElement('select');
    [['', 'Standard'], ["Georgia, 'Times New Roman', serif", 'Georgia'],
     ["'Times New Roman', Times, serif", 'Times'], ['Verdana, Geneva, sans-serif', 'Verdana'],
     ["'Trebuchet MS', sans-serif", 'Trebuchet'], ["'Courier New', monospace", 'Courier']]
      .forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; fSel.appendChild(op); });
    fSel.title = 'Schriftart (nur mailsicher)';
    fSel.addEventListener('change', function () { if (fSel.value) exec('fontName', fSel.value); else exec('removeFormat'); });
    var sSel = document.createElement('select'); sSel.title = 'Gr\u00f6\u00dfe';
    [['2', 'Klein'], ['3', 'Normal'], ['5', 'Gro\u00df'], ['6', '\u00dcberschrift']]
      .forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (o[0] === '3') op.selected = true; sSel.appendChild(op); });
    sSel.addEventListener('change', function () { exec('fontSize', sSel.value); });
    var col = document.createElement('input'); col.type = 'color'; col.value = '#1b1815'; col.title = 'Schriftfarbe';
    col.addEventListener('input', function () { exec('foreColor', col.value); });
    g1.appendChild(fSel); g1.appendChild(sSel); g1.appendChild(col);

    // B/I/U
    var g2 = document.createElement('div'); g2.className = 'g';
    g2.appendChild(btn('<b>B</b>', 'Fett', function () { exec('bold'); }, 'bold'));
    g2.appendChild(btn('<i>I</i>', 'Kursiv', function () { exec('italic'); }, 'italic'));
    g2.appendChild(btn('<u>U</u>', 'Unterstrichen', function () { exec('underline'); }, 'underline'));

    // Ausrichtung
    var g3 = document.createElement('div'); g3.className = 'g';
    g3.appendChild(btn('\u2630', 'Linksb\u00fcndig', function () { exec('justifyLeft'); }));
    g3.appendChild(btn('\u2261', 'Zentriert', function () { exec('justifyCenter'); }));
    g3.appendChild(btn('\u2630', 'Rechtsb\u00fcndig', function () { exec('justifyRight'); }));
    g3.appendChild(btn('\u25a4', 'Blocksatz', function () { exec('justifyFull'); }));

    // Listen / Zitat
    var g4 = document.createElement('div'); g4.className = 'g';
    g4.appendChild(btn('\u2022 Liste', 'Aufz\u00e4hlung', function () { exec('insertUnorderedList'); }));
    g4.appendChild(btn('1. Liste', 'Nummeriert', function () { exec('insertOrderedList'); }));
    g4.appendChild(btn('\u275d', 'Zitat', function () { exec('formatBlock', 'blockquote'); }));

    // Link / Bilder / Linie
    var g5 = document.createElement('div'); g5.className = 'g';
    g5.appendChild(btn('\ud83d\udd17 Link', 'Link einf\u00fcgen', function () {
      var u = prompt('Link-Adresse (https://\u2026):', 'https://'); if (u) exec('createLink', u);
    }));
    g5.appendChild(btn('\ud83d\uddbc Datei', 'Bild vom Rechner einf\u00fcgen', function () { fileInput.click(); }));
    g5.appendChild(btn('\ud83d\uddbc URL', 'Bild per URL einf\u00fcgen', function () {
      var u = prompt('Bild-URL (https://\u2026):', 'https://'); if (u) exec('insertImage', u);
    }));
    g5.appendChild(btn('\u2014', 'Trennlinie', function () { exec('insertHorizontalRule'); }));
    var fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.style.display = 'none';
    fileInput.addEventListener('change', function (e) {
      var f = e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () { resizeImage(r.result, 1000, function (out) { exec('insertImage', out); }); };
      r.readAsDataURL(f); e.target.value = '';
    });
    g5.appendChild(fileInput);

    [g1, g2, g3, g4, g5].forEach(function (g) { tb.appendChild(g); });

    function states() {
      [['bold', 'bold'], ['italic', 'italic'], ['underline', 'underline']].forEach(function (p) {
        var b = tb.querySelector('button[data-mark="' + p[1] + '"]'); if (!b) return;
        var on = false; try { on = document.queryCommandState(p[0]); } catch (e) {}
        b.classList.toggle('on', !!on);
      });
    }
    ed.addEventListener('input', sync);
    ed.addEventListener('keyup', states);
    ed.addEventListener('mouseup', states);

    host.appendChild(tb); host.appendChild(ed);

    // ---------- Bild-Auswahl + Resize-Griffe + Loeschen ----------
    var sel = null;            // aktuell ausgewaehltes <img>
    var handles = document.createElement('div'); handles.id = 'bc-img-handles';
    ['nw', 'ne', 'sw', 'se'].forEach(function (k) {
      var h = document.createElement('div'); h.className = 'h ' + k; h.setAttribute('data-k', k); handles.appendChild(h);
    });
    var szTag = document.createElement('div'); szTag.className = 'sz'; handles.appendChild(szTag);
    ed.appendChild(handles);

    function placeHandles() {
      if (!sel) { handles.style.display = 'none'; return; }
      // Position relativ zum scrollbaren Editor
      var er = ed.getBoundingClientRect();
      var ir = sel.getBoundingClientRect();
      var left = ir.left - er.left + ed.scrollLeft;
      var top = ir.top - er.top + ed.scrollTop;
      handles.style.display = 'block';
      handles.style.left = left + 'px';
      handles.style.top = top + 'px';
      handles.style.width = ir.width + 'px';
      handles.style.height = ir.height + 'px';
      szTag.textContent = Math.round(ir.width) + ' \u00d7 ' + Math.round(ir.height) + ' px';
    }
    function selectImg(img) {
      if (sel) sel.classList.remove('bc-img-sel');
      sel = img;
      if (sel) { sel.classList.add('bc-img-sel'); placeHandles(); }
      else handles.style.display = 'none';
    }

    ed.addEventListener('click', function (e) {
      if (e.target && e.target.tagName === 'IMG') { selectImg(e.target); }
      else if (e.target !== szTag && !/\bh\b/.test(e.target.className || '')) { selectImg(null); }
    });
    ed.addEventListener('scroll', placeHandles);
    window.addEventListener('resize', placeHandles);

    // Drag-Resize
    var drag = null;
    handles.addEventListener('mousedown', function (e) {
      if (!sel || !e.target.classList.contains('h')) return;
      e.preventDefault();
      var ir = sel.getBoundingClientRect();
      drag = { k: e.target.getAttribute('data-k'), x: e.clientX, w: ir.width, h: ir.height, ratio: ir.width / ir.height };
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', endDrag);
    });
    function onDrag(e) {
      if (!drag || !sel) return;
      var dx = e.clientX - drag.x;
      // nw/sw verkleinern bei Rechtsziehen -> Vorzeichen je Ecke
      var dir = (drag.k === 'ne' || drag.k === 'se') ? 1 : -1;
      var newW = Math.max(40, Math.round(drag.w + dir * dx));
      sel.style.width = newW + 'px';
      sel.style.height = 'auto';
      sel.removeAttribute('width'); sel.removeAttribute('height');
      placeHandles();
    }
    function endDrag() {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', endDrag);
      drag = null; sync();
    }

    // Loeschen per Entf/Backspace, wenn ein Bild markiert ist
    ed.addEventListener('keydown', function (e) {
      if (sel && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        var img = sel; selectImg(null);
        if (img && img.parentNode) img.parentNode.removeChild(img);
        sync();
      }
    });

    var initial = (ta.value && ta.value.trim()) ? ta.value : DEFAULT_HTML;
    ed.innerHTML = initial;
    // handles-Overlay nach innerHTML neu anhaengen (innerHTML hat es entfernt)
    ed.appendChild(handles);
    sync();
  }

  function init() {
    var ta = document.getElementById('bc-body');
    var host = document.getElementById('bc-editor-host');
    if (!ta || !host || host.getAttribute('data-built')) return;
    host.setAttribute('data-built', '1');
    ta.style.display = 'none';
    build(host, ta);
  }

  window._bcEditorInit = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
