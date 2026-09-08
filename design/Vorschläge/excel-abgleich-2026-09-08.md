# Was die drei Excel-Mappen können — und was DealPilot davon hat

**Stand 08.09.2026.** Geprüft wurden alle drei Mappen aus `design/mockups/`
mit allen Blättern — 34 Arbeitsblätter, rund 21.000 belegte Zellen und
19.000 Formeln. Gelesen wurde die Datei selbst (ZIP + XML), nicht eine
Zusammenfassung.

| Mappe | Blätter | Formeln | Rolle |
|---|---|---|---|
| `immocation Kalkulationstool Cockpit Pro` | 12 | 14.400 | Vollständiges Investment-Cockpit |
| `Kapitalanlagerechner_06_2025` | 7 | 2.720 | Neubau/Kapitalanlage, Steuerschwerpunkt |
| `ImmoKalk_HF_Sachsenstr.16` | 15 | 3.320 | Marcels eigene Mappe, Vorbild von DealPilot |

---

## 1 · Was DealPilot schon hat — und meist besser

Beim Abgleich hat sich gezeigt: **die großen Rechenwerke sind abgedeckt.**
Mehrere Dinge kann DealPilot sogar genauer.

| Funktion | Excel | DealPilot |
|---|---|---|
| Cashflow vor/nach Steuern | alle drei | ✓ `cf_op`, `cf_ns`, dazu `cf_banker` und `cf_full` |
| Kennzahlen zu drei Zeitpunkten | ImmoKalk | ✓ heute / Ende Zinsbindung / nach Anschluss |
| Degressive AfA § 7 Abs. 5a | Kapitalanlagerechner | ✓ `afa-engine.js` — **mit automatischem Wechsel zu linear** |
| § 7b Sonder-AfA | Kapitalanlagerechner | ✓ inkl. 4.000 €/m²-Deckel |
| Equity Multiple / Money Multiple | Kapitalanlagerechner | ✓ als `em`, dazu `em_pe` als PE-Variante |
| Zinsänderungsrisiko | immocation, ImmoKalk | ✓ `zaer_m` / `zaer_pct` |
| Vermögenszuwachs zerlegt | immocation (3 Teile) | ✓ **5 Teile** — Tilgung durch Mieter, Eigenanteil, Bausparguthaben, CF-Überschuss, Wertsteigerung |
| 15 %-Grenze anschaffungsnah | immocation (pauschal) | ✓ **feiner** — rechnet Küche heraus, Nebenkosten anteilig |
| Bauspar-/Tilgungsaussetzung | ImmoKalk | ✓ vollständig |
| Kalkulatorischer Mietausfall | immocation | ✓ |
| Sanierung nach Gewerken | immocation | ✓ acht Gewerke |
| **DSCR** | **in keiner Mappe** | ✓ eigener Rechenkern |
| **Marktbericht / Wertermittlung** | **in keiner Mappe** | ✓ ImmoWertV-konform |
| **Anlage V, Steuer-Mappe** | ansatzweise | ✓ vollständig |

**Fazit zum ersten Teil deiner Frage:** Von den Rechenfunktionen der drei
Mappen deckt DealPilot den weit überwiegenden Teil ab, und die
Kernrechnung ist an mehreren Stellen sorgfältiger als die Vorlagen.

---

## 2 · Echte Lücken — nach Nutzen sortiert

### A · Mehr als zwei Darlehen (immocation: vier)

immocation führt **Darlehen I–IV**, jedes mit eigenem Zinssatz, Tilgung,
**Zinsänderung je Jahr** und **einmaliger Sondertilgung**, dazu einen
**gewichteten Zinssatz** über alle. Der Kapitalanlagerechner hat fünf
Zeilen, darunter zwei KfW-Programme namentlich (KfW 296, KfW 298).

DealPilot kann zwei Darlehen plus Bausparvertrag. Für eine ETW reicht
das; für ein MFH mit KfW-Beimischung nicht.

**Aufwand:** mittel. Der Rechenkern kennt Darlehen bereits generisch.

### B · Der Sanierungsplaner als Katalog

immocations Blatt ist kein Formular, sondern ein **wachsender
Preiskatalog**: Tätigkeit · Einheit (m² Wandfläche, Stück …) · Kosten pro
Einheit · **typische Schwankung** · geplanter Aufwand · Kosten min/max ·
Kommentar. Elf Gruppen von Fassade bis Balkone.

DealPilot hat acht Gewerke mit je einem Betrag. Der Unterschied: bei
immocation **schätzt man Mengen, nicht Beträge** — und der Katalog lernt
mit.

**Das halte ich für die interessanteste Übernahme.** Es passt zu einem
Sachverständigen-Werkzeug und ist etwas, das kein Wettbewerber als SaaS
hat. Aufwand: hoch (eigene Datenhaltung), Wirkung: hoch.

### C · MFH-Kalkulator: Einheiten einzeln

immocation rechnet **bis zu 30 Einheiten** einzeln — je Wohnfläche,
Ist-Miete, geplante Erhöhung, daraus €/m². DealPilot kennt `einheiten` als
Zahl, aber keine Mietaufstellung je Wohnung.

Für MFH ist das der eigentliche Arbeitsschritt: **wo ist Mietpotenzial?**
Aufwand: mittel. Wirkung: hoch für die MFH-Zielgruppe.

### D · Break-Even-Zeitpunkte

immocation zeigt drei Zeitpunkte, die DealPilot nicht ausweist:
- Cashflow nach Steuern **erstmals positiv**
- Kumulierter Cashflow **erstmals positiv**
- Kumulierter Cashflow **inklusive Eigenkapital** erstmals positiv

Die Daten liegen in DealPilot vollständig vor (15-Jahres-Projektion) — es
fehlt nur die Auswertung „ab wann". **Aufwand: klein. Wirkung: gut** —
das ist eine Zahl, die Käufer wirklich fragen.

### E · Anfängliche Investitionen mit Steuer- und Wertwirkung

immocation lässt je Maßnahme entscheiden: **aktivieren oder sofort
abziehen** — und getrennt davon, **wie viel Wert** die Maßnahme schafft
(Küche 2.500 € Kosten → 4.000 € Wertzuwachs). Daneben steht die
15 %-Grenze als Warnschwelle.

DealPilot erfasst Investitionen, aber nicht ihre Wertwirkung.
**Aufwand: klein.**

### F · Denkmal-AfA

immocation führt eine **eigene Abschreibungsbasis für Denkmalanteile**
mit eigenem Satz (7 %/9 % nach §§ 7h/7i EStG). DealPilot kennt sie nicht —
`grep` nach „denkmal" findet im gesamten Frontend nichts.

Für Sanierungsobjekte in Ostdeutschland ist das ein häufiger Fall.
**Aufwand: mittel** (die AfA-Engine kann bereits zwei Reihen addieren).

### G · Bank-Unterlagen: Haushaltsrechnung und Vermögensaufstellung

immocation liefert zwei fertige **Bank-Vorlagen** zum Ausdrucken:
Einnahmen/Ausgaben des Haushalts und eine Vermögensübersicht mit
Verbindlichkeiten. Dazu ein Blatt „Bankgespräch" als einseitige
Investitionsübersicht.

DealPilot hat einen Bankexport für das Objekt, aber nichts zur **Person**.
Genau das verlangt aber jede Bank. **Aufwand: klein** (Formular + PDF).
**Wirkung: hoch** — das ist der Moment, in dem der Nutzer DealPilot
jemandem zeigt.

### H · Szenarien-Vergleich

immocation variiert Kaufpreis, Darlehensanteil, Zins und Tilgung in
Sprüngen und stellt die Ergebnisse nebeneinander. DealPilot rechnet immer
genau einen Fall.

**Aufwand: mittel. Wirkung: mittel** — hübsch für die Verhandlung
(„bei 380.000 € statt 400.000 € sieht es so aus").

### I · Kleinere Einzelposten

- **Splitting-Tarif / zwei Einkommen** — der Kapitalanlagerechner rechnet
  Grund- und Splittingtabelle; DealPilot kennt nur ein `zve`.
- **Tilgungsfreie Jahre** zu Beginn (Kapitalanlagerechner)
- **Bauzeitzinsen** (Neubau)
- **Grunderwerbsteuer nur auf den Grundstücksanteil** — bei
  Bauträgerverträgen der Normalfall
- **Empfohlene Instandhaltungsrücklage** als Vorschlag (immocation
  rechnet sie vor, DealPilot lässt den Nutzer raten)
- **Konfigurierbare Ampel-Schwellwerte** je Kennzahl (immocation
  „Konfiguration"); DealPilot hat feste Schwellen im Code

---

## 3 · Import — was heute gelesen wird und was liegen bleibt

**Es gibt bereits zwei Importwege** in `frontend/js/immokalk-import.js`:
die Mappe wird am Blattnamen erkannt (`Cockpit` → immocation,
`Immobilienkalkulation` → ImmoKalk).

| | gelesene Zellen | Blätter |
|---|---|---|
| ImmoKalk | 45 | 1 von 15 |
| immocation | 41 | 1 von 12 |
| **Kapitalanlagerechner** | **0** | **kein Import** |

### Was beim immocation-Import liegen bleibt

- **Darlehen II, III und IV** — gelesen wird nur Darlehen I (`N17`–`N19`).
  Die Zellen `N25`–`N27`, `N32`–`N34`, `N39`–`N41` bleiben liegen.
  **Das ist die größte Lücke**, und Darlehen II könnte sofort in `d2`.
- **Anfängliche Investitionen** (`C26`–`C29` mit Steuer- und Wertwirkung)
- **Sonstige Kostenpositionen I–IV**, umlagefähig und nicht umlagefähig
  (`K32`–`K46`) — DealPilot hat `ul_sonst` und `nul_sonst` dafür
- **MFH-Kalkulator** — bis 30 Einheiten mit Mieten, komplett ungenutzt
- **Sanierungsplaner** — komplett ungenutzt

### Was beim ImmoKalk-Import liegen bleibt

Der Import liest nur `Immobilienkalkulation`. Nicht gelesen werden
`Steuerformular`, `Kennzahlen`, `Auswertung`, `AuswertungBank` und
`Grundwerte`. Das ist teilweise richtig — es sind Ergebnisblätter. Aber
`Grundwerte` und `Steuerdaten` enthalten Eingaben.

### Kapitalanlagerechner

**Kein Import.** Sinnvoll wären das `Dashboard` (Eckdaten, Investition,
Finanzierung mit fünf Darlehen, Steuer mit zwei Personen) und der
Instandhaltungs-Maßnahmenplan.

**Aufwand für alle drei Ergänzungen: klein bis mittel** — die Mechanik
steht, es sind zusätzliche Zellzuordnungen.

---

## 4 · Zwei Befunde, die beim Abgleich aufgefallen sind

### IRR wird beworben, aber nicht gerechnet

`ui.js:572` schreibt `IRR: ' + fP(K.irr, 1)` in den KI-Prompt. **`K.irr`
existiert nicht** — im Browser gemessen: 59 KPI-Schlüssel, `irr` ist nicht
darunter, `typeof` ist `undefined`. `fP(undefined)` liefert `—`, die KI
bekommt also „IRR: —".

Das ist mehr als ein Anzeigefehler: **die Landingpage bewirbt IRR**
(`landing/index.html:847`: „Cashflow, DSCR, LTV, IRR, Rendite & Faktor"),
und das Hilfe-Glossar erklärt ihn (`help.js:364`). ImmoKalk rechnet ihn
(„Rendite (Interner Zinsfuß IIR)").

**Zwei Wege:** IRR wirklich rechnen (die Zahlungsreihe liegt vollständig
vor, das ist überschaubar) — oder ihn aus Landing, Glossar und Prompt
entfernen. Das Erste ist besser: die Daten sind da.

### § 7b — die Baukostenobergrenze wird nicht geprüft

`afa-engine.js:21` nennt als Bedingung „Baukosten max. 5.200 €/m²
Wohnfläche (förderfähig nur 4.000 €/m²)". Der **4.000er-Deckel ist im Code**
(`afa-engine.js:253`). Die **5.200er-Grenze steht nur im Kommentar** —
`grep` findet sie in keiner Rechenzeile.

Folge: DealPilot rechnet die Sonder-AfA auch bei Objekten, bei denen sie
nicht zusteht. Der Kapitalanlagerechner prüft sie ausdrücklich
(`Afa_Tabelle` B17 „Baukostenobergrenze", B18 „Beschränkung Afa p.a.").

**Aufwand: sehr klein.** Da § 7b in `CLAUDE.md` unter „nicht anfassen"
steht, ist das deine Entscheidung.

### Eine Frage an dich als Sachverständigen

immocation rechnet die 15 %-Grenze **× 1,19**, also brutto
(`C31 = 0,15 × Gebäudequote × (KP + NK) × 1,19`). DealPilot rechnet sie
netto. Wenn ein Nutzer Handwerkerrechnungen **brutto** einträgt und gegen
eine **Netto**-Grenze vergleicht, warnt DealPilot zu früh. Ich weiß
nicht, welche Seite hier die richtige ist — das kannst du besser
beurteilen.

---

## 5 · Was ich vorschlagen würde

**Zuerst, weil klein und sofort spürbar:**
1. Break-Even-Zeitpunkte ausweisen (Daten liegen vor)
2. Import: Darlehen II–IV aus immocation, sonstige Kostenpositionen
3. IRR entweder rechnen oder aus der Werbung nehmen
4. § 7b-Baukostenobergrenze prüfen

**Danach, weil es DealPilot von Excel abhebt:**
5. Haushaltsrechnung und Vermögensaufstellung als Bank-Paket
6. MFH-Mietaufstellung je Einheit
7. Sanierungskatalog mit Mengen und Preisspannen

**Offen gelassen:** Denkmal-AfA, Szenarienvergleich, Splitting-Tarif — je
nachdem, wie oft die Fälle bei deinen Nutzern vorkommen. Das weißt du
besser als jede Messung.
