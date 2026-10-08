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
    /* v1965: die MODERNISIERUNGSPUNKTE gehen mit. Ohne sie kann der
       Endpunkt Anlage 2 nicht anwenden - er fiel still auf die Schaetzung
       zurueck, waehrend die Oberflaeche „rechnet nach Anlage 2 neu"
       versprach. Der Wert kommt aus derselben Quelle wie die Zeile
       darunter (`modPunkte()`), damit nicht zwei Zahlen entstehen. */
    var _mp = modPunkte();
    return { plz: _v('plz'), ort: _v('ort'), str: _v('str'), hnr: _v('hnr'), objart: _v('objart'),
             baujahr: _v('baujahr'), einheiten: _v('einheiten'), nutzungsart: _v('nutzungsart'), wfl: _v('wfl'),
             mod_punkte: _mp ? _mp.total : null, modernis: _v('modernis') };
  }

  /* ═══ Automatik-Leiste ═══════════════════════════════════════════════ */
  var _autoLauf = 0;
  function zeile(k, w, q, aktion) {
    return '<div class="oe-row"><span class="oe-k">' + k + '</span><span class="oe-w">' + w + '</span><span class="oe-q">' + q + '</span><span>' + (aktion || '') + '</span></div>';
  }
  /* v1865 · Marcel: „nirgendwo ist beschrieben, wofür welche Stufe steht." Die
     Bedeutung kommt aus WertParameterService (A/B/C/D/E), hier als Tooltip
     an jeder Pille und als Legende unter der Leiste. */
  var STUFEN = {
    A: 'Stufe A — amtlich: vom zuständigen Gutachterausschuss für dieses Gebiet und diese Objektart abgeleitet.',
    B: 'Stufe B — amtlich, aber übergeordnet (Kreis- oder Landesebene) oder Modellansatz des Ausschusses; indikativ.',
    C: 'Stufe C — amtlicher Wert einer anderen Gemeinde desselben Ausschusses; indikativ.',
    D: 'Stufe D — gesetzlicher Auffangwert nach § 256 BewG, nicht marktabgeleitet.',
    E: 'Stufe E — eigene Angabe des Nutzers.'
  };
  function st(cls, txt) {
    var m = String(txt || '').match(/^Stufe ([A-E])$/);
    var tip = m && STUFEN[m[1]] ? ' title="' + esc(STUFEN[m[1]]) + '"' : '';
    return '<span class="oe-st ' + cls + '"' + tip + '>' + esc(txt) + '</span>';
  }
  /* ══ v1967 · WELCHE RESTNUTZUNGSDAUER HIER STEHT ══════════════════════

     Marcel am 08.10.2026: „Es koennte ja sein, dass die Leute, wenn sie
     Restnutzungsdauer lesen, dann denken, dass sie sich auf ein
     Restnutzungsdauergutachten bezieht. Das ist ja in diesem Fall nicht
     so. Wenn das so ist, muesstest du mir das einmal sagen."

     ES IST SO. Die Zahl in dieser Leiste ist die Restnutzungsdauer FUER
     DIE VERKEHRSWERTERMITTLUNG: sie traegt die lineare
     Alterswertminderung im Sachwertverfahren (Paragraf 38 Abs. 1
     ImmoWertV) und den Vervielfaeltiger im Ertragswertverfahren
     (Paragraf 34). Ein Restnutzungsdauergutachten nach Paragraf 7
     Abs. 4 Satz 2 EStG verfolgt einen ANDEREN Zweck — die
     Abschreibungsdauer gegenueber dem Finanzamt — und wird vom Modul
     fuer Nutzungsdauergutachten erstellt, nicht hier.

     Dieselbe Formel, zwei Zwecke. Deshalb steht es jetzt dran, statt
     dass der Leser es sich zusammenreimt. */
  var RND_HINWEIS = '<div class="oe-legende"><b>Restnutzungsdauer:</b> die hier '
    + 'gezeigte Zahl gilt für die <b>Verkehrswertermittlung</b> — Alterswertminderung '
    + 'im Sachwertverfahren (§ 38 ImmoWertV) und Vervielfältiger im Ertragswertverfahren '
    + '(§ 34). Ein <b>Restnutzungsdauergutachten</b> für die Abschreibung '
    + '(§ 7 Abs. 4 Satz 2 EStG) ist etwas anderes und entsteht nicht hier.</div>';

  var LEGENDE = '<div class="oe-legende"><b>Stufen:</b> A amtlich für Gebiet und Objektart · B amtlich, übergeordnet oder Modellansatz · '
    + 'C amtlich aus einer Nachbargemeinde desselben Ausschusses · D gesetzlicher Auffangwert (§ 256 BewG) · E eigene Angabe. '
    + 'Eingabetiefe 1/2/3 = Marktpreisindikation / erweiterte Indikation / Sach- und Ertragswert.</div>';
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

  /* ══ v1972 · DER WEG ZUR ANLAGE 2 ════════════════════════════════════

     Marcel am 08.10.2026: „das brauchst du nicht weiter anzeigen, also
     dass das gemacht wird. Aber es wäre schon gut, dass man signalisiert
     bekommt: Wo ist denn die Anlage 2 und wo muss ich die aufstellen?
     Dass der Weg klar ist. Vielleicht, ja, dass man da irgendwie einen
     kleinen Absprung hat ... Oder wenigstens das rauslesen kann dann im
     Tab Objekt, welche Felder da wo gefüllt werden müssten."

     Die Zeile sagte bisher, wie viel schon erfasst IST („5 von 8
     Bauteilen angegeben, gerechnet"). Das ist eine Auskunft über den
     Stand, keine über den WEG. Jetzt stehen die acht Felder als Chips
     da, die leeren hervorgehoben, und ein Klick springt hin.

     Der Absprung ist nicht neu gebaut: `abweichend(feld)` gibt es seit
     v1852 und macht genau das Richtige — es öffnet die Detailkarte
     (`#oe-karte-gewerke`, `data-oe-detail="1"`), setzt die Eingabetiefe
     auf Stufe 3, klappt auf, rollt hin und setzt den Fokus. Der
     Klick-Verteiler auf `[data-oe-feld]` liegt schon. Es fehlte nur der
     Knopf.

     > Die Beschriftungen stehen HIER und nicht im HTML abgelesen: ein
     > `<label class="oe-sr">` ist für Bildschirmleser gedacht und heißt
     > „Außenwände · modernisiert" — in einem Chip ist der Zusatz
     > Füllmaterial. Dafür sind es dieselben acht Schlüssel wie in
     > `modPunkte()` darunter, damit nicht zwei Listen entstehen. */
  var MOD_FELDER = [
    ['mod_dach',        'Dach'],
    ['mod_fenster',     'Fenster'],
    ['mod_leitungen',   'Leitungen'],
    ['mod_heizung',     'Heizung'],
    ['mod_aussenwand',  'Außenwände'],
    ['mod_baeder',      'Bäder'],
    ['mod_innenausbau', 'Innenausbau'],
    ['mod_grundriss',   'Grundriss'],
  ];

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
    /* ══ v1973 · GESETZT IST NICHT GESPEICHERT ═════════════════════════

       Hier stand nur `sel.value = v;`.

       Ein programmatisch gesetzter Wert loest KEIN `change`-Ereignis aus.
       Die Punkte standen damit im Auswahlfeld, aber die Speicherung hat
       sie nie gesehen — obwohl `storage.js:43` `mod_punkte` ausdruecklich
       unter den gesicherten Feldern fuehrt.

       GEMESSEN am 08.10.2026 in der Produktionsdatenbank:

         21 Objekte fuehren die acht Modernisierungsfelder
         10 davon haben ein LEERES `mod_punkte`

       Bei diesen zehn faellt der Bericht auf die Schaetzung zurueck,
       obwohl die Antworten vorliegen — und nichts widerspricht. Genau
       der stille Rueckfall, den dieselbe Datei an anderer Stelle als
       „schlimmer als ein Fehler" bezeichnet.

       `mfh-einheiten.js:624` macht es seit Langem richtig und ist die
       Vorlage: `dispatchEvent(new Event('change', { bubbles: true }))`.

       > KEINE SCHLEIFE: die `change`-Listener fuer die Automatik haengen
       > an den ACHT Gewerke-Feldern (`mod_dach` bis `mod_grundriss`),
       > nicht an `mod_punkte`. Vorher gegengelesen — `mod_punkte` wird in
       > dieser Datei von keinem Listener beobachtet. */
    if (sel.value !== v) {
      sel.value = v;
      try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    }
  }

  /* ══ v1979 · WORIN SICH ZWEI BERICHTE UNTERSCHEIDEN ══════════════════

     Marcel: „man hat die hintereinander abgerufen und wuerde ja jetzt
     erwarten, dass die gleich sind ... kann ja sein, dass er da wieder
     was eingetippt hat, zwei unterschiedliche Sachen, und dann passt das
     nicht mehr und er kann sich nicht mehr dran erinnern."

     Verglichen wird mit dem naechstaelteren Bericht DERSELBEN ART —
     einen Ertragswert gegen einen Sachwert zu stellen waere sinnlos.

     Gezeigt wird die ZEILE des Rechenwegs, die sich unterscheidet, nicht
     eine Prozentzahl. „9.256 EUR mehr" sagt nichts; „sonstige Ertraege
     1.080 EUR x Barwertfaktor" sagt, was eingetippt war.

     > Der Vergleich ueber die BESCHRIFTUNG, nicht ueber die Position:
     > fehlt eine Zeile, verschieben sich alle folgenden um eins, und ein
     > Vergleich nach Index meldet dann fuenf Unterschiede statt einem.
     > Gemessen an den beiden Parkstr.-Berichten: 11 gegen 12 Zeilen. */
  function _wegMap(weg) {
    var m = {};
    (weg || []).forEach(function (z) {
      if (!z || !z.pos) return;
      /* Die Beschriftung traegt teils Zahlen in Klammern. Fuer
         den Vergleich zaehlt der Name davor, die Klammer steht
         in der Anzeige. */
      var name = String(z.pos).replace(/\s*\(.*$/, '').trim();
      m[name] = { wert: z.wert, voll: String(z.pos) };
    });
    return m;
  }
  function _unterschiedZeigen(liste, i) {
    var ziel = document.getElementById('oe-vw-diff');
    if (!ziel) return;
    var h = liste[i];
    ziel.innerHTML = '';
    if (!h || !h.weg || !h.weg.length) return;
    /* den naechstaelteren Bericht DERSELBEN Art finden */
    var vor = null;
    for (var j = i + 1; j < liste.length; j++) {
      if (liste[j].art === h.art && liste[j].weg && liste[j].weg.length) { vor = liste[j]; break; }
    }
    if (!vor) return;
    var a = _wegMap(h.weg), b = _wegMap(vor.weg);
    var zeilen = [];
    Object.keys(b).forEach(function (k) {
      if (!(k in a)) zeilen.push({ art: 'weg', k: k, voll: b[k].voll, wert: b[k].wert });
    });
    Object.keys(a).forEach(function (k) {
      if (!(k in b)) zeilen.push({ art: 'neu', k: k, voll: a[k].voll, wert: a[k].wert });
      else if (String(a[k].wert) !== String(b[k].wert)) {
        zeilen.push({ art: 'anders', k: k, voll: a[k].voll, wert: a[k].wert, alt: b[k].wert });
      }
    });
    if (!zeilen.length) {
      ziel.innerHTML = '<span class="oe-q">Rechenweg identisch zum Bericht vom '
        + _datum(vor.created_at) + '.</span>';
      return;
    }
    var kopf = '<b>Unterschied zum Bericht vom ' + _datum(vor.created_at) + '</b>';
    var txt = zeilen.slice(0, 6).map(function (z) {
      var w = (z.wert == null || z.wert === '') ? '' : deNum(Number(z.wert)) + ' €';
      if (z.art === 'weg') return '<span class="oe-d-weg">− ' + esc(z.voll) + (w ? ' (' + w + ')' : '') + ' — damals dabei, jetzt nicht</span>';
      if (z.art === 'neu') return '<span class="oe-d-neu">+ ' + esc(z.voll) + (w ? ' (' + w + ')' : '') + ' — jetzt dabei, damals nicht</span>';
      return '<span class="oe-d-and">' + esc(z.k) + ': ' + deNum(Number(z.alt)) + ' € → ' + w + '</span>';
    }).join('<br>');
    ziel.innerHTML = '<div class="oe-q oe-vw-diff-box">' + kopf + '<br>' + txt
      + (zeilen.length > 6 ? '<br><span class="oe-q">… und ' + (zeilen.length - 6) + ' weitere</span>' : '')
      + '</div>';
  }

  async function automatik() {
    var box = $('oe-auto'); if (!box) return;
    var lauf = ++_autoLauf;
    var o = objektFuerApi();
    var mp = modPunkte();
    modPunkteSchreiben(mp);
    /* ══ v1967 · 0 PUNKTE IST EIN BEFUND, KEIN LEERES FELD ═════════════

       Gemessen an Parkstr. 9: 5 von 8 Bauteilen sind angegeben, und es
       kommen 0 von 20 Punkten heraus. Das ist RICHTIG gerechnet — die
       Anlage 2 vergibt weniger als die Maximalpunkte, wenn die
       Massnahmen weiter zurueckliegen, und bei alten Jahrgaengen null.

       Es ist aber nicht dasselbe wie „nichts angegeben", und der
       Bericht schrieb bisher genau das: „Es wurde kein
       Modernisierungsgrad erfasst." Deshalb steht hier jetzt, WAS die
       Zahl bedeutet und was sie kostet.

       Warum es der staerkste Hebel ist, am echten Kern gemessen
       (Parkstr. 9, Baujahr 1905, GND 80):

         0 Punkte   ->  10 Jahre   (Rueckfall: GND minus Alter, Untergrenze)
         8 Punkte   ->  Anlage 2 greift
        14 Punkte   ->  deutlich mehr

       Und die Restnutzungsdauer traegt den Gebaeudesachwert linear
       (Paragraf 38 Abs. 1 ImmoWertV). */
    /* v1972: die Chips sind der Weg. Die LEEREN tragen `fehlt` und
       stehen vorn — wer etwas nachtragen will, sieht zuerst, was fehlt. */
    var mpChips = (function () {
      var voll = [], leer = [];
      MOD_FELDER.forEach(function (f) {
        var c = '<span class="oe-chip' + (_v(f[0]) ? '' : ' fehlt')
          + '" data-oe-feld="' + f[0] + '">' + esc(f[1]) + '</span>';
        (_v(f[0]) ? voll : leer).push(c);
      });
      return '<span class="oe-chips">' + leer.concat(voll).join('') + '</span>';
    })();
    var mpQ = (mp && mp.total > 0 ? st('a', 'Anlage 2 greift') : st('x', 'Anlage 2 greift nicht'))
      + 'Die Punkte entstehen aus der Spalte „modernisiert" der Gewerke-Tabelle (Anlage 2 ImmoWertV) und tragen die Restnutzungsdauer. Klick springt zum Feld:'
      + '<br>' + mpChips;
    var mpZeile = zeile('Modernisierungspunkte', mp ? mp.total + ' von 20' : '—', mpQ, '');
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
      else {
        /* v1867 · Marcel: „dass der fehlt, aber auch warum und dass man den nicht
           braucht … und mit welchem Standardwert gerechnet wird". Der Bericht
           rechnet dann mit 1,0 (ohne Marktanpassung, § 7 Abs. 2 ImmoWertV). */
        var _artS = _v('objart').toUpperCase(), _mfh = /MFH|GESCH|BUERO/.test(_artS) || parseInt(_v('einheiten'), 10) >= 3;
        html += zeile('Sachwertfaktor', '1,00', st('b', 'Standard') + 'ohne Marktanpassung — ' + esc((sq && sq.hinweis) || 'Für diesen Ausschuss sind keine Sachwertfaktoren hinterlegt.')
          + (sq && sq.ausschuss ? ' <span class="oe-q" title="' + esc(sq.ausschuss) + '">(' + esc(String(sq.ausschuss).split(',')[0]) + ')</span>' : '')
          + (_mfh ? ' Für Mehrfamilienhäuser ist der Ertragswert das Verfahren, der Sachwert dient nur der Plausibilität — der Faktor wird nicht gebraucht.'
                  : ' Der vorläufige Sachwert ist damit eine Herstellungskostenrechnung, kein Marktwert.')
          + ' Eigener Ansatz möglich:', knopf('eintragen', 'sachwertfaktor'));
      }
      var gq = r.gnd_quelle === 'register' ? st('a', 'Register') : st('b', 'Anlage 1');
      /* ══ v1965 · DIE RESTNUTZUNGSDAUER MIT IHRER HERKUNFT ════════════

         Hier stand `r.rnd_jahre` ohne jede Einordnung, und dahinter die
         feste Zusage „mit N Modernisierungspunkten rechnet der Bericht
         nach Anlage 2 neu". Beides war an dieser Stelle nicht gedeckt:
         der Endpunkt hat Anlage 2 nie angewandt (siehe api.js, v1965),
         und eine 0 kam als Gedankenstrich an.

         Jetzt steht da, welcher der beiden Wege gerechnet hat:

           anlage2      das Modell der Anlage 2 aus den Punkten
           geschaetzt   Gesamtnutzungsdauer minus Alter — der RUECKFALL

         Beim Rueckfall steht auch, WARUM, denn das ist die Antwort auf
         Marcels Frage „wo muss ich die Eingaben machen": die
         Modernisierungspunkte sind der einzige Hebel. */
      var rndTxt = (r.rnd_jahre == null) ? '—' : deNum(r.rnd_jahre, (r.rnd_jahre % 1 ? 1 : 0));
      var rndQ = r.rnd_quelle === 'anlage2' ? st('a', 'Anlage 2')
              : r.rnd_quelle === 'geschaetzt' ? st('b', 'geschätzt') : '';
      var rndSatz = r.rnd_hinweis ? esc(r.rnd_hinweis)
              : 'Restnutzungsdauer aus Baujahr und Modernisierungspunkten (Anlage 2 ImmoWertV).';
      html += zeile('GND / RND', (r.gnd_jahre || '—') + ' / ' + rndTxt + ' J.',
        gq + 'Gesamtnutzungsdauer ' + (r.gnd_quelle === 'register' ? 'aus dem Modell des Ausschusses' : 'nach Anlage 1 ImmoWertV')
        + ' · ' + rndQ + rndSatz, '');
      var bpi = r.baupreisindex;
      if (bpi && bpi.wert) html += zeile('Baupreisindex', deNum(bpi.wert, 2), st('b', 'Konstante') + '2010 → ' + esc(bpi.stichtag || '') + ' · noch nicht je Ausschuss (Backlog B1)', '');
    }
    html += mpZeile;
    html += RND_HINWEIS + LEGENDE;   /* v1967 + v1865 */
    box.innerHTML = html;
    /* v1855 · was der Anfragen-Block wissen muss: fehlt der Zins, fehlt der Faktor? */
    /* v1865 · Stufe D ist der gesetzliche Auffangwert (§ 256 BewG) — ein Wert,
       aber keiner aus dem Register. Der Anfragen-Block muss das wissen, sonst
       nennt er eine Quelle, die der Bericht gar nicht benutzt (Parkstr. 9, MFH). */
    _leiste = { zins: !!(r && r.verfuegbar && r.stufe && r.stufe !== 'D' && r.stufe !== 'E'), zinsStufe: (r && r.stufe) || null,
                zinsGrund: (r && (r.quelle || r.grund)) || null,
                swf: !!(r && r.sachwertfaktor_quelle && r.sachwertfaktor_quelle.verfuegbar),
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
    /* Nur die drei Kennzahlen, die der Bericht rechnet — Erbbau-Koeffizienten,
       Preisentwicklung und Durchschnittspreise bleiben im Register, nicht hier. */
    var relevant = function (e) { var k = String(e.kennzahl || '') + ' ' + String(e.name || ''); return /liegenschaft|lzs|sachwert|swf|bodenricht/i.test(k); };
    var hinterlegt = ((q && q.hinterlegt) || []).filter(relevant), fehlt = ((q && q.fehlt) || []).filter(relevant);
    /* v1858a · Parkstr. 9: zweimal „Sachwertfaktor" (zwei Tabellen desselben
       Ausschusses) — je Kennzahl eine Zeile, die erste gewinnt. */
    (function () { var gesehen = {}; hinterlegt = hinterlegt.filter(function (e) { var n = NAME[e.kennzahl] || e.name || e.kennzahl; if (gesehen[n]) return false; gesehen[n] = true; return true; }); })();
    var kurz = function (s) { return String(s || '').replace(/^Der Gutachterausschuss für Grundstückswerte /, 'GAA ').split(',')[0]; };
    /* v1869 · Marcel (Parkstr. 9): „den brauchen wir ja nicht … dann könnten wir
       es auch rausnehmen." Für Mehrfamilien- und Gewerbeobjekte ist der
       Ertragswert das Verfahren — der Sachwertfaktor ist dort keine Lücke,
       also keine Zeile und keine Anfrage. Die Leiste oben erklärt den Standard. */
    var _artQ = _v('objart').toUpperCase();
    var swfRelevant = !(/MFH|GESCH|BUERO|HOTEL|GEW/.test(_artQ) || parseInt(_v('einheiten'), 10) >= 3);
    if (!swfRelevant) {
      var _ohneSwf = function (e) { return !/sachwert|swf/i.test(String(e.kennzahl) + String(e.name)); };
      hinterlegt = hinterlegt.filter(_ohneSwf); fehlt = fehlt.filter(_ohneSwf);
    }
    var swfOhneArt = swfRelevant && _leiste && !_leiste.swf;
    /* v1858c · steht der Sachwertfaktor schon in „fehlt" (Register führt
       keinen), kommt keine zweite Zeile dazu — Parkstr. 9 hatte zwei. */
    if (fehlt.some(function (e) { return /sachwert|swf/i.test(String(e.kennzahl) + String(e.name)); })) swfOhneArt = false;
    hinterlegt.forEach(function (e) {
      var istSwf = /sachwert|swf/i.test(String(e.kennzahl) + e.name);
      var link = e.quelle_url ? '<a href="' + esc(e.quelle_url) + '" target="_blank" rel="noopener">' + (/\.pdf(\?|$)/i.test(e.quelle_url) ? 'Bericht (PDF)' : 'Quelle öffnen') + '</a>' : '<span class="oe-leer">kein Link hinterlegt</span>';
      var text = esc(kurz(e.ausschuss || q.ausschuss)) + (e.jahrgang || e.berichtsjahr ? ' · ' + esc(e.jahrgang || e.berichtsjahr) : '') + (e.gebiet ? ' · ' + esc(e.gebiet) : '');
      /* Faktor hinterlegt, aber nicht für diese Objektart (Lippe: nur EZFH) — EINE Zeile, nicht zwei */
      if (istSwf && swfOhneArt) { text += ' · <span title="' + esc(_leiste.swfHinweis || '') + '">nicht für diese Objektart</span>'; swfOhneArt = false; }
      /* v1865 · dasselbe für den Zins: Register führt ihn, aber nicht für diese
         Objektart (Minden-Lübbecke: ETW, EFH, ZFH — kein MFH) — der Bericht
         rechnet dann mit dem Auffangwert. Die Zeile sagt das, statt „hinterlegt". */
      var istZins = /liegenschaft|lzs/i.test(String(e.kennzahl) + e.name);
      if (istZins && _leiste && !_leiste.zins && _leiste.zinsStufe) {
        text += ' · <span title="' + esc(_leiste.zinsGrund || '') + '">nicht für die Objektart ' + esc(_v('objart').toUpperCase() || '?')
              + ' — der Bericht nimmt den gesetzlichen Auffangwert (Stufe ' + esc(_leiste.zinsStufe) + ')</span>';
      }
      zeilen.push('<div class="oe-qz' + ((istSwf && /nicht für diese Objektart/.test(text)) || (istZins && /Auffangwert/.test(text)) ? ' fehlt' : '') + '"><b>' + esc(NAME[e.kennzahl] || e.name || e.kennzahl) + '</b><span title="' + esc(e.ausschuss || q.ausschuss || '') + '">' + text + '</span>' + link + '</div>');
    });
    fehlt.forEach(function (e) {
      zeilen.push('<div class="oe-qz fehlt"><b>' + esc(NAME[e.kennzahl] || e.name || e.kennzahl) + '</b><span>nicht im Register — ' + esc(kurz(q && q.ausschuss) || 'Gutachterausschuss') + ' anfragen oder dem Grundstücksmarktbericht entnehmen</span><button type="button" class="oe-btn" data-oe-amt="gutachterausschuss">anfragen</button></div>');
    });
    if (swfOhneArt) {
      zeilen.push('<div class="oe-qz fehlt"><b>Sachwertfaktor</b><span title="' + esc(_leiste.swfHinweis || '') + '">für diese Objektart nicht abgeleitet — ' + esc(kurz(_leiste.ausschuss || (q && q.ausschuss)) || 'Gutachterausschuss') + ' anfragen</span><button type="button" class="oe-btn" data-oe-amt="gutachterausschuss">anfragen</button></div>');
    }
    if (zeilen.some(function (z) { return /fehlt/.test(z); })) zeilen.push('<div class="oe-qz"><b></b><span class="oe-q">Unterlagen und Grundstücksmarktbericht anfragen:</span><button type="button" class="oe-btn" data-oe-amt="gutachterausschuss">beim Amt anfragen</button></div>');
    var brauchtAnfrage = fehlt.length > 0 || (_leiste && (!_leiste.zins || (swfRelevant && !_leiste.swf)));
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
  /* v1862 · `artOpt`/`garOpt`: die geführte Eingabe kennt Art und Garagen
     schon aus dem Gespräch, bevor sie im Formular stehen. */
  function pflichtFuer(stufe, artOpt, garOpt) {
    var art = String(artOpt || _v('objart')).toUpperCase();
    var l = ['plz', 'ort', 'str', 'objart', 'wfl', 'baujahr'];
    if (stufe >= 2) {
      l = l.concat(['kp', 'nkm', 'ds2_zustand', 'ds2_energie', 'standardstufe', 'zimmer']);
      if (art === 'ETW') l.push('etage');
      if (art === 'MFH') l.push('einheiten');
    }
    if (stufe >= 3) {
      /* v1857 · am Rechenkern gemessen (CrossCheckService / nhk2010):
         - ETW: Sachwert braucht BGF der Wohnung UND Standardstufe — die BGF
           wird bei Wohnungen NICHT aus der Wohnfläche genähert (Z. 650 ff.);
         - Haus: NHK-Typ (Hausform · Geschosse · Dach) + Standardstufe, BGF
           sonst Näherung aus der Wohnfläche („nicht verlässlich");
         - MFH: Einheiten (NHK-Typ daraus) + Standardstufe;
         - Bodenwert: Grundstück + Bodenrichtwert, bei ETW der MEA — sonst
           „Sachwert OHNE Bodenwert";
         - Ertragswert: Miete, Baujahr (RND), Nutzungsart.
         Alles Weitere im Block verfeinert nur (Anlage-3-Ansätze als Rückfall). */
      l = l.concat(['nutzungsart', 'gsfl', 'brw', 'bgf']);
      if (art === 'ETW') l.push('mea');
      if (/^(EFH|ZFH|DHH|RH)$/.test(art)) l = l.concat(['nhk_haus', 'nhk_geschosse', 'nhk_dach']);
      var gar = parseFloat(String(garOpt != null && garOpt !== '' ? garOpt : _v('garagen')).replace(',', '.'));
      if (gar > 0) l = l.concat(['garagen_bgf_qm', 'garagen_stufe']);
    }
    return l;
  }
  /* v1857 · Die Felder des Stufe-3-Blocks, die NICHT Pflicht sind, tragen
     ein „optional"-Schild — Marcel: „Diese Angaben müssen doch auch alle
     gemacht werden?" Nein: ohne sie rechnet der Bericht mit den Ansätzen
     der Anlage 3; sie verfeinern. Das steht jetzt dran, statt dass ein
     fehlender Rahmen wie ein Fehler wirkt. */
  function optionalMarkieren() {
    var e3 = document.querySelector('.card[data-oe-stufe-min="3"]'); if (!e3) return;
    var pflicht = pflichtFuer(3);
    e3.querySelectorAll('.f').forEach(function (f) {
      var el = f.querySelector('input,select'); if (!el || !el.id) return;
      var lab = f.querySelector('label'); if (!lab) return;
      var alt = lab.querySelector('.oe-opt'); if (alt) alt.remove();
      if (pflicht.indexOf(el.id) < 0) { var s = document.createElement('span'); s.className = 'oe-opt'; s.textContent = 'optional'; s.title = 'Verfeinert den Bericht — ohne Angabe gilt der Ansatz der Anlage 3 ImmoWertV bzw. kein Zuschlag.'; lab.appendChild(s); }
    });
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
  /* v2001 · Marcel: „wenn ich oben mit den kleinen Kreisen wechsle, dann
     steht immer noch: fuer Stufe 3 fehlt noch." Gemessen: `_fehlStufe`
     wurde NUR in stufeAbrufen() gesetzt - die Zeile unten zeigte die
     zuletzt ABGERUFENE Stufe, nicht die gewaehlte. Jetzt folgt sie der
     Wahl. Die Eingabetiefe selbst bleibt ein Merker je NUTZER (siehe
     oben) - verwirrend war nicht die gemerkte Tiefe, sondern dass die
     Zeile ihr nicht folgte. */
  function zielSetzen(z) { try { localStorage.setItem(ZIEL_KEY, String(z)); } catch (e) {} fehlZeileSetzen(z); zielAnwenden(); stufen(); }
  function zielAnwenden() {
    var z = zielstufe();
    document.querySelectorAll('[data-oe-ziel]').forEach(function (b) { b.classList.toggle('on', parseInt(b.getAttribute('data-oe-ziel'), 10) === z); });
    /* v1866 · im Reiter Objekt nur noch der Stand; gewählt wird oben (Pre-Flight) */
    var stat = $('oe-ziel-status');
    if (stat) {
      var NAMEN = { 1: 'Einfach · Stufe 1', 2: 'Mittel · Stufe 2', 3: 'Ausgiebig · Stufe 3' };
      var fz = fehltFuer(z).length;
      stat.innerHTML = '<b>' + NAMEN[z] + '</b> ' + (fz ? st('x', fz + ' fehlt') + '<span class="oe-q">„' + fz + ' fehlt" in der Zeile unten zeigt die Felder.</span>' : st('a', 'bereit'));
    }
    var hint = $('oe-ziel-hint');
    /* v1868 · ein Satz je Stufe — Marcel: „ein bisschen schmaler, dass wir alles draufkriegen" */
    if (hint) hint.textContent = z === 1 ? 'Einfach: Adresse, Objektart, Wohnfläche, Baujahr — Marktpreisindikation.'
      : z === 2 ? 'Mittel: dazu Kaufpreis, Miete, Zustand, Energie, Standardstufe — erweiterte Indikation, Gewerke sichtbar.'
      : 'Ausgiebig: dazu Grundstück, Bodenrichtwert, bei Häusern BGF und NHK-Typ — Sach- und Ertragswert, Block unten.';
    /* ══ v1967 · ALLE Stufe-3-Bereiche, nicht nur der erste ════════════

       Hier stand `querySelector` — SINGULAR. Der Mechanismus war gebaut,
       deckte aber genau ein Element ab, und ein zweites Element mit
       demselben Attribut waere lautlos sichtbar geblieben.

       Marcel am 08.10.2026: „wenn wir natuerlich einfache Stufe haben,
       Stufe 1 oder Stufe 2, dann brauchen wir das ja gar nicht angeben,
       ne?" — richtig. Die Leiste zeigt Bodenrichtwert,
       Liegenschaftszins, Sachwertfaktor, GND/RND und Baupreisindex;
       alles davon braucht erst die Wertermittlung nach ImmoWertV. Kein
       einziges dieser Felder steht in pflichtFuer(1) oder
       pflichtFuer(2) — `brw` kommt erst bei `stufe >= 3` dazu. */
    document.querySelectorAll('[data-oe-stufe-min="3"]').forEach(function (e3) {
      e3.classList.toggle('oe-stufe-aus', z < 3);
      if (z === 3 && e3.classList.contains('v212-collapsed')) { var t = e3.querySelector('.v212-collapse-toggle'); if (t) t.click(); }
    });
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
    /* v1978: die Hebel-Markierung MIT abräumen — sonst bleibt der Rahmen
       stehen, wenn jemand das Feld gerade gefüllt hat. Gemessen am
       Vorgänger: `oe-pflicht-fehlt` wurde abgeräumt, eine zweite Klasse
       hätte überlebt. */
    document.querySelectorAll('.oe-hebel-leer').forEach(function (f) {
      f.classList.remove('oe-hebel-leer');
      f.querySelectorAll('input,select').forEach(function (el) { el.style.removeProperty('border-color'); el.style.removeProperty('box-shadow'); });
    });
    /* ══ v1978 · DIE LEEREN MODERNISIERUNGSFELDER WERDEN MITMARKIERT ════

       Marcel am 08.10.2026: „wenn wir Sachen haben, die noch fehlen, dann
       kann man ja draufklicken. Da wäre es gut, wenn du auch so eine rote
       Umrahmung um das Feld setzt. Die, die du jetzt gemacht hast, kann
       man nicht richtig erkennen."

       Die acht Gewerke-Felder sind seit v1972 als Chips verlinkt, das
       ZIELFELD selbst blieb aber unmarkiert — wer hinsprang, landete auf
       einem Feld wie jedem anderen.

       Markiert wird mit DERSELBEN Farbe und demselben Schatten wie die
       Pflichtfelder (`#B8625C`), nicht mit einer zweiten. Zwei Rottöne
       für dieselbe Aussage wären genau die Verwirrung, die hier gerade
       behoben wird.

       > SIE ZÄHLEN NICHT ALS PFLICHT. `fehltFuer()` bleibt unberührt, die
       > Stufen-Leiste sagt weiter „bereit". Marcels Entscheidung vom
       > 08.10.2026 war ausdrücklich, dass ohne Modernisierungspunkte
       > trotzdem ein Bericht entsteht — nur mit der Schätzung statt
       > Anlage 2. Ein roter Rahmen zeigt den Hebel, er sperrt nicht.

       Deshalb eine eigene Klasse `oe-hebel-leer` statt
       `oe-pflicht-fehlt`: die Optik ist dieselbe, die BEDEUTUNG nicht,
       und beim Aufräumen darf das eine nicht das andere mitnehmen. */
    fehltFuer(z).forEach(function (id) {
      var el = $(id); var f = el && el.closest('.f'); if (!f) return;
      f.classList.add('oe-pflicht-fehlt');
      el.style.setProperty('border-color', '#B8625C', 'important');
      el.style.setProperty('box-shadow', '0 0 0 2px rgba(184,98,92,.18)', 'important');
    });
    if (z >= 3) {
      MOD_FELDER.forEach(function (mf) {
        if (_v(mf[0])) return;
        var el = $(mf[0]); if (!el) return;
        var f = el.closest('.f') || el.closest('td') || el.parentElement;
        if (f) f.classList.add('oe-hebel-leer');
        el.style.setProperty('border-color', '#B8625C', 'important');
        el.style.setProperty('box-shadow', '0 0 0 2px rgba(184,98,92,.18)', 'important');
      });
    }
    optionalMarkieren();
    preflightPillen();
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
    /* v1858 · Marcel: „nicht so viel Weiß … in der gleichen Größe wie oben
       auch das Feld Bodenrichtwert … den Button an die Seite." Drei Zeilen
       im Raster der Leiste statt drei Kacheln. */
    box.innerHTML = '<div class="oe-auto oe-abruf-zeilen">' + [1, 2, 3].map(function (s) {
      var fehlt = fehltFuer(s).length, r = konto[s], k = kacheln[s];
      var aus = r === 0;
      var title = aus ? ('Kontingent aufgebraucht — ' + (ab[s] || '')) : fehlt ? (fehlt + ' Feld(er) fehlen — Klick zeigt sie') : 'abrufen';
      /* v1868 · kompakt: Name, frei, Pille — der Satz dazu steckt im Tooltip */
      return '<div class="oe-row' + (s === z ? ' on' : '') + '" title="' + esc(k.sub) + (aus && ab[s] ? ' · ' + ab[s] : '') + '">'
        + '<span class="oe-k">' + k.name + '</span>'
        + '<span class="oe-w">' + (r == null ? '—' : r + ' frei') + ' ' + (fehlt ? st('x', fehlt + ' fehlt') : st('a', 'bereit')) + '</span>'
        + '<span class="oe-q oe-q-kompakt">' + esc(k.sub) + (aus && ab[s] ? ' · ' + ab[s] : '') + '</span>'
        + '<span><button type="button" class="oe-btn' + (s === z ? ' solid' : '') + (fehlt ? ' oe-unvollstaendig' : '') + '" data-oe-stufe="' + s + '"' + (aus ? ' disabled' : '') + ' title="' + esc(title) + '">' + (fehlt ? 'was fehlt' : 'abrufen') + '</button></span>'
        + '</div>';
    }).join('') + '</div>';
    preflightPillen();
  }
  /* v1858 · dieselbe Eingabetiefe als drei Pillen in der Pre-Flight-Kachel
     „DealPilot" (object-actions.js, #oab-dp-stufen). Klick setzt sie. */
  /* v1867 · dieselben Pillen an zwei Orten: Pre-Flight-Kachel (#oab-dp-stufen)
     und Reiter-Kopf ([data-oe-pillen]). Eine Wahl, ein Merker. */
  function preflightPillen() {
    var hosts = [].slice.call(document.querySelectorAll('#oab-dp-stufen, [data-oe-pillen]'));
    hosts.forEach(pillenIn);
  }
  function pillenIn(host) {
    if (!host) return;
    var z = zielstufe();
    host.innerHTML = [1, 2, 3].map(function (s) {
      var fehlt = fehltFuer(s).length;
      return '<i class="dp-pf-pille' + (s === z ? ' on' : '') + (fehlt ? ' fehlt' : '') + '" data-oe-ziel="' + s + '" title="Stufe ' + s + (fehlt ? ' · ' + fehlt + ' Feld(er) fehlen' : ' · bereit') + '">' + s + '</i>';
    }).join('');
    /* Klick auf die Pille darf die Kachel nicht an-/abwählen */
    if (!host._oeBound) { host._oeBound = true; host.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); var p = e.target.closest('[data-oe-ziel]'); if (p) zielSetzen(parseInt(p.getAttribute('data-oe-ziel'), 10)); }); }
  }
  var _fehlStufe = null;   /* v1852: die zuletzt angefragte Stufe — die Fehlliste folgt der Eingabe */
  function fehlendeNachziehen() { if (_fehlStufe) fehlendeZeigen(_fehlStufe, fehltFuer(_fehlStufe)); }
  /* v2001 · eine Stelle, die die Zeile auf eine Stufe stellt - gerufen
     von den Kreisen UND beim Objektwechsel. Ohne den Objektwechsel blieb
     nach dem Loeschen die Fehlliste des geloeschten Objekts stehen. */
  function fehlZeileSetzen(z) { _fehlStufe = z; fehlendeZeigen(z, fehltFuer(z)); }
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

  /* ══ v1964 · WOHER DIE ZAHLEN STAMMEN ════════════════════════════════
     Marcel am 08.10.2026: „Unter Lage und Einschaetzung muss die Quelle
     dran, woher wir das bezogen haben und aus welchem Bericht."

     Vorher stand dort eine feste Beschriftung: „(Marktdaten, Zensus,
     Makro-Score)" - eine Aufzaehlung dessen, was es GEBEN KOENNTE, nicht
     dessen, was in DIESEM Bericht steckt. Eine Herkunftsangabe, die
     immer dieselbe ist, ist keine.

     Jetzt kommt sie aus `meta.provenance` des tatsaechlichen Berichts,
     mit seinem Datum. Fehlt beides, steht gar nichts da - lieber keine
     Angabe als eine erfundene. */
  function _lageHerkunft(D) {
    if (!D) return '';
    var teile = [];
    if (D.quelle_lage) teile.push(esc(D.quelle_lage));
    if (D.bericht_datum) teile.push('Bericht vom ' + esc(D.bericht_datum));
    return teile.length ? ' <span class="oe-q">(' + teile.join(' · ') + ')</span>' : '';
  }

  /* ═══ Lage: Einschätzung neben Datenlage (sobald ein Bericht da ist) ═ */
  function lageVergleich() {
    var box = $('oe-lage-vergleich'); if (!box) return;
    var D = null;
    try { D = (window.DealPilotMB && typeof DealPilotMB.letzter === 'function') ? DealPilotMB.letzter() : null; } catch (e) {}
    /* v1958b: die Lageklasse zuerst - sie ist die Entscheidung, die
       anderen sind Einschaetzungen. `_v()` liefert den rohen Wert (A/B/C),
       daraus wird "A-Lage". Leer bleibt leer und faellt durch den
       vorhandenen filter() heraus. */
    var eig = [['Lageklasse', (_v('lageklasse') ? _v('lageklasse') + '-Lage' : '')], ['Makrolage', _v('makrolage')], ['Mikrolage', _v('mikrolage')], ['Bevölkerung', _v('ds2_bevoelkerung')], ['Nachfrage', _v('ds2_nachfrage')]]
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
      + '<div class="oe-box"><h5>DATENLAGE · GEMESSEN' + _lageHerkunft(D) + '</h5>' + (dat.length ? dat.join(' · ') : '<span class="oe-leer">erscheint nach dem ersten Marktbericht</span>') + '</div>';
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
    /* ══ v1963 · JEDE ZAHL IST EIN EIGENER EINTRAG ═══════════════════
       Vorher stand hier nur der Marktwert je Bericht. Nach einer Stufe-3-
       Wertermittlung gibt es aber DREI Zahlen, und welche als Verkehrswert
       gilt, entscheidet der Sachverstaendige - nicht die Software.

       Deshalb wird je Bericht fuer jede vorhandene Zahl ein eigener
       Eintrag gebaut, benannt und datiert. Wer den Ertragswert will,
       waehlt den Ertragswert.

       > Die Reihenfolge ist Absicht: Ertragswert und Sachwert ZUERST,
       > denn sie stammen aus einem Verfahren nach ImmoWertV. Der
       > Marktwert ist eine Indikation aus Angebotspreisen. */
    var roh = (j && j.history) || [];
    var liste = [];
    roh.forEach(function (h) {
      /* v1965: `fuehrend` kommt aus `cross_check.verfahrenswahl` des
         Berichts - die Software entscheidet das nicht selbst, sie gibt
         die Entscheidung des Berichts weiter (Paragraf 6 Abs. 1
         ImmoWertV: das Verfahren richtet sich nach dem im gewoehnlichen
         Geschaeftsverkehr Ueblichen). Der MARKTWERT kann nie fuehrend
         sein - er ist eine Indikation aus Angebotspreisen, kein
         Verfahren nach ImmoWertV. */
      /* v1979: der Rechenweg je Art wandert mit in den Eintrag, damit
         zwei Berichte derselben Art verglichen werden koennen. */
      var basis = { created_at: h.created_at, ai_mode: h.ai_mode,
                    fuehrend_grund: h.fuehrend_grund, fuehrend_quelle: h.fuehrend_quelle };
      var fv = String(h.fuehrend || '');
      var e = Number(h.ertragswert_eur), s = Number(h.sachwert_eur), m = Number(h.market_value);
      if (isFinite(e) && e > 0) liste.push(Object.assign({}, basis, { wert: e, art: 'Ertragswert', fuehrend: fv === 'ertragswert', weg: h.ertrag_weg || null }));
      if (isFinite(s) && s > 0) liste.push(Object.assign({}, basis, { wert: s, art: 'Sachwert', fuehrend: fv === 'sachwert', weg: h.sachwert_weg || null }));
      if (isFinite(m) && m > 0) liste.push(Object.assign({}, basis, { wert: m, art: 'Marktwert', fuehrend: false }));
    });
    if (!liste.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    /* v1963: neueste zuerst. Innerhalb desselben Berichts bleibt die
       Einfuegereihenfolge (Ertrag, Sach, Markt) stehen - Array.sort ist
       in modernen Browsern stabil. */
    liste.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var opt = function (h, i) {
      /* v1963: die ART steht vorn - sie ist die Information, nicht das Datum. */
      /* v1965: das Kennzeichen steht HINTEN und klein, wie Marcel es
         wollte. Der Grund wandert in den Tooltip - im Dropdown ist kein
         Platz fuer einen Satz. */
      var _f = h.fuehrend ? ' · führend' : '';
      var _t = h.fuehrend && h.fuehrend_grund
        ? ' title="' + esc(h.fuehrend_grund + (h.fuehrend_quelle ? ' (' + h.fuehrend_quelle + ')' : '')) + '"' : '';
      return '<option value="' + i + '"' + _t + '>' + (h.art || 'Marktwert') + ' · '
        + _datum(h.created_at) + ' · ' + deNum(h.wert) + ' €' + _f + '</option>';
    };
    box.innerHTML = (liste.length > 1
      ? '<select id="oe-vw-wahl" aria-label="Marktbericht wählen">' + liste.map(opt).join('') + '</select><div id="oe-vw-diff"></div>'
      : '<span class="oe-q">' + (liste[0].art || 'Marktwert') + ' · '
        + _datum(liste[0].created_at) + ': <b>' + deNum(liste[0].wert) + ' €</b></span>')
      + '<button type="button" class="oe-btn" id="oe-vw-btn">als Verkehrswert übernehmen</button>'
      + (liste.length > 1 ? '<span class="oe-q">' + liste.length + ' Berichte im Verlauf</span>' : '');
    box.style.display = '';
    box._liste = liste;
    /* v1979a: beim Rendern sofort den Unterschied des ersten Eintrags,
       und bei jeder Auswahl neu. Ohne den Listener blieb die Zeile leer —
       live gemessen, und es sah aus wie „es gibt keinen Unterschied". */
    var _s = $('oe-vw-wahl');
    if (_s) {
      _s.addEventListener('change', function () {
        _unterschiedZeigen(liste, parseInt(_s.value, 10) || 0);
      });
    }
    _unterschiedZeigen(liste, _s ? (parseInt(_s.value, 10) || 0) : 0);
  }
  function verkehrswertSetzen() {
    var box = $('oe-vw'), el = $('svwert'); if (!box || !el || !box._liste) return;
    /* v1979a: der Aufruf von `_unterschiedZeigen` stand HIER — in
       `verkehrswertSetzen()`, also im Weg zum Knopf „als Verkehrswert
       uebernehmen". Der Unterschied erschien damit erst NACH dem
       Uebernehmen, nicht beim Auswaehlen. Genau verkehrt: man will
       wissen, worin sich zwei Berichte unterscheiden, BEVOR man einen
       von ihnen uebernimmt. Er haengt jetzt am Dropdown. */
    var sel = $('oe-vw-wahl'); var h = box._liste[sel ? parseInt(sel.value, 10) || 0 : 0]; if (!h) return;
    /* v1963: `wert` statt `market_value` - der Eintrag weiss selbst,
       welche Zahl er traegt (Ertrags-, Sach- oder Marktwert). */
    el.value = String(Math.round(Number(h.wert != null ? h.wert : h.market_value)));
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
      /* v1867 · BGF grob aus der Wohnfläche: × 1,35 ist der EFH-Faustwert, mit dem
         der Bericht selbst rechnet, wenn die BGF fehlt (CrossCheckService
         BGF_FAKTOR). Als Schätzung gekennzeichnet, nie still. */
      if (e.target.closest('#oe-bgf-schaetzen')) {
        var wfl = parseFloat(String(_v('wfl')).replace(/\./g, '').replace(',', '.'));
        var bgfEl = $('bgf'), bh = $('oe-bgf-hint');
        if (!(wfl > 0) || !bgfEl) { if (bh) bh.textContent = 'Dafür braucht es erst die Wohnfläche.'; return; }
        var bgf = Math.round(wfl * 1.35);
        bgfEl.value = String(bgf);
        bgfEl.dispatchEvent(new Event('input', { bubbles: true })); bgfEl.dispatchEvent(new Event('change', { bubbles: true }));
        try { var hk = $('_dp_herkunft'); if (hk) { var o = {}; try { o = JSON.parse(hk.value || '{}'); } catch (e2) {} o.bgf = 'geschätzt (Wohnfläche × 1,35, EFH-Faustwert)'; hk.value = JSON.stringify(o); hk.dispatchEvent(new Event('change', { bubbles: true })); } } catch (e3) {}
        if (bh) bh.textContent = 'Schätzung: ' + deNum(wfl, 0) + ' m² × 1,35 = ' + deNum(bgf, 0) + ' m² BGF — grobe Näherung (DIN 277 misst außen, alle Grundrissebenen). Die Bauzeichnung ist genauer.';
        return;
      }
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
    /* v1972: dieselbe Liste wie MOD_FELDER oben — sie stand hier ein
       zweites Mal ausgeschrieben. */
    MOD_FELDER.map(function (f) { return f[0]; }).forEach(function (id) {
      var el = $(id); if (el) el.addEventListener('change', function () { spaeter(automatik, 100); });
    });
    ['makrolage', 'mikrolage', 'ds2_bevoelkerung', 'ds2_nachfrage'].forEach(function (id) { var el = $(id); if (el) el.addEventListener('change', function () { spaeter(lageVergleich, 100); }); });
    /* storage.js:206 feuert auf WINDOW, nicht auf document — ein Listener am
       document hoert es nie (gemessen v1851: die Leiste blieb auf
       „PLZ eintragen", obwohl die Hermannstrasse geladen war). Zweimal
       nachziehen: sofort nach dem Befuellen und nach dem Bodenrichtwert-
       Autolauf, der etwas spaeter seinen Status schreibt. */
    window.addEventListener('dp:object-ready', function () {
      /* v2001 · fehlZeileSetzen mit: ein frisches (leeres) Objekt trug
         sonst die Fehlliste des vorigen weiter. */
      setTimeout(function () { alles(); stufen(); fehlZeileSetzen(zielstufe()); }, 120);
      setTimeout(alles, 1800);
    });
    window.addEventListener('dp:plan-ready', function () { stufen(); });
    document.addEventListener('dp:plan-ready', function () { stufen(); });
    detailsInit();
    alles(); stufen();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verdrahten); else verdrahten();
  setTimeout(verdrahten, 600); setTimeout(verdrahten, 2500);

  /* v1862b · ein Bericht, der aus dem Dialog (geführte Eingabe, Sprechlauf)
     kam: Verkehrswert-Übernahme und Leiste nachziehen. */
  /* v1866 · die Pre-Flight-Karte wird neu gebaut (render in object-actions.js):
     Abruf-Box und Pillen dort neu füllen. „ändern ↑" im Reiter springt hoch. */
  window.addEventListener('dp:preflight-rendered', function () {
    try { zielAnwenden(); } catch (e) {}
    try { stufen(); } catch (e) {}
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#oe-ziel-aendern')) return;
    var bar = $('oab-bar') || $('oab-dp-stufen'); if (!bar) return;
    bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var p = $('oab-dp-stufen'); if (p) { p.classList.add('oe-blink'); setTimeout(function () { p.classList.remove('oe-blink'); }, 2400); }
  });
  window.addEventListener('dp:mb-ready', function () {
    setTimeout(function () { try { verkehrswertUebernahme(); } catch (e) {} try { automatik(); } catch (e) {} }, 1500);
  });
  /* ══ v1980 · DER VERLAUF GEHOERT ZUM OBJEKTWISSEN ════════════════════

     Marcel am 08.10.2026: „wichtig ist auch, dass natuerlich dieser
     Verlauf auch immer mit in das Objektwissen mit reingeht. Das haben
     wir ja irgendwie mit der Pilotanalyse gemacht."

     GEMESSEN, was der Co-Pilot heute bekommt (copilot.js, context()):

       pilot_analyse           seit v1847
       marktpreis_indikation   seit v1703
       die WERTERMITTLUNG      gar nicht

     Dabei liegt sie fertig da: die Wertanker-Liste fuehrt je Bericht
     Art, Wert, das fuehrende Verfahren samt Grund und seit v1979 den
     Rechenweg. An Parkstr. 9 sind das acht Eintraege aus vier Berichten.

     Der Chat fragte das Modell also zu einem Objekt, dessen
     Wertermittlung im Reiter daneben stand — genau der Befund, den v1847
     fuer die Pilot-Analyse behoben hat.

     Herausgegeben wird VERDICHTET: Art, Wert, Datum, fuehrend, Grund.
     Der Rechenweg bleibt drin, weil er die Frage „warum zwei
     verschiedene Ertragswerte?" beantwortet — aber nur die
     Positionsnamen und Betraege, nicht die ganze Staffel.

     > Gerechnet wird NICHTS. Nur gelesen, was die Leiste schon hat. */
  function verlauf() {
    var box = $('oe-vw');
    if (!box || !box._liste || !box._liste.length) return null;
    return box._liste.map(function (h) {
      return {
        art: h.art || null,
        wert_eur: h.wert != null ? Math.round(Number(h.wert)) : null,
        datum: h.created_at || null,
        fuehrend: !!h.fuehrend,
        fuehrend_grund: h.fuehrend || null ? (h.fuehrend_grund || null) : null,
        rechenweg: (h.weg || []).map(function (z) {
          return { pos: z && z.pos ? String(z.pos) : null, wert: z ? z.wert : null };
        }),
      };
    });
  }

  window.DealPilotObjektReiter = { automatik: automatik, gewerke: gewerke, stufen: stufen, lageVergleich: lageVergleich, abweichend: abweichend, modPunkte: modPunkte, verlauf: verlauf,
    zielstufe: zielstufe, zielSetzen: zielSetzen, fehltFuer: fehltFuer, pflichtFuer: pflichtFuer, stufeAbrufen: stufeAbrufen };
})();
