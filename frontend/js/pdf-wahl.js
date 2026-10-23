/* ═══════════════════════════════════════════════════════════════════════
   pdf-wahl.js · v1636 — die Rückfrage vor dem Export
   (v2900: vierte Fassung „Kurzfassung" und Voreinstellung im Konto)

   Marcel am 26.09.2026: „Bei dem Bankexport müssen wir nachfragen, wenn
   wir draufklicken, welchen wir da nehmen sollen, den hellen oder den
   dunklen. Da gibt's ja auch noch Abstufungen."

   ── WAS ES WIRKLICH GIBT (gemessen, nicht angenommen) ─────────────────
   Ich habe nicht geraten, welche Fassungen existieren, sondern nachgesehen:

     `window._dpPdfLight`                pdf.js:600, Vorgabe FALSE
     `_cv(dunkel, hell)`                 pdf.js:602, **13 Fundstellen**
     `pdf-investment-bank.js`            **null** Fundstellen

   Daraus folgt genau eine Aufteilung:

     · `exportPDF`      — das grosse Investment-PDF. Deckblatt und
                          Seitenköpfe DUNKEL oder HELL, je nach Schalter.
     · `exportPDFBank`  — die Bankfassung. Immer weisses Papier; sie
                          kennt den Schalter gar nicht.

   Also drei Abstufungen, und keine erfundene vierte.

   v2900 · Die vierte ist jetzt eine echte: Marcel am 23.10.2026 („ja
   PDF-Paket und Handy-Ansicht bauen") — die KURZFASSUNG, rund vier Seiten,
   `exportPDFBank({ kurz: true })`. Sie ist keine neue Rechnung, sondern die
   Bankfassung mit weniger Bausteinen.

   ── WARUM DIE WAHL NICHT IN DIE EINSTELLUNGEN GEHÖRT ──────────────────
   Weil sie vom EMPFÄNGER abhängt, nicht vom Nutzer. Dieselbe Person
   schickt morgens etwas an die Bank und mittags an einen Miteigentümer.
   Eine Einstellung, die man vor jedem zweiten Export ändern müsste, ist
   keine Einstellung, sondern eine Falle. Deshalb die Frage im Moment des
   Klicks - mit „merken" für den, der immer dasselbe nimmt.

   v2900 · Das bleibt so: die Frage kommt weiter beim Klick. In den
   Einstellungen (Darstellung › PDF-Export) steht nur die VORAUSWAHL — welche
   Fassung im Dialog markiert ist, ob ohne Rückfrage erzeugt wird (das alte
   „merken") und ob die Pilot-Analyse mitkommt. Gespeichert im Konto
   (user_settings `pdf_vorgabe`), damit Handy und Schreibtisch dasselbe tun;
   `dp_pdf_wahl` bleibt der lokale Spiegel von „ohne Rückfrage".

   ── DIE UMHÜLLUNG ─────────────────────────────────────────────────────
   Die beiden Funktionen werden umhüllt, nicht ersetzt. Jeder bestehende
   Aufrufer (Seitenmenü, Deal-Aktion, Dashboard-Karte, hybrid-aktionen)
   bekommt die Frage automatisch - ohne dass eine einzige Aufrufstelle
   angefasst wird. Wer sie NICHT will, ruft mit `{ohneRueckfrage:true}`.

   > Eine Umhüllung erreicht Aufrufer, die man noch gar nicht kennt.
   > Eine geänderte Aufrufstelle erreicht genau eine.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DealPilotPdfWahl) return;

  var LS = 'dp_pdf_wahl';          /* Fassung ohne Rückfrage (lokaler Spiegel) */
  var LS_V = 'dp_pdf_vorgabe';     /* v2900 · die ganze Vorgabe, lokal */
  var SCHLUESSEL = 'pdf_vorgabe';  /* v2900 · user_settings */

  var WAHLEN = [
    { id: 'bank', titel: 'Bankfassung', unter: 'Weisses Papier, Kennzahlen als Tabelle',
      fuer: 'Bank · Finanzierung · Steuerberater', hell: true, art: 'bank' },
    { id: 'kurz', titel: 'Kurzfassung', unter: 'Rund vier Seiten, weisses Papier',
      fuer: 'Erstkontakt · Bank · Investor', hell: true, art: 'kurz' },
    { id: 'hell', titel: 'Investment-PDF · hell', unter: 'Volles Dokument, helles Deckblatt',
      fuer: 'Miteigentümer · Partner · Ausdruck', hell: true, art: 'voll' },
    { id: 'obsidian', titel: 'Investment-PDF · Obsidian', unter: 'Volles Dokument, dunkles Deckblatt',
      fuer: 'Eigener Gebrauch · Präsentation', hell: false, art: 'voll' }
  ];
  function wahl(id) { return WAHLEN.filter(function (x) { return x.id === id; })[0] || null; }

  /* ── v2900 · Vorgabe ─────────────────────────────────────────────────
     { fassung: '' | id, immer: bool, pilot: bool }. Pilot an ist die Vorgabe:
     die Bankfassung nahm die Pilot-Analyse bis v2892 immer mit. */
  var vorgabe = { fassung: '', immer: false, pilot: true };
  (function () {
    try {
      var v = JSON.parse(localStorage.getItem(LS_V) || 'null');
      if (v && typeof v === 'object') vorgabe = normal(v);
      else {
        /* Altbestand: „Diese Wahl merken" lag nur in dp_pdf_wahl */
        var g = localStorage.getItem(LS) || '';
        if (wahl(g)) vorgabe = { fassung: g, immer: true, pilot: true };
      }
    } catch (e) {}
  })();
  function normal(v) {
    return { fassung: wahl(v.fassung) ? v.fassung : '', immer: !!v.immer && !!wahl(v.fassung), pilot: v.pilot !== false };
  }
  function api() { return window.Auth && Auth.apiCall && (!Auth.isApiMode || Auth.isApiMode()); }
  function spiegeln() {
    try {
      localStorage.setItem(LS_V, JSON.stringify(vorgabe));
      if (vorgabe.immer && vorgabe.fassung) localStorage.setItem(LS, vorgabe.fassung); else localStorage.removeItem(LS);
    } catch (e) {}
    pilotHaken();
  }
  function sichern() {
    spiegeln();
    try { if (api()) Auth.apiCall('/user-settings/' + SCHLUESSEL, { method: 'PUT', body: { wert: vorgabe } }).catch(function () {}); } catch (e) {}
  }
  /* Server gewinnt beim Laden, aber nie gegen leer (userSettings.js) - kommt nichts,
     wird der lokale Stand (auch der übernommene Altbestand) einmal hochgeschrieben. */
  function laden() {
    try {
      if (!api()) return;
      Auth.apiCall('/user-settings/' + SCHLUESSEL).then(function (r) {
        if (r && r.wert && typeof r.wert === 'object') { vorgabe = normal(r.wert); spiegeln(); }
        else if (vorgabe.fassung || vorgabe.pilot === false) sichern();
      }).catch(function () {});
    } catch (e) {}
  }
  function setze(teil) {
    Object.keys(teil || {}).forEach(function (k) { vorgabe[k] = teil[k]; });
    vorgabe = normal(vorgabe);
    sichern();
  }

  /* Der Haken in der Pilot-Analyse ist DIESELBE Angabe wie die Vorgabe: er wird
     aus ihr gesetzt, und wer ihn umlegt, ändert sie. Ein Wert, eine Stelle. */
  function pilotHaken() {
    var cb = document.getElementById('ai-in-pdf');
    if (!cb) return;
    cb.checked = vorgabe.pilot;
    if (!cb.__dpw) {
      cb.__dpw = true;
      cb.addEventListener('change', function () { setze({ pilot: !!cb.checked }); });
    }
  }
  function pilotAn() {
    var cb = document.getElementById('ai-in-pdf');
    return cb ? !!cb.checked : vorgabe.pilot;
  }

  var origBank = null, origVoll = null;

  function fuehreAus(w) {
    /* Der Schalter gilt nur für DIESEN Export - danach zurück auf den
       Stand, den der Mandant gesetzt hat. Ein Schalter, der stehen
       bleibt, färbt den nächsten Export mit, den niemand gewählt hat. */
    var vorher = window._dpPdfLight;
    try {
      if (typeof window._dpPdfSetLight === 'function') window._dpPdfSetLight(w.hell);
      else window._dpPdfLight = w.hell;
      if (w.art === 'bank') { if (origBank) return origBank.call(window, { ohneRueckfrage: true }); }
      else if (w.art === 'kurz') { if (origBank) return origBank.call(window, { ohneRueckfrage: true, kurz: true }); }
      else { if (origVoll) return origVoll.call(window, { ohneRueckfrage: true }); }
    } finally {
      /* Erst nach einem Wimpernschlag zurücksetzen: der Export ist
         async und liest die Farben noch, während wir hier schon
         weiterlaufen. */
      setTimeout(function () {
        try {
          if (typeof window._dpPdfSetLight === 'function') window._dpPdfSetLight(vorher);
          else window._dpPdfLight = vorher;
        } catch (e) {}
      }, 4000);
    }
  }

  function gemerkt() {
    try { return localStorage.getItem(LS) || ''; } catch (e) { return ''; }
  }

  function frage(vorauswahl) {
    var g = gemerkt();
    if (g) {
      var w = wahl(g);
      if (w) return fuehreAus(w);
    }
    zeige(vorgabe.fassung || vorauswahl);
  }

  function zeige(vorauswahl) {
    var alt = document.getElementById('dp-pdf-wahl');
    if (alt) alt.remove();

    var ov = document.createElement('div');
    ov.id = 'dp-pdf-wahl';
    ov.className = 'dpw-ov';

    var karten = WAHLEN.map(function (w) {
      return '<button type="button" class="dpw-k' + (w.id === vorauswahl ? ' dpw-an' : '') + '" data-id="' + w.id + '">'
        + '<span class="dpw-probe dpw-probe-' + (w.hell ? 'hell' : 'dunkel') + '"></span>'
        + '<span class="dpw-tx"><b>' + w.titel + '</b>'
        + '<span class="dpw-u">' + w.unter + '</span>'
        + '<span class="dpw-f">' + w.fuer + '</span></span></button>';
    }).join('');

    ov.innerHTML =
      '<div class="dpw-kasten" role="dialog" aria-modal="true" aria-label="Welche Fassung?">'
      + '<div class="dpw-kopf"><b>Welche Fassung?</b>'
      + '<button type="button" class="dpw-zu" aria-label="Schliessen">×</button></div>'
      + '<p class="dpw-vor">Vier Fassungen stehen bereit. Sie unterscheiden sich im Umfang '
      + 'und im Deckblatt - die Zahlen sind dieselben.</p>'
      + '<div class="dpw-liste">' + karten + '</div>'
      /* v1733 · hier stand „(änderbar in den Einstellungen)". Das war eine
         Zusage ohne Code: `vergessen()` hatte ausserhalb dieser Datei null
         Aufrufer, und in den Einstellungen gab es nichts. Jetzt steht dort,
         wo der Weg wirklich liegt — neben dem PDF-Knopf in der Ausgabe.
         v2900 · jetzt gibt es den Weg in den Einstellungen wirklich
         (Darstellung › PDF-Export, einstellungenHtml unten). */
      + '<label class="dpw-merk"><input type="checkbox" id="dpw-merken"> '
      + 'Diese Wahl merken <span>(änderbar unter Einstellungen › Darstellung › PDF-Export)</span></label>'
      + '</div>';

    document.body.appendChild(ov);

    function zu() { ov.remove(); }
    ov.querySelector('.dpw-zu').addEventListener('click', zu);
    ov.addEventListener('click', function (e) { if (e.target === ov) zu(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { zu(); document.removeEventListener('keydown', esc); }
    });

    [].forEach.call(ov.querySelectorAll('.dpw-k'), function (k) {
      k.addEventListener('click', function () {
        var w = wahl(k.dataset.id);
        if (!w) return;
        if (ov.querySelector('#dpw-merken').checked) setze({ fassung: w.id, immer: true });
        zu();
        fuehreAus(w);
      });
    });

    var erste = ov.querySelector('.dpw-an') || ov.querySelector('.dpw-k');
    if (erste) erste.focus();
  }

  /* ── v2900 · Abschnitt in Einstellungen › Darstellung ───────────────
     settings.js baut das Fenster als HTML-Zeichenkette und ruft hier hinein
     (wie DealPilotPilot.einstellungenHtml) - die Liste der Fassungen steht
     so an EINER Stelle. */
  function einstellungenHtml() {
    var rahmen = 'padding:12px 14px;background:#FAF9F4;border-radius:8px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 25%, transparent)';
    var feld = 'width:100%;max-width:320px;padding:9px 12px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);border-radius:8px;background:#fff;color:var(--ch,#2A2727);font:inherit;cursor:pointer';
    var zeile = function (id, an, titel, text) {
      return '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-top:10px">'
        + '<input type="checkbox" id="' + id + '"' + (an ? ' checked' : '') + ' style="margin-top:3px;flex-shrink:0;cursor:pointer" onchange="window.DealPilotPdfWahl.ausEinstellungen()">'
        + '<span><span style="display:block;color:var(--ch,#2A2727);font-weight:500">' + titel + '</span>'
        + '<span style="display:block;color:var(--muted,#5F5E5A);margin-top:2px;line-height:1.5;font-weight:400">' + text + '</span></span></label>';
    };
    return '<hr class="dvd">'
      + '<h3 class="set-section-h">PDF-Export</h3>'
      + '<p class="hint" style="margin-bottom:10px">Beim Klick auf PDF fragt DealPilot, welche Fassung es werden soll. Hier legst du fest, welche vorausgewählt ist. Gilt auf allen deinen Geräten.</p>'
      + '<div style="' + rahmen + '">'
      + '<label for="set_pdf_fassung" style="display:block;font-weight:500;color:var(--ch,#2A2727);margin-bottom:6px">Vorausgewählte Fassung</label>'
      + '<select id="set_pdf_fassung" style="' + feld + '" onchange="window.DealPilotPdfWahl.ausEinstellungen()">'
      + '<option value=""' + (vorgabe.fassung ? '' : ' selected') + '>Keine (Bankfassung markiert)</option>'
      + WAHLEN.map(function (w) { return '<option value="' + w.id + '"' + (vorgabe.fassung === w.id ? ' selected' : '') + '>' + w.titel + '</option>'; }).join('')
      + '</select>'
      + zeile('set_pdf_immer', vorgabe.immer, 'Ohne Rückfrage erzeugen', 'Die vorausgewählte Fassung entsteht sofort, der Dialog kommt nicht mehr. Neben dem PDF-Knopf lässt sich jederzeit neu wählen.')
      + zeile('set_pdf_pilot', vorgabe.pilot, 'Pilot-Analyse ins PDF', 'Gilt für alle Fassungen. Derselbe Schalter steht in der Pilot-Analyse unter dem Knopf „Pilot-Analyse starten".')
      + '</div>';
  }
  function ausEinstellungen() {
    var f = document.getElementById('set_pdf_fassung'), i = document.getElementById('set_pdf_immer'), p = document.getElementById('set_pdf_pilot');
    var neu = {};
    if (f) neu.fassung = f.value;
    if (i) neu.immer = !!i.checked;
    if (p) neu.pilot = !!p.checked;
    setze(neu);
    /* „ohne Rückfrage" braucht eine Fassung - ohne sie bleibt der Haken nicht stehen */
    if (i && i.checked && !vorgabe.immer) i.checked = false;
  }

  /* ── Umhüllen ────────────────────────────────────────────────────── */
  function umhuellen() {
    if (typeof window.exportPDFBank === 'function' && !window.exportPDFBank.__dpw) {
      origBank = window.exportPDFBank;
      window.exportPDFBank = function (opt) {
        if (opt && opt.ohneRueckfrage) return origBank.apply(this, arguments);
        return frage('bank');
      };
      window.exportPDFBank.__dpw = true;
    }
    if (typeof window.exportPDF === 'function' && !window.exportPDF.__dpw) {
      origVoll = window.exportPDF;
      window.exportPDF = function (opt) {
        if (opt && opt.ohneRueckfrage) return origVoll.apply(this, arguments);
        return frage('hell');
      };
      window.exportPDF.__dpw = true;
    }
  }

  /* Die Exportfunktionen entstehen in Dateien, die nach dieser hier
     geladen werden können. Deshalb nicht einmal, sondern bis beide da
     sind - höchstens zehn Sekunden lang. */
  var versuche = 0;
  (function warten() {
    umhuellen();
    if ((!origBank || !origVoll) && versuche++ < 40) setTimeout(warten, 250);
  })();

  /* v2900 · Haken setzen, sobald er im DOM steht; Vorgabe nach dem Login holen */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pilotHaken); else pilotHaken();
  try { window.addEventListener('dp:plan-ready', laden, { once: true }); } catch (e) {}
  setTimeout(laden, 2500);

  window.DealPilotPdfWahl = {
    zeige: zeige,
    vergessen: function () { setze({ immer: false }); },
    /* v1733 · der eine Aufruf, den es brauchte: Merker loeschen UND fragen.
       `zeige()` allein haette den alten Merker stehen lassen - wer dann ohne
       Haken eine andere Fassung waehlt, bekaeme beim naechsten Mal wieder
       die alte. */
    neuWaehlen: function (vorauswahl) {
      setze({ immer: false });
      zeige(vorauswahl || vorgabe.fassung || 'bank');
    },
    gemerkt: gemerkt,
    wahlen: WAHLEN,
    vorgabe: function () { return { fassung: vorgabe.fassung, immer: vorgabe.immer, pilot: vorgabe.pilot }; },
    pilotAn: pilotAn,
    einstellungenHtml: einstellungenHtml,
    ausEinstellungen: ausEinstellungen,
    laden: laden
  };
})();
