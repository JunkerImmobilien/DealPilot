# Kaufpreisaufteilung — die Schnittstelle

**Stand 29.09.2026.** Wer von außen eine Kaufpreisaufteilung rechnen
lassen will — etwa ein Import-Modul, das ein KPT-Dokument eingelesen
hat —, ruft **diesen einen Endpunkt**. Es gibt keinen zweiten Weg, und
es soll keinen geben.

```
POST /api/v1/bmf/aufteilung
Body: { "inputs": { … } }
```

Dahinter steht die **offizielle BMF-Vorlage (Fassung Juni 2023)**, die
von LibreOffice headless neu durchgerechnet wird
(`backend/src/services/bmfService.js`). Es ist keine nachgebaute
Formel — das ist der Grund, warum das Ergebnis vor einem Finanzamt
bestehen kann.

---

## Die Feldnamen — und warum sie genau so heißen müssen

**Unbekannte Felder werden verworfen.** Seit v1669 sagt die Antwort in
`warnings`, welche das waren; davor geschah es stillschweigend. Am
29.09.2026 kamen so **fünf von zwölf** Feldern nicht an, und der
Bodenwert war um den **Faktor 2,9** falsch — bei einer Antwort, die
plausibel aussah.

> Ein Rechner, der unbekannte Eingaben stillschweigend verwirft,
> liefert kein falsches Ergebnis — er liefert ein richtig aussehendes.

Die häufigsten Verwechslungen:

| falsch | richtig |
|---|---|
| `grundstuecksflaeche` | **`grundstuecksgroesse`** |
| `miteigentumsanteil_zaehler` | **`mea_zaehler`** |
| `miteigentumsanteil_nenner` | **`mea_nenner`** |
| `liegenschaftszins` | **`liegenschaftszinssatz`** |
| `restnutzungsdauer` | *gibt es nicht* — die Vorlage leitet sie aus Baujahr und Modernisierung ab |

### Pflicht

| Feld | Bedeutung |
|---|---|
| `lage` | Freitext, z. B. `06184 Kabelsketal, Am Markt 18` |
| `grundstuecksart` | **exakt** einer der Werte aus `GRUNDSTUECKSART_OPTIONS` (`bmfService.js:106`) — ein Tippfehler ergibt `#N/A` in der Vorlage |
| `kaufdatum` | `TT.MM.JJJJ` oder ISO |
| `kaufpreis` | inkl. Nebenkosten, in Euro |
| `baujahr` | ursprüngliches Baujahr |
| `wohnflaeche` | Wohn-/Nutzfläche in m² |

### Boden

| Feld | Bedeutung |
|---|---|
| `grundstuecksgroesse` | m², Fläche 1 |
| `bodenrichtwert` | €/m², Fläche 1 |
| `grundstuecksgroesse2` / `bodenrichtwert2` | optional, Fläche 2 |
| `mea_zaehler` / `mea_nenner` | Miteigentumsanteil, z. B. `15.11` / `1000` |

### Die Verfahrensweiche

| Feld | Wirkung |
|---|---|
| `miete_bekannt` | `"Ja"` / `"Nein"` |
| `miete_monatlich` | Nettokaltmiete inkl. Stellplätze |
| `liegenschaftszinssatz` | in Prozent, z. B. `2.5` |
| `vergleichsfaktor_vorhanden`, `vergleichsfaktor` | Vergleichswert-Zweig |

**Das ist keine Nebenangabe.** Ohne Miete wählt die Arbeitshilfe den
**Sachwert**, mit Miete den **Ertragswert** — an einem echten Fall
waren das **90,93 % gegen 93,13 %** Gebäudeanteil. Drei Prozentpunkte
AfA-Bemessungsgrundlage hängen an einem `"Ja"`.

### Modernisierung (Blatt „Fiktives Baujahr")

`mod_dach`, `mod_fenster`, `mod_leitungen`, `mod_heizung`,
`mod_waermedaemmung`, `mod_baeder`, `mod_innenausbau`, `mod_grundriss`
— je `"ja"` / `"nein"` / `"teilweise"`. **Bei alten Gebäuden Pflicht**,
sonst `#N/A` in der Sachwert- und Ertragswertkette.

---

## Die Antwort

```jsonc
{
  "ok": true,
  "warnings": [ "Unbekannte Eingabefelder wurden NICHT …" ],
  "inputs_received": { … },
  "results": {
    "bodenwert":                 { "value": 7617.56, "label": "Bodenwert (€)" },
    "ertragswert":               { … },
    "sachwert_marktangepasst":   { … },
    "massgebender_verkehrswert": { … },
    "gebaeudeanteil_prozent":    { "value": 93.13, … },
    "kaufpreisanteil_grund":     { … },
    "kaufpreisanteil_gebaeude":  { … },
    "fiktives_baujahr":          { … }
  },
  "file_base64": "…",   // die ausgefüllte XLSX
  "pdf_base64":  "…",
  "meta": { "aus_speicher": false, "job_id": "…" }
}
```

**`warnings` zuerst lesen.** Ist die Liste nicht leer, ist mindestens
ein Feld nicht angekommen — und das Ergebnis beruht insoweit auf den
Standardwerten der Vorlage, nicht auf den übergebenen Daten.

**`meta.aus_speicher: true`** heißt: die Antwort kam aus dem Cache
(10 Minuten). Wer eine frische Rechnung braucht, ändert eine Eingabe
oder wartet.

---

## Gegengerechnet an einem echten Gutachten

Am 29.09.2026 gegen die Kaufpreisaufteilung **Am Markt 18, 06184
Kabelsketal — WE 2** (derGutachter.net, Az. 25DG02659) geprüft:

| | Gutachten | dieser Endpunkt |
|---|---|---|
| Bodenwert (MEA-Anteil) | 7.617,56 € | **7.617,56 €** |
| Gebäudeanteil, Ertragswert-Zweig | 94,35 % | **93,13 %** |
| Ertragswert | — | 110.803 € *(Kaufpreis 110.911 €)* |

Der Ertragswert trifft den Kaufpreis auf **0,1 %**. Die verbleibenden
1,22 Prozentpunkte sind ein **Verfahrensunterschied**, kein Fehler: das
Gutachten teilt den um den Bodenrestwert bereinigten Kaufpreis, die
BMF-Arbeitshilfe teilt im Verhältnis der Einzelwerte.

---

## Was ein Import-Modul dafür liefern müsste

Aus einem eingelesenen Dokumentenstapel braucht dieser Endpunkt:

- aus **BORIS**: `bodenrichtwert`
- aus dem **Kataster**/Grundbuch: `grundstuecksgroesse`, `mea_zaehler`,
  `mea_nenner`
- aus dem **Kaufvertrag**: `kaufpreis`, `kaufdatum`
- aus dem **Exposé**/Gutachten: `baujahr`, `wohnflaeche`,
  `grundstuecksart`, die `mod_*`-Angaben
- aus dem **Mietvertrag**/Exposé: `miete_bekannt`, `miete_monatlich`

> Das Import-Modul v1.1.0 erkennt ein KPT-Dokument, hat aber weder
> einen Extraktions-Prompt noch einen Konsolidierungs-Zweig dafür. Es
> liefert heute nur `bodenrichtwert` (BORIS). **Die Rechnung liegt
> hier, nicht dort** — ein Modul-Update muss sie nicht mitbringen,
> sondern nur die Eingaben füllen und diesen Endpunkt rufen.
