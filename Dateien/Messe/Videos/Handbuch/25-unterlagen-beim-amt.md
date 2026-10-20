# 25 · Unterlagen beim Amt anfordern

> Stand 20.10.2026 (Staging bis v2544). Zahlen nachgezogen nach der Befüllung vom 20.10.2026 (README, „Stand der Zahlen").
> Video: Modul 24 · Bodenrichtwert und Unterlagen (`reihe-brw-unterlagen`, `?modul=24`, 2:38) ·
> Messe-Geschichte: 14 „Unterlagen beim Amt per Telegram" (design/Messe/demo-geschichten.md)

## 1 · Wozu

Vor dem Kauf und für die Bank brauchst du Papiere, die nur Ämter haben: Grundbuchauszug, Flurkarte, Bauakte, Baulasten- und Altlastenauskunft und den Grundstücksmarktbericht des Gutachterausschusses. DealPilot sagt dir **für die Adresse deines Objekts**, welches Amt zuständig ist, über welchen Kanal du es erreichst, was es kostet und — wo belegt — wer dein Ansprechpartner ist. Den Brief schreibt DealPilot als Entwurf. **Verschicken tust du selbst.**

## 2 · Wo in der App

- **Reiter Objekt** → Box „Parameter der Verkehrswertermittlung" → Bereich **Anfragen** → **Unterlagen beim Amt anfordern** (`index.html` Z. 1181).
- **Reiter Deal-Aktion** → **Bordkarte & Unterlagen** → **Unterlagen beim Amt anfordern** (`deal-action-boarding.js` Z. 166).
- **Telegram-Bot:** `/unterlagen` oder „Unterlagen für Objekt 3 anfordern" (Handbuch 24).
- Die sechs Unterlagen (`backend/src/services/unterlagenService.js`, `ARTEN`):
  1. Grundstücksmarktbericht (Gutachterausschuss) — Liegenschaftszinssätze, Sachwertfaktoren
  2. Flurkarte
  3. Grundbuchauszug
  4. Altlastenauskunft
  5. Baulastenauskunft
  6. Bauakte
- Im Fenster je Amt: Kanal (Portal, E-Mail, Post), Empfänger mit Belegstand, Portal-Link, Telefon, Gebühr, **zwei Ansprechpartner-Karten nebeneinander** (Name, Funktion, Telefon, E-Mail, Belegstand „Name auf der Seite", Beleg-Seite, Kopie-Haken), Empfänger im Briefkopf wählbar.

## 3 · Schritt für Schritt — Beispiel Gohliser Str. 42, Leipzig (MFH)

| Schritt | Klick | Was die App zeigt |
|---|---|---|
| 1 | Reiter Objekt → Anfragen → Unterlagen beim Amt anfordern | Übersicht der sechs Unterlagen mit dem zuständigen Amt (für Leipzig liegen Ämter vor — gemeindeweiter Satz) |
| 2 | Grundbuchauszug | Amt, Kanal, Gebühr; Ansprechpartner-Karten mit „Name auf der Seite · Beleg-Seite", wo eine Person belegt ist |
| 3 | Entwurf anlegen | Anschreiben mit Betreff und Brief, Vorgang steht auf „Entwurf vom …" |
| 4 | Brief kopieren, selbst verschicken | DealPilot verschickt nichts |
| 5 | „verschickt" melden | Vorgang steht auf „schon angefragt am …" |

Wo für eine Gemeinde noch kein Amt bekannt ist, steht das ehrlich da („noch nicht ermittelt"); die Suche im Fenster (auch „Neu suchen") lässt die Ämter recherchieren; übernommen wird nur, was an der amtlichen Seite belegt ist.

**Belegt:** Arten aus `unterlagenService.js` Z. 46 ff.; zwei Karten, Belegstand und Leipzig 04155 mit gemeindeweitem Satz aus Journal v2440–v2445; Ablauf Entwurf → „verschickt" → gesendet und Gohliser Str. 42 mit 6 Ämtern aus Journal v2470–v2472. Gebühren, Namen und Kanäle live zeigen.
**Modul 24 (16.10.)** zeigte für Bielefeld „6 von 6 noch nicht ermittelt" — seither wurden am 19.10. **342 Ämter** eingespielt (Staging 369, 104 mit Ansprechpartner). Was für die Westerfeldstr. 140 jetzt steht: live zeigen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Woher kennt ihr den Ansprechpartner?"** — Ein Name wird nur angezeigt, wenn er auf einer selbst gelesenen Seite des Amts steht. Die Karte nennt die Beleg-Seite.
- **„Schickt ihr das für mich ab?"** — Nein. DealPilot schreibt den Entwurf, du schickst ihn selbst und unter deinem Namen.
- **„Was kostet das?"** — Die Gebühr des Amts steht dabei. Die Suche in DealPilot kostet heute kein Kontingent.
- **„Warum der Gutachterausschuss?"** — Für Stufe 3 der Wertermittlung zählen dessen Liegenschaftszins und Sachwertfaktor. Fehlt einer, ist das hier der Weg zur Zahl.

## 5 · Grenzen und Kennzeichnung

- **Kein Versand** durch DealPilot — nur Entwurf und Vorgangsstand.
- Zuständigkeiten werden recherchiert und am Beleg geprüft; wo die Zuständigkeit geteilt ist (z. B. Grundbuch Berlin, Hamburg), schreibt DealPilot keinen gemeindeweiten Satz.
- Ohne Kontingent ist eine Produktentscheidung, die Marcel noch offen hält (Journal v2470).
- Für einige Orte gibt es keine amtliche Seite zur Bauakte (z. B. Kabelsketal) — dann steht das so da.

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Objekt, Box Parameter, „Anfragen" | Unterlagen beim Amt anfordern | Grundbuch, Flurkarte, Bauakte — DealPilot kennt das zuständige Amt für die Adresse. |
| 2 | Übersicht sechs Unterlagen | — | Sechs Unterlagen, je Amt mit Kanal, Gebühr und Link. |
| 3 | Zwei Ansprechpartner-Karten | — | Ansprechpartner nur, wenn der Name auf der Seite des Amts steht — mit Beleg. |
| 4 | Entwurf | Entwurf anlegen | Der Brief steht fertig da. Kopieren, unterschreiben, verschicken. |
| 5 | Vorgangsstand | — | DealPilot merkt sich: Entwurf vom … — schon angefragt am … |

### Sprechertext (Entwurf, ca. 65 Sekunden)

Ohne Papiere kein Kauf. Grundbuchauszug, Flurkarte, Bauakte, Baulasten, Altlasten — und für die Wertermittlung der Grundstücksmarktbericht des Gutachterausschusses.

Im Reiter Objekt öffnest du „Unterlagen beim Amt anfordern". DealPilot zeigt dir für die Adresse deines Objekts das zuständige Amt, den Weg dorthin und die Gebühr. Wo ein Ansprechpartner auf der Seite des Amts steht, siehst du ihn — mit Beleg.

Ein Klick, und der Brief steht als Entwurf da. Kopieren, unterschreiben, abschicken. Das machst du selbst, DealPilot verschickt nichts. Aber es merkt sich, was du schon angefragt hast — damit nichts doppelt rausgeht und nichts vergessen wird.

## Querverweise

- Handbuch 04 (Reiter Objekt, Parameter der Verkehrswertermittlung), 21 (Deal-Aktion, Bordkarte), 24 (Telegram), 19 (Marktbericht, Weg zum Ausschuss)
- Videoreihe.md Modul 24 · `messe-drehbuch.js` `DREHBUECHER['reihe-brw-unterlagen']` (Z. 4465)
