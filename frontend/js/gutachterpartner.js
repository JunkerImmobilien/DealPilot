/* ════════════════════════════════════════════════════════════════════
   v3580/v3590 · RESTNUTZUNGSDAUER BEI GUTACHTEN.ORG, BEAUFTRAGT UEBER JUNKER IMMOBILIEN
   v3590 (Marcel 16.11.2026): Anfragender beim Partner ist Junker Solution (Backend, GUTACHTEN_AUFTRAGGEBER_*);
   der Kunde gibt seine Rechnungsangaben nur mit Zustimmung; Bestellreiter mit Preis aus der Preisliste
   (services/gutachtenAuftrag.js, junker-immobilien.io/preise.html, Stand 16.11.2026), Rabattcode, Zubuchungen.
   (v3540 Bau, v3570 App-Fenster/Deutsch/Vorbelegung/Ergebnis sofort, v3580 Reiter wie der RND-Rechner)
   ════════════════════════════════════════════════════════════════════
   Reiter Steuer › AfA-Satz „Eigenen Satz / Restnutzungsdauer eingeben …“ ›
   Box mit den RND-Knoepfen (js/afa-eigen.js). Dort zwei Wege:
     „Ersteinschätzung (gutachten.org)“   kostenlos, Ergebnis sofort (Direct-API, Backend)
     „Gutachten beauftragen (gutachten.org)“  Entwurf, Unterlagen, gesondert abgerechnet, nur nach Bestaetigung
   v3580, Marcels Entscheidungen 16.11.2026:
     - Der Partner wird genannt, als Marke „gutachten.org“ (nicht der Firmenname im Code). Logo:
       img/partner/gutachten-org.svg = offizielles Logo von https://www.gutachten.org/brand/logo/gutachten-org-ink.svg
       (abgerufen 16.11.2026, unveraendert).
     - Jedes angemeldete Konto darf anfragen (Backend /status).
     - Unsere AfA = 100 ÷ RND ist die Hauptzahl; die AfA des Partners steht klein daneben.
     - Statt einer langen Seite Reiter — DIESELBEN Bausteine wie der RND-Rechner (rnd-wizard.js, v3258
       „Stil des Makler Hub“): .rnd-wiz-overlay.rnd-hub, .rnd-wiz-modal, .rnd-wiz-header, Schrittleiste
       .rnd-wiz-steps/.rnd-hub-schritt mit .rnd-hub-nr/.rnd-hub-kurz, Balken, .rnd-hub-karte, .rnd-wiz-field,
       .rnd-hub-chip, Fuss .rnd-wiz-footer.rnd-hub-nav mit Zurueck / Zaehler / Weiter. Offene Pflichtangaben je Reiter.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var A = function () { return window.DpGutachterAbbildung; };
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var MARKE = 'gutachten.org';
  var LOGO = 'img/partner/gutachten-org.svg?v=v3580';
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
      var titel = s.konfiguriert ? '' : 'Die Anbindung an ' + MARKE + ' ist noch nicht eingerichtet.';
      [['gp-lite', 'Ersteinschätzung (' + MARKE + ')', 'lite'], ['gp-voll', 'Gutachten beauftragen (' + MARKE + ')', 'voll']].forEach(function (k) {
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

  /* ── Reiter: Gruppen der Definition -> Reiter (wie die Schritte des RND-Rechners) ── */
  var REITER = {
    lite: [
      { kurz: 'Objekt', titel: 'Objekt und Adresse', gruppen: ['propertyType', 'constructionYear', 'propertyAddress'] },
      { kurz: 'Modernisierung', titel: 'Modernisierung und Kernsanierung', gruppen: ['modernizations', 'renovation'] },
      /* v3590: die anfragende Person beim Partner ist Junker Solution (Backend) - keine Felder fuer den Kunden */
      { kurz: 'Absenden', titel: 'Ersteinschätzung anfordern', gruppen: ['requester'], letzter: true }
    ],
    voll: [
      { kurz: 'Objekt', titel: 'Objekt, Stichtag und Objektdaten', gruppen: ['property', 'valuation', 'objectDetails'] },
      { kurz: 'Bauweise', titel: 'Bauweise und Ausstattung', gruppen: ['construction'] },
      { kurz: 'Modernisierung', titel: 'Modernisierungen', gruppen: ['modernizations'] },
      { kurz: 'Eigentümer', titel: 'Eigentümer', gruppen: ['owner'] },
      /* v3590: Bestellung bei Junker Immobilien (Preis, Kunde, Zustimmungen); die Vereinbarung beim Partner setzt das Backend */
      { kurz: 'Bestellung', titel: 'Bestellung und Preis', gruppen: ['agreement'], letzter: true }
    ]
  };
  /* Gruppen, die keine Zuordnung haben (neue Gruppe des Partners), kommen in den vorletzten Reiter */
  function reiterBauen(art, gruppen) {
    var r = REITER[art].map(function (x) { return Object.assign({}, x, { liste: [] }); });
    gruppen.forEach(function (g) {
      var z = r.filter(function (x) { return x.gruppen.indexOf(g.id) >= 0; })[0] || r[Math.max(0, r.length - 2)];
      z.liste.push(g);
    });
    return r.filter(function (x) { return x.liste.length || x.letzter; });
  }

  /* ── Fenster in den Bausteinen des RND-Rechners ─────────────────── */
  function stilEinmal() {
    if (el('gp-stil')) return;
    var s = document.createElement('style'); s.id = 'gp-stil';
    s.textContent = [
      '#gp-overlay [hidden]{display:none !important}',
      '#gp-overlay .gp-logo{display:inline-flex;align-items:center;background:#fff;border-radius:8px;padding:6px 10px;margin:0 12px 0 0}',
      '#gp-overlay .gp-logo img{height:16px;width:auto;display:block}',
      '#gp-overlay .gp-kopf-rechts{display:flex;align-items:center}',
      '#gp-overlay .gp-offen{display:inline-block;min-width:16px;padding:0 5px;margin-left:5px;border-radius:9px;background:#B8625C;color:#fff;font:600 10px/16px Inter,sans-serif;text-align:center}',
      '#gp-overlay .gp-offen.gp-ok{background:#3FA56C}',
      '#gp-overlay .gp-herk{font-size:11px;color:var(--hub-muted,#6B6660);margin-top:3px}',
      '#gp-overlay .rnd-wiz-field.gp-fehlt :is(input,select,textarea){border:1px dashed #B8625C !important}',
      '#gp-overlay .rnd-wiz-field.gp-fehlt .gp-wahl{outline:1px dashed #B8625C;outline-offset:3px;border-radius:8px}',
      '#gp-overlay .gp-fehlt-t{font-size:11px;color:#B8625C;margin-top:3px}',
      '#gp-overlay .gp-fehler{color:#B8625C;font-size:12px}',
      '#gp-overlay .gp-wahl{display:flex;flex-wrap:wrap;gap:6px}',
      '#gp-overlay .gp-erg{position:relative;border:1px solid var(--hub-line,#E0DBD3);border-radius:12px;background:var(--hub-gold-bg,#FBF6E9);padding:14px 16px 14px 19px;overflow:hidden}',
      '#gp-overlay .gp-erg::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--hub-runway)}',
      '#gp-overlay .gp-zahl{font-family:var(--hub-display);font-size:28px;font-weight:700;color:var(--hub-ink,#1A1814);line-height:1.1}',
      '#gp-overlay .gp-zeile{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:8px 0;border-top:1px solid var(--hub-line-soft,#ECE7DE)}',
      '#gp-overlay .gp-kosten{display:block;padding:11px 13px;border:1px solid var(--hub-line,#E0DBD3);border-radius:10px;background:var(--hub-surface,#fff);font-size:13px;color:var(--hub-ink,#1A1814)}',
      '#gp-overlay .gp-kosten.gp-pflicht{border-color:#B8625C;background:rgba(184,98,92,.05)}',
      '#gp-overlay .gp-person{border:1px dashed var(--hub-line,#E0DBD3);border-radius:9px;padding:6px 10px;margin:6px 0}',
      '#gp-overlay .gp-knopf{border:1px solid var(--hub-line,#E0DBD3);background:var(--hub-surface,#fff);color:var(--hub-ink,#1A1814);border-radius:8px;padding:7px 12px;font:500 12.5px var(--hub-body);cursor:pointer}',
      '#gp-overlay .gp-knopf.gp-primaer{background:var(--hub-runway);border-color:transparent;color:#1a1508;font-weight:600}',
      '#gp-overlay .rnd-wiz-footer .gp-entwurf{margin-left:auto}',
      '@media (max-width:640px){#gp-overlay .gp-logo{display:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function fenster(art) {
    schliessen();
    stilEinmal();
    var titel = art === 'lite' ? 'Ersteinschätzung der Restnutzungsdauer' : 'Restnutzungsdauer-Gutachten beauftragen';
    var o = document.createElement('div'); o.id = 'gp-overlay'; o.className = 'rnd-wiz-overlay rnd-hub';
    o.innerHTML = '<div class="rnd-wiz-modal" role="dialog" aria-modal="true" aria-label="' + esc(titel) + '">'
      + '<div class="rnd-wiz-header"><div class="rnd-wiz-title"><h2 id="gp-titel">' + esc(titel) + '</h2><p class="rnd-wiz-sub" id="gp-sub">Gutachten durch ' + MARKE + '</p></div>'
      + '<div class="gp-kopf-rechts"><span class="gp-logo"><img src="' + LOGO + '" alt="' + MARKE + '"></span><button class="rnd-wiz-close" id="gp-zu" aria-label="Schließen">&times;</button></div></div>'
      + '<div class="rnd-wiz-progress rnd-hub-leiste"><div class="rnd-wiz-steps rnd-hub-schritte" id="gp-schritte"></div>'
      + '<div class="rnd-hub-balken"><div class="rnd-wiz-progress-bar" id="gp-balken"></div></div></div>'
      + '<div class="rnd-wiz-body" id="gp-inhalt"><section class="rnd-hub-karte"><p class="gp-herk">Formular wird geladen …</p></section></div>'
      + '<div class="rnd-wiz-footer rnd-hub-nav">'
      + '<button type="button" class="rnd-wiz-btn rnd-wiz-btn-sec rnd-hub-zurueck" id="gp-zurueck">← Zurück</button>'
      + '<div class="rnd-wiz-counter" id="gp-zaehler"></div>'
      + '<button type="button" class="rnd-wiz-btn rnd-wiz-btn-sec gp-entwurf" id="gp-entwurf" hidden>Entwurf speichern</button>'
      + '<button type="button" class="rnd-wiz-btn rnd-wiz-btn-pri rnd-hub-weiter" id="gp-weiter">Weiter →</button>'
      + '</div></div>';
    document.body.appendChild(o);
    /* wie der RND-Rechner: ein Klick daneben schliesst NICHT (v1856), nur × oder Escape */
    o.addEventListener('click', function (e) { if (e.target === o) e.stopPropagation(); });
    el('gp-zu').onclick = schliessen;
    document.addEventListener('keydown', escZu);
    return el('gp-inhalt');
  }
  function escZu(e) { if (e.key === 'Escape' && el('gp-overlay')) schliessen(); }
  function schliessen() { var o = el('gp-overlay'); if (o) o.remove(); document.removeEventListener('keydown', escZu); if (st && st.takt) clearTimeout(st.takt); }

  var STATUS_TEXT = { draft: 'Entwurf', received: 'eingegangen', initialAssessment: 'Ersteinschätzung liegt vor', ordered: 'beauftragt' };
  var HERK_TEXT = { objekt: 'aus dem Objekt', abgeleitet: 'aus dem Objekt abgeleitet – bitte prüfen', konto: 'aus deinen Einstellungen' };
  function datum(d) { try { return new Date(d).toLocaleDateString('de-DE'); } catch (e) { return ''; } }
  function zahl(n, d) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  /* Unsere AfA: 100 ÷ RND (Marcel 16.11.2026) — dieselbe Rechnung wie afa-eigen.js setzen() */
  function unsereAfa(rnd) { var n = Math.round(Number(rnd)); return n > 0 ? 100 / n : null; }

  function oeffnen(art, opt) {
    opt = opt || {};
    var inhalt = fenster(art);
    if (st && st.takt) clearTimeout(st.takt);
    st = { art: art, def: null, rid: null, gesendet: {}, unterlagen: [], reiter: 0, vorlage: opt.vorlage || null, ueber: (_status && _status.beauftragt_ueber) || 'Junker Immobilien' };
    var oid = objektId();
    Promise.all([
      api('/formular/' + art),
      api('/anfragen' + (oid ? '?objekt=' + oid : '')).catch(function () { return { anfragen: [] }; }),
      (art === 'voll' && oid) ? window.Auth.apiCall('/dateien?objekt=' + oid).catch(function () { return { dateien: [] }; }) : Promise.resolve({ dateien: [] }),
      art === 'voll' ? api('/preise').catch(function () { return {}; }) : Promise.resolve({})
    ]).then(function (r) {
      st.preisliste = (r[3] && r[3].preisliste) || null; if (r[3] && r[3].beauftragt_ueber) st.ueber = r[3].beauftragt_ueber;
      st.def = (r[0] && r[0].data) || null;
      st.unterlagen = (r[2] && r[2].dateien) || [];
      if (!st.def || !st.def.ui) { inhalt.innerHTML = '<section class="rnd-hub-karte"><p class="gp-fehler">Das Formular von ' + MARKE + ' ist gerade nicht lesbar.</p></section>'; return; }
      zeichnen(inhalt, (r[1] && r[1].anfragen || []).filter(function (a) { return !oid || a.objekt_id === oid; }));
    }).catch(function (e) {
      inhalt.innerHTML = '<section class="rnd-hub-karte"><p class="gp-fehler">' + N((e && e.message) || 'Fehler') + '</p></section>';
    });
  }

  function listeHtml(liste) {
    if (!liste.length) return '';
    return '<section class="rnd-hub-karte" id="gp-liste"><h3 class="rnd-hub-h">Bisherige Anfragen zu diesem Objekt (' + liste.length + ')</h3>'
      + liste.map(function (a) {
        var r = a.result || {};
        return '<div class="gp-zeile" data-rid="' + esc(a.request_id) + '">'
          + '<span>' + esc(datum(a.created_at)) + ' · ' + (a.art === 'lite' ? 'Ersteinschätzung' : 'Gutachten') + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '') + '</span>'
          + '<span class="gp-herk" data-gp="stat">' + esc(STATUS_TEXT[a.status] || a.status || '') + (a.umgebung === 'test' ? ' · Testumgebung' : '') + '</span>'
          + (r.finalAverageRUL ? '<b>' + zahl(r.finalAverageRUL) + ' Jahre · AfA ' + zahl(unsereAfa(r.finalAverageRUL), 2) + ' %</b>' : '')
          + '<span style="flex:1"></span>'
          + '<button type="button" class="gp-knopf" data-gp="stand">Stand abrufen</button>'
          + (r.finalAverageRUL ? '<button type="button" class="gp-knopf" data-gp="uebernehmen" data-rnd="' + esc(r.finalAverageRUL) + '" data-datum="' + esc(datum(a.created_at)) + '">Als RND übernehmen</button>' : '')
          + '</div>';
      }).join('') + '</section>';
  }

  function optionenHtml(p, opts, leerText) {
    return (leerText ? '<option value="">' + esc(leerText) + '</option>' : '') + opts.map(function (o) { return '<option value="' + esc(o.value) + '">' + esc(A().optionText(p, o).text) + '</option>'; }).join('');
  }
  function personHtml(k, items) {
    var a = A(), props = (items && items.properties) || {};
    return '<div class="gp-person" data-person="' + k + '"><div class="rnd-wiz-grid rnd-hub-felder">' + Object.keys(props).map(function (u) {
      var e = props[u].enum, lab = a.UNTERFELD[u] || u;
      var ein = e ? '<select data-u="' + u + '">' + optionenHtml(u === 'title' ? 'owner.ownerDetailsData.title' : 'x.country', e.map(function (v) { return { value: v, label: v }; }), '– bitte wählen –') + '</select>'
        : '<input type="' + (u === 'email' ? 'email' : u === 'phoneNumber' ? 'tel' : 'text') + '" data-u="' + u + '">';
      return '<div class="rnd-wiz-field"><label>' + esc(lab) + '</label>' + ein + '</div>';
    }).join('') + '</div></div>';
  }

  function feldHtml(f, i) {
    var a = A(), p = a.feldPfad(f), opts = a.optionen(f, st.def.schema), id = 'gp-f' + i;
    var unten = (f.helpText ? '<div class="gp-herk">' + N(f.helpText) + '</div>' : '') + '<div class="gp-herk" data-herk></div><div class="gp-fehlt-t" data-fehlt hidden>fehlt – bitte ergänzen</div><div class="gp-fehler"></div>';
    var ph = f.placeholder ? ' placeholder="' + N(f.placeholder) + '"' : '';
    var breit = /^(multiselect|textarea|array|radio)$/.test(f.inputType) ? ' rnd-wiz-col-2' : '';
    var eing;
    if (f.inputType === 'select' && opts.length) {
      eing = '<select id="' + id + '">' + optionenHtml(p, opts, '– bitte wählen –') + '</select>';
    } else if ((f.inputType === 'radio' || f.inputType === 'multiselect') && opts.length) {
      var typ = f.inputType === 'radio' ? 'radio' : 'checkbox';
      eing = '<div id="' + id + '" class="gp-wahl rnd-hub-chips" data-wahl="' + typ + '">' + opts.map(function (o) {
        return '<label class="rnd-hub-chip"><input type="' + typ + '" name="' + id + '" value="' + esc(o.value) + '">' + esc(a.optionText(p, o).text) + '</label>'; }).join('') + '</div>';
    } else if (f.inputType === 'checkbox') {
      return '<div class="rnd-wiz-field rnd-wiz-col-2" data-i="' + i + '" data-pfad="' + esc(p) + '"><label class="rnd-wiz-checkbox"><input type="checkbox" id="' + id + '"> ' + N(f.label) + '</label>' + unten + '</div>';
    } else if (f.inputType === 'array') {
      var items = (a.schemaAn(st.def.schema, p) || {}).items;
      eing = '<div id="' + id + '" data-liste="1">' + personHtml(0, items) + '</div><button type="button" class="gp-knopf" data-gp="person" data-ziel="' + id + '" style="margin-top:4px;align-self:flex-start">weitere Person</button>';
    } else if (f.inputType === 'textarea') {
      eing = '<textarea id="' + id + '" rows="2"' + ph + '></textarea>';
    } else if (f.inputType === 'file') {
      eing = '<select id="' + id + '"><option value="">– keine Unterlage –</option>'
        + st.unterlagen.map(function (d) { return '<option value="' + esc(d.id) + '">' + esc((d.ordner ? d.ordner + ' / ' : '') + d.name) + '</option>'; }).join('')
        + '</select><input type="file" id="' + id + '-datei" style="margin-top:6px;font-size:12px"><div class="gp-herk">aus den Objektunterlagen wählen oder vom Gerät hochladen</div>';
    } else {
      var t = f.inputType === 'email' ? 'email' : f.inputType === 'phone' ? 'tel' : f.inputType === 'date' ? 'date' : 'text';
      eing = '<input id="' + id + '" type="' + t + '"' + (f.inputType === 'number' ? ' inputmode="decimal"' : '') + ph + '>';
    }
    return '<div class="rnd-wiz-field' + breit + '" data-i="' + i + '" data-pfad="' + esc(p) + '"><label for="' + id + '">' + N(f.label) + '</label>' + eing + unten + '</div>';
  }

  /* v3590 · diese Partnerfelder setzt das Backend (Junker Solution als Anfragender, Vereinbarung beim Gutachten) */
  function vomServer(p) { return /^requester\./.test(p) || (st.art === 'voll' && /^agreement\./.test(p)); }

  /* ── v3590 · Bestellung bei Junker Immobilien (Preise aus GET /preise, gerechnet von POST /preis) ── */
  var KUNDE = [['firma', 'Firma (optional)', 'text'], ['vorname', 'Vorname', 'text'], ['nachname', 'Nachname', 'text'], ['strasse', 'Straße', 'text'], ['hnr', 'Hausnummer', 'text'],
    ['plz', 'Postleitzahl', 'text'], ['ort', 'Ort', 'text'], ['email', 'E-Mail-Adresse', 'email'], ['telefon', 'Telefon (optional)', 'tel']];
  var KUNDE_PFLICHT = { nachname: 1, strasse: 1, plz: 1, ort: 1, email: 1 };
  var MERK_KUNDE = 'dp_gp_kunde';
  function eurT(x) { return Number(x || 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'; }
  function bestellungHtml() {
    var pl = st.preisliste || {}, b = pl.besichtigung || {}, ex = pl.express || {};
    var bes = ['keine', 'aussen', 'innen_aussen'].filter(function (k) { return b[k]; }).map(function (k) {
      return '<label class="rnd-hub-chip"><input type="radio" name="gp-bes" value="' + k + '"' + (k === 'aussen' ? ' checked' : '') + '>' + esc(b[k].text) + (b[k].betrag ? ' +' + eurT(b[k].betrag) : '') + (b[k].empfohlen ? ' · empfohlen' : '') + '</label>'; }).join('');
    return '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Leistung</h3>'
      + '<p class="gp-herk" style="margin:0 0 8px">Gutachten durch ' + MARKE + ', beauftragt über ' + esc(st.ueber || 'Junker Immobilien') + '. Bearbeitungszeit ' + esc(pl.bearbeitung || '') + '.</p>'
      + '<div class="rnd-wiz-grid rnd-hub-felder">'
      + '<div class="rnd-wiz-field rnd-wiz-col-2"><label>Besichtigung</label><div class="gp-wahl rnd-hub-chips" id="gp-bes">' + bes + '</div></div>'
      + '<div class="rnd-wiz-field rnd-wiz-col-2"><label class="rnd-wiz-checkbox"><input type="checkbox" id="gp-express"> ' + esc(ex.text || 'Expresszuschlag') + ' +' + eurT(ex.betrag) + ' (' + esc(ex.hinweis || '') + ')</label></div>'
      + '<div class="rnd-wiz-field"><label for="gp-code">Rabattcode</label><input type="text" id="gp-code" autocomplete="off"><div class="gp-herk" id="gp-code-t"></div></div>'
      + '</div></section>'
      + '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Preis</h3><div id="gp-preis" class="gp-herk">wird berechnet …</div></section>'
      + '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Deine Angaben für die Rechnung</h3><div class="rnd-wiz-grid rnd-hub-felder">'
      + KUNDE.map(function (k) { return '<div class="rnd-wiz-field" data-kunde="' + k[0] + '"><label for="gp-k-' + k[0] + '">' + esc(k[1]) + '</label><input type="' + k[2] + '" id="gp-k-' + k[0] + '"><div class="gp-fehlt-t" data-fehlt hidden>fehlt – bitte ergänzen</div><div class="gp-fehler"></div></div>'; }).join('')
      + '</div></section>'
      + '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Bestätigen</h3>'
      + '<div class="rnd-wiz-field rnd-wiz-col-2" data-zust="daten"><label class="rnd-wiz-checkbox"><input type="checkbox" id="gp-z-daten"> Meine Angaben dürfen zur Beauftragung an Junker Solution und den beauftragten Gutachter übermittelt werden. '
      + '<a href="https://junker-immobilien.io/datenschutz.html" target="_blank" rel="noopener">Datenschutz</a></label><div class="gp-fehler"></div></div>'
      /* PLATZHALTER fuer Marcel: eine eigene Widerrufsbelehrung gibt es auf junker-immobilien.io noch nicht (gemessen 16.11.2026) */
      + '<div class="rnd-wiz-field rnd-wiz-col-2" data-zust="widerruf"><label class="rnd-wiz-checkbox"><input type="checkbox" id="gp-z-widerruf"> Ich habe die Widerrufsbelehrung zur Kenntnis genommen <i>[Platzhalter – Text von Junker Immobilien folgt]</i>.</label><div class="gp-fehler"></div></div>'
      + '<div class="rnd-wiz-field rnd-wiz-col-2" data-zust="kosten"><label class="rnd-wiz-checkbox"><input type="checkbox" id="gp-z-kosten"> Ich beauftrage das Gutachten <b>kostenpflichtig</b> zum oben genannten Endpreis. ' + esc(pl.zahlung || '') + '</label><div class="gp-fehler"></div></div>'
      + '<p class="gp-herk" style="margin:6px 0 0">' + esc(pl.steuer || '') + ' ' + esc(pl.skonto_vorkasse || '') + '</p>';
  }
  function kundeLesen() { var k = {}; KUNDE.forEach(function (x) { var e = el('gp-k-' + x[0]); if (e) k[x[0]] = String(e.value || '').trim(); }); return k; }
  function auswahlLesen() { var b = document.querySelector('#gp-bes input:checked'); return { besichtigung: b ? b.value : 'keine', express: !!(el('gp-express') && el('gp-express').checked), rabattcode: el('gp-code') ? el('gp-code').value.trim() : '' }; }
  function zustimmungenLesen() { var z = {}; ['daten', 'widerruf', 'kosten'].forEach(function (k) { var e = el('gp-z-' + k); z[k] = !!(e && e.checked); }); return z; }
  var _preisTakt = null;
  function preisRechnen() {
    if (st.art !== 'voll' || !el('gp-preis')) return;
    clearTimeout(_preisTakt);
    _preisTakt = setTimeout(function () {
      var d = lesen(), od = d.objectDetails || {};
      api('/preis', { method: 'POST', body: Object.assign({ flaeche: od.propertyArea || od.propertyResidentialArea }, auswahlLesen()) }).then(function (p) {
        st.preis = p;
        var box = el('gp-preis'); if (!box) return;
        var ct = el('gp-code-t'); if (ct) { ct.textContent = p.code_text || (p.rabatt && p.rabatt.art === 'code' ? p.rabatt.text + ': −' + p.rabatt.pct + ' % auf das Honorar' : ''); ct.style.color = p.code_ungueltig ? '#B8625C' : ''; }
        if (p.fehler) { box.textContent = p.text; return; }
        box.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px">' + p.posten.map(function (x) { return '<tr><td style="padding:3px 0">' + esc(x.text) + '</td><td style="text-align:right">' + eurT(x.betrag) + '</td></tr>'; }).join('')
          + (p.rabatt ? '<tr><td style="padding:3px 0">' + esc(p.rabatt.text) + ' (−' + p.rabatt.pct + ' %)</td><td style="text-align:right">−' + eurT(p.rabatt.betrag) + '</td></tr>' : '')
          + '<tr><td style="padding:8px 0 0;border-top:1px solid var(--hub-line,#E0DBD3)"><b>Endpreis</b> (Wohn-/Nutzfläche ' + zahl(p.flaeche) + ' m²)</td><td style="text-align:right;padding-top:8px;border-top:1px solid var(--hub-line,#E0DBD3)"><span class="gp-zahl" style="font-size:22px">' + eurT(p.endpreis) + '</span></td></tr></table>'
          + ((st.preisliste || {}).vorlaeufig ? '<p class="gp-herk">Preise nach der Preisliste von Junker Immobilien (Stand ' + esc(((st.preisliste || {}).stand || '').split('-').reverse().join('.')) + ').</p>' : '')
          + (p.individuell_moeglich ? '<p class="gp-herk">' + esc((st.preisliste || {}).hinweis_individuell || '') + '</p>' : '')
          + (((st.preisliste || {}).mengenrabatt || []).length ? '<p class="gp-herk">Mengenrabatt bei mehreren Objekten in einem Auftrag: ' + st.preisliste.mengenrabatt.slice().reverse().map(function (m) { return 'ab ' + m.ab + ' → ' + m.pct + ' %'; }).join(', ')
            + ' (Beauftragung binnen zwei Wochen) – bitte bei ' + esc(st.ueber || 'Junker Immobilien') + ' anfragen.</p>' : '');
      }).catch(function (e) { var box = el('gp-preis'); if (box) box.textContent = A().neutral(e.message); });
    }, 250);
  }

  function zeichnen(inhalt, liste) {
    var a = A(), alle = [];
    st.reiterListe = reiterBauen(st.art, a.felder(st.def));
    var html = '';
    st.reiterListe.forEach(function (r, ri) {
      html += '<div class="gp-reiter" data-reiter="' + ri + '"' + (ri ? ' hidden' : '') + '>';
      if (ri === 0) html += listeHtml(liste);
      r.liste.forEach(function (g) {
        if (!g.fields.some(function (f) { return !vomServer(A().feldPfad(f)); })) return;
        html += '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">' + N(g.label) + '</h3>'
          + (g.description ? '<p class="gp-herk">' + N(g.description) + '</p>' : '') + '<div class="rnd-wiz-grid rnd-hub-felder">';
        g.fields.forEach(function (f) { if (vomServer(A().feldPfad(f))) return; html += feldHtml(f, alle.length); alle.push(Object.assign(f, { _reiter: ri })); });
        html += '</div></section>';
      });
      if (r.letzter) {
        html += (st.art === 'lite'
          ? '<section class="rnd-hub-karte"><h3 class="rnd-hub-h">Ersteinschätzung</h3><div class="gp-kosten">Die Ersteinschätzung ist <b>kostenlos</b>. Sie wird über ' + esc(st.ueber || 'Junker Immobilien')
            + ' bei ' + MARKE + ' angefragt; das Ergebnis erscheint hier in wenigen Sekunden. Eine Ersteinschätzung ist kein Gutachten.</div>'
          : bestellungHtml())
          + '<div id="gp-allgemein" class="gp-fehler" style="margin-top:8px"></div><div id="gp-ergebnis" style="margin-top:10px"></div></section>';
      }
      html += '</div>';
    });
    inhalt.innerHTML = html;
    st.felder = alle;

    var vor = a.vorbelegenMitHerkunft(st.def, objektDaten(), nutzerDaten());
    st.herkunft = vor.herkunft;
    var vorl = st.vorlage || {};
    alle.forEach(function (f, i) {
      var p = a.feldPfad(f), w = a.holen(vor.data, p);
      /* v3590 · aus der Ersteinschaetzung uebernommen (dieselben Angaben, ggf. dort korrigiert) */
      var pv = p === 'construction.hasRenovations' ? 'renovation.hasRenovations' : p === 'construction.renovationsYearOfRenovations' ? 'renovation.year' : p === 'construction.renovationsExplainRenovations' ? 'renovation.description' : p;
      var wv = a.holen(vorl, pv);
      if (wv !== undefined && wv !== '' && !(typeof wv === 'object' && !Array.isArray(wv))) { w = wv; st.herkunft[p] = { quelle: 'Ersteinschätzung', art: 'konto' }; }
      if (w !== undefined) eingabeSetzen(f, i, w);
      var h = st.herkunft[p], box = document.querySelector('#gp-overlay [data-i="' + i + '"] [data-herk]');
      if (h && box) box.textContent = HERK_TEXT[h.art] || '';
    });
    inhalt.addEventListener('input', aktualisieren);
    inhalt.addEventListener('change', aktualisieren);
    inhalt.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-gp="person"]'); if (!b) return;
      var z = el(b.getAttribute('data-ziel')); var p = z && z.closest('[data-pfad]').getAttribute('data-pfad');
      var items = (A().schemaAn(st.def.schema, p) || {}).items; z.insertAdjacentHTML('beforeend', personHtml(z.children.length, items));
    });
    el('gp-zurueck').onclick = function () { reiterZeigen(st.reiter - 1); };
    el('gp-weiter').onclick = function () { if (st.reiter < st.reiterListe.length - 1) reiterZeigen(st.reiter + 1); else if (st.fertig) schliessen(); else senden(true); };
    var be = el('gp-entwurf'); be.hidden = st.art !== 'voll'; be.onclick = function () { senden(false); };
    inhalt.querySelectorAll('[data-gp="stand"]').forEach(function (b) { b.onclick = function () { standAbrufen(b.closest('.gp-zeile').getAttribute('data-rid'), b); }; });
    inhalt.querySelectorAll('[data-gp="uebernehmen"]').forEach(function (b) { b.onclick = function () { uebernehmen(b.getAttribute('data-rnd'), b.getAttribute('data-datum')); }; });
    if (st.art === 'voll') {
      var nu = nutzerDaten(), mk = {};
      try { mk = JSON.parse(localStorage.getItem(MERK_KUNDE) || '{}') || {}; } catch (e) {}
      var vorK = { firma: nu.firma, vorname: nu.vorname, nachname: nu.nachname, strasse: nu.str, hnr: nu.hnr, plz: nu.plz, ort: nu.ort, email: nu.email, telefon: nu.telefon };
      KUNDE.forEach(function (k) { var e = el('gp-k-' + k[0]); if (e) e.value = mk[k[0]] || vorK[k[0]] || ''; });
      ['gp-bes', 'gp-express', 'gp-code'].forEach(function (id) { var e = el(id); if (e) { e.addEventListener('change', preisRechnen); e.addEventListener('input', preisRechnen); } });
      preisRechnen();
    }
    aktualisieren(); aktualisieren();
    reiterZeigen(0);
  }

  /* Schrittleiste wie rnd-wizard.js renderCurrentStep(): Nummer im Kreis + Kurzname, Balken, Zaehler.
     Anders als dort sind ALLE Reiter frei anklickbar (vorbelegt, nichts wird gerechnet). */
  function reiterZeigen(n) {
    var L = st.reiterListe, max = L.length - 1;
    st.reiter = Math.max(0, Math.min(max, n));
    document.querySelectorAll('#gp-overlay .gp-reiter').forEach(function (d) { d.hidden = +d.getAttribute('data-reiter') !== st.reiter; });
    var leiste = el('gp-schritte'); leiste.innerHTML = '';
    var offen = offeneJeReiter();
    L.forEach(function (r, ri) {
      var b = document.createElement('button'); b.type = 'button';
      b.className = 'rnd-wiz-step rnd-hub-schritt' + (ri === st.reiter ? ' active' : '') + (ri < st.reiter ? ' done' : '');
      b.innerHTML = '<span class="rnd-hub-nr">' + (ri + 1) + '</span><em class="rnd-hub-kurz">' + esc(r.kurz)
        + '<span class="gp-offen' + (offen[ri] ? '' : ' gp-ok') + '" data-offen="' + ri + '">' + (offen[ri] || '✓') + '</span></em>';
      b.title = r.titel + (offen[ri] ? ' · ' + offen[ri] + ' Pflichtangabe(n) offen' : ' · vollständig');
      if (ri === st.reiter) b.setAttribute('aria-current', 'step');
      b.onclick = function () { reiterZeigen(ri); };
      leiste.appendChild(b);
    });
    el('gp-balken').style.width = (max ? st.reiter / max * 100 : 100) + '%';
    el('gp-sub').textContent = 'Schritt ' + (st.reiter + 1) + ': ' + L[st.reiter].titel + ' · Gutachten durch ' + MARKE + ', beauftragt über ' + (st.ueber || 'Junker Immobilien');
    el('gp-zurueck').style.visibility = st.reiter > 0 ? 'visible' : 'hidden';
    /* v3581 · nach dem Ergebnis heisst der Knopf „Schließen“ — ein zweiter Klick legte sonst eine zweite Anfrage an */
    el('gp-weiter').textContent = st.reiter < max ? 'Weiter →' : (st.fertig ? 'Schließen' : (st.art === 'lite' ? 'Ersteinschätzung anfordern' : 'Kostenpflichtig beauftragen'));
    zaehlerSetzen(offen);
    var body = el('gp-inhalt'); if (body) body.scrollTop = 0;
  }
  function offeneJeReiter() {
    var o = (st.reiterListe || []).map(function () { return 0; });
    (st.felder || []).forEach(function (f, i) { var b = document.querySelector('#gp-overlay [data-i="' + i + '"]'); if (b && b.classList.contains('gp-fehlt')) o[f._reiter]++; });
    if (st.art === 'voll' && o.length) o[o.length - 1] += document.querySelectorAll('#gp-overlay [data-kunde].gp-fehlt, #gp-overlay [data-zust].gp-fehlt').length;
    return o;
  }
  function zaehlerSetzen(offen) {
    var summe = offen.reduce(function (s, x) { return s + x; }, 0);
    var z = el('gp-zaehler');
    if (z) z.textContent = 'Schritt ' + (st.reiter + 1) + ' von ' + st.reiterListe.length + ' · ' + (summe ? summe + ' Pflichtangabe' + (summe === 1 ? '' : 'n') + ' offen' : 'alle Pflichtangaben gefüllt');
    offen.forEach(function (n, ri) { var s = document.querySelector('#gp-overlay [data-offen="' + ri + '"]'); if (s) { s.textContent = n || '✓'; s.classList.toggle('gp-ok', !n); } });
  }

  function eingabeSetzen(f, i, w) {
    var id = 'gp-f' + i, e = el(id);
    if (!e) return;
    if (e.getAttribute('data-wahl')) { var arr = Array.isArray(w) ? w.map(String) : [String(w)]; e.querySelectorAll('input').forEach(function (c) { c.checked = arr.indexOf(c.value) >= 0; }); return; }
    if (f.inputType === 'checkbox') { e.checked = !!w; return; }
    if (f.inputType === 'array') return;
    e.value = String(w);
  }
  function eingabeLesen(f, i) {
    var id = 'gp-f' + i, e = el(id);
    if (!e) return undefined;
    if (e.getAttribute('data-wahl') === 'radio') { var r = e.querySelector('input:checked'); return r ? r.value : ''; }
    if (e.getAttribute('data-wahl') === 'checkbox') return Array.prototype.map.call(e.querySelectorAll('input:checked'), function (c) { return c.value; });
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
  function lesen() {
    var werte = {};
    st.felder.forEach(function (f, i) {
      if (f.inputType === 'file') return;
      var box = document.querySelector('#gp-overlay [data-i="' + i + '"]');
      if (box && box.hidden) return;
      var v = eingabeLesen(f, i); if (v !== undefined) werte[A().feldPfad(f)] = v;
    });
    return A().sammeln(st.def, werte);
  }
  function aktualisieren() {
    if (!st || !st.felder) return;
    var data = lesen();
    st.felder.forEach(function (f, i) {
      var box = document.querySelector('#gp-overlay [data-i="' + i + '"]'); if (!box) return;
      box.hidden = !A().sichtbar(f, data);
      var p = A().feldPfad(f), w = A().holen(data, p);
      var leer = w === undefined || w === '' || w === false || (Array.isArray(w) && !w.length);
      var muss = !box.hidden && f.inputType !== 'file' && A().pflicht(st.def, p, data) && leer;
      box.classList.toggle('gp-fehlt', muss);
      var t = box.querySelector('[data-fehlt]'); if (t) { t.hidden = !muss; t.textContent = f.inputType === 'checkbox' ? 'bitte bestätigen' : 'fehlt – bitte ergänzen'; }
    });
    /* v3590 · Bestellung: Rechnungsangaben und Zustimmungen zaehlen im letzten Reiter */
    if (st.art === 'voll') {
      KUNDE.forEach(function (k) { var box = document.querySelector('#gp-overlay [data-kunde="' + k[0] + '"]'); if (!box) return; var leer = !String((el('gp-k-' + k[0]) || {}).value || '').trim();
        var muss = !!KUNDE_PFLICHT[k[0]] && leer; box.classList.toggle('gp-fehlt', muss); var t = box.querySelector('[data-fehlt]'); if (t) t.hidden = !muss; });
      ['daten', 'widerruf', 'kosten'].forEach(function (k) { var box = document.querySelector('#gp-overlay [data-zust="' + k + '"]'); if (box) box.classList.toggle('gp-fehlt', !(el('gp-z-' + k) || {}).checked); });
      preisRechnen();
    }
    if (st.reiterListe && el('gp-zaehler')) zaehlerSetzen(offeneJeReiter());
  }

  function fehlerZeigen(e) {
    document.querySelectorAll('#gp-overlay .gp-fehler').forEach(function (d) { if (d.id !== 'gp-allgemein') d.textContent = ''; });
    var allg = el('gp-allgemein'); if (allg) allg.textContent = '';
    if (!e || !e.message) return;
    var d = (e && e.data) || {};
    var z = A().fehlerZuordnen(st.def, d.felder || []);
    var erstes = null;
    Object.keys(z.jeFeld).forEach(function (p) {
      st.felder.forEach(function (f, i) {
        if (A().feldPfad(f) !== p && f.id !== p) return;
        var box = document.querySelector('#gp-overlay [data-i="' + i + '"]');
        if (!box || box.hidden) return;
        box.querySelector('.gp-fehler').textContent = A().neutral(z.jeFeld[p].join(' · '));
        if (!erstes) erstes = { box: box, reiter: f._reiter };
      });
    });
    if (allg) allg.textContent = [A().neutral(e.message)].concat(z.allgemein.map(A().neutral)).join(' · ');
    /* Fehler am Feld: in seinen Reiter springen */
    if (erstes) { reiterZeigen(erstes.reiter); erstes.box.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

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
      var box = document.querySelector('#gp-overlay [data-i="' + i + '"]'); if (box && box.hidden) return;
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

  /* v3590 · Gutachten: Entwurf und Auftrag ueber POST /auftraege (Preis, Kunde, Zustimmungen); Dateien nach dem Entwurf */
  function auftragSenden(beauftragen) {
    var knopf = el('gp-weiter'), ent = el('gp-entwurf');
    var z = zustimmungenLesen();
    if (beauftragen && !(z.daten && z.widerruf && z.kosten)) { reiterZeigen(st.reiterListe.length - 1); fehlerZeigen({ message: 'Bitte unten die drei Bestätigungen setzen.' }); return; }
    if (!z.daten) { reiterZeigen(st.reiterListe.length - 1); fehlerZeigen({ message: 'Ohne deine Zustimmung zur Übermittlung können wir den Auftrag nicht speichern.' }); return; }
    /* v3591 · gemessen: ein Auftrag mit 13 offenen Pflichtangaben ging als „bestellt“ durch - der Entwurf beim
       Partner nimmt Luecken an, das Absenden dort scheitert spaeter. Beauftragen erst, wenn alles gefuellt ist. */
    if (beauftragen) {
      var offen = offeneJeReiter(), erster = offen.findIndex(function (n) { return n > 0; });
      if (erster >= 0) { reiterZeigen(erster); fehlerZeigen(null); var al = el('gp-allgemein'); if (al) al.textContent = ''; 
        var zz = el('gp-zaehler'); if (zz) zz.textContent = 'Bitte zuerst alle Pflichtangaben füllen (' + offen.reduce(function (x, y) { return x + y; }, 0) + ' offen) – „Entwurf speichern“ geht jederzeit.'; return; }
    }
    var data = lesen(), kunde = kundeLesen();
    try { localStorage.setItem(MERK_KUNDE, JSON.stringify(kunde)); } catch (e) {}
    [knopf, ent].forEach(function (b) { if (b) b.disabled = true; });
    var alt = knopf.textContent; knopf.textContent = beauftragen ? 'wird beauftragt …' : 'wird gespeichert …';
    var hatDateien = st.felder.some(function (f) { var s = el('gp-f' + st.felder.indexOf(f)), d = el('gp-f' + st.felder.indexOf(f) + '-datei'); return f.inputType === 'file' && ((s && s.value) || (d && d.files && d.files[0])); });
    var body = function (b) { return { objekt_id: objektId(), data: data, kunde: kunde, auswahl: auswahlLesen(), zustimmungen: z, request_id: st.rid, beauftragen: b }; };
    var schritt1 = (hatDateien || !beauftragen) ? api('/auftraege', { method: 'POST', body: body(false) }) : null;
    var p = schritt1 ? schritt1.then(function (r) { st.rid = r.auftrag.request_id; return beauftragen ? dateienHochladen().then(function () { return api('/auftraege', { method: 'POST', body: body(true) }); }) : r; })
      : api('/auftraege', { method: 'POST', body: body(true) });
    p.then(function (r) {
      st.rid = r.auftrag.request_id;
      fehlerZeigen(null);
      var a = r.auftrag || {};
      if (a.status === 'beauftragt' || a.status === 'bestellt') st.fertig = true;
      reiterZeigen(st.reiterListe.length - 1);
      el('gp-ergebnis').innerHTML = '<div class="gp-erg"><div class="gp-herk" style="text-transform:uppercase;letter-spacing:1.4px;font-weight:600">' + ({ beauftragt: 'Beauftragt', bestellt: 'Bestellt' }[a.status] || 'Entwurf gespeichert')
        + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '') + '</div><div class="gp-zahl" style="font-size:22px;margin:4px 0">' + eurT(a.preis && a.preis.endpreis) + '</div>'
        + '<p class="gp-herk" style="margin:0">' + (a.status === 'beauftragt' || a.status === 'bestellt' ? 'Junker Immobilien hat deine Bestellung erhalten und gibt sie an ' + MARKE + ' weiter. Die Rechnung kommt nach Erhalt des Gutachtens.' : 'Du kannst den Entwurf später beauftragen.') + '</p></div>';
      el('gp-ergebnis').scrollIntoView({ block: 'center', behavior: 'smooth' });
    }).catch(function (e) {
      if (e && e.data && e.data.request_id) st.rid = e.data.request_id;
      fehlerZeigen(e);
      (e && e.data && e.data.felder || []).forEach(function (x) {
        var m = /^kunde\.(\w+)$/.exec(x.path) || /^zustimmung\.(\w+)$/.exec(x.path);
        var box = m && document.querySelector('#gp-overlay [data-kunde="' + m[1] + '"], #gp-overlay [data-zust="' + m[1] + '"]');
        if (box) { box.querySelector('.gp-fehler').textContent = x.message; reiterZeigen(st.reiterListe.length - 1); }
      });
    }).then(function () { [knopf, ent].forEach(function (b) { if (b) b.disabled = false; }); knopf.textContent = st.fertig ? 'Schließen' : alt; });
  }

  function senden(absenden) {
    if (st.art === 'voll') return auftragSenden(absenden);
    var knopf = el('gp-weiter'), ent = el('gp-entwurf');
    var data = lesen();
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
      st.gesendet = data;
      ergebnisZeigen(r && r.anfrage, absenden, Date.now() - t0);
    }).catch(function (e) {
      if (e && e.data && e.data.request_id) st.rid = e.data.request_id;
      fehlerZeigen(e);
    }).then(function () { [knopf, ent].forEach(function (b) { if (b) b.disabled = false; }); knopf.textContent = st.fertig ? 'Schließen' : alt; });
  }

  /* Hauptzahl: unsere AfA (100 ÷ RND); die AfA von gutachten.org nur klein daneben (Marcel 16.11.2026) */
  function ergebnisKarte(a, ms) {
    var r = a.result || {}, unsere = unsereAfa(r.finalAverageRUL);
    var partner = Number(r.annualDepreciation);
    var abw = isFinite(partner) && unsere && Math.abs(partner - unsere) >= 0.005;
    return '<div class="gp-erg"><div class="gp-herk" style="text-transform:uppercase;letter-spacing:1.4px;font-weight:600">Ersteinschätzung von ' + MARKE + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '') + (a.umgebung === 'test' ? ' · Testumgebung' : '') + (ms ? ' · in ' + zahl(ms / 1000, 1) + ' s' : '') + '</div>'
      + '<div style="display:flex;gap:32px;flex-wrap:wrap;margin:6px 0 8px"><div><div class="gp-zahl">' + zahl(r.finalAverageRUL) + ' Jahre</div><div class="gp-herk">voraussichtliche Restnutzungsdauer' + (r.finalRangeRUL ? ' (Spanne ' + esc(r.finalRangeRUL) + ' Jahre)' : '') + '</div></div>'
      + (unsere ? '<div><div class="gp-zahl">' + zahl(unsere, 2) + ' %</div><div class="gp-herk">jährliche AfA (100 ÷ ' + zahl(Math.round(r.finalAverageRUL)) + ' Jahre)' + (abw ? ' · ' + MARKE + ' nennt ' + zahl(partner, 2) + ' %' : '') + '</div></div>' : '') + '</div>'
      + '<p class="gp-herk" style="margin:0 0 10px">Ersteinschätzung, kein Gutachten. Für einen eigenen AfA-Satz verlangt das Finanzamt ein Gutachten.</p>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="gp-knopf" id="gp-uebernehmen">Als Restnutzungsdauer übernehmen</button>'
      + '<button type="button" class="gp-knopf gp-primaer" id="gp-zum-gutachten">Gutachten beauftragen →</button></div>'
      + '<p class="gp-herk" style="margin:8px 0 0">Das Gutachten erstellt ' + MARKE + ', beauftragt über ' + esc(st.ueber || 'Junker Immobilien') + ' – Festpreis nach Wohnfläche, Preis vor dem Absenden.</p></div>';
  }
  function ergebnisZeigen(a, abgesendet, ms) {
    var box = el('gp-ergebnis'); if (!box || !a) return;
    if (abgesendet && a.status && a.status !== 'draft') st.fertig = true;
    reiterZeigen(st.reiterListe.length - 1);
    var r = a.result || {};
    if (st.art === 'lite') {
      if (r.finalAverageRUL) {
        box.innerHTML = ergebnisKarte(a, a.dauer_ms || ms);
        el('gp-uebernehmen').onclick = function () { uebernehmen(r.finalAverageRUL, datum(a.updated_at || new Date())); };
        el('gp-zum-gutachten').onclick = function () { oeffnen('voll', { vorlage: st.gesendet || {} }); };
      } else {
        box.innerHTML = '<div class="gp-erg"><div class="gp-herk">Anfrage gestellt' + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '') + '</div>'
          + '<div id="gp-warte">Die Ersteinschätzung liegt bei ' + MARKE + ' bereit und wird abgerufen …</div>'
          + '<button type="button" class="gp-knopf" id="gp-abrufen" style="margin-top:8px">Ergebnis abrufen</button></div>';
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
      box.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    box.innerHTML = '<div class="gp-erg"><div class="gp-herk">' + (abgesendet ? 'Beauftragt' : 'Entwurf gespeichert') + (a.request_number ? ' · Nr. ' + esc(a.request_number) : '') + '</div>'
      + 'Stand: ' + esc(STATUS_TEXT[a.status] || a.status || '') + (a.umgebung === 'test' ? ' · Testumgebung' : '')
      + (a.attachments && a.attachments.length ? ' · ' + a.attachments.length + ' Unterlage(n)' : '') + '. Den Stand rufst du hier später über „Stand abrufen“ ab.</div>';
    box.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function standAbrufen(rid, knopf) {
    if (knopf) { knopf.disabled = true; knopf.textContent = 'fragt ab …'; }
    api('/anfragen/' + encodeURIComponent(rid)).then(function (r) {
      var a = r.anfrage || {}, res = a.result || {};
      var zeile = knopf && knopf.closest('.gp-zeile');
      if (zeile) {
        var sp = zeile.querySelector('[data-gp="stat"]'); if (sp) sp.textContent = (STATUS_TEXT[a.status] || a.status || '') + (a.umgebung === 'test' ? ' · Testumgebung' : '');
        if (res.finalAverageRUL && !zeile.querySelector('[data-gp="uebernehmen"]')) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'gp-knopf'; b.textContent = 'Als RND übernehmen';
          b.onclick = function () { uebernehmen(res.finalAverageRUL, datum(a.updated_at)); }; zeile.appendChild(b);
        }
      }
      if (knopf) knopf.textContent = 'aktuell';
    }).catch(function (e) { if (knopf) { knopf.textContent = 'Fehler'; knopf.title = A().neutral(e.message); } })
      .then(function () { if (knopf) knopf.disabled = false; });
  }

  /* Nur auf Klick: Ersteinschaetzung als eigene RND im Reiter Steuer (js/afa-eigen.js setzen(): 100 ÷ RND) */
  function uebernehmen(rnd, dat) {
    var n = Math.round(Number(rnd));
    if (!(n >= 3 && n <= 200) || !window.DpAfaEigen || !DpAfaEigen.setzen) return;
    var ok = DpAfaEigen.setzen(n, 'Ersteinschätzung ' + MARKE + (dat ? ' vom ' + dat : '') + ' (kein Gutachten)');
    if (ok) { schliessen(); if (typeof window.toast === 'function') window.toast('Restnutzungsdauer ' + n + ' Jahre übernommen. Für das Finanzamt braucht es ein Gutachten.'); }
  }

  window.DpGutachterpartner = { oeffnen: oeffnen, status: status, einbauen: einbauen, _mitNull: mitNull, _unsereAfa: unsereAfa, _REITER: REITER };
})();
