# Vorschlag: Quick-Check für Eigennutzer + neue Mietlogik im Quick-Check

Stand 26.11.2026 · nur Vorschlag, nichts gebaut · Marcel: „dann wäre ja die Miete bei null, aber ich will ja wissen, ob das Haus gut ist“

## Kernidee
Auch wer selbst einzieht, hat eine Miete: **die Miete, die er sich spart.** Diese „ersparte Miete“ ist die ortsübliche Vergleichsmiete des Hauses (Mietspiegel, sonst DealPilot-Näherung, inkl. Hauszuschlag). Damit rechnet der Eigennutzer-Check, ob der Preis zum Haus passt, ohne Rendite-Sprache.

## Umschalter am Anfang
„Wofür kaufst du?“ → **Zum Vermieten** (heutiger Quick-Check) · **Zum Selbstnutzen** (neu). Gleiche Eingaben (Adresse, Preis, Fläche, Baujahr, Exposé-Upload), andere Auswertung.

## Eigennutzer-Score „Ist das Haus gut?“ — vier Gruppen
| Gruppe | Frage | Grundlage (vorhanden) |
|---|---|---|
| **Preis** | Zahle ich zu viel? | Kaufpreis gegen Wert (Vergleichs-/Sach-/Ertragswert, Marktpreisindikation), Kaufpreisfaktor gegen ersparte Miete (z. B. „du zahlst 28 Jahresmieten, üblich am Ort 22“) |
| **Zustand** | Was kommt auf mich zu? | Baujahr-Checkliste (besichtigung.js), Heizungsalter/GEG-Austauschpflicht, Energieklasse, RND, Sanierungskosten grob je m² |
| **Lage** | Passt die Lage zum Preis? | Lage-/Bodenrichtwert, Mikrolage aus Marktbericht |
| **Leistbarkeit** | Kann ich mir das leisten? | Monatsrate (Zins, Tilgung) + Nebenkosten gegen Netto-Einkommen (Haushaltsrechnung, Faustregel ≤ 35–40 %), Eigenkapitalquote |

## Kaufen oder mieten?
Gegenüberstellung über 10/20 Jahre: Rate + Instandhaltung − Tilgung (Vermögensaufbau) gegen ersparte Miete mit Mietsteigerung. Ergebnis in einem Satz: „Kaufen ist nach 13 Jahren günstiger als mieten.“ Daten: Vergleichsmiete (neu), Mietindex, Zins, Wertentwicklung vorsichtig.

## Was dafür zu bauen wäre
1. Umschalter + Eingabe Netto-Haushaltseinkommen (optional), Eigenkapital.
2. Eigennutzer-Score (neuer Kern `eigennutzer-score.js`, ins Backend spiegeln wie die anderen Kerne).
3. „Ersparte Miete“ = Vergleichsmiete aus der neuen Mietkette (Mietspiegel/Näherung/Hauszuschlag).
4. Kaufen-oder-mieten-Rechnung + ein Diagramm.
5. Ergebnisseite in Kachel-A-Optik, PDF „Kaufentscheidung“ (wie Deal-Check-PDF).
6. Landing: eigener Einstieg „Haus für mich prüfen“ (neue Zielgruppe, SEO-Ratgeber „Hauskauf Preis prüfen“).

## Neue Mietlogik im (Investoren-)Quick-Check
Heute rechnet der Quick-Check die Marktmiete eigenständig. Vorschlag: dieselbe Kette wie App und Marktbericht — Ist-Miete → zulässig nach Kappung → Vergleichsmiete (Mietspiegel/Näherung, Hauszuschlag) → Neuvermietung (×1,10 mit Bremse, sonst Marktmiete, Investorenlogik). Ein Kern, keine zweite Rechnung (Prüfer mietpotenzial/einzelcheck).

## Reihenfolge-Vorschlag
1. Mietlogik im Quick-Check angleichen (klein, sofort nützlich).
2. Eigennutzer-Modus als Demo (Ergebnisseite) zum Ansehen.
3. Danach Bau + Landing-Einstieg.

## Offene Fragen an Marcel
- Soll der Eigennutzer-Modus kostenlos sein (Lead-Magnet) oder wie der Deal-Check-Bericht 3,99 €?
- Einkommen abfragen ja/nein (sensibel, aber für Leistbarkeit nötig)?
- Eigene Zielgruppe auf der Landing oder nur Umschalter im Quick-Check?
