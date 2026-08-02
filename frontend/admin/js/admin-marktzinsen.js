// admin-marktzinsen.js — Verwaltung der Wertermittlungsparameter.
// ────────────────────────────────────────────────────────────────────────────
// Zeigt je Kreis, welcher Liegenschaftszins gilt und auf welcher Stufe:
//   A amtlich kreisscharf · B amtlich regional · C marktabgeleitet
//   D gesetzlicher Auffangwert · E eigene Angabe
//
// Dazu: welche Quellen frei sind und welche gekauft werden muessen (mit Link
// zur Bestellseite), wann zuletzt geprueft wurde, welche Kreise veraltet sind,
// und ein Knopf zum Anstossen der Discovery.
//
// Der Knopf STOESST AN, er fuehrt nicht aus. Sonst klickt jemand dreimal und
// wir haemmern auf einen Behoerdenserver ein. Eine Stunde Sperre je Quelle.
//
// Eigener fetch mit X-Admin-Token wie admin-landing.js — der Admin-Wrapper
// exportiert kein call(). Feste helle Toene, var(--text) loest hier dunkel auf.
(function () {
  'use strict';

  var BASE = '/api/v1/admin';
  var geladen = false;

  function _token() { return localStorage.getItem('dp_admin_token') || ''; }

  async function _call(method, pfad, body) {
    var headers = {};
    var t = _token();
    if (t) headers['X-Admin-Token'] = t;
    if (body) headers['Content-Type'] = 'application/json';
    var r = await fetch(BASE + pfad, {
      method: method, headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    var d = null;
    try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((d && (d.message || d.error)) || ('HTTP ' + r.status));
    return d;
  }

  var STUFE = {
    A: { t: 'amtlich', f: '#3FA56C' },
    B: { t: 'amtlich, regional', f: '#7FB069' },
    C: { t: 'indikativ, marktabgeleitet', f: '#E8B84F' },
    D: { t: 'indikativ, § 256 BewG', f: '#D8865C' },
    E: { t: 'eigene Angabe', f: '#A89F8E' },
  };
  var ZUGANG = {
    frei: { t: 'frei', f: '#3FA56C' },
    namensnennung: { t: 'frei, Namensnennung', f: '#7FB069' },
    kostenpflichtig: { t: 'kostenpflichtig', f: '#D8865C' },
    auf_anfrage: { t: 'auf Anfrage', f: '#E8B84F' },
    unbekannt: { t: 'ungeprüft', f: '#A89F8E' },
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function datum(d) {
    if (!d) return '–';
    try { return new Date(d).toLocaleDateString('de-DE'); } catch (e) { return '–'; }
  }
  function tageSeit(d) {
    if (!d) return null;
    return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  }

  function kachel(label, wert, unten) {
    return '<div class="mz-k"><div class="mz-k-v">' + wert + '</div>' +
      '<div class="mz-k-l">' + esc(label) + '</div>' +
      (unten ? '<div class="mz-k-s">' + unten + '</div>' : '') + '</div>';
  }

  function abdeckungsBalken(par) {
    var gesamt = par.reduce(function (a, r) { return a + r.n; }, 0) || 1;
    var reihe = ['A', 'B', 'C', 'D', 'E'].map(function (s) {
      var r = par.find(function (x) { return x.qualitaet === s; });
      var n = r ? r.n : 0;
      if (!n) return '';
      return '<div style="width:' + Math.max(2, Math.round(n / gesamt * 100)) + '%;background:'
        + STUFE[s].f + '" title="' + STUFE[s].t + ': ' + n + '"></div>';
    }).join('');
    var legende = ['A', 'B', 'C', 'D', 'E'].map(function (s) {
      var r = par.find(function (x) { return x.qualitaet === s; });
      return '<span class="mz-leg"><i style="background:' + STUFE[s].f + '"></i>'
        + s + ' ' + STUFE[s].t + ' <b>' + (r ? r.n : 0) + '</b></span>';
    }).join('');
    return '<div class="mz-bar">' + reihe + '</div><div class="mz-legs">' + legende + '</div>';
  }

  function quellenTabelle(q) {
    if (!q || !q.length) return '<p class="mz-leer">Noch keine Quellen erfasst.</p>';
    var z = q.map(function (s) {
      var zg = ZUGANG[s.zugang] || ZUGANG.unbekannt;
      var kauf = (s.zugang === 'kostenpflichtig' || s.zugang === 'auf_anfrage');
      var tage = tageSeit(s.letzter_fund);
      var veraltet = s.letzter_fund == null || (tage != null && tage > 540);
      return '<tr' + (veraltet ? ' class="mz-alt"' : '') + '>' +
        '<td><b>' + esc(s.bundesland) + '</b></td>' +
        '<td>' + esc(s.name) +
          (s.notiz ? '<div class="mz-not">' + esc(s.notiz) + '</div>' : '') + '</td>' +
        '<td><span class="mz-tag" style="background:' + zg.f + '22;color:' + zg.f + '">' + zg.t + '</span></td>' +
        '<td>' + datum(s.letzter_check) + '</td>' +
        '<td>' + datum(s.letzter_fund) +
          (veraltet ? '<div class="mz-warn">seit über 18 Monaten nichts</div>' : '') + '</td>' +
        '<td>' + (s.dokumente || 0) + '</td>' +
        '<td class="mz-akt">' +
          (kauf && s.portal_url
            ? '<a href="' + esc(s.portal_url) + '" target="_blank" rel="noopener" class="mz-btn mz-kauf">Bericht kaufen ↗</a>'
            : '<button class="mz-btn" data-pruefen="' + s.id + '">jetzt prüfen</button>') +
        '</td></tr>';
    }).join('');
    return '<table class="data-table mz-tab"><thead><tr>' +
      '<th>Land</th><th>Gutachterausschuss</th><th>Zugang</th>' +
      '<th>zuletzt geprüft</th><th>zuletzt gefunden</th><th>Dok.</th><th></th>' +
      '</tr></thead><tbody>' + z + '</tbody></table>';
  }

  /* v1036 · Kreisuebersicht mit Suchweg.
   * Fuer jeden erfassten Kreis: welche Stufe gilt, welcher Ausschuss ist
   * zustaendig, und ein Link, der direkt zur Suche nach seinem
   * Grundstuecksmarktbericht fuehrt. Damit ist der Weg vom "Stufe D" zum
   * fertigen Import drei Klicks lang. */
  var LAND_PORTAL = {
    NW: 'https://www.boris.nrw.de/boris-nrw',
    NI: 'https://www.immobilienmarkt.niedersachsen.de/',
    BE: 'https://www.berlin.de/gutachterausschuss/marktinformationen/marktanalyse/',
    BB: 'https://www.gutachterausschuesse-bb.de/',
    HH: 'https://www.hamburg.de/gutachterausschuss/',
    HB: 'https://www.gutachterausschuss.bremen.de/',
    HE: 'https://www.gutachterausschuesse.hessen.de/',
    MV: 'https://www.gutachterausschuesse-mv.de/',
    RP: 'https://gutachterausschuesse.rlp.de/',
    SN: 'https://www.boris.sachsen.de/',
    ST: 'https://www.landesrecht.sachsen-anhalt.de/',
    TH: 'https://www.gutachterausschuss.thueringen.de/',
    SH: 'https://www.schleswig-holstein.de/',
    SL: 'https://www.saarland.de/',
    BY: 'https://www.gutachterausschuesse.bayern.de/',
    BW: 'https://www.gutachterausschuesse-bw.de/',
  };

  function suchLink(name, land) {
    /* Websuche statt geratener Adresse: die Portale heissen ueberall anders,
     * eine erfundene URL waere schlechter als eine gute Suche. */
    var q = encodeURIComponent('Grundstücksmarktbericht ' + (name || '') + ' PDF');
    return 'https://duckduckgo.com/?q=' + q;
  }

  function kreisTabelle(w, q) {
    /* Kreise aus den hinterlegten Werten UND den erfassten Ausschuessen. */
    var kreise = {};
    (w || []).forEach(function (r) {
      var k = r.ags;
      if (!kreise[k]) kreise[k] = { ags: k, stufen: {}, typen: {} };
      kreise[k].stufen[r.qualitaet] = (kreise[k].stufen[r.qualitaet] || 0) + 1;
      kreise[k].typen[r.typ] = true;
    });
    (q || []).forEach(function (s) {
      (s.ags_liste || []).forEach(function (k) {
        if (!kreise[k]) kreise[k] = { ags: k, stufen: {}, typen: {} };
        kreise[k].ausschuss = s.name;
        kreise[k].land = s.bundesland;
        kreise[k].zugang = s.zugang;
        kreise[k].portal = s.portal_url;
      });
    });
    var liste = Object.keys(kreise).map(function (k) { return kreise[k]; });
    if (!liste.length) {
      return '<p class="mz-leer">Noch keine Kreise erfasst. Sie erscheinen automatisch, ' +
        'sobald ein Marktbericht für eine Adresse in diesem Kreis läuft — den zuständigen ' +
        'Gutachterausschuss liefert BORIS dabei mit.</p>';
    }
    /* Die schlechteste Stufe zaehlt: ein Kreis mit A fuer Wohnungen und D fuer
     * Haeuser ist nicht fertig. */
    var rang = { A: 1, B: 2, C: 3, D: 4, E: 5 };
    liste.sort(function (a, b) {
      var sa = Math.max.apply(null, Object.keys(a.stufen).map(function (x) { return rang[x] || 9; }).concat([0]));
      var sb = Math.max.apply(null, Object.keys(b.stufen).map(function (x) { return rang[x] || 9; }).concat([0]));
      return sb - sa;
    });
    return '<table class="data-table mz-tab"><thead><tr>' +
      '<th>Kreis (AGS)</th><th>Gutachterausschuss</th><th>Stufen</th>' +
      '<th>Zugang</th><th>Bericht holen</th></tr></thead><tbody>' +
      liste.map(function (r) {
        var st = Object.keys(r.stufen).sort().map(function (x) {
          var f = (STUFE[x] || {}).f || '#A89F8E';
          return '<span class="mz-tag" style="background:' + f + '22;color:' + f + '">' + x + '</span>';
        }).join(' ') || '<span class="mz-not">keine</span>';
        var zg = ZUGANG[r.zugang] || ZUGANG.unbekannt;
        var portal = r.portal || LAND_PORTAL[r.land] || null;
        var offen = !r.stufen.A && !r.stufen.B;
        return '<tr' + (offen ? ' class="mz-alt"' : '') + '>' +
          '<td><b>' + esc(r.ags) + '</b></td>' +
          '<td>' + esc(r.ausschuss || '–') + (r.land ? ' <span class="mz-not">' + esc(r.land) + '</span>' : '') + '</td>' +
          '<td>' + st + '</td>' +
          '<td><span class="mz-tag" style="background:' + zg.f + '22;color:' + zg.f + '">' + zg.t + '</span></td>' +
          '<td class="mz-akt">' +
            (portal ? '<a class="mz-btn" target="_blank" rel="noopener" href="' + esc(portal) + '">Portal ↗</a> ' : '') +
            '<a class="mz-btn" target="_blank" rel="noopener" href="' + esc(suchLink(r.ausschuss, r.land)) + '">suchen ↗</a>' +
          '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function werteTabelle(w) {
    if (!w || !w.length) return '<p class="mz-leer">Noch keine Werte hinterlegt.</p>';
    return '<table class="data-table mz-tab"><thead><tr>' +
      '<th>Kreis</th><th>Objektart</th><th>Wert</th><th>Stufe</th>' +
      '<th>Stichtag</th><th>Quelle</th></tr></thead><tbody>' +
      w.map(function (r) {
        var st = STUFE[r.qualitaet] || STUFE.E;
        return '<tr><td>' + esc(r.ags) + '</td><td>' + esc(r.objektart) + '</td>' +
          '<td><b>' + String(r.wert).replace('.', ',') + (r.einheit === 'prozent' ? ' %' : '') + '</b></td>' +
          '<td><span class="mz-tag" style="background:' + st.f + '22;color:' + st.f + '">'
            + r.qualitaet + ' · ' + st.t + '</span></td>' +
          '<td>' + datum(r.stichtag) + '</td>' +
          '<td class="mz-q">' + esc((r.quelle_text || '').slice(0, 90)) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ═══════════════════════════════════════════════════════════════════════
   * PDF-IMPORT — für gekaufte Berichte.
   * Es wird nichts automatisch gespeichert: auslesen, prüfen, bestätigen.
   * ═══════════════════════════════════════════════════════════════════════ */
  var _gelesen = null;

  function importBlock() {
    return '<div class="mz-imp">' +
      '<div class="mz-imp-h">Bericht einlesen</div>' +
      '<div class="mz-imp-s">Für gekaufte Grundstücksmarktberichte. Das PDF wird ausgelesen, ' +
      'die gefundenen Werte erscheinen zur Prüfung — gespeichert wird erst nach deiner Bestätigung.</div>' +
      '<div class="mz-imp-r">' +
        '<input type="file" id="mz-file" accept="application/pdf" multiple>' +
        '<input type="text" id="mz-ags" placeholder="Kreis-AGS, z. B. 14627" maxlength="5">' +
        '<button class="mz-btn" id="mz-lesen">auslesen</button>' +
      '</div>' +
      '<div id="mz-imp-erg"></div>' +
    '</div>';
  }

  async function dateiLesen(f) {
    return new Promise(function (ok, fehl) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1]); };
      r.onerror = function () { fehl(new Error('Datei nicht lesbar')); };
      r.readAsDataURL(f);
    });
  }

  async function auslesen() {
    var inp = document.getElementById('mz-file');
    var erg = document.getElementById('mz-imp-erg');
    var knopf = document.getElementById('mz-lesen');
    if (!inp || !inp.files || !inp.files.length) { erg.innerHTML = '<p class="mz-leer">Keine Datei gewählt.</p>'; return; }
    var ags = (document.getElementById('mz-ags') || {}).value || '';

    knopf.disabled = true; knopf.textContent = 'liest …';
    erg.innerHTML = '<p class="mz-leer">Das kann eine Minute dauern — der Bericht hat oft 200 Seiten.</p>';
    try {
      var f = inp.files[0];
      var b64 = await dateiLesen(f);
      var d = await _call('POST', '/marktzinsen/import', { pdfBase64: b64, dateiname: f.name, ags: ags });
      _gelesen = d;
      erg.innerHTML = vorschlagsListe(d);
      var b = document.getElementById('mz-uebernehmen');
      if (b) b.addEventListener('click', uebernehmen);
    } catch (e) {
      erg.innerHTML = '<p class="mz-warn">' + esc(e.message) + '</p>';
    }
    knopf.disabled = false; knopf.textContent = 'auslesen';
  }

  function vorschlagsListe(d) {
    if (!d || !d.ok) return '<p class="mz-warn">' + esc((d && d.grund) || 'Auslesen fehlgeschlagen') + '</p>';
    var v = d.vorschlaege || [];
    if (!v.length) return '<p class="mz-leer">' + esc(d.hinweis || 'Nichts gefunden.') + '</p>';
    var kopf = '<div class="mz-imp-k">' + esc(d.kreis || '–') +
      (d.stichtag ? ' · Stichtag ' + esc(d.stichtag) : '') +
      (d.berichtsjahr ? ' · Bericht ' + esc(d.berichtsjahr) : '') + '</div>';
    var z = v.map(function (w, i) {
      return '<tr class="' + (w.plausibel ? '' : 'mz-alt') + '">' +
        '<td><input type="checkbox" data-v="' + i + '"' + (w.plausibel ? ' checked' : '') + '></td>' +
        '<td>' + esc(w.typ) + '</td><td>' + esc(w.objektart) + '</td>' +
        '<td><b>' + String(w.wert).replace('.', ',') + '</b>' +
          (w.spanne_von != null ? '<div class="mz-not">' + w.spanne_von + '–' + w.spanne_bis + '</div>' : '') + '</td>' +
        '<td>' + (w.seite || '–') + '</td>' +
        '<td class="mz-q">' + esc(w.zitat) +
          (w.grund ? '<div class="mz-warn">' + esc(w.grund) + '</div>' : '') + '</td></tr>';
    }).join('');
    return kopf +
      '<table class="data-table mz-tab"><thead><tr><th></th><th>Typ</th><th>Objektart</th>' +
      '<th>Wert</th><th>Seite</th><th>Zitat aus dem Bericht</th></tr></thead><tbody>' + z + '</tbody></table>' +
      '<div class="mz-imp-f"><span class="mz-not">' + esc(d.hinweis || '') + '</span>' +
      '<button class="mz-btn" id="mz-uebernehmen">bestätigte übernehmen (Stufe A)</button></div>';
  }

  async function uebernehmen() {
    if (!_gelesen) return;
    var erg = document.getElementById('mz-imp-erg');
    var gewaehlt = [];
    erg.querySelectorAll('input[data-v]').forEach(function (c) {
      if (c.checked) gewaehlt.push(_gelesen.vorschlaege[parseInt(c.getAttribute('data-v'), 10)]);
    });
    if (!gewaehlt.length) return;
    var ags = (document.getElementById('mz-ags') || {}).value || _gelesen.ags;
    if (!ags) { erg.innerHTML += '<p class="mz-warn">Kreis-AGS fehlt.</p>'; return; }
    try {
      var r = await _call('POST', '/marktzinsen/uebernehmen', {
        ags: ags, stichtag: _gelesen.stichtag,
        quelle: _gelesen.kreis ? ('GAA ' + _gelesen.kreis + ', Bericht ' + (_gelesen.berichtsjahr || '')) : _gelesen.dateiname,
        werte: gewaehlt,
      });
      erg.innerHTML = '<p class="mz-leer">' + r.uebernommen + ' von ' + gewaehlt.length +
        ' übernommen. Die übrigen waren bereits hinterlegt.</p>';
      laden(true);
    } catch (e) {
      erg.innerHTML += '<p class="mz-warn">' + esc(e.message) + '</p>';
    }
  }

  function zeichne(d) {
    var body = document.getElementById('mz-body');
    if (!body) return;
    var par = (d.parameter || []);
    var q = (d.quellen || []);
    var frei = q.filter(function (s) { return s.zugang === 'frei' || s.zugang === 'namensnennung'; }).length;
    var kauf = q.filter(function (s) { return s.zugang === 'kostenpflichtig' || s.zugang === 'auf_anfrage'; }).length;
    var alt = q.filter(function (s) {
      var t = tageSeit(s.letzter_fund);
      return s.letzter_fund == null || (t != null && t > 540);
    }).length;

    body.innerHTML =
      '<div class="mz-ks">' +
        kachel('Quellen gesamt', q.length) +
        kachel('frei abrufbar', frei, 'werden automatisch geprüft') +
        kachel('kostenpflichtig', kauf, 'nur manuell nach Kauf') +
        kachel('nicht aktuell', alt, 'seit über 18 Monaten ohne Fund') +
      '</div>' +
      '<h3 class="mz-h">Abdeckung nach Stufe</h3>' + abdeckungsBalken(par) +
      '<h3 class="mz-h">Quellen' +
        '<button class="mz-btn mz-r" data-pruefen="alle">alle freien prüfen</button></h3>' +
      quellenTabelle(q) +
      '<h3 class="mz-h">Kreise &amp; Berichte</h3>' + kreisTabelle(d.werte || [], q) +
      '<h3 class="mz-h">Bericht einlesen</h3>' + importBlock() +
      '<h3 class="mz-h">Hinterlegte Werte</h3>' + werteTabelle(d.werte || []);

    var lb = document.getElementById('mz-lesen');
    if (lb) lb.addEventListener('click', auslesen);
    body.querySelectorAll('[data-pruefen]').forEach(function (b) {
      b.addEventListener('click', function () { anstossen(b.getAttribute('data-pruefen'), b); });
    });
  }

  async function anstossen(id, knopf) {
    var alt = knopf.textContent;
    knopf.disabled = true;
    knopf.textContent = 'wird eingereiht …';
    try {
      var r = await _call('POST', '/marktzinsen/pruefen', { source_id: id === 'alle' ? null : id });
      /* "eingereiht", nicht "laeuft" — der Taktgeber arbeitet die Schlange ab,
       * ein Abruf je Sekunde. Wer haemmert, faellt in die Sperre. */
      knopf.textContent = r && r.gesperrt ? 'erst in ' + r.gesperrt : 'eingereiht ✓';
      setTimeout(function () { knopf.disabled = false; knopf.textContent = alt; laden(true); }, 4000);
    } catch (e) {
      knopf.textContent = 'Fehler';
      setTimeout(function () { knopf.disabled = false; knopf.textContent = alt; }, 2500);
    }
  }

  function stil() {
    if (document.getElementById('mz-css')) return;
    var s = document.createElement('style');
    s.id = 'mz-css';
    s.textContent =
      '#view-marktzinsen .mz-ks{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}' +
      '#view-marktzinsen .mz-k{padding:14px 16px;border:1px solid rgba(255,255,255,.08);border-radius:8px}' +
      '#view-marktzinsen .mz-k-v{font-size:26px;font-weight:600;color:#F2ECDC}' +
      '#view-marktzinsen .mz-k-l{font-size:12px;color:#A89F8E;margin-top:3px}' +
      '#view-marktzinsen .mz-k-s{font-size:11px;color:#7a7468;margin-top:2px}' +
      '#view-marktzinsen .mz-h{margin:22px 0 10px;font-size:13px;letter-spacing:.05em;' +
        'text-transform:uppercase;color:#A89F8E;display:flex;align-items:center;gap:10px}' +
      '#view-marktzinsen .mz-bar{display:flex;height:22px;border-radius:5px;overflow:hidden;background:#2a2a2e}' +
      '#view-marktzinsen .mz-legs{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;font-size:11.5px;color:#A89F8E}' +
      '#view-marktzinsen .mz-leg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px}' +
      '#view-marktzinsen .mz-leg b{color:#F2ECDC;margin-left:3px}' +
      '#view-marktzinsen .mz-tab td{vertical-align:top;font-size:12.5px}' +
      '#view-marktzinsen .mz-tag{padding:2px 8px;border-radius:10px;font-size:11px;white-space:nowrap}' +
      '#view-marktzinsen .mz-not{font-size:11px;color:#7a7468;margin-top:3px;max-width:420px}' +
      '#view-marktzinsen .mz-warn{font-size:11px;color:#D8865C;margin-top:2px}' +
      '#view-marktzinsen .mz-alt{background:rgba(216,134,92,.05)}' +
      '#view-marktzinsen .mz-q{font-size:11px;color:#7a7468;max-width:320px}' +
      '#view-marktzinsen .mz-btn{padding:4px 10px;border-radius:5px;border:1px solid rgba(201,168,76,.4);' +
        'background:transparent;color:#C9A84C;font-size:11.5px;cursor:pointer;white-space:nowrap}' +
      '#view-marktzinsen .mz-btn:hover{background:rgba(201,168,76,.12)}' +
      '#view-marktzinsen .mz-btn:disabled{opacity:.5;cursor:default}' +
      '#view-marktzinsen .mz-kauf{border-color:rgba(216,134,92,.5);color:#D8865C;text-decoration:none}' +
      '#view-marktzinsen .mz-r{margin-left:auto;font-size:11px}' +
      '#view-marktzinsen .mz-akt{text-align:right}' +
      '#view-marktzinsen .mz-leer{color:#7a7468;font-size:12.5px;padding:10px 0}' +
      '#view-marktzinsen .mz-imp{padding:14px 16px;border:1px solid rgba(201,168,76,.25);border-radius:8px}' +
      '#view-marktzinsen .mz-imp-h{font-size:13px;color:#E8CC7A;margin-bottom:4px}' +
      '#view-marktzinsen .mz-imp-s{font-size:11.5px;color:#A89F8E;margin-bottom:10px;max-width:640px}' +
      '#view-marktzinsen .mz-imp-r{display:flex;gap:10px;align-items:center;flex-wrap:wrap}' +
      '#view-marktzinsen .mz-imp-r input[type=text]{padding:5px 9px;border-radius:5px;width:170px;' +
        'border:1px solid rgba(255,255,255,.14);background:transparent;color:#F2ECDC;font-size:12px}' +
      '#view-marktzinsen .mz-imp-k{margin:12px 0 6px;font-size:12.5px;color:#E8CC7A}' +
      '#view-marktzinsen .mz-imp-f{display:flex;align-items:center;gap:14px;margin-top:10px}';
    document.head.appendChild(s);
  }

  function laden(still) {
    var body = document.getElementById('mz-body');
    if (!body) return;
    if (!still) body.innerHTML = '<p class="mz-leer">wird geladen …</p>';
    _call('GET', '/marktzinsen/uebersicht')
      .then(function (d) { stil(); zeichne(d || {}); geladen = true; })
      .catch(function (e) {
        body.innerHTML = '<p class="mz-leer">Konnte nicht geladen werden: ' + esc(e.message) + '</p>';
      });
  }

  function init() {
    var link = document.querySelector('.nav-link[data-view="marktzinsen"]');
    if (link) link.addEventListener('click', function () { setTimeout(function () { if (!geladen) laden(); }, 30); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AdminMarktzinsen = { laden: laden };
})();
