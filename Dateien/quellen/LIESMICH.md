# Quellen der Ernte — Marktberichte als PDF

**Hier liegen die Originaldokumente, aus denen die Registerdaten stammen.**
Angelegt am 13.09.2026 auf Marcels Vorgabe: *„wenn wir PDF-Dateien haben, wo
das drin steht, dann leg einen Ordner an, wo du diese hinspeicherst und
ausliest."*

## Wie der Ordner benutzt wird

**Marcel legt hier Dokumente ab**, die er selbst beschafft hat — besonders
die, an die ich nicht herankomme (robots-gesperrt, Captcha, Login,
kostenpflichtig bezogen).

**Ich lese sie von hier** mit `pdftotext -layout` und baue daraus Rezepte in
`tools/swf-register/rezepte/`.

**Namensschema:** `<LAND>-<ort>-<art>-<jahr>.pdf`

```
HH-hamburg-imb-2026.pdf        Land · Ort · imb = Immobilienmarktbericht
RP-mainz-gmb-2025.pdf                         gmb = Grundstücksmarktbericht
HE-land-imb-2025.pdf           "land" = Landesbericht
```

## Nicht ins Git

Die Dateien sind groß (3 bis 27 MB, zusammen über 100 MB). `Dateien/` ist
nicht versioniert und soll es bleiben — **die Rezepte sind versioniert, die
Quellen nicht.** Jedes Rezept trägt `quelle_url` und `quelle_datei`, damit
nachvollziehbar bleibt, woher eine Zahl kommt.

Eine Zweitkopie liegt auf dem Staging-Server unter `/opt/dealpilot-quellen/`.

## Was drin ist (Stand 13.09.2026)

| Datei | Ausschuss | Was geerntet wurde |
|---|---|---|
| `HH-hamburg-imb-2026.pdf` | Hamburg | Sachwertfaktor EFH — Formel mit 19 Faktoren, S. 117–123 |
| `HE-kassel-imb-2024.pdf` | Kassel | Sachwertfaktoren EFH/ZFH und RH/DHH, Tab. 29+30 |
| `HE-land-imb-2025.pdf` | Land Hessen | Sachwertmodell Hessen landesweit, Tab. 8.4.1.1 + 8.4.2.1 |
| `RP-mainz-gmb-2025.pdf` | Mainz | Sachwertfaktoren mit Funktion **und Anwendungsbeispiel**, S. 49–52 |
| `MV-ludwigslust-parchim-gmb-2018.pdf` | Ludwigslust-Parchim | Marktanpassungsfaktoren, Tab. 27, S. 58 |
| `NI-wolfenbuettel-sw-modellbeschreibung-2026.pdf` | Wolfenbüttel | Modellvermerk zum Tableau-Kalkulator |
| `HE-darmstadt-imb-2025.pdf` | Darmstadt | **nichts** — Marktanpassungsfaktoren nur als Streudiagramm |
| `BY-land-imb-2026.pdf` | Land Bayern | noch auszuwerten |

## Zur Lizenzfrage — die Unterscheidung, die zählt

**Zwei verschiedene Dinge, die ich anfangs vermengt habe:**

1. **Marcels eigene Nutzung als Sachverständiger.** Amtliche Marktdaten in
   einem Verkehrswertgutachten zu verwenden ist der vorgesehene Zweck dieser
   Berichte. Dafür sind sie veröffentlicht.
2. **Die Auslieferung im Produkt.** Ob eine Zahl in einem DealPilot-Bericht
   an einen Kunden gehen darf, entscheidet die Lizenz des jeweiligen
   Ausschusses.

Deshalb trägt jedes Rezept seit v1098j ein Feld **`verwendung`**:

```
produkt    darf im Kundenbericht stehen (zero-2-0, oder frei mit Quellenangabe)
gutachten  Marcel darf damit arbeiten; im Kundenbericht steht nur der LINK
```

> **Ein Lesefehler, der hierher gehört:** Bei Ludwigslust-Parchim hatte ich
> „Vervielfältigungen sind nur mit Genehmigung des Herausgebers gestattet"
> gelesen und das Land als gesperrt notiert. **Der nächste Satz sagt das
> Gegenteil:** *„Auszugsweise Wiedergabe mit eindeutigen Quellenangaben
> verbunden mit der Zusendung eines Belegexemplars an den Herausgeber ist
> ohne Genehmigung gestattet."* Eine Sachwertfaktor-Tabelle **ist** eine
> auszugsweise Wiedergabe.
>
> **Lehre:** einen Lizenzabsatz immer zu Ende lesen. Der erste Satz nennt oft
> die Regel, der zweite die Ausnahme — und die Ausnahme ist der praktische
> Fall.
