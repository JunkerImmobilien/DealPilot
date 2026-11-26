# Eigennutzer-Objekt in der App: welche Reiter

Stand 26.11.2026 · Demo v5120ii6 bis v5120cii6 (nur Staging, Schalter `?eigennutzer=1`) · Feld `_nutzung` (`''` vermieten, `'eigen'` selbst nutzen)

## Investoren-Reiter heute → bei Selbstnutzung

| Reiter / Bereich | Eigennutzer | Warum |
|---|---|---|
| Objekt | **bleibt** (Daten), Anzeige in neuer Leiste | Adresse, Fläche, Baujahr, Zustand braucht jeder |
| Investition | **bleibt** (Daten), Anzeige in „Preis und Wert“ | Kaufpreis, Nebenkosten, Sanierung |
| Miete | **weg** | keine Mieteinnahmen. Ersatz: „ersparte Miete“ (Vergleichsmiete, Mittelwert) als Info in „Kaufen oder mieten“ |
| Finanzierung | **anders** → „Finanzierung“ | Rate, Zinsbindung bleiben, dazu Leistbarkeit (Wohnkosten zu Netto-Einkommen) |
| Bewirtschaftung | **weg** | umlagefähig/nicht umlagefähig ist Vermieter-Logik. Instandhaltung steckt grob in den Wohnkosten |
| Steuer | **weg** | keine Einkünfte aus V+V. Später nur Hinweis § 35a EStG (Handwerkerleistungen) |
| Pilot-Analyse | **anders** | KI-Einschätzung für Selbstnutzer mit eigenem Prompt (ohne Rendite, DSCR, Mietpotenzial) |
| Bewertung (Investor Deal Score, DSCR) | **weg** → „Überblick“ mit Eigennutzer-Score | Preis, Zustand, Lage, Leistbarkeit statt Rendite |
| Deal-Aktion | **anders** | Status und Bankunterlagen bleiben sinnvoll, Selbstauskunft für Kauf, ohne Mieterliste |
| Besichtigung / Unterlagen | **bleibt** → „Unterlagen“ | Checkliste, Risiken aus Protokollen und Exposé |
| Kopf: Investor Deal Score, Renditeziel, Ist/Soll-Pille | **weg** | gibt es für Selbstnutzer nicht |
| Objekt-Cockpit (Bestand) | **anders, später** | sinnvoll als „Mein Haus“: Wertentwicklung, Restschuld, Anschluss. Ohne Miete und Steuer |
| Portfolio-Cockpit | **weg** (Eigenheim nicht im Anlage-Portfolio) | höchstens als eigene Kachel „Eigenheim“ im Vermögen |

## Neue Leiste für Selbstnutzer (Demo, gleicher Stil, ohne Deal Score)

1. **Überblick** · Eigennutzer-Score „Ist das Haus gut?“, vier Gruppen, Kurzurteil Kaufen oder mieten
2. **Haus** · Baujahr-Punkte, Heizung und GEG, Energiekosten grob, Sanierung (folgt aus Checkliste und Unterlagen)
3. **Preis und Wert** · Kaufpreis, € je m², Jahresmieten-Faktor, Kaufnebenkosten, Wert nach ImmoWertV (Verkehrswert nur bei Stufe 3)
4. **Lage und Markt** · Makrolage, Leerstand, Bevölkerung; Karte, Bodenrichtwert, Preis- und Mietentwicklung aus dem Marktbericht (folgt)
5. **Finanzierung** · Rate, Beleihung, Leistbarkeit mit Einkommen, Zinsbindung/Anschluss
6. **Kaufen oder mieten** · ersparte Miete, Vermögen nach 20 Jahren
7. **Förderung** · Platzhalter, Kern kommt von JJ6 (`window.DpFoerderung.html`)
8. **Unterlagen** · Einlesen wie Deal-Check, Risiken, Besichtigung

Umschalter „Nutzung: Vermieten / Selbst nutzen“ in beiden Leisten. Daten der Investoren-Reiter bleiben erhalten, nur ausgeblendet.

## Quick-Check
Umschalter „Zum Vermieten / Selbst nutzen“ über dem Score. Bei „Selbst nutzen“: Miet-Karte und Quick-Check-Score aus, Feld Netto-Einkommen dazu (nicht gespeichert), Ergebnis mit Score, ersparter Miete, Rate, Wohnkostenquote, Kaufen gegen Mieten (Diagramm 20 Jahre) und Baujahr-Punkten. Beim Speichern in diesem Modus bekommt das neue Objekt `_nutzung = 'eigen'`.

## Offen für einen echten Bau
- `eigennutzer-kern.js` ist ein Demo-Kern (Annahmen fest im Code). Für echt: Annahmen in config, Kern sauber schneiden, ins Backend spiegeln (`rechenkerne-spiegeln`), eigener Prüfer.
- Mehrfamilienhaus als Selbstnutzer passt nicht in dieses Modell (ersparte Miete auf ganze Fläche). Für echt: nur EFH/ZFH/DHH/RH/ETW, bei MFH „eine Einheit selbst, Rest vermietet“ als eigener Fall.
- Pilot-Analyse-Prompt für Selbstnutzer, Cockpit „Mein Haus“, Förderung (JJ6), Marktbericht-Bausteine in „Lage und Markt“.
