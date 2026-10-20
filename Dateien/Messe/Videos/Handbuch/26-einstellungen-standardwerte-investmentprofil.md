# 26 · Einstellungen, Standardwerte und Investmentprofil

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: noch kein eigenes Video (Standardwerte kommen in Modul 06 und 08 vor: `reihe-investition`, `reihe-finanzierung`) ·
> Messe-Geschichte: — (Lageklassen in Ü1/Quick Boarding; Angebotsabschlag in Geschichte 8)

## 1 · Wozu

Jeder Pilot hat seine Checkliste. In den Einstellungen legst du **deine** Annahmen fest — Tilgung, Zinsbindung, Nebenkosten deines Bundeslands, Bewirtschaftung je Objektart, deine Mindest-Schwellen für DSCR, Cashflow und Beleihung, die Zielrendite je Lageklasse und wie stark du Angebotspreise abschlägst. DealPilot füllt damit jedes neue Objekt vor. Am Objekt überschreibst du jederzeit — deine Eingabe gewinnt immer.

## 2 · Wo in der App

**Seitenleiste → Aktionen → System → Einstellungen.** Die Reiter (laut `help.js` „Die Reiter im Überblick"):

| Reiter | Inhalt |
|---|---|
| Account & Sicherheit | Login, Passwort, Zwei-Faktor, Account löschen, **Telegram-Bot**, API-Keys externer Anbieter (z. B. ImmoMetrica) |
| Kontakt & Logo | Adresse, Telefon, E-Mail, Webseite für PDF-Fuß und Track Record; „Logo hochladen" (PNG, empfohlen 300 × 100 px) |
| Co-Pilot (KI) | Detailgrad (kurz/mittel/ausführlich), Tonalität (sachlich/beratend/kritisch), Fokus, eigene Anweisungen, **Eigenes Wissen für alle Piloten**, Standard-Analyseparameter |
| Deal Score | Fünf Regler des DealPilot Score (Standard **30 / 25 / 15 / 15 / 15**, Summe 100 %); Investor Deal Score mit Bewertungsprofil (Ausgewogen, Konservativ, Optimistisch, Lage-Fokus, Cashflow-Fokus, Sicherheit) und Grenzwerten „Wert:Punkte" |
| Standardwerte | Finanzierung, Bewirtschaftung, **Persönliche Mindest-Schwellen** (Mindest-DSCR, Mindest-Cashflow / Monat, Maximaler LTV), Steuer, Standort & Nebenkosten, **Lageklassen A · B · C**, Bewirtschaftung je Objektart, Karte **Marktbewertung → Angebotsabschlag** |
| Darstellung | Seitenaufteilung, Objektkarten, Kartenstil, Pilot-Ort, Marktbericht-Design hell/dunkel, **Tooltip-Hilfe** (Aus · Profi · Anfänger) — ändert keine Zahl |
| Datenraum | geteilte Objekte und Portfolio-Pässe (Quick-Boarding-Pässe: verlängern, beenden) |
| Mandanten | Halter (Privat/GmbH/UG), Steuerregime, Steuerzeiträume → Handbuch 29 |
| Plan | Abo, **Dein Kontingent** (MPI · MPI+ · WEV), Bewertungspakete, Abrechnung → Handbuch 01 |
| Rechtliches, Hilfe | |

Unten: „Auto-Save aktiv · Änderungen werden direkt übernommen"; **Profil speichern**, **Auf Defaults zurücksetzen**.

## 3 · Schritt für Schritt — Beispiel Angebotsabschlag und Lageklasse

| Schritt | Feld | Wert | Was die App daraufhin zeigt |
|---|---|---|---|
| 1 | Standardwerte → Marktbewertung → **Angebotsabschlag** | leer | Standard: der Bericht wählt *örtlich gemessen* vor *aktueller Marktdurchschnitt* **5,8 %**. Westerfeldstr. 140 (Bielefeld MFH) bekommt **15,9 %** „örtlich gemessen" |
| 2 | Angebotsabschlag | **7** | Karte zeigt „inkl. 7 % Abschlag auf Angebotspreise (dein Wert aus den Einstellungen)" — Quick Boarding und Reiter Objekt gleich |
| 3 | Set **„Vorsichtig"** wählen | — | Angebotsabschlag **9 %** |
| 4 | Lageklassen A · B · C | 3,5 / 5,0 / 7,0 % (vorbelegt) | Zielrendite (brutto) je Klasse; daraus rechnet das Quick Boarding den Zielkaufpreis |
| 5 | „Standard für neue Quick-Checks" | B | Klasse steht vorausgewählt: „Vorgabe aus deinem Profil · überschreibbar" |
| 6 | Mindest-Schwellen | z. B. Mindest-DSCR 1,2 | farbige Marker an den Kennzahlen im Objekt |

Warum der Abschlag? Die DealPilot-Marktbewertung beruht auf **Angebotspreisen**; gekauft wird im Schnitt darunter. Wo DealPilot den Abstand örtlich gemessen hat, gilt der örtliche Satz — heute für genau einen Satz im Register (Bielefeld MFH: 1 − 1.820 / 2.164 = 15,9 %).

**Belegt:** Reiter aus `help.js`; Angebotsabschlag, Reihenfolge eigener > örtlich > 5,8 %, 15,9 % Bielefeld, 7 % eigene Angabe, Set „Vorsichtig" 9 % aus Journal v2490 und v2540; Lageklassen und Score-Gewichte aus `help.js`. Marker-Darstellung live zeigen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Muss ich das alles einstellen?"** — Nein. Die Vorbelegung ist ausgewogen. Wer mag, stellt seine eigene Strategie ein — dann rechnet DealPilot mit deiner Brille.
- **„Warum ist mein Profil am anderen Rechner weg?"** — Siehe Grenzen: das Investmentprofil liegt im Browser.
- **„Kann ich den Score anders gewichten?"** — Ja, Einstellungen → Deal Score. Summe muss 100 % sein, „↺ Standard wiederherstellen" setzt 30/25/15/15/15.

## 5 · Grenzen und Kennzeichnung

- **Wichtig fürs Messe-Team:** Das **Investmentprofil** (Standardwerte für neue Objekte, auch der Angebotsabschlag) wird im **Browser** gespeichert (`localStorage` `dp_investment_profile`), nicht auf dem Server. Auf einem fremden Messerechner oder nach dem Löschen der Browserdaten stehen wieder die Vorgaben. Vor der Messe auf jedem Vorführgerät prüfen.
- Lageklasse ist **deine** Strategieentscheidung — DealPilot schlägt keine vor.
- Der Fortschreibungsfaktor der Bewirtschaftung (1,60 für Stichtage ab 01.01.2026) wird jährlich zum 1. Januar angepasst.
- Quellen der Marktdurchschnitte stehen nur intern; nach außen heißt es „aktueller Marktdurchschnitt".

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Aktionen → Einstellungen | Reiter Standardwerte | Deine Checkliste vor dem Start: Annahmen, die jedes neue Objekt vorbelegen. |
| 2 | Karte Finanzierung, Nebenkosten | — | Tilgung, Zinsbindung, Grunderwerbsteuer deines Bundeslands — einmal einstellen, überall vorbelegt. |
| 3 | Persönliche Mindest-Schwellen | Mindest-DSCR | Deine Grenzen als Marker an den Kennzahlen. |
| 4 | Lageklassen A · B · C | B wählen | Zielrendite je Lageklasse — daraus rechnet das Quick Boarding deinen Zielkaufpreis. |
| 5 | Marktbewertung → Angebotsabschlag | 7 eintragen | Angebotspreise sind keine Kaufpreise. Dein Abschlag — oder der gemessene Marktdurchschnitt. |
| 6 | Reiter Deal Score | Regler | Gewichte nach deiner Strategie, Summe 100 Prozent. |

### Sprechertext (Entwurf, ca. 75 Sekunden)

Bevor du startest, stellst du dein Cockpit ein. In den Einstellungen unter Standardwerte legst du deine Annahmen fest: Tilgung, Zinsbindung, die Nebenkosten deines Bundeslands, die Bewirtschaftung je Objektart. Jedes neue Objekt startet mit diesen Werten — überschreiben kannst du sie am Objekt jederzeit.

Deine persönlichen Grenzen — Mindest-DSCR, Mindest-Cashflow, maximale Beleihung — erscheinen als Marker an den Kennzahlen. Und je Lageklasse A, B und C hinterlegst du deine Zielrendite. Daraus rechnet das Quick Boarding, auf welchen Preis du verhandeln musst.

Ein wichtiger Punkt: Marktbewertungen beruhen auf Angebotspreisen. Gekauft wird darunter. DealPilot zieht deshalb einen Abschlag ab — den örtlich gemessenen, sonst den aktuellen Marktdurchschnitt. Oder deinen eigenen.

Und wer seine Strategie anders gewichtet, stellt im Reiter Deal Score die Regler um.

## Querverweise

- Handbuch 01 (Plan, Kontingent), 03 (Quick Boarding, Lageklasse, Abschlag), 15 (Deal Score), 09 (Bewirtschaftung je Objektart), 24 (Telegram-Bot), 29 (Mandanten), 28 (Tooltip-Hilfe, Pilot-Ort)
- Videoreihe.md Module 06, 08
