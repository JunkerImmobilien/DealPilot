/* eigennutzer-qc-demo.js · v5120ii6 · DEMO Eigennutzer-Modus im Quick-Check (Marcel 26.11.2026)
   „Kannst du das genau in unseren Quick-Check einbauen als Demo, wie das aussehen würde?“

   NUR DEMO, NUR STAGING:
   - aktiv nur, wenn der Host „staging“ oder „localhost“ enthält UND der Demo-Schalter gesetzt ist
     (URL ?eigennutzer=1 setzt localStorage dp_demo_eigennutzer=1, ?eigennutzer=0 löscht ihn).
     Auf Prod tut die Datei nichts, auch wenn sie dort ausgeliefert würde.
   - hängt sich nur an (DOM), ändert keine Rechnung des Quick-Checks und nicht das qcpm-Overlay (qc-bridge.js).
   - „Selbst nutzen“: Miet-Karte und Investoren-Score ausgeblendet, Netto-Einkommen dazu,
     Ergebnis aus eigennutzer-kern.js (Preis, Zustand, Lage, Leistbarkeit, ersparte Miete, Rate, Kaufen gegen Mieten).
   - Beim Speichern im Modus „Selbst nutzen“ merkt sich die Demo die Nutzung (localStorage dp_qc_nutzung_next),
     eigennutzer-app-demo.js setzt dann am neuen Objekt _nutzung = 'eigen'. */
(function () {
  'use strict';
  var HOST_OK = /staging|localhost|127\.0\.0\.1/.test(location.hostname);
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  try {
    var q = new URLSearchParams(location.search).get('eigennutzer');
    if (q === '1') lsSet('dp_demo_eigennutzer', '1');
    if (q === '0') lsSet('dp_demo_eigennutzer', null);
  } catch (e) {}
  if (!HOST_OK || lsGet('dp_demo_eigennutzer') !== '1') return;

  var MODUS_KEY = 'dp_qc_nutzung_demo';
  function $(id) { return document.getElementById(id); }
  function num(id) { var e = $(id); if (!e) return NaN; return parseFloat(String(e.value || '').replace(/\./g, '').replace(',', '.')); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var CSS = ''
    + '.eig-schalter{display:flex;gap:6px;margin:0 0 14px;padding:5px;border-radius:12px;background:#0f0f10;border:1px solid rgba(255,255,255,.08);width:max-content;max-width:100%}'
    + '.eig-schalter button{border:0;border-radius:9px;padding:9px 16px;font:600 13px Inter,system-ui,sans-serif;color:#cfc8b8;background:transparent;cursor:pointer}'
    + '.eig-schalter button.an{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#1a1408}'
    + '.eig-demo-tag{font:600 10px "JetBrains Mono",monospace;letter-spacing:.08em;color:#8a826f;margin:-6px 0 12px}'
    + 'body.eig-selbst .eig-weg{display:none!important}'
    + '.eig-erg{background:#0b0b0c;color:#ece6d6;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:18px;margin:0 0 16px}'
    + '.eig-kopf{display:flex;gap:18px;align-items:center;flex-wrap:wrap}'
    + '.eig-ring{width:96px;height:96px;flex:0 0 96px;position:relative}'
    + '.eig-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 30px "Space Grotesk",sans-serif;color:#fff}'
    + '.eig-titel{font:700 20px "Space Grotesk",sans-serif;margin:0}'
    + '.eig-sub{font:400 13px Inter,sans-serif;color:#b5ad9b;margin:4px 0 0}'
    + '.eig-gruppen{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}'
    + '.eig-g{background:#141416;border-radius:12px;padding:10px}'
    + '.eig-g span{display:block;font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;color:#9a927f;text-transform:uppercase}'
    + '.eig-g strong{font:700 22px "Space Grotesk",sans-serif;color:#fff}'
    + '.eig-bar{height:5px;border-radius:3px;background:#2a2a2d;margin:6px 0}.eig-bar i{display:block;height:100%;border-radius:3px}'
    + '.eig-g p{font:400 11.5px/1.35 Inter,sans-serif;color:#b5ad9b;margin:0}'
    + '.eig-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}'
    + '.eig-k{background:#141416;border-radius:12px;padding:10px}.eig-k span{font:600 10px "JetBrains Mono",monospace;color:#9a927f;letter-spacing:.06em;text-transform:uppercase}'
    + '.eig-k strong{display:block;font:700 18px "Space Grotesk",sans-serif;color:#fff;margin-top:2px}.eig-k small{font:400 11px Inter,sans-serif;color:#9a927f}'
    + '.eig-satz{font:600 14px Inter,sans-serif;margin:14px 0 6px;color:var(--wl-e8cc7a,#E8CC7A)}'
    + '.eig-chart{width:100%;max-width:620px;height:auto;display:block}'
    + '.eig-check{margin:12px 0 0;padding:0 0 0 18px;font:400 12.5px/1.5 Inter,sans-serif;color:#cfc8b8}'
    + '.eig-hinweis{font:400 11px Inter,sans-serif;color:#8a826f;margin:10px 0 0}'
    + '@media(max-width:640px){.eig-gruppen{grid-template-columns:repeat(2,minmax(0,1fr))}.eig-kpis{grid-template-columns:1fr 1fr}.eig-ring{width:80px;height:80px;flex-basis:80px}}';

  function farbe(s) { return s == null ? '#555' : s >= 70 ? '#3FA56C' : s >= 50 ? 'var(--wl-c9a84c,#C9A84C)' : '#B8625C'; }

  function chart(reihe, jahr) {
    var W = 560, H = 170, L = 8, R = 8, T = 10, B = 22;
    var max = 0, min = 0;
    reihe.forEach(function (p) { max = Math.max(max, p.kauf, p.mieten); min = Math.min(min, p.kauf, p.mieten); });
    var sx = function (t) { return L + t / 20 * (W - L - R); }, sy = function (v) { return T + (max - v) / ((max - min) || 1) * (H - T - B); };
    var pk = reihe.map(function (p) { return sx(p.t).toFixed(1) + ',' + sy(p.kauf).toFixed(1); }).join(' ');
    var pm = reihe.map(function (p) { return sx(p.t).toFixed(1) + ',' + sy(p.mieten).toFixed(1); }).join(' ');
    var s = '<svg class="eig-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Vermögen Kaufen gegen Mieten über 20 Jahre">';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="#333"/>';
    if (jahr) s += '<line x1="' + sx(jahr).toFixed(1) + '" x2="' + sx(jahr).toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="#777" stroke-dasharray="4 4"/><text x="' + (sx(jahr) + 4).toFixed(1) + '" y="' + (T + 10) + '" fill="#9a927f" font-size="11" font-family="Inter">Jahr ' + jahr + '</text>';
    s += '<polyline fill="none" style="stroke:var(--wl-c9a84c,#C9A84C)" stroke-width="2.5" points="' + pk + '"/>';
    s += '<polyline fill="none" stroke="#5B8DEF" stroke-width="2.5" points="' + pm + '"/>';
    [0, 5, 10, 15, 20].forEach(function (t) { s += '<text x="' + sx(t).toFixed(1) + '" y="' + (H - 6) + '" fill="#8a826f" font-size="11" font-family="Inter" text-anchor="middle">' + t + '</text>'; });
    s += '</svg><div class="eig-hinweis"><span style="color:var(--wl-c9a84c,#C9A84C)">●</span> Kaufen (Wert minus Restschuld) &nbsp; <span style="color:#5B8DEF">●</span> Mieten und das Geld anlegen &nbsp; · Jahre</div>';
    return s;
  }

  function render(host, e, r) {
    var ring = 2 * Math.PI * 40, off = ring * (1 - r.gesamt / 100);
    var h = '<div class="eig-kopf"><div class="eig-ring"><svg viewBox="0 0 96 96" width="100%" height="100%"><circle cx="48" cy="48" r="40" fill="none" stroke="#222" stroke-width="8"/>'
      + '<circle cx="48" cy="48" r="40" fill="none" stroke="' + farbe(r.gesamt) + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + ring.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 48 48)"/></svg><b>' + r.gesamt + '</b></div>'
      + '<div><p class="eig-titel">Ist das Haus gut? ' + esc(r.stufe.wort) + '</p><p class="eig-sub">Eigennutzer-Score aus Preis, Zustand, Lage und Leistbarkeit. Beispielrechnung.</p></div></div>';
    h += '<div class="eig-gruppen">' + r.gruppen.map(function (g) {
      return '<div class="eig-g"><span>' + g.k + '</span><strong>' + (g.s == null ? '–' : g.s) + '</strong><div class="eig-bar"><i style="width:' + (g.s || 0) + '%;background:' + farbe(g.s) + '"></i></div><p>' + esc(g.t) + '</p></div>';
    }).join('') + '</div>';
    h += '<div class="eig-kpis">'
      + '<div class="eig-k"><span>Ersparte Miete</span><strong>' + DpEigennutzerKern.eur(r.miete) + '</strong><small>' + esc(r.quelle) + ', Mittelwert</small></div>'
      + '<div class="eig-k"><span>Rate im Monat</span><strong>' + DpEigennutzerKern.eur(r.rate) + '</strong><small>' + r.zins.toFixed(2).replace('.', ',') + ' % Zins, 2 % Tilgung</small></div>'
      + '<div class="eig-k"><span>Wohnkosten</span><strong>' + (r.quote == null ? '–' : Math.round(r.quote) + ' %') + '</strong><small>vom Netto-Einkommen</small></div></div>';
    h += '<p class="eig-satz">' + (r.jahr ? 'Kaufen ist nach ' + r.jahr + ' Jahren günstiger als mieten.' : 'In 20 Jahren wird Kaufen hier nicht günstiger als mieten.') + '</p>';
    h += chart(r.reihe, r.jahr);
    var z = r.gruppen[1].punkte || [];
    h += '<ul class="eig-check">' + z.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '<li>Energieausweis und Heizungsalter prüfen</li></ul>';
    h += '<p class="eig-hinweis">Demo. Annahmen: 10 % Kaufnebenkosten, Wert plus 1,5 % und Miete plus 2 % im Jahr, Anlagezins 3 %. Keine Gewähr, Entscheidungshilfe.</p>';
    host.innerHTML = h;
  }

  var lauf = 0;
  function rechnen() {
    var host = $('eig-erg'); if (!host || !document.body.classList.contains('eig-selbst')) return;
    var e = { kp: num('qc_kp'), wfl: num('qc_wfl'), bj: num('qc_bj'), ek: num('qc_ek') || 0, netto: num('eig_netto') || 0, plz: String(($('qc_plz') || {}).value || '').trim() };
    if (!(e.kp > 0 && e.wfl > 0 && e.bj > 1800)) { host.innerHTML = '<p class="eig-sub">Trag Kaufpreis, Wohnfläche und Baujahr ein, dann rechnen wir, ob das Haus zu dir passt.</p>'; return; }
    var id = ++lauf;
    DpEigennutzerKern.daten(e.plz || '33602', e.bj, e.wfl).then(function (d) { if (id !== lauf) return; render(host, e, DpEigennutzerKern.rechne(e, d)); });
  }
  var t = null; function bald() { clearTimeout(t); t = setTimeout(rechnen, 450); }

  function setzen(modus) {
    lsSet(MODUS_KEY, modus);
    document.body.classList.toggle('eig-selbst', modus === 'eigen');
    var bs = document.querySelectorAll('.eig-schalter button');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('an', bs[i].getAttribute('data-m') === modus);
    if (modus === 'eigen') rechnen();
  }

  function aufbau() {
    if ($('eig-schalter')) return;
    var st = document.createElement('style'); st.id = 'eig-demo-css'; st.textContent = CSS; document.head.appendChild(st);
    var sb = $('score-block'); if (!sb || !sb.parentNode) return;
    var wrap = document.createElement('div'); wrap.id = 'eig-schalter';
    wrap.innerHTML = '<div class="eig-schalter" role="tablist" aria-label="Wofür kaufst du?"><button type="button" data-m="vermieten">Zum Vermieten</button><button type="button" data-m="eigen">Selbst nutzen</button></div><div class="eig-demo-tag">DEMO · EIGENNUTZER-MODUS</div><div class="eig-erg" id="eig-erg" style="display:none"></div>';
    sb.parentNode.insertBefore(wrap, sb);
    sb.classList.add('eig-weg');
    var m = $('qc_nkm_grund'); var mk = m && m.closest('.card'); if (mk) mk.classList.add('eig-weg');
    var ek = $('qc_ek'); var fk = ek && ek.closest('.field');
    if (fk && !$('eig_netto')) {
      var f = document.createElement('div'); f.className = 'field eig-nur'; f.innerHTML = '<label for="eig_netto">Netto-Haushaltseinkommen (€/Monat, optional)</label><input type="text" id="eig_netto" inputmode="decimal" placeholder="5.200" autocomplete="off"><span class="hint">Für die Leistbarkeit. Wird nicht gespeichert.</span>';
      fk.parentNode.insertBefore(f, fk.nextSibling);
    }
    var css2 = document.createElement('style'); css2.textContent = 'body:not(.eig-selbst) .eig-nur{display:none!important} body.eig-selbst #eig-erg{display:block!important}'; document.head.appendChild(css2);
    wrap.addEventListener('click', function (ev) { var b = ev.target.closest('button[data-m]'); if (b) setzen(b.getAttribute('data-m')); });
    ['qc_kp', 'qc_wfl', 'qc_bj', 'qc_ek', 'qc_plz', 'eig_netto'].forEach(function (id) { var x = $(id); if (x) x.addEventListener('input', bald); });
    /* Speichern im Modus „Selbst nutzen“ merken (eigennutzer-app-demo.js liest es im Elternfenster) */
    document.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (/Speichern|übernehmen|Als Objekt/i.test(b.textContent || '') && document.body.classList.contains('eig-selbst')) lsSet('dp_qc_nutzung_next', 'eigen|' + Date.now());
    }, true);
    setzen(lsGet(MODUS_KEY) === 'eigen' ? 'eigen' : 'vermieten');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(aufbau, 300); });
  else setTimeout(aufbau, 300);
  window.DpEigQcDemo = { rechnen: rechnen, setzen: setzen };
})();
