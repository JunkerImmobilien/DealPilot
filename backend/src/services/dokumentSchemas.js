'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   v1678 — Dokumentarten für den Import: Klassifikation und Extraktionsschemata

   Portiert aus dem Import-Modul v1.1.0 (`import_service.py`,
   `DOKUMENT_TYPEN` und `EXTRAKTIONS_PROMPTS`). Die Schemata sind
   inhaltlich unverändert übernommen — kommt eine neue Modulfassung,
   wird HIER nachgezogen und sonst nirgends.

   WAS BEWUSST ANDERS IST ALS IM MODUL
   ───────────────────────────────────
   1. `kpt` hat hier einen Extraktions-Prompt. Im Modul wird die
      Kaufpreisaufteilung zwar klassifiziert (Z. 82), aber NICHT
      extrahiert — der Prompt fehlt dort. Unserer liefert genau die
      Feldnamen, die `POST /bmf/aufteilung` erwartet (gemessen am
      Gutachten Am Markt 18: Bodenwert auf den Cent gleich). Damit
      schliesst sich die Kette: Dokument lesen -> amtliche BMF-Vorlage
      rechnen -> gegen das Gutachten halten.

   2. Die Rechnung bleibt IMMER hier. Jedes Schema liest auch das
      ERGEBNIS des fremden Gutachtens mit (`rnd_jahre`,
      `verkehrswert_eur`, `gebaeudeanteil_pct`) — aber als
      Vergleichswert, nie als Übernahme. Eine übernommene Zahl, die
      niemand gegenprüft, ist eine Behauptung.

   3. `foto` fehlt: Bilder gehen bei uns über `extractBeleg` (Vision).
═══════════════════════════════════════════════════════════════════════════ */

/* ── Klassifikation ───────────────────────────────────────────────────────
   v1678c — `leit` gegen `keywords`.

   Ein Wort ist nicht so viel wert wie das andere. „Kaufpreis", „Notar"
   und „Käufer" stehen in JEDEM Immobiliendokument; „Kaufpreisaufteilung"
   oder „BFH IX R 12/21" stehen nur in einem. Mit einer flachen Zählung
   gewann deshalb `kaufvertrag` gegen `kpt` an einer echten
   Kaufpreisaufteilung — zwei Treffer gegen zwei Treffer, und bei
   Gleichstand entscheidet die Reihenfolge im Objekt.

   `leit` sind die beweisenden Begriffe: 3 Punkte im Text, 6 im
   Dateinamen. `keywords` sind Beiwerk: 1 und 2. Ein einziger
   Leitbegriff schlägt damit jedes Beiwerk.
   ───────────────────────────────────────────────────────────────────── */
const DOKUMENT_TYPEN = {
  grundbuch: {
    label: 'Grundbuchauszug',
    /* v3016c · gemessen am Wohnungsgrundbuch Sachsenstr.: es zitiert Teilungserklaerung und
       Aufteilungsplan und wurde als Teilungserklaerung erkannt; Datei hiess „GB Auszug" */
    leit: ['Grundbuchauszug', 'Bestandsverzeichnis', 'Abteilung III', 'Wohnungsgrundbuch', 'Grundbuch von', 'GB Auszug', 'GB-Auszug'],
    keywords: ['Grundbuch', 'Abteilung I', 'Abteilung II', 'Abteilung III',
               'Bestandsverzeichnis', 'Blatt', 'Amtsgericht']
  },
  kataster: {
    label: 'Katasterauszug',
    leit: ['Liegenschaftskataster', 'ALKIS', 'Katasteramt'],
    keywords: ['Liegenschaftskataster', 'ALKIS', 'Flurstück', 'Gemarkung',
               'Katasteramt', 'Flur']
  },
  kaufvertrag: {
    label: 'Kaufvertrag',
    leit: ['Kaufvertrag', 'Auflassung', 'UR-Nr'],
    keywords: ['Kaufvertrag', 'Notar', 'UR-Nr', 'Kaufpreis', 'Auflassung',
               'Verkäufer', 'Käufer', 'Miteigentumsanteil']
  },
  weg_protokoll: {
    label: 'WEG-Protokoll',
    leit: ['Eigentuemerversammlung', 'Eigentümerversammlung', 'Instandhaltungsrücklage', 'WEG-Protokoll'],
    keywords: ['Eigentümerversammlung', 'WEG', 'Beschluss', 'Verwalter',
               'Instandhaltungsrücklage', 'Hausgeld', 'Protokoll']
  },
  boris: {
    label: 'Bodenrichtwert-Auszug',
    leit: ['Bodenrichtwert', 'BORIS', 'Bodenrichtwertzone'],
    keywords: ['Bodenrichtwert', 'BORIS', 'BRW', 'Bodenrichtwertzone',
               'Gutachterausschuss', 'Bauland']
  },
  vwg_vorgutachten: {
    label: 'Verkehrswertgutachten',
    leit: ['Verkehrswertgutachten', 'NHK 2010', '§ 194 BauGB'],
    keywords: ['Verkehrswertgutachten', 'Sachwertverfahren', 'NHK 2010',
               '§ 194 BauGB', 'Verkehrswert']
  },
  rndg: {
    label: 'Restnutzungsdauergutachten',
    leit: ['Restnutzungsdauer', 'RNDG', 'Punktrastermethode', 'Modernisierungspunkte'],
    keywords: ['Restnutzungsdauer', 'RNDG', '§ 7 Abs. 4', 'Punktrastermethode',
               'Modernisierungspunkte']
  },
  kpt: {
    label: 'Kaufpreisaufteilung',
    leit: ['Kaufpreisaufteilung', 'KPT', 'Jacoby', 'BFH IX R 12/21', 'umgekehrten Ertragswertmethode', 'steuerlich absetzbarer Gebäudeanteil'],
    keywords: ['Kaufpreisaufteilung', 'Jacoby', 'Aufteilung Gebäude und Boden',
               'BFH IX R 12/21', 'umgekehrten Ertragswertmethode',
               'Kapitalisierungsfaktor', 'Bodenwertverzinsung',
               'steuerlich absetzbarer Gebäudeanteil']
  },
  /* v3016 · Marcel 28.10.2026: „es soll einfach alles verwertbare aus allen dokumenten
     entnommen werden". Vier neue Arten. Persoenliche Unterlagen eines Mieters
     (Bonitaet, Bescheide, Zahlungsbestaetigungen) werden ERKANNT und NICHT ausgelesen. */
  energieausweis: {
    label: 'Energieausweis',
    leit: ['Energieausweis', 'Endenergiebedarf', 'Endenergieverbrauch', 'Primärenergiebedarf', 'Energieeffizienzklasse'],
    keywords: ['GEG', 'EnEV', 'kWh', 'Energieträger', 'Modernisierungsempfehlungen', 'Gebäudenutzfläche']
  },
  teilungserklaerung: {
    label: 'Teilungserklärung',
    leit: ['Teilungserklärung', 'Teilungserklaerung', 'Gemeinschaftsordnung', 'Aufteilungsplan', 'Abgeschlossenheitsbescheinigung'],
    keywords: ['Sondereigentum', 'Gemeinschaftseigentum', 'Sondernutzungsrecht', 'Miteigentumsanteil', 'Wohnungseigentumsgesetz']
  },
  mietvertrag: {
    label: 'Mietvertrag',
    leit: ['Mietvertrag', 'Wohnraummietvertrag', 'Mietvertrages', 'Gewerbemietvertrag'],
    keywords: ['Vermieter', 'Mieter', 'Mietbeginn', 'Kaution', 'Betriebskosten', 'Nettokaltmiete', 'Staffelmiete']
  },
  mietaufstellung: {
    label: 'Mieterliste',
    leit: ['Mieterliste', 'Mietaufstellung', 'Mieterübersicht', 'Mietenliste', 'Mieteinnahmen je Einheit'],
    keywords: ['Einheit', 'Wohnung', 'Kaltmiete', 'leerstehend', 'Leerstand', 'Mietbeginn', 'Summe']
  },
  mieter_unterlagen: {
    label: 'Persönliche Unterlagen eines Mieters',
    leit: ['Mietzahlungsbestätigung', 'Mietschuldenfreiheit', 'Selbstauskunft', 'Rentenbescheid', 'Gehaltsabrechnung', 'Lohnabrechnung', 'SCHUFA', 'Bonitätsauskunft', 'Entschädigungsrente'],
    keywords: ['Rente', 'Einkommen', 'Arbeitgeber']
  },
  marktbericht: {
    label: 'Marktbericht',
    leit: ['Grundstücksmarktbericht', 'Kaufpreissammlung', 'Marktbericht'],
    keywords: ['Marktbericht', 'Grundstücksmarktbericht', 'Immobilienmarkt',
               'Kaufpreissammlung', 'Vergleichspreise']
  }
};

/**
 * Erkennt die Dokumentart per Stichwort-Treffer.
 * Der Dateiname zählt dreifach so stark wie ein Treffer im Text — wer
 * eine Datei „RNDG Am Markt 18.pdf" nennt, sagt damit mehr als ein
 * beiläufiges Wort auf Seite 14.
 *
 * @returns {{typ: string|null, label: string|null, sicherheit: number, alle: object}}
 */
function klassifiziere(text, dateiname) {
  const t = String(text || '').toLowerCase().slice(0, 5000);
  const d = String(dateiname || '').toLowerCase();

  const alle = {};
  let bester = null, besterScore = 0, besterLeit = 0;

  Object.keys(DOKUMENT_TYPEN).forEach(function (id) {
    const def = DOKUMENT_TYPEN[id];
    const leit = def.leit || [];
    const kws = def.keywords || [];
    if (!kws.length && !leit.length) return;

    let score = 0, leitTreffer = 0;

    /* Leitbegriffe zuerst — sie entscheiden. */
    leit.forEach(function (kw) {
      const k = kw.toLowerCase();
      if (t.indexOf(k) !== -1) { score += 3; leitTreffer++; }
      if (d.indexOf(k) !== -1) { score += 6; leitTreffer++; }
    });
    /* Beiwerk: bestätigt, beweist aber nichts allein. */
    kws.forEach(function (kw) {
      const k = kw.toLowerCase();
      if (leit.indexOf(kw) !== -1) return;   /* nicht doppelt zählen */
      if (t.indexOf(k) !== -1) score += 1;
      if (d.indexOf(k) !== -1) score += 2;
    });

    alle[id] = score;
    if (score > besterScore) { besterScore = score; bester = id; besterLeit = leitTreffer; }
  });

  /* v1678b — NICHT gegen die Stichwortzahl normalisieren.
     ─────────────────────────────────────────────────────
     Das Modul rechnet `score / (len(keywords) * 3)`. Damit wird eine
     Art umso schwerer erkannt, je sorgfältiger ihre Stichwortliste
     gepflegt ist: `kpt` führt acht Stichwörter, `rndg` fünf. Gemessen
     an einer echten Kaufpreisaufteilung, in der „Kaufpreisaufteilung"
     UND „umgekehrten Ertragswertmethode" wörtlich stehen: 2/24 = 0,08
     — unter der Schwelle, also „unbekannt", während ein einzelner
     schwacher Treffer bei einer schlanken Liste durchkommt.

     Ein Maß, das die gründlichere Liste bestraft, misst die Liste und
     nicht das Dokument. Deshalb zählen jetzt die TREFFER selbst:
     zwei Punkte genügen (ein Wort im Text plus eines im Dateinamen,
     oder zwei im Text). Die Sicherheit ist der Score gegen sechs
     Punkte gedeckelt — bei sechs ist die Sache klar.

     v1678c: Die Schwelle ist jetzt ein LEITBEGRIFF oder vier Punkte
     Beiwerk. Allein „Kaufpreis" und „Käufer" reichen nicht mehr aus,
     um ein Dokument zum Kaufvertrag zu erklären.                     */
  const sicherheit = Math.min(1, besterScore / 9);
  const reicht = besterLeit >= 1 || besterScore >= 4;

  if (!bester || !reicht) {
    return {
      typ: null, label: null,
      sicherheit: Math.round(sicherheit * 100) / 100,
      punkte: besterScore, leitbegriffe: besterLeit, alle: alle
    };
  }
  return {
    typ: bester,
    label: DOKUMENT_TYPEN[bester].label,
    sicherheit: Math.round(sicherheit * 100) / 100,
    punkte: besterScore,
    leitbegriffe: besterLeit,
    alle: alle
  };
}

/* ── Extraktionsschemata ──────────────────────────────────────────────── */
const SCHEMATA = {
  grundbuch: {
    einleitung: 'Aus dem folgenden deutschen Grundbuchauszug extrahiere die Daten als JSON.',
    schema: [
      '{',
      '  "amtsgericht": string,',
      '  "blatt_nr": string,',
      /* v2210: keine Namen und Geburtsdaten mehr - nur Anzahl und Anteile (Text wird vorher geschwaerzt) */
      '  "eigentuemer_anzahl": number,',
      '  "eigentuemer_anteile": [string] (z. B. "1/2", "Gesamthand"),',
      '  "flurstuecke": [{"gemarkung": string, "flur": string, "flurstueck": string, "flaeche_m2": number, "nutzung": string}],',
      '  "abt_ii": [{"lfd_nr": string, "art": string, "berechtigter_art": string (Person / Gemeinde / Versorger / Unternehmen - KEIN Name), "eingetragen_am": string}],',
      '  "abt_iii": [{"lfd_nr": string, "betrag_eur": number, "glaubiger": string, "eingetragen_am": string}],',
      '  "grundschulden_gesamt_eur": number,',
      /* v3016 · Wohnungsgrundbuch: MEA und Sondereigentum; Lasten als Risiko */
      '  "wohnungsgrundbuch": boolean,',
      '  "miteigentumsanteil": string (z. B. "125,5/1.000"),',
      '  "sondereigentum": string (Beschreibung laut Bestandsverzeichnis, z. B. "Wohnung im EG links Nr. 1 laut Aufteilungsplan"),',
      '  "sondernutzungsrechte": [string],',
      '  "gemarkung": string, "flur": string, "flurstueck": string (das erste Flurstueck),',
      '  "grundstuecksflaeche_m2": number (Flaeche des ganzen Grundstuecks laut Bestandsverzeichnis),',
      '  "risiken": [{"titel": string (kurz), "beschreibung": string (1-2 Saetze: was steht da, was folgt daraus fuer einen Kaeufer/Investor), "schwere": "hoch"|"mittel"|"niedrig", "kosten_eur": number|null, "jahr": number|null, "fundstelle": string (Seite/TOP/Abteilung)}] (Lasten in Abt. II wie Wegerecht, Leitungsrecht, Vorkaufsrecht, Niessbrauch, Wohnrecht, Zwangsversteigerungs- oder Sanierungsvermerk; Rangfolge und Abloesung in Abt. III)',
      '}'
    ],
    zahlen: { grundschulden_gesamt_eur: [0, 1e9] }
  },

  kataster: {
    einleitung: 'Aus dem folgenden deutschen Katasterauszug (ALKIS) extrahiere die Daten als JSON.',
    schema: [
      '{',
      '  "gemarkung": string,',
      '  "flurstuecke": [{"flur": string, "flurstueck": string, "flaeche_m2": number, "nutzungsart": string, "lage": string}],',
      '  "koordinaten_utm32": {"east": number, "north": number},',
      '  "aktualitaet": string (Datum),',
      '  "amt": string',
      '}'
    ],
    zahlen: {}
  },

  kaufvertrag: {
    einleitung: 'Aus dem folgenden deutschen Kaufvertrag extrahiere die Daten als JSON.',
    schema: [
      '{',
      '  "notar": string,',
      '  "ur_nr": string,',
      '  "kaufdatum": string DD.MM.JJJJ,',
      '  "kaufpreis_eur": number,',
      '  "nebenkosten_eur": number (Notar + Grundbuch + Makler + Grunderwerbsteuer, falls angegeben),',
      '  "grunderwerbsteuer_pct": number,',
      /* v2210: Käufer und Verkäufer nur als Anzahl - keine Namen, keine Anschriften */
      '  "verkaeufer_anzahl": number,',
      '  "kaeufer_anzahl": number,',
      '  "objekt": {"adresse": string, "flurstueck": string, "miteigentumsanteil": string, "raeume": string},',
      '  "reparaturbedarf_eur": number (nur falls kaufpreismindernd)',
      '}'
    ],
    zahlen: {
      kaufpreis_eur: [0, 1e9],
      nebenkosten_eur: [0, 1e8],
      grunderwerbsteuer_pct: [0, 15],
      reparaturbedarf_eur: [0, 1e8]
    }
  },

  weg_protokoll: {
    einleitung: 'Aus dem folgenden Protokoll einer Eigentuemerversammlung extrahiere die Daten als JSON.',
    schema: [
      '{',
      '  "versammlungsdatum": string DD.MM.JJJJ,',
      '  "verwalter": string,',
      '  "instandhaltungsruecklage_eur": number,',
      '  "hausgeld_monatlich_eur": number,',
      '  "sonderumlagen_geplant": [{"beschreibung": string, "betrag_eur": number, "jahr": number}],',
      '  "beschluesse_wichtig": [string],',
      '  "geplante_sanierungen": [{"gewerk": string, "jahr": number, "kosten_geschaetzt_eur": number}],',
      /* v3016 · Marcel 28.10.2026: „WEG Protokolle sollen ausgewertet werden und die
         wichtigsten Punkte rausgezogen werden und risiken beschrieben werden" */
      '  "art": "Protokoll"|"Einladung"|"Wirtschaftsplan"|"Jahresabrechnung",',
      '  "ruecklage_stand_eur": number (Stand der Erhaltungsruecklage der ganzen Gemeinschaft),',
      '  "ruecklage_zufuehrung_jahr_eur": number,',
      '  "wirtschaftsplan_gesamt_eur": number,',
      '  "kernpunkte": [string] (die 3-8 wichtigsten Punkte fuer einen Kaeufer, je ein Satz mit Zahl wo vorhanden),',
      '  "maengel": [string] (genannte Schaeden und Maengel am Gemeinschaftseigentum),',
      '  "rechtsstreitigkeiten": [string],',
      '  "hausgeldrueckstaende": string,',
      '  "verwalterwechsel": string,',
      '  "risiken": [{"titel": string (kurz), "beschreibung": string (1-2 Saetze: was steht da, was folgt daraus fuer einen Kaeufer/Investor), "schwere": "hoch"|"mittel"|"niedrig", "kosten_eur": number|null, "jahr": number|null, "fundstelle": string (Seite/TOP/Abteilung)}]',
      '}'
    ],
    zahlen: {
      instandhaltungsruecklage_eur: [0, 1e8],
      hausgeld_monatlich_eur: [0, 100000]
    }
  },

  boris: {
    einleitung: 'Aus dem folgenden Bodenrichtwert-Auszug (BORIS) extrahiere die Daten als JSON.',
    schema: [
      '{',
      '  "brw_eur_m2": number,',
      '  "stichtag": string DD.MM.JJJJ,',
      '  "zone_nr": string,',
      '  "zone_bezeichnung": string,',
      '  "nutzung": string,',
      '  "beitragsfrei": boolean,',
      '  "gutachterausschuss": string,',
      '  "veroeffentlicht_am": string DD.MM.JJJJ',
      '}'
    ],
    zahlen: { brw_eur_m2: [0, 100000] }
  },

  vwg_vorgutachten: {
    einleitung: 'Aus dem folgenden Verkehrswertgutachten extrahiere die Kernzahlen als JSON.',
    schema: [
      '{',
      '  "gutachten_nr": string,',
      '  "sachverstaendiger": string,',
      '  "verkehrswert_eur": number,',
      '  "stichtag": string DD.MM.JJJJ,',
      '  "objekt": {"adresse": string, "baujahr": number, "wohnflaeche_m2": number, "bgf_m2": number, "grundstuecksflaeche_m2": number},',
      '  "bodenrichtwert_eur_m2": number,',
      '  "bodenwert_eur": number,',
      '  "sachwertfaktor": number,',
      '  "restnutzungsdauer_jahre": number,',
      '  "gesamtnutzungsdauer_jahre": number',
      '}'
    ],
    zahlen: {
      verkehrswert_eur: [0, 1e9],
      bodenrichtwert_eur_m2: [0, 100000],
      bodenwert_eur: [0, 1e9],
      sachwertfaktor: [0.1, 5],
      restnutzungsdauer_jahre: [0, 120],
      gesamtnutzungsdauer_jahre: [10, 120]
    }
  },

  rndg: {
    einleitung: 'Aus dem folgenden Restnutzungsdauergutachten extrahiere die Kernzahlen als JSON.',
    schema: [
      '{',
      '  "gutachten_nr": string,',
      '  "objekt_adresse": string,',
      '  "baujahr": number,',
      '  "bewertungsstichtag": string DD.MM.JJJJ,',
      '  "gnd_jahre": number (Gesamtnutzungsdauer),',
      '  "rnd_jahre": number (Restnutzungsdauer laut Gutachten),',
      '  "modernisierungspunkte": number (0 bis 20, Anlage 2 ImmoWertV),',
      '  "verfahren_gewaehlt": string, einer von "Linear"/"Punktraster"/"Technisch",',
      '  "ausstattung": {"veraltet_pct": number, "standard_pct": number, "gehoben_pct": number}',
      '}'
    ],
    zahlen: {
      baujahr: [1500, 2100],
      gnd_jahre: [10, 120],
      rnd_jahre: [0, 120],
      modernisierungspunkte: [0, 20]
    },
    pflicht: ['baujahr', 'gnd_jahre']
  },

  /* Den gibt es im Modul NICHT — dort wird `kpt` nur klassifiziert.
     Die Feldnamen sind exakt die von POST /bmf/aufteilung, damit das
     Ergebnis ohne Umbenennen in die amtliche Vorlage geht. Genau an
     falschen Feldnamen ist v1669 gescheitert: fuenf verworfene Felder,
     Bodenwert um Faktor 2,9 daneben, Antwort sah plausibel aus.      */
  kpt: {
    /* v1678d — der Prompt widersprach sich selbst: „nicht die
       Ergebnisse" stand ueber einem Schema, das zwei Ergebnisfelder
       abfragt. Die KI hat gehorcht und beide leer gelassen, obwohl
       94,35 % und 7.617,56 € woertlich im Text standen. Jetzt ist die
       Trennung benannt statt verneint.                              */
    einleitung: [
      'Aus der folgenden Kaufpreisaufteilung (Gutachten zur Aufteilung des',
      'Kaufpreises auf Grund und Boden und Gebaeude) extrahiere zweierlei als JSON:',
      '',
      '(A) die EINGANGSDATEN, mit denen das Gutachten gerechnet hat, und',
      '(B) genau zwei ERGEBNISSE des Gutachtens — sie tragen im Schema',
      '    ausdruecklich die Endung "_laut_gutachten" und werden nur zum',
      '    Abgleich benoetigt.',
      '',
      'Fuelle BEIDE Gruppen, soweit sie im Text stehen.'
    ].join('\n'),
    schema: [
      '{',
      '  "lage": string (Anschrift des Objekts),',
      '  "kaufpreis": number (Kaufpreis inklusive Nebenkosten, Euro),',
      '  "kaufdatum": string DD.MM.JJJJ,',
      '  "baujahr": number (urspruengliches Baujahr),',
      '  "wohnflaeche": number (Wohn-/Nutzflaeche in m2),',
      '  "grundstuecksgroesse": number (m2),',
      '  "bodenrichtwert": number (Euro je m2),',
      '  "mea_zaehler": number (Zaehler des Miteigentumsanteils, z.B. 15.11),',
      '  "mea_nenner": number (Nenner, z.B. 1000),',
      '  "miete_monatlich": number (Nettokaltmiete monatlich inkl. Stellplaetze),',
      '  "liegenschaftszinssatz": number (in Prozent, z.B. 2.5),',
      '  "gebaeudeanteil_pct_laut_gutachten": number (ERGEBNIS des Gutachtens, nur zum Vergleich),',
      '  "bodenwert_eur_laut_gutachten": number (ERGEBNIS des Gutachtens, nur zum Vergleich)',
      '}'
    ],
    zahlen: {
      kaufpreis: [0, 1e9],
      baujahr: [1500, 2100],
      wohnflaeche: [1, 100000],
      grundstuecksgroesse: [0, 1e7],
      bodenrichtwert: [0, 100000],
      mea_zaehler: [0, 1e6],
      mea_nenner: [1, 1e6],
      miete_monatlich: [0, 1e6],
      liegenschaftszinssatz: [0, 15],
      gebaeudeanteil_pct_laut_gutachten: [0, 100],
      bodenwert_eur_laut_gutachten: [0, 1e9]
    },
    pflicht: ['kaufpreis', 'baujahr', 'wohnflaeche']
  },

  energieausweis: {
    einleitung: 'Aus dem folgenden Energieausweis (GEG) extrahiere die Daten als JSON.',
    schema: [
      '{',
      '  "ausweisart": "Bedarf"|"Verbrauch",',
      '  "gueltig_bis": string DD.MM.JJJJ,',
      '  "energieeffizienzklasse": string (A+ bis H),',
      '  "endenergie_kwh_m2a": number,',
      '  "primaerenergie_kwh_m2a": number,',
      '  "wesentlicher_energietraeger": string,',
      '  "baujahr_gebaeude": number,',
      '  "baujahr_waermeerzeuger": number,',
      '  "anzahl_wohnungen": number,',
      '  "gebaeudenutzflaeche_m2": number,',
      '  "modernisierungsempfehlungen": [string],',
      '  "gemarkung": string, "flur": string, "flurstueck": string (falls im selben Dokument eine Flurkarte oder ein Katasterauszug steht),',
      '  "grundstuecksflaeche_m2": number (nur aus einer Flurkarte/einem Katasterauszug im selben Dokument),',
      '  "risiken": [{"titel": string (kurz), "beschreibung": string (1-2 Saetze: was steht da, was folgt daraus fuer einen Kaeufer/Investor), "schwere": "hoch"|"mittel"|"niedrig", "kosten_eur": number|null, "jahr": number|null, "fundstelle": string (Seite/TOP/Abteilung)}] (z. B. Klasse F-H, Waermeerzeuger aelter als 30 Jahre - Austauschpflicht § 72 GEG, Ausweis abgelaufen)',
      '}'
    ],
    zahlen: { endenergie_kwh_m2a: [0, 1000], primaerenergie_kwh_m2a: [0, 1500], baujahr_gebaeude: [1500, 2100], baujahr_waermeerzeuger: [1900, 2100], anzahl_wohnungen: [1, 1000], gebaeudenutzflaeche_m2: [1, 1e6], grundstuecksflaeche_m2: [1, 1e7] }
  },

  teilungserklaerung: {
    einleitung: 'Aus der folgenden Teilungserklaerung (mit Gemeinschaftsordnung, Baubeschreibung, Aufteilungsplan oder Nachtraegen) extrahiere die Daten als JSON.',
    schema: [
      '{',
      '  "urkunde_datum": string DD.MM.JJJJ,',
      '  "dokumentteil": "Teilungserklaerung"|"Gemeinschaftsordnung"|"Baubeschreibung"|"Aufteilungsplan"|"Nachtrag",',
      '  "einheiten_anzahl": number,',
      '  "einheiten": [{"nr": string, "lage": string, "art": "Wohnung"|"Gewerbe"|"Garage"|"Stellplatz"|"Keller", "mea": string, "wfl_m2": number, "zimmer": number}],',
      '  "mea_nenner": number (z. B. 1000),',
      '  "sondernutzungsrechte": [string],',
      '  "kostenverteilung": string (Schluessel fuer Hausgeld und Instandhaltung),',
      '  "gebrauchsregeln": [string] (z. B. Vermietung, Gewerbe, Tierhaltung, kurzzeitige Vermietung),',
      '  "nachtraege": [string] (was ein Nachtrag aendert),',
      '  "baubeschreibung": [string] (Bauweise, Dach, Heizung, Fenster - je ein Satz),',
      '  "baujahr": number, "gemarkung": string, "flur": string, "flurstueck": string, "grundstuecksflaeche_m2": number,',
      '  "risiken": [{"titel": string (kurz), "beschreibung": string (1-2 Saetze: was steht da, was folgt daraus fuer einen Kaeufer/Investor), "schwere": "hoch"|"mittel"|"niedrig", "kosten_eur": number|null, "jahr": number|null, "fundstelle": string (Seite/TOP/Abteilung)}] (z. B. Vermietungsbeschraenkung, Kostenlast einzelner Eigentuemer, Sondernutzung Dritter, unklare Abgrenzung)',
      '}'
    ],
    zahlen: { einheiten_anzahl: [1, 10000], mea_nenner: [1, 1e7], baujahr: [1500, 2100], grundstuecksflaeche_m2: [1, 1e7] }
  },

  mietvertrag: {
    einleitung: 'Aus dem folgenden Mietvertrag extrahiere die Vertragsdaten als JSON. KEINE Namen, Anschriften oder Bankdaten der Mieter.',
    schema: [
      '{',
      '  "mietbeginn": string DD.MM.JJJJ,',
      '  "vertragsart": "unbefristet"|"staffel"|"index"|"zeitmiete"|"gewerbe"|"moebliert",',
      '  "befristet_bis": string DD.MM.JJJJ,',
      '  "kuendigungsverzicht_bis": string DD.MM.JJJJ,',
      '  "kaltmiete_eur": number (Nettokaltmiete je Monat),',
      '  "nebenkosten_vorauszahlung_eur": number,',
      '  "heizkosten_vorauszahlung_eur": number,',
      '  "kaution_eur": number,',
      '  "stellplatz_miete_eur": number,',
      '  "wohnflaeche_m2": number, "zimmer": number,',
      '  "lage_einheit": string (z. B. "EG links", "Whg. 3"),',
      '  "adresse": string (Anschrift des MIETOBJEKTS),',
      '  "staffeln": [{"ab": string DD.MM.JJJJ, "kaltmiete_eur": number}],',
      '  "letzte_erhoehung": string DD.MM.JJJJ,',
      '  "besonderheiten": [string] (Schoenheitsreparaturen, Kleinreparaturen, Moeblierung, Untervermietung),',
      '  "risiken": [{"titel": string (kurz), "beschreibung": string (1-2 Saetze: was steht da, was folgt daraus fuer einen Kaeufer/Investor), "schwere": "hoch"|"mittel"|"niedrig", "kosten_eur": number|null, "jahr": number|null, "fundstelle": string (Seite/TOP/Abteilung)}] (z. B. langer Kuendigungsverzicht, unwirksame Klauseln, Indexmiete, Befristung)',
      '}'
    ],
    zahlen: { kaltmiete_eur: [0, 1e6], nebenkosten_vorauszahlung_eur: [0, 1e5], heizkosten_vorauszahlung_eur: [0, 1e5], kaution_eur: [0, 1e6], stellplatz_miete_eur: [0, 1e4], wohnflaeche_m2: [1, 1e5], zimmer: [0, 100] }
  },

  mietaufstellung: {
    einleitung: 'Aus der folgenden Mieterliste / Mietaufstellung eines Mehrfamilienhauses extrahiere JEDE Einheit als JSON. KEINE Mieternamen.',
    schema: [
      '{',
      '  "stichtag": string DD.MM.JJJJ,',
      '  "adresse": string,',
      '  "einheiten": [{"nr": string, "lage": string, "nutzung": "wohnen"|"gewerbe"|"stellplatz", "wfl_m2": number, "zimmer": number, "kaltmiete_eur": number (je Monat), "nk_vorauszahlung_eur": number, "status": "vermietet"|"leer", "mietbeginn": string DD.MM.JJJJ, "vertragsart": "unbefristet"|"staffel"|"index"|"zeitmiete"|"gewerbe", "letzte_erhoehung": string DD.MM.JJJJ, "kaution_eur": number}],',
      '  "summe_kaltmiete_monat_eur": number,',
      '  "summe_wfl_m2": number,',
      '  "risiken": [{"titel": string (kurz), "beschreibung": string (1-2 Saetze: was steht da, was folgt daraus fuer einen Kaeufer/Investor), "schwere": "hoch"|"mittel"|"niedrig", "kosten_eur": number|null, "jahr": number|null, "fundstelle": string (Seite/TOP/Abteilung)}] (z. B. Leerstand, Gewerbeanteil, viele Altvertraege ohne Erhoehung)',
      '}'
    ],
    zahlen: { summe_kaltmiete_monat_eur: [0, 1e7], summe_wfl_m2: [1, 1e6] }
  },

  marktbericht: {
    einleitung: 'Aus dem folgenden Grundstuecksmarktbericht extrahiere die fuer eine Immobilienbewertung relevanten Daten als JSON.',
    schema: [
      '{',
      '  "gutachterausschuss": string,',
      '  "berichtsjahr": number,',
      '  "liegenschaftszinssatz_pct": number,',
      '  "sachwertfaktor": number,',
      '  "bodenrichtwert_eur_m2": number,',
      '  "durchschnittsmiete_eur_m2": number,',
      '  "quellenvermerk": string (Lizenz-/Namensnennungshinweis, falls abgedruckt)',
      '}'
    ],
    zahlen: {
      berichtsjahr: [1990, 2100],
      liegenschaftszinssatz_pct: [0, 15],
      sachwertfaktor: [0.1, 5],
      bodenrichtwert_eur_m2: [0, 100000],
      durchschnittsmiete_eur_m2: [0, 1000]
    }
  }
};

/* v3016 · Ein PDF kann mehrere Dokumente tragen (gemessen: „Flur u Energie.pdf" =
   Flurkarte + Energieausweis). Weitere Arten nur mit ZWEI Leitbegriffen im ganzen
   Text, nie die gesperrte Art und nie der Marktbericht (der zitiert alles). */
const WEITERE_ERLAUBT = { energieausweis: 1, kataster: 1, grundbuch: 1, boris: 1, mietaufstellung: 1 };
function weitereTypen(text, dateiname, haupt) {
  const t = String(text || '').toLowerCase().slice(0, 60000);
  const aus = [];
  Object.keys(DOKUMENT_TYPEN).forEach(function (id) {
    /* v3016c · nur eigenstaendige Blaetter. Protokolle, Teilungserklaerungen und Kaufvertraege
       zitieren einander (gemessen: Protokoll 2025 → „Teilungserklaerung", Grundbuch → „Auflassung") */
    if (id === haupt || !WEITERE_ERLAUBT[id] || !SCHEMATA[id]) return;
    const n = (DOKUMENT_TYPEN[id].leit || []).filter(function (kw) { return t.indexOf(kw.toLowerCase()) !== -1; }).length;
    if (n >= 2) aus.push({ typ: id, leit: n });
  });
  return aus.sort(function (a, b) { return b.leit - a.leit; }).slice(0, 2).map(function (x) { return x.typ; });
}

/** Baut den vollständigen Prompt für eine Dokumentart. */
function baueprompt(typ, text) {
  const s = SCHEMATA[typ];
  if (!s) return null;
  return []
    .concat(s.einleitung)
    .concat(['Wenn ein Feld nicht auffindbar ist: null. Rate nichts.',
             'Gib keine Namen, Geburtsdaten oder Anschriften von Personen aus (v2210).', '', 'Schema:'])
    .concat(s.schema)
    .concat(['', 'Antworte NUR mit JSON.', '', 'Dokument:', text])
    .join('\n');
}

module.exports = {
  DOKUMENT_TYPEN,
  SCHEMATA,
  klassifiziere,
  weitereTypen,   /* v3016 */
  baueprompt,
  typenListe: function () {
    return Object.keys(DOKUMENT_TYPEN).map(function (id) {
      return { id: id, label: DOKUMENT_TYPEN[id].label, extrahierbar: !!SCHEMATA[id] };
    });
  }
};
