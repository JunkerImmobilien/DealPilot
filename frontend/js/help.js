/* BlockA3: Tour-Banner */
/* BlockA2: Korrekturen */
/* BlockA: Hilfe-Modal Fixes */
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
    /* v2200 · N63.1: „Einstieg“ ist hier aufgegangen (Marcel: „Einstieg und Abläufe und Pilot … den Einstieg da mit rein integrieren“) */
    {
      id: 'ablaeufe',
      title: 'Einstieg, Abläufe & Pilot',
      icon: 'i-route',
      desc: 'Erste Schritte, alle Abläufe, der Pilot auf F1',
      sections: [
        {
          h: 'Was ist DealPilot?',
          body: 'DealPilot ist eine professionelle Investmentanalyse-App für Immobilien. Du gibst Kaufpreis, Miete, Finanzierung und Annahmen ein — DealPilot rechnet vollständige Cashflows über einen frei wählbaren Zeitraum (5 bis 50 Jahre, vorbelegt 15), vergleicht 3 Phasen (Heute / Ende Zinsbindung / Anschluss), bewertet das Investment per DealScore (0–100) und erstellt Bank-taugliche PDF-Reports.'
        },
        {
          h: 'Schnellstart in 4 Schritten',
          body: '1. <strong>Quick-Check</strong> — ein Inserat in einer Minute einordnen. Lohnt es sich, „Als Objekt speichern“.\n\n2. <strong>Datenaufnahme</strong> — die Reiter Objekt, Investition, Miete, Finanzierung, Bewirtschaftung und Steuer. Vom Groben zum Feinen; was fehlt, nennt DealPilot statt es zu schätzen.\n\n3. <strong>Bewerten</strong> — Pilot-Analyse, Reiter Bewertung, Marktbericht bis zur Wertermittlung nach ImmoWertV.\n\n4. <strong>Deal-Aktion</strong> — bereit für die Bank, Status Offen · Gewonnen · Verloren. Gewonnen friert den Ankauf-Stand zum Nutzen-/Lastenwechsel ein.\n\n<strong>Tipp:</strong> Drück überall <strong>F1</strong> oder <strong>?</strong> — der Pilot erklärt das Feld, auf dem du gerade bist, und beantwortet Fragen. Alle Abläufe als Netzplan stehen im Thema „Abläufe & Pilot“.'
        },
        {
          h: 'Der Pilot — Hilfe auf Tastendruck',
          body: 'Drück <strong>F1</strong> — oder <strong>?</strong>, wenn du gerade nicht in einem Feld tippst. Der Pilot fliegt zu dem Feld, auf dem Maus oder Cursor stehen, erklärt es und zeigt, wofür es gebraucht wird.\n\nDarunter fragst du einfach, was du wissen willst. Die Sofort-Antworten kommen ohne KI aus Hilfe, Feld-Erklärungen und Abläufen — mit „Zeig mir das Feld“ springt er an die Stelle. Reicht das nicht, beantwortet „Den Piloten fragen“ die Frage mit KI und kennt dabei dein geöffnetes Objekt.\n\nDer Pilot sitzt unten links. Ein Klick auf ihn öffnet ihn auch ohne Taste — so geht es auch auf dem Handy.'
        },
        {
          h: 'Der Prozess-Atlas',
          body: 'Sieben Abläufe als Netzplan: die ganze Reise vom Inserat bis zum Portfolio, der Quick-Check, der Netzplan der Datenaufnahme, der Deal bis „gewonnen“, das Steuerjahr, der Marktbericht und woraus die Scores bestehen.\n\nKlick eine Station an: die Schritte klappen auf, die Eingaben fliegen ein, die Ergebnisse erscheinen. „Ablauf abspielen“ geht alle Stationen nacheinander durch, „Hinfliegen“ öffnet die Stelle in der App. Grün markiert ist, wo dein geöffnetes Objekt gerade steht.'
        },
        {
          h: 'Die Reise in drei Phasen',
          body: '<strong>Pre-Flight · Quick-Check</strong> — Inserat erfassen, Marktpreis einholen, Urteil lesen und als Objekt speichern.\n\n<strong>Boarding · Ankauf</strong> — Datenaufnahme in Etappen, Wert ermitteln (Marktbericht Stufe 3), bereit für die Bank.\n\n<strong>Reiseflug · Bestand</strong> — auf „Gewonnen“ wird der Ankauf-Stand zum Nutzen-/Lastenwechsel eingefroren; danach pflegst du das Ist, und das Portfolio-Cockpit steuert alle Objekte zusammen.'
        },
        {
          h: 'Tastenkürzel',
          body: '<strong>F1</strong> — Pilot rufen, überall (auch im Quick-Check-Fenster).\n<strong>?</strong> — Pilot rufen, wenn kein Eingabefeld aktiv ist.\n<strong>Pfeiltasten</strong> und <strong>Enter</strong> — im Tower durch die Treffer gehen und öffnen.\n<strong>Esc</strong> — Tower, Atlas oder Hilfe schließen.'
        },
        {
          h: 'Wo speichert DealPilot?',
          body: 'Wenn du angemeldet bist (Account-Modus), werden alle Objekte auf dem Server gespeichert. Im Demo-Modus werden Objekte nur im Browser-Speicher (localStorage) abgelegt — sie gehen beim Browserwechsel verloren. Anmelden lohnt sich.'
        }
      ]
    },
    /* v2189: vertiefte Themen, Texte am Code belegt (Beleg-Liste im Journal) */
    {
      id: 'reiter',
      title: 'Die Reiter im Objekt',
      icon: 'i-layers',
      desc: 'Was du in welchem Reiter eingibst und was daraus wird',
      sections: [
        {
          h: 'Objekt — Grunddaten, Lage und Eingabetiefe',
          body: 'Hier beginnt jedes Objekt: <strong>PLZ</strong>, <strong>Ort</strong>, <strong>Straße</strong>, <strong>Hausnummer</strong>, <strong>Objektart</strong>, <strong>Wohnfläche (m²)</strong> und <strong>Baujahr</strong>. Dazu kommen Zimmer, Zustand, Standardstufe (NHK 2010), Energieklasse, Vermietungsstand und die Wertanker (<strong>Bankbewertung</strong>, <strong>Verkehrswert</strong>).\n\n<strong>Eingabetiefe</strong> — sie bestimmt, welche Felder Pflicht sind:\n• <strong>Einfach · Stufe 1</strong> — Adresse, Objektart, Wohnfläche, Baujahr: Marktpreisindikation.\n• <strong>Mittel · Stufe 2</strong> — dazu Kaufpreis, Miete, Zustand, Energie, Standardstufe: erweiterte Indikation.\n• <strong>Ausgiebig · Stufe 3</strong> — dazu Grundstück, Bodenrichtwert, bei Häusern BGF und NHK-Typ: Sach- und Ertragswert nach ImmoWertV.\n\nFehlende Pflichtfelder sind rot umrandet; „x fehlt“ zeigt sie dir. In der Box <strong>Marktbericht abrufen</strong> holst du den Bericht der gewählten Stufe — Stufe 2 gibt es ab Investor, Stufe 3 ab Pro.\n\nTipp: Liegt der Verkehrswert über dem Kaufpreis, zeigt DealPilot oben den <strong>Sofortigen Wertpuffer / Equity</strong>.'
        },
        {
          h: 'Investition — Kaufpreis und Kaufnebenkosten',
          body: 'Trag den <strong>Kaufpreis</strong> ein und darunter die Kaufnebenkosten. Jede Position gibt es doppelt — in Prozent und in Euro; änderst du eins, rechnet DealPilot das andere nach:\n• <strong>Makler</strong>\n• <strong>Notar</strong>\n• <strong>Grundbuchamt</strong> (bei neuen Objekten mit 0,5 % vorbelegt)\n• <strong>Grunderwerbsteuer</strong> (neu vorbelegt mit 6,5 % — prüf den Satz deines Bundeslands)\n• <strong>Sonstige</strong> — Bausachverständiger, Anfahrt, Gutachten\n\nDaraus entstehen <strong>Summe Nebenkosten</strong> und die <strong>Gesamtinvestition</strong> = Kaufpreis + Nebenkosten + Sanierungskosten + Inventarkosten. Der <strong>Markt-Faktor</strong> (Kaufpreis ÷ Jahres-Nettokaltmiete) rechnet sich selbst.\n\nUnter <strong>Sanierung</strong> schätzt du Gewerke ab und übernimmst die Summe in die <strong>Sanierungskosten</strong>. DealPilot prüft dabei die <strong>15 %-Grenze</strong> (§ 6 Abs. 1 Nr. 1a EStG) — gemessen netto, deshalb wählst du, ob dein Betrag brutto oder netto ist. <strong>Inventarkosten</strong> (Küche, Möbel, Geräte …) zählen nicht zur Grenze und werden separat abgeschrieben.'
        },
        {
          h: 'Miete — Einnahmen und Mietentwicklung',
          body: 'Unter <strong>Mietstruktur</strong> trägst du die <strong>Nettokaltmiete / Monat</strong> ein, dazu <strong>Zusätzliche Einnahmen / Monat</strong> (Stellplatz, Garage) und <strong>Umlagefähige Kosten / Monat</strong>. Warmmiete und Jahreswerte rechnet DealPilot.\n\nGanz oben recherchiert <strong>Mietpreis recherchieren</strong> die marktübliche Miete und das Mietausfall-Risiko für deine Adresse; die Werte übernimmst du per Klick. <strong>Marktmiete (€/m²)</strong> wird mit deiner Ist-Miete verglichen und geht in den Investor Deal Score.\n\n<strong>Mietentwicklung</strong> — drei Wege:\n• <strong>Prognose</strong> — eine konstante <strong>Mietsteigerung p.a.</strong>\n• <strong>Detail</strong> — einzelne Erhöhungen: Soll-Mietspiegel, Anzahl Erhöhungen, Intervall\n• <strong>Aus Wohnungen</strong> — die Miete wird aus den einzelnen Wohnungen eines MFH summiert\n\nUnter <strong>Prognose-Annahmen</strong> stehen Wertsteigerung, Kostensteigerung, Leerstand, Betrachtungszeitraum und Exit-Rendite. Bei neuen Objekten kommen Mietsteigerung, Wertsteigerung und Leerstand aus deinen Einstellungen.'
        },
        {
          h: 'Finanzierung — Darlehen, Zinsbindung, Bausparvertrag',
          body: '<strong>Darlehen I – Hauptdarlehen</strong>: Eigenkapital, <strong>Anfängl. Darlehenssumme</strong>, <strong>Zinssatz nominal</strong>, <strong>Tilgung</strong> und <strong>Zinsbindung (Jahre)</strong>. DealPilot rechnet Rate, Restschuld am Ende der Zinsbindung und das Jahr der Volltilgung. Passen Eigenkapital und Darlehen nicht zur Gesamtinvestition, gleichst du mit <strong>Eigenkapital passend setzen</strong> oder <strong>Darlehen passend setzen</strong> aus.\n\n<strong>Zinsbindung und Anschluss:</strong> Hak <strong>Eigene Anschlussfinanzierung für Darlehen 1</strong> an und rechne konservativ, etwa 5,0 % Zins und 1,0 % Tilgung. Das zeigt Zinsrisiko und Mehrkosten pro Monat. Ohne Haken läuft das Darlehen mit seiner Rate weiter.\n\n<strong>Bausparvertrag:</strong> Wähl bei „Art des Darlehens“ <strong>Tilgungsaussetzungsdarlehen (mit Bausparvertrag)</strong>. Die Tilgung wird gesperrt, und die Karte <strong>Bausparvertrag Tilgungsaussetzung</strong> erscheint: Bausparsumme, Sparrate, Mindestsparquote, Konditionen des Bauspardarlehens.\n\n<strong>Darlehen II – Zusatzdarlehen</strong> schaltest du mit <strong>Hinzufügen</strong> zu — auch als KfW-Darlehen.'
        },
        {
          h: 'Bewirtschaftung — Kosten je Objektart',
          body: 'Zwei Eingabe-Modi: <strong>Detailliert</strong> oder <strong>% der NKM</strong> als Schnellweg — die Quote überzeichnet bei hohen Mieten.\n\nIm Detail trennst du <strong>Umlagefähige Kosten / Jahr</strong> (Hausgeld umlagefähig, Grundsteuer) von <strong>Nicht umlagefähigen Kosten / Jahr</strong> (Hausgeld nicht umlagefähig, eigene Instandhaltungsrücklage, kalkulatorischer Mietausfall, Sonderverwaltung). Nur die nicht umlagefähigen mindern deinen Cashflow.\n\n<strong>Standardwerte je Objektart</strong> — sobald Objektart und Wohnfläche stehen, schlägt DealPilot drei Felder vor:\n• <strong>Eigentumswohnung</strong>: Hausgeld 4,00 €/m² im Monat, davon 30 % nicht umlagefähig; eigene Rücklage 0,50 €/m².\n• <strong>Ein-/Zweifamilienhaus</strong>: Betriebskosten 2,20 €/m², Verwaltung 230 €, Instandhaltung 9,00 €/m² im Jahr.\n• <strong>Mehrfamilienhaus</strong>: Betriebskosten 2,50 €/m², Verwaltung 230 € je Wohnung, Instandhaltung 9,00 €/m².\nVerwaltung und Instandhaltung sind Basiswerte der ImmoWertV Anlage 3, fortgeschrieben mit einem Jahresfaktor. Eigene Eingaben gehen immer vor; anpassen kannst du die Werte im „Investment-Profil“.'
        },
        {
          h: 'Steuer — zvE, AfA und Steuerwirkung',
          body: 'Unter <strong>Persönliche Steuer</strong> trägst du das <strong>Zu versteuernde Einkommen (zvE) vor Immobilie</strong> ein. Daraus berechnet DealPilot den <strong>Persönl. Grenzsteuersatz</strong> nach § 32a EStG — du kannst ihn übersteuern, wenn du „automatisch berechnen“ abhakst.\n\n<strong>AfA-Konfiguration:</strong>\n• <strong>AfA-Satz</strong> — 2,0 % linear (Standard), 2,5 % für Baujahre vor 1925, 3,0 % für Wohnzwecke ab 2023 oder 5,0 % degressiv bei Neubauten\n• <strong>Gebäudeanteil am KP (%)</strong> — der Rest ist Grund und Boden, der nicht abgeschrieben wird. Den Anteil kannst du mit dem <strong>BMF-Rechner</strong> ermitteln.\n• <strong>Sonder-AfA § 7b EStG</strong> — wird nur angesetzt, wenn du alle Voraussetzungen bestätigst\n\nDas <strong>Steuer-Modul</strong> rechnet die Steuerwirkung als Differenz zweier Tarifberechnungen, mit und ohne dieses Objekt. Deine gespeicherten Bestandsobjekte rechnen in der Reihenfolge ihres Kaufs mit. Im <strong>Steuerformular pro Jahr</strong> trägst du echte Werbungskosten ein; Belege liest <strong>Belege &amp; Abrechnungen einlesen (KI)</strong> ein.\n\nDealPilot ist eine Rechenhilfe, keine Steuerberatung.'
        },
        {
          h: 'Pilot-Analyse — die schriftliche Einschätzung',
          body: 'Hier bewertet der Pilot deine Zahlen in Worten: Bewertung, Stärken, Risiken, Verhandlungsempfehlung, Bankargumente und Fazit — auf Grundlage aller Eingaben dieses Objekts.\n\nSo geht\'s:\n1. Füll mindestens den <strong>Kaufpreis</strong> aus — ohne ihn startet die Analyse nicht.\n2. Je vollständiger Miete, Finanzierung und Bewirtschaftung sind, desto konkreter wird das Ergebnis.\n3. Klick <strong>Pilot-Analyse starten</strong>.\n\nDie Analyse ist in deinem Plan enthalten und zieht nichts von deinem Kontingent ab.\n\n<strong>Pilot-Analyse im PDF-Export einschließen</strong> legt fest, ob die Pilot-Seite ins PDF kommt. Unter <strong>Bausteine im PDF</strong> wählst du die Teile einzeln, zum Beispiel Gesamtbewertung, Stärken, Risiken, Szenario-Analyse, Verhandlungsempfehlung, Kaufpreis-Offerte und Bankargumente.'
        },
        {
          h: 'Bewertung — Kennzahlen und Score',
          body: 'Dieser Reiter zeigt das Ergebnis — eingeben musst du hier nichts.\n\n<strong>DealPilot Score</strong> — derselbe Wert wie im Boarding, aus Cashflow, Rendite, LTV, Risiko und Potenzial. Die Stufen: ab 85 Sehr gut, ab 70 Gut, ab 50 Solide, ab 35 Schwach, darunter Kritisch. Der <strong>Investor Deal Score</strong> ergänzt Lage, Substanz und Upside-Potenzial; seine Zusatzangaben trägst du in Objekt, Investition und Miete ein.\n\nDie Kennzahlen:\n• <strong>Bruttomietrendite</strong> — Jahres-Nettokaltmiete ÷ Kaufpreis\n• <strong>Nettomietrendite</strong> — Jahresmiete minus nicht umlagefähige Kosten ÷ Gesamtinvestition\n• <strong>Faktor</strong> — Kaufpreis ÷ Jahresmiete\n• <strong>LTV</strong> — Darlehen ÷ Verkehrswert; ohne Verkehrswert ÷ Bankbewertung (wenn höher als der Kaufpreis), sonst ÷ Kaufpreis. Auf Wunsch strenger gegen die Gesamtinvestition\n• <strong>DSCR</strong> — wie oft die Miete den Kapitaldienst deckt (brutto und netto)\n• <strong>Cashflow vor und nach Steuern</strong> — heute, am Ende der Zinsbindung und in der Anschlussfinanzierung\n\nDer Rechenweg <strong>Cashflow – Korrekte Berechnung</strong> zeigt jede Zeile von der Warmmiete bis zum Cashflow nach Steuern.'
        },
        {
          h: 'Deal-Aktion — Status, PDFs und Bank',
          body: 'Der letzte Reiter bringt den Deal zum Abschluss.\n\n<strong>Deal-Status</strong> — markier den Deal als <strong>Offen</strong> (in Prüfung), <strong>Gewonnen</strong> (Objekt im Bestand) oder <strong>Verloren</strong>.\n\n<strong>Dokumente &amp; Exporte</strong>:\n• <strong>Investment-PDF</strong> — der bankfertige Business-Case mit Kaufpreis, Finanzierung, Cashflow, DSCR/LTV und Stress-Test. Beim Klick wählst du die Fassung: Bankfassung, hell oder Obsidian.\n• <strong>Track Record</strong> — gewonnene Deals filtern, als Einzel- oder Sammel-PDF.\n\n<strong>Marktberichte</strong> listet deine erzeugten Berichte als PDF.\n\n<strong>Bordkarte &amp; Unterlagen</strong> bereitet das Bankgespräch vor, mit einer Liste persönlicher und objektbezogener Unterlagen. Fehlende Amtsunterlagen holst du über <strong>Unterlagen beim Amt anfordern</strong>.\n\n<strong>In Gesellschaft überführen</strong> friert das Privatobjekt ein und legt ein neues GmbH-Objekt an. Unter <strong>Dein Netzwerk</strong> findest du geprüfte Partner — die Objektdaten werden mitgegeben.'
        }
      ]
    },
    {
      id: 'quickcheck',
      title: 'Quick-Check (Quick Boarding)',
      icon: 'i-gauge',
      desc: 'Schnellprüfung: Score, Zielkaufpreis, Übernahme ins Objekt',
      sections: [
        {
          h: 'Eingaben und Pflichtfelder',
          body: 'Du öffnest den Quick-Check über <strong>Aktionen</strong> in der Seitenleiste → <strong>Quick Boarding</strong>.\n\nPflicht sind elf Felder: <strong>Straße</strong>, <strong>PLZ</strong>, <strong>Ort</strong>, <strong>Wohnfläche (m²)</strong>, <strong>Kaufpreis (€)</strong>, <strong>Nettokaltmiete gesamt / Monat (€)</strong>, <strong>Hausgeld / Monat (€)</strong>, <strong>Nicht-umlagefähig (% vom HG)</strong>, <strong>Eigenkapital (€)</strong>, <strong>Zinssatz (%)</strong> und <strong>Tilgung (%)</strong>. Die Hausnummer ist freiwillig — viele Inserate nennen keine; dann bezieht sich die Lage auf die Straße. Erst wenn alle gefüllt sind, erscheinen Score und Bewertung — bis dahin steht im Pass „noch … Pflichtfelder offen“.\n\nWas DealPilot dir abnimmt:\n• Grundmiete, Stellplatz, Küche und Sonstige werden zur Nettokaltmiete addiert, solange du die Summe nicht selbst tippst.\n• Wählst du bei <strong>Beleihung (LTV)</strong> 100 % bis 80 %, setzt DealPilot als Eigenkapital den nicht finanzierten Kaufpreisanteil plus 10,5 % Nebenkosten ein — außer du hast selbst etwas eingetragen.\n• Zins, Tilgung und der nicht umlagefähige Anteil (sonst 22 %) kommen aus deinen Standardwerten, das Hausgeld als Schätzung. Ein eigener Wert gewinnt immer.'
        },
        {
          h: 'Der Score und seine fünf Teilnoten',
          body: 'Der Score (0–100) kommt aus demselben Score-Kern wie in der App. Er besteht aus fünf Teilnoten, beim Score-Profil „Ausgewogen“ so gewichtet:\n• <strong>Cashflow</strong> 30 % — −200 €/Monat = 0, 0 € = 50, +200 € = 100 Punkte\n• <strong>Rendite (NMR)</strong> 25 % — Nettomietrendite 2 % = 0, 3,5 % = 50, 5 % = 100\n• <strong>LTV</strong> 15 % — 70 % = 100, 90 % = 50, 110 % = 0\n• <strong>Risiko (DSCR)</strong> 15 % — bis 0,9 = 0, 1,0 = 60, 1,2 = 80, ab 1,5 = 100\n• <strong>Potenzial</strong> 15 % — der Wertpuffer, also ein Marktwert über dem Kaufpreis. Ohne Puffer 30 Punkte, je Prozent Puffer 3 mehr, höchstens 90\n\nMit einem anderen Score-Profil verschieben sich die Gewichte.\n\nDie Stufe: ab 85 <strong>Sehr gut</strong>, ab 70 <strong>Gut</strong>, ab 50 <strong>Solide</strong>, ab 35 <strong>Schwach</strong>, darunter <strong>Kritisch</strong>.\n\nGerechnet wird mit 10,5 % Kaufnebenkosten. Das Darlehen ist Kaufpreis plus Nebenkosten minus Eigenkapital.'
        },
        {
          h: 'Kennzahlen und Zielwerte',
          body: 'Unter dem Score stehen sieben Kennzahlen, jede mit ihrem Zielwert:\n• <strong>Bruttomietr.</strong> (Ziel ≥5 %) — Jahreskaltmiete geteilt durch Kaufpreis. Gut ab 5 %, schwach bis 3 %.\n• <strong>Nettomietr.</strong> (Ziel ≥3 %) — nach Abzug des nicht umlagefähigen Hausgelds. Gut ab 3 %, schwach bis 1 %.\n• <strong>EK-Rendite</strong> (Ziel ≥7 %) — gut ab 7 %, schwach bei 0 % oder weniger.\n• <strong>Cashflow/Mo</strong> (Ziel ≥0 €) — gut ab 0 €, schwach ab −100 €.\n• <strong>DSCR</strong> (Ziel ≥1,2) — gut ab 1,2, schwach bis 1,0.\n• <strong>LTV</strong> (Ziel unter 90 %) — Darlehen geteilt durch Kaufpreis. Bis 95 % noch gut markiert, ab 105 % schwach.\n• <strong>Bewirtsch.</strong> (18–35 %) — Hausgeld im Verhältnis zur Nettokaltmiete. Über 35 % schwach.\n\nDazwischen liegt jeweils der mittlere Bereich. Die Kennzahlen fließen auch in die Liste <strong>Pro-Argumente</strong> und <strong>Achtung</strong> der Bewertung ein.'
        },
        {
          h: 'Lageklasse und Zielrendite',
          body: 'Im Feld <strong>Lageklasse</strong> wählst du <strong>A-Lage</strong>, <strong>B-Lage</strong> oder <strong>C-Lage</strong>. Die Einstufung ist deine Strategieentscheidung — DealPilot schlägt keine vor. Jede Klasse hat eine Ziel-Bruttomietrendite, vorbelegt mit A 3,5 %, B 5,0 %, C 7,0 %.\n\nSo stellst du sie ein:\n1. Einstellungen → <strong>Standardwerte</strong> → <strong>Lageklassen A · B · C</strong>.\n2. Je Klasse die <strong>Zielrendite</strong> (% brutto) eintragen. Sie ist das einzige Pflichtfeld, die Felder daneben sind freiwillig.\n3. Unter <strong>Standard für neue Quick-Checks</strong> eine Klasse wählen. Sie steht dann vorausgewählt, mit dem Hinweis „Vorgabe aus deinem Profil · überschreibbar“.\n\nDie Zielrendite bestimmt den Zielkaufpreis der Verhandlungs-Empfehlung. In der Experten-Meinung steht, ob deine Bruttomietrendite <em>deutlich unter</em> (weniger als 75 % des Ziels), <em>knapp unter</em>, <em>am Ziel</em> oder <em>deutlich über deinem Ziel</em> (ab 115 %) liegt. Ohne Lageklasse rechnet DealPilot mit 6 % und misst am Bundesdurchschnitt.'
        },
        {
          h: 'Bewertung und Verhandlungs-Empfehlung',
          body: 'Die Karte <strong>Bewertung</strong> nennt eine Handlung, abhängig vom Score:\n• ab 75: <strong>Starker Kauf — empfehlenswert</strong>. Liegt der Kaufpreis über dem Marktwert, heißt es stattdessen „verhandeln nötig“.\n• 60–74: <strong>Kauf möglich — verhandeln nötig</strong>, wenn der Preis ein Hebel ist, sonst <strong>Kauf möglich — genauer prüfen</strong> mit der schwächsten Kennzahl als Grund.\n• 40–59: <strong>Nur mit Nachbesserung tragfähig</strong>\n• unter 40: <strong>Finger weg — weitersuchen</strong>\n\nDie <strong>Verhandlungs-Empfehlung</strong> nennt einen Zielkaufpreis: den niedrigsten aus dem Preis, bei dem du deine Zielrendite erreichst, dem Preis, bei dem der Cashflow etwa auf null steigt, und — falls abgerufen — dem Marktwert abzüglich 10 % Angebotsabschlag. Liegt dein Kaufpreis schon darunter, ist kein Nachlass nötig.\n\nDarunter stehen <strong>Pro-Argumente</strong>, <strong>Achtung</strong> und die <strong>Experten-Meinung</strong>. Sind alle Pflichtfelder gefüllt, startet die KI-Analyse von selbst. Fällt sie aus, bleibt die „Lokale Heuristik“ stehen.'
        },
        {
          h: 'Marktpreis, Exposé und Sprache abrufen',
          body: 'In der Leiste <strong>QUICKBOARDING PASS</strong> wählst du Quellen per Klick und startest mit <strong>Abrufen</strong>:\n• <strong>DealPilot</strong> — Marktbewertung mit Marktwert, Marktmiete und Lage. Braucht PLZ oder Ort und verbraucht 1 Bewertung aus deinem Kontingent.\n• <strong>Exposé / Marktbericht</strong> — ein PDF auslesen, die Werte landen in den Feldern.\n• <strong>Sprache</strong> — das Objekt frei einsprechen, im Plan enthalten.\n• <strong>ImmoMetrica</strong> — sobald der Zugang in den Einstellungen gespeichert ist.\n\nErst laufen Sprache, Exposé und ImmoMetrica, dann die Marktbewertung. Fehlt eine Angabe, hält der Abruf an, markiert das Feld und wartet auf <strong>Weiter</strong>.\n\n<strong>Achtung:</strong> Nach der Marktbewertung trägt DealPilot die Marktmiete in <strong>Grundmiete (€)</strong> ein. Willst du mit der Ist-Miete rechnen, trag sie danach wieder ein. Der Marktwert fließt in die Teilnote Potenzial und in den Zielkaufpreis.\n\n<strong>Neuer Vorgang</strong> (nach dem Abruf statt „Abrufen“) setzt alles zurück.'
        },
        {
          h: 'Als Objekt speichern',
          body: 'Sind alle Pflichtfelder gefüllt, wird <strong>Als Objekt speichern</strong> aktiv.\n\nSo geht\'s:\n1. <strong>Als Objekt speichern</strong> klicken.\n2. Im Fenster <strong>Diese Daten werden übernommen</strong> zeigt der Reiter <strong>Übernahme</strong> Marktwert, Marktmiete und Lage aus der Marktbewertung. Unter <strong>Spanne</strong> wählst du <strong>Unten</strong>, <strong>Ø</strong> oder <strong>Oben</strong>.\n3. Der Reiter <strong>Ausgelesene Daten</strong> zeigt, was im Quick-Check gesetzt ist, und Zusatzdaten aus Exposé oder Import.\n4. Haken entfernen, was nicht mit soll — oder <strong>Alle übernehmen</strong>.\n5. <strong>Speichern & übernehmen</strong>.\n\nDealPilot legt ein <strong>neues Objekt</strong> an und überschreibt kein geöffnetes. Mit kommen alle Eingaben, bis zu sechs Fotos und die angehakten Marktdaten — der Marktwert als Verkehrswert. Gab es keine Marktbewertung, holst du Marktwert und Miete später im Objekt über „Abrufen“.'
        }
      ]
    },
    {
      id: 'kennzahlen',
      title: 'Kennzahlen verstehen',
      icon: 'i-bar',
      desc: 'Die wichtigsten Kennzahlen erklärt',
      sections: [
        {
          h: 'Bruttomietrendite — schnelle Vergleichszahl',
          body: 'Die Bruttomietrendite zeigt dir auf einen Blick, wie viel Miete eine Immobilie pro Jahr in Relation zum Kaufpreis bringt. Sie ist <strong>unbereinigt</strong>: Bewirtschaftungskosten (Hausgeld, Verwaltung, Rücklagen) und Finanzierungskosten (Zinsen) sind nicht abgezogen. Deshalb ist sie <em>kein</em> Maß für deinen tatsächlichen Ertrag — aber ein gutes Werkzeug, um Objekte schnell miteinander zu vergleichen.\n\n<strong>Wofür du sie nutzt:</strong>\n• Erste Einschätzung beim Inserate-Sichten\n• Vergleich zwischen Lagen (A-Stadt vs. B-Stadt)\n• Bewertung des Kaufpreis-Niveaus relativ zu den Mieten\n\n<strong>Typische Werte in Deutschland (Wohnimmobilien als Kapitalanlage):</strong>\n• A-Lagen wie München, Hamburg, Frankfurt: oft 2,5–3,5 % — Preise sind hoch, Renditen entsprechend niedrig\n• B-/C-Städte wie Herford, Dortmund, Kassel: typisch 5–7 % — der „Sweet Spot" für viele Kapitalanleger\n• D-Lagen, Ostdeutschland (z. B. Chemnitz, Halle): teils 7–9 % — höhere Rendite, aber auch höheres Risiko bei Mieter-Stabilität und Wertentwicklung\n\n<strong>Wichtig:</strong> Eine hohe Bruttomietrendite ist nicht automatisch „besser". Sie spiegelt oft eingepreistes Risiko wider. Vergleiche immer mit Nettomietrendite und Lagebewertung.'
        },
        {
          h: 'Nettomietrendite — der ehrlichere Renditewert',
          body: 'Die Nettomietrendite ist die <strong>realistische Variante</strong> der Bruttomietrendite. Hier werden zwei Dinge anders gerechnet:\n\n<strong>1. Bewirtschaftungskosten werden abgezogen.</strong> Das ist der Teil des Hausgelds, den der Vermieter selbst trägt (Verwaltung, nicht-umlagefähige Instandhaltung, eigene Rücklage, kalkulierter Mietausfall).\n\n<strong>2. Statt nur dem Kaufpreis wird die Gesamtinvestition verwendet.</strong> Das heißt: Notar, Grundbuch, Grunderwerbsteuer, Maklerprovision, ggf. Sanierung — alles, was du wirklich aufbringen musst, um die Immobilie betriebsbereit zu haben.\n\nDeshalb liegt die Nettomietrendite immer unter der Bruttomietrendite — meist 1,5 bis 2,5 Prozentpunkte darunter.\n\n<strong>So bewertet DealPilot sie:</strong>\n• ab 4,5 % — gut\n• 3,5–4,5 % — durchschnittlich\n• 2,5–3,5 % — gering\n• unter 2,5 % — sehr gering, fast nur Wertsteigerungs-Spekulation\n\n<strong>Tipp:</strong> Wenn die Nettomietrendite weniger als zwei Prozentpunkte über deinem Sollzins liegt, arbeitet die Immobilie operativ kaum für dich — dann lebst du fast ausschließlich von Tilgung und Hoffnung auf Wertsteigerung.'
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
          body: 'Der monatliche Cashflow ist das, was nach Abzug aller laufenden Kosten von der Miete übrig bleibt. Es ist die Zahl, die du wirklich auf dem Konto siehst — nicht die theoretische Rendite.\n\nDealPilot rechnet den Cashflow in mehreren Stufen:\n\n<strong>Bruttomiete</strong> (Kaltmiete + umlagefähige Bewirtschaftungs-Erstattung)\n<strong>− Bewirtschaftung umlagefähig</strong> (durchlaufender Posten)\n= Kaltmiete\n<strong>− Bewirtschaftung nicht-umlagefähig</strong> (Hausgeld-Anteil, eigene Rücklage)\n= Net Operating Income (NOI)\n<strong>− Zinsen</strong>\n= CF nach Zinsen, vor Tilgung\n<strong>− Tilgung</strong>\n= CF vor Steuern\n<strong>± Steuern</strong>\n= CF nach Steuern (was wirklich übrig bleibt)\n\n<strong>Wichtig:</strong> In der Frühphase ist der CF nach Steuern oft höher als der CF vor Steuern — weil die Steuererstattung aus den V+V-Verlusten dazukommt. Mit zunehmender Tilgung sinkt die AfA-Bedeutung, der zu versteuernde Gewinn steigt, und die Steuerlast verschiebt sich.\n\n<strong>So bewertet DealPilot den Cashflow nach Steuern:</strong>\n• ab 100 €/Monat — positiv\n• 0–100 €/Monat — neutral, ein kleiner Reparaturfall kippt die Rechnung\n• bis −200 €/Monat — leicht negativ, du schießt zu\n• unter −200 €/Monat — negativ'
        },
        {
          h: 'Equity Multiple — Hebelwirkung deines Kapitals',
          body: 'Der Equity Multiple zeigt, wie oft sich dein eingesetztes Eigenkapital nach dem Betrachtungszeitraum (typisch 10 Jahre) zurückgespielt hat. Er ist die Antwort auf die Frage: <strong>Was habe ich aus dem Geld gemacht, das ich reingesteckt habe?</strong>\n\nEin Equity Multiple von 2,0x bedeutet: Aus jedem Euro Eigenkapital sind 2 Euro Vermögen geworden — Eigenkapital + Gewinn. Bei 3,0x sind es 3 Euro, bei 4,0x sind es 4 Euro.\n\n<strong>Spezialfall Vollfinanzierung:</strong> Bei einem Eigenkapital von 0 € (oder sehr geringem Eigenkapital) ist der Equity Multiple mathematisch unendlich groß — DealPilot zeigt dann das Symbol ∞ oder „Multiple". Das ist kein Fehler, sondern Ausdruck davon, dass aus „nichts" etwas geworden ist. In dem Fall sind andere Kennzahlen (Vermögenszuwachs absolut, Cashflow) aussagekräftiger.\n\n<strong>So bewertet DealPilot ihn:</strong>\n• ab 3,0x — stark, meist durch den Hebel der Finanzierung\n• 2,0–3,0x — solide\n• 1,0–2,0x — schwach, das Kapital hätte man womöglich besser anders angelegt\n• unter 1,0x — Verlust'
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
          body: 'Das Zinsrisiko ist die Differenz zwischen deiner heutigen monatlichen Rate und der hochgerechneten Rate nach Ablauf der Zinsbindung. Es zeigt dir, <strong>wie stark die monatliche Belastung steigen würde</strong>, wenn die Anschlussfinanzierung zu höheren Zinsen abgeschlossen werden müsste.\n\nDealPilot rechnet das Zinsrisiko mit dem Anschlusszins aus dem Reiter Finanzierung (vorbelegt 5,0 %, bewusst mit Puffer über dem heutigen Niveau). Das Zinsrisiko zeigt also: <em>„Wenn die Zinsen sich am oberen Ende einpendeln, wie viel mehr zahle ich dann pro Monat?"</em>\n\n<strong>Beispiel:</strong> Heute 750 €/Monat bei 3,5 % Zins, in 10 Jahren bei 5 % Anschlusszins 883 €/Monat → Zinsrisiko = 133 €/Monat. Das ist die Größenordnung, die du für deine Liquiditätsplanung kalkulieren solltest.\n\n<strong>Wie du das Zinsrisiko reduzieren kannst:</strong>\n• <strong>Längere Zinsbindung</strong> (15 oder 20 Jahre) — schiebt das Risiko nach hinten\n• <strong>Höhere Tilgung</strong> — reduziert die Restschuld bei Bindungsende und damit den absoluten Anstieg\n• <strong>Sondertilgungen</strong> — gleicher Effekt, flexibler\n• <strong>Forward-Darlehen</strong> — du sicherst dir die Anschlusskonditionen 3–5 Jahre vorher fest\n\nDas Zinsrisiko ist eines der unterschätztesten Themen bei Kapitalanlage-Immobilien. Eine Finanzierung kann heute solide aussehen und in 10 Jahren bei +2 Prozentpunkten Anschlusszins kippen.'
        },
        {
          h: 'AfA — Abschreibung als Steuer-Hebel',
          body: 'Die Absetzung für Abnutzung (AfA) ist die steuerlich anerkannte Wertminderung des Gebäudes über seine Nutzungsdauer. Sie reduziert dein zu versteuerndes Einkommen aus Vermietung und Verpachtung — ohne dass dafür Geld fließt. Sie ist also ein <strong>buchhalterischer Verlust</strong>, der echte Steuerersparnis erzeugt.\n\n<strong>So funktioniert es in der Praxis:</strong>\nDu kaufst ein Objekt für 200.000 € (Kaufpreis). Davon entfallen typischerweise 80 % auf das Gebäude, 20 % auf den Grund und Boden (der nicht abgeschrieben werden kann). Bei Standard-AfA von 2 % p.a. auf den Gebäudeanteil schreibst du jährlich 3.200 € steuerlich ab — Jahr für Jahr, über 50 Jahre Nutzungsdauer.\n\n<strong>Wichtig:</strong> Die AfA ist <em>kein</em> Cashflow. Du bekommst keine 3.200 € überwiesen. Aber dein zu versteuerndes Einkommen aus Vermietung sinkt um diesen Betrag. Bei einem persönlichen Grenzsteuersatz von 42 % entspricht das einer Steuerersparnis von etwa 1.344 € pro Jahr.\n\n<strong>AfA-Sätze:</strong>\n• Bestandsgebäude ab Baujahr 1925: 2 % p.a. (50 Jahre Nutzungsdauer)\n• Bestandsgebäude vor 1925: 2,5 % p.a. (40 Jahre)\n• Neubau ab 2023: 3 % p.a. (33 Jahre) — gilt für Wohngebäude mit Bauantrag/Kaufdatum ab 1.1.2023\n\nDie AfA ist der Hauptgrund, warum Immobilieninvestments in den ersten Jahren steuerlich oft Verluste produzieren — und warum du in der Steuererklärung einen Cashflow-Vorteil daraus ziehst.'
        },
        {
          h: 'DealScore (0–100) — die Gesamtbewertung',
          body: 'Der DealScore fasst dein Investment in einer Zahl von 0 bis 100 zusammen — der schnelle Blick. Er besteht aus fünf Faktoren:\n\n• <strong>Cashflow</strong> — was monatlich bleibt (30 %)\n• <strong>Rendite</strong> — netto, nach Bewirtschaftung (25 %)\n• <strong>Beleihungsauslauf</strong> — wie viel Fremdkapital (15 %)\n• <strong>Risiko</strong> — Deckung des Kapitaldienstes (15 %)\n• <strong>Potenzial</strong> — Wertpuffer und Mietsteigerung (15 %)\n\nBei einem Barkauf entfallen Beleihungsauslauf und Risiko — sie werden nicht schlecht bewertet, sondern aus der Rechnung genommen.\n\nDaneben gibt es den <strong>Investor Deal Score</strong> mit fünf Kategorien (Rendite 35 %, Finanzierung 25 %, Risiko 20 %, Lage 10 %, Upside 10 %), jede mit eigenen Unterkennzahlen. Fehlt eine Unterkennzahl, fällt sie aus der Gewichtung, statt mit einem Mittelwert gefüllt zu werden; fehlt eine ganze Kategorie, zählt sie neutral mit 60 Punkten. Dass beide Scores abweichen, ist gewollt.\n\n<strong>Die Stufen — überall dieselben:</strong>\n• <strong>ab 85 — Sehr gut</strong>\n• <strong>ab 70 — Gut</strong>\n• <strong>ab 50 — Solide</strong>\n• <strong>ab 35 — Schwach</strong>\n• <strong>unter 35 — Kritisch</strong>\n\nEinstellen lässt sich viel: sechs Vorlagen (Ausgewogen, Konservativ, Optimistisch, Lage-Fokus, Cashflow-Fokus, Sicherheit), eigene Gewichte mit Summe 100, die Ziel-Bruttomietrendite je Lageklasse und persönliche Mindest-Schwellen — unter Einstellungen.'
        }
      ]
    },
    {
      id: 'finanzierung',
      title: 'Finanzierung',
      icon: 'i-coins',
      desc: 'Darlehen, Tilgung und Bausparen',
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
          body: 'Hakst du im Reiter Finanzierung <strong>„Eigene Anschlussfinanzierung“</strong> an, rechnet DealPilot nach der Zinsbindung mit deinem Anschlusszins (vorbelegt 5,0 %) und deiner Anschluss-Tilgung (vorbelegt 1,0 %). Ohne Haken läuft das Darlehen zu den heutigen Konditionen weiter.\n\nDas <strong>Zinsänderungsrisiko</strong> rechnet DealPilot immer: die Mehrbelastung pro Monat aus dem Zinsunterschied (Anschlusszins minus heutiger Zins) auf die Restschuld. Es steht im Reiter <strong>Bewertung</strong> und im Bankgespräch.'
        }
      ]
    },
    {
      id: 'steuer_tief',
      title: 'Steuer',
      icon: 'i-receipt',
      desc: 'Grenzsteuersatz, AfA, Kaufpreisaufteilung, Werbungskosten, Finanzamt-PDF',
      sections: [
        {
          h: 'Grenzsteuersatz und Steuerwirkung',
          body: 'Im Reiter <strong>Steuer</strong>, Karte „Persönliche Steuer“, trägst du dein <strong>Zu versteuerndes Einkommen (zvE) vor Immobilie</strong> ein. Ist „Grenzsteuersatz automatisch aus zvE berechnen“ angehakt, rechnet DealPilot den Satz nach § 32a EStG (Tarif 2026). Nimmst du den Haken heraus, kannst du ihn selbst eintragen. Das zvE wird zentral in deinem Profil gespeichert.\n\n<strong>Wie die Wirkung entsteht:</strong> Das steuerliche Ergebnis des Objekts — Miete minus Kosten und AfA — wird auf dein zvE gerechnet. Die Steuerwirkung ist die Differenz zweier Tarifberechnungen, mit und ohne das Objekt. Daraus entsteht der Cashflow nach Steuer.\n\nGespeicherte Bestandsobjekte rechnen mit, in der Reihenfolge ihres Kaufzeitpunkts: ein Verlust aus einem älteren Objekt senkt die Basis, auf der dieses spart. Verlustverrechnungsgrenzen (§ 15a, § 15b, § 10d EStG) bleiben außen vor.'
        },
        {
          h: 'Steuerzeiträume: zvE im Zeitverlauf',
          body: 'Dein Einkommen ändert sich — etwa nach einer Lohnerhöhung. Dafür gibt es Steuerzeiträume.\n\nSo geht\'s:\n1. Im Reiter Steuer auf <strong>📅 Steuerzeiträume verwalten →</strong> klicken. Du landest in den Einstellungen unter <strong>Mandanten</strong> bei deinem privaten Halter.\n2. Unter „Neuen Zeitraum hinzufügen“ <strong>Gültig von</strong>, <strong>Gültig bis (leer = laufend)</strong>, <strong>zvE / Jahr (€)</strong>, einen <strong>Grund</strong> und optional eine Notiz eintragen.\n3. <strong>Hinzufügen</strong>.\n\nÜberschneidet sich der neue Zeitraum mit einem bestehenden, zeigt DealPilot den Konflikt. Du kannst abbrechen oder „Trotzdem als neuen Zeitraum anlegen“.\n\nFür jedes Steuerjahr nimmt die Rechnung das zvE des Zeitraums, der zur Jahresmitte gilt. Liegt keiner vor, gilt das zvE aus dem Reiter Steuer.'
        },
        {
          h: 'AfA-Satz, Gebäudeanteil und § 7b',
          body: 'Karte <strong>AfA-Konfiguration</strong>, Feld <strong>AfA-Satz</strong>:\n• 2,0 % linear — Standard ab 1925\n• 2,5 % linear — Baujahr vor 1925\n• 3,0 % linear — Wohnzwecke ab 2023\n• 5,0 % degressiv — ohne Wechsel\n• 5,0 % degressiv mit Wechsel auf 3 % linear (empfohlen)\n\nPasst ein Neubau, weist ein Hinweis auf die degressive AfA nach § 7 Abs. 5a EStG hin — mit dem Knopf <strong>Auf degressiv 5% wechseln</strong>.\n\n<strong>Gebäudeanteil am KP (%)</strong>: der Rest ist Grund und Boden. Darunter steht <strong>AfA / Jahr (berechnet)</strong>, aufgeteilt in Gebäude-AfA und bewegliche Wirtschaftsgüter, plus „AfA-Verlauf erste 10 Jahre ansehen“.\n\n<strong>§ 7b Sonder-AfA</strong> (aufklappen): zusätzlich 5 % in den ersten 4 Jahren. Du bestätigst vier Voraussetzungen — Effizienzhaus 40 NH, Baukosten ≤ 5.200 €/m², 10 Jahre Vermietung, Bauantrag/Kaufvertrag 01.01.2023 – 30.09.2029. Die Basis ist auf 4.000 €/m² Wohnfläche gekappt.'
        },
        {
          h: 'Eigener AfA-Satz über die Restnutzungsdauer',
          body: 'Ist die tatsächliche Nutzungsdauer kürzer, erlaubt § 7 Abs. 4 Satz 2 EStG einen höheren Satz — das Finanzamt verlangt dafür einen Nachweis per Gutachten.\n\nSo geht\'s:\n1. Im Feld <strong>AfA-Satz</strong> „Eigenen Satz / Restnutzungsdauer eingeben …“ wählen.\n2. <strong>Restnutzungsdauer (Jahre)</strong> eintragen — der Satz ergibt sich als 100 ÷ RND. Oder den <strong>AfA-Satz (%)</strong> direkt eingeben.\n3. Unter <strong>Grundlage</strong> den Nachweis nennen, z. B. das Gutachten mit Datum.\n\nPlausibel ist ein Satz zwischen 0,5 und 33,3 %. Der eigene Satz wird von keiner Automatik überschrieben.\n\n<strong>Restnutzungsdauer ermitteln</strong> öffnet einen Assistenten in neun Schritten — von Objekt-Basis über Modernisierungen und Zustand der Gewerke bis „Ergebnis & Empfehlung“. Am Ende steht eine Gutachten-Anfrage. Liegt eine Ermittlung vor, erscheint <strong>Letzte Ermittlung übernehmen</strong>; sie ist als indikativ vermerkt.'
        },
        {
          h: 'BMF-Rechner: Kaufpreis aufteilen',
          body: 'Der Knopf <strong>BMF-Rechner</strong> in der AfA-Konfiguration öffnet „Anschaffungskosten & BMF-Kaufpreisaufteilung“ nach der BMF-Arbeitshilfe (Juni 2023).\n\n<strong>1 Anschaffungskosten</strong> — übernimmt die Werte aus dem Reiter Investition: Kaufpreis, Grunderwerbsteuer, Notar, Grundbuchamt, Makler. Dazu Erwerbskosten wie Fahrten (mit Fahrtkosten-Helfer), Verpflegung, Unterkunft, Gutachten, Anwalt. Herstellungskosten nach § 255 Abs. 2 HGB zählen zu 100 % zum Gebäude.\n\n<strong>2 BMF-Aufteilung</strong> — Grundstücksart, Baujahr, Flächen, Bodenrichtwert, Miete und Modernisierungen. Alle drei Verfahren werden gerechnet; maßgebend ist bei bekannter Miete der Ertragswert, mit Vergleichsfaktor der Vergleichswert, sonst der Sachwert. <strong>KI-Vorschlag</strong> schlägt Gutachterausschuss-Werte vor; übernommen werden sie erst mit „BRW → BMF“ bzw. „Lzs → BMF“. Liegt ein amtlicher Zinssatz vor, steht darunter die Aufteilung nach Jacoby zum Vergleich.\n\nDie Reiter 2 bis 4 öffnen erst, wenn die Pflichtangaben vollständig sind.'
        },
        {
          h: 'Varianten, Bodenabschlag und Ausgabe',
          body: '<strong>3 AfA-Vorschau</strong> zeigt AfA-Basis und jährliche AfA und vergleicht mit der Pauschale 80/20.\n\n<strong>4 AfA-Hebel</strong>: vier Varianten — <strong>Amtlich</strong> (× 1,00, vorausgewählt), <strong>Konservativ</strong> (Boden −15 %), <strong>Optimiert</strong> (−20 %), <strong>Aggressiv</strong> (−25 %), jeweils mit Risiko-Score. Dazu die 15-%-Grenze mit Status Puffer, Knapp oder Überschritten und die Notarvertrag-Klausel zum <strong>Kopieren</strong>. Bei Abweichungen über 25 % zum BMF-Standard ist ein Sachverständigengutachten sinnvoll.\n\n<strong>Bodenabschlag</strong>: ein Szenario neben der amtlichen Zahl, die unangetastet bleibt — mit Abschlag 0/15/20/25 %, Restnutzungsdauer und einer <strong>Begründung</strong> für den Vertragstext. Ohne Begründung bleibt der Abschlag angreifbar.\n\n<strong>✓ Übernehmen</strong> schreibt Gebäudeanteil und AfA-Satz in den Reiter Steuer. Ausgabe: <strong>Kaufpreisaufteilung als PDF</strong>, <strong>BMF-Arbeitshilfe als PDF</strong>, <strong>BMF-Original als XLSX</strong>.'
        },
        {
          h: 'Werbungskosten je Jahr und Sanierung verteilen',
          body: 'Karte <strong>Steuerformular pro Jahr · individuelle Werte</strong>: DealPilot schlägt je Jahr Werte aus deinen Eingaben vor, du überschreibst sie, etwa mit den Zahlen aus dem Steuerbescheid.\n• <strong>Quick-Modus</strong> — eine Zeile je Jahr: Einnahmen V+V, Schuldzinsen, AfA, Bewirtschaftung, Sonstige WK, Verlust/Überschuss, Steuer-Effekt. Feld anklicken zum Ändern, ↺ setzt es zurück.\n• <strong>Detail-Modus</strong> — ein Veranlagungsjahr, gegliedert in Finanzierungs-, Betriebs-, Verwaltungs- und sonstige Kosten, AfA Gebäude und bewegliche Wirtschaftsgüter.\n<strong>↺ Vorschläge wiederherstellen</strong> setzt alles zurück. Änderungen fließen in Cashflow und Steuerverlauf.\n\n<strong>Sanierung:</strong> Im Reiter Investition, Karte Sanierung, hakst du „In Steuer-Werbungskosten übernehmen“ an und wählst die Verteilung: Automatisch (15%-Regel), 1 bis 5 Jahre (5 Jahre nach § 82b EStDV) oder über die AfA-Nutzungsdauer. Die 15-%-Grenze rechnet netto; brutto eingetragene Kosten werden um 19 % USt bereinigt.'
        },
        {
          h: 'Finanzamt-PDF und Anlage V',
          body: 'Das <strong>Finanzamt-PDF</strong> schlüsselt die Werbungskosten für die Anlage V auf.\n\nSo geht\'s:\n1. Reiter Steuer, Karte „Steuerformular pro Jahr“: unter <strong>Steuerjahr</strong> ein Jahr oder <strong>Alle Jahre</strong> wählen.\n2. Optional <strong>Anlage V</strong> anhaken — dann folgt jedem Jahresblatt eine zweite Seite mit denselben Zahlen, sortiert nach den Zeilen der amtlichen Anlage V.\n3. <strong>Finanzamt-PDF</strong> klicken.\n\nBei „Alle Jahre“ kommt eine Seite je Jahr plus eine Zusammenfassung. Dasselbe PDF erreichst du im Reiter Deal-Aktion.\n\nDie Zeilennummern sind aus dem amtlichen Formular 2025 übernommen. Für spätere Jahre nimmt DealPilot das jüngste vorhandene Formular und sagt das in Rot auf der Seite. Gehört das Objekt einer GmbH oder UG, gibt es keine Anlage V — die Einkünfte sind dann gewerblich.\n\nFür alle Objekte auf einmal: im Cockpit <strong>Steuer-Mappe erstellen</strong>, wahlweise mit „Anlage-V-Zuordnung anhängen“.'
        },
        {
          h: 'Disclaimer',
          body: 'DealPilot ist nach § 6 StBerG keine Steuerberatung. Die Berechnungen sind Hilfsmittel — die finale Beurteilung gehört in die Hände eines Steuerberaters.'
        }
      ]
    },
    {
      id: 'ki',
      title: 'Pilot-Analyse',
      icon: 'i-cpu',
      desc: 'KI-gestützte Bewertung',
      sections: [
        {
          h: 'Was macht die KI?',
          body: 'Sie bekommt deine Objektdaten + Berechnungen + DealScore-Werte und liefert eine strukturierte Analyse: Gesamtbewertung, Stärken, Risiken, Risikoanalyse, Szenarien, Investor-Fit, Empfehlung (Kaufen/Prüfen/Nicht kaufen), Verhandlungsempfehlung mit konkretem Ziel-Kaufpreis, Bank-Argumente und DealPilot-Insight.\n\n<strong>Wichtig:</strong> Die KI recherchiert auch Makro-/Mikrolage und Mietspiegel-Daten zu deiner Stadt — das macht die Analyse ortsspezifisch.'
        },
        {
          h: 'Wie oft kann ich die KI nutzen?',
          body: 'Die Pilot-Analyse ist in deinem Plan enthalten und verbraucht kein Kontingent. Auf das Kontingent zählen die Marktberichte — wie viele noch frei sind, steht im Reiter Objekt direkt an jeder Stufe („N frei“). Fragen an den Piloten (F1 oder ?) haben ein eigenes Tageslimit je Plan.'
        },
        {
          h: 'Wird die Analyse gespeichert?',
          body: 'Die Pilot-Analyse wird beim Objekt gespeichert. Beim erneuten Öffnen siehst du sie direkt. Für eine frische Einschätzung klickst du im Reiter Pilot-Analyse auf „Pilot-Analyse starten“.'
        }
      ]
    },
    {
      id: 'marktbericht',
      title: 'Marktbericht und Wertermittlung',
      icon: 'i-building',
      desc: 'Drei Stufen, Lauf im Hintergrund, Verlauf, und wie Boden-, Ertrags- und Sachwert entstehen',
      sections: [
        {
          h: 'Die drei Stufen und der Abruf',
          body: 'Im Reiter <strong>Objekt</strong> wählst du oben die <strong>Eingabetiefe</strong> (Pillen 1 · 2 · 3), darunter steht die Box <strong>Marktbericht abrufen</strong>.\n\n• <strong>Einfach · Stufe 1</strong> — die Marktpreisindikation auf der <strong>Objektkarte</strong>: Marktwert mit Spanne und Marktmiete aus Adresse, Objektart, Fläche und Baujahr. Kein eigener Bericht und kein PDF — die Werte werden am Objekt gespeichert.\n• <strong>Mittel · Stufe 2</strong> — der <strong>Marktbericht</strong>: dazu Kaufpreis, Miete, Zustand, Energie und Ausstattung, mit Lage, Preisentwicklung, Rendite, Abschlag zum Markt und Text — als Bericht und PDF, ohne Wertverfahren.\n• <strong>Ausgiebig · Stufe 3</strong> — der Marktbericht <strong>mit Wertermittlung nach ImmoWertV</strong>: Boden-, Ertrags- und Sachwert mit Liegenschaftszinssatz und Sachwertfaktor des Gutachterausschusses, Rechenweg und Quellennachweis. Diese drei Werte stehen nur in Stufe 3.\n\nFehlt ein Pflichtfeld, heißt der Knopf „was fehlt“ statt „abrufen“. Die Zeile „Für Stufe … fehlt noch“ listet die Felder, ein Klick springt hin — der Bericht rechnet nie halb.\n\nJede Stufe hat ihr eigenes Kontingent („… frei“): Stufe 2 ab Investor, Stufe 3 ab Pro. Vertiefst du ein Objekt später, wird nur eine Bewertung der neuen Stufe fällig; eine schon bezahlte Tiefe kostet beim erneuten Abruf nichts.'
        },
        {
          h: 'Der Bericht läuft im Hintergrund',
          body: 'Nach „abrufen“ öffnet sich ein Fenster mit Balken und acht Etappen: Standort ermitteln, Vergleichspreise, Vergleichsmieten, Mikrolage, Makrolage, Strukturdaten (Zensus), Bodenrichtwert, Bewertung und Bericht. Der Balken zählt nur Etappen, die der Server wirklich gemeldet hat — keine geschätzte Restzeit. Bei vielen gleichzeitigen Berichten siehst du deinen Platz in der Warteschlange.\n\nSo geht\'s:\n1. Klick <strong>Im Hintergrund weiter</strong> und arbeite normal weiter.\n2. Unten am Bildschirm steht eine Pille „Marktbericht in Arbeit · …“.\n3. Ist er fertig, kommt eine Meldung, und die Pille wird zu „✓ Marktbericht fertig · … — öffnen“. Ein Klick lädt das Objekt und zeigt den Bericht.\n\nAuch wenn du den Tab schließt, rechnet der Server zu Ende; abgebucht wird erst bei einem Ergebnis. Beim nächsten Laden sieht DealPilot bis zu 15 Minuten lang im Verlauf nach und meldet den fertigen Bericht. Klappt etwas nicht, steht dort „⚠ Marktbericht nicht erstellt“ mit dem Grund.'
        },
        {
          h: 'Alte Berichte wiederfinden',
          body: 'Jeder Abruf landet im Verlauf des Objekts. Du findest ihn an drei Stellen:\n\n• <strong>Deal-Aktion</strong> → Abschnitt <strong>Marktberichte</strong> („Erzeugte Berichte als PDF“): neueste zuerst, mit Datum, Uhrzeit und Marktwert. <strong>PDF</strong> lädt den Bericht herunter, ✕ löscht ihn endgültig. Drei stehen offen, der Rest hinter „… weitere anzeigen“. Ab zwei Berichten zeigt eine Zeile die Entwicklung des Marktwerts und den Knopf <strong>Verlauf ansehen</strong>.\n• <strong>Pilot-Analyse</strong> → Unter-Reiter <strong>Marktbericht-Verlauf</strong>. Er erscheint erst, wenn mindestens zwei Berichte mit Marktwert vorliegen.\n• Im Marktbericht selbst die Grafik <strong>Marktwert-Verlauf dieses Objekts</strong> mit Marktwert und Deal-Score über die Zeit. Beim ersten Bericht steht dort „Erster gespeicherter Stand“.\n\nNoch kein Bericht da? In Deal-Aktion führt <strong>Marktbericht erstellen</strong> direkt hin.'
        },
        {
          h: 'Verkehrswert ins Objekt übernehmen',
          body: 'Im Reiter Objekt, Karte <strong>Wertanker</strong>, steht unter dem Feld <strong>Verkehrswert</strong> die Auswahl aus dem Verlauf. Jede Zahl eines Berichts ist ein eigener Eintrag — „Ertragswert · Datum · Betrag“, „Sachwert · …“, „Marktwert · …“ —, neueste zuerst.\n\nSo geht\'s:\n1. Eintrag wählen. Hat der Bericht ein Verfahren als führend bestimmt, steht hinten „· führend“; den Grund zeigt der Tooltip.\n2. Darunter steht, was sich im Rechenweg gegenüber dem letzten Bericht derselben Art geändert hat („Unterschied zum Bericht vom …“).\n3. <strong>als Verkehrswert übernehmen</strong> klicken — der Betrag steht im Feld, und alles wird neu gerechnet.\n\nWelche Zahl als Verkehrswert gilt, entscheidest du; die Software trifft diese Wahl nicht. Der Marktwert ist eine Indikation aus Angebotspreisen und wird nie als führend markiert.'
        },
        {
          h: 'Bodenwert und Bodenrichtwert',
          body: 'Der Bodenwert geht in Ertrags- und Sachwert ein: Grundstücksfläche × Bodenrichtwert, danach — nur wenn angegeben — Anpassung für Zuschnitt oder Lage, Erschließungsbeitrag und bei Wohnungen der Miteigentumsanteil.\n\nDen Bodenrichtwert holt der Bericht selbst aus BORIS. Klappt der automatische Abruf für die Adresse nicht, nimmt er den Wert aus dem Feld <strong>Bodenrichtwert (€/m²)</strong> im Reiter Objekt. Dort helfen <strong>Bodenrichtwert abrufen</strong> (Direktabruf, gratis), <strong>BORIS-Portal</strong> und <strong>Bodenrichtwert schätzen</strong> — eine Schätzung bitte auf BORIS prüfen.\n\nGut zu wissen:\n• <strong>Eigentumswohnung ohne Miteigentumsanteil</strong>: kein Bodenwert („–“). Der volle Grundstückswert würde alles verzerren. Den Anteil findest du in der Teilungserklärung, meist als Bruch wie 125/1000.\n• Weicht die GFZ ab, wird nur mit einem eingetragenen Umrechnungskoeffizienten umgerechnet — einer wird nie erfunden.\n• Eine Anpassung trägst du unter <strong>Ansätze des Sachverständigen</strong> ein („Bodenwert-Anpassung (%)“ mit „Begründung der Anpassung“).'
        },
        {
          h: 'So rechnet DealPilot den Ertragswert',
          body: 'Allgemeines Ertragswertverfahren (§§ 27–34 ImmoWertV), im Rechenweg Zeile für Zeile:\n\n1. <strong>Rohertrag</strong> — marktübliche Miete × Wohnfläche × 12, plus Stellplätze. Die Miete kommt aus Angebotsmieten oder, wo das Modell des Ausschusses es vorsieht, aus seiner Mietpreisübersicht. Deine Ist-Miete dient nur dem Abgleich.\n2. <strong>− Bewirtschaftungskosten</strong> — vorrangig die Quote des Gutachterausschusses auf den gesamten Rohertrag, sonst Verwaltung je bewerteter Einheit, Instandhaltung je m² und Mietausfallwagnis nach Anlage 3, fortgeschrieben zum Stichtag, oder eine Pauschale. Die Zeile nennt den Ansatz.\n3. <strong>− Bodenwertverzinsung</strong> — nur der rentierliche Bodenwert × Liegenschaftszinssatz (§ 41).\n4. <strong>× Barwertfaktor</strong> aus Zins und Restnutzungsdauer (Anlage 2 aus den Modernisierungspunkten, sonst Gesamtnutzungsdauer minus Alter, mit Hinweis).\n5. <strong>+ Bodenwert</strong>, dazu besondere objektspezifische Merkmale.\n\nOhne Bodenwert rechnet das vereinfachte Verfahren ohne Bodenwerttrennung, mit Warnung. Bei Ein- und Zweifamilienhäusern ohne erfasste Miete erscheint kein Ertragswert.'
        },
        {
          h: 'So rechnet DealPilot den Sachwert',
          body: 'Sachwertverfahren mit den Normalherstellungskosten 2010 (NHK 2010):\n\n1. NHK-Kennwert (€/m² BGF, nach Gebäudeart und Standardstufe) × Bruttogrundfläche\n2. × Baupreisindex — derzeit eine feste Zahl: 1,91 (2010 → 01.01.2026), noch nicht je Ausschuss\n3. − Alterswertminderung aus Restnutzungs- und Gesamtnutzungsdauer\n4. + Garage, Außenanlagen, besondere Bauteile = Gebäudesachwert\n5. + Bodenwert = <strong>vorläufiger Sachwert</strong>\n6. × <strong>Sachwertfaktor</strong> des zuständigen Gutachterausschusses = marktangepasster Sachwert\n\nDer Faktor wird am vorläufigen Sachwert aus der Tabelle des Ausschusses abgelesen. Führt der Ausschuss in seinem Modell eine eigene Gesamtnutzungsdauer, rechnet der Bericht damit, sonst nach Anlage 1 — ein Faktor gilt nur für sein Modell (§ 21 Abs. 3).\n\nVoraussetzungen: Objektart, Standardstufe und Bruttogrundfläche, bei Häusern dazu Hausform, Geschosse und Dach. Fehlt etwas, steht statt der Zahl der Grund. Für Gewerbe und Garagen weist der Bericht keinen Sachwert aus.'
        },
        {
          h: 'Herkunft, Quellennachweis und fehlende Werte',
          body: 'Der Liegenschaftszins trägt immer eine Stufe: <strong>A</strong> amtlich für Gebiet und Objektart · <strong>B</strong> amtlich, übergeordnet oder Modellansatz · <strong>C</strong> amtlich aus einer Nachbargemeinde desselben Ausschusses · <strong>D</strong> gesetzlicher Auffangwert (§ 256 BewG, ausdrücklich nicht marktabgeleitet) · <strong>E</strong> eigene Angabe.\n\nUnter Zins und Sachwertfaktor steht, welcher Ausschuss die Werte für das Gebiet führt, ob sein Bericht kostenfrei oder kostenpflichtig ist, und der Link <strong>zur Quelle</strong>: wo eine Zahl steht, belegt er sie — wo keine steht, holst du sie dort. Ohne amtlichen Sachwertfaktor bleibt der Sachwert <em>vorläufig</em> (Faktor 1,0, ohne Marktanpassung) — eine Herstellungskostenrechnung, kein Marktwert. Einen Faktor aus dem Nachbarkreis oder ein Landesmittel setzt der Bericht nie ein.\n\nDer Block <strong>Quellennachweis</strong> nennt nur Ausschüsse, deren Zahlen wirklich im Bericht stecken — mit Kennzahl, Berichtsjahr und Lizenz.\n\nTipp: Die Leiste „Parameter der Verkehrswertermittlung“ im Reiter Objekt zeigt schon vor dem Abruf, was vorliegt.'
        }
      ]
    },
    /* v727-help-avm: Marktbewertung-Felder */
    {
      id: 'marktbewertung_felder',
      title: 'Marktbewertung — welche Felder zählen',
      icon: 'i-bar',
      desc: 'Objektangaben für die Marktbewertung',
      sections: [
        {
          h: 'Warum mehr Angaben = bessere Bewertung',
          body: 'Je vollständiger ein Objekt erfasst ist, desto genauer die Marktbewertung. Beispiel aus der Praxis: Nur mit Adresse + Wohnfläche ergab eine Bewertung 212.000 € mit hoher Unsicherheit — mit vollständigen Angaben (Zustand, Ausstattung, Baujahr, Grundstück) 251.000 € mit deutlich höherer Treffsicherheit. Es lohnt sich, die Felder im Tab „Objekt“ möglichst komplett auszufüllen.'
        },
        {
          h: 'Woraus die Marktbewertung entsteht',
          body: 'Der DealPilot-Marktbericht arbeitet in acht Etappen: Standort ermitteln, Vergleichspreise, Vergleichsmieten, Mikrolage, Makrolage, Strukturdaten (Zensus), Bodenrichtwert, Bewertung und Bericht. Makrolage und Zensus kommen aus DealPilots eigener Datenbank und werden regelmäßig aktualisiert. Zurück kommen Marktwert mit Spanne, Marktmiete und die Lage-Einschätzung — als Marktpreisindikation, ausdrücklich kein Gutachten nach § 194 BauGB.'
        },
        {
          h: 'Stufe 1, 2 und 3',
          body: '<strong>Einfach · Stufe 1</strong> — nur die Karte: Marktpreisindikation mit Spanne aus Adresse, Objektart, Fläche und Baujahr. Kein Bericht, die Werte bleiben am Objekt gespeichert.\n<strong>Mittel · Stufe 2</strong> — der Marktbericht: dazu Kaufpreis, Miete, Zustand, Energie, Ausstattung — mit Lage, Markt und Text, ohne Wertverfahren (ab Investor).\n<strong>Ausgiebig · Stufe 3</strong> — der Marktbericht mit Wertermittlung nach ImmoWertV: Boden-, Ertrags- und Sachwert, Rechenweg und Quellennachweis (ab Pro).\n\nFehlt für eine Stufe eine Angabe, sagt DealPilot welche — der Bericht rechnet nie halb. Jeder Abruf landet im Verlauf und steht am Verkehrswert zur Übernahme.'
        },
        {
          h: 'Woher die amtlichen Zahlen kommen',
          body: 'In Stufe 3 rechnet DealPilot mit dem Liegenschaftszinssatz und dem Sachwertfaktor des zuständigen Gutachterausschusses. Jede Zahl trägt ihre Herkunft — Ausschuss, Jahrgang, Lizenz, Stichtag — und steht im Quellennachweis des Berichts. Wie belastbar eine Zahl ist, zeigt ihre <strong>Herkunftsstufe A bis E und N</strong> (nächster Abschnitt).\n\n<strong>Sachwertfaktor:</strong> nur der des zuständigen Ausschusses. Fehlt er, heißt der Sachwert „vorläufig“, und der Bericht nennt Ausschuss und Weg zur Quelle — nie ein Nachbarkreis.\n<strong>Liegenschaftszinssatz:</strong> es gibt immer einen Wert, damit der Ertragswert rechnen kann. Fehlt der örtliche, nimmt DealPilot den nächstbesten — Landeswert, Bundesdurchschnitt, die DealPilot-Formel oder den gesetzlichen Auffangwert — und sagt das deutlich dazu, mit dem Hinweis, dass es genauer geht: den Zinssatz des zuständigen Ausschusses selbst eintragen.'
        },
        {
          h: 'Herkunftsstufen A bis E und N',
          body: 'Jeder Wert in der Wertermittlung trägt eine Stufe — sie sagt, wie weit du der Zahl trauen kannst:\n\n<strong>A · amtlich</strong> — vom zuständigen Gutachterausschuss, für genau dieses Objekt und Gebiet.\n<strong>B · amtlich, regional</strong> — aus dem Landesbericht; für den Kreis liegt kein eigener Wert vor.\n<strong>C · abgeleitet</strong> — amtlich, aber auf schmaler Datenbasis, ein Wert desselben Ausschusses für eine Nachbargruppe, oder eine örtliche Tabelle, die auf diese Objektart übertragen wurde.\n<strong>N · DealPilot-Formel</strong> — aus allen amtlichen Werten der Gutachterausschüsse abgeleitet: für Grundstücksgröße und WGFZ, und beim Liegenschaftszinssatz dort, wo der Ausschuss keinen Satz führt und die Formel gemessen genauer ist als der gesetzliche Auffangwert. Nie amtlich, immer so beschriftet.\n<strong>D · Auffangwert</strong> — der gesetzliche Auffangwert nach § 256 BewG: nicht marktabgeleitet, nur eine grobe Einordnung.\n<strong>E · eigene Angabe</strong> — was du selbst eingetragen hast; sie geht allen anderen vor.\n\nJe weiter unten, desto eher lohnt es sich, den örtlichen Wert nachzutragen — der Bericht sagt dir jeweils, wo er steht.'
        },
        {
          h: 'Tipp: Pflichtfelder zuerst',
          body: 'Pflicht für jede Bewertung sind PLZ, Ort, Straße, Objektart, Wohnfläche und Baujahr. Alles darüber hinaus ist optional, verbessert aber die Genauigkeit. Die kleinen Info-Symbole an den Feldern erklären, wofür jede Angabe relevant ist.'
        }
      ]
    },
    /* v2188: Bestand — Ankauf-Stand, Soll und Ist */
    {
      id: 'bestand',
      title: 'Bestand: Soll und Ist',
      icon: 'i-history',
      desc: 'Gewonnen, eingefroren, weitergepflegt',
      sections: [
        {
          h: 'Was beim Status „Gewonnen“ passiert',
          body: 'Im Reiter Deal-Aktion setzt du den Status auf <strong>Gewonnen</strong>. Steht im Reiter Objekt der <strong>Nutzen-/Lastenwechsel</strong> („Wirtsch. Übergang“), schreibt DealPilot den ganzen Datensatz zu diesem Tag fest — das ist das Soll. Fehlt das Datum, wird nichts eingefroren, und DealPilot sagt dir, was fehlt. Das heutige Datum wird nie stillschweigend eingesetzt.\n\nIn der Zeile darunter kannst du den Stand neu nehmen oder rückgängig machen.'
        },
        {
          h: 'Ist · heute und Soll · Ankauf-Stand',
          body: 'Oben im Objekt schaltest du zwischen <strong>Ist · heute</strong> (frei zu pflegen) und <strong>Soll · Ankauf-Stand</strong>. Das Soll ist gesperrt. Musst du es korrigieren, hak „zum nachträglichen Bearbeiten freigeben“ an — gespeichert wird dann mit Nachweis, das Ist bleibt unverändert.\n\nWarum eingefroren? Damit die Abweichung nach zehn Jahren noch etwas bedeutet. Wer den Maßstab mitwachsen lässt, misst am Ende nur noch sich selbst.'
        },
        {
          h: 'Bestand und Ankauf in der Liste',
          body: 'In der Seitenleiste filterst du unter „Stand“: <strong>Bestand</strong> zeigt die gewonnenen Objekte, <strong>Ankauf</strong> die Akquise. Verlorene Objekte bleiben mit allen Zahlen erhalten — ausgegraut am Ende der Ankauf-Liste.'
        },
        {
          h: 'In eine Gesellschaft überführen',
          body: 'Deal-Aktion → „In Gesellschaft überführen“. Der Assistent fragt den Stichtag, die Gesellschaft (GmbH/UG), den Verkehrswert als AfA-Basis und den übernommenen Zins. Er weist auf Grunderwerbsteuer und verdeckte Einlage hin und prüft die Zehnjahresfrist nach § 23 EStG. Danach friert das Privatobjekt ein, und ein verlinktes GmbH-Objekt entsteht mit Werten, Fotos und Analyse. Voraussetzung: die Gesellschaft ist unter Einstellungen als Mandant angelegt.'
        }
      ]
    },
    {
      id: 'cockpit',
      title: 'Portfolio-Cockpit',
      icon: 'i-portfolio',
      desc: 'Score, Kennzahlen, Steuer und Exporte über alle Objekte',
      sections: [
        {
          h: 'Aufbau: acht Abschnitte von oben nach unten',
          body: 'Das Cockpit zeigt dein Portfolio in nummerierten Abschnitten: <strong>01 Portfolio Score</strong> · <strong>02 Kennzahlen</strong> · <strong>03 Geteilte Objekte</strong> · <strong>04 Steuer über alle Objekte</strong> · <strong>05 Projektion & Verlauf</strong> · <strong>06 Gesamt-Projektion</strong> · <strong>07 Steuer-Mappe</strong> · <strong>08 Jahresabschluss</strong>.\n\nOben rechts wählst du unter <strong>Objekt</strong> entweder „Alle Objekte“ oder ein einzelnes gewonnenes Objekt — Score und Kennzahlen rechnen dann nur dieses. Im Pro-Plan stehen daneben Filter-Knöpfe je Halter („Alle“ plus deine Mandanten).\n\n<strong>03 Geteilte Objekte</strong> listet deine Quick-Boarding-Pässe; dort kannst du einen Pass „Verlängern“ oder „Beenden“. Geteilt wird im Objekt über „Quick Boarding teilen“.'
        },
        {
          h: 'Portfolio Score — so wird er berechnet',
          body: 'Der Portfolio Score fasst nur Objekte mit Status <strong>Gewonnen</strong> zusammen, für die ein Score gespeichert ist. Gibt es keines, steht dort: „Noch kein gewonnenes Objekt mit berechnetem Score.“\n\nSo wird gerechnet:\n• Je Objekt zählt der gespeicherte Investor Deal Score, sonst der DealPilot Score.\n• Der Gesamtwert ist das <strong>nach Kaufpreis gewichtete Mittel</strong> — ein großes Objekt zählt mehr als ein kleines.\n• Die fünf Balken darunter (Rendite, Finanzierung, Risiko & Vermietung, Lage & Diversifikation, Upside-Potenzial) entstehen genauso, jeweils von 0 bis 100.\n\nDie Stufe am Ring folgt der festen Kette: ab 85 Sehr gut, ab 70 Gut, ab 50 Solide, ab 35 Schwach, darunter Kritisch. Rechts steht der Portfolio-Pass mit „x / y bewertet“. Im Investor-Plan öffnet „Details & alle KPIs“ die Aufschlüsselung.'
        },
        {
          h: 'Kennzahlen: Kacheln mit Umschaltern',
          body: 'Abschnitt 02 rechnet über deine gewonnenen Objekte. Kacheln mit dem Zeichen ⇄ lassen sich anklicken:\n• <strong>Bestand</strong> — Objekte und Mieteinnahmen / Monat (netto kalt). Gibt es eingefrorene Ankauf-Stände, schaltet ein Klick auf „Ankauf-Stand“; dann steht dabei, über wie viele Objekte gerechnet wurde.\n• <strong>Investition</strong> — Gesamtinvestition mit oder ohne Nebenkosten, dazu die Restschuld.\n• <strong>Mietrendite</strong> — Bruttomietrendite (Jahresmiete / KP) und Nettomietrendite (nach BWK).\n• <strong>Cashflow</strong> — pro Monat und Jahr, per Klick vor oder nach Steuer.\n• <strong>Seit Ankauf</strong> — wie viele Objekte am DealScore gemessen besser oder schlechter stehen als beim Ankauf.\n\nAb dem Investor-Plan folgt eine zweite Reihe: Eigenkapital-Rendite (vor Steuer als Cash-on-Cash, nach Steuer als ROE), Ø-Zinssatz bzw. Zinsbindungs-Risiko (Bindung läuft in unter 3 Jahren aus), DSCR (ab 1,2 komfortabel) und Tilgungsfortschritt.'
        },
        {
          h: 'Steuer über alle Objekte',
          body: 'Abschnitt 05 rechnet mit den <strong>echten steuerlichen Ergebnissen</strong> deiner Objekte aus dem Tab Steuern — nicht mit Pauschalen. Erscheint ein Objekt nicht, ist es dort noch nicht gerechnet und gespeichert.\n\n<strong>Privat (Einkommensteuer, § 32a):</strong> Die Objekte stehen in der Reihenfolge ihres Kaufs. Jedes trifft auf das Einkommen, das die vorherigen schon verschoben haben. Die Tabelle zeigt je Objekt Ergebnis V+V, Basis vorher und nachher, Steuerwirkung und den Grenzsatz davor → danach. Ein ↓ heißt: dieses Objekt hat deinen Grenzsteuersatz gesenkt. Die Summe ist die echte Gesamtwirkung.\n\n<strong>Gesellschaft (Körperschaftsteuer):</strong> Sie wird getrennt von deinem privaten Einkommen gerechnet, mit festem Satz und ohne Progression. Fehlt der Satz, steht „nicht hinterlegt“ — eintragen kannst du ihn unter Einstellungen / Mandanten.'
        },
        {
          h: 'Projektion & Verlauf und Gesamt-Projektion',
          body: 'Die Abschnitte 06 und 07 sind als <strong>Modellprojektion (vereinfacht)</strong> gekennzeichnet. Sie rechnen mit pauschalen Annahmen: Mietsteigerung +1,5 % p.a., Bewirtschaftung +2,0 % p.a., Wertsteigerung +2,0 % p.a., AfA 2,0 % bei 80 % Gebäudeanteil, Kalkulationszins rund 3,5 %. Das zeigt dir Trend und Größenordnung. Die genaue Rechnung steht im jeweiligen Objekt.\n\n06 zeigt sieben Grafiken: Cashflow-Verlauf, Vermögens-Schere, Vermögensbilanz, Mittelverwendung, Wealth-Stacks, Klumpenrisiko und Steuer-Verlauf. Über <strong>10 J.</strong>, <strong>20 J.</strong> oder <strong>30 J.</strong> stellst du den Zeitraum ein. Ein Klick auf die Überschrift klappt den Abschnitt ein oder aus.\n\n07 ist die Tabelle dazu, Jahr für Jahr: Miete, BWK, Zins, Tilgung, AfA, CF vor St., V+V-Erg., Steuereffekt, CF nach St., Kum. CF, Restschuld, Wert und Eigenkapital.'
        },
        {
          h: 'Steuer-Mappe erstellen',
          body: 'Abschnitt 08 erzeugt ein PDF über <strong>alle</strong> Objekte mit erfassten Steuerdaten. Darin steht je Objekt eine Aufstellung der Werbungskosten und am Ende eine Zusammenfassung mit Summe.\n\nSo geht\'s:\n1. Unter <strong>Veranlagungsjahr</strong> das Jahr wählen. Zur Auswahl stehen nur Jahre, für die Steuerdaten da sind, jeweils mit der Zahl der Objekte. Vorausgewählt ist das letzte abgeschlossene Jahr.\n2. Den Haken <strong>Anlage-V-Zuordnung anhängen</strong> setzen oder entfernen.\n3. Auf <strong>Steuer-Mappe erstellen</strong> klicken.\n\nDie Zeilennummern stammen aus dem amtlichen Formular des jeweiligen Jahres. Für Jahre ohne hinterlegte Zuordnung erscheint die Ansicht nicht — die Nummern werden nicht geraten. Steht im Feld „keine Steuerdaten erfasst“, ist der Knopf gesperrt.'
        },
        {
          h: 'Jahresabschluss für GmbH und UG',
          body: 'Abschnitt 09 erscheint nur, wenn du unter Einstellungen / Mandanten eine <strong>GmbH oder UG</strong> angelegt hast. Er erstellt Bilanz und Gewinn- und Verlustrechnung über alle Objekte dieser Gesellschaft, dazu einen Anlagenspiegel je Objekt.\n\nSo geht\'s:\n1. Unter <strong>Gesellschaft</strong> die GmbH/UG wählen.\n2. Das <strong>Geschäftsjahr</strong> wählen.\n3. Auf <strong>Jahresabschluss erstellen</strong> klicken.\n\nWichtig: Das ist kein aufgestellter Jahresabschluss nach §§ 242 ff. HGB, sondern die Zahlen dafür in der Gliederung des HGB. Was DealPilot nicht kennt — Einlagen, Kautionen, laufende Bankbewegungen — steht als <strong>Verrechnungskonto Gesellschafter</strong> in der Bilanz. Die <strong>Kosten der Gesellschaft</strong> trägst du unter Einstellungen / Mandanten ein. Fehlen sie, sagt das PDF es auf der GuV-Seite.'
        }
      ]
    },
    {
      id: 'charts',
      title: 'Charts & Visualisierungen',
      icon: 'i-trending-up',
      desc: 'Portfolio-Auswertung und Charts',
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
          body: '5×5-Matrix: Zinsänderung (−2 bis +5 pp) gegen Mietänderung (−20 % bis +20 %). Jede Zelle zeigt den DSCR im Szenario. Grün ab 1,2, Hellgrün 1,0–1,2, Gold 0,8–1,0, Rot unter 0,8. Die Zelle ±0/±0 ist dein Base-Case.\n\nResilienz-Check: Wenn auch bei „−10 % Miete UND +1 pp Zins" der DSCR ≥ 1,0 bleibt, bist du Bank-tauglich.'
        }
      ]
    },
    {
      id: 'pdf',
      title: 'PDF-Export',
      icon: 'i-file-text',
      desc: 'Bank-taugliche PDF-Reports',
      sections: [
        {
          h: 'PDF-Export',
          body: 'Unter <strong>Aktionen → Export → PDF-Report für Objekt</strong> oder im Reiter <strong>Deal-Aktion → Investment-PDF</strong>. Erzeugt einen kompletten Investment-Case mit Cover, Executive Summary, Objekt & Finanzierung, 3-Phasen-Vergleich, Cashflow-Projektion über deinen Betrachtungszeitraum, Equity-Build-Charts, Wasserfall-Diagramm, Stress-Test, Pilot-Analyse (sofern erstellt) und Annahmen-Seite.\n\n<strong>Tipp:</strong> Öffne vorher einmal kurz den Reiter <strong>Bewertung</strong> — dann sind alle Grafiken gezeichnet.'
        },
        {
          h: 'Free-Plan-Wasserzeichen',
          body: 'Im Free-Plan trägt jedes PDF das Wasserzeichen „DealPilot Free“, in der Testphase „DealPilot Testphase“. Ab dem Starter-Plan ist es weg. Es ist halbtransparent und liegt sichtbar über den Inhalten.'
        }
      ]
    },
    {
      id: 'import',
      title: 'Import, Export und Belege',
      icon: 'i-download',
      desc: 'Exposés, Gutachten, Belege einlesen — PDFs, Sicherung und Tabellen ausgeben',
      sections: [
        {
          h: 'Wo du Import und Export findest',
          body: 'In der Seitenleiste öffnest du das Menü <strong>Aktionen</strong>:\n• <strong>Import</strong> (unter „Anlegen“) öffnet „Daten importieren“.\n• Unter „Ausgeben“ stehen <strong>Track Record</strong>, <strong>Bankexport</strong> und <strong>Export</strong> („Daten exportieren“).\n\nIm Reiter <strong>Deal-Aktion</strong> liegt der Block „PDFs herunterladen“: <strong>Investment-PDF</strong>, <strong>Finanzamt-PDF (Steuerformular)</strong>, <strong>Kaufpreisaufteilung (Finanzamt)</strong> und <strong>Track Record</strong> — jeweils mit den aktuellen Objektdaten.\n\nIn den Layout-Ansichten (etwa „Tower“) steht rechts eine Ausgaben-Liste: Exposé / Gesamt-PDF, Bankfassung, Marktbericht (nur wenn einer vorliegt), Kaufpreisaufteilung · BMF, Finanzamt-PDF (fragt nach dem Jahr), Track Record und Export.'
        },
        {
          h: 'Daten importieren: die drei Karten',
          body: 'Aktionen → <strong>Import</strong> zeigt drei Karten:\n\n• <strong>Dokument einlesen</strong> — ein PDF wie Grundbuch, Kataster, Kaufvertrag, WEG-Protokoll, Bodenrichtwert, Verkehrswert- oder Restnutzungsdauergutachten, Kaufpreisaufteilung oder Marktbericht. Die Art wird erkannt.\n• <strong>Excel-Kalkulation importieren</strong> — übernimmt alle Eingaben einer Excel-Datei in das <em>gerade geöffnete</em> Objekt. Erkannt werden <strong>ImmoKalk</strong>, <strong>immocation Roter Faden</strong> und <strong>immocation Pro</strong>. Achtung: bestehende Eingaben werden überschrieben.\n• <strong>JSON-Backup importieren</strong> — stellt eine DealPilot-Sicherung wieder her. Objekte mit gleichem Namen werden überschrieben. Ist die Sicherung verschlüsselt, fragt DealPilot nach dem Passwort. Plan- und Zahlungsdaten sind nicht enthalten, nur Objekte.'
        },
        {
          h: 'Exposé oder Marktbericht einlesen',
          body: '<strong>Im Quick-Check:</strong> Kachel <strong>Exposé / Marktbericht</strong> anwählen und <strong>Abrufen</strong> drücken. Es öffnet sich „PDF-Exposé importieren“ — für ImmoScout, Kleinanzeigen und Maklerexposés, PDF bis 100 MB.\n\n<strong>Im Objekt:</strong> dieselbe Kachel in der Pre-Flight-Leiste öffnet „Exposé & Marktbericht importieren“. Dort hängst du mehrere PDFs gleichzeitig an. Der Typ jeder Datei wird erkannt und lässt sich umstellen; alle Werte werden zusammengeführt, bei Widerspruch gewinnt der Marktbericht.\n\nSo geht\'s:\n1. PDF wählen oder hineinziehen.\n2. Die KI liest Kaufpreis, Fläche, Baujahr, Miete, Hausgeld und weitere Werte. Bei Scan-PDFs springt die Texterkennung ein.\n3. Unter „Daten erkannt“ abhaken, was du nicht willst.\n4. <strong>Ausgewählte übernehmen</strong>. Gefundene Bilder werden mit übernommen.'
        },
        {
          h: 'Gutachten und Auszüge lesen (Dokument einlesen)',
          body: '„Dokument einlesen“ bestimmt zuerst die Art des PDFs und zeigt die Trefferquote. Ist die Art unklar, wählst du sie aus einer Liste.\n\nDanach siehst du:\n• <strong>Gelesene Angaben</strong> — was aus dem Dokument kam.\n• <strong>Fehlende Pflichtangaben</strong> — ohne sie wird nicht gerechnet.\n• <strong>Unplausible Werte verworfen</strong> — mit dem Bereich, der erwartet war.\n• <strong>Ergebnis des fremden Gutachtens</strong> — diese Werte werden <strong>nicht übernommen</strong>. Sie dienen nur dem Abgleich: fremde Gutachten liefern Eingaben, keine Ergebnisse, gerechnet wird in DealPilot.\n\nMit <strong>Rohdaten anzeigen</strong> klappst du die vollständige Auslesung auf.\n\nWichtig: Ein gescanntes PDF ohne Textebene kann hier nicht gelesen werden — dafür ist die Texterkennung auf diesem Weg noch nicht eingebaut.'
        },
        {
          h: 'Belege einlesen (KI)',
          body: 'Zwei Wege, ein Fenster:\n• <strong>Anschaffungskosten</strong> — Deal-Aktion → Kaufpreisaufteilung → <strong>Belege</strong>. Notar, Makler, Grunderwerbsteuer, Gutachten, Fahrten usw. landen in den Feldern der Anschaffungskosten.\n• <strong>Laufende Werbungskosten</strong> — Reiter Steuer → <strong>Belege & Abrechnungen einlesen (KI)</strong>. Eine Hausgeldabrechnung wird in umlagefähig, nicht umlagefähig und Verwaltung aufgeteilt. Die Zuführung zur Erhaltungsrücklage wird erkannt, aber bewusst nicht übernommen.\n\nSo geht\'s:\n1. <strong>Ordner auswählen</strong> oder <strong>Einzelne Dateien</strong> — PDFs, Fotos, CSV oder Excel, bis zu 40 Belege je Lauf.\n2. Die KI liest Datum, Betrag, USt, Aussteller und Kategorie. Du bestätigst jede Zeile.\n3. Übernehmen. Bei den Werbungskosten zählt das Jahr: Zeilen ohne Jahr werden übersprungen, bis du es nachträgst.\n\n<strong>CSV-Auswertung</strong> lädt die Liste herunter.'
        },
        {
          h: 'Daten exportieren: PDF, Sicherung, Tabellen',
          body: 'Aktionen → <strong>Export</strong> zeigt vier Karten:\n• <strong>PDF-Report für Objekt</strong> — der mehrseitige Investment-Case für ein Objekt.\n• <strong>DealPilot-Sicherung</strong> — ein Objekt oder alle als Datei (.dpkt), mit Eingaben, Berechnungen, Pilot-Analysen und Fotos. Empfohlen vor jedem App-Update. Optional <strong>Mit Passwort verschlüsseln</strong> (AES-256), sonst ist die Datei Klartext.\n• <strong>Excel-Export</strong> — ein Objekt oder alle, eine Zeile je Objekt mit allen Kennzahlen.\n• <strong>Portfolio-CSV</strong> — alle Objekte plus Summenzeile, Semikolon-getrennt für Excel.\n\nBeim <strong>Investment-PDF</strong> fragt DealPilot nach der Fassung: <strong>Bankfassung</strong> (weißes Papier, Kennzahlen als Tabelle), <strong>hell</strong> oder <strong>Obsidian</strong>. Hast du „Diese Wahl merken“ angehakt, kommst du über den Knopf <strong>Fassung</strong> neben „PDF“ wieder an die Auswahl.'
        },
        {
          h: 'Track Record und Bankexport',
          body: '<strong>Track Record</strong> zeigt deine Objekte mit Score, Investment und Rendite. Ohne Haken bei „Alle Objekte anzeigen“ erscheinen nur gewonnene Deals — den Zuschlag setzt du im Reiter Deal-Aktion.\n• Klick auf eine Karte: <strong>Einzel-PDF</strong>.\n• Unten: <strong>Sammel-PDF (alle angezeigten Objekte)</strong> — als Nachweis für Bank, Partner und Netzwerk.\n\n<strong>Bankexport</strong> listet alle Darlehen deiner Objekte im Format AuswertungBank: Bank, Darlehenssumme, Zins, Tilgung, Zinsbindung, aktuelle Restschuld und mehr. Einzelne Darlehen nimmst du per Häkchen in der ersten Spalte heraus. Ausgabe über <strong>CSV exportieren</strong>, <strong>Excel exportieren</strong> oder <strong>PDF erstellen</strong>.\n\nDas Finanzamt-PDF und die Kaufpreisaufteilung erklärt das Thema „Steuer im Detail“.'
        }
      ]
    },
    {
      id: 'einstellungen',
      title: 'Einstellungen',
      icon: 'i-settings',
      desc: 'Die Reiter und was jeder steuert',
      sections: [
        {
          h: 'Die Reiter im Überblick',
          body: 'Links findest du die Reiter:\n• <strong>Account & Sicherheit</strong> — Login, Passwort, Zwei-Faktor, Account löschen, Telegram-Bot\n• <strong>Kontakt & Logo</strong> — Kontaktdaten und eigenes Logo für PDFs\n• <strong>Co-Pilot (KI)</strong> — Tonalität, Fokus, Instruktionen\n• <strong>Deal Score</strong> — Gewichtung, Schwellenwerte\n• <strong>Standardwerte</strong> — Vorgaben, die in jede Kalkulation einfließen\n• <strong>Darstellung</strong> — was angezeigt wird und wie es aussieht; ändert keine Zahl\n• <strong>Datenraum</strong> — geteilte Objekte und Portfolio-Pässe\n• <strong>Mandanten</strong> — Halter, Steuerregime, Steuerzeiträume\n• <strong>Plan</strong> — Abo, Kontingent, Abrechnung\n• <strong>Rechtliches</strong> und <strong>Hilfe</strong>\n\nUnten steht „Auto-Save aktiv · Änderungen werden direkt übernommen“. Mit <strong>Speichern</strong> sicherst du ausdrücklich, <strong>Abbrechen</strong> oder Esc schließt das Fenster.'
        },
        {
          h: 'Co-Pilot (KI) und Kontakt & Logo',
          body: 'Unter <strong>Co-Pilot (KI)</strong> legst du fest, wie die Pilot-Analysen schreiben (KI-Lage, Quick-Check, Investor Deal Score AI):\n• <strong>Detailgrad</strong>: kurz, mittel oder ausführlich\n• <strong>Tonalität</strong>: sachlich, beratend oder kritisch (Risiken zuerst)\n• <strong>Fokus-Schwerpunkte</strong> und <strong>Eigene Anweisungen</strong>\n• <strong>Eigenes Wissen für alle Piloten</strong>: geht an Pilot-Analyse, Portfolio-Pilot und Telegram-Bot. Trag dort keine Zahlen ein, die sich ändern — die holt die KI aus der echten Quelle.\n• <strong>Standard-Analyseparameter</strong> wie Investitionsstrategie, Verkäuferbereitschaft, eigene Risikotoleranz und aktuelle Marktphase. Pro Objekt im KI-Tab überschreibbar.\n\nUnter <strong>Kontakt & Logo</strong> stehen Adresse, Telefon, E-Mail und Webseite. Sie erscheinen im PDF-Footer und auf Track-Records. Über „Logo hochladen“ setzt du dein Logo in den PDF-Header (empfohlen: PNG, 300×100 px).'
        },
        {
          h: 'Deal Score: Gewichtung und Bewertungsprofile',
          body: '<strong>DealPilot Score (Quick-Check)</strong> — fünf Regler: Cashflow, Rendite (Nettomietrendite), Beleihung (LTV), Risiko (DSCR) und Potenzial (Wertpuffer und Mietsteigerung). Jeder geht von 0 bis 60 %, zusammen müssen es 100 % sein. „↺ Standard wiederherstellen“ setzt 30 / 25 / 15 / 15 / 15.\n\n<strong>Investor Deal Score</strong> (Investor/Pro, 24 KPIs) — oben wählst du ein <strong>Bewertungsprofil</strong>: Ausgewogen, Konservativ, Optimistisch, Lage-Fokus, Cashflow-Fokus oder Sicherheit. Darunter passt du Hauptgewichtungen, Untergewichtungen und Grenzwerte an. Grenzwerte trägst du im Format Wert:Punkte ein, z. B. 4:20, 5:50, 7:80, 9:100. Sobald du von Hand änderst, springt das Profil auf <strong>Benutzerdefiniert</strong>.\n\nBeide Scores hängen zusammen: Speicherst du eigene Regler, gelten sie sofort — bis du wieder ein Bewertungsprofil wählst. Dann rechnet auch der DealPilot Score mit dessen Gewichtung.'
        },
        {
          h: 'Standardwerte: deine Annahmen für neue Objekte',
          body: 'Diese Werte werden bei jedem neuen Objekt vorausgefüllt. Am Objekt kannst du sie jederzeit überschreiben.\n• <strong>Finanzierung</strong>: Standard-Tilgung, Standard-Zinsbindung (5, 10, 15 oder 20 Jahre), Eigener Zinssatz (leer = indikativer Pfandbrief-Satz der Bindung), Zins-Stufe (Bonität / LTV), Standard-Eigenkapital in % vom Kaufpreis.\n• <strong>Bewirtschaftung</strong>: umlagefähig und nicht umlagefähig in % der NKM, Kalkulatorischer Mietausfall, Hausgeld-Anteil.\n• <strong>Persönliche Mindest-Schwellen</strong>: Mindest-DSCR, Mindest-Cashflow / Monat, Maximaler LTV. Sie erscheinen als farbige Marker in den Kennzahlen.\n• <strong>Steuer</strong>: Grenzsteuersatz.\n• <strong>Standort & Nebenkosten</strong>: Bundesland (mit Grunderwerbsteuer-Satz), Notar & Grundbuch, Maklergebühr.\n\nUnten sicherst du mit <strong>Profil speichern</strong>. Mit <strong>Auf Defaults zurücksetzen</strong> stellst du die Vorgaben wieder her.'
        },
        {
          h: 'Lageklassen A · B · C und Bewirtschaftung je Objektart',
          body: '<strong>Lageklassen</strong>: Für A-, B- und C-Lage hinterlegst du je eine <strong>Zielrendite</strong> (% brutto). Vorbelegt sind 3,5 / 5,0 / 7,0 %. Im Quick-Check wählst du die Klasse, und DealPilot rechnet aus, auf welchen Kaufpreis du verhandeln müsstest. Mietausfall, nicht umlagefähige Bewirtschaftung und Eigenkapital je Klasse sind freiwillig — leer gelten deine Standardwerte. Unter „Standard für neue Quick-Checks“ legst du fest, welche Klasse vorausgewählt ist. Die Felder speichern sich sofort.\n\n<strong>Bewirtschaftung je Objektart</strong>: Startwerte für Eigentumswohnung (Hausgeld, Anteil nicht umlagefähig, eigene Rücklage), Ein-/Zweifamilienhaus und Mehrfamilienhaus (Verwaltung, Instandhaltung, Garage/Stellplatz, Betriebskosten). Daraus füllt DealPilot im Reiter Bewirtschaftung die leeren Felder, sobald Objektart und Wohnfläche feststehen. Eigene Eingaben am Objekt gehen vor. Der <strong>Fortschreibungsfaktor</strong> (1,60 für Stichtage ab 01.01.2026) passt du jährlich zum 1. Januar an.'
        },
        {
          h: 'Darstellung und Tooltip-Hilfe',
          body: 'Der Reiter <strong>Darstellung</strong> ändert keine Zahl, nur die Ansicht.\n• <strong>Aussehen</strong>: Seitenaufteilung, Objektkarten und Kartenstil wählen. „Zurücksetzen“ stellt Aufteilung, Darstellung und Marke auf den Auslieferungszustand.\n• <strong>Markt-Daten im Tab Finanzierung</strong>: Markt-Daten-Cards standardmäßig zugeklappt.\n• <strong>Investor Deal Score beim Öffnen</strong>: Score-Leiste standardmäßig minimiert.\n• <strong>Quickboarding — Auto-Übernahme</strong>: Standard-Quelle, z. B. „Konsens (Ø aller aktiven)“. Sie bestimmt, welcher Marktwert automatisch in die Grundmiete übernommen wird.\n• <strong>Bilder in Sicherung & Netzwerk</strong>: Objektfotos einbeziehen.\n• <strong>Marktbericht-Design</strong>: Hell oder Dunkel.\n\n<strong>Tooltip-Hilfe</strong> steuert die i-Symbole: <strong>Aus</strong> (keine Tooltips), <strong>Profi</strong> (nur wichtige — kritische Hinweise wie § 7b bleiben) oder <strong>Anfänger</strong> (alle anzeigen, Standard).'
        },
        {
          h: 'Mandanten und Steuerzeiträume',
          body: 'Unter <strong>Mandanten</strong> legst du fest, wer ein Objekt hält: Privat oder eine Gesellschaft. Am Objekt wählst du den <strong>Halter</strong>. Privat gibt es in allen Plänen; Gesellschaften (GmbH/UG) mit eigenem Steuerregime gehören zum <strong>Pro</strong>-Plan. Jede Karte zeigt, welche Objekte ihr gehören.\n\n<strong>Steuerzeiträume (Privat)</strong>: Klick bei Privat auf <strong>Bearbeiten</strong>. Dort pflegst du dein zu versteuerndes Einkommen über die Zeit:\n1. „Gültig von“ und „Gültig bis (leer = laufend)“ setzen.\n2. „zvE / Jahr (€)“, „Grund“ und optional eine Notiz eintragen.\n3. Hinzufügen. Überschneidet sich der Zeitraum mit einem bestehenden, zeigt DealPilot den Konflikt an.\nDer passende Zeitraum wird jedem Objekt nach Kaufdatum bzw. wirtschaftlichem Übergang zugeordnet.\n\n<strong>Gesellschaft</strong>: Identifikation, Körperschaftsteuer + Soli (Vorgabe 15,825 %), Gewerbesteuer-Hebesatz, erweiterte Kürzung, Buchhaltung (Kontenrahmen, Stammkapital …) und Kosten der Gesellschaft je Jahr. Über „Überführung starten“ bringst du ein Privat-Objekt in eine Gesellschaft.'
        },
        {
          h: 'Telegram-Bot verbinden',
          body: 'Der Telegram-Bot steht im Reiter <strong>Account & Sicherheit</strong>. Damit fragst du Objekte ab, änderst Felder, legst neue Objekte per Sprachnachricht an und rufst Portfolio-Zahlen ab — über deinen eigenen Bot.\n\nSo geht\'s:\n1. In Telegram <strong>@BotFather</strong> öffnen und <strong>/newbot</strong> schicken.\n2. Einen Namen vergeben und einen Benutzernamen, der auf „bot“ endet.\n3. Die Einwilligung lesen und anhaken. Deine Objektdaten gelangen dabei in die Vereinigten Arabischen Emirate, und Bot-Chats sind nicht Ende-zu-Ende-verschlüsselt.\n4. Den Token von BotFather einfügen und auf <strong>Bot verbinden</strong> klicken.\n5. <strong>Verbindungscode erzeugen</strong>, den Bot öffnen, <strong>/start</strong> schicken und den Code eintippen.\n\nDanach kannst du den Chat „Stilllegen“, „Trennen“ (löscht auch den Chatverlauf im Bot) oder den Bot ganz entfernen.'
        },
        {
          h: 'Plan und Kontingent',
          body: 'Im Reiter <strong>Plan</strong> siehst du oben <strong>Dein Kontingent</strong>, je Art getrennt: <strong>MPI</strong> (Marktpreisindikation), <strong>MPI+</strong> (erweiterte Marktpreisindikation) und <strong>WEV</strong> (Wertermittlung nach ImmoWertV). Dazu kommen zugekaufte Marktwert-Abrufe. Unter jeder Zahl steht, wie viel im Monat enthalten ist und wie viel dauerhaft dazugekauft wurde.\n\nWichtig:\n• Dein Monatskontingent gilt für den laufenden Monat. Was du nicht nutzt, verfällt. Zurückgesetzt wird am 1. des Monats.\n• Zugekaufte Bewertungen verfallen nie. Sie werden erst verbraucht, wenn das Monatskontingent leer ist.\n\nIn bezahlten Plänen legst du unter <strong>Bewertungspakete</strong> nach oder kaufst einzelne Bewertungen („Oder einzeln — genau die eine, die gerade fehlt“). Einzelne Bewertungen kosten mehr als im Kontingent. „Bewertungen nachkaufen“ öffnet die Preisübersicht.'
        }
      ]
    },
    {
      id: 'faq',
      title: 'Häufige Fragen',
      icon: 'i-question',
      desc: 'Antworten, nach Arbeitsablauf geordnet',
      sections: [
        {
          h: 'Wie rufe ich den Piloten?',
          body: 'Drück <strong>F1</strong> — das geht überall. Oder drück <strong>?</strong>, wenn du gerade nicht in einem Eingabefeld tippst. Du kannst den Piloten auch einfach <strong>anklicken</strong>: ein Klick öffnet den Tower, ein zweiter schließt ihn wieder.\n\nWo der Pilot wartet, stellst du in den Einstellungen unter <strong>Pilot · Hilfe auf F1</strong> ein:\n• <strong>Seitenleiste</strong> — steht im freien Platz über deinem Nutzerfeld (Standard)\n• <strong>Kopfleiste</strong> — nur Kopf und Mütze neben dem Hilfe-Symbol\n• <strong>Hauptbereich</strong> — unten am linken Rand des Inhalts\n• <strong>Nur auf F1</strong> — unsichtbar, bis du ihn rufst\n\nFehlt am gewählten Ort der Platz (Leiste eingeklappt, Handy), weicht er auf den nächsten Ort aus.'
        },
        {
          h: 'Wo steht der Pilot, und kann ich das ändern?',
          body: 'Standardmäßig wartet er in der <strong>Seitenleiste</strong> über deinem Nutzerfeld. Unter <strong>Einstellungen → Darstellung → „Pilot · Hilfe auf F1“</strong> wählst du: Seitenleiste, Kopfleiste (nur Kopf und Mütze neben dem Hilfe-Symbol), Hauptbereich (unten links im Inhalt) oder „Nur auf F1“ — dann ist er unsichtbar, bis du ihn rufst.'
        },
        {
          h: 'Wann speichert DealPilot mein Objekt?',
          body: 'Es gibt keinen eigenen Speichern-Knopf. DealPilot sichert das geöffnete Objekt automatisch:\n\n• beim <strong>Wechsel des Reiters</strong> (Objekt, Investition, Miete …),\n• beim <strong>Öffnen eines anderen Objekts</strong> und bei „Neues Objekt“,\n• bei Aktionen wie einer Pilot-Analyse oder einem Statuswechsel in der Deal-Aktion.\n\nIm Kopf erscheint dann kurz „Gespeichert · gerade eben“.\n\n<strong>Gut zu wissen:</strong> Gesichert wird erst, wenn ein Kaufpreis oder ein Ort eingetragen ist. Willst du den Tab schließen, während noch Änderungen offen sind, warnt dich der Browser. Wechsle im Zweifel einmal den Reiter — dann ist alles gesichert.'
        },
        {
          h: 'Wie dupliziere oder lösche ich ein Objekt?',
          body: 'Beides geht direkt auf der Objektkarte in der Seitenleiste:\n\n• <strong>⎘ Duplizieren</strong> legt eine Kopie an — mit Eingaben, Pilot-Analyse und Fotos. Die Kopie bekommt eine neue Objektnummer und startet ohne den Status Gewonnen oder Verloren.\n• <strong>× Löschen</strong> fragt „Objekt wirklich löschen?“ und entfernt das Objekt danach endgültig. Einen Papierkorb gibt es nicht.\n\n<strong>Tipp:</strong> Ist ein Deal nur geplatzt, setz im Reiter Deal-Aktion den Status <strong>Verloren</strong>, statt zu löschen. Das Objekt bleibt dann mit allen Zahlen erhalten — ausgegraut am Ende der Ankauf-Liste.'
        },
        {
          h: 'Wie sichere oder exportiere ich meine Daten?',
          body: 'In der Seitenleiste unter <strong>Aktionen → Export</strong> öffnet sich „Daten exportieren“:\n\n• <strong>PDF-Report für Objekt</strong> — der Investment-Case für Bank und Investoren.\n• <strong>DealPilot-Sicherung</strong> — ein Objekt oder alle als .dpkt-Datei, mit Eingaben, Pilot-Analysen, Bemerkungen und Fotos. Hak „Mit Passwort verschlüsseln“ an, sonst ist die Datei Klartext.\n• <strong>Excel-Export</strong> — eine Zeile je Objekt mit allen Kennzahlen.\n• <strong>Portfolio-CSV</strong> — alle Objekte plus Summenzeile.\n\nZurückspielen kannst du eine Sicherung über <strong>Aktionen → Import</strong>. Plan- und Zahlungsdaten sind nicht enthalten. Die Objekt-Sicherung gehört zum Pro-Plan.'
        },
        {
          h: 'Warum sind die Quellen in der Datenaufnahme ausgegraut?',
          body: 'Ist ein Objekt schon gefüllt, sperrt DealPilot das erneute Einlesen (Exposé, Sprache, ImmoMetrica) — ein neuer Abruf würde Felder überschreiben, die du schon gepflegt hast. Über den ausgegrauten Quellen steht dann der Knopf <strong>„Freigeben“</strong>. Ein Klick hebt die Sperre auf, danach liest du wie gewohnt ein.'
        },
        {
          h: 'Wie übernehme ich ein Inserat aus ImmoMetrica?',
          body: 'Zuerst den Zugang hinterlegen: <strong>Einstellungen → Account & Sicherheit → API-Keys externer Anbieter → ImmoMetrica</strong> (du brauchst dort ein Investor-Pro-Abo und den API-Token aus deinem ImmoMetrica-Dashboard).\n\nDanach steht in der Datenaufnahme — im Objekt und im Quick-Check — die Kachel <strong>ImmoMetrica</strong>. Du wählst Favoriten oder einen Suchauftrag, klickst ein Inserat an und hakst ab, welche Felder übernommen werden. Weicht die Adresse vom offenen Objekt ab, fragt DealPilot vorher nach.'
        },
        {
          h: 'Wie ändere ich die Score-Gewichtung?',
          body: '<strong>So geht\'s:</strong>\n1. Öffne <strong>Einstellungen → Deal Score</strong>.\n2. Im Abschnitt „DealPilot Score (Quick-Check)“ stellst du fünf Regler: Cashflow, Rendite (Nettomietrendite), Beleihung (LTV), Risiko (DSCR), Potenzial (Wertpuffer und Mietsteigerung).\n3. Die „Summe der Gewichtungen“ muss 100 % ergeben — sie wird grün. Sonst wird nicht gespeichert.\n4. „Speichern“ klicken.\n\n„↺ Standard wiederherstellen“ setzt 30 / 25 / 15 / 15 / 15 zurück.\n\n<strong>Ab Investor</strong> gibt es darunter den „Investor Deal Score“ mit einem „Bewertungsprofil“: Ausgewogen, Konservativ, Optimistisch, Lage-Fokus, Cashflow-Fokus oder Sicherheit. Passt du die Gewichte dort von Hand an, wechselt das Profil auf „Benutzerdefiniert“.'
        },
        {
          h: 'Warum sehe ich keinen Investor Deal Score?',
          body: 'Der Investor Deal Score bewertet 24 Kennzahlen und erscheint erst, wenn mindestens <strong>70 %</strong> davon ausgefüllt sind. Bis dahin steht dort „Bitte mindestens 70 % der Kennzahlen ausfüllen“ mit deinem aktuellen Stand.\n\n<strong>So geht\'s:</strong>\n1. Klick auf „📋 Welche KPIs fehlen noch?“ — die Liste zeigt die offenen Kennzahlen.\n2. Trag sie in den Reitern <strong>Objekt</strong> (Lage, Energieklasse, Zustand), <strong>Bewirtschaftung</strong> und <strong>Steuer</strong> nach.\n\nDie Kaufgrenzen (DSCR, Cashflow, LTV) zeigt DealPilot schon vorher — dafür reichen Kaufpreis, Miete und Finanzierung.\n\nDer Investor Deal Score gehört zum Investor- und Pro-Plan; im Free-Plan läuft er als Demo, im Starter-Plan ist er nicht enthalten.'
        },
        {
          h: 'Warum ist die DSCR im Chart anders als auf der Kennzahlen-Karte?',
          body: 'Beide nutzen NOI / Kapitaldienst. Bei Tilgungsaussetzung mit Bausparvertrag wird die Sparrate als wirtschaftlicher Tilgungsersatz mitgerechnet — sonst wäre der DSCR künstlich überhöht (Zinsen-only-Vergleich). Beide Stellen rechnen gleich.'
        },
        {
          h: 'Was ist der „Wert-Anker" in der Wertsteigerung?',
          body: 'Der Startwert für die Wertsteigerungs-Berechnung. Reihenfolge:\n1. Verkehrswert (§ 194 BauGB) wenn vorhanden\n2. Bankbewertung wenn höher als Kaufpreis\n3. Kaufpreis als Fallback\n\nBei einem Schnäppchen mit Kaufpreis 180k aber Verkehrswert 237k startet die Wertsteigerung also bei 237k — sonst würde der Wertpuffer als „Wertsteigerung" doppelt gezählt.'
        },
        {
          h: 'Wie wird die Anschlussfinanzierung simuliert?',
          body: 'Mit Haken bei „Eigene Anschlussfinanzierung“ (Reiter Finanzierung) rechnet DealPilot die Restschuld am Ende der Zinsbindung mit deinem Anschlusszins (vorbelegt 5,0 %) und deiner Anschluss-Tilgung (vorbelegt 1,0 %) weiter. Ohne Haken läuft das Darlehen zu den heutigen Konditionen weiter.\n\nDas Zinsänderungsrisiko ist die Mehrbelastung pro Monat aus dem Zinsunterschied auf die Restschuld — das rechnet DealPilot immer.'
        },
        {
          h: 'Was bedeutet „Anteil eigene Tasche"?',
          body: 'Der Betrag, um den die Summe aller Cashflows nach Steuern über den ganzen Zeitraum negativ ist — höchstens bis zur Höhe der Tilgung. So viel hast du unterm Strich nachgeschossen. Im Vermögenszuwachs wird er von der Tilgung abgezogen, weil das Geld nicht von „außen" kam.'
        },
        {
          h: 'Warum steht über der Pilot-Analyse „neu abrufen“?',
          body: 'Jede Pilot-Analyse merkt sich, wann sie erstellt wurde und mit welchen Zahlen. Oben im Reiter Pilot-Analyse steht deshalb der <strong>Stand</strong>:\n\n• „die Zahlen haben sich seitdem nicht geändert“ — die Analyse passt noch.\n• „seitdem hat sich … geändert“ — DealPilot nennt die Felder, z. B. Kaufpreis, Nettokaltmiete, Sollzins, Eigenkapital, Zustand oder Hausgeld. Die Texte können überholt sein.\n• „Diese Analyse gehört zu einem anderen Objekt“ — bitte neu abrufen, bevor du dich darauf stützt.\n\nÄltere Analysen ohne Datum sagen das ausdrücklich, statt Aktualität zu behaupten. Beim nächsten Abruf bekommen sie einen Stand.'
        },
        {
          h: 'Wo finde ich meine Marktberichte?',
          body: 'Jeder Bericht hängt an seinem Objekt.\n\n• <strong>Reiter Objekt, Feld Verkehrswert:</strong> Hier steht der letzte Bericht mit Datum und Wert. Gibt es mehrere, wählst du im Aufklappfeld — je Bericht Ertragswert, Sachwert und Marktwert einzeln — und übernimmst ihn mit „als Verkehrswert übernehmen“.\n• <strong>Reiter Pilot-Analyse:</strong> Ab zwei Berichten erscheint der Reiter „Marktbericht-Verlauf“ mit der Entwicklung des Werts.\n\n<strong>Während der Bericht entsteht:</strong> Ein Fenster zeigt acht Etappen. Mit „Im Hintergrund weiter“ arbeitest du weiter; unten zeigt eine Pille „Marktbericht in Arbeit“, danach „Marktbericht fertig — öffnen“. Schließt du die Seite, rechnet der Server trotzdem zu Ende.'
        },
        {
          h: 'Warum kann ich Stufe 3 nicht abrufen?',
          body: 'Im Reiter Objekt, Box „Marktbericht abrufen“, gibt es zwei Gründe:\n\n• <strong>Es fehlen Angaben.</strong> Der Knopf heißt dann „was fehlt“. Ein Klick zeigt „Für Stufe 3 fehlt noch:“ — jeder Eintrag springt zum Feld. Stufe 3 braucht zusätzlich zu Stufe 1 und 2 u. a. Nutzungsart, Grundstücksfläche, Bodenrichtwert und Bruttogrundfläche, bei einer ETW den Miteigentumsanteil, bei EFH, ZFH, DHH und RH die Hausform (NHK), Geschosse und Dachausbildung. Der Bericht rechnet nie halb.\n• <strong>Kein Kontingent mehr.</strong> Steht dort „0 frei“, ist der Knopf gesperrt. Die Wertermittlung ist ab Pro im Monatskontingent enthalten.\n\nFelder mit dem Schild „optional“ verfeinern nur — ohne sie gelten die Ansätze der Anlage 3 ImmoWertV.'
        },
        {
          h: 'Mein Kontingent ist aufgebraucht — was jetzt?',
          body: 'Das Kontingent zählt die drei Marktbericht-Stufen getrennt: Marktpreisindikation, Erweiterte Marktpreisindikation und Wertermittlung nach ImmoWertV. Deinen Stand siehst du unter <strong>Einstellungen → Plan</strong> (in bezahlten Plänen „Dein Kontingent“) und je Stufe als „frei“ in der Box „Marktbericht abrufen“.\n\n<strong>So geht\'s weiter:</strong>\n1. Warten: Das Monatskontingent wird zum Monatsanfang neu gesetzt. Nicht Verbrauchtes verfällt am Monatsende.\n2. Nachkaufen: Unter Einstellungen → Plan stehen „Bewertungspakete“ und „Oder einzeln — genau die eine, die gerade fehlt“. Zugekauftes verfällt nie und wird erst verbraucht, wenn dein Monatskontingent leer ist.\n\nNachkaufen geht in jedem bezahlten Plan; im Free-Plan ist dafür ein Upgrade nötig.'
        },
        {
          h: 'Das Inserat nennt keine Straße — kann ich trotzdem bewerten?',
          body: 'Ja. Viele Inserate veröffentlichen nur PLZ und Ort. Dann nimmt DealPilot den <strong>Ortskern</strong>: der Marktpreis kommt aus Vergleichsangeboten im Umkreis des Ortsmittelpunkts, der Bodenrichtwert aus der Zone am Ortskern. Das ist eine Einschätzung für den Ort, keine Messung am Haus — Mikrolage und Bodenrichtwert können am echten Standort abweichen.\n\nIm Quick-Check gilt die Straße dann als erfüllt, und am Feld steht der Hinweis. Trägst du die Straße später nach, rechnet alles für die echte Lage neu.'
        },
        {
          h: 'Warum steht beim Liegenschaftszins „gesetzlicher Auffangwert“?',
          body: 'DealPilot sucht den Liegenschaftszinssatz in fester Reihenfolge: <strong>amtlich, kreisscharf</strong> (zuständiger Gutachterausschuss) → <strong>amtlich, regional</strong> (Landesebene) → <strong>aus eigener Marktableitung</strong> → <strong>gesetzlicher Auffangwert n. § 256 BewG</strong>. Liegt für deinen Ort kein amtlicher Wert vor, rechnet der Ertragswert mit dem Auffangwert — als <em>indikativ</em> gekennzeichnet, nicht marktabgeleitet.\n\nDarunter nennt der Bericht den zuständigen Ausschuss mit Link zur Quelle, oft auch, warum dort kein verwertbarer Wert steht und ob der Bericht kostenpflichtig ist.\n\n<strong>Eigenen Wert setzen:</strong> In der Wertermittlung „▸ Werte selbst setzen“ aufklappen und „Liegenschaftszinssatz (%)“ eintragen. Er gilt dann als „eigene Angabe“.'
        },
        {
          h: 'Wie lege ich einen Steuerzeitraum an?',
          body: 'Ein Steuerzeitraum hält dein zu versteuerndes Einkommen (zvE) für eine Zeitspanne fest — etwa vor und nach einer Lohnerhöhung.\n\n<strong>So geht\'s:</strong>\n1. Im Reiter Steuer auf „📅 Steuerzeiträume verwalten →“ klicken. Es öffnet sich Einstellungen → Mandanten, dein privater Halter.\n2. Unter „Neuen Zeitraum hinzufügen“: „Gültig von“, „Gültig bis (leer = laufend)“, „zvE / Jahr (€)“, „Grund“ und „Notiz (optional)“ ausfüllen.\n3. „Hinzufügen“ klicken.\n\nÜberschneidet sich der Zeitraum mit einem bestehenden, fragt DealPilot nach. Je Objekt wird der passende Zeitraum über den „Wirtsch. Übergang“ zugeordnet — ein zvE, das du selbst ins Objekt geschrieben hast, bleibt stehen. Ändern mit „Bearb.“, löschen mit „×“.'
        },
        {
          h: 'Kann ich die Steuerwerte aus dem Vorjahr übernehmen?',
          body: 'Ja. Im Reiter <strong>Steuer</strong>, Detail-Ansicht, steht neben dem Veranlagungsjahr der Knopf <strong>„⧉ Werte aus [Vorjahr] übernehmen“</strong>. Er kopiert nur deine eigenen Werte für <strong>wiederkehrende</strong> Posten — Hausverwaltung, Nebenkosten, Kontoführung, Steuerberater, Fahrten und Ähnliches — und nur in Felder, die im Jahr noch leer sind.\n\nNie kopiert werden Schuldzinsen, AfA, Erhaltungsaufwand, anschaffungsnahe Kosten, Notar, Vermittlung und andere Einmal-Posten — die sind jedes Jahr anders.'
        },
        {
          h: 'Warum ist der Ankauf-Stand nicht eingefroren?',
          body: 'Der Ankauf-Stand (das Soll) wird nur festgeschrieben, wenn zwei Dinge zusammenkommen:\n• der Status im Reiter Deal-Aktion steht auf <strong>Gewonnen</strong>, und\n• im Reiter Objekt ist <strong>Wirtsch. Übergang</strong> (Nutzen-/Lastenwechsel) eingetragen.\n\nOhne dieses Datum passiert nichts — ein eingefrorener Stand mit falschem Datum sähe richtig aus und wäre es nicht. Beim Festschreiben-Versuch ohne Datum meldet DealPilot: „Erst den Nutzen-/Lastenwechsel im Reiter Objekt eintragen.“\n\n<strong>So geht\'s:</strong>\n1. Im Reiter Objekt das Datum bei „Wirtsch. Übergang“ setzen.\n2. In Deal-Aktion auf <strong>Gewonnen</strong> stellen — DealPilot schreibt den Stand dann automatisch fest und meldet es mit Datum.\n3. Hattest du „später“ geklickt, steht dort die Frage „Ankauf-Stand festschreiben?“ mit dem Knopf <strong>Festschreiben</strong>.\n\nGeht ein Objekt zurück auf Offen oder Verloren, ruht der Stand nur — er wird nicht gelöscht und ist beim erneuten Gewinnen wieder da.'
        },
        {
          h: 'Werden meine Daten weitergegeben?',
          body: 'Deine Objekte liegen auf unseren Servern in Deutschland. Für die KI-Funktionen — Pilot-Analyse, Pilot-Fragen, Diktat, Exposé- und Beleg-Einlesen — gehen die dafür nötigen Objektdaten an OpenAI in den USA: auch die Adresse, der Halter-Name und Fotos oder Dokumente, die du einliest. Deine Login-Daten (Name, E-Mail) gehen nicht dorthin. Stripe sieht nur Zahlungsdaten, keine Objektdaten. Einzelheiten stehen in der Datenschutzerklärung.'
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
          h: 'Annuitätendarlehen',
          body: 'Standard-Immobilienkredit in Deutschland. <strong>Konstante monatliche Rate</strong> (Annuität) über die ganze Laufzeit — innerhalb der Rate verschiebt sich nur das Verhältnis zwischen Zins-Anteil und Tilgungs-Anteil: am Anfang viel Zins und wenig Tilgung, am Ende umgekehrt.\n\n<strong>Vorteil:</strong> Planbarkeit, du weißt genau was monatlich abgeht.\n<strong>Typische Zinsbindung:</strong> 10, 15 oder 20 Jahre. Danach beginnt die Anschlussfinanzierung.'
        },
        {
          h: 'Anschlussfinanzierung',
          body: 'Wenn die Zinsbindung deines Darlehens endet, ist meist noch eine <strong>Restschuld</strong> offen. Diese muss neu finanziert werden — zu den dann aktuellen Marktkonditionen. Das nennt sich Anschlussfinanzierung.\n\n<strong>Risiko:</strong> Die Zinsen können sich erhöht haben. Wer 2014 für 1,5 % finanziert hat und 2024 die Anschlussfinanzierung braucht, zahlt plötzlich 4 % — die monatliche Rate kann sich verdoppeln.\n\n<strong>Forward-Darlehen:</strong> 3–5 Jahre vorm Ende der Zinsbindung kannst du die Konditionen der Anschlussfinanzierung bereits jetzt fest abschließen. Kostet einen kleinen Aufschlag, aber sichert dich gegen Zinsanstieg ab.'
        },
        {
          h: 'Beleihungswert',
          body: 'Der von der Bank intern angesetzte Wert deiner Immobilie — Basis für die <strong>LTV-Berechnung</strong>. Banken setzen ihn oft konservativer an als der Marktwert: meist 80–90 % des Verkehrswerts oder des Kaufpreises, je nachdem welcher niedriger ist.\n\n<strong>Warum konservativ?</strong> Im Insolvenzfall muss die Bank die Immobilie schnell verkaufen können — meist mit Abschlag zum Marktwert. Der Beleihungswert ist also der „sicher erzielbare Wert" in einer Notlage.\n\nDer Beleihungswert ist NICHT öffentlich kommuniziert — er ist Bank-intern. Du erfährst ihn meist nur indirekt über die Höhe der Finanzierungs-Zusage.'
        },
        {
          h: 'BMR (Bruttomietrendite)',
          body: 'Jahres-Kaltmiete / Kaufpreis × 100. <strong>Unbereinigte Rendite</strong> — gut für schnellen Vergleich, aber nicht aussagekräftig für tatsächlichen Ertrag.\n\nTypische Werte (Deutschland): A-Lagen 2,5–3,5 %, B-/C-Lagen 5–7 %, D-Lagen 7–9 %. Ausführliche Erklärung im Hilfethema „Kennzahlen verstehen“.'
        },
        {
          h: 'BSV (Bausparvertrag)',
          body: 'Spar- und Darlehensvertrag mit der Bausparkasse. In der Sparphase zahlst du eine Rate ein, bei Erreichen der Mindestsparquote wird der Vertrag zuteilungsreif → Sparguthaben + Bauspardarlehen lösen das Hauptdarlehen ab.'
        },
        {
          h: 'BWK (Bewirtschaftungskosten)',
          body: 'Laufende Kosten der Immobilie. Aufgeteilt in <strong>umlagefähig</strong> (auf Mieter abwälzbar — Heizung, Wasser, Müll) und <strong>nicht-umlagefähig</strong> (Hausgeld-Verwaltungsanteil, eigene Rücklage, Mietausfall-Kalkulation).'
        },
        {
          h: 'Cashflow',
          body: 'Was nach Abzug aller laufenden Kosten von der Miete übrig bleibt — pro Monat. Stufen: Bruttomiete → Kaltmiete → NOI → CF nach Zinsen → CF vor Steuern → CF nach Steuern.\n\n<strong>Faustregeln:</strong> Negativ = kritisch (zuzuschießen), 0–50 €/M = knapp, 50–150 €/M = solide, über 150 €/M = stark. Ausführliche Erklärung im Hilfethema „Kennzahlen verstehen“.'
        },
        {
          h: 'DealScore (0–100)',
          body: 'Eine Zahl von 0 bis 100 aus fünf Faktoren: Cashflow 30 %, Rendite 25 %, Beleihungsauslauf 15 %, Risiko 15 %, Potenzial 15 %. Stufen: ab 85 Sehr gut, ab 70 Gut, ab 50 Solide, ab 35 Schwach, darunter Kritisch. Gewichte und Vorlagen unter Einstellungen.'
        },
        {
          h: 'DSCR (Debt Service Coverage Ratio)',
          body: 'Wichtigste Bank-Kennzahl: Verhältnis von operativem Ertrag zu Kapitaldienst (Zins + Tilgung + BSV-Rate). Antwortet die Frage: „Reicht die Miete um Zins und Tilgung zu bezahlen?"\n\n<strong>Skala:</strong> 🟢 ≥ 1,2 solide · 🟡 1,0–1,2 knapp · 🔴 < 1,0 du musst zuzahlen. Ausführliche Erklärung im Hilfethema „Kennzahlen verstehen“.'
        },
        {
          h: 'EK-Rendite (p.a.)',
          body: 'Jährliche Rendite auf dein eingesetztes Eigenkapital über 10 Jahre — berücksichtigt Cashflow, Tilgung, Wertsteigerung, Steuervorteil.\n\n<strong>Typisch:</strong> 4–8 % solide, 8–15 % attraktiv, > 15 % starker Hebel-Effekt (meist niedriger EK-Einsatz). Bei Vollfinanzierung wird sie mathematisch unendlich — dann absoluter Vermögenszuwachs aussagekräftiger.'
        },
        {
          h: 'EM (Equity Multiple)',
          body: 'Wie oft sich dein Eigenkapital nach 10 Jahren zurückgespielt hat. EM 2,0x = aus 1 € EK sind 2 € geworden (EK + Gewinn).\n\n<strong>Skala:</strong> < 1,5x schwach, 1,5–2,5x solide, 2,5–4,0x stark, > 4,0x sehr stark.'
        },
        {
          h: 'EZB (Ende Zinsbindung)',
          body: 'Datum, an dem die Zinsbindung des Hauptdarlehens ausläuft. Danach beginnt die Anschlussfinanzierung — neuer Zinssatz, neue Konditionen.'
        },
        {
          h: 'Faktor (Vervielfältiger)',
          body: 'Kaufpreis / Jahres-Kaltmiete. Spiegelbild der BMR.\n\n<strong>Faktor 20 = ca. 5 % BMR, Faktor 25 = 4 %, Faktor 30 = 3,3 %.</strong>\n\nIn Deutschland: A-Lagen 30–40, B-/C-Lagen 15–22, D-Lagen 12–18.'
        },
        {
          h: 'GI (Gesamtinvestition)',
          body: 'Kaufpreis + Kaufnebenkosten (Notar, Grunderwerbsteuer, Makler) + Sanierung + Möblierung. Das ist der echte Geldbetrag, den du brauchst.'
        },
        {
          h: 'GrESt (Grunderwerbsteuer)',
          body: 'Vom Bundesland abhängige Steuer beim Immobilienkauf. DealPilot belegt den Satz über die PLZ vor (Stand 10/2026):\n\n• Bayern: 3,5 %\n• Baden-Württemberg, Niedersachsen, Rheinland-Pfalz, Sachsen-Anhalt, Thüringen: 5,0 %\n• Bremen, Hamburg, Sachsen: 5,5 %\n• Berlin, Hessen, Mecklenburg-Vorpommern: 6,0 %\n• Brandenburg, NRW, Saarland, Schleswig-Holstein: 6,5 %\n\nDie Sätze ändern sich gelegentlich — prüf vor dem Kauf den aktuellen Satz deines Landes.\n\nFällig direkt nach Notarvertrag. Wird vom Finanzamt per Bescheid eingefordert. Kein Recht auf Ratenzahlung — am besten von Anfang in Eigenkapital einplanen.'
        },
        {
          h: 'Hausgeld',
          body: 'Monatliche Zahlung der Eigentümer an die WEG-Hausverwaltung — deckt Betriebskosten, Verwaltung und Rücklagenbildung des Gemeinschaftseigentums ab.\n\n<strong>Zwei Teile:</strong>\n• <strong>Umlagefähiger Anteil</strong> (ca. 60–70 %): Heizung, Wasser, Müll, Strom Allgemeinflächen, Treppenhausreinigung — wird auf Mieter umgelegt\n• <strong>Nicht-umlagefähiger Anteil</strong> (ca. 30–40 %): WEG-Verwaltung, Instandhaltungsrücklage, Kontoführung — trägt der Vermieter\n\nTypisch: 250–450 €/Monat für eine 70 m² ETW.'
        },
        {
          h: 'Instandhaltungsrücklage',
          body: 'Geld, das die Eigentümergemeinschaft aufbaut für künftige Reparaturen am Gemeinschaftseigentum: Dach, Fassade, Heizungsanlage, Aufzug.\n\n<strong>Empfohlen:</strong> 1,00–1,50 €/m²/Monat (Faustregel). Bei einer 70 m² Wohnung also 70–105 €/Monat. Bei älteren Gebäuden oder hohem Reparaturstau höher.\n\nDie Rücklage gehört formell zur WEG, nicht zum einzelnen Eigentümer. Verkaufst du die Wohnung, geht dein Anteil zur Käuferin über — der Kaufpreis wird oft entsprechend gemindert oder erhöht je nach Rücklagen-Stand.'
        },
        {
          h: 'IRR (Internal Rate of Return)',
          body: 'Interner Zinsfuß. Komplexe Kennzahl die berechnet welche jährliche Rendite das Investment <strong>insgesamt</strong> erwirtschaftet, wenn alle Cashflows über die Haltedauer einbezogen werden — inklusive Schlussverkauf.\n\n<strong>Vorteil:</strong> Erlaubt fair Vergleich von Immobilie mit anderen Investments (ETF, Aktien, etc).\n\n<strong>Daumenregel:</strong> Über 8 % p.a. ist bei Wohnimmobilien sehr gut. Unter 4 % p.a. eher schwach — da könnten Tagesgeld + ETF mehr bringen ohne den Aufwand.'
        },
        {
          h: 'KNK (Kaufnebenkosten)',
          body: 'In NRW typisch: 6,5 % GrESt + 2,2 % Notar + 0–3,57 % Makler ≈ 9–12 % vom Kaufpreis.'
        },
        {
          h: 'LTV (Loan-to-Value, Beleihungsauslauf)',
          body: 'Verhältnis von Restschuld zu Immobilienwert. Wichtigste Risikokennzahl der Bank.\n\n<strong>DealPilot-Skala (D-Markt):</strong>\n• 🟢 < 85 % SOLIDE\n• 🟡 85–100 % ERHÖHT\n• 🔴 > 100 % KRITISCH\n\nAusführliche Erklärung im Hilfethema „Kennzahlen verstehen“.'
        },
        {
          h: 'Mietausfallwagnis',
          body: 'Kalkulatorischer Puffer für unvorhergesehenen Mietausfall: Leerstand bei Mieterwechsel, säumige Zahler, Mietminderungen. <strong>In DealPilot vorbelegt: 1 % der Nettokaltmiete</strong> (Einstellungen → Standardwerte). In der Wertermittlung nach ImmoWertV gilt der Ansatz der Anlage 3.\n\nBei 800 € Kaltmiete (= 9.600 €/Jahr) sind 1 % rund 96 €/Jahr Puffer — etwa dreieinhalb Tage Leerstand.\n\nIn ländlichen Gegenden oder bei einkommensschwachen Mietern manchmal höher (3–5 %).'
        },
        {
          h: 'NKM (Nettokaltmiete)',
          body: 'Kaltmiete ohne jegliche Nebenkosten. Basis für Renditerechnungen.'
        },
        {
          h: 'NMR (Nettomietrendite)',
          body: 'NOI / Gesamtinvestition × 100. Realistischere Rendite als die BMR.'
        },
        {
          h: 'NOI (Net Operating Income)',
          body: 'Kaltmiete minus nicht-umlagefähige Bewirtschaftung. Der „operative Rohgewinn" vor Finanzierung und Steuern.'
        },
        {
          h: 'Restschuld',
          body: 'Wie viel vom Darlehen am Ende der Zinsbindung noch übrig ist. Beispiel: Darlehen 200.000 €, Zinsbindung 10 Jahre bei 3,5 % Zins / 2 % Anfangstilgung → Restschuld nach 10 Jahren ca. 152.000 €.\n\n<strong>Höhere Tilgung = niedrigere Restschuld.</strong> Bei 3 % Anfangstilgung wären es nach 10 Jahren nur noch 128.000 € statt 152.000 €. Das reduziert auch das Zinsrisiko bei der Anschlussfinanzierung.'
        },
        {
          h: 'Sonder-AfA § 7b EStG (Neubau-Förderung)',
          body: 'Zusätzliche AfA für förderfähige Neubauten ab 2023. <strong>5 % p.a. über 4 Jahre</strong> = 20 % zusätzlicher Abschreibungs-Effekt OBEN drauf zur regulären 3 %-Neubau-AfA.\n\n<strong>Voraussetzungen (kumulativ):</strong>\n• Wohngebäude (keine Gewerbe-Einheiten)\n• Bauantrag/Bauanzeige zwischen 1.1.2023 und 30.9.2029\n• Effizienzhaus 40 mit Nachhaltigkeits-Klasse (QNG-Siegel)\n• Anschaffungs-/Herstellungskosten höchstens 5.200 €/m² Wohnfläche; abgeschrieben werden höchstens 4.000 €/m²\n• Erwerb im Jahr der Fertigstellung oder davor\n\n<strong>Steuerwirkung:</strong> Auf 30 Jahre gerechnet einer der stärksten Steuer-Hebel im Immobilienmarkt. Bei einem Neubau für 300k EUR mit Sonder-AfA = ca. 60k EUR steuerliche Werbungskosten zusätzlich verteilt auf 4 Jahre.'
        },
        {
          h: 'Tilgung-vom-Mieter',
          body: 'Anteil der Tilgung der durch die Mieteinnahmen finanziert wird — nicht aus deiner eigenen Tasche. Praktisch: <em>der Mieter zahlt dein Darlehen ab</em>.\n\n<strong>Formel:</strong> MIN(Tilgung gesamt; Cashflow nach Bewirtschaftung). Bei positivem Cashflow = volle Tilgung. Bei negativem = Differenzbetrag musst du zusätzlich aufbringen.\n\n<strong>Warum wichtig?</strong> Tilgung-vom-Mieter ist <strong>steuerfreier Vermögensaufbau</strong> — sie mindert nicht das zu versteuernde Einkommen aber baut Eigenkapital auf.'
        },
        {
          h: 'Tilgungssatz',
          body: 'Anfänglicher Tilgungsanteil als Prozentsatz der Darlehenssumme p.a. Standard in Deutschland 2025: <strong>2–3 % p.a.</strong>\n\n<strong>Höhere Tilgung = schnellere Schuldenfreiheit, aber höhere monatliche Rate.</strong>\n\nBeispiel 200.000 € Darlehen, 3,5 % Zins:\n• 1 % Tilgung: 750 €/M, schuldenfrei nach ca. 43 Jahren\n• 2 % Tilgung: 917 €/M, schuldenfrei nach ca. 30 Jahren\n• 3 % Tilgung: 1.083 €/M, schuldenfrei nach ca. 22 Jahren\n\nIn DealPilot ist 1,5 % vorbelegt; du änderst das unter Einstellungen → Standardwerte. Bei Eigennutzung sind 3 % oder mehr üblich.'
        },
        {
          h: 'Verkehrswert (§ 194 BauGB)',
          body: 'Marktwert der Immobilie nach Sachverständigem-Gutachten. Höher als Kaufpreis = Wertpuffer / „Schnäppchen-Bonus".'
        },
        {
          h: 'Wertgutachten / Verkehrswertgutachten',
          body: 'Schriftliche Bewertung einer Immobilie durch öffentlich bestellten und vereidigten Sachverständigen — nach gesetzlichen Vorgaben (ImmoWertV). Ermittelt den Verkehrswert nach § 194 BauGB.\n\n<strong>Methoden:</strong>\n• Vergleichswertverfahren (am häufigsten bei ETW)\n• Ertragswertverfahren (bei MFH / Renditeobjekten)\n• Sachwertverfahren (bei EFH)\n\n<strong>Kosten:</strong> 0,5–1,5 % vom Verkehrswert, mindestens 1.000–1.500 €.\n\n<strong>Wann sinnvoll?</strong> Bei Kreditverhandlungen, Erbschaftsstreit, Scheidung, Verkauf an Familie, oder wenn der Verkehrswert deutlich höher liegen könnte als der Kaufpreis (Wertpuffer dokumentieren).'
        },
        {
          h: 'Wertpuffer',
          body: 'Differenz zwischen Verkehrswert/Bankbewertung und Kaufpreis. Sicherheitsreserve gegen Marktwertverlust.\n\n<strong>Daumenregel:</strong> ≥ 10 % angemessen, ≥ 15 % komfortabel. Ausführliche Erklärung im Hilfethema „Kennzahlen verstehen“.'
        },
        {
          h: 'ZE (Zusatz-Erträge)',
          body: 'Erträge außer Kaltmiete: Stellplätze, Werbeflächen, Antennen-Vermietung etc. Werden zu NKM addiert.'
        },
        {
          h: 'Zinsrisiko',
          body: 'Differenz zwischen heutiger Rate und hochgerechneter Rate nach Ablauf der Zinsbindung — bei einem konservativen Anschlusszins-Szenario (DealPilot-Default 5,0 %).\n\n<strong>Reduzieren:</strong> Längere Zinsbindung (15–20 Jahre), höhere Tilgung, Sondertilgungen, Forward-Darlehen.'
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
      '<div class="help-modal-inner global-view-modal set-modal-v2 set-modal-cream">' +  /* v820-help-remove-so */
        '<div class="dp-modal-topband">' +'<div class="dp-mtb-brand"><span class="dp-mtb-logo">Deal<span class="dp-mtb-logo-g">Pilot</span></span><!--v821-logo-branding--><span class="dp-mtb-tag">HILFE</span>' +'<button type="button" class="set-modal-close dp-band-close" onclick="hideHelp()" aria-label="Schließen" title="Schließen (ESC)">' +'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +'</button>' +'</div>' +'<div class="dp-mtb-hero dp-mtb-hero-titled"><div class="dp-mtb-h-title">DealPilot Hilfe</div><div class="dp-mtb-h-sub">Begriffe, Kennzahlen, Praxis-Wissen</div></div>' +'</div>' +  /* v793-topband v843-x-in-band */
        // V118: Sidebar links (wie Settings) — Header + Topics-Liste + Search-Foot
        '<aside class="modal-side help-modal-side">' +
          '<div class="ms-h">' +
            '<div class="ms-title">' +
              '<span class="ic"><svg width="18" height="18"><use href="#i-help"/></svg></span>' +
              '<span class="gold">DealPilot Hilfe</span>' +
            '</div>' +
            '<div class="ms-sub">Begriffe, Kennzahlen, Praxis-Wissen</div>' +
          '</div>' +
          '<div class="help-modal-search" style="position:relative">' + /* v838b-search-icon */
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);opacity:0.55;pointer-events:none" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
            '<input type="text" id="help-search-input" placeholder="Suchen oder den Piloten fragen — Enter fragt" autocomplete="off" style="padding-left:36px">' +
          '</div>' +
          '<div class="settings-tabs ms-tabs help-sidebar-list" id="help-sidebar"></div>' +
        '</aside>' +

        // V118: Content rechts (wie Settings) — X-Button + Pane + AI-Bar als Footer
        '<div class="set-modal-content help-modal-content">' +
          /* v843-x-in-band: X-Button ins schwarze Band verschoben (siehe topband) */
          '<div class="pane-wrap help-content-wrap">' +
            '<main class="help-content" id="help-content"></main>' +
          '</div>' +
          /* v2200 · N63.2 · Marcel: „Frage den DealPilot-Agent, Webfenster und Fragen - das können
             wir rausnehmen … wenn, dann über den Piloten.“ Fragen stellt man oben im Suchfeld
             (Enter / „Den Piloten fragen“); die Antwort erscheint dort. */
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    /* v790-help-webtoggle-css */
    if (!document.getElementById('help-webtoggle-style')) {
      var _wt = document.createElement('style'); _wt.id = 'help-webtoggle-style';
      _wt.textContent = '.help-pilot-leiste{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}.help-pilot-frag{border:0;border-radius:10px;padding:9px 14px;font:600 13px "Space Grotesk",sans-serif;cursor:pointer;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));color:#1a1407;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.help-pilot-ab{font-size:12px;color:#6f675b;display:flex;flex-wrap:wrap;gap:6px;align-items:center}.help-pilot-ab button{border:1px dashed var(--wl-c9a84c, #C9A84C);background:transparent;border-radius:8px;padding:4px 9px;font:500 12px Inter,sans-serif;cursor:pointer;color:#5d4a17}#help-ki-oben .help-ai-answer{margin:0 0 14px;border:1px solid var(--wl-c9a84c, #C9A84C)}'
        + '.help-ai-web-toggle{display:inline-flex;flex:0 0 auto;align-items:center;gap:5px;font-size:11.5px;color:#6f675b;cursor:pointer;user-select:none;margin-right:8px;white-space:nowrap}/*v793-toggle-flex*/.help-ai-web-toggle input{accent-color:#C9A84C;cursor:pointer;margin:0}.help-ai-web-toggle span{font-weight:600}';
      document.head.appendChild(_wt);
    }

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
        '<span class="help-sidebar-item-desc">' + _escHtml(t.desc) + '</span>'; /* v838b-help-desc: Untertexte wieder an, gekuerzt */
      item.onclick = function() { _selectTopic(t.id); };
      sidebar.appendChild(item);
    });

    _renderTopic(HELP_TOPICS[0]);

    // Such-Eingabe
    document.getElementById('help-search-input').addEventListener('input', _onSearch);
    /* v2189: Enter im Suchfeld fragt den Piloten - die Antwort steht oben */
    document.getElementById('help-search-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); helpKiOben(); } });
    /* v2200: das Fuss-Eingabefeld gibt es nicht mehr */

    // Close bei ESC oder Click auf Backdrop
    /* v793i-no-outside-close: Klick-aussen-schliesst KOMPLETT entfernt. Modal schliesst nur
       noch via X-Button oder ESC. Verhindert versehentliches Schliessen bei Klick ins Modal. */
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

  /* v2200 · zusammengelegte Themen: alte Namen (Links, Pilot-Treffer) landen im neuen */
  var _ALIAS = { einstieg: 'ablaeufe', steuer: 'steuer_tief', faq_mehr: 'faq' };
  function _selectTopic(id) {
    if (_ALIAS[id]) id = _ALIAS[id];
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

  /* v789-kpi-viz: dezente Kennzahlen-Visuals im Feedback-Stil (nur 'kennzahlen'-Topic). */
  function _kpiVizCss() {
    if (document.getElementById('help-kpiviz-style')) return;
    var css = [
      '.hkv{border:1px solid rgba(0,0,0,.09);border-radius:12px;margin:0 0 16px;overflow:hidden;background:#fff}',
      '.hkv-h{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(0,0,0,.09)}',
      '.hkv-ic{width:34px;height:34px;border-radius:9px;flex:none;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#E8CC7A,#C9A84C);border:1px solid color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 50%, transparent)}',
      '.hkv-ic svg{width:18px;height:18px;stroke:#1c1502;fill:none;stroke-width:1.8}',
      '.hkv-h .t{font:700 14px Inter,system-ui,sans-serif;color:#1b1815}',
      '.hkv-h .s{font-size:11px;color:#6f675b;margin-top:1px}',
      '.hkv-b{padding:16px 18px}',
      '.hkv-row{display:grid;grid-template-columns:104px 1fr 80px;align-items:center;gap:13px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.05)}',
      '.hkv-row:last-child{border-bottom:0}',
      '.hkv-row .lab{font-size:12.5px;font-weight:600;color:#1b1815}',
      '.hkv-track{height:6px;background:#faf7f0;border-radius:3px;position:relative}',
      '.hkv-mark{position:absolute;left:0;top:0;height:6px;border-radius:3px;background:linear-gradient(90deg,#E8CC7A,#b8932f)}',
      '.hkv-val{font:700 12px "JetBrains Mono",monospace;color:#b8932f;text-align:right}',
      '.hkv-cap{grid-column:1/-1;font-size:10.5px;color:#6f675b;padding-left:117px;margin-top:-3px}',
      '.hkv-duo{display:grid;grid-template-columns:1fr 1fr;gap:13px}',
      '.hkv-col{border:1px solid rgba(0,0,0,.09);border-radius:9px;padding:12px 14px;background:#faf7f0}',
      '.hkv-col.acc{border-color:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 40%, transparent)}',
      '.hkv-col .k{font:700 10px "DM Sans",sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#9a7f33}',
      '.hkv-col .v{font:700 25px "Cormorant Garamond",Georgia,serif;margin-top:2px;color:#1b1815}',
      '.hkv-col .d{font-size:10.5px;color:#6f675b;margin-top:2px}',
      '.hkv-seg{display:flex;border:1px solid rgba(0,0,0,.09);border-radius:9px;overflow:hidden}',
      '.hkv-seg .sg{flex:1;padding:10px;text-align:center}',
      '.hkv-seg .sg .r{font:700 12px "JetBrains Mono",monospace}',
      '.hkv-seg .sg .l{font-size:10.5px;font-weight:600;margin-top:2px}',
      '.hkv-ftab{width:100%;border-collapse:collapse;font-size:13px}',
      '.hkv-ftab td{padding:8px 10px;border-bottom:1px solid rgba(0,0,0,.05)}',
      '.hkv-ftab tr:last-child td{border-bottom:0}',
      '.hkv-ftab .fc{font:700 14px "JetBrains Mono",monospace;color:#1b1815;width:56px}',
      '.hkv-ftab .ar{color:#C9A84C;width:26px;text-align:center}',
      '.hkv-ftab .rc{font:600 13px "JetBrains Mono",monospace;color:#6f675b;width:80px}',
      '.hkv-ftab .nc{color:#6f675b;font-size:12px}'
    ].join('');
    var st = document.createElement('style'); st.id = 'help-kpiviz-style'; st.textContent = css;
    document.head.appendChild(st);
  }
  function _kpiVizHtml() {
    _kpiVizCss();
    var icBar = '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>';
    var icScale = '<svg viewBox="0 0 24 24"><path d="M12 3v18"/><path d="M5 8h14"/><path d="M5 8l-2 5a3 3 0 006 0z"/><path d="M19 8l-2 5a3 3 0 006 0z"/></svg>';
    var icScore = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
    var icTab = '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg>';
    var h = '';
    /* Bruttomietrendite-Skala */
    h += '<div class="hkv"><div class="hkv-h"><span class="hkv-ic">' + icBar + '</span><div><div class="t">Bruttomietrendite</div><div class="s">Typische Werte nach Lage</div></div></div><div class="hkv-b">'
      + '<div class="hkv-row"><span class="lab">A-Lagen</span><span class="hkv-track"><span class="hkv-mark" style="width:35%"></span></span><span class="hkv-val">2,5\u20133,5\u00a0%</span><span class="hkv-cap">M\u00fcnchen, Hamburg, Frankfurt</span></div>'
      + '<div class="hkv-row"><span class="lab">B-/C-St\u00e4dte</span><span class="hkv-track"><span class="hkv-mark" style="width:62%"></span></span><span class="hkv-val">5\u20137\u00a0%</span><span class="hkv-cap">Herford, Dortmund, Kassel \u2014 \u201eSweet Spot\u201c</span></div>'
      + '<div class="hkv-row"><span class="lab">D-Lagen</span><span class="hkv-track"><span class="hkv-mark" style="width:85%"></span></span><span class="hkv-val">7\u20139\u00a0%</span><span class="hkv-cap">Chemnitz, Halle \u2014 h\u00f6here Rendite, h\u00f6heres Risiko</span></div>'
      + '</div></div>';
    /* Brutto vs Netto */
    h += '<div class="hkv"><div class="hkv-h"><span class="hkv-ic">' + icScale + '</span><div><div class="t">Brutto- vs. Nettomietrendite</div><div class="s">Netto zieht Kosten ab \u2014 liegt immer darunter</div></div></div><div class="hkv-b">'
      + '<div class="hkv-duo"><div class="hkv-col"><div class="k">Brutto</div><div class="v">6,0\u00a0%</div><div class="d">nur Kaufpreis \u00b7 vor Kosten</div></div>'
      + '<div class="hkv-col acc"><div class="k">Netto</div><div class="v" style="color:#2f8f57">4,0\u00a0%</div><div class="d">\u2212 Kosten \u00b7 inkl. Kaufnebenkosten</div></div></div>'
      + '</div></div>';
    /* DealScore-Leiste */
    h += '<div class="hkv"><div class="hkv-h"><span class="hkv-ic">' + icScore + '</span><div><div class="t">DealScore</div><div class="s">Eine Zahl 0\u2013100 aus acht Kennzahlen</div></div></div><div class="hkv-b">'
      + '<div class="hkv-seg">'
      + '<div class="sg" style="background:rgba(63,165,108,.20)"><div class="r" style="color:#2f8f57">85\u2013100</div><div class="l" style="color:#2f8f57">Sehr gut</div></div>'
      + '<div class="sg" style="background:rgba(63,165,108,.10)"><div class="r" style="color:#2f8f57">70\u201384</div><div class="l" style="color:#2f8f57">Gut</div></div>'
      + '<div class="sg" style="background:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 18%, transparent)"><div class="r" style="color:#9a7f33">50\u201369</div><div class="l" style="color:#9a7f33">Solide</div></div>'
      + '<div class="sg" style="background:rgba(201,140,60,.16)"><div class="r" style="color:#b5742a">35\u201349</div><div class="l" style="color:#b5742a">Schwach</div></div>'
      + '<div class="sg" style="background:rgba(184,98,92,.15)"><div class="r" style="color:#a8514a">0\u201334</div><div class="l" style="color:#a8514a">Kritisch</div></div>'
      + '</div></div></div>';
    /* Faktor-Tabelle */
    h += '<div class="hkv"><div class="hkv-h"><span class="hkv-ic">' + icTab + '</span><div><div class="t">Faktor \u2194 Bruttomietrendite</div><div class="s">Kaufpreis \u00f7 Jahresmiete \u2014 Spiegelbild der Rendite</div></div></div><div class="hkv-b">'
      + '<table class="hkv-ftab">'
      + '<tr><td class="fc">20\u00d7</td><td class="ar">\u2194</td><td class="rc">\u2248 5,0\u00a0%</td><td class="nc">B-/C-Lagen-Bereich</td></tr>'
      + '<tr><td class="fc">25\u00d7</td><td class="ar">\u2194</td><td class="rc">\u2248 4,0\u00a0%</td><td class="nc">solide bis gehoben</td></tr>'
      + '<tr><td class="fc">30\u00d7</td><td class="ar">\u2194</td><td class="rc">\u2248 3,3\u00a0%</td><td class="nc">A-Lagen-Einstieg</td></tr>'
      + '<tr><td class="fc">40\u00d7</td><td class="ar">\u2194</td><td class="rc">\u2248 2,5\u00a0%</td><td class="nc">Top-Lagen (M\u00fcnchen)</td></tr>'
      + '</table></div></div>';
    return h;
  }
  /* v2188: Einstieg in den Prozess-Atlas — eine kleine, laufende Vorschau
     (drei Stationen, ein Flugzeug) statt eines Textlinks. */
  function _atlasBannerHtml() {
    if (!document.getElementById('help-atlas-style')) {
      var st = document.createElement('style'); st.id = 'help-atlas-style';
      st.textContent = '.hab{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:16px;align-items:center;background:#050505;color:#f3ead0;border-radius:14px;padding:16px 18px;margin:0 0 16px;overflow:hidden;position:relative}'
        + '.hab svg{width:100%;max-width:360px;height:auto;display:block}'
        + '.hab .t{font:600 16px "Space Grotesk",sans-serif;color:#fdfcfa;margin-top:8px}.hab .s{font-size:12.5px;color:#b9ad8f;margin-top:2px}'
        + '.hab .kn{display:flex;flex-direction:column;gap:8px}'
        + '.hab button{border:0;border-radius:10px;padding:10px 14px;font:600 13px "Space Grotesk",sans-serif;cursor:pointer;background:linear-gradient(110deg,var(--wl-e8cc7a, #E8CC7A),var(--wl-c9a84c, #C9A84C) 55%,var(--wl-b8932f, #b8932f));color:#1a1407;white-space:nowrap}'
        + '.hab button.z{background:transparent;border:1px solid var(--wl-c9a84c, #C9A84C);color:var(--wl-e8cc7a, #E8CC7A)}'
        + '.hab .l{fill:none;stroke:color-mix(in srgb, var(--wl-c9a84c, #C9A84C) 50%, transparent);stroke-width:2;stroke-dasharray:4 6;animation:hab-f 1s linear infinite}'
        + '.hab rect{fill:#1f1b16;stroke:var(--wl-c9a84c, #C9A84C);stroke-width:1.2}.hab text{fill:#efe7d4;font:600 10px Inter,sans-serif}'
        + '.hab .fl{fill:var(--wl-e8cc7a, #E8CC7A)}'
        + '@keyframes hab-f{to{stroke-dashoffset:-10}}'
        + '.hab .fig{width:58px;cursor:pointer;background:none;border:0;padding:0;align-self:end}.hab .fig svg{width:58px;max-width:none}'
        + '.hab .fig:hover svg .arm-r{transform:rotate(130deg)}'
        + '@media (max-width:640px){.hab{grid-template-columns:auto minmax(0,1fr)}.hab>div:first-child{grid-column:1 / -1}.hab .fig{width:48px}.hab .fig svg{width:48px}}';
      document.head.appendChild(st);
    }
    var pfad = 'M88 30 C110 30 112 30 136 30 M224 30 C246 30 248 30 272 30';
    return '<div class="hab"><div>'
      + '<svg viewBox="0 0 360 60" aria-hidden="true">'
      + '<path class="l" d="' + pfad + '"/>'
      + '<rect x="2" y="12" width="86" height="36" rx="9"/><text x="45" y="34" text-anchor="middle">Quick-Check</text>'
      + '<rect x="136" y="12" width="88" height="36" rx="9"/><text x="180" y="34" text-anchor="middle">Ankauf</text>'
      + '<rect x="272" y="12" width="86" height="36" rx="9"/><text x="315" y="34" text-anchor="middle">Bestand</text>'
      + '<path class="fl" d="M-9 -1.4 L-2 -1.4 L3 -6.5 L5.6 -6.5 L2.4 -1.4 L7 -1.4 L9.5 -3.2 L10.8 -3.2 L9.6 0 L10.8 3.2 L9.5 3.2 L7 1.4 L2.4 1.4 L5.6 6.5 L3 6.5 L-2 1.4 L-9 1.4 Z"><animateMotion dur="3s" repeatCount="indefinite" rotate="auto" path="' + pfad + '"/></path>'
      + '</svg>'
      + '<div class="t">Prozess-Atlas — alle Abläufe als Netzplan</div>'
      + '<div class="s">Klick eine Station: Schritte klappen auf, Daten fliegen ein. Grün: wo dein Objekt gerade steht.</div></div>'
      /* v2200 · N63.1 · Marcel: der Pilot „neben Atlas öffnen in dem schwarzen Fenster, neben den Buttons“ */
      + (window.DealPilotFigur ? (DealPilotFigur.css(), '<span class="fig" role="button" tabindex="0" title="Pilot rufen (F1)" onclick="hideHelp(); window.DealPilotPilot && DealPilotPilot.rufen()">' + DealPilotFigur.svg({ koffer: true }) + '</span>') : '')
      + '<div class="kn"><button type="button" onclick="window.DealPilotAtlas && DealPilotAtlas.oeffne()">✈ Atlas öffnen</button>'
      + '<button type="button" class="z" onclick="hideHelp(); window.DealPilotPilot && DealPilotPilot.rufen()">Pilot rufen · F1</button></div></div>';
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
    /* v2188: Prozess-Atlas und Pilot oben im Thema „Abläufe & Pilot“ (v2200: vor der Tour) */
    if (topic.id === 'ablaeufe') { html += _atlasBannerHtml(); }
    // BlockA3: Tour-Banner OBEN im Einstieg-Topic — direkter innerHTML, kein Filter
    if (topic.id === 'ablaeufe') {   /* v2200: Einstieg ist in „Abläufe“ aufgegangen */
      html +=
        '<div class="dp-tour-banner">' +
          '<div class="dp-tour-banner-icon">' +
            '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
              '<circle cx="12" cy="12" r="10"/>' +
              '<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>' +
            '</svg>' +
          '</div>' +
          '<div class="dp-tour-banner-text">' +
            '<div class="dp-tour-banner-title">Interaktive App-Tour</div>' +
            '<div class="dp-tour-banner-desc">Lass dich Schritt-für-Schritt durch DealPilot führen — alle wichtigen Tabs, Felder und Funktionen werden direkt in der App erklärt.</div>' +
          '</div>' +
          '<button type="button" class="dp-tour-banner-btn" onclick="window.helpStartTour && window.helpStartTour()">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
              '<polygon points="5 3 19 12 5 21 5 3"/>' +
            '</svg>' +
            '<span>Tour starten</span>' +
          '</button>' +
        '</div>';
    }
    /* v789-kpi-viz: Visuals oben im Kennzahlen-Topic */
    if (topic.id === 'kennzahlen') { html += _kpiVizHtml(); }
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
  /* v2189 · Suche nach WÖRTERN statt nach der ganzen Zeichenkette.
     Bis hier fand „ankauf einfrieren“ nichts, weil genau diese Folge in
     keinem Text steht — „eingefroren“ und „Ankauf-Stand“ schon. Umlaute
     und ß werden gleichgesetzt, Füllwörter zählen nicht.
     Marcel, 13.10.2026: „die Hilfe muss direkt, wenn ich was eingebe und
     die KI frage, die Antwort zeigen." Oben steht deshalb der Knopf „Den
     Piloten fragen“, und die KI-Antwort erscheint AN DIESER STELLE, nicht
     im Fuß des Fensters. Enter im Suchfeld fragt ebenfalls. */
  var _FUELL = ' ich du der die das den dem des ein eine einen und oder wie was wo wann warum ist sind kann muss soll mit von zu zum zur im in an am auf fuer bei aus ob wenn dann dass nicht mein meine hier auch noch bitte gibt habe hat ';
  function _norm(s) {
    return String(s || '').toLowerCase().replace(/<[^>]+>/g, ' ')
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9%§ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* v2189d · Stamm und Synonyme. Gemessen: „ankauf einfrieren“ fand nichts
     (die Texte sagen „eingefroren“, „festgeschrieben“), „steuerzeitraum
     anlegen“ fand die FAQ „Wie lege ich einen Steuerzeitraum an?“ nicht.
     Jedes Suchwort wird zu einer LISTE von Formen; getroffen ist es, wenn
     eine davon im Text steht. Der Pilot (pilot-tower.js) nutzt dieselbe Liste. */
  var _SYN = {
    einfrier: ['eingefroren', 'festgeschrieben', 'festschreib', 'einfrier'],
    anleg: ['anleg', 'lege', 'hinzufueg', 'neuen'],
    ruf: ['ruf', 'f1'],
    loesch: ['loesch', 'entfern'],
    aender: ['aender', 'bearbeit', 'anpass', 'einstell'],
    finde: ['find', 'wo ', 'steht'],
    kost: ['kost', 'kontingent', 'preis'],
    gewonn: ['gewonn', 'gewinn', 'zuschlag'],
    verlor: ['verlor', 'verlust', 'abgesagt'],
    exportier: ['export', 'pdf', 'herunterlad']
  };
  function _stamm(w) { return w.length > 6 ? w.slice(0, w.length - 2) : (w.length > 4 ? w.slice(0, w.length - 1) : w); }
  function _formen(w) {
    var st = _stamm(w), f = [st];
    Object.keys(_SYN).forEach(function (k) { if (st.indexOf(k) === 0 || k.indexOf(st) === 0) f = f.concat(_SYN[k]); });
    return f;
  }
  function _woerter(q) {
    return _norm(q).split(' ').filter(function (w) { return w.length >= 3 && _FUELL.indexOf(' ' + w + ' ') < 0; }).map(_formen);
  }
  function _trifft(text, formen) { for (var i = 0; i < formen.length; i++) if (text.indexOf(formen[i]) >= 0) return true; return false; }
  /* v2189f · Marcel, 13.10.2026: „vielleicht die Fragen auch an die KI
     schicken? Kriegen wir dann bessere Antworten in der Hilfe?" Eine FRAGE
     (endet auf ?, beginnt mit einem Fragewort, oder hat mindestens fünf
     Wörter) geht nach einer Tipp-Pause von selbst an die KI. Ein Stichwort
     wie „DSCR" nicht - sonst kostet jedes Wort einen Abruf vom Tageslimit. */
  function istFrage(q) {
    q = String(q || '').trim().toLowerCase();
    if (q.length < 8) return false;
    if (/\?$/.test(q)) return true;
    if (/^(wie|was|warum|wieso|weshalb|wo|wann|welche|welcher|welches|kann|muss|soll|darf|gibt|ist|sind|lohnt|brauche|wer)\s/.test(q)) return true;
    return q.split(/\s+/).length >= 5;
  }
  var _autoT = null, _autoZuletzt = '';
  function _autoKi(roh) {
    clearTimeout(_autoT);
    if (!istFrage(roh)) return;
    _autoT = setTimeout(function () {
      var inp = document.getElementById('help-search-input');
      if (!inp || inp.value.trim() !== roh || roh === _autoZuletzt) return;
      _autoZuletzt = roh; helpKiOben();
    }, 1400);
  }
  function _onSearch(e) {
    var roh = (e.target.value || '').trim();
    var q = roh.toLowerCase();
    if (q.length < 2) {
      // Suche zurücksetzen → letztes Topic wieder anzeigen
      var lastId = HELP_TOPICS[0].id;
      try { lastId = localStorage.getItem('dp_help_last_topic') || lastId; } catch(_) {}
      _selectTopic(lastId);
      return;
    }
    var w = _woerter(q); if (!w.length) w = [[_norm(q)]];
    var hits = [];
    HELP_TOPICS.forEach(function(t) {
      t.sections.forEach(function(s) {
        var kopf = _norm(s.h), blob = kopf + ' ' + _norm(s.body), p = 0, n = 0;
        w.forEach(function (x) { if (_trifft(kopf, x)) { p += 3; n++; } else if (_trifft(blob, x)) { p += 1; n++; } });
        if (n && n / w.length >= 0.5) hits.push({ topic: t, section: s, p: p + (n === w.length ? 3 : 0) });
      });
    });
    hits.sort(function (a, b) { return b.p - a.p; });
    var c = document.getElementById('help-content');
    if (!c) return;
    var ablauf = [];
    try { if (window.DealPilotPilot) ablauf = DealPilotPilot.suche(roh, 6).filter(function (x) { return x.art === 'ablauf'; }).slice(0, 3); } catch (x) {}
    var html = '<div class="help-pilot-leiste">'
      + '<button type="button" class="help-pilot-frag" onclick="helpKiOben()">✦ Den Piloten fragen: „' + _escHtml(roh) + '“</button>'
      + (ablauf.length ? '<span class="help-pilot-ab">Im Prozess-Atlas: ' + ablauf.map(function (a) {
          return '<button type="button" onclick="DealPilotAtlas.oeffne(\'' + a.ziel.atlas + '\',\'' + a.ziel.station + '\')">' + _escHtml(a.t) + '</button>';
        }).join('') + '</span>' : '')
      + '</div><div id="help-ki-oben"></div>';
    _autoKi(roh);
    if (!hits.length) {
      c.innerHTML = html + '<div class="help-empty">' +
        '<h2>Keine Treffer für „' + _escHtml(roh) + '“</h2>' +
        '<p>In den Hilfetexten steht dazu nichts wörtlich. Drück Enter oder den Knopf oben — dann beantwortet der Pilot die Frage mit KI und kennt dabei dein geöffnetes Objekt.</p>' +
        '</div>';
      c.scrollTop = 0;
      return;
    }
    html += '<div class="help-topic-head">' +
      '<h2>' + hits.length + ' Treffer für „' + _escHtml(roh) + '“</h2>' +
    '</div>';
    hits.slice(0, 25).forEach(function(hit) {
      html += '<div class="help-section help-section-hit">' +
        '<div class="help-hit-topic">' + _escHtml(hit.topic.title) + '</div>' +
        '<h3>' + _escHtml(hit.section.h) + '</h3>' +
        '<div class="help-section-body">' + _renderBody(hit.section.body) + '</div>' +
      '</div>';
    });
    c.innerHTML = html;
    c.scrollTop = 0;
  }
  function helpKiOben() {
    var inp = document.getElementById('help-search-input');
    var q = (inp && inp.value || '').trim();
    var box = document.getElementById('help-ki-oben');
    if (!q) return;
    if (!box) { _onSearch({ target: inp }); box = document.getElementById('help-ki-oben'); }
    if (!box) return;
    box.innerHTML = '<div class="help-ai-loading"><span class="help-ai-dot"></span><span class="help-ai-dot"></span><span class="help-ai-dot"></span><span class="help-ai-loading-text">Der Pilot denkt nach…</span></div>';
    var c = document.getElementById('help-content'); if (c) c.scrollTop = 0;
    _callHelpAI(q).then(function (a) {
      box.innerHTML = '<div class="help-ai-answer help-ki-oben-a"><div class="help-ai-answer-q"><strong>Pilot</strong> · ' + _escHtml(q) + '</div><div class="help-ai-answer-a">' + _renderBody(a) + '</div></div>';
    }).catch(function (err) {
      box.innerHTML = '<div class="help-ai-error">⚠ Der Pilot konnte gerade nicht antworten: ' + _escHtml(err.message || 'unbekannter Fehler') + '</div>';
    });
  }
  window.helpKiOben = helpKiOben;

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
  /* v790-help-copilot: echter Agent ueber /ai/copilot (kennt Objekt, Kerosin-frei). */
  var _helpHistory = [];
  function _helpResetHistory() { _helpHistory = []; }
  function _helpBuildContext() {
    try {
      if (typeof window._buildAIPayload === 'function') {
        var p = window._buildAIPayload();
        if (p && typeof p === 'object') { var c = Object.assign({}, p); delete c.userApiKey; delete c.apiKey; delete c.openai_api_key; return c; }
      }
    } catch (e) {}
    try { if (window._currentObjData && typeof window._currentObjData === 'object') return window._currentObjData; } catch (e) {}
    return {};
  }
  function _helpWebAllowed() {
    try { var t = document.getElementById('help-ai-web'); return !!(t && t.checked); } catch (e) { return false; }
  }
  function _callHelpAI(question) {
    return new Promise(function(resolve, reject) {
      if (typeof Auth !== 'undefined' && Auth.apiCall && Auth.isApiMode && Auth.isApiMode()) {
        var body = {
          message: question,
          context: _helpBuildContext(),
          history: _helpHistory.slice(-10),
          /* v2189: dieselben Hilfe-Auszuege wie der Tower */
          hilfe: (function () { try { return window.DealPilotPilot ? DealPilotPilot.suche(question, 6).map(function (x) { return { art: x.art, titel: x.t, text: String(x.b || '').slice(0, 900) }; }) : []; } catch (e) { return []; } })(),
          allowWeb: _helpWebAllowed()
        };
        Auth.apiCall('/ai/copilot', { method: 'POST', body: body })
          .then(function(data) {
            var ans = (data && (data.reply || data.answer || data.text)) || '';
            if (!ans) { reject(new Error('Antwort vom Server war leer')); return; }
            _helpHistory.push({ role: 'user', content: question });
            _helpHistory.push({ role: 'assistant', content: ans });
            resolve(ans);
          })
          .catch(function(e) {
            if (e && e.status === 429) { reject(new Error('Tageslimit für KI-Fragen erreicht \u2014 morgen wieder verfügbar.')); return; }
            if (e && e.status === 503) { reject(new Error('KI momentan nicht konfiguriert. Bitte sp\u00e4ter erneut versuchen.')); return; }
            if (e && (e.status === 404 || e.status === 405)) { resolve(_localFallback(question)); return; }
            reject(e);
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
      /* v2200 · N63.1 · Marcel: „wenn wir die Hilfe öffnen, dann auch direkt die
         Abläufe und Pilot anzeigen“ - immer der Einstieg, nicht das letzte Thema. */
      _selectTopic('ablaeufe');
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
  /* v2188: der Pilot (pilot-tower.js) liest die Themen und springt hinein */
  window.DealPilotHilfe = {
    themen: function () { return HELP_TOPICS; },
    formen: function (q) { return _woerter(q); },
    oeffne: function (id, h) {
      showHelp(); _selectTopic(id);
      if (h) setTimeout(function () {
        var c = document.getElementById('help-content'); if (!c) return;
        var hs = c.querySelectorAll('.help-section h3');
        for (var i = 0; i < hs.length; i++) if (hs[i].textContent === h) { hs[i].scrollIntoView({ block: 'start' }); hs[i].parentNode.style.boxShadow = '0 0 0 2px var(--wl-c9a84c, #C9A84C)'; break; }
      }, 120);
    }
  };
  window.hideHelp = hideHelp;
  window.helpAskAI = helpAskAI;
})();

  // V238: Tour-Restart-Handler
  window.helpStartTour = function() {
    if (!window.DpTour) {
      console.warn('[help] DpTour nicht geladen');
      return;
    }
    var modal = document.getElementById('help-modal');
    if (modal) modal.classList.remove('help-modal-open');
    setTimeout(function() {
      window.DpTour.reset();
      window.DpTour.start();
    }, 300);
  };

