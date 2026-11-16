/* ════════════════════════════════════════════════════════════════════
   v3570 · RESTNUTZUNGSDAUER BEIM UNABHAENGIGEN GUTACHTERPARTNER
   (v3540 Bau, v3541 Schliessen-Knopf, v3570 Marcels Rueckmeldung vom 16.11.2026)
   ════════════════════════════════════════════════════════════════════
   Reiter Steuer › AfA-Satz „Eigenen Satz / Restnutzungsdauer eingeben …“ ›
   Box mit den RND-Knoepfen (js/afa-eigen.js). Dort zwei Wege:
     „Ersteinschätzung (Gutachterpartner)“       Lite, Ergebnis sofort (Direct-API, siehe Backend)
     „Gutachten beauftragen (Gutachterpartner)“  voll, Entwurf, Unterlagen, kostenpflichtig nur nach Bestaetigung
   v3570, Marcel nach dem Ausprobieren:
     „Es öffnet sich ein komisches Modal.“  -> die Fenster-Bausteine der App (storage.js: global-view-overlay,
        global-view-modal dpm-shell, DP_BAR, DP_HERO, dpm-body, dpm-btn) statt eines eigenen Kastens
     „Auswahlfelder auf Englisch“            -> Optionen ueber DpGutachterAbbildung.optionText (deutsche Tabelle)
     „mit all unseren Werten vorbelegen“    -> vorbelegenMitHerkunft: jedes Feld mit Herkunft, Fehlendes markiert
     „Bekommen wir direkt einen Wert?“       -> ja (Direct-API, ~4 s); sonst Nachladen 3 × 5 s + „Ergebnis abrufen“
   Sichtbar nur, wenn /status freigeschaltet meldet. Nach aussen nie der Anbietername.
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
  /* Felder des Tabs Objekt, die die Abbildung liest (gutachterpartner-abbildung.js REGELN) */
  var OBJEKT_FELDER = ['objart', 'str', 'hnr', 'plz', 'ort', 'baujahr', 'wfl', 'einheiten', 'nhk_geschosse', 'nhk_dach', 'eq_floor', 'eq_windows', 'eq_roof',
    'eq_heating', 'eq_bath', 'eq_guest_wc', 'bad_anz', 'balkon_flae', 'inv_pv', 'ds2_energie', 'kaufdat', 'eig_struktur'];
  function objektDaten() {
    var o = { mod: {} };
    OBJEKT_FELDER.forEach(function (k) { o[k] = wert(k); });
    ['dach', 'fenster', 'leitungen', 'heizung', 'aussenwand', 'baeder', 'innenausbau', 'grundriss'].forEach(function (k) { var v = wert('mod_' + k); if (v) o.mod[k] = v; });
    return o;
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
  var MERK = 'dp_gp_anfragender';
  function merkenLesen() { try { return JSON.parse(localStorage.getItem(MERK) || '{}') || {}; } catch (e) { return {}; } }
  function merkenSchreiben(data) { try { if (data && data.requester) { var r = Object.assign({}, data.requester); delete r.acceptPrivacy; delete r.acceptTerms; localStorage.setItem(MERK, JSON.stringify({ requester: r })); } } catch (e) {} }

  /* ── Fenster in den Bausteinen der App (storage.js) ─────────────── */
  function stilEinmal() {
    if (el('gp-stil')) return;
    var s = document.createElement('style'); s.id = 'gp-stil';
    s.textContent = [
      '#gp-overlay .global-view-modal{max-width:900px}',
      '#gp-overlay .dpm-body{color:var(--dp-ink,#1c1a14);font-size:13.5px;line-height:1.45}',
      '#gp-overlay .gp-sek{border:1px solid var(--dp-line,#E6DFCE);border-radius:11px;background:#fff;padding:14px 16px 8px;margin:0 0 14px}',
      '#gp-overlay .gp-sek-t{font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:1.6px;text-transform:uppercase;color:var(--dp-ink-soft,#8a8473);font-weight:700;margin:0 0 6px}',
      '#gp-overlay .gp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0 16px}',
      '#gp-overlay .gp-feld{margin:7px 0}',
      '#gp-overlay .gp-feld>label,#gp-overlay .gp-lab{display:block;font-size:12px;font-weight:600;color:var(--dp-ink,#1c1a14);margin:0 0 4px}',
      '#gp-overlay .gp-feld input[type=text],#gp-overlay .gp-feld input[type=email],#gp-overlay .gp-feld input[type=tel],#gp-overlay .gp-feld input[type=date],#gp-overlay .gp-feld select,#gp-overlay .gp-feld textarea{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid var(--dp-line,#E6DFCE);border-radius:8px;background:#fff;color:var(--dp-ink,#1c1a14);font:inherit;font-size:13.5px}',
      '#gp-overlay .gp-wahl{display:flex;flex-wrap:wrap;gap:6px 14px;padding:4px 0}',
      '#gp-overlay .gp-wahl label,#gp-overlay .gp-check{font-weight:400;font-size:13px;color:var(--dp-ink,#1c1a14);display:inline-flex;align-items:center;gap:6px}',
      '#gp-overlay .gp-herk{font-size:11px;color:var(--dp-ink-soft,#8a8473);margin-top:3px}',
      '#gp-overlay .gp-feld.gp-fehlt input,#gp-overlay .gp-feld.gp-fehlt select,#gp-overlay .gp-feld.gp-fehlt textarea,#gp-overlay .gp-feld.gp-fehlt .gp-wahl{border:1px dashed #B8625C;border-radius:8px}',
      '#gp-overlay .gp-fehlt-t{font-size:11px;color:#B8625C;margin-top:3px}',
      '#gp-overlay .gp-fehler{color:#B8625C;font-size:12px}',
      '#gp-overlay .gp-hinweis{font-size:12.5px;color:var(--dp-ink-soft,#8a8473);margin:4px 0 10px}',
      '#gp-overlay .gp-leiste{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;align-items:center;position:sticky;bottom:0;background:var(--dp-surface,#fff);padding:12px 0 2px;border-top:1px solid var(--dp-line,#E6DFCE);margin-top:6px}',
      '#gp-overlay .gp-erg{position:relative;border:1px solid var(--dp-line,#E6DFCE);border-radius:11px;background:var(--dp-surface-2,#FAF6EC);padding:14px 16px 14px 19px;margin:0 0 14px;overflow:hidden}',
      '#gp-overlay .gp-erg::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--dp-runway)}',
      '#gp-overlay .gp-zahl{font-family:"Space Grotesk",sans-serif;font-size:28px;font-weight:700;color:var(--dp-ink,#1c1a14);line-height:1.1}',
      '#gp-overlay .gp-zeile{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:8px 0;border-top:1px solid var(--dp-line,#E6DFCE)}',
      '#gp-overlay .gp-kosten{display:block;margin:4px 0 12px;padding:11px 13px;border:1px solid #B8625C;border-radius:10px;background:rgba(184,98,92,.06);font-weight:400;color:var(--dp-ink,#1c1a14)}',
      '#gp-overlay .gp-person{border:1px dashed var(--dp-line,#E6DFCE);border-radius:9px;padding:6px 10px;margin:6px 0}',
      /* v3571 · 390 px gemessen: das Abzeichen im Kopf lag ueber dem Titel */
      '@media (max-width:640px){#gp-overlay .dpm-hero-badge{display:none}#gp-overlay .dpm-hero{padding:18px 18px 20px}#gp-overlay .dpm-body{padding:14px 14px 18px}#gp-overlay .gp-leiste{justify-content:stretch}#gp-overlay .gp-leiste .dpm-btn{flex:1 1 100%;justify-content:center}}'
    ].join('\n');
    document.head.appendChild(s);
  }
  var ICO_RND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V9l7-5 7 5v12"/><path d="M12 11v4l3 2"/></svg>';

  function fenster(art) {
    schliessen();
    stilEinmal();
    try { if (typeof window._dpModalCss === 'function') window._dpModalCss(); } catch (e) {}
    var titel = art === 'lite' ? 'Ersteinschätzung der Restnutzungsdauer' : 'Restnutzungsdauer-Gutachten beauftragen';
    var text = art === 'lite'
      ? 'Unser unabhängiger Gutachterpartner schätzt die Restnutzungsdauer aus den Angaben zu deinem Objekt. Das Ergebnis kommt in wenigen Sekunden. Eine Ersteinschätzung ist kein Gutachten.'
      : 'Unser unabhängiger Gutachterpartner erstellt ein Restnutzungsdauer-Gutachten als Nachweis für einen eigenen AfA-Satz (§ 7 Abs. 4 Satz 2 EStG). Alle Angaben, die DealPilot kennt, sind vorbelegt.';
    var o = document.createElement('div'); o.id = 'gp-overlay'; o.className = 'global-view-overlay';
    var bar = (typeof window.DP_BAR === 'function') ? window.DP_BAR('Restnutzungsdauer', 'gp-overlay') : '';
    var hero = (typeof window.DP_HERO === 'function') ? window.DP_HERO('Steuer · Restnutzungsdauer', titel, text, ICO_RND)
      : '<div style="padding:18px 22px"><h2 style="margin:0">' + esc(titel) + '</h2><p>' + esc(text) + '</p></div>';
    o.innerHTML = '<div class="global-view-modal dpm-shell" role="dialog" aria-modal="true" aria-label="' + esc(titel) + '">' + bar + hero
      + '<div class="dpm-body" id="gp-inhalt"><p class="gp-hinweis">Formular wird geladen …</p></div></div>';
    document.body.appendChild(o);
    o.addEventListener('click', function (e) { if (e.target === o) schliessen(); });
    document.addEventListener('keydown', escZu);
    return el('gp-inhalt');
  }
  function escZu(e) { if (e.key === 'Escape' && el('gp-overlay')) schliessen(); }
  function schliessen() { var o = el('gp-overlay'); if (o) o.remove(); document.removeEventListener('keydown', escZu); if (st && st.takt) clearTimeout(st.takt); }

  var STATUS_TEXT = { draft: 'Entwurf', received: 'eingegangen', initialAssessment: 'Ersteinschätzung liegt vor', ordered: 'beauftragt' };
  var HERK_TEXT = { objekt: 'aus dem Objekt', abgeleitet: 'aus dem Objekt abgeleitet – bitte prüfen', konto: 'aus deinen Einstellungen' };
  function datum(d) { try { return new Date(d).toLocaleDateString('de-DE'); } catch (e) { return ''; } }
  function zahl(n, d) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }

  function oeffnen(art) {
    var inhalt = fenster(art);
    if (st && st.takt) clearTimeout(st.takt);
    st = { art: art, def: null, rid: null, gesendet: {}, unterlagen: [] };
    var oid = objektId();
    Promise.all([
      api('/formular/' + art),
      api('/anfragen' + (oid ? '?objekt=' + oid : '')).catch(function () { return { anfragen: [] }; }),
      (art === 'voll' && oid) ? window.Auth.apiCall('/dateien?objekt=' + oid).catch(function () { return { dateien: [] }; }) : Promise.resolve({ dateien: [] })
    ]).then(function (r) {
      st.def = (r[0] && r[0].data) || null;
      st.unterlagen = (r[2] && r[2].dateien) || [];
      if (!st.def || !st.def.ui) { inhalt.innerHTML = '<p class="gp-fehler">Das Formular des Gutachterpartners ist gerade nicht lesbar.</p>'; return; }
      zeichnen(inhalt, (r[1] && r[1].anfragen || []).filter(function (a) { return !oid || a.objekt_id === oid; }));
    }).catch(function (e) {
      inhalt.innerHTML = '<p class="gp-fehler">' + N((e && e.message) || 'Fehler') + '</p>';
    });
  }

  function listeHtml(liste) {
    if (!liste.length) return '';
    return '<details class="gp-sek" id="gp-liste"><summary class="gp-sek-t" style="cursor:pointer">Bisherige Anfragen zu diesem Objekt (' + liste.length + ')</summary>'
      + liste.map(function (a) {
        var r = a.result || {};
        return '<div class="gp-zeile" data-rid="' + esc(a.request_id) + '">'
          + '<span>' + esc(datum(a.created_at)) + ' · ' + (a.art === 'lite' ? 'Ersteinschätzung' : 'Gutachten') + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '') + '</span>'
          + '<span class="gp-herk" data-gp="stat">' + esc(STATUS_TEXT[a.status] || a.status || '') + (a.umgebung === 'test' ? ' · Testumgebung' : '') + '</span>'
          + (r.finalAverageRUL ? '<b>' + zahl(r.finalAverageRUL) + ' Jahre · AfA ' + zahl(r.annualDepreciation, 2) + ' %</b>' : '')
          + '<span style="flex:1"></span>'
          + '<button type="button" class="dpm-btn" data-gp="stand">Stand abrufen</button>'
          + (r.finalAverageRUL ? '<button type="button" class="dpm-btn" data-gp="uebernehmen" data-rnd="' + esc(r.finalAverageRUL) + '" data-datum="' + esc(datum(a.created_at)) + '">Als RND übernehmen</button>' : '')
          + '</div>';
      }).join('') + '</details>';
  }

  function optionenHtml(p, opts, leerText) {
    return (leerText ? '<option value="">' + esc(leerText) + '</option>' : '') + opts.map(function (o) { return '<option value="' + esc(o.value) + '">' + esc(A().optionText(p, o).text) + '</option>'; }).join('');
  }
  /* Liste von Personen (Eigentuemerdaten): Unterfelder aus dem Schema, deutsche Beschriftung */
  function personHtml(id, k, items) {
    var a = A(), props = (items && items.properties) || {};
    return '<div class="gp-person" data-person="' + k + '"><div class="gp-grid">' + Object.keys(props).map(function (u) {
      var e = props[u].enum, lab = a.UNTERFELD[u] || u;
      var ein = e ? '<select data-u="' + u + '">' + optionenHtml(u === 'title' ? 'owner.ownerDetailsData.title' : 'x.country', e.map(function (v) { return { value: v, label: v }; }), '– bitte wählen –') + '</select>'
        : '<input type="' + (u === 'email' ? 'email' : u === 'phoneNumber' ? 'tel' : 'text') + '" data-u="' + u + '">';
      return '<div class="gp-feld"><span class="gp-lab">' + esc(lab) + '</span>' + ein + '</div>';
    }).join('') + '</div></div>';
  }

  function feldHtml(f, i) {
    var a = A(), p = a.feldPfad(f), opts = a.optionen(f, st.def.schema), id = 'gp-f' + i;
    var lab = '<label for="' + id + '">' + N(f.label) + '</label>';
    var unten = (f.helpText ? '<div class="gp-herk">' + N(f.helpText) + '</div>' : '') + '<div class="gp-herk" data-herk></div><div class="gp-fehlt-t" data-fehlt hidden>fehlt – bitte ergänzen</div><div class="gp-fehler"></div>';
    var ph = f.placeholder ? ' placeholder="' + N(f.placeholder) + '"' : '';
    var eing;
    if (f.inputType === 'select' && opts.length) {
      eing = '<select id="' + id + '">' + optionenHtml(p, opts, '– bitte wählen –') + '</select>';
    } else if (f.inputType === 'radio' && opts.length) {
      eing = '<div id="' + id + '" class="gp-wahl">' + opts.map(function (o, k) { return '<label><input type="radio" name="' + id + '" value="' + esc(o.value) + '"> ' + esc(a.optionText(p, o).text) + '</label>'; }).join('') + '</div>';
    } else if (f.inputType === 'multiselect') {
      eing = '<div id="' + id + '" class="gp-wahl">' + opts.map(function (o) { return '<label><input type="checkbox" value="' + esc(o.value) + '"> ' + esc(a.optionText(p, o).text) + '</label>'; }).join('') + '</div>';
    } else if (f.inputType === 'checkbox') {
      return '<div class="gp-feld" data-i="' + i + '" data-pfad="' + esc(p) + '"><label class="gp-check"><input type="checkbox" id="' + id + '"> ' + N(f.label) + '</label>' + unten + '</div>';
    } else if (f.inputType === 'array') {
      var items = (a.schemaAn(st.def.schema, p) || {}).items;
      eing = '<div id="' + id + '" data-liste="1">' + personHtml(id, 0, items) + '</div><button type="button" class="dpm-btn" data-gp="person" data-ziel="' + id + '" style="margin-top:4px">weitere Person</button>';
    } else if (f.inputType === 'textarea') {
      eing = '<textarea id="' + id + '" rows="2"' + ph + '></textarea>';
    } else if (f.inputType === 'file') {
      eing = '<select id="' + id + '"><option value="">– keine Unterlage –</option>'
        + st.unterlagen.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc((d.ordner ? d.ordner + ' / ' : '') + d.name) + '</option>'; }).join('')
        + '</select><input type="file" id="' + id + '-datei" style="margin-top:6px;font-size:12px"><div class="gp-herk">aus den Objektunterlagen wählen oder vom Gerät hochladen</div>';
    } else {
      var typ = f.inputType === 'email' ? 'email' : f.inputType === 'phone' ? 'tel' : f.inputType === 'date' ? 'date' : 'text';
      eing = '<input id="' + id + '" type="' + typ + '"' + (f.inputType === 'number' ? ' inputmode="decimal"' : '') + ph + '>';
    }
    return '<div class="gp-feld" data-i="' + i + '" data-pfad="' + esc(p) + '">' + lab + eing + unten + '</div>';
  }

  function zeichnen(inhalt, liste) {
    var a = A(), gruppen = a.felder(st.def), alle = [];
    var html = '<div id="gp-ergebnis"></div>' + listeHtml(liste) + '<div id="gp-formular">';
    gruppen.forEach(function (g) {
      html += '<section class="gp-sek"><div class="gp-sek-t">' + N(g.label) + '</div>'
        + (g.description ? '<div class="gp-hinweis">' + N(g.description) + '</div>' : '') + '<div class="gp-grid">';
      g.fields.forEach(function (f) { html += feldHtml(f, alle.length); alle.push(f); });
      html += '</div></section>';
    });
    html += '</div>';
    if (st.art === 'voll') {
      /* PLATZHALTER fuer Marcel: Preis und Bedingungen des Gutachtens (noch nicht entschieden, 16.11.2026) */
      html += '<label class="gp-kosten" id="gp-kosten"><input type="checkbox" id="gp-kosten-ok"> <b>Kostenpflichtiger Auftrag.</b> Mit „Beauftragen“ entsteht beim unabhängigen Gutachterpartner ein kostenpflichtiger Auftrag für ein Restnutzungsdauer-Gutachten. '
        + 'Preis und Bedingungen: <i>[Platzhalter – Text folgt]</i>. Ich habe das verstanden und möchte beauftragen.</label>';
    }
    html += '<div id="gp-allgemein" class="gp-fehler" style="margin:6px 0"></div>'
      + '<div class="gp-leiste"><span class="gp-herk" id="gp-zaehler" style="margin-right:auto"></span>'
      + '<button type="button" class="dpm-btn" id="gp-abbrechen">Abbrechen</button>'
      + (st.art === 'voll' ? '<button type="button" class="dpm-btn" id="gp-entwurf">Entwurf speichern</button>' : '')
      + '<button type="button" class="dpm-btn primary" id="gp-senden">' + (st.art === 'lite' ? 'Ersteinschätzung anfordern' : 'Kostenpflichtig beauftragen') + '</button></div>';
    inhalt.innerHTML = html;
    st.felder = alle;

    /* vorbelegen: Objekt, Einstellungen, zuletzt gemerkte anfragende Person */
    var vor = a.vorbelegenMitHerkunft(st.def, objektDaten(), nutzerDaten());
    st.herkunft = vor.herkunft;
    var merk = merkenLesen();
    alle.forEach(function (f, i) {
      var p = a.feldPfad(f), w = a.holen(vor.data, p);
      if (w === undefined && /^requester\./.test(p) && !/accept/.test(p)) { w = a.holen(merk, p); if (w !== undefined) st.herkunft[p] = { quelle: 'zuletzt eingegeben', art: 'konto' }; }
      if (w !== undefined) eingabeSetzen(f, i, w);
      var h = st.herkunft[p], box = document.querySelector('.gp-feld[data-i="' + i + '"] [data-herk]');
      if (h && box) box.textContent = HERK_TEXT[h.art] || '';
    });
    inhalt.addEventListener('input', aktualisieren);
    inhalt.addEventListener('change', aktualisieren);
    inhalt.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-gp="person"]'); if (!b) return;
      var z = el(b.getAttribute('data-ziel')); var p = z && z.closest('.gp-feld').getAttribute('data-pfad');
      var items = (A().schemaAn(st.def.schema, p) || {}).items; z.insertAdjacentHTML('beforeend', personHtml(z.id, z.children.length, items));
    });
    aktualisieren(); aktualisieren();
    el('gp-abbrechen').onclick = schliessen;
    var be = el('gp-entwurf'); if (be) be.onclick = function () { senden(false); };
    el('gp-senden').onclick = function () { senden(true); };
    inhalt.querySelectorAll('[data-gp="stand"]').forEach(function (b) { b.onclick = function () { standAbrufen(b.closest('.gp-zeile').getAttribute('data-rid'), b); }; });
    inhalt.querySelectorAll('[data-gp="uebernehmen"]').forEach(function (b) { b.onclick = function () { uebernehmen(b.getAttribute('data-rnd'), b.getAttribute('data-datum')); }; });
  }

  function eingabeSetzen(f, i, w) {
    var id = 'gp-f' + i, e = el(id);
    if (!e) return;
    if (f.inputType === 'radio' && e.classList.contains('gp-wahl')) { e.querySelectorAll('input').forEach(function (r) { r.checked = String(r.value) === String(w); }); return; }
    if (f.inputType === 'multiselect') { var arr = Array.isArray(w) ? w.map(String) : [String(w)]; e.querySelectorAll('input').forEach(function (c) { c.checked = arr.indexOf(c.value) >= 0; }); return; }
    if (f.inputType === 'checkbox') { e.checked = !!w; return; }
    if (f.inputType === 'array') return;
    e.value = String(w);
  }
  function eingabeLesen(f, i) {
    var id = 'gp-f' + i, e = el(id);
    if (!e) return undefined;
    if (f.inputType === 'radio' && e.classList.contains('gp-wahl')) { var r = e.querySelector('input:checked'); return r ? r.value : ''; }
    if (f.inputType === 'multiselect') return Array.prototype.map.call(e.querySelectorAll('input:checked'), function (c) { return c.value; });
    if (f.inputType === 'checkbox') return !!e.checked;
    if (f.inputType === 'array') {
      var liste = [];
      e.querySelectorAll('[data-person]').forEach(function (z) {
        var o = {}, voll = false;
        z.querySelectorAll('[data-u]').forEach(function (x) { var v = String(x.value || '').trim(); if (v) { o[x.getAttribute('data-u')] = v; voll = true; } });
        if (voll) liste.push(o);
      });
      return liste.length ? liste : undefined;
    }
    return e.value;
  }
  /* Daten aus den SICHTBAREN Feldern; Sichtbarkeit nach visibleWhen, fehlende Pflichtfelder markieren */
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
    var data = lesen(), fehlt = 0;
    st.felder.forEach(function (f, i) {
      var box = document.querySelector('.gp-feld[data-i="' + i + '"]'); if (!box) return;
      box.hidden = !A().sichtbar(f, data);
      var p = A().feldPfad(f), w = A().holen(data, p);
      var leer = w === undefined || w === '' || w === false || (Array.isArray(w) && !w.length);
      var muss = !box.hidden && f.inputType !== 'file' && A().pflicht(st.def, p, data) && leer;
      box.classList.toggle('gp-fehlt', muss);
      var t = box.querySelector('[data-fehlt]'); if (t) { t.hidden = !muss; t.textContent = f.inputType === 'checkbox' ? 'bitte bestätigen' : 'fehlt – bitte ergänzen'; }
      if (muss) fehlt++;
    });
    var z = el('gp-zaehler'); if (z) z.textContent = fehlt ? fehlt + ' Pflichtangabe' + (fehlt === 1 ? '' : 'n') + ' offen' : 'Alle Pflichtangaben gefüllt';
  }

  function fehlerZeigen(e) {
    document.querySelectorAll('#gp-formular .gp-fehler').forEach(function (d) { d.textContent = ''; });
    var allg = el('gp-allgemein'); if (allg) allg.textContent = '';
    if (!e || !e.message) return;
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
    if (allg) allg.textContent = [A().neutral(e.message)].concat(z.allgemein.map(A().neutral)).join(' · ');
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
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Hochladen fehlgeschlagen'); e.data = j; throw e; } (st.hochgeladen = st.hochgeladen || {})[schl] = 1; }); });
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
    var alt = knopf.textContent; knopf.textContent = st.art === 'lite' ? 'wird eingeschätzt …' : 'wird gesendet …';
    var t0 = Date.now();
    var bestaetigt = st.art === 'voll' && !!(el('gp-kosten-ok') && el('gp-kosten-ok').checked);
    var hatDateien = st.felder.some(function (f) { return f.inputType === 'file'; });
    var p;
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
      fehlerZeigen(null);
      ergebnisZeigen(r && r.anfrage, absenden, Date.now() - t0);
    }).catch(function (e) {
      if (e && e.data && e.data.request_id) st.rid = e.data.request_id;
      fehlerZeigen(e);
    }).then(function () { [knopf, ent].forEach(function (b) { if (b) b.disabled = false; }); knopf.textContent = alt; });
  }

  function ergebnisKarte(a, ms) {
    var r = a.result || {};
    return '<div class="gp-erg"><div class="gp-sek-t">Ersteinschätzung' + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '') + (a.umgebung === 'test' ? ' · Testumgebung' : '') + (ms ? ' · in ' + zahl(ms / 1000, 1) + ' s' : '') + '</div>'
      + '<div style="display:flex;gap:32px;flex-wrap:wrap;margin:4px 0 8px"><div><div class="gp-zahl">' + zahl(r.finalAverageRUL) + ' Jahre</div><div class="gp-herk">voraussichtliche Restnutzungsdauer' + (r.finalRangeRUL ? ' (Spanne ' + esc(r.finalRangeRUL) + ' Jahre)' : '') + '</div></div>'
      + (r.annualDepreciation ? '<div><div class="gp-zahl">' + zahl(r.annualDepreciation, 2) + ' %</div><div class="gp-herk">jährliche AfA</div></div>' : '') + '</div>'
      + '<div class="gp-hinweis" style="margin:0 0 10px">Ersteinschätzung, kein Gutachten. Für einen eigenen AfA-Satz verlangt das Finanzamt ein Gutachten.</div>'
      + '<button type="button" class="dpm-btn primary" id="gp-uebernehmen">Als Restnutzungsdauer übernehmen</button></div>';
  }
  function ergebnisZeigen(a, abgesendet, ms) {
    var box = el('gp-ergebnis'); if (!box || !a) return;
    var r = a.result || {};
    if (st.art === 'lite') {
      if (r.finalAverageRUL) {
        box.innerHTML = ergebnisKarte(a, a.dauer_ms || ms);
        el('gp-uebernehmen').onclick = function () { uebernehmen(r.finalAverageRUL, datum(a.updated_at || new Date())); };
      } else {
        /* Der Partner hat angenommen, das Ergebnis aber nicht mitgeschickt: nachladen (3 × 5 s), dann von Hand */
        box.innerHTML = '<div class="gp-erg"><div class="gp-sek-t">Anfrage gestellt' + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '') + '</div>'
          + '<div id="gp-warte">Die Ersteinschätzung liegt beim Gutachterpartner bereit und wird abgerufen …</div>'
          + '<button type="button" class="dpm-btn" id="gp-abrufen" style="margin-top:8px">Ergebnis abrufen</button></div>';
        var versuch = 0;
        var abrufen = function (vonHand) {
          api('/anfragen/' + encodeURIComponent(a.request_id || st.rid)).then(function (x) {
            var n = x.anfrage || {};
            if (n.result && n.result.finalAverageRUL) { ergebnisZeigen(n, true); return; }
            versuch++;
            if (!vonHand && versuch < 3) st.takt = setTimeout(function () { abrufen(false); }, 5000);
            else if (el('gp-warte')) el('gp-warte').textContent = 'Das Ergebnis ist noch nicht abrufbar (Stand: ' + (STATUS_TEXT[n.status] || n.status || '') + '). Bitte später „Ergebnis abrufen“ – die Anfrage bleibt am Objekt gespeichert.';
          }).catch(function (e) { if (el('gp-warte')) el('gp-warte').textContent = A().neutral(e.message); });
        };
        el('gp-abrufen').onclick = function () { abrufen(true); };
        st.takt = setTimeout(function () { abrufen(false); }, 5000);
      }
      box.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    box.innerHTML = '<div class="gp-erg"><div class="gp-sek-t">' + (abgesendet ? 'Beauftragt' : 'Entwurf gespeichert') + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '') + '</div>'
      + 'Stand: ' + esc(STATUS_TEXT[a.status] || a.status || '') + (a.umgebung === 'test' ? ' · Testumgebung' : '')
      + (a.attachments && a.attachments.length ? ' · ' + a.attachments.length + ' Unterlage(n)' : '') + '. Den Stand rufst du hier später über „Stand abrufen“ ab.</div>';
    box.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function standAbrufen(rid, knopf) {
    if (knopf) { knopf.disabled = true; knopf.textContent = 'fragt ab …'; }
    api('/anfragen/' + encodeURIComponent(rid)).then(function (r) {
      var a = r.anfrage || {}, res = a.result || {};
      var zeile = knopf && knopf.closest('.gp-zeile');
      if (zeile) {
        var sp = zeile.querySelector('[data-gp="stat"]'); if (sp) sp.textContent = (STATUS_TEXT[a.status] || a.status || '') + (a.umgebung === 'test' ? ' · Testumgebung' : '');
        if (res.finalAverageRUL && !zeile.querySelector('[data-gp="uebernehmen"]')) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'dpm-btn'; b.textContent = 'Als RND übernehmen';
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
