// admin-register.js — v2591 · Reiter „Register & Ernte"
// ────────────────────────────────────────────────────────────────────────────
// Für Marcel: wie viel liegt im Register, wie viele WERTE (nicht Sätze), wo
// sind Lücken, welche Ausschüsse sind nur gegen Geld oder Genehmigung zu
// bekommen (Preis, Bestellweg, Kontakt), und was hat die Hintergrund-Ernte
// gefunden.
//
// Daten: /admin/register/deckung (Proxy → mb /register/deckung). Gerechnet
// wird dort, aus den Registerdateien auf demselben Leseweg wie der Bericht,
// dazu der Abgleich mit mb.param_modell. Hier wird nur gezeichnet.
//
// Eigener fetch mit X-Admin-Token wie admin-marktzinsen.js.
// Gold nur als var(--wl-c9a84c, #C9A84C); Grün/Rot sind Statusfarben und
// bleiben in jeder Marke gleich.
(function () {
  'use strict';

  var BASE = '/api/v1/admin';
  var geladen = false;
  var D = null;          // letzte Antwort
  var offen = null;      // offene Zelle 'NW|lzs'

  var KZ4 = ['lzs', 'swf', 'uk_flaeche', 'uk_wgfz'];
  var GRUEN = '#3FA56C', ROT = '#B8625C';
  var GOLD = 'var(--wl-c9a84c, #C9A84C)';
  var FUNDORT = {
    register_zugang: 'Register: Feld Zugang',
    register_text: 'Register: Wortlaut der Sperre',
    quellen_links: 'Quellenliste (Ausschuss)',
    gaa_sources: 'Quellenverzeichnis (DB)',
  };

  function _token() { try { return localStorage.getItem('dp_admin_token') || ''; } catch (e) { return ''; } }
  async function _call(pfad) {
    var headers = {};
    var t = _token();
    if (t) headers['X-Admin-Token'] = t;
    var r = await fetch(BASE + pfad, { headers: headers });
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
  function datum(d) {
    if (!d) return '–';
    try { return new Date(d).toLocaleDateString('de-DE'); } catch (e) { return '–'; }
  }
  function zeit(d) {
    if (!d) return '–';
    try { return new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }); }
    catch (e) { return '–'; }
  }
  function link(url, text) {
    if (!url || !/^https?:\/\//.test(url)) return '';
    return '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(text || 'öffnen') + '</a>';
  }
  function delta(n) {
    if (n == null || !n) return '';
    return '<span class="rg-d ' + (n > 0 ? 'rg-dp' : 'rg-dm') + '">' + (n > 0 ? '+' : '−') + zahl(Math.abs(n)) + '</span>';
  }
  /* Anteil Werte an (Werte + Sperren) → Farbe zwischen Rot und Grün. */
  function farbe(w, s) {
    if (!w && !s) return null;
    var p = Math.round(100 * w / (w + s));
    return 'color-mix(in srgb, ' + GRUEN + ' ' + p + '%, ' + ROT + ')';
  }

  /* ── Verlauf ─────────────────────────────────────────────────────────── */
  function vergleich() { return D && D.verlauf && D.verlauf.vergleich ? D.verlauf.vergleich : null; }
  function altZelle(L, k) {
    var v = vergleich();
    return v && v.daten && v.daten.zellen && v.daten.zellen[L] ? v.daten.zellen[L][k] || { w: 0, s: 0 } : null;
  }
  function altSumme(k) {
    var v = vergleich();
    return v && v.daten && v.daten.summe ? v.daten.summe[k] || { werte: 0, sperren: 0 } : null;
  }

  /* ── Kopfzahlen ──────────────────────────────────────────────────────── */
  function kopf() {
    var s = D.summe || {};
    var h = '<div class="rg-ks">';
    KZ4.forEach(function (k) {
      var z = s[k] || { werte: 0, sperren: 0 };
      var a = altSumme(k);
      h += '<div class="rg-k"><div class="rg-k-l">' + esc(D.kennzahlen[k]) + '</div>' +
        '<div class="rg-k-v">' + zahl(z.werte) + ' <small>Werte</small>' + (a ? delta(z.werte - a.werte) : '') + '</div>' +
        '<div class="rg-k-s">' + zahl(z.sperren) + ' Sperren · ' + (D.laender_mit_wert[k] || 0) + ' von 16 Ländern mit Wert</div></div>';
    });
    var kauf = D.kostenpflichtig && D.kostenpflichtig.liste ? D.kostenpflichtig.liste.length : 0;
    var neu = 0;
    ((D.ernte && D.ernte.dokumente) || []).forEach(function (r) { if (r.status === 'neu') neu += r.n; });
    h += '<div class="rg-k"><div class="rg-k-l">Kostenpflichtig / genehmigungspflichtig</div>' +
      '<div class="rg-k-v">' + zahl(kauf) + ' <small>Stellen</small></div>' +
      '<div class="rg-k-s">aus vier Fundorten zusammengeführt</div></div>';
    h += '<div class="rg-k"><div class="rg-k-l">Ernte-Eingang</div>' +
      '<div class="rg-k-v">' + zahl(neu) + ' <small>PDFs neu</small></div>' +
      '<div class="rg-k-s">noch nicht ausgewertet</div></div>';
    h += '</div>';

    var v = vergleich(), vl = D.verlauf || {};
    var vt = v
      ? 'Veränderung gegen den Stand vom ' + datum(v.gemessen_am) + (v.vor_monat ? '' : ' (noch kein Stand von vor einem Monat)')
      : (vl.fehler ? 'Verlauf nicht verfügbar: ' + esc(vl.fehler)
        : 'Verlauf beginnt ' + (vl.erster ? 'am ' + datum(vl.erster) : 'heute') + ' — ab morgen steht hier die Veränderung.');
    var db = D.db || {};
    var dbt = db.fehler ? 'Datenbankabgleich nicht möglich: ' + esc(db.fehler)
      : 'Datenbank (mb.param_modell): ' + zahl(db.zeilen) + ' Zeilen, davon ' + zahl(db.deckt) + ' decken einen Dateiwert' +
        (db.ueber_sperre ? ', <b>' + zahl(db.ueber_sperre) + ' über einer Sperre</b>' : '') +
        (db.fremde_url ? ', ' + zahl(db.fremde_url) + ' mit anderer Quelle' : '') +
        (db.ohne_datei ? ', ' + zahl(db.ohne_datei) + ' ohne Datei' : '') +
        (db.datei_ohne_db ? '; ' + zahl(db.datei_ohne_db) + ' Dateiwerte fehlen in der Datenbank' : '') +
        '. Der Bericht liest die Datei; wo beides steht, gewinnt sie.';
    h += '<div class="rg-stand">Gemessen ' + zeit(D.gemessen_am) + ' · ' + zahl(D.saetze) + ' Sätze aus ' +
      zahl(D.dateien.gelesen) + ' Registerdateien' +
      (D.dateien.vermisst ? ' · <b class="rg-rot">' + D.dateien.vermisst + ' nicht lesbar</b>' : '') +
      (D.dateien.nicht_in_liste && D.dateien.nicht_in_liste.length
        ? ' · <b class="rg-rot">' + D.dateien.nicht_in_liste.length + ' Datei(en) im Ordner, aber nicht in der Liste</b>' : '') +
      '<br>' + vt + '<br>' + dbt + '</div>';
    return h;
  }

  /* ── Wärmekarte ──────────────────────────────────────────────────────── */
  function karte() {
    var h = '<h3 class="rg-h">Deckung je Land und Kennzahl</h3>' +
      '<p class="rg-hint">Zelle: <b>Werte</b> / Sperren. Farbe nach Anteil der Werte (grün = alles mit Wert, rot = nur Sperren, grau = nichts hinterlegt). ' +
      'Klick öffnet die Ausschüsse mit Link und Jahrgang.</p>';
    h += '<div class="rg-scroll"><table class="rg-map"><thead><tr><th>Land</th>';
    KZ4.forEach(function (k) { h += '<th>' + esc(D.kennzahlen[k]) + '</th>'; });
    h += '</tr></thead><tbody>';
    D.laender.forEach(function (L) {
      h += '<tr><th title="' + esc(D.land_name[L] || L) + '">' + esc(L) + ' <span>' + esc(D.land_name[L] || '') + '</span></th>';
      KZ4.forEach(function (k) {
        var z = (D.zellen[L] || {})[k];
        var w = z ? z.werte : 0, s = z ? z.sperren : 0;
        var f = farbe(w, s);
        var alt = altZelle(L, k);
        var tip = [];
        if (z) {
          tip.push(z.ausschuesse + ' Ausschüsse');
          if (z.jahr_min) tip.push('Jahrgang ' + (z.jahr_min === z.jahr_max ? z.jahr_min : z.jahr_min + '–' + z.jahr_max));
          if (z.kostenpflichtig) tip.push(z.kostenpflichtig + ' Sätze kostenpflichtig/genehmigungspflichtig');
          if (z.ohne_stichtag) tip.push(z.ohne_stichtag + ' Werte ohne Stichtag');
          if (z.ohne_seite) tip.push(z.ohne_seite + ' Werte ohne Seite');
          if (z.db_werte != null) tip.push('Datenbank: ' + z.db_werte + ' Zeilen, ' + z.db_deckt + ' decken einen Dateiwert');
          Object.keys(z.je_objekt || {}).forEach(function (g) {
            var o = z.je_objekt[g];
            tip.push((D.objektgruppen[g] || g) + ': ' + o.werte + ' / ' + o.sperren);
          });
        }
        var aktiv = offen === L + '|' + k ? ' rg-on' : '';
        h += '<td class="rg-c' + (f ? '' : ' rg-leer') + aktiv + '"' + (f ? ' style="background:' + f + '"' : '') +
          ' data-l="' + L + '" data-k="' + k + '" title="' + esc(tip.join('\n')) + '">' +
          (z ? '<b>' + zahl(w) + '</b> / ' + zahl(s) + (alt ? delta(w - alt.w) : '') +
               (z.kostenpflichtig ? '<i class="rg-euro" title="kostenpflichtig/genehmigungspflichtig">€</i>' : '') +
               (z.jahr_max ? '<em>' + (z.jahr_min === z.jahr_max ? z.jahr_max : z.jahr_min + '–' + z.jahr_max) + '</em>' : '')
             : '–') + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></div><div id="rg-zelle"></div>';
    return h;
  }

  function zelleZeigen(L, k) {
    var box = document.getElementById('rg-zelle');
    if (!box) return;
    if (offen === L + '|' + k) { offen = null; box.innerHTML = ''; markiere(); return; }
    offen = L + '|' + k;
    markiere();
    box.innerHTML = '<p class="rg-hint">lädt …</p>';
    _call('/register/deckung/zelle?land=' + encodeURIComponent(L) + '&kz=' + encodeURIComponent(k))
      .then(function (r) {
        var a = r.ausschuesse || [];
        var z = (D.zellen[L] || {})[k] || {};
        var h = '<div class="rg-box"><div class="rg-box-h">' + esc(D.land_name[L] || L) + ' · ' + esc(D.kennzahlen[k]) +
          ' — ' + a.length + ' Ausschüsse, ' + zahl(z.werte) + ' Werte, ' + zahl(z.sperren) + ' Sperren' +
          (z.ohne_stichtag || z.ohne_seite ? ' · <span class="rg-rot">' + zahl(z.ohne_stichtag) + ' ohne Stichtag, ' + zahl(z.ohne_seite) + ' ohne Seite</span>' : '') +
          ' <button class="rg-x" type="button" data-zu="1">schließen</button></div>';
        if (!a.length) h += '<p class="rg-hint">Für diese Kennzahl führt das Register in diesem Land keinen einzigen Satz — weder Wert noch Sperre.</p>';
        else {
          h += '<table class="data-table rg-tab"><thead><tr><th>Ausschuss</th><th>Werte</th><th>Sperren</th><th>Jahrgang</th><th>Objektarten (Werte/Sperren)</th><th>Quelle</th></tr></thead><tbody>';
          a.forEach(function (e) {
            var obj = Object.keys(e.objekt || {}).map(function (g) {
              return esc(D.objektgruppen[g] || g) + ' ' + e.objekt[g].w + '/' + e.objekt[g].s;
            }).join('<br>');
            h += '<tr><td>' + esc(e.stelle) + (e.kostenpflichtig ? ' <i class="rg-euro">€</i>' : '') +
              '<div class="rg-sub">AGS ' + esc(e.ags.join(', ')) + (e.ags_anzahl > e.ags.length ? ' … (' + e.ags_anzahl + ')' : '') +
              ' · ' + esc(e.dateien.join(', ')) + '</div>' +
              (e.grund ? '<div class="rg-sub rg-grund">' + esc(e.grund) + '</div>' : '') + '</td>' +
              '<td class="rg-n">' + zahl(e.werte) + '</td><td class="rg-n">' + zahl(e.sperren) + '</td>' +
              '<td>' + esc(e.jahrgaenge.join(', ') || '–') + '</td><td class="rg-sub">' + obj + '</td>' +
              '<td>' + (link(e.url, 'Quelle') || '–') + '</td></tr>';
          });
          h += '</tbody></table>';
        }
        box.innerHTML = h + '</div>';
      })
      .catch(function (e) { box.innerHTML = '<p class="rg-hint rg-rot">Konnte nicht geladen werden: ' + esc(e.message) + '</p>'; });
  }
  function markiere() {
    document.querySelectorAll('#view-register .rg-c').forEach(function (td) {
      td.classList.toggle('rg-on', offen === td.getAttribute('data-l') + '|' + td.getAttribute('data-k'));
    });
  }

  /* ── Kostenpflichtig ─────────────────────────────────────────────────── */
  function kauf() {
    var K = D.kostenpflichtig || { liste: [], land_ebene: [], fundorte: {} };
    var laender = {};
    K.liste.forEach(function (e) { laender[e.land] = (laender[e.land] || 0) + 1; });
    var h = '<h3 class="rg-h">Kostenpflichtig oder genehmigungspflichtig</h3>' +
      '<p class="rg-hint">Zusammengeführt aus vier Stellen, je Ausschuss entdoppelt: ' +
      Object.keys(FUNDORT).map(function (f) { return esc(FUNDORT[f]) + ' ' + (K.fundorte[f] || 0); }).join(' · ') +
      '. Wo der Fund nur aus dem Wortlaut stammt, steht die Textstelle dabei — bitte gegenlesen.</p>';
    h += '<div class="rg-filter"><label>Land <select id="rg-f-land"><option value="">alle (' + K.liste.length + ')</option>' +
      Object.keys(laender).sort().map(function (L) { return '<option value="' + esc(L) + '">' + esc(L) + ' (' + laender[L] + ')</option>'; }).join('') +
      '</select></label><label>Art <select id="rg-f-art"><option value="">beide</option><option value="kostenpflichtig">kostenpflichtig</option>' +
      '<option value="genehmigungspflichtig">nur genehmigungspflichtig</option></select></label>' +
      '<label><input type="checkbox" id="rg-f-preis"> nur mit Preis oder Bestellweg</label>' +
      '<input type="search" id="rg-f-such" placeholder="Ausschuss suchen …"><span id="rg-f-n" class="rg-hint"></span></div>';
    h += '<div class="rg-scroll"><table class="data-table rg-tab" id="rg-kauf"><thead><tr><th>Land</th><th>Stelle</th><th>Art</th>' +
      '<th>Kennzahlen</th><th>Preis</th><th>Bestellweg / Quelle</th><th>Kontakt</th><th>Grund</th></tr></thead><tbody>';
    K.liste.forEach(function (e, i) {
      var hatWeg = !!(e.preis || e.bestell_url);
      h += '<tr data-land="' + esc(e.land) + '" data-art="' + esc(e.art) + '" data-weg="' + (hatWeg ? 1 : 0) + '" data-such="' + esc(String(e.stelle).toLowerCase()) + '">' +
        '<td>' + esc(e.land) + '</td>' +
        '<td>' + esc(e.stelle) + '<div class="rg-sub">' + (e.ags.length ? 'AGS ' + esc(e.ags.slice(0, 4).join(', ')) + (e.ags_anzahl > 4 ? ' … (' + e.ags_anzahl + ')' : '') : '') + '</div>' +
        '<div class="rg-sub">' + e.fundorte.map(function (f) { return '<span class="rg-tag">' + esc(FUNDORT[f] || f) + '</span>'; }).join(' ') + '</div></td>' +
        '<td><span class="rg-art rg-art-' + esc(e.art) + '">' + esc(e.art) + '</span></td>' +
        '<td>' + e.kennzahlen.map(function (k) { return esc(D.kennzahlen[k] || k); }).join('<br>') + '</td>' +
        '<td>' + esc(e.preis || '–') + '</td>' +
        '<td>' + [link(e.bestell_url, 'bestellen'), e.quelle_url !== e.bestell_url ? link(e.quelle_url, 'Quelle') : ''].filter(Boolean).join(' · ') + '</td>' +
        '<td class="rg-sub">' + esc(e.kontakt || '–') + '</td>' +
        '<td class="rg-sub rg-grund">' + esc(e.grund || '') +
          (e.erkannt_aus && e.fundorte.indexOf('register_zugang') < 0 ? '<div class="rg-fund">erkannt an: „' + esc(e.erkannt_aus) + '“</div>' : '') + '</td></tr>';
    });
    h += '</tbody></table></div>';
    if (K.land_ebene && K.land_ebene.length) {
      h += '<p class="rg-hint" style="margin-top:12px"><b>Landesebene</b> (Quellenliste): ' + K.land_ebene.map(function (l) {
        return esc(l.land) + ' — ' + esc(l.zugang) + (l.url ? ' (' + link(l.url, 'Portal') + ')' : '');
      }).join(' · ') + '</p>';
    }
    return h;
  }
  function filtern() {
    var L = (document.getElementById('rg-f-land') || {}).value || '';
    var A = (document.getElementById('rg-f-art') || {}).value || '';
    var P = (document.getElementById('rg-f-preis') || {}).checked;
    var S = String((document.getElementById('rg-f-such') || {}).value || '').toLowerCase().trim();
    var n = 0;
    document.querySelectorAll('#rg-kauf tbody tr').forEach(function (tr) {
      var ok = (!L || tr.getAttribute('data-land') === L) && (!A || tr.getAttribute('data-art') === A) &&
        (!P || tr.getAttribute('data-weg') === '1') && (!S || tr.getAttribute('data-such').indexOf(S) >= 0);
      tr.style.display = ok ? '' : 'none';
      if (ok) n++;
    });
    var o = document.getElementById('rg-f-n');
    if (o) o.textContent = n + ' angezeigt';
  }

  /* ── Ernte-Eingang ───────────────────────────────────────────────────── */
  function ernte() {
    var E = D.ernte || {};
    var h = '<h3 class="rg-h">Ernte-Eingang</h3>';
    if (E.fehler) return h + '<p class="rg-hint rg-rot">Nicht lesbar: ' + esc(E.fehler) + '</p>';
    var t = E.takt || {};
    var l = t.letzter_lauf;
    h += '<p class="rg-hint">Hintergrund-Takt ' + (t.an === false ? '<b class="rg-rot">aus</b>' : 'an, alle ' + (t.takt_stunden || 6) + ' Stunden') + '. ' +
      (l ? 'Letzter Durchgang ' + zeit(l.ende) + (l.abbruch ? ' — <span class="rg-rot">abgebrochen: ' + esc(l.abbruch) + '</span>'
            : ': ' + zahl(l.geprueft) + ' Quellen geprüft, ' + zahl(l.neu) + ' neue PDFs' + (l.fehler ? ', ' + zahl(l.fehler) + ' Fehler' : ''))
         : 'Seit dem letzten Neustart noch kein Durchgang; zuletzt geprüfte Quelle: ' + zeit(t.letzter_check_quellen) + '.') +
      ' Gefundene PDFs liegen in mb.gaa_documents und werden nicht automatisch ins Register übernommen.</p>';

    var st = {}, la = {};
    (E.dokumente || []).forEach(function (r) {
      st[r.status] = 1;
      (la[r.land] || (la[r.land] = {}))[r.status] = r.n;
    });
    var stati = Object.keys(st).sort();
    if (stati.length) {
      h += '<div class="rg-scroll"><table class="data-table rg-tab rg-eng"><thead><tr><th>Land</th>' +
        stati.map(function (s) { return '<th>' + esc(s) + '</th>'; }).join('') + '</tr></thead><tbody>';
      Object.keys(la).sort().forEach(function (L) {
        h += '<tr><td>' + esc(L) + '</td>' + stati.map(function (s) { return '<td class="rg-n">' + (la[L][s] ? zahl(la[L][s]) : '') + '</td>'; }).join('') + '</tr>';
      });
      h += '</tbody></table></div>';
    } else h += '<p class="rg-hint">Noch keine PDFs gefunden.</p>';

    if ((E.neueste || []).length) {
      h += '<details class="rg-det"><summary>Zuletzt gefunden (' + E.neueste.length + ')</summary><table class="data-table rg-tab"><thead><tr><th>gefunden</th><th>Land</th><th>Quelle</th><th>Dokument</th><th>Jahrgang</th><th>Status</th></tr></thead><tbody>' +
        E.neueste.map(function (r) {
          return '<tr><td>' + datum(r.gefunden_am) + '</td><td>' + esc(r.land) + '</td><td>' + esc(r.quelle) + '</td><td>' +
            (link(r.url, r.titel || 'PDF') || esc(r.titel || '')) + '</td><td>' + esc(r.jahrgang || '–') + '</td><td>' + esc(r.status) + '</td></tr>';
        }).join('') + '</tbody></table></details>';
    }
    if ((E.defekt || []).length) {
      h += '<details class="rg-det"><summary>Portal defekt (' + E.defekt.length + ') — der Takt kommt dort nicht an</summary><table class="data-table rg-tab"><thead><tr><th>Land</th><th>Quelle</th><th>zuletzt geprüft</th><th>Portal</th><th>Notiz</th></tr></thead><tbody>' +
        E.defekt.map(function (r) {
          return '<tr><td>' + esc(r.land) + '</td><td>' + esc(r.name) + '</td><td>' + datum(r.letzter_check) + '</td><td>' +
            (link(r.portal_url, 'Portal') || '–') + '</td><td class="rg-sub">' + esc(r.notiz || '') + '</td></tr>';
        }).join('') + '</tbody></table></details>';
    }
    return h;
  }

  function zeichne(d) {
    D = d;
    var body = document.getElementById('rg-body');
    if (!body) return;
    body.innerHTML = kopf() + karte() + kauf() + ernte();
    body.querySelectorAll('.rg-c').forEach(function (td) {
      if (td.classList.contains('rg-leer') && td.textContent === '–') { /* trotzdem klickbar: zeigt „kein Satz" */ }
      td.addEventListener('click', function () { zelleZeigen(td.getAttribute('data-l'), td.getAttribute('data-k')); });
    });
    body.addEventListener('click', function (ev) {
      if (ev.target && ev.target.getAttribute && ev.target.getAttribute('data-zu')) {
        offen = null; document.getElementById('rg-zelle').innerHTML = ''; markiere();
      }
    });
    ['rg-f-land', 'rg-f-art', 'rg-f-preis'].forEach(function (id) {
      var el = document.getElementById(id); if (el) el.addEventListener('change', filtern);
    });
    var su = document.getElementById('rg-f-such'); if (su) su.addEventListener('input', filtern);
    filtern();
  }

  function stil() {
    if (document.getElementById('rg-css')) return;
    var s = document.createElement('style');
    s.id = 'rg-css';
    s.textContent =
      '#view-register .rg-ks{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:12px}' +
      '#view-register .rg-k{padding:14px 16px;background:var(--bg-card,#fff);border:1px solid var(--border,#e5dfd2);border-left:3px solid ' + GOLD + ';border-radius:8px}' +
      '#view-register .rg-k-l{font-size:12px;color:var(--text-muted,#6a6a6a);text-transform:uppercase;letter-spacing:.04em}' +
      '#view-register .rg-k-v{font-size:24px;font-weight:600;color:var(--text,#1a1a1a);margin-top:4px}' +
      '#view-register .rg-k-v small{font-size:12px;font-weight:400;color:var(--text-muted,#6a6a6a)}' +
      '#view-register .rg-k-s{font-size:12px;color:var(--text-muted,#6a6a6a);margin-top:2px}' +
      '#view-register .rg-stand{font-size:12px;color:var(--text-muted,#6a6a6a);line-height:1.6;margin:6px 0 4px}' +
      '#view-register .rg-h{margin:26px 0 6px;font-size:15px}' +
      '#view-register .rg-hint{font-size:12.5px;color:var(--text-muted,#6a6a6a);margin:0 0 10px;max-width:900px}' +
      '#view-register .rg-rot{color:#B8625C}' +
      '#view-register .rg-scroll{overflow-x:auto;max-width:100%}' +
      '#view-register .rg-map{border-collapse:separate;border-spacing:3px;font-size:13px;min-width:560px}' +
      '#view-register .rg-map th{font-size:11.5px;font-weight:600;text-align:left;padding:4px 8px;color:var(--text-muted,#6a6a6a);white-space:nowrap}' +
      '#view-register .rg-map tbody th{color:var(--text,#1a1a1a)}' +
      '#view-register .rg-map tbody th span{font-weight:400;color:var(--text-muted,#6a6a6a)}' +
      '#view-register .rg-c{min-width:118px;padding:7px 9px;border-radius:5px;color:#fff;cursor:pointer;white-space:nowrap;position:relative}' +
      '#view-register .rg-c b{font-size:14.5px}' +
      '#view-register .rg-c em{display:block;font-style:normal;font-size:10.5px;opacity:.85}' +
      '#view-register .rg-c.rg-leer{background:#ECE8E0;color:#8a8478}' +
      '#view-register .rg-c:hover{filter:brightness(1.08)}' +
      '#view-register .rg-c.rg-on{outline:2px solid ' + GOLD + ';outline-offset:1px}' +
      '#view-register .rg-euro{font-style:normal;font-size:10.5px;margin-left:6px;padding:0 4px;border-radius:3px;background:rgba(0,0,0,.22)}' +
      '#view-register .rg-d{font-size:11px;margin-left:6px;padding:0 4px;border-radius:3px}' +
      '#view-register .rg-dp{background:rgba(63,165,108,.18);color:#2c7a4f}' +
      '#view-register .rg-c .rg-dp,#view-register .rg-c .rg-dm{background:rgba(0,0,0,.22);color:#fff}' +
      '#view-register .rg-dm{background:rgba(184,98,92,.15);color:#B8625C}' +
      '#view-register .rg-box{margin-top:12px;padding:12px 14px;background:var(--bg-card,#fff);border:1px solid var(--border,#e5dfd2);border-radius:8px}' +
      '#view-register .rg-box-h{font-weight:600;margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
      '#view-register .rg-x{margin-left:auto;border:1px solid var(--border,#e5dfd2);background:transparent;border-radius:5px;padding:3px 10px;cursor:pointer;font-size:12px}' +
      '#view-register .rg-tab td{vertical-align:top;font-size:12.5px;padding:8px 10px}' +
      '#view-register .rg-tab th{font-size:11.5px;padding:8px 10px}' +
      '#view-register .rg-n{text-align:right;white-space:nowrap}' +
      '#view-register .rg-sub{font-size:11.5px;color:var(--text-muted,#6a6a6a);margin-top:2px}' +
      '#view-register .rg-grund{max-width:420px}' +
      '#view-register .rg-fund{margin-top:4px;font-style:italic}' +
      '#view-register .rg-tag{display:inline-block;padding:0 6px;border-radius:3px;font-size:10.5px;background:color-mix(in srgb, ' + GOLD + ' 16%, transparent);margin:1px 0}' +
      '#view-register .rg-art{padding:2px 8px;border-radius:10px;font-size:11px;white-space:nowrap}' +
      '#view-register .rg-art-kostenpflichtig{background:rgba(184,98,92,.14);color:#9a4a44}' +
      '#view-register .rg-art-genehmigungspflichtig{background:#ECE8E0;color:#5e584c}' +
      '#view-register .rg-filter{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:0 0 10px;font-size:12.5px}' +
      '#view-register .rg-filter select,#view-register .rg-filter input[type=search]{padding:4px 8px;border:1px solid var(--border,#e5dfd2);border-radius:5px;font-size:12.5px;background:#fff}' +
      '#view-register .rg-det{margin-top:12px}' +
      '#view-register .rg-det summary{cursor:pointer;font-size:13px;font-weight:600;margin-bottom:6px}' +
      '#view-register a{color:var(--wl-b8932f, #b8932f)}' +
      '@media (max-width:640px){#view-register .rg-c{min-width:92px;padding:6px}#view-register .rg-map tbody th span{display:none}}';
    document.head.appendChild(s);
  }

  function laden(still) {
    var body = document.getElementById('rg-body');
    if (!body) return;
    if (!still) body.innerHTML = '<p class="rg-hint">wird geladen … (das Register wird dafür ganz durchgezählt, einige Sekunden)</p>';
    stil();
    return _call('/register/deckung')
      .then(function (d) { zeichne(d || {}); geladen = true; })
      .catch(function (e) {
        body.innerHTML = '<p class="rg-hint rg-rot">Konnte nicht geladen werden: ' + esc(e.message) + '</p>';
      });
  }

  function init() {
    var link = document.querySelector('.nav-link[data-view="register"]');
    if (link) link.addEventListener('click', function () { setTimeout(function () { if (!geladen) laden(); }, 30); });
    var neu = document.getElementById('rg-neu');
    if (neu) neu.addEventListener('click', function (e) { e.preventDefault(); laden(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.AdminRegister = { laden: laden, zeichne: function (d) { stil(); zeichne(d); } };
})();
