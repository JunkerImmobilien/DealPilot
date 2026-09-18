# Was der Kunde beibringen muss

Zwei getrennte Listen, beide aus den laufenden Formularen ausgelesen —
nicht aus dem Gedächtnis geschrieben.

- **A) BMF-Kaufpreisaufteilung** — Felder aus `frontend/js/bmf-modal-html.html`
  (Arbeitshilfe des BMF, Stand Juni 2023)
- **B) Restnutzungsdauergutachten** — Felder aus `frontend/js/rnd-wizard.js`
  und dem Modell in `marktbericht/backend/src/lib/anlage2.js`
  (Anlage 2 ImmoWertV, BGBl. I 2021 Nr. 44, S. 2819 f.)

---

## A) BMF-Rechner — Kaufpreisaufteilung

### A1 · Kaufvertrag und Anschaffungskosten

| Angabe | Beleg |
|---|---|
| Kaufpreis | Notarvertrag |
| Datum des Kaufvertrags | Notarvertrag |
| Grunderwerbsteuer | Steuerbescheid |
| Notarkosten | Notarrechnung |
| Grundbuchamt | Gebührenrechnung |
| Maklergebühr | Maklerrechnung |
| Sonstige Erwerbsnebenkosten | Rechnungen (Vermessung, Energieausweis, Wertgutachten, Anwalt Kaufvorgang) |
| Fahrtkosten: Strecke gesamt (km) und Satz je km | Fahrtenaufstellung |
| Verpflegungsmehraufwand, Unterkunft | Belege der Besichtigungsreisen |

Zusätzlich, wenn nach dem Kauf gebaut oder saniert wurde:

| Angabe | warum |
|---|---|
| Anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG) | alle Rechnungen der ersten drei Jahre — die 15-%-Grenze wird daran geprüft |
| Herstellungskosten Gebäude (§ 255 Abs. 2 HGB) | Erweiterung oder Standardhebung: 100 % Gebäude, kein Grund-Split, keine 15-%-Prüfung |

### A2 · Objekt

| Angabe | Beleg |
|---|---|
| Grundstücksart — eine von sieben | Wohnungseigentum · Mietwohngrundstück (MFH) · Ein-/Zweifamilienhaus · gemischt genutzt (gewerblicher Anteil < 50 %) · gemischt genutzt (> 50 %) · Geschäftsgrundstück/-haus · Bürogebäude |
| Baujahr | Bauakte, Kaufvertrag, Energieausweis |
| Wohn-/Nutzfläche in m² | Wohnflächenberechnung |
| Grundstücksfläche in m² | Grundbuchauszug, Flurstücksnachweis |
| Bodenrichtwert in €/m² | holen wir selbst — der Kunde muss nur die genaue Lage nennen (Straße, Hausnummer, Flurstück) |
| Miteigentumsanteil in % | Teilungserklärung — **nur bei Eigentumswohnung** |

### A3 · Ertragswert-Zweig

Wird gebraucht bei Mietwohngrundstücken, gemischt genutzten und
Geschäftsgrundstücken:

| Angabe | Beleg |
|---|---|
| Monatliche Nettokaltmiete | Mietvertrag, Mieterliste |
| Bei Leerstand oder Eigennutzung: ortsübliche Vergleichsmiete | Mietspiegel |
| Liegenschaftszinssatz (optional) | leer = amtlicher Modellwert aus unserem Register |
| Vergleichsfaktor des Gutachterausschusses (optional) | Grundstücksmarktbericht |

### A4 · Modernisierungen

Für das fiktive Baujahr, je Element **nein / teilweise / ja**:
Dach inkl. Dämmung · Fenster & Türen · Leitungssysteme · Heizungsanlage ·
Wärmedämmung Außenwände · Bäder · Innenausbau · Grundriss.

### A5 · Papiere in einem Rutsch

1. Notarvertrag (auch wegen einer eventuell dort vereinbarten Aufteilung)
2. Grunderwerbsteuerbescheid
3. Notar- und Grundbuchrechnung
4. Maklerrechnung
5. Grundbuchauszug oder Flurstücksnachweis
6. Wohnflächenberechnung
7. Teilungserklärung mit Aufteilungsplan — bei Eigentumswohnung
8. Mietvertrag oder Mieterliste
9. Alle Handwerkerrechnungen der ersten drei Jahre nach dem Kauf

---

## B) Restnutzungsdauergutachten

### B1 · Beteiligte und Termine

| Angabe |
|---|
| Auftraggeber: Name, Straße, PLZ, Ort |
| Eigentümer, falls abweichend: Name, Straße, PLZ, Ort |
| Bewertungsstichtag |
| Besichtigungsdatum |

### B2 · Objekt-Basis

| Angabe | Beleg |
|---|---|
| Objekttyp: Einfamilienhaus · Zweifamilienhaus · Mehrfamilienhaus · Eigentumswohnung | |
| Adresse: Straße, Hausnummer, PLZ, Ort | |
| Baujahr | Bauakte, Kaufvertrag, Energieausweis |
| Wohnfläche in m² | Wohnflächenberechnung |
| Bewertete Einheit und Einheiten gesamt | bei MFH und ETW |
| Vollgeschosse, Unterkellerung, Bauweise | Grundrisse, Schnitte |

### B3 · Technische Ausstattung

Bedachung · Fenstertyp · Heizungsart · Energieträger/Brennstoff ·
Warmwasserbereitung · Belüftung (herkömmliche Fensterlüftung oder Anlage) ·
Erschließung · erneuerbare Energien · Energieklasse.

Beleg: Energieausweis, Heizungsrechnung, Wartungsprotokoll.

### B4 · Modernisierungen — der Kern der Rechnung

Die acht Elemente der Anlage 2 ImmoWertV, zusammen 20 Punkte:

| Element | max. Punkte |
|---|---|
| Dacherneuerung inklusive Verbesserung der Wärmedämmung | 4 |
| Modernisierung der Fenster und Außentüren | 2 |
| Modernisierung der Leitungssysteme (Strom, Gas, Wasser, Abwasser) | 2 |
| Modernisierung der Heizungsanlage | 2 |
| Wärmedämmung der Außenwände | 4 |
| Modernisierung von Bädern | 2 |
| Modernisierung des Innenausbaus (Decken, Fußböden, Treppen) | 2 |
| Wesentliche Verbesserung der Grundrissgestaltung | 2 |

**Zu jedem Element gehört das Jahr der Maßnahme, nicht nur ein Häkchen.**
Die Verordnung sagt: liegen die Maßnahmen weiter zurück, sind weniger als
die Maximalpunkte anzusetzen. Ohne Jahreszahl ist die Punktzahl nicht
begründbar — und damit das Gutachten angreifbar.

Aus der Summe ergibt sich der Modernisierungsgrad:

| Punkte | Grad |
|---|---|
| 0–1 | nicht modernisiert |
| 2–5 | kleine Modernisierungen im Rahmen der Instandhaltung |
| 6–10 | mittlerer Modernisierungsgrad |
| 11–17 | überwiegend modernisiert |
| 18–20 | umfassend modernisiert |

### B5 · Zustand der Gewerke

Je Gewerk der **heutige** Zustand — getrennt von der Frage, ob modernisiert
wurde. Ein nicht modernisiertes Bauteil, das noch zeitgemäßen Ansprüchen
genügt, bekommt vergleichbare Punkte; das steht so in der Verordnung.

### B6 · Schäden und Mängel

Liste der sichtbaren Mängel. Optional, geht aber in die sachverständige
Würdigung ein und kann einen Abschlag begründen.

### B7 · Nachweise

1. **Handwerkerrechnungen aller Modernisierungen mit Datum** — das ist der
   Punktekern; ohne sie bleibt die Punktzahl Behauptung
2. Fotos: außen, innen, Haustechnik, jeder benannte Mangel
3. Energieausweis
4. Grundrisse und Wohnflächenberechnung
5. Baujahrnachweis (Bauakte, Kaufvertrag)
6. Bei Eigentumswohnung: Teilungserklärung **und Protokolle der
   Eigentümerversammlungen** — Dach, Fassade und Heizung sind
   Gemeinschaftseigentum, die Beschlüsse sind dort der einzige Nachweis

### B8 · Zwei Dinge vorher prüfen

- **Die Gesamtnutzungsdauer entscheidet mit.** Eine Restnutzungsdauer von
  34 Jahren bedeutet etwas anderes bei GND 70 als bei GND 80. Die GND kommt
  aus dem Modell des zuständigen Gutachterausschusses, nicht aus dem Bauch.
- **Die Formel greift erst ab einem Mindestalter.** Anlage 2 gibt je
  Punktzahl ein relatives Alter vor, ab dem sie anwendbar ist — bei
  0 Punkten erst ab 60 % der GND, bei 18–20 Punkten schon ab 10 %. Bei
  einem jungen, unmodernisierten Gebäude bringt das Gutachten nichts.
- Für das Finanzamt gilt das BMF-Schreiben vom 22.02.2023: die verkürzte
  Restnutzungsdauer muss durch ein Gutachten begründet sein. Das
  Baujahr-Alter-Modell allein reicht nicht.
