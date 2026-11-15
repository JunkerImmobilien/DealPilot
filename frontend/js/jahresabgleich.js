/* ══════════════════════════════════════════════════════════════════════
 * jahresabgleich.js — v3420 · Jahresabgleich im Bestand (erster Unterreiter)
 *
 * Marcel 14./15.11.2026: „wie wir Plan gegen Ist jedes Jahr machen können …
 * Tab Miete, Mieterhöhung, Steuern, Marktbericht … WEG-Protokolle, wie
 * verhält sich das Haus" · „ja Jahresabgleich zuerst" · Punkt 2: „wie es am
 * meisten Sinn macht" → ein Jahr gilt von selbst als abgeglichen, wenn alle
 * vier Schritte erledigt sind (kein Knopf, nichts wird gesperrt).
 * Konzept: Dateien/Fehler/jahresabgleich-konzept-2026-11-14.md
 * Vorlage: design/Vorschläge/pilot-analyse-demo.html
 *
 * EINGEBEN IN DEN REITERN, ABLESEN HIER. Kein Eingabefeld, kein Rechenkern:
 *   Miete   DpJahresbuch.zeilen() (Ist aus dem Reiter Miete, seit v3366 E4)
 *   Steuer  DpJahresbuch.zeilen() (_computeYearTotal, Status je Jahr)
 *   Wert    DpJahresbuch.mbLaden() (Marktberichte des Objekts)
 *   Haus    DpHausverlauf.lesen() (Protokolle, Abrechnungen, Sonderumlagen)
 *   Plan    _ankauf.plan (eingefrorene Projektionszeilen: nkm_y, cfop_y,
 *           zve_y, su_y, wert_y, rs)
 *
 * „erledigt" je Schritt (nur vergangene Jahre zählen, das laufende Jahr ist offen):
 *   Miete   Jahr vergangen (die Miete steht im Reiter Miete; ohne Liste
 *           rechnet E4 mit der heutigen Miete, das sagt die Karte)
 *   Steuer  Status „Bescheid" = erledigt, „erklärt" = teilweise
 *   Wert    ein Marktbericht in diesem Jahr
 *   Haus    WEG: Protokoll des Jahres und Jahresabrechnung (eine von beiden
 *           = teilweise); ohne WEG folgt der Schritt der Steuer (Kosten des
 *           Hauses stehen in der Anlage V)
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpJahresabgleich) return;
  var VERSION = 'v3420';
  var GOLD = 'var(--wl-c9a84c, #C9A84C)';
  var SCHRITTE = [['miete', 'Miete'], ['steuer', 'Steuer'], ['wert', 'Wert'], ['haus', 'Haus']];
  var WORT = { ok: 'erledigt', teil: 'teilweise', offen: 'offen', laufend: 'läuft' };
  var _gewaehlt = null, _gewaehltKey = null;

  function doc() { return global.document || null; }
  function istZahl(v) { return typeof v === 'number' && isFinite(v); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return istZahl(x) ? Math.round(x).toLocaleString('de-DE') + ' €' : '–'; }
  function vz(x) { return istZahl(x) ? (x > 0 ? '+' : (x < 0 ? '−' : '±')) + Math.abs(Math.round(x)).toLocaleString('de-DE') + ' €' : '–'; }
  function heuteJahr() { return new Date().getFullYear(); }
  function datumText(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : String(iso || ''); }
  function JB() { return global.DpJahresbuch || null; }
  function verfuegbar() { var j = JB(); return !!(j && j.verfuegbar && j.verfuegbar()); }
  function planZeile(jahr) {
    try {
      var A = global.DealPilotAnkauf, a = A && A.vorhanden && A.vorhanden() ? A.stand() : null;
      var p = a && Array.isArray(a.plan) ? a.plan : [];
      return p.filter(function (x) { return x && x.cal === jahr; })[0] || null;
    } catch (e) { return null; }
  }
  function projZeile(jahr) { var r = (global.State && global.State.cfRows) || []; return r.filter(function (x) { return x && x.cal === jahr; })[0] || null; }
  function mitWeg() {
    try { if (/ETW/i.test(String((doc().getElementById('objart') || {}).value || ''))) return true; } catch (e) {}
    try { var H = global.DpHausverlauf; return !!(H && H.lesen && H.lesen().hatWeg); } catch (e) { return false; }
  }
  /** Haus im Jahr: Protokoll, Abrechnung, Sonderumlagen, Ereignisse */
  function hausJahr(jahr) {
    var out = { protokoll: null, abrechnung: null, su: 0, suDa: false, ereignisse: [] };
    var H = global.DpHausverlauf; if (!H || !H.lesen) return out;
    var L; try { L = H.lesen(); } catch (e) { return out; }
    var jahrAus = function (d) { var m = String(d || '').match(/(\d{4})/); return m ? +m[1] : null; };
    (L.doks || []).forEach(function (d) {
      if (!d) return;
      var t = String(d.typ || ''), j = jahrAus(d.datum), lb = String(d.label || '');
      if (t === 'weg_protokoll' && j === jahr) out.protokoll = d.datum || String(jahr);
      /* Die Abrechnung für ein Jahr kommt meist im Folgejahr: zählt, wenn das Jahr im Namen steht oder sie im Folgejahr datiert ist */
      if (t === 'jahresabrechnung' && (lb.indexOf(String(jahr)) >= 0 || j === jahr + 1)) out.abrechnung = d.datum || lb;
    });
    (L.liste || []).forEach(function (e) {
      if (!e || e.jahr !== jahr) return;
      if (e.art === 'versammlung') { if (!out.protokoll) out.protokoll = e.datum || String(jahr); return; }
      if (e.art === 'sonderumlage' && istZahl(e.betrag)) { out.su += e.betrag; out.suDa = true; }
      out.ereignisse.push(e);
    });
    return out;
  }
  function steuerStand(s) { return s === 'bescheid' ? 'ok' : (s === 'erklaert' ? 'teil' : 'offen'); }
  /** Stand je Schritt für ein Jahr (z = Zeile aus DpJahresbuch.zeilen()) */
  function stand(z, weg) {
    if (!z) return null;
    var lauf = z.jahr >= heuteJahr(), h = hausJahr(z.jahr), s = {};
    s.miete = lauf ? 'laufend' : 'ok';
    s.steuer = lauf ? 'laufend' : steuerStand(z.status);
    s.wert = z.mb ? 'ok' : (lauf ? 'laufend' : 'offen');
    if (weg) s.haus = h.protokoll && h.abrechnung ? 'ok' : (h.protokoll || h.abrechnung ? 'teil' : (lauf ? 'laufend' : 'offen'));
    else s.haus = lauf ? 'laufend' : steuerStand(z.status);
    s._haus = h;
    s.n = SCHRITTE.filter(function (x) { return s[x[0]] === 'ok'; }).length;
    s.fertig = !lauf && s.n === 4;
    return s;
  }
  /** Erinnerung: ab Februar das Vorjahr, solange nicht alle vier erledigt sind */
  function erinnerung() {
    if (!verfuegbar()) return null;
    var vj = heuteJahr() - 1, z = JB().zeilen().filter(function (x) { return x.jahr === vj; })[0];
    if (!z || new Date().getMonth() < 1) return null;
    var s = stand(z, mitWeg());
    return s && !s.fertig ? { jahr: vj, n: s.n, offen: SCHRITTE.filter(function (x) { return s[x[0]] !== 'ok'; }).map(function (x) { return x[1]; }) } : null;
  }

  /* ── Anzeige ───────────────────────────────────────────────────── */
  function stil() {
    var d = doc(); if (!d || d.getElementById('dp-ja-stil') || !d.head) return;
    var s = d.createElement('style'); s.id = 'dp-ja-stil';
    s.textContent = [
      '.dp-ja{display:grid;gap:12px}',
      '.dp-ja-jahre{display:flex;gap:6px;flex-wrap:wrap}',
      '.dp-pa-wrap .dp-ja-jahre button{border:1px solid #E6DCC2 !important;background:#fff !important;border-radius:8px !important;padding:5px 11px !important;font:600 12.5px Inter,sans-serif !important;color:#2A2727 !important;display:inline-flex;align-items:center;gap:6px;cursor:pointer;box-shadow:none !important;min-height:0 !important}',
      '.dp-pa-wrap .dp-ja-jahre button[aria-pressed="true"]{border-color:' + GOLD + ' !important;background:color-mix(in srgb, ' + GOLD + ' 12%, #fff) !important}',
      '.dp-ja-jahre small{font:400 11px Inter,sans-serif;color:#7A7370}',
      '.dp-ja-pkt{width:8px;height:8px;border-radius:2px;display:inline-block;flex:0 0 auto}',
      '.dp-ja-ok{background:#3FA56C}.dp-ja-teil{background:#C99A2E}.dp-ja-offen{background:#B8625C}.dp-ja-laufend{background:#D9D1BF}',
      '.dp-ja-urteil{font:700 18px "Space Grotesk",Inter,sans-serif;color:#2A2727;margin:2px 0 0}',
      '.dp-pa-wrap .dp-ja p.dp-ja-satz{margin:0;font:400 13px/1.55 Inter,sans-serif;color:#4A4542;text-align:left !important}',
      '.dp-ja-erinnerung{border-left:3px solid ' + GOLD + ';background:color-mix(in srgb, ' + GOLD + ' 10%, #fff);border-radius:0 8px 8px 0;padding:8px 12px;font:500 13px Inter,sans-serif;color:#2A2727}',
      '.dp-ja-schritte{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}',
      '.dp-ja-schritt{border:1px solid #E6DCC2;border-radius:8px;padding:7px 10px;display:flex;gap:8px;align-items:center;font:600 12.5px Inter,sans-serif;color:#2A2727;background:#fff;min-width:0}',
      '.dp-ja-schritt small{display:block;font:400 11.5px Inter,sans-serif;color:#7A7370}',
      '.dp-ja-karten{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
      '.dp-ja-karte{border:1px solid #E6DCC2;border-radius:12px;background:#fff;padding:12px 14px;display:flex;flex-direction:column;gap:7px;min-width:0}',
      '.dp-ja-kk{display:flex;justify-content:space-between;align-items:center;gap:8px}',
      '.dp-ja-kk b{font:600 14px Inter,sans-serif;color:#2A2727}',
      '.dp-ja-st{font:600 11px Inter,sans-serif;border-radius:6px;padding:2px 8px;white-space:nowrap}',
      '.dp-ja-st.ok{color:#2f7d52;background:rgba(63,165,108,.13)}.dp-ja-st.teil{color:#8a6a12;background:rgba(201,154,46,.15)}.dp-ja-st.offen{color:#B8625C;background:rgba(184,98,92,.12)}.dp-ja-st.laufend{color:#6B645A;background:rgba(42,39,39,.06)}',
      '.dp-ja-drei{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}',
      '.dp-ja-drei div{border-radius:6px;padding:5px 8px;background:color-mix(in srgb, ' + GOLD + ' 9%, #fff);min-width:0}',
      '.dp-ja-drei small{display:block;font:400 10.5px Inter,sans-serif;color:#7A7370}',
      '.dp-ja-drei b{font:700 14px "Space Grotesk",Inter,sans-serif;color:#2A2727;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}',
      '.dp-ja .dp-ja-gut{color:#2f7d52 !important}.dp-ja .dp-ja-schlecht{color:#B8625C !important}',
      '.dp-pa-wrap .dp-ja-karte p{margin:0;font:400 12.5px/1.5 Inter,sans-serif;color:#4A4542;text-align:left !important}',
      '.dp-pa-wrap .dp-ja-karte p.q{font-size:11.5px;color:#7A7370}',
      '.dp-pa-wrap .dp-ja-karte button{align-self:flex-start;margin-top:auto}',
      '.dp-pa-wrap .dp-ja-karte button.dp-ja-gold{border-color:' + GOLD + ' !important;background:color-mix(in srgb, ' + GOLD + ' 14%, #fff) !important}',
      '.dp-ja-tafel{width:100%;border-collapse:collapse;font:400 12.5px Inter,sans-serif;color:#2A2727}',
      '.dp-ja-tafel th,.dp-ja-tafel td{text-align:right;padding:6px 8px;border-bottom:1px solid #EFE8D6;font-variant-numeric:tabular-nums}',
      '.dp-ja-tafel th:first-child,.dp-ja-tafel td:first-child{text-align:left}',
      '.dp-ja-tafel th{font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#7A7370}',
      '.dp-ja-tafel td small{color:#7A7370}',
      '.dp-ja-wrap{overflow-x:auto}',
      '@media (max-width:720px){.dp-ja-karten{grid-template-columns:1fr}.dp-ja-schritte{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    ].join('\n');
    d.head.appendChild(s);
  }
  function drei(plan, ist, hoeherGut, planHin) {
    var d = istZahl(plan) && istZahl(ist) ? ist - plan : null;
    var kl = d == null || Math.abs(d) < 0.5 ? '' : ((hoeherGut ? d > 0 : d < 0) ? 'dp-ja-gut' : 'dp-ja-schlecht');
    return '<div class="dp-ja-drei"><div><small>' + (planHin || 'Plan vom Kauf') + '</small><b>' + eur(plan) + '</b></div>'
      + '<div><small>Ist</small><b>' + (istZahl(ist) ? eur(ist) : '–') + '</b></div>'
      + '<div><small>Abweichung</small><b class="' + kl + '">' + (d != null ? vz(d) : '–') + '</b></div></div>';
  }
  function knopf(aktion, text, gold) { return '<button type="button" class="btn-clean dp-pa4-btn' + (gold ? ' dp-ja-gold' : '') + '" data-ja-aktion="' + aktion + '">' + text + '</button>'; }
  function stEtikett(x) { return '<span class="dp-ja-st ' + x + '">' + WORT[x] + '</span>'; }
  function zeileT(t, p, i, hoeherGut, hinweis) {
    var d = istZahl(p) && istZahl(i) ? i - p : null, kl = d == null || Math.abs(d) < 0.5 ? '' : ((hoeherGut ? d > 0 : d < 0) ? 'dp-ja-gut' : 'dp-ja-schlecht');
    return '<tr><td>' + t + (hinweis ? ' <small>' + hinweis + '</small>' : '') + '</td><td>' + eur(p) + '</td><td>' + (istZahl(i) ? eur(i) : '<small>noch offen</small>') + '</td><td class="' + kl + '">' + (d != null ? vz(d) : '–') + '</td></tr>';
  }

  function html() {
    if (!verfuegbar()) return '';
    stil();
    var Z = JB().zeilen().slice().sort(function (a, b) { return a.jahr - b.jahr; });
    if (!Z.length) return '';
    var weg = mitWeg(), key = global._currentObjKey;
    if (_gewaehltKey !== key) { _gewaehlt = null; _gewaehltKey = key; }
    var jahre = Z.map(function (z) { return z.jahr; });
    if (_gewaehlt == null || jahre.indexOf(_gewaehlt) < 0) _gewaehlt = jahre.indexOf(heuteJahr() - 1) >= 0 ? heuteJahr() - 1 : jahre[jahre.length - 1];
    var z = Z.filter(function (x) { return x.jahr === _gewaehlt; })[0], s = stand(z, weg), h = s._haus;
    var pl = planZeile(z.jahr), pr = projZeile(z.jahr), lauf = z.jahr >= heuteJahr();

    var out = '<div class="dp-ja" data-dp-ja="1">';
    var er = erinnerung();
    if (er && er.jahr !== _gewaehlt) out += '<div class="dp-ja-erinnerung">Jahresabgleich ' + er.jahr + ': ' + er.n + ' von 4 erledigt. Offen: ' + esc(er.offen.join(', ')) + '. <button type="button" class="btn-clean dp-pa4-link" data-ja-jahr="' + er.jahr + '">' + er.jahr + ' ansehen</button></div>';
    out += '<div class="dp-ja-jahre" role="group" aria-label="Jahr wählen">' + Z.map(function (x) {
      var sx = stand(x, weg), kl = x.jahr >= heuteJahr() ? 'laufend' : (sx.n === 4 ? 'ok' : (sx.n >= 2 ? 'teil' : 'offen'));
      return '<button type="button" class="btn-clean" data-ja-jahr="' + x.jahr + '" aria-pressed="' + (x.jahr === _gewaehlt) + '"><span class="dp-ja-pkt dp-ja-' + kl + '"></span>' + x.jahr + (x.jahr >= heuteJahr() ? '<small>läuft</small>' : '') + '</button>';
    }).join('') + '</div>';

    /* ein Satz */
    var dm = istZahl(z.miete_ist) && istZahl(z.miete_basis) ? z.miete_ist - z.miete_basis : null;
    var cfPlan = pl && istZahl(pl.cfop_y) ? pl.cfop_y : null, cfIst = pr && istZahl(pr.cfop_y) ? pr.cfop_y : null;
    var offen = SCHRITTE.filter(function (x) { return s[x[0]] !== 'ok'; }).map(function (x) { return x[1]; });
    out += '<div><div class="dp-ja-urteil">' + z.jahr + ': ' + (lauf ? 'das Jahr läuft noch' : (s.fertig ? 'abgeglichen' : s.n + ' von 4 Schritten erledigt')) + '</div>'
      + '<p class="dp-ja-satz">' + (dm != null ? 'Miete ' + vz(dm) + (dm >= 0 ? ' über' : ' unter') + ' dem Plan vom Kauf' : 'Für dieses Jahr gibt es keinen Plan vom Kauf')
      + (cfPlan != null && cfIst != null ? ', Cashflow vor Steuer ' + vz(cfIst - cfPlan) + ' zum Plan' : '') + '.'
      + (!lauf && offen.length ? ' Offen: ' + esc(offen.join(', ')) + '.' : '')
      + (lauf ? ' Abgeglichen wird es ab Februar ' + (z.jahr + 1) + ', wenn Steuer, Abrechnung und Protokoll da sind.' : '') + '</p></div>';
    out += '<div class="dp-ja-schritte">' + SCHRITTE.map(function (x, i) {
      return '<div class="dp-ja-schritt"><span class="dp-ja-pkt dp-ja-' + s[x[0]] + '"></span><span>' + (i + 1) + ' · ' + x[1] + '<small>' + WORT[s[x[0]]] + '</small></span></div>';
    }).join('') + '</div>';

    /* vier Karten */
    var k = [];
    var erh = (z.erhoehungen || []).map(function (e) { return datumText(e.datum) + (e.nr ? ' (Whg. ' + e.nr + ')' : '') + (istZahl(e.von) && istZahl(e.auf) ? ' ' + eur(e.von) + ' → ' + eur(e.auf) : (istZahl(e.auf) ? ' auf ' + eur(e.auf) : '')); });
    var listeLeer = false; try { var E = global.DpErhoehungen; listeLeer = !!(E && E.alle && !E.alle().length); } catch (e) {}
    k.push('<div class="dp-ja-karte"><div class="dp-ja-kk"><b>Miete ' + z.jahr + '</b>' + stEtikett(s.miete) + '</div>'
      + drei(z.miete_plan != null ? z.miete_plan : z.miete_proj, z.miete_ist, true, z.miete_plan != null ? 'Plan vom Kauf' : 'Projektion heute')
      + '<p>' + (erh.length ? 'Mieterhöhung: ' + esc(erh.join(', ')) + '.' : 'Keine Mieterhöhung in diesem Jahr eingetragen.')
      + (listeLeer && !lauf ? ' Ohne Liste rechnet DealPilot vergangene Jahre mit der heutigen Miete. Trag frühere Erhöhungen ein, dann stimmt das Ist.' : '') + '</p>'
      + '<p class="q">Aus dem Reiter Miete: Kaltmiete und Liste der Mieterhöhungen.</p>'
      + knopf('miete', 'Mieterhöhung eintragen', listeLeer && !lauf) + '</div>');
    var stW = { geplant: 'geplant', erklaert: 'erklärt, Bescheid fehlt', bescheid: 'Bescheid liegt vor' }[z.status] || 'geplant';
    k.push('<div class="dp-ja-karte"><div class="dp-ja-kk"><b>Steuer ' + z.jahr + '</b>' + stEtikett(s.steuer) + '</div>'
      + drei(pl && istZahl(pl.zve_y) ? pl.zve_y : null, z.steuer ? z.steuer.ergebnis : null, true)
      + '<p>Ergebnis Vermietung und Verpachtung (Anlage V). Stand: <b>' + stW + '</b>.</p>'
      + '<p class="q">Aus dem Reiter Steuer: Anlage V des Jahres. Den Stand setzt du unten in der Tafel „Alle Jahre“.</p>'
      + knopf('steuer', z.status === 'geplant' ? 'Anlage V ' + z.jahr + ' ausfüllen' : 'Anlage V ansehen', s.steuer === 'offen') + '</div>');
    k.push('<div class="dp-ja-karte"><div class="dp-ja-kk"><b>Wert ' + z.jahr + '</b>' + stEtikett(s.wert) + '</div>'
      + drei(pl && istZahl(pl.wert_y) ? pl.wert_y : null, z.mb ? z.mb.wert : null, true)
      + '<p>' + (z.mb ? 'Marktbericht vom ' + datumText(z.mb.am) + '.' : 'Für ' + z.jahr + ' liegt kein Marktbericht vor.') + '</p>'
      + '<p class="q">Aus deinen Marktberichten zu diesem Objekt. Einer im Jahr reicht für den Abgleich.</p>'
      + knopf(z.mb ? 'wert-sehen' : 'wert', z.mb ? 'Alle Berichte ansehen' : 'Marktbericht abrufen', s.wert === 'offen') + '</div>');
    var ev = h.ereignisse.slice(0, 3).map(function (e) { return esc(e.titel || e.text); }).filter(Boolean);
    var hausText = weg
      ? (h.protokoll ? 'Eigentümerversammlung ' + esc(h.protokoll) + '.' : 'Kein Protokoll für ' + z.jahr + '.') + ' ' + (h.abrechnung ? 'Jahresabrechnung liegt vor.' : 'Die Jahresabrechnung fehlt.') + (ev.length ? ' ' + ev.join(' · ') + '.' : '')
      : 'Kein Wohnungseigentum: die Kosten des Hauses stehen in der Anlage V, der Schritt folgt der Steuer.' + (ev.length ? ' ' + ev.join(' · ') + '.' : '');
    k.push('<div class="dp-ja-karte"><div class="dp-ja-kk"><b>Haus ' + z.jahr + '</b>' + stEtikett(s.haus) + '</div>'
      + drei(pl && istZahl(pl.su_y) ? pl.su_y : 0, h.suDa ? h.su : (lauf ? null : 0), false, 'Sonderumlage Plan')
      + '<p>' + hausText + '</p>'
      + '<p class="q">' + (weg ? 'Aus Haus &amp; Unterlagen: Protokolle, Jahresabrechnung, Sonderumlagen.' : 'Aus der Anlage V und den Unterlagen.') + '</p>'
      + knopf(weg ? 'haus' : 'steuer', weg ? 'Protokoll oder Abrechnung hochladen' : 'Anlage V ansehen', weg && s.haus !== 'ok' && !lauf) + '</div>');
    out += '<div class="dp-ja-karten">' + k.join('') + '</div>';

    /* Kauf gegen heute */
    out += '<div class="dp-pa-card"><div class="dp-pa-sec"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">Kauf gegen heute · ' + z.jahr + '</span><span class="dp-pa-rule"></span></div>'
      + '<p class="dp-pa-p">Was du beim Kauf für dieses Jahr gerechnet hast, gegen das, was tatsächlich war. Der Plan ist eingefroren.</p>'
      + '<div class="dp-ja-wrap"><table class="dp-ja-tafel"><thead><tr><th>Kennzahl</th><th>Plan vom Kauf</th><th>Ist</th><th>Abweichung</th></tr></thead><tbody>'
      + zeileT('Kaltmiete im Jahr', pl ? pl.nkm_y : null, z.miete_ist, true)
      + zeileT('Cashflow vor Steuer', cfPlan, cfIst, true, 'mit der Ist-Miete gerechnet')
      + zeileT('Ergebnis V+V', pl ? pl.zve_y : null, z.steuer ? z.steuer.ergebnis : null, true)
      + zeileT('Sonderumlage', pl && istZahl(pl.su_y) ? pl.su_y : 0, h.suDa ? h.su : (lauf ? null : 0), false)
      + zeileT('Wert laut Marktbericht', pl ? pl.wert_y : null, z.mb ? z.mb.wert : null, true)
      + zeileT('Restschuld', pl ? pl.rs : null, istZahl(z.rs_ist) ? z.rs_ist : z.rs_proj, false, istZahl(z.rs_ist) ? '' : 'laut Projektion')
      + '</tbody></table></div></div>';
    out += '</div>';
    return out;
  }

  /* ── Hosts, Klicks ─────────────────────────────────────────────── */
  function reiterMarke() {
    var d = doc(); if (!d) return;
    var er = erinnerung();
    Array.prototype.forEach.call(d.querySelectorAll('.dp-pa-tab'), function (b) {
      if ((b.getAttribute('onclick') || '').indexOf("'jahr'") < 0) return;
      var m = b.querySelector('.dp-ja-marke');
      if (!er) { if (m) m.parentNode.removeChild(m); return; }
      if (!m) { m = d.createElement('span'); m.className = 'dp-ja-marke'; m.style.cssText = 'margin-left:6px;font:600 10.5px Inter,sans-serif;color:#B8625C'; b.appendChild(m); }
      m.textContent = er.n + '/4';
      m.title = 'Jahresabgleich ' + er.jahr + ': ' + er.n + ' von 4 erledigt';
    });
  }
  function mountAll() {
    var d = doc(); if (!d || !d.querySelectorAll) return;
    var hs = d.querySelectorAll('[data-dp-ja-host]');
    for (var i = 0; i < hs.length; i++) { try { hs[i].innerHTML = html(); binden(hs[i]); } catch (e) { hs[i].innerHTML = ''; try { console.warn('[jahresabgleich]', e); } catch (x) {} } }
    reiterMarke();
    if (hs.length && JB() && JB().mbLaden && mountAll._mb !== global._currentObjKey) {
      mountAll._mb = global._currentObjKey;
      JB().mbLaden().then(function () { setTimeout(mountAll, 0); });
    }
  }
  /** Marktbericht in der Stufe, die der Nutzer gewählt hat (höchstens sein Detailgrad - stufeAbrufen(3) tut darüber still nichts) */
  function mbAbrufen() {
    try {
      var OR = global.DealPilotObjektReiter; if (!OR || typeof OR.stufeAbrufen !== 'function') return;
      var dg = global.DpDetailgrad && global.DpDetailgrad.stufe ? global.DpDetailgrad.stufe() : 3;
      var w = typeof OR.mbWahl === 'function' ? Number(OR.mbWahl()) : NaN;
      OR.stufeAbrufen(Math.max(1, Math.min(dg || 3, isFinite(w) && w > 0 ? w : 3)));
    } catch (x) {}
  }
  function zuReiter(sec) {
    var d = doc(), t = d && d.querySelector('.tab[data-target-sec="' + sec + '"]');
    if (t) t.click();
    try { var m = d.querySelector('.main-col'); if (m) m.scrollTop = 0; global.scrollTo(0, 0); } catch (e) {}
  }
  function binden(host) {
    if (host._dpJa) return; host._dpJa = true;
    host.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-ja-jahr],[data-ja-aktion]') : null; if (!b) return;
      ev.preventDefault();
      var j = b.getAttribute('data-ja-jahr');
      if (j) { _gewaehlt = +j; mountAll(); return; }
      var a = b.getAttribute('data-ja-aktion');
      if (a === 'miete') { zuReiter('s2'); setTimeout(function () { var e = doc().getElementById('mv_letzte_erhoehung'); var k = e && e.closest ? e.closest('.card,.sec-card,section,fieldset') : null; try { (k || e) && (k || e).scrollIntoView({ block: 'center' }); } catch (x) {} }, 300); return; }
      if (a === 'steuer') { zuReiter('s3-tax'); return; }
      if (a === 'wert') { mbAbrufen(); return; }
      if (a === 'wert-sehen') { var w = host.closest('.dp-pa-wrap'), t = w && w.querySelector('#dp-pa-tab-wert'); if (t) t.click(); return; }
      if (a === 'haus') { try { if (global.DpUnterlagen && global.DpUnterlagen.nachreichen) global.DpUnterlagen.nachreichen(); else if (global.DpEingang) global.DpEingang.oeffnen(); } catch (x) {} }
    });
  }
  if (global.addEventListener) {
    global.addEventListener('dp:object-ready', function () { mountAll._mb = null; setTimeout(mountAll, 950); });
    global.addEventListener('dp:erhoehungen', function () { setTimeout(mountAll, 120); });
  }

  global.DpJahresabgleich = { VERSION: VERSION, stand: stand, hausJahr: hausJahr, erinnerung: erinnerung, mbAbrufen: mbAbrufen, html: html, mountAll: mountAll, verfuegbar: verfuegbar };
})(typeof window !== 'undefined' ? window : globalThis);
