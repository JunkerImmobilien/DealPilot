/* ============================================================================
   DealPilot v2087 — mietvertrag-objekt.js  ·  Backlog N60.8-alt

   Marcel: „Es soll auch eine Angabe zu Mietverträgen gemacht werden können,
   also was für ein Mietvertrag, seit wann der besteht und wann die letzte
   Erhöhung gewesen ist. Das muss für JEDEN Objekttyp und auch für einzelne
   Wohnungen innerhalb eines MFH möglich sein."

   Die Wohnungen im MFH hatten das seit v2021/v2022. Die Objektebene nicht —
   gemessen am 10.10.2026: null Treffer für `mv_art` in `index.html`. Für eine
   ETW, ein EFH oder ein einzelvermietetes Objekt gab es gar keine
   Vertragsangabe.

   ── DIESES MODUL FÜLLT NUR, ES FÜHRT KEINE LISTE ─────────────────────────

   Die elf Vertragsformen stehen in `mfh-einheiten.js` (`MIETVERTRAG_ARTEN`,
   mit Fundstelle je Form) und werden seit v2087 mitexportiert. Hier wird sie
   GELESEN, nicht wiederholt.

   > Zwei Listen derselben elf Vertragsformen wären der Anfang der
   > Abweichung — dieselbe Lehre wie bei den Modernisierungspunkten
   > (v2075: vier Stellen vergaben Anlage-2-Punkte, drei davon anders).

   ── UND BEIM MFH SAGT ES, WAS GILT ───────────────────────────────────────

   Bei einem Mehrfamilienhaus führen die EINHEITEN ihre Verträge. Ein
   Objektvertrag daneben wäre zweideutig: gilt er für das ganze Haus oder
   für nichts? Deshalb steht dort ein Hinweis mit der Zahl der Einheiten,
   die schon eine Vertragsart tragen — und die Felder bleiben bedienbar,
   weil ein MFH im Ganzen vermietet sein KANN (an einen Betreiber, als
   Werkswohnungen, als Gewerbeobjekt).
   ============================================================================ */
(function () {
  'use strict';
  if (window._dpMvObjInit) return;
  window._dpMvObjInit = true;

  function el(id) { return document.getElementById(id); }

  /* Die Optionen aus der EINEN Liste. Fehlt das Modul, bleibt das Select
     bei „keine Angabe" — besser als eine halbe Liste aus dem Gedächtnis. */
  function optionenFuellen() {
    var sel = el('mv_art');
    if (!sel || sel.dataset.dpGefuellt === '1') return !!sel;
    var arten = null;
    try {
      arten = window.DpMfhEinheiten && window.DpMfhEinheiten.vertragsarten;
    } catch (e) {}
    if (!Array.isArray(arten) || !arten.length) return false;
    var vorher = sel.value;
    sel.innerHTML = arten.map(function (a) {
      return '<option value="' + String(a[0]).replace(/"/g, '&quot;') + '">'
        + String(a[1]).replace(/[&<>]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
          })
        + '</option>';
    }).join('');
    if (vorher) sel.value = vorher;          /* einen geladenen Wert nicht verlieren */
    sel.dataset.dpGefuellt = '1';
    return true;
  }

  /* Beim MFH gehören die Verträge an die Einheiten — das gehört gesagt,
     nicht erzwungen. */
  function mfhHinweis() {
    var h = el('mv-objekt-mfh-hinweis');
    var art = el('objart');
    if (!h || !art) return;
    var istMfh = String(art.value || '').toUpperCase() === 'MFH';
    if (!istMfh) { h.style.display = 'none'; h.textContent = ''; return; }

    /* Wie viele Einheiten tragen schon eine Vertragsart?
       QUELLE IST `window._dpMfh` — derselbe Fenster-Merker, den
       `mfh-einheiten.js:45` liest (`function daten()`). Hier stand
       zuerst `window.getFormData()`; die Funktion gibt es NICHT, der
       Aufruf hätte nie getroffen und der Hinweis wäre immer in der
       Fassung „ohne Einheiten" erschienen.

       > Ein plausibler Zugriff, der nie trifft, ist teurer als ein
       > Fehler: er liefert ein gültiges Ergebnis. Die echte
       > Verdrahtung abschreiben, nicht die eigene erfinden. */
    var mit = 0, ges = 0;
    try {
      var m = window._dpMfh;
      var e = m && m.einheiten;
      if (Array.isArray(e)) {
        ges = e.length;
        e.forEach(function (x) { if (x && x.mv_art) mit++; });
      }
    } catch (e) {}

    h.style.display = '';
    h.textContent = ges
      ? 'Bei einem Mehrfamilienhaus führen die Wohnungen ihre eigenen Verträge — '
        + mit + ' von ' + ges + ' tragen schon eine Vertragsart. Diese Angabe hier '
        + 'gilt für das Haus als Ganzes (etwa bei Vermietung an einen Betreiber).'
      : 'Bei einem Mehrfamilienhaus gehören die Verträge zu den einzelnen '
        + 'Wohnungen — anzulegen über die Wohnungsliste im Reiter Objekt. Diese '
        + 'Angabe hier gilt für das Haus als Ganzes.';
  }

  /* ── v3027 · VERTRAGSÜBERSICHT STATT OBJEKTVERTRAG ─────────────────────
     Marcel 28.10.2026: „Macht es Sinn, im Tab Miete ‚Mietvertrag für dieses
     Objekt' anzugeben, wenn wir die Einheiten erfasst haben? Wir könnten
     dort eine Übersicht anzeigen … mit Absprung."
     Ab ZWEI erfassten Einheiten gelten deren Verträge: die Objektfelder
     bleiben gespeichert (storage.js), werden ausgeblendet und gehen nicht
     mehr in den Marktbericht (dealpilot-mb.js fragt einheitenGelten()).
     Wer sie sonst liest, gemessen 28.10.2026: potenzial.js nur ohne
     Einheitenliste (ETW-Pfad), ui.js/Pilot nimmt die Einheiten, calc.js
     liest keines der mv_-Felder - die Kennzahlen ändern sich nicht. */
  function einheiten() {
    try { var m = window._dpMfh; return m && Array.isArray(m.einheiten) ? m.einheiten.filter(Boolean) : []; } catch (e) { return []; }
  }
  function einheitenGelten() { return einheiten().length >= 2; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function zahl(x) {
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    var s = String(x == null ? '' : x).trim();
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');   /* 1.050,50 */
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');    /* 1.050 */
    var n = parseFloat(s); return isFinite(n) ? n : 0;
  }
  function datum(s) { var m = String(s || '').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); return m ? (m[3] ? m[3] + '.' : '') + m[2] + '.' + m[1] : ''; }
  function heuteYm() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }   /* v3028 */
  function mon(k) { return k ? k.slice(5, 7) + '/' + k.slice(0, 4) : ''; }
  function eur(x) { return (Math.round(x * 100) / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'; }
  function artName(a) {
    var l = (window.DpMfhEinheiten && window.DpMfhEinheiten.vertragsarten) || [];
    var t = l.filter(function (x) { return x[0] === a; })[0];
    return t ? String(t[1]).replace(/\s*\(.*\)$/, '') : '';
  }
  /** nächster möglicher Termin + was fehlt, je Einheit */
  function termin(e) {
    var P = window.DpPotenzial, art = String(e.mv_art || '');
    if (e.status === 'leer') return { text: 'leer', fehlt: [] };
    if (!(zahl(e.ist) > 0)) return { text: '', fehlt: ['Kaltmiete'] };
    if (!art) return { text: '', fehlt: ['Vertragsart'] };
    if (art === 'index') {
      var r = P && P.indexmieteFuer ? P.indexmieteFuer(e) : null;
      if (r && r.ok) return { text: 'Index: Erklärung ab ' + (r.naechste.erklaerung <= heuteYm() ? 'sofort' : mon(r.naechste.erklaerung)) + ' · wirksam ab ' + mon(r.naechste.wirksam) + ' ' + (r.naechste.plus_monat >= 0 ? '+' : '') + eur(r.naechste.plus_monat) + '/Monat' + (r.naechste.annahme ? ' (Annahme)' : ''), fehlt: [] };
      return { text: 'Indexmiete', fehlt: r && r.fehlt ? r.fehlt.map(function (f) { return /Mietbeginn/.test(f) ? 'Mietbeginn oder letzte Erhöhung' : f; }) : ['Mietbeginn oder letzte Erhöhung'] };
    }
    if (art === 'staffel') return e.mv_naechste_anpassung ? { text: 'nächste Staffel ' + datum(e.mv_naechste_anpassung), fehlt: [] } : { text: 'Staffel', fehlt: ['nächste Staffel'] };
    if (art === 'gewerbe' || e.art === 'gewerbe') return { text: 'nach Vertrag (Gewerbe)', fehlt: [] };
    if (art === 'moebliert_kurz') return { text: 'nach Vertrag', fehlt: [] };
    var s = P && P.sollFuer ? P.sollFuer(e, {}) : null;
    if (!e.mv_letzte_erhoehung && !e.mv_beginn) return { text: '§ 558', fehlt: ['letzte Erhöhung oder Mietbeginn'] };
    /* v3028 · nie mehr nur „sofort“: verlangbar ab · wirksam ab (DpPotenzial.mhTermine, § 558b Abs. 1 BGB) */
    var t = s && s.termine ? s.termine : (P && P.mhTermine ? P.mhTermine({ art: '558', letzte: e.mv_letzte_erhoehung }) : null);
    return { text: '§ 558: ' + (t ? t.text : '–'), titel: t ? t.text_lang : '', fehlt: [] };
  }
  var STIL = '#mv-einheiten-uebersicht{margin-top:4px}'
    + '#mv-einheiten-uebersicht .mveu-kopf{font:600 12.5px Inter,sans-serif;color:#2A2727;margin:0 0 8px}'
    + '#mv-einheiten-uebersicht .mveu-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}'
    + '#mv-einheiten-uebersicht table{width:100%;border-collapse:collapse;font:12px Inter,sans-serif;color:#2A2727}'
    + '#mv-einheiten-uebersicht th{font:600 10px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B645A;text-align:left;padding:5px 6px;border-bottom:1px solid #E6DCC2;white-space:nowrap}'
    + '#mv-einheiten-uebersicht td{padding:6px;border-bottom:1px solid #F0E9D6;white-space:nowrap;vertical-align:top}'
    + '#mv-einheiten-uebersicht td.mveu-r{text-align:right}'
    + '#mv-einheiten-uebersicht .mveu-fehlt{color:#B8625C!important;font:inherit;font-weight:600;background:none!important;border:0!important;padding:0!important;margin:0!important;min-height:0!important;box-shadow:none!important;cursor:pointer;text-decoration:underline!important}'   /* v3028a: gegen .sec button:not(...) !important (style.css) */
    + '#mv-einheiten-uebersicht .mveu-knopf{margin-top:10px}';
  function uebersicht() {
    var karte = el('mv-objekt-karte'); if (!karte) return;
    var art = el('objart'), istMfh = art && String(art.value || '').toUpperCase() === 'MFH';
    var E = einheiten(), gilt = E.length >= 2;
    var felder = karte.querySelectorAll(':scope > .f');
    var box = el('mv-einheiten-uebersicht');
    var unter = el('mv-objekt-hinweis');
    for (var i = 0; i < felder.length; i++) felder[i].style.display = gilt ? 'none' : '';
    if (!gilt) {
      if (box) box.remove();
      if (unter) unter.textContent = 'für dieses Objekt';
      var kn = el('mv-einheiten-erfassen');
      if (istMfh && !kn) {
        var h = el('mv-objekt-mfh-hinweis');
        var d = document.createElement('div'); d.id = 'mv-einheiten-erfassen'; d.className = 'hint'; d.style.marginTop = '6px';
        d.innerHTML = 'Unterschiedliche Verträge? Einheiten erfassen – dann rechnet DealPilot je Wohnung. '
          + '<button type="button" class="btn btn-outline btn-sm" data-mveu-erfassen="1">Einheiten erfassen</button>';
        (h && h.parentNode ? h.parentNode : karte).appendChild(d);
      } else if (!istMfh && kn) kn.remove();
      return;
    }
    var kn2 = el('mv-einheiten-erfassen'); if (kn2) kn2.remove();
    var mh = el('mv-objekt-mfh-hinweis'); if (mh) mh.style.display = 'none';
    if (unter) unter.textContent = 'der ' + E.length + ' Einheiten';
    if (!el('mv-eu-stil')) { var st = document.createElement('style'); st.id = 'mv-eu-stil'; st.textContent = STIL; document.head.appendChild(st); }
    /* Kopfzeile: Verteilung */
    var zahlen = {}, leer = 0;
    E.forEach(function (e) {
      if (e.status === 'leer') { leer++; return; }
      var k = e.mv_art === 'index' ? 'Index' : e.mv_art === 'staffel' ? 'Staffel' : e.mv_art === 'gewerbe' ? 'Gewerbe' : !e.mv_art ? 'ohne Angabe' : 'Standard';
      zahlen[k] = (zahlen[k] || 0) + 1;
    });
    var kopf = E.length + ' Einheiten' + ['Standard', 'Index', 'Staffel', 'Gewerbe', 'ohne Angabe'].filter(function (k) { return zahlen[k]; })
      .map(function (k) { return ' · ' + zahlen[k] + ' ' + k; }).join('') + (leer ? ' · ' + leer + ' leer' : '');
    var zeilen = E.map(function (e, i) {
      var t = termin(e);
      var fehlt = t.fehlt.length ? ' <button type="button" class="mveu-fehlt" data-mveu-i="' + i + '" title="Einheit im Einheiten-Fenster öffnen">fehlt: ' + esc(t.fehlt.join(', ')) + '</button>' : '';
      return '<tr><td>' + esc(e.nr || (i + 1)) + (e.lage ? ' · ' + esc(e.lage) : '') + '</td>'
        + '<td>' + esc(e.status === 'leer' ? '–' : (artName(e.mv_art) || '–')) + '</td>'
        + '<td>' + esc(datum(e.mv_beginn) || '–') + '</td>'
        + '<td>' + esc(datum(e.mv_letzte_erhoehung) || '–') + '</td>'
        + '<td class="mveu-r">' + (zahl(e.ist) > 0 && e.status !== 'leer' ? esc(eur(zahl(e.ist))) : '–') + '</td>'
        + '<td' + (t.titel ? ' title="' + esc(t.titel) + '"' : '') + '>' + esc(t.text) + fehlt + '</td></tr>';
    }).join('');
    var html = '<div class="mveu-kopf">' + esc(kopf) + '</div>'
      + '<div class="mveu-wrap"><table><thead><tr><th>Einheit</th><th>Vertrag</th><th>Mietbeginn</th><th>Letzte Anp.</th><th>Kaltmiete</th><th>Nächste Erhöhung</th></tr></thead><tbody>' + zeilen + '</tbody></table></div>'
      + '<p class="hint" style="margin:8px 0 0">Bei erfassten Einheiten gelten deren Verträge – die Angaben für das Objekt als Ganzes bleiben gespeichert, rechnen aber nicht mit.</p>'
      + '<div class="mveu-knopf"><button type="button" class="btn btn-outline btn-sm" data-mveu-erfassen="1">Einheiten bearbeiten</button></div>';
    if (!box) { box = document.createElement('div'); box.id = 'mv-einheiten-uebersicht'; karte.appendChild(box); }
    if (box._html !== html) { box.innerHTML = html; box._html = html; }
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-mveu-i],[data-mveu-erfassen]') : null;
    if (!t || !window.DpMfhEinheiten) return;
    if (t.hasAttribute('data-mveu-i') && window.DpMfhEinheiten.einheitOeffnen) window.DpMfhEinheiten.einheitOeffnen(+t.getAttribute('data-mveu-i'));
    else if (window.DpMfhEinheiten.oeffnen) window.DpMfhEinheiten.oeffnen(1);
  });
  /* Die Einheiten ändern sich im Einheiten-Fenster und beim Laden - nachziehen, solange die Karte sichtbar ist. */
  var _sig = null;
  setInterval(function () {
    var k = el('mv-objekt-karte'); if (!k || !k.offsetParent) return;
    var s = ''; try { s = JSON.stringify(einheiten()) + '|' + (el('objart') || {}).value; } catch (e) {}
    if (s !== _sig) { _sig = s; try { uebersicht(); } catch (e) {} }
  }, 1500);
  window.addEventListener('dp:indexreihen', function () { _sig = null; });

  function start() {
    var fertig = optionenFuellen();
    mfhHinweis();
    try { uebersicht(); } catch (e) {}   /* v3027 */
    var art = el('objart');
    if (art && !art._dpMvGebunden) {
      art._dpMvGebunden = true;
      art.addEventListener('change', mfhHinweis);
    }
    return fertig;
  }

  /* Der Reiter Miete steht im HTML, aber `DpMfhEinheiten` wird erst
     geladen - und ein geladenes Objekt kann die Werte nachtragen.
     Deshalb beobachten statt einmal versuchen. */
  if (!start()) {
    var versuche = 0;
    var t = setInterval(function () {
      versuche++;
      if (start() || versuche > 40) clearInterval(t);
    }, 250);
  }
  window.addEventListener('dp:object-ready', function () { setTimeout(start, 120); });

  window.DealPilotMietvertragObjekt = { fuellen: optionenFuellen, hinweis: mfhHinweis,
    uebersicht: uebersicht, einheitenGelten: einheitenGelten };   /* v3027 */
})();
