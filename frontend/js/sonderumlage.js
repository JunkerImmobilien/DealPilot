/* ═══════════════════════════════════════════════════════════════════════════
   v3092 · N100 · SONDERUMLAGEN DER WEG IN CASHFLOW UND STEUER
   Marcel 02.11.2026: „so wie dein Vorschlag".

   CASHFLOW (automatisch): eine Sonderumlage ist eine einmalige Ausgabe im Jahr
   ihrer FÄLLIGKEIT. Der Erwerber schuldet, was nach dem Eigentumswechsel fällig
   wird, auch wenn es vorher beschlossen wurde (BGH V ZR 257/16, § 28 Abs. 3 WEG).
   Liegt der Fälligkeitstag vor dem wirtschaftlichen Übergang, trägt sie der
   Verkäufer - dann steht sie nicht im Cashflow. calc.js liest jeJahr().

   STEUER (nur Vorschlag): Werbungskosten erst, wenn die Gemeinschaft das Geld
   für Erhaltung AUSGIBT (BFH 14.01.2025, IX R 19/24, zur Erhaltungsrücklage;
   zur Sonderumlage gibt es kein eigenes Urteil, die Begründung trägt). Darum
   zwei Felder: „Jahr der Verwendung" (vorbelegt mit dem Fälligkeitsjahr - die
   sofortige Maßnahme) und „Art" (Erhaltung / Herstellung). Übernommen wird nur
   auf Klick, in das Feld „erhaltungsaufwand" des Steuer-Reiters (tax.js
   dpSteuerWert/dpSteuerSetzen). In den drei Jahren nach der Anschaffung zählt
   Erhaltungsaufwand zur 15-%-Grenze (§ 6 Abs. 1 Nr. 1a EStG) - zusammen mit der
   Sanierung aus dem Kaufpreis (calc.js State.san15), netto.

   Die Beträge sind der ANTEIL dieses Objekts. Woher er kommt (Betrag der
   Wohnung oder Gemeinschaft × MEA), rechnet dokument-import.js
   sonderumlagenAus() - hier wird nur gespeichert, gezeigt und verteilt.
   Gespeichert im versteckten Feld #weg_su (JSON, storage.js FIELDS + Reset).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var FELD = 'weg_su';
  var _gerendert = null;   /* zuletzt gezeichneter Stand - Eingaben in der Liste zeichnen nicht neu (Fokus) */

  function el(id) { return document.getElementById(id); }
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var n = (typeof window.parseDe === 'function') ? window.parseDe(String(v)) : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }
  function eur(n) { return Math.round(n || 0).toLocaleString('de-DE') + ' €'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* „01.03.2026" oder „2026-03-01" → Date, sonst null */
  function datum(s) {
    s = String(s || '').trim(); var m;
    if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/))) return new Date(+m[3], +m[2] - 1, +m[1]);
    return null;
  }
  function datumText(d) { return d ? ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear() : ''; }

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

  /* Anschaffung = wirtschaftlicher Übergang, sonst Kaufdatum */
  function uebergang() { return datum((el('wirtschaftlicher_uebergang') || {}).value) || datum((el('kaufdat') || {}).value); }
  function anschaffungsjahr() {
    var d = uebergang(); if (d) return d.getFullYear();
    try { if (window.DealPilotAnteilig && DealPilotAnteilig.getBaseYear) { var y = DealPilotAnteilig.getBaseYear(); if (y) return y; } } catch (e) {}
    return null;
  }
  /* Trägt der Käufer diese Umlage? Fällig vor dem Übergang → Verkäufer. */
  function vorUebergang(e) {
    var u = uebergang(); if (!u) return false;
    var f = datum(e.faellig);
    if (f) return f < u;
    return zahl(e.jahr) != null && zahl(e.jahr) < u.getFullYear();
  }
  function verwJahr(e) { return zahl(e.verw_jahr) || zahl(e.jahr); }

  /* v3213 · W-19 (Entwicklungspartner): Regler „Gesamtbetrag der Gemeinschaft × MEA"
     gegen „Anteil der Wohnung direkt". Gespeichert wird weiter der ANTEIL (betrag) -
     jeJahr() und calc.js lesen nur ihn. Dazu optional modus ('gesamt') und gesamt (€ der
     Gemeinschaft). Der MEA kommt aus dem Feld mea (Reiter Objekt, in Prozent); ändert er
     sich, rechnen die Einträge im Modus „gesamt" ihren Anteil neu. */
  function meaPct() { var m = zahl((el('mea') || {}).value); return m > 0 && m <= 100 ? m : null; }
  function meaText(m) { return String(Math.round(m * 100) / 100).replace('.', ','); }
  function ausGesamt(e) {
    var g = zahl(e.gesamt), m = meaPct();
    if (!(g > 0) || !m) return false;
    e.betrag = Math.round(g * m / 100);
    e.wie = Math.round(g).toLocaleString('de-DE') + ' € der Gemeinschaft × Miteigentumsanteil ' + meaText(m) + ' %';
    return true;
  }
  function tip(id) { return ' <button type="button" class="dp-tip" data-tip-id="' + id + '" tabindex="-1" aria-label="Erklärung"></button>'; }

  /** Für calc.js: { Kalenderjahr: Betrag } aller Umlagen, die der Käufer zahlt */
  function jeJahr() {
    var aus = {};
    liste().forEach(function (e) {
      var j = zahl(e.jahr), b = zahl(e.betrag);
      if (!j || !(b > 0) || vorUebergang(e)) return;
      aus[j] = (aus[j] || 0) + b;
    });
    return aus;
  }

  /** Aus dem Import (object-actions.js): Eintrag anhängen, gleicher Jahr+Betrag nur einmal */
  function uebernehmen(s) {
    if (!s || !(zahl(s.betrag) > 0) || !zahl(s.jahr)) return false;
    var l = liste();
    /* v3211 · Raten: zwei gleich hohe Raten im selben Jahr mit verschiedenem Fälligkeitstag sind keine
       Dublette. Gleich ist, was Jahr + Betrag teilt und keinen ABWEICHENDEN Tag trägt. */
    var tagS = datum(s.faellig);
    var gleich = l.filter(function (x) {
      if (zahl(x.jahr) !== zahl(s.jahr) || Math.abs((zahl(x.betrag) || 0) - zahl(s.betrag)) > 1) return false;
      var tagX = datum(x.faellig);
      return !(tagS && tagX && tagS.getTime() !== tagX.getTime());
    })[0];
    if (gleich) { if (!gleich.faellig && s.faellig) { gleich.faellig = s.faellig; speichern(l, true); } return true; }
    var neu = { zweck: s.zweck || 'Sonderumlage', jahr: zahl(s.jahr), faellig: s.faellig || '', betrag: Math.round(zahl(s.betrag)),
      wie: s.wie || '', quelle: s.quelle || '', verw_jahr: zahl(s.jahr), art: '' };
    /* v3213 · W-19: kam der Anteil aus Gemeinschaft × MEA, steht der Regler auf „gesamt" */
    if (zahl(s.gesamt) > 0 && /Miteigentumsanteil/.test(s.wie || '')) { neu.modus = 'gesamt'; neu.gesamt = zahl(s.gesamt); }
    l.push(neu);
    speichern(l, true);
    return true;
  }

  /* 15-%-Grenze: Sanierung aus dem Kaufpreis + Erhaltungs-Umlagen, die in den drei Jahren nach der
     Anschaffung verwendet werden, netto (÷ 1,19 - die Gemeinschaft bezahlt Rechnungen mit Umsatzsteuer). */
  function grenze15(l) {
    var A = anschaffungsjahr(), g = window.State && window.State.san15;
    if (!A || !g || !(g.limit > 0)) return null;
    var su = 0;
    l.forEach(function (e) {
      var J = verwJahr(e);
      if (e.art !== 'erhaltung' || !J || vorUebergang(e) || J > A + 3 || J < A) return;
      su += (zahl(e.betrag) || 0) / 1.19;
    });
    return { A: A, limit: g.limit, san: g.istNetto || 0, su: su, summe: (g.istNetto || 0) + su, ueber: (g.istNetto || 0) + su > g.limit };
  }
  function imFenster(e, gr) { var J = verwJahr(e); return gr && J && J >= gr.A && J <= gr.A + 3; }

  function steuerZeile(e, i, gr) {
    var J = verwJahr(e), b = zahl(e.betrag) || 0;
    if (vorUebergang(e)) return '<span>Steuer: keine - die Umlage trägt der Verkäufer.</span>';
    var st = e.st, aktuell = st && st.jahr === J && st.betrag === b && e.art === 'erhaltung';
    if (e.art === 'herstellung') {
      return '<span>Herstellungskosten am Gemeinschaftseigentum: kein Sofortabzug, sie erhöhen anteilig die AfA-Bemessungsgrundlage - mit dem Steuerberater abstimmen.</span>'
        + (st ? ' <button type="button" class="btn btn-sm wsu-btn" data-wsu-zurueck="' + i + '">Übernahme ' + st.jahr + ' zurücknehmen</button>' : '');
    }
    if (e.art !== 'erhaltung') return '<span>Steuer: wähle die Art - Erhaltung ist im Jahr der Verwendung absetzbar, Herstellung nur über die AfA.</span>';
    var t = '', sperre = false;
    if (imFenster(e, gr)) {
      var grenzjahr = J === gr.A + 3 ? ' (im Grenzjahr ' + J + ' zählt der Tag: drei Jahre ab Übergang)' : '';
      if (gr.ueber) {
        sperre = true;
        t += '<span class="wsu-warn" style="color:#B8625C;font-weight:600">15-%-Grenze überschritten:</span> <span>Sanierung ' + eur(gr.san) + ' + Sonderumlagen ' + eur(gr.su) + ' = ' + eur(gr.summe) + ' netto, Grenze ' + eur(gr.limit) + ' (15 % der Gebäude-Anschaffungskosten, § 6 Abs. 1 Nr. 1a EStG)' + grenzjahr + '. Dann sind es anschaffungsnahe Herstellungskosten - nicht sofort absetzbar, sondern über die AfA. Mit dem Steuerberater abstimmen.</span>';
      } else {
        t += '<span>In den drei Jahren nach Kauf: zusammen mit der Sanierung ' + eur(gr.summe) + ' netto von ' + eur(gr.limit) + ' (15-%-Grenze)' + grenzjahr + ' - darunter.</span> ';
      }
    }
    if (aktuell) t += ' <span style="color:#3FA56C">✓ im Steuer-Reiter ' + J + ' als Erhaltungsaufwand übernommen (+' + eur(b) + ').</span> <button type="button" class="btn btn-sm wsu-btn" data-wsu-zurueck="' + i + '">zurücknehmen</button>';
    else if (!sperre) t += ' <button type="button" class="btn btn-sm wsu-btn" data-wsu-steuer="' + i + '">' + (st ? 'Steuer-Vorschlag aktualisieren (' + J + ')' : 'Als Erhaltungsaufwand ' + J + ' in den Steuer-Reiter') + '</button>';
    else if (st) t += ' <button type="button" class="btn btn-sm wsu-btn" data-wsu-zurueck="' + i + '">Übernahme ' + st.jahr + ' zurücknehmen</button>';
    return t;
  }
  function cfZeile(e) {
    var j = zahl(e.jahr), b = zahl(e.betrag);
    if (!j || !(b > 0)) return 'Cashflow: Jahr und Betrag eintragen.';
    if (vorUebergang(e)) { var u = uebergang(); return 'Fällig vor dem Übergang (' + datumText(u) + '): schuldet der Verkäufer - nicht im Cashflow.'; }
    return 'Cashflow: −' + eur(b) + ' einmalig im Jahr ' + j + (e.faellig ? ' (fällig ' + esc(datumText(datum(e.faellig)) || e.faellig) + ')' : '')   /* v3092b · Import liefert ISO, angezeigt wird TT.MM.JJJJ */ + '.';
  }

  function render() {
    var host = el('weg-su-box'); if (!host) return;
    var f = el(FELD), stand = f ? f.value : '';
    var l = liste(), gr = grenze15(l);
    if (stand !== _gerendert) {
      _gerendert = stand;
      var m = meaPct();
      var h = l.map(function (e, i) {
        var id = 'wsu-' + i + '-';
        var ges = e.modus === 'gesamt';
        /* v3213 · W-19: Regler und - im Modus „gesamt" - Gesamtbetrag plus errechneter Anteil */
        var regler = '<div class="f wsu-modus-zeile" style="grid-column:1/-1;margin-bottom:2px"><label class="toggle-slim wsu-modus" style="cursor:pointer;gap:8px">'
          + '<span class="wsu-modus-a"' + (ges ? '' : ' style="color:var(--text,#2A2727);font-weight:600"') + '>Anteil der Wohnung direkt</span>'
          + '<input type="checkbox" id="' + id + 'modus" data-wsu="modus"' + (ges ? ' checked' : '') + ' aria-label="Gesamtbetrag der Gemeinschaft mal Miteigentumsanteil">'
          + '<span class="wsu-modus-g">Gesamtbetrag der Gemeinschaft × MEA</span></label>' + tip('tab6.su_modus') + '</div>';
        var anteilFeld = ges
          ? '<div class="f"><label>Gesamtbetrag der Gemeinschaft</label><div class="iw"><span class="pfx">€</span><input id="' + id + 'gesamt" data-wsu="gesamt" type="text" inputmode="decimal" class="trl" value="' + esc(e.gesamt != null ? Math.round(e.gesamt) : '') + '"></div></div>'
            + '<div class="f"><label>Anteil dieses Objekts' + tip('tab6.su_anteil') + '</label><div class="iw"><span class="pfx">€</span><input id="' + id + 'betrag" data-wsu-anzeige="1" type="text" class="trl" readonly tabindex="-1" style="background:var(--surface2,#F5F2EC)" value="' + esc(e.betrag != null ? Math.round(e.betrag) : '') + '"></div>'
            + '<div class="hint wsu-mea" style="display:block;margin-top:2px">' + (m ? '= Gesamtbetrag × Miteigentumsanteil ' + meaText(m) + ' % (Reiter Objekt)' : '<span style="color:#B8625C">Miteigentumsanteil fehlt</span> - im Reiter Objekt eintragen, dann rechnet der Anteil sich hier.') + '</div></div>'
          : '<div class="f"><label>Anteil dieses Objekts' + tip('tab6.su_anteil') + '</label><div class="iw"><span class="pfx">€</span><input id="' + id + 'betrag" data-wsu="betrag" type="text" inputmode="decimal" class="trl" value="' + esc(e.betrag != null ? Math.round(e.betrag) : '') + '"></div></div>';
        return '<div class="wsu-eintrag" data-i="' + i + '" style="border-top:1px solid var(--line,rgba(42,39,39,.12));padding:8px 0">'
          + '<div class="g2">'
          + regler
          + '<div class="f"><label>Zweck</label><input id="' + id + 'zweck" data-wsu="zweck" type="text" value="' + esc(e.zweck) + '"></div>'
          + anteilFeld
          + '<div class="f"><label>Fällig im Jahr</label><input id="' + id + 'jahr" data-wsu="jahr" data-zf-aus="1" type="text" inputmode="numeric" value="' + esc(e.jahr || '') + '"></div>'
          + '<div class="f"><label>Fälligkeitstag <span style="color:var(--muted);font-weight:400">· optional</span></label><input id="' + id + 'faellig" data-wsu="faellig" type="text" placeholder="TT.MM.JJJJ" value="' + esc(e.faellig || '') + '"></div>'
          + '<div class="f"><label>Steuer: Jahr der Verwendung' + tip('tab6.su_verw_jahr') + '</label><input id="' + id + 'verw_jahr" data-wsu="verw_jahr" data-zf-aus="1" type="text" inputmode="numeric" value="' + esc(e.verw_jahr || e.jahr || '') + '"></div>'
          + '<div class="f"><label>Steuer: Art' + tip('tab6.su_art') + '</label><select id="' + id + 'art" data-wsu="art"><option value=""' + (!e.art ? ' selected' : '') + '>– bitte wählen –</option><option value="erhaltung"' + (e.art === 'erhaltung' ? ' selected' : '') + '>Erhaltung (sofort absetzbar)</option><option value="herstellung"' + (e.art === 'herstellung' ? ' selected' : '') + '>Herstellung (über die AfA)</option></select></div>'
          + '</div>'
          + '<div class="hint wsu-cf" style="display:block;margin-top:2px"></div>'
          + '<div class="hint wsu-st" style="display:block;margin-top:4px"></div>'
          + (e.wie ? '<div class="hint" style="display:block;margin-top:2px;color:var(--muted)">Herkunft: ' + esc(e.wie) + '</div>' : '')
          + '<button type="button" class="btn btn-sm wsu-btn" data-wsu-weg="' + i + '" style="margin-top:4px">Entfernen</button>'
          + '</div>';
      }).join('');
      host.innerHTML = (l.length ? h : '<div class="hint" style="display:block">Keine Sonderumlage erfasst. Aus Wirtschaftsplan oder Protokoll kommt sie über „Unterlagen einlesen“.</div>')
        + '<button type="button" class="btn btn-sm wsu-btn" data-wsu-neu="1" style="margin-top:8px">+ Sonderumlage</button>';
    }
    /* Status-Zeilen immer neu - sie hängen an Übergang, Sanierung und 15-%-Grenze */
    [].forEach.call(host.querySelectorAll('.wsu-eintrag'), function (box) {
      var i = +box.getAttribute('data-i'), e = l[i]; if (!e) return;
      var c = box.querySelector('.wsu-cf'), s = box.querySelector('.wsu-st');
      if (c) c.textContent = cfZeile(e);
      if (s) s.innerHTML = steuerZeile(e, i, gr);
    });
  }

  function steuerAbziehen(e) {
    if (!e.st || typeof window.dpSteuerWert !== 'function') return;
    var w = window.dpSteuerWert(e.st.jahr, e.st.feld);
    if (w) window.dpSteuerSetzen(e.st.jahr, e.st.feld, Math.max(0, (w.wert || 0) - e.st.betrag));
    e.st = null;
  }
  function steuerSetzen(i) {
    var l = liste(), e = l[i]; if (!e || e.art !== 'erhaltung') return;
    if (typeof window.dpSteuerWert !== 'function' || typeof window.dpSteuerSetzen !== 'function') return;
    var J = verwJahr(e), b = Math.round(zahl(e.betrag) || 0);
    if (!J || !(b > 0)) return;
    if (window.dpSteuerWert(J, 'erhaltungsaufwand') === null) {
      if (typeof window.toast === 'function') window.toast('Das Jahr ' + J + ' liegt nicht in der Zeitleiste des Steuer-Reiters.');
      return;
    }
    steuerAbziehen(e);
    var w = window.dpSteuerWert(J, 'erhaltungsaufwand');
    window.dpSteuerSetzen(J, 'erhaltungsaufwand', (w.wert || 0) + b);
    e.st = { jahr: J, feld: 'erhaltungsaufwand', betrag: b };
    speichern(l, true);
    if (typeof window.toast === 'function') window.toast('✓ Steuer ' + J + ': Erhaltungsaufwand +' + eur(b) + ' (Sonderumlage ' + (e.zweck || '') + ')');
  }

  /* Ereignisse an einer Stelle (Delegation) - die Liste wird neu gezeichnet */
  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute || !t.getAttribute('data-wsu')) return;
    var box = t.closest('.wsu-eintrag'); if (!box) return;
    var l = liste(), e = l[+box.getAttribute('data-i')]; if (!e) return;
    var k = t.getAttribute('data-wsu'), v = String(t.value || '').trim();
    /* v3213 · W-19: Regler und Gesamtbetrag */
    if (k === 'modus') {
      var nachGes = !!t.checked;
      if (nachGes === (e.modus === 'gesamt')) return;   /* input + change: nur einmal */
      if (nachGes) {
        e.modus = 'gesamt';
        var mm = meaPct();
        if (!(zahl(e.gesamt) > 0) && zahl(e.betrag) > 0 && mm) e.gesamt = Math.round(zahl(e.betrag) * 100 / mm);
        ausGesamt(e);
      } else { e.modus = 'anteil'; if (/Miteigentumsanteil/.test(e.wie || '')) e.wie = 'eigene Angabe'; }
      speichern(l, true);
      return;
    }
    if (k === 'gesamt') {
      e.gesamt = zahl(v);
      if (!ausGesamt(e) && !(e.gesamt > 0)) e.betrag = null;
      var anz = box.querySelector('[data-wsu-anzeige]');
      if (anz) anz.value = e.betrag != null ? Math.round(e.betrag) : '';
      speichern(l, false);
      return;
    }
    if (k === 'betrag') e.betrag = zahl(v);
    else if (k === 'jahr') { var alt = zahl(e.jahr); e.jahr = zahl(v); if (!e.verw_jahr || e.verw_jahr === alt) e.verw_jahr = e.jahr; }
    else if (k === 'verw_jahr') e.verw_jahr = zahl(v);
    else e[k] = v;
    speichern(l, k === 'jahr');   /* Jahr ändert die vorbelegte Verwendung → neu zeichnen */
  });
  /* die Art (select) kommt ueber dasselbe input-Ereignis; der Regler (Checkbox) zur
     Sicherheit auch über change - der Handler oben nimmt ihn nur einmal */
  document.addEventListener('change', function (ev) {
    var t = ev.target; if (!t || !t.getAttribute || t.getAttribute('data-wsu') !== 'modus') return;
    try { t.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  });
  /* v3213 · W-19: MEA im Reiter Objekt geändert → Anteile im Modus „gesamt" neu rechnen */
  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!t || t.id !== 'mea') return;
    var l = liste(), ge = false;
    l.forEach(function (e) { if (e.modus === 'gesamt' && ausGesamt(e)) ge = true; });
    if (ge) speichern(l, true);
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('.wsu-btn') : null; if (!t) return;
    var l = liste();
    if (t.hasAttribute('data-wsu-neu')) { l.push({ zweck: '', jahr: anschaffungsjahr() || new Date().getFullYear(), faellig: '', betrag: null, wie: 'eigene Angabe', verw_jahr: null, art: '' }); l[l.length - 1].verw_jahr = l[l.length - 1].jahr; speichern(l, true); return; }
    if (t.hasAttribute('data-wsu-weg')) { var i = +t.getAttribute('data-wsu-weg'); if (l[i]) { steuerAbziehen(l[i]); l.splice(i, 1); speichern(l, true); } return; }
    if (t.hasAttribute('data-wsu-steuer')) { steuerSetzen(+t.getAttribute('data-wsu-steuer')); return; }
    if (t.hasAttribute('data-wsu-zurueck')) { var j = +t.getAttribute('data-wsu-zurueck'); if (l[j]) { steuerAbziehen(l[j]); speichern(l, true); } return; }
  });

  window.DpSonderumlage = { liste: liste, jeJahr: jeJahr, uebernehmen: uebernehmen, render: render, grenze15: grenze15,
    _test: { vorUebergang: vorUebergang, datum: datum } };   /* v3211 · für tools/sonderumlage-pruefen.mjs */
})();
