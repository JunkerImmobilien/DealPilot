'use strict';
/* ═══════════════════════════════════════════════════════════════
   v1183 — Kontingent-Anzeige (vorher: Pilot-Tank / Kerosin)

   WAS SICH GEAENDERT HAT UND WARUM
   Bis v1182 zeigte die Kopfzeile einen Tank in Litern. Der Kunde musste
   selbst ausrechnen, wie viele Bewertungen darin stecken — und die Antwort
   haing davon ab, WELCHE Bewertung er zieht (2 L, 5 L oder 12 L). Marcels
   Ansage: „nichts mehr mit Kerosin oder Liter."

   Jetzt zeigt die Pille direkt, was der Nutzer noch machen kann, in der
   Schreibweise, die die Pakete ohnehin benutzen: 5 · 5 · 5.
   Beim Ueberfahren klappt auf, welche Zahl zu welcher Bewertung gehoert.

   DIE DATEN KOMMEN AUS /ai/credits UND HABEN SEIT v1183 EINE ANDERE FORM:
     { plan, arten: { mpi:{limit,used,monatlich,bank,rest}, mpi_plus, wev },
       avm: {a,b}, sparfaktor, period_reset_at }
   `total_remaining`, `monthly_limit` und `bonus_credits` gibt es NICHT mehr.
   Wer sie liest, bekommt undefined — und `undefined < 1` ist false, eine
   Sperre daraus wuerde also lautlos nie greifen. Deshalb pruefen alle
   Zugriffe hier auf Abwesenheit, bevor gerechnet wird.
═══════════════════════════════════════════════════════════════ */
(function(){
  var _cache = null;
  var _lastFetch = 0;
  var CACHE_TTL = 60000;  // 1 Minute Cache

  /* Eine Quelle fuer Reihenfolge und Beschriftung. Steht sie zweimal im
     Haus, driftet sie auseinander — das ist im Marktbericht dreimal
     passiert (v1126d, v1152, v1154). */
  var ARTEN = [
    { key: 'mpi',      kurz: 'MPI',  name: 'Marktpreisindikation' },
    { key: 'mpi_plus', kurz: 'MPI+', name: 'Erweiterte Marktpreisindikation' },
    { key: 'wev',      kurz: 'WEV',  name: 'Wertermittlung nach ImmoWertV' }
  ];

  function _apiBase() {
    var m = document.querySelector('meta[name="ji-api-base"]');
    return m ? m.content : '';
  }

  function _token() {
    return localStorage.getItem('ji_token') || '';
  }

  /* Rest einer Art, ohne je NaN zu liefern. `Number(null)` ist 0 und
     besteht Number.isFinite — deshalb erst auf Abwesenheit pruefen. */
  function _rest(s, key) {
    if (!s || !s.arten || !s.arten[key]) return 0;
    var v = s.arten[key].rest;
    return (v == null) ? 0 : v;
  }

  function _gesamt(s) {
    return ARTEN.reduce(function (n, a) { return n + _rest(s, a.key); }, 0);
  }

  async function refresh(force) {
    if (!force && _cache && (Date.now() - _lastFetch) < CACHE_TTL) {
      return _cache;
    }
    var t = _token();
    if (!t) { _cache = null; render(null); return null; }
    try {
      var resp = await fetch(_apiBase() + '/ai/credits', {
        headers: { 'Authorization': 'Bearer ' + t }
      });
      if (!resp.ok) { _cache = null; render(null); return null; }
      _cache = await resp.json();
      _lastFetch = Date.now();
      render(_cache);
      return _cache;
    } catch (e) {
      _cache = null; render(null);
      return null;
    }
  }

  function getStatus() { return _cache; }

  /* ── Das Aufklapp-Panel ────────────────────────────────────────────────
     Ein `title`-Attribut kann keine Tabelle. Marcel wollte beim Ueberfahren
     sehen, „wie viele der Bewertungen von den dreien man noch machen kann" —
     das sind drei Zeilen mit je zwei Zahlen, dafuer reicht ein Tooltip des
     Browsers nicht.

     Das CSS wird hier injiziert und nicht in style.css gelegt: die Datei
     hat 36.929 Zeilen und 4.198 !important, eine neue Regel dort ist ein
     Kaskaden-Risiko ohne Gegenwert. promo-erstflug.js macht es genauso.

     Gold steht als var(--wl-<hex>, #<hex>) — Whitelabel-Pflicht. */
  function _css() {
    if (document.getElementById('dp-kontingent-css')) return;
    var st = document.createElement('style');
    st.id = 'dp-kontingent-css';
    st.textContent = [
      '.dp-kg-pill{position:relative;cursor:default}',
      '.dp-kg-panel{position:absolute;top:calc(100% + 8px);right:0;z-index:9999;',
      '  min-width:270px;padding:12px 14px;border-radius:10px;',
      '  background:#141210;border:1px solid var(--wl-C9A84C, #C9A84C);',
      '  box-shadow:0 12px 32px rgba(0,0,0,.55);',
      '  opacity:0;visibility:hidden;transform:translateY(-4px);',
      '  transition:opacity .14s ease,transform .14s ease,visibility .14s;',
      '  font-family:Inter,system-ui,sans-serif;text-align:left;pointer-events:none}',
      '.dp-kg-pill:hover .dp-kg-panel,.dp-kg-pill:focus-within .dp-kg-panel{',
      '  opacity:1;visibility:visible;transform:translateY(0)}',
      '.dp-kg-h{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:9.5px;',
      '  letter-spacing:.14em;text-transform:uppercase;color:var(--wl-C9A84C, #C9A84C);',
      '  margin:0 0 8px}',
      '.dp-kg-r{display:flex;align-items:baseline;gap:10px;padding:4px 0;',
      '  border-top:1px solid rgba(255,255,255,.07)}',
      '.dp-kg-r:first-of-type{border-top:0}',
      '.dp-kg-n{flex:1 1 auto;min-width:0;font-size:12px;color:#EDE9E3;line-height:1.3}',
      '.dp-kg-v{flex:0 0 auto;font-family:"JetBrains Mono",ui-monospace,monospace;',
      '  font-size:14px;font-weight:600;color:#FDFCFA}',
      '.dp-kg-v.leer{color:#B8625C}',
      '.dp-kg-s{flex:0 0 auto;font-size:10px;color:#8C857B;min-width:56px;text-align:right}',
      '.dp-kg-f{margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.07);',
      '  font-size:10.5px;color:#8C857B;line-height:1.45}',
      '.dp-kg-pill .dp-kg-label{font-family:"JetBrains Mono",ui-monospace,monospace;',
      '  font-size:12px;letter-spacing:.04em}'
    ].join('');
    document.head.appendChild(st);
  }

  function _panelHtml(s) {
    var zeilen = ARTEN.map(function (a) {
      var k = (s.arten && s.arten[a.key]) || {};
      var rest = _rest(s, a.key);
      var gespart = k.bank || 0;
      var sub = (k.limit ? (k.limit + '/Monat') : 'nicht im Plan');
      if (gespart > 0) sub = '+' + gespart + ' gespart';
      return '<div class="dp-kg-r">' +
               '<span class="dp-kg-n">' + a.name + '</span>' +
               '<span class="dp-kg-s">' + sub + '</span>' +
               '<span class="dp-kg-v' + (rest === 0 ? ' leer' : '') + '">' + rest + '</span>' +
             '</div>';
    }).join('');

    var avm = (s.avm && ((s.avm.a || 0) + (s.avm.b || 0))) || 0;
    if (avm > 0) {
      zeilen += '<div class="dp-kg-r">' +
                  '<span class="dp-kg-n">Marktwert-Abrufe</span>' +
                  '<span class="dp-kg-s">zugekauft</span>' +
                  '<span class="dp-kg-v">' + avm + '</span>' +
                '</div>';
    }

    var fuss = 'Zuruecksetzung am ' + (s.period_reset_at || '1. des Monats') + '. ' +
               'Nicht genutzte Bewertungen verfallen nicht.';

    return '<div class="dp-kg-panel" role="tooltip">' +
             '<p class="dp-kg-h">Dein Kontingent</p>' +
             zeilen +
             '<div class="dp-kg-f">' + fuss + '</div>' +
           '</div>';
  }

  /* v1183: die Pille in der Kopfzeile. Kein Tank, kein Fuellbalken —
     drei Zahlen in derselben Schreibweise wie die Pakete (5 · 5 · 5). */
  function render(s) {
    var pill = document.getElementById('hdr-credits-pill');
    if (!pill) return;
    if (!s || !s.arten) { pill.style.display = 'none'; return; }
    _css();

    var label = document.getElementById('hdr-credits-pill-label');
    var gesamt = _gesamt(s);

    pill.style.display = 'inline-flex';
    pill.classList.add('fuel-pill', 'dp-kg-pill');
    pill.classList.remove('low', 'empty');
    if (gesamt === 0) pill.classList.add('empty');
    else if (gesamt <= 2) pill.classList.add('low');

    if (label) {
      label.className = (label.className || '') + ' dp-kg-label';
      label.textContent = ARTEN.map(function (a) { return _rest(s, a.key); }).join(' · ');
    }

    /* Der alte Fuellbalken ist Tank-Bildsprache und faellt weg. Vorhandenes
       Markup aus einer frueheren Fassung wird entfernt, nicht nur versteckt
       — sonst bleibt ein leerer Balken zwischen den Zahlen stehen. */
    var bar = document.getElementById('hdr-credits-pill-bar');
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);

    var alt = pill.querySelector('.dp-kg-panel');
    if (alt) alt.parentNode.removeChild(alt);
    pill.insertAdjacentHTML('beforeend', _panelHtml(s));

    /* Der Browser-Tooltip bleibt als Rueckfall fuer Touch und Screenreader,
       wo :hover nicht greift. */
    pill.title = 'Dein Kontingent\n' + ARTEN.map(function (a) {
      return '  ' + a.name + ': ' + _rest(s, a.key);
    }).join('\n') + '\nZuruecksetzung am ' + (s.period_reset_at || '1. des Monats');
  }

  // Render der Kontingent-Box im Einstellungen-Reiter „Plan"
  function renderSettingsBox(host) {
    if (!host) return;
    var s = _cache;
    if (!s || !s.arten) {
      host.innerHTML = '<div class="hint">Kontingent wird geladen…</div>';
      /* v840: Cache leer -> selbst refresh() ausloesen. Vorher hing die Box,
         bis refresh() zufaellig woanders lief. */
      try {
        if (typeof refresh === 'function' && !host._v840Loading) {
          host._v840Loading = true;
          refresh(false).then(function(fresh) {
            host._v840Loading = false;
            if (fresh) { try { renderSettingsBox(host); } catch(e){} }
            else { host.innerHTML = '<div class="hint">Kontingent nicht verfuegbar.</div>'; }
          }).catch(function(){ host._v840Loading = false; });
        }
      } catch(e) {}
      return;
    }

    var zellen = ARTEN.map(function (a) {
      var k = (s.arten && s.arten[a.key]) || {};
      var rest = _rest(s, a.key);
      var sub;
      if (!k.limit) sub = (k.bank ? 'nur zugekauft' : 'nicht in deinem Plan');
      else if (k.bank) sub = k.limit + ' im Monat · ' + k.bank + ' gespart';
      else sub = k.limit + ' im Monat';
      return '<div class="ai-credits-cell">' +
               '<div class="ai-credits-label">' + a.kurz + '</div>' +
               '<div class="ai-credits-value' + (rest === 0 ? ' rd' : ' gn') + '">' + rest + '</div>' +
               '<div class="ai-credits-sub">' + sub + '</div>' +
             '</div>';
    }).join('');

    var avmA = (s.avm && s.avm.a) || 0;
    var avmB = (s.avm && s.avm.b) || 0;
    zellen += '<div class="ai-credits-cell">' +
                '<div class="ai-credits-label">Marktwert</div>' +
                '<div class="ai-credits-value gold">' + (avmA + avmB) + '</div>' +
                '<div class="ai-credits-sub">zugekaufte Abrufe</div>' +
              '</div>';

    var resetDate = s.period_reset_at || '—';
    host.innerHTML = '' +
      '<div class="ai-credits-box">' +
        '<div class="ai-credits-row">' + zellen + '</div>' +
        '<div class="hint">Was du in einem Monat nicht nutzt, verfaellt nicht — es wandert ins Guthaben, ' +
          'bis zum Dreifachen deines Monatskontingents. Zugekaufte Bewertungen verfallen nie.</div>' +
        '<div class="ai-credits-meta">' +
          '<span>Zuruecksetzung am ' + resetDate + ' (1. des Monats, 00:00 UTC)</span>' +
          '<button class="btn btn-outline btn-sm" type="button" onclick="if(typeof showSettings===\'function\')showSettings(\'plan\');">Bewertungen nachkaufen</button>' +
        '</div>' +
      '</div>';
  }

  function _buyClick() {
    if (typeof window.CreditsModal === 'object' && typeof window.CreditsModal.open === 'function') {
      window.CreditsModal.open();
      return;
    }
    if (typeof toast === 'function') toast('Nachkauf konnte nicht geladen werden. Bitte Seite neu laden.');
  }

  /* Demo-Gutschrift (nur Testkonten). Gutgeschrieben werden seit v1183
     Marktpreisindikationen, keine Liter. */
  async function _purchase(amount, btn) {
    if (!btn) return;
    var orig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Wird gutgeschrieben…';
    try {
      var t = _token();
      if (!t) throw new Error('Nicht eingeloggt');
      var resp = await fetch(_apiBase() + '/ai/credits/demo-purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + t
        },
        body: JSON.stringify({ amount: amount })
      });
      var data = null;
      try { data = await resp.json(); } catch(e) { data = {}; }
      if (!resp.ok) throw new Error(data.error || ('HTTP ' + resp.status));
      if (typeof toast === 'function') {
        toast('✓ ' + amount + ' Marktpreisindikationen gutgeschrieben (Demo)');
      }
      _cache = data.status || null;
      _lastFetch = Date.now();
      render(_cache);
      var modal = document.getElementById('credit-buy-modal');
      if (modal) modal.remove();
      var box = document.getElementById('set-ai-credits-host');
      if (box) renderSettingsBox(box);
    } catch (e) {
      btn.disabled = false;
      btn.innerHTML = orig;
      if (typeof toast === 'function') toast('✗ Fehler: ' + e.message);
      else alert('Fehler: ' + e.message);
    }
  }

  /* Die separate Marktwert-Pille ist seit v489 weg; die No-Ops bleiben,
     weil object-actions.js sie nach Live-Abrufen weiter aufruft. */
  function renderAvm() {
    var avm = document.getElementById('hdr-avm-pill');
    if (avm) avm.style.display = 'none';
  }

  async function refreshAvm() {
    renderAvm();
    try { refresh(true); } catch (e) {}
  }

  window.AiCredits = {
    refresh: refresh,
    getStatus: getStatus,
    render: render,
    renderSettingsBox: renderSettingsBox,
    ARTEN: ARTEN,
    _buyClick: _buyClick,
    _purchase: _purchase,
    refreshAvm: refreshAvm
  };

  // Auto-Refresh beim Laden + nach Login
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){ refresh(true); }, 500);
    setTimeout(function(){ renderAvm(); }, 700);
  });
  document.addEventListener('click', function(e){
    var t = e.target.closest && e.target.closest('[data-st-tab="ai"]');
    if (t) setTimeout(function(){ refresh(true); }, 100);
  });
})();
