'use strict';
/* ═══ js/vivi-felder.js — v3950 · VERKNUEPFTE FELDER: AUSGEGRAUT, HINWEIS, LOKAL UEBERSCHREIBEN ══════
 *
 * Marcel 22.11.2026: „Verknüpfte Felder sind ausgegraut. Beim Darüberfahren erscheint ein Hinweis:
 * verknüpft mit ViVi, Änderungen bitte in ViVi. Händisch anpassen geht, wird aber nicht nach ViVi
 * geschrieben.“
 *
 * Dieses Modul spricht NICHT mit dem Backend. js/vivi.js holt die Werte (GET /vivi/objekt/:id/werte) und
 * reicht sie an setzen(). Hier passiert nur:
 *   · der ViVi-Wert kommt ins Feld (ausser der Kunde hat ihn lokal ueberschrieben), danach wird wie immer
 *     gespeichert (saveObj). Ein zweiter Schreibweg in objects.data entsteht nicht.
 *   · das Feld wird gesperrt: readOnly, Klasse vivi-verknuepft, EIGENES Merkattribut data-vivi-ro (nicht
 *     data-mff-ro aus mfh-felder.js: wo beide sperren, hoebe sonst die eine Schicht die andere auf), title
 *     mit dem Hinweis, Selects mit pointer-events:none und tabindex -1.
 *   · ein Schloss am Feld loest es: der Wert gilt dann als eigene Angabe (_vivi.eigen), wird nie nach ViVi
 *     geschrieben, und der Hinweis nennt den ViVi-Wert daneben. Ein zweiter Klick nimmt den ViVi-Wert zurueck.
 *   · MFH: die Zellen der Einheitentabelle (#mfh-modal, data-i/data-k) und das Wohnungsfenster (#mfh-we-ov,
 *     data-i, data-wk) werden nach jedem Zeichnen neu gesperrt.
 *
 * Gespeichert im Objekt: _vivi (storage.js FIELDS, versteckt) = { verknuepft, stand, felder: {id: wert},
 * eigen: {id: wert} }. Massgeblich bleibt vivi_werte im Backend, _vivi ist der Spiegel fuer die Anzeige.
 * v3951 (Paket V5) dazu: herkunft: {id: {quelle, am}} (woher eine eigene Angabe kam, z. B. „Wirtschaftsplan 2026“) und
 * entscheidungen: {id: {wahl, dok, dok_wert, vivi_wert, am}} (Unterlagen-Abgleich, damit nicht jedes Mal gefragt wird).
 * ═════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DpViviFelder) return;
  var HINWEIS = 'Verknüpft mit ViVi, der Wert kommt aus ViVi, Änderungen bitte in ViVi.';
  var HINWEIS_LOESEN = 'Ein Klick ins Feld gibt den Wert frei. Er wird dann nicht nach ViVi übertragen.';
  var FRAGE_LOESEN = 'Diesen Wert in DealPilot selbst festlegen? Er wird nicht nach ViVi übertragen.';
  var FRAGE_ZURUECK = 'Den Wert aus ViVi wieder übernehmen?';
  /* Felder einer Einheit, die ViVi fuehrt (Schluessel wie in _mfh.einheiten[]) */
  var EINHEIT_FELDER = ['wfl', 'ist', 'status', 'nk_vorauszahlung', 'mv_beginn', 'mv_befristet_bis', 'mv_kaution', 'mv_letzte_erhoehung', 'mv_letzte_erhoehung_betrag' /* v3981 · F8 */, 'mv_art', 'stellplatz_miete'];
  var ZAHL_FELDER = /^(kp|makler_p|gest_p|notar_p|gba_p|ji_p|wfl|nkm|nk_vorauszahlung|ze_stp_monat|mv_kaution|mv_letzte_erhoehung_betrag|d[12]|d[12]z|d[12]t|ist|stellplatz_miete)$/;

  var SCHLOSS_ZU = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  var SCHLOSS_OFFEN = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/></svg>';
  var _stand = null;       // letzte Antwort von /werte
  var _aktiv = false;

  function $(id) { return document.getElementById(id); }
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim().replace(/\s|€|%/g, '');
    if (!s) return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  function alsText(feld, wert) {
    if (wert == null) return '';
    if (typeof wert === 'number') return Number.isInteger(wert) ? String(wert) : String(wert).replace('.', ',');
    return String(wert);
  }
  /* v4043a · Einheit (€, %, m²) aus dem Vor-/Nachsatz des Feldes, damit „ViVi: 620“ nicht nackt dasteht */
  function einheitAm(el) {
    try {
      var iw = el && el.closest ? el.closest('.iw') : null;
      var e = iw && iw.querySelector('.pfx, .sfx, .unit');
      var t = e ? String(e.textContent || '').trim() : '';
      return t && t.length <= 6 ? ' ' + t : '';
    } catch (x) { return ''; }
  }
  function gleich(feld, a, b) {
    var k = feld.split('.').pop();
    if (ZAHL_FELDER.test(k)) { var x = zahl(a), y = zahl(b); return x === y || (x != null && y != null && Math.abs(x - y) < 0.005); }
    return String(a == null ? '' : a).trim() === String(b == null ? '' : b).trim();
  }
  function standText(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d.getTime())) return '';
    var z = function (n) { return ('0' + n).slice(-2); };
    return 'Stand ' + z(d.getDate()) + '.' + z(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }

  /* ── _vivi im Objekt ─────────────────────────────────────────────── */
  function lesen() {
    var e = $('_vivi'); var v = null;
    try { v = e && e.value ? JSON.parse(e.value) : null; } catch (x) { v = null; }
    if (!v || typeof v !== 'object') v = {};
    if (!v.eigen || typeof v.eigen !== 'object') v.eigen = {};
    if (!v.felder || typeof v.felder !== 'object') v.felder = {};
    return v;
  }
  function schreiben(v) { var e = $('_vivi'); if (e) e.value = v && v.verknuepft ? JSON.stringify(v) : ''; }

  /* ── Sperre an einem Element ─────────────────────────────────────── */
  function sperreAn(el, feld, viviWert, eigen, stand) {
    if (!el) return;
    var istEigen = eigen && Object.prototype.hasOwnProperty.call(eigen, feld);
    if (istEigen) { sperreAus(el); el.classList.add('vivi-eigen'); }
    else {
      if (!el.hasAttribute('data-vivi-ro')) el.setAttribute('data-vivi-ro', el.readOnly ? '1' : '0');
      if (el.tagName === 'SELECT') { el.setAttribute('tabindex', '-1'); }
      else el.readOnly = true;
      el.classList.add('vivi-verknuepft');
      el.classList.remove('vivi-eigen');
      el.setAttribute('aria-readonly', 'true');
    }
    el.title = istEigen
      ? 'Eigene Angabe in DealPilot. ViVi führt ' + (alsText(feld, viviWert) || 'keinen Wert') + '. Dieser Wert wird nicht nach ViVi übertragen. Klick ins Feld, um den ViVi-Wert wieder zu übernehmen.'
      : HINWEIS + '\n' + HINWEIS_LOESEN + (stand ? '\n' + stand : '');
    schloss(el, feld, istEigen, viviWert);
  }
  function sperreAus(el) {
    if (!el) return;
    if (el.classList.contains('vivi-verknuepft')) {
      el.classList.remove('vivi-verknuepft');
      el.removeAttribute('aria-readonly');
      if (el.tagName === 'SELECT') el.removeAttribute('tabindex');
      else el.readOnly = el.getAttribute('data-vivi-ro') === '1';
      el.removeAttribute('data-vivi-ro');
    }
    el.classList.remove('vivi-eigen');
    if (/^(Verknüpft mit ViVi|Eigene Angabe in DealPilot)/.test(el.title || '')) el.title = '';
  }
  /* v4043 · Marcel 23.11.2026: „ich will eigentlich nicht, dass überall so ein Schloss ist … aufs Feld klickt und das
     dann freigeben kann … nicht extra Schlösser daneben mit Buttons. Das verschiebt alles.“ Kein Knopf mehr im Fluss:
     das Feld merkt sich nur seinen Schluessel (data-vivi-feld), der Klick aufs Feld oeffnet eine schwebende Rueckfrage. */
  function schloss(el, feld) {
    schlossWeg(el);
    el.setAttribute('data-vivi-feld', feld);
  }
  function schlossWeg(el) {
    var p = el && el.parentNode; if (!p) return;
    Array.prototype.forEach.call(p.querySelectorAll('.vivi-schloss'), function (b) { b.remove(); });
  }

  /* Eingaben in gesperrte Felder abfangen: andere Schichten (mfh-felder.js) setzen readOnly beim Loesen auf
     ihren eigenen Merker zurueck. Die Klasse bleibt, also haelt dieser Riegel. */
  ['beforeinput', 'paste', 'drop'].forEach(function (t) {
    document.addEventListener(t, function (ev) {
      var el = ev.target;
      if (el && el.classList && el.classList.contains('vivi-verknuepft')) { ev.preventDefault(); ev.stopPropagation(); }
    }, true);
  });
  document.addEventListener('keydown', function (ev) {
    var el = ev.target;
    if (!(el && el.classList && el.classList.contains('vivi-verknuepft'))) return;
    if (ev.key && (ev.key.length === 1 || ev.key === 'Backspace' || ev.key === 'Delete')) { ev.preventDefault(); ev.stopPropagation(); }
  }, true);

  /* ── Werte setzen ────────────────────────────────────────────────── */
  function feldSetzen(id, wert) {
    var el = $(id); if (!el) return false;
    var t = alsText(id, wert);
    if (gleich(id, el.value, t)) return false;
    el.value = t;
    try { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); } catch (e) {}
    return true;
  }
  /* Index einer Einheit in _dpMfh: der beim Anlegen gemerkte, gegengeprueft ueber die Nummer */
  function einheitIndex(i, info) {
    var L = window._dpMfh && Array.isArray(window._dpMfh.einheiten) ? window._dpMfh.einheiten : null;
    if (!L) return null;
    var soll = info && info.einheiten && info.einheiten[i] && info.einheiten[i].nr;
    if (soll == null) return L[i] ? i : null;
    if (L[i] && String(L[i].nr || (i + 1)) === String(soll)) return i;
    for (var k = 0; k < L.length; k++) if (String(L[k].nr || (k + 1)) === String(soll)) return k;
    return null;
  }
  function einheitenSummen() {
    var L = window._dpMfh && Array.isArray(window._dpMfh.einheiten) ? window._dpMfh.einheiten : [];
    if (!L.length) return false;
    var fl = 0, ohne = 0, ist = 0;
    L.forEach(function (e) { var f = zahl(e.wfl); if (f > 0) fl += f; else ohne++; if (e.status !== 'leer') ist += zahl(e.ist) || 0; });
    var g = false;
    if (fl > 0 && !ohne) g = feldSetzen('wfl', Math.round(fl * 100) / 100) || g;
    if (ist > 0) g = feldSetzen('nkm', Math.round(ist * 100) / 100) || g;
    return g;
  }

  /**
   * stand = Antwort von GET /vivi/objekt/:id/werte. Setzt die Werte, sperrt die Felder, schreibt _vivi.
   * Gibt true zurueck, wenn sich am Objekt etwas geaendert hat (dann speichert js/vivi.js).
   */
  function setzen(stand) {
    _stand = stand || null;
    var v = lesen();
    if (!stand || !stand.verknuepft) { allesLoesen(true); return false; }
    _aktiv = true;
    var felder = stand.felder || {}, info = stand.info || {};
    var st = standText(stand.letzter_abruf);
    var geaendert = false, einheitGeaendert = false;
    v.verknuepft = true; v.stand = stand.letzter_abruf || null; v.felder = {};
    /* v3998a · ViVi kennt den Betrag einer Erhoehung nur aus dem Mietverlauf. Fehlt er (leer) und ist das Datum dasselbe
       wie schon im Objekt (z. B. von DealPilot beim Anlegen geschickt), bleibt der Betrag aus DealPilot stehen. Nur ein
       NEUES Datum ohne Betrag leert ihn (F8: nie der alte Betrag zum neuen Datum). */
    var vorDatum = function (id) {
      var m0 = /^einheit\.(\d+)\.mv_letzte_erhoehung_betrag$/.exec(id);
      if (m0) { var i0 = einheitIndex(+m0[1], info), L0 = window._dpMfh && window._dpMfh.einheiten; return i0 != null && L0 && L0[i0] ? L0[i0].mv_letzte_erhoehung : null; }
      if (id === 'mv_letzte_erhoehung_betrag') { var e0 = $('mv_letzte_erhoehung'); return e0 ? e0.value : null; }
      return null;
    };
    var behalten = {};
    Object.keys(felder).forEach(function (id) {
      if (!/mv_letzte_erhoehung_betrag$/.test(id) || !(felder[id] && felder[id].wert === '')) return;
      var dId = id.replace(/_betrag$/, ''), dNeu = felder[dId] && felder[dId].wert, dAlt = vorDatum(id);
      if (dNeu && dAlt && isoTag(dAlt) === isoTag(dNeu)) behalten[id] = true;
    });
    Object.keys(felder).forEach(function (id) {
      if (behalten[id]) return;
      var w = felder[id] && felder[id].wert;
      v.felder[id] = w;
      var eigen = Object.prototype.hasOwnProperty.call(v.eigen, id);
      var m = /^einheit\.(\d+)\.(\w+)$/.exec(id);
      if (m) {
        if (eigen) return;
        var idx = einheitIndex(+m[1], info);
        var L = window._dpMfh && window._dpMfh.einheiten;
        if (idx == null || !L || !L[idx]) return;
        var t = alsText(m[2], w);
        if (!gleich(m[2], L[idx][m[2]], t)) { L[idx][m[2]] = t; einheitGeaendert = true; }
        return;
      }
      if (!eigen && feldSetzen(id, w)) geaendert = true;
      sperreAn($(id), id, w, v.eigen, st);
    });
    if (einheitGeaendert) { geaendert = true; einheitenSummen(); }
    if (erhoehungenUebernehmen(info)) geaendert = true;   /* v3998 */
    if (geplantUebernehmen(info)) geaendert = true;   /* v4037 */
    if (istJahreUebernehmen(info)) geaendert = true;   /* v4037 */
    /* Felder, die ViVi nicht mehr fuehrt, werden frei */
    Array.prototype.forEach.call(document.querySelectorAll('.vivi-verknuepft, .vivi-eigen'), function (el) {
      if (el.id && !Object.prototype.hasOwnProperty.call(felder, el.id) && !el.hasAttribute('data-vivi-zelle')) { sperreAus(el); schlossWeg(el); }
    });
    schreiben(v);
    if (geaendert) { try { if (typeof window.calc === 'function') window.calc(); } catch (e) {} try { if (window.DpMfhFelder) window.DpMfhFelder.anwenden(); } catch (e) {} }
    einheitenSperren();
    return geaendert;
  }

  /* v3998 · Mietverlauf aus ViVi in die Liste der Mieterhoehungen (js/mieterhoehungen.js): Objekt _erhoehungen, Wohnung
     e.erhoehungen. Eintraege aus ViVi (id vivi-…) werden ersetzt, eigene bleiben. Steht am selben Tag schon ein eigener
     Eintrag, gilt der eigene (keine Doppelung). Gibt true zurueck, wenn sich etwas geaendert hat. */
  function erhoehungenMischen(alt, neu) {
    alt = Array.isArray(alt) ? alt : [];
    var eigene = alt.filter(function (x) { return x && !/^vivi-/.test(String(x.id || '')); });
    var tage = {}; eigene.forEach(function (x) { if (x.datum) tage[x.datum] = true; });
    var dazu = (neu || []).filter(function (x) { return x && x.datum && !tage[x.datum]; })
      .map(function (x) { return { id: x.id, datum: x.datum, art: x.art, von: x.von, auf: x.auf, beleg: x.beleg || 'aus ViVi', am: x.am || null }; });
    var erg = eigene.concat(dazu).sort(function (a, b) { return a.datum < b.datum ? -1 : (a.datum > b.datum ? 1 : 0); });
    var kern = function (l) { return JSON.stringify(l.map(function (x) { return [x.id, x.datum, x.art, x.von, x.auf]; })); };
    return kern(erg) === kern(alt) ? null : erg;
  }
  /* v4037 · geplante Erhöhungen aus ViVi: die Liste ersetzt sich ganz (sie gehört ViVi, keine eigenen Einträge darin) */
  function geplantUebernehmen(info) {
    var E = (info && info.erhoehungen_geplant) || {}, g = false;
    var d = window._currentObjData; if (!d) return false;
    var neuO = E.objekt || [];
    if (JSON.stringify(d._erhoehungen_geplant || []) !== JSON.stringify(neuO)) { if (neuO.length) d._erhoehungen_geplant = neuO; else delete d._erhoehungen_geplant; g = true; }
    var L = window._dpMfh && window._dpMfh.einheiten;
    if (Array.isArray(L)) L.forEach(function (e, idx) {
      var k = Object.keys(E).filter(function (x) { return x !== 'objekt' && einheitIndex(+x, info) === idx; })[0];
      var neu = k != null ? E[k] : [];
      if (JSON.stringify(e.erhoehungen_geplant || []) !== JSON.stringify(neu)) { if (neu.length) e.erhoehungen_geplant = neu; else delete e.erhoehungen_geplant; g = true; }
    });
    return g;
  }
  /* v4037 · Ist-Kaltmiete je vergangenem Jahr laut ViVi-Mietverlauf ins Jahresbuch (nkm_j_vivi). Eigene Angaben
     bleiben und gewinnen, festgeschriebene Jahre bleiben unberührt (DpJahresbuch.viviIstSetzen). */
  function istJahreUebernehmen(info) {
    var ij = info && info.ist_jahre; if (!ij || !ij.summe) return false;
    var JB = window.DpJahresbuch; if (!JB || !JB.viviIstSetzen) return false;
    /* Kaltmiete aus ViVi (ohne Stellplaetze) plus die Zusatzeinnahmen aus DealPilot je vermietetem Monat: ViVi kennt
       nicht alle Zusatzeinnahmen (gemessen 2026-1052: 90 € im Monat nur in DealPilot). Ohne kalt (aelterer Abruf) die
       Summe aus ViVi. */
    var zeF = $('ze'), ze = zeF ? zahl(zeF.value) : 0;
    if (ze == null || !isFinite(ze) || ze < 0) ze = 0;
    var werte = {};
    /* Eigene Mieterhoehungen (nicht aus ViVi) zeigen, dass ViVi die Zeit davor nicht kennt: ein von DealPilot angelegtes
       Objekt startet in ViVi mit der Miete vom Anlegen. Gemessen 2026-1052: eigene Erhoehungen zum 01.03.2025, ViVi
       rechnete 2025 zwoelf Monate mit der heutigen Miete. Bis einschliesslich des Jahres der juengsten eigenen Erhoehung
       gilt deshalb DealPilot (Mieterhoehungen), danach ViVi. */
    var eigenBis = 0, d0 = window._currentObjData || {};
    var nimm = function (l) { (Array.isArray(l) ? l : []).forEach(function (x) { if (x && x.datum && !/^vivi-/.test(String(x.id || ''))) eigenBis = Math.max(eigenBis, +String(x.datum).slice(0, 4) || 0); }); };
    nimm(d0._erhoehungen);
    if (window._dpMfh && Array.isArray(window._dpMfh.einheiten)) window._dpMfh.einheiten.forEach(function (e) { nimm(e && e.erhoehungen); });
    Object.keys(ij.summe).forEach(function (j) {
      if (+j <= eigenBis) { werte[j] = null; return; }
      var x = ij.summe[j] || {};
      var w = (typeof x.kalt === 'number') ? x.kalt + ze * (typeof x.monate_vermietet === 'number' ? x.monate_vermietet : (x.monate || 12)) : x.miete;
      if (typeof w === 'number' && isFinite(w)) werte[j] = { miete: Math.round(w * 100) / 100 };
    });
    try { return JB.viviIstSetzen(werte); } catch (e) { return false; }
  }
  function erhoehungenUebernehmen(info) {
    var E = info && info.erhoehungen; if (!E || typeof E !== 'object') return false;
    var v = lesen(), g = false;
    Object.keys(E).forEach(function (k) {
      if (k === 'objekt') {
        if (Object.prototype.hasOwnProperty.call(v.eigen, '_erhoehungen')) return;
        var d = window._currentObjData; if (!d) return;
        var m = erhoehungenMischen(d._erhoehungen, E[k]); if (m) { d._erhoehungen = m; g = true; }
      } else {
        if (Object.prototype.hasOwnProperty.call(v.eigen, 'einheit.' + k + '.erhoehungen')) return;
        var idx = einheitIndex(+k, info), L = window._dpMfh && window._dpMfh.einheiten;
        if (idx == null || !L || !L[idx]) return;
        var m2 = erhoehungenMischen(L[idx].erhoehungen, E[k]); if (m2) { L[idx].erhoehungen = m2; g = true; }
      }
    });
    if (g) { try { if (window.DpErhoehungen && window.DpErhoehungen.objektMount) window.DpErhoehungen.objektMount(); } catch (e) {} }
    return g;
  }

  /* datenLeeren: nur wenn das Backend sagt, das Objekt ist nicht (mehr) verknuepft. Beim Objektwechsel fallen nur
     die Sperren im Formular, _vivi des neu geladenen Objekts (mit seinen eigenen Angaben) bleibt. */
  function allesLoesen(datenLeeren) {
    _aktiv = false;
    Array.prototype.forEach.call(document.querySelectorAll('.vivi-verknuepft, .vivi-eigen'), function (el) { sperreAus(el); schlossWeg(el); el.removeAttribute('data-vivi-zelle'); });
    if (datenLeeren) { var v = lesen(); if (v.verknuepft) { schreiben({}); return true; } }
    return false;
  }

  /* ── MFH: Tabelle und Wohnungsfenster ────────────────────────────── */
  function einheitSchluessel(i, k) {
    if (!_stand || !_stand.felder) return null;
    var info = _stand.info || {};
    /* Rueckwaerts: welcher ViVi-Index gehoert zur Einheit i in _dpMfh? */
    var ids = Object.keys(_stand.felder).filter(function (id) { return /^einheit\.\d+\./.test(id) && id.split('.')[2] === k; });
    for (var n = 0; n < ids.length; n++) { var vi = +ids[n].split('.')[1]; if (einheitIndex(vi, info) === i) return ids[n]; }
    return null;
  }
  function zelleSperren(el, i, k, stand) {
    var id = einheitSchluessel(i, k); var v = lesen();
    if (!id) { if (el.hasAttribute('data-vivi-zelle')) { sperreAus(el); schlossWeg(el); el.removeAttribute('data-vivi-zelle'); } return; }
    el.setAttribute('data-vivi-zelle', id);
    sperreAn(el, id, _stand.felder[id] && _stand.felder[id].wert, v.eigen, stand);
  }
  function einheitenSperren() {
    if (!_aktiv) return;
    var st = standText(_stand && _stand.letzter_abruf);
    var modal = $('mfh-modal');
    if (modal) Array.prototype.forEach.call(modal.querySelectorAll('[data-i][data-k]'), function (el) {
      var k = el.getAttribute('data-k'); if (EINHEIT_FELDER.indexOf(k) < 0) return;
      zelleSperren(el, +el.getAttribute('data-i'), k, st);
    });
    var ov = $('mfh-we-ov');
    if (ov && ov.hasAttribute('data-i')) {
      var i = +ov.getAttribute('data-i');
      Array.prototype.forEach.call(ov.querySelectorAll('[data-wk]'), function (el) {
        var k = el.getAttribute('data-wk'); if (EINHEIT_FELDER.indexOf(k) < 0) return;
        zelleSperren(el, i, k, st);
      });
    }
  }
  var _mt = null;
  function spaeter() { clearTimeout(_mt); _mt = setTimeout(einheitenSperren, 60); }
  var _beob = new WeakSet();
  function beobachten(el) {
    if (!el || _beob.has(el)) return;
    _beob.add(el);
    try { new MutationObserver(spaeter).observe(el, { childList: true, subtree: true }); } catch (e) {}
    spaeter();
  }
  try {
    new MutationObserver(function () { beobachten($('mfh-modal')); beobachten($('mfh-we-ov')); })
      .observe(document.body || document.documentElement, { childList: true });
  } catch (e) {}

  /* ── Freigeben per Klick aufs Feld (v4043, ersetzt das Schloss) ──────
     Gesperrtes Feld: Klick → schwebende Rueckfrage „Wert aus ViVi. Hier ändern?“ Ja/Nein, position:fixed am Feld,
     also nichts im Fluss. Eigene Angabe: Klick → kleine Zeile „ViVi: 620 €, übernehmen“, verschwindet beim Tippen,
     beim Verlassen und beim naechsten Klick daneben. Kein nativer confirm. */
  var _pop = null;
  function popWeg() { if (_pop) { try { _pop.remove(); } catch (e) {} _pop = null; } }
  function feldId(el) { return el.getAttribute('data-vivi-zelle') || el.getAttribute('data-vivi-feld') || el.id; }
  function popZeigen(el, text, knoepfe) {
    popWeg();
    var r = el.getBoundingClientRect();
    var p = document.createElement('div');
    p.className = 'vivi-pop'; p.setAttribute('role', 'dialog');
    var t = document.createElement('span'); t.textContent = text; p.appendChild(t);
    knoepfe.forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'btn-clean vivi-pop-b' + (k.haupt ? ' vivi-pop-h' : '');
      b.textContent = k.text;
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); popWeg(); k.tun(); });
      p.appendChild(b);
    });
    document.body.appendChild(p);
    var w = p.offsetWidth, h = p.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var x = Math.max(8, Math.min(r.left, vw - w - 8));
    var y = r.bottom + 4; if (y + h > vh - 8) y = Math.max(8, r.top - h - 4);
    p.style.left = Math.round(x) + 'px'; p.style.top = Math.round(y) + 'px';
    _pop = p;
  }
  function freigeben(el) {
    var id = feldId(el), v = lesen();
    var viviWert = _stand && _stand.felder && _stand.felder[id] ? _stand.felder[id].wert : v.felder[id];
    v.eigen[id] = el.value;
    schreiben(v);
    sperreAn(el, id, viviWert, v.eigen, '');
    try { el.focus(); if (el.select && el.tagName === 'INPUT') el.select(); } catch (e) {}
    try { var h = $('_vivi'); if (h) h.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  function zurueck(el) {
    var id = feldId(el), v = lesen();
    var viviWert = _stand && _stand.felder && _stand.felder[id] ? _stand.felder[id].wert : v.felder[id];
    delete v.eigen[id];
    schreiben(v);
    if (!/^einheit\./.test(id)) feldSetzen(id, viviWert);
    else { el.value = alsText(id, viviWert); try { el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); } catch (e) {} }
    sperreAn(el, id, viviWert, v.eigen, standText(_stand && _stand.letzter_abruf));
    try { var h = $('_vivi'); if (h) h.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  /* Ein gesperrtes Select darf sich nicht oeffnen, soll den Klick aber bekommen (darum kein pointer-events:none mehr). */
  document.addEventListener('mousedown', function (ev) {
    var el = ev.target && ev.target.closest ? ev.target.closest('select.vivi-verknuepft') : null;
    if (el) ev.preventDefault();
  }, true);
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (_pop && t && t.closest && t.closest('.vivi-pop')) return;
    var el = t && t.closest ? t.closest('.vivi-verknuepft, .vivi-eigen') : null;
    if (!el || !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { popWeg(); return; }
    var id = feldId(el); if (!id) return;
    if (el.classList.contains('vivi-verknuepft')) {
      ev.preventDefault();
      popZeigen(el, 'Wert aus ViVi. Hier ändern?', [
        { text: 'Ja', haupt: true, tun: function () { freigeben(el); } },
        { text: 'Nein', tun: function () {} }
      ]);
      return;
    }
    var v = lesen();
    var viviWert = _stand && _stand.felder && _stand.felder[id] ? _stand.felder[id].wert : v.felder[id];
    if (_pop && _pop.getAttribute('data-fuer') === id) return;
    popZeigen(el, 'ViVi: ' + (alsText(id, viviWert) ? alsText(id, viviWert) + einheitAm(el) : 'leer'), [{ text: 'übernehmen', tun: function () { zurueck(el); } }]);
    if (_pop) _pop.setAttribute('data-fuer', id);
  }, true);
  document.addEventListener('keydown', function (ev) { if (_pop && (ev.key === 'Escape' || (ev.target && ev.target.classList && ev.target.classList.contains('vivi-eigen')))) popWeg(); }, true);
  window.addEventListener('scroll', popWeg, true);
  window.addEventListener('resize', popWeg);

  /* v3996 · Marcel 23.11.2026: „für jedes Feld, wo wir von ViVi was übernehmen, ein Schloss dran. Haben wir die
     Möglichkeit, das für alle Felder zu übernehmen?“ an = true: alle ViVi-Felder werden eigene Angaben mit dem Wert,
     der gerade im Feld steht (nichts wird überschrieben). an = false: alle eigenen Angaben fallen, ViVi gilt wieder. */
  function alleSelbst(an) {
    if (!_stand || !_stand.verknuepft) return false;
    var v = lesen(), felder = _stand.felder || {}, info = _stand.info || {};
    if (an) {
      Object.keys(felder).forEach(function (id) {
        if (Object.prototype.hasOwnProperty.call(v.eigen, id)) return;
        var m = /^einheit\.(\d+)\.(\w+)$/.exec(id);
        if (m) {
          var idx = einheitIndex(+m[1], info), L = window._dpMfh && window._dpMfh.einheiten;
          v.eigen[id] = (idx != null && L && L[idx]) ? L[idx][m[2]] : felder[id].wert;
        } else { var el = $(id); v.eigen[id] = el ? el.value : felder[id].wert; }
      });
    } else v.eigen = {};
    schreiben(v);
    var g = setzen(_stand);
    try { var h = $('_vivi'); if (h) h.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    return g || true;
  }
  function anzahlEigen() {
    if (!_stand || !_stand.felder) return { alle: 0, eigen: 0 };
    var v = lesen(), ids = Object.keys(_stand.felder);
    return { alle: ids.length, eigen: ids.filter(function (id) { return Object.prototype.hasOwnProperty.call(v.eigen, id); }).length };
  }

  /* Eine eigene Angabe folgt der Eingabe (sonst stuende im Spiegel der Wert beim Loesen) */
  document.addEventListener('input', function (ev) {
    var el = ev.target; if (!el || !el.classList || !el.classList.contains('vivi-eigen')) return;
    var id = el.getAttribute('data-vivi-zelle') || el.id; if (!id) return;
    var v = lesen(); if (!Object.prototype.hasOwnProperty.call(v.eigen, id)) return;
    v.eigen[id] = el.value; schreiben(v);
  }, true);

  function stil() {
    if ($('vivi-felder-stil')) return;
    var s = document.createElement('style'); s.id = 'vivi-felder-stil';
    s.textContent = [
      'input.vivi-verknuepft,select.vivi-verknuepft,textarea.vivi-verknuepft{opacity:.62;cursor:pointer;background-image:none}',
      '.vivi-pop{position:fixed;z-index:100000;display:flex;align-items:center;gap:6px;max-width:min(320px,calc(100vw - 16px));padding:6px 8px;border-radius:8px;background:#fff;color:#2A2727;border:1px solid var(--wl-c9a84c, rgba(201,168,76,.45));box-shadow:0 6px 18px rgba(0,0,0,.14);font:500 12px/1.3 Inter,system-ui,sans-serif}',
      '.vivi-pop span{flex:1 1 auto}',
      '.vivi-pop .vivi-pop-b{flex:0 0 auto;border:1px solid rgba(42,39,39,.18);background:#fff;color:#2A2727;border-radius:6px;padding:4px 10px;font:600 12px/1.2 Inter,system-ui,sans-serif;cursor:pointer;min-height:28px}',
      '.vivi-pop .vivi-pop-h{background:var(--gold,#C9A84C);border-color:var(--gold,#C9A84C);color:#050505}',
      'input.vivi-eigen,select.vivi-eigen{box-shadow:inset 3px 0 0 var(--wl-c9a84c, #C9A84C)}'
    ].join('');
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stil); else stil();
  /* Objektwechsel: die Sperren des vorigen Objekts fallen, js/vivi.js setzt die neuen */
  window.addEventListener('dp:object-ready', function () { _stand = null; allesLoesen(false); });
  window.addEventListener('dp:detailgrad', function () { if (_stand) setzen(_stand); });

  /* ── v3951 · Paket V5: Abgleich mit Unterlagen ─────────────────────
     Marcel 22.11.2026: liest der Kunde eine Unterlage ein (Wirtschaftsplan, Protokoll, Mietvertrag …) und weicht ein
     verknuepftes Feld ab, zeigt die Pruefliste beide Werte und ist nie vorgehakt. „Wert aus der Unterlage nehmen“ ist
     ein lokales Festlegen wie das Schloss: der Wert gilt als eigene Angabe und geht NIE nach ViVi. */
  var HINWEIS_ABWEICHUNG = 'Weicht ab. Bitte in ViVi ändern, damit beide gleich sind.';
  function istVerknuepft(id) { var v = lesen(); return !!(_stand && _stand.verknuepft !== false && _stand.felder && _stand.felder[id]) && !Object.prototype.hasOwnProperty.call(v.eigen, id); }
  function viviWert(id) { return _stand && _stand.felder && _stand.felder[id] ? _stand.felder[id].wert : undefined; }
  function isoTag(s) {
    var t = String(s == null ? '' : s).trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return null;
  }
  /* gleich im Sinne des Abgleichs: Zahlen auf 0,5 Cent, Daten nach Tag, Text ohne Gross/Klein und Leerraum */
  function gleichDok(a, b) {
    var da = isoTag(a), db = isoTag(b);
    if (da && db) return da === db;
    var x = zahl(a), y = zahl(b);
    if (x != null && y != null && /^[\s\d.,%€+-]+$/.test(String(a)) && /^[\s\d.,%€+-]+$/.test(String(b))) return Math.abs(x - y) < 0.005;
    return String(a == null ? '' : a).trim().toLowerCase().replace(/\s+/g, ' ') === String(b == null ? '' : b).trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function anzeige(w) {
    if (w == null || w === '') return '';
    var d = isoTag(w); if (d) return d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4);
    if (typeof w === 'number') return w.toLocaleString('de-DE', { maximumFractionDigits: 3 });
    return String(w);
  }
  function entscheidung(id) { var v = lesen(); return v.entscheidungen && v.entscheidungen[id] ? v.entscheidungen[id] : null; }
  /**
   * Vergleicht einen Wert aus einer Unterlage mit dem ViVi-Wert des Feldes.
   * null = Feld nicht verknuepft (alles wie ohne ViVi). Sonst { wert, anzeige, gleich, entschieden }.
   * entschieden: dieselbe Unterlage mit demselben Wert wurde schon einmal mit „ViVi-Wert behalten“ beantwortet und
   * ViVi fuehrt noch denselben Wert. Dann fragt die Pruefliste nicht noch einmal.
   */
  function vergleich(id, dokWert) {
    if (!id || !istVerknuepft(id)) return null;
    var w = viviWert(id);
    var g = gleichDok(w, dokWert);
    var e = g ? null : entscheidung(id);
    var ent = e && e.wahl === 'vivi' && gleichDok(e.dok_wert, dokWert) && gleichDok(e.vivi_wert, w) ? e : null;
    return { id: id, wert: w, anzeige: anzeige(w), gleich: g, entschieden: ent };
  }
  /** Feld-ID in vivi_werte fuer die Zelle k der Einheit i in _dpMfh (z. B. einheit.2.ist), sonst null */
  function einheitFeld(i, k) { return einheitSchluessel(i, k); }
  /** Mietvertrag gegen die ViVi-Werte der Einheit i: Liste der abweichenden Felder { id, k, vivi, dok, anzeige } */
  function einheitVergleich(i, werte) {
    var aus = [];
    Object.keys(werte || {}).forEach(function (k) {
      var dw = werte[k]; if (dw == null || dw === '') return;
      var id = einheitFeld(i, k); if (!id) return;
      var c = vergleich(id, dw); if (!c || c.gleich || c.entschieden) return;
      aus.push({ id: id, k: k, vivi: c.wert, anzeige: c.anzeige, dok: dw });
    });
    return aus;
  }
  /**
   * „Wert aus der Unterlage nehmen“: das Feld wird lokal festgelegt (eigene Angabe), genau wie mit dem Schloss.
   * Schreibt nur _vivi im Objekt. Es gibt keinen Weg nach ViVi (dieses Modul spricht nicht mit dem Backend).
   */
  function lokalFestlegen(id, wert, herkunft) {
    var v = lesen(); if (!v.verknuepft) return false;
    v.eigen[id] = wert == null ? '' : String(wert);
    if (!v.herkunft || typeof v.herkunft !== 'object') v.herkunft = {};
    v.herkunft[id] = { quelle: String(herkunft || 'Unterlage').slice(0, 120), am: new Date().toISOString().slice(0, 10) };
    schreiben(v);
    if (/^einheit\./.test(id)) einheitenSperren();
    else { var el = $(id); if (el) sperreAn(el, id, viviWert(id), v.eigen, ''); }
    try { var h = $('_vivi'); if (h) h.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    return true;
  }
  /** Entscheidung merken (wahl 'vivi' oder 'unterlage'), damit dieselbe Unterlage nicht jedes Mal wieder fragt */
  function entscheiden(id, e) {
    var v = lesen(); if (!v.verknuepft || !id || !e) return false;
    if (!v.entscheidungen || typeof v.entscheidungen !== 'object') v.entscheidungen = {};
    v.entscheidungen[id] = { wahl: e.wahl === 'unterlage' ? 'unterlage' : 'vivi', dok: String(e.dok || '').slice(0, 120), dok_wert: e.dok_wert == null ? '' : String(e.dok_wert), vivi_wert: e.vivi_wert == null ? '' : e.vivi_wert, am: new Date().toISOString().slice(0, 10) };
    schreiben(v);
    return true;
  }

  /* v4040 · ViVi-Reiter der Pilot-Analyse: eine eigene Angabe verwerfen und den Wert aus ViVi wieder gelten lassen (ohne
     Rückfrage, der Reiter fragt selbst). Wendet den letzten Stand erneut an, auch für Einheiten. Rückgabe true = geändert. */
  function viviUebernehmen(id) {
    var v = lesen();
    if (!_stand || !v.verknuepft || !Object.prototype.hasOwnProperty.call(v.eigen || {}, id)) return false;
    delete v.eigen[id];
    schreiben(v);
    setzen(_stand);
    try { var h = $('_vivi'); if (h) h.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
    return true;
  }
  function stand() { return _stand; }
  window.DpViviFelder = { setzen: setzen, allesLoesen: allesLoesen, alleSelbst: alleSelbst, anzahlEigen: anzahlEigen, erhoehungenMischen: erhoehungenMischen, einheitenSperren: einheitenSperren, lesen: lesen, HINWEIS: HINWEIS, EINHEIT_FELDER: EINHEIT_FELDER,
    /* fuer den Unterlagen-Abgleich (Paket V5): ist ein Feld verknuepft, und welchen Wert fuehrt ViVi? */
    istVerknuepft: istVerknuepft, viviWert: viviWert,
    HINWEIS_ABWEICHUNG: HINWEIS_ABWEICHUNG, vergleich: vergleich, einheitFeld: einheitFeld, einheitVergleich: einheitVergleich,
    lokalFestlegen: lokalFestlegen, entscheiden: entscheiden, entscheidung: entscheidung, gleichDok: gleichDok,
    viviUebernehmen: viviUebernehmen, stand: stand   /* v4040 */
  };
})();
