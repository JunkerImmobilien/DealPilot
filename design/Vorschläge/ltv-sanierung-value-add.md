# LTV bei Sanierungs- und Value-Add-Deals — Befund und Vorschlag

**Backlog v22, Punkt 5** · 18.09.2026 · Stand: Vorschlag, nichts umgebaut.
Die Entscheidungen am Ende gehören Marcel.

---

## 1 · Was gemessen wurde

### Woher die 400 % kommen

Der LTV rechnet `Darlehen ÷ Bezugsgröße`. Die Bezugsgröße wählt `calc.js:1420`
in dieser Reihenfolge:

| Stufe | Bedingung | Bezugsgröße |
|---|---|---|
| 1 | Haken „LTV inkl. Erwerbsnebenkosten" | Gesamtinvestition |
| 2 | Verkehrswert eingetragen | Verkehrswert (§ 194 BauGB) |
| 3 | Bankbewertung > Kaufpreis | Bankbewertung |
| 4 | sonst | **Kaufpreis** |

Bei einem Sanierungsobjekt finanziert das Darlehen aber **Kaufpreis UND
Sanierung**. Der Wert, den die Sanierung schafft, steht in keinem der vier
Nenner. Beispiel mit den echten Formeln:

| | Betrag |
|---|---:|
| MFH, Kaufpreis | 400.000 € |
| Nebenkosten 10 % | 40.000 € |
| Sanierung | 600.000 € |
| **Gesamtinvestition** | **1.040.000 €** |
| Eigenkapital (= Nebenkosten) | 40.000 € |
| **Darlehen** | **1.000.000 €** |

| Kennzahl | Wert | taugt? |
|---|---:|---|
| LTV gegen Kaufpreis (heute angezeigt) | **250 %** | nein — Nenner kennt die Sanierung nicht |
| EK-Anzeige (`100 − LTV`, `calc.js:1437`) | **−150 %** | nein — negative EK-Quote |
| LTC = Darlehen ÷ Gesamtinvestition | 96,2 % | ja — was die Bank finanziert, gemessen an den Kosten |
| LTV nach Sanierung (Wert 1,25 Mio. angenommen) | 80,0 % | ja — so rechnet die Bank bei „as completed" |

**Der Wert ist rechnerisch richtig und fachlich falsch bezogen.** Ausblenden
wäre die falsche Antwort — er beantwortet nur eine Frage, die niemand stellt.

### Zweiter Befund: es gibt den LTV zweimal

| Stelle | Stufen | wer liest ihn |
|---|---|---|
| `calc.js:1414–1436` | 4 (mit Bankbewertung, Erbbau-Abzug) | Tab Finanzierung, Haupt-Score |
| `deal-kpis.js:97–106` | 3 (**ohne** Bankbewertung, ohne Erbbau-Abzug) | Quick Check, Dashboard, Sprechlauf |

> **Zurückgenommen (18.09.2026):** Im ersten Entwurf stand hier, der Quick
> Check bewerte bei einer Bankbewertung einen anderen LTV als der Tab. **Das
> stimmt heute nicht:** keiner der `DealKpis`-Aufrufer (Quick Check,
> Sprechlauf, Dashboard) übergibt eine Bankbewertung — der Quick Check hat
> das Feld gar nicht. Sichtbar weicht deshalb nichts ab.

Der Befund ist trotzdem größer als gedacht: **`calc.js` benutzt `DealKpis`
überhaupt nicht**, sondern rechnet alle Kennzahlen selbst (`calc.js:2588`).
Die zwei LTV-Fassungen sind nur die sichtbarste Stelle einer vollständigen
Doppelung. Das verstößt gegen „Rechenkerne nie duplizieren" (CLAUDE.md) und
wird zur Falle, sobald ein Aufrufer mit Bankbewertung dazukommt.

### Dritter Befund, gleiche Wurzel: die Bruttomietrendite

`deal-kpis.js:163`: `bmy = NKM ÷ Kaufpreis`. Beim Value-Add mit Ist 24.000 €
und Soll 72.000 € Jahresmiete:

| | auf Kaufpreis | auf Gesamtinvestition |
|---|---:|---:|
| Ist-Miete | 6,0 % | 2,3 % |
| Soll-Miete | **18,0 %** | **6,9 %** |

Wer die Soll-Miete einträgt, aber gegen den Kaufpreis rechnet, sieht 18 % —
die Sanierung, die diese Miete erst möglich macht, ist nicht im Nenner.
Die Nettomietrendite (`nmy`) rechnet schon richtig gegen die GI.

---

## 2 · Vorschlag

### A · Drei Begriffe sauber trennen (Datenmodell)

| Begriff | Feld | heute |
|---|---|---|
| Kaufpreis | `kp` | vorhanden |
| Wert heute (Ist) | `svw` / `bankval` | vorhanden |
| **Wert nach Sanierung (Soll)** | **neu**, z. B. `wert_soll` | fehlt |

Der Soll-Wert ist die Brücke zu Punkt 6 (Ist-/Soll-Modell). Quelle wahlweise:
von Hand · aus einem Gutachten · abgeleitet aus Soll-Miete × Faktor (dann
als *abgeleitet* gekennzeichnet, Stufe D).

### B · Welche Kennzahl wann

Ein Deal gilt als **Sanierungsfinanzierung**, wenn die Sanierung einen
nennenswerten Teil der Investition ausmacht — Vorschlag: **Sanierung ≥ 15 %
des Kaufpreises** (Schwelle ist Marcels Entscheidung, siehe unten).

| | normaler Deal | Sanierungsfinanzierung |
|---|---|---|
| Hauptkennzahl | LTV (wie heute) | **LTC** |
| zweite Zeile | — | **LTV nach Sanierung**, wenn Soll-Wert vorhanden |
| LTV gegen Wert heute | Hauptkennzahl | bleibt sichtbar, mit Satz: „Bezieht sich auf den Wert heute — die Sanierung ist darin nicht enthalten." |
| EK-Balken | `100 − LTV` | **EK ÷ Gesamtinvestition** (nie negativ) |

### C · Ein Rechenkern

Die LTV-Wahl wandert **ganz** nach `DealKpis.compute()` — mit Bankbewertung,
Erbbau-Abzug und den neuen Kennzahlen `ltc` und `ltv_soll`. `calc.js` liest
sie von dort, statt selbst zu rechnen. Quick Check und Tab Finanzierung
zeigen danach dieselbe Zahl.

### D · Bruttomietrendite

Bei Sanierungsfinanzierung zusätzlich **BMY auf Gesamtinvestition**
ausweisen; auf dem Kaufpreis bleibt sie stehen, aber beschriftet
(„auf Kaufpreis").

---

## 3 · Was Marcel entscheiden muss

1. **Schwelle** für „Sanierungsfinanzierung": 15 % des Kaufpreises? Oder
   ein fester Betrag? Oder immer, sobald Sanierung > 0?
2. **Was geht in den Deal Score?** Heute der LTV (Buckets 70/85/95/105 %).
   Bei Sanierung: LTV nach Sanierung, wenn vorhanden, sonst LTC? Die
   LTV-Buckets passen nicht ohne Weiteres auf LTC (LTC ist fast immer höher).
3. **Soll-Wert ohne Gutachten:** darf DealPilot ihn aus Soll-Miete × Faktor
   ableiten (als *indikativ* gekennzeichnet), oder nur eine eingegebene Zahl?

**Nicht vorgezogen:** Befund 2 zusammenzuführen heißt, `calc.js` auf
`DealKpis` umzustellen — ein eigener Umbau mit Regressionsrisiko an jeder
Kennzahl, nicht nur am LTV. Er gehört zu Punkt 19 (Abschluss-QA, „gemeinsame
fehlerhafte Berechnungslogik") und wird dort mit einem Kennzahlen-Vergleich
alt gegen neu abgesichert.
