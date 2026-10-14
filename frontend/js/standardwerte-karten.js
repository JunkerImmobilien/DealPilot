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
  /* v2211 · Marcel 14.10.: „alle diese Karten mit so komischen KI-Icons. Die müssen
     grundsätzlich weg." Keine Symbole mehr. Und: „Bewirtschaftung und Bewirtschaftung
     je Objektart … das kann keiner verstehen" - EINE Karte, die € je Objektart und
     den Prozent-Rückfall zusammen zeigt (die Abschnitte werden in aufbauen() vereint). */
  var KARTEN = [
    { an: 'Finanzierung', txt: 'Startwerte für Darlehen und Eigenkapital.',
      felder: [['_zins', 'Zinssatz', ''], ['ip_tilgung_default', 'Tilgung', ' %'], ['ip_zinsbindung_default', 'Zinsbindung', ''], ['ip_ek_quote_default', 'Eigenkapital', ' % v. KP']] },
    { an: 'Bewirtschaftung', txt: 'Verwaltung, Instandhaltung und Mietausfall — in Euro je Objektart oder als Prozent der Miete.',
      felder: [['_bwk', 'Rechenweg', ''], ['bwkp_mfh_verw', 'Verwaltung je Wohnung', ' €/Jahr'], ['bwkp_mfh_inst_qm', 'Instandhaltung', ' €/m² · Jahr'], ['bwkp_etw_hg_qm', 'ETW-Hausgeld', ' €/m² · Monat'], ['ip_mietausfall_pct', 'Mietausfall', ' % der Miete']] },
    { an: 'Lageklassen', txt: 'Zielrendite brutto je Lage — der Maßstab der Ampel im Quick-Check.', lage: true },
    { an: 'Persönliche Mindest', txt: 'Deine persönlichen Kaufgrenzen.',
      felder: [['ip_min_dscr', 'DSCR', ''], ['ip_min_cashflow_vor_st', 'Cashflow', ' €/Monat'], ['ip_max_ltv', 'max. LTV', ' %']] },
    { an: 'Steuer', txt: 'Dein persönlicher Grenzsteuersatz. Gesellschaften rechnen mit dem Satz aus Mandanten.',
      felder: [['ip_grenzsteuersatz', 'Grenzsteuersatz', ' %']] },
    { an: 'Standort', txt: 'Bundesland und Kaufnebenkosten.',
      felder: [['ip_bundesland', 'Bundesland', ''], ['ip_notar_grundbuch', 'Notar/Grundbuch', ' %'], ['ip_maklerkosten', 'Makler', ' %']] }
  ];
  /* Welche Felder ein Set setzt - in den Karten als „Set" bzw. „eigen" markiert. */
  var SET_FELDER = { ip_tilgung_default: 1, ip_ek_quote_default: 1, ip_mietausfall_pct: 1, ip_min_dscr: 1 };
  var LS_SET = 'dp_std_set';
  function setGemerkt() { try { return localStorage.getItem(LS_SET) || 'dp'; } catch (e) { return 'dp'; } }
  function setMerken(id) { try { localStorage.setItem(LS_SET, id); } catch (e) {} }
  function setVon(id) { return SETS.filter(function (s) { return s.id === id; })[0] || SETS[0]; }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function zahl(v) { return String(v).replace('.', ','); }
  function wert(id, einheit) {
    if (id === '_zins') {   /* v2211: Entweder-oder sichtbar */
      var r = document.querySelector('input[name="ip_zins_modus"]:checked'), z = document.getElementById('ip_zins_override');
      var zv = z && String(z.value || '').trim() ? zahl(z.value) + ' %' : '';
      return (r && r.value === 'eigen') ? 'eigener · ' + (zv || '—') : 'Marktzins' + (zv ? ' · ' + zv : '');
    }
    if (id === '_bwk') {
      var b = document.querySelector('input[name="ip_bwk_modus"]:checked');
      return (b && b.value === 'percent') ? '% der Miete' : 'Euro je Objektart';
    }
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
      /* v2211 · Set-Zuordnung, klickbare Karte, ruhigere Detailansicht, Entweder-oder-Wahlen */
      '#settings-modal .swk-set.an.angepasst::after{content:"✓ aktiv · angepasst"}',
      '#settings-modal .swk-band{font-size:12.5px;color:#3a3532;background:#FBF6E9;border:1px solid color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 35%,transparent);border-radius:10px;padding:9px 12px;margin:0 0 14px;line-height:1.5}',
      '#settings-modal .swk-tag{font-style:normal;font:600 9.5px/1 Inter,sans-serif;letter-spacing:.04em;text-transform:uppercase;padding:2px 5px;border-radius:4px;margin-left:6px;vertical-align:1px;background:color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 22%,#fff);color:#6b5417}',
      '#settings-modal .swk-tag.eigen{background:#EEF2F7;color:#3f4b5c}',
      '#settings-modal .swk-karte{cursor:pointer;transition:border-color .15s,box-shadow .15s}',
      '#settings-modal .swk-karte:hover,#settings-modal .swk-karte:focus-visible{border-color:var(--wl-c9a84c,#C9A84C);box-shadow:0 2px 10px rgba(26,23,20,.07);outline:none}',
      '#settings-modal span.swk-anpassen{border:0;padding:0;min-height:0;margin-top:2px;font:600 12px Inter,sans-serif;color:#8a6d1f}',
      '#settings-modal .swk-teil{background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:6px 18px 18px}',
      '#settings-modal .swk-teil h3.ip-section{font:600 18px "Space Grotesk",sans-serif;margin:4px 0 6px;border:0;padding:0;text-transform:none;letter-spacing:0}',
      '#settings-modal .swk-teil .bwkp-titel{font:600 13px Inter,sans-serif;color:#8a6d1f;margin:14px 0 2px;text-transform:none;letter-spacing:0}',
      '#settings-modal .swk-teil .bwkp-block{padding:4px 0 6px;border-bottom:1px dashed #efeae0}',
      '#settings-modal .swk-teil .ip-unter{font:600 13px Inter,sans-serif;color:#1a1714;margin:18px 0 8px;padding-top:12px;border-top:1px solid #efeae0}',
      '#settings-modal .ip-zins-modi{display:flex;flex-wrap:wrap;gap:8px 18px;margin:6px 0 4px}',
      '#settings-modal .ip-zins-modi label{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;cursor:pointer}',
      '#settings-modal .ip-zins-modi small{color:#625c59;font-weight:400}',
      '#settings-modal .ip-zins-wahl,#settings-modal .ip-bwk-wahl{grid-column:1/-1}',
      '#settings-modal input[readonly]#ip_zins_override{background:#f6f3ec;color:#625c59}',
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
    var bwkTeil = null;
    kinder.forEach(function (k) {
      if (k.matches('h3.ip-section')) {
        var titel = k.textContent.trim();
        /* v2211: „Bewirtschaftung je Objektart" wird Teil der Karte Bewirtschaftung -
           als Unterabschnitt „Euro-Werte je Objektart", direkt unter dem Umschalter. */
        if (bwkTeil && titel.indexOf('Bewirtschaftung je') === 0) {
          var h = document.createElement('h4'); h.className = 'ip-unter'; h.textContent = 'Euro-Werte je Objektart';
          k.style.display = 'none';
          var stelle = 1 + bwkTeil.knoten.findIndex(function (n) { return n.classList && n.classList.contains('ip-bwk-wahl'); });
          if (stelle < 1) stelle = bwkTeil.knoten.length;
          bwkTeil.einschub = stelle; bwkTeil.knoten.splice(stelle, 0, k, h);
          akt = { titel: titel, knoten: null, an: bwkTeil, pos: stelle + 2 }; return;
        }
        akt = { titel: titel, knoten: [k] }; teile.push(akt);
        if (titel.indexOf('Bewirtschaftung') === 0) bwkTeil = akt;
      }
      else if (akt && akt.knoten) akt.knoten.push(k);
      else if (akt && akt.an) { akt.an.knoten.splice(akt.pos, 0, k); akt.pos++; }
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
    hin.textContent = 'Ein Set setzt Tilgung, Eigenkapital, Mietausfall und Mindest-DSCR. Übernommen wird mit „Speichern“ unten.';
    var band = document.createElement('div'); band.className = 'swk-band';   /* v2211 */
    oben.appendChild(sets); oben.appendChild(hin); oben.appendChild(band); oben.appendChild(karten);
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
        var set = setVon(setGemerkt());
        (k.felder || []).forEach(function (f) {
          var v = wert(f[0], f[2]); if (v == null) return;
          /* v2211 · Marcel: „dass die jetzt auch für den DealPilot Standard dann sind. Das kann
             man nicht ganz auseinanderhalten." Felder, die das Set setzt, tragen ein Etikett:
             „Set" solange der Wert dem gewählten Set entspricht, sonst „eigen". */
          var tag = '';
          if (SET_FELDER[f[0]]) {
            var e = document.getElementById(f[0]);
            var a = e ? parseFloat(String(e.value).replace(',', '.')) : NaN, s = parseFloat(set.werte[f[0]]);
            tag = (isFinite(a) && Math.abs(a - s) < 1e-9) ? '<i class="swk-tag">Set</i>' : '<i class="swk-tag eigen">eigen</i>';
          }
          zeilen += '<span>' + esc(f[1]) + tag + '</span><b>' + esc(v) + '</b>';
        });
      }
      var c = document.createElement('div'); c.className = 'swk-karte'; c.tabIndex = 0;
      c.setAttribute('role', 'button');
      c.innerHTML = '<h4>' + esc(k.titel || t.titel) + '</h4>'
        + (k.txt ? '<p>' + esc(k.txt) + '</p>' : '')
        + (zeilen ? '<div class="swk-werte">' + zeilen + '</div>' : '')
        + '<span class="swk-anpassen">Anpassen ›</span>';
      /* v2211: die ganze Karte öffnet - nicht nur der Knopf */
      c.addEventListener('click', function () { oeffne(host, i); });
      c.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); oeffne(host, i); } });
      karten.appendChild(c);
    });
    /* Band: welches Set gilt, wie viele Werte weichen ab */
    var band = host.querySelector('.swk-band');
    if (band) {
      var st = setVon(setGemerkt()), eigen = 0;
      Object.keys(SET_FELDER).forEach(function (id) { var e = document.getElementById(id); if (!e) return;
        var a = parseFloat(String(e.value).replace(',', '.')); if (!(isFinite(a) && Math.abs(a - parseFloat(st.werte[id])) < 1e-9)) eigen++; });
      band.innerHTML = 'Grundlage: <b>' + esc(st.name) + '</b> — die mit <i class="swk-tag">Set</i> markierten Werte kommen aus diesem Set'
        + (eigen ? ', <b>' + eigen + '</b> davon hast du angepasst (<i class="swk-tag eigen">eigen</i>).' : '.')
        + ' Alle anderen Werte gelten für jedes Set.';
    }
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
    setMerken(st.id);   /* v2211: das gewählte Set bleibt gemerkt */
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
    /* v2211 · Aktiv ist das GEWÄHLTE Set (gemerkt), nicht nur eines, dessen vier Werte
       zufällig passen. Weicht ein Wert ab, steht „aktiv · angepasst". */
    var g = setGemerkt();
    [].slice.call(host.querySelectorAll('.swk-set')).forEach(function (b) {
      var id = b.getAttribute('data-set'), st = setVon(id), an = id === g;
      b.classList.toggle('an', an);
      b.classList.toggle('angepasst', an && !gleich(st));
    });
  }

  window.DpStandardKarten = { aufbauen: aufbauen, SETS: SETS };
})();
