# Niedersachsen — Arbeitsliste der Sachwertfaktor-Workbooks

**Stand 15.09.2026.** Diese Datei ist eine **Arbeitsliste**, keine Chronik: sie
wächst mit jeder Sitzung, bis alle Gebiete erfasst sind. Danach ist die Ernte
reine Messarbeit.

---

## Das Namensmuster

```
https://www.gag.niedersachsen.de/grundstuecksmarktinformationen/2026/
  Sachwertfaktor/<teilmarktseite>/<workbook>

workbook = 2026_sw_<teilmarkt>_<gebiet>[_<region>]
```

| Teil | Werte |
|---|---|
| `<teilmarkt>` | `efh` (Ein-/Zweifamilienhäuser) · `rh` (Reihenhäuser) · zwei weitere (5.1 bis 5.4 laut amtlicher Beschreibung) |
| `<gebiet>` | **Kfz-Kennzeichen der beteiligten Landkreise, aneinandergehängt** |
| `_<region>` | nur wo ein Ausschuss seinen Bereich weiter unterteilt |

> **Die Kürzel sind Kfz-Kennzeichen.** `osmepnoh` = **OS** (Osnabrück) +
> **MEP** (Emsland/Meppen) + **NOH** (Grafschaft Bentheim/Nordhorn). `bswf` =
> **BS** (Braunschweig) + **WF** (Wolfenbüttel).
>
> **Damit sind es weit weniger als 40 Ausschüsse** — die niedersächsischen GAG
> sind Zusammenschlüsse mehrerer Landkreise. Die frühere Schätzung „30 bis 45
> Browser-Sitzungen" war deutlich zu hoch.

---

## Gefunden und an der Workbook-API bestätigt

| Workbook | Gebiet (Kennzeichen) | zuletzt aktualisiert | Aufrufe | Registerstand |
|---|---|---|---:|---|
| `2026_sw_rh_bswf` | BS + WF | 19.02.2026 | 231 | **geerntet** (13.09., Stufe B) |
| `2026_sw_efh_osmep_osmepnoh` | OS + MEP + NOH | 20.03.2026 | 799 | offen |
| `2026_sw_efh_hmhhsg` | HM + H? + HI? + SG? | 10.02.2026 | 725 | offen |
| `2026_sw_efh_sulverniostni` | SUL? + VER + NI + … | 12.05.2026 | 411 | offen |

> **`2026_sw_efh_bswf` gibt es NICHT** — geprüft, die API antwortet nicht.
> Braunschweig/Wolfenbüttel führt ein Reihenhaus-Workbook, aber kein
> gleichnamiges für Ein-/Zweifamilienhäuser. **Nicht jeder Ausschuss führt
> jeden Teilmarkt**, und genau dafür lohnt die API-Vorprüfung: sie kostet
> einen HTTP-Aufruf statt einer Browser-Sitzung.

---

## Das Verfahren zum Weitersammeln

1. Navigationskarte öffnen:
   `public.tableau.com/views/2026_sw_navi_EFH/Story?Typ=EFH&:showVizHome=no&:embed=true&:language=de-DE`
2. **Acht Sekunden warten**, bis die Karte steht.
3. Auf eine Region klicken → es öffnet sich **ein** Zieltab, dessen URL das
   Workbook nennt. **Tableau verwendet denselben Zieltab wieder** — mehrere
   Klicks in einem Rutsch liefern deshalb nur das letzte Ergebnis. Ein Klick
   je Aufruf, dann die URL ablesen.
4. Nach etwa fünf Klicks friert der Renderer ein (`Page.captureScreenshot`
   läuft in den Timeout). **Das ist der bekannte Befund aus der
   Wolfenbüttel-Ernte** — dann die Karte neu laden und weitermachen.

### Prüfen, ohne zu rendern

```
GET https://public.tableau.com/profile/api/workbook/<workbook>
→ lastUpdateDate · viewCount · viewInfos[]
```

Antwortet die API nicht, gibt es das Workbook nicht. **Vor jeder Nachernte
`lastUpdateDate` gegen das `berichtsjahr` des Registersatzes halten** — ein
HTTP-Aufruf spart eine ganze Messsitzung.

### Die Blattstruktur eines Ziel-Workbooks

```
<pfx>_titel · <pfx>_berech · <pfx>_stanzahl · <pfx>_stübersicht
<pfx>_diavortext · <pfx>_dia_brw · <pfx>_dia_bgwf · <pfx>_dia_stst
<pfx>_tab · <pfx>_tooltipp
```

`_berech` ist der Kalkulator, `_dia_brw` / `_dia_bgwf` / `_dia_stst` sind die
drei Stützpunkt-Diagramme (Bodenrichtwert, Bodenwertanteil, Standardstufe).
Der Präfix trägt eine laufende Regionsnummer (`ni2_`), die sich **nicht** aus
dem Workbook-Namen ableiten lässt.

---

## Was beim Messen gilt (aus der Wolfenbüttel-Ernte)

- Frische URL mit `?Brw=…&Sach=…`, **sieben Sekunden warten**, dann den
  Ergebnisbereich zoomen — vier Messungen je Durchgang.
- Messreihen im selben Tab scheitern am Renderer-Timeout.
- **Jedes Dashboard trägt ein Normobjekt mit Referenzergebnis und
  Standardabweichung** — das ist der Prüfmaßstab nach der Erntedoktrin, und
  damit genügt **eine** Gegenprobe je Ausschuss.
- Lizenz `dl-de/by-2-0`: kommerzielle Verwertung erlaubt, **Namensnennung
  Pflicht** — sie steht seit v1402 im Bericht.
