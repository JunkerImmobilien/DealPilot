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
      /* v1348: das Ausblenden ganzer Reiter macht jetzt mb-wizard.js
         (.mbw-spaeter, display:none). Zwei Mechaniken für dieselbe Sache
         waren genau das, was uneinheitlich aussah — hier stand vorher ein
         gedimmter Reiter mit Anhängsel „· ab Stufe 3", während der Wizard
         ihn ganz entfernte. Der Vorhang unten bleibt: er greift, wenn der
         Reiter trotz niedriger Tiefe sichtbar ist, weil schon etwas darin
         ausgefüllt wurde. */
      ''
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
        /* v1348: der Reiter selbst wird nicht mehr von hier angefasst -
           das macht mb-wizard.js. Zwei Haende an derselben Klasse sind
           genau die Uneinheitlichkeit, die aufgefallen ist. */
      }

      /* Die Inhalte verbergen, NICHT entfernen — Eingaben bleiben. */
      Array.prototype.forEach.call(blatt.children, function (kind) {
        /* v1344c: Vorhang UND Quellen-Kasten bleiben sichtbar. Der
           Kasten sagt gerade dann etwas Nuetzliches, wenn die Felder
           zu sind: er nennt den zustaendigen Ausschuss und was dort
           schon hinterlegt ist. Ihn mitzuverbergen waere genau
           verkehrt herum. */
        if (kind.classList && (kind.classList.contains('mbq-vorhang')
                            || kind.classList.contains('mbq'))) return;
        if (zuViel) kind.classList.add('mbq-weg');
        else kind.classList.remove('mbq-weg');
      });

      var alt = blatt.querySelector('.mbq-vorhang');
      if (!zuViel) { if (alt && alt.parentNode) alt.parentNode.removeChild(alt); return; }
      if (alt) return;

      var box = document.createElement('div');
      box.className = 'mbq-vorhang mb-zurueck';
      var p = document.createElement('div');
      p.innerHTML = '<b>Diese Angaben brauchst du für die gewählte Tiefe nicht.</b><br>'
        + 'Liegenschaftszins, Sachwertfaktor und Bodenrichtwert gehen nur in die '
        + '<b>Wertermittlung nach ImmoWertV</b> ein. Für eine Marktpreisindikation '
        + 'ändern sie nichts — du kannst sie leer lassen.';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mbq-vorhang-btn mb-auf';
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
        /* v1344d: Nicht doppelt betiteln. Manche Fundstellen tragen den
           Berichtsnamen schon - dann stand da "Grundstuecksmarktdaten
           2024, 'Grundstuecksmarktdaten 2025', Kapitel ...", zwei
           Jahreszahlen, die sich widersprechen. Die Fundstelle gewinnt:
           sie ist genauer. */
        var _q = String(x.fundstelle || '');
        var _hatTitel = /Grundst.{0,3}cksmarkt|Immobilienmarkt|Marktbericht/i.test(_q);
        if (_q || x.berichtsjahr) {
          h += '<br><span class="off">'
            + (_hatTitel
               ? esc(_q)
               : (x.berichtsjahr ? 'Grundstücksmarktdaten ' + esc(x.berichtsjahr) : '')
                 + (_q ? (x.berichtsjahr ? ', ' : '') + esc(_q) : ''))
            + '</span>';
        }
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
  /* === v1344b - DIE LISTENER ZUERST, DER ERSTE LAUF DANACH ===========
     Gemessen: der Vorhang entstand beim Klick auf eine Stufe NIE, obwohl
     ein Aufruf von Hand ihn sofort baute. Ursache war die Reihenfolge in
     `start()`:

       stil();
       vorhang();      <- wirft hier etwas,
       holen();
       document.addEventListener(...)   <- kommt das nie

     Ein erster Lauf, der scheitert, nahm die ganze Nachfuehrung mit. Und
     weil `bald()` seine Ausnahmen selbst schluckt, war danach still.
     Dasselbe Muster wie v1330: der Rueckruf am Ende einer ungeschuetzten
     Schleife.

     Jetzt haengen die Listener ZUERST. Danach darf der erste Lauf ruhig
     scheitern - der naechste Klick holt es nach.

     Dazu eine OBERGRENZE fuer die Entprellung: bei einem Dauerstrom von
     DOM-Aenderungen setzt reines Entprellen den Timer endlos zurueck und
     feuert nie. Spaetestens nach 900 ms wird ausgefuehrt. */
  var _zeit = null, _erstesMal = 0;
  function bald() {
    var jetzt = Date.now();
    if (!_erstesMal) _erstesMal = jetzt;
    if (jetzt - _erstesMal > 900) {   /* Obergrenze erreicht: sofort */
      if (_zeit) { clearTimeout(_zeit); _zeit = null; }
      _erstesMal = 0;
      lauf();
      return;
    }
    if (_zeit) clearTimeout(_zeit);
    _zeit = setTimeout(function () { _zeit = null; _erstesMal = 0; lauf(); }, 220);
  }

  function lauf() {
    try { vorhang(); } catch (e) {
      try { console.warn('[v1344] Vorhang:', e.message); } catch (x) {}
    }
    try { holen(); } catch (e) {
      try { console.warn('[v1344] Quellen:', e.message); } catch (x) {}
    }
  }

  function start() {
    if (!$('mbw-b7')) { setTimeout(start, 400); return; }
    if (window.__mbqGestartet) return;
    window.__mbqGestartet = 1;

    /* ZUERST die Nachfuehrung. Sie ueberlebt jeden Fehler im ersten Lauf. */
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

    try { stil(); } catch (e) {}
    lauf();
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
