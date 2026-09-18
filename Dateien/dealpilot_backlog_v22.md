# Dealpilot -- Entwicklungsbacklog

> Konsolidierter Arbeitsauftrag für Claude / Coding-Agent.\
> Ziel: Bestehende Funktionen prüfen, die unten beschriebenen Änderungen
> sauber umsetzen bzw. bei Konzeptthemen zunächst einen belastbaren
> Vorschlag erstellen und anschließend die gesamte Anwendung fachlich,
> technisch und responsiv testen.

## Arbeitsweise

-   Vor Änderungen zuerst den aktuellen Code- und Datenfluss
    nachvollziehen.
-   Bestehende Funktionen nicht unnötig duplizieren; vorhandene
    Komponenten, Berechnungen und APIs möglichst weiterverwenden.
-   Bei fachlichen/konzeptionellen Punkten zuerst Ist-Zustand
    analysieren und einen konkreten Lösungsvorschlag erstellen, bevor
    größere Architekturänderungen umgesetzt werden.
-   Bei Bewertungs- und Finanzkennzahlen nicht nur UI prüfen, sondern
    Berechnungsgrundlagen und Bezugsgrößen fachlich plausibilisieren.
-   Bestehende Versionen/Varianten nur ersetzen, wenn dies ausdrücklich
    verlangt ist. Insbesondere das bestehende Investment-PDF erhalten.
-   Nach den Änderungen die Abschluss-QA-Punkte 19 und 20 vollständig
    durchführen.

------------------------------------------------------------------------

## 1. Aktuelle Version auf PROD ausrollen

**Priorität: sehr hoch / zuerst erledigen**

-   Prüfen, welcher Stand aktuell auf PROD deployed ist.
-   Die aktuelle Version auf PROD deployen.
-   Sicherstellen, dass PROD tatsächlich dem aktuellen Entwicklungsstand
    entspricht; derzeit wirkt es, als wäre dort noch eine veraltete
    Version aktiv.
-   Nach dem Deployment einen kurzen Smoke-Test der wesentlichen
    Funktionen durchführen.

------------------------------------------------------------------------

## 2. Finanzierung: Prozess Eigenkapital → Finanzierungssumme umdrehen

-   Den aktuellen Ablauf bei Eigenkapital (EK) und Finanzierungssumme
    umdrehen.
-   Zuerst soll das Eigenkapital festgelegt werden.
-   Option anbieten: **„Eigenkapital entspricht den Kaufnebenkosten"**.
-   Wird die Option gewählt, EK automatisch entsprechend setzen.
-   Anschließend die Finanzierungssumme automatisch zurückrechnen und
    eintragen.
-   Grundlogik:\
    **Kaufpreis + Kaufnebenkosten + Sanierungskosten − Eigenkapital =
    Finanzierungssumme**
-   Die automatisch ermittelte Finanzierungssumme muss editierbar
    bleiben.
-   Vorhandene Rückrechnungslogik bzw. bestehenden Button möglichst
    weiterverwenden/anpassen.
-   Kurz transparent machen, wie die vorgeschlagene Finanzierungssumme
    zustande kommt.

------------------------------------------------------------------------

## 3. Deal-Aktionen → Partnernetzwerk: automatische Rotation abschalten

-   Die Karten im Partnernetzwerk sollen nicht mehr automatisch alle
    paar Sekunden weitersliden.
-   Autoplay/automatische Rotation deaktivieren.
-   Navigation ausschließlich manuell durch den Nutzer.
-   Die angezeigte Karte bleibt stehen, bis der Nutzer selbst navigiert.

------------------------------------------------------------------------

## 4. Partnernetzwerk: Fehler beim erstmaligen Laden beheben

-   Bug reproduzieren: Beim erstmaligen Öffnen des Tabs
    **Deal-Aktionen** wird das Partnernetzwerk teilweise nicht
    angezeigt.
-   Nach F5/Browser-Reload erscheint es.
-   Initialisierung, Daten-Fetching, State und Rendering beim
    Tab-Wechsel untersuchen.
-   Partnernetzwerk muss beim ersten Öffnen zuverlässig geladen und
    angezeigt werden.

------------------------------------------------------------------------

## 5. Mehrfamilienhaus + hohe Sanierungskosten: LTV-Logik überprüfen

-   Testweise ein Mehrfamilienhaus mit hohen Sanierungskosten anlegen
    und die gesamte Berechnung prüfen.
-   Aktuell können dadurch im Finanzierungstab extrem hohe LTV-Werte
    entstehen (beobachtet wurde z. B. \> 400 %).
-   Prüfen, welcher Wert im Nenner des LTV verwendet wird und ob dies
    bei Sanierungs-/Value-Add-Deals fachlich sinnvoll ist.
-   Kaufpreis, aktuellen Objektwert und ggf. zukünftigen/stabilisierten
    Wert nach Sanierung sauber unterscheiden.
-   Prüfen, ob ein solcher LTV korrekt ist, anders bezeichnet/erklärt
    oder in bestimmten Konstellationen anders dargestellt werden sollte.
-   Nicht einfach ausblenden: zuerst die fachliche Logik nachvollziehen
    und einen Lösungsvorschlag machen.

------------------------------------------------------------------------

## 6. Mehrfamilienhaus / Sanierungsobjekte: Ist-Soll-Modell & erweiterter MFH-Konfigurator

**Zunächst Konzeptionsaufgabe. Vor größerer Implementierung
UX-/Datenmodell-Vorschlag erstellen.**

### Ist-/Soll-Logik

-   Grundkonzept für **Ist-Zustand beim Ankauf** und **Soll-Zustand nach
    Sanierung/Optimierung** entwickeln.
-   Es bleibt ein Deal/ein Objekt mit einer Finanzierung; Ist und Soll
    möglichst nicht als zwei unabhängige Deals behandeln.
-   Relevante Kennzahlen gegenüberstellen: heutige Mieten, Soll-Mieten,
    Objektwert, Zielwert, Mietrendite, Investitionsbedarf,
    Finanzierung/LTV usw.
-   Eine verständliche Value-Add-/Sanierungsstory für Investor und Bank
    ermöglichen.
-   Prüfen, wie der aktuelle Zustand, die geplanten Maßnahmen und der
    stabilisierte Zustand logisch miteinander verknüpft werden.

### Erweiterter Mehrfamilienhaus-Konfigurator

-   Im Tab **Objekt** bei Objektart „Mehrfamilienhaus" optionale
    MFH-spezifische Funktionen anbieten.
-   Feld wie **„Wohnungseigentum aufgeteilt?" / „Ist das Objekt
    aufgeteilt?"** prüfen.
-   Optionaler Einstieg **„Erweiterte Angaben zum Mehrfamilienhaus"**.
-   Darüber Modal/erweiterten Konfigurator öffnen, ohne die normale
    Objekterfassung unnötig kompliziert zu machen.
-   Einzelne Wohnungen/Einheiten erfassen können.
-   Pro Einheit z. B.: Bezeichnung/Nr., Etage, Wohnfläche, Zimmer,
    aktuelle Miete, Soll-Miete, vermietet/leerstehend, Zustand,
    saniert/unsaniert, geplanter Sanierungsbedarf.
-   Schnelles Duplizieren ähnlicher Einheiten prüfen.
-   Pro Wohnung Ist-Zustand und ggf. Soll-Zustand erfassen.
-   Daraus automatisch Gesamtwerte aggregieren: Gesamtwohnfläche, Anzahl
    Einheiten, Ist-/Soll-Miete, Leerstand, Sanierungsanteil usw.
-   Aus Einzelzuständen einen sinnvollen Gesamtzustand des MFH ableiten
    und in den normalen Tab Objekt übernehmen.
-   Klären, welche Informationen für Bewertung, Investmentrechnung,
    Marktbericht und Finanzierung/Bankunterlagen benötigt werden.
-   Der einfache MFH-Prozess muss weiterhin schnell bleiben; der
    Einzelwohnungs-Konfigurator ist eine optionale Vertiefung.

### Erwartetes Ergebnis

Claude soll einen Vorschlag für **UX/Ablauf, Datenmodell,
Ist-Soll-Logik, Aggregationslogik und sinnvolle Kennzahlen** erstellen.

------------------------------------------------------------------------

## 7. Marktbericht: Bewertungsstufen fachlich und inhaltlich sauber trennen

-   Die verschiedenen Produkt-/Bewertungsstufen klar voneinander
    abgrenzen.
-   Bei einer **Marktpreisindikation** nur die dafür vorgesehenen
    indikativen Ergebnisse ausgeben.
-   Insbesondere **keinen Sachwert und keinen Ertragswert auf dem
    Dokument ausweisen**, wenn der Kunde lediglich eine
    Marktpreisindikation erworben hat.
-   Sachwert-/Ertragswertverfahren und entsprechende detaillierte
    Ergebnisse erst bei der dafür vorgesehenen vollständigen
    Wertermittlung ausgeben.
-   Prüfen, welche Standardwerte, Datenbankwerte oder Fallback-Annahmen
    intern für die jeweilige Stufe benötigt werden.
-   Wenn Werte aus Datenbanken/APIs vorliegen, diese bevorzugen.
-   Wo fachlich zulässig mit sinnvollen Standard-/Fallback-Werten
    arbeiten und Annahmen transparent kennzeichnen.
-   Dokumentausgabe muss exakt dem gebuchten/bezahlten Leistungsumfang
    entsprechen.
-   Die Bewertungsstufen insgesamt logisch aufbauen: einfache/indikative
    Stufe möglichst ohne unnötige Zusatzangaben; genauere Stufen mit
    zusätzlichen Daten und höherer Belastbarkeit.

------------------------------------------------------------------------

## 8. Marktbewertung: Bruttofläche automatisch ableiten, aber optional präzisieren

-   Bruttofläche nicht zwingend als manuelles Pflichtfeld behandeln.
-   Wenn sie nicht explizit angegeben wurde, aus vorhandenen
    Flächenangaben automatisch ableiten.
-   Fachlich sinnvollen Umrechnungsfaktor bzw. geeignete Methodik
    verwenden.
-   Prüfen, welche Flächendefinition tatsächlich benötigt wird (z. B.
    BGF nach DIN 277 statt unscharfem „Bruttofläche").
-   Automatisch ermittelten Wert und verwendete Annahme transparent
    ausweisen.
-   Nutzer kann den Wert optional genauer angeben/überschreiben.
-   Falls Faktoren je nach Gebäudetyp variieren, dies berücksichtigen
    statt einen beliebigen pauschalen Faktor zu verwenden.

------------------------------------------------------------------------

## 9. Sprechlauf: Stabilität, Latenz, Unterbrechen & Mobile UX

-   Gesamten Sprechlauf auf Stabilität und Fehlertoleranz überprüfen und
    verbessern.
-   Wechsel **Zuhören → Verarbeiten → Antworten → erneutes Zuhören** auf
    Timing, Zustände und Fehler prüfen.
-   Keine unnötigen Pausen, Hänger, doppelten Antworten oder unklaren
    Zustände.
-   Bestehende Unterbrechungsfunktion/Barge-in explizit testen: Nutzer
    muss Dealpilot während des Sprechens unterbrechen können und der
    Dialog muss anschließend sauber weiterlaufen.

### Schlechte Internetverbindung

-   Verhalten bei langsamer, instabiler oder stark schwankender
    Verbindung testen, z. B. Hotel-WLAN.
-   Prüfen, ob Netzwerkprobleme von
    Backend-/Audio-/Verarbeitungsproblemen unterschieden werden können.
-   Geeignete Messgrößen prüfen, z. B. Round-Trip-Latenz,
    Paketverlust/Abbrüche, Jitter und Reconnects.
-   Bei nachweislich problematischer Verbindung verständlichen Hinweis
    anzeigen, z. B. dass die Verbindung instabil ist und Verzögerungen
    entstehen können.
-   Keine Warnung bei jeder kurzen Verzögerung; sinnvolle
    Schwellwerte/Erkennung entwickeln.
-   Fallback-/Degraded-Modus prüfen.
-   Nach kurzen Abbrüchen möglichst automatisch reconnecten, ohne den
    Dialogzustand zu verlieren.
-   Lade-/Wartezustände so darstellen, dass „System verarbeitet" von
    „Verbindung problematisch" unterscheidbar ist.
-   Tests mit gedrosselter Bandbreite, hoher Latenz, Jitter und kurzen
    Abbrüchen durchführen.

### Mobile

-   Sprechlauf speziell für Smartphones und Tablets optimieren.
-   Mikrofonstatus, Texte, Animationen und Bedienelemente auf kleinen
    Displays prüfen.
-   Portrait und Landscape berücksichtigen.
-   Der mobile Sprechlauf soll nicht nur eine verkleinerte
    Desktop-Ansicht sein.
-   Längere reale Gesprächsabläufe End-to-End testen.

------------------------------------------------------------------------

## 10. Einstellungen: Hell-/Dunkel-Modus reparieren

-   In den Einstellungen lässt sich Dealpilot zwischen Hell und Dunkel
    umstellen.
-   Der Wechsel auf Hell funktioniert derzeit nicht zuverlässig bzw. gar
    nicht.
-   Fehler reproduzieren und beheben.
-   Prüfen, ob Einstellung korrekt gespeichert und konsistent auf die
    gesamte Anwendung angewendet wird.
-   Nach Reload und erneuter Anmeldung muss die gewählte Darstellung
    erhalten bleiben.

------------------------------------------------------------------------

## 11. Investment-PDF: neue professionelle Light-Version erstellen

-   Das bestehende Investment-PDF unbedingt beibehalten und nicht
    überschreiben.
-   Zusätzlich eine neue Version als Test/Alternative entwickeln.
-   Inhaltlich zunächst mit den bereits vorhandenen Daten arbeiten.
-   Gestaltung professioneller, heller und seriöser machen, insbesondere
    für Banken, Investoren und externe Empfänger.
-   Als gestalterische Referenz das vorhandene Dokument für
    **Anschaffungskosten/Finanzamt** heranziehen.
-   Klare Typografie, saubere Tabellen, sinnvolle Abstände,
    strukturierte Kennzahlen.
-   Eher hochwertiges Investment-/Banking-Dokument statt dunkler
    App-Optik.
-   Beide Varianten zunächst parallel verfügbar halten.

------------------------------------------------------------------------

## 12. Deal-Aktionen → „Ready für die Bank" seriöser gestalten

-   Bereich **„Ready für die Bank"** gestalterisch überarbeiten.
-   Aktuell sehr dunkel und stark im Dealpilot-Stil.
-   Hellere, zurückhaltendere, seriösere Darstellung entwickeln.
-   Gestaltung auf Bank-/Finanzierungskommunikation ausrichten.
-   Wenn sinnvoll, an die neue helle Designsprache des Investment-PDFs
    anknüpfen.

------------------------------------------------------------------------

## 13. Bewertung → Deal-Score & Investor-Deal-Score mit Light/Dark-Modus

-   Deal-Score und Investor-Deal-Score sollen helle und dunkle
    Darstellung unterstützen.
-   Für die helle Variante am Farbschema/Design des Hero-Bereichs der
    Landingpage orientieren.
-   In den Einstellungen Hell/Dunkel berücksichtigen bzw. bei Bedarf
    separat einstellbar machen.
-   Wenn Dealpilot generell auf Hell steht, sollen beide Scores
    standardmäßig ebenfalls hell sein.
-   Falls separate Einstellung vorgesehen wird, sauber definieren, ob
    diese die globale Einstellung überschreibt.
-   Lesbarkeit, Kontrast und konsistente Kennzahlendarstellung in beiden
    Themes prüfen.

------------------------------------------------------------------------

## 14. Quick Check & Objekt → Flugzeug/Pre-Flight-Symbolik entfernen

-   Im Quick Check beim **Abrufen-Button** das Flugzeug-Symbol
    entfernen.
-   Im Tab **Objekt** bei der entsprechenden Pre-Flight-Karte die
    Flugzeug-Symbolik ebenfalls entfernen.
-   Prüfen, ob dieselbe Symbolik an weiteren Stellen derselben Funktion
    verwendet wird und konsistent angepasst werden sollte.
-   Funktionalität ansonsten unverändert lassen.

------------------------------------------------------------------------

## 15. Quick Check: Marktwert bei „Marktbewertung D-Pilot + Exposé" prüfen

-   Fehler reproduzieren.
-   Beobachtete Konstellation: Im Quick Check werden **„Marktbewertung
    D-Pilot" und „Exposé"** ausgewählt.
-   Dabei wurde der Marktwert nicht abgerufen/übernommen.
-   Prüfen, ob die Kombination dazu führt, dass Request,
    Berechnungsschritt oder Mapping übersprungen wird.
-   Sicherstellen, dass der Marktwert korrekt ermittelt und im Quick
    Check übernommen/angezeigt wird.
-   Zusätzlich andere Kombinationen der Quick-Check-Optionen
    gegenprüfen.

------------------------------------------------------------------------

## 16. Sprechlauf: Fragen abhängig vom Objekttyp überprüfen

-   Gesamten Fragenkatalog des Sprechlaufs nach Objektart überprüfen:
    Eigentumswohnung, Einfamilienhaus, Mehrfamilienhaus, Gewerbe usw.
-   Aktuell werden teilweise Fragen gestellt, die für den jeweiligen
    Objekttyp wenig sinnvoll sind.
-   Beispiel: Beim Mehrfamilienhaus wird nach der Gesamtzahl der Zimmer
    gefragt, obwohl diese häufig nicht bekannt und möglicherweise für
    die Bewertung nicht relevant ist.
-   Für jede Frage prüfen: **Wird diese Information später tatsächlich
    verwendet oder an eine Bewertung/API übergeben?**
-   Nicht benötigte Fragen entfernen bzw. nicht abfragen.
-   Benötigte objekttypspezifische Informationen passend formulieren.
-   Beim MFH eher Anzahl Wohneinheiten, Wohn-/Nutzfläche, Ist-Miete,
    Leerstand etc. priorisieren.
-   Zimmer ggf. auf Ebene einzelner Wohnungen im erweiterten
    MFH-Konfigurator erfassen.
-   Sprechlauf und Objekt-Tab sollen dieselbe fachliche Logik und
    dasselbe Datenmodell verwenden.
-   Für die vorhandenen Objekttypen einen Vorschlag erstellen: Welche
    Fragen werden benötigt, welche sind überflüssig, welche fehlen?
    Daraus einen objekttypspezifischen Fragenbaum ableiten.

------------------------------------------------------------------------

## 17. Objektzustand: Sternebewertung fachlich überarbeiten & API-Mapping prüfen

-   Im Tab **Objekt** die bestehende Zustandsbewertung mit Sternen
    überprüfen.
-   Nachvollziehen, welche Sterne-/Zustandswerte aktuell an
    Marktbewertungs-Schnittstellen übergeben werden und wie diese
    interpretiert werden.
-   Prüfen, ob eine verständlichere verbale Zustandsskala sinnvoller ist
    als 1--5 Sterne.
-   Nicht nur „1 Stern / 2 Sterne" ausschreiben, sondern fachlich
    sinnvolle Kategorien entwickeln, z. B. von stark
    sanierungs-/renovierungsbedürftig bis sehr gut/neuwertig.
-   Prüfen, ob für Komponenten eigene Zustände sinnvoll sind, z. B.
    Küche, Bad, Fenster, Heizung/Haustechnik, Innenausbau,
    Gebäudezustand.
-   Im Hintergrund weiterhin sauberes numerisches/technisches Mapping
    für APIs ermöglichen.
-   Bestehende Daten/Deals müssen weiterhin korrekt interpretierbar
    bleiben.
-   Prüfen, welche Zustandsinformationen tatsächlich die Marktbewertung
    beeinflussen und deshalb erfasst werden sollten.

------------------------------------------------------------------------

## 18. Marktbewertung: vollständiges Input-/Schnittstellen-Audit

-   Systematisch nachvollziehen, welche Eingaben in welcher
    Bewertungsstufe tatsächlich verwendet werden.
-   Alle beteiligten Datenquellen und Schnittstellen prüfen,
    insbesondere **GeoMap, Zensus sowie sämtliche weiteren aktuell
    eingebundenen Bewertungs-/Marktdatenanbieter und APIs**.
-   Für jede Schnittstelle dokumentieren:\
    **Welche Daten haben wir im Deal? → Welche senden wir? → Welche
    könnten wir zusätzlich senden? → Welche kommen zurück? → Wo werden
    sie verwendet?**
-   Prüfen, ob relevante vorhandene Angaben aktuell gar nicht an die
    jeweilige Schnittstelle übergeben werden, obwohl sie das Ergebnis
    verbessern könnten.
-   Prüfen, ob Daten erhoben werden, die anschließend nirgendwo
    verwendet werden.
-   Besonders betrachten: Zustand, Objektart, Baujahr, Flächen,
    Sanierung, Ausstattung, Lage-/Geodaten und objekttypspezifische
    Merkmale.
-   Prüfen, ob der Bewertungszustand/Sterne-Wert korrekt übertragen und
    genutzt wird.
-   Anschließend konkreten Vorschlag machen, welche zusätzlichen
    vorhandenen Daten sinnvoll in die Bewertung einfließen sollten.
-   Nicht blind möglichst viele Parameter senden; nur fachlich
    unterstützte und relevante Inputs nutzen.

------------------------------------------------------------------------

## 19. Abschluss-QA: Marktbericht, Bewertungslogik und gesamte App durchtesten

**Dieser Punkt wird nach Bearbeitung der vorherigen Themen
durchgeführt.**

### Marktbericht / Produktstufen

-   Marktbericht End-to-End durchtesten.
-   Jede angebotene Bewertungs-/Produktstufe separat testen.
-   Sicherstellen, dass jedes Dokument nur Inhalte enthält, die zur
    gekauften Stufe gehören.
-   Insbesondere Marktpreisindikation gegen vollständige Wertermittlung
    prüfen.
-   Bei Marktpreisindikation kein Sachwert/Ertragswert ausgeben, sofern
    dies nicht Bestandteil dieser Produktstufe ist.

### Schnittstellen / Datenfluss

-   Kontrollieren, ob sämtliche relevanten Objektwerte korrekt mit den
    Schnittstellen verknüpft und übertragen werden.
-   Ergebnisse externer Datenquellen/APIs bis zur Darstellung im
    Marktbericht nachvollziehen.
-   Prüfen, ob Änderungen eines Eingabewerts überall konsistent
    weitergerechnet werden.

### Fachliche Plausibilität

-   Mehrere realistische Testobjekte verwenden: ETW, EFH,
    Mehrfamilienhaus, ggf. Gewerbe sowie unterschiedliche Zustände.
-   Explizit einen Sanierungs-/Value-Add-Deal mit sehr hohen
    Sanierungskosten testen.
-   Nicht nur technische Fehler suchen, sondern fachliche Plausibilität
    der Kennzahlen kontrollieren.
-   Beispielsweise: Kaufpreis, Gesamtinvestition, Kaufnebenkosten,
    Finanzierung, Eigenkapital, LTV, Ist-/Soll-Mieten, Marktwert,
    Bruttomietrendite.
-   Gerade bei hohen Sanierungskosten prüfen, ob Kostenbasis und
    Bezugsgrößen der Renditekennzahlen korrekt sind.
-   Prüfen, ob die Bruttomietrendite und weitere Investment-KPIs bei
    Sanierungsfällen sinnvoll berechnet werden.

### Regression

-   Allgemeiner Smoke-/Regressionstest der zentralen Dealpilot-Abläufe.
-   Gefundene Fehler nicht nur einzeln flicken; prüfen, ob gemeinsame
    fehlerhafte Berechnungs-, Mapping- oder State-Logik dahintersteckt.
-   Abschlussübersicht liefern: **getestet / Fehler gefunden / behoben /
    noch offen / fachliche Entscheidung erforderlich**.

------------------------------------------------------------------------

## 20. Responsive Design & Mobile/Tablet-QA der gesamten App

**Sehr wichtig: Ein Kunde muss Dealpilot vollständig und vernünftig auf
dem Smartphone nutzen können.**

-   Gesamte App systematisch auf Smartphone und Tablet testen.
-   Verschiedene Viewport-/Displaygrößen testen, nicht nur ein einzelnes
    iPhone-/iPad-Format.
-   Portrait und Landscape berücksichtigen.
-   Alle wesentlichen Tabs und Deal-Abläufe vollständig mobil
    durchspielen.
-   Besonders prüfen: Navigation, Modals, Formulare, Dropdowns,
    Tabellen, Karten, Charts, Scores, Marktbericht, Deal-Aktionen,
    Finanzierung, Objekt, Bewertung und Sprechlauf.
-   Keine abgeschnittenen Inhalte, ungewolltes horizontales Scrollen,
    Überlappungen oder außerhalb des Displays liegende Buttons.
-   Formulare müssen mit eingeblendeter Smartphone-Tastatur bedienbar
    bleiben.
-   Touch-Ziele und Buttons ausreichend groß gestalten.
-   Modals/Overlays müssen auf kleinen Displays vollständig erreichbar
    und scrollbar sein.
-   Tabellen und große Kennzahlenbereiche brauchen bei Bedarf eine
    sinnvolle mobile Darstellung statt bloßem Zusammenschrumpfen.
-   Prüfen, dass Kernfunktionen tatsächlich mobil funktionieren und
    nicht nur optisch responsive aussehen.
-   Sprechlauf besonders intensiv mobil testen und optimieren.
-   Ziel: Ein Kunde kann einen Deal auf dem Smartphone sinnvoll
    **anlegen, bearbeiten, bewerten und durch den gesamten Prozess
    führen**.

------------------------------------------------------------------------

------------------------------------------------------------------------

## 21. Light Mode: vollständiges professionelles Redesign für Steuerkanzleien

**Zunächst Design-/Konzeptaufgabe. Nicht direkt den bestehenden Ablauf
oder die Berechnungslogik umbauen.**

### Ziel

-   Für den **hellen Modus** von Dealpilot ein deutlich umfassenderes
    Redesign entwickeln.
-   Der Light Mode soll nicht lediglich die dunkle Oberfläche mit hellen
    Farben darstellen, sondern als eigenständige, professionelle
    Business-Oberfläche funktionieren.
-   Hauptanwendungsfall berücksichtigen: Dealpilot wird unter anderem in
    **Steuerkanzleien und professionellen Beratungsumgebungen**
    eingesetzt.
-   Wirkung: seriös, hochwertig, ruhig, übersichtlich und
    vertrauenswürdig.
-   Der bestehende Dark Mode soll dadurch nicht automatisch ersetzt
    werden.

### Feste Leitplanken

-   **Grundablauf der App nicht verändern.**
-   **Berechnungen und fachliche Logik nicht verändern.**
-   Bestehende Funktionen vollständig erhalten.
-   Die vorhandene **Tab-Bar / Tab-Navigation muss erhalten bleiben**,
    sodass weiterhin durch die bekannten Bereiche des Deals navigiert
    werden kann.
-   Bestehende Informationen und Kennzahlen müssen weiterhin verfügbar
    sein.
-   Das Dealpilot-/D-Pilot-Logo im Light Mode kann **kleiner und
    dezenter** eingesetzt werden.
-   Fokus liegt auf Layout, Informationsarchitektur, Navigation,
    Typografie, Abständen, visueller Hierarchie und professioneller
    Darstellung.

### Objekt-/Deal-Navigation prüfen

Insbesondere eine neue seitliche Navigation untersuchen:

-   Objekte/Deals beispielsweise als **Liste in einer linken
    Seitenleiste** darstellen.
-   Schneller Wechsel zwischen Objekten ermöglichen.
-   Pro Listeneintrag nur die wichtigsten Informationen/Kennzahlen
    kompakt anzeigen.
-   Aktuell ausgewähltes Objekt eindeutig hervorheben.
-   Hauptbereich zeigt anschließend die Detailinformationen des
    ausgewählten Objekts.
-   Die bestehende Tab-Bar bleibt innerhalb des ausgewählten Deals
    weiterhin verfügbar.
-   Prüfen, ob Sidebar ein-/ausklappbar sein sollte, um auf kleineren
    Displays ausreichend Arbeitsfläche zu behalten.
-   Konzept muss weiterhin mit der Mobile-/Tablet-Strategie aus Punkt 20
    vereinbar sein.

### 5--6 echte Redesign-Konzepte erstellen

Auf Basis der **bestehenden Dealpilot-App** mindestens **5--6 klar
unterschiedliche Design-/Layout-Konzepte** entwickeln.

Es sollen keine sechs Varianten sein, die lediglich Farben, Schatten
oder Rundungen verändern. Die Konzepte sollen sich tatsächlich in
**Layout und Informationsarchitektur** unterscheiden.

Denkbare Richtungen können beispielsweise sein:

1.  **Professional Workspace** -- linke Objektliste + zentraler
    Deal-Arbeitsbereich + bestehende Tab-Bar.
2.  **Kanzlei-/Mandantenansicht** -- stärkere Trennung zwischen
    Objekt-/Mandantenauswahl und eigentlicher Dealbearbeitung.
3.  **Financial Dashboard** -- stärker kennzahlenorientierter Einstieg
    mit anschließendem Wechsel in die bekannten Deal-Tabs.
4.  **Document-/Case-Workspace** -- Objekt wie eine digitale Akte
    behandeln; sehr ruhige, dokumentenartige Oberfläche.
5.  **Compact Professional** -- informationsdichte, aber sehr klare
    Oberfläche für Power-User, die viele Objekte bearbeiten.
6.  **Hybrid Workspace** -- Kombination aus Sidebar, kompakter
    Objektübersicht und großzügigem Detailbereich.

Diese Richtungen sind **keine Vorgabe**. Wenn sich aus der vorhandenen
App bessere Varianten ergeben, diese bevorzugen.

### Für jedes Konzept liefern

Für jede der 5--6 Varianten:

-   Grundidee und Ziel der Variante.
-   Beschreibung des Seitenaufbaus.
-   Position von:
    -   Objekt-/Deal-Auswahl
    -   Deal-/Objektinformationen
    -   Tab-Bar
    -   Hauptinhalt
    -   wichtigsten Aktionen
    -   zentralen Kennzahlen
-   Beschreibung, wie bestehende Dealpilot-Funktionen in das Layout
    integriert werden.
-   Groben **Wireframe/Mockup bzw. visuelle Konzeptdarstellung**
    erstellen, soweit mit den vorhandenen Mitteln möglich.
-   Typografie-, Abstands- und Hierarchieprinzipien beschreiben.
-   Umgang mit Dealpilot-Branding/Logo beschreiben.
-   Vorteile und mögliche Nachteile der Variante nennen.
-   Darauf achten, dass das Konzept später sinnvoll responsive für
    Tablet und Smartphone umgesetzt werden kann.

### Designrichtung

Bei allen Vorschlägen insbesondere auf folgende Wirkung achten:

-   professionell
-   seriös
-   modern, aber nicht verspielt
-   für Steuerkanzleien und professionelle Immobilien-/Finanzanwender
    geeignet
-   hohe Informationsklarheit
-   gute Lesbarkeit
-   weniger visuelle Unruhe
-   klare Hierarchien
-   hochwertige Tabellen, Formulare und Kennzahlendarstellung
-   zurückhaltender Einsatz von Branding und dekorativen Elementen

### Erwartetes Ergebnis

Zunächst **keines der Konzepte vollständig implementieren**.

Stattdessen:

1.  Bestehenden Light Mode analysieren.
2.  5--6 substantiell unterschiedliche Redesign-Vorschläge erstellen.
3.  Vorschläge möglichst visuell/Wireframe-artig darstellen.
4.  Vor- und Nachteile gegenüberstellen.
5.  Aufzeigen, welche Elemente verschiedener Konzepte sinnvoll
    miteinander kombiniert werden könnten.
6.  Erst nach Auswahl/Freigabe eines Konzepts das eigentliche Redesign
    umsetzen.

Wichtig: Das Redesign betrifft die **Darstellung und Bedienoberfläche**,
nicht die bestehende fachliche Deal-, Bewertungs- oder Berechnungslogik.

------------------------------------------------------------------------

## 22. Steuern → AfA, Restnutzungsdauer & RND-Gutachten integrieren

**Zunächst vorhandenen Rechenkern, bestehende Konfiguratoren und
Datenflüsse analysieren und möglichst wiederverwenden. Keine parallele
RND-Logik aufbauen, wenn bereits eine belastbare Berechnungslogik
vorhanden ist.**

### AfA-Eingabe erweitern

-   Die bestehende AfA-Auswahl im Tab **Steuern** beibehalten.
-   Zusätzlich ermöglichen, die AfA **manuell/frei einzugeben**, wenn
    der Nutzer den anzusetzenden Wert bereits kennt.
-   Damit zwei Wege anbieten: vorhandene Auswahl/Automatik oder
    manueller Wert.
-   Sauber definieren, wie Auswahl und manueller Override zueinander
    stehen.
-   Manuell gesetzte Werte dürfen nicht unbemerkt durch Automatik
    überschrieben werden.

### Restnutzungsdauer ermitteln und übernehmen

-   Im Tab **Steuern** die Möglichkeit schaffen, die **Restnutzungsdauer
    des Gebäudes/Objekts** zu ermitteln bzw. einen bekannten Wert zu
    übernehmen.
-   Prüfen, ob hierfür der bereits integrierte **Rechenkern für
    Restnutzungsdauergutachten** direkt wiederverwendet werden kann.
-   Bestehenden Konfigurator bzw. dessen Logik auf
    **junker-immobilien.io** als Referenz heranziehen.
-   Keine zweite unabhängige Berechnungslogik implementieren, wenn der
    bestehende Rechenkern genutzt werden kann.
-   Nutzer soll wahlweise eine bekannte Restnutzungsdauer manuell
    eingeben/übernehmen oder sie über den vorhandenen
    Rechenkern/Konfigurator ermitteln.
-   Ergebnis anschließend direkt in die relevanten Berechnungen im Tab
    Steuern übernehmen können.

### Objektdaten wiederverwenden

-   Prüfen, welche für die RND-Berechnung benötigten Angaben bereits im
    Tab **Objekt** vorhanden sind.
-   Vorhandene Daten automatisch übernehmen statt erneut abzufragen.
-   Fehlende RND-relevante Angaben gezielt ergänzen.
-   Bestehende Objektfelder so strukturieren, dass sie -- soweit
    fachlich passend -- **Marktbewertung, RND, Investmentrechnung und
    weitere Prozesse** gemeinsam versorgen können.
-   Doppelte Datenerfassung vermeiden.

### Verbindung mit dem MFH-Konfigurator aus Punkt 6

-   Für Mehrfamilienhäuser die RND-/Zustandslogik in das geplante
    **Hauptobjekt → Gebäude → Einheiten/Wohnungen**-Modell integrieren.
-   Gebäudedaten nur einmal auf Hauptebene erfassen; einzelne Wohnungen
    erben gemeinsame Gebäudemerkmale automatisch.
-   Beispiele: Baujahr, zentrale Heizung/Heizsystem, Dach, Fassade und
    weitere gebäudebezogene Eigenschaften.
-   Nur tatsächlich einheitsspezifische Informationen auf Wohnungsebene
    pflegen.
-   Pro Einheit -- soweit fachlich relevant -- Zustand/Sanierungsstand,
    Modernisierungen, bekannte Mängel sowie **Zusatzbeschreibung/freien
    Text** erfassen können.

### Vererbung & Overrides

-   Klares hierarchisches Datenmodell entwickeln: **Gesamtobjekt →
    Gebäude → Einheit/Wohnung**.
-   Gemeinsame Eigenschaften werden nach unten vererbt.
-   Wo eine Wohnung abweicht, kann ein geerbter Wert überschrieben
    werden.
-   In der UI kenntlich machen, ob ein Wert geerbt oder individuell
    gesetzt wurde.
-   Änderungen am Hauptobjekt sollen geerbte Werte aktualisieren,
    bewusst überschriebene Einheitswerte aber nicht zerstören.

### RND-Gutachten direkt aus Dealpilot auslösen

-   Nach Erfassung bzw. Berechnung der Restnutzungsdauer soll der Nutzer
    ein **Restnutzungsdauergutachten direkt aus Dealpilot heraus
    anstoßen** können.
-   Vorhandenen Prozess möglichst wiederverwenden.
-   Zwei UX-Wege prüfen:
    1.  **Direkter CTA im Tab Steuern**, über den das RND-Gutachten mit
        den bereits erfassten Daten ausgelöst/angefragt wird.
    2.  Weiterleitung in das bestehende **Partnernetzwerk**, wo der
        Nutzer den Gutachtenprozess über **Gutachten.org** auslösen
        kann.
-   Bei Weiterleitung/Absenden bereits vorhandene Deal- und RND-Daten
    möglichst übernehmen, damit keine doppelte Eingabe nötig ist.
-   Den bestehenden Partner-/Gutachtenprozess anbinden, statt einen
    zweiten unabhängigen Bestellprozess zu bauen.
-   Vor dem Absenden transparent darstellen, welche Daten übermittelt
    werden, und eine bewusste Bestätigung ermöglichen.
-   Nach erfolgreichem Auslösen einen eindeutigen Status im Deal
    anzeigen, z. B. **angefragt / übermittelt / in Bearbeitung /
    abgeschlossen**, soweit der Partnerprozess diese Informationen
    unterstützt.
-   Prüfen, ob das fertige Gutachten bzw. ein Ergebnis-/Dokumentenlink
    anschließend wieder dem Deal zugeordnet werden kann.

### Konzept und erwartetes Ergebnis

Claude soll den vorhandenen **RND-Rechenkern, bestehenden Konfigurator,
Tab Objekt, Tab Steuern, Partnernetzwerk/Gutachten.org sowie den
geplanten MFH-Konfigurator** gemeinsam analysieren und einen Vorschlag
liefern für:

-   einheitliches Datenmodell,
-   benötigte RND-Eingaben,
-   Vererbungslogik Hauptobjekt → Einheit,
-   AfA-/RND-UX im Tab Steuern,
-   Wiederverwendung des bestehenden Rechenkerns,
-   Übergabe der Daten an den Gutachtenprozess,
-   Auslösen/Bestätigen des Gutachtenauftrags,
-   Rückmeldung/Status des Gutachtenprozesses.

**Zielbild:** Objektdaten einmal strukturiert erfassen und anschließend
für Marktbewertung, Investmentrechnung, AfA/RND, Finanzierung und den
Gutachtenprozess wiederverwenden.

# Empfohlene Reihenfolge

1.  **Punkt 1:** aktuellen Stand auf PROD bringen und Ausgangslage
    verifizieren.
2.  Bugs und klar abgegrenzte UX-/Funktionsänderungen bearbeiten.
3.  Konzeptthemen rund um MFH, Ist/Soll und Bewertungslogik analysieren
    und Lösungsvorschläge erstellen.
4.  Schnittstellen- und Bewertungslogik konsolidieren.
5.  Design-/PDF-/Theme-Themen umsetzen.
6.  **Punkt 19:** vollständiges fachliches und technisches
    End-to-End-QA.
7.  **Punkt 20:** vollständige Mobile-/Tablet-/Responsive-QA und
    verbleibende Probleme beheben.

# Definition of Done

Der Backlog ist abgeschlossen, wenn die beschriebenen Änderungen
umgesetzt bzw. bei Konzeptpunkten abgestimmt sind, die Bewertungs- und
Finanzierungslogik nachvollziehbar und plausibel funktioniert, die
Produktstufen des Marktberichts korrekt getrennt sind, alle relevanten
API-Datenflüsse geprüft wurden und die Anwendung auf Desktop, Tablet und
Smartphone einschließlich Sprechlauf zuverlässig nutzbar ist.
