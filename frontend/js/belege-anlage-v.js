/* ═════════════════════════════════════════════════════════════════════════
   DealPilot · js/belege-anlage-v.js · v4340
   Belege je Jahr nach der Gliederung der Anlage V

   Marcel 24.11.2026: „wenn wir die Belege haben … nach Anlage V in diese
   Untergruppen zuordnen … Einnahmen, Abschreibungen, Finanzierung,
   Erhaltungsaufwand, laufende Kosten … es gibt immer einen Vorschlag … und
   später könnte man die auch noch wieder umverteilen. Außer Sachen, die klar
   sind, Schuldzinsen und so, was wir automatisch auslesen."

   WAS HIER PASSIERT
     1. Der Reiter „Belege je Jahr“ (unterlagen-eingang.js jahresInRahmen)
        zeigt die Posten nicht mehr flach, sondern in den Blöcken A bis E der
        Anlage V, wie sie das Steuerformular schon führt (anlage-v-kern.js
        BLOECKE). Je Posten die Zeile der Anlage V des Jahres.
     2. Jede Beleg-Position trägt ihre Zuordnung: „Vorschlag der KI“ (aus der
        Kategorie beim Einlesen) oder „von dir zugeordnet“. Wo eine Regel eine
        genauere Zeile sieht (Sammelposten, Einrichtung über 800 € netto),
        steht ein Vorschlag mit Grund daneben, nie still umgebucht.
     3. Umbuchen: eine Position wandert in einen anderen Posten. Der Betrag
        geht dabei mit, im Quellposten abgezogen und im Zielposten addiert,
        genau wie beim Einlesen (dpWkUebernehmen). Es entsteht ein Eintrag im
        Verlauf, der sich zurücknehmen lässt.

   FEST (nicht umbuchbar, weder Quelle noch Ziel)
     afa           kommt aus der AfA-Konfiguration, nie aus einem Beleg
     schuldzinsen  kommt aus dem Tilgungsplan. Ein Beleg dorthin würde den
                   Jahreswert der App ERSETZEN (dpWkUebernehmen ohne eigenen
                   Wert), ein Quartalsauszug also das ganze Jahr.

   SPERREN
     festgeschriebenes Jahr: DpJahresbuch.aenderungErlaubt, wie jede Eingabe
     Quellposten kleiner als die Position (seit der Übernahme von Hand
     gesenkt): keine Umbuchung, Hinweis statt Rechnung

   Sichtbar nur mit der Vorschau-Funktion grafiken_neu (DpVorschau).
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var VERSION = 'v4340';

  var FEST = { afa: 1, schuldzinsen: 1 };
  /* Ziele einer Umbuchung, in der Reihenfolge der Blöcke. Beschriftung wie POSTEN in unterlagen-eingang.js */
  var ZIELE = [
    ['B', 'sonst_bewegl_wg', 'AfA bewegliche Wirtschaftsgüter (Einrichtung, Küche)'],
    ['B', 'anschaffungsnah', 'Anschaffungsnahe Herstellungskosten'],
    ['C', 'bereitstellung', 'Bereitstellungszinsen'],
    ['C', 'notar_grundschuld', 'Notar und Grundbuch der Grundschuld'],
    ['C', 'vermittlung', 'Vermittlungsprovision Darlehen'],
    ['C', 'finanz_sonst', 'Sonstige Geldbeschaffungskosten'],
    ['C', 'kontofuehrung', 'Kontoführung'],
    ['D', 'erhaltungsaufwand', 'Erhaltungsaufwand'],
    ['E', 'nk_umlf', 'Umlagefähige Nebenkosten'],
    ['E', 'nk_n_umlf', 'Nicht umlagefähige Nebenkosten'],
    ['E', 'betr_sonst', 'Sonstige Betriebskosten (Grundsteuer, Versicherung)'],
    ['E', 'hausverwaltung', 'Hausverwaltung'],
    ['E', 'verw_sonst', 'Sonstige Verwaltungskosten'],
    ['E', 'steuerber', 'Steuerberatung'],
    ['E', 'fahrtkosten', 'Fahrtkosten'],
    ['E', 'hotel', 'Übernachtungskosten'],
    ['E', 'inserat', 'Inserate / Vermietung'],
    ['E', 'gericht', 'Gericht und Anwalt'],
    ['E', 'porto', 'Porto, Büromaterial'],
    ['E', 'telefon', 'Telefon und Internet'],
    ['E', 'sonst_kosten', 'Sonstige Kosten (Sammelposten)'],
    ['-', '', 'Nicht absetzbar (wird nicht gezählt)']
  ];
  var LABEL = {}; ZIELE.forEach(function (z) { LABEL[z[1]] = z[2]; });
  LABEL.schuldzinsen = 'Schuldzinsen'; LABEL.afa = 'AfA Gebäude';
  var TITEL = { A: 'Einnahmen', B: 'Abschreibungen', C: 'Finanzierung', D: 'Erhaltungsaufwand', E: 'Laufende Kosten', '-': 'Nicht angesetzt' };

  function blockVon(f) {
    if (!f) return '-';
    var K = window.AnlageVKern;
    var b = K && K.blockVon ? K.blockVon(f) : null;
    if (b && b !== 'F') return b;
    for (var i = 0; i < ZIELE.length; i++) if (ZIELE[i][1] === f) return ZIELE[i][0];
    return f === 'schuldzinsen' ? 'C' : f === 'afa' ? 'B' : 'E';
  }
  function zeile(jahr, f) {
    var K = window.AnlageVKern;
    try { var z = K && K.zeileFuer ? K.zeileFuer(jahr, f) : null; return z ? z.zeile : null; } catch (e) { return null; }
  }
  function zahl(v) { var n = Number(v); return isFinite(n) ? n : 0; }
  function r2(v) { return Math.round(zahl(v) * 100) / 100; }
  function eur(v) { return zahl(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ── Vorschlag ────────────────────────────────────────────────────────
     Nur, wo eine Regel eine genauere Zeile kennt. Kein Vorschlag heißt: die
     Zuordnung der KI ist plausibel. */
  var REGELN = [
    { re: /einbauk[üu]che|k[üu]chenzeile|m[öo]bel|waschmaschine|k[üu]hlschrank|geschirrsp[üu]l|herd\b|backofen|dunstabzug/i, von: ['erhaltungsaufwand', 'sonst_kosten', 'betr_sonst'],
      ziel: 'sonst_bewegl_wg', nurUeber: 952, grund: 'Einrichtung über 800 € netto wird über die Nutzungsdauer abgeschrieben, nicht sofort (§ 6 Abs. 2 EStG).' },
    { re: /grundsteuer|geb[äa]udeversicherung|wohngeb[äa]ude|haftpflicht|m[üu]llabfuhr|abfall|stra[ßs]enreinigung|schornstein|wasserversorgung|abwasser|entw[äa]sserung/i, von: ['sonst_kosten'],
      ziel: 'betr_sonst', grund: 'Steht in der Anlage V bei den umgelegten bzw. nicht umgelegten Kosten, nicht bei den sonstigen.' },
    { re: /hausverwalt|verwalterverg[üu]tung|verwaltergeb[üu]hr|mietverwalt|sondereigentumsverwalt/i, von: ['sonst_kosten', 'betr_sonst', 'verw_sonst'],
      ziel: 'hausverwaltung', grund: 'Verwaltungskosten haben einen eigenen Posten (Zeile der nicht umgelegten Kosten).' },
    { re: /steuerberat/i, von: ['sonst_kosten', 'verw_sonst'], ziel: 'steuerber', grund: 'Steuerberatung für die Vermietung hat einen eigenen Posten.' },
    { re: /rechtsanwalt|anwaltskanzlei|gerichtskosten|amtsgericht|mahnbescheid/i, von: ['sonst_kosten'], ziel: 'gericht', grund: 'Gerichts- und Anwaltskosten haben einen eigenen Posten.' },
    { re: /kontof[üu]hrung|kontogeb[üu]hr|bankgeb[üu]hr/i, von: ['sonst_kosten', 'betr_sonst'], ziel: 'kontofuehrung', grund: 'Kontoführung steht in der Anlage V ausdrücklich bei den nicht umgelegten Kosten.' },
    { re: /hotel|[üu]bernachtung|pension\b/i, von: ['sonst_kosten', 'inserat'], ziel: 'hotel', grund: 'Übernachtung bei Fahrten zur Immobilie hat einen eigenen Posten.' },
    { re: /grundschuld|grundbuchamt|grundbucheintrag/i, von: ['sonst_kosten', 'gericht', 'finanz_sonst'], ziel: 'notar_grundschuld', grund: 'Notar und Grundbuch für die Grundschuld sind Geldbeschaffungskosten.' }
  ];
  function vorschlag(b) {
    if (!b || FEST[b.feld]) return null;
    var t = [b.position, b.aussteller, b.kategorie, b.datei].join(' ');
    for (var i = 0; i < REGELN.length; i++) {
      var R = REGELN[i];
      if (R.ziel === b.feld || R.von.indexOf(b.feld) < 0 || !R.re.test(t)) continue;
      if (R.nurUeber && !(zahl(b.betrag) > R.nurUeber)) continue;
      return { feld: R.ziel, label: LABEL[R.ziel] || R.ziel, grund: R.grund };
    }
    return null;
  }

  /* ── Eingang lesen und schreiben (dasselbe versteckte Feld wie unterlagen-eingang.js) ── */
  function lesen() {
    try { return window.DpEingang && window.DpEingang.lesen ? window.DpEingang.lesen() : {}; } catch (e) { return {}; }
  }
  function schreiben(o) {
    var f = document.getElementById('_dok_eingang'); if (!f) return false;
    f.value = JSON.stringify(o);
    try { f.dispatchEvent(new Event('input', { bubbles: true })); f.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
    return true;
  }

  /** Gruppen eines Jahres: Blöcke A bis E (und „Nicht angesetzt“) mit ihren Posten und Positionen.
      zeilen = die Posten aus unterlagen-eingang.js (_jahrDaten), damit Wert und Herkunft dieselben bleiben. */
  function gruppen(jahr, zeilen) {
    var o = lesen(), B = [];
    (o.buchungen || []).forEach(function (b, i) { if (Number(b.jahr) === Number(jahr)) B.push({ i: i, b: b }); });
    var G = {}, reihe = ['A', 'B', 'C', 'D', 'E', '-'];
    reihe.forEach(function (k) { G[k] = { k: k, titel: TITEL[k], posten: [], summe: 0 }; });
    var st = function (f) { try { return typeof window.dpWkStand === 'function' ? window.dpWkStand(jahr, f) : null; } catch (e) { return null; } };
    [['einnahmen_km', 'Mieteinnahmen (Kaltmiete)'], ['einnahmen_nk', 'Umlagen (umlagefähige Nebenkosten)']].forEach(function (p) {
      var s = st(p[0]); if (!s) return;
      var w = s.override != null ? s.override : zahl(s.auto);
      if (!w) return;
      G.A.posten.push({ feld: p[0], label: p[1], wert: w, zeile: zeile(jahr, p[0]), fest: true, belege: [], art: s.override != null ? 'eingetragen' : 'aus dem Reiter Miete bzw. der Bewirtschaftung' });
      G.A.summe += w;
    });
    (zeilen || []).forEach(function (z) {
      var k = blockVon(z.feld);
      var pos = B.filter(function (x) { return x.b.feld === z.feld; }).map(function (x) { return { i: x.i, b: x.b, vorschlag: vorschlag(x.b) }; });
      G[k].posten.push({ feld: z.feld, label: z.label, wert: z.wert, zeile: zeile(jahr, z.feld), fest: !!FEST[z.feld], belege: pos, summe: z.summe, rest: z.rest, art: z.art, schaetzung: z.schaetzung });
      if (k !== 'A') G[k].summe += zahl(z.wert);
    });
    var ohne = B.filter(function (x) { return !x.b.feld; });
    if (ohne.length) {
      G['-'].posten.push({ feld: '', label: 'Nicht absetzbar', wert: 0, zeile: null, fest: false, belege: ohne.map(function (x) { return { i: x.i, b: x.b, vorschlag: null }; }), summe: ohne.reduce(function (s, x) { return s + zahl(x.b.betrag); }, 0) });
    }
    return reihe.map(function (k) { return G[k]; }).filter(function (g) { return g.posten.length; });
  }

  /** Eine Position umbuchen. idx = Stelle in buchungen, ziel = Feld ('' = nicht absetzbar). */
  function umbuchen(idx, ziel) {
    ziel = ziel || '';
    var o = lesen(), b = (o.buchungen || [])[idx];
    if (!b) return { ok: false, grund: 'Die Position gibt es nicht mehr.' };
    var von = b.feld || '', j = Number(b.jahr), betrag = r2(b.betrag);
    if (von === ziel) return { ok: false, grund: 'Steht schon dort.' };
    if (FEST[von] || FEST[ziel]) return { ok: false, grund: (LABEL[FEST[von] ? von : ziel]) + ' kommt fest aus ' + ((FEST[von] ? von : ziel) === 'afa' ? 'der AfA-Konfiguration' : 'dem Tilgungsplan') + ' und wird nicht umgebucht.' };
    if (ziel && !LABEL[ziel]) return { ok: false, grund: 'Unbekannter Posten.' };
    if (!betrag) return { ok: false, grund: 'Die Position hat keinen Betrag.' };
    if (window.DpJahresbuch && typeof window.DpJahresbuch.aenderungErlaubt === 'function' && !window.DpJahresbuch.aenderungErlaubt(j)) {
      return { ok: false, grund: 'Das Jahr ' + j + ' ist festgeschrieben. Erst wieder freigeben, dann umbuchen.' };
    }
    var stand = function (f) { try { return window.dpWkStand(j, f); } catch (e) { return { override: null, auto: null }; } };
    if (von) {
      var sv = stand(von);
      if (sv.override == null || sv.override + 0.5 < betrag) {
        return { ok: false, grund: 'Der Posten „' + (LABEL[von] || von) + '“ enthält die Position nicht mehr (' + (sv.override == null ? 'zeigt den Wert der App' : 'steht bei ' + eur(sv.override)) + '). Bitte im Reiter Steuer prüfen.' };
      }
    }
    if (typeof window.dpWkUebernehmen !== 'function' || typeof window._setYearOverride !== 'function') return { ok: false, grund: 'Steuer-Modul nicht geladen.' };
    var E = window.DpEingang && window.DpEingang.txStart ? window.DpEingang : null;
    if (E) E.txStart();
    if (von) {
      var rest = r2(stand(von).override - betrag);
      /* Bleibt nichts übrig, fällt der eigene Wert weg und der Vorschlag der App erscheint wieder,
         wie vor dem Einlesen. Sonst bleibt der Rest stehen, mit Herkunft Beleg. */
      if (Math.abs(rest) < 0.005) window._setYearOverride(j, von, '');
      else window.dpWkUebernehmen(j, (function () { var p = {}; p[von] = -betrag; return p; })(), 'add');
    }
    if (ziel) window.dpWkUebernehmen(j, (function () { var p = {}; p[ziel] = betrag; return p; })(), 'add');
    var aend = E ? E.txEnde() : [];
    o = lesen();
    var b2 = (o.buchungen || [])[idx];
    if (b2) {
      b2.feld = ziel; b2.zuordnung = 'hand';
      (b2.umgebucht = Array.isArray(b2.umgebucht) ? b2.umgebucht : []).push({ von: von, nach: ziel, am: new Date().toISOString().slice(0, 10) });
      schreiben(o);
    }
    var txt = 'Steuer ' + j + ' · ' + (b.position || b.datei || 'Position') + ' ' + eur(betrag) + ': ' + (LABEL[von] || von || 'nicht absetzbar') + ' → ' + (LABEL[ziel] || 'nicht absetzbar');
    try { if (E && E.protokoll) E.protokoll({ quelle: 'Umbuchung', aenderungen: aend, dokumente: b.datei ? [{ name: b.datei, typ: 'Beleg' }] : [], uebernommen: [txt],
      umbuchung: { eid: b.eid || null, datei: b.datei || '', position: b.position || '', betrag: betrag, jahr: j, von: von, nach: ziel } }); } catch (e) {}
    ['renderYearlyTaxForm', 'renderTaxTimeline', 'renderTaxModule'].forEach(function (f) { try { if (typeof window[f] === 'function') window[f](); } catch (e) {} });
    try { if (typeof window.calc === 'function') setTimeout(window.calc, 60); } catch (e) {}
    return { ok: true, text: txt, von: von, nach: ziel, jahr: j, betrag: betrag };
  }

  /* ── Ansicht ─────────────────────────────────────────────────────────── */
  function an() { try { return !!(window.DpVorschau && window.DpVorschau.istFrei && window.DpVorschau.istFrei('grafiken_neu')); } catch (e) { return false; } }
  function css() {
    if (document.getElementById('bav-css')) return;
    var s = document.createElement('style'); s.id = 'bav-css';
    s.textContent = '.bav-blk{margin:0 0 12px}'
      + '.bav-kopf{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:6px 2px;border-bottom:2px solid var(--wl-c9a84c, #C9A84C);margin-bottom:6px}'
      + '.bav-kopf b{font:700 12.5px/1.3 "Space Grotesk",Inter,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--ch,#2A2727)}'
      + '.bav-kopf b i{font-style:normal;display:inline-block;min-width:20px;text-align:center;margin-right:6px;padding:1px 5px;border-radius:5px;background:#2A2727;color:#fff;font-size:11px}'
      + '.bav-kopf span{font:600 12.5px/1.3 Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums;color:var(--ch,#2A2727)}'
      + '.ue-bj .bav-z{display:inline-block;font:600 10px/1.4 "JetBrains Mono",monospace;color:var(--muted,#7A7370);border:1px solid var(--border,#E7E2DC);border-radius:4px;padding:0 4px;margin-left:6px;vertical-align:1px}'
      + '.ue-bj .bav-fest{display:inline-block;font-size:10px;font-weight:700;padding:1px 6px;border-radius:5px;margin-right:4px;background:rgba(42,39,39,.06);color:var(--muted,#7A7370)}'
      + '.ue-bj .bav-ki{display:inline-block;font-size:10px;padding:0 5px;border-radius:4px;margin-left:4px;background:rgba(63,165,108,.10);color:#2E7D52}'
      + '.ue-bj .bav-hand{display:inline-block;font-size:10px;padding:0 5px;border-radius:4px;margin-left:4px;background:rgba(42,39,39,.07);color:var(--ch,#2A2727)}'
      + '.ue-bj .bav-um{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px}'
      + '.ue-bj .bav-um select{max-width:100%;font:12px Inter,system-ui,sans-serif;padding:3px 6px;border:1px solid var(--border,#E7E2DC);border-radius:6px;background:#fff;color:var(--ch,#2A2727)}'
      + '.ue-bj .bav-vs{margin-top:4px;padding:5px 8px;border-radius:6px;background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 8%, #fff);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 30%, transparent);font-size:11.5px;line-height:1.4}'
      + '.ue-bj .bav-vs button,.ue-bj .bav-um button{font:600 11.5px Inter,system-ui,sans-serif;padding:3px 9px;border-radius:6px;border:1px solid var(--wl-c9a84c, #C9A84C);background:#fff;color:var(--ch,#2A2727);cursor:pointer}'
      + '.ue-bj .bav-msg{margin:0 0 10px;padding:7px 10px;border-radius:8px;font-size:12px}'
      + '.ue-bj .bav-msg.ok{background:rgba(63,165,108,.10);color:#2E7D52}.ue-bj .bav-msg.nein{background:rgba(184,98,92,.10);color:#8E3F39}';
    document.head.appendChild(s);
  }
  function zielOptionen(aktuell) {
    var h = '', blk = null;
    ZIELE.forEach(function (z) {
      if (z[0] !== blk) { if (blk !== null) h += '</optgroup>'; blk = z[0]; h += '<optgroup label="' + esc(TITEL[blk]) + '">'; }
      h += '<option value="' + z[1] + '"' + (z[1] === (aktuell || '') ? ' selected' : '') + '>' + esc(z[2]) + '</option>';
    });
    return h + '</optgroup>';
  }
  var _msg = null;   /* { ok, text } nach einer Umbuchung, einmal angezeigt */
  function html(jahr, zeilen) {
    css();
    var G = gruppen(jahr, zeilen), h = '';
    if (_msg) { h += '<div class="bav-msg ' + (_msg.ok ? 'ok' : 'nein') + '">' + esc(_msg.text) + '</div>'; _msg = null; }
    G.forEach(function (g) {
      h += '<div class="bav-blk" data-bav-blk="' + g.k + '"><div class="bav-kopf"><b><i>' + (g.k === '-' ? '·' : g.k) + '</i>' + esc(g.titel) + '</b><span>' + (g.k === '-' ? '' : eur(g.summe)) + '</span></div>';
      g.posten.forEach(function (p) {
        var liste = p.belege.map(function (x) {
          var b = x.b, vivi = b.quelle === 'ViVi' || b.datei === 'ViVi', hand = b.zuordnung === 'hand';
          var um = p.fest || vivi ? '' : '<div class="bav-um"><select data-bav-sel="' + x.i + '" aria-label="Posten der Anlage V">' + zielOptionen(b.feld) + '</select><button type="button" data-bav-um="' + x.i + '">Umbuchen</button></div>';
          var vs = x.vorschlag ? '<div class="bav-vs">Vorschlag: <b>' + esc(x.vorschlag.label) + '</b>. ' + esc(x.vorschlag.grund) + ' <button type="button" data-bav-vs="' + x.i + '" data-bav-ziel="' + x.vorschlag.feld + '">Übernehmen</button></div>' : '';
          return '<div class="bj-b"><span>' + esc(b.position || '—') + (vivi ? '' : (hand ? '<span class="bav-hand">von dir zugeordnet</span>' : '<span class="bav-ki">Vorschlag der KI</span>'))
            + '<small>' + (vivi ? 'aus ViVi' : esc(b.datei)) + (b.aussteller ? ' · ' + esc(b.aussteller) : '') + '</small>' + vs + um + '</span>'
            + '<span class="bj-d">' + esc(/^\d{4}-\d{2}-\d{2}$/.test(String(b.datum || '')) ? String(b.datum).split('-').reverse().join('.') : (b.datum || '')) + '<small>übernommen ' + esc(String(b.am || '').split('-').reverse().join('.')) + '</small></span>'
            + '<span class="bj-z">' + eur(b.betrag) + '</span></div>';
        }).join('');
        var hin = p.art ? '<div class="bj-hin' + (p.rest != null && p.rest < -0.5 ? ' bj-warn' : '') + '">' + (p.rest != null && Math.abs(p.rest) >= 0.5 && p.belege.length && p.rest > 0 ? 'Übriger Betrag ' + eur(p.rest) + ': ' : '') + esc(p.art) + '</div>' : '';
        if (p.feld === 'schuldzinsen' && p.belege.length) hin += '<div class="bj-hin bj-warn">Schuldzinsen kommen aus dem Tilgungsplan. Ein eingelesener Zinsbeleg ersetzt dort den Jahreswert der App. Deckt er nicht das ganze Jahr ab, bitte im Reiter Steuer prüfen.</div>';
        h += '<details' + (p.belege.length ? ' open' : '') + '><summary><span class="bj-p">' + esc(p.label) + (p.zeile != null ? '<span class="bav-z" title="Anlage V ' + jahr + ', Zeile ' + p.zeile + '">Z. ' + p.zeile + '</span>' : '')
          + '<small>' + (p.fest ? '<span class="bav-fest">' + (p.feld === 'afa' ? 'fest aus der AfA' : p.feld === 'schuldzinsen' ? 'fest aus dem Tilgungsplan' : 'fest aus Miete und Bewirtschaftung') + '</span>' : '')
          + (p.belege.length ? p.belege.length + (p.belege.length === 1 ? ' Position' : ' Positionen') : '') + '</small></span>'
          + '<span class="bj-z bj-zb">' + (p.belege.length ? eur(p.summe) + '<small>aus Belegen</small>' : '') + '</span>'
          + '<span class="bj-z"><b>' + (p.feld ? eur(p.wert) : '') + '</b><small>' + (p.feld ? 'im Jahr ' + jahr : 'nicht gezählt') + '</small></span></summary>'
          + (liste || hin ? '<div class="bj-liste">' + liste + hin + '</div>' : '') + '</details>';
      });
      h += '</div>';
    });
    return h || '<p class="oabi-sub" style="padding:0">Für ' + jahr + ' steht kein Posten.</p>';
  }
  /** Klicks im Rahmen von „Belege je Jahr“. neu = function () zeichnet den Rahmen neu. */
  function klick(e, neu) {
    var t = e.target, k = t.closest && (t.closest('[data-bav-um]') || t.closest('[data-bav-vs]'));
    if (!k) return false;
    var idx, ziel;
    if (k.hasAttribute('data-bav-um')) {
      idx = Number(k.getAttribute('data-bav-um'));
      var sel = k.parentNode && k.parentNode.querySelector('[data-bav-sel]');
      ziel = sel ? sel.value : null;
    } else { idx = Number(k.getAttribute('data-bav-vs')); ziel = k.getAttribute('data-bav-ziel'); }
    if (ziel == null) return true;
    var r = umbuchen(idx, ziel);
    _msg = r.ok ? { ok: true, text: 'Umgebucht: ' + r.text + '. Im Verlauf zurücknehmbar.' } : { ok: false, text: r.grund };
    if (typeof neu === 'function') neu();
    return true;
  }

  window.DpBelegeAv = { VERSION: VERSION, an: an, html: html, klick: klick, gruppen: gruppen, umbuchen: umbuchen, vorschlag: vorschlag, blockVon: blockVon, ZIELE: ZIELE, FEST: FEST };
})();
