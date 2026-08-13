# Kein Rezept — was fehlt (Stand 13.08.2026)

Diese Ausschüsse kommen in den Erntedokumenten vor, bekommen aber **kein
Rezept**, weil die Tabellenwerte dort nicht abgedruckt sind. Eine Matrix wird
nicht ergänzt, nicht interpoliert und nicht fortgesetzt — genau dieser Fehler
ist am 10.08. bei Bochum passiert (frei erfundene Matrix, verdrehte Fallzahl).

---

## ~~Kreis Höxter~~ — ERLEDIGT am 13.08.2026

Die 448 Zellen lagen nicht in den Projektdokumenten, aber lokal auf der Platte:
`/root/ernte/out/swf_roh.json`, Schlüssel `312_hoexter`. Rezept geschrieben als
**`312-hoexter.json`**, Zellen unverändert übernommen. Zählprüfung 56 × 8 = 448
bestanden, alle fünf Sollwerte getroffen, Monotonie in beide Richtungen sauber.
Prüfprotokoll steht im Rezept unter `beleg.pruefprotokoll`.

---

## Stadt Lüdenscheid (GAA 25200, AGS 05962032) — Form bekannt, Zahlen nirgends

**Kein Rezept.** Die Modellform steht in der Projektanweisung, die Werte stehen
in **keinem** der sechs Erntedokumente und in keiner Datei auf der Platte.

| | |
|---|---|
| Ausschussname | „Der Gutachterausschuss für Grundstückswerte in der Stadt Lüdenscheid" (aus `schluessel.csv`) |
| **AGS** | **05962032 — achtstellig, Ebene `gemeinde`** |
| GAA-Kennzeichen | 25200 |
| Form | `potenz` (Formelfassung, Y = a · X^b) **und** `stufen_1d` (Tabellenfassung) |
| Fundstelle | Abschnitt 5.1.2 |
| Außenanlagen | 5 % |
| Gartenland | im Bericht kein Ansatz |

**Was FEHLT:** die Koeffizienten **a und b** der Potenzfunktion, die Stützstellen
der Tabellenfassung, die Bezugsgröße der Achse, Fallzahl, Streuung, Berichtsjahr,
Stichtag, Lizenz, Quell-URL — also alles außer der Form. Der Auswerter erwartet
bei `potenz` die Schlüssel `achse_feld`, `achse_bez`, `a`, `b`, optional
`x_faktor`, `gueltig_von`, `gueltig_bis`.

Gesucht wurde in allen sechs Erntedokumenten, in `/root/ernte/out/swf_roh.json`
(führt nur `312_hoexter`, `315_mk_freistehend`, `315_mk_dhh_rh`) und über die
ganze Platte. Lüdenscheid kommt vor — aber **ausschließlich in Liegenschaftszins-
und Grundstücksmarktdaten** (`lzs-nrw.json`, `gmd2024/`, `gmd2025/`) und in
Quelltext-Kommentaren, die nur die Modellform benennen. Keine einzige Zahl zum
Sachwertfaktor.
`claude/v1083-stand.md` und `claude/uebergabe-20260811.md` konnten **nicht**
geprüft werden — das Projects-Werkzeug stand ab Mitte der Sitzung nicht mehr zur
Verfügung. **Dort zuerst nachsehen**, danach das Original-PDF, Abschnitt 5.1.2.

**Warum das der scharfe Fall für die Kaskade ist:** Lüdenscheid liegt im
Märkischen Kreis. Ein Auflöser, der auf den **fünfstelligen** Schlüssel 05962
vergleicht, trifft für ein Lüdenscheider Objekt still den Kreis-Datensatz
(GAA 31500) — mit dessen Stufentabelle statt der Potenzfunktion. Zwei Ausschüsse,
ein Kreisschlüssel, kein Fehler, nur ein falscher Wert. Dasselbe gilt für
Iserlohn (05962024, GAA 24300). Lüdenscheid **muss** mit `ags 05962032` und
`ebene "gemeinde"` eingetragen werden, und die Gemeinde-Ebene muss **vor** der
Kreis-Ebene geprüft werden.

---

## Kreis Gütersloh (GAA 30800, AGS 05754000) — keine Quelle

Keine erreichbare PDF-Adresse. Der Bericht ist ausdrücklich gebührenfrei, wird
aber nur über die BORIS-NRW-Oberfläche ausgeliefert (JavaScript, keine stabile
PDF-Adresse). **Kein Datenpunkt zum Sachwertfaktor.** Beschaffung: PDF von Hand
im Browser laden, dann `pdftotext -layout`.

---

## Bundesstadt Bonn (GAA 10400, AGS 05314000) — keine Sachwertfaktoren erfasst


Bonn kommt in den Dokumenten nur über die Liegenschaftszinssätze vor
(Dreifamilienhäuser 2,4 % n=26 · MFH 3,1 % n=32, **beide mit GND 60 statt 80**).
**Zum Sachwertfaktor liegt nichts vor.**

Merkposten zur Verwechslungsgefahr: **10400 ist Bonn, 10300 ist Bochum.** Der
Befund „MFH mit GND 60" gehört zu Bonn; Bochum führt MFH mit 3,3 % und GND 80.

---

## Teilweise fehlend in vorhandenen Rezepten

| Ausschuss | was fehlt |
|---|---|
| **Duisburg (10800)** | Der **fünfte Teilmarkt** (29 Kauffälle; im GMB 2025 die Dreifamilienhäuser mit 0,95) ist im Jahrgang 2026 als „noch zu erfassen" markiert — kein Wert hinterlegt. Außerdem fehlen für 2026 Lizenzangabe, Stichtag und Quell-URL. |
| **Dortmund (10600)** | Lizenzangabe, Stichtag, Auswertejahre. Vor allem: die **Gebietsdefinition (Ziffer 8.1)** — welcher Stadtbezirk zu welchem Gebiet G1/G3/G4/G5/G6a/G6b/G7 gehört, ist nicht erfasst. Ohne sie ist das Rezept nicht auflösbar. |
| **Bochum (10300)** | Die Lagegrenzen der Wohnlageklassen (gute Lage über 440 €/m², mittlere 360–440, einfache unter 360) stammen aus der Vortagsernte und sind am Original noch nicht bestätigt. Tabelle 18 (Liegenschaftszinssätze) ist ebenfalls Grafik und ungelesen. |
| **Kreis Paderborn (321)** | Spaltenzuordnung der Zeilen 600.000 und 650.000 nur aus der Monotonie erschlossen. Fallzahl und Streuung zu den Sachwertfaktoren nicht angegeben. |
| **Düsseldorf (10700)** | Kauffallzahlen und Standardabweichungen zu den Sachwertfaktoren sind im Bericht nicht als Text vorhanden (Stichprobentabelle S. 75 offenbar als Grafik). |
| **Rhein-Erft-Kreis** | Keine Standardabweichung, kein Bestimmtheitsmaß zu den Sachwertfaktoren; Fallzahl nur als Gesamtsumme 1.098 über alle vier Gebäudetypen. |
| **Köln** | Werte nur aus der Browser-Extraktion (pdf.js), nicht aus einem `pdftotext`-Lauf; die Projektanweisung führt Köln unter „nicht belegbar". Vor produktivem Einsatz S. 92/93 nachziehen. |
| **Essen (10900)** | Lizenzangabe nirgends abgedruckt; Kauffallzahlen fehlen im Bericht durchgängig. |
| **Märkischer Kreis (315)** | Lizenzangabe im Dokument widersprüchlich (Lizenztext Zero 2.0, Quellenvermerk by-2-0) — deshalb `lizenz: null`. Fallzahl für DHH/RH nicht abgedruckt. |
| **Iserlohn (243)** | Kein Stichtag beziffert (nur „Bezugszeitpunkt 01.01. des laufenden Jahres"). |

---

## Nicht in diesen Dokumenten enthalten

**Kreis Herford (05758)** und **Kreis Minden-Lübbecke (05770)** stammen aus
früheren Paketen (`sachwertfaktoren_herford.js`, `sachwertfaktoren_nrw.js`) und
kommen in den sechs ausgewerteten Erntedokumenten nicht mit ihren Tabellen vor.
Für sie wurde hier bewusst kein Rezept aus dem Gedächtnis gebaut.
