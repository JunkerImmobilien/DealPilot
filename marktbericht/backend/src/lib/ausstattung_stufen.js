// ausstattung_stufen.js — v1345
// ────────────────────────────────────────────────────────────────────────────
// AUS DEN AUSSTATTUNGSANGABEN EINEN STANDARDSTUFEN-VORSCHLAG.
//
// Marcels Befund vom 13.09.2026: „da gebe ich vlt werte an die ich nicht
// bräuchte und garnicht mit einfließen."
//
// GEMESSEN, und er hatte recht: zehn Felder des Formulars — Energieträger,
// Heizung, Verglasung, Bodenbelag, Bad, Gäste-WC, Keller, Außenwände,
// Dachform, Dacheindeckung — kamen im Backend nicht einmal an. Der
// Orchestrator nahm sie nicht in seine Datenliste auf. Sie stammen aus der
// Zeit, als ein externer Bewertungsdienst sie bekam; seit wir selbst
// rechnen, liefen sie ins Leere.
//
// ── WAS DIESE DATEI TUT, UND WAS NICHT ─────────────────────────────────────
// Sie schlägt aus den Auswahlwerten eine Standardstufe je Gewerk vor
// (Anlage 4 ImmoWertV / NHK 2010, neun Gewerke mit Wägungsanteilen).
//
// SIE ZITIERT DIE VERORDNUNG NICHT. Die Zuordnung „Dreifachverglasung ->
// Stufe 4" ist eine sachverständige Einordnung, kein Abdruck aus Anlage 4.
// Deshalb trägt jeder Vorschlag Stufe D (abgeleitet) und ist überschreibbar.
// Wer die Gewerke selbst einschätzt, dessen Angabe gilt — immer.
//
// ── DIE ABDECKUNG IST UNVOLLSTÄNDIG, UND DAS STEHT AUCH SO DA ──────────────
// Die Felder decken sechs der neun Gewerke ab:
//
//   aussenwaende 23 · dach 15 · fenster_tueren 11 · sanitaer 9 ·
//   heizung 9 · fussboeden 5          = 72 von 100 Wägungsanteilen
//
// Es fehlen innenwaende (11), decken_treppen (11) und sonstige_technik (6).
// `standardstufeAusGewerken()` verlangt volle 100 — ein Vorschlag allein
// ergibt also KEINE Standardstufe, er nimmt dem Nutzer nur zwei Drittel der
// Arbeit ab. Das ist der ehrliche Stand; eine Einstufung aus 72 Anteilen
// hochzurechnen wäre eine Behauptung.

/* Welche Auswahl steht für welche Standardstufe. Die Werte links sind die
   Optionswerte des Formulars (index.html), unverändert. */
export const EQ_ZU_STUFE = {
  /* Außenwände — Wägungsanteil 23, der größte Posten überhaupt. */
  eq_walls: {
    feld: 'aussenwaende',
    werte: {
      AUSSENWAENDE_NICHT_GEDAEMMT: 2,
      AUSSENWAENDE_GEDAEMMT: 3,
    },
    hinweis: 'Gedämmte Außenwände entsprechen dem Standard ab Mitte der '
      + '1990er Jahre. Eine höhere Stufe setzt Verblendmauerwerk oder eine '
      + 'aufwendig gestaltete Fassade voraus — das sagt dieses Feld nicht.',
  },

  /* Dach — Wägungsanteil 15. Die Eindeckung allein trägt die Einstufung
     nicht; sie ist der einzige Anhaltspunkt, den das Formular liefert. */
  eq_roof: {
    feld: 'dach',
    werte: {
      DACHPAPPE: 1,
      METALL: 3,
      DACHPFANNEN: 3,
      SCHIEFER: 4,
      SONSTIGE: null,
    },
    hinweis: 'Nur die Eindeckung. Ob das Dach gedämmt und das Dachgeschoss '
      + 'ausgebaut ist, wiegt in Anlage 4 schwerer — das steht in den '
      + 'Feldern Dachausbildung und Wärmedämmung.',
  },

  /* Fenster und Außentüren — Wägungsanteil 11. Hier ist die Auswahl am
     aussagekräftigsten: die Verglasung IST das Merkmal der Stufe. */
  eq_windows: {
    feld: 'fenster_tueren',
    werte: {
      EINFACH: 1,
      KASTENFENSTER: 1,
      ZWEIFACHVERGLASUNG: 2,
      ISOLIERVERGLASUNG: 3,
      DREIFACHVERGLASUNG: 4,
      SPEZIALVERGLASUNG: 4,
      RAUMHOHE_VERGLASUNG: 5,
      SONSTIGE: null,
    },
  },

  /* Sanitär — Wägungsanteil 9. Zwei Felder zusammen: die Zahl der Bäder und
     ob ein Gäste-WC da ist. Die Auswertung steht unten in `ableiten`. */
  eq_bath: {
    feld: 'sanitaer',
    werte: {
      EIN_BAD: 2,
      INNENLIEGEND: 2,
      MIT_FENSTER: 3,
      MEHR_ALS_EIN_BAD: 4,
    },
  },

  /* Heizung — Wägungsanteil 9. */
  eq_heating: {
    feld: 'heizung',
    werte: {
      EINZELOEFEN: 1,
      ZENTRALHEIZUNG: 3,
      FUSSBODENHEIZUNG: 4,
      SONSTIGE: null,
    },
    hinweis: 'Das Verteilsystem. Der Energieträger (Wärmepumpe, Fernwärme) '
      + 'wird getrennt erfasst und hebt die Stufe zusätzlich.',
  },

  /* Fußböden — Wägungsanteil 5, der kleinste der sechs. */
  eq_floor: {
    feld: 'fussboeden',
    werte: {
      KUNSTSTOFF_PVC: 1,
      TEPPICH_LAMINAT: 2,
      FLIESEN: 3,
      PARKETT_NATURSTEIN: 4,
      SONSTIGE: null,
    },
  },
};

/* Der Energieträger hebt die Heizungsstufe — eine Wärmepumpe ist kein
   Verteilsystem, sondern der Erzeuger, und in Anlage 4 rangiert sie oben. */
const ENERGIETRAEGER_HEBT = {
  WAERMEPUMPE: 5,
  FERNWAERME: 4,
  PELLETS: 4,
  GAS: null,
  OEL: null,
  STROM: 2,
  SONSTIGE: null,
};

/* Die Wägungsanteile, die die sechs Felder abdecken. Aus anlage2.js, damit
   es nur EINE Tabelle gibt — hier steht bewusst keine Kopie der Zahlen. */
export const ABGEDECKTE_GEWERKE = ['aussenwaende', 'dach', 'fenster_tueren',
  'sanitaer', 'heizung', 'fussboeden'];

/**
 * Schlägt Standardstufen je Gewerk vor.
 *
 * @param {object} eq  Die Formularwerte: { eq_walls, eq_roof, eq_windows,
 *                     eq_bath, eq_heating, eq_floor, eq_energie, eq_guest_wc }
 * @returns {{gewerke:object, herkunft:object, hinweise:string[], anzahl:number}}
 */
export function ableiten(eq = {}) {
  const gewerke = {};
  const herkunft = {};
  const hinweise = [];

  for (const [feldId, def] of Object.entries(EQ_ZU_STUFE)) {
    const wert = eq[feldId];
    if (!wert) continue;
    const stufe = def.werte[String(wert).toUpperCase()];
    if (!(stufe >= 1 && stufe <= 5)) continue;
    gewerke[def.feld] = stufe;
    herkunft[def.feld] = { aus: feldId, wert: String(wert), stufe, stufe_herkunft: 'D' };
    if (def.hinweis && hinweise.indexOf(def.hinweis) < 0) hinweise.push(def.hinweis);
  }

  /* Sanitär: ein Gäste-WC hebt um eine Stufe — Anlage 4 nennt es ab
     Stufe 3 ausdrücklich. Gedeckelt bei 5. */
  if (gewerke.sanitaer && String(eq.eq_guest_wc || '').toUpperCase() === 'GAESTE_WC') {
    const vor = gewerke.sanitaer;
    gewerke.sanitaer = Math.min(5, vor + 1);
    herkunft.sanitaer.gehoben_durch = 'Gäste-WC';
    herkunft.sanitaer.stufe = gewerke.sanitaer;
    if (vor !== gewerke.sanitaer) {
      hinweise.push('Das Gäste-WC hebt die Sanitärstufe von ' + vor + ' auf '
        + gewerke.sanitaer + '.');
    }
  }

  /* Heizung: der Energieträger kann die Stufe heben, nie senken. */
  const et = String(eq.eq_energie || '').toUpperCase();
  if (ENERGIETRAEGER_HEBT[et] != null) {
    const ziel = ENERGIETRAEGER_HEBT[et];
    const vor = gewerke.heizung;
    if (vor == null || ziel > vor) {
      gewerke.heizung = ziel;
      herkunft.heizung = herkunft.heizung || { aus: 'eq_energie', stufe_herkunft: 'D' };
      herkunft.heizung.gehoben_durch = 'Energieträger ' + et;
      herkunft.heizung.stufe = ziel;
      if (vor != null) {
        hinweise.push('Der Energieträger hebt die Heizungsstufe von ' + vor
          + ' auf ' + ziel + '.');
      }
    }
  }

  const anzahl = Object.keys(gewerke).length;
  return { gewerke, herkunft, hinweise, anzahl };
}

/**
 * Führt Vorschlag und eigene Angabe zusammen. DIE EIGENE ANGABE GEWINNT —
 * immer, auch wenn sie niedriger ist. Ein Vorschlag, der eine Eingabe
 * überschreibt, ist kein Vorschlag.
 */
export function zusammenfuehren(eigene, vorschlag) {
  const out = {};
  const woher = {};
  for (const g of Object.keys(vorschlag || {})) {
    out[g] = vorschlag[g];
    woher[g] = 'abgeleitet';
  }
  for (const g of Object.keys(eigene || {})) {
    const s = Number(eigene[g]);
    if (s >= 1 && s <= 5) { out[g] = s; woher[g] = 'eigene_angabe'; }
  }
  return { gewerke: out, woher };
}
