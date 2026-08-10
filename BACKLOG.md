# Backlog

**Reihenfolge = Priorität.** Der oberste offene Punkt wird bearbeitet.

Nach Abschluss wandert ein Punkt nach unten unter **Fertig**, mit Datum,
Commit-Hash und dem **Befund** — was war die Ursache, was wurde gemessen.
Dort **ohne** Nummer: Nummern sind Reihenfolge, kein Name. Die verbleibenden
Punkte werden fortlaufend neu durchnummeriert. Hängt etwas, kommt `**BLOCKIERT:**` mit einem Satz Begründung
direkt unter den Punkt — nicht kommentarlos liegenlassen.

**Vorlagen und Bilder:** `design/` (Mockups, Logos). Siehe `design/README.md`.
Marcel legt seine Screenshots **jedes Mal** in `design/mockups/` ab (lokal
`E:\DealPilot\repo\design\mockups`). Vor jedem Punkt, der Optik betrifft,
zuerst dort nachsehen — und **den Dateinamen in den Punkt schreiben**. Ein
Optik-Befund ohne Bildbezug ist eine Vermutung; beim Stapel-Modus kam die
falsche Annahme aus `handy2.jpg`, einer Datei, die gar nicht mehr im Repo
lag.

**Vorschläge und Mockup-Entwürfe gehören nach `design/Vorschläge/`** (lokal
`E:\DealPilot\repo\design\Vorschläge`) — dort liegt schon
`partner-flow-darstellung.md`. Wo ein Punkt eine Entscheidung braucht,
entsteht **zuerst** dort ein Dokument oder eine HTML-Demo, und **danach**
wird gebaut. Das ist die Demo-first-Regel als Ablageort.

**Bildzuordnung erledigt (2026-08-08).** Der Ordner enthielt drei
Screenshots ohne Bezug. Zugeordnet:

| Datei | Punkt | was darauf zu sehen ist |
|---|---|---|
| `Screenshot 2026-08-08 075255.png` | **erledigt** (v1112) | Einstellungen bei Handybreite: 12 Reiter hochkant nebeneinander, Inhaltsfläche leer |
| `Screenshot 2026-08-06 144507.png` | **erledigt** (v1113) | Hero-Score-Kachel, rot umkringelt: „INVESTOR SCORE" und die Zeile darunter — Gold auf Gold |
| `Screenshot 2026-08-08 075210.png` | **erledigt** (v1116er Reihe) | Handy-Kennzahlen: Kachel-Labels überlappen, Werte laufen aus der Kachel |

Zu den offenen Punkten liegt **kein** Bild vor. Das ist kein Mangel — es
sind Ketten-, Funktions- und Gestaltungsfragen, keine Optikbefunde.

---
## Offen

1. **Objekt-Tab: eigener Reiter für die Marktbericht-Felder.** Die
   Zusatzangaben aus der Wertermittlung sollen **nicht** unter die
   Grundwerte, aber auch nicht verloren gehen — ein zusätzlicher,
   aufklappbarer Reiter am Objekt, der sie dauerhaft hält. **Zuerst der
   Abgleich: welche Felder gibt es, welche fehlen.** Die Prüfliste steht:

   | Gruppe | Felder |
   |---|---|
   | Grundlagen | `mea`, `bgf`, `spMiete`, `sonstEinnahmen`, `standardstufe`, `grundriss`, `modGrad` |
   | NHK | `nhkHaus`, `nhkGeschosse`, `nhkDach` |
   | Hinterland / Garage / Außen | `hinterlandFlaeche`, `hinterlandWert`, `hinterlandRent`, `garagenBgf`, `garagenStufe`, `aussenPct` |
   | Feinjustierung Gewerke (9) | `ausstAussenwaende`, `ausstDach`, `ausstFenster`, `ausstInnenwaende`, `ausstDecken`, `ausstFussboeden`, `ausstSanitaer`, `ausstHeizung`, `ausstTechnik` |
   | Sonstige Bauteile (5) | `btlGauben`, `btlBalkone`, `btlVordach`, `btlTerrassen`, `btlSonstige` |

   **Die Stelle, an der so etwas schon einmal verlorenging, ist bekannt:**
   `payload()` in `wertermittlung.js` reicht die Felder an den Bericht, der
   Rückweg ins Portfolio läuft aber über `_mbBuildObjData()` in `app.js`,
   und zwar über DOM-Ids. Was dort fehlt, rechnet im Bericht mit und ist im
   gespeicherten Objekt weg (v1072-Befund, in v1074 nachgezogen). **Beide
   Seiten gegeneinander zählen**, bevor ein Reiter gebaut wird.
   **Hängt mit dem Marktbericht-Vorschlag zusammen** — wer die Felder für einen Wizard neu
   gruppiert, hat den Abgleich ohnehin gemacht.

   **BLOCKIERT:** Der Reiter selbst wartet auf Marcels Auswahl aus
   `design/Vorschläge/marktbericht-gestaltung-10-ideen.html` — wer die 42
   Felder für einen Wizard neu gruppiert, gruppiert sie damit auch für den
   Reiter. Zwei Gruppierungen nacheinander wären doppelte Arbeit.

   **Der Abgleich ist erledigt (2026-08-10, `v1121`, `4049eb1`).** Beide
   Seiten gegeneinander gezählt, wie der Punkt es verlangt. **Fünf Felder
   fehlten auf dem Rückweg** — sie rechneten im Bericht mit und waren im
   gespeicherten Objekt weg:

   | Feld | `payload()` | `_mbBuildObjData()` vorher | jetzt als |
   |---|---|---|---|
   | `bgf` | ✓ | **fehlte** | `bgf` |
   | `sonstEinnahmen` | ✓ | **fehlte** | `sonstige_jahr` |
   | `aussenanlagen` | ✓ | **fehlte** | `aussenanlagen` |
   | `besBauteile` | ✓ | **fehlte** | `bes_bauteile` |
   | `sachwertfaktor` | ✓ | **fehlte** | `sachwertfaktor` |

   Dieselbe Lehre wie `v1072-WSAV-1` und `v1074-WSAV-1`, **zum dritten
   Mal**. Benannt wurde nichts neu — die Namen sind genau die, die
   `payload()` ohnehin ans Berichts-Backend schickt.

   **Die übrigen 25 Felder der Prüfliste sind vollständig:** `mea`,
   `spMiete`, `standardstufe`, `grundriss`, `modGrad`, die drei `nhk*`, die
   drei `hinterland*`, `garagenBgf`, `garagenStufe`, `aussenPct`, alle neun
   `ausst*` und alle fünf `btl*`.

   **Ein eigener Messfehler, zurückgenommen:** Ich hatte gemeldet, 18
   weitere Felder fehlten in `_mbBuildObjData()`. Falsch —
   **die Funktion räumt leere Werte weg**, und ich hatte die Felder nicht
   ausgefüllt. Nach dem Befüllen von sechs davon stieg die Schlüsselzahl
   von 16 auf 22, und alle kamen an. Ein leerer Wert sieht in einer
   JSON-Rückgabe aus wie ein fehlendes Feld; das ist er nicht.

2. **Der Objektnummer fehlt auf cremefarbenem Grund der Kontrast.**
   Gemessen beim `v1113`-Abnahmelauf, Standard-Gold: `hdr-obj-num` steht
   in **kanzlei bei 2,98** und in **boarding bei 2,88** (`#9a7f33` auf
   `rgb(233,227,209)` bzw. `rgb(232,223,197)`). Mit Partner-Rot ist es
   sauber, weil der Ton dort nachgezogen wird.

   **Die Ursache ist bekannt und benannt:** `tonAufHell` aus v1097 rechnet
   gegen **Weiß**, vier Vorlagen haben aber keinen weißen Grund — v1097
   hat das für boarding selbst so vermerkt („kein Rückschritt"). Der
   saubere Weg wäre, die Schwelle gegen den **tatsächlichen** Grund der
   Vorlage zu rechnen statt gegen Weiß. Das betrifft `--gold-d` an 19
   Stellen und ist deshalb ein eigenes Vorhaben mit eigener Prüfstrecke,
   kein Nachschlag.

   **Vorbefund 2026-08-10 — die Annahme des Punktes stimmt so nicht.**
   Angefangen zu messen, dann bewusst abgebrochen und übergeben, weil der
   erste Wert der Beschreibung widerspricht. Gemessen ohne Vorlage,
   Partner-Konto, über den Kaskaden-Walker:

   - Gewinner für `#hdr-obj-num` ist
     `header.hdr.has-v64-score #hdr-obj-num{color:var(--gold-2,#E8C964)!important}`
     — also **`--gold-2`, nicht `--gold-d`.** Die 19 `--gold-d`-Stellen
     mögen ihr eigenes Problem haben, aber **dieses** Element hängt nicht
     daran. Vor dem Bauen also erst prüfen, welcher Ton in **kanzlei** und
     **boarding** tatsächlich gewinnt.
   - **`--gold-d` wird im Gold-Zweig gar nicht gesetzt** (`config.js`
     ~Z. 1072–1074): dort stehen `--gold`, `-hi`, `-lo`, `-l`, `-2`, `-3`
     und `-bg`, aber kein `-d`. Nur der Whitelabel-Zweig (Z. 1085) setzt
     es über `tonAufHell()`. Das erklärt, warum der Befund gerade mit
     **Standard-Gold** auftrat und mit Partner-Rot sauber war — nicht
     „weil der Ton dort nachgezogen wird", sondern weil er dort überhaupt
     erst gesetzt wird.
   - **`tonFuerGrund(farbe, grund, min)` gibt es seit v1113 bereits** und
     rechnet gegen einen beliebigen Grund. Der Baustein für die Lösung ist
     also da; es fehlt die Zuordnung „welche Vorlage hat welchen Grund".

   **Eigener Messfehler, gleich mit vermerkt:** Mein Grund-Leser lief die
   Vorfahren hoch und nahm die erste `background-color` ≠ transparent. Die
   Kopfleiste trägt aber einen **Verlauf** (`background-image`), keine
   Farbe — der Leser übersprang sie und meldete Weiß. **Ein Grund-Leser,
   der `background-image` nicht auswertet, taugt für diesen Punkt nicht.**

   ---

   ### Messlauf 2026-08-10, alle sechs Fassungen — **BLOCKIERT auf ein Konto ohne Whitelabel**

   Über den echten Bedienweg gesetzt (Panel-Klicks, danach
   `getAnimations().forEach(a=>a.finish())`), Objekt geladen, Partner-Konto:

   | Fassung | Text | effektiver Grund | k |
   |---|---|---|---|
   | ohne Vorlage | `rgb(205,175,90)` | `rgb(56,50,31)` / `rgb(29,27,23)` | **6,01** |
   | kontor | `rgb(152,123,34)` | `rgb(53,46,27)` / `rgb(25,24,18)` | **3,33** |
   | panel | dito | dito | **3,33** |
   | kanzlei | dito | dito | **3,33** |
   | boarding | dito | dito | **3,33** |
   | konsole | `rgb(205,175,90)` | dito | **6,34** |

   **Auf diesem Konto ist der Punkt nicht reproduzierbar** — alle sechs
   liegen über der Schwelle 3, die die v1113-Läufe benutzt haben.

   **Der Grund ist bekannt und benannt:** seit `v1114` folgt die Kopfleiste
   dem Obsidian des Partners. **Mit aktivem Whitelabel bleibt sie unter
   *jeder* Vorlage dunkel** — der cremefarbene Grund, um den es im Punkt
   geht, entsteht gar nicht erst. Der Befund braucht ein Konto **ohne**
   Whitelabel. Genau diese Grenze hat der `v1114`-Eintrag selbst schon
   vermerkt.

   ### Zwei eigene Messfehler, beide zurückgenommen

   Beide betrafen den Grund-Leser, nicht die App. Sie stehen hier, weil sie
   den nächsten Lauf sonst genauso kosten:

   1. **Ich habe den Elternteil gemessen, nicht das Element.**
      `.hdr-obj-num` trägt einen **eigenen** `background-image`-Verlauf.
      Ein Leser, der bei `el.parentElement` anfängt, sieht ihn nie und
      meldet den Grund der Kopfleiste.
   2. **Ich habe das Alpha verschluckt.** Der Verlauf lautet
      `color(srgb 0.788 0.658 0.298 / 0.2)` — ein **20-prozentiger
      Goldschleier**, keine goldene Fläche. Mein Parser las `color(srgb …)`,
      filterte Alpha aber nur bei `rgba()`. Ergebnis: gemeldete **k=1,07**,
      also „Gold auf Gold, unsichtbar" — physikalisch unmöglich, wie ein
      Blick auf den Bildschirm sofort zeigt.

   **Erst mit Überlagerung** (`a·vorn + (1−a)·hinten`, Schicht für Schicht
   bis zum ersten deckenden Untergrund) kamen plausible Werte heraus.
   **Ein Kontrastlauf, der Alpha ignoriert, taugt für dieses Element
   nicht** — und die Zahlen 2,98 / 2,88 aus dem v1113-Lauf sind mit
   demselben Vorbehalt zu lesen: ob sie den Schleier mitgerechnet haben,
   ist offen.

   ### Nächster Schritt

   Ein **Konto ohne Whitelabel** anmelden, dieselben sechs Fassungen mit
   dem Überlagerungs-Leser messen. Erst wenn dort ein Wert unter 3 steht,
   ist ein Eingriff gerechtfertigt — und dann über `tonFuerGrund()` gegen
   den *überlagerten* Grund, nicht gegen Weiß.

3. **Tablet-Fassung feinziehen** — Drawer, zweispaltige Formulare, Aktionen
   als Popover statt Blatt von unten. Dazu die Admin-Oberfläche auf Tablet
   prüfen. **Nicht angefangen:** Gestaltungsarbeit mit eigener Prüfstrecke,
   kein Defekt — Entwurf gehört nach `design/Vorschläge/`, sonst wäre es
   geraten. **Ein gemessener Befund gehört hierher:** auf 820 px ist die
   Kopfleiste **589 px** hoch, `#hdr-badges` allein 492 px, weil die fünf
   KPI-Pillen dort zu je zwei umbrechen (W43). Bewusst nicht angefasst,
   weil der Score auf dem Tablet bleiben soll.

4. **Zwei Handy-Befunde aus dem v1118-Durchgang, bewusst nicht gefixt.**
   Beide sind gemessen und beschrieben; beide sind **Gestaltung bzw.
   Barrierefreiheit**, kein Defekt — deshalb nicht nebenbei erledigt.

   - **23 Ankreuzfelder messen 13 × 13 px**, verteilt über fünf Reiter
     (Investition, Miete, Finanzierung, Steuer, Pilot-Analyse). Jedes hat
     ein Label, aber die Labels sind **16 bis 36 px** hoch — also selbst
     unter 44. `v1112` hat diese Bauart im Einstellungs-Modal ausdrücklich
     als tragbar abgenommen („Checkboxen mit eigenem Label als
     Trefferfläche"); im Formularbereich trägt das Argument schwächer, weil
     die Zeilen dichter stehen. Sie app-weit zu vergrößern ändert die
     Zeilenhöhe überall — **das ist eine Gestaltungsentscheidung.**
   - **`.sbc-arrow` trägt `role="button"`, ist aber ein `<span>` ohne
     eigenen Klick.** Das Ziel ist die 326 px breite Karte. Für die Maus
     harmlos, für einen Screenreader ein Knopf, der nichts tut. Gehört mit
     einer Prüfstrecke für Barrierefreiheit angefasst, nicht einzeln.

---

## Später

- **Media-Queries konsolidieren** — 226 Blöcke auf 25 Breakpoints. Eigenes
  Vorhaben mit eigener Prüfstrecke, nicht nebenbei. **Wird durch die Handy-Freigabe (v1118)
  größer, nicht kleiner** — mit der Freigabe fürs Handy trägt die normale
  Ansicht allein, was vorher auf zwei Fassungen verteilt war.

- **`gold-audit.py` auf RC=0 bringen** — 484 Fundstellen in 57 Dateien,
  Altlast. Die neuen Dateien tragen davon **keine einzige**. Eigenes
  Vorhaben, weil jede Fundstelle einzeln beurteilt werden muss.

- **`body.dp-chrome-hell` auflösen** — 105 gewachsene Regeln hängen daran.
  Bei „Skin-Schalter und Darstellung" wurde bewusst **gekoppelt statt
  gelöscht**; das Entfernen bleibt ein eigenes Vorhaben mit eigener
  Prüfstrecke.

- **Zwei Nachweise, die aus Abnahmen offen geblieben sind** — jeweils
  gemessen und beschrieben, nur nie am echten Gerät bzw. mit echten Daten
  bestätigt:
  - **Marktbericht auf dem Handy (v1077):** ein echter Klick auf den
    PDF-Knopf (Datei lädt herunter), die **Zwei-Finger-Geste** auf der
    Karte (hängt an `matchMedia('(hover:none)')`, greift im Prüfbrowser
    nicht) und das **Erzeugen** eines neuen Berichts bei 390 px (kostet
    5 L und hängt an einem `window.confirm`). Eigener Namensraum v1077,
    nicht mit der Haupt-App mischen. **Wird mit der Handy-Freigabe (v1118) dringender:** nach
    der Freigabe kommen echte Nutzer auf diesem Weg an.
  - **Tabelle der geteilten Pässe** — die Scroll-Regel steht, das
    Testkonto war leer, der Nachweis fehlt.

---

## Fertig

<!-- Format:  - [YYYY-MM-DD] Punkt — Commit-Hash -->

- [2026-08-10] **Textfarben für Score-Karte und KPI-Karten** — Demo
  `design/Vorschläge/textfarben-score-kpi.html`.
  **BLOCKIERT auf Marcels Auswahl** — der Punkt verlangt genau das
  („Demo nach `design/Vorschläge/`, nicht raten").

  **Der Abgleich bestätigt sich, nachgezählt statt übernommen** (Panel
  geöffnet, Partner-Konto): **acht Farbfelder, fünf Flächen und drei
  Texte.** Für **Objektkarten** gibt es beides — Fläche *und* Text
  (`_dpDispObjText`). Für Score-Karte und KPI-Karten nur die Fläche. Es ist
  also eine **Lücke im Muster**, keine in der Logik: die Vorlage für so
  einen Regler steht längst daneben.

  ### Warum es nicht einfach ein neunter Regler ist

  Seit `v1113` leitet `tonAufMarke()` fünf Tokens gegen **alle drei
  Verlaufsstopps** der Markenfläche ab. Das war nötig, weil die Score-Karte
  unter jeder hellen Vorlage zur Markenfläche wird — bei Gold hell, bei
  Partner-Rot dunkel. Ein Regler, der das einfach überschreibt, macht
  denselben Fehler wieder, nur auf Wunsch des Nutzers.

  ### Drei Antworten, alle anklickbar

  | | A · Frei | B · Geführt | C · Frei mit Warnung |
  |---|---|---|---|
  | Regler tut, was er sagt | **ja** | nein | **ja** |
  | Unlesbares möglich | ja | **nein** | ja, aber sichtbar |
  | Neuer Rechenweg nötig | nein | nein — `tonFuerGrund()` | nein |
  | Schützt die Mandanten des Partners | nein | **ja** | nein |
  | Aufwand | **klein** | klein | mittel |

  **Im Browser durchgeklickt, gemessen:** Kontrastformel gegen bekannte
  Werte geprüft (Schwarz auf Weiß **21,00**, gleiche Farbe **1,00**).
  Wunschton `#B39445` auf Gold: **A lässt ihn bei k=1,27 stehen** — das ist
  genau der v1113-Zustand, Gold auf Gold. **B zieht ihn auf `#543700`,
  k=4,78**, Farbton bleibt. **C:** vorher 1,27, nach einem Klick 4,78.
  Kein Querlauf, keine Konsolenfehler.

  **Meine Empfehlung: B für den Partner, C für den einzelnen Nutzer.** Die
  Zeile „schützt die Mandanten" ist der Unterschied, der zählt — wer nur
  für sich einstellt, darf sich vertun; wer für alle seine Mandanten
  einstellt, entscheidet für Leute, die es nicht korrigieren können.
  Technisch **ein** Regler mit einem Schalter, nicht zwei Bauwerke: in der
  Mandanten-Ansicht läuft er zusätzlich durch `tonFuerGrund()`. Das passt
  genau zu `v1122`.

  **Vier Fragen stehen im Dokument offen**, u. a. ob es ein Regler oder
  zwei werden und ob die Nebentöne (`--uv-sc-mut`, `-ok`) mitgezogen
  werden. **Vorschlag dort: sie bleiben abgeleitet** — Statusfarben werden
  nie tokenisiert.

- [2026-08-10] **Partner-Flow B: drei Freiheitsstufen je Partner** —
  `v1122` (`ad95ec9`). Aus
  `design/Vorschläge/partner-flow-darstellung.md`; C und A standen seit
  `v1111`, B blieb offen.

  ### Eine Annahme des Vorschlags ist widerlegt

  Er veranschlagte für B „**ein Feld mehr im Branding-Datensatz, also
  Backend-Migration**". Gemessen: `resellers.brand_display` ist **`jsonb`**,
  und `062_reseller_display.sql` sagt das ausdrücklich dazu — „jsonb, weil
  das Panel wächst: neue Regler brauchen dann keine Migration."

  **`wl_freiheit` reist im vorhandenen JSON mit. Keine Migration, kein
  Backend-Eingriff, keine Berührung der Produktion.** Der Aufwand fällt
  damit von „mittel" auf „klein".

  ### Drei Stufen, ein Schlüssel

  | Stufe | Marke | Komfort |
  |---|---|---|
  | `keine` | bei **jedem** Laden | bei **jedem** Laden |
  | `komfort` | bei jedem Laden | einmal als Voreinstellung |
  | `alles` | einmal als Voreinstellung | einmal als Voreinstellung |

  **`komfort` ist die Voreinstellung** und ist bitgenau Weg A, also das
  Verhalten seit v1111. Fehlt der Schlüssel — jeder Partner, der vor v1122
  gespeichert hat —, gilt er. Für bestehende Konten ändert sich nichts, bis
  der Partner die Stufe bewusst setzt.

  **Vier Stellen, keine davon ein Umbau:** der Regler in der
  Mandanten-Ansicht (`darstellung-reseller.js`), der Panel-Host
  (`ui-varianten.js`), die Wirkung beim Mandanten
  (`mandant-branding.js`) und die Sperre (`gateSetzen`).

  **Zwei bewusste Entscheidungen:**
  - `wl_freiheit` steht **nicht** in der `MAP`. Die bildet Darstellungs­werte
    auf `_dpDisp*`-Handler ab; eine **Freigaberegel ist kein
    Darstellungswert** und bräuchte dort einen Handler, den es nicht gibt.
  - `alles` benutzt **denselben** Merker `dp_wl_display_seen` wie der
    Komfort-Teil. „Einmal als Voreinstellung" ist dieselbe Frage, nur auf
    die Marke angewandt — ein zweiter Merker wäre eine zweite Wahrheit über
    denselben Sachverhalt.

  **Der Fall, der die Gate-Änderung nötig macht:** bei `alles` hätte die
  Sperre dem Mandanten verboten, was der Partner ihm gerade erlaubt.

  ### Nachgemessen auf Staging, Partner-Konto, über den echten Bedienweg

  | Prüfung | Ergebnis |
  |---|---|
  | Regler erscheint nur in der Mandanten-Ansicht | ✓ (in „Mich" leer) |
  | Voreinstellung ohne gespeicherten Wert | **`komfort`** |
  | Speichern → Backend | `wl_freiheit:"alles"` **neben den 16 anderen Schlüsseln** |
  | Rundlauf: neu geladen | „Alles" stand wieder im Regler |
  | Sperre bei `keine` / `komfort` / `alles` | **zu / zu / offen**, je eigener Text |
  | **Partner selbst** | **nicht gesperrt** — unverändert |
  | **Normaler Nutzer** (kein Partner, kein `dp_wl_cache`) | gesperrt, alter Text — **unverändert** |

  Das Testkonto steht danach wieder auf `komfort`.

  **Ehrlich offen, Staging-Abnahmepunkt:** die Wirkung der drei Stufen
  **beim echten Mandanten**. Die Panel-Sperre ist gestubbt geprüft (wie bei
  der v1111-Abnahme), das Anwenden in `applyResellerDisplay()` hängt am
  Branding-Satz eines `reseller_client` — dafür braucht es ein zweites
  Konto. **Nicht behoben, weil kein Defekt:** „zu wenig Farben zur Auswahl".
  Der Punkt hat es selbst richtig eingeordnet — es sind zwei Oberflächen
  für dieselbe Sache. Mit v1122 ist das **Panel** die Stelle, an der der
  Partner Darstellung *und* Freiheitsgrad setzt; der Branding-Editor im
  Portal mit seinen drei Farben bleibt daneben stehen. Ihn abzulösen ist
  ein eigener Punkt, kein Nachschlag.

- [2026-08-10] **Boarding-Pass: prüfen, ob beim Erzeugen alles mitgeht** —
  `v1120` (`6ff6ce8`)

  **Marcels Eindruck stimmt, und die Ursache ist eine andere als vermutet.**
  Die Kette von hinten aufgerollt, wie der Punkt es verlangt:

  | Glied | gemessen |
  |---|---|
  | `objects.data` | **181 Schlüssel**, davon **102 befüllt** |
  | Snapshot im Backend (`sharedPassService.createForObject`) | trägt `obj.data` **vollständig** — hier geht nichts verloren |
  | `pass.html` | liest **38 Namen**, davon **18 im Objekt gar nicht vorhanden** |
  | Folge | **87 befüllte Felder erreichen den Pass nicht** |

  **Die Verengung sitzt allein in `pass.html`, und es ist ein
  Namensfehler.** Neun beweisbare Verfehlungen, jede mit einem echten Wert
  im Testobjekt:

  | Pass las | Objekt führt | Wert |
  |---|---|---|
  | `objektart` | **`objart`** | ETW |
  | `ausstattung` | **`ausst`** | Normal |
  | `vermietungsstand` | **`vermstand`** | Vollvermietet |
  | `grundstueck` / `gst_flae` | **`gsfl`** | 1570 |
  | `hg` | **`hg_ul` / `hg_nul`** | 1391 / 1599,46 |
  | `energieklasse` | **`ds2_energie`** | B |
  | `modernisierung` / `mod_jahr` | **`modernis`** | (leer) |
  | `zins` | **`d1z`** | 3,5 |
  | `tilg` | **`d1t`** | 1 |

  Dazu drei befüllte Felder, die **niemand** las: `halter` (privat),
  `mea` (7,06 %), `d1` (200.000 € Darlehen).

  **Die alten Namen bleiben als Rückfall stehen** — ein Snapshot ist
  eingefroren, ältere Pässe können sie tragen. Gegenprobe gefahren: ein
  Snapshot mit ausschließlich den alten Namen zeigt weiterhin alle zehn
  Zeilen.

  **`knk` ist bewusst nicht gemappt.** Die App führt keine
  Kaufnebenkosten als Einzelwert, sondern `makler_p`, `notar_p` und die
  Grunderwerbsteuer getrennt. Eine Summe zu bilden wäre **geraten, nicht
  gemessen** — und der Punkt verbietet ausdrücklich, ein Feld still zu
  füllen. Die Zeile bleibt leer und fällt aus der Liste.

  **Nachgemessen** durch direkten Aufruf von `render()` mit den echten
  Objektdaten (kein Pass erzeugt, keine Nebenwirkung): **0 → 11 befüllte
  Zeilen**, „Objektart = ETW" steht jetzt auch im Ticket. `pass.html`
  parst sauber, alle Funktionen definiert.

  **Kleinigkeit, nicht angefasst:** „Grundstücksfläche" landet in der
  Rubrik „Weitere", weil sie in keiner Rubrikliste steht. Das war vorher
  genauso und ist kein Rückschritt.

- [2026-08-10] **Marktbericht: zehn Gestaltungsideen** — Vorschlag
  `design/Vorschläge/marktbericht-gestaltung-10-ideen.html` (`d69ba74`),
  dazu `v1119` (`d9e83a2`).
  **BLOCKIERT auf Marcels Auswahl** — der Punkt sagt es selbst: „Auswahl
  trifft Marcel, nicht ich."

  ### Erst gemessen, wie der Punkt es verlangte

  | | gemessen |
  |---|---|
  | Felder im Katalog | **42** — `stufe1` 1 · `stufe2` 1 · `stufe3` 34 · `experte` 6 |
  | sichtbare Eingaben (Stufe 3) | **46** |
  | davon **bedingt** | **27 von 42** |
  | Seitenhöhe Stufe 3 | **4.608 px** in einer **338 px** breiten Spalte |
  | Fläche rechts daneben | **rund 730 px leer**, bis ein Bericht da ist |

  **`istWohnung()` spaltet den Katalog:** 17 Felder nur für Häuser
  (`nhkHaus`/`nhkGeschosse`/`nhkDach` + neun `ausst*` + fünf `btl*`), plus
  `sachwertfaktor`; 2 nur für Wohnungen (`mea`, `grundriss`).

  ### Das Messen hat zwei echte Defekte gefunden — `v1119`

  **Die Annahme des Punktes ist widerlegt.** Er sagte, `garagenStufe` und
  `hinterlandRent` „erscheinen nur nach echter Nutzereingabe". Gemessen:
  **sie erschienen überhaupt nicht.** Zwei getrennte Ursachen:

  - **Die Bedingung wurde gegen ein gelöschtes Feld geprüft** (v1119-WBED).
    `zeichnen()` entfernt `wm-b1/b2/b3`, **bevor** `block()` die
    `wenn:`-Funktionen auswertet. `wert(id)` liest per `getElementById` —
    das Element ist weg, also kommt immer `""` zurück. Betroffen:
    `hinterlandRent`, `garagenStufe`, `sanierungsjahr`, `brwStichtag`,
    `brwAnpGrund`. **`garagenStufe` und `hinterlandWert` sind
    `pflichtWenn`** — Pflichtfelder, die nie auftauchen konnten.
  - **Der Auslöser fehlte** (v1119-WAUS). `ptype` stand nicht in der Liste
    der Felder, deren `change` neu zeichnet. Objektart von ETW auf EFH →
    **19 Felder, unverändert**; erst ein erzwungenes `neuZeichnen()`
    brachte die 17 Hausfelder und nahm `mea` weg. Wer ein Haus bewertete,
    sah **drei Pflichtfelder nie** — ohne sie rechnet der Sachwert nicht.

  Behoben über `_letzte` (die Werte der gerade entfernten Blöcke), das
  **nur während des Neuzeichnens** gelesen wird (`_imNeuzeichnen`,
  `try/finally`). **Ohne diese Sperre liefe `payload()` über denselben Weg**
  und würde abgewählte Felder still mitschicken — genau das, was der
  Backlog verbietet.

  **Nachgemessen:** Typwechsel ETW→EFH bringt alle 17 Hausfelder und nimmt
  `mea`; `hinterlandFlaeche=250` bringt `hinterlandRent`; `garagenBgf=64.58`
  bringt `garagenStufe` **mit Pflichtmarke**; die Auslöserwerte bleiben
  erhalten. **Gegenprobe: `mea_pct` ist beim Haus `null`** — kein
  abgewählter Wert gerät in `payload()`.

  *(Ein eigener Messfehler, zurückgenommen: mein erster Garagentest setzte
  `64,58` mit Komma in ein `type="number"`-Feld. Der Browser verwirft das
  und liefert `""` — es sah nach einem Fehler im Code aus, war aber mein
  Testwert.)*

  ### Die zehn Ideen

  Wizard mit Reitern · zwei Spalten mit lebender Vorschau · verfahrens­
  getrieben · Akkordeon mit Ampel · ein Feld pro Bild · sichtbarer Zweig ·
  Datenblatt · Checkliste mit Sprungmarken · Kartenstapel · Co-Pilot fragt.
  Alle zehn anklickbar, im Browser durchgeklickt: **keine Konsolenfehler,
  kein Querlauf**, jede Demo reagiert.

  **Meine Empfehlung, kurz:** es sind nicht zehn Alternativen, sondern zwei
  Entscheidungen. **Ablauf** = 1 oder 9, beide mit dem Zweig aus 6 als
  Schritt 1. **Fläche** = 2 — die 730 leeren Pixel sind das Auffälligste am
  Bericht, und keine Umsortierung der Felder ändert daran etwas. 7 gehört
  als Umschalter daneben, 4 ist der ehrliche Zwischenschritt.

  **Vier Fragen stehen im Dokument offen**, zwei davon blockieren: bleiben
  die drei Stufen neben einem Wizard, und woher kommt die Zahl in der
  Vorschau (eine erfundene Zwischenrechnung wäre schlimmer als eine leere
  Fläche).

- [2026-08-10] **MA-Serie ausgebaut, normale Ansicht fürs Handy frei** —
  `v1118` (`6a7d044`), `v1118b` (`3ab3279`), `v1118c` (`9db60e6`).
  Vorschlag: `design/Vorschläge/ma-ausbau-handy-freigabe.md`.

  ### Der Punkt nannte zwei Sperren und eine Datei — es waren neun Fundstellen in sieben Dateien

  Zwei davon kannte der Punkt nicht, und **beide reißen ein Loch, wenn man
  sie übersieht:**

  - **`dp-mobile-sw.js` ist ein Service Worker.** Er liegt auf dem **Gerät**,
    nicht auf dem Server, hatte den Geltungsbereich `/mobile-demo.html` und
    beantwortete jede Navigation aus seinem Cache, wenn das Netz die Hülle
    nicht hergab. Ersatzloses Löschen hätte installierte Handy-Apps
    **dauerhaft** auf einer Fassung stehen lassen, die es nicht mehr gibt —
    kein Rollout hätte diese Geräte je wieder erreicht. **Das ist der
    einzige Schritt, der sich nicht nachholen lässt**, deshalb steht er an
    Position 1 und nicht am Ende.
  - **Die Landingpage wirbt aktiv für die MA.** „App installieren"
    (Z. 1272) und der QR-Code (Z. 1290–1292) zeigten auf
    `mobile-demo.html` — der sichtbarste Weg, auf dem überhaupt jemand dort
    ankam.

  ### Entwarnung bei `dp_wl_cache` — die Warnung des Punktes war richtig und ist entschärft

  Drei Leser gemessen: `mandant-branding.js` (Eigentümer, schreibt und
  räumt), **`ui-varianten.js` (Whitelabel-Sperre der Mandanten, v1111)** und
  `mobile-redirect.js` (Plan-Freigabe der Handy-Sperre, v1085). Es fällt
  **eine von drei** Lesestellen. Die Mandanten-Sperre hängt an
  `ui-varianten.js` und bleibt unberührt.

  ### Umgesetzt, in dieser Reihenfolge

  | # | was | warum so herum |
  |---|---|---|
  | 1 | `dp-mobile-sw.js` meldet sich selbst ab, räumt seine Caches, schickt offene Fenster auf `/`. **Kein `fetch`-Handler mehr.** | siehe oben |
  | 2 | `mobile-demo.html` ist keine App mehr, sondern eine **Umleitung mit Aufräumauftrag**. Notbremse: nach 2,5 s geht es in jedem Fall weiter. | damit installierte Apps nicht vor einem 404 stehen |
  | 3 | `dp-mobile.webmanifest`: `start_url`/`scope` auf `/`, `orientation` auf `any`. `index.html` trägt das Manifest jetzt selbst. | **installierte Handy-Apps werden zur echten App, statt zu brechen** |
  | 4 | `js/mobile-redirect.js` (v970) gelöscht, Eintrag aus `index.html` | mit ihm fallen `?nomobileblock`, `dp_mb_bypass`, die Schwellen 700/1400 |
  | 5 | `js/mobile-branding.js` gelöscht | nur die MA-Fassung las es |
  | 6 | Landing-CTA und QR auf die normale App | der QR wird aus derselben Variable gebaut und zieht mit |
  | 7 | Vorlage gesichert: `design/mockups/dp-handy-mockup-ma.html` (2.829 Z., ohne MA35, ohne PWA-Block) | Marcels Bildvorlage bleibt |
  | 8 | `CLAUDE.md`: der „Nicht anfassen"-Eintrag zur Handy-Sperre ist **ersetzt** — er sagte das Gegenteil | jetzt geschützt sind stattdessen SW und Umleitung |

  **`mobile-demo.html` und `dp-mobile-sw.js` fallen zusammen oder gar
  nicht**, und erst, wenn jedes Gerät sie einmal gesehen hat. Das steht so
  in CLAUDE.md.

  ### Der Durchgang bei 390 px — gemessen im gleich-Origin-iframe

  Alle **neun Reiter**, der **Drawer** (351 px, über den echten Bedienweg
  geöffnet) und das **Einstellungs-Modal** (390 × 844, Leiste 387 × 64,
  zwölf Reiter, Schließen-Knopf 32 × 32 — v1117 kommt auch im iframe an).

  **Sauber überall:** `scrollWidth 390 = clientWidth 390` in **jedem**
  Bereich, kein Textfeld unter 16 px.

  Unter der 44-px-Trefferfläche aus v650/v652 standen **fünf echte
  Bedienelemente, 20 Stück**:

  | Element | war | Anzahl | Reiter |
  |---|---|---|---|
  | `.dab-chip` | 117 × **22** | 10 | Deal-Aktion |
  | `.dab-bp-web` | 157 × **14** | 5 | Deal-Aktion |
  | `.dpfk-ltv-btn` | 74 × **35** | 3 | Finanzierung |
  | `.v10-zc-btn` | 178 × **35** | 1 | Finanzierung |
  | `a.v842-tax-link` | 191 × **35** | 1 | Steuer |

  **Kein `::after` wie in v1116:** die Chips stehen mit 7 px Abstand und
  **29 px Zeilenabstand** — eine 44-px-Pseudofläche hätte der Nachbarzeile
  den Klick geklaut. Alle fünf sind `display:flex` mit
  `align-items:center`, `min-height` zentriert also von selbst.

  ### Zwei Nachzügler, beide mit eigener Ursache

  `v1118b` erreichte nur drei von fünf. Ausgelesen statt vermutet:

  - **`.dab-chip` blieb bei 22 px — nicht die Kaskade.**
    `deal-action-boarding.js` setzt seit **v857** `min-height:0` **inline**
    mit `!important` („schlägt JEDE CSS-Regel"). Derselbe Fallentyp wie
    `dp-band-fix.js` bei v1117. Die Zeile stand da, um die Handy-Regel
    `button{min-height:44px}` zu schlagen — richtig, **solange das Handy
    gesperrt war**. Gemessen setzt **oberhalb von 768 px keine einzige
    Regel** `min-height`: die Zeile wirkte ausschließlich auf dem Handy,
    und dort genau falsch herum. Ersatzlos raus.
  - **`.v10-zc-btn` blieb bei 35 px — hier war es die Kaskade.** Der Knopf
    trägt zusätzlich `.dpfk-mkt`, und `.dpfk-head .dpfk-mkt{min-height:0
    !important}` (0,2,0) schlägt die Sammelregel (0,1,0). Nachgezogen mit
    (0,3,0), **nicht** über die Ladereihenfolge.

  ### Nachgemessen

  | | 390 px | 1400 px (Gegenprobe) |
  |---|---|---|
  | `.dab-chip` ×10 | **44** | 22 |
  | `.dab-bp-web` ×5 | **44** | 14 |
  | `.dpfk-ltv-btn` ×3 | **44** | 35 |
  | `.v10-zc-btn` | **44** | 35 |
  | `a.v842-tax-link` | **44** | 16 |
  | Querlauf | 390/390 | — |

  **Der Desktop ist bitgleich geblieben** — die Änderung wirkt nur unter
  768 px. Die Sperre ist weg: `window._dpMobileBlock` ist `undefined`, kein
  Overlay, das Skript wird nicht mehr geladen.

  **Ehrlich offen, nicht geprüft:** **Registrierung und Login bei 390 px.**
  Der Prüflauf war angemeldet, und Abmelden hätte die Sitzung beendet.
  Genau dort saß der alte v939-Fehler („die volle Desktop-App stand auf dem
  Handy offen — auch direkt nach Registrierung/Login"). **Das ist ein
  Staging-Abnahmepunkt.** Ebenso der **Marktbericht auf dem Handy** — er
  steht unter „Später" und wird mit dieser Freigabe dringend.

  Zwei weitere Befunde stehen als **Punkt 8** offen: 23 Ankreuzfelder mit
  13 × 13 px und das irreführende `role="button"` auf `.sbc-arrow`.

- [2026-08-10] **Browser-Abnahme des Schließen-Knopfs** — `v1117`
  (`a33394d`). Gemessen auf Staging, angemeldet, Partner-Konto, jede Stelle
  über den echten Bedienweg geöffnet und über den Knopf selbst geschlossen.

  ### Sechs Stellen trugen Fassung B, die siebte nicht

  Bankexport, Track Record, Boarding-Skin, Beleg-Import, Score-Hero (beide
  Modale) und QuickBoarding-Teilen standen bitgleich: **32×32, Radius 9,
  `#17130d`, SVG 15 px, Trefferfläche 44×44** — und jeder schließt auf
  Klick. Der auf Gold (`.qbs-h .x`) trägt wie gebaut die dunkle Kante.

  **`.dp-band-close` (Einstellungen und Hilfe) stand unverändert da:**
  28×28, Fläche `rgba(42,39,39,.06)`, SVG 13 px, **keine** Trefferfläche.
  v1116 hatte an dieser Stelle **nichts** bewirkt. Das ist mein Fehler aus
  v1116 — dort steht „auf 32/9/15 nachgezogen", nachgemessen war es nie.

  ### Zwei Sieger, nicht einer

  | Sieger | Spezifität | setzte |
  |---|---|---|
  | `html .settings-modal.set-modal-v2 .set-modal-close` (v793i) | (0,3,1) `!important` | Fläche, Kante, SVG 18, `overflow:hidden` |
  | `dp-band-fix.js` (v863), **inline** `!important` | schlägt jedes Stylesheet | 28×28, SVG 13 |

  Die v1116-Regel `.dp-mtb-brand .dp-band-close` steht bei (0,2,0) und kam
  gegen beide nicht an. Deshalb **zwei Stellen** statt einer: Größe und
  Zeichen in `dp-band-fix.js` (32/15), Aussehen im CSS mit `html body` +
  `.dp-mtb-brand` davor — (0,4,2) bzw. (1,2,2), beides über v793i.
  `overflow:visible` ist Pflicht, sonst schneidet v793i das 44-px-`::after`
  ab. `transform` bleibt `none`, kein `:active`-Scale — das sichert v843.

  ### Nachgemessen, alle neun Stellen

  | Stelle | w×h | Radius | Fläche | SVG | Treffer | schließt |
  |---|---|---|---|---|---|---|
  | Bankexport `.dpm-x` | 32×32 | 9 | `#17130d` | 15 | 44×44 | ✓ |
  | Track Record `.dpm-x` | 32×32 | 9 | `#17130d` | 15 | 44×44 | ✓ |
  | Boarding `.bdg-brand .x` | 32×32 | 9 | `#17130d` | 15 | 44×44 | ✓ |
  | Beleg-Import `.bi-x` | 32×32 | 9 | `#17130d` | 15 | 44×44 | ✓ |
  | Score-Hero KPI `.dpshm-x` | 32×32 | 9 | `#17130d` | 15 | 44×44 | ✓ |
  | Score-Hero Teile `.dpshp-x` | 32×32 | 9 | `#17130d` | 15 | 44×44 | ✓ |
  | Teilen `.qbs-h .x` (auf Gold) | 32×32 | 9 | `#17130d` | 15 | 44×44 | ✓ |
  | **Einstellungen** `.dp-band-close` | **32×32** | 9 | `#17130d` | **15** | **44×44** | ✓ |
  | **Hilfe** `.dp-band-close` | **32×32** | 9 | `#17130d` | **15** | **44×44** | ✓ |

  ### Zwei Messfallen, damit sie niemanden noch einmal kosten

  - **`getComputedStyle` meldet die 1,5-px-Goldkante als `1px`.** Nicht die
    Kante ist falsch — Chrome rundet bei `devicePixelRatio 1` auf ganze
    Gerätepixel. Mit einer Probe-`div` mit `border:1.5px` gegengeprüft:
    dieselbe Meldung. **Die berechnete Kantenbreite taugt hier nicht als
    Prüfwert**, die Quelle trägt 1,5 px.
  - **Der Prüf-Tab ist `hidden`, und dort feuert `requestAnimationFrame`
    nie** (gemessen: kein Rückruf binnen 2 s). `dp-band-fix.js` plant
    seinen Lauf per rAF — der Knopf blieb deshalb im Prüfbrowser auf dem
    CSS-Rückfallwert 36 px stehen. **Kein Produktfehler**, ein Artefakt der
    Messung; nach `window._dpBandFix()` stimmt jeder Wert. Im sichtbaren
    Tab läuft rAF binnen ~16 ms.

  Cache-Buster: `css/style.css` W55 → **W56**, `dp-band-fix.js` 863 →
  **1117**. Die nackte URL liefert weiter ein zwischengespeichertes
  `index.html` — **Strg+Shift+R** ist nötig, sonst kommt W56 nicht an.

- [2026-08-08] **Das „×" soll professioneller aussehen** — `v1115` Demo
  (`a1f3d4e`), `v1116` Umbau (`b261653`).
  **Die Browser-Abnahme steht als eigener Eintrag darüber** (`v1117`) — sie
  hat die siebte Stelle als nicht angekommen entlarvt.

  ### Drei Annahmen des Punktes waren falsch

  - `.dpm-x` wird an **einer** Stelle gebaut — `DP_BAR()`,
    `js/storage.js:2190` — und **zweimal** gerufen: **Bankexport** und
    **Track Record**. **Nicht** im Quick Check. „Eine Datei, zwei Stellen"
    trägt also, nur die zweite Stelle ist eine andere.
  - `.auth-close` und `.gv-close` stehen in der v652-Regel in `style.css`,
    werden im Frontend aber von **niemandem** mehr erzeugt. Tote Selektoren.
  - **„oben links" ließ sich nicht bestätigen.** Kein einziger Knopf ist
    per CSS links positioniert — alle sitzen rechts, über
    `margin-left:auto` oder `right:`. Die Handy-Vorlage
    `dp-handy-mockup-v2.html` hat gar keinen.

  ### Der Befund war größer als der Punkt

  Die App hatte **25 Schließen-Knöpfe** mit 25 Klassennamen in **sechs
  Bauarten**. Der Platzhalter-Eindruck kam von **fünf nackten Text-×**
  ohne Fläche und ohne Rahmen — ein Schriftzeichen sieht nicht nach Knopf
  aus, weil es keiner ist.

  ### Umgesetzt: Fassung B (Marcels Auswahl aus der Demo)

  | Klasse | Datei | war | Grund |
  |---|---|---|---|
  | `.dpshm-x` | `dpsh-score-hero.js` | 24 px `#9a9488` | `#070707` |
  | `.dpshp-x` | `dpsh-score-hero.js` | 22 px `#8a8378` | `#070707` |
  | `.bdg-brand .x` | `modal-boarding-skin.js` | 24 px `#8a8a90` | `#070707` |
  | `.bi-x` | `beleg-import.js` | 22 px `#fff` | `#141414` |
  | `.qbs-h .x` | `quick-boarding-share.js` | 20 px `#5a4a14` | **Gold** |
  | `.dpm-x` | `storage.js` | 30-px-Ring | `#070707` |

  Alle sechs jetzt 32×32, Radius 9, `#17130d`, 1,5 px Goldkante über die
  `--wl-`Ebene, SVG-× 15 px statt Schriftzeichen, **44-px-Trefferfläche
  per `::after`** (bisher nur unter 768 px aus v652) und `:active`-Scale.

  `.qbs-h .x` ist die **einzige** Stelle auf Gold-Verlauf — eine Goldkante
  wäre dort unsichtbar, deshalb dieselbe Kachel mit **dunkler** Kante.
  Form, Größe und Trefferfläche bleiben identisch.

  Dazu `.dp-band-close` (Einstellungen, Hilfe): war bereits Bauart B, nur
  28 px. Auf 32/9/15 nachgezogen, Goldkante von nacktem `rgba()` auf die
  `--wl-`Ebene. `transform:none` bleibt (sichert v843) — diese eine Stelle
  trägt deshalb bewusst kein `:active`-Scale.

  **Bewusst ausgelassen:** `.dp-legal-close` (Rechtstexte, heller Kreis auf
  hellem Grund — kein Platzhalter, eigener Kontext) und `.bmfmo-close-top`
  (das BMF-Modal steht unter „Nicht anfassen"). Beide bleiben damit
  abweichend; wenn sie mit sollen, ist das ein Nachschlag.

  `node --check` auf allen fünf JS-Dateien: **OK** (auf dem Staging-Host,
  lokal ist kein Node installiert).

- [2026-08-08] **Die Branding-Einstellungen des Partners greifen nicht**
  — `v1114` (`6f42ed1`)

  **Marcels Rückfrage ist beantwortet:** „das Logo darf nicht verändert
  werden" bezog sich auf das **DealPilot-Logo** — das bleibt. Beim
  Partner-Branding *soll* getauscht werden. Also ein **Defekt**, wie
  aufgenommen.

  Gemessen im Partner-Konto mit vollständig eingerichtetem Whitelabel
  (Akzent `#b33d29`, Obsidian `#141210`, Logo und Name in der DB).
  **Drei Befunde, drei verschiedene Ursachen** — der Punkt hatte richtig
  vermutet, dass sie nicht zusammengehören.

  ### 1 · Der Akzent hielt 746 Millisekunden

  Nicht gepollt, sondern `setProperty` mitgeschnitten:

  ```
  1089 ms  --gold=#b33d29      whitelabel-override.js:497  <- _ownerBoot
  1096 ms  --obsidian=#141210  whitelabel-override.js:517  <- _ownerBoot
  1835 ms  --gold=#C9A84C      config.js                   <- setTimeout(boot,1600)
  ```

  `applyTheme()` weiß nichts vom Whitelabel: `getTheme()` liest
  `dp_theme_accent`, das Whitelabel liegt in der DB des Partners. Es setzte
  deshalb Standard-Gold zurück.

  **Sichtbare Folge und genau „einzeln geänderte Farben wirken nicht":**
  ein **gemischter** Zustand. Die **443** vom Sweeper direkt angefassten
  Elemente behalten die Partnerfarbe (er schreibt Literale), alles
  Tokenbasierte fällt auf DealPilot-Gold zurück. `applyTheme()` übernimmt
  jetzt den Sweeper-Akzent, wenn er aktiv ist — `isActive()` und
  `accent()` gab es bereits.

  ### 2 · „Erst nach dem Neuladen" — es fehlte der halbe Datensatz

  Die Vermutung des Punktes (Speichern ruft `apply()` nicht nach) ist
  **widerlegt**: `apply()` wird gerufen, nur mit zwei von fünf Werten.

  | Aufruf | accent | hi/lo | obsidian | name | logo |
  |---|---|---|---|---|---|
  | `mandant-branding.js:57` · `:240` · `_ownerBoot` | ✓ | ✓ | ✓ | ✓ | ✓ |
  | **`_applyPreview()`** | ✓ | — | ✓ | **—** | **—** |

  Gemessen: nach dem Speichern **0** ersetzte Wortmarken und das alte
  Logo; nach dem Neuladen beides da — weil dann `_ownerBoot` mit dem
  vollständigen Satz läuft. Derselbe Fehlertyp wie v1096b: zwei Wege,
  einer unvollständig. Die zweite Spur des Punktes (die fünf
  `var()`-Fallen) war **nicht** die Ursache.

  ### 3 · `var(--obsidian)` liest niemand

  **0 Treffer** in `style.css`, **0** in `ui-varianten.css`. Den Namen
  benutzen nur eigenständige Seiten mit eigenem `:root` —
  `mobile-demo.html`, `pass.html`, `landing/api-docs.html`. Der Sweeper
  setzt das Token seit jeher, gelesen hat es nie jemand. Der Regler heißt
  im Editor wörtlich **„Header & Sidebar-Fläche"** und bewegte weder
  Header noch Sidebar.

  Die Flächen lesen bereits Tokens (`aside.sidebar` → `var(--dp-s0)`,
  `.main-col > header.hdr` → `var(--dp-s1)`); nur `nav.tabs` trägt ein
  hartes `rgb(10,8,5)` bei (0,3,2). Deshalb **chirurgisch die drei
  Flächen**, statt `--dp-s0`/`--dp-s1` global umzubiegen — die hängen an
  über zwanzig weiteren Stellen.

  ### Nachgemessen

  | | vorher | nachher |
  |---|---|---|
  | Akzent nach 6 s | `#C9A84C` | **`#b33d29`** |
  | Sidebar | `rgb(0,0,0)` | **`rgb(20,18,16)`** = `#141210` |
  | Tab-Leiste | `rgb(10,8,5)` | **`rgb(29,27,26)`** |
  | Kopf-Verlauf | `rgb(10,8,5)→#000` | **`rgb(29,27,26)→rgb(8,7,6)`** |
  | Logo / Wortmarken | nein / 0 | **ja / 2** |

  **Ohne Whitelabel bitgenau unverändert** (die wichtigere Probe):
  Sidebar `rgb(0,0,0)`, Tabs `rgb(10,8,5)`, Kopf
  `linear-gradient(rgb(10,8,5) 0%, rgb(0,0,0) 100%)`, Akzent `#C9A84C`.
  Die Fallbacks im CSS sind genau diese abgelesenen Werte.

  **Ohne Neuladen, ein Klick auf den Vorschau-Haken:** Gold, Logo,
  **2** Wortmarken und der Hintergrund kommen gleichzeitig. Vorher kam nur
  Gold, und das auch nur für 746 ms.

  **Grenze, ehrlich benannt:** Der Hintergrund wirkt nur **ohne Vorlage**.
  Unter einer Vorlage bestimmt `--uv-chrome` die Fläche („die Vorlage
  bestimmt die Fläche", v1096) — nachgemessen unter `kontor`: alle drei
  Flächen weiß, Partner-Akzent bleibt. Ein dunkler Partner-Hintergrund
  unter einer hellen Vorlage wäre ein Bruch, kein Branding.

  **Nicht behoben, weil kein Defekt:** „zu wenig Farben zur Auswahl". Die
  Gegenüberstellung steht jetzt bei Partner-Flow B (mit v1122 erledigt) — der Partner
  kann seinen Mandanten längst **zehn** Farben vorgeben, nur nicht dort,
  wo er sein Branding einstellt.

  **Nicht prüfbar, ehrlich vermerkt:** der Name-Pfad des Sweepers. Im
  Testkonto liegt ein Logo, und das Bild schlägt den Namen — die zwei
  Wortmarken werden durch das Logo ersetzt, nicht durch Text. Das ist
  gewolltes Verhalten; ein Konto ohne Logo wäre nötig, um den Textweg zu
  sehen.

- [2026-08-08] **Gold auf Gold in der Score-Karte** — `v1113` bis `v1113f`
  (`2fdcb10`, `3e9e78d`, `161d116`, `f3a6b01`, `6f60f25`, `c06e2c2`)

  Bild: `design/mockups/Screenshot 2026-08-06 144507.png`. Gemessen in der
  Messkabine (1600 px), angemeldet, Partner-Konto, über den echten
  Bedienweg (Panel-Klicks).

  ### Erst der Abgleich, wie der Punkt es verlangte

  Im Panel gezählt: **acht Farbfelder — fünf für Flächen, drei für Text.**
  Für Score-Karte und KPI-Karten gibt es eine Fläche, aber keinen Text.
  Das ist Marcels „die Schriftfarbe lässt sich nicht setzen", und es
  bleibt als **Ausbau** offen (Demo steht, siehe Fertig). Der Kontrastfehler selbst
  ist damit aber nicht erklärt — der hat eine eigene Ursache.

  ### Die Ursache

  `body.dp-chrome-hell #hdr-badges .sc-main` macht die Score-Karte zur
  **Markenfläche** (`linear-gradient` aus `--gold-hi`/`--gold`/`--gold-lo`),
  Spezifität (1,2,1) mit `!important`. Seit v1085 hängt der Skin an der
  Vorlage — es trifft also **jede helle Vorlage**. Die Texte darauf sind
  die für dunklen Grund gebauten geblieben:

  | Stelle | Wert | k |
  |---|---|---|
  | `.sc-l` „Investor Deal Score" | `var(--gold)` | **1,06** |
  | `.sc-sub` | `rgba(168,162,153,.95)` | **1,16** |
  | `.sc-tip` | `#9a7f33` | 1,77 |
  | `.sc-grade` | Statusgrün `#2E8455` | 1,97 |
  | `.sc-pill-sub` ×5 · Pillen-Label ×5 | Graustufen auf weiß | 2,16 / 2,40 |

  ### Warum v1097 hier nicht reicht

  `tonAufDunkel`/`tonAufHell` rechnen gegen **zwei feste Gründe** (`#1A1D22`
  und Weiß). Hier ist der Grund die **Marke selbst** — bei Gold hell
  (`rgb(206,173,82)`), bei Partner-Rot dunkel (`rgb(126,58,70)`).
  **Gemessen: ein fest dunkler Ton, der auf Gold 5,78 erreicht, fällt auf
  Partner-Rot auf 2,16.** Das ist derselbe Denkfehler wie die feste
  Prozent-Ableitung aus v1097, nur eine Ebene weiter.

  Deshalb `tonFuerGrund()`/`tonAufMarke()` in `config.js` als **dritte
  Ableitung**: Richtung aus der Helligkeit des Grundes, gezogen in OKLab,
  gegen **alle drei Verlaufsstopps**. Erfüllt der Startwert die Schwelle
  schon, kommt er unverändert zurück. Gesetzt auf **beiden** Wegen
  (`apply()` und `applyTheme()`), sonst laufen Regler- und Sweeper-Weg
  auseinander — der v1096b-Fehler. `reset()` räumt die fünf Tokens mit.

  Statusgrün läuft durch **dieselbe** Funktion und bleibt dabei Grün: nur
  die Helligkeit wandert, Farbton und Sättigung bleiben. Das ist
  ausdrücklich **kein** Tokenisieren der Statusfarben.

  **Die Hausmarke bleibt unberührt, nachgerechnet:** Standard-Gold
  `#C9A84C` → `#c9a84c`, Hellgelb `#F0D000` → `#f0d000`, beide bitgenau.
  Nur Partner-Rot wandert (`#7B2D3B` → `#c36d78`).

  ### Zwei eigene Fehler, beide zurückgenommen

  **1 — Mein Messlauf hatte einen blinden Fleck.** Der erste Kontrastlauf
  meldete `.sc-tip` **nicht**. Nicht weil es sauber war: mein Grund-Parser
  konnte `color(srgb …)` nicht lesen — die Form, die Chrome für
  `color-mix()` zurückgibt. **Ein übersprungenes Element sah aus wie ein
  bestandenes.** Die Ausgangszahl war 14, nicht 13. Der Lauf zählt seither
  die ungeprüften Elemente mit und meldet sie; in allen Abnahmeläufen
  steht dort **0**.

  **2 — `v1113e` war ein Rückschritt.** Ich hatte `.sc-pill-v` in die
  Gegenrichtungs-Regel aufgenommen, weil ich es in `konsole` gemessen
  hatte. Unter den **hellen** Vorlagen sitzen die KPI-Pillen aber auf
  **Weiß**, nicht auf der Markenfläche. Gemessen hat das fünf Stellen von
  „trägt" auf **2,29** verschlechtert. Erst der Vorher/Nachher-Lauf in
  kontor hat es gezeigt — `v1113f` nimmt es zurück.

  Dazu zwei Funde aus der Gegenrichtung, die erst die Rot-Gegenprobe
  sichtbar machte: `.sc-v` (der Hauptwert) stand bei Rot auf **2,28**, weil
  dort die Markenfläche dunkel ist und der Text trotzdem dunkel blieb; und
  `.sc-investor-badge` stand in `konsole` bei **1,93** — Gewinner war
  `color:var(--ch)`, also erneut `--ch`, die Falle aus CLAUDE.md und
  v1099b. Die Pille ist in jeder Fassung golden, `--ch` schaltet aber mit
  der Vorlage mit.

  ### Nachgemessen, zwei Marken × sechs Fassungen, Schwelle 3

  | Marke | Fassung | vorher | nachher |
  |---|---|---|---|
  | Gold | ohne Vorlage | 0 | **0** |
  | Gold | kontor · panel | 14 | **0** |
  | Gold | kanzlei · boarding | 14 | **1** |
  | Gold | konsole | 1 | **0** |
  | Partner-Rot | alle sechs | — | **0** |

  Die verbleibende 1 ist `hdr-obj-num` (2,98 bzw. 2,88) und **nicht** Teil
  dieser Arbeit: die v1097-Schwelle rechnet gegen Weiß, kanzlei und
  boarding haben aber cremefarbenen Grund. v1097 hat das selbst so
  vermerkt. Steht jetzt als eigener Punkt 2.

  Ungeprüfte Elemente in jedem Lauf: **0**.

- [2026-08-08] **Die Einstellungen auf dem Handy** — `v1112`, `v1112b`
  (`03b83a9`, `4da3f5e`)

  Bild: `design/mockups/Screenshot 2026-08-08 075255.png`. Gemessen bei
  370 px im echten Fenster, angemeldet, Partner-Konto.

  **Die Vermutung des Punktes ist widerlegt.** Er nannte die MA-Serie und
  vermutete die Kombination „Einstellungen **unter Vorlage** auf kleinem
  Schirm". Es ist weder die Mobile-App noch die Vorlage: betroffen ist das
  Einstellungs-Modal der Haupt-App (`settings.js`), und der Defekt steht
  **ohne** jede Vorlage genauso da. Gegengemessen über den echten
  Bedienweg (Panel-Klicks) in allen sechs Fassungen — kontor, panel,
  kanzlei, boarding, konsole und ohne Vorlage — überall bitgleich:
  Modal 370, Leiste 64, Inhalt 546 px, Querlauf 0.

  ### Vier Ursachen, alle Kaskade, keine davon Logik

  | # | Befund | gemessen |
  |---|---|---|
  | 1 | `#settings-modal` hat `padding:30px` + `align-items:center`; das Modal ist Flex-Kind mit `flex-shrink:1`, deshalb wurde v638s `width:100vw!important` gestaucht | Modal **305 px** in einem 370-px-Schirm |
  | 2 | `.settings-modal.set-modal-v2 .modal-side{height:100%!important}` (0,3,0) schlägt die Mobilregel `.set-modal-cream .modal-side{height:auto}` (0,2,0, **ohne** `!important`) | Seitenleiste **737 px**, `.set-modal-content` auf Höhe **0** bei **y=846** — außerhalb des Modals |
  | 3 | `.set-modal-cream .ms-tabs{flex:1 1 0%}` lässt die Leiste im Spalten-Container wachsen | Leiste **718 px** hoch |
  | 4 | v642 „ICONS-ONLY" (`@media 900px`, `flex:1 1 0`) hat **dieselbe Spezifität (0,4,0)** wie v638 (`@media 768px`, `flex:0 0 auto`) und steht später in der Datei | 12 Reiter à **22 px**, hochkant |

  Befund 2 ist die leere schwarze Fläche im Bild: **der Inhalt war da, er
  stand nur unterhalb des unteren Randes.**

  Befund 4 ist die Falle „bei gleicher Spezifität gewinnt die spätere
  Regel", diesmal zwischen zwei Media-Queries mit unterschiedlicher
  Schwelle. Der Kommentar der v642-Regel rechnet ausdrücklich mit **zehn**
  Reitern — es sind inzwischen **zwölf**. Damit ist Icons-only nicht mehr
  Geschmack, sondern rechnerisch nicht tragbar: 370/12 = **30,8 px**
  unterschreitet die 44-px-Trefferfläche aus v650/v652. Zurück auf die
  Absicht von v638: waagerecht scrollbare Leiste mit Text. Die
  Beschreibungszeile (`.help-sidebar-item-desc`) gehört zur vertikalen
  Desktop-Liste und macht jeden Reiter ~200 px breit und zweizeilig — auf
  dem Handy aus.

  ### Alle zwölf Reiter durchgeprüft

  Kein Querüberlauf (`scrollWidth` 368 = `clientWidth` 368, `body` 370 =
  Viewport 370), kein Textfeld unter 16 px, kein Knopf unter 44 px. Die
  gemeldeten „Elemente unter 44 px" sind ausnahmslos Checkboxen (16–18 px)
  mit eigenem Label als Trefferfläche.

  **Ein eigener Messfehler, zurückgenommen:** Ich hatte in „Rechtliches"
  15 Elemente als Querüberlauf gemeldet. Falsch — die Tabelle sitzt in
  einem Elternteil mit eigenem `overflow-x:auto`. Ein Detektor, der nur
  `getBoundingClientRect().right > innerWidth` prüft, zählt jeden
  waagerechten Scroll-Container als Überlauf. Mit Vorfahrenprüfung: **0**.

  ### v1112b — Partner-Portal, beim Durchgang gefunden

  Reiter 10 (`data-rp="1"`) öffnet ein **eigenes** Modal aus
  `reseller-portal.js`. Die Datei enthielt **keine einzige Media-Query** —
  das Partner-Portal war nie für kleine Schirme gebaut. Gemessen:
  `.rp-ov` mit `padding:22px` + `align-items:center` → Modal **325,6 px**;
  im `.rp-body` (flex-row) hält `.rp-side` ihre festen **238 px**
  (`flex-shrink:0`), für `.rp-work` bleiben **86 px**. Folge: ein Wort je
  Zeile, Zahlen aus der Kachel gelaufen.

  Derselbe Sachverhalt wie oben, nur ein anderes Modal — deshalb nach
  demselben Muster behoben. Nachgemessen: Modal 370, Navigationsleiste 65
  hoch und scrollbar (Inhalt 600 px), alle fünf Einträge **44 px** hoch,
  Arbeitsfläche 370 breit, Querlauf **0**.

- [2026-08-06] **Partner-Flow: Whitelabel und Darstellung zusammengebracht**
  — `v1111`

  Analyse und drei Wege stehen in
  `design/Vorschläge/partner-flow-darstellung.md`. Umgesetzt sind **C und
  A**, wie dort empfohlen; **B** (drei Freiheitsstufen je Partner) bleibt
  offen und ist von hier aus nachrüstbar, ohne etwas umzubauen — A ist
  genau seine Voreinstellung.

  **Der Befund, der es ausgelöst hat:** weder `darstellung-reseller.js`
  noch `mandant-branding.js` enthielt `ui_theme`, `ui_cards`, `ui_surface`
  oder `ui_form`. Ein Partner konnte seinen Mandanten **14 Werte**
  vorgeben — Farben, Schrift, Logo — aber nicht die Vorlage, den
  Kartenmodus, die Fläche oder die Form. Also gerade das, was den
  Gesamteindruck am stärksten prägt.

  ### C · Die vier Werte wandern in den Abgleich

  Sie liegen nicht als Einzelschlüssel, sondern gemeinsam in einem JSON
  unter `dp_user_settings`. Statt die `MAP` umzubauen bekommen sie einen
  **virtuellen Schlüssel** mit Präfix `uv:`, den `LSget()` übersetzt — das
  Muster der MAP bleibt unangetastet.

  **`UV_LEER` ist dabei kein Schönheitsfehler, sondern nötig:** bei diesen
  vier ist *leer* ein **gültiger** Wert (kein Attribut = „DealPilot" bzw.
  „Standard"). `applySet()` überspringt aber leere Werte (`if (v) …`) —
  ohne Sentinel hätte ein Partner, der bewusst DealPilot vorgibt, gar
  nichts übertragen. Nachgemessen: eingesammelt wird `-`, angewandt wird
  wieder `null` und die Leiste ist `rgb(0,0,0)`.

  **Ein eigener Fehler beim Bauen:** `UV_LEER` stand zuerst *hinter* der
  MAP. Die MAP wird beim Laden ausgewertet, ein `var` ist dort noch
  `undefined` — die vier Defaults wären leer gewesen. Vor die MAP gezogen.

  ### A · Marke gilt, Komfort ist frei

  | | wer bestimmt | wann |
  |---|---|---|
  | **Marke** — Farben, Logo, Schrift | der Partner | **bei jedem Laden**, beim Mandanten im Panel gesperrt |
  | **Komfort** — Vorlage, Karten, Fläche, Form | der Mandant | Partner gibt sie **einmal** als Voreinstellung |

  Vorher galt für *alles* „einmal setzen, danach gilt die Wahl des
  Mandanten" (`dp_wl_display_seen`) — die Marke des Partners war damit
  nach der ersten eigenen Änderung weg. Der Marker bleibt erhalten,
  steuert jetzt aber nur noch den Komfort-Teil.

  Die Sperre unterscheidet **zwei Gruppen mit zwei Texten**: „Marke ab
  Partner" für Nicht-Partner, „Von deinem Partner vorgegeben" für
  Mandanten. Kennzeichen ist `dp_wl_cache` — es existiert ausschließlich
  beim `reseller_client`, genau so nutzt es die Handy-Sperre bereits.

  ### Dazu der Reset-Fall, der im Vorschlag als offen benannt war

  Beim Mandanten heißt „Zurücksetzen" jetzt **zurück auf die Marke des
  Partners**, nicht auf den DealPilot-Standard. Vorher räumte es gerade
  das weg, was der Partner vorgibt — bis zum nächsten Laden, dann kam es
  wieder. Das sah aus wie ein Fehler und war einer. Dafür eine kleine
  `reapply`-API in `mandant-branding.js`.

  **Nachgemessen auf Staging, beide Rollen:**

  | Rolle | Marke | Hinweis | Vorlage / Form / Schrift |
  |---|---|---|---|
  | Partner | **frei**, Umschalter da | „Marke ab Partner" | frei |
  | Mandant (gestubbt) | **gesperrt**, sichtbar, Deckkraft 0,42 | „Von deinem Partner vorgegeben" | **frei** |

  Brücke geprüft: alle vier Werte werden eingesammelt (`kanzlei`, `stapel`,
  `light`, `rund`) und wieder angewandt (`--uv-r` 16 px). Sentinel in beide
  Richtungen: eingesammelt `-`, angewandt `null`.

- [2026-08-06] **Die „Später"-Punkte der Reihe nach** — `v1106` bis `v1110`

  Fünf Punkte abgearbeitet. **Vier der fünf Backlog-Beschreibungen waren
  sachlich falsch** — jede hätte, blind umgesetzt, an der falschen Stelle
  repariert.

  ### (1) Wallet: „privat" liegt auf dem Preis — `v1106`

  **Beschreibung widerlegt.** Der Punkt sagte, `.sbc-halter` überlappe
  `.sbc-kp-row`. Gemessen endet der Halter bei y=395 und die Preiszeile
  beginnt bei 396. Es ist der **Score-Ring über der Adresse**: Ring
  x 277–344, Adresse x 87–356 — **67 px, auf jeder der fünf Karten**.

  Ursache war eine Inkonsistenz in derselben Rasterspalte: `.sbc-top-line1`
  hielt mit `padding-right:86px` bereits genau den Abstand zum Ring frei,
  nur `.sbc-address` war mit 9 px ausgenommen.

  **Zwei eigene Messfehler dabei, beide zurückgenommen:** Ich habe zuerst
  Randboxen statt Textkästen verglichen — `getBoundingClientRect()` misst
  das Padding mit, also sah es nach Überlappung aus, wo der Text längst
  endete. Und danach meldete ein `Range` über die Textknoten weiter 15 px,
  obwohl `overflow:hidden` und `ellipsis` gesetzt sind: **ein Range misst
  den vollen Text, auch wenn er sichtbar abgeschnitten ist.**

  ### (2) `.sbcm-label` bei Kartenfläche „Weiß" — `v1107`, `v1107b`, `v1108`

  **Größer als beschrieben.** Der Punkt nannte eine Klasse mit k=1,06 und
  „nur die Kombination dealpilot/konsole + weiß". Gemessen sind es sechs
  Sachverhalte, und der schlimmste stand nicht drin:

  | Element | k | Stellen |
  |---|---|---|
  | `.sbcm-scale span` | **1,00** | 7 |
  | `.sbcm-label` | 1,86 | 3 |
  | `.sbc-date` / `.sbc-arrow` | 1,67 / 1,46 | 2 |
  | `.sbcm-val` grün / blau | 2,03 / 2,25 | 3 |

  Und es betraf **nicht nur „weiß"**: `kontor` ohne alles stand bei 14
  Fundstellen mit denselben unsichtbaren Skalen-Beschriftungen. Die Vorlage
  macht die Karte hell und setzt `--uv-card-*`, aber die Kachel-Texte lasen
  die Tokens nicht. Jetzt über `--uv-card-mut` — in hellen Vorlagen dunkel,
  in `konsole` hell, eine Regel für beide Richtungen.

  Statusfarben wurden **nicht** tokenisiert: getauscht wurde nur die für
  dunklen Grund gebaute Fassung gegen eine für hellen, in OKLab abgesenkt.

  Dazu zwei Funde beim Gegenmessen: die **Score-Zahl** stand in `konsole`
  bei **k=1,03** (dunkle Ziffer auf dunkler Karte — derselbe Fall wie
  v1082e), und das **Investor-Ribbon** bei 1,32 (heller Text auf goldenem
  Grund).

  **Ein eigener Fehler, zurückgenommen:** Ich hatte das Stufen-Label auf
  `--uv-card-ink2` gesetzt und es damit von 2,03 auf **1,02
  verschlechtert** — die Pille trägt eine eigene grüne Fläche, nicht die
  Kartenfläche.

  **Nachgemessen, Kontrastlauf über die Objektkarte, Schwelle 3:**

  | Fassung | vorher | nachher |
  |---|---|---|
  | kontor / panel / kanzlei / boarding | 14 / 15 / 2 / 2 | je **2** |
  | dieselben + „weiß" | 20 | je **2** |
  | konsole | 3 | **1** |

  Die verbleibenden 2 sind die Aktionsknöpfe auf der Karte (k=2,7), in
  jeder Fassung gleich und älter als diese Arbeit.

  ### (3) Aktionen-Aufklapper — **Befund widerlegt, nichts geändert**

  Der Punkt sagte, `.sb-actions-accordion-inner` messe `rgb(255,255,255)`
  auch in den dunklen Fassungen. Mit **geöffnetem** Menü gemessen — wie der
  Punkt es verlangte — ist es **transparent**, sein effektiver Grund ist
  `rgb(10,8,5)`, und die Einträge stehen bei **k=12,35**. In allen sechs
  Fassungen sauber.

  Was bleibt, ist eine reine Gestaltungsfrage: das Menü bleibt auch in
  hellen Vorlagen dunkel. Das ist ein übliches Muster für Kontextmenüs und
  wurde bewusst nicht angefasst.

  ### (4) Vier Whitelabel-Tints bei hellem Akzent — `v1109`

  Der Punkt verlangte eine **Einstufung je Ton** statt einer pauschalen
  Regel, weil unter den 66 Tönen auch Flächen sind. Genau so gebaut, und
  das Kriterium kommt aus dem Ton selbst: **war der Originalton auf Weiß
  lesbar (k ≥ 3), ist er ein Text-Ton und muss es bleiben; war er es nicht,
  ist er eine Fläche und bleibt unangetastet.** Kein Ton bekommt eine neue
  Aufgabe.

  **Nachgemessen** mit Hellgelb `#F0D000`, Partner-Rot `#7B2D3B` und
  Standard-Gold: 19 Text-Töne, 47 Flächen, **0 Reißer** bei allen dreien.
  Flächen bleiben hell (`#fff5be`), Text-Töne wurden abgesenkt
  (`#a57900`), der Akzent selbst ist unverändert.

  ### (5) „Browser-Freeze" in den Einstellungen — `v1110`

  **Es war kein Freeze, und es lag nicht an der Reihenfolge.** Gemessen mit
  einem Protokoll, das nach jedem Schritt in `localStorage` schreibt und
  deshalb den Abbruch überlebt:

  | Abschnitt | Klick |
  |---|---|
  | anbieter / mandanten / plan / rechtliches | 5 / 2 / 1 / 1 ms |
  | **`closeSettings()`** | **83.942 ms** |

  Das Schließen ruft `confirm('Du hast ungespeicherte Änderungen…')` — ein
  **blockierender Dialog**, der auf eine Antwort wartet, die ein
  automatisierter Prüflauf nie gibt. Die 74 und 84 Sekunden waren das
  CDP-Zeitlimit, nicht die Rechenzeit.

  **Dahinter steckt aber ein echter Alltagsfehler:** `_setIsDirty()`
  verglich mit `!==`, und bei einem Array ist das ein **Referenzvergleich**.
  `_setCollectFormIntoDraft()` baut `ai_focus_areas` bei jedem Aufruf neu
  aus den Checkboxen — es war also **nie** gleich. Gemessen: Einstellungen
  öffnen, **einen** Tab wechseln, nichts anfassen → `dirty=true`, und genau
  ein Feld weicht ab: `["Lage","Mietmarkt","Risiken"]` gegen
  `["Lage","Mietmarkt","Risiken"]`.

  Folge für jeden Nutzer: durch die Abschnitte klicken, schließen — und es
  kommt „Du hast ungespeicherte Änderungen. Trotzdem schließen?", obwohl
  nichts geändert wurde.

  **Nachgemessen:** `dirty=false`, `closeSettings` in **1 ms** statt
  83.942. Gegenprobe, dass die Warnung noch funktioniert: echte Änderung →
  `dirty=true` und Hinweis sichtbar, Rücknahme → `dirty=false`.

- [2026-08-06] **Stapel-Modus feinziehen** — `v1105` bis `v1105c`

  Zwei Fassungen gebaut und gezeigt, **Marcels Wahl: „B — Abgesetzt"**.
  Fassung A (rahmenlose Kacheln, nur Trennstriche) und das
  Vergleichs-Attribut `data-uv-stapel` sind entfernt.

  **Eine Annahme des Punktes ist widerlegt.** Er sagte, im Mockup trügen
  die KPI-Kacheln **dunkle** Flächen, in der App folgten sie der Vorlage.
  Nachgesehen in `design/mockups/dp-handy-mockup-v2.html`: dort ist
  `--k-tile` **pro Fassung** definiert —

  | Fassung | `--k-tile` |
  |---|---|
  | dunkel | `rgba(255,255,255,.035)` (Aufhellung) |
  | kontor | `#FAF9F7` auf `--k-bg #FFFFFF` |
  | panel | `#F8F9FB` |

  Das Mockup macht es also genauso wie die App. Der Eindruck stammt aus
  `handy2.jpg`, das nur die dunkle Fassung zeigte — die Datei ist
  inzwischen nicht mehr im Repo. Gemessen in „panel": Kachel
  `rgb(248,249,251)` auf Karte `rgb(255,255,255)`, Abstand **6**, exakt wie
  im Mockup.

  **Der echte Punkt war ein anderer:** der goldene Kopf nimmt **159 von
  257 px** der aufgeklappten Karte ein, der Rumpf hatte dagegen kaum
  Eigengewicht. Fassung B macht das Raster zu einem eigenen Block mit
  Rahmen und setzt die Kacheln darin nochmal ab.

  **Die Töne werden aus `--uv-card-ink` gemischt, nicht gesetzt** — damit
  wirkt dasselbe Muster in beide Richtungen: auf hellen Vorlagen eine Spur
  dunkler, auf dunklen eine Spur heller, ohne je Vorlage eigene Werte. Das
  ist die Verallgemeinerung dessen, was das Mockup in seiner dunklen
  Fassung mit `rgba(255,255,255,.035)` tut.

  **Ein Folgefehler, im direkten Vorher/Nachher gefunden (`v1105c`):**
  Fassung B brachte **6 neue Fundstellen** unter k = 3, ausnahmslos
  `.sbcm-label`. Es steht auf `--uv-card-mut` und kam gegen die getönte
  Kachel nur auf **2,75**. Der Ton wird jetzt aus denselben zwei Tokens
  gemischt wie die Kachel — 62 % ergeben **4,31**. Nachgemessen:
  Label-Treffer **0** in kontor, boarding und konsole; kontor wieder auf
  dem Ausgangswert 34.

  **Nicht gebaut, bewusst:** „Im Rennen" und „Detail öffnen →". Beide
  kommen im Mockup nicht vor (nachgesehen, kein Treffer) und müssten aus
  `storage.js` nachgerüstet werden. Eine Leistenkarte ist eine Übersicht;
  der Weg ins Detail ist der Klick auf die Karte selbst.

  **Ein Messfehler von mir, und es ist derselbe wie in v1082d:** Der
  Kontrastlauf meldete in „konsole" 49 Fundstellen, darunter `.sbc-address`,
  `.sbc-date` und `.sbc-arrow` mit k = 1,08. Falsch — diese Elemente stehen
  auf dem **Goldband**, und das ist ein `::before`. Mein Grund-Parser läuft
  die Elternkette ab und findet Pseudoelemente nicht, rechnet also gegen
  die dunkle Karte darunter. Gegen die echte Bandfarbe gemessen steht die
  Adresse bei **k = 8,01**. Wer den Lauf wiederverwendet, muss
  `::before`/`::after` mit einbeziehen.

- [2026-08-06] **Konsole-Befund, altes Panel abgeklemmt, alle Einstellungen
  durchgeprüft** — `v1099` bis `v1104`

  **Marcels Befund** (`design/mockups/Screenshot 2026-08-06 112337.png`):
  in „Konsole" bleibt ein Teil des Arbeitsbereichs weiß. Gemessen war
  `#s0.sec` 1280 × 2462 auf `rgb(255,255,255)` — **in allen fünf Vorlagen**,
  nicht nur in der dunklen.

  **Ursache: ein zweites Attribut aus einer älteren Funktion.**
  `html[data-bg="white"] .sec` (`style.css:29762`, Hintergrund-Modus
  V257-06) mit `!important` bei (0,2,1). Und `white` ist dort der
  **Standard** — es traf also jeden. `body` und `.main-col` stimmten nur,
  weil Gegner und eigene Regel dort bei (0,1,2) gleichauf liegen und diese
  Datei später lädt; bei `.sec` gewinnt der Gegner. `.sec` fehlte in v1082
  schlicht in der Aufzählung.

  Das legte zwei weitere Schichten frei, die vorher unsichtbar waren, weil
  dunkler Text auf weißem Grund stand:

  | Paket | Befund |
  |---|---|
  | `v1099b` | 13 Fundstellen k < 3, schlimmste **1,08** — Mehrheit auf `--ch #2A2727`, genau die Falle „`--ch` nie auf Obsidian". `--ch` und `--text` in die Token-Brücke. |
  | `v1099c` | 14 Fundstellen, alle heller Text auf weiß gebliebener Fläche. Knöpfe: `style.css:29839` setzt `background:#ffffff!important` auf einer Kette mit **sieben `:not()`**, Spezifität **(0,15,1)**. Kette übernommen und nur um das Vorlagen-Präfix erweitert → (0,17,3), bitgenau dieselbe Elementmenge. |
  | `v1099d` | Gegenprobe über alle sechs: `panel` stand bei 10 statt 4–5. Die sechs zusätzlichen alle `--uv-mut #8a95a2` mit k = 2,78. |

  **Ergebnis in „konsole": 14 → 0 Fundstellen, 8 → 0 weiße Flächen.**

  ### Das alte Panel ist abgeklemmt (`v1100`)

  `#dp-tb-fab` und `#dp-tb-panel` werden nicht mehr gebaut. **Nur der
  Aufbau** — die `_dpDisp*`-Handler, `_dpLogoBlock` und `_dpResBlock`
  bleiben, das neue Panel benutzt sie. Nachgesehen: `repaint()` fällt ohne
  das alte Panel auf seinen zweiten Zweig und zeichnet `#dp-res-sec` /
  `#dp-res-save` einzeln neu — genau diese IDs liefert `_dpResBlock()` auch
  im neuen Panel. `_dpOpenToolbar` zeigt jetzt aufs neue Panel.

  ### Beim Durchprüfen aller Einstellungen: fünf weitere Defekte

  1. **Die Logo-Regler waren unter jeder Vorlage tot** (`v1101`). Gemessen:
     ohne Vorlage 60 % → 159 × 29 und 140 % → 266 × 49, mit „konsole" beide
     **130 × 24**. Ursache sind meine eigenen v1082-Regeln:
     `height: calc(26px * var(--dp-logo-scale,1))` — das Token setzte
     **niemand**; der Regler setzt `--dp-logo-w`, eine *Breite* in Prozent.
     Zwei Namen, kein Bezug. Der Kommentar daneben behauptete sogar das
     Gegenteil. **Und es ist derselbe Fehler wie v1080**, nur eine Ebene
     höher. Dazu hielt `justify-content: flex-start !important` den
     Ausrichtungs-Regler fest.
  2. **Der Wrapper war exakt bildbreit** (`v1101b`) — 78 px in einem 349-px-
     Kopf. `justify-content` setzte den richtigen Wert und bewegte nichts.
  3. **Die sechs Bereichsfarben wirkten überhaupt nicht** (`v1102`).
     Gemessen mit auffälligen Testfarben: kein einziger Regler bewirkte
     etwas, weder mit noch ohne Vorlage. **Jeder** Leser der Tokens hängt in
     `style.css` an `body.dp-chrome-hell` — die Regler wirkten nur im alten
     Hell-Skin, der Abschnitt hieß dort auch „Chrome (Hell)".
  4. **Drei der sechs Farben überlebten das Neuladen nicht** (`v1102`). Der
     Boot-Block `settings.js:3213` stellt nur `dp_kpi_ui`, `dp_obj_ui` und
     `dp_hero_ui` wieder her; `dp_hdr_ui`, `dp_side_ui`, `dp_text_ui`
     fehlen. Die Farbe war gespeichert und nach dem Neuladen weg.
  5. **Die Reset-Umhüllung wurde zu spät installiert** (`v1102c`) — erst
     beim Öffnen des Panels. Ein Reset davor ließ drei Schlüssel stehen.

  ### Der Fehler, den erst der echte Bedienweg zeigte (`v1103`, `v1104`)

  Nach `v1102` wurden Kopf und Tab-Leiste in **allen vier hellen Vorlagen
  schwarz** (`rgb(10,10,10)`) — aber nur beim Wechsel **über das Panel**,
  nicht per `setAttribute`. Über Attribute war nichts zu sehen, weil dabei
  kein Skin nachgezogen wird.

  **Ursache: ein Tokenname mit zwei Bedeutungen.** `--dp-header-bg` ist der
  Nutzerwert des Reglers *und* eine Interna des Skins —
  `body.dp-chrome-hell { --dp-header-bg: #0a0a0a }` (v927-headerblack). Da
  v1085 den Skin an die Vorlage koppelt, las mein „Nutzer-Vorrang" den
  Skin-Wert. Die Bereichsfarben haben jetzt einen **eigenen Namensraum**
  `--dpuv-*`, den ausschließlich der Regler setzt; die alten Tokens werden
  weiter mitgeschrieben, damit Hell-Skin und Mandanten-Abgleich unverändert
  laufen.

  `v1103` holt zusätzlich drei Flächen vom Skin zurück, die v1091 (A)
  übersehen hatte: `aside.sidebar`, `.sb-footer` und `nav.tabs`.

  **Nachgemessen, über den echten Bedienweg (Panel-Klicks):**

  | Vorlage | Soll `--uv-chrome` | Leiste / Kopf / Tabs |
  |---|---|---|
  | kontor | `#FFFFFF` | alle `rgb(255,255,255)` |
  | panel | `#FFFFFF` | alle `rgb(255,255,255)` |
  | kanzlei | `#FBFAF7` | alle `rgb(251,250,247)` |
  | boarding | `#FAF5E8` | alle `rgb(250,245,232)` |
  | konsole | `#16181C` | alle `rgb(22,24,28)` |
  | dealpilot | — | unverändert `0,0,0` / transparent / `10,8,5` |

  **Alle Bedienelemente einzeln geprüft:** 6 Vorlagen · 4 Kartenmodi
  (79 / 209 / 231 / 61 px) · 2 Kartenflächen · 3 Formen (`--uv-r` 0 / 3 /
  16 px, an der echten Karte nachgemessen) · 4 Schriften · 3 Größen ·
  6 Bereichsfarben (Leiste, Kopf, Tabs, Karte je auf den Sollwert) ·
  **Logo: Datei-Upload** (echte PNG erzeugt und hochgeladen — gespeichert
  und im DOM), **Größe** (60/100/140 % → 78×14 / 130×24 / 182×33),
  **Ausrichtung** (x12 / x135 / x259), **Zurücksetzen** (Originalbild, alle
  Schlüssel und Variablen weg) · Reseller-Umschalter · „Zurücksetzen" räumt
  **alle elf** Schlüssel, auch vor dem ersten Öffnen des Panels.

  Sperre ohne Partner: Marke gesperrt und **sichtbar**, Deckkraft 0,42,
  keine Klicks, Hinweis da, Reseller-Blöcke leer — Form und Schrift frei.

  **Zwei Messfehler von mir, zurückgenommen:** Ich hatte `kanzlei` einmal
  mit weißer Leiste gemeldet (Transitions-Artefakt, zu früh gemessen) und
  die Objektkarte als „folgt dem Regler nicht" (die Karte wird beim
  Vorlagenwechsel neu gerendert, die Messung lief davor). Beide stimmen.

- [2026-08-06] **Abschnitt „Marke" im Darstellungs-Panel, dazu Form und
  Schrift** — `v1098` bis `v1098d`

  Backlog Punkt 1 plus Marcels Zusatz: „vielleicht die Farbe auch
  einstellbar für die verschiedenen Bereiche, Farbe, Form".

  **Umgehängt, nicht neu gebaut**, genau wie die Bauanleitung es vorgab:
  die sechs Bereichsfarben nutzen dieselben globalen `_dpDisp*`-Handler und
  dieselben Einzelschlüssel `dp_*_ui`. Das **muss** so bleiben —
  `darstellung-reseller.js` liest in seiner `MAP` genau diese Schlüssel für
  den Mandanten-Abgleich. `_dpResBlock`, `_dpLogoBlock` und `_dpResSave`
  liefern fertiges HTML und werden eingehängt; die Optik dafür kam als
  **Stilbrücke** ins neue Panel, statt drüben etwas anzufassen.

  **Aufgeteilt nach Zuständigkeit, nicht nach Herkunft:** Form und Schrift
  sind Bequemlichkeit und bleiben für **jeden** frei — dieselbe Überlegung,
  nach der schon Vorlage und Kartenmodus frei sind. Farben und Logo sind
  die Marke und stehen sichtbar-ausgegraut hinter dem Partner-Plan.

  **„Form" braucht genau eine Regel.** Gemessen lesen *alle* Radien dieser
  Datei `--uv-r`/`--uv-rs` (sieben Fundstellen) — es reicht also, die zwei
  Tokens zu überschreiben, statt je Fläche eine Regel zu schreiben.
  Spezifität statt Ladereihenfolge: `:root[data-ui-form="…"]` (0,2,0)
  schlägt die Token-Sätze der Vorlagen (0,1,1). **Grenze, ehrlich benannt:**
  das wirkt nur *mit* einer Vorlage — ohne `data-ui-theme` liest keine Regel
  dieser Datei `--uv-r`. Steht als Hinweis im Panel, nicht nur im Code.

  **Drei Befunde nebenbei, alle gemessen:**

  1. `darstellung-reseller.js` `repaint()` (`:107`) sucht **zuerst** das
     alte Panel und ruft dessen `panelHtmlRebuild()`. Da das alte Panel
     vorerst bestehen bleibt, greift immer dieser Zweig — der neue
     Abschnitt wäre beim Umschalten „Mich / Meine Mandanten" nie
     aufgefrischt worden. Eigener Aufbau, umhüllt nach Hausmuster.
  2. **`_dpDispReset` hat nie ganz zurückgesetzt.** Es räumt acht
     Schlüssel, lässt aber `dp_kpi_ui`, `dp_obj_ui`, `dp_hero_ui`,
     `dp_tabtext_ui` und `dp_objtext_ui` stehen — der Boot-Block
     (`settings.js:3213`) setzt sie beim nächsten Start wieder. Per
     Umhüllung behoben, wirkt damit in **beiden** Panels.
  3. **Zwei Tore für dieselbe Frage.** Das neue Panel prüfte
     `currentKey()==='partner'`, `darstellung-reseller.js:48` prüft
     `Plan.can('reseller')`. Mit gestubbtem `currentKey` war die Marke
     gesperrt, der Reseller-Umschalter darin aber sichtbar. Jetzt führt
     `Plan.can`, `currentKey` bleibt Rückfall — im Zweifel sperren.

  **Zwei eigene Fehler, im Bild bzw. beim Messen gefunden:** „Text-Feintuning"
  stand **doppelt** (`_dpLogoBlock` liefert es selbst, meine Liste hatte es
  nochmal), und die acht Farbfelder standen auf **30 px** statt der 44 px,
  die das Panel sonst überall einhält.

  **Nachgemessen auf Staging, angemeldet, Partner-Konto:**

  | Prüfung | Ergebnis |
  |---|---|
  | Abschnitte | 6 — App-Darstellung, Objektkarten, Kartenfläche, **Form**, **Schrift**, **Marke** |
  | Form kantig / passend / rund | `--uv-r` 0 / 3 / 16 px, an der echten Objektkarte 0 / 3 / 16 px |
  | Bereichsfarbe setzen | schreibt Einzelschlüssel **und** CSS-Variable |
  | Zurücksetzen | **alle elf** Schlüssel weg, Variablen entfernt, Felder auf Standard |
  | Persistenz über Neuladen | Vorlage, Form, Radius, Bereichsfarbe, Schrift — alle da, Bedienelemente zeigen den Stand |
  | Ohne Partner | Marke gesperrt, **sichtbar**, Deckkraft 0,42, keine Klicks, Hinweis da, Reseller-Blöcke leer; Form und Schrift **frei** |
  | 390 × 844 | Panel als Blatt von unten im Bild, 51 Bedienelemente, **0** unter 44 px, Rumpf scrollt, kein Querüberlauf |

  **Ein Messfehler, zurückgenommen:** Ich hatte das Panel bei 390 px
  zunächst außerhalb des Bildes gemessen (`y=840` bei 840 px Höhe). Das war
  wieder die eingefrorene Transition im gedrosselten iframe — nach
  `getAnimations().finish()` steht es bei `y=185`.

  **Nicht gebaut, bewusst:** das Abklemmen des alten Panels. Steht als
  eigener Punkt 1, samt der widerlegten Annahme über `rp-b-disp`.

- [2026-08-06] **Partner-Akzent lesbar machen** — `v1097`, `v1097b`

  Marcels Auftrag, direkt im Anschluss an den Punkt oben. Der dort als
  „Später" notierte Kontrastbefund war nur die halbe Geschichte — gemessen
  gibt es ihn **in beide Richtungen**:

  | Token | Ableitung | Fundstellen | Problemfall |
  |---|---|---|---|
  | `--gold-2` | `_lighten(akzent, 8)` | 33, **alle** auf dunklem Grund | `#7B2D3B` → `#863e4b`, Kontrast **2,26** |
  | `--gold-d` | `_darken(akzent, 9)` | 19, **alle** auf hellem Grund | `#F0D000` → `#dabd00`, Kontrast **1,86** |

  **Die Ursache ist die feste Prozent-Ableitung.** „8 % heller als der
  Akzent" sagt nichts darüber, ob der Ton auf seinem Grund lesbar *ist*:
  bei einem ohnehin dunklen Akzent bleibt `--gold-2` dunkel, bei einem
  hellen bleibt `--gold-d` hell.

  **Fix:** erst den bisherigen Wert bilden — und nur wenn der die Schwelle
  verfehlt, die Helligkeit nachziehen. Nicht in RGB, sondern in **OKLab**,
  weil dort Farbton und Sättigung erhalten bleiben: `#7B2D3B` ergibt
  `#c0727e` mit Sättigung 0,41 statt `#ab7982` mit 0,29.

  **Die Schwellen sind an der eigenen Marke gemessen, nicht geraten:** das
  Haus-Dunkelgold `#9a7f33` liegt auf Weiß bei **3,85** → Schwelle 3,8. Auf
  der dunklen Seite wäre das Haus-Gold `#E8C964` mit **10,44** für jeden
  farbigen Akzent unerreichbar, dort gilt die übliche 4,5.

  Die OKLab-Rechnung steht in `config.js` als **eine** Quelle für beide
  Wege; `whitelabel-override.js` ruft sie mit Inline-Rückfall (Muster aus
  v1081). Gegen die CSS-Referenz `oklch(from …)` im Browser geprüft:
  Abweichung **0** auf allen drei Kanälen. Bewusst in JS statt per CSS —
  das Ergebnis muss als Hex in Tokens *und* in den Sweeper, und
  `var()`/`oklch()` trägt nicht überall.

  **v1097b legt zwei Töne zu einem zusammen.** Der Tint-Weg `--wl-9a7f33`
  kennt keinen Mindestkontrast (er verschiebt seine 66 Töne nur relativ in
  HSL): mit Hellgelb kam der Aktionen-Knopf darüber auf 3,27, der
  Fortschritt auf 3,15. Es waren ohnehin zwei verschiedene Dunkeltöne für
  dieselbe Sache — der Knopf stand auf `#451b23`, der Preis daneben auf
  `#702936`. Sichtbare Folge: die v1089/v1090-Stellen werden **unter einer
  Vorlage** eine Spur heller und stehen jetzt auf demselben Ton wie Preis
  und Nummernpille. Außerhalb der Vorlagen ist nichts angefasst.

  **Nachgemessen** (angemeldet, Partner-Konto, Modus „standard", acht
  Marken-Elemente je Lauf — Preis, Knopf, Pille, Abschnitt, Fortschritt,
  Pfeil, Objektnummer, Kerosin-Pille):

  | Akzent | Fassung | vorher | nachher |
  |---|---|---|---|
  | Rot `#7B2D3B` | ohne Vorlage | 1,31–2,80 | **5,21–5,95** |
  | Rot `#7B2D3B` | konsole | 2,26–2,37 | **4,61–5,04** |
  | Rot `#7B2D3B` | kontor | 4,35–14,64 | 7,20–10,20 |
  | Hellgelb `#F0D000` | kontor | **1,86** | **3,56–3,90** |
  | Hellgelb `#F0D000` | boarding | 1,86 | 3,31–3,69 |

  **Standard-Gold ist bitgenau unverändert** — es erfüllt beide Schwellen
  schon vorher und läuft durch den unveränderten Zweig: `konsole`
  7,58–10,98, `kontor` 3,30–3,83, ohne Vorlage 9,01–12,97. Dasselbe gilt
  für Statusgrün und Status-Rot.

  `boarding` liegt mit 3,31 knapp unter der Schwelle, weil dessen Grund
  cremefarben statt weiß ist und die Schwelle gegen Weiß rechnet — das
  Haus-Dunkelgold liegt dort gleichauf, es ist also kein Rückschritt.

  **Ein Messfehler von mir, zurückgenommen:** Ich hatte zwischendurch
  gemeldet, der Preis stehe ohne Vorlage bei 2,78. Falsch — mein
  Untergrund-Parser hat die **Winkelangabe** `135deg` des Kartenverlaufs
  als Farbwert gelesen. Mit einem Parser, der nur echte Farbnotationen
  nimmt und die Deckungen von unten nach oben mischt, sind es 5,63.

- [2026-08-06] **Marke kommt unter einer Vorlage nicht durch — Rest der
  Fundstellen** — `300bfc3`, `f0a6631`

  **Neu gemessen statt der alten Liste gefolgt.** Der Punkt warnte selbst
  vor Fehltreffern seines Regex-Audits, deshalb diesmal im laufenden DOM:
  Akzent setzen, Momentaufnahme **ohne** Vorlage, dann je Vorlage erneut,
  Vergleich je Element und Eigenschaft. Ergebnis sind **13 Elemente**, nicht
  33 Stellen — die alte Zahl zählte jede Vererbungsstufe und jede der vier
  Rahmenseiten einzeln.

  **Zwei Messfehler, die ich dabei zuerst selbst gebaut habe:**

  1. „Neutral" als **Grau** definiert (max − min ≤ 8). Damit meldete
     `panel` **null** Treffer — dessen Neutralton ist `rgb(21,26,32)`, ein
     Blaustich mit Abstand 11, und `boarding` ist cremefarben. Richtig ist
     der Vergleich über den **Farbton**: trägt die Farbe noch den Ton des
     Akzents (± 30°) oder nicht.
  2. Mit dem roten Akzent `#7B2D3B` aus dem Punkt ist die Marke **nicht
     vom Status-Rot zu trennen** — `.sb-card.deal-lost` mit
     `rgba(200,66,61,.65)` erschien als Markenverlust. Gemessen wurde
     deshalb mit **Violett** `#7C5CBF`; Grün und Rot bleiben dann eindeutig
     Statusfarben. Gegenprobe mit Rot: identische Liste bis auf genau
     diesen einen Fehltreffer.

  Dazu zwei Filter, ohne die die Liste Phantome enthält: Rahmenfarbe zählt
  nur bei `border-width > 0`, `color` nur bei **eigenem** Textknoten. Ohne
  den ersten meldet der Logo-Rahmen einen „Verlust", obwohl die Vorlage ihn
  per `border:0` bewusst ganz abräumt.

  **Fünf Sachverhalte, alle behoben (v1096):**

  | Stelle | Befund |
  |---|---|
  | `.sbc-kp` | der **Preis** auf der Karte, prominenteste Zahl |
  | `.sb-actions-trigger` + `.sb-actions-l` | Aktionen-Knopf |
  | `.sbc-seq` | **Fläche** der Nummernpille — v1093 hatte nur die Schrift |
  | `.sb-section-title` | nur `konsole`, v1093 ließ die dunkle Vorlage aus |
  | `.tabs-status-text` | siehe unten, eigener Fehler |

  Der Aktionen-Knopf war schon vorher sichtbar falsch: **v1090 hat den
  Pfeil im selben Knopf golden gesetzt, der Text daneben blieb grau** —
  gemessen Pfeil `#451b23`, Label `rgb(20,19,16)`. Ein Knopf, zwei Farben.

  **Einen eigenen v1082-Fehler nehme ich ausdrücklich zurück:**
  `.tabs-status-text` stand dort in der Gruppe „aufgehelltes Grün" und
  wurde auf `#2E8455` gesetzt. Gemessen ist der Normalzustand aber **Gold**
  (`style.css:25776`); grün wird der Text erst im *fertigen* Zustand über
  `.tabs-status-done .tabs-status-text` (`:25784`). Ich hatte die
  Zustandsfarbe für die Grundfarbe gehalten — Folge: in allen vier hellen
  Vorlagen stand „0 / 6 · 0 %" in Grün. Jetzt trägt der Grundzustand den
  Akzent, Grün bleibt dem Zustand `done`.

  **Der größere Fund kam erst bei der Abnahme (v1096b).** Er betrifft
  **auch v1089, v1090 und v1093**, nicht nur dieses Paket: die Marke kam
  nur durch, wenn der Akzent über den Sweeper gesetzt wurde. Es gibt aber
  **zwei Wege**:

  | Weg | setzt |
  |---|---|
  | `DealPilotWhitelabel.apply()` | `--gold`, `--gold-2`, `--gold-d`, 25 × `--wl-<hex>` |
  | `_dpDispAccent()` (`settings.js:3109`, altes Panel) | nur `--gold` und `--gold-hi/-lo/-l/-2/-3/-bg` — **kein** `--gold-d`, **keine** `--wl-*` |

  Nachgestellt mit violettem Akzent über den Regler: `--gold` stand auf
  `#7C5CBF`, und Objektnummer, aktiver Reiter, Preis, Aktionen-Knopf und
  Fortschritt fielen **alle** auf ihr Literal `#9a7f33` zurück —
  Standard-Gold neben einem violetten Akzent. Genau der Fehler, den dieser
  Punkt beheben sollte, nur an anderer Stelle.

  Der Ton hängt jetzt an `--gold`, das auf beiden Wegen steht, und wird nur
  gerechnet, wenn das Spezialtoken fehlt: `--uv-marke-d` und
  `--uv-marke-dd`. Ist das Token da, gewinnt es unverändert — **v1089 und
  v1090 sehen bitgenau aus wie vorher** (nachgemessen: `#451b23` bzw.
  `#702936`). Zwei Tokens statt einem, weil `--gold-d` und `--wl-9a7f33` im
  Whitelabel **nicht** denselben Wert haben.

  **Nicht geändert, weil Fläche und nicht Marke:** die sieben Rahmen und
  Trennlinien (`aside#sidebar`, `header.hdr`, `nav.tabs`, `#sb-user`,
  `.sb-card`, `.sbcm`, Knopfrahmen). Sie trugen Gold bei **10–55 %
  Deckung**, also einen Neutralton — und die Vorlage bestimmt die Fläche.

  **Nachgemessen auf Staging, angemeldet, Partner-Konto, fünf Objekte,
  Modus „standard", über den Regler-Weg** (also den, der vorher versagte):

  | Vorlage | Treffer gesamt | davon außerhalb der Rahmen |
  |---|---|---|
  | kontor · panel · kanzlei · boarding · konsole | je 9 | **0** |

  Kontrastlauf über die fünf geänderten Stellen, Standard-Gold: hell
  3,36–3,85 · konsole 9,08–10,98. Mit Partner-Rot: hell 4,35–14,64.
  Ohne Vorlage ist der Istzustand bitgenau erhalten — Sidebar `rgb(0,0,0)`,
  Tabs `rgb(10,8,5)`, Karte transparent mit dem originalen Verlauf, alle
  Marken-Elemente auf `#E8C964`. `gold-audit.py` unverändert bei **484**;
  `ui-varianten.css` trägt davon **keine einzige** Fundstelle.

- [2026-08-06] **Vier Befunde aus Marcels Screenshots** — `2131dfd`, `0982845`

  Zustand nachgestellt: Kontor + Objektkarten „Wallet" + Kartenfläche
  „Weiß", Objekt geladen (`header.hdr.has-v64-score`), 1920 breit.

  **(A) Der Investor Deal Score stand auf Schwarz.** Ursache ist
  **v927-headerblack**, `style.css:35410-35416`: der *alte* helle Skin
  `body.dp-chrome-hell` setzt `--dp-header-bg:#0a0a0a` und färbt damit Kopf,
  beide Reihen und `#hdr-badges` schwarz —
  `body.dp-chrome-hell header.hdr.has-v64-score` (0,3,2) und
  `body.dp-chrome-hell #hdr-badges` (1,1,1). Meine Vorlagen-Regel steht bei
  (0,2,3) und verliert gegen beide. **v1085 hat den Skin-Schalter an die
  Darstellung gekoppelt** — seitdem trifft es jeden, der eine helle Vorlage
  wählt. Gemessen mit gesetztem `dp-chrome-hell`: genau drei Flächen auf
  `rgb(10,10,10)`, alles andere weiß. Das war auch der Grund, warum der
  Objektname auf seinen Bildern kaum lesbar war — v1089 hatte ihn dunkel
  gefärbt, der Kopf darunter blieb schwarz. Die Vorlage ist die spätere und
  ausdrückliche Wahl und gewinnt jetzt; der Hell-Skin **ohne** Vorlage
  behält seinen schwarzen Kopf.

  **(B) Objektkarten ohne Umrahmung.** Ursache war meine eigene
  v1082-Regel „Kontor: Karten ohne Seitenrahmen, nur Trennlinie". Gemessen:
  `dealpilot` 2 px / Radius 11 px / Schatten gegen `kontor` 0 / 0 / keiner.
  Damit fällt die Gestaltungsentscheidung von v1082 — Marcel will den
  Rahmen. Die Karte nimmt Haarlinie und Radius aus den Tokens.

  **(C) Das Gold lief nicht bis zum Kartenrand.** Gemessen: `.sb-card`
  345 px, `.sbc-top` 325 px und 14 px unter der Oberkante — das Band ist
  dessen `::before` und damit ebenso 325 px. Ursache ist die
  Kartenpolsterung `14px 10px 10px`. Band per negativem Außenabstand an die
  Kante gezogen, die Ecken bekommt das Band selbst: `overflow:hidden` ist
  gesperrt, weil das Investor-Ribbon bei `top:-7px` sitzt.
  **Nachgemessen: Rand links/rechts/oben je 2 px — das ist der Rahmen.**

  **(D) Der Score-Ring sprang nach oben links.** Gemessen: `Standard`
  `right:12px` → Ring x 284, **rechts**; `Wallet` `left:9px` → Ring x 21,
  **links**. v1082j hatte ihn bewusst aufs Band geschoben und wird
  zurückgenommen. **Nachgemessen: Ring x 285–335, Stufen-Pille darunter bei
  y 172–197 — Lage wie im Standard (284–334).**

  **Ein Zwischenstand war falsch (v1091 → v1091b):** mit
  `display:inline-block` (aus dem Wallet-Block von v1082h) flossen Ring und
  Pille in *eine* Zeile, Ring x 226–276, Pille x 276–343. Im Standard ist
  die Pille `display:block` und stapelt sich dadurch unter den Ring.

  **Gegenprobe** über alle sechs Fassungen, Kontrastlauf k < 2 in
  `#sidebar`/`header.hdr`/`nav.tabs`: hell 1, dunkel 3 Fundstellen — beide
  Reste sind unter **Später** eingetragen und älter als dieses Paket.

- [2026-08-06] **Heller Text auf hellem Grund — der Rest aus v1088** —
  `1a13207`, `49d5c3a`

  **Meine v1088-Diagnose war am falschen Gegner gemessen und wird
  ausdrücklich zurückgenommen.** Ich hatte `.hdr-v61-row1 .hdr-obj-name`
  (0,2,0) als konkurrierende Regel geprüft und daraus geschlossen, meine
  Regel gewinne. Die Regel, die wirklich gewinnt, selektiert über die
  **ID** — und die Elemente tragen Klasse *und* ID:

  | Datei | Selektor | Spez. |
  |---|---|---|
  | `style.css:24145` | `header.hdr.has-v64-score #hdr-obj` | (1,2,1) |
  | `style.css:24136` | `header.hdr.has-v64-score #hdr-obj-num` | (1,2,1) |
  | `style.css:24065` | `header.hdr.has-v64-score .hdr-sep` | (0,3,1) |

  `index.html:807/813`: `<span class="hdr-obj-num" id="hdr-obj-num">` und
  `<div class="hdr-obj-name" id="hdr-obj">`. Meine v1088-Selektoren waren
  rein klassenbasiert (0,3,3) und verlieren gegen jede ID — `!important`
  steht auf beiden Seiten, also entscheidet die Spezifität. Deshalb löste
  `--uv-chrome-ink` am Element korrekt auf und blieb trotzdem wirkungslos:
  die Deklaration kam nie zum Zug. **v1089** fixt über Selektoren mit ID,
  (1,2,3) schlägt (1,2,1). Der Trenner `.hdr-sep` hängt an derselben
  Ursache und war in v1088 gar nicht erfasst.

  **v1090** räumt die zwei Reste ab, die der saubere Lauf danach zeigte —
  beide derselbe Fall wie die Objektnummer, aufgehelltes Gold `#E8C964`
  auf hellem Grund: `#hdr-credits-pill-label` (erbt von
  `.hdr-credits-pill`) und `.sb-actions-arrow`. Beide Gegner sind (0,3,1)
  und tragen keine ID, hier reicht Klassen-Spezifität.

  **Das Werkzeug, das gefehlt hat:** ein Kaskaden-Walker, der *alle*
  Stylesheets rekursiv durchgeht (auch `@media`/`@supports`), je
  **Teilselektor** matcht und nach `!important` → Spezifität → Reihenfolge
  sortiert. `element.matches()` findet Regeln, sagt aber nichts über die
  Kaskade — das war der Denkfehler.

  **Zwei eigene Messfehler nehme ich zurück,** die ich zwischendurch als
  Befund hatte: `.sb-user-name` (angeblich dunkel auf schwarzem `#sb-user`)
  und `.sb-actions-l`. Beides Artefakte des gedrosselten Prüf-Tabs —
  **eingefrorene Transitions überschreiben sogar Inline-`!important`**, ein
  `background:transparent !important` mit höchster Spezifität blieb ohne
  Wirkung. Nach `document.getAnimations().forEach(a => a.finish())` sind
  beide sauber. `.sb-act-l` war ein Fehlalarm meines Scanners: liegt in
  einem `display:none`-Aufklapper, Rechteck 0×0. Der Scanner filtert das
  jetzt.

  **Nachgemessen** (Kontrastlauf über `#sidebar`, `header.hdr`, `nav.tabs`,
  Schwelle k < 2, im gleich-Origin-iframe bei 1440 / 820 / 390):

  | Fassung | vor v1089 | nach v1090 |
  |---|---|---|
  | kontor · panel · kanzlei · boarding | 4 | **0** |
  | dealpilot · konsole (Referenz, dunkel) | 2 | 1 |

  Der eine verbleibende Treffer in der dunklen Fassung ist
  `.sb-version-badge` (Gold bei 70 % Deckung auf einem Gold-8-%-Plättchen)
  — so gebaut, in den hellen Fassungen gar nicht auffällig.

- [2026-08-05] **Kopfleiste auf dem Tablet** — `fc36d12`

  **Befund (gemessen bei 820 × 1180 mit geladenem Objekt):**

  | Element | war |
  |---|---|
  | `header.hdr` | **815 × 589** — die halbe Bildschirmhöhe |
  | `#hdr-badges` | 815 × 492 |
  | `.scores` | `grid-template-columns: 381.5px 381.5px` — **zwei** Spalten |
  | `.sc-main` | 771 × 121, spannt beide Spalten |
  | `.sc-pill` × 5 | 382 × 109 → bei zwei Spalten **drei Zeilen** |

  Eine Pille trägt Label 15 px + Wert 33 px + Unterzeile 15 px + Balken 4 px
  = 67 px Inhalt in einem 109-px-Kasten. Inhaltlich ist sie schmal
  („RENDITE / 98 % / 4 von 4 KPIs") — sie braucht keine 382 px Breite. Bei
  771 px verfügbarer Breite passen **fünf** zu je rund 147 px nebeneinander.

  **Fix (v1087b):** fünf Spalten statt zwei, Score-Karte spannt darüber.
  `minmax(0,1fr)` statt `1fr`, sonst greift `min-width:auto` und ein breiter
  Inhalt sprengt die Spalte — der Sammelfall aus v650.

  **Einen ersten Anlauf nehme ich zurück (v1087):** Ich hatte die Pillen in
  eine waagerecht scrollende Spur gelegt, nach dem Muster des Boarding-Passes
  aus v651b. Die Kopfzeile war danach zwar 365 statt 589 px — aber `.sc-main`
  wurde **1118 px breit** und lief aus dem Bild, weil `min-width:max-content`
  den Container auf die Summe aller Pillen zieht und die Score-Karte mit
  `flex:1 0 100%` davon 100 % nimmt. Ein Scroller war hier schlicht das
  falsche Mittel: die Pillen passen ja.

  **Nachgemessen:** 820 × 1180 → `header.hdr` **348 px** (vorher 589), alle
  fünf Pillen à 149 px in **einer** Zeile, Score-Karte wieder 771 px und im
  Bild, kein waagerechtes Scrollen. Gegenprobe unverändert: 390 px → 76 px
  (v649-Arbeit, Pillen dort ausgeblendet) · 1440 px → 243 px · 1920 px →
  190 px.

- [2026-08-05] **Kompakter Logo-Kopf in den Vorlagen** — `20dbb4c`, `49c1944`

  Marcels Vorgabe: die Vorlagen sollen aussehen wie sein Bild `UI-Ansicht.png`
  (inzwischen entfernt), „auch
  das Logo darf klein werden".

  **Befund:** Die Vorlage hatte den Logo-Kopf **gar nicht angefasst** —
  `.sb-header` 379 × 125 in *jeder* Fassung, Rahmen 323 × 83, Bild 287 × 53.
  Soll laut `dp-mockup-alle-formate.html:138-145`: `.list-hd` mit 12 px
  Polsterung und Trennlinie, also rund 60 px. Das war der auffälligste
  Unterschied zum Bild.

  **Fix:** flacher Kopf, kleines linksbündiges Logo, kein Goldrahmen. Höhe
  führt, Breite folgt (`height:26px` / `width:auto`) — sonst zieht die
  Leistenbreite das Logo wieder auf, das war der v646-Befund. In den vier
  hellen Vorlagen wird die Wortmarke invertiert, weil ihr „Deal" weiß ist
  und auf hellem Grund verschwände; `hue-rotate(180deg)` dreht den Goldton
  zurück.

  **Nachgemessen:** `.sb-header` **125 → 49 px**, Logo 141 × 26, Abstand von
  links 13 px, kein Rahmen. Die Objektliste gewinnt dadurch 76 px.
  „dealpilot" trägt kein Attribut — Rahmen, Wortmarke und Größenregler aus
  v1079/v1080 bleiben dort unangetastet.

  **Zum zweiten Mal derselbe Fehler, deshalb hier notiert:** Das Logo saß
  zuerst bei x = 119 statt 13 — exakt die Mitte. `justify-content:flex-start`
  stand auf Header *und* Wrapper, lief aber ins Leere, weil die
  **Flex-Richtung** nicht gesetzt war: bei `column` steuert `align-items` die
  waagerechte Achse, und das geerbte `center` gewann. Dieselbe Ursache wie
  bei der Wallet-Stufenpille (v1082i). **Regel für künftige Arbeit: wo
  Ausrichtung gesetzt wird, gehört die Richtung dazu.**

  **Nicht gebaut, bewusst:** das „D"-Badge und die Zeile „by Junker
  Immobilien" aus dem Mockup. Beides ist Markeninhalt — per CSS `content`
  eingesetzt stünde bei jedem Whitelabel-Mandanten der falsche Name in der
  Leiste. Das gehört an die Branding-Daten, nicht ins Stylesheet.

- [2026-08-05] **Widersprüchliche `.sb-list`-Regeln** — *keine Änderung nötig*

  Der Punkt ist veraltet. `height:40vh !important` und `height:0 !important`
  stehen nicht mehr im Stylesheet; die einzige Fundstelle ist ein Kommentar.
  Gemessen bei 390 × 844 mit offenem Drawer: `flex: 1 1 auto`,
  `min-height: 72px`, `overflow-y: auto`, Höhe 511 px, scrollt in sich.
  Das hat **v645** bereits erledigt, als die Liste den Restplatz bekam.

- [2026-08-05] **Handy-Sperre plan-abhängig lösen** — `9f6b3ba`

  `js/mobile-redirect.js` steht in CLAUDE.md unter **Nicht anfassen**. Die
  Vorbedingung dieses Punktes („erst wenn 1–2 stehen") war erfüllt, und der
  Punkt beschrieb die Änderung samt Lösungsweg — deshalb angefasst.

  **Der Haken, den der Punkt selbst benannte:** Die Datei läuft bewusst
  **ohne** `setTimeout` („bei einer Sperre darf es kein offenes Zeitfenster
  geben"). Der Plan steht zu diesem Zeitpunkt aber noch nicht fest, weil
  `Sub.getCurrent` ein Netzaufruf ist. Entschieden wird deshalb **nur aus
  dem Cache**:

  | Schlüssel | Bedeutung |
  |---|---|
  | `dp_last_plan` | zuletzt bekannter Plan (`subscription.js:101`) |
  | `dp_wl_cache` | Reseller-Branding — existiert **ausschließlich** bei einem `reseller_client` (`mandant-branding.js:230`, das Backend liefert für Owner `null`). Damit ist es das gecachte Kennzeichen „Mandant eines Partners". |

  **Immer erst sperren, dann freigeben.** Leerer Cache heißt Sperre. Der
  Korrekturpfad hängt an `dp:plan-ready`, nicht an einem Timer.

  **Nachgemessen (Touch-Zeiger nachgestellt, damit `isPhone()` greift):**

  | Fall | Ergebnis |
  |---|---|
  | kein Cache (neues Gerät) | **gesperrt** |
  | Plan `pro` | gesperrt |
  | Plan `free` | gesperrt |
  | Plan `partner` | **frei** |
  | Mandant (`dp_wl_cache` gesetzt) | **frei** |

  Korrekturpfad: leerer Cache → gesperrt; danach `dp:plan-ready` mit
  `partner` → **frei**. Gegenprobe: dasselbe Signal mit `free` → bleibt
  **gesperrt**. Beim ersten Login auf einem neuen Gerät blitzt damit nichts
  Falsches auf — es steht die Sperre, und die weicht erst, wenn der Plan sie
  widerlegt.

  Die Erkennungsregeln (Regel A/B, Tablet-Schwelle 1400 px) und die
  Testhintertür `?nomobileblock` sind unangetastet.

- [2026-08-05] **Skin-Schalter und Darstellung liefen auseinander** — `9f6b3ba`

  **Entschieden: koppeln, nicht löschen.** Der Punkt ließ beides offen.
  Drei Gründe für die Kopplung:

  1. `body.dp-chrome-hell` trägt **105 gewachsene Regeln**. Die zu entfernen
     ist ein eigenes Vorhaben mit eigener Prüfstrecke, kein Nebenzug.
  2. `darstellung-reseller.js:29` und `mandant-branding.js:156` rufen
     `_dpDispSkin`, um die Marke eines Partners an dessen Mandanten
     durchzureichen. Fällt die Funktion weg, bricht das Whitelabel.
  3. Gemessen **stören** sich beide nicht — `html[data-ui-theme]` (0,2,1)
     liegt über `body.dp-chrome-hell` (0,2,0), die Vorlage gewinnt. Das
     Problem war nicht Kollision, sondern **Auseinanderlaufen**: „Hell"
     schalten und „Konsole" wählen ergab Konsole, der Schalter wirkte
     folgenlos.

  Umhüllt nach dem Hausmuster aus `settings.js:3469` — das Verhalten der
  Originalfunktion bleibt unangetastet, es kommt nur etwas dahinter.
  Wächter-Flag gegen den Ringschluss.

  **Nachgemessen, fünf Fälle:**

  | Schritt | Vorlage | `dp_chrome_hell` |
  |---|---|---|
  | Skin = hell | `kontor` | 1 |
  | Skin = obsidian | *(entfernt)* | 0 |
  | Vorlage = konsole | `konsole` | 0 |
  | Vorlage = boarding | `boarding` | 1 |
  | Panel aktiv, dann Skin = hell | **`panel` bleibt** | 1 |

  Der letzte Fall ist der wichtige: Wer „Hell" schaltet und schon auf einer
  hellen Vorlage steht, behält sie. Nachgezogen wird nur, wenn die Vorlage
  der neuen Helligkeit **widerspricht** — sonst würde der Schalter eine
  bewusste Wahl überschreiben.

- [2026-08-05] **Aktionen-Menü gliedern** — `599821f`, `bf6b546`

  **Befund vorab — zwei Annahmen des Punktes stimmten nicht:**
  Das Menü hat **11 Einträge**, nicht „eine lange Liste". Und die
  Gliederungs-Mechanik **existierte bereits**: `.sb-act-section-title` stand
  schon vor „Daten" und „App", nur waren die ersten sieben Einträge
  ungruppiert. Es wurde deshalb nichts neu erfunden, sondern die vorhandene
  Mechanik durchgezogen.

  **Gliederung** nach der Backlog-Vorgabe:

  | Gruppe | Einträge |
  |---|---|
  | Ansichten | Einzelobjekt · Portfolio-Cockpit |
  | Analyse | Marktbericht |
  | Anlegen | Neues Objekt · Quick Boarding · Import |
  | Ausgeben | Track Record · Bankexport · Export |
  | System | Einstellungen · Feedback & Support |

  **Plan-Schranken — `dp-plan-gates.js` komplett neu.** Die alte Fassung
  hatte drei Fehler auf einmal:
  1. Sie **versteckte** per `display:none`. Der Punkt will das Gegenteil.
  2. Sie erkannte den Eintrag über einen **Textvergleich**
     (`textContent === 'Export'`) auf sichtbarem Nutztext — obwohl die
     `data-feature`-Marker die ganze Zeit daneben im Markup standen. Jede
     Umbenennung hätte sie ins Leere laufen lassen.
  3. Sie behandelte **nur** „Export". `track_record_pdf` und `bank_pdf_a3`
     trugen ihren Marker, wurden aber nie ausgewertet.

  Jetzt bleiben gesperrte Einträge **sichtbar**, ausgegraut, mit Schloss,
  und der Klick führt zu den Plänen statt ins Leere.

  **Die Falle dabei, ausdrücklich abgesichert:** CLAUDE.md — „Unbekannter
  Feature-Schlüssel ist für jeden `false`, auch für Pro." `hasFeature()`
  würde bei einem Tippfehler im Marker **allen zahlenden Kunden** den
  Eintrag wegnehmen. Deshalb wird nur gesperrt, wenn der Schlüssel
  nachweislich in den Features irgendeines bekannten Plans vorkommt.
  Unbekannt = offen lassen. Nachgemessen: Marker auf
  `tippfehler_gibt_es_nicht` gesetzt → **nicht** gesperrt.

  **Kerosin am Marktbericht: „ab 2 L".** Die Staffel steht in
  `backend/src/routes/marktbericht.js:34`
  (`COST = {fast:2, full:5, wertermittlung:12}`) — deshalb eine Spanne und
  keine erfundene feste Zahl, die volle Staffel steht im `title`.

  **Nachgemessen auf Staging, angemeldet:**

  | Viewport | Ergebnis |
  |---|---|
  | 1440 × 900 | 5 Gruppen, 0 versteckt, Kerosin am Marktbericht |
  | 390 × 844 | Menü 58–689, Trigger 697, **Überhang 0**, kein Ziel < 44 px |
  | 390 × 556 | Kasten 343 px, Inhalt 686 px — scrollt in sich, letzter Eintrag per `elementFromPoint` getroffen, 44 px hoch |
  | 820 × 1180 | alle Einträge **44 px**, 5 Gruppen, kein Überlauf |

  Sperr-Pfad mit gestubbtem Plan geprüft: alle drei Einträge **sichtbar**
  (`display` ≠ `none`), Deckkraft 0,5, Schloss da, `onclick` beiseitegelegt.

  **Eine Zwischendiagnose nehme ich ausdrücklich zurück:** Ich hatte bei
  390 × 556 „383 px abgeschnitten" gemeldet. Falsch — der innere Container
  scrollt (`scrollHeight 686`, `clientHeight 341`, `overflow-y:auto`); ich
  hatte ungescrollten Inhalt für abgeschnittenen gehalten. Ebenso war das
  gleichzeitige `max-height` **und** `bottom` am Kasten ein Artefakt meiner
  iframe-Messkabine: `resize` feuert im gedrosselten Tab nicht, also lief
  `_sbActionsDock()` nach dem Verkleinern nie neu. Nach manuellem Aufruf
  stand nur noch `max-height` — der v647-Code ist in Ordnung.

  **Nebenbefund, mitbehoben (v1084b):** Bei 820 px waren alle Einträge nur
  **36 px** hoch, bei 390 px dagegen 44. v650 hatte die Trefferflächen auf
  `max-width:768px` gelegt, v648 den Drawer aber auf 900 px gezogen — im
  Band dazwischen fehlte die Regel. Bestand schon vorher; gehört hierher,
  weil „funktioniert auf Desktop, Tablet und Handy" das Abnahmemaß ist.

- [2026-08-05] **Partner-Netzwerk lädt nicht** — `253664a`

  **Der Punkt war veraltet — das Netzwerk lädt.** Nachgemessen in einer
  angemeldeten Sitzung, Objekt geladen, Deal-Aktion-Tab offen:

  | Prüfung | Ergebnis |
  |---|---|
  | `Auth.apiCall('/network-cards')` | **5 Karten, 2 Kategorien** |
  | Rails im Deal-Aktion-Tab, Desktop | **2 Rails, 7 Karten**, keine Meldung |
  | Dieselbe Strecke bei **390 × 844** | **2 Rails, 7 Karten**, kein Seiten-Überlauf |

  Die fünf Partner erscheinen namentlich in den beiden Spuren
  (Finanzierung, Gutachter).

  **Ich kann nicht sagen, was es war** — der Fehlerzustand trat nicht mehr
  auf, und eine Ursache, die man nicht gesehen hat, wird hier nicht
  behauptet. Wahrscheinlichster Kandidat bleibt ein abgelaufenes Token;
  `v982-netauth` hat den Ladepfad zwischenzeitlich auf `Auth.apiCall`
  umgestellt.

  **Vorher ausgeschlossen (alles gemessen, Serverseite):** Route gemountet
  (401 ohne Token), Migrationen bis 63, Tabellen da, 5 Karten `aktiv`, kein
  `[network]`-Fehler in 72 h, keine 404 unter 167 Skripten, Antwort nur
  92 kB (also kein Timeout), keine Plan-Schranke auf dem Ladepfad, und die
  Renderstrecke mit den echten DB-Daten gegen `buildRails()` geprüft.

  **Eine Backlog-Annahme ist widerlegt:** `netzwerk-einreichung.js` stand
  als erste beteiligte Datei. Das Modul **bootet gar nicht** — `boot()`
  beginnt mit `return; /* v893p-off */`. Der Tab existiert nicht; gemeint
  waren immer die Rails in `deal-action-boarding.js`.

  **Was gebaut wurde (v1083), damit der nächste Fall greifbar ist:** Der
  catch-Zweig meldete **jede** Ursache als „Netzwerk aktuell nicht
  erreichbar." — auch ein abgelaufenes Token. Genau deshalb war der Punkt
  so lange nicht zu fassen. Jetzt unterscheidet er 401 / 403 / anderer
  Status / kein Status und schreibt eine Konsolenzeile dazu.
  Geprüft durch Stub: bei 401 steht „Sitzung abgelaufen — bitte einmal neu
  anmelden, dann ist das Netzwerk wieder da.", danach wieder 7 Karten.

  Dabei ein falscher Kommentar richtiggestellt: er versprach einen
  „zentralen 401-Handler (Re-Login + Retry)". Den gibt es nicht.
  `Auth.apiCall` wirft bei 401 nur einen Error mit `.status`, und
  `session-expired-banner.js` blendet einen Hinweisbalken ein — **kein
  Re-Login, kein Retry.**

- [2026-08-05] **Darstellungs-Modal mit sechs UI-Vorlagen** — `495e35c`, `ff6eba1`, `44ce7bb`, `bd77f4c`, `ff20dfb`, `8f603e9`

  Gebaut gegen `design/mockups/dp-darstellung-panel.html`. Die sechs Namen
  und ihr Zuschnitt sind am 2026-08-05 abgenommen. **Punkt 4 (Kartenmodi)
  und Punkt 5 (Kartenfläche) sind miterledigt** — sie hängen an denselben
  Attributen und wären getrennt eine zweite Mechanik gewesen. Der
  „Später"-Punkt mit den zwei 404 ebenfalls.

  **Befund vorab (gemessen, nicht geraten):** `css/ui-varianten.css` und
  `js/ui-varianten.js` waren seit 20260801 in `index.html:29` und `:3466`
  verlinkt und existierten nicht. Der Kommentar dort sagte schon „nach
  style.css, damit `html[data-ui-*]` greift" — der Platz war vorbereitet.

  Im DOM bei 1920 px gezählt: **65 Elemente mit deckender Hintergrundfarbe**
  (CLAUDE.md schätzte „rund 51"). Der Großteil sind Formularfelder und
  `div.card`, alle weiß — die folgen der Fläche. Deshalb **nicht 6 × 65
  Regeln, sondern ein Satz Flächenregeln plus 6 × ~30 Token-Zeilen.**

  **Die CLAUDE.md-Warnung „Token-Überschreibungen reichen nicht" gilt
  differenzierter als gedacht:**

  | Fläche | liest Tokens? |
  |---|---|
  | `aside.sidebar{background:var(--dp-s0)!important}` | **ja** |
  | `.sb-card{background:var(--dp-obj-card,…)!important}` | ja, aber siehe unten |
  | `header.hdr.has-v64-score + nav.tabs{background:rgb(10,8,5)!important}` | **nein, hart** |

  Die Tab-Leiste wurde deshalb einzeln benannt — mit demselben
  Nachbarschafts-Selektor plus `html[data-ui-theme]` davor, statt sich auf
  die Ladereihenfolge zu verlassen.

  **Vier Fehler, jeder erst durch Messung gefunden:**

  1. **v1082b · Halber Skin in der Objektkarte.** Kontrastlauf über alle
     Textknoten: `.sbc-mini-score-num` #FFFFFF auf #FFFFFF = **1.00**,
     `.sbcm-label` rgba(255,255,255,.7) auf #FAF9F7 = **1.05**. Die
     Kachel*fläche* war aufgehellt, die Schrift darauf nicht.
  2. **v1082c · Panel ging im gedrosselten Tab nicht auf.**
     `requestAnimationFrame` feuerte nach 700 ms **nicht**, die `open`-Klasse
     kam nie. Ersetzt durch erzwungenen Reflow (`void p.offsetWidth`) —
     synchron, ohne Zeitplaner.
  3. **v1082d · Die Objektkarte trägt ihre Farbe als Verlauf.** Gemessen:
     `background-color: rgba(0,0,0,0)` — transparent — und
     `background-image: linear-gradient(135deg, rgba(20,15,5,.6), rgba(0,0,0,.7))`.
     Das Token färbt nur `background-color`, der Verlauf lag darüber: auf
     hellen Vorlagen stand weiter eine **schwarze Karte in heller Leiste**.
     **Und meine eigene Messung war dafür blind** — sie las `backgroundColor`,
     sah die transparente Karte, stieg zur hellen Sidebar hoch und rechnete
     gegen Weiß. Der Kontrastlauf wurde nachgezogen, damit er Verläufe sieht.
  4. **v1082e · Wallet-Ringe standen leer.** Die Score-Zahl erbt
     `currentColor` (weiß) und der Wallet-Ring bekommt eine weiße Scheibe
     untergelegt. Im Bild gesehen, nicht gemessen — der Kontrastlauf deckte
     nur die vier hellen Vorlagen ab, der Fehler hängt aber am
     **Kartenmodus**. Im Mockup stand die Regel bereits; ich hatte sie beim
     Übertragen übersehen.

  **Nachgemessen auf Staging, angemeldet, mit fünf echten Objekten:**

  | Vorlage | Sidebar | Tabs | Karte |
  |---|---|---|---|
  | DealPilot (kein Attribut) | `0,0,0` | `10,8,5` | Verlauf, unverändert |
  | Kontor | `255,255,255` | `255,255,255` | `#FFFFFF` |
  | Panel | `255,255,255` | `255,255,255` | `#FFFFFF` |
  | Kanzlei | `251,250,247` | `251,250,247` | `#FFFFFF` |
  | Boarding | `250,245,232` | `250,245,232` | Creme |
  | Konsole | `22,24,28` | `22,24,28` | `#1A1D22` |

  Kontrastlauf über Objektkarte in allen sechs: **keine Stelle unter 2.5**.
  Alle Vorlagen auch bei **390 px und 820 px** gemessen, kein waagerechter
  Überlauf (`scrollWidth == innerWidth`). Panel auf dem Handy als Blatt von
  unten (390 × 658), keine Trefferfläche unter 44 px. Persistenz überlebt
  das Neuladen (alle drei Attribute), Inline-Boot im `<head>` verhindert das
  Aufblitzen.

  **Die wichtigste Zusicherung, ausdrücklich nachgemessen:** Nach
  „Zurücksetzen" sind alle drei Attribute `null` — **entfernt, nicht leer
  gesetzt** — und der Istzustand ist bitgenau zurück: Sidebar `rgb(0,0,0)`,
  Tabs `rgb(10,8,5)`, Karte transparent mit dem originalen Verlauf. Wer nicht
  umschaltet, merkt von diesem Paket nichts.

  **Punkt 6 teilweise:** Die Partner-Schranke ist von „Panel öffnen"
  (`settings.js:3395`, brach für jeden außer Partner ab) auf die
  **Farbsektion** gewandert. Vorlagen wählen darf jeder, Farben ab Partner,
  die Sektion bleibt sichtbar und ausgegraut — geprüft: `locked=true` ohne
  Partner-Plan, Hinweisleiste sichtbar.

  **Zu `gold-audit.py`:** Der Lauf stand vorher auf RC=1 mit **483**
  Fundstellen (Altlast in 56 Dateien). v1082 brachte **sieben neue** — meine
  eigene Vorgabe verletzt. Mit v1082f auf **eine** reduziert: der Fokusring
  auf `color-mix(… var(--wl-c9a84c, #C9A84C) …)`, die sechs Vorgabewerte auf
  eine Konstante `GOLD_STD`. Die bleibt bewusst ein rohes Literal — sie ist
  ein *Daten*wert: `var(--wl-…)` und `_wlc()` liefern beide den bereits
  umgefärbten Ton, genau den, den man ersetzen will. Stand jetzt **484**.
  RC=0 insgesamt ist ein eigenes Vorhaben.

  **Nachbesserung nach Marcels Bildern (`v1082g`–`v1082k`, `4e3f050`,
  `5261fcf`, `ada1638`, `cc87747`, `b58a289`):** Der Screenshot zeigte, dass
  die Wallet-Karten die halbe Karte zudeckten. Vier Ursachen, alle aus
  **einem** Fehler — ich hatte die Regeln aus dem Mockup übernommen, statt
  die echte Struktur auszulesen:

  | Was | Warum |
  |---|---|
  | Investor-Ribbon abgeschnitten | `overflow:hidden` auf der Karte — das Ribbon sitzt gemessen bei `top:-7px` und ragt absichtlich hinaus |
  | Foto, Preis, Kacheln fehlten | das `::before` lag mit `inset:0` über der **ganzen** `.sbc-top`; im Mockup deckt es nur zwei Rasterzeilen |
  | Foto 130 px statt 64 | Rasterzellen strecken ihren Inhalt per Voreinstellung |
  | Stufen-Pille über der Objektnummer | `.sbc-score-label` ist `display:block` mit `margin-top`, und `align-items` allein reichte nicht — Richtung und Umbruch mussten ausdrücklich gesetzt werden |

  **Der Grund, warum Abschreiben hier scheitern musste:** Im Mockup liegt
  `.sbc-score-overlay` **innerhalb** `.sbc-top`. In der echten App ist es ein
  **direktes Kind der Karte** und absolut positioniert. Genau die Stelle war
  nicht übertragbar — „übernommen wird die Gestaltung, nicht der Code".

  Dazu ein fünfter, eigenständiger Fehler: **„Kompakt" sparte nur 10 px**
  (198 gegen 208). Die Regel zielte auf `.sbc-mini-grid`, den **Behälter** —
  die Höhe steckt aber in den **Kacheln** `.sbcm` (67 von 77 px). CLAUDE.md
  nennt beide ausdrücklich getrennt; ich hatte das eine für das andere
  genommen.

  **Nachgemessen (Wallet, angemeldet, echte Objekte):** Band 53 px, Ring
  links (x 9), Score-Zahl lesbar, Nummer und Datum auf Gold, Pille rechts am
  Bandende, Foto 64 × 64 ohne Überlappung, Preis und alle drei Kacheln
  sichtbar, Investor-Ribbon ragt wie vorgesehen hinaus.
  Kartenhöhen: **Kompakt 171 · Standard 211 · Wallet 247 px** — die drei
  Modi unterscheiden sich jetzt sichtbar.

  **Nicht gebaut, bewusst:** die Kopplung von Skin-Schalter und Vorlage.
  Beide greifen gleichzeitig, die Vorlage gewinnt (Spezifität), aber es sind
  zwei Mechaniken für dieselbe Frage. Steht jetzt als eigener Punkt 3 —
  das ist eine Produktentscheidung, keine Reparatur.

- [2026-08-05] **Partner-Plan wurde von fünf Pro-Schranken ausgesperrt** — `f96e981`

  Nebenbefund aus der Diagnose zu Punkt 1, aber ein eigenständiger Fehler und
  deutlich größer als der Anlass.

  **Befund (gemessen an der DB, nicht angenommen):** Die `plans`-Tabelle führt
  **sieben** Pläne (`free starter investor pro partner business enterprise`),
  `PRICING` in `config.js` kennt **vier** (`free starter investor pro`).
  `partner` fehlt dort *bewusst* — `reseller-portal.js:568` spritzt ihn
  nachträglich ein und **klont dabei die Pro-Features** („Partner ist ein
  erweiterter Pro"). `pricing.plans` ist dieselbe Referenz wie `PRICING`,
  deshalb liefert `currentKey()` danach korrekt `'partner'`.

  **Fünf Stellen verglichen trotzdem hart auf `currentKey() === 'pro'`** und
  sperrten damit ausgerechnet den **höheren** Plan aus:

  | Datei | Was dem Partner fehlte |
  |---|---|
  | `netzwerk-einreichung.js:26` | Teaser „Pro freischalten" statt Einreichungsformular |
  | `deal-action.js:60` | Deal-Aktion-Konfiguration |
  | `apikeys.js:12` | API-Zugang — obwohl `api_access` in der DB-Zeile `true` ist |
  | `settings.js:1360` | Branding-Routing |
  | `config.js:846` | Farbpalette (`_isPalette`) |

  `settings.js:3164` und `:3247` machen es richtig
  (`(k==='pro'||k==='partner')`) — das war die Vorlage. `settings.js:3392`
  prüft sogar auf `!== 'partner'` und funktioniert nur, weil
  `reseller-portal.js` vorher einspritzt. Es waren also zwei Muster im Umlauf.

  Auf Staging betrifft das **2 aktive Partner-Abos** — der teuerste Plan.

  **Fix (v1081):** eine Quelle statt fünf Vergleichen. Neu
  `DealPilotConfig.pricing.isProOrAbove()` mit der Liste `PRO_FAMILIE` in
  `config.js`; alle fünf Stellen darauf umgestellt, jede mit Inline-Rückfall
  auf `(k==='pro'||k==='partner')`, falls `config.js` einmal älter ausgeliefert
  wird. `config` TR8→TR9, `apikeys` 810→811, `settings` W22→W23,
  `deal-action` W33→W34, `netzwerk-einreichung` 893p→v1081.

  **Nachgemessen auf Staging:** `Sub.getCurrentSync()` der Reihe nach auf jeden
  Plan gestellt — `free`/`starter`/`investor` → `false`, `pro`/`partner` →
  **`true`**. `pricing.plans` enthält alle fünf Schlüssel. `node --check` auf
  allen fünf Dateien sauber.

  **Nicht bewiesen:** dass das die Ursache von Punkt 1 ist. Die
  Einreichungsstrecke, die hier am sichtbarsten betroffen wäre, ist per
  `v893p-off` ohnehin abgeschaltet. Der Fix steht für sich.

- [2026-08-05] **Logo-Rahmen auf flachen Viewports, Ausrichtungs-Regler wieder wirksam** — `a4b1291`

  Nachtrag zu v1079 (rahmenlose Wortmarke + gezeichneter Goldrahmen). Die
  **Gestaltung bleibt unangetastet**, nur die Größe hängt jetzt am Viewport.

  **Befund (gemessen auf Staging, gleich-Origin-iframe, Drawer offen):**

  | Viewport | `.sb-header` | Rahmen | Bild |
  |---|---|---|---|
  | 390 × 844 | 116 | 296 × 78 | 260 × 48 |
  | 390 × 556 | **108** | 296 × 78 | 260 × 48 |
  | 390 × 476 | **108** | 296 × 78 | 260 × 48 |
  | 820 × 1180 | 121 | 323 × 83 | 287 × 53 |
  | 1024 × 768 | 104 | 213 × 62 | 177 × 32 |
  | 1440 × 900 | 125 | 323 × 83 | 287 × 53 |

  Kein waagerechter Überlauf in irgendeiner Fassung, eingeklappte Leiste
  unverändert (66 px, Logo `display:none`, „D"/„P" aus `::before`/`::after`,
  **kein** Goldrahmen), Hellmodus zieht den schwarzen Kasten aus CSS.

  **Zwei Fehler in den Zeilen dazwischen:**
  1. `--dp-logo-max` (v646) ist **tot**. Der Deckel saß auf dem *Bild*; die
     gleichnamige v1079-Regel am Dateiende setzt `max-width:100%` und gewinnt
     bei gleicher Spezifität als spätere. Deshalb blieb der Kopf auf flachen
     Viewports bei 108 px stehen, statt weiter nachzugeben — bei 476 px Höhe
     ein knappes Viertel des Schirms. Der Deckel gehört seit v1079 ohnehin
     nicht mehr aufs Bild: das Bild füllt den Rahmen, ein gedeckeltes Bild
     würde darin schwimmen. Jetzt schrumpft der **Rahmen**, das Bild folgt.
  2. `justify-content` stand in v1079 fest auf `center` und hat den
     **Ausrichtungs-Regler** (`--dp-logo-justify`, `settings.js:3328`) still
     totgelegt. Gemessen: `flex-start` gesetzt, computed blieb `center`.

  **Nachgemessen auf Staging (W49):** 390 × 556 → `.sb-header` **81 px**
  (vorher 108), Liste 327 → **354 px** · 390 × 476 → **66 px** (vorher 108),
  Liste 247 → **289 px**. 390 × 844, 820, 1024, 1440 unverändert.
  Ausrichtung: `flex-start` → Bild bei 18 px vom Rahmenrand, `flex-end` → 133 px.
  Größen-Regler weiter wirksam (60 % → 106 statt 177 px).

- [2026-08-04] **Sidebar-Fußzeile auf dem Handy sichtbar machen** — `159f6c0`

  **Befund (gemessen, beide Verdachtsmomente widerlegt):** `#sb-user` wird
  sauber gerendert, `[V245]` meldet Erfolg — der Abbruchpfad in `auth.js:495`
  war es nicht. Die Liste war seit v639 bereits auf `40vh` gedeckelt und
  scrollte selbst — das `overflow:visible` aus v622 greift also nicht mehr.

  Die Ursache lag darüber: über dem Nutzerblock stehen ausschließlich **feste
  Höhen** — `.sb-header` 201 px + `.sb-section-title` 64 px +
  `.sb-actions-trigger` 36 px + `#sb-user` 81 px = 382 px, dazu die Liste mit
  40 vh. Bedingung fürs Hineinpassen: `0,4·vh + 382 ≤ vh`, also **vh ≥ 637 px**.
  Gemessen bei 390 px Breite: 696 px sichtbar · 660 px 3 px ab · 616 px 29 px
  ab · 556 px 65 px ab. Genau der iPhone-Safari-Bereich — auf dem Desktop mit
  844 px Höhe war nie etwas zu sehen.

  **Fix (v645, `style.css` W38→W39):** Die Liste bekommt den Restplatz
  (`flex:1 1 auto`, `min-height:72px`) statt der festen 40 vh, Trigger und
  Nutzerblock werden unten verankert und dürfen nicht schrumpfen. Nur ≤ 768 px
  und nur im geöffneten Drawer.

  **Nachgemessen auf Staging (W39):** bei 844/700/664/620/560/476 px Höhe
  durchgehend `abgeschnitten = 0 px`, Abmelden per `elementFromPoint`
  getroffen, Liste scrollt in sich. Tablet 820 px und Desktop 1024/1200 px
  unverändert.

  **Offen daneben:** Trefferfläche der Icon-Knöpfe ist 34 × 44 px — die Breite
  liegt unter den 44 px aus Punkt 2, gehört dorthin. Der Logo-Header frisst mit
  201 px weiter ein Drittel des Handy-Viewports (Optik, nicht angefasst).

- [2026-08-04] **Neues Logo einsetzen, altes entfernen** — `7a86e7b`, `56a9c04`

  **Befund (gemessen, nicht angenommen):** Der Logo-Kopf war **207 px** bei
  390 px Viewport und **221 px** auf dem Desktop. Zwei Ursachen: das alte PNG
  hat Seitenverhältnis **2,18 : 1**, und `.app-logo-simple-sidebar` stand auf
  `width:100%` ohne Deckel (v931/v932/v937, alle mit `!important`) — das Logo
  wuchs also mit jeder Leistenbreite und riss den Kopf mit hoch.

  Zweiter Befund, beim Prüfen aufgefallen: `settings.js:3309` (v931)
  **überschreibt** `_dpDispSkin` aus `:3104` und lässt den Logo-Tausch bewusst
  weg („KEIN Logo-Tausch mehr"). Mit dem neuen Rahmen-Logo geht das nicht mehr
  — dessen Wortmarke „Deal" ist **weiß**, auf hellem Grund wäre die halbe
  Marke unsichtbar.

  **Fix (v646, `style.css` W39→W40, `settings.js` W20→W22, `config.js` TR7→TR8):**
  Neue Dateien `assets/dealpilot-logo-rahmen.png` (dunkler Grund) und
  `assets/dealpilot-logo-rahmen-hell.png` (heller Grund), Seitenverhältnis
  **3,18 : 1**. Dazu ein Breitendeckel (232 px Desktop · 220 px ≤ 900 px ·
  176 px bei ≤ 620 px Höhe) — der hält nebenbei das 512-px-Asset auf ≥ 2× für
  Retina. Spezifität `body:not(.dp-sidebar-collapsed) aside.sidebar#sidebar`,
  damit die späteren `!important`-Blöcke nicht gewinnen; die eingeklappte
  Leiste ist ausgenommen und behält die DP-Bildmarke aus v610.

  Der Logo-Tausch entscheidet jetzt **nach gemessener Hintergrundhelligkeit**
  (`getComputedStyle` die Elternkette hoch bis zur ersten deckenden Farbe)
  statt nach Klassen — greift damit auch bei frei gewählter Kopfleistenfarbe.
  Eigenes Upload-Logo und Whitelabel-Logo bleiben unangetastet.

  **Nachgemessen auf Staging (W40):** `.sb-header` 390 px → **87 px**
  (vorher 207), 820 px → **84 px**, 1024 px → **88 px**, 390 × 556 px →
  **65 px** und Nutzerblock weiterhin `abgeschnitten = 0 px`. Objektliste
  wächst bei 390 px von 439 auf **559 px**. Eingeklappt unverändert
  (Logo `display:none`, DP-Badge da, Leiste 66 px). Heller Kopf lädt
  `-hell.png`, dunkler `-rahmen.png` — beides im Browser geprüft.

  Alte Dateien `dealpilot-logo-app.png` und `dealpilot-logo-app-light.png`
  entfernt; es verwiesen nur noch zwei Kommentare darauf.
  `dealpilot-logo.png` (Landing, PDFs) unangetastet.

- [2026-08-04] **Aktionen-Akkordeon klappt in die falsche Richtung** — `983d681`, `69996ee`

  **Befund — der Verdacht war falsch, ich nehme ihn ausdrücklich zurück.**
  Gemessen bei 390 × 844 mit offenem Drawer: das Panel klappt sehr wohl
  **nach oben** — `top 58`, Inhalt bis `591`, Trigger erst bei `709`.
  Ebenso bei 820 px und auf dem Desktop (1400 × 730 und 1400 × 520). Der
  Pfeil dreht sich auch bereits (`[aria-expanded="true"] → rotate(180deg)`,
  `style.css:11599`). Das hatten v642/v644 schon erledigt, nur stand es
  nicht im Backlog.

  **Der echte Fehler lag darunter:** eine **114 px hohe Totzone** zwischen
  dem Ende des sichtbaren Menüs (591) und dem Ende des Kastens (705).
  `elementFromPoint(180, 621)` lieferte dort `#sb-actions-accordion` statt
  der Objektliste. Klicks versandeten, und das Menü schloss dabei nicht
  einmal — `_sbActionsOutsideClick` überspringt alles, was in `acc` liegt.

  **Ursache:** `sbActionsToggle()` setzte `bottom` inline **mit
  `important`** (V73-fix). Inline-`!important` schlägt jede
  Stylesheet-Regel, also auch das `bottom:auto !important` aus v642, das im
  Drawer den Fixed-Overlay-Modus herstellt. Damit galten gleichzeitig
  `top:58px` **und** `bottom:139,5px` auf einem `fixed`-Element mit
  `height:auto` → Box auf 647 px gestreckt, Inhalt 533 px.

  **Zweiter Befund:** der CSS-Deckel `calc(100dvh - 58px - 110px)` ist
  geraten. Bei 390 × 556 endete das Menü bei 446 px, der Trigger begann
  aber schon bei 409 px — 37 px Überlappung.

  **Fix (v647, `ui.js` 972b→973b):** Neues `_sbActionsDock()` entscheidet
  nach `getComputedStyle().position`. `absolute` (Desktop, Tablet): `bottom`
  wie bisher an den Trigger andocken. `fixed` (Drawer ≤ 768 px): kein
  Inline-`bottom`, stattdessen `max-height` aus der **gemessenen**
  Trigger-Oberkante minus 8 px Spalt. `static` (eingeklappte Leiste): beides
  weg, das CSS macht die Position. Dazu Neuberechnung bei `resize`.

  **Nachgemessen auf Staging (973b):** Überhang **0 px** in allen Fassungen.
  390 × 844: Menü 58–591, Trigger 697. 390 × 556: Menü 58–401, Trigger 409,
  scrollt in sich. 1400 × 520: 15–385, Trigger 389, scrollt. 820 × 1180:
  528–981, Trigger 985. Klick unter dem Menü trifft wieder `#sb-list`,
  Objektwahl schließt das Menü, Pfeil steht auf `rotate(180deg)`.

  **Nebenbefund, noch offen:** `css/ui-varianten.css` und `js/ui-varianten.js`
  sind in `index.html` (Z. 29 und 3466) verlinkt, existieren aber weder im
  Repo noch auf dem Server — zwei 404 bei jedem Seitenaufruf.

- [2026-08-04] **Objektliste auf dem Tablet erreichbar machen** — `6bffd55`, `dfcea21`

  **Befund — deutlich schlimmer als angenommen.** Es war nicht „die Liste ist
  unerreichbar", sondern **die ganze App war im Band 769–1024 px eine leere
  Seite.** Gemessen:

  | Viewport | `.app-wrap` Spalten | `#sidebar` | `.main-col` oben |
  |---|---|---|---|
  | 820 × 1180 | `820px` (**eine**) | `relative`, `translateX(-240px)`, Höhe 1180 | **1180** |
  | 1024 × 768 | `1024px` (**eine**) | dito | **768** |
  | 1025 × 768 | `380px 645px` | `relative`, sichtbar | 0 |

  Der Inhalt begann also eine **volle Bildschirmhöhe unter dem Falz**.
  Damit ist auch die Backlog-Annahme „bei 901–1024 px steht die Leiste als
  feste Spalte" widerlegt — dort war es genauso kaputt.

  **Ursache, drei Regeln, die sich gegenseitig aushebeln:**
  1. `@media (max-width:1024px) .app-wrap{grid-template-columns:1fr}` —
     Leiste und Inhalt stapeln sich untereinander.
  2. `@media (max-width:1024px) .sidebar{position:fixed}` sollte die Leiste
     aus dem Fluss nehmen, wird aber von der **späteren, medienlosen**
     Regel `aside.sidebar{position:relative}` geschlagen: (0,1,1) gegen
     (0,1,0). **Eine Media-Query erhöht die Spezifität nicht.**
  3. Nur unter 768 px zieht v622 mit `body #sidebar.sidebar
     {position:fixed !important}` (1,2,1) den Kopf aus der Schlinge —
     deshalb lief das Handy und das Tablet nicht.

  **Vierter Befund:** `@media (max-width:1024px) .body{margin-left:240px
  !important}`, ein Rest aus der Zeit der fixen 240-px-Leiste. Bei 1024 px
  begann `.body` dadurch bei 500 statt 260 und war 519 statt 764 px breit.
  Unter 768 px war das längst zurückgenommen, im Band dazwischen nicht.

  **Fix (v648, `style.css` W40→W42, `ui.js` 973b→974, `main.js` 950→951):**
  - **769–900 px** bekommt den vorhandenen v622-Drawer. Statt ihn zu doppeln,
    wandern die Media-Queries der Drawer-Blöcke v622 · v625 · v633 · v637 ·
    v638 · v639 · v642 · v645 von 768 auf **900 px**.
  - **901–1024 px** bekommt den neuen Block `v648-tablet-shell`: echte zwei
    Spalten (`260px minmax(0,1fr)`), Leiste `sticky` im Fluss, keine
    Drawer-Bedienelemente, kein Backdrop.
  - `.body`-Randabzug im ganzen Band auf 0.

  **Vier Umschalt-Mechaniken auf eine reduziert** (der „Später"-Punkt ist
  damit miterledigt):
  - `ui.js:1751 toggleMobileSidebar` gelöscht — setzte `.sb-mobile-open` auf
    `#sidebar` statt `.app-wrap` und war ohnehin wirkungslos, weil `main.js`
    danach lädt und neu definiert. Genau so entstanden die vier Mechaniken.
  - `.mobile-hamburger` aus dem Markup — in jedem Band `display:none`.
  - `#mobile-overlay` aus dem Markup — Backdrop ist `#sb-backdrop`.
  - `.sidebar.open`-Regel entfernt — keine Zeile setzt die Klasse.
  - `drawer-fix-20260731` zurückgenommen — setzte `left:0` auf ein Element,
    das per `transform` verschoben wird, und blendete den toten Hamburger ein.
  - Schwellen 768 → 900 in `main.js` (resize-Reset) und `ui.js`
    (`closeMobileSidebarOnAction`).

  **Nachgemessen auf Staging (W42):**
  390 × 844 unverändert (Inhalt oben, Drawer auf/zu, Aktionen-Menü ohne
  Überhang) · 820 × 1180 Inhalt bei `top 0`, Drawer mehrfach auf/zu, Backdrop
  greift, kein waagerechtes Scrollen · 901 × 800 und 1024 × 768 zwei Spalten
  `260px + 641/764px`, Hamburger aus, `.body` bündig · 1440 × 800 unverändert
  `380px + 1060px`.

- [2026-08-04] **Kopfleiste auf dem Handy entlasten** — `15c197a`

  **Befund (gemessen, 390 × 844, Objekt Dealstreet 999 geladen):**
  `header.hdr` war **385 × 279 px** — ein volles Drittel des Viewports, bevor
  ein Formularfeld sichtbar wurde. `.hdr-v61-row1` brach auf **drei** Zeilen
  um (151 px): Hamburger 32 × 44 + Kürzel-Chip 73 × 27 + Name 222 × 22 /
  Autosave 127 × 25 + Feldanzeige 198 × 27 / Kerosin-Pille 107 × 44.
  Darunter `#hdr-badges` mit **128 px** Score-Karte.

  **Fix (v649, `style.css` W42→W43), nur ≤ 768 px:**
  Kürzel-Chip und Trenner raus · Objektname `flex:1 1 auto` mit
  Auslassungspunkten · Autosave nur noch der Punkt · Kerosin ohne Balken ·
  Feldfortschritt über `order:99` + `flex:1 0 100%` in eine **eigene schmale
  Zeile** umgebrochen, ganz ohne Markup-Änderung · Investor Deal Score aus
  (`#hdr-badges > *:not(.hdr-incomplete-banner)`) — der Hinweis „bitte 70 %
  ausfüllen" bleibt, das ist eine Handlungsaufforderung und keine Kennzahl.

  **Nachgemessen auf Staging (W43):** `header.hdr` 390 px → **76 px**
  (279 vorher). Eine Zeile: Hamburger · Objektname 224 px lesbar ·
  Autosave-Punkt · „37 L". Darunter 17 px Fortschrittszeile
  „24 / 24 Felder · 100 %". Tablet 820 px unverändert.

  **Nebenbefund, offen:** Auf 820 px ist die Kopfleiste **589 px** hoch —
  `#hdr-badges` allein 492 px, weil die fünf KPI-Pillen dort zu je zwei
  nebeneinander umbrechen. Der Backlog will den Score auf dem Tablet
  behalten, deshalb nicht angefasst. Gehört zu „Tablet-Fassung feinziehen".

- [2026-08-04] **Alle neun Objekt-Tabs handytauglich** — `366285e`, `f3aa78b`, `0677c88`, `2464cac`, `6b1d14f`, `0183da0`

  **Befund (gemessen bei 390 × 844, Objekt geladen, Tab für Tab durchgeklickt):**

  Kein Tab hatte waagerechtes **Seiten**-Scrollen — `documentElement.scrollWidth`
  war überall gleich `innerWidth`. Der Inhalt lief aber trotzdem über den
  rechten Rand hinaus und wurde still abgeschnitten:

  | Tab | Element | rechte Kante |
  |---|---|---|
  | Objekt | `.qz-label` | 553 |
  | Miete | `#ki-miete-box` | 394 |
  | Finanzierung | `.dpfk-ctrl` / `.dpfk-ltv` | **606** (`.body` 193 px über) |
  | Finanzierung | `.mrpf-top-tile` | 578 |
  | Steuer | `.fa-pdf-ctrl` | 537 |
  | Bewertung | `table.kpi-eval-table` | 562 |
  | Bewertung | `.cf-mode-btns` | 490 |

  Dazu **240 Eingabefelder mit 12,5 px bzw. 13,3 px** Schrift — iOS Safari
  zoomt bei jedem Antippen hinein, sobald ein Feld unter 16 px liegt. Und
  **19 Knopfarten unter 44 px** Trefferfläche, darunter die im Backlog
  vermerkten Seitenleisten-Icons.

  **Drei getrennte Ursachen, nicht eine:**
  1. **`min-width:auto` auf Rasterkindern** — die Voreinstellung. Ein breites
     Enkelkind schiebt die ganze Spalte auf. `#ki-miete-box` war dadurch
     368 px breit in einer 333-px-Spalte. Sammelfall hinter mehreren Zeilen
     der Tabelle.
  2. **`flex: 1 1 0%` beim Konditionsband.** `.dpfk-band` bricht um (333 px),
     `.dpfk-stub` belegt davon 331 px. Weil die Flex-Basis **0** ist, passt
     `.dpfk-body` rechnerisch noch auf dieselbe Zeile — es bekommt 0 px
     Breite und der Inhalt läuft bis 606 px hinaus, statt umzubrechen.
     Flex-Basis 100 % erzwingt die eigene Zeile.
  3. **`grid-template-columns:170px 1fr auto !important` ohne Media-Query**
     (`style.css:9421`) schlug den Mobilblock bei ≤ 720 px, der kein
     `!important` trägt. Mit `.qz-label{min-width:200px !important}` ergab
     das 553 px auf einem 390-px-Schirm.

  **Fix (v650, `style.css` W43→W44f), nur ≤ 768 px:**
  - Alle Textfelder, Auswahlfelder und Textbereiche auf **16 px**. Zwei
    Auswahlfelder blieben zunächst auf 13 px — `#d1_type,#d2_type` sind mit
    **ID-Spezifität** (1,0,0) und `!important` gesetzt, `.body select`
    (0,2,1) verliert dagegen. Mit der ID im Selektor sitzt es.
  - Trefferflächen: unsichtbares `::after` mit `max(100%,44px)` legt die
    Fläche auf 44 × 44, ohne die Optik zu ändern. Wo Höhe wachsen darf
    (Akkordeon-Zeilen, Aktionen-Trigger), stattdessen `min-height`.
  - `:active`-Rückmeldung für alle Knopfarten unter `@media (hover:none)` —
    auf Touch gibt es kein Hover, ohne Rückmeldung wirkt jeder Tipp folgenlos.
  - Kurze Paare nebeneinander: das Adressraster wird zu vier Spalten,
    PLZ spannt 1, Ort 3, Straße 3, Hausnummer 1, alles andere volle Breite.
    Ohne `:has()`-Unterstützung fällt es sauber auf eine Spalte zurück.
  - Die KPI-Tabelle ist mit 535 px **echt** breiter als der Schirm. Sie wird
    nicht gequetscht, sondern bekommt einen eigenen Scroller **mit sichtbarem
    Verlaufs-Hinweis** am rechten Rand.
  - BMF-Modal: `.bmfmo-tabs` war 325 px breit bei `scrollWidth` 549 und
    `flex-wrap:nowrap` — der vierte Reiter war nicht erreichbar. Jetzt
    waagerecht scrollend mit Snap, wie die Haupt-Tab-Leiste.

  **Nachgemessen auf Staging (W44f), Tab für Tab:**

  | Tab | Seiten-Scroll | `.body`-Scroll | Überlauf |
  |---|---|---|---|
  | Objekt | 0 | 0 | keiner |
  | Investition | 0 | 0 | keiner |
  | Miete | 0 | 0 | keiner |
  | Finanzierung | 0 | 0 | keiner |
  | Bewirtschaftung | 0 | 0 | keiner |
  | Steuer | 0 | 0 | keiner |
  | Pilot-Analyse | 0 | 0 | keiner |
  | Bewertung | 0 | 0 | keiner |
  | Deal-Aktion | 0 | 0 | keiner |

  Eingabefelder: **187 × 16 px**, kein Feld mehr darunter (der einzige Rest
  ist `input[type=range]`, bei dem iOS nicht zoomt). Trefferflächen: keine
  unter 44 px mehr. Adressraster gemessen: PLZ 68 px + Ort 225 px in einer
  Zeile, Straße 225 px + Hausnummer 68 px in der nächsten, alles andere
  303 px voll. BMF-Modal 374 × 793 in 390 × 844, Reiter scrollen, Rumpf
  scrollt.

  **Nicht gebaut, bewusst:** die Raster-Übersicht als Ausweg für die neun
  Reiter. Die Tab-Leiste hat bereits `scroll-snap-type:x` mit
  `scroll-snap-align:start` und Reiter von 73 × 44 px — sie funktioniert
  gemessen. Eine zweite Navigationsform daneben wäre eine Produktentscheidung,
  keine Reparatur.

- [2026-08-04] **Portfolio-Cockpit auf Handy und Tablet** — `ac0a0b8`, `6afb7a5`

  **Befund — die Ursache war ein Parserfehler, kein fehlendes Responsive-CSS.**
  `dashboard.css:431` stand als

  ```
  #dashboard-main .pick, #dashboard-main @media(max-width:880px){ … }
  ```

  — eine `@media`-Regel **mitten in einer Selektorliste**. Der Parser
  verwirft den kompletten Block. Nachgewiesen im Browser: `cssRules` von
  `dashboard.css` enthielt 351 Regeln und genau diesen
  `(max-width:880px)`-Block **nicht**, während die drei anderen
  880er-Blöcke (Z. 500 / 581 / 610) da waren. Entstanden ist es beim
  nachträglichen Voranstellen von `#dashboard-main` vor alle Selektoren.

  Damit war die ganze Mobilfassung des Cockpits tot. Gemessen bei 390 px:

  | Element | soll | war |
  |---|---|---|
  | `.gates` (Kanban) | 1 Spalte | `344px 103px 99px` = 545 px in 353 px, Spalten bis **590** |
  | `.kpis` | 2 Spalten | 4 Spalten à 79 px |
  | `.charts` | 1 Spalte | 2 Spalten, Diagramm bis **560** |

  `.pick` kommt weder im Markup noch sonst im Stylesheet vor — beim
  Reparieren geht nichts verloren.

  **Fix (v651, `dashboard.css` W34→W35):** Block als sauberes
  `@media(max-width:880px)` mit `#dashboard-main`-Präfix wiederhergestellt.
  Dazu ein v651-Block für die Reste: Diagramme und Canvas auf
  `max-width:100%`, Abschnittskopfzeilen umbrechend (`#dp-proj-years` lief
  bis 393), Übersichtskacheln zweispaltig, Tabellenbereiche waagerecht
  scrollbar.

  **Nebenbefund, betrifft nicht nur Mobil — und war der schwerere:**
  Der Boarding-Pass `#oab-bar` trägt seit v593 `overflow:hidden` und seit
  v578 `flex-wrap:nowrap`, sein Inhalt ist rund **1240 px** breit.

  | Viewport | sichtbar | Inhalt | Folge |
  |---|---|---|---|
  | 390 px | — | — | v619 stapelt, alles erreichbar |
  | 820 px | 747 | 1208 | abgeschnitten |
  | 1024 px | 691 | 1208 | abgeschnitten |
  | **1440 px** | 1015 | 1240 | abgeschnitten, `#oab-run` bei x 1485–1587 |

  Der Startknopf „Abrufen" der PRE-FLIGHT-Strecke war damit auf **jedem
  Schirm unter rund 1620 px** unerreichbar — auch auf einem normalen
  Notebook mit 1366 oder 1440 px. Jetzt (v651b) waagerecht scrollbar mit
  Snap und einem Verlauf am rechten Rand als Hinweis; wo der Inhalt passt,
  ändert sich nichts.

  **Nachgemessen auf Staging (W45 / dashboard W35):**
  Cockpit bei 390 px, 820 px und 1024 px — **kein** Überlauf, kein
  Seiten-Scrollen. Objekt-Ansicht ebenso; `#oab-bar` erscheint jetzt als
  echter Scroller (747 / 1208 bei 820 px), und bei 1024 px liegt
  `#oab-run` nach dem Scrollen bei x 830–932, also **im Bild**.

  **Nicht geprüft:** die Tabelle der geteilten Pässe war im Testkonto leer.
  Die Scroll-Regel dafür steht, der Nachweis fehlt.

- [2026-08-04] **Marktbericht auf Handy und Tablet** — `e669327`, `e9a4d7b`

  Eigener Namensraum **v1077 (Marktbericht)**, nichts mit der Haupt-App
  gemischt.

  **Befund Eingabestrecke (gemessen bei 390 × 844, dieselbe Strecke, die
  im iframe der App läuft):** kein waagerechter Überlauf — v620 sitzt.
  Aber **54 Eingabefelder auf 15 px** und eines auf 13 px → iOS Safari
  zoomt bei jedem Antippen hinein. Und drei Knöpfe unter 44 px:
  `.mbrep-tog` 70 × 26, `#saveFileBtn` und `#loadFileBtn` je 150 × 32.

  **Befund fertiger Bericht (an einem gespeicherten Bericht gemessen, ohne
  neuen Kerosin-Abruf):** `body.scrollWidth` **639** statt 375. Vier
  Stellen, alle derselbe Fall — ein Rasterkind mit `min-width:auto` zieht
  die Spur auf:

  | Element | war |
  |---|---|
  | `.grid` | Spur 646 px statt 347 |
  | `#addrAC` (Vorschlagsliste am `body`) | 602 px breit |
  | `#microGrid` | zwei Spalten 238 + 354 = **592** in 305 px |
  | `.wv-g` | drei Spalten 153 + 140 + 110 = **402** in 305 px |

  **Befund Karte:** Leaflet zieht per Voreinstellung schon mit **einem**
  Finger. In einer 3 200 px langen Berichtsseite heißt das: wer beim
  Scrollen die Karte trifft, bleibt darin hängen.

  **Fix (v1077, `marktbericht-app` 1076→1077b):**
  Neuer Block `v1077-mb-touch` bei ≤ 768 px — Felder auf 16 px,
  Trefferflächen auf 44 px, Karte auf 60 vh mit 40-px-Zoomknöpfen,
  Diagramme und Tabellen auch **oberhalb** 560 px begrenzt (v620 deckte
  nur ≤ 560 ab), Klappblöcke v1075/v1076 umbrechend, dazu die vier
  Raster-Stellen des fertigen Berichts.
  Karte: ein Finger scrollt die Seite, **zwei** Finger bewegen und zoomen,
  mit kurzem Hinweis beim Ein-Finger-Versuch — nur auf Zeigern ohne Hover,
  auf Maus und Trackpad bleibt alles wie gehabt. Kneifen zum Zoomen bleibt
  in jedem Fall an. Keine Farbwerte angefasst (`var()` greift in Leaflet
  nicht).

  **Nachgemessen auf Staging (1077b), fertiger Bericht bei 390 px:**
  `docScroll = 0`, `body.scrollWidth = 375 = clientWidth`, **kein**
  Element über dem rechten Rand. Bericht 3 194 px hoch, Karte 420 px,
  PDF-Knopf 44 px hoch. `#microGrid` und `.wv-g` einspaltig (305 px).
  Eingabestrecke: kein Feld mehr unter 16 px, kein Ziel mehr unter 44 px.

  **Staging-Abnahmepunkte — hier ehrlich offen:**
  1. **PDF-Erzeugung.** Der Knopf steht und ist 44 px hoch, ein echter
     Klick lädt eine Datei herunter — das habe ich nicht ausgelöst.
  2. **Zwei-Finger-Geste auf der Karte.** Der Pfad hängt an
     `matchMedia('(hover:none)')` und greift deshalb im Prüfbrowser nicht.
     Die Regeln sind gemessen (`#map` steht auf `touch-action:pan-y`, der
     Hinweis auf `position:absolute; z-index:1000`), die Geste selbst
     gehört auf ein echtes Telefon.
  3. **Erzeugen eines neuen Berichts bei 390 px.** Bewusst nicht erzwungen:
     der Lauf kostet 5 L Kerosin und hängt an einem `window.confirm`, das
     die Browser-Steuerung blockiert. Geprüft wurde stattdessen ein
     bereits gespeicherter Bericht — dieselbe Renderstrecke, gleiche
     Darstellung.

- [2026-08-04] **Übrige Seiten und Bereiche** — `30d1d69`, `6069a7a`, `a3651c9`, `60c0b80`

  **Befund (gemessen bei 390 × 844, Bereich für Bereich durchgeklickt):**
  Waagerechter Überlauf gab es fast nirgends mehr — die Sammelursachen
  hatte v650 schon erledigt. Übrig blieben Felder unter 16 px und Knöpfe
  unter 44 px, und die sitzen alle **außerhalb von `.body`**, weshalb der
  v650-Block sie nicht erwischt hat:

  | Bereich | Befund |
  |---|---|
  | Alle Objekte · Track Record · Bankexport · Quick Check | `#sb-search-input` **12,5 px** |
  | Einstellungen, alle 11 Abschnitte | `set_user_*`, `set_pwd_*`, `dp-ec-*` u. a. **13 px**; `.set-modal-close` und `.help-sidebar-item` unter 44 px |
  | Anmeldung · Registrierung · Passwort vergessen | `auth-email`, `auth-password`, `pw-reset-email` **13,5 px** |
  | Bankexport · Quick Check | `.dpm-x` unter 44 px |
  | Preise / Upgrade | `.pricing-modal-close`, `a.bw-cta` unter 44 px |
  | Reseller-Portal | acht Felder **14 px**, eines 13,3 px; Rücklink unter 44 px |
  | Rechtliches (Impressum · Datenschutz · AGB) | Rück- und Fußzeilen-Links unter 44 px |
  | **Datenschutz** | Tabelle der Auftragsverarbeiter: `body.scrollWidth` **430** statt 375 — echt breiter als der Schirm |
  | **Alle Objekte, Listenansicht** | `.ao-table` ist **700 px** breit und scrollt in `.ao-table-wrap` — ohne sichtbaren Hinweis |

  **Fix (v652, `style.css` W45→W47, dazu die vier eigenständigen Seiten):**
  Felder in `#auth-modal`, `#settings-modal`, `.set-modal-cream`,
  `.global-view-overlay` und `#sb-search-input` auf **16 px** — mit
  `:not()` für Kontrollkästchen, Schalter, Farb- und Dateifelder, bei denen
  iOS ohnehin nicht zoomt. Trefferflächen wie in v650 über ein unsichtbares
  `::after` mit `max(100%,44px)`, damit die Optik unverändert bleibt.
  Die Objekttabelle bekommt einen Verlaufs-Hinweis am rechten Rand.
  `impressum.html`, `datenschutz.html`, `agb.html` und `reseller.html`
  tragen jeweils einen eigenen `@media (max-width:768px)`-Block — sie haben
  kein gemeinsames Stylesheet.

  **Nachgemessen auf Staging (W47), jeder Bereich einzeln:**

  | Bereich | Überlauf | Felder < 16 px | Ziele < 44 px |
  |---|---|---|---|
  | Alle Objekte | 0 | 0 | 0 |
  | Einstellungen | 0 | 0 | 0 |
  | Track Record | 0 | 0 | 0 |
  | Bankexport | 0 | 0 | 0 |
  | Quick Check | 0 | 0 | 0 |
  | Anmeldung / Registrierung / Passwort | 0 | 0 | 0 |
  | Preise / Upgrade | 0 | 0 | 0 |
  | Datenraum | 0 | 0 | 0 |
  | Impressum | `bodySW 375` | – | 0 |
  | Datenschutz | `bodySW 378` (vorher 430) | – | 0 |
  | AGB | `bodySW 375` | – | 0 |
  | Reseller-Portal | `bodySW 375` | 0 | 0 |

  **Nebenbefund, noch offen:** Beim Durchklicken der Einstellungs-Abschnitte
  fror der Prüf-Browser zweimal ein, sobald mehrere der hinteren Abschnitte
  (`anbieter`, `mandanten`, `plan`, `rechtliches`, `help`) in einem Zug
  gerendert wurden. Einzeln geöffnet ist jeder unauffällig. Das kann ein
  Artefakt der Automatisierung sein oder ein echter Rendering-Kostenpunkt —
  nicht weiter verfolgt, gehört auf ein echtes Gerät.

- [2026-08-06] **Kartenmodus „Stapel" (Handy-Optik)** — `v1095`, `v1095b`

  Vorlage `design/mockups/handy2.jpg`. Zugeklappt eine goldene Zeile mit
  Score-Ring links auf dem Verlauf, Adresse fett daneben, Nummer und Datum
  klein darunter, Stufen-Abzeichen rechts, Chevron außen.

  **Nachgemessen:** zu **61 px**, offen **255 px**; Band 343 × 59; Ring
  x 21, Abzeichen x 305–336, Chevron x 330. Aufgeklappt sind Foto, Preis,
  Halter und KPI-Kacheln alle da. Das Goldband ist in **allen vier**
  geprüften Vorlagen identisch (`rgb(232,204,122) → rgb(201,…)`) — es ist
  das Kennzeichen des Modus, hell wie dunkel. Der Rumpf folgt dagegen der
  Vorlagenfarbe, damit Kontor keinen schwarzen Block bekommt.

  Aufgeklappt wird über dieselbe Mechanik wie „Kompakt"
  (`js/karten-kompakt.js`, Klasse `.uv-open`); `kompaktAn()` nimmt jetzt
  beide Modi. `CARDS` in `ui-varianten.js:45` um `{ key:'stapel' }`
  erweitert — der Umschalter zeichnet den vierten Knopf von selbst.

  **Ein Fehler unterwegs (v1095b):** das Stufen-Abzeichen stand bei x 0.
  Mein `position:absolute` bezog sich auf `.sbc-score-overlay` — das ist
  selbst absolut und damit der positionierte Vorfahr, nicht die Karte. Bei
  `left:8px` und automatischer Breite schob `right:30px` es aus dem Bild.
  Richtig ist das Muster aus v1082j: das Overlay spannt über die Bandbreite
  und schiebt Ring und Abzeichen per `space-between` auseinander.
