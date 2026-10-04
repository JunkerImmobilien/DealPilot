/* telegram-panel.js — Telegram-Bot in den Einstellungen (v1791)
 *
 * Marcel am 02.10.2026: der Bot "muss ueber einstellungen vernuenftig
 * einzurichten sein". Das ist diese Flaeche.
 *
 * SELBST-EINHAENGEND, wie `apikeys.js`: eigener Host-Div, kein Eingriff in
 * settings.js. Zwei Dateien fuer eine Flaeche zu aendern ist die haeufigste
 * Art, eine davon zu vergessen.
 *
 * ── WAS DIESE FLAECHE NICHT TUT ──────────────────────────────────────────
 *
 * Sie verspricht nichts, was es noch nicht gibt. Solange der Server
 * `bot_bereit: false` meldet (kein TELEGRAM_BOT_TOKEN in der Umgebung),
 * steht hier, dass der Bot noch eingerichtet wird — und es gibt KEINEN
 * Knopf, der einen Code erzeugt.
 *
 *   > Ein Einrichtungsweg, der am Ende ins Leere fuehrt, ist schlimmer als
 *   > einer, der fehlt. Der fehlende kostet eine Frage, der leere eine
 *   > Viertelstunde und das Vertrauen.
 *
 * Das ist dieselbe Lehre wie bei "3 Berater-Seats inklusive" — ein
 * beworbenes Versprechen ohne Code, der es durchsetzt.
 */
(function () {
  'use strict';
  var HOST_ID = 'dp-telegram-host';
  var _laeuft = false;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function _fmt(ts) {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleDateString('de-DE'); } catch (e) { return '—'; }
  }
  function _api(path, opts) {
    if (!(window.Auth && window.Auth.apiCall)) return Promise.reject(new Error('Auth fehlt'));
    return window.Auth.apiCall('/telegram' + path, opts || {});
  }

  function _mount() {
    try {
      var pane = document.querySelector('.st-pane[data-pane="account"]');
      if (!pane) return;
      var host = document.getElementById(HOST_ID);
      if (host) {
        if (host.getAttribute('data-dptg-rendered')) return;
      } else {
        host = document.createElement('div');
        host.id = HOST_ID;
        host.style.marginTop = '18px';
        /* Unter das API-Key-Panel, wenn es da ist — beide gehoeren zum
           Thema "Zugaenge von aussen". */
        var apik = document.getElementById('dp-apikey-host');
        if (apik) apik.insertAdjacentElement('afterend', host);
        else pane.appendChild(host);
      }
      host.setAttribute('data-dptg-rendered', '1');
      _render(host);
    } catch (e) {}
  }

  async function _render(host) {
    host.innerHTML = '<div class="f"><label>Telegram-Bot</label>'
      + '<div style="color:var(--muted);font-size:13px">Wird geladen …</div></div>';
    var s;
    try {
      s = await _api('/status', {});
    } catch (e) {
      host.innerHTML = '<div class="f"><label>Telegram-Bot</label>'
        + '<div style="color:var(--muted);font-size:13px">Status nicht abrufbar: '
        + _esc(e && e.message || e) + '</div></div>';
      return;
    }
    _renderBody(host, s);
  }

  function _renderBody(host, s) {
    var h = '<div class="f"><label>Telegram-Bot</label>';

    /* ── Fall 1: noch kein eigener Bot hinterlegt ─────────────────────── */
    if (!s.bot_bereit) {
      h += '<div style="color:var(--muted);font-size:13px;line-height:1.6">'
        + 'DealPilot per Telegram bedienen — Objekte abfragen, Felder ändern, '
        + 'neue Objekte per Sprachnachricht anlegen und Portfolio-Zahlen abrufen.'
        + '<br><br><b>Dein eigener Bot, dein Name.</b> Du legst ihn in Telegram '
        + 'selbst an und trägst ihn hier ein — niemand sonst hat Zugriff darauf.'
        + '</div>';

      h += '<ol style="color:var(--muted);font-size:13px;line-height:1.7;'
        + 'margin:12px 0 0;padding-left:20px">'
        + '<li>In Telegram <b>@BotFather</b> öffnen und <b>/newbot</b> schicken.</li>'
        + '<li>Einen Namen vergeben (frei wählbar) und einen Benutzernamen, '
        + 'der auf <b>bot</b> endet.</li>'
        + '<li>BotFather antwortet mit einem Token der Form '
        + '<span style="font-family:\'JetBrains Mono\',monospace">123456789:AA…</span> '
        + '— diese Zeile hier einfügen.</li></ol>';

      if (!s.webhook_moeglich) {
        h += '<div style="margin-top:12px;font-size:13px;color:var(--warn, #D8954C)">'
          + 'Diese Installation hat noch keine öffentliche Adresse hinterlegt '
          + '(<span style="font-family:monospace">PUBLIC_API_URL</span>). '
          + 'Ohne sie kann Telegram den Bot nicht erreichen.</div>';
      }

      h += '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
        + '<input type="password" id="dp-tg-token" autocomplete="off" spellcheck="false"'
        + ' placeholder="123456789:AA…" style="flex:1 1 280px;min-width:0"'
        + ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();DealPilotTelegram.botSpeichern();}">'
        + '<button type="button" class="btn" onclick="DealPilotTelegram.botSpeichern()">Bot verbinden</button>'
        + '</div>'
        + '<div id="dp-tg-fehler" style="margin-top:8px;font-size:13px;color:var(--bad, #D8564C)"></div>';

      h += '</div>';
      host.innerHTML = h;
      return;
    }

    /* ── Der Bot ist hinterlegt: Kopfzeile mit seinem Namen ───────────── */
    if (s.bot) {
      h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;'
        + 'border-bottom:1px solid var(--border);font-size:13px">'
        + '<div style="flex:1 1 auto">'
        + '<div><b>' + _esc(s.bot.username ? '@' + s.bot.username : (s.bot.name || 'Dein Bot')) + '</b>'
        + ' <span style="color:var(--muted)">· dein eigener Bot</span></div>'
        + '<div style="color:var(--muted);font-size:12px">'
        + (s.bot.webhook_gesetzt
            ? 'empfangsbereit seit ' + _fmt(s.bot.webhook_gesetzt)
            : '<span style="color:var(--bad, #D8564C)">nicht empfangsbereit'
              + (s.bot.letzter_fehler ? ': ' + _esc(s.bot.letzter_fehler) : '') + '</span>')
        + (s.bot.token_endet_auf ? ' · Token …' + _esc(s.bot.token_endet_auf) : '')
        + '</div></div>'
        + '<button type="button" class="btn btn-ghost" style="font-size:12px"'
        + ' onclick="DealPilotTelegram.botEntfernen()">Bot entfernen</button>'
        + '</div>';
    }

    /* ── Fall 2: schon verbunden ──────────────────────────────────────── */
    if (s.verbunden) {
      h += '<div style="font-size:13px;line-height:1.6">';
      s.verbindungen.forEach(function (v) {
        h += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;'
          + 'border-bottom:1px solid var(--border)">'
          + '<span style="color:var(--ok, #3FA56C);font-size:16px">●</span>'
          + '<div style="flex:1 1 auto">'
          + '<div><b>' + _esc(v.username ? '@' + v.username : (v.vorname || 'Telegram-Chat')) + '</b>'
          + (v.aktiv ? '' : ' <span style="color:var(--muted)">(stillgelegt)</span>') + '</div>'
          + '<div style="color:var(--muted);font-size:12px">verbunden seit ' + _fmt(v.seit)
          + (v.letzte_nutzung ? ' · zuletzt genutzt ' + _fmt(v.letzte_nutzung) : '')
          + '</div></div>'
          + '<button type="button" class="btn btn-ghost" style="font-size:12px"'
          + ' onclick="DealPilotTelegram.umschalten(' + (v.aktiv ? 'false' : 'true') + ')">'
          + (v.aktiv ? 'Stilllegen' : 'Anschalten') + '</button>'
          + '<button type="button" class="btn btn-ghost" style="font-size:12px"'
          + ' onclick="DealPilotTelegram.trennen()">Trennen</button>'
          + '</div>';
      });
      h += '</div></div>';
      host.innerHTML = h;
      return;
    }

    /* ── Fall 3: bereit, aber noch nicht verbunden ────────────────────── */
    var bot = (s.bot && s.bot.username) ? '@' + s.bot.username : 'deinen Bot';
    h += '<div style="color:var(--muted);font-size:13px;line-height:1.6;margin-top:10px">'
      + 'Noch ist kein Chat verbunden. Der Code sagt dem Bot, <b>wessen</b> Daten er '
      + 'zeigen darf — ohne ihn antwortet er niemandem.</div>';

    if (s.offener_code) {
      h += '<div style="margin-top:12px;padding:14px;border:1px solid var(--border);'
        + 'border-radius:10px;background:var(--surface-2, rgba(255,255,255,.03))">'
        + '<div style="font-family:\'JetBrains Mono\',monospace;font-size:22px;'
        + 'letter-spacing:2px;color:var(--gold)">' + _esc(s.offener_code.code) + '</div>'
        + '<div style="color:var(--muted);font-size:12px;margin-top:8px;line-height:1.6">'
        + 'So verbindest du: <b>' + _esc(bot) + '</b> in Telegram öffnen, '
        + '<b>/start</b> schicken und dann diesen Code eintippen.'
        + '<br>Gültig bis ' + _esc(new Date(s.offener_code.laeuft_ab).toLocaleTimeString('de-DE',
            { hour: '2-digit', minute: '2-digit' })) + ' Uhr.</div>'
        + '<button type="button" class="btn btn-ghost" style="font-size:12px;margin-top:10px"'
        + ' onclick="DealPilotTelegram.kopieren(\'' + _esc(s.offener_code.code) + '\')">Code kopieren</button>'
        + '</div>';
    } else {
      h += '<button type="button" class="btn" style="margin-top:12px"'
        + ' onclick="DealPilotTelegram.codeHolen()">Verbindungscode erzeugen</button>';
    }
    h += '</div>';
    host.innerHTML = h;
  }

  function _neu() {
    var host = document.getElementById(HOST_ID);
    if (host) _render(host);
  }

  async function botSpeichern() {
    if (_laeuft) return;
    var feld = document.getElementById('dp-tg-token');
    var fehler = document.getElementById('dp-tg-fehler');
    var token = feld ? String(feld.value || '').trim() : '';
    if (!token) { if (fehler) fehler.textContent = 'Bitte den Token einfügen.'; return; }
    _laeuft = true;
    if (fehler) fehler.textContent = 'Prüfe den Token bei Telegram …';
    try {
      var r = await _api('/bot', { method: 'PUT', body: { token: token } });
      /* Den Token sofort aus dem Feld nehmen — er soll nicht im DOM stehen
         bleiben, auch nicht in einem Passwortfeld. */
      if (feld) feld.value = '';
      if (r && r.webhook_gesetzt === false && window.toast) {
        window.toast('⚠ Bot gespeichert, aber nicht empfangsbereit');
      }
      _neu();
    } catch (e) {
      if (fehler) fehler.textContent = (e && e.message) || String(e);
    } finally { _laeuft = false; }
  }

  async function botEntfernen() {
    try { await _api('/bot', { method: 'DELETE' }); _neu(); }
    catch (e) { if (window.toast) window.toast('⚠ ' + (e && e.message || e)); }
  }

  async function codeHolen() {
    if (_laeuft) return;
    _laeuft = true;
    try {
      await _api('/code', { method: 'POST' });
      _neu();
    } catch (e) {
      if (window.toast) window.toast('⚠ ' + (e && e.message || e));
    } finally { _laeuft = false; }
  }

  async function umschalten(an) {
    try { await _api('/aktiv', { method: 'PUT', body: { aktiv: an } }); _neu(); }
    catch (e) { if (window.toast) window.toast('⚠ ' + (e && e.message || e)); }
  }

  /* v1825 · HIER STAND "es geht nichts verloren". Das stimmt nicht mehr:
     seit v1825 loescht das Trennen auch den CHATVERLAUF — Adressen,
     Kaufpreise, den laufenden Entwurf. Das ist gewollt (Artikel 17 DSGVO),
     aber es ist ein Verlust.

       > Ein Knopf, dessen Kommentar seine Wirkung beschoenigt, ist ein
       > Knopf, den man versehentlich drueckt.

     Gefragt wird im Panel, nicht mit `confirm()`: ein Browser-Dialog
     blockiert und sieht fremd aus, und er laesst sich nicht erklaeren. */
  var _trennenOffen = false;

  async function trennen(bestaetigt) {
    if (!bestaetigt) {
      if (_trennenOffen) return;
      _trennenOffen = true;
      var host = document.getElementById(HOST_ID);
      if (!host) { _trennenOffen = false; return; }
      var box = document.createElement('div');
      box.id = 'dptg-trennen';
      box.style.cssText = 'margin:10px 0;padding:12px 14px;border-radius:10px;'
        + 'border:1px solid var(--wl-B8625C,#B8625C);background:rgba(184,98,92,.08);'
        + 'font-size:13px;line-height:1.5';
      box.innerHTML = '<b>Verbindung wirklich trennen?</b><br>'
        + 'Dabei wird auch der <b>Chatverlauf</b> im Bot gelöscht — Adressen, '
        + 'Kaufpreise und ein angefangenes Objekt. Deine Objekte in DealPilot '
        + 'bleiben unberührt, der Bot-Token bleibt hinterlegt.'
        + '<div style="margin-top:10px;display:flex;gap:8px">'
        + '<button type="button" class="btn btn-ghost" style="font-size:12px"'
        + ' onclick="DealPilotTelegram.trennen(true)">Trennen und Verlauf löschen</button>'
        + '<button type="button" class="btn btn-ghost" style="font-size:12px"'
        + ' onclick="DealPilotTelegram.trennenAbbrechen()">Abbrechen</button>'
        + '</div>';
      host.insertBefore(box, host.firstChild);
      return;
    }
    _trennenOffen = false;
    try {
      var r = await _api('/link', { method: 'DELETE' });
      _neu();
      if (window.toast) {
        window.toast('✓ Getrennt'
          + (r && r.dialoge_geloescht ? ' · Verlauf gelöscht' : ''));
      }
    } catch (e) { if (window.toast) window.toast('⚠ ' + (e && e.message || e)); }
  }

  function trennenAbbrechen() {
    _trennenOffen = false;
    var b = document.getElementById('dptg-trennen');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  function kopieren(text) {
    try {
      navigator.clipboard.writeText(text);
      if (window.toast) window.toast('✓ Code kopiert');
    } catch (e) {}
  }

  /* Hook: nach showSettings einmal einhaengen — gleiches Muster wie apikeys.js */
  function _wireShowSettings() {
    if (window._dpTgWrapped || typeof window.showSettings !== 'function') return;
    window._dpTgWrapped = true;
    var orig = window.showSettings;
    window.showSettings = function () {
      var r = orig.apply(this, arguments);
      setTimeout(_mount, 140);   /* 20 ms nach apikeys.js, damit dessen Host schon steht */
      return r;
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(_wireShowSettings, 300); });
  } else {
    setTimeout(_wireShowSettings, 300);
  }

  window.DealPilotTelegram = {
    botSpeichern: botSpeichern, botEntfernen: botEntfernen,
    codeHolen: codeHolen, umschalten: umschalten, trennen: trennen,
    /* v1825 · Der Abbrechen-Knopf der Trennen-Rueckfrage. Ohne diesen
       Export ruft das onclick ins Leere, und die Rueckfrage liesse sich
       nur durch Neuladen schliessen. */
    trennenAbbrechen: trennenAbbrechen,
    kopieren: kopieren, _mount: _mount
  };
})();
