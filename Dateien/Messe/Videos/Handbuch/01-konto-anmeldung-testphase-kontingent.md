# 01 · Konto, Anmeldung, Testphase und Kontingent

> Stand 20.10.2026 (Staging bis v2544). Zahlen vor der Messe live gegenprüfen. Video: noch keins (neu vorgeschlagen) · Messe-Geschichte(n): keine eigene — Einstieg für jeden Besucher (design/Messe/demo-geschichten.md, Übersicht „Welche Geschichte für welchen Besucher").

## 1 · Wozu

Bevor du abhebst, brauchst du ein Ticket: dein DealPilot-Konto. Du meldest dich mit E-Mail und Passwort an und bist sofort im Cockpit — die Bestätigungsmail kannst du nachholen. Die ersten vier Wochen fliegst du in der Pro-Klasse, mit einem eigenen Testpaket an Bewertungen. Danach wählst du den Plan, der zu deinem Portfolio passt. Was ein Marktbericht kostet, zählt dein **Kontingent** — getrennt nach den drei Stufen der Marktbewertung, damit du jederzeit siehst, was noch frei ist.

## 2 · Wo in der App

| Was | Wo |
|---|---|
| Registrieren / Anmelden | Startseite der App, Anmeldefenster |
| Hinweis zur Bestätigungsfrist | erscheint direkt mit der Erstanmeldung (`js/verify-frist.js`) |
| Passwort, Zwei-Faktor, Konto löschen | Seitenleiste → **Aktionen** → System → **Einstellungen** → Reiter **Account & Sicherheit** |
| Plan, Kontingent, Nachkaufen | **Einstellungen** → Reiter **Plan** → „Dein Kontingent", „Bewertungspakete", „Oder einzeln — genau die eine, die gerade fehlt" |
| Freie Bewertungen je Stufe | Reiter **Objekt** → Box **Marktbericht abrufen**, an jeder Stufe „N frei" |

## 3 · Schritt für Schritt — Beispiel: neues Konto am Messestand

| Schritt | Eingabe / Klick | Was die App zeigt |
|---|---|---|
| 1 | E-Mail, Passwort → Registrieren | Du bist sofort drin. Ein Hinweis nennt die Frist: spätestens **6 Stunden** nach der Erstanmeldung die E-Mail bestätigen, sonst wird das Konto gesperrt. |
| 2 | Bestätigungslink in der Mail anklicken | Frist erledigt, Konto voll offen. |
| 3 | Einstellungen → Plan | Testphase: **28 Tage Pro**, Testpaket **5 · 3 · 1** = 5 Marktpreisindikationen (MPI), 3 erweiterte Marktpreisindikationen (MPI+), 1 Wertermittlung nach ImmoWertV (WEV). |
| 4 | Reiter Objekt → Box Marktbericht abrufen | an Stufe 1 / 2 / 3 steht, wie viele noch frei sind. |
| 5 | Nach 28 Tagen | Testpaket verfällt mit der Testphase; es gilt das Kontingent des gewählten Plans. |

**Kontingent je Plan und Monat** (MPI · MPI+ · WEV):

| Plan | MPI (Stufe 1) | MPI+ (Stufe 2) | WEV (Stufe 3) |
|---|---:|---:|---:|
| Free | 1 | 0 | 0 |
| Starter | 5 | 0 | 0 |
| Investor | 5 | 5 | 0 |
| Pro | 5 | 5 | 5 |
| Partner | 5 | 5 | 5 (erbt Pro) |

Warum so: Das Monatskontingent gilt für den laufenden Monat, wird am 1. neu gesetzt, und was du nicht nutzt, verfällt. Zugekaufte Bewertungen verfallen **nie** und werden erst verbraucht, wenn das Monatskontingent leer ist. Eine schon bezahlte Tiefe kostet beim erneuten Abruf desselben Objekts nichts; vertiefst du später, wird nur die neue Stufe fällig. Die Pilot-Analyse zieht nichts vom Kontingent ab. Der Abruf „Marktpreise" in der Pilot-Analyse verbraucht eine MPI+ (siehe 17).

Preise: laut Preisübersicht („Bewertungen nachkaufen" öffnet sie) — hier bewusst nicht genannt.

Belegt: 6 h Frist `js/verify-frist.js` (v2137, Backend v2136); 28 Tage und 5·3·1 `frontend/js/config.js:613/633ff` und `backend/src/services/aiCreditsService.js` (`TESTPAKET`, `TESTPHASE_TAGE`); Plantabelle `aiCreditsService.js` `KONTINGENT`; Verfall/Nachkauf `js/help.js` „Plan und Kontingent"; MPI+ für Marktpreise Journal v2542.

## 4 · Was man daraus liest — Fragen am Stand

**Muss ich für den Test eine Kreditkarte angeben?** Die Sicherheitsseite der Landingpage wirbt mit „4 Wochen Pro — ohne Zahlungsdaten". Du registrierst dich nur mit E-Mail.

**Was passiert, wenn ich die Mail nicht bestätige?** Nach 6 Stunden sperrt der Server das Konto, bis du bestätigst. Die Frist rechnet der Server, nicht dein Browser.

**Was ist der Unterschied zwischen MPI, MPI+ und WEV?** Stufe 1 ist die Marktpreisindikation auf der Objektkarte, Stufe 2 der Marktbericht mit Lage und Markt, Stufe 3 der Marktbericht mit Wertermittlung nach ImmoWertV (Boden-, Ertrags-, Sachwert).

**Verfallen meine Bewertungen?** Das Monatskontingent ja, am Monatsende. Was du dazukaufst, nie.

**Ist die KI-Analyse begrenzt?** Die Pilot-Analyse ist im Plan enthalten und zieht kein Kontingent. Fragen an den Piloten (F1) haben ein eigenes Tageslimit je Plan.

## 5 · Grenzen und Kennzeichnung

- Im Free-Plan trägt jedes PDF das Wasserzeichen „DealPilot Free", in der Testphase „DealPilot Testphase"; ab Starter ist es weg.
- Stufe 2 gibt es ab Investor, Stufe 3 ab Pro. Der Investor Deal Score gehört zum Investor- und Pro-Plan (im Free-Plan als Demo, im Starter nicht enthalten).
- Einzeln gekaufte Bewertungen kosten mehr als im Kontingent (`help.js`). Konkrete Preise nur aus der Preisübersicht.
- Im Demo-Modus ohne Anmeldung liegen Objekte nur im Browser und gehen beim Browserwechsel verloren.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Anmeldefenster | Registrieren | Mit E-Mail und Passwort einsteigen — du bist sofort im Cockpit. |
| 2 | Hinweis zur Bestätigung | — | Bestätige die Mail innerhalb von sechs Stunden. Bis dahin ist alles offen. |
| 3 | Einstellungen → Plan | Reiter Plan | Vier Wochen Pro zum Testen, mit eigenem Paket: fünf, drei und eine Bewertung. |
| 4 | „Dein Kontingent" | — | Drei Stufen, drei Zähler. Das Monatskontingent startet am 1. neu, Zugekauftes verfällt nie. |
| 5 | Reiter Objekt, Box Marktbericht abrufen | Stufen-Pillen | An jeder Stufe steht, wie viele Bewertungen noch frei sind. |
| 6 | Account & Sicherheit | Zwei-Faktor | Zwei-Faktor einschalten — dein Portfolio geht niemanden sonst etwas an. |

### Sprechertext (Entwurf, ca. 75 Sekunden)

Bevor es losgeht, brauchst du ein Ticket. Bei DealPilot ist das dein Konto: E-Mail, Passwort, fertig. Du bist sofort im Cockpit und kannst dein erstes Objekt anlegen. Die Bestätigungsmail holst du in Ruhe nach — du hast dafür sechs Stunden.

Die ersten vier Wochen fliegst du in der Pro-Klasse. Dazu bekommst du ein eigenes Testpaket: fünf Marktpreisindikationen, drei erweiterte Marktberichte und eine vollständige Wertermittlung nach ImmoWertV. So kannst du genau das ausprobieren, worauf es später ankommt.

Was eine Bewertung verbraucht, zählt dein Kontingent. Es ist nach Stufen getrennt, und du siehst den Stand an zwei Stellen: in den Einstellungen unter Plan und direkt im Reiter Objekt, an jeder Stufe. Das Monatskontingent beginnt am Ersten neu. Was du dazukaufst, verfällt nie.

Die Pilot-Analyse ist im Plan enthalten und zieht nichts ab.

Und noch ein Handgriff für die Sicherheit: Unter Account und Sicherheit schaltest du die Zwei-Faktor-Anmeldung ein. Dann bleibt dein Portfolio deins. Bereit zum Boarding.

## Querverweise

- [02 · Neues Objekt anlegen](02-neues-objekt-anlegen.md)
- [04 · Reiter Objekt](04-reiter-objekt.md) — Box Marktbericht abrufen
- [17 · Abruf „Marktpreise"](17-abruf-marktpreise.md) — verbraucht MPI+
- [19 · Marktbericht](19-marktbericht.md)
- [26 · Einstellungen, Standardwerte, Investmentprofil](26-einstellungen-standardwerte-investmentprofil.md)
- [31 · Whitelabel und Partner (intern)](31-whitelabel-partner-intern.md)
- [32 · Datenschutz und Server](32-datenschutz-und-server.md)
