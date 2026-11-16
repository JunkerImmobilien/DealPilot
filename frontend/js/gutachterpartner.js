/* ════════════════════════════════════════════════════════════════════
   v3540 · RESTNUTZUNGSDAUER BEIM UNABHAENGIGEN GUTACHTERPARTNER
   ════════════════════════════════════════════════════════════════════
   Marcel 16.11.2026. Reiter Steuer › AfA-Satz „Eigenen Satz / Restnutzungsdauer
   eingeben …“ › Box mit den RND-Knoepfen (js/afa-eigen.js). Dort zwei Wege:
     „Ersteinschätzung (Gutachterpartner)“  Formular remaining-useful-life-lite,
                                            Ergebnis sofort: RND + AfA-%, auf Klick uebernehmen
     „Gutachten beauftragen (Gutachterpartner)“  remaining-useful-life, Entwurf, Unterlagen,
                                            kostenpflichtig nur nach Bestaetigung
   Das Formular kommt vom Partner (Backend /api/v1/gutachterpartner, Abbildung in
   js/gutachterpartner-abbildung.js). Sichtbar nur, wenn /status freigeschaltet meldet
   (Admin oder Zusatz „gutachterpartner“). Nach aussen nie der Anbietername.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var A = function () { return window.DpGutachterAbbildung; };
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var _status = null, _statusLaeuft = null;
  var st = null;   /* Zustand des offenen Fensters */

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function N(t) { return esc(A().neutral(t)); }
  function api(pfad, opt) { return window.Auth.apiCall('/gutachterpartner' + pfad, Object.assign({ timeout: 60000 }, opt || {})); }
  function hatToken() { try { return !!(window.Auth && window.Auth.apiCall && localStorage.getItem('ji_token')); } catch (e) { return false; } }

  function status() {
    if (_status) return Promise.resolve(_status);
    if (_statusLaeuft) return _statusLaeuft;
    if (!hatToken()) return Promise.resolve({ freigeschaltet: false });
    _statusLaeuft = api('/status').then(function (s) { _status = s || { freigeschaltet: false }; return _status; })
      .catch(function () { return { freigeschaltet: false }; }).then(function (s) { _statusLaeuft = null; return s; });
    return _statusLaeuft;
  }

  /* ── Knoepfe in die RND-Box (js/afa-eigen.js) ───────────────────── */
  function einbauen() {
    var reihe = document.querySelector('#afa-eigen-box .afa-rnd-knoepfe');
    if (!reihe) return false;
    if (el('gp-lite')) return true;
    status().then(function (s) {
      if (!s || !s.freigeschaltet || el('gp-lite')) return;
      var titel = s.konfiguriert ? '' : 'Die Anbindung an den Gutachterpartner ist noch nicht eingerichtet.';
      [['gp-lite', 'Ersteinschätzung (Gutachterpartner)', 'lite'], ['gp-voll', 'Gutachten beauftragen (Gutachterpartner)', 'voll']].forEach(function (k) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'btn btn-outline btn-sm'; b.id = k[0]; b.textContent = k[1];
        if (!s.konfiguriert) { b.disabled = true; b.title = titel; }
        b.onclick = function () { oeffnen(k[2]); };
        reihe.appendChild(b);
      });
    });
    return true;
  }
  function start() { if (!einbauen()) setTimeout(start, 600); }
  window.addEventListener('dp:object-ready', function () { setTimeout(einbauen, 300); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ── Daten aus dem Objekt und den Einstellungen ─────────────────── */
  function wert(id) { var e = el(id); return e ? String(e.value || '').trim() : ''; }
  function objektDaten() {
    var mod = {};
    ['dach', 'fenster', 'leitungen', 'heizung', 'aussenwand', 'baeder', 'innenausbau', 'grundriss'].forEach(function (k) { var v = wert('mod_' + k); if (v) mod[k] = v; });
    return { objart: wert('objart'), str: wert('str'), hnr: wert('hnr'), plz: wert('plz'), ort: wert('ort'), baujahr: wert('baujahr'), wfl: wert('wfl'), mod: mod };
  }
  function nutzerDaten() {
    var s = {}; try { s = (window.Settings && window.Settings.get) ? window.Settings.get() : {}; } catch (e) {}
    var n = A().nameTeilen(s.user_name || ''), a = A().strasseTeilen(s.pdf_address || '');
    var sess = null; try { sess = window.Auth && Auth.getSession ? Auth.getSession() : null; } catch (e) {}
    var email = s.pdf_email || (sess && sess.email) || '';
    if (!n.nachname && sess && sess.name) n = A().nameTeilen(sess.name);
    return { vorname: n.vorname, nachname: n.nachname, email: email, telefon: s.pdf_phone || '', firma: s.user_company || '',
      str: a.str, hnr: a.hnr, plz: s.pdf_plz || '', ort: s.pdf_city || '' };
  }
  function objektId() { var k = window._currentObjKey; return k && UUID.test(String(k)) ? String(k) : null; }
  /* Angaben zur anfragenden Person merken (nur dieser Browser) — beim naechsten Mal vorbelegt */
  var MERK = 'dp_gp_anfragender';
  function merkenLesen() { try { return JSON.parse(localStorage.getItem(MERK) || '{}') || {}; } catch (e) { return {}; } }
  function merkenSchreiben(data) { try { if (data && data.requester) localStorage.setItem(MERK, JSON.stringify({ requester: data.requester })); } catch (e) {} }

  /* ── Fenster ────────────────────────────────────────────────────── */
  function fenster(titel) {
    schliessen();
    var o = document.createElement('div'); o.id = 'gp-overlay';
    o.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(5,5,5,.55);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px';
    o.innerHTML = '<div id="gp-fenster" role="dialog" aria-modal="true" style="background:var(--surface,#FDFCFA);color:var(--text,#2A2727);width:min(760px,100%);border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.35);padding:18px 20px 16px;font-size:13.5px;line-height:1.45">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><div style="font-weight:700;font-size:17px">' + esc(titel) + '</div>'
      + '<div style="font-size:12px;color:var(--muted,#7A7370)">über unseren unabhängigen Gutachterpartner</div></div>'
      + '<button type="button" class="btn btn-ghost btn-sm" id="gp-zu" aria-label="Schließen">✕</button></div>'
      + '<div id="gp-inhalt" style="margin-top:12px">lädt …</div></div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (e) { if (e.target === o) schliessen(); });
    el('gp-zu').onclick = schliessen;
    document.addEventListener('keydown', escZu);
    return el('gp-inhalt');
  }
  function escZu(e) { if (e.key === 'Escape') schliessen(); }
  function schliessen() { var o = el('gp-overlay'); if (o) o.remove(); document.removeEventListener('keydown', escZu); }

  var STATUS_TEXT = { draft: 'Entwurf', received: 'eingegangen', initialAssessment: 'Ersteinschätzung liegt vor', ordered: 'beauftragt' };
  function datum(d) { try { return new Date(d).toLocaleDateString('de-DE'); } catch (e) { return ''; } }
  function zahl(n, d) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }

  function oeffnen(art) {
    var inhalt = fenster(art === 'lite' ? 'Ersteinschätzung der Restnutzungsdauer' : 'Restnutzungsdauer-Gutachten beauftragen');
    st = { art: art, def: null, rid: null, gesendet: {}, unterlagen: [] };
    var oid = objektId();
    Promise.all([
      api('/formular/' + art),
      api('/anfragen' + (oid ? '?objekt=' + oid : '')).catch(function () { return { anfragen: [] }; }),
      (art === 'voll' && oid) ? window.Auth.apiCall('/dateien?objekt=' + oid).catch(function () { return { dateien: [] }; }) : Promise.resolve({ dateien: [] })
    ]).then(function (r) {
      st.def = (r[0] && r[0].data) || null;
      st.unterlagen = (r[2] && r[2].dateien) || [];
      if (!st.def || !st.def.ui) { inhalt.innerHTML = '<p>Das Formular des Gutachterpartners ist gerade nicht lesbar.</p>'; return; }
      zeichnen(inhalt, (r[1] && r[1].anfragen || []).filter(function (a) { return !oid || a.objekt_id === oid; }));
    }).catch(function (e) {
      inhalt.innerHTML = '<p style="color:#B8625C">' + N((e && e.message) || 'Fehler') + '</p>';
    });
  }

  function listeHtml(liste) {
    if (!liste.length) return '';
    return '<details id="gp-liste" style="margin:0 0 12px;border:1px solid var(--line,#E6E0D3);border-radius:8px;padding:8px 10px"' + (liste.length ? '' : '') + '>'
      + '<summary style="cursor:pointer;font-weight:600">Bisherige Anfragen zu diesem Objekt (' + liste.length + ')</summary>'
      + liste.map(function (a) {
        var r = a.result || {};
        return '<div class="gp-zeile" data-rid="' + esc(a.request_id) + '" style="display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:6px 0;border-top:1px solid var(--line,#E6E0D3)">'
          + '<span>' + esc(datum(a.created_at)) + ' · ' + (a.art === 'lite' ? 'Ersteinschätzung' : 'Gutachten') + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '') + '</span>'
          + '<span style="color:var(--muted,#7A7370)">' + esc(STATUS_TEXT[a.status] || a.status || '') + (a.umgebung === 'test' ? ' · Testumgebung' : '') + '</span>'
          + (r.finalAverageRUL ? '<b>RND ' + zahl(r.finalAverageRUL) + ' Jahre · AfA ' + zahl(r.annualDepreciation, 2) + ' %</b>' : '')
          + '<span style="flex:1"></span>'
          + '<button type="button" class="btn btn-outline btn-sm" data-gp="stand">Stand abrufen</button>'
          + (r.finalAverageRUL ? '<button type="button" class="btn btn-outline btn-sm" data-gp="uebernehmen" data-rnd="' + esc(r.finalAverageRUL) + '" data-datum="' + esc(datum(a.created_at)) + '">Als RND übernehmen</button>' : '')
          + '</div>';
      }).join('') + '</details>';
  }

  function feldHtml(f, i) {
    var a = A(), p = a.feldPfad(f), opts = a.optionen(f, st.def.schema), id = 'gp-f' + i;
    var lab = '<label for="' + id + '" style="display:block;font-size:12px;font-weight:600;margin-bottom:3px">' + N(f.label) + '</label>';
    var hilfe = f.helpText ? '<div style="font-size:11.5px;color:var(--muted,#7A7370);margin-top:2px">' + N(f.helpText) + '</div>' : '';
    var ph = f.placeholder ? ' placeholder="' + N(f.placeholder) + '"' : '';
    var eing;
    if (f.inputType === 'select' || (opts.length && /^(text|number)$/.test(f.inputType) === false && f.inputType !== 'radio' && f.inputType !== 'multiselect' && f.inputType !== 'checkbox' && f.inputType !== 'file' && f.inputType !== 'array' && f.inputType !== 'textarea')) {
      eing = '<select id="' + id + '" style="width:100%"><option value="">– bitte wählen –</option>' + opts.map(function (o) { return '<option value="' + esc(o.value) + '">' + N(o.label) + '</option>'; }).join('') + '</select>';
    } else if (f.inputType === 'radio') {
      eing = '<div id="' + id + '" style="display:flex;gap:14px;flex-wrap:wrap">' + opts.map(function (o, k) { return '<label style="font-weight:400"><input type="radio" name="' + id + '" value="' + esc(o.value) + '" id="' + id + '-' + k + '"> ' + N(o.label) + '</label>'; }).join('') + '</div>';
    } else if (f.inputType === 'multiselect') {
      eing = '<div id="' + id + '" style="display:flex;gap:6px 14px;flex-wrap:wrap">' + opts.map(function (o) { return '<label style="font-weight:400"><input type="checkbox" data-mehr="1" value="' + esc(o.value) + '"> ' + N(o.label) + '</label>'; }).join('') + '</div>';
    } else if (f.inputType === 'checkbox') {
      return '<div class="gp-feld" data-i="' + i + '" style="margin:8px 0"><label style="font-weight:400"><input type="checkbox" id="' + id + '"> ' + N(f.label) + '</label>' + hilfe + '<div class="gp-fehler" style="color:#B8625C;font-size:12px"></div></div>';
    } else if (f.inputType === 'textarea' || f.inputType === 'array') {
      eing = '<textarea id="' + id + '" rows="' + (f.inputType === 'array' ? 3 : 2) + '" style="width:100%"' + ph + '></textarea>'
        + (f.inputType === 'array' ? '<div style="font-size:11.5px;color:var(--muted,#7A7370)">Liste als JSON, z. B. [{"…": "…"}]</div>' : '');
    } else if (f.inputType === 'file') {
      eing = '<select id="' + id + '" style="width:100%"><option value="">– keine Unterlage –</option>'
        + st.unterlagen.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc((d.ordner ? d.ordner + ' / ' : '') + d.name) + '</option>'; }).join('')
        + '</select><input type="file" id="' + id + '-datei" style="margin-top:4px;font-size:12px"><div style="font-size:11.5px;color:var(--muted,#7A7370)">aus den Objektunterlagen wählen oder vom Gerät hochladen</div>';
    } else {
      var typ = f.inputType === 'email' ? 'email' : f.inputType === 'phone' ? 'tel' : f.inputType === 'date' ? 'date' : 'text';
      eing = '<input id="' + id + '" type="' + typ + '"' + (f.inputType === 'number' ? ' inputmode="decimal"' : '') + ph + ' style="width:100%">';
    }
    return '<div class="gp-feld" data-i="' + i + '" data-pfad="' + esc(p) + '" style="margin:8px 0">' + lab + eing + hilfe + '<div class="gp-fehler" style="color:#B8625C;font-size:12px"></div></div>';
  }

  function zeichnen(inhalt, liste) {
    var a = A(), gruppen = a.felder(st.def), alle = [];
    var html = listeHtml(liste);
    html += '<div id="gp-formular">';
    gruppen.forEach(function (g) {
      html += '<fieldset style="border:1px solid var(--line,#E6E0D3);border-radius:8px;padding:6px 12px 8px;margin:0 0 10px"><legend style="font-weight:700;padding:0 4px">' + N(g.label) + '</legend>'
        + (g.description ? '<div style="font-size:12px;color:var(--muted,#7A7370)">' + N(g.description) + '</div>' : '')
        + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 14px">';
      g.fields.forEach(function (f) { html += feldHtml(f, alle.length); alle.push(f); });
      html += '</div></fieldset>';
    });
    html += '</div>';
    if (st.art === 'lite') {
      html += '<div class="cf-hint" style="margin:6px 0">Ersteinschätzung, kein Gutachten. Für einen eigenen AfA-Satz nach § 7 Abs. 4 Satz 2 EStG verlangt das Finanzamt ein Gutachten.</div>';
    } else {
      /* PLATZHALTER fuer Marcel: Preis und Bedingungen des Gutachtens (noch nicht entschieden, 16.11.2026) */
      html += '<label id="gp-kosten" style="display:block;margin:8px 0;padding:10px 12px;border:1px solid #B8625C;border-radius:8px;background:rgba(184,98,92,.06);font-weight:400">'
        + '<input type="checkbox" id="gp-kosten-ok"> <b>Kostenpflichtiger Auftrag.</b> Mit „Beauftragen“ entsteht beim unabhängigen Gutachterpartner ein kostenpflichtiger Auftrag für ein Restnutzungsdauer-Gutachten. '
        + 'Preis und Bedingungen: <i>[Platzhalter – Text folgt]</i>. Ich habe das verstanden und möchte beauftragen.</label>';
    }
    html += '<div id="gp-allgemein" style="color:#B8625C;font-size:12.5px;margin:6px 0"></div>'
      + '<div id="gp-ergebnis"></div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:8px">'
      + (st.art === 'voll' ? '<button type="button" class="btn btn-outline btn-sm" id="gp-entwurf">Entwurf speichern</button>' : '')
      + '<button type="button" class="btn btn-gold btn-sm" id="gp-senden">' + (st.art === 'lite' ? 'Ersteinschätzung anfordern' : 'Kostenpflichtig beauftragen') + '</button></div>';
    inhalt.innerHTML = html;
    st.felder = alle;

    /* vorbelegen: Objekt, Einstellungen, zuletzt gemerkte anfragende Person */
    var vor = a.vorbelegen(st.def, objektDaten(), nutzerDaten());
    var merk = merkenLesen();
    alle.forEach(function (f, i) {
      var p = a.feldPfad(f), w = a.holen(vor, p);
      if (w === undefined && /^requester\./.test(p)) w = a.holen(merk, p);
      if (w !== undefined) eingabeSetzen(f, i, w);
    });
    inhalt.addEventListener('input', aktualisieren);
    inhalt.addEventListener('change', aktualisieren);
    aktualisieren(); aktualisieren();
    var be = el('gp-entwurf'); if (be) be.onclick = function () { senden(false); };
    el('gp-senden').onclick = function () { senden(true); };
    inhalt.querySelectorAll('[data-gp="stand"]').forEach(function (b) { b.onclick = function () { standAbrufen(b.closest('.gp-zeile').getAttribute('data-rid'), b); }; });
    inhalt.querySelectorAll('[data-gp="uebernehmen"]').forEach(function (b) { b.onclick = function () { uebernehmen(b.getAttribute('data-rnd'), b.getAttribute('data-datum')); }; });
  }

  function eingabeSetzen(f, i, w) {
    var id = 'gp-f' + i, e = el(id);
    if (!e) return;
    if (f.inputType === 'radio') { e.querySelectorAll('input').forEach(function (r) { r.checked = String(r.value) === String(w); }); return; }
    if (f.inputType === 'multiselect') { var arr = Array.isArray(w) ? w.map(String) : [String(w)]; e.querySelectorAll('input').forEach(function (c) { c.checked = arr.indexOf(c.value) >= 0; }); return; }
    if (f.inputType === 'checkbox') { e.checked = !!w; return; }
    if (f.inputType === 'array') { e.value = JSON.stringify(w); return; }
    e.value = String(w);
  }
  function eingabeLesen(f, i) {
    var id = 'gp-f' + i, e = el(id);
    if (!e) return undefined;
    if (f.inputType === 'radio') { var r = e.querySelector('input:checked'); return r ? r.value : ''; }
    if (f.inputType === 'multiselect') return Array.prototype.map.call(e.querySelectorAll('input:checked'), function (c) { return c.value; });
    if (f.inputType === 'checkbox') return !!e.checked;
    if (f.inputType === 'array') { try { return e.value.trim() ? JSON.parse(e.value) : undefined; } catch (x) { return e.value; } }
    return e.value;
  }
  /* Daten aus den SICHTBAREN Feldern; Sichtbarkeit nach visibleWhen neu setzen */
  function lesen() {
    var werte = {};
    st.felder.forEach(function (f, i) {
      if (f.inputType === 'file') return;
      var box = document.querySelector('.gp-feld[data-i="' + i + '"]');
      if (box && box.hidden) return;
      var v = eingabeLesen(f, i); if (v !== undefined) werte[A().feldPfad(f)] = v;
    });
    return A().sammeln(st.def, werte);
  }
  function aktualisieren() {
    if (!st || !st.felder) return;
    var data = lesen();
    st.felder.forEach(function (f, i) { var box = document.querySelector('.gp-feld[data-i="' + i + '"]'); if (box) box.hidden = !A().sichtbar(f, data); });
  }

  function fehlerZeigen(e) {
    document.querySelectorAll('#gp-formular .gp-fehler').forEach(function (d) { d.textContent = ''; });
    var allg = el('gp-allgemein'); if (allg) allg.textContent = '';
    var d = (e && e.data) || {};
    var z = A().fehlerZuordnen(st.def, d.felder || []);
    var erstes = null;
    Object.keys(z.jeFeld).forEach(function (p) {
      st.felder.forEach(function (f, i) {
        if (A().feldPfad(f) !== p && f.id !== p) return;
        var box = document.querySelector('.gp-feld[data-i="' + i + '"]');
        if (!box || box.hidden) return;
        box.querySelector('.gp-fehler').textContent = A().neutral(z.jeFeld[p].join(' · '));
        if (!erstes) erstes = box;
      });
    });
    var texte = [A().neutral((e && e.message) || 'Fehler')].concat(z.allgemein.map(A().neutral));
    if (allg) allg.textContent = texte.join(' · ');
    if (erstes) erstes.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* Merge Patch: was zuletzt gesendet war und jetzt fehlt, wird ausdruecklich null */
  function mitNull(alt, neu) {
    var out = JSON.parse(JSON.stringify(neu || {}));
    (function lauf(a, n, o) {
      Object.keys(a || {}).forEach(function (k) {
        if (n && Object.prototype.hasOwnProperty.call(n, k)) {
          if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) && n[k] && typeof n[k] === 'object') lauf(a[k], n[k], o[k]);
        } else o[k] = null;
      });
    })(alt, neu, out);
    return out;
  }

  function dateienHochladen() {
    var auftraege = [];
    st.felder.forEach(function (f, i) {
      if (f.inputType !== 'file') return;
      var box = document.querySelector('.gp-feld[data-i="' + i + '"]'); if (box && box.hidden) return;
      var sel = el('gp-f' + i), inp = el('gp-f' + i + '-datei');
      var schl = f.id + '|' + (sel && sel.value) + '|' + (inp && inp.files && inp.files[0] ? inp.files[0].name + inp.files[0].size : '');
      if (st.hochgeladen && st.hochgeladen[schl]) return;
      if (inp && inp.files && inp.files[0]) {
        auftraege.push(function () {
          var fd = new FormData(); fd.append('datei', inp.files[0]); fd.append('fieldId', f.id);
          var basis = (typeof window.getApiBase === 'function') ? window.getApiBase() : '/api/v1';
          return fetch(basis + '/gutachterpartner/anfragen/' + encodeURIComponent(st.rid) + '/dateien',
            { method: 'POST', body: fd, headers: { Authorization: 'Bearer ' + localStorage.getItem('ji_token') } })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Upload fehlgeschlagen'); e.data = j; throw e; } (st.hochgeladen = st.hochgeladen || {})[schl] = 1; }); });
        });
      } else if (sel && sel.value) {
        auftraege.push(function () {
          return api('/anfragen/' + encodeURIComponent(st.rid) + '/dateien', { method: 'POST', body: { datei_id: sel.value, fieldId: f.id } })
            .then(function () { (st.hochgeladen = st.hochgeladen || {})[schl] = 1; });
        });
      }
    });
    return auftraege.reduce(function (p, fn) { return p.then(fn); }, Promise.resolve());
  }

  function senden(absenden) {
    var knopf = el('gp-senden'), ent = el('gp-entwurf');
    if (absenden && st.art === 'voll' && !(el('gp-kosten-ok') && el('gp-kosten-ok').checked)) {
      fehlerZeigen({ message: 'Bitte zuerst bestätigen, dass ein kostenpflichtiger Auftrag entsteht.' }); return;
    }
    var data = lesen();
    merkenSchreiben(data);
    [knopf, ent].forEach(function (b) { if (b) b.disabled = true; });
    var alt = knopf.textContent; knopf.textContent = 'wird gesendet …';
    var p;
    var bestaetigt = st.art === 'voll' && !!(el('gp-kosten-ok') && el('gp-kosten-ok').checked);
    var hatDateien = st.felder.some(function (f) { return f.inputType === 'file'; });
    if (!st.rid) {
      p = api('/anfragen', { method: 'POST', body: { art: st.art, objekt_id: objektId(), data: data, absenden: absenden && !hatDateien, kostenpflichtig_bestaetigt: bestaetigt } })
        .then(function (r) { st.rid = r.anfrage.request_id; st.gesendet = data; return r; });
    } else {
      p = api('/anfragen/' + encodeURIComponent(st.rid), { method: 'PATCH', body: { data: mitNull(st.gesendet, data) } })
        .then(function (r) { st.gesendet = data; return r; });
    }
    p.then(function (r) {
      if (!hatDateien && (!absenden || (r && r.anfrage && r.anfrage.status !== 'draft'))) return r;
      return dateienHochladen().then(function () {
        if (!absenden) return r;
        return api('/anfragen/' + encodeURIComponent(st.rid) + '/absenden', { method: 'POST', body: { kostenpflichtig_bestaetigt: bestaetigt } });
      });
    }).then(function (r) {
      fehlerZeigen({ message: '' }); el('gp-allgemein').textContent = '';
      ergebnisZeigen(r && r.anfrage, absenden);
    }).catch(function (e) {
      if (e && e.data && e.data.request_id) st.rid = e.data.request_id;
      fehlerZeigen(e);
    }).then(function () { [knopf, ent].forEach(function (b) { if (b) b.disabled = false; }); knopf.textContent = alt; });
  }

  function ergebnisZeigen(a, abgesendet) {
    var box = el('gp-ergebnis'); if (!box || !a) return;
    var r = a.result || {};
    if (a.formular === 'remaining-useful-life-lite' || st.art === 'lite') {
      if (r.finalAverageRUL) {
        box.innerHTML = '<div style="margin:10px 0;padding:12px 14px;border:1px solid var(--line,#E6E0D3);border-radius:10px;background:var(--card,#FBF6E9)">'
          + '<div style="font-size:12px;color:var(--muted,#7A7370)">Ersteinschätzung' + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '') + (a.umgebung === 'test' ? ' · Testumgebung' : '') + '</div>'
          + '<div style="display:flex;gap:28px;flex-wrap:wrap;margin:6px 0"><div><div style="font-size:26px;font-weight:700">' + zahl(r.finalAverageRUL) + ' Jahre</div><div style="font-size:12px">voraussichtliche Restnutzungsdauer' + (r.finalRangeRUL ? ' (Spanne ' + esc(r.finalRangeRUL) + ')' : '') + '</div></div>'
          + (r.annualDepreciation ? '<div><div style="font-size:26px;font-weight:700">' + zahl(r.annualDepreciation, 2) + ' %</div><div style="font-size:12px">jährliche AfA</div></div>' : '') + '</div>'
          + '<div class="cf-hint">Ersteinschätzung, kein Gutachten.</div>'
          + '<div style="margin-top:8px"><button type="button" class="btn btn-gold btn-sm" id="gp-uebernehmen">Als Restnutzungsdauer übernehmen</button></div></div>';
        el('gp-uebernehmen').onclick = function () { uebernehmen(r.finalAverageRUL, datum(a.updated_at || new Date())); };
      } else {
        box.innerHTML = '<div class="cf-hint" style="margin:8px 0">Anfrage ' + esc(a.request_number || '') + ' ist ' + esc(STATUS_TEXT[a.status] || a.status || '') + (r.status ? ' (Ergebnis: ' + esc(r.status) + ')' : '') + '. Ein Ergebnis liegt noch nicht vor — später über „Stand abrufen“.</div>';
      }
      return;
    }
    box.innerHTML = '<div class="cf-hint" style="margin:8px 0">' + (abgesendet ? 'Beauftragt' : 'Entwurf gespeichert') + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '')
      + ' · Stand: ' + esc(STATUS_TEXT[a.status] || a.status || '') + (a.umgebung === 'test' ? ' · Testumgebung' : '')
      + (a.attachments && a.attachments.length ? ' · ' + a.attachments.length + ' Unterlage(n)' : '') + '. Den Stand rufst du hier später über „Stand abrufen“ ab.</div>';
  }

  function standAbrufen(rid, knopf) {
    if (knopf) { knopf.disabled = true; knopf.textContent = 'fragt ab …'; }
    api('/anfragen/' + encodeURIComponent(rid)).then(function (r) {
      var a = r.anfrage || {}, res = a.result || {};
      var zeile = knopf && knopf.closest('.gp-zeile');
      if (zeile) {
        var sp = zeile.children[1]; if (sp) sp.textContent = (STATUS_TEXT[a.status] || a.status || '') + (a.umgebung === 'test' ? ' · Testumgebung' : '');
        if (res.finalAverageRUL && !zeile.querySelector('[data-gp="uebernehmen"]')) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn-outline btn-sm'; b.textContent = 'Als RND übernehmen';
          b.onclick = function () { uebernehmen(res.finalAverageRUL, datum(a.updated_at)); }; zeile.appendChild(b);
        }
      }
      if (knopf) knopf.textContent = 'aktuell';
    }).catch(function (e) { if (knopf) { knopf.textContent = 'Fehler'; knopf.title = A().neutral(e.message); } })
      .then(function () { if (knopf) knopf.disabled = false; });
  }

  /* Nur auf Klick: Ersteinschaetzung als eigene RND im Reiter Steuer (js/afa-eigen.js setzen()) */
  function uebernehmen(rnd, dat) {
    var n = Math.round(Number(rnd));
    if (!(n >= 3 && n <= 200) || !window.DpAfaEigen || !DpAfaEigen.setzen) return;
    var ok = DpAfaEigen.setzen(n, 'Ersteinschätzung unabhängiger Gutachterpartner' + (dat ? ' vom ' + dat : '') + ' (kein Gutachten)');
    if (ok) { schliessen(); if (typeof window.toast === 'function') window.toast('Restnutzungsdauer ' + n + ' Jahre übernommen. Für das Finanzamt braucht es ein Gutachten.'); }
  }

  window.DpGutachterpartner = { oeffnen: oeffnen, status: status, einbauen: einbauen, _mitNull: mitNull };
})();
