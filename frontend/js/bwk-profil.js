/* bwk-profil.js - v2184
 * ═════════════════════════════════════════════════════════════════════
 * BEWIRTSCHAFTUNG JE OBJEKTART.
 *
 * Marcel am 13.10.2026: „Koennen wir die Bewirtschaftung auch Standardwerte
 * anbieten? Das aendert sich ja je nach Objekt und Typ des Hauses. Kann man
 * eventuell auch einfach eine Prozentzahl fuer das Hausgeld angeben und es
 * teilt sich automatisch auf? ... in den Einstellungen anpassbar?"
 * Nach der Demo (v2183): „ja das kannst du so umsetzen alles".
 *
 * Bis hierher galt fuer JEDES Objekt dasselbe Profil (umlagefaehig 17 %,
 * nicht umlagefaehig 16 % der NKM), gespeichert nur im Browser.
 *
 * ── DIE WERTE ───────────────────────────────────────────────────────
 * Haeuser: ImmoWertV 2021, Anlage 3 - dieselben Basiswerte wie im
 * Marktbericht (marktbericht/backend/src/lib/immowertv.js, BWK_TABELLE):
 * Verwaltung 230 EUR je Wohnung bzw. Wohngebaeude, 30 EUR je Stellplatz,
 * Instandhaltung 9,00 EUR/m2 Wohnflaeche und 68 EUR je Stellplatz.
 * Die Betraege werden mit dem Verbraucherpreisindex fortgeschrieben; der
 * FAKTOR ist eine Einstellung.
 * v2185 · Recherchiert am 13.10.2026: fuer Stichtage ab 01.01.2026 nennen
 * zwei Fachquellen uebereinstimmend 367 EUR Verwaltung je Wohnung/EFH,
 * 439 EUR je ETW, 48 EUR je Garage, 14,40 EUR/m2 Instandhaltung
 * (immobilien-wertermittlung.de, abels-immobilienbewertung.com; ein
 * amtliches Schreiben wurde nicht gefunden). Gegen die Basiswerte hier ist
 * das jedes Mal Faktor 1,596-1,600 -> 1,60. Vorher stand 1,30 (Stand 2021).
 * Jaehrlich zum 1. Januar neu eintragen.
 * ETW: Hausgeld je m2 und Monat, automatisch aufgeteilt (30 % nicht
 * umlagefaehig - Marcels Abnahme der Demo), dazu eine eigene Ruecklage
 * fuer das Sondereigentum.
 * Startwerte ohne Unterlagen (Hausgeld 4,00, Betriebskosten 2,20/2,50
 * EUR/m2) sind Annahmen - die echte Zahl aus Wirtschaftsplan oder
 * Abrechnung geht immer vor, und von Hand Eingetragenes wird nie
 * ueberschrieben.
 *
 * ── WOHIN DIE ZAHLEN GEHEN (Reiter Bewirtschaftung, Detailmodus) ────
 *   ETW    hg_ul   Hausgeld umlagefaehig
 *          hg_nul  Hausgeld nicht umlagefaehig
 *          eigen_r eigene Instandhaltungsruecklage
 *   Haus   hg_ul   umlagefaehige Betriebskosten
 *          hg_nul  Verwaltung
 *          eigen_r Instandhaltung
 * Der Mietausfall bleibt bei Marcels Entscheidung vom 01.10.2026 (1 % im
 * Investmentprofil) und wird hier nicht doppelt gefuehrt.
 *
 * ── WANN ─────────────────────────────────────────────────────────────
 * Automatisch nur in LEERE Felder oder in Felder, die dieses Modul selbst
 * gefuellt hat (data-bwk-auto) - ausgeloest durch Aenderungen an
 * Objektart, Wohnflaeche, Einheiten oder Stellplaetzen. Ein gespeichertes
 * Objekt beim Laden wird NICHT angefasst. Wer selbst tippt, nimmt dem Feld
 * die Markierung; danach gilt nur noch seine Zahl. Neu einsetzen geht
 * jederzeit ueber den Knopf im Reiter.
 * ═════════════════════════════════════════════════════════════════════
 */
(function () {
  'use strict';

  var LS = 'dp_bwk_profil';
  var FERN = '/user-settings/bwk_profil';
  var STANDARD = {
    faktor: 1.60,   /* v2185: Stichtage ab 01.01.2026 - siehe Kopf */
    etw: { hg_qm: 4.00, nul_pct: 30, ruecklage_qm: 0.50 },
    efh: { verw: 230, inst_qm: 9.0, stp_inst: 68, bk_qm: 2.20 },
    mfh: { verw: 230, stp_verw: 30, inst_qm: 9.0, stp_inst: 68, bk_qm: 2.50 }
  };
  var ART = { ETW: 'etw', EFH: 'efh', ZFH: 'efh', DHH: 'efh', RH: 'efh', MFH: 'mfh' };
  var NAME = { etw: 'Eigentumswohnung', efh: 'Ein-/Zweifamilienhaus', mfh: 'Mehrfamilienhaus' };
  var ZIELE = ['hg_ul', 'hg_nul', 'eigen_r'];

  function kopie(o) { return JSON.parse(JSON.stringify(o)); }
  /* Gespeicherte Werte sind Zahlen (1.3) - nur Eingaben aus Feldern tragen
     deutsche Schreibweise („1.234,5"). Eine Zahl durch die Punkt-Entfernung
     zu schicken machte aus 1.3 eine 13. */
  function zahl(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v == null ? '' : v).trim();
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s); return isFinite(n) ? n : null;
  }
  function el(id) { return document.getElementById(id); }

  /* ── Speicher: Browser + Konto (Muster lage-profil.js) ───────────── */
  function lesen() {
    var p = null;
    try { p = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) {}
    var s = kopie(STANDARD);
    if (!p || typeof p !== 'object') return s;
    if (p.faktor_eigen && zahl(p.faktor) != null) s.faktor = zahl(p.faktor);   /* v2186: nur ein SELBST gesetzter Faktor gilt vor dem Jahreswert */
    ['etw', 'efh', 'mfh'].forEach(function (a) {
      Object.keys(s[a]).forEach(function (k) { if (p[a] && zahl(p[a][k]) != null) s[a][k] = zahl(p[a][k]); });
    });
    return s;
  }
  function schreiben(p) {
    try { localStorage.setItem(LS, JSON.stringify(p)); } catch (e) {}
    try { if (window.Auth && Auth.apiCall) Auth.apiCall(FERN, { method: 'PUT', body: { wert: p } }).catch(function () {}); } catch (e) {}
  }
  /* v2186 · Der Standardfaktor folgt den Anlage-3-Werten ZUM JAHR - aus
     derselben Tabelle wie der Ertragswert im Marktbericht (/bwk/ansaetze).
     Instandhaltung je m2 des Jahres geteilt durch den Basiswert 9,00. Wer
     den Faktor selbst eintraegt (faktor_eigen), behaelt seinen. */
  function jahresFaktor() {
    if (!window.Auth || !Auth.apiCall) return;
    Auth.apiCall('/marktbericht/bwk/ansaetze?jahr=' + new Date().getFullYear(), { method: 'GET' }).then(function (r) {
      var q = r && r.werte && r.werte.inst_qm;
      if (q > 0) { STANDARD.faktor = Math.round(q / 9 * 100) / 100; STANDARD.jahr = r.stichtag_jahr; leisteZeichnen(); }
    }).catch(function () {});
  }
  function vomServer() {
    if (!window.Auth || !Auth.apiCall) return;
    Auth.apiCall(FERN, { method: 'GET' }).then(function (r) {
      var w = r && (r.wert || r.value);
      if (w && typeof w === 'object') { try { localStorage.setItem(LS, JSON.stringify(w)); } catch (e) {} }
    }).catch(function () {});
  }

  /* ── Der Vorschlag fuer ein Objekt ────────────────────────────────── */
  function artVon(objart) { return ART[String(objart || '').toUpperCase()] || null; }
  function vorschlag(o) {
    var a = artVon(o.objart), p = lesen();
    var wfl = zahl(o.wfl);
    if (!a || !wfl || wfl <= 0) return null;
    var f = p.faktor || 1, we = Math.max(1, zahl(o.einheiten) || 1), stp = (zahl(o.garagen) || 0) + (zahl(o.stellpl_aussen) || 0);
    if (a === 'etw') {
      var e = p.etw, hg = e.hg_qm * wfl * 12, nul = hg * e.nul_pct / 100;
      return { art: a, hg_ul: Math.round(hg - nul), hg_nul: Math.round(nul), eigen_r: Math.round(e.ruecklage_qm * wfl * 12),
        text: 'Hausgeld ' + de(e.hg_qm, 2) + ' €/m² × ' + de(wfl) + ' m² × 12, davon ' + de(e.nul_pct) + ' % nicht umlagefähig; eigene Rücklage ' + de(e.ruecklage_qm, 2) + ' €/m²' };
    }
    var h = p[a], einheiten = a === 'mfh' ? we : 1;
    var verw = (h.verw * einheiten + (h.stp_verw || 0) * (a === 'mfh' ? stp : 0)) * f;
    var inst = (h.inst_qm * wfl + h.stp_inst * stp) * f;
    return { art: a, hg_ul: Math.round(h.bk_qm * wfl * 12), hg_nul: Math.round(verw), eigen_r: Math.round(inst),
      text: 'Betriebskosten ' + de(h.bk_qm, 2) + ' €/m² · Verwaltung ' + de(h.verw) + ' € × ' + de(einheiten) + (a === 'mfh' && stp ? ' + ' + de(h.stp_verw) + ' € × ' + de(stp) + ' Stellpl.' : '')
        + ' · Instandhaltung ' + de(h.inst_qm, 2) + ' €/m²' + (stp ? ' + ' + de(h.stp_inst) + ' € × ' + de(stp) + ' Stellpl.' : '') + ' · Faktor ' + de(f, 2) + ' (ImmoWertV Anlage 3)' };
  }
  function de(n, d) { return Number(n).toLocaleString('de-DE', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function ausFormular() {
    var v = function (id) { var x = el(id); return x ? x.value : ''; };
    return { objart: v('objart'), wfl: v('wfl'), einheiten: v('einheiten'), garagen: v('garagen'), stellpl_aussen: v('stellpl_aussen') };
  }

  /* ── Ins Formular ──────────────────────────────────────────────────
     erzwingen=false: nur leere oder selbst gefuellte Felder. */
  function einsetzen(erzwingen) {
    var v = vorschlag(ausFormular());
    if (!v) { leisteZeichnen(); return 0; }
    var n = 0;
    ZIELE.forEach(function (id) {
      var f = el(id); if (!f) return;
      var leer = String(f.value || '').trim() === '';
      if (!erzwingen && !leer && f.getAttribute('data-bwk-auto') !== '1') return;
      f.value = de(v[id]);
      f.setAttribute('data-bwk-auto', '1');
      n++;
    });
    if (n) { try { if (typeof window.calc === 'function') window.calc(); } catch (e) {} }
    leisteZeichnen();
    return n;
  }

  /* Eigene Eingabe nimmt die Markierung - ab dann gilt nur die Zahl des Nutzers. */
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!ev.isTrusted || !t || ZIELE.indexOf(t.id) < 0) return;
    t.removeAttribute('data-bwk-auto');
    leisteZeichnen();
  }, true);
  /* Ausloeser: Objektart, Flaeche, Einheiten, Stellplaetze */
  ['change', 'input'].forEach(function (typ) {
    document.addEventListener(typ, function (ev) {
      var t = ev.target;
      if (!ev.isTrusted || !t || ['objart', 'wfl', 'einheiten', 'garagen', 'stellpl_aussen'].indexOf(t.id) < 0) return;
      clearTimeout(einsetzen._t);
      einsetzen._t = setTimeout(function () { einsetzen(false); }, 400);
    }, true);
  });
  /* Objektwechsel: Markierungen gehoeren zum vorigen Objekt */
  window.addEventListener('dp:object-ready', function () {
    ZIELE.forEach(function (id) { var f = el(id); if (f) f.removeAttribute('data-bwk-auto'); });
    setTimeout(leisteZeichnen, 300);
  });

  /* ── Leiste im Reiter Bewirtschaftung ──────────────────────────────── */
  function leisteZeichnen() {
    var host = el('bwk-standard-bar');
    if (!host) return;
    var v = vorschlag(ausFormular());
    var a = artVon((el('objart') || {}).value);
    if (!a) {
      host.innerHTML = '<div class="bwk-std"><b>Standardwerte je Objektart</b> — sobald im Reiter Objekt Objektart und Wohnfläche stehen, schlägt DealPilot die Bewirtschaftung vor. Anpassen in den Einstellungen unter „Investment-Profil“.</div>';
      return;
    }
    var auto = ZIELE.filter(function (id) { var f = el(id); return f && f.getAttribute('data-bwk-auto') === '1'; }).length;
    host.innerHTML = '<div class="bwk-std"><div><b>Standardwerte · ' + NAME[a] + '</b>'
      + (v ? '<div class="bwk-std-t">' + v.text + '</div>' : '<div class="bwk-std-t">Für den Vorschlag fehlt die Wohnfläche im Reiter Objekt.</div>')
      + (a !== 'etw' ? '<div class="bwk-std-t">Bei Häusern ohne WEG steht unten: umlagefähig = Betriebskosten, nicht umlagefähig = Verwaltung, eigene Rücklage = Instandhaltung.</div>' : '')
      + (auto ? '<div class="bwk-std-t">' + auto + ' Feld' + (auto > 1 ? 'er' : '') + ' aus den Standardwerten — eigene Eingaben gehen immer vor.</div>' : '')
      + '</div>' + (v ? '<button type="button" class="btn btn-sm" onclick="DealPilotBwkProfil.einsetzen(true)" title="Setzt Hausgeld/Betriebskosten, nicht umlagefähige Kosten und Rücklage neu aus den Standardwerten — überschreibt die drei Felder.">Standardwerte einsetzen</button>' : '')
      + '</div>';
  }

  /* ── Einstellungen (Investment-Profil) ─────────────────────────────── */
  var FELDER = {
    etw: [['hg_qm', 'Hausgeld-Startwert', '€/m² · Monat', 'gilt, bis ein Wirtschaftsplan vorliegt'],
          ['nul_pct', 'davon nicht umlagefähig', '% des Hausgelds', 'teilt das Hausgeld automatisch auf'],
          ['ruecklage_qm', 'Eigene Rücklage Sondereigentum', '€/m² · Monat', 'Bad, Küche, Böden der eigenen Wohnung']],
    efh: [['verw', 'Verwaltung', '€ je Gebäude · Jahr', 'ImmoWertV Anlage 3: 230 € Basiswert'],
          ['inst_qm', 'Instandhaltung', '€/m² · Jahr', 'ImmoWertV Anlage 3: 9,00 € Basiswert'],
          ['stp_inst', 'Instandhaltung Garage/Stellplatz', '€ · Jahr', 'ImmoWertV Anlage 3: 68 €'],
          ['bk_qm', 'Umlagefähige Betriebskosten', '€/m² · Monat', 'Startwert bis zur ersten Abrechnung']],
    mfh: [['verw', 'Verwaltung', '€ je Wohnung · Jahr', 'ImmoWertV Anlage 3: 230 € Basiswert'],
          ['stp_verw', 'Verwaltung Garage/Stellplatz', '€ · Jahr', 'ImmoWertV Anlage 3: 30 €'],
          ['inst_qm', 'Instandhaltung', '€/m² · Jahr', 'ImmoWertV Anlage 3: 9,00 € Basiswert'],
          ['stp_inst', 'Instandhaltung Garage/Stellplatz', '€ · Jahr', 'ImmoWertV Anlage 3: 68 €'],
          ['bk_qm', 'Umlagefähige Betriebskosten', '€/m² · Monat', 'Startwert bis zur ersten Abrechnung']]
  };
  function einstellungenHtml() {
    var p = lesen();
    function f(a, k, lbl, eh, hint) {
      return '<div class="ip-field"><label for="bwkp_' + a + '_' + k + '">' + lbl + '</label><div class="ip-field-row">'
        + '<input type="text" inputmode="decimal" id="bwkp_' + a + '_' + k + '" data-bwkp-art="' + a + '" data-bwkp-k="' + k + '" value="' + String(p[a][k]).replace('.', ',') + '">'
        + '<span class="ip-unit">' + eh + '</span></div><div class="ip-hint">' + hint + '</div></div>';
    }
    return '<h3 class="ip-section">Bewirtschaftung je Objektart</h3>'
      + '<p class="hint" style="margin:-4px 0 12px">Daraus füllt DealPilot im Reiter Bewirtschaftung die leeren Felder, sobald Objektart und Wohnfläche feststehen. Eigene Eingaben am Objekt gehen immer vor. Gespeichert an deinem Konto.</p>'
      + ['etw', 'efh', 'mfh'].map(function (a) {
        return '<div class="bwkp-block"><div class="bwkp-titel">' + NAME[a] + '</div><div class="ip-grid">'
          + FELDER[a].map(function (x) { return f(a, x[0], x[1], x[2], x[3]); }).join('') + '</div></div>';
      }).join('')
      + '<div class="ip-grid"><div class="ip-field"><label for="bwkp_faktor">Fortschreibungsfaktor (Häuser)</label><div class="ip-field-row">'
      + '<input type="text" inputmode="decimal" id="bwkp_faktor" data-bwkp-k="faktor" value="' + String(p.faktor).replace('.', ',') + '"><span class="ip-unit">× Basiswert</span></div>'
      + '<div class="ip-hint">Verbraucherpreisindex zum Stichtag. 1,60 gilt für Stichtage ab 01.01.2026 (Verwaltung 367 €, Instandhaltung 14,40 €/m²); jährlich zum 1. Januar anpassen.</div></div></div>';
  }
  function verdrahten(root) {
    (root || document).addEventListener('change', function (ev) {
      var t = ev.target; if (!t || !t.hasAttribute || !t.hasAttribute('data-bwkp-k')) return;
      var p = lesen(), k = t.getAttribute('data-bwkp-k'), a = t.getAttribute('data-bwkp-art'), n = zahl(t.value);
      if (n == null) return;
      if (a) p[a][k] = n; else p[k] = n;
      if (k === 'faktor') p.faktor_eigen = true;   /* v2186 */
      schreiben(p);
      if (typeof window.toast === 'function') toast('✓ Standardwert gespeichert');
    });
  }

  function css() {
    if (el('bwk-profil-css')) return;
    var st = document.createElement('style'); st.id = 'bwk-profil-css';
    st.textContent = '.bwk-std{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:0 0 14px;padding:12px 14px;border-radius:12px;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent);background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 7%, transparent);font-size:13px}'
      + '.bwk-std-t{font-size:12px;color:var(--muted,#7a7368);margin-top:3px}'
      + '.bwkp-block{margin:0 0 10px}.bwkp-titel{font:600 12px/1.4 Inter,system-ui,sans-serif;margin:6px 0 6px}';
    document.head.appendChild(st);
  }

  function start() { css(); vomServer(); jahresFaktor(); setTimeout(leisteZeichnen, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  window.DealPilotBwkProfil = { lesen: lesen, vorschlag: vorschlag, einsetzen: einsetzen, leisteZeichnen: leisteZeichnen,
    einstellungenHtml: einstellungenHtml, verdrahten: verdrahten, STANDARD: STANDARD };
})();
