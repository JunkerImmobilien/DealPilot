/* ankauf-ansicht.js - v2037
 * ═════════════════════════════════════════════════════════════════════
 * DIE ANKAUF-ANSICHT: lesen, nicht schreiben.
 *
 * Marcel: „der Ankauf sollte dann, wenn es gewonnen ist, eingefroren
 * werden und vielleicht auch die Eingaben nicht mehr moeglich sein.
 * Alle Tabs leicht daruebergelegt ausgegraut und ein Hinweis 'Ankauf
 * abgeschlossen' mit noch paar Informationen und einer Checkbox zum
 * Freigeben als nachtraegliche Editierbarkeit."
 *
 * Auf Rueckfrage entschieden: die Sperre gilt **nur in der
 * Ankauf-Ansicht**. Im Bestand bleibt alles editierbar - sonst koennte
 * man Mieterhoehungen, Kosten und neue Vertraege nicht mehr pflegen,
 * und genau dafuer gibt es den Bestand.
 *
 * ── DIE EINE GEFAHR, UM DIE SICH ALLES DREHT ────────────────────────
 *
 * Die Ankauf-Ansicht laedt den EINGEFRORENEN Datensatz in dasselbe
 * Formular, in dem sonst der laufende steht. Schreibt irgendetwas in
 * diesem Zustand, sind die laufenden Zahlen weg - ueberschrieben mit
 * Zahlen von vor zwei Jahren.
 *
 * Gemessen, welche Wege schreiben:
 *
 *   saveObj()            storage.js:757   - der Hauptweg
 *   dpTabSwitchSave()    storage.js:3947  - beim Reiterwechsel
 *     -> performSave()   storage.js:3875  -> ruft saveObj
 *   loadSaved()          storage.js:1904  - ruft dpTabSwitchSave ZUERST
 *
 * Alle drei laufen durch `saveObj`. Deshalb sitzt die Sperre dort und
 * nirgends sonst - eine Sperre je Aufrufer waere eine Liste, die beim
 * naechsten neuen Aufrufer unvollstaendig ist.
 *
 *   > Eine Sperre gehoert an die Stelle, durch die ALLE muessen, nicht
 *   > an jede, die man gerade kennt.
 *
 * ── UND DIE FREIGABE ────────────────────────────────────────────────
 *
 * Die Checkbox gibt nicht das laufende Objekt frei, sondern den
 * ANKAUF-STAND zur Korrektur. Wer sie setzt und dann speichert,
 * schreibt einen neuen Ankauf-Stand - mit Nachweis, wie am 09.10.
 * entschieden. Der laufende Stand bleibt davon unberuehrt.
 * ═════════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  var _aktiv = false;        /* zeigt die Ankauf-Ansicht? */
  var _frei = false;         /* Freigabe-Haken gesetzt? */
  var _key = null;           /* welches Objekt war geladen? */

  function el(id) { return document.getElementById(id); }

  function datum(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return String(iso || '');
    var t = String(iso).split('-');
    return t[2] + '.' + t[1] + '.' + t[0];
  }

  /* ── Die Sperre ───────────────────────────────────────────────────
     EIN Griff, an der Stelle, durch die alle Schreibwege muessen.
     `saveObj` ist global (storage.js:757) und wird hier umhuellt. */
  (function sperreSetzen() {
    if (typeof window.saveObj !== 'function') { setTimeout(sperreSetzen, 300); return; }
    if (window.saveObj._dpAnkaufSperre) return;
    var echt = window.saveObj;
    var gewarnt = false;
    var huelle = function () {
      if (_aktiv && !_frei) {
        /* Nicht werfen - nur nichts tun. Ein Fehler hier wuerde die
           Reiterumschaltung abbrechen, und der Nutzer saesse fest. */
        if (!gewarnt) {
          gewarnt = true;
          setTimeout(function () { gewarnt = false; }, 4000);
          try { console.info('[v2037] Speichern gesperrt: Ankauf-Ansicht'); } catch (e) {}
        }
        return Promise.resolve(false);
      }
      return echt.apply(this, arguments);
    };
    huelle._dpAnkaufSperre = true;
    huelle._dpEcht = echt;
    window.saveObj = huelle;
  })();

  /* ── Der Hinweis ueber den Reitern ────────────────────────────── */
  function banner(a) {
    var felder = a.daten ? Object.keys(a.daten).length : 0;
    var korr = (a.korrekturen || []).length;
    return '<div class="ank-ansicht-kopf">'
      + '<div class="ank-ansicht-txt">'
      + '<b>Ankauf abgeschlossen · ' + datum(a.stichtag) + '</b>'
      + '<span>Eingefroren zum Nutzen-/Lastenwechsel. Du siehst den Stand von damals — '
      + felder + ' Felder'
      + (a.daten && a.daten._ai ? ', inklusive Pilot-Analyse' : '')
      + (korr ? ' · ' + korr + (korr === 1 ? ' Korrektur' : ' Korrekturen') : '')
      + '. Eingaben sind gesperrt, damit niemand Geschichte überschreibt.</span>'
      + '</div>'
      + '<label class="ank-frei"><input type="checkbox" id="ank-freigabe"'
      + (_frei ? ' checked' : '') + '> Zum nachträglichen Bearbeiten freigeben</label>'
      + '</div>';
  }

  function bannerZeichnen() {
    var host = el('ank-ansicht-host');
    var A = window.DealPilotAnkauf;
    if (!host || !_aktiv || !A || !A.vorhanden()) { if (host) host.innerHTML = ''; return; }
    host.innerHTML = banner(A.stand());
    var cb = el('ank-freigabe');
    if (cb) cb.addEventListener('change', function () {
      _frei = !!cb.checked;
      document.body.classList.toggle('dp-ankauf-frei', _frei);
      if (typeof toast === 'function') {
        toast(_frei
          ? '⚠ Der Ankauf-Stand ist zum Bearbeiten frei. Beim Speichern wird er überschrieben — mit Nachweis.'
          : '✓ Ankauf-Stand wieder gesperrt.');
      }
    });
  }

  /* ── Hin und zurueck ──────────────────────────────────────────── */
  function setzen(anAnkauf) {
    var A = window.DealPilotAnkauf;
    if (!A) return;
    anAnkauf = !!anAnkauf;
    if (anAnkauf === _aktiv) return;

    if (anAnkauf) {
      if (!A.vorhanden()) return;     /* ohne Stand nichts zu zeigen */
      _key = window._currentObjKey || null;
      /* ERST sichern, DANN sperren - sonst geht der letzte Tastendruck
         am laufenden Objekt verloren. */
      try {
        var echt = window.saveObj && window.saveObj._dpEcht;
        if (typeof echt === 'function') echt({ silent: true });
      } catch (e) {}
      _aktiv = true; _frei = false;
      document.body.classList.add('dp-ankauf-ansicht');
      document.body.classList.remove('dp-ankauf-frei');
      /* den eingefrorenen Datensatz ins Formular - ab hier ist alles,
         was man sieht, Vergangenheit.

         v2037a - DER STAND MUSS DANACH ZURUECK. Gemessen: nach dem
         Laden war window._dpAnkauf null, und der Hinweis blieb leer.
         Ursache: loadData setzt _dpAnkauf aus d._ankauf - und der
         eingefrorene Datensatz traegt kein _ankauf, weil wir es beim
         Festschreiben bewusst entfernen (sonst Matrjoschka).

         Das Laden der Vergangenheit loescht also die Kenntnis davon,
         dass es eine gibt. */
      var merker = A.stand();
      try { if (typeof loadData === 'function') loadData(merker.daten); } catch (e) {
        console.warn('[v2037] laden:', e.message);
      }
      window._dpAnkauf = merker;
      bannerZeichnen();
      return;
    }

    /* zurueck: den LAUFENDEN Stand neu holen - nicht aus dem Formular,
       dort steht gerade die Vergangenheit.

       v2037b - DIE SPERRE BLEIBT WAEHRENDDESSEN AN. Gemessen: beim
       Zurueckschalten stieg die Objektversion von 310 auf 311 - es
       wurde geschrieben. Ursache: loadSaved() ruft als ERSTES
       dpTabSwitchSave(), und das sichert das Formular. Im Formular
       stand noch die Vergangenheit.

       Diesmal ist nichts verlorengegangen (die beiden Staende waren
       ohnehin gleich), aber wer nach dem Festschreiben etwas gepflegt
       haette, haette es damit verloren.

         > Eine Sperre, die man loest, BEVOR der letzte Schreibweg
         > durch ist, hat genau einen Augenblick zu frueh aufgehoert.

       Deshalb: erst laden (die Sperre blockt den Save darin), dann
       loesen. */
    _frei = false;
    document.body.classList.remove('dp-ankauf-ansicht', 'dp-ankauf-frei');
    var host = el('ank-ansicht-host');
    if (host) host.innerHTML = '';
    function loesen() { _aktiv = false; }
    if (_key && typeof loadSaved === 'function') {
      try {
        var p = loadSaved(_key);
        if (p && typeof p.then === 'function') p.then(loesen, loesen);
        else setTimeout(loesen, 400);
      } catch (e) { console.warn('[v2037] zurueck:', e.message); loesen(); }
    } else { loesen(); }
  }

  /* Objektwechsel beendet die Ankauf-Ansicht: der neue Stand gehoert
     einem anderen Objekt, und ein stehengebliebener Modus zeigte die
     Vergangenheit des Vorgaengers. */
  window.addEventListener('dp:object-ready', function () {
    if (_aktiv && window._currentObjKey !== _key) setzen(false);
    else if (_aktiv) setTimeout(bannerZeichnen, 200);
  });

  window.DealPilotAnkaufAnsicht = {
    setzen: setzen,
    aktiv: function () { return _aktiv; },
    frei: function () { return _frei; },
    bannerZeichnen: bannerZeichnen
  };
})();
