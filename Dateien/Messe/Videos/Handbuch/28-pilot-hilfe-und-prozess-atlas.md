# 28 · Der Pilot auf F1, der Prozess-Atlas und der Rundgang

> Stand 20.10.2026 (Staging bis v2544). Zahlen vor der Messe live gegenprüfen.
> Video: noch kein Video · Messe-Geschichte: — (gut als Einstieg für jeden Besucher)

## 1 · Wozu

Kein Handbuch wälzen: Drück **F1** — oder **?**, wenn du gerade nicht in einem Feld tippst —, und der Pilot fliegt zu dem Feld, auf dem Maus oder Cursor stehen, erklärt es und zeigt, wofür es gebraucht wird. Darunter fragst du einfach, was du wissen willst. Die Sofort-Antworten kommen ohne KI aus Hilfe, Feld-Erklärungen und Abläufen; reicht das nicht, beantwortet „Den Piloten fragen" die Frage mit KI und kennt dabei dein geöffnetes Objekt. Der **Prozess-Atlas** zeigt alle Abläufe als Netzplan, der **Rundgang** führt neue Nutzer einmal durch die App.

## 2 · Wo in der App

- **Pilot (Tower):** F1 überall (auch im Quick-Check-Fenster), **?** außerhalb von Eingabefeldern, oder Klick auf die Pilot-Figur (Standard: in der Seitenleiste über dem Nutzerfeld). Pfeiltasten und Enter gehen durch die Treffer, **Esc** schließt. „Zeig mir das Feld" springt an die Stelle. Im Tower: „Prozess-Atlas öffnen", bei Treffern „Im Prozess-Atlas zeigen →" (`pilot-tower.js`).
- **Ort des Piloten:** Einstellungen → Darstellung → „Pilot · Hilfe auf F1": Seitenleiste · Kopfleiste · Hauptbereich · Nur auf F1.
- **Prozess-Atlas** (`prozess-atlas.js`), Abläufe im Code: **Die ganze Reise · Quick-Check · Netzplan Datenaufnahme · Deal bis gewonnen · Das Steuerjahr · Marktbericht · Woraus die Scores bestehen · Telegram-Bot**. Station anklicken: Schritte klappen auf, Eingaben fliegen ein, Ergebnisse erscheinen; „Ablauf abspielen" geht alles nacheinander durch; „Hinfliegen" öffnet die Stelle in der App; grün ist, wo dein geöffnetes Objekt steht.
- **Rundgang:** Seitenleiste → Aktionen → System → **Rundgang starten**.
- **Feldhilfe:** die kleinen i-Symbole an den Feldern; Stärke unter Einstellungen → Darstellung → **Tooltip-Hilfe**: Aus · Profi (nur wichtige, z. B. § 7b) · Anfänger (alle, Standard).
- **Hilfe-Themen:** über das Hilfe-Symbol im Kopf; Themen von „Einstieg, Abläufe & Pilot" bis „Häufige Fragen".
- **Co-Pilot-Pillen** in der Pilot-Analyse (Handbuch 16): Fragen wie „welche Felder fehlen" beantwortet die App selbst, kostenlos, gekennzeichnet als „DealPilot".

## 3 · Schritt für Schritt — Beispiel im Reiter Steuer (beliebiges Objekt)

| Schritt | Taste / Klick | Was erscheint |
|---|---|---|
| 1 | Cursor ins Feld **Gebäudeanteil am KP (%)**, F1 | Pilot fliegt zum Feld und erklärt: der Rest ist Grund und Boden, nicht abschreibbar; Hinweis auf den BMF-Rechner |
| 2 | Eintippen „Wann speichert DealPilot?" | Sofort-Antwort aus der Hilfe: automatisch beim Reiterwechsel, beim Öffnen eines anderen Objekts, bei Aktionen; „Gespeichert · gerade eben" |
| 3 | „Den Piloten fragen" | KI-Antwort mit Bezug auf das geöffnete Objekt (Tageslimit je Plan) |
| 4 | „Prozess-Atlas öffnen" → „Das Steuerjahr" → „Ablauf abspielen" | Stationen des Steuerjahrs nacheinander, „Hinfliegen" öffnet die Stelle |

**Belegt:** Tasten, Orte und Texte aus `help.js` („Der Pilot — Hilfe auf Tastendruck", „Der Prozess-Atlas", „Tastenkürzel", „Wie rufe ich den Piloten?", „Wann speichert DealPilot mein Objekt?", „Darstellung und Tooltip-Hilfe"); Ablaufnamen aus `prozess-atlas.js` (`name:`-Einträge Z. 34–463). Antworttexte live zeigen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Brauche ich eine Schulung?"** — Nein. F1 auf jedem Feld, und der Rundgang beim ersten Start.
- **„Kostet die Hilfe?"** — Die Sofort-Antworten nicht, sie kommen ohne KI. Nur „Den Piloten fragen" nutzt KI, mit eigenem Tageslimit je Plan — nicht aus dem Bewertungs-Kontingent.
- **„Wie hängt alles zusammen?"** — Der Prozess-Atlas: die ganze Reise vom Inserat bis zum Portfolio als Netzplan.

## 5 · Grenzen und Kennzeichnung

- KI-Antworten des Piloten sind KI-gestützt; maßgeblich sind die Zahlen der App. Lokale Antworten sind als „DealPilot" gekennzeichnet.
- Die Hilfe nennt sieben Abläufe; im Code stehen acht (Telegram-Bot kam dazu) — am Stand die Liste im Bild vorlesen.
- Fehlt am gewählten Ort der Platz (Leiste eingeklappt, Handy), weicht der Pilot auf den nächsten Ort aus.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Steuer, Feld Gebäudeanteil | F1 | F1 auf jedem Feld: der Pilot fliegt hin und erklärt, wofür es gebraucht wird. |
| 2 | Tower mit Suchfeld | Frage tippen | Fragen ohne KI beantwortet DealPilot sofort — mit Sprung zum Feld. |
| 3 | „Den Piloten fragen" | — | Reicht das nicht, antwortet der Pilot mit KI und kennt dein Objekt. |
| 4 | Prozess-Atlas, Netzplan | „Die ganze Reise" → abspielen | Alle Abläufe als Netzplan — vom Inserat bis zum Portfolio. |
| 5 | Station „Hinfliegen" | Klick | Ein Klick, und du stehst an der Stelle in der App. |

### Sprechertext (Entwurf, ca. 60 Sekunden)

Du musst DealPilot nicht auswendig kennen. Drück einfach F1.

Der Pilot fliegt zu dem Feld, auf dem du gerade stehst, und erklärt es — was es bedeutet und wofür DealPilot es braucht. Darunter fragst du, was du wissen willst. Viele Antworten kommen sofort, ohne KI, mit einem Sprung an die richtige Stelle. Und wenn das nicht reicht, fragst du den Piloten selbst — er kennt dein geöffnetes Objekt.

Wer den großen Zusammenhang sehen will, öffnet den Prozess-Atlas: alle Abläufe als Netzplan, vom Inserat bis zum Portfolio. Ablauf abspielen, Station anklicken, hinfliegen.

Und beim ersten Start nimmt dich der Rundgang einmal an die Hand.

## Querverweise

- Handbuch 16 (Pilot-Analyse, Co-Pilot-Pillen), 26 (Darstellung, Tooltip-Hilfe), 01 (Plan und Limits)
