/* ═══════════════════════════════════════════════════════════════════════
   v1391 · WELCHE FELDER ZU WELCHER OBJEKTART GEHOEREN
   ═══════════════════════════════════════════════════════════════════════

   Marcels Befund vom 14.09.2026:

     „im Marktbericht dass wenn wir ein MFH eingeben wir die Zimmeranzahl
      angeben sollen und die etage. Wir kaufen ja ein ganzes Haus und
      sollten vlt nur die einheiten angeben oder und die Etage fällt raus.
      Da bitte schauen ob wir bei allen möglichen haustypen die richtigen
      felder angeben und oder ausblenden."

   GEMESSEN: Es gab KEINE Steuerung. Das Formular zeigte jedem Objekt
   dieselben Felder — einer Eigentumswohnung ebenso wie einem
   Geschaeftshaus. `grep -rn "objart" js/*.js` findet elf Stellen, die die
   Objektart LESEN (Score, RND, Erbbaurecht, Import), und keine, die
   danach Felder ein- oder ausblendet.

   Die Folgen sind nicht nur kosmetisch:

     * „Etage" bei einem Mehrfamilienhaus hat keine Antwort. Wer trotzdem
       eine hinschreibt, traegt eine Zahl ein, die in die Bewertung geht.
     * „Wohneinheiten im Gebaeude" steht bei einem MFH weit unten im
       Bodenwert-Block, statt dort, wo man es erwartet — und bleibt
       deshalb oft leer. Die BMF-Arbeitshilfe braucht es (Zelle G42),
       und das Ertragswertverfahren rechnet ohne es am Durchschnitt.
     * „Miteigentumsanteil" gehoert zur Eigentumswohnung und zu sonst
       nichts. An einem Einfamilienhaus ist er eine Fangfrage.

   ═══ WAS DIESE DATEI TUT — UND WAS NICHT ═══════════════════════════════

   Sie BLENDET AUS, was zur gewaehlten Art nicht passt, und HEBT HERVOR,
   was dort zwingend ist. Sie LOESCHT NICHTS: ein Wert, der schon im Feld
   steht, bleibt stehen und wird weiter gespeichert. Wer die Objektart
   korrigiert, soll nicht stillschweigend Daten verlieren — und wer sie
   zurueckstellt, findet seine Zahlen wieder.

   Ein ausgeblendetes Feld mit Inhalt wird deshalb NICHT versteckt,
   sondern abgeblendet und mit dem Grund beschriftet. Sonst waere die
   Zahl im Datensatz und im Formular unsichtbar — genau die Sorte
   stiller Zustand, die niemand mehr findet.
   ═══════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  var MARKER = 'dp-oa-aus';

  /* Je Objektart: was PASST, was PFLICHT ist. Alles andere wird
     abgeblendet. Die Kuerzel sind die Werte des Auswahlfeldes
     (index.html:1028) — gemessen, nicht geraten. */
  var ARTEN = {
    ETW:   { passt: ['zimmer', 'bad_anz', 'etage', 'etagen_ges', 'mea'],
             pflicht: ['mea'],
             hinweis: { mea: 'Bei Wohnungseigentum trägt der Miteigentumsanteil den Bodenwert.' } },
    EFH:   { passt: ['zimmer', 'bad_anz', 'etagen_ges'], pflicht: [] },
    ZFH:   { passt: ['zimmer', 'bad_anz', 'etagen_ges', 'einheiten'], pflicht: [] },
    DHH:   { passt: ['zimmer', 'bad_anz', 'etagen_ges'], pflicht: [] },
    RH:    { passt: ['zimmer', 'bad_anz', 'etagen_ges'], pflicht: [] },
    MFH:   { passt: ['etagen_ges', 'einheiten'], pflicht: ['einheiten'],
             hinweis: { einheiten: 'Beim Mehrfamilienhaus zählt die Zahl der Wohneinheiten, nicht die Zimmer einer einzelnen.' } },
    BUERO: { passt: ['etagen_ges', 'einheiten'], pflicht: [] },
    GESCH: { passt: ['etagen_ges', 'einheiten'], pflicht: [] },
    HOTEL: { passt: ['etagen_ges', 'einheiten'], pflicht: [] },
    GEW:   { passt: ['etagen_ges'], pflicht: [] },
    GAR:   { passt: [], pflicht: [] },
  };

  /* Alle Felder, die diese Steuerung ueberhaupt anfasst. Was hier nicht
     steht, bleibt unberuehrt — Wohnflaeche, Kaufpreis und Baujahr gelten
     fuer jede Art. */
  var ALLE = ['zimmer', 'bad_anz', 'etage', 'etagen_ges', 'einheiten', 'mea'];

  /* Warum ein Feld nicht passt — in der Sprache des Objekts, nicht der
     Software. */
  var GRUND = {
    zimmer:     'gilt für eine einzelne Wohnung',
    bad_anz:    'gilt für eine einzelne Wohnung',
    etage:      'gilt nur für Wohnungseigentum',
    etagen_ges: 'gilt für Gebäude',
    einheiten:  'gilt für Gebäude mit mehreren Einheiten',
    mea:        'gilt nur für Wohnungseigentum',
  };

  function el(id) { try { return document.getElementById(id); } catch (e) { return null; } }

  /* Der Kasten um das Feld — dort haengt die Beschriftung. */
  function feld(id) {
    var e = el(id);
    if (!e) return null;
    var f = e.closest ? e.closest('.f') : null;
    return f || null;
  }

  function css() {
    if (el('dp-oa-css')) return;
    var s = document.createElement('style');
    s.id = 'dp-oa-css';
    s.textContent = [
      /* Abgeblendet, nicht weg: der Wert bleibt sichtbar und aenderbar. */
      '.f.' + MARKER + '{opacity:.45;transition:opacity .16s ease}',
      '.f.' + MARKER + ':hover,.f.' + MARKER + ':focus-within{opacity:.92}',
      '.f.' + MARKER + ' > label{position:relative}',
      '.dp-oa-warum{display:block;font:400 10.5px/1.35 Inter,system-ui,sans-serif;',
      '  opacity:.72;font-style:italic;margin-top:1px}',
      /* Ganz verborgen wird nur, was LEER ist — dann gibt es nichts zu retten. */
      '.f.' + MARKER + '.dp-oa-leer{display:none}',
      '.dp-oa-pflicht{display:inline-block;font:600 9.5px/1 "JetBrains Mono",ui-monospace,monospace;',
      '  letter-spacing:.06em;text-transform:uppercase;margin-left:6px;vertical-align:1px;',
      '  color:var(--wl-c9a84c, #C9A84C);border:1px solid currentColor;border-radius:2px;',
      '  padding:2px 4px}',
      '.dp-oa-tipp{display:block;font:400 11px/1.4 Inter,system-ui,sans-serif;',
      '  opacity:.75;margin-top:3px}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function raeumen(f) {
    if (!f) return;
    f.classList.remove(MARKER, 'dp-oa-leer');
    var w = f.querySelector('.dp-oa-warum'); if (w) w.remove();
    var p = f.querySelector('.dp-oa-pflicht'); if (p) p.remove();
    var t = f.querySelector('.dp-oa-tipp'); if (t) t.remove();
  }

  function anwenden() {
    css();
    var sel = el('objart');
    var art = sel ? String(sel.value || '').toUpperCase().trim() : '';
    var regel = ARTEN[art] || null;

    for (var i = 0; i < ALLE.length; i++) {
      var id = ALLE[i], e = el(id), f = feld(id);
      if (!e || !f) continue;
      raeumen(f);

      /* Ohne gewaehlte Art wird nichts abgeblendet — am leeren Objekt
         steht die Frage noch offen, und ein halb ausgegrautes Formular
         waere dort Ratespiel statt Fuehrung. */
      if (!regel) continue;

      var passt = regel.passt.indexOf(id) >= 0;
      var lbl = f.querySelector('label');

      if (!passt) {
        var leer = String(e.value || '').trim() === '';
        f.classList.add(MARKER);
        /* Ein Feld MIT Inhalt bleibt sichtbar — sonst verschwaende ein
           Wert aus dem Blick, der weiter gespeichert wird. */
        if (leer) f.classList.add('dp-oa-leer');
        else if (lbl && GRUND[id]) {
          var w = document.createElement('span');
          w.className = 'dp-oa-warum';
          w.textContent = 'passt nicht zu dieser Objektart — ' + GRUND[id];
          lbl.appendChild(w);
        }
        continue;
      }

      if (regel.pflicht.indexOf(id) >= 0 && lbl) {
        var p = document.createElement('span');
        p.className = 'dp-oa-pflicht';
        p.textContent = 'wichtig';
        lbl.appendChild(p);
      }
      if (regel.hinweis && regel.hinweis[id] && lbl) {
        var t = document.createElement('span');
        t.className = 'dp-oa-tipp';
        t.textContent = regel.hinweis[id];
        lbl.appendChild(t);
      }
    }
  }

  function start() {
    var sel = el('objart');
    if (!sel) return false;
    if (!sel._dpOaWired) {
      sel._dpOaWired = 1;
      sel.addEventListener('change', anwenden);
    }
    anwenden();
    return true;
  }

  /* Beim Laden eines Objekts setzt storage.js die Felder, ohne ein
     change-Ereignis zu feuern — deshalb ein zweiter und dritter Anlauf,
     wie ihn auch der Logo-Abgleich (settings.js, v646) braucht. */
  function boot() {
    if (!start()) setTimeout(start, 400);
    setTimeout(anwenden, 900);
    setTimeout(anwenden, 2200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.DealPilotObjektart = { anwenden: anwenden, _arten: ARTEN };
})(window);
