# 02 · Neues Objekt anlegen — Checkliste, Datenaufnahme, Sprache, geführte Eingabe, Import

> Stand 20.10.2026 (Staging bis v2544). Zahlen vor der Messe live gegenprüfen. Video: Modul 02 (`boarding-zum-objekt`), Modul 03 (`reihe-datenaufnahme`), Modul 05 (`reihe-sprache-stufe2`), Modul 25 (`reihe-gefuehrt`), Überblick 2 Kapitel 1 (`reihe-ueberblick2`); ältere Einzelvideos `sprache`, `immometrica` · Messe-Geschichte(n): 8 (Westerfeldstr. 140) als Startpunkt, 11 (Alexanderstr. 11) für Einsteiger (design/Messe/demo-geschichten.md).

## 1 · Wozu

Jeder Flug beginnt mit dem Boarding. Ein neues Objekt legst du in DealPilot so an, wie die Daten gerade vorliegen: Du lädst das Exposé hoch, sprichst das Objekt frei ein, übernimmst ein Inserat aus ImmoMetrica oder lässt dich vom Co-Piloten Frage für Frage durchführen. DealPilot setzt die Werte in die richtigen Felder, und was fehlt, nennt es dir — statt es zu schätzen. Gespeichert wird automatisch.

## 2 · Wo in der App

| Was | Wo |
|---|---|
| Neues Objekt | Seitenleiste → **Aktionen** → Anlegen → **Neues Objekt** — vorher fragt eine Checkliste, woher die Daten kommen sollen (`js/neues-objekt-quellen.js`): „DealPilot Marktbewertung", „Exposé oder Marktbericht", „Sprache", „ImmoMetrica", „Bewertungspartner" |
| Datenaufnahme-Leiste (Pre-Flight-Leiste) | Reiter **Objekt**, ganz oben: Kacheln **DealPilot**, **Exposé / Marktbericht**, **Sprache**, **ImmoMetrica**, **Geführte Eingabe** („Frage für Frage — tippen oder sprechen", `js/object-actions.js:405`) → anhaken → **Abrufen** |
| Dokument einlesen, Excel, Sicherung | **Aktionen** → Anlegen → **Import** → drei Karten: „Dokument einlesen", „Excel-Kalkulation importieren", „JSON-Backup importieren" |
| Aus dem Quick Boarding | **Als Objekt speichern** (siehe [03](03-quick-boarding.md)) |
| Duplizieren / Löschen | Objektkarte in der Seitenleiste: ⎘ Duplizieren, × Löschen |
| Sperre gegen Überschreiben | Ist ein Objekt schon gefüllt, sind die Quellen ausgegraut; Knopf **Freigeben** hebt das auf |

Reihenfolge beim Abrufen: erst Dokumente und Sprache, dann die Marktbewertung. Fehlt eine Angabe, hält der Abruf an, markiert das Feld und wartet auf „Weiter" (`help.js`).

## 3 · Schritt für Schritt — Beispiel A: Westerfeldstr. 140, Bielefeld (Überblick 2)

| Feld | Wert |
|---|---|
| Straße, Hausnummer | Westerfeldstr. 140 |
| PLZ, Ort | (PLZ live), Bielefeld |
| Objektart | Mehrfamilienhaus |
| Einheiten | 4 Wohneinheiten (Stand im Konto; Gutachten nennt 6 — siehe Hinweis unten) |
| Baujahr | 1967 |
| Kaufpreis | 545.000 € |

Was die App zeigt: Mit Adresse, Objektart, Fläche und Baujahr sind die Pflichtfelder für **Stufe 1** voll — die Box „Marktbericht abrufen" wird aktiv. Die Kaufnebenkosten füllt der Reiter Investition aus deinen Standardwerten, die Grunderwerbsteuer nach der PLZ. Warum: Vom Groben zum Feinen — jede Stufe nennt nur die Felder, die sie wirklich braucht.

## 3b · Beispiel B: die geführte Eingabe (Modul 25, Beispieldaten)

| Frage des Co-Piloten | Antwort (getippt oder gesprochen) |
|---|---|
| Adresse | Dambacher Straße 60, 90763 Fürth |
| Objektart | Mehrfamilienhaus, 420 m² Wohnfläche, 6 Wohneinheiten, 3 Vollgeschosse |
| Baujahr, Kaufpreis | 1970, 1.000.000 € |
| Miete | 4.410 € kalt im Monat, dazu 360 € für sechs Stellplätze |
| Finanzierung | 200.000 € Eigenkapital, 3,6 % Zins, 1,5 % Tilgung, 10 Jahre fest |
| Lageklasse | B-Lage |
| Grundstück | 600 m², kein Erbbaurecht |
| Bewirtschaftung | 22.000 € im Jahr, davon 10.500 € nicht umlagefähig |
| Langfrist | Mietsteigerung 2,5 %, Wertsteigerung 2 %, Leerstand 1 % |
| Unbekanntes | „Weiß ich nicht" — wird übersprungen, nicht geraten |

Was die App zeigt (im Video gemessen): Fahrplan **18 Fragen in 5 Etappen**; Bayern → Grunderwerbsteuer **3,5 %**; Kaufnebenkosten **92.700 € (9,27 %)**; ein Deal-Score-Zwischenstand **39 · Schwach** (vor der Finanzierung, Cashflow −742 €/Monat), danach Investor Deal Score Zwischenstand **73 · Gut**; Bodenrichtwert **1.150 €/m²** (BORIS, Stichtag 01.01.2026, Zone 522); **17 von 19 Angaben**; Übersicht mit 43 Werten, 7 abweichende angehakt. Nach der Übernahme im Reiter Bewertung: **Deal Score 60 · Solide, Investor Deal Score 79 · Gut**. Warum: Der Co-Pilot fragt nur, was das Formular braucht, und zeigt vor der Übernahme jede Abweichung zum Objekt.

## 3c · Beispiel C: Modul 02 — vom Quick Boarding zum Objekt (Sachsenstraße 18, Herford, ETW)

Kaufpreis 180.000 € → Nebenkosten **24.786 € (13,8 %)**, Marktzins **4,28 %**, Darlehen 180.000 € / Eigenkapital 24.786 €, Score **49 · Schwach** (Aufnahme 16.10.2026).

Belegt: Westerfeld-Stammdaten Videoreihe.md (Ü2) und demo-geschichten 4/8; Modul-25-Eingaben `frontend/js/messe-drehbuch.js:4997` (`R25`), Messwerte Videoreihe.md „Modul 25 · Die geführte Eingabe"; Modul-02-Zahlen Videoreihe.md „Aufgenommen 16.10.2026". Westerfeld 4 statt 6 WE: demo-geschichten A.1.

## 4 · Was man daraus liest — Fragen am Stand

**Muss ich alles abtippen?** Nein. Exposé hochladen, einsprechen oder ImmoMetrica — mehrere Wege lassen sich kombinieren und laufen nacheinander.

**Was passiert mit einem Gutachten, das ich einlese?** „Dokument einlesen" erkennt neun Arten (Grundbuch, Kataster, Kaufvertrag, WEG-Protokoll, Bodenrichtwert, Verkehrswert- und Restnutzungsdauergutachten, Kaufpreisaufteilung, Marktbericht). Eingaben werden übernommen, das **Ergebnis** des fremden Gutachtens nur zum Vergleich angezeigt — gerechnet wird in DealPilot.

**Überschreibt der Import meine Werte?** Ein gefülltes Objekt sperrt die Quellen, bis du „Freigeben" drückst. Der Excel-Import (ImmoKalk, immocation Roter Faden und Pro) überschreibt dagegen bewusst alle Eingaben des geöffneten Objekts.

**Wo ist der Speichern-Knopf?** Es gibt keinen. DealPilot sichert beim Reiterwechsel, beim Öffnen eines anderen Objekts und bei Aktionen — sobald Kaufpreis oder Ort eingetragen ist.

**Kann ich ein Objekt kopieren?** ⎘ Duplizieren auf der Objektkarte: mit Eingaben, Pilot-Analyse und Fotos, neue Objektnummer, ohne Status Gewonnen/Verloren.

## 5 · Grenzen und Kennzeichnung

- Die Spracheingabe ist im Plan enthalten; die DealPilot-Marktbewertung verbraucht Kontingent ([01](01-konto-anmeldung-testphase-kontingent.md)).
- ImmoMetrica braucht einen eigenen Zugang (Einstellungen → Account & Sicherheit → API-Keys externer Anbieter).
- Gescannte PDFs ohne Textebene kann „Dokument einlesen" nicht lesen; beim Exposé-Import springt die Texterkennung ein.
- Ein JSON-Backup überschreibt Objekte mit gleichem Namen; Plan- und Zahlungsdaten sind nicht enthalten.
- „Bewertungspartner" ist eine externe Marktbewertung — im Kundengespräch nie namentlich nennen.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Seitenleiste, Aktionen geöffnet | Neues Objekt | Ein neues Objekt beginnt mit einer Frage: Woher kommen deine Daten? |
| 2 | Checkliste der Quellen | Exposé + DealPilot anhaken | Mehrere Wege kombinierbar — DealPilot liest erst die Dokumente, dann holt es die Marktbewertung. |
| 3 | Datenaufnahme-Leiste oben im Reiter Objekt | Abrufen | Anhaken, Abrufen. Fehlt etwas, hält DealPilot an und markiert das Feld. |
| 4 | Geführte Eingabe, Fahrplan | Kachel Geführte Eingabe | Achtzehn Fragen in fünf Etappen — tippen oder sprechen. „Weiß ich nicht" ist erlaubt. |
| 5 | Übersicht vor der Übernahme | Übernehmen | Vor dem Übernehmen siehst du jede Abweichung zum Objekt — du entscheidest, was mitgeht. |
| 6 | Import → Dokument einlesen | Gutachten wählen | Fremde Gutachten liefern Eingaben, keine Ergebnisse. Gerechnet wird in DealPilot. |
| 7 | Kopf „Gespeichert · gerade eben" | Reiter wechseln | Kein Speichern-Knopf nötig: DealPilot sichert beim Reiterwechsel. |

### Sprechertext (Entwurf, ca. 95 Sekunden)

Ein neues Objekt anzulegen heißt bei DealPilot: an Bord gehen, ohne Papierkram. Unter Aktionen findest du „Neues Objekt". Bevor die leeren Felder kommen, fragt DealPilot, woher deine Daten stammen — aus einem Exposé, aus deiner Stimme, aus ImmoMetrica oder aus der DealPilot-Marktbewertung.

Oben im Reiter Objekt liegt die Datenaufnahme. Du hakst einen oder mehrere Wege an und drückst auf Abrufen. Erst werden die Dokumente gelesen, dann folgt die Sprache, zuletzt die Marktbewertung. Fehlt eine Angabe, hält DealPilot an, zeigt dir das Feld und wartet.

Wer lieber erzählt als tippt, nimmt die geführte Eingabe. Der Co-Pilot stellt achtzehn Fragen in fünf Etappen: Adresse, Objektart, Miete, Finanzierung, Lage. Was du nicht weißt, sagst du einfach — dann wird nichts erfunden. Am Ende siehst du alle Werte auf einen Blick und entscheidest, was übernommen wird.

Gutachten, Grundbuchauszüge oder Kaufverträge liest du über Import ein. Die Angaben daraus landen im Objekt. Das Ergebnis eines fremden Gutachtens zeigt DealPilot nur zum Vergleich — gerechnet wird hier.

Und das Speichern übernimmt DealPilot selbst, bei jedem Reiterwechsel. Dein Objekt ist an Bord.

## Querverweise

- [03 · Quick Boarding](03-quick-boarding.md) — „Als Objekt speichern"
- [04 · Reiter Objekt](04-reiter-objekt.md)
- [07 · MFH-Konfigurator](07-mfh-konfigurator.md)
- [11 · Restnutzungsdauer-Rechner und Gutachten](11-restnutzungsdauer-rechner-und-gutachten.md)
- [27 · Import, Export, Sicherung](27-import-export-sicherung.md)
- [26 · Einstellungen, Standardwerte, Investmentprofil](26-einstellungen-standardwerte-investmentprofil.md)
