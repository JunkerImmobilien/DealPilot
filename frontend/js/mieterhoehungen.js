/* ══════════════════════════════════════════════════════════════════════
 * mieterhoehungen.js — v3362 · Mieterhöhungen als Liste
 *
 * Marcel 14.11.2026: „Im Bestand die Mieten jedes Jahr anpassen." Bis hier
 * kannte die App nur die LETZTE Erhöhung (`mv_letzte_erhoehung`, `_betrag`),
 * am Objekt wie je Wohnung. `mv_historie` (mfh-einheiten.js) führt frühere
 * VERTRÄGE, aber keine Erhöhungen innerhalb eines Vertrags.
 *
 * Bericht Dateien/Fehler/zielbild-jahresverlauf-2026-11-14.md, Paket 3.
 *
 * ── DATEN ────────────────────────────────────────────────────────────
 *
 *   Objekt (ETW, EFH, …):  _erhoehungen   [ Eintrag ]  im Objekt-JSON
 *   Wohnung im MFH:        e.erhoehungen  [ Eintrag ]  an der Einheit
 *                          (wie e.mv_historie - die Einheit wird im Fenster
 *                          „Einheiten erfassen" als Ganzes übernommen)
 *
 *   Eintrag = { id, datum (wirksam, JJJJ-MM-TT), art, von, auf (€/Monat), beleg, am }
 *   art: 558 | 559 | staffel | index | neuvermietung | sonstig
 *
 * ── WAS ABGELEITET WIRD (und was nicht) ─────────────────────────────
 *
 *   mv_letzte_erhoehung        = jüngster Eintrag der Arten 558, Staffel,
 *                                Index. Eine Modernisierungsumlage (§ 559)
 *                                setzt die Jahressperre des § 558 Abs. 1
 *                                nicht in Gang (§ 558 Abs. 1 Satz 3), eine
 *                                Neuvermietung ist ein neuer Vertrag.
 *   mv_letzte_erhoehung_betrag = Betrag des jüngsten Eintrags nach § 558.
 *
 *   Die SUMME der Erhöhungen in drei Jahren (Kappungsgrenze § 558 Abs. 3)
 *   steht nur als Hinweis da. Sie in die Rechnung zu nehmen, ist Paket 7
 *   des Berichts und wartet auf Marcels Entscheidung (E5). Der Kern
 *   (mietpotenzial-kern.js) bleibt unverändert.
 *
 *   Ohne Liste bleibt alles wie bisher: die Felder werden nur geschrieben,
 *   wenn die Liste einen passenden Eintrag hat. Vorbelegt wird nie beim
 *   Laden, nur auf Klick („Aus den Vertragsangaben übernehmen").
 * ══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (global.DpErhoehungen) return;
  var VERSION = 'v4042a';
  var ARTEN = [['558', 'Erhöhung auf die Vergleichsmiete (§ 558 BGB)'], ['559', 'Modernisierungsumlage (§ 559 BGB)'], ['staffel', 'Staffelmiete'],
    ['index', 'Indexmiete'], ['neuvermietung', 'Neuvermietung'], ['sonstig', 'sonstige Änderung']];
  var SPERRE_ARTEN = { '558': 1, staffel: 1, index: 1 };

  function doc() { return global.document || null; }
  function el(id) { var d = doc(); return d && d.getElementById ? d.getElementById(id) : null; }
  function istZahl(v) { return typeof v === 'number' && isFinite(v); }
  function zahl(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var s = String(v).trim();
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s); return isFinite(n) ? n : null;
  }
  function istDatum(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
  function heuteIso() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function datumDe(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function eur(x) { return istZahl(x) ? x.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €' : '–'; }
  function artWort(a) { var t = ARTEN.filter(function (x) { return x[0] === a; })[0]; return t ? t[1] : (a || '–'); }
  function minusJahre(iso, n) { return (+iso.slice(0, 4) - n) + iso.slice(4); }

  /* ── Rein (testbar, tools/jahresbuch-pruefen.mjs) ─────────────────── */
  function sortiert(l) { return (Array.isArray(l) ? l : []).filter(function (x) { return x && istDatum(x.datum); }).slice().sort(function (a, b) { return a.datum < b.datum ? -1 : (a.datum > b.datum ? 1 : 0); }); }
  function plus(x) { var v = zahl(x.von), a = zahl(x.auf); return istZahl(v) && istZahl(a) ? Math.round((a - v) * 100) / 100 : null; }
  /** Was die Liste für die Vertragsfelder sagt. heute: Stichtag für die Drei-Jahres-Summe (nur Hinweis). */
  function ableiten(liste, heute) {
    heute = istDatum(heute) ? heute : heuteIso();
    var l = sortiert(liste), sperre = l.filter(function (x) { return SPERRE_ARTEN[x.art]; });
    var e558 = l.filter(function (x) { return x.art === '558'; });
    var letzte = sperre.length ? sperre[sperre.length - 1] : null, l558 = e558.length ? e558[e558.length - 1] : null;
    var ab = minusJahre(heute, 3), drei = e558.filter(function (x) { return x.datum > ab && x.datum <= heute; });
    var summe = drei.reduce(function (s, x) { var p = plus(x); return s + (istZahl(p) ? p : 0); }, 0);
    return { letzte: letzte ? letzte.datum : null, betrag: l558 ? plus(l558) : null, letzte_art: letzte ? letzte.art : null,
      summe558_3j: Math.round(summe * 100) / 100, n558_3j: drei.length, anzahl: l.length,
      miete_zuletzt: l.length && istZahl(zahl(l[l.length - 1].auf)) ? zahl(l[l.length - 1].auf) : null };
  }
  /** Miete je Monat an einem Tag aus der Liste (der jüngste Eintrag bis dahin), sonst null. */
  function mieteAm(liste, iso) {
    var l = sortiert(liste).filter(function (x) { return x.datum <= iso && istZahl(zahl(x.auf)); });
    return l.length ? zahl(l[l.length - 1].auf) : null;
  }
  /** Einträge eines Kalenderjahres. */
  function imJahr(liste, jahr) { var j = String(jahr); return sortiert(liste).filter(function (x) { return x.datum.slice(0, 4) === j; }); }
  /** Rein: neuer Eintrag. Fehler als Text, sonst { eintrag }. */
  function eintragAus(f) {
    f = f || {};
    if (!istDatum(f.datum)) return { fehler: 'Bitte das Datum eintragen, ab dem die neue Miete gilt.' };
    var auf = zahl(f.auf), von = zahl(f.von);
    if (!(auf > 0)) return { fehler: 'Bitte die neue Kaltmiete je Monat eintragen.' };
    if (von != null && von < 0) return { fehler: 'Die bisherige Miete kann nicht negativ sein.' };
    var art = ARTEN.some(function (a) { return a[0] === f.art; }) ? f.art : '558';
    return { eintrag: { id: 'erh-' + f.datum.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6), datum: f.datum, art: art,
      von: von, auf: auf, beleg: String(f.beleg || '').trim() || null, am: new Date().toISOString() } };
  }
  /** Rein: Vorbelegung aus den bisherigen Vertragsfeldern (ein Eintrag), oder null. */
  function ausVertrag(letzte, betrag, ist) {
    if (!istDatum(letzte)) return null;
    var b = zahl(betrag), i = zahl(ist);
    return { id: 'erh-alt-' + letzte.replace(/-/g, ''), datum: letzte, art: '558', von: istZahl(b) && istZahl(i) ? Math.round((i - b) * 100) / 100 : null,
      auf: istZahl(i) && i > 0 ? i : null, beleg: 'aus den Vertragsangaben übernommen', am: new Date().toISOString() };
  }

  /* ── v3366 · Miete vergangener Jahre (Marcel 14.11.2026, E4: „wir sollten mit der Miete
     rechnen, die wir unter dem Tab Miete eingegeben haben") ─────────────────────────
     quellen = [{ liste, heute (Kaltmiete je Monat heute), letzte (JJJJ-MM-TT), betrag }],
     je Mietquelle eine (Objekt oder je vermietete Wohnung). Monatsmiete am Ersten jedes
     Monats: aus der Liste, davor die bisherige Miete des ersten Eintrags; ohne Liste aus
     „Letzte Erhöhung" und „um"; ohne beides die heutige Miete (nichts wird erfunden).
     Ergebnis: Jahresdurchschnitt geteilt durch die Miete heute, also der Faktor auf die
     heutige Kaltmiete. Ohne Miete heute 1. */
  function mieteMonat(q, iso) {
    var heute = zahl(q.heute);
    var l = sortiert(q.liste).filter(function (x) { return istZahl(zahl(x.auf)); });
    if (l.length) {
      var bis = l.filter(function (x) { return x.datum <= iso; });
      if (bis.length) return zahl(bis[bis.length - 1].auf);
      var v = zahl(l[0].von); return istZahl(v) ? v : heute;
    }
    var b = zahl(q.betrag);
    if (istDatum(q.letzte) && istZahl(b) && istZahl(heute) && iso < q.letzte) return Math.max(0, heute - b);
    return heute;
  }
  function jahresFaktor(quellen, jahr) {
    var heute = 0, schnitt = 0;
    (quellen || []).forEach(function (q) {
      var h = zahl(q && q.heute); if (!(h > 0)) return;
      heute += h;
      for (var m = 1; m <= 12; m++) { var x = mieteMonat(q, jahr + '-' + String(m).padStart(2, '0') + '-01'); schnitt += (istZahl(x) ? x : h) / 12; }
    });
    return heute > 0 ? schnitt / heute : 1;
  }
  /** Die Quellen des offenen Objekts: vermietete Wohnungen, sonst das Objekt selbst. */
  function quellenObjekt() {
    var M = global._dpMfh, w = [];
    if (M && Array.isArray(M.einheiten)) M.einheiten.forEach(function (e) {
      if (!e || e.status === 'leer' || !(zahl(e.ist) > 0)) return;
      w.push({ liste: e.erhoehungen, heute: zahl(e.ist), letzte: e.mv_letzte_erhoehung, betrag: e.mv_letzte_erhoehung_betrag });
    });
    if (w.length) return w;
    return [{ liste: objektListe(), heute: zahl((el('nkm') || {}).value), letzte: (el('mv_letzte_erhoehung') || {}).value, betrag: (el('mv_letzte_erhoehung_betrag') || {}).value }];
  }
  function istFaktor(jahr) { try { return jahresFaktor(quellenObjekt(), jahr); } catch (e) { return 1; } }
  /* ── v4037 · Geplante Erhöhungen (aus ViVi, status geplant) ─────────────────────────────────
     Marcel 23.11.2026: eine in ViVi geplante Erhöhung soll in den Plan-Jahren stehen. Sie liegt getrennt
     (_erhoehungen_geplant am Objekt, erhoehungen_geplant je Wohnung), damit „Letzte Erhöhung“ und Sperrfrist
     nur aus wirksamen Erhöhungen kommen. planFaktor = Jahresfaktor mit wirksamen UND geplanten Einträgen. */
  function geplantObjekt() { var d = D(); return d && Array.isArray(d._erhoehungen_geplant) ? d._erhoehungen_geplant : []; }
  function quellenPlan() {
    var M = global._dpMfh, w = [];
    if (M && Array.isArray(M.einheiten)) M.einheiten.forEach(function (e) {
      if (!e || e.status === 'leer' || !(zahl(e.ist) > 0)) return;
      w.push({ liste: (e.erhoehungen || []).concat(e.erhoehungen_geplant || []), heute: zahl(e.ist), letzte: e.mv_letzte_erhoehung, betrag: e.mv_letzte_erhoehung_betrag });
    });
    if (w.length) return w;
    return [{ liste: objektListe().concat(geplantObjekt()), heute: zahl((el('nkm') || {}).value), letzte: (el('mv_letzte_erhoehung') || {}).value, betrag: (el('mv_letzte_erhoehung_betrag') || {}).value }];
  }
  function planFaktor(jahr) { try { return jahresFaktor(quellenPlan(), jahr); } catch (e) { return 1; } }
  function geplant() {
    var out = geplantObjekt().map(function (x) { return Object.assign({ einheit: null }, x); });
    var M = global._dpMfh;
    if (M && Array.isArray(M.einheiten)) M.einheiten.forEach(function (e, i) {
      (e && Array.isArray(e.erhoehungen_geplant) ? e.erhoehungen_geplant : []).forEach(function (x) { out.push(Object.assign({ einheit: i, nr: e.nr || String(i + 1) }, x)); });
    });
    return sortiert(out);
  }
  function geplantLetztesJahr() { var g = geplant(); return g.length ? +String(g[g.length - 1].datum).slice(0, 4) : null; }
  /** Miete nach der letzten geplanten Erhöhung geteilt durch die heutige (Faktor auf heute) */
  function geplantNiveau() {
    var q = quellenPlan(), heute = 0, spaeter = 0;
    q.forEach(function (x) { var h = zahl(x.heute); if (!(h > 0)) return; heute += h; var m = mieteMonat(x, '9999-12-01'); spaeter += istZahl(m) ? m : h; });
    return heute > 0 ? spaeter / heute : 1;
  }

  /* ── Anzeige (eine Maske für Objekt und Wohnung) ──────────────── */
  function stil() {
    var d = doc(); if (!d || d.getElementById('dp-erh-stil') || !d.head) return;
    var s = d.createElement('style'); s.id = 'dp-erh-stil';
    s.textContent = [
      '.dp-erh{margin:10px 0 4px;padding:8px 10px;border:1px solid rgba(128,128,128,.25);border-radius:8px;font:400 12.5px/1.5 Inter,system-ui,sans-serif}',
      '.dp-erh-t{font-weight:600;margin-bottom:4px}.dp-erh-t span{font-weight:400;color:#6B645A;font-size:11.5px}',
      '.dp-erh-z{display:grid;grid-template-columns:86px minmax(0,1fr) auto;gap:2px 8px;align-items:center;padding:4px 0;border-top:1px solid rgba(128,128,128,.15)}',
      '.dp-erh-z small{grid-column:2 / -1;color:#6B645A}',
      '.dp-erh-f{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin-top:8px}',
      '.dp-erh-f label{display:flex;flex-direction:column;font-size:11.5px;gap:2px}',
      '.dp-erh-f input,.dp-erh-f select{font:inherit;padding:5px 6px;border:1px solid rgba(128,128,128,.4);border-radius:6px;background:transparent;color:inherit;min-width:0}',
      '.dp-erh-x{background:none;border:none;color:#B8625C;cursor:pointer;font:inherit;padding:6px}',
      '.dp-erh-fehler{color:#B8625C;margin-top:4px}',
      '.dp-erh-ok{margin:4px 0 6px;padding:6px 9px;border-left:3px solid #3FA56C;background:rgba(63,165,108,.07);font-size:12px;line-height:1.5}',
      '.dp-erh-ok button{margin-left:6px}',
      '.dp-erh-gepl{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 7%, transparent)}.dp-erh-gepl em{font-style:normal;font-weight:600;color:var(--wl-b8932f,#b8932f)}'
    ].join('\n');
    d.head.appendChild(s);
  }
  function html(liste, o) {
    o = o || {};
    var l = sortiert(liste).reverse(), a = ableiten(liste);
    var zeilen = l.map(function (x) {
      var p = plus(x);
      return '<div class="dp-erh-z"><b>' + datumDe(x.datum) + '</b><span>' + esc(artWort(x.art)) + ': ' + (istZahl(zahl(x.von)) ? 'von ' + eur(zahl(x.von)) + ' ' : '') + 'auf <b>' + eur(zahl(x.auf)) + '</b>'
        + (istZahl(p) ? ' (' + (p >= 0 ? '+' : '') + eur(p) + ')' : '') + '</span>'
        + '<button type="button" class="dp-erh-x" data-erh-weg="' + esc(x.id) + '" title="Eintrag entfernen" aria-label="Eintrag entfernen">✕</button>'
        + (x.beleg ? '<small>' + esc(x.beleg) + '</small>' : '') + '</div>';
    }).join('');
    /* v4037 · geplante Erhöhungen aus ViVi: nur ansehen, sie gelten ab ihrem Datum in den Plan-Jahren */
    var gz = sortiert(o.geplant || []).reverse().map(function (x) {
      var p = plus(x);
      return '<div class="dp-erh-z dp-erh-gepl"><b>' + datumDe(x.datum) + '</b><span><em>geplant</em>, ' + esc(artWort(x.art)) + ': ' + (istZahl(zahl(x.von)) ? 'von ' + eur(zahl(x.von)) + ' ' : '') + 'auf <b>' + eur(zahl(x.auf)) + '</b>'
        + (istZahl(p) ? ' (' + (p >= 0 ? '+' : '') + eur(p) + ')' : '') + '</span><span></span>'
        + '<small>' + esc(x.beleg || 'geplant') + '. Zählt ab ' + datumDe(x.datum) + ' in den Plan-Jahren der Mietentwicklung.</small></div>';
    }).join('');
    zeilen = gz + zeilen;
    var hin = '';
    if (a.n558_3j > 1) hin = '<div class="cf-hint" style="margin-top:4px">In den letzten drei Jahren gab es ' + a.n558_3j + ' Erhöhungen auf die Vergleichsmiete, zusammen ' + eur(a.summe558_3j) + ' je Monat. Für die Kappungsgrenze zählt die Summe. Gerechnet wird heute mit der letzten (' + eur(a.betrag) + '), trag die Summe bei Bedarf unter „Letzte Erhöhung um“ ein.</div>';
    var vorb = (!l.length && o.vorbelegbar) ? '<button type="button" class="btn btn-outline btn-sm" data-erh-vorbelegen="1" style="margin-top:6px">Aus den Vertragsangaben übernehmen</button>' : '';
    var opt = ARTEN.map(function (x) { return '<option value="' + x[0] + '">' + esc(x[1]) + '</option>'; }).join('');
    /* v3840 · Marcel 19.11.2026 (Westerfeldstr.): „Mieterhöhung … Eintragen, wohin geht das? Nicht schlüssig". Der Kopf sagt
       jetzt, was mit dem Eintrag passiert, und nach dem Eintragen steht eine Rückmeldung mit dem Weg (o.meldung). */
    return '<div class="dp-erh-t">Mieterhöhungen <span>Trag jede Erhöhung mit Datum ein. Die jüngste setzt „Letzte Erhöhung“' + (o.wo ? ' ' + esc(o.wo) : '') + '. Daraus rechnet DealPilot die Miete vergangener Jahre in der Mietentwicklung und die Sperrfrist für die nächste Erhöhung.</span></div>'
      + (o.meldung ? '<div class="dp-erh-ok">' + o.meldung + '</div>' : '')
      + (o.vivi != null && global.DpViviMieterhoehung && global.DpViviMieterhoehung.verfuegbar() && (!global.DpViviMieterhoehung.spielraum || global.DpViviMieterhoehung.spielraum(o.vivi)) ? '<button type="button" class="btn btn-outline btn-sm" data-erh-vivi="' + esc(String(o.vivi)) + '" style="margin:2px 0 6px">Mieterhöhung in ViVi anlegen</button>' : '')   /* v4037 */
      + (zeilen || '<div style="color:#6B645A">Noch keine Erhöhung eingetragen.</div>') + hin + vorb
      + '<details' + (l.length ? '' : '') + '><summary style="cursor:pointer;margin-top:6px;min-height:28px;display:flex;align-items:center">Erhöhung eintragen</summary><div class="dp-erh-f">'
      + '<label>Wirksam ab<input type="date" data-erh-feld="datum"></label>'
      + '<label>Art<select data-erh-feld="art">' + opt + '</select></label>'
      + '<label>Miete bisher (€ im Monat)<input inputmode="decimal" data-erh-feld="von" placeholder="' + (istZahl(a.miete_zuletzt) ? esc(String(a.miete_zuletzt).replace('.', ',')) : 'z. B. 650') + '"></label>'
      + '<label>Miete neu (€ im Monat)<input inputmode="decimal" data-erh-feld="auf" placeholder="z. B. 700"></label>'
      + '<label>Beleg oder Notiz (freiwillig)<input data-erh-feld="beleg" placeholder="z. B. Schreiben vom 12.03."></label>'
      + '</div><button type="button" class="btn btn-sm" data-erh-neu="1" style="margin-top:6px">Eintragen</button><div class="dp-erh-fehler" data-erh-fehler="1"></div></details>';
  }
  /** v3840 · Rückmeldung nach dem Eintragen: wohin der Eintrag geht. Rein bis auf eur/datumDe. */
  function rueckmeldung(e, a, heute, wohin) {
    var heuteIsoS = heuteIso(), auf = zahl(e.auf), t = 'Eingetragen. ';
    wohin = wohin || 'für die Miete vergangener Jahre in der Mietentwicklung und für die Sperrfrist der nächsten Erhöhung';
    if (e.datum > heuteIsoS) t += 'Die Erhöhung gilt ab ' + datumDe(e.datum) + ' und liegt in der Zukunft. Die Mietentwicklung rechnet ab heute weiter mit ihrer Prognose. Steht die Erhöhung fest, trag sie dort im Modus Detail ein.';
    else {
      t += 'Die Miete von ' + esc(eur(auf)) + ' gilt ab ' + datumDe(e.datum) + '. Sie zählt ' + esc(wohin) + '.';
      if (SPERRE_ARTEN[e.art] && a && a.letzte === e.datum) t += ' „Letzte Erhöhung“ ist jetzt der ' + datumDe(e.datum) + '.';
      if (istZahl(heute) && istZahl(auf) && Math.abs(heute - auf) >= 0.5 && a && a.miete_zuletzt === auf)
        t += ' Die heutige Miete steht noch auf ' + esc(eur(heute)) + '. <button type="button" class="btn btn-outline btn-sm" data-erh-heute="' + auf + '">Auf ' + esc(eur(auf)) + ' setzen</button>';
    }
    return t;
  }
  /** Bindet eine Liste an einen Host. h = { liste() -> Array, setzen(Array), vorbelegen() -> Eintrag|null, geaendert(abl) , wo } */
  function binden(host, h) {
    if (!host) return;
    stil();
    host.classList.add('dp-erh');
    var meldung = '';
    function zeichne() { host.innerHTML = html(h.liste(), { vorbelegbar: !!(h.vorbelegen && h.vorbelegen(true)), wo: h.wo, meldung: meldung, geplant: h.geplant ? h.geplant() : [], vivi: h.vivi ? h.vivi() : null }); meldung = ''; }
    function fertig(l, neu) {
      /* v4090 · festgeschriebene Mietjahre bleiben, wie sie sind (jahresbuch.js erhoehungenSchuetzen) */
      try { var JBx = global.DpJahresbuch; if (JBx && JBx.erhoehungenSchuetzen) { var rx = JBx.erhoehungenSchuetzen(h.liste(), l); if (rx.abgewiesen) { l = rx.liste; neu = null; } } } catch (x) {}
      h.setzen(l); var a = ableiten(l); if (h.geaendert) h.geaendert(a);
      if (neu) meldung = rueckmeldung(neu, a, h.heute ? h.heute() : null, h.wohin || null);
      zeichne();
    }
    host.onclick = function (ev) {
      var t = ev.target; if (!t || !t.closest) return;
      var vv = t.closest('[data-erh-vivi]');   /* v4037 · Absprung nach ViVi, ein Fenster für alle Stellen */
      if (vv) { ev.preventDefault(); var ve = vv.getAttribute('data-erh-vivi'); try { global.DpViviMieterhoehung.oeffnen({ einheit: ve === 'objekt' ? null : ve, quelle: 'Reiter Miete' }); } catch (x) {} return; }
      var weg = t.closest('[data-erh-weg]'), neu = t.closest('[data-erh-neu]'), vb = t.closest('[data-erh-vorbelegen]');
      if (weg) { ev.preventDefault(); var id = weg.getAttribute('data-erh-weg'); fertig(h.liste().filter(function (x) { return x && x.id !== id; })); return; }
      if (vb) { ev.preventDefault(); var e0 = h.vorbelegen(); if (e0) fertig(h.liste().concat([e0])); return; }
      if (neu) {
        ev.preventDefault();
        var f = {}; host.querySelectorAll('[data-erh-feld]').forEach(function (i) { f[i.getAttribute('data-erh-feld')] = i.value; });
        var r = eintragAus(f), fe = host.querySelector('[data-erh-fehler]');
        if (r.fehler) { if (fe) fe.textContent = r.fehler; return; }
        fertig(h.liste().concat([r.eintrag]), r.eintrag);
        return;
      }
      var nkm = t.closest('[data-erh-heute]');
      if (nkm && h.heuteSetzen) { ev.preventDefault(); h.heuteSetzen(zahl(nkm.getAttribute('data-erh-heute'))); meldung = 'Die heutige Miete ist jetzt ' + esc(eur(zahl(nkm.getAttribute('data-erh-heute')))) + ' im Monat.'; zeichne(); }
    };
    zeichne();
    return zeichne;
  }

  /* v3363b · SPEICHERN IN FOLGE. Gemessen 14.11.2026 an Westerfeldstr. 146 (Staging): drei schnelle
     saveObj-Aufrufe (Wert, Status, Schließen) liefen parallel, zwei PUT mit derselben Version - der
     zweite kam mit 409 zurück und das Objekt stand danach im Konflikt (_dpObjKonflikt), weitere
     Speicherungen wurden abgewiesen. Jetzt: läuft einer, folgt genau EIN weiterer danach. Dieselbe
     Folge für Zielbild-Fassungen, Mieterhöhungen und Jahresbuch (window.DpSpeichernFolge). */
  if (!global.DpSpeichernFolge) global.DpSpeichernFolge = (function () {
    var lauf = null, nochmal = false;
    function los() {
      if (lauf) { nochmal = true; return lauf; }
      var p = null;
      try { if (typeof global.saveObj === 'function') p = global.saveObj({ silent: true }); } catch (e) { p = null; }
      lauf = Promise.resolve(p).catch(function () {}).then(function () { lauf = null; if (nochmal) { nochmal = false; return los(); } });
      return lauf;
    }
    return los;
  })();
  /* ── Objektebene (Reiter Miete, Karte Mietvertrag) ─────────────── */
  function D() { return global._currentObjData || null; }
  function objektListe() { var d = D(); return d && Array.isArray(d._erhoehungen) ? d._erhoehungen : []; }
  function sollAnsicht() { try { var AA = global.DealPilotAnkaufAnsicht; return !!(AA && AA.aktiv && AA.aktiv()); } catch (e) { return false; } }
  function setzeFeld(id, v) {
    var f = el(id); if (!f) return;
    if (String(f.value || '') === String(v == null ? '' : v)) return;
    f.value = v == null ? '' : v;
    try { f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }
  function objektMount() {
    var karte = el('mv-objekt-karte'); if (!karte) return;
    var host = el('mv-erh-host');
    if (sollAnsicht()) { if (host) host.style.display = 'none'; return; }
    if (!host) {
      host = doc().createElement('div'); host.id = 'mv-erh-host';
      var vor = el('mv-objekt-mfh-hinweis');
      if (vor && vor.parentNode === karte) karte.insertBefore(host, vor); else karte.appendChild(host);
    }
    host.style.display = '';
    /* v3840 · GEMESSEN Westerfeldstr. 146 (Staging, 19.11.2026): beim MFH mit Wohnungen stand hier ein Formular,
       dessen Einträge in _erhoehungen am OBJEKT landeten. quellenObjekt() nimmt aber die Wohnungen, sobald eine
       vermietet ist, der Eintrag rechnete also nirgends. Jetzt: die Erhöhungen der Wohnungen als Liste und der Weg
       in die Einheiten. Ein schon vorhandener Objekt-Eintrag bleibt sichtbar und lässt sich entfernen. */
    var Mf = global.DpMfhEinheiten, M0 = global._dpMfh;
    if (Mf && Mf.artMitEinheiten && Mf.artMitEinheiten() && M0 && Array.isArray(M0.einheiten) && M0.einheiten.length) {
      stil(); host.classList.add('dp-erh'); host.onclick = null;
      var we = alle().filter(function (x) { return x.einheit != null; }).reverse(), alt = objektListe();
      host.innerHTML = '<div class="dp-erh-t">Mieterhöhungen <span>Beim Mehrfamilienhaus trägst du eine Erhöhung bei der Wohnung ein. Dort zählt sie für die Mietentwicklung, die Sperrfrist und die Kappungsgrenze dieser Wohnung. Unten in dieser Karte über „Einheiten bearbeiten“.</span></div>'
        + (we.length ? we.map(function (x) { return '<div class="dp-erh-z"><b>' + datumDe(x.datum) + '</b><span>Wohnung ' + esc(x.nr) + ', ' + esc(artWort(x.art)) + ': auf <b>' + eur(zahl(x.auf)) + '</b></span><span></span></div>'; }).join('')
          : '<div style="color:#6B645A">In den Wohnungen ist noch keine Erhöhung eingetragen.</div>')
        + (alt.length ? '<div class="cf-hint" style="margin-top:6px">Am Haus stehen noch ' + alt.length + ' ältere Einträge. Sie rechnen nicht mit, weil die Miete aus den Wohnungen kommt. Trag sie bei der Wohnung ein und entferne sie hier. ' + alt.map(function (x) { return datumDe(x.datum) + ' auf ' + eur(zahl(x.auf)) + ' <button type="button" class="dp-erh-x" data-erh-alt-weg="' + esc(x.id) + '" aria-label="Eintrag entfernen">✕</button>'; }).join(' ') + '</div>' : '')
        + '';   /* v3860 · Marcel 19.11.2026: zwei Knoepfe zur selben Stelle. Es bleibt „Einheiten bearbeiten“ unten in der Karte (mietvertrag-objekt.js). */
      host.onclick = function (ev) {
        var t = ev.target && ev.target.closest ? ev.target : null; if (!t) return;
        if (t.closest('[data-erh-einheiten]')) { ev.preventDefault(); try { Mf.oeffnen(1); } catch (e) {} return; }
        var w = t.closest('[data-erh-alt-weg]');
        if (w) { ev.preventDefault(); var d = D(); if (d) { d._erhoehungen = objektListe().filter(function (x) { return x && x.id !== w.getAttribute('data-erh-alt-weg'); }); try { global.DpSpeichernFolge(); } catch (e) {} objektMount(); } }
      };
      return;
    }
    binden(host, {
      wo: 'oben',
      wohin: 'für die Miete vergangener Jahre in der Mietentwicklung und für die Sperrfrist der nächsten Erhöhung',
      heute: function () { return zahl((el('nkm') || {}).value); },
      heuteSetzen: function (v) { if (v > 0) setzeFeld('nkm', String(v).replace('.', ',')); try { if (typeof global.calc === 'function') global.calc(); } catch (e) {} try { global.DpSpeichernFolge(); } catch (e) {} },
      liste: objektListe,
      geplant: geplantObjekt,   /* v4037 */
      vivi: function () { return 'objekt'; },   /* v4037 */
      setzen: function (l) { var d = D(); if (d) d._erhoehungen = l; },
      vorbelegen: function (nurPruefen) {
        var e = ausVertrag((el('mv_letzte_erhoehung') || {}).value, (el('mv_letzte_erhoehung_betrag') || {}).value, (el('nkm') || {}).value);
        return nurPruefen ? !!e : e;
      },
      geaendert: function (a) {
        if (a.letzte) setzeFeld('mv_letzte_erhoehung', a.letzte);
        if (a.betrag != null) setzeFeld('mv_letzte_erhoehung_betrag', String(a.betrag).replace('.', ','));
        try { global.DpSpeichernFolge(); } catch (e) {}
        try { global.dispatchEvent(new CustomEvent('dp:erhoehungen', { detail: a })); } catch (e) {}
      }
    });
  }
  /* ── Wohnung im MFH (Fenster „Einheiten erfassen" › Details) ───── */
  function einheitBinden(host, e, nachher) {
    if (!host || !e) return;
    if (!Array.isArray(e.erhoehungen)) e.erhoehungen = [];
    binden(host, {
      wo: 'in dieser Wohnung',
      wohin: 'für diese Wohnung, in der Mietentwicklung und für die Sperrfrist. Die heutige Miete der Wohnung änderst du oben im Feld Ist-Miete',
      liste: function () { return Array.isArray(e.erhoehungen) ? e.erhoehungen : []; },
      geplant: function () { return Array.isArray(e.erhoehungen_geplant) ? e.erhoehungen_geplant : []; },   /* v4037 */
      vivi: function () { var L = global._dpMfh && global._dpMfh.einheiten; var k = Array.isArray(L) ? L.indexOf(e) : -1; return k >= 0 ? k : null; },   /* v4037 */
      setzen: function (l) { e.erhoehungen = l; },
      vorbelegen: function (nurPruefen) { var x = ausVertrag(e.mv_letzte_erhoehung, e.mv_letzte_erhoehung_betrag, e.ist); return nurPruefen ? !!x : x; },
      geaendert: function (a) {
        if (a.letzte) e.mv_letzte_erhoehung = a.letzte;
        if (a.betrag != null) e.mv_letzte_erhoehung_betrag = String(a.betrag).replace('.', ',');
        if (nachher) nachher(a);
      }
    });
  }
  /** Alle Einträge des Objekts, je Wohnung gekennzeichnet (für das Jahresbuch). */
  function alle() {
    var out = objektListe().map(function (x) { return Object.assign({ einheit: null }, x); });
    var M = global._dpMfh;
    if (M && Array.isArray(M.einheiten)) M.einheiten.forEach(function (e, i) {
      (e && Array.isArray(e.erhoehungen) ? e.erhoehungen : []).forEach(function (x) { out.push(Object.assign({ einheit: i, nr: e.nr || String(i + 1) }, x)); });
    });
    return sortiert(out);
  }

  if (global.addEventListener) global.addEventListener('dp:object-ready', function () { setTimeout(objektMount, 600); setTimeout(objektMount, 1800); });
  if (global.addEventListener) global.addEventListener('dp:vivi-stand', function () { setTimeout(objektMount, 300); });   /* v4037 · Knopf nach ViVi und geplante Erhoehungen */   /* v3840 · Wohnungen (_dpMfh) kommen nach */
  if (doc() && doc().addEventListener) doc().addEventListener('DOMContentLoaded', function () { setTimeout(objektMount, 800); });

  global.DpErhoehungen = {
    VERSION: VERSION, ARTEN: ARTEN, artWort: artWort,
    ableiten: ableiten, mieteAm: mieteAm, imJahr: imJahr, eintragAus: eintragAus, ausVertrag: ausVertrag, sortiert: sortiert,
    html: html, binden: binden, rueckmeldung: rueckmeldung,   /* v3840 */
 objektMount: objektMount, einheitBinden: einheitBinden, objektListe: objektListe, alle: alle,
    mieteMonat: mieteMonat, jahresFaktor: jahresFaktor, quellenObjekt: quellenObjekt, istFaktor: istFaktor,   /* v3366 */
    planFaktor: planFaktor, geplant: geplant, geplantObjekt: geplantObjekt, geplantLetztesJahr: geplantLetztesJahr, geplantNiveau: geplantNiveau   /* v4037 */
  };
})(typeof window !== 'undefined' ? window : globalThis);
