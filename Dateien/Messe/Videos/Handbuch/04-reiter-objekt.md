# 04 · Reiter Objekt — Eingabetiefe, Verkehrswert-Parameter, Bodenrichtwert, WGFZ, Modernisierungspunkte

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen"). Video: Modul 04 (`reihe-stufen`), Modul 16 (`reihe-stufe3`), Modul 24 (`reihe-brw-unterlagen`), Überblick 2 Kapitel 1–2 (`reihe-ueberblick2`) · Messe-Geschichte(n): 8 (Westerfeldstr. 140, „Ein Haus, alle Hebel"), 4 (RND-Gutachten Westerfeld) (design/Messe/demo-geschichten.md).

## 1 · Wozu

Der Reiter Objekt ist das Logbuch deines Objekts: Adresse, Objektart, Fläche, Baujahr, Zustand und Lage. Hier wählst du, wie tief du einsteigst — Stufe 1 für die schnelle Marktpreisindikation, Stufe 2 für den Marktbericht, Stufe 3 für die Wertermittlung nach ImmoWertV. Eine Leiste zeigt dir schon vor dem Abruf, welche amtlichen Werte für dein Objekt vorliegen: Bodenrichtwert, Liegenschaftszins, Sachwertfaktor, Restnutzungsdauer — jeder mit seiner Herkunft.

## 2 · Wo in der App

| Was | Wo |
|---|---|
| Eingabetiefe | Reiter **Objekt**, oben: Pillen **1 · 2 · 3** („Einfach · Mittel · Ausgiebig") |
| Abruf | Box **Marktbericht abrufen** — Knopf „abrufen" oder „was fehlt"; Zeile „Für Stufe … fehlt noch" springt zu den Feldern; je Stufe „N frei" |
| Verkehrswert-Leiste | Karte **Parameter der Verkehrswertermittlung** · „nach ImmoWertV, nur für Stufe 3": Zeilen Bodenrichtwert, **Liegenschaftszins** (mit Stufen-Pille A–E/N), **Sachwertfaktor**, **GND / RND**, **Modernisierungspunkte „x von 20"** |
| Punkte-Quelle beim MFH | in der Zeile Modernisierungspunkte: „Punkte aus: **den Einheiten (Konfigurator)** · **den acht Feldern**" (`js/objekt-reiter.js:331ff`, v2540b) |
| Bodenrichtwert | Feld **Bodenrichtwert (€/m²)** mit **Bodenrichtwert abrufen** (Direktabruf BORIS, gratis), **BORIS-Portal**, **Bodenrichtwert schätzen**; daneben Stichtag Bodenrichtwert, Grundstücksanteil, Bodenwert |
| WGFZ | Feld `wgfz_objekt` (WGFZ des Objekts) — wirkt nur, wenn die BORIS-Zone eine GFZ führt |
| Wertanker | Karte **Wertanker**: Bankbewertung, **Verkehrswert** mit Auswahl aus dem Berichtsverlauf → „als Verkehrswert übernehmen" |
| Lage | Lage-Felder (Mikro, Makro, Nachfrage = Vermarktungsdauer, Mietausfall-Risiko, Bevölkerung, Wertsteigerung), **Lage analysieren**; jede Angabe trägt ihre Herkunft (gemessen · KI · eigen, v2515) |
| Mieterhöhung und Zielbild | Karte **Mieterhöhung und Zielbild (optional)** — bei ETW/EFH/ZFH hier, beim MFH Summe aus den Wohnungen |
| MFH | unter der Wohnfläche **Einheiten erfassen** (siehe [07](07-mfh-konfigurator.md)) |
| Ämter | Block **Anfragen** → **Unterlagen beim Amt anfordern** (siehe [25](25-unterlagen-beim-amt.md)) |

**Pflichtfelder je Stufe** (`help.js`): Stufe 1 Adresse, Objektart, Wohnfläche, Baujahr · Stufe 2 dazu Kaufpreis, Miete, Zustand, Energie, Standardstufe · Stufe 3 dazu Nutzungsart, Grundstücksfläche, Bodenrichtwert, Bruttogrundfläche; bei ETW Miteigentumsanteil, bei EFH/ZFH/DHH/RH Hausform (NHK), Geschosse, Dachausbildung. Felder mit dem Schild „optional" verfeinern nur.

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140, Bielefeld (MFH, Bj 1967, Kürzel DEMO-BI1, 6 WE)

| Feld | Wert |
|---|---|
| Eingabetiefe | Pille 3 |
| Objektart | Mehrfamilienhaus |
| Baujahr | 1967 |
| Grundstücksfläche | 1.570 m² |
| Bodenrichtwert | **Bodenrichtwert abrufen** → 450 €/m² |
| Modernisierung | Punkte aus **den Einheiten** (`mod_quelle` einheiten, seit 20.10. gespeichert) |
| WGFZ des Objekts | leer (nur mit GFZ der Zone und Geschossfläche aus der Bauakte) |

Was die App zeigt:

| Zeile | Wert | Warum |
|---|---|---|
| Bodenrichtwert | 450 €/m², Stichtag 01.01.2026, Zone 5400 | BORIS Open Data, echter Abruf |
| Bodenwert | 1.570 × 450 = 706.500 € — mehr als der Kaufpreis | deshalb nur 14,6 % Gebäude in der BMF-Aufteilung (siehe [12](12-bmf-kaufpreisaufteilung.md)) |
| Liegenschaftszins | 2,5 % · Stufe **A** (MFH, Gutachterausschuss Stadt Bielefeld) | amtlich für Gebiet und Objektart |
| Sachwertfaktor | im Register kein Satz für Bielefeld MFH → Sachwert „vorläufig", Weg zur Landestabelle | kein Nachbarkreis, kein Landesmittel |
| Modernisierungspunkte / RND | Punkte aus **den Einheiten** (6 WE): **3 Punkte** (flächengewichtet 3,4) → RND **25,7 J.** · aus den acht Feldern: Zahl live zeigen | Anlage 2 bewertet das Gebäude: eine Punktzahl, eine Restnutzungsdauer; beim MFH wählst du die Quelle |

Danach Stufe 3 abrufen: Bericht 327 (20.10.2026, 6 WE) — Ertragswert **740.000 €**, Marktpreisindikation **820.000 €**, Sachwert **560.519 €**, Liegenschaftszins 2,5 % Stufe A, RND 25,7 J. Im Feld Verkehrswert erscheinen „Ertragswert · Datum · Betrag", „Sachwert · …", „Marktwert · …" — welche Zahl als Verkehrswert gilt, entscheidest du. Die Karte nennt beim Marktwert den Abschlag, z. B. „inkl. 15,9 % Abschlag auf Angebotspreise (örtlich gemessen)".

**Zweites Beispiel ETW (Karte Mieterhöhung und Zielbild):** Hermannstr. 9, Hüllhorst, mit Soll und Zielbild → Ertragswert Bestand / Mieterhöhung / Zielbild 262 / 313 / 355 T€ (gemessen v2460, Stufe 3 vorhanden).

**Stufe N (Kupferpille):** Wo der Ausschuss keinen Zins führt (fast nur Baden-Württemberg), steht „abgeleitet, nicht amtlich — genauer: Satz des Ausschusses eintragen" mit Link.

Belegt: BRW Videoreihe.md Modul 24 (v2300er-Stand); Grundstück/Bodenwert/14,6 % demo-geschichten 4; LZS 2,5 % A Journal v2431/v2432 und v2401 (Testobjekt W); Sachwertfaktor Bielefeld Videoreihe.md Modul 16 „fachlich offen"; 3 Punkte / RND 25,7 J. demo-geschichten Korrektur zu Geschichte 4 und D (Befüllung 20.10., 6 WE); Bericht 327 Messung nach der Befüllung 20.10.2026 (ersetzt Bericht 308 mit 4 WE und Bericht 325 ohne Stellplätze); Abschlag 15,9 % Journal v2490; Hüllhorst Journal v2460–v2466a; Stufe N Journal v2400–v2403. Die Punkte aus den acht Feldern sind nach der Befüllung nicht neu gemessen — live zeigen.

## 4 · Was man daraus liest — Fragen am Stand

**Brauche ich immer Stufe 3?** Nein. Stufe 1 reicht zum Sortieren, Stufe 2 fürs Gespräch mit Verkäufer und Makler, Stufe 3, wenn Bank oder Steuer belastbare Werte brauchen.

**Woher kommt der Liegenschaftszins?** Vom zuständigen Gutachterausschuss, wenn er einen führt (Stufe A–C). Sonst nennt DealPilot die nächstbeste Ebene — DealPilot-Formel (N) oder gesetzlicher Auffangwert (D) — und den Weg zum Ausschuss.

**Warum steht beim Sachwert „vorläufig"?** Ohne amtlichen Sachwertfaktor rechnet DealPilot mit Faktor 1,0 und sagt das. Ein Faktor aus dem Nachbarkreis wird nie eingesetzt.

**Was bringen die Modernisierungspunkte?** Sie tragen die Restnutzungsdauer nach Anlage 2 ImmoWertV — und damit Ertrags- und Sachwert. Ein Klick auf die Zeile springt zum Feld.

**Was ist die WGFZ?** Die wertrelevante Geschossflächenzahl. Führt die Bodenrichtwertzone eine GFZ und trägst du die WGFZ deines Objekts ein, rechnet DealPilot den Bodenwert mit dem amtlichen Umrechnungskoeffizienten um — nie hochgerechnet über die Tabelle hinaus.

## 5 · Grenzen und Kennzeichnung

- Stufe 1 und 2 sind **Marktpreisindikationen aus Angebotspreisen**, kein Gutachten nach § 194 BauGB. Stufe 3 ist eine Wertermittlung nach ImmoWertV mit Rechenweg und Quellennachweis, aber kein Verkehrswertgutachten eines Sachverständigen.
- „Kein Verfahren rechnet halb": fehlt ein Pflichtfeld, heißt der Knopf „was fehlt".
- Herkunftsstufen: A amtlich · B amtlich, regional · C abgeleitet · **N DealPilot-Formel** (nie amtlich, immer so beschriftet) · D gesetzlicher Auffangwert § 256 BewG · E eigene Angabe.
- Eine Bodenrichtwert-Schätzung bitte auf BORIS prüfen.
- ETW ohne Miteigentumsanteil: kein Bodenwert.
- Lage-Felder aus der KI sind als „KI-Einschätzung, keine Messung" gekennzeichnet.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Objekt, Stufen-Pillen | Pille 3 | Drei Tiefen: Indikation, Marktbericht, Wertermittlung. Jede Stufe nennt nur ihre Pflichtfelder. |
| 2 | „Für Stufe 3 fehlt noch" | Eintrag anklicken | Ein Klick springt zum fehlenden Feld. Der Bericht rechnet nie halb. |
| 3 | Bodenrichtwert abrufen | Knopf | 450 €/m², Stichtag 01.01.2026 — direkt aus BORIS, ohne Kontingent. |
| 4 | Leiste Parameter der Verkehrswertermittlung | — | Liegenschaftszins 2,5 %, Stufe A: amtlich vom Gutachterausschuss Bielefeld. |
| 5 | Zeile Modernisierungspunkte | „den acht Feldern" ↔ „den Einheiten" | Beim Mehrfamilienhaus wählst du, woher die Punkte kommen. Eine Punktzahl, eine Restnutzungsdauer. |
| 6 | Box Marktbericht abrufen | abrufen (Mitschnitt) | Stufe 3: Ertragswert, Sachwert, Bodenwert — mit Rechenweg und Quellennachweis. |
| 7 | Wertanker, Verkehrswert-Auswahl | als Verkehrswert übernehmen | Welche Zahl als Verkehrswert gilt, entscheidest du. Die Software trifft diese Wahl nicht. |

### Sprechertext (Entwurf, ca. 110 Sekunden)

Der Reiter Objekt ist das Logbuch deines Objekts. Ganz oben wählst du die Eingabetiefe. Stufe eins braucht nur Adresse, Objektart, Fläche und Baujahr und liefert eine Marktpreisindikation. Stufe zwei ergänzt Kaufpreis, Miete und Zustand und ergibt den Marktbericht. Stufe drei ist die Wertermittlung nach ImmoWertV.

Fehlt etwas, sagt DealPilot genau, was. Ein Klick auf den Eintrag, und du stehst im richtigen Feld.

Für die Westerfeldstraße in Bielefeld holen wir den Bodenrichtwert direkt aus BORIS: vierhundertfünfzig Euro je Quadratmeter, Stichtag erster Januar zweitausendsechsundzwanzig. Darunter liegt die Leiste mit den Parametern der Verkehrswertermittlung. Der Liegenschaftszins beträgt zwei Komma fünf Prozent — Stufe A, amtlich vom Gutachterausschuss der Stadt Bielefeld. Für den Sachwertfaktor führt das Register hier keinen Satz. Deshalb bleibt der Sachwert vorläufig, und DealPilot zeigt dir den Weg zur Quelle.

Die Modernisierungspunkte tragen die Restnutzungsdauer. Beim Mehrfamilienhaus entscheidest du, ob sie aus den einzelnen Wohnungen oder aus den acht Feldern kommen.

Dann rufst du Stufe drei ab. Ertragswert und Sachwert erscheinen im Verlauf unter dem Verkehrswert — und welchen davon du übernimmst, ist deine Entscheidung. Kein Wert ohne Herkunft.

## Querverweise

- [01 · Konto und Kontingent](01-konto-anmeldung-testphase-kontingent.md)
- [07 · MFH-Konfigurator](07-mfh-konfigurator.md)
- [11 · Restnutzungsdauer-Rechner und Gutachten](11-restnutzungsdauer-rechner-und-gutachten.md)
- [12 · BMF-Kaufpreisaufteilung](12-bmf-kaufpreisaufteilung.md)
- [18 · Tab Bewertung](18-tab-bewertung.md) — Wertpotenzial
- [19 · Marktbericht](19-marktbericht.md)
- [25 · Unterlagen beim Amt](25-unterlagen-beim-amt.md)
