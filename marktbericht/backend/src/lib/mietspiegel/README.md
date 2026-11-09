# Mietspiegel-Verzeichnis (Phase 1)

`verzeichnis.json` sagt je Gemeinde, **ob** es einen Mietspiegel gibt, welcher Art er ist, wer ihn
herausgibt, wie lange er gilt und **wo er steht**. Tabellenwerte (Mieten je m²) stehen hier noch nicht —
das ist Phase 2. Das Verzeichnis ist das Gegenstück zur Doktrin „Wo kein Wert vorliegt, bekommt der
Kunde den Weg dorthin“: auch ohne Werte kann der Bericht sagen, welcher Mietspiegel gilt und wo er liegt.

Erzeugt am 09.11.2026. Keine Datenbank. **Seit v3250 gelesen** von `verzeichnis.js` (daneben) → Route
GET `/mietspiegel?ags=` (mb-Backend `routes/api.js`, in der Haupt-App über den Proxy `/marktbericht/mietspiegel`)
→ `frontend/js/potenzial.js` (`_dpMarktdaten.mietspiegel_register`, Kern `mietspiegelAus`/`mietspiegelRegister`).
Jahrespflege: Jahreswerte-Register, Eintrag `mietspiegel_verzeichnis`.

## Rechtsgrundlage (gemessen am Wortlaut, 09.11.2026)

| Norm | Inhalt | Fundstelle |
|---|---|---|
| § 558c Abs. 1 BGB | Mietspiegel = Übersicht über die ortsübliche Vergleichsmiete, erstellt oder anerkannt von der nach Landesrecht zuständigen Behörde oder von Vermieter- und Mieterverbänden gemeinsam | https://www.gesetze-im-internet.de/bgb/__558c.html |
| § 558c Abs. 3 BGB | (einfacher) Mietspiegel **soll** im Abstand von zwei Jahren der Marktentwicklung angepasst werden | ebd. |
| § 558c Abs. 4 Satz 2 BGB | **Pflicht:** Gemeinden mit mehr als 50.000 Einwohnern müssen einen Mietspiegel erstellen; Mietspiegel und Änderungen sind zu veröffentlichen | ebd. |
| § 558d Abs. 2 BGB | qualifizierter Mietspiegel **ist** nach zwei Jahren anzupassen (Stichprobe oder Verbraucherpreisindex), nach **vier** Jahren neu zu erstellen; maßgeblich ist der **Stichtag der Datenerhebung**, für die Veröffentlichung entsprechend | https://www.gesetze-im-internet.de/bgb/__558d.html |
| § 558d Abs. 3 BGB | nur bei eingehaltenem Abs. 2 gilt die Vermutung, dass die Entgelte die ortsübliche Vergleichsmiete wiedergeben | ebd. |
| Art. 229 § 62 EGBGB | Gemeinden, die durch die neue Pflicht erstmals einen Mietspiegel brauchen: bis **01.01.2023** erstellen und veröffentlichen; wird ein **qualifizierter** erstellt: bis **01.01.2024** | https://www.gesetze-im-internet.de/bgbeg/art_229__62.html |
| Mietspiegelreformgesetz (MsRG) | vom 10.08.2021, BGBl. I S. 3515; Pflicht in Kraft seit **01.07.2022** | BGBl. 2021 I Nr. 53 |
| Mietspiegelverordnung (MsV) | vom 28.10.2021, BGBl. I S. 4779 — Inhalt, Verfahren, Dokumentation (§ 4 MsV) | — |

Die Pflicht ist eine „ob“-Pflicht: die Gemeinde wählt, ob einfach oder qualifiziert. Viele Pflichtgemeinden
haben einen **einfachen** Mietspiegel (z. B. Herford, Bad Oeynhausen).

## Aufbau

```
{ titel, stand, rechtsgrundlage, einwohner_quelle, demo_orte: [ags…], saetze: [ … ] }
```

Je Satz (alle Felder immer vorhanden, unbekannt = `null`):

| Feld | Bedeutung |
|---|---|
| `ags` | 8-stelliger amtlicher Gemeindeschlüssel (aus dem ARS des Destatis-Gemeindeverzeichnisses: Stellen 1–5 + 10–12) |
| `gemeinde`, `land` | Name ohne Zusatz („Stadt“), Länderkürzel |
| `einwohner_ca` | Bevölkerung 31.12.2024 auf Grundlage Zensus 2022 (Destatis GV-ISys) |
| `art` | `qualifiziert` (§ 558d) · `einfach` (§ 558c) · `keiner` (die Gemeinde sagt selbst, dass es keinen gibt, oder verweist nur auf Dritte) · `unklar` (nicht belegbar — immer mit `hinweis`) |
| `stand` | Ausgabe/Stand laut Dokument (JJJJ, JJJJ-MM oder JJJJ-MM-TT) |
| `erhebungsstichtag` | Stichtag der Datenerhebung, wo genannt (das ist der gesetzliche Fristbeginn nach § 558d Abs. 2) |
| `gueltig_ab`, `gueltig_bis` | nur, wenn die Quelle es sagt; „gilt zwei Jahre ab Inkrafttreten“ wird ausgerechnet und im `hinweis` vermerkt |
| `naechste_anpassung` | nur, wenn die Quelle einen Nachfolger ankündigt |
| `vermutung_bis` | **nur bei qualifizierten**: bis wann die Vermutung des § 558d Abs. 3 voraussichtlich trägt |
| `vermutung_bis_herleitung` | `angegeben` (= `gueltig_bis`) · `abgeleitet_gueltig_ab_plus_2` · `abgeleitet_stand_plus_2` — die abgeleiteten Daten sind **keine Quellenangabe**, sondern eine Rechnung |
| `ersteller` | Stadt / Gutachterausschuss / Verbände |
| `url` | amtliche Seite der Stadt oder PDF; Pflicht außer bei `keiner` und `unklar` |
| `zugang` | `frei` · `kostenpflichtig` (dann `preis`) · `online_rechner` (nur als Rechner) · `auf_anfrage` |
| `form` | `tabelle` (Baualter × Größe, ggf. Zu-/Abschläge) · `punkte` · `regression` (Basismiete × Faktoren, wo die Quelle Regression nennt) · `online_rechner` · `unbekannt` |
| `quelle_geprueft_am` | Tag der Prüfung |
| `beleg` | URL + Seite/Abschnitt, wo Art, Stand und Gültigkeit stehen |
| `hinweis` | Besonderheiten (Fortschreibung per Index, gemeinsamer Kreis-Mietspiegel, Widersprüche) |

**Herleitung `vermutung_bis`:** `gueltig_bis` vor `gueltig_ab + 2 Jahre` vor `stand + 2 Jahre`.
Das Gesetz knüpft an den **Erhebungsstichtag** an; der liegt meist 6–9 Monate vor dem Inkrafttreten.
Die abgeleiteten Daten sind deshalb eher zu spät als zu früh — für den Hinweis „Mietspiegel womöglich
nicht mehr qualifiziert“ genügt das, für eine Rechtsaussage nicht. Bei `stand` nur als Jahr wird der
31.12. angesetzt.

## Was der Kunde davon hat (v3250: Zeile im Reiter Investition, Karte „Mieterhöhung und Zielbild“)

- Gemeinde mit Mietspiegel: Name, Art, Gültigkeit, Link — „hier steht die ortsübliche Vergleichsmiete“.
- `vermutung_bis` abgelaufen: Hinweis, dass die Vermutung des § 558d Abs. 3 nicht mehr greifen könnte.
- `unklar` / `keiner`: der Weg (Stadtseite, ggf. Vergleichsgemeinde nach § 558a Abs. 4 BGB).
- **Keine Portal- oder Datenquellennamen nach außen** — nur Städte, Gutachterausschüsse, Verbände.

## Pflegeweg

1. Prüfen: `node tools/mietspiegel-verzeichnis-pruefen.mjs` (RC=0 = Form sauber; zählt und listet
   „veraltet“ und „einfach, Anpassung überfällig“; `--liste` zeigt alle `unklar`; `--heute=` für Stichtage).
2. Veraltete und unklare Sätze nachrecherchieren — **nur amtliche Belege** (Stadtseite, Amtsblatt,
   Mitersteller-Verband, Gutachterausschuss). Portale sind kein Beleg.
3. Satz ändern, `quelle_geprueft_am` auf den Tag setzen, Prüfer laufen lassen, committen.
4. Wenn ein Mietspiegel ausläuft (`gueltig_bis`), im Folgemonat nachsehen — die Nachfolger erscheinen
   oft erst Wochen nach dem Termin.

## Stand 09.11.2026

Die Zahlen schreibt der Prüfer; hier nur die Methode:
- Grundmenge: alle **195** Gemeinden ab 50.000 Einwohnern laut Destatis (31.12.2024, alle haben
  Stadtrecht) plus die drei kleineren Demo-Orte Löhne, Hiddenhausen, Hüllhorst.
- Recherche über die amtlichen Seiten; die Websuche der Sitzung war nach rund 200 Abfragen erschöpft —
  danach nur noch direkter Abruf bekannter Stadtseiten. Sätze mit `beleg: "noch nicht recherchiert"`
  sind aus diesem Grund offen, nicht weil es keinen Mietspiegel gäbe.
- Viele PDFs sind Bild-PDFs ohne Textschicht; dann steht `form: "unbekannt"` und der Hinweis dazu.

### Nachrecherche 09.11.2026 (zweite Runde, 109 Sätze angefasst)

Gemessen mit dem Prüfer, vorher → nachher:

| | vorher | nachher |
|---|---:|---:|
| qualifiziert | 129 | 130 |
| einfach | 35 | 60 |
| keiner | 1 | 1 |
| unklar | 33 | 7 |
| form `unbekannt` | 90 | 9 |
| form tabelle / regression / punkte / online_rechner | 67 / 33 / 7 / 1 | 100 / 78 / 9 / 2 |

- **26 von 33 `unklar` geklärt**, jede Einstufung am Wortlaut (Mietspiegel-PDF, Dokumentation nach § 4 MsV,
  Ratsvorlage). Lünen ist qualifiziert, alle übrigen sind einfach — die meisten NRW-Verbände-Mietspiegel und
  die Arbeitskreis-Mietspiegel im Rhein-Erft-Kreis (Kerpen, Hürth, Bergheim, Frechen, Pulheim) sagen selbst
  „§ 558c BGB (einfacher Mietspiegel)“. **Offen bleiben 7:** Lahr, Heidenheim (keine Aussage der Stadt, weder
  Mietspiegel noch Verneinung), Grevenbroich (Dokument nur im Bürgerbüro), Herten und Stolberg (Dokument nennt
  weder § 558c noch § 558d), Gronau (nur der Grundstücksmarktbericht des Kreises sagt, im Kreis gebe es nur in
  Ahaus einen Mietspiegel — eine Aussage der Stadt fehlt, deshalb nicht `keiner`), Hüllhorst (keine Pflicht,
  keine Aussage).
- **Ratingen, Dorsten, Eschweiler** sind einfach mit Begründung statt Selbstbezeichnung (siehe `hinweis`).
- **Abgelaufene:** für Cottbus, Schwäbisch Gmünd, Görlitz und Baden-Baden ist noch keine Neuausgabe
  veröffentlicht; Stand geprüft und vermerkt. **Ende 2026 fällig:** Wuppertal (neu ab 01.12.2026 angekündigt)
  und Dortmund (01.01.2027) mit Datum, die übrigen ohne Ankündigung.
- **Abgrenzung `tabelle` / `regression`:** `regression`, wenn die Quelle das Regressionsverfahren nennt oder die
  Basismiete nur nach Wohnfläche ausweist und alles Weitere über Zu-/Abschläge geht; eine Grundtabelle nach
  Größe **und** Baujahr ohne Nennung der Regression ist `tabelle`. Ulm/Neu-Ulm und Frankfurt sind nur mittelbar
  belegt (Stadtseiten verweigerten den Abruf), steht im `beleg`.
- Bielefeld: Inkrafttreten 01.07.2026 weiter nur in der Liste des Vermieterverbands; Erhebungsstichtag und
  Anerkennung jetzt aus der Dokumentation der Stadt. Bad Salzuflen: Stadt-PDF gelesen („Gültig ab 04.2026“),
  der Tag 01.04. nur beim Verband. Detmold: ganz auf das Serviceportal der Stadt umbelegt.

## Phase 2 (Werte ins Register)

Kandidaten sind Sätze mit `art` `qualifiziert`/`einfach`, `zugang: "frei"` und `form` `tabelle` oder
`regression` mit einer textlesbaren PDF. Für jede Tabelle gilt dieselbe Herkunftspflicht wie im
Register (Quelle, Stand, Seite, Lizenz) und der Prüfmaßstab ist das **Anwendungsbeispiel** des
Mietspiegels selbst.

## Werte (Phase 2, seit v3255)

Eine Datei je Gemeinde: **`werte/<ags>.json`** (8-stellige AGS wie im Verzeichnis). Dateien, deren
Name mit `_` beginnt, sind Vorlagen und werden nicht geladen. Gerechnet wird ausschließlich mit
`mietspiegelWerteFuer(werte, objekt)` aus `werte.js` (daneben) — kein Einstellungszugriff, alles als
Parameter. Prüfer: `node tools/mietspiegel-werte-pruefen.mjs` (RC≠0 bei jedem Fehler).

**Grundsätze:** nur aus dem amtlichen Dokument (Stadt, Gutachterausschuss, Mitersteller-Verband), nie
von einem Portal. Jede Zahl mit Seite. Bild-PDF ohne lesbaren Text → **keine Datei**, im Bericht nennen,
nicht raten. Wo die Tabelle endet (Baujahr, Wohnfläche, leeres Feld „*“/„—“), endet die Rechnung: die
Funktion gibt `null` mit Hinweis, sie extrapoliert nie.

### Kopf (Pflicht)

```jsonc
{
  "ags": "05758016",                 // = Verzeichnis
  "gemeinde": "Hiddenhausen",
  "art": "einfach",                  // = art im Verzeichnis (qualifiziert | einfach)
  "stand": "2025-11",                // Stand laut Dokument (JJJJ, JJJJ-MM, JJJJ-MM-TT)
  "erhebungsstichtag": null,         // wo genannt (JJJJ-MM-TT), sonst null
  "gueltig_ab": "2025-12-01",        // laut Dokument, sonst null
  "gueltig_bis": null,               // laut Dokument, sonst null
  "quelle": { "url": "<PDF-Link>", "dokument": "Mietspiegel Hiddenhausen 2025", "seite": "2",
              "lizenz": "so wie im Dokument belegt, sonst \"unbekannt\"", "abgerufen": "2026-11-09" },
  "einheit": "eur_qm_nettokalt",     // immer so: Nettokaltmiete €/m² Wohnfläche monatlich
  "form": "tabelle",                 // tabelle | regression | punkte
  "rundung": 2,                      // Nachkommastellen des Ergebnisses (Standard 2)
  "hinweis": null,                   // Besonderheiten (Fortschreibung +7 %, Geltungsbereich, Ausschlüsse)
  "pruefbeispiele": [ … ]            // mindestens eines, siehe unten
}
```

### `form: "tabelle"` (Baualter × Wohnfläche, ggf. Lage/Ausstattung, Zu-/Abschläge)

```jsonc
"tabelle": {
  "achsen": {
    "baujahr": [ { "von": null, "bis": 1948, "label": "bis 1948" },
                 { "von": 1949, "bis": 1977, "label": "1949–1977" } ],
    "wfl":     [ { "von": null, "bis": 40, "label": "bis 40 m²" },
                 { "von": 40, "von_inkl": false, "bis": 60, "label": "über 40 bis 60 m²" } ],
    "lage":        [ { "schluessel": "einfach", "label": "einfache Lage" },
                     { "schluessel": "mittel", "label": "mittlere Lage", "standard": true } ],   // optional
    "ausstattung": [ { "schluessel": "standard", "label": "…", "standard": true } ]             // optional
  },
  "zellen": [ { "baujahr": 0, "wfl": 0, "unten": 5.10, "mittel": 5.80, "oben": 6.50, "seite": "2" }, … ],
  "zuschlaege": [ { "merkmal": "lage:gut", "art": "eur_qm", "wert": 0.30, "beleg": "S. 3 Lagentabelle" },
                  { "merkmal": "einbaukueche", "art": "pct", "wert": 5, "beleg": "S. 3 Nr. 4" } ]
}
```

- **Klassen:** `von`/`bis` sind Zahlen oder `null` (offen). Beide Grenzen gelten **einschließlich**,
  außer `von_inkl: false` bzw. `bis_inkl: false` („über 40“ = `von: 40, von_inkl: false`; „unter 60“ =
  `bis: 60, bis_inkl: false`). Treffen zwei Klassen, gilt die **erste** der Liste. Ganzzahlige
  Klassen der Tabelle („41–60 m²“) als stetige Grenzen eintragen (`von: 40, von_inkl: false`), sonst
  fällt 40,5 m² durch.
- **Zellen** verweisen auf die Achsen per **Index** (0-basiert) — bei `lage`/`ausstattung` geht auch der
  `schluessel` als Text. Fehlt eine Achse in der Zelle, gilt die Zelle für alle ihre Klassen.
  Ein leeres Tabellenfeld (Stern, Strich, „zu wenig Fälle“) wird **nicht** eingetragen → `null` mit
  Hinweis. Steht nur ein Mittelwert ohne Spanne im Dokument: nur `mittel`.
- **Lage/Ausstattung:** fehlt die Angabe am Objekt, gilt der Eintrag mit `standard: true` (Hinweis
  „Lage nicht angegeben — mittlere Lage angenommen“); gibt es keinen Standard → `null` mit Hinweis.
- **Zu-/Abschläge** (optional): `merkmal` greift, wenn `objekt.merkmale[merkmal]` wahr ist;
  Sonderform `lage:<schluessel>` greift bei der Lage des Objekts (für Mietspiegel, die die Lage als
  Zuschlag statt als Achse führen). `art: "pct"` wirkt auf den Zellwert, `eur_qm` wird addiert:
  `wert = zelle × (1 + Σ pct / 100) + Σ eur_qm`, auf `unten`, `mittel`, `oben` gleich.
  Abschläge negativ.

### `form: "regression"` (Basismiete × Zu-/Abschläge)

```jsonc
"regression": {
  "basis": { "typ": "wfl_tabelle", "werte": [ { "von": 25, "bis": 30, "eur_qm": 9.12 }, … ], "beleg": "S. 8 Tabelle 1" },
                                   // oder "basis_eur_qm": 7.45 (eine Zahl für alle)
  "verknuepfung": "summe",         // summe | produkt (nur Beschreibung): gerechnet wird immer Basis × Π faktor × (1 + Σ pct/100) + Σ eur_qm
  "faktoren": [
    { "merkmal": "baujahr", "typ": "baujahr_klasse", "art": "pct",
      "werte": [ { "von": null, "bis": 1918, "wert": 0 }, { "von": 1919, "bis": 1948, "wert": -4 } ], "beleg": "S. 9" },
    { "merkmal": "wfl", "typ": "wfl_kurve", "art": "eur_qm", "werte": [ { "von": 0, "bis": 50, "wert": 0.2 } ], "beleg": "…" },
    { "merkmal": "lage", "typ": "lage", "art": "pct", "werte": { "einfach": -3, "mittel": 0, "gut": 4 },
      "standard": "mittel", "beleg": "S. 10" },
    { "merkmal": "einbaukueche", "typ": "flag", "art": "pct", "werte": 3, "beleg": "S. 10 Nr. 2" }
  ],
  "spanne": { "unten_pct": -15, "oben_pct": 16 },   // oder { "unten_abs": -0.80, "oben_abs": 0.80 }
  "geltung": { "baujahr_von": null, "baujahr_bis": null, "wfl_von": 25, "wfl_bis": 160 },
  "beleg": "S. 7 Rechenweg"
}
```

- `typ`: `wfl_kurve` / `baujahr_klasse` = Klassen wie bei der Tabelle (`von`, `bis`, `von_inkl`,
  `bis_inkl`, `wert`); `lage` = Schlüssel → Wert, mit `standard`; `flag` = ein Wert, greift bei
  `objekt.merkmale[merkmal]`. `art`: `pct` (Prozent auf die Basis) oder `eur_qm` (Betrag). Ein Merkmal
  ohne passende Klasse → `null` mit Hinweis (keine Extrapolation); `geltung` begrenzt zusätzlich.
- `rundung_basis` (optional): Nachkommastellen, auf die das Dokument die Basis vor den Zuschlägen rundet.
- Ist die Spanne eines Dokuments **nicht symmetrisch auf den Mittelwert** gerechnet, im `hinweis` sagen.

### `form: "punkte"`

Frei beschrieben unter `punkte: { …, beleg }`. Die Rechenfunktion kennt Punkte-Mietspiegel noch nicht
und gibt `null` mit Hinweis — die Datei hält trotzdem die Herkunft fest.

### Prüfbeispiele (Pflicht, mindestens eines)

```jsonc
"pruefbeispiele": [
  { "eingabe": { "baujahr": 1965, "wfl": 72, "lage": "mittel", "merkmale": { "einbaukueche": true } },
    "erwartet": { "unten": 5.60, "mittel": 6.30, "oben": 7.00 },
    "seite": "2", "art": "anwendungsbeispiel" }      // anwendungsbeispiel | lesebeispiel | tabellenzelle
]
```

Vorrang hat das **Anwendungs- oder Lesebeispiel des Dokuments**; gibt es keines, eine **eindeutig
ablesbare Tabellenzelle** (`art: "tabellenzelle"`). Der Prüfer rechnet jedes Beispiel mit
`mietspiegelWerteFuer` nach (± 0,01 €/m²). Ein Beispiel darf auch `null` erwarten
(`"erwartet": null`), um eine Grenze festzuhalten.

### Ergebnis der Rechenfunktion

`mietspiegelWerteFuer(werte, { baujahr, wfl, lage?, ausstattung?, merkmale? })` →
`{ unten, mittel, oben, zelle, rechnung, hinweise[] }` — `zelle` (Tabelle: „Baujahr 1949–1977 · über
40 bis 60 m²“) bzw. `rechnung` (Regression: Rechenweg in Worten); ohne rechenbaren Wert
`{ unten: null, mittel: null, oben: null, hinweise: [Grund] }`.

Route: GET `/mietspiegel?ags=` liefert zusätzlich `werte_verfuegbar` (true/false);
mit `&baujahr=&wfl=` (optional `&lage=&ausstattung=`) zusätzlich `werte: { … Ergebnis … }`.

### Erweiterungen aus den Demo-Mietspiegeln (v3255, alle optional, abwärtskompatibel)

Gefunden an Minden, Dortmund, Bielefeld, Detmold, Leipzig — wer eine Datei nach dem Grundformat oben
schreibt, muss nichts davon kennen.

| Feld | wo | Bedeutung | Beispiel |
|---|---|---|---|
| `wfl_runden` | `tabelle`, `regression` | Wohnfläche vor dem Nachschlagen auf n Stellen kaufmännisch runden („auf volle m² runden“) | Minden, Detmold, Leipzig: `0` |
| `geltung` | `tabelle` (wie bei `regression`) | `{ baujahr_von, baujahr_bis, wfl_von, wfl_bis }` — außerhalb kein Wert | Dortmund 20–145 m² |
| `spanne` | `tabelle` | Zellen führen nur `mittel`; unten/oben = Mittelwert **nach** Zuschlägen (auf `rundung` gerundet) × (1 + pct/100) bzw. + abs | Minden −15/+16 % |
| `spanne.baujahr_klassen` | beide | Spanne je Baualter: `[{ von, bis, unten_abs, oben_abs }]` (oder `_pct`) | Leipzig |
| `zuschlaege[].wfl_klassen` | `tabelle` | Zuschlag nach Wohnfläche: `[{ von, bis, von_inkl?, wert }]` statt `merkmal`-Schalter | Dortmund Wohnungsgröße |
| `zuschlaege[].bedingung` | `tabelle`, `regression.faktoren[]` | `{ baujahr_von, baujahr_bis }` — greift nur in diesem Baualter | Energetische Vollmodernisierung bis 1990 |
| `zuschlaege[].aliase`, `achsen.lage[].aliase` | `tabelle` | weitere Namen, unter denen die Lage am Objekt ankommt (Ortsteile, „mittel“ für „normal“) | Herford, Bielefeld |
| `zuschlaege[].label`, `faktoren[].label` | beide | Wortlaut für den Rechenweg | — |
| `faktoren[].art: "faktor"` | `regression` | multiplikativer Faktor (1,044 …) | Leipzig |
| `faktoren[].typ: "auswahl"` | `regression` | wie `lage`, aber Wert aus `objekt.merkmale[merkmal]` (Schlüssel als Text); ohne Angabe neutral | Detmold Sanitär, Leipzig Bodenbelag |
| `faktoren[].aliase` | `regression`, Typ `lage`/`auswahl` | `{ schluessel: [weitere Namen] }` | Leipzig |
| `faktoren[].standard_label` | `regression`, Typ `lage` | Wortlaut des Hinweises „Lage nicht angegeben — … angenommen“ | Detmold „Wohnlage 2 (± 0,00 €)“ |
| `faktoren[].rubrik`, `rundung_faktor` | `regression` | Produkt je Rubrik und Gesamtfaktor auf n Stellen runden | Leipzig: 3 |
| `basis.ersatz` | `regression` | `[{ merkmal, eur_qm, label }]` — andere Basis, wenn das Merkmal gesetzt ist | Leipzig Ein-/Zweifamilienhaus 7,05 € |
| `faktoren[].typ: "eingabe"` (v3261) | `regression` | Betrag (bzw. Prozent), den der Nutzer selbst aus einem Verzeichnis des Mietspiegels abliest; `merkmal: "lage"` liest `objekt.lage`, sonst `objekt.merkmale[merkmal]` (Zahl). Pflicht: `von`/`bis` = Spannweite des Verzeichnisses (außerhalb kein Wert); `pflicht: true` → ohne Angabe kein Wert, Text in `hinweis_fehlt`. Nur `art` `eur_qm`/`pct` | Rostock: Wohnlage je Adresse −1,25 … +2,83 €/m² |
| Faktor `{ wert, unten, oben }` + `spanne: { typ: "faktor_grenzen" }` (v3261) | `regression` | ein Faktor (Klasse, Lage-/Auswahlwert, Schalter) darf eigene Konfidenzgrenzen tragen; mit `faktor_grenzen` ist die untere Spanne Basis × Π unten, die obere Basis × Π oben (Rundung wie der Mittelwert). Ohne diesen Spannentyp zählt nur `wert` | Ibbenbüren: UK 1,05 [1,02 – 1,07] |
| `spanne.baujahr_klassen[].merkmal` (v3261) | beide | eine Spannen-Klasse zählt nur, wenn `objekt.merkmale[merkmal]` wahr ist; sonst gilt die nächste passende Klasse der Liste (gebundene Klasse also VOR die allgemeine stellen) | Wolfsburg: vor 1961 mit Denkmalschutz 5,72/7,31 statt 5,87/6,85 |
| Route `merkmale=name:wert` (v3261) | Route | neben Schaltern `a,b` auch `name:wert` für Auswahl-Merkmale und Beträge (Dezimalpunkt) | `merkmale=waermedaemmung:2_seit_2016,aufzug` |
| `pruefbeispiele[].art` | alle | zusätzlich `rechenweg`: kein Zahlenbeispiel im Dokument, nach seinem Rechenweg aus den Tabellen gerechnet (mit `anmerkung`) | Leipzig |

**Rechenreihenfolge (beide Formen):** Mittelwert = Basis bzw. Zellwert × Gesamtfaktor × (1 + Σ pct/100)
+ Σ €/m², auf `rundung` gerundet; danach die Spanne auf diesen Mittelwert. Hat die Tabelle eigene
unten/oben-Werte und keine `spanne`, wird jeder der drei Werte für sich so gerechnet.

`hinweis` der Datei ist eine **Arbeitsnotiz der Ernte** (Ablesung, Besonderheiten) und kommt als
`hinweis_quelle` zurück, nicht unter den Kundenhinweisen.

**Demo-Orte mit Werten (09.11.2026):** Minden, Herford, Löhne, Hiddenhausen, Bad Oeynhausen (Bild-PDF,
am Bild abgelesen), Dortmund (Tabelle), Bielefeld (Regression, als Tabelle veröffentlicht), Detmold und
Leipzig (Regression). Hüllhorst hat keinen Mietspiegel (Verzeichnis `unklar`).

**Regressions-Ernte 09.11.2026 (zweite Runde):** Dresden, Bremen, Mönchengladbach, Rostock (Wohnlage als
`eingabe`), Gießen und weitere (`ls werte/`). **Speicherverbot im Dokument = keine Datei:** „ohne Genehmigung … in elektronischen Systemen zu speichern“
(u. a. Stuttgart, Nürnberg, Mannheim, Augsburg, Braunschweig, Kiel, Freiburg, Halle, Chemnitz). Rechtevorbehalt
ohne Speicherverbot → Datei mit `"freigabe": "gesperrt"`.
