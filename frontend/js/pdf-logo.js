/* ══════════════════════════════════════════════════════════════════════
   pdf-logo.js · v1634 — EIN Logo-Bezug fuer alle PDF-Bausteine

   WARUM ES DIESE DATEI GIBT

   Vier PDF-Bausteine drucken einen Kopf, und jeder holte sein Logo
   anders. Gemessen am 26.09.2026:

     pdf.js                     _ASSETS.logoDealpilot  (Pfad kaputt)
     pdf-investment-bank.js     nur b.logo_b64         (kein Rueckfall)
     pdf-kaufpreisaufteilung.js nur b.logo_b64         (kein Rueckfall)
     pdf-anlage-bmf.js          Firmenname als Text

   DER PFAD WAR SEIT JE FALSCH. `pdf.js` laedt `assets/dealpilot_logo.png`
   mit UNTERSTRICH; die Datei heisst `dealpilot-logo.png` mit
   BINDESTRICH. Der Abruf schlug nie hoerbar fehl - die App antwortet
   auf JEDEN Pfad mit 200 und liefert die `index.html` zurueck. Ein
   `<img>` mit HTML-Inhalt loest `onerror` aus, der Aufruf gab still
   `null`, und der Kopf fiel auf den Firmennamen zurueck. **Das
   DealPilot-Logo stand deshalb auf keinem einzigen PDF.**

   > Ein 200 ist kein Nachweis, dass eine Datei existiert. Nur der
   > Inhaltstyp ist einer: `text/html` statt `image/png` hat es gezeigt.

   WELCHE VARIANTE, UND WARUM NICHT DIE VON DER LANDINGPAGE

   Es gibt drei:

     dealpilot-logo.png              weisse Kontur, fuer DUNKLEN Grund
     dealpilot-logo-rahmen.png       weiss/gold, fuer DUNKLEN Grund
     dealpilot-logo-rahmen-hell.png  schwarze Plakette, fuer HELLEN

   Ein PDF-Bogen ist weiss. Die ersten beiden waeren dort bis auf das
   Wort "Pilot" unsichtbar - also die dritte.

   > **Und ein zweiter Grund, der schwerer wiegt:** in
   > `dealpilot-logo.png` steht "by Junker Immobilien" EINGEBRANNT. Das
   > ist eine Absenderbehauptung - genau die, die v1632 aus jedem
   > Dokument entfernt hat, weil der Nutzer das Dokument fuer sich
   > erstellt. Sie ueber ein Bild wieder hereinzuholen waere derselbe
   > Fehler in anderer Gestalt.

   DIE RANGFOLGE

     1. Whitelabel / eigenes Logo aus den Einstellungen (`logo_b64`)
     2. das DealPilot-Logo
     3. gar nichts - und dann auch kein Ersatztext

   Der Partner steht oben: wer ein eigenes Logo hinterlegt hat, will
   seines sehen und nicht unseres.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var PFAD = 'assets/dealpilot-logo-rahmen-hell.png';

  var _cache = null;      /* { b64, w, h } - einmal geladen, dann gehalten */
  var _laeuft = null;     /* damit paralleles Drucken nicht doppelt laedt */

  /** Laedt das DealPilot-Logo als Data-URL samt natuerlicher Groesse.
   *  Gibt `null` zurueck, wenn es nicht geladen werden kann - der
   *  Aufrufer laesst die Stelle dann LEER, statt etwas zu erfinden. */
  function dealpilotLogo() {
    if (_cache !== null) return Promise.resolve(_cache);
    if (_laeuft) return _laeuft;
    _laeuft = new Promise(function (fertig) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          /* Ueber ein Canvas, weil jsPDF eine Data-URL braucht und ein
             <img> allein keine liefert. */
          var c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          _cache = { b64: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight };
        } catch (e) { _cache = null; }
        _laeuft = null; fertig(_cache);
      };
      img.onerror = function () {
        /* Nicht verschweigen: wer den Kopf ohne Logo sieht, soll in der
           Konsole finden, warum. Genau diese Meldung fehlte jahrelang. */
        console.warn('[pdf-logo] ' + PFAD + ' nicht ladbar - Kopf bleibt ohne Logo');
        _cache = null; _laeuft = null; fertig(null);
      };
      img.src = PFAD;
    });
    return _laeuft;
  }

  /** Das Logo, das WIRKLICH gedruckt wird - Whitelabel hat Vorrang.
   *  @param {object} b  Markenobjekt (aus DealPilotConfig.branding.get())
   *  @returns {Promise<{b64:string,w:number,h:number,eigen:boolean}|null>} */
  function fuerMarke(b) {
    var eigen = b && b.logo_b64 ? String(b.logo_b64) : '';
    if (!eigen) return dealpilotLogo().then(_mitFlagge);
    /* Beim eigenen Logo kennen wir die Groesse nicht vorab - sie wird
       aus dem Bild gelesen, sonst verzerrt addImage. Laesst es sich
       nicht lesen, faellt es auf unseres zurueck: ein Partner ohne
       brauchbares Bild bekommt lieber ein Logo als einen leeren Kopf. */
    return new Promise(function (fertig) {
      var img = new Image();
      img.onload = function () { fertig({ b64: eigen, w: img.naturalWidth, h: img.naturalHeight, eigen: true }); };
      img.onerror = function () { fertig(null); };
      img.src = eigen;
    }).then(function (x) {
      return x || dealpilotLogo().then(_mitFlagge);
    });
  }

  function _mitFlagge(l) {
    return l ? { b64: l.b64, w: l.w, h: l.h, eigen: false } : null;
  }

  /** Masse, die in einen Rahmen passen, OHNE zu verzerren.
   *  Gibt {w,h} in derselben Einheit zurueck wie maxB/maxH. */
  function masse(l, maxB, maxH) {
    if (!l || !l.w || !l.h) return { w: maxB, h: maxH };
    var f = Math.min(maxB / l.w, maxH / l.h);
    return { w: l.w * f, h: l.h * f };
  }

  /** Was schon im Speicher liegt - SYNCHRON.
   *  `pdf-anlage-bmf.js` baut sein Dokument ohne `await`; es kann nicht
   *  mitten im Kopf nachladen. Deshalb wird beim Laden dieser Datei
   *  vorgewaermt (unten), und hier wird nur abgeholt, was da ist.
   *  Noch nicht da heisst: kein Logo, kein Ersatztext - nicht warten. */
  function ausSpeicher(b) {
    var eigen = b && b.logo_b64 ? String(b.logo_b64) : '';
    if (eigen) return { b64: eigen, w: 0, h: 0, eigen: true };
    return _mitFlagge(_cache);
  }

  /* ── Der Kopfrahmen, einmal ────────────────────────────────────────
     GEMESSEN am erzeugten Dokument (v1634, erster Anlauf): mit 34x11 mm
     ab y-7 reichte die schwarze Plakette bis y+3,7 und ueberdeckte die
     obere Haelfte der Zeile "IMMOBILIEN-INVESTITIONSANALYSE", deren
     Grundlinie bei y+4,6 liegt. Auf dem Bildschirm sah der Kopf richtig
     aus - erst im gerenderten PDF war es zu sehen.

     Jetzt: 27 x 8,5 mm ab y-7,6, also Unterkante y+0,9. Die Unterzeile
     beginnt rund bei y+3,0 - gut 2 mm Luft. Die Goldlinie bei y+8,5
     bleibt unberuehrt.

     Alle drei PDF-Bausteine nehmen diese Zahlen. Wer sie aendert, muss
     sie danach am GERENDERTEN Blatt nachmessen, nicht im Code. */
  var KOPF = { b: 27, h: 8.5, dy: -7.6 };

  /* v3630b · Logogroesse in den Dokumenten (Marcel 17.11.2026, Partner-Cockpit ›
     Verwaltung › Dokumente). Der Partner stellt 60-150 % ein (resellers.
     brand_logo_pdf_groesse -> branding.get().logo_pdf_skala, mandant-branding.js).
     Skaliert wird der RAHMEN, in den das Logo passt - und zwar nur bis zu einer
     harten Grenze je Stelle, die aus den gemessenen Abstaenden oben kommt:

       Kopf (diese Datei)   27 x 8,5 mm ab y-7,6 -> hoechstens 40 x 10 mm,
                            Unterkante y+2,4 bleibt vor der Unterzeile (y+3,0)
       Kopfbalken pdf.js    50 x 17 mm ab y 3 in 22 mm Balken -> hoechstens 65 x 18
       Deckblatt pdf.js     76 x 36 mm ab y 14, Goldlinie bei 56 -> hoechstens 120 x 40

     Groesser als die Grenze wird nichts - ein Logo, das schon an ihr steht,
     waechst nicht weiter. Kleiner geht immer. */
  function skala() {
    try {
      var b = window.DealPilotConfig && DealPilotConfig.branding && DealPilotConfig.branding.get && DealPilotConfig.branding.get();
      var s = b && Number(b.logo_pdf_skala);
      if (s && isFinite(s)) return Math.max(0.6, Math.min(1.5, s));
    } catch (e) {}
    return 1;
  }
  /** Rahmen fuer das Logo: Grundmass x Skala, gedeckelt auf die Grenze. */
  function box(maxB, maxH, grenzeB, grenzeH, s) {
    if (s == null) s = skala();
    return { b: Math.min(maxB * s, grenzeB || maxB * s), h: Math.min(maxH * s, grenzeH || maxH * s) };
  }
  var GRENZE = { kopf: [40, 10], balken: [65, 18], deckblatt: [120, 40] };

  window.DealPilotPdfLogo = {
    pfad: PFAD,
    /* v3630b · Getter: die drei Kopf-Bausteine lesen kopf.b/kopf.h beim Drucken -
       so wirkt die Logogroesse dort, ohne die Bausteine anzufassen. */
    get kopf() { var x = box(KOPF.b, KOPF.h, GRENZE.kopf[0], GRENZE.kopf[1]); return { b: x.b, h: x.h, dy: KOPF.dy }; },
    kopfGrund: KOPF,
    skala: skala,
    box: box,
    GRENZE: GRENZE,
    dealpilot: dealpilotLogo,
    fuerMarke: fuerMarke,
    ausSpeicher: ausSpeicher,
    masse: masse
  };

  /* Vorwaermen. Das Bild ist rund 18 KB und liegt im selben Ursprung;
     bis jemand einen Export anstoesst, ist es laengst da. */
  dealpilotLogo();
})();
