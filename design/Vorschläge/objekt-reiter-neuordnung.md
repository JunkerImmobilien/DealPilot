# Vorschlag: Der Reiter Objekt wird neu geordnet (N4)

**Stand: 04.10.2026, Entwurf.** Erst Befund, dann Vorschlag. Gebaut wird
nichts, bevor Marcel den Vorschlag gesehen hat — Demo-first.

Marcel, 04.10.2026 abends: *„Das ist ja jede, jede, jede Menge, die dort
angegeben werden muss an Feldern. … Wir haben auch besondere Bauteile, auch
die Ausstattung und allem. Das haben wir doch oben im Tab Objekt schon drin.
… Weil da haben wir zum Beispiel auch Keller und Abstellraum. … jetzt steigt
da, glaube ich, der Kunde nicht richtig durch."*

---

## 1 · Befund: so sieht der Reiter heute aus (gemessen)

Quelle: `frontend/index.html` Z. 994–1533, Feldlisten `frontend/js/storage.js`.

| Zählung | Anzahl |
|---|---:|
| Eingabefelder im Reiter Objekt | **130** |
| davon technische Hidden-Felder | 9 |
| **vom Nutzer zu füllen** | **121** |
| davon im Block „Wertermittlung (Marktbericht)" | **37** (30 %) |
| **beim Laden unsichtbar** (drei zugeklappte Gruppen) | **71 von 121** |

Die Gliederung in Dokumentreihenfolge — drei Gruppen sind JS-Akkordeons
und **alle drei beim Laden zu**:

| # | Gruppe | Zeile | Felder | Zustand |
|---|---|---:|---:|---|
| 1 | Objektdaten | 1031 | 8 | offen |
| 2 | Weitere Objektdetails (darin „Ausstattung im Detail", 8 × `eq_*`) | 1042 | 26 | **zu** |
| 3 | Investitionsthese / Risiken | 1069 | 2 | offen |
| 4 | Erwerb & Besitzübergang | 1072 | 13 (7 versteckt) | offen |
| 5 | Ausstattungsqualität | 1077 | 6 | offen |
| 6 | Sterne-Bewertung | 1110 | 8 | **zu** |
| 7 | Lage- & Markt-Indikatoren | 1186 | 9 | offen |
| 8 | Objektfotos | 1265 | 1 | offen |
| 9 | Sonstige Bemerkungen | 1276 | 1 | offen |
| 10 | Grund & Boden (mit Erbbaurecht) | 1279 | 14 | offen |
| 11 | **Wertermittlung (Marktbericht)**, sechs Unterblöcke | 1384 | **37** | **zu ab Werk** |

> Der Nutzer sieht beim Öffnen 50 Felder und weiß nichts von den anderen 71.
> Was er davon für seinen Bericht braucht, steht nirgends.

## 2 · Befund: dieselbe Sache mehrfach gefragt

Je Zeile: oben = Gruppen 1–7, unten = Block 11. **Keine der Paarungen hat
kompatible Wertebereiche** — es sind verschiedene Skalen für dieselbe Sache.

| Sache | oben | unten | Skalen |
|---|---|---|---|
| **Dach** | `eq_roof` Eindeckung · `mod_dach` Alter | `ausst_dach` Stufe 1–5 · `nhk_dach` Ausbau | **vier** |
| **Fenster** | `eq_windows` Verglasung · `mod_fenster` Alter · `rate_fenster`/`qual_fenster` Sterne | `ausst_fenster` Stufe 1–5 | **vier** |
| **Bad** | `bad_anz` Anzahl · `mod_baeder` Alter · `rate_bad`/`qual_bad` Sterne · `eq_bath` **verstecktes Feld ohne Eingabe** | `ausst_sanitaer` Stufe 1–5 | vier, eine unbefüllbar |
| **Heizung** | `eq_heating` Anlagentyp · `mod_heizung` Alter | `ausst_heizung` Stufe 1–5 | drei |
| **Boden** | `eq_floor` Material · `rate_boden`/`qual_boden` Sterne | `ausst_fussboeden` Stufe 1–5 | drei |
| **Außenwände** | `eq_walls` gedämmt ja/nein · `mod_aussenwand` Alter | `ausst_aussenwaende` Stufe 1–5 | drei |
| **Keller** | `eq_store_room` Lage des Abstellraums | `nhk_geschosse` Unterkellerung als Geschoss-Kombination | zwei, ohne gemeinsamen Wert |
| **Geschosse** | `etagen_ges` Zahl | `nhk_geschosse` vier feste Kombinationen | „3 Etagen" ist unten nicht darstellbar |
| **Ausstattung gesamt** | `ausst` 4 Stufen, „Normal" vorbelegt | `standardstufe` 5 Stufen, leer möglich | keine definierte Abbildung |
| **Zustand** | `ds2_zustand` 5 Werte · `modernis` Jahr · 8 × `mod_*` | `baustatus` 5 Werte · `mod_punkte` Anlage 2 | `mod_punkte` ist **rechnerisch redundant** — `computeModPoints()` (rnd-wizard.js:931) bildet es aus den 8 `mod_*`; voice-import.js:9382 und mfh-einheiten.js:622 setzen es schon automatisch, nur das Formular nicht |
| **Bodenrichtwert** | `brw` €/m², drei Abruf-Knöpfe | `brw_manuell` €/m², „leer = amtlicher Abruf" | **echtes Doppel**, gleiche Einheit, kein Abgleich, Abruf nur oben |
| **Aufzug** | `eq_elevator` ja/nein | `bes_bauteile` €-Betrag, Platzhalter „z. B. Aufzug" | ja/nein vs. Euro |
| **Balkon/Terrasse** | `balkon_flae` m² | `btl_balkone` € · `btl_terrassen` € | m² vs. Euro |
| **Stellplatz** | `garagen`, `stellpl_aussen` Anzahl | `stellplatz_miete_monat` € · `garagen_bgf_qm` m² · `garagen_stufe` | vier Größen, keine doppelt, aber verstreut |

**Nur einmal vorhanden, richtig so:** `lzs_pct` (Liegenschaftszins), `brw_stichtag`.

## 3 · Befund: automatisch ermittelbar, steht aber als leeres Feld da

Marcel: *„Liegenschaftszinssatz und allem, die können wir ja automatisch
ermitteln, genauso wie den Bodenrichtwert."*

| Feld | Platzhalter / Hilfetext (wörtlich) | Automatik existiert | Knopf im Reiter |
|---|---|---|---|
| `lzs_pct` | „leer = amtlicher bzw. gesetzlicher Wert" | ja — Register, 10 von 17 Objekten Stufe A (v1839) | **nein** |
| `sachwertfaktor` | „leer = aus der Parametertabelle" | ja — Register | **nein** |
| `brw_manuell` | „leer = amtlicher Abruf" | ja — aber am **anderen** Feld `brw` | nur oben |
| `mod_punkte` | „— keine Angabe, wird geschätzt —" | ja — `computeModPoints()` aus den 8 `mod_*` | nein |
| `standardstufe` | „— keine Angabe —" | ableitbar aus `ausst` / `ausst_*` | nein |
| GND / RND | — | **kein Feld im Reiter Objekt**; RND nur im Reiter Steuer (`afa_rnd_jahre`) | — |
| Baupreisindex | — | kein Feld, vollautomatisch im Bericht | — |

> Ein Feld mit dem Platzhalter „leer = holt sich der Bericht selbst" ist kein
> Eingabefeld. Es ist eine Ausnahme, die wie eine Pflicht aussieht.

## 4 · Befund: was die Schnittstelle wirklich liest

Gemessen am 04.10.2026 durch Lesen des Codes (Fundstellen Datei:Zeile),
Stichproben am Mapper nachgezählt. Quelle: `marktbericht/backend/src/`.

### 4.1 · Es gibt zwei Wege in den Bericht — und der Reiter Objekt kennt nur einen

| Weg | Aufrufer | geht durch | trägt |
|---|---|---|---|
| **Objekt-Weg** | `dealpilot-mb.js:536`, `dealpilot-mb-qc.js:323`, `voice-import.js:8191/9424` → `POST /reports/from-dealpilot` | `DealPilotObjectMapper.reportInput()` | **genau 30 Schlüssel** — alles andere im gesendeten Objekt existiert für den Bericht nicht |
| **Formular-Weg** | Marktbericht-App (`mb-stufen.js`, `wertermittlung.js:924`) → `POST /reports/generate` | kein Mapper | die ganze Wertermittlungsliste (BGF, Standardstufe, Gewerke, BWK …) |

Der Reiter Objekt erreicht **nur den Objekt-Weg**. Das iframe der
Marktbericht-App bekommt von der Haupt-App sechs Werte
(`marktbericht-view.js:62-82`: Adresse, Art, Fläche, Baujahr, Preis, Ref)
und sonst nichts.

**Dazu eine Stufensperre:** `ReportOrchestrator.js:1058-1068` verwirft
Boden-, Ertrags- und Sachwert vollständig bei `wert_stufe < 3`. **Kein
Aufrufer der Haupt-App sendet jemals Stufe 3** — `dealpilot-mb.js` sendet
`fast:true` (= Stufe 1), `voice-import.js` Stufe 2. Stufe 3 gibt es nur in
der Marktbericht-App.

### 4.2 · Die 30 Felder, die ankommen — und was sie bewirken

| Feld im Reiter | im Bericht als | Wirkung |
|---|---|---|
| Straße, Nr., PLZ, Ort | `address` → lat/lon | **Grundlage jeder GeoMap-Abfrage** |
| `objart` | `property_type` | **stark**: GeoMap-Objektklasse, Verfahrenswahl, Etagen-Ausnahme, LZS-Zweig |
| `wfl` | `living_area` | **stark**: GeoMap-Flächenband ±25…60 %, Multiplikator des Marktwerts |
| `baujahr` | `build_year` | **stark**: GeoMap-Baujahrband, Neubau-Erkennung, Restnutzungsdauer |
| `ds2_zustand` | `condition` | **stark**: Faktor 0,70–1,08; steuert GeoMap `firstTimeUse`/`refurbished` |
| `ausst` | `quality` | Faktor 0,93 / 1,0 / 1,06 / 1,12 |
| `ds2_energie` | `energy_class` | Faktor 0,90–1,06 — geht **nicht** an GeoMap (dort feste Klassen) |
| `kp`, `nkm` | `purchase_price`, `monthly_net_rent` | Rendite, Faktor, Abschlag — **`nkm` sendet der Reiter aber nicht** (fehlt in der ZUSATZ-Liste `dealpilot-mb.js:157`) |
| `gsfl` | `plot_area` | Mehrflächenkorrektur bei Häusern — nur mit BORIS-Wert; geht **nicht** an GeoMap |
| `einheiten` | `units` | Verfahrenswahl, Verwaltungskosten — Ertrags-/Sachwertteil nur Stufe 3 |
| `etage` | `floor` | schwach: EG 0,97, ab 4. OG 1,02 |
| `vermstand` | `vacancy` | schwach: −3 %; geht **nicht** als `leased` an GeoMap |
| `zimmer` | `rooms` | **nur durchgereicht** an den KI-Prompt, kein Faktor, kein GeoMap-Filter |
| `brw` | `land_value_manual` | BORIS-Rückfall, Bodenwertbasis — **sendet der Reiter nicht** (nur Spracheingabe) |
| `mea` | `mea_pct` | ohne MEA bei ETW bewusst kein Bodenwert — **sendet der Reiter nicht** |
| `erbpacht`, `erbbauzins`, `erb_restlz` | `leasehold*` | ganzer § 50-Block — **sendet kein einziges Frontend**, auch die Marktbericht-App hat kein Feld |
| `eq_elevator` | `elevator` | ×1,02 / ×1,03 — **das einzige `eq_*`-Feld mit stufenunabhängiger Zahlwirkung** |
| `eq_heating`, `eq_windows`, `eq_floor`, `eq_walls`, `eq_roof` | Gewerke | **nur Stufe 3**, dort Standardstufen-Vorschlag über `ausstattung_stufen.js` — und der deckt nur 72 von 100 Wägungsanteilen, ergibt also allein keine Standardstufe |
| `eq_bath` | `bath` (Wägung 9) | **praktisch tot**: verstecktes Feld ohne Eingabe, nichts schreibt es; damit verliert auch `eq_guest_wc` seinen Hebel |
| `eq_store_room` | `store_room` | **brach**: nur in `ReportOrchestrator.js:124`, sonst kein Leser |

**An GeoMap gehen aus dem Objekt genau fünf Dinge:** Koordinate, Objektart,
Wohnfläche, Baujahr, Zustand. Alles andere — Radius, Zeitfenster,
Energieklassen, `leased`, Erbbau-Suchstring — ist **fest** im Code.
`numberOfRoomsRange`, `propertySpaceRange`, `heatingTypes`,
`preservationOrder` existieren im Connector und **setzt kein Aufrufer**.

### 4.3 · Der Block, der am meisten fragt, liefert nichts

**Vom Block „Wertermittlung (Marktbericht)" — 37 Felder — erreicht auf dem
Objekt-Weg kein einziges den Bericht.** Nicht BGF, nicht Standardstufe,
nicht die neun `ausst_*`-Stufen, nicht `mod_punkte`, nicht `sachwertfaktor`,
nicht `nhk_*`, nicht Hinterland, nicht Garagen-BGF, nicht Außenanlagen,
nicht `bes_bauteile`/`btl_*`, nicht `lzs_pct`, nicht `brw_manuell`, nicht
`brw_anpassung_*`, nicht `baustatus`, nicht `grundriss`. Der Mapper gibt
sie nicht zurück — zwei davon (`standardstufe`, `garagen_bgf_qm`) sendet
`voice-import.js:9404` sogar ausdrücklich mit, der Mapper verwirft sie.

Weitere brachliegende Eingaben **außerhalb** des Blocks:

| Felder | Befund |
|---|---|
| `modernis` (Jahr) | gesendet, nicht gemappt → `MODERNIZATION_FACTOR` greift nie, „Modernisierung" zählt dauerhaft als **fehlend** und dämpft die Aussagekraft |
| `garagen`, `stellpl_aussen`, `balkon_flae` | gesendet, nicht gemappt → Stellplatzwert bis 30.000 € bleibt leer |
| `nutzungsart` | nicht gemappt → Verfahrenswahl fällt auf „vermietet" zurück |
| `mikrolage`, `makrolage`, 7 × `ds2_*` (Bevölkerung … Marktfaktor) | gemappt in `assessment()` — **die Funktion hat keinen einzigen Aufrufer** |
| `rate_*`/`qual_*` (Sterne, 8 Felder) | gesendet, kommen im Mapper nicht vor |
| `bad_anz` | kein Mapper-Feld; `bathrooms` gäbe +2 % ab 2 Bädern |

### 4.4 · Umgekehrt: der Bericht erwartet, was niemand eingeben kann

| erwartet | Befund |
|---|---|
| `bwk_instandhaltung_je_qm`, `bwk_mietausfall_pct`, `bwk_betrieb_nul_jahr`, `bwk_modus` | kein Feld in **beiden** Frontends |
| `gfz_koeff`, `beitrag_abzug_eur`, `bom_positionen` | kein Feld in beiden |
| `first_time_use`, `refurbished`, `reconstruction_year` | wertbestimmend über die GeoMap-Kaskade — kein Mapper-Feld, kein Feld im Reiter |
| `eq_energie` (Energieträger), `bathrooms`, `sonstige_jahr`, `bom_eur` | nur in der Marktbericht-App |
| `MOD_ELEMENTE.gewerk_mapping` (`immowertv.js:85-92`), Brücke `eq_*` → Anlage-2-Punkte | **toter Code**, nie verdrahtet („wird in Paket A nur VORBEREITET") |

> **Das ist der Kern des Befunds:** Marcel hat es gefühlt richtig — es wird
> zu viel gefragt. Aber der Grund ist nicht, dass die Felder doppelt sind.
> Der Grund ist, dass **der Block mit den meisten Feldern an keine Rechnung
> angeschlossen ist** und die Rechnung, die er bedienen sollte (Stufe 3),
> aus der Haupt-App gar nicht erreichbar ist. Ein Formular aufzuräumen,
> das ins Leere schreibt, räumt nur die Oberfläche auf.

## 5 · Vorschlag

### 5.1 · Vier Grundsätze

1. **Eine Sache, ein Feld.** Dach, Fenster, Bad, Heizung, Boden, Außenwände
   werden je **einmal** erfasst — in einer Zeile mit drei Spalten: *Art*
   (heute `eq_*`), *Jahr* (heute `mod_*`), *Standardstufe* (heute
   `ausst_*`). Die Stufe wird aus Art und Jahr **vorgeschlagen** und ist
   überschreibbar. Damit fallen die Sterne (`rate_*`/`qual_*`), die zweite
   Ausstattungsskala und `mod_punkte` als Eingabe weg.
2. **Was automatisch geht, wird nicht gefragt — es wird gezeigt.**
   Bodenrichtwert, Liegenschaftszins, Sachwertfaktor, GND/RND,
   Modernisierungspunkte, Baupreisindex erscheinen als **abgerufene Werte
   mit Herkunft** (Wert · Quelle · Stichtag · Stufe A–E), nicht als leeres
   Feld mit dem Platzhalter „leer = holt sich der Bericht". Ein Knopf
   „abweichend eintragen" öffnet die Überschreibung — mit Pflicht-Grund.
3. **Drei Ebenen statt elf Gruppen.** Sichtbar ist, was der
   Marktbericht **rechnet**; eine Stufe tiefer, was ihn **verfeinert**;
   eine weitere, was nur das **Gutachten** (Stufe 3) braucht.
4. **Die Schnittstelle zuerst.** Kein Feld bleibt im Formular, das die
   Schnittstelle nicht liest; kein Feld wird gelesen, das das Formular
   nicht hat. Der Mapper wird erweitert, **bevor** das Formular umgebaut
   wird — sonst bleibt das neue Formular genauso hohl wie das alte.

### 5.2 · Die drei Ebenen

**Ebene 1 — „Objekt" (offen, ca. 16 Felder):** genau die Felder aus 4.2 mit
Wirkung: Adresse (4), Objektart, Nutzungsart, Wohnfläche, Zimmer, Baujahr,
Etage/Etagen, Einheiten, Zustand, Energieklasse, Grundstück,
Vermietungsstand, Erbbaurecht ja/nein. Darunter die **Automatik-Leiste**
(Grundsatz 2) mit den sechs abgerufenen Werten.

**Ebene 2 — „Weitere Objektdetails" (zu, ein Klick, ca. 30 Felder):**
die **Gewerke-Tabelle** (8 Zeilen × Art/Jahr/Stufe), Bauteile (Aufzug,
Balkon m², Keller/Abstellraum, Garagen, Außenstellplätze, Bäder-Anzahl),
Grund & Boden (Gemarkung/Flur/Flurstück — optional, siehe N3; MEA;
Hinterland), Erbbaurecht-Details (Zins, Restlaufzeit), Modernisierung
(Jahr, Erstbezug/kernsaniert).

**Ebene 3 — „Für das Gutachten (Stufe 3)" (zu, mit Hinweistext „nur für
Sach- und Ertragswert nach ImmoWertV", ca. 20 Felder):** BGF, NHK-Typ,
Geschosse/Unterkellerung/Dach als **ein** Auswahlfeld statt drei, Garagen-
BGF und -Stufe, Außenanlagen, besondere Bauteile in € (eine Liste, keine
fünf Einzelfelder), BWK-Angaben (Instandhaltung je m², Mietausfall %,
Verwaltung), Bodenwertabschläge (`bom`), sonstige wertbeeinflussende
Umstände. Hier stehen auch die Überschreibungen der Automatik-Leiste.

Von **121** Feldern bleiben rund **66** — und jedes davon wird gelesen.

### 5.3 · Was wegfällt oder sich entscheidet

| heute | Vorschlag | Grund |
|---|---|---|
| Sterne-Bewertung (8 Felder) | **raus** | wird nirgends gelesen; die Gewerke-Zeile ersetzt sie |
| `ausst` (4 Stufen) **und** `standardstufe` (5) | **nur Standardstufe 1–5** (ImmoWertV) | eine Skala; `quality` im Mapper wird daraus abgeleitet |
| `mod_punkte` | kein Feld — gerechnet aus den Gewerke-Jahren | `computeModPoints()` tut es schon in zwei Modulen |
| `brw` + `brw_manuell` | **ein** Wert in der Automatik-Leiste + Überschreibung | echtes Doppel, kein Abgleich |
| `nhk_haus` + `nhk_geschosse` + `nhk_dach` | ein Feld „Haustyp" (Kombination) | „3 Etagen" war unten nicht darstellbar |
| `btl_*` (5 Euro-Felder) | Liste „besondere Bauteile" (Bezeichnung + €) | wie `bauteile_detail`, das der Bericht erwartet |
| `eq_bath` versteckt | echtes Auswahlfeld in der Gewerke-Zeile „Bad" | sonst bleibt Sanitär (Wägung 9) tot |
| Lage-Indikatoren `ds2_*` (9 Felder) | **Entscheidung nötig** — siehe 5.5 | `assessment()` hat keinen Aufrufer |

### 5.4 · Die Pakete, in dieser Reihenfolge

| # | Paket | Seite | Inhalt |
|---|---|---|---|
| P1 | **Mapper erweitern** | Backend MB | `reportInput()` gibt zusätzlich zurück: `standardstufe`, `ausstattung` (aus Gewerken), `bgf`, `nhk_typ`, `mod_punkte`, `lzs_pct`, `brw_manuell`/`brw_anpassung_*`, Hinterland, `garagen_bgf_qm`, Außenanlagen, `bauteile_detail`, `modernis` → `modernization_year`, `garagen`/`stellpl_aussen` → `garages`/`outdoor_parking`, `balkon_flae`, `nutzungsart` → `usage_type`, `baustatus`, `bad_anz` → `bathrooms`. ZUSATZ-Liste um `nkm`, `brw`, `mea`, `erbpacht*`. **Prüfer:** je Feld ein Empfindlichkeitstest (ändert sich der Bericht, wenn das Feld sich ändert?) — siehe `stille-verwerfung-ist-der-teure-fehler` |
| P2 | **Stufe 3 aus der Haupt-App** | Backend Haupt + MB | `wert_stufe` wählbar im Objekt-Weg; sonst rechnet Ebene 3 ins Leere |
| P3 | **Automatik-Leiste** | Frontend | sechs Zeilen Wert/Quelle/Stichtag; LZS und Sachwertfaktor über `/wertparameter/zinssatz` (steht seit v1846), BRW über den vorhandenen Abruf, Überschreibung mit Grund |
| P4 | **Formular-Umbau** | Frontend | drei Ebenen, Gewerke-Tabelle, Felder zusammenlegen, Migration der Altwerte (`ausst` → Standardstufe, `btl_*` → Liste) in `storage.js` |
| P5 | **GeoMap-Filter** | Backend MB | optional: Zimmer, Grundstück, Heizung an den Connector — **vorher messen**, ob die Vergleichsmenge nicht zu klein wird |

P1 und P2 sind Voraussetzung, P3 und P4 sind das, was Marcel sieht.

### 5.5 · Was Marcel entscheiden muss (Bewertungsfragen)

1. **Standardstufe 1–5 als die eine Ausstattungsskala** — und `ausst`
   (einfach/normal/gehoben/luxus) verschwindet?
2. **Lage-Indikatoren (`ds2_*`, 9 Felder):** an den Bericht anschließen
   (`assessment()` verdrahten) oder streichen? Heute werden sie erfasst
   und von niemandem gelesen.
3. **Stufe 3 aus der Haupt-App:** darf der Kunde dort Sach-/Ertragswert
   auslösen (kostet eine `wev`-Einheit), oder bleibt das der
   Marktbericht-App vorbehalten?
4. **Sterne-Bewertung streichen** — oder gibt es einen Grund, den ich im
   Code nicht sehe?

Nach dem Ja zu diesen vier Punkten entsteht als Nächstes eine **Vorlage
in `design/mockups/`** (Demo-first) für Ebene 1 mit Automatik-Leiste und
die Gewerke-Tabelle — bevor eine Zeile gebaut wird.
