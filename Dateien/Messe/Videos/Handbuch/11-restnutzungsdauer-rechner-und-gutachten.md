# 11 · Restnutzungsdauer-Rechner und RND-Gutachten

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 10c „Der Restnutzungsdauer-Rechner" (`DREHBUECHER`-Schlüssel `reihe-rnd`, Studio `?modul=10c`), Teil von
> Modul 10a (`reihe-steuer`) · Messe-Geschichten: 4 Westerfeldstr. (Gutachten), 5 RND-Abgleich, 11 Alexanderstr.,
> 12 Am Markt 18 (design/Messe/demo-geschichten.md)

## 1 · Wozu

Zwei Prozent AfA über 50 Jahre — das unterstellt das Gesetz für jedes Gebäude ab 1925. Ist das Haus in Wahrheit
früher am Ende seiner Reise, erlaubt § 7 Abs. 4 Satz 2 EStG einen höheren Satz, belegt durch ein Gutachten. Der
Restnutzungsdauer-Rechner zeigt vor dem Auftrag, **ob** sich ein Gutachten lohnt: Er rechnet die modifizierte
Restnutzungsdauer nach Anlage 2 ImmoWertV aus Baujahr und Modernisierungen — als Pre-Flight-Check, bevor du Geld für
den Sachverständigen ausgibst.

## 2 · Wo in der App

- **Reiter Steuer → Karte AfA-Konfiguration → Feld AfA-Satz → „Eigenen Satz / Restnutzungsdauer eingeben …"**:
  Restnutzungsdauer (Jahre) eintragen, der Satz ergibt sich als 100 ÷ RND (plausibel 0,5–33,3 %); Feld **Grundlage**
  (z. B. Gutachten mit Datum). Ein eigener Satz wird von keiner Automatik überschrieben.
- **„Restnutzungsdauer ermitteln"** öffnet den Assistenten (`frontend/js/rnd-wizard.js`) in neun Schritten:
  1 Objekt-Basis · 2 Auftraggeber & Stichtag · 3 Bauliche Anlagen · 4 Gebäudetechnik · 5 Modernisierungen ·
  6 Zustand der Gewerke · 7 Schäden & Mängel · 8 Sachverständiger · 9 Ergebnis & Empfehlung.
  Am Ende: Spanne in ganzen Jahren, **„übernehmen"** in den AfA-Satz und eine Gutachten-Anfrage.
- Liegt eine Ermittlung vor, erscheint **„Letzte Ermittlung übernehmen"** (als indikativ vermerkt).
- Ein vorhandenes RND-Gutachten liest **Aktionen → Import → Dokument einlesen** (Art „Restnutzungsdauergutachten");
  der Gutachtenwert wird nur zum Vergleich gezeigt, nicht übernommen (siehe 27).

## 3 · Schritt für Schritt — Beispiel Ravensberger Weg 38, Bielefeld (MFH, 8 WE, Bj 1978) — wie in Modul 10c

| Schritt | Eingabe |
|---|---|
| 1 Objekt-Basis | Mehrfamilienhaus, Adresse, Baujahr 1978 |
| 5 Modernisierungen | wie im Objekt gespeichert (Zahl live zeigen) |
| 9 Ergebnis | — |

**Was der Rechner zeigt:** Restnutzungsdauer **31–35 Jahre** (Modellwert 33, ± 2). „Übernehmen" setzt den AfA-Satz auf
**3,03 %**. Die AfA steigt von **18.451 € auf 27.953 €** im Jahr; die Steuer aus dem Objekt dreht von **592 €
Belastung auf 2.401 € Erstattung** — ein **Steuervorteil von 2.993 €** im Jahr.

**Grenze des Rechners — Parkstr. 9, Bad Oeynhausen (Bj 1905, 121 Jahre):** Ergebnis **10–14 Jahre**, am Scheitel der
Anlage 2 gehalten. Der Kasten **„Sachverständig zu würdigen"** erscheint, die Übernahme ist gesperrt. Das ist Haltung,
kein Fehler: Wo die Anlage 2 endet, erfindet DealPilot keine Zahl. Dasselbe gilt für Gohliser Str. 42 (1938) und
Bismarckstr. 27 (1908).

**Mit Gutachten — Westerfeldstr. 140, Bielefeld (Bj ca. 1967):** Das Nutzungsdauergutachten vom 28.05.2025 kommt auf
**16 Jahre** → AfA **6,25 %**. DealPilot kommt im Modell mit den 6 Wohnungen auf **25,7 Jahre** (3 Punkte aus den
Einheiten, Bericht 327; vorher 23,6 J. mit 2 Punkten bei 4 WE). Der Unterschied ist die
**Gesamtnutzungsdauer** (Gutachten 67 Jahre bei Gebäudestandard 2,4, Modell 80 Jahre), nicht die Punkte — genau das ist
der Mehrwert des Sachverständigen.

**Wo lohnt es sich? (Geschichte 5, Mehr-AfA × 40,45 %):**

| Objekt | Bj | Modell-RND | Steuer / Jahr weniger | Urteil |
|---|---:|---:|---:|---|
| Lindenhof 14, Castrop-Rauxel | 1972 | 25,8 J | ≈ 15.300 € | lohnt stark |
| Ravensberger Weg 38 | 1978 | 32,8 J | ≈ 4.100 € | lohnt |
| Am Markt 18, Kabelsketal | 1994 | 32,4 J | ≈ 500 € | knapp |
| Musterstr. 12, Leipzig | 1998 | 52 J | 0 € | bleibt bei 2 % |

**Zwei echte Gutachten liegen im Repo und sind seit 20.10.2026 im Objekt eingetragen:**
Am Markt 18 (DEMO-KK2) — Gutachten **26 J.** gegen Modell 32,4 J. → AfA **3,85 %**, Kauf 06.05.2024 (= Stichtag), also
**Bestand**; Alexanderstr. 11 (DEMO-BI4) — Gutachten **33 J.** (Bj 1976, GND 80, 2 Punkte, Stichtag 14.08.2024) → AfA
**3,03 %**, Kauf 14.08.2024, Bestand; Modell heute 30,9 J., AfA 1.677 €/Jahr. Beides darf als App-Stand gezeigt werden.

Belegt: Ravensberger/Parkstr. Videoreihe.md „Stand 16.10.2026 nachmittags", 10c; Westerfeld Geschichte 4 und Korrektur
(25,7 J., 3 Punkte, Bericht 327 vom 20.10.); Tabelle Geschichte 5; Am Markt 18 / Alexanderstr. Geschichten 5, 11, 12 (Eintrag 20.10.) und C.8/C.9; Schritte
`rnd-wizard.js:31–113`; „Sachverständig zu würdigen" `rnd-wizard.js:1285`.

## 4 · Was man daraus liest — Fragen am Stand

- **„Ab wann lohnt ein Gutachten?"** — Faustregel: unter rund 50 Jahren Restnutzungsdauer kann es die AfA heben,
  darüber bleibt es bei 2 %. Der Rechner zeigt die Größenordnung in Euro.
- **„Kann ich die Zahl des Rechners dem Finanzamt geben?"** — Nein. Sie zeigt, wo sich ein Auftrag lohnt. Die Zahl
  setzt das Gutachten.
- **„Warum ist das Gutachten kürzer als euer Modell?"** — Meist wegen der Gesamtnutzungsdauer, die der Sachverständige
  am Gebäudestandard festmacht.
- **„Und bei meinem Altbau?"** — Älter als die Gesamtnutzungsdauer: kein Modellwert, sachverständige Würdigung nötig.

## 5 · Grenzen und Kennzeichnung

- Ergebnis des Rechners = **indikativ**, Anlage 2 ImmoWertV, keine Begutachtung. **Keine Steuerberatung.**
- Fürs Finanzamt zählt der Anschaffungsstichtag; „Restnutzungsdauer in die AfA übernehmen" aus der
  Verkehrswert-Leiste rechnet mit Stichtag heute.
- Die Gutachten-Anfrage am Ende wird nur vorbereitet — im Video **nicht absenden**.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | AfA-Satz 2 % | AfA-Satz aufklappen | Zwei Prozent über fünfzig Jahre — das unterstellt das Gesetz. Ist das Haus früher am Ende, geht mehr. |
| 2 | Assistent Schritt 1 | „Restnutzungsdauer ermitteln" | Neun Schritte, vom Objekt über Modernisierungen bis zum Ergebnis — wie ein Sachverständiger fragen würde. |
| 3 | Schritt 5 Modernisierungen | Gewerke anklicken | Jede Modernisierung bringt Punkte nach Anlage 2 — und verlängert die Restnutzungsdauer. |
| 4 | Schritt 9 Ergebnis | — | 31 bis 35 Jahre, Modellwert 33. Ganze Jahre, mit Spanne — keine Scheingenauigkeit. |
| 5 | AfA-Konfiguration | „übernehmen" | AfA 3,03 Prozent: aus 592 Euro Steuerlast werden 2.401 Euro Erstattung im Jahr. |
| 6 | Altbau Parkstr. 9 | Ergebnis | Bei 121 Jahren endet die Anlage 2. DealPilot erfindet keine Zahl: sachverständig zu würdigen. |
| 7 | Grundlage-Feld | Text „Gutachten vom …" | Mit Gutachten trägst du die Restnutzungsdauer und die Grundlage ein. Die Zahl setzt der Sachverständige. |

### Sprechertext (Entwurf, ca. 100 Sekunden)

Zwei Prozent Abschreibung über fünfzig Jahre — so rechnet das Gesetz mit jedem Gebäude ab 1925. Ist dein Haus früher am
Ende seiner Nutzungsdauer, darfst du schneller abschreiben. Dafür brauchst du ein Gutachten. Aber lohnt es sich?
Genau das zeigt der Restnutzungsdauer-Rechner. In neun Schritten fragt er ab, was auch ein Sachverständiger wissen will:
Baujahr, Gebäudetechnik, Modernisierungen, Zustand der Gewerke. Am Ende steht eine Spanne in ganzen Jahren — hier 31 bis
35, Modellwert 33.
Übernimmst du das, steigt der AfA-Satz auf 3,03 Prozent. Aus 592 Euro Steuerlast werden 2.401 Euro Erstattung — fast
dreitausend Euro Unterschied, jedes Jahr.
Bei einem Haus von 1905 endet die Anlage 2. Dann sagt DealPilot das offen: sachverständig zu würdigen. Wir erfinden keine
Zahl.
Und wenn das Gutachten da ist, trägst du dessen Restnutzungsdauer ein — mit Datum als Grundlage. Der Rechner zeigt, wo es
sich lohnt. Die Zahl setzt der Sachverständige. Und die Steuerberatung bleibt beim Steuerberater.

## Querverweise

10 Steuer-Grundlagen (AfA-Satz) · 04 Reiter Objekt (Modernisierungspunkte, GND/RND-Zeile) · 07 MFH-Konfigurator
(Haus-RND) · 12 BMF-Kaufpreisaufteilung (zweiter Hebel: Gebäudeanteil) · 27 Dokument einlesen.
