/* ═══════════════════════════════════════════════════════════════════════
   einzelcheck-demo.js · landing-faecher-1 (20.11.2026) · DEMO, nur Staging
   Marcels Idee vom 20.11.2026: aus dem Deal-Check heraus bis zu vier
   Unterlagen hochladen (Exposé, Mietaufstellung …), sie werden ausgelesen und
   bewertet, dann „Deine Daten stehen bereit“ mit einer groben Einschätzung wie
   im Quick-Check und drei Wegen: Kurzbericht einmal kaufen, in DealPilot mit
   einem Paket weitermachen, kostenlos starten.

   DAS IST EINE DEMO:
     · nichts wird hochgeladen, nichts geht an einen Server, kein KI-Aufruf,
       kein Stripe. Hochladen und Auslesen sind animiert, mit Beispieldaten
       (dasselbe Beispielobjekt wie die Startbahn, landing-faecher.js).
     · Die grobe Einschätzung rechnen die ECHTEN Kerne der Startseite
       (DealKpis.compute, DealScore.computeFromKpis, ScoreTier.stufe), mit
       Zins und Tilgung aus dem Deal-Check (Ereignis dp:dealcheck-ergebnis).
     · Die Kasse ist eine deutlich gekennzeichnete Demo-Kasse ohne
       Kartenfelder, der Kurzbericht eine Vorschau im Aufbau der DealPilot-
       Dokumente (frontend/js/dp-dokument.js: Deckblatt mit Bild und Wertbox,
       Kopfzeile, Kennzahl-Kacheln mit Goldkante, Tabellen, Hinweis, Fuß).
     · Geladen wird diese Datei nur von landing-faecher.js einzelcheckLaden():
       staging.dealpilot.immo oder lokal, auf den Produktionsadressen nie.

   DATENSCHUTZ-SATZ, am Code geprüft:
     · Schwärzen gibt es: backend/src/services/schwaerzen.js (v2210) schwärzt
       vor jedem Auslesen regelbasiert Geburtsdaten, Namen nach Anrede oder im
       Grundbuch-Muster, Anschriften nach „wohnhaft“, E-Mail, Telefon, IBAN,
       Steuer-ID (routes/ai.js extract-expose, extract-dokument …). Grenze laut
       Kopf dort: ein Name ohne Signalwort kann stehen bleiben.
     · „nicht gespeichert“ gilt für den Einzel-Check als Plan, gebaut ist er
       noch nicht (in der App liegen Unterlagen am Objekt). Deshalb steht es
       als Vorhaben im Text, nicht als Tatsache.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpEinzelCheck) return;

  /* Preis offen, Marcel entscheidet 3,99 / 4,90 */
  var EINZELCHECK_PREIS_EUR = 3.99;
  var ANRECHNUNG_TAGE = 14;   /* Demo-Text, Regel offen */

  var ruhig = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function warte(ms) { return new Promise(function (ok) { setTimeout(ok, ruhig ? 0 : ms); }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function dez(n, st) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: st, maximumFractionDigits: st }); }
  function eur(n) { return Math.round(n).toLocaleString('de-DE') + ' €'; }
  function preis() { return dez(EINZELCHECK_PREIS_EUR, 2) + ' €'; }
  function appUrl(pfad) {
    var h = location.hostname, app = /(^|\.)staging\.dealpilot\.immo$/.test(h) ? 'https://app.staging.dealpilot.immo/' : 'https://app.dealpilot.immo/';
    return app + (pfad || '');
  }

  /* ── Beispielunterlagen (dasselbe Beispielobjekt wie die Startbahn) ── */
  var DOKS = [
    { id: 'expose', art: 'Exposé', datei: 'Expose-Beispiel.pdf', seiten: 6,
      felder: [['Kaufpreis', '180.000 €'], ['Wohnfläche', '100 m²'], ['Kaltmiete', '1.300 € im Monat'], ['Kaufnebenkosten', '10,5 %']],
      daten: { kp: 180000, nk_pct: 10.5, nkm: 1300, wfl: 100 } },
    { id: 'mieter', art: 'Mietaufstellung', datei: 'Mietaufstellung-Beispiel.pdf', seiten: 1, geschwaerzt: 'Mietername',
      felder: [['Einheiten', '1'], ['Kaltmiete laut Vertrag', '1.300 € im Monat'], ['Mietbeginn', '2021']],
      daten: {} },
    { id: 'energie', art: 'Energieausweis', datei: 'Energieausweis-Beispiel.pdf', seiten: 4,
      felder: [['Effizienzklasse', 'D'], ['Ausweisart', 'Verbrauch']],
      daten: {} },
    { id: 'weg', art: 'WEG-Protokoll', datei: 'WEG-Protokoll-Beispiel.pdf', seiten: 9, geschwaerzt: 'Namen der Eigentümer',
      felder: [['Hausgeld nicht umlagefähig', '1.500 € im Jahr'], ['Sonderumlagen', 'keine beschlossen']],
      daten: { bwk_nul: 1500 } }
  ];

  /* ── Rechnen: nur die Kerne der Startseite ─────────────────────────── */
  function rechne(dc) {
    if (!window.DealKpis || !window.DealScore || !window.ScoreTier) return null;
    var S = {}; DOKS.forEach(function (d) { if (d.an !== false) Object.assign(S, d.daten); });
    if (!S.kp) return null;
    var zins = dc && dc.zins, tilg = dc && dc.tilg != null ? dc.tilg : 1.5, bindung = dc && dc.bindung;
    if (!(zins > 0) && typeof window.dpGetIndicativeZins === 'function') { zins = window.dpGetIndicativeZins(10, 'voll'); bindung = 10; }
    if (!(zins > 0)) return null;
    var nk = S.kp * S.nk_pct / 100, ek = Math.round(S.kp * 0.10), d1 = Math.max(0, S.kp + nk - ek);
    /* ohne WEG-Protokoll: dieselbe Annahme wie der Deal-Check (17 % der Kaltmiete nicht umlagefähig) */
    var bwkNul = S.bwk_nul != null ? S.bwk_nul : S.nkm * 12 * 0.17;
    var k = DealKpis.compute({ kp: S.kp, nk: nk, nkm: S.nkm, ze: 0, uf: 0, bwk_ul: 0, bwk_nul: bwkNul, d1: d1, d1z: zins, d1t: tilg, ek: ek });
    var ds = DealScore.computeFromKpis({ kp: S.kp, cf_m: k.cf_m, nmy: k.nmy, ltv: k.ltv, dscr: k.dscr, wp_kpi: S.kp * 0.05, mstg: 1.5,
      darlehen: (k.d_total != null && isFinite(k.d_total)) ? k.d_total : null });
    return { S: S, k: k, ds: ds, st: ScoreTier.stufe(ds.score), zins: zins, tilg: tilg, bindung: bindung, ek: ek, nk: nk, d1: d1, bwkNul: bwkNul, mitWeg: S.bwk_nul != null };
  }

  /* ── Fenster ──────────────────────────────────────────────────────── */
  var fenster, inhalt, zuvor = null, schritt = 0, ergebnis = null;
  function baueFenster() {
    if (fenster) return;
    fenster = document.createElement('div');
    fenster.className = 'ec-fenster';
    fenster.hidden = true;
    fenster.innerHTML = '<div class="ec-dunkel" data-zu></div><div class="ec-box" role="dialog" aria-modal="true" aria-labelledby="ecTitel">'
      + '<div class="ec-leiste"><span class="ec-marke">Einzel-Check</span><span class="ec-demo">Demo · die echte Fassung wird noch gebaut</span><button type="button" class="ec-x" data-zu aria-label="Schließen">×</button></div>'
      + '<ol class="ec-schritte" aria-hidden="true"><li>Unterlagen</li><li>Auslesen</li><li>Ergebnis</li><li>Bericht</li></ol>'
      + '<div class="ec-inhalt"></div></div>';
    document.body.appendChild(fenster);
    inhalt = $('.ec-inhalt', fenster);
    fenster.addEventListener('click', function (e) { if (e.target.closest('[data-zu]')) zu(); });
    document.addEventListener('keydown', function (e) {
      if (fenster.hidden) return;
      if (e.key === 'Escape') { zu(); return; }
      if (e.key === 'Tab') {   /* Fokus im Fenster halten */
        var f = $$('button:not([disabled]),a[href],input,[tabindex="0"]', $('.ec-box', fenster)).filter(function (x) { return x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }
  function auf() {
    baueFenster(); zuvor = document.activeElement;
    fenster.hidden = false; document.documentElement.classList.add('ec-offen');
    zeigeUnterlagen();
  }
  function zu() {
    if (!fenster) return;
    schritt++; fenster.hidden = true; document.documentElement.classList.remove('ec-offen');
    if (zuvor && zuvor.focus) try { zuvor.focus({ preventScroll: true }); } catch (e) {}
  }
  function stufe(i) { $$('.ec-schritte li', fenster).forEach(function (li, j) { li.classList.toggle('an', j === i); li.classList.toggle('ok', j < i); }); }
  function setze(html, fokus) {
    inhalt.innerHTML = html; inhalt.scrollTop = 0; $('.ec-box', fenster).scrollTop = 0;
    var f = fokus ? $(fokus, inhalt) : $('h3', inhalt);
    if (f) { if (!f.hasAttribute('tabindex') && f.tagName === 'H3') f.setAttribute('tabindex', '-1'); try { f.focus({ preventScroll: true }); } catch (e) {} }
  }

  var SCHUTZ = '<div class="ec-schutz"><b>Datenschutz.</b> DealPilot schwärzt Personendaten wie Namen, Geburtsdaten und Anschriften, bevor eine Unterlage ausgelesen wird. '
    + 'Für den Einzel-Check ist geplant, die Unterlagen nur auszulesen und nicht zu speichern. In dieser Demo wird nichts hochgeladen, gezeigt werden Beispieldaten.</div>';

  /* 1 · Unterlagen wählen */
  function zeigeUnterlagen() {
    stufe(0); var nr = ++schritt;
    setze('<h3 id="ecTitel">Bis zu vier Unterlagen, und DealPilot rechnet genauer.</h3>'
      + '<p class="ec-lead">Zum Beispiel Exposé, Mietaufstellung, Energieausweis und WEG-Protokoll. Jede Unterlage wird ausgelesen, jeder Wert landet an seiner Stelle, dann rechnet DealPilot deinen Deal neu.</p>'
      + '<div class="ec-ablage" role="group" aria-label="Beispielunterlagen">' + DOKS.map(function (d, i) {
        return '<label class="ec-dok"><input type="checkbox" data-i="' + i + '"' + (d.an !== false ? ' checked' : '') + (i === 0 ? ' disabled' : '') + '>'
          + '<span class="ec-dok-i" aria-hidden="true"></span><span><b>' + esc(d.art) + '</b><small>' + esc(d.datei) + ' · ' + d.seiten + (d.seiten === 1 ? ' Seite' : ' Seiten') + (i === 0 ? ' · immer dabei' : '') + '</small></span></label>';
      }).join('') + '</div>'
      + SCHUTZ
      + '<div class="ec-knoepfe"><button type="button" class="btn-p ec-los">Beispielunterlagen hochladen</button></div>', '.ec-los');
    $$('.ec-dok input', inhalt).forEach(function (c) { c.addEventListener('change', function () { DOKS[+c.dataset.i].an = c.checked; }); });
    $('.ec-los', inhalt).addEventListener('click', function () { if (nr === schritt) zeigeAuslesen(); });
  }

  /* 2 · Hochladen und Auslesen (animiert, Beispieldaten) */
  function zeigeAuslesen() {
    stufe(1); var nr = ++schritt, liste = DOKS.filter(function (d) { return d.an !== false; });
    setze('<h3 id="ecTitel">DealPilot liest deine Unterlagen.</h3><p class="ec-lead" aria-live="polite" id="ecStand">Hochladen …</p>'
      + '<div class="ec-lesen">' + liste.map(function (d, i) {
        return '<div class="ec-zeile" data-i="' + i + '"><div class="ec-z-kopf"><b>' + esc(d.art) + '</b><span class="ec-z-st">wartet</span></div>'
          + '<span class="ec-balken"><i></i></span><ul class="ec-felder">' + d.felder.map(function (f) { return '<li><span>' + esc(f[0]) + '</span><b>' + esc(f[1]) + '</b></li>'; }).join('')
          + (d.geschwaerzt ? '<li class="ec-schwarz"><span>' + esc(d.geschwaerzt) + '</span><b><i aria-hidden="true"></i>geschwärzt</b></li>' : '') + '</ul></div>';
      }).join('') + '</div>', 'h3');
    var kette = Promise.resolve();
    liste.forEach(function (d, i) {
      kette = kette.then(function () {
        if (nr !== schritt) return;
        var z = $('.ec-zeile[data-i="' + i + '"]', inhalt), b = $('.ec-balken i', z), st = $('.ec-z-st', z);
        z.classList.add('an'); st.textContent = 'lädt hoch'; $('#ecStand', inhalt).textContent = d.art + ' wird hochgeladen …';
        b.style.width = '100%';
        return warte(650).then(function () {
          if (nr !== schritt) return;
          st.textContent = 'liest aus'; $('#ecStand', inhalt).textContent = d.art + ' wird ausgelesen …'; z.classList.add('liest');
          return $$('li', z).reduce(function (p, li) { return p.then(function () { li.classList.add('da'); return warte(220); }); }, Promise.resolve());
        }).then(function () { if (nr !== schritt) return; z.classList.remove('liest'); z.classList.add('ok'); st.textContent = 'gelesen ✓'; return warte(200); });
      });
    });
    kette.then(function () {
      if (nr !== schritt) return;
      $('#ecStand', inhalt).textContent = 'Bewertet wird mit dem Rechenkern von DealPilot …';
      return warte(700).then(function () { if (nr === schritt) zeigeErgebnis(); });
    });
  }

  /* 3 · Deine Daten stehen bereit */
  function zeigeErgebnis() {
    stufe(2); ++schritt;
    var dc = window.DpDealCheck && DpDealCheck.letztes ? DpDealCheck.letztes() : null;
    var r = rechne(dc); ergebnis = r;
    var kern = r ? ('<div class="ec-urteil" data-farbe="' + esc(r.st.farbe) + '"><div class="ec-ring"><b>' + r.ds.score + '</b><small>/ 100</small></div>'
        + '<div><span class="ec-l">Grobe Einschätzung · Deal Score</span><div class="ec-wort">' + esc(r.st.wort) + '</div><p>' + esc(String(r.ds.interpretation || '').replace(/\s*[—–]\s*/g, ', ').replace(/;/g, ',')) + '</p></div></div>'
        + '<div class="ec-kz">'
        + '<div><span>Cashflow im Monat</span><b class="' + (r.k.cf_m < 0 ? 'neg' : 'pos') + '">' + (r.k.cf_m >= 0 ? '+' : '−') + eur(Math.abs(r.k.cf_m)) + '</b></div>'
        + '<div><span>Bruttorendite</span><b>' + dez(r.k.bmy, 2) + ' %</b></div>'
        + '<div><span>Nettorendite</span><b>' + dez(r.k.nmy, 2) + ' %</b></div>'
        + '<div><span>DSCR</span><b>' + (r.k.d_total > 0 ? dez(r.k.dscr, 2) : 'entfällt') + '</b></div></div>'
        + '<p class="ec-annahme">Beispielobjekt aus den Beispielunterlagen. Finanzierung wie im Deal-Check: ' + eur(r.ek) + ' Eigenkapital (10 %), '
        + dez(r.zins, 2) + ' % Zins' + (r.bindung ? ' bei ' + r.bindung + ' Jahren Zinsbindung' : '') + ', ' + dez(r.tilg, 2) + ' % Tilgung. '
        + (r.mitWeg ? 'Nicht umlagefähige Kosten aus dem WEG-Protokoll.' : 'Ohne WEG-Protokoll rechnet DealPilot mit 17 % der Kaltmiete als nicht umlagefähige Kosten.') + '</p>')
      : '<p class="ec-lead">Die Rechenkerne sind gerade nicht geladen. Lade die Seite neu und prüfe zuerst im Deal-Check.</p>';
    var hinweisDc = dc ? '' : '<p class="ec-annahme">Tipp: Mit einem Deal-Check vorher übernimmt die Einschätzung deine Zinsbindung und Tilgung.</p>';
    setze('<h3 id="ecTitel">Deine Daten stehen bereit.</h3>' + kern + hinweisDc
      + '<div class="ec-wege" role="list">'
      + '<div class="ec-weg ec-weg-1" role="listitem"><span class="ec-l">Weg 1 · einmal kaufen</span><b>Kurzbericht als PDF</b><p>Marktbericht und Bewertung in Kurzform, im Aufbau der DealPilot-Dokumente.</p>'
      + '<div class="ec-preis">' + preis() + '<small>einmalig, kein Abo</small></div><p class="ec-fein">Demo-Text: Wird beim Buchen eines Pakets innerhalb von ' + ANRECHNUNG_TAGE + ' Tagen angerechnet.</p>'
      + '<button type="button" class="btn-p ec-kaufen">Kurzbericht kaufen</button></div>'
      + '<div class="ec-weg" role="listitem"><span class="ec-l">Weg 2 · weitermachen</span><b>In DealPilot weiterrechnen</b><p>Paket buchen, Objekt anlegen, Steuer, Finanzierung und Wert im Detail.</p>'
      + '<a class="btn-l ec-paket" href="preise.html">Pakete ansehen</a></div>'
      + '<div class="ec-weg" role="listitem"><span class="ec-l">Weg 3 · ausprobieren</span><b>Kostenlos starten</b><p>Vier Wochen voller Pro-Umfang, ohne Zahlungsdaten, danach automatisch Free.</p>'
      + '<a class="btn-l ec-frei" href="' + appUrl('?register=1') + '">Kostenlos starten</a></div>'
      + '</div>', 'h3');
    $('.ec-kaufen', inhalt).addEventListener('click', zeigeKasse);
  }

  /* 4 · Demo-Kasse (im Stil einer Bezahlseite, ohne Kartenfelder) */
  function zeigeKasse() {
    stufe(3); var nr = ++schritt;
    setze('<div class="ec-kasse"><div class="ec-k-links"><span class="ec-l">DealPilot · Junker Solution</span><h3 id="ecTitel">Einzel-Check Kurzbericht</h3>'
      + '<div class="ec-k-preis">' + preis() + '</div><p>Einmalzahlung, kein Abo. Marktbericht und Bewertung in Kurzform als PDF, für das Objekt aus deinen Unterlagen.</p>'
      + '<p class="ec-fein">Demo-Text: Wird beim Buchen eines Pakets innerhalb von ' + ANRECHNUNG_TAGE + ' Tagen angerechnet.</p></div>'
      + '<div class="ec-k-rechts"><div class="ec-k-band" role="note">Demo-Kasse. Hier wird nichts bezahlt, es gibt keine Kartenfelder und keine Verbindung zu einem Zahlungsanbieter.</div>'
      + '<div class="ec-k-feld" aria-hidden="true"><span>E-Mail</span><i></i></div><div class="ec-k-feld" aria-hidden="true"><span>Zahlungsart</span><i></i><i></i></div>'
      + '<button type="button" class="btn-p ec-zahlen">Demo-Zahlung abschließen · ' + preis() + '</button>'
      + '<button type="button" class="ec-zurueck">Zurück zum Ergebnis</button></div></div>', '.ec-zahlen');
    $('.ec-zahlen', inhalt).addEventListener('click', function () {
      var b = this; b.disabled = true; b.textContent = 'Demo-Zahlung läuft …';
      warte(1100).then(function () { if (nr === schritt) zeigeBericht(); });
    });
    $('.ec-zurueck', inhalt).addEventListener('click', zeigeErgebnis);
  }

  /* 5 · Kurzbericht, Vorschau im Aufbau der DealPilot-Dokumente (dp-dokument.js) */
  function zeigeBericht() {
    stufe(3); ++schritt;
    var r = ergebnis, heute = new Date(), dat = ('0' + heute.getDate()).slice(-2) + '.' + ('0' + (heute.getMonth() + 1)).slice(-2) + '.' + heute.getFullYear();
    function kopf(t) { return '<div class="ec-p-kopf"><strong>Deal<b>Pilot</b></strong><span>Einzel-Check · Kurzbericht · ' + esc(t) + '<br>Beispielobjekt · Demo</span></div>'; }
    function fuss() { return '<div class="ec-p-fuss"><span>DealPilot · Junker Solution</span><span>Einzel-Check · Stand ' + dat + '</span></div>'; }
    var kz = r ? '<div class="ec-p-kz">'
      + '<div class="' + (r.ds.score >= 70 ? 'gut' : '') + '"><div class="l">Deal Score</div><div class="v">' + r.ds.score + ' / 100</div><div class="s">' + esc(r.st.wort) + '</div></div>'
      + '<div class="' + (r.k.cf_m < 0 ? 'schlecht' : 'gut') + '"><div class="l">Cashflow</div><div class="v">' + (r.k.cf_m >= 0 ? '+' : '−') + eur(Math.abs(r.k.cf_m)) + '</div><div class="s">im Monat vor Steuern</div></div>'
      + '<div><div class="l">Bruttorendite</div><div class="v">' + dez(r.k.bmy, 2) + ' %</div><div class="s">Faktor ' + dez(r.k.fak, 1) + '</div></div>'
      + '<div><div class="l">DSCR</div><div class="v">' + (r.k.d_total > 0 ? dez(r.k.dscr, 2) : 'entfällt') + '</div><div class="s">Kapitaldienstdeckung</div></div></div>' : '';
    var gesperrt = function (t) { return '<span class="ec-p-zu" aria-label="im gekauften Bericht">' + esc(t) + '</span>'; };
    setze('<h3 id="ecTitel">Dein Kurzbericht, Vorschau.</h3><p class="ec-lead">So sieht der Kurzbericht aus. In der Demo mit dem Beispielobjekt, die amtlichen Werte stehen erst im echten Bericht.</p>'
      + '<div class="ec-papier">'
      /* Deckblatt */
      + '<section class="ec-seite ec-deck"><div class="ec-p-bild" style="background-image:url(assets/bild/haus.jpg)"><span class="ec-p-logo">Deal<b>Pilot</b></span></div>'
      + '<div class="ec-p-in"><div class="ec-p-eye">Einzel-Check · Kurzbericht</div><h4>Eigentumswohnung, Beispielobjekt</h4><div class="ec-p-adr">100 m² Wohnfläche · Kaufpreis 180.000 €</div>'
      + '<div class="ec-p-wertbox"><div><div class="ec-p-lbl">Indikativer Marktwert</div><div class="ec-p-wert">' + gesperrt('000.000 €') + '</div></div><div class="ec-p-neben">Aus Vergleichswert, Ertragswert und Sachwert nach ImmoWertV, mit Herkunft je Zahl.</div></div>'
      + '<div class="ec-p-meta"><div><b>Unterlagen</b>' + DOKS.filter(function (d) { return d.an !== false; }).length + ' gelesen</div><div><b>Stand</b>' + dat + '</div><div><b>Art</b>Kurzfassung</div></div></div>'
      + '<div class="ec-wasser" aria-hidden="true">DEMO</div></section>'
      /* Seite 2 */
      + '<section class="ec-seite">' + kopf('Überblick') + '<div class="ec-p-eye">Abschnitt 1</div><h5>Kennzahlen</h5>' + kz
      + '<table class="ec-p-tab"><thead><tr><th>Position</th><th class="r">Betrag</th></tr></thead><tbody>'
      + (r ? '<tr><td>Kaufpreis</td><td class="r">' + eur(r.S.kp) + '</td></tr><tr><td>Kaufnebenkosten (' + dez(r.S.nk_pct, 1) + ' %)</td><td class="r">' + eur(r.nk) + '</td></tr>'
        + '<tr><td>Darlehen</td><td class="r">' + eur(r.d1) + '</td></tr><tr><td>Kaltmiete im Jahr</td><td class="r">' + eur(r.S.nkm * 12) + '</td></tr>'
        + '<tr><td>Nicht umlagefähige Kosten im Jahr</td><td class="r">' + eur(r.bwkNul) + '</td></tr>' : '')
      + '</tbody></table>' + fuss() + '<div class="ec-wasser" aria-hidden="true">DEMO</div></section>'
      /* Seite 3 */
      + '<section class="ec-seite">' + kopf('Markt und Bewertung') + '<div class="ec-p-eye">Abschnitt 2</div><h5>Markt und Bewertung in Kurzform</h5>'
      + '<table class="ec-p-tab"><thead><tr><th>Kennzahl</th><th class="r">Wert</th><th>Herkunft</th></tr></thead><tbody>'
      + '<tr><td>Lage und Makrolage</td><td class="r">' + gesperrt('00 / 100') + '</td><td class="q">amtliche Statistik</td></tr>'
      + '<tr><td>Bodenrichtwert</td><td class="r">' + gesperrt('000 €/m²') + '</td><td class="q">Gutachterausschuss</td></tr>'
      + '<tr><td>Vergleichsmiete</td><td class="r">' + gesperrt('00,00 €/m²') + '</td><td class="q">Mietspiegel oder Näherung</td></tr>'
      + '<tr><td>Liegenschaftszinssatz</td><td class="r">' + gesperrt('0,0 %') + '</td><td class="q">Gutachterausschuss</td></tr>'
      + '<tr><td>Ertragswert</td><td class="r">' + gesperrt('000.000 €') + '</td><td class="q">ImmoWertV</td></tr>'
      + '<tr><td>Sachwert</td><td class="r">' + gesperrt('000.000 €') + '</td><td class="q">ImmoWertV</td></tr>'
      + '</tbody></table><div class="ec-p-hinweis">Jede Zahl nennt ihre Herkunft. Fehlt eine amtliche Zahl, erfindet DealPilot keine, sondern nennt den zuständigen Ausschuss und den Weg zur Quelle.</div>'
      + fuss() + '<div class="ec-wasser" aria-hidden="true">DEMO</div></section>'
      + '</div>'
      + '<div class="ec-knoepfe"><a class="btn-p" href="' + appUrl('?register=1') + '">In DealPilot weitermachen</a><button type="button" class="btn-l ec-zurueck">Zurück zum Ergebnis</button></div>', 'h3');
    $('.ec-zurueck', inhalt).addEventListener('click', zeigeErgebnis);
  }

  /* ── Einstieg am Ende des Deal-Check-Ergebnisses ──────────────────── */
  function knopf() {
    var erg = document.getElementById('dcErg');
    if (!erg || $('.ec-einstieg', erg)) return;
    var nach = document.getElementById('dcAnnahme') || document.getElementById('dcLos');
    var d = document.createElement('div'); d.className = 'ec-einstieg';
    d.innerHTML = '<button type="button" class="ec-start">Unterlagen hochladen und genauer prüfen <span aria-hidden="true">→</span></button><small>Einzel-Check · Demo, nur auf Staging sichtbar</small>';
    if (nach && nach.parentNode === erg) erg.insertBefore(d, nach.nextSibling); else erg.appendChild(d);
    $('.ec-start', d).addEventListener('click', auf);
  }
  document.addEventListener('dp:dealcheck-ergebnis', knopf);
  knopf();
  window.DpEinzelCheck = { auf: auf, zu: zu, rechne: rechne, preis: EINZELCHECK_PREIS_EUR };
})();
