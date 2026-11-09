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
/* ══ v3242 · ETW OHNE AMTLICHE GRUNDLAGE: DER VERGLEICHSWERT AUS ANGEBOTSPREISEN FUEHRT ════════
   Entscheidung Marcel 09.11.2026 (DESAG-Sachverstaendiger): „Bei Eigentumswohnungen fuehrt das
   Vergleichswertverfahren." Liegt keine kaufpreisbasierte amtliche Grundlage vor (Immobilienricht-
   wert, amtlicher Vergleichsfaktor, Register-Vergleichsfaktor), fuehrt der Vergleichswert aus
   ANGEBOTSPREISEN MINUS MARKTABSCHLAG - als bewusste Ausnahme von § 25 Abs. 1 ImmoWertV, immer
   „indikativ, aus Angebotspreisen abgeleitet", mit dem Weg zum Gutachterausschuss.
   Das ist das Gegenstueck zur LZS-Ausnahme vom 19.10.2026: dort gibt es IMMER einen Zins, damit der
   Ertragswert rechnet; hier gibt es fuer typisches Wohnungseigentum IMMER ein fuehrendes Verfahren,
   sobald eine Angebotsindikation mit Abschlag vorliegt. Gerechnet wird hier nichts: die Zahl ist
   ValuationService.market_value.estimated (Angebotsmedian × Faktoren, minus Abschlag nach der
   Rangfolge eigene Angabe > oertliche Messung > Marktdurchschnitt, lib/angebot_abschlag.js).

   STUFE M („Markt": aus Angebotspreisen). Warum ein eigener Buchstabe und nicht N:
     N  = DealPilot-Formel / -Landesmittel, abgeleitet aus AMTLICHEN Werten der Ausschuesse (−25)
     M  = abgeleitet aus Angebotspreisen, also aus KEINER amtlichen Zahl, aber fuer diesen Ort (−30)
     D  = gesetzlicher Auffangwert, weder amtlich-oertlich noch marktbezogen (−40)
   N wuerde eine amtliche Herkunft behaupten, die Angebotspreise nicht haben. Der Abzug liegt deshalb
   zwischen N und D. Die −30 sind eine DealPilot-Setzung, keine gesetzliche Zahl.
   Nur typisches Wohnungseigentum (der istWohnung-Zweig unten): EFH/ZFH/MFH und Wohnungen in Objekten
   mit hoechstens zwei Einheiten (Sachwert) bleiben unveraendert. */
export const STUFE_ANGEBOT = 'M';
export const ABZUG_ANGEBOT = 30;
export const NAME_ANGEBOT = 'indikativ, aus Angebotspreisen abgeleitet';

/** Belastbarkeit des Vergleichswerts aus Angebotspreisen (Stufe M), Schema wie ErtragswertService. */
export function belastbarkeitAngebot() {
  const pct = 100 - ABZUG_ANGEBOT;
  return { pct, label: pct >= 80 ? 'Hoch' : pct >= 60 ? 'Mittel' : pct >= 40 ? 'Niedrig' : 'Sehr niedrig',
    abzuege: ['Vergleichswert aus Angebotspreisen abgeleitet, nicht aus Kaufpreisen (Stufe M, −' + ABZUG_ANGEBOT + ')'] };
}

/** Kurzname der Abschlagsherkunft fuer den Kundentext - nie eine Datenquelle (Marcel 14.10.2026). */
export function abschlagKurz(herkunft) {
  const h = String(herkunft || '');
  if (/^eigene/i.test(h)) return 'eigene Angabe';
  if (/rtlich/.test(h)) return 'örtlich gemessen an den Kauffällen des Gutachterausschusses';
  return 'aktueller Marktdurchschnitt';
}

/**
 * Der Weg zum amtlichen Wert (Stufe M) - EIN Wortlaut fuer Bericht, PDF und KI-Fakten.
 * @param {{stelle?:string, url?:string, email?:string, kosten?:string}} q  aus quelleFuer()/Kontaktdatei
 */
export function wegVergleichsfaktor(q = {}) {
  const stelle = q.stelle || null;
  return {
    ausschuss: stelle, url: q.url || null, email: q.email || null, kosten: q.kosten || null,
    /* Landestabelle (quelleFuer herkunft 'landestabelle'): die Stelle ist der Einstieg, nicht der Ausschuss selbst */
    text: 'Genauer geht es mit einem amtlichen Vergleichsfaktor (§ 20 ImmoWertV) oder Immobilienrichtwert des zuständigen '
      + 'Gutachterausschusses' + (stelle ? (q.landesebene ? ' (Einstieg über: ' + stelle + ')' : ' (' + stelle + ')') : '')
      + ' — abgeleitet aus tatsächlichen Kaufpreisen. '
      + 'Liegt er vor, rechnet der Bericht den Vergleichswert damit; eine Auskunft aus der Kaufpreissammlung '
      + '(§ 195 BauGB) gibt die Geschäftsstelle.',
  };
}

export function fuehrendesVerfahren({ objektart, wohneinheiten = null, nutzung = null,
                                      vergleichsbasis = null, angebotswert = null }) {
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
      /* v3242 · Angebotsindikation MIT Abschlag liegt vor (angebotswert: { abschlag_pct, abschlag_herkunft })
         -> der Vergleichswert fuehrt, indikativ, Stufe M. Ohne Abschlag (rohe Angebotspreise) nicht. */
      const ab = angebotswert && typeof angebotswert === 'object' ? angebotswert : null;
      if (ab && Number.isFinite(Number(ab.abschlag_pct)) && ab.abschlag_pct !== null) {
        const pct = String(Number(ab.abschlag_pct)).replace('.', ',');
        return {
          verfahren: 'vergleichswert',
          basis: 'angebote',
          stufe: STUFE_ANGEBOT,
          indikativ: true,
          etikett: NAME_ANGEBOT,
          grund: 'Für typisches Wohnungseigentum ist das Vergleichswertverfahren das richtige Verfahren (§ 6 Abs. 1 ImmoWertV). '
            + 'Für dieses Objekt liegt kein anwendbarer amtlicher Vergleichsfaktor und kein anwendbarer Immobilienrichtwert des Gutachterausschusses vor. '
            + 'Der Vergleichswert ist deshalb indikativ aus Angebotspreisen vergleichbarer Wohnungen abgeleitet, abzüglich '
            + pct + ' % Abschlag zwischen Angebots- und Kaufpreisen (' + abschlagKurz(ab.abschlag_herkunft) + '). '
            + 'Das ist eine bewusste Ausnahme: § 25 Abs. 1 ImmoWertV verlangt für das Vergleichswertverfahren Kaufpreise.',
          quelle: '§ 6 Abs. 1, § 24 ImmoWertV · Vergleichspreise abweichend von § 25 Abs. 1 aus Angebotspreisen (Stufe M)',
          weg: wegVergleichsfaktor().text,
          belastbarkeit: belastbarkeitAngebot(),
        };
      }
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
 * 2 · ENTFERNT (v3010): DER DEALPILOT-MERKMALSKATALOG ZUM ZINS
 *
 * Hier stand angepassterZins() mit MERKMALE: Gebaeudealter, Wohnlage, Nutzung,
 * Wohneinheiten und Groesse, je mit einem von DealPilot GESETZTEN Gewicht, gedeckelt
 * auf eine Standardabweichung, ausgewiesen als „Stufe C" (bis v3009) bzw. als
 * „Einordnung, nicht gerechnet". Die ImmoWertA kennt diesen Weg nicht: § 33 passt
 * nur mit der Funktion oder den Umrechnungskoeffizienten des Ausschusses selbst an
 * (lib/lzs_anpassung.js, v3009); was die nicht traegt, gehoert in die boG
 * (ImmoWertA zu § 33). Marcel 27.10.2026: streichen.
 * Einziger Aufrufer war CrossCheckService (out.zins_anpassung), einziger Leser
 * der PDF-Block in frontend/marktbericht-app/app.js - beide entfernt.
 * ════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════
 * 3 · VERFAHRENSWAHL MIT DEM IMMOBILIENRICHTWERT (v2620, Marcel 21.10.2026: E7)
 *
 * Seit es einen echten Vergleichswert aus dem Immobilienrichtwert gibt
 * (lib/vergleichswert_irw.js — IRW × Umrechnungskoeffizienten des Ausschusses,
 * Stufe A), stellt sich die Wahl neu. Die Regel:
 *
 *   Wohnungseigentum (typisch, mehr als zwei WE) mit IRW-Vergleichswert
 *     → das Vergleichswertverfahren FÜHRT (ImmoWertA 6.(1): bei Wohnungseigentum
 *       ist es das Regelverfahren, wenn Vergleichspreise/-faktoren vorliegen).
 *       Ertragswert daneben als Plausibilität.
 *   Ein-/Zweifamilienhaus mit IRW UND Sachwertfaktor
 *     → Sachwert bleibt führend (Abschnitt 5.1.4 des Marktberichts, § 6 Abs. 1),
 *       der Vergleichswert steht als zweites Verfahren daneben.
 *   Ein-/Zweifamilienhaus mit IRW, OHNE Sachwertfaktor
 *     → Vergleichswert führt: ein Sachwert ohne Marktanpassung (§ 21 Abs. 3,
 *       § 39) ist kein Marktwert; der IRW ist es.
 *   Mehrfamilienhaus / Renditeobjekt
 *     → Ertragswert führt; ein IRW-Vergleichswert (Teilmarkt MFH) daneben.
 *
 * Diese Funktion WÄHLT nur; sie rechnet nichts und ist nicht in den
 * CrossCheckService eingebunden (das macht die Verdrahtung danach).
 *
 * @param {object} o
 * @param {string} o.objektart
 * @param {number} [o.wohneinheiten]
 * @param {string} [o.nutzung]
 * @param {boolean} o.irw_vergleichswert  vergleichswertIrw(...).verfuegbar
 * @param {boolean} [o.sachwertfaktor]    ein amtlicher Sachwertfaktor liegt vor
 * @returns {{fuehrend:string|null, weitere:string[], grund:string, quelle:string, basis:string|null}}
 * ════════════════════════════════════════════════════════════════════════ */
export function verfahrenMitIrw({ objektart, wohneinheiten = null, nutzung = null,
                                  irw_vergleichswert = false, sachwertfaktor = false }) {
  const irw = irw_vergleichswert === true;
  const basis = fuehrendesVerfahren({ objektart, wohneinheiten, nutzung,
    vergleichsbasis: irw ? 'kaufpreise' : null });
  const v = basis.verfahren;

  if (v === 'vergleichswert') {
    return { fuehrend: 'vergleichswert', weitere: ['ertragswert'], basis: 'immobilienrichtwert',
      grund: 'Wohnungseigentum: der Immobilienrichtwert des Gutachterausschusses ist ein Vergleichsfaktor aus Kaufpreisen (§ 20 ImmoWertV); mit seinen Umrechnungskoeffizienten ist das Vergleichswertverfahren das Regelverfahren. Der Ertragswert steht zur Plausibilisierung daneben.',
      quelle: '§ 6 Abs. 1, §§ 24–26 ImmoWertV · ImmoWertA 6.(1)' };
  }
  if (v === 'sachwert') {
    if (sachwertfaktor === true || !irw) {
      return { fuehrend: 'sachwert', weitere: irw ? ['vergleichswert'] : [], basis: irw ? 'immobilienrichtwert' : null,
        grund: basis.grund + (irw ? ' Der Vergleichswert aus dem Immobilienrichtwert steht als zweites Verfahren daneben.' : ''),
        quelle: basis.quelle };
    }
    return { fuehrend: 'vergleichswert', weitere: [], basis: 'immobilienrichtwert',
      grund: 'Für dieses Objekt liegt kein amtlicher Sachwertfaktor vor; ein Sachwert ohne Marktanpassung ist kein Marktwert (§ 21 Abs. 3, § 39 ImmoWertV). Der Immobilienrichtwert ist aus Kaufpreisen abgeleitet und mit den Umrechnungskoeffizienten des Ausschusses anwendbar — deshalb führt hier das Vergleichswertverfahren.',
      quelle: '§ 6 Abs. 1, § 21 Abs. 3, §§ 24–26 ImmoWertV' };
  }
  if (v === 'ertragswert') {
    return { fuehrend: 'ertragswert', weitere: irw ? ['vergleichswert'] : [], basis: irw ? 'immobilienrichtwert' : null,
      grund: basis.grund + (irw ? ' Der Vergleichswert aus dem Immobilienrichtwert (Teilmarkt Mehrfamilienhäuser) steht als zweites Verfahren daneben.' : ''),
      quelle: basis.quelle };
  }
  return { fuehrend: null, weitere: [], basis: null, grund: basis.grund, quelle: basis.quelle || null,
    fehlt: basis.fehlt || null, weg: basis.weg || null };
}
