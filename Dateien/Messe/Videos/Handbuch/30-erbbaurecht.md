# 30 · Erbbaurecht — rechnen statt raten

> Stand 20.10.2026 (Staging bis v2544). Zahlen vor der Messe live gegenprüfen.
> Video: noch kein Video (Kandidat „Erbbaurecht" in Videoreihe.md) · Messe-Geschichte: — (kein Demo-Objekt mit Erbbaurecht im Konto)

## 1 · Wozu

Bei einem Erbbaurecht gehört das Grundstück nicht mit — du zahlst Erbbauzins. Jede Marktbewertung, die du für so ein Objekt holst, liefert aber den Wert **wie Volleigentum**: die Bewertungsdienste kennen das Erbbaurecht nicht. Wer diesen Wert gegen den Kaufpreis hält, vergleicht Äpfel mit Birnen. DealPilot rechnet deshalb den **Erbbaurechts-Abschlag nach § 50 ImmoWertV** und zieht ihn ab, bevor Wertpuffer, Wertsteigerung und Deal Score daraus rechnen. Den Erbbauzins führt DealPilot im Cashflow mit.

## 2 · Wo in der App

- **Reiter Objekt**, Bereich Grund & Boden: Haken **„Erbbaurecht / Erbpacht"** — „Das Grundstück gehört nicht mit — es wird gegen Erbbauzins überlassen." Dann erscheinen:
  - **Erbbauzins (€ pro Jahr)**
  - **Restlaufzeit (Jahre)** (steht im Erbbaurechtsvertrag)
  - **Angemessener Erbbauzinssatz (%)**
  - **Entschädigung bei Zeitablauf (%)**
  - Haken „Verkehrswert / Bankbewertung ist bereits der Erbbaurechtswert (dann nicht noch einmal kürzen)"
- **Ergebniskarte „Erbbaurechts-Abschlag nach § 50 ImmoWertV"** darunter:
  - Wert wie Volleigentum (mit Angabe, welche Zahl gelesen wurde: Verkehrswert, Bankbewertung oder Kaufpreis)
  - − Bodenwert (gehört dem Erbbaurechtsgeber)
  - ± Vorteil aus günstigem / Nachteil aus hohem Erbbauzins
  - − Gebäude fällt am Ende teils entschädigungslos heim
  - = **Erbbaurechtswert**, **Abschlag gegenüber Volleigentum** in € und %
  - Zeile mit den Annahmen (angemessener Zins, Kapitalisierung, Restnutzungsdauer, Entschädigung); wo vorhanden „Am Markt beobachtet bei …: von–bis %" mit „die Rechnung liegt darin / daneben".
- Oben beim Wertpuffer: Zeile **„davon Erbbaurechts-Abschlag (§ 50 ImmoWertV)"**.
- **Reiter Bewirtschaftung:** „davon Erbbauzins" (nicht umlagefähig, steuerlich abziehbar).

## 3 · Schritt für Schritt — Beispiel (kein Demo-Objekt mit Erbbaurecht; an einer Kopie zeigen)

| Feld | Wert | Herkunft |
|---|---|---|
| Haken Erbbaurecht / Erbpacht | an | — |
| Erbbauzins (€ pro Jahr) | aus dem Erbbaurechtsvertrag | Vertrag (der Platzhalter im Feld zeigt „1.800" — nur ein Muster) |
| Restlaufzeit (Jahre) | aus dem Vertrag | Vertrag |
| Angemessener Erbbauzinssatz (%) | leer oder eigener Wert (Platzhalter „3,5") | Gutachterausschuss / eigene Angabe |
| Entschädigung bei Zeitablauf (%) | aus dem Vertrag | Vertrag |
| Grundstücksfläche, Bodenrichtwert | wie im Reiter Objekt (BORIS-Abruf direkt darüber) | für den Bodenwert |
| Verkehrswert / Bankbewertung / Kaufpreis | mindestens eine Zahl | Wert wie Volleigentum |

Was die App zeigt: die Abschlagsrechnung Zeile für Zeile; fehlt etwas, steht „Erbbaurechts-Abschlag lässt sich noch nicht rechnen" mit der Liste — ein Wert zum Rechnen, der Bodenwert, die Restlaufzeit — und „Der Erbbauzins läuft trotzdem schon im Cashflow mit". Alle Euro-Beträge live zeigen.

**Belegt:** Felder und Texte aus `index.html` Z. 1079–1085 und 1313–1325, `erbbau-ui.js` (Ergebniskarte, Fehltexte) und `erbbau-engine.js` (Kopf: § 50 ImmoWertV, Formel). Keine Zahl im Messe-Konto gemessen.

## 4 · Was man daraus liest — Fragen am Stand

- **„Warum ist das Erbbau-Objekt so billig?"** — Weil das Grundstück nicht mitkommt und am Ende das Gebäude teils entschädigungslos heimfällt. DealPilot zeigt, wie viel das in Euro ausmacht.
- **„Mein Marktwert ist doch viel höher."** — Der Marktwert ist ein Volleigentumswert. Erst nach dem Abschlag ist er mit deinem Kaufpreis vergleichbar.
- **„Niedriger Erbbauzins — gut oder schlecht?"** — Gut: zahlst du weniger als angemessen, mindert der Vorteil den Abschlag. Zahlst du mehr, wächst er.

## 5 · Grenzen und Kennzeichnung

- Finanzmathematischer Wert nach § 50 ImmoWertV — **keine Verkehrswertermittlung** des Erbbaurechts, keine Marktanpassung durch einen Gutachter.
- Ist der eingetragene Verkehrswert schon ein Erbbaurechtswert (z. B. aus einem Gutachten), den Haken setzen — sonst würde doppelt gekürzt.
- Nach außen keine Namen der Bewertungsdienste; es heißt „unabhängige Bewertungspartner".

## 6 · Für das Video

### Szenen

| Nr | Bild | Klick | Erklärkarte (≤ 25 Wörter) |
|---|---|---|---|
| 1 | Reiter Objekt, Grund & Boden | Haken Erbbaurecht | Grundstück gepachtet statt gekauft? Ein Haken — und DealPilot rechnet das Erbbaurecht. |
| 2 | Felder Erbbauzins, Restlaufzeit, Entschädigung | eintragen | Erbbauzins, Restlaufzeit, Entschädigung: alles steht im Erbbaurechtsvertrag. |
| 3 | Ergebniskarte § 50 | — | Marktwerte sind Volleigentum. DealPilot zieht Bodenwert und Heimfall ab und rechnet den Zinsvorteil gegen. |
| 4 | Wertpuffer mit Zeile „davon Erbbaurechts-Abschlag" | — | Erst nach dem Abschlag ist der Wert mit deinem Kaufpreis vergleichbar. |
| 5 | Reiter Bewirtschaftung, „davon Erbbauzins" | — | Der Erbbauzins läuft im Cashflow mit — nicht umlagefähig, steuerlich abziehbar. |

### Sprechertext (Entwurf, ca. 65 Sekunden)

Ein Erbbaurecht sieht im Inserat oft günstig aus. Kein Wunder: Das Grundstück gehört nicht dazu, du zahlst Erbbauzins.

Das Problem: Jede Marktbewertung liefert den Wert, als würde dir alles gehören. Wer den gegen den Kaufpreis hält, rechnet sich das Objekt schön.

In DealPilot setzt du im Reiter Objekt den Haken Erbbaurecht und trägst ein, was im Vertrag steht — Erbbauzins, Restlaufzeit, Entschädigung am Ende. DealPilot rechnet den Abschlag nach Paragraf fünfzig der Immobilienwertermittlungsverordnung: Bodenwert runter, Zinsvorteil oder -nachteil dazu, und der Teil des Gebäudes, der am Ende ohne Entschädigung zurückfällt.

Erst dann ist der Wert mit deinem Kaufpreis vergleichbar. Und der Erbbauzins läuft im Cashflow mit.

## Querverweise

- Handbuch 04 (Reiter Objekt, Bodenrichtwert), 09 (Bewirtschaftung), 15 (Deal Score, Wertpuffer)
