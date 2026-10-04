# Prüfstrecke für den Portfolio-Agenten

Fünf Läufer, die **im Container** laufen — nur dort sehen sie dieselben
Module, dieselbe Datenbank und denselben Modellzugang wie die laufende
Maschine.

```bash
scp tools/agent-pruefung/pruef-gesamt.js root@116.203.214.11:/tmp/
ssh root@116.203.214.11 'docker cp /tmp/pruef-gesamt.js dealpilot-backend:/tmp/ \
  && docker exec dealpilot-backend node /tmp/pruef-gesamt.js'
```

| Läufer | prüft | Modell? |
|---|---|---|
| `pruef-aktionen.js` | die **Werkzeuge** einzeln: Objektbezug, Auswahlfelder, Schreibsperren | nein |
| `pruef-zahlen.js` | Zahlentreue, **mehrfach dieselbe Frage** | ja |
| `pruef-anlage.js` | was bei der Anlage **wirklich im Datensatz** landet | ja |
| `pruef-gesamt.js` | Marcels eigene Sätze von A-2 bis A-8, inkl. Geldsperre | ja |
| `pruef-agent.js` | die fünf Portfolio-Fragen aus der Spezifikation | ja |

## Was diese Läufer anders machen

**Sie prüfen das Tun, nicht den Klang.** Jeder protokolliert, **welche
Werkzeuge** der Agent gewählt hat. Eine schöne Antwort aus der falschen
Quelle ist der gefährlichere Fehler — und sie liest sich besser als eine
richtige.

**Sie fragen mehrfach.** Der Cent-Fehler (`472.157,90` statt `4.721.579`)
trat nur gelegentlich auf.

> Ein Fehler, der jedes dritte Mal auftritt, besteht jeden Einzeltest.

**Sie räumen auf.** Was ein Lauf anlegt, löscht er wieder. Ein Prüfer, der
Spuren hinterlässt, verfälscht den nächsten Lauf.

**Sie nennen ihre Deckung.** Am Ende steht, wie viele Proben liefen und
wie viele fehlschlugen — „alles grün" ohne Zahl ist kein Befund.

## Zwei Prüferfehler, die hier schon passiert sind

Beide standen im Ergebnis als *Produktfehler* — und waren keine:

1. **„Auswahlwerte reisen bei den Lücken nicht mit."** Der Testfall hatte
   `objart` bereits gefüllt, also fiel das einzige Auswahlfeld der ersten
   Blöcke aus der Lückenliste. Der Code war richtig.
2. **„Vergleichsfrage ohne `portfolio_lesen`."** Der Agent hatte einen
   anderen, teureren Weg genommen (sechs Aufrufe statt einem) und das
   **richtige** Ergebnis geliefert. Falsch war der Preis, nicht die
   Antwort — und der Maßstab des Prüfers.

> Bevor ein Prüfer den Code beschuldigt, muss er sich selbst verdächtigen.
