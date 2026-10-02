/* ═══════════════════════════════════════════════════════════════════════
   v1769 · DIE PILOTEN HOLEN DIE MARKTBERICHTE (Backlog V6)
   ═══════════════════════════════════════════════════════════════════════

   Marcel: „Wichtig ist auch, dass sich beide Piloten immer auch zum Objekt
   bei der Pilot-Analyse oder dem ganzen Bestand beim Portfolio-Piloten den
   Marktbericht oder die Berichte holen und alles abgleichen."

   DER WEG WAR BIS HEUTE ZU. `GET /marktbericht/objects/history` machte
   `parseInt(req.query.user_id, 10)` auf eine UUID und antwortete jedem
   echten Nutzer mit HTTP 400 — seit v942. Im Frontend sah das aus wie
   „noch keine Berichte". Migration 015 und die fünf `_uidAus()`-Stellen
   haben ihn geöffnet; gemessen am 02.10.2026: 200 mit 72 Berichten.

   EINE ROUTE, ZWEI FRAGEN:

     /objects/history             alle Berichte des Nutzers   -> Portfolio
     /objects/history?ref=<objId> die eines Objekts           -> Co-Pilot

   > Ein Abruf für den ganzen Bestand, nicht einer je Objekt. Die Route
   > kann das, es stand nur niemand davor.

   ABGLEICHEN HEISST BENENNEN, NICHT RECHNEN. Wo der Bericht einen anderen
   Marktwert führt als die Objektkalkulation, nennt der Pilot BEIDE Zahlen
   und woher sie kommen. Er rechnet keine dritte aus.

   > Zwei Zahlen zur selben Größe sind kein Widerspruch, solange beide ihre
   > Herkunft tragen. Eine dritte, gemittelte wäre einer.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* Was aus einem Snapshot ans Modell geht. Die Einheit steht IM Namen —
     der Satz wird gelesen, nicht geraten. */
  function satz(h) {
    if (!h) return null;
    var z = function (v) {
      if (v === null || v === undefined || v === '') return null;
      var n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    var o = {
      bericht_id: h.report_id != null ? h.report_id : null,
      erstellt: h.created_at || null,
      adresse: h.address || null,
      objekt_kuerzel: h.object_label || null,
      objektart: h.property_type || null,
      wohnflaeche_qm: z(h.living_area),
      baujahr: z(h.build_year),
      marktwert_eur: z(h.market_value),
      marktwert_von_eur: z(h.market_value_low),
      marktwert_bis_eur: z(h.market_value_high),
      median_eur_qm: z(h.median_sqm),
      bruttorendite_prozent: z(h.gross_yield_pct),
      mietmultiplikator: z(h.rent_multiplier),
      deal_score: z(h.deal_score),
      mikro_score: z(h.micro_score),
      makro_score: z(h.macro_score),
      preis_cagr_prozent: z(h.price_cagr_pct),
      vertrauen: h.confidence != null ? h.confidence : null,
      vergleichsgruppe: h.comparable_group || null
    };
    /* Leere Felder fliegen raus: ein `null` im Auftrag ist für das Modell
       nicht dasselbe wie ein fehlender Schlüssel — es liest `null` leicht
       als „ist null". */
    Object.keys(o).forEach(function (k) { if (o[k] === null) delete o[k]; });
    return o;
  }

  /* Je Objekt nur der JÜNGSTE Bericht. Die Route liefert aufsteigend
     sortiert; 28 Läufe am selben Objekt sind keine 28 Aussagen, sondern
     eine mit 27 Vorstufen. Den Verlauf gibt es als `_verlauf_n`. */
  function jeObjekt(liste) {
    var nach = {};
    (liste || []).forEach(function (h) {
      var k = h.external_ref || h.object_key || ('r' + h.report_id);
      var alt = nach[k];
      if (!alt || new Date(h.created_at) >= new Date(alt.created_at)) nach[k] = h;
      nach[k]._n = (alt && alt._n ? alt._n : 0) + 1;
    });
    return Object.keys(nach).map(function (k) {
      var s = satz(nach[k]);
      if (s && nach[k]._n > 1) s.verlauf_laeufe = nach[k]._n;
      return s;
    }).filter(Boolean);
  }

  function holen(ref) {
    var pfad = '/marktbericht/objects/history' + (ref ? '?ref=' + encodeURIComponent(ref) : '');
    /* Auth.apiCall, nicht nacktes fetch: der zentrale 401-Handler hängt
       daran, und `getApiBase()` trägt `/api/v1` schon. */
    return window.Auth.apiCall(pfad).then(function (d) {
      return (d && d.history) || [];
    }).catch(function () { return null; });   /* null = Weg versagt, [] = nichts da */
  }

  /* ── Für den Co-Pilot: ein Objekt ──────────────────────────────────── */
  function zumObjekt() {
    var ref = window._currentObjKey;
    if (!ref) return Promise.resolve(null);
    return holen(ref).then(function (liste) {
      if (liste === null) return { abruf: 'fehlgeschlagen' };
      if (!liste.length) {
        return { vorhanden: 0,
          hinweis: 'Zu diesem Objekt liegt noch kein DealPilot-Marktbericht vor.' };
      }
      var j = jeObjekt(liste)[0];
      return { vorhanden: liste.length, juengster: j,
        hinweis: 'Die Zahlen stammen aus dem DealPilot-Marktbericht, nicht aus '
          + 'der Objektkalkulation. Weichen sie ab, nenne BEIDE mit ihrer '
          + 'Herkunft und rechne keine dritte aus.' };
    });
  }

  /* ── Für den Portfolio-Pilot: der ganze Bestand ────────────────────── */
  function zumBestand() {
    return holen(null).then(function (liste) {
      if (liste === null) return { abruf: 'fehlgeschlagen' };
      if (!liste.length) {
        return { objekte_mit_bericht: 0,
          hinweis: 'Für keines der Objekte liegt ein DealPilot-Marktbericht vor.' };
      }
      var je = jeObjekt(liste);
      /* KEINE Summe und kein Mittel: der Pilot soll die Berichte neben die
         Objekte stellen, nicht einen eigenen Portfoliowert daraus bauen.
         Eine Summe hier wäre die dritte Zahl. */
      return { objekte_mit_bericht: je.length, berichte_gesamt: liste.length,
        berichte: je.slice(0, 40),
        hinweis: 'Je Objekt steht hier der JÜNGSTE Bericht. Diese Marktwerte '
          + 'stammen aus dem Marktbericht, nicht aus der Vermoegensbilanz — '
          + 'stelle sie daneben, bilde keine Summe und kein Mittel daraus.' };
    });
  }

  /* ═══ DER ABRUF DARF NICHT VOR JEDER FRAGE WARTEN ═══════════════════

     Marcel zu v1760: „Der braucht jetzt relativ lange. Er möchte halt
     immer nur gucken, ob es Änderungen gibt." Damals lag ein zusätzlicher
     Netzwerkweg vor JEDER Nachricht.

     > Eine Erweiterung, die den Hauptzweck verlangsamt, ist keine
     > Erweiterung, sondern eine Verlagerung.

     Deshalb liegt der Stand in einem Zwischenspeicher. Er frischt sich
     auf, wenn sich das Objekt ändert (`dp:object-ready`) — nicht, wenn
     eine Frage gestellt wird. Die Frage liest nur, was schon da ist.

     Ein leerer Zwischenspeicher heißt „noch nicht geholt", nicht „keine
     Berichte": dann reist nichts mit, und das Modell behauptet auch
     nichts. */
  var _objSpeicher = { key: null, stand: null };
  var _bestSpeicher = { zeit: 0, stand: null };
  var FRISCH_MS = 5 * 60 * 1000;

  function objektFrischen() {
    var ref = window._currentObjKey || null;
    if (!ref) { _objSpeicher = { key: null, stand: null }; return Promise.resolve(null); }
    return zumObjekt().then(function (s) {
      _objSpeicher = { key: ref, stand: s };
      return s;
    });
  }

  function bestandFrischen() {
    return zumBestand().then(function (s) {
      _bestSpeicher = { zeit: Date.now(), stand: s };
      return s;
    });
  }

  /* Synchron, für den Auftrag an das Modell. Gibt `null`, solange nichts
     geholt ist — und stößt das Holen nebenbei an, damit die NÄCHSTE Frage
     es hat. */
  function standObjekt() {
    var ref = window._currentObjKey || null;
    if (!ref) return null;
    if (_objSpeicher.key === ref) return _objSpeicher.stand;
    try { objektFrischen(); } catch (e) {}
    return null;
  }

  function standBestand() {
    if (_bestSpeicher.stand && (Date.now() - _bestSpeicher.zeit) < FRISCH_MS) {
      return _bestSpeicher.stand;
    }
    try { bestandFrischen(); } catch (e) {}
    return _bestSpeicher.stand;   /* ein etwas älterer Stand ist besser als keiner */
  }

  try {
    window.addEventListener('dp:object-ready', function () {
      try { objektFrischen(); } catch (e) {}
    });
  } catch (e) {}

  /* Einmal beim Laden, damit die erste Frage den Bestand schon kennt.
     Dieselbe Verzögerung wie beim Guthabenstand (v1766). */
  setTimeout(function () {
    try { bestandFrischen(); } catch (e) {}
    try { if (window._currentObjKey) objektFrischen(); } catch (e) {}
  }, 1800);

  window.DealPilotPilotBerichte = {
    zumObjekt: zumObjekt,
    zumBestand: zumBestand,
    standObjekt: standObjekt,
    standBestand: standBestand,
    objektFrischen: objektFrischen,
    bestandFrischen: bestandFrischen,
    /* Für die Prüfstrecke: ein Prüfer, der die Aufbereitung nicht selbst
       aufrufen kann, misst sich am Ende nur selbst. */
    _pruef: { satz: satz, jeObjekt: jeObjekt,
              speicher: function () { return { obj: _objSpeicher, best: _bestSpeicher }; } }
  };
})();
