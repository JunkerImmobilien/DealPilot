# Demo-Konto – Stand 11.11.2026 (Spiegel Staging → Prod)

Konto info@junker-immobilien.io · Staging `2a1ac331…` · Prod `528be31f…` · Prod-Code 1.0.101 (v3294).
Marcels Freigabe vom 11.11.2026: „ja, Demo-Objekte auch auf Prod“.

## 1 · Ergebnis

| | Anzahl |
|---|---:|
| neu auf Prod angelegt | **2** (VOLL-A 2026-1157, VOLL-B 2026-1158) |
| auf Prod aktualisiert | **0** |
| übersprungen: Prod hat eigene Stände seit dem Spiegel vom 28.10. | 17 |
| übersprungen: Prod unverändert, Staging-Stand aber nicht eindeutig | 2 (2026-004, 2026-1002) |
| nur auf Prod (nicht angefasst) | 2 (2026-1004 Doppel, verloren · 2026-1123 Lindenallee 14) |
| nur auf Staging, Arbeits-/Testobjekte (nicht gespiegelt) | 35 |
| gelöscht | 0 |

Weg: SQL in einer Transaktion. Vorher geprüft, dass weder id noch Nummer noch Kürzel im Prod-Konto stehen, danach `md5(data)` gegen den Staging-Wert, erst dann COMMIT.
Nachher: VOLL-A `md5(data)` 3d34813f…, VOLL-B bc3e7a8d…, auf beiden Servern gleich (ebenso `ai_analysis` leer, `photos`, Version 5). Die 21 anderen Prod-Objekte sind Zeile für Zeile unverändert (Inventar vorher = nachher).
Prod-API mit Kurz-Token des Demo-Kontos: Liste 200 mit 23 Objekten, VOLL-A/B je 200 (347 bzw. 346 Felder, Kaufpreis 465.000 / 470.000 €, Halter privat / Demo Immobilien GmbH `mmv7q18g379`, die Prod-Mandantenliste kennt sie).

**Hinweis VOLL-A/B:** Beide tragen Kennzahlen und Scores aus Staging (Deal Score 25 / 23, Investor 47 / 49). Gerechnet wurden sie mit der Staging-Gewichtung (siehe 3). Auf Prod rechnet die App beim nächsten Speichern mit Lage-Fokus neu. Nicht in der App gespeichert.
Laut `tools/demo-vollausstattung.mjs` gilt: erst B öffnen oder vorher neu laden. Wer A und danach B öffnet, bekommt in B die Tilgung von Darlehen I auf 0 gesetzt, und das Auto-Speichern schreibt sie.
Die nächste neue Objektnummer auf Prod ist 2026-1159, weil der Server die höchste Nummer + 1 vergibt.

## 2 · Prod-eigene Stände (nicht überschrieben)

Bezug ist die Prod-Sicherung `haupt-20261028-2042.sql.gz`, also der Stand nach dem Spiegel vom 28.10. Ihre Objekttabelle wurde in einen Wegwerf-Postgres ohne Netz geladen und danach wieder entfernt.
Seitdem hat Prod 17 der 19 gemeinsamen Objekte selbst gespeichert, und zwar bei drei Gelegenheiten:
- **29.10., 17:44–18:40 UTC:** Neuabruf der Marktpreise im Browser (Journal „Prod 1.0.4 … Neuabruf“, v3045). Betroffen: `_potenzial`, Kennzahlen, `_jahresstaende`.
- **04.11., 08:33–08:35 UTC:** Prod-Schleife „Soll-Miete und Marktdaten“ (wissen/2026-11-04). Betroffen: `_marktdaten`, `_soll_einheiten`, `_potenzial`, Kennzahlen, Scores.
- **09.11., 15:14 UTC:** Westerfeldstr. 140 und Hölderlinstr. 1 gespeichert, zur selben Minute wie `user_settings.mandanten` auf Prod. Wer das war, ist nicht bekannt.

**Bei keinem Objekt hat Prod eine Eingabe geändert.** Verschieden sind nur von der App geschriebene Felder (`_*`).
Der Feld-Diff (Basis / Prod / Staging) zeigt bei allen 19 Objekten: Staging hat **kein** Feld, das Prod hat. Auch die Einsteiger-Verluste vom 10.11. sind nicht mehr zu sehen, denn Westerfeld und Ravensberger führen `darlehen_weitere`, `ms_*` und `grundsteuerwert` wieder.
Einzige Leerstelle: `mietausfall` ist auf Staging bei 1008 und 1053 leer (Prod „0“). Das ist die Umstellung v3238 (`mietausfall_alt`), kein Verlust.

| Nr. | Objekt | Prod gespeichert | DS P / S | Investor P / S | Eingaben auf Staging anders |
|---|---|---|---:|---:|---|
| 2026-001 | Hermannstraße 9 | 29.10. | 77 / 85 | 74 / 76 | AfA: eigener Satz 2,38 % aus RND 42 J. |
| 2026-1006 | Löhner Str. 278 | 04.11. | 67 / 73 | 65 / 53 | – |
| 2026-1007 | Am Markt 9 (VV) | 29.10. | 66 / 66 | 81 / 65 | – |
| 2026-1008 | Hölderlinstr. 1 | 09.11. | 80 / 71 | 64 / 68 | – |
| 2026-1036 | Wilhelm-Busch-Str. | 29.10. | 82 / 90 | 69 / 72 | – |
| 2026-1040 | Am Markt 18 | 04.11. | 64 / 75 | 65 / 61 | – |
| 2026-1041 | Westerfeldstr. 140 | 09.11. | 75 / 78 | 73 / 72 | ja, viele (EK 120.000 → 74.592, Leerstand 0 → 10, `mietausfall` 0 → 3942, Sanierung 10.000 €, Darlehen II KfW, Garage, me_modus prog …) |
| 2026-1042 | Alexanderstr. 11 | 04.11. | 66 / 74 | 67 / 61 | – |
| 2026-1051 | Lindenhof 14 | 04.11. | 20 / 15 | 40 / 35 | – |
| 2026-1052 | Gohliser Str. 42 | 29.10. | 76 / 83 | 77 / 68 | – |
| 2026-1053 | Ravensberger Weg 38 | 04.11. | 73 / 82 | 69 / 71 | Grenzsteuersatz 47,00 → 41,35 |
| 2026-1054 | Bismarckstr. 27 | 29.10. | 46 / 23 | 59 / 44 | Wert 1.208.000 → 725.000 (Herkunft Indikation), Makrolage gut → durchschnittlich, Wertsteigerung sehr hoch |
| 2026-1055 | Hauptstr. 51 | 04.11. | 60 / 71 | 58 / 48 | – |
| 2026-1056 | Parkstr. 9 | 04.11. | 93 / 87 | 70 / 75 | Wert 487.000 → 453.000 (Indikation), Mikrolage sehr schwach → sehr gut, Makro gut, Nachfrage stark, Wertsteigerung sehr hoch |
| 2026-1082 | Sachsenstraße 18 | 04.11. | – / – | – / – | – |
| 2026-1088 | Hermannstrasse 9 (alt) | 29.10. | – / – | – / – | – |
| 2026-999 | Musterstraße 12 | 04.11. | 47 / 34 | 55 / 45 | – |

DS = `_dealpilot_score` (Deal Score), Investor = `_ds2_score`. P = Prod, S = Staging.

**Nicht gespiegelt, obwohl Prod seit dem 28.10. unverändert ist:**
- **2026-004 Bäckerstr. 7.** Auf Staging fällt der Deal Score von 56 SOLIDE auf **27 KRITISCH** (Investor 56 → 36, DSCR 0,99 → 0,80). Dazu kommt ein Wertermittlungsstichtag 09.06.2026. Der Stand ist mit der Staging-Gewichtung entstanden und würde die Geschichte auf Prod ändern.
- **2026-1002 Am Markt 9 privat** (verloren). Dort hat Staging 30 Rechenfelder neu, die Scores sinken von 85/74 auf 71/65. Ohne Nutzen für die Demo, deshalb mit dem Rest zurückgestellt.

## 3 · Gewichtung: Staging und Prod sind verschieden

| | Prod | Staging |
|---|---|---|
| `dp_dealscore2_preset` | `lage` (Lage-Fokus) | `balanced` (Ausgewogen) |
| `dp_dealscore_weights` | 20/22/14/14/30 (Lage-Fokus) | **35/15/20/20/10 = Werte der Vorlage „Vorsichtig“** |
| `dp_dealscore_eigen` | – | `1` (eigene Regler gelten) |
| Stand im Blob | 29.10.2026 09:27 UTC | 09.11.2026 11:41 UTC (Zeile geschrieben 10.11. 14:43, das ist die Rücksicherung nach dem Vorfall „Prüflauf 02“) |

Das erklärt beide Messungen. Am 28.10. galt auf beiden Servern Lage-Fokus. Auf Staging stehen seit spätestens 09.11. die Vorsichtig-Gewichte als eigene Regler, und die seither auf Staging gespeicherten Scores rechnen damit (wissen/2026-11-11: 20 von 24 Treffern).
Wodurch der Wechsel am 09.11. kam, ist nicht gefunden. Vermutlich durch einen Video- oder Prüflauf.
**Nicht geändert.** Erst entscheidet Marcel, welche Gewichtung die Demo trägt. Danach können die Staging-Objekte einmal neu gespeichert und anschließend gespiegelt werden.

Weitere Unterschiede in `user_settings` (nicht angeglichen): `lage_profil` (Prod 22.10., Staging 13.10.), `bwk_profil`, `mandanten` (Prod hat zusätzlich „Test UG (v1226)“), `stammdaten`, `portfolio_analyse`, `pdf_vorgabe` (nur Staging).

## 4 · Marktberichte

Prod: 66 Berichte im Demo-Konto, der jüngste vom 27.10. (Spiegel). Staging: 340, davon 54 seit dem 28.10., fast alle aus Prüf- und Videoläufen.
Für VOLL-A/B gibt es keinen Bericht und keine Nebenzeilen (tax_*, avm, dateien, shares …). **Kein Bericht gespiegelt.** Ohne aktualisierte Objekte gäbe es keinen Bezug.

## 5 · Nur auf Staging (nicht gespiegelt, 35)

- Verloren: 1078 Teststraße 5, 1106 Musterweg 7, 1119 Westerfeld (E2E).
- Kopien Lindenallee 14: 1124, 1126, 1127, 1143–1147. Das Original 2026-1123 `2b57a20f` ist seit 29.10. auf Staging gelöscht und liegt nur noch auf Prod.
- „Unbenannt“ (leere Neuanlagen): 1125, 1128, 1130, 1131, 1134–1139, 1141.
- Fachliche Prüfobjekte: 1129 Sanderstraße 10 Würzburg (Bayern), 1132/1133 Habighorst 17 (A ohne / B mit Erbbaurecht), 1142 Teststraße 5 Hüllhorst, 1148–1156 Hamburg (9 Objekte, HH-Prüfung).

## 6 · Sicherungen

- Prod `/root/backups/haupt-20261111-0859-vor-demo-spiegel.sql.gz`: 22 MB, Kopf und „dump complete“ angesehen, 82 COPY.
- Prod `/root/backups/mb-20261111-0859-vor-demo-spiegel.sql.gz`: 31 MB, Kopf und Schluss angesehen, 49 COPY.
- Zeilenabzüge Prod `demo-objekte-prod-20261111-0859-vor-spiegel.json.gz` (21 Zeilen) und `demo-settings-prod-20261111-0859.json.gz`.
- Staging `demo-objekte-staging-20261111-0859-vor-prod-spiegel.json.gz` (56 Zeilen) und `demo-settings-staging-20261111-0859.json.gz`.

Die Abzüge sind COPY-Textformat, je Zeile ein `row_to_json`.

## 7 · Offen (Marcel)

1. ~~Gewichtung der Demo~~ – entschieden 11.11.: Lage-Fokus, auf Staging zurückgesetzt (Abschnitt 8).
2. Danach entscheiden, ob der Staging-Stand nach Prod soll. Damit fielen die Prod-Neuabrufe vom 29.10. und 04.11. weg. Die Staging-Eingaben ändern die Geschichte bei Parkstr. 9, Bismarckstr. 27 und Westerfeldstr. 140.
3. Lindenallee 14: Prod führt 2026-1123, Staging nur Kopien. Welche ist die Demo?
4. Wer hat am 09.11. um 15:14 UTC auf Prod Westerfeld und Hölderlin gespeichert?


## 8 · Nachtrag 11.11. vormittags (Marcel: „ja mach das alles so fertig“), nur Staging

**Gewichtung auf Staging zurück auf Lage-Fokus.** Geändert wurde nur die Score-Gewichtung in `user_settings.browser_vorgaben`:
- `dp_dealscore2_preset` balanced → `lage`
- `dp_dealscore_weights` → 20/22/14/14/30
- `dp_dealscore_eigen` entfernt, wie auf Prod

Der Rest des Blobs ist unverändert (`dp_std_set`, `dp_score_ansicht`, `dp_investment_profile`). Die übrigen Einstellungen sind md5-gleich wie vorher.
Das UPDATE lief mit md5-Vorbedingung (3fd6ad7b… → 48bc41ce…). Vorher gesichert: `/root/backups/demo-settings-staging-20261111-1000-vor-lage.json.gz` (11 Zeilen).

**Die gespeicherten Scores sind NICHT umgerechnet.** Sie bleiben so lange verschieden, bis das Objekt in der App gespeichert wird.
Von Prod weichen jetzt 17 der 19 gemeinsamen Objekte ab, Werte wie in Tabelle 2 und dazu 2026-004 (DS 56/27, Investor 56/36) und 2026-1002 (85/71, 74/65).
Gleich sind nur 1082 und 1088, die beide keinen Score haben, sowie VOLL-A/B.
Die Abweichung kommt nicht allein von der Gewichtung: Auch der DSCR ist auf beiden Seiten seit dem 28.10. neu gerechnet, zum Beispiel Bäckerstr. 0,99 → 0,80.

**Westerfeldstr. 140, `mietausfall` 3942: richtig, nicht geändert.** Meine Vermutung „Betrag im Prozentfeld“ (Bericht von heute früh) war falsch und ist hiermit zurückgenommen.
`#mietausfall` ist ein Euro-Feld („Kalkulat. Mietausfall / Jahr“, Präfix €, index.html). Seit v3238 trägt es den berechneten Betrag Jahresnettokaltmiete × Leerstand (calc.js, Block „MIETAUSFALL = LEERSTAND“).
Rechnung: 39.420 € × 10 % = 3.942 €. Die Bewirtschaftung auf Staging liegt genau um diese 3.942 € über Prod (23.334 gegen 19.392).
Prod führt 0, weil der Leerstand dort 0 ist. Auch das ist in sich stimmig. Offen ist nur die Frage, welcher Leerstand die Demo trägt.

**Storybook** neu erzeugt mit `node tools/messe-storybook.mjs`: Es liest Staging nur per SELECT, das PDF druckt ein lokales Headless-Chrome, Kosten fallen keine an. Ergebnis 18 Objekte, 24 Seiten.
Gegen das Storybook von heute früh haben sich nur Ravensberger (63 → 71 Gut) und Hölderlin (57 → 68 Solide) geändert, beides aus den Speicherungen von heute.
**Eine Geschichte passt nicht:** Gohliser Str. 42 sagt Score „Gut“, gespeichert ist 68 Solide (Prod 77 Gut). Das kommt vom Staging-Stand mit der alten Gewichtung. Nach einmal Speichern mit Lage-Fokus erneut prüfen, den Text nicht ändern.

**Nicht angefasst:** Lindenallee 14 und die 17 Objekte mit Prod-eigenen Ständen. Prod ist unverändert.
