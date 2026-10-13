'use strict';
/* v2206 · N63.5 · Einstellungen → Standardwerte als Karten (Variante A)
   ─────────────────────────────────────────────────────────────────────
   Marcel, 13.10.2026: „Standardwerte … unübersichtlich. Kann man da nicht
   mit so Standardkarten arbeiten, dass man nicht so viel runterscrollen
   muss … dass man auch ein Standardset nehmen kann." Aus der Demo
   (design/Vorschläge/standardwerte-karten-demo.html) gewählt: A ·
   Karten-Übersicht, mit drei Sets wie in der Demo.

   BAUART: Das Formular bleibt, wie es ist (investment-profile.js baut es,
   settings.js speichert es über „Speichern"). Dieses Modul legt nur eine
   Ebene DARÜBER: jeder Abschnitt (h3.ip-section + alles bis zur nächsten
   Überschrift) wird in einen .swk-teil verschoben — verschobene Knoten
   behalten ihre Verdrahtung —, oben stehen Sets und Karten. „Anpassen"
   zeigt genau einen Teil, „‹ Alle Karten" führt zurück. Fällt dieses
   Modul aus, steht das Formular wie vorher da.

   Die Sets setzen nur Feldwerte (input/change), gespeichert wird wie
   immer mit „Speichern". */
(function () {
  if (window.DpStandardKarten) return;

  var SETS = [
    { id: 'dp',  name: 'DealPilot-Standard', txt: 'Die heutigen Vorbelegungen.',
      werte: { ip_tilgung_default: '1.5', ip_ek_quote_default: '10', ip_mietausfall_pct: '1', ip_min_dscr: '1.2' } },
    { id: 'vor', name: 'Vorsichtig', txt: 'Mehr Puffer, strengere Grenzen.',
      werte: { ip_tilgung_default: '2', ip_ek_quote_default: '20', ip_mietausfall_pct: '3', ip_min_dscr: '1.3' } },
    { id: 'ren', name: 'Renditeorientiert', txt: 'Mehr Hebel, weniger Puffer.',
      werte: { ip_tilgung_default: '1', ip_ek_quote_default: '5', ip_mietausfall_pct: '1', ip_min_dscr: '1.1' } }
  ];
  var SET_ZEILEN = [['ip_tilgung_default', 'Tilgung', ' %'], ['ip_ek_quote_default', 'Eigenkapital', ' %'],
                    ['ip_mietausfall_pct', 'Mietausfall', ' %'], ['ip_min_dscr', 'Min-DSCR', '']];

  /* Je Abschnitt: Symbol, Kurztext und welche Felder die Karte zeigt.
     Zuordnung über den Überschrift-Text (Anfang), nicht über die Position. */
  var KARTEN = [
    { an: 'Finanzierung', ic: '🏦', txt: 'Startwerte für Darlehen und Eigenkapital.',
      felder: [['ip_tilgung_default', 'Tilgung', ' %'], ['ip_zinsbindung_default', 'Zinsbindung', ''], ['ip_zins_override', 'Marktzins', ' %'], ['ip_ek_quote_default', 'Eigenkapital', ' % v. KP']] },
    { an: 'Bewirtschaftung je', ic: '🏠', txt: 'Verwaltung und Instandhaltung für ETW, EFH, MFH.',
      felder: [['bwkp_etw_hg_qm', 'ETW Hausgeld', ' €/m²'], ['bwkp_efh_verw', 'EFH Verwaltung', ' €'], ['bwkp_mfh_inst_qm', 'MFH Instandh.', ' €/m²'], ['bwkp_faktor', 'Faktor', '']] },
    { an: 'Bewirtschaftung', ic: '🧾', txt: 'Kostenanteile, wenn nichts Eigenes eingegeben ist.',
      felder: [['ip_bwk_ul_pct_default', 'umlagefähig', ' %'], ['ip_bwk_anteil_default', 'nicht umlagefähig', ' %'], ['ip_mietausfall_pct', 'Mietausfall', ' %']] },
    { an: 'Lageklassen', ic: '📍', txt: 'Zielrendite brutto je Lage — der Maßstab der Ampel.', lage: true },
    { an: 'Persönliche Mindest', ic: '🛡️', txt: 'Deine persönlichen Kaufgrenzen.',
      felder: [['ip_min_dscr', 'DSCR', ''], ['ip_min_cashflow_vor_st', 'Cashflow', ' €/Monat'], ['ip_max_ltv', 'max. LTV', ' %']] },
    { an: 'Steuer', ic: '📑', txt: 'Dein Grenzsteuersatz für die Steuerwirkung.',
      felder: [['ip_grenzsteuersatz', 'Grenzsteuersatz', ' %']] },
    { an: 'Standort', ic: '🧭', txt: 'Bundesland und Kaufnebenkosten.',
      felder: [['ip_bundesland', 'Bundesland', ''], ['ip_notar_grundbuch', 'Notar/Grundbuch', ' %'], ['ip_maklerkosten', 'Makler', ' %']] }
  ];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function zahl(v) { return String(v).replace('.', ','); }
  function wert(id, einheit) {
    var e = document.getElementById(id); if (!e) return null;
    if (e.tagName === 'SELECT') { var o = e.selectedOptions && e.selectedOptions[0]; return o ? o.text.replace(/\s*\(.*$/, '') : '—'; }
    var v = String(e.value || '').trim();
    if (!v) return '—';
    return zahl(v) + (einheit || '');
  }
  function karteFuer(titel) {
    for (var i = 0; i < KARTEN.length; i++) if (titel.indexOf(KARTEN[i].an) === 0) return KARTEN[i];
    return null;
  }

  function css() {
    if (document.getElementById('swk-css')) return;
    var st = document.createElement('style'); st.id = 'swk-css';
    st.textContent = [
      '#settings-modal .swk-sets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:4px 0 16px}',
      '#settings-modal .swk-set{border:1px solid #e6e1d6;background:#fff;border-radius:12px;padding:12px;cursor:pointer;text-align:left;font:inherit;color:#1a1714;position:relative}',
      '#settings-modal .swk-set.an{border:1.5px solid var(--wl-c9a84c,#C9A84C);background:#FBF6E9}',
      '#settings-modal .swk-set.an::after{content:"✓ aktiv";position:absolute;top:10px;right:12px;font:600 11px Inter,sans-serif;color:#8a6d1f}',
      '#settings-modal .swk-set b{display:block;font:600 14px "Space Grotesk",sans-serif}',
      '#settings-modal .swk-set p{margin:3px 0 8px;color:#625c59;font-size:12px}',
      '#settings-modal .swk-set ul{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;font-size:12px}',
      '#settings-modal .swk-set li span{color:#625c59}',
      '#settings-modal .swk-hinweis{font-size:12px;color:#625c59;margin:-8px 0 14px}',
      '#settings-modal .swk-karten{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}',
      '#settings-modal .swk-karte{background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px}',
      '#settings-modal .swk-karte h4{margin:0;font:600 15px "Space Grotesk",sans-serif;display:flex;align-items:center;gap:8px;color:#1a1714}',
      '#settings-modal .swk-ic{width:26px;height:26px;border-radius:7px;background:#FBF6E9;border:1px solid color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 40%,transparent);display:inline-flex;align-items:center;justify-content:center;font-size:14px;flex:0 0 auto}',
      '#settings-modal .swk-karte p{margin:0;color:#625c59;font-size:12px}',
      '#settings-modal .swk-werte{display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:13px;border-top:1px dashed #e6e1d6;padding-top:8px;margin-top:auto}',
      '#settings-modal .swk-werte span{color:#625c59}#settings-modal .swk-werte b{font-weight:600;text-align:right;color:#1a1714}',
      '#settings-modal .swk-anpassen{align-self:flex-start;border:1px solid #1a1714;background:#fff;border-radius:8px;padding:7px 12px;font:600 12px Inter,sans-serif;cursor:pointer;color:#1a1714;min-height:36px}',
      '#settings-modal .swk-zurueck{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:6px 0;margin:0 0 6px;font:600 13px Inter,sans-serif;color:#1a1714;cursor:pointer;min-height:40px}',
      '#settings-modal .swk-zurueck i{font-style:normal;font-size:20px;color:#8a6d1f}',
      '#settings-modal [data-swk="karten"] .swk-teil{display:none}',
      '#settings-modal [data-swk="teil"] .swk-oben{display:none}',
      '#settings-modal [data-swk="teil"] .swk-teil{display:none}',
      '#settings-modal [data-swk="teil"] .swk-teil.offen{display:block}',
      '@media (max-width:640px){#settings-modal .swk-sets{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function aufbauen(host) {
    if (!host || host.getAttribute('data-swk')) return;
    var kinder = [].slice.call(host.children);
    if (!kinder.some(function (k) { return k.matches && k.matches('h3.ip-section'); })) return;
    css();
    /* 1 · Abschnitte einsammeln */
    var teile = [], akt = null, vorne = [];
    kinder.forEach(function (k) {
      if (k.matches('h3.ip-section')) { akt = { titel: k.textContent.trim(), knoten: [k] }; teile.push(akt); }
      else if (akt) akt.knoten.push(k);
      else vorne.push(k);
    });
    var oben = document.createElement('div'); oben.className = 'swk-oben';
    var karten = document.createElement('div'); karten.className = 'swk-karten';
    teile.forEach(function (t, i) {
      var w = document.createElement('div'); w.className = 'swk-teil'; w.setAttribute('data-teil', String(i));
      var z = document.createElement('button'); z.type = 'button'; z.className = 'swk-zurueck';
      z.innerHTML = '<i>‹</i>Alle Karten';
      z.addEventListener('click', function () { zurueck(host); });
      w.appendChild(z);
      t.knoten.forEach(function (n) { w.appendChild(n); });
      host.appendChild(w);
      t.el = w;
    });
    /* 2 · Sets */
    var sets = document.createElement('div'); sets.className = 'swk-sets';
    SETS.forEach(function (st) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'swk-set'; b.setAttribute('data-set', st.id);
      b.innerHTML = '<b>' + esc(st.name) + '</b><p>' + esc(st.txt) + '</p><ul>' + SET_ZEILEN.map(function (z) {
        return '<li><span>' + esc(z[1]) + '</span> ' + esc(zahl(st.werte[z[0]]) + z[2]) + '</li>'; }).join('') + '</ul>';
      b.addEventListener('click', function () { setAnwenden(host, st); });
      sets.appendChild(b);
    });
    var hin = document.createElement('p'); hin.className = 'swk-hinweis';
    hin.textContent = 'Ein Set setzt Tilgung, Eigenkapital, Mietausfall und Mindest-DSCR. Alles andere passt du in den Karten an. Übernommen wird mit „Speichern“ unten.';
    oben.appendChild(sets); oben.appendChild(hin); oben.appendChild(karten);
    host.insertBefore(oben, teile[0] ? teile[0].el : null);
    host._swkTeile = teile; host._swkKarten = karten;
    karteneZeichnen(host);
    setMarkieren(host);
    host.setAttribute('data-swk', 'karten');
    /* Werte der Karten folgen den Feldern */
    host.addEventListener('input', function () { if (host.getAttribute('data-swk') === 'karten') return; host._swkDirty = 1; });
  }

  function karteneZeichnen(host) {
    var karten = host._swkKarten, teile = host._swkTeile || [];
    karten.innerHTML = '';
    teile.forEach(function (t, i) {
      var k = karteFuer(t.titel) || { ic: '⚙️', txt: '', felder: [] };
      var zeilen = '';
      if (k.lage) {
        var box = t.el.querySelector('.ip-lage-box');
        [].slice.call(box ? box.children : []).forEach(function (row) {
          var inp = row.querySelector('input'); var n = (row.textContent || '').trim().match(/^[A-D]-Lage/);
          if (inp && n) zeilen += '<span>' + esc(n[0]) + '</span><b>' + esc(inp.value ? zahl(inp.value) + ' %' : '—') + '</b>';
        });
      } else {
        (k.felder || []).forEach(function (f) { var v = wert(f[0], f[2]); if (v != null) zeilen += '<span>' + esc(f[1]) + '</span><b>' + esc(v) + '</b>'; });
      }
      var c = document.createElement('div'); c.className = 'swk-karte';
      c.innerHTML = '<h4><span class="swk-ic">' + k.ic + '</span>' + esc(t.titel) + '</h4>'
        + (k.txt ? '<p>' + esc(k.txt) + '</p>' : '')
        + (zeilen ? '<div class="swk-werte">' + zeilen + '</div>' : '');
      var b = document.createElement('button'); b.type = 'button'; b.className = 'swk-anpassen'; b.textContent = 'Anpassen';
      b.addEventListener('click', function () { oeffne(host, i); });
      c.appendChild(b);
      karten.appendChild(c);
    });
  }
  function oeffne(host, i) {
    (host._swkTeile || []).forEach(function (t, j) { t.el.classList.toggle('offen', j === i); });
    host.setAttribute('data-swk', 'teil');
    try { var sc = host.closest('.pane-wrap') || host.parentNode; sc.scrollTop = 0; host.scrollIntoView({ block: 'start' }); } catch (e) {}
  }
  function zurueck(host) {
    host.setAttribute('data-swk', 'karten');
    karteneZeichnen(host); setMarkieren(host);
    try { host.scrollIntoView({ block: 'start' }); } catch (e) {}
  }
  function setAnwenden(host, st) {
    Object.keys(st.werte).forEach(function (id) {
      var e = document.getElementById(id); if (!e) return;
      e.value = st.werte[id];
      try { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } catch (x) {}
    });
    karteneZeichnen(host); setMarkieren(host);
  }
  function setMarkieren(host) {
    var gleich = function (st) {
      return Object.keys(st.werte).every(function (id) {
        var e = document.getElementById(id); if (!e) return false;
        var a = parseFloat(String(e.value).replace(',', '.')), b = parseFloat(st.werte[id]);
        return isFinite(a) && Math.abs(a - b) < 1e-9;
      });
    };
    [].slice.call(host.querySelectorAll('.swk-set')).forEach(function (b) {
      var st = SETS.filter(function (s) { return s.id === b.getAttribute('data-set'); })[0];
      b.classList.toggle('an', !!st && gleich(st));
    });
  }

  window.DpStandardKarten = { aufbauen: aufbauen, SETS: SETS };
})();
