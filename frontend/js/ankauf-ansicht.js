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

  /* v2108: der Erklaertext geht jetzt als `title` ins Markup - also muss
     er maskiert werden. Diese Datei hatte kein `esc()`; eins aus einer
     anderen Datei zu RUFEN waere eine stille Abhaengigkeit gewesen, die
     erst beim Rendern auffaellt (node --check sieht so etwas nie). */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
      /* v2173 · FREIGEGEBEN HEISST: DAS SOLL WIRD GESCHRIEBEN, NICHT DAS IST.
         Aus dem Code gelesen (13.10.2026): mit gesetztem Haken lief der
         normale Speicherweg - er schickt das FORMULAR als Objekt, und im
         Formular steht der eingefrorene Stand. Der Hinweis versprach
         „Speichern ueberschreibt den Ankauf-Stand" - geschrieben haette es
         den laufenden.
         ZURUECKGENOMMEN: ich hatte es zuerst als GEMESSEN gemeldet („2026-999
         trug danach 68 statt 95 m²"). Falsch - die Sicherung von 07:01 traegt
         ebenfalls 68; die 95 stammten aus einer fremden Marktbericht-Karte
         (v2168). Gegen die Sicherung verglichen: nichts ueberschrieben. */
      if (_aktiv && _frei) return sollSpeichern();
      return echt.apply(this, arguments);
    };
    huelle._dpAnkaufSperre = true;
    huelle._dpEcht = echt;
    window.saveObj = huelle;
  })();

  /* v2173 · Den freigegebenen Soll-Stand speichern: nur `_ankauf` im
     SERVER-Stand des Objekts ersetzen. Daten, Analyse und Fotos kommen
     vom Server zurueck, wie sie dort liegen - das Formular (Soll) wird nie
     als Objekt geschickt. Ein Speichern ohne Aenderung schreibt nichts und
     erzeugt keinen Nachweis-Eintrag. */
  var _sollLaeuft = null;
  function sollSpeichern() {
    if (_sollLaeuft) return _sollLaeuft;
    var A = window.DealPilotAnkauf, key = _key || window._currentObjKey;
    if (!A || !A.vorhanden() || !key || typeof Auth === 'undefined' || !Auth.apiCall) return Promise.resolve(false);
    var vorher = JSON.stringify(A.stand().daten || {});
    var a;
    try { a = A.korrigieren('daten'); } catch (e) { return Promise.resolve(false); }
    if (JSON.stringify(a.daten || {}) === vorher) {
      if (a.korrekturen && a.korrekturen.length) a.korrekturen.pop();   /* nichts geaendert */
      return Promise.resolve(false);
    }
    _sollLaeuft = Auth.apiCall('/objects/' + key, { method: 'GET' })
      .then(function (obj) {
        var d = (obj && obj.data) || {};
        d._ankauf = a;
        return Auth.apiCall('/objects/' + key, { method: 'PUT',
          body: { data: d, aiAnalysis: obj.ai_analysis || null, photos: obj.photos || [] } });
      })
      .then(function () {
        if (typeof toast === 'function') toast('✓ Ankauf-Stand gespeichert — Korrektur mit Nachweis. Das Ist ist unverändert.');
        return true;
      })
      .catch(function (e) {
        console.warn('[v2173] Soll speichern:', e && e.message);
        if (typeof toast === 'function') toast('⚠ Ankauf-Stand konnte nicht gespeichert werden.');
        return false;
      })
      .then(function (r) { _sollLaeuft = null; return r; });
    return _sollLaeuft;
  }

  /* ── Felder wirklich sperren ──────────────────────────────────────
     v2038 - `pointer-events:none` nimmt ein Feld NICHT aus der
     Tabulatorfolge und macht es nicht schreibgeschuetzt. Gemessen:
     mit Tab hineingesprungen liess sich `kp` von 780000 auf 999999
     setzen, waehrend das Speichern gesperrt war.

     Eine Eingabe, die angenommen und still verworfen wird, ist
     schlimmer als eine, die gar nicht erst moeglich ist. */
  function felder() {
    var raus = [];
    var alle = document.querySelectorAll('.sec input, .sec select, .sec textarea, .sec button');
    for (var i = 0; i < alle.length; i++) {
      var f = alle[i];
      /* Der Hinweis mit der Freigabe ist der einzige Weg zurueck. */
      if (f.closest && f.closest('#ank-ansicht-host')) continue;
      raus.push(f);
    }
    return raus;
  }

  function sperren() {
    var f = felder();
    for (var i = 0; i < f.length; i++) {
      var e = f[i];
      if (e.getAttribute('data-ank-lock')) continue;   /* schon von uns */
      var tag = e.tagName.toLowerCase();
      var typ = (e.getAttribute('type') || '').toLowerCase();
      var schreibbar = (tag === 'textarea')
        || (tag === 'input' && ['checkbox', 'radio', 'file', 'button', 'submit', 'reset'].indexOf(typ) < 0);
      if (schreibbar) {
        /* Schon vorher schreibgeschuetzt? Dann nicht anfassen - sonst
           gibt das Verlassen etwas frei, das nie frei war. */
        if (e.readOnly) continue;
        e.readOnly = true;
        e.setAttribute('data-ank-lock', 'ro');
      } else {
        if (e.disabled) continue;
        e.disabled = true;
        e.setAttribute('data-ank-lock', 'dis');
      }
      /* aus der Tabulatorfolge - sonst springt man weiter hinein */
      if (e.getAttribute('tabindex') === null) {
        e.setAttribute('tabindex', '-1');
        e.setAttribute('data-ank-tab', '1');
      }
    }
    return f.length;
  }

  function entsperren() {
    var alle = document.querySelectorAll('[data-ank-lock]');
    for (var i = 0; i < alle.length; i++) {
      var e = alle[i];
      if (e.getAttribute('data-ank-lock') === 'ro') e.readOnly = false;
      else e.disabled = false;
      e.removeAttribute('data-ank-lock');
      if (e.getAttribute('data-ank-tab')) {
        e.removeAttribute('tabindex');
        e.removeAttribute('data-ank-tab');
      }
    }
    return alle.length;
  }

  /* Reiterwechsel und Nachrendern bringen neue Felder. Solange die
     Ansicht laeuft, wird nachgesperrt - sonst waere ein Reiter, den
     man erst spaeter oeffnet, offen. */
  var _wacht = null;
  function wachen(an) {
    if (_wacht) { clearInterval(_wacht); _wacht = null; }
    if (an) _wacht = setInterval(function () { if (_aktiv && !_frei) sperren(); }, 900);
  }

  /* ── Der Hinweis ueber den Reitern ────────────────────────────── */
  /* ══ v2173 · IST | SOLL IM OBJEKT ══════════════════════════════════════
     Marcel am 13.10.2026: „Manchmal ist das gesperrt, manchmal ist es nicht
     gesperrt ... Wir hatten auch oben so ein rotes Kaestchen gesetzt ...
     das fehlt irgendwie auch."

     GEMESSEN: der Schalter in der Seitenleiste stand auf „Ankauf", die
     Karten waren gedreht - und die Ansicht im Formular war AUS, die Felder
     offen, der Freigabe-Haken aber noch sichtbar (ein Ueberbleibsel). Ursache:
     beim Objektwechsel beendete diese Datei die Ansicht, die Seitenleiste
     wusste davon nichts. Und das Beenden lud dabei das VORIGE Objekt neu
     (loadSaved(_key) mit dem alten Schluessel).

     Seit v2173 ist die Seitenleiste ein FILTER nach Phase (doppelkarte.js),
     und der eingefrorene Stand hat seinen eigenen Umschalter HIER, im
     Objekt - Marcels Wahl: „Knopf im Objekt". Er steht bei jedem Objekt
     mit Ankauf-Stand, Ist ist der Ausgangszustand. */
  function banner(a) {
    var felderZahl = a.daten ? Object.keys(a.daten).length : 0;
    var korr = (a.korrekturen || []).length;
    var erklaerung = 'Soll = Ankauf-Stand zum ' + datum(a.stichtag) + ', eingefroren zum Nutzen-/Lastenwechsel — '
      + felderZahl + ' Felder'
      + (a.daten && a.daten._ai ? ', inklusive Pilot-Analyse' : '')
      + (korr ? ' · ' + korr + (korr === 1 ? ' Korrektur' : ' Korrekturen') : '')
      + '.\nIst = der laufende Stand von heute, frei zu pflegen.';
    var wahl = '<div class="ank-wahl" role="group" aria-label="Stand">'
      + '<button type="button" class="ank-seg' + (_aktiv ? '' : ' aktiv') + '" data-ank-stand="ist">Ist · heute</button>'
      + '<button type="button" class="ank-seg' + (_aktiv ? ' aktiv' : '') + '" data-ank-stand="soll">Soll · Ankauf-Stand ' + esc(datum(a.stichtag)) + '</button>'
      + '</div>';
    var frei = _aktiv
      ? '<label class="ank-frei"><input type="checkbox" id="ank-freigabe"' + (_frei ? ' checked' : '')
        + '> ' + (_frei ? 'Freigegeben — Speichern überschreibt den Ankauf-Stand (mit Nachweis)'
                        : 'Gesperrt · zum nachträglichen Bearbeiten freigeben') + '</label>'
      : '';
    return '<div class="ank-ansicht-kopf ank-schlank ank-mit-wahl' + (_aktiv ? ' ank-soll' : '') + '" title="' + esc(erklaerung) + '">'
      + wahl + frei + '</div>';
  }

  function bannerZeichnen() {
    var host = el('ank-ansicht-host');
    var A = window.DealPilotAnkauf;
    if (!host) return;
    if (!A || !A.vorhanden()) { host.innerHTML = ''; return; }
    host.innerHTML = banner(A.stand());
    if (!host._ankKlick) {
      host._ankKlick = true;
      host.addEventListener('click', function (ev) {
        var b = ev.target && ev.target.closest ? ev.target.closest('[data-ank-stand]') : null;
        if (!b) return;
        setzen(b.getAttribute('data-ank-stand') === 'soll');
      });
    }
    var cb = el('ank-freigabe');
    if (cb) cb.addEventListener('change', function () {
      _frei = !!cb.checked;
      document.body.classList.toggle('dp-ankauf-frei', _frei);
      /* v2038 - die Freigabe muss die Felder WIRKLICH oeffnen, nicht
         nur die Abblendung nehmen. */
      if (_frei) { wachen(false); entsperren(); }
      else { sperren(); wachen(true); }
      bannerZeichnen();
      if (typeof toast === 'function') {
        toast(_frei
          ? '⚠ Der Ankauf-Stand ist zum Bearbeiten frei. Beim Speichern wird er überschrieben — mit Nachweis.'
          : '✓ Ankauf-Stand wieder gesperrt.');
      }
    });
  }

  /* ── Hin und zurueck ──────────────────────────────────────────── */
  /* v2219 · der Teil von setzen(true), der den Ankauf ins Formular laedt -
     er laeuft erst, wenn der letzte Save des Ist abgeschlossen ist. */
  function ankaufLaden(A) {
    /* v2037a · Der Stand muss danach zurück: loadData setzt _dpAnkauf aus
       d._ankauf, und der eingefrorene Datensatz trägt kein _ankauf (beim
       Festschreiben bewusst entfernt, sonst Matrjoschka). */
    var merker = A.stand();
    if (!merker) return;
    try { if (typeof loadData === 'function') loadData(merker.daten); } catch (e) {
      console.warn('[v2037] laden:', e.message);
    }
    window._dpAnkauf = merker;
    bannerZeichnen();
    var n = sperren();
    wachen(true);
    try { console.info('[v2038] Ankauf-Ansicht: ' + n + ' Felder gesperrt'); } catch (e) {}
  }
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
      /* v2219 · „erst sichern" heisst: WARTEN, bis gesichert ist. Vorher lief der
         Save los und das Laden des Ankaufs gleich hinterher - der Save las das
         Formular nach seinem await und schrieb den Ankauf als Ist (Parkstraße,
         14.10.2026). Jetzt: Sperre sofort an (kein weiterer Save kommt durch),
         dieser eine Save mit _vorAnkauf zu Ende, DANN der Ankauf ins Formular. */
      var vorher = Promise.resolve();
      try {
        var echt = window.saveObj && window.saveObj._dpEcht;
        if (typeof echt === 'function') vorher = Promise.resolve(echt({ silent: true, _vorAnkauf: true })).catch(function () {});
      } catch (e) {}
      _aktiv = true; _frei = false;
      document.body.classList.add('dp-ankauf-ansicht');
      document.body.classList.remove('dp-ankauf-frei');
      vorher.then(function () { if (_aktiv && window._currentObjKey === _key) ankaufLaden(A); });
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
    wachen(false);
    entsperren();
    document.body.classList.remove('dp-ankauf-ansicht', 'dp-ankauf-frei');
    function loesen() { _aktiv = false; bannerZeichnen(); }
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
  /* v2173: beim Objektwechsel NICHT setzen(false) - das lud mit dem alten
     Schluessel das VORIGE Objekt neu. Das neue steht schon im Formular;
     hier wird nur der Zustand geloest. */
  function abbrechen() {
    _frei = false; _aktiv = false; _key = null;
    wachen(false);
    entsperren();
    document.body.classList.remove('dp-ankauf-ansicht', 'dp-ankauf-frei');
  }
  window.addEventListener('dp:object-ready', function () {
    if (_aktiv && window._currentObjKey !== _key) abbrechen();
    setTimeout(bannerZeichnen, 200);
  });

  window.DealPilotAnkaufAnsicht = {
    setzen: setzen,
    aktiv: function () { return _aktiv; },
    frei: function () { return _frei; },
    bannerZeichnen: bannerZeichnen,
    _sperren: sperren,
    _entsperren: entsperren
  };
})();
