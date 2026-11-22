'use strict';
/* ═══ js/vivi.js — v3950 · ViVi-ANBINDUNG IM BROWSER (Pakete V1 bis V3) ═══════════════════════════════
 *
 * Bauplan Dateien/Architektur/ViVi-Anbindung-2026-11-22.md. Marcels Regeln vom 22.11.2026:
 *   · einmal anlegen: Knopf „In ViVi anlegen“ am Objekt, vorher eine Vorschau aller Werte, die rausgehen
 *   · danach nur lesen: „Jetzt abgleichen“ holt die Werte aus ViVi, nichts geht zurueck
 *   · verknuepfte Felder sind ausgegraut (js/vivi-felder.js)
 *
 * Vorschau-Funktion 'vivi' (backend/src/services/vorschau-funktionen.json): alles hier laeuft erst nach
 * DpVorschau.frei('vivi'). Das Backend sperrt /api/v1/vivi zusaetzlich (routes/vivi.js).
 *
 * Teile:
 *   verbindungKarte(host)   Einstellungen › Konto › Externe Anbieter: Token eintragen, Test-Abruf, Liste
 *   Leiste am Objekt        #vivi-leiste im Reiter Objekt unter dem Kopf: Status, anlegen, abgleichen, loesen
 *   Vorschau-Fenster        #vivi-ov: Werte, Hinweise, fehlende Angaben, Account, Bestaetigung
 * Kundentexte ohne Gedankenstrich und Semikolon, keine Datenquellennamen.
 * ═════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DpVivi) return;
  var ABGLEICH_NACH_MS = 6 * 60 * 60 * 1000;   /* beim Oeffnen neu lesen, wenn der Stand aelter ist */
  var _frei = null, _verbunden = null, _stand = null, _key = null, _laeuft = false;
  var _anlegenLaeuft = false;   /* v3967 · kein zweites Anlegen, solange eines laeuft (Doppelklick, zweiter Knopf) */

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function api(pfad, opt) {
    if (!(window.Auth && typeof window.Auth.apiCall === 'function')) return Promise.reject(new Error('Nicht angemeldet'));
    return window.Auth.apiCall(pfad, opt || { method: 'GET' });
  }
  function meldung(t) { try { if (window.toast) window.toast(t); else console.log('[vivi] ' + t); } catch (e) {} }
  function frei() {
    if (_frei) return _frei;
    _frei = (window.DpVorschau && typeof window.DpVorschau.frei === 'function')
      ? window.DpVorschau.frei('vivi').catch(function () { return false; })
      : Promise.resolve(false);
    return _frei;
  }
  function verbindung(neu) {
    if (_verbunden && !neu) return _verbunden;
    _verbunden = api('/vivi/verbindung').then(function (r) { return !!(r && r.vivi && r.vivi.exists); }).catch(function () { return false; });
    return _verbunden;
  }
  function standText(iso) {
    if (!iso) return 'noch nicht gelesen';
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var z = function (n) { return ('0' + n).slice(-2); };
    return 'Stand ' + z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }

  function stil() {
    if ($('vivi-stil')) return;
    var s = document.createElement('style'); s.id = 'vivi-stil';
    s.textContent = [
      '.vivi-leiste{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:10px 0 14px;padding:9px 12px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);border-radius:10px;font:400 12.5px/1.4 Inter,system-ui,sans-serif}',
      '.vivi-leiste .vivi-marke{font:600 11px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}',
      '.vivi-leiste .vivi-text{flex:1 1 220px;min-width:0}',
      '.vivi-leiste .vivi-knoepfe{display:flex;flex-wrap:wrap;gap:6px}',
      '#vivi-ov{position:fixed;inset:0;z-index:99998;background:rgba(5,5,5,.55);display:flex;align-items:center;justify-content:center;padding:16px}',
      '#vivi-ov .vivi-karte{background:#FDFCFA;color:#2A2727;border-radius:12px;max-width:760px;width:100%;max-height:calc(100vh - 32px);overflow:auto;padding:18px 20px;box-shadow:0 18px 50px rgba(0,0,0,.35);font:400 13px/1.45 Inter,system-ui,sans-serif}',
      '#vivi-ov h3{margin:0 0 6px;font:600 17px/1.3 "Space Grotesk",Inter,sans-serif}',
      '#vivi-ov table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12.5px}',
      '#vivi-ov td,#vivi-ov th{padding:5px 6px;border-bottom:1px solid rgba(42,39,39,.1);text-align:left;vertical-align:top}',
      '#vivi-ov th{font:600 10px/1.2 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370}',
      '#vivi-ov .vivi-notiz{color:#7A7370;font-size:11.5px}',
      '#vivi-ov .vivi-fehlt{border-left:3px solid #B8625C;padding:6px 10px;margin:8px 0;background:rgba(184,98,92,.07)}',
      '#vivi-ov .vivi-hinw{border-left:3px solid var(--wl-c9a84c, #C9A84C);padding:6px 10px;margin:8px 0;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 7%, transparent)}',
      '#vivi-ov .vivi-fuss{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:12px}',
      '#vivi-ov label.vivi-wahl{display:flex;gap:8px;align-items:center;margin:6px 0}',
      '#vivi-ov details summary{cursor:pointer;color:#7A7370;margin-top:8px}',
      '#vivi-ov pre{white-space:pre-wrap;font-size:11px;background:rgba(42,39,39,.05);padding:8px;border-radius:6px;max-height:240px;overflow:auto}',
      '@media (max-width:640px){#vivi-ov{padding:8px}#vivi-ov .vivi-karte{padding:14px}#vivi-ov td,#vivi-ov th{padding:4px}}'
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Einstellungen: Verbindung ───────────────────────────────────── */
  function verbindungKarte(host) {
    if (!host) return;
    frei().then(function (ok) {
      if (!ok) { host.innerHTML = ''; return; }
      stil();
      host.innerHTML = '<div id="pk-vivi" style="border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);border-radius:12px;padding:14px 15px;margin-top:14px">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px"><span style="font-weight:700;font-size:15px">ViVi</span>' +
        '<span id="pk-vivi-badge" style="margin-left:auto;font-size:11px;font-family:JetBrains Mono,ui-monospace,monospace;padding:3px 9px;border-radius:999px;border:1px solid #ddd;color:#888">…</span></div>' +
        '<p class="hint" style="margin:0 0 12px">Verwaltung deiner Objekte. DealPilot legt ein Objekt einmal in ViVi an und liest danach nur noch. Den API-Token beantragst du in ViVi unter Einstellungen, Integrationen, API-Zugang. Zum Anlegen braucht der Token Schreibrecht.</p>' +
        '<div id="pk-vivi-body"><p class="hint">Lade Status…</p></div></div>';
      karteLaden();
    });
  }
  function karteLaden() {
    var body = $('pk-vivi-body'), badge = $('pk-vivi-badge'); if (!body) return;
    verbindung(true);
    api('/vivi/verbindung').then(function (r) {
      var m = (r && r.vivi) || { exists: false };
      if (badge) { badge.textContent = m.exists ? 'Token gespeichert' : 'Nicht verbunden'; badge.style.color = m.exists ? '#3FA56C' : '#888'; }
      if (!m.exists) {
        body.innerHTML = '<label style="display:block;font-family:JetBrains Mono,ui-monospace,monospace;font-size:10px;letter-spacing:.1em;color:#888;text-transform:uppercase;margin-bottom:5px">API-Token</label>' +
          '<input id="pk-vivi-input" type="password" autocomplete="off" spellcheck="false" placeholder="Token aus ViVi" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:10px 11px;font-family:JetBrains Mono,ui-monospace,monospace;font-size:13px">' +
          '<div style="margin-top:11px"><button type="button" class="btn btn-gold" id="pk-vivi-speichern">ViVi verbinden</button></div>' +
          '<p class="hint" style="margin-top:8px;font-size:11px">Der Token wird verschlüsselt gespeichert und nur für deine Anfragen an ViVi benutzt.</p>';
        $('pk-vivi-speichern').onclick = function () {
          var v = ($('pk-vivi-input').value || '').trim(); if (!v) { alert('Bitte den Token eintragen.'); return; }
          api('/vivi/verbindung', { method: 'PUT', body: { token: v } }).then(function () { return probe(true); }).catch(function (e) { alert((e && e.message) || 'Speichern fehlgeschlagen.'); karteLaden(); });
        };
        return;
      }
      body.innerHTML = '<input type="text" disabled value="' + esc('••••••••••••' + (m.hint || '')) + '" style="width:100%;border:1px solid #ddd;border-radius:8px;padding:10px 11px;font-family:JetBrains Mono,ui-monospace,monospace;font-size:13px;color:#777;background:#f4f3ee">' +
        '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:11px">' +
          '<button type="button" class="btn btn-sm btn-ghost" id="pk-vivi-probe">Verbindung testen</button>' +
          '<button type="button" class="btn btn-sm" id="pk-vivi-loeschen" style="color:#B8625C;border:1px solid #e3c9c4;background:#fff">Token löschen</button></div>' +
        '<div id="pk-vivi-ergebnis" class="hint" style="margin-top:8px"></div><div id="pk-vivi-objekte" class="hint" style="margin-top:8px"></div>';
      $('pk-vivi-probe').onclick = function () { probe(false); };
      $('pk-vivi-loeschen').onclick = function () {
        if (!confirm('ViVi-Token in DealPilot löschen? Verknüpfte Objekte bleiben verknüpft, werden aber nicht mehr gelesen.')) return;
        api('/vivi/verbindung', { method: 'DELETE' }).then(karteLaden).catch(function () { alert('Löschen fehlgeschlagen.'); });
      };
      api('/vivi/objekte').then(function (r) {
        var L = (r && r.objekte) || []; var ziel = $('pk-vivi-objekte'); if (!ziel) return;
        ziel.innerHTML = L.length ? '<b>Verknüpfte Objekte</b><br>' + L.map(function (o) {
          return esc([o.str, o.hnr].filter(Boolean).join(' ') + (o.ort ? ', ' + o.ort : '')) + ' · ' + esc(o.anlage_status === 'fertig' ? standText(o.letzter_abruf) : (o.anlage_status === 'abgebrochen' ? 'Übertragung unterbrochen' : 'Übertragung läuft')) + (o.letzter_fehler ? ' · ' + esc(o.letzter_fehler) : '');
        }).join('<br>') : 'Noch kein Objekt mit ViVi verknüpft.';
      }).catch(function () {});
    }).catch(function () { body.innerHTML = '<p class="hint">ViVi ist gerade nicht verfügbar.</p>'; });
  }
  function probe(nachSpeichern) {
    var ziel = $('pk-vivi-ergebnis');
    if (ziel) ziel.textContent = 'Frage ViVi…';
    return api('/vivi/verbindung/probe', { method: 'POST', body: {} }).then(function (r) {
      if (nachSpeichern) karteLaden();
      setTimeout(function () {
        var z = $('pk-vivi-ergebnis'); if (!z) return;
        var a = (r && r.accounts) || [];
        z.innerHTML = '<span style="color:#3FA56C">Verbunden.</span> ' + (a.length ? 'Bereiche in ViVi: ' + a.map(function (x) { return esc(x.name) + (x.label ? ' (' + esc(x.label) + ')' : ''); }).join(', ') : 'Keine Bereiche gemeldet.');
      }, nachSpeichern ? 400 : 0);
      meldung('ViVi verbunden');
      verbindung(true);
    }).catch(function (e) {
      if (nachSpeichern) karteLaden();
      setTimeout(function () { var z = $('pk-vivi-ergebnis'); if (z) z.innerHTML = '<span style="color:#B8625C">' + esc((e && e.message) || 'Test fehlgeschlagen') + '</span>'; }, nachSpeichern ? 400 : 0);
    });
  }

  /* ── Leiste am Objekt ────────────────────────────────────────────── */
  function leisteHost() {
    var l = $('vivi-leiste');
    if (l) return l;
    var kopf = $('oe-kopf'), s0 = $('s0');
    if (!s0) return null;
    l = document.createElement('div'); l.id = 'vivi-leiste'; l.className = 'vivi-leiste';
    if (kopf && kopf.parentNode) kopf.parentNode.insertBefore(l, kopf.nextSibling); else s0.insertBefore(l, s0.firstChild);
    return l;
  }
  function leiste() {
    var l = leisteHost(); if (!l) return;
    var st = _stand || {};
    var text, knoepfe = '';
    if (!_key) { l.style.display = 'none'; return; }
    l.style.display = '';
    if (st.verknuepft) {
      var n = Object.keys(st.felder || {}).length;
      text = 'Mit ViVi verknüpft. ' + standText(st.letzter_abruf) + '. ' + (n ? n + ' Felder kommen aus ViVi und sind ausgegraut.' : 'Noch keine Werte gelesen.') + (st.letzter_fehler ? ' Letzter Abruf: ' + st.letzter_fehler : '');
      if (st.info && st.info.restschuld_heute && st.info.restschuld_heute.wert != null) text += ' Restschuld laut ViVi ' + Math.round(st.info.restschuld_heute.wert).toLocaleString('de-DE') + ' €' +
        (st.info.restschuld_heute.sondertilgung ? ', darin ' + Math.round(st.info.restschuld_heute.sondertilgung).toLocaleString('de-DE') + ' € Sondertilgung' : '') + '.';
      knoepfe = '<button type="button" class="btn btn-sm btn-ghost" data-vivi="abgleichen">Jetzt abgleichen</button><button type="button" class="btn btn-sm btn-ghost" data-vivi="loesen">Verknüpfung lösen</button>';
    } else if (st.status === 'abgebrochen' || st.status === 'laeuft') {
      text = st.status === 'laeuft' ? 'Die Übertragung nach ViVi läuft.' : 'Die Übertragung nach ViVi ist unterbrochen. Ein neuer Versuch setzt an der letzten Stelle fort, es entsteht nichts doppelt.';
      knoepfe = '<button type="button" class="btn btn-sm btn-gold" data-vivi="anlegen">Übertragung fortsetzen</button>';
    } else if (_anlegenLaeuft) {
      text = 'Die Übernahme nach ViVi läuft. Bei einem Mehrfamilienhaus kann das bis zu zwei Minuten dauern.';
      knoepfe = '';
    } else {
      /* v3967 · Marcel 22.11.2026: anlegen erst nach Gewonnen bzw. im Bestand, sonst nichts zeigen */
      if (!(window.DpBuchhaltung && window.DpBuchhaltung.istGewonnen())) { l.style.display = 'none'; l.innerHTML = ''; return; }
      text = 'Dieses Objekt ist noch nicht in ViVi. Es wird einmal angelegt, danach liest DealPilot nur noch.';
      knoepfe = '<button type="button" class="btn btn-sm btn-gold" data-vivi="anlegen">In ViVi anlegen</button><button type="button" class="btn btn-sm btn-ghost" data-vivi="zuordnen">Mit ViVi-Objekt verknüpfen</button>';
    }
    l.innerHTML = '<span class="vivi-marke">ViVi</span><span class="vivi-text">' + esc(text) + '</span><span class="vivi-knoepfe">' + knoepfe + '</span>';
  }
  function leisteWeg() { var l = $('vivi-leiste'); if (l) l.style.display = 'none'; }

  function werteAnwenden(r) {
    _stand = r || null;
    var geaendert = false;
    try { if (window.DpViviFelder) geaendert = window.DpViviFelder.setzen(_stand); } catch (e) { console.warn('[vivi] Felder:', e && e.message); }
    leiste();
    if (geaendert && typeof window.saveObj === 'function') setTimeout(function () { try { if (window._currentObjKey === _key) window.saveObj(); } catch (e) {} }, 300);
  }
  function objektGeladen(key) {
    _key = key || null; _stand = null;
    if (!_key) { leisteWeg(); return; }
    frei().then(function (ok) {
      if (!ok || window._currentObjKey !== key) return;
      stil();
      return api('/vivi/objekt/' + encodeURIComponent(key) + '/werte').then(function (r) {
        if (window._currentObjKey !== key) return;
        if (r && r.verknuepft) {
          werteAnwenden(r);
          var alt = !r.letzter_abruf || (Date.now() - new Date(r.letzter_abruf).getTime() > ABGLEICH_NACH_MS);
          if (alt) abgleichen(true);
          return;
        }
        _stand = r;
        if (window.DpViviFelder) window.DpViviFelder.setzen(r);
        return verbindung().then(function (v) { if (v || (r && r.status)) leiste(); else leisteWeg(); });
      });
    }).catch(function () { leisteWeg(); });
  }

  function abgleichen(still) {
    if (!_key || _laeuft) return Promise.resolve();
    var key = _key; _laeuft = true;
    return frei().then(function (ok) {
      if (!ok) return;
      return api('/vivi/objekt/' + encodeURIComponent(key) + '/abrufen', { method: 'POST', body: {}, timeout: 90000 }).then(function (r) {
        if (window._currentObjKey !== key) return;
        werteAnwenden(r);
        if (!still) meldung('Werte aus ViVi gelesen');
      }).catch(function (e) {
        if (!still) alert((e && e.message) || 'Abgleich fehlgeschlagen.');
        api('/vivi/objekt/' + encodeURIComponent(key) + '/werte').then(function (r) { if (window._currentObjKey === key) { _stand = r; leiste(); } }).catch(function () {});
      });
    }).then(function () { _laeuft = false; }, function () { _laeuft = false; });
  }

  /* ── Fenster ─────────────────────────────────────────────────────── */
  function fenster(html) {
    schliessen();
    var ov = document.createElement('div'); ov.id = 'vivi-ov';
    ov.innerHTML = '<div class="vivi-karte" role="dialog" aria-modal="true">' + html + '</div>';
    ov.addEventListener('click', function (ev) { if (ev.target === ov && !_anlegenLaeuft) schliessen(); });
    document.body.appendChild(ov);
    return ov;
  }
  function schliessen() { var o = $('vivi-ov'); if (o) o.remove(); }

  function anlegen() {
    if (!_key) { alert('Bitte das Objekt zuerst speichern.'); return; }
    if (_anlegenLaeuft) { meldung('Die Übernahme nach ViVi läuft schon.'); return; }
    var key = _key;
    frei().then(function (ok) {
      if (!ok) return;
      stil();
      var ov = fenster('<h3>In ViVi anlegen</h3><p>Lade Vorschau…</p>');
      var opt = function () {
        var pz = $('vivi-platzhalter'), ma = $('vivi-muster'), ft = $('vivi-faellig'), ac = $('vivi-account');
        return { platzhalter_namen: !!(pz && pz.checked), muster_anschrift: !!(ma && ma.checked), faellig_tag: ft ? Number(ft.value) || 3 : 3, account_id: ac && ac.value ? ac.value : null };
      };
      var zeichnen = function (v, accounts, o) {
        o = o || {};
        /* v3951 · die Vorgaben des Servers (Testbetrieb: Musteranschrift und Platzhalter an) gelten, bis der Kunde umschaltet */
        if (v.optionen) { if (o.platzhalter_namen === undefined) o.platzhalter_namen = v.optionen.platzhalter_namen; if (o.muster_anschrift === undefined) o.muster_anschrift = v.optionen.muster_anschrift; }
        var zeilen = (v.vorschau || []).map(function (z) {
          return '<tr><td>' + esc(z.bereich) + '</td><td>' + esc(z.feld) + '</td><td>' + esc(z.wert) + (z.notiz ? '<div class="vivi-notiz">' + esc(z.notiz) + '</div>' : '') + '</td></tr>';
        }).join('');
        var fehlt = (v.fehlt || []).length ? '<div class="vivi-fehlt"><b>Diese Angaben braucht ViVi noch:</b><br>' + v.fehlt.map(function (f) { return esc(f.text); }).join('<br>') + '</div>' : '';
        var hinw = (v.hinweise || []).length ? '<div class="vivi-hinw">' + v.hinweise.map(esc).join('<br>') + '</div>' : '';
        var acc = (accounts && accounts.length > 1) ? '<label class="vivi-wahl">Bereich in ViVi <select id="vivi-account">' + accounts.map(function (a) {
          return '<option value="' + esc(a.id) + '"' + ((o.account_id ? String(o.account_id) === String(a.id) : a.is_default) ? ' selected' : '') + '>' + esc(a.name) + (a.label ? ' (' + esc(a.label) + ')' : '') + '</option>';
        }).join('') + '</select></label>' : '';
        ov.querySelector('.vivi-karte').innerHTML =
          '<h3>In ViVi anlegen</h3>' +
          '<p>Diese Werte gehen <b>einmal</b> an ViVi. Danach liest DealPilot nur noch aus ViVi und schreibt nichts zurück. Verknüpfte Felder sind dann ausgegraut.</p>' +
          fehlt + hinw +
          '<table><thead><tr><th>Bereich</th><th>Feld</th><th>Wert</th></tr></thead><tbody>' + zeilen + '</tbody></table>' +
          acc +
          '<label class="vivi-wahl"><input type="checkbox" id="vivi-platzhalter"' + (o.platzhalter_namen ? ' checked' : '') + '> Mieternamen durch Platzhalter ersetzen</label>' +
          '<label class="vivi-wahl"><input type="checkbox" id="vivi-muster"' + (o.muster_anschrift ? ' checked' : '') + '> Anschrift durch Musteranschrift ersetzen' + (v.optionen && v.optionen.testbetrieb ? ' (Testbetrieb)' : '') + '</label>' +
          '<label class="vivi-wahl">Miete fällig am <input type="number" id="vivi-faellig" min="1" max="31" value="' + esc(o.faellig_tag || 3) + '" style="width:64px"> des Monats</label>' +
          '<details><summary>Was genau an ViVi geht</summary><pre>' + esc(JSON.stringify(v.nutzlast, null, 2)) + '</pre></details>' +
          '<div class="vivi-fuss"><button type="button" class="btn btn-sm btn-ghost" id="vivi-abbrechen">Abbrechen</button>' +
          (v.gesperrt ? '<span class="hint">Schon mit ViVi verknüpft.</span>' : '<button type="button" class="btn btn-sm btn-gold" id="vivi-los"' + (v.ok ? '' : ' disabled') + '>Jetzt in ViVi anlegen</button>') + '</div>';
        $('vivi-abbrechen').onclick = schliessen;
        ['vivi-platzhalter', 'vivi-muster', 'vivi-faellig'].forEach(function (id) { var e = $(id); if (e) e.onchange = function () { neu(); }; });
        var los = $('vivi-los');
        if (los) los.onclick = function () {
          if (_anlegenLaeuft) return;
          /* v3967 · Wartehinweis: ViVi legt je Mietverhaeltnis alle Sollstellungen ab Mietbeginn an. Gemessen bis 113 s
             (2026-1053, acht Mietverhaeltnisse ab 2009). Knopf und Fenster bleiben gesperrt, bis die Antwort da ist. */
          _anlegenLaeuft = true; leiste();
          los.disabled = true; los.textContent = 'Wird angelegt…';
          Array.prototype.forEach.call(ov.querySelectorAll('input, select, #vivi-abbrechen'), function (x) { x.disabled = true; });
          var n = (v.anzahl && v.anzahl.mietverhaeltnisse) || 0;
          var warte = document.createElement('div'); warte.className = 'vivi-hinw'; warte.id = 'vivi-warte';
          var t0 = Date.now();
          var zeichneWarte = function () {
            var s = Math.round((Date.now() - t0) / 1000);
            warte.textContent = 'Übertragung läuft, ' + s + ' s. ' + (n > 2 ? 'Bei einem Mehrfamilienhaus kann das bis zu zwei Minuten dauern, ' : 'Das dauert meist nur Sekunden, ') + 'weil ViVi alle Mieten ab Mietbeginn anlegt. Bitte das Fenster offen lassen.';
          };
          zeichneWarte();
          var fuss = ov.querySelector('.vivi-fuss'); if (fuss) fuss.parentNode.insertBefore(warte, fuss);
          var uhr = setInterval(zeichneWarte, 1000);
          var fertig = function () { clearInterval(uhr); _anlegenLaeuft = false; };
          var b = opt(); b.bestaetigt = true;
          api('/vivi/objekt/' + encodeURIComponent(key) + '/anlegen', { method: 'POST', body: b, timeout: 240000 }).then(function () {
            fertig(); schliessen(); meldung('In ViVi angelegt');
            return abgleichen(true);
          }).catch(function (e) {
            fertig();
            alert((e && e.message) || 'Anlegen fehlgeschlagen.');
            schliessen();
            api('/vivi/objekt/' + encodeURIComponent(key) + '/werte').then(function (r) { if (window._currentObjKey === key) { _stand = r; leiste(); } }).catch(function () {});
          }).then(function () { try { if (window.DpBuchhaltung) window.DpBuchhaltung.zeigen(); } catch (x) {} });
        };
      };
      var accounts = null;
      var neu = function () {
        var o = $('vivi-platzhalter') ? opt() : {};
        api('/vivi/objekt/' + encodeURIComponent(key) + '/vorschau', { method: 'POST', body: o }).then(function (v) { zeichnen(v, accounts, o); })
          .catch(function (e) { ov.querySelector('.vivi-karte').innerHTML = '<h3>In ViVi anlegen</h3><p>' + esc((e && e.message) || 'Vorschau nicht möglich.') + '</p><div class="vivi-fuss"><button type="button" class="btn btn-sm btn-ghost" onclick="document.getElementById(\'vivi-ov\').remove()">Schließen</button></div>'; });
      };
      api('/vivi/verbindung/probe', { method: 'POST', body: {} }).then(function (r) { accounts = (r && r.accounts) || null; }).catch(function () { accounts = null; }).then(neu);
    });
  }

  function zuordnen() {
    if (!_key) return;
    var key = _key;
    frei().then(function (ok) {
      if (!ok) return;
      stil();
      var ov = fenster('<h3>Mit ViVi-Objekt verknüpfen</h3><p>Lade deine Objekte aus ViVi…</p>');
      api('/vivi/projekte').then(function (r) {
        var L = (r && r.projekte) || [];
        ov.querySelector('.vivi-karte').innerHTML = '<h3>Mit ViVi-Objekt verknüpfen</h3>' +
          '<p>Das Objekt gibt es schon in ViVi? Dann wähle es aus. Es wird nichts an ViVi geschickt, DealPilot liest danach die Werte.</p>' +
          (L.length ? L.map(function (p, i) {
            return '<label class="vivi-wahl"><input type="radio" name="vivi-proj" value="' + esc(p.id) + '"' + (i === 0 ? ' checked' : '') + '> ' + esc([p.street, p.house_number].filter(Boolean).join(' ') + ', ' + [p.postal_code, p.city].filter(Boolean).join(' ')) + ' <span class="vivi-notiz">' + esc(p.name || '') + '</span></label>';
          }).join('') : '<p class="hint">In ViVi ist noch kein Objekt angelegt.</p>') +
          '<div class="vivi-fuss"><button type="button" class="btn btn-sm btn-ghost" id="vivi-abbrechen">Abbrechen</button>' + (L.length ? '<button type="button" class="btn btn-sm btn-gold" id="vivi-los">Verknüpfen</button>' : '') + '</div>';
        $('vivi-abbrechen').onclick = schliessen;
        var los = $('vivi-los');
        if (los) los.onclick = function () {
          var w = ov.querySelector('input[name="vivi-proj"]:checked'); if (!w) return;
          los.disabled = true;
          api('/vivi/objekt/' + encodeURIComponent(key) + '/zuordnen', { method: 'POST', body: { vivi_objekt_id: w.value } })
            .then(function () { schliessen(); meldung('Mit ViVi verknüpft'); return abgleichen(true); })
            .catch(function (e) { alert((e && e.message) || 'Verknüpfen fehlgeschlagen.'); los.disabled = false; });
        };
      }).catch(function (e) { ov.querySelector('.vivi-karte').innerHTML = '<h3>Mit ViVi-Objekt verknüpfen</h3><p>' + esc((e && e.message) || 'ViVi nicht erreichbar.') + '</p><div class="vivi-fuss"><button type="button" class="btn btn-sm btn-ghost" onclick="document.getElementById(\'vivi-ov\').remove()">Schließen</button></div>'; });
    });
  }

  function loesen() {
    if (!_key) return;
    var key = _key;
    if (!confirm('Verknüpfung in DealPilot lösen? In ViVi bleibt alles, wie es ist. Die Felder sind danach wieder frei.')) return;
    frei().then(function (ok) {
      if (!ok) return;
      api('/vivi/objekt/' + encodeURIComponent(key) + '/verknuepfung', { method: 'DELETE' }).then(function () {
        _stand = { verknuepft: false, status: null };
        var geaendert = window.DpViviFelder ? window.DpViviFelder.setzen(_stand) : false;
        leiste(); meldung('Verknüpfung gelöst');
        if (typeof window.saveObj === 'function') setTimeout(function () { try { if (window._currentObjKey === key) window.saveObj(); } catch (e) {} }, 300);
        return geaendert;
      }).catch(function (e) { alert((e && e.message) || 'Lösen fehlgeschlagen.'); });
    });
  }

  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('#vivi-leiste [data-vivi]') : null;
    if (!b) return;
    ev.preventDefault();
    var was = b.getAttribute('data-vivi');
    if (was === 'anlegen') { if (b.disabled) return; anlegen(); }
    else if (was === 'zuordnen') zuordnen();
    else if (was === 'abgleichen') abgleichen(false);
    else if (was === 'loesen') loesen();
  });
  window.addEventListener('dp:object-ready', function (ev) {
    var key = (ev && ev.detail && (ev.detail.key || ev.detail.id)) || window._currentObjKey || null;
    setTimeout(function () { objektGeladen(window._currentObjKey || key); }, 500);
  });

  /* v3967 · Statuswechsel (gewonnen, offen, verloren) aus js/buchhaltung-verbinden.js: Leiste neu zeichnen */
  window.addEventListener('dp:buchhaltung-status', function () { frei().then(function (ok) { if (ok && _key) leiste(); }); });

  /* v3967 · Anbieter in der Schicht „Buchhaltung verbinden“ (js/buchhaltung-verbinden.js) */
  function anmelden() {
    if (!window.DpBuchhaltung) return;
    window.DpBuchhaltung.anbieter({
      id: 'vivi', name: 'ViVi', frei: frei,
      verbunden: function () { return verbindung(); },
      status: function (key) {
        if (_anlegenLaeuft && key === _key) return { laeuft: true, text: 'Die Übernahme nach ViVi läuft. Bei einem Mehrfamilienhaus kann das bis zu zwei Minuten dauern.' };
        return api('/vivi/objekt/' + encodeURIComponent(key) + '/werte').then(function (r) {
          if (r && r.verknuepft) return { verknuepft: true, text: 'In ViVi verwaltet. ' + standText(r.letzter_abruf) + '. Die Werte kommen aus ViVi und sind im Reiter Objekt ausgegraut.' };
          if (r && r.status === 'laeuft') return { laeuft: true };
          if (r && r.status === 'abgebrochen') return { verknuepft: false, text: '' };
          return { verknuepft: false };
        });
      },
      uebernehmen: anlegen
    });
  }
  if (window.DpBuchhaltung) anmelden(); else document.addEventListener('DOMContentLoaded', anmelden);

  window.DpVivi = { verbindungKarte: verbindungKarte, leiste: leiste, anlegen: anlegen, abgleichen: abgleichen, zuordnen: zuordnen, loesen: loesen, objektGeladen: objektGeladen };
})();
