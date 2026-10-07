/* ══════════════════════════════════════════════════════════════════════
   DealPilot · lage-profil.js   (v1956)

   DIE LAGEKLASSEN A/B/C UND IHRE ZIELRENDITEN

   Marcel am 07.10.2026:

     „Investoren gliedern das immer in A-, B- und C-Lagen und machen das
      halt auch an Bruttomietrenditen fest, die sie erreichen wollen. …
      Wir nehmen eine A-Lage und da möchte ich 8 Prozent Bruttomietrendite
      haben, dann geht im Quick-Check in unsere Bewertung mit ein, um wie
      viel ich den Kaufpreis verhandeln muss, damit ich meinen 8-Prozenter
      bekomme."

   Sein Kollege hatte dasselbe schon in `design/mockups/Anmerkungen.docx`
   geschrieben, zweimal:

     „Profile in den Einstellungen hinterlegen, wie man die Lage bewertet.
      C-Lage-Strategie hat eine andere als A-Lage-Strategie und passt
      vielleicht nicht in die vorgefertigten Profile."

     „Dann könnte man sagen: für Profil ‚Investition C-Lage' nimm
      Mietausfall immer 3 %, für A-Lage 1 %."

   > Der zweite Satz stand bis heute schon in der App — als toter Hinweis
   > am Mietausfall-Feld (`investment-profile.js`): „A-Lage eher 1 %,
   > C-Lage eher 3 %". **Die Beziehung war dokumentiert und nie
   > verdrahtet.** Genau das ändert diese Datei.

   ── ZWEI ENTSCHEIDUNGEN VON MARCEL, DIE HIER EINGEBAUT SIND ───────────

   **1 · Vorbelegung marktüblich, nicht nach seinem Beispiel.** Er hatte
   „A-Lage 8 %" gesagt; am Markt ist es umgekehrt — A-Lagen bringen wenig
   Rendite (Sicherheit), C-Lagen viel (Risikoaufschlag). Auf Nachfrage hat
   er „marktüblich vorbelegt" gewählt: A 3,5 · B 5,0 · C 7,0, jederzeit
   änderbar. Seine 8 waren ein Rechenbeispiel, keine Vorgabe.

   **2 · Die Klasse wählt NUR der Kunde.** Kein Vorschlag aus der
   Makrolage, auch wenn Marktdaten vorliegen. Die Einstufung ist eine
   Strategieentscheidung, keine Messung — DealPilot würde sonst eine
   Grenze ziehen, die es nicht kennt.

   ── WAS PFLICHT IST UND WAS NICHT ─────────────────────────────────────

   Pflicht je Klasse ist genau EINE Zahl: die Ziel-Bruttomietrendite.
   Alles Weitere (Mietausfall, Bewirtschaftung, Zins, Eigenkapital,
   Tilgung) ist **ausdrücklich freiwillig** — Marcel: „das ist auch ein
   Profil, aber es ist kein Muss. Also man kann das machen, man muss das
   aber nicht."

   Leere Zusatzfelder bedeuten: es gilt weiter das Investmentprofil.
   `null` heißt „nicht gesetzt", nicht „null Prozent" — deshalb wird
   überall auf ABWESENHEIT geprüft und nicht auf den Wahrheitswert.
   `Number(null)` ist 0 und besteht `Number.isFinite`; wer das verwechselt,
   rechnet mit 0 % Mietausfall statt mit dem Standardwert.

   ── SPEICHERORT ───────────────────────────────────────────────────────

   Server (`/user-settings/lage_profil`), mit localStorage als
   Sofortanzeige. Marcel: „ja auf den Server damit."

   > An dieser Zahl hängt eine RECHNUNG. Ein Profil, das nur auf einem
   > Gerät liegt, lässt denselben Kunden auf dem Handy ein anderes
   > Ergebnis sehen als am Schreibtisch. Das Muster ist von
   > `datenraum.js` abgeschrieben, nicht neu erfunden: lokal sofort,
   > Server zieht nach, **nie gegen Leere**, der jüngere Stand gewinnt.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.DealPilotLageProfil) return;

  var LS = 'dp_lage_profil';
  var FERN = '/user-settings/lage_profil';
  var KLASSEN = ['A', 'B', 'C'];

  /* Die Zusatzfelder tragen DIESELBEN Namen wie im Investmentprofil
     (`config.js` investmentProfileDefaults). Nur so kann ein Wert den
     Standardwert ohne Umrechnung ersetzen — zwei Namen für dieselbe
     Größe sind die Falle, die man erst beim Debuggen sieht. */
  var ZUSATZ = ['mietausfall_pct', 'bwk_anteil_default', 'bwk_ul_pct_default',
                'zins_override', 'ek_quote_default', 'tilgung_default'];

  /* Marktüblich: A niedrig (Sicherheit), C hoch (Risikoaufschlag). */
  var VORGABE = { A: 3.5, B: 5.0, C: 7.0 };

  var ETIKETT = {
    A: { kurz: 'A', name: 'A-Lage', sub: 'Top-Standort, geringe Rendite, hohe Sicherheit' },
    B: { kurz: 'B', name: 'B-Lage', sub: 'solider Standort, ausgewogen' },
    C: { kurz: 'C', name: 'C-Lage', sub: 'Randlage, höhere Rendite, höheres Risiko' }
  };

  function leer() {
    var p = { version: 1, klassen: {}, updated_at: null };
    KLASSEN.forEach(function (k) {
      p.klassen[k] = { ziel_bmr: VORGABE[k] };
      ZUSATZ.forEach(function (f) { p.klassen[k][f] = null; });
    });
    return p;
  }

  function lesen() {
    var roh = null;
    try { roh = localStorage.getItem(LS); } catch (e) {}
    if (!roh) return leer();
    var p;
    try { p = JSON.parse(roh); } catch (e) { return leer(); }
    if (!p || typeof p !== 'object' || !p.klassen) return leer();
    /* Fehlende Klassen ergaenzen, ohne vorhandene zu ueberschreiben -
       ein spaeter dazugekommenes Feld darf einen alten Stand nicht
       unbrauchbar machen. */
    var grund = leer();
    KLASSEN.forEach(function (k) {
      if (!p.klassen[k]) { p.klassen[k] = grund.klassen[k]; return; }
      ZUSATZ.concat(['ziel_bmr']).forEach(function (f) {
        if (!(f in p.klassen[k])) p.klassen[k][f] = grund.klassen[k][f];
      });
    });
    return p;
  }

  var _syncLaeuft = false;

  function zumServer(p) {
    if (_syncLaeuft) return;
    if (!window.Auth || !Auth.isApiMode || !Auth.isApiMode()) return;
    _syncLaeuft = true;
    Auth.apiCall(FERN, { method: 'PUT', body: { wert: p } })
      .catch(function (e) {
        /* Kein Alarm: der lokale Stand steht, beim naechsten Schreiben
           wird es erneut versucht. */
        console.warn('[lage-profil] nicht gesichert:', e && e.message);
      })
      .then(function () { _syncLaeuft = false; },
            function () { _syncLaeuft = false; });
  }

  function schreiben(p) {
    p.updated_at = new Date().toISOString();
    try { localStorage.setItem(LS, JSON.stringify(p)); } catch (e) {}
    zumServer(p);
    try {
      window.dispatchEvent(new CustomEvent('dp:lage-profil-geaendert', { detail: p }));
    } catch (e) {}
    return p;
  }

  function vomServer() {
    if (!window.Auth || !Auth.isApiMode || !Auth.isApiMode()) return Promise.resolve(false);
    return Auth.apiCall(FERN, { method: 'GET' })
      .then(function (r) {
        var fern = r && r.wert;
        if (!fern || !fern.klassen) return false;          /* nichts da */

        /* NIE GEGEN LEERE: ein Serverstand, in dem keine einzige
           Zielrendite steht, darf einen gefuellten Browser nicht
           ueberschreiben. */
        var fernHatWert = KLASSEN.some(function (k) {
          var z = fern.klassen[k] && fern.klassen[k].ziel_bmr;
          return z != null && isFinite(z);
        });
        if (!fernHatWert) return false;

        var lokal = lesen();
        var lz = lokal.updated_at ? Date.parse(lokal.updated_at) : 0;
        var fz = fern.updated_at ? Date.parse(fern.updated_at) : 1;
        if (lz > fz) { zumServer(lokal); return false; }   /* lokal juenger */

        try { localStorage.setItem(LS, JSON.stringify(fern)); } catch (e) {}
        try {
          window.dispatchEvent(new CustomEvent('dp:lage-profil-geaendert', { detail: fern }));
        } catch (e) {}
        return true;
      })
      .catch(function () { return false; });
  }

  /* ── Die Frage, auf die es ankommt ──────────────────────────────────
     Welche Ziel-Bruttomietrendite gilt fuer diese Klasse? `null`, wenn
     keine Klasse gewaehlt ist oder keine Zahl hinterlegt ist - dann
     rechnet der Kern mit seinem eigenen Rueckfall weiter. */
  function zielBmr(klasse) {
    if (!klasse) return null;
    var k = String(klasse).toUpperCase().charAt(0);
    if (KLASSEN.indexOf(k) < 0) return null;
    var s = lesen().klassen[k];
    if (!s) return null;
    var z = s.ziel_bmr;
    if (z == null || z === '') return null;                /* Abwesenheit zuerst */
    var n = Number(String(z).replace(',', '.'));
    return (isFinite(n) && n > 0) ? n : null;
  }

  /* Ein Zusatzwert der Klasse, oder null. Der Aufrufer entscheidet, ob
     er damit den Standardwert ersetzt. */
  function zusatz(klasse, feld) {
    if (!klasse || ZUSATZ.indexOf(feld) < 0) return null;
    var k = String(klasse).toUpperCase().charAt(0);
    var s = lesen().klassen[k];
    if (!s) return null;
    var v = s[feld];
    if (v == null || v === '') return null;
    var n = Number(String(v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function setze(klasse, feld, wert) {
    var k = String(klasse || '').toUpperCase().charAt(0);
    if (KLASSEN.indexOf(k) < 0) return null;
    if (feld !== 'ziel_bmr' && ZUSATZ.indexOf(feld) < 0) return null;
    var p = lesen();
    var s = String(wert == null ? '' : wert).trim().replace(',', '.');
    p.klassen[k][feld] = (s === '') ? null : (isFinite(Number(s)) ? Number(s) : null);
    return schreiben(p);
  }

  function etikett(klasse) {
    var k = String(klasse || '').toUpperCase().charAt(0);
    return ETIKETT[k] || null;
  }

  window.DealPilotLageProfil = {
    KLASSEN: KLASSEN,
    ZUSATZ: ZUSATZ,
    VORGABE: VORGABE,
    ETIKETT: ETIKETT,
    get: lesen,
    speichern: schreiben,
    vomServer: vomServer,
    zielBmr: zielBmr,
    zusatz: zusatz,
    setze: setze,
    etikett: etikett
  };

  /* Einmal je Sitzung nachziehen, sobald der Plan steht - `dp:plan-ready`
     statt eines Timers (CLAUDE.md). Ohne Anmeldung passiert nichts. */
  try {
    window.addEventListener('dp:plan-ready', function () { vomServer(); }, { once: true });
  } catch (e) {}
})();
