/* hausverlauf.js — v3323 · PILOT-ANALYSE: REITER „HAUSVERLAUF"
   ───────────────────────────────────────────────────────────────────────────
   Marcel 12.11.2026: „wenn ich WEG-Protokoll hochgeladen habe, dass da vielleicht der Verlauf mit drinne
   steht, was passiert ist … und dann können wir Unterlagen WEG vielleicht Dokumente hochladen."

   GEMESSEN (Staging, Lindenallee 14, 12.11.2026): die Auswertung der Unterlagen (#_dok_auswertung,
   unterlagen.js) trägt weg.kernpunkte nur mit JAHR („2025: Dachsanierung für 92.000 € beschlossen …"),
   weg.sanierungen mit Jahr und Status, weg.sonderumlagen als Text; Datum der Versammlung steht nur an
   den Dokumenten (dokumente[].datum). Die Sonderumlagen mit Fälligkeit und Raten liegen in #weg_su
   (sonderumlage.js). Seit v3323 verlangt die Auswertung zusätzlich weg.chronik – je Ereignis Datum, Art,
   Betrag, Status und Quelle (backend openaiService.js dokumenteAuswerten). Ältere Auswertungen ohne
   chronik werden aus kernpunkte, sanierungen und den Dokumentdaten zusammengesetzt – nichts erfunden.

     ereignisse(ausw, su, doks)  reine Funktion (Prüfer tools/hausverlauf-pruefen.mjs): Liste, älteste zuerst
     html()                      Inhalt des Unterreiters (leer → Einstieg zum Hochladen)
     kurz()                      { zahl, unter } für die Wegweiser-Karte der Übersicht
   Neue Unterlagen: derselbe Weg wie „Unterlagen nachreichen" (DpUnterlagen.nachreichen → Import, ergänzen). */
(function (g) {
  'use strict';
  if (g.DpHausverlauf) return;

  var ARTEN = {
    versammlung: ['Versammlung', '#2A2727'],
    beschluss: ['Beschluss', '#2A2727'],
    sonderumlage: ['Sonderumlage', '#B8625C'],
    instandhaltung: ['Instandhaltung', 'var(--wl-b8932f,#b8932f)'],
    schaden: ['Schaden', '#B8625C'],
    verwaltung: ['Verwaltung', '#5a7fd4'],
    ruecklage: ['Rücklage', '#3FA56C'],
    hausgeld: ['Hausgeld', '#3FA56C'],
    rechtsstreit: ['Rechtsstreit', '#B8625C'],
    sonstiges: ['Sonstiges', '#7A7370']
  };
  var WEG_TYPEN = /^(weg_protokoll|hausgeld|teilungserklaerung|wirtschaftsplan|jahresabrechnung)$/;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function zahl(v) { if (v == null || v === '') return null; var n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.')); return isFinite(n) ? n : null; }
  function eur(v) { return Math.round(v).toLocaleString('de-DE') + ' €'; }
  /** "18.06.2025" | "2025-06-18" → { iso, jahr, text } */
  function datumAus(s) {
    s = String(s == null ? '' : s).trim();
    var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return { iso: m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2), jahr: +m[3], text: ('0' + m[1]).slice(-2) + '.' + ('0' + m[2]).slice(-2) + '.' + m[3] };
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { iso: m[1] + '-' + m[2] + '-' + m[3], jahr: +m[1], text: m[3] + '.' + m[2] + '.' + m[1] };
    return null;
  }
  /** Art aus dem Text, wenn die Auswertung keine nennt */
  function artAus(t) {
    t = String(t || '').toLowerCase();
    if (/sonderumlage/.test(t)) return 'sonderumlage';
    if (/verwalter|verwaltung/.test(t)) return 'verwaltung';
    if (/r(ü|ue)cklage/.test(t)) return 'ruecklage';
    if (/hausgeld|wirtschaftsplan|jahresabrechnung/.test(t)) return 'hausgeld';
    if (/klage|gericht|rechtsstreit|anfechtung/.test(t)) return 'rechtsstreit';
    if (/schaden|feucht|riss|leck|mangel|m(ä|ae)ngel|defekt/.test(t)) return 'schaden';
    if (/sanierung|erneuer|reparatur|instand|anstrich|dach|fassade|heizung|fenster|aufzug|modernis/.test(t)) return 'instandhaltung';
    if (/beschl/.test(t)) return 'beschluss';
    return 'sonstiges';
  }
  function norm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, ' ').trim(); }

  /** Die Ereignisse, älteste zuerst. Jedes: { iso|null, jahr|null, datum (Text), art, titel, text, betrag, status, quelle, herkunft } */
  function ereignisse(ausw, su, doks) {
    var a = ausw && typeof ausw === 'object' ? ausw : {}, w = a.weg && typeof a.weg === 'object' ? a.weg : null, out = [];
    var push = function (e) {
      if (!e || !(e.titel || e.text)) return;
      e.art = ARTEN[e.art] ? e.art : artAus((e.titel || '') + ' ' + (e.text || ''));
      out.push(e);
    };
    /* 1 · Versammlungen aus den Dokumenten (Datum steht dort) */
    (Array.isArray(doks) ? doks : []).forEach(function (d) {
      if (!d || d.typ !== 'weg_protokoll') return;
      var dt = datumAus(d.datum); if (!dt) return;
      push({ iso: dt.iso, jahr: dt.jahr, datum: dt.text, art: 'versammlung', titel: 'Eigentümerversammlung', text: 'Protokoll liegt vor.', betrag: null, status: null, quelle: d.label || 'WEG-Protokoll', herkunft: 'dokument' });
    });
    /* 2 · die Chronik der Auswertung (seit v3323) – sonst die Kernpunkte mit Jahr */
    var chronik = w && Array.isArray(w.chronik) ? w.chronik.filter(function (x) { return x && typeof x === 'object'; }) : [];
    if (chronik.length) {
      chronik.forEach(function (c) {
        var dt = datumAus(c.datum), j = dt ? dt.jahr : (zahl(c.jahr) || null);
        push({ iso: dt ? dt.iso : null, jahr: j, datum: dt ? dt.text : (j ? String(j) : ''), art: String(c.art || '').toLowerCase(), titel: c.titel || '', text: c.text || '',
          betrag: zahl(c.betrag_eur), status: c.status || null, quelle: c.quelle || '', herkunft: 'chronik' });
      });
    } else if (w && Array.isArray(w.kernpunkte)) {
      w.kernpunkte.forEach(function (k) {
        var m = String(k || '').match(/^\s*((?:19|20)\d\d)(?:\s*[\/–-]\s*(?:19|20)?\d\d)?\s*[:–-]\s*([\s\S]*)$/);
        var j = m ? +m[1] : null, t = m ? m[2].trim() : String(k || '').trim();
        push({ iso: null, jahr: j, datum: j ? String(j) : '', art: '', titel: '', text: t, betrag: null, status: null, quelle: 'Auswertung der Unterlagen', herkunft: 'kernpunkt' });
      });
    }
    /* 3 · Maßnahmen mit Status (nur, wenn die Chronik sie nicht schon nennt) */
    if (w && Array.isArray(w.sanierungen)) w.sanierungen.forEach(function (s) {
      if (!s || !s.massnahme) return;
      var schon = out.some(function (e) { return e.herkunft === 'chronik' && norm(e.titel + ' ' + e.text).indexOf(norm(s.massnahme).split(' ')[0]) >= 0 && (!s.jahr || e.jahr === s.jahr); });
      if (schon) return;
      push({ iso: null, jahr: zahl(s.jahr), datum: s.jahr ? String(s.jahr) : '', art: 'instandhaltung', titel: s.massnahme, text: '', betrag: zahl(s.kosten_eur), status: s.status || null, quelle: 'Maßnahmen der Gemeinschaft', herkunft: 'massnahme' });
    });
    /* 4 · Sonderumlagen mit Fälligkeit (#weg_su) – Anteil dieses Objekts */
    (Array.isArray(su) ? su : []).forEach(function (s) {
      if (!s || typeof s !== 'object') return;
      var dt = datumAus(s.faellig), j = dt ? dt.jahr : zahl(s.jahr), b = zahl(s.betrag);
      push({ iso: dt ? dt.iso : null, jahr: j, datum: dt ? dt.text : (j ? String(j) : ''), art: 'sonderumlage', titel: 'Sonderumlage' + (s.zweck ? ': ' + s.zweck : ''),
        text: b != null ? 'Anteil dieses Objekts ' + eur(b) + (dt ? ', fällig am ' + dt.text : '') + '.' : '', betrag: b, status: s.status || 'beschlossen', quelle: s.quelle || 'Sonderumlagen (Reiter Bewirtschaftung)', herkunft: 'sonderumlage', anteil: true });
    });
    /* sortieren: Jahr, dann Datum; ohne Datum innerhalb des Jahres hinter den datierten in Eingangsreihenfolge */
    out.forEach(function (e, i) { e._i = i; });
    out.sort(function (x, y) {
      var jx = x.jahr || 9999, jy = y.jahr || 9999;
      if (jx !== jy) return jx - jy;
      if (x.iso && y.iso) return x.iso < y.iso ? -1 : x.iso > y.iso ? 1 : x._i - y._i;
      if (x.iso && !y.iso) return -1;
      if (!x.iso && y.iso) return 1;
      return x._i - y._i;
    });
    out.forEach(function (e) { delete e._i; });
    return out;
  }

  /* ── Browser ───────────────────────────────────────────────────────── */
  function el(id) { return typeof document !== 'undefined' ? document.getElementById(id) : null; }
  function lesen() {
    var d = null, su = [];
    try { var f = el('_dok_auswertung'); d = f && f.value ? JSON.parse(f.value) : null; } catch (e) { d = null; }
    try { su = g.DpSonderumlage && g.DpSonderumlage.liste ? g.DpSonderumlage.liste() : []; } catch (e) { su = []; }
    var doks = d && Array.isArray(d.dokumente) ? d.dokumente : [];
    var hatWeg = !!(d && d.auswertung && d.auswertung.weg) || doks.some(function (x) { return x && WEG_TYPEN.test(String(x.typ || '')); }) || su.length > 0;
    return { d: d, su: su, doks: doks, hatWeg: hatWeg, liste: ereignisse(d && d.auswertung, su, doks) };
  }
  function kurz() {
    var L = lesen(); if (!L.hatWeg || !L.liste.length) return null;
    var j = L.liste.map(function (e) { return e.jahr; }).filter(Boolean);
    return { zahl: L.liste.length + ' Ereignisse', unter: j.length ? 'aus WEG-Unterlagen ' + Math.min.apply(null, j) + '–' + Math.max.apply(null, j) : 'aus WEG-Unterlagen' };
  }
  function stil() {
    if (document.getElementById('dp-hv-stil')) return;
    var s = document.createElement('style'); s.id = 'dp-hv-stil';
    s.textContent = [
      '.dp-hv-lage{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:0 0 12px}',
      '.dp-hv-k{border:1px solid #E6DCC2;border-radius:12px;background:#fff;padding:11px 13px;display:grid;gap:3px;align-content:start;min-width:0}',
      '.dp-hv-k small{font:600 10px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B645A}',
      '.dp-hv-k p{margin:0;font:400 12.5px/1.55 Inter,sans-serif;color:#2A2727;text-align:justify;hyphens:auto}',
      '.dp-hv-filter{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}',
      '.dp-pa-wrap .dp-hv-filter button{border:1px solid #E6DCC2 !important;background:#fff !important;border-radius:999px !important;padding:3px 10px !important;font:500 11.5px Inter,sans-serif !important;cursor:pointer;color:#2A2727 !important;box-shadow:none !important;min-height:0 !important}',
      '.dp-pa-wrap .dp-hv-filter button[aria-pressed="false"]{opacity:.45}',
      '.dp-hv-filter i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:0}',
      '.dp-hv-zeit{position:relative;margin:4px 0 0;padding:0 0 0 22px}',
      '.dp-hv-zeit::before{content:"";position:absolute;left:6px;top:4px;bottom:4px;width:2px;background:#E6DCC2}',
      '.dp-hv-jahr{font:700 15px "Space Grotesk",Inter,sans-serif;color:#2A2727;margin:14px 0 6px -22px;padding-left:0}',
      '.dp-hv-jahr:first-child{margin-top:0}',
      '.dp-hv-e{position:relative;border:1px solid #EFE8D6;border-radius:10px;background:#fff;padding:9px 12px;margin:0 0 8px;display:grid;gap:3px}',
      '.dp-hv-e::before{content:"";position:absolute;left:-21px;top:13px;width:10px;height:10px;border-radius:50%;background:var(--c,#2A2727);border:2px solid #fff;box-shadow:0 0 0 1px #E6DCC2}',
      '.dp-hv-kopf{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:baseline}',
      '.dp-hv-kopf .d{font:600 11px "JetBrains Mono",monospace;color:#7A7370}',
      '.dp-hv-kopf .a{font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--c,#2A2727)}',
      '.dp-hv-kopf b{font:600 13.5px Inter,sans-serif;color:#2A2727}',
      '.dp-hv-kopf .betrag{margin-left:auto;font:700 13px "Space Grotesk",Inter,sans-serif;color:#2A2727;font-variant-numeric:tabular-nums}',
      '.dp-hv-e p{margin:0;font:400 12.5px/1.55 Inter,sans-serif;color:#4A4542;text-align:justify;hyphens:auto}',
      '.dp-hv-e .q{font:400 11px Inter,sans-serif;color:#9A9285}',
      '.dp-hv-st{display:inline-block;font:600 10.5px Inter,sans-serif;padding:1px 8px;border-radius:999px;background:rgba(42,39,39,.07);color:#4A4542}',
      '.dp-hv-st.beschlossen{background:rgba(184,98,92,.13);color:#B8625C}.dp-hv-st.erledigt{background:rgba(63,165,108,.14);color:#2f7d52}',
      '.dp-hv-st.geplant,.dp-hv-st.angekuendigt{background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 18%, transparent);color:#8a6d1f}',
      '.dp-pa-wrap[data-dp-pa-modus="einfach"] .dp-hv-e.leise{display:none}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function knoepfe() {
    return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
      + '<button type="button" class="btn-clean dp-pa4-btn" onclick="try{if(window.DpUnterlagen&&DpUnterlagen.nachreichen)DpUnterlagen.nachreichen();else if(window.DpEingang)DpEingang.oeffnen();}catch(e){}">WEG-Unterlagen hochladen</button>'
      + '<button type="button" class="btn-clean dp-pa4-btn leise" data-dp-pa4-geh="unterlagen">Zu Unterlagen &amp; WEG</button></div>';
  }
  function html() {
    if (typeof document === 'undefined') return '';
    stil();
    var L = lesen();
    var leer = '<div class="dp-pa-card"><div class="dp-pa-sec"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">Hausverlauf</span><span class="dp-pa-rule"></span></div>'
      + '<p class="dp-pa-p">Hier steht, was in der Eigentümergemeinschaft passiert ist – Versammlungen, Beschlüsse, Sonderumlagen, Instandhaltung und Verwalterwechsel, nach Jahren geordnet. '
      + 'Die Grundlage sind die WEG-Unterlagen dieses Objekts: Protokolle der Eigentümerversammlung, Wirtschaftspläne und Hausgeldabrechnungen.</p>'
      + '<p class="dp-pa-p">Noch ist keine WEG-Unterlage eingelesen. Lade ein Protokoll hoch – nichts wird ohne deine Bestätigung ins Objekt übernommen.</p>' + knoepfe() + '</div>';
    if (!L.hatWeg || !L.liste.length) return leer;
    var w = (L.d && L.d.auswertung && L.d.auswertung.weg) || {};
    /* oben: der Stand heute in drei Karten (Verwaltung, Rücklage, Hausgeld) + Fazit */
    var lage = [['Verwaltung', w.verwaltung], ['Erhaltungsrücklage', w.ruecklage], ['Hausgeld', w.hausgeld]].filter(function (x) { return x[1] && String(x[1]).trim(); });
    var h = '';
    if (lage.length || w.fazit) h += '<div class="dp-pa-card"><div class="dp-pa-sec"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">Die Gemeinschaft heute</span><span class="dp-pa-rule"></span></div>'
      + (w.fazit ? '<p class="dp-pa-p">' + esc(w.fazit) + '</p>' : '')
      + (lage.length ? '<div class="dp-hv-lage" style="margin-top:8px">' + lage.map(function (x) { return '<div class="dp-hv-k"><small>' + esc(x[0]) + '</small><p>' + esc(x[1]) + '</p></div>'; }).join('') + '</div>' : '') + '</div>';
    /* die Zeitleiste, nach Jahren */
    var arten = []; L.liste.forEach(function (e) { if (arten.indexOf(e.art) < 0) arten.push(e.art); });
    var filter = arten.length > 1 ? '<div class="dp-hv-filter" role="group" aria-label="Nach Art filtern">' + arten.map(function (a) {
      return '<button type="button" class="btn-clean" aria-pressed="true" data-dp-hv-art="' + a + '"><i style="background:' + ARTEN[a][1] + '"></i>' + ARTEN[a][0] + '</button>';
    }).join('') + '</div>' : '';
    var zeit = '', jahr = null;
    L.liste.forEach(function (e) {
      var j = e.jahr || 'ohne Jahr';
      if (j !== jahr) { zeit += '<div class="dp-hv-jahr">' + esc(j) + '</div>'; jahr = j; }
      var A = ARTEN[e.art] || ARTEN.sonstiges, st = String(e.status || '').toLowerCase();
      /* Einfach: reine Versammlungsmarken ohne Inhalt treten zurück */
      zeit += '<div class="dp-hv-e' + (e.art === 'versammlung' ? ' leise' : '') + '" data-dp-hv-e="' + e.art + '" style="--c:' + A[1] + '"><div class="dp-hv-kopf">'
        + (e.datum && e.datum !== String(e.jahr) ? '<span class="d">' + esc(e.datum) + '</span>' : '')
        + '<span class="a">' + A[0] + '</span>' + (e.titel ? '<b>' + esc(e.titel) + '</b>' : '')
        + (st ? '<span class="dp-hv-st ' + esc(st.replace(/[^a-zäöü]/g, '')) + '">' + esc(e.status) + '</span>' : '')
        + (e.betrag != null ? '<span class="betrag">' + eur(e.betrag) + (e.anteil ? ' <small style="font:400 10.5px Inter;color:#7A7370">Anteil</small>' : '') + '</span>' : '') + '</div>'
        + (e.text ? '<p>' + esc(e.text) + '</p>' : '') + (e.quelle ? '<span class="q dp-pa-d">Quelle: ' + esc(e.quelle) + '</span>' : '') + '</div>';
    });
    h += '<div class="dp-pa-card dp-pa4-mt"><div class="dp-pa-sec"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">Was passiert ist</span><span class="dp-pa-rule"></span></div>'
      + filter + '<div class="dp-hv-zeit">' + zeit + '</div>'
      + (L.liste.some(function (e) { return e.herkunft === 'kernpunkt'; }) ? '<p class="dp-pa-fuss">Diese Auswertung nennt die Ereignisse nur mit Jahr. Beim nächsten Einlesen von Unterlagen steht jedes mit seinem Datum und seiner Quelle hier.</p>' : '')
      + '</div>';
    h += '<div class="dp-pa-card dp-pa4-mt"><div class="dp-pa-sec"><span class="dp-pa-bar"></span><span class="dp-pa-lbl">Weitere WEG-Unterlagen</span><span class="dp-pa-rule"></span></div>'
      + '<p class="dp-pa-p">Ein neues Protokoll oder einen neuen Wirtschaftsplan hochladen: die Auswertung wird mit den bisherigen Unterlagen zusammengeführt, der Verlauf ergänzt. Nichts wird ohne deine Bestätigung ins Objekt übernommen.</p>'
      + '<p class="dp-pa-p" style="font-size:12px;color:#7A7370">Eingelesen: ' + L.doks.filter(function (x) { return x && WEG_TYPEN.test(String(x.typ || '')); }).map(function (x) { return esc(x.label + (x.datum ? ' ' + x.datum : '')); }).join(' · ') + '</p>'
      + knoepfe() + '</div>';
    return h;
  }
  if (typeof document !== 'undefined') document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-dp-hv-art]') : null; if (!b) return;
    var an = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(an));
    var card = b.closest('.dp-pa-card'), art = b.getAttribute('data-dp-hv-art');
    if (card) Array.prototype.forEach.call(card.querySelectorAll('[data-dp-hv-e="' + art + '"]'), function (e) { e.style.display = an ? '' : 'none'; });
  });

  g.DpHausverlauf = { VERSION: 'v3323', ereignisse: ereignisse, html: html, kurz: kurz, lesen: lesen, ARTEN: ARTEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = g.DpHausverlauf;
})(typeof window !== 'undefined' ? window : globalThis);
