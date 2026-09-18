/* =====================================================================
   Junker Immobilien — Spannenlogik für die öffentliche Ersteinschätzung
   =====================================================================

   Der Rechenkern (rnd-calc.js) liefert eine Punktzahl, zum Beispiel
   24,65 Jahre. Diese Zahl darf einem Besucher so nicht angezeigt werden,
   und zwar aus drei Gründen:

   1. Sie täuscht eine Genauigkeit vor, die ein Webformular nicht haben
      kann. Der Zustand eines Gebäudes wird vor Ort festgestellt, nicht
      per Auswahlfeld.

   2. Sie ist eine Zwischengröße. Die beiden Originalgutachten, gegen die
      der Rechenkern geprüft ist, geben als Endergebnis die "reelle
      Restnutzungsdauer" aus — eine sachverständige Korrektur. In einem
      der beiden Fälle hebt sie den technischen Wert von 22 auf 26 Jahre
      an. Die Korrektur ging in beiden belegten Fällen nach oben oder
      blieb gleich, nie nach unten.

   3. Ein zu niedriger Wert ist kein Vorteil, sondern ein Risiko. Wer mit
      "8 Jahre Restnutzungsdauer, 12,5 % Abschreibung" wirbt, verkauft ein
      Ergebnis, das ohne sehr belastbare Begründung vor Ort nicht zu
      halten ist.

   Deshalb gibt diese Datei eine Spanne aus, keine Zahl.

   ---------------------------------------------------------------------
   Die Regeln
   ---------------------------------------------------------------------

   Korridor:  Die Spanne liegt ÜBER dem Rechenwert, nicht um ihn herum.
              Erst eine Reserve von 10 % (mindestens 2 Jahre) auf den
              Rechenwert — das ist die untere Kante. Darauf 18 %
              (mindestens 4 Jahre) für die Breite.

              Bei einem Rechenwert von 22 Jahren ergibt das "24 bis 28".
              Im Referenzgutachten 25DG06644/MK hielt der Sachverständige
              nach dem Ortstermin 26 Jahre für angemessen — der Wert liegt
              also mitten in der Spanne.

              Warum nach oben und nicht symmetrisch: Eine längere
              Restnutzungsdauer bedeutet einen NIEDRIGEREN Abschreibungs-
              satz. Die Ersteinschätzung verspricht damit eher zu wenig
              als zu viel. Wird sie vom Gutachten übertroffen, kostet das
              nichts; wird sie unterschritten, kostet es das Vertrauen —
              und zwar nachdem der Kunde bezahlt hat.

   Anker:     § 185 Abs. 3 Satz 5 BewG nennt 30 % der Gesamtnutzungsdauer
              als Untergrenze für ein noch nutzbares Gebäude. Für ein
              Gutachten nach § 7 Abs. 4 Satz 2 EStG ist das nicht bindend
              — für eine unverbindliche Ersteinschätzung ohne Ortstermin
              ist es die vernünftige Untergrenze. Liegt der Leitwert
              darunter, wird die untere Kante auf den Anker gehoben und
              der Fall als "Ortstermin nötig" gekennzeichnet. Der Kunde
              erfährt, dass hier mehr drin sein kann als die Spanne zeigt,
              aber nur mit Begutachtung.

   Widerspruch: Punktraster und technisches Verfahren fragen dasselbe
              Gebäude in zwei Sprachen ab. Liegen sie um den Faktor 2
              auseinander, hat sich der Nutzer in einem der beiden
              Schritte vertan. Dann wird die Spanne gezeigt, aber mit
              deutlichem Hinweis.

   Kein Verfahren: Ab Alter >= Gesamtnutzungsdauer rechnet der Kern nicht
              mehr (und darf es auch nicht — die Parabel der Anlage 2
              steigt hinter ihrem Scheitel wieder an). Dann gibt es keine
              Spanne, sondern die Aufforderung zum Gespräch.

   ===================================================================== */

(function (global) {
  'use strict';

  /* ------------------------------------------------------------------
     Die beiden Stellschrauben. Wer die Spanne breiter oder schmaler
     haben will, ändert sie hier — und nur hier.

     Zur Einordnung, gemessen an den beiden Referenzgutachten:

     25DG06644 — technisch 22, Gutachten nach Ortstermin 26.
       Ersteinschätzung "24 bis 28": der Gutachtenwert liegt mittendrin.

     25DG02661 — technisch 26, Gutachten ebenfalls 26.
       Ersteinschätzung "29 bis 34": der Gutachtenwert liegt DARUNTER.
       Hier ist die Reserve zu hoch angesetzt; der Kunde bekäme eine
       vorsichtigere Auskunft, als das Gutachten hergibt. Das ist die
       bewusst gewählte Richtung — sie kostet Anfragen, keine Kunden.

     Nach weiteren eigenen Fällen lässt sich das nachschärfen: Landen die
     Gutachten regelmäßig oberhalb der oberen Kante, gehört RESERVE_PCT
     gesenkt; landen sie regelmäßig darunter, gehört sie erhöht.
     ------------------------------------------------------------------ */
  /* Zwei Stellschrauben, in dieser Reihenfolge angewendet.

     RESERVE hebt die untere Kante ueber den Rechenwert. Ohne sie stuende
     der Rechenwert selbst unten, und die Ersteinschaetzung waere so
     genau, wie ein Formular nicht sein kann. Mit ihr liegt die Spanne
     bewusst etwas hoeher: Eine laengere Restnutzungsdauer bedeutet einen
     niedrigeren Abschreibungssatz — wir versprechen also weniger, als
     das Gutachten voraussichtlich hergibt.

     Das ist eine geschaeftliche Entscheidung, keine rechnerische: Eine
     Ersteinschaetzung, die der Kunde nach dem Gutachten uebertroffen
     sieht, kostet nichts. Eine, die er unterschritten sieht, kostet das
     Vertrauen — und zwar in dem Moment, in dem er schon bezahlt hat.

     BREITE spannt von dort nach oben auf.

     Gemessen am Referenzgutachten 25DG06644/MK (technisch 22,00 Jahre,
     reell 26 Jahre): Die Spanne lautet 24 bis 28, die tatsaechlichen 26
     Jahre liegen also mittendrin statt an der Kante. */
  var MIN_RESERVE = 2;       // Jahre
  var RESERVE_PCT = 0.10;    // 10 % des Rechenwerts
  var MIN_BREITE  = 4;       // Jahre
  var BREITE_PCT  = 0.18;    // 18 % der unteren Kante

  /* Fuehrt das Punktraster, gilt statt Reserve + Breite ein
     symmetrischer Korridor um den Wert. Siehe spanneAus(). */
  var MIN_KORRIDOR = 2;      // Jahre
  var KORRIDOR_PCT = 0.10;   // 10 % nach jeder Seite

  function spanneAus(result) {
    if (!result || !result.plausibilitaet) {
      return { ok: false, grund: 'kein_ergebnis' };
    }

    // Ab Alter >= GND rechnet der Kern bewusst nicht mehr.
    if (result.verfahren === 'keines' || !(result.final_rnd > 0)) {
      return {
        ok: false,
        grund: 'ueber_gnd',
        titel: 'Das rechnet kein Formular mehr aus.',
        text: 'Ihr Gebäude hat die für seine Art übliche Gesamtnutzungsdauer ' +
              'rechnerisch bereits erreicht. Das heißt nicht, dass es am Ende ist — ' +
              'es heißt, dass die Restnutzungsdauer hier nicht mehr aus Baujahr und ' +
              'Zustandsstufen abgeleitet werden kann. Solche Fälle sind regelmäßig ' +
              'die interessantesten: nach einer Kernsanierung wird mit einem fiktiven ' +
              'Baujahr gerechnet, und das kann die Abschreibung deutlich verändern. ' +
              'Das klären wir im Gespräch.'
      };
    }

    var leit = result.final_rnd;
    var mitte = Math.round(leit);

    /* ---- Warum die Spanne nach oben liegt, nicht um den Wert herum ----
       Früher lag die Spanne symmetrisch um den Rechenwert: 22 Jahre
       ergaben 20 bis 24. Der Vergleich mit einem echten Gutachten zeigte,
       dass das systematisch zu kurz greift.

       Referenzgutachten 25DG06644/MK, Eigentumswohnung Baujahr 1998:
       technische Restnutzungsdauer 22,00 Jahre — als REELLE
       Restnutzungsdauer hielt der Sachverständige nach der Besichtigung
       26 Jahre für angemessen. Er korrigiert also nach oben, und das ist
       kein Zufall: Das technische Verfahren bewertet die neun Gewerke in
       drei groben Stufen, und wer nichts modernisiert hat, landet in der
       untersten. Vor Ort zeigt sich fast immer, dass mehr Substanz da ist
       als diese Stufen abbilden.

       Deshalb liegt die Spanne oberhalb des Rechenwerts: erst die
       Reserve, dann die Breite. Für das Referenzobjekt ergibt das 24 bis
       28 Jahre; der Sachverständige kam auf 26.

       Die Richtung ist zusätzlich die vorsichtige: Eine längere
       Restnutzungsdauer bedeutet einen NIEDRIGEREN Abschreibungssatz. Die
       Ersteinschätzung verspricht damit eher zu wenig als zu viel — und
       eine Enttäuschung nach Erhalt des Gutachtens ist der Fehler, den man
       sich am wenigsten leisten kann. */
    /* ---- Warum die Reserve nur auf das technische Verfahren gehoert
       Die Reserve korrigiert einen GEMESSENEN Fehler des technischen
       Verfahrens: Im Referenzgutachten 25DG06644/MK rechnete es 22
       Jahre, der Sachverstaendige hielt nach dem Ortstermin 26 fuer
       richtig. Das ist kein Zufall — das technische Verfahren kennt je
       Gewerk nur drei grobe Stufen, und wer nichts modernisiert hat,
       landet in der untersten. Vor Ort ist fast immer mehr Substanz da.

       Fuehrt dagegen das Punktraster nach Anlage 2 ImmoWertV, gibt es
       diesen Fehler nicht zu korrigieren. Anlage 2 ist ein normiertes
       Modell, das die Modernisierung bereits eingerechnet hat und
       ohnehin deutlich milder ausfaellt als die technische Rechnung.
       Eine Reserve obendrauf legte zwei Korrekturen in dieselbe
       Richtung uebereinander.

       Gemessen am 14.09.2026, Objekt Rinteln Bj. 1972 unsaniert, GND 80:
         Punktraster 25,81 — mit Reserve 29 bis 34, ohne Reserve 23 bis 29.
       Die 29 bis 34 waeren mehr Restnutzungsdauer als das technische
       Verfahren dem Gebaeude ueberhaupt zubilligt (13 Jahre), und mehr
       als die Ersteinschaetzung vor der Umstellung auswies.

       Statt der Reserve bekommt das Punktraster einen symmetrischen
       Korridor: Er traegt der Unschaerfe eines Webformulars Rechnung,
       ohne den Wert zu verschieben. */
    var halb = Math.max(MIN_KORRIDOR, Math.round(mitte * KORRIDOR_PCT));
    var von, bis;
    if (result.verfahren === 'punktraster') {
      /* Anlage 2 ImmoWertV fuehrt: symmetrisch um den Modellwert. */
      von = mitte - halb;
      bis = mitte + halb;
    } else if (result.verfahren === 'gnd_minus_alter'
            || result.verfahren === 'gesamtnutzungsdauer') {
      /* Der Leitwert IST bereits die Obergrenze — Gesamtnutzungsdauer
         minus Alter ist keine Schaetzung, sondern Arithmetik. Darueber
         kann nichts liegen, also geht der Korridor nach unten. */
      von = mitte - 2 * halb;
      bis = mitte;
    } else {
      /* Technisches Verfahren: Reserve nach oben (siehe oben). */
      var reserve = Math.max(MIN_RESERVE, Math.round(mitte * RESERVE_PCT));
      von = mitte + reserve;
      var korridor = Math.max(MIN_BREITE, Math.round(von * BREITE_PCT));
      bis = von + korridor;
    }

    var pr0 = result.methods && result.methods.punktraster;
    var anker = result.plausibilitaet.mindest_30_prozent;
    var ankerUnterschritten = !!result.plausibilitaet.unterschritten;

    /* ---- Warum der 30-%-Anker die Spanne NICHT mehr anhebt ----------
       Bis zum 14.09.2026 wurde die untere Kante auf 30 % der
       Gesamtnutzungsdauer hochgezogen, sobald die technische Rechnung
       darunter lag. Für das Objekt in Rinteln — Baujahr 1972, nichts
       modernisiert — hiess das: technisch 13 Jahre, ausgewiesen 24 bis
       28 Jahre.

       Marcel hat denselben Fall bei gutachten.org gerechnet: 14 bis 18
       Jahre, Abschreibung bis zu 7 %. Zehn Jahre Unterschied, und zwar
       zu Lasten des Kunden — eine längere Restnutzungsdauer bedeutet
       einen niedrigeren Abschreibungssatz.

       Nachgemessen war die Ursache eindeutig: nicht die
       Gesamtnutzungsdauer, sondern dieser Anker. Ohne ihn liefert
       dieselbe Rechnung 15 bis 19 Jahre — praktisch das Ergebnis des
       Wettbewerbers, unabhängig gerechnet.

       Die Herkunft des Ankers steht im Rechenkern selbst:
       **§ 185 Abs. 3 Satz 5 BewG.** Dort ist er bindend — für die
       Grundbesitzbewertung im Ertragswertverfahren. Für ein
       Restnutzungsdauergutachten nach § 7 Abs. 4 Satz 2 EStG gilt er
       nicht. Es ist derselbe Kategorienfehler wie bei der
       Gesamtnutzungsdauer, die bis zum selben Tag aus Anlage 22 BewG
       statt aus Anlage 1 ImmoWertV kam (FALLEN.md 33): eine
       BewG-Regel in einer ImmoWertV-Rechnung.

       Und er widerspricht dem Zweck: Wer ein Gutachten beauftragt, will
       gerade nachweisen, dass die Restnutzungsdauer kürzer ist als die
       Pauschale unterstellt. Eine Untergrenze bei 30 % der
       Gesamtnutzungsdauer deckelt genau das.

       Entschieden von Marcel am 14.09.2026, nachdem beide Varianten
       gegen den Wettbewerber gerechnet vorlagen.

       Der Wert bleibt im Ergebnis stehen (anker_jahre, anker_greift) —
       er ist eine sinnvolle Warnlampe für den Sachverständigen und
       steht im Rechenkern weiterhin als Plausibilitätshinweis. Nur die
       Spanne wird nicht mehr daran hochgezogen. */

    /* Harte Obergrenze: Ein Gebäude kann nie mehr Restnutzungsdauer haben
       als seine Gesamtnutzungsdauer. Ohne diese Zeile konnte bei einem
       jungen, durchweg zeitgemäßen Objekt eine obere Kante von 76 Jahren
       bei 70 Jahren Gesamtnutzungsdauer entstehen — der technische Ansatz
       addiert Zuschläge, die Spanne legte noch einmal darauf. */
    /* Die Obergrenze, die leitwertAn() gezogen hat, gilt auch fuer die
       obere Kante. Ohne diese Zeile hob die Reserve die Spanne hinterher
       wieder darueber — genau der Fehler, den der Deckel verhindern
       sollte. Faellt sie weg (Ergebnis ohne leitwertAn), bleibt die
       Gesamtnutzungsdauer als schwaechere Grenze. */
    var obergrenze = Number(result.__obergrenze);
    var gndMax = Number(result.input && result.input.gnd) || 0;
    if (!(obergrenze > 0)) obergrenze = gndMax;
    if (obergrenze > 0 && bis > obergrenze) bis = Math.floor(obergrenze);

    if (von < 1) von = 1;
    if (bis < von + 1) { von = Math.max(1, bis - 1); }

    /* Ein Widerspruch liegt nicht schon dann vor, wenn Punktraster und
       technische Rechnung auseinanderliegen — bei einem alten Gebäude mit
       frisch erneuerter Heizung tun sie das völlig zu Recht. Gemeint ist
       der Fall, dass der Nutzer in Schritt 2 und Schritt 3 einander
       widersprechende Angaben macht. Das prüft die aufrufende Seite über
       JunkerRND_Zustand.abweichung() und gibt es hier herein. */
    var widerspruch = !!(result.__widerspruch);

    /* ---- Lohnt sich das überhaupt? ----------------------------------
       Ohne Gutachten schreibt ein vermietetes Wohngebäude nach
       § 7 Abs. 4 Satz 1 EStG pauschal ab: 2 % im Jahr für Gebäude, die
       nach dem 31.12.1924 fertiggestellt wurden, 2,5 % für ältere. Das
       entspricht 50 beziehungsweise 40 Jahren Nutzungsdauer.

       Daraus folgt eine harte Grenze, die vorher nirgends stand: Liegt
       die ermittelte Restnutzungsdauer über diesem Wert, ist der
       Abschreibungssatz NIEDRIGER als der gesetzliche — ein Gutachten
       würde die Abschreibung dann nicht erhöhen, sondern senken. Es
       lohnt sich nicht, und das muss die Ersteinschätzung sagen.

       Der Fall tritt regelmäßig auf: bei jungen Gebäuden und
       insbesondere nach einer Kernsanierung, wo die Restnutzungsdauer
       gerade wieder in die Nähe der Gesamtnutzungsdauer rückt.

       Drei Lagen werden unterschieden:
         'ja'         die ganze Spanne liegt unter der Grenze
         'moeglich'   die Spanne liegt teils darüber, teils darunter
         'nein'       die ganze Spanne liegt darüber

       Wer das ignoriert, verkauft ein Gutachten, das dem Kunden schadet.
       Genau das soll diese Seite nicht tun. */
    var baujahr = Number(result.input && result.input.baujahr) || 0;
    var vergleichssatz = (baujahr > 0 && baujahr < 1925) ? 2.5 : 2.0;
    var schwelleJahre = Math.round(100 / vergleichssatz);   // 40 oder 50
    var lohnt = bis < schwelleJahre ? 'ja'
              : (von >= schwelleJahre ? 'nein' : 'moeglich');

    return {
      ok: true,
      von: von,
      bis: bis,
      mitte: mitte,
      leitwert: leit,
      verfahren: result.verfahren,
      // AfA-Sätze zur Spanne: kürzere Restnutzungsdauer = höherer Satz.
      afa_von_pct: runde2(100 / bis),
      afa_bis_pct: runde2(100 / von),
      anker_greift: ankerUnterschritten,
      anker_jahre: anker,
      widerspruch: widerspruch,
      // Vergleich mit der gesetzlichen Pauschale
      vergleichssatz_pct: vergleichssatz,
      schwelle_jahre: schwelleJahre,
      lohnt: lohnt
    };
  }

  /* AfA-Vergleich für beide Kanten der Spanne, damit auch der Euro-Betrag
     als Spanne erscheint und nicht als scheingenauer Einzelwert. */
  function vorteilAus(spanne, gebaeudeanteil, grenzsteuersatz, honorar) {
    if (!spanne.ok || !(gebaeudeanteil > 0)) return { ok: false };
    var K = global.DealPilotRND;
    var opts = {
      gebaeudeanteil: gebaeudeanteil,
      grenzsteuersatz: grenzsteuersatz,
      standardAfaSatz: 0.02,
      gutachterkosten: honorar
    };
    var untenRnd = K.calcAfaVergleich(Object.assign({}, opts, { rnd: spanne.bis }));
    var obenRnd = K.calcAfaVergleich(Object.assign({}, opts, { rnd: spanne.von }));
    if (!untenRnd.valid || !obenRnd.valid) return { ok: false };

    return {
      ok: true,
      afa_alt_jahr: untenRnd.afa_standard.jahresbetrag,
      ersparnis_alt_jahr: untenRnd.afa_standard.steuerersparnis_jahr,
      afa_neu_von: untenRnd.afa_kurz.jahresbetrag,
      afa_neu_bis: obenRnd.afa_kurz.jahresbetrag,
      mehr_von: untenRnd.mehr_afa_jahr,
      mehr_bis: obenRnd.mehr_afa_jahr,
      ersparnis_von: untenRnd.steuerersparnis_jahr,
      ersparnis_bis: obenRnd.steuerersparnis_jahr,
      zehn_von: untenRnd.steuerersparnis_jahr * 10,
      zehn_bis: obenRnd.steuerersparnis_jahr * 10,
      honorar: honorar,
      // Die Ampel richtet sich nach der vorsichtigen Kante.
      ampel: untenRnd.ampel,
      lohnt: untenRnd.steuerersparnis_jahr > honorar
    };
  }

  function runde2(x) { return Math.round(x * 100) / 100; }

  global.JunkerRND_Spanne = { spanneAus: spanneAus, vorteilAus: vorteilAus,
                              MIN_RESERVE: MIN_RESERVE, RESERVE_PCT: RESERVE_PCT,
                              MIN_BREITE: MIN_BREITE, BREITE_PCT: BREITE_PCT,
                              MIN_KORRIDOR: MIN_KORRIDOR, KORRIDOR_PCT: KORRIDOR_PCT };
})(typeof window !== 'undefined' ? window : globalThis);

/* =====================================================================
   Zustand aus Modernisierungsangaben und Gebäudealter ableiten
   =====================================================================

   Schritt "Modernisierung" und Schritt "Zustand" fragen dasselbe Gebäude
   in zwei Sprachen ab. Stand der Zustand fest auf "veraltet", entstand bei
   jedem, der die Vorbelegung stehen ließ, ein Widerspruch: Wer angibt, in
   den letzten fünf Jahren Dach, Fenster, Heizung und Bäder erneuert zu
   haben, bekam trotzdem das Ergebnis eines vollständig veralteten
   Gebäudes — also eine viel zu kurze Restnutzungsdauer. Beim Nachrechnen
   von sechs Fällen kam für ein durchsaniertes Mehrfamilienhaus von 1995
   dieselbe Spanne heraus wie für ein unsaniertes von 1972.

   Die naheliegende Korrektur — "nie modernisiert heißt veraltet" — ist
   aber genauso falsch, nur in die andere Richtung: An einem Haus von 2008
   ist noch nichts fällig gewesen. Nicht modernisiert heißt dort, dass das
   Bauteil von 2008 stammt und damit zeitgemäß ist.

   Deshalb entscheidet nicht die Modernisierung allein, sondern das
   Alter des Bauteils: Wann wurde es zuletzt erneuert — und ist das
   gemessen an seiner üblichen Lebensdauer lange her?

       tatsächliches Alter des Bauteils  >  übliche Lebensdauer   →  veraltet
       sonst                                                     →  zeitgemäß

   Wurde nie modernisiert, ist das Bauteil so alt wie das Gebäude.

   ---------------------------------------------------------------------
   ACHTUNG, FACHWERTE — von Marcel zu bestätigen
   ---------------------------------------------------------------------
   Die Lebensdauern unten sind übliche Größenordnungen, keine Vorschrift.
   Das Modul bringt mit rnd-bte-katalog.js einen Katalog von 177 Bauteilen
   mit; wer es genauer will, nimmt die Werte von dort. Für eine
   Vorbelegung, die der Nutzer ohnehin ändern kann, reicht diese kurze
   Tabelle — sie muss nur plausibel sein, nicht exakt.

   "gehoben" wird nie vorbelegt. Das ist eine Aussage über Qualität, nicht
   über Alter — die trifft der Sachverständige, nicht das Formular.
   ===================================================================== */
(function (global) {
  'use strict';

  // Übliche Lebensdauer in Jahren, bis ein Bauteil als überaltert gilt.
  /* Übliche Lebensdauern der Bauteile in Jahren.
     ---------------------------------------------------------------------
     Diese Werte stammen nicht aus einer Schätzung, sondern aus dem
     Referenzgutachten 25DG06644/MK (Eigentumswohnung Baujahr 1998), das
     die durchschnittlichen Lebensdauern je Gewerk ausweist: Dachbelag 40,
     Fenster 25, Leitungen 30 bis 50, Heizungsanlage 25, Wärmedämmverbund-
     system 35, Bäder 30, technische Ausstattung 25 Jahre.

     Maßgeblich ist beim Dach der Belag, nicht der Dachstuhl (80 Jahre) —
     der Stuhl bestimmt die Standsicherheit, der Belag die wirtschaftliche
     Nutzbarkeit. */
  var LEBENSDAUER = {
    dach: 40,          // Dachbelag; der Dachstuhl haelt laenger
    fenster: 25,
    leitungen: 40,     // Strom, Gas, Wasser, Abwasser
    heizung: 25,
    aussenwand: 35,    // Wärmedämmverbundsystem
    baeder: 30,
    decken: 60,        // folgt dem Innenausbau
    grundriss: 60,     // ändert sich selten
    technik: 25        // Haustechnik allgemein
  };

  // Welche Modernisierungsangabe gehört zu welchem Gewerk.
  var HERKUNFT = {
    dach: 'dach', fenster: 'fenster', leitungen: 'leitungen', heizung: 'heizung',
    aussenwand: 'aussenwand', baeder: 'baeder', decken: 'innenausbau',
    grundriss: 'grundriss', technik: 'heizung'
  };

  /* Wie lange ist die Maßnahme her? Mitte des jeweiligen Zeitraums.
     null heißt: nie gemacht — dann zählt das Gebäudealter.

     Seit dem 16.09.2026 steht diese Tabelle in rnd-massnahmen.js, damit
     Zeitstufen, Faktoren und Zeitmitten nicht an zwei Stellen gepflegt
     werden müssen. Fehlt die Datei, gibt es hier KEINE Ersatztabelle:
     Ein Rückfall auf eine veraltete Kopie wäre genau der stille
     Vorgabewert, den CLAUDE.md Regel 6 verbietet. */
  var M = global.JunkerRND_Massnahmen;
  var SEITHER = M ? M.SEITHER : null;

  /* Ab welchem verbrauchten Anteil der Lebensdauer gilt ein Gewerk als
     veraltet, ab welchem als gehoben. */
  var SCHWELLE_VERALTET = 0.6;
  var SCHWELLE_GEHOBEN  = 0.3;

  /* Leitet aus den Modernisierungsangaben den Zustand der neun Gewerke ab.
     ---------------------------------------------------------------------
     Die frühere Fassung stufte ein Gewerk erst als veraltet ein, wenn es
     seine volle Lebensdauer überschritten hatte. Das klingt streng, ist
     aber viel zu milde: Eine Eigentumswohnung von 1998, an der nie etwas
     gemacht wurde, kam damit auf durchweg "aktueller Standard" und in der
     Folge auf 58 bis 68 Jahre Restnutzungsdauer — bei 70 Jahren
     Gesamtnutzungsdauer und 28 Jahren Alter rechnerisch unmöglich.

     Zwei Änderungen bringen die Ableitung dorthin, wo ein Sachverständiger
     tatsächlich landet:

     1. Ein Gewerk ist veraltet, sobald es 60 % seiner Lebensdauer
        verbraucht hat — nicht erst danach. Ein Fenster mit 20 von 25
        Jahren ist kein aktueller Standard mehr.

     2. Für NIE modernisierte Gewerke zählt zusätzlich der Abstand zur
        Baugeneration: Alter gemessen an der halben Gesamtnutzungsdauer.
        Das trifft die Bauteile, die kaum verschleißen, aber trotzdem
        veralten — Grundriss und Decken. Ein Grundriss von 1998 nutzt sich
        nicht ab, er entspricht nur nicht mehr dem, was heute gebaut wird.
        Maßgeblich ist der ungünstigere der beiden Blickwinkel.

     Für Gewerke, die tatsächlich erneuert wurden, greift Punkt 2 bewusst
     NICHT — sonst wäre ein kernsaniertes Gebäude von 1965 genauso schlecht
     bewertet wie ein unsaniertes, und das ist offensichtlich falsch.

     Gegenprobe am Referenzgutachten 25DG06644/MK (Baujahr 1998, Stichtag
     31.07.2024, nur Heizung vor 10 bis 15 Jahren erneuert): Die Ableitung
     stuft alle neun Gewerke als veraltet ein — genau wie der
     Sachverständige nach der Ortsbesichtigung — und das technische
     Verfahren liefert damit dieselben 22,00 Jahre wie im Gutachten. */
  function zustandAus(mod, alter, gnd, anteil) {
    var a = Number(alter);
    if (!(a >= 0)) a = 999;          // Alter unbekannt: vorsichtig rechnen
    var g = Number(gnd) > 0 ? Number(gnd) : 70;
    var out = {};
    if (!SEITHER) return out;        // ohne rnd-massnahmen.js kein Ergebnis
    Object.keys(LEBENSDAUER).forEach(function (gewerk) {
      var teil = HERKUNFT[gewerk];
      /* Der Anteil entscheidet mit: Ein Bad von sechs macht das Gewerk
         Sanitär nicht zeitgemäß. Ohne diese Grenze stufte die Ableitung
         es als "gehoben" ein, und die technische Restnutzungsdauer
         sprang nach oben — bei einer Maßnahme, die der Gutachter mit
         0,3 von 2 Punkten bewertet (Westerfeldstr. 140, B06). */
      var stufe = M.zeitFuerZustand(mod ? mod[teil] : null,
                                    anteil ? anteil[teil] : null);
      var seit = SEITHER[stufe];
      var quote;
      if (seit == null) {
        // Nie modernisiert: Verschleiß und Baugeneration, der schlechtere Wert.
        quote = Math.max(a / LEBENSDAUER[gewerk], a / (g / 2));
      } else {
        // Erneuert: allein der Verschleiß seit der Maßnahme zählt.
        quote = Math.min(seit, a) / LEBENSDAUER[gewerk];
      }
      out[gewerk] = quote >= SCHWELLE_VERALTET ? 'veraltet'
                  : (quote <= SCHWELLE_GEHOBEN ? 'gehoben' : 'standard');
    });
    return out;
  }

  global.JunkerRND_Zustand = { zustandAus: zustandAus, LEBENSDAUER: LEBENSDAUER,
                               HERKUNFT: HERKUNFT, SEITHER: SEITHER,
                               SCHWELLE_VERALTET: SCHWELLE_VERALTET,
                               SCHWELLE_GEHOBEN: SCHWELLE_GEHOBEN };
})(typeof window !== 'undefined' ? window : globalThis);

/* Wie weit weichen die Zustandsangaben des Nutzers von dem ab, was seine
   Modernisierungsangaben nahelegen? Ab der Hälfte der Gewerke ist das kein
   Feinschliff mehr, sondern ein Widerspruch — dann hat er mit hoher
   Wahrscheinlichkeit einen der beiden Schritte zu grob ausgefüllt. */
(function (global) {
  'use strict';
  var Z = global.JunkerRND_Zustand;
  Z.abweichung = function (mod, alter, zustand, gnd, anteil) {
    var soll = Z.zustandAus(mod, alter, gnd, anteil), n = 0, ganz = 0;
    Object.keys(soll).forEach(function (k) {
      ganz++;
      if (zustand[k] !== soll[k]) n++;
    });
    return { anzahl: n, von: ganz, widerspruch: n >= Math.ceil(ganz / 2) };
  };
})(typeof window !== 'undefined' ? window : globalThis);


/* =====================================================================
   Das Leitverfahren - welche Zahl gilt
   =====================================================================

   Anlass: Marcel hat am 14.09.2026 ein Objekt (Rinteln, Mehrfamilienhaus
   Baujahr 1972, nichts modernisiert) parallel bei gutachten.org gerechnet
   - dort 14 bis 18 Jahre, bei uns 24 bis 28. Zehn Jahre Unterschied, und
   zwar zu Lasten des Kunden: Eine laengere Restnutzungsdauer bedeutet
   einen niedrigeren Abschreibungssatz.

   ---------------------------------------------------------------------
   Was dahintersteckte - und ein Messfehler auf dem Weg dorthin
   ---------------------------------------------------------------------
   Meine erste Messung stellte das technische Verfahren gegen die
   Punktrastermethode der Anlage 2 ImmoWertV und ergab, das technische
   liege um den Faktor zwei bis fuenf daneben. Daraus folgte der
   Vorschlag, Anlage 2 zum Leitverfahren zu machen.

   Diese Messung war falsch. Sie gab dem Rechenkern sechs
   Modernisierungspunkte UND gleichzeitig "alle neun Gewerke veraltet" -
   eine Eingabekombination, die der Trichter nie erzeugt, weil dort
   beides aus denselben Antworten abgeleitet wird. Dem technischen
   Verfahren wurde damit die Modernisierung vorenthalten, die dem
   Punktraster zugestanden wurde. Siehe FALLEN.md 39.

   Mit stimmigen Eingaben, an vier Faellen mit Vergleichswert:

     Fall                          technisch  Anlage 2     ausgewiesen  Beleg
     Rinteln    Bj. 1972  GND 80      13,00     25,81         15 - 19   14 - 18 (org)
     Huellhorst Bj. 1965  GND 80      19,48     31,49         21 - 25   21 - 25 (org)
     Ref 06644  Bj. 1998  GND 70      22,00     nicht anw.    24 - 28   26 (Gutachten)
     Ref 02661  Bj. 1994  GND 70      20,00     nicht anw.    22 - 26   26 (Gutachten)

   Das technische Verfahren trifft alle vier. Der Wettbewerber liegt bei
   Huellhorst exakt und bei Rinteln ein Jahr daneben - unabhaengig
   gerechnet. Die zehn Jahre Unterschied kamen nicht vom Verfahren,
   sondern vom 30-%-Anker aus Paragraf 185 Abs. 3 Satz 5 BewG, der die
   untere Kante von 15 auf 24 hochgezogen hat. Der ist am 14.09.2026
   entfernt worden (siehe spanneAus).

   Und Anlage 2 als Leitverfahren waere ein zweiter Fehler gewesen: Ihre
   Formel ist erst ab einer Altersschwelle anwendbar. An dieser Schwelle
   sprang das Ergebnis - ein Haus von 1978 bekam 29 bis 35 Jahre, eines
   von 1979 nur 19 bis 23. Gemessen: bis zu 15 Jahre Sprung zugunsten des
   aelteren Gebaeudes. Mit dem technischen Verfahren als Leitwert: null.

   ---------------------------------------------------------------------
   Die Regel
   ---------------------------------------------------------------------
     1. Das technische Verfahren fuehrt. Es ist das einzige, das den
        Zustand der neun Gewerke einzeln bewertet.

     2. Anlage 2 ImmoWertV ist die OBERGRENZE, wo ihre Formel anwendbar
        ist. Genau dort sagt sie, wieviel eine Modernisierung hoechstens
        hergibt - und sie darf dabei ueber "Gesamtnutzungsdauer minus
        Alter" hinausgehen, denn das ist der Sinn des Modells.

        Das war bis zum 14.09.2026 anders und falsch: "GND minus Alter"
        lag als harte Grenze ueber allem und machte aus einem
        modernisierten Gebaeude rechnerisch eines, an dem nie etwas
        gemacht wurde. Huellhorst, Baujahr 1965, sechs
        Modernisierungspunkte, GND 80: Anlage 2 sagt 31,49 Jahre, die
        Grenze sagte 19 - und der Wettbewerber 21 bis 25.

     3. Wo Anlage 2 nicht anwendbar ist, gilt "GND minus Alter". Dort
        gibt es kein Modernisierungsmodell, also kann nicht mehr Rest
        uebrig sein, als rechnerisch uebrig ist. Anlass war eine
        Eigentumswohnung von 1998, die auf 58 bis 68 Jahre kam.

     4. Bei nachgewiesener Kernsanierung fuehrt Anlage 2. Sie ist das
        einzige Verfahren, das eine Kernsanierung ueberhaupt kennt (es
        weitet die Streckungsquote von 70 auf 90 Prozent). Das
        technische Verfahren rechnet weiter mit dem echten Alter und
        gaebe einem kernsanierten Gebaeude von 1965 dasselbe Ergebnis
        wie einem unsanierten.

   Welches Verfahren gefuehrt hat, steht in `verfahren` und geht mit in
   die Anzeige. Kein stiller Rueckfall.

   Diese Funktion steht hier, weil rnd-spanne.js die einzige Datei ist,
   die alle drei Strecken laden: Anfrage-Assistent, ausfuehrliche Strecke
   und Auftragsbogen. Vorher stand dieselbe Fachlogik in zwei Fassungen
   an zwei Stellen - und im Auftragsbogen gar nicht.
   ===================================================================== */
(function (global) {
  'use strict';
  var SP = global.JunkerRND_Spanne;
  if (!SP) return;

  function mitLeitwert(r, wert, verfahren) {
    var neu = {};
    Object.keys(r).forEach(function (k) { neu[k] = r[k]; });
    neu.final_rnd = Math.round(wert * 100) / 100;
    neu.verfahren = verfahren;
    if (r.plausibilitaet) {
      var pl = {};
      Object.keys(r.plausibilitaet).forEach(function (k) { pl[k] = r.plausibilitaet[k]; });
      pl.unterschritten = wert < pl.mindest_30_prozent;
      pl.afa_satz_pct = wert > 0 ? Math.round(10000 / wert) / 100 : null;
      neu.plausibilitaet = pl;
    }
    return neu;
  }

  /* r        Ergebnis von calcAll()
     kern     wurde eine Kernsanierung angegeben?
     Rueckgabe: dasselbe Ergebnis mit Leitwert, Verfahren und Obergrenze. */
  SP.leitwertAn = function (r, kern) {
    if (!r || typeof r.final_rnd !== 'number') return r;
    if (r.verfahren === 'reell' || r.verfahren === 'keines') return r;

    var pr = r.methods && r.methods.punktraster;
    var a2 = (pr && pr.anwendbar && typeof pr.restnutzungsdauer === 'number'
              && pr.restnutzungsdauer > 0) ? pr.restnutzungsdauer : null;
    var gnd = Number(r.input && r.input.gnd) || 0;
    var alter = Number(r.input && r.input.alter);

    // 4. Kernsanierung: Anlage 2 fuehrt, wenn sie mehr hergibt.
    if (kern && a2 !== null && a2 > r.final_rnd) {
      r = mitLeitwert(r, a2, 'punktraster');
    }

    // 2./3. Die Obergrenze - Anlage 2, wo anwendbar, sonst Arithmetik.
    var grenze = a2 !== null
      ? a2
      : (kern ? gnd : Math.max(0, gnd - (isFinite(alter) ? alter : 0)));

    if (gnd > 0) {
      if (r.final_rnd > grenze) {
        r = mitLeitwert(r, grenze,
          a2 !== null ? 'punktraster'
                      : (kern ? 'gesamtnutzungsdauer' : 'gnd_minus_alter'));
      }
      r.__obergrenze = grenze;
    }
    return r;
  };

  /* Alter Name, gleiche Wirkung - damit keine Strecke stehenbleibt, die
     ihn noch ruft. Neue Aufrufe nehmen leitwertAn. */
  SP.deckelAn = SP.leitwertAn;
})(typeof window !== 'undefined' ? window : globalThis);
