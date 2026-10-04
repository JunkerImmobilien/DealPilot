'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   objekt-reiter.js — v1851 · N4 · Der Reiter Objekt in drei Ebenen
   ═══════════════════════════════════════════════════════════════════════

   Marcel, 04.10.2026: „Liegenschaftszinssatz und allem, die können wir ja
   automatisch ermitteln, genauso wie den Bodenrichtwert." Und zur
   Vorlage: „sieht gut aus … in dem Stil und layout wie es aktuell auch
   im dealpilot ist."

   Dieses Modul rechnet NICHTS selbst. Es liest:
     · den amtlichen Zins, GND/RND, die Sachwertfaktor-QUELLE und den
       Baupreisindex aus dem Marktbericht-Dienst (/wertparameter/zinssatz,
       seit v1846 bzw. v1851) — derselbe Weg, den der Bericht geht;
     · den Standardstufen-Vorschlag je Gewerk aus demselben Dienst
       (/ausstattung/vorschlag) — dieselbe Tabelle wie im Bericht;
     · die Modernisierungspunkte aus DealPilotRND_Wizard.modPunkte()
       (ein Rechenkern, keine Kopie);
     · das Kontingent aus /ai/credits.

   Die Feld-IDs sind die alten (tools/n4-umbau-index.mjs). Was hier steht,
   ist Anzeige und Ableitung — gespeichert wird weiter über storage.FIELDS.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var _v = function (id) { var e = $(id); return e ? String(e.value || '').trim() : ''; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var deNum = function (n, d) { try { return new Intl.NumberFormat('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).format(n); } catch (e) { return String(n); } };

  async function api(path, body) {
    if (!window.Auth || typeof Auth.apiCall !== 'function') return null;
    try { return await Auth.apiCall(path, body ? { method: 'POST', body: body } : undefined); }
    catch (e) { return null; }
  }

  /* ── Objekt, wie es der Dienst braucht (nur was den Zins bestimmt) ──── */
  function objektFuerApi() {
    return { plz: _v('plz'), ort: _v('ort'), str: _v('str'), hnr: _v('hnr'), objart: _v('objart'),
             baujahr: _v('baujahr'), einheiten: _v('einheiten'), nutzungsart: _v('nutzungsart'), wfl: _v('wfl') };
  }

  /* ═══ Automatik-Leiste ═══════════════════════════════════════════════ */
  var _autoLauf = 0;
  function zeile(k, w, q, aktion) {
    return '<div class="oe-row"><span class="oe-k">' + k + '</span><span class="oe-w">' + w + '</span><span class="oe-q">' + q + '</span><span>' + (aktion || '') + '</span></div>';
  }
  function st(cls, txt) { return '<span class="oe-st ' + cls + '">' + esc(txt) + '</span>'; }
  function knopf(txt, feld) { return '<button type="button" class="oe-btn" data-oe-feld="' + feld + '">' + txt + '</button>'; }

  function brwZeile() {
    var brw = _v('brw'), stich = _v('brw_stichtag');
    var status = $('brw-ai-status') ? String($('brw-ai-status').textContent || '').trim() : '';
    var manuell = _v('brw_manuell');
    var q = status ? esc(status) : 'noch nicht abgerufen — Knopf „Bodenrichtwert abrufen" oben';
    if (stich) q += ' · Stichtag ' + esc(stich);
    if (manuell) q = st('b', 'abweichend') + 'eigener Ansatz ' + esc(manuell) + ' €/m² — ' + q;
    return zeile('Bodenrichtwert', brw ? esc(brw) + ' €/m²' : '—', q, knopf(manuell ? 'Ansatz ändern' : 'abweichend eintragen', 'brw_manuell'));
  }

  function modPunkte() {
    var W = window.DealPilotRND_Wizard;
    if (!W || typeof W.modPunkte !== 'function') return null;
    var mod = { dach: _v('mod_dach'), fenster: _v('mod_fenster'), leitungen: _v('mod_leitungen'), heizung: _v('mod_heizung'),
                aussenwand: _v('mod_aussenwand'), baeder: _v('mod_baeder'), innenausbau: _v('mod_innenausbau'), grundriss: _v('mod_grundriss') };
    var n = 0; Object.keys(mod).forEach(function (k) { if (mod[k]) n++; });
    if (!n) return null;
    try { var p = W.modPunkte(mod); return { total: p.total, elements: p.elements, angaben: n }; } catch (e) { return null; }
  }

  /* Die Punkte wandern ins Feld mod_punkte (Select mit festen Stufen): die
     exakte Zahl bekommt eine eigene Option, damit nichts gerundet wird. */
  function modPunkteSchreiben(p) {
    var sel = $('mod_punkte'); if (!sel) return;
    if (!p) return;
    var v = String(p.total);
    var opt = Array.prototype.find.call(sel.options, function (o) { return o.value === v; });
    if (!opt) { opt = document.createElement('option'); opt.value = v; opt.textContent = v + ' Punkte (aus den Gewerken)'; opt.setAttribute('data-oe-auto', '1'); sel.appendChild(opt); }
    if (sel.value !== v) { sel.value = v; }
  }

  async function automatik() {
    var box = $('oe-auto'); if (!box) return;
    var lauf = ++_autoLauf;
    var o = objektFuerApi();
    var mp = modPunkte();
    modPunkteSchreiben(mp);
    var mpZeile = zeile('Modernisierungspunkte', mp ? mp.total + ' von 20' : '—',
      mp ? st('b', 'gerechnet') + mp.angaben + ' von 8 Bauteilen angegeben (Gewerke-Tabelle, Anlage 2)' : 'aus der Spalte „modernisiert" in der Gewerke-Tabelle', '');
    if (!o.plz) {
      box.innerHTML = brwZeile() + zeile('Liegenschaftszins', '—', 'PLZ eintragen — dann holt DealPilot den amtlichen Satz', '')
        + zeile('Sachwertfaktor', '—', 'PLZ eintragen', '') + zeile('GND / RND', '—', 'Baujahr und Objektart eintragen', '') + mpZeile;
      return;
    }
    box.innerHTML = brwZeile() + zeile('Liegenschaftszins', '…', 'wird aus dem Register gelesen', '') + mpZeile;
    var r = await api('/marktbericht/wertparameter/zinssatz', { object: o });
    if (lauf !== _autoLauf) return;
    var html = brwZeile();
    if (!r || !r.verfuegbar) {
      var grund = (r && r.grund) || 'Register nicht erreichbar';
      var aus = r && r.ausschuss ? ' · ' + esc(r.ausschuss) : '';
      html += zeile('Liegenschaftszins', '—', st('x', 'kein Wert') + esc(grund) + aus, knopf('eintragen', 'lzs_pct'));
      html += zeile('Sachwertfaktor', '—', st('x', 'kein Wert') + 'ohne Zuordnung zum Ausschuss keine Tabelle', knopf('eintragen', 'sachwertfaktor'));
      html += zeile('GND / RND', '—', 'Anlage 1/2 ImmoWertV — wird im Bericht aus Baujahr und Modernisierungspunkten abgeleitet', '');
    } else {
      var stufe = r.stufe || '?';
      var cls = stufe === 'A' ? 'a' : (stufe === 'B' || stufe === 'C') ? 'b' : 'x';
      var q = st(cls, 'Stufe ' + stufe) + esc(r.quelle || r.ausschuss || '') + (r.berichtsjahr ? ' · ' + esc(r.berichtsjahr) : '')
            + (r.zweig ? ' · ' + esc(r.zweig) : '') + (r.quelle_url ? ' · <a href="' + esc(r.quelle_url) + '" target="_blank" rel="noopener">Quelle</a>' : '');
      var eigen = _v('lzs_pct');
      if (eigen) q = st('b', 'abweichend') + 'eigener Ansatz ' + esc(eigen) + ' % — amtlich ' + q;
      html += zeile('Liegenschaftszins', deNum(r.wert_pct, 2) + ' %', q, knopf(eigen ? 'Ansatz ändern' : 'abweichend eintragen', 'lzs_pct'));
      var sq = r.sachwertfaktor_quelle;
      var swfEigen = _v('sachwertfaktor');
      if (swfEigen) html += zeile('Sachwertfaktor', esc(swfEigen), st('b', 'eigener Ansatz') + 'statt der Tabelle des Ausschusses', knopf('Ansatz ändern', 'sachwertfaktor'));
      else if (sq && sq.verfuegbar) html += zeile('Sachwertfaktor', 'im Bericht', st('a', 'Tabelle') + esc(sq.ausschuss || r.ausschuss || '') + ' führt Faktoren — der Wert hängt am vorläufigen Sachwert (§ 21 Abs. 3) und entsteht im Bericht', knopf('abweichend eintragen', 'sachwertfaktor'));
      else html += zeile('Sachwertfaktor', '—', st('x', 'kein Wert') + esc((sq && sq.hinweis) || 'Für diesen Ausschuss sind keine Sachwertfaktoren hinterlegt.'), knopf('eintragen', 'sachwertfaktor'));
      var gq = r.gnd_quelle === 'register' ? st('a', 'Register') : st('b', 'Anlage 1');
      html += zeile('GND / RND', (r.gnd_jahre || '—') + ' / ' + (r.rnd_jahre != null ? r.rnd_jahre : '—') + ' J.',
        gq + 'Gesamtnutzungsdauer ' + (r.gnd_quelle === 'register' ? 'aus dem Modell des Ausschusses' : 'nach Anlage 1 ImmoWertV') + ' · Restnutzungsdauer aus Baujahr' + (mp ? ' — mit ' + mp.total + ' Modernisierungspunkten rechnet der Bericht nach Anlage 2 neu' : ''), '');
      var bpi = r.baupreisindex;
      if (bpi && bpi.wert) html += zeile('Baupreisindex', deNum(bpi.wert, 2), st('b', 'Konstante') + '2010 → ' + esc(bpi.stichtag || '') + ' · noch nicht je Ausschuss (Backlog B1)', '');
    }
    html += mpZeile;
    box.innerHTML = html;
  }

  /* „abweichend eintragen": Ebene 3 öffnen und das Feld zeigen */
  function abweichend(feld) {
    var card = document.querySelector('.card[data-collapsible="wm-obj"]');
    if (card && card.classList.contains('v212-collapsed')) { var t = card.querySelector('.v212-collapse-toggle'); if (t) t.click(); }
    var el = $(feld); if (!el) return;
    setTimeout(function () { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus(); } catch (e) {} }, 120);
  }

  /* ═══ Stufen-Knöpfe mit Kontingent ═══════════════════════════════════ */
  async function stufen() {
    var box = $('oe-stufen'); if (!box) return;
    var k = await api('/ai/credits');
    var arten = (k && k.arten) || {};
    var rest = function (art) { var a = arten[art]; return (a && typeof a.rest === 'number') ? a.rest : null; };
    var r1 = rest('mpi'), r2 = rest('mpi_plus'), r3 = rest('wev');
    var frei = function (n) { return n == null ? '' : ' · ' + n + ' frei'; };
    box.innerHTML =
      '<button type="button" class="oe-btn solid" data-oe-stufe="1"' + (r1 === 0 ? ' disabled title="Kontingent aufgebraucht"' : '') + '>Marktbericht Stufe 1' + frei(r1) + '</button>'
      + '<button type="button" class="oe-btn" data-oe-stufe="2"' + (r2 === 0 ? ' disabled title="Erweiterte Indikation: ab Investor"' : '') + '>Stufe 2 · erweitert' + frei(r2) + '</button>'
      + '<button type="button" class="oe-btn" data-oe-stufe="3"' + (r3 === 0 ? ' disabled title="Wertermittlung nach ImmoWertV: ab Pro"' : '') + '>Stufe 3 · Wertermittlung ImmoWertV' + frei(r3) + '</button>'
      + '<span class="oe-stufen-hint">Stufe 3 braucht die Angaben aus „Für das Gutachten" unten — fehlt etwas, erscheint das Verfahren nicht.' + (r3 === 0 ? ' Die Wertermittlung gehört zum Pro-Plan.' : '') + '</span>';
  }

  /* ═══ Gewerke: Stufenvorschlag aus derselben Tabelle wie der Bericht ══ */
  var EQ = ['eq_walls', 'eq_roof', 'eq_windows', 'eq_bath', 'eq_guest_wc', 'eq_heating', 'eq_floor'];
  var GEWERKE = { aussenwaende: 'ausst_aussenwaende', dach: 'ausst_dach', fenster_tueren: 'ausst_fenster', innenwaende: 'ausst_innenwaende',
                  decken_treppen: 'ausst_decken', fussboeden: 'ausst_fussboeden', sanitaer: 'ausst_sanitaer', heizung: 'ausst_heizung', sonstige_technik: 'ausst_technik' };
  var _gewLauf = 0;
  function eigeneGewerke() {
    var o = {}; Object.keys(GEWERKE).forEach(function (k) { var v = parseFloat(_v(GEWERKE[k]).replace(',', '.')); if (v >= 1 && v <= 5) o[k] = v; }); return o;
  }
  function vorschlagZeigen(sel, n) {
    if (!sel) return;
    var o0 = sel.options[0];
    if (!o0) return;
    if (!o0.hasAttribute('data-oe-orig')) o0.setAttribute('data-oe-orig', o0.textContent);
    if (n && !sel.value) { o0.textContent = 'Vorschlag ' + String(n).replace('.', ','); sel.classList.add('oe-vorschlag'); sel.setAttribute('data-oe-vorschlag', String(n)); }
    else { o0.textContent = o0.getAttribute('data-oe-orig'); sel.classList.remove('oe-vorschlag'); sel.removeAttribute('data-oe-vorschlag'); }
  }
  async function gewerke() {
    if (!$('oe-gewerke')) return;
    var lauf = ++_gewLauf;
    var eq = {}; var n = 0; EQ.forEach(function (id) { var v = _v(id); if (v) { eq[id] = v; n++; } });
    var eigene = eigeneGewerke();
    var r = n ? await api('/marktbericht/ausstattung/vorschlag', { eq: eq, gewerke: eigene }) : null;
    if (lauf !== _gewLauf) return;
    var vor = (r && r.gewerke) || {};
    Object.keys(GEWERKE).forEach(function (k) { vorschlagZeigen($(GEWERKE[k]), vor[k] || null); });
    /* Standardstufe des Gebäudes: nur als Vorschlag im leeren Select */
    var ss = $('standardstufe');
    if (ss) {
      var text = null;
      if (r && r.standardstufe) text = 'Vorschlag ' + r.standardstufe + ' (alle neun Gewerke)';
      else if (r && r.standardstufe_roh) text = 'Vorschlag ' + String(r.standardstufe_roh).replace('.', ',') + ' · erst ' + r.abdeckung_pct + ' von 100 Anteilen';
      var o0 = ss.options[0];
      if (o0) {
        if (!o0.hasAttribute('data-oe-orig')) o0.setAttribute('data-oe-orig', o0.textContent);
        o0.textContent = (text && !ss.value) ? text : o0.getAttribute('data-oe-orig');
        ss.classList.toggle('oe-vorschlag', !!(text && !ss.value));
      }
    }
    var hint = $('oe-gewerke-hint');
    if (hint && r && r.hinweise && r.hinweise.length) hint.setAttribute('title', r.hinweise.join(' '));
  }

  /* ═══ Lage: Einschätzung neben Datenlage (sobald ein Bericht da ist) ═ */
  function lageVergleich() {
    var box = $('oe-lage-vergleich'); if (!box) return;
    var D = null;
    try { D = (window.DealPilotMB && typeof DealPilotMB.letzter === 'function') ? DealPilotMB.letzter() : null; } catch (e) {}
    var eig = [['Makrolage', _v('makrolage')], ['Mikrolage', _v('mikrolage')], ['Bevölkerung', _v('ds2_bevoelkerung')], ['Nachfrage', _v('ds2_nachfrage')]]
      .filter(function (p) { return p[1]; }).map(function (p) { return p[0] + ' <b>' + esc(p[1].replace(/_/g, ' ')) + '</b>'; });
    if (!eig.length && !D) { box.style.display = 'none'; return; }
    var dat = [];
    if (D) {
      if (D.makro && D.makro !== '–') dat.push('Makrolage <b>' + esc(D.makro) + '</b>');
      if (D.mikro && D.mikro !== '–') dat.push('Mikrolage <b>' + esc(D.mikro) + '</b>');
      if (D.tageRaw != null) dat.push('Vermarktungsdauer <b>' + esc(D.tageRaw) + ' Tage</b>');
      if (D.bevRaw != null) dat.push('Bevölkerung <b>' + (D.bevRaw >= 0 ? '+' : '') + esc(deNum(D.bevRaw, 1)) + ' %</b>');
    }
    box.innerHTML = '<div class="oe-box"><h5>IHRE EINSCHÄTZUNG</h5>' + (eig.length ? eig.join(' · ') : '<span class="oe-leer">noch keine</span>') + '</div>'
      + '<div class="oe-box"><h5>DATENLAGE (GeoMap · Zensus · Makro-Score)</h5>' + (dat.length ? dat.join(' · ') : '<span class="oe-leer">erscheint nach dem ersten Marktbericht</span>') + '</div>';
    box.style.display = '';
  }

  /* ═══ Verdrahtung ════════════════════════════════════════════════════ */
  var _t = null;
  function spaeter(fn, ms) { clearTimeout(_t); _t = setTimeout(fn, ms || 350); }
  function alles() { automatik(); gewerke(); lageVergleich(); }
  var _verdrahtet = false;
  function verdrahten() {
    if (_verdrahtet || !$('oe-auto')) return;
    _verdrahtet = true;
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-oe-feld]'); if (b) { abweichend(b.getAttribute('data-oe-feld')); return; }
      var s = e.target.closest('[data-oe-stufe]');
      if (s && window.DealPilotMB && typeof DealPilotMB.run === 'function') { DealPilotMB.run({ stufe: parseInt(s.getAttribute('data-oe-stufe'), 10) }); }
    });
    ['plz', 'ort', 'objart', 'baujahr', 'einheiten', 'nutzungsart', 'brw', 'brw_stichtag', 'lzs_pct', 'sachwertfaktor', 'brw_manuell'].forEach(function (id) {
      var el = $(id); if (!el) return;
      el.addEventListener('change', function () { spaeter(automatik); });
      el.addEventListener('input', function () { spaeter(automatik, 700); });
    });
    EQ.forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', function () { spaeter(gewerke, 150); }); });
    Object.keys(GEWERKE).forEach(function (k) {
      var el = $(GEWERKE[k]); if (!el) return;
      el.addEventListener('change', function () {
        spaeter(gewerke, 150);
        /* die Stufen gehen in den Investor Deal Score (statt der Sterne) */
        if (typeof renderDealScore2 === 'function') { try { renderDealScore2(); } catch (e) {} }
        if (typeof calc === 'function') { try { calc(); } catch (e) {} }
      });
    });
    ['mod_dach', 'mod_fenster', 'mod_leitungen', 'mod_heizung', 'mod_aussenwand', 'mod_baeder', 'mod_innenausbau', 'mod_grundriss'].forEach(function (id) {
      var el = $(id); if (el) el.addEventListener('change', function () { spaeter(automatik, 100); });
    });
    ['makrolage', 'mikrolage', 'ds2_bevoelkerung', 'ds2_nachfrage'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', function () { spaeter(lageVergleich, 100); }); });
    document.addEventListener('dp:object-ready', function () { setTimeout(function () { alles(); stufen(); }, 80); });
    document.addEventListener('dp:plan-ready', function () { stufen(); });
    alles(); stufen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten); else verdrahten();
  setTimeout(verdrahten, 600); setTimeout(verdrahten, 2500);

  window.DealPilotObjektReiter = { automatik: automatik, gewerke: gewerke, stufen: stufen, lageVergleich: lageVergleich, abweichend: abweichend, modPunkte: modPunkte };
})();
