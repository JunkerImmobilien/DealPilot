// admin-betrieb.js — v4880 · Reiter „Betrieb“: Zustand des Servers, Sicherheit, Sicherungen
//
// Marcel 25.11.2026: „wann wir größere Server brauchen, ob wir Sicherheitslücken haben, wie Backups
// laufen, und wenn alles zusammenstürzt, dass wir es wieder herstellen können“.
// NUR LESEND. Daten: GET /api/v1/admin/betrieb (Host-Takt tools/server/betrieb-sammeln.py,
// Bewertung backend/src/services/betrieb.js). Notfall-Anleitung: claude/notfall-wiederherstellung.md
(function () {
  'use strict';
  var BASE = '/api/v1/admin';
  var FARBE = { rot: '#B8625C', gelb: 'var(--wl-b8932f, #b8932f)', gruen: '#3FA56C' };
  var WORT = { rot: 'Rot', gelb: 'Gelb', gruen: 'Grün' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function gb(b) { return b == null ? '–' : (b / 1e9).toFixed(1).replace('.', ',') + ' GB'; }
  function mb(b) { return b == null ? '–' : Math.round(b / 1e6).toLocaleString('de-DE') + ' MB'; }
  function zeit(t) { if (!t) return '–'; var d = new Date(t); return isNaN(d) ? esc(t) : d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function punkt(st) { return '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + FARBE[st] + ';margin-right:6px;vertical-align:middle"></span>'; }
  function karte(titel, inhalt) { return '<div style="background:#fff;border:1px solid #e3ddcf;border-radius:10px;padding:14px 16px;min-width:0">' + '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#7a7468;margin-bottom:8px">' + esc(titel) + '</div>' + inhalt + '</div>'; }
  function zeilen(rows) { return '<table style="width:100%;border-collapse:collapse;font-size:13px">' + rows.map(function (r) { return '<tr><td style="padding:3px 0;color:#5a554c">' + esc(r[0]) + '</td><td style="padding:3px 0;text-align:right;font-variant-numeric:tabular-nums">' + r[1] + '</td></tr>'; }).join('') + '</table>'; }

  function spark(reihe, feld, max, farbe) {
    var w = 260, h = 46, p = reihe.filter(function (r) { return typeof r[feld] === 'number'; });
    if (p.length < 2) return '<div style="font-size:12px;color:#7a7468">noch kein Verlauf</div>';
    var pts = p.map(function (r, i) { return (i * (w / (p.length - 1))).toFixed(1) + ',' + (h - Math.min(1, r[feld] / max) * h).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" style="width:100%;height:46px;display:block"><polyline fill="none" stroke="' + farbe + '" stroke-width="1.6" points="' + pts + '"/></svg>';
  }

  function render(d) {
    var el = document.getElementById('betrieb-inhalt');
    if (!el) return;
    var b = d.bewertung || { punkte: [], handlungsbedarf: [], kennzahlen: {} }, m = d.messung || {}, k = b.kennzahlen || {};
    var bereich = function (n) { return b.punkte.filter(function (p) { return p.bereich === n; }); };
    var liste = function (arr) { return arr.map(function (p) { return '<div style="font-size:13px;margin:4px 0">' + punkt(p.stufe) + esc(p.text) + (p.rat && p.stufe !== 'gruen' ? '<div style="font-size:12px;color:#7a7468;margin-left:16px">' + esc(p.rat) + '</div>' : '') + '</div>'; }).join(''); };
    var h = k.hochrechnung || {};
    var pl = m.platte || {}, sp = m.speicher || {}, la = m.last || {}, u = m.updates || {}, s = m.sicherung || {};
    var dk = (m.docker || {})['Build Cache'] || {};
    var kopf = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
      + '<div style="font-size:20px;font-weight:600">' + punkt(b.gesamt) + 'Server ' + esc(d.server) + ': ' + WORT[b.gesamt] + '</div>'
      + '<div style="font-size:12px;color:#7a7468">Stand ' + zeit(d.stand) + (u.system ? ' · ' + esc(u.system) : '') + ' · Mails ' + (d.mail_scharf ? 'an' : 'aus (trocken)') + '</div>'
      + '<a href="' + BASE + '/betrieb/mail-vorschau" target="_blank" rel="noopener" data-bt-vorschau style="margin-left:auto;font-size:12px">Mail-Vorschau</a></div>';
    var hb = b.handlungsbedarf.length
      ? karte('Handlungsbedarf', liste(b.handlungsbedarf))
      : karte('Handlungsbedarf', '<div style="font-size:13px">' + punkt('gruen') + 'Nichts zu tun.</div>');
    var kunden = (d.kunden || []).map(function (x) { return [x.plan, x.anzahl]; });
    var gitter = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:12px">'
      + karte('Platte und Wachstum', zeilen([['Belegt', (pl.pct != null ? String(pl.pct).replace('.', ',') + ' %' : '–') + ' von ' + gb(pl.gesamt)], ['Frei', gb(pl.frei)], ['Build-Zwischenspeicher', esc(dk.groesse || '–') + (dk.frei_machbar ? ' (frei machbar ' + esc(dk.frei_machbar) + ')' : '')], ['Wachstum je Tag', h.je_tag != null ? mb(h.je_tag) : '–'], ['85 % erreicht in', h.monate_85 != null ? String(h.monate_85).replace('.', ',') + ' Monaten' : esc(h.grund || '–')]]) + spark(d.reihe || [], 'platte', 100, '#5a554c') + liste(bereich('platte').concat(bereich('wachstum'))))
      + karte('Speicher und Last', zeilen([['Arbeitsspeicher jetzt', (sp.pct != null ? String(sp.pct).replace('.', ',') + ' %' : '–') + ' von ' + gb(sp.gesamt)], ['Schnitt 7 Tage', k.ram_7 != null ? String(k.ram_7).replace('.', ',') + ' %' : '–'], ['Last je Kern jetzt', la.kerne ? String((la.l1 / la.kerne).toFixed(2)).replace('.', ',') + ' (' + la.kerne + ' Kerne)' : '–'], ['Schnitt 7 Tage', k.last_7 != null ? String(k.last_7).replace('.', ',') : '–']]) + spark(d.reihe || [], 'ram', 100, '#5a554c') + liste(bereich('speicher').concat(bereich('last'))))
      + karte('Daten', zeilen([['Haupt-Datenbank', mb((m.db || {}).haupt) + (k.db_woche ? ' (' + (k.db_woche.haupt >= 0 ? '+' : '') + mb(k.db_woche.haupt) + ' / Woche)' : '')], ['Marktbericht-Datenbank', mb((m.db || {}).marktbericht) + (k.db_woche ? ' (' + (k.db_woche.marktbericht >= 0 ? '+' : '') + mb(k.db_woche.marktbericht) + ' / Woche)' : '')], ['Dateien (Fotos, Ablage)', mb(m.uploads)]].concat(kunden.length ? [['Kunden je Plan', '']].concat(kunden.map(function (x) { return ['  ' + x[0], x[1]]; })) : [])))
      + karte('Sicherheit', liste(bereich('updates').concat(bereich('neustart'), bereich('ports'), bereich('tls'), bereich('images'), bereich('audit'))))
      + karte('Sicherungen', zeilen([['Nachtsicherung Haupt', ((s.haupt || [])[0] ? mb(s.haupt[0].groesse) + ' · ' + zeit(s.haupt[0].zeit) : '–')], ['Nachtsicherung Marktbericht', ((s.marktbericht || [])[0] ? mb(s.marktbericht[0].groesse) : '–')], ['Nachtsicherung Dateien', ((s.uploads || [])[0] ? mb(s.uploads[0].groesse) : '–')], ['Sicherungen vor Rollouts', (s.hand_anzahl != null ? s.hand_anzahl + ' Stück, ' + gb(s.hand_groesse) : '–')], ['Letzte Probe', d.probe ? zeit(d.probe.erfasst_am) + ' · ' + (d.probe.daten && d.probe.daten.bestanden ? 'bestanden' : 'NICHT bestanden') : 'noch keine']]) + liste(bereich('sicherung').concat(bereich('probe'), bereich('konfig'), bereich('messung'))))
      + '</div>';
    el.innerHTML = kopf + hb + gitter + '<p style="font-size:12px;color:#7a7468;margin-top:14px">Notfall-Anleitung: claude/notfall-wiederherstellung.md im Repo. Gesammelt stündlich auf dem Server, Wiederherstellungsprobe monatlich.</p>';
    var v = el.querySelector('[data-bt-vorschau]');
    if (v) v.addEventListener('click', function (e) { e.preventDefault(); oeffneVorschau(); });
  }

  function oeffneVorschau() {
    fetch(BASE + '/betrieb/mail-vorschau', { headers: { 'X-Admin-Token': localStorage.getItem('dp_admin_token') || '' } })
      .then(function (r) { return r.text(); })
      .then(function (html) { var w = window.open('', '_blank'); if (w) { w.document.open(); w.document.write(html); w.document.close(); } });
  }

  function laden() {
    var el = document.getElementById('betrieb-inhalt');
    if (el) el.innerHTML = '<div style="font-size:13px;color:#7a7468">lädt …</div>';
    fetch(BASE + '/betrieb', { headers: { 'X-Admin-Token': localStorage.getItem('dp_admin_token') || '' } })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); })
      .then(render)
      .catch(function (e) { if (el) el.innerHTML = '<div style="color:#B8625C;font-size:13px">' + esc(e.message) + '</div>'; });
  }

  function init() {
    var link = document.querySelector('.nav-link[data-view="betrieb"]');
    if (link) link.addEventListener('click', function () { setTimeout(laden, 30); });
  }
  window._betriebLaden = laden;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
