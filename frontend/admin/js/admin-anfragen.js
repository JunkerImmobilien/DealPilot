// admin-anfragen.js — v3020 · Reiter „Register & Ernte", Abschnitt „Anfragen an Ämter"
//
// Marcel 28.10.2026: „die Ämter, die wir anfragen sollten, mit Mail und
// worum es geht, könnten wir in unser Admin-Portal setzen" — „ja, mit
// Status gerne in die Datenbank".
//
// Je Gutachterausschuss mit Sperren: worum es geht (Kennzahlen, Grund,
// Preis, Jahrgang, Link), die belegte E-Mail der Geschäftsstelle, ein
// mailto:-Link mit vorbefülltem Betreff und Text, „Text kopieren" und der
// Status (mb.amt_anfragen). Versendet wird NICHTS — Marcel schickt selbst.
// Ein Klick auf den mailto-Link setzt den Status nicht, er fragt nur nach.
//
// Daten: GET /api/v1/admin/register/anfragen (requireAdmin → mb-Backend,
// lib/sperren_anfragen.js — dieselbe Rechnung wie tools/sperren-anfrageliste.mjs).
(function () {
  'use strict';

  var BASE = '/api/v1/admin';
  var A = null;            // letzte Antwort
  var geladen = false;
  var KZ = { lzs: 'Liegenschaftszinssatz', swf: 'Sachwertfaktor', uk_flaeche: 'UK Grundstücksgröße',
    uk_wgfz: 'UK WGFZ', vgf: 'Vergleichsfaktor', irw: 'IRW-Umrechnung' };

  function _token() { try { return localStorage.getItem('dp_admin_token') || ''; } catch (e) { return ''; } }
  async function _call(pfad, body) {
    var headers = {};
    var t = _token();
    if (t) headers['X-Admin-Token'] = t;
    var init = { headers: headers };
    if (body !== undefined) { init.method = 'POST'; headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
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
  function zahl(n) { return n == null ? '–' : Number(n).toLocaleString('de-DE'); }
  function heute() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function grund(g) { return (A && A.grund_name && A.grund_name[g]) || g; }
  function statusVon(a) { return (a.status && a.status.status) || 'offen'; }
  function mailVon(a) {
    if (a.email) return { adr: a.email, obere: false };
    if (a.kontakt && a.kontakt.email_obere_stelle) return { adr: a.kontakt.email_obere_stelle, obere: true };
    return null;
  }
  function mailto(a, adr) {
    return 'mailto:' + adr + '?subject=' + encodeURIComponent(a.anfrage.betreff) + '&body=' + encodeURIComponent(a.anfrage.text);
  }
  function link(u, t) { return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(t) + '</a>' : ''; }

  function zeile(a, i) {
    var st = a.status || {};
    var m = mailVon(a);
    var kz = Object.keys(a.kennzahlen).sort(function (x, y) { return a.kennzahlen[y] - a.kennzahlen[x]; })
      .map(function (k) { return esc(KZ[k] || k) + ' ' + a.kennzahlen[k]; }).join(' · ');
    var gr = Object.keys(a.gruende).sort(function (x, y) { return a.gruende[y] - a.gruende[x]; })
      .map(function (g) { return esc(grund(g)) + ' ' + a.gruende[g]; }).join(' · ');
    var links = [link(a.bestell_urls[0], 'bestellen'), link(a.quelle_urls[0], 'Quelle')].filter(Boolean).join(' · ');
    var kontakt = '';
    if (m) {
      kontakt = '<a href="' + esc(mailto(a, m.adr)) + '" class="aa-mail" data-i="' + i + '">' + esc(m.adr) + '</a>' +
        (m.obere ? '<div class="rg-sub">nur obere Stelle (' + esc(a.kontakt.obere_stelle || '') + ') — bitte um Weiterleitung</div>' : '');
    } else if (a.kontakt && a.kontakt.kontaktformular_url) {
      kontakt = link(a.kontakt.kontaktformular_url, 'Kontaktformular');
    } else kontakt = '<span class="rg-sub">keine belegte Adresse</span>';
    if (a.kontakt && a.kontakt.quelle_url) kontakt += '<div class="rg-sub">' + link(a.kontakt.quelle_url, 'Beleg') + (a.kontakt.gelesen_am ? ' · ' + esc(a.kontakt.gelesen_am) : '') + '</div>';
    if (a.kontakt && a.kontakt.email_landkreis) kontakt += '<div class="rg-sub">Landkreis: <a href="' + esc(mailto(a, a.kontakt.email_landkreis)) + '" class="aa-mail" data-i="' + i + '">' + esc(a.kontakt.email_landkreis) + '</a></div>';
    if (a.kontakt && a.kontakt.hinweis) kontakt += '<details class="rg-sub"><summary>Hinweis</summary>' + esc(a.kontakt.hinweis) + '</details>';
    if (a.kontakt && a.kontakt.telefon) kontakt += '<div class="rg-sub">' + esc(a.kontakt.telefon) + '</div>';
    kontakt += '<div style="margin-top:6px"><button type="button" class="rg-x aa-kopie" data-i="' + i + '">Text kopieren</button></div>' +
      '<div class="aa-frage" id="aa-frage-' + i + '"></div>';
    var sel = '<select class="aa-st" data-i="' + i + '">' + A.status_werte.map(function (s) {
      return '<option value="' + esc(s) + '"' + (s === statusVon(a) ? ' selected' : '') + '>' + esc(A.status_name[s] || s) + '</option>';
    }).join('') + '</select>';
    return '<tr data-i="' + i + '" data-land="' + esc(a.land) + '" data-grund="' + esc(a.hauptgrund) + '" data-status="' + esc(statusVon(a)) +
      '" data-mail="' + (m ? 1 : 0) + '" data-such="' + esc((a.ausschuss + ' ' + a.namen.join(' ')).toLowerCase()) + '">' +
      '<td>' + esc(a.land) + '</td>' +
      '<td>' + esc(a.ausschuss) + (a.namen.length ? '<div class="rg-sub">auch: ' + esc(a.namen.slice(0, 2).join(' · ')) + '</div>' : '') + '</td>' +
      '<td class="rg-n"><b>' + zahl(a.sperren) + '</b></td>' +
      '<td class="rg-grund">' + kz + '<div class="rg-sub">' + gr + '</div>' +
        (a.preise.length ? '<div class="rg-sub">Preis: ' + esc(a.preise[0]) + '</div>' : '') +
        '<div class="rg-sub">' + (a.jahrgang ? 'Jahrgang ' + esc(a.jahrgang) : '') + (links ? (a.jahrgang ? ' · ' : '') + links : '') + '</div>' +
        (a.grund_text ? '<details class="rg-sub"><summary>Wortlaut</summary>' + esc(a.grund_text) + '</details>' : '') + '</td>' +
      '<td>' + kontakt + '</td>' +
      '<td class="aa-status">' + sel +
        '<label class="rg-sub">angefragt <input type="date" class="aa-d1" value="' + esc(st.angefragt_am || '') + '"></label>' +
        '<label class="rg-sub">Antwort <input type="date" class="aa-d2" value="' + esc(st.antwort_am || '') + '"></label>' +
        '<textarea class="aa-notiz" rows="2" placeholder="Notiz">' + esc(st.notiz || '') + '</textarea>' +
        '<button type="button" class="rg-x aa-save" data-i="' + i + '">speichern</button><span class="rg-sub aa-ok"></span>' +
        (st.geaendert_am ? '<div class="rg-sub">zuletzt ' + esc(String(st.geaendert_am).slice(0, 10)) + (st.geaendert_von ? ' · ' + esc(st.geaendert_von) : '') + '</div>' : '') +
      '</td></tr>';
  }

  function zeichne() {
    var box = document.getElementById('rg-anfragen');
    if (!box || !A) return;
    var Z = A.zusammenfassung;
    var nStatus = {};
    A.ausschuesse.forEach(function (a) { var s = statusVon(a); nStatus[s] = (nStatus[s] || 0) + 1; });
    var laender = {}; var gruende = {};
    A.ausschuesse.forEach(function (a) { laender[a.land] = (laender[a.land] || 0) + 1; gruende[a.hauptgrund] = (gruende[a.hauptgrund] || 0) + 1; });
    var h = '<h3 class="rg-h">Anfragen an Ämter</h3>' +
      '<p class="rg-hint">Jede Sperre des Registers, je Gutachterausschuss gebündelt: ' + zahl(Z.ausschuesse) + ' Ausschüsse, ' +
      zahl(Z.sperren) + ' Sperren, belegte E-Mail der Geschäftsstelle bei ' + zahl(Z.mit_email) + ', nur obere Stelle bei ' + zahl(Z.nur_obere_stelle) +
      '. Der E-Mail-Link öffnet dein Mailprogramm mit Betreff und Text — <b>versendet wird nichts automatisch</b>. Status: ' +
      A.status_werte.map(function (s) { return esc(A.status_name[s]) + ' ' + (nStatus[s] || 0); }).join(' · ') +
      (A.status_fehler ? ' <span class="rg-rot">(Status nicht lesbar: ' + esc(A.status_fehler) + ')</span>' : '') +
      '. Liste auch als Datei: <code>node tools/sperren-anfrageliste.mjs</code>.</p>';
    h += '<div class="rg-filter"><label>Land <select id="aa-f-land"><option value="">alle</option>' +
      Object.keys(laender).sort().map(function (L) { return '<option value="' + esc(L) + '">' + esc(L) + ' (' + laender[L] + ')</option>'; }).join('') +
      '</select></label><label>Grund <select id="aa-f-grund"><option value="">alle</option>' +
      Object.keys(gruende).sort(function (x, y) { return gruende[y] - gruende[x]; }).map(function (g) { return '<option value="' + esc(g) + '">' + esc(grund(g)) + ' (' + gruende[g] + ')</option>'; }).join('') +
      '</select></label><label>Status <select id="aa-f-status"><option value="">alle</option>' +
      A.status_werte.map(function (s) { return '<option value="' + esc(s) + '">' + esc(A.status_name[s]) + ' (' + (nStatus[s] || 0) + ')</option>'; }).join('') +
      '</select></label><label>Sortierung <select id="aa-f-sort"><option value="sperren">nach Sperren</option><option value="land">nach Land</option></select></label>' +
      '<label><input type="checkbox" id="aa-f-mail"> nur mit E-Mail</label>' +
      '<input type="search" id="aa-f-such" placeholder="Ausschuss suchen …"><span id="aa-f-n" class="rg-hint"></span></div>';
    h += '<div class="rg-scroll"><table class="data-table rg-tab" id="aa-tab"><thead><tr><th>Land</th><th>Ausschuss</th><th>Sperren</th>' +
      '<th>Worum es geht</th><th>E-Mail der Geschäftsstelle</th><th>Status</th></tr></thead><tbody>';
    A.ausschuesse.forEach(function (a, i) { h += zeile(a, i); });
    h += '</tbody></table></div>';
    box.innerHTML = h;
    ['aa-f-land', 'aa-f-grund', 'aa-f-status', 'aa-f-mail'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.addEventListener('change', filtern);
    });
    document.getElementById('aa-f-sort').addEventListener('change', sortieren);
    document.getElementById('aa-f-such').addEventListener('input', filtern);
    box.addEventListener('click', klick);
    sortieren();
  }

  function sortieren() {
    var nach = (document.getElementById('aa-f-sort') || {}).value || 'sperren';
    var tb = document.querySelector('#aa-tab tbody');
    if (!tb) return;
    var trs = Array.prototype.slice.call(tb.children);
    trs.sort(function (x, y) {
      var a = A.ausschuesse[+x.getAttribute('data-i')], b = A.ausschuesse[+y.getAttribute('data-i')];
      if (nach === 'land' && a.land !== b.land) return a.land < b.land ? -1 : 1;
      return b.sperren - a.sperren || a.ausschuss.localeCompare(b.ausschuss, 'de');
    });
    trs.forEach(function (tr) { tb.appendChild(tr); });
    filtern();
  }
  function filtern() {
    var L = (document.getElementById('aa-f-land') || {}).value || '';
    var G = (document.getElementById('aa-f-grund') || {}).value || '';
    var S = (document.getElementById('aa-f-status') || {}).value || '';
    var M = (document.getElementById('aa-f-mail') || {}).checked;
    var Q = String((document.getElementById('aa-f-such') || {}).value || '').toLowerCase().trim();
    var n = 0;
    document.querySelectorAll('#aa-tab tbody tr').forEach(function (tr) {
      var ok = (!L || tr.getAttribute('data-land') === L) && (!G || tr.getAttribute('data-grund') === G) &&
        (!S || tr.getAttribute('data-status') === S) && (!M || tr.getAttribute('data-mail') === '1') &&
        (!Q || tr.getAttribute('data-such').indexOf(Q) >= 0);
      tr.style.display = ok ? '' : 'none';
      if (ok) n++;
    });
    var o = document.getElementById('aa-f-n'); if (o) o.textContent = n + ' angezeigt';
  }

  function speichern(i, patch) {
    var a = A.ausschuesse[i];
    var tr = document.querySelector('#aa-tab tr[data-i="' + i + '"]');
    if (!tr) return Promise.resolve();
    if (patch) {
      if (patch.status) tr.querySelector('.aa-st').value = patch.status;
      if (patch.angefragt_am) tr.querySelector('.aa-d1').value = patch.angefragt_am;
    }
    var body = { schluessel: a.schluessel, status: tr.querySelector('.aa-st').value,
      angefragt_am: tr.querySelector('.aa-d1').value || null, antwort_am: tr.querySelector('.aa-d2').value || null,
      notiz: tr.querySelector('.aa-notiz').value || null };
    var ok = tr.querySelector('.aa-ok');
    ok.textContent = ' speichert …';
    return _call('/register/anfragen/status', body).then(function (d) {
      a.status = d.status;
      tr.setAttribute('data-status', d.status.status);
      ok.textContent = ' gespeichert';
      ok.className = 'rg-sub aa-ok aa-gruen';
    }).catch(function (e) { ok.textContent = ' Fehler: ' + e.message; ok.className = 'rg-sub aa-ok rg-rot'; });
  }

  function kopieren(i, knopf) {
    var a = A.ausschuesse[i];
    var m = mailVon(a);
    var t = (m ? 'An: ' + m.adr + '\n' : '') + 'Betreff: ' + a.anfrage.betreff + '\n\n' + a.anfrage.text;
    var fertig = function () { knopf.textContent = 'kopiert'; setTimeout(function () { knopf.textContent = 'Text kopieren'; }, 1800); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(fertig, function () { ersatz(t); fertig(); });
    else { ersatz(t); fertig(); }
  }
  function ersatz(t) {
    var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove();
  }

  function klick(ev) {
    var el = ev.target;
    if (!el || !el.classList) return;
    var i = +el.getAttribute('data-i');
    if (el.classList.contains('aa-save')) { speichern(i); return; }
    if (el.classList.contains('aa-kopie')) { kopieren(i, el); return; }
    if (el.classList.contains('aa-ja')) { speichern(i, { status: 'angefragt', angefragt_am: heute() }); el.parentNode.innerHTML = ''; return; }
    if (el.classList.contains('aa-nein')) { el.parentNode.innerHTML = ''; return; }
    if (el.classList.contains('aa-mail')) {
      /* Kein automatischer Status — nur die Frage. */
      if (statusVon(A.ausschuesse[i]) !== 'offen') return;
      var f = document.getElementById('aa-frage-' + i);
      if (f) f.innerHTML = '<div class="rg-sub" style="margin-top:6px">Als angefragt markieren? ' +
        '<button type="button" class="rg-x aa-ja" data-i="' + i + '">ja, heute</button> ' +
        '<button type="button" class="rg-x aa-nein" data-i="' + i + '">nein</button></div>';
    }
  }

  function stil() {
    if (document.getElementById('aa-css')) return;
    var s = document.createElement('style');
    s.id = 'aa-css';
    s.textContent =
      '#rg-anfragen .aa-status{min-width:210px}' +
      '#rg-anfragen .aa-status label{display:block;margin-top:4px}' +
      '#rg-anfragen .aa-status select,#rg-anfragen .aa-status input,#rg-anfragen .aa-status textarea{font-size:12px;padding:3px 6px;border:1px solid var(--border,#e5dfd2);border-radius:5px;background:#fff;color:#1a1a1a}' +
      '#rg-anfragen .aa-status textarea{display:block;width:100%;box-sizing:border-box;margin:4px 0}' +
      '#rg-anfragen .aa-gruen{color:#3FA56C}' +
      '#rg-anfragen .aa-mail{word-break:break-all}' +
      '#rg-anfragen details summary{cursor:pointer}' +
      '#rg-anfragen .rg-x{margin-left:0}';
    document.head.appendChild(s);
  }

  function laden() {
    var box = document.getElementById('rg-anfragen');
    if (!box) return;
    stil();
    box.innerHTML = '<h3 class="rg-h">Anfragen an Ämter</h3><p class="rg-hint">wird geladen …</p>';
    return _call('/register/anfragen')
      .then(function (d) { A = d; geladen = true; zeichne(); })
      .catch(function (e) { box.innerHTML = '<h3 class="rg-h">Anfragen an Ämter</h3><p class="rg-hint rg-rot">Konnte nicht geladen werden: ' + esc(e.message) + '</p>'; });
  }

  function init() {
    var nav = document.querySelector('.nav-link[data-view="register"]');
    if (nav) nav.addEventListener('click', function () { setTimeout(function () { if (!geladen) laden(); }, 40); });
    var neu = document.getElementById('rg-neu');
    if (neu) neu.addEventListener('click', function () { laden(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AdminAnfragen = { laden: laden };
})();
