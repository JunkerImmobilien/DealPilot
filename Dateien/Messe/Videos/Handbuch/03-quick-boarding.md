# 03 · Quick Boarding (Quick-Check) — mit DealPilot-Marktbewertung und Abschlag auf Angebotspreise

> Stand 20.10.2026 (Staging bis v2544, Quick Boarding qc-v2485). Zahlen vor der Messe live gegenprüfen. Video: Überblick 1 / Modul 01 (`quickcheck-rundgang`), ältere Fassungen `quickcheck`, `quickcheck-tippen`; Übergang ins Objekt Modul 02 (`boarding-zum-objekt`) · Messe-Geschichte(n): 11 (Alexanderstr. 11, Einsteiger), 9 (Lindenhof 14, „Score sagt Nein") (design/Messe/demo-geschichten.md).

## 1 · Wozu

Das Quick Boarding ist dein Pre-Flight-Check für ein Inserat: In einer Minute weißt du, ob sich der zweite Blick lohnt. Du trägst Adresse, Fläche, Kaufpreis, Miete und Finanzierung ein — DealPilot zeigt den Score-Dial, die Kennzahlen, die in den Score eingehen, eine Handlungsempfehlung und einen Zielkaufpreis für die Verhandlung. Auf Wunsch holt die DealPilot-Marktbewertung Marktwert, Marktmiete und Lage dazu. Lohnt es sich, speicherst du das Ergebnis mit einem Klick als Objekt.

## 2 · Wo in der App

| Was | Wo |
|---|---|
| Öffnen | Seitenleiste → **Aktionen** → Anlegen → **Quick Boarding** (eigenes Fenster im Inhaltsbereich) |
| Quellen | Leiste **QUICKBOARDING PASS**: Kacheln **DealPilot** (Marktbewertung, Stufe 1 — Stufen 2 und 3 ausgegraut „im Quick-Check nicht verfügbar – im Tab Objekt"), **Exposé / Marktbericht**, **Sprache**, **ImmoMetrica** → **Abrufen**; danach **Neuer Vorgang** |
| Beleihung | Knöpfe **Beleihung (LTV)** 100 % … 80 % unter den Finanzierungsfeldern |
| Lageklasse | Feld Lageklasse A / B / C (Zielrenditen aus Einstellungen → Standardwerte → Lageklassen A · B · C) |
| Ergebnis | Score-Karte mit fünf Kacheln, Karte **Bewertung**, **Verhandlungs-Empfehlung**, Pro-Argumente / Achtung / Experten-Meinung, KI-Analyse |
| Übernahme | **Als Objekt speichern** → Fenster „Diese Daten werden übernommen" → **Speichern & übernehmen** |
| Teilen | im gespeicherten Objekt, Reiter Objekt oben in der Objektleiste: **Quick Boarding teilen** → „Quick Boarding Pass teilen", gültig 7 / 14 / 30 Tage, Link, QR-Code, WhatsApp (`js/quick-boarding-share.js`) |

## 3 · Schritt für Schritt — Beispiel: die Rundgang-Wohnung aus Überblick 1

Pflichtfelder (elf): Straße, PLZ, Ort, Wohnfläche, Kaufpreis, Nettokaltmiete gesamt / Monat, Hausgeld / Monat, Nicht-umlagefähig (% vom HG), Eigenkapital, Zinssatz, Tilgung. Die Hausnummer ist freiwillig.

| Feld | Wert |
|---|---|
| Adresse, Wohnfläche, Hausgeld | Beispieldaten des Drehbuchs — live zeigen |
| Kaufpreis | 139.000 € |
| Zins, Tilgung, nicht umlagefähig | aus den Standardwerten (eigener Wert gewinnt) |
| Quelle | Kachel DealPilot angehakt → Abrufen |
| Beleihung | erst 100 %, dann 80 % |
| Lageklasse | erst B-Lage, dann C-Lage |

Was die App zeigt (Überblick 1, gemessen 16.10.2026):

| Anzeige | Wert | Warum |
|---|---|---|
| Marktwert-Spanne | 144.000–261.000 € | Angebotsniveau vergleichbarer Objekte |
| Abschlag auf Angebotspreise | 5,8 % → rund **178.000 €** | Kaufpreise liegen unter Angebotspreisen; ohne örtliche Messung gilt der aktuelle Marktdurchschnitt |
| Marktmiete | 683 € im Monat | trägt DealPilot nach dem Abruf in die Grundmiete ein — mit Ist-Miete rechnen: danach wieder eintragen |
| Wertpuffer | 39.000 € | Marktwert nach Abschlag minus Kaufpreis — fließt in die Teilnote Potenzial |
| Score voll finanziert | **42 · Schwach** | Cashflow und LTV kosten Punkte |
| Score mit 20 % Eigenkapital | **59 · Solide** | weniger Darlehen, besserer Cashflow |
| Urteil B-Lage | „Kauf möglich" | Bruttomietrendite gegen die Zielrendite der B-Lage (vorbelegt 5,0 %) |
| Urteil C-Lage | „Nicht kaufen", Zielpreis 117.086 € | C-Lage verlangt mehr Rendite (vorbelegt 7,0 %) — daraus der Zielkaufpreis |

**Beleihungsknöpfe seit qc-v2450:** Darlehen = Quote × (Kaufpreis + Nebenkosten), Eigenkapital = Rest. 100 % heißt 0 € Eigenkapital. Gemessen ohne PLZ: Nebenkosten 13,77 %, Gesamtinvestition 204.786 € bei 180.000 € Kaufpreis → 80 % ergibt EK 40.957 €. Darunter steht „Darlehen = 80 % von Kaufpreis + Nebenkosten (13,77 %)". Die 13,77 % = 6,5 GrESt + 1,7 Notar + 0,5 Grundbuch + 3,57 Makler + 1,5 Sonstige (aus den Einstellungen).

**Abschlag — drei Herkünfte (v2490):** „aktueller Marktdurchschnitt" 5,8 % · „örtlich gemessen" 15,9 % (bisher nur Bielefeld MFH, z. B. Westerfeldstr. 140) · „dein Wert aus den Einstellungen". Die Karte nennt die Herkunft: „inkl. 15,9 % Abschlag auf Angebotspreise (örtlich gemessen)".

**Score-Karte (seit qc-v2420a):** nur, was in den Score eingeht — Cashflow/Mo, Nettomietrendite, LTV, DSCR, Wertpuffer (ohne Abruf „—").

Belegt: Ü1-Messwerte Videoreihe.md „Überblick 1 · Quick Boarding im Reihenrahmen (v2370)"; Kaufpreis 139.000 € BACKLOG.md N75; Beleihung Journal qc-v2450 (Nachweis); Abschlag Journal v2490; Karte Journal qc-v2420; Lageklassen-Vorbelegung `help.js` „Lageklasse und Zielrendite". **Achtung:** Die Ü1-Aufnahme liegt vor qc-v2420a/qc-v2450 (Beleihungsbasis, Zielpreise auf 1.000 € abgerundet) — Score und Zielpreis können sich verschoben haben, live zeigen.

## 3b · Kurzbeispiele für den Stand

- **Alexanderstr. 11, Bielefeld (ETW, Geschichte 11):** 65 m², 129.000 € → Ampel und Urteil in einer Minute; der Marktbericht Stufe 1 liegt bei 158.000 € (145.000–166.000), rund 29.000 € über dem Kaufpreis.
- **Lindenhof 14, Castrop-Rauxel (MFH, Geschichte 9):** dieselbe Adresse in einer Minute; im Objekt Score 23 · KRITISCH, DSCR 0,74, Marktpreisindikation 1.535.000 € gegen 2,45 Mio. € Angebot.

## 4 · Was man daraus liest — Fragen am Stand

**Wer entscheidet die Lageklasse?** Du. Sie ist deine Strategieentscheidung; DealPilot schlägt keine vor, rechnet aber, auf welchen Preis du verhandeln müsstest.

**Woher kommt der Zielkaufpreis?** Der niedrigste aus drei Preisen: deine Zielrendite erreicht, Cashflow etwa null, und — falls abgerufen — Marktwert abzüglich Angebotsabschlag.

**Warum ein Abschlag?** Die Marktwert-Spanne beruht auf Angebotspreisen; gezahlt wird im Schnitt weniger. Wo DealPilot örtlich gemessen hat, gilt der örtliche Satz, sonst der aktuelle Marktdurchschnitt, oder dein eigener Wert.

**Ist das derselbe Score wie im Objekt?** Ja, derselbe Score-Kern (DealPilot Score). Der Investor Deal Score mit Lage und 24 Kennzahlen kommt erst im Objekt dazu.

**Was passiert beim Speichern?** Ein neues Objekt entsteht; ein geöffnetes wird nie überschrieben. Mit kommen alle Eingaben, bis zu sechs Fotos und die angehakten Marktdaten — der Marktwert als Verkehrswert, wahlweise unten, Ø oder oben in der Spanne.

## 5 · Grenzen und Kennzeichnung

- Die DealPilot-Marktbewertung ist eine **Marktpreisindikation aus Angebotspreisen**, keine Verkehrswertermittlung nach § 194 BauGB. Sie verbraucht 1 Bewertung (MPI) aus dem Kontingent.
- Quelle der Angebotsdaten nach außen nie nennen — „aktueller Marktdurchschnitt".
- Im Quick Boarding nur Stufe 1; Marktbericht und Wertermittlung im Reiter Objekt.
- Die KI-Analyse startet von selbst, sobald alle Pflichtfelder gefüllt sind; fällt sie aus, bleibt die „Lokale Heuristik" stehen.
- Ein geteilter Pass läuft ab (7, 14 oder 30 Tage) und lässt sich im Cockpit unter „Geteilte Objekte" verlängern oder beenden.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Aktionen → Quick Boarding | Quick Boarding | Pre-Flight-Check für ein Inserat: elf Felder, eine Minute, ein Urteil. |
| 2 | Leiste QUICKBOARDING PASS | DealPilot anhaken → Abrufen | Die DealPilot-Marktbewertung holt Marktwert, Marktmiete und Lage. |
| 3 | Marktwert-Karte | — | Spanne 144.000 bis 261.000 € — nach 5,8 % Abschlag auf Angebotspreise rund 178.000 €. |
| 4 | Beleihungsknöpfe | 100 % → 80 % | Beleihung auf Kaufpreis plus Nebenkosten. 100 % heißt: kein Eigenkapital. |
| 5 | Score-Dial | — | Voll finanziert 42 · Schwach, mit 20 % Eigenkapital 59 · Solide. |
| 6 | Lageklasse | B → C | B-Lage: Kauf möglich. C-Lage verlangt mehr Rendite — daraus der Zielkaufpreis. |
| 7 | Als Objekt speichern | Speichern & übernehmen | Lohnt es sich? Ein Klick, und aus dem Pass wird ein Objekt. |

### Sprechertext (Entwurf, ca. 110 Sekunden)

Ein Inserat sieht gut aus — aber rechnet es sich? Dafür gibt es das Quick Boarding, den Pre-Flight-Check von DealPilot. Du findest es unter Aktionen.

Elf Felder reichen: Adresse, Wohnfläche, Kaufpreis, Miete, Hausgeld und deine Finanzierung. Zins und Tilgung kommen aus deinen Standardwerten.

Mit einem Haken bei DealPilot holst du die Marktbewertung dazu. In unserem Beispiel liegt die Spanne zwischen hundertvierundvierzig- und zweihunderteinundsechzigtausend Euro. Weil diese Werte auf Angebotspreisen beruhen, zieht DealPilot einen Abschlag ab — hier den aktuellen Marktdurchschnitt von fünf Komma acht Prozent. Übrig bleiben rund hundertachtundsiebzigtausend Euro. Bei einem Kaufpreis von hundertneununddreißigtausend Euro ist das ein Wertpuffer von neununddreißigtausend Euro.

Jetzt die Finanzierung. Die Beleihungsknöpfe beziehen sich auf Kaufpreis plus Nebenkosten. Voll finanziert zeigt der Score-Dial zweiundvierzig — schwach. Mit zwanzig Prozent Eigenkapital steigt er auf neunundfünfzig — solide.

Und die Lage? Die Lageklasse wählst du selbst. In einer B-Lage heißt das Urteil: Kauf möglich. Eine C-Lage verlangt mehr Rendite — DealPilot nennt dir den Preis, auf den du verhandeln müsstest.

Lohnt sich der zweite Blick, speicherst du alles als Objekt. Eingaben, Fotos und Marktdaten wandern mit. Erst rechnen, dann boarden.

## Querverweise

- [02 · Neues Objekt anlegen](02-neues-objekt-anlegen.md)
- [04 · Reiter Objekt](04-reiter-objekt.md) — Stufen 2 und 3, Abschlag im Objekt
- [15 · Deal Score und Investor Deal Score](15-deal-score-und-investor-deal-score.md)
- [16 · Pilot-Analyse](16-pilot-analyse.md)
- [23 · Portfolio-Cockpit](23-portfolio-cockpit-und-portfolio-pilot.md) — Geteilte Objekte
- [26 · Einstellungen, Standardwerte, Investmentprofil](26-einstellungen-standardwerte-investmentprofil.md) — Lageklassen, Angebotsabschlag
