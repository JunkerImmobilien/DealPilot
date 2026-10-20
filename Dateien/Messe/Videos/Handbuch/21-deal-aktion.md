# 21 · Deal-Aktion — vom Rechnen zum Abschluss

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 13 · Deal-Aktion (`DREHBUECHER`-Schlüssel `reihe-dealaktion`, Studio `?modul=13`, 3:19) ·
> Messe-Geschichten: 8 (Westerfeldstr. 140), 13 (Musterstr. 12, Bank-PDF) (design/Messe/demo-geschichten.md)

## 1 · Wozu

Die Deal-Aktion ist das Gate vor dem Abflug. Hier entscheidest du, was aus dem Objekt wird — **Offen**, **Gewonnen** oder **Verloren** —, prüfst mit „Bereit für die Bank?", ob deine Angaben für das Bankgespräch reichen, und holst dir die Unterlagen: Investment-PDF, Finanzamt-PDF, Kaufpreisaufteilung, Track Record, Marktberichte. Die **Bordkarte** listet, was die Bank von dir persönlich und vom Objekt sehen will. Fehlt eine Amtsunterlage, bereitet DealPilot die Anfrage vor. Und wer sein Objekt einem geprüften Partner zeigen will, findet ihn unter „Dein Netzwerk".

## 2 · Wo in der App

- Reiter **Deal-Aktion** (letzter Reiter oben, Symbol Handschlag; `index.html` `data-target-sec="s8"`).
- Darin, von oben nach unten (gemessen in `deal-action-boarding.js`, `deal-action-readycheck.js`, `help.js`):
  - **Deal-Status** — Offen (in Prüfung) · Gewonnen (Objekt geht in den Bestand) · Verloren.
  - **„Bereit für die Bank?"** — zählt zwei Listen zusammen: die Felder, die der Investor Deal Score braucht, und die Pflichtfelder der im Reiter Objekt gewählten Stufe (Stufe 1: 6 Felder · Stufe 2: 13 · Stufe 3: bis 20). Jedes fehlende Feld steht mit Sprung zum Eingabefeld da.
  - **PDFs herunterladen** — „Investment, Finanzamt (Steuer) & Track Record — mit den aktuellen Objektdaten": Investment-PDF (Fassung Bank, hell oder Obsidian), Finanzamt-PDF (Steuerformular), Kaufpreisaufteilung (Finanzamt), Track Record.
  - **Marktberichte** — „Erzeugte Berichte als PDF", neueste zuerst mit Datum, Uhrzeit, Marktwert; ab zwei Berichten eine Zeile zur Entwicklung und „Verlauf ansehen". Noch keiner da: „Marktbericht erstellen".
  - **Bordkarte & Unterlagen** — „Bankgespräch vorbereiten": *Persönliche Unterlagen* (Personalausweis, letzte 3 Gehaltsabrechnungen, Steuerbescheide 2 Jahre, SCHUFA-Selbstauskunft, Vermögen & Verbindlichkeiten) und *Objekt-Unterlagen* (Exposé, aktueller Grundbuchauszug, Wohnflächenberechnung, Nebenkostenabrechnungen, bei WEG Teilungserklärung). Darunter der Knopf **Unterlagen beim Amt anfordern** (Flurkarte, Grundbuchauszug, Altlasten, Baulasten, Bauakte) → Handbuch 25.
  - **Dein Netzwerk** — „Geprüfte Partner — Objektdaten gehen mit".
  - **In Gesellschaft überführen** → Handbuch 29.

## 3 · Schritt für Schritt — Beispiel Westerfeldstr. 140, Bielefeld (MFH, Kopie)

| Schritt | Feld / Klick | Wert | Was die App zeigt |
|---|---|---|---|
| 1 | Reiter Deal-Aktion öffnen | — | Westerfeld trägt einen Ankauf-Stand (gekauft 01.01.2025), steht also auf „Gewonnen"; ein Ankaufobjekt wie Lindenhof 14 steht auf „Offen" |
| 2 | Block „Bereit für die Bank?" | Stufe im Reiter Objekt: 3 | Zählt Score-Felder und Stufe-3-Pflichtfelder; fehlende Felder als Liste mit Sprung. Zahl live zeigen |
| 3 | PDFs herunterladen → Investment-PDF | Fassung „Bankfassung" | Rückfrage mit drei Fassungen, danach das PDF (Inhalt → Handbuch 20) |
| 4 | Marktberichte | — | Liste der Berichte zum Objekt; für Westerfeld liegen Stufe-3-Berichte vor (aktuell Bericht 326 vom 20.10., 6 WE) |
| 5 | Bordkarte & Unterlagen | Häkchen setzen | Checkliste fürs Bankgespräch, je Zeile abhakbar |
| 6 | Unterlagen beim Amt anfordern | — | Fenster mit den sechs Unterlagen und dem zuständigen Amt (Handbuch 25) — **nichts wird verschickt** |
| 7 | Dein Netzwerk | — | Partnerkarten; im Video nur bis vor das Absenden |

Warum zwei Listen in „Bereit für die Bank?": der Score braucht andere Angaben (Zins, Tilgung, Lage …) als die Wertermittlung (Grundstück, Bodenrichtwert, BGF …). Erst beides zusammen macht die Mappe vollständig (Kommentar v2079 in `deal-action-readycheck.js`).

**Belegt:** Aufbau und Beschriftungen aus `deal-action-boarding.js` Z. 130–180 und `help.js` („Deal-Aktion — Status, PDFs und Bank", „Alte Berichte wiederfinden"); Pflichtfeld-Staffel 6/13/20 aus `deal-action-readycheck.js` Z. 150–155; Bericht 326 (20.10.2026, nach der Befüllung, 6 WE). Alle übrigen Zahlen live zeigen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Was heißt ‚Gewonnen' genau?"** — Das Objekt rutscht in den Bestand, und DealPilot friert den Ankauf-Stand zum Nutzen-/Lastenwechsel ein. Ab dann misst du jedes Jahr Ist gegen Plan (Handbuch 22).
- **„Und wenn der Deal platzt?"** — Status „Verloren", nicht löschen. Das Objekt bleibt mit allen Zahlen erhalten, ausgegraut am Ende der Ankauf-Liste.
- **„Was gebe ich der Bank?"** — Die Bankfassung des Investment-PDF plus die Unterlagen der Bordkarte. „Bereit für die Bank?" sagt dir vorher, was noch fehlt.
- **„Verschickt DealPilot etwas an Ämter oder Partner?"** — Nein. Ämter: DealPilot schreibt den Entwurf, du schickst ihn selbst. Netzwerk: du entscheidest, ob du einreichst.

## 5 · Grenzen und Kennzeichnung

- „Bereit für die Bank?" prüft **Vollständigkeit**, nicht die Kreditwürdigkeit. Die Entscheidung trifft die Bank.
- Das Finanzamt-PDF ist eine Aufstellung, **keine Steuerberatung**.
- Marktberichte sind Marktpreisindikationen bzw. (Stufe 3) Wertermittlungen mit Herkunft je Zahl — kein Gutachten nach § 194 BauGB.
- Gewonnen ohne Datum „Wirtsch. Übergang" im Reiter Objekt friert **nichts** ein — DealPilot setzt nie stillschweigend das heutige Datum.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiterleiste, Deal-Aktion leuchtet | Reiter Deal-Aktion | Der letzte Reiter vor dem Abflug: Status, Bankmappe, Unterlagen. |
| 2 | Status Offen · Gewonnen · Verloren | — (nur zeigen) | Gewonnen schickt das Objekt in den Bestand und friert den Ankauf-Stand ein. |
| 3 | Block „Bereit für die Bank?" | auf ein fehlendes Feld | Was fehlt, steht hier — ein Klick springt direkt zum Feld. |
| 4 | PDFs herunterladen | Investment-PDF → Bankfassung | Investment-PDF, Finanzamt-PDF, Kaufpreisaufteilung, Track Record — immer mit den aktuellen Zahlen. |
| 5 | Marktberichte-Liste | — | Jeder Bericht bleibt am Objekt. Ab zwei Berichten siehst du die Entwicklung des Marktwerts. |
| 6 | Bordkarte & Unterlagen | zwei Häkchen | Die Bordkarte fürs Bankgespräch: persönliche und objektbezogene Unterlagen zum Abhaken. |
| 7 | Knopf „Unterlagen beim Amt anfordern" | Fenster öffnen, schließen | Fehlt der Grundbuchauszug? DealPilot nennt das Amt und schreibt den Entwurf. Verschicken tust du. |

### Sprechertext (Entwurf, ca. 80 Sekunden)

Die Deal-Aktion ist das Gate vor dem Abflug. Hier sagst du DealPilot, was aus dem Objekt wird: offen, gewonnen oder verloren. Gewonnen heißt: Das Objekt geht in den Bestand, und der Plan vom Kauftag wird eingefroren — damit du in zehn Jahren noch weißt, was du dir vorgenommen hast.

Darunter fragt DealPilot: Bereit für die Bank? Gezählt wird, was der Score braucht und was die Wertermittlung deiner Stufe verlangt. Fehlt etwas, springst du mit einem Klick hin.

Dann die Unterlagen. Das Investment-PDF in der Bankfassung, das Finanzamt-PDF, die Kaufpreisaufteilung und dein Track Record — immer mit den aktuellen Zahlen. Jeder Marktbericht bleibt am Objekt, und ab zwei Berichten siehst du, wie sich der Wert entwickelt.

Die Bordkarte listet, was die Bank von dir sehen will — persönlich und zum Objekt. Und wenn der Grundbuchauszug fehlt, nennt DealPilot das zuständige Amt und schreibt dir den Entwurf. Verschicken tust du selbst.

## Querverweise

- Handbuch 20 (Bank- und Investment-PDF), 22 (Bestand Soll/Ist), 25 (Unterlagen beim Amt), 29 (Gesellschaft überführen), 19 (Marktbericht), 13 (Finanzamt-PDF)
- Videoreihe.md, Zeile Modul 13 · `frontend/js/messe-drehbuch.js` `DREHBUECHER['reihe-dealaktion']` (ab Z. 3207)
