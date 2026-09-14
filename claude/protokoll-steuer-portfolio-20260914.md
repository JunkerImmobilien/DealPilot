# Protokoll · Wie DealPilot die Steuer über mehrere Objekte rechnet

**Stand 14.09.2026, Versionen v1397 / v1398 / v1399.** Alle Zahlen hier sind
gegen den echten `tax.js`-Tarifkern und den echten Registerweg gerechnet, im
Container — nicht überschlagen.

Anlass: Marcels Frage zum Hinweistext im Tab Steuern — *„warum steht das noch
drin? wollten wir das nicht ändern?"* — und die Anschlussfragen: was trägt die
App beim zweiten und dritten Objekt ein, wie sieht der Kunde das, kann er es
ändern, wie wird er benachrichtigt, ist das sicher.

---

## 1 · Was vorher war, und warum es geändert wurde

Der Text behauptete, die Objekte verschöben sich gegenseitig nicht die
Progression. **Das stimmte seit V276 nur noch zur Hälfte** — und das war der
eigentliche Fund:

| Stelle | rechnete | Beleg |
|---|---|---|
| `tax.js` (Tab Steuern) | **saldiert** — `baseIncome + Bestandssaldo`, dann die Tarifdifferenz | `tax.js:541` |
| `calc.js` (Cashflow, KPI, Cockpit) | **nicht saldiert** | Kommentar V258-07 |

In `calc.js` stand der Grund wörtlich im Code: *„Effektives zvE ohne Immobilie
+ WK anderer Objekte **(nur Display)** … Eigentliche Steuerberechnung weiterhin
auf K.zve_immo basiert."* Die Zahl wurde ermittelt, angezeigt — und nicht
gerechnet.

**Dieselbe App wies für dasselbe Objekt zwei verschiedene Steuerwirkungen
aus**, und die Summe im Portfolio-Cockpit hing an der ungenaueren von beiden.

---

## 2 · Wie es jetzt rechnet — Schritt für Schritt

Für jedes Objekt, in dieser Reihenfolge:

1. **Ausgangspunkt ist dein zvE** aus dem Profil (`DealPilotZvE`), ersatzweise
   das Feld im Tab Steuern.
2. **Die Ergebnisse aller früher gekauften Objekte werden addiert.** „Früher"
   heißt: Kaufdatum *vor* dem dieses Objekts, und im betrachteten Jahr bereits
   bestehend. Die Werte stammen aus `wk_per_year` — dem Überschuss oder Verlust
   aus Vermietung und Verpachtung, den jedes Objekt beim Rechnen selbst
   hinterlegt.
3. **Diese Summe verschiebt die Basis.** Verluste senken sie, Überschüsse heben
   sie. Unter null geht es nicht — ein negatives zvE kennt der Tarif nicht.
4. **Die Steuerwirkung ist die Differenz zweier Tarifberechnungen** nach
   § 32a EStG auf dieser verschobenen Basis: einmal mit, einmal ohne das
   Ergebnis dieses Objekts.
5. **Daraus entsteht der Cashflow nach Steuer** — und der wird im Cockpit
   addiert.

**Der Rechenweg liegt an genau einer Stelle** (`window._dpBestandSaldo` in
`tax.js`), die `calc.js` mitbenutzt. Dort sitzt auch der Kaufdatums-Filter.

> Die zweite Aggregator-Funktion `getWKForOtherObjects` filtert das Kaufdatum
> **nicht** — wer sie für eine neue Rechenstelle greift, bekommt eine andere
> Zahl als der Tab Steuern. Vor dem Aufruf den Filter lesen, nicht den Namen.

---

## 3 · Was beim 2. und 3. Objekt konkret eingetragen wird

**Gerechnetes Beispiel** — Profil-zvE 80.000 €, Tarif 2026, drei Objekte:

| Obj | gekauft | Ergebnis | Saldo der Vorobjekte | **wirksame Basis** | Steuerwirkung | eff. Satz | Feld „Grenzsteuersatz" |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | 03/2024 | −25.000 € | 0 € | **80.000 €** | 10.117 € | 40,47 % | 42,00 % |
| 2 | 06/2025 | −20.000 € | −25.000 € | **55.000 €** | 6.677 € | 33,38 % | 42,00 % |
| 3 | 01/2026 | −15.000 € | −45.000 € | **35.000 €** | 4.100 € | 27,33 % | 42,00 % |

**Summe der drei Einzelwirkungen: 20.894 €. Echte Portfoliowirkung: 20.894 € —
identisch.** Das ist der Punkt: die Teleskopsumme geht auf, die Summe im
Cockpit *ist* jetzt die richtige Zahl.

**Vorher wären es 24.607 € gewesen — 17,77 % zu viel.**

### Das zvE

Das Feld „Ausgangs-zvE" zeigt weiter **dein volles zvE** (80.000 €). Die
Verschiebung steht **separat daneben** in der Kachel „Überschuss/Verlust V+V
(aktueller Bestand)" — beim zweiten Objekt also −25.000 €, beim dritten
−45.000 €. Beide Zahlen stehen nebeneinander; keine wird stillschweigend
ersetzt.

### Der Steuersatz

Das Feld **„Grenzsteuersatz" zeigt bei allen drei Objekten 42,00 %.** Das ist
Absicht: es ist **dein persönlicher Satz** auf dein volles Einkommen, und danach
fragt das Feld.

**Der tatsächlich wirkende Satz ist ein anderer** — 40,47 / 33,38 / 27,33 %.
Auf der wirksamen Basis läge der Grenzsatz bei 42,00 / 37,00 / 30,10 %.

Damit diese Abweichung nicht unerklärt dasteht:

- Die Karte **„Dein Steuersatz wurde angepasst"** erscheint automatisch, sobald
  sich effektiver und eingetragener Satz um mehr als 0,5 Prozentpunkte
  unterscheiden — bei allen drei Objekten also.
- Seit v1398 sagt der **Tooltip am Grenzsatz-Feld**, dass dieses Objekt auf
  einer verschobenen Basis rechnet, und um wie viel.

---

## 4 · Wie der Kunde das sieht

Vier Stellen, alle im Tab Steuern:

| Was | Wo | Zeigt |
|---|---|---|
| **Ausgangs-zvE** | Kachel oben links | dein volles zvE |
| **Überschuss/Verlust V+V (aktueller Bestand)** | Kachel daneben | den Saldo; **anklickbar** → Liste aller eingeflossenen Objekte mit Name, Kaufdatum und Betrag, sortier- und durchsuchbar |
| **„Dein Steuersatz wurde angepasst"** | Karte, erscheint automatisch | eingetragener gegen tatsächlichen Satz, den Euro-Unterschied, und seit v1397 einen Satz, der die verschobene Basis beziffert |
| **„Was mit diesen Werten passiert"** | Karte darunter | die Erklärung, aufklappbar unter „Wie die Objekte zusammen gerechnet werden" |

Bei bis zu fünf Vorobjekten steht die Liste direkt aufklappbar in der Kachel;
darüber öffnet ein Klick das Overlay.

---

## 5 · Kann er es ändern?

| Größe | änderbar | wie |
|---|---|---|
| **zvE** | **ja** | Feld im Tab Steuern, Profil, und eine **Historie** mit Gültigkeitsdaten (`DealPilotZvE`) |
| **Grenzsteuersatz** | **ja** | Haken „automatisch" entfernen, dann ist das Feld frei |
| **Welche Objekte einfließen** | **nur indirekt** | über das Kaufdatum und darüber, ob das Objekt gespeichert ist |
| **Die Saldierung selbst** | **nein** | es gibt keinen Schalter „getrennt rechnen" |
| **Die Reihenfolge** | **nein** | sie ist der Kaufzeitpunkt |

> **Das ist eine bewusste Festlegung, keine Auslassung.** Die *Summe* über das
> Portfolio ist eindeutig; welcher Anteil davon *welchem* Objekt zugerechnet
> wird, ist eine Konvention. Gewählt ist der Kaufzeitpunkt — das früher gekaufte
> Objekt bekommt die erste, wirksamere Stufe der Progression. Das entspricht der
> Anschauung („mein erstes Objekt") und dem, was `tax.js` seit V276 ohnehin tat.
>
> **Offen als Produktfrage:** ob der Kunde einen Schalter bekommen soll, der die
> Einzelbetrachtung zeigt — also jedes Objekt für sich, wie vor v1397. Das wäre
> ein Vergleichsmaßstab, brächte aber wieder zwei Zahlen für dieselbe Sache.

---

## 6 · Wie wird benachrichtigt?

**Ehrlich: es gibt keine aktive Benachrichtigung.** Kein Toast, keine Meldung,
keine E-Mail, wenn ein neues Objekt die Rechnung der anderen verschiebt.

Was es gibt, ist **passive Sichtbarkeit**: die Karte „Dein Steuersatz wurde
angepasst" erscheint von selbst, sobald die Abweichung über 0,5 Prozentpunkten
liegt, und die Bestandskachel zeigt den Saldo dauerhaft an. Einen Toast gibt es
nur beim Umschalten der Grenzsatz-Automatik.

**Was das bedeutet:** Legt der Kunde ein viertes Objekt an, ändern sich die
Zahlen der später gekauften Objekte — **beim nächsten Öffnen**, ohne dass er
darauf hingewiesen wird. Wer das Cockpit offen hat, sieht es erst nach dem
Neuladen.

> **Das gehört in den Backlog**, wenn es stören soll: ein Hinweis „Durch das
> neue Objekt haben sich N andere Objekte verändert" wäre machbar — die
> Datengrundlage (`totals_per_year` im WK-Aggregator) liegt vor.

---

## 7 · Ist das sicher?

### Was gemessen ist

**Acht Prüffälle gegen den echten Tarifkern, alle treffen auf den Cent** — die
Summe der Einzelbetrachtungen ist identisch mit der echten Portfoliozahl:

| zvE | Objekte | alt | neu = wahr | alt war |
|---|---|---:|---:|---:|
| 80.000 € | −25.000 / −20.000 | 18.348 € | 16.794 € | +9,25 % |
| 80.000 € | 3 × −15.000 | 18.777 € | 16.794 € | +11,81 % |
| 60.000 € | 2 × −20.000 | 14.048 € | 12.663 € | +10,94 % |
| 120.000 € | 2 × −30.000 | 25.200 € | 25.031 € | +0,68 % |
| 150.000 € | 2 × −40.000 | 33.600 € | 33.600 € | — |
| **45.000 €** | **−30.000 / −25.000** | **15.665 €** | **8.835 €** | **+77,31 %** |
| 80.000 € | +12.000 / −20.000 | 3.191 € | 3.360 € | **−5,03 %** |
| 80.000 € | ein Objekt | 10.117 € | 10.117 € | — |

**Zwei Fälle, die der alte Befund nicht kannte:** Übersteigen die Verluste das
zvE, lag die alte Rechnung **77 % zu hoch** — weit jenseits der 9 bis 12 %, die
bis dahin als Spanne galten. Und bei **gemischten** Ergebnissen (ein Überschuss,
ein Verlust) ging der Fehler in die **andere** Richtung. Die Aussage „der Fehler
geht immer in dieselbe Richtung" galt nur für reine Verlustportfolios.

**Ein einzelnes Objekt ändert sich nicht.** Der Normalfall bleibt, wie er war.

### Was abgesichert wurde

- **Der Saldo kommt zu spät (v1398).** `_dpBestandSaldo` liest nur den Cache.
  Läuft die Rechnung, bevor er geladen ist — beim ersten Öffnen der Regelfall —
  kommt 0 zurück und der Cashflow fällt **zu gut** aus. `tax.js` hatte dafür ein
  Nachladen, `calc.js` nicht. Jetzt gibt es **genau einen Nachlauf je Sitzung**,
  mit Merker *vor* dem Laden gesetzt, damit die Render-Schleife von v730
  (POST → loadAll → GET → Re-Render → POST) nicht zurückkommt.
- **Ein Ladefehler sah aus wie „keine Objekte" (v1399).** Die Kachel behauptete
  „Keine anderen Bestandsobjekte" — auch wenn der Abruf schlicht ausgefallen
  war. **Das ist die gefährliche Richtung:** ohne Daten rechnet das Objekt zu
  gut, und die Oberfläche bestätigt dem Nutzer, das sei richtig. Jetzt drei
  unterscheidbare Zustände: „wird geladen …", „—" (geprüft, wirklich keine),
  oder Betrag mit Liste.
- **Negative Basis** ist abgefangen: übersteigt der Verlust das zvE, ist die
  Basis null, nicht negativ.
- **Rückfall 0**, wenn der Weg nicht verfügbar ist — dann rechnet es wie vor
  v1397, statt halb zu saldieren. Lieber bekannt konservativ als eine Zahl, die
  je nach Ladezustand springt.

### Was offen bleibt

1. **Die Forward-Betrachtung über Jahre ist nicht erledigt.** Der Saldo wird je
   Bezugsjahr geholt, aber eine durchgerechnete Jahresreihe über alle Objekte
   gibt es nur in der Modellprojektion des Cockpits — und die rechnet mit
   Näherungen (`ASSUMP`), nicht mit der echten `calc.js`-Pipeline.
2. **Verlustverrechnungsbeschränkungen** (§ 15a, § 15b, § 10d EStG) sind
   ausdrücklich nicht abgebildet. Dafür braucht es die Steuerbescheide der
   Vorjahre — das ist Steuerberatung, nicht Kalkulation.
3. **Keine aktive Benachrichtigung** bei Änderungen (Abschnitt 6).
4. **Die Verrechnung greift nur für gespeicherte Objekte.** Ein noch nicht
   gespeichertes rechnet für sich allein.

### Zwei Nebenfunde, im selben Zug behoben

- **`var ZVE_BASE=78000`** war im Cockpit hart verdrahtet: die Modellprojektion
  rechnete ihre gesamte Steuerwirkung für **jeden** Nutzer gegen 78.000 €.
  Unsichtbar, weil die Zahl für einen mittleren Fall plausibel aussieht — sie
  traf die Ränder. Jetzt aus dem Profil, samt Historie über die Jahre.
- **`vuvY1`** summierte `_kpis_vuv`, ein Feld, das **nirgends gesetzt wird**.
  Immer 0, nie verwendet. Entfernt.

---

## 8 · Wo es im Code steht

| Was | Datei |
|---|---|
| Der eine Rechenweg | `frontend/js/tax.js` → `window._dpBestandSaldo` |
| Anwendung im Cashflow | `frontend/js/calc.js` → `_estDelta`, `_bestandSaldo` |
| Nachladen mit Merker | `frontend/js/calc.js` → `_bestandEinmalNachladen` |
| Saldo im Tab Steuern | `frontend/js/tax.js` → `_getBestandLossesForYear` |
| Datenquelle | `frontend/js/wk-aggregator.js`, `/api/v1/tax-snapshots` |
| Progressionshinweis | `frontend/js/calc.js` → `_progHinweisZeichnen` |
| Erklärtext | `frontend/index.html` → `#tax-flow-hint` |
| Cockpit-Projektion | `frontend/js/dashboard.js` → `projectAll`, `zveFuer` |

---

## 9 · Zur Abnahme im Browser

1. Tab Steuern mit **zwei gespeicherten Objekten** öffnen, das jüngere geladen.
2. Die Kachel **„Überschuss/Verlust V+V (aktueller Bestand)"** muss den Saldo
   des älteren zeigen — nicht „—". Ein Klick öffnet die Liste.
3. Die Karte **„Dein Steuersatz wurde angepasst"** muss erscheinen und den Satz
   nennen, um den die Vorobjekte die Basis verschoben haben.
4. Der **Tooltip am Grenzsatz-Feld** muss den Zusatz über die verschobene Basis
   tragen.
5. Gegenprobe mit einem **einzelnen** Objekt: dort darf sich gegenüber früher
   **nichts** geändert haben.
