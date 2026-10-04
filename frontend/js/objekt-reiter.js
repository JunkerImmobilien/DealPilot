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
    var q = status ? esc(status) : (brw ? 'gespeicherter Wert — Herkunft nicht vermerkt (Abruf oder Eingabe)' : 'noch nicht abgerufen — Knopf „Bodenrichtwert abrufen" oben');
    if (stich) q += ' · Stichtag ' + esc(stich);
    if (manuell) q = st('b', 'abweichend') + 'eigener Ansatz ' + esc(manuell) + ' €/m² — ' + q;
    return zeile('Bodenrichtwert', brw ? esc(brw) + ' €/m²' : '—', q, knopf(manuell ? 'ändern' : 'eintragen', 'brw_manuell'));
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
      /* Die Quelle ist ein ganzer Satz (Ausschuss, Traeger, Lizenz) — in der
         Zeile steht der erste Teil, der Rest als Tooltip. */
      var qv = String(r.quelle || r.ausschuss || ''), qk = qv.split(',')[0];
      var q = st(cls, 'Stufe ' + stufe) + '<span title="' + esc(qv) + '">' + esc(qk) + '</span>' + (r.berichtsjahr ? ' · ' + esc(r.berichtsjahr) : '')
            + (r.zweig ? ' · ' + esc(r.zweig) : '') + (r.quelle_url ? ' · <a href="' + esc(r.quelle_url) + '" target="_blank" rel="noopener">Quelle</a>' : '');
      var eigen = _v('lzs_pct');
      if (eigen) q = st('b', 'abweichend') + 'eigener Ansatz ' + esc(eigen) + ' % — amtlich ' + q;
      html += zeile('Liegenschaftszins', deNum(r.wert_pct, 2) + ' %', q, knopf(eigen ? 'ändern' : 'eintragen', 'lzs_pct'));
      var sq = r.sachwertfaktor_quelle;
      var swfEigen = _v('sachwertfaktor');
      if (swfEigen) html += zeile('Sachwertfaktor', esc(swfEigen), st('b', 'eigener Ansatz') + 'statt der Tabelle des Ausschusses', knopf('ändern', 'sachwertfaktor'));
      /* v1852 · Marcel an der Bismarckstraße: „steht ‚im Bericht' — was ist
         damit gemeint?" Jetzt steht da, WAS der Ausschuss führt: eine
         Tabelle (dann wird der Faktor im Bericht aus dem vorläufigen
         Sachwert abgelesen, § 21 Abs. 3 — vorher gibt es ihn nicht) oder
         eben keine für diese Objektart (Lippe: nur EZFH). Eintragen geht
         immer, als eigener Ansatz. */
      else if (sq && sq.verfuegbar) html += zeile('Sachwertfaktor', 'Tabelle vorhanden', st('a', 'Ausschuss') + '<span title="' + esc(sq.ausschuss || '') + '">' + esc((sq.ausschuss || r.ausschuss || '').split(',')[0]) + '</span>' + ' — der Faktor wird im Bericht aus dem vorläufigen Sachwert abgelesen (§ 21 Abs. 3), vorher gibt es keine Zahl', knopf('eintragen', 'sachwertfaktor'));
      else html += zeile('Sachwertfaktor', '—', st('x', 'kein Wert') + esc((sq && sq.hinweis) || 'Für diesen Ausschuss sind keine Sachwertfaktoren hinterlegt.') + (sq && sq.ausschuss ? ' <span class="oe-q" title="' + esc(sq.ausschuss) + '">(' + esc(String(sq.ausschuss).split(',')[0]) + ')</span>' : ''), knopf('eintragen', 'sachwertfaktor'));
      var gq = r.gnd_quelle === 'register' ? st('a', 'Register') : st('b', 'Anlage 1');
      html += zeile('GND / RND', (r.gnd_jahre || '—') + ' / ' + (r.rnd_jahre != null ? r.rnd_jahre : '—') + ' J.',
        gq + 'Gesamtnutzungsdauer ' + (r.gnd_quelle === 'register' ? 'aus dem Modell des Ausschusses' : 'nach Anlage 1 ImmoWertV') + ' · Restnutzungsdauer aus Baujahr' + (mp ? ' — mit ' + mp.total + ' Modernisierungspunkten rechnet der Bericht nach Anlage 2 neu' : ''), '');
      var bpi = r.baupreisindex;
      if (bpi && bpi.wert) html += zeile('Baupreisindex', deNum(bpi.wert, 2), st('b', 'Konstante') + '2010 → ' + esc(bpi.stichtag || '') + ' · noch nicht je Ausschuss (Backlog B1)', '');
    }
    html += mpZeile;
    box.innerHTML = html;
    /* v1855 · was der Anfragen-Block wissen muss: fehlt der Zins, fehlt der Faktor? */
    _leiste = { zins: !!(r && r.verfuegbar), swf: !!(r && r.sachwertfaktor_quelle && r.sachwertfaktor_quelle.verfuegbar),
                ausschuss: (r && (r.ausschuss || r.quelle)) || null, swfHinweis: (r && r.sachwertfaktor_quelle && r.sachwertfaktor_quelle.hinweis) || null };
    quellen();
  }

  /* ═══ Quellen und Anfragen ═══════════════════════════════════════════
     Marcel: „für die Sachwertfaktoren und Liegenschaftszinsen … auch dort
     diese Unterlagenanfrage … und dann geben wir dann auch die Quelle an …
     die passende Seite, gleich die Verlinkung … oder halt das PDF direkt."
     Quelle ist das Register (/marktbericht/quellen?plz=): je Kennzahl der
     Ausschuss, der Jahrgang und der Link — oder „fehlt" mit dem Weg. */
  var _leiste = null, _quellenLauf = 0;
  async function quellen() {
    var box = $('oe-quellen'), hint = $('oe-anfragen-hint'); if (!box) return;
    var plz = _v('plz');
    if (!plz) { box.innerHTML = ''; if (hint) hint.textContent = ''; return; }
    var lauf = ++_quellenLauf;
    var q = await api('/marktbericht/quellen?plz=' + encodeURIComponent(plz));
    if (lauf !== _quellenLauf) return;
    var NAME = { lzs: 'Liegenschaftszins', liegenschaftszins: 'Liegenschaftszins', swf: 'Sachwertfaktor', sachwertfaktor: 'Sachwertfaktor', brw: 'Bodenrichtwert', bodenrichtwert: 'Bodenrichtwert', vergleichsfaktor: 'Vergleichsfaktor', gnd: 'Gesamtnutzungsdauer' };
    var zeilen = [];
    var hinterlegt = (q && q.hinterlegt) || [], fehlt = (q && q.fehlt) || [];
    hinterlegt.forEach(function (e) {
      var link = e.quelle_url ? '<a href="' + esc(e.quelle_url) + '" target="_blank" rel="noopener">' + (/\.pdf(\?|$)/i.test(e.quelle_url) ? 'Bericht (PDF) öffnen' : 'Quelle öffnen') + '</a>' : '<span class="oe-leer">kein Link hinterlegt</span>';
      zeilen.push('<div class="oe-qz"><b>' + esc(NAME[e.kennzahl] || e.name || e.kennzahl) + '</b><span>' + esc(e.ausschuss || q.ausschuss || '') + (e.jahrgang || e.berichtsjahr ? ' · ' + esc(e.jahrgang || e.berichtsjahr) : '') + (e.gebiet ? ' · ' + esc(e.gebiet) : '') + '</span>' + link + '</div>');
    });
    fehlt.forEach(function (e) {
      zeilen.push('<div class="oe-qz fehlt"><b>' + esc(NAME[e.kennzahl] || e.name || e.kennzahl) + '</b><span>nicht im Register — beim Gutachterausschuss' + (q && q.ausschuss ? ' (' + esc(q.ausschuss) + ')' : '') + ' anfragen oder dem Grundstücksmarktbericht entnehmen</span><button type="button" class="oe-btn" data-oe-amt="gutachterausschuss">anfragen</button></div>');
    });
    if (_leiste && !_leiste.swf && !fehlt.some(function (e) { return /swf|sachwert/.test(e.kennzahl); })) {
      zeilen.push('<div class="oe-qz fehlt"><b>Sachwertfaktor</b><span>' + esc(_leiste.swfHinweis || 'für diese Objektart nicht hinterlegt') + '</span><button type="button" class="oe-btn" data-oe-amt="gutachterausschuss">anfragen</button></div>');
    }
    var brauchtAnfrage = fehlt.length > 0 || (_leiste && (!_leiste.zins || !_leiste.swf));
    if (hint) hint.innerHTML = brauchtAnfrage
      ? st('x', 'nötig') + 'Für dieses Objekt fehlt eine amtliche Kennzahl — Quelle unten, Anfrage mit einem Klick.'
      : (q && q.ausschuss ? st('a', 'vollständig') + 'Alle Kennzahlen liegen im Register (' + esc(q.ausschuss) + ').' : '');
    box.innerHTML = zeilen.join('');
    box.style.display = zeilen.length ? '' : 'none';
  }

  /* „abweichend eintragen": Ebene 3 öffnen und das Feld zeigen */
  function abweichend(feld) {
    var el = $(feld); if (!el) return;
    var card = document.querySelector('.card[data-collapsible="wm-obj"]');
    if (card && card.contains(el)) {
      /* v1852: liegt das Feld in Ebene 3 und ist die Eingabetiefe kleiner,
         will der Nutzer gerade genau dorthin — die Tiefe folgt dem Klick. */
      if (card.classList.contains('oe-stufe-aus')) { try { localStorage.setItem(ZIEL_KEY, '3'); } catch (e) {} zielAnwenden(); }
      if (card.classList.contains('v212-collapsed')) { var t = card.querySelector('.v212-collapse-toggle'); if (t) t.click(); }
    }
    /* v1854: liegt das Feld in einer zugeschalteten Detailkarte, die gerade
       aus ist, setzt der Sprung den Haken — der Nutzer will genau dorthin. */
    var dk = el.closest('.oe-karte[data-oe-detail]'), cb = $('oe-details-cb');
    if (dk && dk.classList.contains('oe-aus') && cb) { cb.checked = true; try { localStorage.setItem('dp_details', '1'); } catch (e) {} detailsAnwenden(); }
    /* Reiterwechsel, wenn das Feld woanders liegt (Kaufpreis, Miete) */
    var sec = el.closest('.sec');
    if (sec && !sec.classList.contains('active')) { var tab = document.querySelector('[data-target-sec="' + sec.id + '"]'); if (tab) tab.click(); }
    setTimeout(function () { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus(); } catch (e) {} }, 120);
  }

  /* ═══ Was jede Stufe braucht ═════════════════════════════════════════
     Dieselbe Staffel wie tools/objekt-vollstaendigkeit.mjs (dort als Lauf
     über alle Objekte, hier je Feld am Bildschirm). Ändert sich eine Seite,
     muss die andere nachziehen — beide nennen die Quelle:
       Stufe 1  Adresse, Objektart, Wohnfläche, Baujahr
       Stufe 2  dazu Kaufpreis und Nettokaltmiete
       Stufe 3  dazu Grundstück, Bodenrichtwert, Zustand, Standardstufe,
                MEA bei ETW, Einheiten bei MFH, BGF + NHK-Typ bei Häusern */
  var FELDNAMEN = { plz: 'PLZ', ort: 'Ort', str: 'Straße', objart: 'Objektart', wfl: 'Wohnfläche', baujahr: 'Baujahr',
    kp: 'Kaufpreis (Reiter Investition)', nkm: 'Nettokaltmiete (Reiter Miete)', gsfl: 'Grundstücksfläche', brw: 'Bodenrichtwert',
    ds2_zustand: 'Zustand', ds2_energie: 'Energieklasse', standardstufe: 'Standardstufe', zimmer: 'Zimmer', etage: 'Etage',
    mea: 'Miteigentumsanteil', einheiten: 'Wohneinheiten', nutzungsart: 'Nutzungsart',
    bgf: 'Bruttogrundfläche', nhk_haus: 'Hausform (NHK)', nhk_geschosse: 'Geschosse und Unterkellerung', nhk_dach: 'Dachausbildung',
    garagen_bgf_qm: 'Garage · Bruttogrundfläche', garagen_stufe: 'Garage · Standardstufe' };
  /* v1854 · Marcel: „bei der Stufe 2, dass da alle wichtigen Felder rot
     markiert sind und dann halt bei der Stufe 3 auch" — Stufe 2 nimmt die
     Felder, die die erweiterte Indikation rechnet (Zustand, Energie,
     Standardstufe → Qualitätsfaktor, Zimmer, Etage bei ETW, Einheiten bei
     MFH), Stufe 3 dazu alles, was Sach- und Ertragswert brauchen —
     einschließlich der Felder im Block „Sach- und Ertragswert". */
  function pflichtFuer(stufe) {
    var art = _v('objart').toUpperCase();
    var l = ['plz', 'ort', 'str', 'objart', 'wfl', 'baujahr'];
    if (stufe >= 2) {
      l = l.concat(['kp', 'nkm', 'ds2_zustand', 'ds2_energie', 'standardstufe', 'zimmer']);
      if (art === 'ETW') l.push('etage');
      if (art === 'MFH') l.push('einheiten');
    }
    if (stufe >= 3) {
      l = l.concat(['nutzungsart', 'gsfl', 'brw']);
      if (art === 'ETW') l.push('mea');
      if (/^(EFH|ZFH|DHH|RH)$/.test(art)) l = l.concat(['bgf', 'nhk_haus', 'nhk_geschosse', 'nhk_dach']);
      if (art === 'MFH') l.push('bgf');
      var gar = parseFloat(_v('garagen').replace(',', '.'));
      if (gar > 0) l = l.concat(['garagen_bgf_qm', 'garagen_stufe']);
    }
    return l;
  }
  function fehltFuer(stufe) { return pflichtFuer(stufe).filter(function (id) { return !_v(id); }); }

  function fehlendeZeigen(stufe, liste) {
    var box = $('oe-fehlt'); if (!box) return;
    if (!liste.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.innerHTML = '<b>Für Stufe ' + stufe + ' fehlt noch:</b> '
      + liste.map(function (id) { return '<span class="oe-chip" data-oe-feld="' + id + '">' + esc(FELDNAMEN[id] || id) + '</span>'; }).join('')
      + '<div class="hint" style="margin:6px 0 0">Klick auf einen Eintrag springt zum Feld. Die Stufe lässt sich erst abrufen, wenn alles da ist — der Bericht rechnet nie halb.</div>';
    box.style.display = '';
  }

  /* ═══ Eingabetiefe (Zielstufe) — Marcel: „wichtig ist dass wir wählen
     können wie detailreich die eingabe wird" ═════════════════════════════
     1: nur Ebene 1 offen, Ebene 2 zu, Ebene 3 weg.
     2: Ebene 2 offen, Ebene 3 weg.
     3: alles, Ebene 3 aufgeklappt. Pflichtfelder der Zielstufe werden
     markiert, solange sie leer sind. Merker je Nutzer, nicht je Objekt. */
  /* v1854 · Haken „weitere Objektdetails angeben": Merker je Nutzer. */
  function detailsAnwenden() {
    var cb = $('oe-details-cb'); if (!cb) return;
    document.querySelectorAll('.oe-karte[data-oe-detail]').forEach(function (k) { k.classList.toggle('oe-aus', !cb.checked); });
  }
  function detailsInit() {
    var cb = $('oe-details-cb'); if (!cb) return;
    try { cb.checked = localStorage.getItem('dp_details') === '1'; } catch (e) {}
    cb.addEventListener('change', function () {
      try { localStorage.setItem('dp_details', cb.checked ? '1' : '0'); } catch (e) {}
      detailsAnwenden();
    });
    detailsAnwenden();
  }
  var ZIEL_KEY = 'dp_zielstufe';
  function zielstufe() { try { var z = parseInt(localStorage.getItem(ZIEL_KEY), 10); return (z >= 1 && z <= 3) ? z : 1; } catch (e) { return 1; } }
  function zielSetzen(z) { try { localStorage.setItem(ZIEL_KEY, String(z)); } catch (e) {} zielAnwenden(); stufen(); }
  function zielAnwenden() {
    var z = zielstufe();
    document.querySelectorAll('[data-oe-ziel]').forEach(function (b) { b.classList.toggle('on', parseInt(b.getAttribute('data-oe-ziel'), 10) === z); });
    var hint = $('oe-ziel-hint');
    if (hint) hint.textContent = z === 1 ? 'Einfach — eine Marktpreisindikation: Adresse, Objektart, Wohnfläche, Baujahr. Lage & Einschätzung bleiben sichtbar, sie gehen in den Deal Score.'
      : z === 2 ? 'Mittel — die erweiterte Indikation: dazu Kaufpreis, Miete, Zustand, Energie, Standardstufe. Die Karten Gewerke und Bauteile werden eingeblendet.'
      : 'Ausgiebig — Sach- und Ertragswert nach ImmoWertV: dazu Grundstück, Bodenrichtwert, bei Häusern BGF und NHK-Typ. Der Block „Sach- und Ertragswert" unten erscheint.';
    var e3 = document.querySelector('.card[data-oe-stufe-min="3"]');
    if (e3) {
      e3.classList.toggle('oe-stufe-aus', z < 3);
      if (z === 3 && e3.classList.contains('v212-collapsed')) { var t = e3.querySelector('.v212-collapse-toggle'); if (t) t.click(); }
    }
    /* v1854 · die Detailkarten (Gewerke, Bauteile) hängen am Haken; Mittel
       und Ausgiebig setzen ihn von selbst, Einfach lässt ihn, wie er war. */
    var cb = $('oe-details-cb');
    if (cb) {
      if (z >= 2 && !cb.checked) { cb.checked = true; try { localStorage.setItem('dp_details', '1'); } catch (e) {} }
      detailsAnwenden();
    }
    /* Pflichtfelder markieren: nur die der Zielstufe, nur solange leer.
       v1852b: die Stylesheet-Regel kam am Eingabefeld nicht an (gemessen:
       Rahmen blieb var(--border), auch der Schatten fehlte — eine
       staerkere Regel gewinnt). Inline mit !important schlaegt alles,
       und beim Loeschen wird es wieder entfernt. */
    document.querySelectorAll('.f.oe-pflicht-fehlt').forEach(function (f) {
      f.classList.remove('oe-pflicht-fehlt');
      f.querySelectorAll('input,select').forEach(function (el) { el.style.removeProperty('border-color'); el.style.removeProperty('box-shadow'); });
    });
    fehltFuer(z).forEach(function (id) {
      var el = $(id); var f = el && el.closest('.f'); if (!f) return;
      f.classList.add('oe-pflicht-fehlt');
      el.style.setProperty('border-color', '#B8625C', 'important');
      el.style.setProperty('box-shadow', '0 0 0 2px rgba(184,98,92,.18)', 'important');
    });
  }

  /* ═══ Stufen-Knöpfe: Kontingent UND Vollständigkeit ══════════════════ */
  var _kont = null;
  async function stufen() {
    var box = $('oe-stufen'); if (!box) return;
    if (!_kont) _kont = await api('/ai/credits');
    var arten = (_kont && _kont.arten) || {};
    var rest = function (art) { var a = arten[art]; return (a && typeof a.rest === 'number') ? a.rest : null; };
    var konto = { 1: rest('mpi'), 2: rest('mpi_plus'), 3: rest('wev') };
    /* v1855 · drei Kacheln unten in der Karte „Marktbericht abrufen" */
    var kacheln = {
      1: { name: 'Einfach · Stufe 1', sub: 'Marktpreisindikation aus Adresse, Objektart, Fläche und Baujahr — Marktwert, Spanne, Lage-Scores.', art: 'Marktpreisindikation' },
      2: { name: 'Mittel · Stufe 2', sub: 'Erweiterte Indikation: dazu Kaufpreis, Miete, Zustand, Energie und Ausstattung — mit Rendite und Abschlag zum Markt.', art: 'erweiterte Indikation' },
      3: { name: 'Ausgiebig · Stufe 3', sub: 'Wertermittlung nach ImmoWertV: Boden-, Ertrags- und Sachwert mit amtlichem Zins und Sachwertfaktor, Quellennachweis.', art: 'Wertermittlung' }
    };
    var ab = { 2: 'ab Investor', 3: 'ab Pro' };
    var z = zielstufe();
    box.innerHTML = [1, 2, 3].map(function (s) {
      var fehlt = fehltFuer(s).length, r = konto[s], k = kacheln[s];
      var aus = r === 0;
      var title = aus ? ('Kontingent aufgebraucht — ' + (ab[s] || '')) : fehlt ? (fehlt + ' Feld(er) fehlen — Klick zeigt sie') : 'abrufen';
      return '<div class="oe-tile' + (s === z ? ' on' : '') + '">'
        + '<h4>' + k.name + '</h4><div class="oe-tile-sub">' + k.sub + '</div>'
        + '<div class="oe-tile-meta">' + (r == null ? 'Kontingent unbekannt' : r + ' frei') + (fehlt ? ' · ' + fehlt + ' Feld' + (fehlt > 1 ? 'er' : '') + ' fehlt' : ' · alle Angaben da') + (aus && ab[s] ? ' · ' + ab[s] : '') + '</div>'
        + '<button type="button" class="oe-btn' + (s === z ? ' solid' : '') + (fehlt ? ' oe-unvollstaendig' : '') + '" data-oe-stufe="' + s + '"' + (aus ? ' disabled' : '') + ' title="' + esc(title) + '">'
        + (fehlt ? 'Fehlende Angaben zeigen' : k.art + ' abrufen') + '</button>'
        + '</div>';
    }).join('');
  }
  var _fehlStufe = null;   /* v1852: die zuletzt angefragte Stufe — die Fehlliste folgt der Eingabe */
  function fehlendeNachziehen() { if (_fehlStufe) fehlendeZeigen(_fehlStufe, fehltFuer(_fehlStufe)); }
  function stufeAbrufen(s) {
    var fehlt = fehltFuer(s);
    _fehlStufe = s;
    if (fehlt.length) { fehlendeZeigen(s, fehlt); abweichend(fehlt[0]); return; }
    fehlendeZeigen(s, []);
    if (window.DealPilotMB && typeof DealPilotMB.run === 'function') {
      var p = DealPilotMB.run({ stufe: s });
      /* danach den Verlauf nachladen — der neue Bericht gehört in die Übernahme-Auswahl */
      var nach = function () { setTimeout(verkehrswertUebernahme, 1500); };
      if (p && typeof p.then === 'function') p.then(nach, nach); else setTimeout(nach, 10000);
    }
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
      + '<div class="oe-box"><h5>DATENLAGE · GEMESSEN (Marktdaten, Zensus, Makro-Score)</h5>' + (dat.length ? dat.join(' · ') : '<span class="oe-leer">erscheint nach dem ersten Marktbericht</span>') + '</div>';
    box.style.display = '';
  }

  /* ═══ Verkehrswert aus dem Marktbericht übernehmen ═══════════════════
     Marcel, 04.10.2026: „Wenn wir einen Verkehrswert ermittelt haben
     sollten wir am feld verkehrswert auch ein button haben mit übernahme.
     wenn es mehrere marktberichte gibt dann zum auswählen."
     Quelle ist der Verlauf (mb.object_snapshots über
     /marktbericht/objects/history?ref=…), derselbe, den Deal-Aktion und
     Portfolio-Pilot lesen. Übernommen wird der Marktwert des gewählten
     Berichts — mit Datum und Stufe, damit klar ist, was da steht. */
  var _vwLauf = 0;
  function _datum(iso) { try { return new Date(iso).toLocaleDateString('de-DE'); } catch (e) { return String(iso || '').slice(0, 10); } }
  /* ai_mode im Verlauf heisst 'schnell' (= fast, Stufe 1), 'openai' (KI-Lauf)
     oder traegt die Stufe im Namen — gemessen an 31 Staenden der Hermannstrasse. */
  function _stufeAus(h) {
    var a = String(h.ai_mode || '');
    var m = a.match(/stufe[_\s]?(\d)/i); if (m) return 'Stufe ' + m[1];
    if (/schnell|fast/i.test(a)) return 'Stufe 1';
    return a ? 'KI-Lauf' : '';
  }
  async function verkehrswertUebernahme() {
    var box = $('oe-vw'); if (!box) return;
    var ref = window._currentObjKey; if (!ref) { box.style.display = 'none'; return; }
    var lauf = ++_vwLauf;
    var j = await api('/marktbericht/objects/history?ref=' + encodeURIComponent(ref));
    if (lauf !== _vwLauf) return;
    var liste = ((j && j.history) || []).filter(function (h) { return Number(h.market_value) > 0; });
    if (!liste.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    liste.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var opt = function (h, i) {
      return '<option value="' + i + '">' + _datum(h.created_at) + (_stufeAus(h) ? ' · ' + _stufeAus(h) : '') + ' · ' + deNum(h.market_value, 0) + ' €</option>';
    };
    box.innerHTML = (liste.length > 1
      ? '<select id="oe-vw-wahl" aria-label="Marktbericht wählen">' + liste.map(opt).join('') + '</select>'
      : '<span class="oe-q">Marktbericht ' + _datum(liste[0].created_at) + (_stufeAus(liste[0]) ? ' · ' + _stufeAus(liste[0]) : '') + ': <b>' + deNum(liste[0].market_value, 0) + ' €</b></span>')
      + '<button type="button" class="oe-btn" id="oe-vw-btn">als Verkehrswert übernehmen</button>'
      + (liste.length > 1 ? '<span class="oe-q">' + liste.length + ' Berichte im Verlauf</span>' : '');
    box.style.display = '';
    box._liste = liste;
  }
  function verkehrswertSetzen() {
    var box = $('oe-vw'), el = $('svwert'); if (!box || !el || !box._liste) return;
    var sel = $('oe-vw-wahl'); var h = box._liste[sel ? parseInt(sel.value, 10) || 0 : 0]; if (!h) return;
    el.value = String(Math.round(Number(h.market_value)));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof calc === 'function') { try { calc(); } catch (e) {} }
    if (typeof toast === 'function') { try { toast('✓ Verkehrswert ' + deNum(h.market_value, 0) + ' € übernommen (Marktbericht ' + _datum(h.created_at) + ')'); } catch (e) {} }
  }

  /* ═══ Verdrahtung ════════════════════════════════════════════════════ */
  var _t = null;
  function spaeter(fn, ms) { clearTimeout(_t); _t = setTimeout(fn, ms || 350); }
  function alles() { zielAnwenden(); automatik(); gewerke(); lageVergleich(); verkehrswertUebernahme(); }
  var _verdrahtet = false;
  function verdrahten() {
    if (_verdrahtet || !$('oe-auto')) return;
    _verdrahtet = true;
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-oe-feld]'); if (b) { abweichend(b.getAttribute('data-oe-feld')); return; }
      var zb = e.target.closest('[data-oe-ziel]'); if (zb) { zielSetzen(parseInt(zb.getAttribute('data-oe-ziel'), 10)); return; }
      if (e.target.closest('#oe-vw-btn')) { verkehrswertSetzen(); return; }
      /* v1855 · Absprung in den Marktbericht (derselbe Weg wie der Kopf-Knopf) */
      if (e.target.closest('#oe-mb-oeffnen')) {
        var mb = [].slice.call(document.querySelectorAll('button,a')).find(function (b) { return /^\s*MARKTBERICHT\s*$/i.test(b.textContent || ''); });
        if (mb) mb.click(); else if (typeof openMarktberichtView === 'function') openMarktberichtView();
        return;
      }
      var amt = e.target.closest('[data-oe-amt]');
      if (amt && window.DealPilotUnterlagen && typeof DealPilotUnterlagen.oeffnen === 'function') { DealPilotUnterlagen.oeffnen(amt.getAttribute('data-oe-amt')); return; }
      var s = e.target.closest('[data-oe-stufe]');
      if (s && !s.disabled) stufeAbrufen(parseInt(s.getAttribute('data-oe-stufe'), 10));
    });
    /* Pflichtfelder: Markierung und Fehlzahl folgen der Eingabe */
    Object.keys(FELDNAMEN).forEach(function (id) {
      var el = $(id); if (!el) return;
      el.addEventListener('input', function () { spaeter(function () { zielAnwenden(); stufen(); fehlendeNachziehen(); }, 400); });
      el.addEventListener('change', function () { spaeter(function () { zielAnwenden(); stufen(); fehlendeNachziehen(); }, 150); });
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
    /* storage.js:206 feuert auf WINDOW, nicht auf document — ein Listener am
       document hoert es nie (gemessen v1851: die Leiste blieb auf
       „PLZ eintragen", obwohl die Hermannstrasse geladen war). Zweimal
       nachziehen: sofort nach dem Befuellen und nach dem Bodenrichtwert-
       Autolauf, der etwas spaeter seinen Status schreibt. */
    window.addEventListener('dp:object-ready', function () {
      setTimeout(function () { alles(); stufen(); }, 120);
      setTimeout(alles, 1800);
    });
    window.addEventListener('dp:plan-ready', function () { stufen(); });
    document.addEventListener('dp:plan-ready', function () { stufen(); });
    detailsInit();
    alles(); stufen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten); else verdrahten();
  setTimeout(verdrahten, 600); setTimeout(verdrahten, 2500);

  window.DealPilotObjektReiter = { automatik: automatik, gewerke: gewerke, stufen: stufen, lageVergleich: lageVergleich, abweichend: abweichend, modPunkte: modPunkte,
    zielstufe: zielstufe, zielSetzen: zielSetzen, fehltFuer: fehltFuer, pflichtFuer: pflichtFuer, stufeAbrufen: stufeAbrufen };
})();
