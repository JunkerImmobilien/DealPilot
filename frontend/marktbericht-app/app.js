/* W40-pdf-svg: Whitelabel-Farbe als Hex zur Laufzeit. Ein Hex ist ueberall
   gueltig — in SVG-Praesentationsattributen, in CSS, in Leaflet. var() ist es
   nicht. Genau daran ist W36 hier gescheitert. */
if (!window._wlc) {
  window._wlc = function (h) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--wl-' + h.slice(1).toLowerCase());
      v = (v || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    } catch (e) {}
    return h;
  };
}
if (!window._wlrgbaH) {
  window._wlrgbaH = function (h, a) {
    var c = window._wlc(h);
    return 'rgba(' + parseInt(c.substr(1, 2), 16) + ',' + parseInt(c.substr(3, 2), 16) + ',' + parseInt(c.substr(5, 2), 16) + ',' + a + ')';
  };
}
/* W40-pdf-svg: jsPDF kennt kein CSS — dort stehen RGB-Tripel. Im Hauptdokument
   liefert pdf.js seine Palette (W1) und _dpPdfSetAccent() mutiert C.GOLD in
   place. Im Marktbericht-iframe gibt es pdf.js nicht — dort faellt die Funktion
   auf --wl-c9a84c zurueck, das die Bruecke aus W36 setzt.
   Ohne Whitelabel: [201,168,76], also unveraendert. */
if (!window._pdfGold) {
  window._pdfGold = function () {
    try {
      var c = window._dpPdfColors;
      if (c && c.GOLD && c.GOLD.length === 3) return [c.GOLD[0], c.GOLD[1], c.GOLD[2]];
    } catch (e) {}
    try {
      var v = (getComputedStyle(document.documentElement).getPropertyValue('--wl-c9a84c') || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) {
        return [parseInt(v.substr(1, 2), 16), parseInt(v.substr(3, 2), 16), parseInt(v.substr(5, 2), 16)];
      }
    } catch (e) {}
    return [201, 168, 76];
  };
}
/* W36-wl-token: Whitelabel-Farbe zur Laufzeit.
   Canvas und SVG-Praesentationsattribute verstehen kein var().
   _wlrgbaH(hex, alpha) ist neu: die Partikel brauchen auch var(--wl-e8c766, #E8C766) als rgba,
   nicht nur das Basisgold. Eigener Guard, damit es sich neben dem schon
   ausgelieferten _wlrgba(alpha) installiert. */
if (!window._wlc) {
  window._wlc = function (h) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--wl-' + h.slice(1).toLowerCase());
      v = (v || '').trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    } catch (e) {}
    return h;
  };
}
if (!window._wlrgbaH) {
  window._wlrgbaH = function (h, a) {
    var c = window._wlc(h);
    return 'rgba(' + parseInt(c.substr(1, 2), 16) + ',' + parseInt(c.substr(3, 2), 16) + ',' + parseInt(c.substr(5, 2), 16) + ',' + a + ')';
  };
}
// app.js — Dashboard-Logik (Vanilla JS, kein Build-Step; passt zu DealPilot).
const API = '/api/v1/marktbericht';

/* v945-scroll
 * ──────────────────────────────────────────────────────────────────────────
 * window.scrollTo() ist hier ZWEIMAL wirkungslos:
 *   1. `window` ist das iframe-Dokument. marktbericht-view.js:93 setzt
 *      fr.style.height auf die volle Inhaltshoehe -> das iframe hat gar keine
 *      Scrollleiste, scrollTop bleibt 0.
 *   2. Selbst im Elterndokument wuerde es nichts tun: html/body haben dort
 *      overflow:hidden. Der echte Scroll-Container ist .main-col (V236).
 * Deshalb reden wir mit der Elternseite — same-origin, direkter Aufruf;
 * postMessage als zweites Netz (Muster: 'mbv-close', app.js unten).
 * Standalone (ohne iframe) bleibt window.scrollTo als letzter Rueckfall.
 */
function _mbScrollTop() {
  try {
    if (window.parent && window.parent !== window && typeof window.parent._v236ScrollTop === 'function') {
      window.parent._v236ScrollTop();
      return;
    }
  } catch (e) {}
  try { if (window.parent && window.parent !== window) { parent.postMessage({ type: 'mbv-scrolltop' }, '*'); return; } } catch (e) {}
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
}
let map, marker, compLayer, chart;

const $ = (id) => document.getElementById(id);
const fmt = (n, s = '') => (n == null || isNaN(n) ? '–' : new Intl.NumberFormat('de-DE').format(n) + s);

// Health
fetch(API + '/health').then(r => r.json()).then(h => {
  $('healthPill').textContent = h.db ? 'Bereit' : 'Eingeschränkt'; /* v564-chips-progress */
  renderChips(h);
}).catch(() => { $('healthPill').textContent = 'Backend nicht erreichbar'; });

function renderChips(h) {
  /* v564-chips-progress: Anbieter-Chips bewusst ausgeblendet (keine Quellen-Offenlegung). */
  var el = $('srcChips'); if (el) el.innerHTML = '';
}

$('goBtn').addEventListener('click', generate);
// Replay: gespeicherten Bericht laden (keine API-Kosten) – fürs Weiterentwickeln/Designen.
$('replayBtn').addEventListener('click', async () => {
  const btn = $('replayBtn');
  $('errBox').classList.add('hide');
  btn.disabled = true; btn.textContent = '↺ lade…';
  try {
    const res = await fetch(API + '/reports/replay');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Kein gespeicherter Bericht');
    render(data);
  } catch (err) {
    $('errBox').textContent = '✗ ' + err.message; $('errBox').classList.remove('hide');
  } finally {
    btn.disabled = false; btn.textContent = '↺ Letzten Bericht laden (gratis, Demo)';
  }
});

/* v942-mbrep
 * ──────────────────────────────────────────────────────────────────────────
 * EINE Quelle fuer den Objektbezug. Bis v941 gab es zwei, die nichts
 * voneinander wussten: app.js las nur ?ref aus der URL, mb-objektwahl.js warf
 * die gewaehlte id weg. Ergebnis: ueber das Dropdown erzeugte Berichte hatten
 * gar keinen Objektbezug.
 */
/* v951-checkup
 * ──────────────────────────────────────────────────────────────────────────
 * Plausibilitaet der Eingaben. Die Leiste "Genauigkeit" (app.js:2584) zaehlt
 * bereits, was FEHLT — hier geht es darum, ob das Vorhandene zueinander passt.
 *
 * Real auf Prod: Kaltmiete 1.800 EUR auf 100 m² = 18,00 EUR/m², Marktmiete laut
 * Bericht 6,86 EUR/m². Faktor 2,6. Der Bericht wurde klaglos erzeugt — 5 L fuer
 * eine Zahl, die vermutlich ein Tippfehler war.
 *
 * Die Grenzen sind bewusst WEIT. Ein Checkup, der bei jedem zweiten Objekt
 * anschlaegt, wird weggeklickt und ist damit schlechter als keiner. Er soll das
 * Grobe fangen: vertauschte Felder, Tippfehler, Warmmiete statt Kaltmiete.
 * Nichts blockiert — der Nutzer entscheidet, er sieht nur was er tut.
 */
function _mbCheckup() {
  var n = function (id) { var e = $(id); if (!e) return null; var v = parseFloat(String(e.value).replace(/\./g, '').replace(',', '.')); return isFinite(v) && v > 0 ? v : null; };
  var s = function (id) { var e = $(id); return e ? String(e.value || '').trim() : ''; };
  var W = [], jetzt = new Date().getFullYear();

  var wfl = n('area'), bj = n('year'), zi = n('rooms'), kp = n('price'), miete = n('rent');
  var mod = n('modyear'), plot = n('plot'), etage = $('floor') ? parseFloat($('floor').value) : null;
  var pt = s('ptype');
  var istHaus = /EFH|DHH|RH|MFH|ZFH/i.test(pt);

  if (bj && (bj < 1700 || bj > jetzt + 2))
    W.push('Baujahr ' + bj + ' — bitte prüfen.');
  if (bj && mod && mod < bj)
    W.push('Modernisierung ' + mod + ' liegt vor dem Baujahr ' + bj + '.');
  if (mod && mod > jetzt + 1)
    W.push('Modernisierungsjahr ' + mod + ' liegt in der Zukunft.');
  if (wfl && (wfl < 15 || wfl > 600))
    W.push('Wohnfläche ' + wfl + ' m² — bitte prüfen.');
  if (wfl && zi) {
    var qz = wfl / zi;
    if (qz < 10) W.push('Nur ' + qz.toFixed(0) + ' m² je Zimmer (' + wfl + ' m² auf ' + zi + ' Zimmer) — bitte prüfen.');
    if (qz > 80) W.push(qz.toFixed(0) + ' m² je Zimmer (' + wfl + ' m² auf ' + zi + ' Zimmer) — bitte prüfen.');
  }
  if (wfl && miete) {
    var qm = miete / wfl;
    if (qm < 2) W.push('Kaltmiete ' + qm.toFixed(2).replace('.', ',') + ' €/m² — ungewöhnlich niedrig. Ist das die Monatsmiete?');
    if (qm > 30) W.push('Kaltmiete ' + qm.toFixed(2).replace('.', ',') + ' €/m² — ungewöhnlich hoch. Warmmiete oder Jahresmiete eingetragen?');
  }
  if (wfl && kp) {
    var qk = kp / wfl;
    if (qk < 300) W.push('Kaufpreis ' + Math.round(qk).toLocaleString('de-DE') + ' €/m² — ungewöhnlich niedrig.');
    if (qk > 20000) W.push('Kaufpreis ' + Math.round(qk).toLocaleString('de-DE') + ' €/m² — ungewöhnlich hoch.');
  }
  if (kp && miete) {
    var fak = kp / (miete * 12);
    if (fak < 8) W.push('Kaufpreisfaktor ' + fak.toFixed(1).replace('.', ',') + ' — sehr niedrig. Kaufpreis und Miete vertauscht?');
    if (fak > 60) W.push('Kaufpreisfaktor ' + fak.toFixed(1).replace('.', ',') + ' — sehr hoch. Ist die Miete monatlich?');
  }
  if (!istHaus && plot)
    W.push('Grundstücksfläche bei einer Wohnung — die fließt nur bei Häusern in die Bewertung ein.');
  if (istHaus && plot && wfl && plot < wfl * 0.5)
    W.push('Grundstück (' + plot + ' m²) kleiner als die halbe Wohnfläche (' + wfl + ' m²) — bitte prüfen.');
  if (istHaus && etage > 0)
    W.push('Etage bei einem Haus angegeben — wird ignoriert.');
  if (etage > 30)
    W.push('Etage ' + etage + ' — bitte prüfen.');

  return W;
}

function _mbRef() {
  if (window._mbwRef) return String(window._mbwRef);
  try { return new URLSearchParams(location.search).get('ref') || null; } catch (e) { return null; }
}

/* ═══ v1187 · Kaufangebot statt Sackgasse ══════════════════════════════
   Wird gerufen, wenn der Server mit 402 antwortet: die faellige
   Bewertungsart ist aufgebraucht. Der Nutzer soll genau die eine
   nachkaufen koennen, die ihm fehlt — Marcels Vorgabe aus v1176: „der
   Knopf, an dem gerade eine Bewertung fehlt, verkauft genau diese eine."

   DIE PREISE KOMMEN AUS `/credits/bewertungen`, also aus Stripe. Diese
   Seite laedt `config.js` nicht, und ein zweiter Satz Preise im Quelltext
   waere die fuenfte Kopie derselben Zahlen. Ist der Katalog nicht
   erreichbar, wird ohne Betrag angeboten — ein Kauf ohne Preisangabe ist
   besser als eine Sackgasse, und der Betrag steht im Stripe-Fenster
   ohnehin noch einmal. */
var _ART_NAME = {
  mpi:      'Marktpreisindikation',
  mpi_plus: 'erweiterte Marktpreisindikation',
  wev:      'Wertermittlung nach ImmoWertV'
};

function _euroText(cent) {
  if (typeof cent !== 'number' || !isFinite(cent)) return '';
  return (cent / 100).toFixed(2).replace('.', ',') + ' €';
}

async function _zeigeKaufAngebot(d) {
  var art  = (d && d.art) || '';
  var name = _ART_NAME[art] || 'Bewertung';
  var box  = $('errBox');
  if (!box) return;

  var preis = '';
  try {
    var kr = await fetch('/api/v1/credits/bewertungen', { headers: _mbAuth() });
    if (kr.ok) {
      var kat = await kr.json();
      var e = kat && kat.katalog && kat.katalog[art];
      if (e) preis = _euroText(e.amount_cents);
    }
  } catch (e) { /* ohne Betrag anbieten, siehe oben */ }

  box.innerHTML =
    '<div style="font-weight:600;margin-bottom:6px;">' +
      '⚠ Keine ' + name + ' mehr frei.' +
    '</div>' +
    '<div style="font-size:13px;line-height:1.5;margin-bottom:10px;">' +
      'Dein Monatskontingent für diese Bewertungsart ist aufgebraucht. ' +
      'Du kannst genau diese eine nachkaufen — sie verfällt nicht.' +
    '</div>' +
    '<button type="button" id="mbKaufBtn" data-art="' + art + '" ' +
      'style="cursor:pointer;border:0;border-radius:9px;padding:10px 16px;font-weight:700;' +
      'background:linear-gradient(110deg,#E8CC7A,#C9A84C 55%,#b8932f);color:#221a06;">' +
      'Eine ' + name + ' kaufen' + (preis ? ' · ' + preis : '') +
    '</button>' +
    '<div style="font-size:11.5px;opacity:.75;margin-top:8px;">' +
      'Günstiger im Paket: im Cockpit unter „Plan“.' +
    '</div>';
  box.classList.remove('hide');

  var btn = document.getElementById('mbKaufBtn');
  if (btn) btn.addEventListener('click', function () { _kaufeEinzeln(art, btn); });
}

async function _kaufeEinzeln(art, btn) {
  var alt = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Wird gestartet…'; }
  try {
    var r = await fetch('/api/v1/credits/checkout', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, _mbAuth()),
      body: JSON.stringify({ pack_id: art })
    });
    var d = null;
    try { d = await r.json(); } catch (e) {}
    if (r.ok && d && d.url) {
      /* Diese Seite laeuft in der Haupt-App im iframe. Eine Weiterleitung
         auf `window.location` wuerde Stripe IN den Rahmen laden — dort
         verweigert Stripe die Anzeige. Also immer das oberste Fenster. */
      try { (window.top || window).location.href = d.url; }
      catch (e) { window.location.href = d.url; }
      return;
    }
    if (btn) { btn.disabled = false; btn.textContent = alt; }
    var msg = (d && (d.message || d.error)) || 'Kauf konnte nicht gestartet werden';
    if (r.status === 403) msg = 'Bewertungen können ab dem Starter-Plan dazugekauft werden.';
    alert(msg);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = alt; }
    alert('Netzwerkfehler: ' + e.message);
  }
}

async function generate() {
  /* ── v1202 · Die gewaehlte Tiefe muss vollstaendig sein ──────────────────
     Loest die ETW-Sonderregel aus v1201 ab, die nur den Miteigentumsanteil
     kannte. Seit die Stufe wieder GEWAEHLT wird (v1202), gilt allgemein:
     wer Stufe N bestellt, muss die Angaben der Stufen 1..N beisammen haben.
     Der Miteigentumsanteil ist darin nur einer von mehreren — bei einer ETW
     steht er seit v1201 in bedarf1().

     Marcels Vorgabe dahinter, woertlich: „der Miteigentumsanteil muss
     ausgefuellt werden als Pflichtwert, sonst kann man es nicht ausfuehren."
     Das gilt jetzt fuer jede Pflichtangabe der gewaehlten Tiefe.

     WELCHE das sind, weiss mb-stufen.js und niemand sonst — `offenFuer()`
     gibt sie heraus. Hier steht bewusst KEINE eigene Liste; das waere die
     Doppelliste, an der der Marktbericht schon sechsmal gescheitert ist.

     KEIN alert(). Ein natives Fenster blockiert den ganzen Renderer — die
     Meldung geht in `errBox`, dieselbe Flaeche wie das v1187-Kaufangebot. */
  try {
    var _st = window.DealPilotMbStufen;
    var _offen = (_st && typeof _st.offenFuer === 'function') ? _st.offenFuer() : null;
    if (_offen && _offen.length) {
      var _tiefe = (_st && typeof _st.gewaehlt === 'function') ? _st.gewaehlt() : null;
      var _name = { 1: 'Marktpreisindikation', 2: 'Erweiterte Marktpreisindikation',
                    3: 'Wertermittlung nach ImmoWertV' }[_tiefe] || 'die gewählte Tiefe';
      var _box = document.getElementById('errBox');
      if (_box) {
        _box.innerHTML =
          '<div style="font-weight:600;margin-bottom:6px;">⚠ Angaben fehlen für '
            + _name + '</div>'
          + '<div style="font-size:13px;line-height:1.55;">'
          + 'Es fehlt noch: <b>' + _offen.join(', ') + '</b>.<br><br>'
          + 'Die fehlenden Felder sind im Formular gold markiert. Du kannst auch eine '
          + 'geringere Tiefe wählen — dann werden weniger Angaben gebraucht.'
          + '</div>';
        _box.classList.remove('hide');
        try { _box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      }
      /* Ins erste fehlende Feld springen, damit der Weg kurz ist. */
      try {
        var _erstes = document.querySelector('.mbst-fehltfeld input, .mbst-fehltfeld select, .mbst-fehltfeld-solo');
        if (_erstes) { _erstes.scrollIntoView({ behavior: 'smooth', block: 'center' }); _erstes.focus(); }
      } catch (e) {}
      return;
    }
  } catch (e) { /* im Zweifel nicht blockieren */ }

  /* v951-checkup: Der Kostenhinweis war schon da — die Pruefung kommt hinein,
   * nicht daneben. Zwei Dialoge hintereinander klickt niemand, er klickt sie weg.
   * Sind die Zahlen sauber, bleibt der Dialog exakt wie vorher. */
  var _w = [];
  try { _w = _mbCheckup(); } catch (e) { try { console.warn('[v951] Checkup:', e.message); } catch (x) {} }
  /* v1125-stufenpreis: Der Dialog nannte FEST "5 L" — bei Stufe 1 zu viel,
     bei Stufe 3 zu wenig (12 L). Seit v1125 bucht das Backend drei echte
     Preise; hier steht jetzt derselbe Wert, der dort berechnet wird.
     Die Ermaessigung beim Vertiefen kennt nur der Server (die bezahlte
     Stufe kommt aus dem Kerosin-Log, nie aus dem Browser) — deshalb wird
     sie als Moeglichkeit genannt, nicht als Zahl behauptet. */
  /* v1187: Der Dialog nannte „5 L Kerosin". Die Waehrung gibt es seit
     v1183 nicht mehr, und seit dem Prod-Rollout vom 31.08. stand hier das
     Einzige, was dem Kunden noch Liter versprach — ausgerechnet im
     Kostenhinweis, den er bestaetigen muss.

     ZWEITER FEHLER IM SELBEN TEXT, und der war teurer: „wird nur die
     Differenz abgebucht" stimmt nicht mehr. GEMESSEN in
     routes/marktbericht.js:100 — `_faelligeStufe()` gibt entweder 0
     zurueck (schon bezahlt, kostet nichts) oder die VOLLE Stufe. Eine
     Differenz gibt es nicht mehr; wer von Stufe 1 auf 3 vertieft, zahlt
     eine ganze Wertermittlung. Ein Preisversprechen, das der Server nicht
     einloest, gehoert sofort weg. */
  var _STUFENNAME = {
    1: '1 Marktpreisindikation',
    2: '1 erweiterte Marktpreisindikation',
    3: '1 Wertermittlung nach ImmoWertV'
  };
  var _st = 2;
  try { _st = parseInt(window.Wertermittlung.payload().wert_stufe, 10) || 2; } catch (e) {}
  if (!(_st >= 1 && _st <= 3)) _st = 2;
  var _msg = 'Marktbericht jetzt erstellen?\n\nKosten: ' + _STUFENNAME[_st]
           + ' – nur wenn ein Marktwert ermittelt wird. Liegen keine '
           + 'Marktdaten vor, wird nichts abgebucht.'
           + '\n\nWurde für dieses Objekt schon dieselbe oder eine höhere '
           + 'Stufe erstellt, kostet der Bericht nichts.';
  if (_w.length) {
    _msg = '\u26a0 ' + _w.length + (_w.length === 1 ? ' Angabe sieht' : ' Angaben sehen') + ' ungew\u00f6hnlich aus:\n\n'
         + _w.map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n')
         + '\n\n\u2014\n\n' + _msg
         + '\n\nDer Bericht rechnet mit dem, was hier steht.';
  }
  /* v647-cost: Kostenhinweis vor dem kostenpflichtigen Abruf */
  if (!window.confirm(_msg)) return; /* v654-cost-text */
  _mbScrollTop(); /* v945-scroll: war ein No-Op im iframe (v569-appbeh) */
  const btn = $('goBtn');
  $('errBox').classList.add('hide');
  const _sig = $('loadSignal'); if (_sig) _sig.classList.add('hide');
  btn.style.boxShadow = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> erstelle…';

  const body = {
    external_ref: (function(){ return _mbRef() || undefined; })(), /* v942-mbrep: Dropdown schlaegt URL */
    object_label: (function(){ return window._mbwLabel || undefined; })(),
    address: $('address').value,
    property_type: $('ptype').value,
    usage_type: $('usage').value,
    living_area: parseFloat($('area').value) || null,
    rooms: parseFloat($('rooms').value) || null,
    build_year: parseInt($('year').value) || null,
    floor: parseInt($('floor').value),
    condition: $('cond').value,
    quality: $('quality') ? $('quality').value : null,
    modernization: $('modern') ? $('modern').value : null,
    modernization_year: $('modyear') ? (parseInt($('modyear').value) || null) : null,
    energy_class: $('energy').value,
    bathrooms: $('baths') ? (parseFloat($('baths').value) || null) : null,
    balcony_area: $('balcony') ? (parseFloat($('balcony').value) || null) : null,
    garden_area: $('garden') ? (parseFloat($('garden').value) || null) : null,
    plot_area: $('plot') ? (parseFloat($('plot').value) || null) : null,
    /* WUI10-2 · Wertermittlung. Die Felder erzeugt wertermittlung.js dynamisch je
       gewaehlter Stufe; alle Zugriffe sind deshalb null-sicher. */
    ...(window.Wertermittlung ? window.Wertermittlung.payload() : {}),
    /* WBRW-1 · Manueller Bodenrichtwert. Der Orchestrator liest
       land_value_manual seit jeher — nur gefragt hat ihn niemand. */
    land_value_manual: $('brwManuell') ? (parseFloat($('brwManuell').value) || null) : null,
    land_value_stichtag: $('brwStichtag') ? ($('brwStichtag').value || null) : null,
    units: $('units') ? (parseInt($('units').value, 10) || null) : null,
    elevator: $('elevator') ? $('elevator').checked : false,
    garages: $('garages') ? (parseFloat($('garages').value) || null) : null,
    outdoor_parking: $('outdoor') ? (parseFloat($('outdoor').value) || null) : null,
    purchase_price: parseFloat($('price').value) || null,
    monthly_net_rent: parseFloat($('rent').value) || null,
    fast: $('fastMode') ? $('fastMode').checked : false,
    /* v736-mb-eq: 8 Ausstattungsfelder -> Keys wie DealPilotObjectMapper (v727) */
    heating: $('eq_heating') ? ($('eq_heating').value || null) : null,
    windows: $('eq_windows') ? ($('eq_windows').value || null) : null,
    floor_covering: $('eq_floor') ? ($('eq_floor').value || null) : null,
    bath: $('eq_bath') ? ($('eq_bath').value || null) : null,
    guest_wc: $('eq_guest_wc') ? ($('eq_guest_wc').value || null) : null,
    store_room: $('eq_store_room') ? ($('eq_store_room').value || null) : null,
    exterior_walls: $('eq_walls') ? ($('eq_walls').value || null) : null,
    roof: $('eq_roof') ? ($('eq_roof').value || null) : null,
  };

  const prog = $('genProgress');
  const steps = [];
  const pushStep = (msg) => {
    steps.push(msg);
    if (!prog) return;
    prog.classList.remove('hide');
    var bar = document.getElementById('genProgBar');
    if (bar) { /* v570-prog: sanfte, monotone Kurve (kein Sprung) */
      var _frac = steps.length / EXPECTED_STEPS;
      var _pct = Math.round((1 - Math.pow(1 - Math.min(1, _frac), 1.7)) * 92) + 4;
      var _cur = parseFloat(bar.style.width) || 0;
      bar.style.width = Math.max(_cur, Math.min(96, _pct)) + '%'; }
    var stepsBox = document.getElementById('genProgSteps') || prog;
    stepsBox.innerHTML = steps.slice(-6).map((s, i, arr) => {
      const isLast = i === arr.length - 1;
      const mark = isLast
        ? '<span class="spin" style="width:11px;height:11px;"></span>'
        : '<span style="color:#3FA56C;">✓</span>';
      const col = isLast ? window._wlc('#C9A84C') : '#7a7a83';
      return `<div style="font-size:12px;color:${col};padding:2px 0;display:flex;gap:7px;align-items:center;">${mark}<span>${s}</span></div>`;
    }).join('');
  };
  // v564-chips-progress: Progress in den Ergebnis-Bereich schieben + Progressbar.
  if (prog) {
    try {
      var rb = $('resultBody'), ph = $('placeholder');
      if (ph) ph.classList.add('hide');
      if (rb) { rb.classList.remove('hide'); if (prog.parentNode !== rb) rb.insertBefore(prog, rb.firstChild); }
    } catch (e) {}
    prog.classList.remove('hide');
    prog.innerHTML = '<div style="height:8px;background:#16161b;border-radius:999px;overflow:hidden;margin-bottom:12px;box-shadow:inset 0 1px 3px rgba(0,0,0,.4);"><div id="genProgBar" style="height:100%;width:4%;background:linear-gradient(90deg,var(--wl-bd9a3e, #bd9a3e),var(--wl-c9a84c, #C9A84C) 50%,var(--wl-e8cc7a, #E8CC7A));border-radius:999px;transition:width .65s cubic-bezier(.22,.61,.36,1);box-shadow:0 0 10px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 55%, transparent);"></div></div><div id="genProgSteps"></div>';
  }
  var EXPECTED_STEPS = 14;

  try {
    const res = await fetch(API + '/reports/generate-stream', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Fallback auf den klassischen (nicht-streamenden) Endpoint, falls Stream nicht verfuegbar.
    /* v1187 · Der Einzelkauf am gesperrten Knopf — letzter Schritt des
       Preismodells v1176 (Backlog Punkt 1, Schritt 5).

       Bis hierher endete ein leeres Kontingent in der Fehlerzeile:
       „✗ Keine Wertermittlung nach ImmoWertV mehr frei." Punkt. Der
       Nutzer stand vor einem fertig ausgefuellten Formular und hatte
       keinen Weg weiter — genau die Sackgasse, die v1183c schon einmal
       beim Nachkauf-Knopf hatte.

       Die 402 wird DIREKT behandelt, nicht ueber den Rueckfall darunter:
       der wuerde denselben Abruf ein zweites Mal schicken, nur um
       denselben Fehler zu bekommen. */
    if (res.status === 402) {
      var _d402 = {};
      try { _d402 = await res.json(); } catch (e) {}
      await _zeigeKaufAngebot(_d402);
      return;
    }
    if (!res.ok || !res.body || !res.body.getReader) {
      const r2 = await fetch(API + '/reports/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d2 = await r2.json();
      if (!r2.ok) throw new Error(d2.error || 'Fehler');
      render(d2);
      return;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', done = null, errMsg = null;
    for (;;) {
      const { value, done: rd } = await reader.read();
      if (rd) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'step') pushStep(ev.msg);
        else if (ev.type === 'done') done = ev.result;
        else if (ev.type === 'error') errMsg = ev.error;
      }
    }
    if (errMsg) throw new Error(errMsg);
    if (!done) throw new Error('Kein Ergebnis erhalten');
    render(done);
  } catch (e) {
    $('errBox').textContent = '✗ ' + e.message;
    $('errBox').classList.remove('hide');
  } finally {
    if (prog) { prog.classList.add('hide'); prog.innerHTML = ''; }
    btn.disabled = false;
    btn.textContent = 'Marktbericht erstellen';
  }
}


// Formular aus einer geladenen Ausgabe befuellen (alle Felder, inkl. Erweiterte Angaben)
function fillFormFromOut(d) {
  const rf = (d && d.ref) || {};
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (!el || v == null || v === '') return false;
    if (el.type === 'checkbox') { el.checked = !!v; }
    else if (el.tagName === 'SELECT') {
      const has = [...el.options].some((o) => String(o.value) === String(v));
      if (!has) return false; el.value = String(v);
    } else { el.value = v; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };
  set('address', (d.address && d.address.formatted) || rf.address);
  set('ptype', rf.property_type); set('usage', rf.usage);
  set('area', rf.living_area); set('rooms', rf.rooms);
  set('year', rf.build_year); set('floor', rf.floor);
  set('rent', rf.monthly_net_rent); set('price', rf.purchase_price);
  let adv = 0;
  ['cond|condition', 'energy|energy_class', 'quality|quality', 'modern|modernization',
   'modyear|modernization_year', 'baths|bathrooms', 'balcony|balcony_area', 'garden|garden_area',
   'plot|plot_area', 'units|units', 'garages|garages', 'outdoor|outdoor_spaces', 'elevator|elevator']
    .forEach((pair) => {
      const [id, key] = pair.split('|');
      if (set(id, rf[key] != null ? rf[key] : rf[key.replace('_spaces', '_parking')])) adv++;
    });
  // Erweiterte Angaben aufklappen, wenn dort etwas befuellt wurde
  if (adv > 0) {
    const box = document.getElementById('precBox'), caret = document.getElementById('precCaret');
    if (box && box.style.display === 'none') { box.style.display = ''; if (caret) caret.textContent = '\u25be'; }
  }
}

function _scoreWord(s) {
  if (s == null) return '';
  return s >= 80 ? 'sehr gut' : s >= 65 ? 'gut' : s >= 45 ? 'durchschnittlich' : s >= 25 ? 'schwach' : 'sehr schwach';
}
/* WERG27-2 · Bodenwert und Wertverfahren am Bildschirm.
 * Jedes Verfahren mit einer eingeklappten Erklaerung — wer Vergleichswert
 * und Ertragswert nebeneinander sieht und 45 % Abstand liest, haelt sonst
 * einen davon fuer falsch. */
function _wvErklaerung(art) {
  var t = {
    vergleich: 'Das Vergleichswertverfahren fragt: was zahlen Käufer gerade für ähnliche '
      + 'Objekte? Grundlage sind tatsächliche Angebote im Umkreis, zugeschnitten auf '
      + 'Wohnfläche, Baujahr, Zustand und Erstbezug. Bei Eigentumswohnungen ist es das '
      + 'führende Verfahren, weil es dafür viele Vergleichsfälle gibt. Es bildet den '
      + 'Markt ab — mit allem, was der Markt gerade einpreist, auch Erwartungen an die '
      + 'künftige Wertentwicklung.',
    ertrag: 'Das Ertragswertverfahren fragt: was wirft die Immobilie ab? Von der '
      + 'marktüblich erzielbaren Miete werden die Bewirtschaftungskosten abgezogen, der '
      + 'Bodenwert wird verzinst abgesetzt, und was das Gebäude übrig lässt, wird über '
      + 'die Restnutzungsdauer kapitalisiert. Es ist das Verfahren für Kapitalanlagen. '
      + 'Weil es nur den laufenden Ertrag abbildet und keine Wertsteigerung, liegt es bei '
      + 'Neubauten in Wachstumsregionen regelmäßig unter dem Vergleichswert — zwanzig '
      + 'bis vierzig Prozent Abstand sind dort normal.',
    sach: 'Das Sachwertverfahren fragt: was kostet es, das Gebäude neu zu errichten, '
      + 'abzüglich Alterswertminderung, zuzüglich Bodenwert? Es ist das Verfahren für '
      + 'selbstgenutzte Ein- und Zweifamilienhäuser, wo Vergleichsfälle fehlen. Bei '
      + 'Wohnungseigentum wird es kaum verwendet: die Herstellungskosten beziehen sich auf '
      + 'das ganze Gebäude, nicht auf eine Einheit.',
  };
  return t[art] || '';
}

/* WKIV-2 · Zweitmeinung Zeile fuer Zeile. Nicht das Endergebnis allein —
 * zwei Wege koennen sich auf dieselbe Zahl zubewegen und trotzdem beide
 * falsch liegen. Auffaellig ab 10 % Abweichung je Zwischengroesse. */
function _renderGegenrechnung(d) {
  var g = d.ki_gegenrechnung;
  var wrap = document.getElementById('resultBody');
  if (!wrap) return;
  var alt = document.getElementById('kig-box');
  if (alt) alt.remove();
  if (!g) return;

  var box = document.createElement('div');
  box.id = 'kig-box';
  box.style.cssText = 'margin-top:22px;padding:13px 15px;border-radius:8px;'
    + 'border:1px solid rgba(128,128,128,.22)';

  if (!g.verfuegbar) {
    box.innerHTML = '<div style="font-size:12px;opacity:.7">Zweitmeinung nicht verf\u00fcgbar: '
      + (g.grund || '\u2013') + '</div>';
    wrap.appendChild(box); return;
  }

  var v = g.vergleich || {};
  var zeilen = (v.zeilen || []).map(function (z) {
    var abw = z.abweichung_pct;
    var farbe = z.auffaellig ? '#B8625C' : '#3FA56C';
    var f = function (n) {
      return n == null ? '\u2013'
        : (Math.abs(n) >= 1000 ? new Intl.NumberFormat('de-DE').format(Math.round(n)) : String(n).replace('.', ','));
    };
    return '<tr><td>' + z.pos + '</td><td style="text-align:right">' + f(z.unser) + '</td>'
      + '<td style="text-align:right;opacity:.8">' + f(z.ki) + '</td>'
      + '<td style="text-align:right;color:' + (abw == null ? 'inherit' : farbe) + '">'
      + (abw == null ? '\u2013' : (abw > 0 ? '+' : '') + String(abw).replace('.', ',') + ' %')
      + '</td></tr>';
  }).join('');

  box.innerHTML =
    '<div style="font-size:11px;letter-spacing:.05em;text-transform:uppercase;opacity:.6">'
    + 'Zweitmeinung \u00b7 unabh\u00e4ngig nachgerechnet</div>'
    + '<div style="font-size:11.5px;opacity:.75;margin:5px 0 10px">'
    + 'Ein Sprachmodell rechnet mit denselben Eingangsgr\u00f6\u00dfen unabh\u00e4ngig nach. '
    + 'Der Bericht rechnet unver\u00e4ndert mit der eigenen Engine \u2014 eine Abweichung '
    + 'ist ein Pr\u00fcfsignal, kein Schiedsspruch.</div>'
    + (zeilen ? ('<table class="data-table" style="font-size:12px"><thead><tr>'
        + '<th>Position</th><th style="text-align:right">DealPilot</th>'
        + '<th style="text-align:right">Zweitmeinung</th>'
        + '<th style="text-align:right">Abweichung</th></tr></thead><tbody>'
        + zeilen + '</tbody></table>') : '')
    + (v.urteil ? '<div style="font-size:11.5px;margin-top:9px;opacity:.85">' + v.urteil + '</div>' : '');
  wrap.appendChild(box);
}

function _renderWertverfahren(d) {
  var wrap = document.getElementById('resultBody');
  if (!wrap) return;
  var alt = document.getElementById('wv-box');
  if (alt) alt.remove();
  var cc = d.cross_check || {};
  var lv = d.land_value || {};
  var hk = d.wertermittlung_herkunft || {};
  var e = cc.ertragswert || {}, sw = cc.sachwert || {};
  var v = d.valuation && d.valuation.market_value ? d.valuation.market_value.estimated : null;

  function eur(n) {
    return n == null ? '\u2013' : new Intl.NumberFormat('de-DE').format(Math.round(n)) + ' \u20ac';
  }
  /* \u2500\u2500 v1141-RW \u00b7 Der Rechenweg stand nur im PDF \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   * Im dritten Pruefdurchgang (2026-08-12) fiel die Bodenwertverzinsung auf
   * dem doppelten Wert auf \u2014 sichtbar NUR im PDF-Rechenweg, weil die
   * Bildschirmansicht ausschliesslich Ergebniszahlen zeigte. Ein Fehler,
   * den man erst nach dem Herunterladen sehen kann, ist praktisch
   * unsichtbar.
   *
   * Dieselben Staffeln, die das PDF ab Z. 3416 zeichnet, liegen hier
   * bereits vor: `_ew`/`_swx` dort sind exakt `e`/`sw` hier. Es wird also
   * nichts neu berechnet und keine zweite Quelle aufgemacht \u2014 die Ansicht
   * zeigt nur, was das PDF ohnehin zeigt.
   *
   * Formatregeln 1:1 vom PDF uebernommen (z.faktor vor z.wert, Faktor mit
   * Komma, z.summe fett mit Trennlinie, z.detail als Unterzeile). Weichen
   * die beiden ab, stehen zwei Darstellungen derselben Zahl nebeneinander
   * \u2014 genau das soll der Rechenweg ja ausschliessen. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function rechenweg(staffel) {
    if (!staffel || !staffel.length) return '';
    return '<table class="wv-rw"><tbody>' + staffel.map(function (z) {
      var rechts = '';
      if (z.faktor != null) rechts = String(z.faktor).replace('.', ',');
      else if (z.wert != null) rechts = eur(z.wert);
      return '<tr' + (z.summe ? ' class="wv-rw-s"' : '') + '>'
        + '<td>' + esc(z.pos)
        + (z.detail ? '<div class="wv-rw-d">' + esc(z.detail) + '</div>' : '')
        + '</td><td>' + rechts + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  function aufklapper(kennung, beschriftung, inhalt) {
    if (!inhalt) return '';
    return '<div class="wv-mehr" data-wv="' + kennung + '" data-label="' + beschriftung + '">'
      + '\u25b8 ' + beschriftung + '</div>'
      + '<div class="wv-erk" id="wv-e-' + kennung + '">' + inhalt + '</div>';
  }
  function karte(kennung, titel, wert, unten, art, staffel, vorbehalt) {
    return '<div class="wv-k">'
      + '<div class="wv-t">' + titel + '</div>'
      + '<div class="wv-v">' + wert + '</div>'
      + '<div class="wv-s">' + (unten || '') + '</div>'
      + aufklapper(kennung, 'was bedeutet das?', _wvErklaerung(art))
      + aufklapper('rw-' + kennung, 'Rechenweg', rechenweg(staffel))
      /* v1143-VORL · Der Vorbehalt stand nur im PDF. */
      + aufklapper('vb-' + kennung, 'warum vorläufig?',
          vorbehalt ? '<div class="wv-vb">' + esc(vorbehalt) + '</div>' : '')
      + '</div>';
  }

  var box = document.createElement('div');
  box.id = 'wv-box';
  var bodenZeile = lv.available
    ? eur(lv.value_sqm) + '/m\u00b2 \u00b7 amtlich \u00b7 Stichtag ' + (lv.stichtag || '\u2013')
    : 'kein amtlicher Bodenrichtwert verf\u00fcgbar';

  box.innerHTML =
    '<h3 class="wv-h">Bodenwert</h3>'
    + '<div class="wv-boden"><b>' + (e.bodenwert_eur != null ? eur(e.bodenwert_eur) : '\u2013')
    + '</b><span>' + bodenZeile + '</span></div>'
    /* ── v1198b · Ein Strich ohne Grund sieht aus wie ein Fehler ───────────
       Seit v1198 steht hier korrekt „–", wenn der Bodenwert nicht angesetzt
       werden darf — bei einer Eigentumswohnung ohne Miteigentumsanteil.
       Warum, stand nirgends: der Rechenweg darunter zeigte weiter
       „950 m² × 90 €/m² = 85.500 €", und die Zahl daneben war ein Strich.
       Das liest sich wie ein Anzeigefehler, nicht wie eine Entscheidung.

       `ErtragswertService.bodenwert()` legt den fertigen Satz in
       `hinweise` ab — er wurde nur nie gezeigt. Dieselbe Regel wie in
       v1197: keine Zahl (und kein Strich) ohne Herkunft. */
    + ((cc.bodenwert && cc.bodenwert.vollstaendig === false
        && Array.isArray(cc.bodenwert.hinweise) && cc.bodenwert.hinweise.length)
        ? '<div class="wv-bwgrund">' + cc.bodenwert.hinweise.map(esc).join('<br>') + '</div>'
        : '')
    + (hk.kurz ? '<div class="wv-hk">Liegenschaftszinssatz: '
        + (hk.liegenschaftszins_pct != null ? String(hk.liegenschaftszins_pct).replace('.', ',') + ' % \u00b7 ' : '')
        + hk.kurz + (hk.indikativ ? ' (indikativ)' : '') + '</div>' : '')
    /* v1141-RW \u00b7 Der Bodenwert geht in BEIDE anderen Verfahren ein, deshalb
     * gehoert sein Weg direkt unter seine Zahl \u2014 nicht in eine der Karten.
     * Seine Schritte heissen `schritte` (ErtragswertService.bodenwert), die
     * der Verfahren `staffel`; er fuehrt kein `summe`-Flag, darum wird die
     * Ergebniszeile hier angehaengt. */
    + aufklapper('bod', 'Rechenweg', rechenweg(
        (cc.bodenwert && cc.bodenwert.schritte && cc.bodenwert.schritte.length)
          ? cc.bodenwert.schritte.concat([
              { pos: '= Bodenwert', wert: cc.bodenwert.wert, summe: true },
            ])
          : null))
    + '<h3 class="wv-h">Wertverfahren im Vergleich</h3>'
    + '<div class="wv-g">'
    + karte('vgl', 'Vergleichswert', eur(v), 'f\u00fchrend bei Eigentumswohnungen', 'vergleich')
    /* ── v1200 · Die Karte verschwieg, WIE gerechnet wurde ─────────────────
       Sie zeigte nur „Reinertrag 3.767 € p. a.". Dass ohne Bodenwert
       gerechnet wurde — bei einer Eigentumswohnung ohne Miteigentumsanteil
       der Normalfall — stand zwar im Datensatz (`verfahren`:
       „vereinfachtes Ertragswertverfahren (ohne Bodenwerttrennung)"), aber
       nirgends auf dem Schirm. Der Nutzer las eine Zahl und hatte keinen
       Anlass, sie fuer weniger belastbar zu halten als die daneben.

       Die Sachwert-Karte macht es seit jeher richtig und begruendet ihr
       eigenes Fehlen. Hier zieht der Ertragswert nach. */
    + karte('ert', 'Ertragswert', e.available ? eur(e.value_eur) : '–',
        e.available
          ? ('Reinertrag ' + eur(e.reinertrag_pa_eur) + ' p. a.'
             + (e.bodenwert_fehlt ? ' · <b>ohne Bodenwert gerechnet</b>' : ''))
          : (e.grund || ''),
        'ertrag', e.staffel)
    /* v1143-VORL \u00b7 Die Karte zeigte bei vorhandenem Sachwert eine LEERE
     * Unterzeile \u2014 die wichtigste Einschraenkung fehlte damit genau dort,
     * wo die Zahl steht. Das PDF sagt "INDIKATIV \u00b7 ohne Sachwertfaktor \u2014
     * Herstellungskosten, kein Marktwert", der Bildschirm sagte nichts.
     *
     * Am Pruefobjekt fuehrte das direkt zur Rueckfrage, ob 268.172 EUR
     * gegen 191.339 EUR plausibel seien: ohne den Vorbehalt sieht es aus
     * wie ein Widerspruch zwischen drei gleichrangigen Zahlen. Der
     * vorlaeufige Sachwert nach \u00a7 35 ist aber gar kein Marktwert \u2014 es
     * fehlt die Marktanpassung nach \u00a7 21 Abs. 3.
     *
     * Der Grund steht im Antwortobjekt (`sachwertfaktor_hinweis`) und war
     * nirgends sichtbar: fuer Eigentumswohnungen leitet der
     * Gutachterausschuss ueberhaupt keine Sachwertfaktoren ab. Auch ein
     * gepflegter eigener Wert wird deshalb verworfen \u2014 am Pruefobjekt
     * stand 1,15 im Feld und blieb wirkungslos. */
    + karte('sac', 'Sachwert', sw.available ? eur(sw.value_eur) : '\u2013',
        sw.available
          /* v1143b \u00b7 EIGENER FEHLER. Ich hatte `sachwertfaktor` fuer eine Zahl
           * gehalten \u2014 nhk2010.js:882 setzt aber ein OBJEKT
           * `{ wert, stufe, quelle }`. Auf dem Bildschirm stand daraufhin
           * "marktangepasst \u00b7 Faktor [object Object]". Aufgefallen im ersten
           * Lauf, bei dem ueberhaupt ein Faktor griff (EFH Hiddenhausen,
           * 0,925 Stufe A) \u2014 vorher gab es keinen Fall, der die Zeile
           * erreicht haette. Beide Formen werden jetzt gelesen. */
          ? (sw.marktangepasst
              ? ('marktangepasst' + (function () {
                  var f = sw.sachwertfaktor;
                  var z = (f && typeof f === 'object') ? f.wert : f;
                  var s = (f && typeof f === 'object') ? f.stufe : null;
                  if (z == null) return '';
                  return ' \u00b7 Faktor ' + String(z).replace('.', ',')
                       + (s ? ' \u00b7 Stufe ' + s : '');
                })())
              : 'vorl\u00e4ufig \u00b7 ohne Sachwertfaktor, kein Marktwert')
          : (sw.grund || 'nicht ausgewiesen'),
        'sach', sw.staffel,
        (sw.available && !sw.marktangepasst) ? (sw.sachwertfaktor_hinweis || null) : null)
    + '</div>';

  if (!document.getElementById('wv-css')) {
    var st = document.createElement('style'); st.id = 'wv-css';
    st.textContent = '#wv-box .wv-h{margin:22px 0 10px;font-size:12px;letter-spacing:.05em;'
      + 'text-transform:uppercase;opacity:.65}'
      /* v1141d · Bei 390 px stand das Euro-Zeichen allein in der zweiten
       * Zeile: der Kopfbetrag mass 66 px bei 33 px Zeilenhoehe. Ursache ist
       * `nowrap` in der Flex-Zeile — das <b> wird gequetscht und bricht
       * INNEN um, statt dass die Zeile umbricht. Derselbe Befundtyp wie die
       * Cashflow-Kacheln in v1138c: eine Zahl, die man in zwei Zeilen liest,
       * liest man falsch. */
      + '#wv-box .wv-boden{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap}'
      + '#wv-box .wv-boden b{font-size:22px;white-space:nowrap}'
      + '#wv-box .wv-boden span{font-size:12px;opacity:.7}'
      + '#wv-box .wv-hk{margin-top:6px;font-size:12px;opacity:.75}'
      /* v1198b · Der Grund, warum kein Bodenwert dasteht. */
      + '#wv-box .wv-bwgrund{margin-top:9px;padding:9px 11px;border-radius:8px;font-size:11.5px;line-height:1.55;border:1px solid rgba(201,168,76,.32);background:rgba(201,168,76,.09)}'
      + '#wv-box .wv-g{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}'
      + '#wv-box .wv-k{padding:13px 15px;border:1px solid rgba(128,128,128,.22);border-radius:8px}'
      + '#wv-box .wv-t{font-size:11px;letter-spacing:.05em;text-transform:uppercase;opacity:.6}'
      + '#wv-box .wv-v{font-size:20px;font-weight:600;margin:4px 0 2px}'
      + '#wv-box .wv-s{font-size:11.5px;opacity:.7;min-height:16px}'
      + '#wv-box .wv-mehr{margin-top:8px;font-size:11.5px;cursor:pointer;'
      + 'color:var(--wl-c9a84c,#C9A84C)}'
      + '#wv-box .wv-erk{display:none;margin-top:7px;font-size:11.5px;line-height:1.55;opacity:.85}'
      /* v1141-RW · Der Rechenweg steht in einer 3-Spalten-Kachel, also eng.
       * `overflow-wrap` statt fester Breite: lieber ein Umbruch in der
       * Beschriftung als eine abgeschnittene Zahl. Die Zahlenspalte bleibt
       * deshalb `nowrap` und tabellarisch — nur links darf brechen. */
      /* v1141c · Der Bodenwert-Weg steht NICHT in einer Kachel, sondern über
       * die volle Breite (gemessen 856 px). Beschriftung links, Zahl ganz
       * rechts — dazwischen ein halber Bildschirm. Eine Rechnung liest man
       * nur, wenn Position und Betrag beieinanderstehen. */
      + '#wv-box > .wv-erk .wv-rw{max-width:440px}'
      + '#wv-box .wv-rw{width:100%;border-collapse:collapse;font-size:11px}'
      + '#wv-box .wv-rw td{padding:3px 0;vertical-align:top;overflow-wrap:anywhere}'
      + '#wv-box .wv-rw td:last-child{text-align:right;white-space:nowrap;padding-left:10px;'
      + 'font-variant-numeric:tabular-nums;width:1%}'
      + '#wv-box .wv-rw-s td{font-weight:600;border-top:1px solid rgba(128,128,128,.28);padding-top:5px}'
      + '#wv-box .wv-rw-s td:last-child{color:var(--wl-c9a84c,#C9A84C)}'
      + '#wv-box .wv-rw-d{font-size:10px;line-height:1.4;opacity:.6;margin-top:2px;font-weight:400}'
      + '#wv-box .wv-vb{font-size:11px;line-height:1.5}';
    document.head.appendChild(st);
  }
  wrap.appendChild(box);

  box.querySelectorAll('.wv-mehr').forEach(function (m) {
    m.addEventListener('click', function () {
      var z = document.getElementById('wv-e-' + m.getAttribute('data-wv'));
      var auf = z.style.display !== 'block';
      z.style.display = auf ? 'block' : 'none';
      /* v1141-RW: die Beschriftung stand hier fest verdrahtet \u2014 mit einem
       * zweiten Aufklapper haette der Rechenweg beim Zuklappen pl\u00f6tzlich
       * "was bedeutet das?" geheissen. */
      m.textContent = (auf ? '\u25be' : '\u25b8') + ' ' + m.getAttribute('data-label');
    });
  });
}

function render(out) {
  const d = out.data;
  try { fillFormFromOut(d); } catch (e) { /* Formular-Befuellung optional */ }
  $('placeholder').classList.add('hide');
  $('resultBody').classList.remove('hide');
  $('reportPanel').classList.remove('hide');

  /* WKIV-1 · Die KI-Gegenrechnung stand seit v1021 im Bericht unter
   * ki_gegenrechnung, wurde aber nirgends dargestellt. Auch eingeschaltet
   * sah man nur eine Zeile im Log. */
  try { _renderGegenrechnung(d); } catch (e) { /* Anzeige darf nie kippen */ }

  /* WERG27-1 · Bodenwert und Wertverfahren im Ergebnis. */
  try { _renderWertverfahren(d); } catch (e) { /* Anzeige darf den Bericht nie kippen */ }

  // v565-no-mbcard: Mini-Marktbewertung-Karte entfernt (echte Tachos via renderValuation bleiben)
  try { var _h = $('mbCard'); if (_h) _h.style.display = 'none'; } catch (e) {}

  // DealScore-2-Box: echter DS2 (bei .dpkt) oder vereinfachter Hinweis (manuell)
  const dm = $('dsMeta');
  if (dm) {
    const m = d.dealscore_meta;
    if (m && !m.simplified) {
      const k = m.kpis || {};
      const kpiChips = [
        k.dscr != null ? ['DSCR', k.dscr.toFixed ? k.dscr.toFixed(2) : k.dscr] : null,
        k.ltv_pct != null ? ['LTV', Math.round(k.ltv_pct) + ' %'] : null,
        k.cashflow_monthly != null ? ['Cashflow', Math.round(k.cashflow_monthly) + ' €/M'] : null,
      ].filter(Boolean).map(([n, v]) =>
        `<span style="background:#1a1a1f;border:1px solid #2a2a30;border-radius:8px;padding:4px 10px;font-size:12px;color:#cfcfd6;">${n}: <b style="color:#fff;">${v}</b></span>`).join(' ');
      dm.classList.remove('hide');
      dm.innerHTML = `<div style="background:linear-gradient(135deg,#16210f,#1a1a1f);border:1px solid var(--wl-c9a84c, #C9A84C);border-radius:12px;padding:14px 16px;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <span style="font-family:'Space Grotesk';font-weight:700;font-size:22px;color:var(--wl-c9a84c, #C9A84C);">DealScore 2: ${m.value}</span>
          <span style="font-size:12px;color:#8a8a93;">aus DealPilot übernommen${m.kpis_complete ? ' · vollständige Finanzierungsdaten' : ''}</span>
        </div>
        ${kpiChips ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">${kpiChips}</div>` : ''}
        <div style="font-size:11px;color:#6a6a72;margin-top:8px;">Markt-Score dieses Berichts (ohne Finanzierung): ${m.market_score}</div>
      </div>`;
    } else if (m && m.simplified) {
      dm.classList.remove('hide');
      dm.innerHTML = `<div style="background:#16161b;border:1px solid #2a2a30;border-radius:12px;padding:12px 14px;">
        <span style="font-size:13px;color:#cfcfd6;"><b>Vereinfachter Score</b> — ${m.note}</span></div>`;
    } else dm.classList.add('hide');
  }


  const cn = $('costNote');
  if (cn) {
    const ge = out.cost && out.cost.geomap_eur;
    if (ge != null) {
      cn.textContent = ge === 0
        ? '' /* v565-no-share: Kostenzeile entfernt */
        : ''
          + (out.cost.geomap_balance_eur != null ? '  ·  Restguthaben ' + out.cost.geomap_balance_eur.toFixed(2).replace('.', ',') + ' €' : '');
    } else cn.textContent = '';
  }

  // Objektkarte: im Dashboard NUR die interaktive Leaflet-Karte (#map) zeigen.
  // Die Geoapify-Static-Map (#objImage) bleibt ausgeblendet – sie wird weiterhin
  // fürs PDF genutzt (d.object_image), war im Dashboard aber eine Dopplung.
  const img = $('objImage');
  img.classList.add('hide'); img.removeAttribute('src');

  // Objektkarte / Stammdaten-Überblick (Obsidian + Partikel) – "welches Objekt ist das?"
  const osEl = $('objSummary');
  if (osEl) { osEl.classList.add('hide'); } /* v569-appbeh: Objektkarte aus */
  if (false) {
    const rf = d.ref || {}, adr = (d.address && d.address.formatted) || rf.address || '–';
    const chip = (t) => `<span style="display:inline-block;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 8%, transparent);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);color:#e7e2d4;border-radius:999px;padding:3px 10px;font-size:11.5px;font-family:'JetBrains Mono';">${t}</span>`;
    const facts = [
      rf.property_type, rf.living_area ? rf.living_area + ' m²' : null, rf.rooms ? rf.rooms + ' Zi.' : null,
      rf.build_year ? 'Bj. ' + rf.build_year : null, rf.floor != null ? rf.floor + '. Etage' : null,
      rf.energy_class ? 'Energie ' + rf.energy_class : null, rf.condition ? 'Zustand ' + rf.condition : null,
      rf.quality ? 'Ausstattung ' + rf.quality : null,
      rf.modernization ? 'Modernisierung ' + rf.modernization + (rf.modernization_year ? ' (' + rf.modernization_year + ')' : '') : null,
      rf.bathrooms ? rf.bathrooms + ' Bad' + (rf.bathrooms > 1 ? 'ezimmer' : '') : null,
      rf.balcony_area ? 'Balkon/Terrasse ' + rf.balcony_area + ' m²' : null,
      rf.garden_area ? 'Garten ' + rf.garden_area + ' m²' : null,
      rf.plot_area ? 'Grundstück ' + rf.plot_area + ' m²' : null,
      rf.units ? rf.units + ' Wohneinheiten' : null,
      (rf.garages || rf.outdoor_spaces || rf.outdoor_parking) ? 'Stellplätze ' + [(rf.garages ? rf.garages + ' Garage/TG' : null), ((rf.outdoor_spaces || rf.outdoor_parking) ? (rf.outdoor_spaces || rf.outdoor_parking) + ' außen' : null)].filter(Boolean).join(' · ') : null,
      rf.elevator ? 'Aufzug' : null,
      rf.usage ? 'Nutzung ' + rf.usage : null,
      rf.purchase_price ? 'Kaufpreis ' + fmt(rf.purchase_price, ' €') : null,
      rf.monthly_net_rent ? 'Miete ' + fmt(rf.monthly_net_rent, ' €') : null,
    ].filter(Boolean);
    osEl.classList.remove('hide');
    osEl.style.cssText = 'position:relative;overflow:hidden;margin-bottom:16px;padding:16px 18px;border-radius:14px;'
      + 'border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);background-color:#070708;background-image:'
      + 'radial-gradient(circle at 18% 22%,color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 13%, transparent),transparent 42%),'
      + 'radial-gradient(circle at 88% 78%,rgba(70,100,120,.12),transparent 46%),'
      + 'radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);'
      + 'background-size:auto,auto,22px 22px;';
    osEl.innerHTML = `
      <div style="font-size:10px;letter-spacing:1.4px;color:var(--wl-c9a84c, #C9A84C);font-weight:700;margin-bottom:4px;">OBJEKT</div>
      <div style="font-family:'Space Grotesk';font-weight:700;font-size:17px;color:#fff;margin-bottom:10px;">${adr}</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;">${facts.map(chip).join('')}</div>`;
  }

  // Score (Donut + Gauge, beide Optiken)
  const ds = d.deal_score || {};
  renderScore(d);

  // KPIs
  const mv = d.valuation.market_value || {}, y = d.valuation.yield || {}, inp = d.valuation.inputs || {};
  $('kMv').textContent = fmt(mv.estimated, ' €');
  $('kYield').textContent = (y.gross_yield_pct ?? '–') + ' %';
  $('kFactor').textContent = y.rent_multiplier ?? '–';
  $('kSqm').textContent = fmt(inp.price_per_sqm, ' €');
  $('kMrent').textContent = fmt(inp.market_rent_sqm, ' €');
  $('kDisc').textContent = (mv.discount_to_market_pct ?? '–') + ' %';
  /* v877-kpi-spannen: Sub-Zeilen mit Spannen (nur wo Daten vorliegen) */
  (function(){
    var _sale = d.sale || {}, _rent = d.rent || {};
    var _set = function(id, txt){ var e = $(id); if (e) e.textContent = txt || ''; };
    var _r = function(n){ return Math.round(n); };
    _set('kMvSp', (mv.low != null && mv.high != null) ? ('Spanne ' + fmt(_r(mv.low), '\u2013') + fmt(_r(mv.high), ' \u20ac')) : '');
    _set('kSqmSp', (_sale.q25_per_sqm != null && _sale.q75_per_sqm != null) ? ('Median-Band ' + fmt(_r(_sale.q25_per_sqm), '\u2013') + fmt(_r(_sale.q75_per_sqm), ' \u20ac/m\u00b2')) : '');
    _set('kMrentSp', (_rent.q25_per_sqm != null && _rent.q75_per_sqm != null) ? (fmt(_r(_rent.q25_per_sqm), '\u2013') + fmt(_r(_rent.q75_per_sqm), ' \u20ac/m\u00b2')) : '');
    _set('kDiscSp', (mv.discount_to_market_pct != null) ? (mv.discount_to_market_pct >= 0 ? 'Kaufpreis unter Wert' : 'Kaufpreis \u00fcber Wert') : '');
  })();

  // Marktwert-/Marktmiete-Spanne + Lage-/Potenzialbewertung
  renderValuation(d);
  renderAssessment(d);
  renderHistory(d);
  renderMicro(d);
  renderObjectHistory(out);

  // Score-Komponenten im DealPilot-Stil: Label + tier-farbiger Balken + Wert/100 + erklärender Wert.
  const labels = { preisabschlag:'Preisabschlag', bruttorendite:'Bruttorendite', makrolage:'Makrolage',
    mikrolage:'Mikrolage', mietentwicklung:'Mietentwicklung', risiko:'Risiko' };
  const mvv = (d.valuation && d.valuation.market_value) || {};
  const yld = (d.valuation && d.valuation.yield) || {};
  /* v1197 · Der Untertitel der Mietentwicklung war fest verdrahtet.
     Er lautete IMMER „mangels Miet-Zeitreihe konservativ angesetzt" — auch
     dann, wenn eine Zeitreihe vorlag. Gemessen an einem echten Bericht:
     der Balken stand auf 100/100, was nur mit einer echten Zeitreihe
     zustande kommt, und daneben stand trotzdem „mangels Zeitreihe".
     Alle anderen Eintraege dieser Liste sind bedingt; dieser war es nicht.

     Jetzt kommt der Satz aus dem, was der Server ueber die Herkunft sagt:
     `ds.geschaetzt` (seit v1197) listet die Teilwerte, fuer die keine Zahl
     vorlag und ein neutraler Ersatz genommen wurde. Fehlt das Feld — alte
     Berichte aus der Datenbank kennen es nicht — wird nichts behauptet. */
  const geraten = Array.isArray(ds.geschaetzt) ? ds.geschaetzt : [];
  const subFor = {
    preisabschlag: mvv.discount_to_market_pct != null
      ? `Kaufpreis ${mvv.discount_to_market_pct >= 0 ? mvv.discount_to_market_pct + ' % unter' : Math.abs(mvv.discount_to_market_pct) + ' % über'} Marktwert`
      : null,
    bruttorendite: yld.gross_yield_pct != null ? `${yld.gross_yield_pct} % Rendite · Faktor ${yld.rent_multiplier ?? '–'}` : null,
    makrolage: (d.macro && d.macro.score != null) ? `Makro-Score ${d.macro.score}/100` : null,
    mikrolage: (d.micro && d.micro.score != null) ? `Mikro-Score ${d.micro.score}/100` : null,
    mietentwicklung: (d.insights && d.insights.series && d.insights.series.rent_cagr_pct != null)
      ? `Miet-Zeitreihe: ${d.insights.series.rent_cagr_pct} % p. a.`
      : null,
    risiko: mvv.confidence_pct != null ? `Datenkonfidenz ${mvv.confidence_pct} %` : 'Markt-/Mietausfallrisiko',
  };
  /* Ein geratener Teilwert sagt das selbst — und ueberschreibt dabei jede
     andere Erklaerung, denn „keine Daten" ist die wichtigere Auskunft. */
  geraten.forEach(function (k) { subFor[k] = 'keine Daten — neutral angesetzt'; });
  $('scoreBars').innerHTML = Object.entries(ds.breakdown || {}).map(([k, v]) => {
    const col = _scoreCol(v);
    return `<div style="margin-bottom:13px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:5px;">
        <span style="font-family:'Space Grotesk';font-weight:600;font-size:13.5px;color:#e8e8ea;">${labels[k] || k}</span>
        <span style="font-family:'JetBrains Mono';font-size:13px;color:${col};font-weight:600;">${v}<span style="color:#6a6a72;font-size:11px;"> / 100</span></span>
      </div>
      <div style="height:8px;background:#1c1c22;border-radius:999px;overflow:hidden;">
        <div style="height:100%;width:${Math.max(0, Math.min(100, v))}%;background:${col};border-radius:999px;box-shadow:0 0 8px ${col}66;transition:width .6s ease-out;"></div>
      </div>
      ${subFor[k] ? `<div style="font-size:11px;color:#7a7a82;margin-top:4px;">${subFor[k]}</div>` : ''}
    </div>`;
  }).join('');

  // Karte
  drawMap(d.address.lat, d.address.lon, d.sale.comparables || []);

  // Chart: Vergleichs-€/m² Verteilung vs. Objekt
  drawChart(d.sale, inp.price_per_sqm);

  // Bericht
  $('aiMode').textContent = '· ' + out.ai_mode + (out.ai_error ? ' (' + out.ai_error + ')' : '');
  $('reportMd').innerHTML = mdToHtml(out.report_md || '');
  renderProvenance(out);
  window._lastOut = out;
  try { _installMbSaveObject(); } catch (e) {}
  try { if (out && out.object_key) _mbLoadReportsList({ key: out.object_key }); } catch (e) {}
  // Letzte Ausgabe lokal sichern (ohne grosse Karten) -> jederzeit gratis neu ladbar.
  try {
    const slim = Object.assign({}, out); delete slim._covMap; delete slim._lightMap;
    localStorage.setItem('mb_last_out', JSON.stringify(slim));
    const _lb = document.getElementById('loadLastBtn'); if (_lb) _lb.style.display = '';
  } catch (e) { /* Quota o.ae. ignorieren */ }
  fillInputsFromReport(out);

  $('resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Konfidenz-Ampel: 0..1 -> Label, Farbe, Erklärung
/* v956-onesource
 * ──────────────────────────────────────────────────────────────────────────
 * EINE Quelle fuer Zahl, Farbe UND Text.
 *
 * Bis v955 gab es zwei Felder mit fast demselben Namen:
 *   mv.confidence       = sale.confidence  -> die ROHE Stichprobengroesse (~0,9)
 *   mv.confidence_pct   = kombiniert       -> Stichprobe x Eingaben x Streuung (47)
 * Der Header las confidence_pct ("Niedrig · 47 %"), die Karte las confidence
 * ("Hoch — Große Vergleichsstichprobe, belastbare Marktwertindikation").
 * Bis v948 lagen beide nah beieinander. v948 hat die eine ehrlich gemacht und
 * die andere stehen lassen -> 43 Punkte Widerspruch auf einem Bildschirm.
 *
 * Die Schwellen folgen jetzt dem Backend (ValuationService: 85/70/55), sonst
 * heisst dieselbe Zahl hier anders als dort.
 *
 * Und der Text ERKLAERT: "Niedrig" heisst nicht "schlechte Daten" — bei 822
 * Vergleichen ist die Stichprobe gross. Es heisst: die Vergleiche streuen so
 * weit, dass der Punktwert wenig aussagt. Das ist der Unterschied, den der
 * Nutzer verstehen muss, und genau den hat die alte Fassung verschwiegen.
 */
function confInfo(c, parts) {
  if (c == null) return null;
  var p = parts || {};
  var stichprobe = (p.marktdaten != null) ? p.marktdaten : null;
  var streuung   = (p.streuung   != null) ? p.streuung   : null;
  var eingaben   = (p.eingaben   != null) ? p.eingaben   : null;

  /* Woran liegt es? Der schwaechste Faktor bekommt das Wort. */
  function warum() {
    var g = [];
    if (streuung != null && streuung < 0.8) {
      g.push('die Vergleichsobjekte streuen weit auseinander — der Punktwert ist eine Orientierung, keine Aussage');
    }
    if (eingaben != null && eingaben < 0.95) g.push('es fehlen wertrelevante Objektangaben');
    if (stichprobe != null && stichprobe < 0.7) g.push('die Vergleichsstichprobe ist klein');
    if (!g.length) return '';
    return ' Grund: ' + g.join('; ') + '.';
  }
  function gut() {
    return (stichprobe != null && stichprobe >= 0.8)
      ? ' Die Vergleichsstichprobe selbst ist groß — die Unsicherheit kommt nicht aus zu wenig Daten.'
      : '';
  }

  if (c >= 0.85) return { label: 'Sehr hoch', color: '#3FA56C',
    text: 'Große, eng beieinander liegende Vergleichsstichprobe – belastbare Marktwertindikation.' };
  if (c >= 0.70) return { label: 'Hoch', color: '#3FA56C',
    text: 'Solide Datenbasis mit überschaubarer Streuung – gute Indikation.' };
  if (c >= 0.55) return { label: 'Mittel', color: window._wlc('#C9A84C'),
    text: 'Als Orientierung zu verstehen, nicht als exakter Wert.' + warum() };
  return { label: 'Niedrig', color: '#B86250',
    text: 'Nur grobe Orientierung.' + warum() + gut()
        + ' Für Kalkulation und Beleihung ist das untere Ende der Spanne die belastbare Größe.' };
}

// ===== SVG-Visualisierungen (DealPilot-Stil) =====
// DealPilot-Statuslogik (aus Design-Handoff): >=70 gruen, 50-69 gold, <50 rot.
const DP_GREEN = '#3FA56C', DP_RED = '#B86250';
/* W40-pdf-svg: DP_GOLD war top-level und wurde beim LADEN ausgewertet — also
   vor dem Branding. Die Aufloesung sitzt jetzt in _scoreCol() (pro Render). */
function _scoreCol(s) { s = s || 0; return s >= 70 ? DP_GREEN : s >= 50 ? window._wlc('#C9A84C') : DP_RED; }
/* ── v1204 · Dieselbe Kette wie die Objektkarte der Haupt-App ─────────────
   Marcels Entscheidung vom 02.09.2026: „so wie in der Haupt-App."

   Vorher fehlten hier die beiden unteren Stufen: alles unter 50 hiess
   pauschal „Schwach", waehrend die Objektkarte (js/dashboard.js:390) bei
   35 noch einmal trennt und darunter KRITISCH sagt. Ein Objekt mit Score 12
   stand im Marktbericht damit in derselben Stufe wie eines mit 49.

   Woerter und Schwellen sind jetzt identisch mit der Karte; nur die
   Schreibweise unterscheidet sich, weil das hier eine 24-px-Ueberschrift
   ist und dort eine Versalien-Pille. Die Schwellen 85/70/50 decken sich
   ausserdem mit den Farbketten der Haupt-App (top/green/gold/red).

   Steht seit v1204 auch so in CLAUDE.md — dort stand bis dahin
   „STARK / SOLIDE / SCHWACH bei >= 70 / >= 50 / < 50", was weder die Karte
   noch sonst eine Stelle im Code war. */
function _scoreTier(s) {
  s = s || 0;
  return s >= 85 ? 'Top' : s >= 70 ? 'Gut' : s >= 50 ? 'Solide' : s >= 35 ? 'Schwach' : 'Kritisch';
}
function _kiRaet(s) { s = s || 0; return s >= 85 ? 'Aktiv ausbauen' : s >= 70 ? 'Kauf erwägen' : s >= 50 ? 'Genau prüfen' : 'Zurückhaltung'; }
// Donut-Ring im DealPilot-Stil: dicker Ring, tier-farbig, Score gross, Tier-Pille unten.
function svgDonut(score, conf) { /*v895-doublering*/
  const s = Math.max(0, Math.min(100, score || 0)), cx = 85, cy = 85, col = _scoreCol(s), tier = _scoreTier(s);
  const rO = 68, rI = 51, hasConf = (conf != null && !isNaN(conf)), cCol = window._wlc('#C9A84C');
  const arc = (r, pct) => {
    const p = Math.max(0, Math.min(100, pct || 0)), n = Math.max(2, Math.round(p / 100 * 90)), pts = [];
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (p / 100) * 2 * Math.PI * i / n; pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1)); }
    return pts.join(' ');
  };
  return `<svg viewBox="0 0 170 196" style="width:170px;height:196px;flex:none;">
    <circle cx="${cx}" cy="${cy}" r="80" fill="#0b0b0e"/>
    <circle cx="${cx}" cy="${cy}" r="${rO}" fill="none" stroke="#22222a" stroke-width="11"/>
    <polyline points="${arc(rO, s)}" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round" style="filter:drop-shadow(0 0 7px ${col}66);"/>
    ${hasConf ? `<circle cx="${cx}" cy="${cy}" r="${rI}" fill="none" stroke="#1b1b21" stroke-width="7.5"/>
      <polyline points="${arc(rI, conf)}" fill="none" stroke="${cCol}" stroke-width="7.5" stroke-linecap="round" style="filter:drop-shadow(0 0 5px ${cCol}55);"/>` : ''}
    <text x="${cx}" y="${cy + 2}" text-anchor="middle" fill="#fff" font-family="Space Grotesk" font-weight="700" font-size="44">${score ?? '\u2013'}</text>
    <text x="${cx}" y="${cy + 22}" text-anchor="middle" fill="#8a8a93" font-size="12">/ 100</text>
    <g transform="translate(${cx},${cy + rO + 17})">
      <rect x="-30" y="-12" width="60" height="23" rx="11.5" fill="#0a0a0c" stroke="${col}" stroke-width="1.4"/>
      <text x="0" y="4" text-anchor="middle" fill="${col}" font-family="Space Grotesk" font-weight="600" font-size="12.5">${tier}</text>
    </g>
  </svg>`;
}

function _arcPts(cx, cy, r, t0, t1, n) {
  const p = []; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, w = Math.PI * (1 - t); p.push((cx + r * Math.cos(w)).toFixed(1) + ',' + (cy - r * Math.sin(w)).toFixed(1)); }
  return p.join(' ');
}
// Halbkreis-Tacho: Skala lo..hi, Farbzonen, Zeiger bei value (+ optional Marker)
function svgGauge(value, lo, hi, opts) { /*v895d-p1*/
  opts = opts || {};
  if (lo == null || hi == null || hi <= lo || value == null) return '';
  const cx = 110, cy = 104, r = 86, t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  const _l = (typeof _mbLight === 'function') ? _mbLight() : false;
  const cNeedle = _l ? '#3a3630' : '#e8e8ea', cVal = _l ? '#2a2727' : '#e8e8ea', cCap = _l ? '#8a857c' : '#6a6a72', cLab = _l ? '#8a857c' : '#8a8a93';
  const cMk = _l ? window._wlc('#9a7d28') : '#E8E2D4', cMkS = _l ? '#ffffff' : '#0a0a0c';
  const zones = opts.zones || [[0, 0.4, window._wlc('#b8932f')], [0.4, 0.72, window._wlc('#C9A84C')], [0.72, 1, window._wlc('#E8CC7A')]];
  const arcs = zones.map(([a, b, c]) => `<polyline points="${_arcPts(cx, cy, r, a, b, 16)}" fill="none" stroke="${c}" stroke-width="12" stroke-linecap="butt"/>`).join('');
  const w = Math.PI * (1 - t), nx = cx + (r - 8) * Math.cos(w), ny = cy - (r - 8) * Math.sin(w);
  const needle = `<line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${cNeedle}" stroke-width="2.6" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="${cNeedle}"/>`;
  let marker = '';
  if (opts.marker != null) { const tm = Math.max(0, Math.min(1, (opts.marker - lo) / (hi - lo))), wm = Math.PI * (1 - tm); marker = `<circle cx="${(cx + r * Math.cos(wm)).toFixed(1)}" cy="${(cy - r * Math.sin(wm)).toFixed(1)}" r="5" fill="${cMk}" stroke="${cMkS}" stroke-width="1.6"/>`; }
  return `<svg viewBox="0 0 220 122" style="width:100%;max-width:230px;display:block;margin:0 auto;">${arcs}${marker}${needle}
    <text x="${cx}" y="${cy - 12}" text-anchor="middle" fill="${cVal}" font-family="Space Grotesk" font-weight="700" font-size="19">${opts.valueText != null ? opts.valueText : value}</text>
    ${opts.caption ? `<text x="${cx}" y="${cy + 13}" text-anchor="middle" fill="${cCap}" font-size="9">${opts.caption}</text>` : ''}
    <text x="20" y="119" text-anchor="middle" fill="${cLab}" font-size="9.5">${opts.loLabel || ''}</text>
    <text x="200" y="119" text-anchor="middle" fill="${cLab}" font-size="9.5">${opts.hiLabel || ''}</text>
  </svg>`;
}
// Spannenbalken (HTML) mit Min/Median/Max + optionalem Marker
function rangeStrip(lo, mid, hi, fmt, marker, markerLabel) {
  if (lo == null || hi == null || mid == null || hi <= lo) return '';
  const pos = (v) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  const mk = marker != null ? `<div style="position:absolute;top:-3px;left:${pos(marker)}%;transform:translateX(-50%);width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid #E8E2D4;"></div>` : '';
  const mkl = (marker != null && markerLabel) ? `<div style="font-size:10px;color:#E8E2D4;text-align:center;margin-top:2px;">${markerLabel}</div>` : '';
  return `<div style="position:relative;height:8px;border-radius:999px;margin:8px 0 4px;overflow:visible;
      background:linear-gradient(90deg,#2f4030 0%,#2f4030 34%,#3d3a24 34%,#3d3a24 66%,#3f2a24 66%,#3f2a24 100%);">
      <div style="position:absolute;top:50%;left:${pos(mid)}%;transform:translate(-50%,-50%);width:13px;height:13px;border-radius:50%;background:var(--wl-c9a84c, #C9A84C);box-shadow:0 0 0 3px #141417;"></div>${mk}</div>
    <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono';font-size:10.5px;color:#8a8a93;">
      <span>${fmt(lo)}</span><span style="color:#e8e8ea;font-weight:600;">${fmt(mid)}</span><span>${fmt(hi)}</span></div>${mkl}`;
}

// Score-Bereich: Donut + Rating + KI-rät-Zeile (DealPilot-Look)
function renderScore(d) { /*v895-doublering*/
  const ds = d.deal_score || {};
  const box = document.querySelector('.scorebox');
  if (!box) return;
  const s = ds.score || 0, col = _scoreCol(s);
  /* ── v1203 · EINE Sprache fuer EINE Zahl ────────────────────────────────
     Hier stand `ds.rating || _scoreTier(s)`. Der Ring daneben zeichnet aber
     IMMER _scoreTier — also stand am selben Score zweimal ein anderes Wort:
     „56 / 100 · Solide" direkt neben „DEAL-SCORE · Durchschnittlich".

     Gemessen sind drei Vokabulare im Haus:
       Haupt-App (dashboard.js:390) TOP / GUT / SOLIDE / SCHWACH / KRITISCH
       hier (_scoreTier)            Top / Gut / Solide / Schwach
       mb-Backend (ScoringService)  Sehr attraktiv / Attraktiv /
                                    Durchschnittlich / Unterdurchschnittlich

     Der Backend-Rating ist der Ausreisser — sein Wortschatz kommt sonst
     nirgends im Produkt vor, waehrend _scoreTier sich mit der Haupt-App
     deckt. Deshalb entscheidet ab jetzt _scoreTier, auf dem Schirm UND im
     PDF.

     Das Feld bleibt im Datensatz: der Server rechnet es weiter, alte
     Berichte behalten es, es wird nur nicht mehr ANGEZEIGT. Wer es doch
     zeigen will, muss dann auch den Ring umstellen — sonst ist der
     Widerspruch sofort zurueck. */
  const ratingText = _scoreTier(s);
  const mv = (d.valuation && d.valuation.market_value) || {};
  const confPct = (mv.confidence_pct != null) ? mv.confidence_pct : null;
  let confLbl = mv.confidence_label || null;
  /* v956-onesource: Farbe aus confInfo statt aus einer zweiten Schwellen-Kette
   * daneben — sonst faerbt der Header anders ein als die Karte darunter. */
  const _hci = (confPct != null) ? confInfo(confPct / 100, mv.confidence_parts) : null;
  if (!confLbl && _hci) confLbl = _hci.label;
  const confCol = _hci ? _hci.color : '#8a8a93';
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;width:100%;">
      ${svgDonut(ds.score, confPct)}
      <div style="flex:1;min-width:190px;">
        <div style="display:inline-block;font-size:10px;letter-spacing:1.3px;font-weight:700;color:${col};border:1px solid ${col};border-radius:999px;padding:3px 11px;margin-bottom:9px;">DEAL-SCORE</div>
        <div style="font-family:'Space Grotesk';font-weight:700;font-size:24px;color:${col};">${ratingText}</div>
        <div style="margin-top:3px;font-size:13px;color:#b8b0a0;">Markt- &amp; Chance-Risiko-Bewertung dieses Objekts</div>
        ${confPct != null ? `<div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;color:${confCol};font-weight:600;">
          <span style="width:10px;height:10px;border-radius:50%;background:${confCol};display:inline-block;box-shadow:0 0 7px ${confCol}66;"></span>
          Aussagekraft: ${confLbl || '\u2013'} \u00b7 ${confPct}%
        </div>
        <div style="display:flex;gap:15px;margin-top:10px;font-size:10.5px;color:#8a8a93;flex-wrap:wrap;">
          <span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:9px;height:9px;border-radius:2px;background:${col};display:inline-block;"></span>Score (Au\u00dfenring)</span>
          <span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:9px;height:9px;border-radius:2px;background:var(--wl-c9a84c, #C9A84C);display:inline-block;"></span>Aussagekraft (Innenring)</span>
        </div>` : ''}
      </div>
    </div>`;
}


// --- Marktwert & Marktmiete: Gauge + Spannenbalken (wie PDF) ---
function renderValuation(d) {
  const mv = (d.valuation && d.valuation.market_value) || {};
  const inp = (d.valuation && d.valuation.inputs) || {};
  const area = d.ref && d.ref.living_area;
  const kaufpreis = d.ref && d.ref.purchase_price;
  $('valBox').classList.remove('hide');
  const euro = (n) => fmt(n, ' €');
  const k = (n) => n != null ? Math.round(n / 1000) + 'k' : '';

  // -- Marktwert-Karte --
  /* v956-onesource: confidence_pct (kombiniert), NICHT mv.confidence (rohe
   * Stichprobe). Genau diese Verwechslung liess die Karte "belastbar" sagen,
   * waehrend der Header daneben "Niedrig · 47 %" anzeigte. */
  const conf = (mv.confidence_pct != null) ? (mv.confidence_pct / 100)
             : (mv.confidence != null ? mv.confidence : (d.sale && d.sale.confidence));
  const n = d.sale && d.sale.sample_size;
  const ci = confInfo(conf, mv.confidence_parts);
  const gaugeW = (mv.low != null && mv.high != null)
    ? svgGauge(mv.estimated, mv.low, mv.high, { caption: 'Lage in der Spanne', loLabel: k(mv.low), hiLabel: k(mv.high), valueText: euro(mv.estimated), marker: kaufpreis })
    : '';
  $('vwCard').innerHTML = `
    <div class="cap">Marktwert (Indikation)</div>
    ${gaugeW}
    <div class="big" style="color:var(--gold);">${euro(mv.estimated)}</div>
    <div class="sub">${mv.basis_median_sqm != null ? fmt(mv.basis_median_sqm, ' €/m²') + ' · Median' : ''}${(d.sale && d.sale.q25_per_sqm != null && d.sale.q75_per_sqm != null) ? `  ·  Spanne ${fmt(Math.round(d.sale.q25_per_sqm), '')}–${fmt(Math.round(d.sale.q75_per_sqm), ' €/m²')}` : ''}</div>
    ${rangeStrip(mv.low, mv.estimated, mv.high, euro, kaufpreis, kaufpreis != null ? 'Kaufpreis ' + euro(kaufpreis) : null)}
    ${(() => {
      const pct = mv.confidence_pct, lbl = mv.confidence_label;
      if (pct == null) {
        return ci ? `<div style="margin-top:12px;display:flex;align-items:center;gap:8px;">
            <span style="width:11px;height:11px;border-radius:50%;background:${ci.color};display:inline-block;box-shadow:0 0 8px ${ci.color}66;"></span>
            <span style="font-weight:700;color:${ci.color};">Konfidenz: ${ci.label}</span>
            ${n ? `<span style="color:#8a8a93;font-size:12px;">(${n.toLocaleString('de-DE')} Angebote)</span>` : ''}
          </div>
          <div style="color:#9a9aa2;font-size:12px;margin-top:4px;line-height:1.4;">${ci.text}</div>` : '';
      }
      const col = pct >= 70 ? '#3FA56C' : pct >= 55 ? window._wlc('#C9A84C') : '#B86250';
      const miss = mv.input_missing || [];
      return `<div style="margin-top:12px;display:flex;align-items:center;gap:8px;">
          <span style="width:11px;height:11px;border-radius:50%;background:${col};display:inline-block;box-shadow:0 0 8px ${col}66;"></span>
          <span style="font-weight:700;color:${col};">Aussagekraft: ${lbl} · ${pct}%</span>
          ${n ? `<span style="color:#8a8a93;font-size:12px;">(${n.toLocaleString('de-DE')} Vergleiche${mv.input_filled != null ? `, ${mv.input_filled}/${mv.input_total} Objektangaben` : ''})</span>` : ''}
        </div>
        <div style="color:#9a9aa2;font-size:12px;margin-top:4px;line-height:1.4;">${miss.length ? 'Genauer wird die Bewertung mit: <b style="color:var(--wl-c9a84c, #c9a84c);">' + miss.join(', ') + '</b>.' : (ci ? ci.text : 'Alle wertrelevanten Objektangaben berücksichtigt.')}</div>`;
    })()}`;

  // -- Marktmiete-Karte --
  const r = d.rent || {};
  let mmInner = '<div class="cap">Marktmiete (kalt)</div><div class="sub">–</div>';
  if (r.median_per_sqm != null && area) {
    const est = Math.round(r.median_per_sqm * area);
    const lo = r.q25_per_sqm != null ? Math.round(r.q25_per_sqm * area) : null;
    const hi = r.q75_per_sqm != null ? Math.round(r.q75_per_sqm * area) : null;
    const gaugeM = (lo != null && hi != null)
      ? svgGauge(est, lo, hi, { caption: 'Mietspanne', loLabel: lo + '€', hiLabel: hi + '€', valueText: euro(est) }) /*v895e-goldmiete*/
      : '';
    mmInner = `<div class="cap">Marktmiete kalt (Monat)</div>
      ${gaugeM}
      <div class="big">${euro(est)}</div>
      <div class="sub">${fmt(r.median_per_sqm, ' €/m²')} · Median${(r.q25_per_sqm != null && r.q75_per_sqm != null) ? `  ·  Spanne ${fmt(r.q25_per_sqm, '')}–${fmt(r.q75_per_sqm, ' €/m²')}` : ''}</div>
      ${rangeStrip(lo, est, hi, euro, null, null)}`;
  } else if (r.median_per_sqm != null) {
    mmInner = `<div class="cap">Marktmiete (kalt)</div><div class="big">${fmt(r.median_per_sqm, ' €/m²')}</div><div class="sub">kalt, Median</div>`;
  }
  $('mmCard').innerHTML = mmInner;
}

// --- Lage-/Potenzialbewertung (aus DealPilot-Daten) ---
function renderAssessment(d) {
  const a = d.assessment;
  const grid = $('assessGrid'), title = $('assessTitle');
  const rows = a ? [
    ['Mikrolage', a.mikrolage], ['Makrolage', a.makrolage], ['Bevölkerung', a.bevoelkerung],
    ['Nachfrage', a.nachfrage], ['Entwicklung', a.entwicklung], ['Wertsteigerung', a.wertsteigerung],
    ['Mietentwicklung', a.mietentwicklung],
    ['Mietausfallrisiko', a.mietausfallrisiko], ['Ausstattung', a.ausstattung], ['Vermietung', a.vermietungsstand],
  ].filter(([, v]) => v != null && v !== '') : [];

  // Task 4: Bodenrichtwert gehoert (wie im DealPilot) in die Lage-/Potenzialbewertung.
  const lv = d.land_value;
  let extra = '';
  if (lv && lv.available && lv.value_sqm != null) {
    const stich = lv.stichtag ? ' · Stichtag ' + String(lv.stichtag).slice(0, 10) : '';
    extra = `<div class="assess rate-neutral"><div class="l">Bodenrichtwert (amtlich)${lv.source ? ' · ' + lv.source : ''}${stich}</div>
       <div class="v" style="text-transform:none;"><span class="dot" style="background:var(--gold);"></span>${new Intl.NumberFormat('de-DE').format(lv.value_sqm)} €/m²</div></div>`;
  }

  // Zensus 2022: amtlicher Leerstand + Eigentuemerquote (+ Ø-Miete) als eigene Karten.
  const z = d.zensus;
  if (z && z.available) {
    const card = (label, valHtml) => `<div class="assess rate-neutral"><div class="l">${label}</div>
       <div class="v" style="text-transform:none;"><span class="dot" style="background:var(--gold);"></span>${valHtml}</div></div>`;
    const de = (n, dec) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
    if (z.leerstandsquote != null) extra += card('Leerstandsquote (Zensus 2022)', de(z.leerstandsquote, 1) + ' %');
    if (z.eigentuemerquote != null) extra += card('Eigentümerquote (Zensus 2022)', de(z.eigentuemerquote, 1) + ' %');
    if (z.nettokaltmiete_qm != null) extra += card('Ø Nettokaltmiete (Zensus 2022)', de(z.nettokaltmiete_qm, 2) + ' €/m²');
  }

  if (!rows.length && !extra) { grid.classList.add('hide'); title.classList.add('hide'); return; }
  title.classList.remove('hide'); grid.classList.remove('hide');
  grid.innerHTML = rows.map(([l, v]) =>
    `<div class="assess rate-${rateClass(l, v)}"><div class="l">${l}</div>
       <div class="v"><span class="dot"></span>${v}</div></div>`).join('') + extra;
}
function rateClass(label, val) {
  const v = String(val || '').toLowerCase();
  let cls = 'neutral';
  if (/(sehr gut|gut|hoch|stabil|steigend|positiv|wachsend|neuwertig|gehoben|vollvermietet)/.test(v)) cls = 'good';
  else if (/(begrenzt|niedrig|gering|schwach|fallend|rückläufig|negativ|leer)/.test(v)) cls = 'low';
  else if (/(mittel|durchschnitt|moderat|normal)/.test(v)) cls = 'mid';
  if (/risiko/.test(label.toLowerCase())) { if (cls === 'good') cls = 'low'; else if (cls === 'low') cls = 'good'; }
  return cls;
}

/* v895c-svgcharts : theme-aware Hochglanz-SVG-Diagramme (?theme=light|dark, Default dunkel, Hell=Weiss) */
function _mbLight(){ try{ var a=document.documentElement.getAttribute('data-mb-theme'); if(a==='light')return true; if(a==='dark')return false; }catch(e){} try{ var t=new URLSearchParams(location.search).get('theme'); if(t==='light')return true; if(t==='dark')return false; }catch(e){} return false; }
function _svgHost(el){ if(el&&el.tagName==='CANVAS'){ var d=document.createElement('div'); d.id=el.id; d.className=el.className; d.style.width='100%'; el.parentNode.replaceChild(d,el); return d; } return el; }
function _fmt(v){ return (v==null||isNaN(v)) ? '\u2013' : Number(v).toLocaleString('de-DE'); }
function _niceTicks(min,max,count){
  if(min===max){ min-=Math.abs(min||1)*0.1; max+=Math.abs(max||1)*0.1; }
  const span=(max-min)||1, step0=span/(count||4), mag=Math.pow(10,Math.floor(Math.log10(step0))), norm=step0/mag;
  let step = norm<1.5?1 : norm<3?2 : norm<7?5 : 10; step*=mag;
  const nmin=Math.floor(min/step)*step, nmax=Math.ceil(max/step)*step, ticks=[];
  for(let v=nmin; v<=nmax+step*0.5; v+=step) ticks.push(Math.round(v*1e6)/1e6);
  return {ticks, min:nmin, max:nmax};
}
function _smoothPath(pts){
  if(!pts.length) return '';
  if(pts.length<3) return 'M'+pts.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' L');
  let d='M'+pts[0].x.toFixed(1)+','+pts[0].y.toFixed(1);
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[i-1]||pts[i], p1=pts[i], p2=pts[i+1], p3=pts[i+2]||p2;
    const c1x=p1.x+(p2.x-p0.x)/6, c1y=p1.y+(p2.y-p0.y)/6;
    const c2x=p2.x-(p3.x-p1.x)/6, c2y=p2.y-(p3.y-p1.y)/6;
    d+=' C'+c1x.toFixed(1)+','+c1y.toFixed(1)+' '+c2x.toFixed(1)+','+c2y.toFixed(1)+' '+p2.x.toFixed(1)+','+p2.y.toFixed(1);
  }
  return d;
}
function _mbPalette(){
  const light = _mbLight();
  return light ? {
    light:true, panel:'#FFFFFF', panelStroke:window._wlrgbaH('#C9A84C', 0.2),
    txt:'#8a8172', txtStrong:'#4a443c', grid:'rgba(90,72,20,.10)', base:'rgba(184,147,47,.45)',
    pillBg:'#FFFFFF', pillBorder:window._wlc('#b8932f'), goldTxt:window._wlc('#9a7d28'), legBg:'rgba(120,96,30,.06)', legTxt:'#5a5348',
    lineA:window._wlc('#d9b95a'), lineB:window._wlc('#C9A84C'), lineC:window._wlc('#a8842c'), dot:window._wlc('#b8932f'), dotStroke:'#ffffff',
    areaTop:'.30', areaMid:'.12', barTop:'#d8cfbe', barBot:'#a89f8c', medTop:window._wlc('#cdae4e'), medBot:window._wlc('#a8842c'),
    stone:'#8a8172', axisGold:window._wlc('#b8932f'), bandFill:window._wlrgbaH('#C9A84C', 0.16), bandStroke:'rgba(184,147,47,.4)',
    bandTxt:window._wlc('#9a7d28'), medLine:'rgba(184,147,47,.72)', glow:2.4, topHi:'.4'
  } : {
    light:false, panel:null, panelStroke:null,
    txt:'#8a8a93', txtStrong:'#c9c9d0', grid:'rgba(255,255,255,.05)', base:window._wlrgbaH('#C9A84C', 0.28),
    pillBg:'#0c0c10', pillBorder:window._wlc('#C9A84C'), goldTxt:window._wlc('#E8CC7A'), legBg:'rgba(255,255,255,.03)', legTxt:'#c9c9d0',
    lineA:window._wlc('#E8CC7A'), lineB:window._wlc('#C9A84C'), lineC:window._wlc('#b8932f'), dot:window._wlc('#E8CC7A'), dotStroke:'#0a0a0c',
    areaTop:'.42', areaMid:'.16', barTop:'#6a625d', barBot:'#3c3835', medTop:window._wlc('#b89a3e'), medBot:window._wlc('#7a6428'),
    stone:'#A89F8E', axisGold:window._wlc('#C9A84C'), bandFill:window._wlrgbaH('#C9A84C', 0.07), bandStroke:window._wlrgbaH('#C9A84C', 0.22),
    bandTxt:window._wlrgbaH('#C9A84C', 0.75), medLine:window._wlrgbaH('#C9A84C', 0.65), glow:3.2, topHi:'.18'
  };
}
function _svgDualLine(cfg){
  const P=_mbPalette();
  const labels=cfg.labels||[], series=cfg.series||[], n=labels.length;
  const W=760, H=336, padT=48, padB=42, padL=62, padR=cfg.rightTitle?62:26;
  const plotW=W-padL-padR, plotH=H-padT-padB, x0=padL, y0=padT, x1=padL+plotW, y1=padT+plotH;
  const uid='d'+Math.random().toString(36).slice(2,7);
  const X=(i)=> x0 + (n<=1?plotW/2:plotW*i/(n-1));
  const lv=[], rv=[]; series.forEach(s=>((s.axis==='R')?rv:lv).push(...s.vals.filter(v=>v!=null&&!isNaN(v))));
  const L=_niceTicks(Math.min(...lv),Math.max(...lv),4);
  const R= rv.length ? (cfg.rightMin!=null?{ticks:[0,25,50,75,100],min:cfg.rightMin,max:cfg.rightMax}:_niceTicks(Math.min(...rv),Math.max(...rv),4)) : null;
  const yL=(v)=> y0 + plotH*(1-(v-L.min)/((L.max-L.min)||1));
  const yR=(v)=> y0 + plotH*(1-(v-R.min)/((R.max-R.min)||1));
  let defs='', body='';
  if(P.panel) body+=`<rect x="1" y="1" width="${W-2}" height="${H-2}" rx="16" fill="${P.panel}" stroke="${P.panelStroke}" stroke-width="1"/>`;
  L.ticks.forEach(tv=>{ const yy=yL(tv); if(yy<y0-1||yy>y1+1) return;
    body+=`<line x1="${x0}" y1="${yy.toFixed(1)}" x2="${x1}" y2="${yy.toFixed(1)}" stroke="${P.grid}" stroke-width="1" stroke-dasharray="1 5"/>`;
    body+=`<text x="${x0-10}" y="${(yy+3.5).toFixed(1)}" text-anchor="end" fill="${P.txt}" font-size="10.5" font-family="'JetBrains Mono',monospace">${_fmt(tv)}</text>`; });
  if(R) R.ticks.forEach(tv=>{ const yy=yR(tv); if(yy<y0-1||yy>y1+1)return;
    body+=`<text x="${x1+10}" y="${(yy+3.5).toFixed(1)}" text-anchor="start" fill="${P.stone}" font-size="10.5" font-family="'JetBrains Mono',monospace">${_fmt(tv)}</text>`; });
  body+=`<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="${P.base}" stroke-width="1"/>`;
  const step=n>9?Math.ceil(n/8):1;
  labels.forEach((lb,i)=>{ if(i%step!==0 && i!==n-1) return;
    body+=`<text x="${X(i).toFixed(1)}" y="${y1+18}" text-anchor="middle" fill="${P.txt}" font-size="10.5" font-family="'Space Grotesk',sans-serif">${lb}</text>`; });
  body+=`<text transform="translate(15,${(y0+plotH/2).toFixed(1)}) rotate(-90)" text-anchor="middle" fill="${P.axisGold}" font-size="10" font-weight="600" letter-spacing=".4">${cfg.leftTitle||''}</text>`;
  if(cfg.rightTitle) body+=`<text transform="translate(${W-13},${(y0+plotH/2).toFixed(1)}) rotate(90)" text-anchor="middle" fill="${P.stone}" font-size="10" font-weight="600" letter-spacing=".4">${cfg.rightTitle}</text>`;
  defs+=`<filter id="${uid}glow" x="-20%" y="-40%" width="140%" height="180%"><feGaussianBlur stdDeviation="${P.glow}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  series.forEach((s,si)=>{
    const yf=(s.axis==='R')?yR:yL;
    const pts=[]; s.vals.forEach((v,i)=>{ if(v!=null&&!isNaN(v)) pts.push({x:X(i),y:yf(v),v}); });
    if(!pts.length) return;
    const path=_smoothPath(pts), last=pts[pts.length-1];
    if(s.fill){
      defs+=`<linearGradient id="${uid}area${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + window._wlc('#C9A84C') + '" stop-opacity="${P.areaTop}"/><stop offset=".45" stop-color="' + window._wlc('#C9A84C') + '" stop-opacity="${P.areaMid}"/><stop offset="1" stop-color="' + window._wlc('#C9A84C') + '" stop-opacity="0"/></linearGradient>`;
      defs+=`<linearGradient id="${uid}stroke${si}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${P.lineA}"/><stop offset=".55" stop-color="${P.lineB}"/><stop offset="1" stop-color="${P.lineC}"/></linearGradient>`;
      const area=path+` L${last.x.toFixed(1)},${y1.toFixed(1)} L${pts[0].x.toFixed(1)},${y1.toFixed(1)} Z`;
      body+=`<path d="${area}" fill="url(#${uid}area${si})" opacity="0" style="animation:${uid}fade .9s .35s ease forwards"/>`;
      body+=`<path d="${path}" fill="none" stroke="url(#${uid}stroke${si})" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#${uid}glow)" stroke-dasharray="3000" stroke-dashoffset="3000" style="animation:${uid}draw 1.25s cubic-bezier(.25,.6,.2,1) forwards"/>`;
    } else {
      body+=`<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"${s.dash?' stroke-dasharray="6 5"':''} opacity="0" style="animation:${uid}fade .8s .5s ease forwards"/>`;
    }
    pts.forEach((p,pi)=>{
      const lastOne = pi===pts.length-1;
      if(lastOne && s.fill){
        body+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9" fill="' + window._wlc('#C9A84C') + '" opacity=".18"><animate attributeName="r" values="7;12;7" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".22;.05;.22" dur="2.4s" repeatCount="indefinite"/></circle>`;
        body+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.4" fill="${P.dot}" stroke="${P.dotStroke}" stroke-width="1.6"/>`;
      } else {
        body+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${s.fill?2.8:2.4}" fill="${s.color||P.dot}" stroke="${P.dotStroke}" stroke-width="1.2"/>`;
      }
    });
    if(s.fill){
      const txt=_fmt(Math.round(last.v)), pw=16+txt.length*7.2, px=Math.min(last.x+10, x1-pw), py=Math.max(last.y-30, y0+2);
      body+=`<g opacity="0" style="animation:${uid}fade .5s 1.15s ease forwards"><rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="21" rx="10.5" fill="${P.pillBg}" stroke="${P.pillBorder}" stroke-width="1.1"/><text x="${(px+pw/2).toFixed(1)}" y="${(py+14.5).toFixed(1)}" text-anchor="middle" fill="${P.goldTxt}" font-size="11" font-weight="700" font-family="'JetBrains Mono',monospace">${txt}</text></g>`;
    }
  });
  const main=series.find(s=>s.fill);
  if(main){ const a=main.vals.find(v=>v!=null), b=[...main.vals].reverse().find(v=>v!=null);
    if(a!=null&&b!=null&&a!==0){ const pct=Math.round((b/a-1)*100), up=pct>=0;
      const lbl=(up?'\u25B2 +':'\u25BC ')+pct+' %', col=up?'#3FA56C':'#B86250', bw=20+lbl.length*7;
      body+=`<g><rect x="${x0}" y="14" width="${bw}" height="22" rx="11" fill="${col}22" stroke="${col}" stroke-width="1"/><text x="${(x0+bw/2).toFixed(1)}" y="29" text-anchor="middle" fill="${col}" font-size="11.5" font-weight="700" font-family="'JetBrains Mono',monospace">${lbl}</text></g>`; }
  }
  let lx=x1, ly=25;
  series.slice().reverse().forEach(s=>{ const w=15+s.name.length*6.2; lx-=w;
    body+=`<rect x="${lx.toFixed(1)}" y="${ly-11}" width="${w-6}" height="20" rx="10" fill="${P.legBg}"/><circle cx="${(lx+9).toFixed(1)}" cy="${ly-1}" r="3.4" fill="${s.fill?window._wlc('#C9A84C'):s.color}"/><text x="${(lx+16).toFixed(1)}" y="${ly+2.5}" fill="${P.legTxt}" font-size="10.5" font-family="'Space Grotesk',sans-serif">${s.name}</text>`; lx-=6; });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;overflow:visible;"><style>@keyframes ${uid}draw{to{stroke-dashoffset:0}}@keyframes ${uid}fade{to{opacity:1}}</style><defs>${defs}</defs>${body}</svg>`;
}
function _svgBars(cfg){
  const P=_mbPalette();
  const labels=cfg.labels||[], data=cfg.data||[], median=cfg.median, hl=cfg.highlight, unit=cfg.unit||'', band=cfg.band;
  const W=760, H=358, padT=54, padB=44, padL=62, padR=24, n=labels.length;
  const plotW=W-padL-padR, plotH=H-padT-padB, x0=padL, y0=padT, x1=padL+plotW, y1=padT+plotH;
  const uid='b'+Math.random().toString(36).slice(2,7);
  const vals=data.filter(v=>v!=null); const T=_niceTicks(0,Math.max(...vals,median||0),4);
  const Y=(v)=> y0 + plotH*(1-(v-0)/((T.max)||1));
  const slot=plotW/n, bw=Math.min(58, slot*0.56);
  let defs='', body='';
  if(P.panel) body+=`<rect x="1" y="1" width="${W-2}" height="${H-2}" rx="16" fill="${P.panel}" stroke="${P.panelStroke}" stroke-width="1"/>`;
  defs+=`<linearGradient id="${uid}hl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + window._wlc('#9a751f') + '"/><stop offset=".5" stop-color="' + window._wlc('#C9A84C') + '"/><stop offset="1" stop-color="' + window._wlc('#E8CC7A') + '"/></linearGradient>`;
  defs+=`<linearGradient id="${uid}med" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${P.medBot}"/><stop offset="1" stop-color="${P.medTop}"/></linearGradient>`;
  defs+=`<linearGradient id="${uid}neu" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${P.barBot}"/><stop offset="1" stop-color="${P.barTop}"/></linearGradient>`;
  defs+=`<filter id="${uid}glow" x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation="${P.glow+0.8}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  T.ticks.forEach(tv=>{ const yy=Y(tv); if(yy<y0-1||yy>y1+1)return;
    body+=`<line x1="${x0}" y1="${yy.toFixed(1)}" x2="${x1}" y2="${yy.toFixed(1)}" stroke="${P.grid}" stroke-width="1" stroke-dasharray="1 5"/>`;
    body+=`<text x="${x0-10}" y="${(yy+3.5).toFixed(1)}" text-anchor="end" fill="${P.txt}" font-size="10.5" font-family="'JetBrains Mono',monospace">${_fmt(tv)}</text>`; });
  body+=`<text transform="translate(15,${(y0+plotH/2).toFixed(1)}) rotate(-90)" text-anchor="middle" fill="${P.txt}" font-size="10" font-weight="600">${unit}</text>`;
  if(band && band.lo!=null && band.hi!=null){ const yt=Y(band.hi), yb=Y(band.lo);
    body+=`<rect x="${x0}" y="${yt.toFixed(1)}" width="${plotW}" height="${(yb-yt).toFixed(1)}" fill="${P.bandFill}" stroke="${P.bandStroke}" stroke-width="1" stroke-dasharray="4 4"/>`;
    body+=`<text x="${x0+8}" y="${(yt+14).toFixed(1)}" fill="${P.bandTxt}" font-size="9.5" font-weight="600" font-family="'JetBrains Mono',monospace" letter-spacing=".3">TYPISCHER KORRIDOR</text>`; }
  body+=`<line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="${P.base}" stroke-width="1"/>`;
  labels.forEach((lb,i)=>{
    const cx=x0+slot*i+slot/2, v=data[i];
    if(v!=null){
      const y=Y(v), h=Math.max(0,y1-y), isHl=lb===hl, isMed=lb==='Median';
      const fill=isHl?`url(#${uid}hl)`:(isMed?`url(#${uid}med)`:`url(#${uid}neu)`);
      const flt=isHl?` filter="url(#${uid}glow)"`:'';
      body+=`<g style="transform-box:fill-box;transform-origin:center bottom;animation:${uid}grow .7s ${(0.15+i*0.07).toFixed(2)}s cubic-bezier(.2,.7,.2,1) both"><rect x="${(cx-bw/2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="7"${flt} fill="${fill}"><title>${lb}: ${_fmt(v)} ${unit}</title></rect><rect x="${(cx-bw/2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="3" rx="1.5" fill="rgba(255,255,255,${P.topHi})"/></g>`;
      body+=`<text x="${cx.toFixed(1)}" y="${(y-9).toFixed(1)}" text-anchor="middle" fill="${isHl?P.goldTxt:P.txtStrong}" font-size="10.5" font-weight="700" font-family="'JetBrains Mono',monospace" opacity="0" style="animation:${uid}fade .4s ${(0.5+i*0.07).toFixed(2)}s ease forwards">${_fmt(v)}</text>`;
      if(isHl && median!=null){
        const dp=Math.round((v/median-1)*100), below=dp<=0, col=below?'#3FA56C':'#B86250';
        const t2=(below?'':'+')+dp+' % ggü. Median', fw=18+t2.length*6.0, fx=Math.min(Math.max(cx-fw/2,x0),x1-fw), fy=y-52;
        body+=`<g opacity="0" style="animation:${uid}fade .5s 1s ease forwards"><rect x="${fx.toFixed(1)}" y="${fy.toFixed(1)}" width="${fw.toFixed(1)}" height="19" rx="9.5" fill="${P.pillBg}" stroke="${col}" stroke-width="1.1"/><text x="${(fx+fw/2).toFixed(1)}" y="${(fy+13).toFixed(1)}" text-anchor="middle" fill="${col}" font-size="10" font-weight="700" font-family="'JetBrains Mono',monospace">${t2}</text><path d="M${cx.toFixed(1)},${(fy+19).toFixed(1)} l-4,6 l8,0 z" fill="${P.pillBg}" stroke="${col}" stroke-width="1.1"/></g>`;
      }
    }
    body+=`<text x="${cx.toFixed(1)}" y="${y1+18}" text-anchor="middle" fill="${lb===hl?P.goldTxt:P.txt}" font-size="10.5" font-weight="${lb===hl?'600':'400'}" font-family="'Space Grotesk',sans-serif">${lb}</text>`;
  });
  if(median!=null){ const yy=Y(median);
    body+=`<line x1="${x0}" y1="${yy.toFixed(1)}" x2="${x1}" y2="${yy.toFixed(1)}" stroke="${P.medLine}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    const lbl='MEDIAN '+_fmt(median), pw=18+lbl.length*6.0;
    body+=`<rect x="${(x1-pw).toFixed(1)}" y="${(yy-21).toFixed(1)}" width="${pw.toFixed(1)}" height="16" rx="8" fill="${P.pillBg}" stroke="${P.bandStroke}" stroke-width="1"/><text x="${(x1-8).toFixed(1)}" y="${(yy-10).toFixed(1)}" text-anchor="end" fill="${P.axisGold}" font-size="9.5" font-weight="700" font-family="'JetBrains Mono',monospace" letter-spacing=".3">${lbl}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;overflow:visible;"><style>@keyframes ${uid}grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}@keyframes ${uid}fade{to{opacity:1}}</style><defs>${defs}</defs>${body}</svg>`;
}

// --- Marktentwicklung (echte GeoMap-Historie) ---
let histChart;
function renderHistory(d) {
  const h = d.market_history;
  const title = $('histTitle'), note = $('histNote'), cv = $('histChart');
  const hasPrice = h && h.price && h.price.some((p) => p.median != null);
  if (!h || !h.usable || !hasPrice) { title.classList.add('hide'); cv.classList.add('hide'); note.classList.add('hide'); return; }
  title.classList.remove('hide'); cv.classList.remove('hide'); note.classList.remove('hide');
  const host = _svgHost(cv);
  const years = h.price.map((p) => p.year);
  const priceS = h.price.map((p) => p.median);
  const rentS = (h.rent && h.rent.some((p) => p.median != null)) ? h.rent.map((p) => p.median) : null;
  const series = [{ name: 'Kaufpreis \u20ac/m\u00b2', vals: priceS, color: window._wlc('#C9A84C'), axis: 'L', fill: true }];
  if (rentS) series.push({ name: 'Miete \u20ac/m\u00b2', vals: rentS, color: '#A89F8E', axis: 'R', dash: true });
  host.innerHTML = _svgDualLine({ labels: years, series, leftTitle: '\u20ac/m\u00b2 KAUF', rightTitle: rentS ? '\u20ac/m\u00b2 MIETE' : null });
  const dom = d.market_dynamics && d.market_dynamics.days_on_market;
  const parts = [];
  if (h.price_cagr_pct != null) parts.push(`Preistrend: ${h.price_cagr_pct > 0 ? '+' : ''}${h.price_cagr_pct} %/Jahr seit ${h.start_year}`);
  if (h.rent_cagr_pct != null) parts.push(`Miettrend: ${h.rent_cagr_pct > 0 ? '+' : ''}${h.rent_cagr_pct} %/Jahr`);
  if (dom != null) parts.push(`\u00d8 Vermarktungsdauer: ${Math.round(dom)} Tage (Markttempo)`);
  note.textContent = parts.join('   \u00b7   ');
}

// --- Lage & Infrastruktur (6 Gruppen) ---
function renderMicro(d) {
  const groups = d.micro && d.micro.groups;
  const title = $('microTitle'), grid = $('microGrid');
  if (!groups || !Object.keys(groups).length) {
    title.classList.add('hide'); grid.classList.add('hide'); grid.innerHTML = ''; return;
  }
  title.classList.remove('hide'); grid.classList.remove('hide');
  const order = ['einkaufen', 'verkehr', 'gesundheit', 'freizeit', 'bildung', 'gastronomie'];
  const scoreColor = (s) => _scoreCol(s);
  grid.innerHTML = order.filter((k) => groups[k]).map((k) => {
    const g = groups[k];
    const items = (g.items || []).map((it) =>
      `<div style="display:flex;justify-content:space-between;font-size:12px;color:#b8b8c0;padding:1px 0;">
         <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%;">${it.name}</span>
         <span style="color:#8a8a93;">${it.distance_m} m</span></div>`).join('');
    return `<div style="background:#141418;border:1px solid #26262c;border-radius:12px;padding:12px 14px;">
       <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
         <span style="font-family:'Space Grotesk';font-weight:600;color:#e8e8ea;">${g.label}</span>
         <span style="font-weight:700;color:${scoreColor(g.score)};">${g.score5 ?? '–'}<span style="font-size:11px;color:#8a8a93;">/5</span>${g.score != null ? `<span style=\"font-size:11px;color:#8a8a93;\"> · ${g.score}/100</span>` : ''}</span>
       </div>${items || '<div style="font-size:12px;color:#8a8a93;">keine Orte gefunden</div>'}</div>`;
  }).join('');
}

// --- Marktwert-Verlauf dieses Objekts (aus gespeicherten Snapshots) ---
let objHistChartObj = null;
async function renderObjectHistory(out) {
  const key = out && out.object_key;
  const t = $('objHistTitle'), c = $('objHistChart'), note = $('objHistNote');
  if (!key) { [t, c, note].forEach((e) => e.classList.add('hide')); return; }
  let hist = [];
  try { const res = await fetch(API + '/objects/history?key=' + encodeURIComponent(key)); const j = await res.json(); hist = j.history || []; } catch { return; }
  if (hist.length < 2) {
    t.classList.remove('hide'); note.classList.remove('hide'); c.classList.add('hide');
    note.textContent = 'Erster gespeicherter Stand. Der Marktwert-Verlauf wird ab dem n\u00e4chsten Bericht f\u00fcr dieses Objekt sichtbar.';
    return;
  }
  [t, c, note].forEach((e) => e.classList.remove('hide'));
  const host = _svgHost(c);
  const labels = hist.map((h) => new Date(h.created_at).toLocaleDateString('de-DE'));
  const mv = hist.map((h) => h.market_value);
  const sc = hist.map((h) => h.deal_score);
  host.innerHTML = _svgDualLine({ labels,
    series: [ { name: 'Marktwert \u20ac', vals: mv, color: window._wlc('#C9A84C'), axis: 'L', fill: true },
              { name: 'Deal-Score', vals: sc, color: '#3FA56C', axis: 'R' } ],
    leftTitle: 'MARKTWERT \u20ac', rightTitle: 'SCORE', rightMin: 0, rightMax: 100 });
  note.textContent = hist.length + ' gespeicherte St\u00e4nde \u00b7 \u00e4ltester ' + labels[0] + ', neuester ' + labels[labels.length - 1];
}

/* WDAT-2 · Schnappschuss aller Eingabefelder, auch der dynamisch
 * erzeugten. Kein fester Namensliste — was im Formular steht, kommt mit. */
function _sammleEingaben() {
  const o = {};
  document.querySelectorAll('input[id], select[id], textarea[id]').forEach((e) => {
    if (e.type === 'file' || e.type === 'button' || e.type === 'submit') return;
    if (/^(mz-|lf|dpktFile|loadFileInput)/.test(e.id)) return;
    o[e.id] = (e.type === 'checkbox') ? !!e.checked : e.value;
  });
  o._stufe = (window.Wertermittlung && window.Wertermittlung.stufe) ? window.Wertermittlung.stufe() : 1;
  return o;
}

function _setzeEingaben(o) {
  if (!o) return;
  /* Erst die Stufe, dann die Felder: die Wertermittlungsfelder gibt es
   * nur, wenn die Stufe sie erzeugt hat. */
  if (o._stufe && window.Wertermittlung && window.Wertermittlung.setStufe) {
    try { window.Wertermittlung.setStufe(Number(o._stufe)); } catch (e) {}
  }
  const setzen = () => {
    Object.keys(o).forEach((k) => {
      if (k === '_stufe') return;
      const e = document.getElementById(k);
      if (!e) return;
      if (e.type === 'checkbox') e.checked = !!o[k];
      else e.value = o[k] == null ? '' : o[k];
    });
    /* Damit Ampel, Pflichtfeld-Sperre und abhaengige Bloecke nachziehen. */
    ['ptype', 'area', 'year', 'baustatus', 'mea'].forEach((id) => {
      const e = document.getElementById(id);
      if (e) e.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };
  setzen();
  setTimeout(setzen, 60);   // nach dem Neuzeichnen der Stufenfelder
}

// --- .dpkt-Upload -> Bericht aus DealPilot-Objekt ---
$('dpktDrop').addEventListener('click', () => $('dpktFile').click());
$('dpktFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]; if (!file) return;
  $('errBox').classList.add('hide');
  try {
    const json = JSON.parse(await file.text());
    const obj = Array.isArray(json) ? json[0] : (json.object || json);
    fillInputsFromDpkt(obj);   // Eingabefelder sichtbar befüllen
    // "Genauere Angaben" aufklappen, damit man sofort ergänzen kann
    const box = $('precBox'), caret = $('precCaret');
    if (box) box.style.display = 'block';
    if (caret) caret.textContent = '\u25BE';
    if (typeof window._precUpd === 'function') window._precUpd();
    // Signal: Objekt geladen, ergänzen + weiterklicken
    const sig = $('loadSignal');
    if (sig) {
      sig.classList.remove('hide');
      sig.innerHTML = '\u2713 <b>Objekt geladen</b> \u2014 die Felder sind ausgefüllt. '
        + 'Du kannst unter <b>\u201eGenauere Angaben\u201c</b> noch ergänzen (Zustand, Ausstattung, Stellplätze, Aufzug \u2026) '
        + 'und dann auf <b>\u201eMarktbericht erstellen\u201c</b> klicken.';
    }
    const btn = $('goBtn');
    if (btn) { btn.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent)'; btn.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  } catch (err) {
    $('errBox').textContent = '\u2717 ' + err.message; $('errBox').classList.remove('hide');
  } finally {
    e.target.value = '';
  }
});

// Eingabefelder aus einem DealPilot-Objekt vorbefuellen, damit sichtbar ist, was geladen wurde.
// Task 6: geladenen Bericht (Replay/.dpkt/Generate) in die Eingabefelder spiegeln,
// damit immer sichtbar ist, um WELCHES Objekt es geht.
/* v895d-saveobj: Marktbericht -> Portfolio-Objekt (POST /objects mit ji_token, same-origin) */
var _mbObjartMap = { ETW:'etw', EFH:'efh', MFH:'mfh', DHH:'dhh', RH:'rh', BUERO:'gewerbe', GESCH:'gewerbe', HOTEL:'gewerbe', GEW:'gewerbe', GAR:'garage' };
function _mbParseAddr(a) {
  a = (a || '').trim(); var str='', hnr='', plz='', ort='';
  var parts = a.split(','); var p0 = (parts[0] || '').trim();
  var m = p0.match(/^(.*?)\s+(\d+\s*[a-zA-Z]?)$/);
  if (m) { str = m[1].trim(); hnr = m[2].replace(/\s+/g, ''); } else { str = p0; }
  var rest = parts.slice(1).join(',').trim();
  var mp = rest.match(/(\d{5})\s+(.+)/);
  if (mp) { plz = mp[1]; ort = mp[2].trim(); } else if (rest) { ort = rest; }
  return { str: str, hnr: hnr, plz: plz, ort: ort };
}
function _mbBuildObjData() {
  var val = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  var a = _mbParseAddr(val('address')); var ptype = val('ptype');
  var data = {
    plz: a.plz, ort: a.ort, str: a.str, hnr: a.hnr,
    objart: _mbObjartMap[ptype] || 'etw',
    wfl: val('area'), baujahr: val('year'), zimmer: val('rooms'), etage: val('floor'),
    gsfl: val('plot'), einheiten: val('units'),
    kp: val('price'), nkm: val('rent'),
    ds2_energie: (val('energy') || '').toUpperCase(),
    /* WFELD-3 · Rueckweg. Bisher eine Einbahnstrasse: was im Marktbericht
     * ergaenzt wurde, landete nicht im Objekt und musste beim naechsten
     * Bericht erneut getippt werden. */
    garagen: val('garages'), stellpl_aussen: val('outdoor'),
    balkon: val('balcony'), garten: val('garden'), baeder: val('baths'),
    ausstattung: val('quality'), modernis: val('modyear'),
    eq_roof: val('eq_roof'), eq_walls: val('eq_walls'), eq_windows: val('eq_windows'),
    eq_heating: val('eq_heating'), eq_bath: val('eq_bath'), eq_floor: val('eq_floor'),
    eq_guest_wc: val('eq_guest_wc'), eq_store_room: val('eq_store_room'),
    baustatus: val('baustatus'), mea_pct: val('mea'), lzs_pct: val('lzs'),
    /* v1072-WSAV-1 · _mbBuildObjData sammelt ueber DOM-Ids ein und kannte
     * die Felder aus v1067 bis v1072 nicht. Der BERICHT rechnete damit —
     * er bekommt payload() als Ganzes —, das gespeicherte
     * Portfolio-Objekt verlor sie. Beim naechsten Oeffnen waren die
     * 828 m2 Hinterland weg. */
    hinterland_qm: val('hinterlandFlaeche'), hinterland_eur_qm: val('hinterlandWert'),
    hinterland_rentierlich: val('hinterlandRent'),
    garagen_bgf_qm: val('garagenBgf'), garagen_stufe: val('garagenStufe'),
    aussenanlagen_pct: val('aussenPct'),
    nhk_haus: val('nhkHaus'), nhk_geschosse: val('nhkGeschosse'), nhk_dach: val('nhkDach'),
    /* v1074-WSAV-1 · Rueckweg ins Portfolio fuer die 14 neuen Felder —
     * dieselbe Lehre wie v1072-WSAV-1: der Bericht bekommt payload(), das
     * gespeicherte Objekt bekommt NUR, was hier steht. */
    ausst_aussenwaende: val('ausstAussenwaende'), ausst_dach: val('ausstDach'),
    ausst_fenster: val('ausstFenster'), ausst_innenwaende: val('ausstInnenwaende'),
    ausst_decken: val('ausstDecken'), ausst_fussboeden: val('ausstFussboeden'),
    ausst_sanitaer: val('ausstSanitaer'), ausst_heizung: val('ausstHeizung'),
    ausst_technik: val('ausstTechnik'),
    btl_gauben: val('btlGauben'), btl_balkone: val('btlBalkone'),
    btl_vordach: val('btlVordach'), btl_terrassen: val('btlTerrassen'),
    btl_sonstige: val('btlSonstige'),
    /* WSAVE31-1 · die restlichen zehn */
    brw_manuell: val('brwManuell'), brw_stichtag: val('brwStichtag'),
    brw_anpassung_pct: val('brwAnp'), brw_anpassung_grund: val('brwAnpGrund'),
    stellplatz_miete_monat: val('spMiete'), sanierungsjahr: val('sanierungsjahr'),
    zustand: val('cond'), nutzung: val('usage'), modernis_grad: val('modern'),
    /* v1052-WFELD-1 · Seit v1047 stehen diese drei im Formular und wurden
     * nie eingesammelt. Standardstufe 4 eingetragen, Bericht meldete
     * "Standardstufe fehlt"; Modernisierungsgrad gesetzt, gerechnet wurde
     * weiter mit der Schaetzung. Ein Feld, dessen Wert nicht ankommt, ist
     * schlimmer als keins — es sieht aus, als haette man es angegeben. */
    standardstufe: val('standardstufe'),
    grundriss: val('grundriss'),
    mod_punkte: val('modGrad'),
    /* v1121-WSAV-1 · Der Abgleich beider Seiten, den der Backlog verlangt
     * ("Beide Seiten gegeneinander zaehlen, bevor ein Reiter gebaut wird").
     * Gezaehlt: fuenf Felder stehen in payload(), rechnen also im BERICHT
     * mit — und fehlten hier, gingen im gespeicherten Objekt also verloren.
     * Das ist dieselbe Lehre wie v1072-WSAV-1 und v1074-WSAV-1, zum
     * dritten Mal. Die Namen sind genau die, die payload() ohnehin an das
     * Berichts-Backend schickt; nichts wird neu benannt.
     *
     *   Feld              payload() sendet als
     *   bgf               bgf
     *   sonstEinnahmen    sonstige_jahr
     *   aussenanlagen     aussenanlagen
     *   besBauteile       bes_bauteile
     *   sachwertfaktor    sachwertfaktor
     */
    bgf: val('bgf'),
    sonstige_jahr: val('sonstEinnahmen'),
    aussenanlagen: val('aussenanlagen'),
    bes_bauteile: val('besBauteile'),
    sachwertfaktor: val('sachwertfaktor'),
    eq_elevator: (function () {
      var e = document.getElementById('elevator');
      if (!e) return null;
      return (e.type === 'checkbox' ? e.checked : /^(ja|1|true)$/i.test(e.value)) ? 1 : 0;
    })(),
    _mb_source: 'marktbericht'
  };
  Object.keys(data).forEach(function (k) { if (data[k] == null || data[k] === '') delete data[k]; });
  return data;
}
/* v942-mbrep: Dialog "Dieses Objekt gibt es schon".
 * Bis v941 legte JEDER Klick wortlos ein neues Objekt an — auch beim zehnten
 * Mal und auch dann, wenn das Objekt zwei Minuten vorher aus genau diesem
 * Bestand ins Formular geladen wurde (die id war bekannt und wurde ignoriert).
 * "Aktualisieren" setzt NUR svwert + Marktdaten: die Handeingaben (kp, nkm, ze,
 * Finanzierung, Steuer) sind Arbeit, der Bericht ist eine Indikation. */
function _mbAskExisting(ref, label) {
  return new Promise(function (resolve) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(6,6,8,.66);display:flex;align-items:center;justify-content:center;padding:20px;z-index:99999';
    var run = 'linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f))';
    var opt = 'display:flex;align-items:flex-start;gap:11px;border:1.5px solid rgba(42,39,39,.12);border-radius:11px;padding:11px 13px;cursor:pointer;background:#fff;text-align:left;width:100%;font-family:inherit';
    ov.innerHTML =
      '<div style="width:100%;max-width:475px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 40px 90px -30px rgba(0,0,0,.75)">'
      + '<div style="background:#0a0a0a;padding:9px 16px;display:flex;align-items:center;justify-content:space-between">'
      +   '<span style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:14px;color:#fff">Deal<span style="background:'+run+';-webkit-background-clip:text;background-clip:text;color:transparent">Pilot</span></span>'
      +   '<button data-a="x" style="background:none;border:none;color:#7d7668;font-size:19px;cursor:pointer;line-height:1">\u00d7</button></div>'
      + '<div style="background:'+run+';padding:15px 20px">'
      +   '<h3 style="font-family:\'Space Grotesk\',sans-serif;margin:0;font-size:19px;color:#1a1407">Dieses Objekt gibt es schon</h3>'
      +   '<p style="margin:4px 0 0;font-size:12.5px;color:#4a3d18">Der Marktbericht geh\u00f6rt zu einem Objekt in deinem Bestand.</p></div>'
      + '<div style="padding:18px 20px 19px">'
      +   '<div style="border:1px solid rgba(42,39,39,.12);border-radius:11px;padding:11px 13px;background:#F8F6F1;margin-bottom:15px;font-size:13px;font-weight:600;color:#2A2727">'+String(label||ref).replace(/</g,'&lt;')+'</div>'
      +   '<button data-a="upd" style="'+opt+'"><span style="width:26px;height:26px;border-radius:7px;display:grid;place-items:center;flex-shrink:0;background:#F8F6F1;border:1px solid rgba(42,39,39,.12);color:var(--wl-9a7f33, #9a7f33)">\u21bb</span>'
      +     '<span><span style="font-family:\'Space Grotesk\',sans-serif;font-size:13px;font-weight:600;color:#2A2727;display:block;margin-bottom:2px">Objekt aktualisieren</span>'
      +     '<span style="font-size:11.5px;color:#8a8378;line-height:1.45;display:block">Setzt den Marktwert. Finanzierung, Miete und Steuerdaten bleiben unangetastet.</span></span></button>'
      +   '<button data-a="new" style="'+opt+';margin-top:9px"><span style="width:26px;height:26px;border-radius:7px;display:grid;place-items:center;flex-shrink:0;background:#F8F6F1;border:1px solid rgba(42,39,39,.12);color:#B86250">\uff0b</span>'
      +     '<span><span style="font-family:\'Space Grotesk\',sans-serif;font-size:13px;font-weight:600;color:#2A2727;display:block;margin-bottom:2px">Trotzdem neu anlegen</span>'
      +     '<span style="font-size:11.5px;color:#8a8378;line-height:1.45;display:block">Zweites Objekt mit derselben Adresse \u2014 z.B. f\u00fcr eine andere Einheit im Haus.</span></span></button>'
      +   '<button data-a="x" style="margin-top:13px;width:100%;background:none;border:none;color:#8a8378;font-size:12.5px;cursor:pointer;font-family:inherit;padding:7px">Abbrechen</button>'
      + '</div></div>';
    function done(v) { try { ov.remove(); } catch (e) {} document.removeEventListener('keydown', esc); resolve(v); }
    function esc(e) { if (e.key === 'Escape') done(null); }
    ov.addEventListener('click', function (e) {
      if (e.target === ov) return done(null);
      var b = e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-a');
      done(a === 'x' ? null : a);
    });
    document.addEventListener('keydown', esc);
    document.body.appendChild(ov);
  });
}

async function _mbSaveAsObject(btn) {
  var tok = ''; try { tok = localStorage.getItem('ji_token') || ''; } catch (e) {}
  if (!tok) { alert('Bitte zuerst im DealPilot-Cockpit einloggen, dann erneut speichern.'); return; }
  var data = _mbBuildObjData();
  if (!data.str && !data.ort) { alert('Bitte zuerst eine Adresse eingeben.'); return; }
  /* v942-mbrep: kennen wir das Objekt schon? Dann fragen statt duplizieren. */
  var _ref = _mbRef();
  if (_ref) {
    var _w = await _mbAskExisting(_ref, window._mbwLabel);
    if (!_w) { return; }
    if (_w === 'upd') { return _mbUpdateObject(btn, _ref); }
  }
  var aiText = null; try { var o = window._lastOut; if (o && o.report_md) aiText = o.report_md; } catch (e) {}
  var old = btn.textContent; btn.textContent = 'Speichere…'; btn.disabled = true;
  try {
    var res = await fetch('/api/v1/objects', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
      body: JSON.stringify({ data: data, aiAnalysis: aiText, photos: [] })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    await res.json();
    btn.textContent = '\u2713 Im Portfolio gespeichert'; btn.disabled = true;
  } catch (e) {
    try { console.error('[mb saveObj]', e); } catch (_) {}
    btn.textContent = 'Fehler \u2014 erneut?'; btn.disabled = false;
    setTimeout(function () { btn.textContent = old; }, 2600);
  }
}
/* v942-mbrep: nur svwert + Marktdaten. PATCH statt PUT waere schoener, aber
 * /api/v1/objects/:id nimmt PUT mit {data} — wir lesen, mergen, schreiben. */
async function _mbUpdateObject(btn, ref) {
  var tok = ''; try { tok = localStorage.getItem('ji_token') || ''; } catch (e) {}
  var old = btn.textContent; btn.textContent = 'Aktualisiere\u2026'; btn.disabled = true;
  try {
    var g = await fetch('/api/v1/objects/' + encodeURIComponent(ref), { headers: { Authorization: 'Bearer ' + tok } });
    if (!g.ok) throw new Error('HTTP ' + g.status);
    var o = await g.json(); var cur = (o.item || o.object || o);
    var d = Object.assign({}, cur.data || {});
    var o2 = window._lastOut, mv = null;
    try { mv = o2 && o2.data && o2.data.valuation && o2.data.valuation.market_value && o2.data.valuation.market_value.estimated; } catch (e) {}
    if (mv != null) d.svwert = Math.round(mv);
    var res = await fetch('/api/v1/objects/' + encodeURIComponent(ref), {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({ data: d })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    btn.textContent = '\u2713 Objekt aktualisiert'; btn.disabled = true;
  } catch (e) {
    try { console.error('[mb updObj]', e); } catch (_) {}
    btn.textContent = 'Fehler \u2014 erneut?'; btn.disabled = false;
    setTimeout(function () { btn.textContent = old; }, 2600);
  }
}

function _installMbSaveObject() {
  var anchor = document.getElementById('saveFileBtn');
  if (!anchor || document.getElementById('mbSaveObjBtn')) return;
  var b = document.createElement('button'); b.id = 'mbSaveObjBtn'; b.type = 'button'; b.textContent = '\u2605 Als Objekt speichern';
  b.style.cssText = 'flex:1 1 100%;min-width:104px;margin-bottom:8px;border:none;border-radius:999px;padding:10px 14px;font-size:12px;font-weight:700;cursor:pointer;color:#1a1508;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));';
  b.addEventListener('click', function () { _mbSaveAsObject(b); });
  anchor.parentNode.insertBefore(b, anchor);
}
/* v895f-reportslist: Liste vorhandener Marktberichte zu diesem Objekt (links) + Abruf via /reports/one */
function _mbAuth(){ try{ var t=localStorage.getItem('ji_token')||''; return t?{Authorization:'Bearer '+t}:{}; }catch(e){ return {}; } } /* v942 */
function _mbFmtDate(s){ try{ var d=new Date(s); return d.toLocaleDateString('de-DE')+' '+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return s||''; } }
function _mbEnsureReportsPanel(){
  var p=document.getElementById('mbReportsPanel'); if(p) return p;
  /* v943-layout
   * ────────────────────────────────────────────────────────────────────────
   * NICHT ins Grid haengen! .grid ist zweispaltig (380px 1fr). Ein drittes
   * Kind schiebt das Formular in die 1fr-Spalte und das Ergebnis in die
   * naechste Zeile auf 380px. Genau das ist bis v942 passiert.
   * Anker ist deshalb das Grid selbst — die Liste kommt DAVOR, als
   * Geschwister in #view-report: volle Breite, direkt unter der Karte.
   */
  var target=document.querySelector('#view-report .grid')||document.querySelector('.grid');
  if(!target||!target.parentNode) return null;
  if(!document.getElementById('mbReportsStyle')){
    var st=document.createElement('style'); st.id='mbReportsStyle';
    /* v942-mbrep: Look = Deal-Aktion-Tab (.dab-panel/.dab-doc-row), reinweiss,
       Gold ueber var(--wl-<hex>, #<hex>) — die W30-Konvention. Alle vier Toene
       (C9A84C/E8CC7A/b8932f/9a7f33) stehen bereits in WL_TINTS, die Liste
       bleibt unangetastet. */
    st.textContent='#mbReportsPanel{background:#fff}'
     +'#mbReportsPanel .mbrep-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}'
     +'#mbReportsPanel .mbrep-h{font-family:"Space Grotesk",sans-serif;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33)}'
     +'#mbReportsPanel .mbrep-h b{color:#2A2727;font-family:"JetBrains Mono",monospace}'
     +'#mbReportsPanel .mbrep-f{display:inline-flex;border:1.5px solid rgba(42,39,39,.12);border-radius:9px;overflow:hidden;background:#fff}'
     +'#mbReportsPanel .mbrep-f button{font-family:"Space Grotesk",sans-serif;font-weight:600;font-size:11.5px;color:#8a8378;background:transparent;border:none;padding:6px 14px;cursor:pointer;border-radius:0}'
     +'#mbReportsPanel .mbrep-f button.on{background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));color:#1a1508}'
     +'#mbReportsPanel .mbrep-row{display:flex;align-items:center;gap:14px;padding:14px 4px;border-top:1px solid rgba(42,39,39,.1)}'
     +'#mbReportsPanel .mbrep-row:first-of-type{margin-top:14px}'
     +'#mbReportsPanel .mbrep-icb{width:44px;height:44px;border-radius:11px;background:#F8F6F1;border:1px solid rgba(42,39,39,.12);display:flex;align-items:center;justify-content:center;color:var(--wl-9a7f33, #9a7f33);flex-shrink:0}'
     +'#mbReportsPanel .mbrep-main{flex:1;min-width:0}'
     +'#mbReportsPanel .mbrep-l1{display:flex;align-items:center;gap:8px;margin-bottom:3px}'
     +'#mbReportsPanel .mbrep-kz{font-family:"Space Grotesk",sans-serif;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#1a1508;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));border-radius:4px;padding:2px 6px;white-space:nowrap}'
     +'#mbReportsPanel .mbrep-kz.none{background:none;border:1px dashed rgba(42,39,39,.28);color:#8a8378}'
     +'#mbReportsPanel .mbrep-addr{font-size:13.5px;font-weight:600;color:#2A2727;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
     +'#mbReportsPanel .mbrep-date{font-family:"JetBrains Mono",monospace;font-size:11px;color:#8a8378}'
     +'#mbReportsPanel .mbrep-mv{font-family:"JetBrains Mono",monospace;font-size:14.5px;font-weight:700;color:#2A2727;white-space:nowrap;text-align:right}'
     +'#mbReportsPanel .mbrep-mv small{display:block;font-family:"Space Grotesk",sans-serif;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--wl-9a7f33, #9a7f33);margin-top:2px}'
     +'#mbReportsPanel .mbrep-mv.nod{color:#8a8378;font-weight:500;font-size:11.5px}'
     +'#mbReportsPanel .mbrep-act{display:flex;gap:7px;flex-shrink:0}'
     +'#mbReportsPanel .mbrep-act button{font-family:"Space Grotesk",sans-serif;font-size:11.5px;font-weight:600;border:1.5px solid rgba(42,39,39,.12);background:#fff;color:#2A2727;border-radius:9px;padding:7px 13px;cursor:pointer}'
     +'#mbReportsPanel .mbrep-act button:hover{border-color:var(--wl-c9a84c, #C9A84C);color:var(--wl-9a7f33, #9a7f33)}'
     +'#mbReportsPanel .mbrep-empty{color:#8a8378;font-size:12.5px;padding:16px 4px;border-top:1px solid rgba(42,39,39,.1);margin-top:14px}'
     /* v944-collapse: KEINE zwei Spalten — ein Bericht pro Zeile. "Volle Breite"
        heisst volle Breite fuer die Zeile, nicht zwei Zeilen nebeneinander. */
     +'#mbReportsPanel .mbrep-list{display:none}'
     +'#mbReportsPanel.open .mbrep-list{display:block}'
     +'#mbReportsPanel .mbrep-tog{display:inline-flex;align-items:center;gap:7px;font-family:"Space Grotesk",sans-serif;font-size:11.5px;font-weight:600;color:#8a8378;background:none;border:none;cursor:pointer;padding:6px 2px}'
     +'#mbReportsPanel .mbrep-tog:hover{color:var(--wl-9a7f33, #9a7f33)}'
     +'#mbReportsPanel .mbrep-tog .chev{display:inline-block;transition:transform .18s;font-size:9px}'
     +'#mbReportsPanel.open .mbrep-tog .chev{transform:rotate(90deg)}'
     +'#mbReportsPanel:not(.open) .mbrep-top{padding-bottom:0}'
     /* v967-delcss: Loeschen grau in Ruhe, rot beim Hover — Rot ist Statusfarbe,
        bleibt hart (keine WL_TINTS). */
     +'#mbReportsPanel .mbrep-del{width:34px;height:34px;flex:0 0 auto;border:1px solid rgba(42,39,39,.16);border-radius:9px;background:none;color:#9a9288;font-size:14px;line-height:1;cursor:pointer}'
     +'#mbReportsPanel .mbrep-del:hover{color:#B8625C;border-color:#B8625C;background:#FBF3F2}'
     +'@media(max-width:600px){#mbReportsPanel .mbrep-row{flex-wrap:wrap}#mbReportsPanel .mbrep-mv{text-align:left}}';
    document.head.appendChild(st);
  }
  p=document.createElement('div'); p.className='panel'; p.id='mbReportsPanel'; p.style.display='none'; /* v942: wird von _mbLoadReportsList gesteuert */
  p.style.margin='0 0 22px';                 /* v943: gleicher Abstand wie .grid gap */
  target.parentNode.insertBefore(p, target);  /* VOR dem Grid -> volle Breite */
  return p;
}
async function _mbOpenReport(rid, asPdf){
  try{
    var res=await fetch(API + '/reports/one?id=' + encodeURIComponent(rid), { headers:_mbAuth() }); /* v942 */
    if(!res.ok) throw new Error('HTTP '+res.status);
    var out=await res.json(); render(out);
    if(asPdf){ try{ await exportPdf(out); }catch(e){ alert('PDF-Fehler: '+e.message); } }
    else { _mbScrollTop(); } /* v945-scroll */
  }catch(e){
    /* v949-autopdf: im Offscreen-Betrieb gibt es niemanden, der ein alert() sieht.
     * Fehler nach oben durchreichen, statt ihn in einem unsichtbaren iframe zu begraben. */
    var _off = false; try { _off = new URLSearchParams(location.search).get('autopdf') === '1'; } catch (x) {}
    if (_off) throw e;
    alert('Bericht konnte nicht geladen werden: '+e.message);
  }
}
/* v942-mbrep: Liste — EIN Aufruf-Pfad, drei Ausloeser (Boot, Objektwahl, nach
 * dem Erstellen). Bis v941 gab es ZWEI Pfade, die verschiedene Spalten
 * abfragten: Boot fragte ?ref=external_ref (fand nie was, weil dort das
 * Kuerzel stand), render() fragte ?key=object_key (fand die geo-Gruppe).
 * Deshalb erschien die Tabelle erst NACH dem Erstellen. */
var _mbRepScope = 'obj';   /* 'obj' | 'all' */
/* v944-collapse: zugeklappt per Default. Der Marktbericht ist die Hauptsache,
   die Historie das Nachschlagewerk — die soll nicht jedes Mal den Blick verstellen.
   Entscheidung haelt ueber Neuladen. */
var _mbRepOpen = (function(){ try{ return localStorage.getItem('dp_mbrep_open') === '1'; }catch(e){ return false; } })();
var _mbRepLast  = null;    /* letzte {key,ref} fuer Neuzeichnen beim Umschalten */

function _mbEur(n){ try{ return new Intl.NumberFormat('de-DE').format(Math.round(n))+' \u20ac'; }catch(e){ return String(n); } }
var _MB_DOC_ICO = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">'
  + '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>';

function _mbRepRow(h){
  var kz = h.object_label
    ? '<span class="mbrep-kz">'+String(h.object_label).replace(/</g,'&lt;')+'</span>'
    : '<span class="mbrep-kz none">ohne Objekt</span>';
  var addr = String(h.address || 'Adresse unbekannt').replace(/</g,'&lt;');
  var mv = (h.market_value != null && h.market_value !== '')
    ? '<div class="mbrep-mv">'+_mbEur(h.market_value)+'<small>Marktwert</small></div>'
    : '<div class="mbrep-mv nod">keine Daten</div>';
  return '<div class="mbrep-row"><span class="mbrep-icb">'+_MB_DOC_ICO+'</span>'
    + '<div class="mbrep-main"><div class="mbrep-l1">'+kz+'<span class="mbrep-addr">'+addr+'</span></div>'
    + '<span class="mbrep-date">'+_mbFmtDate(h.created_at)+'</span></div>'+mv
    + '<span class="mbrep-act"><button type="button" class="mbrep-view" data-rid="'+h.report_id+'">Ansehen</button>'
    + '<button type="button" class="mbrep-pdf" data-rid="'+h.report_id+'">PDF</button>'
    /* v967-delbtn: endgueltig loeschen — Rueckfrage in _mbDeleteReport(). */
    + '<button type="button" class="mbrep-del" title="Bericht endg\u00fcltig l\u00f6schen" data-rid="'+h.report_id+'">\u2715</button></span></div>';
}

async function _mbLoadReportsList(opts){
  opts=opts||{};
  if(opts.scope) _mbRepScope=opts.scope;
  if(opts.key||opts.ref) _mbRepLast={key:opts.key||null, ref:opts.ref||null};
  var host=_mbEnsureReportsPanel(); if(!host) return;

  var key=(_mbRepLast&&_mbRepLast.key)||null;
  var ref=(_mbRepLast&&_mbRepLast.ref)||_mbRef();
  var qs='';
  if(_mbRepScope==='obj'){
    if(key) qs='key='+encodeURIComponent(key);
    else if(ref) qs='ref='+encodeURIComponent(ref);
  }
  /* scope==='all' -> ohne key/ref: die Route liefert ALLE Berichte DIESES Users
     (User-Filter sitzt im mb-Backend, v942-userbind). */

  function head(n){
    /* v944-collapse: Kopf zeigt Anzahl + Klapp-Umschalter. Filter nur sichtbar,
       wenn aufgeklappt — zugeklappt waere er sinnlos. */
    return '<div class="mbrep-top"><span class="mbrep-h">Vorhandene Marktberichte <b>('+n+')</b></span>'
      + '<span style="display:flex;align-items:center;gap:12px">'
      + (_mbRepOpen ? ('<span class="mbrep-f"><button type="button" data-scope="obj"'+(_mbRepScope==='obj'?' class="on"':'')+'>Dieses Objekt</button>'
      + '<button type="button" data-scope="all"'+(_mbRepScope==='all'?' class="on"':'')+'>Alle</button></span>') : '')
      + '<button type="button" class="mbrep-tog"><span class="chev">\u25B6</span>'+(_mbRepOpen?'Zuklappen':'Anzeigen')+'</button>'
      + '</span></div>';
  }
  function wire(){
    host.classList.toggle('open', !!_mbRepOpen);   /* v944-collapse */
    var tg = host.querySelector('.mbrep-tog');
    if (tg) tg.addEventListener('click', function(){
      _mbRepOpen = !_mbRepOpen;
      try { localStorage.setItem('dp_mbrep_open', _mbRepOpen ? '1' : '0'); } catch(e){}
      _mbLoadReportsList({});
    });
    host.querySelectorAll('.mbrep-f button').forEach(function(b){
      b.addEventListener('click',function(){ _mbLoadReportsList({scope:b.getAttribute('data-scope')}); });
    });
    host.querySelectorAll('.mbrep-view').forEach(function(b){ b.addEventListener('click',function(){ _mbOpenReport(b.getAttribute('data-rid'),false); }); });
    host.querySelectorAll('.mbrep-pdf').forEach(function(b){ b.addEventListener('click',function(){ _mbOpenReport(b.getAttribute('data-rid'),true); }); });
    host.querySelectorAll('.mbrep-del').forEach(function(b){ b.addEventListener('click',function(){ _mbDeleteReport(b); }); }); /* v967-delwire */
  }

  if(_mbRepScope==='obj' && !qs){
    host.innerHTML=head(0)+'<div class="mbrep-list"><div class="mbrep-empty">Kein Objekt gew\u00e4hlt \u2014 oben ein Bestandsobjekt laden oder auf \u201eAlle\u201c umschalten.</div></div>'; /* v944 */
    host.style.display=''; wire(); return;
  }
  try{
    var res=await fetch(API + '/objects/history' + (qs?('?'+qs):''), { headers:_mbAuth() });
    var j=await res.json();
    var reps=((j&&j.history)||[]).filter(function(h){ return h && h.report_id!=null; });
    reps.sort(function(a,b){ return new Date(b.created_at)-new Date(a.created_at); });
    if(!reps.length){
      host.innerHTML=head(0)+'<div class="mbrep-list"><div class="mbrep-empty">'
        +(_mbRepScope==='all'?'Noch keine Marktberichte.':'Noch kein Marktbericht f\u00fcr dieses Objekt \u2014 Daten pr\u00fcfen und \u201eMarktbericht erstellen\u201c klicken.')
        +'</div></div>'; /* v944 */
      host.style.display=''; wire(); return;
    }
    host.innerHTML=head(reps.length)+'<div class="mbrep-list">'+reps.map(_mbRepRow).join('')+'</div>'; /* v943 */
    host.style.display=''; wire();
  }catch(e){ try{ console.warn('[mb reportslist]',e); }catch(_){ } }
}

/* v967-delreport
 * Loescht einen Marktbericht ENDGUELTIG — dieselbe v966-Route wie der Knopf
 * in Deal-Aktion: der Proxy setzt user_id aus dem Token (v942-userbind), das
 * mb-backend prueft den Besitz am Snapshot und loescht in einer Transaktion
 * ueber alle sechs Tabellen. 404 -> fremd/unbekannt, nichts geloescht.
 * Die Rueckfrage nennt Adresse+Datum der Zeile — bei sechs gleich aussehenden
 * Eintraegen trifft sonst jemand den falschen. */
async function _mbDeleteReport(btn) {
  try {
    var rid = parseInt(btn.getAttribute('data-rid'), 10);
    if (!rid) return;
    var row = btn.closest('.mbrep-row');
    var was = '';
    if (row) {
      var a = row.querySelector('.mbrep-addr'); var d = row.querySelector('.mbrep-date');
      was = '\n\n' + ((a && a.textContent) || '') + '\n' + ((d && d.textContent) || '');
    }
    if (!window.confirm('Diesen Marktbericht endg\u00fcltig l\u00f6schen?' + was + '\n\nDas kann nicht r\u00fcckg\u00e4ngig gemacht werden.')) return;
    var res = await fetch(API + '/reports/' + rid, { method: 'DELETE', headers: _mbAuth() });
    if (!res.ok) {
      var err = null; try { err = await res.json(); } catch (e) {}
      alert('L\u00f6schen fehlgeschlagen' + (err && err.error ? ': ' + err.error : ' (' + res.status + ')'));
      return;
    }
    _mbLoadReportsList({}); // Liste + Zaehler im Kopf neu
  } catch (e) {
    try { alert('L\u00f6schen fehlgeschlagen: ' + e.message); } catch (x) {}
  }
}

function fillInputsFromReport(out) {
  const ref = out && out.data && out.data.ref;
  if (!ref) return;
  const set = (id, v) => { const el = $(id); if (el && v != null && v !== '') el.value = v; };
  const addr = (out.data.address && out.data.address.formatted) || ref.address;
  set('address', addr);
  set('ptype', ref.property_type); set('usage', ref.usage_type);
  set('area', ref.living_area); set('rooms', ref.rooms); set('year', ref.build_year);
  if (ref.floor != null) set('floor', ref.floor);
  set('cond', ref.condition);
  if (ref.quality) set('quality', ref.quality);
  if (ref.modernization) set('modern', ref.modernization);
  if (ref.energy_class) set('energy', String(ref.energy_class).toUpperCase().trim()[0]);
  set('price', ref.purchase_price); set('rent', ref.monthly_net_rent);
  if (ref.plot_area) set('plot', ref.plot_area);
  if (ref.units) set('units', ref.units);
}

function fillInputsFromDpkt(o) {
  if (!o || typeof o !== 'object') return;
  // Objekt rekursiv flach machen -> { lowercaseKey: primitiveValue }. Findet auch verschachtelte
  // Felder (z.B. unter .data/.kpis) – Ursache dafuer, dass vorher "nichts" ankam.
  const flat = {};
  (function walk(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 5) return;
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (typeof v === 'object') { walk(v, depth + 1); continue; }
      const kk = String(k).toLowerCase();
      if (flat[kk] == null || flat[kk] === '') flat[kk] = v;
    }
  })(o, 0);
  const g = (keys) => { for (const k of keys) { const kk = String(k).toLowerCase(); if (flat[kk] != null && flat[kk] !== '') return flat[kk]; } return null; };
  const set = (id, v) => { const el = $(id); if (el && v != null && v !== '') el.value = v; };

  let addr = g(['adresse', 'address', 'objekt_adresse', 'standort', 'strasse_nr', 'strassehausnr']);
  if (!addr) {
    const str = g(['strasse', 'street', 'str']); const hnr = g(['hausnummer', 'hausnr', 'nr']);
    const plz = g(['plz', 'postleitzahl', 'postcode', 'zip']); const ort = g(['ort', 'stadt', 'city', 'gemeinde']);
    addr = [[str, hnr].filter(Boolean).join(' '), [plz, ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  }
  set('address', addr);
  /* WFELD-1 · 'objart' war der fehlende Alias — genau so heisst das Feld im
   * Objekt. Ohne ihn blieb der Objekttyp leer, und daran hing die halbe
   * Fehlerkette im Bericht. */
  const pt = g(['objart', 'objekttyp', 'objektart', 'property_type', 'typ', 'art']);
  if (pt && /haus|efh|zfh|dhh|reihen|mfh|mehrfamilien/i.test(String(pt))) set('ptype', 'haus');
  else if (pt) set('ptype', 'wohnung');
  const us = g(['nutzung', 'usage_type', 'usage', 'nutzungsart']);
  if (us && /eigen/i.test(String(us))) set('usage', 'eigennutzung'); else if (us) set('usage', 'kapitalanlage');
  set('area', g(['wohnflaeche', 'wohnflaeche_qm', 'wohnflaeche_m2', 'flaeche', 'living_area', 'wfl']));
  set('rooms', g(['zimmer', 'anzahl_zimmer', 'zimmeranzahl', 'rooms']));
  set('year', g(['baujahr', 'build_year', 'baujahr_jahr']));
  set('floor', g(['etage', 'geschoss', 'floor', 'stockwerk']));
  set('price', g(['kaufpreis', 'kaufpreis_eur', 'preis', 'price', 'kp']));
  set('rent', g(['kaltmiete', 'kaltmiete_monat', 'nettokaltmiete', 'miete', 'rent', 'monatsmiete']));
  const en = g(['ds2_energie', 'energieklasse', 'energie_label', 'energy_class', 'energieeffizienzklasse']);
  if (en) set('energy', String(en).toUpperCase().trim()[0]);

  /* WFELD-2 · Die uebrigen 19 Felder. Gemessen: von 34 Formularfeldern wurden
   * 11 uebernommen. Der Rest musste bei jedem Bericht neu getippt werden —
   * darunter die Gewerkefelder, die das Anlage-2-Modell fuer die
   * Restnutzungsdauer fuettern. Die heissen beidseitig gleich. */
  set('plot', g(['gsfl', 'grundstueck', 'grundstuecksflaeche', 'grundstucksflache', 'plot_area', 'gs_flaeche']));
  /* WSAVE31-2 · Gegenstueck zum Rueckweg. Speichern ohne Laden ist folgenlos. */
  set('brwManuell', g(['brw_manuell', 'brw', 'bodenrichtwert']));
  set('brwStichtag', g(['brw_stichtag', 'bodenrichtwert_stichtag']));
  set('brwAnp', g(['brw_anpassung_pct']));
  set('brwAnpGrund', g(['brw_anpassung_grund']));
  set('spMiete', g(['stellplatz_miete_monat']));
  set('sanierungsjahr', g(['sanierungsjahr', 'modernis']));
  set('usage', g(['nutzung', 'usage', 'nutzungsart']));
  set('modern', g(['modernis_grad', 'modernisierung']));
  set('mea', g(['mea_pct', 'mea', 'miteigentumsanteil']));
  set('lzs', g(['lzs_pct', 'liegenschaftszins']));
  set('baustatus', g(['baustatus']));
  set('units', g(['einheiten', 'anzahl_we', 'we', 'wohneinheiten', 'units']));
  set('garages', g(['garagen', 'garage', 'tg_stellplaetze', 'garages']));
  set('outdoor', g(['stellpl_aussen', 'aussenstellplaetze', 'stellplaetze_aussen', 'outdoor_spaces']));
  set('balcony', g(['balkon', 'balkon_qm', 'balkonflaeche', 'terrasse', 'balcony_area']));
  set('garden', g(['garten', 'garten_qm', 'gartenflaeche', 'garden_area']));
  set('baths', g(['baeder', 'badezimmer', 'anzahl_baeder', 'bathrooms']));
  set('modyear', g(['modernis', 'modernisierungsjahr', 'sanierungsjahr', 'modernization_year']));
  const _lift = g(['eq_elevator', 'aufzug', 'elevator', 'fahrstuhl']);
  if (_lift != null) {
    const _el = $('elevator');
    if (_el) {
      const _ja = /^(1|true|ja|yes|vorhanden)$/i.test(String(_lift));
      if (_el.type === 'checkbox') _el.checked = _ja; else _el.value = _ja ? 'ja' : 'nein';
    }
  }
  const _qual = g(['ausstattung', 'qualitaet', 'quality', 'ausstattungsstandard']);
  if (_qual) {
    const _qs = String(_qual).toLowerCase();
    const _q = /gehoben|hochwertig|luxus|stark/.test(_qs) ? 'gehoben'
      : /einfach|schlicht|niedrig/.test(_qs) ? 'einfach' : 'normal';
    set('quality', _q);
  }
  /* Gewerke: Feldnamen beidseitig identisch, deshalb ohne Uebersetzung. */
  ['eq_roof', 'eq_walls', 'eq_windows', 'eq_heating', 'eq_bath', 'eq_floor',
   'eq_guest_wc', 'eq_store_room'].forEach(function (k) { set(k, g([k])); });
  const zu = g(['zustand', 'condition']);
  if (zu) { const z = String(zu).toLowerCase().trim(); const opt = ['gepflegt', 'neuwertig', 'saniert', 'modernisiert', 'normal', 'renovierungsbeduerftig'].find((x) => x === z || z.includes(x.slice(0, 5))); if (opt) set('cond', opt); }
}

/* v1077-mb-touch — Karte auf dem Telefon bedienbar machen.

   Leaflet zieht die Karte per Voreinstellung schon mit EINEM Finger. In
   einer langen Berichtsseite heisst das: wer beim Scrollen die Karte
   trifft, bleibt darin haengen und kommt nicht weiter. Deshalb wie bei
   Google Maps: ein Finger scrollt die Seite, zwei Finger bewegen und
   zoomen die Karte. Ein kurzer Hinweis erscheint, wenn jemand es mit
   einem Finger versucht.

   Nur auf Zeigern ohne Hover — auf Maus und Trackpad bleibt alles wie
   gehabt. touchZoom (Kneifen) bleibt in jedem Fall an. */
function _mbMapTouch(m) {
  try {
    if (!m || !window.matchMedia || !window.matchMedia('(hover: none)').matches) return;
    var el = m.getContainer();
    if (!el) return;
    m.dragging.disable();

    var hint = document.createElement('div');
    hint.className = 'mb-map-hint';
    hint.textContent = 'Mit zwei Fingern bewegen und zoomen';
    el.appendChild(hint);
    var hideTimer = null;
    function flash() {
      hint.classList.add('on');
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { hint.classList.remove('on'); }, 1200);
    }

    el.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length > 1) { m.dragging.enable(); hint.classList.remove('on'); }
      else { m.dragging.disable(); flash(); }
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (!e.touches || e.touches.length < 2) m.dragging.disable();
    }, { passive: true });
  } catch (e) { /* ohne Touch-Sonderweg bleibt die Karte wie bisher */ }
}

function drawMap(lat, lon, comps) {
  if (!map) {
    map = L.map('map', { zoomControl: true }).setView([lat, lon], 16);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap, © CARTO', maxZoom: 19,
    }).addTo(map);
    _mbMapTouch(map);
  } else {
    map.setView([lat, lon], 14);
  }
  if (marker) map.removeLayer(marker);
  if (compLayer) map.removeLayer(compLayer);

  marker = L.circleMarker([lat, lon], { radius: 10, color: window._wlc('#C9A84C'), fillColor: window._wlc('#C9A84C'), fillOpacity: 1 })
    .addTo(map).bindPopup('<b>Objekt</b>');

  compLayer = L.layerGroup();
  (comps || []).forEach(c => {
    if (typeof c.lat === 'number' && typeof c.lon === 'number') {
      L.circleMarker([c.lat, c.lon], { radius: 5, color: '#5a8dd6', fillColor: '#5a8dd6', fillOpacity: .8 })
        .bindPopup(`${c.living_area} m² · ${new Intl.NumberFormat('de-DE').format(c.price_per_sqm)} €/m²`)
        .addTo(compLayer);
    }
  });
  compLayer.addTo(map);
  setTimeout(() => map.invalidateSize(), 100);
}

// Profi-Defaults fuer alle Charts (DealPilot-Look), einmalig + lazy (Chart muss geladen sein).
let _chartDefaultsDone = false;
function _ensureChartDefaults() {
  if (_chartDefaultsDone || typeof Chart === 'undefined') return;
  _chartDefaultsDone = true;
  Chart.defaults.font.family = "'Inter','Space Grotesk',-apple-system,sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.font.weight = '500';
  Chart.defaults.color = '#8a8a93';
  const t = Chart.defaults.plugins.tooltip;
  t.backgroundColor = 'rgba(10,10,12,.96)'; t.borderColor = window._wlrgbaH('#C9A84C', 0.4);
  t.borderWidth = 1; t.cornerRadius = 8; t.padding = 10; t.usePointStyle = true;
  t.titleColor = '#e8e8ea'; t.bodyColor = '#cfcfd6';
  const l = Chart.defaults.plugins.legend.labels;
  l.usePointStyle = true; l.pointStyle = 'circle'; l.boxWidth = 8; l.color = '#9a9aa3';
  if (Chart.defaults.animation) Chart.defaults.animation.easing = 'easeOutQuart';
}

function drawChart(sale, objSqm) {
  const host = _svgHost($('chart'));
  const stat = [ ['Minimum', sale.min_per_sqm], ['25 %', sale.q25_per_sqm], ['Median', sale.median_per_sqm],
    ['75 %', sale.q75_per_sqm], ['Maximum', sale.max_per_sqm], ['Dieses Objekt', objSqm] ];
  const labels = stat.map((s) => s[0]);
  const data = stat.map((s) => (s[1] != null ? Math.round(s[1]) : null));
  const median = sale.median_per_sqm != null ? Math.round(sale.median_per_sqm) : null;
  host.innerHTML = _svgBars({ labels, data, median, band: { lo: sale.q25_per_sqm != null ? Math.round(sale.q25_per_sqm) : null, hi: sale.q75_per_sqm != null ? Math.round(sale.q75_per_sqm) : null }, highlight: 'Dieses Objekt', unit: '\u20ac/m\u00b2' });
}

// Mini-Markdown -> HTML (Überschriften, Listen, fett). Bewusst klein gehalten.
function mdToHtml(md) {
  md = String(md || '').split('\n').filter((l) => !/^\s*\*{0,2}Fakten:?\*{0,2}/i.test(l)).join('\n');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = md.split('\n');
  let html = '', inList = false;
  for (let raw of lines) {
    let line = raw.trimEnd();
    if (/^#\s+/.test(line)) { html += closeL(); html += '<h1>' + inline(esc(line.replace(/^#\s+/, '').replace(/^[A-Z]\d?\)\s*/, ''))) + '</h1>'; continue; }
    if (/^##\s+/.test(line)) { html += closeL(); html += '<h2>' + inline(esc(line.replace(/^##\s+/, '').replace(/^[A-Z]\d?\)\s*/, ''))) + '</h2>'; continue; }
    if (/^[-*]\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + inline(esc(line.replace(/^[-*]\s+/, ''))) + '</li>'; continue; }
    html += closeL();
    if (line.trim() === '') continue;
    html += '<p>' + inline(esc(line)) + '</p>';
  }
  html += closeL();
  function closeL() { if (inList) { inList = false; return '</ul>'; } return ''; }
  function inline(s) { return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/_(.+?)_/g, '<em>$1</em>'); }
  return html;
}

// --- Datengrundlage / Echtheits-Kennzeichnung ---
function renderProvenance(out) {
  const prov = out && out.data && out.data.meta && out.data.meta.provenance;
  const el = $('provList');
  if (!el) return; /* v877-datengrundlage-out */
  if (!prov || !prov.length) { el.innerHTML = ''; return; }
  el.innerHTML = prov.map((p) =>
    `<div class="prov-row"><span class="pl">${p.label}</span>
       <span class="ps">${p.source}</span>
       <span class="badge b-${p.trust}">${p.trust}</span></div>`).join('');
}

// --- PDF-Export (DealPilot-Stil, an PriceHubble/Sprengnetter orientiert) ---
$('pdfBtn').addEventListener('click', async () => {
  const out = window._lastOut;
  if (!out) return;
  const btn = $('pdfBtn'); btn.disabled = true; const old = btn.textContent; btn.textContent = 'erstelle PDF…';
  try { await exportPdf(out); } catch (e) { alert('PDF-Fehler: ' + e.message); }
  finally { btn.disabled = false; btn.textContent = old; }
});

// Laedt ein Bild (z.B. Objektkarte) als DataURL fuer die PDF-Einbettung.
// Cover-Karte nachschaerfen: Grauschleier raus, Gold leuchtet (Canvas-Filter).
async function enhanceCoverMap(dataUrl) {
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.filter = 'brightness(0.9) contrast(1.5) saturate(1.55)';
    x.drawImage(img, 0, 0);
    return c.toDataURL('image/jpeg', 0.86);
  } catch (e) { return dataUrl; }
}
// Butterweicher Links- + Unten-Fade als PNG (ersetzt den Streifen-Scrim -> kein Banding).
function makeCoverFadePNG() {
  const c = document.createElement('canvas'); c.width = 840; c.height = 1188;
  const x = c.getContext('2d');
  const gH = x.createLinearGradient(0, 0, c.width, 0);
  gH.addColorStop(0.00, 'rgba(3,3,4,1)');
  gH.addColorStop(0.42, 'rgba(3,3,4,0.97)');
  gH.addColorStop(0.60, 'rgba(3,3,4,0.62)');
  gH.addColorStop(0.78, 'rgba(3,3,4,0.16)');
  gH.addColorStop(1.00, 'rgba(3,3,4,0)');
  x.fillStyle = gH; x.fillRect(0, 0, c.width, c.height);
  const gV = x.createLinearGradient(0, c.height * 0.78, 0, c.height);
  gV.addColorStop(0, 'rgba(3,3,4,0)'); gV.addColorStop(1, 'rgba(3,3,4,0.62)');
  x.fillStyle = gV; x.fillRect(0, c.height * 0.78, c.width, c.height * 0.22);
  return c.toDataURL('image/png');
}

async function loadImageDataUrl(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result); fr.onerror = () => res(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function exportPdf(out) {
  const d = out.data;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 18;
  const GOLD = window._pdfGold(), INK = [20, 20, 23], TXT = [34, 34, 38], MUT = [120, 120, 130];
  /* v963-wlrgb: EINE Quelle fuer die Gold-Familie als RGB-Tripel.
   * jsPDF kennt kein var(), deshalb der Laufzeit-Hex ueber _wlc() — derselbe
   * Weg wie im Web. Ohne Whitelabel: #b8932f / #C9A84C / #E8CC7A unveraendert.
   * v961/v962 hatten die Funktion zweimal lokal; zwei Kopien sind zwei
   * Wahrheiten, und genau daran ist heute schon der Konfidenz-Wert gescheitert. */
  const _wlRgb = (h) => { const c = window._wlc(h); return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; };
  const GOLD_D = () => _wlRgb('#b8932f'), GOLD_M = () => _wlRgb('#C9A84C'), GOLD_L = () => _wlRgb('#E8CC7A');
  let y = 0;
  const euro = (n) => (n == null ? '–' : Number(n).toLocaleString('de-DE') + ' €');
  const a = d.address || {}, ref = d.ref || {}, mv = (d.valuation && d.valuation.market_value) || {},
        yld = (d.valuation && d.valuation.yield) || {}, inp = (d.valuation && d.valuation.inputs) || {},
        ds = d.deal_score || {};
  const theme = 'dark'; // Deckblatt + Inhalt immer dunkel, Inhaltsseiten bleiben hell
  // v-Cover-Art: Marcels Mockup-Artwork als Cover-Hintergrund (statt Live-Karte).
  // Spart den static-map-Call; Live-Karte bleibt Fallback, falls Asset fehlt.
  if (window._bgCoverArt === undefined) window._bgCoverArt = await loadImageDataUrl('assets/bg-cover-art.jpg?v=49k');
  const bgCoverArt = window._bgCoverArt;
  // Deckblatt-Karte je nach Theme: dunkel = gold-auf-schwarz, hell = positron. Pin zeichnen wir selbst.
  const coverMapStyle = theme === 'dark' ? 'dark-matter-yellow-roads' : 'positron';
  let objImg = out._covMap || null;
  if (!objImg && !bgCoverArt && a.lat != null && a.lon != null) {
    // Eleganter Stadtteil-Ausschnitt (zoom 15): das goldene Strassennetz dominiert,
    // Gebaeude bleiben klein -> Look wie Vorlage. Hohe Aufloesung fuer Hochglanz.
    const cu = API + '/static-map?lat=' + a.lat + '&lon=' + a.lon
      + '&zoom=15&width=1448&height=2048&marker=0&style=' + coverMapStyle;
    objImg = await loadImageDataUrl(cu);
    if (objImg) out._covMap = objImg; // cachen -> Wiederverwendung/Export ohne erneuten Abruf
  }
  if (!objImg && d.object_image) objImg = await loadImageDataUrl(d.object_image);

  // Helle Karte (positron) als dezentes Wasserzeichen fuer die Inhaltsseiten (helles Design).
  let lightImg = out._lightMap || null;
  if (!lightImg && a.lat != null && a.lon != null) {
    const lu = API + '/static-map?lat=' + a.lat + '&lon=' + a.lon
      + '&zoom=17&width=1024&height=1448&marker=0&style=positron';
    lightImg = await loadImageDataUrl(lu);
    if (lightImg) out._lightMap = lightImg;
  }
  // Marcels Mockup-Hintergruende (statische Assets, einmal laden + cachen)
  if (window._bgLightAsset === undefined) window._bgLightAsset = await loadImageDataUrl('assets/bg-content-light.jpg?v=49k');
  if (window._bgDarkAsset === undefined) window._bgDarkAsset = await loadImageDataUrl('assets/bg-cover-dark.jpg?v=49k');
  const bgLightAsset = window._bgLightAsset, bgDarkAsset = window._bgDarkAsset;
  // Heller Seitenhintergrund (Off-White + feines Karten-Wasserzeichen) fuer alle Inhaltsseiten.
  function contentBg() {
    doc.setFillColor(250, 250, 249); doc.rect(0, 0, W, H, 'F');
    if (bgLightAsset) { // Marcels Mockup-Hintergrund (bereits dezent) 1:1
      try { doc.addImage(bgLightAsset, 'JPEG', 0, 0, W, H, 'bgl'); return; } catch (e) { /* fallback */ }
    }
    if (lightImg && doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.30 }));
      try { doc.addImage(lightImg, 'PNG', 0, 0, W, H, 'lightwm'); } catch (e) { /* optional */ }
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
  }

  function footer(pageNo) {
    /* v957-fontleak
     * ──────────────────────────────────────────
     * footer() hat die Schriftgroesse auf 7.5 gesetzt und NIE zurueckgestellt.
     * newPage() ruft footer() -> JEDER Seitenumbruch hat 7.5 geerbt.
     * Sichtbar auf Seite 7 des Prod-Berichts: der Absatz, der von Seite 6
     * herueberlaeuft, steht klein gedruckt mit klaffenden Wortluecken. Die
     * Wortbreiten kommen aus _mbLayoutRuns (gemessen bei RSZ=9.5), die
     * Glyphen aus footer (7.5). Ab der ersten Ueberschrift auf Seite 7 ist
     * alles heil — der h-Zweig setzt doc.setFontSize(RSZ) neu.
     * Fix an der Ursache: footer() ist wieder zustandsneutral (Groesse).
     * Fuer alle anderen need()-Stellen ein No-Op — die setzen ihre Groesse
     * ohnehin selbst (geprueft: _drawRich war die einzige Ausnahme).
     */
    const _fsPrev = (typeof doc.getFontSize === 'function') ? doc.getFontSize() : null;
    doc.setDrawColor(228, 226, 220); doc.setLineWidth(0.3); doc.line(M, H - 11, W - M, H - 11);
    doc.setFillColor(...GOLD); doc.circle(M + 1, H - 8.3, 0.9, 'F');
    doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.setFont('helvetica', 'normal');
    /* v1149-FUSS · Der Hinweis stand auf JEDER Seite. Marcels Befund am
     * PDF: "nicht 3-4 mal die Preisindikation, das ist etwas zu viel."
     * Gemessen: footer() laeuft bei jedem newPage(), der Prod-Bericht hat
     * sieben Seiten — der Begriff kam allein hier siebenmal.
     * Der Satz ist rechtlich sinnvoll (Abgrenzung n. § 194 BauGB) und
     * verschwindet deshalb NICHT, er steht nur noch EINMAL: auf Seite 1,
     * wo ihn liest, wer den Bericht in die Hand nimmt. Ab Seite 2 traegt
     * die Fusszeile nur noch Marke und Seitenzahl.
     * Die Textstellen zur Belastbarkeit (Z. 900/902/3344) bleiben — sie
     * sagen etwas anderes und sind keine Dopplung, nur ein gleiches Wort. */
    doc.text(pageNo === 1
      ? 'DealPilot · Marktbericht — Marktpreisindikation, kein Gutachten n. § 194 BauGB'
      : 'DealPilot · Marktbericht', M + 4, H - 8);
    doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold');
    doc.text('Seite ' + pageNo, W - M, H - 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    if (_fsPrev != null) doc.setFontSize(_fsPrev); // v957-fontleak: Groesse zurueckgeben
  }
  let page = 1;
  function newPage() { footer(page); doc.addPage(); page++; y = M; contentBg(); }
  function need(h) { if (y + h > H - 16) newPage(); }
  let secNo = 0;
  const tocEntries = [];
  /* WPDF29-1 · Umbruch an der Kapitelgrenze statt nach Restplatz.
   * Seite 4 trug zuletzt Preisstrategie, Bodenrichtwert, Wertverfahren UND
   * den ganzen Ertragswert-Rechenweg. Ein Kapitel, das nicht mehr sinnvoll
   * auf die Seite passt, faengt jetzt oben auf der naechsten an. */
  var _MIN_KAPITEL = 62;   // mm Restplatz, unter dem ein Kapitel umbricht

  function sectionTitle(t, reserve) {
    /* WPDF29-2 · Jedes Kapitel beginnt mit genug Platz oder auf neuer Seite. */
    var _rest = H - 16 - y;
    if (_rest < (reserve || _MIN_KAPITEL)) newPage();
    need(20);
    secNo++;
    const num = String(secNo).padStart(2, '0');
    tocEntries.push({ num, title: t, page });
    // Gold-Nummern-Badge + Titel + Doppellinie (Hochglanz-Redesign 07.06.)
    doc.setFillColor(247, 243, 233); doc.setDrawColor(...GOLD); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, 9, 7, 1.2, 1.2, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...GOLD);
    doc.text(num, M + 4.5, y + 4.8, { align: 'center' });
    doc.setFontSize(13.5); doc.setTextColor(...INK);
    doc.text(t, M + 13, y + 5.3, { charSpace: 0.2 });
    doc.setDrawColor(...GOLD); doc.setLineWidth(1.0); doc.line(M, y + 10.4, M + 9, y + 10.4);
    doc.setDrawColor(225, 223, 217); doc.setLineWidth(0.3); doc.line(M + 9, y + 10.4, W - M, y + 10.4);
    y += 15; doc.setFont('helvetica', 'normal');
  }
  function kv(label, val, x, w, accent) {
    /* v952-kvaccent
     * ──────────────────────────────────────────────────────────────────────
     * Die Zeilen liefern ihren Akzent seit jeher mit (Z.1813 ['Marktwert', …, GOLD]),
     * kv() hat ihn nur nie angenommen und die Aufrufer nie weitergereicht — jeder
     * Wert wurde in TXT gemalt, auch der Marktwert, der die Hauptaussage ist.
     * tile() (Z.1318) kann es laengst.
     * Ohne Akzent bleibt TXT: eine Zeile, die vorher keine Farbe wollte, bekommt
     * auch keine. Es aendert sich nur, was ohnehin gemeint war.
     */
    doc.setFontSize(8); doc.setTextColor(...MUT); doc.text(label, x, y);
    doc.setFontSize(11); doc.setTextColor(...(accent && accent.length === 3 ? accent : TXT));
    doc.setFont('helvetica', 'bold');
    doc.text(String(val == null ? '–' : val), x, y + 5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TXT); /* Farbe nicht an die naechste Zeile vererben */
  }
  // KPI-Kachel: weiße Karte mit Soft-Shadow + Tier-Akzentleiste (Hochglanz 07.06.)
  function tile(x, ty, w, h, label, value, accent) {
    if (doc.GState) { // weicher Schatten unter der Karte
      doc.setGState(new doc.GState({ opacity: 0.06 })); doc.setFillColor(20, 20, 23);
      doc.roundedRect(x + 0.5, ty + 1.0, w, h, 1.8, 1.8, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    doc.setFillColor(255, 255, 255); doc.setDrawColor(232, 230, 224); doc.setLineWidth(0.25);
    doc.roundedRect(x, ty, w, h, 1.8, 1.8, 'FD');
    doc.setFillColor(...(accent || GOLD)); doc.roundedRect(x, ty + 3, 1.8, h - 6, 0.9, 0.9, 'F');
    doc.setFontSize(7); doc.setTextColor(...MUT); doc.text(label.toUpperCase(), x + 5.5, ty + 6, { charSpace: 0.5 });
    doc.setFontSize(14.5); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold');
    doc.text(String(value == null ? '–' : value), x + 5.5, ty + 14.2); doc.setFont('helvetica', 'normal');
  }
  // Score-Balken 0-100 mit Farbverlauf-Segmenten + Marker
  // Bogen aus kurzen Segmenten (jsPDF hat kein natives arc)
  function arc(cx, cy, r, a0, a1) {
    const steps = Math.max(2, Math.round(Math.abs(a1 - a0) / 6));
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const ang = (a0 + (a1 - a0) * i / steps) * Math.PI / 180;
      const px = cx + r * Math.cos(ang), py = cy + r * Math.sin(ang);
      if (prev) doc.line(prev[0], prev[1], px, py);
      prev = [px, py];
    }
  }
  // Score-Donut im DealPilot-Look: grauer Ring + farbiger Fortschrittsbogen + Zahl in der Mitte
  /* v961-doublering
   * ──────────────────────────────────────────────────────────────
   * Vorbild ist svgDonut() (Z.618, v895-doublering) aus der Ergebnis-Ansicht:
   *   Aussenring = Score (tier-farbig) · Innenring = Aussagekraft (Gold)
   *   darunter die Tier-Pille (Top / Gut / Solide / Schwach).
   * Die Verhaeltnisse stammen aus dem Web und werden auf r skaliert, damit
   * beide Anzeigen dieselbe Bildsprache haben:
   *   Web rO=68 rI=51 swO=11 swI=7.5  ->  rI = 0.75*r, swO = 0.185*r, swI = 0.143*r
   * conf ist optional: ohne Wert bleibt es beim Einfachring (kein leerer
   * Innenring, der eine Aussage vortaeuscht, die es nicht gibt).
   */
  function scoreDonut(cx, cy, r, score, conf) {
    const s = Math.max(0, Math.min(100, score || 0));
    const col = s >= 70 ? [63, 165, 108] : s >= 50 ? GOLD : [184, 98, 80];
    /* v1203 · war eine wortgleiche Kopie von _scoreTier() — mitsamt einem
       Kommentar, der auf eine "Z.615" verwies, die es nicht mehr gibt. Zwei
       Schwellenketten fuer dieselbe Einstufung sind die Doppelliste, an der
       der Marktbericht schon sechsmal gescheitert ist. */
    const tier = _scoreTier(s);
    const swO = Math.max(1.6, r * 0.185), rI = r * 0.75, swI = Math.max(1.2, r * 0.143);
    doc.setLineCap('round');
    doc.setLineWidth(swO);
    doc.setDrawColor(34, 34, 42); arc(cx, cy, r, 0, 360);               // Track aussen (Web #22222a)
    doc.setDrawColor(...col); arc(cx, cy, r, -90, -90 + s / 100 * 360); // Score ab oben
    if (conf != null && !isNaN(conf)) {
      const c2 = Math.max(0, Math.min(100, conf));
      doc.setLineWidth(swI);
      doc.setDrawColor(27, 27, 33); arc(cx, cy, rI, 0, 360);              // Track innen (Web #1b1b21)
      doc.setDrawColor(...GOLD); arc(cx, cy, rI, -90, -90 + c2 / 100 * 360);
    }
    doc.setLineCap('butt');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text(String(score ?? '–'), cx, cy + 1.2, { align: 'center' });
    doc.setTextColor(150, 150, 160); doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5);
    doc.text('/ 100', cx, cy + 5.8, { align: 'center' });
    // Tier-Pille unter dem Ring (Web: cy + rO + 17, Pille 60x23 bei rO=68)
    const bw = r * 0.88, bh = r * 0.34, bx = cx - bw / 2, by = cy + r + r * 0.1;
    doc.setFillColor(10, 10, 12); doc.setDrawColor(...col); doc.setLineWidth(0.35);
    doc.roundedRect(bx, by, bw, bh, bh / 2, bh / 2, 'FD');
    doc.setTextColor(...col); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8);
    doc.text(tier, cx, by + bh * 0.7, { align: 'center' });
  }

  // Kleiner Kategorie-Ring für die helle Lage-Seite (Score 0..100, Anzeige txt zentriert)
  function microRing(cx, cy, r, score, txt) {
    // eleganter dünner Ring (Instrument-Linie wie die Tachos) + dezenter Glow
    const c = score >= 70 ? [67, 183, 124] : score >= 50 ? [217, 180, 90] : [217, 104, 95];
    const sweep = (Math.max(0, Math.min(100, score)) / 100) * 360;
    const sw = Math.max(1.3, r * 0.16);
    doc.setLineCap('round');
    doc.setDrawColor(236, 234, 229); doc.setLineWidth(sw); arc(cx, cy, r, 0, 360);
    if (doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.2 })); doc.setDrawColor(...c); doc.setLineWidth(sw * 2.1); arc(cx, cy, r, -90, -90 + sweep);
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    doc.setDrawColor(...c); doc.setLineWidth(sw); arc(cx, cy, r, -90, -90 + sweep);
    doc.setLineCap('butt');
    doc.setTextColor(...c); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.text(String(txt), cx, cy + 2.6, { align: 'center' });
  }

  function scoreBar(x, by, w, score) {
    const segs = [[0, 50, [217, 104, 95]], [50, 70, [217, 180, 90]], [70, 100, [67, 183, 124]]];
    const h = 5;
    if (doc.GState) { // weicher Glow unter der Leiste
      doc.setGState(new doc.GState({ opacity: 0.16 }));
      segs.forEach(([from, to, c]) => { doc.setFillColor(...c); doc.roundedRect(x + (from / 100) * w - 0.5, by - 0.8, ((to - from) / 100) * w + 1, h + 1.6, 1.2, 1.2, 'F'); });
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    segs.forEach(([from, to, c]) => {
      doc.setFillColor(...c); doc.rect(x + (from / 100) * w, by, ((to - from) / 100) * w, h, 'F');
    });
    const mx = x + (Math.max(0, Math.min(100, score)) / 100) * w;
    doc.setFillColor(...GOLD); doc.triangle(mx - 2, by - 1.8, mx + 2, by - 1.8, mx, by + 1.4, 'F');
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.7); doc.line(mx, by, mx, by + h);
  }
  // Marktwert-Spanne low —●estimate— high
  function rangeBar(x, ry, w, low, est, high) {
    if (low == null || high == null || est == null || high <= low) return false;
    const h = 4; doc.setFillColor(232, 230, 224); doc.roundedRect(x, ry, w, h, 1, 1, 'F');
    const pos = (v) => x + ((v - low) / (high - low)) * w;
    doc.setFillColor(...GOLD); const px = Math.max(x, Math.min(x + w, pos(est)));
    doc.circle(px, ry + h / 2, 2.1, 'F');
    return true;
  }
  // Halbkreis-Tacho: Skala lo..hi mit farbigen Zonen + Zeiger bei val (+ optional Kaufpreis-Marker)
  // v489: satte DealPilot-Ampelfarben + Glow-Halo (mehrlagige, transparente Bögen) = Wow-Optik.
  function gauge(cx, cy, r, lo, hi, val, opts) {
    opts = opts || {};
    if (lo == null || hi == null || hi <= lo) return;
    const dark = !!opts.dark;
    const GREEN = [67, 183, 124];   // sattes DealPilot-Grün
    const GOLDT = [217, 180, 90];   // strahlendes Gold (statt mattem Gelb)
    const REDT  = [217, 104, 95];   // sattes Rot
    const clamp = (v) => Math.max(lo, Math.min(hi, v));
    const ratio = (v) => (clamp(v) - lo) / (hi - lo);
    const ang = (v) => 180 + ratio(v) * 180; // 180°=links .. 360°=rechts (oben über 270°)
    const pt = (t, rad) => { const a = (180 + t * 180) * Math.PI / 180; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
    /* v962-goldzonen — DER Tacho-Fix.
     * ────────────────────────────────────────────────────────────
     * v961 hat segMW/segMiete auf Gold gestellt — das ist aber der BALKEN.
     * v963-komment: hier stand "Der einzige Aufrufer" — falsch, es sind ZWEI. Der zweite
     * (Marktmiete) uebergab seine Zonen inline und hat den Default nie gesehen.
     * Der Marktwert-Aufrufer uebergibt `zones: undefined, segs: segMW`.
     * Der Tacho landete also IMMER hier im Default: gruen/gold/rot.
     * Jetzt die Gold-Familie der Web-Karte (svgGauge Z.653), Grenzen 0.4/0.72.
     *
     * Warum ueberhaupt Gold: die Ampel musste eine WERTUNG ausdruecken
     * ("teuer = rot"), die die Anzeige gar nicht treffen kann — ein Marktwert am
     * oberen Ende der Spanne ist nicht schlecht, er liegt nur oben. Der Beweis
     * war die invertierte Mietskala. Die Gold-Familie zeigt nur die Lage.
     *
     * _wlc() macht die Toene whitelabel-faehig (jsPDF kennt kein var(), deshalb
     * der Laufzeit-Hex). Ohne Whitelabel: #b8932f / #C9A84C / #E8CC7A.
     * GREEN/GOLDT/REDT bleiben stehen — ein Aufrufer, der eigene zones uebergibt,
     * bekommt weiter genau das, was er verlangt.
     */
    // v963-gaugesrc: Toene aus der zentralen Quelle (oben bei GOLD), nicht lokal.
    const zones = opts.zones || [[0, 0.4, GOLD_D()], [0.4, 0.72, GOLD_M()], [0.72, 1, GOLD_L()]];
    /* v962-komment: hier stand noch die Beschreibung von "Variante 3" — Track-
     * Bogen, Skalenstriche, Gold-Nabe. Alle drei gibt es seit v961 nicht mehr.
     * Der Kommentar hat prompt die erste Pruefung nach v961 falsch ausschlagen
     * lassen (grep auf "Skalenstriche" traf ihn statt den Code). */
    const t = ratio(val);
    /* v961-goldtacho: der Bogen ist jetzt der der Web-Karte (svgGauge Z.646).
     * Weg sind die elf Skalenstriche (die Web-Karte hat keine) und der runde
     * Cap an den Zonen (Web: stroke-linecap="butt").
     * Bogenstaerke aus dem Web-Verhaeltnis: 12/86 = 0,14 · r. */
    const sw = Math.max(2.0, r * 0.14);
    doc.setLineCap('butt');
    zones.forEach(([f, to, c]) => { doc.setLineWidth(sw); doc.setDrawColor(...c); arc(cx, cy, r, 180 + f * 180, 180 + to * 180); });
    // optionaler Marker (Kaufpreis)
    if (opts.marker != null) {
      const mp = pt(ratio(opts.marker), r);
      /* v961-goldtacho: Ring um den Marker wie im Web (stroke 1.6 auf #0a0a0c).
       * Ohne ihn verschwindet der Kaufpreis-Punkt auf dem Gold-Bogen — bei der
       * alten Ampel lag er noch auf Gruen oder Rot. */
      doc.setFillColor(...(opts.markerColor || (dark ? [232, 226, 212] : [150, 142, 120])));
      doc.setDrawColor(...(dark ? [10, 10, 12] : [255, 255, 255])); doc.setLineWidth(0.5);
      doc.circle(mp[0], mp[1], 1.6, 'FD');
    }
    // Dünne, durchgehende Nadel wie in der Web-Anzeige — KEIN Glow, kleine helle Nabe
    const tip = pt(t, r - sw * 0.9);
    const needleCol = dark ? [232, 232, 234] : [60, 60, 66];
    doc.setLineCap('round');
    doc.setDrawColor(...needleCol); doc.setLineWidth(0.4); doc.line(cx, cy, tip[0], tip[1]);
    doc.setLineCap('butt');
    /* v961-nabe: der goldene Punkt in der Nabe ist raus — die Web-Karte hat
     * eine schlichte Nabe in Nadelfarbe (circle r=5, Z.656). */
    doc.setFillColor(...needleCol); doc.circle(cx, cy, 0.95, 'F');
    // Wert mittig im Tacho (wie Web-Karte) — über der Nadel, mit feinem dunklem Halo für Lesbarkeit
    if (opts.valueText) {
      doc.setFont('helvetica', 'bold');
      let fs = 10.5; doc.setFontSize(fs);
      const maxW = r * 1.78;
      while (doc.getTextWidth(opts.valueText) > maxW && fs > 6.5) { fs -= 0.5; doc.setFontSize(fs); }
      const vy = cy - r * 0.34;
      if (doc.GState) {
        doc.setGState(new doc.GState({ opacity: 0.55 })); doc.setTextColor(6, 6, 8);
        doc.text(opts.valueText, cx + 0.3, vy + 0.3, { align: 'center' });
        doc.setGState(new doc.GState({ opacity: 1 }));
      }
      doc.setTextColor(...(opts.valueColor || [255, 255, 255]));
      doc.text(opts.valueText, cx, vy, { align: 'center' });
    }
    // Labels: lo/hi an den Enden, Caption mittig darunter (Wert steht unter der Anzeige)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...(dark ? [150, 150, 160] : MUT));
    if (opts.loLabel) doc.text(opts.loLabel, cx - r, cy + 6.5, { align: 'center' });
    if (opts.hiLabel) doc.text(opts.hiLabel, cx + r, cy + 6.5, { align: 'center' });
    doc.setFontSize(5.8); doc.setTextColor(...(dark ? [140, 140, 150] : MUT));
    if (opts.caption) doc.text(opts.caption, cx, cy + 6.5, { align: 'center' });
  }
  // Obsidian-Karte mit Gold-Hairline + dezenten Partikeln (DealPilot-Look auf heller Seite)
  // v489: äußerer Gold-Glow (2 Lagen) + goldene Partikel = Hochglanz.
  function obsidianCard(x, cy, w, h) {
    // weicher Aussen-Schatten (Tiefe auf heller Seite)
    if (doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.06 })); doc.setFillColor(20, 20, 23);
      doc.roundedRect(x - 0.6, cy + 1.1, w + 1.2, h, 3.6, 3.6, 'F');
      doc.setGState(new doc.GState({ opacity: 0.04 }));
      doc.roundedRect(x - 1.6, cy + 2.4, w + 3.2, h, 4.2, 4.2, 'F');
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    // Korpus mit dezentem vertikalem Verlauf (oben minimal heller)
    doc.setFillColor(13, 13, 17); doc.roundedRect(x, cy, w, h, 3, 3, 'F');
    doc.setFillColor(8, 8, 11); doc.roundedRect(x, cy + h * 0.42, w, h * 0.58, 3, 3, 'F');
    doc.setFillColor(8, 8, 11); doc.rect(x, cy + h * 0.42, w, 2, 'F');
    // feine obere Gold-Sheen-Linie (wie Web-Karte)
    if (doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.55 }));
      doc.setDrawColor(232, 199, 102); doc.setLineWidth(0.4);
      doc.line(x + w * 0.30, cy + 0.35, x + w * 0.70, cy + 0.35);
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.35); doc.roundedRect(x, cy, w, h, 3, 3, 'S');
    doc.setFillColor(...GOLD); doc.roundedRect(x, cy + 5, 1.8, h - 10, 0.9, 0.9, 'F');
  }
  // Spannenbalken mit Min/Mid/Max-Labels + optionalem Kaufpreis-Marker
  function rangeBarPro(x, ry, w, lo, mid, hi, fmt, marker, markerLabel) {
    if (lo == null || hi == null || mid == null || hi <= lo) return ry;
    const h = 5; const pos = (v) => x + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * w;
    // Verlauf in 3 Tönen
    doc.setFillColor(238, 236, 230); doc.roundedRect(x, ry, w, h, 1.2, 1.2, 'F');
    doc.setFillColor(214, 226, 214); doc.rect(x, ry, w * 0.34, h, 'F');
    doc.setFillColor(245, 238, 214); doc.rect(x + w * 0.34, ry, w * 0.32, h, 'F');
    doc.setFillColor(245, 224, 214); doc.rect(x + w * 0.66, ry, w * 0.34, h, 'F');
    // Median-Marker (gold)
    const mx = pos(mid); doc.setFillColor(...GOLD); doc.circle(mx, ry + h / 2, 2.3, 'F');
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5); doc.line(mx, ry - 1, mx, ry + h + 1);
    // optionaler Kaufpreis-Marker (blau, Dreieck)
    if (marker != null) {
      const px = pos(marker); doc.setFillColor(150, 142, 120);
      doc.triangle(px - 1.8, ry + h + 1.5, px + 1.8, ry + h + 1.5, px, ry + h - 0.5, 'F');
    }
    // Labels
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...TXT);
    doc.text(fmt(lo), x, ry + h + 6);
    doc.setFont('helvetica', 'bold'); doc.text(fmt(mid), mx, ry + h + 6, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.text(fmt(hi), x + w, ry + h + 6, { align: 'right' });
    if (marker != null && markerLabel) {
      doc.setFontSize(7); doc.setTextColor(120, 113, 100);
      doc.text(markerLabel, pos(marker), ry + h + 10.5, { align: 'center' });
      return ry + h + 13;
    }
    return ry + h + 9;
  }

  // Soft-Glow-Orb (ohne Alpha): konzentrische Kreise vom Hintergrund zur Glow-Farbe interpoliert.
  function glowOrb(cx, cy, R, glow, bg, intensity) {
    intensity = intensity == null ? 0.5 : intensity;
    const steps = 26;
    for (let i = steps; i >= 1; i--) {
      const rr = (R * i) / steps;
      const tt = Math.pow(1 - i / steps, 1.7) * intensity; // außen 0 -> innen max
      const col = [0, 1, 2].map((k) => Math.round(bg[k] + (glow[k] - bg[k]) * tt));
      doc.setFillColor(col[0], col[1], col[2]); doc.circle(cx, cy, rr, 'F');
    }
  }

  // Premium-Halbkreis-Tacho: siehe gauge() weiter oben (mit Track + runden Kappen).

  // ===== Theme-Helfer (Deckblatt + Inhalt) =====
  const OBS = [8, 8, 10];
  function leftScrim(col, x0, x1, op0, op1) {
    if (!doc.GState) return; // ältere jsPDF ohne Alpha: dunkle Karte trägt den Text auch so
    const steps = 60, bw = (x1 - x0) / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1), op = op0 + (op1 - op0) * t;
      doc.setGState(new doc.GState({ opacity: Math.max(0, Math.min(1, op)) }));
      doc.setFillColor(col[0], col[1], col[2]); doc.rect(x0 + i * bw, 0, bw + 0.6, H, 'F');
    }
    doc.setGState(new doc.GState({ opacity: 1 }));
  }
  function radarPin(cx, cy, accent) {
    if (doc.GState) {
      // weicher Gold-Halo: gestapelte transparente Scheiben (KEIN Schwarz auf der Karte)
      for (let i = 6; i >= 1; i--) {
        doc.setGState(new doc.GState({ opacity: 0.05 }));
        doc.setFillColor(accent[0], accent[1], accent[2]); doc.circle(cx, cy, i * 5.5, 'F');
      }
      // konzentrische Radar-Ringe (transparent)
      for (let i = 3; i >= 1; i--) {
        doc.setGState(new doc.GState({ opacity: 0.5 - i * 0.11 }));
        doc.setDrawColor(accent[0], accent[1], accent[2]); doc.setLineWidth(0.7);
        doc.circle(cx, cy, 8 + i * 6, 'S');
      }
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    // Pin (Tropfen + weißer Punkt)
    doc.setFillColor(accent[0], accent[1], accent[2]);
    doc.circle(cx, cy - 4.5, 5.4, 'F');
    doc.triangle(cx - 4.6, cy - 1.4, cx + 4.6, cy - 1.4, cx, cy + 6.6, 'F');
    doc.setFillColor(255, 255, 255); doc.circle(cx, cy - 4.5, 2.0, 'F');
  }
  function drawSkyline(x, baseY, w, maxH, col) {
    doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth(0.35);
    const hs = [0.30, 0.55, 0.42, 0.78, 0.5, 0.68, 0.38, 0.88, 0.52, 0.62,
      0.4, 0.72, 0.48, 0.58, 0.82, 0.45, 0.66, 0.36, 0.6, 0.5];
    const bw = w / hs.length;
    hs.forEach((hf, i) => {
      const bh = maxH * hf, bx = x + i * bw;
      doc.lines([[0, -bh], [bw * 0.82, 0], [0, bh]], bx, baseY, [1, 1], 'S');
      if (i % 4 === 2) doc.line(bx + bw * 0.41, baseY - bh, bx + bw * 0.41, baseY - bh - maxH * 0.2);
    });
    doc.line(x, baseY, x + w, baseY);
  }

  // Mini-Vektor-Icons fuers Deckblatt (Stroke-basiert, ~3 mm, Mockup-Look)
  function covIcon(type, x, yy, col, sc) {
    const k = sc || 1; doc.setDrawColor(...col); doc.setLineWidth(0.45); doc.setFillColor(...col);
    if (type === 'pin') {
      doc.circle(x + 1.5 * k, yy - 1.7 * k, 1.25 * k, 'S');
      doc.circle(x + 1.5 * k, yy - 1.7 * k, 0.4 * k, 'F');
      doc.line(x + 0.62 * k, yy - 0.75 * k, x + 1.5 * k, yy + 0.6 * k);
      doc.line(x + 2.38 * k, yy - 0.75 * k, x + 1.5 * k, yy + 0.6 * k);
    } else if (type === 'home') {
      doc.line(x, yy - 0.9 * k, x + 1.4 * k, yy - 2.1 * k); doc.line(x + 1.4 * k, yy - 2.1 * k, x + 2.8 * k, yy - 0.9 * k);
      doc.lines([[0, 1.6 * k], [2.0 * k, 0], [0, -1.6 * k]], x + 0.4 * k, yy - 0.9 * k, [1, 1], 'S');
    } else if (type === 'area') {
      doc.roundedRect(x, yy - 2.2 * k, 2.6 * k, 2.6 * k, 0.3, 0.3, 'S');
      doc.line(x + 0.7 * k, yy - 0.5 * k, x + 1.9 * k, yy - 1.7 * k);
      doc.line(x + 1.3 * k, yy - 1.7 * k, x + 1.9 * k, yy - 1.7 * k); doc.line(x + 1.9 * k, yy - 1.7 * k, x + 1.9 * k, yy - 1.1 * k);
    } else if (type === 'bed') {
      doc.roundedRect(x, yy - 1.6 * k, 3.0 * k, 1.3 * k, 0.25, 0.25, 'S');
      doc.line(x, yy - 0.3 * k, x, yy + 0.3 * k); doc.line(x + 3.0 * k, yy - 0.3 * k, x + 3.0 * k, yy + 0.3 * k);
      doc.circle(x + 0.75 * k, yy - 1.95 * k, 0.42 * k, 'S');
    } else if (type === 'cal') {
      doc.roundedRect(x, yy - 2.1 * k, 2.6 * k, 2.5 * k, 0.3, 0.3, 'S');
      doc.line(x, yy - 1.35 * k, x + 2.6 * k, yy - 1.35 * k);
      doc.line(x + 0.7 * k, yy - 2.45 * k, x + 0.7 * k, yy - 1.85 * k); doc.line(x + 1.9 * k, yy - 2.45 * k, x + 1.9 * k, yy - 1.85 * k);
    } else if (type === 'user') {
      doc.circle(x + 1.3 * k, yy - 1.8 * k, 0.7 * k, 'S');
      doc.lines([[0.35 * k, -0.85 * k], [1.9 * k, 0], [0.35 * k, 0.85 * k]], x, yy + 0.25 * k, [1, 1], 'S');
    } else if (type === 'bars') {
      doc.rect(x, yy - 0.9 * k, 0.6 * k, 0.9 * k, 'F');
      doc.rect(x + 0.9 * k, yy - 1.5 * k, 0.6 * k, 1.5 * k, 'F');
      doc.rect(x + 1.8 * k, yy - 2.1 * k, 0.6 * k, 2.1 * k, 'F');
    }
  }

  // ---------- Deckblatt ----------
  const C = (theme === 'dark') ? {
    bg: OBS, scrim: OBS, scrimOp: 0.94, brand: GOLD, sub: [150, 150, 160], div: GOLD,
    title: [255, 255, 255], addr: [232, 232, 234], obj: [165, 165, 175], eyebrow: [140, 140, 150],
    value: GOLD, range: [188, 188, 196], pin: GOLD, foot: [150, 150, 160], footAccent: GOLD, bar: GOLD,
  } : {
    bg: [255, 255, 255], scrim: [255, 255, 255], scrimOp: 0.86, brand: INK, sub: [120, 120, 130], div: [168, 162, 150],
    title: INK, addr: [44, 44, 50], obj: [120, 120, 130], eyebrow: [130, 130, 140],
    value: GOLD, range: [96, 96, 104], pin: [150, 150, 158], foot: [120, 120, 130], footAccent: [150, 150, 158], bar: [210, 206, 196],
  };
  const LX = 14.3; // Deckblatt-Rand exakt nach Mockup (PIL-vermessen 07.06.)
  doc.setFillColor(...C.bg); doc.rect(0, 0, W, H, 'F');
  // 1. Wahl: Mockup-Artwork (Pin + Glow sind im Bild). 2. Wahl: Live-Karte + eigener Pin.
  let covArtUsed = false;
  if (bgCoverArt) {
    try { doc.addImage(bgCoverArt, 'JPEG', 0, 0, W, H, 'covart'); covArtUsed = true; } catch (e) {}
  }
  if (!covArtUsed) {
    let covMapImg = objImg;
    if (covMapImg && theme === 'dark') covMapImg = await enhanceCoverMap(covMapImg);
    if (covMapImg) { try { doc.addImage(covMapImg, 'JPEG', 0, 0, W, H); } catch (e) { try { doc.addImage(covMapImg, 'PNG', 0, 0, W, H); } catch (e2) {} } }
  }
  // Butterweicher Links-/Unten-Fade (Canvas-Gradient, KEIN Banding) — deckt links/unten ab
  if (theme === 'dark') {
    try { doc.addImage(makeCoverFadePNG(), 'PNG', 0, 0, W, H); } catch (e) { leftScrim(C.scrim, 0, W * 0.62, C.scrimOp, 0); }
  } else {
    leftScrim(C.scrim, 0, W * 0.62, C.scrimOp, 0);
  }
  // Radar-Pin nur bei Live-Karte zeichnen (Artwork bringt den leuchtenden Pin mit)
  if (!covArtUsed) radarPin(165, 132, C.pin);
  // Marke 25pt (Mockup): "Deal" weiss/ink + "Pilot" gold — Baseline 32.4
  doc.setFont('helvetica', 'bold'); doc.setFontSize(25);
  doc.setTextColor(...(theme === 'dark' ? [255, 255, 255] : INK));
  doc.text('Deal', LX, 32.4);
  doc.setTextColor(...GOLD);
  doc.text('Pilot', LX + doc.getTextWidth('Deal'), 32.4);
  doc.setTextColor(...C.sub); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text('MARKTBERICHT', LX, 43.6, { charSpace: 1.9 });
  // Gold-Dash (Mockup: y57.4, 15.8 x 1.2)
  doc.setFillColor(...C.div); doc.rect(LX, 57.4, 15.8, 1.2, 'F');
  // Titel 44pt, zweizeilig — Baselines 92.8 / 109.9 (Mockup)
  doc.setTextColor(...C.title); doc.setFont('helvetica', 'bold'); doc.setFontSize(44);
  doc.text('Marktwert-', LX, 92.8);
  doc.text('einschätzung', LX, 109.9);
  // Feine Gold-Trennlinie UNTER dem Titel — y127.1, Länge 97 (Mockup)
  if (doc.GState) { doc.setGState(new doc.GState({ opacity: 0.5 })); }
  doc.setDrawColor(...C.div); doc.setLineWidth(0.4); doc.line(LX, 127.1, LX + 97, 127.1);
  if (doc.GState) { doc.setGState(new doc.GState({ opacity: 1 })); }
  // Adresse 2-zeilig (Straße / PLZ Ort) mit Pin-Icon (Mockup)
  const fullAddr = a.formatted || ref.address || '–';
  let addr1 = fullAddr, addr2 = '';
  const ciAddr = fullAddr.indexOf(',');
  if (ciAddr > 0) { addr1 = fullAddr.slice(0, ciAddr).trim(); addr2 = fullAddr.slice(ciAddr + 1).trim(); }
  covIcon('pin', LX, 138.6, C.value, 1.05);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(...C.addr);
  doc.text(addr1, LX + 6.5, 139.2);
  if (addr2) doc.text(addr2, LX + 6.5, 147.2);
  // Objektzeile mit Icons + Trennstrichen (Mockup)
  doc.setFontSize(9.5);
  {
    const segs = [
      ['home', ref.property_type],
      ['area', ref.living_area ? ref.living_area + ' m²' : null],
      ['bed', ref.rooms ? ref.rooms + ' Zi.' : null],
      ['cal', ref.build_year ? 'Bj. ' + ref.build_year : null],
    ].filter((sg) => sg[1]);
    let ox = LX;
    segs.forEach((sg, i) => {
      covIcon(sg[0], ox, 158.6, C.value, 0.95); ox += sg[0] === 'bed' ? 4.6 : 4.2;
      doc.setTextColor(...C.addr); doc.text(String(sg[1]), ox, 158.8); ox += doc.getTextWidth(String(sg[1])) + 3.4;
      if (i < segs.length - 1) { doc.setTextColor(...C.obj); doc.text('|', ox, 158.6); ox += 4.2; }
    });
  }
  // Marktwert prominent — Eyebrow Baseline 217, Wert 51pt Baseline 236.7 (Mockup)
  doc.setFontSize(9); doc.setTextColor(...C.eyebrow);
  doc.text('MARKTWERT-INDIKATION', LX, 217, { charSpace: 1.6 });
  doc.setTextColor(...C.value); doc.setFont('helvetica', 'bold'); doc.setFontSize(51);
  doc.text(euro(mv.estimated), LX, 236.7);
  doc.setFontSize(12.5); doc.setTextColor(...C.range); doc.setFont('helvetica', 'normal');
  if (mv.low != null && mv.high != null)
    doc.text(euro(mv.low) + '  –  ' + euro(mv.high) + (mv.basis_median_sqm ? '   ·   ' + Math.round(mv.basis_median_sqm).toLocaleString('de-DE') + ' €/m²' : ''), LX, 247);
  // Aussagekraft-Pille (Mockup: y255.2, h8.6)
  if (mv.confidence_pct != null) {
    const pl = 'Aussagekraft: ' + mv.confidence_label + ' · ' + mv.confidence_pct + ' %';
    doc.setFontSize(9.5); const pw = doc.getTextWidth(pl) + 17;
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.roundedRect(LX, 255.2, pw, 8.6, 4.3, 4.3, 'S');
    covIcon('bars', LX + 4.5, 261.0, GOLD, 0.95);
    doc.setTextColor(...GOLD); doc.text(pl, LX + 11, 260.8);
  }
  // OSM-Lizenz (rechtlich nötig) nur bei Live-Karte; Artwork-Cover braucht sie nicht
  if (!covArtUsed) {
    doc.setFontSize(6.5); doc.setTextColor(...(theme === 'dark' ? [110, 110, 120] : [150, 150, 160]));
    doc.text('\u00A9 OpenStreetMap-Mitwirkende', LX, 271.5);
  }
  // Fußzeile (Mockup: Hairline y278.4, Baseline 284.3)
  if (doc.GState) { doc.setGState(new doc.GState({ opacity: 0.45 })); }
  doc.setDrawColor(...C.bar); doc.setLineWidth(0.3); doc.line(LX, 278.4, W - LX, 278.4);
  if (doc.GState) { doc.setGState(new doc.GState({ opacity: 1 })); }
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  {
    let fx = LX;
    covIcon('cal', fx, 284.0, C.footAccent, 0.85); fx += 4.2;
    doc.setTextColor(...C.foot); const f1 = 'Erstellt am ' + new Date().toLocaleDateString('de-DE');
    doc.text(f1, fx, 284.3); fx += doc.getTextWidth(f1) + 4;
    doc.setTextColor(...C.obj); doc.text('|', fx, 284.1); fx += 4;
    covIcon('user', fx, 284.0, C.footAccent, 0.85); fx += 4.4;
    doc.setTextColor(...C.foot); doc.text('Junker Immobilien', fx, 284.3);
  }
  doc.setTextColor(...C.footAccent); doc.setFont('helvetica', 'bold');
  doc.text('dealpilot.junker-immobilien.io', W - LX, 284.3, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  // Inhaltsverzeichnis-Seite reservieren (wird am Ende gefuellt, wenn alle Sektionen bekannt sind).
  doc.addPage();
  const tocPageNo = doc.getNumberOfPages();
  footer(page);                 // "Seite 1" (= Inhalt)
  doc.addPage(); page++; y = M; contentBg(); // Content ab "Seite 2"

  // ---------- Kennzahlen-Überblick ----------
  sectionTitle('Kennzahlen-Überblick');
  // Score-Panel (dunkel) mit Donut-Ring im DealPilot-Look
  need(54);
  const _sc = ds.score || 0, _scol = _sc >= 70 ? [63, 165, 108] : _sc >= 50 ? GOLD : [184, 98, 80];
  const panH = 46;
  doc.setFillColor(10, 10, 13); doc.roundedRect(M, y, W - 2 * M, panH, 2.5, 2.5, 'F');
  /* v962-nopartikel: die acht Streupunkte sind raus. Sie stammen aus der Zeit,
   * als das Panel allein auf der Seite stand; neben dem Doppelring sind sie nur
   * Unruhe. Der Hintergrund ist jetzt durchgehend Obsidian. */
  doc.setDrawColor(...GOLD); doc.setLineWidth(0.3); doc.roundedRect(M, y, W - 2 * M, panH, 2.5, 2.5, 'S');
  doc.setFillColor(...GOLD); doc.roundedRect(M, y + 6, 2, panH - 12, 1, 1, 'F');
  /* v961-scorepanel: Panel wie die Ergebnis-Ansicht. Der Donut rutscht 2 mm
   * hoch, damit die Tier-Pille unter ihm noch ins 46-mm-Panel passt. */
  glowOrb(M + 30, y + 21, 17, _scol, [10, 10, 13], 0.18); // Score-Glow hinter Donut
  scoreDonut(M + 30, y + 21, 16, ds.score, mv.confidence_pct);
  const sbx = M + 58;
  // DEAL-SCORE als Pille (Web) statt als nackter Gold-Text
  doc.setDrawColor(..._scol); doc.setLineWidth(0.35); doc.setFillColor(10, 10, 13);
  doc.roundedRect(sbx, y + 8.4, 29, 5.6, 2.8, 2.8, 'FD');
  doc.setTextColor(..._scol); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6);
  doc.text('DEAL-SCORE', sbx + 14.5, y + 12.2, { align: 'center', charSpace: 0.4 });
  doc.setTextColor(..._scol); doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
  doc.text(_scoreTier(ds.score), sbx, y + 23);      /* v1203: dieselbe Sprache wie auf dem Schirm */
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(178, 178, 188);
  doc.text('Markt- & Chance-Risiko-Bewertung dieses Objekts', sbx, y + 29);
  /* Aussagekraft jetzt IM Panel, nicht erst 20 mm weiter unten als Textzeile.
   * Schwellen identisch zu Z.2217 (70/55) — eine Wahrheit, keine zweite Kette. */
  if (mv.confidence_pct != null) {
    const _cp = mv.confidence_pct;
    const _cc = _cp >= 70 ? [63, 165, 108] : _cp >= 55 ? GOLD : [184, 98, 80];
    doc.setFillColor(..._cc); doc.circle(sbx + 1.3, y + 34.3, 1.3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(..._cc);
    doc.text('Aussagekraft: ' + (mv.confidence_label || '–') + ' · ' + _cp + ' %', sbx + 4.2, y + 35.4);
  }
  // Legende: ohne sie ist der Innenring nur ein zweiter Ring
  doc.setFillColor(..._scol); doc.roundedRect(sbx, y + 39.8, 2.6, 2.6, 0.5, 0.5, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4); doc.setTextColor(138, 138, 147);
  doc.text('Score (Außenring)', sbx + 4.2, y + 42);
  doc.setFillColor(...GOLD); doc.roundedRect(sbx + 32, y + 39.8, 2.6, 2.6, 0.5, 0.5, 'F');
  doc.text('Aussagekraft (Innenring)', sbx + 36.2, y + 42);
  y += panH + 7;
  // Score-Zusammensetzung: macht sichtbar, woraus sich der Deal-Score speist (Backend-Breakdown)
  {
    const bd0 = ds.breakdown || {};
    const COMP = [['Preisabschlag', 'preisabschlag', 30], ['Bruttorendite', 'bruttorendite', 20],
      ['Makrolage', 'makrolage', 20], ['Mikrolage', 'mikrolage', 15],
      ['Mietentwicklung', 'mietentwicklung', 10], ['Risiko', 'risiko', 5]];
    const have = COMP.filter(([, k]) => bd0[k] != null);
    if (have.length) {
      need(26);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT);
      doc.text('SCORE-ZUSAMMENSETZUNG', M, y + 3, { charSpace: 1.1 });
      const cw2 = (W - 2 * M) / have.length;
      have.forEach(([lab, k, wt], i) => {
        const x = M + i * cw2, v = Math.max(0, Math.min(100, bd0[k]));
        const c = v >= 70 ? [67, 183, 124] : v >= 50 ? [201, 168, 76] : [217, 104, 95];
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...c);
        doc.text(String(Math.round(v)), x, y + 10);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(130, 130, 138);
        doc.text('· Gewicht ' + wt + ' %', x + doc.getTextWidth(String(Math.round(v))) + 2, y + 10);
        const bw2 = cw2 - 8;
        doc.setFillColor(232, 230, 224); doc.roundedRect(x, y + 12, bw2, 1.6, 0.8, 0.8, 'F');
        doc.setFillColor(...c); doc.roundedRect(x, y + 12, Math.max(1.6, bw2 * v / 100), 1.6, 0.8, 0.8, 'F');
        doc.setFontSize(6.6); doc.setTextColor(...MUT);
        doc.text(lab, x, y + 17.4);
      });
      doc.setFontSize(6.4); doc.setTextColor(150, 150, 158);
      doc.text('Deal-Score = gewichtete Summe der Teilwerte (0–100): 30 % Preisabschlag · 20 % Bruttorendite · 20 % Makro · 15 % Mikro · 10 % Mietentwicklung · 5 % Risiko.', M, y + 22);
      y += 26;
    }
  }
  // DealScore 2 (DealPilot) bzw. Vereinfacht-Hinweis
  const dsm = d.dealscore_meta;
  if (dsm && !dsm.simplified) {
    /* v964-ds2kontext
     * ──────────────────────────────────────────────────────────────
     * Auf Seite 2 stehen zwei Score-Zahlen: der Markt-Score im Ring und der
     * DealScore 2 hier. Das ist Absicht — die Ergebnis-Ansicht macht es genauso
     * (dsMeta-Box, Z.401-408). Sie ERKLAERT es aber, und das PDF tat es nicht:
     *   Z.404  "aus DealPilot uebernommen [· vollstaendige Finanzierungsdaten]"
     *   Z.407  "Markt-Score dieses Berichts (ohne Finanzierung): X"
     * Zwei Zahlen ohne Erklaerung sehen aus wie ein Widerspruch. Der Mandant
     * legt das Blatt seiner Bank vor — er muss nicht raten, welche Zahl was misst.
     * Die Leiste waechst dafuer von 11 auf 15 mm (y: 16 -> 20).
     */
    need(17);
    doc.setFillColor(245, 242, 232); doc.roundedRect(M, y, W - 2 * M, 15, 2, 2, 'F');
    doc.setFillColor(...GOLD); doc.roundedRect(M, y, 1.6, 15, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...INK);
    doc.text('DealScore 2 (DealPilot): ' + dsm.value + ' / 100', M + 4, y + 6.5);
    const k = dsm.kpis || {};
    const parts = [];
    if (k.dscr != null) parts.push('DSCR ' + (k.dscr.toFixed ? k.dscr.toFixed(2) : k.dscr));
    if (k.ltv_pct != null) parts.push('LTV ' + Math.round(k.ltv_pct) + ' %');
    if (k.cashflow_monthly != null) parts.push('Cashflow ' + Math.round(k.cashflow_monthly) + ' €/M');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 90, 98);
    if (parts.length) doc.text(parts.join('   ·   '), W - M - 4, y + 6.5, { align: 'right' });
    // Die Erklaerzeile aus der Ergebnis-Ansicht — woertlich, damit beide dasselbe sagen.
    doc.setFontSize(7.2); doc.setTextColor(120, 116, 108);
    doc.text('aus DealPilot übernommen' + (dsm.kpis_complete ? ' · vollständige Finanzierungsdaten' : '')
      + (dsm.market_score != null ? '   ·   Markt-Score dieses Berichts (ohne Finanzierung): ' + dsm.market_score : ''),
      M + 4, y + 12);
    y += 20;
  } else if (dsm && dsm.simplified) {
    need(11);
    doc.setFontSize(8); doc.setTextColor(150, 150, 160);
    const nl = doc.splitTextToSize('Vereinfachter Score ohne Finanzierungsdaten – für den vollen DealScore 2 ein DealPilot-Objekt laden.', W - 2 * M);
    doc.text(nl, M, y); y += nl.length * 4 + 3;
  }
  // KPI-Kacheln 3×2
  const tw = (W - 2 * M - 2 * 4) / 3, th = 18;
  const tiles = [
    ['Marktwert', mv.estimated != null ? euro(mv.estimated) : null, GOLD],
    ['Bruttorendite', yld.gross_yield_pct != null ? yld.gross_yield_pct + ' %' : null, [67, 183, 124]],
    ['Kaufpreisfaktor', yld.rent_multiplier != null ? yld.rent_multiplier : null, [150, 142, 120]],
    ['Abw. z. Marktwert', mv.discount_to_market_pct != null ? mv.discount_to_market_pct + ' %' : null, GOLD],
    ['Kaufpreis €/m²', inp.price_per_sqm ? Math.round(inp.price_per_sqm).toLocaleString('de-DE') + ' €' : null, [138, 138, 147]],
    ['Marktmiete €/m²', inp.market_rent_sqm ? inp.market_rent_sqm.toLocaleString('de-DE') + ' €' : null, [138, 138, 147]],
  ].filter((t) => t[1] != null); // leere Kacheln (z.B. Kauf-Szenario ohne Preis) NICHT zeigen
  const tileRows = Math.ceil(tiles.length / 3);
  need(tileRows * (th + 4));
  tiles.forEach((t, i) => {
    const cx = M + (i % 3) * (tw + 4), cy = y + Math.floor(i / 3) * (th + 4);
    tile(cx, cy, tw, th, t[0], t[1], t[2]);
  });
  y += tileRows * (th + 4) + 2;
  // Marktwert-Spanne-Balken
  if (mv.low != null && mv.high != null && mv.estimated != null) {
    need(20); doc.setFontSize(8); doc.setTextColor(...MUT); doc.text('MARKTWERT-SPANNE', M, y); y += 4;
    if (rangeBar(M, y, W - 2 * M, mv.low, mv.estimated, mv.high)) {
      y += 8; doc.setFontSize(8.5); doc.setTextColor(...TXT);
      doc.text(euro(mv.low), M, y);
      doc.setFont('helvetica', 'bold'); doc.text(euro(mv.estimated), M + (W - 2 * M) / 2, y, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.text(euro(mv.high), W - M, y, { align: 'right' });
      y += 8;
    }
  }
  // Aussagekraft: kombinierte Konfidenz (Marktdaten-Stichprobe + Vollständigkeit der Objektangaben)
  /* v959-confsource
   * Hier stand: mv.confidence — die ROHE Stichproben-Konfidenz (~0,9).
   * confInfo() liefert damit den >=0.85-Zweig, also den Satz "Grosse, eng
   * beieinander liegende Vergleichsstichprobe – belastbare Marktwert-
   * indikation." Die Zahl daneben kommt aber aus mv.confidence_pct (47).
   * Ergebnis auf Seite 2 des Prod-Berichts: rote LED "Niedrig · 47 %" und
   * direkt darunter "belastbar". Genau der Widerspruch, den der Kommentar
   * bei confInfo() (Z.558-564) als behoben beschreibt — v955/v956 haben das
   * Dashboard geheilt und diese Zeile vergessen.
   * Jetzt Zeichen fuer Zeichen dieselbe Kette wie das Dashboard (Z.731).
   */
  const cval = (mv.confidence_pct != null) ? (mv.confidence_pct / 100)
             : (mv.confidence != null ? mv.confidence : (d.sale && d.sale.confidence));
  const ci = confInfo(cval, (out.data && out.data.valuation && out.data.valuation.market_value && out.data.valuation.market_value.confidence_parts) || null); /* v956-onesource */
  if (mv.confidence_pct != null || ci) {
    need(24); doc.setFontSize(8); doc.setTextColor(...MUT); doc.text('AUSSAGEKRAFT DER INDIKATION', M, y); y += 5;
    const pct = mv.confidence_pct;
    const lbl = mv.confidence_label || (ci && ci.label) || '';
    const cc = pct != null ? (pct >= 70 ? [63, 165, 108] : pct >= 55 ? GOLD : [184, 98, 80])
      : (ci && ci.color === '#3FA56C' ? [63, 165, 108] : ci && ci.color === window._wlc('#C9A84C') ? GOLD : [184, 98, 80]);
    doc.setFillColor(...cc); doc.circle(M + 2, y - 1, 1.8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...cc);
    const head = pct != null ? `${lbl} · ${pct} %` : `Konfidenz: ${lbl}`;
    doc.text(head, M + 6, y);
    const ns = d.sale && d.sale.sample_size;
    const meta = [ns ? ns.toLocaleString('de-DE') + ' Vergleiche' : null,
      mv.input_filled != null ? `${mv.input_filled}/${mv.input_total} Objektangaben` : null].filter(Boolean).join(' · ');
    if (meta) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUT);
      doc.text('(' + meta + ')', M + 6 + doc.getTextWidth(head) + 4, y);
    }
    y += 6;
    if (pct != null) {
      const bw = W - 2 * M;
      doc.setFillColor(235, 233, 227); doc.roundedRect(M, y, bw, 2.6, 1.3, 1.3, 'F');
      doc.setFillColor(...cc); doc.roundedRect(M, y, bw * Math.max(0.04, pct / 100), 2.6, 1.3, 1.3, 'F');
      y += 7;
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...TXT);
    const msg = (mv.input_missing && mv.input_missing.length)
      ? 'Genauer wird die Bewertung mit: ' + mv.input_missing.join(', ') + '.'
      : (ci ? ci.text : 'Alle wertrelevanten Objektangaben berücksichtigt.');
    const cw = doc.splitTextToSize(msg, W - 2 * M); doc.text(cw, M, y); y += cw.length * 4.4;
  }
  y += 2;

  // ---------- Stammdaten ----------
  sectionTitle('Objekt-Stammdaten', 60);
  const col = (W - 2 * M) / 3; const rows = [
    ['Objekttyp', ref.property_type], ['Wohnfläche', ref.living_area ? ref.living_area + ' m²' : null], ['Zimmer', ref.rooms],
    ['Baujahr', ref.build_year], ['Etage', ref.floor], ['Energieklasse', ref.energy_class],
    ['Zustand', ref.condition || '–'], ['Ausstattung', ref.quality || '–'], ['Modernisierung', ref.modernization || '–'],
  ];
  if (ref.modernization_year) rows.push(['Modernisierungsjahr', ref.modernization_year]);
  if (ref.bathrooms) rows.push(['Badezimmer', ref.bathrooms]);
  if (ref.balcony_area) rows.push(['Balkon/Terrasse', ref.balcony_area + ' m²']);
  if (ref.garden_area) rows.push(['Garten', ref.garden_area + ' m²']);
  if (ref.plot_area) rows.push(['Grundstück', Math.round(ref.plot_area).toLocaleString('de-DE') + ' m²']);
  if (ref.units) rows.push(['Wohneinheiten', ref.units]);
  const stell = [ref.garages ? ref.garages + ' Garage/TG' : null, ref.outdoor_parking ? ref.outdoor_parking + ' außen' : null].filter(Boolean).join(' · ');
  if (stell) rows.push(['Stellplätze', stell]);
  if (ref.elevator) rows.push(['Aufzug', 'ja']);
  rows.push(['Kaufpreis', euro(ref.purchase_price)], ['Kaltmiete/Monat', euro(ref.monthly_net_rent)]);
  for (let i = 0; i < rows.length; i += 3) {
    need(14);
    for (let j = 0; j < 3 && i + j < rows.length; j++) kv(rows[i + j][0], rows[i + j][1], M + j * col, col, rows[i + j][2]); /* v952-kvaccent: [2] war schon da */
    y += 14;
  }
  y += 2;

  // -- Energie-Label-Skala (A+..H, farbig, Marker auf der Objektklasse) --
  const enCls = ref.energy_class ? String(ref.energy_class).toUpperCase().trim() : null;
  if (enCls) {
    const SCALE = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const COLS = [[46,168,104],[78,176,110],[140,190,90],[190,200,80],[218,196,70],[218,168,70],[214,134,72],[200,100,80],[184,82,80]];
    const idx = SCALE.indexOf(enCls);
    if (idx >= 0) {
      need(18);
      doc.setFontSize(8); doc.setTextColor(...MUT); doc.text('ENERGIEKLASSE', M, y + 3, { charSpace: 0.8 });
      const segW = (W - 2 * M) / SCALE.length, segH = 6, sy = y + 6;
      SCALE.forEach((s, i) => {
        const sx = M + i * segW;
        doc.setFillColor(...(i === idx ? COLS[i] : COLS[i].map((c) => Math.round(c + (250 - c) * 0.72))));
        doc.roundedRect(sx, sy, segW - 1.2, segH, 1, 1, 'F');
        doc.setFontSize(7); doc.setFont('helvetica', i === idx ? 'bold' : 'normal');
        doc.setTextColor(...(i === idx ? [255, 255, 255] : [120, 120, 128]));
        doc.text(s, sx + (segW - 1.2) / 2, sy + 4.2, { align: 'center' });
      });
      // Marker-Dreieck über der Objektklasse
      const mx = M + idx * segW + (segW - 1.2) / 2;
      doc.setFillColor(...COLS[idx]);
      doc.triangle(mx - 2, sy - 1.2, mx + 2, sy - 1.2, mx, sy + 1.4, 'F');
      doc.setFont('helvetica', 'normal');
      y = sy + segH + 6;
    }
  }

  // ---------- Marktwert & Marktmiete (Gauge + Spannenbalken) ----------
  sectionTitle('Marktwert & Marktmiete', 104);
  const area = ref.living_area;
  const blockW = W - 2 * M;

  // -- Marktwert & Marktmiete: zwei Karten nebeneinander (Web-Karten-Look) --
  const rmed = d.rent && d.rent.median_per_sqm;
  const rMonth = (rmed && area) ? Math.round(rmed * area) : null;
  const rLo = (d.rent && d.rent.q25_per_sqm && area) ? Math.round(d.rent.q25_per_sqm * area) : null;
  const rHi = (d.rent && d.rent.q75_per_sqm && area) ? Math.round(d.rent.q75_per_sqm * area) : null;
  if (mv.estimated != null || rmed) {
    const hw = (blockW - 6) / 2, ch = 92;
    need(ch + 6);
    const sale = d.sale || {};
    const fmtSqm = (v, dec) => (v != null ? (dec ? v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(v).toLocaleString('de-DE')) : null);
    /* v961-goldzonen
     * ────────────────────────────────────────────────────────────
     * Bis hierher stand hier die Ampel: gruen→gold→rot, bei der Miete invertiert.
     * Die Invertierung war der Beweis, dass die Skala nicht passt — sie musste
     * eine WERTUNG ausdruecken ("teuer = rot", "hohe Miete = gruen"), die die
     * Anzeige gar nicht treffen kann: ein Marktwert am oberen Ende der Spanne
     * ist nicht "schlecht", er liegt nur oben.
     * Die Web-Karte (svgGauge Z.653) macht es richtig: eine Gold-Familie von
     * dunkel nach hell, die nur die LAGE IN DER SPANNE zeigt. Grenzen 0.4/0.72
     * sind die des Webs, nicht die alten 0.33/0.66.
     * _wlc() macht die Toene whitelabel-faehig — genau wie im Web. jsPDF kennt
     * kein var(), deshalb hier der Umweg ueber den Laufzeit-Hex. */
    /* v962-balkenampel: zurueck auf den Stand vor v961.
     * segMW/segMiete fuettern NICHT den Tacho, sondern den waagerechten Balken
     * unter dem Wert (`segs: segMW`). Der SOLL Ampel bleiben — die Web-Karte
     * macht es genauso (rangeStrip Z.673: #2f4030 / #3d3a24 / #3f2a24).
     * v961 hat ihn vergoldet und den Tacho nicht angefasst: falsches Ziel. */
    /* v963-goldbalken: der Spannbalken in der Karte bekommt dieselbe Gold-
     * Familie wie der Tacho. Grenzen 0.4/0.72 wie dort, LUECKENLOS (vorher
     * 0.33->0.34: die Luecke war der Grund, warum es wie drei Pillen aussah).
     * Keine Invertierung mehr: die Skala zeigt die Lage, sie wertet nicht. */
    const segMW = [[0, 0.4, GOLD_D()], [0.4, 0.72, GOLD_M()], [0.72, 1, GOLD_L()]];
    const segMiete = segMW;
    const drawValueCard = (x, o) => {
      obsidianCard(x, y, hw, ch);
      const ix = x + 8, iw = hw - 16;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(165, 165, 175);
      doc.text(o.title, ix, y + 10, { charSpace: 1.1 });
      // Tacho zentral, Wert im Tacho (wie Web-Karte)
      gauge(x + hw / 2, y + 38, 16.5, o.lo, o.hi, o.val, {
        dark: true, caption: o.caption,
        loLabel: o.loLbl, hiLabel: o.hiLbl, marker: o.marker, markerColor: [232, 226, 212],
        zones: o.zones, valueText: o.valTxt, valueColor: [255, 255, 255],
      });
      // grosser Wert + Median-Zeile + €/m²-Spanne — Wert auto-skaliert, damit er nie ueberlaeuft
      doc.setFont('helvetica', 'bold');
      let vfs = 20; doc.setFontSize(vfs);
      while (doc.getTextWidth(o.valTxt) > iw && vfs > 12) { vfs -= 1; doc.setFontSize(vfs); }
      doc.setTextColor(...o.valCol);
      doc.text(o.valTxt, ix, y + 58);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(200, 200, 208);
      if (o.medLine) doc.text(o.medLine, ix, y + 64);
      doc.setFontSize(7); doc.setTextColor(150, 150, 160);
      if (o.spanLine) doc.text(o.spanLine, ix, y + 68.5);
      // Spannen-Balken mit Gold-Punkt (Wert) + weissem Dreieck (Kaufpreis)
      if (o.lo != null && o.hi != null && o.hi > o.lo) {
        const by = y + 72.5, bh = 2.6;
        /* v963-spannschieber: ein durchgehender Track mit gerundeten Enden statt
         * drei einzeln gerundeter Pillen. Basis in der dunkelsten Stufe, die
         * beiden helleren als gerade Rechtecke darueber, rechte Kappe hell. */
        const _r = bh / 2;
        doc.setFillColor(...o.segs[0][2]);
        doc.roundedRect(ix, by, iw, bh, _r, _r, 'F');
        o.segs.slice(1).forEach(([f, t, c]) => {
          const w2 = iw * (t - f) - (t >= 1 ? _r : 0);
          if (w2 > 0) { doc.setFillColor(...c); doc.rect(ix + iw * f, by, w2, bh, 'F'); }
        });
        doc.setFillColor(...o.segs[o.segs.length - 1][2]);
        doc.roundedRect(ix + iw - bh, by, bh, bh, _r, _r, 'F');
        const frac = Math.max(0, Math.min(1, (o.val - o.lo) / (o.hi - o.lo)));
        const mxp = ix + iw * frac;
        /* Gold auf Gold ist unsichtbar. Die Web-Karte loest das mit einem dunklen
         * Ring um den Knopf (rangeStrip Z.674: box-shadow 0 0 0 3px #141417) —
         * genau der ersetzt hier den alten Gold-Glow, der jetzt nichts mehr traegt. */
        doc.setFillColor(20, 20, 23); doc.circle(mxp, by + bh / 2, 2.5, 'F');
        doc.setFillColor(...GOLD); doc.circle(mxp, by + bh / 2, 1.7, 'F');
        doc.setFillColor(255, 255, 255); doc.circle(mxp, by + bh / 2, 0.6, 'F');
        if (o.marker != null && o.marker >= o.lo && o.marker <= o.hi) {
          const kf = (o.marker - o.lo) / (o.hi - o.lo), kx = ix + iw * kf;
          doc.setFillColor(232, 226, 212);
          doc.triangle(kx - 1.5, by - 1.6, kx + 1.5, by - 1.6, kx, by + 0.4, 'F');
        }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(150, 150, 160);
        doc.text(o.loFull, ix, by + bh + 4);
        doc.text(o.hiFull, ix + iw, by + bh + 4, { align: 'right' });
      }
      // Fusszeile der Karte: Aussagekraft (MW) bzw. Kaufpreis-Hinweis
      if (o.foot) {
        doc.setFillColor(...o.footCol); doc.circle(ix + 1.2, y + ch - 6.6, 1.2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...o.footCol);
        doc.text(o.foot, ix + 4, y + ch - 5.6);
      }
    };
    if (mv.estimated != null) {
      const cl = mv.confidence_label || '', cp = mv.confidence_pct;
      const footCol = (cp != null && cp >= 75) ? [67, 183, 124] : (cp != null && cp >= 50) ? [217, 180, 90] : [217, 104, 95];
      drawValueCard(M, {
        title: 'MARKTWERT (INDIKATION)',
        lo: mv.low, hi: mv.high, val: mv.estimated,
        valTxt: euro(mv.estimated), valCol: GOLD, caption: 'Lage in der Spanne',
        loLbl: mv.low != null ? Math.round(mv.low / 1000) + 'k' : null,
        hiLbl: mv.high != null ? Math.round(mv.high / 1000) + 'k' : null,
        marker: ref.purchase_price, zones: undefined, segs: segMW,
        medLine: mv.basis_median_sqm ? fmtSqm(mv.basis_median_sqm) + ' €/m²  ·  Median' : null,
        spanLine: (sale.q25_per_sqm != null && sale.q75_per_sqm != null)
          ? 'Spanne ' + fmtSqm(sale.q25_per_sqm) + ' – ' + fmtSqm(sale.q75_per_sqm) + ' €/m²' : null,
        loFull: mv.low != null ? euro(mv.low) : '', hiFull: mv.high != null ? euro(mv.high) : '',
        foot: (cl && cp != null) ? 'Aussagekraft: ' + cl + ' · ' + cp + ' %' : null, footCol,
      });
    }
    if (rmed) {
      drawValueCard(mv.estimated != null ? M + hw + 6 : M, {
        title: 'MARKTMIETE KALT (MONAT)',
        lo: rLo, hi: rHi, val: rMonth != null ? rMonth : rmed,
        valTxt: rMonth != null ? euro(rMonth) : rmed.toLocaleString('de-DE') + ' €/m²',
        valCol: [255, 255, 255], caption: 'Mietspanne',
        loLbl: rLo != null ? rLo + '€' : null, hiLbl: rHi != null ? rHi + '€' : null,
        /* v963-mietetacho
         * ──────────────────────────────────────────────────────────
         * Hier standen die Zonen INLINE: rot -> gold -> gruen (invertierte Ampel).
         * Damit war opts.zones gesetzt und der Gold-Default aus v962 griff nie —
         * der Marktwert-Tacho wurde gold, der Miet-Tacho blieb Ampel.
         * Es gibt ZWEI drawValueCard-Aufrufe. Ich hatte nur den ersten gelesen.
         * zones: undefined -> beide holen sich denselben Default aus gauge().
         */
        marker: null, zones: undefined,
        segs: segMiete,
        medLine: fmtSqm(rmed, true) + ' €/m²  ·  Median',
        spanLine: (d.rent.q25_per_sqm != null && d.rent.q75_per_sqm != null)
          ? 'Spanne ' + fmtSqm(d.rent.q25_per_sqm, true) + ' – ' + fmtSqm(d.rent.q75_per_sqm, true) + ' €/m²' : null,
        loFull: rLo != null ? euro(rLo) : '', hiFull: rHi != null ? euro(rHi) : '',
        foot: ref.purchase_price != null && rMonth != null
          ? 'Brutto-Faktor: ' + (ref.purchase_price / (rMonth * 12)).toFixed(1) : null,
        footCol: [165, 165, 175],
      });
    }
    y += ch + 6;
  }

  // -- €/m²-Spannen (Kauf + Miete) nebeneinander --
  need(24);
  const halfW = (blockW - 6) / 2;
  doc.setFontSize(8); doc.setTextColor(...MUT);
  doc.text('KAUFPREIS €/m²', M, y + 4);
  doc.text('MIETE €/m²', M + halfW + 6, y + 4);
  const sale = d.sale || {};
  if (sale.q25_per_sqm != null && sale.q75_per_sqm != null && sale.median_per_sqm != null) {
    rangeBarPro(M, y + 8, halfW, sale.q25_per_sqm, sale.median_per_sqm, sale.q75_per_sqm,
      (v) => Math.round(v).toLocaleString('de-DE') + ' €', inp.price_per_sqm, null);
  }
  if (d.rent && d.rent.q25_per_sqm != null && d.rent.q75_per_sqm != null && rmed != null) {
    rangeBarPro(M + halfW + 6, y + 8, halfW, d.rent.q25_per_sqm, rmed, d.rent.q75_per_sqm,
      (v) => v.toLocaleString('de-DE') + ' €', null, null);
  }
  y += 22;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUT);
  doc.text('Spanne = mittlere 50 % der Vergleichsangebote (Quartile q25–q75) · Mitte = Median · Dreieck = dieses Objekt', M, y);
  y += 4;
  // Gesamtspanne (min–max) der Vergleichsdaten als Zusatzinfo
  if ((sale.min_per_sqm != null && sale.max_per_sqm != null) || (d.rent && d.rent.min_per_sqm != null && d.rent.max_per_sqm != null)) {
    const gp = [];
    if (sale.min_per_sqm != null && sale.max_per_sqm != null)
      gp.push('Kauf gesamt ' + Math.round(sale.min_per_sqm).toLocaleString('de-DE') + '–' + Math.round(sale.max_per_sqm).toLocaleString('de-DE') + ' €/m²');
    if (d.rent && d.rent.min_per_sqm != null && d.rent.max_per_sqm != null)
      gp.push('Miete gesamt ' + d.rent.min_per_sqm.toLocaleString('de-DE') + '–' + d.rent.max_per_sqm.toLocaleString('de-DE') + ' €/m²');
    doc.text('Gesamtspanne aller Vergleiche: ' + gp.join('  ·  '), M, y + 3.5);
    y += 9;
  }

  // KPIs
  need(16);
  const kpis = [
    yld.gross_yield_pct != null ? ['Bruttorendite', yld.gross_yield_pct + ' %'] : null,
    yld.rent_multiplier != null ? ['Kaufpreisfaktor', yld.rent_multiplier] : null,
    ds.score != null ? ['Deal-Score', ds.score + ' (' + _scoreTier(ds.score) + ')'] : null,   /* v1203 */
  ].filter(Boolean);
  if (kpis.length) { kpis.forEach((k, i) => kv(k[0], k[1], M + i * col, col, k[2])); y += 16; } /* v952-kvaccent */

  // ---------- Preisstrategie (Min — Marktwert — Max) ----------
  if (mv.estimated != null && mv.low != null && mv.high != null && mv.high > mv.low) {
    sectionTitle('Preisstrategie', 999);   /* v1040: immer neue Seite */
    need(40);
    const pw = blockW, ph = 7, py0 = y + 16;
    const span = mv.high - mv.low;
    const px = (v) => M + (Math.max(mv.low, Math.min(mv.high, v)) - mv.low) / span * pw;
    // Kopfwerte: Mindest | Marktwert | Maximal
    const colsW = pw / 3;
    const head3 = (lab, val, sub, cx, big, goldVal) => {
      doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.text(lab, cx, y + 3, { align: 'center', charSpace: 0.6 });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(big ? 15 : 11.5);
      doc.setTextColor(...(goldVal ? GOLD : TXT)); doc.text(val, cx, y + (big ? 10 : 9), { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT);
      if (sub) doc.text(sub, cx, y + 13.5, { align: 'center' });
    };
    const sq = (v) => area ? Math.round(v / area).toLocaleString('de-DE') + ' €/m²' : null;
    head3('MINDESTPREIS', euro(mv.low), sq(mv.low), M + colsW * 0.5, false, false);
    head3('MARKTWERT (INDIKATION)', euro(mv.estimated), sq(mv.estimated), M + colsW * 1.5, true, true);
    head3('MAXIMALPREIS', euro(mv.high), sq(mv.high), M + colsW * 2.5, false, false);
    // Band im Vorlagen-Look: helle Aussen-Segmente + dunkler Kern, mit feinen Luecken
    const ph2 = 5.5, gap = 1.6;
    doc.setFillColor(214, 212, 206); doc.roundedRect(M, py0, pw * 0.115 - gap, ph2, 1.6, 1.6, 'F');
    doc.setFillColor(...INK); doc.roundedRect(M + pw * 0.115, py0, pw * 0.77, ph2, 1.6, 1.6, 'F');
    doc.setFillColor(214, 212, 206); doc.roundedRect(M + pw * 0.885 + gap, py0, pw * 0.115 - gap, ph2, 1.6, 1.6, 'F');
    // Marktwert-Marker (gold)
    const mx = px(mv.estimated);
    doc.setFillColor(...GOLD); doc.triangle(mx - 2.8, py0 - 2.0, mx + 2.8, py0 - 2.0, mx, py0 + 2.4, 'F');
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.7); doc.line(mx, py0, mx, py0 + 5.5);
    // Kaufpreis-Marker (falls vorhanden)
    if (ref.purchase_price != null) {
      const kx = px(ref.purchase_price);
      doc.setFillColor(150, 142, 120);
      doc.triangle(kx - 2, py0 + 5.5 + 2.4, kx + 2, py0 + 5.5 + 2.4, kx, py0 + 5.5 - 0.2, 'F');
      doc.setFontSize(7); doc.setTextColor(120, 113, 100);
      doc.text('Kaufpreis ' + euro(ref.purchase_price), kx, py0 + 5.5 + 6.5, { align: 'center' });
    }
    y = py0 + 5.5 + (ref.purchase_price != null ? 10 : 6);
    doc.setFontSize(7); doc.setTextColor(...MUT);
    {
      const recl = doc.splitTextToSize('Empfehlung: Angebote unterhalb des Marktwerts bieten Verhandlungspuffer; oberhalb des Maximalpreises ist besondere Begründung (Lage, Zustand, Ausstattung) erforderlich.', W - 2 * M);
      doc.text(recl, M, y);
      y += recl.length * 3.6 + 2.5;
    }
  }

  // ---------- Bodenrichtwert (BORIS) ----------
  const lv = d.land_value;
  if (lv && lv.available && lv.value_sqm != null) {
    sectionTitle('Bodenrichtwert (amtlich)');
    need(30);
    doc.setFillColor(...INK); doc.roundedRect(M, y, blockW, 26, 2, 2, 'F');
    doc.setFillColor(...GOLD); doc.roundedRect(M, y, 2.5, 26, 1, 1, 'F');
    doc.setTextColor(...GOLD); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text('BODENRICHTWERT', M + 8, y + 8);
    doc.setTextColor(255, 255, 255); doc.setFontSize(22);
    doc.text(Math.round(lv.value_sqm).toLocaleString('de-DE') + ' €/m²', M + 8, y + 19);
    const lcomp = (d.valuation && d.valuation.land_component) || null;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(180, 180, 188);
    const info = [];
    if (lv.nutzung) info.push('Nutzung ' + lv.nutzung);
    if (lv.stichtag) info.push('Stichtag ' + lv.stichtag);
    if (lv.used_year) info.push('Jahrgang ' + lv.used_year);
    doc.text(info.join('  ·  '), M + 60, y + 9);
    doc.setTextColor(210, 210, 216); doc.setFontSize(9);
    if (lcomp && lcomp.land_value_total_eur != null) {
      doc.text('Grundstück ' + Math.round(lcomp.plot_area_sqm).toLocaleString('de-DE') + ' m² · Bodenwert ' + euro(lcomp.land_value_total_eur), M + 60, y + 16);
    } else {
      const bodenAnteil = area && lv.value_sqm ? Math.round(lv.value_sqm * area) : null;
    /* WPDF26-1 · Diese Zeile rechnete Wohnflaeche x Bodenrichtwert, was
     * fachlich nichts bedeutet — und stand im Widerspruch zum Bodenwert in
     * der Ertragswert-Staffel (11.450 gegen 160.300 im selben Dokument).
     * Jetzt wird der Wert aus der Rechnung gezeigt, sonst gar keiner. */
    const _bwEcht = d.cross_check && d.cross_check.ertragswert
      && d.cross_check.ertragswert.bodenwert_eur;
    if (_bwEcht) doc.text('Bodenwertanteil dieses Objekts: ' + euro(_bwEcht), M + 90, y + 12);
      if (false) doc.text('Rechnerischer Bodenwertanteil (' + area + ' m²): ' + euro(bodenAnteil), M + 60, y + 16);
    }
    doc.setFontSize(7); doc.setTextColor(150, 150, 160);
    if (lv.license) doc.text(lv.license, M + 60, y + 22);
    y += 30;
    if (lcomp && lcomp.value_eur > 0) {
      need(8);
      doc.setFontSize(8); doc.setTextColor(120, 113, 100);
      doc.text('Im Marktwert berücksichtigt: +' + euro(lcomp.value_eur) + ' Mehrflächen-Bodenwert (' +
        Math.round(lcomp.excess_sqm).toLocaleString('de-DE') + ' m² über typischem Grundstück von ' + lcomp.typical_plot_sqm +
        ' m², Marktfaktor ' + lcomp.market_factor + ').', M, y);
      y += 7;
    }
  }



  // ---------- Wertverfahren im Vergleich (Sachwert/Ertragswert-Quercheck) ----------
  const cc = d.cross_check;
  if (cc && cc.available && cc.comparison) {
    sectionTitle('Wertverfahren im Vergleich', 70);
    need(56);
    const cardW = (blockW - 12) / 3, cardH = 40;
    const card3 = (x, title, value, lines, lead) => {
      doc.setFillColor(...(lead ? INK : [245, 243, 238])); doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'F');
      doc.setFillColor(...GOLD); doc.roundedRect(x, y, 2, cardH, 1, 1, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6);
      doc.setTextColor(...(lead ? GOLD : [120, 113, 100]));
      doc.text(title, x + 6, y + 7, { charSpace: 0.3 });
      doc.setFontSize(15); doc.setTextColor(...(lead ? GOLD : TXT));
      doc.text(value != null ? euro(value) : '–', x + 6, y + 16);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
      doc.setTextColor(...(lead ? [185, 185, 192] : [110, 110, 118]));
      let ly = y + 22;
      /* v959-cardwrap: die Zeilen wurden roh gemalt. Die Begruendung aus v956
       * ("Sachwertverfahren fuer Eigentumswohnungen nicht anwendbar (NHK-
       * Tabelle und BGF-Faktor gelten fuer Einfamilienhaeuser)") ist EIN
       * langer String -> lief quer ueber die Nachbarkarte. Jetzt umbrochen
       * auf die Kartenbreite. Die 4-Zeilen-Grenze bleibt wie gehabt. */
      /* v962-cardfit
       * ────────────────────────────────────────────────────────
       * v959 hat den Text umbrochen, aber `slice(0, 4)` hat ihn danach wortlos
       * abgeschnitten — im Prod-PDF endet der Sachwert-Hinweis mitten im Satz:
       * "...BGF-Faktor gelten für". Ein Hinweis, der mittendrin aufhoert, ist
       * schlimmer als keiner: er sieht aus, als stimme er.
       * Jetzt wird die Schrift verkleinert, bis der GANZE Text in die Karte passt.
       * Karten mit drei kurzen Zeilen bleiben bei 7 pt — unveraendert. Nur die
       * lange Begruendung schrumpft.
       */
      const _avail = cardH - 24; // von ly = y+22 bis zum Kartenfuss
      let _fs = 7, _lh = 4.4, _cl = [];
      for (;;) {
        doc.setFontSize(_fs);
        _cl = [];
        lines.filter(Boolean).forEach((l) => {
          doc.splitTextToSize(String(l), cardW - 12).forEach((w) => _cl.push(w));
        });
        if (_cl.length * _lh <= _avail || _fs <= 4.6) break;
        _fs -= 0.4; _lh = _fs * 0.63;
      }
      _cl.forEach((l) => { doc.text(l, x + 6, ly); ly += _lh; });
    };
    /* v1062-WFUE-1 · Die erste Karte war immer die fuehrende: "lead" stand
     * fest am Vergleichswert. Paragraf 6 Abs. 1 ImmoWertV waehlt das Verfahren
     * aber nach der Art des Objekts, und cross_check.verfahrenswahl rechnet
     * das seit v1061 aus — es stand nur nirgends im Dokument. */
    const _vw = cc.verfahrenswahl || null;
    const _vwKey = (_vw && _vw.verfahren) ? _vw.verfahren : null;
    const _fuehrt = (k) => (_vwKey ? _vwKey === k : k === 'vergleichswert');
    const sw = cc.sachwert || {}, ew = cc.ertragswert || {};
    /* v1057-WVGL-1 · Oben steht die Marktpreisindikation aus Angeboten —
     * das ist richtig und aktuell. Hier unten steht der Verfahrensvergleich
     * nach ImmoWertV, und Paragraf 25 verlangt dafuer KAUFPREISE.
     * Solange wir Angebote fuehren, muss die Karte es sagen; sonst stehen
     * oben und unten dieselbe Zahl aus derselben Quelle und bestaetigen
     * sich gegenseitig. */
    const _irwOk = cc.irw && cc.irw.verfuegbar && cc.irw.wert_qm > 0;
    const _vglTitel = _irwOk ? 'VERGLEICHSWERT · AMTLICH' : 'MARKTPREIS AUS ANGEBOTEN';
    card3(M, _vglTitel, cc.comparison.vergleichswert_eur, [
      mv.basis_median_sqm ? Math.round(mv.basis_median_sqm).toLocaleString('de-DE') + ' €/m² Median' : null,
      (d.sale && d.sale.sample_size) ? d.sale.sample_size + ' Vergleichsangebote' : null,
      /* v1057-WVGL-2 */
      _irwOk
        ? 'Immobilienrichtwert ' + cc.irw.wert_qm + ' €/m² · Stichtag ' + (cc.irw.stichtag || '?')
        : 'Angebotspreise — keine beurkundeten Kaufpreise (§ 25 ImmoWertV)',
      /* v1061-WTXT-1 · Hier stand der rohe Bezeichner: "Immobilienrichtwerte:
       * nicht_beschlossen". Ein Datenbankwert im Kundenbericht. */
      (!_irwOk && cc.irw) ? ({
        nicht_beschlossen: 'Immobilienrichtwerte für diese Gemeinde noch nicht beschlossen',
        kein_treffer: 'kein Immobilienrichtwert an dieser Stelle',
        kein_wert: 'Immobilienrichtwert ohne Betrag',
        technisch: 'Immobilienrichtwert derzeit nicht abrufbar',
      }[cc.irw.grund] || null) : null,
    ], _fuehrt('vergleichswert'));   /* v1062-WFUE-2 */
    card3(M + cardW + 6, 'SACHWERT · INDIKATIV', sw.available ? sw.value_eur : null, sw.available ? [
      /* v1056-WKRT-1 · Die drei Felder gab es im Ergebnis nicht; die Karte
       * zeigte "ohne Bodenwert · Gebäude – · RND undefined J." neben einer
       * korrekten Staffel. Jetzt liefert der Rechenkern sie. */
      sw.hinweis_kurz || null,
      sw.bodenwert_eur != null ? 'Bodenwert ' + euro(sw.bodenwert_eur) : 'ohne Bodenwert',
      sw.gebaeude_sachwert_eur != null ? 'Gebäude ' + euro(sw.gebaeude_sachwert_eur) : null,
      (sw.restnutzungsdauer_jahre != null && sw.gesamtnutzungsdauer_jahre != null)
        ? 'RND ' + String(sw.restnutzungsdauer_jahre).replace('.', ',') + ' J. / GND '
          + sw.gesamtnutzungsdauer_jahre + ' J.'
          /* v1083b-WPDF-1 · EIN STILLER RUECKFALL IST SCHLIMMER ALS EIN
           * FEHLER. Ohne erfassten Modernisierungsgrad rechnet die
           * Restnutzungsdauer als GND minus Alter statt nach Anlage 2 — an
           * der Loehner Strasse 18 statt 24 Jahre, rund 57.500 EUR weniger
           * Gebaeudesachwert. Die Zahl stand hier bisher ohne jeden Hinweis,
           * als waere sie nach Anlage 2 ermittelt. Das Backend liefert die
           * Herkunft seit v1083-WRND; sie wurde nur nie gedruckt. */
          + ((sw.restnutzungsdauer_herkunft
              && sw.restnutzungsdauer_herkunft.quelle === 'geschaetzt')
              ? ' \u00b7 gesch\u00e4tzt' : '')
        : null,
      /* v1083b-WPDF-2 · Warum kein Sachwertfaktor angesetzt wurde. "Ohne
       * Sachwertfaktor" ist eine Feststellung, keine Begruendung — bei einer
       * Eigentumswohnung leitet der Gutachterausschuss naemlich gar keinen
       * ab. Der Bildschirm zeigt den Grund seit v1143, das PDF nicht. */
      (sw.available && !sw.marktangepasst && sw.sachwertfaktor_grund)
        ? ({ objektart_nicht_abgeleitet: 'Ausschuss leitet f\u00fcr diese Objektart keinen Faktor ab',
             kein_ausschuss_hinterlegt: 'kein Gutachterausschuss hinterlegt',
             anderer_ausschuss: 'au\u00dferhalb des zust\u00e4ndigen Ausschusses',
             ausserhalb_der_tabelle: 'Objekt liegt au\u00dferhalb der ver\u00f6ffentlichten Tabelle',
             brw_fehlt: 'Bodenrichtwert fehlt' }[sw.sachwertfaktor_grund]
           || String(sw.sachwertfaktor_grund).replace(/_/g, ' '))
        : null,
    ] : [(cc.sachwert && cc.sachwert.grund) || (cc.ertragswert && cc.ertragswert.grund) || 'nicht berechenbar'],
      _fuehrt('sachwert'));   /* v1062-WFUE-3 */
    card3(M + 2 * (cardW + 6), 'ERTRAGSWERT · INDIKATIV', ew.available ? ew.value_eur : null, ew.available ? [
      'Rohertrag ' + euro(ew.rohertrag_pa_eur) + ' p.a.',
      'Reinertrag ' + euro(ew.reinertrag_pa_eur) + ' p.a.',
      'LZ ' + ew.liegenschaftszins_pct + ' % · V ' + ew.vervielfaeltiger,
    ] : [(cc.sachwert && cc.sachwert.grund) || (cc.ertragswert && cc.ertragswert.grund) || 'nicht berechenbar'],
      _fuehrt('ertragswert'));   /* v1062-WFUE-4 */
    y += cardH + 5;

    /* v1062-WFUE-5 · Drei Karten nebeneinander ohne Rangfolge lesen sich wie
     * drei Meinungen. Der Bericht sagt jetzt, welche fuehrt und warum. */
    if (_vw && _vw.verfahren) {
      const _vwName = { sachwert: 'Sachwertverfahren', ertragswert: 'Ertragswertverfahren',
        vergleichswert: 'Vergleichswertverfahren' }[_vw.verfahren] || _vw.verfahren;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setCharSpace(0);
      const _vwT = doc.splitTextToSize(String(_vw.grund || '')
        + (_vw.quelle ? '  (' + _vw.quelle + ')' : ''), blockW - 10);
      const _vwH = 8.5 + _vwT.length * 3.1;
      need(_vwH + 4);
      doc.setFillColor(247, 243, 233); doc.roundedRect(M, y, blockW, _vwH, 2, 2, 'F');
      doc.setFillColor(...GOLD); doc.roundedRect(M, y, 1.6, _vwH, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(...TXT);
      doc.text('Führendes Verfahren: ' + _vwName, M + 5, y + 5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUT);
      doc.text(_vwT, M + 5, y + 9.8);
      y += _vwH + 4;
      doc.setFontSize(8);
    }
    if (cc.comparison.spread_pct != null) {
      doc.setFontSize(8); doc.setTextColor(...TXT);
      const sp = cc.comparison.spread_pct;
      doc.text('Verfahrens-Spread: ' + sp.toLocaleString('de-DE') + ' % — ' +
        (sp <= 15 ? 'die Verfahren stützen sich gegenseitig (hohe Plausibilität der Indikation).'
          : sp <= 30 ? 'moderate Abweichung; Objektbesonderheiten prüfen.'
          : 'große Abweichung; Wert nur mit weiterer Prüfung verwenden.'), M, y + 3);
      y += 7;
    }
    /* v1062-WAMT-1 · Amtliche Miete (v1059) und amtlicher Vergleichsfaktor
     * (v1060) liegen vollstaendig im Ergebnis und standen nirgends im
     * Dokument. Beide sind Auskuenfte des Gutachterausschusses — auch dort,
     * wo das Objekt aus seinem Anwendungsbereich faellt. Gerade dann. */
    const _am = cc.amtliche_miete, _avf = cc.amtlicher_vergleichsfaktor;
    const _amtZeilen = [];
    if (_am && _am.verfuegbar) {
      _amtZeilen.push([
        'Marktüblich erzielbare Miete · Mietpreisübersicht',
        String(_am.miete_qm).replace('.', ',') + ' €/m²'
          + (_am.miete_monat != null ? '  ·  ' + euro(Math.round(_am.miete_monat)) + '/Monat' : ''),
        (_am.staffel || []).map((s) => s.pos
          + (s.faktor != null ? '  ' + String(s.faktor).replace('.', ',')
            : (s.wert != null ? '  ' + String(s.wert).replace('.', ',') : ''))).join('   ·   '),
        _am.ausserhalb_tabelle ? (_am.ausserhalb_hinweis || '') : (_am.hinweis || ''),
      ]);
    }
    if (_avf && _avf.verfuegbar) {
      _amtZeilen.push([
        'Vergleichsfaktor § 20 ImmoWertV',
        euro(_avf.wert_eur) + (_avf.rechnung ? '   (' + _avf.rechnung + ')' : ''),
        [_avf.teilmarkt, _avf.baujahresklasse, _avf.gemeinde_quelle].filter(Boolean).join('   ·   '),
        _avf.ausserhalb_grenzen
          ? (_avf.ausserhalb_gruende || []).join(' ')
          : (_avf.hinweis || ''),
      ]);
    }
    if (_amtZeilen.length) {
      need(16);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); doc.setTextColor(120, 113, 100);
      doc.setCharSpace(0.3);
      doc.text('AMTLICHE WERTE DES GUTACHTERAUSSCHUSSES', M, y + 3);
      doc.setCharSpace(0);
      y += 7;
      _amtZeilen.forEach((_z) => {
        need(8);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.6); doc.setTextColor(...TXT);
        doc.text(_z[0], M, y + 3);
        doc.text(_z[1], M + blockW, y + 3, { align: 'right' });
        y += 5;
        if (_z[2]) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4); doc.setTextColor(...MUT);
          const _zl = doc.splitTextToSize(_z[2], blockW);
          need(_zl.length * 3 + 3);
          doc.text(_zl, M, y + 2); y += _zl.length * 3 + 1;
        }
        if (_z[3]) {
          doc.setFont('helvetica', 'italic'); doc.setFontSize(6.4); doc.setTextColor(150, 143, 130);
          const _zh = doc.splitTextToSize(_z[3], blockW);
          need(_zh.length * 3 + 4);
          doc.text(_zh, M, y + 2); y += _zh.length * 3 + 3;
          doc.setFont('helvetica', 'normal');
        }
      });
      y += 2;
    }

    doc.setFontSize(6.5); doc.setTextColor(...MUT);
    /* v959-footnote: stand als EIN doc.text() da und lief rechts aus dem Satz-
     * spiegel — im Prod-Bericht endet Seite 4 mit "Kein Gutachten n. § 194 Bau".
     * Jetzt auf die Blockbreite umbrochen. Bei einer Zeile ist y += 5 + 1*3 = 8,
     * also exakt der alte Wert; nur laengere Fussnoten schieben nach. */
    const _fn = doc.splitTextToSize('Vereinfachte Verfahren n. ImmoWertV-Logik (indikativ): NHK 2010 ' +       /* v1061-WFUS-1 · Die Fussnote nannte 835 EUR/m2 (Stufe 3), gerechnet
       * wurde mit 985 (Stufe 4). Wie bei Quote und Zinssatz: aus dem
       * Ergebnis nehmen, nicht aus der Annahme. */
((cc.sachwert && cc.sachwert.available && cc.sachwert.nhk_eur_qm_bgf)
        ? cc.sachwert.nhk_eur_qm_bgf : cc.assumptions.nhk_efh_bgf_eur)
      + ' €/m² BGF × Baupreisindex ' +
      /* v1050-WFUS-1 · Vorher stand hier der Modellvorgabewert, auch wenn
       * ganz anders gerechnet wurde: bei Huellhorst 23 statt der aus der
       * Ernte stammenden 23,5 Prozent und 3,0 statt 2,2. Eine Annahme, die
       * etwas anderes behauptet als die Rechnung, ist schlimmer als keine.
       * Jetzt aus dem Ergebnis, mit Rueckfall auf die Annahme. */
      cc.assumptions.baupreisindex_2010_heute + ' · BWK '
      + ((cc.ertragswert && cc.ertragswert.available && cc.ertragswert.rohertrag_pa_eur > 0)
          ? (Math.round(cc.ertragswert.bwk_pa_eur / cc.ertragswert.rohertrag_pa_eur * 1000) / 10)
              .toLocaleString('de-DE')
          : Math.round(cc.assumptions.bwk_quote * 100)) + ' % · Liegenschaftszins '
      /* v1052-WFUS-1 · v1050 hat die Quote aus dem Ergebnis geholt, den
       * Zinssatz nicht. Die Fussnote nannte weiter 3 %, gerechnet wurden
       * 2,2 %. Eine Datei, zwei Stellen — schon wieder. */
      + (((cc.ertragswert && cc.ertragswert.available && cc.ertragswert.liegenschaftszins_pct != null)
          ? cc.ertragswert.liegenschaftszins_pct
          : (cc.assumptions.liegenschaftszins * 100)).toLocaleString('de-DE'))
      + ' % · ' + ((cc.sachwert && cc.sachwert.vorlaeufig)
        ? 'ohne Sachwertfaktor'   /* v1061-WFUS-2 */
        /* v1150-WFUS · Dieselbe Falle wie beim Zinssatz (v1052), eine Zeile
         * weiter — und diesmal mit der Konstante: hier stand
         * `cc.assumptions.sachwertfaktor`, und das ist SACHWERTFAKTOR = 1.0
         * aus CrossCheckService.js:26, nicht der angewandte Faktor. Wer mit
         * 0,889 rechnete, las im Dossier "Sachwertfaktor 1".
         *
         * Zweitens fehlte die STUFE. Auf dem Bildschirm steht sie längst
         * (Karte "Sachwert", app.js:592 ff. — "Faktor 1,15 · Stufe E"), im
         * PDF nicht. Genau dort muss die Zahl ihre Herkunft tragen: das
         * Dossier verlässt das Haus, die Bildschirmansicht nicht.
         *
         * Beide Formen lesen: nhk2010.js:897 liefert ein OBJEKT
         * { wert, stufe, quelle }, ältere Wege eine nackte Zahl — das ist
         * die v1143b-Lehre, die auf dem Bildschirm schon gezogen wurde.
         * Rückfall auf die Annahme bleibt, wie bei allen Nachbarn in
         * dieser Fußnote. */
        : 'Sachwertfaktor ' + (function () {
            var f = cc.sachwert && cc.sachwert.sachwertfaktor;
            var z = (f && typeof f === 'object') ? f.wert : f;
            var s = (f && typeof f === 'object') ? f.stufe : null;
            var q = (f && typeof f === 'object') ? f.quelle : null;
            if (z == null) return String(cc.assumptions.sachwertfaktor);
            /* v1150b · Die Quelle nur, wenn sie kurz ist. Gemessen am
             * Prüfobjekt liefert der amtliche Weg
             * "Grundstücksmarktbericht 2026 für den Kreis Herford, 5.1.2
             * Sachwertfaktoren" — 74 Zeichen, die die Fußnote um eine bis
             * zwei Zeilen wachsen lassen und das Layout darunter schieben.
             * Sie steht ohnehin im Bericht (sachwertfaktor_ausschuss).
             * Die STUFE trägt die Herkunft und ist immer dabei; die Quelle
             * lohnt nur, wo sie selbst die Aussage ist — "eigene Angabe"
             * (13 Zeichen) bei Stufe E. */
            var qk = (q && q.length <= 26) ? q : null;
            return String(z).replace('.', ',')
              + (s ? ' (Stufe ' + s + (qk ? ' · ' + qk : '') + ')' : '');
          })()) + '. Kein Gutachten n. § 194 BauGB.', blockW);
    doc.text(_fn, M, y + 3);
    y += 5 + _fn.length * 3;
  }

  /* v1075-WHER-2 · Rechenweg Sachwertverfahren. Bei Ein- und Zweifamilien-
   * haeusern FUEHRT der Sachwert (Paragraf 6 Abs. 1) — sein Weg stand
   * trotzdem nie im PDF, nur die Ergebniskarte. Muster wie der
   * Ertragswert-Block darunter. */
  const _swx = d.cross_check && d.cross_check.sachwert;
  if (_swx && _swx.available && _swx.staffel && _swx.staffel.length) {
    sectionTitle('Sachwertverfahren — Rechenweg', 120);
    need(20);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT);
    doc.text((_swx.verfahren || 'Sachwertverfahren') + '  ·  §§ 35–39 ImmoWertV 2021', M, y); y += 6;
    if (_swx.ausstattung_gewogen && _swx.ausstattung_gewogen.gewogene_stufe != null) {
      doc.setFontSize(7);
      const _agz = doc.splitTextToSize('Kostenkennwert gewogen aus neun Gewerken nach SW-RL 2012 '
        + 'Anlage 2 — gewogene Standardstufe '
        + String(_swx.ausstattung_gewogen.gewogene_stufe).replace('.', ',') + '.', blockW);
      need(_agz.length * 3.4 + 4); doc.text(_agz, M, y); y += _agz.length * 3.4 + 3;
      doc.setFontSize(7.5);
    }
    /* v1083b-WPDF-3 · Der volle Wortlaut, dort wo Platz ist. In der Karte
     * steht nur "geschaetzt"; hier steht, was das bedeutet und was fehlt.
     * Jede Zahl traegt ihre Herkunft — das gilt auch fuer eine, die aus
     * einem Rueckfall stammt. */
    var _rh = _swx.restnutzungsdauer_herkunft;
    if (_rh && _rh.quelle === 'geschaetzt' && _rh.hinweis) {
      doc.setFontSize(7); doc.setTextColor(150, 120, 60);
      var _rz = doc.splitTextToSize(_rh.hinweis, blockW);
      need(_rz.length * 3.4 + 4); doc.text(_rz, M, y); y += _rz.length * 3.4 + 3;
      doc.setFontSize(7.5); doc.setTextColor(...MUT);
    }
    _swx.staffel.forEach((z) => {
      need(9);
      const _sm = !!z.summe;
      doc.setFont('helvetica', _sm ? 'bold' : 'normal');
      doc.setFontSize(_sm ? 8.4 : 7.8);
      doc.setTextColor(...(_sm ? TXT : [110, 110, 118]));
      const _lb = doc.splitTextToSize(String(z.pos).replace(/\u2212/g, '-'), blockW - 42);
      doc.text(_lb[0], M + 2, y);
      let _re = '';
      if (z.faktor != null) _re = String(z.faktor).replace('.', ',');
      else if (z.wert != null) _re = euro(z.wert);
      if (_re) { doc.setTextColor(...(_sm ? GOLD : TXT)); doc.text(_re, M + blockW - 2, y, { align: 'right' }); }
      if (z.detail) {
        y += 3.6; doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6);
        doc.setTextColor(...MUT); doc.text(String(z.detail).slice(0, 120), M + 4, y);
      }
      y += _sm ? 6 : 5;
      if (_sm) { doc.setDrawColor(225, 221, 212); doc.setLineWidth(0.2); doc.line(M, y - 3.4, M + blockW, y - 3.4); }
    });
    if (_swx.hinweise && _swx.hinweise.length) {
      y += 1;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(...MUT);
      _swx.hinweise.forEach((h) => {
        const _hz = doc.splitTextToSize('· ' + String(h), blockW);
        need(_hz.length * 3.2 + 3); doc.text(_hz, M, y); y += _hz.length * 3.2 + 2;
      });
    }
    y += 4;
  }

  /* WPDF-1 · Rechenweg Ertragswertverfahren.
   * Bisher zeigte das PDF nur das Ergebnis. Fuer ein Dossier, das vor einer Bank
   * besteht, muss der Weg dastehen — Zeile fuer Zeile, mit der Herkunft des
   * Liegenschaftszinses. Eine Zahl ohne Herleitung ist im Dossier wertlos. */
  const _ew = d.cross_check && d.cross_check.ertragswert;
  if (_ew && _ew.available && _ew.staffel && _ew.staffel.length) {
    /* WPDF26-2 · Erklaertext. Ein Kunde, der Vergleichswert und Ertragswert
     * nebeneinander sieht und 45 % Abstand liest, braucht die Einordnung —
     * sonst haelt er einen davon fuer falsch. */
    sectionTitle('Ertragswertverfahren — Rechenweg', 150);
    need(26);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...MUT);
    const _erk = doc.splitTextToSize(
      'Das Vergleichswertverfahren fragt, was ähnliche Objekte am Markt kosten. Das '
      + 'Ertragswertverfahren fragt, was die Immobilie an laufendem Ertrag abwirft, und '
      + 'kapitalisiert ihn über die Restnutzungsdauer. Beide Wege führen selten zum '
      + 'gleichen Ergebnis: der Markt preist bei Neubauten in Wachstumsregionen auch '
      + 'Wertsteigerung ein, das Ertragswertverfahren tut das nicht. Ein Abstand von '
      + 'zwanzig bis vierzig Prozent ist dort normal. Wird er größer, lohnt ein '
      + 'zweiter Blick auf die Miete oder den Liegenschaftszinssatz.', blockW);
    doc.text(_erk, M, y); y += _erk.length * 3.4 + 4;
    need(70);

    const _stufeTxt = { A: 'amtlich, kreisscharf', B: 'amtlich, regional',
      C: 'aus eigener Marktableitung', D: 'gesetzlicher Auffangwert n. § 256 BewG',
      E: 'eigene Angabe' };

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT);
    doc.text((_ew.verfahren || 'allgemeines Ertragswertverfahren')
      + '  ·  §§ 27–34 ImmoWertV 2021', M, y); y += 6;

    /* v1050-WFLA-1 · Der Flaechenbefund aus v1049. Eine stille Annahme
     * ueber den Bodenwert ist dieselbe Sorte Fehler wie die stille
     * Standardstufe 3 — sie gehoert in den Bericht, nicht ins Log. */
    if (cc.flaeche && cc.flaeche.erheblich && cc.flaeche.hinweis) {
      const _fl = doc.splitTextToSize(cc.flaeche.hinweis, blockW);
      need(_fl.length * 3.4 + 6);
      doc.setFontSize(7); doc.setTextColor(150, 110, 100);
      doc.text(_fl, M, y); y += _fl.length * 3.4 + 4;
      doc.setFontSize(7.5); doc.setTextColor(...MUT);
    }

    /* Staffel */
    _ew.staffel.forEach((z) => {
      need(9);
      const summe = !!z.summe;
      doc.setFont('helvetica', summe ? 'bold' : 'normal');
      doc.setFontSize(summe ? 8.4 : 7.8);
      doc.setTextColor(...(summe ? TXT : [110, 110, 118]));
      /* WPDF12-1 · U+2212 durch ASCII-Minus ersetzen (jsPDF-Helvetica). */
      const label = doc.splitTextToSize(String(z.pos).replace(/\u2212/g, '-'), blockW - 42);
      doc.text(label[0], M + 2, y);
      let rechts = '';
      if (z.faktor != null) rechts = String(z.faktor).replace('.', ',');
      else if (z.wert != null) rechts = euro(z.wert);
      if (rechts) {
        doc.setTextColor(...(summe ? GOLD : TXT));
        doc.text(rechts, M + blockW - 2, y, { align: 'right' });
      }
      if (z.detail) {
        y += 3.6; doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6);
        doc.setTextColor(...MUT); doc.text(String(z.detail), M + 4, y);
      }
      y += summe ? 6 : 5;
      if (summe) {
        doc.setDrawColor(225, 221, 212); doc.setLineWidth(0.2);
        doc.line(M, y - 3.4, M + blockW, y - 3.4);
      }
    });

    y += 3; need(30);

    /* Herkunft des Zinssatzes — die Zahl, an der alles haengt */
    /* v1050-WSPN-1 · Der Kasten wird hoeher, wenn eine Streuung vorliegt —
     * sonst steht die Spanne im Nichts. */
    const _hatStreuung = _ew.streuung_pct != null && _ew.streuung_pct > 0;
    const _kastenH = _hatStreuung ? 21 : 15;
    doc.setFillColor(245, 243, 238); doc.roundedRect(M, y, blockW, _kastenH, 2, 2, 'F');
    doc.setFillColor(...GOLD); doc.roundedRect(M, y, 1.6, _kastenH, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); doc.setTextColor(120, 113, 100);
    doc.text('LIEGENSCHAFTSZINSSATZ', M + 5, y + 5, { charSpace: 0.3 });
    /* WPDF12-2 · charSpace wirkt sonst in den Folgeaufrufen weiter — die
     * Abzugszeile erschien gesperrt und brach nicht mehr um. */
    doc.setCharSpace(0);
    doc.setFontSize(9); doc.setTextColor(...TXT);
    doc.text(String(_ew.liegenschaftszins_pct).replace('.', ',') + ' %', M + 5, y + 11.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.setTextColor(110, 110, 118);
    /* v1050-WSPN-2 · Die Herkunft nennt jetzt auch den Ausschuss. Der
     * Stufenbuchstabe stand hier noch nie — _stufeTxt uebersetzt ihn seit
     * jeher in Klartext. */
    let _q = (_stufeTxt[_ew.liegenschaftszins_stufe] || _ew.liegenschaftszins_quelle || '–');
    if (_ew.liegenschaftszins_quelle && _stufeTxt[_ew.liegenschaftszins_stufe]) {
      _q += ' · ' + String(_ew.liegenschaftszins_quelle).split(',')[0];
    }
    doc.text(doc.splitTextToSize('Herkunft: ' + _q, blockW - 40), M + 30, y + 11.5);

    /* Die Spanne. Ein Mittelwert, dessen Standardabweichung die Haelfte
     * seines Betrags ausmacht, ist ohne sie eine Behauptung. */
    if (_hatStreuung) {
      doc.setFontSize(6.8); doc.setTextColor(140, 132, 118);
      const _lo = _ew.liegenschaftszins_min, _hi = _ew.liegenschaftszins_max;
      let _sp = 'Streuung ±' + String(_ew.streuung_pct).replace('.', ',') + ' % des Mittelwerts';
      if (_lo != null && _hi != null) {
        _sp = 'Spanne ' + String(_lo).replace('.', ',') + ' bis ' + String(_hi).replace('.', ',')
          + ' % · Angabe des Gutachterausschusses';
      }
      /* v1083b-WPDF-4 · Wenn die Streuung den Wert herabgestuft hat, gehoert
       * der MASSSTAB daneben. "Zu unsicher" ohne Angabe, woran gemessen
       * wurde, ist keine Begruendung. Wohnen wird absolut gemessen
       * (Punkte), Gewerbe relativ (Prozent) — das ist eine Festlegung von
       * DealPilot, nicht des Ausschusses, und muss darum dastehen. */
      var _lg = d.cross_check && d.cross_check.ertragswert && d.cross_check.ertragswert.lzs;
      if (_lg && _lg.grund === 'streuung' && _lg.streuung_pp != null) {
        _sp += ' \u00b7 \u00b1' + String(_lg.streuung_pp).replace('.', ',') + ' Punkte, '
          + (_lg.massstab === 'absolut' ? 'Ma\u00dfstab 1,5 Punkte' : 'Ma\u00dfstab 25 %')
          + ' (DealPilot)';
      }
      doc.text(_sp, M + 5, y + 17.5);
    }
    y += _kastenH + 4;

    /* v1062-WZIN-3 · Die Anpassung nach Paragraf 33 lag vollstaendig im
     * Ergebnis und wurde nirgends gezeigt. Sie ersetzt die Rechnung NICHT:
     * gerechnet wird weiter mit dem amtlichen Zinssatz, der angepasste ist
     * Stufe C und steht als Einordnung daneben. Jedes Merkmal einzeln, und
     * die nicht bewertbaren ausdruecklich benannt. */
    const _za = d.cross_check && d.cross_check.zins_anpassung;
    if (_za && _za.verfuegbar && _za.merkmale && _za.merkmale.length) {
      const _mName = { alter: 'Gebäudealter', wohnlage: 'Wohnlage', nutzung: 'Nutzung',
        wohneinheiten: 'Wohneinheiten', groesse: 'Objektgröße' };
      need(24);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.6); doc.setTextColor(120, 113, 100);
      doc.setCharSpace(0.3);
      doc.text('OBJEKTSPEZIFISCH ANGEPASSTER ZINSSATZ (§ 33 IMMOWERTV) · STUFE '
        + (_za.stufe || 'C'), M, y + 3);
      doc.setCharSpace(0);
      y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(...TXT);
      doc.text(String(_za.basis_pct).replace('.', ',') + ' % amtlich'
        + ((_za.anpassung_pct >= 0) ? '   +   ' : '   -   ')
        + String(Math.abs(_za.anpassung_pct)).replace('.', ',') + ' Punkte   =   '
        + String(_za.zins_pct).replace('.', ',') + ' %'
        + (_za.gedeckelt ? '   (auf eine Standardabweichung gedeckelt)' : ''), M, y + 3);
      y += 6;
      doc.setFontSize(6.6);
      _za.merkmale.forEach((_mk) => {
        need(5);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUT);
        doc.text((_mName[_mk.id] || _mk.id) + ' — ' + String(_mk.text || ''), M + 3, y + 2);
        /* Statusfarben bleiben hart (rot rauf, gruen runter) — sie sind
         * bewusst nicht im WL_TINTS-Satz. */
        if (_mk.beitrag_pct >= 0) doc.setTextColor(184, 98, 92);
        else doc.setTextColor(63, 165, 108);
        doc.text(((_mk.beitrag_pct >= 0) ? '+' : '-')
          + String(Math.abs(_mk.beitrag_pct)).replace('.', ',')
          + '  (Gewicht ' + String(_mk.gewicht).replace('.', ',') + ')',
          M + blockW, y + 2, { align: 'right' });
        y += 3.7;
      });
      const _fehlt = ['alter', 'wohnlage', 'nutzung', 'wohneinheiten', 'groesse']
        .filter((_id) => !_za.merkmale.some((_mk) => _mk.id === _id))
        .map((_id) => _mName[_id] || _id);
      if (_fehlt.length) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(6.4); doc.setTextColor(...MUT);
        const _fl = doc.splitTextToSize('Nicht bewertbar mangels Angabe: ' + _fehlt.join(', ')
          + '. Diese Merkmale bleiben unberücksichtigt — ein Ersatzwert wäre eine Aussage '
          + 'über etwas, das nicht erhoben wurde.', blockW - 3);
        need(_fl.length * 3 + 4);
        doc.text(_fl, M + 3, y + 2); y += _fl.length * 3 + 2;
        doc.setFont('helvetica', 'normal');
      }
      if (_za.hinweis) {
        doc.setFontSize(6.2); doc.setTextColor(150, 143, 130);
        const _zh = doc.splitTextToSize(String(_za.hinweis), blockW);
        need(_zh.length * 2.9 + 4);
        doc.text(_zh, M, y + 2); y += _zh.length * 2.9 + 3;
      }
      y += 2;
      doc.setFontSize(7.4); doc.setTextColor(...TXT);
    }

    /* v1063-WOD-9 · Vierte und letzte Station: sichtbar machen. Ein Wert,
     * der nur klassiert veroeffentlicht ist, gehoert in den Bericht — als
     * Einordnung, ausdruecklich nicht als Rechengroesse. Wer ihn weglaesst,
     * verschweigt eine amtliche Auskunft; wer ihn mitrechnet, erfindet eine
     * Klassenmitte. */
    const _oe = _ew.liegenschaftszins_einordnung;
    if (_oe && (_oe.klasse || _oe.quelle)) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4); doc.setCharSpace(0);
      const _oeT = doc.splitTextToSize(String(_oe.hinweis || ''), blockW - 10);
      const _oeH = 9 + _oeT.length * 3;
      need(_oeH + 4);
      doc.setFillColor(248, 247, 244); doc.roundedRect(M, y, blockW, _oeH, 2, 2, 'F');
      doc.setFillColor(190, 186, 176); doc.roundedRect(M, y, 1.6, _oeH, 0.8, 0.8, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.9); doc.setTextColor(...TXT);
      doc.text('Bundesweite Einordnung · Stufe ' + (_oe.stufe || 'C')
        + ' · nicht gerechnet', M + 5, y + 5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(...MUT);
      doc.text([_oe.klasse ? String(_oe.klasse) + (_oe.einheit ? ' ' + _oe.einheit : '') : null,
        _oe.gebiet || null, _oe.quelle || null,
        _oe.berichtsjahr ? String(_oe.berichtsjahr) : null]
        .filter(Boolean).join('   ·   '), M + blockW - 2, y + 5, { align: 'right' });
      doc.setFontSize(6.4); doc.setTextColor(150, 143, 130);
      doc.text(_oeT, M + 5, y + 9.5);
      y += _oeH + 4;
      doc.setFontSize(7.4); doc.setTextColor(...TXT);
    }

    /* Belastbarkeit und Sensitivitaet */
    if (_ew.belastbarkeit) {
      need(12);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(...TXT);
      doc.text('Belastbarkeit ' + _ew.belastbarkeit.pct + ' % ('
        + _ew.belastbarkeit.label + ')', M, y);
      y += 4.5;
      if (_ew.belastbarkeit.abzuege && _ew.belastbarkeit.abzuege.length) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(...MUT);
        doc.setCharSpace(0);   /* WPDF12-3 */
        const _ab = doc.splitTextToSize(
          _ew.belastbarkeit.abzuege.join(' · ').replace(/−/g, '-'), blockW - 2);
        doc.text(_ab, M, y); y += _ab.length * 3 + 2;
      }
    }
    if (_ew.sensitivitaet && _ew.sensitivitaet.lzs_plus_05) {
      need(10);
      const _s = _ew.sensitivitaet.lzs_plus_05;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.2); doc.setTextColor(...TXT);
      doc.text('Ein halber Zinspunkt mehr (' + String(_s.lzs_pct).replace('.', ',')
        + ' %) ergibt ' + euro(_s.wert) + ' — '
        + String(_s.abweichung_pct).replace('.', ',') + ' %.', M, y);
      y += 6;
    }

    /* Haftungsrahmen — gehoert auf jede Wertermittlungsseite */
    need(12);
    doc.setFontSize(6.5); doc.setTextColor(...MUT);
    const _hr = doc.splitTextToSize('Diese Berechnung folgt den Verfahren der ImmoWertV 2021, '
      + 'ersetzt jedoch keine Wertermittlung nach § 194 BauGB durch einen Sachverständigen. '
      + 'Ohne Ortsbesichtigung, Bauakten- und Grundbucheinsicht. Grundlage sind die erfassten Angaben.', blockW);
    doc.text(_hr, M, y + 3);
    y += 5 + _hr.length * 3;
  }

  // ---------- Lage-/Potenzialbewertung ----------
  const _z = d.zensus;
  const _arProbe = d.assessment ? Object.values(d.assessment).filter((v) => v != null && v !== '').length : 0;
  if ((_arProbe >= 2) || (_z && _z.available)) {
    sectionTitle('Lage- & Potenzialbewertung');
    const A = d.assessment || {}; const ar = [
      ['Mikrolage', A.mikrolage], ['Makrolage', A.makrolage], ['Bevölkerungsentwicklung', A.bevoelkerung],
      ['Nachfrage', A.nachfrage], ['Entwicklungsmöglichkeiten', A.entwicklung], ['Wertsteigerungspotenzial', A.wertsteigerung],
      ['Mietausfallrisiko', A.mietausfallrisiko], ['Ausstattung', A.ausstattung], ['Vermietungsstand', A.vermietungsstand],
    ].filter((r) => r[1] != null && r[1] !== '');
    // Zensus-2022-Kennzahlen (amtlich) anhaengen:
    if (_z && _z.available) {
      const de = (n, dec) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
      if (_z.leerstandsquote != null) ar.push(['Leerstandsquote (Zensus 2022)', de(_z.leerstandsquote, 1) + ' %']);
      if (_z.eigentuemerquote != null) ar.push(['Eigentümerquote (Zensus 2022)', de(_z.eigentuemerquote, 1) + ' %']);
      if (_z.nettokaltmiete_qm != null) ar.push(['Ø Nettokaltmiete (Zensus 2022)', de(_z.nettokaltmiete_qm, 2) + ' €/m²']);
    }
    const rateCol = (label, v) => {
      const s = String(v || '').toLowerCase();
      let c = MUT;
      if (/(sehr gut|gut|hoch|stabil|steigend|positiv|wachsend|neuwertig|gehoben|vollvermietet)/.test(s)) c = [63, 165, 108];
      else if (/(mittel|durchschnitt|moderat|normal)/.test(s)) c = GOLD;
      else if (/(begrenzt|niedrig|gering|schwach|fallend|rückläufig|negativ|leer)/.test(s)) c = [184, 98, 80];
      if (/risiko/.test(label.toLowerCase())) { if (c[0] === 63) c = [184, 98, 80]; else if (c[0] === 184) c = [63, 165, 108]; }
      return c;
    };
    doc.autoTable({
      startY: y, margin: { left: M, right: M }, theme: 'plain',
      body: ar.map((r) => [r[0], String(r[1])]),
      styles: { fontSize: 9.5, cellPadding: 2.4, textColor: TXT },
      columnStyles: { 0: { textColor: MUT, cellWidth: 72 }, 1: { fontStyle: 'bold' } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          data.cell.styles.textColor = rateCol(ar[data.row.index][0], ar[data.row.index][1]);
        }
      },
    });
    y = doc.lastAutoTable.finalY + 6;
    if (_z && _z.available && _z.license) { need(6); doc.setFontSize(7); doc.setTextColor(...MUT);
      doc.text('Zensus-Kennzahlen: ' + _z.license, M, y); y += 5; }
    if (A.marktmiete_eur_qm != null) { need(8); doc.setFontSize(9); doc.setTextColor(...MUT);
      doc.text('Eingeschätzte Marktmiete: ' + A.marktmiete_eur_qm + ' €/m²' + (A.marktfaktor != null ? '   ·   Marktfaktor: ' + A.marktfaktor : ''), M, y); y += 8; }
  }

  // ---------- Makrolage & Sozioökonomie (echte Destatis-Subscores) ----------
  const mac = d.macro || {};
  const mbd = mac.breakdown || {};
  if (Object.keys(mbd).length) {
    sectionTitle('Makrolage & Sozioökonomie', 72);
    const labelMap = { bevoelkerung: 'Bevölkerung', kaufkraft: 'Kaufkraft', arbeitslosigkeit: 'Arbeitsmarkt',
      wanderung: 'Wanderung', miet_trend: 'Miettrend', kaufpreis_trend: 'Kaufpreistrend' };
    const order = ['bevoelkerung', 'kaufkraft', 'arbeitslosigkeit', 'wanderung', 'miet_trend', 'kaufpreis_trend'];
    const entries = order.filter((k) => mbd[k] != null).map((k) => [labelMap[k] || k, mbd[k]]);
    need(8);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...TXT);
    doc.text('Makro-Gesamtscore', M, y);
    const mcol = mac.score >= 70 ? [63, 165, 108] : mac.score >= 50 ? GOLD : [184, 98, 80];
    doc.setTextColor(...mcol); doc.text((mac.score ?? '–') + ' / 100', W - M, y, { align: 'right' });
    y += 7;
    const barX = M + 52, barW = (W - M) - barX - 14;
    entries.forEach(([lab, val]) => {
      need(9);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUT);
      doc.text(lab, M, y + 3.2);
      doc.setFillColor(233, 231, 225); doc.roundedRect(barX, y, barW, 4.4, 2.2, 2.2, 'F');
      const c = val >= 70 ? [67, 183, 124] : val >= 50 ? [217, 180, 90] : [217, 104, 95];
      if (doc.GState) { // dezenter Glow unter dem Füllbalken
        doc.setGState(new doc.GState({ opacity: 0.18 })); doc.setFillColor(...c);
        doc.roundedRect(barX - 0.4, y - 0.5, barW * Math.max(0.03, val / 100) + 0.8, 5.4, 2.6, 2.6, 'F');
        doc.setGState(new doc.GState({ opacity: 1 }));
      }
      doc.setFillColor(...c); doc.roundedRect(barX, y, barW * Math.max(0.03, val / 100), 4.4, 2.2, 2.2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...c);
      doc.text(String(val), W - M, y + 3.4, { align: 'right' });
      y += 9;
    });
    const _mm = (mac && (mac.metrics || mac)) || {};
    const _trend = _mm.bevoelkerung_trend;
    if (_trend != null) {
      need(6); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUT);
      doc.text('Bevölkerungstrend ' + (_trend > 0 ? '+' : '') + _trend.toFixed(2) + ' %/Jahr', M, y); y += 8;
    }
  }

  // ---------- Marktentwicklung (Chart aus Dashboard) ----------
  try {
    if (typeof histChart !== 'undefined' && histChart) {
      const cimg = histChart.toBase64Image('image/png', 1);
      if (cimg && cimg.length > 200) {
        sectionTitle('Marktentwicklung');
        need(70);
        obsidianCard(M, y, W - 2 * M, 64);
        doc.addImage(cimg, 'PNG', M + 6, y + 4, W - 2 * M - 10, 56);
        y += 68;
        const hh = d.market_history || {};
        const dom = d.market_dynamics && d.market_dynamics.days_on_market;
        const cap = [
          hh.price_cagr_pct != null ? `Kaufpreistrend ${hh.price_cagr_pct > 0 ? '+' : ''}${hh.price_cagr_pct} %/Jahr${hh.start_year ? ' seit ' + hh.start_year : ''}` : null,
          hh.rent_cagr_pct != null ? `Miettrend ${hh.rent_cagr_pct > 0 ? '+' : ''}${hh.rent_cagr_pct} %/Jahr` : null,
          dom != null ? `Ø Vermarktungsdauer ${Math.round(dom)} Tage` : null,
        ].filter(Boolean).join('   ·   ');
        if (cap) { need(6); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.text(cap, M, y); y += 6; }
      }
    }
  } catch (e) { /* Chart optional */ }

  // ---------- Lage & Infrastruktur ----------
  const mg = d.micro && d.micro.groups;
  if (mg && Object.keys(mg).length) {
    sectionTitle('Lage & Infrastruktur', 44);
    const ord = ['einkaufen', 'verkehr', 'gesundheit', 'freizeit', 'bildung', 'gastronomie'];
    const list = ord.filter((k) => mg[k]).map((k) => mg[k]);
    // Ring-Leiste: ein Ring je Kategorie (DealPilot-Look) mit echtem Score + Anzahl/Distanz
    if (list.length) {
      need(40);
      const cellW = (W - 2 * M) / list.length;
      list.forEach((g, idx) => {
        const cx = M + cellW * idx + cellW / 2, cy = y + 11;
        microRing(cx, cy, 9, g.score, g.score != null ? g.score : '–');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...TXT);
        doc.text(g.label, cx, cy + 16.5, { align: 'center' });
        const cnt = g.count != null ? g.count : (g.items ? g.items.length : null);
        const near = (g.items && g.items[0] && g.items[0].distance_m != null) ? g.items[0].distance_m + ' m' : null;
        const sub = [cnt != null ? cnt + ' Orte' : null, near ? 'ab ' + near : null].filter(Boolean).join(' · ');
        if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUT); doc.text(sub, cx, cy + 20.8, { align: 'center' }); }
      });
      y += 40;
    }
    const colW = (W - 2 * M) / 2;
    for (let i = 0; i < list.length; i += 2) {
      const n1 = (list[i].items || []).length, n2 = list[i + 1] ? (list[i + 1].items || []).length : 0;
      const rowH = 8 + Math.min(5, Math.max(n1, n2)) * 5 + 6;
      need(rowH);
      for (let j = 0; j < 2 && i + j < list.length; j++) {
        const g = list[i + j], x = M + j * colW;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...TXT);
        doc.text(g.label, x, y);
        const sc = g.score >= 70 ? [63, 165, 108] : g.score >= 50 ? GOLD : [184, 98, 80];
        doc.setTextColor(...sc); doc.text((g.score5 ?? '–') + ' / 5', x + colW - 10, y, { align: 'right' });
        doc.setDrawColor(225, 223, 217); doc.setLineWidth(0.25);
        doc.line(x, y + 1.8, x + colW - 10, y + 1.8);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUT);
        let yy = y + 6.6;
        (g.items || []).slice(0, 5).forEach((it) => {
          const nm = it.name && it.name.length > 28 ? it.name.slice(0, 27) + '…' : (it.name || '–');
          doc.text(nm, x, yy); doc.text(it.distance_m + ' m', x + colW - 10, yy, { align: 'right' });
          yy += 5;
        });
      }
      y += rowH;
    }
    if (d.micro.score != null) {
      need(7); doc.setFontSize(8.5); doc.setTextColor(...MUT);
      doc.text('Mikrolage-Gesamtscore: ' + d.micro.score + ' / 100', M, y); y += 7;
    }
    y += 2;
  }

  // ---------- Vergleichsobjekte ----------
  const comps = (d.sale && d.sale.comparables) || [];
  if (comps.length) {
    sectionTitle('Vergleichsobjekte (' + comps.length + ')');
    doc.autoTable({
      startY: y, margin: { left: M, right: M },
      head: [['Typ', 'Fläche', 'Baujahr', 'Preis', '€/m²', 'Entf.']],
      body: comps.map((c) => [c.property_type || '–', c.living_area ? c.living_area + ' m²' : '–',
        c.build_year || '–', euro(c.price), c.price_per_sqm ? Math.round(c.price_per_sqm).toLocaleString('de-DE') : '–',
        c.distance_m != null ? c.distance_m + ' m' : '–']),
      headStyles: { fillColor: INK, textColor: 255, fontSize: 8.5 },
      styles: { fontSize: 8.5, cellPadding: 2, textColor: TXT },
      alternateRowStyles: { fillColor: [245, 244, 240] },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ---------- Bericht (Fließtext) ----------
  if (out.report_md) {
    sectionTitle('Ausführlicher Marktbericht');
    /*v895d-mbfmt: KI-Bericht sauber rendern (Fett/Tabellen/num.Listen/Callouts) */
    const RMW = W - 2 * M, RLH = 4.9, RSZ = 9.5;
    const _drawRich = (text, x, maxW, color) => {
      const lay = _mbLayoutRuns(doc, _mbParseRuns(text), maxW, RSZ);
      for (const line of lay.lines) {
        // v957-fontleak: need() kann umbrechen. Die Breiten in lay stammen aus
        // RSZ — also muss auch gezeichnet werden bei RSZ, egal was dazwischen war.
        need(RLH); doc.setFontSize(RSZ); let cx = x; const yy = y;
        for (const tok of line) {
          doc.setFont('helvetica', tok.bold ? 'bold' : 'normal');
          doc.setTextColor(color[0], color[1], color[2]);
          doc.text(tok.t, cx, yy); cx += tok.w + lay.spaceW;
        }
        y = yy + RLH;
      }
    };
    doc.setFontSize(RSZ);
    for (const b of mdToPdfLines(out.report_md)) {
      if (b.type === 'h') {
        let t = b.text;
        if (b.level <= 2) { const m = t.match(/^([A-P])\)\s*(.*)$/); t = m ? (PDF_SECTION_TITLES[m[1]] || m[2]) : t.replace(/^[A-Z]\d?\)\s*/, ''); }
        else t = t.replace(/^[A-Z]\d?\)\s*/, '');
        need(14); y += (b.level >= 3 ? 2.5 : 4.5);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...GOLD); doc.setFontSize(b.level >= 3 ? 10 : 11);
        doc.text(t, M, y);
        doc.setDrawColor(...GOLD); doc.setLineWidth(0.6); doc.line(M, y + 2.6, M + (b.level >= 3 ? 10 : 14), y + 2.6);
        y += 8.2; doc.setFont('helvetica', 'normal'); doc.setTextColor(...TXT); doc.setFontSize(RSZ);
        continue;
      }
      if (b.type === 'ul') {
        for (const it of b.items) {
          if (/^Fakten:/i.test(it)) continue;
          need(RLH); doc.setFillColor(...GOLD); doc.circle(M + 1.1, y - 1.4, 0.8, 'F');
          _drawRich(it, M + 5, RMW - 5, TXT);
        }
        y += 2.2; continue;
      }
      if (b.type === 'ol') {
        let _n = 0;
        for (const it of b.items) {
          // v964-goldlit: war hart [184,147,47]. Einziges Markengold im PDF-Pfad,
          // das am Whitelabel vorbeilief (der Waechter sieht keine RGB-Tripel).
          // Statusfarben (gruen/gold/rot in den Ampeln) bleiben absichtlich hart.
          _n++; need(RLH); doc.setFont('helvetica', 'bold'); doc.setFontSize(RSZ); doc.setTextColor(...GOLD_D());
          doc.text(_n + '.', M, y);
          _drawRich(it, M + 6, RMW - 6, TXT);
        }
        y += 2.2; continue;
      }
      if (b.type === 'callout') {
        doc.setFontSize(9);
        const ls = doc.splitTextToSize(b.text.replace(/\*\*(.+?)\*\*/g, '$1'), RMW - 12);
        const boxH = ls.length * 4.4 + 8; need(boxH + 2);
        doc.setFillColor(247, 245, 239); doc.roundedRect(M, y - 1, RMW, boxH, 1.6, 1.6, 'F');
        doc.setFillColor(...GOLD); doc.roundedRect(M, y - 1, 1.6, boxH, 0.8, 0.8, 'F');
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(95, 95, 103);
        doc.text(ls, M + 6, y + 5); doc.setFont('helvetica', 'normal');
        y += boxH + 3; doc.setFontSize(RSZ); doc.setTextColor(...TXT); continue;
      }
      if (b.type === 'table') {
        need(20);
        doc.autoTable({
          startY: y, margin: { left: M, right: M, bottom: 20 },
          head: [b.head], body: b.rows,
          headStyles: { fillColor: INK, textColor: 255, fontSize: 8.5 },
          styles: { fontSize: 8.5, cellPadding: 2, textColor: TXT },
          alternateRowStyles: { fillColor: [245, 244, 240] },
        });
        y = doc.lastAutoTable.finalY + 5; continue;
      }
      if (/^Fakten:/i.test(b.text)) continue;
      _drawRich(b.text, M, RMW, TXT); y += 2.4;
    }
    y += 3.5;
  }

  // (Datengrundlage & Verlässlichkeit absichtlich NICHT im PDF — bleibt im Dashboard.)

  footer(page);

  // ---------- Inhaltsverzeichnis (reservierte Seite jetzt befuellen) ----------
  if (tocEntries.length) {
    doc.setPage(tocPageNo);
    const dark = theme === 'dark';
    const T = dark
      ? { bg: OBS, head: [255, 255, 255], accent: GOLD, sub: [150, 150, 160], num: GOLD,
          title: [228, 228, 232], page: [165, 165, 175], div: [40, 40, 48], sky: GOLD }
      : { bg: [255, 255, 255], head: INK, accent: [168, 162, 150], sub: [120, 120, 130], num: GOLD,
          title: TXT, page: [120, 120, 130], div: [224, 222, 216], sky: [186, 182, 174] };
    doc.setFillColor(...T.bg); doc.rect(0, 0, W, H, 'F');
    // Hintergrund: Marcels dunkles Mockup-Asset 1:1; Fallback Cover-Karte transparent
    if (dark && bgDarkAsset) {
      try { doc.addImage(bgDarkAsset, 'JPEG', 0, 0, W, H, 'bgd'); } catch (e) {}
    } else if (dark && objImg && doc.GState) {
      doc.setGState(new doc.GState({ opacity: 0.14 }));
      try { doc.addImage(objImg, 'PNG', 0, 0, W, H); } catch (e) { /* optional */ }
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    /* v962-nopin: Glow-Orb und Radar-Pin oben rechts sind raus — das Briefpapier
     * (Version 4, bgDarkAsset) laeuft jetzt durch. Der Pin war ein Vektor-Nachbau
     * aus der Zeit, als das Asset noch keinen eigenen hatte; im aktuellen Asset
     * sass er als heller Fleck ueber der Skyline. */
    let ty = M + 18;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.setTextColor(...T.head);
    doc.text('Inhalt', M, ty, { charSpace: 0.2 });
    doc.setFillColor(...T.accent); doc.rect(M, ty + 5, 22, 1.3, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...T.sub);
    doc.text('Marktwerteinschätzung · ' + (a.formatted || ref.address || ''), M, ty + 13);
    ty += 28;
    const rowH = Math.max(11, Math.min(15.5, (H - ty - 52) / tocEntries.length));
    for (const e of tocEntries) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...T.num);
      doc.text(e.num, M, ty);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(12.5); doc.setTextColor(...T.title);
      doc.text(e.title, M + 16, ty);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...T.page);
      doc.text(String(e.page != null ? e.page : ''), W - M, ty, { align: 'right' });
      doc.setDrawColor(...T.div); doc.setLineWidth(0.2); doc.line(M, ty + rowH * 0.46, W - M, ty + rowH * 0.46);
      ty += rowH;
    }
    // Skyline ist im Briefpapier-Asset (Version 4) bereits enthalten — keine zweite zeichnen
    footer(1); // Footer neu zeichnen (lag unter der Hintergrundfläche)
  }

  /* v1047-WFN-1 · Umlaute umschreiben statt loeschen. Vorher wurde aus
   * Huellhorst ein 'H_llhorst' — der Filter ersetzte das ue durch einen
   * Unterstrich, weil er nur a-z0-9 durchlaesst. */
  const _umlaut = (s) => String(s)
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss');
  const fname = 'Marktbericht_' + (a.postcode || '') + '_'
    + _umlaut(a.city || ref.address || 'Objekt').replace(/[^a-z0-9]/gi, '_').slice(0, 30) + '.pdf';
  doc.save(fname);
}

// Sprechende Kapiteltitel (statt "A) ...", "B) ..."). Fallback = Text hinter dem Buchstaben.
const PDF_SECTION_TITLES = {
  A: 'Zusammenfassung & Empfehlung', B: 'Objekt, Lage & Markt', C: 'Bewertung, Rendite & Ausblick',
};
// v895d-mbfmt: Markdown -> typisierte Bloecke (Ueberschrift/UL/OL/Tabelle/Callout/Absatz)
function mdToPdfLines(md) {
  const L = String(md).split(/\r?\n/); const B = []; let i = 0;
  while (i < L.length) {
    const ln = L[i];
    if (/^\s*$/.test(ln)) { i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(ln)) {
      const t = []; while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) { t.push(L[i]); i++; }
      const rows = t.map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
                    .filter((r) => !r.every((c) => /^:?-+:?$/.test(c) || c === ''));
      if (rows.length) B.push({ type: 'table', head: rows.shift(), rows });
      continue;
    }
    if (/^\s*>\s?/.test(ln)) {
      const q = []; while (i < L.length && /^\s*>\s?/.test(L[i])) { q.push(L[i].replace(/^\s*>\s?/, '')); i++; }
      B.push({ type: 'callout', text: q.join(' ') }); continue;
    }
    if (/^\s*---+\s*$/.test(ln)) { i++; continue; }
    const h = ln.match(/^\s*(#{1,3})\s+(.*)$/);
    if (h) { B.push({ type: 'h', level: h[1].length, text: h[2].trim() }); i++; continue; }
    if (/^\s*\d{1,2}[\).]\s+/.test(ln)) {
      const ol = []; while (i < L.length && /^\s*\d{1,2}[\).]\s+/.test(L[i])) { ol.push(L[i].replace(/^\s*\d{1,2}[\).]\s+/, '')); i++; }
      B.push({ type: 'ol', items: ol }); continue;
    }
    if (/^\s*[-*]\s+/.test(ln)) {
      const ul = []; while (i < L.length && /^\s*[-*]\s+/.test(L[i])) { ul.push(L[i].replace(/^\s*[-*]\s+/, '')); i++; }
      B.push({ type: 'ul', items: ul }); continue;
    }
    const p = [ln]; i++;
    while (i < L.length && !/^\s*$/.test(L[i]) && !/^\s*(#{1,3}\s|>|[-*]\s|\|)/.test(L[i]) && !/^\s*\d{1,2}[\).]\s/.test(L[i])) { p.push(L[i]); i++; }
    B.push({ type: 'p', text: p.join(' ') });
  }
  return B;
}
// v895d-mbfmt: inline **fett** -> Runs [{t,bold}]
function _mbParseRuns(text) {
  const runs = []; const re = /\*\*(.+?)\*\*/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ t: text.slice(last, m.index), bold: false });
    runs.push({ t: m[1], bold: true }); last = re.lastIndex;
  }
  if (last < text.length) runs.push({ t: text.slice(last), bold: false });
  runs.forEach((r) => { r.t = r.t.replace(/`/g, '').replace(/(?<![A-Za-z0-9])_([^_]+?)_(?![A-Za-z0-9])/g, '$1'); });
  return runs.length ? runs : [{ t: text, bold: false }];
}
// v895d-mbfmt: Runs -> umbrochene Zeilen (gemischt normal/fett), Wortbreite je Font
function _mbLayoutRuns(doc, runs, maxW, size) {
  doc.setFontSize(size); doc.setFont('helvetica', 'normal'); const spaceW = doc.getTextWidth(' ');
  const lines = []; let cur = [], cw = 0;
  runs.forEach((run) => {
    run.t.split(/\s+/).filter(Boolean).forEach((word) => {
      doc.setFont('helvetica', run.bold ? 'bold' : 'normal');
      const ww = doc.getTextWidth(word); let add = (cur.length ? spaceW : 0) + ww;
      if (cw + add > maxW && cur.length) { lines.push(cur); cur = []; cw = 0; add = ww; }
      cur.push({ t: word, bold: run.bold, w: ww }); cw += add;
    });
  });
  if (cur.length) lines.push(cur);
  return { lines, spaceW };
}

// ===== Präzisierung: Ausklappen + Live-Genauigkeitsanzeige =====
(function () {
  function initPrec() {
    const head = document.getElementById('precHead');
    const box = document.getElementById('precBox');
    const caret = document.getElementById('precCaret');
    if (head && box) head.addEventListener('click', function () {
      const open = box.style.display !== 'none';
      box.style.display = open ? 'none' : 'block';
      if (caret) caret.textContent = open ? '\u25B8' : '\u25BE';
    });
    const labels = { cond: 'Zustand', energy: 'Energieklasse', quality: 'Ausstattung', modern: 'Modernisierung',
      /* v736-mb-eq: 8 Ausstattungsfelder zaehlen mit (X/12) */
      eq_heating: 'Heizung', eq_windows: 'Verglasung', eq_floor: 'Bodenbelag', eq_bath: 'Bad',
      eq_guest_wc: 'Gäste-WC', eq_store_room: 'Keller', eq_walls: 'Außenwände', eq_roof: 'Dacheindeckung' };
    const fields = Object.keys(labels);
    function upd() {
      const isFilled = function (id) { const e = document.getElementById(id); return !!(e && e.value && e.value.trim() !== ''); };
      const filled = fields.filter(isFilled).length;
      const total = fields.length;
      // gleiche Logik wie Backend (angenommene Marktdaten-Konfidenz ~0.9): 78%..100% des Datenwerts
      /* v951-checkup: Diese Zahl misst NUR die Eingaben. Die Streuung der
       * Vergleichsdaten kennt sie nicht — die entsteht erst im Bericht, und seit
       * v948 druecken breite Spannen die Aussagekraft deutlich (Prod-Fall:
       * 146-272 T€ -> 43 %). Wer hier 90 liest und dann 43 bekommt, glaubt
       * keinem von beiden. Also: kein Versprechen auf das Ergebnis mehr. */
      const pct = Math.round(100 * (0.78 + 0.22 * (filled / total)));
      const bar = document.getElementById('precBar');
      const pe = document.getElementById('precPct');
      const cnt = document.getElementById('precCount');
      const hint = document.getElementById('precHint');
      if (bar) bar.style.width = pct + '%';
      if (pe) pe.textContent = '\u2248 ' + pct + '%';
      if (cnt) cnt.textContent = filled + '/' + total;
      if (hint) {
        const missing = fields.filter(function (id) { return !isFilled(id); }).map(function (id) { return labels[id]; });
        /* v951-checkup: Plausibilitaet direkt in den Hinweis — der Nutzer sieht
         * es BEIM Tippen, nicht erst im Dialog kurz vor der Abbuchung. */
        var _pw = [];
        try { _pw = _mbCheckup(); } catch (e) {}
        var _base = filled >= total
          ? 'Alle wertrelevanten Angaben gemacht \u2014 h\u00f6chste Eingabe-Konfidenz. Die Aussagekraft des Berichts h\u00e4ngt zus\u00e4tzlich an der Streuung der Vergleichsdaten.'
          : 'F\u00fcr h\u00f6here Eingabe-Konfidenz erg\u00e4nzen: <b style="color:var(--wl-c9a84c, #c9a84c);">' + missing.join(', ') + '</b>.';
        if (_pw.length) {
          _base += '<div style="margin-top:9px;padding:8px 10px;border-left:2px solid #B86250;background:rgba(184,98,80,.07);border-radius:0 7px 7px 0">'
                 + '<b style="color:#B86250">\u26a0 Bitte pr\u00fcfen:</b><br>'
                 + _pw.map(function (x) { return '\u2022 ' + String(x).replace(/</g, '&lt;'); }).join('<br>')
                 + '</div>';
        }
        hint.innerHTML = _base;
      }
    }
    fields.forEach(function (id) { const e = document.getElementById(id); if (e) e.addEventListener('change', upd); });
    /* v951-checkup: Die Plausibilitaet haengt an den ZAHLEN-Feldern — die stehen
     * nicht in `fields` (das sind die 12 Auswahlfelder fuer die Konfidenz).
     * Ohne das hier wuerde die Warnung erst beim naechsten Zustands-Wechsel auffrischen. */
    ['area', 'rooms', 'year', 'floor', 'price', 'rent', 'plot', 'modyear', 'ptype'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) { e.addEventListener('change', upd); e.addEventListener('blur', upd); }
    });
    window._precUpd = upd;
    upd();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPrec);
  else initPrec();
})();

// ===== Adress-/Standortsuche (Geoapify-Autocomplete, Key serverseitig) =====
(function () {
  function initAddrAC() {
    const inp = document.getElementById('address');
    if (!inp) return;
    const dd = document.createElement('div');
    dd.id = 'addrAC';
    dd.style.cssText = 'position:absolute;z-index:9999;display:none;background:#0d0d11;border:1px solid #2a2a30;'
      + 'border-radius:10px;overflow-y:auto;max-height:300px;box-shadow:0 12px 30px rgba(0,0,0,.55);';
    document.body.appendChild(dd);
    let items = [], timer = null, lastQ = '';
    function place() {
      const r = inp.getBoundingClientRect();
      dd.style.left = (r.left + window.scrollX) + 'px';
      dd.style.top = (r.bottom + window.scrollY + 4) + 'px';
      dd.style.width = r.width + 'px';
    }
    function hide() { dd.style.display = 'none'; }
    function render() {
      if (!items.length) { hide(); return; }
      dd.innerHTML = items.map(function (it, i) {
        return '<div data-i="' + i + '" style="padding:9px 12px;cursor:pointer;font-size:13px;color:#e6e6ea;border-bottom:1px solid #1c1c22;">'
          + '<span style="color:var(--wl-c9a84c, #C9A84C);margin-right:7px;">\u25CE</span>' + it.formatted + '</div>';
      }).join('');
      place(); dd.style.display = 'block';
      dd.querySelectorAll('[data-i]').forEach(function (el) {
        el.addEventListener('mousedown', function (ev) {
          ev.preventDefault();
          const it = items[+el.getAttribute('data-i')];
          inp.value = it.formatted;
          window._lastGeo = { lat: it.lat, lon: it.lon };
          lastQ = it.formatted; hide();
        });
        el.addEventListener('mouseenter', function () { el.style.background = '#16161c'; });
        el.addEventListener('mouseleave', function () { el.style.background = 'transparent'; });
      });
    }
    async function query(q) {
      try {
        const r = await fetch(API + '/geocode/autocomplete?text=' + encodeURIComponent(q));
        const d = await r.json();
        items = (d && d.results) || []; render();
      } catch (e) { items = []; hide(); }
    }
    inp.setAttribute('autocomplete', 'off');
    inp.addEventListener('input', function () {
      const q = inp.value.trim();
      if (q.length < 3) { hide(); return; }
      if (q === lastQ) return; lastQ = q;
      clearTimeout(timer); timer = setTimeout(function () { query(q); }, 250);
    });
    inp.addEventListener('blur', function () { setTimeout(hide, 150); });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAddrAC);
  else initAddrAC();
})();

// ===== Standort-Finder (eigener Tab) =====
(function () {
  function initFinder() {
    const tabs = document.getElementById('mainTabs');
    const vReport = document.getElementById('view-report');
    const vFinder = document.getElementById('view-finder');
    if (!tabs || !vReport || !vFinder) return;

    function setView(v) {
      vReport.classList.toggle('hide', v !== 'report');
      vFinder.classList.toggle('hide', v !== 'finder');
      tabs.querySelectorAll('.mtab').forEach(function (b) {
        const on = b.getAttribute('data-view') === v;
        b.style.background = on ? window._wlc('#C9A84C') : 'transparent';
        b.style.color = on ? '#0a0a0a' : '#9a9aa3';
        b.style.borderColor = on ? window._wlc('#C9A84C') : '#2a2a30';
      });
      _mbScrollTop(); /* v945-scroll */
    }
    tabs.querySelectorAll('.mtab').forEach(function (b) {
      b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
    });
    window._lfSetView = setView;

    const selI = document.getElementById('lfIntent'), selR = document.getElementById('lfRegion'),
      descEl = document.getElementById('lfIntentDesc'), btn = document.getElementById('lfBtn'),
      errEl = document.getElementById('lfErr'), prog = document.getElementById('lfProgress'),
      resEl = document.getElementById('lfResults');
    let intentsMeta = [];

    fetch(API + '/location-finder/meta').then(function (r) { return r.json(); }).then(function (m) {
      intentsMeta = m.intents || [];
      selI.innerHTML = intentsMeta.map(function (i) { return '<option value="' + i.key + '">' + i.label + '</option>'; }).join('');
      selR.innerHTML = (m.regions || []).map(function (r) { return '<option value="' + r.key + '">' + r.label + ' (' + r.count + ')</option>'; }).join('');
      updateDesc();
    }).catch(function () { if (descEl) descEl.textContent = 'Konnte Absichten nicht laden.'; });

    function updateDesc() {
      const it = intentsMeta.find(function (x) { return x.key === selI.value; });
      if (descEl) descEl.textContent = it ? it.desc : '';
    }
    selI.addEventListener('change', updateDesc);

    function col(s) { return s >= 70 ? '#3FA56C' : s >= 50 ? window._wlc('#C9A84C') : '#B86250'; }

    function card(r, rank) {
      const c = col(r.score);
      const parts = [['Lage/POI', r.parts.poi], ['Demografie', r.parts.demografie]];
      if (r.parts.jung != null) parts.push(['18\u201330', r.parts.jung]);
      if (r.parts.rendite != null) parts.push(['Rendite', r.parts.rendite]);
      const bars = parts.map(function (p) {
        return '<div style="flex:1;min-width:90px;"><div style="display:flex;justify-content:space-between;font-size:10.5px;color:#9a9aa3;margin-bottom:3px;"><span>' + p[0] + '</span><span style="color:#e6e6ea;">' + p[1] + '</span></div>'
          + '<div style="height:5px;background:#1c1c22;border-radius:999px;overflow:hidden;"><div style="height:100%;width:' + Math.max(3, p[1]) + '%;background:' + col(p[1]) + ';"></div></div></div>';
      }).join('');
      const reasons = (r.reasons || []).slice(0, 5).map(function (x) {
        return '<span style="display:inline-block;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 8%, transparent);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);color:#e7e2d4;border-radius:999px;padding:2px 9px;font-size:11px;font-family:\'JetBrains Mono\';">' + x + '</span>';
      }).join(' ');
      return '<div style="position:relative;overflow:hidden;padding:16px 18px;border-radius:14px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);'
        + 'background-color:#070708;background-image:radial-gradient(circle at 16% 20%,color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 12%, transparent),transparent 42%),radial-gradient(circle at 90% 80%,rgba(70,100,120,.10),transparent 46%),radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:auto,auto,22px 22px;">'
        + '<div style="display:flex;align-items:center;gap:14px;">'
        + '<div style="width:54px;height:54px;border-radius:50%;border:3px solid ' + c + ';display:flex;align-items:center;justify-content:center;flex:0 0 auto;box-shadow:0 0 14px ' + c + '55;">'
        + '<span style="font-family:\'Space Grotesk\';font-weight:700;font-size:19px;color:' + c + ';">' + r.score + '</span></div>'
        + '<div style="flex:1;"><div style="font-size:11px;color:#8a8a93;">#' + rank + ' · Match-Score</div>'
        + '<div style="font-family:\'Space Grotesk\';font-weight:700;font-size:18px;color:#fff;">' + r.name + '</div></div>'
        + '<button data-city="' + r.name.replace(/"/g, '') + '" class="lfPick" style="background:transparent;border:1px solid var(--wl-c9a84c, #C9A84C);color:var(--wl-c9a84c, #C9A84C);border-radius:999px;padding:8px 14px;font-size:12px;cursor:pointer;white-space:nowrap;">Marktbericht erstellen →</button>'
        + '</div>'
        + '<div style="display:flex;gap:14px;margin-top:14px;flex-wrap:wrap;">' + bars + '</div>'
        + (reasons ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;">' + reasons + '</div>' : '')
        + '</div>';
    }

    btn.addEventListener('click', async function () {
      errEl.classList.add('hide'); resEl.innerHTML = '';
      btn.disabled = true; btn.innerHTML = '<span class="spin"></span> suche…';
      prog.classList.remove('hide'); prog.textContent = 'Werte Standorte aus (POI + Demografie) — das kann einen Moment dauern…';
      try {
        const r = await fetch(API + '/location-finder', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intent: selI.value, region: selR.value }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Fehler');
        const list = d.results || [];
        const note = d.geomap_calls
          ? '<div style="font-size:11.5px;color:#6a6a72;margin-top:10px;">GeoMap-Rendite für die Top-' + Math.min(5, list.length) + ' nachgeladen · ' + d.geomap_calls + ' Abrufe (~' + String(d.cost_hint_eur).replace('.', ',') + ' €). Übrige Standorte: kostenlose Signale (POI + Demografie).</div>'
          : '<div style="font-size:11.5px;color:#6a6a72;margin-top:10px;">Ranking aus kostenlosen Signalen (POI + Demografie). GeoMap-Rendite nicht aktiv/verfügbar.</div>';
        resEl.innerHTML = '<div style="font-size:13px;color:#9a9aa3;margin-bottom:4px;">Top-Standorte für <b style="color:var(--wl-c9a84c, #C9A84C);">' + d.intentLabel + '</b> in ' + d.regionLabel + ':</div>'
          + list.map(function (x, i) { return card(x, i + 1); }).join('') + note;
        resEl.querySelectorAll('.lfPick').forEach(function (b) {
          b.addEventListener('click', function () {
            const city = b.getAttribute('data-city');
            const addr = document.getElementById('address'); if (addr) addr.value = city;
            if (window._lfSetView) window._lfSetView('report');
          });
        });
      } catch (e) {
        errEl.textContent = '✗ ' + e.message; errEl.classList.remove('hide');
      } finally {
        prog.classList.add('hide'); btn.disabled = false; btn.textContent = 'Standorte finden';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFinder);
  else initFinder();
})();

// ===== Demo / Ausgabe speichern & laden (ohne erneute Abfrage) =====
(function () {
  const byId = (id) => document.getElementById(id);
  async function ensureMaps(out) {
    try {
      const a = out && out.data && out.data.address;
      if (!a || a.lat == null || a.lon == null) return;
      if (!out._covMap) {
        out._covMap = await loadImageDataUrl(API + '/static-map?lat=' + a.lat + '&lon=' + a.lon
          + '&zoom=15&width=1448&height=2048&marker=0&style=dark-matter-yellow-roads');
      }
      if (!out._lightMap) {
        out._lightMap = await loadImageDataUrl(API + '/static-map?lat=' + a.lat + '&lon=' + a.lon
          + '&zoom=17&width=1024&height=1448&marker=0&style=positron');
      }
    } catch (e) { /* Karten optional */ }
  }
  // "Letzte Ausgabe" aus localStorage
  const lb = byId('loadLastBtn');
  if (lb) {
    try { if (localStorage.getItem('mb_last_out')) lb.style.display = ''; } catch (e) {}
    lb.addEventListener('click', () => {
      try {
        const s = localStorage.getItem('mb_last_out');
        if (!s) { alert('Noch keine gespeicherte Ausgabe vorhanden. Bitte erst einen Bericht erstellen oder eine Datei laden.'); return; }
        render(JSON.parse(s));
      } catch (e) { alert('Konnte gespeicherte Ausgabe nicht laden: ' + e.message); }
    });
  }
  // Aktuelle Ausgabe als .json-Datei speichern (mit eingebetteten Karten -> spaeter PDF ohne Abruf)
  const sb = byId('saveFileBtn');
  if (sb) sb.addEventListener('click', async () => {
    const out = window._lastOut;
    if (!out) { alert('Keine Ausgabe vorhanden. Erst einen Bericht erstellen oder laden.'); return; }
    const old = sb.innerHTML; sb.disabled = true; sb.textContent = 'speichere…';
    try {
      await ensureMaps(out);
      /* WDAT-1 · Eingaben mitgeben. Ohne sie ist die Datei eine Momentaufnahme
       * des Ergebnisses, aus der man nicht weiterarbeiten kann. */
      try { out._eingaben = _sammleEingaben(); } catch (e) {}
      const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const ad = document.createElement('a');
      const plz = (out.data && out.data.address && out.data.address.postcode) || '';
      ad.href = url; ad.download = 'marktbericht-demo' + (plz ? '-' + plz : '') + '.json';
      document.body.appendChild(ad); ad.click(); ad.remove(); URL.revokeObjectURL(url);
    } catch (e) { alert('Speichern fehlgeschlagen: ' + e.message); }
    finally { sb.disabled = false; sb.innerHTML = old; }
  });
  // .json-Datei laden -> rendern (komplett offline, keine Abfrage)
  const fb = byId('loadFileBtn'), fi = byId('loadFileInput');
  if (fb && fi) {
    fb.addEventListener('click', () => fi.click());
    fi.addEventListener('change', () => {
      const f = fi.files && fi.files[0]; if (!f) return;
      const r = new FileReader();
      /* WDAT-3 · Beim Laden auch die Eingaben zuruecksetzen. */
      r.onload = () => { try { const _d = JSON.parse(r.result); render(_d); _setzeEingaben(_d._eingaben); } catch (e) { alert('Ungueltige Datei: ' + e.message); } };
      r.onerror = () => alert('Datei konnte nicht gelesen werden.');
      r.readAsText(f); fi.value = '';
    });
  }
  // Teilbaren Angebot-Link kopieren (nutzt den gespeicherten object_key)
  const shb = byId('shareBtn');
  if (shb) shb.addEventListener('click', async () => {
    const out = window._lastOut;
    const k = out && out.object_key;
    if (!k) { alert('Bitte zuerst einen Bericht erstellen oder laden (für die Link-Erzeugung wird das gespeicherte Objekt benötigt).'); return; }
    const url = location.origin + '/angebot.html?key=' + encodeURIComponent(k);
    try { await navigator.clipboard.writeText(url); const o = shb.textContent; shb.textContent = '✓ Link kopiert'; setTimeout(() => shb.textContent = o, 1800); }
    catch (e) { prompt('Angebot-Link:', url); }
  });
  // Auto-Replay, wenn von der Angebot-Seite zurückverlinkt: index.html?angebot=KEY
  try {
    const ak = new URLSearchParams(location.search).get('angebot');
    if (ak) {
      fetch(API + '/reports/replay?key=' + encodeURIComponent(ak))
        .then((r) => r.ok ? r.json() : Promise.reject(new Error('Angebot nicht gefunden')))
        .then((out) => render(out))
        .catch(() => {});
    }
  } catch (e) { /* optional */ }
})();

// v565-imgguard: objImage nie ohne gueltige src anzeigen (vermeidet Browser-Bruch-Icon)
(function(){try{var oi=document.getElementById('objImage');if(oi){var mo=new MutationObserver(function(){if(!oi.classList.contains('hide')&&(!oi.getAttribute('src')||oi.getAttribute('src')==='')){oi.classList.add('hide');}});mo.observe(oi,{attributes:true,attributeFilter:['class','src']});}}catch(e){}})();

/* v565-no-share */

/* v569-appbeh: obere Buttons PDF + Schliessen */
(function(){
  function bind(){
    var pdf = document.getElementById('mbTopPdf');
    if (pdf && !pdf._v569) { pdf._v569 = 1; pdf.addEventListener('click', function(){ var b = document.getElementById('pdfBtn'); if (b) b.click(); }); }
    var cl = document.getElementById('mbTopClose');
    if (cl && !cl._v569) { cl._v569 = 1; cl.addEventListener('click', function(){ try { parent.postMessage({ type:'mbv-close' }, '*'); } catch(e){} }); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  setTimeout(bind, 500);
})();

/* v570-prog */

/* v949-autopdf
 * ──────────────────────────────────────────────────────────────────────────
 * Offscreen-Betrieb: ?report=<id>&autopdf=1 laedt genau diesen Bericht und
 * exportiert ihn mit der ECHTEN Engine (exportPdf, 11x addPage/addImage —
 * Deckblatt, Karten, Tachos, Diagramme). Muster: MA27 (Mobile) und W27
 * (freigegebene Objekte).
 * Die Deal-Aktion baute sich bis v948 ein eigenes A4 aus dem Markdown-Text
 * (_mbReportPdf) — eine Textabschrift, die der Mandant fuer den Bericht hielt.
 * Rueckmeldung an die Elternseite ueber dieselbe Bruecke wie 'mbv-close'.
 */
try { (function () {
  var q; try { q = new URLSearchParams(location.search); } catch (e) { return; }
  var rid = q.get('report');
  if (!rid || q.get('autopdf') !== '1') return;
  function tell(type, msg) {
    try { if (window.parent && window.parent !== window) parent.postMessage({ type: type, error: msg || null }, '*'); } catch (e) {}
  }
  function go() {
    _mbOpenReport(rid, true)
      .then(function () { tell('mbv-pdf-done'); })
      .catch(function (e) { tell('mbv-pdf-fail', e && e.message); });
  }
  if (document.readyState !== 'loading') go();
  else document.addEventListener('DOMContentLoaded', go);
})(); } catch (e) {}

/* v942-mbrep: Die Liste haengt jetzt an ALLEN drei Ausloesern statt an einem.
 * (1) Boot — auch OHNE ?ref, dann eben mit dem Hinweis "kein Objekt gewaehlt".
 * (2) Objektwahl im Dropdown (Event aus mb-objektwahl.js).
 * (3) nach dem Erstellen (render(), s.o. _mbLoadReportsList({key:out.object_key})).
 * Damit ist "mal ist die Tabelle da, mal nicht" strukturell weg. */
try { (function () {
  function boot(){ try { _mbLoadReportsList({}); } catch (e) {} }
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
  window.addEventListener('mb:object-picked', function (e) {
    try { _mbLoadReportsList({ ref: (e && e.detail && e.detail.ref) || null, key: null }); } catch (x) {}
  });
})(); } catch (e) {}
