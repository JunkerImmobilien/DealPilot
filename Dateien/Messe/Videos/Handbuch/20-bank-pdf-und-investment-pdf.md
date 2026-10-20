# 20 · Bank-PDF und Investment-PDF

> Stand 20.10.2026 (Staging bis v2544). Zahlen vor der Messe live gegenprüfen.
> Video: Modul 19 „Das Bank-PDF" (`DREHBUECHER`-Schlüssel `reihe-bankpdf`), Überblick 2 Kapitel 10 (`reihe-ueberblick2`) ·
> Messe-Geschichten: 13 Musterstr. (Bank-PDF), 8 Westerfeld Schritt 6 (design/Messe/demo-geschichten.md)

## 1 · Wozu

Am Ende des Boardings steht die Mappe, mit der du zur Bank gehst: der **Investment Case** deines Objekts. DealPilot erzeugt
ihn aus denselben Zahlen, die du in der App siehst — Kaufpreis mit jeder Nebenkostenzeile, Finanzierung, Kennzahlen,
Cashflow über die Phasen, Mieterliste, Wertpotenzial, Belastungsprobe und Annahmen. Es gibt drei Fassungen: die
**Bankfassung** auf weißem Papier mit Kennzahlen als Tabelle, und das **Investment-PDF** hell oder in Obsidian für Partner und Investoren.

## 2 · Wo in der App

- **Reiter Deal-Aktion → PDFs herunterladen → Investment-PDF.** Beim Klick fragt DealPilot nach der Fassung: **Bankfassung**, **hell** oder **Obsidian**.
  Mit „Diese Wahl merken" geht es danach über den Knopf **Fassung** neben „PDF" zurück zur Auswahl.
- Seitenleiste → **Aktionen → Ausgeben → Export → PDF-Report für Objekt**.
- Im PDF schaltest du die Pilot-Analyse über „Pilot-Analyse im PDF-Export einschließen" und die **Bausteine im PDF** ein oder aus (Reiter Pilot-Analyse).
- Eigenes Logo und Kontaktdaten im Kopf und Fuß: **Einstellungen → Kontakt & Logo**.
- Tipp aus der Hilfe: vorher einmal den Reiter Bewertung öffnen — dann sind alle Grafiken gezeichnet.

**Was drinsteht:**

| Bankfassung (rund 8–10 Seiten) | Investment-PDF hell / Obsidian (rund 12 Seiten) |
|---|---|
| Kaufpreis mit jeder Nebenkostenzeile, Gesamtinvestition, EK, Darlehen | Cover, Executive Summary |
| Kennzahlen als Tabelle: Brutto-/Nettomietrendite, DSCR, Beleihung, Cashflow | Objekt & Finanzierung, 3-Phasen-Vergleich |
| Warmmiete-Kette: Warmmiete − NK-Vorauszahlungen = Nettokaltmiete + Zusatzeinnahmen | Cashflow-Projektion über den Betrachtungszeitraum |
| Phasen: heute · Ende Zinsbindung · Anschluss | Equity-Build, Wasserfall, Bank-Cockpit, Stress-Test |
| Mieterliste mit Restnutzungsdauer des Gebäudes (Anlage 2, indikativ) | Seite „Wertpotenzial" vor der KI-Analyse |
| Seite „Wertpotenzial" mit Wertüberleitung, Kennzahlen je Stufe, Kaufpreis, Fußnote | Pilot-Analyse (sofern erstellt), Annahmen |
| Exit, Belastungsprobe, Annahmen | |

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140, Bielefeld (MFH)

| Feld | Wert |
|---|---|
| Kaufpreis | 545.000 € |
| Eigenkapital | 120.000 € |
| Darlehen | 472.415 € zu 4,00 % |
| Fassung | Bankfassung |

Was die Bankfassung zeigt (Stand Modul 19, aufgenommen 16.10.2026):

| Seite | Inhalt |
|---|---|
| 1 | Kaufpreis 545.000 € mit jeder Nebenkostenzeile, **Gesamtinvestition 592.415 €**, EK 120.000 €, Darlehen 472.415 € zu 4,00 % |
| 2 | Bruttomietrendite **7,23 %**, Nettomietrendite **5,36 %**, DSCR **1,67**, Beleihung **83,3 %**, Cashflow **677 €/Monat**, nach Steuern **6.234 €/Jahr** |
| Phasen | Cashflow nach Steuern 6.234 / 7.061 / 7.724 € |
| Exit | 2,0 % Wertsteigerung, Equity Multiple 5,3 |
| Mieterliste | „Restnutzungsdauer des Gebäudes (Anlage 2, indikativ) 35 Jahre (GND 80)" |
| Warmmiete | 40.067 € im Jahr — seit v2484 in Bankfassung, Investment-PDF und App dieselbe Zahl |
| Wertpotenzial | Wertüberleitung Bestand → Mieterhöhung → Zielbild; Tabelle, Kaufpreis und Fußnote bleiben zusammen |

**Warum die Warmmiete jetzt überall gleich ist:** Bis v2483 rechnete die Bankfassung mit den Umlagen der Mieter (41.147 €), das Investment-PDF
mit den umlagefähigen Kosten (39.756 €). Seit v2484 gilt eine Definition: Warmmiete = Nettokaltmiete + Nebenkostenvorauszahlungen der Mieter,
Stellplatz und Garage als Zusatzeinnahmen getrennt.

**Zweites Beispiel, Musterstr. 12, Leipzig (ETW, Geschichte 13):** DSCR **1,04**, Cashflow nach Steuern **−213 €/Jahr**, Erstattung 2025 **1.687 €**,
Bankbewertung 220.000 €, Marktpreisindikation 243.000 € (218.000–269.000) bei 189.000 € Kaufpreis — „das ist die Mappe, die ich der Bank gebe".

Belegt: Seiten 1–2, Phasen, Exit — Videoreihe.md (Modul 19); Haus-RND 35 J. und Warmmiete 40.067 € — Journal v2483–v2485 (Nachweis-Tabelle);
Seitenzahlen Bank 10 / Investment 12 — Journal v2530; Musterstr. — demo-geschichten.md Geschichte 13. Neu nach v2541: live gegenprüfen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Welche Fassung gebe ich der Bank?"** — Die Bankfassung: weißes Papier, Kennzahlen als Tabelle, jede Nebenkostenzeile, Mieterliste.
- **„Kann ich mein Logo draufsetzen?"** — Ja, unter Einstellungen → Kontakt & Logo; Kontaktdaten stehen im Fuß.
- **„Rechnet das PDF anders als die App?"** — Nein, dieselben Rechenkerne. Die Warmmiete ist seit v2484 überall dieselbe Zahl.
- **„Steht der Wert nach meinem Umbau drin?"** — Ja, auf der Seite „Wertpotenzial" — als Potenzialwert gekennzeichnet.
- **„Was ist mit dem Wasserzeichen?"** — Im Free-Plan „DealPilot Free", in der Testphase „DealPilot Testphase"; ab Starter ohne.

## 5 · Grenzen und Kennzeichnung

- Ein Investment Case, keine Finanzierungszusage und keine Verkehrswertermittlung. Wertpotenzial = **Potenzialwert, keine Verkehrswertermittlung**.
- Die Restnutzungsdauer in der Mieterliste ist **indikativ** (Anlage 2); fürs Finanzamt zählt ein Gutachten.
- Die Pilot-Analyse im PDF ist KI-gestützt und nur enthalten, wenn du sie einschließt.
- Das Investment-PDF hell/Obsidian braucht rund 45 Sekunden Rechenzeit (deshalb im Video nicht gezeigt).
- Ohne Freigabe Stufe 3 erscheinen keine Ertragswert-Zeilen; der Fuß sagt das.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Deal-Aktion, PDFs herunterladen | „Investment-PDF" | Am Ende des Boardings steht die Mappe für die Bank. |
| 2 | Fassungs-Rückfrage | „Bankfassung" | Drei Fassungen: Bankfassung auf weißem Papier, das Investment-PDF hell oder in Obsidian. |
| 3 | Seite 1 | — | Kaufpreis mit jeder Nebenkostenzeile, Gesamtinvestition, Eigenkapital, Darlehen. |
| 4 | Seite 2 Kennzahlen | blättern | Die Kennzahlen, auf die die Bank schaut: DSCR 1,67, Beleihung 83,3 %, Cashflow nach Steuern. |
| 5 | Mieterliste | blättern | Jede Wohnung mit Miete — und die Restnutzungsdauer des Gebäudes nach Anlage 2. |
| 6 | Seite Wertpotenzial | blättern | Was der Plan am Wert ändert: Bestand, Mieterhöhung, Zielbild — als Potenzialwert gekennzeichnet. |
| 7 | Belastungsprobe, Annahmen | blättern | Zum Schluss: Was passiert, wenn Zins steigt und Miete sinkt — und auf welchen Annahmen alles steht. |

### Sprechertext (Entwurf, ca. 90 Sekunden)

Am Ende des Boardings steht die Mappe, mit der du zur Bank gehst. Im Reiter Deal-Aktion erzeugst du das Investment-PDF.
DealPilot fragt nach der Fassung: die Bankfassung auf weißem Papier, oder das Investment-PDF hell oder in Obsidian für Partner und Investoren.
Seite eins der Bankfassung für die Westerfeldstraße: Kaufpreis fünfhundertfünfundvierzigtausend Euro, jede Nebenkostenzeile, Gesamtinvestition,
Eigenkapital und Darlehen.
Seite zwei: die Kennzahlen, auf die die Bank schaut. DSCR eins Komma sechs sieben, Beleihung dreiundachtzig Prozent, der Cashflow vor und nach Steuern.
Dann die Phasen bis zur Anschlussfinanzierung, die Mieterliste mit der Restnutzungsdauer des Gebäudes, und — wenn du eine Mieterhöhung oder einen Umbau
geplant hast — die Seite Wertpotenzial.
Zum Schluss die Belastungsprobe und alle Annahmen. Alles kommt aus denselben Rechenkernen wie in der App. Was du siehst, ist das, was die Bank bekommt.

## Querverweise

- [21 · Deal-Aktion](21-deal-aktion.md) — „Bereit für die Bank?", PDFs herunterladen, Track Record
- [18 · Tab Bewertung](18-tab-bewertung.md) — dieselben Kennzahlen und die Wertüberleitung
- [06 · Miete](06-miete.md) — Warmmiete, Nebenkostenvorauszahlungen, Zusatzeinnahmen
- [23 · Portfolio-Cockpit und Portfolio-Pilot](23-portfolio-cockpit-und-portfolio-pilot.md) — Bankexport über alle Objekte
- [13 · Werbungskosten und 15-%-Grenze](13-werbungskosten-und-15-prozent-grenze.md) — Finanzamt-PDF
- [26 · Einstellungen](26-einstellungen-standardwerte-investmentprofil.md) — Kontakt & Logo
