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

## → Hier weitermachen (Übergabe 2026-08-13)

**Stand:** lokal = GitHub = Staging auf demselben Commit, Zweig `staging`,
Arbeitsverzeichnis sauber. Der Parallelstrang hat am 13.08. `v1084`/`v1084a`
ausgerollt (Ausschuss-Register, Sachwertfaktoren) — beides ist im Repo.

> **Der Prüfbefehl nach jedem Deploy liest den ZWEIG mit, nicht nur den Hash:**
> ```
> ssh root@116.203.214.11 'cd /opt/dealpilot && git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD'
> ```
> Erwartet wird `staging` **und** der eben gepushte Hash. Am 12.08. stand der
> Server auf `main`, und fünf Pakete waren dadurch stundenlang nicht live,
> obwohl jeder Deploy „Erfolg" meldete. Details in `FALLEN.md` Punkt 1.

### An diesem Tag ausgeliefert

| | |
|---|---|
| `v1155` | Darstellungs-Panel färbte sich mit der gewählten Farbe mit |
| `v1156`/`b`/`c` | Grundfarbe unter aktiver Vorlage sichtbar gesperrt (Marcels Weg B) |
| `v1157`/`b` | Der Whitelabel-Sweeper verwarf jede Nutzeränderung am Body-Inline-Stil |
| `v1158`/`b` | Reiter tragen im hellen Modus die Tinte des Aktionen-Menüs |
| `v1159` | Im Stapelmodus löste die **Pfeilmitte Löschen aus** |
| `v1160` | Gate zugezogen: `market_data_fields` + `live_market_rates` bei Free auf `false` |
| `v1161` + DB | `business`/`enterprise` gelöscht — erst vier Code-Stellen, dann die Zeilen |

Dazu: Plan-Prüflauf mit Befundliste (Punkt 6), Backlog aufgeräumt und
fortlaufend nummeriert, `PROJEKTANWEISUNG.md` mit Marcels Abendfassung
zusammengeführt.

### Der nächste Schritt ist vorbereitet, nicht angefangen

**Punkt 5 (Hell und Dunkel als zwei Profile)** hat seinen Entwurf:
`design/Vorschläge/hell-dunkel-zwei-profile.html` — anklickbar, mit dem
Schalter wie er in den Einstellungen aussähe, beiden Fassungen nebeneinander
und **allen drei offenen Fragen beantwortet** (je Profil eigene Werte über
`brand_display`; das kleine Logo = die kompakte Wortmarke aus `v1086`; der
Schalter ändert **niemals Farben**, die gehören dem Partner).

**Vor dem Bauen zwei Fallen, die im Entwurf stehen und teuer bezahlt sind:**
1. Der Wechsel muss über den **Bedienweg** laufen — ein Klick löst
   `skinNachziehen()` aus, ein `setAttribute` nicht.
2. **`_dpDispSkin` setzt `ui_theme` auf leer**, wenn die aktive Vorlage der
   neuen Helligkeit widerspricht. Das Profil muss die Vorlage deshalb
   **nach** dem Skin setzen, nicht davor — sonst löscht der Skin sie sofort
   wieder.

**Was Marcel noch offen hat** (nicht von mir zu entscheiden):
- **Punkt 1**, Teil B: wie wird der Score flacher — braucht ein Bild. Dazu der
  Befund, dass die Score-Zeile erst **ab 70 % Datenvollständigkeit**
  erscheint (`calc.js:205`).
- **Punkt 4**: welcher Art soll die erweiterte Akzent-Palette sein.
- **Punkt 11** (Wallet): welche Angaben gehören auf die Karte.

**Prüfstrecken auf Staging:**
- `PRUEF_ZFH Löhner Str. 278` (`3fbb754c`) — **EFH**, Stufe 3 bezahlt.
  **Achtung:** die bezahlte Stufe gilt nur für das Konto, das gezahlt hat
  (`info@junker-immobilien.io`) — unter einem anderen Konto kostet derselbe
  Bericht voll.
- `Hermannstraße 9 Hüllhorst` (`07d89138`) — ETW, Stufe 3 bezahlt.

## Offen

1. **Tablet-Fassung: A, C und D sind erfüllt — gemessen 2026-08-12.**
   Der Punkt bleibt offen, weil **B** und die **Admin-Oberfläche** offen sind.
   Alles andere ist gebaut, es war nur nie nachgemessen worden.

   **Gemessen in der Messkabine** (Träger `/impressum.html` auf der
   App-Domain, iframe, Partner-Konto, Objekt `PRUEF_ZFH` geladen,
   `getAnimations().finish()` nach jeder Breitenänderung):

   | Fenster | Sidebar | Leiste | Inhalt | Burger |
   |---|---|---|---|---|
   | 820 px | Drawer (`fixed`, −380) | 380 | 820 | sichtbar |
   | 900 px | Drawer | 380 | 900 | sichtbar |
   | **901 px** | **angedockt** (`sticky`) | 260 | 641 | aus |
   | **1024 px** | **angedockt** | 260 | **764** | aus |
   | 1025 px | angedockt (`relative`) | 380 | 645 | aus |
   | 1180 px | angedockt | 380 | 800 | aus |

   - **A (Sidebar andocken): erfüllt, und zwar seit `v648`.** Der Block
     `css/style.css:35783` — `@media (min-width:901px) and (max-width:1024px)`
     — dockt die Leiste als 260-px-Spalte im Fluss an und lässt bei 1024 px
     **764 px** für den Inhalt. Marcels Entscheidung „ab 1024 px" ist damit
     erfüllt, sogar schärfer: es beginnt bei 901 px.
   - **C (zweispaltige Formulare): erfüllt.** Im Objekt-Tab stehen bei
     641–764 px Inhaltsbreite zwei- **und** dreispaltige Raster
     (2 × 318,5 px bzw. 3 × 210,3 px).
   - **D (Popover statt Blatt): gegenstandslos.** Es gibt kein Blatt von
     unten mehr. `css/style.css:11519` legt es **global** still:
     `.bsheet-overlay{display:none!important}` mit dem Kommentar
     „Bottom-Sheet aus V43 verstecken — wird in V46 nicht mehr genutzt". Der
     Auslöser `.sb-actions-trigger` öffnet `sbActionsToggle()`, also das
     **Akkordeon in der Sidebar** (11 `.sb-act-item`, 217 px breit).
     Gegenprobe bei 820 px und 1024 px: `bsheet-panel` bleibt auf Höhe 0.

   > **Der Entwurf `design/Vorschläge/tablet-fassung.md` ist an drei Stellen
   > widerlegt, und die Ursache ist dieselbe: er hat ausschließlich bei
   > 820 px gemessen** — unterhalb der 901er-Schwelle, also im Drawer-Band.
   > Deshalb las sich der Grundbefund als „das Tablet bekommt die
   > Handy-Fassung, nur breiter". Für 901–1024 px trifft das nicht zu.
   > Beim Blatt kam eine zweite Falle dazu: es steht mit 40 Erwähnungen im
   > Markup und 11 Kacheln im DOM und **sieht deshalb aktiv aus**. Ob ein
   > Element je sichtbar wird, sagt nur die Messung — nicht seine Anwesenheit.

   **Was an dem Punkt wirklich offen ist:**

   - **B — wie wird der Score flacher?** Weiterhin **blockiert auf ein Bild**,
     weil es die auffälligste Fläche der App ist. **Neuer Befund dazu:** die
     Score-Zeile erscheint überhaupt erst **ab 70 % Datenvollständigkeit**
     (`js/calc.js:205` setzt sonst `body.hdr-banner-only` und zeigt einen
     Hinweisbanner). Gemessen: `PRUEF_ZFH` liegt darunter → Kopfleiste
     **157 px** statt der 348 px des Entwurfs, `.scores` und `.sc-main` sind
     gar nicht im Layout. **Die 251 px des Entwurfs sind damit nicht
     nachgemessen** — dafür braucht es ein Objekt über der 70-%-Schwelle.
     Der Score bleibt auf dem Tablet (Marcels Vorgabe).
   - **Admin-Oberfläche:** die verlangte Zahl ist erhoben —
     `admin/css/admin.css` hat **3 Media-Queries** (bei 900 px, 900 px und
     820 px), `admin/js/admin-network.js` eine vierte (1150 px), Viewport-Meta
     ist gesetzt. **Anders als das Partner-Portal in `v1112b` ist der Admin
     also nicht bei null.** Eine echte Messung braucht ein Admin-Konto, das
     dieser Prüflauf nicht hatte — bleibt ehrlich offen.
   - **820 px (iPad Hochformat) bleibt die Handy-Fassung:** Drawer, eine
     Spalte über die volle Breite. Das ist **kein Defekt**, sondern die Folge
     von Entscheidung A (Schwelle 901). Soll das Hochformat andocken, wären
     bei 260-px-Leiste nur 560 px Inhalt übrig — das schließt zweispaltige
     Formulare aus. **Eigene Entscheidung, nicht in diesem Punkt.**

2. **Zwei Handy-Befunde aus dem v1118-Durchgang, bewusst nicht gefixt.**
   Beide sind gemessen und beschrieben; beide sind **Gestaltung bzw.
   Barrierefreiheit**, kein Defekt — deshalb nicht nebenbei erledigt.

   - **ERLEDIGT — Ankreuzfelder auf 33 px** (`v1147` `674c3b0`,
     `v1147b` `413d409`). **Marcels Entscheidung 2026-08-12: 33 px, nicht
     44** — die volle Trefferfläche hätte jede Formularzeile höher gemacht.

     **Ursache, am Markup nachgezählt:** alle **37** Checkboxen sind
     nackte `<input type="checkbox">` **ohne Klasse**. Die Klasse
     `.cb-label` sitzt am **Label**, nicht am Feld — ihre Regel
     (`style.css:2191`, 16 px) griff deshalb nur für acht. Die übrigen
     standen auf Browser-Standard, daher die gemessenen 13 px.

     Schalter sind ausgenommen (`.ji-switch`, `.toggle-slim`,
     `.fesh-tile`, `.dp-pf-tile`) — sie bauen aus demselben nackten
     Element eine ganz andere Optik.

     **Nachgemessen:** **26 Felder auf 33 × 33 px**, alle Schalter
     unverändert (14 px, 32 × 18, auto).

     **Eigener Fehler, korrigiert in `v1147b`:** Der Selektor stand zuerst
     auf `#app` — **dieses Element gibt es in der App gar nicht**
     (`getElementById` liefert `null`). Ich hatte den Anker aus
     `CLAUDE.md` übernommen, statt ihn auszulesen; genau der Fehler, vor
     dem Regel 1 warnt. Die Regel griff dadurch nirgends.

     **ABGENOMMEN (2026-08-12 abends, siehe Fertig).** Die Messung vom
     Mittag war wertlos (0 von 26 Feldern sichtbar). Nachgeholt mit
     geladenem Objekt, allen Reitern und aufgeklappten `<details>`:
     **21 sichtbare Felder, alle 33 × 33 px, kein Überlauf** — bei 1440 px
     und bei **390 px**. Die Zeilen tragen (33/35 px), kein Feld ragt heraus,
     kein Label abgeschnitten. Die dichten Reiter Steuer (2) und
     Pilot-Analyse (13) sind einzeln geprüft.
   - **`.sbc-arrow` misst 20 × 20 px und ist ein echtes Bedienelement.**

     **Mein v1118-Befund war falsch und wird hiermit zurückgenommen.** Ich
     hatte gemeldet, der Pfeil trage `role="button"` „ohne eigenen Klick"
     und die Rolle sei irreführend. Nachgelesen in `karten-kompakt.js`
     (v1092): Rolle, `tabindex="0"` und `aria-label` werden dort
     **absichtlich** gesetzt — und zwar nur, wenn der Kartenmodus
     `kompakt` oder `stapel` aktiv ist. Dort **klappt der Pfeil die Karte
     auf und zu** (`umschalten()`), über einen **delegierten** Listener.
     Mein Prüfausdruck hat nur `getAttribute('onclick')` abgefragt und
     einen delegierten Handler deshalb nicht gesehen.

     **Was bleibt, ist ein anderer, echter Befund:** ein Bedienelement mit
     eigener Funktion misst **20 × 20 px** — deutlich unter der
     44-px-Trefferfläche aus v650/v652.

     **Warum das nicht wie in `v1118b` mit einem `::after` zu lösen ist:**
     Pfeil und Karte tun **Verschiedenes** — der Pfeil klappt auf, der
     Kartenkörper öffnet das Objekt. Eine 44-px-Pseudofläche würde der
     Karte Klicks stehlen und die falsche Aktion auslösen. Es ist also
     eine Frage der Kartengestaltung im Kompakt-Modus, kein Nachschlag.

     **Nachgemessen 2026-08-12 im Quelltext — die 4 px sind kein
     Quetschbefund.** `.sbc-arrow` trägt in `style.css:4828` bereits
     `flex-shrink: 0`; die Regel darunter
     (`aside.sidebar .sb-card .sbc-arrow`, Z. 24958) setzt nur Farbe,
     Schriftgröße und `margin-left`. **Die 4 × 21 px sind schlicht die
     natürliche Breite des Zeichens `›` bei 14 px ohne jedes Padding** —
     der Pfeil hat nie eine Fläche gehabt, er ist nur ein Buchstabe.

     **Damit ist die Lösung eine andere als gedacht:** kein Flex-Fix,
     sondern dem Pfeil überhaupt erst eine Fläche geben. Der Weg ohne
     Klickdiebstahl ist **Padding am Element selbst** plus negatives
     `margin` zum Ausgleich — die vergrößerte Fläche gehört dann dem Pfeil
     und seinem eigenen delegierten Handler
     (`karten-kompakt.js:83`, `ziel.closest('.sbc-arrow')`), nicht der
     Karte. **Zu messen ist vorher, wie viel Platz in `.sbc-top-line1`
     rechts frei ist** — überlappt das negative Margin die Nachbarn,
     stiehlt es Klicks in die andere Richtung.

3. **Marktbericht neu gestalten.**
   **Entwurf steht: `design/Vorschläge/marktbericht-wizard.html`**
   (2026-08-11, anklickbar, im Browser durchgeprüft).

   ### ENTBLOCKIERT — Marcels Vorgaben vom 2026-08-12

   Die beiden Geldfragen, auf denen der Punkt blockiert war, sind
   beantwortet: **abgerechnet wird beim Erzeugen, Vertiefen kostet nur die
   Differenz.** Dazu drei neue Vorgaben: Felder klar pro Stufe abgrenzen
   samt Zusatzfeldern · manuelle Parameter erst vermerken, bis ein Abgleich
   möglich ist · die Preisindikation steht im PDF drei- bis viermal.

   **Alles vier ist gemessen und steht in
   `design/Vorschläge/marktbericht-stufen-und-herkunft.md`.** Kurzfassung:

   - **Die Abrechnung ist schon so gebaut** (v1125/v1126) **und jetzt
     nachgewiesen** (siehe Fertig, ohne Kerosin): Auskunft und Abbuchung
     rechnen dieselbe Formel, und im Log steht ein echter Vorgang mit
     **7 L = 12 − 5** für eine Vertiefung von Stufe 2 auf 3. Vollpreise
     2 / 5 / 12 L, der Browser rechnet die Ermäßigung nicht selbst.
     **ERLEDIGT: die Formel stand an zwei Stellen** — `v1154` führt sie in
     `_aufpreis(stufe, bezahlt)` zusammen, Verhalten bewiesen unverändert
     über alle 12 Kombinationen (siehe Fertig).
   - **Pflichtfelder je Stufe stehen als eine Quelle** in `BEDARF`
     (`mb-stufen.js`): Stufe 1 `address` `ptype` `area` `year` · Stufe 2
     `baustatus` `cond` `quality` · Stufe 3 `plot` `units` und
     objektartabhängig `mea` bzw. `standardstufe`+`nhkHaus`. **Keine zweite
     Liste anlegen** — der frühere `FEHLT_TEXT` war genau das und lief
     auseinander (v1126d).
   - **22 Zusatzfelder hängen an der Objektart.** Sie sind im Entwurf nach
     Gruppen aufgeschlüsselt. Drei Fallen: `ptype` gehört in die
     Auslöserliste (v1119-WAUS), Felder mit `wenn:`-Bedingung erscheinen
     **nur nach echter Nutzereingabe**, und `_angestrebt` in `mb-stufen.js`
     ist eine **Untergrenze** — wer daran rührt, macht Stufe 3 wieder
     unerreichbar (v1126c).
   - **ERLEDIGT: die Preisindikation im PDF** — `v1149`, siehe Fertig.

   ### Herkunft der manuellen Parameter — FEHLDIAGNOSE, ausdrücklich zurückgenommen

   **Ich hatte gemeldet, ein manuell eingegebener Sachwertfaktor trage keine
   Herkunft. Das ist falsch.** Die Rücknahme im Einzelnen, weil der Weg
   wichtiger ist als der Irrtum:

   Belegt war nur **eine** Stelle: in `CrossCheckService.js` hängen die sieben
   `sachwertfaktor_*`-Felder (`_grund`, `_hinweis`, `_stuetzstellen`,
   `_ausschuss`, `_tabellenwert`, `_korrekturen`) am Tabellenzweig, und der
   wird bei eigenem Wert übersprungen. **Das stimmt — trägt aber die
   Schlussfolgerung nicht.** Die Herkunft läuft über einen anderen Weg:

   ```
   WertParameterService.sachwertfaktor({nutzerwert})
     -> { wert, stufe: 'E', quelle: 'eigene Angabe' }
   nhk2010.js:897
     -> out.sachwertfaktor = { wert, stufe, quelle }
   app.js:592 ff. (Karte "Sachwert")
     -> "marktangepasst · Faktor 1,15 · Stufe E"
   ```

   Dasselbe beim Liegenschaftszins: `ReportOrchestrator.js:404` reicht
   `nutzerwert: ref.lzs_pct` durch, der Service antwortet mit `stufe: 'E'`,
   `quelle: 'eigene Angabe'` **und** dem Hinweis „Liegenschaftszinssatz
   manuell gesetzt. Für das Dossier bitte die Herkunft angeben
   (Grundstücksmarktbericht, Jahr)." Die Ausgabe führt ihn über
   `kern.lzs.stufe`. Meine Aussage „das Formular sendet keine Stufe, also ist
   sie null" war falsch — **die Stufe entsteht im Backend, nicht im
   Formular.**

   Dazu gibt es `STUFEN_ETIKETT` (A–E) in `WertParameterService.js`, wo
   **E = „eigene Angabe · vom Nutzer gesetzt · indikativ"** definiert ist.
   Hergestellt hat das `v1144` — der Commit-Titel sagt es wörtlich: „Der
   Sachwertfaktor wurde nie angewandt — falscher Feldname an zwei Stellen."

   **Marcels Vorgabe ist damit im Kern schon erfüllt gewesen.** Es blieben
   zwei kleine Lücken:

   1. **ERLEDIGT — die Stufe fehlte im PDF** (`v1150`/`v1150b`, `e33ea05`,
      siehe Fertig). Dabei kam ein **zweiter, größerer Fehler** heraus: die
      Fußnote druckte die **Konstante** `assumptions.sachwertfaktor` = 1,0,
      nicht den angewandten Faktor. Am Prüfobjekt stand „Sachwertfaktor 1"
      im Dossier, gerechnet wurde mit **0,925**.
   2. **Offen, aber kleiner als gedacht — der Hinweistext beim
      Sachwertfaktor.** Der LZS gibt bei manueller Eingabe „bitte die
      Herkunft angeben (Grundstücksmarktbericht, Jahr)", der Sachwertfaktor
      gibt `hinweis: ''` (`WertParameterService.js:473`).
      **Vor dem Bauen beachten — der Anzeigeweg fehlt:** die Karte zeigt
      `sachwertfaktor_hinweis` nur unter der Bedingung
      `sw.available && !sw.marktangepasst` (`app.js:612`). Bei einem
      **wirksamen** eigenen Faktor ist `marktangepasst = true`, der Hinweis
      erschiene also **nirgends**. Und in `CrossCheckService.js:245` hängt
      `sachwertfaktor_hinweis` ohnehin nur am Tabellenweg. Ein Hinweis, den
      niemand sieht, ist keine Verbesserung — **erst den Weg bauen, dann den
      Text.** Der eigentliche Vermerk („Stufe E · eigene Angabe") steht seit
      `v1150` im Dossier, damit ist Marcels Anliegen abgedeckt.

   Der eigentliche **Abgleich** eigene ↔ amtliche Angabe bleibt ein eigenes
   Vorhaben und hängt daran, dass `mb.valuation_inputs` überhaupt beschrieben
   wird — heute passiert das nicht.

   > **Die Lehre steht als Punkt 9 in `FALLEN.md`:** „Das fehlt" ist die
   > teuerste Vermutung. Vom **Verbraucher** her suchen (wer zeigt den Wert
   > an?), nach dem **Vokabular** greppen (`STUFEN_ETIKETT`, `'E'`) und die
   > **Commit-Historie** nach dem Thema fragen (`git log -S`) — jedes davon
   > hätte den Irrtum in einer Minute beendet.

   ### Marcels Entscheidung vom 2026-08-11 — sie ersetzt die vom 2026-08-10

   „Nummer 1 und dein Vorschlag" — also **Idee 1 (Wizard mit Reitern)**,
   kombiniert mit **Idee 2 (lebende Vorschau)** und **Idee 6 (sichtbarer
   Zweig)**, wie empfohlen. Wörtlich dazu:

   - **Die drei Stufen sollen vereint werden**, nicht vorher abgefragt:
     einfache Bewertung, erweiterte Marktpreisindikation und genaue
     Wertermittlung in **einem** Weg.
   - **Es soll übersichtlich sein.**
   - **Am Schluss das Ergebnis wie jetzt.**
   - **Die Übersicht bleibt vollständig:** Objekte einlesen, die Tabelle
     der vorhandenen Marktberichte, und ein angelegtes Objekt direkt
     auswählen. „Das ist ja quasi die Übersicht."

   **Damit ist die Festlegung vom 2026-08-10 überholt** — dort hieß es noch
   „nur die genaue Wertermittlung bekommt einen Wizard, Stufe 1 und 2
   bleiben". Jetzt ist es **ein** Weg für alle drei.

   ### Wie die Stufen vereint werden

   Als **drei Meilensteine auf einem Weg** statt als Frage vorweg. Man kann
   an jedem stehenbleiben und erzeugen:

   | Meilenstein | erreicht nach | heute |
   |---|---|---|
   | Einschätzung | Schritt 1 | Stufe 1 · 2 L |
   | Marktpreisindikation | Schritt 2 | Stufe 2 · 5 L |
   | Wertermittlung | Schritt 4 | Stufe 3 · 12 L |

   **Niemand muss vorher wissen, was er braucht** — und wer bei
   „Einschätzung" anfängt, sieht am Balken, dass zwei Angaben mehr die
   Spanne halbieren.

   **Die Objektart steht in Schritt 1 und nirgends sonst**, weil
   `istWohnung()` über **20 der 42 Felder** entscheidet. Ein Wizard, der
   sie später fragt, müsste alles dahinter neu aufbauen.

   ### Im Browser durchgeprüft

   Übersicht → Wizard → Ergebnis → zurück. Zweig gemessen: **ETW ergibt
   vier Reiter** (Feinjustierung entfällt), **Haus fünf**; `mea` ist beim
   Haus weg. Folgefelder: `hinterlandFlaeche=828` bringt `hinterlandRent`
   und `hinterlandWert`, **und der getippte Wert bleibt erhalten** — die
   Fokusfalle beim Neuzeichnen ist im Entwurf schon gelöst. Kein Querlauf,
   keine Konsolenfehler.

   **BLOCKIERT auf zwei Fragen, beide betreffen Geld:**
   1. **Wann wird abgerechnet**, wenn die Stufe sich erst am Ende ergibt?
      Vorschlag: beim Erzeugen, nach erreichter Stufe, Preis am Knopf.
   2. **Darf man später vertiefen** — erst „Einschätzung", dasselbe Objekt
      später auf „Wertermittlung" hochziehen — **und was kostet das dann?**
      Vorschlag: nur die Differenz.

   **Was vor dem Entwurf gemessen sein muss:** welche Felder voneinander
   abhängen. `garagenStufe` und `hinterlandRent` erscheinen nur nach echter
   Nutzereingabe und werden bei programmatischem Setzen **nicht**
   nachgezeichnet — ein Wizard, der das übersieht, verliert Eingaben.

   **Zwei feste Randbedingungen:** die Marktbericht-App ist **immer hell**
   und lädt `whitelabel-override.js` **nicht** (Farbe läuft über
   `mb-whitelabel.js`). Und `payload()` in `wertermittlung.js` bleibt die
   Sammelstelle — **eine neue Oberfläche darf die Feldnamen nicht ändern**,
   sonst hängt der Rechenkern daran.

   ---

   ### Nachlese aus Marcels Durchsicht des Entwurfs, 2026-08-11

   Drei Befunde am Entwurf `marktbericht-wizard.html`, dazu eine
   Verständnisfrage, die den Ablauf betrifft — **die ist die wichtigste.**

   1. **ERLEDIGT — die Schrittleiste ist zu schmal** (`v1151`, `7c716ab`,
      siehe Fertig). Gemessen statt geschätzt: die sieben Marken brauchen
      **902 px**, ihr Behälter stand bei **jeder** Fensterbreite auf
      **760 px** — auch bei 1920, wo `.panel` 1300 px breit ist. Der Platz
      war da; die Leiste begrenzte sich selbst und brach in zwei Zeilen um.
      Ursache war ein Sammelselektor aus `v1128`, der die Leiste mit den
      Formularzeilen zusammen auf 760 px setzte. Jetzt eigene Grenze
      960 px → **eine Zeile ab 1024 px**.

   2. **ERLEDIGT — der Erzeugen-Knopf war bei Stufe 1 gesperrt** (`v1152`,
      `d17edac`, siehe Fertig). Die zweite Ursache ist gefunden: `ab` und
      `genauerAb` bedeuten Verschiedenes. Ertrags- und Sachwert stehen auf
      `ab: 1`, weil sie immer mitrechnen („nur mit Pauschalen", v1018) — ihre
      Pflichtfelder `plot`/`units` brauchen sie erst bei `genauerAb: 3`.
      `knopfSperren()` prüfte gegen `ab`, also verlangte Stufe 1 die Angaben
      von Stufe 3. Nachgewiesen in beide Richtungen: bei Stufe 1 jetzt
      klickbar mit „· 2 L", bei Stufe 3 weiterhin gesperrt.
      **Auch die Reihenfolge der Reiter ist geprüft und stimmt:** Stufe-1-
      Felder liegen in Reiter 2, Stufe-2-Felder in Reiter 3, Stufe-3-Felder
      in Reiter 5 — kein Pflichtfeld der Einschätzung steckt in einem
      späteren Schritt.

      *Der historische Befund, der zur ersten Ursache führte, bleibt hier
      stehen, weil seine Lehren gelten:*

      **Der frühere Wortlaut:** „das muss ja irgendwie möglich sein."
      **Das ist der Kern des ganzen
      Meilenstein-Gedankens** — wer bei „Einschätzung" stehenbleiben will,
      muss dort auch erzeugen können. Steht der Knopf still, ist der Wizard
      wieder ein Pflichtdurchlauf und die Vereinigung der drei Stufen
      wertlos.

      **Eine Ursache ist gefunden und behoben (2026-08-11, `v1136c`) —
      wahrscheinlich nicht die einzige.** Beim Durchmessen der Kette für
      den Objekt-Reiter gemessen: `mapCond()` in `mb-objektwahl.js` ordnete
      den Zustand **„gut"** keiner einzigen Option des Berichtsfeldes zu und
      ergab `null`. Der Zustand ist Pflicht für die Marktpreisindikation,
      und `erreicht()` in `mb-stufen.js` ist eine **Kaskade** — ohne Stufe 2
      ist Stufe 3 unerreichbar. Der **häufigste Zustandswert überhaupt**
      hat den Bericht also gesperrt, und die Ampel zeigte an Stufe 3
      „fehlt: " **ohne Inhalt**, weil dort tatsächlich nichts fehlte.

      Zwei Lehren für den Wizard:
      - **Eine Stufe kann vollständig sein und trotzdem gesperrt** — weil
        eine frühere es nicht ist. Die Beschriftung muss den **wirklichen**
        Grund nennen, nicht die leere Liste der eigenen Stufe.
      - **Beide Optionslisten gehören gegeneinander geprüft**, nicht per
        Heuristik verknüpft. Die alte Fassung verglich fünf
        Anfangsbuchstaben, und „sanie" steckt auch in
        „sanierungsbedürftig" — **„stark sanierungsbedürftig" kam als
        „saniert" an**, ein Fehler mit falschem Vorzeichen.

   3. **Es muss auf dem Handy funktionieren.** Seit `v1118` landen echte
      Nutzer bei 390 px in der normalen Ansicht. Eine siebenteilige
      Schrittleiste nebeneinander und ein Handy schließen sich aus — der
      Entwurf braucht **zwei** Darstellungen derselben Führung, nicht eine
      gequetschte.

      **ERLEDIGT — Fassung C ist gebaut** (`v1153`/`v1153b`, `7fb691f`, siehe
      Fertig). Marcels Wahl aus der Demo. Bei 390 px trägt die Führung jetzt
      **55 px statt 188 px**; ab 1024 px stehen die sieben Marken unverändert
      in einer Zeile. Alle drei Verhaltensregeln über den Bedienweg geprüft.

      *Die Demo bleibt als Beleg der Entscheidung stehen:*
      `design/Vorschläge/marktbericht-schrittleiste-handy.html` (2026-08-12,
      anklickbar, echte 390-px-Rahmen). Drei Fassungen mit gemessenen Höhen:

      | | Höhe | spart | Sprung zu jedem Schritt |
      |---|---|---|---|
      | heute | 188 px | — | ja |
      | **A** Schritt 3 von 7 + Balken | ~62 px | 126 px | **nein** |
      | **B** Blätterleiste mit Punkten | ~72 px | 116 px | nur über Punkte |
      | **C** Klappleiste ★ | **50 px** zu | **138 px** | **ja** |

      **Empfehlung C**, weil sie die einzige ist, die **nichts wegnimmt**: der
      direkte Sprung bleibt, zugeklappt braucht sie weniger als A, und sie
      zeigt **dieselbe** Führung wie der große Schirm — nur eingeklappt. Dazu
      ist das Muster im Haus bekannt: die Kompakt-Karte der Sidebar ist
      genau das („eine schmale Zeile zum Aufklappen", v1092/v1094).
      **Vorschlag für die Schwelle: unter 900 px** — dieselbe, an der die App
      auf den Drawer umschaltet. Dann gibt es zwei Fassungen und keine dritte
      Zwischenform.

      **Jetzt vermessen (2026-08-12, nach `v1151`):** bei 390 px ist der
      Behälter 305 px breit, die Leiste bricht auf **vier Zeilen** um
      (Oberkanten 422/469/516/563) — also rund **188 px, bevor eine einzige
      Angabe zu sehen ist**. **Kein Überlauf, nichts beschnitten, alle
      sieben Marken erreichbar** — es ist kein Defekt, sondern eine
      Platzfrage. Ab 1024 px steht die Leiste in einer Zeile, unter 1024 px
      in zwei, auf dem Handy in vier.

      **Damit ist die Aufgabe scharf umrissen:** gesucht ist eine zweite
      Darstellung für schmale Schirme, die weniger als 188 px braucht — etwa
      „Schritt 3 von 7" mit Titel und Fortschrittsbalken statt sieben
      Marken. **Das ist Gestaltung, keine Reparatur → Demo-first**, Ablage
      in `design/Vorschläge/`.

   **Und die Aufgabe, die über allen dreien steht: den Ablauf einmal
   vollständig durchspielen.** Marcel: „das muss ja Sinn machen, auch von
   der Reihenfolge her." Zu klären ist damit nicht die Optik, sondern die
   **Freischaltlogik**:

   - **Welche Felder machen welchen Meilenstein voll?** Für jede der drei
     Stufen die Pflichtangaben benennen — aus dem, was das Backend
     tatsächlich braucht, nicht aus dem Bauchgefühl. Solange das nicht
     gemessen ist, ist jeder Freischaltzustand geraten.
   - **Der Knopf zeigt, was er gerade erzeugt.** Beschriftung und Preis
     wandern mit dem erreichten Meilenstein mit. Er ist **nie** tot,
     solange mindestens die Einschätzung vollständig ist.
   - **Die Reihenfolge der sieben Schritte muss den Meilensteinen folgen.**
     Wenn Schritt 1 die Einschätzung trägt und Schritt 2 die
     Marktpreisindikation, darf kein Pflichtfeld der Einschätzung in
     Schritt 5 stehen. Genau das ist zu prüfen — und es ist der
     wahrscheinlichste Grund dafür, dass der Knopf still bleibt.
   - **Die Objektart bleibt in Schritt 1.** `istWohnung()` entscheidet über
     20 der 42 Felder; sie später zu fragen hieße, alles dahinter neu
     aufzubauen.

   **Das gehört in den überarbeiteten Entwurf, nicht in den Code** — erst
   die Führung durchspielen und zeigen, dann bauen. Die beiden offenen
   Geldfragen oben (wann wird abgerechnet, was kostet das Vertiefen)
   hängen unmittelbar daran: sie lassen sich erst beantworten, wenn
   feststeht, wann ein Meilenstein als erreicht gilt.

4. **Akzentfarbe: zu wenig Auswahl, und der Block färbt sich selbst mit**

   Zwei Befunde an einer Stelle, aber **nur einer davon ist ein Defekt**.

   **Der Defekt: der Darstellungs-Block nimmt die gewählte Farbe selbst an.**
   Wählt Marcel Grün, wird das Gold am Kopf des Akzent-Bereichs mit grün.
   **Das darf im Einstellblock nicht passieren** — wer eine Farbe *auswählt*,
   braucht eine neutrale Umgebung, sonst beurteilt er die Farbe gegen sich
   selbst. Die Bedienoberfläche ist kein Vorschaufeld.

   Vor dem Patch messen, welche Regel greift: die `--wl-`Tokens werden
   ausschließlich von `whitelabel-override.js` gesetzt (`setWlTokens` in
   `apply()`), und der Block hängt vermutlich an denselben Tokens wie die App.
   **Die Lösung ist ein eigener Satz fester Töne für das Panel**, nicht ein
   Ausschalten der Vorschau — die Vorschauflächen *sollen* mitgehen, der
   Rahmen darum nicht. Beide Bereiche also sauber trennen.

   **Der Ausbau: sechs Farben reichen nicht.** Marcel will aus einer Palette
   wählen können. Zu entscheiden ist, **welcher Art**:

   | | |
   |---|---|
   | **freier Farbwähler** (`<input type=color>`) | jede Farbe, keine Kuratierung |
   | **erweiterte Palette** | z. B. 24 abgestimmte Töne, alle geprüft |
   | **beides** | Palette als Vorschlag, freier Wähler daneben |

   **Das ist eine Produktentscheidung, keine technische.** Sie hat eine
   gemessene Folge: `_recolor` rechnet HSL-relativ, und **vier der 66
   WL_TINTS reißen schon heute bei einem extrem hellen Akzent** (`#F0D000`:
   `#c08a2f`, `#a6842d`, `#a68a36`, `#a98e3a` landen bei k = 2,57–2,98). Ein
   freier Wähler macht diesen Fall vom Sonderfall zum Regelfall. Er ist
   trotzdem machbar — aber **dann muss der Tint-Weg vorher eine
   Mindestkontrast-Regel bekommen**, sonst liefern wir eine Funktion aus, die
   sich selbst unlesbar machen kann. Der Später-Punkt dazu wird damit zur
   Voraussetzung.

   **→ Demo nach `design/Vorschläge/`, nicht raten.**

5. **Hell und Dunkel als zwei Profile, Dunkel als Auslieferungszustand**

   **Marcels Bild davon, wörtlich zusammengefasst:**

   - **DealPilot wird im dunklen Modus ausgeliefert.** Das ist der Standard.
   - **Daneben ein heller Modus**, umschaltbar mit einem Griff — hell/dunkel.
   - **In der Darstellung sind das zwei Profile.**
   - **Der helle Modus besteht aus:** App-Darstellung „Panel", Objektkarten
     „Standard", und dem kleinen DealPilot-Logo oben in der Ecke.
   - **Ort:** Einstellungen → Profil und Anzeige, oder direkt unter
     Darstellung. Wer es individueller will, klickt dort weiter auf
     „Darstellung öffnen" und stellt einzeln ein.

   **Das ist der größte der neuen Punkte** — nicht wegen des Aufwands,
   sondern weil er die Bedienlogik des ganzen Bereichs neu ordnet: **ein
   Griff für 95 % der Leute, das volle Panel für den Rest.** Genau die
   richtige Richtung; heute muss jeder durch alle acht Farbfelder, um zu
   einem stimmigen Bild zu kommen.

   **Drei Fragen, die vor dem Bauen zu klären sind:**

   1. **Was passiert mit einer eigenen Einstellung, wenn jemand umschaltet?**
      Überschreiben (einfach, aber Arbeit weg), daneben behalten (freundlich,
      aber wo steht sie), oder je Profil eigene Werte (sauber, aber die
      Speicherstruktur wächst). **Mein Vorschlag: je Profil eigene Werte** —
      `brand_display` ist `jsonb`, kostet also keine Migration, und genau
      deshalb wurde es damals so angelegt.
   2. **Was ist „das kleine DealPilot-Logo oben in der Ecke"** — das
      Wortmarken-Bild, das heute die Sidebar trägt? Ein Bild aus
      `design/mockups/` würde das in einem Satz klären.
   3. **Was sieht ein Partner-Mandant?** Der hat ein eigenes Branding. Der
      Schalter darf ihn nicht aus der Marke seines Partners werfen. Das ist
      dieselbe Grenze, die `v1114` und `v1122` schon einmal gezogen haben.

   **→ Demo nach `design/Vorschläge/` mit beiden Profilen zum Durchklicken,
   dann bauen.**

6. **Alle Pläne einmal durchtesten: Starter, Investor, Pro, Partner**

   **Prüflauf, kein Umbau.** Ergebnis ist eine Befundliste.

   **Der Grund, warum das überfällig ist, steckt im Aufbau:** die Plangrenzen
   stehen an **drei Stellen von Hand** — `config.js` (das Gate),
   `pricing-modal.js` (zwei Matrizen) und `landing/index.html`. Drei
   Wahrheiten, die nur so lange übereinstimmen, wie jemand sie pflegt.
   **Der Abgleich gegen die Landingpage, den Marcel verlangt, ist genau der
   richtige Maßstab** — sie ist das, was der Kunde gelesen hat, bevor er
   bezahlt hat.

   **Was gemessen wird:**

   | | |
   |---|---|
   | **Gate gegen Versprechen** | jede Grenze aus `config.js` gegen die Landing-Tabelle, Zeile für Zeile |
   | **DB gegen Datei** | `hasFeature` fragt **zuerst die Datenbank** (`Sub.hasCachedFeature`) und `config.js` nur bei `null` — beide Wege prüfen, sie können auseinanderlaufen |
   | **Unbekannte Schlüssel** | ein Schlüssel, den niemand kennt, ist **für jeden false, auch für Pro**. Ein Tippfehler sperrt also still den teuersten Plan |
   | **Partner** | ist ein **Pro-Klon** plus `reseller`, `reseller_whitelabel`, `custom_logo` |
   | **Bekanntes Leck** | der Bankexport blockt nur `starter` — **Free rutscht mit Wasserzeichen durch.** Stand als offene Entscheidung, ist nie gefallen |

   **Dazu Marcels Frage zum Starter: sieben Tage voller Pro-Status.** Er
   meint, das sei so umgestellt worden. **Ich kann das nicht bestätigen** — in
   meinen Unterlagen steht es nicht, und ich schreibe es nicht als Tatsache
   auf. **Erst messen, ob es überhaupt eingebaut ist**, dann die zweite Frage
   stellen: beibehalten oder anders lösen. Wenn es drinsteht, gehört
   mitgeprüft, **was nach Tag 7 passiert** — Objekte, die unter Pro angelegt
   wurden, dürfen nicht unerreichbar werden.

   ### PRÜFLAUF DURCHGEFÜHRT (2026-08-13) — die Befundliste

   Alle drei Wahrheiten ausgelesen und gegeneinander gehalten: `config.js`
   (Gate, 4 Plan-Blöcke, 33 Schlüssel), `pricing-modal.js` (Matrix) und
   `landing/index.html` (Cockpit-Matrix, 31 Zeilen).

   **Zuerst die gute Nachricht:** die drei Matrizen sind bei den geprüften
   Zeilen **deckungsgleich** — 31 Zeilen, gleiche Reihenfolge, gleiche Werte.
   Die befürchtete Drift zwischen Landing und Modal gibt es an dieser Stelle
   **nicht**.

   #### B1 · Free bekommt zwei Funktionen, die die Landing ihm nicht verspricht

   | Schlüssel | `config.js` free | Landing + Modal (Free) |
   |---|---|---|
   | `live_market_rates` | **true** | **„–"** (also nein) |
   | `market_data_fields` | **true** | **„gesperrt\*"** |

   Die Fußnote der Landing ist dabei eindeutig: *„Marktdatenfelder in Free &
   Starter als Vorschau gesperrt, ab Investor freigeschaltet."*
   **Kein Kundenschaden, aber das Gate ist offener als das Versprechen.**
   Zu entscheiden ist, welche Seite recht hat — das ist Marcels Sache, nicht
   meine: entweder das Gate zuziehen oder die Matrix ehrlich machen.

   #### B2 · `bank_pdf_premium` ist ein toter Schlüssel

   Er steht **nur** im Starter-Block, dort auf `false`, und fehlt bei free,
   investor **und pro**. Ein fehlender Schlüssel ist `undefined` und damit
   false — **das Feature ist für niemanden verfügbar, auch nicht für Pro.**
   In keiner der drei Matrizen kommt er vor, es gibt also kein
   Verkaufsversprechen dazu. Vermutlich ein Überrest; **vor dem Löschen
   prüfen, ob ihn jemand abfragt** (`grep -rn "bank_pdf_premium"`).

   #### B3 · Dreizehn Schlüssel verlassen sich auf „undefined = false"

   `ai_analysis`, `ai_market_analysis`, `api_access`, `bank_pdf_premium`,
   `bankexport`, `custom_imports`, `deal_score_v2`, `investment_thesis_ai`,
   `migration_service`, `premium_pdf_layouts`, `priority_support`,
   `theme_palette`, `track_record_custom_cover` stehen **nicht in jedem
   Plan**. Heute ist das folgenlos, weil `undefined` wie `false` wirkt —
   **aber genau daran hing W41** (`bmf_advanced` stand in keinem Plan und war
   dadurch für Pro gesperrt). **Ein Tippfehler in einem Schlüsselnamen ist in
   dieser Bauweise unsichtbar.** Empfehlung: jeden Schlüssel in jedem Plan
   explizit führen, dann fällt ein Tippfehler beim Lesen auf.

   #### B4 · Zwei „Free kann mehr als Starter"-Fälle sind KEIN Fehler

   `track_record_pdf` (free true, starter false) und
   `custom_finance_models` (free true, starter false) sahen nach einem
   Preisfehler aus. Die Matrix erklärt beide: **Free = „Wasserzeichen" bzw.
   „alle Modelle als Demo"** — Free sieht alles als Vorschau, Starter zahlt
   und bekommt dafür echte, aber begrenzte Funktionen. **Absicht, nicht
   Defekt.** Zurückgenommen, bevor daraus ein Befund wurde.

   #### B5 · `pricing-modal.js` führt die Matrix zweimal

   Einmal ab Z. 261 mit `\uXXXX`-Escapes, einmal ab Z. 505 mit echten
   Zeichen — **dieselben 31 Zeilen, zwei Fassungen.** Heute inhaltsgleich
   (geprüft an den kritischen Zeilen), aber es ist dieselbe Doppelung, die im
   Marktbericht dreimal auseinandergelaufen ist. **Eigener kleiner Punkt.**

   #### Nicht geprüft, ehrlich benannt

   - **`hasFeature` fragt zuerst die Datenbank** (`Sub.hasCachedFeature`),
     `config.js` nur bei `null`. **Der DB-Weg ist nicht gemessen** — dafür
     braucht es je Plan ein echtes Konto. Das ist der zweite Teil des Punkts
     und bleibt offen.
   - **Partner** steht in `config.js` gar nicht; er ist ein Pro-Klon
     (`reseller-portal.js:552`) plus `reseller`, `reseller_whitelabel`,
     `custom_logo`. Auch das ist am Konto zu prüfen, nicht im Code.

   *(Zwei eigene Fehlbefunde aus diesem Lauf, damit sie nicht wiederkehren:
   die Landing schien „Pro = 8 Objekte" und einen Spaltenkopf „?Investor" zu
   führen. Beides waren **Kodierungsartefakte meiner Konsolenausgabe** —
   roh stehen dort `∞` und `★`. Bei Matrizen mit Sonderzeichen die Rohzelle
   lesen, nicht die aufbereitete Ausgabe.)*

   ### NACHTRAG (2026-08-13): der DB-Weg ist gemessen — und B1 war zu weit gegriffen

   Der Punkt verlangte, **beide** Wege zu prüfen. Der DB-Weg ist jetzt
   gelesen (`plans.features`, jsonb, Staging):

   | Plan | `market_data_fields` | `live_market_rates` | Schlüssel |
   |---|---|---|---|
   | free | **false** | **false** | 34 |
   | starter | false | false | 34 |
   | investor | true | true | 34 |
   | pro | true | true | 35 |
   | partner | true | true | 37 |
   | **business** | *(fehlt)* | *(fehlt)* | **10** |
   | **enterprise** | *(fehlt)* | *(fehlt)* | **13** |

   **B1 ist damit zu korrigieren, und zwar zu meinen Lasten:** Ich hatte
   geschrieben, „Free bekommt zwei Funktionen, die die Landing ihm nicht
   verspricht". Richtig ist: **die Datenbank führte für Free längst `false`**,
   und die DB ist laut `config.js:568` die Quelle der Wahrheit — `config.js`
   ist nur der **Fallback**, solange `Sub.hasCachedFeature` noch `null`
   liefert. Für einen echten Free-Nutzer war das Gate also zu.

   **Was `v1160` dann wirklich behebt:** das **Startfenster**. Zwischen
   Seitenaufbau und DB-Antwort greift der Fallback, und dort stand `true`.
   In diesem Moment sah ein Free-Nutzer Felder, die ihm nicht zustehen.
   Das Fenster ist jetzt zu. **Kleiner als der Befund klang, aber echt** —
   und die drei Wahrheiten sagen jetzt dasselbe, was für sich zählt.

   #### B6 · `business` und `enterprise` sind unvollständige Plan-Datensätze

   Sie führen **10 bzw. 13 Schlüssel** statt 34. Alles, was fehlt, ist für
   sie `false` — dieselbe W41-Mechanik. Beide sind in der Landing und im
   pricing-modal **nicht** aufgeführt, also vermutlich nicht verkauft.
   **Vor dem Aufräumen prüfen, ob ein Konto darauf läuft:**
   `select id, plan_id from subscriptions where plan_id in ('business','enterprise');`
   Ist niemand darauf, gehören die Zeilen weg oder auf 34 Schlüssel gebracht.

   #### Was weiterhin offen ist

   Der **Plan-Override greift nicht**: `dp_plan_override` auf `'free'` gesetzt
   und neu geladen — `currentKey()` blieb `partner`. Ein Prüflauf „je Plan
   durchklicken" ist damit **im Frontend nicht simulierbar**; es braucht je
   ein echtes Konto. Ob der Override tot ist oder anders heißt, ist nicht
   geklärt — **erst messen, bevor jemand ihn benutzt.**

7. **Spracheingabe soll alle Felder füllen — Pre-Flight und QuickBoarding**

   Der inhaltlich größte Punkt der Runde. **Zwei Oberflächen, ein
   Rechenweg.**

   ### Was Marcel will

   - **In der Pre-Flight-Karte** („Top-Objekt") sollen per Sprache **alle**
     Felder befüllbar sein, die es in Objekt, Investition, Miete,
     Finanzierung, Bewirtschaftung und Steuer gibt.
   - **Genanntes einsortieren, nicht wegwerfen:** Risiken und Mängel gehören
     unter **bekannte Risiken**, ein genanntes Vorhaben unter
     **Investitionsthese**.
   - **Der Rest wird ein ordentlicher Text** unter **zusätzliche Notizen** —
     alles, was sich nicht auswerten ließ, statt es zu verlieren.
   - **Im QuickBoarding gibt es weniger Felder** — aber **dieselbe
     Rechenlogik im Hintergrund.**
   - **Beim „Als Objekt speichern"** öffnet sich ohnehin ein kleines Modal.
     Dort soll stehen: *es gibt weitere Werte, die mit übernommen werden* —
     **mit Auflistung**, und mit den Texten der Zusammenfassung.

   ### Was davon schon steht — und was das für den Punkt heißt

   **Die Doppelstruktur existiert bereits**, das ist die gute Nachricht:
   `buildCatalog` ist die kuratierte Liste für den Orbit, `buildFullCatalog`
   nimmt **alle** `window.FIELDS` für die Auswertung. Im QuickCheck-Kontext
   wird auf `QC_IDS` gefiltert. Der Weg „wenig Felder vorn, volle Auswertung
   hinten" ist also **angelegt** — es geht nicht um einen Neubau, sondern um
   Vollständigkeit und um das, was der Nutzer davon sieht.

   **Deshalb ist der erste Schritt eine Zählung, kein Entwurf:** wie viele
   Felder kennt `buildFullCatalog` heute, wie viele stehen in den sechs
   Reitern, **und welche fehlen?** Erst diese Differenz macht den Punkt
   bezifferbar.

   **Drei Dinge, die dabei zu klären sind:**

   1. **Freitext ist etwas anderes als ein Feld.** Risiken, These und Notizen
      sind Prosa; die Zuordnung „das war ein Mangel" trifft das Modell, nicht
      ein Muster. Das ist der Teil, der wirklich neu ist.
   2. **Nichts stillschweigend verwerfen.** Marcels Kernsatz ist „eigentlich
      soll alles vernünftig ausgewertet werden" — der Auffangtext unter
      Notizen ist die Zusicherung, dass nichts verschwindet. **Er ist Teil
      des Punktes, kein Beiwerk.**
   3. **Kerosin.** Eine längere Auswertung über alle Felder kostet mehr als
      die heutige. Ob das den Preis ändert, ist eine Geldfrage → Marcel.

   **Das Übernahme-Modal im QuickBoarding ist der sichtbarste Teil** und
   gleichzeitig der billigste: es zeigt, was ohnehin schon übertragen wird.
   Wenn dort steht, was alles mitkommt, versteht der Nutzer zum ersten Mal,
   was die Spracheingabe geleistet hat.

   **→ Zählung zuerst, dann Demo des Modals, dann bauen.**

---

8. **Der Sachwertfaktor fehlt für alle Kreise außer zweien — ein
   Datenvorhaben, kein Defekt.**

   > **Am 2026-08-12 präzisiert.** Hinterlegt sind **zwei** Kreise als
   > eigene Module: **Minden-Lübbecke** (`05770`,
   > `lib/sachwertfaktoren_nrw.js`) und **Herford** (`05758`,
   > `lib/sachwertfaktoren_herford.js`), aufgelöst über
   > `lib/gutachterausschuss.js`. Dass sie wirken, ist inzwischen belegt —
   > siehe Punkt 2, dort kam 0,925 Stufe A aus dem Herforder Bericht.
   >
   > **Für jeden weiteren Kreis braucht es den Grundstücksmarktbericht
   > selbst**, nicht Code: die Sachwertfaktor-Matrix wird je Ausschuss
   > abgeleitet und ist ausdrücklich **nicht übertragbar** (§ 10
   > ImmoWertV, der Modulcode sagt das auch so). Ein Objekt außerhalb der
   > beiden Kreise bekommt korrekt `anderer_ausschuss` und bleibt beim
   > vorläufigen Sachwert — das ist die Regel „kein Treffer heißt kein
   > Wert", nicht ein Fehler.
   >
   > **Zu entscheiden ist deshalb zuerst, welche Kreise überhaupt
   > gebraucht werden** — danach ist es Fleißarbeit je Kreis, keine
   > Programmieraufgabe. Marcel gibt vor, welche.

   > **Am 2026-08-12 nachgemessen und in einem Punkt korrigiert.** Die
   > Überschrift hieß hier zuerst „…deshalb bleibt **jeder** Sachwert ein
   > vorläufiger". Das war zu pauschal und hätte die Suche in die falsche
   > Richtung geschickt. **Für Eigentumswohnungen gäbe es auch mit voller
   > Ernte keinen Faktor** — der Gutachterausschuss leitet Sachwertfaktoren
   > nur für Ein- und Zweifamilien-, Doppel- und Reihenhäuser ab
   > (Abschnitt 5.1.4). Der Erntebefund unten bleibt richtig, er trifft
   > aber **die Häuser**, nicht das Prüfobjekt.
   >
   > **Der Einstiegspunkt von gestern ist damit abgearbeitet:** Ein Faktor
   > war sogar schon gepflegt — **1,15 stand im Feld** und kam als
   > `sachwertfaktor: 1.15` sauber im Payload an. Der Bericht verwirft ihn
   > trotzdem, mit Begründung im Antwortobjekt
   > (`sachwertfaktor_grund: "objektart_nicht_abgeleitet"`). Der Sachwert
   > blieb bei 268.172 €. **Das ist richtig so** — ein Sachwertfaktor auf
   > eine ETW angewandt wäre ein Modellbruch.
   >
   > **Offen bleibt daraus ein eigener Punkt:** Der gepflegte Wert wird
   > *stillschweigend* verworfen. Wer 1,15 einträgt, bekommt keinerlei
   > Rückmeldung, dass die Angabe für diese Objektart wirkungslos ist —
   > siehe Punkt 2.
   >
   > **Der Nachweis der Kette steht damit noch aus** und braucht ein
   > **EFH oder ZFH**. Auf Staging bietet sich `Löhner Str. 278`
   > (32120 Hiddenhausen, ZFH) an — das zweite Testobjekt aus `CLAUDE.md`.
   > Dort greift die Objektart, und dort schlägt dann auch die leere Ernte
   > durch.

   Gemessen am 2026-08-12 in `mb.wert_parameter`:

   | Typ | Einträge |
   |---|---|
   | `lzs` | 530 |
   | `rnd` | 523 |
   | `miete_qm` | 522 |
   | `bwk_pct` | 495 |
   | `gnd` | 494 |
   | **`sachwertfaktor`** | **0** |

   **Die Abfragekette ist in Ordnung** — `WertParameterService.sachwertfaktor()`
   nimmt zuerst eine eigene Angabe (Stufe E), sonst den amtlichen Wert aus
   der Tabelle. Sie zieht also einen, sobald einer da ist. Es ist nur
   keiner da: als einziger Parametertyp wurde er nie mitgeerntet.

   **Folge:** Der Sachwert bleibt der **vorläufige** nach § 35 ImmoWertV,
   die Marktanpassung nach § 21 Abs. 3 / § 39 unterbleibt. Am Prüfobjekt
   Hüllhorst stehen deshalb 268.172 € gegen Vergleichswert 192.000 € und
   Ertragswert 191.339 € — ein Abstand von 40 %, der **allein** aus dem
   fehlenden Faktor stammt: 191.500 / 268.172 = **0,71**, für die Lage und
   Baujahr 1962 ein völlig üblicher Wert. Der Bericht kennzeichnet es
   korrekt („ohne Sachwertfaktor — Herstellungskosten, kein Marktwert"),
   aber wer nur die drei Zahlen sieht, hält eine für falsch.

   **Zu tun:** Sachwertfaktoren in die Ernte aufnehmen. Sie stehen in
   denselben Grundstücksmarktberichten wie der Liegenschaftszinssatz —
   `WNHK-1` sagt dazu „die Ernte liefert beides oder keines", und
   tatsächlich liefert sie nur eines. **Zugriff nur über
   `lib/gutachterausschuss.js`** (CLAUDE.md), nie ein Modul direkt.

   ### → Hier weitermachen

   **Der Nachweis der Abfragekette braucht ein Haus, keine Wohnung.**
   Vorschlag: **`Löhner Str. 278`, 32120 Hiddenhausen (ZFH)** — das zweite
   Testobjekt aus `CLAUDE.md`, mit bekanntem Verkehrswert 350.094,36 €.

   1. Objekt im Marktbericht wählen, Stufe 3, **Sachwertfaktor eintragen**
      — **Marcel gibt den Wert vor**, er ist der Sachverständige.
   2. Bericht ziehen und drei Dinge messen:
      - Wandert der Sachwert vom vorläufigen auf den marktangepassten Wert?
      - Trägt die Karte **„marktangepasst · Faktor x"** statt „vorläufig ·
        ohne Sachwertfaktor" (die Unterzeile gibt es seit `v1143`)?
      - Steht die Herkunft als **Stufe E, „eigene Angabe"** dabei — so wie
        der Liegenschaftszinssatz es tut?
   3. Läuft das durch, ist die Kette bewiesen und der Punkt reduziert sich
      auf die **Ernte**.

   **Vorher prüfen, was der Abruf kostet.** Für `07d89138` (Hüllhorst) war
   Stufe 3 bezahlt und jeder weitere Lauf stand auf 0 L; für ein anderes
   Objekt gilt das **nicht** — `stufenpreis` fragen und Marcel den Preis
   nennen, bevor Kerosin fließt.

   **Der Abruf blockiert unter Automation**, solange `window.confirm` nicht
   ersetzt ist (`marktbericht-app/app.js:224`, Kostenhinweis v647-cost) —
   siehe `FALLEN.md`.

9. **Der Objektnummer fehlt auf cremefarbenem Grund der Kontrast.**
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

10. **Der Sachwert kennt den Miteigentumsanteil nicht.** Beim Prüfen der
   Eingabekette am 2026-08-12 gefunden: `lib/nhk2010.js` führt **weder
   `mea` noch `ist_wohnung`** — anders als `ErtragswertService.bodenwert()`,
   das beides auswertet. Der Sachwert einer ETW entsteht also ohne jede
   Kenntnis davon, dass nur ein Anteil bewertet wird.

   **Teilweise ist das unschädlich, und zwar genau geprüft:**
   - Der **Gebäudeteil** ist über die BGF der Wohnung bemessen (195 m² bei
     100 m² Wohnfläche), also implizit anteilig.
   - Die **Außenanlagen** entstehen als Prozentsatz des Gebäudewerts
     (`nhk2010.js:797`) und skalieren damit automatisch mit.
   - Der **Bodenwert** kommt MEA-gekürzt aus dem Ertragswert-Kern.

   **Offen bleibt die Garage:** `garagen_bgf_qm` ist ein **roher
   Eingabewert**, der ungekürzt durchläuft. Am Prüfobjekt stehen dort
   **64,58 m² × 485 €/m² × 2,02 = 37.118 €** — für eine einzelne Wohnung
   in einem Haus mit drei Einheiten viel. Ist der Wert für das gesamte
   Grundstück gepflegt, ist der Sachwert um bis zu ~18.500 € zu hoch.

   **Das ist eine Eingabefrage, kein Rechenfehler** — der Kostenhinweis
   sagt wörtlich „Der Bericht rechnet mit dem, was hier steht."

   **BLOCKIERT:** Ob das Feld wohnungs- oder gebäudebezogen gemeint ist,
   entscheidet Marcel fachlich — davon hängt ab, ob dort eine MEA-Kürzung
   hingehört oder nur eine deutlichere Feldhilfe (die seit `v1142` steht
   und den fehlenden Abzug bereits benennt).

11. **Wallet: kein Abstand zwischen Objektbild, Kaufpreis und „privat"**

   Die drei Elemente kleben aneinander. **Das ist derselbe Bereich, in dem
   schon einmal „privat" auf dem Preis lag** — beim Zusammenführen prüfen, ob
   es der alte Befund in neuer Form ist.

   **Am Raster messen, nicht am Farbtoken.** Ohne Vorlage ist der Bereich
   sauber, erst mit umgestellter Vorlage rückt alles zusammen — die Ursache
   liegt also im Abstandsraster, nicht in der Farbe. Und beim Nachmessen die
   `v1105c`-Lehre mitnehmen: das Goldband ist ein `::before`, ein Leser, der
   nur die Elternkette abläuft, sieht es nicht.

   **Dazu Marcels zweite Vorgabe an derselben Karte:** *„achte darauf, dass
   alle Werte immer angegeben werden, die wir brauchen."* Das ist ein eigener
   Prüfschritt — **welche Angaben gehören auf die Karte, und fehlt eine
   davon?** Die Liste gehört mit Marcel abgestimmt, nicht von mir geraten;
   danach wird gezählt, ob jede tatsächlich erscheint (und was passiert, wenn
   sie leer ist — `_euro(null)` liefert `"–"` und ist **truthy**, ein
   `||`-Rückfall greift dort nie).

   **Gehört zu Punkt 4** — dort steht derselbe Kartenbereich. Beim
   Aufgreifen zusammenlegen, nicht doppelt bauen.

## Später


- **Dieselbe Sweeper-Falle trifft alle Regler am Body-Inline-Stil.**
  Struktureller Befund aus `v1157`, nicht mitgebaut — Scope.

  `whitelabel-override.js` merkt sich in `_touchedAttr` den **Originalwert**
  jedes `[style]`-Attributs, das es anfasst. Bei einem Akzentwechsel ruft
  `apply()` (Z. 483) `reset()`, und das spielt die Originale per
  `setAttribute` zurück. **Jede Nutzeränderung am Body-Inline-Stil, die nach
  dem ersten Sweep kam, ist damit weg.**

  Betroffen sind mindestens: **`--dp-obj-text`** (Regler „Objektkarten", steht
  bewusst noch auf dem alten Weg) und **die sechs Bereichsfarben** aus
  `BEREICHE` in `ui-varianten.js` (`_dpDispHeader`, `_dpDispSide`,
  `_dpDispText`, `_dpDispHero`, `_dpDispKpi`, `_dpDispObj`) — falls sie
  ebenfalls an `body.style` schreiben. **Das ist zu messen, nicht zu
  vermuten:** je Regler einen Wert setzen, Akzent wechseln, nachsehen ob er
  überlebt.

  **Der Weg ist bekannt** und in `v1157` einmal gegangen: ein eigenes
  `<style>`-Element statt `body.style`. Fremde Stylesheets kann der Sweeper
  nur lesen, nicht zurücksetzen. **Erst messen, welche Regler betroffen sind,
  dann alle in einem Paket umstellen** — nicht sechs Einzelfixes.


- **ERLEDIGT (v1157) — der Tab-Text-Regler hielt keinen Akzentwechsel aus.**
  Halber Erfolg aus `v1155` (Backlog-Punkt 6), ehrlich benannt.

  **Was behoben ist:** Der Regler war doppelt tot. Gemessen mit dem
  Kaskaden-Walker über **alle** Stylesheets: seine Leser-Regel hing an
  `body.dp-chrome-hell` (im Obsidian-Modus also niemand), und **elf** Regeln
  setzen `color: var(--gold …)` auf `nav.tabs .tab`, **zehn mit
  `!important`**. Ein Token allein verliert dagegen immer. (Mein `grep` fand
  sie nicht — sie stehen in Kommalisten. Nur der Kaskaden-Blick im Browser
  zeigte sie.) `v1155` setzt deshalb `body.dp-tabtext-an` und eine Regel mit
  Spezifität **(0,6,4)** gegen die stärkste Gegenregel (0,5,2), am Dateiende.
  **Nachgemessen: direkt nach dem Laden wirkt der Regler** — Tab-Text ging von
  rgb(201,168,76) auf **rgb(255,0,0)**.

  **Was offen ist:** Nach einem **Akzentwechsel** steht am Body-Inline-Stil
  `--dp-tab-text: <Akzentwert>` statt des Nutzerwerts, und der Regler wirkt
  nicht mehr. Meine Regel **gewinnt** weiterhin (per Walker bestätigt: 604,
  `!important`, letzte Reihe) — sie liest nur einen überschriebenen Wert.

  **Was schon ausgeschlossen ist:** Es sind **nicht** die drei bekannten
  Setter. `grep` findet nur `_dpDispTabText`, den Boot-Block und die
  Reset-Liste; ein Patch auf `CSSStyleDeclaration.setProperty` fing beim
  Akzentwechsel **keinen** fremden Aufruf. Daraus folgt: der Setzer schreibt
  **nicht** über `setProperty`, sondern über `style.cssText` oder
  `setAttribute('style', …)` — dort greift der Patch nicht.

  **Nächster Schritt, konkret:** `whitelabel-override.js` hat einen `sweep()`
  mit `attributeFilter: ['style', …]`, der genau so arbeiten könnte. Also
  `style.cssText` und `setAttribute` patchen (nicht `setProperty`) und den
  Akzentwechsel wiederholen. **Erst wenn der Setzer benannt ist, wird
  gebaut** — nach drei Anläufen an dieser Stelle war STOPP richtig.

  **Kein Schaden im Auslieferungszustand:** ohne Nutzerwert wird weder Klasse
  noch Token gesetzt, alles bleibt bitgenau wie vorher (nachgemessen).

- **Punkt 5 (Grundfarbe) braucht eine Entscheidung, kein Patch.**
  Gemessen: **ohne Vorlage wirkt die Grundfarbe** (Sidebar rgb(11,18,32),
  Tabs rgb(21,27,41), Kopfverlauf mit). **Mit** Vorlage `kontor` sind Sidebar
  und Tabs weiß und ein Wechsel der Grundfarbe ändert **nichts** — der Wert
  wird aber gespeichert (`ui_obsidian`). Ursache: alle drei Regeln in
  `css/ui-varianten.css` beginnen mit `html:not([data-ui-theme])`.

  **Das ist ein stiller Rückfall** und in dieser Form falsch. Zwei Wege:
  **(A)** die Grundfarbe wirkt auch unter Vorlagen — großer Eingriff, jede
  Vorlage müsste sie respektieren, und eine dunkle Grundfläche unter der
  hellen Vorlage „Kontor" widerspricht deren Zweck.
  **(B)** der Regler wird unter aktiver Vorlage **sichtbar gesperrt** mit
  einem Satz Begründung — klein, ehrlich, und das Muster gibt es schon
  (`.dpuv-lockbar`, „sichtbar gesperrt ist ehrlicher als versteckt").
  **Empfehlung: B.** Entscheidung liegt bei Marcel.
- **`exportPdf()` erzeugte bei einem wiedergegebenen Bericht keine Ausgabe.**
  Beim Nachweis zu `v1149` gemessen: Report 73 über `/reports/one` geholt
  (voller Datensatz: `ref` `meta` `rent` `sale` `macro` `micro` `zensus`
  `address` `dealpilot` `valuation` `assessment` `deal_score` `land_value`
  `cross_check` plus `report_md`), dann `exportPdf(out)` aufgerufen. **Kein
  Fehler, aber null `doc.text`-Aufrufe** — die Funktion steigt still aus.
  **Nicht getrennt ist, ob das am Produkt liegt oder am Messaufbau** (der
  Patch überschrieb neben `text`/`addPage`/`save` auch `output()`, und wenn
  `exportPdf` seinen Blob über `output()` holt, könnte das der Grund sein).
  **Erst trennen, dann urteilen:** denselben Lauf ohne `output`-Patch
  wiederholen. Ist es das Produkt, wäre es ein echter Befund — ein
  wiedergegebener Bericht ohne PDF.

- **Die eingeklappte Leiste hat kein Bedienelement.** Beim Regressionstest zu
  `v1148` gemessen (1100 px): die CSS-Regeln für den 66-px-Rail existieren
  (`css/style.css:32816` und `:33060`, `body.dp-sidebar-collapsed`) und
  funktionieren einwandfrei, wenn man die Klasse setzt — **aber
  `#dp-sb-toggle` gibt es im DOM nicht**, und es existiert keine globale
  Toggle-Funktion (`toggleSidebar`, `dpSbToggle`, `sbToggle` — alle nicht
  vorhanden). Die Treffer auf `[class*=collapse]` sind `v212-collapse-toggle`,
  also Aufklapper **im Inhalt**. Entweder gehört der Weg dorthin gebaut oder
  die Regeln gehören weg — **erst entscheiden, dann anfassen**, und vorher
  prüfen, ob der Zustand über einen anderen Weg (Tastatur, Einstellungen,
  gemerkter Merker) doch erreichbar ist.

- **Drei Befunde aus der Konsolidierung der Projektanweisung (2026-08-12).**
  Beim Zusammenführen von `PROJEKTANWEISUNG.md` gemessen, nicht gebaut:

  1. **`frontend/style.css` ist eine Leiche** — 27.477 Zeilen, 842 KB, Stand
     03.08., und **keine einzige** HTML-Datei lädt sie. Gegenprobe:
     `grep -o 'href="[^"]*style\.css[^"]*"' frontend/*.html` liefert genau
     einen Treffer, und der zeigt auf `css/style.css`. Die alte
     Projektanweisung behauptete das Gegenteil — wer ihr folgte, patchte die
     tote Datei. Löschen ist ein **eigenes Paket, nie am Rollout-Tag**.
  2. **`_dpDispSkin` ist doppelt definiert** — `js/settings.js:3130` und
     `:3364`. In JS gewinnt die letzte; nur die schaltet zusätzlich
     `dp-hdr-compact`. Die tote erste Fassung entfernen, eigenes Paket.
  3. **Der Vorwegsetzer kennt zwei Werte nicht.** `index.html:46`
     (`v1082-uv-boot`) führt bei `data-ui-cards` nur `['kompakt','wallet']` —
     **`stapel`** (v1095) fehlt, und `data-ui-form` (v1098) fehlt ganz. Folge:
     für diese Nutzer blitzt beim Neuladen die DealPilot-Fassung auf, genau
     das, was der Setzer verhindern soll. Zwei Zeilen — **geht im nächsten
     Frontend-Paket mit**, kein eigenes Vorhaben.

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

- [2026-08-13] **`business` und `enterprise` sind gelöscht** — `v1161` + DB-Eingriff, `0a488f5`.
   Marcels Freigabe: „ja kann weg." Erledigt in der Reihenfolge, die der
   Vorbefund verlangte: **erst der Code, dann die Zeilen.**

   ### Schritt 1 — die vier Stellen geräumt (`v1161`)

   | Stelle | Änderung |
   |---|---|
   | `backend/routes/subscription.js:220` | `VALID_PLANS` ohne `'business'` — ein akzeptierter `planId` ohne Zeile in `plans` wäre in einen Fremdschlüsselfehler gelaufen |
   | `backend/db/seed-demo.js:265` | Demo-Abo auf **`'pro'`** statt `'business'`. Pro, weil der Kommentar den Zweck nennt: „damit er ohne Limits durchprobieren kann". `SEED_DEMO_DATA` ist auf Staging **true** |
   | `frontend/js/config.js:709` | `'business'` aus `bankExportPlans` (toter Eintrag) |
   | `frontend/js/rnd-ui.js:32` | `'business'` aus `requirePlan` (toter Eintrag) |

   **Bewusst stehen geblieben:** die **vier** Legacy-Rückfälle auf `free` —
   `config.js:462`, `subscription.js:693`, `settings.js:812` und
   `planService.js:118`. Sie fangen Altbestände, die noch auf `business`
   zeigen könnten. Beim Räumen fiel der vierte erst auf; er war in der
   Vorbefund-Liste nicht erfasst.

   **Rebuild gefahren**, Marker im laufenden Container geprüft, und dort
   steht jetzt wörtlich `const VALID_PLANS = ['free', 'starter', 'investor', 'pro']`.

   ### Schritt 2 — die Zeilen gelöscht

   Vorbedingung geprüft: **kein Abo zeigte darauf** (partner 3, free 1,
   starter 1). `pg_dump` der Tabelle
   (`/root/plans-vor-delete-20260813-0941.sql`, 9,3 K), dann **Probelauf per
   `BEGIN; DELETE; SELECT; ROLLBACK;`** — er meldete `DELETE 2` und fünf
   verbleibende Pläne. Danach echt ausgeführt.

   **Nachweise nach dem Löschen:**

   | Prüfung | Ergebnis |
   |---|---|
   | `plans` | 5 Zeilen: free, starter, investor, pro, partner |
   | öffentliche API (`GET /api/v1/plans`) | **4** Pläne — free, starter, investor, pro |
   | Fremdschlüssel-Waisen | **0** |
   | Abos | unverändert (free 1, starter 1, partner 3) |
   | Backend-Logs | ohne Ausnahme |

   **Zweimal Cache-Neustart nötig:** `listPublicPlans()` filtert aus einem
   In-Memory-Cache — eine DB-Änderung allein wirkt nicht, `docker restart
   dealpilot-backend` leert ihn. Das gilt für jeden Plan-Eingriff.

   **Nur Staging.** Auf Produktion sind die Zeilen unangetastet; der
   SSH-Zugang dorthin ist read-only. **Vor einem Prod-Rollout gehört derselbe
   Ablauf dort wiederholt** — Dump, Probelauf, DELETE, Cache-Neustart —, und
   zwar erst nachdem `v1161` dort ausgerollt ist. Sonst akzeptiert das alte
   Backend weiter `'business'` und schreibt einen Fremdschlüssel ins Leere.

- [2026-08-13] **`business` und `enterprise` sind aus der öffentlichen Plan-Liste verschwunden** — DB-Eingriff auf Staging, kein Code geändert.
   **Marcels Wort:** „business und enterprise gibt es gar nicht mehr,
   eigentlich können die raus, wenn die nicht für irgendwas sinnvoll sind."
   Die Bedingung war der Prüfauftrag — und sie ist **teils erfüllt, teils
   nicht.**

   **Was gemessen wurde:**

   | Frage | Antwort |
   |---|---|
   | Läuft ein Abo darauf? | **nein** — nur `partner` (3), `free` (1), `starter` (1) |
   | Stripe-Produkt? | **keins** — nicht kaufbar |
   | Waren sie sichtbar? | **ja** — `is_public = t`, also in der öffentlichen API |
   | Preise | business **5.900 ct = 59 €**, identisch mit Investor; enterprise 299 € |
   | Fremdschlüssel | `subscriptions.plan_id → plans.id` |

   **Sofort erledigt, weil ohne Risiko:** `is_public = false, is_active = false`
   für beide. Mit `pg_dump` der Tabelle davor
   (`/root/plans-vor-v1161-20260813-0924.sql`) und **Probelauf per
   `BEGIN; … ROLLBACK;`**, wie die Regel es für Eingriffe in bestehende Zeilen
   verlangt. Der Probelauf hat dabei einen eigenen Quoting-Fehler gefangen
   (`'business '` mit Leerzeichen traf null Zeilen) — genau dafür ist er da.

   **Nachgewiesen:** die öffentliche API
   (`GET /api/v1/plans` über Caddy, HTTP 200) liefert jetzt **vier** Pläne —
   `free`, `starter`, `investor`, `pro`. `business`/`enterprise`: **0
   Treffer.** Dafür war ein `docker restart dealpilot-backend` nötig:
   `listPublicPlans()` filtert aus einem **In-Memory-Cache**, nicht direkt aus
   der DB.

   ### Warum NICHT gelöscht wurde — sieben Stellen hängen daran

   | Stelle | was dort steht | muss vor dem DELETE |
   |---|---|---|
   | `backend/routes/subscription.js:220` | `VALID_PLANS` akzeptiert `'business'` | **raus** — sonst läuft ein Checkout in einen Fremdschlüsselfehler |
   | `backend/db/seed-demo.js:265` | erzeugt ein **`business`-Abo** | **umstellen** — `SEED_DEMO_DATA` ist auf Staging `true`, das Seed läuft |
   | `frontend/js/config.js:709` | `bankExportPlans: [… 'business']` | raus (toter Eintrag) |
   | `frontend/js/rnd-ui.js:32` | `requirePlan: ['pro','business']` | raus (toter Eintrag) |
   | `config.js:462`, `subscription.js:693`, `settings.js:812` | Legacy-Rückfall auf `free` | **bleibt** — schützt Altbestände |

   **Reihenfolge für das echte Löschen:** erst die vier oberen Stellen räumen
   (Backend → **Rebuild**), dann prüfen, dass kein Abo entstanden ist, dann
   `DELETE FROM plans WHERE id IN ('business','enterprise')`. Vorher wieder
   ein Dump. **So lange sind die Zeilen unsichtbar und harmlos** — der
   sichtbare Schaden ist weg, der Rest ist Aufräumen ohne Eile.

   **Nebenbefund:** `business` trug **denselben Preis wie Investor** (59 €).
   Wer die Liste sah, bekam zwei Pläne zum gleichen Preis angeboten.

- [2026-08-13] **Die Pfeilmitte löste Löschen aus** — `v1159`, `c1f71b5`. **(Backlog-Punkt 6)**
   **Marcels Befund:** „Beim Hinüberfahren zum Pfeil landet man auf dem × zum
   Löschen." Er nannte ihn den schwersten der Kartenbefunde, **und das war
   untertrieben** — es war kein Optikfehler, sondern eine falsche Aktion mit
   Datenverlust.

   **Gemessen** (`getBoundingClientRect` + `elementFromPoint`, Stapelmodus):

   | Element | Rechteck | Größe |
   |---|---|---|
   | `.sbc-actions` (Duplizieren + Löschen) | `top:6px`, 48 × 22 | — |
   | `.sbc-arrow` | `top:16px` | 20 × 20 |

   Beide `absolute` bei `right:6px` → **12 px Überlappung von 20 px
   Pfeilhöhe.** Und der entscheidende Nachweis: **die MITTE des Pfeils
   (349,203) traf `sbc-btn "Löschen"`** — nicht den Pfeil. Erreichbar war er
   nur über sein unteres Drittel. **Wer auf die Pfeilmitte zielt, löscht das
   Objekt.**

   **Die Pfeilspalte alle 4 px abgetastet** — damit ist Marcels Satz „unten
   ist Platz, oben nicht" belegt, nicht geglaubt:

   | von oben | wer |
   |---|---|
   | 8–28 px | Löschen-× (reicht weiter als seine 22 px) |
   | 32–36 px | Pfeil (~8 px wirklich erreichbar) |
   | 40–60 px | **frei** |

   **Gelöst:** `bottom:4px` statt `top:16px`, Größe 20 → 22 px (dieselbe wie
   der Kompakt-Pfeil — eine Größe für denselben Pfeil).

   **Nachgemessen** (`ui-varianten.css?v=v1159`):

   | | vorher | jetzt |
   |---|---|---|
   | Pfeil | 193–213, 20 × 20 | **210–232, 22 × 22** |
   | Abstand zum × | **−12 px (Überlappung)** | **+5 px** |
   | Klick auf Pfeilmitte | `sbc-btn "Löschen"` | **`sbc-arrow`** |
   | Pfeil oben / unten | teils Löschen | **beide `sbc-arrow`** |
   | Löschen-Mitte | Löschen | Löschen (unverändert) |

   **Funktion geprüft:** Klick klappt die Karte auf (`uv-open` false → true),
   die Drehung wechselt auf `rotate(-90deg)`.
   **Kompaktmodus gegengeprüft** (dort erscheint derselbe Pfeil): 327,207
   22 × 22, **keine Überlappung**, Mitte trifft den Pfeil. Betroffen war nur
   der Stapelmodus — im Kompaktmodus sitzt der Pfeil ohnehin anders.

   **Eine Absage mit Grund: 44 px sind hier nicht erreichbar.** Die Karte ist
   63 px hoch und trägt oben die Aktionen; ein 44-px-Pfeil läge wieder unter
   dem ×. Der Trefferflächen-Punkt aus v650/v652 bleibt damit offen — **die
   falsche Aktion ist weg, und das war das Schwere daran.**

   *(Messhinweis für den nächsten: die erste Kompakt-Messung war verfälscht,
   weil das Darstellungs-Panel noch offen über der Karte lag und
   `elementFromPoint` es traf. Panel schließen, dann messen.)*

- [2026-08-13] **Die Reiter tragen im hellen Modus die Tinte des Aktionen-Menüs** — `v1158` + `v1158b`, `399df3f`. **(Backlog-Punkt 7)**
   **Marcels Vorgabe:** „im hellen Modus sollen die Reiter dieselbe
   Schriftfarbe tragen wie das Aktionen-Aufklappmenü." Damit war die Zielfarbe
   **benannt statt beschrieben** — nur zu übernehmen, nicht zu gestalten.

   **Gemessen** (Merker `dp_chrome_hell` gesetzt und **neu geladen**, nicht im
   laufenden Tab umgeschaltet — `FALLEN.md` Punkt 6):

   | | vorher | Ziel |
   |---|---|---|
   | Aktionen-Einträge (11, alle gleich) | rgb(20,19,16) | — |
   | Reiter inaktiv | #6b6454 | rgb(20,19,16) |
   | Reiter aktiv | #211c12 | rgb(20,19,16) |

   **Drei hart kodierte Töne für eine Sache.** Der Punkt verlangte deshalb ein
   **gemeinsames Token** — jetzt führt der Hell-Skin `--dp-hell-ink:#141310`
   bei seinen anderen Ink-Tokens, und **alle sechs Leser** holen ihn dort. Der
   Ton ist nicht neu: es ist die „Tinte", die die helle Sidebar schon für die
   Objektadresse führt.

   `--dp-tab-text` steht in jedem Leser **davor**, damit der Nutzerregler aus
   `v1155`/`v1157` weiter gewinnt.

   ### `v1158b` — derselbe Selektor an drei Stellen, die dritte entschied

   Nach `v1158` trug **nur der aktive** Reiter die Tinte; die inaktiven blieben
   rgb(243,234,208). Ursache: der Selektor
   `body.dp-chrome-hell header.hdr.has-v64-score + nav.tabs .tab` steht
   **dreimal** in der Datei — bei 35346 (meine Änderung), bei 35489 in einer
   Liste **mit der Kopfzeile**, und bei 35605 im `v938`-Block. Bei gleicher
   Spezifität gewinnt die **späteste**, also `v938` mit dem Rückfall auf
   `--dp-header-text` — und der steht im Hell-Modus auf `#f3ead0`, weil der
   Kopf dunkel gespeichert ist.

   Zwei Korrekturen: der `v938`-Rückfall ist jetzt die Tinte, und **die
   Reiterleiste ist aus der Kopfzeilen-Liste herausgenommen** — zwei
   verschiedene Flächen gehören nicht in eine Regel.

   **Nachgemessen** (`style.css?v=W71`):

   | | Ergebnis |
   |---|---|
   | alle 9 Reiter | **rgb(20,19,16)** — eine Farbe |
   | Aktionen-Menü | rgb(20,19,16) — gleich |
   | Goldstrich am aktiven | rgb(201,168,76) — Unterscheidung bleibt |
   | Kopfzeile | rgb(243,234,208) — **unverändert** |
   | **Obsidian-Gegenprobe** | Reiter Gold, Sidebar rgb(10,10,10) — **unberührt** |

   **Der Nebenbefund aus dem Punkt** (`.sb-actions-accordion-inner` ist auch
   in dunklen Fassungen weiß) ist **nicht** mitgeprüft — er betrifft eine
   Fläche, nicht die Schriftfarbe, und bleibt im Punkt stehen.

- [2026-08-13] **Der Sweeper verwarf den Tab-Text des Nutzers** — `v1157` + `v1157b`, `c2d7e9b`. **(Backlog-Punkt 6, jetzt vollständig)**
   `v1155` machte den Regler wirksam, aber nur **bis zum nächsten
   Akzentwechsel**. Die Kette ist jetzt zu Ende gemessen:

   ```
   whitelabel-override.js sweepInline()   läuft über ALLE [style]-Elemente
     -> der <body> ist einer davon (dort standen unsere Custom Properties)
     -> merkt jede Änderung in _touchedAttr MIT ORIGINALWERT
   apply() Z. 483                          bei Akzentwechsel -> reset()
   reset()                                 spielt die Originale per
                                           setAttribute zurück
   ```

   **Alles, was NACH dem ersten Sweep in den Body-Inline-Stil geschrieben
   wurde, ist damit weg.** Nicht nur der Tab-Text — jeder Regler, der so
   arbeitet.

   **Gelöst:** der Regler schreibt in ein eigenes `<style id="dp-textfein-css">`
   statt an `body.style`. Fremde Stylesheets fasst der Sweeper nur **lesend**
   an (er sammelt Gold-Literale und schreibt umgefärbte Kopien in sein eigenes
   Overlay) — zurücksetzen kann er sie nicht. Der alte Body-Inline-Wert wird
   beim Setzen entfernt, weil er näher am Element liegt als `:root`.

   **Nachgemessen** (`settings.js?v=v1157`):

   | Schritt | Tab-Text |
   |---|---|
   | Start | rgb(201,168,76) |
   | Regler auf `#FF0000` | **rgb(255,0,0)** |
   | **Akzentwechsel auf `#0F6E6E`** | **rgb(255,0,0)** — hält |

   ### `v1157b` — eigene Fehlannahme, im Prüfstand widerlegt

   Ich hatte in den Kommentar geschrieben, der Sweeper färbe den Standardwert
   `#C9A84C` in diesem Sheet mit, der Tab-Text folge dann dem Akzent.
   **Er tut es nicht:** bei Akzent `#0F6E6E` und Reglerwert `#C9A84C` blieb
   der Tab-Text rgb(201,168,76). `_collect()` sammelt Farbwerte aus Regeln,
   aber keine Custom-Property-**Definitionen**.

   Das Verhalten ist trotzdem richtig, nur anders begründet — und so steht es
   jetzt im Code: **wer im Regler Gold wählt, bekommt Gold**, auch unter einem
   anderen Akzent. Der Regler ist eine Nutzerentscheidung, keine Ableitung.
   Wer den Akzent folgen lassen will, lässt den Regler unberührt; dann greift
   `dp-tabtext-an` nicht und die alten Gold-Regeln gelten wie immer.

   **Zustand hinterlassen:** Merker gelöscht, Sheet leer, Klasse weg,
   Einstellungen unverändert (Akzent `#C9A84C`, Grundfarbe `#050505`, keine
   Vorlage).

- [2026-08-13] **Die Grundfarbe wird unter einer Vorlage sichtbar gesperrt** — `v1156` + `v1156b` + `v1156c`, `8cc7af0`. **(Backlog-Punkt 5, Marcels Weg B)**
   **Gemessen war:** ohne Vorlage wirkt die Grundfarbe (Sidebar rgb(11,18,32),
   Tabs rgb(21,27,41), Kopfverlauf ziehen mit). **Mit** Vorlage `kontor` sind
   Sidebar und Tabs weiß, ein Wechsel ändert **nichts** — der Wert wird aber
   gespeichert. Ursache: alle drei Regeln in `css/ui-varianten.css` beginnen
   mit `html:not([data-ui-theme])`. **Ein stiller Rückfall.**

   **Marcels Entscheidung: Weg B** — sichtbar sperren statt wirken lassen.
   Begründung, die dafür spricht: eine dunkle Grundfläche unter der hellen
   Vorlage „Kontor" widerspricht deren Zweck; **die Vorlage IST die
   Flächenentscheidung.**

   Gebaut mit der vorhandenen Mechanik (`.dpuv-lock` / `.dpuv-lockbar`) —
   keine zweite Sperr-Optik. Der Text nennt den Grund **und** den Weg heraus:
   „Die Vorlage bestimmt die Flächen … die Grundfarbe gilt für die Fassung
   DealPilot … der **Akzent** wirkt in jeder Vorlage."
   Die Bedingung wird **nicht kopiert**, sondern am selben Attribut gelesen,
   das auch die CSS-Regeln prüfen — zwei Wahrheiten über dieselbe Bedingung
   liefen im Marktbericht dreimal auseinander.

   **Nachgemessen** (`ui-varianten.js?v=v1156c`, Bedienweg):

   | Zustand | gesperrt | Hinweis | Deckkraft |
   |---|---|---|---|
   | keine Vorlage | nein | aus | 1 |
   | Vorlage `kontor` | **ja** | **sichtbar** | 0,42 |
   | zurück auf DealPilot | nein | aus | 1 |

   ### Zwei eigene Nachbesserungen, beide im Prüflauf gefunden

   **`v1156b` — der Partner-Text landete in meinem Kasten.** `gateSetzen()`
   nahm `document.querySelector('.dpuv-lockbar')`, also die **erste** im
   Dokument. Bis `v1156` gab es nur eine; meine neue steht im Markup davor.
   Beide haben jetzt eine eigene Id. **Die Lehre ist die der Sammelregeln im
   CSS:** ein Selektor auf ein Element, von dem es plötzlich zwei gibt,
   trifft das falsche. Wer ein zweites danebenstellt, prüft die vorhandenen
   Selektoren darauf.

   **`v1156c` — die ausgegraute Sperre war nur eine optische.**
   `pointer-events:none` lässt die Knöpfe `tabIndex 0` und nicht `disabled`
   — **per Tabulator erreichbar und mit Enter auslösbar.** Das betraf nicht
   nur die neue Schranke, sondern **genauso die Partner-Schranke, dort seit
   `v1082`**. Beide tragen jetzt `inert` auf dem Innenteil: nimmt den
   Teilbaum aus Fokus und Zeiger, eine Zuweisung statt einer Durchzählung.
   Kennt der Browser `inert` nicht, bleibt es beim heutigen Verhalten — nie
   schlechter als vorher. Nachgemessen: `inert` gesetzt, **Fokus greift nicht
   mehr**.

   **Grenze des Nachweises, ehrlich benannt:** mein erster Sperrtest meldete
   „Wert wurde geändert" — **das war ein Messfehler.** Ein programmatisches
   `el.click()` ruft den Handler direkt auf und umgeht `pointer-events` und
   `inert` immer; ein echter Nutzer kann weder klicken noch fokussieren.
   **Wer eine Sperre prüft, messe Fokussierbarkeit und `disabled`/`inert` —
   nicht Klicks.** Ein Test mit echten Mauskoordinaten steht damit als
   letzter Schritt offen; die beiden Attribute sind gemessen.

   **Zustand hinterlassen:** Marcels Einstellungen unverändert (Akzent
   `#C9A84C`, Grundfarbe `#050505`, keine Vorlage, kein Tab-Text-Merker) —
   nach Reload gegengeprüft. Die Abweichung im laufenden Tab davor war der
   Inline-Rest aus `FALLEN.md` Punkt 6, kein Befund.

- [2026-08-13] **Das Werkzeug färbte sich mit** — `v1155`, `2347684`. **(Backlog-Punkt 4, der Defekt-Teil)**
   **Marcels Befund:** „Wählt Marcel Grün, wird das Gold am Kopf des
   Akzent-Bereichs mit grün. Wer eine Farbe *auswählt*, braucht eine neutrale
   Umgebung, sonst beurteilt er die Farbe gegen sich selbst."

   **Reproduziert** (Panel geöffnet, Akzent `#0F6E6E` über den Bedienweg
   geklickt): die Abschnitts-Überschrift wechselte von **rgb(154,127,51)** auf
   **rgb(8,45,45)**. Ursache waren **neun `--wl-`Tokens in der
   Bedienoberfläche** des Panels (`ui-varianten.js`): Überschriften,
   Knopfränder, aktive Zustände, der Schranken-Kasten.

   Der Dateikopf sagte das Richtige schon — „feste Werte, bewusst NICHT über
   die `--uv`-Tokens" — bei den `--wl-`Tokens war es nur nicht durchgezogen.

   **Gelöst mit Marcels eigener Trennlinie:** „die Vorschauflächen *sollen*
   mitgehen, der Rahmen darum nicht." Bedienoberfläche → feste Literale, und
   am Token bleibt **genau eine** Stelle: `.dpuv-pf.gold`, die Vorschaufläche.

   **Nachgemessen** (`ui-varianten.js?v=v1155`): bei Akzent `#0F6E6E` bleibt
   die Überschrift **rgb(154,127,51)** (Gold), die Vorschaufläche geht auf
   **rgb(15,110,110)** (Türkis). Genau die gewünschte Trennung.

   **Kein Whitelabel-Verstoß:** dieselbe Ausnahme gilt laut Projektanweisung
   für `config.js`, `branding-darstellung.js`, `darstellung-reseller.js` —
   „der Farb-Editor **muss** Literale tragen". Dies ist der Farb-Editor. Im
   Dateikopf vermerkt, damit `gold-audit.py`-Fundstellen erklärbar bleiben.

   *Der Ausbau-Teil von Punkt 4 (mehr Farben zur Wahl) bleibt offen — er
   braucht Marcels Entscheidung, welcher Art die Palette sein soll.*

- [2026-08-12] **Ankreuzfelder 33 px — die optische Abnahme ist nachgeholt** — kein Code geändert, `v1147b` bestätigt.
   Die Messung vom Mittag war **wertlos**: ohne geladenes Objekt und mit
   zugeklappten Reitern waren **0 von 26** Feldern sichtbar. Jetzt mit
   geladenem Objekt, allen Reitern durchgeklickt und `<details>` aufgeklappt:

   | Reiter | Felder | Größe | Überlauf |
   |---|---|---|---|
   | Objekt · Bewirtschaftung · Bewertung · Deal-Aktion | 0 | — | — |
   | Investition | 4 | 33 × 33 | keiner |
   | Miete | 1 | 33 × 33 | keiner |
   | Finanzierung | 1 | 33 × 33 | keiner |
   | Steuer | 2 | 33 × 33 | keiner |
   | **Pilot-Analyse** | **13** | 33 × 33 | keiner |

   **Bei 390 px gegengemessen** (der Ursprung des Punkts war der
   v1118-Handy-Durchgang): Steuer 2, Investition 4, Pilot-Analyse 13 Felder —
   **alle 33 × 33, kein Überlauf.** Die Zeilen tragen: Höhen 33/35 px, **kein
   Feld ragt aus seiner Zeile**, **kein Label-Text abgeschnitten**.
   Schalter (`.ji-switch`, `.toggle-slim`, `.fesh-tile`, `.dp-pf-tile`) sind
   wie vorgesehen ausgenommen und unverändert.

   **Ein eigener Messfehler, gefunden und korrigiert, bevor er zum Befund
   wurde:** Mein erster Überlauf-Prüfer meldete zwei Felder als „läuft aus
   `.main-col`". Falsch positiv — er warf `overflow-x` und `overflow-y`
   zusammen. Gemessen: `.main-col` hat **`overflow-x: hidden`** und
   **`overflow-y: auto`**. Senkrecht „unterhalb" heißt dort **scrollbar**,
   nicht abgeschnitten. Mit getrennt geprüften Achsen: kein Überlauf.

   **Das ist die Falle aus `FALLEN.md` Punkt 4** („ein Überlauftest prüft
   gegen den klippenden Vorfahren") in ihrer schärferen Form: **auch die Achse
   muss stimmen.** Ein Container, der waagerecht klippt und senkrecht
   scrollt, ist der Normalfall in dieser App — wer beides zusammenwirft,
   erfindet Befunde.

- [2026-08-12] **Die Differenz-Formel stand zweimal — jetzt eine Quelle** — `v1154`, `99a14db`.
   Sie stand in `_kerosinKosten()` (was **abgebucht** wird) und in
   `GET /stufenpreis` (was **angekündigt** wird). Beide rechneten dasselbe —
   Zeile für Zeile nachgeprüft. **Genau das ist die Gefahr:** laufen sie
   auseinander, wird 3 L angekündigt und 5 L gebucht. Das ist im Haus schon
   passiert (Marcels GELD-Befund „Stufe 1 bewirbt 2 L, abgebucht werden 5 L",
   behoben in `v1125`).

   Jetzt eine Funktion `_aufpreis(stufe, bezahlt)` mit zwei Aufrufern.
   **Verhalten unverändert, bewiesen** in node über alle 12 Kombinationen
   (Stufe 1–3 × bezahlt 0–3): alte Abbuchung = alte Auskunft = neue Quelle.

   | bezahlt | Stufe 1 | Stufe 2 | Stufe 3 |
   |---|---|---|---|
   | 0 | 2 L | 5 L | 12 L |
   | 1 | 0 | **3 L** | 10 L |
   | 2 | 0 | 0 | **7 L** |
   | 3 | 0 | 0 | 0 |

   Die 3 L und die 7 L sind genau Marcels Vorgabe — und die 7 L stehen als
   echter Vorgang im Kerosin-Log.

   **Rebuild gefahren** (Backend, keine Migration): Marker im laufenden
   Container `docker exec … grep -c` = 2, Logs ohne Ausnahme, `/stufenpreis`
   live geprüft und **identisch zum Stand vor dem Umbau**
   (`bezahlte_stufe 0`, `faellig {1:2, 2:5, 3:12}`, kein Fallback-Pfad).

- [2026-08-12] **`BEDARF` und `VERFAHREN[].pflicht` bleiben getrennt — eigene Empfehlung zurückgenommen** — kein Code geändert.
   Ich hatte nach `v1152` notiert, die beiden Listen der Pflichtangaben
   „gehören zusammengeführt". **Das war voreilig.** Vor dem Bauen gemessen:

   - **`BEDARF`** (`mb-stufen.js`) beantwortet: *was braucht die **Stufe**,
     damit der Nutzer sie erreichen und kaufen kann?* → Nutzerführung, Preis,
     Meilensteinleiste.
   - **`VERFAHREN[].pflicht`** (`wertermittlung.js`) beantwortet: *was braucht
     ein **Verfahren**, um zu rechnen?* → Rechenqualität, Ampel.

   **Das sind verschiedene Fragen.** Der Fehler in `v1152` war nicht, dass es
   zwei Listen gibt, sondern dass die Knopfsperre die Verfahrensliste gegen
   die falsche Stufe hielt (`ab` statt `genauerAb`). Eine Verschmelzung würde
   zwei Zwecke in einen Topf werfen und wäre ein Rückschritt.

   **Der scheinbare Widerspruch löst sich auf.** `markt.pflicht` enthält
   `baustatus`, `BEDARF` führt ihn erst auf Stufe 2 — kollidieren kann das
   nicht: das `<select id="baustatus">` hat **keine leere Option**, die erste
   ist `bestand`. Es trägt also **immer** einen Wert und kann nie als
   „fehlend" erscheinen. Das erklärt auch, warum es beim Leerversuch nicht in
   der Fehlt-Liste auftauchte.

   **Stehen gelassen, mit Absicht:** ein Pflichtfeld, das nie leer ist, tut
   keinen Schaden. Es zu verschieben wäre erst dann eine echte Änderung, wenn
   das Feld einmal eine leere Option bekommt — **dann** greift die Prüfung
   plötzlich, und dann gehört sie geprüft. Als Merkposten hier festgehalten,
   statt heute blind aufzuräumen.

- [2026-08-12] **Die Schrittleiste hat eine zweite Darstellung fürs Handy** — `v1153` + `v1153b`, `7fb691f`.
   **Marcels Befund:** „Es muss auf dem Handy funktionieren. Eine
   siebenteilige Schrittleiste nebeneinander und ein Handy schließen sich aus
   — der Entwurf braucht **zwei** Darstellungen derselben Führung, nicht eine
   gequetschte." **Marcels Wahl aus der Demo: Fassung C, die Klappleiste.**

   **Gebaut um dieselben Knöpfe.** Unter 900 px wird `#mbw-reiter` zur
   senkrechten Liste, darüber bleibt alles wie es ist. **Kein zweiter
   Reiter-Satz** — sonst laufen zwei Listen auseinander (Lehre aus v1096b und
   v1112b). Schwelle 900 px: dieselbe, an der die App auf den Drawer
   umschaltet, also zwei Fassungen und keine dritte Zwischenform.

   **Nachgemessen am ausgerollten Stand** (`mb-wizard.js?v=1153b` im iframe
   bestätigt):

   | Fenster | Führung | Kopfzeile | Liste |
   |---|---|---|---|
   | 390 px | **55 px** (vorher 188) | sichtbar, „1/7 Übersicht ▸", Balken 14 % | versteckt |
   | 820 px | **55 px** | sichtbar | versteckt |
   | 1024 px | 49 px | **unsichtbar** | 7 Marken in **einer** Zeile |

   **Alle drei Verhaltensregeln geprüft, über den Bedienweg (echte Klicks):**
   1. **Standard ist zu** — wer auf dem Handy ankommt, sieht Felder, kein Menü.
   2. **Aufklappen** → 7 Marken, Zeilenhöhe **48 px** (über dem 44-px-Maß),
      Liste 348 px, `aria-expanded=true`.
   3. **Wahl aus der Liste** → Schritt gewechselt („3/7 Zustand") **und
      zugeklappt**; **„Weiter"/„Zurück" lassen den Zustand unberührt** (offen
      blieb offen, Kopfzeile zog mit auf „4/7 Ausstattung").
   4. **Der Merker hält das Neuladen** (`dp_mb_leiste_zu`) — offen blieb offen.

   ### `v1153b` — eigener Fehler, im ersten Prüflauf gefunden

   `v1153` rief `klappBauen()` auf, **während die Reiterleiste noch nicht im
   Dokument hing**. `reiter.parentNode` war `null`, das `insertBefore` lief
   ins Leere, die Kopfzeile entstand nie — **`html.mbw-zu` wurde trotzdem
   gesetzt.** Gemessen bei 390 und 820 px: null Marken, Höhe 0, keine
   Kopfzeile. **Unter 900 px war damit überhaupt keine Führung sichtbar** —
   schlimmer als der Zustand davor.

   Zwei Änderungen: der Aufruf steht jetzt **nach** dem Einhängen, und
   `klappBauen()` **weigert sich, `mbw-zu` zu setzen**, wenn die Kopfzeile
   nicht gebaut werden konnte — der sichere Zustand ist *aufgeklappt*, die
   Führung darf nie ganz verschwinden. Dazu eine Konsolen-Warnung statt eines
   stummen Fehlschlags.

   **Die Lehre, die über den Einzelfall hinausgeht:** ein Zustand, der etwas
   **versteckt**, darf erst gesetzt werden, wenn der **Ersatz nachweislich
   steht**. Sonst wird aus einem halb gescheiterten Aufbau eine leere Seite.
   Verwandt mit `insertBefore` nur bei direktem Kind — hier hing der
   Referenzknoten gar nicht im Dokument.

- [2026-08-12] **Die Differenz-Abrechnung ist nachgewiesen — ohne einen Liter Kerosin** — kein Code geändert.
   Der Punkt war als Klicktest geplant, der echtes Guthaben kostet
   („Bucht Stufe 2 nach bezahlter Stufe 1 wirklich nur 3 L ab?"). **Er ist
   nicht nötig** — der Nachweis liegt in vier Teilen vor, alle lesend erhoben.

   **1 · Auskunft und Abbuchung rechnen dieselbe Formel.** Das war die
   eigentliche Gefahr: zwei Codestellen, die auseinanderlaufen — dann wird
   3 L angekündigt und 5 L gebucht (Marcels früherer GELD-Befund).

   ```
   /stufenpreis   faellig[s] = (bezahlt>=s) ? 0
                    : max(0, STUFENPREIS[s] - (bezahlt>=1 ? STUFENPREIS[bezahlt] : 0))
   _kerosinKosten  if (bezahlt >= st) return 0;
                   if (bezahlt >= 1)  return max(0, voll - (STUFENPREIS[bezahlt]||0));
   ```

   Gleiche Fälle, gleiche Konstante `STUFENPREIS`, gleiche Quelle für
   `bezahlt` (`aiCreditsService.bezahlteStufeMarktbericht`). **Deckungsgleich
   — aber zwei Stellen.** Solange es zwei sind, können sie auseinanderlaufen;
   als Punkt vermerkt.

   **2 · In der Praxis belegt, an einem echten Vorgang.** Im Kerosin-Log
   (`ai_credits_log`, Haupt-DB) steht für das ETW-Prüfobjekt:

   | Objekt | cost | wert_stufe |
   |---|---|---|
   | `07d89138…` (Hermannstraße 9) | **7 L** | 3 |
   | `3fbb754c…` (PRUEF_ZFH) | 12 L | 3 |

   **Die 7 L sind die Differenz 12 − 5**: dort wurde von bezahlter Stufe 2 auf
   Stufe 3 vertieft, und es kostete den Aufpreis, nicht den vollen Preis.
   Genau Marcels Vorgabe — bereits gelebt.

   **3 · Die Gutschrift ist kontobezogen, und das ist richtig.** Der Endpunkt
   meldete für `PRUEF_ZFH` `bezahlte_stufe: 0` und die vollen Preise, obwohl
   im Log 12 L stehen. **Kein Fehler:** die Zahlungen gehören
   `info@junker-immobilien.io`, der Prüflauf lief unter einem anderen Konto.
   `bezahlteStufeMarktbericht()` filtert auf `user_id` — jeder zahlt für seine
   eigenen Abrufe.

   **Achtung für künftige Prüfläufe:** die Backlog-Angabe „Stufe 3 bezahlt,
   weitere Marktberichte kosten 0 L" gilt **nur für das Konto, das bezahlt
   hat.** Unter einem anderen Konto kostet derselbe Bericht voll.

   **4 · Sieben Buchungen à 12 L auf dasselbe Objekt sind Altdaten, kein
   Doppelzahlungsfehler.** `def6e516…` trägt sieben volle Buchungen — alle vom
   **02.08.2026**, also **zehn Tage vor `v1125`**, das die Stufenpreise und die
   Gutschrift eingeführt hat. Damals gab es weder `wert_stufe` noch eine
   Ermäßigung. Datiert, bevor daraus ein Befund wurde.

   **Was ohne echten Doppelabruf offen bleibt:** der Durchlauf Stufe 1 → 2 im
   **selben** Konto. Punkt 2 zeigt denselben Mechanismus von Stufe 2 → 3; ein
   eigener Kauf würde nur die zweite Sprosse derselben Leiter prüfen.
   **Deshalb kein Kerosin ausgegeben.**

- [2026-08-12] **Stufe 1 war gesperrt, weil sie die Angaben von Stufe 3 verlangte** — `v1152`, `d17edac`.
   **Marcels Befund** aus der Entwurfs-Durchsicht: „Der Erzeugen-Knopf lässt
   sich nicht klicken, obwohl die Angaben für die einfache Einschätzung
   vollständig sind. Das muss ja irgendwie möglich sein." **Das war der Kern
   des ganzen Meilenstein-Gedankens** — steht der Knopf still, ist der Wizard
   wieder ein Pflichtdurchlauf.

   **Reproduziert** (Stufe 1, ETW, alle vier Angaben aus `BEDARF` gefüllt):
   der Knopf trug bereits **„Marktbericht erstellen · 2 L"**, war also über
   die erreichte Stufe im Bilde — blieb aber `disabled`, und sein Titel nannte
   als fehlend **„Grundstück (m²) · Wohneinheiten"**, die Pflichtfelder von
   Ertrags- und Sachwert. Also die Angaben von **Stufe 3**.

   **Ursache: `ab` und `genauerAb` bedeuten Verschiedenes.** Ertrags- und
   Sachwert stehen bewusst auf `ab: 1`, weil sie **immer** mitrechnen — „nur
   mit Pauschalen" (v1018). Ihre Pflichtfelder brauchen sie erst bei
   `genauerAb: 3`, wenn derselbe Kern mit echten Parametern rechnet.
   `knopfSperren()` prüfte aber gegen `ab`.

   **Zu den zwei Listen** (`BEDARF` in `mb-stufen.js` gegen
   `VERFAHREN[].pflicht` in `wertermittlung.js`): ich hatte hier notiert, sie
   „gehören zusammengeführt". **Das ist zurückgenommen** — sie beantworten
   verschiedene Fragen (Stufe für die Führung, Verfahren für die Rechnung)
   und bleiben getrennt. Begründung und die Auflösung des scheinbaren
   `baustatus`-Widerspruchs stehen unter Fertig.

   **Nicht angefasst: die Rechnung.** Fehlen `plot` und `units`, rechnet der
   Quercheck wie vorgesehen mit Pauschalen. Die Sperre war der Fehler, nicht
   das Ergebnis.

   **Nachgewiesen am ausgerollten Stand** (`wertermittlung.js?v=1152` im
   Browser bestätigt), beide Richtungen, ohne einen einzigen Abruf
   (`confirm` abgefangen, **kein Kerosin verbraucht**):

   | Stufe | `plot`/`units`/`mea` | Knopf | Kasten |
   |---|---|---|---|
   | **3** | leer | **gesperrt** | nennt genau diese drei |
   | **1** | leer | **klickbar**, „· 2 L" | keiner |

   **Zwei Beobachtungen am Rand, keine Behauptungen:**
   - Beim Herunterstufen auf 1 fand mein Selektor **kein anklickbares
     Bedienelement** für den Meilenstein „Einschätzung"; ich musste
     `setStufe(1)` nutzen. Laut `v1126c` soll der Meilenstein anklickbar sein
     — **mein Selektor kann zu eng gewesen sein**, das gehört gegengeprüft,
     bevor daraus ein Befund wird.
   - `baustatus` steht in `markt.pflicht`, in `BEDARF` aber erst auf Stufe 2.
     Beim Leeren erschien er trotzdem nicht in der Fehlt-Liste. Ungeklärt,
     ohne Auswirkung auf diesen Fix — notiert, damit es nicht verloren geht.

   **Hinweis für den nächsten Prüflauf:** im Testbrowser sind `plot`, `units`
   und `year` verändert und die Stufe steht auf 1 (localStorage-Formularstand,
   keine gespeicherten Objektdaten). Vor der nächsten Messung mitlesen.

- [2026-08-12] **Die sieben Reiter brachen um, obwohl Platz war** — `v1151`, `7c716ab`.
   **Marcels Befund** aus der Entwurfs-Durchsicht: „Die Punkte 1–7 sollten
   schon nebeneinander passen."

   **Gemessen statt geschätzt** (Messkabine, iframe auf `/impressum.html`,
   Marktbericht-App direkt): die sieben Marken brauchen zusammen **902 px**
   (117 · 94 · 105 · 131 · 171 · 149 · 133). Ihr Behälter `#mbw-reiter` stand
   aber bei **jeder** Fensterbreite auf **760 px** — auch bei 1920 px, wo der
   Eltern-Container `.panel` **1300 px** breit ist. Der Platz war da; die
   Leiste begrenzte sich selbst und brach in zwei Zeilen um (Oberkanten 374
   und 421). Kein Überlauf, nichts beschnitten — sie wickelte um.

   **Ursache: ein Sammelselektor aus `v1128`**, der `#wm-ziel`,
   `.mbw-reiter`, `.mbw-blatt`, `.mbw-nav`, `.mbw-fuss` und `#wm-ampel`
   gemeinsam auf 760 px setzt. Für Formularzeilen und Text ist das gut
   begründet („eine Formularzeile über 1.278 px wäre unlesbar"). **Die
   Reiterleiste ist aber keine Formularzeile, sondern Navigation** — ein
   Selektor, der beides gleich behandelt, gibt einem von beiden das falsche
   Maß. Dieselbe Familie wie die `:not(#id)`-Lehre: **Sammelregeln treffen
   Elemente mit verschiedenen Bedürfnissen.**

   **Gelöst:** eigene Grenze `max-width:960px` für `.mbw-reiter`, 58 px Luft
   über dem gemessenen Bedarf für längere Beschriftungen. Zentriert wie
   zuvor, damit sie über dem 760er-Inhalt ausgerichtet bleibt.
   `flex-wrap:wrap` bleibt der Rückfall.

   **Nachgemessen am ausgerollten Stand** (`mb-wizard.js?v=1151` im iframe
   bestätigt):

   | Fenster | Behälter | Zeilen | Überlauf |
   |---|---|---|---|
   | 1920 px | 960 | **1** | nein |
   | 1280 px | 960 | **1** | nein |
   | 1024 px | 927 | **1** (25 px Luft) | nein |
   | 950 px | 853 | 2 | nein |
   | 820 px | 723 | 2 | nein |
   | 390 px | 305 | 4 | nein |

   **Die Zeilenzahl unter 1024 px ist gewollt** — bei 902 px Bedarf und
   723 px Platz ist Nebeneinander unmöglich. Der Handy-Fall (vier Zeilen,
   ~188 px) ist damit vermessen und steht als Gestaltungsaufgabe im Punkt:
   gesucht ist eine zweite Darstellung, nicht eine gequetschte erste.

- [2026-08-12] **Das PDF nannte den Sachwertfaktor 1, gerechnet wurde mit 0,925** — `v1150` + `v1150b`, `e33ea05`.
   Gesucht war nur die fehlende **Stufe** im Dossier. Gefunden wurde daneben
   ein **Rechenweg-Widerspruch**: die PDF-Fußnote druckte
   `cc.assumptions.sachwertfaktor`, und das ist die **Konstante**
   `SACHWERTFAKTOR = 1.0` aus `CrossCheckService.js:26` — nicht der
   angewandte Faktor.

   **Am echten Bericht gemessen** (Report 73, `PRUEF_ZFH Löhner Str.`, EFH):
   tatsächlich gerechnet wurde mit **0,925, Stufe A**, Quelle
   „Grundstücksmarktbericht 2026 für den Kreis Herford, 5.1.2
   Sachwertfaktoren". Im Dossier stand **„Sachwertfaktor 1"**.

   **Dieselbe Falle ist in dieser Fußnote schon dreimal aufgetreten** — v1050
   (NHK), v1052 (Zinssatz: „nannte weiter 3 %, gerechnet wurden 2,2 %"),
   v1061. Der Kommentar zwei Zeilen darüber sagt es wörtlich: „Eine Datei,
   zwei Stellen — schon wieder." Alle Nachbarwerte in derselben Fußnote holen
   ihre Zahl **aus dem Ergebnis mit Rückfall auf die Annahme**; der
   Sachwertfaktor war der letzte, der es nicht tat.

   **Zweitens fehlte die Stufe.** Auf dem Bildschirm steht sie seit `v1143b`
   („Faktor 1,15 · Stufe E"), im PDF nicht — also genau dort nicht, wo die
   Zahl ihre Herkunft tragen muss: **das Dossier verlässt das Haus, die
   Bildschirmansicht nicht.**

   **Beide Formen werden gelesen** — `nhk2010.js:897` liefert ein Objekt
   `{wert, stufe, quelle}`, ältere Wege eine nackte Zahl. Das ist die
   `v1143b`-Lehre, auf dem Bildschirm längst gezogen.

   **`v1150b`: die Quelle nur, wenn sie kurz ist.** Die amtliche Quelle ist
   74 Zeichen lang und hätte die Fußnote um ein bis zwei Zeilen wachsen
   lassen. Die **Stufe** trägt die Herkunft und bleibt immer dabei; die
   Quelle lohnt nur, wo sie selbst die Aussage ist — „eigene Angabe"
   (13 Zeichen) bei Stufe E. Grenze bei 26 Zeichen. Ergebnis: **+14 Zeichen
   statt +80**, Layout bleibt.

   **Nachweis am ausgelieferten Stand** (`app.js?v=1150b` vom Server geladen):
   Marker vorhanden, 26er-Grenze vorhanden, Objekt- **und** Zahlform gelesen,
   Rückfall vorhanden. Dazu die Fußnote gegen echte Daten gerechnet:

   | Fall | Ausgabe |
   |---|---|
   | Bericht 73 (amtlich) | `Sachwertfaktor 0,925 (Stufe A)` — vorher `Sachwertfaktor 1` |
   | eigener Wert | `Sachwertfaktor 1,15 (Stufe E · eigene Angabe)` |
   | lange Quelle | `Sachwertfaktor 0,889 (Stufe A)` — Quelle gekürzt |
   | nackte Zahl (alte Form) | `Sachwertfaktor 0,9` |
   | kein Faktor | `Sachwertfaktor 1` — Rückfall auf die Annahme |
   | vorläufig | `ohne Sachwertfaktor` |

   Buster-Kette alle vier Glieder auf `1150b`. `node --check` auf dem Server ok.

- [2026-08-12] **Die Preisindikation stand im PDF auf jeder Seite** — `v1149`, `6777afe`.
   **Marcels Befund** (12.08.): „beim Marktbericht steht nicht 3–4 mal die
   Preisindikation. Das ist mir beim PDF aufgefallen, das ist etwas zu viel."

   **Gemessen in `frontend/marktbericht-app/app.js`:** `footer()` läuft bei
   **jedem** `newPage()` und druckte „DealPilot · Marktbericht —
   Marktpreisindikation, kein Gutachten n. § 194 BauGB". Der Prod-Bericht hat
   laut Kommentar in derselben Datei **sieben Seiten** — der Begriff kam allein
   hier siebenmal. Dazu drei Textstellen im Fluss (Z. 900, 902, 3344), die
   aber etwas anderes sagen: **wie belastbar** die Zahl ist. Das ist keine
   Dopplung, nur ein gleiches Wort — sie bleiben.

   **Gelöst:** der Satz ist rechtlich sinnvoll (§ 194 BauGB) und verschwindet
   nicht, er steht nur noch **einmal** — auf Seite 1, wo ihn liest, wer den
   Bericht in die Hand nimmt. Ab Seite 2 trägt die Fußzeile Marke und
   Seitenzahl. Gebunden an `pageNo`, das dieselbe Funktion schon für die
   sichtbare Seitenzahl nutzt. **`footer()` bleibt zustandsneutral** — der
   v957-fontleak-Befund zeigt, dass eine Größenänderung dort auf die
   Folgeseite durchschlägt und Wortlücken erzeugt.

   **Buster-Kette alle vier Glieder gezogen:** `marktbericht-view.js` 1129 →
   1149, iframe `marktbericht-app/index.html` 1135b → 1149, `app.js` 1143b →
   1149. Laut Projektanweisung wurde diese Kette **viermal** vergessen.

   **Nachweis:** auf dem Server `node --check` (Node 18) ok, Marker
   `v1149-FUSS` vorhanden, Buster `app.js?v=1149` angekommen.

   **Offen als Staging-Abnahmepunkt, ehrlich benannt:** der **Sichtnachweis am
   PDF fehlt.** Versucht wurde, einen vorhandenen Bericht (`/reports/one`,
   Report 73 des Testobjekts, kostenlos) durch `exportPdf(out)` zu schicken
   und die gedruckten Texte über einen Patch auf `jsPDF.prototype.text` zu
   zählen — bei abgefangenem `save()`, damit kein Download entsteht. Ergebnis:
   **kein Fehler, aber null Textaufrufe.** Die Export-Funktion steigt bei
   einem wiedergegebenen Bericht offenbar still aus. **Ob das am Produkt oder
   am Messaufbau liegt (der Patch überschrieb auch `output()`), ist nicht
   getrennt** — deshalb keine Behauptung, sondern ein eigener Punkt unter
   „Später". Marcel sieht das Ergebnis beim nächsten echten PDF auf Seite 2.

- [2026-08-12] **Der Inhalt wurde bei 1025 px schmaler als bei 1024 px** — `v1148`, `e4f3066`.
   **Befund:** Bei 1024 px greift der v648-Block (`css/style.css:35783`) mit
   260 px Leiste und lässt 764 px Inhalt. Ein Pixel darüber endet der Block,
   das Standard-Grid aus Z. 267 setzt 380 px, und der Inhalt fiel auf
   **645 px** — ein Pixel mehr Fenster kostete **119 px Inhalt**. Betroffen
   war das Band **1025–1143 px**; ab 1144 px (380 + 764) war es von selbst
   wieder gut, weshalb es auf dem iPad Air quer (1180) nicht auffiel.

   **Vor dem Bauen geprüft:** die Sidebar trägt **keine eigene Breite** — sie
   ist Grid-Kind und folgt der Spalte (`width:auto` gilt nur im v648-Block,
   darüber gibt es gar keine Breitenregel). `.app-wrap` hat **kein `gap`**,
   die Spaltenrechnung geht also glatt auf.

   **Lösung ohne neue Zahl und ohne `100vw`:**
   `body .app-wrap:not(.sb-collapsed){grid-template-columns:minmax(0,380px) minmax(764px,1fr)}`
   ab `min-width:1025px`. Die zweite Spalte behält 764 px als Untergrenze,
   die Leiste nimmt nur den Rest und wächst dabei stetig auf ihre 380 px.
   **`100vw` wäre falsch gewesen** — es zählt die Scrollleiste mit und hätte
   einen Versatz erzeugt. Kein `!important`, damit die eingeklappten
   Zustände weiter gewinnen.

   **Nachgemessen in der Kabine (Buster `W68` im iframe bestätigt):**

   | Fenster | Spalten | Inhalt | Überlauf |
   |---|---|---|---|
   | 1024 px | 260 + 764 | 764 | nein |
   | 1025 px | **261 + 764** | **764** (vorher 645) | nein |
   | 1100 px | 336 + 764 | 764 | nein |
   | 1143 px | 379 + 764 | 764 | nein |
   | 1144 px | 380 + 764 | 764 | nein |
   | 1400 px | 380 + 1020 | 1020 | nein |

   **Regression eingeklappte Leiste:** mit `body.dp-sidebar-collapsed` bleibt
   es bei `66px 1034px`, Leiste 66 px, kein Überlauf — die `!important`-Regel
   aus Z. 32816 gewinnt wie vorgesehen.

   **Grenze des Nachweises, ehrlich benannt:** der eingeklappte Zustand ist
   **per Klasse** geprüft, nicht über den Bedienweg. Grund ist ein
   Nebenbefund: **`#dp-sb-toggle` existiert im DOM nicht**, und es gibt keine
   globale Toggle-Funktion (`toggleSidebar`/`dpSbToggle`/`sbToggle` alle
   nicht vorhanden). Die Treffer auf `[class*=collapse]` sind
   `v212-collapse-toggle`, also Aufklapper **im Inhalt**. Bei 1100 px hat der
   Einklapp-Zustand damit **kein Bedienelement** — die CSS-Regeln dafür
   (66-px-Rail in Z. 32816 und 33060) sind vorhanden, der Weg dorthin nicht.
   Als eigener Punkt unter „Später" vermerkt.

- [2026-08-12] **Der Staging-Server trug 319 Zeilen, die im Repo nicht standen** — `e35e34b`.
   Beim Ausrollen von `v1136` gemessen: `git status` auf
   `root@116.203.214.11` meldet
   `marktbericht/backend/src/connectors/boris/registry.js` als geändert,
   **319 Zeilen mehr, 42 weniger** als der Repo-Stand. Daneben liegen
   `registry.js.pre-v1080` und `.pre-v1082a` — die Änderung stammt also
   aus zwei Paketen, die nie zurückgeflossen sind.

   **Warum das drängt:** `deploy-staging.ps1` bricht deshalb bei **jedem**
   Ausrollen ab (der Pull lief nur nach Hand-Eingriff durch), und der
   nächste, der die Datei im Repo anfasst, erzeugt einen Konflikt oder
   überschreibt Arbeit, die es nur auf dem Server gibt. Eine Sicherung
   liegt unter `/root/registry.js.bak-2026-08-11`.

   **BEHOBEN am 2026-08-12 — `e35e34b`.** Aufgefallen, weil der Server
   plötzlich auf Zweig **`main`** stand und ein Backlog-Commit nicht
   ankam. Ursache war nicht die Drift allein: Marcel hatte die Datei
   inzwischen **auf dem Server committet** (`1e04538`, 13:09 UTC), womit
   `staging` dort um je einen Commit von `origin` abwich — jedes
   `git pull --ff-only` bricht dann ab.

   **Vorgehen:** Serverfassung 1:1 ins Repo geholt und unter Marcels
   Autorschaft committet, `node --check` gegen eine ESM-Arbeitskopie
   sauber. Dann auf dem Server gesichert
   (`/root/registry.js.vor-abgleich`), `git reset --hard origin/staging`,
   und **per MD5 nachgewiesen, dass die Datei bit-identisch geblieben
   ist** (`3c7a41d8…` vorher wie nachher). Server steht wieder auf
   `staging`, Divergenz weg, Deploys laufen.

   **Zwei Dinge bleiben offen:**
   - **Produktion prüfen:** liegt dieselbe Drift dort auch? SSH ist
     read-only, ein Vergleich der Datei genügt.
   - **Wie es dazu kam:** Ein Commit direkt auf dem Server ist der
     naheliegende Reflex, wenn `deploy-staging.ps1` scheitert — er
     erzeugt aber genau die Divergenz, die den nächsten Deploy blockiert.
     Solange das Skript defekt ist (siehe `FALLEN.md`), wird das
     wiederkommen.



- [2026-08-12] **Neun Info-Zeichen in der Wertermittlung taten nichts** — `v1146` (`d868fbb`), `v1146b` (`cbe57cf`).

   Beim Setzen des Garagen-Hinweises (`v1142`) aufgefallen und dann durchgezählt:
   `wertermittlung.js` vergibt **18** Hilfe-Schlüssel, `TEXTE` in
   `feldhilfe.js` führt **11** (mit dem neuen). `textFuer()` kennt keinen
   Rückfall — fehlt der Schlüssel, gibt sie `null` zurück und der Klick
   verpufft **still**. Das ⓘ steht trotzdem am Feld und verspricht eine
   Erklärung.

   Ohne Text sind:
   `aussenPct`, `ausstGewerk`, `bauteilHk`, `garagenStufe`, `grundriss`,
   `hinterland`, `hinterlandRent`, `modGrad`, `standardstufe`.

   Das sind ausgerechnet die **erklärungsbedürftigsten** Felder der
   Wertermittlung — Standardstufe, Modernisierungsgrad und
   Hinterland-Rentierlichkeit entscheiden erheblich mit, und
   `hinterlandRent` steuert direkt die Bodenwertverzinsung nach § 41.

   **BEHOBEN in `v1146` (`d868fbb`) und `v1146b` (`cbe57cf`).**

   **Sechs der neun Texte gab es längst** — im `HILFE`-Block von
   `wertermittlung.js`, wo sie nie jemand zu sehen bekam. Sie sind nach
   `feldhilfe.js` überführt und in `kurz`/`lang` geteilt. Drei sind neu
   geschrieben: **Standardstufe**, **Modernisierungsgrad**, **Grundriss** —
   jeweils mit Rechtsgrundlage und der Angabe, was eine Stufe Unterschied
   im Ergebnis ausmacht.

   **`textFuer()` meldet einen fehlenden Schlüssel jetzt per
   `console.warn`** statt still `null` zurückzugeben.

   **`v1146b` — der Fix war eine Ebene zu hoch angesetzt.** Nach `v1146`
   blieben drei Zeichen weiter wirkungslos, **ohne dass die neue Warnung
   ansprang**: `hinterland`, `ausstGewerk` und `bauteilHk` sind
   **Sammelschlüssel für Feldgruppen** — das ⓘ hängt dort 9× bzw. 5× an
   verschiedenen Feldern (`ausstAussenwaende`, `btlGauben`, …). `box()`
   suchte ein Element mit der **Id des Schlüssels** als Anker, fand keins
   und baute still gar keinen Kasten. Der Text war da, die Warnung schwieg
   zu Recht — und trotzdem passierte beim Klick nichts. Jetzt Rückfall auf
   das angeklickte Zeichen selbst.

   **Abgenommen auf Staging:** alle **13** bei Stufe 3 sichtbaren Zeichen
   öffnen einen Kasten mit Text (400–424 Zeichen bei den drei
   Gruppen-Schlüsseln), **keine Warnung**, kein leerer Kasten. Gegen die
   Quelle gezählt: **18 Schlüssel, 19 Texte — keiner mehr ohne.**

   **Eigener Messfehler, vermerkt:** Ein erster Prüflauf meldete vier
   Felder ohne Kasten. Falsch — der Kasten ist ein **Umschalter**, und die
   vier waren aus einem abgebrochenen Lauf noch offen; mein Klick hat sie
   geschlossen. Zustand aus dem vorigen Prüflauf, genau die Falle aus
   `FALLEN.md`. Vor der Messung `.fh-box` abräumen.



- [2026-08-12] **Die Sachwertfaktor-Kette ist bewiesen, beide Wege** — `v1144` (`d884836`), `v1143b` (`0bf64ec`).

   **Prüfobjekt selbst angelegt:** `PRUEF_ZFH Löhner Str. 278`
   (`3fbb754c`, Seq 2026-1006) — EFH, 233 m², Bj 1964, Grundstück 700 m²,
   2 Wohneinheiten, Standardstufe 3, NHK-Typ freistehend / Keller-Erd-Ober
   / DG ausgebaut. **Bleibt als Prüfstrecke auf Staging liegen**, Stufe 3
   ist dafür bezahlt — weitere Läufe kosten 0 L.

   | Lauf | Faktor | Herkunft | Sachwert |
   |---|---|---|---|
   | ohne eigenen Wert | **0,925** | **Stufe A**, Grundstücksmarktbericht 2026 Kreis Herford, 5.1.2 (1658 Kauffälle) | **243.577 €** |
   | mit eigenem Wert | **0,80** | **Stufe E**, eigene Angabe | **210.661 €** |

   Der eigene Wert hat Vorrang vor dem amtlichen — genau wie vorgesehen.
   Die Rechnung stimmt exakt: vorläufiger Sachwert 263.326 × 0,8 =
   210.661 €, im Rechenweg Zeile für Zeile nachlesbar. Kerosin: **98 → 86**
   für den ersten Lauf (12 L), der zweite **0 L**.

   **Drei Fallen beim Anlegen, alle aus der stillen Ablehnung unbekannter
   Auswahlwerte:** `objart: 'ZFH'` gibt es nicht (die Liste kennt nur ETW,
   EFH, MFH, DHH, RH — ein Zweifamilienhaus läuft unter **EFH**, so wie
   die NHK-Gebäudeart „Ein-/Zweifamilienhaus" heißt). `nhk_haus:
   'freistehend'` ebenso nicht — dort sind es die Zahlen **1/2/3**. Und
   die Wohneinheiten kamen über keinen der versuchten Schlüssel (`we`,
   `units`, `anzahl_we`, `wohneinheiten`) an; im Formular gesetzt lief es.
   **Der richtige Objekt-Schlüssel für Wohneinheiten ist noch offen.**

   **Was dabei gefunden und behoben wurde — `v1144` (`d884836`):**
   Der Sachwertfaktor wurde **nie** angewandt, an keinem Objekt, aus keiner
   Quelle. `WertParameterService.sachwertfaktor()` und `hole()` liefern
   beide `{ wert, stufe, quelle }`; gelesen wurde aber `param.sachwertfaktor`
   — ein Feld, das keiner der beiden Rückgabewege setzt. `Number(undefined)`
   ist `NaN`, also griff durchgehend der Zweig „kein Sachwertfaktor
   verfügbar". Betroffen waren zwei Stellen: `lib/nhk2010.js:868` und
   `CrossCheckService.js:171`. Bei den ETW fiel es nie auf, weil dort
   ohnehin keiner angesetzt werden darf — **bei jedem Haus hätte es still
   den vorläufigen Sachwert ausgewiesen.**

   **Mitgefixt, weil der erste Fix es nötig machte:** Die Objektart-Sperre
   lag nur im Tabellenweg (`sachwertfaktoren_nrw.js:134`). Mit korrektem
   Feldnamen hätte ein gepflegter Wert bei einer Wohnung plötzlich
   gegriffen — am Prüfobjekt wären aus 268.172 € **308.398 €** geworden,
   ein Modellbruch nach § 10 ImmoWertV. Die Sperre sitzt jetzt zentral in
   `WertParameterService.sachwertfaktor()` und gilt für beide Wege.

   **Gegengemessen nach dem Ausrollen:** ETW unverändert bei 268.172 €,
   `marktangepasst: false`, Grund weiterhin `objektart_nicht_abgeleitet` —
   keine Regression.

   **Offen bleibt der eigentliche Nachweis.** Dafür braucht es ein
   EFH/ZFH-Objekt. Ein Funktionslauf im Container scheiterte an der
   NHK-Typkennung: `sachwert()` verlangt einen Gebäudetyp aus
   `NHK_2010.typen` (`1.01`, `1.11`, …), den erst der Orchestrator aus
   `nhkHaus`/`nhkGeschosse`/`nhkDach` zusammensetzt. **Beim Aufgreifen
   entweder den Typ direkt setzen oder ein echtes Haus anlegen** —
   `Löhner Str. 278`, 32120 Hiddenhausen (ZFH, Verkehrswert 350.094,36 €)
   aus `CLAUDE.md` wäre der Kandidat. **Kostet 12 L, Marcel fragen.**


- [2026-08-12] **Ein gepflegter Sachwertfaktor wurde stillschweigend verworfen** — `v1145` (`1ea582d`).

   Gemessen an Hermannstraße 9: Im Feld stand **1,15**, im
   Payload kam `sachwertfaktor: 1.15` sauber an — der Bericht rechnet ihn
   trotzdem nicht. Zu Recht, denn für eine ETW gibt es keinen
   Sachwertfaktor (`sachwertfaktor_grund: "objektart_nicht_abgeleitet"`).

   **Der Nutzer erfährt davon nichts.** Er trägt einen Wert ein, es
   passiert nichts, und kein Feld sagt warum. Seit `v1143` steht der Grund
   immerhin an der Sachwert-Karte („warum vorläufig?"), aber **nicht am
   Eingabefeld**, wo die Angabe gemacht wird.

   **BEHOBEN in `v1145` (`1ea582d`).** Zweifach, weil ein Klick-Hinweis
   allein nichts nützt — gemerkt hätte es weiter niemand:

   - **Sichtbar ohne Klick:** unter dem Feld steht bei ETW/MFH/Gewerbe
     „Für diese Objektart ohne Wirkung — Sachwertfaktoren werden nur für
     Ein- und Zweifamilien-, Doppel- und Reihenhäuser abgeleitet."
   - **Die Feldhilfe** erklärt den Grund samt § 10 ImmoWertV und dass bei
     einer Wohnung ohnehin das Vergleichswertverfahren führt.

   `ankerZeigen()` taugte dafür nicht — es hängt am **eigenen** Feldwert,
   hier entscheidet die Objektart nebenan. Und das Feld entsteht erst im
   Block `wm-b3`, ein einmaliger Aufruf beim Start verpufft; deshalb hört
   die Prüfung am `document` mit.

   **Gegengemessen an beiden Objektarten:** Hermannstraße 9 (ETW) zeigt
   Hinweis und Feldhilfe, `PRUEF_ZFH` (EFH) zeigt **keinen** — und er
   verschwindet beim Wechsel der Objektart von selbst.



- [2026-08-12] **Die Rechenwege stehen jetzt auch im Ergebnis, zum Aufklappen** — `v1141` (`fb9fb3a`), `v1141b` (`b02654d`), `v1141c` (`211ee49`). Marcels Entscheidung, nachdem der `v1140`-Fehler nur im PDF sichtbar war.

   Je ein Aufklapper **„Rechenweg"** unter dem Bodenwert und in der
   Ertragswert- und Sachwertkachel. Der Vergleichswert bekommt keinen — er
   kommt aus Angeboten, nicht aus einer Staffel.

   **Keine zweite Quelle, keine zweite Rechnung.** Angezeigt werden exakt
   die Staffeln, die das PDF ab `app.js:3416` zeichnet (`_ew`/`_swx` dort
   sind dieselben Objekte wie `e`/`sw` in `_renderWertverfahren`). Auch die
   Formatregeln sind 1:1 übernommen — `faktor` vor `wert`, Faktor mit
   Komma, `summe` fett mit Trennlinie, `detail` als Unterzeile. Wichen sie
   ab, stünden zwei Darstellungen derselben Zahl nebeneinander, und genau
   das soll ein Rechenweg ja ausschließen.

   **`v1141b` — der Bodenwert-Weg wurde überhaupt erst ausgeliefert.**
   `ErtragswertService.bodenwert()` protokolliert jeden Schritt in
   `schritte`, aber `_wertParams` ist eine interne Struktur und
   `crossCheck` gibt nur ausgewählte Felder heraus: im gesamten
   Antwortbaum kam `schritte` **kein einziges Mal** vor (gemessen). Der
   erste Anlauf zeigte deshalb nur zwei der drei Wege.

   **`v1141c` — zwei Nachbesserungen aus dem Abnahmelauf.** Der Zeilentitel
   „Bauland × **angepasster** Bodenwert" stand auch dann da, wenn kein
   Koeffizient griff — beim Prüfobjekt direkt neben dem Detail „950 m² ×
   90 €/m²", also dem unangepassten Richtwert. Und „überschüssige Fläche"
   passt nur zur automatischen Spaltung am 1,5-fachen; manuell gepflegtes
   Hinterland **kommt hinzu** (dieselbe Unterscheidung wie `v1140b`).
   Dazu stand der Bodenwert-Weg über die volle Breite von 856 px,
   Beschriftung und Betrag einen halben Bildschirm auseinander — jetzt auf
   440 px begrenzt.

   **Abgenommen auf Staging**, Bodenwert-Weg vollständig lesbar:

   ```
   Grundstücksfläche × Bodenrichtwert   950 m² × 90 €/m²      85.500 €
   + Hinterlandfläche                   828 m² × 5 €/m²        4.140 €
   Anpassung Zuschnitt / Lage           −10 % — Lärmbelastung  80.676 €
   Miteigentumsanteil                   50 %                   40.338 €
   = Bodenwert                                                 40.338 €
   ```

   Die Ertragswert-Staffel deckt sich Zeile für Zeile mit dem PDF
   (Verzinsung −1.033 €, Gebäudeertragswert 148.042 €, Ertragswert
   191.339 €). Überlauftest gegen die klippende Kachel: **0 von 56 Zellen**
   stehen über, Kartenbreite 277 px.

   **`v1141d` — bei 390 px in der Messkabine nachgemessen.** Der
   Kopfbetrag des Bodenwerts maß **66 px bei 33 px Zeilenhöhe**: das
   Euro-Zeichen stand allein in der zweiten Zeile. Ursache ist `nowrap` in
   der Flex-Zeile `.wv-boden` — das `<b>` wird gequetscht und bricht
   **innen** um, statt dass die Zeile umbricht. Derselbe Befundtyp wie die
   Cashflow-Kacheln in `v1138c`; eine Zahl, die man in zwei Zeilen liest,
   liest man falsch. Jetzt `flex-wrap:wrap` plus `white-space:nowrap` am
   Betrag, nachgemessen **33 px, einzeilig**.

   Der Rest der Handy-Messung ist sauber: Kachelraster einspaltig
   (305 px), **0 überstehende Zellen** gegen den klippenden Vorfahren,
   keine Zelle nur per Seitwärtswischen erreichbar, `scrollWidth` 375 bei
   390 px Viewport.

   **Eigener Messfehler, vermerkt:** Der erste Handy-Screenshot sah aus,
   als wären die Beträge rechts abgeschnitten. Das war mein zu schmaler
   Bildausschnitt — Tabelle 305 px im 305-px-Behälter, `scrollWidth`
   identisch. Ein Screenshot ist keine Messung.

   **Zweiter eigener Fehler, teurer:** Beim Hochziehen des Cache-Busters
   `Set-Content` benutzt — **71 geänderte Zeilen statt einer**, Umlaute
   doppelt kodiert. Genau die Falle, die am selben Tag in `FALLEN.md`
   geschrieben wurde. Über `git checkout --` zurückgenommen und mit dem
   Edit-Werkzeug wiederholt, Diff danach eine Zeile.

- [2026-08-12] **Bodenwertverzinsung bei Eigentumswohnungen lief auf dem doppelten Wert** — `v1140` (`6e1dbe8`), `v1140b` (`a1f9839`).

   **Befund.** `ErtragswertService.bodenwert()` setzt `wert_rentierlich`
   **vor** der MEA-Kürzung; die Kürzung traf nur `out.wert`. Verzinst wird
   aber `wert_rentierlich` (Z. 393 f.). Bei MEA 50 % lief die
   Bodenwertverzinsung damit auf dem **doppelten** Bodenwert. Das war der
   **halb behobene V1026-Fehler** — der damalige Fix setzte `out.wert` und
   ließ den anderen Wert stehen.

   **Gefunden am PDF-Rechenweg**, nicht am Bildschirm: dort stand
   „Bodenwertverzinsung (80.676 € × 2,56 %)" neben „+ Bodenwert 40.338 €",
   und 80.676 ist exakt das Doppelte. Die Bildschirmansicht zeigt die
   Rechenschritte nicht — ohne das PDF wäre es nicht auffindbar gewesen.

   **Fassung.** `wert_rentierlich` macht dieselbe Kürzung mit. Die Fußnote
   „nicht rentierliche Fläche bleiben außen vor (§ 41)" verschwindet damit
   von selbst — sie entstand nur daraus, dass die beiden Werte
   auseinanderliefen, und deutete die MEA-Differenz als etwas, das es beim
   Objekt gar nicht gab.

   **Gegengemessen auf Staging, Hermannstraße 9:**

   | | vorher | nachher |
   |---|---|---|
   | Bodenwertverzinsung | −2.065 € | **−1.033 €** |
   | Gebäudereinertrag | 5.399 € | **6.431 €** |
   | Ertragswert | 167.582 € | **191.000 €** |
   | Fußnote „nicht rentierlich" | stand da | **weg** (0 Treffer im PDF) |

   Dazu ein Funktionslauf im Container über drei Fälle: ETW mit MEA
   (`wert == wert_rentierlich`), **Haus mit Grünfläche** (§ 41 wirkt
   weiter, 70.000 gegen 74.640 — der Fix durfte das nicht mitreißen), ETW
   mit beidem (beide Kürzungen greifen).

   **Zweiter Befund, mitgefixt:** Der Flächenhinweis sagte „Der Bodenwert
   setzt die gesamte Fläche zum vollen Bodenrichtwert an … hier nicht
   vorgenommen", während seit `v1070` sehr wohl aufgeteilt wird. Er nennt
   jetzt die tatsächliche Rechnung. **`v1140b` war eine Nachbesserung an
   meiner eigenen Fassung:** ich hatte beiden Aufteilungsarten denselben
   Satz gegeben, sodass beim Prüfobjekt „die überschüssigen 828 m²" stand
   — `manuelleAufteilung()` legt sie aber **zusätzlich** neben die volle
   Fläche (`umrechnung_nrw.js` Z. 221–232). Ein falscher Modellvermerk
   gegen einen anderen getauscht; jetzt haben die beiden Wege getrennte
   Sätze.

   **Zurückgenommen — kein Fehler war:** Ich hatte notiert, die 80.676 €
   seien „auch für sich ungeklärt", weil 950 × 90 = 85.500 wären. Die
   Rechnung geht vollständig auf, sobald man alle gepflegten Angaben
   nimmt: 950 × 90 = 85.500, **+ 828 m² Hinterland à 5 € = 89.640**,
   **× 0,9** (Anpassung −10 %, „Lärmbelastung Hauptstraße") = 80.676,
   × 50 % MEA = 40.338. Mein Befund kam daher, dass ich die Anpassung und
   das Hinterland nicht zusammen gerechnet hatte.



- [2026-08-12] **Ein Testobjekt vollständig anlegen und alle Rechenwege gegenprüfen** — drei Durchgänge, `70326cf` bis `81d711b`.

   Ergebnis ist die Befundliste unten. Was daraus zu reparieren war, ist
   entweder behoben (`v1137`, `v1137b`, `v1138`–`v1138e`, `v1139`) oder
   als eigener Punkt gefasst (Bodenwertverzinsung bei ETW = Punkt 1).

   **Ein Testobjekt mit amtlichem Sollwert fehlt auf Staging.** Die beiden
   Objekte aus `CLAUDE.md` liegen dort nicht in der beschriebenen Fassung —
   Hermannstraße 9 trägt 100 m² / Bj 1962 statt 165 m² / Bj 1968. Jeder
   Bewertungslauf ist damit ein Kettennachweis, kein Genauigkeitsnachweis.

   ---

   **Der Auftrag war:** Investition, Miete, Finanzierung, Bewirtschaftung,
   Steuer, Bewertung — jeden Reiter ausfüllen, dann prüfen: **rechnet alles
   richtig, wird unter „Bewertung" alles passend angezeigt, sind die
   Ergebnisse plausibel und korrekt dargestellt?**

   Fünf Dinge, die dabei erfahrungsgemäß auffallen und deshalb gezielt
   angesehen wurden:

   - **KPI und BWK werden beim Speichern eingefroren.** Ein Objekt, das vor
     einer Modul-Änderung angelegt wurde, zeigt alte Werte, bis es erneut
     gespeichert wird. Beim Prüfen also **nach jeder Änderung neu
     speichern**, sonst wird ein Anzeigefehler gemeldet, der keiner ist.
   - **DSCR kommt ausschließlich aus `window.Dscr.compute()`.** Weicht ein
     Anzeigeort ab, ist dort eine zweite Formel entstanden — genau das
     darf es nicht geben.
   - ~~**Einheiten:** `kaufpreis` und `cf_ns` stehen in **Cent**~~ —
     **am 2026-08-11 nachgemessen und widerlegt:** beide Spalten sind
     `numeric` und führen **Euro** (`250000.00`, `-2075.13`). Ein Faktor
     100 hat hier also **nicht** seine Ursache; die alte Warnung hätte
     die nächste Fehlersuche in die falsche Richtung geschickt.
   - **BWK-Zuordnung:** umlagefähig = `hg_ul + grundsteuer + ul_sonst`,
     nicht umlagefähig = `hg_nul + eigen_r + mietausfall + nul_sonst`. Der
     Bankexport teilt durch 12.
   - **Jahreszahlen** dürfen nie durch `Intl.NumberFormat` laufen, sonst
     steht „1.964" statt 1964 im Bild.

   **Sinnvoll mit dem Finanzamt-PDF zusammen zu fahren** — dasselbe Objekt,
   dieselben Zahlen, und die Immokalk-Berechnung als Maßstab für den
   Steuerteil.

   ---

   ### Erster Durchgang gefahren (2026-08-11) — Rechenkern und Reiter „Bewertung"

   **Testobjekt auf Staging: `PRUEF_1`, Prüfstraße 1, 32120 Hiddenhausen**
   (`a08fbce3`). Bewusst runde Zahlen, damit jede Zeile im Kopf
   nachrechenbar ist: KP 250.000, Wfl 80 m², NKM 850 + 50 €/Monat, EK
   60.000, Darlehen 220.175 zu 3,5 % / 2 %, BWK ul 2.100 und nul 1.976,
   zvE 70.000 bei 42 %, AfA 2 % auf 80 % Gebäudeanteil.

   **Was stimmt — Zeile für Zeile gegen Handrechnung geprüft:**

   | Anzeige | App | Handrechnung |
   |---|---|---|
   | Nebenkosten | 30.175 € (12,1 %) | 8.925+3.750+1.250+16.250 |
   | Bodenwert / Anteil | 15.000 € / 100 m² | 1000 m² × 10 % × 150 € |
   | Kaltmiete → NOI | 10.800 → 8.824 € | −1.976 nicht umlagefähig |
   | Zins / Tilgung Jahr 1 | 7.706 / 4.404 € | 220.175 × 3,5 % / 2 % |
   | CF vor Steuer | −3.286 € | −3.285,63 |
   | Steuerwirkung | +1.210 € | Verlust 2.882,13 × 42 % = 1.210,49 |
   | CF nach Steuer | −2.075 € / −173 €/Mon. | −2.075,13 |
   | BMR / NMR / LTV / Faktor | 4,32 / 3,15 / 88,1 % / 23,1 | alle exakt |
   | Wertzuwachs 15 J. | +62.558 € | 250.000 × 1,015¹⁵ − 250.000 |

   **DSCR: sauber, keine zweite Formel.** Der Kern liefert *brutto* und
   *netto*; **0,89** steht an sechs Anzeigeorten (`kpi-dscr`,
   `cr-dscr-val`, `r-dscr2`, Sidebar-Kachel, Badge, KPI-Bewertung),
   **0,73** an zwei — und die sind ausdrücklich „netto" beschriftet.
   Beide Werte decken sich exakt mit der Handrechnung. **Keine
   Jahreszahl** lief durch `Intl.NumberFormat` (kein „1.995").

   **Vier Befunde — als eigene Punkte zu fassen, hier nicht repariert:**

   1. **BEHOBEN in `v1137` (`70326cf`) — ein negativer Cashflow zeigte
      kein Minuszeichen.** `cf-vst-now` stand als **„274 €"** da, wo
      −273,80 gemeint war; positive Werte tragen ein „+". Nur die
      **Farbe** (rot `rgb(217,104,95)` gegen grün `rgb(63,165,108)`)
      unterschied — für Rot-Grün-Blinde sind die beiden Fälle **nicht
      unterscheidbar**. Ursache: `calc.js:3655` rief `fE(v, 0)` ohne das
      Vorzeichen-Flag, und `fE` formatiert intern `Math.abs(n)`. Jetzt
      `fE(v, 0, true)`; das manuelle „+" entfällt. Nachgemessen: „–274 €",
      „–173 €", „+238 €" an allen sechs Phasen-Kacheln.
   2. **BEHOBEN in `v1137` — zwei Zahlen für dieselbe Größe.** Die
      kumulierten Mieteinnahmen standen im selben Reiter zweimal:
      `vz-info-miete` = 200.868 €, `vz-plausi-mit` = 198.709 €.
      Ursache: **genau der Bäckerstr.-7-Fehler aus `V119`, eine Zeile
      weiter vergessen** — `vz-plausi-mit` bekam weiter den Wert der
      ersten Schleife (Quick-Methode), während die Aufschlüsselung
      darüber längst aus `cfRows` kam. Jetzt zieht die Plausi-Zeile
      denselben `_mieteKumNew`-Wert.

      **Dabei kam heraus, dass BEIDE alten Zahlen zu hoch waren.** Die
      echte Rechnung liefert **194.568 €**; an `State.cfRows` abgelesen:
      **Jahr 1 = 4.500 €**, also 10.800 × 5/12 — das **anteilige
      Erwerbsjahr** ab August. Ab Jahr 2 steigt es exakt mit 3 %
      (11.124, 11.458, …). Die Quick-Methode rechnete das erste Jahr
      voll.

      **Der kleine Rest ist nachgezogen — `v1137b` (`49df402`).** Die
      Plausi-Zeile sagte „Aktuelle NKM 10.800 €/J × 15 Jahre … mit 3,0 %
      p.a. wächst die Miete auf 194.568 €" und **erwähnte das anteilige
      erste Jahr nicht**; wer nachrechnete, kam auf 200.868 und hielt die
      Zahl für falsch. Jetzt steht der Satz „Das **erste Jahr zählt nur
      anteilig** ab dem Kaufmonat" dahinter.
   3. **ZURÜCKGENOMMEN — das war mein Messfehler, kein Befund der App.**
      Ich hatte gemeldet, die Eingabe „Umlagefähige Kosten / Monat" werde
      still von 200 auf 175 überschrieben. Der Grund steht in
      `main.js:338` und ist eine **gewollte Zwei-Wege-Kopplung** (V187):
      `umlagef` → schreibt `hg_ul`, und jede Änderung an den
      UL-Feldern schreibt die Summe/12 zurück. **Mein Testaufbau hat
      beide Seiten gleichzeitig per Skript gesetzt** — ein Mensch tippt
      nacheinander, und dann tut die Kopplung genau das Richtige. Auch
      die Warmmiete 12.900 € ist damit korrekt: Kalt 10.800 +
      umlagefähige Erstattung 2.100.
   4. **Die Cent-Warnung oben in diesem Punkt stimmt nicht mehr.**
      Gemessen an der Staging-Datenbank und am API-Objekt: `kaufpreis` =
      `250000.00` und `cf_ns` = `-2075.13`, beide `numeric` in **Euro**.
      Die Warnung „`kaufpreis` und `cf_ns` stehen in Cent" führt bei der
      nächsten Fehlersuche in die Irre und ist deshalb oben gestrichen.

   **Bankexport geprüft (2026-08-11) — sauber.** Der Haken „Alle Objekte
   anzeigen" ist nötig, sonst zeigt der Export **nur gewonnene Deals**
   und ein frisches Testobjekt fehlt wortlos. Zeile `PRUEF_1` gegen die
   Handrechnung:

   | Spalte | Export | Rechnung |
   |---|---|---|
   | **Nebenkosten (BWK)/Mon** | **339,67 €** | (2.100 + 1.976)/12 ✓ |
   | Kapitaldienst | 1.009 € | 12.109,63/12 ✓ |
   | €/qm | 10,63 € | 850/80 ✓ |
   | Restschuld nach 10 J. | 168.516 € | 168.494 (jährlich gerechnet) |
   | Volltilgung | 2056 | ~30,1 Jahre bei 3,5/2 ✓ |

   Die 22 € Abweichung bei der Restschuld sind monatliche gegen
   jährliche Verrechnung — kein Befund.

   ---

   ### Zweiter Durchgang (2026-08-11) — Marktbericht-Kette und Handy-Ansicht

   **Die Messkabine funktioniert doch — mit einem leeren Träger.** Die
   Warnung aus dem ersten Durchgang („eigenes Fenster in 390 px nehmen")
   ist damit **überholt**: ein eigenes Fenster geht in dieser Umgebung
   gar nicht, `resize_window` wirkt am maximierten Fenster nicht
   (`innerWidth` blieb 1920, zwei Anläufe). Was **funktioniert**: die
   Kabine in einem Tab, in dem die App **nicht schon läuft**. Träger ist
   `/impressum.html` (7 KB, gleiches Origin), Inhalt gelöscht, iframe mit
   390 × 844 eingesetzt. Genau das war die Ursache des Einfrierens — nicht
   der iframe, sondern **zweimal dieselbe App im selben Renderer**. Ein
   `?ref=<uuid>` als SPA-Pfad hilft übrigens nicht: jede unbekannte URL
   liefert die volle App zurück, es gibt keine leere Seite auf dem Origin.

   **Marktbericht-Kette: ein Bruch gefunden und behoben (`v1138`,
   `e99d041`).** Beim Aufruf „Aktionen → Marktbericht" bei **geladenem**
   Objekt standen im Bericht genau sechs Werte — Adresse, Objektart,
   Wohnfläche, Zimmer, Baujahr, Kaufpreis. Leer blieben Etage, Kaltmiete,
   Grundstücksfläche, Wohneinheiten, Zustand, Qualität, Energieklasse und
   Miteigentumsanteil, **obwohl alle acht im Objekt gepflegt sind**. Der
   Bericht meldete daraufhin „fehlt: Zustand, Qualität" und „fehlt:
   Grundstücksfläche, Wohneinheiten, Miteigentumsanteil" — eine Stufe zu
   wenig, ohne erkennbaren Grund. Ursache: **zwei Wege in dasselbe
   Formular.** `marktbericht-view.js:62` hängt fünf Werte an die
   iframe-URL, die vollständige Übernahme `fillFromData()` hing allein am
   `change`-Handler des Dropdowns. Jetzt wählt das Dropdown bei
   vorhandenem `?ref` selbst vor und läuft durch denselben Handler.
   **Nachgemessen:** ohne einen einzigen Klick sind jetzt 13 Felder
   gefüllt und **Stufe 2 (Marktpreisindikation) direkt erreicht.**

   **Zustands-Zuordnung stimmt.** `ds2_zustand = 'gut'` kommt als
   `cond = 'gepflegt'` an, `ausst = 'Normal'` als `quality = 'normal'`,
   Energieklasse C direkt — die Tabelle aus `v1136c` greift.

   **BEHOBEN in `v1139` (`f80a1c9`) — „fehlt: Miteigentumsanteil" stand
   da, obwohl der Wert im Objekt steht.** Ursache gemessen:
   `mb-stufen.js:59` liest mit `wert(id)` das **Formularfeld**, und `mea`
   liegt im Block `wm-b3`, den `wertermittlung.js` erst `if (s >= 3)`
   baut. Ein Feld, das es noch nicht gibt, liefert `''` — **nicht zu
   unterscheiden von einem leeren.** `mb-objektwahl.js` hält den Wert
   derweil in seiner `offen`-Liste; die war nur von außen nicht lesbar.
   Jetzt ist sie es (`window._mbVorrat`), und die Leiste zeigt eine
   eigene Zeile „liegt im Objekt vor: … — hier klicken zum Übernehmen"
   in Gold statt Rot.

   **`erreicht()` blieb absichtlich unangetastet.** Würde der Vorrat als
   erfüllt zählen, spränge die Stufe von allein auf 3 und der Knopf
   forderte **12 L statt 5 L**, ohne dass jemand geklickt hat. Kerosin
   nie ohne Zutun. Auf Staging an `PRUEF_1` nachgemessen: vorher rot
   „fehlt", jetzt Gold `rgb(201,168,76)`, Stufe **2**, Knopf **5 L** —
   und nach dem Klick auf die Zeile steht `mea` = 10 im Feld, der Vorrat
   ist leer, Stufe **3**, Knopf 12 L. Kein Abruf ausgelöst.

   **Handy-Ansicht: vier Befunde, alle behoben.** Alle bei 390 px am
   selben Objekt gemessen, alle nach dem Ausrollen gegengemessen.

   | | Befund | Fassung |
   |---|---|---|
   | 1 | **Die Löschen-Schaltfläche lag auf der Score-Zahl.** `elementFromPoint` in deren Mitte lieferte `sbc-btn sbc-del` — wer den Score antippt, löst die Löschabfrage aus | `v1138b` `62cce64` |
   | 2 | **Das Minuszeichen stand allein in einer Zeile.** Drei Cashflow-Kacheln à 97 px, Betrag in 30 px Schrift → „–" / „274" / „€" untereinander; wer die mittlere Zeile liest, sieht einen positiven Wert | `v1138c` `a266753` |
   | 3 | **Die Sensitivitätsmatrix schnitt ihre rechte Spalte ab** — fünf von 25 Zellen hinter `overflow:hidden`, ohne Scrollbalken unerreichbar | `v1138d` `ccbca96` |
   | 4 | **Zwei Stellen, an denen ein `flex:0 0 auto`-Nachbar alles zusammendrückt:** der Umschalter Prognose/Detail stand als „ognose" da, und die Zeile „Finanzamt-PDF" ließ ihrer Beschreibung 25 px | `v1138e` `0f2d698` |

   **Zwei davon haben dieselbe Ursache — und sie ist bekannt:** eine
   spätere `!important`-Regel gleicher Spezifität macht eine frühere
   Korrektur wirkungslos. Bei 1 schlug die alte V80-Zeile (`top:12px`)
   die V103-Korrektur (`top:38px`); bei 2 schlagen zwei Regeln mit
   `repeat(3,1fr) !important` die Handy-Regel bei 700 px **und** die
   Tablet-Regel bei 1024 px. Beide Korrekturen waren seit ihrem Einbau
   wirkungslos. Deshalb jetzt über **Spezifität** (`.sec .cf-phase-grid`),
   nicht über Position — im Browser bewiesen: die Regel gewann selbst
   dann, als sie als **erstes** Stylesheet eingehängt war.

   **Eigener Messfehler, ausdrücklich vermerkt:** Mein Überlauftest prüfte
   gegen den **Viewport** und meldete „sauber", während fünf Matrixzellen
   längst am `overflow:hidden` des Vorfahren abgeschnitten wurden.
   **Ein Überlauftest muss gegen den klippenden Vorfahren prüfen**, und
   `overflow-x:auto` darüber zählt nicht als Befund — dort ist der Inhalt
   erwischbar. Mit dem korrigierten Maßstab sind alle **neun Reiter bei
   390 px sauber**.

   **Zweiter zurückgenommener Befund:** Ich hatte gemeldet, die
   Bewertungs-Kommentare ragten 157 px über den Rand. Falsch — ihr
   Container `kpi-eval-body` trägt `overflow-x:auto`, die Tabelle ist
   seitwärts erreichbar. Kein Befund.

   **Rechenwerte auf dem Handy identisch mit dem Desktop-Lauf:** DSCR
   0,89, LTV 88,1 %, CF vor Steuern −274 €/Monat, Kartenkacheln −2.075 €
   und 4,32 %. Der `v1137`-Vorzeichenfix wirkt auch hier.

   **Neuer Befund, bewusst nicht gefixt — gehört zu Punkt 4:**
   `.sbc-arrow` misst auf dem Handy **4 × 21 px** (auf dem Desktop
   20 × 20). Ein Bedienelement von vier Pixeln Breite ist nicht treffbar.
   Punkt 4 und Punkt 11 führen denselben Pfeil mit den Desktop-Maßen;
   **beim Aufgreifen gilt der Handy-Wert als der schwerere.**

   ---

   ### Dritter Durchgang (2026-08-12) — der echte Marktbericht-Abruf

   **Marcel hat den Abruf freigegeben und auf 112 L aufgeladen.** Gefahren
   an **Hermannstraße 9, Hüllhorst** (`07d89138`), Stufe 3.

   **Erst gemessen, dann ausgegeben — und die Messung hat den Plan
   geändert.** Das Bestandsobjekt unter dieser Adresse ist **nicht** das
   Testobjekt aus `CLAUDE.md`: dort steht ETW 165 m², Bj 1968, im Bestand
   liegt **100 m², Bj 1962**, 950 m² Grundstück, 3 Einheiten, MEA 50.
   Der Sollwert 305.937 / 348.687 € gilt für dieses Objekt also **nicht**.
   Der Lauf ist damit ein **Ketten- und Plausibilitätsnachweis, kein
   Genauigkeitsnachweis** — ein Objekt mit amtlichem Sollwert steht auf
   Staging nicht bereit.

   **Eigener Fehler, ausdrücklich zurückgenommen.** Mein erster Anlauf
   ließ den Tab hängen, und ich hatte „der Klick friert die Seite ein"
   notiert. Falsch: `app.js:224` ruft `window.confirm()` — den
   Kostenhinweis vor dem kostenpflichtigen Abruf (v647-cost). Ein modaler
   Dialog blockiert den Renderer, und Browser-Automation kann ihn nicht
   wegklicken. **Der Dialog ist genau richtig so.** Zweiter Anlauf mit
   `window.confirm = () => true` — die übrige Kette lief unverändert.

   **Die Abrechnung stimmt auf den Liter.** Für das Objekt war Stufe 2
   bereits bezahlt; der Knopf forderte **7 L** (Differenz zu 12).
   Gemessen: **112 → 105 L**, `bezahlte_stufe` danach **3**, alle
   Folgeabrufe **0 L**. Der Hinweistext nennt die 12 L und erklärt die
   Differenz — Knopf und Dialog widersprechen sich also nicht.

   **Alle drei Verfahren rechnen, keins halb.** Vergleichswert
   **192.000 €** (als führend bei ETW gekennzeichnet), Ertragswert
   **168.000 €** bei Reinertrag 7.464 €/a, Sachwert **268.172 €**,
   Bodenwert **40.338 €**. Der Liegenschaftszinssatz **2,56 %** trägt
   korrekt „eigene Angabe (indikativ)". Der Bodenrichtwert kommt echt aus
   **BORIS-NRW** (Zone 167, Layer `brw_ein_zweigeschossig`, Stichtag
   2026-01-01, `verified`, mit Quellenvermerk und dl-de/by-2-0). Der
   Ertragswert ist in sich schlüssig: bei 40.338 € Bodenwert und 2,56 %
   entspricht er einem Barwertfaktor von 19,85, also **rund 26 Jahren
   Restnutzungsdauer** — für Bj 1962 mit Modernisierung plausibel.

   **BEFUND, offen: der Bodenwert ist aus dem Bericht nicht
   nachrechenbar.** Das Objekt führt Grundstück 950 m², BRW 90 €/m²,
   MEA 50 %, **Hinterland 828 m² à 5 €/m² (rentierlich)** und
   **Anpassung −10 % („Lärmbelastung Hauptstraße")**. Keine Kombination
   ergibt die angezeigten 40.338 €:

   | Weg | Ergebnis |
   |---|---|
   | 950 × 90 × 50 % | 42.750 € |
   | … zusätzlich −10 % | 38.475 € |
   | … mit Hinterlandaufteilung (122 × 90 + 828 × 5) | 6.804 € |
   | **angezeigt** | **40.338 €** |

   `ErtragswertService.bodenwert()` protokolliert jeden Schritt in
   `out.schritte` (Z. 99–164: Fläche × BRW, GFZ-Umrechnung, Anpassung,
   Erschließungsbeitrag, Miteigentumsanteil) — **die Bildschirmansicht
   zeigt sie nicht**, und `data.land_value` im Replay trägt nur die
   BORIS-Rohquelle, `valuation.land_component` ist `null`. **Ob das ein
   Rechenfehler ist oder nur eine fehlende Anzeige, entscheidet der
   Rechenweg im PDF** — genau das verspricht Stufe 3 („mit Rechenweg im
   PDF"). Deshalb hier noch **nicht** als Rechenfehler geführt.

   **Ebenfalls ohne Modellvermerk auf dem Bildschirm:** weder Stufe A–E
   noch ein Modellvermerk taucht in der Ansicht auf (`grep` über den
   gerenderten Text: null Treffer). Auch das ist am PDF zu messen.

   **Weiterhin offen:** die **PDF-Ausgabe**. Sie löst einen Download aus
   und ist der Maßstab für die beiden Befunde oben.



- [2026-08-11] **Partner-Logo caretechthiel auf der Landingpage** — `v1136i` (`0867d33`). Vorlage: `design/mockups/logo-dark.svg`, abgelegt als `frontend/landing/assets/caretechthiel-logo.svg`.

   **Zweimal eingesetzt.** Das Partnerband ist ein Marquee, dessen Track
   die Liste **doppelt** führt (20 Kacheln für 10 Partner) — ein einzelner
   Eintrag hätte die Schleife verschoben. Eingeordnet neben Funck IT,
   weil beide Technik sind.

   **Größe: keine Sonderregel nötig, gemessen statt geschätzt.**
   `.plogo` ist 216×108, `.plogo img` hat `max-width:100%` und
   `max-height:62px`. Bei 26 px Seitenpolsterung bleiben 164 px Breite.
   Das Logo hat 4:1 (viewBox 360×90) und landet damit bei **162×41** —
   genau in der Reihe der übrigen Breitformate:

   | Logo | gerendert |
   |---|---|
   | PriceHubble · Sprengnetter | 45 px hoch |
   | Christian Sperling | 46 px |
   | **CareTech Thiel** | **47 px** (nach `v1136j`, vorher 41) |
   | ImmoMetrica · RealEstatePilot | 39 / 37 px |

   **Nachgezogen auf Marcels Zuruf „etwas größer und mittig" — `v1136j`
   (`c6cc503`). Die Ursache war der Zuschnitt, nicht die Größenregel.**
   Mit `getBBox()` gemessen: der Inhalt reicht von x = 6 bis 250,8 und
   y = 22,5 bis 72, die viewBox war aber 360 × 90. Also **109 px
   Leerraum rechts** — 30 % der Bildbreite — und 22,5 oben. Der
   Schriftzug füllte nur 68 % der Kachel und saß deshalb sichtbar links.
   viewBox jetzt auf den Inhalt plus 6 px Rand; damit steht das Logo von
   selbst mittig (gemessen: Ränder 15/15 und 31/31). Dazu 14 statt 26 px
   Seitenpolster nur an dieser Kachel — bei 4,17:1 ergibt das 186 × 47.
   **Das Original in `design/mockups/` bleibt unangetastet.**

   **Die Kachel ist dunkel — und das ist eine offene Frage an Marcel.**
   Die abgelegte Vorlage ist die **Dark-Mode-Fassung**: Schriftzug
   `#F1F5F9`, Akzent `#10B981`. Auf der weißen Kachel aller anderen wäre
   der Schriftzug mit **Kontrast 1,05** unsichtbar. Ein **fremdes Logo
   färbt man nicht um**, also hat diese eine Kachel Obsidian bekommen
   (`.plogo-dunkel`, Kontrast 18,6) — nicht das Slate des Logos, damit es
   die Hausfarbe bleibt. **Liegt eine helle Fassung vor, fällt die Klasse
   ersatzlos weg** und die Kachel ist weiß wie alle anderen.

   **Die beiden Fallstricke aus dem Punkt haben nicht getragen:** Ein
   `rfind` auf `</body>` war nicht nötig, weil der Eintrag mitten ins
   Band gehört, nicht ans Dateiende — der Anker ist `alt="Funck IT"`.
   Und `env.js` spielt keine Rolle: **alle** übrigen Partnerlogos stehen
   als `data:image/png;base64` im HTML, es gibt gar keinen Logo-Ordner.
   Das SVG liegt deshalb als **Datei** in `assets/` (942 Bytes) — kein
   URL-Encoding von `#` in einer Data-URI, und im Browser mit HTTP 200
   nachgeprüft.

- [2026-08-11] **Aktionen-Aufklapper: „2 L" weg, Farbe folgt der Darstellung** — `v1136e` (`972cb9a`), `v1136f` (`eb63658`), `v1136g` (`86b7513`), `v1136h` (`4dac3cd`, `c8dd81f`). Bilder: `design/mockups/Screenshot 2026-08-11 145054.png` (das aufgeklappte Panel, schwarz in heller Sidebar) und `markt1.png`.

   **Das „2 L" ist raus** (`index.html:696`). Der Bericht kennt drei
   Stufen — 2 L Einschätzung, 5 L Marktpreisindikation, 12 L
   Wertermittlung —, und welche erzeugt wird, ergibt sich erst aus den
   Angaben. Ein fester Preis am Menüeintrag behauptet etwas, das an
   dieser Stelle niemand wählt. Die CSS-Regeln zu `.sb-act-kero` bleiben
   stehen: die Klasse ist allgemein.

   **Die Farbe: die Ursache lag zwei Ebenen tiefer als der Aufklapper.**
   Der Aufklapper war nur das Sichtbare. Gemessen, Selektor gegen
   Selektor:

   | Selektor | Spezifität | setzt |
   |---|---|---|
   | `body.dp-chrome-hell aside.sidebar` | (0,2,2) | hell `#EAE4D6` |
   | `html:not([data-ui-theme]) body aside.sidebar` | **(0,2,3)** | Obsidian `#000` |

   Eine **Typkomponente** mehr auf der dunklen Seite — und `:not()` erbt
   die Spezifität seines Inhalts nicht. **Wer „Hell" schaltete und keine
   Vorlage aktiv hatte, bekam eine schwarze Sidebar.** „Keine Vorlage"
   ist dabei der Normalfall: die Standardvariante `dealpilot` trägt
   bewusst kein `data-ui-theme`. Der Schalter war für die Sidebar also
   praktisch wirkungslos. Behoben in `v1136g` mit
   `body:not(.dp-chrome-hell)` — nur an der Sidebar.

   **Das Panel selbst** (`v1136e`) ist als geschlossene dunkle Einheit
   gebaut: schwarzer Verlauf plus goldene Schrift, in sich stimmig. Beide
   Teile mussten zusammen umgestellt werden — nur den Grund aufhellen
   ergäbe Gold auf Weiß (Kontrast 1,62), nur die Schrift abdunkeln
   Schwarz auf Schwarz. Kontraste nach dem Patch: Eintrag **18,6**,
   Sektionstitel **4,65**, Symbol **3,85**.

   **Der Grund steckte im `background-image`, nicht in
   `background-color`** — ein Kaskaden-Walker, der nur `background-color`
   liest, findet ihn nicht. Genau daran bin ich zuerst vorbeigelaufen.

   **Drei eigene Fehler, alle gemessen und zurückgenommen:**
   1. `v1136e` hängte die Regeln zusätzlich an `html[data-bg="white"]`.
      Falscher Schalter: `data-bg` steuert die **Arbeitsfläche**, der
      Chrome-Skin den **Rahmen**. In `v1136f` entfernt. (Die alte
      V260-03-Regel macht denselben Fehler; es fiel nie auf, weil der
      schwarze Verlauf sie ohnehin übermalte.)
   2. Ich hatte den `:not()`-Zusatz auch an Reiterband und Kopfzeile
      gesetzt. Gemessen: dort ändert er nur den Dunkelton (rgb(10,8,5) →
      rgb(10,10,10)), hellt aber nichts auf. In `v1136h` zurückgenommen.
   3. **Drei widersprüchliche Messreihen**, weil ich im laufenden Tab
      zwischen den Fassungen umgeschaltet habe. `style.disabled` setzt
      den berechneten Stil nicht sauber zurück, und `_dpDispSkin()`
      hinterlässt Inline-Variablen am `<body>`. **Nur nach Neuladen
      messen, genau eine Fassung pro Ladevorgang.**

   **Nebenwirkung an Marcels Einstellung, offen gelegt:**
   `_dpDispSkin('obsidian')` ruft `vorlageNachziehen()` in
   `ui-varianten.js` und setzt `ui_theme` auf `''` — meine Messaufrufe
   haben die aktive Vorlage gelöscht. Genau die Falle, vor der die
   eigene Notiz warnt („Vorlagen im Panel klicken, nicht per API"). Der
   Zustand ist jetzt „keine Vorlage + Hell", und der sieht seit `v1136g`
   richtig aus — eine gewünschte Vorlage muss aber neu gewählt werden.

- [2026-08-11] **Objekt-Tab: eigener Reiter für die Marktbericht-Felder** — `v1121` (`4049eb1`), `v1134` (`0822398`), `v1135` (`b703134`), `v1135b` (`70f0d63`), `v1136` (`d11e1df`), `v1136b` (`111ca92`), `v1136c` (`6131f56`).

   Der Punkt lief über vier Ausbaustufen, weil die Kette an **vier**
   Stellen gerissen war. Alle vier sind gemessen, nicht vermutet:

   | Stelle | Was sie tat | Behoben in |
   |---|---|---|
   | `_mbBuildObjData()` | ließ fünf Felder aus, die im Bericht mitrechneten | `v1121` |
   | `collectData()` / `objectService.update()` | voller Ersatz statt Merge — das Hauptprogramm löschte die Felder beim nächsten Speichern | `v1134` |
   | `fillFromData()` | las die 38 Felder nie zurück ins Berichtsformular | `v1135` |
   | `loadData()` | leerte beim Objektwechsel nur 17 Felder — der Rest trug den Wert des Vorgängers weiter | `v1136` |

   **Der Reiter selbst** steht als aufklappbarer Block am Ende des
   Objekt-Reiters, `data-collapsible="wm-obj"`, Standard zugeklappt. 38
   Felder in sechs Gruppen. **Jede Id ist der Speicherschlüssel** aus
   `_mbBuildObjData()`, jede Optionsliste 1:1 aus `wertermittlung.js` —
   ein abweichender Wert käme im Bericht still als leer an (`v1135b`).

   **Vier tote Felder gefunden.** `baustatus`, `bgf`, `standardstufe` und
   `brw_stichtag` standen seit `WOBJ32-1` im HTML und in **keiner Zeile
   JavaScript**: nie gespeichert, nie geladen, nur getippt. Gemessen mit
   `grep` über `frontend/` — außerhalb von `index.html` kein einziger
   Treffer. Die ersten drei sind in den neuen Block gewandert (sie gehören
   zum Gebäude, nicht zum Boden), der Stichtag bleibt beim Bodenrichtwert.

   **Die Falle, die der Eintrag in `FIELDS` erst geschaffen hätte:**
   `loadData()` setzt nur, was das neue Objekt führt. Solange die Felder
   gar nicht gespeichert wurden, war das harmlos — ab dem FIELDS-Eintrag
   wären die 828 m² Hinterland von Objekt A beim Speichern an Objekt B
   geklebt. Deshalb steht `WM_FIELDS` an **zwei** Stellen: in `FIELDS`
   und in der Leerliste von `loadData()`.

   **Im Browser durchgemessen, Objekt Hermannstr. 9 Hüllhorst:**

   | Prüfung | Ergebnis |
   |---|---|
   | Alle 38 Ids im HTML, keine doppelt | 38/38, `uniq -d` leer |
   | `collectData()` sammelt ein | 38/38 |
   | Am Server nach dem Speichern | 38/38, 183 → 222 Schlüssel |
   | Objektwechsel auf ein Objekt ohne diese Daten | **0 Felder tragen weiter** |
   | Zurück zum Objekt | **38/38 korrekt**, keine Abweichung |
   | Objektwahl im Marktbericht, Stufe 3 | **22/22 vorhandene Felder korrekt** |
   | Handybreite 390 px (iframe-Messkabine) | eine Spalte, kein Querlauf |

   Die 17 Felder, die im Bericht fehlen, sind die „nur Häuser"-Felder —
   bei einer ETW richtig so.

   **Zwei eigene Fehler, ausdrücklich benannt.** Der `mea`-Rückfall in
   `v1136` stand in der Schleife von `fuelleWertermittlung()` und wirkte
   deshalb nie: derselbe Datensatz geht an den Beobachter, der
   `d[schlüssel]` **erneut** liest. Da die Felder vor Stufe 3 gar nicht im
   DOM stehen, lief er immer ins Leere. In `v1136b` am Datensatz
   normalisiert. Und der Marktbericht-Pfad ist **nicht**
   `/marktbericht-app/` im Browser — er läuft als iframe im Reiter
   „Analyse → Marktbericht"; die direkte URL liefert die Haupt-App ohne
   Stile.

   **Nebenbefund, der einem offenen Punkt gehört** (jetzt Punkt 7,
   Marktbericht): `mapCond()` ordnete den Zustand **„gut"** keiner Option
   zu und sperrte damit den Bericht, und **„stark sanierungsbedürftig"**
   kam als **„saniert"** an. Beides in `v1136c` behoben, ausführlich unter
   Punkt 7 beschrieben.

   **Auf Produktion ausgerollt am 2026-08-11** — `main` von `e682367`
   (`v1111`) auf `5d98ada`, **98 Commits auf einmal**: die Handy-Freigabe
   `v1118`, die Steuer-PDFs `v1131`–`v1133` und die ganze
   Marktbericht-Kette. Vorher gesichert: `/root/backup-pre-v1136.sql`
   (11,3 MB) und `/root/backup-mb-pre-v1136.sql` (13,5 MB) — beide mit
   Abschlussmarke geprüft, die mb-DB steht in keinem Backup-Skript.

   **Keine Migration** in den 98 Commits, zwei Backend-Dateien geändert
   (`routes/marktbericht.js`, `services/aiCreditsService.js`) → nur
   `backend` neu gebaut, `mb-backend` unangetastet. Backend danach
   *healthy*, „Migration complete", DB verbunden.

   **Der befürchtete Datenverlust traf auf Produktion niemanden:** von 15
   Objekten trug **keines** Wertermittlungsangaben, keines einen
   Marktbericht-Snapshot. Nichts gelöscht — es gab nichts zu bereinigen.

   **Auf Produktion angemeldet nachgeprüft** (Objekt Dealstreet 999,
   2026-08-11): 38/38 gespeichert, 38/38 zurückgeladen, **0 Felder tragen
   beim Objektwechsel weiter**, im Marktbericht 21/21 übernommen und
   **alle drei Stufen erreicht**. Die Prüfwerte sind danach wieder
   entfernt worden — 39 Felder geleert, die echten Objektdaten (`kp`,
   `str`, `wfl`, `mea`) unangetastet.

   **Dabei fiel der letzte Fehler der Kette auf — `v1136d` (`5d98ada`).**
   Auf Staging hatte ich mit selbst gesetzten Werten gemessen, und die
   hatte ich mit **Punkt** geschrieben. Ein echter Nutzer tippt Komma: das
   Prod-Objekt führt `mea = "7,06"`. Ein `<input type="number">` lehnt das
   **still** ab und bleibt leer — dieselbe Falle wie bei den
   Auswahlfeldern in `v1135b`, nur eine Feldart weiter. Ohne
   Miteigentumsanteil erreicht eine Wohnung Stufe 3 nicht; der Bericht war
   also erneut gesperrt, aus einem ganz anderen Grund als in `v1136c`.
   `setVal()` schreibt jetzt nach dem Fehlschlag die deutsche Schreibweise
   um und warnt sonst in der Konsole.

   **Bewusst offen gelassen: der Tausendertrenner.** `"1.570"` nimmt ein
   `number`-Feld an — als **1,57**. Ob ein einzelner Punkt Tausender oder
   Dezimale meint, lässt sich nicht ohne Raten entscheiden (`1.15` ist ein
   gültiger Sachwertfaktor, `1.570` wären 1570 m²). Deshalb bleibt ein
   Punkt unangetastet. **Wer das lösen will, muss an der Quelle ansetzen:**
   die Haupt-App sollte Zahlen normalisiert speichern, statt die
   Tippschreibweise durchzureichen.

- [2026-08-11] **Finanzamt-PDF: Rechnung geprüft, Darstellung neu** — `v1131` (`534d7e3`), `v1132` (`6352e2a`), `v1133` (`de976c2`).
   Ergebnisdarstellung neu bauen.** Drei Arbeiten an einer Datei, in dieser
   Reihenfolge:

   1. **Die Rechnung prüfen.** Das PDF, wie es heute aussieht, liegt im
      Mockup-Ordner. **Der Prüfmaßstab ist nicht meine eigene Rechnung**,
      sondern Marcels angehängte Berechnung
      **`Immokalk_GK_AmMarkt11_WEH22_11_2025`** (ebenfalls
      `design/mockups/`). Zahl für Zahl dagegenhalten, Abweichungen
      benennen — nicht stillschweigend anpassen.

      **ERLEDIGT 2026-08-11, beide Dateien gelesen. Ein Fehler gefunden und
      behoben (`v1131`, `534d7e3`).**

      **Unser PDF ging nicht auf.** Die sechs Zwischensummen ergeben
      `1.928 + 700 + 405 + 0 + 978 + 0 = 4.011 €`. Ausgewiesen waren
      **5.511 €** — **1.500 € mehr, die in keiner Zeile standen.**
      Ursache: `_computeYearTotal` (`tax.js:1056`) rechnet `nk_umlf`, die
      **umlagefähigen** Nebenkosten, in die Summe ein; der Abschnitt
      Betriebskosten zeigte aber nur `nk_n_umlf` und `betr_sonst`.

      **Die Rechnung ist richtig, die Darstellung war es nicht.**
      Nachgelesen statt angenommen: umlagefähige Nebenkosten gehören auf
      **beide Seiten** — als Einnahme beim Zufluss (Anlage V Zeile 14) und
      als Werbungskosten beim Abfluss (Zeile 33 ff.); **eine Saldierung ist
      nicht zulässig** (§ 11 EStG, Zufluss-/Abflussprinzip).
      **Marcels Immokalk macht es genauso** — dort steht
      „Nebenkosten (Umlagefähige Kosten) 2.092,23 €" als eigene Zeile in
      Abschnitt 2.0. Die Vorlage bestätigt die Korrektur.

      Für den Leser war das Papier unprüfbar: ein Finanzamt, das
      nachrechnet, findet eine Lücke von 1.500 €. Behoben an zwei Stellen —
      die Zeile im Abschnitt 2 und die Aufschlüsselung der Einnahmen in
      Kaltmiete + Umlagen. **Keine Zahl geändert, nur sichtbar gemacht.**

      **Immokalk selbst nachgerechnet, geht auf:**
      `2.941,84 + 2.092,23 + 415,00 + 816,08 + 3.190,34 + 2.200,00 =
      11.655,49 €`; `8.296,12 − 11.655,49 = −3.359,37 €`. ✓

      **Eine Unstimmigkeit in der Vorlage, ehrlich vermerkt:** dort steht
      „Abschreibung **4 %**", gerechnet wird aber mit **3,85 %**
      (`82.866 × 3,85 % = 3.190,34`). Die Bemerkung nennt den Grund
      („AfA 3,85 % nach Restnutzungsdauergutachten"). **Wer das Layout
      übernimmt, sollte den echten Satz zeigen, nicht den gerundeten.**
   2. **Die Zusammenfassung unten neu darstellen.** Marcels Urteil: die
      Ergebnisanzeige ist nicht gut gelungen. **`Immokalk_…` ist die
      Vorlage**, wie es zusammengefasst und dargestellt werden soll.

      **Der Abgleich steht (2026-08-11). Drei Dinge kann die Vorlage, die
      unser PDF nicht kann:**

      | Immokalk zeigt | unser PDF |
      |---|---|
      | **Die Herleitung der AfA**: Kaufpreis + Grunderwerb + Notar + Fahrt + Verpflegung + Unterkunft → Anschaffungskosten **94.224,83 €** → BMF-Aufteilung **90,67 % Gebäude / 9,33 % Boden** → Satz → **AfA 3.190,34 €** | eine einzige Zeile „AfA Gebäude (linear) 978 €" — **ohne jede Herleitung** |
      | **Die Steuerwirkung**: zvE vor/nach Investition, Grenzsteuersatz, ESt vor/nach, Steuersatz — und daraus **„Steuer Verlust/Überschuss pro Jahr 1.380 € · pro Monat 115 €"** | **fehlt vollständig** — das Papier endet bei der Werbungskosten-Summe |
      | **Bemerkungsspalte** je Abschnitt („4 Fahrten zur Immobilie, Eigentümerversammlung") | Bemerkungen werden zwar gelesen (`bem.*`), aber nur klein an der Zeile |

      **Das Wichtigste ist die zweite Zeile.** Marcels Blatt beantwortet
      „was bringt mir das steuerlich im Monat?" — unseres hört davor auf.
      `tax.js` **rechnet** die Steuerwirkung bereits (`baseIncome`, zvE je
      Jahr über `DealPilotTaxPeriods`); sie kommt nur nicht aufs Papier.

      **Die Steuerwirkung ist gebaut: `v1133` (`de976c2`).** Neuer Block
      „STEUERWIRKUNG" nach dem Muster der Vorlage — zvE vor/nach,
      Einkommensteuer vor/nach, Grenzsteuersatz, und als hervorgehobene
      Zahl **Ersparnis pro Jahr und pro Monat**.

      **Gerechnet wird nichts neu.** `calcImmoTaxImpact` (`tax.js:124`)
      liefert `taxBefore`, `taxAfter`, beide Steuersätze und `refund`
      längst — `_computeYearTotal` reichte davon nur zwei Werte weiter.
      Jetzt kommen `zve` und die ganze Auskunft mit. **Eine eigene
      Steuerformel im PDF wäre eine zweite Wahrheit.**

      **Fehlt das zvE, fällt der Block ganz weg** — lieber keine Aussage
      als eine Steuerersparnis auf einem geratenen Einkommen.

      **Nachgemessen am Testobjekt:** `nk_umlf` = **1.500 €**, also genau
      die zuvor unsichtbare Lücke. Einnahmen 3.700 + 1.500 = 5.200 ✓.
      Die Aufstellung **geht jetzt auf**: Zeilensumme 5.511 = ausgewiesene
      5.511. Steuerfelder: zvE 68.000 €, ESt 17.957 → 17.826,
      Ersparnis 131 €/Jahr, 11 €/Monat.

      **Die AfA-Herleitung bleibt bewusst außen vor.** Sie steht in der
      Vorlage prominent (Anschaffungskosten → BMF-Aufteilung → Satz →
      Betrag), ließe sich aber nicht nachbauen, ohne die Einzelposten
      (Grunderwerbsteuer, Notar, Fahrtkosten zur Anschaffung) als neue
      Eingabefelder zu erheben — `tax.js` führt sie heute nicht getrennt.
      **Auf Rückfrage entschieden, 2026-08-11: „das bleibt erstmal so."**
      Wenn es später doch kommt, ist es ein eigenes Paket mit eigener
      Prüfstrecke, kein Nachschlag.
   3. **Zeilen mit Null verschwinden.** **ERLEDIGT `v1132` (`6352e2a`).**
      **Marcels Entscheidung 2026-08-11 auf Rückfrage: „alles was leer oder
      eine 0 hat wird nicht angezeigt."** Damit ist der Zweifel im Punkt
      aufgelöst — eine berechnete Null wird **nicht** anders behandelt als
      ein leeres Feld.

      Geprüft wird der **Rohwert**, nicht der formatierte (die Falle aus
      diesem Punkt: `_euro(null)` liefert `"–"` und ist truthy). Und
      `Number(null)` ist 0 und besteht `Number.isFinite`, deshalb zuerst
      auf Abwesenheit prüfen, dann rechnen.

      **Bleibt von einem Abschnitt keine Zeile übrig, fällt der ganze
      Abschnitt weg** — Überschrift und Zwischensumme mit. Eine Überschrift
      über einer leeren Fläche mit „Zwischensumme 0 €" ist genau das
      Rauschen, das weg sollte.

   **Randbedingungen aus dem PDF-Bau:** jsPDF kennt nur Helvetica, **kein
   U+2212** (Pfeile als `->`), `charSpace` wirkt über den Aufruf hinaus und
   muss zurückgesetzt werden, und Gold läuft dort über `_pdfGold()` —
   `var()` gilt in jsPDF nicht.

   **Bevor gebaut wird, das PDF und die Immokalk-Datei tatsächlich lesen.**
   Beide liegen im Ordner; ein Umbau nach Beschreibung wäre geraten.


- [2026-08-11] **Wizard, Schritt 2: der Marktbericht bekommt Reiter** —
  `v1127` (`8a68008`), `v1127b` (`7830ce4`), `v1127c` (`076878b`).

  ### Drei Reiter, nicht fünf — die Struktur hat es besser gewusst

  Der Entwurf zeigte fünf Schritte. Beim Bauen fiel auf: **die vorhandenen
  Blöcke fallen genau auf die drei Stufen.** Damit entspricht jeder Reiter
  einem Meilenstein aus `v1126`:

  | Reiter | enthält | Meilenstein |
  |---|---|---|
  | 1 · Objekt | Objektwahl, `.dpkt`, Adresse, Eckdaten | Einschätzung |
  | 2 · Zustand & Markt | `wm-b1`, Genauigkeitsblock | Marktpreisindikation |
  | 3 · Wertermittlung | `wm-b3` (Grundstück, NHK, Feinjustierung) | Wertermittlung |

  **Eine Gliederung, zwei Darstellungen** — statt zweier Gliederungen, die
  auseinanderlaufen. Fünf Reiter hätten `wm-b3` zerlegen müssen, und den
  baut `wertermittlung.js` bei jedem Stufenwechsel neu.

  ### Es wird umgehängt, nicht neu gebaut

  Die Felder bleiben **dieselben DOM-Knoten**, sie wandern nur in andere
  Behälter. Damit gilt weiter: `payload()` liest dieselben Elemente über
  dieselben Ids, jeder vorhandene Listener bleibt hängen, **kein zweiter
  Feldkatalog**.

  **Ein Beobachter ist nötig:** `zeichnen()` entfernt `wm-b1`/`wm-b3` und
  setzt sie neu in die Panel-Spalte — bei jedem Stufenwechsel. Ohne
  Nachführung lägen sie danach wieder außerhalb der Reiter. Dasselbe Muster
  wie `karten-kompakt.js`. Kein `requestAnimationFrame`.

  ### Nachgemessen

  | Prüfung | Ergebnis |
  |---|---|
  | Felder je Reiter | 11 / 24 / 18 (Reiter 3 erst ab Stufe 3) |
  | außerhalb der Reiter verblieben | **0** |
  | `wm-b3` nach Neuzeichnen | landet **im dritten Reiter** |
  | `payload()` über alle Reiter | `wert_stufe` 3, `mea_pct` 7.06, `bgf` 346.62 |
  | Rückweg `_mbBuildObjData()` | `baujahr`, `gsfl`, `bgf`, `mea_pct`, `wfl` — alle da |
  | Umschalten | Reiter 2 sichtbar, 1 und 3 verborgen |

  **Der wichtigste Nachweis ist der vorletzte:** beide Sammelstellen lesen
  quer über alle drei Reiter weiter alles. Genau dafür wurde umgehängt statt
  neu gebaut.

  ### Zwei Nachbesserungen, beide aus dem Nachmessen

  - **`v1127b`:** zwei Blöcke lagen noch außerhalb — die Überschrift
    „Objekt eingeben" (doppelt jetzt den Reiternamen, wandert in Reiter 1)
    und die Aktionszeile „Letzte Ausgabe / Teilbares Angebot" (gehört in
    den Fuß). Beide haben weder Id noch Klasse und werden über ein
    enthaltenes Element erkannt.
  - **`v1127c`:** der dritte Reiter war **angeschnitten**. Gemessen brauchen
    die drei zusammen rund 372 px, die Spalte hat 338. Mit
    `overflow-x:auto` war er nur durch seitliches Scrollen erreichbar —
    **ein Reiter, den man nicht sieht, ist kein Reiter.** Jetzt `flex-wrap`.

  ### `v1128` — Marcels Befund: „voll klein und gedrückt"

  **Er hat recht, und es war mein Fehler.** Ich hatte die Reiter in die
  **linke Spalte gequetscht**, statt dem Wizard die Fläche zu geben. Mein
  eigener Entwurf zeigte ihn über die volle Breite — umgesetzt hatte ich
  ihn im alten Korsett.

  Gemessen: `.grid` steht auf **`380px 898px`**. Die Formularspalte ist fest
  380 px breit, während daneben **898 px leer stehen**, solange kein
  Bericht da ist.

  **Jetzt drei Zustände, alle nachgemessen:**

  | Zustand | Raster | Inhalt | Ergebnis-Spalte |
  |---|---|---|---|
  | Wizard | **1300 px, eine Spalte** | 760 px zentriert | verborgen |
  | beim Erzeugen | dito, Wizard gedimmt | **Ladebalken 760 px** | verborgen |
  | mit Ergebnis | zurück auf `380px 898px` | wie heute | **sichtbar** |

  **Der Inhalt bleibt auf 760 px zentriert** — eine Formularzeile über
  1.278 px wäre unlesbar. Dazu größere Reiter (14 px), größere Felder
  (15 px), ein goldener „Weiter →" und ein **760 px breiter** Erzeugen-Knopf.

  **Der Ladebalken war schon da** (`#genProgress` mit Fortschritt und
  Schrittmeldungen) — er klebte nur unten in der schmalen Spalte. Jetzt
  bekommt er die Bühne, und der Wizard dimmt währenddessen ab.

  **Erkennung am vorhandenen Zustand, kein zweiter Merker:** `#resultBody`
  trägt `hide`, solange kein Bericht vorliegt; `#genProgress` trägt `hide`,
  solange nicht erzeugt wird. Das ist die Wahrheit der App.

  ### `v1129` — mehr Reiter, Zusatzwerte, Prozent am Balken

  Marcels drei Wünsche, alle umgesetzt.

  **Sechs Reiter statt drei.** Gemessen trug „Zustand & Markt" **24 Felder**
  — mehr als die anderen beiden zusammen. `precBox` besteht aber aus zehn
  sauberen `.row`-Zeilen, die sich trennen lassen:

  | Reiter | Felder | Stufe |
  |---|---|---|
  | 1 Objekt | 11 | Einschätzung |
  | 2 Zustand | 7 | Marktpreisindikation |
  | 3 Ausstattung | 8 | Marktpreisindikation |
  | 4 Gebäude & Außen | 9 | Marktpreisindikation |
  | 5 Wertermittlung | 12 | Wertermittlung |
  | **6 Zusatzwerte** | 6 | Wertermittlung |

  **Die Meilensteine bleiben drei** — mehrere Reiter zahlen auf dieselbe
  Stufe ein. Reiter 6 trägt genau die gewünschten Werte:
  `lzs` (Liegenschaftszins), `sachwertfaktor`, `brwManuell`, `brwStichtag`,
  `brwAnp`, `brwAnpGrund`.

  ### Zwei Befunde, die erst der Prüflauf gezeigt hat

  **1 · Doppelte Ids** (`v1129b`). Der Expertenblock steckt in `wm-b3`, und
  `wertermittlung.js` baut `wm-b3` bei **jedem** `zeichnen()` neu. Hatte
  ich ihn vorher nach Reiter 6 verschoben, entstand daneben eine **zweite,
  leere** Fassung mit denselben Ids. `getElementById` nimmt die erste —
  `payload()` las damit die leere. **Gemessen: `lzs_pct` kam als `null` an,
  obwohl 2,56 im Feld stand.** Jetzt wird vor jedem Einräumen aufgeräumt:
  es darf nur eine geben, behalten wird die im Reiter.

  **2 · Der Ladebalken hat nie existiert** (`v1129c`). `#genProgress` ist
  im HTML ein **leeres `div`**. `app.js` sucht darin `#genProgBar` (Z. 283)
  und `#genProgSteps` (Z. 289) — **beide gibt es nicht**. Der Balken-Code
  lief ins Leere, die Schritte wurden per `innerHTML` direkt in den Kasten
  geschrieben. **Es gab immer nur eine Schrittliste, nie einen Balken.**

  Jetzt wird das Gerüst gebaut, das der vorhandene Code erwartet:
  Kopfzeile mit Prozent, `#genProgBar`, `#genProgSteps`. `app.js` füllt
  beides von selbst. **Die Prozentzahl wird aus der Balkenbreite gelesen,
  nicht zweitgerechnet** — ein eigener Zähler wiche ab, sobald `app.js`
  seine Kurve ändert.

  **Nachgemessen:** 8 % → „8 %", 35 % → „35 %", 67 %, 92 % — die Anzeige
  folgt exakt. Balken 760 px breit, Schritte darunter, Wizard gedimmt.

  ### Dazu: der iframe zeigte auf den alten Stand

  `marktbericht-view.js:91` trug einen **fest verdrahteten** Cache-Buster
  `index.html?v=1077b`. **Im Hauptprogramm wäre weiter die alte Fassung
  erschienen** — der Marktbericht läuft dort als iframe. Mitgezogen.

  ### `v1130` — die Übersicht wird der erste Reiter

  Marcels Vorgabe: „die Objekte einlesen, die Tabelle mit den
  Marktberichten und ein angelegtes Objekt direkt wählen — **das ist ja
  quasi die Übersicht**."

  Alle drei Wege standen **verstreut**: die Berichtstabelle als weißer
  Balken über allem (`#mbReportsPanel`, Geschwister der `.grid`),
  Objektwahl und Einlesen mitten im Objekt-Reiter. Sie stehen jetzt
  zusammen als **Reiter 1**.

  | Reiter | Felder |
  |---|---|
  | **1 Übersicht** | Berichtstabelle, Objektwahl, `.dpkt`, Sichern/Laden |
  | 2 Objekt | 9 |
  | 3 Zustand | 7 |
  | 4 Ausstattung | 8 |
  | 5 Gebäude & Außen | 9 |
  | 6 Wertermittlung | 12 (ab Stufe 3) |
  | 7 Zusatzwerte | 6 (ab Stufe 3) |

  **Zwei Anpassungen im Unterbau:** der Auflöser sucht jetzt im ganzen
  Dokument statt nur in der Formularspalte — die Berichtstabelle steht
  außerhalb. Und die harten Grenzen `1` und `3` in der Navigation sind
  durch `SCHRITTE.length` ersetzt: **eine Liste, eine Wahrheit** — sonst
  hätte der siebte Reiter keinen „Weiter"-Knopf bekommen.

  **Nachgemessen:** sieben Reiter, nichts außerhalb, Übersicht trägt alle
  vier Bestandteile.

  ### Damit ist Marcels Konzept vollständig

  **Übersicht → Wizard → Ladebalken mit Prozent → Ergebnis.**
  Was noch offen ist, steht als eigener Punkt im Backlog (Feinschliff der
  Ergebnisdarstellung gehört zum Finanzamt-PDF-Punkt).

- [2026-08-11] **Wizard, Schritt 1: die Stufenfrage wird zur
  Meilensteinleiste** — `v1126` (`7f4343b`), `v1126b` (`2e03655`),
  `v1126c` (`5699bfe`), Lese-Endpunkt (`stufenpreis`).

  Der Kern von Marcels Entscheidung: **die drei Stufen vereint, nicht
  vorher abgefragt.** Man füllt aus, und die Stufe **ergibt sich**; am
  Erzeugen-Knopf steht, was sie kostet.

  **Kein zweites Stufenmodell:** `stufe()` und `setStufe()` aus
  `wertermittlung.js` bleiben die einzige Wahrheit. Der neue Baustein
  rechnet die Stufe nur aus und meldet sie dorthin — Blöcke, Ampel und
  `payload()` folgen unverändert.

  > **Diese Behauptung stand hier zuerst falsch.** Ich hatte geschrieben,
  > die Bedingungen seien „dieselben wie die der Verfahrensampel". Sie
  > waren es **nicht** — siehe `v1126d` unten.

  **Der Preis kommt vom Server.** `GET /marktbericht/stufenpreis?ref=…`
  liefert die bezahlte Stufe und den fälligen Betrag je Stufe. Der Browser
  rechnet die Ermäßigung **nicht** selbst — er kennt die bezahlte Stufe
  nicht und soll sie nicht kennen. Antwortet der Server nicht, stehen die
  vollen Preise da. **Nutzertrennung nachgewiesen:** ein Objekt eines
  anderen Nutzers liefert `bezahlte_stufe: 0`, geprüft an zwei echten
  Objektkennungen aus dem Log.

  ### Zwei eigene Fehler, beide erst im Durchgang sichtbar

  1. **Der Preis stand nie am Knopf** (`v1126b`). Mein Riegel prüfte auf
     `b.disabled`. Gemessen ist der Erzeugen-Knopf aber auch im
     Normalzustand deaktiviert, solange Pflichtangaben fehlen — der Preis
     wäre nie zu sehen gewesen. Überschrieben werden darf nur der
     **laufende** Abruf; `app.js` setzt dort ein `span.spin` hinein.
  2. **Stufe 3 war unerreichbar** (`v1126c`) — ein Henne-Ei-Problem.
     Stufe 3 verlangt `plot` und je nach Objektart `mea` bzw.
     `standardstufe`/`nhkHaus`. Die liegen **alle** im Block `wm-b3`, und
     den baut `wertermittlung.js` erst `if (s >= 3)`. **Die Felder, die
     hochstufen, gab es vor dem Hochstufen gar nicht.**

     Auflösung ohne Frage vorweg: **der Meilenstein ist anklickbar** und
     blendet seine Angaben ein. Ein Klick ist kein Fragebogen, sondern das
     „Vertiefen" aus dem Entwurf; danach entscheiden wieder die Felder.

  ### Nachgemessen, ganze Leiter

  | Schritt | Stufe | Knopf |
  |---|---|---|
  | Adresse + Fläche | 1 | „· 2 L" |
  | + Baustatus + Zustand | 2 | „· 5 L" |
  | Klick auf „Wertermittlung" | 2 | Block erscheint, `plot`/`mea` da |
  | + Grundstück + MEA | **3** | **„· 12 L"** |

  `dp_mb_stufe` folgt jeweils, die Punkte leuchten auf, der Hinweistext
  nennt, was für die nächste Stufe fehlt.

  **Ein eigener Messfehler, zum zweiten Mal derselbe:** ich habe `7,06` mit
  Komma in ein `type="number"`-Feld gesetzt. Der Browser verwirft das, das
  Feld bleibt leer — es sah nach einem Fehler im Code aus. **Zahlen in
  Prüfläufen immer mit Punkt.**

  ### `v1126d` — Marcels Befund, beides bestätigt

  Sein Eindruck: „ich sehe kaum Unterschied, nur oben ist anders — und das
  ist komisch." Beides stimmte.

  **1 · Die Leiste behauptete mehr, als da war.** Sie meldete
  „Wertermittlung erreicht" bei einem halb leeren Formular **ohne
  Baujahr**. Ursache: mein `erreicht()` prüfte nur `address`, `ptype`,
  `area` — nicht die echten Pflichtangaben. **Mein Satz oben, die
  Bedingungen seien dieselben wie die der Ampel, war schlicht falsch.**

  Jetzt aus `VERFAHREN` in `wertermittlung.js` abgeschrieben:

  | Verfahren | Pflicht | empfohlen |
  |---|---|---|
  | markt | `ptype`, `area`, `year`, `baustatus` | `cond`, `quality` |
  | ertrag | `plot`, `units` | |
  | sach | `plot`, `year` | (bei ETW nicht anwendbar) |

  **Eine Leiste, die mehr behauptet als da ist, ist schlimmer als keine.**

  **2 · Waagerecht passte sie nicht.** Gemessen: die Spalte ist **338 px**
  breit, drei Beschriftungen brauchten je 120 px — sie klebten aneinander.
  Jetzt eine **Liste** statt einer Bahn. Derselbe Inhalt, liest sich ruhig,
  und es ist Platz für das Nützlichste: **was jeder Stufe konkret fehlt**,
  Feld für Feld benannt („fehlt: Baujahr").

  Dazu `FEHLT_TEXT` gelöscht — eine zweite, von Hand gepflegte Liste
  derselben Pflichtangaben, die prompt auseinanderlief. Was fehlt, sagt
  jetzt `fehlend()` aus `BEDARF`, aus **einer** Quelle.

  **Nachgemessen:** leeres Formular → Stufe 0, jede Zeile nennt ihr
  fehlendes Feld, kein Überlauf im 338-px-Kasten. Baujahr eintragen →
  **Stufe 1, „· 2 L"**. Zustand und Qualität dazu → **Stufe 2, „· 5 L"**.

  **Zu „kaum Unterschied":** völlig richtig — bisher ist **nur** die
  Stufenfrage ersetzt. Alles darunter ist unverändert, die fünf Reiter
  kommen erst.

  **Als Nächstes:** die fünf Reiter (die vorhandenen Felder werden
  umgehängt, nicht neu gebaut), dann die Übersicht.

- [2026-08-11] **GELD · Drei echte Stufenpreise, Vertiefen kostet die
  Differenz** — `v1125` (`75bbcd0`), `v1125b` (Riegel), `v1125c`
  (`35ecc22`). **Marcels Entscheidung: Weg 3.**

  ### Der Befund

  Die Oberfläche bewarb Stufe 1 mit **2 L**, abgebucht wurden **5 L**. Der
  2-L-Zweig hing am Kennzeichen `fast` — und das kam nie an: `fastMode`
  existiert im ganzen Frontend **nur in der Zeile, die es abfragt**
  (`app.js:251`). `COST.fast` war toter Code. Dazu nannte der
  Bestätigungsdialog **fest „5 L"**, auch bei Stufe 3 mit 12 L.

  ### Umgesetzt

  **Backend** (`routes/marktbericht.js`): `STUFENPREIS = {1:2, 2:5, 3:12}`,
  ein eigener Zweig für Stufe 1. `_kerosinKosten` ist jetzt `async` und
  bekommt `userId` + `externalRef` — **in beiden Routen wandert die
  Objektkennung deshalb vor den Preis**. Bei `cost === 0` wird **gar nicht
  gebucht**: `consume()` zieht intern `Math.max(1, cost)`, ein Aufruf mit 0
  hätte 1 L gekostet und aus „schon bezahlt" ein „kostet doch was" gemacht.
  `wert_stufe` wandert in die `meta`.

  **Die schon bezahlte Stufe kommt aus dem eigenen Kerosin-Log, niemals vom
  Client.** Eine vom Browser mitgeschickte „ich habe schon Stufe 3 bezahlt"
  wäre ein Freifahrtschein für jeden Bericht.

  Zwei Feinheiten, beide am echten Log gemessen:
  - `consume()` teilt eine Buchung auf Monats- und Bonustank auf und
    schreibt dann **zwei Zeilen** für denselben Bericht. Deshalb wird je
    Bericht (Endpoint + Sekunde) summiert, bevor zurückgerechnet wird.
  - Alte Zeilen tragen kein `wert_stufe`. Für sie wird die Stufe aus der
    Summe zurückgerechnet (≥12→3, ≥5→2, ≥2→1), damit bestehende Objekte
    nicht doppelt zahlen.

  ### `v1125b` — ein Riegel, den erst der Blick ins Log erzwungen hat

  **39 Buchungen liegen unter einem `external_ref`, der der QUELLTEXT einer
  JavaScript-Funktion ist** (`function _currentObjectId(){ … }`) — der
  Fehler aus der Zeit vor `v941`, als `window._currentObjectId` die
  Funktion selbst war und eine Funktion truthy ist. Behoben ist er, die
  Altzeilen bleiben (09.06.–15.07.2026, keine neuen).

  **Ohne Riegel wären alle Objekte, die je diesen Weg genommen haben, EIN
  Objekt — und ab dem zweiten Bericht kostenlos.** Jetzt zählen nur
  Kennzeichen ohne Leerraum, höchstens 64 Zeichen, aus `[A-Za-z0-9._:-]`.

  ### Nachgemessen

  | Prüfung | Ergebnis |
  |---|---|
  | Spaltenname `ai_credits_log` | `used_at`, **nicht** `created_at` — erst falsch geschrieben, vor dem Ausrollen korrigiert |
  | SQL gegen das echte Schema | läuft, **177** Buchungen, höchste Stufe 3 |
  | Zuordnung je Objekt | stimmt: 12 L → Stufe 3, 5 L → Stufe 2 |
  | Dialog bei Stufe 1 / 2 / 3 | **2 L / 5 L / 12 L**, mit Differenz-Hinweis |
  | Kerosin im Prüflauf | **0 L** — `confirm` abgefangen und abgelehnt |
  | Backend im Container | `STUFENPREIS` und `_refTaugt` vorhanden, Server läuft |

  **Noch offen:** die **exakte** Ermäßigung im Dialog. Der Browser kennt die
  bezahlte Stufe nicht (und soll es nicht), deshalb wird die Differenz als
  Möglichkeit genannt, nicht als Zahl behauptet. Ein kleiner Lese-Endpunkt
  `GET /marktbericht/stufenpreis?ref=…` würde den genauen Betrag an den
  Knopf bringen — Teil des Wizard-Umbaus.

- [2026-08-11] **Spalt zwischen Tab-Leiste und Score-Karte** — `v1124`
  (`efabe66`), `v1124b` (`9832e76`). Bild:
  `design/mockups/spalt2.png`.

  ### Der Mechanismus war richtig, nur der Wert stand still

  `.main-col > nav.tabs` klebt mit `top: var(--hdr-h) !important` — es gibt
  also längst eine gemessene Kopfhöhe (V63.4). **Gemessen bei 890 px stand
  `--hdr-h` auf 308 px, während die Kopfleiste 348 px hoch war.** Die
  **40 px** Differenz sind genau der schwarze Streifen im Bild.

  **Ursache:** `_updateHdrHeight()` läuft nur bei `resize` und beim Laden
  (+100/+500 ms). Die Kopfleiste ändert ihre Höhe aber noch bei vielen
  anderen Anlässen — ein Objekt wird geladen und die Score-Karte erscheint,
  eine Vorlage wird umgeschaltet, der Kopf wird zu- oder aufgeklappt, die
  KPI-Pillen brechen um. Nach jedem davon bleibt der Wert stehen: die
  Leiste sitzt zu tief (**Spalt**) oder zu hoch (**sie rutscht unter den
  Kopf**).

  **Das erklärt beides** — warum es Marcel „schon mehrfach" auffiel, und
  warum ich es in vier sauberen Messläufen nie sah: dort lief kurz vorher
  immer ein `resize`.

  ### Behebung: ein Beobachter statt einer Zahlentabelle

  `ResizeObserver` auf der Kopfleiste, dazu ein `MutationObserver`, damit er
  mitwandert, wenn der Kopf neu gerendert wird. Er feuert genau dann, wenn
  sich die Höhe wirklich ändert — **unabhängig vom Anlass und damit auf
  Handy und Tablet gleichermaßen** (Marcels Vorgabe zu Frage 2). Keine neue
  Zahl, keine 26. Breakpoint-Schwelle, kein Timer.

  **Kein `requestAnimationFrame`** — das feuert im verborgenen Tab nicht
  (gemessen, `dp-band-fix.js` v1092b). Der `ResizeObserver` bündelt selbst.
  **Die Messung bleibt `_updateHdrHeight()`** — eine Stelle, eine Wahrheit;
  hier kommen nur Anlässe dazu.

  ### `v1124b` — der Gegenfall, beim Prüfen gefunden

  Bei **zugeklapptem** Kopf gewann `body.hdr-collapsed .main-col >
  nav.tabs{top:48px!important}` (0,3,2). Gemessen ist der zugeklappte Kopf
  bei 890 px aber **97 px** hoch — die Leiste saß **49 px zu hoch**.
  Und es war schon vorher widersprüchlich: bei **1400 px** gewann die
  `--hdr-h`-Regel und es passte (92/92), bei **890 px** die harte 48.
  **Eine Tabelle fester Zahlen kann das nicht leisten** — die Kopfhöhe
  hängt an Breite, Vorlage, Score und Zustand. Jetzt läuft auch dieser Fall
  über den live gemessenen Wert; `48px` bleibt als Rückfall für Browser
  ohne `ResizeObserver`.

  ### Nachgemessen bei 890 px

  | Zustand | Kopfhöhe | `nav.tabs` `top` | deckt sich |
  |---|---|---|---|
  | aufgeklappt | 348 | **348 px** | ✓ |
  | zugeklappt | 57 / 308 | **57 / 308 px** | ✓ |
  | 60 px künstlich angebaut | 408 | **408 px** | ✓ |
  | wieder entfernt | 348 | **348 px** | ✓ |

  Gescrollt bei 890 px: sichtbarer Abstand **11 px** — das ist der
  `padding:10px 22px` von `#hdr-badges`, kein Spalt mehr. Zoom-Aufnahme
  bestätigt: die KPI-Kacheln sitzen direkt über der Reiterleiste.

  **Frage 2 aus dem Punkt ist damit gegenstandslos:** Es ging nie um die
  Einrückung. Die 22 px seitlicher Versatz von `.sc-main` sind derselbe
  `padding` und gewollt.

- [2026-08-11] **Textfarben-Regler für Score-Karte und KPI-Karten gebaut**
  — `v1123` bis `v1123e` (`32598a0`, `e4241a8`, `c661b44`, `d8dfd72`,
  `cb8c87a`). Alle vier Entscheidungen umgesetzt.

  ### Die Schwelle hängt jetzt an der Schriftgröße, nicht an einer Liste

  **Mein eigener Vorschlag im Punkt war richtig gedacht, aber ungenau.** Er
  lautete „Score-Zahl 3,0, Labels 4,5". Nachgelesen bei **w3.org**
  (WCAG 2.2, 1.4.3 Contrast Minimum) statt aus dem Gedächtnis: 4,5:1 für
  normalen Text, 3:1 **nur** für großen — und groß heißt **≥ 18 pt (24 px)
  oder ≥ 14 pt fett (18,5 px)**.

  Im Browser nachgemessen:

  | Element | Größe | Norm |
  |---|---|---|
  | `.sc-pill-v` ×5 | 22 px / 800 | **groß → 3,0** |
  | `.sc-v` | **16 px / 700** | **normal → 4,5** (16 < 18,5) |
  | `.sc-l` | 10,5 px / 800 | normal → 4,5 |
  | `.sc-sub` · `.sc-grade` · Pillen-Labels · `.sc-pill-sub` | 10–11 px | normal → 4,5 |

  **Eine Namensliste hätte `.sc-v` falsch eingestuft.** Aus **einer**
  Nutzerfarbe entstehen deshalb **zwei** korrigierte Töne (`-lg`, `-sm`).
  Der Nutzer wählt eine Farbe, die App wendet sie so großzügig an, wie die
  Norm zulässt — das ist „relativ breit", ohne zu raten.

  ### Vier eigene Fehler beim Bauen, alle gemessen und zurückgenommen

  1. **Score-Zahl falsch eingeordnet.** Ich hatte sie als großen Text auf
     der Markenfläche eingeplant. Gemessen sitzt sie **weiß im Donut-Ring**
     (`.sc-donut > span`, ohne Klasse) und gehört gar nicht zu diesem
     Regler. In der Score-Karte ist damit **kein** Text groß im Sinne der
     Norm.
  2. **`var(--token, inherit)` hätte den Normalzustand verändert.**
     `.sc-pill-v` hat in `ui-varianten.css` gar keine eigene Regel. Jetzt
     über die Kennzeichen `body[data-dp-kpitext]` / `[data-dp-herotext]`:
     ohne Nutzerfarbe existiert die Regel nicht, alles bleibt bitgenau.
  3. **Der Regler wirkte nur unter hellen Vorlagen.** Ohne Vorlage gewinnen
     die v1113e-Gegenrichtungsregeln (1,1,2) bzw. (1,2,2) — meine
     Kennzeichen-Regel stand bei (1,2,1) und verlor. Nutzerebene jetzt auch
     dort davor. **Ein Regler, der ohne Vorlage nichts tut, ist ein
     kaputter Regler.**
  4. **Der falsche Modulname — und das war der teuerste.** Ich hatte
     `window.DPC` abgefragt. Den Namen gibt es im Seiten-Scope nicht;
     `DPC` ist nur ein modul-interner Alias (`config.js:852`), außen heißt
     es **`window.DealPilotConfig`**. Folge: **jede Korrektur fiel still
     auf den Rohwert zurück, und die Warnung kam nie** — bei einem
     gemessenen Kontrast von **1,00**. Gefunden, weil ich die Funktion im
     Browser direkt aufgerufen habe, statt der Anzeige zu glauben. Ein
     fehlendes Modul meldet sich jetzt in der Konsole, statt im `catch` zu
     verschwinden.

  **Dazu ein Werkzeugfehler, gleich mitbehoben:** beim Hochziehen eines
  Cache-Busters hatte ich `Set-Content -Encoding UTF8` benutzt. Das hat
  `index.html` komplett neu geschrieben — jedes Nicht-ASCII-Zeichen doppelt
  kodiert (aus dem Titel wurde „Dealpilot Â· Junker Immobilien") und ein
  BOM vorangestellt, **711 Zeilen statt einer**. Datei aus `HEAD~1`
  zurückgeholt, Buster über `System.IO.File` gesetzt.
  **In dieser Codebasis nie `Set-Content` auf Dateien mit Umlauten.**

  ### Nachgemessen — beide Nachweise, die der Punkt verlangt hat

  **1 · Der Rundlauf** (der, an dem `v1122` hing): nach dem Neuladen stehen
  `#2a64b8` und `#1e7a4a` wieder in den Feldern, und die Farben sind
  angewandt.

  **2 · Weg B unter allen sechs Vorlagen**, Wunschton `#C9A84C` (Gold) und
  `#EDEDED` (fast Weiß):

  | Fassung | Hell-Skin | Score-Text | KPI-Label |
  |---|---|---|---|
  | ohne Vorlage | nein | Gold bleibt Gold — trägt auf Dunkel | `#767676` |
  | kontor · panel · kanzlei · boarding | ja | **auf `#402300` gezogen** | `#767676` |
  | konsole | nein | Gold bleibt Gold | `#767676` |

  Genau die v1113-Zweiteilung: unter hellen Vorlagen ist die Score-Karte
  Markenfläche, sonst sitzt sie auf dem dunklen Chrome. **Der Grund
  entscheidet, nicht der Name.**

  **Weg C** (eigene Ansicht): der Wunschton gilt **roh**, und die Warnung
  nennt den tragenden Ersatz — „Kleine Beschriftungen tragen nicht —
  lesbar wäre #402300."

  **Weg B** (Mandanten-Ansicht): still korrigiert, mit zwei Schwellen —
  `#EDEDED` wird `#767676` für kleine Texte und `#949494` für den großen
  Wert.

  **Zurücksetzen:** Tokens weg, Kennzeichen weg, `localStorage` leer, alle
  Farben zurück auf die Ableitung — bitgenau wie vorher.

  **`.sc-sub` und `.sc-grade` bleiben in jedem Zustand abgeleitet.**
  Das Panel ist von **acht auf zehn** Farbfelder gewachsen; die Lücke im
  Muster ist zu.

  **Eine Beobachtung fürs Bedienen, kein Fehler:** der Rücksprung von
  „Meine Mandanten" auf „Mich" stellt den persönlichen Stand wieder her —
  auch Kartentexte, die man zwischendurch zurückgesetzt hat. Das ist die
  gewollte Foto-Mechanik aus v1111, hat mich beim Aufräumen aber einmal
  überrascht.

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
