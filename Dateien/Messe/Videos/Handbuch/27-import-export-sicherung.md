# 27 · Import, Export, Sicherung und Objekt übertragen

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 17 · Objekt übertragen (`reihe-uebertragen`, `?modul=17`, 3:00) ·
> Messe-Geschichte: — (design/Messe/demo-geschichten.md)

## 1 · Wozu

Deine Daten gehören dir. Du sicherst ein Objekt oder alle als **DealPilot-Sicherung** (Datei `.dpkt`, auf Wunsch mit Passwort verschlüsselt), gibst Kennzahlen als Excel oder Portfolio-CSV aus und spielst eine Sicherung über den Import wieder ein — auch in einem anderen Konto. So überträgst du ein Objekt an einen Partner oder Mitstreiter. Umgekehrt holst du Eingaben aus einer Excel-Kalkulation oder ein Dokument (Gutachten, Grundbuch, Kaufvertrag …) ins Objekt.

## 2 · Wo in der App

- **Seitenleiste → Aktionen → Anlegen → Import** → „Daten importieren" mit drei Karten:
  - **Dokument einlesen** — ein PDF wie Grundbuch, Kataster, Kaufvertrag, WEG-Protokoll, Bodenrichtwert, Verkehrswert- oder Restnutzungsdauergutachten, Kaufpreisaufteilung oder Marktbericht; die Art wird erkannt (→ Handbuch 02).
  - **Excel-Kalkulation importieren** — erkannt werden ImmoKalk, immocation Roter Faden und immocation Pro; überschreibt das gerade geöffnete Objekt.
  - **JSON-Backup importieren** — stellt eine DealPilot-Sicherung wieder her; verschlüsselte fragen nach dem Passwort; Objekte mit gleichem Namen werden überschrieben.
- **Seitenleiste → Aktionen → Ausgeben → Export** → „Daten exportieren" mit vier Karten:
  - **PDF-Report für Objekt** (Investment-PDF, Fassung wählbar → Handbuch 20)
  - **DealPilot-Sicherung** — ein Objekt oder alle als `.dpkt`, mit Eingaben, Berechnungen, Pilot-Analysen, Bemerkungen und Fotos; optional **Mit Passwort verschlüsseln (AES-256)**, sonst Klartext
  - **Excel-Export** — eine Zeile je Objekt mit allen Kennzahlen
  - **Portfolio-CSV** — alle Objekte plus Summenzeile, Semikolon-getrennt
- Objektkarte in der Seitenleiste: **⎘ Duplizieren** (Kopie mit neuer Nummer, ohne Status Gewonnen/Verloren) und **× Löschen** (endgültig, kein Papierkorb).

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140 übertragen (Kopie)

| Schritt | Klick / Feld | Wert | Was die App zeigt |
|---|---|---|---|
| 1 | Aktionen → Export → DealPilot-Sicherung | „dieses Objekt" | Karte listet, was mitgeht und was „Bleibt hier" |
| 2 | Mit Passwort verschlüsseln | an, Passwort | Datei verschlüsselt (AES-256) |
| 3 | Sicherung erzeugen | — | Datei `.dpkt`, im Video **388 KB**: **287 Eingaben**, Steuer, Pilot-Analyse, Ankauf-Stand, Lexikon mit **228 Feldern**, Fotos |
| 4 | Beim Empfänger: Aktionen → Import → JSON-Backup importieren | Datei, Passwort | Objekt erscheint in seinem Konto |

Was mitgeht und was nicht: Seit v2351 trägt eine **Einzelobjekt-Sicherung kein Konto-Wissen** mehr (Portfolio-Analyse, Lageprofil, eigene Ergänzung bleiben unter „Bleibt hier"); **Projektwissen** des Objekts geht mit. Plan- und Zahlungsdaten sind nie enthalten, nur Objekte.

**Belegt:** Karten und Texte aus `help.js` („Daten importieren: die drei Karten", „Daten exportieren", „Wie sichere oder exportiere ich meine Daten?", „Wie dupliziere oder lösche ich ein Objekt?") und `import-export-modal.js` (Titel „Daten importieren" / „Daten exportieren"); 388 KB, 287 Eingaben, 228 Felder und v2351 aus Videoreihe.md, Abschnitt Module 17 und 22. Dateigröße hängt vom Objekt ab — live zeigen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Kann ich ein Objekt an jemanden weitergeben?"** — Ja: Sicherung erzeugen, Datei schicken, der andere importiert sie. Mit Passwort ist die Datei geschützt.
- **„Bekommt er auch meine anderen Objekte oder mein Profil?"** — Nein, bei der Einzelobjekt-Sicherung nicht. Was hierbleibt, zeigt die Karte vorher.
- **„Ich rechne bisher in Excel."** — ImmoKalk und immocation-Kalkulationen lassen sich einlesen; danach rechnet DealPilot weiter.
- **„Kann ich alles mitnehmen, wenn ich gehe?"** — Ja, eine Sicherung aller Objekte oder Excel/CSV. Die Objekt-Sicherung gehört zum Pro-Plan.

## 5 · Grenzen und Kennzeichnung

- Ohne Passwort ist die `.dpkt`-Datei **Klartext**.
- Der Excel-Import **überschreibt** die Eingaben des geöffneten Objekts; JSON-Import überschreibt Objekte gleichen Namens.
- Ein gescanntes PDF ohne Textebene kann „Dokument einlesen" nicht lesen.
- Fremde Gutachten liefern Eingaben, nie Ergebnisse — deren Ergebniswerte erscheinen nur zum Vergleich.
- Eine direkte Übertragung „an einen anderen Nutzer" per Knopf gibt es nicht; der Weg ist Sicherung + Import (bei Mandanten eines Partners zusätzlich die Mandanten-Freigabe, Handbuch 31).

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Aktionen → Export | „Daten exportieren" | PDF, Sicherung, Excel, Portfolio-CSV — deine Daten in vier Formen. |
| 2 | Karte DealPilot-Sicherung | dieses Objekt | Was mitgeht und was hierbleibt, steht vorher auf der Karte. |
| 3 | Haken „Mit Passwort verschlüsseln" | an | AES-256 — ohne Passwort kommt niemand an die Daten. |
| 4 | Aktionen → Import | JSON-Backup importieren | Beim Empfänger: Datei wählen, Passwort, fertig — das Objekt steht mit allen Eingaben da. |
| 5 | Import-Karte Excel | — | Aus Excel umsteigen: ImmoKalk und immocation werden erkannt. |

### Sprechertext (Entwurf, ca. 65 Sekunden)

Deine Daten gehören dir — und du nimmst sie mit, wohin du willst.

Unter Aktionen, Export, wählst du die DealPilot-Sicherung. Ein Objekt oder alle, mit Eingaben, Steuer, Pilot-Analyse, Ankauf-Stand und Fotos. Was hierbleibt, zum Beispiel deine Portfolio-Analyse, siehst du vorher. Mit einem Passwort wird die Datei verschlüsselt.

So überträgst du ein Objekt auch an einen Partner: Er spielt die Datei über Aktionen, Import, in sein Konto ein — und das Objekt steht dort mit allen Zahlen.

Wer bisher in Excel rechnet, liest seine Kalkulation einfach ein. Und für die eigene Auswertung gibt es Excel-Export und Portfolio-CSV.

## Querverweise

- Handbuch 02 (Dokument einlesen, Exposé-Import), 20 (PDF), 23 (Bankexport, Track Record), 31 (Mandanten-Freigabe, intern), 32 (Datenschutz)
- Videoreihe.md Modul 17 · `messe-drehbuch.js` `DREHBUECHER['reihe-uebertragen']` (Z. 4743)
