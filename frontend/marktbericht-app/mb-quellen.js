'use strict';
/* ============================================================================
   DealPilot v1344 — mb-quellen.js

   Zwei Wünsche von Marcel, 12.09.2026:

   1) „Egal was ich auswähle, sind immer noch alle Felder sichtbar. Wäre es
      nicht angebracht, nur die Felder anzuzeigen, die für die Stufe auch
      wirklich relevant sind? Dann macht man vielleicht Angaben, wo man gar
      keine Angaben machen müsste."

      GEMESSEN: bei Stufe 1 steht der Reiter „Zusatzwerte" mit SECHS Feldern
      da — Liegenschaftszins, Sachwertfaktor, Bodenrichtwert, Stichtag,
      Anpassung, Grund. Die gehen ausschliesslich in die Wertermittlung ein.
      Reiter 6 ist bei Stufe 1 schon leer; dort greift die Stufenlogik von
      wertermittlung.js bereits.

      Die Felder werden VERBORGEN, nicht entfernt — wer sie ausgefüllt hat
      und dann die Tiefe wechselt, soll seine Eingaben behalten. Und es gibt
      immer einen Weg zurück („Trotzdem ausfüllen").

      NICHT ausgeblendet werden Zustand, Ausstattung und Gebäude: die
      verbessern auch die einfache Marktpreisindikation. Der Konfidenz-
      Balken sagt das ausdrücklich. Sie wegzublenden würde die Indikation
      verschlechtern — das wäre kein Aufräumen, sondern ein Rückschritt.

   2) „Wenn die Adresse eingegeben ist, dass du automatisch dort
      ranschreibst, wo man die herbekommt. Also die Gutachterausschüsse
      oder so, dass du gleich den Link ausgibst."

      Genau dafür gibt es seit v1343 `GET /quellen?plz=`. Das Register führt
      zu jedem Satz Fundstelle, Quell-URL und Lizenz — 31 amtliche Quellen.
      Wo ein Wert schon hinterlegt ist, sagt der Kasten das (dann muss man
      gar nicht suchen), sonst nennt er den zuständigen Ausschuss und den
      Weg zum Bodenrichtwert.
   ============================================================================ */
(function () {
  if (window.DealPilotMbQuellen) return;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Stil ────────────────────────────────────────────────────────────── */
  function stil() {
    if ($('mbq-css')) return;
    var s = document.createElement('style');
    s.id = 'mbq-css';
    s.textContent = [
      /* Der Quellen-Kasten */
      '.mbq{margin:0 0 16px;padding:14px 16px;border:1px solid var(--line,#26262c);',
        'border-left:3px solid var(--wl-c9a84c,#C9A84C);border-radius:0 11px 11px 0;',
        'background:color-mix(in srgb, var(--wl-c9a84c,#C9A84C) 5%, transparent);',
        'font-size:12.5px;line-height:1.55}',
      '.mbq h4{font-family:"Space Grotesk",system-ui,sans-serif;font-size:13.5px;',
        'margin:0 0 4px;font-weight:600;color:var(--wl-e8cc7a,#E8CC7A)}',
      '.mbq .mbq-amt{font-size:12px;color:var(--muted,#9a9aa3);margin:0 0 10px}',
      '.mbq ul{margin:0;padding:0;list-style:none}',
      '.mbq li{padding:5px 0;border-top:1px solid rgba(128,128,128,.16)}',
      '.mbq li:first-child{border-top:0}',
      '.mbq .k{font-weight:600}',
      '.mbq .w{font-family:"JetBrains Mono",monospace;font-size:11.5px;color:#3FA56C}',
      '.mbq .off{color:var(--muted,#8a8a93)}',
      '.mbq a{color:var(--wl-c9a84c,#C9A84C);text-decoration:underline;text-underline-offset:2px}',
      '.mbq a:hover{color:var(--wl-e8cc7a,#E8CC7A)}',
      '.mbq .mbq-fuss{margin:10px 0 0;padding-top:9px;border-top:1px solid rgba(128,128,128,.16);',
        'font-size:11.5px;color:var(--muted,#8a8a93)}',
      '.mbq .mbq-lz{font-size:10.5px;color:var(--muted,#6d6d76);margin-top:7px}',
      /* Der Stufen-Vorhang */
      '.mbq-vorhang{margin:10px 0;padding:14px 16px;border-radius:10px;font-size:12.5px;',
        'line-height:1.55;border:1px solid rgba(128,128,128,.28);',
        'background:color-mix(in srgb, var(--wl-c9a84c,#C9A84C) 6%, transparent)}',
      '.mbq-vorhang b{color:var(--wl-b8932f,#b8932f)}',
      '.mbq-vorhang-btn{display:inline-block;margin-top:10px;appearance:none;border:0;',
        'border-radius:999px;padding:8px 15px;font:inherit;font-size:12.5px;font-weight:600;',
        'cursor:pointer;background:transparent;color:inherit;',
        'border:1px solid var(--wl-c9a84c,#C9A84C)}',
      '.mbq-vorhang-btn:hover{background:color-mix(in srgb, var(--wl-c9a84c,#C9A84C) 14%, transparent)}',
      '.mbq-weg{display:none !important}',
      /* Reiter, der fuer die gewaehlte Tiefe nicht gebraucht wird */
      '.mbw-r.mbq-spaeter{opacity:.4}',
      '.mbw-r.mbq-spaeter .n::after{content:" \\00b7 ab Stufe 3";font-size:9.5px;opacity:.8}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════════════════
     TEIL 1 · Der Stufen-Vorhang
     ══════════════════════════════════════════════════════════════════════
     Nur Reiter 7 (Zusatzwerte) — er ist der einzige, der bei niedriger
     Tiefe Felder zeigt, die dort nichts bewirken. Absichtlich KEINE
     allgemeine „alles ab Stufe N verbergen"-Mechanik: die waere bequem zu
     schreiben und fachlich falsch. */
  var BLATT_STUFE = { 'mbw-b7': 3 };
  var _aufgeklappt = {};

  function gewaehlteStufe() {
    try {
      var st = window.DealPilotMbStufen;
      if (st && typeof st.gewaehlt === 'function') {
        var n = parseInt(st.gewaehlt(), 10);
        if (n >= 1 && n <= 3) return n;
      }
    } catch (e) {}
    return 3;   /* im Zweifel alles zeigen */
  }

  function vorhang() {
    var stufe = gewaehlteStufe();
    Object.keys(BLATT_STUFE).forEach(function (bid) {
      var blatt = $(bid);
      if (!blatt) return;
      var noetig = BLATT_STUFE[bid];
      var reiter = document.querySelector('.mbw-r[data-mbw-s="' + bid.replace('mbw-b', '') + '"]')
        || document.querySelectorAll('.mbw-r')[parseInt(bid.replace('mbw-b', ''), 10) - 1];
      var zuViel = stufe < noetig && !_aufgeklappt[bid];

      if (reiter) {
        if (stufe < noetig) reiter.classList.add('mbq-spaeter');
        else reiter.classList.remove('mbq-spaeter');
      }

      /* Die Inhalte verbergen, NICHT entfernen — Eingaben bleiben. */
      Array.prototype.forEach.call(blatt.children, function (kind) {
        if (kind.classList && kind.classList.contains('mbq-vorhang')) return;
        if (zuViel) kind.classList.add('mbq-weg');
        else kind.classList.remove('mbq-weg');
      });

      var alt = blatt.querySelector('.mbq-vorhang');
      if (!zuViel) { if (alt && alt.parentNode) alt.parentNode.removeChild(alt); return; }
      if (alt) return;

      var box = document.createElement('div');
      box.className = 'mbq-vorhang';
      var p = document.createElement('div');
      p.innerHTML = '<b>Diese Angaben brauchst du für die gewählte Tiefe nicht.</b><br>'
        + 'Liegenschaftszins, Sachwertfaktor und Bodenrichtwert gehen nur in die '
        + '<b>Wertermittlung nach ImmoWertV</b> ein. Für eine Marktpreisindikation '
        + 'ändern sie nichts — du kannst sie leer lassen.';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mbq-vorhang-btn';
      btn.textContent = 'Trotzdem ausfüllen';
      btn.addEventListener('click', function () { _aufgeklappt[bid] = 1; vorhang(); });
      box.appendChild(p);
      box.appendChild(btn);
      blatt.insertBefore(box, blatt.firstChild);
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     TEIL 2 · „Wo bekomme ich das her?"
     ══════════════════════════════════════════════════════════════════════ */
  var _cache = {};
  var _letztePlz = null;

  function plzAus(text) {
    var m = String(text || '').match(/\b(\d{5})\b/);
    return m ? m[1] : null;
  }

  function wertText(w) {
    if (w.wert == null) {
      /* Kein Punktwert: der Ausschuss fuehrt eine Tabelle oder Formel.
         „liegt vor" ist hier die ehrliche Auskunft — eine Zahl waere
         erfunden. */
      return '<span class="w">liegt vor</span>';
    }
    var v = String(w.wert).replace('.', ',');
    if (w.liefert === 'prozent') v += ' %';
    return '<span class="w">' + esc(v) + '</span>';
  }

  function zeichnen(q) {
    var blatt = $('mbw-b7');
    if (!blatt || !q) return;
    var alt = blatt.querySelector('.mbq');
    if (alt && alt.getAttribute('data-ags') === String(q.ags || '')) return;
    if (alt && alt.parentNode) alt.parentNode.removeChild(alt);

    var box = document.createElement('div');
    box.className = 'mbq';
    box.setAttribute('data-ags', String(q.ags || ''));

    var h = '<h4>Wo du diese Werte findest</h4>';
    if (q.ausschuss) {
      h += '<div class="mbq-amt">Zuständig für ' + esc(q.ort || q.gebiet || 'diesen Ort')
        + (q.bundesland ? ' (' + esc(q.bundesland) + ')' : '') + ':<br><b>'
        + esc(q.ausschuss) + '</b></div>';
    } else {
      h += '<div class="mbq-amt">Für diesen Ort ist bei uns kein Gutachterausschuss '
        + 'hinterlegt. Die Werte bekommst du beim örtlichen Gutachterausschuss '
        + 'oder im Grundstücksmarktbericht deines Kreises.</div>';
    }

    var hat = q.hinterlegt || [];
    var fehlt = q.fehlt || [];
    if (hat.length) {
      h += '<ul>';
      hat.forEach(function (x) {
        var werte = (x.werte || []).filter(function (w) { return w.zweig; });
        h += '<li><span class="k">' + esc(x.name) + '</span> — '
          + (werte.length
             ? werte.slice(0, 6).map(function (w) {
                 return esc(w.zweig) + ' ' + wertText(w);
               }).join(' · ')
             : '<span class="w">liegt vor</span>');
        if (x.berichtsjahr) h += '<br><span class="off">Grundstücksmarktdaten '
          + esc(x.berichtsjahr) + (x.fundstelle ? ', ' + esc(x.fundstelle) : '') + '</span>';
        if (x.quelle_url) h += ' <a href="' + esc(x.quelle_url)
          + '" target="_blank" rel="noopener">Quelle öffnen</a>';
        h += '</li>';
      });
      h += '</ul>';
      h += '<div class="mbq-fuss">Diese Werte holt der Bericht sich <b>selbst</b> — '
        + 'du musst sie hier nicht eintragen. Ein eigener Eintrag hat Vorrang, '
        + 'wenn du einen besseren hast.</div>';
    }

    if (fehlt.length) {
      h += '<div class="mbq-fuss">Nicht hinterlegt: '
        + fehlt.map(function (x) { return esc(x.name); }).join(', ')
        + '. Diese Werte stehen im Grundstücksmarktbericht des zuständigen '
        + 'Ausschusses — wenn er sie ableitet.</div>';
    }

    (q.portale || []).forEach(function (p) {
      h += '<div class="mbq-fuss"><span class="k">' + esc(p.fuer) + ':</span> '
        + '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">'
        + esc(p.name) + '</a>'
        + (p.hinweis ? '<br>' + esc(p.hinweis) : '') + '</div>';
    });

    var lz = hat.find ? hat.find(function (x) { return x.lizenz; }) : null;
    if (lz && lz.quellenvermerk) {
      h += '<div class="mbq-lz">' + esc(lz.quellenvermerk) + '</div>';
    }

    box.innerHTML = h;
    /* Hinter den Vorhang, falls einer da ist. */
    var v = blatt.querySelector('.mbq-vorhang');
    if (v && v.nextSibling) blatt.insertBefore(box, v.nextSibling);
    else if (v) blatt.appendChild(box);
    else blatt.insertBefore(box, blatt.firstChild);
  }

  function holen() {
    var el = $('address');
    if (!el) return;
    var plz = plzAus(el.value);
    if (!plz || plz === _letztePlz) return;
    _letztePlz = plz;
    if (_cache[plz]) { zeichnen(_cache[plz]); return; }
    var tok = null; try { tok = localStorage.getItem('ji_token'); } catch (e) {}
    fetch('/api/v1/marktbericht/quellen?plz=' + encodeURIComponent(plz),
          { headers: tok ? { Authorization: 'Bearer ' + tok } : {} })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        _cache[plz] = j;
        zeichnen(j);
      })
      .catch(function () { /* eine Auskunft, die ausfaellt, darf nichts kaputtmachen */ });
  }

  /* ── Nachführung ──────────────────────────────────────────────────────── */
  var _zeit = null;
  function bald() {
    if (_zeit) clearTimeout(_zeit);
    _zeit = setTimeout(function () {
      _zeit = null;
      try { vorhang(); holen(); } catch (e) {
        try { console.warn('[v1344] Quellen:', e.message); } catch (x) {}
      }
    }, 220);
  }

  function start() {
    if (!$('mbw-b7')) { setTimeout(start, 400); return; }
    stil();
    vorhang();
    holen();
    document.addEventListener('input', function (ev) {
      if (ev.target && ev.target.id === 'address') bald();
    }, true);
    document.addEventListener('change', bald, true);
    document.addEventListener('click', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('[data-mbst-ziel]')) bald();
    }, true);
    try {
      new MutationObserver(bald).observe(document.documentElement,
        { childList: true, subtree: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 600); });
  } else {
    setTimeout(start, 600);
  }

  window.DealPilotMbQuellen = {
    vorhang: vorhang, holen: holen,
    _stand: function () {
      var b = $('mbw-b7');
      return {
        stufe: gewaehlteStufe(),
        vorhang: !!(b && b.querySelector('.mbq-vorhang')),
        kasten: !!(b && b.querySelector('.mbq')),
        plz: _letztePlz,
        verborgen: b ? b.querySelectorAll('.mbq-weg').length : 0
      };
    }
  };
})();
