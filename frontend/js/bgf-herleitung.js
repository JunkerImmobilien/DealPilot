/* ════════════════════════════════════════════════════════════════════
   v1434 · BRUTTOGRUNDFLAECHE — WAS PASSIERT, WENN DAS FELD LEER BLEIBT
   ════════════════════════════════════════════════════════════════════

   Backlog v22, Punkt 8: „Bruttofläche nicht zwingend als manuelles
   Pflichtfeld behandeln … automatisch ermittelten Wert und verwendete
   Annahme transparent ausweisen … Nutzer kann den Wert optional genauer
   angeben."

   GEMESSEN: Die Ableitung GIBT es bereits — im Rechenkern des
   Marktberichts (marktbericht/backend/src/lib/nhk2010.js, bgf()):
     · direkt angegeben            → gilt, „direkt"
     · Haus, nur Wohnfläche        → Wohnfläche × 1,55, „Näherung"
     · Mehrfamilienhaus            → KEINE Näherung (Treppenhaus, Keller,
                                     Nebenräume schwanken zu stark)
     · Eigentumswohnung            → Sachwert nur mit direkter BGF
                                     (CrossCheckService, istWohnung)
   Im Bericht steht die Näherung offen dabei. Im FORMULAR stand davon
   nichts: niemand sah, dass das Feld leer bleiben darf, welcher Wert
   daraus wird — und dass es beim MFH nicht geht.

   Diese Datei RECHNET NICHTS für die Bewertung. Sie zeigt unter dem Feld,
   was der Rechenkern mit den Angaben tun wird. Der Faktor 1,55 steht hier
   nur für die Anzeige und MUSS dem Rechenkern folgen (nhk2010.js, bgf()).
   Ändert sich dort der Faktor, gehört er hier nachgezogen.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var FAKTOR_HAUS = 1.55;   /* = nhk2010.js bgf() Rueckfall OHNE Gebaeudetyp; mit Typ gilt die SW-RL-Tabelle (v1446) */
  var HAEUSER = { EFH: 1, ZFH: 1, DHH: 1, RH: 1 };

  function el(id) { return document.getElementById(id); }
  function zahl(e) {
    if (!e) return 0;
    var s = String(e.value || '').trim();
    if (!s) return 0;
    if (typeof window.parseDe === 'function') return window.parseDe(s);
    var n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }
  function qm(n) { return Math.round(n).toLocaleString('de-DE') + ' m²'; }

  function hinweisEl() {
    var h = el('bgf-herleitung');
    if (h) return h;
    var inp = el('bgf');
    var f = inp && inp.closest ? inp.closest('.f') : null;
    if (!f) return null;
    h = document.createElement('div');
    h.id = 'bgf-herleitung';
    h.className = 'cf-hint';
    h.style.marginTop = '4px';
    f.appendChild(h);
    return h;
  }

  function aktualisieren() {
    var h = hinweisEl();
    if (!h) return;
    var art = (el('objart') && el('objart').value) || '';
    var bgf = zahl(el('bgf'));
    var wfl = zahl(el('wfl'));
    var text = '';
    if (bgf > 0) {
      text = 'Direkt angegeben — damit rechnet der Sachwert.';
    } else if (HAEUSER[art]) {
      text = wfl > 0
        ? 'Leer gelassen: der Marktbericht nähert die BGF aus der Wohnfläche mit dem Faktor der Gebäudeart (Sachwertrichtlinie, NHK 2010 — z. B. 1,5 bei Typ 1.31; ohne Gebäudeart pauschal 1,55 ≈ '
          + qm(wfl * FAKTOR_HAUS) + ') und weist sie als Näherung aus. Ein gemessener Wert macht den Sachwert belastbarer.'
        : 'Leer gelassen: der Marktbericht nähert die BGF aus der Wohnfläche (× 1,55), sobald diese eingetragen ist.';
    } else if (art === 'MFH') {
      text = 'Bei Mehrfamilienhäusern nähert der Marktbericht die BGF nur mit Gebäudetyp (4.1 bis 4.3) und Standardstufe 3 bis 5 (Faktor 1,8 bis 2,5 laut Sachwertrichtlinie). Sonst bitte direkt angeben.';
    } else if (art === 'ETW') {
      text = 'Bei Eigentumswohnungen rechnet der Sachwert nur mit direkt angegebener BGF — ohne sie entfällt er.';
    }
    h.textContent = text;
    h.style.display = text ? '' : 'none';
  }

  function start() {
    ['bgf', 'wfl', 'objart'].forEach(function (id) {
      var e = el(id);
      if (!e || e._dpBgfHinweis) return;
      e._dpBgfHinweis = true;
      e.addEventListener('input', aktualisieren);
      e.addEventListener('change', aktualisieren);
    });
    aktualisieren();
  }
  /* Nach dem Laden eines Objekts stehen neue Werte in den Feldern, ohne dass
     ein input-Ereignis faellt (storage.js setzt .value direkt). */
  window.addEventListener('dp:object-ready', function () { setTimeout(aktualisieren, 200); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  window._dpBgfHinweis = aktualisieren;
})();
