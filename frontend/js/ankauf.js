/* ankauf.js - v2030
 * ═════════════════════════════════════════════════════════════════════
 * DER ANKAUF-STAND: derselbe Datensatz, zwei Zeitpunkte.
 *
 * Marcels Entscheidungen vom 09.10.2026 (Konzept-Dokument, Backlog
 * N60.12):
 *
 *   Bauart        B - ein Objekt, darin ein eingefrorener Stand
 *   Woerter       Ankauf · Bestand · Abweichung
 *   Stichtag      Nutzen-/Lastenwechsel
 *   Nachfragen    ja, nie stillschweigend einfrieren
 *   Ausloeser     unter „Gewonnen", kein eigener Knopf woanders
 *   Korrigierbar  ja, aber mit Nachweis
 *
 * ── WAS HIER NICHT PASSIERT ─────────────────────────────────────────
 *
 * **Dieses Modul rechnet nichts.** Kein Score, kein DSCR, keine
 * Rendite. Alles, was der Vergleich braucht, steht schon im Datensatz:
 * die App persistiert ihre Kennzahlen als `_kpis_*` und `_ds2_score`,
 * gerechnet von den echten Kernen zum jeweiligen Zeitpunkt.
 *
 *   > Ein zweiter Rechenweg fuer dieselbe Zahl waere hier besonders
 *   > teuer: er wuerde die ALTEN Daten mit dem HEUTIGEN Kern rechnen
 *   > und das Ergebnis „Ankauf" nennen. Dann misst die Abweichung nicht
 *   > das Objekt, sondern unsere eigenen Kernaenderungen.
 *
 * Der Ankauf traegt die Zahlen, die damals galten. Punkt.
 *
 * ── WAS EINGEFROREN WIRD ────────────────────────────────────────────
 *
 * Der GANZE Datensatz, bis auf zwei Dinge:
 *
 *   `_ankauf`  - sonst friert der Ankauf sich selbst ein, und beim
 *                zweiten Mal steckt der erste Stand im zweiten. Nach
 *                drei Korrekturen ist das Objekt eine Matrjoschka.
 *   `_thumb`   - ein base64-Bild, das sich jederzeit neu erzeugen
 *                laesst. Es verdoppelt nur das Gewicht der Zeile.
 *
 * Alles andere bleibt: Eingaben, Einheiten (`_mfh`), die Pilot-Analyse
 * (`_ai`) samt Stempel, die Kennzahlen, die Lageklasse.
 *
 * ── DIE KURZFASSUNG IST KEIN KOMFORT ────────────────────────────────
 *
 * `kurz` traegt neun Zahlen doppelt - sie stehen auch in `daten`. Das
 * ist Absicht: die Objektliste bekommt vom Server NUR Spalten, die die
 * Abfrage aus dem JSON zieht (`objectService.listForUser`), nicht den
 * ganzen Datensatz. Ohne `kurz` muesste die Karten-Rueckseite je Objekt
 * nachladen - 21 Abrufe fuer eine Liste.
 *
 * Doppelte Zahlen muessen zusammenbleiben: `kurz` wird NUR in
 * `_kurzfassung()` erzeugt, aus `daten`, nie von Hand gefuellt.
 * ═════════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  /* Die Kennzahlen, die verglichen werden. Reihenfolge = Anzeigereihenfolge.
     `schluessel` ist der Name IM DATENSATZ, nicht im Formular. */
  var KENNZAHLEN = [
    { schluessel: 'kp',             wort: 'Kaufpreis',          einheit: 'eur',  besser: 'kleiner' },
    { schluessel: 'nkm',            wort: 'Nettokaltmiete',     einheit: 'eur',  besser: 'groesser' },
    { schluessel: '_kpis_miete_j',  wort: 'Jahresmiete',        einheit: 'eur',  besser: 'groesser' },
    { schluessel: '_kpis_bmy',      wort: 'Bruttomietrendite',  einheit: 'pct',  besser: 'groesser' },
    { schluessel: '_kpis_nmy',      wort: 'Nettomietrendite',   einheit: 'pct',  besser: 'groesser' },
    { schluessel: '_kpis_dscr',     wort: 'DSCR',               einheit: 'zahl', besser: 'groesser' },
    { schluessel: '_kpis_cf_ns',    wort: 'Cashflow n. Steuer', einheit: 'eur',  besser: 'groesser' },
    { schluessel: '_kpis_ltv',      wort: 'LTV',                einheit: 'pct',  besser: 'kleiner' },
    { schluessel: '_ds2_score',     wort: 'DealScore',          einheit: 'zahl', besser: 'groesser' }
  ];

  /* ── Zahlen ───────────────────────────────────────────────────────
     `Number(null)` ist 0 und besteht `Number.isFinite` - deshalb wird
     erst auf ABWESENHEIT geprueft und dann gerechnet (CLAUDE.md). */
  function zahl(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = (typeof v === 'number') ? v : parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function heute() { return new Date().toISOString().slice(0, 10); }

  /* ── Der Stichtag ─────────────────────────────────────────────────
     Marcel: „Der Stichtag ist eigentlich immer nur zum Lastenwechsel."
     Das Feld dafuer GIBT ES SCHON und ist Pflichtfeld: im Reiter
     Objekt, Gruppe „Erwerb & Besitzuebergang", beschriftet
     „Wirtsch. Uebergang · Nutzen-/Lastenwechsel".

     Fehlt es, wird NICHT heute eingesetzt. Ein eingefrorener Stand mit
     falschem Stichtag ist schlimmer als keiner - er sieht richtig aus. */
  function stichtagVorschlag() {
    var e = document.getElementById('wirtschaftlicher_uebergang');
    var v = e && e.value ? String(e.value).trim() : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  }

  /* ── Lesen ────────────────────────────────────────────────────────
     Gehalten wird der Stand in `window._dpAnkauf` - dasselbe Muster wie
     `window._dpMfh` (storage.js schreibt ihn in `collectData`, liest
     ihn in `loadData`). Ein Modul, das sich seinen Zustand selbst aus
     der Datenbank holt, haette einen zweiten Ladeweg. */
  function stand() {
    var a = window._dpAnkauf;
    return (a && a.daten && typeof a.daten === 'object') ? a : null;
  }
  function vorhanden() { return !!stand(); }

  /* ── Die Kurzfassung ──────────────────────────────────────────────
     EINE Quelle: sie wird aus `daten` erzeugt, nie von Hand gesetzt. */
  function _kurzfassung(daten) {
    var k = {};
    for (var i = 0; i < KENNZAHLEN.length; i++) {
      var s = KENNZAHLEN[i].schluessel;
      k[s] = zahl(daten[s]);
    }
    /* Der Score heisst je nach Tarif anders - der Ankauf nimmt, was da
       ist, und merkt sich NICHT welcher. Beim Vergleich gilt dieselbe
       Reihenfolge auf beiden Seiten, sonst vergleicht man zwei Skalen. */
    if (k._ds2_score == null) k._ds2_score = zahl(daten._dealpilot_score);
    return k;
  }

  /* ── Festschreiben ────────────────────────────────────────────────
     Gibt den neuen Stand zurueck oder wirft. Speichern macht der
     Aufrufer (ueber `saveObj`), damit ein Fehlschlag hier nichts halb
     geschriebenes hinterlaesst. */
  function _datensatzJetzt() {
    if (typeof collectData !== 'function') throw new Error('collectData fehlt');
    var d = collectData();
    if (!d || typeof d !== 'object') throw new Error('collectData gab nichts zurück');
    /* Kopie, damit das Original unberuehrt bleibt */
    var kopie = {};
    for (var k in d) {
      if (!Object.prototype.hasOwnProperty.call(d, k)) continue;
      if (k === '_ankauf') continue;   /* keine Matrjoschka */
      if (k === '_thumb') continue;    /* jederzeit neu erzeugbar */
      kopie[k] = d[k];
    }
    return kopie;
  }

  function festschreiben(stichtag) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(stichtag || '')))
      throw new Error('Kein gültiger Stichtag');
    var daten = _datensatzJetzt();
    var neu = {
      stichtag: stichtag,
      am: new Date().toISOString(),
      kurz: _kurzfassung(daten),
      daten: daten,
      korrekturen: []
    };
    window._dpAnkauf = neu;
    return neu;
  }

  /* ── Korrigieren ──────────────────────────────────────────────────
     Marcel: „es soll auf jeden Fall korrigierbar sein, aber dann halt
     mit einem Nachweis."

     Ein stiller nachtraeglicher Eingriff in den Massstab macht die
     ganze Abweichung wertlos: wer spaeter eine Luecke sieht, kann nicht
     unterscheiden, ob das Objekt sich bewegt hat oder der Massstab. */
  function korrigieren(was, neuerWert) {
    var a = stand();
    if (!a) throw new Error('Es ist kein Ankauf-Stand festgeschrieben');
    if (was === 'stichtag') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(neuerWert || '')))
        throw new Error('Kein gültiger Stichtag');
      if (neuerWert === a.stichtag) return a;   /* nichts zu tun, kein Eintrag */
      a.korrekturen = a.korrekturen || [];
      a.korrekturen.push({ am: new Date().toISOString(), was: 'stichtag', von: a.stichtag, auf: neuerWert });
      a.stichtag = neuerWert;
      return a;
    }
    if (was === 'daten') {
      /* Der ganze Stand wird neu genommen - der ALTE bleibt im Nachweis,
         aber nur seine Kurzfassung: den vollen Datensatz ein zweites Mal
         mitzuschleppen waere genau die Matrjoschka von oben. */
      var neueDaten = _datensatzJetzt();
      a.korrekturen = a.korrekturen || [];
      a.korrekturen.push({ am: new Date().toISOString(), was: 'daten', von: a.kurz, auf: _kurzfassung(neueDaten) });
      a.daten = neueDaten;
      a.kurz = _kurzfassung(neueDaten);
      a.am = new Date().toISOString();
      return a;
    }
    throw new Error('Unbekannte Korrektur: ' + was);
  }

  function verwerfen() { window._dpAnkauf = null; }

  /* ── Die Abweichung ───────────────────────────────────────────────
     Liest beide Seiten aus PERSISTIERTEN Kennzahlen - die eine aus dem
     eingefrorenen Datensatz, die andere aus dem laufenden. Beide wurden
     von denselben Kernen gerechnet, jede zu ihrer Zeit.

     `null` heisst fehlt, nicht null. Eine fehlende Zahl erzeugt KEINE
     Zeile mit „0 %" - sie erzeugt gar keine. */
  /* ── v2098 · DIE ABWEICHUNG FUER EIN BELIEBIGES OBJEKT ────────────────
   *
   * `abweichung()` konnte nur das GERADE GELADENE Objekt: es liest
   * `window._dpAnkauf` und `collectData()`. Fuer das Portfolio-Cockpit
   * braucht es dieselbe Rechnung je Objekt aus der Liste (Backlog N60.16:
   * „die Abweichung ueber den ganzen Bestand - wie viele Objekte stehen
   * besser, wie viele schlechter als beim Ankauf").
   *
   * Die Schleife steht deshalb jetzt EINMAL in `_vergleich()`, und beide
   * Wege rufen sie. Eine zweite Fassung im Cockpit waere genau der Fehler,
   * den `score-tiers.js` vier Kopien gekostet hat - und hier waere er
   * noch teurer, weil `KENNZAHLEN` die Richtung je Kennzahl fuehrt
   * (`besser: 'kleiner'` beim Kaufpreis und beim LTV, `'groesser'` bei
   * den anderen sieben). Wer das nachbaut, verdreht genau diese zwei.
   */
  function _vergleich(a, jetzt) {
    var zeilen = [];
    for (var i = 0; i < KENNZAHLEN.length; i++) {
      var k = KENNZAHLEN[i];
      var vorher = zahl(a.kurz[k.schluessel]);
      var nachher = zahl(jetzt[k.schluessel]);
      if (vorher === null || nachher === null) continue;
      var diff = nachher - vorher;
      var pct = (vorher !== 0) ? (diff / Math.abs(vorher)) * 100 : null;
      zeilen.push({
        wort: k.wort, einheit: k.einheit,
        ankauf: vorher, bestand: nachher, diff: diff, pct: pct,
        richtung: diff === 0 ? 'gleich'
                : ((diff > 0) === (k.besser === 'groesser') ? 'besser' : 'schlechter')
      });
    }
    /* v2098: `urteil` ist der Stand am DealScore - der eigenen
       Gesamtkennzahl des Produkts. KEIN erfundenes Gewicht ueber die neun
       Kennzahlen: welche davon schwerer zaehlt, ist eine Bewertungsfrage.
       Der Score ist die Antwort, die das Produkt ohnehin gibt. `null`
       heisst: kein Score auf einer der beiden Seiten. */
    var sc = null;
    for (var j = 0; j < zeilen.length; j++) {
      if (zeilen[j].wort === 'DealScore') { sc = zeilen[j]; break; }
    }
    return { stichtag: a.stichtag, am: a.am, zeilen: zeilen,
             urteil: sc ? sc.richtung : null,
             urteilQuelle: sc ? 'DealScore' : null,
             scoreAnkauf: sc ? sc.ankauf : null,
             scoreJetzt: sc ? sc.bestand : null,
             korrekturen: (a.korrekturen || []).length };
  }

  function abweichung() {
    var a = stand();
    if (!a) return null;
    var jetzt;
    try { jetzt = _kurzfassung(collectData()); } catch (e) { return null; }
    return _vergleich(a, jetzt);
  }

  /* Dieselbe Rechnung fuer ein Objekt aus der LISTE. `daten` ist das
     flache Datenobjekt; der eingefrorene Stand liegt als `_ankauf` darin.
     Gibt `null`, wenn das Objekt keinen Ankauf-Stand hat - das ist kein
     Fehler, sondern die Mehrheit der Objekte. */
  function abweichungFuer(daten) {
    if (!daten || typeof daten !== 'object') return null;
    var a = daten._ankauf;
    if (!a || !a.kurz || typeof a.kurz !== 'object') return null;
    return _vergleich(a, _kurzfassung(daten));
  }

  /* ── Die Frage unter „Gewonnen" ───────────────────────────────────
     Kein eigener Knopf: sie klappt dort auf, wo der Zuschlag eingetragen
     wird, und sie fragt EINMAL. „Spaeter" ist eine echte Antwort - die
     Zeile bleibt stehen, bis sie beantwortet ist.

     Ein Umbau, der sich nicht abwaehlen laesst, ist kein Angebot
     sondern eine Ansage. */
  function _html() {
    var vorschlag = stichtagVorschlag();
    if (vorhanden()) {
      var a = stand();
      var auto = !!window._dpAnkaufAuto;
      return '<div class="ank-zeile ank-fest">'
        + '<div class="ank-txt"><b>Ankauf-Stand '
        + (auto ? 'automatisch festgeschrieben' : 'festgeschrieben') + '</b> zum '
        + _datum(a.stichtag) + '.'
        + (auto ? ' Beim Setzen auf <i>gewonnen</i>.' : '')
        + (a.korrekturen && a.korrekturen.length
            ? ' <span class="ank-korr">' + a.korrekturen.length
              + (a.korrekturen.length === 1 ? ' Korrektur' : ' Korrekturen') + '</span>'
            : '')
        + '</div>'
        + '<div class="ank-aktionen">'
        + '<button type="button" class="ank-btn-leise" onclick="DealPilotAnkauf.neuNehmen()">Stand neu nehmen</button>'
        + (auto ? '<button type="button" class="ank-btn-leise" onclick="DealPilotAnkauf.zuruecknehmen()">r\u00fcckg\u00e4ngig</button>' : '')
        + '</div></div>';
    }
    if (!vorschlag) {
      return '<div class="ank-zeile ank-frage ank-fehlt">'
        + '<div class="ank-txt"><b>Ankauf-Stand festschreiben?</b> Dafür fehlt der '
        + '<i>Nutzen-/Lastenwechsel</i> im Reiter Objekt. Ohne Stichtag wird nichts '
        + 'eingefroren — ein Stand mit falschem Datum sieht richtig aus und ist es nicht.</div>'
        + '</div>';
    }
    return '<div class="ank-zeile ank-frage">'
      + '<div class="ank-txt"><b>Ankauf-Stand festschreiben?</b> Zum Nutzen-/Lastenwechsel am <b>'
      + _datum(vorschlag) + '</b>. Danach läuft das Objekt als <i>Bestand</i> weiter, '
      + 'und DealPilot zeigt dir die Abweichung.</div>'
      + '<div class="ank-aktionen">'
      + '<button type="button" class="ank-btn" onclick="DealPilotAnkauf.jetzt()">Festschreiben</button>'
      + '<button type="button" class="ank-btn-leise" onclick="DealPilotAnkauf.spaeter()">später</button>'
      + '</div></div>';
  }

  function _datum(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return String(iso || '');
    var t = iso.split('-');
    return t[2] + '.' + t[1] + '.' + t[0];
  }

  var _spaeterGeklickt = false;

  /* v2041 - von selbst einfrieren. Marcel: „ein gewonnenes Objekt ist
     ja sowieso dann im Bestand ... wir sollten zusehen, dass wir es
     dann automatisch einfrieren."

     Am 09.10. hatte er entschieden: nie stillschweigend einfrieren.
     Das ist kein Widerspruch - der Punkt war nicht der KLICK, sondern
     dass nichts UNBEMERKT passiert. Automatisch heisst nicht heimlich:
     es sagt, was es getan hat, mit Datum, und laesst sich in derselben
     Zeile zuruecknehmen.

     Ohne Stichtag passiert NICHTS. Ein eingefrorener Stand mit
     falschem Datum sieht richtig aus und ist es nicht. */
  var _autoLaeuft = false;
  function vonSelbst() {
    if (_autoLaeuft || vorhanden()) return false;
    var t = stichtagVorschlag();
    if (!t) return false;
    _autoLaeuft = true;
    try {
      festschreiben(t);
      window._dpAnkaufAuto = true;
      if (typeof saveObj === 'function') saveObj(true);
      if (typeof toast === 'function')
        toast('\u2713 Ankauf-Stand automatisch festgeschrieben zum ' + _datum(t));
      if (typeof renderSaved === 'function') { try { renderSaved({ forceFresh: true, _immediate: true }); } catch (e) {} }
      return true;
    } catch (e) {
      console.warn('[v2041] automatisch einfrieren:', e.message);
      return false;
    } finally { setTimeout(function () { _autoLaeuft = false; }, 1200); }
  }

  function zuruecknehmen() {
    if (!confirm('Den automatisch festgeschriebenen Ankauf-Stand wieder entfernen?')) return;
    verwerfen();
    window._dpAnkaufAuto = false;
    if (typeof saveObj === 'function') saveObj(true);
    frageZeigen('won');
    if (typeof toast === 'function') toast('\u2713 Ankauf-Stand entfernt.');
    if (typeof renderSaved === 'function') { try { renderSaved({ forceFresh: true, _immediate: true }); } catch (e) {} }
  }

  function frageZeigen(status) {
    var host = document.getElementById('da-ankauf-frage');
    if (!host) return;
    /* v2041 - bei „gewonnen" zuerst versuchen, von selbst einzufrieren. */
    if (status === 'won') vonSelbst();
    /* Nur bei „gewonnen" - und wenn ein Stand da ist, auch bei den
       anderen, damit man ihn ueberhaupt wiederfindet. */
    if (status !== 'won' && !vorhanden()) { host.innerHTML = ''; return; }
    if (status === 'won' && _spaeterGeklickt && !vorhanden()) { host.innerHTML = ''; return; }
    host.innerHTML = _html();
  }

  function spaeter() {
    _spaeterGeklickt = true;
    var host = document.getElementById('da-ankauf-frage');
    if (host) host.innerHTML = '';
    if (typeof toast === 'function') toast('ℹ Du kannst den Ankauf-Stand jederzeit hier festschreiben.');
  }

  function jetzt() {
    var t = stichtagVorschlag();
    if (!t) { if (typeof toast === 'function') toast('⚠ Erst den Nutzen-/Lastenwechsel im Reiter Objekt eintragen.'); return; }
    try {
      festschreiben(t);
      if (typeof saveObj === 'function') saveObj(true);
      frageZeigen('won');
      if (typeof toast === 'function') toast('✓ Ankauf-Stand festgeschrieben zum ' + _datum(t));
      if (typeof renderSaved === 'function') { try { renderSaved({ forceFresh: true, _immediate: true }); } catch (e) {} }
    } catch (e) {
      if (typeof toast === 'function') toast('⚠ ' + (e.message || 'Festschreiben fehlgeschlagen'));
    }
  }

  function neuNehmen() {
    if (!confirm('Den Ankauf-Stand durch den heutigen Stand ersetzen?\n\n'
      + 'Der bisherige bleibt als Nachweis erhalten (Kurzfassung).')) return;
    try {
      korrigieren('daten', null);
      if (typeof saveObj === 'function') saveObj(true);
      frageZeigen('won');
      if (typeof toast === 'function') toast('✓ Ankauf-Stand neu genommen, mit Nachweis');
    } catch (e) {
      if (typeof toast === 'function') toast('⚠ ' + (e.message || 'Fehlgeschlagen'));
    }
  }

  /* Beim Objektwechsel faellt „spaeter" zurueck: die Frage gehoert zu
     DIESEM Objekt, nicht zur Sitzung. */
  window.addEventListener('dp:object-ready', function () {
    _spaeterGeklickt = false;
    setTimeout(function () {
      var st = 'open';
      try {
        /* v2030 - der Export heisst `isWon`, nicht `isDealWon`.
           `isDealWon` ist der INTERNE Name in deal-action.js; nach
           aussen gereicht wird er unter `isWon` (Z. 2443). Ein Griff
           auf den internen Namen waere still `undefined` geblieben und
           haette die Frage bei jedem gewonnenen Objekt verschluckt. */
        if (window._currentObjData && window._currentObjData._deal_lost) st = 'lost';
        else if (window.DealPilotDealAction && typeof DealPilotDealAction.isWon === 'function'
                 && DealPilotDealAction.isWon()) st = 'won';
      } catch (e) {}
      frageZeigen(st);
    }, 400);
  });

  window.DealPilotAnkauf = {
    vorhanden: vorhanden,
    stand: stand,
    kurz: function () { var a = stand(); return a ? a.kurz : null; },
    stichtagVorschlag: stichtagVorschlag,
    festschreiben: festschreiben,
    korrigieren: korrigieren,
    verwerfen: verwerfen,
    abweichung: abweichung,
    /* v2098: fuer das Portfolio-Cockpit - dieselbe Rechnung je Objekt */
    abweichungFuer: abweichungFuer,
    frageZeigen: frageZeigen,
    vonSelbst: vonSelbst,
    zuruecknehmen: zuruecknehmen,
    jetzt: jetzt,
    spaeter: spaeter,
    neuNehmen: neuNehmen,
    KENNZAHLEN: KENNZAHLEN
  };
})();
