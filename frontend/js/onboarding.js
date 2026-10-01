'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   ONBOARDING · v1740 — das Grund-Setup vor dem Rundgang
   ═══════════════════════════════════════════════════════════════════════
   Marcel am 01.10.2026:

     „Ich würde es jetzt wichtig finden, dass wenn sich ein Kunde das erste
      Mal anmeldet, dass er vor dem Rundgang einmal gefragt wird, welches
      Aussehen er haben möchte … und dass man ihn einmal die
      Grundeinstellungen setzen lässt … Wir aber auch immer sagen: Das
      kannst du später auch in den Einstellungen machen."

   ── WAS HIER NICHT NEU GEBAUT WIRD ────────────────────────────────────
   Nichts von dem, was dieses Modal speichert, bekommt einen eigenen
   Speicher. Es schreibt in die drei, die es schon gibt:

     Aussehen      `DealPilotLayout.setze()` + `DealPilotKartenVariante`
     Stammdaten    `Settings.save()`            (dp_user_settings)
     Rechenwerte   `DealPilotInvestmentProfile` (dp_investment_profile)

   > Ein Einrichtungsassistent, der eigene Werte hält, erzeugt ein zweites
   > Gedächtnis neben den Einstellungen. Spätestens beim ersten Ändern in
   > den Einstellungen weiß dann niemand mehr, welcher Wert gilt.

   Deshalb ist dieses Modul eine OBERFLÄCHE auf vorhandene Speicher, kein
   eigener Zustand. Wer einen Schritt überspringt, behält exakt die
   Vorbelegung, die er ohne dieses Modal auch gehabt hätte.

   ── WARUM VOR DEM RUNDGANG ────────────────────────────────────────────
   Der Rundgang zeigt die Oberfläche. Welche Oberfläche das ist, entscheidet
   das Aussehen — eine Tour durch die Aktenmappe sieht anders aus als eine
   durch den Tower. Erst einrichten, dann zeigen.
   ═══════════════════════════════════════════════════════════════════════ */

window.DealPilotOnboarding = (function () {

  var FERTIG_KEY = 'dp_onboarding_done_v1';
  var SCHRITT_KEY = 'dp_onboarding_step';

  /* ── Die Aussehen-Wahl ──────────────────────────────────────────────
     Marcel: „Standardmäßig würde ich bei Aktenmappe, Kanzlei und Tower
     dann halt einfach die Bordkarte dort nehmen als Objektkarten."       */
  var AUSSEHEN = [
    { id: '',    name: 'DealPilot',  karte: null,
      unter: 'Obsidian und Gold, Reiter oben',
      fuer: 'Die Standardansicht — dunkel, kompakt, alles auf einem Schirm.' },
    { id: 'v1b', name: 'Aktenmappe', karte: 'bordkarte',
      unter: 'Menü links, Reiter oben im Kopf',
      fuer: 'Wie eine Mappe mit Registern. Ruhig und vertraut.' },
    { id: 'v2',  name: 'Kanzlei',    karte: 'bordkarte',
      unter: 'Navigation links, Aktionen rechts',
      fuer: 'Zwei Schienen: links wo du bist, rechts was du tun kannst.' },
    { id: 'v2b', name: 'Tower',      karte: 'bordkarte',
      unter: 'Aktionen links, Score und Ausgaben rechts',
      fuer: 'Alles im Blick wie im Cockpit — für den zweiten Bildschirm.' }
  ];

  var INVESTORTYP = [
    { id: 'konservativ', name: 'Konservativ', dscr: 1.35, ltv: 80, ek: 20,
      risk: 'Konservativ (sicherheitsorientiert)',
      unter: 'Sicherheit vor Rendite. Höhere Tilgung, mehr Eigenkapital.' },
    { id: 'ausgewogen',  name: 'Ausgewogen',  dscr: 1.20, ltv: 90, ek: 10,
      risk: 'Moderat (ausgewogen)',
      unter: 'Der Mittelweg — die Vorbelegung, wenn du dich nicht festlegst.' },
    { id: 'offensiv',    name: 'Offensiv',    dscr: 1.05, ltv: 95, ek: 5,
      risk: 'Chancenorientiert (höheres Risiko)',
      unter: 'Hebel nutzen. Wenig Eigenkapital, engere Kapitaldienstdeckung.' }
  ];

  var _schritt = 0, _ov = null;
  var _wahl = { aussehen: null, typ: 'ausgewogen' };

  function _ls(k)      { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function _lsSet(k,v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function el(id)      { return document.getElementById(id); }
  function esc(s)      { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]; }); }

  function istFertig() { return !!_ls(FERTIG_KEY); }

  /* ── Profil lesen/schreiben über das vorhandene Modul ─────────────── */
  function profil(k, fallback) {
    try {
      var P = window.DealPilotInvestmentProfile;
      if (P && typeof P.get === 'function') {
        var v = P.get(k);
        if (v !== undefined && v !== null && v !== '') return v;
      }
    } catch (e) {}
    return fallback;
  }
  function profilSchreiben(obj) {
    try {
      var P = window.DealPilotInvestmentProfile;
      if (!P) return false;
      var akt = (typeof P.load === 'function') ? P.load() : {};
      Object.keys(obj).forEach(function (k) { if (obj[k] !== '' && obj[k] != null) akt[k] = obj[k]; });
      if (typeof P.save === 'function') return P.save(akt);
    } catch (e) {}
    return false;
  }

  /* ══ SCHRITT 1 · AUSSEHEN ═════════════════════════════════════════ */
  function s1() {
    return ''
      + '<p class="dpo-vor">Womit möchtest du arbeiten? Du kannst das jederzeit '
      + 'unter <b>Darstellung</b> ändern — auch mitten im Betrieb.</p>'
      + '<div class="dpo-kacheln">'
      + AUSSEHEN.map(function (a) {
          return '<button type="button" class="dpo-kachel' + (_wahl.aussehen === a.id ? ' an' : '')
            + '" data-aussehen="' + esc(a.id) + '">'
            + '<span class="dpo-k-vorschau dpo-v-' + (a.id || 'std') + '">'
            +   '<i class="dpo-v-leiste"></i><i class="dpo-v-flaeche"></i>'
            + '</span>'
            + '<span class="dpo-k-name">' + esc(a.name) + '</span>'
            + '<span class="dpo-k-unter">' + esc(a.unter) + '</span>'
            + '<span class="dpo-k-fuer">' + esc(a.fuer) + '</span>'
            + (a.karte ? '<span class="dpo-k-zusatz">Objektkarten als Bordkarte</span>' : '')
            + '</button>';
        }).join('')
      + '</div>';
  }

  /* ══ SCHRITT 2 · DEINE DATEN ══════════════════════════════════════ */
  function s2() {
    var s = {};
    try { s = (window.Settings && Settings.get()) || {}; } catch (e) {}
    /* Die E-Mail kennt die Anmeldung bereits — danach noch einmal zu
       fragen wäre eine Frage nach etwas, das schon beantwortet ist. */
    var mail = s.pdf_email || _mailAusSitzung() || '';
    return ''
      + '<p class="dpo-vor">Diese Angaben stehen später im Kopf deiner '
      + '<b>Investment-PDFs und Bankunterlagen</b> — dort, wo sonst ein '
      + 'leeres Feld steht. Du kannst den Schritt überspringen und es '
      + 'später unter <b>Einstellungen → Profil</b> nachtragen.</p>'
      + '<div class="dpo-raster">'
      +   _feld('dpo_name',    'Name',            s.user_name    || '', 'Vor- und Nachname')
      +   _feld('dpo_firma',   'Firma (optional)',s.user_company || '', 'z. B. Muster Immobilien GmbH')
      +   _feld('dpo_strasse', 'Straße + Nr.',    s.pdf_address  || '', 'Musterstraße 12')
      +   _feld('dpo_plz',     'PLZ',             s.pdf_plz      || '', '32609')
      +   _feld('dpo_ort',     'Ort',             s.pdf_city     || '', 'Musterstadt')
      +   _feld('dpo_tel',     'Telefon',         s.pdf_phone    || '', '+49 …')
      +   _feld('dpo_mail',    'E-Mail',          mail,              'name@firma.de')
      + '</div>'
      + '<p class="dpo-fuss">Aus der PLZ leiten wir das <b>Bundesland</b> ab — '
      + 'davon hängt die Grunderwerbsteuer ab, die bei jedem neuen Objekt '
      + 'vorbelegt wird.</p>';
  }

  function _mailAusSitzung() {
    try {
      if (window.Auth && typeof Auth.getSession === 'function') {
        var ses = Auth.getSession();
        if (ses && ses.email) return ses.email;
        if (ses && ses.user && ses.user.email) return ses.user.email;
      }
    } catch (e) {}
    return '';
  }

  function _feld(id, label, wert, ph) {
    return '<div class="dpo-f"><label for="' + id + '">' + esc(label) + '</label>'
      + '<input id="' + id + '" type="text" value="' + esc(wert) + '" placeholder="' + esc(ph) + '"></div>';
  }

  /* ══ SCHRITT 3 · FINANZIERUNG UND BEWIRTSCHAFTUNG ═════════════════ */
  function s3() {
    var mr = (window.DealPilotConfig && DealPilotConfig.marketRates) || {};
    var stand = mr.asOf ? (' · Stand ' + mr.asOf) : '';
    return ''
      + '<p class="dpo-vor">Mit diesen Werten rechnet jeder neue Quick-Check, '
      + 'bis du am Objekt etwas anderes einträgst.</p>'
      + '<div class="dpo-hinweis">'
      +   '<b>Zinssatz:</b> DealPilot zieht den <b>aktuellen Marktzins</b> und '
      +   'nimmt ihn indikativ — du musst nichts eintragen' + esc(stand) + '. '
      +   'Die <b>Zinsstufe</b> sagt, mit welchem Aufschlag gerechnet wird; '
      +   '„Standard" ist der vorsichtige Mittelweg.'
      + '</div>'
      + '<div class="dpo-raster">'
      +   _sel('dpo_zinsbindung', 'Zinsbindung', [[5,'5 Jahre'],[10,'10 Jahre'],[15,'15 Jahre'],[20,'20 Jahre']], profil('zinsbindung_default', 10))
      +   _sel('dpo_margin', 'Zinsstufe', [['premium','Premium (LTV bis 60 %)'],['standard','Standard (60–80 %)'],['schwach','Schwach (über 90 %)']], profil('zins_margin', 'standard'))
      +   _num('dpo_tilgung', 'Anfangstilgung', profil('tilgung_default', 1.5), '%')
      +   _num('dpo_ek', 'Eigenkapital', profil('ek_quote_default', 10), '% vom Kaufpreis')
      +   _num('dpo_mietausfall', 'Kalkulatorischer Mietausfall', profil('mietausfall_pct', 1), '% der Nettokaltmiete')
      +   _num('dpo_bwk_ul', 'Bewirtschaftung umlagefähig', profil('bwk_ul_pct_default', 17), '% der NKM')
      +   _num('dpo_bwk_nu', 'Bewirtschaftung nicht umlagefähig', profil('bwk_anteil_default', 16), '% der NKM')
      +   _num('dpo_dscr', 'Mindest-DSCR', profil('min_dscr', 1.20), 'ab hier kaufst du')
      + '</div>';
  }

  /* ══ SCHRITT 4 · STEUER ═══════════════════════════════════════════ */
  function s4() {
    return ''
      + '<p class="dpo-vor">Der <b>Grenzsteuersatz</b> ist der Satz auf den '
      + '<i>nächsten</i> verdienten Euro. DealPilot rechnet damit die '
      + 'Steuerwirkung deiner Immobilie — Abschreibung, Werbungskosten, '
      + 'Cashflow nach Steuern.</p>'
      + '<div class="dpo-raster dpo-raster-2">'
      +   _num('dpo_grenz', 'Grenzsteuersatz', profil('grenzsteuersatz', 40.45), '%')
      + '</div>'
      + '<div class="dpo-rechner">'
      +   '<div class="dpo-r-kopf">Du kennst ihn nicht? Dann schätzen wir ihn.</div>'
      +   '<div class="dpo-raster dpo-raster-3">'
      +     _num('dpo_zve', 'Zu versteuerndes Einkommen', '', '€ im Jahr')
      +     _sel('dpo_kirche', 'Kirchensteuer', [['0','keine'],['8','8 % (BY, BW)'],['9','9 % (übrige)']], '0')
      +     '<div class="dpo-f"><label>&nbsp;</label><button type="button" class="dpo-r-btn" id="dpo-rechnen">Schätzen</button></div>'
      +   '</div>'
      +   '<div class="dpo-r-erg" id="dpo-r-erg"></div>'
      +   '<p class="dpo-fuss">Das zu versteuernde Einkommen steht in deinem '
      +   'letzten <b>Steuerbescheid</b>, Zeile „zu versteuerndes Einkommen" — '
      +   'nicht das Bruttogehalt. Die Schätzung nutzt den Einkommensteuertarif '
      +   'nach § 32a EStG und <b>ersetzt keine Steuerberatung</b>.</p>'
      + '</div>';
  }

  /* ══ SCHRITT 5 · INVESTORTYP ══════════════════════════════════════ */
  function s5() {
    return ''
      + '<p class="dpo-vor">Wonach soll DealPilot deine Objekte bewerten? '
      + 'Das setzt die Schwellen für Score und Empfehlung — und lässt sich '
      + 'jederzeit ändern.</p>'
      + '<div class="dpo-kacheln dpo-kacheln-3">'
      + INVESTORTYP.map(function (t) {
          return '<button type="button" class="dpo-kachel' + (_wahl.typ === t.id ? ' an' : '')
            + '" data-typ="' + t.id + '">'
            + '<span class="dpo-k-name">' + esc(t.name) + '</span>'
            + '<span class="dpo-k-unter">' + esc(t.unter) + '</span>'
            + '<span class="dpo-k-werte">DSCR ab ' + String(t.dscr).replace('.', ',')
            +   ' · LTV bis ' + t.ltv + ' % · EK ' + t.ek + ' %</span>'
            + '</button>';
        }).join('')
      + '</div>';
  }

  var SCHRITTE = [
    { titel: 'Wie soll DealPilot aussehen?', kurz: 'Aussehen',    bau: s1 },
    { titel: 'Deine Daten',                  kurz: 'Daten',       bau: s2 },
    { titel: 'Womit sollen wir rechnen?',    kurz: 'Finanzierung',bau: s3 },
    { titel: 'Steuer',                       kurz: 'Steuer',      bau: s4 },
    { titel: 'Was für ein Investor bist du?',kurz: 'Profil',      bau: s5 }
  ];

  function _num(id, label, wert, einheit) {
    return '<div class="dpo-f"><label for="' + id + '">' + esc(label) + '</label>'
      + '<div class="dpo-iw"><input id="' + id + '" type="text" inputmode="decimal" value="'
      + esc(String(wert == null ? '' : wert).replace('.', ',')) + '">'
      + '<span class="dpo-eh">' + esc(einheit) + '</span></div></div>';
  }
  function _sel(id, label, opt, wert) {
    return '<div class="dpo-f"><label for="' + id + '">' + esc(label) + '</label>'
      + '<select id="' + id + '">'
      + opt.map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(wert) ? ' selected' : '') + '>'
            + esc(o[1]) + '</option>';
        }).join('')
      + '</select></div>';
  }

  /* ══ Einkommensteuertarif — Näherung ══════════════════════════════
     § 32a EStG, Zonengrenzen 2025/2026. Der Grenzsteuersatz ist die
     Steigung des Tarifs, nicht der Durchschnittssatz; er wird hier
     numerisch als Differenzenquotient über 100 € gebildet. Das ist für
     eine Vorbelegung genau genug und als Schätzung gekennzeichnet. */
  function _est(zve) {
    var x = Math.max(0, Math.floor(zve));
    if (x <= 12096) return 0;
    if (x <= 17443) { var y = (x - 12096) / 10000; return (932.3 * y + 1400) * y; }
    if (x <= 68480) { var z = (x - 17443) / 10000; return (176.64 * z + 2397) * z + 1015.13; }
    if (x <= 277825) return 0.42 * x - 10911.92;
    return 0.45 * x - 19246.67;
  }
  function _grenzsatz(zve, kirchePct) {
    if (!(zve > 0)) return null;
    var d = 100;
    var grenz = (_est(zve + d) - _est(zve)) / d;       /* Einkommensteuer */
    var soli = 0;                                      /* greift erst weit oben, hier 0 */
    var kirche = grenz * (Number(kirchePct) || 0) / 100;
    return Math.round((grenz + soli + kirche) * 10000) / 100;   /* in % */
  }

  /* ══ Modal ════════════════════════════════════════════════════════ */
  function zeige(ab) {
    if (_ov) return;
    _schritt = Math.max(0, Math.min(SCHRITTE.length - 1, ab || 0));
    try { window.__dpOnboardingAktiv = true; } catch (e) {}

    _ov = document.createElement('div');
    _ov.id = 'dp-onboarding';
    _ov.className = 'dpo-ov';
    _ov.innerHTML =
      '<div class="dpo-kasten" role="dialog" aria-modal="true" aria-labelledby="dpo-titel">'
      + '<div class="dpo-kopf">'
      +   '<div class="dpo-marke">DealPilot</div>'
      +   '<div class="dpo-schritte" id="dpo-schritte"></div>'
      + '</div>'
      + '<div class="dpo-leib">'
      +   '<h2 id="dpo-titel"></h2>'
      +   '<div id="dpo-inhalt"></div>'
      + '</div>'
      + '<div class="dpo-fuss-leiste">'
      +   '<button type="button" class="dpo-b dpo-b-still" id="dpo-ueberspringen">Diesen Schritt überspringen</button>'
      +   '<div class="dpo-fuss-r">'
      +     '<button type="button" class="dpo-b dpo-b-still" id="dpo-zurueck">Zurück</button>'
      +     '<button type="button" class="dpo-b dpo-b-gold" id="dpo-weiter">Weiter</button>'
      +   '</div>'
      + '</div>'
      + '</div>';
    document.body.appendChild(_ov);
    _stil();
    _zeichne();

    _ov.addEventListener('click', function (ev) {
      var k = ev.target.closest ? ev.target.closest('[data-aussehen],[data-typ]') : null;
      if (k) {
        if (k.hasAttribute('data-aussehen')) {
          _wahl.aussehen = k.getAttribute('data-aussehen');
          _aussehenAnwenden(_wahl.aussehen);
        } else { _wahl.typ = k.getAttribute('data-typ'); }
        Array.prototype.forEach.call(_ov.querySelectorAll('.dpo-kachel'), function (x) { x.classList.remove('an'); });
        k.classList.add('an');
        return;
      }
      if (ev.target.id === 'dpo-rechnen') { _rechnen(); return; }
      if (ev.target.id === 'dpo-weiter') { _sichern(); _vor(); return; }
      if (ev.target.id === 'dpo-zurueck') { _sichern(); _zurueck(); return; }
      if (ev.target.id === 'dpo-ueberspringen') { _vor(); return; }
    });
  }

  function _rechnen() {
    var zve = parseFloat(String((el('dpo_zve') || {}).value || '').replace(/\./g, '').replace(',', '.'));
    var k = (el('dpo_kirche') || {}).value || '0';
    var erg = el('dpo-r-erg');
    if (!erg) return;
    var g = _grenzsatz(zve, k);
    if (g == null) { erg.innerHTML = '<span class="dpo-r-fehl">Bitte ein zu versteuerndes Einkommen eintragen.</span>'; return; }
    erg.innerHTML = 'Geschätzter Grenzsteuersatz: <b>' + String(g).replace('.', ',') + ' %</b>'
      + '<button type="button" class="dpo-r-uebernehmen" id="dpo-uebernehmen">übernehmen</button>';
    var b = el('dpo-uebernehmen');
    if (b) b.onclick = function () {
      var f = el('dpo_grenz'); if (f) f.value = String(g).replace('.', ',');
      erg.innerHTML = '<span class="dpo-r-ok">Übernommen: ' + String(g).replace('.', ',') + ' %</span>';
    };
  }

  function _aussehenAnwenden(id) {
    var a = AUSSEHEN.filter(function (x) { return x.id === id; })[0];
    try { if (window.DealPilotLayout && DealPilotLayout.setze) DealPilotLayout.setze(id || ''); } catch (e) {}
    try {
      if (a && a.karte && window.DealPilotKartenVariante && DealPilotKartenVariante.setze) {
        DealPilotKartenVariante.setze(a.karte);
      }
    } catch (e) {}
  }

  function _zahl(id) {
    var e = el(id); if (!e) return null;
    var v = parseFloat(String(e.value || '').replace(/\./g, '').replace(',', '.'));
    return isFinite(v) ? v : null;
  }

  function _sichern() {
    if (_schritt === 1) {
      try {
        var s = (window.Settings && Settings.get()) || {};
        var neu = {};
        Object.keys(s).forEach(function (k) { neu[k] = s[k]; });
        var m = { dpo_name:'user_name', dpo_firma:'user_company', dpo_strasse:'pdf_address',
                  dpo_plz:'pdf_plz', dpo_ort:'pdf_city', dpo_tel:'pdf_phone', dpo_mail:'pdf_email' };
        Object.keys(m).forEach(function (id) { var e = el(id); if (e && e.value.trim()) neu[m[id]] = e.value.trim(); });
        if (window.Settings && Settings.save) Settings.save(neu);
        /* Bundesland aus der PLZ — davon haengt die Grunderwerbsteuer ab */
        var plz = (el('dpo_plz') || {}).value || '';
        var bl = _blAusPlz(plz);
        if (bl) profilSchreiben({ bundesland: bl });
      } catch (e) {}
    }
    if (_schritt === 2) {
      profilSchreiben({
        zinsbindung_default: _zahl('dpo_zinsbindung'),
        zins_margin: (el('dpo_margin') || {}).value || 'standard',
        tilgung_default: _zahl('dpo_tilgung'),
        ek_quote_default: _zahl('dpo_ek'),
        mietausfall_pct: _zahl('dpo_mietausfall'),
        bwk_ul_pct_default: _zahl('dpo_bwk_ul'),
        bwk_anteil_default: _zahl('dpo_bwk_nu'),
        min_dscr: _zahl('dpo_dscr')
      });
    }
    if (_schritt === 3) {
      var g = _zahl('dpo_grenz');
      if (g != null) profilSchreiben({ grenzsteuersatz: g });
    }
    if (_schritt === 4) {
      var t = INVESTORTYP.filter(function (x) { return x.id === _wahl.typ; })[0];
      if (t) profilSchreiben({ min_dscr: t.dscr, max_ltv: t.ltv, ek_quote_default: t.ek, ai_risk: t.risk });
    }
  }

  /* PLZ → Bundesland, grob nach Leitzahlbereichen. Fuer die
     Grunderwerbsteuer-Vorbelegung genau genug; am Objekt wird sie ohnehin
     aus der echten Adresse bestimmt. */
  /* Je Leitregion (erste zwei Ziffern) ein Land. Als KETTE geschrieben
     hatte ich sie zuerst falsch - zwei Bedingungen ueberdeckten einander
     und eine Zeile war unerreichbar. Eine Tabelle laesst sich lesen und
     gegenpruefen, eine Kette aus 20 Vergleichen nicht. */
  var PLZ_LAND = {
    '01':'SN','02':'SN','03':'BB','04':'SN','06':'ST','07':'TH','08':'SN','09':'SN',
    '10':'BE','12':'BE','13':'BE','14':'BB','15':'BB','16':'BB',
    '17':'MV','18':'MV','19':'MV',
    '20':'HH','21':'HH','22':'HH','23':'SH','24':'SH','25':'SH',
    '26':'NI','27':'NI','28':'HB','29':'NI','30':'NI','31':'NI',
    '32':'NW','33':'NW','34':'HE','35':'HE','36':'HE','37':'NI','38':'NI','39':'ST',
    '40':'NW','41':'NW','42':'NW','44':'NW','45':'NW','46':'NW','47':'NW','48':'NW','49':'NI',
    '50':'NW','51':'NW','52':'NW','53':'NW','54':'RP','55':'RP','56':'RP',
    '57':'NW','58':'NW','59':'NW',
    '60':'HE','61':'HE','63':'HE','64':'HE','65':'HE','66':'SL','67':'RP','68':'BW','69':'BW',
    '70':'BW','71':'BW','72':'BW','73':'BW','74':'BW','75':'BW','76':'BW','77':'BW','78':'BW','79':'BW',
    '80':'BY','81':'BY','82':'BY','83':'BY','84':'BY','85':'BY','86':'BY','87':'BY',
    '88':'BW','89':'BW',
    '90':'BY','91':'BY','92':'BY','93':'BY','94':'BY','95':'BY','96':'BY','97':'BY',
    '98':'TH','99':'TH'
  };
  function _blAusPlz(plz) {
    var p = String(plz || '').replace(/\D/g, '').slice(0, 2);
    if (p.length < 2) return null;
    return PLZ_LAND[p] || null;
  }

  function _vor() {
    if (_schritt < SCHRITTE.length - 1) { _schritt++; _lsSet(SCHRITT_KEY, String(_schritt)); _zeichne(); }
    else { _abschliessen(); }
  }
  function _zurueck() { if (_schritt > 0) { _schritt--; _zeichne(); } }

  function _zeichne() {
    var s = SCHRITTE[_schritt];
    el('dpo-titel').textContent = s.titel;
    el('dpo-inhalt').innerHTML = s.bau();
    el('dpo-schritte').innerHTML = SCHRITTE.map(function (x, i) {
      return '<span class="dpo-pkt' + (i === _schritt ? ' an' : (i < _schritt ? ' fertig' : '')) + '">'
        + '<i></i>' + esc(x.kurz) + '</span>';
    }).join('');
    el('dpo-zurueck').style.visibility = _schritt === 0 ? 'hidden' : '';
    el('dpo-weiter').textContent = (_schritt === SCHRITTE.length - 1) ? 'Fertig — los geht’s' : 'Weiter';
    try { el('dpo-inhalt').scrollTop = 0; } catch (e) {}
  }

  function _abschliessen() {
    _lsSet(FERTIG_KEY, new Date().toISOString());
    try { localStorage.removeItem(SCHRITT_KEY); } catch (e) {}
    try { window.__dpOnboardingAktiv = false; } catch (e) {}
    if (_ov) { _ov.remove(); _ov = null; }
    /* Jetzt erst der Rundgang — er zeigt die Oberflaeche, die eben
       gewaehlt wurde. */
    try {
      if (window.DpTour && typeof DpTour.start === 'function') setTimeout(function () { DpTour.start(); }, 500);
    } catch (e) {}
  }

  function _stil() {
    if (el('dpo-stil')) return;
    var s = document.createElement('style');
    s.id = 'dpo-stil';
    s.textContent = [
      '.dpo-ov{position:fixed;inset:0;z-index:100000;background:rgba(5,5,5,.82);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Inter,system-ui,sans-serif}',
      '.dpo-kasten{background:#FDFCFA;color:#1b1815;border-radius:18px;width:min(760px,100%);max-height:min(92vh,860px);display:flex;flex-direction:column;box-shadow:0 30px 80px -20px rgba(0,0,0,.6);overflow:hidden}',
      '.dpo-kopf{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));padding:13px 20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}',
      '.dpo-marke{font-family:"Space Grotesk",Inter,sans-serif;font-weight:700;font-size:15px;color:#1a1508;letter-spacing:.2px}',
      '.dpo-schritte{display:flex;gap:12px;flex-wrap:wrap;margin-left:auto}',
      '.dpo-pkt{display:flex;align-items:center;gap:5px;font-family:"JetBrains Mono",monospace;font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:rgba(26,21,8,.5)}',
      '.dpo-pkt i{width:7px;height:7px;border-radius:50%;background:rgba(26,21,8,.25);display:block}',
      '.dpo-pkt.an{color:#1a1508;font-weight:700}.dpo-pkt.an i{background:#1a1508}',
      '.dpo-pkt.fertig{color:rgba(26,21,8,.75)}.dpo-pkt.fertig i{background:rgba(26,21,8,.6)}',
      '.dpo-leib{padding:22px 24px;overflow-y:auto;flex:1 1 auto;min-height:0}',
      '.dpo-leib h2{font-family:"Space Grotesk",Inter,sans-serif;font-size:21px;margin:0 0 10px;color:#1b1815}',
      '.dpo-vor{font-size:13.5px;line-height:1.6;color:#55504a;margin:0 0 16px}',
      '.dpo-fuss{font-size:11.5px;line-height:1.55;color:#7A7370;margin:12px 0 0}',
      '.dpo-hinweis{background:#F6F2E6;border:1px solid #E8E1CE;border-radius:10px;padding:11px 13px;font-size:12.5px;line-height:1.6;color:#4a453f;margin-bottom:16px}',
      '.dpo-kacheln{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}',
      '.dpo-kacheln-3{grid-template-columns:repeat(3,1fr)}',
      '.dpo-kachel{text-align:left;background:#fff;border:1.5px solid #E7E2D6;border-radius:12px;padding:13px;cursor:pointer;display:flex;flex-direction:column;gap:4px;transition:.14s;font:inherit}',
      '.dpo-kachel:hover{border-color:var(--wl-c9a84c,#C9A84C);transform:translateY(-1px)}',
      '.dpo-kachel.an{border-color:var(--wl-b8932f,#b8932f);box-shadow:0 0 0 3px color-mix(in srgb,var(--wl-c9a84c,#C9A84C) 22%,transparent)}',
      '.dpo-k-name{font-family:"Space Grotesk",Inter,sans-serif;font-weight:700;font-size:14.5px;color:#1b1815}',
      '.dpo-k-unter{font-family:"JetBrains Mono",monospace;font-size:9.5px;letter-spacing:.4px;color:#8a837a;text-transform:uppercase}',
      '.dpo-k-fuer{font-size:12px;line-height:1.5;color:#55504a;margin-top:2px}',
      '.dpo-k-werte{font-family:"JetBrains Mono",monospace;font-size:10.5px;color:#6b6660;margin-top:4px}',
      '.dpo-k-zusatz{font-size:10.5px;color:var(--wl-b8932f,#b8932f);margin-top:4px;font-weight:600}',
      '.dpo-k-vorschau{display:block;height:38px;border-radius:7px;overflow:hidden;position:relative;margin-bottom:6px;background:#0c0b09}',
      '.dpo-k-vorschau i{position:absolute;display:block}',
      '.dpo-v-leiste{background:var(--wl-c9a84c,#C9A84C)}.dpo-v-flaeche{background:rgba(255,255,255,.14)}',
      '.dpo-v-std .dpo-v-leiste{left:0;right:0;top:0;height:7px}.dpo-v-std .dpo-v-flaeche{left:5px;right:5px;top:12px;bottom:5px}',
      '.dpo-v-v1b{background:#FDFCFA}.dpo-v-v1b .dpo-v-leiste{left:0;top:0;bottom:0;width:11px}.dpo-v-v1b .dpo-v-flaeche{left:16px;right:5px;top:5px;bottom:5px;background:rgba(26,21,8,.1)}',
      '.dpo-v-v2{background:#FDFCFA}.dpo-v-v2 .dpo-v-leiste{left:0;top:0;bottom:0;width:11px}.dpo-v-v2 .dpo-v-flaeche{left:16px;right:14px;top:5px;bottom:5px;background:rgba(26,21,8,.1)}',
      '.dpo-v-v2b .dpo-v-leiste{left:0;top:0;bottom:0;width:9px}.dpo-v-v2b .dpo-v-flaeche{left:13px;right:13px;top:5px;bottom:5px}',
      '.dpo-raster{display:grid;grid-template-columns:repeat(2,1fr);gap:11px}',
      '.dpo-raster-2{grid-template-columns:repeat(2,1fr);max-width:50%}',
      '.dpo-raster-3{grid-template-columns:1.4fr 1fr auto;align-items:end}',
      '.dpo-f{display:flex;flex-direction:column;gap:4px;min-width:0}',
      '.dpo-f label{font-family:"JetBrains Mono",monospace;font-size:9.5px;letter-spacing:.5px;text-transform:uppercase;color:#8a837a}',
      '.dpo-f input,.dpo-f select{border:1.5px solid #E7E2D6;border-radius:9px;padding:9px 11px;font:inherit;font-size:13.5px;color:#1b1815;background:#fff;min-width:0;width:100%;box-sizing:border-box}',
      '.dpo-f input:focus,.dpo-f select:focus{outline:none;border-color:var(--wl-c9a84c,#C9A84C)}',
      '.dpo-iw{position:relative;display:flex;align-items:center}',
      '.dpo-eh{position:absolute;right:10px;font-family:"JetBrains Mono",monospace;font-size:10px;color:#9a948a;pointer-events:none;background:#fff;padding-left:5px}',
      '.dpo-rechner{margin-top:18px;background:#F6F2E6;border:1px solid #E8E1CE;border-radius:11px;padding:14px}',
      '.dpo-r-kopf{font-weight:600;font-size:13px;margin-bottom:10px;color:#1b1815}',
      '.dpo-r-btn{border:1.5px solid var(--wl-c9a84c,#C9A84C);background:#fff;color:#1b1815;border-radius:9px;padding:9px 14px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}',
      '.dpo-r-erg{margin-top:10px;font-size:13.5px;color:#1b1815;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.dpo-r-uebernehmen{border:none;background:var(--wl-c9a84c,#C9A84C);color:#1a1508;border-radius:7px;padding:5px 11px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}',
      '.dpo-r-fehl{color:#B8625C}.dpo-r-ok{color:#3FA56C;font-weight:600}',
      '.dpo-fuss-leiste{border-top:1px solid #EDE8DC;padding:13px 20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#fff}',
      '.dpo-fuss-r{margin-left:auto;display:flex;gap:9px}',
      '.dpo-b{border-radius:10px;padding:10px 18px;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer;border:1.5px solid transparent}',
      '.dpo-b-still{background:transparent;color:#7A7370;border-color:#E7E2D6}',
      '.dpo-b-still:hover{color:#1b1815;border-color:#C9C3B6}',
      '.dpo-b-gold{background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));color:#1a1508;border:none}',
      /* Handy und Tablet: eine Spalte, Fussleiste bricht um */
      '@media(max-width:680px){',
      '  .dpo-ov{padding:0;align-items:stretch}',
      '  .dpo-kasten{border-radius:0;max-height:100vh;width:100%}',
      '  .dpo-kacheln,.dpo-kacheln-3,.dpo-raster,.dpo-raster-2,.dpo-raster-3{grid-template-columns:1fr;max-width:none}',
      '  .dpo-schritte{margin-left:0;width:100%;gap:8px}',
      '  .dpo-pkt{font-size:8.5px}',
      '  .dpo-leib{padding:16px}',
      '  .dpo-leib h2{font-size:18px}',
      '  .dpo-fuss-leiste{padding:11px 14px}',
      '  .dpo-fuss-r{margin-left:0;width:100%}',
      '  .dpo-b{flex:1;padding:12px 14px;text-align:center}',
      '  .dpo-b-still#dpo-ueberspringen{width:100%;order:9}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ══ Auslöser ═════════════════════════════════════════════════════ */
  function _faellig() {
    if (istFertig()) return false;
    try { if (sessionStorage.getItem('dp_auth_flow')) return false; } catch (e) {}
    if (document.getElementById('auth-modal') || document.getElementById('dp-register-modal')) return false;
    try { if (window.Auth && Auth.isLoggedIn && !Auth.isLoggedIn()) return false; } catch (e) { return false; }
    return true;
  }

  function _vielleichtZeigen() {
    if (!_faellig()) return;
    /* Dieselbe Bedingung wie beim Rundgang: warten, bis die Oberflaeche
       wirklich steht - nicht eine Zahl von Millisekunden raten. */
    (function warten(seit) {
      seit = seit || Date.now();
      var da = !!document.querySelector('#sb-list, #sidebar');
      if (!da && (Date.now() - seit) < 2500) { setTimeout(function () { warten(seit); }, 120); return; }
      if (!_faellig()) return;
      zeige(parseInt(_ls(SCHRITT_KEY) || '0', 10) || 0);
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_vielleichtZeigen, 300); });
  } else {
    setTimeout(_vielleichtZeigen, 300);
  }

  return {
    zeige: zeige,
    istFertig: istFertig,
    zuruecksetzen: function () {
      try { localStorage.removeItem(FERTIG_KEY); localStorage.removeItem(SCHRITT_KEY); } catch (e) {}
    },
    _grenzsatz: _grenzsatz,
    _blAusPlz: _blAusPlz
  };
})();
