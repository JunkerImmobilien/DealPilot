// verfahrenswahl.js — Welches Verfahren führt, und wie der Zinssatz angepasst wird.
// ────────────────────────────────────────────────────────────────────────────
// Quellen, beide woertlich aus dem Grundstuecksmarktbericht 2025 des Kreises
// Minden-Luebbecke:
//
//   Abschnitt 5.1.4: "Ein- und Zweifamilienhaeuser werden normalerweise nicht
//   unter Renditegesichtspunkten gehandelt, der Erwerb dient in der Regel der
//   Eigennutzung. Folglich wird auch der Verkehrswert fuer derartige Objekte
//   im Allgemeinen auf der Grundlage des Sachwertverfahrens ermittelt."
//
//   Abschnitt 6.1: "Eigentumswohnungen lassen sich ueber den Kaufpreis pro m2
//   Wohnflaeche unter Beachtung von Wohnungsgroesse, -alter und -ausstattung
//   relativ gut miteinander vergleichen."
//
//   Abschnitt 8: Katalog der Zu- und Abschlaege beim Liegenschaftszinssatz.
//
// WARUM ES DIESES MODUL BRAUCHT
//
// Gemessen am Testobjekt — 165 m2 Wohnung in einem Zweifamilienhaus:
//   Sachwert DealPilot        348.687 EUR
//   Gutachten (Sachwert)      346.570 EUR
//   Vergleichswert            326.000 EUR
//   zweites Gutachten         298.000 EUR
//   Ertragswert               444.006 EUR   <- schert aus
//
// Der Ertragswert ist nicht falsch gerechnet. Er beantwortet eine Frage, die
// bei diesem Objekt niemand stellt: was wirft es als Kapitalanlage ab? Bei
// einer Wohnung, die faktisch ein halbes Haus ist, kauft kein Kapitalanleger.
//
// Paragraf 6 Absatz 1 ImmoWertV: die Verfahren sind "nach der Art des
// Wertermittlungsobjekts unter Beruecksichtigung der im gewoehnlichen
// Geschaeftsverkehr bestehenden Gepflogenheiten" zu waehlen. Genau das tut
// dieses Modul — nach einer festen Regel, nicht nach Gefuehl.

/* ════════════════════════════════════════════════════════════════════════
 * 1 · WELCHES VERFAHREN FUEHRT
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * Führendes Verfahren nach Objektart und Nutzungscharakter.
 *
 * Die Regel ist bewusst grob und immer gleich. Sie ersetzt keine
 * sachverständige Verfahrenswahl — sie sorgt dafür, dass derselbe Objekttyp
 * immer dieselbe Behandlung bekommt.
 */
/* ══ v1971 · OHNE KAUFPREISE KEIN VERGLEICHSWERTVERFAHREN ══════════════

   Marcels Frage vom 08.10.2026: „Eigentumswohnungen werden ja
   üblicherweise nach dem Vergleichswert bewertet. Und haben wir da
   überhaupt Vergleichswerte und sind das dann auch die Verkaufspreise?
   Weil dann wäre es ja im Bericht nicht richtig."

   GEMESSEN: der Wert, den der Bericht „Vergleichswert" nannte, stammt zu
   100 Prozent aus PORTALINSERATEN (Median Euro/m2 aus Angeboten). Die
   Kette: MarketAnalysisService -> ValuationService.market_value.estimated
   -> CrossCheckService. Der Code sagt es an drei Stellen selbst, u. a.
   connectors/IrwConnector.js: „Unser bisheriger Vergleichswert stammt aus
   Portalinseraten, das sind Angebotspreise. Paragraf 25 ImmoWertV
   verlangt Kaufpreise."

   Diese Funktion gab fuer Wohnungseigentum trotzdem
   `verfahren: vergleichswert` zurueck, mit der Begruendung „ueber den
   KAUFPREIS je m2 Wohnflaeche" — und der Bericht schrieb daraus
   „Fuehrendes Verfahren: Vergleichswertverfahren". Das ist kein
   Rechenfehler, sondern eine falsche HERKUNFTSANGABE, und damit das
   Gegenteil der eigenen Doktrin „jede Zahl traegt Herkunft".

   Paragraf 24 ImmoWertV verlangt fuer das Vergleichswertverfahren
   Vergleichspreise, Paragraf 25 Abs. 1 definiert sie als Kaufpreise
   geeigneter Vergleichsgrundstuecke. Angebotspreise sind keine.

   DESHALB BRAUCHT DIE FUNKTION JETZT `vergleichsbasis`:

     'kaufpreise'  ein amtlicher Vergleichsfaktor (Paragraf 20, aus der
                   Kaufpreissammlung) oder ein Immobilienrichtwert liegt
                   vor -> das Vergleichswertverfahren fuehrt
     sonst         es gibt KEIN fuehrendes Verfahren. Der Bericht sagt,
                   was fehlt und wo es steht.

   > Warum kein Ersatz-Verfahren gewaehlt wird: Paragraf 6 Abs. 1 richtet
   > die Verfahrenswahl nach der ART DES OBJEKTS, nicht nach der
   > Datenlage. Bei typischem Wohnungseigentum IST der Vergleichswert das
   > richtige Verfahren. Statt es durch Sachwert zu ersetzen — was fuer
   > eine Wohnung modellfremd ist, der Ausschuss leitet dafuer meist gar
   > keinen Sachwertfaktor ab — sagt der Bericht, dass das fuehrende
   > Verfahren nicht belegbar ist, und zeigt Ertrags- und Sachwert als
   > das, was sie dann sind: Plausibilitaet.

   > Marcel dazu: „Ansonsten sollten wir den Vergleichswert einfach
   > rausnehmen. Dann geben wir den Ertragswert an oder den Sachwert oder
   > beides ... Was wir nicht haben, können wir ja nicht angeben."

   DER WEG STEHT IM REGISTER. Gemessen am 08.10.2026: 0 Saetze mit der
   Kennzahl `vergleichsfaktor`, aber die Sperren nennen die Quellen —
   fuer BERLIN ist der amtliche Vergleichsfaktor sogar der EINZIGE Weg
   (dort gibt es fuer Eigentumswohnungen weder Liegenschaftszinssatz noch
   Sachwertfaktor). Weitere: Brandenburg (Kap. 8.2.3, „hier noch nicht
   erfasst"), Saarpfalz-Kreis, Augsburg. Die Ernte holt sie nach
   (Backlog N50). */
export function fuehrendesVerfahren({ objektart, wohneinheiten = null, nutzung = null,
                                      vergleichsbasis = null }) {
  const s = String(objektart || '').toLowerCase();
  const we = Number(wohneinheiten);
  const eigen = /eigen|selbst/i.test(String(nutzung || ''));

  const istWohnung = /etw|eigentumswohnung|wohnung|whg/.test(s);
  const istHaus = /efh|zfh|einfamilien|zweifamilien|doppel|reihe|haus/.test(s) && !istWohnung;
  const istMfh = /mfh|mehrfamilien/.test(s);
  const istGewerbe = /gewerbe|buero|büro|handel|industrie|halle/.test(s);

  if (istGewerbe || istMfh || (we > 2 && !istWohnung)) {
    return {
      verfahren: 'ertragswert',
      grund: 'Renditeobjekt — der Erwerb erfolgt unter Renditegesichtspunkten.',
      quelle: '§ 6 Abs. 1 ImmoWertV',
    };
  }

  if (istHaus || (istWohnung && we > 0 && we <= 2)) {
    return {
      verfahren: 'sachwert',
      grund: istWohnung
        ? 'Wohnungseigentum in einem Objekt mit höchstens zwei Wohneinheiten. Der '
          + 'Gutachterausschuss nimmt solche Wohnungen aus seiner Eigentumswohnungs-Auswertung '
          + 'heraus; sie werden nicht unter Renditegesichtspunkten gehandelt.'
        : 'Ein- und Zweifamilienhäuser werden normalerweise nicht unter '
          + 'Renditegesichtspunkten gehandelt; der Erwerb dient in der Regel der Eigennutzung. '
          + 'Folglich wird der Verkehrswert im Allgemeinen auf Grundlage des '
          + 'Sachwertverfahrens ermittelt.',
      quelle: 'Grundstücksmarktbericht 2025, Abschnitt 5.1.4 · § 6 Abs. 1 ImmoWertV',
      ertragswert_nachrangig: true,
    };
  }

  if (istWohnung) {
    /* v1971: Das Vergleichswertverfahren fuehrt nur mit KAUFPREISEN. */
    if (vergleichsbasis !== 'kaufpreise') {
      return {
        verfahren: null,
        fehlt: 'vergleichspreise',
        grund: 'Für typisches Wohnungseigentum ist das Vergleichswertverfahren das richtige Verfahren (§ 6 Abs. 1 ImmoWertV). Es verlangt Vergleichspreise, und das sind nach § 25 Abs. 1 ImmoWertV KAUFPREISE geeigneter Vergleichsgrundstücke. Für dieses Objekt liegt kein amtlicher Vergleichsfaktor und kein Immobilienrichtwert vor; die vorliegenden Marktdaten sind Angebotspreise aus Immobilienportalen und ersetzen sie nicht. Ein führendes Verfahren wird daher nicht ausgewiesen — Ertrags- und Sachwert stehen als Plausibilitätsrechnung daneben.',
        quelle: '§ 24, § 25 Abs. 1 ImmoWertV',
        weg: 'Amtliche Vergleichsfaktoren führt der zuständige Gutachterausschuss (§ 20 ImmoWertV, abgeleitet aus der Kaufpreissammlung). Eine Auskunft aus der Kaufpreissammlung nach § 195 BauGB ist bei der Geschäftsstelle möglich.',
      };
    }
    return {
      verfahren: 'vergleichswert',
      grund: eigen
        ? 'Wohnungseigentum zur Eigennutzung — Vergleichspreise sind hier am aussagekräftigsten.'
        : 'Eigentumswohnungen lassen sich über den Kaufpreis je m² Wohnfläche unter Beachtung '
          + 'von Größe, Alter und Ausstattung gut miteinander vergleichen.',
      quelle: 'Grundstücksmarktbericht 2025, Abschnitt 6.1 · § 6 Abs. 1 ImmoWertV',
      basis: 'kaufpreise',
    };
  }

  return { verfahren: null, grund: 'Objektart ohne feste Verfahrensregel.' };
}

/* ════════════════════════════════════════════════════════════════════════
 * 2 · DIE OBJEKTSPEZIFISCHE ZINSANPASSUNG
 *
 * Paragraf 33 ImmoWertV kennt den "objektspezifisch angepassten
 * Liegenschaftszinssatz" — nicht den Tabellenwert roh. Der Marktbericht gibt
 * in Abschnitt 8 den Katalog vor, in welche Richtung welches Merkmal wirkt.
 *
 * DIE GEWICHTE SIND GESETZT, NICHT ABGELEITET. Der Ausschuss nennt die
 * Richtungen, nicht ihre Staerke. Deshalb:
 *   - die Summe wird auf EINE Standardabweichung gedeckelt, also auf den
 *     Spielraum, den der Ausschuss selbst veroeffentlicht
 *   - das Ergebnis ist Stufe C (marktabgeleitet), NIE Stufe A
 *   - jedes Merkmal wird einzeln ausgewiesen, damit ein Sachverstaendiger
 *     widersprechen kann
 *
 * Wer andere Gewichte fuer richtig haelt, sieht sie und kann sie ersetzen.
 * ════════════════════════════════════════════════════════════════════════ */

export const MERKMALE = [
  {
    id: 'alter', gewicht: 0.30,
    hoch: 'das Gebäude ist alt oder sehr alt',
    runter: 'das Gebäude ist neu',
  },
  {
    id: 'wohnlage', gewicht: 0.25,
    hoch: 'die Wohnlage ist eher mäßig',
    runter: 'die Wohnlage ist überdurchschnittlich',
  },
  {
    id: 'nutzung', gewicht: 0.20,
    hoch: 'die Kapitalanlage steht im Vordergrund',
    runter: 'die Eigennutzung steht im Vordergrund',
  },
  {
    id: 'wohneinheiten', gewicht: 0.15,
    hoch: 'viele Wohneinheiten im Objekt',
    runter: 'wenige Wohneinheiten im Objekt',
  },
  {
    id: 'groesse', gewicht: 0.10,
    hoch: 'das Objekt ist klein',
    runter: 'das Objekt ist sehr groß',
  },
];

const spanne = (x, stufen) => {
  for (const [grenze, wert] of stufen) {
    if (x <= grenze) return wert;
  }
  return stufen[stufen.length - 1][1];
};

/**
 * Objektspezifisch angepasster Liegenschaftszinssatz nach § 33 ImmoWertV.
 *
 * @param {object} o
 * @param {number} o.basis_pct        amtlicher Ausgangswert
 * @param {number} [o.stabw_pct]      veröffentlichte Standardabweichung
 * @param {number} [o.gebaeudealter]
 * @param {number} [o.mikrolage_score] 0 bis 100
 * @param {string} [o.nutzung]
 * @param {number} [o.wohneinheiten]
 * @param {number} [o.wohnflaeche_qm]
 * @param {number} [o.normobjekt_qm]   Wohnfläche der Ausschuss-Stichprobe
 */
export function angepassterZins({
  basis_pct, stabw_pct = null, gebaeudealter = null, mikrolage_score = null,
  nutzung = null, wohneinheiten = null, wohnflaeche_qm = null, normobjekt_qm = null,
}) {
  const basis = Number(basis_pct);
  if (!(basis > 0)) return null;

  const stabw = Number(stabw_pct);
  if (!(stabw > 0)) {
    return { verfuegbar: false, grund: 'keine_streuung',
      hinweis: 'Ohne veröffentlichte Standardabweichung fehlt der Rahmen, innerhalb dessen '
        + 'angepasst werden darf. Es bleibt beim amtlichen Ausgangswert.' };
  }

  const teile = [];
  const bewerte = (id, richtung, text) => {
    if (richtung === null) return;
    const m = MERKMALE.find((x) => x.id === id);
    teile.push({ id, gewicht: m.gewicht, richtung,
      beitrag_pct: Math.round(m.gewicht * richtung * stabw * 1000) / 1000,
      text: richtung > 0 ? m.hoch : m.runter });
  };

  /* Alter: der Bericht nennt "alt / sehr alt" und "sehr neu". */
  /* v1062-WZIN-1 · Number(null) ist 0 und besteht Number.isFinite. Ohne
   * Baujahr wurde das Gebaeude damit als "sehr neu" eingestuft und der
   * Zinssatz um 0,33 Punkte gesenkt — eine Aussage ueber ein Merkmal, das
   * niemand erhoben hat. Fehlt die Angabe, faellt das Merkmal aus. */
  const alt = (gebaeudealter === null || gebaeudealter === undefined
    || gebaeudealter === '') ? NaN : Number(gebaeudealter);
  bewerte('alter', (Number.isFinite(alt) && alt >= 0)
    ? spanne(alt, [[10, -1], [25, -0.5], [45, 0], [65, 0.5], [Infinity, 1]]) : null);

  /* Wohnlage: unser Mikrolage-Score als Naeherung. */
  /* v1062-WZIN-2 · Dieselbe Falle, teurer: ein fehlender Mikrolage-Score
   * wurde als 0 gelesen und damit als schlechteste denkbare Wohnlage —
   * der staerkste Einzelbeitrag des ganzen Katalogs (+0,275), begruendet
   * im Klartext mit "die Wohnlage ist eher maessig". */
  const lage = (mikrolage_score === null || mikrolage_score === undefined
    || mikrolage_score === '') ? NaN : Number(mikrolage_score);
  bewerte('wohnlage', (Number.isFinite(lage) && lage > 0)
    ? spanne(lage, [[35, 1], [50, 0.5], [70, 0], [85, -0.5], [Infinity, -1]]) : null);

  /* Nutzung. */
  const nz = String(nutzung || '').toLowerCase();
  bewerte('nutzung', /kapital|rendite|vermiet/.test(nz) ? 1
    : /eigen|selbst/.test(nz) ? -1 : null);

  /* Wohneinheiten: "je weniger" runter, "je mehr" rauf. */
  const we = Number(wohneinheiten);
  bewerte('wohneinheiten', Number.isFinite(we) && we > 0
    ? spanne(we, [[2, -1], [6, -0.25], [20, 0.5], [Infinity, 1]]) : null);

  /* Groesse gegen das Normobjekt der Ausschuss-Stichprobe. */
  const wfl = Number(wohnflaeche_qm), norm = Number(normobjekt_qm);
  bewerte('groesse', (wfl > 0 && norm > 0)
    ? spanne(wfl / norm, [[0.7, 1], [0.9, 0.5], [1.3, 0], [1.8, -0.5], [Infinity, -1]]) : null);

  const roh = teile.reduce((a, t) => a + t.beitrag_pct, 0);
  /* Gedeckelt auf eine Standardabweichung — den Spielraum, den der Ausschuss
   * selbst veroeffentlicht. Darueber hinaus waere es keine Anpassung mehr,
   * sondern ein anderer Wert. */
  const gedeckelt = Math.max(-stabw, Math.min(stabw, roh));
  const zins = Math.round((basis + gedeckelt) * 100) / 100;

  return {
    verfuegbar: true,
    basis_pct: basis,
    anpassung_pct: Math.round(gedeckelt * 100) / 100,
    zins_pct: zins,
    gedeckelt: Math.abs(roh - gedeckelt) > 0.001,
    spanne_von: Math.round((basis - stabw) * 100) / 100,
    spanne_bis: Math.round((basis + stabw) * 100) / 100,
    merkmale: teile,
    stufe: 'C',
    hinweis: 'Objektspezifisch angepasster Liegenschaftszinssatz nach § 33 ImmoWertV. '
      + 'Ausgangswert ist der amtliche Zinssatz; die Anpassung folgt dem Katalog der Zu- und '
      + 'Abschläge des Gutachterausschusses und bleibt innerhalb der von ihm veröffentlichten '
      + 'Streuung. Die Gewichtung der Merkmale ist eine Festlegung von DealPilot, nicht des '
      + 'Ausschusses — sie macht das Ergebnis nachvollziehbar und für jedes Objekt gleich, '
      + 'ersetzt aber keine sachverständige Würdigung des Einzelfalls.',
  };
}
