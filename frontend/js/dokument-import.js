'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   DealPilot v1678 — Dokument-Import

   Nimmt EIN PDF, erkennt die Art und liest sie mit dem passenden Schema
   aus. Neun Arten: Grundbuch, Kataster, Kaufvertrag, WEG-Protokoll,
   BORIS, Verkehrswertgutachten, Restnutzungsdauergutachten,
   Kaufpreisaufteilung, Marktbericht.

   Die Schemata stammen aus dem Import-Modul v1.1.0, die Rechnung bleibt
   in DealPilot. Fremde Gutachten liefern EINGABEN, nie Ergebnisse —
   deshalb wird ein mitgelesener Gutachtenwert (`rnd_jahre`,
   `verkehrswert_eur`, `gebaeudeanteil_pct_laut_gutachten`) hier als
   VERGLEICH angezeigt und nicht uebernommen.

   Textextraktion und pdf.js kommen aus `pdf-import.js`
   (`window.PdfImport.extractText` / `.ensurePdfJs`) — nicht noch einmal
   gebaut, weil zwei Fassungen derselben Funktion auseinanderlaufen.
═══════════════════════════════════════════════════════════════════════════ */

(function () {

  var _arten = null;      /* Auswahlliste vom Server, einmal geholt */
  var _letzter = null;    /* letztes Ergebnis, fuer die Uebernahme  */

  /* Felder, die ein ERGEBNIS des fremden Gutachtens sind. Sie werden
     angezeigt, aber nie in die eigene Rechnung uebernommen.          */
  var VERGLEICHSFELDER = {
    rnd_jahre: 'Restnutzungsdauer laut Gutachten',
    verkehrswert_eur: 'Verkehrswert laut Gutachten',
    gebaeudeanteil_pct_laut_gutachten: 'Gebäudeanteil laut Gutachten',
    bodenwert_eur_laut_gutachten: 'Bodenwert laut Gutachten'
  };

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* _euro(null) ergibt "–" und ist damit truthy — nie als ||-Fallback
     verwenden. Steht so in CLAUDE.md.                                 */
  function _zahl(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function _fmt(v) {
    var n = _zahl(v);
    if (n === null) return null;
    return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
  }

  async function _artenHolen() {
    if (_arten) return _arten;
    try {
      var r = await Auth.apiCall('/ai/dokument-arten', { method: 'GET' });
      _arten = (r && r.arten) || [];
    } catch (e) { _arten = []; }
    return _arten;
  }

  /* ── Bedienung ──────────────────────────────────────────────────── */

  /* v2217 · Rueckruf fuer die Kette der Datenaufnahme (object-actions.js
     runSelected): sie wartet, bis dieses Fenster zu ist. */
  var _beiSchluss = null;

  async function oeffnen(opts) {
    _beiSchluss = (opts && typeof opts.beiSchluss === 'function') ? opts.beiSchluss : null;
    var wrap = document.getElementById('dpdi-modal');
    if (wrap) { wrap.remove(); }
    wrap = document.createElement('div');
    wrap.id = 'dpdi-modal';
    wrap.className = 'dpdi-modal';
    wrap.innerHTML =
        '<div class="dpdi-box">'
      +   '<button class="dpdi-close" type="button" aria-label="Schliessen">&times;</button>'
      +   '<h2 class="dpdi-title">Dokument einlesen</h2>'
      +   '<p class="dpdi-sub">Grundbuch, Kataster, Kaufvertrag, WEG-Protokoll, '
      +     'Bodenrichtwert, Verkehrswert- oder Restnutzungsdauergutachten, '
      +     'Kaufpreisaufteilung oder Marktbericht. Die Art wird erkannt.</p>'
      +   '<label class="dpdi-drop" for="dpdi-file">'
      +     '<span class="dpdi-drop-icon">&#128196;</span>'
      +     '<span class="dpdi-drop-text">PDF auswählen</span>'
      +     '<input type="file" id="dpdi-file" accept="application/pdf,.pdf" hidden>'
      +   '</label>'
      +   '<div class="dpdi-status" id="dpdi-status" hidden></div>'
      +   '<div class="dpdi-result" id="dpdi-result" hidden></div>'
      + '</div>';
    document.body.appendChild(wrap);

    wrap.querySelector('.dpdi-close').addEventListener('click', schliessen);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) schliessen(); });
    wrap.querySelector('#dpdi-file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) _verarbeite(f);
    });

    _artenHolen();
  }

  function schliessen() {
    var w = document.getElementById('dpdi-modal');
    if (w) w.remove();
    var cb = _beiSchluss; _beiSchluss = null;
    if (cb) { try { cb(); } catch (e) {} }
  }

  /* ── v2217 · ABGLEICH UND UEBERNAHME ─────────────────────────────────
     Marcel 14.10.2026: „Werden Abweichungen bei PDFs gemeldet?" Gemessen:
     dieser Import las aus, zeigte die Rohschluessel (kaufpreis_eur …) und
     konnte NICHTS uebernehmen - es gab weder Abgleich noch Knopf.
     Jetzt: jedes Feld, das es im Objekt gibt, steht mit „im Dokument" und
     „im Objekt" nebeneinander. Leer → vorgehakt. Gleich → nichts zu tun.
     Abweichend → markiert und NICHT vorgehakt; still ueberschrieben wird
     nie. Die Ergebnisse fremder Gutachten (VERGLEICHSFELDER) bleiben, wie
     sie waren, ein Vergleich. */
  var ZIEL = {
    kaufpreis_eur: ['kp', 'Kaufpreis', 'eur'], kaufpreis: ['kp', 'Kaufpreis', 'eur'],
    wohnflaeche_m2: ['wfl', 'Wohnfläche', 'm2'], wohnflaeche: ['wfl', 'Wohnfläche', 'm2'],
    baujahr: ['baujahr', 'Baujahr', 'jahr'],
    bgf_m2: ['bgf', 'Bruttogrundfläche', 'm2'],
    grundstuecksflaeche_m2: ['gsfl', 'Grundstücksfläche', 'm2'],
    brw_eur_m2: ['brw', 'Bodenrichtwert', 'eurm2'], bodenrichtwert_eur_m2: ['brw', 'Bodenrichtwert', 'eurm2'], bodenrichtwert: ['brw', 'Bodenrichtwert', 'eurm2'],
    grunderwerbsteuer_pct: ['gest_p', 'Grunderwerbsteuer', 'pct'],
    kaufdatum: ['kaufdat', 'Kaufdatum', 'datum'],
    gemarkung: ['gemarkung', 'Gemarkung', 'text'], flur: ['flur', 'Flur', 'text'], flurstueck: ['flurstueck', 'Flurstück', 'text'],
    /* v3016 · Unterlagen: Grundbuch/Teilung (MEA), Energieausweis, Mietvertrag (ETW) */
    mea_pct: ['mea', 'Miteigentumsanteil', 'pct'],
    energieeffizienzklasse: ['ds2_energie', 'Energieklasse', 'auswahl'],
    baujahr_gebaeude: ['baujahr', 'Baujahr', 'jahr'],
    kaltmiete_eur: ['nkm', 'Nettokaltmiete (Monat)', 'eur'],
    wohnflaeche_m2: ['wfl', 'Wohnfläche', 'm2'],
    zimmer: ['zimmer', 'Zimmer', 'zahl']
  };
  /* v3016 · nur aus diesen Arten - eine Kaltmiete aus der Mieterliste eines MFH ist
     die Summe vieler Wohnungen und geht über die Einheiten, nicht in ein Feld */
  var NUR_AUS = { kaltmiete_eur: { mietvertrag: 1 }, wohnflaeche_m2: { mietvertrag: 1 }, zimmer: { mietvertrag: 1 } };
  /* Klartext statt Schluessel fuer die uebrigen Angaben */
  var NAMEN = {
    notar: 'Notar', ur_nr: 'Urkundennummer', nebenkosten_eur: 'Nebenkosten', verkaeufer_anzahl: 'Verkäufer (Anzahl)', kaeufer_anzahl: 'Käufer (Anzahl)',
    reparaturbedarf_eur: 'Reparaturbedarf', hausgeld_monatlich_eur: 'Hausgeld je Monat', instandhaltungsruecklage_eur: 'Instandhaltungsrücklage',
    gnd_jahre: 'Gesamtnutzungsdauer', gesamtnutzungsdauer_jahre: 'Gesamtnutzungsdauer', modernisierungspunkte: 'Modernisierungspunkte',
    liegenschaftszinssatz_pct: 'Liegenschaftszinssatz', sachwertfaktor: 'Sachwertfaktor', stichtag: 'Stichtag', bewertungsstichtag: 'Bewertungsstichtag',
    amtsgericht: 'Amtsgericht', blatt_nr: 'Blatt', grundschulden_gesamt_eur: 'Grundschulden gesamt', nutzung: 'Nutzung', nutzungsart: 'Nutzungsart',
    zone_nr: 'Bodenrichtwertzone', versammlungsdatum: 'Versammlung am', verwalter: 'Verwalter', berichtsjahr: 'Berichtsjahr', gutachterausschuss: 'Gutachterausschuss'
  };
  function _flach(ext) {
    var o = {};
    /* v3016 · Flurstücke stehen als Liste - das erste füllt Gemarkung, Flur, Flurstück */
    var fs0 = ext && Array.isArray(ext.flurstuecke) && ext.flurstuecke[0];
    if (fs0) ['gemarkung', 'flur', 'flurstueck'].forEach(function (k) { if (fs0[k] != null && fs0[k] !== '' && (ext[k] == null || ext[k] === '')) o[k] = fs0[k]; });
    if (fs0 && fs0.flaeche_m2 && ext.flurstuecke.length === 1 && !(ext.grundstuecksflaeche_m2 > 0)) o.grundstuecksflaeche_m2 = fs0.flaeche_m2;
    if (ext && ext.miteigentumsanteil && window.DpUnterlagen) { var mp = window.DpUnterlagen.meaProzent(ext.miteigentumsanteil); if (mp != null) o.mea_pct = mp; }
    if (ext && ext.energieeffizienzklasse) o.energieeffizienzklasse = String(ext.energieeffizienzklasse).toUpperCase().replace(/\s/g, '');
    Object.keys(ext || {}).forEach(function (k) {
      var v = ext[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.keys(v).forEach(function (k2) { if (o[k2] === undefined) o[k2] = v[k2]; });
      else if (!((v === null || v === undefined || v === '') && o[k] != null && o[k] !== '')) o[k] = v;   /* v3016: leer überschreibt nie die Flurstücksliste */
    });
    return o;
  }
  function _datumIso(v) {
    var m = String(v || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null;
  }
  function _schreibwert(v, art) {
    if (art === 'datum') return _datumIso(v);
    if (art === 'text') return String(v).trim();
    if (art === 'auswahl') return String(v).trim().toUpperCase().replace(/\s/g, '');   /* Energieklasse: „b" → „B" wie im Auswahlfeld */
    var n = _zahl(v); if (n === null) return null;
    if (art === 'jahr') return String(Math.round(n));
    return (n % 1 === 0) ? String(n) : String(n).replace('.', ',');
  }
  function _gleich(ist, neu, art) {
    if (art === 'text' || art === 'datum' || art === 'auswahl') return String(ist).trim().toLowerCase() === String(neu).trim().toLowerCase();
    var a = (typeof parseDe === 'function') ? parseDe(ist) : parseFloat(ist), b = (typeof parseDe === 'function') ? parseDe(neu) : parseFloat(neu);
    return Math.abs(a - b) < 0.005;
  }
  function _abgleich(ext, typ) {
    var f = _flach(ext), zeilen = [], gesehen = {};
    Object.keys(ZIEL).forEach(function (k) {
      if (f[k] === undefined || f[k] === null || f[k] === '') return;
      if (NUR_AUS[k] && !(typ && NUR_AUS[k][typ])) return;   /* v3016 */
      var z = ZIEL[k]; if (gesehen[z[0]]) return;
      var el = document.getElementById(z[0]); if (!el) return;
      var neu = _schreibwert(f[k], z[2]); if (neu === null || neu === '') return;
      gesehen[z[0]] = 1;
      var ist = String(el.value || '').trim();
      var status = ist === '' ? 'neu' : (_gleich(ist, neu, z[2]) ? 'gleich' : 'abweichung');
      zeilen.push({ feld: z[0], wort: z[1], neu: neu, anzeige: (z[2] === 'jahr' ? String(Math.round(_zahl(f[k]))) : typeof f[k] === 'number' ? _fmt(f[k]) : String(f[k])),   /* Baujahr nie „1.967" */ ist: ist, status: status });
    });
    return zeilen;
  }
  function _uebernehmen(zeilen) {
    var n = 0;
    zeilen.forEach(function (z) {
      var cb = document.querySelector('#dpdi-abgleich input[data-feld="' + z.feld + '"]');
      if (!cb || !cb.checked) return;
      var el = document.getElementById(z.feld); if (!el) return;
      el.value = z.neu;
      try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
      n++;
    });
    try { if (typeof window.calc === 'function') window.calc(); } catch (e) {}
    return n;
  }

  function _status(text, art) {
    var el = document.getElementById('dpdi-status');
    if (!el) return;
    el.hidden = false;
    el.className = 'dpdi-status' + (art ? ' dpdi-' + art : '');
    el.textContent = text;
  }

  async function _verarbeite(file, typUeberschreiben) {
    var res = document.getElementById('dpdi-result');
    if (res) { res.hidden = true; res.innerHTML = ''; }
    _status('PDF wird gelesen …');

    try {
      if (!window.PdfImport || typeof window.PdfImport.extractText !== 'function') {
        throw new Error('Die PDF-Leseschicht fehlt (pdf-import.js nicht geladen).');
      }
      await window.PdfImport.ensurePdfJs();
      var text = await window.PdfImport.extractText(file);

      /* Ein gescanntes PDF gibt fast nichts her. Das gehoert benannt,
         sonst sucht der Nutzer den Fehler bei sich.                  */
      if (!text || text.replace(/\s/g, '').length < 120) {
        _status('Aus diesem PDF kommt kaum Text — vermutlich ein Scan. '
              + 'Texterkennung ist für diesen Weg noch nicht eingebaut.', 'warn');
        return;
      }

      _status('Dokumentart wird bestimmt und ausgelesen …');
      var antwort = await Auth.apiCall('/ai/extract-dokument', {
        method: 'POST',
        body: { text: text.slice(0, 15000), dateiname: file.name, typ: typUeberschreiben || undefined }
      });

      if (antwort && antwort.unklar) { _zeigeAuswahl(antwort, file); return; }
      if (!antwort || !antwort.success) {
        _status((antwort && antwort.error) || 'Das Dokument konnte nicht ausgelesen werden.', 'fehler');
        return;
      }

      _letzter = antwort;
      _zeigeErgebnis(antwort, file);
    } catch (err) {
      _status(err.message || 'Unbekannter Fehler beim Einlesen.', 'fehler');
    }
  }

  function _zeigeAuswahl(antwort, file) {
    _status('Die Art liess sich nicht sicher bestimmen — bitte auswählen.', 'warn');
    var res = document.getElementById('dpdi-result');
    if (!res) return;
    var liste = (antwort.auswahl || []).filter(function (a) { return a.extrahierbar; });
    res.hidden = false;
    res.innerHTML = '<div class="dpdi-wahl">'
      + liste.map(function (a) {
          return '<button type="button" class="dpdi-wahl-btn" data-typ="' + _esc(a.id) + '">'
               + _esc(a.label) + '</button>';
        }).join('')
      + '</div>';
    Array.prototype.forEach.call(res.querySelectorAll('.dpdi-wahl-btn'), function (b) {
      b.addEventListener('click', function () { _verarbeite(file, b.getAttribute('data-typ')); });
    });
  }

  function _zeigeErgebnis(a, file) {
    var res = document.getElementById('dpdi-result');
    if (!res) return;
    var ext = a.extracted || {};

    var sicher = Math.round((a.erkennung && a.erkennung.sicherheit || 0) * 100);
    _status('Erkannt als ' + (a.label || a.typ) + ' (' + sicher + ' % Trefferquote im Stichwortabgleich).', 'ok');

    var zeilen = [], vergleich = [];
    Object.keys(ext).forEach(function (k) {
      var v = ext[k];
      if (v === null || v === undefined || v === '') return;
      var text;
      if (typeof v === 'object' && !Array.isArray(v)) {
        /* v2217 · statt Rohtext {"veraltet_pct":null,…}: je Unterfeld eine
           Zeile, leere fallen weg, Felder aus dem Abgleich auch */
        Object.keys(v).forEach(function (k2) {
          var v2 = v[k2];
          if (v2 === null || v2 === undefined || v2 === '' || typeof v2 === 'object' || ZIEL[k2]) return;
          zeilen.push('<tr><td>' + _esc(NAMEN[k2] || k2.replace(/_/g, ' ')) + '</td><td class="num">' + _esc(typeof v2 === 'number' ? _fmt(v2) : String(v2)) + '</td></tr>');
        });
        return;
      }
      if (typeof v === 'object') {
        text = v.length + ' Einträge';
      } else {
        text = (typeof v === 'number') ? _fmt(v) : String(v);
      }
      if (ZIEL[k] && !VERGLEICHSFELDER[k]) return;   /* v2217: steht im Abgleich */
      var eigen = '';
      /* v2217 · der Vergleich braucht die zweite Zahl: was DealPilot selbst
         rechnet (Anlage 2, im Objekt unter _rnd). Ohne sie ist er keiner. */
      if (k === 'rnd_jahre') {
        var r = (window._currentObjData || {})._rnd;
        if (r && _zahl(r.rnd_jahre) !== null) eigen = 'DealPilot: ' + _fmt(Math.round(_zahl(r.rnd_jahre) * 10) / 10) + ' Jahre' + (r.gnd_jahre ? ' (GND ' + r.gnd_jahre + ')' : '');
      }
      var zeile = '<tr><td>' + _esc(VERGLEICHSFELDER[k] || NAMEN[k] || k.replace(/_/g, ' ')) + '</td>'
                + '<td class="num">' + _esc(text) + '</td>' + (VERGLEICHSFELDER[k] ? '<td class="num" style="color:#7A7370">' + _esc(eigen) + '</td>' : '') + '</tr>';
      if (VERGLEICHSFELDER[k]) vergleich.push(zeile); else zeilen.push(zeile);
    });

    var html = '';

    if (!a.rechenbar && (a.fehlende_pflichtfelder || []).length) {
      html += '<div class="dpdi-warn"><strong>Fehlende Pflichtangaben:</strong> '
            + _esc(a.fehlende_pflichtfelder.join(', '))
            + '. Ohne sie wird nicht gerechnet — eine Zahl aus Standardwerten '
            + 'saehe richtig aus und wäre es nicht.</div>';
    }

    if ((a.verworfene_werte || []).length) {
      html += '<div class="dpdi-warn"><strong>Unplausible Werte verworfen:</strong> '
            + a.verworfene_werte.map(function (v) {
                return _esc(v.feld) + ' = ' + _esc(v.wert) + ' (erwartet ' + _esc(v.erwartet) + ')';
              }).join(' · ')
            + '</div>';
    }

    var abg = _abgleich(ext);
    if (abg.length) {
      var nAbw = abg.filter(function (z) { return z.status === 'abweichung'; }).length;
      var objekt = window._currentObjKey ? 'diesem Objekt' : 'dem offenen Formular';
      html += '<h3 class="dpdi-h3">Abgleich mit ' + objekt + '</h3>'
        + (nAbw ? '<div class="dpdi-warn"><strong>' + nAbw + (nAbw === 1 ? ' Angabe weicht' : ' Angaben weichen') + ' vom Objekt ab.</strong> '
            + 'Sie sind nicht vorgehakt — hak sie an, wenn das Dokument recht hat.</div>' : '')
        + '<table class="dpdi-table" id="dpdi-abgleich"><tr><th></th><th>Feld</th><th>im Dokument</th><th>im Objekt</th></tr>'
        + abg.map(function (z) {
            var farbe = z.status === 'abweichung' ? ' style="background:rgba(217,164,65,.14)"' : '';
            var stat = z.status === 'gleich' ? '<span style="color:#3FA56C">gleich</span>' : z.status === 'neu' ? '<span style="color:#7A7370">leer</span>' : '<b style="color:#b5651d">' + _esc(z.ist) + '</b>';
            return '<tr' + farbe + '><td><input type="checkbox" data-feld="' + _esc(z.feld) + '"' + (z.status === 'neu' ? ' checked' : '') + (z.status === 'gleich' ? ' disabled' : '') + '></td>'
              + '<td>' + _esc(z.wort) + '</td><td class="num">' + _esc(z.anzeige) + '</td><td class="num">' + stat + '</td></tr>';
          }).join('') + '</table>'
        + (abg.some(function (z) { return z.status !== 'gleich'; })
            ? '<div class="dpdi-actions" style="margin-top:8px"><button type="button" class="dpdi-btn" id="dpdi-uebernehmen">Ausgewählte übernehmen</button></div>'
            : '<p class="dpdi-hinweis">Alles, was im Objekt schon steht, stimmt mit dem Dokument überein.</p>');
    }

    if (zeilen.length) {
      html += '<h3 class="dpdi-h3">Weitere gelesene Angaben</h3>'
            + '<table class="dpdi-table">' + zeilen.join('') + '</table>';
    }

    if (vergleich.length) {
      html += '<h3 class="dpdi-h3">Ergebnis des fremden Gutachtens</h3>'
            + '<table class="dpdi-table dpdi-table-vgl">' + vergleich.join('') + '</table>'
            + '<p class="dpdi-hinweis">Diese Werte werden <strong>nicht übernommen</strong>. '
            + 'DealPilot rechnet selbst — sie dienen dem Abgleich. Eine übernommene Zahl, '
            + 'die niemand gegenprueft, ist eine Behauptung.</p>';
    }

    html += '<div class="dpdi-actions">'
         +   '<button type="button" class="dpdi-btn dpdi-btn-sec" id="dpdi-json">Rohdaten anzeigen</button>'
         + '</div>'
         + '<pre class="dpdi-json" id="dpdi-json-out" hidden>' + _esc(JSON.stringify(ext, null, 2)) + '</pre>';

    res.hidden = false;
    res.innerHTML = html;

    var ub = document.getElementById('dpdi-uebernehmen');
    if (ub) ub.addEventListener('click', function () {
      var n = _uebernehmen(abg);
      ub.disabled = true; ub.textContent = n ? ('✓ ' + n + ' übernommen') : 'Nichts ausgewählt';
      try { if (typeof toast === 'function') toast('✓ ' + n + ' Angaben aus ' + (a.label || 'dem Dokument') + ' übernommen'); } catch (e) {}
    });
    var b = document.getElementById('dpdi-json');
    if (b) b.addEventListener('click', function () {
      var o = document.getElementById('dpdi-json-out');
      if (o) o.hidden = !o.hidden;
    });
  }

  /* v2218h · Marcel 14.10.2026: „das neue Dokumenten-Einlesen sollten wir
     herausnehmen und mit über PDF/Marktbericht-Import integrieren." Der Import
     in object-actions.js ruft dieselbe Auslese und denselben Abgleich - ohne
     dieses Fenster. Eine Auslese, ein Abgleich, zwei Eingänge. */
  async function lesenText(text, dateiname, typ) {
    return await Auth.apiCall('/ai/extract-dokument', {
      method: 'POST',
      /* v3016 · 45.000 statt 15.000 Zeichen: ein WEG-Protokoll mit 10 Seiten hat ~28.000, die
         Beschlüsse zur Sanierung standen hinter Zeichen 15.000 */
      body: { text: String(text || '').slice(0, 45000), dateiname: dateiname || '', typ: typ || undefined }
    });
  }
  function vergleich(ext) {
    var aus = [];
    Object.keys(VERGLEICHSFELDER).forEach(function (k) {
      var v = (ext || {})[k];
      if (v === null || v === undefined || v === '') return;
      var eigen = '';
      if (k === 'rnd_jahre') {
        var r = (window._currentObjData || {})._rnd;
        if (r && _zahl(r.rnd_jahre) !== null) eigen = _fmt(Math.round(_zahl(r.rnd_jahre) * 10) / 10) + ' Jahre' + (r.gnd_jahre ? ' (GND ' + r.gnd_jahre + ')' : '');
      }
      aus.push({ feld: k, wort: VERGLEICHSFELDER[k], wert: (typeof v === 'number' ? _fmt(v) : String(v)), eigen: eigen });
    });
    return aus;
  }

  window.DokumentImport = {
    oeffnen: oeffnen,
    schliessen: schliessen,
    letztes: function () { return _letzter; },
    lesenText: lesenText,
    abgleich: _abgleich,
    vergleich: vergleich
  };

})();
