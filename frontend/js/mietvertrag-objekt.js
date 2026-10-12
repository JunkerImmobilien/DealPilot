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

  function start() {
    var fertig = optionenFuellen();
    mfhHinweis();
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

  window.DealPilotMietvertragObjekt = { fuellen: optionenFuellen, hinweis: mfhHinweis };
})();
