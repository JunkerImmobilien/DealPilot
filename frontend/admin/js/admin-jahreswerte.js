// admin-jahreswerte.js — v3021 · Reiter „Register & Ernte", Abschnitt „Jahreswerte"
//
// Marcel 28.10.2026: „den Wert bitte dann jedes Jahr automatisch neu ermitteln,
// und das müssen wir auch bei den Steuerdaten machen."
//
// NUR LESEND: je Jahreswert Stand, fällig am, Status, Verfahren (aus dem
// Register marktbericht/backend/src/lib/data/jahreswerte.json); darunter der
// Stand der automatisch geholten Reihen (VPI, Baupreisindex) und des
// selbst ermittelten Angebotsabschlags. Einzige Aktion: Reihen jetzt holen.
// Gepflegt werden die Werte im Code (Agent .claude/agents/jahreswerte.md),
// geprüft von tools/jahreswerte-pruefen.mjs bei jedem Ausrollen.
//
// Daten: GET /api/v1/admin/jahreswerte (requireAdmin → mb-Backend /jahreswerte/stand).
(function () {
  'use strict';

  var BASE = '/api/v1/admin';
  var geladen = false;
  var STATUS = {
    ueberfaellig: ['überfällig', '#B8625C'], bald: ['bald fällig', 'var(--wl-b8932f, #b8932f)'],
    ok: ['ok', '#3FA56C'], ohne_termin: ['ohne Termin', '#7a7468']
  };
  var VERF = { automatisch: 'automatisch', agent: 'Agent + Freigabe', durchsicht: 'jährliche Durchsicht' };

  function _token() { try { return localStorage.getItem('dp_admin_token') || ''; } catch (e) { return ''; } }
  async function _call(pfad, post) {
    var headers = {};
    var t = _token();
    if (t) headers['X-Admin-Token'] = t;
    var init = { headers: headers };
    if (post) { init.method = 'POST'; headers['Content-Type'] = 'application/json'; init.body = '{}'; }
    var r = await fetch(BASE + pfad, init);
    var d = null;
    try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((d && (d.message || d.error)) || ('HTTP ' + r.status));
    return d;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function datum(d) { if (!d) return '–'; var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1] : esc(d); }
  function zahl(n) { return n == null ? '–' : String(n).replace('.', ','); }

  function tabelleWerte(werte) {
    var rang = { ueberfaellig: 0, bald: 1, ok: 2, ohne_termin: 3 };
    var w = werte.slice().sort(function (a, b) { return (rang[a.status] - rang[b.status]) || String(a.faellig_am || '9').localeCompare(String(b.faellig_am || '9')); });
    return '<table class="data-table rg-tab"><thead><tr><th>Wert</th><th>Stand</th><th>fällig am</th><th>Status</th><th>Verfahren</th></tr></thead><tbody>'
      + w.map(function (x) {
        var s = STATUS[x.status] || [x.status, '#7a7468'];
        var txt = s[0] + (x.status === 'ueberfaellig' && x.verfahren === 'automatisch' ? ' (nur Rückfall im Code)' : '');
        return '<tr title="' + esc((x.orte || []).join('\n') + (x.hinweis ? '\n\n' + x.hinweis : '')) + '">'
          + '<td>' + esc(x.name) + '</td><td>' + esc(x.stand) + '</td><td>' + datum(x.faellig_am)
          + (x.tage != null ? ' <span class="rg-sub">(' + (x.tage >= 0 ? 'in ' + x.tage : x.tage * -1 + ' über') + ' Tg.)</span>' : '') + '</td>'
          + '<td style="color:' + s[1] + ';font-weight:600">' + esc(txt) + '</td><td>' + esc(VERF[x.verfahren] || x.verfahren) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function reihen(a) {
    var r = (a && a.reihen) || {};
    var h = '<p class="rg-hint">Automatisch geholt (wöchentlich, Statistisches Bundesamt). Wirksam wird ein Wert nur nach Plausibilitätsprüfung; '
      + 'die Tabellen im Code bleiben Rückfall. GENESIS-Zugang: ' + (a && a.genesis_token ? '<b>eingerichtet</b>' : '<b>nicht eingerichtet</b> – es läuft über die öffentlichen Tabellenseiten') + '.</p>';
    h += '<table class="data-table rg-tab"><thead><tr><th>Reihe</th><th>im Code bis</th><th>zuletzt gelesen</th><th>Warnungen</th></tr></thead><tbody>';
    Object.keys(r).forEach(function (k) {
      var x = r[k], d = (x.db || [])[0];
      h += '<tr><td>' + esc(x.name) + '</td><td>' + (x.im_code_bis ? esc(x.im_code_bis.periode) + ' = ' + zahl(x.im_code_bis.wert) : '–') + '</td>'
        + '<td>' + (d ? esc(d.periode) + ' = ' + zahl(d.wert) + ' (' + esc(d.status) + ', ' + datum(d.abgerufen_am) + ')' : 'noch nichts') + '</td>'
        + '<td' + (x.warnungen ? ' style="color:#B8625C"' : '') + '>' + (x.warnungen || 0) + '</td></tr>';
    });
    h += '</tbody></table>';
    var l = (a && a.laeufe) || [];
    if (l.length) h += '<p class="rg-sub">Letzte Läufe: ' + l.map(function (x) { return datum(x.gelaufen_am) + ' ' + esc(x.art) + ' ' + (x.ok ? 'ok' : 'unvollständig'); }).join(' · ') + '</p>';
    if (a && a.bwk_vorschlag && a.bwk_vorschlag.verfuegbar) {
      var b = a.bwk_vorschlag;
      h += '<p class="rg-hint">Bewirtschaftungskosten ' + b.jahr + ' rechnerisch (VPI Okt. ' + (b.jahr - 1) + ' = ' + zahl(b.vpi_oktober) + '): Verwaltung ' + b.verw_we
        + ' / ETW ' + b.verw_etw + ' / Garage ' + b.verw_garage + ' €, Instandhaltung ' + zahl(b.inst_qm) + ' €/m² / Garage ' + b.inst_garage
        + ' € – <b>nur Vorschlag</b>, eingetragen wird die amtliche Tabelle.</p>';
    }
    return h;
  }

  function abschlag(d) {
    var a = (d.automatisch && d.automatisch.abschlag) || {};
    var akt = d.abschlag_aktiv || {};
    var rec = d.abschlag_recherche || {};
    var h = '<p class="rg-hint">Abschlag auf Angebotspreise: Recherche ' + zahl(rec.pct) + ' % (' + esc(rec.stand) + '). '
      + 'Ab dem 15. Januar ersetzt ihn je Segment der DealPilot-Marktdurchschnitt des Vorjahres, wenn genug Ortsmessungen vorliegen. '
      + 'Aktiv: ' + (Object.keys(akt).length ? Object.keys(akt).map(function (s) { return s + ' ' + zahl(akt[s].pct) + ' % (n = ' + akt[s].n + ', ' + akt[s].jahr + ')'; }).join(' · ') : 'keiner – es gilt die Recherche') + '.</p>';
    var m = a.messungen || [];
    if (m.length) {
      h += '<table class="data-table rg-tab"><thead><tr><th>Jahr</th><th>Segment</th><th>Messungen</th><th>Orte × Satz</th><th>Median</th></tr></thead><tbody>'
        + m.map(function (x) { return '<tr><td>' + x.jahr + '</td><td>' + esc(x.segment) + '</td><td>' + x.n + '</td><td>' + x.orte + '</td><td>' + zahl(x.median) + ' %</td></tr>'; }).join('')
        + '</tbody></table>';
    } else h += '<p class="rg-sub">Noch keine Ortsmessung protokolliert.</p>';
    return h;
  }

  function zeichne(d) {
    var box = document.getElementById('rg-jahreswerte');
    if (!box) return;
    var werte = d.werte || [];
    var n = { ueberfaellig: 0, bald: 0 };
    werte.forEach(function (x) { if (n[x.status] != null) n[x.status]++; });
    box.innerHTML = '<h3 class="rg-h">Jahreswerte</h3>'
      + '<p class="rg-hint">Register ' + esc(d.register && d.register.version) + ' vom ' + datum(d.register && d.register.stand) + ': ' + werte.length + ' Werte, '
      + '<b style="color:#B8625C">' + n.ueberfaellig + ' überfällig</b>, <b style="color:var(--wl-b8932f, #b8932f)">' + n.bald + ' in 60 Tagen fällig</b>. '
      + 'Gepflegt werden sie im Code (Agent „jahreswerte"), geprüft bei jedem Ausrollen. Zeile überfahren = Ort im Code.</p>'
      + tabelleWerte(werte)
      + '<h3 class="rg-h" style="margin-top:14px">Automatisch geholte Reihen <a href="#" id="jw-holen" class="range-btn">jetzt holen</a></h3>'
      + reihen(d.automatisch)
      + abschlag(d);
    var b = document.getElementById('jw-holen');
    if (b) b.addEventListener('click', function (ev) {
      ev.preventDefault(); b.textContent = 'holt …';
      _call('/jahreswerte/abruf', true).then(function () { laden(); }).catch(function (e) { b.textContent = 'Fehler: ' + e.message; });
    });
  }

  function laden() {
    var box = document.getElementById('rg-jahreswerte');
    if (!box) return;
    box.innerHTML = '<h3 class="rg-h">Jahreswerte</h3><p class="rg-hint">wird geladen …</p>';
    return _call('/jahreswerte')
      .then(function (d) { geladen = true; zeichne(d); })
      .catch(function (e) { box.innerHTML = '<h3 class="rg-h">Jahreswerte</h3><p class="rg-hint rg-rot">Konnte nicht geladen werden: ' + esc(e.message) + '</p>'; });
  }

  function init() {
    var nav = document.querySelector('.nav-link[data-view="register"]');
    if (nav) nav.addEventListener('click', function () { setTimeout(function () { if (!geladen) laden(); }, 60); });
    var neu = document.getElementById('rg-neu');
    if (neu) neu.addEventListener('click', function () { laden(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AdminJahreswerte = { laden: laden };
})();
