# Marktbericht: Stufen abgrenzen, Herkunft vermerken, Doppeltes im PDF

**Stand:** 2026-08-12 · Vorschlag zu Backlog-Punkt 3 („Marktbericht neu
gestalten") · **gemessen im Code, nicht geschätzt** · ergänzt den Entwurf
`marktbericht-wizard.html` (2026-08-11)

---

## 0 · Was Marcels Vorgaben vom 12.08. entscheiden

Der Backlog-Punkt war **auf zwei Geldfragen blockiert**. Beide sind
beantwortet:

| Frage | Marcels Antwort |
|---|---|
| Wann wird abgerechnet, wenn die Stufe sich erst am Ende ergibt? | **Beim Erzeugen.** |
| Was kostet das Vertiefen? | **Nur die Differenz.** |

Dazu drei neue Vorgaben:

1. **Felder klar pro Stufe abgrenzen**, und auf **alle Zusatzfelder** achten.
2. **Manuell eingegebener Liegenschaftszins und Sachwertfaktor** werden
   gespeichert, aber die Herkunft ist unbekannt → **erst vermerken**, bis ein
   zweiter Wert für einen Abgleich vorliegt.
3. **Im PDF steht die Preisindikation drei- bis viermal** — zu viel.

**Damit ist der Punkt entblockiert.** Was jetzt folgt, ist das, was der
Backlog-Punkt vor dem Bauen verlangt: die Führung durchgespielt, mit
gemessenen Zahlen.

---

## 1 · Die Abrechnung ist bereits so gebaut, wie entschieden

**Gemessen, nicht angenommen.** Beide Vorgaben sind in `v1125`/`v1126`
umgesetzt, `mb-stufen.js` dokumentiert es im Kopf:

- **Der Preis kommt vom Server:** `GET /marktbericht/stufenpreis?ref=…`
  liefert die schon bezahlte Stufe und den fälligen Betrag je Stufe.
- **Der Browser rechnet die Ermäßigung NICHT selbst aus** — er kennt die
  bezahlte Stufe nicht und soll sie nicht kennen. Sie kommt aus dem
  Kerosin-Log (`marktbericht_cost_log`, Haupt-DB).
- **Antwortet der Server nicht, stehen die vollen Preise da.** Lieber zu viel
  angekündigt als eine Ermäßigung versprochen, die es nicht gibt.

Vollpreise: `{1: 2, 2: 5, 3: 12}` Liter. Die Differenz-Logik ist genau
Marcels „2 nur Differenz".

> **Es ist also nichts neu zu bauen — es ist zu prüfen.** Der Nachweis, der
> fehlt: **erzeugt Stufe 2 nach bezahlter Stufe 1 wirklich nur 3 L Abbuchung?**
> Das ist ein Klicktest am Testobjekt, kein Bauauftrag. Er kostet echtes
> Kerosin und gehört deshalb angekündigt, nicht nebenbei gemacht.

**Eine Regel, die dabei nicht fallen darf** (steht als Kommentar in
`mb-stufen.js`, v1139-VORRAT): `erreicht()` bleibt am **ausgefüllten
Formular**. Würde es den Objektvorrat mitzählen, spränge die Stufe von allein
auf 3 und der Knopf forderte 12 L statt 5 L, **ohne dass jemand geklickt
hat**. — **Kerosin nie ohne Zutun.**

---

## 2 · Die Felder pro Stufe — gemessen

### 2.1 Pflichtfelder: eine Quelle, `BEDARF` in `mb-stufen.js`

| Stufe | kommt hinzu | Feld-Ids |
|---|---|---|
| **1 · Einschätzung** (2 L) | Adresse, Objektart, Wohnfläche, Baujahr | `address` `ptype` `area` `year` |
| **2 · Marktpreisindikation** (5 L) | Baustatus, Zustand, Qualität | `baustatus` `cond` `quality` |
| **3 · Wertermittlung** (12 L) | Grundstücksfläche, Wohneinheiten | `plot` `units` |
| **3 · nur Wohnung** | Miteigentumsanteil | `mea` |
| **3 · nur Haus** | Standardstufe, Hausform (NHK) | `standardstufe` `nhkHaus` |

Die Stufen sind **kumulativ** und `erreicht()` ist eine **Kaskade**: ohne
Stufe 2 ist Stufe 3 unerreichbar. Das ist die Ursache des v1136c-Befunds —
eine Stufe kann vollständig sein und trotzdem gesperrt.

**Was gut ist und bleiben muss:** `fehlend()` liest aus `BEDARF`, also aus
**einer** Quelle. Der frühere `FEHLT_TEXT` war eine zweite, handgepflegte
Liste derselben Angaben und lief prompt auseinander (v1126d). **Keine zweite
Liste anlegen.**

### 2.2 Die Zusatzfelder — hier liegt die eigentliche Arbeit

Zusatzfelder sind **nicht** Pflicht, verändern aber das Ergebnis. Sie hängen
alle an Stufe 3, und **22 von ihnen hängen an der Objektart** (`istWohnung()`):

| Gruppe | Felder | gilt für |
|---|---|---|
| NHK-Gebäude | `nhkHaus` `nhkGeschosse` `nhkDach` | nur Haus |
| Feinjustierung Gewerke (9) | `ausstAussenwaende` `ausstDach` `ausstFenster` `ausstInnenwaende` `ausstDecken` `ausstFussboeden` `ausstSanitaer` `ausstHeizung` `ausstTechnik` | nur Haus |
| Sonstige Bauteile (5) | `btlGauben` `btlBalkone` `btlVordach` `btlTerrassen` `btlSonstige` | nur Haus |
| Sachwertfaktor | `sachwertfaktor` | nur Haus (v1145: bei Wohnungen ohne Wirkung) |
| Wohnungsspezifisch | `mea` `grundriss` | nur Wohnung |
| Flächen und Zuschläge | `bgf` `garagenBgf` `garagenStufe` `aussenPct` `hinterlandFlaeche` `hinterlandWert` `hinterlandRent` | beide |
| Erträge | `spMiete` `sonstEinnahmen` | beide |
| Parameter | `lzs` `brwManuell` `brwStichtag` `brwAnp` `brwAnpGrund` `sanierungsjahr` `modGrad` | beide |

**Drei gemessene Fallen, die ein Wizard sonst kassiert:**

1. **Die Objektart muss in Schritt 1 stehen und dort bleiben.**
   `istWohnung()` entscheidet über 22 Felder. Der v1119-WAUS-Befund:
   `ptype` fehlte in der Auslöserliste — wer die Objektart wechselte, sah die
   Hausfelder **nie**, und drei davon sind Pflicht.
2. **Felder mit `wenn:`-Bedingung erscheinen nur nach echter Nutzereingabe.**
   `garagenStufe` und `hinterlandRent` werden bei **programmatischem** Setzen
   nicht nachgezeichnet. Ein Wizard, der Werte einträgt statt sie eintippen
   zu lassen, verliert sie.
3. **Das Henne-Ei-Problem ist gelöst, aber empfindlich** (v1126c): die Felder,
   die auf Stufe 3 hochstufen, liegen selbst im Block `wm-b3`, den
   `wertermittlung.js` erst `if (s >= 3)` baut. Deshalb ist der Meilenstein
   **anklickbar** — `_angestrebt` ist eine **Untergrenze, nie eine
   Behauptung.** Wer daran rührt, macht Stufe 3 wieder unerreichbar.

### 2.3 Was daraus für die Wizard-Reiter folgt

Der Wizard (`mb-wizard.js`, v1127, auf sechs Reiter erweitert in v1129) hängt
die **dieselben DOM-Knoten** um, statt sie neu zu bauen — deshalb liest
`payload()` weiter dieselben Ids und jeder Listener bleibt hängen.
**Das ist die richtige Bauweise und bleibt.**

**Die Prüfung, die noch fehlt:** steht jedes Pflichtfeld einer Stufe auch im
Reiter dieser Stufe? Der Backlog nennt das als wahrscheinlichsten Grund für
den stillen Erzeugen-Knopf. Aus 2.1 lässt sich das jetzt **gegenprüfen** —
für jede der neun Pflicht-Ids den Reiter feststellen, in dem sie landet, und
gegen die Stufe halten. Das ist eine Messung im Browser, keine Schätzung.

---

## 3 · Die Herkunft manueller Parameter — echter Befund

**Marcels Vorgabe ist im Code belegt.** Gemessen in
`marktbericht/backend/src/services/CrossCheckService.js`:

### 3.1 Sachwertfaktor: alle sieben Herkunftsfelder hängen am Tabellenweg

```
const _swfEigen = Number(p && p.sachwertfaktor_param && (…wert ?? …sachwertfaktor));
if (!(_swfEigen > 0) && _sw && _sw.vorlaeufiger_sachwert_eur != null) {
  _swfTab = swfNachTabelle({ … });     // <- nur DIESER Zweig füllt _swfTab
}
```

Danach, in `out.sachwert` (Z. 237 ff.), hängen **alle** Herkunftsangaben an
`_swfTab`:

| Feld | Quelle | bei eigenem Wert |
|---|---|---|
| `sachwertfaktor_grund` | `_swfTab.grund` | **null** |
| `sachwertfaktor_hinweis` | `_swfTab.hinweis` | **null** |
| `sachwertfaktor_stuetzstellen` | `_swfTab.stuetzstellen` | **null** |
| `sachwertfaktor_ausschuss` | `_swfTab.ausschuss` | **null** |
| `sachwertfaktor_tabellenwert` | `_swfTab.tabellenwert` | **null** |
| `sachwertfaktor_korrekturen` | `_swfTab.korrektur_*` | **null** |

Gibt der Nutzer einen eigenen Faktor ein, wird der Tabellenzweig
**übersprungen** — `_swfTab` bleibt `null`, und damit sind sämtliche
Herkunftsangaben leer. **Der Faktor wirkt, steht im PDF und in der Datenbank,
und trägt keinen Hinweis, woher er kommt.** Genau Marcels Satz: „da wissen
wir nicht, woher die kommen."

Das verstößt gegen zwei eigene Grundsätze: **„Jede Zahl trägt Herkunft
(Stufe A–E, Modellvermerk, Ausschuss)"** und **„Ein stiller Rückfall ist
schlimmer als ein Fehler."**

### 3.2 Liegenschaftszins: das Muster existiert, der manuelle Weg füllt es nicht

Der LZS führt es richtig — `liegenschaftszins_stufe` **und**
`liegenschaftszins_quelle` (Z. 60, 519, 526). Aber:

```
frontend:  lzs_pct: parseFloat(wert('lzs')) || null      // <- nur der Wert
backend:   liegenschaftszins_stufe: (params && params.lzs_stufe) || null
```

**Das Formular sendet keine Stufe.** Bei manueller Eingabe ist
`liegenschaftszins_stufe` deshalb `null`. Dieselbe Lücke, nur ein Feld
weiter.

### 3.3 Vorschlag: Stufe E, und zwar an der Zahl

Die Kaskade kennt A–E; **E ist die eigene Angabe** (Projektanweisung: Marcels
gegriffene 0,91 für die Löhner Straße war Stufe E, die amtliche
Herford-Matrix liefert 0,889 Stufe A). Das Vokabular ist also schon da.

**Was zu tun ist — klein, aber an drei Stellen:**

1. **Backend, `CrossCheckService.js`:** beim eigenen Wert die Herkunftsfelder
   **nicht leer lassen**, sondern setzen:
   `sachwertfaktor_stufe: 'E'` · `sachwertfaktor_quelle: 'eigene Angabe'` ·
   `sachwertfaktor_grund: 'vom Nutzer eingegeben, keine amtliche Ableitung'`.
   Analog `liegenschaftszins_stufe: 'E'`, wenn `lzs_pct` ohne `lzs_stufe`
   kommt. **Nie stumm** — ein `null` ist keine Herkunft.
2. **Frontend:** beim Absenden kennzeichnen, dass der Wert aus dem Feld kommt
   (`lzs_stufe: 'E'` bzw. `sachwertfaktor_param.stufe: 'E'`), damit das
   Backend nicht raten muss. **Der Nutzer wird nicht gefragt** — er hat es ja
   eingegeben, das ist die Kennzeichnung.
3. **Anzeige und PDF:** die Zahl trägt ihren Vermerk sichtbar, wie es der
   amtliche Weg schon tut („Ausschuss X, Stufe A"). Für E:
   **„eigene Angabe — nicht amtlich abgeleitet."**

### 3.4 Der Abgleich, den Marcel meint

> „bis wir einen weiteren Wert bekommen, um einen Abgleich machen zu können"

Das ist mehr als ein Etikett — es ist ein **Vorhalt**. Sobald für denselben
Kreis ein amtlicher Faktor geerntet ist, lässt sich die eigene Angabe
dagegenhalten:

- Der **Ort dafür existiert schon**: `mb.param_modell` führt
  `kennzahl`/`zweig`/`ags`/`berichtsjahr` und trägt den Constraint **kein
  Datensatz ohne Beleg**. Die eigene Angabe gehört **nicht** dorthin — sie ist
  kein Modell, sie ist eine Objektangabe.
- Sie gehört an den **Bericht** (`mb.valuation_results` bzw. der Snapshot),
  mit Stufe E. Beim nächsten Bericht für dieselbe Lage kann dann
  gegenübergestellt werden: **eigene Angabe 0,91 · amtlich 0,889 Stufe A ·
  Abweichung +2,4 %.**
- **Vorbedingung, ehrlich benannt:** `mb.valuation_inputs` **wird derzeit
  nicht beschrieben** (steht als offener Punkt in der Projektanweisung).
  Solange das so ist, sind Berichte nicht reproduzierbar und ein Abgleich
  hätte keine belastbare Grundlage. **Der Vermerk (3.3) ist trotzdem sofort
  richtig** — er kostet nichts und ist die Voraussetzung für alles Weitere.
  Der Abgleich selbst ist ein eigenes Vorhaben.

---

## 4 · Die Preisindikation im PDF — wo sie mehrfach steht

Gemessen in `frontend/marktbericht-app/app.js`:

| Stelle | Text | wie oft |
|---|---|---|
| `app.js:2199`, in `footer()` | „DealPilot · Marktbericht — **Marktpreisindikation**, kein Gutachten n. § 194 BauGB" | **auf JEDER Seite** |
| `app.js:900` | „…belastbare Marktwert**indikation**." | 1× (Konfidenztext) |
| `app.js:902` | „…gute **Indikation**." | 1× (Alternative dazu) |
| `app.js:3344` | „…hohe Plausibilität der **Indikation**." | 1× |

`footer()` läuft bei **jedem** `newPage()`. Der Prod-Bericht hat laut
Kommentar in derselben Datei **sieben Seiten** — die Fußzeile bringt den
Begriff also allein siebenmal, dazu ein bis zwei Textstellen im Fluss.
**Das deckt sich mit Marcels „drei- bis viermal".**

### Vorschlag: der Hinweis gehört genau einmal hin, wo er zählt

Der Satz ist **rechtlich sinnvoll** (Abgrenzung zum Gutachten nach
§ 194 BauGB) — er soll nicht verschwinden, sondern **einmal** stehen:

- **Deckblatt bzw. Seite 1:** der volle Satz, gut sichtbar. Dort liest ihn,
  wer den Bericht in die Hand nimmt.
- **Folgeseiten:** die Fußzeile trägt nur noch **„DealPilot · Marktbericht"**
  und die Seitenzahl. Der Disclaimer wird nicht wiederholt.
- **Die Textstellen im Fluss** (900/902/3344) bleiben — sie sagen etwas
  anderes: nicht „das ist kein Gutachten", sondern **wie belastbar** die Zahl
  ist. Das ist keine Dopplung, nur ein gleiches Wort.

**Umsetzung:** `footer()` bekommt die Seitenzahl schon (`pageNo`) — der
Disclaimer wird an `pageNo === 1` gebunden. Ein Einzeiler, aber
**`footer()` muss zustandsneutral bleiben**: der v957-Befund („fontleak")
zeigt, dass eine Größenänderung in `footer()` auf die Folgeseite durchschlug
und dort Wortlücken erzeugte. Die Größe wird am Ende zurückgegeben — **das
darf nicht kaputtgehen.**

---

## 5 · Was zuerst

| # | Schritt | Art | hängt ab von |
|---|---|---|---|
| 1 | **Disclaimer nur auf Seite 1** (Abschnitt 4) | Frontend, klein | — |
| 2 | **Stufe E an der Zahl** (3.3), Backend + Frontend | Backend-**Rebuild** | — |
| 3 | **Pflichtfeld gegen Reiter prüfen** (2.3) | Messung im Browser | — |
| 4 | **Differenz-Abbuchung nachweisen** (1) | Klicktest, **kostet Kerosin** | Ankündigung |
| 5 | Schrittleiste bei 1024/1280/1920 px messen, Handy-Fassung | Messung, dann Entwurf | 3 |
| 6 | Abgleich eigene ↔ amtliche Angabe | eigenes Vorhaben | `valuation_inputs` |

**Schritt 1 und 2 sind die, die Marcel benannt hat, und beide sind klein und
klar.** Schritt 2 fasst das mb-Backend an — also **Rebuild**, und vorher
eigener `pg_dump` der mb-DB, die in keinem Backup-Skript steht.

**Schritt 4 kostet echtes Kerosin** (Stand zuletzt 86 L) und wird deshalb
nicht nebenbei gemacht, sondern angekündigt.
