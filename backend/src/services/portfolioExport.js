'use strict';
/* portfolioExport.js - v2043
 * ═════════════════════════════════════════════════════════════════════
 * DER PORTFOLIO-EXPORT: nicht nur die Daten, sondern das WISSEN.
 *
 * Marcel, 09.10.2026: „ich brauche dann ein Export ueber das gesamte
 * Portfolio. Wichtig ist, dass wir das gesamte Wissen mitgeben."
 *
 * ── WARUM DIE VORHANDENE SICHERUNG NICHT REICHT ─────────────────────
 *
 * `exportAllJSON()` im Frontend gibt es schon. Sie schreibt eine
 * `.dpkt`-Datei zum WIEDERHERSTELLEN: je Objekt der rohe Datensatz mit
 * rund 280 Schluesseln wie `kp`, `nkm`, `_kpis_dscr`, `ds2_marktfaktor`.
 *
 * Damit kann DealPilot etwas anfangen. Ein Mensch nicht, und eine
 * fremde Tabelle auch nicht.
 *
 *   > Ein Export, der nur Werte traegt, gibt Daten weiter. Wissen gibt
 *   > weiter, wer dazuschreibt, WAS die Werte bedeuten - sonst muss der
 *   > Empfaenger raten, und dann rechnet er mit `bmy` als Prozent,
 *   > obwohl dort ein Faktor steht.
 *
 * ── WAS MITGEHT ─────────────────────────────────────────────────────
 *
 *   lexikon.felder       225 Feld-Ids mit Beschriftung und Art
 *   lexikon.objektarten  welche Art welche Felder traegt
 *   lexikon.score_stufen die Schwellen und Woerter (85/70/50/35)
 *   lexikon.hinweise     die Einheiten-Fallen, die hier teuer waren
 *   wissen.projekt       `bot-wissen.md` - was die Piloten wissen
 *   wissen.eigenes       Marcels eigene Ergaenzung (einmal, nicht je Objekt)
 *   objekte[]            je Objekt: Datensatz, Analyse, Ankauf-Stand
 *
 * ── WAS NICHT MITGEHT, UND WARUM ────────────────────────────────────
 *
 * **Fotos.** Ein Objekt traegt bis zu sechs Bilder als base64; bei 21
 * Objekten waere die Datei dreistellig in Megabyte und in keiner
 * Tabelle zu oeffnen. Die Zahl steht drin, die Bilder auf Wunsch
 * (`?fotos=1`) - dann aber bewusst.
 *
 * **Nichts wird gerechnet.** Die Kennzahlen stehen als `_kpis_*` im
 * Datensatz, gerechnet von den echten Kernen zu ihrer Zeit. Sie hier
 * neu zu rechnen hiesse, alte Daten mit heutigen Regeln zu messen.
 * ═════════════════════════════════════════════════════════════════════
 */
const { query } = require('../db/pool');
const projektwissen = require('./projektwissen');

/* ═══ v2069 · DIE MARKTBERICHTE KOMMEN AUS IHRER EIGENEN DATENBANK ════
 *
 * Marcel, 10.10.2026: „Wir sollten schon die Datenbank darauf anpassen,
 * dass wenn wir einen Marktbericht machen … dann sollten wir ja auf
 * diese Felder zugreifen koennen … Dass man auch den Verlauf sieht, was
 * ueber die Jahre passiert ist. Ob das Objekt im Preis gestiegen ist."
 *
 * UND SEINE ANDERE HAELFTE, DIE GENAUSO WICHTIG IST: „Ich finde nicht,
 * dass es diese Felder dann bei uns nochmal extra geben muss."
 *
 * Also KEINE neuen Spalten in `objects`. Die Daten liegen laengst - nur
 * in einer anderen Datenbank:
 *
 *   mb.market_reports      160 Berichte, mit `payload` und `report_md`
 *   mb.valuation_results   373 Bewertungen
 *   mb.object_snapshots    160 Staende
 *
 * GEMESSEN am 10.10.2026: 139 der 160 Berichte tragen eine `user_id`
 * (UUID, passt zu `users.id`), alle 160 einen Text ueber 100 Zeichen.
 * Verbunden sind sie ueber `object_key = 'dp:' + objects.id`.
 *
 * Der Export fragte diese Datenbank NICHT. Er holte `objects` und war
 * fertig - der ganze Marktbericht-Teil fehlte, obwohl zwei fertige
 * Endpunkte dafuer existieren (v942).
 *
 *   > Ein Export, der „alles" verspricht, muss wissen, wo alles liegt.
 *   > Dieselbe Lektion wie bei der Portfolio-Analyse in v2047 - diesmal
 *   > eine ganze Datenbank weiter.
 *
 * Gefragt wird der Microservice, nicht die fremde Datenbank direkt:
 * `marktbericht.js` macht es seit jeher so, und eine zweite
 * Pool-Verbindung waere ein zweiter Ort, an dem Zugangsdaten stehen.
 */
const MB_BASE = (process.env.MB_BACKEND_URL
  || 'http://mb-backend:4000/api/v1/marktbericht').replace(/\/+$/, '');

async function mbHolen(pfad, userId) {
  const url = MB_BASE + pfad + '?user_id=' + encodeURIComponent(userId);
  /* Der Export darf an einem langsamen Nachbarn nicht haengen bleiben.
     Faellt der Dienst aus, fehlt der Marktbericht-Block - und das steht
     dann auch drin, statt ihn stillschweigend wegzulassen. */
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const text = await r.text();
    if (r.status >= 400) return { fehler: 'HTTP ' + r.status };
    try { return JSON.parse(text); } catch (e) { return { fehler: 'keine JSON-Antwort' }; }
  } catch (e) {
    return { fehler: String(e && e.message || e).slice(0, 120) };
  } finally { clearTimeout(t); }
}

let _konst = null;
function konstanten() {
  if (_konst) return _konst;
  try {
    _konst = require('../generated/frontend-konstanten.json');
  } catch (e) {
    _konst = { daten: {} };
  }
  return _konst;
}

/* Die Score-Kette. Sie steht an EINER Stelle im Frontend
   (`score-tiers.js`); hier wird sie NICHT nachgebaut, sondern als Text
   mitgegeben - wer den Export liest, soll wissen, was "62" heisst. */
const SCORE_STUFEN = [
  { ab: 85, wort: 'Sehr gut', farbe: 'top' },
  { ab: 70, wort: 'Gut', farbe: 'green' },
  { ab: 50, wort: 'Solide', farbe: 'gold' },
  { ab: 35, wort: 'Schwach', farbe: 'red' },
  { ab: 0, wort: 'Kritisch', farbe: 'red' }
];

/* Die Fallen, die in diesem Projekt Geld gekostet haben. Sie gehoeren
   in den Export: wer damit weiterrechnet, laeuft sonst in dieselben. */
const HINWEISE = [
  'Alle Geldbetraege sind EURO, nicht Cent.',
  '`nkm` ist die NettokaltMIETE pro MONAT, nicht pro m2.',
  '`_kpis_cf_ns` ist der Cashflow nach Steuer pro JAHR, nicht pro Monat.',
  '`_kpis_bmy` / `_kpis_nmy` sind Renditen in PROZENT.',
  '`_kpis_dscr` ist ein Verhaeltnis ohne Einheit - eine Prozentangabe darauf ist irrefuehrend.',
  '`lageklasse` ist A, B, C oder D - A ist die beste.',
  '`_ankauf` ist der eingefrorene Stand beim Nutzen-/Lastenwechsel (das Soll). Der uebrige Datensatz ist der laufende Stand (das Ist).',
  'Soll-Miete und Ist-Miete sind etwas ANDERES: die beschreiben eine Miete, nicht zwei Zeitpunkte.',
  'Ein fehlender Wert ist fehlend, nicht null. `null` heisst "liegt nicht vor" und darf nicht als 0 gerechnet werden.',
  'Die Pilot-Analyse traegt in `_fuer` einen Stempel: fuer welches Objekt und welchen Datenstand sie gilt. Eine Analyse ohne passenden Abdruck ist veraltet.'
];

/* ═══ v2066 · DIE STRUKTUREN MIT UNTERSTRICH ERKLAEREN ═══════════════
 *
 * Marcel, 10.10.2026: „Sind da auch alle Angaben von der Stufe 3 drin?
 * Also wirklich alle Felder, die wir auch im Tab Objekt und auch im
 * Wohnungskonfigurator fuer Mehrfamilienhaeuser haben, mit drinne? Also
 * auch Mietverhaeltnis und die einzelnen Angaben zu den Wohnungen."
 *
 * GEMESSEN am echten Export (22 Objekte): ja, alles drin. 286 Feldnamen
 * je Datensatz, davon 273-281 belegt. Die Wohnungen stehen unter `_mfh`
 * bei 10 von 22 Objekten, mit 2 bis 24 Einheiten.
 *
 * ABER: das Lexikon fuehrte 225 Felder - alle aus dem FORMULAR. Die
 * 35 internen Strukturen mit Unterstrich, die wirklich Inhalt tragen,
 * waren KEINE davon. Darunter ausgerechnet `_mfh`, `_ankauf` und saemtliche
 * `_kpis_*`.
 *
 *   > Der Kopf dieser Datei sagt: „Ein Export, der nur Werte traegt,
 *   > gibt Daten weiter. Wissen gibt weiter, wer dazuschreibt, WAS die
 *   > Werte bedeuten." Genau das galt fuer die Formularfelder und nicht
 *   > fuer die Strukturen, die am meisten Erklaerung brauchen.
 *
 * Wer `_mfh` liest, muss sonst raten, ob `ist` und `soll` Monats- oder
 * Jahresmieten sind und was `status` bedeutet. Beides steht jetzt dabei.
 */
const STRUKTUREN = {
  _mfh: {
    was: 'Der Wohnungskonfigurator fuer Mehrfamilienhaeuser - je Einheit eine Zeile.',
    gilt_fuer: 'objart MFH, ZFH, GESCH, BUERO, HOTEL',
    felder: {
      gnd: 'Gesamtnutzungsdauer in Jahren (Anlage 2 ImmoWertV)',
      stand: 'Datum der letzten Bearbeitung (JJJJ-MM-TT)',
      aufgeteilt: 'true = nach WEG aufgeteilt, jede Einheit einzeln verkaeuflich',
      sollAbJahr: 'ab welchem Jahr die Soll-Miete angesetzt wird',
      gebaeude: 'Zustand der GEMEINSAMEN Bauteile: dach, aussenwand, leitungen, heizung. '
              + 'Stufen: "0" nicht modernisiert, "h" teilweise erneuert, "v" erneuert/modern',
      einheiten: 'Liste der Wohnungen - siehe `einheit` unten'
    },
    einheit: {
      nr: 'laufende Nummer der Einheit',
      lage: 'Freitext, z. B. "Nr. 10 - EG links"',
      art: 'wohnen | gewerbe | stellplatz',
      wfl: 'Wohnflaeche in m2 (deutsche Schreibweise, Komma als Dezimaltrenner)',
      zimmer: 'Anzahl Zimmer',
      ist: 'IST-Kaltmiete pro MONAT in Euro - was heute gezahlt wird',
      soll: 'SOLL-Kaltmiete pro MONAT in Euro - was ab `sollAbJahr` angesetzt wird',
      status: 'das MIETVERHAELTNIS: vermietet | leer | eigennutzung | gekuendigt',
      zustand: 'Note 1-5: 5 neuwertig, 4 modernisiert, 3 gepflegt, 2 renovierungsbed., 1 sanierungsbed.',
      massnahme: 'geplante Massnahme als Freitext, z. B. "Bad modernisieren"',
      kosten: 'geschaetzte Kosten dieser Massnahme in Euro'
    }
  },
  _ankauf: {
    was: 'Der eingefrorene Stand beim Nutzen-/Lastenwechsel - das SOLL. '
       + 'Der uebrige Datensatz ist der laufende Stand, das IST.',
    felder: {
      stichtag: 'Datum des Einfrierens (JJJJ-MM-TT)',
      kennzahlen_damals: 'die neun Kennzahlen zum Stichtag',
      daten: 'der vollstaendige Datensatz zum Stichtag (ohne Vorschaubild)'
    }
  },
  _kpis_: {
    was: 'Kennzahlen, gerechnet von den echten Kernen zu ihrer Zeit. '
       + 'Sie werden hier NICHT neu gerechnet - alte Daten mit heutigen Regeln '
       + 'zu messen waere eine andere Zahl.',
    einheiten: {
      _kpis_bmy: 'Bruttomietrendite in PROZENT',
      _kpis_nmy: 'Nettomietrendite in PROZENT',
      _kpis_dscr: 'Schuldendienstdeckung - ein VERHAELTNIS ohne Einheit',
      _kpis_ltv: 'Beleihungsauslauf in PROZENT',
      _kpis_cf_vs: 'Cashflow VOR Steuer pro JAHR in Euro',
      _kpis_cf_ns: 'Cashflow NACH Steuer pro JAHR in Euro',
      _kpis_bwk_y: 'Bewirtschaftungskosten pro JAHR in Euro'
    }
  },
  _rnd: {
    was: 'Das Ergebnis des RND-Wizards nach Anlage 2 ImmoWertV - der VORSCHLAG '
       + 'aus den Bauteilen, nicht die Eingabe des Nutzers.',
    nicht_verwechseln_mit: '`afa_rnd_jahre` im Reiter Steuer: dort steht, was der '
       + 'Nutzer angesetzt hat (etwa aus einem Gutachten). Weichen beide ab, '
       + 'ist das ein Befund und kein Fehler.',
    felder: {
      rnd_jahre: 'Restnutzungsdauer in Jahren',
      gnd_jahre: 'Gesamtnutzungsdauer in Jahren (Anlage 1)',
      alter_jahre: 'Alter zum Stichtag',
      punkte: 'Modernisierungspunkte nach Anlage 2',
      verfahren: 'welches Verfahren gerechnet wurde',
      afa_vorteil_eur: 'Barwertvorteil der kuerzeren AfA gegenueber dem Standardsatz',
      stand: 'Datum der Berechnung'
    }
  },
  marktbericht: {
    was: 'Steht NEBEN `daten`, nicht darin: die Marktberichte liegen in einer '
       + 'eigenen Datenbank (mb.market_reports) und werden ueber '
       + '`object_key = "dp:" + id` zugeordnet.',
    stand: 'der heutige Stand: Adresse, Objektart, Wohnflaeche, Baujahr, '
         + 'Marktwert, Deal-Score, Zahl der Berichte, Datum des letzten',
    verlauf: 'EIN EINTRAG JE BERICHT, nach Datum sortiert - daran liest man ab, '
           + 'ob der Marktwert ueber die Jahre gestiegen oder gefallen ist. '
           + 'Je Punkt: datum, bericht_id, marktwert_eur, marktwert_von/bis '
           + '(die Spanne), eur_pro_qm, wohnflaeche, baujahr.',
    hinweis: 'Fehlt der Block ganz, hat das Objekt keinen Marktbericht. Steht im '
           + 'Kopf `marktbericht_fehler`, war der Dienst nicht erreichbar - dann '
           + 'ist das Fehlen KEINE Aussage ueber die Objekte.'
  },
  _ds2_: {
    was: 'Investor Deal Score 2.0 - Score, Kategorien und ob er gerechnet wurde.'
  },
  _deal_won: {
    was: 'true = Objekt gewonnen. `_deal_won_at` traegt das Datum, '
       + '`_deal_lost` das Gegenstueck.'
  }
};

/**
 * Baut das Export-Paket fuer einen Nutzer.
 * @param {string} userId
 * @param {{ fotos?: boolean }} opt
 */
/* v2043c - aus der Feld-LISTE ein Nachschlagewerk machen: Schluessel
   ist die Feld-Id, Wert sind Beschriftung und Art. Die Reihenfolge
   geht getrennt mit, falls sie jemand braucht. */
function felderAlsLexikon(liste) {
  if (!Array.isArray(liste)) return liste || null;
  const aus = {};
  liste.forEach(function (f) {
    if (!f || !f.id) return;
    const e = {};
    Object.keys(f).forEach(function (n) { if (n !== 'id') e[n] = f[n]; });
    aus[f.id] = e;
  });
  return aus;
}

async function bauen(userId, opt) {
  opt = opt || {};
  const mitFotos = !!opt.fotos;

  const r = await query(
    `SELECT id, name, kuerzel, ort, seq_no, version, created_at, updated_at,
            data, ai_analysis, photos
       FROM objects
      WHERE user_id = $1
      ORDER BY seq_no NULLS LAST, created_at`,
    [userId]
  );

  const k = konstanten().daten || {};

  const objekte = r.rows.map((o) => {
    let daten = o.data;
    if (typeof daten === 'string') { try { daten = JSON.parse(daten); } catch (e) { daten = {}; } }
    daten = daten || {};

    /* Die Analyse wird AUFGELOEST mitgegeben, nicht als Zeichenkette:
       sonst muesste der Empfaenger sie selbst auseinandernehmen. */
    let analyse = null;
    if (o.ai_analysis) {
      try { analyse = JSON.parse(o.ai_analysis); }
      catch (e) { analyse = { _roh: String(o.ai_analysis).slice(0, 20000) }; }
    }

    let fotos = o.photos;
    if (typeof fotos === 'string') { try { fotos = JSON.parse(fotos); } catch (e) { fotos = []; } }
    const fotoZahl = Array.isArray(fotos) ? fotos.length : 0;

    /* `_thumb` ist ein base64-Vorschaubild im Datensatz - es blaeht die
       Datei auf und traegt nichts bei. Raus, und zwar sichtbar. */
    const schlank = {};
    Object.keys(daten).forEach((key) => {
      if (key === '_thumb') return;
      if (key === '_photos' && !mitFotos) return;
      schlank[key] = daten[key];
    });

    return {
      id: o.id,
      nummer: o.seq_no || null,
      name: o.name || null,
      kuerzel: o.kuerzel || null,
      ort: o.ort || null,
      version: o.version,
      angelegt_am: o.created_at,
      geaendert_am: o.updated_at,
      lageklasse: daten.lageklasse || null,
      gewonnen: daten._deal_won === true || daten._deal_won === 'true',
      verloren: daten._deal_lost === true || daten._deal_lost === 'true',
      ankauf_stand: (daten._ankauf && daten._ankauf.stichtag) ? daten._ankauf.stichtag : null,
      daten: schlank,
      analyse: analyse,
      fotos_anzahl: fotoZahl,
      fotos: mitFotos && Array.isArray(fotos) ? fotos : undefined
    };
  });

  let eigenes = null;
  try { eigenes = await projektwissen.zusatzFuer(userId); } catch (e) { eigenes = null; }

  /* v2047 - was NICHT an den Objekten haengt.

     Marcel hat danach gefragt, und die ehrliche Antwort war: nur zur
     Haelfte drin. Die Objekt-Analysen kommen aus `objects`, die
     PORTFOLIO-Analyse liegt in `user_settings` unter
     `portfolio_analyse` (v2012) - mein Export fragte nur die
     Objekttabelle und hat sie nie gesehen.

     Ein Export, der "alles" verspricht, muss wissen, wo alles liegt.

     `updated_at` geht mit: eine Portfolio-Beurteilung ohne Datum ist
     bei einem Bestand, der sich jeden Monat aendert, eine Falle -
     dieselbe, gegen die der Stempel an der Objekt-Analyse gebaut
     wurde. */
  let einstellungen = {};
  try {
    const e = await query(
      'SELECT schluessel, wert, updated_at FROM user_settings WHERE user_id = $1 AND schluessel = ANY($2)',
      [userId, ['portfolio_analyse', 'lage_profil', 'datenraum']]
    );
    e.rows.forEach((r) => {
      let w = r.wert;
      if (typeof w === 'string') { try { w = JSON.parse(w); } catch (x) { /* bleibt Text */ } }
      einstellungen[r.schluessel] = { wert: w, stand: r.updated_at };
    });
  } catch (e) { einstellungen = {}; }

  /* Wie viele Objekte tragen wirklich eine Analyse? Eine Datei, in
     der zwanzig von zweiundzwanzig fehlen, sieht vollstaendig aus. */
  const mitAnalyse = objekte.filter((o) => o.analyse).length;

  /* ── v2069 · Marktberichte und ihr Verlauf ───────────────────────── */
  let mbObjekte = [], mbVerlauf = [], mbFehler = null;
  try {
    const [a, b] = await Promise.all([
      mbHolen('/objects', userId),
      mbHolen('/objects/history', userId)
    ]);
    if (a && a.fehler) mbFehler = a.fehler;
    else mbObjekte = (a && (a.objects || a)) || [];
    if (!mbFehler && b && b.fehler) mbFehler = b.fehler;
    else if (!(b && b.fehler)) mbVerlauf = (b && (b.history || b)) || [];
    if (!Array.isArray(mbObjekte)) mbObjekte = [];
    if (!Array.isArray(mbVerlauf)) mbVerlauf = [];
  } catch (e) { mbFehler = String(e && e.message || e).slice(0, 120); }

  /* Je Objekt zuordnen. Der Schluessel ist `dp:<objects.id>` - so legt
     der Marktbericht ihn seit v942 an. */
  if (mbObjekte.length || mbVerlauf.length) {
    const nachKey = {};
    mbObjekte.forEach((m) => { if (m && m.object_key) nachKey[m.object_key] = m; });
    const verlaufNachKey = {};
    mbVerlauf.forEach((v) => {
      if (!v || !v.object_key) return;
      (verlaufNachKey[v.object_key] = verlaufNachKey[v.object_key] || []).push(v);
    });
    objekte.forEach((o) => {
      const key = 'dp:' + o.id;
      const m = nachKey[key];
      const v = verlaufNachKey[key];
      if (!m && !v) return;
      o.marktbericht = {
        /* Der heutige Stand … */
        stand: m ? {
          adresse: m.address || null, objektart: m.property_type || null,
          wohnflaeche: m.living_area || null, baujahr: m.build_year || null,
          marktwert_eur: m.market_value || null, deal_score: m.deal_score || null,
          berichte: m.snapshots || null, zuletzt: m.created_at || null
        } : null,
        /* … und was ueber die Zeit daraus wurde. Genau danach hat Marcel
           gefragt: „ob das Objekt im Preis gestiegen ist". */
        verlauf: v ? v.slice()
          .sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))
          .map((x) => ({
            datum: x.created_at, bericht_id: x.report_id,
            marktwert_eur: x.market_value || null,
            marktwert_von: x.market_value_low || null,
            marktwert_bis: x.market_value_high || null,
            eur_pro_qm: x.median_sqm || null,
            wohnflaeche: x.living_area || null, baujahr: x.build_year || null
          })) : []
      };
    });
  }

  return {
    dealpilot_export: 'portfolio',
    format_version: 1,
    erzeugt_am: new Date().toISOString(),
    anzahl_objekte: objekte.length,
    /* v2047 - die Deckung gehoert in den Kopf, nicht ins Kleingedruckte. */
    objekte_mit_pilot_analyse: mitAnalyse,
    /* v2069 - und die des Marktberichts. Faellt der Dienst aus, steht
       der Grund hier, statt dass der Block stillschweigend fehlt. */
    objekte_mit_marktbericht: objekte.filter((o) => o.marktbericht).length,
    marktbericht_verlaufspunkte: objekte.reduce(
      (s, o) => s + ((o.marktbericht && o.marktbericht.verlauf) || []).length, 0),
    marktbericht_fehler: mbFehler || undefined,
    fotos_enthalten: mitFotos,
    /* ── Das Lexikon: was die Schluessel bedeuten ──────────────────
       Ohne diesen Block ist der Export eine Liste aus 280 Kuerzeln.
       Mit ihm kann ein Mensch - oder ein fremdes Programm - damit
       rechnen, ohne zu raten. */
    lexikon: {
      /* v2043c - als NACHSCHLAGEWERK, nicht als Liste.

         Gemessen: k.felder ist ein ARRAY - im Export kamen die
         Schluessel 0, 1, 2 an, und lexikon.felder.kp ging ins Leere.
         Damit war das Lexikon zwar vorhanden, aber nicht benutzbar:
         wer wissen will, was kp bedeutet, schlaegt unter kp nach
         und nicht unter 37.

         Ein Lexikon, das man nicht nachschlagen kann, ist ein
         Inhaltsverzeichnis. */
      felder: felderAlsLexikon(k.felder),
      felder_reihenfolge: Array.isArray(k.felder) ? k.felder.map(function (f) { return f.id; }) : null,
      objektarten: k.objektarten || null,
      etappen: k.etappen || null,
      /* v2066 - die Strukturen mit Unterstrich. `felder` oben kennt nur
         die 225 Formularfelder; `_mfh`, `_ankauf` und die `_kpis_*`
         stehen in KEINEM Formular und brauchen die Erklaerung am
         dringendsten. */
      strukturen: STRUKTUREN,
      score_stufen: SCORE_STUFEN,
      hinweise: HINWEISE
    },
    /* ── Das Wissen, das die Piloten benutzen ──────────────────────
       Einmal, nicht je Objekt: es gilt fuer alle. */
    wissen: {
      projekt: projektwissen.wissen(),
      eigenes: eigenes || null,
      /* v2047 - die Beurteilung des PORTFOLIO-Piloten, mit Stand.
         Sie entsteht im Cockpit und haengt an keinem Objekt. */
      portfolio_analyse: einstellungen.portfolio_analyse || null,
      /* worauf bei Lagen geachtet wird, und wo die Unterlagen liegen -
         beides Wissen ueber das Portfolio, beides war bisher draussen. */
      lage_profil: einstellungen.lage_profil || null,
      datenraum: einstellungen.datenraum || null
    },
    objekte: objekte
  };
}

module.exports = { bauen, SCORE_STUFEN, HINWEISE };
