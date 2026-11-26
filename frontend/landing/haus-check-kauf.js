/* haus-check-kauf.js · v5130 KK6 · Landing: Haus-Check kaufen (9,99 €) und den fertigen Bericht als PDF holen.
   Kaufweg wie der Einzel-Check: POST /public/hauscheck/kaufen -> Stripe Checkout -> zurück mit #hc=<token> im Fragment
   -> /status (bezahlt?) -> /bericht (Wert Stufe 3, Beleihungswert § 4 Abs. 2, Umfeld) -> PDF im Browser gebaut
   (js/haus-check-ablauf.js) und vom PDF-Dienst gedruckt (/pdf).
   Das Netto-Einkommen geht NIE an den Server: es liegt für den Rückweg von Stripe nur in sessionStorage dieses Tabs. */
(function () {
  'use strict';
  var karte = document.querySelector('.eg-karte'); if (!karte) return;
  var host = location.hostname;
  var API = (/^app\./.test(host) || host === 'localhost' ? location.origin : (/staging/.test(host) ? 'https://app.staging.dealpilot.immo' : 'https://app.dealpilot.immo')) + '/api/v1/public/hauscheck';
  var MERK = 'dp_hc_eingaben';
  function $(id) { return document.getElementById(id); }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function zahl(id) { var el = $(id); return el ? (Number(String(el.value).replace(/\./g, '').replace(',', '.')) || 0) : 0; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function post(pfad, body) {
    return fetch(API + pfad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }
  var css = document.createElement('style');
  css.textContent =
    '.hc-kauf{margin:16px 0 0;padding:14px 16px;border-radius:12px;border:1px solid color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 45%,transparent);background:rgba(255,255,255,.04)}' +
    '.hc-kauf h4{margin:0 0 4px;font:700 15px/1.3 var(--disp,"Space Grotesk",sans-serif);color:#fff}' +
    '.hc-kauf p{margin:0 0 10px;font:400 12.5px/1.5 var(--body,Inter,sans-serif);color:rgba(236,230,214,.72)}' +
    '.hc-kauf ul{margin:0 0 10px 18px;padding:0;font:400 12.5px/1.6 var(--body,Inter,sans-serif);color:rgba(236,230,214,.8)}' +
    '.hc-kauf label{display:flex;gap:8px;align-items:flex-start;font:400 12px/1.45 var(--body,Inter,sans-serif);color:rgba(236,230,214,.72);margin:0 0 10px}' +
    '.hc-kauf button{appearance:none;border:0;border-radius:10px;padding:11px 16px;font:700 14px var(--disp,"Space Grotesk",sans-serif);cursor:pointer;' +
      'background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#050505;margin:0 8px 8px 0}' +
    '.hc-kauf button.zweit{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.25)}' +
    '.hc-kauf button[disabled]{opacity:.5;cursor:default}' +
    '.hc-kauf .hc-fehler{color:#E08A7E}';
  document.head.appendChild(css);

  function eingaben() {
    var str = ($('egStr') || {}).value || '';
    return { kp: zahl('egKp'), wfl: zahl('egWfl'), gsfl: zahl('egGsfl'), bj: zahl('egBj'), ek: zahl('egEk'), netto: zahl('egNetto'),
      plz: (($('egPlz') || {}).value || '').trim(), objektart: ($('egArt') || {}).value || 'efh', str: str.trim() };
  }
  function setzeFelder(e) {
    var map = { egKp: e.kp, egWfl: e.wfl, egGsfl: e.gsfl, egBj: e.bj, egEk: e.ek, egNetto: e.netto, egPlz: e.plz, egArt: e.objektart, egStr: e.str };
    Object.keys(map).forEach(function (id) { var el = $(id); if (el && map[id] != null && map[id] !== '') el.value = typeof map[id] === 'number' ? map[id].toLocaleString('de-DE') : map[id]; });
  }

  var preisText = '9,99 €';
  fetch(API + '/preis').then(function (r) { return r.ok ? r.json() : null; }).then(function (p) {
    if (p && p.amount_cents) preisText = (p.amount_cents / 100).toFixed(2).replace('.', ',') + ' €';
    var b = $('hcKaufen'); if (b) b.textContent = 'Haus-Check kaufen · ' + preisText;
  }).catch(function () {});

  function kaufBox() {
    var erg = $('egErg'); if (!erg || $('hcKauf')) return;
    var e = eingaben();
    if (e.objektart === 'mfh') return;
    var box = document.createElement('div'); box.className = 'hc-kauf'; box.id = 'hcKauf';
    box.innerHTML = '<h4>Der ganze Haus-Check als PDF</h4>'
      + '<p>Für dich und für das Gespräch mit der Bank. Einmalig, ohne Abo.</p>'
      + '<ul><li>Wert nach ImmoWertV mit Rechenweg aus den Daten des Gutachterausschusses</li><li>Indikativer Beleihungswert und Haushaltsrechnung</li>'
      + '<li>Zustand, Umfeld und Unterlagenliste für die Bank</li></ul>'
      + (e.str && (e.objektart === 'etw' || e.gsfl > 0) ? '' : '<p>Für den Wert braucht es die Straße mit Hausnummer' + (e.objektart === 'etw' ? '' : ' und die Grundstücksfläche') + '.</p>')
      + '<label><input type="checkbox" id="hcWv"> Ich möchte, dass der Bericht sofort entsteht. Mir ist bekannt, dass mein Widerrufsrecht damit erlischt.</label>'
      + '<button type="button" id="hcKaufen">Haus-Check kaufen · ' + preisText + '</button><div class="hc-msg" id="hcMsg"></div>';
    erg.appendChild(box);
    $('hcKaufen').addEventListener('click', kaufen);
  }
  function meldung(t, fehler) { var m = $('hcMsg'); if (m) { m.className = 'hc-msg' + (fehler ? ' hc-fehler' : ''); m.innerHTML = '<p' + (fehler ? ' class="hc-fehler"' : '') + '>' + esc(t) + '</p>'; } }

  function kaufen() {
    var e = eingaben();
    if (!$('hcWv').checked) return meldung('Bitte bestätige zuerst das Häkchen zum Widerrufsrecht.', true);
    if (!(e.kp > 0 && e.wfl > 0 && e.bj > 0 && /^\d{5}$/.test(e.plz))) return meldung('Bitte Kaufpreis, Wohnfläche, Baujahr und Postleitzahl eintragen.', true);
    if (e.objektart !== 'etw' && !(e.gsfl > 0)) return meldung('Bitte die Grundstücksfläche eintragen. Ohne sie fehlt der Bodenwert und damit der Wert des Hauses.', true);
    $('hcKaufen').disabled = true; meldung('Weiter zur Zahlung …');
    ss(MERK, JSON.stringify(e));
    post('/kaufen', { widerruf_verzicht: true, rueckweg: location.pathname,
      grund: { kp: e.kp, wfl: e.wfl, gsfl: e.gsfl || undefined, bj: e.bj, art: String(e.objektart).toUpperCase(), ek_eur: e.ek || 0, plz: e.plz } })
      .then(function (j) {
        if (j && j.url) { location.href = j.url; return; }
        $('hcKaufen').disabled = false; meldung((j && j.error) || 'Der Kauf ging gerade nicht. Bitte noch einmal.', true);
      }).catch(function () { $('hcKaufen').disabled = false; meldung('Der Kauf ging gerade nicht. Bitte noch einmal.', true); });
  }

  /* Nach dem Ergebnis die Kaufbox anhängen (das Ergebnis baut demo-eigennutzer-landing-ui.js neu) */
  var erg = $('egErg');
  if (erg && window.MutationObserver) new MutationObserver(function () { if (erg.querySelector('.eg-zusatz') && !$('hcKauf') && !token()) kaufBox(); }).observe(erg, { childList: true, subtree: true });

  /* ── Rückweg von Stripe: #hc=<token> ── */
  function token() { var m = /(?:^#|&)hc=([A-Za-z0-9_-]{40,60})/.exec(location.hash || ''); return m ? m[1] : null; }
  function warteBezahlt(t, n) {
    return post('/status', { token: t }).then(function (s) {
      if (s && s.bezahlt) return s;
      if (s && (s.status === 'abgelaufen' || s._status === 404)) throw new Error(s.status === 'abgelaufen' ? 'Der Kauf ist abgelaufen.' : 'Der Kauf ist unbekannt.');
      if (n <= 0) throw new Error('Die Zahlung ist noch nicht bestätigt. Bitte die Seite in einer Minute neu laden.');
      return new Promise(function (ok) { setTimeout(ok, 3000); }).then(function () { return warteBezahlt(t, n - 1); });
    });
  }
  function fertigBox(t, e) {
    var box = $('hcKauf'); if (!box) { kaufBox(); box = $('hcKauf'); }
    if (!box) return;
    box.innerHTML = '<h4>Dein Haus-Check</h4><div id="hcMsg"></div>';
    meldung(/abbruch/.test(location.search) ? 'Die Zahlung wurde abgebrochen.' : 'Zahlung wird geprüft …', /abbruch/.test(location.search));
    if (/abbruch/.test(location.search)) return;
    var E = window.DpEigennutzerKern, A = window.DpHausCheckAblauf;
    var d = null, html = null;
    warteBezahlt(t, 10).then(function () {
      meldung('Bezahlt. Wert, Beleihungswert und Umfeld werden gerechnet, das dauert bis zu einer Minute …');
      return E.daten(e.plz, e.bj, e.wfl);
    }).then(function (dd) {
      d = dd;
      var vor = E.rechne({ kp: e.kp, wfl: e.wfl, bj: e.bj, ek: e.ek, netto: e.netto, plz: e.plz, objektart: e.objektart }, d);
      var adresse = (e.str ? e.str + ', ' : '') + e.plz + ' ' + String(d.gebiet || '').replace(/,.*$/, '');
      return post('/bericht', { token: t, adresse: adresse, darlehen: vor && vor.darlehen }).then(function (b) {
        if (!b || b._status >= 400) throw new Error((b && b.error) || 'Der Bericht ging gerade nicht.');
        return A.html({ e: { kp: e.kp, wfl: e.wfl, bj: e.bj, ek: e.ek, netto: e.netto, plz: e.plz, objektart: e.objektart }, d: d, bericht: b, adresse: adresse });
      });
    }).then(function (erg) {
      html = erg.html;
      box.innerHTML = '<h4>Dein Haus-Check ist fertig</h4><p>Haus-Score ' + erg.haus.haus.score + ' von 100, ' + esc(erg.haus.haus.stufe.wort) + '. Der Kauf gilt 14 Tage, der Bericht lässt sich bis zu dreimal neu erzeugen.</p>'
        + '<button type="button" id="hcPdf">PDF herunterladen</button><button type="button" class="zweit" id="hcAnsehen">Im Browser ansehen</button><div id="hcMsg"></div>';
      $('hcAnsehen').addEventListener('click', function () { window.DpDokument.vorschau(html, 'Haus-Check'); });
      $('hcPdf').addEventListener('click', function () {
        var btn = $('hcPdf'); btn.disabled = true; meldung('PDF wird erzeugt …');
        fetch(API + '/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t, html: html, titel: (e.str ? e.str + ', ' : '') + e.plz }) })
          .then(function (r) { if (!r.ok) throw new Error('pdf'); return r.blob(); })
          .then(function (blob) { A.laden(blob, 'DealPilot Haus-Check ' + e.plz + '.pdf'); meldung('Gespeichert.'); })
          .catch(function () { meldung('Das PDF ging gerade nicht. Im Browser ansehen und dort drucken geht immer.', true); })
          .then(function () { btn.disabled = false; });
      });
    }).catch(function (err) { meldung(err && err.message ? err.message : 'Das hat nicht geklappt.', true); });
  }
  function rueckweg() {
    var t = token(); if (!t) return;
    var e = null; try { e = JSON.parse(ss(MERK) || 'null'); } catch (x) { e = null; }
    if (!e) {
      /* anderer Tab oder Gerät: die Grundangaben stehen beim Kauf, das Einkommen nicht */
      post('/status', { token: t }).then(function (s) {
        var z = (s && s.zahlen) || {};
        e = { kp: z.kp, wfl: z.wfl, gsfl: z.gsfl, bj: z.bj, ek: z.ek_eur, netto: 0, plz: z.plz, objektart: String(z.art || 'EFH').toLowerCase(), str: '' };
        weiter(e, t);
      });
      return;
    }
    weiter(e, t);
  }
  function weiter(e, t) {
    setzeFelder(e);
    if (window.DemoEgSetze) window.DemoEgSetze('selbst');
    var sec = document.getElementById('dealcheck'); if (sec) sec.scrollIntoView();
    var s = $('egStart'); if (s) s.click();
    var tries = 0, w = setInterval(function () {
      if (($('egErg') && $('egErg').querySelector('.eg-zusatz')) || ++tries > 40) { clearInterval(w); fertigBox(t, e); }
    }, 250);
  }
  /* Kern, Dokument und UI kommen per async=false davor, die Seite ist dann fertig */
  if (document.readyState === 'complete') rueckweg(); else window.addEventListener('load', rueckweg);
})();
