# DealPilot · Funktionshandbuch

> Stand 20.10.2026 (Staging bis v2544). Auftrag Marcel vom 20.10.2026: *„Bitte erstelle für alle
> Funktionen und Abläufe auch Beschreibungen, zum Beispiel für die Videos. Ausführliche Beispiele
> mit Angaben etc."*

Das Handbuch hat zwei Leser:

1. **Messe und Vertrieb** — Marcel und das Team am Stand: was eine Funktion tut, wo man klickt, ein
   durchgerechnetes Beispiel an einem Demo-Objekt und die Fragen, die Besucher stellen.
2. **Der Video-Strang** — je Datei ein Szenenvorschlag mit Erklärkarten (höchstens 25 Wörter) und ein
   Sprechertext-Entwurf (60–120 Sekunden) als Vorlage für Drehbücher in `frontend/js/messe-drehbuch.js`.

## Aufbau jeder Datei

| Abschnitt | Inhalt |
|---|---|
| 1 · Wozu | ein Absatz in Kundensprache |
| 2 · Wo in der App | Reiter, Menü, Knopf — aus dem Code gemessen |
| 3 · Schritt für Schritt | Beispiel an einem Demo-Objekt: Eingaben (Feld → Wert), was die App zeigt, warum. Am Ende **„Belegt:"** mit der Quelle jeder Zahl |
| 4 · Fragen am Stand | typische Besucherfragen mit Antwort |
| 5 · Grenzen und Kennzeichnung | was die Funktion nicht ist und wie es im Produkt steht |
| 6 · Für das Video | Szenen (Bild · Klick · Erklärkarte) und Sprechertext |

**Zahlen:** Jede Zahl stammt aus dem Code, dem Journal (`claude/projektanweisung-hauptapp.md`),
`design/Messe/demo-geschichten.md`, `Dateien/Messe/Videos/Videoreihe.md` oder einem echten Lauf. Fehlt ein
Beleg, steht dort **„Zahl live zeigen"** — die Eingaben stehen trotzdem vollständig da. Die Zahlen
verschieben sich mit jeder Version und jedem Speicherstand — Stand siehe unten. Die Eintragslisten B.1/C der
Demo-Geschichten sind seit dem 20.10.2026 eingetragen (Abschnitt D); was dort weiter offen steht, ist im Objekt nicht
gespeichert und darf nicht als App-Ergebnis gezeigt werden.

## Stand der Zahlen: 20.10.2026 nach Befüllung

Am 20.10.2026 wurden die Demo-Objekte auf Staging befüllt und korrigiert (`design/Messe/demo-geschichten.md`, Abschnitt D
und die nachgezogenen Geschichten 2, 3, 4, 8–15). Die Dateien 02–25 sind danach nachgezogen; jede geänderte Zahl nennt
ihren Beleg in der „Belegt:"-Zeile. Gemessen am selben Tag über die Objektliste (`/objects`: `dealpilot_score`,
`ds2_score_persist`, `cf_ns`, `dscr`, `ltv`) und für den Steuerverlauf über `DpSteuerVerlauf.auswerten(DpSteuerVerlauf.reihe())`
in einem eigenen Tab mit gesperrten Schreibwegen (nichts gespeichert).

- **Kürzel:** Westerfeldstr. 140 = `DEMO-BI1` (vorher `DEMO-LE1`), Am Markt 18 = `DEMO-KK2`, Musterstr. 12 = `DEMO-LE3`,
  Alexanderstr. 11 = `DEMO-BI4`.
- **Westerfeldstr. 140:** 6 Wohnungen laut Gutachten (4 × 70 m² + 2 × 55 m², Ist 3.195 €/Monat), 4 Garagen à 30 €,
  Punkte aus den Wohnungen (3), Zielbild fertig 2030. Bericht 327 (Stufe 3): Ertragswert 740.000 €, Marktpreisindikation
  820.000 €, Sachwert 560.519 €, LZS 2,5 % Stufe A, RND 25,7 J. Abruf „Marktpreise" 6: Ertragswert 745/815/915 T€,
  Marktpreisindikation 820/820/895 T€, ETW 2.604 €/m². Score 78, DSCR 1,67, Cashflow n. St. 8.119 €.
- **Score / Cashflow n. St. / DSCR:** Bismarckstr. 33 / −9.627 € / 0,97 · Ravensberger 76 / 10.739 € / 1,37 · Gohliser
  79 / 10.826 € / 1,34 · Parkstr. 28 / 873 € / 1,23 · Musterstr. 62 / −275 € / 1,04 · Am Markt 18 65 / 1.848 € / 1,78 ·
  Alexanderstr. 70 / 905 € / 1,60 · Lindenhof 20 / −13.431 € / 0,74 · Hauptstr. 62 / 6.633 € / 1,17.
- **Am Markt 18 und Alexanderstr. 11** laufen als Bestand (Kauf 06.05.2024 bzw. 14.08.2024), AfA 3,85 % bzw. 3,03 % aus
  den Gutachten.
- **Steuerverlauf Bismarckstr. 27** (mit den neuen Werbungskosten): steuerlich positiv ab 2027 nach vier Verlustjahren,
  Erstattungen bis dahin 30.922 €, Steuern ab dem Wendepunkt −50.327 € (2027–2042). Der frühere Messwert 24.807 € /
  −51.739 € galt vor der Änderung der Werbungskosten.

**Weiter „Zahl live zeigen":** alles, was nach der Befüllung nicht neu gemessen wurde — Soll-Mieten der Westerfeld-Wohnungen
(seit 20.10. von DealPilot gerechnet), Rohertragsfaktor-Zeile, Nettomietrendite und Phasen im Bank-PDF, Portfolio-Cockpit,
Pilot-Offerte mit 6 WE. Die Mitschnitte (Ü2, Modul 26) zeigen Westerfeld noch mit 4 WE.

## Sprache — was gilt

- **Bildsprache Luftfahrt:** Cockpit · Pre-Flight · Boarding / Quick Boarding · Bordkarte · Co-Pilot /
  Pilot-Analyse · Runway · Score-Dial · Reiseflug (Bestand).
- Das Guthaben heißt **Kontingent** (MPI · MPI+ · WEV). **Nie „Kerosin", nie „Liter".**
- **Score-Stufen** überall gleich: ab 85 **Sehr gut** · ab 70 **Gut** · ab 50 **Solide** · ab 35 **Schwach** ·
  darunter **Kritisch**.
- **Keine Anbieter- oder Quellennamen nach außen** — Bewertungspartner heißen „unabhängige
  Bewertungspartner", Angebotsdaten „aktueller Marktdurchschnitt". ImmoMetrica darf genannt werden;
  amtliche Stellen (Gutachterausschuss, Statistische Ämter, BORIS) ebenfalls.
- **Kennzeichnungen, die nie fehlen dürfen:** Marktpreisindikation aus Angebotspreisen (kein Gutachten nach
  § 194 BauGB) · Wertpotenzial ist ein Potenzialwert, keine Verkehrswertermittlung · amtlich (Stufe A–C)
  gegen DealPilot-Formel (Stufe N) und Auffangwert (Stufe D) · keine Steuerberatung (§ 6 StBerG) ·
  DealPilot verschickt bei Ämtern nichts.

## Die Reise in drei Phasen — Lesereihenfolge

### Pre-Flight · Konto und Quick Boarding
| Nr. | Datei | Video (Studio `?modul=`) | `DREHBUECHER`-Schlüssel | Messe-Geschichte |
|---|---|---|---|---|
| 01 | [Konto, Anmeldung, Testphase, Kontingent](01-konto-anmeldung-testphase-kontingent.md) | — (noch kein Video) | — | — |
| 03 | [Quick Boarding mit DealPilot-Marktbewertung](03-quick-boarding.md) | Ü1 / 01 · Quick Boarding | `quickcheck-rundgang` (auch `quickcheck`, `quickcheck-tippen`) | 9, 11 |

### Boarding · ein Objekt aufnehmen und bewerten
| Nr. | Datei | Video | `DREHBUECHER`-Schlüssel | Messe-Geschichte |
|---|---|---|---|---|
| 02 | [Neues Objekt anlegen (Quellen, Sprache, geführte Eingabe, Import)](02-neues-objekt-anlegen.md) | 02 · 03 · 05 · 25 · Ü2 | `boarding-zum-objekt`, `reihe-datenaufnahme`, `reihe-sprache-stufe2`, `reihe-gefuehrt`, `reihe-ueberblick2` | — |
| 04 | [Reiter Objekt (Eingabetiefe, Parameter, BORIS, WGFZ, Zinssatz)](04-reiter-objekt.md) | 04 · 16 · 24 | `reihe-stufen`, `reihe-stufe3`, `reihe-brw-unterlagen` | 4, 8 |
| 05 | [Investition und Kaufnebenkosten](05-investition.md) | 06 | `reihe-investition` | — |
| 06 | [Miete, Mietentwicklung, Pilot-Mietpreis-Analyse](06-miete.md) | 07 | `reihe-miete` | 8 |
| 07 | [MFH-Konfigurator (Einheiten, Soll-/Zielmiete, § 558, § 559, Aufteilung)](07-mfh-konfigurator.md) | 26 | `reihe-zielbild` | 2, 8, 10 |
| 08 | [Finanzierung (Darlehen, Bausparvertrag, DSCR)](08-finanzierung.md) | 08 | `reihe-finanzierung` | 13 |
| 09 | [Bewirtschaftung](09-bewirtschaftung.md) | 09 | `reihe-bewirtschaftung` | — |
| 10 | [Steuer: zvE, Grenzsteuersatz, AfA, Steuerzeiträume](10-steuer-grundlagen.md) | 10a | `reihe-steuer` | 4 |
| 11 | [Restnutzungsdauer-Rechner und RND-Gutachten](11-restnutzungsdauer-rechner-und-gutachten.md) | 10c | `reihe-rnd` | 4, 5, 11, 12 |
| 12 | [BMF-Kaufpreisaufteilung](12-bmf-kaufpreisaufteilung.md) | 10b | `reihe-bmf` | 4, 12 |
| 13 | [Werbungskosten im Detail, Belege, 15-%-Grenze, Finanzamt-PDF](13-werbungskosten-und-15-prozent-grenze.md) | 15 · 23 | `reihe-steuer-bestand`, `reihe-15pct` | 3, 3b, 7, 15 |
| 14 | [Steuerverlauf mit Wendepunkt (neu, v2544)](14-steuerverlauf-wendepunkt.md) | — (noch kein Video; Vorlage `design/Vorschläge/steuerverlauf-demo.html`) | — | 3, 15 |
| 15 | [DealScore und Investor Deal Score](15-deal-score-und-investor-deal-score.md) | 12 | `reihe-bewertung` | 9 |
| 16 | [Pilot-Analyse](16-pilot-analyse.md) | 11 | `reihe-pilot` | 8, 10 |
| 17 | [Abruf „Marktpreise" mit Verlauf](17-abruf-marktpreise.md) | 26 (Teil) | `reihe-zielbild` | 8 |
| 18 | [Tab Bewertung (Kennzahlen, Wertpotenzial, Wertüberleitung)](18-tab-bewertung.md) | 12 · 26 | `reihe-bewertung`, `reihe-zielbild` | 8 |
| 19 | [Marktbericht Stufe 1 · 2 · 3](19-marktbericht.md) | 18 · 16 · 04 | `reihe-marktbericht`, `reihe-stufe3`, `reihe-stufen` | 8, 9, 3b |
| 20 | [Bank-PDF und Investment-PDF](20-bank-pdf-und-investment-pdf.md) | 19 · Ü2 | `reihe-bankpdf`, `reihe-ueberblick2` | 13 |
| 21 | [Deal-Aktion (Status, Bereit für die Bank, Bordkarte, Netzwerk)](21-deal-aktion.md) | 13 | `reihe-dealaktion` | — |
| 25 | [Unterlagen beim Amt anfordern](25-unterlagen-beim-amt.md) | 24 | `reihe-brw-unterlagen` | 14 |

### Reiseflug · Bestand und Portfolio
| Nr. | Datei | Video | `DREHBUECHER`-Schlüssel | Messe-Geschichte |
|---|---|---|---|---|
| 22 | [Bestand gegen Ankauf (Soll/Ist)](22-bestand-soll-ist.md) | 14 · 15 | `reihe-bestand`, `reihe-steuer-bestand` | 1, 2, 3b |
| 23 | [Portfolio-Cockpit, Portfolio-Pilot, Bankexport, Track Record](23-portfolio-cockpit-und-portfolio-pilot.md) | 20 · 21 | `reihe-bankexport`, `reihe-cockpit` | — |
| 24 | [Telegram-Bot](24-telegram-bot.md) | 22 (nachgestellt) | `reihe-telegram` | 14 |
| 29 | [Mandanten, GmbH-Halter, Überführung, Jahresabschluss](29-mandanten-gmbh-ueberfuehrung.md) | — | — | 6 |
| 30 | [Erbbaurecht](30-erbbaurecht.md) | — | — | — |

### Rund um die App
| Nr. | Datei | Video | `DREHBUECHER`-Schlüssel |
|---|---|---|---|
| 26 | [Einstellungen, Standardwerte, Investmentprofil, Angebotsabschlag](26-einstellungen-standardwerte-investmentprofil.md) | — (Teile in 08) | — |
| 27 | [Import, Export, Sicherung, Objekt übertragen](27-import-export-sicherung.md) | 17 | `reihe-uebertragen` |
| 28 | [Pilot-Hilfe (F1), Prozess-Atlas, Rundgang](28-pilot-hilfe-und-prozess-atlas.md) | — | — |
| 31 | [Whitelabel und Partner — **nur intern**](31-whitelabel-partner-intern.md) | — | — |
| 32 | [Datenschutz und Server in Deutschland](32-datenschutz-und-server.md) | — | — |

## Querverweise

- **Videoreihe:** `Dateien/Messe/Videos/Videoreihe.md` — Ebenen A (Überblick), B (Basismodule 02–10c),
  C (Spezialmodule 11–26), Stand jeder Aufnahme mit gemessenen Zahlen.
- **Drehbücher:** `frontend/js/messe-drehbuch.js`, Objekt `DREHBUECHER` (ab Z. 426), Studio-Zuordnung
  Modulnummer → Schlüssel in `frontend/messe-studio.html` (Z. 90 ff.). Der Skill bzw. Agent
  `messe-video` baut, prüft und nimmt auf.
- **Messe-Geschichten:** `design/Messe/demo-geschichten.md` — Geschichten 1–15, die Inventur der Demo-Objekte
  (Fortschreibung 20.10.2026), die Korrekturen an den Geschichten 1–7 und die Tabelle **„Welche Geschichte
  für welchen Besucher"** (Einsteiger · Bestand · MFH · Bank · Steuer · Makler).
- **Hilfe in der App:** `frontend/js/help.js` — die Wortlaute von Knöpfen und Feldern stammen weitgehend
  von dort; ändert sich die Hilfe, hier nachziehen.

## Was noch kein Video hat

Konto/Testphase (01), Steuerverlauf mit Wendepunkt (14), Einstellungen/Investmentprofil (26), Pilot-Hilfe und
Prozess-Atlas (28), Mandanten/GmbH (29), Erbbaurecht (30), Datenschutz (32). Für jedes steht in Abschnitt 6
der Datei ein Szenenvorschlag. Whitelabel (31) ist bewusst kein Messe- oder Landingpage-Thema.

## Pflege

Neuer Stand einer Funktion → die Datei hier fortschreiben (Kopfzeile „Stand" und „Belegt:"-Zeile), keine neue
Datei mit Datum daneben. Neue Funktion → neue Nummer am Ende und eine Zeile in dieser Tabelle.
