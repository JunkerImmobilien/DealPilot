/* ═══════════════════════════════════════════════════════════════════════════
   v3214 · N137 · W-15 · WEITERE SANIERUNGEN IN SPÄTEREN JAHREN
   Wunsch eines Entwicklungspartners: im Reiter Investition mehrere Sanierungen
   planen (Küche 2028, Dach 2031 …), nicht nur EINEN Betrag „Sanierungskosten“.

   Marcels Entscheidung (08.11.2026):
   • Spätere Sanierungen zählen NICHT zur Gesamtinvestition und NICHT zur
     Beleihung. Das bleibt das Feld #san (Ankauf, calc.js gi = kp + nk + san).
   • CASHFLOW: einmalige Ausgabe im Jahr des Eintrags (calc.js liest jeJahr(),
     wie die Sonderumlage; cfRows.san_y).
   • STEUER (automatisch, tax.js _computeAutoForYear liest steuerJahr()):
       Erhaltung   → Werbungskosten im Jahr, auf Wunsch verteilt auf 2-5 Jahre
                     (§ 82b EStDV), Feld „erhaltungsaufwand“.
       Herstellung → erhöht die AfA-Bemessung ab dem Jahr (nachträgliche HK,
                     R 7.4 Abs. 9 EStR: als zu Beginn des Jahres aufgewendet),
                     mit dem Satz der Gebäude-AfA, Feld „afa“.
   • 15-%-GRENZE (§ 6 Abs. 1 Nr. 1a EStG): Erhaltung in den drei Jahren nach
     der Anschaffung zählt zusammen mit #san (netto). Wird die Grenze gerissen,
     sind bei „automatisch“ die Einträge im Fenster UND #san anschaffungsnahe
     HK (AfA über die Nutzungsdauer). Eine feste Verteilung (1-5 Jahre) bleibt
     die Wahl des Nutzers - wie beim Feld #san -, die Liste warnt dann.
     Die Sonderumlage (Steuer nur als Vorschlag, sonderumlage.js) entscheidet
     hier nicht automatisch mit; ihr eigener 15-%-Hinweis zählt die Pläne mit
     (State.san15.planNetto).

   ABGRENZUNG ZUM ZIELBILD (potenzial.js zb_massnahmen, Hausmaßnahmen der
   Wohnungen): die Zielbild-Maßnahmen gehen in KEINEN Cashflow und keine
   Steuer - sie werden nur vom Wertzuwachs des Zielbilds abgezogen. Diese
   Liste geht in Cashflow und Steuer, nie ins Zielbild. Dieselbe Arbeit an
   beiden Stellen stünde doppelt; die Liste zeigt dann beide Summen und den
   Hinweis (wie potenzial.js herkunftAus() für #san).

   Gespeichert im versteckten Feld #san_plan (JSON, storage.js FIELDS + Reset):
     [{ bez, jahr, betrag, art: 'erhaltung'|'herstellung', vert: 'auto'|'1'..'5' }]
   Beträge wie #san: so, wie #san_ust sie ausweist (Vorgabe brutto) - Kosten
   für den Cashflow und die Werbungskosten; netto nur für die 15-%-Prüfung.
   Ein Objekt ohne Liste rechnet bitgleich wie vorher (tools/sanierung-pruefen.mjs).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var FELD = 'san_plan';
  var BEZ = ['Küche', 'Bad', 'Dach', 'Fenster', 'Heizung', 'Fassade', 'Elektrik', 'Bodenbeläge', 'Malerarbeiten'];
  var _gerendert = null;

  function el(id) { return document.getElementById(id); }
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var n = (typeof window.parseDe === 'function') ? window.parseDe(String(v)) : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function eur(n) { return Math.round(n || 0).toLocaleString('de-DE') + ' €'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function datum(s) {
    s = String(s || '').trim(); var m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) return new Date(+m[3], +m[2] - 1, +m[1]);
    return null;
  }

  /* ── Der reine Kern: liest nichts aus dem DOM, alles kommt als Parameter ── */

  /** Gültige Einträge (Jahr und Betrag > 0); unbekannte Art = nicht steuerlich angesetzt */
  function gueltig(l) {
    return (Array.isArray(l) ? l : []).filter(function (e) { return e && typeof e === 'object' && zahl(e.jahr) > 0 && zahl(e.betrag) > 0; });
  }

  /** Cashflow: { Kalenderjahr: Summe } */
  function jeJahrAus(l) {
    var aus = {};
    gueltig(l).forEach(function (e) { var j = zahl(e.jahr); aus[j] = (aus[j] || 0) + zahl(e.betrag); });
    return aus;
  }

  /**
   * Steuer je Kalenderjahr.
   * ctx: { A: Anschaffungsjahr|null, grenze: 15-%-Grenze netto, sanNetto: #san netto,
   *        ust: 'brutto'|'netto', afaSatz: Gebäude-AfA in % (linear; degressiv → 3) }
   * Rückgabe: { jahre: { J: { erh, anah, afa } }, fensterNetto, summeNetto, ueber, behandlung: [...] }
   */
  function steuerAus(l, ctx) {
    ctx = ctx || {};
    var A = zahl(ctx.A), grenze = zahl(ctx.grenze) || 0, satz = zahl(ctx.afaSatz) > 0 ? zahl(ctx.afaSatz) : 2;
    var netto = function (b) { return ctx.ust === 'netto' ? b : b / 1.19; };
    var imFenster = function (e) { var J = zahl(e.jahr); return !!(A && e.art === 'erhaltung' && J >= A && J <= A + 3); };
    var L = gueltig(l);
    var fenster = 0;
    L.forEach(function (e) { if (imFenster(e)) fenster += netto(zahl(e.betrag)); });
    var summe = (zahl(ctx.sanNetto) || 0) + fenster;
    var ueber = grenze > 0 && fenster > 0 && summe > grenze;
    var jahre = {};
    var add = function (J, k, b) { if (!(b > 0)) return; jahre[J] = jahre[J] || { erh: 0, anah: 0, afa: 0 }; jahre[J][k] += b; };
    /* Abschreibung mit dem Gebäudesatz: volle Jahre, das letzte nimmt den Rest (wie tax.js v3006b) */
    var abschreiben = function (J, b, k) {
      var jb = b * satz / 100, rest = b, i = 0;
      while (rest > 0.005 && i < 200) { var x = Math.min(jb, rest); add(J + i, k, x); rest -= x; i++; }
      return Math.ceil(100 / satz - 1e-9);
    };
    var behandlung = (Array.isArray(l) ? l : []).map(function (e) {
      if (!e || !(zahl(e.jahr) > 0) || !(zahl(e.betrag) > 0)) return { art: 'leer' };
      var J = zahl(e.jahr), b = zahl(e.betrag);
      if (e.art === 'herstellung') return { art: 'herstellung', jahre: abschreiben(J, b, 'afa'), jaehrlich: b * satz / 100, ab: J };
      if (e.art !== 'erhaltung') return { art: 'offen' };
      var vert = String(e.vert || 'auto');
      if (vert === 'auto' && ueber && imFenster(e)) return { art: 'anschaffungsnah', jahre: abschreiben(J, b, 'anah'), jaehrlich: b * satz / 100, ab: J };
      var n = vert === 'auto' ? 1 : Math.max(1, Math.min(5, parseInt(vert, 10) || 1));
      for (var i = 0; i < n; i++) add(J + i, 'erh', b / n);
      return { art: 'erhaltung', jahre: n, jaehrlich: b / n, ab: J, fenster: imFenster(e), warnung: ueber && imFenster(e) && vert !== 'auto' };
    });
    return { jahre: jahre, fensterNetto: fenster, summeNetto: summe, grenze: grenze, ueber: ueber, A: A, behandlung: behandlung };
  }

  /* ── Anbindung an das Formular ─────────────────────────────────────────── */

  function liste() {
    var f = el(FELD); if (!f || !f.value) return [];
    try { var l = JSON.parse(f.value); return Array.isArray(l) ? l.filter(function (x) { return x && typeof x === 'object'; }) : []; } catch (e) { return []; }
  }
  function speichern(l, neuZeichnen) {
    var f = el(FELD); if (!f) return;
    f.value = l.length ? JSON.stringify(l) : '';
    if (!neuZeichnen) _gerendert = f.value;
    try { f.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}   /* storage.js: als geändert markieren */
    if (typeof window.calc === 'function') { try { window.calc(); } catch (e) {} }
    else render();
  }
  /* Anschaffung = wirtschaftlicher Übergang, sonst Kaufdatum (wie sonderumlage.js) */
  function anschaffungsjahr() {
    var d = datum((el('wirtschaftlicher_uebergang') || {}).value) || datum((el('kaufdat') || {}).value);
    if (d) return d.getFullYear();
    try { if (window.DealPilotAnteilig && DealPilotAnteilig.getBaseYear) { var y = DealPilotAnteilig.getBaseYear(); if (y) return y; } } catch (e) {}
    return null;
  }
  /* Die Werte, die tax.js ohnehin rechnet, kommen als Parameter; fehlt einer, liest der Rückfall das Formular */
  function ctxAusFormular(p) {
    p = p || {};
    var S = window.State || {};
    var ust = p.ust || (el('san_ust') || {}).value || 'brutto';
    var sanNetto = p.sanNetto;
    if (sanNetto == null) { var s = zahl((el('san') || {}).value) || 0; sanNetto = ust === 'netto' ? s : s / 1.19; }
    var grenze = p.grenze;
    if (grenze == null) grenze = (S._ahk && S._ahk.sanLimit > 0) ? S._ahk.sanLimit : ((S.san15 && S.san15.limit) || 0);
    var satz = p.afaSatz;
    if (satz == null) {
      var sel = (el('afa_satz') || {}).value || '2.0';
      var pa = (window.Afa && Afa.parseSelectValue) ? Afa.parseSelectValue(sel) : { methode: 'linear', satzPct: zahl(sel) || 2 };
      satz = (pa.methode === 'linear' && pa.satzPct > 0) ? pa.satzPct : 3.0;
    }
    return { A: p.A != null ? p.A : anschaffungsjahr(), grenze: grenze, sanNetto: sanNetto, ust: ust, afaSatz: satz };
  }

  var LEER = { erh: 0, anah: 0, afa: 0 };
  /** Für tax.js: Steueranteile dieses Kalenderjahres; ohne Liste immer 0 */
  function steuerJahr(jahr, p) {
    var l = liste(); if (!l.length) return { erh: 0, anah: 0, afa: 0, fensterNetto: 0 };
    var r = steuerAus(l, ctxAusFormular(p)), j = r.jahre[jahr] || LEER;
    return { erh: j.erh, anah: j.anah, afa: j.afa, fensterNetto: r.fensterNetto };
  }
  /** Netto-Erhaltung im 3-Jahres-Fenster - für die Entscheidung über #san in tax.js */
  function fensterNetto(p) { var l = liste(); return l.length ? steuerAus(l, ctxAusFormular(p)).fensterNetto : 0; }
  function jeJahr() { return jeJahrAus(liste()); }

  /* ── Liste im Reiter Investition ───────────────────────────────────────── */
  function zeileText(e, b, r) {
    var J = zahl(e.jahr), betrag = zahl(e.betrag);
    if (!J || !(betrag > 0)) return 'Jahr und Betrag eintragen.';
    var t = 'Cashflow: −' + eur(betrag) + ' einmalig im Jahr ' + J + ' (nicht in der Gesamtinvestition). Steuer: ';
    if (b.art === 'herstellung') return t + 'Herstellungskosten - AfA ab ' + J + ' rund ' + eur(b.jaehrlich) + ' im Jahr über ' + b.jahre + ' Jahre.';
    if (b.art === 'anschaffungsnah') return t + '<span style="color:#B8625C;font-weight:600">anschaffungsnahe Herstellungskosten</span> (15-%-Grenze überschritten) - AfA ab ' + J + ' rund ' + eur(b.jaehrlich) + ' im Jahr über ' + b.jahre + ' Jahre.';
    if (b.art === 'erhaltung') {
      t += b.jahre > 1 ? 'Erhaltungsaufwand verteilt auf ' + b.jahre + ' Jahre (' + J + '–' + (J + b.jahre - 1) + '), je ' + eur(b.jaehrlich) + '.' : 'Erhaltungsaufwand, sofort absetzbar ' + J + '.';
      if (b.warnung) t += ' <span style="color:#B8625C;font-weight:600">Achtung:</span> im 3-Jahres-Fenster ist die 15-%-Grenze überschritten - steuerlich wären es anschaffungsnahe Herstellungskosten (Verteilung „automatisch“ rechnet das).';
      return t;
    }
    return t + 'wähle die Art - ohne Art geht der Betrag nur in den Cashflow.';
  }

  function render() {
    var host = el('san-plan-box'); if (!host) return;
    var f = el(FELD), stand = f ? f.value : '';
    var l = liste(), r = steuerAus(l, ctxAusFormular());
    if (stand !== _gerendert || !host.querySelector('[data-sp-neu]')) {
      _gerendert = stand;
      var opt = function (w, t, a) { return '<option value="' + w + '"' + (a === w ? ' selected' : '') + '>' + t + '</option>'; };
      var h = l.map(function (e, i) {
        var id = 'sp-' + i + '-', vert = String(e.vert || 'auto');
        return '<div class="sp-eintrag" data-i="' + i + '" style="border-top:1px solid var(--line,rgba(42,39,39,.12));padding:8px 0">'
          + '<div class="g2">'
          + '<div class="f"><label for="' + id + 'bez">Bezeichnung</label><input id="' + id + 'bez" data-sp="bez" type="text" list="sp-bez-liste" placeholder="z. B. Küche, Dach, Bad" value="' + esc(e.bez) + '"></div>'
          + '<div class="f"><label for="' + id + 'jahr">Jahr</label><input id="' + id + 'jahr" data-sp="jahr" data-zf-aus="1" type="text" inputmode="numeric" value="' + esc(e.jahr || '') + '"></div>'
          + '<div class="f"><label for="' + id + 'betrag">Betrag</label><div class="iw"><span class="pfx">€</span><input id="' + id + 'betrag" data-sp="betrag" type="text" inputmode="decimal" class="trl" value="' + esc(e.betrag != null ? Math.round(e.betrag) : '') + '"></div></div>'
          + '<div class="f"><label for="' + id + 'art">Art</label><select id="' + id + 'art" data-sp="art">' + opt('', '– bitte wählen –', e.art || '') + opt('erhaltung', 'Erhaltung (Werbungskosten)', e.art) + opt('herstellung', 'Herstellung (über die AfA)', e.art) + '</select></div>'
          + (e.art === 'erhaltung' ? '<div class="f"><label for="' + id + 'vert">Als Werbungskosten verteilt über</label><select id="' + id + 'vert" data-sp="vert">'
              + opt('auto', 'Automatisch (sofort; 15-%-Regel in den ersten 3 Jahren)', vert) + opt('1', '1 Jahr (sofort)', vert) + opt('2', '2 Jahre', vert) + opt('3', '3 Jahre', vert) + opt('4', '4 Jahre', vert) + opt('5', '5 Jahre (§ 82b EStDV)', vert) + '</select></div>' : '')
          + '</div>'
          + '<div class="hint sp-st" style="display:block;margin-top:2px"></div>'
          + '<button type="button" class="btn btn-sm sp-btn" data-sp-weg="' + i + '" style="margin-top:4px">Entfernen</button>'
          + '</div>';
      }).join('');
      host.innerHTML = '<datalist id="sp-bez-liste">' + BEZ.map(function (b) { return '<option value="' + b + '">'; }).join('') + '</datalist>'
        + h + '<div class="hint sp-summe" style="display:block;margin-top:6px"></div>'
        + '<button type="button" class="btn btn-sm sp-btn" data-sp-neu="1" style="margin-top:8px">+ Weitere Sanierung hinzufügen</button>';
    }
    [].forEach.call(host.querySelectorAll('.sp-eintrag'), function (box) {
      var i = +box.getAttribute('data-i'), e = l[i], s = box.querySelector('.sp-st');
      if (e && s) s.innerHTML = zeileText(e, r.behandlung[i] || {}, r);
    });
    var sum = host.querySelector('.sp-summe');
    if (sum) {
      var t = '';
      if (r.fensterNetto > 0 && r.grenze > 0) {
        t += (r.ueber ? '<span style="color:#B8625C;font-weight:600">15-%-Grenze überschritten:</span> ' : '15-%-Grenze: ')
          + 'Sanierung ' + eur(r.summeNetto - r.fensterNetto) + ' + Erhaltung in den drei Jahren nach Kauf ' + eur(r.fensterNetto) + ' = ' + eur(r.summeNetto)
          + ' netto von ' + eur(r.grenze) + ' (§ 6 Abs. 1 Nr. 1a EStG; im Grenzjahr ' + (r.A + 3) + ' zählt der Tag).'
          + (r.ueber ? ' Bei „automatisch“ laufen dann die Sanierungskosten oben und diese Einträge über die AfA. Mit dem Steuerberater abstimmen.' : '');
      }
      /* Abgrenzung Zielbild: dieselbe Arbeit nicht zweimal */
      var zb = 0; try { if (window.DpPotenzial && DpPotenzial.herkunft) zb = (DpPotenzial.herkunft() || {}).summe || 0; } catch (e) {}
      var plan = l.reduce(function (a, e) { return a + (zahl(e.betrag) > 0 ? zahl(e.betrag) : 0); }, 0);
      if (zb > 0 && plan > 0) t += (t ? '<br>' : '') + 'Zielbild-Maßnahmen ' + eur(zb) + ' · geplante Sanierungen ' + eur(plan) + ' — zwei getrennte Angaben: das Zielbild zieht seine Maßnahmen nur vom Wertzuwachs ab, diese Liste geht in Cashflow und Steuer. Ist es dieselbe Arbeit, steht sie doppelt — dann eine der beiden Angaben leeren.';
      sum.innerHTML = t;
    }
  }

  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute || !t.getAttribute('data-sp')) return;
    var box = t.closest('.sp-eintrag'); if (!box) return;
    var l = liste(), e = l[+box.getAttribute('data-i')]; if (!e) return;
    var k = t.getAttribute('data-sp'), v = String(t.value || '').trim();
    if (k === 'betrag' || k === 'jahr') e[k] = zahl(v);
    else e[k] = v;
    speichern(l, k === 'art');   /* die Art blendet „verteilt über“ ein oder aus → neu zeichnen */
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute || t.tagName !== 'SELECT' || !t.getAttribute('data-sp')) return;
    var box = t.closest('.sp-eintrag'); if (!box) return;
    var l = liste(), e = l[+box.getAttribute('data-i')]; if (!e) return;
    var k = t.getAttribute('data-sp');
    if (e[k] === t.value) return;   /* schon über input gekommen */
    e[k] = t.value; speichern(l, k === 'art');
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('.sp-btn') : null; if (!t) return;
    var l = liste();
    if (t.hasAttribute('data-sp-neu')) {
      var A = anschaffungsjahr() || new Date().getFullYear();
      l.push({ bez: '', jahr: A + 1, betrag: null, art: 'erhaltung', vert: 'auto' });
      speichern(l, true); return;
    }
    if (t.hasAttribute('data-sp-weg')) { var i = +t.getAttribute('data-sp-weg'); if (l[i]) { l.splice(i, 1); speichern(l, true); } }
  });

  /** Für die PDFs unter der Jahrestabelle: welche Einmalzahlungen in „Bewirtschaftung“ und CF stecken.
      Nur ASCII-Bindestriche (jsPDF helvetica). Leer, wenn es keine gibt. */
  function einmaligText(rows) {
    var t = [], l = gueltig(liste());
    (rows || []).forEach(function (r) {
      var J = r.cal || r.y;
      if (r.san_y > 0) {
        var n = l.filter(function (e) { return zahl(e.jahr) === J; }).map(function (e) { return e.bez || 'Sanierung'; });
        t.push(J + ' geplante Sanierung ' + (n.length ? '(' + n.join(', ') + ') ' : '') + eur(r.san_y));
      }
      if (r.su_y > 0) t.push(J + ' Sonderumlage ' + eur(r.su_y));
    });
    return t.length ? ' Einmalig in Bewirtschaftung und CF enthalten: ' + t.join('; ') + '.' : '';
  }

  window.DpSanierungPlan = { liste: liste, jeJahr: jeJahr, steuerJahr: steuerJahr, fensterNetto: fensterNetto, render: render, einmaligText: einmaligText,
    kern: { jeJahrAus: jeJahrAus, steuerAus: steuerAus } };   /* kern: für tools/sanierung-pruefen.mjs */
})();
