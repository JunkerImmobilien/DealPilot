# NI-Sachwertfaktoren: Ernte über die Kalkulator-Sitzung (VizQL, ohne Browser)

Seit v2881 (22.10.2026), ins Repo übernommen mit v2886. Der ältere Ernter
`../ni-ernter.mjs` (Playwright, Browser) bleibt als Geschichte liegen; er ist
durch diesen Weg ersetzt.

## Worum es geht

Die Gutachterausschüsse in Niedersachsen veröffentlichen ihre Sachwertfaktoren
als Tableau-Kalkulatoren (Profil `ogagmd2026` auf Tableau Public, verlinkt unter
`gag.niedersachsen.de/grundstuecksmarktinformationen/<Jahr>/Sachwertfaktor/…`).
Eine Tabelle zum Abschreiben gibt es nicht. Der Faktor hängt von Sachwert,
Bodenrichtwert und oft einer **Lage** ab, die nur als Listen-Parameter gesetzt
werden kann.

Der Weg, der funktioniert (gemessen 22.10.2026):

1. `POST /vizql/w/<wb>/v/<view>/startSession/viewing` und
   `bootstrapSession/sessions/<sid>` → Sitzung mit Parameterliste.
2. Parameter setzen: `tabdoc/set-parameter-value` (Zahl als Wert) bzw.
   `tabdoc/set-parameter-value-from-index` (Listen, **nullbasierter Index**).
   Gemeinde-Filter: `tabdoc/categorical-filter-by-index`.
3. Wert lesen: `tabsrv/export-image-server` mit `mediaType: svg`, Abruf über
   `/tempfile/sessions/<sid>?key=…`. Im SVG steht der Text als Text.
4. Gegenprobe gegen die **PDF-Route** des Kalkulators
   (`https://public.tableau.com/views/<wb>/<view>.pdf?<Parameter>=<Wert>`),
   aber nur mit EINEM rechnenden Parameter je Aufruf: zwei zugleich leeren
   den Faktor. Listen-Parameter nehmen in der URL den WERT der Liste
   (`Lagefaktor=0.7`, `Lagesowst=1`), nicht die Beschriftung. Immer das
   Lage-Label im PDF gegenlesen, sonst rechnet man eine Fantasiezahl.

Keine Zugangsdaten: alles ist ohne Anmeldung öffentlich lesbar. Ein Punkt
kostet rund 1,5 s. Sitzungen sterben nach 30–60 min mit HTTP 410; die Ernter
speichern je Lage/Kombination zwischen und melden sich neu an.

## Die Dateien

| Datei | tut |
|---|---|
| `pfade.mjs` | Repo-, Register- und Arbeitsordner. Rohernten gehen nach `NI_ERNTE_AUS` (Vorgabe `<tmp>/dealpilot-ni-ernte`), **nie ins Repo** |
| `tab.mjs` | der VizQL-Client (Sitzung, Parameter, SVG-Export, Textleser mit Position) |
| `filter.mjs` | Kategorie-Filter lesen und setzen (Gemeinde-Auswahl GAG Oldenburg-Cloppenburg) |
| `kopf.mjs` | Kopfdaten je Kalkulator (Stichtag, Quelle, Fallzahl) → `kopf.json` |
| `ernte-gitter.mjs` | Gitter BRW × Sachwert je Lage (Parameter `Lagefaktor`) oder je Gemeinde (`--filter=`), dazu die Korrekturkurven (Diagramme `Diastst`, `Diarnda`, `Diawofl`) und die Lagetabelle. Für Kalkulatoren mit Blatt „Berechnung“ (GAG Northeim, Oldenburg-Cloppenburg u. a.) |
| `lagetab.mjs` | die Gemarkungstabelle („Lage einblenden“) mit Positionen lesen → `<wb>.lagetab.json` |
| `ernte-lage.mjs` | Nachernte je Lage für Registersätze, die an der Vorgabe-Lage abgetastet waren; Gegenprobe: die Vorgabe-Lage muss den Bestand zellgleich reproduzieren |
| `ernte-sv.mjs` | Kalkulatoren **ohne** Blatt „Berechnung“ (GAG Sulingen-Verden): Wert aus dem SVG des ganzen Dashboards, Kategorie-Parameter per `--kat=` (z. B. `Lagesowst,Zawo`) |
| `bau-nom.mjs`, `bau-ol.mjs`, `bau-sv.mjs` | Rohernte → Registerdatei (`swf-ni-nom-2026.json`, `swf-ni-ol-2026.json`, `swf-ni-sv-2026.json`). Erst ohne, dann mit `--schreiben`; geschrieben wird nur ohne Fehler |
| `bau-bestand.mjs`, `bau-sperren.mjs`, `bau-hameln.mjs` | einmalige Umbauten am Bestand (v2883, v2884, v2888) — als Nachweis, wie die Sätze entstanden sind, und als Vorlage |
| `pruef-ni.mjs` | Kettenprobe am echten `sachwertfaktor()` des Kerns (Register aus `SAATDATEIEN`) |

## Die Nachernte 2027

Die Kalkulatoren tragen den Jahrgang im Namen (`2026_sw_efh_nomgs`). Für 2027:

1. Liste der Workbooks neu holen (Profil `ogagmd2027` bzw. die Navigationsseite
   `…/grundstuecksmarktinformationen/2027/Sachwertfaktor/`), mit
   `tools/swf-register/ni-workbooks.txt` vergleichen. Neue/weggefallene
   Kalkulatoren und **geänderte Parameter** (Lage-Listen, neue Merkmale wie
   Energie oder Erbbaurecht) zuerst ansehen: `node ernte-sv.mjs` bzw. ein
   kurzer Lauf von `tab.mjs`/`sitzung()` zeigt die Parameterliste.
2. `export NI_ERNTE_AUS=<arbeitsordner>` setzen, dann `node kopf.mjs <wb…>`.
3. Je Region ernten:
   - GAG Northeim: `node ernte-gitter.mjs 2027_sw_efh_nomgs` usw., danach
     `node lagetab.mjs <wb>` für die Gemarkungstabellen.
   - GAG Oldenburg-Cloppenburg: `node ernte-gitter.mjs <wb> --filter="Lage mit Faktor Satz"`.
   - GAG Sulingen-Verden: `node ernte-sv.mjs <wb> --kat=<Lage-Parameter>[,Zawo]`.
   - Bestand mit Lage-Parameter (Braunschweig-Wolfsburg, Hameln):
     `node ernte-lage.mjs <wb> <ags> <zweig> "<Lage-Caption>"`.
4. In den `bau-*.mjs` den Jahrgang anpassen (Workbook-Namen, Dateinamen,
   `berichtsjahr`, Stichtag kommt aus `kopf.json`), Lauf ohne `--schreiben`,
   Fehlerliste lesen, dann mit `--schreiben`.
5. Neue Datei in `SAATDATEIEN` (`marktbericht/backend/src/lib/ausschuss_register.js`),
   dann `node tools/saat-pruefen.mjs <datei>` und `--basislinie`,
   `node pruef-ni.mjs` (Sollwerte auf den neuen Jahrgang nachziehen),
   `node tools/wertermittlung-pruefen.mjs`.
6. Gegenprobe gegen die PDF-Route an mindestens zwei Punkten je Kalkulator
   (Lage-Label im PDF mitlesen) und im Satz unter `formel.hinweis` festhalten.

## Regeln, die hier teuer gelernt sind

- **Nie an der Vorgabe-Lage für den ganzen Kreis ernten.** Bis v2882 standen
  Salzgitter, Helmstedt, Peine und Hameln so im Register; in einem Dorf lag
  der Faktor bis zu 16 % zu hoch (v2883).
- **Eine Lage wird nur zugeordnet, wenn das Dokument sie zuordnet** (Gemarkungs-
  tabelle, Gemeindename im Lagenamen). „Nordkreis“, „Bremer Umland“,
  „Dörfer“ ohne Ortsliste → Sperre mit Weg zum Kalkulator.
- **Bereichs-Parameter klemmen** auf ihren Rand: ein Sachwert über dem Maximum
  liefert still den Randwert. `ernte-sv.mjs` begrenzt die Achse deshalb auf
  `min`/`max` des Parameters.
- Gitterwerte sind abgefragt, nicht abgedruckt → Stufe B; die Korrektur-
  kurven sind die abgedruckten Diagrammbeschriftungen, gegen den Rechner
  geprüft (Abweichung ≤ 0,03).
