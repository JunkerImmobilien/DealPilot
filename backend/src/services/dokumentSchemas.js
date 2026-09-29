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

/* ── Klassifikation ───────────────────────────────────────────────────── */
const DOKUMENT_TYPEN = {
  grundbuch: {
    label: 'Grundbuchauszug',
    keywords: ['Grundbuch', 'Abteilung I', 'Abteilung II', 'Abteilung III',
               'Bestandsverzeichnis', 'Blatt', 'Amtsgericht']
  },
  kataster: {
    label: 'Katasterauszug',
    keywords: ['Liegenschaftskataster', 'ALKIS', 'Flurstück', 'Gemarkung',
               'Katasteramt', 'Flur']
  },
  kaufvertrag: {
    label: 'Kaufvertrag',
    keywords: ['Kaufvertrag', 'Notar', 'UR-Nr', 'Kaufpreis', 'Auflassung',
               'Verkäufer', 'Käufer', 'Miteigentumsanteil']
  },
  weg_protokoll: {
    label: 'WEG-Protokoll',
    keywords: ['Eigentümerversammlung', 'WEG', 'Beschluss', 'Verwalter',
               'Instandhaltungsrücklage', 'Hausgeld', 'Protokoll']
  },
  boris: {
    label: 'Bodenrichtwert-Auszug',
    keywords: ['Bodenrichtwert', 'BORIS', 'BRW', 'Bodenrichtwertzone',
               'Gutachterausschuss', 'Bauland']
  },
  vwg_vorgutachten: {
    label: 'Verkehrswertgutachten',
    keywords: ['Verkehrswertgutachten', 'Sachwertverfahren', 'NHK 2010',
               '§ 194 BauGB', 'Verkehrswert']
  },
  rndg: {
    label: 'Restnutzungsdauergutachten',
    keywords: ['Restnutzungsdauer', 'RNDG', '§ 7 Abs. 4', 'Punktrastermethode',
               'Modernisierungspunkte']
  },
  kpt: {
    label: 'Kaufpreisaufteilung',
    keywords: ['Kaufpreisaufteilung', 'Jacoby', 'Aufteilung Gebäude und Boden',
               'BFH IX R 12/21', 'umgekehrten Ertragswertmethode',
               'Kapitalisierungsfaktor', 'Bodenwertverzinsung',
               'steuerlich absetzbarer Gebäudeanteil']
  },
  marktbericht: {
    label: 'Marktbericht',
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
  let bester = null, besterWert = 0;

  Object.keys(DOKUMENT_TYPEN).forEach(function (id) {
    const kws = DOKUMENT_TYPEN[id].keywords;
    if (!kws.length) return;
    let score = 0;
    kws.forEach(function (kw) {
      const k = kw.toLowerCase();
      if (t.indexOf(k) !== -1) score += 1;
      if (d.indexOf(k) !== -1) score += 2;
    });
    const wert = score / (kws.length * 3);
    alle[id] = Math.round(wert * 100) / 100;
    if (wert > besterWert) { besterWert = wert; bester = id; }
  });

  /* Unter 10 % ist es Rauschen. Lieber „unbekannt" als eine Art, die
     der Nutzer dann stillschweigend übernimmt — eine falsche
     Dokumentart zieht ein falsches Schema nach sich.                 */
  if (!bester || besterWert <= 0.1) {
    return { typ: null, label: null, sicherheit: Math.round(besterWert * 100) / 100, alle: alle };
  }
  return {
    typ: bester,
    label: DOKUMENT_TYPEN[bester].label,
    sicherheit: Math.round(besterWert * 100) / 100,
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
      '  "eigentuemer": [{"name": string, "geburtsdatum": string DD.MM.JJJJ}],',
      '  "flurstuecke": [{"gemarkung": string, "flur": string, "flurstueck": string, "flaeche_m2": number, "nutzung": string}],',
      '  "abt_ii": [{"lfd_nr": string, "art": string, "berechtigter": string, "eingetragen_am": string}],',
      '  "abt_iii": [{"lfd_nr": string, "betrag_eur": number, "glaubiger": string, "eingetragen_am": string}],',
      '  "grundschulden_gesamt_eur": number',
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
      '  "verkaeufer": [{"name": string, "adresse": string}],',
      '  "kaeufer": [{"name": string, "adresse": string}],',
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
      '  "risiken": [string]',
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
    einleitung: [
      'Aus der folgenden Kaufpreisaufteilung (Gutachten zur Aufteilung des',
      'Kaufpreises auf Grund und Boden und Gebaeude) extrahiere die',
      'EINGANGSDATEN als JSON — nicht die Ergebnisse des Gutachtens,',
      'sondern die Angaben, mit denen es gerechnet hat.'
    ].join(' '),
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

/** Baut den vollständigen Prompt für eine Dokumentart. */
function baueprompt(typ, text) {
  const s = SCHEMATA[typ];
  if (!s) return null;
  return []
    .concat(s.einleitung)
    .concat(['Wenn ein Feld nicht auffindbar ist: null. Rate nichts.', '', 'Schema:'])
    .concat(s.schema)
    .concat(['', 'Antworte NUR mit JSON.', '', 'Dokument:', text])
    .join('\n');
}

module.exports = {
  DOKUMENT_TYPEN,
  SCHEMATA,
  klassifiziere,
  baueprompt,
  typenListe: function () {
    return Object.keys(DOKUMENT_TYPEN).map(function (id) {
      return { id: id, label: DOKUMENT_TYPEN[id].label, extrahierbar: !!SCHEMATA[id] };
    });
  }
};
