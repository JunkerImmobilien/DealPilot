/* eigennutzer-app-demo.js · v5120ii6 · DEMO Eigennutzer-Objekt in der App (Marcel 26.11.2026)
   „… dass es für ‚als Objekt anlegen‘ und den Tabs, die man braucht, auch sinnvoll ist, und alles, was man nicht
   braucht, ist ausgeblendet“ und „einen neuen Tab-Reiter drüber … im gleichen Stil, aber ohne Deal Score …
   Lage und Markt mit drin“.

   NUR DEMO, NUR STAGING (Host enthält „staging“/„localhost“ UND localStorage dp_demo_eigennutzer = 1,
   gesetzt über ?eigennutzer=1). Auf Prod: tut nichts.
   - Feld #_nutzung ('' = vermieten, 'eigen' = selbst nutzen), gespeichert mit dem Objekt (storage.js Feld- und Rücksetzliste).
   - Bei 'eigen': Investoren-Reiterleiste und ihre Abschnitte ausgeblendet (Daten bleiben), eigene Leiste mit
     8 Reitern im gleichen Stil, Inhalte aus eigennutzer-kern.js und den Objektfeldern. Kein Deal Score.
   - Umschalter „Nutzung“ in beiden Leisten.
   - Quick-Check im Modus „Selbst nutzen“ gespeichert → neues Objekt bekommt _nutzung = 'eigen'. */
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

  function $(id) { return document.getElementById(id); }
  function val(id) { var e = $(id); return e ? e.value : ''; }
  function num(id) { var v = String(val(id) || '').replace(/\./g, '').replace(',', '.'); var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(n) { return isFinite(n) ? Math.round(n).toLocaleString('de-DE') + ' €' : '–'; }
  function farbe(s) { return s == null ? '#888' : s >= 70 ? '#3FA56C' : s >= 50 ? 'var(--wl-c9a84c,#C9A84C)' : '#B8625C'; }

  var REITER = [
    ['ueberblick', 'Überblick', 'house'], ['haus', 'Haus', 'settings'], ['preis', 'Preis und Wert', 'coins'],
    ['lage', 'Lage und Markt', 'barChart'], ['fin', 'Finanzierung', 'bank'], ['kaufen', 'Kaufen oder mieten', 'euro'],
    ['foerder', 'Förderung', 'handshake'], ['unterlagen', 'Unterlagen', 'fileText']
  ];
  var aktiv = 'ueberblick', ergebnis = null, daten = null, zuletzt = '';

  var CSS = ''
    + 'body.eig-obj nav.tabs:not(.eig-tabs){display:none!important}'
    + 'body.eig-obj .sec{display:none!important}'
    + 'body.eig-obj #hdr-badges,body.eig-obj .dpl-teil-score,body.eig-obj #hdr-ziel-mini,body.eig-obj #ank-ansicht-host{display:none!important}'   /* Investor Deal Score, Renditeziel, Ist/Soll-Pille: gibt es für Selbstnutzer nicht */
    + 'nav.tabs.eig-tabs{display:none}body.eig-obj nav.tabs.eig-tabs{display:flex!important;flex-wrap:wrap}'
    + 'body.eig-obj #eig-panel{display:block!important}#eig-panel{display:none;padding:18px 0}'
    + '.eig-nutz{margin-left:auto;display:flex;gap:4px;align-items:center;font:600 11px "JetBrains Mono",monospace;color:var(--muted,#8a826f)}'
    + '.eig-nutz button{border:1px solid rgba(127,127,127,.35);background:transparent;border-radius:999px;padding:4px 10px;font:600 11px Inter,sans-serif;color:inherit;cursor:pointer}'
    + '.eig-nutz button.an{background:var(--wl-c9a84c,#C9A84C);color:#1a1408;border-color:transparent}'
    + '.eig-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}'
    + '.eig-card{background:var(--surface,#fff);border:1px solid var(--border,rgba(0,0,0,.08));border-radius:14px;padding:14px}'
    + '.eig-card h3{margin:0 0 6px;font:700 15px "Space Grotesk",sans-serif}'
    + '.eig-card .lbl{font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#8a826f)}'
    + '.eig-card .wert{font:700 22px "Space Grotesk",sans-serif;margin:2px 0}'
    + '.eig-card p,.eig-card li{font:400 13px/1.45 Inter,sans-serif;margin:4px 0}'
    + '.eig-bar{height:6px;border-radius:3px;background:rgba(127,127,127,.2);margin:6px 0}.eig-bar i{display:block;height:100%;border-radius:3px}'
    + '.eig-gross{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:12px}'
    + '.eig-gross .zahl{font:700 44px "Space Grotesk",sans-serif;line-height:1}'
    + '.eig-demo{font:600 10px "JetBrains Mono",monospace;letter-spacing:.08em;color:var(--muted,#8a826f);margin:0 0 10px}'
    + '.eig-hinweis{font:400 11.5px Inter,sans-serif;color:var(--muted,#8a826f);margin-top:10px}'
    + '@media(max-width:700px){body.eig-obj nav.tabs.eig-tabs{flex-wrap:nowrap!important;justify-content:flex-start!important;overflow-x:auto;padding-left:10px!important}nav.eig-tabs .tab{flex:0 0 auto!important}nav.eig-tabs .eig-nutz{order:-1;margin-left:0;flex:0 0 auto;padding-right:8px}}';

  function eingaben() {
    return { kp: num('kp'), wfl: num('wfl'), bj: num('baujahr'), ek: num('ek') || 0, netto: num('eig_netto_app') || 0, plz: String(val('plz') || '').trim() };
  }

  function berechnen(cb) {
    var e = eingaben();
    if (!(e.kp > 0 && e.wfl > 0 && e.bj > 1800) || !window.DpEigennutzerKern) { ergebnis = null; cb(); return; }
    DpEigennutzerKern.daten(e.plz || '33602', e.bj, e.wfl).then(function (d) { daten = d; ergebnis = DpEigennutzerKern.rechne(e, d); cb(); });
  }

  function karte(titel, inhalt) { return '<div class="eig-card"><h3>' + esc(titel) + '</h3>' + inhalt + '</div>'; }
  function wertzeile(lbl, w, sub) { return '<div class="lbl">' + esc(lbl) + '</div><div class="wert">' + w + '</div>' + (sub ? '<p>' + esc(sub) + '</p>' : ''); }

  function inhalt(k) {
    var r = ergebnis, e = eingaben();
    var demo = '<div class="eig-demo">DEMO · EIGENNUTZER-OBJEKT · BEISPIELRECHNUNG</div>';
    if (!r) return demo + karte('Noch zu wenig Angaben', '<p>Für die Auswertung braucht es Kaufpreis, Wohnfläche und Baujahr im Objekt.</p>');
    if (k === 'ueberblick') {
      return demo + '<div class="eig-gross"><div class="zahl" style="color:' + farbe(r.gesamt) + '">' + r.gesamt + '</div><div><h3 style="margin:0;font:700 20px \'Space Grotesk\',sans-serif">Ist das Haus gut? ' + esc(r.stufe.wort) + '</h3><p class="eig-hinweis" style="margin:4px 0 0">Eigennutzer-Score aus Preis, Zustand, Lage und Leistbarkeit</p></div></div>'
        + '<div class="eig-grid">' + r.gruppen.map(function (g) { return karte(g.k, '<div class="wert">' + (g.s == null ? '–' : g.s) + '</div><div class="eig-bar"><i style="width:' + (g.s || 0) + '%;background:' + farbe(g.s) + '"></i></div><p>' + esc(g.t) + '</p>'); }).join('') + '</div>'
        + '<p class="eig-hinweis">' + (r.jahr ? 'Kaufen ist nach ' + r.jahr + ' Jahren günstiger als mieten.' : 'In 20 Jahren wird Kaufen hier nicht günstiger als mieten.') + '</p>';
    }
    if (k === 'haus') {
      var z = r.gruppen[1];
      return demo + '<div class="eig-grid">' + karte('Baujahr ' + e.bj, wertzeile('Zustand', z.s + ' von 100', '') + '<ul>' + (z.punkte || []).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>')
        + karte('Heizung und GEG', '<p>Heizungen über 30 Jahre müssen meist getauscht werden. Alter und Art aus Exposé oder Energieausweis übernehmen.</p>')
        + karte('Energiekosten', wertzeile('grob im Jahr', eur(e.wfl * 15), 'Annahme 15 € je m² und Jahr, genauer mit dem Energieausweis.'))
        + karte('Sanierung', '<p>Grobe Kosten je Gewerk folgen aus der Checkliste und den Unterlagen.</p>') + '</div>';
    }
    if (k === 'preis') {
      return demo + '<div class="eig-grid">' + karte('Kaufpreis', wertzeile('gesamt', eur(e.kp), Math.round(e.kp / e.wfl).toLocaleString('de-DE') + ' € je m²'))
        + karte('Preis gegen Miete', wertzeile('Jahresmieten', r.faktor.toFixed(1).replace('.', ','), 'Üblich sind rund 22 bis 26.'))
        + karte('Kaufnebenkosten', wertzeile('rund 10 %', eur(e.kp * 0.10), 'Grunderwerbsteuer, Notar, Grundbuch, ohne Makler.'))
        + karte('Wert nach ImmoWertV', '<p>Aus dem Marktbericht des Objekts: Verkehrswert bei Stufe 3, sonst Wertindikation mit Rechenweg.</p>') + '</div>';
    }
    if (k === 'lage') {
      var d = daten || {};
      return demo + '<div class="eig-grid">' + karte('Makrolage', wertzeile(esc(d.gebiet || ''), (d.makro != null ? d.makro : '–') + ' von 100', ''))
        + karte('Leerstand', wertzeile('am Ort', d.leer === 'gut' ? 'niedrig' : 'erhöht', ''))
        + karte('Bevölkerung', wertzeile('Entwicklung', d.bev != null ? (d.bev > 0 ? '+' : '') + String(d.bev).replace('.', ',') + ' %' : '–', ''))
        + karte('Karte, Bodenrichtwert, Preise am Ort', '<p>Aus dem Marktbericht: Karte mit Pin, Bodenrichtwert, Preis- und Mietentwicklung.</p>') + '</div>';
    }
    if (k === 'fin') {
      return demo + '<div class="eig-grid">' + karte('Rate im Monat', wertzeile('Zins ' + r.zins.toFixed(2).replace('.', ',') + ' %, Tilgung 2 %', eur(r.rate), 'Darlehen ' + eur(r.darlehen) + ', Beleihung ' + Math.round(r.ltv) + ' %'))
        + karte('Leistbarkeit', '<label class="lbl" for="eig_netto_app">Netto-Haushaltseinkommen im Monat</label><input id="eig_netto_app" inputmode="decimal" placeholder="5.200" value="' + esc(val('eig_netto_app')) + '" style="width:100%;margin:6px 0;padding:8px;border-radius:8px;border:1px solid rgba(127,127,127,.4)">'
          + '<p>' + (r.quote == null ? 'Einkommen eintragen, dann rechnen wir die Belastung.' : 'Wohnkosten ' + Math.round(r.quote) + ' % vom Netto-Einkommen. Gut sind bis 35 %.') + '</p>')
        + karte('Zinsbindung', '<p>Anschluss nach 10 Jahren prüfen. Restschuld und Anschlusszins aus dem Reiter Finanzierung.</p>') + '</div>';
    }
    if (k === 'kaufen') {
      return demo + '<div class="eig-grid">' + karte('Ersparte Miete', wertzeile(esc(r.quelle) + ', Mittelwert', eur(r.miete) + ' im Monat', ''))
        + karte('Kaufen oder mieten', '<p style="font-weight:600">' + (r.jahr ? 'Kaufen ist nach ' + r.jahr + ' Jahren günstiger als mieten.' : 'In 20 Jahren wird Kaufen hier nicht günstiger als mieten.') + '</p>'
          + '<p>Nach 20 Jahren: Kaufen ' + eur(r.reihe[20].kauf) + ', Mieten und anlegen ' + eur(r.reihe[20].mieten) + '.</p>') + '</div>';
    }
    if (k === 'foerder') {
      var fk = window.DpFoerderung;
      return demo + karte('Förderung', fk && fk.html ? fk.html({ baujahr: e.bj, kp: e.kp, nutzung: 'eigen' }) : '<p>Hier erscheinen passende öffentliche Förderprogramme für Kauf und Sanierung. Der Baustein ist in Arbeit.</p>');
    }
    if (k === 'unterlagen') {
      return demo + '<div class="eig-grid">' + karte('Unterlagen einlesen', '<p>Exposé, Energieausweis, Grundriss, bei Wohnungen Protokolle und Wirtschaftsplan. Gelesen wird wie im Deal-Check, Risiken erscheinen hier.</p>')
        + karte('Besichtigung', '<p>Die Checkliste nach Baujahr und aus den Unterlagen, zum Abhaken vor Ort.</p>') + '</div>';
    }
    return demo;
  }

  function zeichnen() {
    var p = $('eig-panel'); if (!p) return;
    p.innerHTML = inhalt(aktiv);
    var bs = document.querySelectorAll('nav.eig-tabs .tab');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('active', bs[i].getAttribute('data-eig') === aktiv);
    var n = $('eig_netto_app'); if (n) n.addEventListener('change', function () { berechnen(zeichnen); });
    nutzKnoepfe();
  }

  function nutzKnoepfe() {
    var eig = val('_nutzung') === 'eigen';
    var bs = document.querySelectorAll('.eig-nutz button');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('an', (bs[i].getAttribute('data-n') === 'eigen') === eig);
  }

  function nutzung(n) {
    var f = $('_nutzung'); if (!f) return;
    f.value = n === 'eigen' ? 'eigen' : '';
    anwenden(true);
    try { if (typeof window.saveObj === 'function') window.saveObj(); } catch (e) {}
  }

  function anwenden(neu) {
    var eig = val('_nutzung') === 'eigen';
    document.body.classList.toggle('eig-obj', eig);
    nutzKnoepfe();
    if (eig) berechnen(zeichnen);
  }

  function aufbau() {
    if ($('eig-panel')) return;
    var nav = document.querySelector('nav.tabs'); var s0 = $('s0');
    if (!nav || !s0) return;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var en = document.createElement('nav'); en.className = 'tabs eig-tabs';
    en.innerHTML = REITER.map(function (r) { return '<button class="tab" type="button" data-eig="' + r[0] + '"><span class="tab-ico" data-ico="' + r[2] + '"></span><span class="tab-lbl">' + r[1] + '</span></button>'; }).join('')
      + '<div class="eig-nutz">Nutzung <button type="button" data-n="vermieten">Vermieten</button><button type="button" data-n="eigen">Selbst nutzen</button></div>';
    nav.parentNode.insertBefore(en, nav.nextSibling);
    var nz = document.createElement('div'); nz.className = 'eig-nutz'; nz.innerHTML = 'Nutzung <button type="button" data-n="vermieten">Vermieten</button><button type="button" data-n="eigen">Selbst nutzen</button>';
    nav.appendChild(nz);
    var panel = document.createElement('div'); panel.id = 'eig-panel'; s0.parentNode.insertBefore(panel, s0);
    document.addEventListener('click', function (ev) {
      var t = ev.target.closest && ev.target.closest('nav.eig-tabs .tab'); if (t) { aktiv = t.getAttribute('data-eig'); zeichnen(); return; }
      var b = ev.target.closest && ev.target.closest('.eig-nutz button'); if (b) nutzung(b.getAttribute('data-n'));
    });
    try { if (window.DpIcons && DpIcons.render) DpIcons.render(en); } catch (e) {}
    setInterval(function () {   /* Objektwechsel erkennen */
      var sig = (window._currentObjKey || '') + '|' + val('_nutzung') + '|' + val('kp') + '|' + val('wfl') + '|' + val('baujahr');
      if (sig !== zuletzt) { zuletzt = sig; anwenden(false); }
    }, 1000);
    anwenden(false);
  }

  /* Quick-Check im Modus „Selbst nutzen“ gespeichert → neues Objekt als Eigennutzer markieren */
  window.addEventListener('message', function (ev) {
    var d = ev && ev.data; if (!d || d.source !== 'dp-qc' || d.type !== 'qc-save') return;
    var m = String(lsGet('dp_qc_nutzung_next') || ''); lsSet('dp_qc_nutzung_next', null);
    var teil = m.split('|'); if (teil[0] !== 'eigen' || !(Date.now() - (+teil[1] || 0) < 120000)) return;
    setTimeout(function () { var f = $('_nutzung'); if (f) { f.value = 'eigen'; anwenden(true); try { window.saveObj && window.saveObj(); } catch (e) {} } }, 9000);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(aufbau, 800); });
  else setTimeout(aufbau, 800);
  window.DpEigAppDemo = { nutzung: nutzung, anwenden: anwenden };
})();
