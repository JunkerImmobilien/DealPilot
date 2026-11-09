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
    /* v3223 · Marcel 08.11.2026 „genau auf den Monat“: das 3-Jahres-Fenster des § 6 Abs. 1 Nr. 1a EStG
       laeuft vom Monat des Uebergangs (Am) bis drei Jahre spaeter. Uebergang am 1. eines Monats -> der
       Vormonat ist der letzte, sonst zaehlt der Uebergangsmonat des Grenzjahres noch mit (dort endet die
       Frist am Tag). Ohne Monat des Eintrags im Grenzjahr: zaehlt mit (vorsichtig) und meldet „Monat fehlt“.
       Ohne Uebergangsmonat: wie bisher Kalenderjahre A bis A+3. */
    var Am = zahl(ctx.Am), Ad = zahl(ctx.Ad);
    var monatOk = function (m) { m = zahl(m); return m >= 1 && m <= 12 ? m : null; };
    var start = (A && Am) ? A * 12 + (Am - 1) : null;
    var ende = start != null ? start + 36 - (Ad === 1 ? 1 : 0) : null;
    var grenzfall = function (e) {
      var J = zahl(e.jahr); if (start == null || monatOk(e.monat)) return false;
      return J * 12 + 11 >= start && J * 12 <= ende && (J * 12 < start || J * 12 + 11 > ende);
    };
    var imFenster = function (e) {
      var J = zahl(e.jahr); if (!A || e.art !== 'erhaltung') return false;
      if (start == null) return J >= A && J <= A + 3;
      var m = monatOk(e.monat);
      if (!m) return J * 12 + 11 >= start && J * 12 <= ende;   /* Jahr beruehrt das Fenster */
      var t = J * 12 + (m - 1);
      return t >= start && t <= ende;
    };
    var netto = function (b) { return ctx.ust === 'netto' ? b : b / 1.19; };
    var L = gueltig(l);
    var fenster = 0;
    L.forEach(function (e) { if (imFenster(e)) fenster += netto(zahl(e.betrag)); });
    var summe = (zahl(ctx.sanNetto) || 0) + fenster;
    var ueber = grenze > 0 && fenster > 0 && summe > grenze;
    var jahre = {};
    var add = function (J, k, b) { if (!(b > 0)) return; jahre[J] = jahre[J] || { erh: 0, anah: 0, afa: 0 }; jahre[J][k] += b; };
    /* Abschreibung mit dem Gebaeudesatz, das letzte Jahr nimmt den Rest (wie tax.js v3006b).
       v3223 · Marcel 08.11.2026 „so, dass es richtig ist“: nachtraegliche und anschaffungsnahe
       Herstellungskosten werden im Jahr ihres Anfalls so behandelt, als waeren sie zu Beginn des
       Jahres aufgewendet (R 7.4 Abs. 9 Satz 3 EStR) -> volles Jahr. Ausnahme Anschaffungsjahr: dort
       laeuft die Gebaeude-AfA selbst erst ab dem Monat des Uebergangs (§ 7 Abs. 1 Satz 4 EStG), die
       Kosten erhoehen deren Bemessung -> anteilig (13 - Am) / 12. */
    var abschreiben = function (J, b, k) {
      var jb = b * satz / 100, rest = b, i = 0;
      while (rest > 0.005 && i < 200) {
        var x = Math.min(i === 0 && A && Am && J === A ? jb * (13 - Am) / 12 : jb, rest);
        add(J + i, k, x); rest -= x; i++;
      }
      return i;
    };
    var behandlung = (Array.isArray(l) ? l : []).map(function (e) {
      if (!e || !(zahl(e.jahr) > 0) || !(zahl(e.betrag) > 0)) return { art: 'leer' };
      var J = zahl(e.jahr), b = zahl(e.betrag);
      if (e.art === 'herstellung') return { art: 'herstellung', jahre: abschreiben(J, b, 'afa'), jaehrlich: b * satz / 100, ab: J, anteilig: !!(A && Am && J === A && Am > 1) };
      if (e.art !== 'erhaltung') return { art: 'offen' };
      var vert = String(e.vert || 'auto');
      if (vert === 'auto' && ueber && imFenster(e)) return { art: 'anschaffungsnah', jahre: abschreiben(J, b, 'anah'), jaehrlich: b * satz / 100, ab: J, anteilig: !!(A && Am && J === A && Am > 1), monatFehlt: grenzfall(e) };
      var n = vert === 'auto' ? 1 : Math.max(1, Math.min(5, parseInt(vert, 10) || 1));
      /* v3268 · § 82b EStDV nur ausserhalb eines Betriebsvermoegens: GmbH/UG -> sofort */
      var ohne82b = !!ctx.ohne82b && n > 1;
      if (ctx.ohne82b) n = 1;
      for (var i = 0; i < n; i++) add(J + i, 'erh', b / n);
      return { art: 'erhaltung', jahre: n, jaehrlich: b / n, ab: J, fenster: imFenster(e), warnung: ueber && imFenster(e) && vert !== 'auto', monatFehlt: grenzfall(e), ohne82b: ohne82b };
    });
    return { jahre: jahre, fensterNetto: fenster, summeNetto: summe, grenze: grenze, ueber: ueber, A: A, Am: Am || null,
      fensterEnde: ende != null ? { jahr: Math.floor(ende / 12), monat: ende % 12 + 1 } : null, behandlung: behandlung };
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
  function anschaffung() { return datum((el('wirtschaftlicher_uebergang') || {}).value) || datum((el('kaufdat') || {}).value); }
  function anschaffungsjahr() {
    var d = anschaffung();
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
    var d = p.A != null ? null : anschaffung();   /* v3223: Monat und Tag des Uebergangs fuer Fenster und AfA */
    return { A: p.A != null ? p.A : anschaffungsjahr(), Am: p.Am != null ? p.Am : (d ? d.getMonth() + 1 : null), Ad: p.Ad != null ? p.Ad : (d ? d.getDate() : null),
      grenze: grenze, sanNetto: sanNetto, ust: ust, afaSatz: satz,
      /* v3268: Halter GmbH/UG -> keine Verteilung nach § 82b EStDV */
      ohne82b: p.ohne82b != null ? !!p.ohne82b : (function () { try { return !!(window.DealPilotMandanten && DealPilotMandanten.istKoerperschaft && DealPilotMandanten.istKoerperschaft((el('halter') || {}).value || 'privat')); } catch (e) { return false; } })() };
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
    var mf = b.monatFehlt ? ' <span style="color:#B8625C;font-weight:600">Monat eintragen:</span> ' + J + ' ist das Grenzjahr der 3-Jahres-Frist, ohne Monat zählt der Betrag vorsichtshalber mit.' : '';
    var ant = b.anteilig ? ' Im Kaufjahr anteilig ab dem Monat des Übergangs, danach volle Jahre.' : ' Im Jahr der Maßnahme volles Jahr (R 7.4 Abs. 9 EStR).';
    if (b.art === 'herstellung') return t + 'Herstellungskosten, AfA ab ' + J + ' rund ' + eur(b.jaehrlich) + ' im Jahr über ' + b.jahre + ' Jahre.' + ant;
    if (b.art === 'anschaffungsnah') return t + '<span style="color:#B8625C;font-weight:600">anschaffungsnahe Herstellungskosten</span> (15-%-Grenze überschritten), AfA ab ' + J + ' rund ' + eur(b.jaehrlich) + ' im Jahr über ' + b.jahre + ' Jahre.' + ant + mf;
    if (b.art === 'erhaltung') {
      if (b.ohne82b) t += 'Betriebsausgabe sofort ' + J + ' - eine Verteilung nach § 82b EStDV gibt es nur im Privatvermögen, nicht in der GmbH/UG. ';
      else t += b.jahre > 1 ? 'Erhaltungsaufwand verteilt auf ' + b.jahre + ' Jahre (' + J + '–' + (J + b.jahre - 1) + '), je ' + eur(b.jaehrlich) + '.' : 'Erhaltungsaufwand, sofort absetzbar ' + J + '.';
      if (b.warnung) t += ' <span style="color:#B8625C;font-weight:600">Achtung:</span> im 3-Jahres-Fenster ist die 15-%-Grenze überschritten - steuerlich wären es anschaffungsnahe Herstellungskosten (Verteilung „automatisch“ rechnet das).';
      return t + mf;
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
          + '<div class="f"><label for="' + id + 'monat">Monat <span class="dp-tip" data-tip="Nur nötig im Grenzjahr der 3-Jahres-Frist (15-%-Regel): dort entscheidet der Monat, ob die Erhaltung mitzählt.">ⓘ</span></label><select id="' + id + 'monat" data-sp="monat">' + opt('', '–', String(e.monat || '')) + ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'].map(function (n, k) { return opt(String(k + 1), n, String(e.monat || '')); }).join('') + '</select></div>'
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
          + ' netto von ' + eur(r.grenze) + ' (§ 6 Abs. 1 Nr. 1a EStG' + (r.fensterEnde ? ', Frist bis einschließlich ' + ('0' + r.fensterEnde.monat).slice(-2) + '/' + r.fensterEnde.jahr : '') + ').'
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
    if (k === 'betrag' || k === 'jahr' || k === 'monat') e[k] = zahl(v);
    else e[k] = v;
    speichern(l, k === 'art');   /* die Art blendet „verteilt über“ ein oder aus → neu zeichnen */
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute || t.tagName !== 'SELECT' || !t.getAttribute('data-sp')) return;
    var box = t.closest('.sp-eintrag'); if (!box) return;
    var l = liste(), e = l[+box.getAttribute('data-i')]; if (!e) return;
    var k = t.getAttribute('data-sp');
    if (String(e[k] == null ? '' : e[k]) === t.value) return;   /* schon über input gekommen */
    e[k] = k === 'monat' ? zahl(t.value) : t.value; speichern(l, k === 'art');
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
