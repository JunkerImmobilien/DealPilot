/* unterlagen-modal.js — v1834
 *
 * UNTERLAGEN BEIM AMT ANFORDERN — die Oberfläche
 *
 * Marcel am 04.10.2026: „Jetzt hatte ich überlegt: Wo können wir die am
 * besten hinpacken? Ob das eher unter Deal Aktion ist, also
 * Unterlagenanfragen, oder ob wir das vielleicht auch direkt im Tab
 * Objekt, da beim Bodenrichtwert mit angeben. … Kann sich auch gerne
 * modal aufmachen."
 *
 * ── WARUM BEIDE ORTE ────────────────────────────────────────────────────
 *
 * Er hat zwei Stellen vorgeschlagen und gefragt. Beide haben recht:
 *
 *   Deal-Aktion   dort liegt, was man MIT dem Objekt tut — neben den
 *                 Marktberichten. Das ist der Ort zum Wiederfinden.
 *   Objekt-Reiter dort FÄLLT AUF, dass man die Flurkarte braucht: beim
 *                 Bodenrichtwert, wenn Gemarkung und Flurstück leer sind.
 *                 Das ist der Ort, an dem der Bedarf entsteht.
 *
 * Ein Einstieg am Ort des Bedarfs und einer am Ort des Wiederfindens sind
 * kein doppelter Weg, sondern zwei Türen zu einem Raum. Deshalb ÖFFNEN
 * BEIDE DASSELBE MODAL — es gibt genau eine Fläche, nicht zwei.
 *
 *   > Zwei Einstiege sind erst dann ein Fehler, wenn sie zu zwei
 *   > verschiedenen Flächen führen.
 *
 * Marcel entscheidet am Lebenden, ob einer davon wieder weg soll.
 *
 * ── WAS DIESE FLÄCHE NICHT TUT ──────────────────────────────────────────
 *
 * Sie verschickt nichts. Sie erzeugt Entwürfe, zeigt sie an und legt sie
 * in die Zwischenablage. Der Versand gehört ins Mailprogramm des Nutzers.
 */
(function () {
  'use strict';

  var ID = 'dp-unterlagen-modal';
  var _arten = null;
  var _amtJeArt = {};     /* art -> Amt-Datensatz */
  var _laeuft = {};

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function _api(pfad, opts) {
    if (!(window.Auth && window.Auth.apiCall)) return Promise.reject(new Error('Auth fehlt'));
    return window.Auth.apiCall('/unterlagen' + pfad, opts || {});
  }
  function _v(id) {
    var e = document.getElementById(id);
    return e ? String(e.value || '').trim() : '';
  }

  /* Die Objektdaten kommen aus der laufenden App — nicht abgetippt.
     `window._currentObjKey` ist die einzige verlässliche Objektreferenz. */
  function _objekt() {
    return {
      objekt_id: window._currentObjKey || null,
      strasse: [_v('str'), _v('hnr')].filter(Boolean).join(' '),
      plz: _v('plz'), ort: _v('ort'),
      gemarkung: _v('gemarkung'), flur: _v('flur'), flurstueck: _v('flurstueck'),
      eigentuemer: _v('eigentuemer')
    };
  }

  function _schliessen() {
    var m = document.getElementById(ID);
    if (m) m.remove();
    document.removeEventListener('keydown', _esc_taste);
  }
  function _esc_taste(e) { if (e.key === 'Escape') _schliessen(); }

  async function oeffnen() {
    if (document.getElementById(ID)) return;
    var o = _objekt();

    var hu = document.createElement('div');
    hu.id = ID;
    hu.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(5,5,5,.72);'
      + 'display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:28px 16px';
    hu.addEventListener('click', function (e) { if (e.target === hu) _schliessen(); });

    hu.innerHTML = '<div style="background:var(--surface,#14110f);border:1px solid var(--border,#2a2522);'
      + 'border-radius:14px;max-width:860px;width:100%;padding:0;overflow:hidden">'
      + '<div style="display:flex;align-items:center;gap:12px;padding:16px 20px;'
      + 'border-bottom:1px solid var(--border,#2a2522)">'
      + '<div style="flex:1 1 auto">'
      + '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:17px;font-weight:600">'
      + 'Unterlagen beim Amt anfordern</div>'
      + '<div style="color:var(--muted,#8b8678);font-size:12.5px;margin-top:2px">'
      + (o.strasse || o.ort
          ? _esc([o.strasse, [o.plz, o.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '))
          : '<span style="color:var(--warn,#D8954C)">Kein Objekt geladen — '
            + 'Adresse fehlt</span>')
      + '</div></div>'
      + '<button type="button" class="btn btn-ghost" style="font-size:13px"'
      + ' onclick="DealPilotUnterlagen.schliessen()">Schließen</button>'
      + '</div>'
      + '<div id="dp-ul-body" style="padding:18px 20px;max-height:72vh;overflow:auto">'
      + '<div style="color:var(--muted,#8b8678);font-size:13px">Lade …</div>'
      + '</div></div>';

    document.body.appendChild(hu);
    document.addEventListener('keydown', _esc_taste);
    await _aufbauen();
  }

  async function _aufbauen() {
    var body = document.getElementById('dp-ul-body');
    if (!body) return;
    var o = _objekt();

    if (!_arten) {
      try { _arten = (await _api('/arten', {})).arten || []; }
      catch (e) {
        body.innerHTML = '<div style="color:var(--bad,#D8564C);font-size:13px">'
          + 'Konnte die Unterlagenarten nicht laden: ' + _esc(e.message || e) + '</div>';
        return;
      }
    }

    var h = '';
    if (!o.plz && !o.ort) {
      h += '<div style="padding:12px;border:1px solid var(--warn,#D8954C);border-radius:10px;'
        + 'font-size:13px;line-height:1.6;margin-bottom:14px">'
        + 'Ohne Postleitzahl und Ort lässt sich keine Zuständigkeit bestimmen. '
        + 'Trage sie im Reiter <b>Objekt</b> ein und öffne diese Fläche erneut.</div>';
    }

    /* Die Flurangaben sind nicht Pflicht, aber sie ersparen dem Amt die
       Suche — und damit dem Nutzer eine Woche. Deshalb steht hier, was
       fehlt, statt es stillschweigend wegzulassen. */
    var fehlendFlur = ['gemarkung', 'flur', 'flurstueck'].filter(function (k) { return !o[k]; });
    if (fehlendFlur.length) {
      h += '<div style="color:var(--muted,#8b8678);font-size:12.5px;line-height:1.6;'
        + 'margin-bottom:14px">Ohne <b>' + fehlendFlur.join(', ')
        + '</b> muss das Amt das Flurstück selbst heraussuchen. '
        + 'Das geht, dauert aber länger. Die Angaben stehen im Grundbuchauszug '
        + 'oder auf der Flurkarte.</div>';
    }

    h += '<div style="display:flex;flex-direction:column;gap:10px">';
    _arten.forEach(function (a) {
      var amt = _amtJeArt[a.id];
      h += '<div style="border:1px solid var(--border,#2a2522);border-radius:10px;padding:12px 14px">'
        + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        + '<div style="flex:1 1 220px;min-width:0">'
        + '<div style="font-weight:600;font-size:14px">' + _esc(a.name) + '</div>'
        + '<div id="dp-ul-amt-' + a.id + '" style="color:var(--muted,#8b8678);'
        + 'font-size:12.5px;margin-top:3px;line-height:1.55">'
        + (amt ? _amtZeile(amt) : 'Zuständigkeit noch nicht ermittelt')
        + '</div></div>'
        + '<button type="button" class="btn btn-ghost" style="font-size:12px"'
        + ' onclick="DealPilotUnterlagen.amtSuchen(\'' + a.id + '\')">'
        + (amt ? 'Neu suchen' : 'Amt ermitteln') + '</button>'
        + '<button type="button" class="btn" style="font-size:12px"'
        + (amt ? '' : ' disabled style="font-size:12px;opacity:.45;cursor:not-allowed"')
        + ' onclick="DealPilotUnterlagen.entwurf(\'' + a.id + '\')">Anschreiben</button>'
        + '</div></div>';
    });
    h += '</div>';

    h += '<div style="color:var(--muted,#8b8678);font-size:12px;line-height:1.6;margin-top:16px;'
      + 'padding-top:12px;border-top:1px solid var(--border,#2a2522)">'
      + 'DealPilot <b>verschickt nichts</b>. Es erzeugt das Anschreiben und legt es '
      + 'in die Zwischenablage — gesendet wird aus deinem eigenen Mailprogramm.'
      + '</div>';

    body.innerHTML = h;
  }

  function _amtZeile(a) {
    var t = '<b>' + _esc(a.behoerde) + '</b>'
      + (a.abteilung ? ' · ' + _esc(a.abteilung) : '');
    if (a.email) t += '<br>' + _esc(a.email);
    else if (a.antrag_url) t += '<br>nur über das Portal';
    /* Der Belegstand gehört an die Adresse, nicht in eine Fußnote. */
    t += '<br>' + (a.beleg_ok
      ? '<span style="color:var(--ok,#3FA56C)">✓ belegt</span> — ' + _esc(a.beleg_grund || '')
      : '<span style="color:var(--warn,#D8954C)">⚠ nicht belegt</span> — '
        + _esc(a.beleg_grund || 'unbekannt') + '. Bitte vor dem Senden selbst prüfen.');
    if (a.quelle_url) {
      t += '<br><a href="' + _esc(a.quelle_url) + '" target="_blank" rel="noopener"'
        + ' style="font-size:12px">Quelle ansehen</a>';
    }
    if (a.gebuehr) t += '<br>Gebühr: ' + _esc(a.gebuehr);
    if (a.hinweis) t += '<br><i>' + _esc(a.hinweis) + '</i>';
    return t;
  }

  async function amtSuchen(art) {
    if (_laeuft[art]) return;
    _laeuft[art] = true;
    var ziel = document.getElementById('dp-ul-amt-' + art);
    if (ziel) ziel.innerHTML = 'Suche die zuständige Stelle … das dauert einen Moment.';
    var o = _objekt();
    try {
      var r = await _api('/amt', {
        method: 'POST',
        body: { art: art, plz: o.plz, ort: o.ort, strasse: o.strasse,
                erzwingen: Boolean(_amtJeArt[art]) }
      });
      if (!r.gefunden) {
        if (ziel) ziel.innerHTML = '<span style="color:var(--bad,#D8564C)">'
          + _esc(r.grund || 'nicht gefunden') + '</span>';
        return;
      }
      _amtJeArt[art] = r.amt;
      await _aufbauen();
      if (window.toast) {
        window.toast(r.aus_register
          ? '✓ Zuständigkeit lag schon vor'
          : (r.amt.beleg_ok ? '✓ Amt ermittelt und belegt' : '⚠ Amt ermittelt, Adresse nicht belegt'));
      }
    } catch (e) {
      if (ziel) ziel.innerHTML = '<span style="color:var(--bad,#D8564C)">'
        + _esc(e.message || e) + '</span>';
    } finally { _laeuft[art] = false; }
  }

  async function entwurf(art) {
    var amt = _amtJeArt[art];
    var o = _objekt();
    try {
      var r = await _api('/entwurf', {
        method: 'POST',
        body: {
          art: art, objekt_id: o.objekt_id, amt_id: amt ? amt.id : null,
          objekt: o,
          absender: {
            name: (window.currentUser && window.currentUser.name) || '',
            email: (window.currentUser && window.currentUser.email) || '',
            vollmacht_liegt_bei: false
          }
        }
      });
      _zeigeBrief(r, amt);
    } catch (e) {
      if (window.toast) window.toast('⚠ ' + (e.message || e));
    }
  }

  function _zeigeBrief(r, amt) {
    var body = document.getElementById('dp-ul-body');
    if (!body) return;
    body.innerHTML = '<div style="font-size:13px;line-height:1.6">'
      + '<div style="color:var(--muted,#8b8678);font-size:12.5px;margin-bottom:8px">'
      + 'An: <b>' + _esc(amt && amt.email ? amt.email : '— keine Adresse —') + '</b>'
      + (amt && !amt.beleg_ok
          ? ' <span style="color:var(--warn,#D8954C)">(nicht belegt — bitte prüfen)</span>'
          : '')
      + '</div>'
      + '<div style="margin-bottom:6px"><b>Betreff:</b> ' + _esc(r.betreff) + '</div>'
      + '<textarea id="dp-ul-brief" readonly style="width:100%;min-height:320px;'
      + 'font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.55">'
      + _esc(r.text) + '</textarea>'
      + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
      + '<button type="button" class="btn" style="font-size:12px"'
      + ' onclick="DealPilotUnterlagen.kopieren()">In die Zwischenablage</button>'
      + (amt && amt.email
          ? '<button type="button" class="btn btn-ghost" style="font-size:12px"'
            + ' onclick="DealPilotUnterlagen.mailOeffnen(\'' + _esc(amt.email) + '\')">'
            + 'Im Mailprogramm öffnen</button>'
          : '')
      + '<button type="button" class="btn btn-ghost" style="font-size:12px"'
      + ' onclick="DealPilotUnterlagen.zurueck()">Zurück</button>'
      + '</div></div>';
  }

  function kopieren() {
    var t = document.getElementById('dp-ul-brief');
    if (!t) return;
    try {
      navigator.clipboard.writeText(t.value);
      if (window.toast) window.toast('✓ kopiert');
    } catch (e) {
      t.select();
      if (window.toast) window.toast('Bitte mit Strg+C kopieren');
    }
  }

  function mailOeffnen(adresse) {
    var t = document.getElementById('dp-ul-brief');
    var betreff = '';
    var kopf = document.querySelector('#dp-ul-body b');
    try { betreff = (kopf && kopf.parentNode.textContent.replace('Betreff:', '').trim()) || ''; }
    catch (e) {}
    /* mailto hat eine Längengrenze, die je nach Programm bei rund 2000
       Zeichen liegt. Der Brief ist kürzer, aber der Text geht trotzdem
       zusätzlich in die Zwischenablage — falls das Programm ihn abschneidet. */
    kopieren();
    var url = 'mailto:' + encodeURIComponent(adresse)
      + '?subject=' + encodeURIComponent(betreff)
      + '&body=' + encodeURIComponent(t ? t.value : '');
    window.location.href = url;
  }

  function zurueck() { _aufbauen(); }

  window.DealPilotUnterlagen = {
    oeffnen: oeffnen, schliessen: _schliessen,
    amtSuchen: amtSuchen, entwurf: entwurf,
    kopieren: kopieren, mailOeffnen: mailOeffnen, zurueck: zurueck
  };
})();
