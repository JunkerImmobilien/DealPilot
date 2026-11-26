## Regeln für die Erntenden

Vollständiges Format: `marktbericht/backend/src/lib/mietspiegel/README.md`, Abschnitte „Werte“, „Erweiterungen“,
„Speicherverbot“ und „Häuser“. Muster zum Abgucken: Tabelle `werte/16051000.json` (Erfurt), Tabelle mit Lage und
Zuschlägen `werte/05913000.json` (Dortmund), Regression `werte/14713000.json` (Leipzig), Regression mit Wohnlage je
Adresse `werte/13003000.json` (Rostock).

**1 · Zuerst die Rechte lesen (Impressum, letzte Seiten, Rückseite).**
- „Speicherung in elektronischen Systemen nur mit Genehmigung“ oder ähnlich → **keine Datei**. Im Verzeichnis
  `werte_nutzung: "verboten"`, `werte_nutzung_grund`, `werte_nutzung_beleg` mit wörtlichem Zitat „…“ und „Seite N“.
- Nur Rechtevorbehalt („Nachdruck nicht gestattet“, „urheberrechtlich geschützt“), kein Speicherverbot → Datei mit
  `"freigabe": "gesperrt"` und `freigabe_grund`, im Verzeichnis `werte_nutzung: "vorbehalt"`.
- Nichts davon → Datei frei, `quelle.lizenz` sagt genau das („kein Rechtevorbehalt, geprüft am …“).

**2 · Nur amtliche Quellen.** Stadt, Gutachterausschuss, Mitersteller-Verband (Haus und Grund, Mieterverein).
Nie ein Portal. Jede Zahl mit Seite. Keine Zahl erfinden, nie extrapolieren, nie ein Nachbarfeld.

**3 · Textschicht prüfen.** `pdftotext -layout` und das Druckbild (Seite rendern) vergleichen. Weichen die Zahlen
ab (Saarbrücken 2026!) oder ist es ein Bild-PDF: am Druckbild ablesen und das im `hinweis` sagen, sonst keine Datei.

**4 · Pflichtfelder im Kopf:** `ags` (8-stellig wie im Verzeichnis), `gemeinde`, `art` (qualifiziert | einfach),
`stand`, `erhebungsstichtag`, `gueltig_ab`, `gueltig_bis` (wo genannt, sonst null), `naechste_ausgabe` (wo
angekündigt), `quelle { url, dokument, seite, lizenz, abgerufen }`, `einheit: "eur_qm_nettokalt"`, `form`, `rundung`,
`hinweis` (Arbeitsnotiz: Geltungsbereich, Ausschlüsse, Besonderheiten), `haus` (siehe 7), `pruefbeispiele` (mind. 1).

**5 · Häufige Formen und wie sie abgebildet werden.**

| Form im Dokument | Abbildung |
|---|---|
| **Tabelle** Baualter × Wohnfläche (± Lage, Ausstattung) mit von/bis | `form: "tabelle"`, `tabelle.achsen` (baujahr, wfl, optional lage, ausstattung mit `standard: true`), `zellen` je Feld mit `unten`, `mittel`, `oben`, `seite`. Ohne Mittelwert im Dokument: Mitte der Spanne, im `hinweis` sagen |
| Tabelle nur Mittelwert + Spanne in % | Zellen nur `mittel`, `tabelle.spanne { unten_pct, oben_pct }` |
| Zu- und Abschläge (Balkon, Küche, Lage, Größe) | `tabelle.zuschlaege[]`: `merkmal`, `art` (pct oder eur_qm), `wert`, `beleg`; Größe über `wfl_klassen`, Baualter-Bedingung über `bedingung`; Spannen-Zuschläge als Mitte mit Beleg |
| **Regression** (Basismiete nach Fläche × Faktoren) | `form: "regression"`, `regression.basis` (`wfl_tabelle` oder `basis_eur_qm`), `faktoren[]` (`baujahr_klasse`, `wfl_kurve`, `lage`, `flag`, `auswahl`, `eingabe`), `spanne`, `geltung` |
| Wohnlage je Adresse als Betrag | Faktor `typ: "eingabe"` mit `von`/`bis` (Rostock) |
| **Punktesystem** (Modernisierung/Ausstattung in Punkten → Zuschlagstabelle) | `form: "punkte"`: Grundtabelle und Punktetabellen unter `punkte { …, beleg }` vollständig ablegen. Der Kern rechnet Punkte noch nicht (gibt null mit Hinweis), die Datei hält aber alles für den späteren Kern fest |
| Basis in 5-m²-Schritten mit Zwischenwerten (Darmstadt) | noch nicht rechenbar: als `regression` mit `basis.typ: "wfl_tabelle"` je Klasse ablegen und im `hinweis` die Interpolationsregel des Dokuments zitieren, Prüfbeispiel `erwartet: null` |
| nur Online-Rechner | Dokumentation/Methodenbericht mit Tabellen suchen, sonst keine Datei |

**6 · Prüfbeispiele.** Vorrang hat das Anwendungs- oder Lesebeispiel des Dokuments (`art: "anwendungsbeispiel"`),
sonst eine eindeutig ablesbare Tabellenzelle (`tabellenzelle`). Eine Grenze mit `erwartet: null` festhalten.

**7 · Häuser (`haus`).** Was sagt das Dokument zu Ein-, Zweifamilien-, Reihen- und Doppelhäusern?
`zuschlag` (mit `merkmal` aus den Zuschlägen, ggf. `{ efh, zfh, dhh, rh }`), `gilt`, `orientierung`,
`oberer_spannenwert` oder `ausgeschlossen` („gilt nur für Wohnungen in Mehrfamilienhäusern“). `fuer` begrenzt auf
Bauformen, `beleg` mit Seite. Sagt das Dokument nichts: Feld weglassen.

**8 · Danach immer:** `node tools/mietspiegel-werte-pruefen.mjs` (RC 0), `node tools/mietspiegel-verzeichnis-pruefen.mjs`
(RC 0), Verzeichnis-Satz nachziehen (`stand`, `gueltig_bis`, `quelle_geprueft_am`), am Ende einmal
`node tools/mietspiegel-naeherung-ableiten.mjs` und `node tools/mietspiegel-arbeitsliste.mjs`. Nur Dateien,
keine Datenbank, Prod nur nach Marcels OK. Jede Region schreibt nur ihre eigenen `werte/<ags>.json`; das
`verzeichnis.json` teilen sich alle: nur die eigenen Sätze ändern, Format (Einzug 1, CRLF) erhalten, vor dem
Commit neu von staging holen und mergen.

**9 · Gemeinden unter 50.000 Einwohnern** mit eigenem Mietspiegel stehen noch nicht im Verzeichnis. Wer einen findet
(z. B. Kreis-Mietspiegel), legt zuerst den Verzeichnis-Satz an (Felder siehe README), dann die Wertedatei.
