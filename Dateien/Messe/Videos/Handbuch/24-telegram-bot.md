# 24 · Der Telegram-Bot — DealPilot in der Hosentasche

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 22 · Der Telegram-Bot (`reihe-telegram`, `?modul=22`, 2:06) — **nachgestellt**: eigenes Chatfenster mit Vermerk „Nachgestellt · Demo", Antworten aus einem echten Lauf des Bots ·
> Messe-Geschichte: 14 „Unterlagen beim Amt per Telegram" (design/Messe/demo-geschichten.md)

## 1 · Wozu

Unterwegs bei der Besichtigung, zwischen zwei Terminen: Du schreibst oder sprichst deinem eigenen DealPilot-Bot, wie du denkst — „wie ist der DSCR bei der Musterstr. 12?", „wie steht die Parkstraße gegen den Plan?", „leg mir ein Objekt an". Der Bot liest aus deinem Konto, ändert Felder, legt Objekte per Sprachnachricht oder Exposé-Foto an, holt eine Marktpreisindikation und bereitet Unterlagen beim Amt vor. Befehle brauchst du nicht.

## 2 · Wo in der App

- **Einrichten:** Einstellungen → Reiter **Account & Sicherheit** → Telegram-Bot.
  1. In Telegram **@BotFather** öffnen, `/newbot` schicken.
  2. Namen und Benutzernamen (endet auf „bot") vergeben.
  3. Die **Einwilligung** lesen und anhaken — Objektdaten gelangen dabei in die **Vereinigten Arabischen Emirate**, Bot-Chats sind **nicht Ende-zu-Ende-verschlüsselt**.
  4. Token einfügen → **Bot verbinden**.
  5. **Verbindungscode erzeugen**, den Bot öffnen, `/start`, Code eintippen.
  Danach: „Stilllegen", „Trennen" (löscht auch den Chatverlauf im Bot) oder Bot ganz entfernen.
- **Im Chat** — der Hilfetext des Bots (wörtlich aus `backend/src/routes/telegramWebhook.js`, `HILFE`):
  - *Objekte:* „gib mir ne Liste der Objekte" · „was hat Objekt 17 für Kerndaten?" · „wie ist der DSCR bei der Musterstr. 12?" · „und die Miete?" (bleibt beim selben Objekt)
  - *Portfolio:* „wie ist meine Vermögensbilanz?" · „wo stehe ich in zehn Jahren?" · „wie steht die Parkstraße gegen den Plan?" (Soll/Ist seit dem Ankauf)
  - *Bewertung:* „wie ist der DealScore?" · „Investor Deal Score von Objekt 3" · „hol mir eine Marktpreisindikation" (oder „erweiterte")
  - *Anlegen und ändern:* „leg mir ein Objekt an" — dann draufsprechen, ein Foto vom Exposé schicken oder tippen · „setz die Zimmerzahl auf 5"
  - *Unterlagen beim Amt:* „Unterlagen für Objekt 3 anfordern" · „hol die Flurkarte für die Parkstraße"
  - Befehle gehen auch: `/neu` · `/objekte` · `/portfolio` · `/marktpreis` · `/unterlagen` · `/abbrechen` · `/stop`

## 3 · Schritt für Schritt — Beispiel aus dem Video (nachgestellt)

| Nr | Du schreibst | Der Bot |
|---|---|---|
| 1 | „gib mir ne Liste der Objekte" | nummerierte Liste deiner Objekte (Werkzeug `objekte_liste`) |
| 2 | „wie steht die Parkstraße gegen den Plan?" | Soll/Ist seit dem Ankauf (Werkzeug `soll_ist_lesen`) — Zahlen wie Handbuch 22 |
| 3 | „leg mir ein Objekt an" + Sprachnachricht | legt das Objekt an (Werkzeug `objekt_anlegen`) und nennt, was noch fehlt |
| 4 | „/unterlagen 3" | Übersicht je Unterlage: Amt, Kanal, Gebühr, Ansprechpartner — danach Entwurf auf Nummer |

Im Video stammen die Antworten aus **einem** Lauf des echten Bot-Agenten im Staging-Container, ohne Telegram. Das dort angelegte Objekt wurde sofort gelöscht.

**Unterlagen-Ablauf (v2470):** Objekt wählen (Bezug auf die letzte Liste, „Objekt 3", Adresse oder „dafür" = letztes Objekt) → Übersicht je Unterlage (Amt, Kanal, Empfänger mit Belegstand, Portal-Link, Telefon, Gebühr, Ansprechpartner 1/2, Vorgangsstand) → Nummer tippen → Anschreiben mit Betreff und Brief zum Kopieren, Hinweis „DealPilot verschickt nichts" → „verschickt" schreiben → Vorgang steht auf gesendet. Frist 30 Minuten, `/abbrechen`. Geprüft an Gohliser Str. 42, Leipzig (6 Ämter).

**Belegt:** Hilfetext und Befehle aus `telegramWebhook.js` Z. 49–73; Einrichtung aus `help.js` „Telegram-Bot verbinden"; Werkzeuge und „nachgestellt" aus Videoreihe.md (Modul 22); Unterlagen-Ablauf und Gohliser-Prüfung aus Journal v2470–v2472. Marktpreisindikation: der Dienst prüft das Plan-Kontingent vor dem Abruf (`telegramMarktService.js`, Kopf). Konkrete Bot-Antworten live zeigen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Muss ich Befehle lernen?"** — Nein. „Sag es einfach so, wie du es denkst." Die Befehle sind nur eine Abkürzung.
- **„Kostet der Bot Kontingent?"** — Fragen zu Objekten und Portfolio nicht. Eine Marktpreisindikation über den Bot zählt wie in der App aufs Kontingent. Die Ämter-Übersicht kostet heute kein Kontingent.
- **„Ist das sicher?"** — Du verbindest deinen eigenen Bot mit einem Code. Telegram-Chats sind nicht Ende-zu-Ende-verschlüsselt, die Daten laufen über Server in den VAE — das steht in der Einwilligung, und deshalb fragt DealPilot vorher.
- **„Schickt der Bot Briefe an Ämter?"** — Nein. Er schreibt den Entwurf, du verschickst.

## 5 · Grenzen und Kennzeichnung

- Datenweg Telegram: VAE, keine Ende-zu-Ende-Verschlüsselung (Einwilligung Pflicht).
- Der Bot rechnet mit denselben Kernen wie die App (gespiegelt ins Backend) — Urteil und Score sind dieselben.
- **Intern:** Auf Produktion ist noch kein Bot eingetragen; `@Dealpilot_junker_bot` hängt mit seinem Webhook an Staging (Journal Prod-Rollout 56). Für die Messe: Bot vorher auf dem Messe-Konto prüfen. Das Video ist nachgestellt und so gekennzeichnet — kein Telegram-Logo.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Einstellungen → Account & Sicherheit → Telegram-Bot | — | Dein eigener Bot: einmal bei Telegram anlegen, Token einfügen, mit Code verbinden. |
| 2 | Chatfenster „Nachgestellt · Demo" | „gib mir ne Liste der Objekte" | Schreib, wie du denkst. Der Bot kennt deine Objekte. |
| 3 | Antwort Soll/Ist Parkstraße | — | Soll gegen Ist seit dem Ankauf — auch unterwegs. |
| 4 | Sprachnachricht „leg mir ein Objekt an" | — | Ein Objekt per Sprachnachricht oder Exposé-Foto anlegen. Was fehlt, sagt der Bot. |
| 5 | /unterlagen 3 | Nummer 2 tippen | Amt, Gebühr, Ansprechpartner und der fertige Entwurf. Verschicken tust du selbst. |

### Sprechertext (Entwurf, ca. 70 Sekunden)

Nicht immer sitzt du vor dem Rechner. Für unterwegs gibt es deinen eigenen DealPilot-Bot in Telegram.

Du legst ihn einmal an, verbindest ihn mit einem Code — und dann schreibst du einfach, wie du denkst. Gib mir die Liste der Objekte. Wie ist der DSCR bei der Musterstraße? Wie steht die Parkstraße gegen den Plan? Der Bot kennt dein Konto und rechnet mit denselben Kernen wie die App.

Auf der Besichtigung sprichst du ein neues Objekt einfach ein oder schickst ein Foto vom Exposé. Der Bot legt es an und sagt dir, was noch fehlt.

Und wenn du Unterlagen brauchst — Grundbuch, Flurkarte, Bauakte —, nennt er dir das zuständige Amt, die Gebühr und den Ansprechpartner und schreibt dir den Brief als Entwurf. Verschicken tust du selbst.

## Querverweise

- Handbuch 25 (Unterlagen beim Amt), 22 (Soll/Ist), 02 (Objekt per Sprache anlegen), 32 (Datenschutz)
- Videoreihe.md Modul 22 · `messe-drehbuch.js` `DREHBUECHER['reihe-telegram']` (Z. 4890)
