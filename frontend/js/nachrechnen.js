/* ============================================================================
   DealPilot v3031 — nachrechnen.js · Kennzahlen und Scores gespeicherter Objekte neu rechnen

   Marcel 29.10.2026: „dscr muss überall passen in jedem tab und auch in den
   scores wie dealscore und investor dealscore". Seit v3031 ist der DSCR netto
   (Reinertrag / Kapitaldienst). Der DSCR-WERT alter Objekte wird beim Lesen
   umgerechnet (Dscr.ausGespeichert), die gespeicherten SCORES (_dealpilot_score,
   _ds2_score) nicht — sie entstehen aus der ganzen Objektrechnung. Gemessen auf
   Staging 29.10.: bei 11 von 21 Objekten ändert sich die Risiko-Teilnote.

   Dieser Lauf öffnet jedes Objekt ohne Kennzeichen `_kpis_dscr_art = 'netto'`
   der Reihe nach, lässt die App rechnen und speichert — derselbe Weg wie ein
   Öffnen von Hand. Er läuft NUR auf Aufruf, nie automatisch:

       await DealPilotNachrechnen.offen()        // Liste, nichts wird geändert
       await DealPilotNachrechnen.alle()         // rechnet und speichert

   Am Ende steht wieder das Objekt offen, das vorher offen war.
   ============================================================================ */
(function () {
  'use strict';
  if (window.DealPilotNachrechnen) return;

  function warte(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function liste() {
    if (typeof getAllObjectsData !== 'function') throw new Error('getAllObjectsData fehlt');
    return (await getAllObjectsData()) || [];
  }

  async function offen() {
    var all = await liste();
    return all.filter(function (o) {
      var d = o && o.data;
      return d && d._kpis_dscr != null && d._kpis_dscr_art !== 'netto';
    }).map(function (o) {
      var d = o.data;
      return { id: o.id, name: ((d.str || '') + ' ' + (d.hnr || '')).trim() || o.name || o.id,
               dscr_alt: d._kpis_dscr, score_alt: d._dealpilot_score, ds2_alt: d._ds2_score };
    });
  }

  /* Wartet, bis die Rechnung für GENAU dieses Objekt fertig ist (State.kpis._fuer, v1814). */
  async function aufRechnung(k, maxMs) {
    var bis = Date.now() + (maxMs || 12000);
    while (Date.now() < bis) {
      if (window.State && State.kpis && String(State.kpis._fuer || '') === String(k)
          && isFinite(State.kpis.dscr)) return true;
      await warte(250);
    }
    return false;
  }

  async function alle(opt) {
    opt = opt || {};
    var vorher = window._currentObjKey || null;
    var ziel = await offen();
    var bericht = [];
    for (var i = 0; i < ziel.length; i++) {
      var z = ziel[i], zeile = { id: z.id, name: z.name, dscr_alt: z.dscr_alt, score_alt: z.score_alt, ds2_alt: z.ds2_alt };
      try {
        await loadSaved(z.id);
        if (!(await aufRechnung(z.id))) { zeile.fehler = 'Rechnung nicht fertig'; bericht.push(zeile); continue; }
        await warte(opt.pause || 900);       /* Scores rendern nach der Rechnung */
        await saveObj({ silent: true });
        await warte(400);
        var d = window._currentObjData || {};
        zeile.dscr_neu = window.State && State.kpis ? State.kpis.dscr : null;
        zeile.art = d._kpis_dscr_art || null;
        zeile.score_neu = d._dealpilot_score; zeile.ds2_neu = d._ds2_score;
      } catch (e) { zeile.fehler = String(e && e.message || e).slice(0, 120); }
      bericht.push(zeile);
      try { if (typeof opt.fortschritt === 'function') opt.fortschritt(i + 1, ziel.length, zeile); } catch (e) {}
    }
    if (vorher) { try { await loadSaved(vorher); } catch (e) {} }
    return bericht;
  }

  window.DealPilotNachrechnen = { offen: offen, alle: alle };
})();
