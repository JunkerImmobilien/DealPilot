'use strict';
/* ═════════════════════════════════════════════════════════════════════
   erinnerung-mieterhoehung.js — v3218 · W-12b · Erinnerung vor Mieterhöhung

   Die Einstellung (Einstellungen › Allgemein), Standard AUS. Eingeschaltet
   schickt der tägliche Lauf im Backend (services/mieterhoehungErinnerung.js)
   ein bis zwei Monate vor dem Termin „verlangbar ab" eine Mail - je Einheit
   und Termin einmal.

   Gerechnet wird hier nichts: die Termine kommen aus mietpotenzial-kern.js
   (mhTermine über potenzial.js modell) und reisen beim Speichern des Objekts
   als _soll_einheiten mit (storage.js collectData, seit v3159). Datum und
   Einheit, kein Mietername.

   Stand und Nachweis liegen am Konto: GET/PUT /erinnerungen (user_settings +
   consent_log). Kein nacktes fetch - Auth.apiCall.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DealPilotErinnerung) return;
  var ID = 'dp-erinnerung-mh';
  var _stand = null;

  function el(id) { return document.getElementById(id); }
  function api() { return !!(window.Auth && Auth.apiCall && (!Auth.isApiMode || Auth.isApiMode())); }

  function zeichnen() {
    var cb = el(ID), info = el(ID + '-info');
    if (!cb) return;
    if (_stand) {
      cb.checked = !!_stand.mieterhoehung;
      cb.disabled = false;
      if (info) info.textContent = _stand.mieterhoehung && _stand.seit
        ? 'Eingeschaltet seit ' + new Date(_stand.seit).toLocaleDateString('de-DE') + '.'
        : 'Ausgeschaltet.';
    }
  }
  function laden() {
    if (!api()) { var i = el(ID + '-info'); if (i) i.textContent = 'Nur mit Anmeldung verfügbar.'; return; }
    Auth.apiCall('/erinnerungen').then(function (r) {
      _stand = { mieterhoehung: !!(r && r.mieterhoehung), seit: r && r.seit };
      zeichnen();
    }).catch(function () { var i = el(ID + '-info'); if (i) i.textContent = 'Stand konnte nicht geladen werden.'; });
  }
  function setzen(an) {
    var cb = el(ID), info = el(ID + '-info');
    if (!api()) return;
    if (cb) cb.disabled = true;
    Auth.apiCall('/erinnerungen', { method: 'PUT', body: { mieterhoehung: !!an } }).then(function (r) {
      _stand = { mieterhoehung: !!(r && r.mieterhoehung), seit: r && r.seit };
      zeichnen();
      try { if (window.showToast) showToast(an ? 'Erinnerung vor Mieterhöhung eingeschaltet' : 'Erinnerung vor Mieterhöhung ausgeschaltet'); } catch (e) {}
    }).catch(function () {
      if (cb) { cb.checked = !an; cb.disabled = false; }
      if (info) info.textContent = 'Nicht gespeichert – bitte noch einmal versuchen.';
    });
  }

  /* Abschnitt für Einstellungen › Allgemein (settings.js), gleiche Form wie
     der Haken „Erklär mir das“ im Pilot-Abschnitt. */
  function einstellungenHtml() {
    setTimeout(function () { if (_stand) zeichnen(); laden(); }, 0);
    return '<hr class="dvd"><h3 class="set-section-h">Erinnerungen</h3>'
      + '<label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer;font-size:13px;line-height:1.4">'
      + '<input type="checkbox" id="' + ID + '" style="margin-top:2px" disabled onchange="DealPilotErinnerung.setzen(this.checked)">'
      + '<span><b>Erinnerung vor Mieterhöhung</b><br><span class="hint" style="color:var(--muted)">'
      + 'Ich bekomme eine E-Mail ein bis zwei Monate, bevor laut Rechnung eine Mieterhöhung nach § 558 BGB verlangt werden kann – je Einheit und Termin einmal, nur für Objekte im Bestand. '
      + 'Grundlage sind die Termine beim letzten Speichern des Objekts (Ist-Miete, letzte Erhöhung, Kappungsgrenze). Kein Mietername, keine Rechtsberatung. Standard: aus.'
      + '</span><br><span class="hint" id="' + ID + '-info" style="color:var(--muted)">Stand wird geladen …</span></span></label>';
  }

  window.DealPilotErinnerung = { VERSION: 'v3218', einstellungenHtml: einstellungenHtml, setzen: setzen, laden: laden };
})();
