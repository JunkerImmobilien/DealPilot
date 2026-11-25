# App-Gesamtprüfung 25.11.2026 (Fork GG4, v4770, Prod 1.0.212)

Gemessen auf Staging, Demokonto, per Skript in einem gleich-ursprünglichen iframe (Schreibzugriffe abgefangen:
fetch, XHR und Auth.apiCall ohne GET wurden geblockt, z. B. PUT /objects, PUT /tax-records, POST /bmf/pipeline).
Breiten: 1440, 1024, 820 (Tablet), 390 (Handy). Objekte: Westerfeldstr. 146, Demostraße 5, Hauptstr. 51,
Lindenallee 14 (2026-1192), Musterhof 8. Je Haupt-Tab, im Objekt-Cockpit/Pilot jeder Unterreiter einfach + Detail.
Dazu Portfolio-Cockpit, Einstellungen (alle 12 Reiter), Quick Boarding (iframe) bei 390 und 1024.
Prüfungen: seitliches Scrollen, Text über Rand/Kasten, abgeschnitten ohne Ellipse, NaN/undefined/Infinity,
Schrift unter 8,5 px, Gedankenstrich/Semikolon im Kundentext.

Hinweis: Die Messdaten 1440/1024/820 gingen einmal verloren (Tab-Gruppe von außen geschlossen); 390 und die
Objekte Lindenallee/Musterhof bei 820 sind danach neu gemessen, die übrigen Befunde stammen aus den Notizen.

## Befunde, nach Schwere

| # | Ansicht | Gerät | Befund | Schwere | Ursache | Datei | Stand |
|---|---|---|---|---|---|---|---|
| 1 | Objekt-Cockpit › Jahresabgleich, Musterhof 8 | 390, 820 | ganzer Jahresabgleich 500 px rechts außerhalb, Kennzahlen abgeschnitten | hoch | alte Jahresverlauf-SVGs mit fester Breite 821 px ziehen die Rasterspalte der Analyse auf 889 px | css/app-pruefung.css | behoben, 0 Befunde |
| 2 | Objekt › Wertermittlung | 390, 1024 | Knopf „als Verkehrswert/Marktwertindikation übernehmen“ ragt 76 bis 117 px heraus | hoch | Knopf nowrap | css/app-pruefung.css | behoben |
| 3 | Investition | 390, 1024 | Badge „Unter Grenze (…), Erhaltungsaufwand sofort abziehbar“ abgeschnitten (23 bis 45 px) | mittel | Badge nowrap in schmaler Zelle | css/app-pruefung.css | behoben |
| 4 | Jahresabgleich-Tabelle | 1024 | Knopf „in Anlage V bestätigen“ 76 px über die Zelle, Status „festgeschrieben“ 39 px über die Karte | mittel | nowrap | js/jahresabgleich.js | behoben |
| 5 | Ankauf · Bestand · Zielbild (Detail) | 390 | letzte Spalte der Abweichungstafel 4 px abgeschnitten | niedrig | Host overflow hidden | css/app-pruefung.css | behoben (scrollt) |
| 6 | Steuer, Haus & Unterlagen | 390 | Knopf „Belege, Unterlagen & Rechnungen einlesen“ 22 px heraus | mittel | nowrap | css/app-pruefung.css | behoben |
| 7 | Potenzial & Exit (einfach) | 390 | Karte „Aufteilung in Eigentum 985.200 €“ 27 px aus der Kachel | mittel | Inhalt ohne Umbruch | css/app-pruefung.css | behoben |
| 8 | Objekt | 1440 | Plakette „wichtig“ 24 px aus dem Feldnamen | niedrig | Label nowrap | css/app-pruefung.css | behoben |
| 9 | Objekt › Marktwertkarte | alle | Schrift 7,5 px (Einordnung, Genauigkeit, Unten/Ø/Oben) | niedrig | avsec-streifen.css unter Hausuntergrenze | css/avsec-streifen.css | behoben (8,5 px) |
| 10 | Portfolio-Cockpit › Galerie, Sicherheiten | alle | Objekte ohne Foto zeigen leere Fläche | mittel | kein Rückfall auf Lagekarte | js/pf-kit.js, js/pf-modell.js | behoben (6 Lagekarten mit Pin) |
| 11 | Portfolio-Cockpit › EK-Rendite | alle | Objekte ohne gespeicherten Anker rechnen mit svwert/Kaufpreis, Vermögen netto mit Wertansatz | mittel | _ekr4Basis | js/dashboard.js | behoben (_wertAnsatz) |
| 12 | Portfolio-Cockpit › Wertansatz-Tooltip | alle | Datum blieb ISO (2026-11-15) | niedrig | Regex ohne Backslash | js/dashboard.js | behoben |
| 13 | Finanzierung | alle | Karte hieß noch „Bankargumente“, „Restschuld EZB“ | niedrig | Altbeschriftung | index.html | behoben |
| 14 | ganze App | alle | 101 Kundentexte mit Gedankenstrich/Semikolon | niedrig | Altbestand | index.html, 12 JS-Dateien | teilweise: index.html bis auf eine Stelle, Spannen mit „bis“ in 8 Dateien |
| 15 | Einstellungen (Partner, Rechtliches, Hilfe) | 390 | ein Element „Miete“ 11 px über den Kasten (hinter dem Fenster liegende Ansicht) | niedrig | NN4: Element der Ansicht hinter dem Einstellungsfenster, nicht sichtbar, kein Fehler. nicht eindeutig zugeordnet | – | offen |
| 16 | Haus & Unterlagen | 1024 | Knopf „Anlage V 2026“ 28 px über die Zeile | niedrig | Bereich Fork II4 | – | offen, an II4 |
| 17 | Gold-Audit Staging | – | js/hausverlauf.js 0 → 3 hartes Gold | niedrig | Fork II4 | – | offen, an II4 |

Ohne Befund bei allen Breiten: NaN/undefined/Infinity (0), seitliches Scrollen der Seite (0),
Portfolio-Cockpit bei 390 (0), Einstellungen bei 1024 (0), Quick-Check (0 Layout).

## Bewusst offen
- Gedankenstriche in Messe-Drehbüchern (Videos), im Mietpotenzial-Kern (`text_lang`, Prüfsumme des Kerns) und in
  Hilfetexten (help.js): nicht angefasst.
- Prod nicht eingeloggt nachgemessen, nur Auslieferung (version 212, app-pruefung.css v4770).

## Nachtrag NN4 (v4810, Prod 1.0.218)

| # | Ansicht | Gerät | Befund | Stand |
|---|---|---|---|---|
| 18 | Steuer › Jahresverlauf | alle | Ergebnis 0 als „-0 €“ | behoben (tax.js) |
| 19 | ganze App | alle | Gedankenstrich/Semikolon in Kundentext, 133 Dateien | behoben (außer Kerne, Portfolio, PDF-Dokumente, Haus & Unterlagen, Score, Messe-Daten, mietpotenzial-kern) |
| 20 | Partnerfarbe Blau | 1440, 390 | hartes Gold in Reitern | 0 Stellen, kein Befund |
| 21 | dunkler Skin | 1440 | helle Schrift auf heller Fläche | nur Fehlalarme (Kacheln mit Hintergrundbild), kein Befund |
| 22 | Kontrast | alle | Status-Grün/Rot und Grautöne als kleine Schrift 3,0 bis 4,4 : 1 | offen, Markenfarben |
| 23 | Westerfeldstr. 146, Demostraße 5, Hauptstr. 51 | 1440, 1024, 820 | Überlauf, Abschneiden, NaN | kein Befund außerhalb von Scroll-Containern |
