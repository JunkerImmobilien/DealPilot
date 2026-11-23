/* ═══ js/jahresabschluss.js — v4100 · ASSISTENT JAHRESABSCHLUSS ═══════════════════════════════════════════════
 *
 * Marcel 23.11.2026: „Man kommt vom Schritt 1 Miete, das ist ein Modal, dort kann man alles eingeben, einfach, und achte
 * auf die User Experience, und dann weiter über alle Schritte bis zur Festschreibung.“ Dazu: „bei einer ViVi-Anbindung
 * den Abgleich machen“ und „schauen, ob wir schon im neuen Jahr sind und für das Jahr komplett alles fertig machen“.
 *
 * EIN Fenster je vergangenem Jahr, fünf Schritte: 1 Miete · 2 Wert · 3 Haus & Belege · 4 Steuer · 5 Festschreiben.
 * Gestartet über „<Jahr> fertig machen“ und über jeden Schritt-Knopf des Jahresabgleichs (jahresabgleich.js), dann
 * öffnet es beim jeweiligen Schritt. Nichts wird hier neu gerechnet oder doppelt gebaut:
 *   · Stand je Schritt        DpJahresabgleich.standFuer (dieselbe Rechnung wie die Leiste im Reiter)
 *   · Schritt 1 Eingabe       DpJahresbuch.eingabeHtml / eingabeBinden (dieselben Felder, dieselbe Sperre v4090)
 *   · Schritt 3 Belege        DpEingang.jahresInRahmen (Reiter „Belege je Jahr“, bei ViVi mit Gegenüberstellung)
 *   · Schritt 4 Anlage V      _computeYearTotal (tax.js), Stand über DpJahresbuch.statusSetzen
 *   · Schritt 5               DpJahresbuch.festSetzen, nur nach Rückfrage, mit Protokoll
 * ViVi wird beim Öffnen einmal je Objekt und Jahr gelesen (nur GET). Festgeschriebene Jahre schreibt der Abgleich nicht.
 * Der Fortschritt (Schritt je Objekt und Jahr) bleibt beim Schließen erhalten. Esc schließt.
 * Kundentext ohne Gedankenstrich und Semikolon.
 * ════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var VERSION = 'v4100';
  var SCHRITTE = [['miete', 'Miete'], ['wert', 'Wert'], ['haus', 'Haus & Belege'], ['steuer', 'Steuer'], ['fest', 'Festschreiben']];
  var _z = null;                 /* { jahr, k, frage, vivi: 'laeuft' | null } */
  var _merk = {}, _gelesen = {}; /* Schritt je Objekt|Jahr · ViVi schon gelesen je Objekt|Jahr */

  function doc() { return global.document || null; }
  function $(id) { var d = doc(); return d ? d.getElementById(id) : null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function istZahl(v) { return typeof v === 'number' && isFinite(v); }
  function eur(v) { return istZahl(v) ? Math.round(v).toLocaleString('de-DE') + ' €' : '–'; }
  function vz(v) { return istZahl(v) ? (v > 0 ? '+' : v < 0 ? '−' : '±') + eur(Math.abs(v)) : ''; }
  function datumText(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function heuteJahr() { return new Date().getFullYear(); }
  function JA() { return global.DpJahresabgleich || null; }
  function JB() { return global.DpJahresbuch || null; }
  function schluessel(j) { return (global._currentObjKey || '') + '|' + j; }
  function jahrDaten(j) { try { return ((global._currentObjData || {})._jahre || {})[String(j)] || {}; } catch (e) { return {}; } }
  function toast(t) { try { if (typeof global.toast === 'function') global.toast(t); } catch (e) {} }
  function knopf(a, t, haupt, extra) { return '<button type="button" class="dp-jab-k' + (haupt ? ' haupt' : '') + '" data-jab="' + a + '"' + (extra || '') + '>' + t + '</button>'; }

  function lage() {
    var a = JA(), r = a && a.standFuer ? a.standFuer(_z.jahr) : null;
    if (!r) return null;
    r.st = {};
    SCHRITTE.forEach(function (x) { r.st[x[0]] = x[0] === 'fest' ? (r.s.nFest === 4 ? 'ok' : (r.s.n === 4 ? 'bereit' : 'offen')) : (r.s.fest && r.s.fest[x[0]] ? 'fest' : r.s[x[0]]); });
    return r;
  }
  /** Rein: Startschritt. Ohne Wunsch der erste offene, sonst Festschreiben. */
  function startSchritt(s, wunsch, gemerkt) {
    if (wunsch && SCHRITTE.some(function (x) { return x[0] === wunsch; })) return wunsch;
    if (gemerkt) return gemerkt;
    if (!s) return 'miete';
    if (s.nFest === 4) return 'fest';
    var o = SCHRITTE.filter(function (x) { return x[0] !== 'fest' && s[x[0]] !== 'ok'; })[0];
    return o ? o[0] : 'fest';
  }

  /* ── Stil ──────────────────────────────────────────────────────────── */
  function stil() {
    var d = doc(); if (!d || $('dp-jab-stil')) return;
    var G = 'var(--wl-c9a84c, #C9A84C)', T = 'var(--ch, #2A2727)', M = 'var(--muted, #7A7370)', L = 'var(--border, #E7E2DC)';
    var s = d.createElement('style'); s.id = 'dp-jab-stil';
    s.textContent = [
      '.dp-jab-ov{position:fixed;inset:0;background:rgba(20,18,16,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px}',
      '.dp-jab{background:var(--surface, #F8F6F1);color:' + T + ';border:1px solid color-mix(in srgb, ' + G + ' 35%, transparent);border-radius:16px;width:min(820px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.35);font:400 13.5px/1.5 Inter,system-ui,sans-serif}',
      '.dp-jab-kopf{display:flex;align-items:baseline;gap:10px;padding:16px 20px 4px}.dp-jab-kopf b{font:600 17px "Space Grotesk",Inter,sans-serif}.dp-jab-kopf small{color:' + M + ';font-size:12px}',
      '.dp-jab-kopf button{margin-left:auto;align-self:center;border:0;background:none;font-size:22px;line-height:1;cursor:pointer;color:' + M + ';min-width:40px;min-height:40px}',
      '.dp-jab-leiste{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;list-style:none;margin:0;padding:6px 20px 12px;border-bottom:1px solid color-mix(in srgb, ' + G + ' 25%, transparent)}',
      '.dp-jab-leiste button{width:100%;display:flex;flex-direction:column;align-items:center;gap:3px;border:0;background:none;cursor:pointer;padding:4px 2px;color:' + M + ';font:600 11.5px/1.2 Inter,system-ui,sans-serif;text-align:center}',
      '.dp-jab-leiste i{font-style:normal;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;border:1.5px solid ' + L + ';background:#fff;font-size:12px;color:' + M + '}',
      '.dp-jab-leiste .ok i,.dp-jab-leiste .fest i{background:#3FA56C;border-color:#3FA56C;color:#fff}',
      '.dp-jab-leiste .teil i{border-color:' + G + ';color:' + T + '}',
      '.dp-jab-leiste .an{color:' + T + '}.dp-jab-leiste .an i{box-shadow:0 0 0 3px color-mix(in srgb, ' + G + ' 40%, transparent);border-color:' + G + '}',
      '.dp-jab-inhalt{padding:14px 20px;overflow:auto;flex:1 1 auto}',
      '.dp-jab-inhalt h4{margin:0 0 4px;font:600 15px "Space Grotesk",Inter,sans-serif}',
      '.dp-jab-satz{margin:0 0 12px;color:' + T + '}.dp-jab-satz small{display:block;color:' + M + ';font-size:12px;margin-top:2px}',
      '.dp-jab-zahl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px}',
      '.dp-jab-zahl span{background:#fff;border:1px solid ' + L + ';border-radius:10px;padding:8px 10px;font-size:11.5px;color:' + M + '}',
      '.dp-jab-zahl b{display:block;font-size:16px;color:' + T + ';font-variant-numeric:tabular-nums;margin-top:2px}',
      '.dp-jab-box{border:1px solid ' + L + ';background:#fff;border-radius:10px;padding:10px 12px;margin:0 0 12px}',
      '.dp-jab-box.gold{border-color:' + G + ';background:var(--gold-bg, color-mix(in srgb, ' + G + ' 6%, #fff))}',
      '.dp-jab-box.rot{border-color:#B8625C;background:color-mix(in srgb, #B8625C 6%, #fff)}',
      '.dp-jab-liste{list-style:none;margin:0 0 12px;padding:0}.dp-jab-liste li{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid rgba(42,39,39,.07)}',
      '.dp-jab-liste li:first-child{border-top:0}.dp-jab-ok{color:#3FA56C;font-weight:600}.dp-jab-offen{color:#B8625C;font-weight:600}',
      '.dp-jab-reihe{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}',
      '.dp-jab-k{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid ' + L + ';border-radius:8px;background:#fff;font:600 12.5px Inter,system-ui,sans-serif;color:' + T + ';cursor:pointer;min-height:36px}',
      '.dp-jab-k.haupt{background:' + G + ';border-color:' + G + ';color:#fff}',
      '.dp-jab-k[disabled]{opacity:.55;cursor:default}',
      '.dp-jab-fuss{display:flex;align-items:center;gap:10px;padding:12px 20px;border-top:1px solid ' + L + '}',
      '.dp-jab-fuss span{flex:1;text-align:center;color:' + M + ';font-size:12px}',
      '.dp-jab-lesen{font-size:12px;color:' + M + ';margin:0 0 10px}',
      '.dp-jab select{font:inherit;padding:7px 10px;border:1px solid ' + L + ';border-radius:8px;background:#fff;min-height:36px}',
      '.dp-jab .dp-jb-inline{margin:0 0 12px}',
      '@media (max-width:640px){.dp-jab-ov{padding:0;align-items:stretch}.dp-jab{max-height:none;height:100%;border-radius:0;width:100%}',
      '.dp-jab-kopf{padding:12px 14px 2px}.dp-jab-leiste{padding:4px 8px 10px}.dp-jab-leiste .w{font-size:10px}.dp-jab-inhalt{padding:12px 14px}',
      '.dp-jab-fuss{padding:10px 14px calc(10px + env(safe-area-inset-bottom))}.dp-jab-zahl{grid-template-columns:1fr 1fr}.dp-jab-zahl span:last-child{grid-column:1/-1}}'
    ].join('\n');
    d.head.appendChild(s);
  }

  /* ── Schritte ──────────────────────────────────────────────────────── */
  function viviZeile(J) {
    var a = JA();
    if (!a || !a.viviVerknuepft || !a.viviVerknuepft()) return '';
    if (_z.vivi === 'laeuft') return '<p class="dp-jab-lesen">ViVi wird gelesen …</p>';
    return '';
  }
  function schrittMiete(r) {
    var J = _z.jahr, z = r.z, e = jahrDaten(J), vivi = e.nkm_j_vivi != null && e.nkm_j_vivi !== '' && istZahl(Number(e.nkm_j_vivi)) ? Number(e.nkm_j_vivi) : null;
    var plan = z.miete_plan != null ? z.miete_plan : z.miete_proj, herkunft = z.miete_eigen ? 'von dir eingetragen' : (z.miete_vivi ? 'aus dem ViVi-Mietverlauf' : 'gerechnet aus der Miete heute und den Mieterhöhungen');
    var h = '<h4>Miete ' + J + '</h4><p class="dp-jab-satz">Trag ein, was ' + J + ' wirklich an Kaltmiete eingegangen ist. Leerstand und Restschuld gehören dazu.<small>Heute steht dort ' + eur(z.miete_ist) + ', ' + herkunft + '.</small></p>';
    h += '<div class="dp-jab-zahl"><span>Kaltmiete ' + J + '<b>' + eur(z.miete_ist) + '</b></span><span>' + (z.miete_plan != null ? 'Plan vom Kauf' : 'Projektion') + '<b>' + eur(plan) + '</b></span><span>Abstand<b>' + (istZahl(plan) && istZahl(z.miete_ist) ? vz(z.miete_ist - plan) : '–') + '</b></span></div>';
    if (vivi != null && z.miete_eigen && Math.abs(vivi - z.miete_ist) >= 1) h += '<div class="dp-jab-box gold">Laut ViVi-Mietverlauf ' + eur(vivi) + ' im Jahr. Deine Angabe ' + eur(z.miete_ist) + ' gilt.<div class="dp-jab-reihe" style="margin:8px 0 0">' + knopf('vivi-miete', 'ViVi übernehmen', false) + '</div></div>';
    else if (vivi != null && z.miete_vivi) h += '<div class="dp-jab-box">Die Ist-Miete kommt aus dem ViVi-Mietverlauf. Weicht sie ab, trag die echte Summe unten ein.</div>';
    h += '<div data-jab-eingabe></div>';
    h += '<div class="dp-jab-reihe">' + knopf('erh', 'Mieterhöhung im Jahr eintragen', false) + '</div>';
    return h;
  }
  function schrittWert(r) {
    var J = _z.jahr, z = r.z, fest = r.s.fest && r.s.fest.wert;
    var h = '<h4>Wert ' + J + '</h4>';
    if (z.mb) h += '<p class="dp-jab-satz">Für ' + J + ' liegt ein Marktbericht vor.</p><div class="dp-jab-zahl"><span>Wert laut Bericht<b>' + eur(z.mb.wert) + '</b></span><span>Bericht vom<b>' + esc(datumText(z.mb.am)) + '</b></span><span>Stand<b>erledigt</b></span></div>';
    else if (fest) h += '<p class="dp-jab-satz">Für ' + J + ' gibt es keinen Marktbericht. Der Schritt ist abgeschlossen.</p>';
    else h += '<p class="dp-jab-satz">Für ' + J + ' liegt kein Marktbericht vor.<small>Ein neuer Bericht zählt für das laufende Jahr. Gab es ' + J + ' keinen, schließ den Schritt so ab.</small></p>'
      + '<div class="dp-jab-reihe">' + knopf('wert-nein', 'Kein Bericht für ' + J + ', Schritt abschließen', true) + knopf('wert-abrufen', 'Marktbericht abrufen', false) + '</div>';
    return h;
  }
  function schrittHaus(r) {
    var J = _z.jahr, h0 = r.s._haus || {}, a = JA(), mitVivi = a && a.viviVerknuepft && a.viviVerknuepft();
    var h = '<h4>Haus & Belege ' + J + '</h4>';
    if (r.weg) {
      h += '<p class="dp-jab-satz">Protokoll und Abrechnung der Eigentümerversammlung hochladen. DealPilot liest Hausgeld, Rücklage und Beschlüsse daraus.</p>';
      h += '<ul class="dp-jab-liste">'
        + '<li><span>Hausgeld ' + J + '</span><b>' + (istZahl(h0.hg_ist_j) ? eur(h0.hg_ist_j) + (h0.hg_quelle === 'vivi' ? ' laut ViVi' : ' laut Abrechnung') : '<span class="dp-jab-offen">fehlt</span>') + '</b></li>'
        + '<li><span>Protokoll der Versammlung</span>' + (h0.protokoll ? '<span class="dp-jab-ok">da</span>' : '<span class="dp-jab-offen">fehlt</span>') + '</li>'
        + '<li><span>Abrechnung oder Wirtschaftsplan</span>' + (h0.abrechnung || h0.wirtschaftsplan ? '<span class="dp-jab-ok">da</span>' : '<span class="dp-jab-offen">fehlt</span>') + '</li></ul>';
      h += '<div class="dp-jab-reihe">' + knopf('hochladen', 'Protokoll und Abrechnung hochladen', !(h0.protokoll && (h0.abrechnung || h0.wirtschaftsplan))) + '</div>';
    } else h += '<p class="dp-jab-satz">Kein Wohnungseigentum. Die Hauskosten stehen als Belege in der Anlage V.' + (mitVivi ? ' Was ViVi gebucht hat, steht daneben.' : '') + '</p>'
      + '<div class="dp-jab-reihe">' + knopf('hochladen', 'Belege einlesen', false) + '</div>';
    h += '<div data-jab-belege></div>';
    return h;
  }
  function schrittSteuer(r) {
    var J = _z.jahr, B = JB(), t = null;
    try { var sj = typeof global._v269_getStartYear === 'function' ? global._v269_getStartYear() : null; if (sj != null && typeof global._computeYearTotal === 'function') t = global._computeYearTotal(J, J - sj); } catch (e) { t = null; }
    var st = B ? B.status(J) : 'geplant', fest = r.s.fest && r.s.fest.steuer;
    var h = '<h4>Steuer ' + J + '</h4><p class="dp-jab-satz">Die Anlage V ' + J + ' aus dem Reiter Steuer, zusammengefasst.<small>Belege und ViVi-Werte aus Schritt 3 sind schon eingerechnet.</small></p>';
    h += '<div class="dp-jab-zahl"><span>Einnahmen<b>' + eur(t && t.einnahmen) + '</b></span><span>Werbungskosten<b>' + eur(t && t.werbungskosten) + '</b></span><span>Ergebnis V+V<b>' + (t ? vz(t.ergebnis) : '–') + '</b></span></div>';
    var opts = (B && B.STATUS ? B.STATUS : [['geplant', 'nicht erklärt'], ['erklaert', 'erklärt'], ['bescheid', 'Bescheid liegt vor']]).map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === st ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
    h += '<div class="dp-jab-reihe"><label style="display:flex;align-items:center;gap:8px">Stand der Steuer <select data-jab-status' + (fest ? ' disabled' : '') + '>' + opts + '</select></label>' + knopf('anlage-v', 'Volle Anlage V öffnen', false) + '</div>';
    if (fest) h += '<div class="dp-jab-box">Die Steuer ' + J + ' ist festgeschrieben.</div>';
    else if (st !== 'bescheid') h += '<div class="dp-jab-box">Erledigt ist der Schritt mit dem Bescheid. Ist die Erklärung abgegeben, setz den Stand auf erklärt.</div>';
    return h;
  }
  function schrittFest(r) {
    var J = _z.jahr, s = r.s, a = JA(), L = a && a.offenListe ? a.offenListe(r.z, s, r.weg) : [];
    var h = '<h4>' + J + ' festschreiben</h4>';
    h += '<ul class="dp-jab-liste">' + SCHRITTE.slice(0, 4).map(function (x) {
      var w = s.fest && s.fest[x[0]] ? '<span class="dp-jab-ok">festgeschrieben</span>' : (s[x[0]] === 'ok' ? '<span class="dp-jab-ok">erledigt</span>' : '<span class="dp-jab-offen">' + (s[x[0]] === 'teil' ? 'teilweise' : 'offen') + '</span>');
      return '<li><span>' + x[1] + '</span>' + w + '</li>';
    }).join('') + '</ul>';
    if (s.nFest === 4) {
      var p = (jahrDaten(J).fest_protokoll || []).slice(-1)[0];
      return h + '<div class="dp-jab-box gold">' + J + ' ist abgeschlossen und festgeschrieben' + (p && p.am ? ' am ' + esc(datumText(String(p.am).slice(0, 10))) : '') + '. Ändern geht nur nach Freigabe im Jahresabgleich.</div>';
    }
    if (L.length) h += '<div class="dp-jab-box">Noch offen: ' + esc(L.join(', ')) + '. Du kannst trotzdem festschreiben, offene Schritte gelten dann als abgeschlossen.</div>';
    else h += '<div class="dp-jab-box gold">Alle vier Schritte von ' + J + ' sind erledigt.</div>';
    if (_z.frage) h += '<div class="dp-jab-box rot"><b>' + J + ' festschreiben?</b> Danach lassen sich die Werte nur nach Freigabe ändern. Das Festschreiben wird mit Datum protokolliert.'
      + '<div class="dp-jab-reihe" style="margin:8px 0 0">' + knopf('fest-ja', 'Ja, festschreiben', true) + knopf('fest-nein', 'Noch nicht', false) + '</div></div>';
    else h += '<div class="dp-jab-reihe">' + knopf('fest-frage', J + ' festschreiben', true) + '</div>';
    return h;
  }

  /* ── Zeichnen ──────────────────────────────────────────────────────── */
  function zeichnen() {
    var ov = $('dp-jab-ov'); if (!ov || !_z) return;
    var r = lage();
    if (!r) { ov.querySelector('.dp-jab-inhalt').innerHTML = '<p class="dp-jab-satz">Für ' + _z.jahr + ' gibt es keine Zeile im Jahresabgleich.</p>'; return; }
    var i = SCHRITTE.map(function (x) { return x[0]; }).indexOf(_z.k);
    _merk[schluessel(_z.jahr)] = _z.k;
    var leiste = SCHRITTE.map(function (x, n) {
      var st = r.st[x[0]], zeichen = st === 'ok' || st === 'fest' ? '✓' : String(n + 1);
      return '<li><button type="button" class="' + st + (x[0] === _z.k ? ' an' : '') + '" data-jab="zu-schritt" data-jab-k="' + x[0] + '" aria-current="' + (x[0] === _z.k ? 'step' : 'false') + '"><i>' + zeichen + '</i><span class="w">' + x[1] + '</span></button></li>';
    }).join('');
    var inhalt = viviZeile(_z.jahr) + ({ miete: schrittMiete, wert: schrittWert, haus: schrittHaus, steuer: schrittSteuer, fest: schrittFest }[_z.k])(r);
    var stW = { ok: 'erledigt', fest: 'festgeschrieben', teil: 'teilweise', offen: 'offen', bereit: 'bereit', laufend: 'läuft' }[r.st[_z.k]] || '';
    ov.querySelector('.dp-jab-kopf small').textContent = 'Schritt ' + (i + 1) + ' von 5 · ' + SCHRITTE[i][1] + ' · ' + stW;
    ov.querySelector('.dp-jab-leiste').innerHTML = leiste;
    var inh = ov.querySelector('.dp-jab-inhalt'); inh.innerHTML = inhalt; inh.scrollTop = 0;
    ov.querySelector('.dp-jab-fuss').innerHTML = (i > 0 ? knopf('zurueck', 'Zurück', false) : '<b></b>') + '<span>' + esc(_z.jahr + ' · ' + SCHRITTE.filter(function (x) { return r.st[x[0]] === 'ok' || r.st[x[0]] === 'fest'; }).length + ' von 5 erledigt') + '</span>'
      + (i < 4 ? knopf('weiter', 'Weiter', true) : knopf('zu', 'Schließen', false));
    /* eingebettete Bausteine */
    var e = inh.querySelector('[data-jab-eingabe]'), B = JB();
    if (e && B && B.eingabeHtml) {
      e.innerHTML = B.eingabeHtml(_z.jahr);
      var inl = e.querySelector('.dp-jb-inline');
      if (inl && B.eingabeBinden) B.eingabeBinden(inl, function () { toast('✓ Gespeichert'); zeichnen(); try { if (JA()) JA().mountAll(); } catch (x) {} });
      var fk = inl && inl.querySelector('[data-jb-aktion="zu"]'); if (fk) fk.textContent = 'Speichern';
    }
    var bx = inh.querySelector('[data-jab-belege]');
    if (bx && global.DpEingang && global.DpEingang.jahresInRahmen) { bx._bjOpt = null; global.DpEingang.jahresInRahmen(bx, _z.jahr, { festesJahr: true }); }
  }
  function schliessen() {
    var ov = $('dp-jab-ov'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    _z = null;
    try { if (JA()) JA().mountAll(); } catch (e) {}
  }
  function oeffnen(jahr, k) {
    var J = parseInt(jahr, 10), d = doc();
    if (!d || !(J >= 1990) || J >= heuteJahr()) { toast('Den Jahresabschluss gibt es für vergangene Jahre.'); return; }
    stil();
    var alt = $('dp-jab-ov'); if (alt) alt.parentNode.removeChild(alt);
    _z = { jahr: J, k: 'miete', frage: false, vivi: null };
    var r = lage();
    _z.k = startSchritt(r && r.s, k, k ? null : _merk[schluessel(J)]);
    var ov = d.createElement('div'); ov.className = 'dp-jab-ov'; ov.id = 'dp-jab-ov';
    ov.innerHTML = '<div class="dp-jab" role="dialog" aria-modal="true" aria-label="Jahresabschluss ' + J + '"><div class="dp-jab-kopf"><b>Jahresabschluss ' + J + '</b><small></small><button type="button" data-jab="zu" aria-label="Schließen">×</button></div>'
      + '<ol class="dp-jab-leiste"></ol><div class="dp-jab-inhalt"></div><div class="dp-jab-fuss"></div></div>';
    d.body.appendChild(ov);
    binden(ov);
    /* ViVi einmal je Objekt und Jahr lesen (nur GET): Ist-Miete, Steuerjahr, Hausgeld */
    var a = JA(), sk = schluessel(J);
    if (a && a.viviVerknuepft && a.viviVerknuepft() && !_gelesen[sk]) {
      _gelesen[sk] = true; _z.vivi = 'laeuft';
      a.viviAbgleichen(true).then(function () { if (_z && _z.jahr === J) { _z.vivi = null; zeichnen(); } });
    }
    zeichnen();
    try { var f = ov.querySelector('.dp-jab-kopf button'); if (f) f.focus({ preventScroll: true }); } catch (e) {}
  }
  function gehe(k) { if (!_z) return; _z.k = k; _z.frage = false; zeichnen(); }
  function binden(ov) {
    ov.addEventListener('change', function (ev) {
      var sel = ev.target && ev.target.closest ? ev.target.closest('[data-jab-status]') : null;
      if (sel && JB()) { JB().statusSetzen(_z.jahr, sel.value); try { if (global.DpSpeichernFolge) global.DpSpeichernFolge(); else if (typeof global.saveObj === 'function') global.saveObj({ silent: true }); } catch (e) {} zeichnen(); }
    });
    ov.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-jab]') : null; if (!b || !_z) return;
      var a = b.getAttribute('data-jab'), ks = SCHRITTE.map(function (x) { return x[0]; }), i = ks.indexOf(_z.k), J = _z.jahr;
      if (a === 'zu') { schliessen(); return; }
      if (a === 'weiter') { gehe(ks[Math.min(4, i + 1)]); return; }
      if (a === 'zurueck') { gehe(ks[Math.max(0, i - 1)]); return; }
      if (a === 'zu-schritt') { gehe(b.getAttribute('data-jab-k')); return; }
      if (a === 'vivi-miete') { if (JB() && JB().istMieteSetzen(J, null)) { try { if (typeof global.saveObj === 'function') global.saveObj({ silent: true }); } catch (e) {} } zeichnen(); return; }
      if (a === 'erh') { schliessen(); try { JA().zuMiete('erh'); } catch (e) {} return; }
      if (a === 'wert-nein') { if (JB()) JB().festSetzen(J, ['wert'], true); zeichnen(); return; }
      if (a === 'wert-abrufen') { schliessen(); try { JA().mbAbrufen(); } catch (e) {} return; }
      if (a === 'hochladen') { try { global.DpEingang.oeffnen({ fertig: function () { setTimeout(zeichnen, 300); } }); } catch (e) {} return; }
      if (a === 'anlage-v') { schliessen(); try { JA().zuReiter('s3-tax'); } catch (e) {} return; }
      if (a === 'fest-frage') { _z.frage = true; zeichnen(); return; }
      if (a === 'fest-nein') { _z.frage = false; zeichnen(); return; }
      if (a === 'fest-ja') { _z.frage = false; if (JB()) JB().festSetzen(J, null, true); toast(J + ' ist festgeschrieben'); zeichnen(); return; }
    });
  }
  if (global.addEventListener) {
    global.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && _z && !$('oabi-ov')) schliessen(); });
    global.addEventListener('dp:vivi-stand', function () { if (_z && _z.vivi !== 'laeuft') setTimeout(function () { if (_z) zeichnen(); }, 800); });
    global.addEventListener('dp:object-ready', function () { if (_z) schliessen(); _merk = {}; });
  }

  global.DpJahresabschluss = { VERSION: VERSION, SCHRITTE: SCHRITTE, oeffnen: oeffnen, schliessen: schliessen, startSchritt: startSchritt, offen: function () { return _z ? { jahr: _z.jahr, k: _z.k } : null; } };
})(typeof window !== 'undefined' ? window : globalThis);
