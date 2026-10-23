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
    + 'background:linear-gradient(110deg,var(--wl-e8cc7a,#E8CC7A),var(--wl-c9a84c,#C9A84C) 55%,var(--wl-b8932f,#b8932f));'
    + 'color:#050505;border:1px solid var(--wl-b8932f,#b8932f);';
  var _KNOPF_HELL = _KNOPF_BASIS
    + 'background:#FFFFFF;color:#2A2727;border:1px solid var(--wl-c9a84c,#C9A84C);';
  var _KNOPF_DUNKEL = _KNOPF_BASIS
    + 'background:#050505;color:#f3ead0;border:1px solid var(--wl-c9a84c,#C9A84C);';
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
      + 'border:1px solid var(--wl-c9a84c,#C9A84C);'
      + 'border-radius:14px;max-width:860px;width:100%;padding:0;overflow:hidden;'
      + 'box-shadow:0 24px 64px rgba(5,5,5,.45)">'
      + '<div style="display:flex;align-items:center;gap:12px;padding:16px 20px;'
      + 'background:#050505;color:#FDFCFA;'
      + 'border-bottom:2px solid var(--wl-c9a84c,#C9A84C)">'
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
      + 'border:1px solid var(--wl-c9a84c,#C9A84C);border-radius:10px">'
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
      + (a.abteilung ? ' · ' + _esc(a.abteilung) : '')
      /* v2441 · Ein gemeindeweiter Satz (v2440) gilt für jede PLZ der
         Gemeinde. Das steht dabei, damit niemand ihn für eine
         adressgenaue Recherche hält. */
      + (a.gemeindeweit || /^gemeinde-/.test(String(a.gemeinde_schluessel || ''))
          ? ' <span style="font-size:11px;color:#6f6960">(für die ganze Gemeinde hinterlegt)</span>' : '');
    if (a.email) t += '<br>' + _esc(a.email);
    /* ══ v2153 · DIE TELEFONNUMMER FEHLTE GANZ ═══════════════════════════

       Marcel am 12.10.2026: „am besten auch telefonnummer dazu."

       GEMESSEN: `telefon` kommt seit v1833 aus der Recherche
       (`unterlagenService.js:696`), liegt als eigene Spalte in
       `unterlagen_aemter` und wurde im Modal an KEINER Stelle
       ausgegeben. Erst v2152 zeigte sie — aber nur bei den
       Ansprechpersonen, nicht beim Amt selbst.

       > Ein Feld, das erhoben und gespeichert wird und nirgends
       > erscheint, ist dieselbe Art Verlust wie die `skala` von heute
       > Morgen: die Arbeit ist getan und kommt nicht an.

       Bei einem Amt ist die Nummer oft der schnellere Weg als eine
       E-Mail, auf die in zwei Wochen jemand antwortet. */
    /* v2441 · mit Beschriftung und als Wählverweis — eine nackte Nummer
       neben einer Adresse liest sich wie ein Aktenzeichen. */
    if (a.telefon) {
      t += '<br>Telefon <a href="tel:' + _esc(String(a.telefon).replace(/[^0-9+]/g, ''))
        + '" style="color:#2A2727">' + _esc(a.telefon) + '</a>';
    }
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
    /* ══ v2152 · DIE ANSPRECHPERSONEN ════════════════════════════════════

       Marcel am 12.10.2026: „ja mach die ansprechpartner gleich mit."

       Je Person steht hier DREIERLEI, und alle drei sind nötig:
         · wer es ist (Name, Funktion — soweit die Seite sie nennt)
         · ob die Adresse BELEGT ist (wir haben sie selbst auf einer
           amtlichen Seite gefunden) oder nur genannt
         · ein Häkchen „in Kopie"

       Der Belegstand ist das Entscheidende. Eine Person, deren Adresse
       nur die Recherche genannt hat, sieht genauso aus wie eine
       belegte — und ohne diesen Unterschied schickt der Nutzer Post an
       eine Adresse, die niemand geprüft hat.

       Ein Name ohne Adresse bekommt KEIN Häkchen: in Kopie kann nur,
       wer ein Postfach hat. Angezeigt wird er trotzdem, denn „fragen
       Sie Frau X" ist eine brauchbare Auskunft. */
    /* Dieses Modal gestaltet durchgehend mit style-Attributen (43
       Stellen) und hat kein eigenes Stylesheet. Klassen hätten hier
       nirgends gegriffen — und ein nachträglich eingehängtes <style>
       verliert gegen die Blätter, die im BODY hängen. */
    /* ══ v2441 · ZWEI KARTEN NEBENEINANDER, JE PERSON DER BELEG ═════════

       Marcel am 19.10.2026: „da wollten wir die 2 Ansprechpartner
       ausweisen, wenn es geht". Vorlage v6 (`personenHtml`): je Person
       eine Karte, „1. Ansprechperson" / „2. Ansprechperson", ab 560 px
       zwei Spalten.

       Neu gegenüber v2152: die BELEG-SEITE je Person (`p.seite`, seit
       v2440 vom Backend gesetzt) und der Unterschied „Adresse belegt"
       gegen „Name auf der Seite" — der Name kann stehen, ohne dass dort
       eine Adresse steht. Ohne Ort wäre „belegt" eine Behauptung. */
    if (Array.isArray(a.ansprechpartner) && a.ansprechpartner.length) {
      var _S_KARTE = 'flex:1 1 210px;min-width:0;padding:9px 11px;border-radius:8px;background:#FFFFFF;'
        + 'border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent)';
      var _S_KLEIN = 'font-size:12px;color:#6f6960;overflow-wrap:anywhere';
      var _S_MARKE = 'font:600 10px/1.2 \'JetBrains Mono\',ui-monospace,monospace;letter-spacing:.06em;'
        + 'text-transform:uppercase;color:var(--wl-b8932f, #b8932f)';
      t += '<div style="margin-top:9px">'
        + '<div style="' + _S_MARKE + ';margin-bottom:6px">Ansprechpartner laut amtlicher Seite</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:8px">';
      a.ansprechpartner.forEach(function (p, i) {
        t += '<div style="' + _S_KARTE + '">'
          + '<div style="' + _S_MARKE + '">Ansprechpartner ' + (i + 1) + '</div>'
          + '<div style="font-weight:600;font-size:13px;color:#2A2727;margin-top:3px;overflow-wrap:anywhere">'
          + _esc(p.name || 'Name nicht genannt') + '</div>'
          + (p.funktion ? '<div style="' + _S_KLEIN + '">' + _esc(p.funktion) + '</div>' : '');
        if (p.telefon) {
          t += '<div style="' + _S_KLEIN + ';margin-top:3px">Telefon '
            + '<a href="tel:' + _esc(String(p.telefon).replace(/[^0-9+]/g, '')) + '" style="color:#2A2727">'
            + _esc(p.telefon) + '</a></div>';
        }
        t += '<div style="' + _S_KLEIN + '">'
          + (p.email ? 'E-Mail ' + _esc(p.email) : 'keine E-Mail-Adresse genannt') + '</div>';
        /* Der Belegstand je PERSON, nicht je Amt. */
        t += '<div style="font-size:11.5px;margin-top:4px">'
          + (p.bestaetigt
              ? '<span style="color:var(--ok,#3FA56C)">✓ Adresse auf der Seite</span>'
              : p.name_belegt
                ? '<span style="color:var(--ok,#3FA56C)">✓ Name auf der Seite</span>'
                : '<span style="color:var(--warn,#D8954C)">⚠ nur genannt, nicht nachgelesen</span>')
          + (p.seite
              ? ' · <a href="' + _esc(p.seite) + '" target="_blank" rel="noopener" style="color:#2A2727">Beleg-Seite</a>'
              : '')
          + '</div>';
        if (p.email) {
          t += '<label style="display:inline-flex;align-items:center;gap:5px;'
            + 'margin-top:5px;font-size:12px;cursor:pointer;color:#2A2727">'
            + '<input type="checkbox"' + (p.kopie ? ' checked' : '')
            + ' onchange="DealPilotUnterlagen.kopieSetzen(' + Number(a.id) + ',' + i + ',this)">'
            + 'in Kopie setzen</label>';
        } else {
          /* Ein Häkchen an einem Namen ohne Postfach wäre ein
             Versprechen, das der Versand nicht halten kann. */
          t += '<div style="' + _S_KLEIN + ';opacity:.8;margin-top:4px">ohne Adresse — nicht in Kopie</div>';
        }
        t += '</div>';
      });
      t += '</div></div>';
    } else {
      /* ══ v2153 · KEINE ZWEI PERSONEN → DER AMTSWEG, AUSDRUECKLICH ═════

         Marcel: „wenn es nicht 2 ansprechpartner gibt sollte man schauen
         ob es eine übergeordnete email adresse oder einen kontakt gibt
         und den ausgeben und die ansprechpartner weg lassen."

         Das Backend laesst die halbe Liste weg (`personenAus`). Hier
         steht, WARUM — sonst sieht die Stelle aus, als sei die Suche
         gescheitert.

         Die uebergeordnete Adresse ist nicht neu zu holen: sie steht
         zwei Zeilen hoeher als `a.email` mit ihrem Belegstand. Dieser
         Block nennt sie als den WEG und ergaenzt die Alternativen, die
         beim Lesen der Seiten ohnehin anfielen (Funktionspostfaecher
         zuerst, seit v2151).

         Ohne eigene Adresse und ohne Portal steht hier nichts
         Beschwichtigendes: dann ist der Weg wirklich offen, und das
         gehoert gesagt. */
      var _alt = [];
      try {
        var _s2 = a.seiten;
        if (_s2 && !Array.isArray(_s2) && Array.isArray(_s2.alternativen)) {
          _alt = _s2.alternativen.filter(function (m) { return m && m !== a.email; });
        }
      } catch (e) {}
      if (a.email || a.telefon) {
        t += '<div style="margin-top:7px;font-size:12px;color:#6f6960">'
          + 'Keine zwei belegten Ansprechpersonen auf der Quellseite — '
          + 'nimm den allgemeinen Weg des Amts oben.'
          + (_alt.length
              ? '<br>Weitere Adressen von den gelesenen Seiten: '
                + _esc(_alt.slice(0, 3).join(', '))
              : '')
          + '</div>';
      } else if (a.antrag_url) {
        t += '<div style="margin-top:7px;font-size:12px;color:#6f6960">'
          + 'Keine Adresse und keine Ansprechperson belegt — dieses Amt '
          + 'nimmt die Anfrage über das Portal.</div>';
      } else {
        t += '<div style="margin-top:7px;font-size:12px;'
          + 'color:var(--warn,#D8954C)">Weder Adresse noch Ansprechperson '
          + 'belegt. Bitte den Weg selbst prüfen — die Quelle ist oben '
          + 'verlinkt.</div>';
      }
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
        timeout: 30000,
        body: { art: art, plz: o.plz, ort: o.ort, strasse: o.strasse,
                erzwingen: Boolean(_amtJeArt[art]) }
      });
      /* v2920 · Dauert die Recherche länger als ~10 s, antwortet der
         Server mit einem Auftrag statt zu warten (vorher brach
         Auth.apiCall nach 15 s mit „Anfrage-Timeout" ab, während der
         Server weiterrechnete). Hier wird nachgefragt, bis das Ergebnis
         da ist — höchstens vier Minuten. */
      if (r && r.laeuft && r.auftrag) {
        var t0 = Date.now(), fehlversuche = 0;
        while (r && r.laeuft) {
          if (Date.now() - t0 > 240000) {
            if (ziel) ziel.innerHTML = '<span style="color:var(--warn,#D8954C)">'
              + 'Die Recherche dauert ungewöhnlich lange. Sie läuft auf dem Server '
              + 'weiter — öffne die Unterlagen in ein paar Minuten noch einmal, '
              + 'dann steht das Ergebnis hier.</span>';
            return;
          }
          await new Promise(function (ok) { setTimeout(ok, 3000); });
          if (ziel) ziel.innerHTML = 'Recherche auf den amtlichen Seiten läuft … '
            + Math.round((Date.now() - t0) / 1000 + 10) + ' s';
          try {
            r = await _api('/amt/auftrag/' + encodeURIComponent(r.auftrag), { timeout: 15000 });
            fehlversuche = 0;
          } catch (e2) {
            if (/liegt nicht mehr vor/.test(e2.message || '')) throw e2;
            if (++fehlversuche >= 4) throw e2;
          }
        }
      }
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
      /* v2920 · Nie die Technik-Meldung zeigen („Server antwortet nicht
         rechtzeitig") — der Nutzer kann damit nichts anfangen. */
      var msg = String((e && e.message) || e || '');
      if (/Anfrage-Timeout|nicht erreichbar/i.test(msg)) {
        msg = 'Die Verbindung zum Server ist abgerissen. Die Recherche läuft dort '
          + 'gegebenenfalls weiter — öffne die Unterlagen gleich noch einmal.';
      }
      if (ziel) ziel.innerHTML = '<span style="color:var(--bad,#D8564C)">'
        + _esc(msg) + '</span>';
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
      + 'An: <b id="dp-ul-an">' + _esc(_empfaenger(amt) || '— keine Adresse —') + '</b>'
      + (amt && !amt.beleg_ok && _empfaenger(amt) === amt.email
          ? ' <span style="color:var(--warn,#D8954C)">(nicht belegt — bitte prüfen)</span>'
          : '')
      + _empfaengerWahl(amt)
      /* v2152 · Der CC steht im Briefkopf, nicht nur im mailto-Link.
         Wer in Kopie geht, muss es VOR dem Senden sehen können — ein
         Empfänger, der erst im Mailprogramm auftaucht, ist eine
         Überraschung, und bei Post an Ämter eine unangenehme. */
      + (function () {
          var cc = _kopienVon(amt);
          return '<div id="dp-ul-kopie" style="margin-top:3px">'
            + (cc.length ? 'Kopie an: <b>' + _esc(cc.join(', ')) + '</b>' : '') + '</div>';
        })()
      + '</div>'
      + '<div style="margin-bottom:6px"><b>Betreff:</b> ' + _esc(r.betreff) + '</div>'
      + '<textarea id="dp-ul-brief" readonly style="width:100%;min-height:320px;'
      + 'font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.55">'
      + _esc(r.text) + '</textarea>'
      + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
      + '<button type="button" style="' + _KNOPF_GOLD + '"'
      + ' onclick="DealPilotUnterlagen.kopieren()">In die Zwischenablage</button>'
      + (amt && _empfaenger(amt)
          ? '<button type="button" style="' + _KNOPF_HELL + '"'
            /* v2152 · Die angehakten Adressen gehen als CC mit, als JSON
               und nicht als Komma-Liste: eine Adresse mit Sonderzeichen
               würde eine Liste zerlegen.
               `_esc` macht aus `"` bereits `&quot;` (Z. 62), und genau
               das braucht ein onclick-Attribut — der Browser dekodiert
               es vor dem Auswerten zurück. Ein zusätzliches `replace`
               darauf fände nichts mehr und sähe nur nach Sorgfalt aus. */
            /* v2441 · Empfänger und Kopie liest mailOeffnen beim Klick aus
               der Wahl im Briefkopf, nicht aus dem Stand beim Aufbau. */
            + ' onclick="DealPilotUnterlagen.mailOeffnen(null,null,\'' + _esc(amt.art) + '\')">'
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

  function mailOeffnen(adresse, kopien, art) {
    /* v2441 · Mit Art: Empfänger aus der Wahl, Kopie ohne den Empfänger. */
    if (art && _amtJeArt[art]) {
      var _a = _amtJeArt[art];
      adresse = _empfaenger(_a);
      kopien = _kopienVon(_a);
      if (!adresse) return;
    }
    var t = document.getElementById('dp-ul-brief');
    var betreff = '';
    var kopf = document.querySelector('#dp-ul-body b');
    try { betreff = (kopf && kopf.parentNode.textContent.replace('Betreff:', '').trim()) || ''; }
    catch (e) {}
    /* mailto hat eine Längengrenze, die je nach Programm bei rund 2000
       Zeichen liegt. Der Brief ist kürzer, aber der Text geht trotzdem
       zusätzlich in die Zwischenablage — falls das Programm ihn abschneidet. */
    kopieren();
    /* ══ v2152 · DER EMPFAENGER STEHT NIE AUCH IN KOPIE ════════════════

       Vorlage v6: „nie die Adresse, die ohnehin Empfänger ist"
       (`server.js:467`). Dieselbe Adresse zweimal im Kopf eines Briefes
       sieht nach einem Fehler aus — und bei manchen Programmen führt
       sie zu zwei Zustellungen.

       Hier wird es doppelt verhindert: `personenAus()` nimmt den
       Empfänger beim Zusammenbau gar nicht auf, und hier fällt er noch
       einmal heraus. Die zweite Prüfung ist nicht überflüssig: in die
       Liste kann über den Kopie-Endpunkt nichts Fremdes gelangen, aber
       die Empfängeradresse kann sich ändern, nachdem die Liste
       entstanden ist (Neurecherche, anderes Funktionspostfach). */
    var cc = (Array.isArray(kopien) ? kopien : [])
      .filter(function (m) { return m && m !== adresse; });
    var url = 'mailto:' + encodeURIComponent(adresse)
      + '?subject=' + encodeURIComponent(betreff)
      + (cc.length ? '&cc=' + cc.map(encodeURIComponent).join(',') : '')
      + '&body=' + encodeURIComponent(t ? t.value : '');
    window.location.href = url;
  }

  /* ══ v2152 · DAS HAEKCHEN SETZT, UND ZWAR AUF DEM SERVER ═════════════
   *
   * Ein Häkchen, das nur im DOM lebt, ist beim nächsten Öffnen weg —
   * und der Nutzer merkt es erst, wenn die Kopie nicht angekommen ist.
   *
   * `Auth.apiCall` stringifiziert selbst, und `getApiBase()` enthält
   * `/api/v1` (CLAUDE.md). Ein nacktes `fetch` würde den zentralen
   * 401-Handler umgehen. */
  function kopieSetzen(amtId, nr, feld) {
    var an = !!(feld && feld.checked);
    if (!amtId) {
      if (window.toast) window.toast('⚠ Amt noch nicht gespeichert');
      if (feld) feld.checked = !an;
      return;
    }
    /* `_api()` ist der Weg dieses Moduls — er geht über `Auth.apiCall`
       und damit über den zentralen 401-Handler. Ein nacktes `fetch`
       würde ihn umgehen (CLAUDE.md). */
    _api('/amt/' + amtId + '/kopie', { method: 'PUT', body: { nr: nr, kopie: an } })
      .then(function (r) {
        /* Den geänderten Satz in den Vorrat zurückschreiben, damit der
           Brief den CC kennt, ohne neu zu laden. Der Vorrat ist nach
           ART indiziert (`_amtJeArt`), nicht als Liste — gemessen an
           Z. 40 und 181, nicht angenommen. */
        if (r && r.amt && r.amt.art) _amtJeArt[r.amt.art] = r.amt;
        if (window.toast) window.toast(an ? '✓ geht in Kopie' : 'Kopie entfernt');
      })
      .catch(function (e) {
        /* Zurückstellen: ein Häkchen, das gesetzt aussieht und nicht
           gespeichert ist, ist schlimmer als eines, das abspringt. */
        if (feld) feld.checked = !an;
        if (window.toast) window.toast('⚠ ' + (e.message || e));
      });
  }

  /* Die angehakten Adressen eines Amts — eine Stelle, zwei Aufrufer
     (Briefkopf und mailto). */
  function _kopienVon(amt) {
    var an = _empfaenger(amt);
    return ((amt && Array.isArray(amt.ansprechpartner)) ? amt.ansprechpartner : [])
      .filter(function (p) { return p.kopie && p.email && p.email !== amt.email && p.email !== an; })
      .map(function (p) { return p.email; });
  }

  /* ══ v2441 · WER IST EMPFAENGER? (Vorlage v6 „Als Empfänger nehmen") ═

     Standard ist die Amtsadresse — sie kommt an, auch wenn die Person
     im Urlaub ist. Eine Ansprechperson mit Adresse lässt sich im
     Briefkopf zum Empfänger machen; die Wahl lebt nur in dieser
     Sitzung und ändert am Amt NICHTS (v6 schrieb sie in den Datensatz —
     bei einer gemeinsamen Ämterliste hiesse das, dass ein Nutzer für
     alle umstellt). Steht das Amt ohne eigene Adresse da, ist die erste
     Person mit Adresse der Vorschlag. */
  var _empfaengerJeArt = {};
  function _empfaenger(amt) {
    if (!amt) return '';
    var w = _empfaengerJeArt[amt.art];
    var personen = Array.isArray(amt.ansprechpartner) ? amt.ansprechpartner : [];
    if (w && (w === amt.email || personen.some(function (p) { return p.email === w; }))) return w;
    if (amt.email) return amt.email;
    var erste = personen.find(function (p) { return !!p.email; });
    return erste ? erste.email : '';
  }
  function _empfaengerWahl(amt) {
    var personen = (amt && Array.isArray(amt.ansprechpartner) ? amt.ansprechpartner : [])
      .filter(function (p) { return !!p.email; });
    if (!personen.length) return '';
    var an = _empfaenger(amt);
    var wahl = [];
    if (amt.email) wahl.push({ mail: amt.email, text: 'Amtsadresse' });
    personen.forEach(function (p, i) {
      wahl.push({ mail: p.email, text: 'Ansprechpartner ' + (i + 1) + (p.name ? ' (' + p.name + ')' : '') });
    });
    return '<div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:4px">'
      + wahl.map(function (w) {
          return '<label style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;color:#2A2727">'
            + '<input type="radio" name="dp-ul-empf"' + (w.mail === an ? ' checked' : '')
            + ' onchange="DealPilotUnterlagen.empfaengerSetzen(\'' + _esc(amt.art) + '\',this.value)"'
            + ' value="' + _esc(w.mail) + '">' + _esc(w.text) + '</label>';
        }).join('')
      + '</div>';
  }
  function empfaengerSetzen(art, mail) {
    _empfaengerJeArt[art] = mail;
    var amt = _amtJeArt[art];
    var an = document.getElementById('dp-ul-an');
    if (an) an.textContent = _empfaenger(amt);
    var kk = document.getElementById('dp-ul-kopie');
    if (kk) {
      var cc = _kopienVon(amt);
      kk.innerHTML = cc.length ? 'Kopie an: <b>' + _esc(cc.join(', ')) + '</b>' : '';
    }
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
    kopieren: kopieren, mailOeffnen: mailOeffnen, zurueck: zurueck,
    /* v2152 · Ohne Export ruft das onchange der Kopie-Kästchen ins Leere
       — derselbe Fehler wie v1843 beim Abrufen-Knopf. */
    kopieSetzen: kopieSetzen,
    /* v2441 · die Empfängerwahl im Briefkopf */
    empfaengerSetzen: empfaengerSetzen
  };
})();
