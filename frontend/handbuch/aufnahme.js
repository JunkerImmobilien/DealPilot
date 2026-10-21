/* frontend/handbuch/aufnahme.js — v2555 · Bildaufnahme fuer das Flughandbuch
 *
 * Wird NUR von Hand in einen eigenen Tab der App geladen (Konsole oder
 * Automatisierung), nie von einer Seite der App:
 *
 *   var s = document.createElement('script'); s.src = '/handbuch/aufnahme.js?v=1'; document.head.appendChild(s);
 *
 * Ablauf je Objektart:
 *   DPHB.sperre()            Speichern ABSCHALTEN — vor allem anderen
 *   DPHB.demo('ETW')         Formular leeren, Beispielwerte eintragen
 *   DPHB.rahmen('s0')        Reiter oeffnen, Felder nummerieren, in Bilder teilen
 *   DPHB.zeige('s0', 0, fw)  Bild 0 zeigen: scrollen, Felder einkreisen,
 *                            Ausschnitt in Bildschirmfoto-Koordinaten (fw =
 *                            Breite des Bildschirmfoto-Rahmens) zurueckgeben
 *   … Bildschirmfoto …
 *   DPHB.weg()               Markierungen entfernen
 *   DPHB.ergebnis()          JSON fuer frontend/handbuch/bilder/aufnahme.json
 *
 * So lief die Aufnahme v2560 (21.10.2026, Fenster 2133 × 987 CSS-Pixel):
 *   je Bild  await DPHB.bild(sec, i)  →  Zoom-Bildschirmfoto des festen Ausschnitts
 *   [388,72]–[1359,725] (Rahmenkoordinaten) mit save_to_disk  →  die Felder- und
 *   Rahmenliste als Kurzliste komp-<ART>.txt  →  node tools/handbuch-bilder.mjs
 *   schneidet zu, schreibt WebP und aufnahme.json  →  node tools/handbuch-erzeugen.mjs.
 *
 * VORSICHT beim eigenen Messcode im selben Tab: nie `var x = …` auf oberster
 * Ebene. Am 21.10.2026 hat ein `var st` die globale Funktion st() aus calc.js
 * ueberschrieben - calc() brach still ab, Gesamtinvestition stand auf 0.
 *
 * DIE SPERRE ist nicht verhandelbar: Marcel arbeitet im selben Konto. Jeder
 * Nicht-GET-Aufruf (fetch, XHR, Beacon) wird verworfen, saveObj und
 * dpTabSwitchSave sind Attrappen, und localStorage schreibt in eine
 * Schattenkopie, damit Einstellungen wie die Eingabetiefe in Marcels Tabs
 * nicht umspringen. Das Formular wird geleert, ohne dass ein Objekt
 * geladen ist — es gibt nichts, was ueberschrieben werden koennte.
 */
(function () {
  'use strict';
  if (window.DPHB) return;
  var $ = function (id) { return document.getElementById(id); };
  var LOG = { blockiert: [] };
  var ERG = { am: new Date().toISOString().slice(0, 10), ansicht: { breite: innerWidth, hoehe: innerHeight }, arten: {} };
  var _art = null, _rahmen = {};

  function sperre() {
    if (window.__hbSperre) return 'schon gesperrt';
    window.__hbSperre = LOG;
    /* weiches Scrollen abschalten: sonst misst getBoundingClientRect mitten im Scrollen */
    var st0 = document.createElement('style'); st0.textContent = '*{scroll-behavior:auto!important}'; document.head.appendChild(st0);
    var B = LOG.blockiert, of = window.fetch;
    window.fetch = function (u, o) {
      var m = ((o && o.method) || (u && u.method) || 'GET').toUpperCase();
      /* Ausnahme: die LESENDE Zinsauskunft (backend/src/routes/marktbericht.js:503 „kein Bericht, kein Kontingent, keine KI“) */
      if (m !== 'GET' && m !== 'HEAD' && String((u && u.url) || u).indexOf('/marktbericht/wertparameter/') < 0) { B.push(m + ' ' + String((u && u.url) || u)); return Promise.resolve(new Response('{"ok":false,"handbuch":"gesperrt"}', { status: 403, headers: { 'Content-Type': 'application/json' } })); }
      return of.apply(this, arguments);
    };
    var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (m, u) { this.__hb = [String(m).toUpperCase(), u]; return xo.apply(this, arguments); };
    XMLHttpRequest.prototype.send = function () { if (this.__hb && this.__hb[0] !== 'GET' && this.__hb[0] !== 'HEAD') { B.push('XHR ' + this.__hb.join(' ')); try { this.abort(); } catch (e) {} return; } return xs.apply(this, arguments); };
    navigator.sendBeacon = function (u) { B.push('BEACON ' + u); return true; };
    var attrappe = function (n) { var f = function () { B.push(n + ' gesperrt'); return Promise.resolve(null); }; f._dpEcht = f; return f; };
    ['saveObj', 'dpTabSwitchSave'].forEach(function (n) { var f = attrappe(n); try { Object.defineProperty(window, n, { get: function () { return f; }, set: function () {}, configurable: true }); } catch (e) { window[n] = f; } });
    var S = Storage.prototype, ov = {}, del = {}, gi = S.getItem, si = S.setItem, ri = S.removeItem;
    S.setItem = function (k, v) { if (this !== window.localStorage) return si.call(this, k, v); ov[k] = String(v); delete del[k]; };
    S.getItem = function (k) { if (this !== window.localStorage) return gi.call(this, k); if (k in del) return null; if (k in ov) return ov[k]; return gi.call(this, k); };
    S.removeItem = function (k) { if (this !== window.localStorage) return ri.call(this, k); delete ov[k]; del[k] = 1; };
    return 'gesperrt';
  }

  /* ── Beispielwerte ── selbst gesetzt; Adressen aus den Demo-Objekten der Videoreihe */
  var GEMEINSAM = { nutzungsart: 'kapitalanlage', makler_p: '3,57', notar_p: '1,7', gba_p: '0,5', gest_p: '6,5',
    d1z: '4,31', d1t: '1,5', d1_bindj: '10', zve: '60000' };
  /* zvE nur per input-Ereignis: ein change oeffnet bei Abweichung vom Profil den Dialog #zve-sync-overlay.
     Eigenkapital so, dass EK + Darlehen die Gesamtinvestition genau decken (sonst schiebt die App
     einen Warnkasten ein und die Bildmarken verrutschen) - Werte aus „Eigenkapital passend setzen“. */
  var BEISPIEL = {
    ETW: { plz: '32052', ort: 'Herford', str: 'Sachsenstraße', hnr: '18', objart: 'ETW', wfl: '100', zimmer: '3', baujahr: '1998', etage: '2', etagen_ges: '3',
      ds2_zustand: 'gut', standardstufe: '3', ds2_energie: 'C', gsfl: '1200', mea: '12', brw: '190', kp: '239000', nkm: '750', ze: '40', umlagef: '220',
      ek: '72910', d1: '199000', hg_ul: '2400', grundsteuer: '260', hg_nul: '900', weg_r: '600', bgf: '135', thesis: 'Solide vermietete 3-Zimmer-Wohnung, Miete unter Vergleichsniveau.' },
    EFH: { plz: '32052', ort: 'Herford', str: 'Musterweg', hnr: '5', objart: 'EFH', wfl: '140', zimmer: '5', baujahr: '1985', etagen_ges: '2',
      ds2_zustand: 'normal', standardstufe: '3', ds2_energie: 'E', gsfl: '650', brw: '210', kp: '365000', nkm: '1250', ze: '60', umlagef: '280',
      ek: '120261', d1: '295000', grundsteuer: '480', eigen_r: '1800', bgf: '260', nhk_haus: '', thesis: 'Freistehendes Haus mit Garten, langfristig vermietet.' },
    MFH: { plz: '33613', ort: 'Bielefeld', str: 'Westerfeldstr.', hnr: '140', objart: 'MFH', wfl: '390', baujahr: '1967', etagen_ges: '3', einheiten: '4',
      ds2_zustand: 'normal', standardstufe: '3', ds2_energie: 'E', gsfl: '1570', brw: '450', kp: '545000', nkm: '2650', ze: '120', umlagef: '780',
      ek: '185047', d1: '435000', grundsteuer: '1200', eigen_r: '5200', bgf: '507', thesis: 'Vier Wohnungen, Mieten deutlich unter Vergleichsmiete.' }
  };
  var MFH_EINHEITEN = [
    { nr: '1', lage: 'EG links', art: 'wohnen', wfl: '95', zimmer: '3', ist: '620', status: 'vermietet', zustand: '3' },
    { nr: '2', lage: 'EG rechts', art: 'wohnen', wfl: '100', zimmer: '3', ist: '680', status: 'vermietet', zustand: '3' },
    { nr: '3', lage: '1. OG links', art: 'wohnen', wfl: '95', zimmer: '3', ist: '650', status: 'vermietet', zustand: '4' },
    { nr: '4', lage: '1. OG rechts', art: 'wohnen', wfl: '100', zimmer: '3', ist: '700', status: 'vermietet', zustand: '2' }
  ];

  function setze(id, v) {
    var e = $(id); if (!e) return false;
    if (e.type === 'checkbox') e.checked = !!v; else e.value = v;
    (id === 'zve' ? ['input'] : ['input', 'change']).forEach(function (t) { try { e.dispatchEvent(new Event(t, { bubbles: true })); } catch (x) {} });
    return true;
  }
  function demo(art) {
    if (!window.__hbSperre) throw new Error('erst DPHB.sperre()');
    if (window._currentObjKey) throw new Error('ein Objekt ist geladen — Abbruch, nichts wird angefasst');
    _art = art;
    try { window._newObjLeeren && window._newObjLeeren(); } catch (e) {}
    var R = window.DealPilotObjektReiter; try { R && R.zielSetzen && R.zielSetzen(3); } catch (e) {}
    var cb = $('oe-details-cb'); if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    var w = Object.assign({}, GEMEINSAM, BEISPIEL[art] || {});
    setze('objart', w.objart);
    var n = 0; Object.keys(w).forEach(function (k) { if (k !== 'objart' && w[k] !== '' && setze(k, w[k])) n++; });
    /* aufklappbare Bereiche mit Feldern oeffnen (z. B. „Vertragsdaten der Bank“) - sonst stehen sie nicht im Bild */
    ['s0', 's1', 's2', 's3', 's4', 's3-tax'].forEach(function (sec) { var S = $(sec); if (S) S.querySelectorAll('details').forEach(function (d) { if (!d.open && d.querySelector('.f input[id], .f select[id]')) d.open = true; }); });
    if (art === 'MFH') window._dpMfh = { einheiten: JSON.parse(JSON.stringify(MFH_EINHEITEN)), gebaeude: {} };
    try { window.calc && window.calc(); } catch (e) {}
    ERG.arten[art] = ERG.arten[art] || { beispiel: w, reiter: {} };
    return art + ': ' + n + ' Felder gesetzt';
  }

  /* ── Rahmen ── */
  function scroller(e) {
    var p = e.parentElement;
    while (p && p !== document.body) { var s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 4) return p; p = p.parentElement; }
    return document.scrollingElement;
  }
  function obenFrei() {
    var b = 0;
    document.querySelectorAll('header.hdr, nav.tabs, .obj-action-bar, #obj-action-bar').forEach(function (x) {
      var s = getComputedStyle(x), r = x.getBoundingClientRect();
      if ((s.position === 'sticky' || s.position === 'fixed') && r.height > 0 && r.top < 200) b = Math.max(b, r.bottom);
    });
    return b || 0;
  }
  function sichtbar(f) { if (!f.offsetParent) return false; var d = f.closest('details'); if (d && !d.open) return false; var r = f.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(f).visibility !== 'hidden'; }
  function feldVon(f) { return f.querySelector('input:not([type=hidden])[id], select[id], textarea[id]'); }
  function block(f, sec) {
    var k = f, b = f; while (k && k !== sec) { if (k.classList && (k.classList.contains('col2') || k.classList.contains('card'))) b = k; k = k.parentElement; }
    return b;
  }
  /* rahmen(sec, modus)
     modus leer    alle sichtbaren Felder, Nummern ab 1             → hb-<art>-<sec>-N.webp
     modus 'extra' nur Felder, die erst nach DPHB.auswahl() da sind,
                   Nummern laufen hinter den Grundfeldern weiter     → hb-<art>-<sec>-xN.webp
     modus 'mobil' Grund- und Zusatzfelder bei schmalem Fenster,
                   dieselben Nummern wie auf dem Desktop             → hb-<art>-<sec>-mN.webp */
  function rahmen(sec, modus) {
    var tab = document.querySelector('[data-target-sec="' + sec + '"]'); if (tab) tab.click();
    var s = $(sec), A = ERG.arten[_art], R0 = A.reiter[sec];
    var fs = [].slice.call(s.querySelectorAll('.f')).filter(function (f) { var e = feldVon(f); return e && sichtbar(f); });
    var ids = [], kaesten = [], gesehen = {};
    fs.forEach(function (f) { var e = feldVon(f); if (gesehen[e.id]) return; gesehen[e.id] = 1; ids.push(e.id); kaesten.push(f); });
    var nummer = {}, behalte = function () { return true; }, bek = {};
    if (modus === 'extra') {
      var basis = {}; R0.sichtbar.forEach(function (id) { basis[id] = 1; });
      behalte = function (id) { return !basis[id]; };
    } else if (modus === 'mobil') {
      bek = Object.assign({}, R0.nummer, (R0.extra && R0.extra.nummer) || {});
      behalte = function (id) { return !!bek[id]; };
    }
    var k2 = [], i2 = [];
    ids.forEach(function (id, i) { if (behalte(id)) { i2.push(id); k2.push(kaesten[i]); } });
    ids = i2; kaesten = k2;
    if (modus === 'extra') ids.forEach(function (id, i) { nummer[id] = R0.sichtbar.length + i + 1; });
    else if (modus === 'mobil') ids.forEach(function (id) { nummer[id] = bek[id]; });
    else ids.forEach(function (id, i) { nummer[id] = i + 1; });
    var sc = scroller(s), top0 = sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top;
    var y = function (el) { return el.getBoundingClientRect().top - top0 + sc.scrollTop; };
    var maxH = innerHeight - Math.max(obenFrei(), 60) - 40;
    var bilder = [], akt = null;
    /* Ein Bild nimmt Felder in DOM-Reihenfolge auf, solange alles in eine
       Bildschirmhoehe passt und kein Feld OBERHALB des Bildanfangs liegt
       (rechte Spalte einer geteilten Zweierreihe → neues Bild). */
    kaesten.forEach(function (f, i) {
      var b = block(f, s), by = y(b), fy = y(f), fb = fy + f.getBoundingClientRect().height;
      if (akt && fy >= akt.oben && Math.max(akt.unten, fb) - akt.oben <= maxH) { akt.ids.push(ids[i]); akt.unten = Math.max(akt.unten, fb); return; }
      akt = { ids: [ids[i]], oben: (fy - by < 260) ? by : fy - 12, unten: fb };
      bilder.push(akt);
    });
    var kz = modus === 'extra' ? 'x' : (modus === 'mobil' ? 'm' : '');
    var dateien = bilder.map(function (x, i) { return 'hb-' + _art.toLowerCase() + '-' + sec + '-' + kz + (i + 1) + '.webp'; });
    var schl = sec + (modus ? '#' + modus : '');
    _rahmen[schl] = { sec: sec, ids: ids, nummer: nummer, dateien: dateien, bilder: bilder.map(function (x) { return { ids: x.ids, oben: x.oben, unten: x.unten }; }) };
    var liste = bilder.map(function (x, i) { return { datei: dateien[i], felder: x.ids }; });
    if (modus === 'extra') R0.extra = { felder: ids, nummer: nummer, bilder: liste };
    else if (modus === 'mobil') R0.mobil = { bilder: liste };
    else A.reiter[sec] = { sichtbar: ids, nummer: nummer, bilder: liste };
    return schl + ': ' + ids.length + ' Felder in ' + bilder.length + ' Bildern';
  }

  var _ov = null;
  function weg() { if (_ov && _ov.parentNode) _ov.parentNode.removeChild(_ov); _ov = null; }
  function zeige(schl, i, fw) {
    weg();
    var r = _rahmen[schl], b = r && r.bilder[i]; if (!b) return null;
    var s = $(r.sec), sc = scroller(s), frei = Math.max(obenFrei(), 0);
    var top0 = sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top;
    /* Lage NEU messen: zwischen rahmen() und zeige() verschiebt nachgeladener Inhalt die Karten */
    var yy = function (el) { return el.getBoundingClientRect().top - top0 + sc.scrollTop; };
    var fs0 = b.ids.map(function (id) { return $(id).closest('.f'); }), blk = block(fs0[0], s);
    b.oben = (yy(fs0[0]) - yy(blk) < 260) ? yy(blk) : yy(fs0[0]) - 12;
    b.unten = Math.max.apply(null, fs0.map(function (f) { return yy(f) + f.getBoundingClientRect().height; }));
    /* sofort, nicht weich: sonst misst getBoundingClientRect mitten im Scrollen */
    sc.scrollTo({ top: Math.max(0, b.oben - (frei - top0) - 14), behavior: 'instant' });
    var ov = document.createElement('div'); ov.id = 'dphb-marken';
    ov.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483000';
    var lo = Infinity, hi = -Infinity, li = Infinity, re = -Infinity;
    var schmal = innerWidth < 700, punkte = [];
    b.ids.forEach(function (id) {
      var f = $(id) && $(id).closest('.f'); if (!f) return;
      var q = f.getBoundingClientRect();
      lo = Math.min(lo, q.top); hi = Math.max(hi, q.bottom); li = Math.min(li, q.left); re = Math.max(re, q.right);
      var k = document.createElement('div');
      k.style.cssText = 'position:fixed;left:' + (q.left - 4) + 'px;top:' + (q.top - 4) + 'px;width:' + (q.width + 8) + 'px;height:' + (q.height + 8) + 'px;border:2.5px solid var(--wl-c9a84c, #C9A84C);border-radius:10px;box-shadow:0 0 0 3px rgba(5,5,5,.18)';
      var n = document.createElement('div');
      n.textContent = r.nummer[id];
      /* schmal: die Marke sitzt INNEN am rechten Rand - links waere sie abgeschnitten */
      n.style.cssText = 'position:fixed;left:' + (schmal ? q.right - 34 : q.left - 22) + 'px;top:' + (q.top - 12) + 'px;min-width:24px;height:24px;padding:0 5px;box-sizing:border-box;border-radius:12px;background:#050505;color:var(--wl-e8cc7a, #E8CC7A);border:2px solid var(--wl-c9a84c, #C9A84C);font:700 12px/20px "JetBrains Mono",monospace;text-align:center';
      ov.appendChild(k); ov.appendChild(n);
      /* Mittelpunkt der Nummernmarke - die Seite legt dort eine klickbare Flaeche ueber das Bild */
      punkte.push({ id: id, x: (schmal ? q.right - 34 : q.left - 22) + 12, y: q.top });
    });
    document.body.appendChild(ov); _ov = ov;
    var sr = s.getBoundingClientRect();
    var x0 = Math.max(0, Math.min(sr.left, li) - 20), x1 = Math.min(innerWidth, Math.max(sr.right, re) + 20);
    /* Bildanfang = Rahmenanfang (bei Kartenbeginn mit Kartentitel) */
    var y0 = Math.max(frei + 2, Math.min(lo - 22, b.oben - sc.scrollTop + top0 - 8)), y1 = Math.min(innerHeight, hi + 22);
    var f = (fw || innerWidth) / innerWidth;
    var marken = punkte.map(function (m) { return m.id + ":" + ((m.x - x0) / (x1 - x0)).toFixed(4) + ":" + ((m.y - y0) / (y1 - y0)).toFixed(4); }).join(";");
    (ERG.marken = ERG.marken || {})[r.dateien[i]] = marken;
    return { marken: marken, css: [x0, y0, x1, y1].map(Math.round), rahmen: [x0 * f, y0 * f, x1 * f, y1 * f].map(Math.round), datei: r.dateien[i], felder: b.ids.length };
  }

  /* ── Auswahl: was die Zusatzfelder einblendet ──
     Gesetzt wird nur, was im Formular selbst liegt - nie etwas, das Marcels
     Daten zeigt (Halter/Mandant kommt aus seinen Mandanten: bleibt leer). */
  var AUSWAHL = [
    ['haken', 'mand_ueberf_cb'], ['haken', 'erbpacht'], ['haken', 'inv_detail_toggle'],
    ['haken', 'd1_anschl_enable'], ['wert', 'd1_type', 'tilgungsaussetzung'], ['haken', 'd2_enable'], ['haken', 'd2_anschl_enable'],
    ['haken', 'afa_sonder7b_aktiv'], ['ruf', 'switchBwkMode', 'percent']
  ];
  function auswahl() {
    var n = [];
    AUSWAHL.forEach(function (a) {
      try {
        if (a[0] === 'ruf') { if (typeof window[a[1]] === 'function') { window[a[1]](a[2]); n.push(a[1]); } return; }
        var e = $(a[1]); if (!e) return;
        if (a[0] === 'haken') { if (!e.checked) { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); e.dispatchEvent(new Event('input', { bubbles: true })); } }
        else { e.value = a[2]; e.dispatchEvent(new Event('change', { bubbles: true })); }
        n.push(a[1]);
      } catch (x) {}
    });
    try { window.calc && window.calc(); } catch (x) {}
    return n.join(',');
  }
  /* Kurzliste fuer tools/handbuch-bilder.mjs; die PNG-Nummer (?) setzt der Aufrufer ein.
     einbettung = "x,y,massstab|rx0,ry0,rx1,ry1": Lage des schmalen iframes im Fenster
     und der Bildschirmfoto-Ausschnitt in Fenster-CSS-Pixeln (nur fuer -mN-Bilder). */
  function komp(art, einbettung) {
    var A = ERG.arten[art], out = [];
    Object.keys(A.reiter).forEach(function (sec) {
      var R = A.reiter[sec];
      out.push(sec + '|' + R.sichtbar.join(',') + '|' + R.bilder.map(function (b) { return b.felder.length; }).join(','));
      if (R.extra && R.extra.felder.length) out.push('E|' + sec + '|' + R.extra.felder.join(',') + '|' + R.extra.bilder.map(function (b) { return b.felder.length; }).join(','));
      if (R.mobil) R.mobil.bilder.forEach(function (b) { out.push('M|' + sec + '|' + b.datei + '|' + b.felder.join(',')); });
    });
    Object.keys(ERG.css || {}).filter(function (d) { return d.indexOf('hb-' + art.toLowerCase() + '-') === 0; }).forEach(function (d) {
      out.push('C|' + d + '|' + ERG.css[d].join(',') + '|?' + (einbettung && /-m\d+\.webp$/.test(d) ? '|' + einbettung : ''));
    });
    return out.join('\n');
  }

  /* ── Wohnungsliste (MFH): Konfigurator und eine Wohnung ── */
  function wohnungsliste(schritt) {
    if (!window.DpMfhEinheiten) return 'kein Konfigurator';
    weg(); window.DpMfhEinheiten.oeffnen(schritt == null ? 1 : schritt);
    return 'offen';
  }
  function ergebnis() { return JSON.stringify(ERG); }
  function bildEintrag(art, sec, datei, felder) {
    var R = ERG.arten[art].reiter[sec] = ERG.arten[art].reiter[sec] || { sichtbar: [], nummer: {}, bilder: [] };
    R.bilder.push({ datei: datei, felder: felder || [] });
  }

  function wohnungBild(datei, unterschrift) { var A = ERG.arten.MFH = ERG.arten.MFH || { reiter: {} }; (A.wohnungen = A.wohnungen || []).push({ datei: datei, unterschrift: unterschrift || '' }); return datei; }
  /* Ein Bild: Reiter oeffnen (die App scrollt danach verzoegert nach oben - abwarten), dann zeigen */
  function bild(schl, i, fw) {
    var sec = (_rahmen[schl] && _rahmen[schl].sec) || schl, S = $(sec);
    var warte = S.classList.contains('active') ? 0 : 2500;
    if (warte) document.querySelector('[data-target-sec="' + sec + '"]').click();
    return new Promise(function (ok) { setTimeout(function () { var r = zeige(schl, i, fw); setTimeout(function () { (ERG.css = ERG.css || {})[r.datei] = r.css; ok(r); }, 200); }, warte); });
  }
  var beispiel = {}; Object.keys(BEISPIEL).forEach(function (a) { beispiel[a] = Object.assign({}, GEMEINSAM, BEISPIEL[a]); });
  window.DPHB = { auswahl: auswahl, komp: komp, beispiel: beispiel, bild: bild, wohnungBild: wohnungBild, sperre: sperre, demo: demo, rahmen: rahmen, zeige: zeige, weg: weg, wohnungsliste: wohnungsliste, ergebnis: ergebnis, bildEintrag: bildEintrag, log: LOG, _rahmen: _rahmen, ERG: ERG };
})();
