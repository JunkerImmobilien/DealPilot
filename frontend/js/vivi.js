'use strict';
/* ═══ js/vivi.js — v3950 · ViVi-ANBINDUNG IM BROWSER (Pakete V1 bis V3) ═══════════════════════════════
 *
 * Bauplan Dateien/Architektur/ViVi-Anbindung-2026-11-22.md. Marcels Regeln vom 22.11.2026:
 *   · einmal anlegen: „In ViVi anlegen“ in Deal-Aktion und in den Einstellungen (v4400, vorher am Objekt), mit Vorschau
 *   · danach nur lesen: „Jetzt abgleichen“ holt die Werte aus ViVi, nichts geht zurueck
 *   · verknuepfte Felder sind ausgegraut (js/vivi-felder.js)
 *
 * Vorschau-Funktion 'vivi' (backend/src/services/vorschau-funktionen.json): alles hier laeuft erst nach
 * DpViviZugang.frei(). Das Backend sperrt /api/v1/vivi zusaetzlich (routes/vivi.js).
 *
 * Teile:
 *   verbindungKarte(host)   Einstellungen › Konto › Externe Anbieter: Token eintragen, Test-Abruf, Liste
 *   Leiste am Objekt        #vivi-leiste im Reiter Objekt, nur verknuepft: Status, abgleichen, loesen (v4400)
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
    /* v4350 · kein eigener Merker mehr: DpViviZugang merkt sich nur eine echte Plan-Antwort */
    _frei = (window.DpViviZugang)
      ? window.DpViviZugang.frei().catch(function () { return false; })
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
      /* v4400 · Marcel 24.11.2026: Fenster im DealPilot-Design wie „Belege einlesen“ (.oabi-ov, modal-boarding-skin.js
         legt Obsidian-Leiste und Gold-Kopf darüber, Farben aus den Whitelabel-Token). Kein Schließen per Klick daneben. */
      '#vivi-ov.oabi-ov{z-index:99998}',
      '#vivi-ov .oabi-modal{width:min(760px,100%);max-height:92vh}',
      '#vivi-ov .oabi-body{padding:14px 22px 16px;font:400 13px/1.5 Inter,system-ui,sans-serif;color:var(--ch, #2A2727)}',
      '#vivi-ov .oabi-body p{margin:0 0 10px}',
      '#vivi-ov .oabi-foot{flex:none;align-items:center}',
      '#vivi-ov .vivi-wahlliste{display:flex;flex-direction:column;gap:6px;margin:6px 0}',
      '#vivi-ov .vivi-wahlliste label.vivi-wahl{margin:0;padding:9px 11px;border:1px solid var(--border, #E7E2DC);border-radius:10px;cursor:pointer}',
      '#vivi-ov .vivi-wahlliste label.vivi-wahl:has(input:checked){border-color:var(--wl-c9a84c, #C9A84C);background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 7%, #fff)}',
      '@media (max-width:640px){#vivi-ov.oabi-ov{padding:0;align-items:stretch}#vivi-ov .oabi-modal{max-height:none;height:100%;width:100%;border-radius:0;border:0}#vivi-ov .oabi-body{padding:12px 14px}}',
      '.vivi-obj-liste{margin-top:10px;border:1px solid var(--border, #E7E2DC);border-radius:10px;overflow:hidden}',
      '.vivi-obj-liste .vivi-obj{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:9px 12px;border-top:1px solid var(--border, #E7E2DC);font:400 12.5px/1.4 Inter,system-ui,sans-serif}',
      '.vivi-obj-liste .vivi-obj:first-child{border-top:0}',
      '.vivi-obj-liste .vivi-obj-adr{flex:1 1 220px;min-width:0}',
      '.vivi-obj-liste .vivi-obj-st{display:block;color:var(--muted, #7A7370);font-size:11.5px}',
      '.vivi-obj-liste .vivi-obj-k{display:flex;gap:6px;flex-wrap:wrap}',
      '.vivi-obj-liste .vivi-obj-k .btn-ghost{border:1px solid var(--border, #E7E2DC) !important;background:#fff !important;color:var(--ch, #2A2727) !important}',
      '#vivi-ov table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12.5px}',
      '#vivi-ov td,#vivi-ov th{padding:5px 6px;border-bottom:1px solid rgba(42,39,39,.1);text-align:left;vertical-align:top}',
      '#vivi-ov th{font:600 10px/1.2 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370}',
      '#vivi-ov .vivi-notiz{color:#7A7370;font-size:11.5px}',
      '#vivi-ov .vivi-fehlt{border-left:3px solid #B8625C;padding:6px 10px;margin:8px 0;background:rgba(184,98,92,.07)}',
      '#vivi-ov .vivi-hinw{border-left:3px solid var(--wl-c9a84c, #C9A84C);padding:6px 10px;margin:8px 0;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 7%, transparent)}',
      '#vivi-ov .vivi-fuss{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:12px}',
      '#vivi-ov label.vivi-wahl{display:flex;gap:8px;align-items:center;margin:6px 0}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Einstellungen: Verbindung ───────────────────────────────────── */
  function verbindungKarte(host) {
    if (!host) return;
    frei().then(function (ok) {
      if (!ok) { host.innerHTML = window.DpViviZugang ? window.DpViviZugang.upgradeHtml() : ''; return; }   /* v4350 · Starter/Free: Hinweis statt nichts */
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
        '<div id="pk-vivi-ergebnis" class="hint" style="margin-top:8px"></div><div id="pk-vivi-objekte" class="hint" style="margin-top:8px"></div>' +
        '<div id="pk-vivi-steuer"></div><div id="pk-vivi-import-host"></div>';   /* v4050 · Objekte aus ViVi uebernehmen (js/vivi-import.js) */   /* v4020 · Steuerjahre aus ViVi: aus, Vorschlag, automatisch, je Kategorie (js/vivi-steuer-abgleich.js, nicht bei Einsteiger) */
      try { if (window.DpViviSteuer) window.DpViviSteuer.einstellungKarte($('pk-vivi-steuer')); } catch (e) {}
      try { if (window.DpViviImport) window.DpViviImport.karte($('pk-vivi-import-host')); } catch (e) {}
      $('pk-vivi-probe').onclick = function () { probe(false); };
      $('pk-vivi-loeschen').onclick = function () {
        if (!confirm('ViVi-Token in DealPilot löschen? Verknüpfte Objekte bleiben verknüpft, werden aber nicht mehr gelesen.')) return;
        api('/vivi/verbindung', { method: 'DELETE' }).then(karteLaden).catch(function () { alert('Löschen fehlgeschlagen.'); });
      };
      objektListe();
    }).catch(function () { body.innerHTML = '<p class="hint">ViVi ist gerade nicht verfügbar.</p>'; });
  }

  /* v4400 · Marcel 24.11.2026: Anlegen und Verknüpfen auch hier, je Objekt. Gelistet werden deine gewonnenen bzw.
     Bestandsobjekte (wie Deal-Aktion: _deal_won oder Ankauf festgeschrieben) und alles, was schon verknüpft ist.
     Kundenstände eines Partners (kunde_ziel 'kunde') nie. */
  function objektListe() {
    var ziel = $('pk-vivi-objekte'); if (!ziel) return;
    Promise.all([
      api('/vivi/objekte').then(function (r) { return (r && r.objekte) || []; }).catch(function () { return []; }),
      api('/objects').then(function (r) { return (r && (r.items || r.objects)) || []; }).catch(function () { return []; })
    ]).then(function (x) {
      var ziel2 = $('pk-vivi-objekte'); if (!ziel2) return;
      var V = {}; x[0].forEach(function (v) { V[String(v.object_id)] = v; });
      var L = x[1].filter(function (o) {
        if (o.kunde_ziel === 'kunde') return false;
        return V[String(o.id)] || o.deal_won === true || !!o.ankauf_stichtag || !!o.ankauf_kurz;
      });
      if (!L.length) { ziel2.innerHTML = '<p class="hint" style="margin:0">Noch kein Objekt im Bestand. Anlegen und Verknüpfen geht, sobald ein Objekt gewonnen ist.</p>'; return; }
      ziel2.innerHTML = '<b>Deine Objekte im Bestand</b><div class="vivi-obj-liste">' + L.map(function (o) {
        var v = V[String(o.id)], st, k = '';
        var adr = [o.str, o.hnr].filter(Boolean).join(' ') + (o.ort ? ', ' + o.ort : '');
        if (v && v.anlage_status === 'fertig') st = 'Mit ViVi verknüpft · ' + standText(v.letzter_abruf) + (v.letzter_fehler ? ' · ' + v.letzter_fehler : '');
        else if (v && v.anlage_status === 'abgebrochen') { st = 'Übertragung unterbrochen. Ein neuer Versuch setzt an der letzten Stelle fort.'; k = '<button type="button" class="btn btn-sm btn-gold" data-vivi-obj="anlegen" data-id="' + esc(o.id) + '">Fortsetzen</button>'; }
        else if (v) st = 'Übertragung läuft';
        else { st = 'Nicht mit ViVi verknüpft'; k = '<button type="button" class="btn btn-sm btn-gold" data-vivi-obj="anlegen" data-id="' + esc(o.id) + '">In ViVi anlegen</button><button type="button" class="btn btn-sm btn-ghost" data-vivi-obj="zuordnen" data-id="' + esc(o.id) + '">Verknüpfen</button>'; }
        return '<div class="vivi-obj"><span class="vivi-obj-adr"><b>' + esc(o.kuerzel || o.seq_no || '') + '</b> ' + esc(adr || o.name || '') + '<span class="vivi-obj-st">' + esc(st) + '</span></span><span class="vivi-obj-k">' + k + '</span></div>';
      }).join('') + '</div>';
    });
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('#pk-vivi-objekte [data-vivi-obj]') : null;
    if (!b) return;
    ev.preventDefault();
    var id = b.getAttribute('data-id');
    if (b.getAttribute('data-vivi-obj') === 'anlegen') anlegen(id); else zuordnen(id);
  });
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
        (st.info.restschuld_heute.sondertilgung ? ' nach ' + Math.round(st.info.restschuld_heute.sondertilgung).toLocaleString('de-DE') + ' € Sondertilgung' : '') + '.';
      /* v3996 · alle Schlösser auf einmal */
      var ze = window.DpViviFelder && window.DpViviFelder.anzahlEigen ? window.DpViviFelder.anzahlEigen() : { alle: 0, eigen: 0 };
      if (ze.eigen) text += ' ' + ze.eigen + ' davon legst du selbst fest.';
      var alleKnopf = !ze.alle ? '' : (ze.eigen < ze.alle
        ? '<button type="button" class="btn btn-sm btn-ghost" data-vivi="alle-selbst" title="Alle Werte aus ViVi in DealPilot selbst festlegen. Sie werden nicht nach ViVi übertragen.">Alle selbst festlegen</button>'
        : '')
        + (ze.eigen ? '<button type="button" class="btn btn-sm btn-ghost" data-vivi="alle-vivi" title="Alle eigenen Angaben verwerfen und die Werte aus ViVi übernehmen.">Alle aus ViVi übernehmen</button>' : '');
      /* v4040 · Absprung in den Reiter ViVi der Pilot-Analyse */
      knoepfe = (window.DpViviReiter && window.DpViviReiter.sichtbar() ? '<button type="button" class="btn btn-sm btn-gold" data-vivi="reiter">Abgleich mit ViVi</button>' : '') + '<button type="button" class="btn btn-sm btn-ghost" data-vivi="abgleichen">Jetzt abgleichen</button>' + alleKnopf + '<button type="button" class="btn btn-sm btn-ghost" data-vivi="loesen">Verknüpfung lösen</button>';
    } else {
      /* v4400 · Marcel 24.11.2026: „In ViVi anlegen“ und „Mit ViVi-Objekt verknüpfen“ gehören nicht in den Reiter Objekt.
         Anlegen, Verknüpfen und Fortsetzen stehen jetzt in Deal-Aktion (js/buchhaltung-verbinden.js) und in den
         Einstellungen › Externe Anbieter › ViVi (Objektliste). Im Reiter Objekt bleibt die Leiste nur für verknüpfte
         Objekte, weil sie die ausgegrauten Felder erklärt. */
      l.style.display = 'none'; l.innerHTML = ''; return;
    }
    l.innerHTML = '<span class="vivi-marke">ViVi</span><span class="vivi-text">' + esc(text) + '</span><span class="vivi-knoepfe">' + knoepfe + '</span>';
  }
  function leisteWeg() { var l = $('vivi-leiste'); if (l) l.style.display = 'none'; }

  /* v4020 · jeder neue Stand geht an js/vivi-steuer-abgleich.js (Steuerjahre, Jahresabgleich, automatisch) */
  function standMelden() { try { window.dispatchEvent(new CustomEvent('dp:vivi-stand', { detail: { key: _key, stand: _stand } })); } catch (e) {} }
  function werteAnwenden(r) {
    _stand = r || null;
    var geaendert = false;
    try { if (window.DpViviFelder) geaendert = window.DpViviFelder.setzen(_stand); } catch (e) { console.warn('[vivi] Felder:', e && e.message); }
    leiste();
    standMelden();
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
          /* v4050 · importiertes Objekt: erst den Ankauf zum Kaufdatum festschreiben (Formular = Stand zum Kauf),
             dann die Werte von heute darueber (js/vivi-import.js) */
          var vor = (window.DpViviImport && r.herkunft === 'importiert') ? window.DpViviImport.vorAnwenden(key, r) : Promise.resolve(false);
          return vor.then(function (neuFest) {
            if (window._currentObjKey !== key) return;
            werteAnwenden(r);
            if (neuFest && typeof window.saveObj === 'function') setTimeout(function () { try { if (window._currentObjKey === key) window.saveObj(true); } catch (e) {} }, 500);
            var alt = !r.letzter_abruf || (Date.now() - new Date(r.letzter_abruf).getTime() > ABGLEICH_NACH_MS);
            if (alt) abgleichen(true);
          });
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
        /* v3996 · in ViVi geloescht: das Backend hat die Verknuepfung schon geloest. Sperren weg, Werte bleiben. */
        if (e && e.code === 'in_vivi_geloescht') {
          if (window._currentObjKey !== key) return;
          _stand = { verknuepft: false, status: null };
          try { if (window.DpViviFelder) window.DpViviFelder.setzen(_stand); } catch (x) {}
          leiste();
          meldung(e.message || 'Dieses Objekt gibt es in ViVi nicht mehr. Die Verknüpfung ist gelöst.');
          if (typeof window.saveObj === 'function') setTimeout(function () { try { if (window._currentObjKey === key) window.saveObj(); } catch (x) {} }, 300);
          return;
        }
        if (!still) alert((e && e.message) || 'Abgleich fehlgeschlagen.');
        api('/vivi/objekt/' + encodeURIComponent(key) + '/werte').then(function (r) { if (window._currentObjKey === key) { _stand = r; leiste(); } }).catch(function () {});
      });
    }).then(function () { _laeuft = false; }, function () { _laeuft = false; });
  }

  /* ── Fenster ─────────────────────────────────────────────────────── */
  /* v4400 · Rahmen wie „Belege einlesen“: .oabi-ov mit Kopf (h3), Unterzeile, Inhalt und Fuß. modal-boarding-skin.js
     legt Obsidian-Leiste mit × und Gold-Kopf darüber (Whitelabel-Token). Das × klickt den ersten Nicht-Haupt-Knopf im Fuß
     (Abbrechen bzw. Schließen), solange eine Übertragung läuft, ist der gesperrt. Kein Schließen per Klick daneben. */
  function fenster(titel, sub, body) {
    schliessen();
    var ov = document.createElement('div'); ov.id = 'vivi-ov'; ov.className = 'oabi-ov';
    ov.innerHTML = '<div class="oabi-modal" role="dialog" aria-modal="true" aria-label="' + esc(titel) + '">' +
      '<div class="oabi-head"><h3>' + esc(titel) + '</h3></div><div class="oabi-sub">' + esc(sub || '') + '</div>' +
      '<div class="oabi-body vivi-karte">' + (body || '') + '</div><div class="oabi-foot" id="vivi-fuss"></div></div>';
    document.body.appendChild(ov);
    return ov;
  }
  function inhalt(ov, body, fuss) {
    var b = ov.querySelector('.vivi-karte'); if (b) b.innerHTML = body;
    var f = ov.querySelector('#vivi-fuss'); if (f) f.innerHTML = fuss || '';
  }
  function fk(id, text, haupt, aus) { return '<button type="button" class="oabi-btn' + (haupt ? ' primary' : '') + '" id="' + id + '"' + (aus ? ' disabled' : '') + '>' + text + '</button>'; }
  function schliessenKnopf(ov) { inhalt(ov, ov.querySelector('.vivi-karte').innerHTML, fk('vivi-abbrechen', 'Schließen')); $('vivi-abbrechen').onclick = schliessen; }
  function schliessen() { var o = $('vivi-ov'); if (o) o.remove(); }
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && $('vivi-ov') && !_anlegenLaeuft) schliessen(); });

  /* v4400 · nach Anlegen oder Verknüpfen: Objekt offen → Werte lesen, sonst nur die Listen neu (Einstellungen, Deal-Aktion) */
  function nachher(key) {
    try { if (window.DpBuchhaltung) window.DpBuchhaltung.zeigen(); } catch (x) {}
    objektListe();
    if (key === _key) return abgleichen(true);
    return null;
  }

  /** In ViVi anlegen. k = Objekt-ID (aus den Einstellungen), ohne = das offene Objekt. */
  function anlegen(k) {
    var key = (typeof k === 'string' && k) ? k : _key;
    if (!key) { alert('Bitte das Objekt zuerst speichern.'); return; }
    if (_anlegenLaeuft) { meldung('Die Übernahme nach ViVi läuft schon.'); return; }
    frei().then(function (ok) {
      if (!ok) return;
      stil();
      var TITEL = 'In ViVi anlegen', SUB = 'Diese Werte gehen einmal an ViVi. Danach liest DealPilot nur noch aus ViVi und schreibt nichts zurück.';
      var ov = fenster(TITEL, SUB, '<p>Lade Vorschau…</p>');
      inhalt(ov, '<p>Lade Vorschau…</p>', fk('vivi-abbrechen', 'Abbrechen'));
      $('vivi-abbrechen').onclick = schliessen;
      var opt = function () {
        var pz = $('vivi-platzhalter'), ma = $('vivi-muster'), ft = $('vivi-faellig'), ac = $('vivi-account');
        return { platzhalter_namen: !!(pz && pz.checked), muster_anschrift: !!(ma && ma.checked), faellig_tag: ft ? Number(ft.value) || 3 : 3, account_id: ac && ac.value ? ac.value : null };
      };
      var zeichnen = function (v, accounts, o) {
        o = o || {};
        /* v3951 · die Vorgaben des Servers gelten, bis der Kunde umschaltet */
        if (v.optionen) { if (o.platzhalter_namen === undefined) o.platzhalter_namen = v.optionen.platzhalter_namen; if (o.muster_anschrift === undefined) o.muster_anschrift = v.optionen.muster_anschrift; }
        var zeilen = (v.vorschau || []).map(function (z) {
          return '<tr><td>' + esc(z.bereich) + '</td><td>' + esc(z.feld) + '</td><td>' + esc(z.wert) + (z.notiz ? '<div class="vivi-notiz">' + esc(z.notiz) + '</div>' : '') + '</td></tr>';
        }).join('');
        var fehlt = (v.fehlt || []).length ? '<div class="vivi-fehlt"><b>Diese Angaben braucht ViVi noch:</b><br>' + v.fehlt.map(function (f) { return esc(f.text); }).join('<br>') + '</div>' : '';
        var hinw = (v.hinweise || []).length ? '<div class="vivi-hinw">' + v.hinweise.map(esc).join('<br>') + '</div>' : '';
        var acc = (accounts && accounts.length > 1) ? '<label class="vivi-wahl">Bereich in ViVi <select id="vivi-account">' + accounts.map(function (a) {
          return '<option value="' + esc(a.id) + '"' + ((o.account_id ? String(o.account_id) === String(a.id) : a.is_default) ? ' selected' : '') + '>' + esc(a.name) + (a.label ? ' (' + esc(a.label) + ')' : '') + '</option>';
        }).join('') + '</select></label>' : '';
        /* v4400 · Marcel 24.11.2026: der Block „Was genau an ViVi geht“ zeigte die Rohdaten als Code. Raus, die Tabelle
           darüber nennt jeden Wert lesbar (Objekt, Einheiten, Mietverhältnisse, Darlehen). */
        inhalt(ov,
          '<p>Verknüpfte Felder sind danach in DealPilot ausgegraut.</p>' +
          fehlt + hinw +
          '<table><thead><tr><th>Bereich</th><th>Feld</th><th>Wert</th></tr></thead><tbody>' + zeilen + '</tbody></table>' +
          acc +
          '<label class="vivi-wahl"><input type="checkbox" id="vivi-platzhalter"' + (o.platzhalter_namen ? ' checked' : '') + '> Mieternamen durch Platzhalter ersetzen</label>' +
          '<label class="vivi-wahl"><input type="checkbox" id="vivi-muster"' + (o.muster_anschrift ? ' checked' : '') + '> Anschrift durch Musteranschrift ersetzen' + (v.optionen && v.optionen.testbetrieb ? ' (Testbetrieb)' : '') + '</label>' +
          '<label class="vivi-wahl">Miete fällig am <input type="number" id="vivi-faellig" min="1" max="31" value="' + esc(o.faellig_tag || 3) + '" style="width:64px"> des Monats</label>',
          fk('vivi-abbrechen', 'Abbrechen') +
          (v.gesperrt ? '<span class="hint">Schon mit ViVi verknüpft.</span>' : fk('vivi-los', 'Jetzt in ViVi anlegen', true, !v.ok)));
        $('vivi-abbrechen').onclick = schliessen;
        ['vivi-platzhalter', 'vivi-muster', 'vivi-faellig'].forEach(function (id) { var e = $(id); if (e) e.onchange = function () { neu(); }; });
        var los = $('vivi-los');
        if (los) los.onclick = function () {
          if (_anlegenLaeuft) return;
          /* v3967 · Wartehinweis: ViVi legt je Mietverhaeltnis alle Sollstellungen ab Mietbeginn an. Gemessen bis 113 s.
             Knopf und Fenster bleiben gesperrt, bis die Antwort da ist (auch × und Esc). */
          _anlegenLaeuft = true; leiste();
          los.disabled = true; los.textContent = 'Wird angelegt…';
          Array.prototype.forEach.call(ov.querySelectorAll('input, select, #vivi-abbrechen'), function (x) { x.disabled = true; });
          var n = (v.anzahl && v.anzahl.mietverhaeltnisse) || 0;
          var warte = document.createElement('div'); warte.className = 'vivi-hinw'; warte.id = 'vivi-warte';
          var t0 = Date.now();
          var zeichneWarte = function () {
            var s = Math.round((Date.now() - t0) / 1000);
            warte.textContent = 'Übertragung läuft, ' + s + ' s. ' + (n > 2 ? 'Bei einem Mehrfamilienhaus kann das bis zu zwei Minuten dauern, weil ViVi alle Mieten ab Mietbeginn anlegt. ' : 'Das dauert meist nur Sekunden. ') + 'Bitte das Fenster offen lassen.';
          };
          zeichneWarte();
          var body = ov.querySelector('.vivi-karte'); if (body) body.insertBefore(warte, body.firstChild);
          var uhr = setInterval(zeichneWarte, 1000);
          var fertig = function () { clearInterval(uhr); _anlegenLaeuft = false; };
          var b = opt(); b.bestaetigt = true;
          api('/vivi/objekt/' + encodeURIComponent(key) + '/anlegen', { method: 'POST', body: b, timeout: 240000 }).then(function () {
            fertig(); schliessen(); meldung('In ViVi angelegt');
            return nachher(key);
          }).catch(function (e) {
            fertig();
            alert((e && e.message) || 'Anlegen fehlgeschlagen.');
            schliessen();
            if (key === _key) api('/vivi/objekt/' + encodeURIComponent(key) + '/werte').then(function (r) { if (window._currentObjKey === key) { _stand = r; leiste(); } }).catch(function () {});
            objektListe();
          }).then(function () { try { if (window.DpBuchhaltung) window.DpBuchhaltung.zeigen(); } catch (x) {} });
        };
      };
      var accounts = null;
      var neu = function () {
        var o = $('vivi-platzhalter') ? opt() : {};
        api('/vivi/objekt/' + encodeURIComponent(key) + '/vorschau', { method: 'POST', body: o }).then(function (v) { zeichnen(v, accounts, o); })
          .catch(function (e) { inhalt(ov, '<p>' + esc((e && e.message) || 'Vorschau nicht möglich.') + '</p>'); schliessenKnopf(ov); });
      };
      api('/vivi/verbindung/probe', { method: 'POST', body: {} }).then(function (r) { accounts = (r && r.accounts) || null; }).catch(function () { accounts = null; }).then(neu);
    });
  }

  /** Mit einem Objekt verknüpfen, das es in ViVi schon gibt. k = Objekt-ID, ohne = das offene Objekt. */
  function zuordnen(k) {
    var key = (typeof k === 'string' && k) ? k : _key;
    if (!key) return;
    frei().then(function (ok) {
      if (!ok) return;
      stil();
      var TITEL = 'Mit ViVi-Objekt verknüpfen', SUB = 'Das Objekt gibt es schon in ViVi? Dann wähle es aus. Es wird nichts an ViVi geschickt, DealPilot liest danach die Werte.';
      var ov = fenster(TITEL, SUB, '<p>Lade deine Objekte aus ViVi…</p>');
      inhalt(ov, '<p>Lade deine Objekte aus ViVi…</p>', fk('vivi-abbrechen', 'Abbrechen'));
      $('vivi-abbrechen').onclick = schliessen;
      Promise.all([api('/vivi/projekte'), api('/vivi/objekte').catch(function () { return {}; })]).then(function (x) {
        var r = x[0];
        /* v4400 · ViVi-Objekte, die schon mit einem DealPilot-Objekt verknüpft sind, stehen unten und sind nicht wählbar */
        var belegt = {}; ((x[1] && x[1].objekte) || []).forEach(function (v) { if (v.vivi_objekt_id) belegt[String(v.vivi_objekt_id)] = [v.str, v.hnr].filter(Boolean).join(' '); });
        var L = ((r && r.projekte) || []).slice().sort(function (a, b) { return (belegt[String(a.id)] ? 1 : 0) - (belegt[String(b.id)] ? 1 : 0); });
        var frei0 = L.filter(function (p) { return !belegt[String(p.id)]; }).length;
        inhalt(ov,
          (L.length ? '<div class="vivi-wahlliste">' + L.map(function (p, i) {
            var b = belegt[String(p.id)];
            return '<label class="vivi-wahl"' + (b ? ' style="opacity:.55;cursor:default"' : '') + '><input type="radio" name="vivi-proj" value="' + esc(p.id) + '"' + (b ? ' disabled' : (i === 0 ? ' checked' : '')) + '> <span>' + esc([p.street, p.house_number].filter(Boolean).join(' ') + ', ' + [p.postal_code, p.city].filter(Boolean).join(' ')) + (b ? ' <span class="vivi-notiz">schon verknüpft mit ' + esc(b) + '</span>' : (p.name ? ' <span class="vivi-notiz">' + esc(p.name) + '</span>' : '')) + '</span></label>';
          }).join('') + '</div>' : '<p class="hint">In ViVi ist noch kein Objekt angelegt.</p>') +
          (L.length && !frei0 ? '<p class="hint">Alle Objekte in ViVi sind schon mit DealPilot verknüpft. Lege das Objekt neu in ViVi an.</p>' : ''),
          fk('vivi-abbrechen', 'Abbrechen') + (frei0 ? fk('vivi-los', 'Verknüpfen', true) : ''));
        $('vivi-abbrechen').onclick = schliessen;
        var los = $('vivi-los');
        if (los) los.onclick = function () {
          var w = ov.querySelector('input[name="vivi-proj"]:checked'); if (!w) return;
          los.disabled = true;
          api('/vivi/objekt/' + encodeURIComponent(key) + '/zuordnen', { method: 'POST', body: { vivi_objekt_id: w.value } })
            .then(function () { schliessen(); meldung('Mit ViVi verknüpft'); return nachher(key); })
            .catch(function (e) { alert((e && e.message) || 'Verknüpfen fehlgeschlagen.'); los.disabled = false; });
        };
      }).catch(function (e) { inhalt(ov, '<p>' + esc((e && e.message) || 'ViVi nicht erreichbar.') + '</p>'); schliessenKnopf(ov); });
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
        try { if (window.DpBuchhaltung) window.DpBuchhaltung.zeigen(); } catch (x) {}   /* v4400 · Deal-Aktion bietet wieder Anlegen und Verknüpfen */
        objektListe();
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
    else if (was === 'reiter') { try { window.DpViviReiter.oeffnen(); } catch (e) {} }
    else if (was === 'loesen') loesen();
    else if (was === 'alle-selbst' || was === 'alle-vivi') alleSchloesser(was === 'alle-selbst');
  });
  function alleSchloesser(an) {
    if (!window.DpViviFelder || !window.DpViviFelder.alleSelbst) return;
    if (!confirm(an ? 'Alle Werte aus ViVi in DealPilot selbst festlegen? Sie bleiben, wie sie sind, werden aber nicht mehr aus ViVi aktualisiert und nicht nach ViVi übertragen.'
                    : 'Alle eigenen Angaben verwerfen und die Werte aus ViVi übernehmen?')) return;
    var key = _key;
    var g = window.DpViviFelder.alleSelbst(an);
    leiste();
    meldung(an ? 'Alle Werte selbst festgelegt' : 'Werte aus ViVi übernommen');
    if (g && typeof window.saveObj === 'function') setTimeout(function () { try { if (window._currentObjKey === key) window.saveObj(); } catch (e) {} }, 300);
  }
  window.addEventListener('dp:object-ready', function (ev) {
    var key = (ev && ev.detail && (ev.detail.key || ev.detail.id)) || window._currentObjKey || null;
    setTimeout(function () { objektGeladen(window._currentObjKey || key); }, 500);
  });

  /* v3967 · Statuswechsel (gewonnen, offen, verloren) aus js/buchhaltung-verbinden.js: Leiste neu zeichnen */
  window.addEventListener('dp:buchhaltung-status', function () { frei().then(function (ok) { if (ok && _key) leiste(); }); });

  /* v3996 · Marcel 23.11.2026: „Warum nur im Reiter Objekt?“ Die Felder liegen in Objekt, Investition, Miete und
     Finanzierung. Die Reiter werden aus den gelieferten Feldern gemessen (Feld im DOM → Abschnitt → Reiter der Leiste). */
  function reiterVon(felder) {
    var reihe = [], gesehen = {};
    Array.prototype.forEach.call(document.querySelectorAll('nav.tabs .tab[data-target-sec]'), function (b) { reihe.push(b.getAttribute('data-target-sec')); });
    Object.keys(felder || {}).forEach(function (id) {
      var sec = /^einheit\./.test(id) ? 's2' : null;
      if (!sec) { var el = $(id); var s = el && el.closest ? el.closest('.sec[id]') : null; sec = s ? s.id : null; }
      if (sec) gesehen[sec] = true;
    });
    return reihe.filter(function (s) { return gesehen[s]; }).map(function (s) {
      var b = document.querySelector('nav.tabs .tab[data-target-sec="' + s + '"] .tab-lbl'); return b ? b.textContent.trim() : null;
    }).filter(Boolean);
  }
  function reiterText(felder) {
    var r = reiterVon(felder);
    if (!r.length) return 'Die Werte kommen aus ViVi und sind ausgegraut.';
    var liste = r.length === 1 ? r[0] : r.slice(0, -1).join(', ') + ' und ' + r[r.length - 1];
    return 'Die Werte kommen aus ViVi und sind ' + (r.length === 1 ? 'im Reiter ' : 'in den Reitern ') + liste + ' ausgegraut.';
  }

  /* v3967 · Anbieter in der Schicht „Buchhaltung verbinden“ (js/buchhaltung-verbinden.js) */
  function anmelden() {
    if (!window.DpBuchhaltung) return;
    window.DpBuchhaltung.anbieter({
      id: 'vivi', name: 'ViVi', frei: frei,
      verbunden: function () { return verbindung(); },
      status: function (key) {
        if (_anlegenLaeuft && key === _key) return { laeuft: true, text: 'Die Übernahme nach ViVi läuft. Bei einem Mehrfamilienhaus kann das bis zu zwei Minuten dauern.' };
        return api('/vivi/objekt/' + encodeURIComponent(key) + '/werte').then(function (r) {
          if (r && r.verknuepft) return { verknuepft: true, text: 'In ViVi verwaltet. ' + standText(r.letzter_abruf) + '. ' + reiterText(r.felder) };
          if (r && r.status === 'laeuft') return { laeuft: true };
          if (r && r.status === 'abgebrochen') return { verknuepft: false, unterbrochen: true, text: '' };   /* v4400 */
          return { verknuepft: false };
        });
      },
      uebernehmen: anlegen,
      verknuepfen: zuordnen,   /* v4400 · zweiter Knopf in Deal-Aktion */
      loesen: loesen,
      /* v4040 · Deal-Aktion nach „gewonnen“: Absprung in den Abgleich */
      abgleich: function () { if (window.DpViviReiter && window.DpViviReiter.sichtbar()) return window.DpViviReiter.oeffnen(); return false; }
    });
  }
  if (window.DpBuchhaltung) anmelden(); else document.addEventListener('DOMContentLoaded', anmelden);

  window.DpVivi = { verbindungKarte: verbindungKarte, leiste: leiste, anlegen: anlegen, abgleichen: abgleichen, zuordnen: zuordnen, loesen: loesen, objektGeladen: objektGeladen,
    /* v4017 · der letzte Stand aus ViVi (felder, info: restschuld_heute, sondertilgungen) für den Jahresabgleich, nur lesen */
    stand: function () { return _stand && _stand.verknuepft ? _stand : null; } };
})();
