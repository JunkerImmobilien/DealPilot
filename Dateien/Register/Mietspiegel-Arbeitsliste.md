# Mietspiegel-Arbeitsliste

Erzeugt am 2026-11-26 mit `node tools/mietspiegel-arbeitsliste.mjs` aus `marktbericht/backend/src/lib/mietspiegel/verzeichnis.json` (alle Gemeinden ab 50.000 Einwohnern, Destatis 31.12.2024, dazu die Demo-Orte) und dem Ordner `werte/`.

**Gesamt:** 421 Gemeinden · verboten 98 · fertig 224 · kein 22 · gesperrt 45 · offen 18 · unklar 14

Status: **fertig** = Wertedatei frei nutzbar · **gesperrt** = Wertedatei mit Rechtevorbehalt (`freigabe: gesperrt`, nur Staging) · **verboten** = Speicherverbot im Dokument, nie eine Datei · **OFFEN** = zu ernten · **nicht_frei** = nur gegen Gebühr oder auf Anfrage · **unklar** = Art erst klären · **kein** = Gemeinde hat keinen.

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
`oberer_spannenwert` oder `ausgeschlossen` („gilt nur für Wohnungen in Mehrfamilienhäusern“). `gilt_fuer` begrenzt auf
Bauformen, `beleg` mit Seite. Sagt das Dokument nichts: Feld weglassen.

**8 · Danach immer:** `node tools/mietspiegel-werte-pruefen.mjs` (RC 0), `node tools/mietspiegel-verzeichnis-pruefen.mjs`
(RC 0), Verzeichnis-Satz nachziehen (`stand`, `gueltig_bis`, `quelle_geprueft_am`), am Ende einmal
`node tools/mietspiegel-naeherung-ableiten.mjs` und `node tools/mietspiegel-arbeitsliste.mjs`. Nur Dateien,
keine Datenbank, Prod nur nach Marcels OK. Jede Region schreibt nur ihre eigenen `werte/<ags>.json`; das
`verzeichnis.json` teilen sich alle: nur die eigenen Sätze ändern, Format (Einzug 1, CRLF) erhalten, vor dem
Commit neu von staging holen und mergen.

**9 · Gemeinden unter 50.000 Einwohnern** mit eigenem Mietspiegel stehen noch nicht im Verzeichnis. Wer einen findet
(z. B. Kreis-Mietspiegel), legt zuerst den Verzeichnis-Satz an (Felder siehe README), dann die Wertedatei.

**Hausregel und Bauformen (v5080, Marcel 26.11.2026 „recherchieren, was richtig ist“):** `haus.gilt_fuer` nach dem
Wortlaut des Dokuments, `gilt_fuer_herkunft: "wortlaut"`. Ist er unklar (nur „Einfamilienhaus“), gilt die Rechtslage:
ohne „freistehend“ umfasst das Einfamilienhaus auch Doppelhaushälfte und Reihenhaus (§ 181 Abs. 2 BewG, AG Hanau),
Zweifamilienhaus nur, wo genannt; dann `gilt_fuer_herkunft: "rechtslage"` mit `gilt_fuer_begruendung`.

## Region Nord (SH, HH, NI, HB, MV) · verboten 16, fertig 40, kein 5, gesperrt 1, offen 2

### Schleswig-Holstein · 10 Gemeinden · verboten 3, fertig 4, kein 3

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Kiel | 01002000 | 252.668 | qualifiziert | regression | frei | nächste 2027 | verboten (Speicherverbot) | [Quelle](https://www.kiel.de/de/kiel_zukunft/wohnen/_dokumente_mietspiegel/kieler_mietspiegel_2025.pdf) |
| Lübeck | 01003000 | 216.889 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://bekanntmachungen.luebeck.de/dokumente/d/1621/inline) |
| Flensburg | 01001000 | 96.326 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.flensburg.de/loadDocument.phtml?ObjSvrID=2306&ObjID=18065&ObjLa=1&Ext=PDF) |
| Norderstedt | 01060063 | 82.844 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.norderstedt.de/media/custom/3224_521_1.PDF?1758182188) |
| Neumünster | 01004000 | 79.809 | einfach | tabelle | frei PDF kostenlos; gedruckt 3,50 € im Bürgerbüro (+1,80 € Porto) | 2028-06-01 | fertig | [Quelle](https://www.neumuenster.de/fileadmin/neumuenster.de/media/wirtschaft_und_bauen/wohnen/mietspiegel/Mietspiegel_Neumuenster_2026_PDF_Internetseite.pdf) |
| Elmshorn | 01056015 | 51.342 | qualifiziert | regression | frei | 2028-07-31 | fertig | [Quelle](https://www.elmshorn.de/media/custom/3302_15145_1.PDF?1782900522) |
| Wedel | 01056050 | 34.912 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.wedel.de/rathaus-politik/dienstleistungen/was-erledige-ich-wo/vorgang/mietspiegel-erhalten-und-durchsehen-1379) |
| Reinbek | 01062060 | 28.274 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.reinbek.de/fileadmin/Gemeinde/Dateien/Buergerservice_und_Politik/Ortsrecht/Fachbereich_2/Mietspiegelbrosch%C3%BCre_Reinbek_2026.pdf) |
| Bad Oldesloe | 01062004 | 24.846 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.badoldesloe.de/Politik-und-Verwaltung/Verwaltung/Online-Dienste-und-Formulare/Mietspiegel.php?object=tx,2965.2&ModID=10&FID=2965.586.1) |
| Eckernförde | 01058043 | 21.563 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.eckernfoerde.de/Die-Stadt/Verwaltung/Ansprechpersonen-vor-Ort/index.php?FID=296.52.1&ModID=10&object=tx%7C2460.12) |

### Hamburg · 1 Gemeinden · fertig 1

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Hamburg | 02000000 | 1.862.565 | qualifiziert | tabelle | frei | nächste 2027 | fertig | [Quelle](https://dokumente.hamburg.de/resource/blob/1125234/4c27733314ff7c3144a31415cea3924c/d-mietenspiegel-broschuere-2025-data.pdf) |

### Niedersachsen · 45 Gemeinden · fertig 31, verboten 9, gesperrt 1, offen 2, kein 2

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Hannover | 03241001 | 522.131 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/957295/file/31.20.05-2024004253%20-%20Mietspiegel%202025%20-%20Hannover-final.pdf) |
| Braunschweig | 03101000 | 252.962 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.braunschweig.de/politik_verwaltung/politik/stadtrecht/2_07_Mietspiegel_Braunschweig_2025.pdf) |
| Oldenburg (Oldenburg) | 03403000 | 176.614 | qualifiziert | regression | frei 24,00 € gedruckte Broschüre, 21,00 € Dokumentation (digitale Broschüre kostenlos) |  | fertig | [Quelle](https://serviceportal.oldenburg.de/medien/dokumente/mietspielgelbroschuere_2025.pdf) |
| Osnabrück | 03404000 | 166.057 | einfach | tabelle | frei | nächste 2027-01 | fertig | [Quelle](https://www.osnabrueck.de/fileadmin/global/OSaktuell/Mietspiegel_2025_2026_online_gedreht.pdf) |
| Wolfsburg | 03103000 | 129.560 | qualifiziert | regression | frei | 2027-12-31 | fertig | [Quelle](https://statistik.stadt.wolfsburg.de/Informationsportal_15/Upload/Veroeffentlichungen/PDF/StadtWolfsburg_Mietspiegelbroschuere2026.pdf) |
| Göttingen | 03159016 | 127.259 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.goettingen.de/mietspiegel) |
| Salzgitter | 03102000 | 104.970 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.salzgitter.de/rathaus/mietspiegel/Mietspiegel.php) |
| Hildesheim | 03254021 | 98.510 | einfach | tabelle | frei | nächste 2026 | verboten (Speicherverbot) | [Quelle](https://www.stadt-hildesheim.de/wirtschaft-bauen/stadtplanung-und-stadtentwicklung/stadtentwicklung/mietspiegel/) |
| Delmenhorst | 03401000 | 81.406 | qualifiziert | regression | frei | 2027-12-31 | verboten (Speicherverbot) | [Quelle](https://www.delmenhorst.de/leben/bauen/mietspiegel.php) |
| Wilhelmshaven | 03405000 | 75.745 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.wilhelmshaven.de/PDF/Amtliche_Dokumente/61/2025_12_01__Mietspiegelbroschuere_WHV2026.pdf) |
| Lüneburg | 03355022 | 74.785 | qualifiziert | regression | frei | 2028-01-31 | fertig | [Quelle](https://www.hansestadt-lueneburg.de/_Resources/Persistent/6/e/c/0/6ec077feddf0eb29a0e1aa5d8fe7d210414bb65a/Lu%CC%88neburg_2026_Mietspiegel_A4_Broschu%CC%88re.pdf) |
| Celle | 03351006 | 66.834 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://portal.celle.de/dienstleistungen/-/egov-bis-detail/dokument/98770/download) |
| Garbsen | 03241005 | 59.903 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/644659/file/Mietspiegel_Garbsen_2025.pdf) |
| Hameln | 03252006 | 58.244 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.hameln.de/fileadmin/media/Dokumente/Abt._41_Stadtentwicklung_und_Planung/Mietspiegel/Mietspiegelbroschuere_Stadt_Hameln_2025.pdf) |
| Nordhorn | 03456015 | 56.973 | qualifiziert | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.nordhorn.de/portal/seiten/mietspiegel-900000788-26710.html) |
| Lingen (Ems) | 03454032 | 56.498 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.lingen.de/pdf_files/mietspiegel-2026_14309_1.pdf) |
| Langenhagen | 03241010 | 54.142 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/542200/file/Mietspiegel_Langenhagen_2025.pdf) |
| Wolfenbüttel | 03158037 | 52.604 | qualifiziert | punkte | frei | 2027-12-31 | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.wolfenbuettel.de/Stadtleben/Planen-Bauen-und-Wohnen/Mietspiegel/) |
| Peine | 03157006 | 50.987 | qualifiziert | tabelle | frei | 2028-02-28 | fertig | [Quelle](https://www.peine.de/de-wAssets/docs/mediadaten_stadt/eigene_daten/Hochbau/Bauleitplaene-Stadtplanung/Laufende/Broschuere-Mietspiegel-2026-Fortschreibung_ohne_leere_Seite.pdf) |
| Cuxhaven | 03352011 | 49.697 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hwg-cuxhaven.de/wp/wp-content/uploads/2026/02/Mietspiegel-Cuxhaven-u-Landkreis-Hochformat-ab-2026.pdf) |
| Emden | 03402000 | 49.202 | einfach | tabelle | frei |  | OFFEN | [Quelle](https://www.emden.de/fileadmin/media/stadtemden/PDF/FB_300/FD_361/Mietspiegel-Emden_Fortschreibung_2023.pdf) |
| Neustadt am Rübenberge | 03241012 | 44.668 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/644661/file/Mietspiegel_Neustadt_am_Ruebenberge_2025.pdf) |
| Lehrte | 03241011 | 44.255 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/644660/file/Mietspiegel_Lehrte_2025.pdf) |
| Aurich | 03452001 | 42.612 | einfach | tabelle | frei |  | OFFEN | [Quelle](http://www.aurich.de/fileadmin/user_upload/pdf-files/Mietspiegel_2022_-_korrigierte_Fassung_vom_12.07.2023.pdf) |
| Laatzen | 03241009 | 41.838 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/528890/file/Mietspiegel_Laatzen_2025.pdf) |
| Buchholz in der Nordheide | 03353005 | 41.737 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.buchholz.de/buergerservice/dienstleistungen/mietspiegel-154-0.html?myMedium=1&selected_kommune=20101) |
| Wunstorf | 03241021 | 41.211 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/542202/file/Mietspiegel_Wunstorf_2025.pdf) |
| Buxtehude | 03359010 | 40.886 | qualifiziert | regression | frei | 2026-11-30 | verboten (Speicherverbot) | [Quelle](https://www.buxtehude.de/downloads/datei/ZWZjODk1Njc2OGRlZWNlNTVueFgydW45NWw5K21lNWhmSDlVak5Ub0hCOWlGM2ExeC8wVzZjMWN3b3FDalFqSjFWTHl0cjhZVzVLZTNDeERxVE1Zd2hwK2l6UGJMdTdoL1o5TWkvYzRSTUZkVHppTDFyVThXRC91SGhPM3pHY1hRTHBIenFtb2lxMTZUcHNObXQzVnNIVVRTTmw0RzhFZHYzSUUyRGg2NG5hMWhrRHFBS1pHaFFPMzFXOD0) |
| Winsen (Luhe) | 03353040 | 36.961 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.winsen.de/downloads/datei/NzYzMzg2ZTQyM2RkMjRjZmNWUDkyK0NrR3g0QlovM2ZEa3hhOUsvYWNTejdqVkEyVDlDNnpXa3dJTEh6K2wzSFJPZy8rSXVCZkRGZWtIZU9aRzNxZWV4bUMxeU9UWSsxdDdoWXFYQjhZNjRGVlpHSE4yL2kzUEkwOGNGNDZxYit3K3lURS81ZUVLNndaQUJCTFRSaWlrMFVWU1ppNk91MlU1SGo0QT09) |
| Meppen | 03454035 | 36.930 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.meppen.de/buergerservice/dienstleistungen/mietspiegel-900000345-0.html?myMedium=1) |
| Seelze | 03241015 | 34.364 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/528888/file/Mietspiegel_Seelze_2025.pdf) |
| Barsinghausen | 03241002 | 33.941 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/644658/file/Mietspiegel_Barsinghausen_2025.pdf) |
| Burgdorf | 03241003 | 31.051 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/528889/file/Mietspiegel_Burgdorf_2025.pdf) |
| Wedemark | 03241019 | 29.803 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/542201/file/Mietspiegel_Wedemark_2025.pdf) |
| Springe | 03241017 | 28.669 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/651035/file/Mietspiegel_Springe_2025.pdf) |
| Isernhagen | 03241008 | 24.074 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/541292/file/Mietspiegel_Isernhagen_2025.pdf) |
| Ronnenberg | 03241014 | 23.814 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/644662/file/Mietspiegel_Ronnenberg_2025.pdf) |
| Sehnde | 03241016 | 23.431 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/528892/file/Mietspiegel_Sehnde_2025.pdf) |
| Burgwedel | 03241004 | 20.379 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/542198/file/Mietspiegel_Burgwedel_2025.pdf) |
| Uetze | 03241018 | 20.064 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/644663/file/Mietspiegel_Uetze_2025.pdf) |
| Hemmingen | 03241007 | 18.932 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/533041/file/Mietspiegel_Hemmingen_2025.pdf) |
| Gehrden | 03241006 | 15.301 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/544628/file/Mietspiegel_Gehrden_2025.pdf) |
| Pattensen | 03241013 | 14.666 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/528891/file/Mietspiegel_Pattensen_2025.pdf) |
| Wennigsen (Deister) | 03241020 | 14.251 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hannover.de/content/download/528887/file/Mietspiegel_Wennigsen_2025.pdf) |
| Otterndorf | 03352046 | 7.515 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hwg-cuxhaven.de/wp/wp-content/uploads/2026/02/Mietspiegel-Cuxhaven-u-Landkreis-Hochformat-ab-2026.pdf) |

### Bremen · 2 Gemeinden · fertig 1, verboten 1

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Bremen | 04011000 | 586.271 | qualifiziert | regression | frei | 2027-12-31 | fertig | [Quelle](https://www.bab-bremen.de/sixcms/media.php/49/Broschuere_Mietspiegel_2026_Web.pdf) |
| Bremerhaven | 04012000 | 118.610 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://ivd.net/wp-content/uploads/2025/04/Mietspiegel-2025-2026.pdf) |

### Mecklenburg-Vorpommern · 6 Gemeinden · fertig 3, verboten 3

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Rostock | 13003000 | 205.307 | qualifiziert | regression | frei | 2028-04-30 | fertig | [Quelle](https://rathaus.rostock.de/de/wirtschaft_verkehr/wohnen/mietspiegel/249767) |
| Schwerin | 13004000 | 98.308 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.schwerin.de/export/sites/default/.galleries/Dokumente/Planen-Bauen/Grundstuecksmarkt/Dokumentation-zum-Mietspiegel-2026-2027.pdf) |
| Neubrandenburg | 13071107 | 60.344 | qualifiziert | tabelle | frei | 2027-06-30 | fertig | [Quelle](https://www.neubrandenburg.de/media/custom/3330_7534_1.PDF?1751262492) |
| Greifswald | 13075039 | 56.092 | qualifiziert | regression | frei | 2028-02-29 | verboten (Speicherverbot) | [Quelle](https://www.greifswald.de/de/.galleries/dokumente/Pressestelle-Dokumente/2026-04-14-BV-V_08_0261-Mietspiegelbroschuere-Greifswald-2026.pdf) |
| Stralsund | 13073088 | 54.094 | qualifiziert | tabelle | frei | 2027-12-31 | verboten (Speicherverbot) | [Quelle](https://service.stralsund.de/dienstleistungen/-/egov-bis-detail/dienstleistung/23498/show) |
| Wismar | 13074087 | 43.329 | qualifiziert | regression | frei | 2027-12-31 | verboten (Speicherverbot) | [Quelle](https://www.wismar.de/PDF/Mietspiegel_2026_2027.PDF?ObjSvrID=4176&ObjID=474&ObjLa=1&Ext=PDF&WTR=1&_ts=1765369849) |

## Region West (NW) · verboten 14, fertig 123, gesperrt 29, offen 4, unklar 11

### Nordrhein-Westfalen · 181 Gemeinden · verboten 14, fertig 123, gesperrt 29, offen 4, unklar 11

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Köln | 05315000 | 1.024.621 | einfach | tabelle | frei gedruckt 4,00 € zzgl. Porto beim Mieterverein Köln |  | verboten (Speicherverbot) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/Koeln_2025_1621.pdf) |
| Düsseldorf | 05111000 | 618.685 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://hausundgrundddf.de/wp-content/uploads/2026/08/Mietspiegel-Duesseldorf-08-2026_web_s.pdf) |
| Dortmund | 05913000 | 603.462 | qualifiziert | tabelle | frei | 2026-12-31 | fertig | [Quelle](https://www.dortmund.de/themen/wohnen/mietspiegel/) |
| Essen | 05113000 | 574.682 | qualifiziert | tabelle | frei | 2028-07-31 | verboten (Speicherverbot) | [Quelle](https://service.essen.de/detail/-/vr-bis-detail/dokument/7025891/download) |
| Duisburg | 05112000 | 502.270 | qualifiziert | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://duisburg.de/microsites/wohnen-in-duisburg/wohnungsmarkt-in-zahlen/mietspiegel.php) |
| Bochum | 05911000 | 358.676 | qualifiziert | tabelle | frei | 2027-03-31 | fertig | [Quelle](https://www.bochum.de/C125830C0042AB74/vwContentByKey/W2DF7CV7419BOCMDE/$FILE/Mietspiegel_Bochum_2025_27.pdf) |
| Wuppertal | 05124000 | 358.193 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://wuppertal.de/vv/produkte/105/102370100000364921.php.media/535422/Mietspiegel.pdf) |
| Bielefeld | 05711000 | 331.605 | qualifiziert | regression | frei | 2028-06-30 | fertig | [Quelle](https://www.bielefeld.de/mietspiegel) |
| Bonn | 05314000 | 323.336 | qualifiziert | regression | frei |  | fertig | [Quelle](https://bonn.de/themen-entdecken/soziales-gesellschaft/mietspiegel.php) |
| Münster | 05515000 | 308.258 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.stadt-muenster.de/fileadmin/user_upload/stadt-muenster/64_wohnungsamt/pdf/Wohnraumfoerderung/Mietspiegel/2025/Mietspiegel_2025_WEB.pdf) |
| Gelsenkirchen | 05513000 | 267.930 | einfach | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.gelsenkirchen.de/de/infrastruktur/bauen_und_wohnen/wohnungssuche/mietspiegel.aspx) |
| Mönchengladbach | 05116000 | 267.213 | einfach | regression | frei | nächste 2028 | fertig | [Quelle](https://www.moenchengladbach.de/fileadmin/user_upload/FB62/Mietspiegel/Mietspiegel_2026_Download.pdf) |
| Aachen | 05334002 | 262.670 | qualifiziert | regression | frei |  | fertig | [Quelle](https://serviceportal.aachen.de/suche/-/vr-bis-detail/dienstleistung/3218/show) |
| Krefeld | 05114000 | 231.406 | einfach | tabelle | frei | nächste 2027-08-01 | fertig | [Quelle](https://www.krefeld.de/fb62) |
| Oberhausen | 05119000 | 213.646 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.oberhausen.de/de/index/rathaus/verwaltung/stadtplanung-bauen-mobilitat-umwelt/geoinformation-und-kataster/grundstueckswertermittlung/grundstueckswertermittlung_material/mietspiegel_2025.pdf) |
| Hagen | 05914000 | 190.384 | qualifiziert | regression | frei 10,00 € gedruckt | 2027-09-30 | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hagen.de/dateien/aus-dem-rathaus/fachbereiche-und-aemter/a-z/fachbereich-geoinformation-und-liegenschaftskataster/mietspiegel-2025-hagen.pdf) |
| Hamm | 05915000 | 179.968 | qualifiziert | regression | frei | nächste 2027 | fertig | [Quelle](https://www.hamm.de/fileadmin/user_upload/Medienarchiv_neu/Dokumente/Vermessungs-und-Katasteramt/Mietspiegel_2025_Hamm.pdf) |
| Mülheim an der Ruhr | 05117000 | 173.050 | qualifiziert | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://cms.muelheim-ruhr.de/sites/default/files/2026-01/Mietspiegel-2026_.pdf) |
| Leverkusen | 05316000 | 168.581 | qualifiziert | tabelle | frei | 2027-11-30 | verboten (Speicherverbot) | [Quelle](https://www.leverkusen.de/stadt-entwickeln/planen-bauen/dokumente-planen-und-bauen/Mietspiegel-Leverkusen-2025-Broschuere_Fortschreibung.pdf) |
| Solingen | 05122000 | 165.626 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.mieterbundrbl.de/wp-content/uploads/2025/01/Mietspiegel_2025.pdf) |
| Paderborn | 05774032 | 156.378 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.paderborn.de/wohnen-soziales/bauen-wohnen/mietspiegel.php.media/297832/Mietspiegel_25_Web.pdf) |
| Herne | 05916000 | 155.851 | qualifiziert | tabelle | frei | 2026-12-31 | fertig | [Quelle](https://herne.de/PDF/mietspiegel/mietspiegel.pdf) |
| Neuss | 05162024 | 154.317 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.mieterverein-duesseldorf.de/fileadmin/user_upload/redaktion/duesseldorf-2025/Downloads/Mietspiegel/Mietspiegel_Neuss_2026.pdf) |
| Bottrop | 05512000 | 118.535 | einfach | punkte | frei | nächste 2027-01-01 | fertig | [Quelle](https://www.bottrop.de/downloads/wohnen/Mietspiegel-2025.pdf) |
| Recklinghausen | 05562032 | 115.344 | einfach | tabelle | frei gedruckt kostenlos im Bürgerbüro | 2027-12-31 | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://bso.gkd-re.de/bsointer320/redirect?mandant=320&netz=4&typ=2&id=11906) |
| Remscheid | 05120000 | 113.828 | qualifiziert | unbekannt | frei |  | verboten (Speicherverbot) | [Quelle](https://www.remscheid.de/vv/produkte/2.50/146380100000023192.php.media/46313/MSP-Stadt-Remscheid-2024-Broschuere.pdf) |
| Bergisch Gladbach | 05378004 | 111.361 | einfach | tabelle | frei Schutzgebühr 4,00 € für das gedruckte Exemplar; PDF frei abrufbar |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/2026_Mietspiegel_1661.pdf) |
| Siegen | 05970040 | 102.685 | einfach | punkte | frei |  | fertig | [Quelle](https://www.mieterbund-siegerland.de/images/download/mietspiegel/Mietspiegel_Altkreis_Siegen_2026.pdf) |
| Moers | 05170024 | 101.503 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hausundgrund-moers.de/fileadmin/moers/media/downloads/Mietspiegel_Moers_2025_download.pdf) |
| Gütersloh | 05754008 | 100.479 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.guetersloh.de/de/rathaus/fachbereiche-und-einrichtungen/bauverwaltungsservice/mietspiegel.php) |
| Düren | 05358008 | 94.568 | qualifiziert | regression | frei | 2026-12-31 | fertig | [Quelle](https://www.dueren.de/leben-wohnen/bauen-wohnen/wohnen/mietspiegel) |
| Iserlohn | 05962024 | 91.811 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Witten | 05954036 | 91.808 | qualifiziert | tabelle | frei | nächste 2027-07-01 | fertig | [Quelle](https://www.witten.de/medien/dokumente/mietspiegel_2025.pdf) |
| Ratingen | 05158028 | 89.368 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.mieterverein-duesseldorf.de/fileadmin/user_upload/redaktion/duesseldorf/Mietspiegel/Mietspiegel-Ratingen-08-2026.pdf) |
| Marl | 05562024 | 86.766 | einfach | tabelle | frei | 2028-03-31 | fertig | [Quelle](https://www.marl.de/fileadmin/user_upload/Dokumente/Amt_61/Mietspiegel_2026.pdf) |
| Lünen | 05978024 | 86.163 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.luenen.de/de-wAssets/docs/PDFs/antraege_wohnen/Mietspiegel-Luenen-2026-Broschuere.pdf) |
| Minden | 05770024 | 84.013 | qualifiziert | tabelle | frei | 2028-04-30 | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.minden.de/wirtschaft-mobilitaet-wohnen/wohnen-bauen/mietspiegel/) |
| Velbert | 05158032 | 82.463 | einfach | tabelle | frei gedruckt beim Mieterverein, Schutzgebühr 3,00 € (Angabe evtl. veraltet) |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://serviceportal.velbert.de/detail/-/vr-bis-detail/dokument/570630/download) |
| Viersen | 05166032 | 78.373 | einfach | tabelle | frei PDF frei; gedruckt 1,50 € Abholung, 3,00 € Versand |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.viersen.de/system/files/2025-01/Mietspiegel_2025_gueltig%20ab%2001.01.2025.pdf) |
| Rheine | 05566076 | 77.209 | qualifiziert | regression | frei gedruckt kostenlos (Rathausinformation, Geschäftsstelle Gutachterausschuss) | 2028-06-30 | OFFEN | [Quelle](https://www.rheine.de/rathaus-service/verwaltung/bw_/Mietspiegel/index.html?detID=2321) |
| Troisdorf | 05382068 | 75.901 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.troisdorf.de/de/rathaus-service/buergerservice/wohnungsamt/mietspiegel/) |
| Gladbeck | 05562014 | 75.499 | qualifiziert | tabelle | frei |  | OFFEN | [Quelle](https://www.gladbeck.de/Leben_Wohnen/Bauen_Wohnen/Mietspiegel.asp) |
| Dorsten | 05562012 | 75.277 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.dorsten.de/_Resources/Persistent/a/e/7/8/ae78abd0ae4e1507b519961960184be7e6e454e3/Dorsten_Mietspiegel_2025_150725.pdf) |
| Arnsberg | 05958004 | 74.879 | qualifiziert | tabelle | frei | nächste 2027 | verboten (Speicherverbot) | [Quelle](https://www.arnsberg.de/wohnen-leben/planen-bauen/stadtplanung/wohnflaechenentwicklung/mietspiegel) |
| Detmold | 05766020 | 74.278 | qualifiziert | regression | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://serviceportal-detmold.de/detail/-/vr-bis-detail/dienstleistung/11822/show) |
| Castrop-Rauxel | 05562004 | 73.282 | einfach | regression | frei | nächste 2026 | verboten (Speicherverbot) | [Quelle](https://www.castrop-rauxel.de/sites/default/files/2025-04/Mietspiegel%20und%20Dokumentation%202025.pdf) |
| Bocholt | 05554008 | 73.257 | qualifiziert | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.bocholt.de/mietspiegel) |
| Lüdenscheid | 05962032 | 71.212 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Lippstadt | 05974028 | 68.739 | einfach | tabelle | frei gedruckt in der Bürgerberatung erhältlich |  | fertig | [Quelle](https://www.lippstadt.de/fileadmin/user_upload/Mietspiegel_2025.pdf) |
| Herford | 05758012 | 67.503 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.herford.de/mietspiegel) |
| Dinslaken | 05170008 | 66.993 | einfach | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.dinslaken.de/system/files/2025-12/Mietspiegel%202026-2027.pdf) |
| Kerpen | 05362032 | 66.585 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/2026_Kerpen_1751.pdf) |
| Grevenbroich | 05162008 | 65.983 | unklar | unbekannt | kostenpflichtig Preis nicht angegeben |  | unklar, erst Art klären | [Quelle](https://grevenbroich.de/rathaus-buergerservice/dienstleistungen-a-z/dienstleistung/mietspiegel) |
| Dormagen | 05162004 | 63.799 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hausundgrundneuss.de/fileadmin/neuss/media/pdfs/Mietspiegel_Dormagen_2023.pdf) |
| Hürth | 05362028 | 62.160 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://web.rheinische-immobilienboerse.de/upload/Huerth_2026_1736.pdf) |
| Bergheim | 05362008 | 61.611 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://web.rheinische-immobilienboerse.de/upload/Bergheim_2026_1721.pdf) |
| Herten | 05562020 | 60.941 | unklar | tabelle | frei |  | unklar, erst Art klären | [Quelle](https://www.herten.de/fileadmin/user_upload/citkoBuerger/Sozialamt/Mietspiegel_2025_2027.pdf) |
| Wesel | 05170048 | 60.785 | einfach | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.wesel.de/system/files/2025-02/Mietspiegel%20Wesel%202025.pdf) |
| Euskirchen | 05366016 | 60.021 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.euskirchen.de/fileadmin/user_upload/PDF/service/Mietspiegel_2026.pdf) |
| Langenfeld (Rheinland) | 05158020 | 59.975 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://service.langenfeld.de/detail/-/vr-bis-detail/dienstleistung/768900/show) |
| Unna | 05978036 | 58.333 | qualifiziert | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.gars.nrw/images/user/GA_Kreis_Unna/Mietspiegel/Mietspiegel_2026_Unna.pdf) |
| Stolberg (Rhld.) | 05334032 | 57.684 | unklar | tabelle | frei | 2027-12-31 | unklar, erst Art klären | [Quelle](https://www.stolberg.de/Mietspiegel-2026.pdf) |
| Eschweiler | 05334012 | 57.534 | einfach | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://service.eschweiler.de/detail/-/vr-bis-detail/dokument/1735704/download) |
| Meerbusch | 05162022 | 57.078 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://hausundgrundddf.de/wp-content/uploads/2025/06/MS-Meerbusch-07-2025-s.pdf) |
| Sankt Augustin | 05382056 | 56.521 | qualifiziert | regression | frei | 2027-12-31 | fertig | [Quelle](https://www.sankt-augustin.de/fortschreibung-des-qualifizierten-mietspiegels-liegt-vor/) |
| Pulheim | 05362036 | 56.150 | einfach | tabelle | frei | nächste 2026 | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/2026_Pulheim_1761.pdf) |
| Hilden | 05158016 | 55.157 | einfach | regression | frei | 2027-12-31 | verboten (Speicherverbot) | [Quelle](https://www.hilden.de/de/stadt-rathaus/buergerservice/wichtige-anlaufstellen/mietspiegel/einfacher-mietspiegel-stadt-hilden-2026.pdf?cid=h2j) |
| Bad Salzuflen | 05766008 | 53.958 | qualifiziert | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.stadt-bad-salzuflen.de/wirtschaft-und-mobilitaet/wirtschaftsstandort/online-mietspiegelrechner) |
| Hattingen | 05954016 | 53.044 | qualifiziert | tabelle | frei | nächste 2027-06-01 | fertig | [Quelle](https://www.hattingen.de/stadt_hattingen/Rathaus/Fachbereiche/Soziales%20und%20Wohnen/Mietspiegel/mietspiegel_hattingen_2025.pdf) |
| Kleve | 05154036 | 53.028 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.kleve.de/system/files/2025-08/Mietspiegel%20Stadt%20Kleve%202025.pdf) |
| Ahlen | 05570004 | 52.666 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://serviceportal.ahlen.de/detail/-/vr-bis-detail/dienstleistung/111940/show) |
| Frechen | 05362024 | 52.309 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/2026_Frechen_1771.pdf) |
| Menden (Sauerland) | 05962040 | 52.255 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.menden.de/fileadmin/user_upload/Leben_in_Menden/Mietspiegel/mietspiegel_hsk_mk_01.04.2026.pdf) |
| Ibbenbüren | 05566028 | 51.803 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.ibbenbueren.de/media/custom/3030_9012_1.PDF) |
| Gummersbach | 05374012 | 51.290 | einfach | online_rechner | online_rechner | nächste 2027-10-01 | OFFEN (nur Online-Rechner, Dokumentation suchen) | [Quelle](https://rio.obk.de/omix/omix.php) |
| Bad Oeynhausen | 05770004 | 50.620 | einfach | unbekannt | frei |  | fertig | [Quelle](https://www.badoeynhausen.de/rathaus-service-politik/stadtverwaltung/was-erledige-ich-wo/dienstleistungen-a-z/mietspiegel) |
| Gronau (Westf.) | 05554020 | 50.547 | unklar | unbekannt |  |  | unklar, erst Art klären |  |
| Bergkamen | 05978004 | 49.143 | qualifiziert | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.gars.nrw/images/user/GA_Kreis_Unna/Mietspiegel/Mietspiegel_2026_Bergkamen.pdf) |
| Erftstadt | 05362020 | 48.772 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/2026_Erftstadt_1752.pdf) |
| Hennef (Sieg) | 05382020 | 48.188 | qualifiziert | regression | frei | 2027-06-30 | verboten (Speicherverbot) | [Quelle](https://www.hausundgrund.de/verein/bonn-rhein-sieg/sites/default/files/downloads/hennef2025mietspiegelv9web.pdf) |
| Rheda-Wiedenbrück | 05754028 | 48.030 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.borgholzhausen.de/soziales-bildung-sport/soziale-angelegenheiten/wohnen/mietspiegel/mietspiegeldokumentation-2026.pdf?cid=3d7) |
| Dülmen | 05558016 | 47.989 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://www.kreis-coesfeld.de/media/GAA/Downloads/Duelmen2024.pdf) |
| Bünde | 05758004 | 46.365 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.buende.de/PDF/Mietspiegel_ab_01_11_2025.PDF?ObjSvrID=608&ObjID=3461&ObjLa=1&Ext=PDF&WTR=1&_ts=1762332181) |
| Schwerte | 05978028 | 45.821 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Brühl | 05362012 | 45.555 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/Bru_hl_2026_1734.pdf) |
| Kaarst | 05162016 | 43.295 | einfach | tabelle | frei Schutzgebühr 3,00 € für das gedruckte Exemplar; PDF frei abrufbar |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hausundgrundneuss.de/fileadmin/neuss/media/pdfs/Mietspiegel_Kaarst_2023.pdf) |
| Kamen | 05978020 | 42.319 | qualifiziert | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.gars.nrw/images/user/GA_Kreis_Unna/Mietspiegel/Mietspiegel_2026_Kamen.pdf) |
| Löhne | 05758024 | 40.826 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.loehne.de/mietspiegel) |
| Coesfeld | 05558012 | 38.237 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://www.kreis-coesfeld.de/media/GAA/Downloads/Coesfeld2024.pdf) |
| Kamp-Lintfort | 05170020 | 38.217 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hausundgrund-moers.de/fileadmin/moers/media/downloads/Mietspiegel_Kamp-Lintfort_2025_download.pdf) |
| Wesseling | 05362040 | 38.106 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/2026_Wesseling_1772.pdf) |
| Warendorf | 05570052 | 37.703 | qualifiziert | tabelle | frei | 2028-03-31 | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.warendorf.de/de/stadt/stadtverwaltung/satzungen-verordnungen/alphabetische-uebersicht/5-03-qualifizierter-mietspiegel-2026-31.03.2026.pdf?cid=i0g) |
| Porta Westfalica | 05770032 | 36.521 | unklar | tabelle | frei |  | unklar, erst Art klären | [Quelle](https://www.hausundgrund.de/verein/minden/sites/default/files/downloads/mietspiegelporta2023.pdf) |
| Emsdetten | 05566008 | 36.159 | qualifiziert | regression | frei |  | OFFEN | [Quelle](https://www.emsdetten.de/pdfs/bauen-wohnen-umwelt-verkehr/wohnen/fortschreibung-mietspiegel-emsdetten-2026.pdf?cid=1xod) |
| Hemer | 05962016 | 35.005 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Goch | 05154016 | 34.907 | unklar | tabelle | frei |  | unklar, erst Art klären | [Quelle](https://goch.de/system/files/2023-06/Mietspiegel%202023.pdf) |
| Korschenbroich | 05162020 | 34.600 | einfach | tabelle | frei Schutzgebühr 3,00 € für das gedruckte Exemplar; PDF frei abrufbar |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hausundgrundneuss.de/fileadmin/neuss/media/pdfs/Mietspiegel_Korschenbroich_2023.pdf) |
| Rheinberg | 05170032 | 31.172 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hausundgrund-moers.de/fileadmin/moers/media/downloads/Mietspiegel_Rheinberg_2025_download.pdf) |
| Kreuztal | 05970024 | 30.905 | einfach | punkte | frei |  | fertig | [Quelle](https://www.mieterbund-siegerland.de/images/download/mietspiegel/Mietspiegel_Altkreis_Siegen_2026.pdf) |
| Werne | 05978040 | 30.202 | qualifiziert | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.gars.nrw/images/user/GA_Kreis_Unna/Mietspiegel/Mietspiegel_2026_Werne.pdf) |
| Rietberg | 05754032 | 30.055 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.rietberg.de/fileadmin/user_upload/LEBEN_IN_RIETBERG/Bauen_Wohnen/Mietspiegel_Rietberg_2026.pdf) |
| Meschede | 05958032 | 29.615 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Werl | 05974052 | 29.600 | unklar | tabelle | frei |  | unklar, erst Art klären | [Quelle](https://www.werl.de/fileadmin/user_upload/Formulare/Mietspiegel_Werl_2026.pdf) |
| Rösrath | 05378028 | 28.709 | einfach | tabelle | frei Schutzgebühr 4,00 € für das gedruckte Exemplar; PDF frei abrufbar |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/2026_Mietspiegel_1661.pdf) |
| Sundern (Sauerland) | 05958044 | 27.654 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Neukirchen-Vluyn | 05170028 | 27.140 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hausundgrund-moers.de/fileadmin/moers/media/downloads/Mietspiegel_Neukirchen-Vluyn_2025_download.pdf) |
| Overath | 05378024 | 26.663 | einfach | tabelle | frei Schutzgebühr 4,00 € für das gedruckte Exemplar; PDF frei abrufbar |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/2026_Mietspiegel_1661.pdf) |
| Schloß Holte-Stukenbrock | 05754036 | 26.297 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.borgholzhausen.de/soziales-bildung-sport/soziale-angelegenheiten/wohnen/mietspiegel/mietspiegeldokumentation-2026.pdf?cid=3d7) |
| Selm | 05978032 | 25.969 | qualifiziert | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.gars.nrw/images/user/GA_Kreis_Unna/Mietspiegel/Mietspiegel_2026_Selm.pdf) |
| Verl | 05754044 | 25.762 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.borgholzhausen.de/soziales-bildung-sport/soziale-angelegenheiten/wohnen/mietspiegel/mietspiegeldokumentation-2026.pdf?cid=3d7) |
| Harsewinkel | 05754016 | 25.523 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.borgholzhausen.de/soziales-bildung-sport/soziale-angelegenheiten/wohnen/mietspiegel/mietspiegeldokumentation-2026.pdf?cid=3d7) |
| Brilon | 05958012 | 25.424 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Petershagen | 05770028 | 25.340 | einfach | tabelle | frei |  | fertig | [Quelle](https://serviceportal.petershagen.de/detail/-/vr-bis-detail/dokument/37493/download) |
| Bedburg | 05362004 | 25.316 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/Bedburg_2026_1732.pdf) |
| Lüdinghausen | 05558024 | 25.265 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://www.kreis-coesfeld.de/media/GAA/Downloads/Luedinghausen2024.pdf) |
| Schmallenberg | 05958040 | 24.711 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Plettenberg | 05962052 | 24.429 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Netphen | 05970032 | 23.080 | einfach | punkte | frei |  | fertig | [Quelle](https://www.mieterbund-siegerland.de/images/download/mietspiegel/Mietspiegel_Altkreis_Siegen_2026.pdf) |
| Rees | 05154044 | 21.913 | unklar | tabelle | frei Schutzgebühr 2,50 € |  | unklar, erst Art klären | [Quelle](https://www.stadt-rees.de/bauen-wirtschaft/mietspiegel/mietspiegel-2025.pdf?cid=1qug) |
| Versmold | 05754048 | 21.513 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.versmold.de/de-wAssets/docs/unsere-stadt/bauen-und-wohnen/mietspiegel/Mietspiegel2026.pdf) |
| Elsdorf | 05362016 | 21.424 | einfach | tabelle | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/2026_Elsdorf_1741.pdf) |
| Halle (Westf.) | 05754012 | 21.393 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.borgholzhausen.de/soziales-bildung-sport/soziale-angelegenheiten/wohnen/mietspiegel/mietspiegeldokumentation-2026.pdf?cid=3d7) |
| Xanten | 05170052 | 21.179 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hausundgrund-moers.de/fileadmin/moers/media/downloads/Mietspiegel_Xanten_2025_download.pdf) |
| Geseke | 05974020 | 20.930 | einfach | tabelle | frei gedruckt in der Bürgerberatung erhältlich |  | fertig | [Quelle](https://www.lippstadt.de/fileadmin/user_upload/Mietspiegel_2025.pdf) |
| Senden | 05558044 | 20.844 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://www.kreis-coesfeld.de/media/GAA/Downloads/Senden2024.pdf) |
| Enger | 05758008 | 20.688 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.enger.de/loadDocument.phtml?ObjSvrID=1470&ObjID=6005&ObjLa=1&Ext=PDF) |
| Fröndenberg/Ruhr | 05978012 | 20.504 | qualifiziert | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.gars.nrw/images/user/GA_Kreis_Unna/Mietspiegel/Mietspiegel_2026_Fr%C3%B6ndenberg.pdf) |
| Steinhagen | 05754040 | 20.302 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.borgholzhausen.de/soziales-bildung-sport/soziale-angelegenheiten/wohnen/mietspiegel/mietspiegeldokumentation-2026.pdf?cid=3d7) |
| Nottuln | 05558032 | 20.205 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://www.kreis-coesfeld.de/media/GAA/Downloads/Nottuln2024.pdf) |
| Wilnsdorf | 05970044 | 20.039 | einfach | punkte | frei |  | fertig | [Quelle](https://www.mieterbund-siegerland.de/images/download/mietspiegel/Mietspiegel_Altkreis_Siegen_2026.pdf) |
| Kürten | 05378012 | 20.033 | einfach | tabelle | frei Schutzgebühr 4,00 € für das gedruckte Exemplar; PDF frei abrufbar |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/2026_Mietspiegel_1661.pdf) |
| Meinerzhagen | 05962036 | 20.019 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Hiddenhausen | 05758016 | 19.669 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hiddenhausen.de/Wohnen/Mietspiegel/) |
| Marsberg | 05958024 | 19.555 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Weilerswist | 05366040 | 18.980 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.euskirchen.de/fileadmin/user_upload/PDF/service/Mietspiegel_2026.pdf) |
| Vlotho | 05758036 | 18.335 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.vlotho.de/PDF/Mietspiegel_2023.PDF?ObjSvrID=3136&ObjID=5768&ObjLa=1&Ext=PDF&WTR=1&_ts=1701182331) |
| Bönen | 05978008 | 17.734 | qualifiziert | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.gars.nrw/images/user/GA_Kreis_Unna/Mietspiegel/Mietspiegel_2026_B%C3%B6nen.pdf) |
| Werdohl | 05962060 | 17.618 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Holzwickede | 05978016 | 17.596 | qualifiziert | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.gars.nrw/images/user/GA_Kreis_Unna/Mietspiegel/Mietspiegel_2026_Holzwickede.pdf) |
| Freudenberg | 05970016 | 17.355 | einfach | punkte | frei |  | fertig | [Quelle](https://www.mieterbund-siegerland.de/images/download/mietspiegel/Mietspiegel_Altkreis_Siegen_2026.pdf) |
| Altena | 05962004 | 16.621 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Straelen | 05154052 | 16.458 | unklar | tabelle | frei |  | unklar, erst Art klären | [Quelle](https://www.straelen.de/bauen-wirtschaft/bauen-wohnen/mietspiegel/20250130-mietspiegel-01.02.2025.pdf?cid=1lij) |
| Kierspe | 05962028 | 16.450 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Herzebrock-Clarholz | 05754020 | 16.419 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.borgholzhausen.de/soziales-bildung-sport/soziale-angelegenheiten/wohnen/mietspiegel/mietspiegeldokumentation-2026.pdf?cid=3d7) |
| Halver | 05962012 | 16.322 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Erwitte | 05974016 | 16.300 | einfach | tabelle | frei gedruckt in der Bürgerberatung erhältlich |  | fertig | [Quelle](https://www.lippstadt.de/fileadmin/user_upload/Mietspiegel_2025.pdf) |
| Ascheberg | 05558004 | 15.831 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://www.kreis-coesfeld.de/media/GAA/Downloads/Ascheberg2024.pdf) |
| Odenthal | 05378020 | 15.782 | einfach | tabelle | frei Schutzgebühr 4,00 € für das gedruckte Exemplar; PDF frei abrufbar |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rheinische-immobilienboerse.de/upload/2026_Mietspiegel_1661.pdf) |
| Olsberg | 05958036 | 14.700 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Burbach | 05970008 | 14.553 | einfach | punkte | frei |  | fertig | [Quelle](https://www.mieterbund-siegerland.de/images/download/mietspiegel/Mietspiegel_Altkreis_Siegen_2026.pdf) |
| Kalkar | 05154024 | 14.513 | unklar | tabelle | frei |  | unklar, erst Art klären | [Quelle](https://www.kalkar.de/system/files/2025-03/Mietspiegel%20Stadt%20Kalkar_2024.pdf) |
| Hilchenbach | 05970020 | 14.412 | einfach | punkte | frei |  | fertig | [Quelle](https://www.mieterbund-siegerland.de/images/download/mietspiegel/Mietspiegel_Altkreis_Siegen_2026.pdf) |
| Hüllhorst | 05770016 | 13.304 | unklar | unbekannt |  |  | unklar, erst Art klären |  |
| Kerken | 05154028 | 13.186 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hausundgrund-moers.de/fileadmin/moers/media/downloads/Mietspiegel_Kerken_2025_download.pdf) |
| Olfen | 05558036 | 13.175 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://www.kreis-coesfeld.de/media/GAA/Downloads/Olfen2024.pdf) |
| Winterberg | 05958048 | 13.168 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Neunkirchen | 05970036 | 12.705 | einfach | punkte | frei |  | fertig | [Quelle](https://www.mieterbund-siegerland.de/images/download/mietspiegel/Mietspiegel_Altkreis_Siegen_2026.pdf) |
| Alpen | 05170004 | 12.515 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hausundgrund-moers.de/fileadmin/moers/media/downloads/Mietspiegel_Alpen_2025_download.pdf) |
| Issum | 05154020 | 12.428 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hausundgrund-moers.de/fileadmin/moers/media/downloads/Mietspiegel_Issum_2025_download.pdf) |
| Havixbeck | 05558020 | 12.357 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://www.kreis-coesfeld.de/media/GAA/Downloads/Havixbeck2024.pdf) |
| Billerbeck | 05558008 | 11.945 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://www.kreis-coesfeld.de/media/GAA/Downloads/Billerbeck2024.pdf) |
| Neuenrade | 05962048 | 11.621 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Rosendahl | 05558040 | 11.249 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://www.kreis-coesfeld.de/media/GAA/Downloads/Rosendahl2024.pdf) |
| Balve | 05962008 | 11.240 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Werther (Westf.) | 05754052 | 11.051 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.borgholzhausen.de/soziales-bildung-sport/soziale-angelegenheiten/wohnen/mietspiegel/mietspiegeldokumentation-2026.pdf?cid=3d7) |
| Nordkirchen | 05558028 | 10.762 | qualifiziert | tabelle | frei | 2026-11-30 | fertig | [Quelle](https://www.kreis-coesfeld.de/media/GAA/Downloads/Nordkirchen2024.pdf) |
| Schalksmühle | 05962056 | 10.463 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Anröchte | 05974004 | 10.304 | einfach | tabelle | frei gedruckt in der Bürgerberatung erhältlich |  | fertig | [Quelle](https://www.lippstadt.de/fileadmin/user_upload/Mietspiegel_2025.pdf) |
| Rüthen | 05974036 | 10.290 | einfach | tabelle | frei gedruckt in der Bürgerberatung erhältlich |  | fertig | [Quelle](https://www.lippstadt.de/fileadmin/user_upload/Mietspiegel_2025.pdf) |
| Bestwig | 05958008 | 10.147 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Rödinghausen | 05758028 | 10.064 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.roedinghausen.de/loadDocument.phtml?ObjSvrID=3463&ObjID=1473&ObjLa=1&Ext=PDF) |
| Borgholzhausen | 05754004 | 8.847 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.borgholzhausen.de/soziales-bildung-sport/soziale-angelegenheiten/wohnen/mietspiegel/mietspiegel-borgholzhausen-2026.pdf?cid=3d4) |
| Eslohe (Sauerland) | 05958016 | 8.717 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Sonsbeck | 05170040 | 8.688 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hausundgrund-moers.de/fileadmin/moers/media/downloads/Mietspiegel_Sonsbeck_2025_download.pdf) |
| Langenberg | 05754024 | 8.311 | qualifiziert | tabelle | frei | nächste 2028 | fertig | [Quelle](https://www.langenberg.de/startseite/leben-in-langenberg/bauen-wohnen/mietspiegel/mietspiegel-langenberg-2026.pdf?cid=gon) |
| Wachtendonk | 05154060 | 8.217 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hausundgrund-moers.de/fileadmin/moers/media/downloads/Mietspiegel_Wachtendonk_2025_download.pdf) |
| Medebach | 05958028 | 7.906 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Herscheid | 05962020 | 6.821 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Rheurdt | 05154048 | 6.450 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.hausundgrund-moers.de/fileadmin/moers/media/downloads/Mietspiegel_Rheurdt_2025_download.pdf) |
| Nachrodt-Wiblingwerde | 05962044 | 6.159 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |
| Hallenberg | 05958020 | 4.367 | einfach | tabelle | frei |  | fertig | [Quelle](https://haus-und-grund-westfalen.de/sites/default/files/ckffiles/mietspiegel_hsk_mk.pdf) |

## Region Mitte (HE, RP, SL) · gesperrt 1, verboten 10, fertig 29, kein 11

### Hessen · 33 Gemeinden · gesperrt 1, verboten 2, fertig 22, kein 8

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Frankfurt am Main | 06412000 | 756.021 | qualifiziert | regression | frei | 2028-05-31 | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://frankfurt.de/-/media/frankfurtde/service-und-rathaus/verwaltung/aemter-und-institutionen/amt-fuer-wohnungswesen/pdf/64_s1/64_s1_frankfurter_mietspiegel_2026.pdf?dmc=1) |
| Wiesbaden | 06414000 | 288.850 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.wiesbaden.de/medien/downloads/leben-wohnen/amt-66/Mietspiegel-01012025-neu.pdf) |
| Kassel | 06611000 | 197.230 | qualifiziert | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.kassel.de/bauen-und-wohnen/Mietspiegel_Broschuere_2026.pdf) |
| Darmstadt | 06411000 | 167.029 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.darmstadt.de/fileadmin/Dateistruktur2024/03_STANDORT/08_Wohnort/Downloads/Mietspiegel_2026_WEB.pdf) |
| Offenbach am Main | 06413000 | 132.746 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.offenbach.de/vv/produkte/tsabus/mietspiegel_8975575.php.media/225732/Mietspiegel_2026.pdf) |
| Hanau | 06435014 | 97.956 | einfach | tabelle | frei | 2028-09-30 | fertig | [Quelle](https://www.hanau.de/mam/formulare/mietspiegel_hanau_2026.pdf) |
| Gießen | 06531005 | 89.179 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.giessen.de/media/custom/2874_15358_1.PDF) |
| Marburg | 06534014 | 73.544 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.marburg.de/medien/dokumente/mietspiegelbroschuere_marburg_2026.pdf) |
| Rüsselsheim am Main | 06433012 | 65.627 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.ruesselsheim.de/vv/produkte/lokale-leistungen/mietspiegel.php.media/21599/Mietspiegelbroschuere-Ruesselsheim-2025_1015.pdf) |
| Fulda | 06631009 | 65.434 | qualifiziert | tabelle | frei 3,00 € Druckexemplar im Bürgerbüro (PDF kostenlos) | 2027-12-31 | verboten (Speicherverbot) | [Quelle](https://www.fulda.de/d67/15_Buergerbuero/Statistik/Statistik/Mietspiegel/Mietspiegelbroschuere_Fulda_2026-2027.pdf) |
| Bad Homburg v. d. Höhe | 06434001 | 56.688 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.bad-homburg.de/leben/ueber-unsere-stadt/Mietspiegelbrosch%C3%BCre_Bad_Homburg_2026.pdf) |
| Wetzlar | 06532023 | 54.665 | qualifiziert | tabelle | frei 5,00 € Druckexemplar im Stadtbüro (PDF kostenlos) | 2028-05-31 | fertig | [Quelle](https://www.wetzlar.de/medien/bindata/aktuelleDateien/2026/Broschuere-Mietspiegel-Wetzlar-Fortschreibung-2026-Stand-01.06.2026.pdf) |
| Oberursel (Taunus) | 06434008 | 46.736 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.oberursel.de/de/leben-wohnen/wohnen-bauen/mietspiegel/) |
| Maintal | 06435019 | 38.987 | einfach | tabelle | frei | 2028-09-30 | fertig | [Quelle](https://daten2.verwaltungsportal.de/dateien/seitengenerator/8f74b2a02acb46276bfde4edaf30666b99276/2026-09-22_Mietspiegel_Maintal_2026_NEU.pdf) |
| Langen (Hessen) | 06438006 | 38.785 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.langen.de/de/leistung-detail/leistung/37/zustaendigestelle/1/mietspiegel.html) |
| Bad Vilbel | 06440003 | 35.961 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.bad-vilbel.de/buergerservice-views/leistungen/HES:entry:1462864-VLR/mietspiegel/) |
| Limburg a. d. Lahn | 06533009 | 35.938 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://limburg.de/index.php?FID=358.611.1&ModID=10&object=tx%2C3251.2) |
| Mörfelden-Walldorf | 06433008 | 31.638 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.moerfelden-walldorf.de/de/leben/soziales/wohnungsvermittlung/mietspiegel-und-mietpreisbremse/) |
| Taunusstein | 06439015 | 30.145 | einfach | tabelle | frei | nächste 2027 | fertig | [Quelle](https://www.idstein.de/umwelt-bauen/grundstuecke-hochbau/allgemeine-informationen/mietspiegel/mietspiegel-taunusstein-idstein-stand-2018-2022.pdf?cid=sdr) |
| Weiterstadt | 06432023 | 26.583 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.weiterstadt.de/suche.php?pid=0&we_objectID=4608) |
| Idstein | 06439008 | 25.736 | einfach | tabelle | frei | nächste 2027 | fertig | [Quelle](https://www.idstein.de/umwelt-bauen/grundstuecke-hochbau/allgemeine-informationen/mietspiegel/mietspiegel-taunusstein-idstein-stand-2018-2022.pdf?cid=sdr) |
| Obertshausen | 06438010 | 25.316 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.obertshausen.de/de/service/mietspiegel) |
| Bruchköbel | 06435006 | 20.509 | einfach | tabelle | frei | 2028-09-30 | fertig | [Quelle](https://www.hanau.de/mam/formulare/mietspiegel_hanau_2026.pdf) |
| Nidderau | 06435021 | 20.119 | einfach | tabelle | frei | 2028-09-30 | fertig | [Quelle](https://www.hanau.de/mam/formulare/mietspiegel_hanau_2026.pdf) |
| Kronberg im Taunus | 06434006 | 18.671 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.kronberg.de/planen-bauen-mobilitaet/informationen-fuer-bauherrn/mietspiegel/) |
| Erlensee | 06435007 | 15.907 | einfach | tabelle | frei | 2028-09-30 | fertig | [Quelle](https://www.hanau.de/mam/formulare/mietspiegel_hanau_2026.pdf) |
| Langenselbold | 06435017 | 14.440 | einfach | tabelle | frei | 2028-09-30 | fertig | [Quelle](https://www.hanau.de/mam/formulare/mietspiegel_hanau_2026.pdf) |
| Niedernhausen | 06439011 | 14.345 | einfach | tabelle | frei | nächste 2027 | fertig | [Quelle](https://www.idstein.de/umwelt-bauen/grundstuecke-hochbau/allgemeine-informationen/mietspiegel/mietspiegel-taunusstein-idstein-stand-2018-2022.pdf?cid=sdr) |
| Schöneck | 06435026 | 11.837 | einfach | tabelle | frei | 2028-09-30 | fertig | [Quelle](https://www.hanau.de/mam/formulare/mietspiegel_hanau_2026.pdf) |
| Bad Schwalbach | 06439002 | 11.532 | einfach | tabelle | frei | nächste 2027 | fertig | [Quelle](https://www.idstein.de/umwelt-bauen/grundstuecke-hochbau/allgemeine-informationen/mietspiegel/mietspiegel-taunusstein-idstein-stand-2018-2022.pdf?cid=sdr) |
| Rodenbach | 06435023 | 11.074 | einfach | tabelle | frei | 2028-09-30 | fertig | [Quelle](https://www.hanau.de/mam/formulare/mietspiegel_hanau_2026.pdf) |
| Nauheim | 06433009 | 10.496 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.nauheim.de/loadDocument.phtml?FID=3687.2665.1&Ext=PDF) |
| Großkrotzenburg | 06435011 | 7.284 | einfach | tabelle | frei | 2028-09-30 | fertig | [Quelle](https://www.hanau.de/mam/formulare/mietspiegel_hanau_2026.pdf) |

### Rheinland-Pfalz · 17 Gemeinden · fertig 6, verboten 8, kein 3

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Mainz | 07315000 | 224.684 | qualifiziert | tabelle | frei online kostenlos, Druckfassung 3,50 € |  | fertig | [Quelle](https://www.mainz.de/en/vv/produkte/soziale_leistungen/mietspiegel-anfordern) |
| Ludwigshafen am Rhein | 07314000 | 177.222 | qualifiziert | regression | frei PDF frei; gedruckt Schutzgebühr 6,00 € | 2027-07-31 | verboten (Speicherverbot) | [Quelle](https://ludwigshafen.de/fileadmin/ludwigshafen/standort_mit_zukunft/Wohnen/Mietspiegel/mietspiegel_25.pdf) |
| Koblenz | 07111000 | 113.378 | qualifiziert | tabelle | frei | 2026-12-31 | verboten (Speicherverbot) | [Quelle](https://www.koblenz.de/downloads/aemter-und-eigenbetriebe/statistikstelle/bauen-und-wohnen/mietspiegel/mietspiegel-koblenz-2025-2026.pdf?cid=3fj7) |
| Trier | 07211000 | 104.342 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.trier.de/media/www.trier.de/org/med_3303/16961_mietspiegelbroschuere_trier_2026.pdf) |
| Kaiserslautern | 07312000 | 100.426 | qualifiziert | punkte | frei | 2028-10-31 | verboten (Speicherverbot) | [Quelle](https://www.kaiserslautern.de/mb/themen/statistik/pdf/mietspiegel2026.pdf) |
| Worms | 07319000 | 86.753 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.worms.de/neu-de-wAssets/docs/buerger-unterstuetzen/mietspiegel/Mietspiegel_2026.pdf) |
| Neuwied | 07138045 | 67.083 | qualifiziert | punkte | frei | 2027-04-26 | verboten (Speicherverbot) | [Quelle](https://www.neuwied.de/fileadmin/4_Dokumente/004_Konzepte/Mietspiegel/Mietspiegel_Neuwied.pdf) |
| Bad Kreuznach | 07133006 | 54.168 | einfach | regression | frei |  | fertig | [Quelle](https://www.bad-kreuznach.de/buergerservice/wirtschaft-bauen-wohnen/grundstuecke-bauen-wohnen/mietspiegel/mietspiegel-2025.pdf?cid=278p) |
| Neustadt an der Weinstraße | 07316000 | 52.945 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.neustadt.eu/Planen-Bauen-Wohnen/Wohnen-Mieten/Mietspiegel/) |
| Speyer | 07318000 | 49.564 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.speyer.de/de/standort/stadtentwicklung/mietspiegel/251211-mietspiegel-2026-broschuere.pdf?cid=4d0y) |
| Frankenthal (Pfalz) | 07311000 | 48.140 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.frankenthal.de/stadt-frankenthal/de/wirtschaft/bauen-wohnen/mietspiegel/mietspiegelbroschuere-frankenthal-2026.pdf?cid=2qqa) |
| Ingelheim am Rhein | 07339030 | 35.016 | einfach | tabelle | frei |  | fertig | [Quelle](https://ingelheim.de/wohnen-umwelt/grundstuecke-und-immobilien/mietpreisspiegel/mietpreisspiegel-anpassung-2025.pdf?cid=ljj) |
| Zweibrücken | 07320000 | 33.323 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.zweibruecken.de/de/verwaltung/aemter/stadtbauamt/mietspiegel/msp-stadt-zweibruecken-2026.pdf?cid=22bj) |
| Bingen am Rhein | 07339005 | 25.384 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.bingen.de/leben/wohnen-in-bingen/mietspiegel) |
| Schifferstadt | 07338025 | 21.387 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.schifferstadt.de/buergerservice/leistungen/RLP:entry:250350/mietspiegel-erhalten-und-durchsehen/) |
| Konz | 07235068 | 18.121 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.konz.de/de/buergerservice/leistungen/RLP:entry:247939/mietspiegel/) |
| Bitburg | 07232018 | 15.554 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://bitburg.de/buergerservice-views/leistungen/RLP:entry:199318253:072320018018:ANLR/mietspiegel) |

### Saarland · 1 Gemeinden · fertig 1

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Saarbrücken | 10041100 | 182.971 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.saarbruecken.de/media/download-6a7ac2f4d9bb1) |

## Region Süd (BW, BY) · verboten 48, offen 8, gesperrt 12, fertig 11, kein 2, unklar 2

### Baden-Württemberg · 48 Gemeinden · verboten 30, offen 4, gesperrt 10, fertig 1, kein 1, unklar 2

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Stuttgart | 08111000 | 612.663 | qualifiziert | regression | frei 7,00 € Broschüre (Schutzgebühr zzgl. Versand); PDF kostenlos | 2026-12-31 | verboten (Speicherverbot) | [Quelle](https://www.stuttgart.de/service/statistik-und-wahlen/mietspiegel/) |
| Mannheim | 08222000 | 318.035 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://mannheim.de/sites/default/files/2024-12/Mannheimer_Mietspiegel_2025-2026.pdf) |
| Karlsruhe | 08212000 | 309.050 | qualifiziert | regression | frei 7,50 € zzgl. MwSt. Broschüre (Versand 1,80 €); PDF kostenlos | 2026-12-31 | OFFEN | [Quelle](https://web1.karlsruhe.de/service/Buergerdienste/leistung.php?id=6002637) |
| Freiburg im Breisgau | 08311000 | 237.460 | qualifiziert | regression | frei 7,50 € gedruckte Broschüre (bei Abholung); PDF und Online-Rechner kostenlos | 2026-12-31 | verboten (Speicherverbot) | [Quelle](https://www.freiburg.de/pb/229416.html) |
| Heidelberg | 08221000 | 155.756 | qualifiziert | regression | frei | 2027-09-30 | OFFEN | [Quelle](https://www.heidelberg.de/HD/Rathaus/Mietspiegel.html) |
| Pforzheim | 08231000 | 134.912 | qualifiziert | regression | frei |  | OFFEN | [Quelle](https://cdn.pforzheim-web.de/fileadmin/user_upload/statistik/Mietspiegel_2025_Stadt_Pforzheim.pdf) |
| Heilbronn | 08121000 | 131.986 | qualifiziert | tabelle | frei | 2028-07-31 | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.heilbronn.de/fileadmin/daten/stadtheilbronn/formulare/bauen_wohnen/wohnen/mietspiegel/2026-06-02-Mietspiegelbroschuere_HN_2026.pdf) |
| Ulm | 08421000 | 129.882 | qualifiziert | regression | frei | 2027-11-11 | OFFEN | [Quelle](https://nu.neu-ulm.de/buerger-service/leben-in-neu-ulm/bauen-und-wohnen/mietspiegel) |
| Reutlingen | 08415061 | 118.852 | qualifiziert | regression | frei | 2027-01-31 | verboten (Speicherverbot) | [Quelle](https://www.reutlingen.de/de/Leben/Bauen-Wohnen/Mietspiegel/Mietspiegel-2025) |
| Esslingen am Neckar | 08116019 | 96.182 | qualifiziert | regression | frei 5,00 € Schutzgebühr Druckfassung; PDF kostenlos |  | verboten (Speicherverbot) | [Quelle](https://www.esslingen.de/mietspiegel) |
| Ludwigsburg | 08118048 | 92.858 | qualifiziert | regression | frei | 2027-07-31 | verboten (Speicherverbot) | [Quelle](https://www.ludwigsburg.de/site/Ludwigsburg-Internet-2020/get/params_E-383413171/24168309/Dokumentation_Mietspiegel_Ludwigsburg_2025.pdf) |
| Tübingen | 08416041 | 92.322 | qualifiziert | tabelle | frei 5,00 € Schutzgebühr Druckfassung (zzgl. Versand) | 2026-11-30 | fertig | [Quelle](https://www.tuebingen.de/mietspiegel) |
| Villingen-Schwenningen | 08326074 | 89.756 | qualifiziert | tabelle | frei | 2026-11-30 | verboten (Speicherverbot) | [Quelle](https://www.villingen-schwenningen.de/bauen-wohnen/stadtplanung/wohnungswesen/) |
| Konstanz | 08335043 | 86.919 | qualifiziert | regression |  | 2027-11-30 | verboten (Speicherverbot) | [Quelle](https://www.konstanz.de/site/Konstanz/get/params_E-2040053820_Dattachment/729933/Methodenbericht%20zum%20Gemeinsamen%20Mietspiegel%20Konstanz-Allensbach-Reichenau%202025.pdf) |
| Aalen | 08136088 | 67.621 | qualifiziert | regression | frei | 2027-07-31 | verboten (Speicherverbot) | [Quelle](https://www.aalen.de/broschuere-qualifizierter-mietspiegel-aalen-essingen-2025.201264.25.htm) |
| Schwäbisch Gmünd | 08136065 | 64.416 | qualifiziert | regression | frei | 2026-06-30 | verboten (Speicherverbot) | [Quelle](https://www.schwaebisch-gmuend.de/qualifizierter-mietspiegel.html) |
| Offenburg | 08317096 | 62.993 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.offenburg.de/de/leben-in-offenburg/buergerservice/qualifizierter-mietspiegel-offenburg-2026/) |
| Friedrichshafen | 08435016 | 62.796 | qualifiziert | regression | frei | 2028-07-31 | verboten (Speicherverbot) | [Quelle](https://www.friedrichshafen.de/fileadmin/user_upload/images_fn/SBW_Downloads/Mietspiegel_Friedrichshafen_2026.pdf) |
| Sindelfingen | 08115045 | 61.422 | qualifiziert | regression | frei | nächste 2028 | verboten (Speicherverbot) | [Quelle](https://www.sindelfingen.de/mietspiegel) |
| Göppingen | 08117026 | 58.937 | qualifiziert | regression | frei | 2027-02-28 | verboten (Speicherverbot) | [Quelle](https://www.goeppingen.de/site/Goeppingen-Internet-2021/get/documents_E1128222419/Goeppingen/Goeppingen_Anleitungen/Mietspiegel/Qualifizierter%20Mietspiegel%202025.pdf) |
| Waiblingen | 08119079 | 57.313 | qualifiziert | regression | frei | 2027-01-31 | verboten (Speicherverbot) | [Quelle](https://www.waiblingen.de/mietspiegel) |
| Baden-Baden | 08211000 | 56.881 | einfach | regression | frei 10,00 € Broschüre, 12,00 € Dokumentation; PDF kostenlos |  | verboten (Speicherverbot) | [Quelle](https://www.baden-baden.de/buerger-und-service/serviceportal/dienstleistungen/mietspiegelauskunft) |
| Böblingen | 08115003 | 51.483 | qualifiziert | regression | frei | nächste 2028 | verboten (Speicherverbot) | [Quelle](https://www.boeblingen.de/mietspiegel) |
| Lörrach | 08336050 | 51.349 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.loerrach.de/de/Stadt-Buerger/Rathaus-Buergerservice/buergerbuero/Dienstleistungen-A-Z/Dienstleistung?view=publish&item=service&id=942) |
| Lahr/Schwarzwald | 08317065 | 50.775 | unklar | unbekannt |  |  | unklar, erst Art klären | [Quelle](https://www.lahr.de/50-000-einwohner-marke-geknackt.226347.htm) |
| Rastatt | 08216043 | 50.741 | qualifiziert | tabelle | frei Broschüre kostenlos im Bürgerbüro | 2026-12-31 | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.rastatt.de/mietspiegel) |
| Ravensburg | 08436064 | 50.628 | qualifiziert | regression | frei 7,50 € Ausdruck (Bürgeramt/Ortsverwaltungen); PDF kostenlos |  | verboten (Speicherverbot) | [Quelle](https://www.ravensburg.de/rv-wAssets/pdf/buergerservice-verwaltung/Mietspiegel-RV_2026_Einzelseiten.pdf) |
| Heidenheim an der Brenz | 08135019 | 50.618 | unklar | unbekannt |  |  | unklar, erst Art klären | [Quelle](https://www.heidenheim.de/site/Heidenheim/get/params_E-1908627137_Dattachment/833730/Integriertes%20Stadtentwicklungskonzept.pdf) |
| Nürtingen | 08116049 | 40.773 | qualifiziert | regression | frei | 2026-11-30 | verboten (Speicherverbot) | [Quelle](https://www.nuertingen.de/fileadmin/Dateien/PDF-Dateien/2_Rathaus_und_Buergerservice/Amt_f%C3%BCr_Liegenschaften__Wirtschaftsf%C3%B6rderung_und_B%C3%BCrgerbeteiligung/Grundst%C3%BCcke/Mietspiegel/Mietspiegel_N%C3%BCrtingen_01.12.2024_-_30.11.2026.pdf) |
| Backnang | 08119008 | 38.818 | einfach | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.backnang.de/site/Backnang-Internet/get/documents_E-2047438179/backnang/dictionaries/Service/mietspiegel/2025_Backnang-Mietspiegel.pdf) |
| Ettlingen | 08215017 | 38.578 | qualifiziert | regression | frei | 2028-12-31 | verboten (Speicherverbot) | [Quelle](https://www.ettlingen.de/site/Ettlingen-2021/get/documents_E2118361863/ettlingen/ettlingen/LV/Ettlingen_2025_Mietspiegelbrosch%C3%BCre.pdf) |
| Radolfzell am Bodensee | 08335063 | 31.734 | qualifiziert | regression | frei | 2026-05-17 | verboten (Speicherverbot) | [Quelle](https://www.radolfzell.de/resources/01%20Website/Unterseiten/04%20Wirtschaft%20und%20Bauen/Bauen%20%26%20Wohnen/Qualifizierter%20Mietspiegel/Qualifizierter%20Mietspiegel%20Radolfzell%202024.pdf) |
| Wangen im Allgäu | 08436081 | 28.412 | qualifiziert | regression | frei | 2027-07-31 | verboten (Speicherverbot) | [Quelle](https://www.wangen.de/fileadmin/1_Wangen.de/2_B%C3%BCrger/1_Leben_in_Wangen/1_-_Bauen_und_Wohnen/Dokumentbibliothek/Wangen_2025_Mietspiegel_Fortschreibung.pdf) |
| Neckarsulm | 08125065 | 26.431 | einfach | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.neckarsulm.de/site/Neckarsulm-2022/get/params_E-1939337566_Dattachment/1707545/Mietspiegel_Neckarsulm%202026.pdf) |
| Laupheim | 08426070 | 22.839 | qualifiziert | regression | frei | 2028-03-31 | verboten (Speicherverbot) | [Quelle](https://www.laupheim.de/fileadmin/Dateien/Dateien/Baudezernat/Mietspiegel/2026-05_Mietspiegel_Laupheim_2026.pdf) |
| Überlingen | 08435059 | 22.735 | qualifiziert | regression | frei | 2028-07-31 | verboten (Speicherverbot) | [Quelle](https://cms.ueberlingen.de/mediamanager/2026/07/berlingen-mietspiegel-2026-fortschreibung-endversion.pdf) |
| Schwetzingen | 08226084 | 21.767 | einfach | punkte | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hockenheim.de/site/Hockenheim/get/params_E639528925_Dattachment/1628441/Mietu%CC%88bersicht%20als%20Mietspiegel%20anerkannt.pdf) |
| Hockenheim | 08226032 | 21.623 | einfach | punkte | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hockenheim.de/site/Hockenheim/get/params_E639528925_Dattachment/1628441/Mietu%CC%88bersicht%20als%20Mietspiegel%20anerkannt.pdf) |
| Rheinstetten | 08215108 | 21.267 | einfach | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.rheinstetten.de/site/Rheinstetten/get/params_E1004696904/1995458/mietspiegelbroschuere_rheinstetten_2022.pdf) |
| Bad Waldsee | 08436009 | 20.838 | qualifiziert | regression | frei | 2027-07-31 | verboten (Speicherverbot) | [Quelle](https://www.bad-waldsee.de/fileadmin/Dateien/Website/Dateien/Buerger/Bauen___Wohnen/2025-07-31_01_Bad_Waldsee_2025_Mietspiegel_V0__clean.pdf) |
| Eppelheim | 08226018 | 15.663 | einfach | punkte | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hockenheim.de/site/Hockenheim/get/params_E639528925_Dattachment/1628441/Mietu%CC%88bersicht%20als%20Mietspiegel%20anerkannt.pdf) |
| Brühl | 08226009 | 14.328 | einfach | punkte | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hockenheim.de/site/Hockenheim/get/params_E639528925_Dattachment/1628441/Mietu%CC%88bersicht%20als%20Mietspiegel%20anerkannt.pdf) |
| Ketsch | 08226037 | 13.117 | einfach | punkte | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hockenheim.de/site/Hockenheim/get/params_E639528925_Dattachment/1628441/Mietu%CC%88bersicht%20als%20Mietspiegel%20anerkannt.pdf) |
| Oftersheim | 08226062 | 12.272 | einfach | punkte | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hockenheim.de/site/Hockenheim/get/params_E639528925_Dattachment/1628441/Mietu%CC%88bersicht%20als%20Mietspiegel%20anerkannt.pdf) |
| Plankstadt | 08226063 | 10.644 | einfach | punkte | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hockenheim.de/site/Hockenheim/get/params_E639528925_Dattachment/1628441/Mietu%CC%88bersicht%20als%20Mietspiegel%20anerkannt.pdf) |
| Allensbach | 08335002 | 7.353 | qualifiziert | regression | frei 5,00 € Schutzgebühr Druckfassung | 2027-11-30 | verboten (Speicherverbot) | [Quelle](https://www.konstanz.de/site/Konstanz/get/params_E754801905_Dattachment/725454/Gemeinsamer%20Mietspiegel%20Konstanz%20Allensbach%20Reichenau%202025.pdf) |
| Altlußheim | 08226003 | 6.317 | einfach | punkte | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.hockenheim.de/site/Hockenheim/get/params_E639528925_Dattachment/1628441/Mietu%CC%88bersicht%20als%20Mietspiegel%20anerkannt.pdf) |
| Reichenau | 08335066 | 5.189 | qualifiziert | regression | frei 5,00 € Schutzgebühr Druckfassung | 2027-11-30 | verboten (Speicherverbot) | [Quelle](https://www.konstanz.de/site/Konstanz/get/params_E754801905_Dattachment/725454/Gemeinsamer%20Mietspiegel%20Konstanz%20Allensbach%20Reichenau%202025.pdf) |

### Bayern · 35 Gemeinden · offen 4, verboten 18, gesperrt 2, fertig 10, kein 1

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| München | 09162000 | 1.505.005 | qualifiziert | regression | frei Broschüre kostenlos | nächste 2027 | OFFEN | [Quelle](https://stadt.muenchen.de/infos/mietspiegel.html) |
| Nürnberg | 09564000 | 529.508 | qualifiziert | regression |  | 2028-07-31 | verboten (Speicherverbot) | [Quelle](https://www.nuernberg.de/imperia/md/wohnen/dokumente/20260729_nurnberg_2026_dokumentation_v5_clean.pdf) |
| Augsburg | 09761000 | 301.105 | qualifiziert | regression |  | 2027-11-30 | verboten (Speicherverbot) | [Quelle](https://www.augsburg.de/fileadmin/user_upload/buergerservice_rathaus/wohnen_bauen/mietspiegel/Augsburg_2025_Dokumentation_V6_inkl_Fragebogen.pdf) |
| Regensburg | 09362000 | 151.389 | qualifiziert | regression | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.regensburg.de/fm/RBG_INTER1S_VM.a.253.de/r_upload/mietspiegel-2026.pdf) |
| Ingolstadt | 09161000 | 141.185 | qualifiziert | regression | frei | 2027-10-31 | OFFEN | [Quelle](https://www.ingolstadt.de/mietspiegel) |
| Würzburg | 09663000 | 133.258 | qualifiziert | regression | frei Broschüre kostenfrei im Rathaus | 2027-08-31 | verboten (Speicherverbot) | [Quelle](https://www.wuerzburg.de/media/www.wuerzburg.de/org/med_516999/583625_mietspiegel_2025_digital.pdf) |
| Fürth | 09563000 | 132.036 | qualifiziert | regression | frei 3,00 € Schutzgebühr Druckexemplar (PDF kostenlos) |  | OFFEN | [Quelle](https://www.fuerth.de/fileadmin/redaktion/02-Bauen-Mobilitaet/02-Dokumente-Allgemein/Mietspiegel-Stadt-Fuerth-2025.pdf) |
| Erlangen | 09562000 | 115.928 | qualifiziert | regression | frei | nächste 2027 | OFFEN | [Quelle](https://erlangen.de/uwao-api/faila/files/bypath/Dokumente/Statistik/Mietspiegel/er_mietspiegel_2025.pdf) |
| Bamberg | 09461000 | 77.150 | qualifiziert | regression | frei | 2028-03-31 | fertig | [Quelle](https://www.stadt.bamberg.de/mietspiegel) |
| Aschaffenburg | 09661000 | 73.091 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.aschaffenburg.de/loadDocument.phtml?FID=4173.3006.1&Ext=PDF) |
| Bayreuth | 09462000 | 72.940 | qualifiziert | regression | frei | 2028-04-30 | fertig | [Quelle](https://www.bayreuth.de/wp-content/uploads/2026/04/Bayreuther-Mietspiegelbroschuere-2026.pdf) |
| Landshut | 09261000 | 71.863 | qualifiziert | regression |  | 2027-02-28 | verboten (Speicherverbot) | [Quelle](https://landshut.de/news/bauenentwicklung/neuer-mietspiegel-ab-sofort-erhaeltlich) |
| Kempten (Allgäu) | 09763000 | 67.645 | qualifiziert | tabelle | frei | 2027-05-31 | fertig | [Quelle](https://kempten.de/file/Mietspiegelbrosch%c3%bcre%202025.pdf) |
| Rosenheim | 09163000 | 65.274 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.rosenheim.de/fileadmin/Buergerservice/Planen_und_Bauen/Mietspiegel/Mietspiegeldokumentation_Rosenheim_2025.pdf) |
| Neu-Ulm | 09775135 | 62.641 | qualifiziert | regression | frei | 2027-11-11 | verboten (Speicherverbot) | [Quelle](https://nu.neu-ulm.de/buerger-service/leben-in-neu-ulm/bauen-und-wohnen/mietspiegel) |
| Schweinfurt | 09662000 | 54.481 | einfach | tabelle | frei 5,00 € Schutzgebühr für Druckexemplar (PDF kostenlos) | nächste 2027-02-01 | fertig | [Quelle](https://www.schweinfurt.de/media/www.schweinfurt.de/org/med_6487/47489_mietspiegel_2025.pdf) |
| Passau | 09262000 | 53.039 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.passau.de/bauen-umwelt/bauen-wohnen/mietspiegel/) |
| Straubing | 09263000 | 49.002 | qualifiziert | unbekannt | frei | 2028-03-31 | verboten (Speicherverbot) | [Quelle](https://www.straubing.de/media/www.straubing.de/org/med_1963/8520_straubing_2026_dokumentation_v6_clean_inkl_fragebogen.pdf) |
| Freising | 09178124 | 48.928 | qualifiziert | regression | frei | 2028-02-29 | verboten (Speicherverbot) | [Quelle](https://www.freising.de/media/user_upload/66_Wirtschaftsfoerderung_Liegenschaften/6610_pdf_Files/Mietspiegel/mietspiegel-stadt-freising-2026.pdf) |
| Dachau | 09174115 | 47.138 | qualifiziert | regression | frei | 2028-04-30 | verboten (Speicherverbot) | [Quelle](https://www.dachau.de/wp-content/uploads/2026/04/Mietspiegelbroschuere-Dachau-2026_Maerz.pdf) |
| Hof | 09464000 | 46.778 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.hof.de/fileadmin/user_upload/pdf/Soziales/stadt-hof-qualifizierter-mietspiegel-2026.pdf) |
| Weiden in der Oberpfalz | 09363000 | 42.453 | qualifiziert | unbekannt | frei |  | verboten (Speicherverbot) | [Quelle](https://www.weiden.de/fileadmin/user_upload/D_Wirtschaft-Planen-Bauen/D07_Stadtplanung/Gutachterauschuss/msp_broschuere.pdf) |
| Neumarkt in der Oberpfalz | 09373147 | 41.103 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.neumarkt.de/media/9594/neumarkt_2024_mietspiegel.pdf) |
| Germering | 09179123 | 40.916 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.germering.de/germering/site.nsf/gfx/med_DOME-DVKB5B_2AABDE/$file/Mietspiegel_Germering%202026.pdf) |
| Schwabach | 09565000 | 40.835 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.schwabach.de/images/referate/referat_4/downloads/Wohnbaufoerderung/Mietspiegel/2024/2024_Mietspiegel_Schwabach.pdf) |
| Erding | 09177117 | 37.171 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.erding.de/files/Erding/2024/Wirtschaft/pdfs/Mietspiegel%20Erding%202025.pdf) |
| Deggendorf | 09271119 | 35.044 | qualifiziert | regression | frei |  | fertig | [Quelle](https://service.deggendorf.de/formular-pdf/handreichung-qualifizierter-mietspiegel-stadt-deggendorf/) |
| Pfaffenhofen a.d.Ilm | 09186143 | 26.996 | qualifiziert | regression | frei | 2028-09-30 | verboten (Speicherverbot) | [Quelle](https://pfaffenhofen.de/dokumente/4640/PAF_mietspiegel_2026_DINA4_issuu-neu.pdf) |
| Zirndorf | 09573134 | 26.243 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.zirndorf.de/fileadmin/Dateien/01Website/Dateien/Mietspiegel/Zirndorfer_Mietspiegel_2024.pdf) |
| Lauf a.d.Pegnitz | 09574138 | 26.106 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://lauf.de/media/pdfs_downloads/finanzen_liegenschaften/mietenspiegel/mietenspiegel-2025.pdf?download=1) |
| Starnberg | 09188139 | 24.471 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.starnberg.de/buergerservice-verwaltung/was-erledige-ich-wo/leistungen/mietspiegel) |
| Herzogenaurach | 09572132 | 24.237 | qualifiziert | regression | frei |  | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.herzogenaurach.de/fileadmin/user_upload/Content/Planungsamt/Stadtentwicklung/Mietspiegel/Mietspiegelbroschuere_Herzogenaurach_Fortschreibung_2026.pdf) |
| Puchheim | 09179145 | 20.858 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.puchheim.de/puchheim/web.nsf/gfx/med_fdih-dcvbtm_2df0b3/$file/Mietspiegel%202024%20der%20Stadt%20Puchheim%20(g%C3%BCltig%20ab%201.%20Januar%202025).pdf) |
| Garching b. München | 09184119 | 17.656 | qualifiziert | regression | frei |  | fertig | [Quelle](https://www.garching.de/Qualifizierter-Mietspiegel/_/Mietspiegel%202024.pdf) |
| Feucht | 09574123 | 13.714 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.feucht.de/fileadmin/Dateien/Dateien/Bauen_Wirtschaft_Umwelt/Mietspiegel/Feucht_2025_Mietspiegel_V2.pdf) |

## Region Ost (BE, BB, SN, ST, TH) · fertig 21, gesperrt 2, verboten 10, unklar 1, kein 4, offen 4

### Berlin · 1 Gemeinden · fertig 1

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Berlin | 11000000 | 3.685.265 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.berlin.de/sen/sbw/presse/pressemeldungen/pressemitteilung.1674998.php) |

### Brandenburg · 12 Gemeinden · fertig 5, gesperrt 1, verboten 1, unklar 1, kein 1, offen 3

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Potsdam | 12054000 | 184.754 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.potsdam.de/system/files/document/Mietspiegel_2026_A5_webdatei_neu.pdf) |
| Cottbus/Chóśebuz | 12052000 | 95.123 | qualifiziert | tabelle | frei | nächste 2026 | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.cottbus.de/verwaltung/gb-3/dz-3-1/fb-33-buergerservice/mietspiegel-2024-der-kreisfreien-stadt-cottbus-chosebuz/) |
| Brandenburg an der Havel | 12051000 | 74.113 | qualifiziert | tabelle | frei | 2028-06-29 | verboten (Speicherverbot) | [Quelle](https://www.stadt-brandenburg.de/fileadmin/pdf/12/Statistik/Mietspiegel_2026_Broschuere.pdf) |
| Frankfurt (Oder) | 12053000 | 57.107 | qualifiziert | tabelle | frei | 2028-01-31 | fertig | [Quelle](https://www.frankfurt-oder.de/Verwaltung-Stadtpolitik/Verwaltung/Stadtentwicklung/Wohnen-in-Frankfurt-Oder-/Mietspiegel/) |
| Oranienburg | 12065256 | 49.122 | unklar | tabelle | frei |  | unklar, erst Art klären | [Quelle](https://oranienburg.de/media/custom/2967_353_1.PDF?1524648103) |
| Falkensee | 12063080 | 45.720 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.falkensee.de/seite/552977/faq-h%C3%A4ufig-gestellte-fragen.html) |
| Schwedt/Oder | 12073532 | 33.730 | qualifiziert | tabelle | frei | 2028-04-19 | OFFEN | [Quelle](https://www.schwedt.eu/media_fast/4/Mietspiegel_2026.pdf) |
| Ludwigsfelde | 12072240 | 29.514 | qualifiziert | tabelle | frei | 2028-11-14 | OFFEN | [Quelle](https://www.ludwigsfelde.de/wp-content/uploads/2026/11/Mietspiegel-2026.pdf) |
| Strausberg | 12064472 | 27.719 | qualifiziert | tabelle | frei | 2028-10-31 | fertig | [Quelle](https://www.stadt-strausberg.de/wp-content/uploads/2026/10/Angepasster-neunter-Mietspiegel_2026_final-1.pdf) |
| Teltow | 12069616 | 27.682 | qualifiziert | tabelle | frei |  | OFFEN | [Quelle](https://daten2.verwaltungsportal.de/dateien/seitengenerator/81095171b51384832e2face2346097f018268/Qualifizierter_Mietspiegel_Stadt_Teltow_2022.pdf) |
| Hennigsdorf | 12065136 | 26.677 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.hennigsdorf.de/media/custom/3590_5594_1.PDF) |
| Prenzlau | 12073452 | 18.928 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.prenzlau.eu/sixcms/media.php/54/Qualifizierter%20Prenzlauer%20Mietspiegel%202026%20Tabelle.pdf) |

### Sachsen · 16 Gemeinden · gesperrt 1, fertig 7, verboten 6, kein 2

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Leipzig | 14713000 | 611.850 | qualifiziert | regression | frei Druckexemplar 5 € (Bürgerinformation); PDF und Online-Rechner kostenfrei | 2027-06-30 | Datei gesperrt (Rechtevorbehalt, nur Staging) | [Quelle](https://www.leipzig.de/mietspiegel) |
| Dresden | 14612000 | 564.904 | qualifiziert | regression | frei PDF frei; Broschüre Schutzgebühr 2,00 € | 2026-12-31 | fertig | [Quelle](https://www.dresden.de/media/pdf/sozialamt/Mietspiegel_Dresden_2025.pdf) |
| Chemnitz | 14511000 | 245.618 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.chemnitz.de/de/leben-in-chemnitz/lebenssituationen/bauen-und-wohnen/mietspiegel) |
| Zwickau | 14524330 | 87.410 | einfach | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.zwickau.de/media/downloads/02_D2/05_ewo/Mietspiegel-2025_Web.pdf) |
| Plauen | 14523320 | 65.599 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.plauen.de/loadDocument.phtml?FID=3317.10802.1&Ext=PDF) |
| Görlitz | 14626110 | 55.186 | qualifiziert | tabelle | frei |  | fertig | [Quelle](https://www.goerlitz.de/uploads/02-Buerger-Dokumente/Mietspiegelbroschuere_Goerlitz_2024.pdf) |
| Freiberg | 14522180 | 41.519 | qualifiziert | tabelle | frei | 2026-11-30 | verboten (Speicherverbot) | [Quelle](https://www.freiberg.de/fileadmin/Formulare_Markbl%C3%A4tter_Hinweise/Wohngeldbeh%C3%B6rde/Freiberg_2024_Mietspiegel.pdf) |
| Pirna | 14628270 | 40.128 | einfach | unbekannt | frei |  | verboten (Speicherverbot) | [Quelle](https://www.pirna.de/fileadmin/user_upload/5_Rathaus_Online/5.3_Dienstleistungen_A-Z/M/mietspiegel-pirna-wohnlage-kosten-wohnung-miete-hoehe-durchschnitt-2026.pdf) |
| Bautzen | 14625020 | 37.566 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.bautzen.de/fileadmin/media/statistik_wahlen/8.-bautzener-mietspiegel.pdf) |
| Radebeul | 14627210 | 32.979 | einfach | tabelle | frei | 2027-12-30 | fertig | [Quelle](https://www.radebeul.de/radebeulmedia/Dokumente/Merk-und-Informationsblaetter/Mietspiegel/Wohnraummietspiegel-der-Grossen-Kreisstadt-Radebeul-2026.pdf) |
| Hoyerswerda | 14625240 | 30.759 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.hoyerswerda.de/wp-content/uploads/2025/05/MietspiegelHoyerswerda2025-Broschuere25032025.pdf) |
| Meißen | 14627140 | 28.753 | einfach | punkte | frei | 2027-06-30 | fertig | [Quelle](https://www.stadt-meissen.de/de/datei/anzeigen/id/41609,24/mietspiegel_fortgeschrieben_01_07_2025.pdf) |
| Grimma | 14729160 | 27.529 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.grimma.de/buergerservice/dienstleistungen/mietspiegel-900000526-0.html?myMedium=1) |
| Coswig | 14627010 | 20.479 | einfach | tabelle | frei | 2026-12-31 | fertig | [Quelle](https://www.coswig.de/de/mietspiegel.html?file=files%2Fcoswig%2Fstadtleben%2Fbauen_wohnen%2Fmietspiegel%2FMietspiegel_2025-26.pdf&cid=12439) |
| Reichenbach im Vogtland | 14523340 | 19.797 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.reichenbach-vogtland.de/stadt-buerger/stadtverwaltung/buergerservice-a-z/a-z-suche/m/mietspiegel/) |
| Annaberg-Buchholz | 14521020 | 18.815 | einfach | punkte | frei |  | fertig | [Quelle](https://www.annaberg-buchholz.de/stadtleben/planen_bauen_wohnen/Mietspiegel-Annaberg-Buchholz-2024.pdf) |

### Sachsen-Anhalt · 6 Gemeinden · verboten 3, kein 1, fertig 1, offen 1

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Magdeburg | 15003000 | 244.329 | qualifiziert | punkte | frei PDF frei; Broschüre Schutzgebühr 5 € | 2028-01-30 | verboten (Speicherverbot) | [Quelle](https://www.magdeburg.de/loadDocument.phtml?FID=698.19217.1&Ext=PDF) |
| Halle (Saale) | 15002000 | 226.767 | qualifiziert | regression | frei |  | verboten (Speicherverbot) | [Quelle](https://www.halle.de/fileadmin/Binaries/Publikationen/Stadtentwicklung/Mietspiegel/Mietspiegel_2026_2027_Broschuere_Korrektur.pdf) |
| Dessau-Roßlau | 15001000 | 75.402 | qualifiziert | tabelle | frei |  | verboten (Speicherverbot) | [Quelle](https://www.dessau-rosslau.de/fileadmin/Verwaltungsportal_Dessau-Rosslau/Soziales_Bildung/Soziale_Hilfen/Sozialhilfe/neu_ab_13.11.2023Patz/2025-12-Mietspiegelbroschuere-2026.pdf) |
| Merseburg | 15088220 | 34.392 | keiner | unbekannt |  |  | kein Mietspiegel | [Quelle](https://www.merseburg.de/de/aktuellesdetails/ob-mueller-bahr-wohnungsgipfel-in-merseburg-ist-geplant.html) |
| Naumburg (Saale) | 15084355 | 31.940 | qualifiziert | tabelle | frei | 2028-10-31 | fertig | [Quelle](https://www.naumburg.de/de/datei/anzeigen/id/109674,1164/fortschreibung_qualifizierter_mietspiegel_naumburg_+_bad_koesen_2026-2028.pdf) |
| Aschersleben | 15089015 | 25.647 | einfach | tabelle | frei | 2025-12-31 | OFFEN | [Quelle](https://www.aschersleben.de/output/download.php?fid=3666.1137.1.PDF) |

### Thüringen · 7 Gemeinden · fertig 7

| Gemeinde | AGS | Einwohner | Art | Form | Zugang | gültig bis | Status | Link |
|---|---|---:|---|---|---|---|---|---|
| Erfurt | 16051000 | 218.793 | einfach | tabelle | frei | 2027-06-30 | fertig | [Quelle](https://www.erfurt.de/mam/ef/service/mediathek/publikationen/2025/anlage_1_-_mietspiegel_2025.pdf) |
| Jena | 16053000 | 109.725 | einfach | tabelle | frei |  | fertig | [Quelle](https://service.jena.de/system/files/2026-09/Brosch%C3%BCre_2026_layout.pdf) |
| Gera | 16052000 | 95.608 | einfach | tabelle | frei |  | fertig | [Quelle](https://cms.gera.de/fileadmin/gera_de/Stadtverwaltung/3000/3100_Sozialamt/Dokumente/Dokumente/2026_Mietspiegel_Gera.pdf) |
| Weimar | 16055000 | 65.954 | einfach | tabelle | frei |  | fertig | [Quelle](https://stadt.weimar.de/datei/anzeigen/id/87907,48/20251231_mietspiegel_weimar_2025.pdf) |
| Suhl | 16054000 | 34.685 | einfach | tabelle | frei | 2027-12-31 | fertig | [Quelle](https://www.suhl.eu/_files/ugd/b4a114_6fe15c80d2e7451cb1cefd9c5257fd2b.pdf) |
| Saalfeld/Saale | 16073077 | 29.086 | einfach | regression | frei |  | fertig | [Quelle](https://www.saalfeld.de/files/19C94C37E9C/Ver%C3%B6ffentlichung%20Mietspiegel%202026.pdf) |
| Rudolstadt | 16073076 | 24.852 | einfach | tabelle | frei |  | fertig | [Quelle](https://www.rudolstadt.de/fileadmin/1_Leben/Bauen_Wohnen/Wohnungs-_Immobilienmarkt/Mietspiegel/Mietspiegel_120126.pdf) |

