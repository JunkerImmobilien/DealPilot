/* v3163 · VORERST NICHT EINGEBUNDEN. Marcel 03.11.2026: „lesen wir die nur aus und verwerfen die später … dann haben
   wir die Mietverträge nicht auf unserem Server“. Datei und Server-Teil (routes/dateien.js) bleiben für den Fall, dass
   eine Ablage gewünscht wird; index.html lädt die Datei nicht, der Eingang legt nichts ab.
   dateiablage.js — v3162 · UNTERLAGEN-ABLAGE JE OBJEKT (Ordner mit Unterordnern)
   ───────────────────────────────────────────────────────────────────────────
   Marcel 03.11.2026: „auf unserem Server speichern … Struktur Ordner mit Unterordnern möglich?“
   Backend: routes/dateien.js (verschlüsselt, Grenzen je Plan). Hier:
     · DpAblage.html()      Karte für Pilot-Analyse › Unterlagen & WEG (füllt sich selbst)
     · DpAblage.ablegen()   eine Datei in einen Ordner des Objekts (vom Eingang und Beleg-Leser genutzt)
     · DpAblage.ordnerFuer() Standardordner je Dokumentart
   Ordner sind Pfade („Rechnungen/2026/Reisekosten“); ein leerer Ordner entsteht, sobald etwas hineinkommt. */
(function () {
  'use strict';
  if (window.DpAblage) return;

  var STANDARD = ['Kauf & Objekt', 'Finanzierung', 'Mietverträge', 'WEG', 'Steuer', 'Rechnungen', 'Bewertung', 'Sonstiges'];
  var _offen = {}, _ziel = '', _scharf = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mb(b) { return b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function obj() { return window._currentObjKey || null; }
  function token() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function basis() { return (typeof window.getApiBase === 'function') ? window.getApiBase() : '/api/v1'; }

  /** Standardordner je Dokumentart (Eingang): typ = rechnung | expose | market | dokument; label = erkannte Art */
  function ordnerFuer(typ, label, jahr) {
    var l = String(label || '').toLowerCase(), j = jahr ? '/' + jahr : '';
    if (typ === 'rechnung') return 'Rechnungen' + (jahr ? '/' + jahr : '/ohne Jahr');
    if (typ === 'expose') return 'Kauf & Objekt/Exposé';
    if (typ === 'market') return 'Bewertung';
    if (/mietvertrag|mieterliste|mietaufstellung/.test(l)) return 'Mietverträge';
    if (/wirtschaftsplan|hausgeld|abrechnung|protokoll|eigentümerversammlung|weg/.test(l)) return 'WEG' + j;
    if (/grundbuch|teilung|flurkarte|liegenschaft|baulast|energieausweis|kaufvertrag|auflassung/.test(l)) return 'Kauf & Objekt';
    if (/gutachten|wertermittlung|restnutzungsdauer/.test(l)) return 'Bewertung';
    if (/darlehen|finanzierung|bank|grundschuld/.test(l)) return 'Finanzierung';
    if (/steuer|bescheid/.test(l)) return 'Steuer' + j;
    return 'Sonstiges';
  }

  /** Eine Datei ablegen. opts = { objekt, ordner, quelle, meta, name } → Antwort des Servers (oder { fehler }) */
  function ablegen(file, opts) {
    opts = opts || {};
    var o = opts.objekt !== undefined ? opts.objekt : obj();
    var fd = new FormData();
    fd.append('datei', file, opts.name || file.name || 'Datei');
    if (o) fd.append('objekt', o);
    fd.append('ordner', opts.ordner || 'Sonstiges');
    fd.append('quelle', opts.quelle || 'upload');
    if (opts.meta) fd.append('meta', JSON.stringify(opts.meta));
    return fetch(basis() + '/dateien', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }, body: fd })
      .then(function (r) { return r.json().then(function (j) { return r.ok ? j : { fehler: (j && j.error) || ('Fehler ' + r.status), status: r.status }; }); })
      .catch(function () { return { fehler: 'Netzwerkfehler' }; });
  }
  /** mehrere Dateien nacheinander; gibt { ok, doppelt, fehler:[] } zurück */
  function ablegenAlle(liste, opts) {
    var erg = { ok: 0, doppelt: 0, fehler: [] }, i = 0;
    return new Promise(function (fertig) {
      (function weiter() {
        if (i >= liste.length) return fertig(erg);
        var x = liste[i++];
        ablegen(x.file, Object.assign({}, opts || {}, { ordner: x.ordner || (opts && opts.ordner) })).then(function (r) {
          if (r && r.fehler) erg.fehler.push((x.file.name || 'Datei') + ': ' + r.fehler); else if (r && r.doppelt) erg.doppelt++; else erg.ok++;
          weiter();
        });
      })();
    });
  }

  function baum(dateien) {
    var wurzel = { kinder: {}, dateien: [] };
    dateien.forEach(function (d) {
      var k = wurzel;
      (d.ordner ? d.ordner.split('/') : []).forEach(function (t) { k = (k.kinder[t] = k.kinder[t] || { kinder: {}, dateien: [] }); });
      k.dateien.push(d);
    });
    return wurzel;
  }
  function alleOrdner(dateien) {
    var s = {};
    STANDARD.forEach(function (o) { s[o] = 1; });
    dateien.forEach(function (d) { var p = ''; (d.ordner ? d.ordner.split('/') : []).forEach(function (t) { p = p ? p + '/' + t : t; s[p] = 1; }); });
    return Object.keys(s).sort(function (a, b) { return a.localeCompare(b, 'de'); });
  }

  function knopf(t, attr, art) {
    return '<button type="button" ' + attr + ' style="font:600 11.5px/1 inherit;padding:4px 8px;border-radius:6px;cursor:pointer;margin-left:4px;background:transparent;'
      + (art === 'rot' ? 'border:1px solid rgba(184,98,92,.55);color:#B8625C' : 'border:1px solid rgba(42,39,39,.25);color:inherit') + '">' + t + '</button>';
  }
  function zweigHtml(k, pfad, tiefe) {
    var h = '';
    Object.keys(k.kinder).sort(function (a, b) { return a.localeCompare(b, 'de'); }).forEach(function (t) {
      var p = pfad ? pfad + '/' + t : t, kind = k.kinder[t];
      var n = (function zaehl(x) { return x.dateien.length + Object.keys(x.kinder).reduce(function (a, c) { return a + zaehl(x.kinder[c]); }, 0); })(kind);
      h += '<details data-pfad="' + esc(p) + '"' + (_offen[p] ? ' open' : '') + ' style="margin-left:' + (tiefe ? 16 : 0) + 'px">'
        + '<summary style="cursor:pointer;padding:4px 0;font-weight:600">📁 ' + esc(t) + ' <span style="font-weight:400;opacity:.6">(' + n + ')</span>'
        + knopf('hierhin hochladen', 'data-ab-ziel="' + esc(p) + '"') + '</summary>' + zweigHtml(kind, p, tiefe + 1) + '</details>';
    });
    k.dateien.forEach(function (d) {
      h += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-left:' + (tiefe ? 16 : 0) + 'px;padding:3px 0;border-bottom:1px solid rgba(0,0,0,.05)">'
        + '<span style="flex:1;min-width:160px">📄 ' + esc(d.name) + ' <span style="opacity:.6;font-size:12px">· ' + mb(Number(d.groesse) || 0) + ' · '
        + esc(new Date(d.created_at).toLocaleDateString('de-DE')) + (d.quelle && d.quelle !== 'upload' ? ' · aus ' + esc(d.quelle === 'eingang' ? 'dem Eingang' : d.quelle === 'beleg' ? 'dem Beleg-Leser' : d.quelle) : '') + '</span></span>'
        + knopf('Öffnen', 'data-ab-oeffnen="' + esc(d.id) + '" data-ab-name="' + esc(d.name) + '"')
        + knopf('Verschieben', 'data-ab-schieben="' + esc(d.id) + '"')
        + knopf(_scharf === d.id ? 'Wirklich löschen?' : 'Löschen', 'data-ab-loeschen="' + esc(d.id) + '"', 'rot') + '</div>';
    });
    return h;
  }

  var _stand = null, _liste = [];
  function fuellen() {
    var host = document.getElementById('dp-ablage'); if (!host) return;
    var o = obj();
    if (!o) { host.innerHTML = '<p class="dp-pa-p">Erst ein Objekt speichern, dann können Unterlagen abgelegt werden.</p>'; return; }
    if (!window.Auth || typeof Auth.apiCall !== 'function') return;
    Promise.all([Auth.apiCall('/dateien?objekt=' + encodeURIComponent(o)), Auth.apiCall('/dateien/speicher')]).then(function (r) {
      _liste = (r[0] && r[0].dateien) || []; _stand = r[1] || null;
      zeichnen();
    }, function (e) { host.innerHTML = '<p class="dp-pa-p" style="color:#B8625C">Ablage nicht erreichbar: ' + esc(e && e.message || '') + '</p>'; });
  }
  function zeichnen() {
    var host = document.getElementById('dp-ablage'); if (!host) return;
    var s = _stand, pct = s && s.grenze_bytes ? Math.min(100, Math.round(s.belegt_bytes / s.grenze_bytes * 100)) : 0;
    var ordner = alleOrdner(_liste);
    var h = '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px">'
      + '<label style="font-size:12.5px">Zielordner <input list="dp-ablage-ordner" data-ab-zielfeld value="' + esc(_ziel) + '" placeholder="z. B. Mietverträge/Whg. 1" style="min-width:220px;padding:5px 7px;border:1px solid #ddd;border-radius:6px"></label>'
      + '<datalist id="dp-ablage-ordner">' + ordner.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>'
      + knopf('Dateien hochladen', 'data-ab-dateien') + knopf('Ordner hochladen (mit Unterordnern)', 'data-ab-ordner')
      + '<input type="file" multiple data-ab-input-dateien style="display:none"><input type="file" multiple webkitdirectory directory data-ab-input-ordner style="display:none">'
      + '</div>'
      + (s ? '<div style="font-size:12px;opacity:.75;margin-bottom:8px">Belegt ' + mb(s.belegt_bytes) + ' von ' + mb(s.grenze_bytes) + ' (Plan ' + esc(s.plan) + ', ' + pct + ' %) · Dateien höchstens 25 MB · verschlüsselt auf unserem Server in Deutschland</div>'
          + '<div style="height:5px;background:rgba(0,0,0,.08);border-radius:3px;margin-bottom:10px"><div style="height:5px;width:' + pct + '%;background:' + (pct > 90 ? '#B8625C' : 'var(--wl-c9a84c,#C9A84C)') + ';border-radius:3px"></div></div>' : '')
      + '<div data-ab-meldung style="font-size:12.5px;margin-bottom:6px"></div>'
      + (_liste.length ? zweigHtml(baum(_liste), '', 0) : '<p class="dp-pa-p" style="opacity:.75">Noch keine Unterlagen abgelegt. Was über „Belege, Unterlagen & Rechnungen einlesen“ übernommen wird, landet automatisch hier – sortiert in Ordner.</p>');
    host.innerHTML = h;
  }
  function meldung(t, rot) { var m = document.querySelector('#dp-ablage [data-ab-meldung]'); if (m) { m.textContent = t; m.style.color = rot ? '#B8625C' : ''; } }

  function hochladenListe(files, mitPfad) {
    var ziel = String(_ziel || '').trim() || 'Sonstiges';
    var liste = [].slice.call(files).map(function (f) {
      var rel = mitPfad && f.webkitRelativePath ? f.webkitRelativePath.split('/').slice(0, -1).join('/') : '';
      return { file: f, ordner: rel ? ziel + '/' + rel : ziel };
    });
    if (!liste.length) return;
    meldung('Lade ' + liste.length + ' Datei(en) hoch …');
    ablegenAlle(liste, { quelle: 'upload' }).then(function (e) {
      meldung(e.ok + ' abgelegt' + (e.doppelt ? ', ' + e.doppelt + ' schon vorhanden' : '') + (e.fehler.length ? ' · Fehler: ' + e.fehler.join('; ') : ''), !!e.fehler.length);
      setTimeout(fuellen, 300);
    });
  }

  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (!d || !d.matches || !d.matches('#dp-ablage details[data-pfad]')) return;
    _offen[d.getAttribute('data-pfad')] = d.open;
  }, true);
  document.addEventListener('input', function (ev) { if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-ab-zielfeld')) _ziel = ev.target.value; });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.closest || !t.closest('#dp-ablage')) return;
    if (t.hasAttribute('data-ab-input-dateien')) { hochladenListe(t.files, false); t.value = ''; }
    if (t.hasAttribute('data-ab-input-ordner')) { hochladenListe(t.files, true); t.value = ''; }
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('#dp-ablage button') : null; if (!t) return;
    var host = document.getElementById('dp-ablage');
    if (t.hasAttribute('data-ab-dateien')) { host.querySelector('[data-ab-input-dateien]').click(); return; }
    if (t.hasAttribute('data-ab-ordner')) { host.querySelector('[data-ab-input-ordner]').click(); return; }
    if (t.hasAttribute('data-ab-ziel')) {
      ev.preventDefault(); _ziel = t.getAttribute('data-ab-ziel');
      var f = host.querySelector('[data-ab-zielfeld]'); if (f) f.value = _ziel;
      host.querySelector('[data-ab-input-dateien]').click(); return;
    }
    if (t.hasAttribute('data-ab-oeffnen')) {
      var id = t.getAttribute('data-ab-oeffnen'), name = t.getAttribute('data-ab-name');
      fetch(basis() + '/dateien/' + id, { headers: { Authorization: 'Bearer ' + token() } }).then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
        if (!b) { meldung('Datei konnte nicht geladen werden.', true); return; }
        var url = URL.createObjectURL(b);
        if (/^(application\/pdf|image\/)/.test(b.type)) window.open(url, '_blank', 'noopener');
        else { var a = document.createElement('a'); a.href = url; a.download = name || 'Datei'; document.body.appendChild(a); a.click(); a.remove(); }
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      });
      return;
    }
    if (t.hasAttribute('data-ab-schieben')) {
      var id2 = t.getAttribute('data-ab-schieben'), zeile = t.parentNode;
      if (zeile.querySelector('[data-ab-neuordner]')) return;
      var w = document.createElement('span');
      w.innerHTML = '<input list="dp-ablage-ordner" data-ab-neuordner placeholder="Ordner" style="padding:4px 6px;border:1px solid #ddd;border-radius:6px;margin-left:6px">' + knopf('OK', 'data-ab-schieben-ok="' + esc(id2) + '"');
      zeile.appendChild(w); w.querySelector('input').focus();
      return;
    }
    if (t.hasAttribute('data-ab-schieben-ok')) {
      var id3 = t.getAttribute('data-ab-schieben-ok'), inp = t.parentNode.querySelector('[data-ab-neuordner]');
      Auth.apiCall('/dateien/' + id3, { method: 'PATCH', body: { ordner: inp ? inp.value : '' } }).then(function () { _offen[inp ? inp.value : ''] = true; fuellen(); }, function () { meldung('Verschieben fehlgeschlagen.', true); });
      return;
    }
    if (t.hasAttribute('data-ab-loeschen')) {
      var id4 = t.getAttribute('data-ab-loeschen');
      if (_scharf !== id4) { _scharf = id4; t.textContent = 'Wirklich löschen?'; setTimeout(function () { if (_scharf === id4) { _scharf = null; zeichnen(); } }, 6000); return; }
      _scharf = null;
      Auth.apiCall('/dateien/' + id4, { method: 'DELETE' }).then(fuellen, function () { meldung('Löschen fehlgeschlagen.', true); });
    }
  });

  /** Karte für die Pilot-Analyse; füllt sich nach dem Zeichnen selbst */
  function html() {
    setTimeout(fuellen, 0);
    return '<div id="dp-ablage"><p class="dp-pa-p" style="opacity:.7">Ablage wird geladen …</p></div>';
  }

  window.DpAblage = { VERSION: 'v3162', html: html, fuellen: fuellen, ablegen: ablegen, ablegenAlle: ablegenAlle, ordnerFuer: ordnerFuer, STANDARD: STANDARD };
})();
