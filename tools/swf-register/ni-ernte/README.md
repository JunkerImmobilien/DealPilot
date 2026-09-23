# Niedersachsen — was geerntet ist und was fehlt

**Stand 23.09.2026.** Rohstoff für den Rezeptbau, erzeugt von `ni-ernte.sh`
(Gitter) und `ni-kurven-ernte.sh` (Korrekturkurven und Normobjekt).

---

## Was hier liegt

| Ordner | Inhalt |
|---|---|
| `ni-gitter/` | **42 Gitter** · `brw;sachwert;faktor;streuung`, dazu `.meta` mit der Spanne bzw. Achse, gegen die abgetastet wurde |
| `ni-kurven/` | **42 JSON** · Korrekturkurven je Gebiet, mit dem gelesenen Normobjekt |

Zusammen **2.300 Zellen mit Faktor**, alle innerhalb der belegten
Wertebereiche.

## Woher das Gitter stammt

Zwei Wege, und die `.meta` sagt welcher:

- **Stichprobenspanne** — Min/Max aus der Merkmalstabelle des Dashboards.
- **`quelle=abgedruckte_achsen`** — die Stützstellen, die das Diagramm selbst
  abdruckt. Das ist die bessere Quelle: die Modellbeschreibung nennt die
  Diagramm-Wertebereiche „den Rahmen für die Verwendbarkeit des zugrunde
  liegenden Modells". Ein aus Min/Max gebildetes Gitter trifft die Stützstellen
  des Modells dagegen nur zufällig.

## Die Korrekturkurven — und wo sie fehlen

| | Gebiete |
|---|---|
| **mit lesbaren Kurven** | **26** |
| Kurven nur als Bild | 16 |

Bei den 26 ist das Normobjekt bestimmt: **44 direkt abgelesen** (dort, wo der
Koeffizient 1,00 ist), **10 interpoliert** zwischen zwei Stützstellen. Kein
einziges blieb offen.

Vorkommende Merkmale: Standardstufen (19) · Wohnflächen (15) ·
Restnutzungsdauer (17) · modifiziertes Baujahr (3).

> ### Warum 16 Gebiete keine lesbare Kurve haben
>
> **Ihre Kurven sind nur Bilder.** An Cuxhaven gemessen: die Überschrift steht
> im Text, die y-Achse auch (1,20 · 1,10 · 1,00 · 0,90) — aber an den
> Datenpunkten stehen keine Zahlen. Dasselbe beim Emsland (modifiziertes
> Baujahr).
>
> Das ist kein Werkzeugfehler. Diese Kurven sind aus dem PDF grundsätzlich
> nicht lesbar und müssten am Kalkulator **abgetastet** werden — ein eigener
> Bauschritt.
>
> Betroffen sind ganze Regionen: alle `ott_*` (Otterndorf), die meisten
> `osmep_*` (Osnabrück-Meppen) und einzelne aus `hmhh`/`sulver`.

## Was das für die Rezepte bedeutet

- **26 Gebiete** können ein vollständiges Rezept bekommen: Gitter, Korrekturen
  und der Punkt, auf den sich beide beziehen.
- **16 Gebiete** bekommen eines, das **nur am Normobjekt gilt**. Das muss in
  `auflagen` stehen — sonst rechnet das System für ein abweichendes Objekt
  einen Faktor aus, der die Korrektur nicht enthält.

## Was gar nicht geerntet ist

Von 55 Gebieten mit bewiesenem AGS:

| | |
|---|---|
| geerntet | **42** |
| ohne lesbare Spanne | 5 |
| nur Leerzellen | 8 |

Die 8 Leeren sind die Regionen **`lg` (Lüneburg) und `nom`**. Ihre Dashboards
führen eine zusätzliche Lage-Achse — bei Lüneburg „Entfernung [km] zum
Marktplatz" — die der Standardaufruf nicht setzt. Ohne sie rechnet der
Kalkulator nicht und gibt `LEER` zurück.

**Denselben Gebieten fehlt auch der Ausschussname**, weil die Navigationsseite
`immobilienmarkt.niedersachsen.de/marktinformationen/…` nicht mehr existiert.
Beide Lücken haben dieselbe Wurzel und gehören in einen Arbeitsgang.

## Der nächste Schritt

Rezepte bauen aus:

1. `ni-gitter/<wb>.csv` → `formel.achse_x` / `achse_y` / `zellen`
2. `ni-kurven/<wb>.json` → `korrekturen` und `formel.normobjekt`
3. `../ni-ags.csv` → `ags` und `gaa_name`
4. `../ni-kopfdaten.csv` → Stichtag, Stichprobe, Normfaktor

Das Zielformat steht in den vorhandenen Rezepten, etwa
`../rezepte/NI-03151-gifhorn.json`. **Der Regionalausschussname** ist für fünf
der sieben Regionen aus dem Bestand belegt (Braunschweig-Wolfsburg,
Hameln-Hannover, Sulingen-Verden, Otterndorf, Osnabrück-Meppen); für `lg` und
`nom` fehlt er.
