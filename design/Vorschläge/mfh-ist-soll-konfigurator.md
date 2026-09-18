# Mehrfamilienhaus: Ist/Soll-Modell und Einheiten-Konfigurator — Konzept

**Backlog v22, Punkt 6** (und Grundlage für Punkt 22) · 18.09.2026 ·
Konzept, **nichts gebaut**. Gebaut wird nach Marcels Auswahl.

---

## 0 · Ausgangslage (gemessen)

| Heute vorhanden | Wo | Was fehlt |
|---|---|---|
| Ein Objekt = eine Zahlenreihe (Kaufpreis, Miete gesamt, Sanierung als Summe) | Tab Objekt, `calc.js` | Ist und Soll als **zwei Zustände desselben Objekts** |
| Wohneinheiten als eine Zahl `einheiten` (seit v1437 im Sprechlauf gefragt) | `objektart-felder.js` | die Einheiten selbst |
| Mietentwicklung: Prozent p. a., Staffeln, „Soll-Mietspiegel" | Tab Miete | Soll-Miete **je Einheit**, Leerstand **je Einheit** |
| Sanierung als ein Betrag `san` | Tab Objekt | Zuordnung zu Einheiten/Gewerken, Zeitpunkt |
| LTV gegen Kaufpreis/Wert heute | `calc.js:1420` | Wert **nach** Sanierung (→ Punkt 5) |

Leitplanken aus dem Backlog: **ein Deal, eine Finanzierung** — Ist und Soll
sind keine zwei Deals. Der einfache MFH-Weg bleibt schnell; der Konfigurator
ist eine **optionale Vertiefung**.

---

## 1 · UX-Ablauf

```
Tab Objekt · Objektart = Mehrfamilienhaus
┌──────────────────────────────────────────────────────────────┐
│ Wohnfläche 612 m² · Einheiten 8 · Kaltmiete 4.150 €/Monat    │  ← wie heute
│                                                              │
│ ▸ Erweiterte Angaben zum Mehrfamilienhaus   (optional)       │  ← neu
│   Aufgeteilt nach WEG?  ( ) ja  (•) nein                     │
└──────────────────────────────────────────────────────────────┘
          │ öffnet
          ▼
Modal „Einheiten" ───────────────────────────────────────────────
 Nr │ Lage   │ m²  │ Zi │ Ist-Miete │ Soll-Miete │ Status   │ Zustand      │ Maßnahme
 01 │ EG li  │ 68  │ 3  │   480 €   │   650 €    │ vermietet│ renov.bed.   │ Bad, Böden
 02 │ EG re  │ 68  │ 3  │     —     │   650 €    │ leer     │ sanierungsb. │ Kernsan.
 …  │        │     │    │           │            │          │              │
 [+ Einheit]  [Zeile duplizieren]  [Aus Mieterliste einfügen (CSV)]
───────────────────────────────────────────────────────────────────
 Summe  612 m² · 8 WE · Ist 3.620 € · Soll 5.240 € · Leerstand 2 WE (136 m²)
 [Übernehmen]  → schreibt Fläche, Einheiten, Kaltmiete (Ist) ins Objekt
```

**Schnell bleibt schnell:** Wer den Konfigurator nie öffnet, arbeitet wie
heute mit den Summen. Wer ihn öffnet, erzeugt die Summen daraus — die
Summenfelder werden dann **abgeleitet** (grau, mit Hinweis „aus 8 Einheiten")
und sind nicht mehr direkt tippbar, bis der Konfigurator geleert wird. So
gibt es nie zwei widersprüchliche Wahrheiten.

**Duplizieren** ist der Beschleuniger: Viele MFH haben 2–3 Grundrisse.
Eine Zeile anlegen, siebenmal duplizieren, Nummer und Lage ändern.

---

## 2 · Datenmodell

Hierarchie **Objekt → Gebäude → Einheit**, mit Vererbung (gilt ebenso für
Punkt 22). Ein Gebäude reicht für fast alle Fälle; mehrere Gebäude (Vorder-/
Hinterhaus) sind vorgesehen, aber nicht Pflicht.

```json
{
  "gebaeude": [{
    "id": "g1", "bezeichnung": "Hauptgebäude",
    "baujahr": 1968, "heizung": "Gas-Zentral", "dach": "2009 erneuert",
    "zustand": { "dach": 4, "fassade": 2, "heizung": 3 },
    "einheiten": [{
      "id": "e01", "nr": "01", "lage": "EG links", "art": "wohnen",
      "wfl": 68, "zimmer": 3,
      "ist":  { "status": "vermietet", "kaltmiete": 480, "zustand": { "bad": 2, "kueche": 2 } },
      "soll": { "kaltmiete": 650, "zustand": { "bad": 4, "kueche": 4 },
                "massnahmen": [{ "gewerk": "Bad", "kosten": 14000, "quartal": "2027-Q2" }] },
      "erbt":   { "baujahr": true, "heizung": true },
      "notiz":  "Mieter seit 2011, Kündigung nicht geplant"
    }]
  }]
}
```

- **Gewerbe** ist `art: "gewerbe"` — damit ist der Gewerbeanteil (fehlt heute
  ganz, siehe Punkt 16) eine Auswertung, kein eigenes Feld.
- **`erbt`** hält fest, welche Werte vom Gebäude kommen. Eine Änderung am
  Gebäude zieht in alle Einheiten mit `erbt: true` durch; ein bewusst
  überschriebener Einheitswert bleibt. In der Oberfläche: geerbte Werte grau
  mit kleinem ↳-Zeichen, überschriebene schwarz.
- Gespeichert als **ein JSON-Feld am Objekt** (`_mfh`), wie heute
  `ai_lage_cache` — keine neue Tabelle, keine Migration für den ersten Schritt.

---

## 3 · Aggregation (was ins normale Objekt geht)

| Objektfeld | Regel |
|---|---|
| `wfl` | Σ wfl aller Einheiten (Wohnen + Gewerbe, getrennt ausgewiesen) |
| `einheiten` | Anzahl Einheiten mit `art = wohnen` |
| `nkm` (Ist) | Σ Ist-Kaltmiete der **vermieteten** Einheiten |
| Soll-Miete | Σ Soll-Kaltmiete aller Einheiten → speist Mietentwicklung (Sprung zum Soll-Zeitpunkt) |
| `leerstand` (Ist) | Fläche leer ÷ Fläche gesamt |
| `san` | Σ Kosten aller Maßnahmen (+ Gebäudemaßnahmen) |
| `ds2_zustand` | flächengewichtetes Mittel der Einheitszustände, auf die 5-Stufen-Skala (→ Punkt 17) gerundet |
| Gewerbeanteil | Gewerbefläche ÷ Gesamtfläche, Gewerbemiete ÷ Gesamtmiete |

Keine zweite Rechnung: die Aggregation **schreibt die bestehenden Felder**,
`calc.js` rechnet unverändert.

---

## 4 · Kennzahlen Ist gegen Soll

Ein Deal, eine Finanzierung — aber zwei Blickwinkel auf die Kennzahlen:

| Kennzahl | Ist (heute) | Soll (stabilisiert) |
|---|---|---|
| Kaltmiete p. a. | Σ Ist | Σ Soll |
| Bruttomietrendite | Ist ÷ Kaufpreis | **Soll ÷ Gesamtinvestition** (Punkt 5) |
| Objektwert | Wert heute | **Wert nach Sanierung** (Punkt 5) |
| LTV | auf Wert heute | **LTV nach Sanierung** / LTC |
| DSCR | mit Ist-Miete | mit Soll-Miete |
| Leerstand | Ist-Quote | Ziel-Quote |

Dargestellt als **zwei Spalten nebeneinander** mit einem Pfeil dazwischen —
das ist die „Value-Add-Story" für Bank und Investor: *heute so, nach
Maßnahmen so, dafür nötig so viel.*

---

## 5 · Wer liest was

| Verbraucher | braucht |
|---|---|
| Investmentrechnung (`calc.js`) | Summen (wie heute) + Soll-Miete mit Zeitpunkt |
| Marktbericht | Einheiten (`units`, seit v1437 übergeben), Gewerbeanteil, Zustand |
| Bank (Ready für die Bank, Investment-PDF) | Mieterliste Ist/Soll als Tabelle, Maßnahmenplan, Kennzahlen Ist/Soll |
| RND / Punkt 22 | Gebäudedaten einmal, Zustand je Einheit als Zusatz |
| Sprechlauf | Einheitenzahl, Ist-Miete gesamt, Leerstand — Einzelwohnungen nur auf Wunsch |

---

## 6 · Stufen der Umsetzung (Vorschlag)

1. **Einheitenliste + Aggregation** (Ist): Modal, Duplizieren, Übernehmen in
   die Summen. Kein Soll. → sofort nutzbar für Mieterlisten.
2. **Soll je Einheit + Maßnahmen**: Soll-Miete, Soll-Zustand, Maßnahmen mit
   Kosten und Quartal; Summe → `san`; Kennzahlen Ist/Soll.
3. **Wert nach Sanierung + LTV/LTC** (Punkt 5) und die Bankausgabe.
4. **Vererbung Gebäude → Einheit** (gemeinsam mit Punkt 22).

---

## 7 · Was Marcel entscheiden muss

1. Reicht **ein Gebäude** für den Anfang (mehrere später)?
2. **CSV-Import** einer Mieterliste gleich in Stufe 1?
3. Sollen die Summenfelder bei gefülltem Konfigurator **gesperrt** werden
   (eine Wahrheit) — oder überschreibbar mit Warnung?
4. Soll-Miete: ab **einem Stichtag** (Sprung) oder **gestaffelt** je Einheit
   nach Maßnahmenquartal?
