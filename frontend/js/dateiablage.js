/* dateiablage.js — v4860 · MEINE DOKUMENTE (Dokumentenablage je Objekt)
   ─────────────────────────────────────────────────────────────────────────────────────────────────────────
   Marcel 25.11.2026: „Die Dokumentenablage für den Kunden macht ja schon Sinn … Kann der Kunde dann sehen, welche
   Belege er da hat und die auch gegebenenfalls pro Jahr dann wieder löschen?“ — freigegeben: „machst du fertig“.
   Vorlage: design/Vorschläge/dokumentenablage-2026-11-25.md. Server: routes/dateien.js, services/dateiAblage.js
   (AES-256-GCM, Grenzen je Plan: Free keine Ablage · Starter 500 MB · Investor 1 GB · Pro 3 GB · Business 25 GB ·
   Partner 5 GB, Datei höchstens 20 MB).
     · DpAblage.html()          Karte „Meine Dokumente“ in Haus & Unterlagen (füllt sich selbst), je Jahr gruppiert
     · DpAblage.ablegen()       eine Datei ablegen (vom Eingang und der Quick-Check-Übergabe, Häkchen „Original aufbewahren“)
     · DpAblage.stand()         Speicherstand (Promise, gemerkt), darf_ablegen = Plan mit Ablage
     · DpAblage.oeffnen(id)     Original ansehen bzw. herunterladen (aus dem Verlauf „Eingelesen und übernommen“)
     · DpAblage.loeschenDatei() eine Datei löschen (vom Verlauf, nach Rückfrage)
     · DpAblage.bestaetigen()   Rückfrage-Fenster: schließt nie per Klick daneben, nur Knopf, × oder Esc
   v3162 (Ordner, Hochladen) bleibt erhalten. */
(function () {
  'use strict';
  if (window.DpAblage) return;

  /* v4910 · Ordner wie in der Verwaltung (Einstellungen › Dokumente); das Jahr steht in meta.jahr, nicht im Ordnernamen */
  var STANDARD = ['Belege', 'Mietverträge', 'Protokolle', 'Energieausweis', 'Exposé', 'Kauf & Objekt', 'Bewertung', 'Finanzierung', 'Steuer', 'Sonstiges'];
  var _offen = {}, _ziel = '', _standP = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mb(b) { b = Number(b) || 0; return b >= 1073741824 ? (b / 1073741824).toFixed(1).replace('.', ',') + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function obj() { return window._currentObjKey || null; }
  function token() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function basis() { return (typeof window.getApiBase === 'function') ? window.getApiBase() : '/api/v1'; }
  function datum(d) { try { return new Date(d).toLocaleDateString('de-DE'); } catch (e) { return ''; } }

  /** Standardordner je Dokumentart (Eingang): typ = rechnung | expose | market | dokument; label = erkannte Art */
  /** Standardordner je Dokumentart (v4910 · ohne Jahr im Namen, das Jahr steht in meta.jahr) */
  function ordnerFuer(typ, label) {
    var l = String(label || '').toLowerCase();
    if (typ === 'rechnung' || /rechnung|beleg|quittung/.test(l)) return 'Belege';
    if (/energieausweis/.test(l)) return 'Energieausweis';
    if (/mietvertrag|mieterliste|mietaufstellung/.test(l)) return 'Mietverträge';
    if (/protokoll|eigentümerversammlung|wirtschaftsplan|hausgeld|abrechnung|weg/.test(l)) return 'Protokolle';
    if (typ === 'market' || /gutachten|wertermittlung|restnutzungsdauer|marktbericht/.test(l)) return 'Bewertung';
    if (/grundbuch|teilung|flurkarte|liegenschaft|baulast|kaufvertrag|auflassung/.test(l)) return 'Kauf & Objekt';
    if (/darlehen|finanzierung|bank|grundschuld/.test(l)) return 'Finanzierung';
    if (/steuer|bescheid/.test(l)) return 'Steuer';
    if (typ === 'expose' || /expos/.test(l)) return 'Exposé';
    return 'Sonstiges';
  }
  /** v4910 · Belegjahr aus den gelesenen Daten einer Unterlage (Jahr, Rechnungsdatum, Belegdatum …), sonst null */
  function jahrAus(o) {
    var gefunden = null;
    (function such(x, tiefe) {
      if (gefunden || !x || typeof x !== 'object' || tiefe > 3) return;
      ['jahr', 'abrechnungsjahr', 'rechnungsdatum', 'belegdatum', 'datum', 'stichtag'].some(function (k) {
        var v = x[k]; if (v == null || typeof v === 'object') return false;
        var m = String(v).match(/(19|20|21)[0-9]{2}/); if (m) { gefunden = Number(m[0]); return true; } return false;
      });
      if (!gefunden) Object.keys(x).forEach(function (k) { if (x[k] && typeof x[k] === 'object' && !(x[k] instanceof Blob)) such(x[k], tiefe + 1); });
    })(o, 0);
    return gefunden;
  }
  /** v4910 · Belegung als kleine Zeile mit Balken (Marcel 25.11.2026: „wie viel ihre Ablage schon voll ist“).
      Ab 80 % rot, „verwalten“ öffnet Einstellungen › Dokumente. opt.zeile = schmal in einer Zeile, opt.ohneLink */
  function belegungHtml(s, opt) {
    opt = opt || {};
    if (!s || !s.grenze_bytes) return '';
    var pct = s.belegt_pct != null ? Number(s.belegt_pct) : Math.min(100, Math.round(s.belegt_bytes / s.grenze_bytes * 100));
    var warn = pct >= 80, farbe = warn ? '#B8625C' : 'var(--wl-c9a84c,#C9A84C)';
    var p = String(Math.round(pct));
    return '<div class="dp-ab-belegung" style="font-size:12px;' + (opt.zeile ? 'display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;' : 'margin-bottom:10px;') + '">'
      + '<span' + (warn ? ' style="color:#9E4943;font-weight:600"' : ' style="opacity:.8"') + '>Ablage ' + p + ' % · ' + mb(s.belegt_bytes) + ' von ' + mb(s.grenze_bytes) + (warn ? ', bald voll' : '') + '</span>'
      + '<span style="display:' + (opt.zeile ? 'inline-block;width:70px' : 'block;width:100%;margin:4px 0') + ';height:5px;background:rgba(0,0,0,.08);border-radius:3px"><span style="display:block;height:5px;width:' + Math.max(2, Math.min(100, pct)) + '%;background:' + farbe + ';border-radius:3px"></span></span>'
      + (opt.ohneLink ? '' : '<a href="#" data-ab-verwalten style="color:inherit;text-decoration:underline;font-size:12px">verwalten</a>') + '</div>';
  }
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('[data-ab-verwalten]') : null; if (!a) return;
    ev.preventDefault();
    try { if (typeof window.showSettings === 'function') window.showSettings('dokumente'); } catch (e) {}
  });

  /** Speicherstand, einmal je Sitzung geholt (neu = true holt frisch) */
  function stand(neu) {
    if (_standP && !neu) return _standP;
    if (!window.Auth || typeof Auth.apiCall !== 'function') return Promise.resolve(null);
    _standP = Auth.apiCall('/dateien/speicher').then(function (s) { return s || null; }, function () { _standP = null; return null; });
    return _standP;
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
  /** mehrere Dateien nacheinander; gibt { ok, doppelt, fehler:[], ids:{name:id} } zurück */
  function ablegenAlle(liste, opts) {
    var erg = { ok: 0, doppelt: 0, fehler: [], ids: {} }, i = 0;
    return new Promise(function (fertig) {
      (function weiter() {
        if (i >= liste.length) { _standP = null; return fertig(erg); }
        var x = liste[i++];
        ablegen(x.file, Object.assign({}, opts || {}, { ordner: x.ordner || (opts && opts.ordner), meta: x.meta || (opts && opts.meta) })).then(function (r) {
          if (r && r.fehler) erg.fehler.push((x.file.name || 'Datei') + ': ' + r.fehler);
          else { if (r && r.doppelt) erg.doppelt++; else erg.ok++; if (r && r.id) erg.ids[x.name || x.file.name] = r.id; }
          weiter();
        });
      })();
    });
  }

  /* ── Rückfrage-Fenster (Marcel 24.11.: nie per Klick daneben schließen; DealPilot-Design, Whitelabel) ── */
  function bestaetigen(titel, text, knoepfe) {
    knoepfe = knoepfe || [{ wert: true, text: 'Löschen', rot: true }, { wert: false, text: 'Abbrechen' }];
    return new Promise(function (fertig) {
      var ov = document.createElement('div');
      ov.className = 'dp-ab-ov';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
      ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(5,5,5,.55);display:flex;align-items:center;justify-content:center;padding:16px';
      var kn = knoepfe.map(function (k, i) {
        return '<button type="button" data-ab-wahl="' + i + '" style="font:600 13px/1 inherit;padding:10px 14px;border-radius:8px;cursor:pointer;'
          + (k.rot ? 'background:#B8625C;color:#fff;border:1px solid #B8625C' : k.haupt ? 'background:var(--wl-c9a84c,#C9A84C);color:#050505;border:1px solid var(--wl-c9a84c,#C9A84C)' : 'background:transparent;color:inherit;border:1px solid rgba(42,39,39,.25)')
          + '">' + esc(k.text) + '</button>';
      }).join('');
      ov.innerHTML = '<div style="background:#FDFCFA;color:#050505;max-width:440px;width:100%;border-radius:14px;border-top:3px solid var(--wl-c9a84c,#C9A84C);box-shadow:0 18px 48px rgba(0,0,0,.35);padding:20px 20px 16px;font-family:Inter,system-ui,sans-serif;position:relative">'
        + '<button type="button" data-ab-wahl="x" aria-label="Schließen" style="position:absolute;top:10px;right:12px;border:0;background:transparent;font-size:20px;cursor:pointer;color:inherit">×</button>'
        + '<div style="font:600 16px/1.3 \'Space Grotesk\',Inter,sans-serif;margin:0 24px 8px 0">' + esc(titel) + '</div>'
        + '<div style="font-size:13.5px;line-height:1.5;margin-bottom:16px">' + text + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">' + kn + '</div></div>';
      function zu(w) { document.removeEventListener('keydown', taste, true); try { ov.remove(); } catch (e) {} fertig(w); }
      function taste(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); zu(false); } }
      ov.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-ab-wahl]') : null; if (!b) return;   /* Klick daneben: nichts */
        var i = b.getAttribute('data-ab-wahl');
        zu(i === 'x' ? false : knoepfe[Number(i)].wert);
      });
      document.addEventListener('keydown', taste, true);
      document.body.appendChild(ov);
      var letzter = ov.querySelector('[data-ab-wahl="' + (knoepfe.length - 1) + '"]'); if (letzter) letzter.focus();
    });
  }

  function oeffnen(id, name) {
    return fetch(basis() + '/dateien/' + id, { headers: { Authorization: 'Bearer ' + token() } }).then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
      if (!b) { try { if (window.toast) window.toast('Die Datei liegt nicht mehr in der Ablage.'); } catch (e) {} return false; }
      var url = URL.createObjectURL(b);
      if (/^(application\/pdf|image\/)/.test(b.type)) window.open(url, '_blank', 'noopener');
      else { var a = document.createElement('a'); a.href = url; a.download = name || 'Datei'; document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      return true;
    });
  }
  function loeschenDatei(id) {
    if (!window.Auth) return Promise.resolve(false);
    return Auth.apiCall('/dateien/' + id, { method: 'DELETE' }).then(function () { _standP = null; return true; }, function () { return false; });
  }

  function knopf(t, attr, art) {
    return '<button type="button" ' + attr + ' style="font:600 11.5px/1 inherit;padding:5px 9px;border-radius:6px;cursor:pointer;margin-left:4px;background:transparent;'
      + (art === 'rot' ? 'border:1px solid rgba(184,98,92,.55);color:#B8625C' : art === 'gold' ? 'border:1px solid var(--wl-c9a84c,#C9A84C);color:inherit' : 'border:1px solid rgba(42,39,39,.25);color:inherit') + '">' + t + '</button>';
  }
  function artName(d) {
    var q = d.quelle; if (q === 'eingang') return 'eingelesen'; if (q === 'quickcheck') return 'aus dem Quick-Check'; if (q === 'beleg') return 'Beleg'; return 'hochgeladen';
  }
  function zeileHtml(d) {
    return '<div class="dp-ab-zeile" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 0;border-bottom:1px solid rgba(0,0,0,.06)">'
      + '<span style="flex:1 1 200px;min-width:0;overflow-wrap:anywhere"><b style="font-weight:600">' + esc(d.name) + '</b>'
      + '<span style="display:block;opacity:.65;font-size:12px">' + esc(d.ordner || 'Sonstiges') + ' · ' + mb(d.groesse) + ' · ' + esc(datum(d.created_at)) + ' · ' + esc(artName(d)) + '</span></span>'
      + knopf('Ansehen', 'data-ab-oeffnen="' + esc(d.id) + '" data-ab-name="' + esc(d.name) + '"')
      + knopf('Verschieben', 'data-ab-schieben="' + esc(d.id) + '"')
      + knopf('Löschen', 'data-ab-loeschen="' + esc(d.id) + '" data-ab-name="' + esc(d.name) + '"', 'rot') + '</div>';
  }

  var _stand = null, _liste = [];
  function fuellen() {
    var host = document.getElementById('dp-ablage'); if (!host) return;
    var o = obj();
    if (!o) { host.innerHTML = '<p class="dp-pa-p">Erst das Objekt speichern, dann können Unterlagen abgelegt werden.</p>'; return; }
    if (!window.Auth || typeof Auth.apiCall !== 'function') return;
    Promise.all([Auth.apiCall('/dateien?objekt=' + encodeURIComponent(o)), stand(true)]).then(function (r) {
      _liste = (r[0] && r[0].dateien) || []; _stand = r[1] || null;
      zeichnen();
    }, function () { host.innerHTML = '<p class="dp-pa-p" style="color:#B8625C">Ablage nicht erreichbar.</p>'; });
  }
  function zeichnen() {
    var host = document.getElementById('dp-ablage'); if (!host) return;
    var s = _stand, darf = !!(s && s.darf_ablegen && s.bereit !== false);
    var pct = s && s.grenze_bytes ? Math.min(100, Math.round(s.belegt_bytes / s.grenze_bytes * 100)) : 0;
    var jahre = {};
    _liste.forEach(function (d) { var j = d.jahr || 'ohne Jahr'; (jahre[j] = jahre[j] || []).push(d); });
    var reihe = Object.keys(jahre).sort(function (a, b) { return String(b).localeCompare(String(a), 'de', { numeric: true }); });
    var h = '';
    if (s && !s.darf_ablegen) {
      h += '<div style="font-size:13px;padding:10px 12px;border-radius:8px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 10%, transparent);border-left:3px solid var(--wl-c9a84c,#C9A84C);margin-bottom:10px">'
        + 'Die Dokumentenablage gibt es ab dem Plan Starter. Eingelesene Unterlagen werden ausgelesen, das Original wird nicht gespeichert.'
        + (_liste.length ? ' Deine vorhandenen Dateien kannst du weiter ansehen und herunterladen' + (s.loeschung_am ? ', bis zum ' + esc(datum(s.loeschung_am)) + '. Danach werden sie gelöscht.' : '.') : '') + '</div>';
    }
    if (darf) {
      h += '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">'
        + '<label style="font-size:12.5px">Ordner <input list="dp-ablage-ordner" data-ab-zielfeld value="' + esc(_ziel) + '" placeholder="z. B. Mietverträge" style="min-width:180px;padding:5px 7px;border:1px solid #ddd;border-radius:6px"></label>'
        + '<datalist id="dp-ablage-ordner">' + STANDARD.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>'
        + knopf('Dateien hochladen', 'data-ab-dateien', 'gold')
        + '<input type="file" multiple data-ab-input-dateien style="display:none"></div>';
    }
    if (s && s.grenze_bytes) h += belegungHtml(s) + '<div style="font-size:11.5px;opacity:.65;margin:-4px 0 10px">Je Datei höchstens ' + mb(s.max_datei_bytes) + ' · verschlüsselt auf unserem Server in Deutschland</div>';
    h += '<div data-ab-meldung style="font-size:12.5px;margin-bottom:6px"></div>';
    if (!_liste.length) {
      h += '<p class="dp-pa-p" style="opacity:.75">' + (darf ? 'Noch keine Unterlagen abgelegt. Beim Einlesen bleibt das Original mit dem Häkchen „Original aufbewahren“ hier liegen.' : 'Keine Dateien abgelegt.') + '</p>';
    } else {
      reihe.forEach(function (j) {
        var l = jahre[j], g = l.reduce(function (a, d) { return a + (Number(d.groesse) || 0); }, 0);
        var auf = _offen[j] !== undefined ? _offen[j] : j === reihe[0];
        h += '<details data-ab-jahr="' + esc(j) + '"' + (auf ? ' open' : '') + ' style="border:1px solid rgba(42,39,39,.12);border-radius:10px;padding:6px 10px;margin-bottom:8px">'
          + '<summary style="cursor:pointer;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:600;padding:4px 0">'
          + '<span style="flex:1">' + esc(j) + ' <span style="font-weight:400;opacity:.65">· ' + l.length + (l.length === 1 ? ' Datei' : ' Dateien') + ' · ' + mb(g) + '</span></span>'
          + (j !== 'ohne Jahr' ? knopf('Jahr löschen', 'data-ab-jahr-loeschen="' + esc(j) + '" data-ab-anzahl="' + l.length + '"', 'rot') : '')
          + '</summary>' + l.map(zeileHtml).join('') + '</details>';
      });
    }
    host.innerHTML = h;
  }
  function meldung(t, rot) { var m = document.querySelector('#dp-ablage [data-ab-meldung]'); if (m) { m.textContent = t; m.style.color = rot ? '#B8625C' : ''; } }

  function hochladenListe(files) {
    var ziel = String(_ziel || '').trim() || 'Sonstiges';
    var liste = [].slice.call(files).map(function (f) { return { file: f, ordner: ziel, meta: { jahr: new Date().getFullYear() } }; });
    if (!liste.length) return;
    meldung('Lade ' + liste.length + (liste.length === 1 ? ' Datei' : ' Dateien') + ' hoch …');
    ablegenAlle(liste, { quelle: 'upload' }).then(function (e) {
      meldung(e.ok + ' abgelegt' + (e.doppelt ? ', ' + e.doppelt + ' schon vorhanden' : '') + (e.fehler.length ? '. Nicht abgelegt: ' + e.fehler.join(', ') : ''), !!e.fehler.length);
      setTimeout(fuellen, 300);
    });
  }

  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (!d || !d.matches || !d.matches('#dp-ablage details[data-ab-jahr]')) return;
    _offen[d.getAttribute('data-ab-jahr')] = d.open;
  }, true);
  document.addEventListener('input', function (ev) { if (ev.target && ev.target.hasAttribute && ev.target.hasAttribute('data-ab-zielfeld')) _ziel = ev.target.value; });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.closest || !t.closest('#dp-ablage')) return;
    if (t.hasAttribute('data-ab-input-dateien')) { hochladenListe(t.files); t.value = ''; }
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('#dp-ablage button') : null; if (!t) return;
    var host = document.getElementById('dp-ablage');
    if (t.hasAttribute('data-ab-dateien')) { host.querySelector('[data-ab-input-dateien]').click(); return; }
    if (t.hasAttribute('data-ab-oeffnen')) { oeffnen(t.getAttribute('data-ab-oeffnen'), t.getAttribute('data-ab-name')); return; }
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
      Auth.apiCall('/dateien/' + id3, { method: 'PATCH', body: { ordner: inp ? inp.value : '' } }).then(fuellen, function () { meldung('Verschieben hat nicht geklappt.', true); });
      return;
    }
    if (t.hasAttribute('data-ab-loeschen')) {
      ev.preventDefault();
      var id4 = t.getAttribute('data-ab-loeschen');
      bestaetigen('Datei löschen?', '„' + esc(t.getAttribute('data-ab-name')) + '“ wird endgültig aus der Ablage gelöscht. Werte, die aus der Datei übernommen wurden, bleiben im Objekt stehen.')
        .then(function (ja) { if (ja) loeschenDatei(id4).then(function (ok) { if (!ok) meldung('Löschen hat nicht geklappt.', true); fuellen(); }); });
      return;
    }
    if (t.hasAttribute('data-ab-jahr-loeschen')) {
      ev.preventDefault(); ev.stopPropagation();
      var j = t.getAttribute('data-ab-jahr-loeschen'), n = t.getAttribute('data-ab-anzahl');
      bestaetigen('Alle Dateien aus ' + j + ' löschen?', n + (n === '1' ? ' Datei wird' : ' Dateien werden') + ' endgültig aus der Ablage dieses Objekts gelöscht. Übernommene Werte bleiben im Objekt stehen.', [{ wert: true, text: 'Jahr löschen', rot: true }, { wert: false, text: 'Abbrechen' }])
        .then(function (ja) {
          if (!ja) return;
          Auth.apiCall('/dateien?objekt=' + encodeURIComponent(obj()) + '&jahr=' + encodeURIComponent(j), { method: 'DELETE' }).then(function (r) { _standP = null; meldung((r && r.geloescht) + ' gelöscht.'); fuellen(); }, function () { meldung('Löschen hat nicht geklappt.', true); });
        });
    }
  });

  /** Karte „Meine Dokumente“; füllt sich nach dem Zeichnen selbst */
  function html() {
    setTimeout(fuellen, 0);
    return '<div id="dp-ablage"><p class="dp-pa-p" style="opacity:.7">Ablage wird geladen …</p></div>';
  }

  /* ── v4910 · Einstellungen › Dokumente: Objekt › Ordner › Jahr (Marcel 25.11.2026) ── */
  var _vHost = null, _vListe = [], _vStand = null, _vOffen = {};
  function verwaltung(host) {
    _vHost = host || _vHost; if (!_vHost) return;
    _vHost.innerHTML = '<p class="dp-pa-p" style="opacity:.7">Ablage wird geladen …</p>';
    if (!window.Auth || typeof Auth.apiCall !== 'function') return;
    Promise.all([Auth.apiCall('/dateien'), stand(true)]).then(function (r) {
      _vListe = (r[0] && r[0].dateien) || []; _vStand = r[1] || null; vZeichnen();
    }, function () { _vHost.innerHTML = '<p class="dp-pa-p" style="color:#9E4943">Ablage nicht erreichbar.</p>'; });
  }
  function basisOrdner(o) { return String(o || 'Sonstiges').split('/')[0] || 'Sonstiges'; }
  function summe(l) { return l.reduce(function (a, d) { return a + (Number(d.groesse) || 0); }, 0); }
  function vZeichnen() {
    if (!_vHost) return;
    var s = _vStand, h = '<div id="dp-ablage-verw">';
    if (s && s.grenze_bytes) h += belegungHtml(s, { ohneLink: true });
    else if (s && !s.darf_ablegen) h += '<p class="dp-pa-p" style="font-size:13px">Die Dokumentenablage gibt es ab dem Plan Starter.' + (s.loeschung_am ? ' Vorhandene Dateien bleiben bis zum ' + esc(datum(s.loeschung_am)) + ' lesbar.' : '') + '</p>';
    h += '<div data-ab-meldung style="font-size:12.5px;margin-bottom:6px"></div>';
    if (!_vListe.length) { _vHost.innerHTML = h + '<p class="dp-pa-p" style="opacity:.75">Noch keine Dokumente abgelegt. Beim Einlesen von Unterlagen bleibt das Original mit dem Häkchen „Original aufbewahren“ hier liegen.</p></div>'; return; }
    var obj = {};
    _vListe.forEach(function (d) {
      var k = d.object_id || '-';
      var o = obj[k] = obj[k] || { name: d.objekt_name || (d.object_id ? 'Objekt' : 'Ohne Objekt'), id: d.object_id || '', ordner: {} };
      var b = basisOrdner(d.ordner), j = d.jahr || 'ohne Jahr';
      o.ordner[b] = o.ordner[b] || {};
      (o.ordner[b][j] = o.ordner[b][j] || []).push(d);
    });
    Object.keys(obj).sort(function (a, b) { return obj[a].name.localeCompare(obj[b].name, 'de'); }).forEach(function (k) {
      var o = obj[k], alle = [];
      Object.keys(o.ordner).forEach(function (b) { Object.keys(o.ordner[b]).forEach(function (j) { alle = alle.concat(o.ordner[b][j]); }); });
      var schl = 'o:' + k;
      h += '<details data-v-key="' + esc(schl) + '"' + (_vOffen[schl] ? ' open' : '') + ' style="border:1px solid rgba(42,39,39,.14);border-radius:10px;padding:6px 10px;margin-bottom:8px">'
        + '<summary style="cursor:pointer;font-weight:600;padding:4px 0">' + esc(o.name) + ' <span style="font-weight:400;opacity:.65">· ' + alle.length + (alle.length === 1 ? ' Datei' : ' Dateien') + ' · ' + mb(summe(alle)) + '</span></summary>';
      STANDARD.concat(Object.keys(o.ordner).filter(function (b) { return STANDARD.indexOf(b) < 0; })).forEach(function (b) {
        var jm = o.ordner[b]; if (!jm) return;
        var inOrd = []; Object.keys(jm).forEach(function (j) { inOrd = inOrd.concat(jm[j]); });
        var sk = schl + '|' + b;
        h += '<details data-v-key="' + esc(sk) + '"' + (_vOffen[sk] ? ' open' : '') + ' style="margin:4px 0 4px 8px">'
          + '<summary style="cursor:pointer;padding:3px 0">' + esc(b) + ' <span style="opacity:.65">· ' + inOrd.length + ' · ' + mb(summe(inOrd)) + '</span>'
          + (o.id ? knopf('Ordner löschen', 'data-v-gruppe="1" data-v-objekt="' + esc(o.id) + '" data-v-ordner="' + esc(b) + '" data-v-anzahl="' + inOrd.length + '"', 'rot') : '') + '</summary>';
        Object.keys(jm).sort(function (x, y) { return String(y).localeCompare(String(x), 'de', { numeric: true }); }).forEach(function (j) {
          var l = jm[j];
          h += '<div style="margin:2px 0 6px 10px"><div style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;padding:3px 0"><span style="flex:1">' + esc(j) + ' <span style="font-weight:400;opacity:.65">· ' + l.length + '</span></span>'
            + (o.id && j !== 'ohne Jahr' ? knopf('Jahr löschen', 'data-v-gruppe="1" data-v-objekt="' + esc(o.id) + '" data-v-ordner="' + esc(b) + '" data-v-jahr="' + esc(j) + '" data-v-anzahl="' + l.length + '"', 'rot') : '') + '</div>'
            + l.map(zeileHtml).join('') + '</div>';
        });
        h += '</details>';
      });
      h += '</details>';
    });
    _vHost.innerHTML = h + '<datalist id="dp-ablage-ordner-v">' + STANDARD.map(function (x) { return '<option value="' + esc(x) + '">'; }).join('') + '</datalist></div>';
  }
  document.addEventListener('toggle', function (ev) {
    var d = ev.target; if (!d || !d.matches || !d.matches('#dp-ablage-verw details[data-v-key]')) return;
    _vOffen[d.getAttribute('data-v-key')] = d.open;
  }, true);
  function vMeldung(t, rot) { var m = document.querySelector('#dp-ablage-verw [data-ab-meldung]'); if (m) { m.textContent = t; m.style.color = rot ? '#9E4943' : ''; } }
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('#dp-ablage-verw button') : null; if (!t) return;
    ev.preventDefault(); ev.stopPropagation();
    if (t.hasAttribute('data-ab-oeffnen')) { oeffnen(t.getAttribute('data-ab-oeffnen'), t.getAttribute('data-ab-name')); return; }
    if (t.hasAttribute('data-ab-schieben')) {
      var zeile = t.parentNode, id2 = t.getAttribute('data-ab-schieben'); if (zeile.querySelector('[data-ab-neuordner]')) return;
      var w = document.createElement('span');
      w.innerHTML = '<input list="dp-ablage-ordner-v" data-ab-neuordner placeholder="Ordner" style="padding:4px 6px;border:1px solid #ddd;border-radius:6px;margin-left:6px">' + knopf('OK', 'data-v-schieben-ok="' + esc(id2) + '"');
      zeile.appendChild(w); w.querySelector('input').focus(); return;
    }
    if (t.hasAttribute('data-v-schieben-ok')) {
      var inp = t.parentNode.querySelector('[data-ab-neuordner]');
      Auth.apiCall('/dateien/' + t.getAttribute('data-v-schieben-ok'), { method: 'PATCH', body: { ordner: inp ? inp.value : '' } }).then(function () { verwaltung(); }, function () { vMeldung('Verschieben hat nicht geklappt.', true); });
      return;
    }
    if (t.hasAttribute('data-ab-loeschen')) {
      var id4 = t.getAttribute('data-ab-loeschen');
      bestaetigen('Datei löschen?', '„' + esc(t.getAttribute('data-ab-name')) + '“ wird endgültig aus der Ablage gelöscht. Werte, die aus der Datei übernommen wurden, bleiben im Objekt stehen.')
        .then(function (ja) { if (ja) loeschenDatei(id4).then(function (ok) { if (!ok) vMeldung('Löschen hat nicht geklappt.', true); verwaltung(); }); });
      return;
    }
    if (t.hasAttribute('data-v-gruppe')) {
      var o = t.getAttribute('data-v-objekt'), ord = t.getAttribute('data-v-ordner'), j = t.getAttribute('data-v-jahr'), n = t.getAttribute('data-v-anzahl');
      var was = j ? 'Ordner „' + ord + '“, Jahr ' + j : 'Ordner „' + ord + '“';
      bestaetigen(esc(was) + ' löschen?', n + (n === '1' ? ' Datei wird' : ' Dateien werden') + ' endgültig aus der Ablage dieses Objekts gelöscht. Übernommene Werte bleiben im Objekt stehen.', [{ wert: true, text: 'Löschen', rot: true }, { wert: false, text: 'Abbrechen' }])
        .then(function (ja) {
          if (!ja) return;
          var q = '/dateien?objekt=' + encodeURIComponent(o) + '&ordner=' + encodeURIComponent(ord) + (j ? '&jahr=' + encodeURIComponent(j) : '');
          Auth.apiCall(q, { method: 'DELETE' }).then(function (r) { _standP = null; vMeldung((r && r.geloescht) + ' gelöscht.'); verwaltung(); }, function () { vMeldung('Löschen hat nicht geklappt.', true); });
        });
    }
  }, true);

  window.DpAblage = { VERSION: 'v4910', html: html, verwaltung: verwaltung, belegungHtml: belegungHtml, jahrAus: jahrAus, fuellen: fuellen, ablegen: ablegen, ablegenAlle: ablegenAlle, ordnerFuer: ordnerFuer, stand: stand,
    oeffnen: oeffnen, loeschenDatei: loeschenDatei, bestaetigen: bestaetigen, STANDARD: STANDARD };
})();
