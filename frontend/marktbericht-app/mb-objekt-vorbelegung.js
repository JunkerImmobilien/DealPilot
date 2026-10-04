'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   mb-objekt-vorbelegung.js — v1852 · Das Objekt füllt das Formular
   ═══════════════════════════════════════════════════════════════════════

   Marcel, 04.10.2026: „im Marktbericht gibt's ja auch nochmal. Ich hoffe,
   dass dort auch genau diese Felder und Angaben dann alle drin sind."

   GEMESSEN: waren sie nicht. Die Marktbericht-App bekam beim Öffnen aus
   der Haupt-App sechs URL-Werte (address, ptype, area, year, price, ref)
   und SCHRIEB ihre Wertermittlungsfelder ans Objekt (_mbBuildObjData, seit
   v1136) — gelesen hat sie sie nie zurück. Wer die Standardstufe im Reiter
   Objekt pflegte, fand sie hier leer.

   Dieses Modul liest das Objekt per `ref` (/api/v1/objects/:id) und setzt
   jedes Formularfeld, das leer ist, aus dem Datenschlüssel. Die Zuordnung
   ist die Umkehrung von _mbBuildObjData() in app.js — wer dort einen
   Schlüssel ändert, ändert ihn hier. Eigene Eingaben im Formular gewinnen:
   nur leere Felder werden gefüllt. Felder, die wertermittlung.js erst
   später rendert, werden bis fünf Sekunden abgewartet.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  /* Datenschlüssel am Objekt → Formular-ID der Marktbericht-App */
  var MAP = {
    wfl: 'area', baujahr: 'year', zimmer: 'rooms', etage: 'floor', gsfl: 'plot', einheiten: 'units', kp: 'price', nkm: 'rent',
    garagen: 'garages', stellpl_aussen: 'outdoor', balkon_flae: 'balcony', bad_anz: 'baths', modernis: 'modyear',
    eq_roof: 'eq_roof', eq_walls: 'eq_walls', eq_windows: 'eq_windows', eq_heating: 'eq_heating', eq_bath: 'eq_bath',
    eq_floor: 'eq_floor', eq_guest_wc: 'eq_guest_wc', eq_store_room: 'eq_store_room', baustatus: 'baustatus',
    mea: 'mea', lzs_pct: 'lzs', hinterland_qm: 'hinterlandFlaeche', hinterland_eur_qm: 'hinterlandWert',
    hinterland_rentierlich: 'hinterlandRent', garagen_bgf_qm: 'garagenBgf', garagen_stufe: 'garagenStufe',
    aussenanlagen_pct: 'aussenPct', nhk_haus: 'nhkHaus', nhk_geschosse: 'nhkGeschosse', nhk_dach: 'nhkDach',
    ausst_aussenwaende: 'ausstAussenwaende', ausst_dach: 'ausstDach', ausst_fenster: 'ausstFenster',
    ausst_innenwaende: 'ausstInnenwaende', ausst_decken: 'ausstDecken', ausst_fussboeden: 'ausstFussboeden',
    ausst_sanitaer: 'ausstSanitaer', ausst_heizung: 'ausstHeizung', ausst_technik: 'ausstTechnik',
    btl_gauben: 'btlGauben', btl_balkone: 'btlBalkone', btl_vordach: 'btlVordach', btl_terrassen: 'btlTerrassen',
    btl_sonstige: 'btlSonstige', brw_manuell: 'brwManuell', brw_stichtag: 'brwStichtag', brw_anpassung_pct: 'brwAnp',
    brw_anpassung_grund: 'brwAnpGrund', stellplatz_miete_monat: 'spMiete', ds2_zustand: 'cond',
    standardstufe: 'standardstufe', grundriss: 'grundriss', mod_punkte: 'modGrad', bgf: 'bgf',
    sonstige_jahr: 'sonstEinnahmen', aussenanlagen: 'aussenanlagen', bes_bauteile: 'besBauteile', sachwertfaktor: 'sachwertfaktor',
    nutzungsart: 'usage', ausst: 'quality'
  };
  /* Werte, die im Formular anders heißen als am Objekt */
  /* Gemessen an marktbericht-app/index.html (04.10.2026):
       cond    = gepflegt | neuwertig | saniert | modernisiert | normal | renovierungsbeduerftig
       quality = einfach | normal | gehoben | luxurioes
     „stark sanierungsbedürftig" hat dort keine Entsprechung — es wird NICHT
     auf „renovierungsbedürftig" abgeschwächt, sondern bleibt leer (Warnung). */
  var UMSCHLUESSELN = {
    cond: { neubau: 'neuwertig', gut: 'gepflegt', normal: 'normal', renovierungsbeduerftig: 'renovierungsbeduerftig' },
    quality: { Einfach: 'einfach', Normal: 'normal', Gehoben: 'gehoben', Luxus: 'luxurioes', einfach: 'einfach', normal: 'normal', gehoben: 'gehoben', luxus: 'luxurioes' }
  };
  function ref() { try { return new URLSearchParams(location.search).get('ref') || null; } catch (e) { return null; } }
  function tok() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }

  function setzen(id, wert) {
    var el = document.getElementById(id); if (!el) return false;
    if (el.type === 'checkbox') { if (!el.checked && /^(ja|true|1)$/i.test(String(wert))) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); } return true; }
    if (String(el.value || '').trim() !== '') return true;   /* eigene Eingabe gewinnt */
    var v = String(wert);
    if (UMSCHLUESSELN[id] && UMSCHLUESSELN[id][v] != null) v = UMSCHLUESSELN[id][v];
    if (el.tagName === 'SELECT') {
      var hat = Array.prototype.some.call(el.options, function (o) { return o.value === v; });
      if (!hat) { try { console.warn('[mb-vorbelegung] ' + id + ': Wert "' + v + '" nicht in den Optionen'); } catch (e) {} return true; }
    }
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  async function laden() {
    var r = (window._mbwRef && String(window._mbwRef)) || ref(); if (!r || !tok()) return;
    var d = null;
    try {
      var g = await fetch('/api/v1/objects/' + encodeURIComponent(r), { headers: { Authorization: 'Bearer ' + tok() } });
      if (!g.ok) return;
      var o = await g.json(); var cur = (o.item || o.object || o); d = cur.data || null;
    } catch (e) { return; }
    if (!d) return;
    var offen = Object.keys(MAP).filter(function (k) { return d[k] != null && d[k] !== ''; });
    var gesetzt = 0, runden = 0;
    (function runde() {
      offen = offen.filter(function (k) { var ok = setzen(MAP[k], d[k]); if (ok) gesetzt++; return !ok; });
      if (offen.length && runden++ < 16) setTimeout(runde, 300);
      else { try { console.log('[mb-vorbelegung] ' + gesetzt + ' Felder aus dem Objekt, ' + offen.length + ' ohne Formularfeld' + (offen.length ? ': ' + offen.join(', ') : '')); } catch (e) {} }
    })();
    window._mbVorbelegt = { ref: r, felder: gesetzt };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', laden); else laden();
  window.addEventListener('mb:object-picked', function (e) { try { if (e && e.detail && e.detail.ref) { window._mbwRef = e.detail.ref; } } catch (x) {} laden(); });
  window.MbObjektVorbelegung = { laden: laden, MAP: MAP };
})();
