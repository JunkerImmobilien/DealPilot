/* ═══════════════════════════════════════════════════════════════════════
   tafeln.js · messe-schleife-5 — gemeinsame Tafeln für Rundgang und Videothek

   1 · REGISTER-TAFEL („Register & Ernte" für Besucher): was DealPilot an
       amtlichen Daten der Gutachterausschüsse hat. Zahlen aus
       register-stand.js (window.DPS_REGISTER), erzeugt von
       tools/messe-schleife-daten.mjs aus dem Register — nie von Hand.
       Nur Werte, keine Sperren- oder Lückenzahlen; der Anteil der Sätze
       mit Wert färbt nur das Länder-Raster.
   2 · GEWINNSPIEL-TAFEL (immocation Festival 2026, EXPO-Gewinnspiel):
       Schalter in gewinnspiel.js (window.MESSE_GEWINNSPIEL.an), dazu
       ?gewinnspiel=0|1 und Taste G (gilt für dieses Fenster, sessionStorage).
       Fehlt die Bilddatei, entfällt die Tafel still.

   Beide Tafeln nutzen den Rahmen .rg-t der Rundgang-Tafeln (Einblenden).
   Gold nur über var(--g) = var(--wl-c9a84c, #C9A84C) aus schleife.css.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  function fehler(t) { (window.DPS_FEHLER = window.DPS_FEHLER || []).push(t); }
  function zahl(n) { return Number(n || 0).toLocaleString('de-DE'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function logo(cls) { return '<div class="marke ' + (cls || '') + '">Deal<b>Pilot</b></div>'; }
  function datum(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }

  /* ── Gewinnspiel ─────────────────────────────────────────────────────── */
  var G = window.MESSE_GEWINNSPIEL || null;
  var bild = G && G.bild ? 'messe-schleife/' + G.bild : null;
  var bildOk = null;
  if (bild) {
    var im = new Image();
    im.onload = function () { bildOk = true; };
    im.onerror = function () { bildOk = false; fehler('Gewinnspiel: Bild fehlt ' + bild); };
    im.src = bild;
  }
  var schalter = null;
  try { var s0 = sessionStorage.getItem('dps_gewinnspiel'); if (s0 === '0' || s0 === '1') schalter = s0 === '1'; } catch (e) { /* ohne Speicher */ }
  if (Q.get('gewinnspiel') === '0' || Q.get('gewinnspiel') === '1') {
    schalter = Q.get('gewinnspiel') === '1';
    try { sessionStorage.setItem('dps_gewinnspiel', Q.get('gewinnspiel')); } catch (e) { /* ohne Speicher */ }
  }
  function gewollt() { return schalter != null ? schalter : !!(G && G.an); }
  function gwAktiv() { return gewollt() && bildOk === true; }
  function gwSekunden() { return Math.max(3, Number(G && G.sekunden) || 15); }
  function hinweis(t) {
    var h = document.createElement('div'); h.className = 'dps-hinweis'; h.textContent = t;
    document.body.appendChild(h);
    setTimeout(function () { h.classList.add('weg'); }, 2200);
    setTimeout(function () { h.remove(); }, 3000);
  }
  addEventListener('keydown', function (e) {
    if (e.key !== 'g' && e.key !== 'G') return;
    schalter = !gewollt();
    try { sessionStorage.setItem('dps_gewinnspiel', schalter ? '1' : '0'); } catch (x) { /* ohne Speicher */ }
    hinweis('Gewinnspiel-Tafel ' + (schalter ? 'AN' : 'AUS') + (schalter && bildOk === false ? ' — Bild fehlt' : ''));
  });

  function gewinnspielHtml(weiter, sek) {
    return '<div class="rg-t gw-t">'
      + '<div class="gw-text">' + logo('gw-logo')
      + '<div class="gw-kick">immocation Festival 2026 · EXPO-Gewinnspiel</div>'
      + '<div class="gw-titel">Jetzt mitmachen<br>&amp; gewinnen!</div>'
      + '<div class="gw-los"><b>QR-Code scannen</b> = 1 Gewinnlos</div>'
      + '<div class="gw-klein">Je mehr Aussteller du besuchst, desto größer ist deine Gewinnchance.</div>'
      + '<div class="gw-claim">Immobilien prüfen wie ein <em>Pilot</em>.</div></div>'
      + '<div class="gw-qr"><img alt="QR-Code EXPO-Gewinnspiel" src="' + esc(bild) + '"><span>Scannen · 1 Gewinnlos</span></div>'
      + (weiter ? '<div class="rg-weiter">' + weiter + '</div>' : '')
      + '<div class="gw-zeit"><i style="animation-duration:' + sek + 's"></i></div></div>';
  }

  /* ── Register ────────────────────────────────────────────────────────── */
  /* Deutschland als Kachelkarte, 5 × 5 Felder [Spalte, Zeile] */
  var LAGE = { SH: [2, 0], HB: [1, 1], HH: [2, 1], MV: [3, 1], NW: [0, 2], NI: [1, 2], ST: [2, 2], BB: [3, 2], BE: [4, 2],
    RP: [0, 3], HE: [1, 3], TH: [2, 3], SN: [3, 3], SL: [0, 4], BW: [1, 4], BY: [2, 4] };
  var KZ = [['lzs', 'Zins'], ['swf', 'Faktor'], ['uk_flaeche', 'UK Fläche'], ['uk_wgfz', 'UK WGFZ']];
  function prozentAb(a, b) { return Math.floor(1000 * a / b) / 10; }
  function herkunftSatz(h) {
    if (!h || !h.werte) return '';
    var voll = [], teil = [];
    [['mit_ausschuss', 'Gutachterausschuss'], ['mit_jahrgang', 'Jahrgang'], ['mit_quelle', 'Quelle'], ['mit_seite', 'Seite']].forEach(function (p) {
      if (h[p[0]] === h.werte) voll.push(p[1]); else teil.push(p[1] + ' bei ' + String(prozentAb(h[p[0]], h.werte)).replace('.', ',') + ' %');
    });
    if (!voll.length) return '';
    return 'Jeder Wert mit Herkunft: <b>' + voll.join(', ') + '</b>' + (teil.length ? ' — ' + teil.join(', ') : '') + '.';
  }
  function registerHtml(weiter) {
    var R = window.DPS_REGISTER; if (!R || !R.kopf) return null;
    var k = R.kopf;
    var kacheln = [
      [zahl(k.lzs), 'Liegenschaftszinssätze'],
      [zahl(k.swf), 'Sachwertfaktoren'],
      [zahl(k.uk), 'Umrechnungskoeffizienten'],
      [zahl(k.irw_tabellen), 'Tabellen zum Immobilienrichtwert'],
      [zahl(k.ausschuesse), 'Gutachterausschüsse'],
      [k.laender_erfasst + '<small> / ' + k.laender_gesamt + '</small>', 'Bundesländer']
    ];
    var h = '<div class="rg-t rt-t"><div class="rt-links">'
      + '<div class="rt-kick">Register &amp; Ernte · amtliche Daten an Bord</div>'
      + '<div class="rt-gross"><b class="gold">' + zahl(k.werte_gesamt) + '</b> amtliche Werte</div>'
      + '<div class="rt-unter">aus den Marktberichten der Gutachterausschüsse — für die Wertermittlung nach ImmoWertV</div>'
      + '<div class="rt-kacheln">';
    kacheln.forEach(function (x) { h += '<div><b>' + x[0] + '</b><span>' + x[1] + '</span></div>'; });
    h += '</div><div class="rt-satz">' + herkunftSatz(R.herkunft) + '</div>'
      + '<div class="rt-stand">Stand ' + datum(R.stand) + (R.jahrgaenge && R.jahrgaenge[0] ? ' · Jahrgänge ' + R.jahrgaenge[0] + '–' + R.jahrgaenge[1] : '') + '</div></div>';
    h += '<div class="rt-karte">';
    Object.keys(LAGE).forEach(function (L) {
      var r = R.laender[L]; if (!r) return;
      var a = Math.max(0, Math.min(1, r.anteil4 || 0));
      h += '<div class="rt-land" style="grid-column:' + (LAGE[L][0] + 1) + ';grid-row:' + (LAGE[L][1] + 1)
        + ';--a:' + Math.round(10 + 55 * a) + '%"><div class="rt-code">' + L + '</div>'
        + '<div class="rt-werte">' + (r.werte ? zahl(r.werte) : '') + '</div><div class="rt-balken">';
      KZ.forEach(function (z) { var c = r[z[0]] || { anteil: 0 }; h += '<i title="' + z[1] + '"><b style="height:' + Math.round(100 * (c.anteil || 0)) + '%"></b></i>'; });
      h += '</div></div>';
    });
    h += '<div class="rt-legende"><div class="rt-bal-leg">';
    KZ.forEach(function (z) { h += '<span>' + z[1] + '</span>'; });
    h += '</div>Zahl: amtliche Werte im Land · Säulen und Farbe: Anteil mit Wert</div></div>'
      + (weiter ? '<div class="rg-weiter">' + weiter + '</div>' : '') + '</div>';
    return h;
  }

  window.DPSTafeln = {
    gewinnspiel: { aktiv: gwAktiv, sekunden: gwSekunden, html: gewinnspielHtml, url: G && G.url },
    register: { da: function () { return !!(window.DPS_REGISTER && window.DPS_REGISTER.kopf); }, html: registerHtml, sekunden: 14 }
  };
})();
