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

  /* v1843 · Drei Knopfarten, jede mit AUSGESCHRIEBENEM Grund und Text.
     Keine `.btn`-Klasse: deren Farben hängen an Tokens, die je nach Skin
     anders auflösen — gemessen: weiß auf Creme, Kontrast 1,00.
       GOLD   Runway-Verlauf, Obsidian-Schrift      — die eine Haupthandlung
       HELL   Weiß, Gold-Rand, Obsidian-Schrift     — Nebenhandlungen auf Creme
       DUNKEL Obsidian, Gold-Rand, Creme-Schrift    — im schwarzen Kopf */
  var _KNOPF_BASIS = 'font:600 12.5px/1 Inter,system-ui,sans-serif;padding:9px 14px;'
    + 'border-radius:8px;cursor:pointer;white-space:nowrap;';
  var _KNOPF_GOLD = _KNOPF_BASIS
    + 'background:linear-gradient(110deg,var(--wl-E8CC7A,#E8CC7A),var(--wl-C9A84C,#C9A84C) 55%,var(--wl-b8932f,#b8932f));'
    + 'color:#050505;border:1px solid var(--wl-b8932f,#b8932f);';
  var _KNOPF_HELL = _KNOPF_BASIS
    + 'background:#FFFFFF;color:#2A2727;border:1px solid var(--wl-C9A84C,#C9A84C);';
  var _KNOPF_DUNKEL = _KNOPF_BASIS
    + 'background:#050505;color:#f3ead0;border:1px solid var(--wl-C9A84C,#C9A84C);';
  var _KNOPF_AUS = 'opacity:.45;cursor:not-allowed;';

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
    /* v1844 · Beim Schließen vergessen: das nächste Öffnen kann ein anderes
       Objekt sein, und die Ämter einer anderen Gemeinde dürfen nicht
       stehen bleiben. */
    _vorgeladen = false;
    _amtJeArt = {};
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

    /* ── v1843 · DIE FARBEN HINGEN AN TOKENS, DIE ANDERS AUFLÖSTEN ─────────
     *
     * Marcel: „Das müsste einmal das Modal auch im Stil vom Deal-Piloten
     * … mit dem Gold, mit dem Schwarz, mit dem Weiß. Dann kann man die Amt
     * ermitteln, das kann man nicht lesen."
     *
     * GEMESSEN am 04.10.2026: die Hülle war `var(--surface,#14110f)` — der
     * Rückfall ist dunkel, der Token löst aber auf Creme
     * rgb(248,246,241) auf. Der Knopf „Amt ermitteln" (btn-ghost) trug
     * darauf weißen Text mit 70 % Deckung: Kontrast 1,00. Unlesbar, und
     * zwar exakt.
     *
     *   > Eine Farbe gilt nur zu ihrem Grund. Wer die Hülle einem Token
     *   > überlässt, überlässt ihm auch die Lesbarkeit jedes Knopfes
     *   > darin — und erfährt es erst, wenn der Token anders auflöst.
     *
     * Deshalb hier KEINE Tokens für die farbtragenden Flächen, sondern die
     * Marke, einzeln benannt (CLAUDE.md: „farbtragende Flächen müssen
     * einzeln benannt werden"): Karte #FBF6E9 als Hülle, Obsidian-Schrift
     * #2A2727 darauf, Gold als Akzent — und Gold als `--wl-`-Token, weil
     * ein Mandant es umfärben darf. Grün und Rot bleiben hart (Statusfarben
     * nie tokenisieren). */
    hu.innerHTML = '<div style="background:#FBF6E9;color:#2A2727;'
      + 'border:1px solid var(--wl-C9A84C,#C9A84C);'
      + 'border-radius:14px;max-width:860px;width:100%;padding:0;overflow:hidden;'
      + 'box-shadow:0 24px 64px rgba(5,5,5,.45)">'
      + '<div style="display:flex;align-items:center;gap:12px;padding:16px 20px;'
      + 'background:#050505;color:#FDFCFA;'
      + 'border-bottom:2px solid var(--wl-C9A84C,#C9A84C)">'
      + '<div style="flex:1 1 auto">'
      + '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:17px;font-weight:600;'
      + 'color:#FDFCFA">Unterlagen beim Amt anfordern</div>'
      + '<div style="color:#f3ead0;opacity:.78;font-size:12.5px;margin-top:2px">'
      + (o.strasse || o.ort
          ? _esc([o.strasse, [o.plz, o.ort].filter(Boolean).join(' ')].filter(Boolean).join(', '))
          : '<span style="color:var(--wl-e8cc7a, #E8CC7A)">Kein Objekt geladen — Adresse fehlt</span>')
      + '</div></div>'
      + '<button type="button" style="' + _KNOPF_DUNKEL + '"'
      + ' onclick="DealPilotUnterlagen.schliessen()">Schließen</button>'
      + '</div>'
      + '<div id="dp-ul-body" style="padding:18px 20px;max-height:72vh;overflow:auto;color:#2A2727">'
      + '<div style="color:#6f6960;font-size:13px">Lade …</div>'
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

    /* ── v1844 · DIE ERNTE BEIM ÖFFNEN LESEN ──────────────────────────────
       Gemessen: das Modal zählte „5 von 5 fehlen", obwohl für Hüllhorst
       zwei Ämter längst hinterlegt waren — es erfuhr das erst beim Klick.
       Eine Anzeige, die mehr Arbeit ankündigt als da ist, ist falsch.
       Einmal je Öffnen, ohne Kontingent: nur lesen. */
    if (!_vorgeladen && (o.plz || o.ort)) {
      _vorgeladen = true;
      try {
        var vl = await _api('/aemter?plz=' + encodeURIComponent(o.plz)
          + '&ort=' + encodeURIComponent(o.ort), {});
        (vl.aemter || []).forEach(function (a) { if (a && a.art) _amtJeArt[a.art] = a; });
      } catch (e) { /* Lesen darf scheitern — dann sucht der Nutzer eben. */ }
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
    /* v1834b · Die BESCHRIFTUNG, nicht die Feld-id. Gemessen im Browser
       stand da „Ohne gemarkung, flur, flurstueck" — technische Namen in
       einem Satz, den der Kunde liest.

         > Eine Feld-id ist ein Name für den Code. Im Nutztext ist sie
         > eine Zumutung. */
    var NAME_FLUR = { gemarkung: 'Gemarkung', flur: 'Flur', flurstueck: 'Flurstück' };
    var fehlendFlur = ['gemarkung', 'flur', 'flurstueck']
      .filter(function (k) { return !o[k]; })
      .map(function (k) { return NAME_FLUR[k]; });
    /* v1843 · Marcel: „ist es zwangsläufig notwendig, dass man Flur,
       Gemarkung und Flurstück eingeben muss?" — NEIN. Der alte Satz
       („muss das Amt … selbst heraussuchen") klang nach Pflicht. Jetzt
       steht das Wort, das stimmt: optional. */
    if (fehlendFlur.length) {
      h += '<div style="color:#6f6960;font-size:12.5px;line-height:1.6;'
        + 'margin-bottom:14px"><b style="color:#2A2727">Optional:</b> '
        + fehlendFlur.join(', ') + '. Ohne diese Angaben sucht das Amt das '
        + 'Flurstück selbst heraus — das geht, dauert nur länger. Du findest '
        + 'sie im Grundbuchauszug oder auf der Flurkarte.</div>';
    }

    /* ── v1843 · „ALLE ABRUFEN" — Marcel: „man muss die ja alle einzeln
       abrufen … dass man da noch einen Button macht: alle abrufen." ──── */
    var offen = _arten.filter(function (a) { return !_amtJeArt[a.id]; }).length;
    h += '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;'
      + 'margin-bottom:12px;padding:10px 14px;background:#FFFFFF;'
      + 'border:1px solid var(--wl-C9A84C,#C9A84C);border-radius:10px">'
      + '<div style="flex:1 1 240px;font-size:12.5px;line-height:1.5;color:#2A2727">'
      + (offen
          ? '<b>' + offen + ' von ' + _arten.length + '</b> Zuständigkeiten noch nicht ermittelt. '
            + 'Jede Suche dauert rund 20 Sekunden.'
          : '<b>Alle ' + _arten.length + '</b> Zuständigkeiten liegen vor.')
      + '</div>'
      + '<button type="button" id="dp-ul-alle" style="' + _KNOPF_GOLD + (offen ? '' : _KNOPF_AUS) + '"'
      + (offen ? '' : ' disabled')
      + ' onclick="DealPilotUnterlagen.alleAbrufen()">Alle abrufen</button>'
      + '</div>';

    h += '<div style="display:flex;flex-direction:column;gap:10px">';
    _arten.forEach(function (a) {
      var amt = _amtJeArt[a.id];
      h += '<div style="background:#FFFFFF;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);'
        + 'border-radius:10px;padding:12px 14px">'
        + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        + '<div style="flex:1 1 220px;min-width:0">'
        + '<div style="font-weight:600;font-size:14px;color:#2A2727">' + _esc(a.name) + '</div>'
        + '<div id="dp-ul-amt-' + a.id + '" style="color:#6f6960;'
        + 'font-size:12.5px;margin-top:3px;line-height:1.55">'
        + (amt ? _amtZeile(amt) : 'Zuständigkeit noch nicht ermittelt')
        + '</div></div>'
        + '<button type="button" style="' + _KNOPF_HELL + '"'
        + ' onclick="DealPilotUnterlagen.amtSuchen(\'' + a.id + '\')">'
        + (amt ? 'Neu suchen' : 'Amt ermitteln') + '</button>'
        /* Vorher standen hier bei fehlendem Amt ZWEI style-Attribute am
           selben Knopf — das zweite verfällt still. Jetzt eines. */
        + '<button type="button" style="' + _KNOPF_GOLD + (amt ? '' : _KNOPF_AUS) + '"'
        + (amt ? '' : ' disabled')
        + ' onclick="DealPilotUnterlagen.entwurf(\'' + a.id + '\')">Anschreiben</button>'
        + '</div></div>';
    });
    h += '</div>';

    h += '<div style="color:#6f6960;font-size:12px;line-height:1.6;margin-top:16px;'
      + 'padding-top:12px;border-top:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent)">'
      + 'DealPilot <b>verschickt nichts</b>. Es erzeugt das Anschreiben und legt es '
      + 'in die Zwischenablage — gesendet wird aus deinem eigenen Mailprogramm.'
      + '</div>';

    body.innerHTML = h;
  }

  function _amtZeile(a) {
    var t = '<b>' + _esc(a.behoerde) + '</b>'
      + (a.abteilung ? ' · ' + _esc(a.abteilung) : '');
    if (a.email) t += '<br>' + _esc(a.email);
    /* ══ v1971c · DER PORTAL-LINK WAR KEIN LINK ═══════════════════════════

       Hier stand:

         else if (a.antrag_url) t += '<br>nur über das Portal';

       Zwei Fehler in einer Zeile, Marcel am 08.10.2026: „teilweise gingen
       die Links nicht."

       1. `nur über das Portal` war reiner TEXT. Die Adresse des Portals
          stand daneben im Datensatz (`antrag_url`, vom Backend durch
          `_link()` geprüft) und wurde nie ausgegeben. Wer das las, musste
          selbst suchen.

       2. Es war ein `else if`. Hat ein Amt eine E-Mail UND ein Portal —
          der Normalfall bei Bauamt und Grundbuchamt — erschien der
          Portal-Hinweis GAR NICHT. Der Zweig war nur erreichbar, wenn die
          E-Mail fehlte.

       Jetzt steht der Link immer da, wo es einen gibt, und sagt dazu, ob
       er der einzige Weg ist. */
    if (a.antrag_url) {
      t += '<br><a href="' + _esc(a.antrag_url) + '" target="_blank" rel="noopener">'
        + (a.email ? 'Online-Antrag / Portal' : 'nur über das Portal — hier öffnen')
        + '</a>';
    }
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
    body.innerHTML = '<div style="font-size:13px;line-height:1.6;color:#2A2727">'
      + '<div style="color:#6f6960;font-size:12.5px;margin-bottom:8px">'
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
      + '<button type="button" style="' + _KNOPF_GOLD + '"'
      + ' onclick="DealPilotUnterlagen.kopieren()">In die Zwischenablage</button>'
      + (amt && amt.email
          ? '<button type="button" style="' + _KNOPF_HELL + '"'
            + ' onclick="DealPilotUnterlagen.mailOeffnen(\'' + _esc(amt.email) + '\')">'
            + 'Im Mailprogramm öffnen</button>'
          : '')
      + '<button type="button" style="' + _KNOPF_HELL + '"'
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

  /* ── v1843 · ALLE ABRUFEN ────────────────────────────────────────────────
   *
   * NACHEINANDER, nicht gleichzeitig. Fünf Websuchen parallel wären für
   * dieselbe Gemeinde fünfmal dieselbe Arbeit; so kann die Ämter-Ernte
   * jeden Treffer für den nächsten nutzen, und der Nutzer sieht Zeile für
   * Zeile, wo es gerade steht. Was schon da ist, wird übersprungen —
   * „alle" heißt alle FEHLENDEN, nicht alle noch einmal. */
  var _alleLaeuft = false;
  /* v1844 · Einmal je Öffnen die Ernte lesen — und beim Schließen
     vergessen, denn das nächste Öffnen kann ein anderes Objekt sein. */
  var _vorgeladen = false;
  async function alleAbrufen() {
    if (_alleLaeuft || !_arten) return;
    _alleLaeuft = true;
    var k = document.getElementById('dp-ul-alle');
    if (k) { k.disabled = true; k.style.cssText = _KNOPF_GOLD + _KNOPF_AUS; }
    var fehlend = _arten.filter(function (a) { return !_amtJeArt[a.id]; });
    var n = 0;
    try {
      for (var i = 0; i < fehlend.length; i++) {
        k = document.getElementById('dp-ul-alle');
        if (k) k.textContent = 'Suche ' + (i + 1) + ' von ' + fehlend.length + ' …';
        await amtSuchen(fehlend[i].id);
        if (_amtJeArt[fehlend[i].id]) n++;
      }
    } finally {
      _alleLaeuft = false;
      await _aufbauen();
      if (window.toast) window.toast('✓ ' + n + ' von ' + fehlend.length + ' Zuständigkeiten ermittelt');
    }
  }

  window.DealPilotUnterlagen = {
    oeffnen: oeffnen, schliessen: _schliessen,
    amtSuchen: amtSuchen, entwurf: entwurf,
    /* v1843 · Ohne Export ruft das onclick ins Leere — derselbe Fehler
       wie beim Abbrechen-Knopf des Telegram-Panels (v1825). */
    alleAbrufen: alleAbrufen,
    kopieren: kopieren, mailOeffnen: mailOeffnen, zurueck: zurueck
  };
})();
