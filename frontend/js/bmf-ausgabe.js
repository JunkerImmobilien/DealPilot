/* ═══════════════════════════════════════════════════════════════════════
   bmf-ausgabe.js · v3184 — EINE Stelle für alles, was der BMF-Rechner ausgibt

   Marcel am 05.11.2026: „dass wir dort dann halt alle Exporte machen. Also einmal
   das Original, die BMF-Arbeitshilfe als PDF, die Kaufpreisaufteilung … Die PDFs,
   die wir dann hinten in der Dealaktion noch nicht haben, sollten wir da vielleicht
   auch mit auflisten unter Finanzamt oder Steuern … aber auch erst dann immer
   anzeigen, wenn die wirklich gezogen werden können. Ansonsten kann man sagen:
   fehlen noch Werte."

   Vorher lagen die drei Ausgaben an drei Stellen mit drei eigenen Wegen: Reiter 2
   (bmfAusgabenZeigen), Reiter 4 (BMF-XLSX-Karte) und Reiter 5 (Knöpfe unter dem
   Vertragstext), die Arbeitshilfe nur als Klick auf einen Knopf in Reiter 5 - wer
   ihn noch nicht gesehen hatte, bekam „bitte erst Reiter öffnen“.

   Jetzt rufen Schritt 5 des Rechners UND die Deal-Aktion dieselben Funktionen:
     DpBmfAusgabe.pruefen()             -> { ok, fehlt: [..] } aus den Objektfeldern
     DpBmfAusgabe.kaufpreisaufteilung() -> exportPDFKaufpreisaufteilung (Weiche neu/klassisch)
     DpBmfAusgabe.arbeitshilfe()        -> die ausgefüllte BMF-Arbeitshilfe als PDF (Server)
     DpBmfAusgabe.xlsx()                -> das BMF-Original als XLSX (downloadXlsx)
     DpBmfAusgabe.bereitstellen()       -> rechnet die Aufteilung, falls für DIESES Objekt
                                           noch kein Ergebnis vorliegt (Fenster kurz auf und zu)
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DpBmfAusgabe) return;

  function el(id) { return document.getElementById(id); }
  function hinweis(t) { try { if (typeof window.toast === 'function') window.toast(t); } catch (e) {} }
  function zahl(id) {
    var e = el(id); if (!e) return null;
    var s = String(e.value == null ? '' : e.value).trim(); if (!s) return null;
    var n = (typeof window.parseDe === 'function') ? window.parseDe(s) : parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isFinite(n) && n > 0 ? n : null;
  }

  /* Pflichtangaben der Arbeitshilfe, gelesen an den Feldern des Objekts (nicht am Fenster:
     das gibt es erst nach dem Öffnen). Miete: ohne sie rechnet das Ertragswertverfahren nicht. */
  var PFLICHT = [['kp', 'Kaufpreis'], ['baujahr', 'Baujahr'], ['wfl', 'Wohnfläche'], ['gsfl', 'Grundstücksfläche'], ['brw', 'Bodenrichtwert'], ['nkm', 'Kaltmiete']];
  function pruefen() {
    if (!window._currentObjKey) return { ok: false, fehlt: ['geöffnetes Objekt'] };
    /* v3184b · dieselbe Pflichtliste wie das Fenster (bmf-modal.js BMF_PFLICHT/_bmfFehlend) - keine zweite.
       Dazu die Miete, ohne die das Ertragswertverfahren nicht rechnet (bmfPaneNext prüft sie genauso). */
    var fehlt = [];
    if (typeof window._bmfFehlend === 'function') { try { fehlt = window._bmfFehlend().map(function (e) { return e.name; }); } catch (e) {} }
    else fehlt = PFLICHT.slice(0, 5).filter(function (p) { return zahl(p[0]) == null; }).map(function (p) { return p[1]; });
    if (zahl('nkm') == null && zahl('bmf_miete') == null && zahl('ds2_marktmiete') == null) fehlt.push('Kaltmiete');
    var plan = true;
    try { plan = !(window.DealPilotConfig && DealPilotConfig.pricing && typeof DealPilotConfig.pricing.hasFeature === 'function') || DealPilotConfig.pricing.hasFeature('bmf_calc_export'); } catch (e) {}
    return { ok: !fehlt.length && plan, fehlt: fehlt, plan: plan };
  }

  function offen() { var o = el('bmfOverlay'); return !!(o && o.classList.contains('open')); }
  function aktuell() {
    var k = window._currentObjKey;
    return !!(k && window._lastBmfResults && window._lastBmfInputs && window._lastBmfResults._fuer === k);
  }

  /* Rechnet die amtliche Aufteilung für das offene Objekt, falls nötig. War das Fenster zu,
     wird es danach wieder geschlossen; war es offen (Schritt 5), bleibt es offen. */
  function bereitstellen() {
    if (aktuell()) return Promise.resolve(true);
    var warOffen = offen();
    return new Promise(function (ok) {
      try { if (!warOffen && typeof window.openBMFModal === 'function') window.openBMFModal(); } catch (e) {}
      var vorher = window._lastBmfResults;
      setTimeout(function () {
        try { if (typeof window.runBmf === 'function') window.runBmf(); } catch (e) {}
        var t0 = Date.now();
        (function warte() {
          var neu = window._lastBmfResults && window._lastBmfResults !== vorher;
          if (neu || Date.now() - t0 > 20000) {
            if (window._lastBmfResults) window._lastBmfResults._fuer = window._currentObjKey;
            try { if (!warOffen && window.closeBMFModal) window.closeBMFModal(); } catch (e) {}
            return ok(!!neu || aktuell());
          }
          setTimeout(warte, 300);
        })();
      }, warOffen ? 50 : 1200);
    });
  }

  function sperre(was) {
    var p = pruefen();
    if (p.ok) return false;
    if (!p.plan) { hinweis('Die Kaufpreisaufteilung ist ab dem Investor-Plan verfügbar.'); return true; }
    hinweis(was + ': es fehlen noch Werte – ' + p.fehlt.join(', ') + '.');
    return true;
  }

  function kaufpreisaufteilung() {
    if (sperre('Kaufpreisaufteilung')) return;
    /* v3184b · erst rechnen, dann ausgeben: die PDF-Prüfung (pdf-pruefung.js) sperrt ohne Rechenergebnis -
       gemessen: aus der Deal-Aktion kam „Berechnung der Kaufpreisaufteilung fehlt“, obwohl alle Werte da waren. */
    if (typeof window.exportPDFKaufpreisaufteilung !== 'function') { hinweis('Kaufpreisaufteilung-PDF nicht geladen.'); return; }
    if (!aktuell()) hinweis('Kaufpreisaufteilung wird berechnet …');
    return bereitstellen().then(function () {
      try { if (window.DpBmfBodenabschlag) { window.DpBmfBodenabschlag.einhaengen(); window.DpBmfBodenabschlag.rechnen(); } } catch (e) {}
      return window.exportPDFKaufpreisaufteilung();
    });
  }

  function kopf() {
    if (typeof window._authHeaders === 'function') return window._authHeaders();
    var h = { 'Content-Type': 'application/json' }, t = '';
    try { t = (window.Sub && typeof Sub.getToken === 'function') ? Sub.getToken() : (localStorage.getItem('ji_token') || ''); } catch (e) {}
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }
  function basis() { try { if (window.Auth && typeof Auth.getApiBase === 'function') return Auth.getApiBase(); } catch (e) {} return '/api/v1'; }

  var laeuft = false;
  function arbeitshilfe() {
    if (sperre('BMF-Arbeitshilfe')) return Promise.resolve();
    if (laeuft) return Promise.resolve();
    laeuft = true;
    hinweis('BMF-Arbeitshilfe wird erzeugt …');
    return bereitstellen().then(function () {
      var inputs = window._lastBmfInputs;
      if (!inputs) throw new Error('die Aufteilung ließ sich nicht rechnen');
      return fetch(basis() + '/bmf/aufteilung', { method: 'POST', headers: kopf(), body: JSON.stringify({ inputs: inputs, include_pdf: true }) });
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.pdf_base64) throw new Error('keine PDF-Fassung erhalten');
      var bin = atob(d.pdf_base64), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
      var a = document.createElement('a'); a.href = url; a.download = d.pdf_name || 'BMF_Arbeitshilfe.pdf';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      hinweis('✓ BMF-Arbeitshilfe als PDF gespeichert');
    }).catch(function (e) { hinweis('BMF-Arbeitshilfe nicht möglich: ' + e.message); })
      .then(function () { laeuft = false; });
  }

  function xlsx() {
    if (sperre('BMF-Original')) return Promise.resolve();
    return bereitstellen().then(function () {
      if (typeof window.downloadXlsx === 'function') return window.downloadXlsx();
      hinweis('XLSX-Ausgabe nicht geladen.');
    });
  }

  window.DpBmfAusgabe = { pruefen: pruefen, bereitstellen: bereitstellen, aktuell: aktuell,
    kaufpreisaufteilung: kaufpreisaufteilung, arbeitshilfe: arbeitshilfe, xlsx: xlsx };
})();
