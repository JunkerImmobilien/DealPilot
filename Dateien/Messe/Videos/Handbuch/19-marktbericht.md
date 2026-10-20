# 19 · Marktbericht Stufe 1, 2 und 3

> Stand 20.10.2026 (Staging bis v2544). Zahlen vor der Messe live gegenprüfen.
> Video: Modul 18 „Der Marktbericht" (`DREHBUECHER`-Schlüssel `reihe-marktbericht`), Modul 04 „Marktbewertung in drei Stufen" (`reihe-stufen`), Modul 16 „Stufe 3 genauer" (`reihe-stufe3`) ·
> Messe-Geschichten: 3b Parkstr., 8 Westerfeld, 9 Lindenhof, 11 Alexanderstr. (design/Messe/demo-geschichten.md)

## 1 · Wozu

Der Marktbericht ist dein **Pre-Flight-Check der Lage und des Werts**: Was ist das Objekt am Markt wert, wie steht die Lage,
wohin entwickeln sich Preise und Mieten — und in der höchsten Stufe die **Wertermittlung nach ImmoWertV** mit Boden-, Ertrags-
und Sachwert und den amtlichen Kennzahlen des zuständigen Gutachterausschusses. Jede Zahl trägt ihre Herkunft. Wo eine
amtliche Zahl fehlt, sagt der Bericht das und zeigt dir den Weg zur Quelle — er erfindet keine.

## 2 · Wo in der App

- **Reiter Objekt → Eingabetiefe** (Pillen 1 · 2 · 3) → Box **„Marktbericht abrufen"**. Je Stufe steht dort „N frei" (dein Kontingent).
  Fehlt ein Pflichtfeld, heißt der Knopf „was fehlt" und listet die Felder mit Sprung.
- Seitenleiste → **Aktionen → Analyse → Marktbericht** (Berichtsansicht).
- Nach dem Abruf: Fenster mit **acht Etappen** (Standort ermitteln · Vergleichspreise · Vergleichsmieten · Mikrolage · Makrolage · Strukturdaten (Zensus) ·
  Bodenrichtwert · Bewertung und Bericht). **„Im Hintergrund weiter"** → unten die Pille „Marktbericht in Arbeit · …", danach „✓ Marktbericht fertig · … — öffnen".
- Alte Berichte: **Deal-Aktion → Marktberichte** (PDF, löschen, Verlauf ansehen), **Pilot-Analyse → Marktbericht-Verlauf** (ab zwei Berichten), im Bericht die Grafik Marktwert-Verlauf.
- **Reiter Objekt → Wertanker → Verkehrswert:** Auswahl aus dem Verlauf („Ertragswert · Datum · Betrag", „Sachwert …", „Marktwert …") → „als Verkehrswert übernehmen".

| Stufe | braucht | liefert | Kontingent |
|---|---|---|---|
| **1 · Einfach** | Adresse, Objektart, Wohnfläche, Baujahr | Marktpreisindikation mit Spanne und Marktmiete auf der Objektkarte, kein PDF | Marktpreisindikation |
| **2 · Mittel** | dazu Kaufpreis, Miete, Zustand, Energie, Standardstufe | Marktbericht mit Lage, Preisentwicklung, Rendite, Abschlag zum Markt, Text, PDF — ohne Wertverfahren | erweiterte Marktpreisindikation (ab Investor) |
| **3 · Ausgiebig** | dazu Nutzungsart, Grundstücksfläche, Bodenrichtwert, Bruttogrundfläche; ETW: Miteigentumsanteil; Häuser: Hausform, Geschosse, Dach | Boden-, Ertrags-, Sachwert mit Rechenweg und Quellennachweis | Wertermittlung (ab Pro) |

**Herkunftsstufen jeder Zahl:** A amtlich für Gebiet und Objektart · B amtlich, regional · C abgeleitet (schmale Datenbasis, Nachbargruppe desselben Ausschusses, übertragene örtliche Tabelle) ·
**N DealPilot-Formel** (aus allen amtlichen Werten abgeleitet, nie amtlich, immer so beschriftet) · D gesetzlicher Auffangwert § 256 BewG · E eigene Angabe.

## 3 · Schritt für Schritt — Beispiel Parkstr. 9, Bad Oeynhausen (MFH, Bj 1905), Bericht 205 (Stufe 3, 14.10.2026)

| Feld | Wert |
|---|---|
| Objektart | Mehrfamilienhaus, 5 Einheiten, 427 m² |
| Baujahr | 1905 |
| Kaufpreis | 780.000 € (gekauft 23.12.2024) |
| Eingabetiefe | Stufe 3 |

Was der Bericht zeigt:

| Abschnitt | Inhalt |
|---|---|
| Deal-Score im Bericht | 50 · Solide |
| Marktwertindikation | 487.000 € (Spanne 416.000–570.000 €) aus 25 Vergleichsangeboten, 1.226–1.722 €/m² |
| Lage | Mikro gut, Makro gut, Nachfrage hoch, Entwicklung steigend |
| Bodenrichtwert | 250 €/m² |
| Zensus | Gemeindemiete 5,98 €/m², Leerstand 3,6 % |
| Liegenschaftszins | 2,9 % (Stufe A) |
| Ertragswert | 332.000 € (Restnutzungsdauer 10 Jahre) |
| Sachwert | 295.000 € |
| Quellennachweis, Berichtstext, PDF | 10 Seiten |

**Warum die Zahlen so weit unter dem Kaufpreis liegen:** Das Haus ist älter als die Gesamtnutzungsdauer; die Restnutzungsdauer steht bei
10 Jahren, damit trägt der Ertragswert wenig. Genau das sagt der Bericht offen — und die Beleihung auf den Marktwert liegt bei 131 %.
Eine gute Geschichte für „DealPilot zeigt auch, was unbequem ist".

**Zweites Beispiel, Westerfeldstr. 140, Bielefeld (MFH), Bericht 308 (Stufe 3, 19.10.2026):** Ertragswert **710.000 €**, Sachwert **536.435 €**,
Liegenschaftszins **2,5 % Stufe A** (Gutachterausschuss Stadt Bielefeld), Restnutzungsdauer 23,6 Jahre. Für Bielefeld liegt im Register kein Sachwertfaktor
für MFH — der Sachwert ist deshalb **vorläufig** (Faktor 1,0), und der Bericht verweist auf die Landestabelle als Weg zur Quelle.
Seit v2542 trägt der Bericht den Abschnitt **„Marktpreise & Wertpotenzial · Verlauf"** (Web und PDF) mit dem Abruf vom 20.10.2026.

**Makrolage (seit v2510–v2518):** Rohwerte mit **Ebene** — Gemeinde vor Kreis —, Jahr und Tabelle. Bielefeld ist kreisfrei, also Kreisebene;
im Prüfbericht vom 20.10.: Bevölkerungsentwicklung Bielefeld, Stadt, 2014–2025 +0,13 % p. a., Mikrolage sehr gut (90), Nachfrage stark (47 Tage Vermarktungsdauer),
Mietausfallrisiko niedrig (1,7 % marktaktiver Leerstand laut Zensus 2022). Darunter der Quellenvermerk „© Statistische Ämter des Bundes und der Länder,
Regionaldatenbank Deutschland" mit Lizenz dl-de/by-2-0 und dem Hinweis, was DealPilot umgerechnet hat.

Belegt: Bericht 205 — Videoreihe.md (Modul 18); Parkstr.-Stammdaten und 131 % — demo-geschichten.md Geschichte 3b und Korrekturen; Bericht 308 —
Geschichte 8 Schritt 6 und Korrektur 4; Sachwertfaktor Bielefeld fehlt — Videoreihe.md (Modul 16, Nachtrag); Makrolage — Journal v2510–v2518 und v2540
(Prüfberichte 322/323/324, nicht am Kundenobjekt). Neuer Abruf an einem Messe-Objekt: Staging-Kontingent für Stufe 3 ist aufgebraucht — gespeicherte Berichte zeigen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Ist das ein Gutachten?"** — Nein. Die Marktpreisindikation kommt aus Angebotspreisen, die Wertermittlung rechnet nach ImmoWertV mit amtlichen Kennzahlen —
  ausdrücklich kein Gutachten nach § 194 BauGB.
- **„Woher kommt der Liegenschaftszins?"** — Vom zuständigen Gutachterausschuss, mit Jahrgang, Lizenz, Stichtag und Seite. Fehlt der örtliche, rechnet DealPilot trotzdem —
  mit Landes-/Bundeswert, DealPilot-Formel (N) oder § 256 BewG (D) — und sagt deutlich, dass es genauer geht.
- **„Und wenn kein Sachwertfaktor da ist?"** — Dann bleibt der Sachwert vorläufig. Ein Faktor aus dem Nachbarkreis oder ein Landesmittel wird nie eingesetzt.
- **„Muss ich warten, bis der Bericht fertig ist?"** — Nein, „Im Hintergrund weiter". Abgebucht wird erst bei einem Ergebnis.
- **„Was kostet es, später auf Stufe 3 zu gehen?"** — Nur eine Bewertung der neuen Stufe; eine schon bezahlte Tiefe kostet beim erneuten Abruf nichts.

## 5 · Grenzen und Kennzeichnung

- **Kein Verfahren rechnet halb:** fehlt eine Pflichtangabe, erscheint das Verfahren nicht.
- **Quellennachweis** nennt nur Ausschüsse, deren Zahlen wirklich im Bericht stecken.
- Der Baupreisindex im Sachwert ist derzeit eine feste Zahl (1,91), noch nicht je Ausschuss.
- Der ausführliche Text ist als **KI-AUSWERTUNG** gekennzeichnet; maßgeblich sind die Zahlen mit Herkunft.
- Nach außen keine Anbieter- oder Portalnamen; amtliche Stellen (Gutachterausschuss, Statistische Ämter) werden genannt, weil die Lizenz es verlangt.
- Zensus 2022, Stichtag 15.05.2022 — es gibt keinen jüngeren amtlichen Leerstand je Gemeinde.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Objekt, Pillen 1 · 2 · 3, Box Marktbericht abrufen | Pille 3 | Drei Stufen: Indikation, Marktbericht, Wertermittlung nach ImmoWertV. Neben jeder Stufe steht, wie viele frei sind. |
| 2 | Etappenfenster | „abrufen" | Acht Etappen, nur echte Fortschritte. Mit „Im Hintergrund weiter" arbeitest du einfach weiter. |
| 3 | Bericht 205, Marktwertindikation | Bericht öffnen | Die Marktwertindikation aus Vergleichsangeboten — mit Spanne und Zahl der Angebote. |
| 4 | Lage und Makrolage | scrollen | Lage mit Messwert, Ebene und Jahr: Gemeinde vor Kreis, Zensus-Leerstand mit Stichtag. |
| 5 | Wertermittlung, Rechenweg | scrollen | Boden-, Ertrags- und Sachwert Zeile für Zeile — mit dem Liegenschaftszins des zuständigen Ausschusses. |
| 6 | Herkunftsstufe am Zins | Tooltip | Jede Zahl trägt ihre Stufe: amtlich, abgeleitet, DealPilot-Formel oder Auffangwert — und den Weg zur Quelle. |
| 7 | Quellennachweis | — | Genannt wird nur, was wirklich im Bericht steckt — mit Berichtsjahr und Lizenz. |
| 8 | PDF | „PDF" | Alles als PDF, zehn Seiten — und gespeichert im Verlauf des Objekts. |

### Sprechertext (Entwurf, ca. 110 Sekunden)

Der Marktbericht ist dein Pre-Flight-Check für Lage und Wert. Im Reiter Objekt wählst du die Tiefe: Stufe eins, die Marktpreisindikation.
Stufe zwei, der Marktbericht mit Lage und Markt. Stufe drei, die Wertermittlung nach der Immobilienwertermittlungsverordnung.
Neben jeder Stufe steht, wie viele Abrufe dein Kontingent noch hergibt.
Nach dem Abruf siehst du acht Etappen. Du musst nicht warten — „Im Hintergrund weiter", und DealPilot meldet sich, wenn der Bericht fertig ist.
Hier der Bericht für die Parkstraße in Bad Oeynhausen: Marktwertindikation vierhundertsiebenundachtzigtausend Euro aus fünfundzwanzig Vergleichsangeboten,
die Lage mit Messwerten, der Bodenrichtwert, der Leerstand laut Zensus.
In Stufe drei rechnet DealPilot Bodenwert, Ertragswert und Sachwert — mit dem Liegenschaftszins des zuständigen Gutachterausschusses. Jede Zahl
trägt ihre Herkunft. Fehlt eine amtliche Zahl, sagt der Bericht das und zeigt dir, wo du sie bekommst. Eine Zahl aus dem Nachbarkreis setzt er nie ein.
Hier liegen Ertrags- und Sachwert weit unter dem Kaufpreis. Auch das gehört in einen ehrlichen Bericht.
Am Ende der Quellennachweis — nur mit den Stellen, deren Zahlen wirklich drinstecken — und das PDF.

## Querverweise

- [04 · Reiter Objekt](04-reiter-objekt.md) — Eingabetiefe, Bodenrichtwert, Parameter der Verkehrswertermittlung, Liegenschaftszins-Zeile
- [17 · Abruf „Marktpreise"](17-abruf-marktpreise.md) — Abschnitt Marktpreise & Verlauf im Bericht
- [18 · Tab Bewertung](18-tab-bewertung.md) — Ertragswert Stufe 3 als Bestand der Wertüberleitung
- [25 · Unterlagen beim Amt](25-unterlagen-beim-amt.md) — Grundstücksmarktbericht beim Ausschuss anfragen
- [01 · Konto, Testphase, Kontingent](01-konto-anmeldung-testphase-kontingent.md) — Kontingent je Stufe
- [03 · Quick Boarding](03-quick-boarding.md) — Marktbewertung und Abschlag auf Angebotspreise
