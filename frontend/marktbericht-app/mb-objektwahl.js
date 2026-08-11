'use strict';
/* ═══════════════════════════════════════════════════════════════
   v567 — Bestandsobjekt-Auswahl im Marktbericht (additiv)
   Fix ggü v566:
   - Dropdown wird jetzt sicher befuellt (expliziter Bearer-Token aus localStorage).
   - Label = "<seq_no> · <Adresse komplett>".
   - Felder-Mapping gegen die ECHTEN kurzen data-Keys (str/hnr/plz/ort/nkm/ze/kp/wfl/
     zimmer/baujahr/etage/gsfl/garagen/objart/ausst/modernis/ek).
   - Detail wird per /objects/{id} geladen (data-Objekt).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  function $(id) { return document.getElementById(id); }
  var OBJ_API = '/api/v1/objects';

  function token() { try { return localStorage.getItem('ji_token') || ''; } catch (e) { return ''; } }
  function authHeaders() { var t = token(); return t ? { 'Authorization': 'Bearer ' + t } : {}; }

  function setVal(id, v) {
    var el = $(id); if (!el || v == null || v === '') return;
    el.value = v;
    /* v1135-WMBACK-2 · Ein Auswahlfeld nimmt einen unbekannten Wert nicht
     * an — es bleibt STILL leer. Beim Messen selbst hereingefallen: die
     * Werte standen im Objekt, das Feld war trotzdem leer, und nichts
     * sagte warum. Passiert echt, wenn eine Optionsliste sich zwischen
     * zwei Fassungen aendert. Kein Verhalten geaendert, nur sichtbar
     * gemacht. */
    if (el.tagName === 'SELECT' && String(el.value) !== String(v)) {
      try {
        console.warn('[mbow] ' + id + ': gespeicherter Wert "' + v +
          '" ist keine gueltige Option -> Feld bleibt leer. Optionen: ' +
          [].slice.call(el.options).map(function (o) { return o.value; }).join('|'));
      } catch (e) {}
    }
    try { el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }
  function num(v) { if (v == null || v === '') return 0; return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0; }

  function mapPtype(raw) {
    if (!raw) return null;
    var s = String(raw).toLowerCase();
    if (/doppelhaus|dhh/.test(s)) return 'DHH';
    if (/reihenhaus|reihen|\brh\b/.test(s)) return 'RH';
    if (/eigentumswohnung|etw|wohnung|whg|apartment/.test(s)) return 'ETW';
    if (/einfamilien|efh/.test(s)) return 'EFH';
    if (/mehrfamilien|mfh/.test(s)) return 'MFH';
    if (/buero|b\u00fcro/.test(s)) return 'BUERO';
    if (/geschaeft|gesch\u00e4ft|gesch/.test(s)) return 'GESCH';
    if (/hotel/.test(s)) return 'HOTEL';
    if (/gewerbe|industrie|gew/.test(s)) return 'GEW';
    if (/garage|stellplatz|gar/.test(s)) return 'GAR';
    if (/haus/.test(s)) return 'EFH';
    return null;
  }
  /* v1136c-WMTAB-1 · Zwei gemessene Fehler in dieser Zuordnung.
   *
   * Die Haupt-App fuehrt fuenf Zustaende (ds2_zustand in index.html:991):
   * neubau, gut, normal, renovierungsbeduerftig, stark_sanierungsbeduerftig.
   * Das Berichtsfeld cond fuehrt sechs andere: neuwertig, saniert,
   * modernisiert, gepflegt, normal, renovierungsbeduerftig.
   *
   * 1. `gut` traf keine einzige Regel und ergab null — das Feld blieb leer.
   *    Zustand ist Pflicht fuer die Marktpreisindikation, und ohne Stufe 2
   *    ist Stufe 3 unerreichbar: der haeufigste Zustandswert ueberhaupt
   *    sperrte den Bericht. Im Browser gemessen an Hermannstr. 9
   *    (ds2_zustand='gut'): cond leer, Stufe 2 "fehlt: Zustand",
   *    Stufe 3 nicht erreichbar.
   *
   * 2. `stark_sanierungsbeduerftig` wurde zu `saniert`. Die alte
   *    Schleife verglich fuenf Anfangsbuchstaben, und "sanie" steckt in
   *    "sanierungsbeduerftig". Der schlechteste Zustand kam als
   *    instandgesetzt an — ein Fehler mit falschem Vorzeichen, der den
   *    Wert hebt statt ihn zu senken.
   *
   * Deshalb jetzt eine ausdrueckliche Tabelle statt einer Heuristik. Die
   * beiden Zuordnungen, die eine fachliche Entscheidung sind:
   *   gut                        -> gepflegt   (die Liste kennt kein "gut";
   *                                 gepflegt ist der Nachbar unter neuwertig)
   *   stark_sanierungsbeduerftig -> renovierungsbeduerftig (schlechteste
   *                                 Stufe, die das Berichtsfeld anbietet)
   * Der unscharfe Weg bleibt fuer Freitext aus Altbestaenden erhalten —
   * aber erst NACH der Tabelle, und "sanierungsbeduerftig" wird vorher
   * abgefangen. */
  var COND_MAP = {
    'neubau': 'neuwertig', 'kernsaniert': 'neuwertig', 'neuwertig': 'neuwertig',
    'gut': 'gepflegt', 'gepflegt': 'gepflegt',
    'normal': 'normal',
    'saniert': 'saniert', 'modernisiert': 'modernisiert',
    'renovierungsbeduerftig': 'renovierungsbeduerftig',
    'stark_sanierungsbeduerftig': 'renovierungsbeduerftig',
    'sanierungsbeduerftig': 'renovierungsbeduerftig'
  };
  function mapCond(raw) {
    if (!raw) return null;
    var s = String(raw).toLowerCase().trim();
    if (COND_MAP[s]) return COND_MAP[s];
    /* Freitext: bedarf zuerst — sonst gewinnt wieder "sanie" aus
     * "sanierungsbeduerftig" gegen "saniert". */
    if (/bed(ue|ü)rftig/.test(s)) return 'renovierungsbeduerftig';
    if (/neubau|kernsaniert|neuwertig/.test(s)) return 'neuwertig';
    var opts = ['modernisiert', 'gepflegt', 'saniert', 'normal'];
    for (var i = 0; i < opts.length; i++) { if (s.indexOf(opts[i].slice(0, 5)) > -1) return opts[i]; }
    return null;
  }

  // Befuellt die mb-Eingabefelder aus dem data-Objekt eines DealPilot-Objekts.
  function fillFromData(d) {
    if (!d || typeof d !== 'object') return;
    // Adresse
    var addr = [
      [d.str, d.hnr].filter(Boolean).join(' '),
      [d.plz, d.ort].filter(Boolean).join(' ')
    ].filter(Boolean).join(', ');
    if (addr) setVal('address', addr);
    // Typ
    var pt = mapPtype(d.objart); if (pt) setVal('ptype', pt);
    // Flaeche / Zimmer / Baujahr / Etage
    setVal('area', d.wfl);
    setVal('rooms', d.zimmer);
    setVal('year', d.baujahr);
    setVal('floor', d.etage);
    // Kaufpreis
    setVal('price', d.kp);
    // Kaltmiete gesamt = nkm + ze
    var rent = num(d.nkm) + num(d.ze);
    if (rent > 0) setVal('rent', rent);
    // Grundstueck
    setVal('plot', d.gsfl);
    // Garagen -> garages, Aussenstellplaetze -> outdoor (separate Felder)
    if (num(d.garagen) > 0) setVal('garages', d.garagen);
    var aus = d.stellpl_aussen || d.aussenstellplaetze;
    if (num(aus) > 0) setVal('outdoor', aus);
    // Badezimmer
    setVal('baths', d.bad_anz);
    // Balkon/Terrasse -> balcony
    setVal('balcony', d.balkon_flae);
    // Garten -> garden (falls vorhanden)
    setVal('garden', d.garten_flae || d.garten);
    // Modernisierungsjahr
    setVal('modyear', d.modernis);
    // Energieklasse: ds2_energie zuerst (ek ist oft 0/leer). 'A+' -> 'A'.
    var en = d.ds2_energie || d.energieklasse || d.ek;
    if (en && String(en) !== '0') setVal('energy', String(en).toUpperCase().trim()[0]);
    // Zustand: ds2_zustand zuerst; 'neubau'/'kernsaniert' -> neuwertig
    var zu = mapCond(d.ds2_zustand || d.zustand); if (zu) setVal('cond', zu);
    // Ausstattung
    var au = d.ausst; if (au) { var a = String(au).toLowerCase(); var amap = { 'einfach': 'einfach', 'normal': 'normal', 'gehoben': 'gehoben', 'luxus': 'luxurioes', 'luxuriös': 'luxurioes', 'stark gehoben': 'luxurioes' }; if (amap[a]) setVal('quality', amap[a]); }
    // Wohneinheiten (MFH)
    setVal('units', d.me_anz || d.einheiten);

    /* v1135-WMBACK-1 \u00b7 Die Wertermittlungsangaben zurueck ins Formular.
     *
     * Bis hierher war die Objektwahl eine Einbahnstrasse in die andere
     * Richtung: _mbBuildObjData() schreibt 38 Wertermittlungsfelder ins
     * Objekt (v1072/v1074/v1121), v1134 sorgt dafuer, dass sie dort
     * stehen bleiben \u2014 aber gelesen hat sie nie jemand. Wer sein Objekt
     * hier waehlte, bekam 15 Grundfelder und musste Hinterland, NHK, die
     * neun Gewerke und die fuenf Bauteile jedes Mal neu tippen.
     *
     * Zwei Namen las die Objektwahl ausserdem falsch: _mbBuildObjData()
     * schreibt `baeder` und `ausstattung`, gelesen wurde `bad_anz` und
     * `ausst`. Beide jetzt als Rueckfalle mit drin. */
    setVal('baths', d.bad_anz || d.baeder);
    if (!$('quality') || !$('quality').value) {
      var au2 = d.ausst || d.ausstattung;
      if (au2) {
        var a2 = String(au2).toLowerCase();
        var am2 = { 'einfach': 'einfach', 'normal': 'normal', 'gehoben': 'gehoben',
                    'luxus': 'luxurioes', 'luxuri\u00f6s': 'luxurioes', 'stark gehoben': 'luxurioes' };
        if (am2[a2]) setVal('quality', am2[a2]);
      }
    }
    var offen = fuelleWertermittlung(d);
    if (offen.length) beobachteFormular(d, offen);

    var note = $('mbow-note');
    if (note) { note.textContent = '\u2713 Objektdaten \u00fcbernommen \u2014 pr\u00fcfen und \u201eMarktbericht erstellen\u201c klicken.'; note.style.color = '#3FA56C'; }
  }

  /* Speicherschluessel -> Formular-Id. Die Namen stammen 1:1 aus
   * _mbBuildObjData() in marktbericht-app/app.js; nichts ist neu benannt. */
  var WM_MAP = [
    ['mea_pct', 'mea'], ['lzs_pct', 'lzs'], ['baustatus', 'baustatus'],
    ['bgf', 'bgf'], ['sonstige_jahr', 'sonstEinnahmen'],
    ['stellplatz_miete_monat', 'spMiete'], ['sanierungsjahr', 'sanierungsjahr'],
    ['nutzung', 'usage'], ['modernis_grad', 'modern'],
    ['standardstufe', 'standardstufe'], ['grundriss', 'grundriss'], ['mod_punkte', 'modGrad'],
    ['nhk_haus', 'nhkHaus'], ['nhk_geschosse', 'nhkGeschosse'], ['nhk_dach', 'nhkDach'],
    ['hinterland_qm', 'hinterlandFlaeche'], ['hinterland_eur_qm', 'hinterlandWert'],
    ['hinterland_rentierlich', 'hinterlandRent'],
    ['garagen_bgf_qm', 'garagenBgf'], ['garagen_stufe', 'garagenStufe'],
    ['aussenanlagen_pct', 'aussenPct'], ['aussenanlagen', 'aussenanlagen'],
    ['bes_bauteile', 'besBauteile'], ['sachwertfaktor', 'sachwertfaktor'],
    ['ausst_aussenwaende', 'ausstAussenwaende'], ['ausst_dach', 'ausstDach'],
    ['ausst_fenster', 'ausstFenster'], ['ausst_innenwaende', 'ausstInnenwaende'],
    ['ausst_decken', 'ausstDecken'], ['ausst_fussboeden', 'ausstFussboeden'],
    ['ausst_sanitaer', 'ausstSanitaer'], ['ausst_heizung', 'ausstHeizung'],
    ['ausst_technik', 'ausstTechnik'],
    ['btl_gauben', 'btlGauben'], ['btl_balkone', 'btlBalkone'], ['btl_vordach', 'btlVordach'],
    ['btl_terrassen', 'btlTerrassen'], ['btl_sonstige', 'btlSonstige'],
    ['brw_manuell', 'brwManuell'], ['brw_stichtag', 'brwStichtag'],
    ['brw_anpassung_pct', 'brwAnp'], ['brw_anpassung_grund', 'brwAnpGrund'],
    ['eq_roof', 'eq_roof'], ['eq_walls', 'eq_walls'], ['eq_windows', 'eq_windows'],
    ['eq_heating', 'eq_heating'], ['eq_bath', 'eq_bath'], ['eq_floor', 'eq_floor'],
    ['eq_guest_wc', 'eq_guest_wc'], ['eq_store_room', 'eq_store_room']
  ];

  /* Setzt alles, was JETZT schon im DOM steht. Zurueck kommt, was noch fehlt. */
  function fuelleWertermittlung(d) {
    /* v1136b-WMTAB-1 · Der Miteigentumsanteil steht an zwei Schluesseln: das
     * Hauptprogramm fuehrt ihn seit jeher als `mea`, der Marktbericht
     * schreibt ihn als `mea_pct` zurueck. Wer ihn im Objekt-Reiter gepflegt
     * hat und nie einen Bericht erzeugte, hatte hier ein leeres Feld — und
     * ohne Miteigentumsanteil erreicht eine Wohnung Stufe 3 gar nicht
     * erst, der ganze Wertermittlungsblock erscheint dann nicht.
     *
     * Der Rueckfall steht am DATENSATZ, nicht in der Schleife unten. In
     * v1136 stand er dort — gemessen im Browser blieb das Feld trotzdem
     * leer: derselbe `d` geht an beobachteFormular(), und der Beobachter
     * liest d[p[0]] erneut. Ein Rueckfall nur in der Schleife verfehlt also
     * genau die Felder, die noch nicht im DOM stehen, und das sind vor dem
     * Sprung auf Stufe 3 alle. Der Originalname behaelt Vorrang. */
    if ((d.mea_pct == null || d.mea_pct === '') && d.mea != null && d.mea !== '') {
      d.mea_pct = d.mea;
    }
    var offen = [];
    WM_MAP.forEach(function (p) {
      var v = d[p[0]];
      if (v == null || v === '') return;
      if ($(p[1])) setVal(p[1], v); else offen.push(p);
    });
    return offen;
  }

  /* Die Wertermittlungsfelder liegen im Block wm-b3 und existieren erst,
   * wenn der Nutzer so weit ist. Ein einmaliges Befuellen verpufft also
   * still. Deshalb ein Beobachter, der nachtraegt, sobald die Felder
   * entstehen \u2014 kein requestAnimationFrame, das feuert im verborgenen
   * Tab nie. Er trennt sich selbst, sobald nichts mehr offen ist. */
  var _wmObs = null;
  function beobachteFormular(d, offen) {
    if (_wmObs) { try { _wmObs.disconnect(); } catch (e) {} _wmObs = null; }
    var ziel = document.getElementById('wm-form') || document.body;
    _wmObs = new MutationObserver(function () {
      offen = offen.filter(function (p) {
        if (!$(p[1])) return true;
        setVal(p[1], d[p[0]]);
        return false;
      });
      if (!offen.length) { try { _wmObs.disconnect(); } catch (e) {} _wmObs = null; }
    });
    try { _wmObs.observe(ziel, { childList: true, subtree: true }); } catch (e) { _wmObs = null; }
  }

  async function loadDetail(id) {
    try {
      var r = await fetch(OBJ_API + '/' + encodeURIComponent(id), { headers: authHeaders() });
      if (r.ok) { var d = await r.json(); var o = d.item || d.object || d; return o && o.data ? o.data : o; }
    } catch (e) {}
    return null;
  }

  async function buildDropdown() {
    var sel = $('mbow-select'), host = $('mbow-host');
    if (!sel || !host) return;
    try { sel.innerHTML = '<option>\u2026 lade Objekte \u2026</option>'; host.style.display = ''; } catch(e) {} /* v570-dropfast: sofort sichtbar */
    try {
      var r = await fetch(OBJ_API + '?limit=100', { headers: authHeaders() });
      if (!r.ok) { host.style.display = 'none'; return; }
      var resp = await r.json();
      var items = resp.items || resp.objects || [];
      if (!items.length) { host.style.display = 'none'; return; }
      var opts = ['<option value="">\u2014 Objekt aus Bestand w\u00e4hlen \u2014</option>'];
      items.forEach(function (it) {
        var id = it.id || it.key || it.object_key;
        var seq = it.seq_no || it.obj_seq || (it.data && it.data._obj_seq) || '';
        var name = it.name || (it.data && it.data._name) || id;
        var label = (seq ? (seq + ' \u00b7 ') : '') + name;
        opts.push('<option value="' + String(id).replace(/"/g, '&quot;') + '">' + String(label).replace(/</g, '&lt;') + '</option>');
      });
      sel.innerHTML = opts.join('');
      host.style.display = '';  /* v570-dropfast: sichtbar sobald Liste da */
      sel.addEventListener('change', async function () {
        var id = sel.value;
        /* v942-publish
         * BUG bis v941: die id wurde nur zum Nachladen der Daten benutzt und
         * dann WEGGEWORFEN. app.js las external_ref ausschliesslich aus
         * location.search -> ein ueber dieses Dropdown erzeugter Bericht hatte
         * gar keinen Objektbezug und konnte in der Deal-Aktion nie auftauchen.
         * Jetzt merken wir sie: app.js liest _mbwRef zuerst. */
        window._mbwRef = id || null;
        window._mbwLabel = (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text) || null;
        try { window.dispatchEvent(new CustomEvent('mb:object-picked', { detail: { ref: id || null } })); } catch (e) {}
        if (!id) return;
        var note = $('mbow-note'); if (note) { note.textContent = 'Lade Objektdaten \u2026'; note.style.color = '#8a8a93'; }
        var data = await loadDetail(id);
        if (data) fillFromData(data);
        else if (note) { note.textContent = '\u2717 Konnte Objektdaten nicht laden.'; note.style.color = '#B8625C'; }
      });
    } catch (e) { host.style.display = 'none'; }
  }

  function mount() {
    if ($('mbow-host')) { buildDropdown(); return true; }
    var addr = $('address'); if (!addr) return false;
    var panel = (addr.closest && addr.closest('.panel')) || addr.parentElement;
    if (!panel) return false;
    var box = document.createElement('div');
    box.id = 'mbow-host';
    box.style.cssText = 'margin:0 0 16px;padding:12px 14px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);border-radius:12px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 5%, transparent);';
    box.innerHTML =
      '<label style="display:block;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--wl-c9a84c, #C9A84C);margin-bottom:7px;font-weight:600;">Objekt aus Bestand laden</label>' +
      '<select id="mbow-select" style="width:100%;padding:9px 11px;border-radius:9px;background:#0f0f13;color:#e8e8ea;border:1px solid #26262c;font-size:13px;"><option>\u2026</option></select>' +
      '<div id="mbow-note" style="font-size:11.5px;color:#8a8a93;margin-top:7px;"></div>';
    panel.insertBefore(box, panel.firstChild);
    buildDropdown();
    return true;
  }

  var tries = 0;
  (function autoInit() {
    if (mount()) return;
    if (tries++ < 40) setTimeout(autoInit, 250);
  })();
})();
