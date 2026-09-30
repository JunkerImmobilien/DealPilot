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
    gebaeudeanteil_pct_laut_gutachten: 'Gebaeudeanteil laut Gutachten',
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

  async function oeffnen() {
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
      +     '<span class="dpdi-drop-text">PDF auswaehlen</span>'
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
              + 'Texterkennung ist fuer diesen Weg noch nicht eingebaut.', 'warn');
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
    _status('Die Art liess sich nicht sicher bestimmen — bitte auswaehlen.', 'warn');
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
      if (typeof v === 'object') {
        text = Array.isArray(v) ? (v.length + ' Eintraege') : JSON.stringify(v);
      } else {
        text = (typeof v === 'number') ? _fmt(v) : String(v);
      }
      var zeile = '<tr><td>' + _esc(VERGLEICHSFELDER[k] || k) + '</td>'
                + '<td class="num">' + _esc(text) + '</td></tr>';
      if (VERGLEICHSFELDER[k]) vergleich.push(zeile); else zeilen.push(zeile);
    });

    var html = '';

    if (!a.rechenbar && (a.fehlende_pflichtfelder || []).length) {
      html += '<div class="dpdi-warn"><strong>Fehlende Pflichtangaben:</strong> '
            + _esc(a.fehlende_pflichtfelder.join(', '))
            + '. Ohne sie wird nicht gerechnet — eine Zahl aus Standardwerten '
            + 'saehe richtig aus und waere es nicht.</div>';
    }

    if ((a.verworfene_werte || []).length) {
      html += '<div class="dpdi-warn"><strong>Unplausible Werte verworfen:</strong> '
            + a.verworfene_werte.map(function (v) {
                return _esc(v.feld) + ' = ' + _esc(v.wert) + ' (erwartet ' + _esc(v.erwartet) + ')';
              }).join(' · ')
            + '</div>';
    }

    if (zeilen.length) {
      html += '<h3 class="dpdi-h3">Gelesene Angaben</h3>'
            + '<table class="dpdi-table">' + zeilen.join('') + '</table>';
    }

    if (vergleich.length) {
      html += '<h3 class="dpdi-h3">Ergebnis des fremden Gutachtens</h3>'
            + '<table class="dpdi-table dpdi-table-vgl">' + vergleich.join('') + '</table>'
            + '<p class="dpdi-hinweis">Diese Werte werden <strong>nicht uebernommen</strong>. '
            + 'DealPilot rechnet selbst — sie dienen dem Abgleich. Eine uebernommene Zahl, '
            + 'die niemand gegenprueft, ist eine Behauptung.</p>';
    }

    html += '<div class="dpdi-actions">'
         +   '<button type="button" class="dpdi-btn dpdi-btn-sec" id="dpdi-json">Rohdaten anzeigen</button>'
         + '</div>'
         + '<pre class="dpdi-json" id="dpdi-json-out" hidden>' + _esc(JSON.stringify(ext, null, 2)) + '</pre>';

    res.hidden = false;
    res.innerHTML = html;

    var b = document.getElementById('dpdi-json');
    if (b) b.addEventListener('click', function () {
      var o = document.getElementById('dpdi-json-out');
      if (o) o.hidden = !o.hidden;
    });
  }

  window.DokumentImport = {
    oeffnen: oeffnen,
    schliessen: schliessen,
    letztes: function () { return _letzter; }
  };

})();
