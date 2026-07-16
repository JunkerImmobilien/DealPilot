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
  function mapCond(raw) {
    if (!raw) return null;
    var s = String(raw).toLowerCase();
    var opts = ['neuwertig', 'saniert', 'modernisiert', 'gepflegt', 'normal', 'renovierungsbeduerftig'];
    for (var i = 0; i < opts.length; i++) { if (s === opts[i] || s.indexOf(opts[i].slice(0, 5)) > -1) return opts[i]; }
    if (/neubau|kernsaniert/.test(s)) return 'neuwertig';
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

    var note = $('mbow-note');
    if (note) { note.textContent = '\u2713 Objektdaten \u00fcbernommen \u2014 pr\u00fcfen und \u201eMarktbericht erstellen\u201c klicken.'; note.style.color = '#3FA56C'; }
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
        var id = sel.value; if (!id) return;
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
