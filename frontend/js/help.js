/**
 * help.js — DealPilot User-Hilfe-System V63.70
 *
 * Features:
 * - Modal mit Sidebar-Navigation (Themen-Bereiche)
 * - Suchleiste über alle Inhalte
 * - FAQ und Glossar
 * - Beispiel-Rechnungen
 * - KI-Assistent (Server-Proxy /api/v1/help/ask)
 * - Persistiert offene Themen in localStorage
 */
(function() {
  'use strict';

  // ─── Hilfe-Inhalte: Themen-Baum ─────────────────────────────────────────
  var HELP_TOPICS = [
    {
      id: 'einstieg',
      title: 'Einstieg',
      icon: 'i-rocket',
      desc: 'Erste Schritte mit DealPilot',
      sections: [
        {
          h: 'Was ist DealPilot?',
          body: 'DealPilot ist eine professionelle Investmentanalyse-App für Immobilien. Du gibst Kaufpreis, Miete, Finanzierung und Annahmen ein — DealPilot rechnet vollständige Cashflows über 10–30 Jahre, vergleicht 3 Phasen (Heute / Ende Zinsbindung / Anschluss), bewertet das Investment per DealScore (0–100) und erstellt Bank-taugliche PDF-Reports.'
        },
        {
          h: 'Schnellstart in 4 Schritten',
          body: '1. <strong>Objekt anlegen</strong> — Adresse, Wohnfläche, Kaufpreis im Tab „Objekt".\n\n2. <strong>Mieten & Kosten</strong> — Kaltmiete, Hausgeld, Grundsteuer im Tab „Miete".\n\n3. <strong>Finanzierung</strong> — Darlehensbetrag, Zins, Tilgung, Bindungsdauer im Tab „Finanzierung".\n\n4. <strong>Annahmen prüfen</strong> — Mietsteigerung, Wertsteigerung, Anschlusszins (Voreinstellungen sind konservativ).\n\nDanach hat der Tab „Kennzahlen" alle Renditen, der Tab „PDF" eine Druckvorschau.'
        },
        {
          h: 'Wo speichert DealPilot?',
          body: 'Wenn du angemeldet bist (Account-Modus), werden alle Objekte auf dem Server gespeichert. Im Demo-Modus werden Objekte nur im Browser-Speicher (localStorage) abgelegt — sie gehen beim Browserwechsel verloren. Anmelden lohnt sich.'
        }
      ]
    },
    {
      id: 'kennzahlen',
      title: 'Kennzahlen verstehen',
      icon: 'i-bar',
      desc: 'Bruttomietrendite, Nettomietrendite, DSCR, LTV, Equity Multiple, DealScore',
      sections: [
        {
          h: 'Bruttomietrendite — schnelle Vergleichszahl',
          body: 'Die Bruttomietrendite zeigt dir auf einen Blick, wie viel Miete eine Immobilie pro Jahr in Relation zum Kaufpreis bringt. Sie ist <strong>unbereinigt</strong>: Bewirtschaftungskosten (Hausgeld, Verwaltung, Rücklagen) und Finanzierungskosten (Zinsen) sind nicht abgezogen. Deshalb ist sie <em>kein</em> Maß für deinen tatsächlichen Ertrag — aber ein gutes Werkzeug, um Objekte schnell miteinander zu vergleichen.\n\n<strong>Wofür du sie nutzt:</strong>\n• Erste Einschätzung beim Inserate-Sichten\n• Vergleich zwischen Lagen (A-Stadt vs. B-Stadt)\n• Bewertung des Kaufpreis-Niveaus relativ zu den Mieten\n\n<strong>Typische Werte in Deutschland (Wohnimmobilien als Kapitalanlage):</strong>\n• A-Lagen wie München, Hamburg, Frankfurt: oft 2,5–3,5 % — Preise sind hoch, Renditen entsprechend niedrig\n• B-/C-Städte wie Herford, Dortmund, Kassel: typisch 5–7 % — der „Sweet Spot" für viele Kapitalanleger\n• D-Lagen, Ostdeutschland (z. B. Chemnitz, Halle): teils 7–9 % — höhere Rendite, aber auch höheres Risiko bei Mieter-Stabilität und Wertentwicklung\n\n<strong>Wichtig:</strong> Eine hohe Bruttomietrendite ist nicht automatisch „besser". Sie spiegelt oft eingepreistes Risiko wider. Vergleiche immer mit Nettomietrendite und Lagebewertung.'
        },
        {
          h: 'Nettomietrendite — der ehrlichere Renditewert',
          body: 'Die Nettomietrendite ist die <strong>realistische Variante</strong> der Bruttomietrendite. Hier werden zwei Dinge anders gerechnet:\n\n<strong>1. Bewirtschaftungskosten werden abgezogen.</strong> Das ist der Teil des Hausgelds, den der Vermieter selbst trägt (Verwaltung, nicht-umlagefähige Instandhaltung, eigene Rücklage, kalkulierter Mietausfall).\n\n<strong>2. Statt nur dem Kaufpreis wird die Gesamtinvestition verwendet.</strong> Das heißt: Notar, Grundbuch, Grunderwerbsteuer, Maklerprovision, ggf. Sanierung — alles, was du wirklich aufbringen musst, um die Immobilie betriebsbereit zu haben.\n\nDeshalb liegt die Nettomietrendite immer unter der Bruttomietrendite — meist 1,5 bis 2,5 Prozentpunkte darunter.\n\n<strong>Faustregeln:</strong>\n• Unter 3,0 % — wenig Substanz, fast nur Wertsteigerungs-Spekulation\n• 3,0–4,0 % — schwach, nur in Top-Lage akzeptabel\n• 4,0–5,0 % — solide, klassischer Kapitalanleger-Bereich\n• Über 5,0 % — attraktiv, oft B-Lage oder Sondersituation\n\n<strong>Tipp:</strong> Wenn die Nettomietrendite weniger als zwei Prozentpunkte über deinem Sollzins liegt, arbeitet die Immobilie operativ kaum für dich — dann lebst du fast ausschließlich von Tilgung und Hoffnung auf Wertsteigerung.'
        },
        {
          h: 'DSCR — Schuldendienstdeckung (die Bank-Kennzahl)',
          body: 'Die DSCR (Debt Service Coverage Ratio) beantwortet eine einzige, aber zentrale Frage: <strong>Reicht die Miete, um Zins und Tilgung zu bezahlen?</strong>\n\nEin Wert von 1,00 bedeutet: Die Miete deckt den Kapitaldienst exakt. Bei 1,25 deckt die Miete den Kapitaldienst um 25 % über — du hast also einen Puffer von 25 %, falls Mietausfall, Reparaturen oder Zinserhöhungen kommen.\n\nDie Bank schaut bei der Kreditprüfung zuerst auf diese Zahl, weil sie aussagt, ob das Objekt sich „selbst trägt" oder ob du es aus eigener Tasche querfinanzieren musst.\n\n<strong>🔴 KRITISCH — DSCR unter 1,0:</strong>\nDie Miete reicht nicht aus, um den Schuldendienst zu bedienen. Du musst monatlich aus eigenem Einkommen zuschießen. Banken finanzieren das nur mit hohem Eigenkapital oder zusätzlichen Sicherheiten — und meist mit Zinsaufschlag. Strategisch nur sinnvoll, wenn die Wertsteigerungs-Story sehr stark ist oder du das Objekt schnell aufwerten kannst.\n\n<strong>🟡 KNAPP — DSCR zwischen 1,0 und 1,2:</strong>\nDie Bedienung ist gerade so gedeckt, der Puffer ist klein. Bei kleineren Mietausfällen, Reparaturen oder Zinserhöhungen kann die Finanzierung schnell unter Druck geraten. Banken finanzieren das, prüfen aber strenger und fordern oft höhere Tilgungsraten.\n\n<strong>🟢 SOLIDE — DSCR ab 1,2:</strong>\nDer Banken-Standard. Tilgung und Zins sind komfortabel gedeckt, es gibt einen ausreichenden Puffer. Bei DSCR ab 1,5 spricht man von „sehr solide" — hier verhandeln Banken auch bessere Konditionen, weil das Risiko niedrig ist.\n\n<strong>Bei Tilgungsaussetzung mit Bausparvertrag:</strong> Die Bausparrate wird in der DSCR mitgerechnet. Sie ist wirtschaftlich nichts anderes als Tilgung, nur an einen anderen Vertrag gerichtet. Würde sie nicht mitgerechnet, wäre der DSCR künstlich hoch und du würdest die Anschlussfinanzierungs-Lücke nicht sehen.'
        },
        {
          h: 'LTV — Beleihungsauslauf (DealPilot-Bewertungsskala)',
          body: 'Der LTV (Loan to Value, Beleihungsauslauf) zeigt das Verhältnis zwischen Darlehenssumme und Marktwert (oder Kaufpreis) der Immobilie. Er ist die wichtigste Risiko-Kennzahl aus Sicht der Bank, weil er angibt, wie viel Sicherheitsabstand zwischen Schulden und Immobilienwert liegt.\n\nDer Beleihungswert ist standardmäßig der Kaufpreis. Liegt ein Verkehrswertgutachten vor, wird der Verkehrswert verwendet. Wenn die Bank höher bewertet als der Kaufpreis, kann auch die Bankbewertung als Anker dienen.\n\nDealPilot verwendet eine eigene, an der deutschen Kapitalanleger-Praxis orientierte Bewertungsskala:\n\n<strong>🟢 SOLIDE — LTV unter 85 %:</strong>\nMarktüblicher und bankenseitig meist gut darstellbarer Finanzierungsbereich für Kapitalanleger in Deutschland. Bietet in der Regel eine solide Sicherheitsreserve und gute Finanzierungskonditionen. Ein LTV zwischen 80 % und 85 % gilt ausdrücklich <strong>nicht als „hoch"</strong>, sondern als übliche Investmentfinanzierung. In diesem Bereich finden die meisten Kapitalanleger ihre Standard-Finanzierung — die Bank verlangt keine Aufschläge, prüft aber natürlich Bonität und Cashflow-Tragfähigkeit.\n\n<strong>🟡 ERHÖHT — LTV zwischen 85 % und 100 %:</strong>\nErhöhte Fremdkapitalquote mit geringerer Sicherheitsreserve. Die Finanzierung reagiert sensibler auf Marktveränderungen, Zinsanstiege oder Leerstand. Banken prüfen solche Finanzierungen häufig strenger und Konditionen können sich verschlechtern — typischerweise mit Zinsaufschlägen von 0,2 bis 0,5 Prozentpunkten oder zusätzlichen Tilgungsanforderungen. Bei einem LTV nahe 100 % wird oft eine zweite Sicherheit (zweite Immobilie, Lebensversicherung) verlangt.\n\n<strong>🔴 KRITISCH — LTV über 100 %:</strong>\nSehr hohe bzw. vollständige Fremdfinanzierung mit erhöhter finanzieller Belastung und geringer Absicherung. Bereits kleinere Marktwertverluste oder unerwartete Kosten können die Finanzierung deutlich belasten. Anschlussfinanzierungen und Nachbewertungen können problematisch werden — wenn der Marktwert in zehn Jahren niedriger liegt als erwartet, kann die Bank Nachbesicherung verlangen oder die Anschlussfinanzierung verweigern.\n\n<strong>Hinweis zur DealPilot-Skala:</strong> Diese Schwellen orientieren sich an der Praxis deutscher Privatbanken und Sparkassen für Kapitalanlage-Finanzierungen. Sie sind bewusst etwas großzügiger als typische US-amerikanische Skalen, die oft schon ab 80 % von „erhöht" sprechen — weil im deutschen Markt 80–85 % LTV bei guter Bonität die übliche Finanzierungsstruktur ist.'
        },
        {
          h: 'Cashflow — was am Monatsende übrig bleibt',
          body: 'Der monatliche Cashflow ist das, was nach Abzug aller laufenden Kosten von der Miete übrig bleibt. Es ist die Zahl, die du wirklich auf dem Konto siehst — nicht die theoretische Rendite.\n\nDealPilot rechnet den Cashflow in mehreren Stufen:\n\n<strong>Bruttomiete</strong> (Kaltmiete + umlagefähige Bewirtschaftungs-Erstattung)\n<strong>− Bewirtschaftung umlagefähig</strong> (durchlaufender Posten)\n= Kaltmiete\n<strong>− Bewirtschaftung nicht-umlagefähig</strong> (Hausgeld-Anteil, eigene Rücklage)\n= Net Operating Income (NOI)\n<strong>− Zinsen</strong>\n= CF nach Zinsen, vor Tilgung\n<strong>− Tilgung</strong>\n= CF vor Steuern\n<strong>± Steuern</strong>\n= CF nach Steuern (was wirklich übrig bleibt)\n\n<strong>Wichtig:</strong> In der Frühphase ist der CF nach Steuern oft kleiner als der CF vor Steuern — weil die Steuererstattung aus den V+V-Verlusten den positiven Cashflow ergänzt. Mit zunehmender Tilgung sinkt die AfA-Bedeutung, der zu versteuernde Gewinn steigt, und die Steuerlast verschiebt sich.\n\n<strong>Faustregeln:</strong>\n• Negativer CF nach Steuern: kritisch — du musst monatlich zuschießen\n• 0–50 €/Monat: knapp, kleiner Reparaturfall kippt die Rechnung\n• 50–150 €/Monat: solide für eine Standard-Wohnung\n• Über 150 €/Monat: stark — zeigt entweder gute Lage, hohen Eigenkapital-Einsatz oder geringe Finanzierung'
        },
        {
          h: 'Equity Multiple — Hebelwirkung deines Kapitals',
          body: 'Der Equity Multiple zeigt, wie oft sich dein eingesetztes Eigenkapital nach dem Betrachtungszeitraum (typisch 10 Jahre) zurückgespielt hat. Er ist die Antwort auf die Frage: <strong>Was habe ich aus dem Geld gemacht, das ich reingesteckt habe?</strong>\n\nEin Equity Multiple von 2,0x bedeutet: Aus jedem Euro Eigenkapital sind 2 Euro Vermögen geworden — Eigenkapital + Gewinn. Bei 3,0x sind es 3 Euro, bei 4,0x sind es 4 Euro.\n\n<strong>Spezialfall Vollfinanzierung:</strong> Bei einem Eigenkapital von 0 € (oder sehr geringem Eigenkapital) ist der Equity Multiple mathematisch unendlich groß — DealPilot zeigt dann das Symbol ∞ oder „Multiple". Das ist kein Fehler, sondern Ausdruck davon, dass aus „nichts" etwas geworden ist. In dem Fall sind andere Kennzahlen (Vermögenszuwachs absolut, Cashflow) aussagekräftiger.\n\n<strong>Typische Werte über 10 Jahre:</strong>\n• Unter 1,5x — schwach, das Kapital hätte man besser anders investiert\n• 1,5–2,5x — solide, vergleichbar mit konservativen ETF-Renditen\n• 2,5–4,0x — stark, durch Hebel-Effekt der Finanzierung\n• Über 4,0x — sehr stark, oft mit niedrigem EK-Einsatz oder besonders gutem Markt-Timing'
        },
        {
          h: 'Wertpuffer — Sicherheitsreserve gegen Marktwertverlust',
          body: 'Der Wertpuffer ist die Differenz zwischen dem ermittelten Marktwert (Verkehrswert oder Bankbewertung) und deinem Kaufpreis. Er ist ein Maß dafür, <strong>wie viel die Immobilie wert verlieren könnte, bevor du in eine kritische Lage gerätst</strong>.\n\nWenn ein Verkehrswertgutachten 250.000 € ergibt und du die Immobilie für 220.000 € kaufst, hast du einen sofortigen Wertpuffer von 30.000 €. Das bedeutet: Selbst wenn der Markt um etwa 12 % einbricht, deckt der Verkehrswert deine Schulden noch.\n\n<strong>Warum das wichtig ist:</strong>\n• Bei Anschlussfinanzierungen schaut die Bank auf den aktuellen Marktwert. Ein Wertpuffer wirkt wie ein Polster.\n• Bei einem Notverkauf entscheidet der Marktwert über deinen Erlös — der Wertpuffer ist deine Sicherheitsmarge.\n• Bei der Finanzierungsstruktur entscheidet er über den effektiven LTV — manche Banken finanzieren bis 100 % vom Kaufpreis, aber nur bis 80 % vom Verkehrswert.\n\n<strong>Daumenregel:</strong> Ein Wertpuffer von mindestens 10 % gilt als angemessen, ab 15 % als komfortabel.'
        },
        {
          h: 'Faktor — die einfache Marktorientierung',
          body: 'Der Faktor ist eine in der deutschen Immobilienbranche sehr verbreitete Kennzahl, oft auch „Multiplikator" oder „Vervielfältiger" genannt. Er gibt an, wie oft die jährliche Kaltmiete im Kaufpreis enthalten ist.\n\nEin Faktor von 20 bedeutet: Der Kaufpreis entspricht 20 Jahresmieten. Anders gesagt: Du brauchst 20 Jahre Vollvermietung (ohne Kosten), um den Kaufpreis zurückzuverdienen.\n\n<strong>Der Faktor ist das Spiegelbild der Bruttomietrendite:</strong> Faktor 20 entspricht etwa 5 % Bruttomietrendite, Faktor 25 etwa 4 %, Faktor 30 etwa 3,3 %, Faktor 40 etwa 2,5 %.\n\n<strong>Typische Faktoren in Deutschland:</strong>\n• A-Lagen: 30–40 (München teils >40)\n• B-/C-Lagen: 15–22\n• D-Lagen, schwierige Märkte: 12–18\n\n<strong>Wofür Makler und Investoren ihn nutzen:</strong> Schnelle Einordnung beim Inserat-Sichten — „Ist der Faktor angemessen für die Lage?" Wenn ein Objekt in einer B-Stadt für Faktor 28 angeboten wird, lohnt sich der Vergleich mit ähnlichen Objekten genauer.'
        },
        {
          h: 'EK-Rendite — was dein Eigenkapital wirklich erwirtschaftet',
          body: 'Die Eigenkapital-Rendite (EK-Rendite p.a.) zeigt die jährliche Rendite, die dein <strong>eingesetztes Eigenkapital</strong> über den Betrachtungszeitraum (typisch 10 Jahre) erwirtschaftet. Sie ist die ehrlichste Antwort auf die Frage: <em>„Was bringt mir das Investment, gemessen am Geld, das ich tatsächlich aus eigener Tasche eingebracht habe?"</em>\n\nDie EK-Rendite berücksichtigt:\n• Alle laufenden Cashflows nach Steuern\n• Die Tilgung (Vermögensaufbau durch den Mieter)\n• Die Wertsteigerung der Immobilie\n• Den Steuervorteil aus V+V-Verlusten\n\nGerade bei Immobilien-Investments mit Hebel kann die EK-Rendite deutlich höher liegen als die reine Mietrendite — weil ein Teil der Wertsteigerung und Tilgung auf Eigenkapital wirkt, das nur einen Bruchteil des Gesamtwerts darstellt.\n\n<strong>Spezialfall Vollfinanzierung:</strong> Wie der Equity Multiple wird auch die EK-Rendite bei null oder sehr geringem Eigenkapital sehr hoch oder mathematisch unendlich. In diesen Fällen sind absolute Cashflows und Vermögenszuwachs aussagekräftiger.\n\n<strong>Typische Werte über 10 Jahre (deutsche Wohnimmobilien):</strong>\n• Unter 4 % — schwach\n• 4–8 % — solide\n• 8–15 % — attraktiv\n• Über 15 % — starker Hebel-Effekt, meist niedriger EK-Einsatz'
        },
        {
          h: 'Zinsrisiko — was die Anschlussfinanzierung kostet',
          body: 'Das Zinsrisiko ist die Differenz zwischen deiner heutigen monatlichen Rate und der hochgerechneten Rate nach Ablauf der Zinsbindung. Es zeigt dir, <strong>wie stark die monatliche Belastung steigen würde</strong>, wenn die Anschlussfinanzierung zu höheren Zinsen abgeschlossen werden müsste.\n\nDealPilot rechnet standardmäßig mit einem konservativen Anschlusszins-Szenario (typisch 5,0 %), das einen Puffer über dem aktuellen Marktniveau enthält. Das Zinsrisiko zeigt also: <em>„Wenn die Zinsen sich am oberen Ende einpendeln, wie viel mehr zahle ich dann pro Monat?"</em>\n\n<strong>Beispiel:</strong> Heute 750 €/Monat bei 3,5 % Zins, in 10 Jahren bei 5 % Anschlusszins 883 €/Monat → Zinsrisiko = 133 €/Monat. Das ist die Größenordnung, die du für deine Liquiditätsplanung kalkulieren solltest.\n\n<strong>Wie du das Zinsrisiko reduzieren kannst:</strong>\n• <strong>Längere Zinsbindung</strong> (15 oder 20 Jahre) — schiebt das Risiko nach hinten\n• <strong>Höhere Tilgung</strong> — reduziert die Restschuld bei Bindungsende und damit den absoluten Anstieg\n• <strong>Sondertilgungen</strong> — gleicher Effekt, flexibler\n• <strong>Forward-Darlehen</strong> — du sicherst dir die Anschlusskonditionen 3–5 Jahre vorher fest\n\nDas Zinsrisiko ist eines der unterschätztesten Themen bei Kapitalanlage-Immobilien. Eine Finanzierung kann heute solide aussehen und in 10 Jahren bei +2 Prozentpunkten Anschlusszins kippen.'
        },
        {
          h: 'AfA — Abschreibung als Steuer-Hebel',
          body: 'Die Absetzung für Abnutzung (AfA) ist die steuerlich anerkannte Wertminderung des Gebäudes über seine Nutzungsdauer. Sie reduziert dein zu versteuerndes Einkommen aus Vermietung und Verpachtung — ohne dass dafür Geld fließt. Sie ist also ein <strong>buchhalterischer Verlust</strong>, der echte Steuerersparnis erzeugt.\n\n<strong>So funktioniert es in der Praxis:</strong>\nDu kaufst ein Objekt für 200.000 € (Kaufpreis). Davon entfallen typischerweise 80 % auf das Gebäude, 20 % auf den Grund und Boden (der nicht abgeschrieben werden kann). Bei Standard-AfA von 2 % p.a. auf den Gebäudeanteil schreibst du jährlich 3.200 € steuerlich ab — Jahr für Jahr, über 50 Jahre Nutzungsdauer.\n\n<strong>Wichtig:</strong> Die AfA ist <em>kein</em> Cashflow. Du bekommst keine 3.200 € überwiesen. Aber dein zu versteuerndes Einkommen aus Vermietung sinkt um diesen Betrag. Bei einem persönlichen Grenzsteuersatz von 42 % entspricht das einer Steuerersparnis von etwa 1.344 € pro Jahr.\n\n<strong>AfA-Sätze:</strong>\n• Bestandsgebäude ab Baujahr 1925: 2 % p.a. (50 Jahre Nutzungsdauer)\n• Bestandsgebäude vor 1925: 2,5 % p.a. (40 Jahre)\n• Neubau ab 2023: 3 % p.a. (33 Jahre) — gilt für Wohngebäude mit Bauantrag/Kaufdatum ab 1.1.2023\n\nDie AfA ist der Hauptgrund, warum Immobilieninvestments in den ersten Jahren steuerlich oft Verluste produzieren — und warum du in der Steuererklärung einen Cashflow-Vorteil daraus ziehst.'
        },
        {
          h: 'DealScore (0–100) — die Gesamtbewertung',
          body: 'Der DealScore ist die zusammengefasste Bewertung deines Investments. Er kombiniert acht Einzel-Kennzahlen zu einer Zahl zwischen 0 und 100, mit der du verschiedene Objekte schnell vergleichen kannst.\n\n<strong>Die acht Bausteine:</strong>\n• Cashflow nach Steuern\n• Nettomietrendite\n• Bruttomietrendite\n• DSCR (Schuldendeckung)\n• LTV (Beleihungsauslauf)\n• EK-Rendite p.a.\n• Vermögenszuwachs über 10 Jahre\n• Wertpuffer / Sicherheitsreserve\n\nDie Gewichtung der einzelnen Bausteine kannst du in den Einstellungen unter „Investor Deal Score 2.0" anpassen — je nachdem, ob du eher Cashflow-Investor, Wertsteigerungs-Investor oder sicherheitsorientierter Anleger bist.\n\n<strong>Bedeutung der Bereiche:</strong>\n• <strong>80–100 — Ausgezeichnet:</strong> Klare Kauf-Empfehlung. Alle Hauptkennzahlen liegen im starken Bereich, die Risiken sind überschaubar. Solche Objekte sind selten — wenn du eines findest, schnell handeln.\n• <strong>60–79 — Gut:</strong> Sorgfältig prüfen. Die Hauptkennzahlen sind solide, aber nicht überall stark. Lohnt eine genaue Analyse — oft mit Verhandlungspotenzial.\n• <strong>40–59 — Mittel:</strong> Vorsichtig. Mindestens eine Hauptkennzahl ist im kritischen Bereich. Nur kaufen, wenn du eine konkrete Aufwertungsstrategie hast oder die Lage außergewöhnlich ist.\n• <strong>Unter 40 — Schwach:</strong> Eher ablehnen. Mehrere Kennzahlen schwach, das Risiko-Rendite-Verhältnis stimmt meistens nicht.'
        }
      ]
    },
    {
      id: 'finanzierung',
      title: 'Finanzierung',
      icon: 'i-coins',
      desc: 'Annuität, Tilgungsaussetzung, Bausparen',
      sections: [
        {
          h: 'Annuitätendarlehen (Standard)',
          body: 'Klassische Finanzierung: monatlich konstante Rate aus Zins und Tilgung. Mit der Zeit verschiebt sich das Verhältnis — der Tilgungsanteil wird größer, der Zinsanteil kleiner. Standard-Eingaben: anfängliche Tilgung 1–3 %, Zinsbindung 10–15 Jahre.'
        },
        {
          h: 'Tilgungsaussetzung mit Bausparvertrag',
          body: 'Bei diesem Konstrukt zahlst du in der Sparphase nur Zinsen aufs Hauptdarlehen plus eine Sparrate in den Bausparvertrag. Wenn die Mindestsparquote erreicht ist (typ. 40–50 %), wird der Vertrag <strong>zuteilungsreif</strong>: Sparguthaben + Bauspardarlehen lösen die Restschuld ab. Danach läuft das Bauspardarlehen mit fester Tilgung weiter.\n\n<strong>Wichtig:</strong> Wenn die Zuteilung erst nach Bindungsende kommt, ist eine Anschlussfinanzierung nötig. Das siehst du in der Card unten als gelben Hinweis.'
        },
        {
          h: 'Anschlussfinanzierung',
          body: 'DealPilot rechnet automatisch eine Anschlussphase mit dem in den Annahmen hinterlegten Anschlusszinssatz (Standard 5,0 %, konservativer Puffer über aktuellem Niveau).\n\nDie Anschlussrate erscheint in „Finanzierung", das Zinsänderungsrisiko (Differenz Heute vs. Anschluss) im Tab „Kennzahlen".'
        }
      ]
    },
    {
      id: 'steuer',
      title: 'Steuer-Modul',
      icon: 'i-receipt',
      desc: 'Tarif 2026, AfA, Werbungskosten',
      sections: [
        {
          h: 'Persönlicher Grenzsteuersatz',
          body: 'Wird im Tab „Steuer" aus deinem zu versteuernden Einkommen (zvE) per Tarif 2026 berechnet. Der Grenzsteuersatz ist die Steuerrate auf den letzten Euro deines Einkommens — der zählt für die Steuerersparnis aus Werbungskosten.\n\n<strong>Faustregel:</strong> 30–35 % für mittleres Einkommen, 42 % ab ~67.000 € zvE (Spitzensteuer), 45 % ab 277.000 € (Reichensteuer).'
        },
        {
          h: 'Abschreibung (AfA)',
          body: 'Steuerlich absetzbare Wertminderung des Gebäudes. Standard: 2 % p.a. auf den Gebäudeanteil (=80 % des Kaufpreises), für Bestandsgebäude ab Baujahr 1925 (§ 7 EStG). Neubau ab 2023: 3 % p.a.\n\nDie AfA reduziert das zu versteuernde Einkommen aus Vermietung — sie ist <strong>buchhalterisch</strong>, kein Cashflow.'
        },
        {
          h: 'Werbungskosten-PDF (Finanzamt)',
          body: 'Im Track-Record-Bereich findest du den Button „Werbungskosten-PDF". Dieses PDF listet alle abzugsfähigen Kosten (Zinsen, AfA, Bewirtschaftung) im Format, das das Finanzamt erwartet — direkt zur Anlage V der Steuererklärung.'
        },
        {
          h: 'Disclaimer',
          body: 'DealPilot ist nach § 6 StBerG keine Steuerberatung. Die Berechnungen sind Hilfsmittel — die finale Beurteilung gehört in die Hände eines Steuerberaters.'
        }
      ]
    },
    {
      id: 'pdf',
      title: 'PDF-Export',
      icon: 'i-file-text',
      desc: 'Investment-Case, Bank-Präsentation',
      sections: [
        {
          h: 'PDF-Export (Aktionen → PDF Export)',
          body: 'Erzeugt einen kompletten Investment-Case mit Cover, Executive Summary, Objekt & Finanzierung, 3-Phasen-Vergleich, Cashflow-Projektion über 10 Jahre, Equity-Build-Charts, Wasserfall-Diagramm, Stress-Test, KI-Analyse (sofern erstellt) und Annahmen-Seite.\n\n<strong>Tipp:</strong> Für beste Qualität öffne den Tab „Kennzahlen" einmal kurz vor dem Export — dann sind alle Charts gerendert.'
        },
        {
          h: 'Bank-Präsentations-PDF (Tab Kennzahlen)',
          body: 'Im Tab „Kennzahlen" gibt es einen separaten Button „Bank-Präsentation als PDF". Dieser erzeugt eine fokussierte 5-Seiten-PDF im Querformat mit nur den Bank-relevanten Charts (Equity-Build, Cockpit DSCR/LTV, Waterfall, Stress-Test) — ideal als Anhang für Finanzierungsgespräche.'
        },
        {
          h: 'Free-Plan-Wasserzeichen',
          body: 'Im Free-Plan trägt jedes PDF ein „DealPilot Free"-Wasserzeichen. Im Investor-, Pro- oder Business-Plan ist das weg. Das Wasserzeichen ist halbtransparent und überlagert die Inhalte sichtbar — wie eine Demo-Markierung.'
        }
      ]
    },
    {
      id: 'charts',
      title: 'Charts & Visualisierungen',
      icon: 'i-trending-up',
      desc: 'Equity-Build, Cockpit, Waterfall, Stress-Test',
      sections: [
        {
          h: 'Equity-Build (Vermögensaufbau)',
          body: 'Zwei Linien: <strong>grün</strong> = Marktwert über die Jahre, <strong>rot</strong> = Restschuld. Die Fläche dazwischen ist dein Eigenkapital im Objekt. Eine wachsende Fläche bedeutet: dein Vermögen steigt entweder durch Wertsteigerung (grüne Linie nach oben) oder Tilgung (rote Linie nach unten).'
        },
        {
          h: 'Bank-Cockpit (DSCR & LTV)',
          body: 'Zeigt die zwei Bank-Hauptkennzahlen über den Betrachtungszeitraum: DSCR (Schuldendeckung) sollte ≥ 1,2 sein, LTV (Beleihung) sollte sinken. Die Track-Bars unter den Headline-Werten zeigen, wo du dich auf der Gesund/Krit-Skala befindest.'
        },
        {
          h: 'Waterfall (Vermögenszuwachs)',
          body: 'Zerlegt deinen Gesamtgewinn in 5 Quellen:\n• Tilgung + ggf. Bauspar-Guthaben (Schuldenabbau)\n• Cashflow vor Steuern (kumulierter Mietüberschuss)\n• Steuervorteil oder -last\n• Wertsteigerung (Marktwert minus Anker)\n• Gesamt = der gold-farbene End-Bar\n\nDer Multiple unten zeigt: Aus EK X werden EK+Gewinn Y.'
        },
        {
          h: 'Stress-Test',
          body: '5×5-Matrix: Zinsänderung (−2 bis +5 pp) gegen Mietänderung (−20 % bis +20 %). Jede Zelle zeigt den DSCR im Szenario. Grün ≥ 1,2, Gold 1,0–1,2, Rot &lt; 1,0. Die Mitte (±0/±0) ist dein Base-Case.\n\nResilienz-Check: Wenn auch bei „−10 % Miete UND +1 pp Zins" der DSCR ≥ 1,0 bleibt, bist du Bank-tauglich.'
        }
      ]
    },
    {
      id: 'ki',
      title: 'KI-Analyse',
      icon: 'i-cpu',
      desc: 'KI-gestützte Investment-Bewertung',
      sections: [
        {
          h: 'Was macht die KI?',
          body: 'Sie bekommt deine Objektdaten + Berechnungen + DealScore-Werte und liefert eine strukturierte Analyse: Gesamtbewertung, Stärken, Risiken, Risikoanalyse, Szenarien, Investor-Fit, Empfehlung (Kaufen/Prüfen/Nicht kaufen), Verhandlungsempfehlung mit konkretem Ziel-Kaufpreis, Bank-Argumente und DealPilot-Insight.\n\n<strong>Wichtig:</strong> Die KI recherchiert auch Makro-/Mikrolage und Mietspiegel-Daten zu deiner Stadt — das macht die Analyse ortsspezifisch.'
        },
        {
          h: 'Wie oft kann ich die KI nutzen?',
          body: 'Free-Plan: limitiert pro Monat. Investor/Pro/Business: deutlich mehr Calls. Genaue Limits siehst du in den Einstellungen → Plan.'
        },
        {
          h: 'Persistenz',
          body: 'Die KI-Analyse wird ab V63.69 automatisch beim Objekt gespeichert. Beim erneuten Öffnen siehst du die Analyse direkt — du musst sie nicht neu berechnen lassen. Wenn du frische Daten/Marktanalyse willst, klicke „Analyse erneut starten".'
        }
      ]
    },
    {
      id: 'faq',
      title: 'Häufige Fragen',
      icon: 'i-question',
      desc: 'FAQ',
      sections: [
        {
          h: 'Warum ist die DSCR im Chart anders als auf der Kennzahlen-Karte?',
          body: 'Beide nutzen NOI / Kapitaldienst. Bei Tilgungsaussetzung mit Bausparvertrag wird die Sparrate als wirtschaftlicher Tilgungsersatz mitgerechnet — sonst wäre der DSCR künstlich überhöht (Zinsen-only-Vergleich). Seit V63.68 sind beide Stellen konsistent.'
        },
        {
          h: 'Was ist der „Wert-Anker" in der Wertsteigerung?',
          body: 'Der Startwert für die Wertsteigerungs-Berechnung. Reihenfolge:\n1. Verkehrswert (§ 194 BauGB) wenn vorhanden\n2. Bankbewertung wenn höher als Kaufpreis\n3. Kaufpreis als Fallback\n\nBei einem Schnäppchen mit Kaufpreis 180k aber Verkehrswert 237k startet die Wertsteigerung also bei 237k — sonst würde der Wertpuffer als „Wertsteigerung" doppelt gezählt.'
        },
        {
          h: 'Wie wird die Anschlussfinanzierung simuliert?',
          body: 'DealPilot nimmt die Restschuld am Ende der Zinsbindung und rechnet damit weiter — mit dem in den Annahmen hinterlegten Anschlusszins (Standard 5,0 %) und der Anschluss-Tilgung (Standard 1,0 %). Die Differenz zur aktuellen Rate ist dein Zinsänderungsrisiko pro Monat.'
        },
        {
          h: 'Was bedeutet „Anteil eigene Tasche"?',
          body: 'Summe aller monatlichen Cashflows nach Steuern, die negativ waren — also wo die Mieten und der Steuervorteil zusammen nicht reichten und du nachschießen musstest. Im Vermögenszuwachs wird dieser Betrag von der Brutto-Tilgung abgezogen, weil das Geld ja nicht von „außen" kam.'
        },
        {
          h: 'Werden meine Daten weitergegeben?',
          body: 'Nein. DealPilot speichert deine Objekte ausschließlich auf einem deutschen Server (Hetzner). Die KI-Analyse läuft über einen Server-Proxy mit minimal nötiger Datenmenge — keine Adressen, keine Personennamen. Stripe verarbeitet nur Zahlungsdaten, sieht keine Objektdaten.'
        }
      ]
    },
    {
      id: 'glossar',
      title: 'Glossar',
      icon: 'i-book',
      desc: 'Fachbegriffe von A–Z',
      sections: [
        {
          h: 'AfA (Absetzung für Abnutzung)',
          body: 'Steuerliche Wertminderung des Gebäudes pro Jahr. Standard 2 % auf 80 % des Kaufpreises (Gebäudeanteil).'
        },
        {
          h: 'BWK (Bewirtschaftungskosten)',
          body: 'Laufende Kosten der Immobilie. Aufgeteilt in <strong>umlagefähig</strong> (auf Mieter abwälzbar — Heizung, Wasser, Müll) und <strong>nicht-umlagefähig</strong> (Hausgeld-Verwaltungsanteil, eigene Rücklage, Mietausfall-Kalkulation).'
        },
        {
          h: 'BSV (Bausparvertrag)',
          body: 'Spar- und Darlehensvertrag mit der Bausparkasse. In der Sparphase zahlst du eine Rate ein, bei Erreichen der Mindestsparquote wird der Vertrag zuteilungsreif → Sparguthaben + Bauspardarlehen lösen das Hauptdarlehen ab.'
        },
        {
          h: 'EZB (Ende Zinsbindung)',
          body: 'Datum, an dem die Zinsbindung des Hauptdarlehens ausläuft. Danach beginnt die Anschlussfinanzierung — neuer Zinssatz, neue Konditionen.'
        },
        {
          h: 'GI (Gesamtinvestition)',
          body: 'Kaufpreis + Kaufnebenkosten (Notar, Grunderwerbsteuer, Makler) + Sanierung + Möblierung. Das ist der echte Geldbetrag, den du brauchst.'
        },
        {
          h: 'KNK (Kaufnebenkosten)',
          body: 'In NRW typisch: 6,5 % GrESt + 2,2 % Notar + 0–3,57 % Makler ≈ 9–12 % vom Kaufpreis.'
        },
        {
          h: 'NKM (Nettokaltmiete)',
          body: 'Kaltmiete ohne jegliche Nebenkosten. Basis für Renditerechnungen.'
        },
        {
          h: 'NOI (Net Operating Income)',
          body: 'Kaltmiete minus nicht-umlagefähige Bewirtschaftung. Der „operative Rohgewinn" vor Finanzierung und Steuern.'
        },
        {
          h: 'NMR (Nettomietrendite)',
          body: 'NOI / Gesamtinvestition × 100. Realistischere Rendite als die BMR.'
        },
        {
          h: 'Verkehrswert (§ 194 BauGB)',
          body: 'Marktwert der Immobilie nach Sachverständigem-Gutachten. Höher als Kaufpreis = Wertpuffer / „Schnäppchen-Bonus".'
        },
        {
          h: 'ZE (Zusatz-Erträge)',
          body: 'Erträge außer Kaltmiete: Stellplätze, Werbeflächen, Antennen-Vermietung etc. Werden zu NKM addiert.'
        }
      ]
    }
  ];

  // ─── Modal-HTML ──────────────────────────────────────────────────────
  // V118: Auf Cream-Classic-Look der Settings umgestellt. Sidebar links (Topics-Liste),
  //   Content rechts (Topic-Body). Klassen-Struktur orientiert sich an
  //   .global-view-modal.set-modal-v2.set-modal-cream — damit dieselben Cream-Stiles greifen.
  //   Alte .help-*-Klassen bleiben für JS-Bindings parallel mitgesetzt.
  function _buildHelpModal() {
    if (document.getElementById('help-modal')) return;
    var modal = document.createElement('div');
    modal.id = 'help-modal';
    modal.className = 'help-modal global-view-overlay';
    modal.innerHTML =
      '<div class="help-modal-inner global-view-modal set-modal-v2 set-modal-cream">' +
        // V118: Sidebar links (wie Settings) — Header + Topics-Liste + Search-Foot
        '<aside class="modal-side help-modal-side">' +
          '<div class="ms-h">' +
            '<div class="ms-title">' +
              '<span class="ic"><svg width="18" height="18"><use href="#i-help"/></svg></span>' +
              '<span class="gold">DealPilot Hilfe</span>' +
            '</div>' +
            '<div class="ms-sub">Begriffe, Kennzahlen, Praxis-Wissen</div>' +
          '</div>' +
          '<div class="help-modal-search">' +
            '<input type="text" id="help-search-input" placeholder="🔍 Suchen — DSCR, Tilgung, Steuer, Bausparen…" autocomplete="off">' +
          '</div>' +
          '<div class="settings-tabs ms-tabs help-sidebar-list" id="help-sidebar"></div>' +
        '</aside>' +

        // V118: Content rechts (wie Settings) — X-Button + Pane + AI-Bar als Footer
        '<div class="set-modal-content help-modal-content">' +
          '<button type="button" class="set-modal-close" onclick="hideHelp()" aria-label="Schließen" title="Schließen (ESC)">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          '</button>' +
          '<div class="pane-wrap help-content-wrap">' +
            '<main class="help-content" id="help-content"></main>' +
          '</div>' +
          '<div class="help-modal-foot help-ai-foot">' +
            '<div class="help-ai-bar" id="help-ai-bar">' +
              '<input type="text" id="help-ai-input" placeholder="✦ Frag den DealPilot-Assistenten — z.B. ‚Wann lohnt sich Tilgungsaussetzung?‘">' +
              '<button class="help-ai-btn" type="button" id="help-ai-btn" onclick="helpAskAI()">Fragen</button>' +
            '</div>' +
            '<div class="help-ai-response" id="help-ai-response"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    // Sidebar rendern — V118: nutzt Settings-Tab-Optik (.st-tab.ms-tab)
    // V120: SVG-Icons (Sprite-Refs) statt Emojis
    var sidebar = document.getElementById('help-sidebar');
    HELP_TOPICS.forEach(function(t, i) {
      var item = document.createElement('button');
      item.type = 'button';
      // help-sidebar-item bleibt für die JS-Bindings, ms-tab+st-tab für Settings-Look
      item.className = 'help-sidebar-item st-tab ms-tab' + (i === 0 ? ' help-sidebar-item-active active' : '');
      item.setAttribute('data-topic', t.id);
      var iconHtml = t.icon
        ? '<span class="help-sidebar-item-icon"><svg width="16" height="16" viewBox="0 0 24 24"><use href="#' + t.icon + '"/></svg></span>'
        : '';
      item.innerHTML =
        '<div class="help-sidebar-item-row">' +
          iconHtml +
          '<span class="help-sidebar-item-title">' + _escHtml(t.title) + '</span>' +
        '</div>' +
        '<span class="help-sidebar-item-desc">' + _escHtml(t.desc) + '</span>';
      item.onclick = function() { _selectTopic(t.id); };
      sidebar.appendChild(item);
    });

    _renderTopic(HELP_TOPICS[0]);

    // Such-Eingabe
    document.getElementById('help-search-input').addEventListener('input', _onSearch);
    document.getElementById('help-ai-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') helpAskAI();
    });

    // Close bei ESC oder Click auf Backdrop
    modal.addEventListener('click', function(e) {
      if (e.target === modal) hideHelp();
    });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.classList.contains('help-modal-open')) hideHelp();
    });
  }

  function _escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Body-Text mit erlaubtem Markup (<strong>, \n→<br>) sicher rendern
  function _renderBody(s) {
    if (!s) return '';
    var safe = String(s)
      .replace(/&(?!(amp|lt|gt|quot);)/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Erlaubte Tags zurückbringen
    safe = safe
      .replace(/&lt;strong&gt;/g, '<strong>').replace(/&lt;\/strong&gt;/g, '</strong>')
      .replace(/&lt;em&gt;/g, '<em>').replace(/&lt;\/em&gt;/g, '</em>')
      .replace(/&lt;code&gt;/g, '<code>').replace(/&lt;\/code&gt;/g, '</code>')
      // Newlines → <br> und doppelte → Absatz-Trenner
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return '<p>' + safe + '</p>';
  }

  function _selectTopic(id) {
    var topic = HELP_TOPICS.find(function(t) { return t.id === id; });
    if (!topic) return;
    document.querySelectorAll('.help-sidebar-item').forEach(function(b) {
      var isActive = b.getAttribute('data-topic') === id;
      b.classList.toggle('help-sidebar-item-active', isActive);
      b.classList.toggle('active', isActive);  // V118: Settings-Tab-Stil
    });
    _renderTopic(topic);
    try { localStorage.setItem('dp_help_last_topic', id); } catch(e) {}
  }

  function _renderTopic(topic) {
    var c = document.getElementById('help-content');
    if (!c) return;
    // V120: SVG-Icon vor dem Topic-Titel
    var iconHtml = topic.icon
      ? '<span class="help-topic-icon"><svg width="22" height="22" viewBox="0 0 24 24"><use href="#' + topic.icon + '"/></svg></span>'
      : '';
    var html = '<div class="help-topic-head">' +
      '<div class="help-topic-head-row">' +
        iconHtml +
        '<h2>' + _escHtml(topic.title) + '</h2>' +
      '</div>' +
      '<p class="help-topic-desc">' + _escHtml(topic.desc) + '</p>' +
    '</div>';
    topic.sections.forEach(function(s) {
      html += '<div class="help-section">' +
        '<h3>' + _escHtml(s.h) + '</h3>' +
        '<div class="help-section-body">' + _renderBody(s.body) + '</div>' +
      '</div>';
    });
    c.innerHTML = html;
    c.scrollTop = 0;
  }

  // ─── Suche ──────────────────────────────────────────────────────────
  function _onSearch(e) {
    var q = (e.target.value || '').trim().toLowerCase();
    if (q.length < 2) {
      // Suche zurücksetzen → letztes Topic wieder anzeigen
      var lastId = HELP_TOPICS[0].id;
      try { lastId = localStorage.getItem('dp_help_last_topic') || lastId; } catch(_) {}
      _selectTopic(lastId);
      return;
    }
    // Treffer in allen Sections sammeln
    var hits = [];
    HELP_TOPICS.forEach(function(t) {
      t.sections.forEach(function(s) {
        var blob = (s.h + ' ' + s.body).toLowerCase();
        if (blob.indexOf(q) >= 0) hits.push({ topic: t, section: s });
      });
    });
    var c = document.getElementById('help-content');
    if (!c) return;
    if (!hits.length) {
      c.innerHTML = '<div class="help-empty">' +
        '<h2>Keine Treffer für „' + _escHtml(q) + '"</h2>' +
        '<p>Versuche es mit einem anderen Begriff oder frag unten den KI-Assistenten — der findet auch ohne exaktes Wort eine Antwort.</p>' +
        '</div>';
      return;
    }
    var html = '<div class="help-topic-head">' +
      '<h2>🔍 ' + hits.length + ' Treffer für „' + _escHtml(q) + '"</h2>' +
    '</div>';
    hits.forEach(function(hit) {
      html += '<div class="help-section help-section-hit">' +
        '<div class="help-hit-topic">' + _escHtml(hit.topic.title) + '</div>' +
        '<h3>' + _escHtml(hit.section.h) + '</h3>' +
        '<div class="help-section-body">' + _renderBody(hit.section.body) + '</div>' +
      '</div>';
    });
    c.innerHTML = html;
    c.scrollTop = 0;
  }

  // ─── KI-Assistent ─────────────────────────────────────────────────────
  function helpAskAI() {
    var input = document.getElementById('help-ai-input');
    var resp  = document.getElementById('help-ai-response');
    var btn   = document.getElementById('help-ai-btn');
    if (!input || !resp || !btn) return;
    var q = (input.value || '').trim();
    if (!q) {
      resp.innerHTML = '<div class="help-ai-hint">Stelle eine Frage oben — der Assistent kennt DealPilot, Investment-Kennzahlen und deutsche Immobilien-Steuern.</div>';
      return;
    }
    btn.disabled = true;
    btn.textContent = '⏳';
    resp.innerHTML = '<div class="help-ai-loading">' +
      '<span class="help-ai-dot"></span><span class="help-ai-dot"></span><span class="help-ai-dot"></span>' +
      '<span class="help-ai-loading-text">Assistent denkt nach…</span>' +
    '</div>';

    _callHelpAI(q).then(function(answer) {
      resp.innerHTML = '<div class="help-ai-answer">' +
        '<div class="help-ai-answer-q"><strong>Du fragst:</strong> ' + _escHtml(q) + '</div>' +
        '<div class="help-ai-answer-a">' + _renderBody(answer) + '</div>' +
      '</div>';
    }).catch(function(err) {
      resp.innerHTML = '<div class="help-ai-error">' +
        '⚠ Der Assistent konnte gerade nicht antworten: ' + _escHtml(err.message || 'unbekannter Fehler') + '<br>' +
        '<span class="help-ai-error-hint">Wenn das öfter passiert: schau in den anderen Themen oben — die meisten Fragen sind dort schon beantwortet.</span>' +
      '</div>';
    }).then(function() {
      btn.disabled = false;
      btn.textContent = 'Fragen';
    });
  }

  // Server-Proxy zum KI-Endpoint. Wenn Auth verfügbar, nutzen wir es.
  // Fallback: Lokale FAQ-Suche wenn keine Auth/keine API.
  function _callHelpAI(question) {
    return new Promise(function(resolve, reject) {
      // V63.70: Reuse OpenAI-Endpoint mit Help-Modus
      // Backend kann das später als eigenen /help/ask routen — Frontend ist robust.
      if (typeof Auth !== 'undefined' && Auth.apiCall && Auth.isApiMode && Auth.isApiMode()) {
        Auth.apiCall('/ai/help', { method: 'POST', body: { question: question } })
          .then(function(data) {
            if (data && data.answer) resolve(data.answer);
            else if (data && data.text) resolve(data.text);
            else reject(new Error('Antwort vom Server hatte kein Format'));
          })
          .catch(function(e) {
            // Wenn /ai/help noch nicht existiert, Lokal-Fallback
            if (e && (e.status === 404 || e.status === 405)) {
              resolve(_localFallback(question));
            } else {
              reject(e);
            }
          });
      } else {
        resolve(_localFallback(question));
      }
    });
  }

  // Lokaler Fallback: Sucht in den Help-Topics nach dem besten Treffer
  function _localFallback(question) {
    var q = question.toLowerCase();
    var best = null;
    var bestScore = 0;
    HELP_TOPICS.forEach(function(t) {
      t.sections.forEach(function(s) {
        var blob = (s.h + ' ' + s.body).toLowerCase();
        var score = 0;
        // Punkte für jedes Wort der Frage das im Section vorkommt
        q.split(/\s+/).forEach(function(w) {
          if (w.length >= 3 && blob.indexOf(w) >= 0) score += 1;
          // Header-Match doppelt gewichten
          if (w.length >= 3 && s.h.toLowerCase().indexOf(w) >= 0) score += 2;
        });
        if (score > bestScore) { bestScore = score; best = { topic: t, section: s }; }
      });
    });
    if (best && bestScore >= 1) {
      return '<strong>Aus „' + best.topic.title + ' · ' + best.section.h + '":</strong>\n\n' +
        best.section.body +
        '\n\n<em>Hinweis: Der KI-Assistent ist gerade offline — diese Antwort kommt aus dem lokalen Hilfe-Index. Für eine personalisierte KI-Antwort melde dich an.</em>';
    }
    return 'Ich konnte zu deiner Frage keinen Treffer in der Hilfe finden. Versuche die Suchleiste oben mit einem konkreten Begriff (z.B. „DSCR", „Tilgungsaussetzung", „AfA") — dort findest du strukturierte Erklärungen.';
  }

  // ─── Public API ─────────────────────────────────────────────────────
  function showHelp() {
    _buildHelpModal();
    var m = document.getElementById('help-modal');
    if (m) {
      m.classList.add('help-modal-open');
      // Letztes Thema wiederherstellen
      var lastId = null;
      try { lastId = localStorage.getItem('dp_help_last_topic'); } catch(e) {}
      if (lastId) {
        var t = HELP_TOPICS.find(function(x) { return x.id === lastId; });
        if (t) _selectTopic(lastId);
      }
      // Such-Feld fokussieren
      setTimeout(function() {
        var inp = document.getElementById('help-search-input');
        if (inp) inp.focus();
      }, 50);
    }
  }
  function hideHelp() {
    var m = document.getElementById('help-modal');
    if (m) m.classList.remove('help-modal-open');
  }

  window.showHelp = showHelp;
  window.hideHelp = hideHelp;
  window.helpAskAI = helpAskAI;
})();
