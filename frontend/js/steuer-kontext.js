/* steuer-kontext.js · v3700 — Rechenkontext der Steuer (Paket P2, Konzept
 * Dateien/Mandantenkonzept/Anfordern-und-Freigeben-2026-11-18.md)
 *
 * Marcel 18.11.2026 (verbindlich): Oeffnet der Partner einen Kundenstand oder ein „fuer den Kunden weitergefuehrtes“
 * Objekt, rechnet die Steuer NUR mit dem Steuerprofil dieses Kunden: zvE je Jahr (Steuerzeitraeume), Veranlagung,
 * Kirchensteuer, Saldo seiner uebrigen Objekte, seine Gesellschaften (Mandanten-Parameter fuer GmbH-Objekte). Ohne
 * Freigabe steht „Steuerdaten nicht freigegeben“ und KEINE Steuerzahl, nie die Daten des Partners. Geschrieben wird
 * nichts in die Steuer des Partners: kein Steuerzeitraum, kein Investmentprofil, kein Mandant, kein Snapshot.
 *
 * EINE STELLE: Die Leser fragen hier zuerst und nehmen sonst ihre eigenen Daten.
 *   tax-periods.js     getForDateSync, getForDate, getAllSync, status, loadAll   -> zeitraeume()
 *   wk-aggregator.js   getAllObjectsWithWK, getWKForOtherObjects, getTotalWK, status -> bestand()
 *   mandanten.js       Liste, _isPro, Speichern gesperrt                         -> mandanten(), pro()
 *   tax.js             Tax.optionen, DpSteuerAngaben, _dpZveFuerJahr, Snapshot-Post -> angaben(), gesperrt()
 *   zve-manager.js     onObjectInput (schreibt sonst ins Profil des Partners)    -> schreibschutz()
 * Daraus folgen ohne eigene Aenderung: calc.js _zveJahr und Z. 829-850 (ueber DealPilotTaxPeriods),
 * _getBestandLossesForYear/_dpBestandSaldo (ueber DealPilotWKAggregator), steuerParameter/effRate/isCorp/sphaere/
 * kostenFuer (ueber die Mandantenliste), ueberfuehrung-kern (bekommt die Parameter von dort), dp-dokumente.
 *
 * Woher der Kontext kommt: aus dem geladenen Objekt (window._currentObjData), synchron, ohne Laden:
 *   _kundenstand            Kopie beim Partner (P1)                -> Kontext Kunde
 *   _von_kunde.modus kunde  fuer den Kunden weitergefuehrt (P2)    -> Kontext Kunde
 *   _von_kunde.modus eigen  in den eigenen Bestand uebernommen     -> kein Kontext (Daten des Partners)
 *   _steuerbasis.profil     das Steuerprofil des Kunden (Server: partnerSteuerprofil.basisFuer). Fehlt es: gesperrt.
 * Dazu mit(profil, fn): fuer EINEN synchronen Lauf ausdruecklich (Steuer-Mappe eines Kunden beim Partner).
 *
 * Beim Kunden sammelt einsammeln() das Profil im Browser ein (dieselben Quellen, mit denen dort gerechnet wird).
 */
(function () {
  'use strict';
  var _explizit = null, _aus = 0;
  var _cache = { d: null, sb: null, k: null };

  function _arr(x) { return Array.isArray(x) ? x : []; }
  function _fuer(d) {
    if (!d || typeof d !== 'object') return null;
    var ks = d._kundenstand && typeof d._kundenstand === 'object' ? d._kundenstand : null;
    var vk = d._von_kunde && typeof d._von_kunde === 'object' ? d._von_kunde : null;
    if (!ks && !(vk && vk.modus !== 'eigen')) return null;
    var sb = d._steuerbasis && typeof d._steuerbasis === 'object' ? d._steuerbasis : null;
    var p = sb && sb.profil && typeof sb.profil === 'object' ? sb.profil : null;
    return {
      quelle: ks ? 'kundenstand' : 'weitergefuehrt', gesperrt: !p, profil: p, basis: sb,
      kunde: (ks && ks.kunde) || (vk && vk.kunde) || 'Kunde', kundennummer: (vk && vk.kundennummer) || null,
      client_id: (ks && ks.client_id) || (vk && vk.client_id) || null,
      stand_am: (sb && (sb.stand_am || sb.erzeugt_am)) || (ks && ks.stand_am) || null, fassung: sb ? sb.fassung : null,
      orig_id: sb ? sb.orig_id : null, halter: (sb && sb.halter) || 'privat',
      schluessel: (ks ? 'ks:' : 'wf:') + ((sb && sb.profil_id) || 'ohne') + ':' + ((sb && sb.fassung) || 0) + ':' + ((sb && sb.orig_id) || '')
    };
  }
  /** Der geltende Kontext oder null (dann rechnet jeder Leser mit den eigenen Daten des Angemeldeten). */
  function aktiv() {
    if (_aus) return null;
    if (_explizit) return _explizit;
    var d = null; try { d = window._currentObjData; } catch (e) { d = null; }
    if (d === _cache.d && d && d._steuerbasis === _cache.sb && d._kundenstand === _cache.ks && d._von_kunde === _cache.vk) return _cache.k;
    var k = _fuer(d);
    _cache = { d: d, sb: d && d._steuerbasis, ks: d && d._kundenstand, vk: d && d._von_kunde, k: k };
    return k;
  }
  function gesperrt() { var k = aktiv(); return !!(k && k.gesperrt); }
  function schreibschutz() { return !!aktiv(); }
  function schluessel() { var k = aktiv(); return k ? k.schluessel : 'eigen'; }

  /** Steuerzeitraeume des Kunden in der Form der API (/tax-periods). Gesperrt: keine. */
  function zeitraeume() {
    var k = aktiv(); if (!k || !k.profil) return [];
    return _arr(k.profil.zeitraeume).map(function (z) {
      return { id: 'kunde-' + z.valid_from, valid_from: z.valid_from, valid_to: z.valid_to || null, zve: Number(z.zve) || 0,
        splitting: z.splitting === true || z.splitting === false ? z.splitting : null,
        kirchensteuer: z.kirchensteuer === 0 || z.kirchensteuer === 8 || z.kirchensteuer === 9 ? z.kirchensteuer : null,
        label: z.label || null, _kunde: true };
    });
  }
  /** Veranlagung und Kirchensteuer aus dem Investmentprofil des Kunden. Gesperrt: neutral. */
  function angaben() {
    var k = aktiv(); var a = (k && k.profil && k.profil.angaben) || {};
    return { splitting: a.splitting === true, kirchensteuer: a.kirchensteuer === 8 || a.kirchensteuer === 9 ? a.kirchensteuer : 0 };
  }
  /** Mandanten (Privat und Gesellschaften) des Kunden. Gesperrt: nur Privat. */
  function mandanten() {
    var k = aktiv();
    var l = (k && k.profil) ? _arr(k.profil.mandanten).slice() : [];
    if (!l.some(function (m) { return m && m.id === 'privat'; })) l.unshift({ id: 'privat', name: 'Privat', rechtsform: 'privat', regime: {}, bh: {}, _locked: true });
    return l;
  }
  function pro() { var k = aktiv(); return !!(k && k.profil && k.profil.pro === true); }
  /** Uebrige Objekte des Kunden fuer die Verlustverrechnung, in der Form von DealPilotWKAggregator.getAllObjectsWithWK.
   *  Das Original dieses Objekts traegt die Kennung des geoeffneten Objekts, damit es sich selbst ueberspringt. */
  function bestand(aktuelleId) {
    var k = aktiv(); if (!k || !k.profil) return [];
    var cur = aktuelleId || window._currentObjKey || null;
    return _arr(k.profil.bestand).map(function (o, i) {
      return { id: (k.orig_id && o.id === k.orig_id && cur) ? cur : o.id, address: o.address || '', purchase_date: o.purchase_date || null, status: 'won',
        wk_per_year: o.wk_per_year || {}, halter: o.halter || 'privat', rang: typeof o.rang === 'number' ? o.rang : i };
    });
  }
  function halter() { var k = aktiv(); return k ? k.halter : null; }

  /** Fuer EINEN synchronen Lauf mit dem Profil eines Kunden rechnen (Steuer-Mappe des Kunden beim Partner). */
  function mit(profil, fn, info) {
    var vor = _explizit;
    _explizit = { quelle: 'mappe', gesperrt: !profil, profil: profil || null, basis: null, kunde: (info && info.kunde) || 'Kunde',
      kundennummer: (info && info.kundennummer) || null, client_id: (info && info.client_id) || null, stand_am: info && info.stand_am, fassung: info && info.fassung,
      orig_id: null, halter: 'privat', schluessel: 'mappe:' + ((info && info.profil_id) || '') };
    _zuruecksetzen();
    try { return fn(); } finally { _explizit = vor; _zuruecksetzen(); }
  }
  /** Ohne Kontext (Kunde sammelt seine eigenen Daten ein, auch wenn gerade eine Kopie offen waere) */
  function ohne(fn) { _aus++; _zuruecksetzen(); try { return fn(); } finally { _aus--; _zuruecksetzen(); } }
  function _zuruecksetzen() { try { if (window._zveCache) window._zveCache.ts = 0; } catch (e) {} }

  /** Satz fuer das Band (Kundentext, Punkt und Komma). */
  function _datum(s) { var t = String(s || '').slice(0, 10).split('-'); return t.length === 3 ? t[2] + '.' + t[1] + '.' + t[0] : ''; }
  function bandText(k) {
    k = k || aktiv(); if (!k) return '';
    var wer = (k.kundennummer ? k.kundennummer + ' · ' : '') + (k.kunde || 'Kunde');
    if (k.gesperrt) return 'Steuerdaten nicht freigegeben. Die Steuerwirkung wird hier nicht berechnet, auch nicht mit deinen eigenen Steuerdaten.';
    return 'Steuer mit den Angaben von ' + wer + ', Stand ' + (_datum(k.stand_am) || 'unbekannt') + (k.fassung ? ' (Steuerprofil Fassung ' + k.fassung + ')' : '') + '. Deine eigenen Steuerdaten bleiben unberührt.';
  }

  /* ── Gesperrt: keine Steuerzahl zeigen ───────────────────────────────── */
  /* v3942 · Hier stand 'dp-sk-stil' - dieselbe Kennung wie der Stilblock der Steuerkette im Cockpit
     (dashboard.js _ketteStil). Diese Datei lädt früher und legt ihren Block zuerst an; _ketteStil fand
     die Kennung, hielt sich für erledigt, und die Tabelle „Steuer über alle Objekte“ blieb ohne Stil
     (gemessen Staging 21.11.2026: th padding 0px, .sk-nr ohne Grund). Eigene Kennung, je Datei eine. */
  var MASKE_ID = 'dp-skx-maske-stil';
  var WERTE = ['cr-cfns', 'cr-cfm', 'ph-cfns-now', 'ph-cfns-ezb', 'ph-cfns-an', 'ph-cfnsm-now', 'ph-cfnsm-ezb', 'ph-cfnsm-an'];
  function _stil() {
    if (document.getElementById(MASKE_ID)) return;
    var s = document.createElement('style'); s.id = MASKE_ID;
    s.textContent = [
      'body.dp-sk-gesperrt #tax-result-box > :not(.dp-sk-hinweis), body.dp-sk-gesperrt #tax-timeline-box, body.dp-sk-gesperrt .bw-cf-tax{display:none !important}',
      WERTE.map(function (id) { return 'body.dp-sk-gesperrt #' + id; }).join(',') + '{font-size:0 !important}',
      WERTE.map(function (id) { return 'body.dp-sk-gesperrt #' + id + '::after'; }).join(',') + '{content:"nicht freigegeben";font-size:11px;font-weight:600;color:#7A7370}',
      '.dp-sk-hinweis{border:1px solid #E5DCC6;background:#FBF6E9;border-left:3px solid var(--wl-c9a84c,#C9A84C);border-radius:8px;padding:10px 12px;font:500 12.5px/1.5 Inter,sans-serif;color:#2A2727;margin:0 0 10px}',
      '.dp-sk-band{display:block;margin-top:4px;font-size:12px;line-height:1.45}',
      'body.dp-sk-kunde #st_splitting, body.dp-sk-kunde #st_kist, body.dp-sk-kunde #halter{pointer-events:none;opacity:.75}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }
  /** Nach jedem Laden und Rechnen: Klassen setzen, Hinweis im Reiter Steuer, Auswahlfelder nur lesend. */
  function anwenden() {
    var k = null; try { k = _explizit ? null : aktiv(); } catch (e) { k = null; }
    var b = document.body; if (!b) return;
    _stil();
    b.classList.toggle('dp-sk-kunde', !!k);
    b.classList.toggle('dp-sk-gesperrt', !!(k && k.gesperrt));
    ['st_splitting', 'st_kist', 'halter'].forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      if (k) { if (!el.hasAttribute('data-sk-fest')) { el.setAttribute('data-sk-fest', el.disabled ? 'war' : '1'); } el.disabled = true; }
      else if (el.hasAttribute('data-sk-fest')) { el.disabled = el.getAttribute('data-sk-fest') === 'war'; el.removeAttribute('data-sk-fest'); }
    });
    var box = document.getElementById('tax-result-box');
    var h = box && box.querySelector('.dp-sk-hinweis');
    if (k && box) {
      if (!h) { h = document.createElement('div'); h.className = 'dp-sk-hinweis'; box.insertBefore(h, box.firstChild); }
      var t = bandText(k);
      if (h.textContent !== t) h.textContent = t;
    } else if (h) h.remove();
    if (k && !k.gesperrt) {
      /* Halter des Kunden zeigen (nur lesend): die Optionen kommen aus seiner Mandantenliste */
      try { var sel = document.getElementById('halter'); if (sel && k.halter && sel.value !== k.halter && window.DealPilotMandanten && DealPilotMandanten.renderHalterOptions) { DealPilotMandanten.renderHalterOptions(); sel.value = k.halter; } } catch (e) {}
    }
  }
  var _plan = null;
  function _bald() { if (_plan) return; _plan = setTimeout(function () { _plan = null; anwenden(); }, 30); }
  ['dp:object-ready', 'dp:steuerzeitraeume', 'dp:steuer-snapshots'].forEach(function (ev) { window.addEventListener(ev, _bald); });
  /* renderTaxModule schreibt #tax-result-box neu: danach Hinweis wieder setzen (Umhuellung, sobald tax.js geladen ist) */
  function _umhuellen() {
    try {
      if (typeof window.renderTaxModule === 'function' && !window.renderTaxModule._sk) {
        var alt = window.renderTaxModule;
        var neu = function () { var r = alt.apply(this, arguments); try { anwenden(); } catch (e) {} return r; };
        neu._sk = true; window.renderTaxModule = neu;
      }
    } catch (e) {}
    _bald();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _umhuellen); else setTimeout(_umhuellen, 0);

  /* ── Beim Kunden: Profil einsammeln (Senden mit Bereich Steuerdaten) ───── */
  function _warte(p, ms) { return Promise.race([Promise.resolve(p).catch(function () { return null; }), new Promise(function (r) { setTimeout(r, ms); })]); }
  function einsammeln() {
    var TP = window.DealPilotTaxPeriods, WK = window.DealPilotWKAggregator;
    return Promise.all([
      _warte(ohne(function () { return TP && TP.loadAll ? TP.loadAll(true) : null; }), 15000),
      _warte(ohne(function () { return WK && WK.loadAll ? WK.loadAll(true) : null; }), 15000)
    ]).then(function () {
      return ohne(function () {
        var IP = window.DealPilotInvestmentProfile, M = window.DealPilotMandanten, p = {};
        try { p = (IP && IP.load && IP.load()) || {}; } catch (e) { p = {}; }
        var kist = parseInt(p.kirchensteuer, 10);
        var per = []; try { per = (TP && TP.getAllSync) ? TP.getAllSync() : []; } catch (e) { per = []; }
        var ml = []; try { ml = (M && M.getList) ? M.getList() : []; } catch (e) { ml = []; }
        var bl = []; try { bl = (WK && WK.getAllObjectsWithWK) ? WK.getAllObjectsWithWK() : []; } catch (e) { bl = []; }
        var istPro = false; try { istPro = !!(M && M._isPro && M._isPro()); } catch (e) { istPro = false; }
        return {
          v: 1, erzeugt_am: new Date().toISOString(),
          zeitraeume: _arr(per).map(function (z) { return { valid_from: z.valid_from, valid_to: z.valid_to || null, zve: z.zve, splitting: z.splitting, kirchensteuer: z.kirchensteuer, label: z.label || z.bezeichnung || null }; }),
          angaben: { splitting: p.splitting === true || p.splitting === 'true', kirchensteuer: kist === 8 || kist === 9 ? kist : 0 },
          mandanten: JSON.parse(JSON.stringify(_arr(ml))),
          bestand: _arr(bl).map(function (o) { return { id: o.id, address: o.address || '', purchase_date: o.purchase_date || null, wk_per_year: o.wk_per_year || {}, halter: o.halter || 'privat', rang: o.rang }; }),
          pro: istPro
        };
      });
    });
  }

  window.DpSteuerKontext = {
    aktiv: aktiv, gesperrt: gesperrt, schreibschutz: schreibschutz, schluessel: schluessel,
    zeitraeume: zeitraeume, angaben: angaben, mandanten: mandanten, pro: pro, bestand: bestand, halter: halter,
    mit: mit, ohne: ohne, bandText: bandText, anwenden: anwenden, einsammeln: einsammeln, _fuer: _fuer, VERSION: 'v3700'
  };
})();
