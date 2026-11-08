'use strict';
/* ══ v3217 · VERMÖGEN & HAUSHALT (W-11) · PROFILFOTO UND CHECKLISTE (W-5) ══════

   Umsetzungswünsche des Entwicklungspartners (Staging, 06./07.11.2026),
   Backlog N137 Paket P6 und „Offen“ Punkt 6 („Gesamtvermögensbilanz und ihre
   Entwicklung … das wäre ein USP“). Marcel 08.11.2026: die Investoren-
   broschüre ist der ERWEITERTE Track Record, kein neues Dokument.

   WAS HIER STEHT
   · Vermögensaufstellung: Posten frei anlegbar (Bank/Konten, Depot,
     Sonstiges; Verbindlichkeiten mit Unterkategorien). Die Immobilien
     kommen AUTOMATISCH aus den Objekten im Bestand - mit denselben Helfern
     wie die Vermögensbilanz im Portfolio-Cockpit (dashboard.js
     `_kpEuro`, `_restschuldOf`, über `DealPilotDashboard.vermoegenObjekte()`).
     Eine zweite Wert- oder Restschuldrechnung gibt es hier nicht.
   · Haushaltsrechnung: Einnahmen und Ausgaben je Monat, frei erweiterbar.
   · „Stand speichern“ mit Datum und Kommentar (Maßnahmen) → Verlauf als
     Liste und Grafik (Chart.js). Hinweis in der App, wenn der letzte Stand
     älter als 31 Tage ist - keine Mail.
   · Mein Profil: Profilfoto (Ablage wie das Logo, dp_user_settings
     `user_foto_b64`, ohne Plan-Sperre) und eine Checkliste mit drei Haken.

   SPEICHER: user_settings `vermoegen` (Schlüssel → JSONB, keine Migration;
   backend/src/routes/userSettings.js ERLAUBT). Server gewinnt, aber nie
   gegen leer. Im Browser je Konto unter dp_vermoegen:<userId> - zwei Konten
   im selben Browser teilen sich nichts.

   Gerechnet wird hier nur Addition. Kein Kern liest dieses Modul.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.DpVermoegen) return;

  var SCHLUESSEL = 'vermoegen';
  var SEC_ID = 's-vermoegen';
  var LS = 'dp_vermoegen:';
  var MONAT_TAGE = 31;

  var KAT_V = [['bank', 'Bank / Konten'], ['depot', 'Depot / Wertpapiere'], ['sonstiges', 'Sonstiges (Vorsorge, Fahrzeug, Bargeld …)']];
  var KAT_S = [['privat', 'Privatdarlehen'], ['konsum', 'Konsum- / Autokredit'], ['sonstige', 'Sonstige Verbindlichkeit']];
  var KAT_E = [['gehalt', 'Gehalt / Lohn'], ['miete', 'Mieteinnahmen'], ['kapital', 'Kapitalerträge'], ['sonstige', 'Sonstige Einnahmen']];
  var KAT_A = [['wohnen', 'Wohnen'], ['leben', 'Lebenshaltung'], ['versicherung', 'Versicherungen'], ['kredit', 'Kredite / Raten'], ['sparen', 'Sparen / Vorsorge'], ['sonstige', 'Sonstige Ausgaben']];

  /* ── Helfer ─────────────────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  /* Betrag lesen: „1.000“ ist ein Tausender, „3,5“ deutsch, „3.5“ bleibt 3,5
     (FALLEN „Punkt ist kein Tausender“ - nur das Muster 1.000 / 12.500.000
     wird als Tausendertrennung gelesen). */
  function betrag(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).replace(/[€\s ]/g, '');
    if (!s) return null;
    var neg = /^[−-]/.test(s); s = s.replace(/^[−+-]/, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }
  function eur(v) { return (v == null || !isFinite(v)) ? '–' : Math.round(v).toLocaleString('de-DE') + ' €'; }
  function eurFeld(v) { return (v == null || !isFinite(v)) ? '' : (Math.round(v * 100) / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 }); }
  function heute() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function datumDe(iso) { return /^\d{4}-\d{2}-\d{2}/.test(iso || '') ? iso.slice(0, 10).split('-').reverse().join('.') : ''; }
  function tageSeit(iso) { var t = Date.parse(String(iso || '').slice(0, 10)); return isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : null; }
  function neueId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function katName(liste, k) { for (var i = 0; i < liste.length; i++) if (liste[i][0] === k) return liste[i][1]; return liste[liste.length - 1][1]; }
  function toast(t) { try { if (typeof window.toast === 'function') window.toast(t); } catch (e) {} }
  /* Whitelabel-Gold für Canvas: var() wirkt dort nicht (CLAUDE.md) */
  function _wlc(h) {
    try { var v = getComputedStyle(document.documentElement).getPropertyValue('--wl-' + h.slice(1).toLowerCase()).trim(); if (/^#[0-9a-f]{6}$/i.test(v)) return v; } catch (e) {}
    return h;
  }

  /* ── Datenstand ────────────────────────────────────────────────────── */
  function leer() { return { v: 1, posten: [], haushalt: [], staende: [], immo: { wertansatz: 'kaufpreis', aus: [] } }; }
  function normal(o) {
    var d = leer();
    if (!o || typeof o !== 'object') return d;
    if (Array.isArray(o.posten)) d.posten = o.posten.filter(function (p) { return p && typeof p === 'object'; });
    if (Array.isArray(o.haushalt)) d.haushalt = o.haushalt.filter(function (p) { return p && typeof p === 'object'; });
    if (Array.isArray(o.staende)) d.staende = o.staende.filter(function (p) { return p && p.datum; });
    if (o.immo && typeof o.immo === 'object') {
      d.immo.wertansatz = o.immo.wertansatz === 'marktwert' ? 'marktwert' : 'kaufpreis';
      d.immo.aus = Array.isArray(o.immo.aus) ? o.immo.aus.map(String) : [];
    }
    return d;
  }
  function gefuellt(d) { return !!d && ((d.posten && d.posten.length) || (d.haushalt && d.haushalt.length) || (d.staende && d.staende.length)); }

  var uid = null, daten = leer(), geladen = null, timer = null;

  function sitzungsUid() {
    try {
      if (window.Auth && Auth.isApiMode && Auth.isApiMode() && Auth.getSession) {
        var s = Auth.getSession(); if (s && s.userId) return String(s.userId);
      }
    } catch (e) {}
    return null;
  }
  function lokalKey() { return LS + (uid || 'lokal'); }
  function lokalLesen() {
    var s = ls(); if (!s) return null;
    try { return JSON.parse(s.getItem(lokalKey()) || 'null'); } catch (e) { return null; }
  }
  function lokalSchreiben() {
    var s = ls(); if (!s) return;
    try { s.setItem(lokalKey(), JSON.stringify(daten)); } catch (e) {}
  }
  function hoch() {
    if (!uid || !window.Auth || typeof Auth.apiCall !== 'function') return;
    var w = Object.assign({}, daten, { nutzer: uid, stand: new Date().toISOString() });
    try { Auth.apiCall('/user-settings/' + SCHLUESSEL, { method: 'PUT', body: { wert: w } }).catch(function () { toast('⚠ Vermögensstand nur in diesem Browser gespeichert – Server nicht erreichbar.'); }); } catch (e) {}
  }
  function speichern() {
    lokalSchreiben();
    clearTimeout(timer);
    timer = setTimeout(hoch, 900);
    try { window.dispatchEvent(new CustomEvent('dp:vermoegen-geaendert')); } catch (e) {}
  }

  /** Lädt einmal je Konto. Server gewinnt, aber nie gegen leer. */
  function laden() {
    var u = sitzungsUid();
    if (geladen && u === uid) return geladen;
    uid = u;
    daten = normal(lokalLesen());
    if (!uid || !window.Auth || typeof Auth.apiCall !== 'function') { geladen = Promise.resolve(daten); return geladen; }
    geladen = Auth.apiCall('/user-settings/' + SCHLUESSEL).then(function (r) {
      var server = r && r.wert && typeof r.wert === 'object' ? normal(r.wert) : null;
      if (server && gefuellt(server)) { daten = server; lokalSchreiben(); }
      else if (gefuellt(daten)) hoch();
      return daten;
    }).catch(function () { return daten; });
    return geladen;
  }

  /* ── Objekte (Immobilien automatisch) ─────────────────────────────── */
  var _objekte = null, _objekteP = null;
  function objekteLaden(frisch) {
    if (_objekteP && !frisch) return _objekteP;
    var D = window.DealPilotDashboard;
    if (!D || typeof D.portfolioLaden !== 'function' || typeof D.vermoegenObjekte !== 'function') { _objekte = []; _objekteP = Promise.resolve(_objekte); return _objekteP; }
    _objekteP = D.portfolioLaden().then(function () { _objekte = D.vermoegenObjekte() || []; return _objekte; })
      .catch(function () { _objekte = []; return _objekte; });
    return _objekteP;
  }

  /* ── Rechnung (nur Summen) ─────────────────────────────────────────── */
  function berechnen(d, objekte) {
    d = d || daten; objekte = objekte || _objekte || [];
    var aus = (d.immo && d.immo.aus) || [], mw = d.immo && d.immo.wertansatz === 'marktwert';
    var immo = objekte.filter(function (o) { return aus.indexOf(String(o.key)) < 0; }).map(function (o) {
      var wert = mw && o.marktwert > 0 ? o.marktwert : o.kaufpreis;
      return { key: o.key, name: o.name, ort: o.ort, wert: wert || 0, rest: o.rest || 0, quelle: mw && o.hatMarktwert ? 'Marktwert' : 'Kaufpreis' };
    });
    var S = { bank: 0, depot: 0, sonstiges: 0, immo: 0, immoSchuld: 0, schuldenPosten: 0, einnahmen: 0, ausgaben: 0 };
    immo.forEach(function (x) { S.immo += x.wert; S.immoSchuld += x.rest; });
    (d.posten || []).forEach(function (p) {
      var b = betrag(p.betrag) || 0;
      if (p.art === 'schuld') S.schuldenPosten += b;
      else if (p.kat === 'bank') S.bank += b;
      else if (p.kat === 'depot') S.depot += b;
      else S.sonstiges += b;
    });
    (d.haushalt || []).forEach(function (p) { var b = betrag(p.betrag) || 0; if (p.art === 'aus') S.ausgaben += b; else S.einnahmen += b; });
    S.liquide = S.bank + S.depot;
    S.nichtLiquide = S.immo + S.sonstiges;
    S.brutto = S.liquide + S.nichtLiquide;
    S.schulden = S.immoSchuld + S.schuldenPosten;
    S.netto = S.brutto - S.schulden;
    S.ltv = S.brutto > 0 ? S.schulden / S.brutto * 100 : null;
    S.ueberschuss = S.einnahmen - S.ausgaben;
    S.immoListe = immo;
    return S;
  }
  function letzterStand(d) {
    var st = ((d || daten).staende || []).slice().sort(function (a, b) { return String(a.datum).localeCompare(String(b.datum)); });
    return st.length ? st[st.length - 1] : null;
  }
  function standAlt(d) {
    var l = letzterStand(d); if (!l) return null;
    var t = tageSeit(l.datum); return t != null && t > MONAT_TAGE ? t : 0;
  }

  /* ── Stil ─────────────────────────────────────────────────────────── */
  function stil() {
    if ($('dp-vm-stil')) return;
    var st = document.createElement('style'); st.id = 'dp-vm-stil';
    /* Sichtbar nur mit data-vm-offen am <html> - der Objekt-Lader stellt jede .sec auf display:'' zurück
       (dasselbe Muster wie die Portfolio-Strategie, v1880c). Nur Anordnung; Farben aus den App-Token. */
    st.textContent = 'html:not([data-vm-offen]) #' + SEC_ID + '{display:none !important}'
      + '#' + SEC_ID + '{padding:18px 22px;max-width:1280px}'
      + '#' + SEC_ID + ' .vm-kicker{font:600 10px/1 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;opacity:.75;margin-bottom:4px}'
      + '#' + SEC_ID + ' .vm-kopf p{max-width:820px;font-size:13.5px;line-height:1.55}'
      + '#' + SEC_ID + ' .vm-kz{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:14px 0}'
      + '#' + SEC_ID + ' .vm-kz>div{border:1px solid var(--border);border-top:3px solid var(--gold);border-radius:8px;padding:10px 12px;background:var(--white)}'
      + '#' + SEC_ID + ' .vm-kz .l{font:600 10px/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}'
      + '#' + SEC_ID + ' .vm-kz .v{font:600 19px/1.3 "JetBrains Mono",monospace;margin-top:4px;white-space:nowrap}'
      + '#' + SEC_ID + ' .vm-kz .s{font-size:11px;color:var(--muted);margin-top:2px}'
      + '#' + SEC_ID + ' .vm-pos{color:#3FA56C}#' + SEC_ID + ' .vm-neg{color:#B8625C}'
      + '#' + SEC_ID + ' .vm-hinweis{border-left:3px solid var(--gold);background:color-mix(in srgb,var(--gold) 9%,transparent);padding:10px 14px;border-radius:6px;font-size:13px;margin:12px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap}'
      + '#' + SEC_ID + ' .vm-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}'
      + '#' + SEC_ID + ' table.vm-tab{width:100%;border-collapse:collapse;font-size:12.5px;min-width:620px}'
      + '#' + SEC_ID + ' table.vm-tab th{font:600 10px/1.3 "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:left;padding:6px 6px;border-bottom:1px solid var(--border)}'
      + '#' + SEC_ID + ' table.vm-tab td{padding:4px 6px;border-bottom:1px solid var(--border);vertical-align:middle}'
      + '#' + SEC_ID + ' table.vm-tab td.r,#' + SEC_ID + ' table.vm-tab th.r{text-align:right}'
      + '#' + SEC_ID + ' table.vm-tab td.num{font-family:"JetBrains Mono",monospace;white-space:nowrap}'
      + '#' + SEC_ID + ' table.vm-tab tr.vm-gruppe td{font-weight:700;padding-top:12px}'
      + '#' + SEC_ID + ' table.vm-tab tr.vm-summe td{font-weight:700;border-bottom:2px solid var(--border)}'
      + '#' + SEC_ID + ' table.vm-tab tr.vm-ende td{font-weight:700;background:color-mix(in srgb,var(--gold) 10%,transparent)}'
      + '#' + SEC_ID + ' table.vm-tab tr.vm-ein td:first-child{padding-left:20px}'
      + '#' + SEC_ID + ' table.vm-tab input,#' + SEC_ID + ' table.vm-tab select{width:100%;min-width:0;padding:6px 8px;font-size:12.5px;border:1px solid var(--border);border-radius:6px;background:var(--white);color:inherit}'
      + '#' + SEC_ID + ' table.vm-tab input.vm-betrag{text-align:right;font-family:"JetBrains Mono",monospace}'
      + '#' + SEC_ID + ' .vm-x{background:none;border:0;cursor:pointer;color:var(--muted);font-size:16px;padding:2px 6px}#' + SEC_ID + ' .vm-x:hover{color:#B8625C}'
      + '#' + SEC_ID + ' .vm-add{margin:8px 8px 0 0}'
      + '#' + SEC_ID + ' .vm-zwei{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}'
      + '#' + SEC_ID + ' .vm-stand{display:grid;grid-template-columns:170px minmax(0,1fr) auto;gap:10px;align-items:end}'
      + '#' + SEC_ID + ' .vm-stand textarea{min-height:40px}'
      + '#' + SEC_ID + ' .vm-chart{position:relative;height:300px;margin:14px 0}'
      + '#' + SEC_ID + ' .vm-leer{font-size:12.5px;color:var(--muted);padding:6px 0}'
      + '#' + SEC_ID + ' .vm-wa{display:inline-flex;gap:6px;align-items:center;font-size:12px;color:var(--muted);margin-left:10px}'
      + '#' + SEC_ID + ' .vm-wa select{width:auto}'
      + '@media (max-width:900px){#' + SEC_ID + ' .vm-zwei{grid-template-columns:1fr}#' + SEC_ID + ' .vm-stand{grid-template-columns:1fr}}'
      + '@media (max-width:700px){#' + SEC_ID + '{padding:12px}}'
      /* Mein Profil (Einstellungen) */
      + '.dp-vm-profil{display:grid;grid-template-columns:auto minmax(0,1fr);gap:18px;align-items:start;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)}'
      + '.dp-vm-foto{width:88px;height:88px;border-radius:50%;background:var(--surface,#F6F4EF) center/cover no-repeat;border:2px solid var(--wl-c9a84c, #C9A84C);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:11px;text-align:center}'
      + '.dp-vm-check{list-style:none;padding:0;margin:8px 0;display:flex;gap:14px;flex-wrap:wrap;font-size:13px}'
      + '.dp-vm-check li{display:flex;gap:6px;align-items:center}'
      + '.dp-vm-check .ok{color:#3FA56C;font-weight:700}.dp-vm-check .nein{color:var(--muted)}'
      + '.dp-vm-profil .dp-vm-knoepfe{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}'
      + '@media (max-width:600px){.dp-vm-profil{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }

  /* ── Ansicht ──────────────────────────────────────────────────────── */
  function sektion() {
    var s = $(SEC_ID); if (s) return s;
    var mcol = document.querySelector('.main-col'); if (!mcol) return null;
    s = document.createElement('section'); s.className = 'sec'; s.id = SEC_ID;
    mcol.appendChild(s);
    stil();
    s.addEventListener('input', beiEingabe);
    s.addEventListener('change', beiAenderung);
    s.addEventListener('click', beiKlick);
    return s;
  }

  function opts(liste, akt) { return liste.map(function (k) { return '<option value="' + k[0] + '"' + (k[0] === akt ? ' selected' : '') + '>' + esc(k[1]) + '</option>'; }).join(''); }
  function zeile(liste, p, kats) {
    return '<tr data-liste="' + liste + '" data-id="' + esc(p.id) + '">'
      + '<td style="width:24%"><select data-feld="kat">' + opts(kats, p.kat) + '</select></td>'
      + '<td><input type="text" data-feld="name" value="' + esc(p.name || '') + '" placeholder="Bezeichnung"></td>'
      + '<td style="width:15%"><input type="text" inputmode="decimal" class="vm-betrag" data-feld="betrag" value="' + esc(eurFeld(betrag(p.betrag))) + '" placeholder="0"></td>'
      + '<td style="width:26%"><input type="text" data-feld="kommentar" value="' + esc(p.kommentar || '') + '" placeholder="Kommentar (z. B. endfällig 31.08.2029)"></td>'
      + '<td style="width:30px"><button type="button" class="vm-x" data-a="weg" title="Entfernen" aria-label="Entfernen">×</button></td></tr>';
  }
  function kacheln(S) {
    return '<div class="vm-kz">'
      + '<div><div class="l">Brutto-Vermögen</div><div class="v" data-s="brutto">' + eur(S.brutto) + '</div><div class="s">liquide ' + eur(S.liquide) + '</div></div>'
      + '<div><div class="l">Verbindlichkeiten</div><div class="v" data-s="schulden">' + eur(S.schulden) + '</div><div class="s">' + (S.ltv != null ? 'Beleihung ' + S.ltv.toFixed(1).replace('.', ',') + ' % des Brutto-Vermögens' : '–') + '</div></div>'
      + '<div><div class="l">Netto-Vermögen</div><div class="v ' + (S.netto >= 0 ? 'vm-pos' : 'vm-neg') + '" data-s="netto">' + eur(S.netto) + '</div><div class="s">Brutto − Verbindlichkeiten</div></div>'
      + '<div><div class="l">Überschuss / Monat</div><div class="v ' + (S.ueberschuss >= 0 ? 'vm-pos' : 'vm-neg') + '" data-s="ueberschuss">' + eur(S.ueberschuss) + '</div><div class="s">Haushaltsrechnung</div></div>'
      + '</div>';
  }
  function hinweisHtml() {
    var l = letzterStand();
    if (!l) return '<div class="vm-hinweis"><span><b>Empfehlung:</b> Speichere jeden Monat einen Stand – am besten zum Monatsanfang. So entsteht dein Verlauf, und der Track Record zeigt der Bank die Entwicklung.</span></div>';
    var t = tageSeit(l.datum);
    if (t != null && t > MONAT_TAGE) return '<div class="vm-hinweis"><span>Dein letzter Stand ist vom <b>' + datumDe(l.datum) + '</b> (' + t + ' Tage alt). Empfehlung: monatlich einen Stand speichern.</span><button type="button" class="btn btn-gold btn-sm" data-a="zum-stand">Stand jetzt speichern</button></div>';
    return '';
  }

  function render() {
    var s = sektion(); if (!s) return;
    var S = berechnen();
    var V = daten.posten.filter(function (p) { return p.art !== 'schuld'; }), SCH = daten.posten.filter(function (p) { return p.art === 'schuld'; });
    var E = daten.haushalt.filter(function (p) { return p.art !== 'aus'; }), A = daten.haushalt.filter(function (p) { return p.art === 'aus'; });
    var mw = daten.immo.wertansatz === 'marktwert';
    var immoHtml = (_objekte == null)
      ? '<p class="vm-leer">Objekte werden geladen …</p>'
      : (!_objekte.length ? '<p class="vm-leer">Noch keine Objekte im Bestand. Sobald ein Objekt auf „Gewonnen“ steht, erscheint es hier mit Wert und Restschuld.</p>'
        : '<div class="vm-scroll"><table class="vm-tab"><thead><tr><th style="width:40px">Mit</th><th>Objekt</th><th class="r">Wert</th><th class="r">Restschuld</th><th class="r">Eigenkapital</th></tr></thead><tbody>'
          + _objekte.map(function (o) {
            var an = daten.immo.aus.indexOf(String(o.key)) < 0;
            var w = mw && o.marktwert > 0 ? o.marktwert : o.kaufpreis;
            return '<tr><td><input type="checkbox" data-a="immo-mit" data-key="' + esc(o.key) + '"' + (an ? ' checked' : '') + ' style="width:auto"></td>'
              + '<td>' + esc(o.name) + (o.ort ? ' <span style="color:var(--muted)">· ' + esc(o.ort) + '</span>' : '') + (mw && !o.hatMarktwert ? ' <span style="color:var(--muted);font-size:11px">(kein Marktwert erfasst – Kaufpreis)</span>' : '') + '</td>'
              + '<td class="r num">' + eur(w) + '</td><td class="r num">' + eur(o.rest) + '</td><td class="r num">' + eur(w - (o.rest || 0)) + '</td></tr>';
          }).join('')
          + '<tr class="vm-summe"><td></td><td>Summe Immobilien</td><td class="r num">' + eur(S.immo) + '</td><td class="r num">' + eur(S.immoSchuld) + '</td><td class="r num">' + eur(S.immo - S.immoSchuld) + '</td></tr>'
          + '</tbody></table></div>');

    var verlauf = daten.staende.slice().sort(function (a, b) { return String(b.datum).localeCompare(String(a.datum)); });

    s.innerHTML = '<div class="vm-kopf"><div class="vm-kicker">Ansicht · Vermögen</div><h2>Vermögen &amp; Haushalt</h2>'
      + '<p>Deine Vermögensaufstellung und Haushaltsrechnung an einer Stelle – so, wie die Bank sie in der Selbstauskunft sehen will. Die Immobilien kommen automatisch aus deinen Objekten im Bestand, alles andere trägst du selbst ein. Mit „Stand speichern“ hältst du den Monat fest; daraus entsteht dein Verlauf.</p></div>'
      + hinweisHtml()
      + '<div data-s="kacheln">' + kacheln(S) + '</div>'

      + '<div class="card"><div class="ct">Vermögensaufstellung</div>'
      + '<h3 class="vm-h3" style="margin:4px 0 8px;font-size:13px">Immobilien <span class="vm-wa">Wertansatz <select data-a="wertansatz"><option value="kaufpreis"' + (mw ? '' : ' selected') + '>Kaufpreis (wie Vermögensbilanz im Cockpit)</option><option value="marktwert"' + (mw ? ' selected' : '') + '>Marktwert, wo erfasst</option></select></span></h3>'
      + immoHtml
      + '<h3 style="margin:18px 0 8px;font-size:13px">Weitere Vermögenswerte</h3>'
      + '<div class="vm-scroll"><table class="vm-tab"><thead><tr><th>Kategorie</th><th>Bezeichnung</th><th class="r">Wert</th><th>Kommentar</th><th></th></tr></thead><tbody>'
      + (V.length ? V.map(function (p) { return zeile('posten', p, KAT_V); }).join('') : '<tr><td colspan="5" class="vm-leer">Noch keine Posten – z. B. Girokonto, Tagesgeld, Depot, Altersvorsorge, Fahrzeug.</td></tr>')
      + '</tbody></table></div>'
      + '<button type="button" class="btn btn-outline btn-sm vm-add" data-a="neu-vermoegen">+ Vermögensposten</button>'
      + '<h3 style="margin:18px 0 8px;font-size:13px">Weitere Verbindlichkeiten <span style="font-weight:400;color:var(--muted)">(Immobiliendarlehen kommen aus den Objekten)</span></h3>'
      + '<div class="vm-scroll"><table class="vm-tab"><thead><tr><th>Kategorie</th><th>Bezeichnung</th><th class="r">Betrag</th><th>Kommentar</th><th></th></tr></thead><tbody>'
      + (SCH.length ? SCH.map(function (p) { return zeile('posten', p, KAT_S); }).join('') : '<tr><td colspan="5" class="vm-leer">Keine weiteren Verbindlichkeiten eingetragen.</td></tr>')
      + '</tbody></table></div>'
      + '<button type="button" class="btn btn-outline btn-sm vm-add" data-a="neu-schuld">+ Verbindlichkeit</button>'
      + '<div data-s="uebersicht" style="margin-top:16px">' + uebersichtHtml(S) + '</div>'
      + '</div>'

      + '<div class="card"><div class="ct">Haushaltsrechnung · monatlich</div>'
      + '<div class="vm-zwei"><div><h3 style="margin:4px 0 8px;font-size:13px">Einnahmen</h3><div class="vm-scroll"><table class="vm-tab" style="min-width:520px"><thead><tr><th>Kategorie</th><th>Bezeichnung</th><th class="r">€ / Monat</th><th>Kommentar</th><th></th></tr></thead><tbody>'
      + (E.length ? E.map(function (p) { return zeile('haushalt', p, KAT_E); }).join('') : '<tr><td colspan="5" class="vm-leer">Noch keine Einnahmen.</td></tr>')
      + '</tbody></table></div><button type="button" class="btn btn-outline btn-sm vm-add" data-a="neu-ein">+ Einnahme</button></div>'
      + '<div><h3 style="margin:4px 0 8px;font-size:13px">Ausgaben</h3><div class="vm-scroll"><table class="vm-tab" style="min-width:520px"><thead><tr><th>Kategorie</th><th>Bezeichnung</th><th class="r">€ / Monat</th><th>Kommentar</th><th></th></tr></thead><tbody>'
      + (A.length ? A.map(function (p) { return zeile('haushalt', p, KAT_A); }).join('') : '<tr><td colspan="5" class="vm-leer">Noch keine Ausgaben.</td></tr>')
      + '</tbody></table></div><button type="button" class="btn btn-outline btn-sm vm-add" data-a="neu-aus">+ Ausgabe</button></div></div>'
      + '<div data-s="haushalt" style="margin-top:14px">' + haushaltHtml(S) + '</div>'
      + '</div>'

      + '<div class="card" id="vm-stand-karte"><div class="ct">Stand speichern &amp; Verlauf</div>'
      + '<p class="hint">Hält die heutigen Summen mit Datum fest. Im Kommentar stehen die Maßnahmen des Monats, z. B. „Sanierung Dach, Ertragswert gestiegen“ oder „Tagesgeld in Eigenkapital für Objekt 3“. Empfehlung: einmal im Monat.</p>'
      + '<div class="vm-stand"><div class="f"><label>Datum</label><input type="date" id="vm-stand-datum" value="' + heute() + '"></div>'
      + '<div class="f"><label>Kommentar / Maßnahmen</label><textarea id="vm-stand-kommentar" rows="2" placeholder="z. B. Sanierung Dach, Ertragswert gestiegen"></textarea></div>'
      + '<div class="f"><button type="button" class="btn btn-gold" data-a="stand">Stand speichern</button></div></div>'
      + (verlauf.length >= 2 ? '<div class="vm-chart"><canvas id="vm-verlauf-chart" aria-label="Vermögensentwicklung"></canvas></div>' : (verlauf.length === 1 ? '<p class="vm-leer">Ab dem zweiten Stand erscheint hier die Grafik.</p>' : ''))
      + (verlauf.length ? '<div class="vm-scroll"><table class="vm-tab"><thead><tr><th>Datum</th><th class="r">Brutto</th><th class="r">Verbindl.</th><th class="r">Netto</th><th class="r">Liquide</th><th class="r">Überschuss / M.</th><th>Kommentar</th><th></th></tr></thead><tbody>'
        + verlauf.map(function (st) {
          var z = st.summen || {};
          return '<tr data-liste="staende" data-id="' + esc(st.id) + '"><td class="num">' + datumDe(st.datum) + '</td><td class="r num">' + eur(z.brutto) + '</td><td class="r num">' + eur(z.schulden) + '</td><td class="r num">' + eur(z.netto) + '</td><td class="r num">' + eur(z.liquide) + '</td><td class="r num">' + eur(z.ueberschuss) + '</td>'
            + '<td style="min-width:200px"><input type="text" data-feld="kommentar" value="' + esc(st.kommentar || '') + '" placeholder="Maßnahmen"></td>'
            + '<td style="width:30px"><button type="button" class="vm-x" data-a="weg" title="Stand löschen" aria-label="Stand löschen">×</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="vm-leer">Noch kein Stand gespeichert.</p>')
      + '</div>';
    if (verlauf.length >= 2) setTimeout(chartZeichnen, 30);
  }

  function uebersichtHtml(S) {
    return '<div class="vm-scroll"><table class="vm-tab" style="min-width:420px"><tbody>'
      + '<tr><td>Liquide Vermögensgegenstände</td><td class="r num">' + eur(S.liquide) + '</td></tr>'
      + '<tr><td>Nicht-liquide Vermögensgegenstände (Immobilien, Sonstiges)</td><td class="r num">' + eur(S.nichtLiquide) + '</td></tr>'
      + '<tr class="vm-summe"><td>Brutto-Vermögen</td><td class="r num">' + eur(S.brutto) + '</td></tr>'
      + '<tr><td>Immobiliendarlehen (Restschuld heute)</td><td class="r num">−' + eur(S.immoSchuld) + '</td></tr>'
      + '<tr><td>Weitere Verbindlichkeiten</td><td class="r num">−' + eur(S.schuldenPosten) + '</td></tr>'
      + '<tr class="vm-ende"><td>Netto-Vermögen</td><td class="r num">' + eur(S.netto) + '</td></tr></tbody></table></div>';
  }
  function haushaltHtml(S) {
    return '<div class="vm-scroll"><table class="vm-tab" style="min-width:420px"><tbody>'
      + '<tr><td>Einnahmen / Monat</td><td class="r num">' + eur(S.einnahmen) + '</td></tr>'
      + '<tr><td>Ausgaben / Monat</td><td class="r num">−' + eur(S.ausgaben) + '</td></tr>'
      + '<tr class="vm-ende"><td>Überschuss / Monat</td><td class="r num ' + (S.ueberschuss >= 0 ? 'vm-pos' : 'vm-neg') + '">' + eur(S.ueberschuss) + '</td></tr></tbody></table></div>';
  }
  function summenNeu() {
    var s = $(SEC_ID); if (!s) return;
    var S = berechnen();
    var k = s.querySelector('[data-s="kacheln"]'); if (k) k.innerHTML = kacheln(S);
    var u = s.querySelector('[data-s="uebersicht"]'); if (u) u.innerHTML = uebersichtHtml(S);
    var h = s.querySelector('[data-s="haushalt"]'); if (h) h.innerHTML = haushaltHtml(S);
  }

  var _chart = null;
  function chartZeichnen() {
    var cv = $('vm-verlauf-chart'); if (!cv || typeof window.Chart !== 'function') return;
    try { if (_chart) _chart.destroy(); } catch (e) {}
    var st = daten.staende.slice().sort(function (a, b) { return String(a.datum).localeCompare(String(b.datum)); });
    var gold = _wlc('#C9A84C');
    var mut = getComputedStyle(document.body).color || '#5F5E66';
    var reihe = function (k) { return st.map(function (x) { var v = x.summen && x.summen[k]; return (v == null || !isFinite(v)) ? null : Math.round(v); }); };
    _chart = new window.Chart(cv.getContext('2d'), {
      type: 'line',
      data: {
        labels: st.map(function (x) { return datumDe(x.datum); }),
        datasets: [
          { label: 'Brutto-Vermögen', data: reihe('brutto'), borderColor: gold, backgroundColor: gold, tension: 0.15, borderWidth: 2, pointRadius: 3 },
          { label: 'Liquides Vermögen', data: reihe('liquide'), borderColor: '#6E8FA8', backgroundColor: '#6E8FA8', tension: 0.15, borderWidth: 1.5, pointRadius: 2 },
          { label: 'Verbindlichkeiten', data: reihe('schulden'), borderColor: '#B8625C', backgroundColor: '#B8625C', borderDash: [6, 4], tension: 0.15, borderWidth: 1.8, pointRadius: 2 },
          { label: 'Netto-Vermögen', data: reihe('netto'), borderColor: '#3FA56C', backgroundColor: '#3FA56C', tension: 0.15, borderWidth: 2.4, pointRadius: 3 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { color: mut, boxWidth: 14 } },
          tooltip: { callbacks: {
            label: function (c) { return c.dataset.label + ': ' + eur(c.parsed.y); },
            afterBody: function (items) { var x = st[items[0].dataIndex]; return x && x.kommentar ? '\n' + x.kommentar : ''; }
          } }
        },
        scales: {
          y: { ticks: { color: mut, callback: function (v) { return Math.round(v / 1000).toLocaleString('de-DE') + ' T€'; } }, grid: { color: 'rgba(127,127,127,.15)' } },
          x: { ticks: { color: mut }, grid: { display: false } }
        }
      }
    });
  }

  /* ── Bedienung ────────────────────────────────────────────────────── */
  function finde(liste, id) {
    var a = daten[liste] || [];
    for (var i = 0; i < a.length; i++) if (String(a[i].id) === String(id)) return a[i];
    return null;
  }
  function beiEingabe(e) {
    var t = e.target, tr = t && t.closest && t.closest('tr[data-liste]'), f = t && t.getAttribute && t.getAttribute('data-feld');
    if (!tr || !f) return;
    var p = finde(tr.getAttribute('data-liste'), tr.getAttribute('data-id')); if (!p) return;
    p[f] = f === 'betrag' ? betrag(t.value) : t.value;
    speichern();
    if (f === 'betrag' && tr.getAttribute('data-liste') !== 'staende') summenNeu();
  }
  function beiAenderung(e) {
    var t = e.target; if (!t) return;
    var a = t.getAttribute && t.getAttribute('data-a');
    if (a === 'wertansatz') { daten.immo.wertansatz = t.value === 'marktwert' ? 'marktwert' : 'kaufpreis'; speichern(); render(); return; }
    if (a === 'immo-mit') {
      var k = String(t.getAttribute('data-key')), i = daten.immo.aus.indexOf(k);
      if (t.checked && i >= 0) daten.immo.aus.splice(i, 1);
      if (!t.checked && i < 0) daten.immo.aus.push(k);
      speichern(); render(); return;
    }
    if (t.getAttribute('data-feld') === 'kat') { beiEingabe(e); return; }
    if (t.getAttribute('data-feld') === 'betrag') { t.value = eurFeld(betrag(t.value)); }
  }
  function beiKlick(e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-a]') : null; if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'neu-vermoegen') { daten.posten.push({ id: neueId(), art: 'vermoegen', kat: 'bank', name: '', betrag: null, kommentar: '' }); speichern(); render(); fokusLetzte('posten'); }
    else if (a === 'neu-schuld') { daten.posten.push({ id: neueId(), art: 'schuld', kat: 'privat', name: '', betrag: null, kommentar: '' }); speichern(); render(); fokusLetzte('posten'); }
    else if (a === 'neu-ein') { daten.haushalt.push({ id: neueId(), art: 'ein', kat: 'gehalt', name: '', betrag: null, kommentar: '' }); speichern(); render(); fokusLetzte('haushalt'); }
    else if (a === 'neu-aus') { daten.haushalt.push({ id: neueId(), art: 'aus', kat: 'wohnen', name: '', betrag: null, kommentar: '' }); speichern(); render(); fokusLetzte('haushalt'); }
    else if (a === 'weg') {
      var tr = b.closest('tr[data-liste]'); if (!tr) return;
      var liste = tr.getAttribute('data-liste'), id = tr.getAttribute('data-id');
      if (liste === 'staende' && !confirm('Diesen gespeicherten Stand löschen?')) return;
      daten[liste] = (daten[liste] || []).filter(function (p) { return String(p.id) !== String(id); });
      speichern(); render();
    }
    else if (a === 'stand') standSpeichern();
    else if (a === 'zum-stand') { var k = $('vm-stand-karte'); if (k) k.scrollIntoView({ behavior: 'smooth', block: 'start' }); var c = $('vm-stand-kommentar'); if (c) setTimeout(function () { c.focus(); }, 400); }
  }
  function fokusLetzte(liste) {
    var s = $(SEC_ID); if (!s) return;
    var rows = s.querySelectorAll('tr[data-liste="' + liste + '"]'); var r = rows[rows.length - 1];
    var i = r && r.querySelector('input[data-feld="name"]'); if (i) i.focus();
  }
  function standSpeichern() {
    var dIn = $('vm-stand-datum'), kIn = $('vm-stand-kommentar');
    var datum = (dIn && /^\d{4}-\d{2}-\d{2}$/.test(dIn.value)) ? dIn.value : heute();
    var S = berechnen();
    var summen = {};
    ['brutto', 'liquide', 'nichtLiquide', 'immo', 'immoSchuld', 'schuldenPosten', 'schulden', 'netto', 'ltv', 'einnahmen', 'ausgaben', 'ueberschuss'].forEach(function (k) { summen[k] = S[k] == null ? null : Math.round(S[k] * 100) / 100; });
    var zeilen = S.immoListe.map(function (x) { return { art: 'immo', name: x.name, wert: x.wert, rest: x.rest }; })
      .concat(daten.posten.map(function (p) { return { art: p.art === 'schuld' ? 'schuld' : 'vermoegen', kat: p.kat, name: p.name, betrag: betrag(p.betrag) }; }));
    /* Ein Stand je Datum: am selben Tag ersetzt der neue den alten. */
    var alt = daten.staende.filter(function (x) { return x.datum === datum; })[0];
    var st = { id: alt ? alt.id : neueId(), datum: datum, kommentar: (kIn && kIn.value.trim()) || (alt && alt.kommentar) || '', summen: summen, zeilen: zeilen, wertansatz: daten.immo.wertansatz };
    daten.staende = daten.staende.filter(function (x) { return x.datum !== datum; }).concat([st]);
    speichern(); render();
    toast('✓ Stand vom ' + datumDe(datum) + ' gespeichert');
  }

  /* ── Hauptansicht öffnen / schließen ─────────────────────────────── */
  function oeffnen() {
    var s = sektion(); if (!s) return;
    try { if (window._currentObjKey && typeof window.saveObj === 'function') window.saveObj({ silent: true }); } catch (e) {}
    /* Alle anderen Hauptansichten über das Register schliessen (ui.js DealPilotAnsichten, v1905) */
    if (window.DealPilotAnsichten) window.DealPilotAnsichten.abraeumen('vermoegen');
    else {
      var tb = document.querySelector('.tabs'); if (tb) tb.style.display = 'none';
      document.querySelectorAll('.sec').forEach(function (x) { if (x.id !== SEC_ID) x.style.display = 'none'; });
    }
    document.documentElement.setAttribute('data-vm-offen', '1');
    s.style.display = 'block';
    render();
    laden().then(function () { render(); return objekteLaden(true); }).then(function () { render(); });
    try { var mc = document.querySelector('.main-col'); if (mc) mc.scrollTop = 0; window.scrollTo(0, 0); } catch (e) {}
  }
  function schliessen() {
    if (document.documentElement.getAttribute('data-vm-offen') !== '1') return;
    document.documentElement.removeAttribute('data-vm-offen');
    try { if (_chart) { _chart.destroy(); _chart = null; } } catch (e) {}
    var tabs = document.querySelector('.tabs'); if (tabs) tabs.style.display = '';
  }
  window.addEventListener('dp:object-ready', schliessen);
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('.sb-card, .sb-act-item') : null;
    if (t && (t.getAttribute('data-act') || '') !== 'vermoegen') schliessen();
  }, true);
  if (window.DealPilotAnsichten) window.DealPilotAnsichten.melde('vermoegen', schliessen);

  /* ── Hinweis: letzter Stand älter als 31 Tage (einmal am Tag, nur in der App) ── */
  function erinnern() {
    laden().then(function () {
      var t = standAlt(); if (!t) return;
      var s = ls(), k = 'dp_vermoegen_hinweis_tag:' + (uid || 'lokal'), h = heute();
      try { if (s && s.getItem(k) === h) return; if (s) s.setItem(k, h); } catch (e) {}
      toast('Dein letzter Vermögensstand ist ' + t + ' Tage alt – Empfehlung: monatlich speichern (Ansichten › Vermögen & Haushalt).');
    });
  }

  /* ── W-5 · Mein Profil: Foto und Checkliste ───────────────────────── */
  function settingsObj() { try { return window.Settings && Settings.get ? Settings.get() : {}; } catch (e) { return {}; } }
  function foto() { var s = settingsObj(); return s && typeof s.user_foto_b64 === 'string' && s.user_foto_b64.indexOf('data:image') === 0 ? s.user_foto_b64 : null; }
  function checkliste() {
    return [
      { k: 'foto', t: 'Foto', ok: !!foto() },
      { k: 'vermoegen', t: 'Vermögensaufstellung', ok: daten.posten.length > 0 || daten.staende.length > 0 },
      { k: 'haushalt', t: 'Haushaltsrechnung', ok: daten.haushalt.some(function (p) { return (betrag(p.betrag) || 0) > 0; }) }
    ];
  }
  /* Quadratisch zuschneiden und verkleinern - das Foto reist im Konto mit (Grenze 190 KB, konto-stammdaten.js) */
  function quadrat(src, px) {
    return new Promise(function (ok, nein) {
      var img = new Image();
      img.onload = function () {
        var m = Math.min(img.naturalWidth, img.naturalHeight); if (!m) return nein(new Error('leer'));
        var c = document.createElement('canvas'); c.width = px; c.height = px;
        c.getContext('2d').drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, px, px);
        ok(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = nein; img.src = src;
    });
  }
  function profilHtml() {
    var f = foto(), L = checkliste();
    return '<div class="dp-vm-foto"' + (f ? ' style="background-image:url(\'' + f + '\')"' : '') + '>' + (f ? '' : 'kein Foto') + '</div>'
      + '<div><h3 class="ip-section" style="margin-top:0">Dein Profil für Track Record und Bank</h3>'
      + '<p class="hint">Foto, Vermögensaufstellung und Haushaltsrechnung sind wichtig für deinen Track Record und die Bank – keine Pflicht. Das Foto steht auf dem Deckblatt des Track Records.</p>'
      + '<ul class="dp-vm-check">' + L.map(function (x) { return '<li><span class="' + (x.ok ? 'ok' : 'nein') + '">' + (x.ok ? '✓' : '○') + '</span>' + esc(x.t) + '</li>'; }).join('') + '</ul>'
      + '<div class="dp-vm-knoepfe"><label class="btn btn-outline btn-sm" style="cursor:pointer">Foto hochladen<input type="file" accept="image/*" data-vm="foto" style="display:none"></label>'
      + (f ? '<button type="button" class="btn btn-outline btn-sm" data-vm="foto-weg">Foto entfernen</button>' : '')
      + '<button type="button" class="btn btn-gold btn-sm" data-vm="oeffnen">Vermögen &amp; Haushalt öffnen</button></div></div>';
  }
  function profilEinbauen() {
    var pane = document.querySelector('#settings-modal .st-pane[data-pane="standardwerte"]');
    if (!pane) return;
    stil();
    var box = pane.querySelector('.dp-vm-profil');
    if (!box) {
      box = document.createElement('div'); box.className = 'dp-vm-profil';
      pane.insertBefore(box, pane.firstChild);
      box.addEventListener('change', function (e) {
        var inp = e.target; if (!inp || inp.getAttribute('data-vm') !== 'foto' || !inp.files || !inp.files[0]) return;
        var f = inp.files[0];
        if (f.size > 8 * 1024 * 1024) { toast('Bild zu groß (max. 8 MB)'); return; }
        var r = new FileReader();
        r.onload = function () {
          quadrat(r.result, 360).then(function (klein) {
            var s = settingsObj(); s.user_foto_b64 = klein;
            try { Settings.save(s); } catch (x) {}
            try { if (window._SetDraft && window._SetDraft.current) window._SetDraft.current.user_foto_b64 = klein; } catch (x) {}
            box.innerHTML = profilHtml(); toast('✓ Profilfoto gespeichert');
          }).catch(function () { toast('⚠ Bild konnte nicht gelesen werden'); });
        };
        r.readAsDataURL(f);
      });
      box.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-vm]') : null; if (!b) return;
        var a = b.getAttribute('data-vm');
        if (a === 'foto-weg') {
          var s = settingsObj(); delete s.user_foto_b64; try { Settings.save(s); } catch (x) {}
          try { if (window._SetDraft && window._SetDraft.current) delete window._SetDraft.current.user_foto_b64; } catch (x) {}
          box.innerHTML = profilHtml();
        } else if (a === 'oeffnen') {
          try { if (typeof window.closeSettings === 'function') window.closeSettings(); } catch (x) {}
          setTimeout(oeffnen, 120);
        }
      });
    }
    box.innerHTML = profilHtml();
    laden().then(function () { if (document.body.contains(box)) box.innerHTML = profilHtml(); });
  }
  function settingsHaken() {
    if (typeof window.showSettings !== 'function' || window.showSettings._vm) return false;
    var orig = window.showSettings;
    var neu = function () { var r = orig.apply(this, arguments); try { profilEinbauen(); } catch (e) { console.warn('[vermoegen] Profil', e); } return r; };
    neu._vm = true;
    Object.keys(orig).forEach(function (k) { if (!(k in neu)) neu[k] = orig[k]; });
    window.showSettings = neu;
    return true;
  }

  /* ── Für den Track Record (dp-dokumente.js, track-record.js) ───────── */
  /** → Promise { daten, S, foto, name, hatDaten } - S mit den Immobilien von heute */
  function fuerDokument() {
    return laden().then(function () { return objekteLaden(true); }).then(function () {
      var S = berechnen();
      var st = settingsObj();
      return { daten: daten, S: S, foto: foto(), name: (st && st.user_name) || '', hatDaten: gefuellt(daten), KAT_V: KAT_V, KAT_S: KAT_S, KAT_E: KAT_E, KAT_A: KAT_A, katName: katName, betrag: betrag };
    });
  }

  window.DpVermoegen = {
    oeffnen: oeffnen, schliessen: schliessen, laden: laden, daten: function () { return daten; },
    berechnen: berechnen, objekteLaden: objekteLaden, fuerDokument: fuerDokument,
    foto: foto, checkliste: checkliste, standAlt: standAlt, betrag: betrag, katName: katName,
    KAT_V: KAT_V, KAT_S: KAT_S, KAT_E: KAT_E, KAT_A: KAT_A
  };
  window.openVermoegen = oeffnen;

  /* Einhängen: Einstellungen (Mein Profil), Laden nach Anmeldung, Erinnerung */
  var versuche = 0;
  (function haken() { if (!settingsHaken() && !(window.showSettings && window.showSettings._vm) && versuche++ < 40) setTimeout(haken, 250); })();
  /* laden() erkennt den Kontowechsel selbst (uid) - hier nur die Erinnerung nach der Anmeldung */
  window.addEventListener('dp:plan-ready', function () { try { setTimeout(erinnern, 4000); } catch (e) {} });
  if (document.readyState === 'complete') setTimeout(erinnern, 6000);
  else window.addEventListener('load', function () { setTimeout(erinnern, 6000); });
})();
