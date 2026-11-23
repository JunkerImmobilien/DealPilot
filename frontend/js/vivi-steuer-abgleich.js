/* ═══ js/vivi-steuer-abgleich.js — v4020 · STEUERJAHRE AUS VIVI: ABGLEICH, ÜBERNEHMEN, AUTOMATISCH ════════════
 *
 * Marcel 23.11.2026: „Wo wir den API-Key für ViVi eingeben, auch Einstellungen: auswählen, ob die Belege automatisch
 * in die Steuerjahre geschrieben werden … Bei Einsteigern gar nicht anbieten. Eine Übersicht in der Pilot-Analyse, wo
 * wir die Abgleiche mit ViVi sehen, welche Werte für das jeweilige Jahr eingetragen werden sollen … Einstellungen,
 * weil es Sachen gibt, die wir nicht wollen.“
 *
 * Woher die Werte kommen: das Backend liest je Objekt und Jahr die Anlage V aus ViVi (GET /tax-overview, mit &line= die
 * Belege einer Zeile mit Datum und Betrag, services/vivi/viviSteuer.js) und legt sie in vivi_werte (jahr > 0). GET
 * /vivi/objekt/:id/werte liefert sie als stand.steuer[jahr][spalte] = { summe, zeile, label, kat, art, posten }.
 * js/vivi.js meldet jeden neuen Stand mit dem Ereignis 'dp:vivi-stand'.
 *
 * Regeln (Kern jahrAbgleich, geprueft in tools/vivi-pruefen.mjs Teil T):
 *   · Kategorie abgewaehlt: Zeile erscheint nicht, wird nie geschrieben.
 *   · Belegzeilen (Erhaltung, Betriebskosten, nicht umgelegt, sonstige, bewegliche WG): nur Posten, die in DealPilot noch
 *     nicht als Beleg erfasst sind (gleicher Betrag, gleiches Datum, _dok_eingang.buchungen). Uebernehmen ADDIERT wie der
 *     Beleg-Import (dpWkUebernehmen) und merkt jeden Posten als Buchung mit Quelle ViVi, so kommt nichts doppelt.
 *     Ersetzt die Uebernahme eine Schaetzung der App (kein eigener Wert, Schaetzung > 0), geschieht das nie automatisch.
 *   · Summenzeilen (Mieteinnahmen, NK-Vorauszahlungen, Schuldzinsen): Jahressumme gegen DealPilot. Ein Jahr, das noch
 *     laeuft, nur zum Ansehen (ViVi kennt erst die Monate bis heute).
 *   · AfA: nur Vergleich, DealPilot rechnet sie selbst.
 *   · Steuerstand „erklärt“ oder „Bescheid“ (_jahre[J].steuer_status) und festgeschriebene Steuer (_jahre[J].fest.steuer):
 *     nie automatisch. Die Abweichung steht da, Uebernehmen von Hand fragt nach (DpJahresbuch.aenderungErlaubt).
 *   · Einstellung „automatisch“ schreibt nur offene Jahre und nur gewaehlte Kategorien. Einsteiger: kein Angebot.
 *
 * Herkunft: jeder uebernommene Wert traegt in _dok_eingang.herkunft die Quelle 'ViVi' mit Datum. Der Reiter Steuer zeigt
 * am Feld die Marke „ViVi“, solange der Wert noch der uebernommene ist.
 * Kundentexte ohne Gedankenstrich und Semikolon, keine Datenquellennamen ausser ViVi.
 * ═════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  var VERSION = 'v4021';

  /* ══ KERN (ohne DOM, auch fuer Node) ══════════════════════════════════════════════════════════════════ */
  var REIHE = ['einnahmen_km', 'einnahmen_nk', 'schuldzinsen', 'erhaltungsaufwand', 'nk_umlf', 'nk_n_umlf', 'sonst_kosten', 'sonst_bewegl_wg', 'afa'];
  var NAMEN = { einnahmen_km: 'Mieteinnahmen', einnahmen_nk: 'Umgelegte Nebenkosten', schuldzinsen: 'Schuldzinsen', erhaltungsaufwand: 'Erhaltungsaufwand',
    nk_umlf: 'Umgelegte Betriebskosten', nk_n_umlf: 'Nicht umgelegte Kosten', sonst_kosten: 'Sonstige Werbungskosten', sonst_bewegl_wg: 'Bewegliche Wirtschaftsgüter', afa: 'AfA Gebäude' };
  function istZahl(v) { return typeof v === 'number' && isFinite(v); }
  function r2(n) { return Math.round(n * 100) / 100; }
  function gleicherPosten(p, b) {
    return !!(p && b && p.datum && b.datum && String(b.datum).slice(0, 10) === p.datum && istZahl(Number(b.betrag)) && Math.abs(Math.abs(Number(b.betrag)) - p.betrag) < 0.005);
  }
  function gesperrt(status, fest) { return status === 'erklaert' || status === 'bescheid' || !!fest; }

  /**
   * Abgleich eines Jahres. vivi = stand.steuer[jahr]. ctx = {
   *   jahr, heuteJahr, einstellung: {modus, kategorien}, einsteiger,
   *   dp(spalte) -> { wert, eigen } | null (null = Jahr nicht in der Zeitleiste des Reiters Steuer),
   *   buchungen: [{ feld, betrag, datum }]   (in DealPilot erfasste Belege, alle Jahre),
   *   status: 'geplant' | 'erklaert' | 'bescheid', fest: bool }
   * Rueckgabe { jahr, zeilen: [...], abgewaehlt, gesperrt, laufend, auto: [zeilen fuer automatisch], offen: Anzahl uebernehmbar }
   */
  function jahrAbgleich(vivi, ctx) {
    ctx = ctx || {};
    var e = ctx.einstellung || { modus: 'vorschlag', kategorien: {} };
    var kat = e.kategorien || {};
    var laufend = ctx.jahr >= ctx.heuteJahr;
    var sperre = gesperrt(ctx.status, ctx.fest);
    var frei = (ctx.buchungen || []).slice();
    var out = { jahr: ctx.jahr, zeilen: [], abgewaehlt: 0, gesperrt: sperre, laufend: laufend, auto: [], offen: 0, status: ctx.status || 'geplant', fest: !!ctx.fest };
    if (!vivi || typeof vivi !== 'object' || e.modus === 'aus') return out;
    var spalten = Object.keys(vivi).sort(function (a, b) { var x = REIHE.indexOf(a), y = REIHE.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
    spalten.forEach(function (sp) {
      var v = vivi[sp]; if (!v || !istZahl(v.summe)) return;
      if (v.kat && kat[v.kat] === false) { out.abgewaehlt++; return; }
      var d = typeof ctx.dp === 'function' ? ctx.dp(sp) : null;
      var z = { spalte: sp, label: NAMEN[sp] || v.label || sp, zeile: v.zeile, kat: v.kat, art: v.art, vivi: v.summe, dp: d ? d.wert : null, dpEigen: !!(d && d.eigen),
        neu: [], erfasst: [], abw: null, wert: null, modus: null, aktion: 'gleich', grund: '', gekuerzt: +v.posten_gekuerzt || 0 };
      if (!d) { z.aktion = 'ausserhalb'; z.grund = 'Das Jahr steht nicht in der Zeitleiste des Reiters Steuer.'; out.zeilen.push(z); return; }
      if (v.art === 'vergleich') {
        z.abw = r2(v.summe - (d.wert || 0)); z.aktion = 'vergleich'; z.grund = 'DealPilot rechnet die AfA selbst. ViVi steht zum Vergleich daneben.';
      } else if (v.art === 'summe') {
        z.abw = Math.round(v.summe) - Math.round(d.wert || 0);
        if (Math.abs(z.abw) < 1) z.aktion = 'gleich';
        else if (laufend) { z.aktion = 'laufend'; z.grund = 'Das Jahr läuft noch. ViVi kennt erst die Buchungen bis heute, DealPilot rechnet das ganze Jahr.'; }
        else { z.aktion = 'uebernehmen'; z.modus = 'setzen'; z.wert = v.summe; }
      } else {
        if (!Array.isArray(v.posten)) {
          z.abw = r2(v.summe - (d.wert || 0)); z.aktion = 'ohne_posten'; z.grund = 'ViVi hat die Belege dieser Zeile nicht einzeln geliefert. Ohne Datum lässt sich nicht prüfen, was schon erfasst ist.';
        } else {
          v.posten.forEach(function (p) {
            var i = -1;
            frei.some(function (b, k) { if (gleicherPosten(p, b)) { i = k; return true; } return false; });
            if (i >= 0) { z.erfasst.push(p); frei.splice(i, 1); } else z.neu.push(p);
          });
          z.abw = r2(z.neu.reduce(function (s, p) { return s + p.betrag; }, 0));
          if (z.neu.length && z.abw > 0) {
            z.aktion = 'uebernehmen'; z.modus = 'addieren'; z.wert = z.abw;
            /* ohne eigenen Wert ersetzt dpWkUebernehmen die Schaetzung der App: das entscheidet der Nutzer, nie der Automat */
            z.ersetztSchaetzung = !z.dpEigen && (d.wert || 0) > 0.5;
          }
        }
      }
      if (z.aktion === 'uebernehmen') {
        out.offen++;
        if (e.modus === 'automatisch' && !ctx.einsteiger && !sperre && !z.ersetztSchaetzung) out.auto.push(z);
      }
      out.zeilen.push(z);
    });
    return out;
  }

  var KERN = { VERSION: VERSION, NAMEN: NAMEN, REIHE: REIHE, jahrAbgleich: jahrAbgleich, gleicherPosten: gleicherPosten, gesperrt: gesperrt };
  if (typeof module !== 'undefined' && module.exports) module.exports = KERN;
  if (typeof document === 'undefined' || !global.document) { global.DpViviSteuerKern = KERN; return; }

  /* ══ BROWSER ══════════════════════════════════════════════════════════════════════════════════════════ */
  if (global.DpViviSteuer) return;
  var doc = global.document;
  var _stand = null, _key = null, _einst = null, _einstP = null, _kategorien = null, _autoGelaufen = {};

  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* v4021 · gemessen 1179: „1.878,6 €“. Cent immer zweistellig, ganze Euro ohne Nachkommastellen */
  function eur(v) { if (!istZahl(v)) return 'kein Wert'; var c = Math.abs(v - Math.round(v)) >= 0.005; return v.toLocaleString('de-DE', { minimumFractionDigits: c ? 2 : 0, maximumFractionDigits: 2 }) + ' €'; }
  function vz(v) { return istZahl(v) ? (v > 0 ? '+' : v < 0 ? '−' : '±') + eur(Math.abs(v)) : ''; }
  function datumText(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function heuteJahr() { return new Date().getFullYear(); }
  function api(pfad, opt) { return global.Auth && global.Auth.apiCall ? global.Auth.apiCall(pfad, opt || { method: 'GET' }) : Promise.reject(new Error('Nicht angemeldet')); }
  function meldung(t) { try { if (global.toast) global.toast(t); } catch (e) {} }
  function einsteiger() { try { return !!(global.DpDetailgrad && global.DpDetailgrad.stufe() === 1); } catch (e) { return false; } }
  function frei() { return global.DpVorschau && global.DpVorschau.frei ? global.DpVorschau.frei('vivi').catch(function () { return false; }) : Promise.resolve(false); }

  function einstellung(neu) {
    if (_einstP && !neu) return _einstP;
    _einstP = api('/vivi/steuer-einstellung').then(function (r) { _einst = (r && r.einstellung) || null; _kategorien = (r && r.kategorien) || []; return _einst; })
      .catch(function () { _einstP = null; return null; });
    return _einstP;
  }
  function aktuelleEinstellung() { return (_stand && _stand.steuer_einstellung) || _einst || { modus: 'vorschlag', kategorien: {} }; }

  /* ── Lesen aus der laufenden App ───────────────────────────────── */
  function jahreReiter() { try { return typeof global.dpWkJahre === 'function' ? global.dpWkJahre() : []; } catch (e) { return []; } }
  function dpStand(jahr) {
    var J = jahreReiter();
    return function (sp) {
      if (J.indexOf(jahr) < 0 || typeof global.dpWkStand !== 'function') return null;
      var s = global.dpWkStand(jahr, sp) || {};
      if (s.override != null) return { wert: s.override, eigen: true };
      return { wert: istZahl(s.auto) ? s.auto : 0, eigen: false };
    };
  }
  function eingang() { try { return global.DpEingang && global.DpEingang.lesen ? global.DpEingang.lesen() : null; } catch (e) { return null; } }
  function ctxFuer(jahr) {
    var JB = global.DpJahresbuch, E = eingang();
    return { jahr: jahr, heuteJahr: heuteJahr(), einstellung: aktuelleEinstellung(), einsteiger: einsteiger(), dp: dpStand(jahr),
      buchungen: (E && E.buchungen) || [], status: JB && JB.status ? JB.status(jahr) : 'geplant', fest: !!(JB && JB.fest && JB.fest(jahr).steuer) };
  }
  function abgleich(jahr) { return jahrAbgleich(_stand && _stand.steuer ? _stand.steuer[jahr] : null, ctxFuer(jahr)); }
  function jahreViVi() { return Object.keys((_stand && _stand.steuer) || {}).map(Number).filter(function (j) { return j > 0; }).sort(); }
  function aktiv() { return !!(_stand && _stand.verknuepft && _stand.steuer && aktuelleEinstellung().modus !== 'aus' && !einsteiger()); }

  /* ── Schreiben ─────────────────────────────────────────────────── */
  function herkunftViVi(jahr, spalten) {
    var f = $('_dok_eingang'); if (!f) return;
    var o = eingang() || { herkunft: {}, verlauf: [] }, k = 'y' + jahr, ov = (global._taxYearlyOverrides || {})[k] || {};
    var am = new Date().toISOString().slice(0, 10), stand = _stand && _stand.steuer_stand ? String(_stand.steuer_stand).slice(0, 10) : am;
    o.herkunft[k] = o.herkunft[k] || {};
    spalten.forEach(function (sp) { if (istZahl(ov[sp])) o.herkunft[k][sp] = { quelle: 'ViVi', dok: 'ViVi', am: am, stand: stand, betrag: Math.round(ov[sp]) }; });
    f.value = JSON.stringify(o);
    try { f.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  /** Zeilen eines Jahres uebernehmen. auto: ohne Rueckfrage (nur offene Jahre, vom Kern gefiltert). Rueckgabe Anzahl. */
  function uebernehmen(jahr, zeilen, auto) {
    zeilen = (zeilen || []).filter(function (z) { return z && z.aktion === 'uebernehmen'; });
    if (!zeilen.length) return 0;
    var JB = global.DpJahresbuch;
    if (auto) { var c = ctxFuer(jahr); if (gesperrt(c.status, c.fest) || c.einsteiger) return 0; }
    else if (JB && JB.aenderungErlaubt && !JB.aenderungErlaubt(jahr, 'steuer')) return 0;
    var E = global.DpEingang, n = 0, buch = [], txt = [], spalten = [];
    try { if (E && E.txStart) E.txStart(); } catch (e) {}
    zeilen.forEach(function (z) {
      var ok = false;
      if (z.modus === 'addieren' && typeof global.dpWkUebernehmen === 'function') {
        var p = {}; p[z.spalte] = z.wert;
        var r = global.dpWkUebernehmen(jahr, p);
        ok = !!(r && r.ok);
        if (ok) z.neu.forEach(function (x) { buch.push({ jahr: jahr, feld: z.spalte, betrag: x.betrag, datum: x.datum || '', position: x.text || '', aussteller: '', datei: 'ViVi', kategorie: z.label, quelle: 'ViVi' }); });
      } else if (z.modus === 'setzen' && typeof global.dpSteuerSetzen === 'function') {
        ok = !!global.dpSteuerSetzen(jahr, z.spalte, z.wert);
      }
      if (ok) { n++; spalten.push(z.spalte); txt.push('Steuer ' + jahr + ' · ' + z.label + ': ' + (z.modus === 'addieren' ? vz(z.wert) + ' aus ' + z.neu.length + ' Beleg' + (z.neu.length === 1 ? '' : 'en') : eur(z.wert)) + ' aus ViVi'); }
    });
    var aend = []; try { if (E && E.txEnde) aend = E.txEnde(); } catch (e) {}
    if (!n) return 0;
    try { if (E && E.protokoll) E.protokoll({ quelle: auto ? 'ViVi automatisch' : 'ViVi', aenderungen: aend, buchungen: buch, dokumente: [{ name: 'ViVi Steuerjahr ' + jahr, typ: 'ViVi' }], uebernommen: txt }); } catch (e) {}
    herkunftViVi(jahr, spalten);
    try { if (global.DpSpeichernFolge) global.DpSpeichernFolge(); else if (typeof global.saveObj === 'function') global.saveObj({ silent: true }); } catch (e) {}
    setTimeout(neuZeichnen, 80);
    return n;
  }
  /** „automatisch“: alle offenen Jahre, gewaehlte Kategorien. Einmal je Objekt und Stand. */
  function automatisch() {
    if (!aktiv() || aktuelleEinstellung().modus !== 'automatisch') return 0;
    if (!jahreReiter().length) { setTimeout(automatisch, 1500); return 0; }   /* Zeitleiste des Reiters Steuer noch nicht gerechnet */
    var merk = _key + '|' + (_stand.steuer_stand || '');
    if (_autoGelaufen[merk]) return 0;
    _autoGelaufen[merk] = true;
    var n = 0;
    jahreViVi().forEach(function (j) { var a = abgleich(j); if (a.auto.length) n += uebernehmen(j, a.auto, true); });
    if (n) meldung(n + ' Steuerwert' + (n === 1 ? '' : 'e') + ' aus ViVi übernommen');
    return n;
  }

  /* ── Stil ──────────────────────────────────────────────────────── */
  function stil() {
    if ($('vst-stil')) return;
    var s = doc.createElement('style'); s.id = 'vst-stil';
    s.textContent = [
      '.vst{margin:14px 0;border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 35%, transparent);border-radius:12px;padding:12px 14px;font:400 12.5px/1.45 Inter,system-ui,sans-serif;background:#fff}',
      '.vst-kopf{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-bottom:6px}',
      '.vst-kopf b{font:600 14px/1.3 "Space Grotesk",Inter,sans-serif}',
      '.vst-marke{font:600 10px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370}',
      '.vst-satz{color:#5E5856;margin:0 0 8px}',
      '.vst-sperre{border-left:3px solid var(--wl-c9a84c, #C9A84C);padding:5px 9px;margin:6px 0 8px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 7%, transparent)}',
      '.vst table{width:100%;border-collapse:collapse}',
      '.vst th{font:600 9.5px/1.2 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#7A7370;text-align:right;padding:5px 6px;border-bottom:1px solid rgba(42,39,39,.12)}',
      '.vst th:first-child,.vst td:first-child{text-align:left}',
      '.vst td{padding:6px;border-bottom:1px solid rgba(42,39,39,.07);text-align:right;vertical-align:top;font-variant-numeric:tabular-nums}',
      '.vst td small{display:block;color:#7A7370;font-size:11px;text-align:inherit}',
      '.vst .vst-ab{color:#B8625C;font-weight:600}.vst .vst-ok{color:#3FA56C}',
      '.vst .vst-posten{margin:3px 0 0;padding:0;list-style:none;font-size:11.5px;color:#5E5856;text-align:left}',
      '.vst button.vst-k{font:600 11.5px/1.2 Inter,sans-serif;padding:4px 9px;border-radius:7px;border:1px solid var(--wl-c9a84c, #C9A84C);background:transparent;color:inherit;cursor:pointer;white-space:nowrap}',
      '.vst button.vst-k.gold{background:var(--wl-c9a84c, #C9A84C);color:#050505}',
      '.vst-fuss{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:8px;color:#7A7370;font-size:11.5px}',
      '.vst-fuss span{flex:1 1 220px}',
      '.vst-jahre{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}',
      '.vst-jahre button{border:1px solid rgba(42,39,39,.18);background:transparent;border-radius:14px;padding:3px 10px;font:500 11.5px Inter,sans-serif;cursor:pointer;color:inherit}',
      '.vst-jahre button i{font-style:normal;color:#B8625C;margin-left:4px}',
      '.vivi-st-marke{display:inline-block;margin-left:4px;font:600 8.5px/1.5 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.06em;padding:0 4px;border-radius:4px;border:1px solid var(--wl-c9a84c, #C9A84C);color:var(--wl-b8932f, #b8932f);vertical-align:middle;cursor:help}',
      '@media (max-width:640px){.vst{padding:10px}.vst th:nth-child(2),.vst td:nth-child(2){display:none}.vst td,.vst th{padding:5px 3px}}'
    ].join('');
    doc.head.appendChild(s);
  }

  /* ── Karte im Jahresabgleich (Pilot-Analyse) ────────────────────── */
  function modusText(m) { return m === 'automatisch' ? 'Neue Werte gehen automatisch in offene Steuerjahre' : 'Neue Werte erscheinen als Vorschlag'; }
  function zeileHtml(jahr, z, i, sperre) {
    var dpT = istZahl(z.dp) ? eur(z.dp) + (z.art !== 'vergleich' && !z.dpEigen ? '<small>Schätzung der App</small>' : '') : 'nicht im Reiter Steuer';
    var abwT = '', kn = '';
    if (z.aktion === 'gleich') abwT = '<span class="vst-ok">gleich</span>';
    else if (z.art === 'belege' && z.aktion === 'uebernehmen') abwT = '<span class="vst-ab">' + vz(z.abw) + '</span><small>' + z.neu.length + ' neu' + (z.erfasst.length ? ', ' + z.erfasst.length + ' schon erfasst' : '') + '</small>';
    else if (istZahl(z.abw)) abwT = '<span class="vst-ab">' + vz(z.abw) + '</span>';
    if (z.aktion === 'uebernehmen') kn = '<button type="button" class="vst-k" data-vst="eins" data-vst-jahr="' + jahr + '" data-vst-i="' + i + '" title="' + esc(z.modus === 'addieren' ? 'Die neuen Belege aus ViVi zum Wert ' + jahr + ' addieren' + (z.ersetztSchaetzung ? '. Die Schätzung der App wird dabei ersetzt' : '') : 'Den Wert aus ViVi für ' + jahr + ' eintragen') + '">übernehmen</button>';
    var unter = '';
    if (z.grund) unter += '<small>' + esc(z.grund) + '</small>';
    if (z.ersetztSchaetzung) unter += '<small>Ersetzt die Schätzung der App, deshalb nicht automatisch.</small>';
    if (z.neu.length) unter += '<ul class="vst-posten">' + z.neu.map(function (p) { return '<li>' + esc(datumText(p.datum)) + ' · ' + esc(p.text || 'Beleg') + ' · ' + eur(p.betrag) + '</li>'; }).join('') + '</ul>';
    if (z.gekuerzt) unter += '<small>' + z.gekuerzt + ' weitere Posten hat ViVi nicht mitgeschickt.</small>';
    return '<tr><td><b>' + esc(z.label) + '</b><small>Anlage V Zeile ' + esc(String(z.zeile || '').replace('-', ' bis ')) + '</small>' + unter + '</td><td>' + dpT + '</td><td>' + eur(z.vivi) + '</td><td>' + abwT + '</td><td>' + kn + '</td></tr>';
  }
  var _letzte = {};   /* jahr -> letzter Abgleich (fuer die Knoepfe) */
  function html(jahr) {
    if (!aktiv()) return '';
    var J = jahreViVi();
    if (!J.length) return '';
    if (J.indexOf(jahr) < 0) jahr = J.indexOf(heuteJahr() - 1) >= 0 ? heuteJahr() - 1 : J[J.length - 1];
    var a = abgleich(jahr); _letzte[jahr] = a;
    var e = aktuelleEinstellung();
    var stand = _stand.steuer_stand ? 'Stand ' + datumText(String(_stand.steuer_stand).slice(0, 10)) : '';
    var andere = J.filter(function (j) { return j !== jahr; }).map(function (j) { var x = abgleich(j); return '<button type="button" data-vst="jahr" data-vst-jahr="' + j + '">' + j + (x.offen ? '<i>' + x.offen + '</i>' : '') + '</button>'; }).join('');
    var out = '<div class="vst" data-vivi-steuer="' + jahr + '"><div class="vst-kopf"><span class="vst-marke">ViVi</span><b>Steuer ' + jahr + ' laut ViVi</b><span class="vst-marke">' + esc(stand) + '</span></div>';
    out += '<p class="vst-satz">' + (a.offen ? a.offen + ' Wert' + (a.offen === 1 ? '' : 'e') + ' aus ViVi ' + (a.offen === 1 ? 'fehlt' : 'fehlen') + ' noch im Steuerjahr ' + jahr + '.' : 'Das Steuerjahr ' + jahr + ' stimmt mit ViVi überein.') + ' ' + esc(modusText(e.modus)) + '.</p>';
    if (andere) out += '<div class="vst-jahre" role="group" aria-label="Weitere Jahre">' + andere + '</div>';
    if (a.gesperrt) out += '<div class="vst-sperre">Die Steuer ' + jahr + ' ist ' + (a.fest ? 'festgeschrieben' : 'als „' + (a.status === 'bescheid' ? 'Bescheid' : 'erklärt') + '“ gekennzeichnet') + '. Abweichungen werden nur gezeigt und nie automatisch übernommen.</div>';
    if (!a.zeilen.length) out += '<p class="vst-satz">Für ' + jahr + ' hat ViVi keine Buchungen.</p>';
    else out += '<table><thead><tr><th>Posten</th><th>DealPilot</th><th>ViVi</th><th>Abweichung</th><th></th></tr></thead><tbody>' + a.zeilen.map(function (z, i) { return zeileHtml(jahr, z, i, a.gesperrt); }).join('') + '</tbody></table>';
    out += '<div class="vst-fuss"><span>' + (a.abgewaehlt ? a.abgewaehlt + ' Kategorie' + (a.abgewaehlt === 1 ? '' : 'n') + ' in den Einstellungen abgewählt. ' : '') + 'Übernommene Werte tragen im Reiter Steuer die Marke ViVi.</span>'
      + (a.offen > 1 ? '<button type="button" class="vst-k gold" data-vst="alle" data-vst-jahr="' + jahr + '">alle übernehmen</button>' : '') + '</div></div>';
    return out;
  }
  function gewaehltIn(host) { var b = host.querySelector('[data-ja-jahr][aria-pressed="true"]'); return b ? Number(b.getAttribute('data-ja-jahr')) : heuteJahr() - 1; }
  var _vorgabeJahr = null;
  function einhaengen() {
    var hs = doc.querySelectorAll('[data-dp-ja-host]');
    Array.prototype.forEach.call(hs, function (h) {
      var ziel = h.querySelector('.dp-ja-schritte');
      var alt = h.querySelector('[data-vivi-steuer]');
      if (!ziel) { if (alt) alt.remove(); return; }
      var j = _vorgabeJahr || gewaehltIn(h);
      if (alt && Number(alt.getAttribute('data-vivi-steuer')) === j && alt._vstStand === standMerk()) return;
      var t = html(j);
      if (alt) alt.remove();
      if (!t) return;
      stil();
      var w = doc.createElement('div'); w.innerHTML = t;
      var k = w.firstChild; k._vstStand = standMerk();
      ziel.parentNode.insertBefore(k, ziel.nextSibling);
    });
  }
  function standMerk() { return (_key || '') + '|' + ((_stand && _stand.steuer_stand) || '') + '|' + JSON.stringify(((eingang() || {}).buchungen || []).length) + '|' + JSON.stringify((global._taxYearlyOverrides || {})); }
  function neuZeichnen() {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-vivi-steuer]'), function (k) { k._vstStand = null; });
    einhaengen(); marken();
  }

  /* ── Marke „ViVi“ im Reiter Steuer ──────────────────────────────── */
  function marken() {
    var box = $('yearly-tax-form-box'); if (!box) return;
    var E = eingang(); var H = (E && E.herkunft) || {};
    /* v4021 · gemessen 1179: die Bemerkungsfelder tragen dieselben data-year/data-field, die Marke stand doppelt */
    Array.prototype.forEach.call(box.querySelectorAll('input[data-year][data-field]:not(.ytf-bemerkung-input)'), function (inp) {
      var y = inp.getAttribute('data-year'), f = inp.getAttribute('data-field'), h = H['y' + y] && H['y' + y][f];
      var wrap = inp.parentNode, m = wrap && wrap.querySelector('.vivi-st-marke');
      var ov = (global._taxYearlyOverrides || {})['y' + y]; ov = ov && ov[f];
      var gilt = h && h.quelle === 'ViVi' && istZahl(ov) && Math.round(ov) === Math.round(h.betrag);
      if (!gilt) { if (m) m.remove(); return; }
      if (!m) { m = doc.createElement('span'); m.className = 'vivi-st-marke'; m.textContent = 'ViVi'; inp.insertAdjacentElement('afterend', m); stil(); }
      m.title = 'Aus ViVi übernommen am ' + datumText(h.am) + (h.stand ? ', Stand ViVi ' + datumText(h.stand) : '') + '. Eine Änderung von Hand nimmt die Marke weg.';
    });
  }

  /* ── Einstellung an der ViVi-Verbindung (js/vivi.js verbindungKarte) ── */
  function einstellungKarte(host) {
    if (!host) return;
    if (einsteiger()) { host.innerHTML = ''; return; }
    host.innerHTML = '<p class="hint">Lade Einstellung…</p>';
    einstellung(true).then(function (e) {
      if (!e) { host.innerHTML = ''; return; }
      var M = [['aus', 'Aus', 'DealPilot liest keine Steuerwerte aus ViVi.'], ['vorschlag', 'Als Vorschlag', 'Abweichungen erscheinen im Jahresabgleich, du übernimmst sie selbst.'], ['automatisch', 'Automatisch', 'Neue Belege und Jahreswerte gehen in offene Steuerjahre. Erklärte und beschiedene Jahre nie.']];
      host.innerHTML = '<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(0,0,0,.08)"><b style="font-size:13.5px">Steuerjahre aus ViVi</b>' +
        '<p class="hint" style="margin:4px 0 8px">Belege, Kosten und Jahreswerte der Anlage V je Objekt und Jahr. Wähle, ob und wie sie in die Steuerjahre in DealPilot gehen.</p>' +
        M.map(function (x) { return '<label style="display:flex;gap:8px;align-items:flex-start;margin:4px 0;cursor:pointer"><input type="radio" name="vst-modus" value="' + x[0] + '"' + (e.modus === x[0] ? ' checked' : '') + ' style="margin-top:3px"><span><b>' + x[1] + '</b><br><span class="hint" style="font-size:11.5px">' + x[2] + '</span></span></label>'; }).join('') +
        '<div id="vst-kat" style="margin-top:8px;' + (e.modus === 'aus' ? 'display:none' : '') + '"><div class="hint" style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;font-family:JetBrains Mono,ui-monospace,monospace;margin-bottom:4px">Übernehmen</div>' +
        (_kategorien || []).map(function (k) { return '<label style="display:flex;gap:8px;align-items:flex-start;margin:3px 0;cursor:pointer"><input type="checkbox" data-vst-kat="' + esc(k.id) + '"' + (e.kategorien[k.id] !== false ? ' checked' : '') + ' style="margin-top:3px"><span>' + esc(k.label) + '<br><span class="hint" style="font-size:11px">' + esc(k.hinweis || '') + '</span></span></label>'; }).join('') + '</div>' +
        '<div id="vst-gespeichert" class="hint" style="margin-top:6px;font-size:11px"></div></div>';
      var speichern = function () {
        var m = (host.querySelector('input[name="vst-modus"]:checked') || {}).value || 'vorschlag', kat = {};
        Array.prototype.forEach.call(host.querySelectorAll('[data-vst-kat]'), function (c) { kat[c.getAttribute('data-vst-kat')] = !!c.checked; });
        var kz = host.querySelector('#vst-kat'); if (kz) kz.style.display = m === 'aus' ? 'none' : '';
        api('/vivi/steuer-einstellung', { method: 'PUT', body: { modus: m, kategorien: kat } }).then(function (r) {
          _einst = r && r.einstellung; _einstP = Promise.resolve(_einst);
          if (_stand) _stand.steuer_einstellung = _einst;
          var g = host.querySelector('#vst-gespeichert'); if (g) g.textContent = 'Gespeichert. ' + (m === 'aus' ? '' : 'Gilt ab dem nächsten Abgleich mit ViVi.');
          _autoGelaufen = {};
          neuZeichnen();
        }).catch(function (x) { alert((x && x.message) || 'Speichern fehlgeschlagen.'); });
      };
      Array.prototype.forEach.call(host.querySelectorAll('input'), function (i) { i.onchange = speichern; });
    });
  }

  /* ── Ereignisse ─────────────────────────────────────────────────── */
  doc.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-vst]') : null;
    if (!b) return;
    ev.preventDefault();
    var was = b.getAttribute('data-vst'), j = Number(b.getAttribute('data-vst-jahr'));
    if (was === 'jahr') {
      /* den Jahresabgleich auf dasselbe Jahr stellen, sonst nur die Karte */
      var jb = doc.querySelector('[data-dp-ja-host] [data-ja-jahr="' + j + '"]');
      if (jb) { _vorgabeJahr = null; jb.click(); } else { _vorgabeJahr = j; neuZeichnen(); }
      return;
    }
    var a = _letzte[j] || abgleich(j);
    var zeilen = was === 'alle' ? a.zeilen : [a.zeilen[Number(b.getAttribute('data-vst-i'))]];
    var n = uebernehmen(j, zeilen, false);
    if (n) meldung(n + ' Wert' + (n === 1 ? '' : 'e') + ' aus ViVi in das Steuerjahr ' + j + ' übernommen');
  });
  global.addEventListener('dp:vivi-stand', function (ev) {
    var d = (ev && ev.detail) || {};
    _key = d.key || global._currentObjKey || null;
    _stand = d.stand || null;
    _vorgabeJahr = null;
    if (!_stand || !_stand.verknuepft) { neuZeichnen(); return; }
    frei().then(function (ok) { if (!ok) return; if (!_stand.steuer_einstellung) einstellung(); setTimeout(function () { automatisch(); neuZeichnen(); }, 600); });
  });
  global.addEventListener('dp:object-ready', function () { _stand = null; _key = null; setTimeout(neuZeichnen, 0); });
  global.addEventListener('dp:detailgrad', function () { neuZeichnen(); });
  /* Jahresabgleich und Reiter Steuer zeichnen neu: Karte und Marken nachziehen (gedrosselt) */
  var _mt = null;
  function spaeter() { if (_mt) return; _mt = setTimeout(function () { _mt = null; einhaengen(); marken(); }, 150); }
  function beobachten() {
    if (!doc.body || typeof MutationObserver === 'undefined') return;
    new MutationObserver(function (L) {
      for (var i = 0; i < L.length; i++) {
        var t = L[i].target;
        if (t && t.closest && (t.closest('[data-dp-ja-host]') || t.closest('#yearly-tax-form-box'))) { if (!(t.closest('[data-vivi-steuer]'))) { spaeter(); return; } }
      }
    }).observe(doc.body, { childList: true, subtree: true });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', beobachten); else beobachten();

  global.DpViviSteuer = { VERSION: VERSION, kern: KERN, html: html, einhaengen: einhaengen, abgleich: abgleich, uebernehmen: uebernehmen, automatisch: automatisch,
    einstellungKarte: einstellungKarte, stand: function () { return _stand; }, jahre: jahreViVi };
})(typeof window !== 'undefined' ? window : globalThis);
