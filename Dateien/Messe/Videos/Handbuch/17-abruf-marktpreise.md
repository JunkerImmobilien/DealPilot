# 17 · Abruf „Marktpreise" mit Verlauf

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 26 „Mieterhöhung und Zielbild" (`DREHBUECHER`-Schlüssel `reihe-zielbild`; Abruf dort als Mitschnitt) ·
> Messe-Geschichte: 8 Westerfeld, Schritt 3 und 5 (design/Messe/demo-geschichten.md)

## 1 · Wozu

Bevor du auf die Runway rollst, willst du wissen, was der Markt am Ort heute verlangt: Was kostet ein Mehrfamilienhaus je
Quadratmeter, was eine Eigentumswohnung, welche Mieten werden angeboten? Der Abruf „Marktpreise" holt genau das für
dein Objekt — als **aktueller Marktdurchschnitt** mit Median, Spanne, Zahl der Angebote und Umkreis — und rechnet daraus
eine Marktpreisindikation für jede Stufe (Bestand, Mieterhöhung, Zielbild) und beim Mehrfamilienhaus für jede Wohnung
als Eigentumswohnung. Jeder Abruf wird mit Datum gespeichert, so entsteht ein **Verlauf**.

## 2 · Wo in der App

- **Reiter Pilot-Analyse → Unterreiter „Ankauf · Bestand · Zielbild" → Abschnitt „Marktpreise" → Knopf „Marktpreise abrufen"**
  (nach dem ersten Abruf „Marktpreise neu abrufen").
- Rückfrage im Seiteninhalt: **„Jetzt abrufen? Kostet 1 × erweiterte Marktpreisindikation. Ergebnis und Datum werden gespeichert
  und erscheinen auch im Marktbericht."** → „Ja, abrufen" / „Abbrechen".
- Danach Tabellen: **Markt am Ort** (Median · Spanne Q25–Q75 · Angebote · Umkreis), **je Stufe**, **je Wohnung**, **Verlauf** (Kauf Haus · Kauf ETW · Angebotsmiete · Marktpreisindikation) mit Einordnung.
- Dieselben Zahlen erscheinen im **Marktbericht** im Abschnitt „Marktpreise & Wertpotenzial · Verlauf" (Web und PDF) und im **Tab Bewertung**.
- Ist das Kontingent leer: „Für den Abruf ist dein Kontingent „erweiterte Marktpreisindikation" aufgebraucht."

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140, Bielefeld (MFH)

| Feld / Voraussetzung | Wert |
|---|---|
| Objektart | Mehrfamilienhaus, Baujahr ca. 1967 |
| Adresse | Westerfeldstr. 140, Bielefeld |
| Wohnungen | im MFH-Konfigurator erfasst: 6 WE (4 × 70 m², 2 × 55 m²; eingetragen 20.10.) |
| Kontingent | 1 × erweiterte Marktpreisindikation frei |

Ergebnis des **Abrufs 6 vom 20.10.2026** (nach der Befüllung, 6 WE):

| Markt am Ort | Median | Spanne (Q25–Q75) | Angebote · Umkreis |
|---|---:|---:|---:|
| Kauf Mehrfamilienhaus | 2.164 €/m² | 1.848–2.396 €/m² | 78 · 5 km |
| Kauf Eigentumswohnung | 2.604 €/m² | 2.482–2.926 €/m² | 56 |
| Angebotsmiete | 9,50 €/m² | 7,96–11,24 €/m² | 163 · 8 km |

| Je Stufe (Marktpreisindikation) | Bestand | Mieterhöhung | Zielbild |
|---|---:|---:|---:|
| aus Angebotspreisen | 820.000 € | 820.000 € | 895.000 € |
| Ertragswert (zum Vergleich) | 745.000 € | 815.000 € | 915.000 € |

Abschlag auf Angebotspreise 15,9 % (örtlich gemessen). Je Wohnung als Eigentumswohnung, z. B. **WE 1: Ertragswert
126.000 €, Marktpreisindikation 180.000 €**; die übrigen Wohnungen und die Summe live zeigen. Grundlage: Angebote für
Eigentumswohnungen gleichen Baujahrs in der Flächenklasse der Wohnung.

**Was man sieht und warum:** Das Haus kostet am Markt 2.164 €/m², eine einzelne Wohnung 2.604 €/m². Der Abstand ist der
mögliche Aufteilungsgewinn — abzüglich der Kosten der Aufteilung je Wohnung. Die Angebotsmiete (9,50 €/m²) liegt über der
Ist-Miete des Hauses (8,19 €/m²): Hier steckt Mieterhöhungspotenzial, gebremst durch die Kappungsgrenze von 15 % in Bielefeld.
Das Zielbild liegt bei der Marktpreisindikation höher (895.000 €), weil es mit dem Zustand „modernisiert" rechnet.

Belegt: Markt-, Stufen- und Wohnungszahlen — demo-geschichten.md Geschichte 8 Schritte 3–5 (Abruf 6 vom 20.10.2026, 6 WE;
ersetzt den ersten Abruf mit 4 WE: ETW 2.505 €/m², 805/805/880 T€, 243.000 € je Wohnung); Ist-Miete 3.195 € / 390 m² = 8,19 €/m² nachgerechnet; Ist-Miete 8,19 €/m² und Kappung 15 % — demo-geschichten.md Abschnitt B;
Rückfragetext — `frontend/js/potenzial.js`.

## 4 · Was man daraus liest — Fragen am Stand

- **„Woher kommen die Preise?"** — Aus aktuellen Angebotsdaten am Ort, ausgewiesen als aktueller Marktdurchschnitt mit Zahl der Angebote und Umkreis.
- **„Sind das Kaufpreise?"** — Nein, **Angebotspreise**. Im Marktbericht zieht DealPilot einen Abschlag auf Angebotspreise ab
  (für Bielefeld MFH örtlich gemessen 15,9 %, sonst aktueller Marktdurchschnitt 5,8 %, oder dein eigener Satz).
- **„Lohnt sich die Aufteilung?"** — Die Tabelle zeigt den Abstand Haus gegen Wohnung. Die Ertragswert-Rechnung kann trotzdem negativ ausfallen
  (Bielefelder ETW-Zins vermietet 2,9 % gegen 2,5 % fürs MFH) — beides nebeneinander lesen.
- **„Was bringt der Verlauf?"** — Jeder Abruf bleibt mit Datum stehen. Nach einem halben Jahr siehst du, ob der Markt am Ort steigt oder fällt.
- **„Kostet das jedes Mal?"** — Ja, jeder Abruf zählt 1 × erweiterte Marktpreisindikation.

## 5 · Grenzen und Kennzeichnung

- **Marktpreisindikation aus Angebotspreisen, kein Gutachten nach § 194 BauGB** und keine Verkehrswertermittlung.
- Keine Quellen- oder Portalnamen nach außen — „aktueller Marktdurchschnitt".
- Ertragswerte erscheinen nur mit Freigabe Stufe 3; ohne sie zeigt der Abruf die Marktpreise ohne Ertragswerte.
- Der gespeicherte Abruf vom 20.10. trägt noch keinen ETW-Ertragswert je Wohnung (vor v2542a). Der Verlauf zeigt in der Oberfläche bisher einen Abruf.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Pilot-Analyse → Ankauf · Bestand · Zielbild | Unterreiter | Unter Ankauf, Bestand und Zielbild liegt der Abschnitt Marktpreise. |
| 2 | Rückfrage im Seiteninhalt | „Marktpreise abrufen" | Vorher fragt DealPilot nach: Der Abruf kostet eine erweiterte Marktpreisindikation aus deinem Kontingent. |
| 3 | Tabelle Markt am Ort | „Ja, abrufen" | Median, Spanne, Zahl der Angebote, Umkreis — der aktuelle Marktdurchschnitt am Ort. |
| 4 | Je Stufe 820/820/895 T€ | — | Daraus eine Marktpreisindikation je Stufe: Bestand, Mieterhöhung, Zielbild. |
| 5 | WE 1 als ETW 180.000 € | Zeile Wohnung | Beim Mehrfamilienhaus jede Wohnung als Eigentumswohnung — der Abstand zum Haus ist dein Aufteilungs-Spielraum. |
| 6 | Verlauf | — | Jeder Abruf bleibt mit Datum stehen. So siehst du, wohin sich der Markt bewegt. |
| 7 | Marktbericht, Abschnitt Marktpreise & Verlauf | Marktbericht öffnen | Dieselben Zahlen stehen auch im Marktbericht — im Web und im PDF. |

### Sprechertext (Entwurf, ca. 80 Sekunden)

Was verlangt der Markt am Ort heute? Das beantwortet der Abruf Marktpreise. Du findest ihn in der Pilot-Analyse unter
Ankauf, Bestand und Zielbild.
Bevor etwas abgebucht wird, fragt DealPilot nach: Der Abruf kostet eine erweiterte Marktpreisindikation aus deinem Kontingent.
Dann kommt der aktuelle Marktdurchschnitt. Für die Westerfeldstraße in Bielefeld: Mehrfamilienhäuser um zweitausendeinhundertvierundsechzig
Euro je Quadratmeter, Eigentumswohnungen um zweitausendsechshundertvier, Angebotsmieten um neun Euro fünfzig — jeweils mit Spanne,
Zahl der Angebote und Umkreis.
Daraus rechnet DealPilot eine Marktpreisindikation für jede Stufe und beim Mehrfamilienhaus für jede einzelne Wohnung.
Der Abstand zwischen Haus und Wohnung zeigt dir, wo eine Aufteilung Spielraum hätte.
Jeder Abruf bleibt mit Datum stehen. So wird aus einem Blick ein Verlauf. Und denk daran: Das sind Angebotspreise — eine Indikation,
kein Gutachten.

## Querverweise

- [16 · Pilot-Analyse](16-pilot-analyse.md) — der Reiter, in dem der Abruf sitzt
- [18 · Tab Bewertung](18-tab-bewertung.md) — Marktpreisindikation je Stufe in der Wertüberleitung
- [19 · Marktbericht](19-marktbericht.md) — Abschnitt „Marktpreise & Wertpotenzial · Verlauf"
- [07 · MFH-Konfigurator](07-mfh-konfigurator.md) — Wohnungen, Haken „aufgeteilt", Kosten der Aufteilung
- [01 · Konto, Testphase, Kontingent](01-konto-anmeldung-testphase-kontingent.md) — erweiterte Marktpreisindikation im Kontingent
