# Sprechlauf: vom Monolog zum Dialog

**Marcels Punkt 5:** *„Chatbot-Dialog statt Monolog, mit Demo."*
Stand 09.09.2026 · Demo: `sprechlauf-dialog-demo.html`

---

## Was heute passiert (gemessen, nicht angenommen)

1. Fenster auf, Aufnahme läuft sofort, bis zu **4 Minuten**.
2. Während des Sprechens: Live-Transkription (`/ai/transcribe-chunk`) und
   eine grobe Vorschau, welche Stichwörter erkannt sind
   (`/ai/voice-quickmatch`, kleines Modell).
3. „Weiter — auswerten" schickt Audio **und** den Laufzeit-Feldkatalog an
   `/ai/extract-voice`.
4. Es erscheint eine Tabelle mit den gefundenen Werten, angehakt.
   Übernehmen — fertig.

**Der Bruch liegt zwischen 3 und 4.** Wer etwas vergisst, erfährt es erst
in der Tabelle: dort fehlt eine Zeile. Was fehlt, muss er selbst sehen,
selbst nachtragen, selbst eintippen. Der Co-Pilot sagt nichts.

**Was fehlt, ist bekannt:** die App führt **22 Pflichtfelder**
(`label.dp-required`), darunter PLZ, Ort, Straße, Wohnfläche, Baujahr,
Zustand, Kaufpreis, Nettokaltmiete, Darlehenssumme, Zinssatz, Tilgung.
Ohne sie rechnet die App nicht zu Ende — genau die Liste, aus der sich
Rückfragen bilden lassen.

---

## Die Entscheidung, die Marcel treffen muss

Es gibt zwei ehrliche Wege, und sie fühlen sich völlig verschieden an.

### Variante A · Frei sprechen, dann nachfragen

Der Sprechlauf bleibt, wie er ist. **Nach** der Auswertung meldet sich der
Co-Pilot mit dem, was noch fehlt — höchstens drei Fragen auf einmal,
beantwortbar per Sprache oder Tippen. Danach: Tabelle wie gehabt.

**Dafür:** Der Redefluss bleibt ungestört; wer alles weiß, ist nach einem
Durchgang fertig. Kleiner Umbau, das meiste steht schon.
**Dagegen:** Wer wenig weiß, führt trotzdem erst einen Monolog.

### Variante B · Der Co-Pilot führt durch

Kein freies Diktat mehr als Einstieg, sondern ein Gespräch von der ersten
Sekunde an: *„Wo steht das Objekt?"* → Antwort → *„Was soll es kosten?"* →
Antwort. Der Co-Pilot fragt Block für Block, quittiert jede Antwort und
zeigt den Fortschritt.

**Dafür:** Niemand muss wissen, was DealPilot hören will. Für den ersten
Deal eines neuen Kunden deutlich freundlicher.
**Dagegen:** Für den geübten Nutzer **langsamer** als ein Diktat. Und es
ist der große Umbau: Fragenreihenfolge, Sprungmarken, Abbruch,
Wiederaufnahme — plus je Antwort ein KI-Aufruf.

### Variante C · Beides, mit einer Frage am Anfang

Beim Öffnen zwei Knöpfe: **„Ich erzähle frei"** oder **„Frag mich durch"**.
Der freie Weg endet in den Rückfragen aus A, der geführte ist B.

> **Empfehlung: erst A bauen, C als Ziel.** A ist der kleine Schritt mit
> dem größten sofortigen Nutzen — die Lücken werden gefüllt, ohne dass
> irgendjemand seine Gewohnheit ändern muss. B lohnt sich, sobald es
> **fremde** Nutzer gibt; heute nutzt den Sprechlauf im Wesentlichen
> Marcel, und der weiß, was er sagen muss.

---

## Wie die Rückfragen entstehen (Variante A im Detail)

**1 · Welche Frage überhaupt?** Nach der Auswertung wird geprüft, welche
Pflichtfelder leer geblieben sind. Aus jedem leeren Feld wird **eine**
Frage — die Formulierung steht schon im Frontend (`EXPLAIN`, und die
Freitextfelder tragen seit `v1259` bereits echte Fragen wie „Was wird
mitverkauft?").

**2 · Höchstens drei auf einmal.** Mehr liest niemand. Die Reihenfolge
folgt dem Gewicht für die Rechnung:

| Rang | Feld | warum zuerst |
|---|---|---|
| 1 | Kaufpreis | ohne ihn keine einzige Kennzahl |
| 2 | Nettokaltmiete | ohne sie kein Cashflow, kein DSCR |
| 3 | Wohnfläche | ohne sie kein €/m², kein Vergleich |
| 4 | Baujahr | steuert AfA und Restnutzungsdauer |
| 5 | Adresse | ohne sie kein Bodenrichtwert, kein Marktbericht |
| 6 | Zinssatz / Tilgung | Finanzierung; Standardwerte greifen sonst |

**3 · Antworten darf man, wie man will.** Tippen oder sprechen. Eine
gesprochene Antwort ist kurz — 3 bis 8 Sekunden —, also eine kleine
Transkription plus eine kleine Extraktion.

**4 · „Weiß ich nicht" ist eine Antwort.** Sie beendet die Frage
endgültig; sie kommt in dieser Aufnahme nicht wieder. Alles andere wäre
eine Schleife.

**5 · Der Dialog endet**, wenn alle Pflichtfelder stehen, wenn der Nutzer
„Fertig" drückt, oder **nach zwei Runden ohne Fortschritt**. Ein Assistent,
der nicht aufhören kann, wird abgeschaltet.

---

## Was es kostet

Eine volle Aufnahme kostet heute **rund 1,7 Cent** (4 Minuten, warmer
Zwischenspeicher; mit dem kleinen Transkriptionsmodell **0,9 Cent**).

Eine Antwortrunde ist um Größenordnungen kleiner: 5 Sekunden Audio statt
240, und der Feldkatalog schrumpft von 250 Einträgen auf die drei
gefragten. **Geschätzt 0,05 bis 0,1 Cent je Runde** — bei drei Runden
weniger als ein Zehntel der Aufnahme selbst.

> **Geschätzt, nicht gemessen.** Die Zahl steht hier als Annahme, weil es
> die Runde noch nicht gibt. Sobald sie läuft, liefert `?kosten=1` den
> echten Wert, und diese Zeile wird ersetzt.

Variante B dagegen: **je Antwort** ein Aufruf, bei 12 Pflichtfeldern also
zwölf statt einem. Auch das bleibt unter zwei Cent — aber es ist der
Unterschied zwischen einem Aufruf und einem Dutzend.

---

## Was gebaut werden müsste (Variante A)

| Stück | Aufwand | Anmerkung |
|---|---|---|
| Lückenprüfung nach der Auswertung | klein | die Pflichtfeldliste steht im DOM |
| Fragen-Ansicht im Sprechlauf-Fenster | mittel | eigener Zustand nach „auswerten" |
| Kurzaufnahme je Antwort | klein | die Aufnahmetechnik ist da |
| Endpunkt für Kurzantworten | klein | `/ai/extract-voice` mit Mini-Katalog |
| Zusammenführen in die Tabelle | klein | die Tabelle existiert |

**Kein neues Modell, keine neue Migration, kein neuer Dienst.** Alles, was
gebraucht wird, ist vorhanden — es fehlt der Zustand zwischen Auswertung
und Tabelle.

---

## Offene Fragen an Marcel

1. **A, B oder C?** (Empfehlung: A jetzt, C als Ziel)
2. **Sollen die Rückfragen auch Widersprüche ansprechen** — etwa eine
   Miete, die für die Fläche ungewöhnlich hoch ist? Das ist der Schritt vom
   Ausfüllhelfer zum Berater, und es ist der Punkt, an dem der Co-Pilot
   anfängt, seinem Namen gerecht zu werden. Aber er darf dabei nie
   behaupten, was er nicht weiß.
3. **Darf der Co-Pilot Vorschläge machen?** „Zinssatz nicht gesagt — soll
   ich 3,8 % aus deinem Investmentprofil nehmen?" Das wäre schnell, birgt
   aber die Gefahr, dass Zahlen im Deal landen, die niemand geprüft hat.
