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

### N84 · Marktbericht nach Hüllhorst/Detmold — Marcels Entscheidungen vom 29.10.2026, nächste Sitzung

Übergeben, weil die Sitzung nach dreimal demselben Fehler zu lang war (Regel 4). Stand und Nachweise: Journal `claude/projektanweisung-hauptapp.md`, Einträge v3040/v3041.

1. **v3041 auf Prod** — liegt auf Staging (`5b68200f`): Angebotsabschlag max. 10 %, Ø Kaufpreis aus Kauffällen (Marktbericht + Pilot-Analyse), Abschlag mit Betrag davor. Abnahme: Bericht Bismarckstr. 27 Detmold auf Staging neu abrufen (Erwartung: Abschlag 10 % „gemessen 22,8 %, gedeckelt“, Gegenprobe ≈ 680.000 €), Pilot-Analyse ansehen, dann `rollout-prod.ps1 -Freigabe`.
2. **Garage mit eigener Restnutzungsdauer** — Marcel: „soll seine eigene RND bekommen, wenn es nicht groß viele Felder bekommt“. Gemessen: `marktbericht/backend/src/lib/nhk2010.js:924` nimmt ohne `garagen_rnd` die RND des HAUSES (`Math.min(_garGnd, rnd)`) — Hüllhorst (Bericht 370): Garage 64,6 m² mit RND 41,7 J. = 43.537 €. Neu: RND = GND 60 − Alter der Garage; Alter aus EINEM optionalen Feld „Baujahr Garage“, ohne Angabe Baujahr des Hauses (dann bei alten Häusern RND nahe 0 — Mindest-RND klären, nicht erfinden). Danach `wertermittlung-pruefen.mjs` (Ebene C bewusst neu einfrieren, wenn Demo-Objekte Garagen haben).
3. **Sachwert nur, wo er gebraucht wird** — Marcel: „Sachwert kann da raus, wo er nicht gebraucht wird“. Hüllhorst ist eine ETW: Sachwert 273.328 € ohne Sachwertfaktor neben Vergleichswert 145.000 € (amtlicher Vergleichsfaktor) und Ertragswert 156.000 €. Regel: Sachwert erscheint nur, wo die Verfahrenswahl (`cross_check.verfahrenswahl`) ihn führt oder ein Sachwertfaktor vorliegt (Ein-/Zweifamilienhaus, DHH/RH); bei ETW und Renditeobjekten nicht. Web, PDF und Pilot-Analyse gleich.
4. **Marktbericht einfacher, weniger Text** — Marcel: „die Angaben dürfen auch einfacher verständlich dargestellt werden, mit weniger Text“. Optik → erst Demo zeigen (Wertkarten: Zahl groß, eine Zeile Herkunft, Rechenweg aufklappbar).
5. **Zensus-Miete fortgeschrieben auch anzeigen** — `frontend/marktbericht-app/app.js:101` (`_zensusZeilen`, Web + PDF) und Prompt der Pilot-Analyse `backend/src/services/openaiService.js:1238` (Endpunkt `/zensus/fortgeschrieben`). Leerstand, Eigentümerquote, Baualter bleiben „Stichtag 15.05.2022“.
6. Parkstr. 9 bleibt unverändert (Marcel).
7. **Steuer-Reiter GmbH: Hinweis „Hebesatz fehlt“ bei beantragter erweiterter Kürzung** — Marcel 29.10.2026 an der Hölderlinstr.: „wir haben doch keinen Hebesatz, wenn VV-GmbH“. Gemessen: `js/tax.js:1690–1692` rechnet bei „beantragt, Prüfpunkte offen“ (`ueberfuehrung-kern.js:254`, vier Prüfpunkte) OHNE erweiterte Kürzung und meldet den fehlenden Hebesatz rot. Vorschlag: bei beantragter Kürzung nicht den Hebesatz anmahnen, sondern auf die offenen Prüfpunkte im Mandanten verweisen (Absprung), und den Betrag ohne Hebesatz als „nicht rechenbar“ statt „0 €“ zeigen.
8. **Deckelung des Abschlags als Einstellung** — Marcel 29.10.2026: „in den Einstellungen im Set unter Marktbewertung angeben und dann eine Checkbox mit Deckelung, Standard auf 10 %“. Ort: Investmentprofil, Abschnitt „Marktbewertung“ (`js/investment-profile.js:383`, neben `ip_angebot_abschlag_pct`): Checkbox „örtlich gemessenen Abschlag deckeln“ (Standard an) + Feld „Obergrenze“ (Standard 10 %). Weg in den Bericht wie `angebot_abschlag_pct` (`dealpilot-mb.js:233`, `dealpilot-mb-qc.js:169`) als Parameter `abschlag_deckel_pct` (null = keine Deckelung); `ValuationService.gedeckelt()` (v3041, heute feste `ABSCHLAG_OBERGRENZE = 10`) liest ihn aus `ref` — der Kern liest nie Einstellungen. Das Investmentprofil gleicht `vorgaben-sync.js` schon mit dem Konto ab. Mit Punkt 1 (v3041 auf Prod) zusammen ausrollen.
9. **Hölderlinstr. (Demo, Staging `a021f2c2`): Ankauf 139.000 € / LTV 70,53 % / DSCR 1,37 gegen Bestand 125.000 € / 94,52 % / 1,18** — Marcel 29.10.2026 „warum?“. Gemessen: dieselbe Restschuld 118.150 €, aber Ankauf ÷ `svwert` 167.529 € = 70,53 %, Bestand ÷ Kaufpreis 125.000 € = 94,52 %. Seit v3006 trägt `svwert` die LTV nur mit Herkunft Gutachten/Bank (`deal-kpis.js:151`); hier ist `svw_herkunft` leer → Kaufpreis. Der Ankauf-Stand ist ohne Version gespeichert („Stand ?“), also vermutlich mit der alten Regel. DSCR: Miete (660 €) und Cashflow (1.035 €) sind in beiden Spalten gleich, der DSCR nicht — der Kaufpreis geht in den DSCR gar nicht ein; Ursache ist ein anderer Rechenstand oder eine andere Formel, NICHT der niedrigere Kaufpreis. Offen: warum `d1` heute 106.250 € ist, die Restschuld-Projektion aber von 118.150 € ausgeht, und woher die 139.000 € im Ankauf kommen. Lösung entscheiden: Ankauf-Stand mit heutiger Regel neu rechnen oder die Herkunft des Werts (Bank/Gutachten) setzen.
10. **Alle Demo-Objekte neu abrufen (Pilot-Analyse „Abruf Marktpreise“), Staging UND Prod** — Marcel 29.10.2026 „ja alle Demo-Objekte dann neu abrufen, damit es passt“ (Freigabe liegt vor). Grund: die Tafeln zeigen gespeicherte Abrufe (Bismarckstr. 21.10.: 22,7 % / 725.000 €) ohne v3041 (10 %-Deckel, Ø Kaufpreis aus Kauffällen). Reihenfolge: v3041/v3042 auf Prod → je Konto alle 19 Objekte abrufen → Staging = Prod per Feld-Diff prüfen ([[demo-konto-staging-prod]]) → `node tools/messe-storybook.mjs` neu, Geschichten prüfen ([[storybook-muss-passen]]). Achtung: beim Öffnen eines Objekts schreibt die App einen Jahresstand (gesehen 29.10. 17:27, Hölderlinstr.).

---

### N83 · Nach der Vollprüfung v3029 — Marcels Entscheidungen vom 28.10.2026 (abends), nächste Sitzung

Marcel: *„machen wir heute nicht … notier das einfach nur, machen wir nächstes Mal."*

> **Stand 29.10.2026, spaeter:** 3 (DSCR netto) erledigt mit v3031, Prod 119b7ac. Offen: Nachrechnen der Prod-Objekte (Freigabe abgelehnt, Marcel entscheidet), Telegram-MPI ohne Objekt (v3036) echter Test vor Prod, Plan-Kacheln (v3033) Abnahme.
>
> **Stand 29.10.2026:**
> - Erledigt auf Staging (`7ab5fb69`, v3030): **1** (Bodenrichtwert-Schätzung entfernt), **2** (Leerstand rechnet
>   mit) und **4** (kein Abschlag-Prozentsatz im PDF).
> - Aus **5** in der Kabine nachgemessen:
>   - Folgen-Kette nach dem Import: EK, Mietausfall, AfA nach Baujahr und GrESt nach PLZ (5 Stichproben)
>   - Hausgeld-Aufteilung 78 : 22 als Vorgabe gekennzeichnet
>   - Track-Record-Prognose beim offenen Objekt (Kennung passt, 5 Zeilen)
> - Die beiden roten Prüfer sind repariert (`79a1485c`, v3030b).
> - **Offen:**
>   - **3** (DSCR-Ampel netto, wartet auf Marcels Go, siehe unten)
>   - Seitenbild der Bankfassung mit Bausparvertrag: Abnahme an einem echten Export, das Abfangen des Speicherns in
>     der Kabine lief zweimal ins Leere
>   - KfW mit tilgungsfreien Anlaufjahren ist ein eigenes Feature, nicht begonnen.
>
> **Zu 3, Recherche:** Banken prüfen die Kapitaldienstfähigkeit am Reinertrag: Miete minus
> Bewirtschaftungskosten (Instandhaltung, Verwaltung, Mietausfallwagnis), geteilt durch den Kapitaldienst.
> Quellen: kreditwesen.de (Fachaufsatz Kapitaldienstfähigkeit von Immobilien), Dr. Klein (Finanzlexikon
> Kapitaldienstfähigkeit), wohnglueck.de (Mietausfallwagnis); als Mindestwert gilt allgemein 1,2.
> Vorschlag: Ampel und Score-Teilnote auf netto stellen und beide Werte beschriftet zeigen.
> Wirkung an Parkstr. 9: brutto 2,43, netto 1,96, Score bleibt 94; ändern würden sich nur knappe Objekte und
> die DSCR-Zahlen im Messe-Storybook.

0. ~~Prod-Rollout v3029 + landing-videothek-7~~ **erledigt 29.10.2026, Prod `dc0cdf7`** (Videos per Skript hochgeladen, md5 gleich).
1. **„Bodenrichtwert schätzen" raus.** Marcel: *„totalen Quatsch … brauchen wir nicht."* Zu entfernen:
   - der Knopf `#brw-ai-btn` (`index.html` ~1167)
   - der automatische Rückfall `askAi()` nach leerem BORIS-Abruf (`bodenrichtwert.js` ~959)
   - der Hinweis in `help.js:332` und im Hilfetext an `tab1.bodenrichtwert` (`index.html:1169`)

   Bleibt ein leeres Feld, steht daneben der Weg zum Landesportal (Doktrin „kein Treffer heißt kein
   Wert"). Prüfen, ob `brw_ki_result` aus `storage.js` (277/637) dann mitfallen kann; gespeicherte
   Altwerte nicht löschen, nur nicht mehr anzeigen. Marcel sah den Knopf nur auf dem Handy, auf dem
   Desktop nicht: messen, ob er dort verdeckt oder ausgeblendet ist.
2. **Leerstand einrechnen.** Marcel: *„zwei Prozent nehmen wir einfach mal an … dann wird's abgezogen."*
   - Heute füllt `#leerstand` (`main.js:168`, Vorgabe `leerstand_pct` 2 %) nur Score und PDF.
     `calc.js`, `tax.js`, `deal-kpis.js` und `mietentwicklung.js` lesen das Feld nicht, und das PDF
     schreibt „Leerstand 2,0 % · Vollvermietung angenommen" (`pdf.js:3969`).
   - Umsetzen: in der Jahresschleife von der Miete abziehen, dabei klären, wie es zum kalkulatorischen
     Mietausfall steht (nicht doppelt rechnen).
   - DealKpis ist ein gespiegelter Kern, danach `rechenkerne-spiegeln`. Prüffälle bewusst neu messen.
3. **DSCR-Ampel brutto oder netto: recherchieren, wie Banken es in der Praxis machen.** Heute stuft
   `dscr-engine.js` brutto ein (Miete ÷ Kapitaldienst), ebenso die Risiko-Teilnote (`dealscore.js:155`).
   Beispiel: brutto 1,20 „Standard", netto 0,96. Mit Quelle belegen, dann Ampel und Score umstellen oder
   als brutto beschriften.
4. **Abschlag-Wortlaut im Wert-&-Zielbild-PDF** (`pdf-wert-zielbild.js:76-77`, `:373`, „nach X %
   Abschlag auf Angebotspreise"): recherchieren, wie es fachlich richtig und schlüssig heißt, und dabei
   Marcels Regel vom 28.10. beachten, dass niemand die Rechenwege herauslesen soll.
5. Offen aus v3029, auf Staging nachmessen:
   - Hausgeld-Aufteilung 22 % aus dem Exposé
   - Folgen-Kette nach dem Import (Grunderwerbsteuer, Eigenkapital, Mietausfall, AfA) im Browser
   - Track-Record-Prognose beim offenen Objekt
   - Seitenbild der Phasentabellen mit Bausparvertrag
   - KfW mit tilgungsfreien Anlaufjahren ist nicht abgebildet
   - `bestand-reiter-pruefen` (4 rot) und `feld-waechter` (185 Felder) waren schon vor v3029 rot

### N82 · Flugplan / Zielbild-Umbau — GEPARKT (28.10.2026)

**GEPARKT:** Marcel am 28.10.2026: „können wir das erstmal los lassen und bauen wir später um?“ — erst nach der Messe (31.10.–01.11.) wieder aufnehmen.

Sieben Demo-Fassungen liegen vor: `design/mockups/flugplan-demo.html`, veröffentlicht unter https://claude.ai/artifact/QckHnnmYVyRRL6hCZ4Ckib
(Karten-Baukasten · Zielbild-Assistent · Flugroute · Wertsäulen · Bank-Exposé · Portfolio-Cockpit · Soll/Ist). Marcels Wahl der Fassung
(oder Kombination, z. B. Assistent + Baukasten + Exposé) steht aus. Bekannte Lücke der Demo: Bad, Böden und Grundriss in den Wohnungen bringen
dort 0 Punkte statt bis zu +2 nach Anlage 2 (die App rechnet es richtig). Das heutige Zielbild in der App bleibt bis dahin unverändert.

### N81 · Telegram-Bot: Hilfe, Bewertung Stufe 1–3, PDFs — Rest: Abnahme und Prod (26.10.2026)

Gebaut und auf Staging gemessen in v2960–v2961 (`4b87c710`, `7bc8b184`, s. Fertig). Offen:

1. **Abnahme im eigenen Telegram-Chat** (nicht automatisch getestet, kein Versand): „wie funktioniert der Quick-Check?“ · „hol mir die Wertermittlung für …“ → Bestätigungssatz → „Ja“ → Bericht als PDF-Datei · „schick mir das Bank-PDF / die Kurzfassung / den Bankexport“.
2. **PDF-Dienst auf Prod** nur mit Freigabe: `.env` um `PDF_DIENST_SECRET`, Dienst über `pdf-dienst/docker-compose.pdf.yml` starten (oder Block in `docker-compose.prod.yml` übernehmen, Beschreibung im Journal v2960–v2961), Backend neu erzeugen. Abbild 1,38 GB, Spitze bis 710 MB je PDF. Ohne Dienst sagt der Bot ehrlich „noch nicht“.
3. Klein: `mod_punkte` beim MFH und der eigene Angebotsabschlag kommen im Bot nicht wie im Browser an (Browser-Zustand); Sammelabruf „für alle Objekte“ nur einzeln.

### N79 · Portfolio-Cockpit Runde 2 (25.10.2026) — Rest nach v2955a

Erledigt in v2952–v2955a (25.10.2026, s. Journal): Parkstr. 9 (Ankauf-Sanierung im Bestand kein Stau, Modernisierung eingetragen), zweiter und dritter Pilot-Lauf abgenommen (Prüfregel e), Bewertung je Objekt im Cockpit, alle 10 Bestandsobjekte mit Bericht Stufe 3, Kaufpreise der Demo angeglichen, Messe-Storybook neu, Zeitraum 10/20/30 zieht überall mit, Co-Pilot-Limits 10/20/50/100, Migration (3 h) raus. Optik (gekürzte Achse, Einfach als Standard) bleibt so. Rest:
- **Endgültig löschen (Marcel selbst):** Westerfeldstr. 140 Kopie `c5a78c89` (Kürzel E2E) und Am Markt 9 privat `cea958eb` stehen auf „Verloren“ — aus dem Bestand raus, aber noch da. Behalten: `ae155d38` (Spot/Videos) und `ec2d0f32` (VV-GmbH).
- **Spracheingabe:** seit v2956 je angefangene 2 Minuten eine Frage (Prod 25.10.) — Abnahme mit echter Aufnahme durch Marcel; Live-Vorschau (`transcribe-chunk`) und `voice-stream` zählen nicht.

### N78 · Pilot-Analyse durchgesehen (25.10.2026) — Rest nach v2946

Gemessen an Westerfeldstr. 140 (Staging, Analyse vom 13.10., Bericht vom 20.10.).
Erledigt in v2944–v2946: Wert & Zielbild beim Vermögenszuwachs mit Brücke,
Wert-Anker aus dem Marktbericht, Zielbild als Plan-Zeile, Hinweis auf neueren
Bericht, Offerte über Kaufpreis gesperrt, Steuerverlauf mit allen Verlustjahren,
Steuerverlauf und „Ankauf gegen Bestand" aus dem heutigen Stand.

Punkte 1–6 erledigt in v2947/v2947a (25.10.2026, `cb9043be`, `fde07f9b`, s. Fertig). Rest:
- **Entscheidung Marcel:** Steuerzeiträume 2025–2027 stehen auf Einzelveranlagung (`splitting: false`, keine KiSt). Gemessen: 2025 zvE 68.000 − 65.820 Vorobjekte = 2.180 € → Steuer 0 (unter Grundfreibetrag); 2026 zvE 41.195 € → +1.655 € auf +5.025 € (33 %, Grenzsatz Zone 3); 2027 zvE 103.506 € → +2.418 € auf +5.144 € (47 % = 42 % ESt + Soli-Milderungszone). Rechnerisch plausibel — stimmt die Veranlagungsart?
- **§ 7b „angehakt“ nicht nachstellbar:** alle fünf § 7b-Felder sind im Objekt UND im Ankauf-Stand `false`, die Analyse vom 13.10. erwähnt § 7b nicht. Wo es zu sehen war, bitte zeigen (Bild).
- Verlauf: Zeile „Abschlag auf Angebotspreise“ zeigt Δ „+0,0 %“ (0 → 15,9 %) — Prozent einer Null ist keine Aussage, kosmetisch.

### N77 · Kappungsgrenzen HE und BW — Wiedervorlage (20.10.2026)

Marcel 20.10.2026: „vor dem 25.11. prüfen, ob Hessen verlängert". Beide Nachfolge-Verordnungen sind am 20.10. nur **Entwurf in der Anhörung**, nichts verkündet. Belege stehen in `frontend/js/data/kappungsgrenzen.json` unter `unsicher_grund`.
- **HE (Mieterschutzverordnung, gilt bis 25.11.2026):** Der Entwurf mit 71 Gemeinden ist seit 24.09.2026 in der Anhörung, das Kabinett soll Mitte November entscheiden. **Ab Mitte November das GVBl. prüfen.** Ohne Verkündung bis zum 25.11. gilt ab dem 26.11. keine 15-%-Kappung. DealPilot rechnet dann von selbst mit 20 % und zeigt den Hinweis „ausgelaufen". Bei Verkündung die 71 Gemeinden mit AGS eintragen. Zur Wirksamkeit der Verlängerung läuft noch ein Streit (AG Frankfurt, 33029 C 130/25).
- **BW (KappVO und MietBegrenzVO, gelten bis 31.12.2026):** Der Ministerrat hat die Entwürfe am 22.09.2026 freigegeben. Neu sollen Mannheim, Konstanz und Kehl dazukommen. **Im Dezember das GBl. prüfen.**
- Seit v2545 meldet `deploy-staging.ps1` jede Verordnung, die in 120 Tagen ausläuft (`kappungsgrenzen-pruefen.mjs`).

### N76 · Messe-Rundgang und Abschlag — Reste nach Prod-Rollout (21) (14.10.2026)
> Prod = Staging auf v2238a (`1fc4be87`). Video `Dateien/Messe/Videos/quickcheck-rundgang-studio_2026-10-14.mp4` (220 s) ist fertig.
1. **Abnahme Marcel auf Prod:** Quick-Check mit DealPilot-Abruf und C-Lage — Karte mit „inkl. 5,8 % Abschlag“, Überschrift „· aber … unter Marktwert“, Pilot-Analyse mit zwei Sichten.
2. **Altes Drehbuch `quickcheck`** trägt noch die alte `KI_ANALYSE` (Score 76) ohne Marktwert-Sicht: neu aufzeichnen oder durch `quickcheck-rundgang` ersetzen.
3. **Alte `_mb_state`-Schnappschüsse** tragen keinen Abschlag; die Karte zeigt Angebotsniveau, bis neu abgerufen wird. Bewusst nicht nachgerechnet (Abruf kostet Kontingent).
4. **Regel seit 14.10.:** nach außen keine Quellennamen (auch nicht ImmobilienScout). Quelle, Stand und Link des Abschlags nur intern in `config.js angebotAbschlagMarkt`.

### N72 · Quick-Check: DealPilot-Marktwert erreicht den Score nicht — offen, Entscheidung Marcel
> Gefunden beim Messe-Drehbuch (v2222). `QcApp.registerDpmb` füllt `_avmResults` (Potenzial-Teilscore, Pro/Contra „Preis vs. Marktwert"). Der einzige Aufruf steht in `frontend/js/dealpilot-mb-qc.js:298` hinter dem `return` aus v832c und nutzt `global.QcApp`, das als `const` nicht am window hängt.
> Gemessen: Potenzial 30 bei Marktwert 199–351 T€ und Kaufpreis 139 T€. Eine Korrektur ändert Quick-Check-Scores, deshalb erst nach Freigabe.

### N71 · Marcel 14.10.2026 (achte Runde) — Rest: Abnahme (Erledigtes s. Fertig)

- **Offen:** Marcel nimmt Drehbuch 1 ab (`?messe=parkstrasse`), danach Drehbücher 2–10.

### N70 · Marcel 14.10.2026 (siebte Runde) — Rest: Abnahmen (Erledigtes s. Fertig)

1. **Offen:** Halten zum Sprechen auf echtem Handy abnehmen.
2. **Offen:** Marktbericht Parkstraße neu (482.000 € Marktwert gegen 780.000 € Kaufpreis) — Kontingent, Entscheidung Marcel offen.
3. **Offen:** Messe-Videos — Vorschlag liegt bei Marcel.

### N69 · Marcel 14.10.2026 (sechste Runde) — Rest (Erledigtes s. Fertig)

1. **Offen:** Pilot-Analyse Parkstraße neu abrufen (veraltet, DSCR 0,30) — kostet Kontingent, Entscheidung Marcel offen.
2. **Offen:** Gesamt-Atlas am Handy messen.

### N64 · Marcels Antworten vom 14.10.2026 — Rest: Entscheidungen zu noch offenen Punkten (Erledigtes s. Fertig)

- N62.8 Integrationsservice / Bestandsmigration: **„auf Anfrage“**, kein Festpreis — Bau offen.
- N62.24 Kontrast: dunkleres Grün und Rot für kleine Zahlen erlaubt — Umsetzung offen.
- N62.12 geführte Datenaufnahme: durchgehen, mit allen Stufen.
- Tour am Handy bleibt so; Quick-Check-Hausnummer keine Pflicht.
- Rumpfjahr-Rest: Auszahlung mitten in Jahr 2 läuft dort voll.
- N60.19 Demo-Objekte: Marcel fragt, was er entscheiden soll → Frage konkret stellen.

### N62 · Marcels Paket vom 12.10.2026 (abends) — zwölf Punkte, abgeglichen

**Marcel hat ausdrücklich darum gebeten:** *„Also das müsstest du einmal
mit Backlog abgleichen, ob der Punkt dann da schon drinne steht."*

**Gemessen am 12.10.2026 gegen die 23.117 Zeilen dieser Datei: SECHS von
zehn Punkten standen überhaupt nicht drin, vier nur teilweise.**

| # | Punkt | stand im Backlog |
|---|---|---|
| 1 | Tour in Aktenmappe, Tower, Kanzlei | **T1, offen** (Z. 9619) — Kanzlei und Tower *„nicht fertig gemessen"* |
| 2 | Kanzlei-Schalter: Position und Optik | **nein** |
| 3 | Pilot-Analyse: alle Daten einbeziehen | **N60.4 erledigt**, aber Liegenschaftszins und Wertgutachten fehlen; die inhaltliche Verbesserung der Kategorien steht nirgends |
| 4 | Lage & Markt: Netz + Zensus + Gegenüberstellung | **N61.4, offen** — Zensus, Preisniveau mit Quellen und die Gegenüberstellung fehlen |
| 5 | Eigener Reiter „Quellen" | **nein** |
| 6 | Steuerliche Zusammenfassung → Soll/Ist | **N60.18**, nur als Stichwort (*„Was aber vielleicht auch geil wäre, wäre Steuer"*) |
| 7 | Landingpage: Leistungsumfang unter Funktionen | **nein** |
| 8 | Preise: Integrationsservice + Bestandsmigration | **nein** (null Treffer für „Integrationsservice") |
| 9 | Subpage F&E / Portfolio-Strategie | **nein** — es gibt nur N14 (BSFZ-Siegel) und N21 (Stundennachweise) |
| 10 | Tab Steuern: Vorjahr duplizieren | **nein** |

> **Das ist die Antwort auf Marcels Frage, und sie ist unangenehm:** er
> hat diese Dinge im Gespräch gesagt, und sie sind nicht angekommen. Ein
> Punkt, der nur in einem Chat lebt, fehlt beim nächsten Mal — deshalb
> stehen sie hier jetzt wörtlich, bevor einer davon gebaut wird.

#### N62.4 · Lage & Markt: Netz UND Zensus UND die Objektfelder gegenüberstellen — Rest: Abnahme (Erledigtes s. Fertig)

- Ob das Modell die Zeilen der Gegenüberstellung sinnvoll füllt, zeigt nur ein echter Analyselauf.
- Weiter möglich (gemessen): Zensus-Nettokaltmiete je Kreis nach Baujahr (4000W-0005) und Fläche (4000W-0009), Durchschnittsmiete je Gemeinde (GEOGM4), marktaktive Leerstandsquote (4000W-0002). Zensus-Miete = Bestandsmiete zum 15.05.2022, keine Angebotsmiete.

#### N63 · Marcels Liste vom 13.10.2026 abends — Rest: Abnahme (Erledigtes s. Fertig)

- N63.8 Tour: Darstellung nur Schritt 1–2 bei 1280 geprüft (verdecktes Fenster drosselt) → Abnahme am Gerät.

#### N62.24 · Rest aus dem Responsive-Check (13.10.2026, v2198–v2198c)

Gemessen in der Messkabine (11 Breiten × 9 Reiter + 8 Ansichten). Überlauf, Herausragen und Unerreichbar stehen nach v2198c überall auf 0. Offen, weil Gestaltungsfragen und nicht Fehler:
1. **Kontrast:** 288 Stellen auf dem Handy, 433 auf Tablet/Desktop. Meist Grautöne knapp unter 4,5:1 (Steuertabelle, Bank-Cockpit, Hilfstexte), dazu Status-Grün/-Rot auf Creme. Grün/Rot sind laut Markenregel unantastbar — Marcel entscheidet, ob für kleine Zahlen eine dunklere Statusvariante erlaubt ist.
2. **Touch-Flächen unter 40 px:** vor allem die Kartenknöpfe der Objektliste (26 px) und die i-Knöpfe (18 px sichtbar, mit 44-px-Trefferfläche seit v1441 — die zählt die Messung nicht).
3. **Nicht geprüft:** Anmeldung und Registrierung (Abmelden nötig), öffentliche Startseite (andere Domain), Bildschirmtastatur und echte Touch-Geräte, andere Rollen als Pro, leeres Konto. → Abnahme durch Marcel am Gerät.

#### N62.22 · Neue Hilfe: Pilot auf F1/?, Prozess-Atlas — Rest (Erledigtes s. Fertig)

1. Sichtabnahme bei SICHTBAREM Fenster (Animationen laufen im Hintergrund-Tab nicht), Handy 390 px (Tower als Bodenblatt, Atlas einspaltig).
2. Quick-Check soll die eigenen Tabellen nutzen (Makro, Zensus, Register), wo direkter Zugriff besteht — Marcel 13.10.2026. Erst messen, was der QC-Abruf heute liest.

#### N62.21 · Marktbericht: Bewirtschaftungskosten im Ertragswert — Rest (Erledigtes s. Fertig)

- LZS-Zweig nach Gewerbeanteil steht nur als Hinweis (laut N65, Stand `v2210b`).

#### N62.20 · Offen aus Marcels Liste vom 13.10.2026 — Rest (Erledigtes s. Fertig)

1. **Tour messen bei SICHTBAREM Fenster:** Ablauf nach Erstanmeldung mit Standardobjekt, Quick-Boarding-Schritt „Als Objekt speichern“ (zielt auf `#save-btn` im iframe — springt der Spot hin?).
2. **Tour auf dem Handy:** `tour.css:348` schaltet die Hervorhebung unter 768 px ab — gewollt? Seitenleisten-Schritte zielen auf `.sb-act-accent`, am Handy heißt der Knopf `.bsheet-tile-accent`.
3. Bewirtschaftung: Fortschreibungsfaktor 2026, Abnahme Schritt 3 mit Testkonto.

#### N62.19 · Pakete A → B → C — Rest: Abnahme (Erledigtes s. Fertig)

- Die Schwellen der 5-Stufen-Abbildung in B (Lage aus eigenen Daten) sind von Marcel abzunehmen.

#### N62.18 · Eigene Datenhaltung, Warteschlange, Laufzeiten — Rest (Erledigtes s. Fertig)

3. **Bodenrichtwerte:** Treffer je Abfragepunkt mit Stichtag speichern, Wiederverwendung im Umkreis nur bei gleicher Zone; nach Stichtag erneuern.
4. **GeoMap:** nur Kurzzeit-Zwischenspeicher — dauerhaftes Ablegen erst nach Klärung der Lizenz mit GeoMap (Entscheidung Marcel offen).
5. **Warteschlange in der DB** für Marktbericht UND Pilot-Analyse (heute im Arbeitsspeicher, MAX 6, beim Neustart weg), mit Status für den Kunden.

#### N62.15 · Datenschutz: KI-Datenfluss gegen die Rechtstexte — Rest (Erledigtes s. Fertig)

Am 25.10.2026 per grep noch gefunden:
- `frontend/datenschutz.html:179` nennt weiter die „OpenAI Chat Completions API“ (es ist Responses/Realtime).
- `frontend/js/settings.js:2781/2788`: „OpenAI Ireland Ltd., KI-Lage-Analyse (auf Anfrage)“ und „Keine personenbezogenen Daten Dritter … werden übermittelt“ — stimmt nicht mehr.
- Die rechtliche Bewertung übernimmt Marcel selbst.

#### N62.13 · Offen aus dem 13.10.2026 (v2163–v2166) — Rest (Erledigtes s. Fertig)

1. **Modell der Pilot-Analyse** — gpt-4o-mini hält Längen nicht; Wechsel kostet (Entscheidung Marcel offen).
2. **Neuabruf aller Pilot-Analysen** — 4/33 auf Staging erledigt; Rest nach der Modellfrage.

#### N62.4b · Zensus in der Datenbank — Rest (Erledigtes s. Fertig)

- Tabellengröße 430 MB (Lizenz/URL je Zeile) — vor Prod den Platz dort messen, ggf. Lizenz je Tabelle auslagern. Prod braucht Migration, Import und Sicherung vorher.
- Einmal fehlten nach dem Seitenaufruf die Hinweise (Ladeversuch mit leerem Schlüssel), nicht nachstellbar. Optik bei 390 px nicht im Bild abgenommen.

#### N62.4a · Makro-Score: Ersatzwerte gelten als gemessen — Rest: Abnahme (Erledigtes s. Fertig)

- Bestehende Berichte tragen weiter den alten Score und die alte Makrolage (Bericht 176), bis sie neu berechnet werden. Ein frischer Berichtslauf ist Abnahmepunkt.

#### N62.6 · Steuerliche Zusammenfassung in der Pilot-Analyse — Rest: Abnahme (Erledigtes s. Fertig)

- Abnahme offen: ein echter Analyselauf.

#### N62.8 · Preise: Integrationsservice und Bestandsmigration

**Marcel:** *„dann wäre es cool, wenn wir unter Preise auch so einen
Integrationsservice anbieten. … Und auch den Integrationsservice, dass wir
sagen, wir migrieren auch Objektbestände. Das kann man bei uns anfragen,
wenn das gemacht werden soll."*

> **⚠ GELD. Wird nicht ohne Marcels Freigabe gebaut.** Ein
> Integrationsservice braucht einen Preis, und der ist seine Entscheidung
> — ebenso, ob es ein Festpreis, ein Tagessatz oder „auf Anfrage" ist.
> Vorher gehört geprüft, ob die beworbene Leistung Code hat (es gibt einen
> Portfolio-Import, `portfolioExport.js`/API) oder ob sie Handarbeit ist.

#### N62.10 · Tab Steuern: das Vorjahr duplizieren — Rest: Abnahme (Erledigtes s. Fertig)

- Abnahme: Liste der wiederkehrenden Posten mit Marcel durchgehen.

#### N62.11 · Eine Standard-Lageklasse, und sie muss sich diktieren lassen — Rest: Abnahme (Erledigtes s. Fertig)

- Onboarding-Schritt mit der neuen Auswahl nur per Code geprüft, nicht im Bild.

#### N62.12 · Die geführte Eingabe durchgehen — Plausibilität und Vollständigkeit

> **Marcel am 13.10.2026:** *„bitte beachten das wir microlage und makrolage
> auch über die geomap schnittselle bekommen."* Gemessen im Code: der
> `GeoMapConnector` liefert heute nur Angebote; die Mikrolage kommt aus dem
> Geoapify-Score (`MarketInsightsService.js:96`), die Makrolage aus dem
> Makro-Score (seit v2158 nur gemessene Kennzahlen). **Prüfen:** welche
> Lage-Endpunkte GeoMap anbietet und ob die geführte Eingabe (`abruf: 'lage'`)
> sie nutzen kann, statt den Nutzer zu fragen.


**Marcel:** *„dass wir das auch in der geführten Tour haben. Also die
nochmal durchgehen: Plausibilität, sind alle Daten drin, sind alle Stufen
drin, wird der Kunde da vernünftig durchgeführt. Das sollten wir auch
nochmal machen."*

Gemeint ist die **geführte Datenaufnahme** (`dp-diktat.js`,
`pilot-sprache.js`, `voice-import.js`), nicht die Onboarding-Tour aus
N62.1. Vier Fragen, und jede braucht eine eigene Messung:

1. **Plausibilität** — fängt die Strecke unsinnige Angaben ab, oder
   schreibt sie sie durch? (Vgl. `N60.x` und die Lehre aus
   `stille-verwerfung`: unbekannte Felder wurden bei `/bmf/aufteilung`
   kommentarlos übersprungen.)
2. **Sind alle Daten drin** — welche Felder des Reiters Objekt lassen sich
   diktieren, und welche nicht? Die Lageklasse ist schon als fehlend
   gemessen (N62.11).
3. **Sind alle Stufen drin** — die Erfassung hat Etappen; kommt der Nutzer
   durch alle, oder endet die Strecke vorzeitig?
4. **Wird der Kunde vernünftig durchgeführt** — Reihenfolge, Rückfragen,
   was passiert bei einer Lücke.

**Reihenfolge laut Marcel:** *„Aber das machst du im Anschluss an die
ganzen Punkte, die du jetzt gerade abarbeitest."* Also **nach** N62.3
bis N62.6 (Pilot-Analyse).

---

### N61 · Marcels Paket vom 12.10.2026 — sechs Punkte, wörtlich aufgenommen

**Marcel hat sie aufgegeben, weil er sie im Backlog vermisste:** *„was mir
irgendwie fehlt ist ein punkt wo ich gesagt habe …"* Genau dafür steht das
hier. Ein Punkt, der nur in einem Chat lebt, fehlt beim nächsten Mal.

#### N61.1 · Der Aussehen-Schritt: die App soll sich im Hintergrund mitändern — Rest: Abnahme (Erledigtes s. Fertig)

- Sichtabnahme mit einem frischen Testkonto (ohne Objekte ist der Hintergrund leer); unter 900 px füllt der Kasten den Schirm (`onboarding.js:1198`), dort gibt es kein „dahinter“.

#### N61.5 · Die Demo-Objekte

**Marcel:** *„dann die demo objekte"* — gemeint ist **N60.19** („Die Demodaten
erzählen keine Geschichte"), dort steht der Punkt mit Messung. Er hängt an
einer Entscheidung von Marcel und ist nicht blockiert, sondern **unbeantwortet**.

#### N61.6 · Das Unterlagen-Modul ergänzen — Rest (Erledigtes s. Fertig)

- Prod-Bot-Token gegen Staging prüfen.
- Kontingent für die Ämtersuche (Web wie Bot heute keins) — Entscheidung Marcel offen.
- Alte PLZ-Sätze verdecken gemeindeweite.

---

### N60 · Marcels Paket vom 08.10.2026 — zehn Punkte, wörtlich aufgenommen

**Marcel hat am 08.10.2026 ein ganzes Paket aufgegeben. Es steht hier
vollständig, weil ein Paket, das nur in einem Chat lebt, beim nächsten
Mal zur Hälfte fehlt.** Die Reihenfolge unten ist meine Einschätzung der
Abhängigkeit, nicht seine Priorität.

---

#### N60.1 · Lageklassen ermitteln und vergeben — Rest: Gegenlesen (Erledigtes s. Fertig)

- Marcel sollte die drei neutral vergebenen B\* gegenlesen: 2026-1082 (Herford, keine Lagedaten), 2026-1079 und 2026-1078 (Bad Oeynhausen, aus dem Ort bei Gleichstand).

#### N60.2 · Messkabine-Matrix — Rest (Erledigtes s. Fertig)

- **Entscheidung Marcel offen — Konsole:** (a) aus dem Umschalter nehmen (`THEMES` in `ui-varianten.js`, am 25.10.2026 noch drin, Z. 51) oder (b) fertigbauen mit eigener Textschicht (60–90 Regeln). Vorschlag: (a) jetzt, (b) später.
- Die feineren Achsen (6 Themes × 4 Cards × 2 Surfaces = 384 Punkte) als Nachtlauf; `kartenvariante` unter einem Theme als „fremdbestimmt“ kennzeichnen.

#### N60.4 · Pilot-Analyse: Datenzugriff — Rest (Erledigtes s. Fertig)

- Kein RAG → N60.7.
- Anzeige-Spiegel tot: `investment-profile.js:138-155` `syncAiParamsToTab()` schreibt in `#ai_strat`, `#ai_verk`, `#ai_risk`, `#ai_markt`, `#ai-param-*-display` — diese Ids gibt es in `index.html` nicht. Ändert nichts an der Analyse; abtragen, wenn das Panel ohnehin angefasst wird.

#### N60.5 · TEILERLEDIGT (`v2081`, `v2141`, `v2143`, `v2144`) — Rest: Abnahme am Bot, „kein Objekt gefunden“, Cashflow-Skala

Erledigtes s. Fertig („Bot-Kennzahlen und Barkauf im Score“). Offen:
- **Abnahme am echten Bot** mit Sachsenstraße 18 (KP 180.000, Kaltmiete 940): kommen 11.280 € / 6,27 % / 15,96 / 9,40 €/m² an? Braucht Telegram, Abnahmepunkt.
- **„kein Objekt gefunden“** unmittelbar nachdem der Bot das Objekt selbst angelegt hatte (IMG_1554, IMG_1558/1559) — unberührt.
- **Cashflow-Skala beim Barkauf** (−200 € → 0, 0 € → 50, +200 € → 100) misst beim Barkauf nichts. **Entscheidung Marcel offen:** ab welcher Rendite auf das eingesetzte Geld ist ein Barkauf gut? (geratene 4 % ausdrücklich zurückgenommen)
- Bilder: `Dateien/bot/IMG_1554.PNG` … `IMG_1559.PNG`.

#### N60.4d · Fotos ausgewertet (`v2013`) — Rest: „alle Daten“

Foto-Auswertung erledigt, s. Fertig. Offen für Marcels „alle Daten“:
- Die **sieben Blöcke auch für den Portfolio-Piloten** — er sieht je Objekt weiter nur 24 Zahlenfelder.
- Das **Investmentprofil** (24 Schlüssel) liegt nur im `localStorage` und erreicht keinen Prompt.
- **Pilot-Analyse ← Telegram:** der Bot kann sie lesen, aber nicht auslösen.

#### N60.6 · Auskunft: immer Score, KPIs und eine Gesamtbewertung — Rest: Abnahme am Bot

Regeln 7k/7l gebaut (`v2016`), s. Fertig. Offen: die Pflicht liegt nur im **Prompt**, kein Code verwirft eine Antwort ohne Score — **Abnahme am echten Bot** steht aus (vgl. N60.5: vier Verbote, alle gebrochen).

#### N60.7 · Datenraum je Objekt (OneDrive · Google Drive · Nextcloud)
Marcel: „für jedes Objekt einen Datenraum über gängige Cloudanbieter
anbinden können. Dort können Unterordner drin sein und die KI weiß
genau, wo was liegt, und kann dann auch im Co-Piloten darauf zugreifen
und Fragen zu Verträgen beantworten."

Nötig: OAuth je Anbieter, Ordnerbindung je Objekt, Indexierung
(Dateiname → Kategorie), Textauszug, und ein Abrufweg für den Co-Piloten.
**Hier entsteht die erste echte Dokumentenrecherche der App.**

#### N60.8-alt · Mietverträge, Minimum gebaut (`v2087`) — Rest: Marcels Fachliste

Minimum (Vertragsart, Beginn, letzte Erhöhung) erledigt, s. Fertig. Offen:
- **Entscheidung Marcel offen:** welche Felder der Fachliste (Staffel/Index mit nächstem Termin, Kaution, Befristung, Kündigungsverzicht, Gewerbe mit Laufzeit und Option) das Objektformular (ETW, EFH) braucht. Die MFH-Einheiten führen das meiste schon (`mv_kaution`, `mv_befristet_bis`, `mv_kuendigungsverzicht_bis`, `mv_naechste_anpassung`, `mv_erhoehung_art/_wert`, `mv_rhythmus_jahre`).
- **Kappungsgrenze und Erhöhungspotenzial:** am 10.10. null Treffer; inzwischen gibt es `frontend/js/data/kappungsgrenzen.json` (vgl. N77, N60.36). Ob das die Objektebene abdeckt, am 25.10.2026 nicht nachgemessen.

#### N60.9 · Wohnungen mit Detailfenster (`v2021`, `v2022`) — Rest: Augenprüfung

Gebaut, s. Fertig. Offen ist nur **Marcels Augenprüfung**, ob der MFH-Bereich zum umgebauten Reiter Objekt passt — kein Codemangel.

#### N60.10 · RND-Gutachten je Wohnung, MFH als Unterbaum — Rest

Vererbung und Kern-Eingabe erledigt (`v2095`, `v2095a`), s. Fertig. Offen:
- **Entscheidung Marcel offen:** RND je Einheit für den **Verkehrswert** (heutiger Stichtag, `zweck='verkehrswert'`) oder für die **AfA** (wirtschaftlicher Übergang) — oder beide getrennt? Beispiel Bj 1960, GND 80, 12 Punkte: 43,47 gegen 44,62 Jahre, 237 € AfA im Jahr. Bis dahin steht der Stichtag sichtbar da.
- **Unterbaum im Menü** („wenn das geteilt ist … als Unterbaum angezeigt“) — nicht gebaut; `window._dpMfh.aufgeteilt` trägt es schon.
- **RND-Gutachten je Einheit als Dokument** (PDF/Bericht mit Modellvermerk je Einheit).
- **Kernsanierung je Einheit** — erbt heute vom Gebäude; `istKernsaniert()` greift auf den MFH-Stufen `0/h/v` nie.

---

#### N60.19 · Die Demodaten erzählen keine Geschichte — und einige Zustände gibt es nicht
Marcel, 10.10.2026: *„Wir haben aktuell auch Häuser oder Wohnungen, die
im Bestand stehen, aber gar nicht auf Gewonnen gesetzt sind. Das sind
Zustände, die gehen nicht."*

**(1) Unmögliche Zustände aufräumen**
- Objekte **im Bestand ohne „gewonnen"** — den Widerspruch erst messen
  (wie viele?), dann entscheiden: aufräumen oder die Regel durchsetzen.
- **Nur zwei Objekte im Ankauf.** *„Das könnten wir besser auswiegen,
  dass das besser passt."*

**(2) Alle Felder füllen, damit die App zeigt, was sie kann**
- **Restnutzungsdauer** abfragen und setzen (seit `v2068` wird das
  Wizard-Ergebnis als `_rnd` festgehalten — die Objekte haben es noch
  nicht)
- **BMF-Rechner** bei Wohnungen *und* Häusern durchlaufen lassen
- **MFH-Konfigurator** anpassen
- **Marktberichte** bei den Objekten

**(3) Beispiele, die eine Geschichte erzählen** (hängt an N60.18)
- eine Wohnung **über Plan**, eine **unter Plan**
- eine mit **drei Jahren** Historie, eine mit **sechs**
- **ein Objekt, bei dem man steuerlich über den Verlauf sieht:**
  *„Oh, wir müssen irgendwo im Jahr 5 oder 6 investieren und da was
  machen."*

> **Warum das kein Kosmetikpunkt ist:** *„dass wir auch für die Messe
> dann gut vorbereitet sind."* Eine App, die auf dem Messestand leere
> Felder zeigt, beweist nichts — und ein Soll/Ist-Vergleich, bei dem
> alles passt, zeigt die Hälfte dessen, was er kann.

---

#### N60.33 · API-Export: Punkte 1–3 erledigt (`v2102`, `v2103`) — Rest: Rechtsform, Steuersätze

Erledigtes s. Fertig. Offen:
- **Punkt 4 Rechtsform — Entscheidung Marcel offen:** sollen die Mandanten (Steuernummer, Finanzamt, HR, USt-ID, Anschrift) aus `localStorage` (`dp_mandanten`) auf den Server? Technisch ein Schlüssel in `user_settings` (keine Migration); sobald der Server damit rechnet, eine eigene typisierte Tabelle. Hängt an N60.28 Schritt 0.
- **Punkt 5 „Steuersätze über die Jahre“ — Entscheidung Marcel offen:** Kosten je Jahr (Struktur steht), Sätze je Jahr (Umbau am Mandanten-Formular) oder beides?
- **8 von 21 Demo-Objekten** mit 0,00 % bzw. pauschal 5,50 % GrESt — gehört zu N60.19, DB-Eingriff mit Marcels Freigabe.
- **Staging-Abnahmepunkt:** der Export-Zweig für eine Mandanten-ID, sobald es einen Mandanten gibt.
- Punkt 6 (§ 23 EStG, Zeiträume eigener Nutzung) von Marcel zurückgestellt.

---

#### N60.35 · ⚠ Die Farbregler der Darstellung wirken ohne Vorlage NICHT (11.10.2026)

**Gefunden beim Nachmessen von `v2105`, und größer als der Kontrastpunkt,
aus dem es entstand.**

Ich hatte vermutet, der Regler „Objektkarten" greife in der Grundfassung
nicht. Nachgemessen mit **reinem Rot** — der lautesten möglichen Probe,
damit kein „sieht man kaum" als Erklärung durchgeht:

| Regler | Ziel | Token gesetzt | Fläche geändert |
|---|---|---|---|
| `_dpDispHeader` | `header.hdr` | `#FF0000` | **NEIN** (Verlauf bleibt) |
| `_dpDispSide` | `aside.sidebar` | `#FF0000` | **NEIN** (`rgb(5,5,5)` bleibt) |
| `_dpDispObj` | `.sb-card` | `#FF0000` | **NEIN** (Verlauf bleibt) |
| `_dpDispKpi` | `--dp-card` | `#FF0000` | **NEIN** (siehe unten) |
| `_dpDispHero` | `--dpuv-hero-card` | `#FF0000` | **NEIN — und zwar NIE** |

### Deckungslücke geschlossen, über die Kaskade statt über das DOM

Die zwei fehlenden Flächen gab es in der gemessenen Ansicht nicht
(`.sc-pill`, `.kpi-card`, `.hero-card`: **null** Treffer). Statt
Selektoren zu raten, habe ich gelesen, **wer die Tokens überhaupt
liest** — der verlässlichere Weg, und er deckt alle Fassungen auf
einmal:

| Regler | Token | gelesen von | ohne Vorlage? |
|---|---|---|---|
| Kopfleiste | `--dpuv-header-bg` | `html[data-ui-theme] body header.hdr` | **nein** |
| Objektleiste | `--dpuv-side-bg` | `html[data-ui-theme] body` → `--dp-s0/-s1` | **nein** |
| KPI-Karten | `--dpuv-kpi-card` | `html[data-ui-theme] body` → `--dp-card` | **nein** |
| Objektkarten | `--dpuv-obj-card` | `html[data-ui-theme] body … .sb-card` | **nein** |
| Hero | `--dpuv-hero-card` | **niemand, in keiner Datei** | **nein, nie** |

> **⚠ KORREKTUR meiner eigenen Zeile von vorhin.** Ich hatte geschrieben:
> *„`--dpuv-hero-card` hat NULL Leser … er ist überall ohne Wirkung."*
> Der erste Halbsatz stimmt, der zweite nicht.
>
> **Nachgemessen liest niemand `--dpuv-hero-card` — aber `--dp-hero-card`
> hat DREI Leser**, alle in `style.css` unter `body.dp-chrome-hell`
> (`:36197`, `:36224`, `:36227`, die Score-Karte im Kopf). Und
> `settings.js:3694` setzt genau diesen Namen.
>
> **Der Hero-Regler wirkt also — im hellen Skin, und nur dort.** Was
> fehlt, ist der Leser im `--dpuv-`-Namensraum: `v1104` hat das Token in
> `BEREICH_VARS`/`BEREICH_LS` aufgenommen und die Regel dazu nie
> geschrieben. Die vier Geschwister haben ihre.
>
> *Ich hatte aus „kein Treffer für EINEN Namen" geschlossen „wirkt
> nirgends". Das ist derselbe Fehler wie beim Grund: ein abgebrochener
> Suchlauf ist kein negativer Befund.*

**Damit sieht die Lage je Regler verschieden aus — und genau das ist der
Punkt:**

| Regler | wirkt mit Vorlage | wirkt im hellen Skin | wirkt im Auslieferungszustand |
|---|---|---|---|
| Kopfleiste | ja | nein | **nein** |
| Objektleiste | ja | nein | **nein** |
| KPI-Karten | ja | nein | **nein** |
| Objektkarten | ja | ja | **nein** |
| Hero | **nein** | ja | **nein** |

> **Die eine Spalte, die überall „nein" sagt, ist der
> Auslieferungszustand.** Das ist der gemeinsame Befund; alles andere
> ist je Regler anders und muss je Regler gemessen werden.

**Alle fünf hängen am selben `html[data-ui-theme]`** — und der Kommentar
bei `ui-varianten.css:230` nennt die Bedingung selbst:

> *„Der Bereichsregler „Objektleiste" setzt `--dp-side-bg` — der bekommt
> hier den Vortritt, sonst wäre er **unter jeder Vorlage** wirkungslos."*

`v1102` hat die Regler also **unter den Vorlagen** verdrahtet und dabei
richtig gedacht. Die Grundfassung stand nicht in der Fragestellung. *Ein
Satz, der „unter jeder Vorlage" sagt, beschreibt genau die Lücke, die er
hinterlässt — er nennt sie nur nicht.*

### Warum: die Tokens landen, und niemand liest sie

Der Regler setzt den Wert **inline am `body`** (`--dpuv-obj-card` und
`--dp-obj-card`, `ui-varianten.js` `bereicheUmhuellen()`). Gelesen wird er
an genau **zwei** Stellen, und beide haben eine Bedingung:

```css
html[data-ui-theme] body aside.sidebar .sb-card {   /* ui-varianten.css:488 */
  background-image: none !important;
  background-color: var(--dpuv-obj-card, var(--uv-card)) !important;
}
body.dp-chrome-hell aside.sidebar .sb-card {        /* style.css:36164 */
  background: var(--dp-obj-card, var(--dp-card,#F6F2E9)) !important;
}
```

**Ohne Vorlage und ohne hellen Skin greift keine von beiden** — und das
ist der Auslieferungszustand, also was ein neuer Nutzer sieht.

> Das ist das Gegenstück zu `gebaut-aber-unerreichbar`: dort wirkten 199
> Regeln und der Schalter setzte nichts. **Hier setzt der Schalter, und
> keine Regel liest.** Ein Farbwähler, der nichts färbt, ist schlimmer
> als ein fehlender: der Nutzer sucht den Fehler bei sich.

Dass es so gemeint war, steht im Blatt selbst (`ui-varianten.css:239`):
*„`--dp-obj-card` NICHT hier: der Regler setzt genau diesen Namen
inline"* — der `--dpuv-*`-Namensraum wurde in `v1104` **genau dafür**
gebaut. Die Grundfassung wurde dabei nie verdrahtet.

### ⚠ Nicht gebaut, weil es eine Optikentscheidung ist

Die Vorlagen lösen es so: **`background-image: none !important`** plus
`background-color`. Sie räumen den Verlauf also ab. Überträgt man das auf
die Grundfassung, fällt der dekorative Verlauf der Objektkarte
(`linear-gradient(135deg, rgba(20,15,5,0.6) …)`) und beim Kopf unter
Umständen der **Runway** — das ist eine Markenfläche, kein Detail.

**Zwei Wege, und sie sehen verschieden aus:**

| | Wie | Folge |
|---|---|---|
| (a) | wie die Vorlagen: Verlauf abräumen, Farbe setzen | die gewählte Farbe kommt rein, die Fläche wird flach |
| (b) | Farbe **unter** den halbtransparenten Verlauf legen | Verlauf bleibt, die Farbe wirkt getönt statt satt |

> *Welcher richtig ist, ist Marcels Entscheidung — Demo bauen und zeigen.*
> Ich habe in dieser Sitzung zweimal gegen eine Annahme gebaut und beides
> zurückgenommen; ein dritter Anlauf auf eine ungeklärte Optikfrage wäre
> derselbe Fehler zum dritten Mal.

**Die Liste ist vollständig** — fünf Regler, fünf Mal ohne Wirkung im
Auslieferungszustand, einer (`Hero`) überhaupt nie. Was fehlt, ist die
Entscheidung (a) oder (b), nicht die Messung.

> **Der kleinste echte Teilschritt wäre `--dpuv-hero-card`:** ein Token
> ohne jeden Leser ist entweder ein fehlender Leser oder ein Regler, der
> ins Panel gehört und nicht ins Produkt. Auch das ist eine Entscheidung,
> aber eine viel kleinere.

---

#### N60.36 · Mietrecht im Reiter Miete — Marcels Modul (11.10.2026)

**Marcel:** *„Ich habe dir unter Dateien einen neuen Ordner Mietrecht
reingepackt … dass wir das im Tab Miete vielleicht oben. Wir haben ja dort
Pilot Mietpreisanalyse. Da mal abgleichen, was die hergibt und dann mal
schauen, was jetzt das Mietrecht hier ausgibt … alles zum Thema Mieten,
Mietrecht angeben, also alles, was wir wissen, mit Quellen und so."*

### Was im Paket steckt (ausgepackt und gelesen, nicht vermutet)

```
mietrecht-ort 1.3.0 · 26 Dateien · 3,7 MB
```

| Datei | was sie kann |
|---|---|
| `mietrecht-ort.js` | `ortsrecht(ort, stichtag)` → Kappung, Bremse, Sperrfrist; `einheiten(mfh, opts)` je Einheit |
| `ortsrecht.json` | **alle 16 Länder**, 838 Gemeinden, Verordnungen mit Quelle, Link und Ablaufdatum |
| `gemeinden.json` | amtliches Gemeindeverzeichnis, **10.943 Gemeinden** (Destatis GV-ISys) |
| `normen/*.json` | **amtlicher Wortlaut** von 7 BGB- und 5 GEG-Normen, mit Hash und Abrufdatum |
| `mietspiegel/*.json` | Bielefeld 2026, Detmold 2025, Bad Oeynhausen 2026 — mit Quelle **und Seite** |
| `energie-pflichten.js` | GEG-Pflichten je Objekt, `umlage559e(kosten_we, foerderung_we, wfl)` |
| `MODUL.json` | Version, Stand, **SHA-256 je Datei** |

### ⚠ Der wichtigste Befund: es spricht unser Format schon

Die Eingabe ist **`objekt._mfh.einheiten[]`** mit genau den Feldern
`mv_art`, `mv_beginn`, `mv_letzte_erhoehung`, `mv_naechste_anpassung`.

> **Das sind dieselben Felder, nach denen Marcel in N60.33 Punkt 3
> gefragt hat** („Mietverträge, also Vertragsart, Beginn und letzte
> Erhöhung"). Dort hatte ich gemessen: je Einheit vorhanden, auf
> Objektebene gesammelt, aber **von keinem Objekt gefüllt**. Das Modul
> erklärt, wofür sie da sind — und es meldet fehlende Vertragsdaten
> ausdrücklich unter `vertrag.fehlt`, *„nicht still angenommen"*.

Dieselbe Doktrin wie bei uns, bis in den Wortlaut: Entwürfe tragen
`entwurf: true` und **rechnen nicht**; nicht gelistete Gemeinden sind
`bekannt: false` statt stillschweigend „keine Verordnung"; ein eigener
Abschnitt **„Grenzen (bewusst)"** nennt fünf Dinge, die es NICHT kann.

### Die Gestaltung, auf die Marcel zeigt, gibt es schon

Er meint das Feld aus Tab Objekt, Stufe 3. Gemessen ist das
**`.oe-quellen`** (`style.css:38867`): Zeilen `.oe-qz` im Raster
`150px | Wert | Aktion`, Links in `var(--wl-b8932f, #b8932f)` — und
`.oe-qz.fehlt { color: #B8625C }`. **Das ist sein „leicht rötliches":**
rot wird, *was fehlt*, nicht die ganze Fläche. Gebaut in
`objekt-reiter.js:404`.

> Das Muster passt eins zu eins: Beschriftung, Wert, Quelle als Link,
> rot wo nichts da ist. Es muss nicht erfunden werden, nur gefüllt.

### ⚠ Marcels Frage: gehört das Heizungsgesetz zu Miete oder Investition?

**Meine Einschätzung: die Trennlinie ist nicht das Gesetz, sondern was
die Pflicht BEWEGT.**

| | Reiter | warum |
|---|---|---|
| § 35 oberste Geschossdecke | **Investition** | einmalige Ausgabe, ändert keine Miete |
| § 43 Bio-Treppe bei neuer Gas-/Ölheizung | **Investition** | Betriebskosten und Anschaffung |
| § 60b Heizungsprüfung ab 6 Wohnungen | **Investition** | Pflicht am Gebäude, Frist 30.09.2027 |
| §§ 80/87 Energieausweis | **Investition** | Pflicht beim Verkauf/Vermietung, keine Mietwirkung |
| **§ 559e BGB Umlage nach Heizungstausch** | **MIETE** | steht im **BGB**, nicht im GEG — es ist eine Mieterhöhung |
| § 559 Abs. 3a Kappung 2 €/m² unter 7 €/m² | **MIETE** | deckelt genau diese Erhöhung |
| Fernablesung bis 31.12.2026 (HeizkostenV) | **Miete** | Betriebskostenabrechnung |

> **Der Prüfstein ist der Paragraf, nicht das Thema.** § 559e steht im
> BGB zwischen den Mieterhöhungsvorschriften, obwohl ihn ein
> Heizungstausch auslöst. Wer nach Thema sortiert („Heizung = Technik =
> Investition"), zerreißt § 559 und § 559e, die zusammengehören.

**Vorschlag:** die GEG-Pflichten als Liste in **Investition** (sie kosten
Geld), die Umlagewirkung in **Miete** (sie ändert die Miete) — und in
beiden Reitern ein Verweis auf den anderen, damit niemand die Hälfte
sieht. Das ist zu entscheiden, nicht zu messen.

### ✓ Der Abgleich ist gefahren (11.10.2026) — am ECHTEN Objekt

Marcel hatte ihn verlangt: *„da mal abgleichen, was die hergibt und dann
mal schauen, was jetzt das Mietrecht hier ausgibt."*

Gefahren mit dem **echten Modul** (`node test.js` vorweg: **38 ok, 0
Fehler**) gegen ein **echtes Objekt** aus dem Staging-Bestand —
`DEMO-BI3`, Bielefeld 33719, 8 Einheiten.

#### Was das Mietrecht-Modul liefert

| | |
|---|---|
| Kappungsgrenze § 558 Abs. 3 | **15 %** |
| Mietpreisbremse § 556d | **ja, bis 31.12.2029** |
| Kündigungssperre § 577a | **8 Jahre**, 01.03.2025–28.02.2030 |
| Quellen am Ergebnis | 2, u. a. MietSchVO NRW |
| Erhöhung § 558 im Jahr | **5.784 €** |
| Neuvermietung / Umlage § 559 | 0 / 0 |

Je Einheit, Beispiel Nr. 1: `ist 640` → `ziel 703`, `pot558_m 63`.

#### ⚠ Und zwei Befunde, die den Wert heute begrenzen

**1 · `ohne_vertragsart: 8` — alle acht Einheiten.** Das Modul meldet je
Einheit `vertrag.fehlt: ["Vertragsart","Mietbeginn","letzte Erhöhung"]`.

> Das sind **genau die Felder aus N60.33 Punkt 3**, die ich dort als
> „vorhanden, aber von keinem Objekt gefüllt" gemessen hatte. Das Modul
> erklärt endlich, **wofür** sie da sind: ohne sie gibt es keine Frist
> und keinen Termin, nur die Obergrenze. Die 5.784 € stehen also ohne
> den Zeitpunkt, zu dem man sie verlangen darf.

**2 · Der Mietspiegel greift nicht — wegen uns, nicht wegen ihm.**
`MietrechtOrt.mietspiegel('Bielefeld', {wfl, baujahr, lage})` kam leer
zurück. Ursache gemessen: **`baujahr` ist am Objekt `null`.**

> Bitter, weil Bielefeld der **einzige** Mietspiegel im Paket ist, der
> `belastbar: true` trägt. Das Objekt liegt in genau der Stadt, für die
> es eine gesicherte Matrix gäbe — und kann sie nicht nutzen, weil ein
> Pflichtfeld fehlt. *Kein Treffer heißt kein Wert; hier heißt es: kein
> Treffer wegen einer Lücke bei uns.*

#### Der eigentliche Abgleich: zwei Werkzeuge, zwei Fragen

| | Pilot-Mietpreisanalyse | mietrecht-ort |
|---|---|---|
| wo | `ki-miete.js` → `POST /api/v1/ai/ds2-suggest` | `einheiten()` lokal |
| Quelle | **KI-Schätzung** | Normen, Verordnungen, Mietspiegel |
| Ausgabe | `ds2_marktmiete`, `ds2_mietausfall`, je `{label, value}` | je Einheit Ziel, Potenzial, Fristen, Termine |
| Beleg am Wert | **keiner** | Quelle, Seite, Hash, Abrufdatum |
| beantwortet | **„Was zahlt der Markt?"** | **„Was ist erlaubt?"** |

> **Sie überschneiden sich nicht — sie widersprechen sich im Zweifel.**
> In einem Bremsengebiet kann die marktübliche Miete deutlich über dem
> liegen, was man verlangen DARF. Beide Zahlen nebeneinander sind der
> eigentliche Gewinn; eine davon wegzulassen macht die andere
> gefährlich.

**Damit ist Marcels Frage beantwortet:** nicht „welches ersetzt welches",
sondern *beide nebeneinander, und die Differenz ist die Aussage.*

### Was zuerst gemessen werden muss, bevor etwas gebaut wird

1. **Was gibt die Pilot-Mietpreisanalyse heute aus, und wo überschneidet
   sie sich mit `einheiten()`?** Marcel will den Abgleich; ohne ihn baut
   man zwei Anzeigen, die sich widersprechen können.
2. **Deckung der Mietspiegel:** drei Städte (Bielefeld, Detmold, Bad
   Oeynhausen), davon nur **Bielefeld** mit `belastbar: true`. Für alle
   anderen Orte gibt es keinen Mietspiegel im Paket — *kein Treffer heißt
   kein Wert*, und der Kunde bekommt den Weg zur Quelle.
3. **Lizenz der Mietspiegel-Tabellen — auf drei Zeilen eingedampft
   (11.10.2026 nachgesehen).** Jede Tabelle trägt `quelle: {url, seiten,
   abgerufen_am, lizenz}` — die Struktur für den Nachweis ist also da,
   es fehlt nur der Wert:

   | Mietspiegel | Art | Status laut Paket | Lizenz |
   |---|---|---|---|
   | Bielefeld 2026 | qualifiziert | gesichert (Textebene des PDF) | **nicht angegeben, § 5 UrhG zu prüfen** |
   | Detmold 2025 | qualifiziert | gesichert, Anwendungsbeispiel S. 15 bestanden | **nicht angegeben, § 5 UrhG zu prüfen** |
   | Bad Oeynhausen 2026 | einfach | **„zu prüfen … nicht für Berechnungen"** | nicht angegeben |

   > **Das ist dieselbe Frage wie beim Register** — und dort ist sie
   > beantwortet: genannt wird nur, was in *diesem* Bericht wirklich
   > steckt, und wo die Lizenz fehlt, lässt sich nicht entscheiden, ob
   > ein Vermerk nötig wäre. Vor der Anzeige im Kundenbericht zu klären,
   > nicht danach.

   **Bad Oeynhausen ist ohnehin gesperrt** — das Paket schreibt selbst
   „nicht für Berechnungen". Bleiben zwei Städte, beide mit demselben
   offenen Punkt. *Marcels Frage, nicht meine: er ist der
   DESAG-geprüfte Sachverständige und der Betreiber.*

   Das Paket sagt es selbst:
   *„Nutzungsbedingungen der Gemeinden nicht angegeben (§ 5 UrhG zu
   prüfen)."* Dieselbe Frage wie beim Register — **vor** der Anzeige im
   Kundenbericht zu klären, nicht danach.
4. **Wie kommt es ins Repo?** Das Paket sagt: *„wird daraus gebaut und
   nie von Hand geändert"* — Quelle der Wahrheit ist das
   Portfolio-Strategie-Modul. Also keine Kopie pflegen, sondern einen
   Einspielweg wie bei `tools/frontend-konstanten.mjs`.
5. **1,2 MB `gemeinden-daten.js` im Browser** ist kein Beiwerk. Entweder
   nachladen, wenn der Reiter geöffnet wird, oder serverseitig auflösen.

---

#### N60.38 · Welche Kartenstile das Aussehen „DealPilot“ verträgt — Rest: Auswahl einschränken

Standardkarte (`v2114`), Bordkarte (`v2115`) und Score-Kante (`v2116`) erledigt, s. Fertig. Offen:
- **Entscheidung Marcel offen (Geschmack, kein Defekt mehr):** Score-Kante und Bordkarte beim Aussehen „DealPilot“ nicht mehr anbieten? Dann braucht `objektkarten-stil.js` `data-ui-theme` als Eingabe, einen Neubau der heute einmal gebauten Liste (`data-gebaut`), einen zweiten Beobachter und einen neuen Fußtext („Wirkt in allen Ansichten“ wäre falsch); Regel je Paar Aussehen × Stil.
- **Ungemessen:** die Schienen-Fassung (`:7211`) trägt dieselbe Konstruktion wie die Bordkarte — auf einer Aktenmappen-Ansicht nachmessen.

---

#### N60.39 · Die Datenaufnahme-Karte über alle Geräte — Rest: Optikfrage 1440 px

Vier Befunde und der Stil „Zeile“ erledigt, s. Fertig. Offen: bei **1440 px** ist die Zeile **132 px** hoch (Vorgabe 78, bei 1920 px 80) — nichts abgeschnitten, die Leiste bricht eine Zeile mehr um. **Optikfrage am Entwurf, Entscheidung Marcel offen.**

---

#### N60.40 · Cockpit-Vollbild — Rest: Entscheidung Marcel

Stummel entfernt (`v2128`), s. Fertig. **Entscheidung Marcel offen:** soll das Cockpit ein Vollbild bekommen? (a) keins — `toggleSidebar()`, `dp-show` und `dp-dash-fullscreen` ausbauen (samt Regel `style.css:32836`); (b) Knopf 44 × 44 in der Cockpit-Kopfzeile; (c) nur per Tastatur. Für die Layouts hat Marcel den vergleichbaren Schalter entfernen lassen (`layout-varianten.css:1499`); ein echtes Vollbild müsste die 248-px-Schiene ausblenden.

---

#### N60.30 · Anbieter-Neutralität: die Regel steht in CLAUDE.md und wird nicht eingehalten

**CLAUDE.md:** *„Sprengnetter und PriceHubble nie namentlich nach außen —
„unabhängige Bewertungspartner". ImmoMetrica darf genannt werden."*

**Gefunden am 10.10.2026** vom Kerosin-Wächter, der die Regel jetzt
mitbewacht. Zwei Kundensätze in `quickcheck-app.html` sind in `v2097`
ersetzt. **Was bleibt, ist Marcels Entscheidung**, denn es sind drei
verschiedene Dinge:

| Art | Beispiel | meine Einschätzung |
|---|---|---|
| **Bezeichner** | `sprengnetter-client.js`, `avm-section.js`-Variablen, Prompt-Schlüssel in `openaiService.js` | **kein Verstoß** — darf so heißen |
| **Partner-Logos** | `landing/index.html:562` `alt="PriceHubble"`, `alt="Sprengnetter"` | **kein Verstoß** — eine Logo-Wand ist Marketing, keine Herkunftsangabe. Marcels Entscheidung |
| **Anzeige-Beschriftungen** | `quickcheck-app.html` Quellen-Chips (`name:'PriceHubble'`), `help.js:217/225` („Sprengnetter (aktiv)"), `tour-content.js:167`, `object-actions.js:1626` | **hier greift die Regel** |

> **Die dritte Gruppe hängt zusammen:** die Produkttour (`tour-content.js`)
> zeigt auf **Knöpfe**, und die `help.js`-Abschnitte erklären **genau**
> **diese Knöpfe**. Wer die Knöpfe umbenennt, muss Tour und Hilfe
> mitziehen — und umgekehrt ergibt es keinen Sinn, die Hilfe zu
> anonymisieren, während der Knopf den Namen trägt.
>
> **Ich habe nichts davon still umbenannt.** Welche Anbieter der Kunde
> namentlich sieht, ist eine Marken- und Vertragsfrage (manche Verträge
> verlangen die Nennung, andere verbieten sie). Gemessen ist der Umfang:
> **rund 60 Anzeige-Stellen**, der Rest Bezeichner.

**Zu entscheiden:** anonymisieren (Knöpfe, Chips, Hilfe, Tour zusammen)
oder die Regel in CLAUDE.md auf „nicht als Herkunft einer Zahl" schärfen.
Der Wächter läuft ab jetzt mit und hält den Stand fest.

#### N60.31 · `kerosin-confirm-lage.js` ist gebaut und nicht verdrahtet

**Gemessen am 10.10.2026:** die Datei wird von **keiner** HTML und
**keinem** JS geladen, ihre `kcl-`-Klassen kommen **nur in ihr selbst**
vor, und ihr Aufsatz auf `window.runKiLage` läuft nie.

Inhaltlich ist es ein **Bestätigungsfenster vor dem Verbrauch**: „Für die
KI-Lagebewertung wird Kontingent verbraucht: 1 Anfrage — Möchtest du
fortfahren?", mit einem Haken „Nicht mehr fragen".

> **Nicht gelöscht.** CLAUDE.md: `js/bmf-modal-v292.js` wurde einmal
> fälschlich als „Leiche" entfernt. Hier gilt dasselbe — und anders als
> dort ist der Inhalt offensichtlich nützlich: ein Kunde, der versehentlich
> Kontingent verbraucht, beschwert sich zu Recht.

**Zu entscheiden:** verdrahten (ein `<script>`-Eintrag plus Buster) oder
bewusst verwerfen. Ihre Texte sind in `v2097` schon richtiggestellt, falls
sie verdrahtet wird.

Marcel, 10.10.2026: *„ich sehe die ganze Zeit irgendwas mit Kerosin.
Das haben wir schon lange nicht mehr."*

**Der Nachfolgebegriff ist belegt, nicht geraten:** `config.js:238`
trägt die Überschrift *„v1176 · Kontingente statt Kerosin"*, die alten
Pakete darunter sind als *„STILLGELEGT v1183"* markiert. Es heißt
**Kontingent**, und die Einheit **„Liter" ist mit weggefallen.**

**GEMESSEN am 10.10.2026** (Kommentare abgezogen, Archiv und Entwürfe
ausgenommen): **77 Treffer im Nutztext, 24 Dateien.** Die teuersten
zuerst, weil der Kunde sie liest:

| Datei | Nutztext | was der Kunde sieht |
|---|---:|---|
| `backend/src/services/welcomeMail.js` | 9 | **die Willkommens-Mail** |
| `backend/templates/credit-pack-confirmation.html` | 4 | **die Kaufbestätigung** |
| `frontend/js/pricing-modal.js` | 12 | **das Preis-Fenster** |
| `backend/src/services/creditPacks.js` | 12 | Paketnamen im Backend |
| `frontend/js/config.js` | 4 | `kerosin_10/28/90/160`, `label: '10 Liter'` |
| `frontend/admin/js/admin-stats.js` | 3 | Admin-Auswertung |
| `frontend/js/kerosin-confirm-lage.js` | 3 | **die Datei heißt so** |
| `frontend/landing/assets/intro-kerosin.js` | 1 | **die Datei heißt so** |
| 16 weitere | je 1–3 | |

**Zwei Fallen bei der Abtragung:**

> **1 · Ein grep nach „Kerosin" findet nicht alles.** Die Einheit ist
> mitgefallen: **„Liter"**, `per_liter`, `gauge_*`, `Kurzstrecke`,
> `Interkontinental`. Das ist dieselbe Falle wie bei der Währung
> (`waehrung-steckt-in-der-einheit`) — **die Einheit steckt nicht im
> Begriff.** Also zusätzlich nach `liter`, `Strecke` und den
> Flugzeug-Zeichen suchen.
>
> **2 · Zwei Dateinamen tragen den Begriff.** Umbenennen heißt: jeden
> `script src`-Verweis und jeden Cache-Buster mitziehen. Billiger ist,
> die Datei zu lassen und nur den **Nutztext** darin zu ändern — der
> Dateiname steht in keiner Oberfläche.

> ### Nachgemessen: es waren 23, nicht 77 — und nur 6 erreichbar
>
> Der erste Zähler hat **Funktionsnamen und IDs mitgezählt**
> (`_kerosinStripHtml`, `_kerosinGauge`, `id="pm-kerosin-strip"`,
> `kerosin_10`). Präzise gemessen: **23 Stellen Anzeigetext in 11
> Dateien**, davon **6 erreichbar** — alle in `v2078` behoben:
> `neues-objekt-quellen.js`, `tour-content.js`, `credits.js` und
> **zweimal das Admin-Portal** (`admin-stats.js` zwei Kacheln,
> `admin/index.html` zwei Spaltentitel). Das Admin-Portal ist die
> wahrscheinliche Antwort auf Marcels *„die ganze Zeit"* — es sieht
> nur er.
>
> **Die restlichen 16 sind nachweislich unerreichbar**, nicht
> übersehen: `welcomeMail.js` (6) und `credit-pack-confirmation.html`
> (4) hängen am stillgelegten Kaufweg `creditPackWebhook.js`;
> `pricing-modal.js` filtert das Wort in Z. 169 sogar **aktiv heraus**
> und die Liter-Karten in `_kerosinCard` ruft niemand;
> `kerosin-confirm-lage.js` ist in keiner HTML eingebunden.
>
> **Ein Befund, der mehr wiegt als der Begriff:** jener Dialog
> kündigt *„Für die KI-Lagebewertung wird Kerosin verbraucht: 1 L"*
> an. Gemessen bucht `/ai/lage` **gar nichts** ab — `logExtract`
> mit dem Vermerk *„v1183: im Plan enthalten"*. Der Dialog hätte
> Nutzer von einer kostenlosen Funktion abgehalten. Er ist nicht
> eingebunden, also harmlos; `object-actions.js` hat dasselbe für
> sich in v1194 schon behoben.
>
> Nachmessen: `node tools/kerosin-reste-pruefen.mjs` — trennt
> Anzeigetext von Bezeichnern und nennt die Stellen je Datei.

**Was NICHT mitfallen darf:** die Luftfahrt-Bildsprache als Ganze.
Cockpit, Runway, Pre-Flight, QuickBoarding, Co-Pilot und Score-Dial
bleiben — abgeschafft ist nur **Kerosin als Name des Guthabens** und
die Liter-Rechnung darunter. `CLAUDE.md` führt „Kerosin (KI-Guthaben)"
noch als Markenbegriff und **gehört mit korrigiert**, sonst baut der
nächste Durchgang ihn wieder ein.

---

#### N60.32 · Der Quick-Check ignoriert das gewählte Design — und hat eigene Kontrastfehler

**Rest** (Messung und `v2100` s. Fertig):
- **Entscheidung Marcel offen:** soll der Quick-Check der gewählten Darstellung folgen (`ui-varianten.js`, `layout-varianten.js`, `karten-stil.js`, `objektkarten-stil.js` nachladen, dann ganze Matrix) oder bewusst eigene Fassung? Gemessen 25.10.2026: `quickcheck-app.html` lädt die Varianten weiter nicht.
- Quick-Check-Kontraste (eigenes Dokument, `style.css` nicht geladen): Gold auf Gold k 1,68, `button.btn.primary` 2,53, `span.hint` 3,06. 7-px-Text im Boarding-Pass `#qb-bp` bewusst nicht angefasst.
- Marktbericht: goldene Textfarben (`#E8CC7A` 1,42/1,53, `#C9A84C` 1,97) im `data-mb-theme=„light“`-Block nach dem Weg aus N60.29 (Weg a/c) mitziehen.
- **Entscheidung Marcel offen:** Warnfarbe `#e8b84f` (k 1,84 auf Weiß) — abdunkeln würde sie zu Oliv.

#### N60.25 · Drei tote Gutschrift-Pfade (Texte erledigt, s. Fertig)

- `routes/admin.js:1088-1094` und `aiCreditsService.addBonus()` schreiben `bonus_credits` — die Spalte ist seit v1183 stillgelegt, `consumeArt`/`getStatus` lesen sie nicht: eine Admin-Gutschrift erzeugt **kein nutzbares Guthaben**. Am 25.10.2026 steht der INSERT noch in `admin.js:1089`.
- `services/creditPackWebhook.js:78-85` bucht ebenfalls auf `bonus_credits`, erreichbar über `POST /credits/checkout` mit einer Nicht-Bewertungs-SKU — ein Kauf über eine Alt-SKU wäre bezahlt und ohne Wirkung.

---

#### N60.27 · BFH IX R 7/12 — fachliche Frage (Zitat entfernt, s. Fertig)

**Entscheidung Marcel offen:** Ist IX R 7/12 für Schadensabschläge auf die RND einschlägig? Wenn ja: mit geprüftem Leitsatz an der Stelle zitieren, die es trägt (Zulässigkeit, nicht Höhe). Wenn nein: die Abschläge bleiben Modellansatz und brauchen einen Modellvermerk, sobald sie in einem Gutachten erscheinen (§ 10 ImmoWertV).

---

#### N60.28 · Die Rechtsform der aufnehmenden Gesellschaft fehlt im Export (Server-Teil erledigt, s. Fertig)

- `portfolioExport.js` `halterFuer()` liefert für eine Mandanten-ID weiter `rechtsform: null` mit dem Vermerk „liegt im localStorage“ — der Vermerk ist seit `v2212a` überholt. Zu tun: Block `mandanten` neben `objekte` (Name, `rechtsform`, `rfLabel`, `isCorp`) aus `user_settings.mandanten`, `daten.halter` verweist darauf; keine zweite Fassung von `sphaere()`.
- Danach `lexikon.strukturen` und `docs/api-einrichtung.md` nachziehen.
- Betreiberform von DealPilot (Einzelunternehmen) nicht mit der Rechtsform eines Mandanten vermischen.

---

#### N60.18 · Der Soll/Ist-Abgleich muss bankfähig werden — und erklären
Marcel, 10.10.2026: *„Ich finde, du hast das auch schon gut gemacht bei
der Pilotanalyse mit dem Soll-Ist-Abgleich. Was aber vielleicht auch
geil wäre, wäre Steuer. … Das muss halt bankfähig sein."*

**Der Reiter gibt es seit `v2043` (N60.12). Er zeigt eine Tabelle. Was
fehlt, ist der Satz dazu** — und mehrere Kennzahlen, die ein Banker
zuerst sucht.

**(1) Was zusätzlich in den Vergleich gehört**

| Kennzahl | warum Marcel sie nennt |
|---|---|
| **Gesamtwerbungskosten / Verlust** | „die Gesamtwerbungskosten, die wir dort haben, also Verlust und allem" |
| **Cashflow VOR Steuer** | „den normalen Cashflow mit rein" — bisher steht dort nur der nach Steuer |
| **IRR** | „dass er was sagen kann zum IRR" |
| **Break-Even** | „ob das dann tatsächlich gepasst hat … solche Fehler sind dann schon entscheidend" |
| **Mietentwicklung** | „ob wir dort im Kurs sind, ob das passt, also ob wir unsere Ziele auch erreichen" |

> **Vor dem Bauen die Liste vervollständigen:** *„Geh da noch mal alles
> durch, was du hast, was noch in die Soll-Ist-Vergleich rein kann."*
> Also erst alle vorhandenen Kennzahlen auflisten und je eine
> Entscheidung treffen — nicht die fünf oben abarbeiten und aufhören.

**(2) Der Text ist der eigentliche Auftrag**

Nicht nur Zahlen gegenüberstellen, sondern **begründen** — in beide
Richtungen:

- **unter Plan:** was fehlt, und was wir tun müssten, um das Ziel noch
  zu erreichen
- **über Plan:** was wir besser gemacht haben, wo mehr herauszuholen war

*„damit wir sowas auch begründen können. Das muss halt bankfähig
sein."* Länge: ein paar Sätze, nicht immer sechs oder sieben — *„was
das beschreibt"*.

**(3) Testobjekte, ausdrücklich verlangt**

*„da kannst du auch mal ein paar Objekte anlegen oder bestehende
Objekte anpassen mit Mehrfamilienhäusern und wo du eine Mietentwicklung
machst … der Ankauf irgendwie drei Jahre vorher"*

- ein **MFH mit Mietentwicklung**, Ankauf-Stand rund **drei Jahre**
  zurück
- **eines, das nach Plan läuft** — der Text muss das auch sagen dürfen
- **eines, das NICHT nach Plan läuft**
- je ein Beispiel, wo der **Break-Even passt und wo nicht**

> **Warum Testobjekte zum Auftrag gehören und nicht zur Kür:** ein
> Abgleichstext, der nur an einem Objekt gesehen wurde, kennt nur
> dessen Fall. „Alles nach Plan" und „wir hängen hinterher" sind zwei
> verschiedene Texte, und der zweite ist der schwierigere.

**Was dafür schon steht:** `ankauf.js` (eingefrorener Stand, neun
Kennzahlen, `abweichung()`), der Reiter *Soll/Ist-Abgleich*, die
Abweichungstafel im Objekt (`v2034`) und die Mietentwicklung mit
Herkunft. **Die Kennzahlen liegen also vor — es fehlt die Auswertung
und ihre Sprache.**

---

#### N60.13 · Export je Objekt und PDF-Wege (Portfolio-Export und Excel erledigt, s. Fertig)

- **Entscheidung Marcel offen:** welche Spalten Investment-PDF und Bankexport tragen sollen.
- Die Exporte JE OBJEKT (PDF, Bankexport, xlsx/docx, `pdf-import`, `voice-import`) tragen die neuen Felder noch nicht (Liste „Was durch muss“ in der Git-Fassung vom 09.10.2026).
- Lücken: BMF-Detailrechnung bleibt im Modal (nur `geb_ant` kommt zurück); Wohnungen reisen nur zusammengefasst zum Piloten.
- Prüfstrecke je Objektart (kommt der Wert an?), Einstieg `tools/feld-waechter.mjs`.
- **Abnahme Marcel:** er bekommt die Dateien und sagt, ob er damit arbeiten kann.

---

#### N60.14 · VPI-Rechner für Indexmietverträge — Empfehlung liegt vor
Marcel: „bei den Index-Mietverträgen haben wir da irgendwie die
Möglichkeit, wenn wir Angaben gemacht haben zum Objekt, den VPI-Rechner
mit zu verknüpfen? Also macht das Sinn?"

**Ja, und es ist sogar die einzige Art, eine Indexmiete ehrlich zu
rechnen.** § 557b BGB knüpft an den Verbraucherpreisindex für
Deutschland (Destatis, Basis 2020 = 100). Die zulässige Erhöhung ist

```
neue Miete = alte Miete × (Index_heute / Index_bei_letzter_Anpassung)
```

Seit `v2025` steht an beiden Stellen dran, dass die hinterlegte Höhe eine
**Annahme** ist. Ein VPI-Bezug macht aus der Annahme eine Rechnung —
rückwirkend sogar eine exakte.

**Empfehlung: die Indexreihe in die Datenbank, nicht live abfragen.**
- Es sind zwölf Zahlen im Jahr, einmal jährlich nachzutragen — dieselbe
  Pflege wie beim Register.
- Eine Laufzeitabhängigkeit von einem fremden Dienst bricht genau dann,
  wenn jemand einen Bericht erzeugt. `FALLEN.md` führt dafür schon den
  Notnagel, der einen dauerhaft kaputten Abruf verdeckt.
- **Die Reihe trägt einen Stichtag je Monat.** Genau hier sind der
  Baupreisindex (`1.91` als Konstante) und die GND schon zweimal
  danebengegangen: eine Zahl ohne Stichtagsbezug rechnet für einen
  Stichtag in der Vergangenheit zwangsläufig falsch, und nichts
  widerspricht.

**Was es braucht:** eine Tabelle `vpi_monat (jahr, monat, index, basis,
quelle, abgerufen_am)`, ein Feld je Mietvertrag für den Monat der letzten
Anpassung (steht als `mv_letzte_erhoehung` schon da), und die Rechnung in
`mietentwicklung.js` statt des angenommenen Prozentsatzes. Die
Kennzeichnung aus `v2025` bleibt, wechselt aber den Text: aus „Annahme"
wird „VPI-gerechnet, Stand <Monat>".

**Vor dem Bauen zu klären (Bewertungsfrage, gehört Marcel):** viele
Verträge erlauben die Anpassung erst ab einer Mindestveränderung oder
nach frühestens zwölf Monaten (§ 557b Abs. 2). Ob DealPilot das aus dem
Vertrag mitführt oder pauschal jährlich rechnet, ist eine fachliche
Entscheidung, keine technische.

---

#### N60.15 · Die geführte Eingabe ist überladen — Rest (Erledigtes s. Fertig)

- Punkt 3: Tonfrage steht allein, aber als `.vi-rf-wozu`-Kasten **in** der Begrüßungsblase statt als eigene Frage.
- Punkt 5 (mehr Platz für Felder und Verlauf) nicht als erledigt ausgewiesen.
- Vorhandene Daten werden erkannt (✓), aber nicht angesagt: `vorTxt` bleibt leer, `_rfVorbefuellt` liefert ein leeres Objekt — Ursache nicht gemessen.
- Im Lauf folgen je Antwort weiter zwei bis drei Co-Blasen.
- Prüfstrecke: Marktpreisindikation, tiefere Stufe, Kombinatorik nicht durchgespielt; Kontraste, Touch, Bildschirmtastatur und Höhen über 757 px ungeprüft.

---

#### N60.17 · Responsive-Durchgang der ganzen App — Rest (Werkzeug und erste Durchgänge s. Fertig)

- Marktbericht mit echt abgerufenem Bericht und `#genProgress` nur als Gerüst geprüft.
- `GERAETE` in `messkabine.html` ohne 320 und 1920 px (Stand 12.10.2026).
- Touch-Gesten, Bildschirmtastatur, Tastaturnavigation, Querformat, 2560 px, Höhen über 757 px.
- Übrige Punkte des Master-Prompts: Anmeldung/Registrierung, Upload-Flächen, Lade-/Fehler-/Leerzustände, Diagramme, Kanban, Einstellungen, Dialoge.
- 25 Breakpoints: zusammengehörige Paare auf dieselbe Grenze legen, wenn eine Datei ohnehin angefasst wird.

#### N60.29 · Kontrast-Rest nach `v2101d` (Umsetzung s. Fertig)

- Beinahe-Treffer für eine weitere Abdunklungsrunde: 115× `rgb(113,108,102)` bei 3,78, 9× Gold 3,20, 9× Grün 3,01–3,08, 4× Rot 3,69–4,18, eine Stelle `div.v` bei 2,29.
- `.kc.tg .sc` / `.kc.tr .sc` (große Score-Zahl, `.kc-flat` bei 7,5 px) erst messen.

---

### N59 · Lageklassen der Bestandsobjekte (08.10.2026) — Rest: Marcel trägt ein

- Von 21 Objekten trägt keines eine Lageklasse (gemessen 08.10.2026). A/B/C ist nicht ableitbar und verschiebt den Zielkaufpreis — **Entscheidung Marcel offen**: die 20 echten Objekte in der Übersicht zuordnen. Erledigtes s. Fertig.

### N58 · Marktbericht — Rest aus Marcels Meldung (08.10.2026)

- Meldung „Objektdaten übernommen" samt goldener Feldliste besser gliedern (Marcel: „in Gold mit einem I dahinter, nicht so schön").
- `.mbrep-head`/`.mbrep-body` in `marktbericht-app/index.html`: Schmalregeln auf Klassen, die das Markup nicht führt (am 25.10.2026 noch 2 Treffer in index.html, 0 in app.js).
- Lageklassen der Bestandsobjekte: siehe N59.
Erledigtes s. Fertig.

### N56 · ImmoMetrica — Rest (08.10.2026)

- **Rangfolge für LEERE Objekte** (Marktbericht > Exposé > ImmoMetrica > Geführte Eingabe/Sprache): `applyImmometrica()` schreibt an `_merged` vorbei direkt in die Felder, heute gewinnt der Letzte. ImmoMetrica über `addRow()` mit Rang führen.
- Feldabgleich gegen `https://www.immometrica.com/searchapi/v1/`: welche Felder lesen wir nicht, welche gibt es nicht mehr (nicht belegt).
Erledigtes s. Fertig.

### N55 · ⚠ Eine korrigierte Quell-URL erzeugt eine ZWEITE Zeile (08.10.2026)

**Gemessen, nicht vermutet — und zwar an einem Schaden, den ich selbst erzeugt habe.**

In `v1983` habe ich bei den zwei Essener Sachwertfaktoren den `quelle_url` korrigiert:
der alte Portal-Link gibt **403**, die BORIS-PDF **200**, und nur sie trägt den
Lizenzblock. Nach dem Säen standen **vier** Zeilen in `mb.param_modell` statt zwei:

```
ezfh  lizenz=NULL            https://gmb.gutachterausschuss-essen.de/gmb_10900_2026/
ezfh  lizenz=dl-de/zero-2-0  https://www.boris.nrw.de/borisfachdaten/gmb/2026/GMB_…pdf
rmh   lizenz=NULL            https://gmb.gutachterausschuss-essen.de/gmb_10900_2026/
rmh   lizenz=dl-de/zero-2-0  https://www.boris.nrw.de/borisfachdaten/gmb/2026/GMB_…pdf
```

**Die Ursache steht im Upsert-Schlüssel.** Er lautet

```
land_code | ags | kennzahl | zweig | berichtsjahr | quelle_url
```

Die URL ist Teil des Schlüssels. Wer sie korrigiert, trifft also nicht mehr dieselbe
Zeile — die Saat **fügt eine neue hinzu und lässt die alte stehen**. Die alte Zeile
kommt in keiner Saatdatei mehr vor, wird von keiner Prüfung erwähnt und ist von außen
nicht zu sehen.

> **Warum das teuer ist:** welche der beiden Zeilen ein Bericht erwischt, ist Zufall.
> Erwischt er die alte, zitiert er eine Quelle, die 403 gibt, und **behauptet dabei
> keine Lizenz** — genau das, was die Doktrin verbietet. Der Fehler ist dabei lautlos:
> es fehlt nichts, es steht etwas Falsches zu viel da. Und er trifft jede
> Linkkorrektur, also genau die Pflege, die das Register braucht.

**Sofort erledigt (nur Staging):** die zwei Waisen gelöscht, nach eigener Sicherung
(`/root/backups/mb-vor-essen-waisen-20261008-1034.sql.gz`, 3,4 MB, 40.014 Zeilen,
nachgesehen). Ein `DELETE` auf den alten Link traf genau 2 Zeilen.
Danach: 3.570 Sätze, Essen je Zweig **eine** Zeile mit Lizenz, und ohne Lizenz nur noch
die **zwei BY-Sperren ohne Wert** — eine Sperre braucht keine Lizenz, weil sie keinen
Wert trägt. **Damit führt jeder Wert im Register eine Lizenzangabe.**

**Zu tun (die Ursache, nicht der Fall):**
1. `register-saat.mjs` braucht einen **Aufräum-Lauf**: Zeilen, die zu keiner Saatdatei
   mehr gehören, benennen und auf Verlangen löschen. Heute gibt es dafür nur
   `--trocken` und `--nur=XX`.
2. Oder — besser — **die URL aus dem Upsert-Schlüssel nehmen** und stattdessen die
   `fundstelle` oder eine eigene Satzkennung führen. Die Quelle ist eine *Eigenschaft*
   des Satzes, nicht seine *Identität*: derselbe Wert desselben Ausschusses für dasselbe
   Berichtsjahr bleibt derselbe Satz, auch wenn das Amt seine Seite umzieht.
3. Bis dahin: **wer eine `quelle_url` ändert, prüft danach auf Doppelzeilen.** Der
   Prüfer `saat-pruefen.mjs` findet Dubletten nur *innerhalb* einer Datei, nicht in der
   Datenbank.

> Für Punkt 2 gilt die Gegenprobe: eine Schlüsseländerung lässt **alle** 3.570 Zeilen
> neu entstehen. Das gehört in einem Zug mit einem Aufräum-Lauf gemacht, sonst
> verdoppelt sich das Register einmal komplett.

---

### N54 · Der Saatprüfer: 49 Restbefunde, einer davon echt (08.10.2026)

**Vorgeschichte.** `node tools/saat-pruefen.mjs` **ohne Dateiargument prüfte null
Sätze und gab RC=0** — eine Zeile Ausgabe, und ich habe sie als „der neue Satz ist in
Ordnung" gelesen. Dasselbe Muster wie beim `gold-audit`, der mit relativem Pfad 6 statt
181 Dateien las. Behoben in **v1981c**: ohne Argument der ganze Registerordner, und die
**Deckung ist Teil des Befundes** (56 Dateien, 4.832 Sätze). Null geprüft ist jetzt RC=1.

Danach fiel Schicht für Schicht auf, und zwar in dieser Reihenfolge — **weil die
Fehlerliste je Datei bei 40 gekappt ist und die obere Schicht die untere verdeckt:**

| gefunden | Art | behoben in |
|---|---|---|
| 1.019 Sätze mit `gaa_name: null` | **echt** — der Ausschuss stand im Nachbarfeld `quellenvermerk` | v1981d |
| 17 Sätze ohne Lizenzangabe | **echt** — nachgeerntet und selbst nachgemessen | v1983 |
| 129 Sätze „beleg ohne Seite/Fundstelle" | **Schein** — eine CSV-Ausleitung hat keine Seitenzahl | v1983a |
| 17 Sätze „ags nicht 5- oder 8-stellig" | **Schein** — der Landesschlüssel ist zweistellig (12 = BB) | v1983b |

> **Zweimal derselbe Fehler am selben Wächter.** `v1975` hatte schon einmal
> Scheinbefunde an genau dieser Belege-Zeile behoben (Belege als String statt als
> Objekt, sechs von acht Befunden waren keine), und die Lehre stand als Kommentar
> daneben: *„Ein Wächter, der auf RICHTIGE Daten rot wird, ist so schädlich wie einer,
> der auf falsche grün wird: man lernt, ihn zu ignorieren."* Genau das war eingetreten —
> ich habe nach `fehlt` gegrept, 0 Treffer gelesen und **„0 Befunde" gemeldet, während
> 129 Zeilen dastanden.** Mein Suchmuster kannte die Meldung nicht, die ich nicht
> erwartet hatte.

**Stand jetzt: RC=1 mit 49 Restbefunden, aufgeschlüsselt — und nur die erste Gruppe
ist ein Datenfehler:**

| Anzahl | Datei | Befund | Urteil |
|---|---|---|---|
| **24** | `swf-nw-2026-block2.json` | `fundstelle` ist **leer** | **echt.** Ein Beleg ohne jede Ortsangabe. Nachzutragen, wenn die Datei ohnehin angefasst wird — die Seite steht nur im Quell-PDF |
| 18 | `lzs-st-th-sh-ni-2025.json` | „Dokument ohne Zahlenangabe, siehe `warum_kein_wert`" | Schein. Das sind **Sperren** ohne Wert; eine Seitenangabe gibt es dort nicht zu holen |
| 5 | `ost.json` | „Sachwertfaktortabelle nebst zugehöriger Schätzfunktion" | Schein. Eine benannte Tabelle ist eine Fundstelle, auch ohne Ziffer |
| 2 | `ost.json` | „Abschnitt I … Ortstabelle" | Schein. Römische Zahl |

**Zu tun:**
1. Die **24 leeren Fundstellen** in `swf-nw-2026-block2.json` nachtragen (aus dem
   Quell-PDF je Ausschuss die Kapitelangabe).
2. Dann die Regel schärfen, damit der Wächter wieder RC=0 erreichen **kann**: Sperren
   (`vollstaendig: false`) von der Fundstellen-Pflicht ausnehmen — dort ist die
   Abwesenheit der Wert — und eine benannte Tabelle oder einen römisch nummerierten
   Abschnitt als Ortsangabe zulassen.
3. **Die Kappung bei 40 Befunden je Datei abschaffen oder beziffern.** Sie hat die
   `ags`-Schicht verborgen, bis die Lizenz-Schicht weg war. Mindestens muss dastehen,
   wie viele nicht gezeigt werden — das tut sie heute nur, wenn mehr als 40 kommen.

> **Der Grundsatz dahinter:** ein Wächter, der dauerhaft rot ist, wird nicht gelesen.
> Entweder sind die 24 nachgetragen oder die Regel ist richtig — ein RC=1, das man
> „kennt", ist derselbe stille Rückfall wie ein RC=0, das nichts geprüft hat.

---

### N52 · Grunderwerbsteuer nach Adresse (08.10.2026) — Rest

- Hinweis am Feld auch bei Übersteuerung („amtlich wäre 6,5 % (NRW), du rechnest mit 3,5 %") — nicht nachgemessen.
Erledigtes s. Fertig.

### N53 · Einstellungen und Formatierungen durchgehen (08.10.2026)

**Marcels Liste.** Die Felder liegen in `frontend/js/investment-profile.js`
(Abschnitt „Standardwerte", `settings.js:1172`: „Vorgaben, die in jede Kalkulation
einfliessen"). Gemessene Feld-Ids in Klammern.

| Punkt | Befund |
|---|---|
| **Grünes Icon bei „DealPilot Score"** | noch nicht lokalisiert — Marcel: „gibt es noch bei Deal Pilot Score oben ein Icon, das ist irgendwie noch grün" |
| **Mindest-Cashflow / Monat** (`ip_min_cashflow_vor_st`) | Hinweis sagt nur „vor Steuer" — wie der Wert in Score und Ampel eingeht, steht nirgends |
| **Farbliche Marker** | Marcel: „diese Werte erscheinen ab V3-60-77 als farbliche Marker. Ich glaube, das interessiert den Kunden nicht." Die Zeichenfolge `V3-60-77` ist im Code **nicht** gefunden — am Bildschirm nachsehen, was er gesehen hat |
| **A/B/C-Lagen** (v1956, `lageklasse`) | taucht in den Standardwerten **nicht** auf. Die Zielrenditen (A 3,5 / B 5,0 / C 7,0) liegen in `lage-profil.js`, getrennt von diesem Abschnitt — zwei Orte für dieselbe Sorte Vorgabe |
| **Marktzins gegen eigenen Zins** (`ip_zins_margin`) | der Hinweis sagt bereits „nur bei indikativem Zins (eigener Zinssatz übersteuert)". Marcels Wunsch: eine **Checkbox** „Indikative Marktzinsen übernehmen" statt eines Hinweises, den man lesen muss |
| **LTV-Schwelle** (`ip_max_ltv`) | Hinweis nur „Beleihungsauslauf" — keine Erklärung, was beim Überschreiten passiert |
| **Bewirtschaftung** (`ip_bwk_ul_pct_default`, `ip_bwk_anteil_default`) | umlagefähig „typisch 15–20 %", nicht umlagefähig „typisch 15–22 %" — beide als % der NKM |
| **Hausgeld-Annahme** (`ip_hausgeld_sel`, `ip_hausgeld_pct`) | Marcel: „Eigentlich setzt sich ja das Hausgeld aus den beiden Zahlen zusammen. Daher finde ich das komisch." Der Hinweis sagt schon „Fallback — nur wenn keine Wohnfläche vorliegt (sonst Wohnflächen-Schätzung)". **Zu prüfen: wird es bei gesetzter Wohnfläche doppelt gezählt?** |
| **Grenzsteuersatz** (`ip_grenzsteuersatz`) | Hinweis nur „für Steuer-Modul". Er hängt mit Mandanten → Privat → bearbeiten zusammen und kann sich dort ändern — welcher gewinnt, steht nirgends |

**Zu tun:** jeden Punkt am Bildschirm messen (Kontrast, Beschriftung, Hinweis), die
Doppelungen auflösen (Lage-Zielrenditen, Hausgeld), und je Feld einen Satz, der sagt
**wohin der Wert fließt** — nicht nur was er ist.

> **Die Checkbox ist der beste Teil des Auftrags:** „Indikative Marktzinsen übernehmen"
> macht aus einer Regel, die man im Hinweistext findet, eine Entscheidung, die man sieht.

---

### N49e · `rnd-styles.css`: 78 von 111 Klassen ohne Schreiber (08.10.2026)

**Der Befund ist größer als N49 (e) behauptete.** Dort stand „`.rnd-result*` (17×),
`.rnd-method*` (7×), `.rnd-afa*` (5×)". Gemessen über alle js- und html-Dateien unter
`frontend/` sind es:

```
1.494  Zeilen in frontend/css/rnd-styles.css
  111  rnd-Klassen insgesamt
   33  haben einen Schreiber
   78  haben KEINEN
  706  Zeilen fielen bei einem Probelauf weg (rund 47 Prozent der Datei)
```

**Die Regel ist fast ein Präfix, aber nur fast.** Alle 33 lebenden Klassen heißen
`rnd-wiz-*` — es ist die Oberfläche des Wizards. Die 78 toten gehören zur in **v1968**
gelöschten `rnd-ui.js` (`rnd-root`, `rnd-card`, `rnd-btn`, `rnd-mod-*`, `rnd-ampel*`,
`rnd-afa*`, `rnd-methods-table`, `rnd-gate*`, `rnd-vorteil*` …) und zum in **v1970**
entfernten Ergebnis-Bildschirm.

> **Ein Präfix-Lauf wäre falsch:** `rnd-wiz-result` lebt, aber
> `rnd-wiz-result-hero`, `-grid`, `-card`, `-card-label`, `-card-value`, `-card-unit`
> sind tot; `rnd-wiz-full` und `rnd-wiz-spreizung` ebenfalls. Es muss je KLASSENNAME
> gemessen werden, nicht je Präfix.

> **Und je Klassenname, nicht per grep auf das Präfix:** `deal-action.js` enthält
> `rnd-result-modal` — eine ELEMENT-ID. Ein grep nach „rnd-result" hält damit die
> ganze `.rnd-result-hero*`-Familie für lebend, obwohl keine einzige dieser Klassen
> geschrieben wird.

**Warum das nicht am 08.10.2026 mitgemacht wurde:** 706 Zeilen aus dem Stylesheet einer
**lebenden** Oberfläche zu schneiden ist kein Nebenbei-Schritt. Ein Probelauf lief, und
der eigene Prüfer meldete, dass die Entfernung unvollständig war (eine tote Klasse stand
danach noch als Regelkopf) — also war die Schnittlogik selbst nicht fertig. Abgebrochen,
nichts geschrieben.

**Zu tun, in dieser Reihenfolge:**
1. **Vorher** den Wizard in allen neun Schritten im Browser messen und festhalten:
   Geometrie je Schritt, Farben der Knöpfe, die Fortschrittsleiste. Ohne Vorher-Bild ist
   nachher nicht entscheidbar, ob etwas fehlt.
2. Je Klassenname messen, welche Datei sie schreibt (nicht je Präfix, nicht per grep auf
   die ID).
3. Nur Regeln entfernen, deren Selektoren **ausschließlich** tote Klassen nennen.
   `@media`-Blöcke nie als Ganzes.
4. Klammertiefe verfolgen, nicht Paare zählen — ein zitiertes `*/` im Kommentar zerlegt
   die Datei, und eine Bilanz findet das nie.
5. Nachher dieselbe Messung und gegenhalten.

> **Nebenbefund, mit v1974 erledigt:** `frontend/css/marktbewertung-card.css` war
> **nicht** die reine Dublette, die N49 (c) beschrieb. Sie trug einen eigenen Block
> `#dp-mb-host .dpmb-*` (v541, „Karte volle Breite im Objekt-Tab") und ein hartes
> Gold-Literal, wo die benutzte Fassung `var(--wl-e8c766, …)` führt. Der Block war
> gleichwohl unerreichbar: `#dp-mb-host` gibt es nur in der Hauptapp, die `dpmb-*`-
> Klassen schreibt nur `marktbericht-app/marktbewertung-card.js`, und dort gibt es
> kein `#dp-mb-host`. `dealpilot-mb-qc.js:226` sagt es selbst: „v832c: alte
> dp-mb-host-Tacho-Karte deaktiviert". Beide Dateien sind raus.

---

### N50 · Vergleichsfaktoren — Rest (08.10.2026)

- **Berlin ETW**: Entscheidungsbäume, Endknoten geerntet, Split-Schwellen nicht — mit Rasterizer (`pdftoppm`/Ghostscript) auflösbar.
- Korrekturen `gebaeudestellung`/`bauzustand` werden nicht geliefert (`korrekturen_offen`) — Zuordnung zu `haustyp`/`ds2_zustand` ist eine Entscheidung über amtliche Klassen (**Entscheidung Marcel offen**), Anzeige fehlt.
- Weitere Länder: Augsburg (50 €), Landesbericht Saarland (75 €).
- Drei Rücknahmen am Register: `quellen_links.js:716-723` (falscher Herausgeber SL), zwei Aussagen in `verfuegbarkeit-sl.json`.
Erledigtes s. Fertig.

### N48 · Angebotspreis als Vergleichswert (08.10.2026) — Rest

- Angebotsbasis anbieterneutral in den Quellennachweis („Angebotsdaten aus Immobilienportalen, Median €/m², N Angebote, Stand …") — am 25.10.2026 in `CrossCheckService.js` nicht gefunden.
Erledigtes s. Fertig.

### N49 · Altlasten RND — Rest (08.10.2026)

- **(b)** `marktbericht/frontend/` nur zusammen mit dem Dienst entfernen (`Dockerfile`, `server.js:15-33`, `score-ketten-pruefen.mjs`).
- **(d)** `calcVogels`, `calcRoss`, `calcParabel` in `rnd-calc.js` werden weiter in `calcAll` gerechnet (25.10.2026 noch vorhanden), Abnehmer sind seit v1970 weg.
- **(e)** toter CSS-Block → N49e.
Erledigtes s. Fertig.

### N46 · Punkt-Dezimalzahlen — Rest (07.10.2026)

- Die 25 Objekte tragen noch falsch gerechnete `_kpis_*`-Schnappschüsse aus früheren Läufen; ein Lauf über den Bestand wäre ehrlicher als aufs nächste Speichern zu warten.
- Prüfen, ob derselbe Umwandler anderswo steht (`backend/src/`, Bot-Pfad) — nicht belegt.
Erledigtes s. Fertig.

### N45 · Datenaufnahme — kosmetischer Rest (07.10.2026)

- Grüner Ring der Lampe: `border-color` greift nicht, `box-shadow` derselben Regel schon — unerklärt.
- `span.bp "BOARDING PASS"` mit `font-size:0` im DOM und `bordkarte`-Selektoren in `datenaufnahme.css` — gehört zu N49e.
Erledigtes s. Fertig.

### N44 · Stufe 3 (Wertermittlung ImmoWertV) am echten Objekt nachsehen (07.10.2026)

Marcel am 07.10.2026, wörtlich ins Backlog gegeben:

> „wir müssen nochmal bei mehreren Objekten die Stufe 3 Wertermittlung auslösen und schauen was
> passiert im Tab Objekt. Wird das PDF dann erzeugt? Wo steht der Verkehrswert? Geben wir vorher
> an, welche Stufe wir genau bei der Stufe 3 erreichen können? Also haben wir alle Werte für eine
> vollständige ImmoWertV-Verkehrswertberechnung oder fehlt uns etwas? Das könnten wir mit der
> Datenbank abgleichen. Das ist wichtig, dass wir schauen, was dort passiert. Irgendwie muss der
> Kunde das ja sehen."

**Der Kern ist nicht „funktioniert es", sondern „WAS BEKOMMT DER KUNDE ZU SEHEN".** Er hat nach
einer Analyse zwei Zahlen aus zwei Verfahren:

> „er hat bei der Analyse ja einen vollständigen Marktbericht mit Marktpreisindikation UND den
> Verkehrswert, und **die Wahrheit wird wohl dazwischen liegen**."

Das ist die eigentliche Aufgabe: die beiden Zahlen nebeneinanderstellen und die Spanne erklären,
statt eine davon zu behaupten.

**Zu messen, Objekt für Objekt (mehrere, nicht eines):**

1. **Stufe 3 auslösen** und beobachten, was im Reiter Objekt geschieht. Kein Rückschluss aus dem
   Code — der Lauf am echten Objekt.
2. **Wird das PDF erzeugt?** Wo landet es, ist es erreichbar, trägt es den Rechenweg?
3. **Wo steht der Verkehrswert** nach dem Lauf? In welchem Feld, an welcher Stelle sichtbar?
4. **Vollständigkeit VORHER ansagen.** Bevor Stufe 3 läuft, muss dastehen, welche Tiefe damit
   überhaupt erreichbar ist: liegen alle Pflichtangaben für eine vollständige
   ImmoWertV-Verkehrswertermittlung vor, oder fehlt etwas? **Gegen die Datenbank abgleichen**
   (Registerdatensatz: Liegenschaftszinssatz, Sachwertfaktor, GND, Baupreisindex, BWK-Modell).
5. **Begründung in die Pilot-Analyse** übernehmen.
6. **Marktbericht immer ins Objektwissen.**

> **Warum Punkt 4 der wichtigste ist:** CLAUDE.md sagt „Kein Verfahren rechnet halb" und „Wo die
> Quelle endet, endet die Rechnung". Eine Stufe 3, die startet und erst hinterher merkt, dass ihr
> die Hälfte fehlt, verkauft dem Kunden eine Tiefe, die es nicht gibt — und Stufe 3 kostet. Die
> Ansage gehört VOR den Abruf, nicht in die Fehlermeldung danach.

#### N44-BEFUND · Am 07.10.2026 gegen die Datenbank gemessen

Marcel: „das könnten wir mit der Datenbank abgleichen." Gemacht — `dealpilot-mb-db`,
`mb.market_reports`, **156 Berichte**, nur gelesen.

**Die Frage „haben wir alle Werte für eine vollständige ImmoWertV-Verkehrswertermittlung"
ist damit beantwortet: nein, und zwar in der großen Mehrheit nicht.**

```
156  Berichte insgesamt
115  tragen einen cross_check mit Ertrags- und Sachwert-Zweig

 95  Ertragswertverfahren laeuft                      61 %
 46  Sachwertverfahren laeuft                         29 %
  3  davon MARKTANGEPASST (mit Sachwertfaktor)         2 %   <-- der Kern
 32  nur vorlaeufiger Sachwert, ohne Marktanpassung
  5  Bodenwert fehlt ganz
  0  amtlicher Vergleichsfaktor nach § 20 ImmoWertV    0 %

  0  Schluessel "verkehrswert" - den gibt es im cross_check NICHT
```

> **In 3 von 156 Berichten ist der Sachwert marktangepasst.** Alles andere ist eine
> Herstellungskostenrechnung — die Berichte sagen das selbst: „Ausgewiesen ist der vorläufige
> Sachwert ohne Marktanpassung — das ist eine Herstellungskostenrechnung, kein Marktwert."

**Und jeder einzelne der 115 trägt diesen Satz:**

> „Vereinfachtes Sachwert-/Ertragswertverfahren nach ImmoWertV-Logik als
> Plausibilitäts-Quercheck. **Indikativ, kein Gutachten n. § 194 BauGB.**"

**Die häufigsten Lücken, gezählt über die `notes`:**

| Berichte | Lücke |
|---:|---|
| 115 | „indikativ, kein Gutachten" — ausnahmslos |
| 95 | Gesamtnutzungsdauer aus einer **nicht gegen Anlage 1 ImmoWertV verifizierten** Tabelle |
| 65 | „Sachwert nicht ausgewiesen" — das Verfahren rechnet gar nicht |
| 46 | kein Immobilienrichtwert beschlossen (Vergleichswert stützt sich auf **Angebotspreise**) |
| 34 | kein Sachwertfaktor verfügbar |
| 25 | Grundstück erheblich größer als das Richtwertgrundstück, § 41 **nicht angewandt** |
| 24 | BWK-Ansätze nicht gegen Anlage 3 verifiziert |
| 17 | Restnutzungsdauer nach Anlage 2 — mittlerer Modernisierungsgrad |
| 7 | Sachwertfaktor 1,0 angesetzt → **keine** Marktanpassung |

**Das PDF entsteht im Browser**, nicht auf dem Server: `frontend/marktbericht-app/app.js` mit
jsPDF. Es wird **nicht gespeichert** — wer es später wieder braucht, muss den Bericht erneut
öffnen.

**Wo der Verkehrswert steht: nirgends.** Es gibt keinen Schlüssel `verkehrswert`. Vorhanden
sind `sachwert.value_eur`, der Ertragswert-Zweig und die Marktpreisindikation
(`market_value.estimated` mit Spanne) — **drei Zahlen, aus denen niemand automatisch einen
Verkehrswert macht.** Genau das ist Marcels Punkt: „er hat die Marktpreisindikation UND den
Verkehrswert, und die Wahrheit wird wohl dazwischen liegen."

**Was daraus folgt — die Arbeit, nicht mehr die Messung:**

1. **Die Vollständigkeits-Ansage VOR den Abruf.** Alle Angaben dafür liegen schon vor: ob ein
   Sachwertfaktor im Register steht, ob ein Immobilienrichtwert beschlossen ist, ob eine GND
   als Zahl hinterlegt ist. Heute erfährt der Kunde es erst **danach**, aus den `notes` — und
   Stufe 3 kostet.
2. **Die Spanne zeigen statt einer Zahl.** Marktpreisindikation und Sachwert nebeneinander, mit
   dem Abstand dazwischen und der Begründung, warum er so groß ist.
3. **Die Begründung in die Pilot-Analyse**, der Marktbericht ins Objektwissen.

> **Noch nicht gemessen, weil es Geld kostet:** ein echter Stufe-3-Abruf an mehreren Objekten
> und was dabei im Reiter Objekt passiert. Das braucht Marcels Freigabe — die Daten oben
> stammen aus bereits bezahlten Läufen.

---

**Bekannter Anknüpfungspunkt:** der Sammelweg `marktbericht_preis_alle` prüft bereits PLZ/Ort,
Objektart und Wohnfläche je Objekt und meldet `fehlende_angaben` — der Weg für ein EINZELNES
Objekt tut das nicht (gemessen am 07.10.2026). Dieselbe Prüfung existiert also schon, nur auf dem
selteneren Pfad.

---

## → NEU und OBERSTE PRIORITÄT: Der Reiter Objekt wird neu geordnet (04.10.2026)

Marcel am 04.10.2026, abends. Sieben Punkte, von ihm selbst ins Backlog
gegeben: *„Kannst du ins backlog schreiben und dann abarbeiten wenn du die
anderen sachen ausgiebig gemacht hast."*

Der Kern ist **N4** — alles andere hängt davon ab oder ist klein.

---

### N3 (04.10.) · Gemarkung aus BORIS mitfüllen — Rest

- Die BORIS-Antwort trägt Gemarkungsnummer und -name (siehe `boris-liefert-die-gemarkung`); das Feld beim Bodenrichtwert-Abruf mitfüllen — nicht belegt. Erledigtes s. Fertig.

### N4 (04.10.) · Reiter Objekt — Rest

- **N4-P5** — GeoMap-Filter (Zimmer, Grundstück, Heizung): erst messen, ob die Vergleichsmenge nicht zu klein wird.
Erledigtes s. Fertig.

### N6b · Der zweite Geldweg im Browser-Co-Piloten — offen

- Die Zustimmung im Browser ist rein clientseitig (`copilot-aenderungen.js`); der geprüfte Geldweg des Telegram-Agenten (`darfKosten` + Angebot, v1821) gilt dort nicht. Browser-Chat über dieselben Werkzeuge mit Stufe `kostet` führen. Erledigtes (N6) s. Fertig.

### N7 · Pilot-Analyse — Rest

- Sechs Objekte des Testkontos trugen byte-identisch dieselbe Analyse (Gohliser Str. Leipzig sprach von Bielefeld). Wie die Kopien entstanden, ist offen: `storage.js` beim Duplizieren und bei Adressänderung auf `ai_analysis` prüfen. Erledigtes s. Fertig.

### N43 · Diagramme auslesen — Marcels Entscheidung steht aus (06.10.2026)

Marcel: „zur ernte. koennen wir die diagramme auslesen und daraus ernten?"

**Die Antwort ist teils ja, teils nein — und die Trennung läuft nicht zwischen den Dokumenten,
sondern zwischen den Kennzahlen.** Gemessen mit `pdfimages -list` je Seite:

```
Bodensee  Zinssatz 7.1-7.4  (Balken)     0 Bildobjekte   VEKTOR, Labels als Text
Bodensee  Zinssatz 7.5-7.7  (Streuung)   0 Bildobjekte   Vektor, aber OHNE Labels
Bodensee  Sachwertfaktor 8.1-8.5         4-6 je Seite    RASTER, 3637 x 3002 px
Blumberg  alle Diagramme                 1596 x 1006     RASTER, 0 Textzahlen
```

**Der entscheidende Punkt, und er korrigiert meine eigene Fragestellung:** die Datenlabels sind
**exakter Text im PDF**, keine gezeichneten Balkenhöhen. Die Zahl wird also **gelesen, nicht
geschätzt**. Die Geometrie leistet nur die Zuordnung — welche Zahl zu welcher Wohnungsklasse und
zu welcher Reihe (Maximum / gewogenes Mittel / Minimum) gehört. Beides steht ebenfalls als Text da.

> Ich hatte als Prüfkriterium „die Rückrechnung muss die Nachkommastelle treffen" vorgegeben.
> **Das wäre der falsche Test gewesen** und hätte die Methode zu Unrecht verworfen: Excel setzt
> das Label mit festem Abstand ÜBER den Balken, die Rückrechnung weicht deshalb immer ab (3,81
> gedruckt gegen 4,14 gerechnet = 10 pt Versatz). Das richtige Kriterium ist, **ob der Versatz
> über das Diagramm konstant ist** — gemessen ±0,04 Einheiten.

**Die Rückrechnung bleibt trotzdem wertvoll, als Wächter.** Sie hat einen Fehler des Auslesers
gefangen: zwei Diagramme in einer Achsenspalte ergaben Abweichungen von ±2,5 statt ±0,27. Eine
falsche Zuordnung wird rot, eine richtige grün.

**Sicherheitsabstand, über alle 90 Labels:** engster Abstand zweier Labels in einer Kategorie
27,1 pt, größter Labelversatz 11,7 pt → **Faktor 2,3**. Kategorien liegen 73,2 pt auseinander,
also nie verwechselbar. Achsen-Linearität über alle Ticks: Abweichung 0,002 Einheiten.

**Deckung: 22 Diagrammflächen gemessen, 8 lesbar** (Bodensee Zinssatz, Seiten 33–36).

**Was der Ertrag wäre:** 90 Einzelwerte = **30 gewogene Mittel**, jedes mit Spanne, für
Friedrichshafen · Immenstaad/Kressbronn/Langenargen · Eriskirch/Meckenbeuren/Neukirch/Tettnang ·
Neubau Gesamtgebiet. Modellvermerke stehen vollständig als Text: Bewirtschaftung pauschal 18 %,
Miete nach Mietpreisspiegel, Verkaufsjahr 2024, Wohnfläche nach WoFlV.

> **Und genau hier greift die Oberursel-Lehre zwingend:** derselbe Teilmarkt ist in ZWEI
> GND-Varianten veröffentlicht (70 und 80), und sie unterscheiden sich um bis zu 0,5
> Prozentpunkte — Klasse „2-4 WE": 1,76 bei GND 70 gegen 2,29 bei GND 80. Ohne `gnd_jahre` als
> ZAHL im Satz wäre nicht entscheidbar, welcher Wert gilt.

**MARCELS ENTSCHEIDUNG, drei Punkte:**

1. **Rang der Angabe.** Der Zahlenwert ist die gedruckte Angabe des Ausschusses. Die ZUORDNUNG zu
   Klasse und Reihe ist eine Schlussfolgerung aus dem Layout, abgesichert mit Faktor 2,3 und einem
   Wächter. Hat das den Rang einer amtlichen Angabe?
2. **Was geerntet würde, ist eine Verteilung**, kein Einzelwert. Gewogenes Mittel als Ansatz, die
   Spanne als Modellvermerk — oder gar nicht?
3. **Die 7.5–7.7-Gleichungen bleiben draußen**, R² 0,019 bis 0,183. Dort gibt es auch keine
   Labels, also keinen zweiten Weg.

**Unabhängig davon bleibt ein zweiter Blocker:** die acht Gemeinden des Ausschusses stehen nicht
mit Gemeindeschlüssel im Register, und die Kreisebene wäre falsch, weil Überlingen zu einem
ANDEREN Ausschuss gehört. Die Schlüssel kommen aus einer belastbaren Quelle oder gar nicht.

### N42 · Quick-Check: Bewertungsbox im Browser abnehmen (06.10.2026)

Der Telegram-Weg ist fertig und gegengemessen: `objekt_schnellblick` liefert Deal-Score, Stufe,
Empfehlung, Einschätzung und die fünf Teilnoten; Score und Kennzahlen stimmen über fünf Objekte
auf die Nachkommastelle mit den Werten überein, die der Browser geschrieben hat.

**Was NICHT nachgewiesen ist: der Klick-Durchlauf im Quick-Check der App.** Belegt ist:

```
qc-heuristik.js geladen          ja, VOR quick-check.js (richtige Reihenfolge)
window.QcHeuristik               object · einschaetzung, empfehlung, zielKaufpreis,
                                 bewerten, SCHWELLE
Probe empfehlung(score 77 …)     KAUFEN · Begruendung · ziel_kp 180.000
                                 — wortgleich zur Bot-Ausgabe
Identitaetspruefung (Agent)      2520 Faelle, null Abweichungen
```

**Nicht belegt:** dass die Box nach einem echten Rechenlauf im Browser auch erscheint. Drei
Anläufe mit von Hand gefüllten Feldern haben sie nicht erzeugt — ich kenne die Pflichtfelder des
Quick-Checks nicht und habe aufgehört zu raten.

> **Ein Werkzeug, dessen Eingaben ich nicht kenne, bediene ich nicht blind.** Drei Versuche mit
> geratenen Feldern beweisen nichts — weder dass es geht, noch dass es nicht geht.

**Dabei gemessen, als eigener Punkt:** der Quick-Check der App läuft in einem eigenen Rahmen
(`quickcheck-app.html`), und dort ist `qc-heuristik.js` NICHT geladen — der Rahmen lädt nur
`dscr-engine`, `deal-kpis`, `score-tiers` und `dealscore`. Die Bewertungsbox gehört zu
`quick-check.js` im Hauptdokument. **Ob beide Wege dieselbe Bewertung zeigen, ist offen.** Siehe
[[iframe-erbt-nichts]].

**Für Marcel:** einmal durchklicken, 30 Sekunden. Zeigt die Box unten Einschätzung und
Kaufempfehlung?

### N35 · Heute/Aktenmappe — Rest (06.10.2026)

- Kopf auf dem Handy 93 px gegen 57 px am Schreibtisch — kompakter? **Entscheidung Marcel offen.**
- Marke fehlt auf dem Handy in der Aktenmappe (stand in der entfernten Schiene) — klein in die Kopfzeile? **Entscheidung Marcel offen.**
- Kanzlei und Tower auf 390 px in derselben Tiefe nachprüfen.
Erledigtes s. Fertig.

### N34 · Steuer/Bewirtschaftung — Rest (06.10.2026)

- `kontofuehrung` 8 € und `porto` 5 € stehen auf 0 — nicht von Marcel entschieden: **Entscheidung Marcel offen** (abnehmen oder zurücknehmen).
- `dashboard.js:482` und `quick-check-tab.js:87` rufen `DealKpis.compute()` ohne `bwk_nul_st`; der Telegram-Bot gibt das Feld noch nicht mit.
- Alte `steuer_snapshot`s (12 von 20) und fehlende neue Kennzahlen erneuern sich erst beim Öffnen.
- `Tax.calcImmoResult`/`calculateForObject` und der Quick-Check-UI-Weg ohne Aufrufer — weg, wenn ohnehin angefasst.
Erledigtes s. Fertig.

### N30 · Ernte Linie 7 (TH/ST/SN/MV) und die Aurich-Korrektur — v1886–v1887a, auf Prod

**Marcel entscheidet:** Lizenz Sachsen-Anhalt ist ungeklärt (45 neue Sätze tragen „ungeklärt, vor
Kundeneinsatz klären") — **und das Register widerspricht sich**: `swf-st.json` führt 28 Sätze als
„frei zugänglich". Eine Mail ans LVermGeo klärt 73 Sätze auf einmal. **MV-Sachwertfaktoren stehen
unter einer Lizenz, die es nicht gibt** (`swf-mv.json`: „Wiedergabe mit Quellenangabe", gemessen
verlangen MSE und VR eine Genehmigung) — Genehmigung einholen oder sechs Sätze zurückziehen.
**Dresden und Leipzig (64 Sätze)** stehen im Register, obwohl ihre Lizenz eine Erlaubnis verlangt.
Sachsen: fünf Ausschüsse brauchen nur einen Brief, sechs kosten 60–167 €.

### N31 · Linie 8 (NI/SH/RP/SL) liegt ungesät — Entscheidung über 280 Sperren

> **Gemessen am 06.10.2026, und es verkleinert die Frage:** die beiden Dateien sind **je Gebiet**
> gebaut (RP 35 Gebiete × 4 Zweige × 2 Kennzahlen = 280, SL 6 × 4 × 2 = 48), weil eine Sperre mit
> `zweig: "alle"` von `zweigWaehlen()` **nicht getroffen wird, sobald der Aufrufer eine Objektart
> nennt** — sie erreicht den Nutzer dann nicht. Eine Zusammenfassung „je Land" ginge deshalb
> **nur für den Liegenschaftszinssatz, nicht für den Sachwertfaktor**: dort filtert
> `EBENE_GESPERRT` die Landesebene heraus, bevor `unvollstaendig()` greift, und die Sperre wäre
> unsichtbar. **Die Entscheidung lautet also nicht „je Gebiet oder je Land", sondern: beim
> Zinssatz zusammenfassen, ja oder nein.** Der Generator liegt bereit und erzeugt beide Formen in
> Minuten.


411 Sätze im Arbeitsbaum, 16 Werte (Hameln-Hannover, Sulingen-Verden; darunter Spezialobjekte wie
Altenpflegeheim und Wochenendhaus), 395 Sperren. 280 davon sagen dasselbe: RP und SL sind
kostenpflichtig und genehmigungspflichtig. **Frage:** je Gebiet eine Sperre (so wie geliefert) oder
eine je Land? Dazu aus demselben Lauf: Otterndorf-Resthöfe 2024 → 2026 fortschreiben? Ostfriesische
Ferienwohnungen auf Gemeindeebene ernten (Inseln sind eigene Gemeinden)?

### N32 · ⚠ OFFEN im Kern — nachgemessen 12.10.2026, die Zahl ist gewachsen

> `gutachterausschuss.js:430-443` (`unvollstaendig()`) liest **nur**
> `unvollstaendig_grund`. `warum_kein_wert` kommt in der ganzen Datei
> **nicht vor** — weder gesetzt noch gelesen noch weitergegeben.
>
> Am Registerbestand gezählt (alle 62 Dateien geparst):
>
> ```
>   1.393 Saetze tragen warum_kein_wert, alle mit vollstaendig=false
>      33 davon tragen es OHNE unvollstaendig_grund
>          -> ihre Begruendung faellt still auf den Boden
>     109 Saetze tragen umgekehrt nur unvollstaendig_grund
> ```
>
> *(N32 nannte 34 von 86 — derselbe Befund, der Bestand ist gewachsen.)*
>
> **Ein zweiter Kanal funktioniert:** `quellen_links.js:474` gibt
> `warum_kein_wert` aus einer **handgeführten** Liste aus, und die
> Marktbericht-Ansicht zeigt es (`app.js:782`, `:884`, `:4215`). Der Text
> erreicht den Nutzer also — aber nur, wenn jemand ihn dort eingetragen
> hat. Der aus dem **Registersatz** erreicht ihn nicht.

**Der ursprüngliche Text:**

### N32 · Befunde am Rechenkern aus den Ernteläufen (05.10.2026)

**`warum_kein_wert` erreicht den Nutzer nicht:** `gutachterausschuss.js:438` liest
`unvollstaendig_grund`; von 86 Altsperren tragen 34 nur das andere Feld — ihre Begründung fällt
still auf den Boden. **Sperren mit `zweig:"alle"` sind unerreichbar**, sobald der Aufrufer eine
Objektart nennt (betrifft die SH-Zinssperren und Northeim). **`EBENE_GESPERRT` filtert auch
Sperren** — eine Landes-Sperre für den Sachwertfaktor kann es nicht geben. **Die Prüfstrecke
stürzt ab**, sobald ein Sperrsatz mit `formel: null` in der Datei liegt, und sie liest nur
`belege[0]`. **`formelwerk` kennt der Auswerter nicht** (Hamburg komplett, Magdeburg, Kiel) —
Auswerter in Arbeit.

### N29 · Aktenmappe Handy — Rest

- Ansehen, ob dasselbe Muster Aktionsblock und Nutzerblock betrifft (dort sind die Schienen-Regeln nach `[data-stellung]` gefiltert und nicht geklont). Bei Änderung an den Schienen-Regeln den Generator erneut laufen lassen. Erledigtes s. Fertig.

### N26 · Endabnahme Handy — Rest zum Bewerten

- Heute-Kopf bei A+ mit Objekt 117 px (Zähler-Pille rutscht in eigene Zeile); Investor-Band in der Schublade bei aktiver Karte kontrastarm; Panel-Text „In der Kanzlei tauschen Navigation und Aktionen" veraltet. Erledigtes s. Fertig.

### N28 · Ernte Linie 6 (BB regional 86 Werte, BE/HB Sperren) auf Staging und Prod — v1884

**Marcel entscheidet:** Bremen Vollbericht (50 €) kaufen und Genehmigung einholen (CC BY-NC-ND)
oder Sperre belassen; Bremerhaven Vollbericht bestellen; Sätze mit ≤ 5 Kauffällen (Barnim ETW WM,
Frankfurt MFH, Prignitz EFH, LDS WGH, Oberhavel ETW WM mit Minimum −1,81) als Stufe A ausliefern?
Berlin ETW/EFH: Vergleichsfaktoren als eigene Kennzahl ernten?
**Technisch offen:** OGA-Landessätze in lzs-bb.json unerreichbar (Zweige mfh_bu/we_wm passen zu
keiner ART_RANG-Zeile) → auf `mfh_lage_berliner_umland` umziehen; Resolver Gemeinde → Raumkategorie
(`lage`) fehlt; `liegenschaftszinssatz()` ruft findeZweig ohne `lage`.

### N27 · Ernte NRW Block 5 (26) auf Staging und Prod — Marcel entscheidet

Arnsberg/Lippstadt: log-Funktionen ohne Gültigkeitsspanne im Bericht (rechnen überall) —
Spanne aus Stichprobe als Sperre oder „Anwender würdigt"? Gütersloh 2026 (Nachtrag bereit, zwei
2025-Sätze aus Block 2 ersetzen; vorher prüfen, was `gutachterausschuss.js` bei zwei Jahrgängen
tut). Olpe `berichtsjahr 2025` bei 2026-Quelle korrigieren? Velbert nur als Tabelle (Formel im
PDF als Symbolschrift). Bergisch Gladbach braucht `baujahr_fiktiv` (Verzweigung liest Baujahr).

### N24 · Handy/Tablet — Rest zum Bewerten (nicht dringend)

- Marktbericht-Ansicht auf dem Handy ohne eigenen Zurück-Knopf; Reiterleiste zeigt am Desktop-Kabinen-Bildschirm einen Scrollbalken. Erledigtes s. Fertig.

### N25 · Ernte 05.10.2026 — NRW Faktoren Block 3 (47) + Block 4 Kreise (30) + Kassel 2026, auf Staging und Prod

**Marcel entscheidet:** Rheine rhdhh (Beispiel 0,98 gegen Formel 0,9748) freigeben? Kassel 2024
neben 2026 — jüngstes Jahr bevorzugen oder 2024 streichen. **Nächste Blöcke:** Stadt Wesel
(GMB 29400), restliche NRW-Kreise, dann BY/BW-Ausschüsse mit Genehmigung. **Feldbrücke:** sieben
neue Eingabefelder (bodenwertanteil_prozent, bodenwert, sachwert_bauliche_anlagen,
ortsteil_einwohner, mietsituation, ortsteil, wohnlageklasse) fehlen in CrossCheckService →
diese Sätze antworten bis dahin `feld_fehlt`.

### N22 · Modul Portfolio-Strategie (05.10.2026) — angelegt v1880, hinter Feature-Schlüssel

Weg 2 (Marcels Wahl): im Repo, hinter `portfolio_strategie` (Migration 085, überall false;
Staging Partner-Plan an). Heute: Bestand mit Fristen (AP 7), AP-Liste, Tabelle für Läufe.
**Nächste Schritte:** volles Objekt je Zeile (Sanierungsquote, AfA-Reihe), Investorprofil (AP 9),
erste Versuchsreihe AP 6 mit vorab gesetzter Schwelle (< 2 % zum Referenzoptimum kleiner Bestände).

### N23 · Ernte 05.10.2026 — Rest

- Herford/Minden-Lübbecke werden von Hand-Modulen verdeckt (Register nie erreicht); Kreissätze decken Städte mit eigenem Ausschuss; Aachen ohne Soll; Kassel SWF 2026 nachernten; negative Zinssätze (Frankfurt) lehnt der Auswerter ab. Erledigtes s. Fertig.

### N20 · Aktenmappe Handy — Rest

- Die anderen Layouts (Kanzlei v2b, v3–v5) auf 390 px mit der Messkabine durchgehen; Marcels Blick aufs echte iPhone. Erledigtes s. Fertig.

### N21 · Forschungszulage: Stundennachweise (05.10.2026) — angelegt, Prüfung durch Marcel offen

`Forschungszulage/Stundennachweise/` + Generator. Marcel: Blätter prüfen,
Januar–April von Hand, Tage ohne Commit nachtragen, 40-h-Wochen kürzen,
unterschreiben; ab jetzt täglich fortschreiben.

### N18 · Steuer — Rest (05.10.2026)

- **Abnahme:** ein § 7b-Objekt auf Staging anlegen und Cashflow-Projektion Jahr 4 → 5 (Sonder-AfA fällt weg) gegen den Reiter Steuer halten.
- Fraglich: Soli/KiSt/Splitting, überlappende Steuerzeiträume, Sprach-Import 3 % (BWK 55 % und ein zvE in der Projektion mit N34/v1898 geschlossen).
Erledigtes s. Fertig.

### N17 · Ernte-Automatik — Rest (Stand unklar, am 25.10.2026 nicht nachgemessen)

- Nur NRW-LZS vollautomatisch; Vorschlag „Auto-Ernte-Vorschlag mit Freigabe" in 4 Stufen (10–17 Tage) — **Entscheidung Marcel offen** (Details Journal 37). Erledigtes s. Fertig.

### N16 · Rest (Daten, kein Code)

- Die Pilot-Analyse der Parkstr. 9 nennt die Westerfeldstraße 140 — neu laufen lassen. Erledigtes s. Fertig.

### N13 · Parkstr. 9 — Rest (05.10.2026)

- „KI-Lauf" statt „Stufe 2/3" in der Verkehrswert-Übernahme — siehe N12 (25.10.2026: `objekt-reiter.js:950` gibt weiter „KI-Lauf").
- Drei tote Quell-Links aus N12 prüfen.
Erledigtes s. Fertig.

### N12 · Gesamtdurchgang — Rest (04.10.2026)

- Verkehrswert-Übernahme nennt Berichte aus dem Dialog „KI-Lauf" statt „Stufe 2/3": die Stufe steht nicht in der History-Antwort (`/marktbericht/objects/history`) — aufnehmen (MB-Backend, Rebuild), `_stufeAus()` darauf lesen.
- Drei tote Quell-Links (Stand 04.10.): Remscheid GMB 2025 (gars.nrw, 404), Brandenburg GMB_LOS.pdf (404), Horb id=4870 (404). Register-Zahlen von damals sind überholt (s. CLAUDE.md, Stand 22.10.2026).
Erledigtes s. Fertig.

### N10 · Reiter Objekt — Rest

- Hilfetexte für die ~130 Felder ohne gepflegten Tooltip (heute Rückfall Beschriftung + Verwendung) — Redaktionsarbeit (Marcel/Fachlichkeit), kein Code. Erledigtes s. Fertig.

### N9 · BMF/RND — Rest (Abnahme)

- Vorbelegung bis Schritt 5/6 im Browser durchklicken; das erste Öffnen (Markup aus dem Netz) am echten Erstkontakt messen. Erledigtes s. Fertig.

---


## → NEU und OBERSTE PRIORITÄT: Der Copilot wird ein Agent (02.10.2026)

A-1 bis A-8 gebaut und durchgetestet (v1800–v1808), Erledigtes s. Fertig. Offen:

### A-9 · E-Mail- und Aufgabenabgleich (Punkt 8)

Der Agent gleicht gelesene, ungelesene und abgelegte Mails gegen offene Aufgaben ab, ordnet sie Objekt und Vorgang zu, legt sie ab, erledigt die Aufgabe und schreibt einen Vermerk („Erledigt am … aufgrund der E-Mail von …, Betreff: …, vom …“).

**BLOCKIERT:** Es gibt keine Mail-Anbindung — eigener Bau (Zugang, Ablagestruktur, Aufgabenmodell). Siehe G1 (Google Drive).

---


## → NEU: Telegram-Bot als zweiter Zugang zur App (01.10.2026)

Bot gebaut (v1791–v1798: eigener Bot je Kunde, Webhook, Einmal-Code, Auskunft, Anlage, Sprachnachricht), Erledigtes s. Fertig. Offen bleibt nur G1:

### G1 · Google Drive — eigenes Thema, noch nicht angefasst

Marcel ausdrücklich: *„Das wäre aber ein extra Thema."* Was die Anleitung und
`bau-cockpit/lib/drive.js` (101 Zeilen) dazu hergeben, steht fest:

- OAuth 2.0, Client-Typ **Desktop-App**, Einmal-Anmeldung über
  `http://127.0.0.1:53682/callback`, Scope `…/auth/drive`,
  `access_type=offline` **und** `prompt=consent` — ohne beides kommt **kein**
  Refresh-Token.
- Das Bau-Cockpit führt **mehrere Konten**: Token je Konto in
  `data/google-accounts/<email>.json`, aktives Konto in `data/google-active.json`.
- `supportsAllDrives=true` bei jedem Aufruf, sonst fehlen geteilte Ablagen.
- **`invalid_grant` nach 7 Tagen**, solange die App im Testmodus steht.

**Für DealPilot ist das ein Server-Betrieb**, also Client-Typ
„Webanwendung" mit `GOOGLE_REDIRECT_URI` — nicht der Desktop-Weg der
Anleitung. Das gehört beim Angehen gemessen, nicht übernommen.

---

## → ERNTE: Stand und nächste Schritte (01.10.2026)

> **Stand nach v1768b, in der Datenbank nachgemessen:** 2.573 Zeilen,
> 14 Länder, 8 Kennzahlen, kein Satz ohne Link. **Zehn Länder führen einen
> Liegenschaftszinssatz** (Beginn der vorigen Sitzung: sechs, drei davon
> mit einem Alibi-Satz). Neu in v1768: MV 4 Zins / 10 SWF, TH 2 Zins,
> BE 7 Zins.
>
> **Bremen und Saarland sind nachweislich zu, nicht unbearbeitet.**
> Bremen führt gar keine Sachwertfaktoren (der Ausschuss schreibt, er sei
> personell nicht dazu in der Lage) und seine Zinssätze stehen nur im
> 50-€-Vollbericht. Für das Saarland ist die Quelle gefunden, aber jede
> Wiedergabe braucht die Genehmigung des Herausgebers.
>
> **Der nächstgrößte Gewinn ist Rostock:** Werte vorhanden und
> maschinenlesbar, nur genehmigungspflichtig — das hängt an einer Mail,
> nicht an Arbeit.

### E2 · `modellansaetze` ist nur zu 58,8 % gefüllt — OFFEN, wichtig (Stand unklar, am 25.10.2026 nicht nachgemessen)

Gemessen über alle 2.515 Sätze des Dateiregisters:

```
Pflichtfelder (land_code, ags, ebene, gebiet_name, kennzahl,
  zweig, formel, belege, stufe, berichtsjahr, modellversion)   100 %
geltungsbereich                                               94,4 %
modellansaetze                                                58,8 %   ←
fallzahl                                                      55,7 %
korrekturen                                                    1,8 %   (nur wo nötig)
```

> **Das ist die Stelle, an der still falsch gerechnet wird.** Führt ein
> Ausschuss eine abweichende Gesamtnutzungsdauer oder einen eigenen
> Baupreisindex und steht die Zahl nur im Fließtext statt in
> `modellansaetze`, rechnet das System mit der Konstanten — und nichts
> widerspricht. Derselbe Befund wie bei Oberursel (GND 70) am 14.09.2026.

### E3 · Wo weiter geerntet werden kann — die Landkarte

Aus `connectors/opendata/laender-registry.js` gelesen:

| Status | Länder |
|---|---|
| **produktiv** | NRW |
| **adresse-bekannt** (Quelle da, nicht geerntet) | NI · BE · BB · MV · SN · ST · HE · RP · SH · HH |
| **gesperrt** | BW · TH |
| **nur Landesebene** | BY |
| **Lücke** (keine Quelle gefunden) | **HB · SL** |

### E4 · Rheinland-Pfalz geprüft — Daten nicht frei verfügbar

Erster echter Ernteversuch am 01.10.2026, Befund:

```
LGMB-2025_Online_1_3.pdf     106 Seiten, 219.387 Zeichen, 0 leer
  „Sachwertfaktor"           nur S. 9 und 83 — Inhaltsverzeichnis, ESG-Text
  „Liegenschaftszins"        nur S. 9 und 93 — Rechtsgrundlage
  Der Dateiname sagt es: Online_1_3 = Kapitel 1 bis 3.
  Kapitel 4 trägt die Wertermittlungsdaten und ist NICHT frei.

Zwischenauswertung_Beschluss_SWF_LZ_LGMB2025_bf.pdf   8 S., 12.453 Z.
  Enthält Zu-/Abschläge auf die LGMB-2025-Werte, KEINE Absolutwerte.
  Stichtag 01.01.2025, 6 Marktsegmente, 352 Kauffälle.
  Aussage des Ausschusses: „keine bzw. nur gering signifikante
  Differenzen" — die Werte von 2024 gelten weiter.
```

**Daraus folgt für RP:** ohne das kostenpflichtige Kapitel 4 kein Wert. Das
ist genau der Fall, für den die Doktrin den Weg vorsieht — der Kunde bekommt
den zuständigen Ausschuss und den Link, mit dem Hinweis auf die Kosten.
Der Status im Register gehört von `adresse-bekannt` auf
`daten-kostenpflichtig` präzisiert.

### E5 · Es wird nichts automatisch geerntet — OFFEN (Stand unklar, am 25.10.2026 nicht nachgemessen)

```
mb.etl_runs      0 Einträge
mb.param_lauf    5 Läufe (2x NRW-Saat 12.08., 1x imbde 03.08., 2x v1751)
crontab          kein Eintrag
systemd-Timer    keiner
```

Eine jährliche Nachernte braucht einen Plan, sonst fängt sie jedes Mal bei
der Recherche an. **Das Werkzeug dafür steht jetzt:**
`tools/pdf-lies.mjs` liest PDF-Text mit pdf.js und nennt seine Deckung
(Seiten, Zeichen, leere Seiten) — ein Latin-1-Prüfer scheitert an
komprimierten CID-Strömen und liefert Buchstabensalat.

---

## → OFFEN aus dem 01.10.2026, nachmittags (Setup-Fenster und die Piloten)

U1–U8 und U8-R erledigt (v1749–v1776), s. Fertig. Offen:

#### U8-R · Greifen die Finanzierungsgrenzen WIRKLICH überall?

Gemessen ist nur ein Leser (die Ampel in `dealscore2-ui.js`). Marcel: „und die müssen überall greifen“ — zu prüfen, ob Empfehlungstexte, PDF-Ausgaben und der Co-Pilot dieselbe Schwelle verwenden oder eigene Konstanten führen.

---


## → NEU: Die beiden Piloten sollen sprechen können (01.10.2026)

V1–V7 gebaut (v1760–v1769c), Erledigtes s. Fertig. Offen:

- **V3/V5/V7 · Abnahme:** je ein echter Sprechlauf gegen ein belegtes Feld (sagt er, was drinsteht?), gegen ein leeres, und einer mit Blick auf die Kostenansage.
- **V6 · Prod:** `tools/mb-uid-zuordnen.mjs` muss auf Prod eigens laufen (prüft die Eindeutigkeit dort neu) — nicht belegt, ob das beim Prod-Rollout geschehen ist. Die 21 Zeilen ohne Kennung bleiben bewusst stehen.

---


## → OFFEN aus dem 01.10.2026 (Rundgang, Erstanmeldung, BMF-Ausgabe)

Marcels Durchgang am 01.10.2026. **Reihenfolge wie von ihm genannt.**
Zwei Punkte sind beim Aufschreiben schon gefallen (T3, T4) — sie stehen
trotzdem hier, damit die Abnahme nachvollziehbar bleibt.

### T1 · Die Tour in jeder Ansicht — Rest (Hänger behoben v1774/v1779/v1780, s. Fertig)

- **Schritt 24 (Stress-Test, Tab `s6`):** Spot liegt außerhalb — `_applySubHl` scrollt 420 ms nach dem Spot ein zweites Mal für das Unterziel. Vermutete Lösung: Unterziel schon beim ersten Scrollen berücksichtigen (eigener Umbau; v1781 und v1782 zurückgenommen).
- **B1:** Spot der Quick-Boarding-Schritte 4–6 war 2.216 px hoch bei 988 px Fenster (Unterziel gegen Container) — seit v1779 nicht eigens nachgemessen.
- **Schritt 37 und 38** erreicht kein Zweig in der Standardansicht.
- **Kanzlei und Tower** nie vollständig mit dem Läufer gemessen (Prüferproblem); seit v2154 klappt die Tour dort die Schiene auf.

### T4 · Demo-Objekt für die Tour vorhalten — Rest: Abnahme (Bau s. Fertig)

**BLOCKIERT:** Abnahme des Pfads „Nutzer hat KEIN Objekt“ — am Konto mit 17 Objekten nicht herstellbar (`_ensureObjectLoaded` kehrt vorher an `#hdr-obj` zurück). Gehört an einem frischen Konto abgenommen.

### T7 · Erstanmeldung: Einstellungen müssen ankommen UND wiederfindbar sein

Marcel: „Das Ziel ist, dass wenn der Kunde sich anmeldet, die Einstellungen
vernünftig funktionieren, auch der erste Schritt vernünftig funktioniert,
dass er das Design auswählen kann, dass er die Grunddaten eingibt und dass
er später auch wiederfindet."

Das letzte Drittel ist der ungeprüfte Teil: **wiederfindet.** Jeder im Setup
gesetzte Wert muss an der Stelle stehen, an der der Nutzer ihn später sucht —
und zwar an der, die die App auch LIEST.

> **Am 01.10.2026 teuer gelernt:** das Setup schreibt nach
> `dp_investment_profile`, meine Sicherung lag auf `profil`. Zwei Schlüssel
> mit demselben Inhalt, 18 Felder beide — und nur einer wird gelesen. Beim
> Zurücklegen hätte das stillschweigend die falschen Werte zementiert.

### T8 · Kaufpreisaufteilung „Am Markt 18" gegen unsere rechnen — GEMESSEN, ENTSCHEIDUNG OFFEN

**Es sind zwei verschiedene Verfahren.** Marcels Dokument rechnet nach der
**umgekehrten Ertragswertmethode („Kaufpreisaufteilung nach Jacoby®")**,
zugelassen durch BFH-Urteil vom 20.09.2022, IX R 12/21. DealPilot rechnet die
**BMF-Arbeitshilfe** — gemessen in `bmf-modal.js:519-521` kennt das Modul
genau drei Wege: Ertragswert, Sachwert, Vergleichswert. Die umgekehrte
Ertragswertmethode ist **nicht** darunter.

> Zwei Zahlen zu vergleichen, die aus verschiedenen Verfahren stammen, ergibt
> keine Abweichung, sondern einen Kategorienfehler. Deshalb steht hier der
> Rechenweg vollständig — damit die Entscheidung auf Zahlen fällt und nicht
> auf dem Eindruck, es sei „ungefähr dasselbe".

**Der Prüfmaßstab, Zeile für Zeile aus dem Gutachten gelesen** (pdf.js, 11
Seiten, Az. 25DG02659/HH, Grünwald 03.07.2025):

```
Kaufpreis (ohne Nebenkosten)                       110.911,00 EUR
+ Reparatur-/Investitionsbedarf                          0,00 EUR
- Bodenwert insgesamt (MEA)                          7.617,56 EUR
    3.878,00 m2 x 130,00 EUR = 504.140,00 EUR
    davon MEA 15,11/1000                             7.617,56 EUR
= vorlaeufiger Ertragswert der baulichen Anlagen   103.293,44 EUR
/ Kapitalisierungsfaktor (§ 34 Abs. 2 ImmoWertV)        30,2100
    Liegenschaftszins 2,5 %, RND 57 Jahre
= Reinertragsanteil der baulichen Anlagen            3.419,18 EUR
+ Bodenwertverzinsungsbetrag                           143,82 EUR
    Diskontierungsfaktor (§ 34 Abs. 3)                   0,2448
    Bodenrestwert nach RND                           1.864,78 EUR
    Bodenwert waehrend der RND                       5.752,78 EUR
    davon 2,5 %                                        143,82 EUR
= jaehrlicher Reinertrag                             3.563,00 EUR

vorlaeufiger Gebaeudeanteil  3.419,18 / 3.563,00       95,96 %
vorlaeufiger Bodenanteil       143,82 / 3.563,00        4,04 %

bereinigter Kaufpreis                              109.046,22 EUR
steuerlich absetzbarer Gebaeudeanteil              104.644,60 EUR
ERGEBNIS  Gebaeude 94,35 %   Boden 5,65 %  (6.266,40 EUR)
Nebenkostenanteil  11.723,29 x 94,35 %              11.060,93 EUR
```

**Was jetzt zu entscheiden ist (Bewertungsfrage, gehört Marcel):**

1. Soll DealPilot die **umgekehrte Ertragswertmethode** zusätzlich rechnen?
   Sie steht dem Steuerpflichtigen seit dem BFH-Urteil offen und führt bei
   Ertragsobjekten regelmäßig zu einem **höheren** Gebäudeanteil als die
   BMF-Arbeitshilfe — hier 94,35 %. Das ist genau der Punkt, an dem sich für
   den Kunden Geld entscheidet.
2. Oder bleibt es bei der Arbeitshilfe, und das Modul nennt die Alternative
   nur als Hinweis?

**Vor jedem Zahlenvergleich** gehört ein Empfindlichkeitstest je Eingabe
gefahren: `/bmf/aufteilung` überspringt unbekannte Felder kommentarlos —
gemessen 5 von 12, Bodenwert um Faktor 2,9 falsch, `warnings` leer. Sonst
vergleicht man zwei Zahlen, von denen eine gar nicht auf den Eingaben beruht.

Noch fehlend für den Gegenlauf: Nettokaltmiete und Wohnfläche der WE 2 —
stehen vermutlich im zweiten Dokument
`Dateien/RNDG Am Markt 18, 06184 Kabelsketal - WE 2.pdf` (9,5 MB).

---

## → OFFEN aus dem 29.09.2026 (Preise, Prod, Modul, RND)

### N5 (29.09.) · RND-Verfahrenswahl — BEWERTUNGSFRAGE für Marcel

`rnd-calc.js:419-433` wählt **immer die technische Alterswertminderung**,
solange Alter < GND; das Punktraster ist nur Rückfall.

Am Gutachten Alexanderstr. 11 (Bj 1976, GND 80, 2 Punkte, RND 33 J
nach Anlage 2) trifft **unser Punktraster auf 0,2 Jahre genau**
(32,80). Die technische Rechnung kommt je nach Gewerke-Eingabe auf
einen anderen Wert.

**Kein Defekt:** Der Wizard **erhebt** alle neun Gewerke
(`rnd-wizard.js:1306-1323`, Radio-Tabelle). Die Regel ist bewusst
gesetzt und dokumentiert.

**Offen:** Soll das Punktraster führen, wenn es nach Anlage 2
anwendbar ist — oder soll der Nutzer das Verfahren wählen? Marcel ist
DESAG-Sachverständiger; das ist seine Entscheidung, nicht meine.

> **Nachtrag 29.09.2026 — ich hatte hier zu früh „kein Defekt" gesagt.**
> Marcels Frage war „**haben wir die Eingabefelder?**", und das ist eine
> Messfrage. Gemessen:
>
> - `calcAll()` gibt **sechs** Verfahren zurück (`methods.linear/vogels/
>   ross/parabel/punktraster/technisch`).
> - `rnd-wizard.js` zeigte **drei**. **Vogels, Ross und Parabel wurden
>   gerechnet und verworfen** — keine Anzeige, kein PDF (`grep -c` = 0),
>   kein DOCX.
> - Diese drei brauchen **keine eigenen Eingabefelder**: sie nehmen nur
>   Alter und GND, die immer vorliegen. Es gab also keinen technischen
>   Grund für ihr Fehlen.
>
> An den drei Testobjekten liegen die Verfahren **12,8 / 17,8 / 19,2
> Jahre** auseinander. Behoben in **v1676** — samt dem zweiten Befund,
> dass die Verfahrensübersicht **nie CSS hatte** (von sechs ausgegebenen
> Klassen war keine definiert).
>
> **Die Lehre:** „Das ist eine Bewertungsentscheidung" ist eine richtige
> Aussage, die eine falsche Antwort war. Die Verfahrens*wahl* gehört
> Marcel — die Verfahrens*anzeige* war schlicht kaputt, und das hätte
> ich messen müssen, bevor ich die Frage zurückgegeben habe.

**Was jetzt noch Marcels Entscheidung ist** (unverändert): welches
Verfahren führen soll. Neu ist nur, dass er die Alternativen jetzt
sieht.

---

## → OFFEN aus dem 26.09.2026 (Layouts, Datenaufnahme, Ernte)

Der Tag ist ausgerollt und nachgemessen (Journal-Einträge 5 bis 12 in
`claude/projektanweisung-hauptapp.md`). Was **nicht** fertig ist:

### P2 · Die Reihenhaus-Gitter der NI-Ernte hängen — DIAGNOSE OFFEN (Stand unklar, am 25.10.2026 nicht nachgemessen)

**Stand: 11 von 17 Gebieten vollständig, 6 ausgefallen.** Und darin
steckt ein Muster, das noch niemand erklärt hat:

| Gebiet | EFH | RH |
|---|---|---|
| Goslar | **4/4 Lagen, 80 Punkte** | **alle 4 Lagen hängen** |
| Northeim | **4/4 Lagen, 80 Punkte** | **alle 4 Lagen hängen** |
| Holzminden | **1/1 Lage, 20 Punkte** | **hängt** |

> **Die EFH-Fassung derselben Stadt läuft in einer Minute je Lage durch,
> die Reihenhaus-Fassung nicht in vier.** Auch „GS 01", die in der
> EFH-Datei ohne Nachfassen fertig wurde. Das ist keine Zeitfrage,
> sondern ein Unterschied im Dashboard.

**Zwei weitere Ausfälle sind vermutlich dauerhaft und richtig:**
- `2026_sw_efh_lgdan` (Lüchow-Dannenberg) — hat gar keine Lage-Auswahl,
  gehört nicht zu diesem Ernter. Der Erkenner hat damals das Wort „Lage"
  in einem Zahlenfeld `Lagewert` getroffen (`ni-lageachse.csv`).
- `2026_sw_rh_sulverver` — Stichprobengrenzen nicht lesbar.

**Nächster Schritt — nicht wiederholen, sondern messen:** eine
RH-Fassung mit kleinem Gitter (`--punkte 2x2`) und angehobener
Lage-Frist laufen lassen und den Zähler `verriegelt` ansehen. Steht er
hoch, wiederholt sich jeder Punkt, weil die Verriegelung das Bild nicht
wiedererkennt — dann liegt es am SVG der RH-Dashboards, nicht an der
Geschwindigkeit.

**Erst danach:** `ernte2rezept.mjs` → `rezept2register.mjs --schreiben`
→ ausrollen → Kettenprüfung. Die elf fertigen Gebiete liegen bereit;
`ernte2rezept` weist Teilstände seit v1638 von selbst ab.

### P3 · Die Bordkarte — vier von fünf Entwürfen stehen (Stand 28.09.2026)

> **Nachtrag 28.09. abends:** die Layouts sind auf **zwei** reduziert
> (Aktenmappe, Kanzlei); Werkbank, Dossier und Cockpit hell sind
> gestrichen. Die Kanzlei ist nach dem Entwurf neu gebaut — sie war
> andersherum. Journal-Eintrag 28.09.2026 (4).
>
> **Offen dort:** in `layout-varianten.css` stehen noch 61 tote
> Regelzeilen für v3/v4/v5 und die Stellungen `leiste`/`fuss`. Und
> bei `#hdr-obj-num` gewinnt eine Regel aus `ui-varianten.css` trotz
> gleicher Spezifität und früherer Ladung — **Ursache ungeklärt**,
> umgangen durch eine Klasse mehr.

| Entwurf | Stand |
|---|---|
| **1 · Zeile** | gebaut (v1639), wählbar als `?karte=zeile` |
| 2 · Karteikarte | nicht gebaut — von Marcel nie gewählt |
| **3 · Checkliste** | gebaut (v1643) **als Dialog beim Anlegen** |
| **4 · Trichter** | gebaut (v1651–v1651f) |
| **5 · Bordkarte ernst** | gebaut (v1651–v1651f) |

Der Umschalter steht in den Einstellungen unter „Darstellung" direkt
unter dem Aufbau; Attribut `data-dp-kartenstil`, Merker
`dp_karten_stil`, URL `?karte=zeile|trichter|bordkarte`.

**Was offen blieb:**

- **Entwurf 3 ist ein Dialog, kein Reiter.** Marcel hatte den Reiter
  als Möglichkeit genannt („wenn es sich ergibt"). Unverändert offen.
- **Der Weg zu beiden Schaltern ist drei Klicks tief:** Einstellungen →
  Darstellung → „Darstellung öffnen" → dann erst Aufbau und
  Datenaufnahme. Gemessen: alle zehn Knöpfe klickbar, das Umschalten
  greift. Aber wer den Weg nicht kennt, findet ihn nicht — und Marcel
  hat am 28.09. gesagt, er könne „Einstellungen nicht anklicken".
  **Zu prüfen, ob die beiden Gruppen eine Ebene höher gehören**, direkt
  neben „Obsidian / Hell".
- **Entwurf 2** ist nie gebaut worden. Das ist kein Versäumnis — Marcel
  hat ihn nicht gewählt. Steht hier nur, damit die Liste vollständig
  ist.

Schau: `frontend/entwurf-aktionsbox.html`.

### P3c · Die Score-Zusammensetzung gegen die Demo — OFFEN

Marcel am 28.09.2026: „die Zusammensetzung des Deal Scores, das sieht in
der Demo noch anders aus."

Die fehlende KPI-Angabe ist behoben (v1654d: `.sc-pill-sub` stand auf
`display:none`, jetzt steht unter jeder Kennzahl „4 / 4 KPIs").
**Die Gestaltung ist offen:**

| | Demo (`entwurf-hell-bankfaehig.html`) | App |
|---|---|---|
| Score | Ring-Chip + „Gute Bewertung / Investor Deal Score" | Textblock „70 Gut" |
| Kennzahlen | **echte Werte**: Rendite 4,72 %, DSCR 1,27 | Score-Anteile: „RENDITE 72 %" |
| Anzahl | sechs (mit DSCR) | fünf |

> Der Unterschied ist nicht nur Optik: „RENDITE 72 %" liest sich wie
> eine Rendite, ist aber ein Score-Anteil. Die Demo zeigt beides
> getrennt. **Das ist eine Produktentscheidung** — vor dem Bauen mit
> Marcel klären, ob die Kennzahlenzeile die echten Werte tragen soll.

### P4 · Kleinere Reste

- **Ein leeres Testobjekt** liegt in Marcels Staging-Portfolio (beim Nachweis der Checkliste entstanden). Kann weg — seine Liste.
- **Marcels eigenes Profil:** seine E-Mail steht im **Namensfeld**, eine PDF-E-Mail ist nicht gesetzt. Seine Daten.
- **Kopie statt Quelle:** `BY_AUSSCHUSS_DATEN` in `quellen_links.js` ist aus `verfuegbarkeit-by.json` abgeleitet und eingefroren (96 Kreise, Stand 25.09.) — ändert sich die Registerdatei, ändert sich die Tabelle nicht mit.

---

## → HIER WEITERMACHEN: Marcels Backlog v22 vom 18.09.2026

Volltext: **`Dateien/dealpilot_backlog_v22.md`**. Erledigtes s. Fertig. Offen:

- **3/4 Partnernetzwerk** (`v1429`): Staging-Abnahme im Browser.
- **7 Marktbericht-Stufen** (`v1435`): vollständiger Stufe-3-Bericht im Browser.
- **9 Sprechlauf Teil 2 — BLOCKIERT** (Messung im Browser/am Gerät): Verbindungsqualität messen/anzeigen, Überlappung Tippen/Sprechen, Handy-Layout < 560 px; iOS-Aufnahme (mp4) am iPhone abnehmen.
- **15 Quick Check Marktwert** (`v1432`): am echten Exposé abnehmen.
- **16 Rest:** Ist-Miete je Einheit, Leerstand-Ist, Gewerbeanteil im MFH-Konfigurator prüfen.
- **20 Mobile-QA Rest:** Sprechlauf am Gerät (Mikrofon).
- **22 Rest:** Vererbung Objekt → Gebäude → Einheit.

---

## Marcels Auftrag vom 13.09.2026 (Blöcke A–C, S, D, R)

Drei große Blöcke, von Marcel in einem Zug beauftragt. **Reihenfolge wie
hier** — der Audit zuerst, weil er den kleinsten Vorlauf braucht und
Erkenntnisse für die anderen beiden liefert.

---

### A · Audit „Aktionen / Einstellungen" — alle Reiter — Rest

Erledigtes (A1–A6, A8) s. Fertig. Offen:

- **A7** Co-Pilot/KI: was zusätzlich einbringen — wird in Block C mitbeantwortet.
- **A9** Anbieter-Neutralität: **zurückgestellt** (Marcel 13.09.2026: PriceHubble und Sprengnetter werden später ausgeblendet).

---

### B · Schutz gegen Auslesen, Scraping und Nachbau — Rest

Erledigtes s. Fertig. Offen:

- **B3** Parametervariation, parallele Sitzungen, regelmäßiger Auswertungslauf der Kennzahlen.
- **B8** Versandweg der Adminmail ungetestet (Probemail nur auf Anforderung).
- **B9** Admin-Ansicht „Sicherheit" muss Marcel einmal öffnen.
- **B16** CSP fehlt; serverseitige Validierung nicht durchgehend geprüft.

Leitplanken: bestehende Funktionen nicht beschädigen; ein Risikoscore ist kein bewiesener Verstoß.

---

### C · Vom Sprechlauf zum Investment-Co-Piloten — Rest

Erledigtes s. Fertig. Offen:

- **C3** Exkurse und Rückkehr in den Prozess. **C4** Reihenfolge Datenbank → Dokumente → Angaben → erst dann fragen.
- **C6** permanenter Prozesskontext · **C8** Änderungen per Sprache mit Nachziehen · **C9** strukturiert speichern für die Pilot-Analyse · **C10** Abschluss „Objekt speichern und anlegen".
- **C12 (2)** Grün-Kennzeichnung an einem BESTEHENDEN Objekt nachmessen.
- **C14** greift der Hörwächter im echten Abbruchfall? (`VoiceImport._fsStand()`).

Erster Schritt bleibt eine Bestandsaufnahme, was von C1–C10 schon läuft.

---

### S · STEUERTHEMATIK — Prüfung, Belege, DATEV **[NEU 15.09.2026]**

Marcels Auftrag: OCR für Belege im Tab Steuern, DATEV-Import und -Export,
Rechenwege prüfen, Trennung privat/Gesellschaft gegenprüfen.

---

#### S2 · **BEFUND: Die GbR bekommt einen eigenen Topf — das ist zu viel**

**Gemessen: 9,6 % zu hohe Entlastung**, sobald GbR-Objekte neben privaten
stehen.

Eine **GbR ist transparent** — ihre Einkünfte fließen beim Gesellschafter in
**dasselbe** zu versteuernde Einkommen wie die privaten. Die App weiß das
sogar und schreibt es im Mandanten-Panel hin: *„Personengesellschaft ·
transparent (ESt der Gesellschafter)"*. Gerechnet wird trotzdem in **zwei**
Töpfen, jeder gegen das **volle** zvE.

| | |
|---|---:|
| Privat (3 Objekte) | 24.592 € |
| GbR (2 Objekte) | 4.620 € |
| **zusammen** | **29.212 €** |
| ein Topf, transparent gerechnet | **26.664 €** |
| **Differenz** | **2.548 € = 9,6 % zu hoch** |

**Das ist dieselbe Fehlerklasse wie v1397 — nur eine Ebene höher:** dort
rechneten die *Objekte* jeder von vorn, hier die *Halter*.

##### Warum das nicht einfach zusammengelegt wird

**Es fehlt die Beteiligungsquote.** Das Datenmodell kennt vier Rechtsformen
(`privat`, `gmbh`, `ug`, `gbr`) und **keinen Anteil**. Bei einer GbR mit
Partnern zählt aber nur der eigene Anteil am Ergebnis — eine Zusammenlegung
mit 100 % wäre dann genauso falsch wie die heutige Trennung, nur in die andere
Richtung.

**Empfehlung (Marcels Entscheidung, Bewertungsfrage):**
1. Feld **Beteiligungsquote** je Mandant der Rechtsform `gbr`, Vorgabe 100 %.
2. Transparente Halter (GbR, später Einzelunternehmen) **mit dem privaten Topf
   zusammenführen**, das Ergebnis je Objekt mit der Quote gewichtet.
3. Kapitalgesellschaften bleiben getrennt — dort ist die Trennung richtig.

Solange das offen ist: **die heutige Rechnung ist konservativ falsch** — sie
weist zu viel Entlastung aus, wie jeder Fehler dieser Klasse.

---

#### S3 · Belege lesen im Tab Steuern — die Mechanik steht schon

**Nicht neu bauen, erweitern.** `beleg-import.js` (v1008) kann bereits alles:

- Ordner oder Einzeldateien wählen
- **PDF → JPEG** über pdf.js (bis 30 Seiten je PDF)
- Fotos direkt
- Vision-Batch an `POST /api/v1/ai/extract-beleg` (bis 40 Belege je Lauf)
- **Review-Liste, in der der Nutzer JEDE Zeile bestätigt** — richtig so, es ist
  Steuer
- Übernahme in die Zielfelder, CSV-Auswertung

**Was fehlt: das Ziel.** Die `FIELD_MAP` zeigt ausschließlich auf die
**BMF-Anschaffungskosten** (`ak_notar`, `ak_makler`, `ak_grest`, `bmf_hk` …),
und der einzige Einstieg ist der Knopf „📎 Belege scannen (KI)" **im
BMF-Modal**.

Der Tab Steuern führt dagegen die **laufenden Werbungskosten** als
Anlage-V-Felder mit Jahres-Overrides (`_taxYearlyOverrides`):

```
schuldzinsen · kontofuehrung · bereitstellung · notar_grundschuld
vermittlung · finanz_sonst · nk_umlf · nk_n_umlf · betr_sonst
hausverwaltung · steuerber · porto · verw_sonst · fahrtkosten
verpflegung · hotel · inserat · gericht · telefon · sonst_kosten
afa · sonst_bewegl_wg
```

**Zu bauen:**
1. Zweiter Modus im Beleg-Import: **„laufende Werbungskosten"** statt
   Anschaffungskosten, mit eigener Kategorienliste und `FIELD_MAP` auf die
   Anlage-V-Felder.
2. **Das Jahr** gehört dazu: ein Beleg trägt ein Datum, und die Übernahme muss
   in `_taxYearlyOverrides[jahr]` landen, nicht in ein jahrloses Feld.
3. Einstiegsknopf im Tab Steuern und im Detailmodus.
4. Abgrenzung im Prompt: **Anschaffungsnaher Aufwand** (§ 6 Abs. 1 Nr. 1a
   EStG, 15-%-Grenze in drei Jahren) ist keine Werbungskost, sondern
   Herstellungskost. Die Ampel dafür gibt es in `beleg-import.js` bereits.

---

#### S4 · DATEV — vorbereitet, nicht gebaut

Der **Kontenrahmen** wird je Mandant erfasst (`SKR04`/`SKR03`), und der
Hinweistext sagt es selbst: *„… später Basis für GuV-/Bilanz- und
DATEV-Export."* Mehr gibt es nicht.

**Was ein DATEV-Export wirklich verlangt** (Umfang ehrlich benannt, bevor
jemand „ein CSV" sagt):

| | |
|---|---|
| Format | DATEV-Format (CSV, Semikolon, **Windows-1252**), Kopfzeile mit Berater-, Mandanten- und Beraternummer, Wirtschaftsjahresbeginn, Sachkontenlänge |
| Inhalt | **Buchungsstapel** (EXTF): Umsatz, Soll/Haben-Kennzeichen, Konto, Gegenkonto, BU-Schlüssel, Belegdatum, Belegfeld, Buchungstext |
| Kontierung | jede Position braucht ein **Sachkonto** — SKR04 und SKR03 sind verschieden nummeriert, und die Zuordnung ist fachlich, nicht technisch |
| Steuerart | für eine **GmbH** sinnvoll (doppelte Buchführung). Für **Privatvermögen** gibt es keinen Buchungsstapel — dort ist die **Anlage V** das richtige Ziel, und die ist gebaut |

> **Damit beantwortet sich Marcels Frage nach der Trennung von selbst:**
> DATEV ist ein Thema der **Gesellschaften**, nicht des Privatvermögens. Ein
> DATEV-Export „für alle Objekte" wäre fachlich schief — die privaten gehören
> in die Anlage V, die der GmbH in den Buchungsstapel.

**Der Import** ist der schwierigere Teil: ein fremder Buchungsstapel müsste auf
unsere Felder **zurück**gemappt werden, und dafür braucht es dieselbe
Kontenzuordnung in umgekehrter Richtung. Realistisch ist als erster Schritt
ein **Export** für Kapitalgesellschaften, aufbauend auf `gesellschaft-abschluss.js`
(dort liegen GuV und Bilanz bereits in HGB-Gliederung).

**Vorschlag zur Reihenfolge:** S2 (Befund, klein) → S3 (Belege, mittel) →
S4-Export (groß) → S4-Import (größer, erst wenn der Export im Einsatz steht).


### D · SPRECHLAUF — Modelle und Kosten **[NEU 14.09.2026, gemessen]**

Marcels Fragen: welche Modelle laufen, wohin geht es, was kommt zurück, wären
Realtime-Modelle schlauer, was kostet es, sollten wir begrenzen.

**Gemessen an 44 echten Aufrufen** aus dem Staging-Log (`[voice/kosten]`), an
`printenv` in beiden Containern und am Code — nicht geschätzt.

#### Was heute läuft

| Schritt | Modell (ENV, Prod **und** Staging) | Weg |
|---|---|---|
| Transkription | `gpt-4o-mini-transcribe` | `/v1/audio/transcriptions` |
| Auswertung | `gpt-5.4-mini` | `/v1/responses` |
| Live-Hilfe (QuickMatch) | `gpt-5.6-luna` | `/v1/responses` |
| Realtime-WS | `gpt-4o-mini-transcribe` | **gebaut, aber nicht im Einsatz** |

Beide Schritte stecken in **einem** Aufruf: `POST /api/v1/ai/extract-voice`
bekommt Audio (Base64), den auf 24 Felder zugeschnittenen Katalog und den
Kontext; zurück kommen `transcript`, `fields`, `unsicher` und `kosten`.

#### Die Kosten, gemessen

| | |
|---|---|
| je Antwort, Mittel | **0,236 ct** |
| Median | 0,280 ct |
| Spanne | 0,10 bis 0,41 ct |
| voller Sprechlauf (21 Blöcke) | **rund 5 ct** |

**Rund 90 % davon ist die Auswertung, nicht die Transkription.** Typischer
Posten: `Transkription 55/8 | Auswertung 2860/147`. Das Audio ist billig, der
Feldkatalog im Prompt ist der Treiber.

> **Rücknahme:** Im Kommentar zu `dialogLimiter` (v1290d) steht *„Eine
> gesprochene Antwort kostet gemessen unter 0,1 Cent"*. Gemessen sind es
> **0,236 ct im Mittel** — mehr als das Doppelte. Damit stimmt auch die
> Folgerung nicht mehr: 150 Aufrufe je Stunde sind **rund 35 ct** je Nutzer und
> Stunde, nicht „deutlich unter 20 Cent". Vermutlich vor der Katalog-Erweiterung
> gemessen.

#### ① Das Auswertungsmodell ist der Hebel — nicht die Transkription

`gpt-5.4-mini` kostet **0,75 / 4,50** USD je Mio Token. `gpt-5.6-luna` kostet
**0,20 / 1,20** — und läuft in dieser App bereits als QuickMatch-Modell.

Gerechnet am gemessenen Durchschnittsposten (2.900 ein / 140 aus):

| Modell | je Antwort | je Sprechlauf |
|---|---:|---:|
| `gpt-5.4-mini` (heute) | 0,26 ct | ~5,0 ct |
| `gpt-5.6-luna` | **0,07 ct** | **~1,5 ct** |

**Rund 70 % Ersparnis, ein ENV-Wert.** Was zu prüfen ist: ob luna die
Feldzuordnung genauso sicher trifft. Das ist ein Qualitätsvergleich an
denselben Audiodateien, kein Umbau — und er gehört gemacht, bevor die ENV
umgestellt wird.

#### ② Prompt-Caching greift nicht — und der Grund ist gewollt

Der Code erfasst `cached_tokens` seit v1259f. **Gemessen greift es nicht:** die
Kosten gehen ohne Cache exakt auf (0,28 ct = 2860 × 0,75 + 147 × 4,50 + Audio,
mal 0,92).

Der Grund steht in `_rfKatalog`: der Katalog wird **je Frage zugeschnitten**
(24 Felder, gefragte zuerst). Damit ist der Prompt-Präfix bei jedem Aufruf ein
anderer — und OpenAI cached nur identische Präfixe ab 1.024 Token.

**Das ist ein echter Zielkonflikt, kein Fehler.** Der Zuschnitt schützt die
Qualität (der Code: *„mit 192 Feldern fängt ein Modell an zu raten"*). Ein
stabiler Präfix wäre bei `einCached` 0,075 statt 0,75 rund **zehnmal
billiger** — kostete aber vermutlich Trefferquote.

**Möglicher Mittelweg, ungeprüft:** den unveränderlichen Teil (Systemanweisung,
Regeln, Ausgabeformat) nach vorn und den wechselnden Katalog nach hinten. Dann
cached wenigstens der stabile Kopf. Ob er die 1.024-Token-Schwelle erreicht,
wäre zu messen.

#### ③ Realtime bringt hier wenig — aus einem benennbaren Grund

Der Realtime-Weg ist **gebaut** (`backend/src/ws/voiceStream.js`,
`wss://api.openai.com/v1/realtime?intent=transcription`) und seit **v536
abgeschaltet**: Web-Audio lieferte auf manchen Geräten Stille (peak = 0).

Er würde auch wenig bringen, weil er am **falschen Posten** spart:

- Die Transkription ist bereits der kleine Teil (~10 % der Kosten).
- Realtime hält eine Sitzung **durchgehend** offen — auch beim Nachdenken.
  Der heutige Weg schickt nur die tatsächlich gesprochenen Abschnitte
  (Ring-Puffer, 40 s, je Antwort geleert). Bei einem Dialog mit Pausen ist das
  **billiger**, nicht teurer.
- Der Auswertungsschritt bliebe unverändert — und dort liegen die 90 %.

**Wofür Realtime wirklich etwas brächte:** ein *sprechender* Co-Pilot (Audio
rein, Audio raus, Unterbrechen mitten im Satz). Das ist eine Produktfrage, kein
Sparvorschlag — Audio-Ausgabe kostet zusätzlich.

> **Nebenbefund:** Der ALTE Sprach-Import (`st`/`sx`, das Modal aus v504) schickt
> alle 5 s den **gesamten bisherigen** Mitschnitt an `/transcribe-chunk` —
> `st.chunks` wird während der Aufnahme nie geleert. Bei 4 Minuten sind das 48
> Aufrufe über zusammen ~98 Minuten Audio. Der **Sprechlauf** (`_fs`) macht das
> richtig (Kopf + Ring, je Abschnitt geleert). Zu prüfen, ob der alte Weg
> überhaupt noch erreichbar ist; wenn ja, ist er der teuerste Posten im ganzen
> Sprachbereich.

#### ④ Begrenzen? Ist bereits getrennt geregelt — die Zahl ist zu prüfen

Seit v1290d gibt es **getrennte Zähler**: Dialog 150/h, Dokument 30/h. Das war
die richtige Antwort auf *„nach zwei Durchläufen kam: zu viele PDF-Extraktionen"*.

Bei 21 Blöcken je Lauf sind 150 Aufrufe rund **fünf bis sieben Durchläufe je
Stunde** — großzügig bemessen. Eine Begrenzung der *Sprechlauf-Anzahl* im Sinne
eines Produktkontingents gibt es **nicht**; der Schutz ist ein Ratenlimit gegen
Missbrauch des Server-Schlüssels, kein Tarifmerkmal.

**Empfehlung:** nicht enger begrenzen, sondern ① umsetzen. Eine Begrenzung
kostet den Hauptweg der Objektaufnahme; das Modell zu wechseln kostet nichts
und spart mehr.

## → NEU: Marcels Auftrag vom 13.09.2026, nachmittags — Restnutzungsdauer und Verkehrswert

Zwei Aufträge aus derselben Ansage. Der erste ist neu, der zweite ist die
Übernahme eines Pakets, das in einer anderen Sitzung entstanden ist.

### R · RESTNUTZUNGSDAUER UND VERKEHRSWERTRECHNER

Marcel hat in `Dateien/` einen **Verkehrswertrechner** und einen
**Restnutzungsdauerrechner** abgelegt (ZIP „VW Reporting").

> **Die ZIP kam am 13.09.2026 nach** (`Dateien/vw-reporting-v17-0.zip`, 13 MB,
> 46 Dateien). **Gesichtet — und der wichtigste Befund stellt R1 und R2 auf
> den Kopf:**
>
> **Es ist kein fremder Rechner. Es ist unser Rechner mit einem
> DOCX-Erzeuger dahinter.**
>
> ```
> src/reporting/calculator_adapter.py, Kopfkommentar:
>   „Adapter zwischen dem bestehenden calc-engine (JS) und dem
>    ReportData-Modell. Der Rechner ist die Single Source of Truth.
>    Werte werden 1:1 übernommen — keine Neuberechnung."
>
> models.py Z. 275:  „Ein einzelnes RND-Verfahren-Ergebnis
>                     (aus rnd-calc.js methods.*)"
> ```
>
> `rnd-calc.js` ist **unsere** Datei (`frontend/js/rnd-calc.js`), und ihr
> `calcAll()` liefert genau das erwartete `methods`-Objekt — sechs Verfahren
> (linear, Vogels, Ross, Parabel, Punktraster, technisch) plus
> Schadensbewertung. Auch die eigene `CLAUDE.md` des Pakets sagt es als
> ersten Grundsatz: *„Das Reporting liest nur, es rechnet nicht neu."*
>
> **Was daraus folgt:**
> - **R1 ist im Kern beantwortet.** Zu übernehmen ist nichts am Rechenweg —
>   der ist schon unserer. Zu prüfen bleibt, ob das Paket im RND-Teil
>   Verfahren oder Parameter kennt, die `rnd-calc.js` noch nicht hat.
> - **R2 entfällt weitgehend.** Sachwert und Ertragswert über „dieses Modul"
>   zu rechnen hieße, sie über unseren eigenen Rechner zu rechnen. Genau das
>   passiert schon.
> - **R4 hat damit ein festes Format.** Der Adapter erwartet einen Dump mit
>   Top-Level `{state, r, nhkTyp, stuBeschreibungen, wortlaut}`. Das ist die
>   Datei, die DealPilot erzeugen muss — kein neues Format erfinden, sondern
>   **das bedienen, was Marcels Reporting schon liest.** Beispiel liegt bei:
>   `data/example_report.json` (Löhner Str. 278 — unser Testobjekt).
>
> Zwei Vorlagen liegen im Paket: `verkehrswertgutachten_master.docx` (10 MB)
> und `rnd_only_master.docx` (2,6 MB), dazu Logo und DESAG-Siegel. Der
> Absender steht getrennt in `ReportConfig` — **Corporate-Daten gehören nie
> in `objekt.*`**, das ist eine ausdrückliche Leitplanke des Pakets.

| | Punkt | Was zu tun ist |
|---|---|---|
| **R1** | ~~Sichten, was übernehmbar ist~~ — **erledigt 13.09.2026** | Siehe Kasten oben. Der Rechner ist unserer; das Paket ist der DOCX-Erzeuger dahinter. **Rest von R1:** einen Abgleich der RND-Verfahren — kennt `build_rnd_only_master.py` / `models.py` ein Verfahren oder einen Parameter, den `rnd-calc.js` nicht hat? |
| **R2** | ~~Sachwert/Ertragswert über dieses Modul rechnen~~ — **hinfällig** | Das Modul rechnet nicht. Es liest unseren `calc-engine`. Ein zweiter Rechenweg wäre genau die zweite Wahrheit, vor der `CLAUDE.md` warnt („Rechenkerne nie duplizieren"). |
| **R3** | **RND-Gutachten aus dem Sprechlauf anbieten** — Marcels Hauptwunsch | Am Ende des Sprechlaufs, wenn alle Angaben stehen: die Restnutzungsdauer rechnen, das Ergebnis zeigen und sagen, ob sich ein Gutachten lohnt. Dann „jetzt anfragen". **Automatisch rechnen, nicht fragen, ob gerechnet werden soll** — der Vorschlag kommt mit einer Zahl, nicht mit einer Frage. Passt an den vorhandenen Abschluss (`_rfAbschluss`, v1377-Nachfassrunde davor). |
| **R4** | **Die Anfrage erzeugt eine Datei mit dem Gesamtobjekt** | **Das Format ist nicht frei — es steht fest.** `calculator_adapter.from_calc_engine()` erwartet Top-Level `{state, r, nhkTyp, stuBeschreibungen, wortlaut}`; die RND-Verfahren liest es unter `r.sachwert.koerper[i].rnd` und aus `methods.*`. Also **kein eigenes Format erfinden, sondern genau diesen Dump erzeugen** — dann liest Marcels Reporting ihn ohne Anpassung. Dazu kommt, was der Sprechlauf beisteuert und das Reporting noch nicht kennt: die Herkunft je Feld (`_rf.quelle`, seit v1311 im Objekt) und die beiden Scores. Beides gehört in einen **eigenen Zweig**, nicht in `objekt.*` — das Paket trennt Corporate, Objekt und Gutachten strikt. Vorlage für den Aufbau: `data/example_report.json`. |
| **R5** | **Zweiter Weg: Deal-Aktion → Netzwerk → Junker Immobilien** | Dieselbe Anfrage aus der Partnerkarte heraus. **Nachrangig** — Marcel: „überwiegend würde ich mir das jetzt erst mal im Sprechlauf wünschen." |

**Zwei Dinge, die vor dem Bauen entschieden sein müssen:**

- **Wohin geht die Anfrage?** Eine Mail an Marcel mit Anhang ist der einfache
  Weg. Ein Versand geht nie ungefragt raus — der Nutzer sieht, was verschickt
  wird, bevor es verschickt wird.
- **Was ist der Auslöser für „lohnt sich"?** Eine RND, die deutlich unter der
  Modell-RND liegt, ist ein Grund; eine, die darüber liegt, nicht. Die Schwelle
  gehört Marcel (Sachverständiger), nicht dem Code.

### D · MARKTBERICHT UND ERNTE — Übernahme aus der Cowork-Sitzung

Marcel: *„Da habe ich das letzte Paket, das hatte ich noch ganz normal in
Claude entwickelt und nicht hier im Terminal. Ich möchte gerne, dass wir das
übernehmen und ins Backlog die Sachen schreiben, die hier offen sind."*

Die Übergabe liegt in `Dateien/` (`00-EINBAU.md`, `01-backlog-block.md`,
`integration-marktbericht.zip` mit fünf Blöcken,
`uebergabe-claude-code-20260908.zip` mit dem Paket v1097 und dem C2-Prüfstand).

**Der ganze Block steht unten unter „Marktbericht / Ernte (Workstream D)"** —
eingebaut am 13.09.2026, Format an diese Datei angepasst.

**Am laufenden Staging nachgemessen, bevor eingetragen wurde** (der Block war
gegen den Stand vom 30.08. geschrieben):

```
v1097 eingespielt?      NEIN — beide ETW-Sperren stehen noch
                        (wertermittlung.js + KiGegenrechnungService.js)
GND_JAHRE = 80          steht noch (CrossCheckService.js Z. 24)
BAUPREISINDEX = 2.02    steht noch (Z. 22)
Register                2158 Sätze, 8 Länder
                        {"NW":1109,"BE":2,"ST":2,"TH":2,"NI":48,"BY":1,"HE":2,"BB":2}
```

Also: **fast alles davon ist wirklich noch offen.** Der Haupt-App-Strang hat
seit dem 30.08. am Marktbericht gearbeitet (v1332–v1341, Marcels Liste vom
12.09.), aber an anderen Stellen — Oberfläche, Feldbeschreibungen,
Erbbaurechtskoeffizienten. Der Rechenkern und die Ernte sind unberührt.

---
### 1 · Zwei Wünsche aus dem 10.09., die noch offen sind

**„Die KI muss alles raushören und nachfragen."** Teilweise da: seit `v1290`
hakt der Co-Pilot nach, wenn er nur einen Teil eines Blocks verstanden hat
(„Das habe ich. Fehlt noch: Hausnummer"), und ein offen endender Satz wird
gemerkt statt ausgewertet. Was fehlt, ist das **Heraushören von Angaben, die
gar nicht gefragt waren** — wer bei der Miete schon das Baujahr mitnennt, soll
es behalten dürfen. Heute filtert `_rfUebernehmen` auf `e.ids`, also auf das,
wonach gefragt war. **Aufwand:** klein. **Vorsicht:** die Filterung war
Absicht — sie verhindert, dass ein Modell Felder rät, die im Satz nicht
vorkommen. Der Weg wäre, den Katalog um die *nächsten* Blöcke zu erweitern
statt um alle.

**„Unter Deal-Aktion die Werte einbeziehen."** Der Break-even ist drin
(`IrrEngine.breakEven`, dieselbe Rechnung wie die Kennzahlen-Kachel). Was der
Sprechlauf noch nicht liest, sind die übrigen Größen aus dem Deal-Aktion-Modul
— IRR, Exit-Erlös, Restschuld am Ende der Zinsbindung. Sie brauchen die volle
`calc()`-Kette und damit ein gefülltes Formular; im Sprechlauf gibt es das
bewusst nicht. **Zu klären:** ob eine Näherung dafür reicht, oder ob diese
Zahlen erst nach der Übernahme gehören.

### 2 · Echtes Sprechen abnehmen — das kann nur Marcel

Die Reparatur des Freisprechens (`v1290`) ist am Kern **bewiesen**: der
WebM-Header überlebt den Ringpuffer, der Recorder läuft durch, und
`[kopf].concat(chunks)` ergibt `1a 45 df a3` — eine gültige Datei. Gemessen
mit einem synthetischen Audiostrom im Browser.

**Was ein automatisierter Browser nicht kann, ist sprechen.** Diese Punkte
bleiben ein Abnahmepunkt:

- Löst die Stillepause von **1,6 s** bei einer echten Denkpause noch aus?
- Wird ein **Nachschlag** („… ähm … in Hüllhorst") wirklich an dieselbe Frage
  gehängt?
- Greift die Erkennung des **offenen Satzendes** bei echten Transkripten?

Wenn dabei wieder etwas hakt: die Konsole trägt jetzt `[voice]`-Zeilen mit dem
Grund, und `window.VoiceImport._fsStand()` zeigt Phase, Kopf, Chunks und den
gemerkten Satzanfang.

### 3 · Die Sprachqualität messen — mit echtem Material

`OPENAI_TRANSCRIBE_MODEL`: **auf Staging steht seit dem 09.09. das mini**, auf
Prod weiterhin das große `gpt-4o-transcribe` (dafür fehlt die Freigabe).

**Über die Qualität ist damit nichts gesagt.** Dieselbe Datei ergab bei zwei
Läufen desselben Modells zwei verschiedene Ortsnamen — Transkription ist nicht
deterministisch. Wer das entscheiden will, braucht eine **Messreihe mit echten
Diktaten**, keinen Einzellauf.

**Der Sprechlauf liefert das Material.** Sobald Marcel ihn ein paar Mal
gesprochen hat, ist die Reihe da.

Die Zahlen dahinter: mini kostet die Hälfte (3,00 statt 6,00 USD je Mio
Audio-Token) und ist 37 % schneller (1864 ms gegen 2944 ms). Der Wechsel senkt
die Kosten einer Aufnahme um rund 40 % — bei 4 Minuten von ≈ 1,7 auf ≈ 0,9 Cent.

### 5 · Der Gold-Altbestand

468 Fundstellen sind als Basislinie eingefroren, der Wächter meldet nur noch
Neues. Abgetragen wird, wenn eine Datei ohnehin angefasst wird. Vor dem ersten
echten Whitelabel-Kunden gehören `pricing-modal.js` (53),
`reseller-portal.js` (43) und `qc-bridge.js` (39) gezielt nachgezogen.

### 6 · Doppelte Plausibilitätsprüfung

Marcels Wunsch vom 08.09., **zurückgestellt**. Der Code liegt vollständig da,
`OPENAI_VOICE_VERIFY=1` schaltet ihn an.

### 7 · IRR/Break-Even ins Portfolio-Cockpit — GEMESSEN, größer als gedacht

**Teilweise erledigt** — sie stehen in den Kennzahlen-Kacheln (Reiter
Bewertung); im Portfolio-Cockpit noch nicht.

**Am 02.10.2026 gemessen, warum das kein Einzeiler ist:**

**1 · Die Werte sind am Objekt gar nicht gespeichert.** Ein Objekt trägt
sechs KPI-Felder:

```
_kpis_bmy · _kpis_bwk_y · _kpis_cf_ns · _kpis_cf_vs · _kpis_dscr · _kpis_ltv
```

`calc.js:2654` **berechnet** `irr`, `be_cf`, `be_kum` und `be_kum_ek` — sie
landen aber nicht am Datensatz. `aggStats()` im Cockpit arbeitet mit genau
diesen gespeicherten Feldern; es hat also gar keine Grundlage.

**2 · Und ein Portfolio-IRR ist kein Mittelwert.** Er lässt sich nicht aus
den Einzel-IRRs gewichten wie die Nettorendite, die `aggStats()` korrekt
nach Kaufpreis gewichtet. Der interne Zinsfuß über mehrere Objekte braucht
die **zusammengelegten Zahlungsströme** — Jahr für Jahr, über alle Objekte,
inklusive Anfangsauszahlung und Exit.

> Zwei Objekte mit je 8 % IRR ergeben zusammen nicht 8 %, wenn ihre
> Zahlungen zu verschiedenen Zeiten fallen. Ein gewichtetes Mittel wäre
> eine Zahl, die nirgends herkommt.

Dasselbe gilt für den Break-Even: er ist das Jahr, in dem der KUMULIERTE
Cashflow über alle Objekte positiv wird — nicht der Durchschnitt der
einzelnen Break-Even-Jahre.

**Was der Bau also braucht (drei Schritte, in dieser Reihenfolge):**

| | |
|---|---|
| 1 | `irr`, `be_cf`, `be_kum`, `be_kum_ek` **und die Zahlungsreihe** am Objekt mitspeichern (`State._irrReihe` steht schon, nur für das aktive Objekt) |
| 2 | Im Cockpit die Reihen **addieren**, nicht die Ergebnisse — Jahr für Jahr |
| 3 | `window.IrrEngine.compute()` auf die Summenreihe. **Kein eigener Rechenweg** — die Engine ist die Quelle (CLAUDE.md: Rechenkerne nie duplizieren). |

**Nicht gebaut**, weil ein gewichtetes Mittel schnell gegangen wäre und
eine Zahl ergeben hätte, die fachlich falsch ist. Ein Portfolio-Cockpit,
das einen erfundenen IRR zeigt, ist schlechter als eines ohne.

### 8 · Der Einzelkauf — welche Fassung?

`design/Vorschläge/einzelkauf-demo.html` zeigt drei Wege, die eine fehlende
Bewertung zu verkaufen:

| | Variante | wirkt |
|---|---|---|
| **A** | ruhige Liste unter dem Nachkauf | überall, auch ohne Anlass |
| **B** | am Fehlerpunkt in der Aktionsleiste | genau dann, wenn das Kontingent leer ist |
| **C** | Kacheln | — |

**Empfehlung: A und B, C weglassen.** A ist gebaut und liegt seit `v1294`
live auf Staging (Preis-Modal und Einstellungen). **B fehlt noch** — wenn
der Sprechlauf am leeren Kontingent hängt, steht dort heute nur die
Meldung, nicht der Ausweg.

**BLOCKIERT:** wartet auf Marcels Wahl aus der Demo. Geld und Optik —
das entscheidet er.

### 9 · Der Sprechlauf: Marcels Auftrag vom 11.09. — Rest

Erledigtes s. Fertig. Offen sind zwei Läufe gegen echte Daten:

- **a)** voller Lauf mit einer echten erweiterten Marktpreisindikation (kostet Kontingent).
- **d)** Lauf gegen ein echtes ImmoMetrica-Testobjekt.

Marcels Maßstab: „Das muss wirklich hundertprozentig werden."

### 10 · Was uns eine Bewertung im Einkauf kostet — ungeführt

**Es gibt keine Einkaufspreisliste.** Die einzigen Kostenzahlen im ganzen
Repo stehen in einem Kommentar, der ausdrücklich als *„STILLGELEGT v1183"*
markiert ist (`backend/src/routes/avm.js:92`):

> PriceHubble 40 L (Kosten 6 EUR), Sprengnetter 20 L (Kosten 3 EUR, 2 API-Calls)

Aus der Kerosin-Zeit, nie gegen einen aktuellen Vertrag nachgeführt. Für
`mpi` / `mpi_plus` / `wev` gibt es **gar keine** Zahl; sie kosten real nur
KI-Token (`gpt-4.1-mini`) und liegen erfahrungsgemäß im Zehntel-Cent-Bereich.

**Was fehlt:** die echten Vertragspreise je Abruf. Die hat nur Marcel. Mit
ihnen entsteht eine Übersicht, die je Posten Verkaufspreis, Einkauf und Marge
zeigt — an **einer** Stelle, so wie die Verkaufspreise in `config.js`.

**BLOCKIERT:** braucht Marcels Vertragszahlen.

### 11 · Vor dem Prod-Rollout: wem nimmt der Verfall etwas? (Stand unklar, am 25.10.2026 nicht nachgemessen)

`v1296` dreht die Regel um — das Monatskontingent verfällt, nur Gekauftes
bleibt. Auf Staging ist das ohne Folgen (Testkonten). **Auf Produktion ist
ungezählt, wie viel angespartes Guthaben in `mpi_bank` / `mpi_plus_bank` /
`wev_bank` liegt.**

Der bestehende Bestand bleibt bewusst stehen (siehe Journal), es geht also
niemandem etwas verloren. Trotzdem gehört die Zahl vor dem Rollout auf den
Tisch: wer bisher angespart hat, wird ab dem nächsten Monatswechsel **nichts
Neues** mehr ansammeln, und das ist eine Änderung an einer Zusage.

```sql
SELECT COUNT(*) FILTER (WHERE mpi_bank + mpi_plus_bank + wev_bank > 0),
       SUM(mpi_bank), SUM(mpi_plus_bank), SUM(wev_bank)
  FROM ai_credits_user;
```

**BLOCKIERT:** der Lesezugriff auf die Prod-Datenbank ist in dieser Sitzung
abgelehnt worden. Marcel kann die Abfrage selbst fahren oder den Zugriff
freigeben.

---

## → Erledigt am 11.09.2026, vierter Teil (`v1297`–`v1299b`)

Erledigtes s. Fertig. Offen aus dieser Runde (Stand unklar, am 25.10.2026 nicht nachgemessen):

- Die Score-Karte im echten Durchlauf nachmessen (nur die Breitenregel ist geprüft, es braucht eine volle Etappe 2).
- „Ich höre nichts" wurde als Layout-Punkt gelesen — falls das Mikrofon gemeint war, ist das ein eigener offener Befund.

## → Frühere Notizen (Stand 09.09.2026)

Erledigtes s. Fertig. Reste (Stand unklar, am 25.10.2026 nicht nachgemessen):

- Kontextbezug im Sprechlauf: Hausgeld-Aufteilung und Inventar sitzen, weitere Fälle offen.
- Kosten weiter senken: Feldkatalog kürzen (über 6.000 von ~6.200 Eingabe-Token sind Katalog).
- Transkriptionsmodell auf Prod, IRR/Break-Even im Portfolio-Cockpit, Gold-Altbestand, doppelte Plausibilitätsprüfung — s. Punkte 3, 7, 5, 6 oben.

---

## → ARCHIV: Übergabe 07.09.2026, abends

Erledigtes s. Fertig. Reste (Stand unklar, am 25.10.2026 nicht nachgemessen):

- **Entscheidung Marcel offen:** zwölf verwaiste Preise im Testmodus des Stripe-Hauptkontos archivieren; die 8 Objekte ohne Grundbuchamt-Prozentsatz bzw. mit Deckungslücke (`2026-001`: 20.400 €) nachtragen; Mietausfall-/BWK-Quoten als Profileinstellung je Lage; Zustand in der KI-Marktmiete („für den Zustand zu hoch").
- `calc.js` schreibt in `cr-wk-other`/`cr-zve-ohne`, die es im DOM nicht gibt (V258-07): Zeile bauen oder Hook entfernen — Produktfrage.
- `business`/`enterprise` in der Prod-Datenbank (B11) — wartet auf ein Ja.
- Fünf Fragen an den Steuerberater (reicht die Form, oder braucht er einen DATEV-Buchungsstapel?).
- Testmaterial auf Staging: Mandant „Test UG (v1226)" als Halter von „Am Markt 9 Kabelsketal".
- Sprechlauf am Gerät für `v1168`/`v1169`/`v1170`/`v1231` (Tempo und Feldzuordnung).

---

## → ARCHIV: Übergabe 02.09.2026, nach dem Prod-Rollout

Erledigtes s. Fertig. Reste (Stand unklar, am 25.10.2026 nicht nachgemessen):

- **Entscheidung Marcel offen:** Score-Konvention für fehlende Teilwerte (`v1197`: neutral ersetzen — so gebaut — oder weglassen und hochnormieren).
- **Entscheidung Marcel offen:** „Aussagekraft: Mittel · 59 %" steht in 01 (Score) und 03 (Marktwert) — Dopplung oder zwei Angaben?
- **Entscheidung Marcel offen:** „Solide" zweimal nebeneinander (Ring und Überschrift).
- 402-Pfad unter echten Bedingungen nicht end-to-end bewiesen; ein echter Kauf auf dem reparierten Weg nie durchgelaufen.
- Eine echte Erinnerungsmail ist noch nie rausgegangen.

## → ARCHIV: Übergabe 2026-08-31, nach dem Prod-Rollout

Erledigtes s. Fertig. Reste (Stand unklar, am 25.10.2026 nicht nachgemessen):

- Echte Erinnerungsmail der Testphase (Halbzeit/Ablauf) ist nie rausgegangen — Blick ins Postfach.
- Der Plan-Wechsler kennt Partner nicht (`is_public=false`) — ein Partner findet weder seinen Plan noch einen Weg heraus.
- `#set_user_name` braucht `autocomplete="off"` (Chrome füllt die E-Mail, Auto-Save) — am 25.10.2026 im Markup von `settings.js` noch ohne.
- ERSTFLUG-Preise 16,79 / 33,59 / 67,19 im sichtbaren Fenster mit eigenen Augen prüfen (rAF läuft im verborgenen Tab nicht).
- **Entscheidung Marcel offen (Geld):** darf ein Free-Nutzer einzelne Bewertungen kaufen? Plan-Wechsel im Stripe-Portal (bräuchte eine Produktliste)?

---

## → Hier weitermachen (Übergabe 2026-08-13)

Erledigtes s. Fertig. Reste (Stand unklar, am 25.10.2026 nicht nachgemessen):

- **Entscheidung Marcel offen:** Punkt 3 (damals 1) Teil B — wie wird der Score flacher; braucht ein Bild. Die Score-Zeile erscheint erst ab 70 % Datenvollständigkeit (`calc.js:205`).
- Prüfstrecken auf Staging: `PRUEF_ZFH Löhner Str. 278` (`3fbb754c`, EFH, Stufe 3 bezahlt) und `Hermannstraße 9 Hüllhorst` (`07d89138`, ETW, Stufe 3 bezahlt) — die bezahlte Stufe gilt nur für `info@junker-immobilien.io`.

## Offen

### N33 · ENTSCHEIDUNG MARCEL: Ist die Aktenmappe hell oder dunkel? (eingebaut 06.10.2026)

**Nur Marcel kann das entscheiden, und solange es offen ist, wird keine Farbe
angefasst.** Beide Seiten sind gemessen, nicht geraten:

| | spricht dafür |
|---|---|
| **hell** | Die Vorlage, aus der die Aktenmappe stammt, heißt `frontend/entwurf-hell-bankfaehig.html` („Heller Modus — fünf Entwürfe", Entwurf 1 — Aktenmappe) und ist durchgehend hell: Schiene weiß mit dunkler Schrift, Fläche rgb(232,229,222). Marcel nennt das Obsidian der Schublade „den Hintergrund von Heute". Der Panel-Text versprach bis v1889 „Jede Ansicht ausser ‚Heute' schaltet auf hell". |
| **dunkel** | Seit v1653e ist genau das Gegenteil gebaut und über zwanzig Versionen abgenommen: Obsidian-Schiene auf heller Arbeitsfläche. `layout-varianten.css:1643` und `:1737` heben sich mit (1,4,3) `!important` **ausdrücklich über** `body.dp-chrome-hell` — der dunkle Rahmen ist eine Entscheidung, kein Versehen. v1699 hat den Hell-Zwang auf Marcels Ansage entfernt. |

**Was es kostet, wenn „hell" gewinnt** (gemessen, nicht geschätzt): der helle
Skin allein reicht **nicht**. Mit `dp_chrome_hell=1` **vor** dem Laden bleiben
`#sidebar`, `.dpl-schiene`, `header.hdr` und `nav.tabs` auf `rgb(14,13,11)`.
Zu tun wären dann:

1. die beiden Sperrblöcke `layout-varianten.css:1643` (Seitenleiste) und
   `:1737` (Kopf) dem Ton unterordnen statt ihn zu überschreiben,
2. elf farbtragende Flächen der Handy-Schublade einzeln benennen (Rahmen,
   `.sb-section-title`, `.sb-search-box` + `input`, `.sb-sort-toggle`,
   `.sb-add-new`, `.sb-card` + hover/active, `.sbc-top`, `.sbc-address`,
   `.sbc-seq`, `.sbc-kp`, `.sbc-btn`, Registerfarben),
3. der generierte Block aus `tools/schublade-regeln.mjs` (93 Grund- + 48
   Stilregeln) klont **tonfreie, hart dunkle** Werte — er müsste eine helle
   Fassung mitbekommen, sonst zieht er die dunkle zurück.

**Kein eigener Umbau ohne Marcels Wort.** Die strukturelle Trennung
(Register in der Schublade, Zustände, wischbare Tabelle) steht seit
`v1889`–`v1889e` und ist unabhängig davon richtig.



### MARCELS ANTWORTEN VOM 2026-08-14 — Rest: Score flacher

- **Offen nur noch 4 · Score flacher (damals Punkt 1B):** Marcels Rückfrage „welches Score Bild?“ — gemeint ist eine Vorgabe, wie die Score-Zeile in der Kopfleiste flacher aussehen soll. Vorher messen: die Zeile erscheint erst ab 70 % Datenvollständigkeit (`js/calc.js:205`); ein Objekt über der Schwelle laden, echte Höhe messen, dann fragen.
- Garagenfeld, Akzentfarbe, Wallet und Speichern-Modal sind erledigt, s. Fertig.

### OFFENE ABNAHME — Spracheingabe, ein Sprechlauf am Gerät (Stand unklar, am 25.10.2026 nicht nachgemessen)

**Marcel macht das später, der Punkt bleibt bis dahin stehen.** Drei
Änderungen warten auf genau einen echten Sprechlauf, weil sie ohne Mikrofon
nicht prüfbar sind:

| Version | Was geprüft werden muss | Wenn es klemmt |
|---|---|---|
| `v1168` | Häkchen `san_tax_active` — taucht es in der Import-Tabelle auf, wenn eine Sanierungs-AfA genannt wird? | Nur JA kommt durch; ein „nein" wird bewusst verworfen |
| `v1169` | **Das Stichwort-Fenster** — bleiben es neun, verschwindet ein erkanntes nach ~1 s, rückt eins nach? | `CHIP_FENSTER = 9` und `CHIP_NACHLEUCHTEN = 900` stehen direkt beieinander in `voice-import.js` |
| `v1169`/`v1170` | **Das Tempo** — Diarisierung raus, Verifikations-Pass aus. Zwei Modelle statt vier | Qualität schlechter? `OPENAI_VOICE_VERIFY=1` + Rebuild holt den Pass zurück |

**Worauf beim Sprechlauf zu achten ist:** Nicht nur, ob es schneller ist,
sondern ob die **Zuordnung** noch stimmt — der Verifikations-Pass hat bisher
falsch zugeordnete Zahlen und verwechselte Felder abgefangen. Genau dort
zeigt sich, ob sein Wegfall zu teuer war.

**Der letzte verbliebene Tempo-Hebel** wäre `gpt-5.5` in der Feldauswertung.
Vorher messen, wie viel Zeit auf Transkription und wie viel auf Auswertung
entfällt — nicht raten.

> ### Die Nummern sind am 30.08. neu durchgezählt
>
> Vier Punkte sind fertig geworden (die alten 4, 5, 10 und 11), **fünf** neue
> sind dazugekommen. Aus 1–11 mit Lücken wurde **1–13 ohne Lücke**.
>
> | alt | neu | | alt | neu |
> |---|---|---|---|---|
> | 1 Tablet | **3** | | 7 Spracheingabe | **7** |
> | 2 Handy-Befunde | **4** | | 8 Sachwertfaktor | **11** |
> | 3 Marktbericht | **5** | | 9 Objektnummer-Kontrast | **12** |
> | 6 Pläne durchtesten | **6** | | 10 Wallet am Handy | **13** |
>
> Neu sind **1** (Preismodell), **2** (Preis-Einordnung), **8**
> (Testbericht), **9** (Steuer-Mappe) und **10** (Cockpit-Kennzahlen).
>
> **In den Blöcken oben („Hier weitermachen", „Marcels Antworten") und unter
> „Fertig" stehen weiter die ALTEN Nummern** — das sind Protokolle eines
> Tages, die man nicht rückwirkend umschreibt. Wo es zu verwechseln wäre,
> steht der Zusatz „damals N".
>
> **Am 01.09. noch einmal:** die Tablet-Fassung (Punkt 1) ist nach Fertig
> gewandert, aus 1–11 wurde **1–10**. Jede Nummer rückt um eins vor:
> Handy-Befunde 2 → **1**, Marktbericht 3 → **2**, Pläne 4 → **3**,
> Spracheingabe 5 → **4**, Testbericht 6 → **5**, Steuer-Mappe 7 → **6**,
> Cockpit 8 → **7**, Sachwertfaktor 9 → **8**, Objektnummer 10 → **9**,
> Wallet 11 → **10**.
>
> **Und am selben Tag ein drittes Mal:** die Handy-Befunde (1) und der
> Wallet-Ring (10) sind beide zu — es war **derselbe Täter**, siehe
> `v1191`/`v1192` unter Fertig. Aus 1–10 wurde **1–8**: Marktbericht
> 2 → **1**, Pläne 3 → **2**, Spracheingabe 4 → **3**, Testbericht
> 5 → **4**, Steuer-Mappe 6 → **5**, Cockpit 7 → **6**, Sachwertfaktor
> 8 → **7**, Objektnummer 9 → **8**.

1. **Marktbericht neu gestalten.** — Rest (Wizard, Meilenstein-Ampel, Geldfragen, Handy-Fassung und PDF-Vermerke erledigt, s. Fertig)

   - **Hinweistext beim eigenen Sachwertfaktor:** `WertParameterService.js` gibt bei eigener Angabe weiter `hinweis: ''` (am 25.10.2026 gegrept, Z. 800). Vorher den Anzeigeweg bauen — die Karte zeigt `sachwertfaktor_hinweis` nur bei `sw.available && !sw.marktangepasst` (`app.js`), bei wirksamem eigenen Faktor also nirgends.
   - **Abgleich eigene ↔ amtliche Angabe** — eigenes Vorhaben, hängt daran, dass `mb.valuation_inputs` überhaupt beschrieben wird.
   - Randbedingungen: Pflichtfelder je Stufe nur in `BEDARF` (`mb-stufen.js`), keine zweite Liste; `payload()` in `wertermittlung.js` bleibt die Sammelstelle.

2. **Alle Pläne einmal durchtesten: Starter, Investor, Pro, Partner** — Rest (Prüflauf, Durchklicken, B7, B8, B9, B15 erledigt, s. Fertig)

   - **B3/B12/B13:** was in der Plan-Zeile der DB fehlt, ist für jeden `false` — der `config.js`-Rückfall ist tot (`hasCachedFeature` liefert nie `null`). Tote/doppelte Schlüssel `export_pdf`, `bank_pdf_premium`, `bank_pdf_normal` aufräumen oder jeden Schlüssel in jedem Plan explizit führen.
   - **B5:** `pricing-modal.js` führt die 31-zeilige Matrix zweimal (Escapes / echte Zeichen).
   - **B10:** die Testphase (28 Tage Pro) ist auf Prod noch nie gelaufen — beim ersten echten Neukunden prüfen.
   - **B11:** `business`/`enterprise` stehen auf Prod noch in `plans` (auf `business` nur das Demokonto `demo@dealpilot.local`) — DB-Eingriff, Freigabe Marcel.
   - **B14:** `beleg-import.js` fragt `DealPilotConfig.hasFeature` (gibt es nicht) → kein Frontend-Gate, nur Backend-403 (am 25.10.2026 noch so).
   - **Backend-Durchsetzung** gesperrter Funktionen per Hand-Aufruf ist nicht gemessen.

3. **Spracheingabe soll alle Felder füllen — Pre-Flight und QuickBoarding** — Rest (Katalog, Checkboxen, Speichern-Modal und Sanierungsbedarf erledigt, s. Fertig)

   - **16 Datenfelder noch nicht im Auswertekatalog:** fünf § 7b (`afa_sonder7b_*`), fünf Erwerbsnebenkosten in Euro (`makler_e` … `ji_e`; die Prozentfelder gehen) und die Schalter der zweiten Finanzierung (`d2_*`, `d1_anschl_enable`, `inv_tax_*` …).
   - **Abnahme `v1231`:** ein echter Sprechlauf, bei dem „Dach neu, fünfzehntausend“ dem Sanierungsbedarf zugeordnet wird — nicht geprüft.

---

4. **Der Testbericht: Bedienführung und Verständlichkeit.**
   **Quelle: `design/mockups/Anmerkungen.docx`** (abgelegt 2026-08-30, 24
   Bildschirmfotos mit Anmerkungen, entstanden bei einer Objektanlage von
   Anfang bis Ende). **Fremdbefund — hier ungeprüft übernommen**, außer wo
   ausdrücklich „geprüft" steht. Die Bilder liegen im Dokument in
   derselben Reihenfolge wie die Punkte unten.

   ### Vollständigkeit geprüft am 01.09.2026 — auf Marcels Frage

   **Der Text der `.docx` wurde ausgepackt und Zeile für Zeile gegen das
   Backlog gehalten.** Sie enthält **49 Anmerkungen** (dazu zwei
   Kontextzeilen mit den Beträgen und drei Überschriften). **Alle 49 sind
   erfasst**, verteilt auf:

   | Anmerkungen | wo |
   |---|---|
   | 25 zu Boarding, Feldern, Miete, Finanzierung, Steuer, QuickBoarding | dieser Punkt, Blöcke **A–I** |
   | Lage-Strategie als Profil · „Verloren" rausnehmen | dieser Punkt, Block **J** |
   | *„Tool hat super viele Funktionen … USP muss definiert werden"* | dieser Punkt, der **Kasten oben** |
   | 5 fehlende Cockpit-Kennzahlen | **Punkt 6** (Portfolio-Cockpit) |
   | *„Bezahlmodell: zweite Währung sollte unbedingt raus. Wirkt undurchsichtig."* | **erledigt** — Kerosin abgeschafft, `v1176`/`v1183`, siehe Fertig |
   | Exposé 129.000 € gegen DealPilot 177.000 € → *„Deutlich über Marktwert? sollte das nicht unter Marktwert sein?"* | **erledigt** — `v1178`, das Vorzeichen war vertauscht |

   > **Zwei Punkte des Berichts sind also schon gebaut, und zwar die zwei
   > schwersten** — das Preismodell und ein echter Rechenbefund. Bei beiden
   > stand bisher nicht, dass sie aus diesem Bericht stammen; wer nur nach
   > „Anmerkungen.docx" suchte, hätte sie für offen gehalten.

   **Wie der Text ausgepackt wurde** (es gibt lokal kein Python und kein
   Node): PowerShell, `System.IO.Compression.ZipFile` auf `word/document.xml`,
   `</w:p>` zu Zeilenumbruch, dann alle Tags weg. Word-Kommentare gibt es
   keine — `word/comments.xml` fehlt im Archiv, die Anmerkungen stehen als
   normaler Text zwischen den 25 Bildern.

   > **Vor dem Abarbeiten: der Satz, der über allem steht.** Der Tester
   > schreibt zum Schluss: *„Tool hat super viele Funktionen. Ich weiß aber
   > nicht, ob ich das wirklich regelmäßig nutzen würde, sehr viele
   > Eingabefelder und teilweise noch etwas verwirrend. … USP muss definiert
   > werden und meiner Meinung nach dann darauf starken Fokus setzen."*
   > **Das ist keine Liste von Kleinigkeiten, das ist ein Befund über das
   > Ganze.** Wer die Punkte unten einzeln abräumt, ohne diese Frage zu
   > beantworten, macht die App gründlicher — nicht einfacher.

   **A · Einstieg**
   - ~~Nach dem Einloggen zu viele verschiedene Knöpfe. Vorschlag des Testers:
     ein „Reisebegleiter"-Fenster beim ersten Mal, mit Haken „nicht mehr
     anzeigen".~~ **ERLEDIGT `v1239` (`24bdca8`).**

     > **Der Satz hier war falsch.** Es stand: *„Die Tour gibt es, sie ist nur
     > im Hilfe-Bereich versteckt — es geht also ums Anbieten, nicht ums
     > Bauen."* Gemessen: **die Tour startete von selbst**, 2,5 Sekunden nach
     > dem Laden, einmal pro Browser. Sie war nicht versteckt, sie war
     > **aufdringlich** — und genau das bemängelt der Bericht.

     Marcels Vorgabe: *„nicht jedes mal anbieten … Modal wo man sagen kann
     Tour nicht mehr anbieten."* Gebaut mit drei Regeln:
     **es fragt statt zu starten**, der Haken schaltet dauerhaft ab, und
     **nach drei Angeboten hört es von selbst auf** — höchstens eins am Tag.
     Wer den Haken nie findet, wird trotzdem in Ruhe gelassen. Beim letzten
     Angebot steht dabei, dass es das letzte ist.

     Alle vier Fälle auf Staging durchgespielt (Angebot · „Später" · selber
     Tag · nächster Tag · Haken · Tag danach), Marcels Tour-Merker danach
     wiederhergestellt.
   - **Von dort auch auf die Hilfe-Videos verweisen.** ← noch offen

   **B · Boarding-Pass und Exposé-Übernahme**
   - **Zustand und Qualität werden doppelt abgefragt** — verwirrend, muss das
     sein?
   - Ein wichtiger Bereich war **eingeklappt**, obwohl er zentral ist.
   - **Die Investitionsthese wird abgefragt** — *„mache ich das Boarding nicht
     gerade, um die Investition zu bewerten?"*
   - Aus dem Exposé ließe sich mehr übernehmen: *„der Boden muss ersetzt
     werden, die Wohnung ist teilweise renovierungsbedürftig"* steht dort im
     Text.
   - **Der Wertpuffer steht zu weit unten** — er gehört nach oben. (Ist damit
     das Delta der Bewertung gemeint? Der Tester ist sich nicht sicher.)
   - **`DS2` als Abzeichen sagt nichts.** Wenn es wichtig ist, gehört eine
     Erklärung daneben.
   - **Makrolage „Durchschnittlich" ohne Herkunft**: kam das automatisch aus
     dem Exposé? Bevölkerungsentwicklung und anderes stehen leer. **Es fehlt
     der Hinweis, dass aus dem Exposé nichts zu holen war.**
   - Die KI-Abfrage gehört **oben** in den Bereich, wenn nicht automatisch
     gefüllt wird.
   - **Grundsatzfrage:** kommen die Werte erst aus dem Exposé und werden dann
     per KI geschärft? *„Wie ist der Prozess gedacht?"* — die Antwort darauf
     entscheidet mehrere Punkte oben.
   - Notizfeld neben Risiken und These: **was soll da rein?**

   **C · Die Wertermittlungs-Felder**
   - *„Braucht es so viele Felder für die Bewertung einer ETW?"*
   - **NHK-2010-Standardstufe und Sachwertfaktor sind unerklärt** — woher soll
     ein Anwender das wissen?
   - **Stellplatzmiete wird abgefragt, die Kaltmiete nicht.**
   - **Hausform „Mehrfamilienhaus" nicht anklickbar** — ist der Bereich für
     ETW gedacht?
   - *„Was genau sind die Stufen?"* — braucht eine einfache Erklärung.
   - Vorschlag: vorher fragen, **wie ausführlich** der Anwender eingeben will,
     oder die Bereiche auf- und zuklappbar machen.

   **D · Investition**
   - ~~**Grundbuchamt mit 0,5 % vorbelegen**~~ — **ERLEDIGT `v1238`
     (`4bf9ed6`), und es war mehr als Bequemlichkeit.** Gemessen:
     `setDefaults()` setzte Notar 2,20 %, Grunderwerbsteuer 6,50 % und
     Sonstige 1,50 % — **`gba_p` stand als einzige der fünf
     Erwerbsnebenkosten gar nicht drin.** Das Feld trug nur
     `placeholder="0,5"`: sieht aus wie ein Wert, zählt als nichts.
     **8 von 13 Objekten auf Staging rechneten mit 0 € Grundbuchamt** — bei
     200.000 € Kaufpreis fehlen 1.000 € in der Gesamtinvestition.
     **Kein Gestaltungspunkt, eine fehlende Zahl.**
     Die Vorbelegung greift nur für **neue** Objekte (`setDefaults()` läuft
     in `newObj()`); bestehende behalten ihren Wert, ihre Zahlen verschieben
     sich nicht rückwirkend. **Am laufenden System gegengeprüft:**
     `2026-001` unverändert leer, neues Objekt trägt 0,5.
     > **Offen und Marcels Entscheidung:** die 8 Objekte ohne Wert stehen
     > weiter auf 0. Nachtragen hieße, ihre Renditen und Scores zu
     > verschieben — das macht niemand ungefragt.
   - ~~**„Sonstiges 1,5 %" benennen**~~ — **ERLEDIGT `v1238`.** Die Erklärung
     (Bausachverständiger, Anfahrt, Gutachten) gab es bereits, aber **nur als
     `title`-Tooltip**. Sie steht jetzt sichtbar am Label, und beim
     Grundbuchamt steht sichtbar, dass 0,5 % eine Vorbelegung ist.
   - **Hinweis, was danach passiert** — dass die Werte in die
     Steuerprogression gehen und am Ende den Cashflow über alle Investitionen
     bestimmen.
   - **Oben stehen schon Haken, obwohl der Bereich nie besucht wurde.**

   **E · Miete**
   - **Marktmiete ohne KI zu niedrig; mit KI 10,99 €/m² — für den Zustand
     aber eher zu hoch. Er sieht als Quelle nur den Mietspiegel.**
     **GEMESSEN am 07.09.2026, aber NICHT gebaut — es ist eine
     Bewertungsfrage.** Die Recherche läuft über `/api/v1/ai/ds2-suggest`,
     und die Antwort trägt **eine** Quelle je Vorschlag (`source`, Einzahl);
     `ki-miete.js:174` zeigt sie als „📎 Quelle: …" an. Es wird also nichts
     unterschlagen — es gibt nur eine.
     **Zwei Dinge stecken darin, und beide gehören Marcel:**
     1. **Soll die Recherche mehrere Quellen nennen?** Das ändert den Prompt
        und damit Qualität und Kerosinverbrauch.
     2. **Der Preis war „für den Zustand zu hoch."** Ob und wie der Zustand
        in die Marktmiete eingeht, ist eine fachliche Frage — Marcel ist
        DESAG-geprüft, ich rate hier nicht.
   - ~~**Den KI-Knopf nach oben**~~ — **ERLEDIGT `v1241` (`63758ba`).**
     Gemessen: der Knopf saß bei **y = 1178**, am Ende der linken Spalte, bei
     einem Fenster von 725 px. Wer die Miete einträgt, sah ihn erst nach dem
     Scrollen — also meist gar nicht. Steht jetzt **als Erstes im Reiter,
     über beiden Spalten**, nachgemessen bei **y = 204**, über dem
     Nettokaltmiete-Feld (y = 400).
     > Die zweite Möglichkeit des Testers — **automatisch recherchieren
     > lassen** — ist bewusst **nicht** gebaut: das kostet Kerosin ohne Zutun
     > des Nutzers und ist damit eine Geldfrage, keine Optikfrage.
   - ~~**Mietsteigerung doppelt abgefragt**~~ — **ERLEDIGT `v1240`
     (`bb502fd`).** Der Tester wörtlich: *„ich sage hier ich will 3x die Miete
     erhöhen über drei Jahre, um auf 10 € zu kommen. Dann muss ich noch die
     ‚angestrebte Entwicklung' eingeben? Ich hab doch schon ein Ziel von
     10 €/m²."*

     **Er hat recht, und der Grund liegt tiefer als gedacht:** `me_soll`
     (Soll-Mietspiegel) geht in die **Rechnung gar nicht ein** — er dient nur
     der Potenzial-Anzeige. Gerechnet wird mit `me_anz`, `me_int` und
     `me_pct`. Der Prozentsatz ist aus der Soll-Miete aber **exakt
     ableitbar**: `Soll je m² / Ist je m² − 1`.

     Dieselbe Regel wie bei `v1231`: **füllen nur wenn leer, sonst anbieten.**
     Steht schon etwas drin, kommt ein „übernehmen"-Link daneben — einen von
     Hand getippten Wert zu überschreiben wäre schlimmer als die doppelte
     Frage. Liegt die Soll-Miete **unter** der heutigen, wird kein negativer
     Prozentsatz vorgeschlagen; dann steht da, dass keine Erhöhung nötig ist.

     **Auf Staging an echten Zahlen belegt** (Objekt `2026-001`, heute
     11,00 €/m²): Soll 13 € → „ergäben sich **18,2 %**", `me_pct` bleibt
     unangetastet · „übernehmen" setzt 18,2 · Soll 9 € → „keine Erhöhung
     nötig" · `me_pct` leer → **automatisch 18,2**, Text „berechnet" statt
     „ergäben sich". Objekt danach zurückgestellt, in der Datenbank
     gegengelesen.

   **F · Finanzierung**
   - **Reihenfolge umdrehen:** erst den Kredit eintragen, den man bekommt,
     dann das Eigenkapital daraus rechnen (wie im Immocation-Tool).
   - *„Warum muss ich zur Bewertung schon die Bank eintragen? Ich dachte, ich
     wäre im schnellen Onboarding."*

   **G · Bewirtschaftung**
   - **Prozent der Nettokaltmiete ist ortsabhängig** — in München ein anderer
     Wert als in Bielefeld. Macht man das so?
   - Vorschläge vorbelegen.
   - **Als Profileinstellung hinterlegbar**: *„für Profil ‚Investition C-Lage'
     nimm Mietausfall immer 3 %, für A-Lage 1 %."* → gehört mit dem Punkt aus
     H zusammen, es ist dieselbe Idee.
   - Eine Angabe ist unklar: *„worauf bezieht sich das? Pro Jahr/Monat?"*

   **H · Steuer**
   - **zvE ausschreiben** oder erklären.
   - *„Ist das wirklich der Standard? Hängt stark von der Lage ab."*
   - **Sonder-AfA erst nach dem Anklicken erklärt** — die Info gehört davor.

   **I · QuickBoarding**
   - Es war **schwer zu finden** (steckt unter „Aktionen").
   - **Dasselbe Exposé ergab dort einen anderen Wert** als im Boarding.
     **NACHGESTELLT am 04.09.2026 — es ist KEIN Rechenfehler.**

     Der Quick-Check rechnet bewusst mit einem kleineren Modell, und der
     Code sagt es selbst (`quick-check.js:469` ff.):

     | | |
     |---|---|
     | `san = 0`, `moebl = 0` | *„im QC nicht separat"* |
     | `uf = 0` | *„Umlagen — gibt's im QC nicht"* |
     | `darlehen = gi − ek` | abgeleitet, **nicht** aus einem Darlehensfeld |
     | `knk = kp × knkP/100` | ein Prozentsatz statt der fünf Einzelposten |

     Dazu kommen vom Import **nur 19 Felder** an (`OBJ2QC` in
     `object-actions.js:39`); alles andere wandert in `_qcPendingMerged` und
     wird erst beim „Als Objekt speichern" angewandt. **Dasselbe Exposé KANN
     dort also gar nicht dieselbe Zahl ergeben.**

     **Der Befund des Testers bleibt trotzdem berechtigt:** die App sagt das
     nirgends an der Zahl. In der Import-Tabelle steht je Zeile
     „→ Quick-Check" oder „→ Vollobjekt" (`object-actions.js:1275`) — aber
     wer die Zahl sieht, sieht die Tabelle längst nicht mehr.

   - **DABEI GEFUNDEN: die Berechnungs-Info aus `V63.23` hat nie funktioniert.**

     `_renderQcCalcInfo()` (`quick-check.js:761`) baut einen Kasten, der genau
     das erklären würde, was der Tester vermisst — Kaufpreis, Nebenkosten,
     Gesamtinvestition, Eigenkapital, Darlehen, Rendite, DSCR, LTV. Er sucht
     dafür `#qc-calc-info` und `#qc-calc-info-body` und **steigt in Zeile 1
     wieder aus, wenn es sie nicht gibt.**

     | Messung | Ergebnis |
     |---|---|
     | `grep -rn "qc-calc-info" frontend/` | **nur** `style.css` (drei Regeln) und `quick-check.js` (die zwei Abfragen) |
     | in irgendeiner `.html` | **kein einziger Treffer** |
     | zur Laufzeit, nach Öffnen des Quick Boarding und Füllen von Kaufpreis, Miete und Eigenkapital | `document.getElementById('qc-calc-info')` → **null** |

     **Der Kasten wird nie erzeugt.** Die Funktion ist tot, das CSS dazu
     ebenfalls. Zwei unabhängige Messungen, gleiches Ergebnis.

     > **Ein Versuch von mir ist daran gescheitert und wurde zurückgenommen**
     > (`v1232`, `dcd8ad3`, revidiert mit `79dd8e5`): ich hatte eine Fußnote
     > „Nicht enthalten: Sanierung, Möblierung, Umlagen" an diesen Kasten
     > gehängt — an etwas, das nie erscheint. **Erst beim Nachmessen im
     > Browser fiel auf, dass der Träger fehlt.** Der Text war richtig, der
     > Ort nicht.

     **→ ENTSCHIEDEN UND GEBAUT — `v1233`/`b`/`c` (04.09.2026).**

     Marcel auf die Demo (`design/Vorschläge/quickcheck-berechnungs-info.html`):
     **„erklärsatz und zum aufklappen."** Vorher seine Frage *„kam der
     Vorschlag aus den anmerkungen?"* — **nein.**

     Im Originaltext nachgelesen: der Tester verlangt **keinen** Kasten. Er
     meldet ein Symptom („Hier habe ich das Expose runtergeladen aber einen
     anderen Wert bekommen") und beschwert sich **siebenmal** über zu viele
     Knöpfe. Was er dreimal verlangt, ist etwas anderes: *„zvE muss irgendwo
     erklärt werden"*, *„Sonder-AfA … die Info oben davor reinpacken"*,
     *„Was genau sind die Stufen? … einfache Erklärung"* — **kurze
     Erklärungen an Ort und Stelle, keine neuen Flächen.** Der elfzeilige
     Kasten war **mein** Vorschlag und lief dem zuwider.

     **Gebaut ist deshalb:** der Satz steht immer unter den Kennzahlen, die
     elf Zeilen liegen zugeklappt dahinter („So wird gerechnet ▸"). Kein
     eigener Knopf, keine zweite Karte. **Nicht** in `quick-check.js` — dort
     bliebe es unsichtbar —, sondern in `quickcheck-app.html`.

     **Es wird nichts nachgerechnet.** Der Beleg: der Cashflow in der Zeile
     und der in der Kachel darüber sind dieselbe Zahl (−85 €).

     Zwei Nachbesserungen, beide durch Nachmessen gefunden: `_dpPilotScore`
     gab seine Zwischenwerte nie zurück (`v1233b`), und der Satz stand über
     der Karte statt darunter, weil `.kpis` im eingebetteten Modus
     `display:none` ist (`v1233c`). Beides steht im Journal.
   - Die Spanne (unten / Durchschnitt / oben) **kompakter** darstellen.
   - **„Übernehmen" ist unklar** — was übernimmt es wohin?
   - **Den Knopf „Tabelle" weglassen** — es gibt zu viele Knöpfe.

   **J · Zwei Punkte aus dem Vorgespräch**
   - **Lage-Strategie als Profil in den Einstellungen**: eine C-Lage-Strategie
     bewertet anders als eine A-Lage-Strategie und passt nicht in die
     vorgefertigten Profile. **Zusammen mit G bauen** — es ist derselbe
     Mechanismus.
   - **Braucht es „In Prüfung" / „Gewonnen" / „Verloren"?** Den Tester
     interessiert zuerst der **Bestand** und was er prüft. *„Verloren würde
     ich vielleicht rausnehmen."*

5. **Steuer-Mappe: ein Finanzamt-PDF über alle Objekte, dazu die Anlage-V-Zuordnung.** — Rest (Mappe, Anlage-V-Ansicht, 66-%-Warnung, Halter-Gliederung und § 7b erledigt, s. Fertig)

   - **Halter-Filter und Objektauswahl** in der Oberfläche des Cockpits: der Export kann sie (`opts.objectIds` in `werbungskosten-pdf.js`), die Bedienung fehlt (am 25.10.2026 gegrept).
   - **Fünf °-Zuordnungen** (Bereitstellungszinsen → 48, Vermittlungsprovision Darlehen → 51, sonstige Finanzierungskosten → 51, Steuerberatung → 82, anschaffungsnahe HK → 35) von Marcel oder dem Steuerberater prüfen; die AfA auf bewegliche Wirtschaftsgüter hat keine eigene Zeile.
   - Fehlende Stammdaten laut Messung vom 30.08.: Finanzamt, Steuer-ID, Einheitswert-Aktenzeichen, Eigentumsanteil der Person, verbilligte Überlassung, Ferienwohnung.

6. **Portfolio-Cockpit: die Kennzahlen, die der Tester vermisst.**
   Ebenfalls aus `design/mockups/Anmerkungen.docx`, aber ein eigener Punkt —
   es ist **Neubau, keine Nachbesserung**, und der letzte Teil ist der
   einzige Vorschlag im ganzen Bericht, den der Tester selbst als **USP**
   bezeichnet.

   - **EK-Rendite vor und nach Steuer** — wie viel Geld habe ich eingesetzt
     gegen wie viel Überschuss bleibt, samt Delta über den
     Beleihungsauslauf.
   - **Mietpotenzial p. a., IST gegen SOLL** — zeigt, wie viel Miete
     erreichbar wäre. **Dazu fehlt eine Angabe, die es heute nicht gibt:**
     welcher Investitionsbetrag nötig ist, um das SOLL zu erreichen.
   - **Gesamtvermögensbilanz und ihre Entwicklung.** Wörtlich: *„Ich ziehe
     mir jeden Monat Kontostände, Aktienwerte, Immobilienwerte zum Anfang des
     Monats. Dann sehe ich, wie der Wert steigt, und kann eine Trendlinie
     abbilden. Würde ich hier auch sehen, dass ggf. Kontostände abgefragt
     werden können und andere Werte (z. B. Bargeld) eingetragen werden
     können. **Das wäre ein USP von dem System.**"*

   > **Der dritte Teil ist etwas anderes als die ersten beiden.** EK-Rendite
   > und Mietpotenzial rechnet DealPilot aus Daten, die es schon hat. Eine
   > Vermögensbilanz mit Kontoständen ist ein **neuer Datentopf** mit eigener
   > Eingabe, eigener Historie und — sobald „Kontostände abgefragt" wörtlich
   > gemeint ist — einer Bankschnittstelle samt allem, was daran hängt.
   > **Erst entscheiden, ob das zum USP werden soll**, dann bauen. Hängt
   > unmittelbar an der USP-Frage aus Punkt 8.

7. **Sachwertfaktor: Rückmeldung bei wirkungslosem eigenen Wert** — Rest (die Ernte selbst ist erledigt, s. Fertig; Weiterpflege unter „MARKTBERICHT / ERNTE — Workstream (D)“)

   - Ein eigener Sachwertfaktor bei einer ETW wird mit `sachwertfaktor_grund: "objektart_nicht_abgeleitet"` still verworfen — der Nutzer bekommt keine Rückmeldung, dass die Angabe wirkungslos ist (Stand unklar, am 25.10.2026 nicht nachgemessen).

8. **Der Objektnummer fehlt auf cremefarbenem Grund der Kontrast.**
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
  Beim Zusammenführen der Projektanweisung gemessen, nicht gebaut:

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

## MARKTBERICHT / ERNTE — Workstream (D)  ·  eingebaut 13.09.2026

> **STAND 15.09.2026 — REGRESSIONSSTRECKE STEHT, 383 SÄTZE, 0 FEHLER**
> (v1410, Commit `7892d26`). `tools/swf-register/regression-swf.mjs` fährt
> jeden Sachwertfaktor-Satz gegen das echte Register: 202 liefern, 181
> geben eine begründete Auskunft, **kein technischer Fehler**, und jede
> gedruckte Zahl führt über ihre Einheit auf den richtigen Faktor.
>
> **Zwei Nachmessungen zum offenen Punkt B1 — eine Entwarnung, ein echter
> Befund:**
>
> **GND: ENTWARNUNG.** Die Sorge in CLAUDE.md, eine abweichende
> Gesamtnutzungsdauer stehe nur im Fließtext und rechne nicht mit, trifft
> für die drei hessischen Ausschüsse mit GND 70 **nicht mehr zu**.
> Gemessen an `modell_gnd_jahre`: Offenbach 70, Bad Homburg 70, Oberursel
> 70, Frankfurt 80 — alle richtig. `gutachterausschuss.js:553` liest seit
> v1129 **alle drei** Feldnamen (`gnd_jahre` · `gesamtnutzungsdauer_jahre`
> · `gnd`), und genau das rettet die Sätze: 44 Rezepte schreiben
> `gnd_jahre`, nur 9 schreiben `gnd`.
> > Der Absatz in CLAUDE.md beschreibt damit einen behobenen Zustand und
> > gehört beim nächsten Durchgang nachgezogen.
>
> **BAUPREISINDEX: der Befund hält, und er ist größer als notiert.**
> Nicht 33, sondern **118 Sätze** führen ihn nur im Fließtext. Anders als
> bei der GND gibt es hier **gar keinen Registerweg**: kein Lesefeld im
> Auswerter, keine Entsprechung zu `modell_gnd_jahre`. `CrossCheckService`
> nimmt ausnahmslos die Konstante `BAUPREISINDEX = 1.91` (Z. 59).
> >
> > **Und es ist nicht dieselbe Aufgabe wie bei der GND.** Was die
> > Ausschüsse im Text festlegen, ist kein Zahlenwert, sondern ein
> > **Stichtagsverfahren**: „quartalsweise zum Verkaufszeitpunkt"
> > (Offenbach) gegen „quartalsweise zum Beurkundungsdatum" (Bad Homburg)
> > gegen jahresdurchschnittlich. Eine Zahl ins Rezept zu schreiben wäre
> > also falsch — gebraucht wird der Index des Statistischen Bundesamts
> > **zum jeweiligen Stichtag**, plus je Satz der Vermerk, welchen
> > Stichtag der Ausschuss meint. Das ist ein eigener Bau und eine
> > Entscheidung, keine Nachbesserung. Solange er fehlt, rechnet jeder
> > Stichtag in der Vergangenheit zwangsläufig falsch.

> **STAND 14.09.2026 SPÄT — DREIZEHN LÄNDER, 134 SACHWERTFAKTOREN**
> (bis v1118b, Commit `d661b21`). Neu: **Schleswig-Holstein** (Lübeck,
> Herzogtum Lauenburg, Ostholstein — 255 Tabellenzellen zeichengleich,
> Stufe A).
>
> **Neu im Quellenregister: die AUSSCHUSS-EBENE** (v1118b). Wo ein
> Ausschuss geprüft und VERWORFEN wurde, steht jetzt warum — Stuttgart
> (Faktoren nur im kostenpflichtigen Vollbericht), Pinneberg (nur als
> Diagramm), Kiel (Modell von 2013–2015), Stormarn (Einzelwerte gegen
> Gebühr), Segeberg. `AUSSCHUSS_QUELLEN` in `quellen_links.js`, Pflichtfeld
> `warum_kein_wert`, längster AGS-Präfix gewinnt.
>
> **NÄCHSTER BLOCK, klar umrissen: NIEDERSACHSEN.** Die Faktoren stehen
> dort in einem Tableau-Kalkulator, der sich als PDF mit URL-Parametern
> abfragen lässt — Werkzeug liegt als
> `tools/swf-register/ni-kalkulator-abtasten.sh` im Repo und ist am
> vorhandenen Wolfenbüttel-Satz zellengleich gegengeprüft. Niedersachsen
> führt bisher EINEN Satz bei zwölf regionalen Ausschüssen und zwei
> Teilmärkten. Was fehlt, ist die Liste der Dashboard-Kürzel; das
> Navi-Dashboard ist eine Karte, die Kürzel tauchen aber in den Dateinamen
> der Modellbeschreibungen auf. Vollständig in `claude/ernte-20260913.md`.
>
> **Baden-Württemberg ist der große Brocken und bleibt liegen:** rund 900
> Gutachterausschüsse, kein Landesbericht mit Faktoren, und die geprüften
> Berichte (Stuttgart, Östlicher Bodenseekreis, Schwarzwald-Baar) drucken
> die Faktoren als Excel-Diagramm oder gar nicht. Ohne Zahlen im Textstrom
> ist dort nichts zu holen.

> **STAND 14.09.2026 ABEND — ZWOELF BUNDESLAENDER, 128 SACHWERTFAKTOREN**
> (bis v1117, Commit `1061bb2`). Neu dazu: **Berlin**, **Sachsen** (Leipzig
> und Dresden, beide Stufe A). DREI LAENDER VOLLSTAENDIG: Brandenburg 36
> Saetze, Sachsen-Anhalt 28 aus allen 14 Gebietskoerperschaften, Berlin 4.
>
> **Berlin ist geloest** — die Ortsteil-zu-Altbezirk-Tabelle lag in einer
> Glossardatei derselben Geschaeftsstelle (Stand 10.07.2025). 88 Ortsteile,
> drei Gebietsgruppen, geprueft an allen fuenfzehn abgedruckten Stuetzstellen:
> 15 von 15 zeichengleich. Der ALTE Berliner Satz ist entfernt — er ordnete
> ueber ein Feld zu, das niemand je gefuellt hat, und lieferte seit v1084
> nichts.
>
> **Noch ohne Sachwertfaktor: Baden-Wuerttemberg, Schleswig-Holstein,
> Saarland, Bremen.** Baden-Wuerttemberg ist mit 11,3 Mio Einwohnern der
> groesste offene Hebel. Bayern ist genehmigungspflichtig.
>
> **Ausbau, der noch aussteht:** Sachsen (Chemnitz und die Landkreise),
> Sachsen-Anhalt (Reihenhaus-Gleichung vor 1991 der Saalekreis-Gruppe,
> braucht die Regionstyp-Zuordnung), Brandenburg (Vergleichsfaktoren,
> aeltere Stichtage).

> **STAND 14.09.2026 — ACHT BUNDESLAENDER, 98 SACHWERTFAKTOREN** (bis v1113,
> Commit `847ed53`). ZWEI LAENDER VOLLSTAENDIG: Brandenburg 31 Saetze aus 16
> Ausschuessen (beide Teilmaerkte), Sachsen-Anhalt 28 Saetze aus allen 14
> Gebietskoerperschaften.
>
> **Der Quellennachweis steht im Bericht** (A2 erledigt) und der Quellenlink
> jetzt auch beim Sachwertfaktor.
>
> **Naechster Block:** ein weiteres Land. Frei zugaenglich und noch offen:
> Sachsen (boris.sachsen.de antwortet), Thueringen, Schleswig-Holstein,
> Bremen, Saarland. Berlin braucht eine Ortsteil-zu-Altbezirk-Tabelle (96
> Ortsteile), Bayern ist genehmigungspflichtig.
>
> **Werkzeugkasten, der dabei entstanden ist:** `verzweigt` (zwei Ebenen
> tief), `regression_additiv` mit aeusserem Exponenten, Logarithmus,
> Pflicht-Diskretmerkmalen und mehrfach belegten Feldern,
> `baender_kategorial`, `kategorie_sonst`, `kategorie_mehrdeutig`,
> `sonst_auch_ohne_wert`. Damit liess sich bisher JEDE gelesene
> Berichtsform abbilden.

> **STAND 14.09.2026 — ACHT BUNDESLAENDER, 73 SACHWERTFAKTOREN** (bis v1110b,
> Commit `a9ae48f`). Brandenburg vollstaendig (31 Saetze, 16 Ausschuesse,
> beide Teilmaerkte), Sachsen-Anhalt begonnen (Halle **Stufe A**, Magdeburg).
>
> **Der Quellennachweis steht im Bericht** (A2 erledigt) und der Quellenlink
> jetzt auch beim Sachwertfaktor.
>
> **Naechster Block, klar umrissen:** die vier restlichen Regionen
> Sachsen-Anhalts. Die Regionstypen-Zuordnung liegt gemeindescharf vor und
> endet mit dem Satz, der die Restkategorie rechtfertigt: „Alle nicht
> genannten Gemeinden, Ortsteile oder Gemarkungen wurden dem Regionstyp
> Doerfer zugeordnet." Ein Teil der Blaetter ist mit „Print To PDF" erzeugt
> und traegt die Gleichung nicht im Textstrom - dort fuehrt der Weg ueber
> Normobjekt und Umrechnungskoeffizienten.

> **STAND 13.09.2026 ABEND — BRANDENBURG IST FERTIG GEERNTET** (v1101-v1105,

> Commit `6bffa25`). Register auf Staging: **2.182 Saetze · 55
> Sachwertfaktoren**, davon Brandenburg **16 aus 15 Ausschuessen**. Alle 15
> Brandenburger Zustaendigkeitsschluessel tragen einen Faktor. Nicht
> erreichbar: Oberspreewald-Lausitz und Spree-Neisse (404), Frankfurt (Oder)
> (gemeinsamer Ausschuss mit Oder-Spree, eigene Auswertung fehlt).
>
> **Prignitz ist der erste Satz der Stufe A** im ganzen Register: der Bericht
> druckt ein Anwendungsbeispiel ab (150.000 x 0,95 x 0,81 = 115.425 EUR), und
> das Register rechnet es auf den Euro nach.
>
> **Vier Angaben waren gebaut und kamen nie an** — Standardstufe, Ortsname,
> Wohnflaeche, Modernisierungsgrad. Alle vier sind jetzt verdrahtet. Die
> Standardstufe traf Wolfenbuettel: dessen Korrektur (0,81 bis 1,21) lief seit
> ihrer Aufnahme ins Leere.
>
> **Eine Rundung lag falsch und ist korrigiert** (v1103): fuenf Modellformen
> rundeten hart auf drei Stellen, der Registerweg danach auf zwei. Die
> Uckermark gab bei 350.000 EUR 0,89 statt der abgedruckten 0,88. Ein
> Regressionslauf ueber 70 Modelle und 11.340 Rechnungen zeigt vier bewegte
> Stellen, alle vier doppelt gerundet.
>
> **Neue Modellformen:** `verzweigt` (je Kategorie ein vollstaendiges Modell,
> zwei Ebenen tief), `baender_kategorial`, dazu `kategorie_sonst` und
> `kategorie_mehrdeutig`. Vollstaendig in `claude/ernte-20260913.md`.
>
> **Was als naechstes ohne eine einzige neue Datei geht:** Reihenhaeuser und
> Doppelhaushaelften stehen in JEDEM Brandenburger Bericht als eigenes Kapitel
> 8.3.2 — dieselben 18 PDFs liegen unter `/opt/dealpilot-quellen/`.
>
> **Der Olpe-Punkt unter E1 ist technisch geloest:** `verzweigt` rechnet
> mehrere Regressionen nach Bodenrichtwertbereich. Das Rezept liegt noch im
> ZIP von v1094 und ist noch nicht eingelesen.



**Wo dieser Strang steht (Stand 30.08.2026, am laufenden Prod gemessen):**

```
Prod-Commit  74ae2e3   Tags rollout-20260814 · marktbericht-v1096a-20260814
Prod-Anker   2165738
Register     2150 Saetze · 525 Gebiete · Herkunft param_modell+saatdatei
             {"NW":1109,"BE":2,"ST":2,"TH":2,"NI":41,"BY":1,"HE":2,"BB":2}
Kennzahlen   liegenschaftszinssatz 1078 · bodenpreisniveau 403
             durchschnittspreis 386 · preisentwicklung 215
             sachwertfaktor 52 · erbbauzinssatz 15 · bodenpreisindex 1
```

**Zwei Nummernkreise laufen parallel.** Dieser Strang vergibt `v1084`–`v1097`,
der Haupt-App-Strang `v1148`–`v12xx`. **Nur ein Chat fasst git an** — vor jedem
Rollout absprechen, wessen Release es ist.

**Vor der ersten Codeänderung neu messen** — die Zahlen oben sind vom 30.08.,
der Parallel-Strang lief weiter (zuletzt gesehen v1173b):

```
docker exec dealpilot-mb-backend node -e "fetch('http://localhost:4000/api/v1/marktbericht/register/stand').then(r=>r.json()).then(d=>console.log(d.saetze,d.herkunft,JSON.stringify(d.laender)))"
```

**Nicht über einen frisch gestarteten Node-Prozess prüfen** — der liest nur die
Saatdatei und meldet Zahlen, die es im Betrieb nicht gibt.

> **Beim Einbau am 13.09.2026 nachgemessen** (Staging), damit niemand mit den
> Zahlen vom 30.08. weiterarbeitet:
>
> ```
> v1097 eingespielt?     NEIN — beide ETW-Sperren stehen noch
> GND_JAHRE = 80         steht noch  (CrossCheckService.js Z. 24)
> BAUPREISINDEX = 2.02   steht noch  (Z. 22)
> Register               2158 Sätze (war 2150), weiter 8 Länder
>                        NW 1109 · NI 48 · BE/ST/TH/HE/BB je 2 · BY 1
> ```
>
> **A1, A2 und B1 sind also unverändert offen.** Der Haupt-App-Strang hat seit
> dem 30.08. am Marktbericht gearbeitet (v1332–v1341), aber an der Oberfläche,
> den Feldbeschreibungen und den Erbbaurechtskoeffizienten — **Rechenkern und
> Ernte sind unberührt.**

---

### A · SOFORT

#### A1 — v1097 einspielen — Rest: Test 2 (Erledigtes s. Fertig)

- **Test 2 offen:** dieselbe ETW mit Bruttogrundfläche und Standardstufe gefüllt → im Bericht muss ein Sachwert erscheinen. Braucht einen echten Berichtslauf (Marktbericht-Journal unter v1097). Kommt kein Sachwert: Befund ausdrücklich zurücknehmen, neu diagnostizieren.

---

### B · RECHENKERN

#### B1 — v1098 · Modellvermerk-Leser — Rest (① und ② teils erledigt, s. Fertig)

- **② Rest:** Baupreisindex als Zahl zum jeweiligen Stichtag statt Konstante 1,91 — für Stichtage in der Vergangenheit rechnet die Konstante zwangsläufig falsch. Sätze ohne Bezugszeitpunkt bleiben Sperre.
- **③ NRW-Bewirtschaftungskosten** sind stichtagsabhängig (AGVGA, Ausgangswerte 01.01.2002, Fortschreibung über den VPI); das hinterlegte Paar gilt nur für den 01.01.2015.
- **④ Baujahrsschranke** eines Sachwertfaktors (Vorpommern-Rügen ab Bj. 1990, Brandenburg ab 1984): `vorbedingungen` im Modell, Meldung `ausserhalb_der_stichprobe` statt stumm zu rechnen. Vorher messen, welche Rezepte die Schranke nur im Hinweistext tragen.
- Hüllhorst- und Löhner-Sollwerte gegen das Gutachten neu abnehmen.

#### B1b — Steuerliche Portfolio-Betrachtung — Rest (Erledigtes s. Fertig, v1397)

- **Forward-Betrachtung über Jahre:** eine durchgerechnete Jahresreihe über alle Objekte gibt es nur in der Modellprojektion des Cockpits, mit Näherungen (`ASSUMP`) statt der echten `calc.js`-Pipeline.
- Bewusst außen vor: Verlustverrechnungsbeschränkungen (§ 15a, § 15b, § 10d EStG) — braucht die Steuerbescheide der Vorjahre, ist Steuerberatung.

#### B1c — Der Löhner-Sollwert und die Software gehen auseinander **[NEU 14.09.2026]**

**Beim Regressionslauf aufgefallen, ALTBEFUND — nicht durch die Arbeit vom
14.09. entstanden.** Der Beweis steht weiter unten.

`CLAUDE.md` nennt als Prüfmaßstab für die **Löhner Straße 278** (Kreis
Herford, `05758016`):

> vorläufiger Sachwert 326.649 € × **SWF 0,889 Stufe A**
> (Tabelle 0,899, kRnd −0,01, kBgf 0) = **290.391 €** marktangepasst

**Gemessen liefert die Software 0,841** — und `korrekturen` ist **leer**.
Die in CLAUDE.md genannte Restnutzungsdauer-Korrektur von −0,01 wird nicht
angewandt, weil sie im Registerdatensatz nicht steht.

##### Der Faktor hängt am Bodenrichtwert

| BRW €/m² | Faktor |
|---:|---:|
| 80 | 0,833 |
| 90 | 0,841 |
| 100 | 0,849 |
| 120 | 0,865 |

Kein Bodenrichtwert im plausiblen Bereich führt auf 0,899. Der Sollwert
liegt **außerhalb** dessen, was der hinterlegte Satz hergibt.

##### Warum das kein Schaden vom 14.09. ist

Gemessen gegen den Registerstand **vor** allen Änderungen dieses Tages
(`git show 7b11e27`):

- `"korrekturen": []` steht **31 mal** — im alten wie im neuen Stand
- **31 von 31 NRW-Sätzen rechnerisch identisch** (verglichen wurden `ags`,
  `gebiet_name`, `zweig`, `formel`, `korrekturen`, `stufe`, `kennzahl`)
- Geändert haben sich nur zwei Formatfelder: `vollstaendig` /
  `unvollstaendig_grund` entfallen, `verwendung` / `auflagen` neu — genau
  die verhaltensneutrale Umstellung aus `v1157b`

##### Was zu klären ist — und das ist eine Bewertungsfrage

`CLAUDE.md` kennzeichnet die Löhner-Sollwerte selbst als vorläufig:

> „Sie sind unter der Restnutzungsdauer 18 entstanden — also ohne erfassten
> Modernisierungsgrad. Sobald der Klicktest mit Modernisierungspunkten
> läuft, ändern sich beide Regressionswerte und müssen neu festgelegt und
> **gegen das Gutachten** abgenommen werden."

Drei Möglichkeiten, und nur Marcel kann sie auseinanderhalten:

1. **Der Sollwert ist überholt** — dann gehört er in CLAUDE.md ersetzt,
   nachdem er am Gutachten nachgerechnet wurde.
2. **Die kRnd-Korrektur fehlt im Registerdatensatz** — dann muss sie ins
   Herforder Rezept, und der Bericht ist die Fundstelle.
3. **Der Bodenrichtwert im Testfall ist ein anderer** — 0,899 entspräche
   einem BRW deutlich über 120 €/m². Welcher am Objekt gilt, steht im
   Gutachten.

**Bis das geklärt ist, taugt die Löhner Straße nicht als Prüfmaßstab** —
ein Sollwert, den die Software nie erreicht, macht jede Prüfstrecke rot,
ohne etwas zu zeigen.

#### B2 — `mb.valuation_inputs` wird nicht beschrieben

Die Berichte sind **nicht reproduzierbar** — man kann zwei Jahre später nicht
zeigen, mit welchen Eingangsgrößen gerechnet wurde. Für alles Richtung
Gutachten der schwerste formale Mangel. Braucht eine mb-Migration.

**Vor dem Schreiben die Tabelle lesen** — die Spalten sind nicht dokumentiert:
`docker exec dealpilot-mb-db psql -U mb -d marktbericht -c "\d mb.valuation_inputs"`

---

### C · REGISTER UND QUELLENREGISTER

#### C2 — Kunden-Verlinkung — Rest (Erledigtes s. Fertig)

- Link je **Ausschuss aus der Datenbank** (`mb.gaa_sources`/`gaa_documents`, C1) statt aus der Konstante `quellen_links.js` — keine zweite Wahrheit neben C1.
- Die drei Texte für die drei Fälle (kein Wert / kostenpflichtig / vorhanden) sind erst in einer Fassung formuliert.
- Regeln bleiben: nicht suggerieren, dass DealPilot den Wert liefert · kein Betrag ohne Beleg · nur die Landingseite verlinken, nie das Jahrgangs-PDF.

#### C3 — Admin-View „Ausschuss-Register“ — Rest: Reiter „Bestand“ (Erledigtes s. Fertig)

- Ansicht der Registersätze selbst, read-only, filterbar nach Land / Kennzahl / Ausschuss / Berichtsjahr. Stand 12.10.2026: `register/stand` nur im mb-Container (`api.js:61`), im Haupt-Backend nicht durchgeschleift. Ob v2591 („Register & Ernte“) das inzwischen abdeckt, ist nicht nachgemessen.
- Quellen-Filter „nächste Prüfung fällig“ und „Jahrgang verfügbar > Jahrgang im Register“ (Arbeitsansicht der jährlichen Nachernte).
- Fallen: Admin-API-Wrapper ohne `call()` · eigener SVG-Helfer statt Chart.js · `var(--text)` löst im Admin dunkel auf · Daten in der mb-DB, Weg über den Proxy (bewusst entscheiden).

#### C4 — Sachwertfaktoren ins Register — Rest: Reihenfolge umdrehen (Erledigtes s. Fertig)

- `sachwertfaktor()` fragt weiter zuerst die handgeschriebenen Module (`gutachterausschuss.js:722 ff.`, am 25.10.2026 per grep gesehen): für Minden-Lübbecke (05770) und Herford (05758) wird das Register nie gefragt. Ziel: Register zuerst, Rückgabeform unverändert, die zwei Module (Umrechnungskoeffizienten, Gartenland) als Rückfall.

#### C5 — Ersatzebenen C1 + C2 *(Marcels Entscheidung vom 30.08.)*

**C1 — fremder amtlicher Wert bei nachgewiesener Modellgleichheit**
(ImmoWertA Nr. 9 Abs. 3). Der Nachweis ist **maschinell führbar**, weil jeder
Registerdatensatz seinen Modellvermerk mitführt (GND, RND, BWK-Quote,
Marktmiete). Nur innerhalb desselben Bundeslandes · der Spender muss
lizenzrechtlich sauber sein · der Bericht nennt Spender, Stichtag und den
Modellvergleich Feld für Feld · **Stufe C, nie A**.

**C2 — eigenes Schätzmodell, nur für den Liegenschaftszins, nur nach
bestandener Validierung.** Prüfstand liegt fertig bei:
`c2_validierung.py` (im ZIP von 08.09.). Abnahmekriterien stehen **vor** der
Messung fest: Kreuzvalidierung über die 73 NRW-Ausschüsse ≤ **0,4 Pp** bei
Wohnen, Fremdprobe gegen Niedersachsen ≤ **0,6 Pp**.

**Ehrliche Erwartung: C2 fällt durch.** Grund ist ein Leckage-Befund — Miete
und Kaufpreis stehen in derselben CSV-Zeile wie der Zinssatz, und der Zinssatz
*ist* näherungsweise Reinertrag durch Kaufpreis. Übrig bleiben Objektart und
Bodenrichtwertniveau. **Ein Durchfallen ist ein gültiges Ergebnis**, kein
Fehlschlag.

**Der Sachwertfaktor bekommt C2 nicht** — 52 Datensätze sind keine Basis, und
der Faktor ist konstruktionsbedingt die lokale Eigenheit, die man nicht
fortschreiben kann.

Zurückgestellt: **Anlage 25 BewG** — steuerliche Größe im Verkehrswertkontext,
Bewertungsfrage, gehört Marcel.

---

### D · ZU MESSEN, BEVOR GEBAUT WIRD

Jeder Punkt ist ein Befehl, kein Projekt.

| | Befehl / Frage |
|---|---|
| **`param_modell_ebene_check`** — der erlaubte Wertebereich ist unbekannt. `gemeinde` und `kreis` sind belegt, `gemeinde_verbund` fiel durch und kostete 24 Sätze; **`gaa` und `land` (49 Sätze) liegen im Bestand und sind ungemessen** | `docker exec dealpilot-mb-db psql -U mb -d marktbericht -c "select pg_get_constraintdef(oid) from pg_constraint where conname = 'param_modell_ebene_check';"` |
| **Die DDL von fünf Tabellen** — Rollen bekannt, Spalten nicht: `gaa_sources`, `gaa_documents`, `param_probe`, `param_lauf`, `valuation_inputs`. **Nichts hineinschreiben, was nicht vorher gelesen wurde** | `docker exec dealpilot-mb-db psql -U mb -d marktbericht -c "\d mb.gaa_sources"` (usw.) |
| **`market=seed`** — der alte offene Punkt „Kunden sehen Seed-Daten" ist **nicht belegt**. `MARKET_SOURCE: seed` wird nur geloggt; ob GeoMap läuft, entscheiden `GEOMAP_TOKEN` und `MB_DEMO` | `docker exec dealpilot-mb-backend sh -c 'echo MB_DEMO=[$MB_DEMO]; [ -n "$GEOMAP_TOKEN" ] && echo GEOMAP_TOKEN=gesetzt \|\| echo GEOMAP_TOKEN=LEER'` |
| **NRW-Landesbericht S. 141–142** — enthält er verwertbare Modelle oder nur Spannen? Eine Landesübersicht ohne Korrekturen und Modellvermerk liefert **keinen** Registerdatensatz. **Seite 182 ist sicher wertvoll**: die amtliche Zuständigkeitsliste der 73 Ausschüsse, auf die sich die Kaskade heute nicht stützen kann | erst messen, dann planen |
| **Handel 5,5 % gegen 5,6 %** — Medianliste und Streuungstabelle widersprechen sich, in Projektanweisung *und* Erntedokument. Vermutlich harmlos (Median über alle Sätze gegen die 471 mit Streuungsangabe) | an `lzs.csv` nachmessen, in einem Halbsatz erklären |

---

### E · DER ERNTE-DAUERAUFTRAG

> **Das ist der Punkt, an dem permanent weitergearbeitet wird, wenn sonst
> nichts drängt.**

**Ziel:** für jedes der 16 Bundesländer beide Kennzahlen im Register —
Liegenschaftszinssatz und Sachwertfaktor — plus die Quelle in der Datenbank
(C1). **Stand: 6 von 16 Ländern**, rund 40 % der Einwohner beim Zins, 25 % beim
Faktor.

**Die realistische Obergrenze ist nicht 16.** In fünf Ländern sperrt die Lizenz
die kommerzielle Verwertung. Dort ist das Ziel **der Link plus die ehrliche
Aussage, warum wir nichts führen** — und, wo möglich, eine Anfrage.

#### E1 — Was ohne neue Recherche geht

**Elf Rezepte liegen fertig geprüft** in `v1094/rezepte/` und warten je auf
**eine** Voraussetzung. Die drei teuersten:

| Rezept | fehlt | Aufwand |
|---|---|---|
| **Wiesbaden Vergleichsfaktoren** | zweidimensionale Korrekturtabelle — der Auswerter kann nur 1D | eine Modellform; Sollwert steht bereit: 5.171 − 855 = **4.316** bei 500 m², Bj. 1980 |
| **Hameln-Hannover** | Schlüsselkollision zweier Lagen unter demselben AGS | eine Messung am Dokument, **kein geratener Gemeindeschlüssel** |
| **Northeim** | achtstelliger Gemeindeschlüssel unbestätigt | ein Abruf im Gemeindeverzeichnis |

**Eine fehlende Modellform:** Regression nach Band ausgewählt. Kreis Olpe führt
drei efh-Regressionen nach Bodenrichtwertbereich; zwei stehen heute als
`verfeinerungen:` **ausgewiesen statt gerechnet**.

#### E2 — Die Länder, nach Aufwand pro Einwohner

Abzuarbeiten, sobald das jeweilige Dokument vorliegt (Marcel lädt die
robots-gesperrten selbst — siehe F):

| # | Land / Quelle | Wirkung | Zustand |
|---|---|---|---|
| 1 | **Hamburg** | 1,9 Mio. Einwohner, **ein** Ausschuss | ✅ **VOLLSTÄNDIG IM REGISTER seit v1408** — alle **19 Faktoren** des Produktmodells, Stufe A, Normobjekt 0,7667 getroffen. ~~„Zum Registereintrag fehlt nur die Modellform `produkt_faktoren`"~~ **war doppelt überholt:** die Mechanik gab es seit v1098-WPOT (`konstante` + multiplikative Korrekturen), den Registereintrag seit der Ernte. Zwei echte Rechenfehler wurden dabei gefunden und behoben: der **RND-Deckel** fehlte (v1398, bei RND 80 rechnete Hamburg 3,90 % zu niedrig — bei jedem Neubau) und der **Modernisierungsfaktor** (v1408, Spanne −4,4 % bis +10,8 %). |
| 2 | **NRW-Sachwertfaktoren vervollständigen** | 39 von 73 Gebieten fehlen, darunter Münster, Bonn, Wuppertal, Mönchengladbach, Gelsenkirchen, Aachen | teils robots-gesperrt → Mail an den Oberen GAA |
| 3 | **Brandenburg** | 16 Kreisberichte, seitengenau kartiert; Modellvermerk landesweit über die **VV EW-SW** geklärt (HTML, keine Abbruchseite) | Jahrgangsentscheidung offen (F1) |
| 4 | **Hessen ausbauen** | Lizenz bedingungsfrei | ✅ **13.09.2026: Kassel geerntet** (2 Matrizen, 144 Zellen, rechnet) **+ das Sachwertmodell Hessen landesweit** (2 Matrizen, 850/497 Kauffälle, Stufe C, bewusst ausgefiltert). **Darmstadt fällt aus** — Marktanpassungsfaktoren nur als Streudiagramm, keine Tabelle, keine Gleichung. Nächste: Wiesbaden, Offenbach und die übrigen über `gds.hessen.de` (Downloadcenter, 10 Jahrgänge kostenfrei). Darmstadt hat dafür **Vergleichsfaktoren nach § 193 BauGB als Tabellen** — eigene Kennzahl, eigener Fund. |
| 5 | **Rheinland-Pfalz** | Mainz frei | ✅ **13.09.2026: MAINZ GEERNTET, Stufe A** — der bisher einzige. Der Bericht 2025 druckt die **Funktion** ab (Polynom 3. Grades über den vorläufigen Sachwert) **und ein Anwendungsbeispiel**; beides nachgerechnet, beides zeichengleich (350.000 × 1,44 = 504.000 €). 24 Spannen, 213 Kauffälle, gültig für **alle Teilmärkte** — der Bericht prüft die Objekttypen einzeln und stellt fest, dass sich die Trendlinien überlagern. Lizenz: „nur mit Quellenangaben gestattet". **Offen bleibt der Landesbericht** („Vervielfältigung nur mit Erlaubnis") und die Lageanpassung, die Mainz selbst nicht beziffert. **Als Nächstes:** die übrigen RLP-Ausschüsse und die landesweite Zwischenauswertung des Oberen GAA (Sachwertfaktoren + Liegenschaftszinssätze EFH/ZFH zum 01.01.2025, `gutachterausschuesse.rlp.de`). |
| 6 | **Mecklenburg-Vorpommern** | Ludwigslust-Parchim ist der einzige verwendbare Ausschuss | ✅ **04.10.2026 GEERNTET: 7 Liegenschaftszinssätze, Stufe A.** ⚠ **Die Sperre vom 13.09.2026 war falsch** — das Zitat unten endet mitten im entscheidenden Satz. Am Originalimpressum (S. 2) steht er vollständig: *„Auszugsweise Wiedergabe mit eindeutigen Quellenangaben verbunden mit der Zusendung eines Belegexemplars an den Herausgeber **ist ohne Genehmigung gestattet**."* Wortgleich mit Schwerin — **gemeinsame Geschäftsstelle**. `swf-mv.json` hatte die Lizenz die ganze Zeit richtig erkannt; nur hier stand die Falschaussage, also dort, wo entschieden wird. Geerntet: ezfh 3,7 · rhdhh 4,5 · efh_rmh 4,2 · we_v 3,9 · wgh 6,7 · mfh_bis6 5,4 · mfh_ueber6 6,2 (`ludwigslust-parchim.json`, Tabelle 31, S. 66). Belegexemplar ist eine offene Auflage. **Der alte Eintrag zum Nachlesen:** ⛔ 13.09.2026 geprüft: LIZENZ SPERRT. Der Bericht ist frei abrufbar (3,6 MB), aber das Impressum sagt: *„Der Bericht über den Grundstücksmarkt ist urheberrechtlich geschützt. **Vervielfältigungen sind nur mit Genehmigung des Herausgebers gestattet.** Auszugsweise Wiedergabe mit eindeutigen Quellenangaben verbunden mit der Zusendung eines Belegexemplars."* Nicht übernehmen — MV gehört zu F2 (Anfrage). |
| 7 | **Schleswig-Holstein** | eine Anfrage öffnet **alle 15** Ausschüsse | F2 |
| 8 | **Niedersachsen-Sachwertfaktoren** | liegen hinter Tableau-Dashboards, nicht im PDF | ✅ **13.09.2026: der Weg steht, erster Ausschuss geerntet.** ~~F2 (LGLN)~~ war überholt — die Lizenz (`dl-de/by-2-0`) erlaubt es längst. **Landkreis Wolfenbüttel** ist im Register (30 Stützpunkte + 3 Korrekturkurven, Stufe B). **Der Abrufweg, der trägt:** frische URL mit `?Brw=…&Sach=…` plus **7 Sekunden warten**, dann den Ergebnisbereich zoomen — vier Messungen je Durchgang. Messreihen im selben Tab scheitern am Renderer-Timeout. Damit sind die übrigen niedersächsischen Ausschüsse und **beide Kennzahlen** (8 Teilmärkte Liegenschaftszins, 4 Sachwertfaktor) erreichbar. Einzelheiten in E2-NI unten und `claude/ernte-20260913.md`. |

**Gesperrt und nur über eine Anfrage erreichbar:** Sachsen (sechs Vermerke
einzeln am Dokument gelesen, alle sperren die kommerzielle Verwertung) ·
Baden-Württemberg (dort zusätzlich **Darstellungsform** —
Sachwertfaktoren als Streudiagramm **ohne Zahlentabelle und ohne Gleichung**,
an sieben Ausschüssen belegt).

> **Bremen und Saarland standen hier bis zum 14.09.2026 — beide zu Unrecht in
> demselben Topf.** Gemessen und mit v1396 ins Quellenregister geschrieben:
>
> - **Bremen ist nicht gesperrt, sondern leer.** Der Ausschuss leitet keine
>   Sachwertfaktoren ab und schreibt das in Kapitel 8.4 seines Berichts selbst
>   (unzureichende Personalausstattung). **Der 50-€-Vollbericht enthält sie
>   ebenfalls nicht** — eine Anfrage wie eine Zahlung wären hier vergeblich.
>   Bremerhaven dagegen hat sie, ab Seite 31, hinter der Kasse.
> - **Das Saarland ist weder gesperrt noch leer, sondern zentral.** Nicht der
>   örtliche Ausschuss veröffentlicht, sondern die Zentrale Geschäftsstelle im
>   Grundstücksmarktbericht Saarland (so der Saarbrücker Bericht selbst,
>   Kapitel 7.3). Das Hindernis ist technisch: **`saarland.de` gibt unserer
>   Server-IP durchgehend HTTP 403**, auch auf der Startseite — der
>   Thüringen-Fall. **Marcel kann den Bericht von seinem Rechner holen**, dann
>   ist das Saarland erntbar.
>
> Beides steht mit Fundstelle in `claude/ernte-20260913.md` und als Eintrag in
> `quellen_links.js`; der Kunde bekommt dort den Weg statt einer Leerstelle.


### E2-NI · NIEDERSACHSEN — Rest (Erledigtes s. Fertig)

- Nachernte 2027 nach `tools/swf-register/ernter/vizql/README.md` (Abschnitt „Die Nachernte 2027“).
- Deckung je Ausschuss und Teilmarkt (8 Liegenschaftszins-, 4 Sachwertfaktor-Teilmärkte) gegen das Register messen, nicht annehmen. Prüfstand ist der Kalkulator selbst: Eingabe dort = Antwort aus dem Register, zeichengleich.
- Messbefunde vom 13.09. (Normobjekt 120 m² · RND 40 · Stufe 2,5, drei Korrekturkurven, Stützpunkte) in `claude/ernte-20260913.md`.

#### E3 — Die Regeln, die bei jeder Ernte gelten

- **Lizenz und Inhaltsverzeichnis im ERSTEN Abruf zusammen lesen.** *Kiels
  Daten wären lesbar gewesen; die Lizenzprüfung kam zu spät.*
- **Die Lizenz ist jahrgangsgebunden.** Derselbe NRW-Landesbericht trägt 2016
  `by-2-0` und 2025 `zero-2-0`.
- **robots-Sperre und Captcha sind Ansagen, keine Hürden** — auch nicht über
  einen ferngesteuerten Browser. **Kostenpflichtige Berichte NIE abrufen.**
- **`pdftotext -layout` statt WebFetch.** Die WebFetch-Grenze ist eine
  Textmenge, keine Seitenzahl — Abbruch zwischen Seite 21 und 55, über zehn
  Läufe gemessen. `pdftotext` schafft 458 Seiten am Stück.
- **Kein Registerdatensatz ohne bestandenen Prüfstand.** Der Prüfmaßstab ist
  das **Anwendungsbeispiel des Dokuments**, nie eine selbst gerechnete Zahl —
  einschließlich der Rundung.
- **Die Zählprüfung ist nicht verhandelbar.** Beim fehlerhaften Suchmuster vom
  11.08. gingen Monotonie, Wertebereich und Anwendungsbeispiel **alle** durch —
  nur das Nachzählen fand die Lücke.
- **Nach jedem Saatlauf `docker restart dealpilot-mb-backend`** — das Register
  liegt im Speicher.
- **Quellenregister-Zeile mitpflegen** (C1): Status, Jahrgang, nächste Prüfung.

Vollständiger Ablauf: Block 04, Abschnitt „Wie die Ernte abläuft".

---

### F · HÄNGT AN MARCEL, NICHT AM CODE

**Nicht selbst versuchen — hier ist eine Entscheidung oder ein Browser nötig.**

| | | Gewinn |
|---|---|---|
| **F1** | **Entscheidung: Brandenburg-Liegenschaftszins auf Jahrgang 2023 freigeben** (Lizenz belegt) statt auf 2025 zu warten (ungeklärt) | **+10 Gebietskörperschaften** für eine Antwort |
| **F2** | **Vier bis sechs Mails.** Oberer GAA NRW (Text liegt seit 11.08. fertig im Projekt — die Berichte sind kostenfrei und Zero 2.0, **gesperrt ist nur der Verteilweg**) · LGLN Niedersachsen `oga@lgln.niedersachsen.de` · LVermGeoSH · LVermGeo Sachsen-Anhalt · Vogtlandkreis oder Tübingen · München | LGLN öffnet 9 Ausschüsse, LVermGeoSH **alle 15** |
| **F3** | **Sechs PDF im Browser laden und anhängen** | siehe Tabelle unten |
| **F4** | **Drei einzelne Seiten:** Hamm (S. 64/65), Krefeld (S. 66), Kreis Unna (Kap. 8.1) | drei NRW-Sachwertfaktoren, Tabellen sind geerntet und geprüft |
| **F5** | **Entscheidung: RLP-Landesbericht kaufen?** ✅ **Preis bestätigt 14.09.2026: 150 € PDF** (200 Druck, 300 kombiniert, LVermGeo-GeoShop) — die frühere Spanne „150 gegen 28" ist damit erledigt. Inhalt am Verzeichnis belegt: **fünf** Objektarten-Gruppen Sachwertfaktoren (4.2.2 bis 4.2.6) **plus** Liegenschaftszinssätze (4.3). Offen bleibt **nur** die Lizenz: „Vervielfältigung nur mit Erlaubnis", aber „Wiedergabe von Daten jedweder Art … mit Quellenangabe gestattet" — zwei Sätze, die verschieden weit gehen. Einzelheiten unter **F5** weiter unten | **ein Bundesland, 4,1 Mio Einwohner, beide Kennzahlen** |

#### F5 (12.09.) · ⏸ ZURÜCKGESTELLT 12.10.2026 — Landesgrundstücksmarktbericht RLP, 150 €

> **Marcels Entscheidung am 12.10.2026: „wir kaufen den bericht erst
> nicht aber bitte weis mich drauf hin wenn wir das nächste mal
> ernten."**
>
> Also **nicht gekauft, aber nicht verworfen.** Die Vorlage unten bleibt
> vollständig stehen — sie ist am Inhaltsverzeichnis des kostenfreien
> Auszugs belegt und veraltet nicht so schnell wie eine Preisangabe.
>
> **⚠ WIEDERVORLAGE: beim nächsten Erntelauf.** Wer eine Ernte für ein
> weiteres Bundesland plant, prüft zuerst diesen Punkt — 150 € für
> 4,1 Mio Einwohner mit beiden Kennzahlen in EINEM Dokument ist der
> beste Schnitt, den die Ernte bisher gefunden hat. Vor dem Kauf die
> **Lizenz klären**, nicht vermuten: das Impressum verbietet
> „Digitalisieren, Scannen sowie Speicherung auf Datenträgern" ohne
> Erlaubnis des Herausgebers.

#### F5 (12.09.) · KAUFENTSCHEIDUNG: Landesgrundstücksmarktbericht RLP, 150 € **[NEU 14.09.2026]**

**Das ist die klarste Kaufvorlage, die die Ernte bisher hervorgebracht hat** —
und das Gegenstück zur Bayern-Empfehlung („nicht kaufen").

##### Was drinsteht, gemessen am Inhaltsverzeichnis

Der kostenfreie Auszug (Kapitel 1–3, 105 Seiten) **enthält das vollständige
Inhaltsverzeichnis** — damit ist belegbar, was der Vollbericht führt, ohne ihn
zu haben:

| Kapitel | Inhalt | Seite |
|---|---|---:|
| 4.2.2 | Sachwertfaktoren Ein-/Zweifamilienhäuser | 116 |
| 4.2.3 | Sachwertfaktoren Wohnungseigentum | 127 |
| 4.2.4 | Sachwertfaktoren Mehrfamilienhäuser | 136 |
| 4.2.5 | Sachwertfaktoren Wohn-/Geschäftshäuser | 143 |
| 4.2.6 | Sachwertfaktoren Wirtschaftsimmobilien | 148 |
| 4.3 | Liegenschaftszinssätze (ab 4.3.2 EFH/ZFH S. 158) | 156 |

**Fünf Objektarten-Gruppen plus Liegenschaftszinssätze, landesweit** — beide
Kennzahlen der Ernte in einem Dokument.

##### Warum das anders liegt als Bayern

| | Bayern | Rheinland-Pfalz |
|---|---|---|
| Preis | ~800 € für 13 Einzelberichte | **150 €**, ein Dokument |
| Struktur | dezentral, je Ausschuss | **zentral**, Land führt selbst |
| Einwohner | 13,2 Mio (Teilabdeckung) | **4,1 Mio, vollständig** |
| Zusatz | — | webgestützter Immobilienrechner + Vergleichsfaktorenlisten |
| Empfehlung | **nicht kaufen** | **kaufen — nach Lizenzklärung** |

Bezug: LVermGeo-GeoShop, 150 € als PDF (200 gedruckt, 300 kombiniert),
umsatzsteuerfrei, Versand per E-Mail.

##### Die Lizenz — und warum sie zu klären ist, nicht zu vermuten

Das Impressum sagt **wörtlich**:

> „Vervielfältigung dieses Marktberichtes ist nur mit Erlaubnis des
> Herausgebers gestattet. Als Vervielfältigungen gelten z. B. Nachdruck,
> Fotokopien, Mikroverfilmung, Digitalisieren, Scannen sowie Speicherung auf
> Datenträgern. **Eine Wiedergabe von Daten jedweder Art ist nur mit
> Quellenangabe gestattet.**"

**Zwei Sätze, die verschieden weit gehen.** Der erste verbietet die
Vervielfältigung des *Berichtes* — der zweite erlaubt die Wiedergabe von
*Daten* mit Quellenangabe. Unser Register führt den Quellenvermerk ohnehin je
Datensatz (`quellenvermerk`).

**Das ist eine Rechtsfrage, keine technische.** Sie gehört vor dem Kauf
geklärt, am besten durch eine kurze Anfrage beim Oberen Gutachterausschuss —
dieselbe Mail, die ohnehin für NRW, LGLN und LVermGeoSH offen ist (F2). Eine
Antwort deckt dann Kauf und Verwendung.

##### Was ohne Kauf gilt

Der kostenfreie Weg in Rheinland-Pfalz **endet bei Mainz** (im Register,
Stufe A). Gemessen:

- **Koblenz veröffentlicht keinen eigenen Bericht mehr** und verweist
  ausdrücklich auf den Landesbericht.
- Die sechs Bereichsausschüsse (Osteifel-Hunsrück, Rheinhessen-Nahe,
  Rheinpfalz, Westeifel-Mosel, Westerwald-Taunus, Westpfalz) stellen auf der
  Landesseite **nichts** bereit — dort steht „Zur Zeit liegen keine weiteren
  Informationen vor".
- Eigene Berichte gibt es nur für Kaiserslautern, Koblenz, Ludwigshafen,
  Mainz, Trier und Worms, zu beziehen **bei den Städten selbst**; über den
  GeoShop laufen sie nicht.

##### Nebenbefund: ein Zugang, der falsch ausgewiesen war

`LAND_QUELLEN['07']` führte `zugang: 'kostenfrei'`. Das stimmte nicht — und
ein Zugang, der als kostenfrei geführt wird und es nicht ist, schickt den
Nutzer zweimal los. Korrigiert auf `kostenpflichtig`, mit dem vollständigen
Weg im Hinweis.


**Die sechs PDF (F3), alle frei, Lizenz geprüft, Seitenzahl gemessen:**

| # | Dokument | Inhalt | Seite |
|---|---|---|---|
| 1 | **NRW-Landesbericht 2025** | SWF-Übersicht aller 73 Ausschüsse · **amtliche Zuständigkeitsliste** | 141–142 · **182** |
| 2 | **Hamburg** Immobilienmarktbericht | Sachwertfaktor · Liegenschaftszins | 117 · 116 ff. |
| 3 | **Brandenburg**, 16 Kreisberichte | seitengenau kartiert | `_fehlend.md` |
| 4 | **Mainz** GMB | Sachwertfaktoren · Liegenschaftszins | 49 · 64–94 |
| 5 | **Kassel / Darmstadt** | Bodenpreisindex · Vergleichsfaktoren **mit Anwendungsbeispiel** | 24 · 35–40 |
| 6 | **Ludwigslust-Parchim** | beide Kennzahlen | 63 · 65 |

---

### G · BETRIEB UND AUFRÄUMEN

- **`tools/abnahme.sh` im Repo ist die kaputte Host-Fassung.** Sie wertete mit
  `node -e` auf dem **Host** aus — Staging hat Node 18, **Prod hat kein node
  auf dem Host**. Ergebnis: dreizehn Fehlalarme, während das Serverlog sauber
  meldete. Die richtige Fassung liegt auf Prod unter `/tmp/abnahme.mjs` und ist
  **nicht committet** — `/tmp` überlebt keinen Neustart.
  **Im nächsten Paket an ihren Platz committen.**
- **Reste auf Staging:** `*.pre-v1094`, `*.pre-v1095`, `*.pre-v1096*`,
  `patchesold/` und eine Datei namens **`tname`** (zerschossener
  `hostname`-Aufruf).
- **Konsolidierung der beiden Marktbericht-Projektanweisungen** zu einer
  Fassung. Rezept steht im Nachtrag, Abschnitt 6. Gehört an den **Anfang** einer
  Sitzung, mit dem Originaltext im Zugriff — nicht aus dem Gedächtnis.
- **Aus einem anderen Workstream, ebenfalls uneingespielt:**
  `kpa-standalone.zip` (Kaufpreisaufteilung, Workstream **(A)**), seit 04.09.
  Kollidiert nicht mit v1097 — aber **nur ein Chat fasst git an**.

---

### H · WAS NICHT VERIFIZIERT IST

Damit es niemand für gemessen hält:

- **Der Klicktest zu v1097** (A1) — die eigentliche Bestätigung des Befunds
- **Der geänderte KI-Prompt** — braucht einen Lauf mit `KI_GEGENRECHNUNG=1`
- **Der Serverstand seit dem 30.08.** — vor der ersten Codeänderung neu messen
- **Die DDL der fünf Tabellen** und der Wertebereich von
  `param_modell_ebene_check` (D)
- **Die C2-Validierung** — Prüfstand getestet (Selbsttest **und** Gegenprobe auf
  Rauschdaten), aber nie gegen echte Daten gelaufen
- **`market=seed`** — ein Etikett, kein Befund (D)
- **Der Preis des RLP-Landesberichts**

---

## Fertig

### N80 · Maßnahmen am ganzen Haus im MFH-Zielbild, Messkabine Handy/Tablet — 26.10.2026 (`v2966`–`v2966g`, `eb9cef00` … `da20f550`)

Haus-Maßnahmen (Dach, Fassade, Fenster, Heizung, Leitungen) mit Kosten und Punkten im Schritt Gebäude; Kosten
nach Fläche auf die Wohnungen, Punkte je Gewerk nur einmal, Ausgangspunkt das Höhere aus Gebäude-Zustand und
Objektfeld (v2966a: Parkstr. 9 zählte Bäder/Heizung doppelt). Parkstr. 9 mit Dach 60.000 €: Kosten 136.000 →
196.000 €, Punkte +1,1 → +5,1, RND 34,4 → 43,8 J., Ertragswert Zielbild 436.000 → 473.000 €. Messkabine 390 /
768×1024 / 1024×768, 11 Ansichten: sieben Funde behoben (Objektkarte 1024, Portfolio-Pass, Investor-Co-Pilot-Zeile,
Landing-Knopf, Atlas quer, Pass-Tabelle, Datumszeile). Rest: Gebäude-Zustand vs. Objektfelder bei Parkstr. (Anzeige).


### Telegram-Bot: Hilfe-Fragen, Bewertung Stufe 1–3 mit fester Bestätigung, PDFs als Datei — 26.10.2026 (`v2960`/`v2960a` `4b87c710`, `v2961` `7bc8b184`)

Hilfe aus `help.js` gespiegelt (`hilfe_suchen`), „wie funktioniert …“ nicht mehr an die Befehlsliste. Bewertung: volle Nutzlast wie im Browser (88 statt 12 Felder), Pflicht je Stufe aus `pflichtFuer()`, Stufe im Angebot, Bestätigung „noch N frei — Ja/Nein“ vom Webhook, „Nein“ räumt ab, Ergebniszahlen unter `data` gefunden. PDF-Dienst (Headless-Chromium, echte App, schreibt nichts, Warteschlange 1+4, Frist 120 s) auf Staging: sechs Arten, 6–12 s, bis 710 MB. Prüfer `pruef-telegram-bewertung.js` 52/52. Rest unter N81.

### Prozess-Atlas: Flugzeug vorwärts, Handbuch-Anleitung erreichbar, Zielbild erklärt — 26.10.2026 (`v2965`, `83d70efd`; `v2965a/b`, `1d06b7a7`)

Ursache Rückwärtsflug: `animateMotion rotate="auto"` richtet die +x-Achse in Flugrichtung aus, der Umriss
hatte die Nase bei x −11 — gespiegelt (Atlas und Hilfe-Kasten), nachgemessen cos 1,000 zwischen Nase und
Pfadtangente, Pfade laufen Quelle → Ziel. „Genaue Beschreibung“ = Flughandbuch Teil A: war vom Atlas nicht
erreichbar — jetzt Knopf je Station (16 Verweise, vom Prüfer gedeckt), Banner im Thema Abläufe, Hilfe nannte
„Sieben Abläufe“ statt elf. Zielbild: sechs Hilfe-Abschnitte, Handbuch A12 (10 Schritte, belegt), Atlas-Ablauf
mit 6 Stationen; Ortsangabe „Bewertung“ → Reiter Objekt berichtigt. Rest: N80 (MFH-Haus-Maßnahmen).


### N78 · Pilot-Analyse durchgesehen — Punkte 1–6 — 25.10.2026 (`v2947`, `cb9043be`; `v2947a`, `fde07f9b`)

Gemessen an Westerfeldstr. 140 (Staging). (1) `_offerteDeckeln`: Offerte über KP → `offerte_mail` entfällt
mit Grund (`offerte_mail_entfallen`), Vermerk vor `verhandlungsempfehlung`. (2) Verlauf: „nach Abschlag“ nur
Berichte 4–10 (+3,1 %), Trend in Lage & Markt ohne Abschlag 1.055.000 → 960.000 € (−9,0 %) statt −22,3 %.
(3) Portalnamen in Lage & Markt und beiden PDFs → „aktueller Marktdurchschnitt“. (4) Satz: Median 2.165 × 390
= 844.350 €, Ausstattung × 1,02, Energie × 1,03 = 887.074 €, + 73.615 € → 960.000 € (mb `mpi_faktoren`).
(5) „Score laut Marktbericht“, „Bruttomietrendite laut Marktbericht (ohne Zusatzeinnahmen)“, Score-Vergleich
mit DealPilot-Score 78 und Investor Deal Score 73 (Karte). (6) DealScore 74 → 73 statt 74,00 → 73,00;
Ankauf-Cashflow 677 € statt „—“; Rohertrag 39.780 (Stellplätze marktüblich 1.440 €) gegen 39.420 € erklärt.

### Technische RND wieder wie im Gutachten — vier Gewerke-Stufen — 23.10.2026 (`v2943`, `20aecba1`, `ee12638d`)

Die technische Restnutzungsdauer rechnet wieder mit vier Gewerke-Stufen wie im Gutachten: veraltet −½ ·
standard (zeitgemäß, ursprünglich) neutral · erneuert +½ · gehoben +1. Damit trifft Am Markt 18 wieder
**26,00** und Am Markt 9 **22,00** Jahre — die RND-Gutachten-Abweichung Am Markt 18 ist geschlossen.
`ee12638d`: Prüfsummen der gespiegelten Rechenkerne nachgezogen.

### Bank-PDF-Video: die Seite wechselt mit dem Kapitelband — 23.10.2026 (`v2942`, `f3ebff18`)

Die neue Seite lädt unsichtbar und erscheint erst mit dem Kapitelband — kein Seitensprung mehr im
Bank-PDF-Video. Im selben Zug die Sprecher-Fassung von Modul 19 neu gesetzt und neu aufgenommen.

### Prod-Rollout 67 — 23.10.2026 (`60320081`)

Zielbild-RND nach Anlage 2, Stufen mit derselben Bandregel, ImmoWertA Alter höchstens GND, Kurzfassung bis
6 Seiten, Messe-Tafeln und Menü, Storybook.

### DealPilot-Marktbewertung: Abschlag auf Angebotspreise — 14.10.2026 (`v2237`, `dd8ac14b`) (früher N74)

Die Spanne der DealPilot-Marktbewertung beruht auf Angebotspreisen. Gebaut: Abschlag als Einstellung, Ø Markt 5,8 % (Kaufpreise ETW bundesweit 12/2025 unter Angebot), im Urteil ausgewiesen. Quelle, Stand und Link nur intern in `config.js angebotAbschlagMarkt`.

### Pilot-Analyse kennt den Marktwert — 14.10.2026 (`v2237`, `dd8ac14b`) (früher N75)

Befund am Rundgang-Objekt (Kaufpreis 139.000 €, DealPilot Ø 189.000 €): die Analyse nannte nur die Zielrendite-Obergrenze, nicht den Wertpuffer. Behoben: `markt` (Marktwert/Spanne) geht im Aufruf mit, der Prompt führt zwei Sichten (Rendite der Lageklasse und Marktwert).

### Quick-Check-Score gegen Investor Deal Score — entschieden 14.10.2026: bleibt getrennt (früher N73)

Gemessen am Testobjekt Musterweg 7, Bielefeld: Quick-Check 46 = Objekt-DealScore 46 (alle Teilwerte gleich), Investor Deal Score (DS2, 24 Kennzahlen inkl. Lage/Markt) 63. Marcel: DS2 bleibt gesondert, weil er mehr Kennzahlen hat, genauer ist und die Lage eingeht.

### Marcel 14.10.2026, achte Runde — 14.10.2026 (`v2218g`–`v2219c`, Prod-Rollout (19) `b11f88b4`) (früher N71)

Geführte Eingabe randlos, Dokumente im PDF-Import, Sprache direkt Freisprechen, Sprechkatalog ergänzt (Grenze 320), Messe-Drehbuch Parkstraße. Datenfehler der Soll-Ansicht behoben (`v2219a`), Parkstraße wiederhergestellt. Auf Prod ausgerollt.

### Marcel 14.10.2026, siebte Runde — 14.10.2026 (`v2218a`–`v2218f`) (früher N70)

Pilot-Analyse Parkstraße neu, Atlas am Handy gemessen und repariert, Pilot erst nach Anmeldung, Mikrofon neben Senden (wie WhatsApp), Handy-Menü nach der ersten Aktion wieder klickbar.

### Marcel 14.10.2026, sechste Runde — 14.10.2026 (`v2217`–`v2218`) (früher N69)

Pilot-Analyse beim Ankauf gegenübergestellt, Soll/Ist nur im Bestand, Marktbericht ab erstem Bericht (`v2217`/`v2217b`); Dokumente in der Datenaufnahme mit Abgleich, Abweichungen beim Exposé-Import (`v2217`–`v2217d`); geführte Eingabe nach dem Quick-Check frei (`v2217c`); Bot `soll_ist_lesen`, UUID- und Tilgungsfehler (`v2217a`); Gesamt-Atlas in der App mit Telegram-Bot (`v2218`). Prod-Rollout v2217–v2218: `v2218` liegt auf `main` (git, 25.10.2026).

### Marcel 14.10.2026, fünfte Runde — 14.10.2026 (`v2216j`/`v2216k`, `v2218`, Prod-Rollout (18) `471bd747`) (früher N68)

1 Soll/Ist aus dem Tab Objekt in die Pilot-Analyse (`v2216j`), 3 F1 ruft den Piloten auch bei Dropdown-Feldern (`v2216j`/`v2216k`). 2 Prozessatlas: Marcels Wahl „Start wie heute, alles drauf, dann der Gesamtablauf“ (`design/Vorschläge/prozessatlas/atlas-gesamt.html`), als Gesamt-Atlas in die App übernommen mit `v2218` (laut N69). Messung des Atlas am Handy steht in N69.

### Marcel 14.10.2026, vierte Runde — 14.10.2026 (`v2216`–`v2216i`) (früher N67)

Zehn Punkte gebaut und in der Messkabine und am Desktop gemessen: Handy-Aktionen nach Marktbericht wieder bedienbar, Plan-/Abmelden-Knöpfe, „×“-Schließen, Handy-Kopf aufgeräumt, Parkstr. 9 als Demo-Geschichte, Soll/Ist-Analyse ausgebaut, Kanzlei/Tower/Aktenmappe geprüft, Aktionsmenü am Desktop bleibt offen, Auslieferungszustand Aktenmappe mit Boardkarte, Rahmen der Löschen-/Duplizieren-Knöpfe. Zwei echte Fehler dabei: Marktbericht fehlte im Register der Hauptansichten; Ankauf-Stand teilte die Einheitenliste mit dem Formular. Prod: `v2216i` liegt auf `main` (git, 25.10.2026).

### Marcel 14.10.2026, dritte Runde: Messe-Geschichten, BMF, RND-Abgleich, Werbungskosten — 14.10.2026 (`v2213`–`v2215b`) (früher N66)

`design/Messe/demo-geschichten.md`, BMF-Kaufpreisaufteilung bei 15 Demo-Objekten, Westerfeldstraße 140 als RND-Beispiel (2 % → 6,25 %, rund 1.530 €/Jahr), RND-Abgleich-Tabelle, Werbungskosten 2024–2026; Landing `v2215`–`v2215b` (Prozesskarte im Leistungsumfang, `forschung.html`). Dabei behoben: `v2213`/`v2213b` (BMF −96,6 % und `#VALUE!`), `v2214` (Steuer-Jahreswerte gingen verloren, auch auf Prod). Prod: `v2214` und `v2215b` liegen auf `main` (git, 25.10.2026). Die übrigen dort genannten offenen Punkte stehen unter N62.12 und N62.24.

### Marcel 14.10.2026, zweite Runde: Einstellungen → Standardwerte — 14.10.2026 (`v2211`/`v2211a`, `45917195`, `c1fef5c1`) (früher N65)

Acht Punkte gebaut und im Browser geprüft: Sets über den Einzelkarten mit erkennbarer Zugehörigkeit, Finanzierung wieder als Entweder-oder (selbst eingeben / indikativer Satz), Bewirtschaftung Euro/Prozent, Lageklassen gegen Bewirtschaftung abgeglichen, Bewirtschaftung je Objektart zusammengeführt, Grenzsteuersatz mit Verweis auf Mandanten, KI-Icons auf den Karten weg, Detailansicht vereinfacht. Dazu Schwärzen (`v2210`), Gewerbe im Ertragswert (`v2210b`, Rest: LZS-Zweig nach Gewerbeanteil nur als Hinweis), Rumpfjahr (`v2209`). Antworten Marcels: Datenschutz schwärzen, Gewerbe recherchieren und umsetzen, Demo-Objekte passend machen, F&E-Seite mit Kanzlei-Zusammenarbeit. Prod: `v2211a` liegt auf `main`.

### Marcels Antworten vom 14.10.2026 — umgesetzt 14.10.2026 (`v2209`, `cde5c927`; `v2210`, `v2210b`) (früher N64)

Rumpfjahr: echter Fehler, die Zinsmonate im Jahr 1 zählten gegen das Auszahlungsjahr statt gegen Projektionsjahr 1 (2026-1052: 1 Monat Miete gegen volle Zinsen), fünf Fälle 5/5 gegen die echten Funktionen. `store:false` an allen 10 `/v1/responses`-Aufrufen, aus dem Container mit 200 nachgewiesen. Regionaldatenbank/eigene Datenbank in der Projektanweisung („EIGENE DATENHALTUNG“, `8fcd85fa`). Datenschutz: Marcels Annahme stimmte für den Dokument-Import nicht (Grundbuch/Kaufvertrag mit Personendaten an OpenAI) → Schwärzen gebaut (`v2210`). Gewerbe: `gewerbe_jahr` setzte kein Aufrufer, Gewerbefläche bekam den Wohnmietansatz → Gewerbe im Ertragswert getrennt nach Nutzung (`v2210b`). Soll/Ist-Umschalter im Quick-Check ist weg; Landing-Leistungsumfang und F&E-Seite gebaut (`v2215`–`v2215b`).

### Tour in Aktenmappe, Tower und Kanzlei — 12.10.2026 (`v2154`, `6c7ecb51`) (früher N62.1)

Marcel: die Tour nach der Neuanmeldung muss auch in Aktenmappe, Tower und Kanzlei laufen. Laut Commit gebaut; der Hänger in der Kanzlei (Schritt 6) war schon mit `v1774` behoben. Die Abnahme bei sichtbarem Fenster steht in N62.20.

### Kanzlei: Bestand/Ankauf-Schalter über der Suche — 12.10.2026 (`v2154`, `6c7ecb51`) (früher N62.2)

Der Stand-Schalter (`v2145`/`v2145a`, `doppelkarte.js`) sitzt in der Kanzlei jetzt zwischen Aktionsknopf und Suche, in derselben Formatierung wie die Suche.

### Pilot-Analyse: alle Daten fließen ein — 12.10.2026 (`v2156`, `75e9c6c0`) (früher N62.3)

Vorher gemessen: MFH-Konfigurator nur 9 von 28 Feldern im Prompt, Liegenschaftszins (`lzs_pct`, Zweig, Berichtsjahr, Register-Herkunft) fehlte. Gebaut: MFH-Felder, Rohcodes und Liegenschaftszins in der Pilot-Analyse; die Stufe-3-Werte stehen seit `v2150`.

### Lage & Markt: Netz, Zensus und Objektfelder gegenübergestellt — 12./13.10.2026 (`v2157`, `ff1af46b`/`7b71224d`; `v2161`, `e8a320a9`) (früher N62.4)

`v2157`: die Pilot-Analyse bekommt beide Lage-Seiten des Berichts (`assessment`, `nutzer_einschaetzung`), Lageklasse, die vier Objektfelder, Bevölkerungstrend und Zensus; Aufgabe 15 mit Zielfeld `lage_gegenueberstellung`, Karte „Gegenüberstellung“ im Reiter Lage & Markt. Nachweis: `prompt-lecks-pruefen` 100 Stellen RC=0, Kettenprobe an Bericht 176, Karte bei 390 px ohne Überlauf. Befund Zensus: die Kreisdatei trug nur die Beispielzeile, 0 von 162 Berichten mit Zensus-Werten; `v2161` erzeugt sie mit Marcels Zensus-Konto aus der amtlichen Quelle (400/400 Kreise, Herford 4,2 / 53,8 / 5,54 im mb-Container nachgemessen).

### Marcels Liste vom 13.10.2026 abends: Hilfe, Einstellungen, Handy, geführte Eingabe, Sprache — 13.10.2026 (`v2200`–`v2206`) (früher N63)

Hilfe: Klon-Ursache behoben (Partner-Portal/Freigaben klonten den ersten Eintrag), Einstieg in „Abläufe & Pilot“ integriert (`v2200`, `1a548875`); Inhalte gegen den Code (17 Themen, 33 Korrekturen, GrESt TH/HB `v2207`); Hilfe und Einstellungen am Handy als Liste → Inhalt (`v2201`/`v2201a`, 390 px). Standardwerte als Karten mit drei Sets, Marcels Wahl A (`v2206`). Bestand/Ankauf am Handy unter Portfolio (`v2203`/`v2203a`, y=136). Hinweis „Erklär mir das“ mit × und „Nicht mehr anzeigen“ am Konto (`v2204`). Tour: 39 Schritte bei 1280 und 390 gemessen, Reiter Steuer ergänzt, 46 Inhaltsstellen korrigiert (`v2205`/`v2205a`). Mikrofon „halten zum Sprechen“ in der geführten Eingabe, Kette mit echter Sprache nachgewiesen (wfl=85) (`v2204`).

### vw-modul (Junker Gutachten-Modul V4.2) — entschieden 13.10.2026: ignorieren (früher N62.23)

`Dateien/vw-modul-v4-2-2.zip` und `-v4-2-5.zip` sind laut Marcel eine ältere Fassung für die Junker-Homepage; der Rechenkern der neueren Version (VW-Modul V422) ist gegengeprüft und in DealPilot eingebaut. Kein Auftrag.

### Neue Hilfe: Pilot auf F1/?, Prozess-Atlas, Hilfe überarbeitet — 13./14.10.2026 (`v2187`–`v2189f`, `v2191`, `v2208`) (früher N62.22)

Pilot-Männchen (`pilot-tower.js`) auf F1 bzw. ?, Sofort-Treffer aus 89 Feld-Erklärungen, Atlas mit 7 Abläufen (`prozess-atlas.js`, Prüfer 47/47 Belege RC=0), Hilfe vertieft (20 Themen, 152 Abschnitte), gold-audit-Befund `rgba(201,168,76,…)` in neun Dateien behoben (`v2188a`). Fehlerverdacht aus der Hilfe-Erhebung nachgemessen: 1–6, 8, 9 mit `v2191` (`ad26710b`), 4 schon mit `v1963`, Rest mit `v2208`. Entschieden: Speichern bleibt automatisch ohne Knopf; § 256 BewG als Stufe D bleibt („es steht ja dran“); Quick-Check-Hausnummer keine Pflicht; der Soll/Ist-Umschalter im Quick-Check ist weg (N64). Prod: `v2188b` liegt auf `main`.

### Marktbericht: Bewirtschaftungskosten im Ertragswert zum Stichtag fortgeschrieben — 13./14.10.2026 (`v2186`, `e2ec2ed2`; `v2195`; `v2210b`, `3fccd761`) (früher N62.21)

Befund: `ErtragswertService.js:360–386` nahm außerhalb des NRW-Modells `BWK_TABELLE` unfortgeschrieben (230 €/275 €/9,00 €/m² statt 367 €/439 €/14,40 €/m² ab 01.01.2026), BWK rund 37 % zu niedrig. Marcel: „das soll schon passen“. Gebaut: Jahrestabelle `BWK_JAHRE` + `bwkAnsaetze(jahr)` je Objektart (`v2186`); 2022/2023 aus der amtlichen Tabelle des Oberen Gutachterausschusses Brandenburg, Gewerbe-Verwaltung 3 % und getrennter Mietausfall (`v2195`); Gewerbe getrennt nach Nutzung (`v2210b`). Prod: `v2195` und `v2210b` liegen auf `main`.

### Bewirtschaftung je Objektart und Standard-Set in der Erstanmeldung — 13.10.2026 (`v2183` Demo, `v2184`, `c4585d64`) (früher N62.20)

Vorher nur ein Profil (`ip_bwk_ul_pct_default` 17 %, `ip_bwk_anteil_default` 16 % der NKM, nur localStorage). Gebaut: Bewirtschaftung je Objektart und Standard-Set in der Erstanmeldung. Umlaut-Reste in `hausgeld-*.js` sind weg (grep 25.10.2026: 0 Treffer). Prod-Rollout v2177–v2181b: der Stand liegt auf `main`.

### Pakete A → B → C: Marktbericht im Hintergrund, Lage aus eigenen Daten, Pflichtfeld-Vertrag + Agents — 13.10.2026 (`v2174`–`v2176`, `3263df3f`, `03a1cff7`, `66236e26`) (früher N62.19)

A: Marktbericht im Hintergrund mit Fortschritt und Meldung (vorher ein blockierender Request mit Dreh-Spinner). B: Lage aus eigenen Daten (Makro, Geoapify, Trend/Wanderung, Vermarktungsdauer/Zensus-Leerstand) mit KI im Vergleich. C: Pflichtfeld-Vertrag je Registersatz mit Prüfer in `deploy-staging.ps1` und Agents für die Datenpflege (`.claude/agents/`). Vorher gemessen: Register 62 Dateien / 4.832 Sätze, `saat-pruefen.mjs` RC=1 (49 Befunde), nur von Hand. Prod: `v2176` liegt auf `main`.

### Eigene Datenhaltung: Makro, PLZ, Laufzeiten, Lasttest — 13.10.2026 (`v2172`–`v2172c`, `768ae809`; `v2197`, `c74eb3a5`) (früher N62.18)

`mb.makro_werte` mit Import wie `ZensusImportService`, `DestatisConnector.macro` liest zuerst die Tabelle (`v2172`); `mb.plz_orte` aus OpenPLZ, `AgsResolver` liest sie zuerst — gemessen 152 ms live gegen 2 ms aus der Tabelle; `mb.laufzeiten` schreibt Dauer je Bericht/Analyse/Dienst mit (`v2197`); Lasttest auf Staging (Sitzung v2172 ff.). Grundsatz: jeder abgelegte Wert trägt Quelle, Endpunkt, Stichtag, Abrufdatum, Lizenz.

### data._ai bleibt hinter der Spalte ai_analysis zurück — 13.10.2026 (`v2193`, `ae640c48`) (früher N62.17)

Gemessen: bei 4 von 8 gewonnenen Objekten trug `ai_analysis` die Analyse vom 13.10., `data._ai` die vom 09.10. Ursache: `collectData()` trägt `_ai` aus `_currentObjData` mit (Stand beim Laden), im Browser nachgestellt. `saveObj` setzt jetzt beide gleich; der einzige Leser (`dashboard.js`) nimmt seit `v2170b` die neuere.

### Makro-Kennzahlen vorab holen und speichern — 13.10.2026 (`v2172`–`v2172c`, `768ae809` … `8c6aa0fa`) (früher N62.16)

Befund: die Regionaldatenbank brauchte 44–114 s je Tabelle, einzelne Abrufe brachen nach 180 s ab. Gebaut: `mb.makro_werte`, je Land ein Abruf (`regionalkey 05*`), 3 parallel, Takt 12 h / 30 Tage; der Bericht liest die Tabelle in 2–38 ms. Prod: `v2172c` liegt auf `main`.

### Marktbericht in Worten: Entwicklung, Ableitung, Prognose — 13.10.2026 (`v2196`, `f8a42348`) (früher N62.14)

Kapitel „D) Entwicklung, Ableitung & Prognose“ als vierte Gruppe; `kapitelD()` rechnet die Fakten (Preis-/Miet-/Bevölkerungstrend, Ableitung aus Median × Fläche, Spanne, Abstand Kaufpreis, Ertrags-/Sachwert, Prognose als Modellfortschreibung über 3/5 Jahre). Echter Lauf auf Staging: Kapitel kam mit genau diesen Zahlen und der Kennzeichnung „keine Vorhersage, kein Gutachten“. Kosten: ein vierter paralleler KI-Aufruf je Bericht.

### Datenschutz: KI-Datenfluss gegen die Rechtstexte — 13./14.10.2026 (`v2209`, `v2210`); rechtliche Prüfung übernimmt Marcel selbst (25.10.2026) (früher N62.15)

Inventur 13.10.2026: einziger KI-Anbieter OpenAI; hinaus gingen Objektadresse, Halter, Freitexte, Fotos, Ton, ganze Dokumente (Grundbuch mit Geburtsdatum, Kaufvertrag), ohne `store:false`. Gebaut: `store:false` an allen 10 `/v1/responses`-Aufrufen (`v2209`), Schwärzen vor dem Senden (`v2210`). `datenschutz.html` beschreibt Schwärzung, Bilder ungeschwärzt und `store:false`; `/api/v1/consent` existiert (`backend/src/routes/consent.js`).

### Offen aus dem 13.10.2026 (v2163–v2166): Regionaldatenbank, Prod, Rumpfjahr — 14.10.2026 (`v2209`, `36e5ef86`) (früher N62.13)

Regionaldatenbank gelöst, dazu eine eigene Datenbank angelegt (N64). Prod-Rollout erfolgt. Rumpfjahr geprüft: echter Fehler, Zinsmonate in Jahr 1 zählten gegen das Auszahlungsjahr (`v2209`).

### Zensus in der Datenbank — 13.10.2026 (`v2162`–`v2162c`, `65c28743`, `cae6bc16`, `f7bbefc0`, `708be31c`) (früher N62.4b)

`mb.zensus_werte` (Migration 016): 894.880 Werte, 400 Kreise, 10.786 Gemeinden, 10 Tabellen; Import `npm run zensus` (~2½ min, UPSERT, Protokoll `mb.zensus_abrufe`). `ZensusConnector.lookupDb` nimmt die Gemeinde nur eindeutig und Miete/Leerstand je Wohnung (gemessen: 852 m²/12 WE landete sonst bei „200 m² und mehr“). Anzeige in Miete, Investitionen, Marktbericht Web+PDF und Pilot-Prompt; prompt-lecks 108 grün.

### Makro-Score: Ersatzwerte galten als gemessen — 13.10.2026 (`v2158`, `33bca6d9`) (früher N62.4a)

Befund: `ScoringService.macroScore()` setzte für fehlende Kennzahlen Ersatzwerte ein und meldete `estimated: false`; an Bericht 176 war nur der Bevölkerungsteil gemessen, der Makro-Score 54 überwiegend erfunden. Jetzt mittelt er nur gemessene Kennzahlen und nennt `gemessen`/`moeglich`/`fehlend`, ohne Kennzahl `score: null`; die Bericht-Makrolage erst ab zwei gemessenen. Im Container: Bevölkerungstrend allein → 65, „aus 1 von 6“.

### Eigener Reiter „Quellen“ in der Pilot-Analyse — überholt 13.10.2026 (`v2155`, `af75d07d`; `v2171`, `c17cf41d`) (früher N62.5)

Gebaut in `v2155`, auf Marcels Wunsch („nur unter der Pilot-Analyse fällt der Reiter Quellen weg“) in `v2171` wieder herausgenommen.

### Steuerliche Zusammenfassung in der Pilot-Analyse und im Soll/Ist — 13.10.2026 (`v2160`, `8abf834b`) (früher N62.6)

Vorher: `## STEUER`-Block im Prompt, aber kein Antwortfeld. Gebaut: Aufgabe 16 mit Zielfeld `steuer_zusammenfassung`, mit Ankauf-Stand zusätzlich `soll_ist_steuer`; Reiter Steuer; `ankauf.js` führt die Kennzahl Steuerwirkung p. a. (cf_ns − cf_vs). `prompt-lecks-pruefen` 103 Stellen grün, Reiter im Browser mit gestelltem Ergebnis gerendert.

### Landingpage: Leistungsumfang unter „Funktionen“ — 14.10.2026 (`v2215`–`v2215b`, `c09b503d` … `8cc8cf0a`) (früher N62.7)

Marcels Entscheidung (N64): ja, mit der abgelegten Prozesskarte. Gebaut als Prozesskarte im Leistungsumfang der Landing (laut N66).

### Subpage zum F&E-Projekt und zur Portfolio-Strategie — 14.10.2026 (`v2215`–`v2215b`) (früher N62.9)

`frontend/landing/forschung.html` gebaut (laut N66), mit dem Hinweis auf die Zusammenarbeit mit Steuerkanzleien (Marcels ausdrücklicher Wunsch, N65). Das Verfahren selbst steht nicht auf der Seite, nur was es leisten soll.

### Tab Steuern: Werte aus dem Vorjahr übernehmen — 13.10.2026 (`v2194`, `d4bf5647`) (früher N62.10)

Im Detail-Modus neben dem Veranlagungsjahr: „⧉ Werte aus VORJAHR übernehmen“. Kopiert nur eigene Werte wiederkehrender Posten und nur in leere Felder; nie kopiert werden feste Posten wie Schuldzinsen, AfA, bewegliche WG, anschaffungsnah, Erhaltungsaufwand, Kaltmiete.

### Standard-Lageklasse, diktierbar — 13.10.2026 (`v2159`/`v2159a`, `8c7aa666`, `036982eb`) (früher N62.11)

Vorher gemessen: das Onboarding setzte nur Ziel-Renditen je Klasse, keine Standardklasse; `lageklasse` kam im Diktat gar nicht vor. Gebaut: Standardklasse in `lage-profil.js` (`standard()`/`setzeStandard()`), wählbar im Onboarding und im Investmentprofil; neuer Quick-Check wird vorbelegt (Marke „Vorgabe aus deinem Profil · überschreibbar“), jede andere Wahl und jedes Diktat löscht sie; geführte Eingabe fragt sie in Etappe 3. Nebenbefund behoben: beide Auswahl-Schreiber nahmen den ersten Teilwort-Treffer (diktiertes „A“/„B“ landete auf „keine Angabe“).

### Aussehen-Schritt: die App ändert sich im Hintergrund mit — 10.10.2026 (`v2096`, `6266495f`) (früher N61.1)

Befund: der Mechanismus schaltete schon (`_aussehenAnwenden()` setzt `data-dp-layout` live), aber der Schleier `.dpo-ov` nahm hellen Flächen 60 % Helligkeit und verfälschte genau den Unterschied. Im Schritt Aussehen ist der Schleier jetzt weg (`dpo-ov-schau`).

### Soll/Ist-Abgleich in der Pilot-Analyse ausgebaut — 14.10.2026 (`v2216`–`v2216i`) (früher N61.2)

Marcels Entscheidung (N64): ausbauen, genauer beschreiben, ggf. mehr Felder. Gebaut als Punkt 6 der vierten Runde vom 14.10.2026 (N67, „Soll/Ist-Analyse (Pilot-Analyse) ausbauen“); dazu Soll/Ist aus dem Tab Objekt in die Pilot-Analyse (`v2216j`, N68) und Steuer im Soll/Ist (`v2160`).

### Lageklassen in Pilot-Analyse und Quick-Check-Bewertung — 12./13.10.2026 (`v2143`, `v2148`, `v2157`) (früher N61.3)

Laut Code: Ampel der Bruttomietrendite nach Lageklasse (`v2143`), Quick-Check-Fazit mit Zielrendite der Lageklasse (`v2148`, `qc-heuristik.js:668`), Prompt der Pilot-Analyse (`v2157`, `openaiService.js:479`).

### Lage & Markt: Werte aus den Marktberichten statt Recherche — 12.10.2026 (`v2150`, `c73c0c6c`) (früher N61.4)

Befund: `/objects/history` lieferte seit `v1963`/`v1965`/`v1979` Sachwert, Ertragswert und das führende Verfahren, der Prompt-Bauer las keines dieser Felder; `mietspiegel_eur_qm` sollte die KI recherchieren. Seit `v2150` stehen die Stufe-3-Werte im Prompt (`openaiService.js:1103-1128`), der Mietspiegel nimmt vorrangig den Berichtswert (`:1569`).

### Unterlagen-Modul ergänzt (N51) — 12.10.–20.10.2026 (`v2151`–`v2153`; `v2440`–`v2445`, `5bd2ab68`, `7d727070`; `v2470`–`v2472`, `ca8ecb13`, `c2f2ebbe`) (früher N61.6)

`v2151`–`v2153`: Beleg je Seite (`seiten.pro_seite`), Ansprechpartner 1 und 2 je Amt, Kopie-Haken, Amtsweg oder zwei Ansprechpartner. 19.10.: gemessen 0 von 27 Ämtern mit Ansprechpartner; Abgleich v6 vollständig, Modal mit zwei Karten und Beleg-Seite, 342 Ämter für 60 Gemeinden eingespielt → 369 Ämter, 104 mit Ansprechpartner (56 mit zwei). 20.10.: Telegram-Teil (`/unterlagen`, Anschreiben-Entwurf, „verschickt“, „suche N/alle“), ein Kern für Web und Bot, Prüfstrecke im Container 57/0. vw-modul-Zips: entschieden ignorieren (13.10.2026).

### Lageklassen ermitteln und vergeben — 08.10.2026 (früher N60.1)

17 von 21 Objekten trugen bereits Makrolage, Mikrolage und Bodenrichtwert (Marcels Angaben); die Klasse ist daraus abgeleitet: P = (Makro + Mikro)/2, A bei P ≥ 4,0 und BRW ≥ 500, C bei P ≤ 2,5 oder BRW < 150, sonst B; ohne Lagedaten die häufigste Klasse am Ort, bei Gleichstand B. Verteilung A 2 · B 11 · C 7 · 1 ohne. Beim Schreiben gemessen: `objectService.update()` hätte bei jedem PUT Analyse und Fotos gelöscht — alle 20 Schreibvorgänge mit unveränderter Analyse und Fotozahl.

### Doppelte Pilot-Analysen — nachgemessen 10.10.2026, keine Doppelung mehr (früher N60.1b)

Am 08.10.2026 trugen sieben Objekte byte-gleich denselben Text (14.849 Zeichen). Am Portfolio-Export vom 10.10.2026 (`Dateien/API-Export/`): 13 Objekte mit Pilot-Analyse, alle 13 mit unterschiedlicher Länge. Die Neuberechnung (N60.5d) hat gewirkt, die Ursache ist seit `v2015` verriegelt (N60.5b).

### Messkabine: Matrix über Haupt-App, Quick-Check und Marktbericht — 10./11.10.2026 (`v2085`–`v2085b`, `29ce302f`; `v2092`–`v2092f`, `b3bf99b5` … `7a642ff4`) (früher N60.2)

Die Kabine setzt jetzt vier Achsen und nennt `angefordert` und `attribute`; `ui_theme`/`ui_cards`/`ui_surface` sind servergespiegelt und vor dem Laden wirkungslos. Matrix 48/48 Punkte, 432 Reiter-Messungen. Befund 1 (Überlauf) zurückgenommen: alle fünf Scroller gewollt, seit `v2092b`–`v2092e` als SCHIENE gezählt (`--dpm-schiene: 1`), 7 Schienen, 0 Mängel. Befund 2: Kontrast in 432 von 432 Reitern, Alternativ-Themes schlechter als die Hausfassung. Befund 3: Konsole erzeugt unsichtbaren Text (k=1,01), Ursache: 62 Sammelregeln in `style.css` lassen `konsole` weg. Quick-Check-Matrix 48/48 (`v2092f`, Art `OHNE REITER`).

### Erstanmeldung: 6 Stunden Gnadenfrist — 12.10.2026 (`v2094`, `0bbc37af`; `v2136`–`v2137b`, `91b5179a` … `23c22cc2`; `v2138`, `cc3bf354`) (früher N60.3)

Vormessung: `email_verified_at` blockierte nichts, `is_active` sperrte bis zum Klick; jeder frisch Registrierte bekam „403 Account is disabled“ (behoben `v2094`, `EMAIL_NOT_VERIFIED` gegen `ACCOUNT_DISABLED`). Weg (a) gebaut: `is_active=true` ab Anmeldung, Frist aus `config.auth.verifyGnadenfristStunden` an jeder Anfrage und beim Login, Band mit Restzeit, `POST /auth/resend-verify`. Eigener Fehler: `v2136` sperrte alle vier Staging-Konten aus (Stempel nie gesetzt) → Migration `086_verify_stempel_nachtragen.sql`. `v2138`: `requireVerified()` an den sechs Kontingent-Routen, Mail nennt die 6 Stunden. Prüfer `anmeldung-auskunft-pruefen.mjs` 68 Punkte RC=0. Prod: `v2136`/`v2138` liegen auf `main`.

### Pilot-Analyse: Datenzugriff und Investmentprofil — 08.–12.10.2026 (`v2009`, `033d46f6`; `v2139`/`v2139a`, `24f79752`; `v2140`/`v2140b`, `bd1e8831`, `8306cfb1`) (früher N60.4)

Teil 1 (`v2009`): vier Felder reisten mit und wurden nie gelesen (`aiOptions`, `verhandlung`, `dealpilot_marktbewertung`, `investor_score`), dazu Cashflow nach Steuer und Zinsbindung; am echten `buildPrompt()` 8/8 Blöcke. Teil 2 (`v2139`): fünf der sieben Punkte waren schon erledigt; 15 stumme Feldgruppen geschlossen, darunter der Regelblock „MIETVERTRAEGE JE EINHEIT“ ohne Werte; `v2139a` String zerfiel in Einzelbuchstaben. Prüfer `tools/prompt-lecks-pruefen.mjs`. Investmentprofil (`v2140`): sieben von 23 Schlüsseln reisen mit (Schwellen und Haltung), der Score sieht das Profil nie; `v2140b` kennzeichnet „(selbst gesetzt)“ gegen „(Vorgabe, nicht gesetzt)“, im Browser gefunden. Prüfer 47 Punkte RC=0, lokal, Host und Image.

### Bot-Kennzahlen und Barkauf im Score — 10.–12.10.2026 (`v2081` `3dcf991c`, `v2141` `ed8be81f`, `v2143` `b3b50996`, `v2144` `c85b06cd`) (früher N60.5)

Der Bot schrieb Kennzahlen frei in den Fließtext (vier Zahlen, vier verschiedene Mieten); der gespiegelte Kern `rechenkerne.kpis()` traf alle vier Sollwerte. `v2081`: ein fertiger `kennzahlen_block`, `miete_je_qm` jetzt konsistent mit `nkm + ze`. Marcels „44 → 80“ war ein Wechsel der Grundlage (abgeleitetes Darlehen, danach Barkauf). `v2141`: Barkauf ohne LTV/DSCR, umgewichtet (Marcels Wahl), finanziertes Objekt unverändert 58, Prüfer `tools/barkauf-score-pruefen.mjs`. `v2143`: Lageklasse als Maßstab der Bruttomietrendite-Ampel, Prüfer `tools/lageklasse-ampel-pruefen.mjs`. `v2144`: auch der Investor Deal Score lässt DSCR/LTV beim Barkauf weg (49 → 67, finanziert bleibt 85).

### Telegram-Bot und Piloten bidirektional, erste Stufe — 09.10.2026 (`v2010` `df19131d`, `v2011` `dce90fcc`, `v2012` `fe24c5cc`, `v2012a` `58ef3135`) (früher N60.4c)

Produktwissen (`bot-wissen.md`) mit einem gemeinsamen Lader für drei Piloten (`v2010`), sieben Feldblöcke (+46 Felder) in der Pilot-Analyse (`v2011`), Cockpit-Analyse abgelegt und im Bot über `portfolio_analyse_lesen` (`v2012`). Im Container nachgewiesen: Prompt 15.650 → 23.377 Zeichen, 22 Werkzeuge. `v2012a`: ein zurückgesetzter Eintrag `{text:null}` meldete `vorhanden: true` — geprüft wird jetzt der Text. Die Reste für „alle Daten“ stehen unter N60.4d.

### Fotos werden vom Piloten ausgewertet — 09.10.2026 (`v2013`, `b8d3b824`) (früher N60.4d)

Verkleinert wird im Browser über den vorhandenen `window._dpResizeDataUrl` (max. 768 px, JPEG 72 %, höchstens vier; gemessen 6 → 4 Bilder, 30 % kleiner). Vier Fehler einzeln gemessen und behoben: eigener zweiter Verkleinerer, falscher Zugriff (die Fotos stehen in `imgs`), Deckel `maxTokens || 700` (5 statt 22 Schlüssel), fehlendes Ausgabefeld — jetzt `optischer_eindruck`, nur wenn Fotos mitgehen. Echter Lauf: 23 Schlüssel, der Eindruck beschreibt die tatsächlichen Bilder.

### Fremdanalysen: Herkunftsstempel an der Analyse — 09.10.2026 (`v2015`, `7207c80e`) (früher N60.5b)

Sieben Demo-Objekte trugen byte-identisch dieselbe Pilot-Analyse, zwei weitere eine zweite. Der Wächter aus `v1849` war eine Heuristik und saß nur im Telegram-Werkzeug. Seit `v2015` trägt jede neue Analyse `_fuer: {objekt_id, kuerzel, adresse, stand}`, der Bot vergleicht exakt (`fremd_sicher`). Prüfer `backend/scripts/analysen-pruefen.js` (STEMPEL · DUBLETTE · VERDACHT; `v2015a`: je `user_id` gruppiert). Die offene Wahl „neu rechnen oder entfernen“ erledigte die Neuberechnung aller Analysen am 09.10.2026 (0 fremd, Prüfer über alle Nutzer RC=0).

### Stand und Gültigkeit der Analysen — 09.10.2026 (`v2017` `20fa16ff`, `v2018` `eed10f0f`) (früher N60.5c)

Statt `objects.updated_at` (ändert sich bei jedem Speichern) ein Fingerabdruck über 20 benannte Felder — der Kopf nennt, **was** sich geändert hat. Pilot-Analyse grün / gold / rot (anderes Objekt) / grau (kein Stempel, nichts behauptet); der Portfolio-Pilot vergleicht die Objektzahl statt der Zeit.

### Neuberechnung aller Analysen — 09.10.2026 (früher N60.5d)

Alle Objekte über den echten Bedienweg neu gerechnet: 13 von 13 korrekt gestempelt, alle mit vollem Fingerabdruck, 0 fremd oder ohne Stempel; Prüfer über alle Nutzer (17 Analysen) RC=0. Eigener Fehler: ein Läuferstart nach CDP-Zeitüberlauf lief trotzdem, ein zweiter Start rechnete `2026-1053` doppelt — der Zeitüberlauf betrifft nur den Antwortkanal.

### Kopf der Pilot-Analyse zeigte „kein Datum“ trotz Stempel — 09.10.2026 (`v2017a`, `0f4efaa6`) (früher N60.5e)

Ursache war die Reihenfolge: `_renderAIServerAnalysis()` lief vor `_analyseStempeln()`, der Kopf las `a._fuer` noch nicht; in `runMiniAI` stimmte sie von Anfang an. Gefunden am Bildschirm nach dem Lauf, nicht vom Prüfer.

### Eigenes Wissen dem Projektwissen hinzufügen — 09.10.2026 (`v2019` `0091fb68`, `v2020` `ac12352f`) (früher N60.11)

Zwei getrennte Blöcke im Prompt: PROJEKTWISSEN (die Datei, am Code belegt) und ERGÄNZUNGEN DES BETREIBERS (`user_settings`, Schlüssel `eigenes_wissen`); bei Widerspruch gilt der Projektblock, der Bot nennt ihn. Ein Lader (`zusatzFuer`/`blockFuer` in `projektwissen.js`, 60 s Zwischenspeicher) für drei Piloten, die doppelte Einleitung in `agentLauf` beseitigt. Das im Punkt noch offene Eingabefeld in den Einstellungen kam mit `v2020` (`settings.js`).

### Bot-Auskunft mit Score, KPIs, Gesamtbewertung und Stand — 09.10.2026 (`v2016`, `a7fd3eea`) (früher N60.6)

Die Werkzeuge lieferten `dealscore`, `investor_deal_score` und ihre Stufen längst, die Regeln verlangten sie nicht. Regel 7k: beide Scores mit Stufe (bei Fehlen warum), die Kennzahlen, eine Gesamtbewertung in Worten, der Stand; Ausnahme für Ein-Zahl-Fragen. Regel 7l: Bestandsfragen an `portfolio_analyse_lesen`. Nachgemessen 10.10.2026 in `agentLauf.js:177-194`, Werkzeuge `pilot_analyse_lesen`/`portfolio_analyse_lesen` registriert.

### Wohnungsfenster im MFH-Konfigurator und Kombinatorik — 09.10.2026 (`v2021` `fe1c15c9`, `v2022` `222e8469`) (früher N60.8)

Je Einheit ein Knopf in der Tabellenzeile und ein Fenster mit 6 Abschnitten / 28 Feldern (Stammdaten, Miete, Mietvertrag mit den Vertragsformen des BGB samt Fundstelle, Zustand, RND, bis 6 Bilder), gespeichert ohne Migration in `d._mfh.einheiten`. Beim Duplizieren wandern Bilder und Mietername nicht mit. `v2022`: neun Felder gehen in die Pilot-Analyse, Mietername per Prüfer ausgeschlossen. `v2022a`: `ReferenceError: ein is not defined` erst im Container gefunden. Abgenommen am Objekt `2026-1056`.

### Mietvertragsangaben auf Objektebene — 10.10.2026 (`v2087`, `be96a337`) (früher N60.8-alt)

`mv_art`, `mv_beginn`, `mv_letzte_erhoehung` im Reiter Miete für jede Objektart, dieselben Feldnamen wie in `_mfh.einheiten[]`. Die elf Vertragsformen liest `mietvertrag-objekt.js` aus `mfh-einheiten.js` (keine zweite Liste, 11 Optionen im Browser). Gespeichert nachgewiesen: Feldliste in `storage.js`, `collectData()` gibt sie zurück. Eigener Fehler vor dem Ausrollen: `window.getFormData()` gibt es nicht, Quelle ist `window._dpMfh`.

### Wohnungsliste mit Detailfenster und Bewertung je Einheit — nachgemessen 10.10.2026 (`v2021`, `v2022`) (früher N60.9)

Zeilenknopf und Fenster in `mfh-einheiten.js` (Stammdaten, Miete, Mietvertrag, Zustand, Bilder bis 6), Bewertung je Einheit, flächengewichtete Summe und Übertragung in den Reiter Objekt. Das eigene RND-Feld je Einheit wurde in `v2023` (`fbbde015`) absichtlich wieder entfernt — die RND je Einheit kommt aus dem Zustand.

### MFH-Einheiten: Vererbung geprüft, RND-Eingabe vollständig — 10.10.2026 (`v2095` `de38c850`, `v2095a` `fd7cc765`) (früher N60.10)

Die Vererbungsliste war schon gebaut (`GEB_IDS`/`WE_IDS` in `mfh-einheiten.js`, alle acht Gewerke genau einer Seite zugeordnet, deckungsgleich mit § 5 WEG). Echter Mangel: `rndFuer()` gab dem Kern 4 von 10 Feldern (ohne `kernsaniert` bis +3,4 Jahre, Stichtag fest auf heute). Jetzt über `mapDealPilotObject(collectData())` wie `deal-action.js`; Prüfer `tools/mfh-rnd-eingabe-pruefen.mjs` (14 echte `calcAll`-Läufe, RC=0). `v2095a`: Stichtag und GND stehen sichtbar unter der Einheitentabelle.

### Prozesskarte für die Messe — 10.10.2026 (`v2088`, `77fccc39`) (früher N60.20)

`design/Messe/prozesskarte.html` im Pilot-Stil: drei Bahnen (Quick-Check · Ankauf · Bestand), neun Stationen, je Station was man tun kann und was dabei herauskommt. Jede Zahl aus ihrer Quelle gemessen (Etappen, Marktbericht-Stufen, Score-Schwellen, Exportfelder, Pflichtfelder), keine unbelegten Zahlen; helle A3-Druckfassung aus derselben Datei. Prüfer `tools/prozesskarte-pruefen.mjs` RC=0.

### Onboarding: Aktenmappe als Standard, Vorschau in place — 10.10.2026 (`v2083` `ce37b14d`, `v2096` `6266495f`) (früher N60.21)

Teil 1: Aktenmappe an erster Stelle, `standard: true` und vorausgewählt, ihre Objektkarte `datenzeile`; der Kartenname kommt aus dem Modul statt hartkodiert. Teil 2: die Vorschau in place existierte schon, aber ein dunkler Schleier `rgba(5,5,5,.34)` nahm den hellen Fassungen 60 % Helligkeit und Obsidian keine. Im Schritt „Aussehen“ fällt er weg (`.dpo-ov-schau`), der Kasten liegt unten rechts, ab 900 px; im Browser bei 1280 px abgenommen (Kopf, Reiter, Seitenleiste 0 % verdeckt).

### Pillen am Co-Piloten — 10.10.2026 (`v2082`, `f0239c38`) (früher N60.22)

Sechs Pillen: zwei beantwortet die App selbst und kostenlos (Datentiefe, Was fehlt? — aus `DealPilotReadyCheck.getData()`, mit Sprung-Chips), vier setzen eine Frage ins Eingabefeld. Im Browser abgenommen: alle erreichbar, Werte deckungsgleich mit `getData()`. Nicht gebaut: Feldänderungen direkt aus dem Dialog — von Marcel als nachrangig benannt.

### Pflichtfelder je Eingabetiefe im Readycheck — 10.10.2026 (`v2079`, `c1a858ee`) (früher N60.23)

Die Staffel existierte schon (`pflichtFuer(stufe)` in `objekt-reiter.js`: 6 / 13 / bis 20). Der Readycheck zählte 15 feste Felder des Investor-Deal-Scores, übersprang nicht vorhandene IDs still und kannte drei Score-Felder nicht (`ds2_marktfaktor`, `ds2_marktmiete`, `ds2_zustand`). `v2079` fragt beide Listen, nennt die Stufe in der Überschrift und nimmt die Beschriftungen aus `DealPilotObjektReiter.FELDNAMEN`.

### „Kerosin“ aus dem Nutztext — 10.10.2026 (`v2078` `02ddf862`, `v2097` `ca81ab09`) (früher N60.24)

Neuer Wächter `tools/kerosin-nutztext-pruefen.mjs` (420 Dateien, 12,9 MB): 25 Treffer, die meisten Funktionsnamen, Filter, Protokoll oder die stillgelegte Paketliste. Fünf Textstellen behoben — live nur `quickcheck-app.html`, `credits.js`/`welcomeMail.js` latent, `pricing-modal.js` nicht gerendert, `kerosin-confirm-lage.js` tot. Drei Fehler im Wächter behoben (Zeilennummern, Nutztext-Anteil, Bezeichner gegen Prosa).

### API-Export: Bonität, Grunderwerbsteuer, Mietverträge, Halter — 11.10.2026 (`v2102` `026907e4`, `v2103` `07ab9b7a`) (früher N60.33)

Bonitätswerte und Mietvertragsfelder waren schon da (am echten Export gezählt). `v2102`: `portfolioExport.js` leitet aus der PLZ `bundesland`, `grest_satz_amtlich` und `grest_herkunft` ab, getrennt von der Eingabe `gest_p`; 21 von 23 Objekten mit Land, Prüfer `tools/grest-export-pruefen.mjs` (55 Punkte). `v2103`: je Objekt `halter`, `halter_seit`, `halter_rechtsform`, `steuersphaere`, `halter_herkunft`; `steuersphaere` bleibt `null`, wo der Server nichts weiß (`sphaere()` bleibt einziger Schiedsrichter), Prüfer `tools/halter-export-pruefen.mjs` (55 Punkte).

### Kontrast der Skalen-Beschriftungen auf der Objektkarte — 11.10.2026 (`v2104` `b43b1903`, `v2104b` `2737b2d3`; `v2105` `3c6ac65c` zurückgerollt mit `a78de89b`) (früher N60.34)

161 Stellen `.sbcm-scale span` (7,5 px, Schwelle 4,5) lagen zwischen 1,76 (heller Skin ohne Regel) und 4,39. `v2104`: deckende Töne statt Deckkraft (der Grund ist ein Verlauf), `v2104b`: jede Vorlage einzeln nachgemessen, eigener Ton je Vorlage — 8 Fassungen × 161 Stellen über 4,5, Prüfer `tools/kartenskala-kontrast-pruefen.mjs`. `v2105` (Ton aus dem Farbregler abgeleitet) war live schlechter (1,77) und ist zurückgerollt; die Frage, wo der Regler überhaupt greift, ging in N60.35 über. Der vermutete `lade()`-Werkzeugfehler wurde gemessen und zurückgenommen.

### Score-Ring und Aktionsknöpfe überlappten — 11.10.2026 (`v2110` `5d69a5b9`, `v2110a` `170ca71a`, `v2114` `1beec3ec`) (früher N60.37)

Ursache: `v1943` setzte Score und Knöpfe beide auf `top:50%` und hob die Staffelung aus V103 auf (21–42 px Überlappung). `v2110`/`v2110a`: der unsichtbare Knopf fängt keine Klicks mehr, auf Touch bleiben Duplizieren/Löschen bedienbar; Prüfer `tools/deckkraft-klickbarkeit-pruefen.mjs`. Die sichtbare Überdeckung löste `v2114` (Staffelung aus `f843cc8d~1`: Knöpfe `top:6px`, Score `38px`) — 0 px Überschneidung auf drei Karten (vgl. N60.38).

### Kartenstile: Standardkarte, Bordkarte, Score-Kante — 11.10.2026 (`v2114` `1beec3ec`, `v2115` `914c0d28`, `v2116` `410e550d`) (früher N60.38)

`v2114`: Staffelung der Standardkarte aus der Versionsgeschichte zurück (Knöpfe 7–29, Ring 39–89, 0 px Überschneidung); der „Aktenreiter“ ist diese Standardkarte (Schlüssel `''`). `v2115`: die Abrisskante lief 6 px durchs Bild, weil `margin-left` Streifen und Inhalt gemeinsam schob — jetzt `padding-left:27px`, 0 von 21 Karten. `v2116`: die Score-Kante zeigte den Deal-Status statt des Scores; jetzt Farbe nach Score-Stufe über `:has()`, 21 von 21 richtig, der Status bleibt im „Won“-Band.

### Datenaufnahme-Karte über alle Geräte — 11.–12.10.2026 (`v2119`+`v2120` `75cffa10`, `v2121`+`v2122` `4514fda8`, `v2121a`, `v2133` `77fda9bb`, `v2133a` `5c26d4be`) (früher N60.39)

Matrix 4 Stile × 12 Breiten. Behoben: gekappte Beschriftungen und QR bei 1180–1440 px (`v2119`), Gold-auf-Gold-Knopf bei 390 px (`v2120`), 1263 px breite Leiste auf dem iPad lautlos geklippt (`v2121`), Knopf und Kacheln unter 44 px (`v2121a`), Gegenregeln aus `v1941a–d` ausgetragen (`v2122`). Ursache war kein Überlauf, sondern schrumpfende Kinder — jetzt Umbruch statt Schrumpfen. Der Stil „Zeile“ wirkte nie (`body.dp-pfzeile` nirgends gesetzt): `v2133` hängt die Klasse an die ausdrückliche Wahl, auch im QuickBoarding-iframe; `v2133a` Knopf 44 px. Abnahme 2 Stile × 10 Breiten: KAPP/RAUS/ZUBREIT/QUER 0, Textkontrast überall ≥ 4,5.

### Cockpit-Vollbild-Stummel entfernt — 12.10.2026 (`v2128`, `1e6c35e4`) (früher N60.40)

Geräteabnahme Durchgang 1 (8 Geräte × 9 Reiter, 8.778 Bedienelemente): einziger echter Fund ein 2 × 20 px großer Standardknopf `.dp-sidebar-toggle`, 4.000–7.200 px tief in der Seite. Er schaltete `dp-dash-fullscreen`, das gemessen kein Pixel bewegt (sieben Eigenschaften, zwei Breiten); `dp-show` liest keine Regel. `v2128` blendet ihn aus — keine Funktion verloren, denn es gab keine.

### Preisfenster: Vergleichstabelle auf dem Handy zugeklappt — 12.10.2026 (`v2132` `5be70125`, `v2132a` `77fda9bb`) (früher N60.41)

Das Preisfenster war bei 360 px 10.078 px hoch (13,3 Bildschirme), 45 % davon die Vergleichstabelle. Weg (b) nach Marcels „mach es so das es funktioniert“: unter 900 px ist nur die Tabelle zugeklappt, Preise, Pläne, Reihenfolge und Knöpfe unberührt; Knopf mit `aria-expanded`, 44 px, Textkontrast 10,54. `v2132a`: die Falte läuft im eigenen Takt mit `try/catch` statt als fünfter Aufruf in einem `setTimeout`.

### Marktbericht: helles Grau inline auf hellem Grund — 11.10.2026 (`v2100`, `f25c55e1`) (früher N60.32)

Quick-Check-Matrix (48 Punkte) und Marktbericht-Lauf (8 Geräte, Layout hält, kein Querscroll) gemessen. Behoben, was keine Farbentscheidung war: `wertermittlung.js:908` trug `<b style=„color:#c8c8d0“>` (k 1,66) auf der seit `v895e` immer hellen Seite; jetzt die Dokumentvariable `--txt` (k 14,8). Ursache der übrigen Stellen benannt: `.mbst h4` setzt helles Gold `#E8CC7A`, der `data-mb-theme=„light“`-Block zieht die Hintergründe um, die goldenen Textfarben nicht.

### Kontingent-Regel: Texte richtiggestellt — 10.10.2026 (`v2077`, `a463c7a1`; `v2077a`, `033cc402`) (früher N60.25)

Regel (Marcel 10.10.2026): Gekauftes verfällt nicht, Monatliches verfällt; Verbrauch Monat → Testphase → Gekauftes. Am Code gemessen: `aiCreditsService.js` tut genau das. Falsch waren die Texte — `ai-credits.js:183-184` versprach live im Tooltip „Nicht genutzte Bewertungen verfallen nicht“, dazu `landing/fragen.html:154` und der Dateikopf von `aiCreditsService.js`. In `v2077` korrigiert.

### Rechenkern-Schnittstelle Marktbericht: der 422 war ein Feldname — 10.10.2026 (`v2076`, `3f50e749`; `v2076a`, `2f6c3571`) (früher N60.26)

`/reports/from-dealpilot` meldete „Keine Koordinaten“, obwohl die Adresse vollständig war. Zwei Ursachen hintereinander: das Feld heißt `object`, nicht `objekt` (abgeschrieben von `dealpilot-mb.js:603`; `objektart` und `objart` beide schicken), und die Wertstufe gehört in `overrides`, sonst rechnet der Bericht still als Stufe 1 ohne Boden-, Ertrags- und Sachwert. Gegengetestet an `2026-001`: HTTP 200, `cross_check.available: true`, Bodenwert 40.338 EUR, RND 41,7 aus 11 Modernisierungspunkten. Ein Aufruf kostet 0,73 EUR GeoMap (für die Bepreisung).

### BFH IX R 7/12 aus dem Schadenskatalog entfernt — 10.10.2026 (`v2080`, `c1a858ee`) (früher N60.27)

Das Zitat stand nur im Kommentar `rnd-calc.js:117`, in keinem Nutztext. Entfernt und durch die ehrliche Herkunft ersetzt (sachverständige Orientierungswerte des Hauses). Bewacht von `tools/rnd-eingabe-pruefen.mjs` Abschnitt 10.

### Mandanten am Konto statt nur im Browser — 14.10.2026 (`v2212a`, `943cb64b`) (früher N60.28)

Vormessung 10.10.2026: `halter` ist eine Mandanten-KENNUNG (`mandanten.js:117`), die Mandanten samt Rechtsform lagen aber nur im `localStorage` (`dp_mandanten`), der Server kannte sie nicht. Gemessen 14.10.2026: in Marcels Konto kannte der Browser nur „Privat“, zwei Gesellschaftsobjekte fielen auf „Privat“ zurück. Seit `v2212a` liegen die Mandanten in `user_settings` (`/user-settings/mandanten`).

### Ankauf-Stand im Objekt statt Soll-Duplikat — 09.10.2026 (`v2030`–`v2043`), nachgemessen 10.10.2026 (früher N60.12)

Marcels Wunsch (gewonnenes Objekt als Soll festhalten, Doppelkarte Soll/Ist) gebaut als eingefrorener Ankauf-Stand IM Objekt, nicht als zweites Objekt: `ankauf.js` (`festschreiben()`, `korrigieren()` mit Historie, `abweichung()`, `vonSelbst()` bei „gewonnen“, v2041), `doppelkarte.js`, `abweichung.js`, `ankauf-ansicht.js`, alle in `index.html` geladen; Auslöser am Status (`deal-action.js:2452`), `objectService.js:50` liefert `ankauf_kurz`/`ankauf_stichtag`. Die als BLOCKIERT geführten sechs Entscheidungen waren damit durch den Bau überholt. Konzept: https://claude.ai/artifact/FdseTiFq1wK6ECrwHEAxGJ

### Portfolio-Export und Excel-Spalten — 09.10.2026 (`v2043`, `22c7742e`; `v2043c`) und 10.10.2026 (`v2066`, `v2067`–`v2067b`, `v2086`, `3fb9ebc4`) (früher N60.13)

`GET /objects/portfolio-export` plus Menüeintrag „Portfolio komplett“: JSON (alles) und CSV aus einem Abruf, mit Lexikon (`felder` seit `v2043c` nachschlagbar, `strukturen` seit `v2066`), Pilot-Analyse samt Stempel, eigenem Wissen einmal. Gemessen: 286 Felder je Datensatz, von 291 Formularfeldern fehlen nur Schalter/Anzeigefelder, kein echtes Datenfeld. `v2086`: sechs Spalten mehr im Excel (`RND_Jahre`, `RND_Verfahren`, `RND_Stand`, `AfA_RND_angesetzt`, `Vertragsart`, `Ankauf_Stichtag`). Die JSON-Sicherung (`storage.js:2214`) trägt die neuen Felder schon. `afa_rnd_jahre` bleibt bewusst Nutzereingabe neben `_rnd` (11.10.2026, Leitung per Durchstich belegt).

### Geführte Eingabe entschlackt und auf allen Größen bedienbar — 09.10.2026 (`v2049`–`v2054`, `v2055`–`v2059`) (früher N60.15)

Punkte 1, 2, 4, 6, 7 aus Marcels Auftrag (`Dateien/geführteeingabe.png`): Freisprechen- und „Alle Felder“-Schalter weg, Fußzeile auf 0 px, eine Blase je Schritt am Einstieg, doppelte erste Frage beseitigt, „erklär mir das“ auch getippt, Übernahme-Meldung nur noch für Neues (Commits `fcc866d8`, `121020e9`, `2fbcc881`, `49ec9858`, `8d9cfb23`, `80216985`, `5d32215d`). Messkabine fand einen Priorität-1-Fehler: auf dem Handy war die Tonfrage nicht zu beantworten (Chips verdeckt, 601–767 px komplett unbedienbar); behoben in `v2055`–`v2059` (`c4efaf4b` … `cfe09ee4`), Abnahme 13 Größen je Chip auf eigenem Mittelpunkt 3/3.

### Responsive-Durchgang: Prüfwerkzeug, Tabellen, iframes, Datenaufnahme, erste Kontrastrunde — 09.–11.10.2026 (`v2060`–`v2065`, `v2089`, `v2090`, `v2117`–`v2117b`) (früher N60.17)

`DPM.pruefeAnsicht` und `DPM.pruefSelbsttest` dauerhaft in `frontend/messkabine.html` (prüft jedes Bedienelement per `elementsFromPoint`, jeden Verdacht zweimal). Breite Tabellen auf dem Handy als Karten (`v2060`–`v2060c`, `c46820a3` …), Querscroller 320–1920 px: 0; `single`, `dashboard`, `all`, `strategie`, Quick-Check und Marktbericht samt Modals ohne unerreichbares Element. Datenaufnahme (`v2117`, `008c0c64`): drei von vier Pre-Flight-Kacheln waren auf Tablets unerreichbar (Lücke zwischen 900- und 640-px-Grenze), Abrufen-Knopf eingerückt; Abnahme auf sechs Geräten. Kontraste: `.ds2-tag` k 2,06 → 7,81 (`v2089`), bei vier von sechs Stellen war die Deckkraft der Fehler (`v2090`).

### Kontrast: Gold und Statusfarben als Textfarbe — entschieden und umgesetzt 11.10.2026 (`v2101`, `477ba39c` … `v2101d`, `1a7d09a3`) (früher N60.29)

Marcel 11.10.2026: „kontrast vorschlag so umsetzen“ — Weg (a) für Zahlen/Tabellen, Weg (c) für Abzeichen, nach Demo `frontend/kontrast-cockpit.html` (`v2091`, geprüft von `tools/kontrast-demo-pruefen.mjs`). Eigene Textvariablen (`--dp-green-txt`, `--dp-red-txt`, `--dp-gold-txt`, `--dp-muted-txt`, `--c-acc2-txt`, `--c-accd-txt`) statt Umfärben der Variablen, die auch Balken füllen; Gold nicht über `--wl-c9a84c`. Gruppen unter 3,0: 19 → 1, schlechteste 1,71 → 2,29. Dabei Messgerät-Fehler in `effGrund` behoben (`v2092g`: Vorfahren-Pseudoelement vor eigenem Grund gefragt).

### Bestand im Cockpit und im Kanban — 10./11.10.2026 (`v2084`, `e7acb12e`; `v2098`, `59a4ab7f`; `v2099`, `437d8ad2`) (früher N60.16)

Kanban mit Spalte Bestand (gewonnen und Ankauf-Stand), abgenommen 15 · 4 · 4 · 0 = 23; dabei drei stille Fehler behoben (`v2084a/b`: `loadObjects()` las `data.objects` statt `items`, `getStatus()`/`getKPIs()` lasen `data` aus der Listenantwort — Investitionsvolumen stand auf 0 statt 4.018.000 €). Kachel „Seit Ankauf“ mit EINER Rechnung (`abweichungFuer()`, `tools/ankauf-abweichung-pruefen.mjs` 39 Punkte). Summen wahlweise auf Ankauf oder Bestand über dieselbe `aggStats()`, mit Sperren gegen stille Nullen. Sortierung im Ankauf-Modus zurückgenommen: keiner der vier Sortiermodi liest eine Kennzahl mit Ankauf-Wert (gemessen 10.10.2026). Nebenbefund ungeklärt: 4 Objekte mit `ankauf_stichtag`, 3 mit `_ankauf`-Block.

### Objektübersicht wieder erreichbar, Lageklassen-Kette geprüft — 08.10.2026 (`v2008`, `ba015bc9`) (früher N59)

Die Ansicht „Alle Objekte" war gebaut, aber ohne Eingang (es fehlte ein `<button>`; `ui.js:294` greift nach `.sb-iconnav-btn[data-iconnav]`, das es nicht gibt). Eingang zurück; die Kette der Lageklasse end-to-end an `2026-004` geprüft (Feld → Server `"B"` → Karte → Pille in der Übersicht).

### Marktbericht: Karte, Berichtsliste, iPad-Breite und Seiten-Buster — 08.10.2026 (`v2004`–`v2006`, `f6832d85`/`05a631b3`/`c445296b`) (früher N58)

Carto-Kacheln lieferten HTTP 200 mit „API KEY REQUIRED" → OSM-Standard. Berichtsliste per `@container` statt Fenster-Media-Query. 1024 px (iPad) hatte 196 Überläufe: `1fr` → `minmax(0,1fr)` (10 Ersetzungen) und Umschaltpunkt. Der Buster der Marktbericht-Seite (`marktbericht-view.js`) stand seit v1877 fest, das inline-CSS kam aus dem Cache. Messkabine nach v2006: acht Geräte 360–1280 px, 0 Überläufe.

### Eingabetiefe-Fehlzeile und Liegenschaftszins § 256 BewG — 08.10.2026 (`v2001`, `v2002`) (früher N57)

`#oe-fehlt` folgte nur `stufeAbrufen()`, nicht den Kreisen und nicht `dp:object-ready` → eine Stelle `fehlZeileSetzen()` (v2001). § 256-Hinweis um den Zweck ergänzt (§ 256 Grundsteuer, § 188 Erbschaft/Schenkung MFH 3,5 %, § 21 Abs. 2 ImmoWertV Verkehrswert); Text wird aus `BEWG_RAHMEN` gebaut, alle 16 Fälle von `lzsNach256()` stimmen (v2002, `64cff5af`).

### ImmoMetrica live, Anbieter stillgelegt, Riegel, Adressabgleich, Ortskern — 08.10.2026 (`v1993`–`v2003`) (früher N56)

ImmoMetrica-Demo kam aus dem Frontend (fragte `/avm/health`), eigene Auskunft `/immometrica/health` → `live` (v1993, `cfdf7d5c`). Sprengnetter/PriceHubble `enabled:false`, Zugangsdaten bleiben; leeres `AVM_LIVE_PROVIDERS=` schaltete bis dahin alle frei, jetzt keinen (v1994, `da01fa8b`). Riegel: gefülltes Objekt bekommt keine Importquelle mehr (v1995, `9a749733`). Ortskern ohne Adresse (Marcels Entscheidung, v1999), Adressabgleich mit Rückfrage nur bei echtem Widerspruch (v2000, `8bf6ef62`), `parseAddr` steckte die Stadt in die Straße (v2001), „Weitere laden" und Favoriten zuerst (v2003, `eee0eec1`).

### Grunderwerbsteuer folgt der Objektadresse — 15.10.2026 (`v2261`/`v2261a`, `3dcec6c5`/`d6ef4230`) (früher N52)

Die Sperre „nur bei 0 oder 6,5" ist ersetzt: übernommen wird, solange der Nutzer nicht selbst editiert hat (`dataset.userEdited`); Vorgabe ist der Satz des Profil-Bundeslands, ein von der Automatik gesetzter Satz folgt einem PLZ-Wechsel. Haken „Grunderwerbsteuer automatisch nach Bundesland" in den Einstellungen; Nebenkosten getrennt aus dem Investmentprofil.

### Amtliche Vergleichsfaktoren im Register — 08.10.2026 (`v1975`–`v1977b`) (früher N50)

Kennzahl `vergleichsfaktor` in der Saat; 9 Sätze (Barnim 2 Werte mit reproduzierten Anwendungsbeispielen, Berlin 3 Werte `verwendung: intern` zurückgehalten + 1 Sperre, Saarland 7 Sperren). Registerweg in `ReportOrchestrator`/`CrossCheckService` verdrahtet. Dabei behoben: Sperre war toter Code (`verwendung` nicht zurückgegeben), Achsennamen je Ausschuss, Bezugsgröße BGF statt Wohnfläche (Berlin), `TypeError` bei unbekannter Einheit; `fehlendeSaatdateien()` und die Beleg-Prüfung in `saat-pruefen.mjs` repariert.

### Unterlagen-Modul: Ansprechpartner 1 und 2 aus v6, Belegprüfung je Seite — 12.10.2026 (`v2151`–`v2153`, `8786a4ad`; sichtbar `v2440`–`v2445`) (früher N51)

Link-Teil schon v1971c (`antrag_url` stand im `else if`). v2151: `belegPruefen()` verfehlte 7 von 19 verschleierten Schreibweisen und bestätigte zu lax → `mailsAufSeite()`, `belegSeiten()` mit `pro_seite` in der vorhandenen `jsonb`-Spalte `seiten`. v2152: Migration 087 `ansprechpartner jsonb`, KI-Auftrag wörtlich aus v6, Zusammenbau `personenAus`, `PUT /unterlagen/amt/:id/kopie`, CC im mailto; Rechnungspostfach galt als Person (v2152b). Nachweis `tools/beleg-leser-pruefen.mjs` 79 Fälle RC=0, auch im Container. Sichtbar seit v2440–v2445 (N61.6).

### „Vergleichswert" aus Angeboten umbenannt — 08.10.2026 (`v1971`) (früher N48)

Gemessen: der Vergleichswert war zu 100 % ein Median aus Portalinseraten. Marcels Entscheidung: ohne kaufpreisbasierte Grundlage kein Vergleichswertverfahren; die Zahl heißt „Marktpreisindikation aus Angeboten", die PDF-Karte sagt „amtlich" nur über einer amtlichen Zahl. Kaufpreisbasierte Vergleichsfaktoren seit N50 (v1975–v1977b).

### RND-Altlasten: RND-Gutachten-PDF und Dublette raus — 08.10.2026 (`v1970`, `b679b9e4`; `v1974`, `ea971e68`) (früher N49)

Marcels Entscheidung „die Leute bekommen erst mal kein RND-Gutachten": `rnd-pdf.js`, `rnd-docx.js`, `rnd-bte-katalog.js` und der tote Teilbaum in `rnd-wizard.js` gelöscht, rund 3.800 Zeilen (v1970). `marktbewertung-card.js`/`.css` der Hauptapp raus (v1974) — die CSS war keine reine Dublette, ihr Block aber unerreichbar.

### Marcels Entscheidungen vom 08.10.2026 umgesetzt — 08.10.2026 (`v1969`–`v1972`, `v1971c`)

RND-Untergrenze 10 in beiden Zweigen (v1969); der geprüfte Anlage-2-Kern gilt (v1966/v1969); Vergleichswert ohne Kaufpreisgrundlage raus bzw. umbenannt (v1971); RND-Gutachten-PDF raus (v1970); Modernisierungspunkte als acht Chips mit Absprung (v1972); Unterlagen-Portal-Link (v1971c). Die damals offen gebliebenen Punkte stehen bei N47b, N49, N50, N51.

### Zwei Anlage-2-Kerne gleichgezogen — 08.10.2026 (`v1966`/`v1969`, `bcf4663a`) (früher N47)

Das Backend (`anlage2.js`) rechnete jenseits der GND weiter (Bj 1905 bekam mehr RND als Bj 1964). Marcels Entscheidung: der gegen Gutachten geprüfte Kern gilt. Beide Kerne identisch über 1.764 Fälle, dazu 13.600 Ausliefer-Fälle monoton; Wächter `tools/rnd-kerne-pruefen.mjs`, RC=0.

### 0 Modernisierungspunkte sind eine Antwort — 08.10.2026 (`v1973`, `2f32b56b`) (früher N47b)

`_num()` in `rnd-einheitlich.js` verlangte `> 0`, `mod_punkte: 0` fiel auf „kein Modernisierungsgrad". Seit v1973 unterscheidet der Kern über `mod_angaben` zwischen „0 Punkte erfasst" und „nichts erfasst".

### Mapper multiplizierte Punkt-Dezimalzahlen mit 10/100/1000 — 07.10.2026 (`v1962`, `99bc7f66`) (früher N46)

`num()` in `DealPilotObjectMapper.js` löschte jeden Punkt als Tausendertrenner („3.5" → 35, „64.58" → 6458); betroffen 25 Objekte, 365 Feldwerte. Am echten Objekt: Sachwert 1.717.808 → 138.463 €, 17 Proben grün. Nebenbei `mandanten.js:645` (unmaskierter Punkt, Kaufpreis immer `NaN`) behoben.

### Datenaufnahme auf allen Gerätegrößen — 08.10.2026 (`v1985`–`v1992`) (früher N45)

Trichter raus (v1985), Bordkarte seit v1953; Datenaufnahme auf dem Handy wieder erreichbar (v1987, `_pfScanQ` löste sich nur im rAF); Lesbarkeit 390 px ohne Durchfaller (v1989); Feldhilfe 1,36 → 9,50 : 1 und Stufen-Pillen 1,13 → 14,81 : 1 (v1990); Lampe 12×12 (v1991); QR weg unter 900 px rein in CSS, Kasten 92×92 (v1992). Ursache der gescheiterten Anläufe: 62 Selektoren mit `:is(#oab-bar,#qc7-sources)` erben ID-Spezifität. Am 12.10.2026 gezählt: 34 `@media`-Blöcke, 320–1920 px abgedeckt.

### Unterlagen-Modal trägt die Marke — 04.10.2026 (`v1843`, `6aa6184f`) (früher N1)

Modal im DealPilot-Stil; „Amt ermitteln" und „Anschreiben" standen weiß auf Creme (Kontrast 1,00), jetzt lesbar.

### Unterlagen: „Alle abrufen" — 04.10.2026 (`v1843`, `6aa6184f`) (früher N2)

Knopf „Alle abrufen" im Unterlagen-Modal (`DealPilotUnterlagen.alleAbrufen()`), holt die Unterlagen nacheinander.

### Gemarkung, Flur, Flurstück als optional ausgewiesen — 04.10.2026 (`v1843`, `6aa6184f`) (früher N3)

Gemessen: die Angaben sind optional. Der Satz „muss das Amt … selbst heraussuchen" klang nach Pflicht; jetzt steht „Optional:" mit Hinweis, wo man sie findet.

### Reiter Objekt neu geordnet — 04.10.2026 (`v1851`–`v1855`) (früher N4)

Schritte 1–3 gemessen (37 Felder des Wertermittlungs-Blocks erreichten den Bericht nicht; Stufe 3 aus der Haupt-App unerreichbar), Marcels Entscheidungen §5.6 vom 04.10.2026. Gebaut v1851–v1851c: Mapper, Stufe 3 im Objekt-Weg, Automatik-Leiste, Formular in drei Ebenen, Feld-IDs unverändert (873 = 873); Eingabetiefe 1/2/3 (v1852); „Ihre Einschätzung" im Bericht (v1853, `05d331f`); Prüfstrecke Exporte bestanden (v1855). Empfindlichkeitstest je Mapper-Feld seit `tools/objekt-mapper-pruefen.mjs` (v2148).

### „BORIS abrufen" heißt „Bodenrichtwert abrufen" — 04.10.2026 (`v1842`, `dda02b31`) (früher N5)

Die Registry kennt neben den Landesdiensten `borisd` als bundesweiten Catch-all; Knopf und Statuszeile heißen jetzt „Bodenrichtwert abrufen", die konkrete Quelle steht im Ergebnis.

### Pilot-Analyse: Marktpreis-Abruf in den Co-Piloten — 04.10.2026 (`v1848`, `8bc9ed5a`) (früher N6)

Knopf `dp-cp-mp` raus, Abruf als `__dpCpMarktpreis` beim Co-Piloten; `marktpreis` bucht jetzt Konto `avm` (vorher falsch `mpi`). Im Browser bewiesen: Rest 0 → „kein Guthaben mehr", Rest 24 → Box mit Kosten.

### Pilot-Analyse im Projektwissen — 04.10.2026 (`v1847`, `5ca46455`; `v1849`) (früher N7)

Werkzeug `pilot_analyse_lesen` (Stufe `lesen`) liefert Briefing, Stärken, Risiken, Szenarien, Lage, Verhandlung, Bank; `objekt_lesen` gibt `ai_analysis` nicht mehr roh heraus; Browser-Co-Pilot bekommt `pilot_analyse`. Prüfer `tools/agent-pruefung/pruef-pilot-analyse.js`. Seit v1849 Warnung `fremd_verdacht`, wenn die Analyse den Ort des Objekts nicht nennt.

### Cockpit-Grund, Sortierknöpfe und Menüknopf — 06.10.2026 (`v1904`/`v1904a`, `5d9c280e`, `aa3cadd8`, `a277419c`) (früher N37)

Der behauptete Obsidian-Grund von `#dashboard-main` existierte nicht (zurückgenommen); Cockpit an `--page-bg` gebunden. `button.sb-sort-btn` in „Heute" 13 px Überlappung → `gap:18px`. Das „X" des Menüknopfs neu vermessen und beim Schließen der Schublade mitgenommen (`closeMobileSidebarOnAction()`, `resize`-Handler).

### „Portfolio-Strategie" räumt das Cockpit ab — 06.10.2026 (`v1905`, `d3e7ff22`) (früher N38)

Register der Hauptansichten in `js/ui.js` (`DealPilotAnsichten.abraeumen`), `#all-objects-main` mitbehoben; `closeDashboard()` setzte `#s-quick` blind zurück. Nachgemessen in vier Aussehen bei 390 und 1180 px.

### Kartenstil „Kennzahlen": Knopfzeile nicht mehr über der dritten Kachel — 06.10.2026 (`v1905`, `d3e7ff22`) (früher N39)

Die Zentrierregel (v1903) hing Ring und Knopfzeile an die Kartenmitte, die bei „Kennzahlen" im Raster liegt; „Kennzahlen" geht auf `top:6px`. Am Text nachgemessen: keine Überdeckung mehr, alle Umschalter per `elementFromPoint` erreichbar.

### Kartenstil „Ampel" und „Minimal": 40,6 px Zeilenhöhe — 06.10.2026 (`v1905`, `d3e7ff22`) (früher N40)

Marcels Entscheidung „etwas höher": beide Stile von 27,6/31,6 auf 40,6 px, nur am Handy-Anker; Schreibtisch bei 1180 px unverändert nachgemessen.

### Portfolio-Menü der Aktenmappe auf dem Handy — 06.10.2026 (`v1903`/`v1903a`, `6bf9df08`, `ac4bf93a`, `878bbd0d`) (früher N36)

Liste als Standardinhalt (318 → 484 px), Aufklapper unten, Register auf Knopfdruck; kompakte Kartenstile 122 → 45 px, Partikel in der Aktenmappe aus. Die zwei damals offenen Punkte (Sortierknöpfe in „Heute", Grund von `#dashboard-main`) sind mit v1904 (N37) gelöst; die Commits liegen auf `main`. Eine eigene Abnahme Marcels ist nicht vermerkt.

### Aktenmappe auf dem Handy — Marcels vier Einzelpunkte — 06.10.2026 (`v1919`, `016ec49a`) (früher N41)

Hintergrund im Portfolio-Zustand durchgehend ein Ton (v1919, sieben Rasterpunkte); „Portfolio" umrahmt (v1911), Menüs (v1912) und Anmeldung in Grau (v1916) waren schon erfüllt und nachgemessen.

### Heute, Aktenmappe und die Objektkarten-Wahl — 06.10.2026 (`v1896`–`v1900`, `8737f39e`, `b1e44264`, `1db1c40a`, `4ae4cc8e`) (früher N35)

Partikel liefen nie (`#dp-particles` fehlte), Canvas wird jetzt selbst angelegt, Puffer = Fläche mit `ResizeObserver` (v1900). Objektkarten-Wahl fällt in „Heute" weg; Aktenmappe ohne eigene Schiene, dunkler Block 238 → 151 px. Commits liegen auf `main`.

### Vier Fehler in Steuer- und Bewirtschaftungsrechnung — 06.10.2026 (`v1898`, `3ae5c06c`, `d2a7bc83`) (früher N34)

55-%-Split lief auf die Gesamt-Bewirtschaftung (`tax.js:1208`), Mietausfallwagnis stand in den Werbungskosten, Cockpit rechnete mit zweiter 20-%-Pauschale auf nie gesetzte Feldnamen (`dashboard.js:758`), `weg_r` doppelt gezählt (`tax.js:261`); 15-%-Kasten mit echten Zahlen. Commits liegen auf `main`.

### Aktenmappe auf dem Handy trägt die Aktenmappe — 05.10.2026 (`v1885`–`v1885c`, `50b3d16e`) (früher N29)

141 Schienen-Regeln per Generator `tools/schublade-regeln.mjs` auf die Schublade geklont, Heute-Kopf raus, Suchfeld in eigener Zeile, Rechtliches nur in den Einstellungen. Auf Prod.

### Endabnahme Handy, alle Darstellungen — 05.10.2026 (`v1883`–`v1883b`, `3db5e88f`) (früher N26)

Prüfläufer und Bilder je Reiter und Darstellungsvariante; 19 Funde behoben (Listen-Stile wirkten auf dem Handy nie, Überlagerungen, abgeschnittene Tabellen, Wortbrüche, PLZ-Feld, Vollbild-Knopf). Auf Prod.

### Handy- und Tablet-Durchgang — 05.10.2026 (`v1881`–`v1882a`, `60201faa`) (früher N24)

390 und 820 px, alle 9 Reiter: Gewerke-Tabelle, KPI-Tabelle, Partner-Bordkarten, Info-Knöpfe auf Touch, Rechtliches in der Schublade, Kopf-Kacheln, Markteinschätzung 700–899, Marktbericht-Bordkarte behoben. Auf Prod.

### Ernte Hessen-Zins, NRW-Faktoren Block 2, Zins ST/TH/SH/NI — 05.10.2026 (früher N23)

Hessen-Zins (137), NRW-Faktoren Block 2 (69), Zins ST/TH/SH/NI (229) auf Staging und Prod. Marcels Entscheidungen umgesetzt: Kiel MFH (nur nicht-kommerziell) und Aurich-Block gesperrt, ST ohne Lizenz.

### Aktenmappe auf dem Handy brauchbar — 05.10.2026 (`v1879`–`v1880c`, `3a448510`) (früher N20)

Feste Schiene 187 px deckte Menü-Knopf und Kopfzeile, Score-Leiste 808 px breit — jetzt im Fluss, kompakt; nur Heute + Aktenmappe, Standard Aktenmappe. Auf Prod.

### Prod-Rollout v1846b → v1878 — 05.10.2026 (früher N19)

Fast-Forward über 107 Commits, Migration 084, beide Backends neu gebaut, NRW-Register gesät, Sicherungen `prod-*-20261005-1101-vor-v1878.sql.gz`. Prod = Staging = v1878.

### Vier Steuerfehler und das Speichern-Modal — 05.10.2026 (`v1878`, `f000302`) (früher N18)

AfA-Basis mit NK, Projektion mit AfA je Jahr, § 7b ungezwölftelt, Degressiv-Wechsel auf Restwert ÷ Rest-ND; Speichern-Modal ohne Quelle/Konsens/AVM-Text.

### Marktbericht-Übernahme, QuickBoarding-Ring, Quick-Check-Durchlauf — 05.10.2026 (`v1877`, `36511ca`) (früher N17)

brw, Energieklasse G/H, Zusatzeinnahmen → `sonstige_jahr` (Formular und Backend-Mapper); QuickBoarding-Score als Ring mit Pille; Quick-Check → „Als Objekt speichern" durchgelaufen. Speichern-Modal und Steuerfehler mit N18 (v1878) erledigt.

### QuickBoarding-Karte, Spanne in der Karte, Handy-Durchgang — 05.10.2026 (`v1875`–`v1876`, `eba95d6`–`f6b6fb8`, `14fe802`, `a72b928`) (früher N16)

Weiße 65 lesbar, „Nicht enthalten …"/„So wird gerechnet" raus, Spanne Unten/Ø/Oben in der Karte (Klick übernimmt), Karte als Raster nach Kartenbreite, „Deal" in der Pre-Flight-Pille; alle Reiter mobil geprüft (Journal 36).

### „Willkommen an Bord" erst nach der Anmeldung — 05.10.2026 (`v1874`, `cf6c5df`) (früher N15)

`erststart.js` wartet auf `dp:plan-ready` und prüft `Auth.isLoggedIn()`; damit auch die Gestaltungsfrage aus N13 (Registrier-Modal mit Standardwerten) erledigt — es war dieselbe Karte.

### FuE-Siegel 2026 (BSFZ) auf der Landing — 05.10.2026 (`v1873`/`v1873a`, `712192f`, `66bdf1c`) (früher N14)

SVG aus dem Zip als fünfter Eintrag im Vertrauensband, 64 px, Band auf fünf Spalten; nur auf der Landing.

### Parkstr. 9: Quellen, Stufen, Sachwertfaktor, Workflow — 05.10.2026 (`v1865`–`v1873`) (früher N13)

Leiste lesbar, Stufen-Legende A–E und 1/2/3, Zins-Zeile kennt die Objektart, GMB-Eintrag aus dem Register (`c2c6b39`, `7de043f`, `904d71e`). Workflow-Variante A gebaut, LZS MFH Minden-Lübbecke aus GMB 2025 S. 64 (2,9 %, N 33) als Stufe A (`79eecbd`, `fad6fb4`). Sachwertfaktor-Standard 1,0 „ohne Marktanpassung" mit Grund (Marcels Entscheidung, `1335c67`). Eingabetiefe kompakt, Marktbewertung als Streifen, BMF-Rechner mit `bmf_cache` (bis `712192f`).

### Gesamtdurchgang: Score-Wörter, geführte Eingabe, Handy — 04.10.2026 (`v1861`–`v1864`, `8e2de37`, `f5518ad`, `63ac7f1`, `e91df24`, `2c51832`, `b62ba81`, `0b81689`, `4a4786e`) (früher N12)

Eine Score-Kette in `score-tiers.js` überall; geführte Eingabe kennt die Eingabetiefe (pflichtFuer, ganzes Objekt, gebuchte Stufe, `dp:mb-ready`); Handy 390 px und Tablet 820 px sauber; oberste Stufe „Sehr gut" (v1863); Bewertungs-Streifen schwarz (v1864). Prod-Freigabe für v1849–v1862c mit N19 (Prod = v1878) erledigt.

### Kopf-Score, Kaufpreisaufteilung, Rundgang — 04.10.2026 (`v1859b`, `003995c2`) (früher N11)

Score-Wort aus `ScoreTier.stufe` (fünf Stufen) und farbig; Belege-Scan raus; Exporte Kaufpreisaufteilung-PDF, Arbeitshilfe-PDF, Original-XLSX; Duplikat „PDF-Anlage erstellen" weg. Der offene Rest ist laut CLAUDE.md erledigt: `dashboard.js` liest `ScoreTier.stufe()` seit v1861, das `ScoringService`-Rating wird seit v1203 nicht mehr angezeigt.

### Reiter Objekt, dritte Runde — 04.10.2026 (`v1858c`, `1fd90778`) (früher N10)

Abruf als Zeilen unter den Anfragen, Stufenpillen in der Pre-Flight-Kachel, Hover-Hilfe an jedem Feld (`feld-hilfe.js`), Quellen je Kennzahl eine Zeile, Anfragen/Abruf in voller Breite.

### BMF-Rechner und RND-Assistent — 04.10.2026 (`v1856a`, `a3cf6421`) (früher N9)

AfA-Vorschau ohne Altwert und Notnagel, RND-Modal mit Vorbelegung aus dem Objekt (mod_*, Gewerke-Stufen), kein Schließen beim Danebenklicken, Obsidian/Gold-Kopf; Jacoby im BMF-Reiter 2 nur bei Zins Stufe A/B.

### Bankexport über den Bot — 04.10.2026 (`v1853`, `d614195`) (früher N8)

Werkzeug `bank_uebersicht` (Stufe `lesen`), eine Zeile je Darlehen; Restschuld/Rate/Bindung bis aus `portfolio_spiegel`, sonst leer und gesagt; `restschuld_ende` ehrlich weggelassen. Prüfer `pruef-bank.js` 12/12 (17 Darlehen = 17 Zeilen). Marcels Rahmen für N4 (Feld-IDs bleiben, PDF/Import/Exporte lesen dieselben IDs) ist mit v1851 umgesetzt (873 = 873).

### Der Copilot wird ein Agent (A-1 bis A-8) — 02.10.2026 (`v1800`–`v1808`, `2e4c3bea`, `c52aff86`, `18700abf`, `a99acf5d`)

Regex-Weiche (`telegramAbsichtService.js`) durch einen Agenten mit Werkzeugen ersetzt: 9 Werkzeuge in 3 Stufen (lesen / schreiben nach Bestätigung / kostet nach Bestätigung mit Preis). Befunde aus der Nutzung behoben: falscher Auslesemodus (`antwort` statt `inserat`, 4.000-Zeichen-Deckel) und Anlege-Modus ohne Ausgang (v1800). Portfolio-Kontext mit Tilgung/Verbindlichkeiten als Feld (v1802), Objektbezug, Auswahlfelder mit Rückfrage (v1807), Sammelaktionen mit Gesamtpreis (v1805). A-8 (v1808): Stufe 3 fiel still auf Stufe 1 zurück, der Schnellmodus übersprang den Bericht — jetzt reicht das Werkzeug `bericht_text` samt Quellen weiter. Prüfstrecke `tools/agent-pruefung/`: 5/5 Portfolio-Fragen, 12/12 Zahlentreue, 16/16 Werkzeugproben, 7/7 Anlage, 9/9 Gesamtlauf.

### Telegram-Bot als zweiter Zugang zur App — 02.10.2026 (`v1791`–`v1798`, `e1c0bb68`, `165c8122`, `c7792565`, `e87650e3`, `f0bc9e03`)

Entscheidung T-B1 (Marcel 02.10.2026): jeder Kunde legt seinen EIGENEN Bot bei @BotFather an (v1792, die frühere Fehldeutung „ein Bot für alle“ zurückgenommen); Token verschlüsselt, Empfang per Webhook mit Pfad je Bot plus Secret-Header, Verknüpfung über Einmal-Code (Migrationen 076–082). Der Bot rechnet keine eigene Zahl (v1793), legt Objekte an (v1794), nimmt Sprachnachrichten (v1794b) und merkt sich den Gesprächskontext (v1798). T-B6: `req.apiKey.scopes` wird seit v1796 ausgewertet (`middleware/auth.js:122`).

### Register in die Datenbank eingespielt — 01.10.2026 (`v1751`, `v1751b`, `306c9c58`, `c07c3600`) (früher E1)

Ursache: `tools/register-saat.mjs` Z. 17 las eine hartverdrahtete Datei — 2.515 geerntete Sätze im Repo, 493 in der Datenbank. Danach 2.505 Zeilen, 14 Länder, 8 Kennzahlen. Zehn SWF-Sätze (Bochum, Dortmund, Essen, Siegen-Wittgenstein) bleiben bewusst draußen: keine `quelle_url`.

### Ernte-Kandidaten SH, HH, BB, SN, NI — 01.10.2026 (`v1753`, `a9fc37c1`) und Folgeernten (früher E6)

SH geerntet in v1753. Die übrigen Kandidaten liegen inzwischen im Register (u. a. `hamburg.json`, `swf-hh.json`, `lzs-bb.json`, `swf-bb.json`, `nachernte-2026-10b-sn.json`, `swf-ni-*.json`, NI-Ernter v2886); laut Messung 22.10.2026 (`tools/messe-schleife-daten.mjs`) 15 Länder mit Wert.

### Setup-Fenster: U1–U8 und U8-R — 01./02.10.2026 (`v1749`, `v1750`, `v1753b/c`, `v1770`, `v1776`; `e22e64fa`, `c9483f8e`, `23d16523`, `28b11073`, `539a31e4`)

U1: `.dpo-ov` auf `rgba(5,5,5,.34)` ohne `backdrop-filter` (abgenommen per `getComputedStyle`). U2: Klick auf den Hintergrund stirbt am Overlay (Fangphase, `ev.target === _ov`), 0 Zeugen an body/document. U3: Vorschaubilder zeigen die Aufteilung. U4–U7: LTV frei, Häkchen „automatisch“ für LTV/Marktzins, Erklärungen an jedem Feld, Steuer erklärt (Gehaltsrechner von Marcel gestrichen). U8: Investortypen lesen `DealScore2.getPresets()`; v1770 behob den toten Default-Schlüssel „ausgewogen“ (`_typDefault()`). U8-R (v1776): das Profil überschrieb `min_dscr`/`max_ltv`/`ek_quote_default` aus Schritt 3 — schreibt jetzt nur `ai_risk` und das Preset; abgenommen mit 1,44 / 77 / 23 unverändert.

### Beide Piloten sprechen (V1–V7) — 01./02.10.2026 (`v1760`–`v1769c`; `bda9f34f`, `2ea9ed83`, `66d717c0`, `e544bd42`, `af5c8ac6`, `6d59404c`)

Diktat in Co-Pilot und Portfolio-Pilot (v1760–v1764b); Objektzuordnung per `objektZuordnen()` statt Zahl-Muster (v1767b, `tools/pruef-objektzuordnung.mjs` 21/21); belegte Felder nicht still überschrieben (v1764, v1767b); Abrufe per Sprache mit Kosten- und Restkontingent-Ansage aus `body.abrufe` (v1766). V6: `users.id` UUID gegen INTEGER in `mb.*` — Migration `015_user_id_text.sql`, fünf `parseInt` auf `_uidAus(req)`, 202 Zeilen per `tools/mb-uid-zuordnen.mjs` zugeordnet, Routen 200 statt 400 (v1769); Berichte reisen mit (v1769b), gezählte Zahlen werden gelesen statt nachgezählt (v1769c). V7 strukturell erfüllt: Katalog entsteht aus `window.FIELDS`.

### Tour-Hänger in Standard- und Kanzlei-Ansicht — 02.10.2026 (`v1774`, `v1779`, `v1780`; `887d8ba2`, `0aae0179`, `2e483d8d`) (früher T1)

Ursache: `_findElementWithRetry` nahm per `querySelector` nur den ERSTEN Treffer; war der unsichtbar, gab die Suche auf (Hänger bei Schritt 3 Standard, Schritt 6 Kanzlei) — jetzt `querySelectorAll` und der erste sichtbare (v1774). Marcels Entscheidung „b“: Schritte ohne sichtbares Ziel halten die Tour nicht auf, Wartezeiten 2,0→1,1 s bzw. 6,0→2,0 s (v1779): 35 von 36 Schritten. v1780: `tilgEffektivBrutto` war undefiniert und riss Waterfall und Stress-Test mit; Charts jetzt einzeln gerendert (702 · 628 · 707 · 883 px). Prüfwerkzeug `frontend/dev/tour-pruefer.js`.

### Bordkarte als Standard beim Ansichtswechsel; Tour-Schritt 1 auf die Objekte — 01.10.2026 (`v1748b`, `0c0e9870`; `v1747b`, `v1747c`, `1ed3abcc`, `2f51741e`) (früher T2)

T2: die Bordkarte kam nie an — falsches Modul (v1748b). T3: Schritt 1 zeigte auf die Aktionen statt auf die Objekte; die Schiene wird vor dem Schritt aufgeklappt, Anker ist die geklippte Hülle (v1747b/c).

### Demo-Objekt für die Tour — 01.10.2026 (`v1747`, `v1747d`, `f500a587`) (früher T4)

`POST /objects/demo-rundgang` legt den Datensatz aus `backend/src/db/demo-object.json` (wird nie gelöscht) mit freier Objektnummer an. Am Endpunkt gemessen: 129 Felder, 1 Foto, 9.926 Zeichen KI-Analyse.

### Tower: Kaufpreisaufteilung fragt nach der Fassung; QR-Schritt markiert den QR-Code — 01.10.2026 (`v1748`, `0540b424`) (früher T5)

T5: der Knopf öffnete immer dasselbe PDF — jetzt Auswahl nach dem Vorbild `pdf-wahl.js` (v1744). T6: der Pre-Flight-Schritt zum QR-Code hatte einen falschen Anker und markierte den Boardingpass — eigener Selektor für den QR-Code.

### Starter-Nachkauf günstiger als der Einzelkauf — nachgemessen 12.10.2026 (`v1673`, `cc281272`) (früher N1)

Befund 29.09.: `nachkauf_starter` kostete 5,00 € für 5× mpi (Einzelwert 4,50 €); Ursache `config.js:521` (Monatsbeitrag ÷ 4). Marcel hat in Stripe einen neuen Preis angelegt (`price_1UKupB…`, 4,00 €); am echten Katalog auf Prod nachgerechnet: alle drei Pakete günstiger als der Einzelkauf (−0,50 / −5,25 / −21,00 €). `_preisplausibilitaet()` (v1673) bleibt als Wächter.

### Zwei Backend-Fixes auf Prod — 12.10.2026 (Prod-Rollout v1951–v2144, Merge `74841228`) (früher N2)

`0c6cda6` v1669 (BMF-Aufteilung meldet unbekannte Eingabefelder) und `cc28127` v1673 (Preis-Plausibilität) waren auf `main`, der Prod-Pull am 29.09. von der Arbeitsumgebung abgewiesen. Mit dem Rollout live; auf Prod nachgemessen (4 bzw. 2 Treffer, beide Commits Vorfahr von `origin/main`).

### Hängender Cherry-Pick auf `main` war ein Duplikat — 29.09.2026 (früher N3)

Sequencer-Zustand `pick a2a96fd` (v1536/v1537, Partner 99 €) mit `--quit` beendet. Gemessen: `a2a96fd` liegt bereits auf `main`, Migration `075_partner_preis_v1536.sql` dort, Stripe live 9.900 Cent, Prod-Landing „Warum 99 € und nicht 49 €“. Lehre: erst messen, ob es die Aufgabe noch gibt, dann fragen.

### Import-Modul v1.1.0: Dokumentarten angebunden — 29.09.2026 (`v1677`, `fe466152`; `v1678`, `c3d55b5e`) (früher N4)

Gegenstelle ist `frontend/js/pdf-import.js` (der Befund „keine Gegenstelle“ wurde zurückgenommen). v1677: `POST /ai/extract-rndg`, neun Felder korrekt, Gutachten 25 J. gegen `calcPunktraster` 25,51 J.; `rnd_jahre` wird gelesen, nie übernommen. v1678: `dokumentSchemas.js` mit Schemata aus dem Modul (plus eigener `kpt`-Prompt mit den Feldnamen von `/bmf/aufteilung`), `POST /ai/extract-dokument`, `frontend/js/dokument-import.js` als Karte im Import-Hub — neun Arten, Wertgrenzen je Schema, fehlende Pflichtangaben benannt. Rechen-Schnittstelle dokumentiert in `docs/kaufpreisaufteilung/SCHNITTSTELLE.md` (v1675). Bewusst nicht übernommen: Ordner-Upload, SSE, OCR-Zweig, `IMPORT_SESSIONS`, Browser-OpenAI-Key.

### Produktion nachgezogen (Stand 26.09.) — 12.10.2026 (Prod-Rollout v1951–v2144, Merge `74841228`) (früher P1)

Der Stand v1635–v1645 (fünf Layouts, Datenaufnahme-Zeile, Erststart-Karte, Export-Rückfrage, Checkliste, `umgebung.js`) kam mit dem Prod-Rollout vom 12.10.2026 (s. N2). Checkliste vor jedem Merge bleibt: beide Datenbanken sichern und ansehen, Migrationen per `git diff --name-only origin/main..staging` prüfen, Backend-Rebuild bei `backend/src/**`.

### Zwei Werkzeugfenster standen auf dem Handy im Weg — 28.09.2026 (`v1652c`, `v1652d`; `c25c83bc`, `b1e54dd5`), am Code nachgemessen 12.10.2026 (früher P3b)

Bei 390 px per `elementsFromPoint` gemessen: `#dp-kv-panel` und `.dpl-schalter` lagen `position:fixed` über der Datenaufnahme, drei von vier Quellkacheln und der Abrufknopf waren nicht zu drücken. Beide unter 900 px ausgeblendet (`hell-varianten.css:157-159`, `layout-varianten.css:1418-1420`), dazu `layout-varianten.css:2356`. Merkposten: ein festes Fenster vor dem Ausrollen einmal bei 390 px gegen `elementsFromPoint` halten — sichtbar ist nicht bedienbar.

### Kleinere Reste vom 26.09.: BY-Verfügbarkeit und `mb.market_reports.user_id` — 02.10.2026 (`v1769`, `e544bd42`) (früher P4)

`verfuegbarkeit-by.json` wird gelesen: `quelleFuer(ags)` → `quellenSatz()` liefert für sieben Stichproben aus allen sechs Wegweiser-Ländern eine vollständige Antwort (`AUSSCHUSS_QUELLEN` 120 Einträge). `mb.market_reports.user_id` auf TEXT (Migration 015, 202 Zeilen zugeordnet, s. Piloten V6). Die Handy-Messreihe für v3/v5 ist gegenstandslos, seit die Layouts am 28.09. auf zwei reduziert wurden (s. P3).

### Marcels Backlog v22 vom 18.09.2026 — Punkte 1–22 bis auf Reste — 18.–20.09.2026 (`v1428`–`v1462e`)

Prod-Rollout mit Smoke-Test (`006a630`, `f5802de`), Finanzierung EK zuerst (`v1433`, `2da26e5`), Partnernetzwerk ohne Rotation und mit Nachladen (`v1429`, `90b80e7`), Sanierungsfinanzierung mit LTC/LTV nach Sanierung (`v1445`, `a6fbf3f`), Ist-/Soll-Modell und MFH-Konfigurator (`v1448`–`v1459`), Stufentrennung im Marktbericht (`v1435`, `f271a44`), BGF nach NHK 2010 (`v1434`/`v1446`, `ff5c028`), Sprechlauf Teil 1 (`v1440`, `076bd35`), Hell-Schalter-Namenskonflikt (`v1431`, `7973054`), helle Bank-PDF-Fassung (`v1436`, `v1460`–`v1462e`), weiße Bank-/Score-Karten (`v1443`–`v1443c`), Flugzeug-Symbol raus (`v1430`), QC-Marktwert-Timeout 60 s → 15 min (`v1432`, `f9d7533`), Fragen je Objektart (`v1437`, `47042b7`), verbale Zustandsskala (`v1444`, `ec4278a`), Schnittstellen-Audit mit 5 Fehlern (`v1437`/`v1438`, `29ef2e4`), QA 19 inkl. EK-Rendite-Entscheidung (`v1442`), Mobile-QA Teil 1 (`v1441`–`v1441d`, `v1452`), Hybrid-Hellprofil (`v1449`–`v1455c`), eigener AfA-Satz mit RND (`v1447`/`v1450`, `d17e85e`, `0dab26e`). Einzelbefunde und Messungen im Journal der Projektanweisung (18.–20.09.2026).

### Audit Aktionen/Einstellungen (Block A) — 13.09.2026 (`v1350`–`v1357c`, `v1375`)

Elf Reiter gemessen; Co-Pilot-Einstellungen landen nachweislich im Prompt. Bewertungsprofile zeigen ihren Einfluss als Balken (`v1352`), Deal-Score-Formular und Kasten-im-Kasten behoben (`v1350`–`v1353`), Datenraum-Links im Konto statt nur im localStorage (`v1375`, Server gewinnt nie gegen Leere), Reiter neu sortiert (Marcel übernahm alle vier Empfehlungen, elf → zehn Reiter, `v1355`), drei Felder ohne Leser als Ampel angeschlossen (`v1356`–`v1357c`).

### Schutz gegen Auslesen und Nachbau (Block B) — 13.09.2026 (`v1360`–`v1374`)

Bestandsaufnahme der Browser-Rechenlogik (B1); Analyse-Prompt, zweiter § 32a-Tarif und Direktweg zu OpenAI ins Backend (`v1360`–`v1365b`, `v1374`; Deal Score bleibt nach Marcels Entscheidung im Browser); Rate-Limits je Konto mit `security_events` (`v1366`/`v1367`, Migration 071, append-only); Risikostufen berechnet/gesetzt, nie automatische Sperre (`v1369`); Warnmeldung und Adminmail (`v1370`); Admin-Bereich mit Fallakte (`v1368`); Rollen und `security_exempt`, Schwellen konfigurierbar (`v1371`, Migrationen 072/073); 14 Tests grün (`v1372`); Datenschutz 13a mit Löschlauf (`v1373`); Tarif 2026 amtlich (`v1364`). AGB-Abschnitt VII.(6) und Vertragsstrafe als Entwurf (`v1373`) — anwaltliche Prüfung übernimmt Marcel selbst (25.10.2026).

### Sprechlauf → Co-Pilot (Block C), erledigte Teile — 13.–14.09.2026 (`v1358`–`v1378b`, `v1115`–`v1121`)

Kontextbezogene Begrüßung mit Erfahrungsfrage und „Erklär mir das" (C1, C11), Fortschritt und Signale im Kopf (C13, `v1119`–`v1119e`), Hörwächter (C14, `v1121`), Marktpreisindikation startet nach Bedingung statt Zeitpunkt (C15), beide Scores mit Kennzahlen (C16), drei Begleittöne (C2, `v1378`/`v1378b`), Steuersatz/zvE vorschlagen und zurückkommen (C5, `v1377`/`v1377b`), Konfliktrückfrage bei belegtem Feld (C7, `v1376`–`v1376d`), Verneinung hinter dem Thema (C3 teilweise, `v1358`), `wertstg`/`ds2_wertsteigerung` unterschieden (C4 teilweise, `v1359`).

### Steuerprüfung: Trennung privat/Gesellschaft — 15.09.2026 (früher S1)

Im Container mit echtem `tax.js` und `dashboard.js` gefahren: 8 Objekte, 4 Halter, 3 Steuerregime, zvE 90.000 €. Vier getrennte Töpfe, Summe je ESt-Topf cent-genau gleich der echten Portfoliowirkung, Kapitalgesellschaften ohne Wirkung je Objekt. Trennung an fünf Stellen gegengelesen (Tab Steuern v805, Bestandssaldierung und Cockpit v1400, Steuer-Mappe, Jahresabschluss). Einziger Befund: GbR-Topf (S2, offen).

### Marktbericht: Marcels Liste vom 12.09.2026 — 12.09.2026 (`v1332`–`v1339`, `b307c50`…`343ed2b`)

Adresse wurde vom letzten Objekt überschrieben und Bericht landete am alten Objekt (`v1333`–`v1333d`), Wohneinheiten-Sperre, Feldbeschreibungen mit „woher" (`v1334`), Kontingent-Rest an der Ampel (`v1335`), Raster fluchtet (`v1336`–`v1336c`), Alterswertminderung mit Rechenweg (`v1332`/`v1337`). Beide Reste erledigt: Erbbaurechtskoeffizienten für sieben Gebiete (`v1339`, Anwendungsbeispiel zeichengleich); durchgehender Lauf (Berichte 116/117) fand `_num` verwarf negative Zahlen (`v1338d`). SWF Braunschweig-Wolfsburg 2026 s. Workstream D (E2-NI).

### Gutachten-Durchgang — 12.09.2026 nachts (`v1340`–`v1342`)

`zweigWaehlen()` erkannte wegen Backspace-Zeichen statt Wortgrenzen keine Kurzform (EFH, ETW, MFH, RH, DHH) — Potsdam liefert jetzt SWF 1,06 (`v1341`, FALLEN.md 140). Erbbaurechtskoeffizient in der Bewertung mit Formel nach § 50 daneben (`v1342`, Prüfwert 41277). Optik Variante B (`v1340`–`v1340d`).

### Sprechlauf auf Produktion — 18.09.2026 (`006a630`, `f5802de`)

`v1273`–`v1310d` lagen nur auf Staging. Mit dem Rollout vom 18.09.2026 (Backlog v22, Punkt 1) ging staging vollständig nach main, main = staging = beide Server; Smoke-Test 170/170 Assets.

### Sprechlauf: Marcels Auftrag vom 11.09.2026 — 11.09.2026 (`v1306`–`v1308c`)

Rückmeldung zu den Bildern gebaut (`v1306`–`v1306d`). Marktbericht wird ausgewertet (`v1307`, Berichtstext → `wachsend`·`mittel`·`mittel`·`begrenzt`), Auswahlfelder anklickbar (`v1307`, 24 Knöpfe in 4 Gruppen), Pre-Flight-Kombination liest erst die Quellen (`v1308`, 8 Angaben übernommen, 14 statt 16 Fragen), ImmoMetrica in derselben Kette, fehlende Straße → Ortszentrum mit Herkunft „Näherung" (`v1308`).

### Sprechlauf-Feinschliff, fünfter Teil — 11.09.2026 (`v1300`–`v1303`)

Verlauf scrollt sicher ans Ende, Abruf-Balken eine Zeile (107 statt ~180 px), Mikrofon-/Tippzeile flacher, Modal 97 vh/1360 px, „Was schon steht" auch beim freien Erzählen, Breitenregel für die freie Aufnahme, Spalte räumt mit dem Aufnahmefenster (`_recAus`/`_recAn`), Tablet/Handy-Umbruch bei 900 px, Dialog wieder direktes Kind von `.oabi-body`, „ja stimmt" als Zustimmung (`_istZustimmung`). Commits `f757dee` … `696145f`, Gold-Audit RC=0.

### Sprechlauf und Pakete, vierter Teil — 11.09.2026 (`v1297`–`v1299b`, `3b3fc0c`, `e45a06a`, `4525bdb`, `c262a93`)

GeoMap-Kosten aus 184 Läufen (MPI 0,10 € · erweitert 0,38 € · Wertermittlung 0,51 €), Pakete Kurz-/Mittel-/Langstrecke, Menge ändert die Anzahl, Markt-Angebot schließt nach der Wahl, „aus den Einstellungen übernehmen" in sieben Formen erkannt, Schlagwort-Pillen mit Haken, Score-Blasen volle Breite, Kopf 120 → 75 px, Katalog reicht die nächsten Blöcke mit (Deckel 24). Gold-Audit RC=0.

### Kontingent-Regeln, dritter Teil — 11.09.2026 (`v1296`–`v1296f`, `784ec2d` … `233112c`)

Bewertungspartner-Preise raus (`avm_a` → 400 `invalid_pack`), Mengenwähler mit Deckel 25, Plan-Bewertungen verfallen am Monatsende (`_monatsReset` überträgt nichts mehr), nur Nachgekauftes bleibt. Mitbehoben: Einzelkauf verschwand beim Segmentwechsel, CSS am falschen Anker, Kaufblock im toten Zweig, Webhook-Rückfall multiplizierte die Menge nicht. Gold-Audit RC=0.

### Landing-Pläne und Nachkauf, zweiter Teil — 11.09.2026 (`v1294`–`v1295`, `39995bf`, `902c74a`, `ecffdbb`, `cd1e78c`)

Nachkauf-Sektion der Landing trug alte Zahlen; Staffel je Plan ein Viertel des Monatsbeitrags; alte Bewertungspreise unter „Plan wechseln" raus (kauften nichts, 400 `invalid_pack`); Einzelkauf sichtbar gemacht (hing hinter `creditPacks.length > 0`); Mietpotenzial geteilt in laufenden Vertrag und Neuvermietung (`v1295`, Hüllhorst 98 + 194 = 292 €).

### Pre-Flight-Kette — Nacht zum 11.09.2026 (`v1293`–`v1293c`)

Reihenfolge `import` → `immometrica` → `voice` → AVM (war voice-first seit `v503`); extrahierte Angaben werden genannt und übersprungen (13 statt 16 Fragen); Marktbewertung im Sprechlauf mit Stufenwahl; kein Doppelabruf (`done({marktGeholt})`).

### Sprechlauf-Aktionsleiste und Abrufe — 10.09.2026 spät (`v1291`–`v1292d`)

Feste Aktionsleiste für alle Entscheidungen, Adressbestätigung mit Bundesland und GrESt-Satz, Makro-/Mikrolage einzeln über `/ai/lage`, Break-even über `IrrEngine.breakEven`, Marktmietenabgleich, Mietvertrags-Anhaltspunkte, Upside-Hebel auf den Deal Score, animierter Score. „KI hört alles raus" und „Deal-Aktion-Werte" nur teilweise — Rest steht unter Punkt 1.

### Marcels Plan vom Abend des 10.09. — 10.09.2026 (`v1288`–`v1289b`, `28ff503`, `fdba8aa`, `224382a`, `99e4308`)

Feinheiten nach Karten-Überschrift (18 statt 29 Fragen, 54 statt 93 Felder), Lage-Skalen aus dem `<select>`, Deal-Score-2-Abdeckung, Abrufen statt Fragen (BORIS, GrESt, Lagewerte), lange Abrufe früh angestoßen, Zwischenstände der Scores, Nebenkosten aus drei Quellen, Herkunft je Feld in der Übernahme-Tabelle.

### Notizen vom 09.09.2026 — 09.09.2026 (`v1259d`–`v1287`)

Doppel-Anlage beim Anlegen behoben (`v1268`, Sicherungs-Save verlor nach `await` den Kontext). Sprechlauf-Felder 16/17 (Möblierung `v1262`), Bodenrichtwert automatisch mit amtlichem BORIS zuerst (`v1263`–`v1265`), Pillen-Standzeiten (`v1272`), Dialog statt Monolog (`v1273`/`v1275`), Objekt anlegen über der Suche (`v1266`), 15 Testnutzer aus Staging entfernt. Sprechlauf-Liste nach `v1259d`: Kerosin-Modal weg, ein Orbit, Freitextfelder als Fragen, 4 Minuten, Kosten je Aufnahme (0,56 ct gemessen). Transkription auf Staging auf mini umgestellt (Marcel 09.09.2026).

### Übergabe 07.09.2026: Mietrecherche, Stripe-Preisrunde, Jahresabschluss — 07.09.2026 (`v1215`–`v1253`, `v1258`)

KI-Mietrecherche nennt alle Quellen und prüft zuerst den amtlichen Mietspiegel (`v1242a–e`); Preisrunde live in Anzeige und Stripe, Coupon `ERSTFLUG15`, `istBewertungsSku()` kennt `nachkauf_*` (`v1246d`); Testbericht `Anmerkungen.docx` abgearbeitet (`v1240`–`v1253`, `v1254` verworfen); Marcels Staging-Daten auf Prod gespiegelt, Bilanz beidseitig 430.309,21 € ohne Differenz. Kosten der Gesellschaft, GuV § 275, Bilanz § 266 mit Verrechnungskonto, Ausschüttungszeile (`v1226`–`v1228`); Gegenprobe fand `d1_vertrag` ist kein Datum und `_gaNum('3.5')` = 35. Seither belegt erledigt: Prod-Rollout `v1215`–`v1253` (Stand-Zeile), § 7b-Spalte in `tax_records` (`v1258`, `0b5f0755`, Migration 070), Zweifamilienhaus als Objektart (`v1427`/`v1427b`), Gold-Audit gegen Basislinie (`v1259`). Free-Limit einer KI-Analyse im Monat bleibt (Marcel 07.09.2026).

### Steuer-Mappe und Anlage V — 03.09.2026 (`v1222`–`v1225c`; § 7b-Spalte `v1258`, `0b5f0755`)

Anlage-V-Zeilennummern unter dem Info-Feld (`v1222`/`v1222b`, mit Vorjahres-Vorbehalt auf dem Blatt), Anlage V beim Einzel-PDF zuwählbar (`v1223`), Steuer-Mappe für privat und überführt (`v1224`/`v1224b`, `_steuerRegime()`, `_ueberfVermerk()`), § 7b getrennt von der linearen AfA (`v1225`…`v1225c`). Befund: vier von sechs Fehlern waren Widersprüche auf demselben Blatt. Zurückgenommene Falschdiagnose: jsPDF druckt € und Gedankenstriche (WinAnsi 0x80–0x9F). Seit 04.09. auf Prod; die offene § 7b-Spalte in `tax_records` kam mit Migration 070 (`v1258`).

### Übergabe 02.09.2026: Prod-Rollouts, Gelddefekt, Marktbericht neu gestaltet — 02.–03.09.2026 (`v1191`–`v1213`)

Prod-Rollouts `v1198`–`v1202` (`8f2832c`) und `v1203`/`v1204` (`6047036`) mit Sicherungen beider DBs, Score-Kette an zehn Proben identisch. `credits-modal.js` kaperte `_buyCreditPack` in den alten Kerosin-Laden (`v1194`, live). Einzelfixes `v1191`–`v1196b` (Löschknopf, Score-Ring, Kerosin-Ampel, iframe-Buster, leere Reiter 6/7). Abruf-Test: Abrechnung MPI+ 10 → 9, Monat vor Bank. Marktbericht-Punkt 1 abgeschlossen 03.09.2026: Feldmarkierung (`v1199`/`v1201`/`v1202`, tote rote Regel weg `v1213`), Ergebnis-Teil nachgerechnet (`v1210`, `v1212`), PDF umgebaut (`v1206`–`v1213`); Gold-Audit seither gegen Basislinie (`v1259`).

### Übergabe 31.08.2026: Prod-Rollout, Testphase, Stripe, Kontingent-Zähler — 31.08.–01.09.2026 (`v1173`–`v1190b`)

Prod-Rollout 31.08. (58 Commits, Preise 19,99/39,99/79,99/99, Migrationen 064–069) und 01.09. (`v1189`, `c411ba4`: doppelte Route `start-pro-trial` kündigte jedes aktive Abo, nie ausgelöst; `v1190`/`v1190b`). Kostenhinweise ohne Kerosin und Einzelkauf an der 402 (`v1187`/`v1188`, `5b688e3`, `063b202`). Vier Wochen Pro mit Testpaket 5·3·1 (`v1185`, Migrationen 068/069). Kaufkette über `lookup_key` (`v1184`, `78280ec`, `65370f3`), Monatsübertrag-DEFAULT (`v1184b`, Migration 067), Preis-IDs aus Stripe statt Migration (`v1186`, `fc5e7b39`). Kontingent je Leistungsart statt Liter (`v1183`, Migration 066). Plan-Karte 0 € (`v1182`), Kontingent-Kasten „Lädt…" (`v1182c`). API-Keys für Partner: `apiKeys.js` führt partner TRUE.

### Übergabe 13.08.2026 — 13.08.2026 (`v1155`–`v1170`)

Darstellungs-Panel, Grundfarbe unter Vorlage gesperrt, Whitelabel-Sweeper, Reiter-Tinte (`v1155`–`v1158b`), Pfeilmitte löste Löschen aus (`v1159`), Free-Gate zugezogen (`v1160`), `business`/`enterprise` gelöscht (`v1161`), Hell/Dunkel als zwei Profile (`v1162`/`v1167`), Plan-Prüfmodus (`v1163`), Kontrast Objektnummer (`v1164`), Garagenfeld (`v1165`/`v1166`), Checkboxen per Sprache, Stichwort-Fenster, Verifikations-Pass aus (`v1168`–`v1170`). Akzent-Palette Fassung C (`v1175`, 30.08.) und Wallet-Angaben (`v1173`) seither beantwortet.

### Marcels Antworten vom 14.08.2026: Garagenfeld, Akzentfarbe, Wallet, Speichern-Modal — 14.08.–03.09.2026 (`v1165`/`v1166`, `v1173`–`v1175`)

Garagenfeld bleibt wohnungsbezogen (Weg A), umgesetzt mit `v1165` (`b9e78513`) und `v1166`, `lib/nhk2010.js` unangetastet. Akzentfarbe: freier Wähler `v1174` (`8e95bf57`), wärmere Schnellauswahl Fassung C plus Farbton-Regler `v1175` (`3f4a6cc2`). Wallet-Abstände Bild/Kaufpreis/„privat“ `v1173`/`v1173b` (`01313067`). Das Speichern-Modal im QuickBoarding gibt es bereits (Save-Transfer über `qc-bridge.js`), am 03.09.2026 im Code nachgelesen — nichts zu bauen.

### Marktbericht-Wizard mit Meilenstein-Ampel — 11.08.–04.09.2026 (`v1149`–`v1154`, `v1193`, `v1229`)

Wizard mit sieben Reitern (`mb-wizard.js`) und Meilenstein-Ampel gebaut, am 01.09.2026 am Testobjekt Hüllhorst nachgemessen: die Stufe ergibt sich aus den Angaben, der Knopf ist nie tot. Geldfragen beantwortet (abgerechnet beim Erzeugen, Vertiefen kostet die Differenz) und in `_aufpreis()` zusammengeführt (`v1154`, `99a14db8`). Schrittleiste einzeilig ab 1024 px (`v1151`), Knopf bei Stufe 1 frei (`v1152`), Handy-Klappleiste Fassung C (`v1153`), Stufe und angewandter Faktor im PDF (`v1149`, `v1150`), Ampel ohne Liter (`v1193`, `cd68aa0`). `ptype`/`baustatus` hatten keine leere Option und liefen still als ETW/Bestand — behoben `v1229`–`v1229c` (`cd930a1a`).

### Plan-Prüflauf Free bis Partner — 13.08.–04.09.2026 (`v1160`, `v1163`, `v1230`)

`config.js`, `pricing-modal.js`, Landing und die DB-Zeilen (`plans.features`) gegeneinander gehalten, alle Stufen per Prüfmodus durchgeklickt, Partner von Marcel auf Prod begangen (vollständige Obermenge von Pro). Startfenster-Leck zu (`v1160`, `d0aedab2`), Plan-Override als Prüfmodus nur nach unten (`v1163`, `a4107d01`). B7: Free bekommt den Track-Record mit Wasserzeichen (Marcels Entscheidung 04.09., DB in beiden Umgebungen). B8: Bankexport blockt free und starter. B9: Testphase dauert 28 Tage, Kommentare korrigiert. B15: Testphase erreicht KI-Beleg-Import und AVM (`v1230`, `795813aa`) — fünf, nicht acht Nutzer betroffen.

### Spracheingabe füllt alle Felder: Häkchen und Sanierungsbedarf — 03.–04.09.2026 (`v1214`, `v1231`)

`buildFullCatalog()` gibt alle 203 `window.FIELDS` an die Auswertung; Risiken, These und Notizen sind füllbar. `applyQcPending()` hatte keinen `bool`-Zweig — `san_tax_active` wurde gezählt, nie gesetzt; behoben `v1214` (`a4956f0a`), Sprechlauf von Marcel am 03.09. abgenommen. Speichern-Modal existiert (Save-Transfer), nichts zu bauen. Zählung 04.09.: 33 Formularfelder fehlten in `FIELDS`, 17 davon Sanierungsbedarf — `sanKatalog()` + `_sanNachziehen()` (`v1231`, `fa5f91fd`), auf Staging Dach 15.000 + Heizung 12.000 → `san` = 27000.

### Steuer-Mappe über alle Objekte mit Anlage-V-Ansicht — 03.09.2026 (`v1215`–`v1225`, `0948a6f1`)

Ein PDF über alle Objekte aus `GET /tax-records`, Knopf als Abschnitt 07 im Portfolio-Cockpit (`v1215`). 66-%-Grenze § 21 Abs. 2 EStG als Live-Warnung im Steuer-Tab (`v1216`, `fa2fdf0a`). Anlage-V-Zeilen aus dem amtlichen Formular abgeschrieben, versioniert in `anlage-v-2025.js` (`v1217`/`v1218`, `49462839`), elf von zwölf Lücken zugeordnet (`v1219`, `d7228f77`). Zeilennummern im Steuer-Tab (`v1222`), Anlage V beim Einzel-PDF (`v1223`), Mappe für privat und überführt (`v1224`), § 7b getrennt von der linearen AfA (`v1225`).

### Sachwertfaktoren geerntet — Stand 22.10.2026 (Workstream D)

Am 12.08.2026 führte `mb.wert_parameter` 0 Sachwertfaktoren; hinterlegt waren nur Minden-Lübbecke und Herford als Module. Laut CLAUDE.md (gemessen mit `tools/messe-schleife-daten.mjs`, 22.10.2026) führt das Register 627 SWF-Werte über 199 Ausschüsse, `mb.param_modell` hält auf Staging und Prod je 4.503 Werte. Der Punkt war ein reines Datenvorhaben; die Weiterpflege läuft unter „MARKTBERICHT / ERNTE — Workstream (D)“.

### Zeiger auf die erledigten Alt-Punkte 4, 5, 10 und 11 (Zählung vor dem 30.08.) — 30.08.2026

Hell und Dunkel als zwei Profile (`v1162`/`v1162b`, `v1167`), Akzentfarbe (`v1174`, `v1175` — Fassung C), Wallet-Abstände (`v1173`/`v1173b`) und Sachwert/Miteigentumsanteil (Weg A, `v1165`/`v1166`) sind erledigt; die vollen Befunde stehen bereits unter „Fertig“. Der Zeigerblock in „Offen“ entfällt.

### Tab-Text-Regler überlebt den Akzentwechsel — 13.08.2026 (`v1157`, `c2d7e9b2`)

Ursache: der Sweeper in `whitelabel-override.js` spielte bei jedem Akzentwechsel die gemerkten Originale des Body-Inline-Stils zurück und verwarf damit `--dp-tab-text`. v1155 hatte den doppelt toten Regler bereits wirksam gemacht (`body.dp-tabtext-an`, Regel (0,6,4) gegen elf Gegenregeln; nachgemessen rgb(201,168,76) → rgb(255,0,0)); v1157 schreibt den Wert in ein eigenes `<style>`-Element statt an `body.style`. Der strukturelle Befund für die übrigen Regler steht unter „Später“ (Sweeper-Falle).

### ETW/MFH-Sachwert freigegeben (v1097 eingespielt) — 13.09.2026 (`v1097`, `d8d82477`) (früher A1)

Die Oberfläche sperrte den Sachwert für ETW/MFH (`nichtWenn: istWohnung()`, Regel aus v955), obwohl der Kern ihn seit v1047 rechnet; `nichtWenn` übersprang auch die Pflichtfeldsammlung, und dieselbe Regel stand im Prompt der KI-Zweitmeinung. Eingespielt, `mb-backend` gebaut; Klicktest: bei ETW fordert die Ampel Bruttogrundfläche und Standardstufe ein, bei EFH nicht. Die Prüfstrecke vergleicht den `app.js`-Buster jetzt gegen das Original statt gegen eine Konstante.

### Quellennachweis im Bericht — 13.09.2026 (`v1107`, `609dc9c6`) (früher A2)

`CrossCheckService` sammelt die Vermerke der tatsächlich verwendeten Registersätze entdoppelt in `cross_check.quellen_nachweis`; eigener Block am Ende der Wertermittlung in PDF und Web-Ansicht, bewusst nicht in der Fußnote (v1150b kürzt dort auf 26 Zeichen). Gemessen an einem CrossCheck-Lauf Prignitz (EFH Bj 1975, Faktor 0,9043 Stufe A): Vermerk, Lizenz `dl-de/by-2-0`, Kennzahl und Link. Dazu v1106 (`f275bd8b`): der Quellenlink steht auch beim Sachwertfaktor.

### Modellvermerk-Leser: GND aus dem Modell, Baupreisindex korrigiert — 12.09.–22.10.2026 (`v1338`, `303d3e93`; `v1407`, `1596d6a8`; `v2720`, `60192dd0`) (früher B1)

GND: `CrossCheckService` liest die Gesamtnutzungsdauer aus `modellansaetze.gnd_jahre` (Leser kennt alle drei Feldnamen) und leitet die RND im Modellrahmen neu ab (v1338); nachgemessen 15.09.2026: Offenbach, Bad Homburg, Oberursel 70, Frankfurt 80. Baupreisindex: Konstante 2,02 → 1,91 (v1407; Hamburg 1,911, Dortmund 1,906; Sachwert rund 5,8 % niedriger). v2720 (Entscheidung Marcel 22.10.2026): Faktor mit Index-Bezug zum Kaufzeitpunkt gilt als Wert (`baupreisindex_bezug: 'kaufzeitpunkt'`).

### Steuerliche Portfolio-Betrachtung an beiden Stellen saldiert — 14.09.2026 (`v1397`, `5dbe9db1`) (früher B1b)

Befund: `tax.js` saldierte die Bestandsobjekte, `calc.js` (`_estDelta`, „nur Display“) nicht — dieselbe App wies zwei Steuerwirkungen aus. Gebaut: `window._dpBestandSaldo(jahr)` in `tax.js` als einziger Weg (mit Kaufdatums-Filter), `calc.js` rechnet gegen die gesenkte Basis; Rückfall 0 ohne geladenen Cache. Nachgemessen am echten `tax.js`-Tarif, 8 Fälle cent-genau (alter Fehler bis +77 % bei Verlusten über dem zvE, −5 % bei gemischten Ergebnissen). Nebenbei `ZVE_BASE=78000` im Cockpit durch `DealPilotZvE.getForYear()` ersetzt und das tote `vuvY1` entfernt; Aufteilung nach Kaufzeitpunkt (Weg A) steht im Hinweistext `#tax-flow-hint`.

### Quellenregister in der Datenbank — am Code nachgemessen 12.10.2026 (früher C1)

`marktbericht/backend/migrations/006_harvest.sql:40` legt `mb.gaa_documents` an (Fremdschlüssel auf `gaa_sources`, Unique auf `url`, Index auf `(status, lauf_typ)`), `007_quellenregister.sql:14-30` ergänzt Preis, Bestell-URL und Prüfstand. Benutzt: geschrieben in `HarvestService.js:171`, gelesen in `routes/api.js:179` (Dokumentzahl je Quelle im Admin) und `HarvestService.js:441` (Statusstatistik).

### Kunden-Verlinkung zur Quelle — 13.09.2026 (`v1099`, `95250024`; `v1099b`, `ecd2c00f`) (früher C2)

`marktbericht/backend/src/lib/quellen_links.js` führt alle 16 Länder (Stelle, Portal-URL, Zugang); ein Registersatz gewinnt gegen die Landestabelle. Der Link hängt an jeder Antwort, gemessen an vier Orten (München, Dresden, Hamburg ohne eigenen Wert). Seit v1099b steht er auch auf dem Bildschirm, seit v1106 auch beim Sachwertfaktor, seit v1118b gibt es die Ausschuss-Ebene (`AUSSCHUSS_QUELLEN`, Pflichtfeld `warum_kein_wert`).

### Admin-Ansicht zum Ausschuss-Register: Quellen-Teil vorhanden — nachgemessen 12.10.2026 (dazu `v2591`, `c284407e`) (früher C3)

Der alte Satz „im Admin nichts, kein View, keine Route“ war falsch: `frontend/admin/index.html` `#view-marktzinsen` („Marktzinsen & Gutachterausschuss-Daten“), `admin-marktzinsen.js` `quellenTabelle()` (Land · Ausschuss · Zugang, Seite/Zitat aus dem Bericht), Route `backend/src/routes/admin.js` → `_mbCall GET /harvest/status`. Seit v2591 (21.10.2026) zusätzlich der Reiter „Register & Ernte“: Deckung je Land und Kennzahl, Kaufliste, Ernte-Eingang.

### Sachwertfaktoren im Register rechenbar — nachgemessen 12.10.2026 (früher C4)

`ausRegisterRechnen()` in `marktbericht/backend/src/lib/gutachterausschuss.js` ist vollständig gebaut: siebt Ebenen, löst Lageklassen auf, wählt Zweig und Baujahrgruppe, rechnet über `swf_modelle.auswerten()` mit `herkunft: 'register'` und Modellvermerk. Lüdenscheid, Höxter und der Märkische Kreis liegen im Register.

### Niedersachsen: Lizenz geklärt, Abrufweg gelöst, Ernter im Repo — 13.09.–23.10.2026 (`v2886`, `6a3e7c86`) (früher E2-NI)

Die Grundstücksmarktdaten stehen unter `dl-de/by-2-0` (kommerzielle Verwertung erlaubt, Vermerk mit Internetadresse) — eine LGLN-Anfrage ist nicht nötig. Am 13.09. Landkreis Wolfenbüttel als erster Ausschuss (URL-Parameter plus 7 s Warten); der Einzelabruf trug, die Serie scheiterte am Renderer-Timeout. Gelöst über eine VizQL-Sitzung ohne Browser: Ernter unter `tools/swf-register/ernter/vizql/` mit README für die Nachernte 2027 (v2886). Im Register u. a. `swf-ni.json` (Braunschweig-Wolfsburg), `swf-ni-nom-2026.json` (Northeim, v2881), NI-Sperren mit Weg (v2884) und der MFH-Liegenschaftszins nach dem OGA-Landesmodell (v2830, 40 Kreise, 796 Gemeinden). Modell- und Kurvenbefunde vom 13.09. stehen in `claude/ernte-20260913.md`.

### Alle Anlage-V-Zeilen zugeordnet, Halterangaben aufs PDF — `v1220`/`v1221`, 03.09.2026

Marcels Paket vom 03.09. — **drei von sieben Punkten sind gebaut.**

**Zeile 45, nicht 36.** Marcel wies auf die AfA für bewegliche
Wirtschaftsgüter hin und nannte Zeile 36. Im Formular 2025 steht sie in
**42–45 (Kz 60)**; Zeile 36 ist die § 7b-Sonderabschreibung. Der Sachverhalt
stimmte, die Nummer nicht — **genau dafür ist die Abschrift da.**
**Damit sind alle 26 Felder zugeordnet**, keines mehr offen.

**Neuer Block „Identifikation"** bei den Mandanten: Steuernummer, Finanzamt,
Anschrift für jede Rechtsform; USt-IdNr. und Handelsregister für
Gesellschaften. `mandanten.js` hing dabei auf `?v=953` — **268 Versionen
zurück.**

**Deckblatt für die Mappe.** Halter, Steuernummer, Finanzamt, ggf. USt-IdNr.
und Handelsregister, Anschrift, dazu die Objektliste. Fehlende Angaben stehen
als **„nicht hinterlegt"** da, mit dem Hinweis wo man sie nachträgt. Gehören
die Objekte mehreren Haltern, sagt das Deckblatt das — eine Anlage V wird je
Steuerpflichtigem abgegeben.

> **Ein Befund, der eigenes Gewicht hat:** DealPilot rechnet die
> § 7b-Sonderabschreibung, legt sie aber mit der Gebäude-AfA zusammen
> (`tax.js:1009`), und der gespeicherte Steuersatz hat nur eine Spalte `afa`.
> Das Formular verlangt sie getrennt (Zeile 35 „ohne Beträge in den Zeilen 36
> bis 41"). Das PDF benennt die Lücke; **die Lösung wäre eine eigene Spalte im
> Steuersatz** — Backend, eigener Schritt.

**Noch offen aus dem Paket:**

1. **Zeilennummern im Steuer-Tab** (Detail-Modus), hinter den Info-Punkten.
2. **Anlage-V-Auswahl beim Einzel-PDF** im Objekt-Tab.
3. **Die Mappe für überführte Objekte** — `obj_herkunft`,
   `verkehrswert_ueberf`, `halter_seit` sind erfasst, die Mappe kennt sie
   noch nicht.
4. **Eigene Spalte für die § 7b-Sonder-AfA** (Backend).

### Jetzt ist alles zugeordnet bis auf eines — `v1219`, 03.09.2026 (`d7228f7` · `524c84e`)

Marcel nach dem ersten Blick in die Mappe: *„eigentlich müssten wir alles
zuordnen können."* **Er hatte recht, und die Lücke lag bei mir.**

Ich hatte die Zeilen **73/75** des Formulars überlesen — „Umgelegte Kosten
(z. B. Grundsteuer, Straßenreinigung, Müllabfuhr, Wasserversorgung,
Entwässerung, Hausbeleuchtung, Heizung, Warmwasser, Schornsteinreinigung,
Hausversicherungen, Hauswart, Treppenhausreinigung, Fahrstuhl)". Das sind
genau die umlagefähigen Nebenkosten, die ich als nicht zuordenbar ausgewiesen
hatte.

> **Ich habe im Netz gesucht, was zwei Zeilen tiefer im PDF stand.** Die
> Websuche brachte nichts — geholfen hat, das Formular ein zweites Mal zu
> lesen.

**Elf von zwölf sind jetzt zugeordnet**, einer bleibt offen (AfA auf
bewegliche Wirtschaftsgüter — dafür führt die Anlage V keine Zeile).

**Und jede Zuordnung sagt, worauf sie beruht**, im PDF sichtbar:
kein Zeichen = wörtliche Abschrift · `*` = Auffangposten „Sonstige Kosten" ·
`°` = folgt aus der Art des Aufwands, mit Begründung in einem eigenen Block
„bitte prüfen". **Ohne diese Unterscheidung sehen Abschrift und
Schlussfolgerung gleich sicher aus** — in einer Steuerunterlage darf das
nicht passieren.

Nachgewiesen: der Block „ohne Zeilenzuordnung" ist verschwunden,
`Zeile 75 · Kz 52 · Umlagefähige Nebenkosten · 3.636 €` steht in der
Zuordnung, der `°`-Block mit einem Prüfsatz gegengeprüft.

**Bei Marcel liegt:** die fünf `°`-Posten einmal ansehen — Bereitstellungs-
zinsen, Vermittlungsprovision, sonstige Finanzierungskosten, Steuerberatung,
anschaffungsnahe Herstellungskosten.

### Die Anlage-V-Ansicht steht — `v1217`/`v1218`, 03.09.2026 (`4946283`…`5cd98c7`)

Backlog-Punkt **5**, Stück 1. Marcel hat das amtliche Formular geliefert
(`Anlage_V_2025.pdf`), die Zeilennummern sind daraus **abgeschrieben** —
versioniert in `frontend/js/anlage-v-2025.js`, mit dem Jahr im Namen.

Das PDF war nicht einfach zu lesen: Subset-Fonts mit einer um **29**
verschobenen Kodierung, nachgewiesen an „2025" und „Anlage" im Dokument
selbst, dazu eine Positionsauswertung, weil sich alle vier Formularseiten in
den Koordinaten überlagern.

**Die zweite Ansicht** liegt im PDF hinter jeder Aufstellung, zuschaltbar im
Cockpit. Drei Blöcke: zugeordnet (Zeile + amtliche Kennzahl) · **ohne
Zeilenzuordnung — bitte steuerlich prüfen** (Betrag und Begründung) ·
Formularzeilen, die DealPilot nicht führt. **Nichts wird weggelassen** —
Marcels „sollte nur vollständig sein" ist hier die schärfste Anforderung,
nicht die weichste.

Nachgewiesen in beide Richtungen: für **2026** (keine Zuordnung) erscheint
**keine** Seite und die Schlussseite sagt warum; für **2025** stehen
`Zeile 15 · Kz 01 · Mieteinnahmen`, `Zeile 35 · Kz 30 · AfA`,
`Zeile 48 · Kz 33 · Schuldzinsen` mit den echten Beträgen.

> **Ein Fund, der nicht geplant war:** die Zeilen **87/88** des Formulars sind
> die Kürzung wegen **verbilligter Vermietung** — genau das, wovor die
> 66-%-Warnung aus `v1216` warnt. Das Formular sagt selbst: Aufwendungen in
> voller Höhe eintragen, Kürzung ausschließlich dort. Die beiden Stücke des
> Punktes greifen ineinander.

**Bei Marcel liegt:** die zwölf Felder ohne gesicherte Zeile einmal ansehen —
Bereitstellungszinsen, Vermittlungsprovision, umlagefähige Nebenkosten,
Steuerberatung, Sammelposten. Dort hängt die Zeile am Sachverhalt, nicht am
Formular, und ich bin kein Steuerberater.

**`v1215`–`v1218` liegen auf Staging, nicht auf Prod.**

### Die Steuer-Mappe steht — `v1215`, 03.09.2026 (`0948a6f`…`a0b9389`)

Backlog-Punkt **5**, erster und größter Teil. Ein PDF über **alle** Objekte:
je Objekt eine Aufstellung der Werbungskosten, am Ende eine Zusammenfassung
mit Summe. Der Knopf sitzt als **Abschnitt 07 im Portfolio-Cockpit** — dem
ersten Export-Knopf, den das Cockpit überhaupt hat.

**Gemessen, bevor gebaut wurde:** `GET /tax-records` liefert 72 Sätze über 7
Objekte und 12 Jahre, und alle 26 Felder, die die PDF-Seite druckt, sind in
jedem Satz belegt — auch die gerechneten. Der Backlog-Eintrag hatte recht.

> Eine Vermutung von mir dagegen **nicht**: ich hatte aus dem Code
> geschlossen, die Sätze trügen nur Hand-Korrekturen. An den Daten widerlegt.
> Hätte ich das nicht gemessen, hätte ich den richtigen Backlog-Eintrag
> „korrigiert".

Zwei kleine Eingriffe statt einer Zerlegung: die Seitenfunktion und
`_computeYearTotal` nehmen die Werte jetzt optional von außen. **Die
Summenformel bleibt, wo sie ist** — eine zweite Fassung wäre genau der
Fehler, den der Code an anderer Stelle selbst verbietet.

**Nachgewiesen:** 8 Seiten für 2026, Adressen und Flächen vollständig,
Summenzeile, Konsole ohne Fehler. Zwei Nachbesserungen aus dem ersten Lauf:
`GET /objects` liefert nur eine Zusammenfassung ohne Adresse (`v1215b`), und
im Jahr-Feld stand **2040**, weil die Sätze bis dorthin reichen (`v1215c` —
jetzt das Veranlagungsjahr).

**Was an Punkt 5 noch offen ist:**

1. ~~**Der Umschalter auf die Anlage-V-Ansicht** — bewusst nicht gebaut, er
   braucht die Zeilennummern des amtlichen Formulars.~~
   **GEBAUT — `v1217`/`v1218`, 03.09.2026.** Marcel hat das amtliche Formular
   geliefert; die Zeilennummern sind daraus **abgeschrieben**, versioniert in
   `frontend/js/anlage-v-2025.js`. Die zweite Ansicht liegt im PDF hinter
   jeder Aufstellung, zuschaltbar im Cockpit.
   **Für ein Jahr ohne hinterlegte Zuordnung erscheint sie nicht** — nachge-
   wiesen an 2026: keine Seite, und die Schlussseite sagt warum.
   **Zwölf der 26 Felder tragen keine Zeile, sondern eine Begründung** — dort
   wäre die Zuordnung eine steuerfachliche Entscheidung. Sie erscheinen
   trotzdem, im Block „ohne Zeilenzuordnung — bitte steuerlich prüfen".

   > ~~**Marcel sollte diese zwölf einmal ansehen.**~~ **Erledigt mit `v1219`:
   > elf der zwölf sind zugeordnet.** Marcel hatte recht mit „eigentlich
   > müssten wir alles zuordnen können" — die Lücke lag bei mir, ich hatte
   > die Zeilen 73/75 des Formulars („Umgelegte Kosten (z. B. Grundsteuer,
   > Straßenreinigung, Müllabfuhr …)") überlesen. Offen bleibt **einer**: die
   > AfA auf bewegliche Wirtschaftsgüter, für die die Anlage V keine eigene
   > Zeile führt.
   >
   > **Jede Zuordnung sagt jetzt, worauf sie beruht** — im PDF sichtbar:
   > kein Zeichen = wörtliche Abschrift aus der Zeilenüberschrift ·
   > `*` = Auffangposten „Sonstige Kosten" · `°` = folgt aus der Art des
   > Aufwands, mit Begründung in einem eigenen Block. **Fünf Posten tragen
   > das `°` und gehören von Marcel oder seinem Steuerberater geprüft:**
   > Bereitstellungszinsen (→ 48), Vermittlungsprovision Darlehen (→ 51),
   > sonstige Finanzierungskosten (→ 51), Steuerberatung (→ 82) und
   > anschaffungsnahe Herstellungskosten (→ 35 über die AfA).
2. **Halter-Filter und Objektauswahl** in der Oberfläche. Der Export kann sie
   bereits (`opts.objectIds`), es fehlt die Bedienung.
3. ~~**Die 66-%-Grenze** des § 21 Abs. 2 EStG als Live-Warnung.~~
   **GEBAUT — `v1216`, 03.09.2026.** Kasten im Steuer-Tab unter der
   Steuerwirkung, drei Zustände (≥ 66 % grün · 50–66 % gold, Prognose nötig ·
   < 50 % rot, Aufteilung). Alle fünf Zustände am laufenden System
   durchgefahren. Fehlt die Marktmiete oder die Fläche, sagt der Kasten das
   und rechnet **nicht** mit einer geschätzten Vergleichsmiete.
   *Die Schwellen stehen im Gesetz, nicht in einem Formular — deshalb dürfen
   sie im Code stehen, anders als die Zeilennummern der Anlage V.*

> **Zur Anlage V (Stück 1): Marcels Link führt nicht zum Ziel.** Er hat am
> 03.09. `elster.de/…help_est_ufa_12_2019` geschickt. Geprüft: die Seite gilt
> für **2019** und enthält **gar keine Zeilennummern** — nur den Satz
> „Einkünfte aus Vermietung und Verpachtung: Dazu gehören unter anderem…".
> Dasselbe gilt für die Entsprechung von 2025 (`…help_est_ufa_12_2025`). Der
> Formularserver der Bundesfinanzverwaltung liefert beim Abruf nur die
> Navigationsseite.
>
> **Gebraucht wird die Anlage V des zählenden Jahres als PDF** — ELSTER-Export
> oder Download vom Formularserver, abgelegt im Ordner wie der Marktbericht.
> Die Nummern aus dem Gedächtnis oder aus einem Forum zu nehmen wäre genau das
> Raten, das hier verboten ist, und bei einer Steuerunterlage die teuerste
> Sorte Fehler.

**`v1215` liegt auf Staging, nicht auf Prod.**

### Spracheingabe ist durch — Punkt 3 abgeschlossen, 03.09.2026

Alle drei „Reste" sind zu. **Zwei davon waren veraltete Einträge, einer ein
echter Defekt.**

- **Rest 1 (Checkboxen)** — Eintrag veraltet, aber dahinter lag der Defekt in
  `applyQcPending()`: ein Häkchen wurde gezählt und nie gesetzt. Behoben mit
  `v1214`.
- **Rest 2 (Modal beim Speichern)** — **es gibt eines, nur woanders.** Marcel
  wusste selbst nicht mehr, was gemeint war, also den Code gelesen statt
  weiter zu fragen: die `pendingList` aus einem Import geht per
  `postMessage` an den Quick-Check und wird beim Speichern gezeigt
  („Save-Transfer"). Und **es geht nichts verloren** — von 21 `qc_`-Feldern
  stehen 16 im Snapshot, die fünf übrigen werden separat verarbeitet
  (Hausgeld monatlich × 12 mit Split; Straße/Hausnummer/Ort zu `qc_adresse`).
  **Nichts zu bauen** — ein zweites Modal neben das vorhandene zu setzen wäre
  genau der Fehler, den der alte Eintrag befürchtet hat.
- **Rest 3 (Sprechlauf)** — Marcel hat ihn gemacht: *„sprechlauf auch ok"*.
  Damit ist der `bool`-Zweig aus `v1214` **am echten Weg** abgenommen, nicht
  nur im Laborlauf.

> **Das Muster wiederholt sich:** von drei offenen Punkten waren zwei nur
> deshalb offen, weil niemand nachgesehen hat. Derselbe Fall wie die tote
> CSS-Regel in `v1213`. **Ein Backlog altert schneller als der Code.**

Außerdem: **Marcel hat die Kaltmiete in `2026-001` korrigiert** — das Objekt
liefert wieder Bruttorendite und Kaufpreisfaktor.

### Ein Häkchen wurde gezählt, aber nie gesetzt — `v1214`, 03.09.2026 (`a4956f0`)

Backlog-Punkt **3** (Spracheingabe), Rest 1. Der Eintrag war veraltet —
Checkboxen sind seit `v1168` im Auswertekatalog. **Dahinter lag aber ein
echter Defekt.**

`applyMerged()` hat seit `v1168` einen `bool`-Zweig. Es gibt aber einen
**zweiten** Schreibweg, `applyQcPending()`, und darüber steht wörtlich
*„gleiche Schreiblogik wie applyMerged"*. Sie **war** gleich — bis `v1168`
nur die eine Stelle anfasste. Dort fiel ein diktiertes Häkchen auf
`setInput()` durch, das `el.value` schreibt und die Checkbox unberührt
lässt — **und wurde trotzdem als übernommen gezählt.**

Betroffen ist `san_tax_active`, die einzige Checkbox in den 203 Feldern —
eine **Steuerposition**. Fehlt das Häkchen, fehlt der Sanierungsvorteil in
der Rechnung, und der Nutzer hat „N Werte übernommen" gelesen.

Behoben mit **einer** Schreiblogik für beide Wege (`_wertSchreiben()`), nicht
mit einer dritten Kopie des Zweigs. Am laufenden System belegt: alte Logik
`checked:false`, neuer Weg `checked:true` mit gefeuertem `change`-Ereignis.

> Derselbe Fehlertyp wie den ganzen Tag im Marktbericht — **gemeldet wird,
> was nicht passiert ist.** Nur diesmal in der Haupt-App.

**`v1214` liegt auf Staging.** Von Punkt 3 bleiben zwei Reste, beide
brauchen Marcel: das Speichern-Modal (welches gemeint ist, ist ungeklärt)
und ein echter Sprechlauf am Gerät.

### Vergleichspreise und Verfahrenswahl geprüft — `v1212`, 03.09.2026 (`7c05d24` · `cb80d4e`)

Die letzten ungeprüften Stücke des Ergebnis-Teils. **Backlog-Punkt 1c ist
damit vollständig abgearbeitet.**

**Drei Befunde bei den Vergleichspreisen, alle behoben:**

- „Vergleichsobjekte (**10**)" stand neben einem Median aus **42**. Der
  Median der zehn Gezeigten ist 1.888 €/m², ausgewiesen sind 1.695 — wer
  nachrechnet, kommt nicht hin. Jetzt „(10 von 42)" plus Erklärzeile.
- **Keine Ortsspalte.** Acht der zehn Vergleiche liegen in `32312 Lübbecke`,
  das Objekt in `32609 Hüllhorst`. Keine Regelverletzung, aber nach
  ImmoWertV begründungspflichtig — und unsichtbar. Neue Spalte **Ort**.
- Die **Entfernung** zeigte achtmal identisch 3.526 m: zehn Objekte, **zwei**
  Koordinatenpaare. Die Standorte sind je Ort zusammengefasst, die Zahl ist
  eine Orts- und keine Objektentfernung. Steht jetzt dabei.

Beide Hinweissätze entstehen **nur, wenn der Befund vorliegt** — zur Laufzeit
gezählt. Bei sauberen Daten steht dort nichts.

**„Wertverfahren im Vergleich" ist in Ordnung** — nicht gemittelt, führendes
Verfahren mit Begründung und Quelle, vorläufiger Sachwert mit Vermerk. Nur
der Spread-Satz sagte nicht, welche Verfahren er meint (der Sachwert liegt
24 % daneben und ist absichtlich draußen). Sagt er jetzt (`v1212b`).

> **Fast wäre ich auf mein eigenes Werkzeug hereingefallen:** ich wollte die
> Quelle des führenden Verfahrens einbauen, weil meine Messung sie nicht
> fand — **sie stand längst drin**. Meine Regex verschluckt alles in
> Klammern, und die Quelle steht in Klammern. **Zum dritten Mal in dieser
> Sitzung.**

**`v1212` liegt auf Staging, nicht auf Prod.**

### Die Plausibilitätsprüfung wird endlich gehört — `v1211`, 03.09.2026 (`a4abcd0`…`49dcd29`)

Marcels Export nach `v1208` ausgelesen. Alles Gebaute bestätigt sich — und
ein Defekt fällt heraus, den der Bericht **selbst erkannt und dann ignoriert
hat**.

Im PDF stand: *„…mit einem geschätzten Wert von 195.000 Euro, was bei einer
monatlichen Kaltmiete von 100 Euro eine überschaubare Nettojahresrendite
ermöglicht."* Das sind **0,6 % brutto** — kein Ergebnis, sondern ein
Tippfehler in den Objektdaten, den der Bericht zur Bewertung macht.

**`_mbCheckup()` hatte ihn vor dem Lauf gemeldet** und im Dialog gezeigt.
Danach war der Befund weg: das Ergebnis wurde nur für den Dialogtext
benutzt. **Eine Prüfung, die stimmt und deren Ergebnis niemand
weiterreicht, ist schlimmer als keine — sie erzeugt das Gefühl, es sei
geprüft.**

Die Warnungen gehen jetzt durch: Request-Body → Prompt-Payload →
Prompt-Regel → PDF-Kasten **„Angaben, die geprüft gehören"**. Nachgewiesen
an Bericht 85: statt der Renditeaussage steht dort *„Die fehlende
Bruttorenditeangabe resultiert aus einer zu niedrig angegebenen Kaltmiete,
daher ist eine valide Ertragsbewertung derzeit nicht möglich."*

> **Der schwerste Einzelbefund der Sitzung** kam beim ersten Lauf danach
> (`v1211b`): der Text schrieb *„Bruttorenditeansatz von etwa 2,56 Prozent"*
> — `gross_yield_pct` ist aber **null**, und 2,56 % ist der
> **Liegenschaftszinssatz**. Das Modell holte sich, weil das eigene Feld leer
> war, eine Zahl aus einem anderen Feld. **Eine Kennzahl aus dem falschen
> Feld ist eine erfundene Zahl.** Der Prompt nennt die Feldnamen jetzt
> einzeln und den gemessenen Fall als Beispiel.

Dazu `v1211c` (temporale Todeszone — der Kasten kippte den ganzen
PDF-Export) und `v1211d` (ae/oe/ue standen im Kundentext, meine eigene Regel
gebrochen). **Viermal in dieser Sitzung hat `node --check` bestanden,
während nichts funktionierte.**

**`v1210` und `v1211` liegen auf Staging, nicht auf Prod.**

### Die Rechenwege sind nachgerechnet — `v1210`, 03.09.2026 (`8788256`)

Backlog-Punkt **1c** („der Ergebnis-Teil ist nur überflogen", nicht geprüft
waren Bodenwert und die Rechenwege). Am frischen Bericht 83 Zeile für Zeile
nachgerechnet.

**Was stimmt — alles, was gerechnet wird:**

| | |
|---|---|
| Ertragswert | 9.300 + 1.080 = 10.380 Rohertrag · 27 % BWK = 2.803 · Reinertrag 7.577 · Bodenwertverzinsung 40.338 × 2,56 % = 1.033 · Gebäudereinertrag 6.544 × 23,02 = 150.643 · + 2.959 + 40.338 = **193.940**, angezeigt 194.000 |
| Sachwert | 798 × 195 = 155.610 · × 2,02 + 14.800 = 329.132 · − 184.314 (44,8 von 80 J.) + 8.000 + 12.000 + 37.118 = 201.936 · + 40.338 = **242.274** |
| Bodenwert | 950 × 90 + 828 × 5 = 89.640 · −10 % Lärm = 80.676 · × 50 % MEA = **40.338** |

Die BWK-Quote steht auf dem **gesamten** Rohertrag inklusive Stellplätzen,
wie `CLAUDE.md` es verlangt. Nur der rentierliche Bodenwert wird verzinst.
Die Kette kommt an, die Rundung ist eine Rundung.

**Ein Befund, und der ist gebaut.** Die Stammdaten sagten „Grundstück
950 m²", die Bodenwertrechnung darunter rechnete **1.778 m²** (950 × 90 €
plus 828 × 5 €). Die 828 m² kamen im ganzen Dokument nicht vor, die 4.140 €
dafür waren nicht herleitbar. **Kein Rechenfehler** — das Feld heißt
ausdrücklich „*Zusätzliche* Grundstücksfläche / Hinterland". Es ist dasselbe
Problem wie die 4,89 €/m² in `v1207`, nur andersherum: dort stand eine Zahl
da, die nicht rechnete, hier rechnete eine, die nicht dastand. Neue
Stammdatenzeile **„Hinterland 828 m² · 5 €/m²"**, im PDF nachgewiesen.

**`CLAUDE.md` präzisiert: der Prüfmaßstab ist der Datensatz, nicht die
Adresse.** Das App-Objekt `2026-001` trägt dieselbe Anschrift wie das
Testobjekt Hüllhorst, aber ETW **100 m² / Bj 1962** statt 165 m² / Bj 1968.
Es rechnet folgerichtig 242.274 € Sachwert statt 305.937 und 4,89 €/m²
amtliche Miete statt 4,83 — die Mietpreisübersicht staffelt nach Fläche und
Baujahr. Wer das verwechselt, jagt ein Gespenst.

### `v1209` ist abgenommen — echter Bericht, echter Lauf, 03.09.2026

Der Abnahmepunkt aus dem Prod-Rollout ist eingelöst. Auf Marcels *„ja mach
einen bericht"* auf **Staging** erzeugt, mit demselben Objekt wie am 02.09.
(Hermannstraße 9, Hüllhorst), Stufe 3 — **ohne Aufpreis**, weil für dieses
Objekt bereits bezahlt. `report_id 83`, 75 Sekunden, 3.645 Zeichen KI-Text.

**Zahlen je Abschnitt, aus `report_md` gezählt:**

| Abschnitt | Geldbeträge / €-m²-Werte |
|---|---|
| A) Zusammenfassung & Empfehlung | 159.000 · 243.000 · **195.000** |
| B) Objekt, Lage & Markt | 1.695 · 1.357 · 2.138 · 7,75 €/m² |
| C) Bewertung, Rendite & Ausblick | **keine** |

Vorher standen 195.000/159.000/243.000 in A **und** C und 7,67 €/m² in B
**und** C. C beginnt jetzt mit *„Die genannte Wertindikation erlaubt
Verhandlungsspielraum insbesondere am unteren Ende der Spanne…"* — genau der
sprachliche Bezug, den die Vorgabe verlangt. **Der Abschnitt ist dabei nicht
dünner geworden:** Chancen, Risiken, 3–5-Jahres-Einschätzung und Fazit stehen
vollständig drin, nur ohne Zahlenwiederholung.

**Im ganzen PDF steht „195.000" jetzt viermal** — Deckblatt, Sektion 03,
Verfahrensvergleich, Zusammenfassung. Jede Nennung hat einen eigenen Zweck.
**Vor `v1206` waren es zehn.** Inhaltsverzeichnis: 10 Abschnitte.

> **Nebenbefund, der Marcel gehört.** Der Plausibilitätsdialog vor dem Lauf
> meldete zwei echte Dinge zum Objekt `2026-001`: *„Kaltmiete 1,00 €/m² —
> ungewöhnlich niedrig"* (im Objekt stehen 100 €/Monat auf 100 m²) und
> *„Grundstücksfläche bei einer Wohnung — die fließt nur bei Häusern in die
> Bewertung ein"*. Beides sind Objektdaten, keine Defekte — aber die
> Kaltmiete ist mit ziemlicher Sicherheit ein Tippfehler.

### Der Fließtext nennt jede Zahl nur noch einmal — `v1209`, 03.09.2026 (`1f06705`)

Marcels letzter offener Punkt am Bericht. Die Ursache war **keine
Nachlässigkeit des Modells, sondern eine Anweisung**: `report_prompt.txt`
verlangte in Abschnitt A „die zentrale Markt- und Werteinschätzung
(Marktwert, Spanne, Abweichung zum Kaufpreis)" **und** in Abschnitt C „die
Marktwertindikation (Punktwert, Spanne, Konfidenz, Abweichung zum
Kaufpreis)" — zweimal dieselbe Aussage, verlangt in derselben Datei, drei
Zeilen unter dem Satz „Vermeide Wiederholungen zwischen den Abschnitten".

Gemessen im Bericht vom 02.09.2026, welche Zahlen im Fließtext doppelt
standen: **195.000 / 159.000 / 243.000** in A und C, **7,67 €/m²** in B und C.

Neuer Block **„JEDE ZAHL GENAU EINMAL (NICHT VERHANDELBAR)"**. Der Marktwert
steht als Zahl nur noch in A; B und C nehmen sprachlich Bezug. Der Grund
steht im Prompt dabei, damit er nicht wegoptimiert wird.

> **Abnahmepunkt:** dass die Datei ausgeliefert ist, ist bewiesen (im
> Prod-Container gelesen). Ob das Modell sich daran hält, zeigt erst der
> nächste **echte** Bericht — am Replay ist es nicht prüfbar.

### Prod-Rollout 03.09.2026 — v1205 bis v1209 sind live

Auf Marcels „ja umsetzen und auf prod ziehen". Beide Datenbanken vorher
gesichert (`haupt-20260903-0440.sql.gz`, `mb-20260903-0440.sql.gz`), 14
Commits per Fast-Forward, `mb-backend` neu gebaut.

Abnahme am Prod-Bericht (Bielefeld — ein **anderes** Objekt als auf
Staging): `MARKTWERT-SPANNE` weg, `Preisstrategie` weg, Aussagekraft nur
noch in 03, beide Preisbänder auf einer Seite, **7 Abschnitte** mit einem
`05 Lage & Marktumfeld`. Konsole ohne Fehler.

> **Die Klinke aus `v1208` hat sich sofort bewährt:** dieser Bericht hat
> weder `assessment` noch `macro`, also zeichnet nur der Infrastruktur-Block
> — und der Sektionstitel hängt korrekt an ihm. Der Fall war nicht
> theoretisch, er tritt im ersten Prod-Bericht auf, den ich anfasse.

Details im Journal der Projektanweisung.

### Die Lage ist ein Kapitel — `v1208`, 02.09.2026 (`f61a409`)

Marcel hat nach der Demo **Stufe 1** gewählt. `08 Lage- & Potenzialbewertung`,
`09 Makrolage & Sozioökonomie` und `10 Lage & Infrastruktur` begannen alle
drei auf Seite 7; sie sind jetzt **ein** Abschnitt `08 Lage & Marktumfeld`
mit drei Zwischenüberschriften. **13 → 10 Abschnitte** im
Inhaltsverzeichnis, gemessen. Seiten unverändert 9 — wie angekündigt.

Neu ist `blockTitle()`: eine Überschrift **innerhalb** einer Sektion, ohne
Nummernschild und ohne TOC-Eintrag. Es gab bisher nur `sectionTitle`, und wer
damit zusammengehörende Blöcke überschreibt, erzeugt zwangsläufig Kapitel.

Die Sektion heißt **„Lage & Marktumfeld"**, nicht nur „Lage": die
Marktentwicklung wandert mit hinein, weil sie sonst die Sektion zerschnitten
hätte — und eine Marktentwicklung ist keine Lage.

> **Dabei ist eine eigene Fehldiagnose aufgeflogen.** Ich hatte in `v1207`
> zwei Waisen-Umbrüche gemeldet. Einer war echt (der Energiebalken), **der
> andere war eingebildet**: der Haftungsrahmen stand nie allein. Nachgemessen
> mit dem echten `v1207`-Stand über eine Probe-Kopie auf Staging. Damit waren
> `v1207b` und `v1207c` unnötig — und `v1207c` war die Reparatur eines
> Fehlers, den `v1207b` erst erzeugt hat. Der Mechanismus `+ _HR` bleibt
> trotzdem, aber aus dem richtigen Grund. Details im Journal.
>
> **Beide Male hat mein eigenes Werkzeug die Ausnahme versteckt** — einmal
> eine Regex ohne Backslashes, die alles in Klammern verschluckt, einmal ein
> Filter, der alles mit `&` wegwarf. Vor jeder Aussage „X kommt nicht vor"
> gehört die Gegenprobe, ob das Werkzeug X überhaupt zeigen **könnte**.

### Der PDF-Bericht durchgesehen — `v1207`, 02.09.2026 (`8469143`…`9a210f0`)

Marcel hat den Export nach `v1206` gelesen und vier Dinge gesagt. Drei sind
gebaut, eines liegt als Demo bei ihm.

**Sektion 01 ist entschlackt.** Marktwert-Kachel, Marktmiete-Kachel und der
Balken `MARKTWERT-SPANNE` sind raus. Der Block `AUSSAGEKRAFT DER INDIKATION`
ist nicht gelöscht, sondern nach 03 verschoben — dorthin, wo der Marktwert
steht, den er qualifiziert. „195.000" steht jetzt **4×** im Dokument, vor
`v1206` waren es 10×.

**Zwei Waisen-Umbrüche behoben**, die Marcel nicht genannt hat und die beim
Auslesen des PDF auffielen: der Energiebalken von 02 und der Haftungsrahmen
von 07 standen je allein oben auf einer Seite. Ursache beide Male der Block
**davor**, nicht das Anhängsel.

**Die 4,89 €/m² — die Prämisse war falsch.** Der Ertragswert rechnet längst
mit 7,67 €/m² (gemessen: `miete_quelle = "Angebotsmieten"`, Rohertrag
9.204 € ÷ 12 ÷ 100 m²). Die A/B/C-Frage, die ich gestellt und Marcel mit „a"
beantwortet hat, ging von einer falschen Annahme aus und ist zurückgenommen.
Gebaut ist der Geist von A: der Kasten **„Welche Miete der Ertragswert
rechnet"** in 05 nennt beide Zahlen, die Abweichung (−36,2 %), die Lage zur
Vergleichsspanne und den Grund.

**Drei eigene Fehler in derselben Sitzung**, alle im Journal:
`v1207b` (Fix auf einem Pfad, den das Dokument nie betritt), `v1207c`
(globales `sed` setzte `_HR` außerhalb seines Gültigkeitsbereichs — im
Browser sofort `ReferenceError`), `v1207d` (Zahlenformat). **Dreimal hat
`node --check` bestanden, während nichts funktionierte.**

**Bei Marcel liegt:** `design/Vorschläge/marktbericht-struktur.html` —
drei Stufen für die Gliederung. Gemessener Befund: `08`, `09` und `10`
beginnen alle drei auf Seite 7, dieselbe Zersplitterung wie 03/04.
Empfohlen ist Stufe 1 (nur die Lage bündeln, 12 → 10 Abschnitte); sie spart
**keine** Seite, und das steht diesmal vorher da.

### 03 und 04 sind eine Sektion — `v1206`, 02.09.2026 (`99f6dff`)

Marcels Beobachtung am eigenen Bericht: **„Außerdem wird mir zu oft der
Marktwert in dem Bericht angegeben. Eigentlich könnte man Punkt 03 und 04
zusammenfügen und die Anzeige aus 04 übernehmen."** Erst Demo
(`design/Vorschläge/marktbericht-03-04-zusammenlegen.html`), dann gebaut.

**Vorher.** `03 Marktwert & Marktmiete` zeichnete zwei Tacho-Karten
nebeneinander. `04 Preisstrategie` zeichnete **denselben** Marktwert noch
einmal als Band — und `sectionTitle('Preisstrategie', 999)` zwang den
Abschnitt auf eine eigene Seite. Die Zahl stand zweimal groß, im Abstand
einer Seite.

**Nachher.** Eine Sektion 03. Der Preis bekommt das Band aus 04, die Miete
bekommt dasselbe Band eine Nummer kleiner. Der Empfehlungssatz wandert mit,
04 fällt weg, alle folgenden Kapitelnummern rücken auf — auch im
Inhaltsverzeichnis.

**Der Titel bleibt „Marktwert & Marktmiete", nicht „Preisstrategie".** Was
dort steht, ist eine Wertaussage mit Spanne. Das Wort „Preisstrategie"
verspräche eine Verhandlungsempfehlung, die der Abschnitt nicht einlöst.

**Mitgenommen, weil es im Band nicht steckt:** die Aussagekraft
(`confidence_label` + `-pct`) als Punkt in Ampelfarbe, und der Brutto-Faktor
unter dem Mietband. Beides wäre sonst stillschweigend verschwunden.

**Nicht angefasst, weil es NICHT dasselbe ist:** `mv.low/high` ist die
Spanne des **Bewertungsmodells**, `sale.q25/q75` die Quartilspanne der
**Angebote**. Die €/m²-Balken darunter sind keine dritte Wiederholung.

**Nachgemessen** am selben Bericht (Replay, ohne neue Kosten), alte Fassung
gegen neue:

| gemessen | vorher | nachher |
|---|---|---|
| „195.000" im Dokument | 10× | **7×** |
| „MARKTWERT (INDIKATION)" als Kopfzeile | 2× | **1×** |
| Abschnitte im Inhaltsverzeichnis | 13 | **12** |
| „Bodenrichtwert (amtlich)" beginnt auf | Seite 4 | **Seite 3** |
| Seiten gesamt | 9 | 9 |

> **Die Seitenersparnis tritt NICHT ein, und das steht hier, weil ich sie in
> der Demo behauptet hatte.** Der Platz, den der erzwungene Umbruch frei
> gibt, wird vom nachrückenden Marktbericht-Text sofort wieder aufgebraucht.
> Was eintritt, ist das Eigentliche: der Marktwert steht nur noch einmal als
> große Kopfzeile, und drei Nennungen weniger im ganzen Dokument.

Cache-Buster-Kette komplett auf 1206 (alle drei Glieder). Browser-Abnahme
auf Staging ohne Konsolenfehler.

**Offen und davon unberührt:** die Zahl steht danach noch siebenmal im
Dokument, vor allem im Fließtext des KI-Berichts — das wäre eine Änderung
an der Textvorgabe, kein Layout. Und die Miete im Band kommt aus
Vergleichsangeboten (6,66–8,30 €/m²), während der Ertragswert daneben mit
4,89 €/m² aus der amtlichen Übersicht rechnet — **unterhalb der ganzen
Spanne**. Das ist die größere Baustelle und wartet auf Marcels Entscheidung
(A/B/C, siehe „Entscheidungen, die bei Marcel liegen").

### Der PDF-Export geprüft — `v1205`, 02.09.2026 (`3d334e9`)

**Marcel hat den erzeugten Marktbericht als PDF abgelegt** (10 Seiten,
`design/mockups/Marktbericht_32609_Ahlsen_Reineberg.pdf`, liegt als Beleg
im Repo). Text ausgelesen, 23.472 Bausteine, geprüft.

**Ein Befund:** im selben Dokument standen zwei Zahlensysteme —
`2.56 %` sechsmal mit Punkt gegen `2,56 %` zweimal mit Komma, `35.2 Jahre`
gegen `35,2 J.` Die Staffel interpolierte rohe JS-Zahlen, während der
Euro-Betrag **in derselben Zeile** schon durch `de-DE` lief. **Der
Rechenweg ist dafür da, dass jemand nachrechnet.** Gefixt mit einer Stelle
je Seite (`deZahl()` im Backend, `_deZahl()` im Frontend); nachgemessen am
frisch erzeugten Bericht: null Punkt-Zahlen.

**Alles andere hat bestanden:** keine Währungsreste · kein
„Durchschnittlich" mehr · keine NaN/undefined (die „nan"-Treffer stecken
in „Finanzierungsdaten" und „Außenanlagen") · Bodenwert **40.338 €** als
„Bodenwertanteil dieses Objekts" · Sachwert und Ertragswert identisch mit
dem Schirm · keine Platzhalter, keine Null-Euro-Felder.

> **Damit ist der letzte weiße Fleck des Marktberichts geprüft.** Der
> PDF-Export hatte nie jemand angesehen — und er ist das, was der Kunde
> einer Bank hinlegt.

### Die Skala der Haupt-App gilt — `v1204`, 02.09.2026 (`2c3a62c`)

**Marcels Entscheidung:** *„so wie in der Haupt-App. bitte claude md
anpassen."*

**`CLAUDE.md` war falsch.** Dort stand *„STARK / SOLIDE / SCHWACH bei
≥ 70 / ≥ 50 / < 50"* — das war weder die Objektkarte noch sonst eine
Stelle im Code. „STARK" kommt als Score-Stufe nirgends vor, und zwei
Stufen fehlten ganz. Jetzt steht dort die Kette der Karte
(`js/dashboard.js:390`): **≥ 85 TOP · ≥ 70 GUT · ≥ 50 SOLIDE · ≥ 35
SCHWACH · < 35 KRITISCH**, mitsamt dem alten Wortlaut als Zitat, Datum und
Grund — eine still korrigierte Projektdatei lässt den nächsten Leser im
Unklaren.

**Der Marktbericht folgt jetzt derselben Kette.** `_scoreTier()` kannte
nur vier Stufen; alles unter 50 hieß pauschal „Schwach". **Ein Objekt mit
Score 12 stand damit in derselben Stufe wie eines mit 49.**

Gegengeprüft im Browser an zwölf Proben einschließlich aller Grenzwerte
(85/84, 70/69, 50/49, 35/34) — **alle identisch mit der Haupt-App.**

> **Zwei Abweichungen bleiben, benannt und nicht im Vorbeigehen geändert:**
> `js/dashboard.js:1283` sagt „Sehr gut / Gut / Solide / Schwach" (vier
> Stufen), und der Marktbericht-Backend führt sein eigenes Vokabular
> weiter — es wird seit `v1203` nur nicht mehr angezeigt. Beide stehen
> jetzt in `CLAUDE.md`, damit sie nicht wieder vergessen werden.

### Eine Sprache für eine Zahl — `v1203`, 02.09.2026 (`ac137df`)

Im Ergebnis-Kopf stand am selben Score zweimal ein anderes Wort:
**„56 / 100 · Solide"** im Ring, **„DEAL-SCORE · Durchschnittlich"**
daneben. Ursache: `ds.rating || _scoreTier(s)` — der Ring zeichnet immer
`_scoreTier`, die Überschrift bevorzugte den Backend-Rating.

**Drei Vokabulare im Haus, gemessen:** die Haupt-App sagt
TOP/GUT/SOLIDE/SCHWACH/KRITISCH, das Marktbericht-Frontend
Top/Gut/Solide/Schwach, das Marktbericht-Backend Sehr attraktiv/Attraktiv/
Durchschnittlich/Unterdurchschnittlich. **Der Backend-Rating ist der
Ausreißer** — sein Wortschatz kommt sonst nirgends vor, `_scoreTier` deckt
sich mit der Haupt-App. Deshalb entscheidet jetzt `_scoreTier`, auf dem
Schirm **und im PDF**. Das Feld bleibt im Datensatz, es wird nur nicht mehr
angezeigt.

Dabei fiel eine wortgleiche Kopie von `_scoreTier()` auf, mitsamt einem
Kommentar mit toter Zeilenangabe.

> **Zwei Dinge bleiben ausdrücklich offen**, weil sie Entscheidungen sind:
> die **Dopplung** („Solide" steht jetzt zweimal nebeneinander, klein im
> Ring und groß als Überschrift — Einzeiler in beide Richtungen), und dass
> **`CLAUDE.md` mit keiner der drei Ketten übereinstimmt** („STARK /
> SOLIDE / SCHWACH bei ≥ 70 / ≥ 50 / < 50", während die App fünf Stufen
> hat und TOP/GUT sagt).

### Die Stufe wird wieder gewählt — `v1202`, 02.09.2026 (`4d649ff`)

**Marcels Entscheidung**, nachdem er die Nebenwirkung aus `v1201` gesehen
hatte: *„dann lass uns doch wieder die drei Stufen zum Auswählen machen und
dann für die jeweilige Stufe die Pflichtfelder anzeigen."*

**Das kehrt `v1193` um** — und schließt damit den offenen Punkt „springt
die Stufe von allein auf 3?".

```
vorher   Preis und Tiefe = erreicht()    -> die Daten bestimmen die Kosten
jetzt    Preis und Tiefe = gewaehlt()    -> der Nutzer bestimmt die Kosten
```

`erreicht()` bleibt unverändert und sagt weiterhin, ob die gewählte Tiefe
**vollständig** ist — es entscheidet nur nicht mehr, was sie kostet. Die
Wahl steht ohne Zutun auf **1**, der günstigsten; **teurer wird es nur
durch einen Klick.**

**Nachgemessen am unbezahlten Objekt 2026-999:** Klick auf 1 / 2 / 3 / 1
ergibt „1 Marktpreisindikation" / „1 Erweiterte Marktpreisindikation" /
„1 Wertermittlung nach ImmoWertV" / wieder „1 Marktpreisindikation".
**Der Preis folgt der Wahl in beide Richtungen.**

Die Pflichtfelder werden für die **gewählte** Tiefe markiert, über alle
Stufen bis dahin — Stufe 3 braucht auch die Angaben von 1 und 2. Und die
Sperre in `generate()` gilt jetzt allgemein statt nur für den
Miteigentumsanteil; **welche Angaben fehlen, weiß `mb-stufen.js` allein**
und gibt sie über `offenFuer()` heraus, damit in `app.js` keine zweite
Liste entsteht.

> **Nebenbefund:** der Knopf ist bei fehlenden Angaben ohnehin schon
> `disabled`. Die neue Sperre ist das **Netz für den Fall, den die App
> nicht sehen kann** — ein Feld, das gar nicht im DOM ist. Beide Wege
> getrennt geprüft.

### Der Miteigentumsanteil ist Pflicht — `v1201`, 02.09.2026 (`a47f3d2`)

**Marcels Entscheidung:** *„der Miteigentumsanteil muss ausgefüllt werden
als Pflichtwert, sonst kann man es nicht ausführen."* Ich hatte davon
abgeraten, er hat es bestätigt — gebaut.

Drei Teile: **das Feld steht jetzt im ersten Block** (es lag in
`FELDER.stufe3` und war bei Stufe 1/2 nicht einmal sichtbar — eine Pflicht,
die man nicht erfüllen kann, ist eine Sackgasse) · **die Ampel verlangt ihn
ab Stufe 1** über das neue `bedarf1()`, nur bei ETW · **und `generate()`
bricht ab**, springt ins Feld und erklärt warum. Kein `alert()`, sondern
`errBox` — ein natives Fenster blockiert den Renderer.

Dabei fiel auf, dass `(n === 3) ? bedarf3() : BEDARF[n]` **dreimal
wortgleich** im Haus stand. Jetzt gibt es `bedarfFuer(n)`, eine Stelle.

**Nachgemessen:** `mea` geleert → Stufe 0, Knopf ohne Preis, Feld
markiert, Klick zeigt **keinen** Bestätigungsdialog, die Meldung steht in
der Fehlerfläche, kein natives Fenster.

> **⚠ NEBENWIRKUNG, DIE GELD KOSTET.** Bei einer vollständig gepflegten
> ETW springt die Stufe jetzt von allein auf 3 — der Knopf fordert
> „1 Wertermittlung nach ImmoWertV" statt „1 Erweiterte
> Marktpreisindikation" (Einzelkauf 3,90 € statt 1,90 €).
>
> **Kein neuer Fehler, sondern eine Folge der Entscheidung:** am ZFH
> „Löhner Str. 278" steht `erreicht: 3` ebenfalls, und dort gab es nie ein
> `mea`-Feld. **Bei Häusern war der Selbstsprung längst so**; bei ETW war
> er nur zufällig gedeckelt, weil das Pflichtfeld unsichtbar war.
>
> Wer das nicht will, muss die Tiefe wieder an einen ausdrücklichen Klick
> binden (`_angestrebt` gibt es dafür) — **für alle Objektarten**, nicht
> nur für ETW. Steht als offener Punkt.

### Der Miteigentumsanteil war da und wurde nicht mitgeschickt — `v1200`/`b`, 02.09.2026

**Aus Marcels Frage entstanden** („sollten wir das nicht als Pflichtfeld
setzen?"). Die Messung sagt: **ein Pflichtfeld hätte den Fall gar nicht
verhindert.** Bei Stufe 2 existiert das Feld `mea` nicht im Formular —
aber `_mbVorrat('mea')` lieferte **„50"**, und `payload().mea_pct` war
**null**. Die App kannte den Wert, schrieb in die Ampel „liegt im Objekt
vor" — und schickte ihn nicht mit.

**Die Unterscheidung, auf die es ankommt:** Feld da, aber leer → der
Nutzer wollte es so. Feld gar nicht da → niemand wollte etwas, der Vorrat
gilt. Neu ist `pWert()`, benutzt **nur** in `payload()`; `wert()` bleibt
unangetastet, damit die Stufe weiter am ausgefüllten Formular hängt
(`v1139`: „nie ohne Zutun"). **Kein Preis-Einfluss, nachgemessen:**
`wert_stufe` blieb 2, Knopf „ohne Aufpreis", Kontingent 48/9/10.

**Das Ergebnis, derselbe Bericht:**

| | vorher | jetzt |
|---|---|---|
| Bodenwert | — | **40.338 €** (der Anteil, nicht das Grundstück) |
| Verfahren | vereinfachtes | **allgemeines Ertragswertverfahren** |
| Ertragswert | 50.365 € | **192.328 €** |
| Sachwert | – | **242.274 €** |
| Spread der drei Verfahren | **286 %** | **1,6 %** |

> **Die 40.338 € sind kein Zufallstreffer** — genau diese Zahl steht im
> `v1140`-Kommentar als geprüfter Sollwert dieses Objekts, und die 2,56 %
> Zinsanpassung in `CLAUDE.md` als Kennzahl von Hüllhorst. Die Reparatur
> reproduziert die bekannten richtigen Werte.

**Es war nie ein Miteigentumsanteil-Problem, sondern ein Payload-Problem:**
auch `spMiete` und `sonstEinnahmen` gingen verloren — der Rohertrag stieg
von 5.160 € auf 10.284 €.

**Dazu:** die Ertragswert-Karte sagt jetzt „· ohne Bodenwert gerechnet",
wenn es so ist — und schweigt, wenn nicht.

**`v1200b`** war ein eigener Fehler: `pWert` stand nach dem `return` von
`wert()`, aber vor dessen Klammer — also im falschen Gültigkeitsbereich.
**Syntaktisch einwandfrei, `node --check` meldete „OK"**, und der erste
echte Aufruf warf `ReferenceError`. Zum zweiten Mal in dieser Sitzung
dieselbe Lehre (nach `v1196b`): **Verträge prüft nur ein echter Lauf.**

### Fehlende Angaben stehen jetzt am Feld — `v1199`, 02.09.2026 (`4964e64`)

**Marcels Wahl aus der Demo: „b ist super".** Goldener Merkstreifen plus
eine Zeile „fehlt für <Stufenname>", **nur für die nächste Stufe**.

Vorher standen die Pflichtangaben der Stufen 1–3 nur in der Ampel — ganz
oben, außerhalb des Reiters. Von `address`/`ptype`/`area`/`year`,
`cond`/`quality` und `plot`/`units` trug **keines** einen Marker.

**Warum Gold und nicht Rot:** ein leeres Feld ist kein Fehler, und Rot ist
in der Ampel schon für „fehlt" vergeben. Zweimal dieselbe Farbe für zwei
Dringlichkeiten macht beide stumpf. Die tote CSS-Regel `.wm-f.fehlt`
(rote Kontur, nie verdrahtet) bleibt bewusst liegen — sie war der Entwurf,
der nicht gewonnen hat.

**Keine zweite Liste:** Feld-IDs und Klarnamen aus `BEDARF`/`bedarf3()`,
der Stufenname aus `NAMEN` — dieselben Quellen wie Ampel und Knopf.

**Am Objekt „Hölderlinstr. 1" durchgespielt:** Stufe 1 → `cond`+`quality`
markiert · `cond` ausgefüllt → dessen Marke weg · `quality` ausgefüllt →
Stufe 2, Marken **wandern** auf `plot`+`units` · `mea` (noch nicht im DOM)
bleibt unmarkiert, dort greift der `v1196`-Hinweis.

> **`v1196` und `v1199` greifen ineinander:** Felder, die es gibt, werden
> am Feld markiert; Felder, die es noch nicht gibt, erklärt ihr leerer
> Reiter. Zusammen bleibt keine Lücke, in der der Nutzer raten muss.

**Gemessen, nicht geraten:** der Feldrahmen kommt aus `input,select` mit
Spezifität (0,0,1) — die Klassenregel (0,1,1) gewinnt ohne `!important`.
Und der Behälter ist je Reiter ein anderer; `#address` hängt sogar ganz
ohne Hülle im Reiter, dafür gibt es einen eigenen Zweig.

### Der Ertragswert verzinste das volle Grundstück einer ETW — `v1198`/`b`/`c`, 02.09.2026

**Der schwerste Befund dieser Sitzung, und er stand im Ergebnis-Teil, den
noch nie jemand angesehen hatte.** Bei einer Eigentumswohnung ohne
erfassten Miteigentumsanteil rechnete der Ertragswert mit dem **vollen**
Grundstück — verzinste es und addierte es:

```
= Reinertrag                                3.767 €
− Bodenwertverzinsung (85.500 € × 2,2 %)   −1.881 €   ← halber Reinertrag
+ Bodenwert                                85.500 €   ← volles Grundstück
= vorläufiger Ertragswert                 110.716 €
```

**Derselbe Bericht führte daneben `bodenwert.wert = null`** mit dem
Hinweis, der Bodenwert bleibe „hier außen vor". Zwei Rechnungen derselben
Größe, und der Ertragswert nahm die ungeschützte.

**Ursache, eine Zeile** (`CrossCheckService.js:447`): der Rückfall las
`vollstaendig: false` als „liegt nicht vor" statt als „die Regel hat
entschieden" — und setzte `plot × brw` ein, genau den Wert, den der
`v1026`-Schutz verworfen hatte. Und meldete ihn als vollständig.

> **Ein stiller Rückfall sieht aus wie ein bestandener Lauf.** Der Schutz
> war da, lief, entschied richtig — und eine Ebene weiter wurde seine
> Entscheidung als Datenlücke missverstanden.

**Gegengeprüft, dasselbe Objekt, eine Zeile Unterschied:** Ertragswert
110.716 € → **50.365 €**, Verfahren „allgemeines" → „vereinfachtes (ohne
Bodenwerttrennung)", Bodenwertverzinsung und „+ Bodenwert" entfallen.

**`v1198b`:** danach stand „–" ohne Grund, während der Rechenweg weiter
„950 m² × 90 €/m² = 85.500 €" zeigte. Der fertige Erklärsatz lag im
Backend und wurde nie angezeigt. Jetzt steht er da — dieselbe Regel wie
`v1197`: **keine Zahl und kein Strich ohne Herkunft.**

**`v1198c`:** dabei fiel auf, dass genau dieser Satz in `ae/oe/ue` stand
(„ueber", „waere", „Grundstueckswert", „aussen", „ergaenzen"). **Es fiel
nie auf, weil ihn niemand zu sehen bekam.** Gegengeprüft über alle
`hinweise`/`warnungen`/`notes` im Marktbericht-Backend: keine weitere
Stelle.

**MARCEL MUSS DAS ALS SACHVERSTÄNDIGER GEGENLESEN** — es ändert den
Ertragswert jeder ETW ohne erfassten Miteigentumsanteil. Die Regel ist
nicht neu (`CLAUDE.md`, `v1026`); neu ist, dass der Ertragswert sie
befolgt. Der saubere Ausweg bleibt: **den Miteigentumsanteil eintragen.**

### Der Ergebnis-Teil, erstmals angesehen — `v1197`, 01.09.2026 (`c9efc07`)

**Der Ergebnis-Teil war laut Backlog „überhaupt noch nicht angesehen
worden".** Beim ersten Blick fielen zwei Dinge auf, beide über Ehrlichkeit
von Zahlen.

**1 · Ein fehlender Kaufpreis machte das Objekt schlecht statt unbewertet.**
Die Kennzahlenzeile sagt korrekt „– %" für die Bruttorendite. Die
Score-Komponente daneben stand auf **0 / 100** und riss über ihr Gewicht
von 20 % den ganzen Deal-Score mit — ohne jede Erklärung daneben.

Ursache an zwei Stellen: `grossYieldPct ?? 0`. Die Formel ist
`clamp01((gy-2)/6)`, **ihr neutraler Punkt liegt bei 5 %, nicht bei 0.**
Die `?? 0` war von den Nachbarn abgeschrieben, wo 0 zufällig neutral ist
(Preisabschlag) oder wo gleich `?? 50` steht (Makro, Mikro).

> **Die Falle steht wörtlich in `CLAUDE.md`:** *„`Number(null)` ist 0 und
> besteht `Number.isFinite` — erst auf Abwesenheit prüfen, dann rechnen."*
> Und der Kopf der betroffenen Datei sagt seit jeher *„sonst neutral 50 +
> Note geschätzt"* — `macroScore()` hält sich daran, `dealScore()` nicht.

**2 · Ein Untertitel, der log.** `mietentwicklung: 'mangels Miet-Zeitreihe
konservativ angesetzt'` war fest verdrahtet und erschien immer — im
geöffneten Bericht neben **100/100**, was nur **mit** echter Zeitreihe
zustande kommt.

**Am echten Bericht gegengeprüft, dasselbe Objekt, dieselben Daten:**

| | alt (id 72) | neu (id 78) |
|---|---|---|
| Bruttorendite-Teilwert | **0** / 100 | **50** / 100 |
| Deal-Score | **45** | **56** |
| `geschaetzt` | Feld fehlt | `["preisabschlag","bruttorendite"]` |

Auf dem Schirm steht jetzt an jedem geratenen Balken **„keine Daten —
neutral angesetzt"**. Und im Funktionslauf belegt: **eine echte Null (0 %
Rendite) bleibt schlecht** — nur „unbekannt" nicht mehr.

**Nebenbeweis:** der zweite Bericht auf dasselbe, bereits bezahlte Objekt
kostete **nichts** — Kontingent vor und nach dem Lauf 48 / 9 / 10.

**Bewusst nicht entschieden:** statt neutral zu ersetzen könnte man den
fehlenden Teilwert weglassen und die übrigen Gewichte hochnormieren.
Fachlich ebenso vertretbar, fällt anders aus — **das ist Marcels
Entscheidung**, siehe offene Punkte.

**Alte Berichte behalten ihre gespeicherten Zahlen.**

### Der Wizard inhaltlich durchgegangen — 01.09.2026

Neben den leeren Reitern (`v1196`) wurde der Inhalt geprüft:

- **Die bedingte Pflicht-Logik stimmt.** In Reiter 6/7 trägt jedes
  gesternte Feld einen gefüllten Auslöser: Hinterland 828 m² → Wertansatz
  Pflicht, Garage 64,58 m² → Standardstufe Pflicht, Anpassung −10 % →
  Begründung Pflicht. `pflichtWenn()` arbeitet wie vorgesehen.
- **BEFUND, offen:** die Pflichtangaben der Stufen 1–3 sind in den Reitern
  2–5 **nicht** als solche erkennbar. `address`/`ptype`/`area`/`year`
  (Stufe 1), `cond`/`quality` (Stufe 2), `plot`/`units` (Stufe 3) tragen
  keinen Marker — nur `baustatus` hat einen, weil es zufällig über
  `wertermittlung.js` gerendert wird. Die einzige Stelle, die sie nennt,
  ist die Ampel **oben, außerhalb des Reiters**.
- **Dazu passt ein toter Mechanismus:** `wertermittlung.js:393` definiert
  `.wm-f.fehlt input{outline:2px solid …}` — **die Klasse `fehlt` wird
  nirgends gesetzt.** Gebaut und nie verdrahtet.

### Das Deploy-Skript ist repariert — `v3` / `v3b`, 01.09.2026 (`d0ab1f4`)

**Marcels Frage: „warum geht das deploy script nicht?"** Antwort: aus drei
Gründen gleichzeitig, und der schwerwiegendste stand nirgends im Backlog.

#### Der Fund, den niemand auf dem Zettel hatte

**PowerShell-Variablen sind nicht groß-/kleinschreibungsempfindlich.**
`$BRANCH` und `$branch` sind **dieselbe** Variable.

```
$BRANCH = "staging"
$branch = git rev-parse --abbrev-ref HEAD    # ueberschreibt $BRANCH
if ($branch -ne $BRANCH) { ... }             # vergleicht main mit main
```

Gemessen auf `main`: `branch='main'  BRANCH='main'  -ne ergibt: False`.

> **Die Sperre, die einen versehentlichen Push von `main` nach
> `origin/staging` verhindern soll, war nie aktiv** — und meldete dabei
> freundlich `[ok] lokaler Zweig: main`.

Dieselbe Falle steckte **zweimal mehr** in derselben Datei: `$REMOTE`
gegen `$remote` (deshalb schickte Schritt 7 das ganze Bash-Skript als Pfad
an ein `cd` — sichtbar an
`bash: cd: $'/opt/dealpilot\r': No such file or directory`) und `$FERN`
gegen `$fern`. **Ich habe diesen Fehler aus `v2` geerbt und im ersten
Anlauf von `v3` wiederholt.** Gefunden erst beim Prüfen der
Abbruch-Pfade — ein Skript, das nur im Erfolgsfall stimmt, ist nichts wert.

#### Die beiden bekannten Defekte

**1 · Ein BOM vor `set -e`.** Die PowerShell-Pipe an `ssh "bash -s"`
setzte `EF BB BF` davor; auf dem Server gemessen:

```
0000000  357 273 277   s   e   t       -   e  \n
```

bash meldete „set: command not found" — **und damit war der
Abbruch-bei-Fehler auf dem Server nie aktiv.** Weder `$OutputEncoding`
noch `[Console]::OutputEncoding` auf `UTF8Encoding($false)` half, beides
gemessen. **Also gar keine Pipe mehr:** `[IO.File]::WriteAllText` mit
`UTF8Encoding($false)`, `scp`, dann dort ausführen. Gegenprobe auf dem
Server: die Datei beginnt mit `#`, trägt **null** CR-Bytes, `set -e` steht
intakt auf Zeile 2.

**2 · `$ErrorActionPreference = "Stop"` starb an gits stderr.** WinPS 5.1
verpackt stderr nativer Programme in einen `NativeCommandError`; mit
„Stop" bricht das ab. `git push` schreibt `To https://github.com/…`
**immer** auf stderr, auch im Erfolgsfall. Jetzt „Continue" und nach jedem
nativen Aufruf `$LASTEXITCODE`.

> **Ehrlich dazu:** diesen Abbruch konnte ich im Werkzeug-Host nicht
> reproduzieren — dort wird stderr nicht verpackt. Der Beleg ist der echte
> Lauf in Marcels Konsole beim `v1194`-Rollout. Die Reparatur hält in
> beiden Fällen, weil sie nicht mehr auf das Fehlerverhalten baut, sondern
> auf den Rückgabewert. **„Kann ich nicht reproduzieren" ist kein
> „gibt es nicht".**

#### Und der Grund, warum „Fertig." jetzt etwas bedeutet

Weil die Defekte sich gegenseitig verdeckten, musste der Serverstand
bisher **jedes Mal von Hand** nachgeprüft werden — allein in dieser
Sitzung fünfmal. **Schritt 7 liest jetzt den HEAD des Servers und
vergleicht ihn mit dem lokalen**; bei Abweichung ist es ein Abbruch, egal
wie freundlich alles davor aussah.

Dabei fiel ein weiterer eigener Fehler auf: ein nackter `ssh …` schreibt
in den Erfolgs-Stream, und Schritt 7 las die Ausgabe von Schritt 6 mit —
verglichen wurde
`"Server-Zweig: staging Already up to date. AUSGEROLLT: 38d819d 38d819d"`
gegen `"38d819d"`. **Ein Fehlalarm bei einem Rollout, der sauber
durchlief.** Jetzt geht alles Anzeigende an `Out-Host`, und der Vergleich
nimmt per `Select-Object -Last 1` nur die letzte Zeile — robust auch gegen
Login-Banner und motd.

#### Warum die Datei jetzt im Repo liegt

Sie stand in `.gitignore`, **ohne Begründung, als einziges Werkzeug unter
`tools/`** — `gold-audit.py`, `baue-mailtexte.js` und die
`swf-register`-Kette sind alle versioniert. **Genau deshalb konnte eine
kaputte Fassung so lange überleben: kein Diff, keine Historie, keine
Gegenlesung.** Nichts Schützenswertes steht drin (Anmeldung über den
SSH-Schlüssel; beide Server-IPs stehen ohnehin im versionierten
`CLAUDE.md`). Die Ignore-Zeile ist durch einen Kommentar ersetzt, der das
festhält.

#### Nachgewiesen, alle drei Pfade

| Fall | Ergebnis |
|---|---|
| Sauberer Lauf mit echtem Push | **Exit 0**, Server-Pull lief, `[ok] Serverstand geprueft: d0ab1f4 == lokal d0ab1f4` |
| Falscher Zweig (`main`) | **Exit 1** — `ABBRUCH: Lokaler Zweig ist 'main', erwartet 'staging'` (vorher: lief durch) |
| Schmutziges Arbeitsverzeichnis | **Exit 1** — Dateiliste, dann Abbruch |
| Übertragene Datei auf dem Server | beginnt mit `#`, **0 CR-Bytes**, `set -e` auf Zeile 2 |
| Namenskollisionen | alle 24 Variablennamen nach `ToLower()` gruppiert — **keine Gruppe mit mehr als einer Schreibweise** |

### Der Wizard-Durchgang und die leeren Reiter — `v1196` / `v1196b`, 01.09.2026

**Das war der Auftrag des obersten Backlog-Punktes: den Wizard-Ablauf
komplett durchgehen.** Alle sieben Reiter am Objekt „Hölderlinstr. 1"
(erreichte Stufe 1) geklickt und vermessen:

| Reiter | Höhe | Felder |
|---|---|---|
| 1 Übersicht · 2 Objekt · 3 Zustand · 4 Ausstattung · 5 Gebäude & Außen | 384–511 px | 2–9 |
| **6 Wertermittlung** · **7 Zusatzwerte** | **18 px** | **0** |

In 6 und 7 stand nur die eigene Unterzeile des Reiters — bei 6 wörtlich
„Bodenwert, NHK, Feinjustierung". Sonst nichts.

**Kaputt war nichts.** Die Felder gehören zu Stufe 3 und erscheinen, sobald
man die Tiefe ansteuert; nachgemessen füllt ein Klick auf die Ampel-Zeile 3
den Reiter 6 mit 15 und Reiter 7 mit 6 Feldern. **Aber wer den Reiter
direkt anklickt, sieht davon nichts.**

> **Eine richtige Mechanik, die aussieht wie ein Fehler, ist ein Fehler.**

Jetzt steht im leeren Reiter, zu welcher Stufe die Angaben gehören, was
noch fehlt, und ein Knopf blendet sie ein — **mit Text aus der Ampel, nicht
aus einer zweiten Liste.** Ist die Ampel noch nicht da, erscheint gar kein
Hinweis: lieber nichts sagen als etwas Erfundenes.

**`v1196b` — und dann klickte mein eigener Knopf ins Leere.** Beim
Nachmessen gefunden, **bevor** das Paket als fertig gemeldet wurde. Der
Knopf hielt die Ampel-Zeile fest, die beim *Bauen* gegriffen wurde;
`mb-stufen.zeichnen()` setzt aber bei jedem `melden()` das `innerHTML` von
`#wm-ziel` neu. Die Referenz war danach ein **losgelöster** Knoten — und
der hat keinen Weg mehr zum `document`, an dem der Handler als delegierter
Listener hängt. **Wirkung null, Fehler keiner, Meldung keine.**

Gemessen statt vermutet: der Klick auf die **frisch gesuchte** Zeile macht
0 → 12 Felder, und `querySelector(…) === alteReferenz` ergab
**„NEUES Element"**. Jetzt wird nur die Stufenzahl festgehalten.

> **Dieselbe Fehlerklasse wie der Gelddefekt aus `v1194`, nur andersherum:**
> dort gewann der spätere Setzer einer globalen Funktion, hier verliert eine
> festgehaltene Referenz gegen ein neu gezeichnetes DOM. **Beide Male sieht
> der Quelltext richtig aus und beide Male passiert im Browser nichts.**

**Cache-Buster: alle drei der Kette gleich mit** — die Lektion aus `v1194b`,
angewandt statt wiederholt.

---

### Der Marktbericht-Abruf ist gefahren — 01.09.2026, auf Marcels Freigabe

**Die offene Frage seit der Übergabe: zieht die Abbuchung die richtige
Art?** Beantwortet. Objekt `2026-004`, Stufe 2, angekündigt „1 Erweiterte
Marktpreisindikation":

- Kontingent **MPI+ 10 → 9**, MPI und WEV unberührt
- Log `marktbericht:full · cost 1 · source 'monthly' · {"art":"mpi_plus"}`
- `mpi_plus_used` 0 → 1, **Bank unverändert** — erst der Monat, dann die Bank
- Zweiter Lauf: „ohne Aufpreis"; Stufe 3 verlangt die **volle** WEV, keine
  Differenz — genau wie `v1187`/`v1193` angekündigt haben

**Dabei gelernt:** der Bestätigungsdialog ist ein natives
`window.confirm()` (`marktbericht-app/app.js:330`) und blockiert den
gesamten Renderer **samt Browser-Erweiterung**. Screenshot, JS-Auswertung
und Tastendrücke liefen alle in den Timeout. **Beim Prüfen nicht blind
drücken.**

**Der `402`-Pfad ist halb bewiesen** — serverseitig gelesen, frontendseitig
gemessen (Kaufangebot aus `v1187` mit Live-Preis 1,90 € aus Stripe). Dass
der Server den 402 unter echten Bedingungen schickt, ist **nicht** belegt:
dafür müsste eine Art auf 0 gesetzt werden, und der Datenbank-Eingriff
wurde von der Umgebung blockiert.

### Die abgeschaffte Währung ist vom Geldweg — `v1194` / `v1194b`, 01.09.2026

**Gesucht war etwas anderes.** Der Auftrag aus der Übergabe lautete, den
Wizard-Ablauf des Marktberichts nach Resten des Preisumbaus
(`v1176`/`v1183`) abzusuchen. Gefunden wurde ein Defekt, der **Geld
kostet** und nichts mit dem Wizard zu tun hat.

**`credits-modal.js` kaperte den Kaufweg.** Die Datei ist der
Kerosin-Laden aus `v489`. Sie setzt am Ende `window._buyCreditPack` —
dieselbe globale Funktion, die `js/settings.js:2109` setzt. In
`index.html` steht `settings.js` auf 3151, `credits-modal.js` auf 3252,
beide ohne `defer`. **Der spätere Setzer gewinnt.** Im laufenden Staging
ausgelesen, nicht vermutet:

```
window._buyCreditPack  →  credits-modal.js (KEROSIN)
```

Damit landete jedes „Dazubuchen"/„Kaufen" aus Einstellungen → Plan im
alten Laden mit den alten Preisen. **Die `v1184`-Reparatur lief auf diesem
Weg nie** — sie war fertig, getestet und richtig, und kam trotzdem nie
dran. Und das Backend kennt `kerosin_10…160` weiterhin;
`creditPackWebhook.js` bucht sie auf `bonus_credits`, die Spalte, die
`aiCreditsService` seit `v1183` nicht mehr liest. **Geld rein, nichts
raus.**

**Die Datei wurde ausgeräumt, nicht gelöscht** — `checkPurchaseSuccess()`
ist der einzige Leser von `?credit_purchase=`, dem `success_url`-Parameter
aus `routes/credits.js:213`. Ihr Text lautete bis hierher „✓ Kerosin
erfolgreich getankt!".

**Fünf weitere Stellen, alle mit falschem PREIS, nicht nur falschem Namen:**

| Datei | stand da | Wahrheit |
|---|---|---|
| `js/object-actions.js` | „**20 L** Sprengnetter" (live gemessen) | `consumeAvm()` zieht **1 Marktwert-Abruf** |
| `js/ui.js` | Knopf „Trend-Text erzeugen **1 L**" | kostet **nichts** (`logExtract`, `cost 0`) |
| `js/bmf-modal.js` | „KI-Vorschlag **(1 Credit)**" nach jedem Lauf | kostet nichts, `ai.js` hat keinen 402 mehr |
| `js/tooltip-content.js` | „kostet **2 Credits** / je **1 Credit**" | alle drei Analysen kostenlos |
| `marktbericht-app/wertermittlung.js` | `KEROSIN = {1:2,2:5,3:12}` | zweite Preisquelle neben dem Server |

Dazu ein kaputtes Escape in `js/ui.js`: **„Gerade nicht verf00fcgbar"** —
dem `ü` fehlte der Backslash.

**Der Befund zur Methode.** `v1187` suchte nach dem **Wort** „Kerosin",
`v1193` nach `\d+ L` im **Seitentext**. Beide hätten den
Marktradar-Hinweis verfehlt: dort steht `' L'` mit einem geschützten
Leerzeichen — mein erstes `grep` nach `' L'` fand ihn auch nicht.
**Und keine Textsuche der Welt hätte gefunden, dass zwei Dateien dieselbe
globale Funktion belegen.** Das sieht man erst im laufenden System.

> **Die allgemeine Regel, die dabei herausfiel:** wo zwei Dateien denselben
> globalen Namen setzen, entscheidet die Ladereihenfolge in `index.html` —
> und der Verlierer ist **lautlos** weg. Eine Reparatur kann vollständig,
> getestet und richtig sein und trotzdem nie laufen. Wer eine Funktion
> repariert, die `window.x = …` heißt, prüft **im Browser**, ob seine
> Fassung die ist, die dort ankommt.

**`v1194b`** zog den iframe-Cache-Buster nach (`js/marktbericht-view.js:91`
stand auf 1193). Ohne ihn wäre der Marktbericht-Teil des Pakets im Repo
richtig und im Browser nicht angekommen. **`v1193` hatte genau diese Kette
schon dokumentiert** — ich bin trotzdem hineingelaufen und habe es erst
beim Nachmessen bemerkt.

**Nachgemessen auf Staging (`954a669`):** `window._buyCreditPack` ist die
Stripe-Fassung · `CreditsModal.open` führt aufs Preis-Modal · Marktradar
sagt „1 Marktwert-Abruf (Sprengnetter)", bei zwei Quellen beide ·
Preis-Modal ohne `L`/Kerosin/Credits · Marktbericht mit
`wertermittlung.js?v=1194`, Ampel `1 × MPI`, sieben Reiter · `node --check`
auf allen sieben JS-Dateien.

**Auf Produktion ausgerollt** am 01.09. gegen 17:30 auf Marcels Freigabe (`a4ae78d`, beide DBs vorher gesichert) und dort abgenommen: alle Dateien auf `v1194`, `_buyCreditPack` ist die Stripe-Fassung, null Konsolenfehler. **Offen bleibt:** ein echter Kauf ist auf dem reparierten Weg nicht durchgelaufen
— der Weg ist ausgelesen, der Türsteher greift ohne Netzaufruf, aber es wurde keine Stripe-Sitzung gestartet.

**Nachtrag `v1195` (`69dee08`):** beim Abruf-Test fiel ein **weiterer**
Liter-Rest auf, den `v1194` verfehlt hatte — „**◷ 5 L bei Marktwert**"
statisch im Kopf des Marktberichts (`js/marktbericht-view.js:129`, ein
`v654`-Rest). Zwei Gründe für den Fehlschlag, beide lehrreich: im
Quelltext steht ` 5 L bei ` **mitten in einem Satz** (kein `grep` nach
„Kerosin", `' L'` oder `\d+ L` trifft das), **und ich hatte den iframe
gemessen, nicht das Band darum.** Das Band gehört der Haupt-App und liegt
außerhalb. Beide Male stand „kein Treffer" im Befund — und beide Male
stimmte er für die Fläche, die ich angesehen hatte.

> **Wer eine Fläche prüft, muss den Rahmen mitprüfen.** Bei jeder
> iframe-Ansicht gehören beide `body.innerText` in dieselbe Messung.

Das Schild war zugleich die **dritte** Preisangabe auf demselben Schirm —
Band (statisch), Ampel (live) und Knopf (live). Jetzt steht dort nur noch,
**wann** abgerechnet wird; das **wieviel** an genau einer Stelle.

### Die Objektkarte auf dem Handy — `v1191` / `v1192`, 01.09.2026

**Waren Punkt 1 (Handy-Befunde) und Punkt 10 (Wallet-Ring), und es war
derselbe Täter.** Beide Punkte beschrieben dasselbe: ein Bedienelement der
Objektkarte lag unter dem Löschknopf. Beim Pfeil war es die Aufklapp-Geste,
beim Ring der Score — und beide Male löste ein Fehlgriff die Löschabfrage
aus.

**Die Ursache waren zwei Regeln aus der 44-px-Trefferflächen-Kampagne
(v650/v650c)**, die den 26-px-Kartenknopf auf 26 × 44 px plus eine
unsichtbare `::after`-Fläche von 44 × 44 aufgebläht haben. Er griff damit
von 8 bis 52 px unter der Kartenoberkante — quer über alles, was dort sonst
noch steht. Details, Zeilennummern und die verworfene Gegenvariante stehen
im Kommentar am Ende von `style.css` und im Rollout-Journal.

> **Es war die dritte Auflage.** `v1138b` (Score-Zahl) und `v1159` (Chevron
> in „stapel") haben beide das **Opfer** verschoben und den **Täter** nie
> angefasst. Ein 44-px-Knopf in einer 64-px-Karte schiebt den Konflikt nur
> weiter.

**`v1191` (`8902e87`) — der Täter:** die zwei Kartenknöpfe sind aus der
Pauschale heraus und stehen wieder auf ihren 26 × 26 px (der Wert, den V101
für Touch ausdrücklich gesetzt hatte). Dazu Chevron in „kompakt"
`top: 22px → 26px`.

**`v1192` (`8aa9857`) — Marcels Entscheidung „a ja, b nein":** der Ring wird
freigestellt, die 44-px-Fläche für den Pfeil bleibt wie sie ist.

| Modus | was geändert | Ring vorher | Ring jetzt |
|---|---|---|---|
| **kompakt** | Ring `right: 34px → 68px`, Adresse `padding-right: 84 → 94` | Mitte trifft `sbc-btn` (Duplizieren), 14 von 38 px frei | **38 von 38 px frei** |
| **wallet** | Overlay `top: 12px → 34px` | Mitte traf `sbc-del`, ab v1191 noch obere Hälfte verdeckt | **40 von 40 px frei** |

**Warum die zwei Modi es verschieden lösen — beide Wege sind gemessen, nicht
gewählt:** In „kompakt" ist die Karte 80 px hoch. Schiebt man den Ring nach
unten, tritt die **Stufen-Pille** (sie hängt am selben Overlay) bei y79–101
aus der Karte heraus. In „wallet" ist die Karte 255 px hoch, dort ist unten
Platz — dafür geht dort **links** nichts: der Ring läge bei l203–243, das
Datum endet bei 214, und die Zeile hat `flex-wrap: wrap` — sie würde
umbrechen und die Karte höher machen.

> **Eine eigene Zahl war zu grob und wird zurückgenommen.** Ich hatte
> Marcel gesagt, den Ring freizustellen koste **30 px** Adressbreite. Das
> war der Wert meines ersten Versuchs (`padding-right: 114`), nicht die
> nötige Untergrenze. Nachgerechnet: der Text muss vor Pixel 204 enden,
> das schafft **94** — also **10 px**, nicht 30. „Am Markt 9, Kabelsketal"
> steht danach immer noch vollständig da.

**Nachgemessen auf Staging** (frisch geladen, `ui-varianten.css?v=v1192`),
fünf sichtbare Karten je Modus:

- **Pfeil** in kompakt und stapel: **22 von 22 px** erreichbar; der echte
  Mausklick auf die Pfeilmitte klappt auf, `delSaved` wird nicht gerufen,
  keine Löschabfrage, alle sieben Objekte bleiben stehen.
- **Ring** in allen vier Modi (Standard, kompakt, wallet, stapel):
  Ringmitte → `sbc-mini-score-num`, volle Höhe frei.
- **Stufen-Pille** in jedem Modus innerhalb der Karte.
- **Löschen** und **Duplizieren** treffen weiterhin ihre eigenen Knöpfe.

**Was aus Punkt 1 bewusst NICHT gebaut wurde (Marcels „b nein"):** eine
44-px-Trefferfläche für den Pfeil. Sie wäre in „kompakt" machbar (46 px
frei), in „stapel" nicht (30 px) — sie wäre also in zwei Modi verschieden
groß und nähme in kompakt 22 px Fläche weg, auf der heute „Objekt öffnen"
liegt. Der Punkt aus v650/v652 bleibt für diesen einen Pfeil damit offen;
die **falsche Aktion** ist weg, und das war das Schwere daran.

**Der andere Teilbefund von Punkt 1** (Ankreuzfelder auf 33 px, `v1147`/
`v1147b`) war bereits am 12.08. abgenommen.

---
#### Der Wortlaut aus "Offen" — die Handy-Befunde

**Zwei Handy-Befunde aus dem v1118-Durchgang, bewusst nicht gefixt.**
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

  ### Gemessen und behoben am 01.09.2026 — `v1191` (`8902e87`)

  **Der Befund oben ist überholt, und zwar in beide Richtungen: die
  4 × 21 px waren die falsche Zahl, und das Problem war ein anderes.**
  Die 4 px stammen aus dem Modus **Standard**, in dem der Pfeil gar
  kein Bedienelement ist (`karten-kompakt.js` hängt seinen Handler nur
  bei `kompakt` oder `stapel` ein). In den beiden Modi, in denen er
  wirklich schaltet, ist er **22 × 22 px** — eine Fläche hat er also
  längst.

  **Was er nicht hatte, war Erreichbarkeit.** Gemessen in der Kabine
  bei 390 px (Objekt „Am Markt 9, Kabelsketal", Pfeilspalte pixelweise
  mit `elementFromPoint`):

  | | vorher | jetzt |
  |---|---|---|
  | Pfeilmitte trifft | **`sbc-btn sbc-del`** | `sbc-arrow` |
  | erreichbar in kompakt | **1 px** von 22 | **22 von 22** |
  | erreichbar in stapel | 4 px von 22 | **22 von 22** |

  **Wer aufklappen wollte, öffnete die Löschabfrage.** Ursache waren
  zwei Regeln aus der 44-px-Trefferflächen-Kampagne, die den
  Löschknopf auf 26 × 44 px plus eine unsichtbare `::after`-Fläche von
  44 × 44 aufgeblasen haben — er griff damit von 8 bis 52 px unter der
  Kartenoberkante, der Pfeil sitzt bei 32..54. Details und die genauen
  Zeilennummern stehen im Rollout-Journal der Projektanweisung und im
  Kommentar am Ende von `style.css`.

  > **Das war die dritte Auflage desselben Fehlers.** `v1138b`
  > (Score-Zahl unter dem Löschknopf) und `v1159` (Chevron in
  > „stapel") haben beide das **Opfer** verschoben und den **Täter**
  > nie angefasst. Ein 44-px-Knopf in einer 64-px-Karte schiebt den
  > Konflikt nur weiter.

  **Der ursprüngliche Lösungsvorschlag (Padding plus negatives Margin)
  wird damit hinfällig** — er hätte an einer Fläche gearbeitet, die es
  schon gab, und die eigentliche Ursache nicht berührt.

  **ZWEI ENTSCHEIDUNGEN FÜR MARCEL — hier wird bewusst nicht geraten:**

  **a) Der Score-Ring liegt im Modus „kompakt" unter dem
  Duplizieren-Knopf.** Gemessen: Ring 239..277 px, Aktionsband
  249..305 — die Ringmitte trifft `sbc-btn`. Auf dem Bild klebt das
  Kopiersymbol sichtbar auf dem Ring. Ein Fehlgriff **dupliziert** das
  Objekt (nicht destruktiv, aber falsch).
  Freistellen geht: Ring `right: 34px → 68px`. **Kostet 30 px
  Adressbreite** (`padding-right` 84 → 114), sonst läuft der Adresstext
  unter den Ring. Also: schmalere Adresse gegen freien Ring.

  **b) 44 px Trefferfläche für den Pfeil** sind in „kompakt" machbar
  (46 px sind unter den Aktionen frei), in „stapel" **nicht** (30 px).
  Sie kosten in kompakt 22 px Kartenfläche, auf der heute „Objekt
  öffnen" liegt — und die Fläche wäre in den zwei Modi verschieden
  groß. Der Punkt aus v650/v652 bleibt für diesen Pfeil damit offen;
  die **falsche Aktion** ist aber weg, und das war das Schwere daran.

  **MARCELS ENTSCHEIDUNG (01.09.2026): „a ja, b nein."**
  Der Ring wird freigestellt (`v1192`), die 44-px-Fläche für den Pfeil
  bleibt, wie sie ist.

#### Der Wortlaut aus "Offen" — der Wallet-Ring

**Wallet auf dem Handy: die Aktionen liegen auf dem Score-Ring.**
**Neu gefunden beim `v1173`-Messlauf, 2026-08-30** — nicht dadurch
verursacht, `.sbc-actions` und `.sbc-score-overlay` sind absolut
positioniert und vom Raster unabhängig.

**Gemessen in der Messkabine, Wallet-Modus, ein Objekt geladen:**

| Breite | Ring | Aktionen | `elementFromPoint` auf der Ringmitte |
|---|---|---|---|
| 1200 px | y189–239 | y183–**205** | `sbc-mini-score-num` — sauber |
| 900 px | y185–225 | y179–**205** | `sbc-mini-score-num` — sauber |
| **390 px** | y200–240 | y194–**238** | **`sbc-btn sbc-del`** — Löschen |

**Die Ursache ist die 44-px-Trefferfläche aus v650/v652:** auf dem Handy
wachsen die beiden Knöpfe von 22 px auf 44 px Höhe und decken den Ring
damit vollständig zu. **Im Standard-Kartenmodus passiert das nicht** —
dort trifft die Ringmitte bei 390 px `sbc-mini-score-num`. Es ist also
eine Wallet-Sache, keine allgemeine.

**Kein Datenverlust:** `delSaved()` fragt vorher (`storage.js:1526`,
„Objekt wirklich löschen?"). Wer auf seinen Score tippt, bekommt trotzdem
die Löschabfrage — **derselbe Fehlertyp wie `v1159`**, wo im Stapelmodus
die Pfeilmitte Löschen auslöste.

**Zu entscheiden ist, was weicht** — das ist Optik, also nicht zu raten:
die Aktionen nach unten, der Ring nach links, oder auf dem Handy beide
auf verschiedene Kartenhälften. Vorschlag zuerst nach
`design/Vorschläge/`.

### Nachgemessen am 01.09.2026 nach `v1191` — die Hälfte ist weg

**`v1191` hat denselben Täter geschrumpft** (Punkt 1): der Löschknopf
stand auf 26 × 44 px plus einer unsichtbaren 44-×-44-`::after`-Fläche
und steht jetzt auf 26 × 26 px. Neu gemessen bei 390 px, Wallet, fünf
Karten:

| | 30.08. | jetzt |
|---|---|---|
| Ringmitte trifft | **`sbc-btn sbc-del`** | **`sbc-mini-score-num`** |
| Aktionen | y194–**238** | y8–**34** |
| Ring | y200–240 | y14–54 |

**Wer auf seinen Score tippt, bekommt keine Löschabfrage mehr.** Der
Ring ist ab seiner Mitte frei.

**Was bleibt:** die **obere Ringhälfte** (y14–34, senkrecht abgetastet)
liegt weiter unter dem Löschknopf — 20 von 40 px Ringhöhe. Die
Entscheidung „was weicht" steht also noch, aber sie ist kleiner
geworden: nötig sind jetzt **20 px** Versatz statt 38.

**Es ist dieselbe Entscheidung wie in Punkt 1a** (Ring unter dem
Duplizieren-Knopf im Modus „kompakt"). Beide zusammen entscheiden,
nicht einzeln — sonst stehen Ring und Aktionen in zwei Kartenmodi
verschieden.


### Tablet-Fassung — vollständig, 01.09.2026 (`d92fa5f`, `2dde1ab`)

**War Punkt 1.** Vier Teilstücke (A Sidebar andocken · B flache Kopfleiste ·
C zweispaltige Formulare · D Popover statt Blatt) plus die Admin-Oberfläche.
**Drei waren längst gebaut und nur nie nachgemessen**, B ist am 01.09. als
`v1190`/`v1190b` dazugekommen, die Admin-Oberfläche trägt ohne Umbau.

**A, C und D waren schon gebaut — gemessen 2026-08-12.**
Offen blieben nur **B** (die hohe Kopfleiste) und die **Admin-Oberfläche** —
beide sind am 01.09.2026 erledigt.

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

### B ist nachgemessen (01.09.2026) — die Zahl lag nie vor

**Der Entwurf hatte recht, ich hatte unrecht.** Im Prüflauf vom 12.08.
stand „Kopfleiste 157 px statt der 348 px des Entwurfs" — gemessen an
`PRUEF_ZFH`, einem Objekt **unter** der 70-%-Schwelle, bei dem die
Score-Zeile gar nicht erst gebaut wird. Mit einem Objekt **über** der
Schwelle (`Am Markt 9, Kabelsketal`, 24/24 Felder, Score 83) in der
Messkabine:

| Fenster | Kopfleiste | davon Score-Block | Sidebar |
|---|---|---|---|
| **820 px** | **347 px** — 39 % eines 900-px-Schirms | 230 px | Drawer |
| 1024 px | 342 px | 230 px | angedockt |
| 1180 px | 317 px | 206 px | angedockt |

**Woraus die 347 px bestehen:** `hdr-v61-row1` 88 px (Nummer, Adresse,
Auto-Speichern) · `hdr-v61-row2` 250 px, darin `.scores` als Raster mit
`.sc-main` 121 px über **einer** Reihe aus fünf `.sc-pill` à 103 px ·
Chevron-Knopf 22 px.

### Und der Hebel existiert schon

**Die Kopfleiste lässt sich einklappen — der Knopf ist da, gemessen:**

| Zustand | Höhe | Anteil an 900 px |
|---|---|---|
| ausgeklappt | 347 px | 39 % |
| **eingeklappt** | **97 px** | **11 %** |

Der Zustand wird in `localStorage.dp_hdr_collapsed` gemerkt, die Klasse
heißt `body.hdr-collapsed`. **250 px Ersparnis ohne eine Zeile neuen
Code** — es wäre nur ein anderer Startzustand für Tablet-Breiten.

> **Der Preis, und deshalb ist es eine Entscheidung für Marcel:**
> eingeklappt bleiben Objektnummer, Adresse, „Auto-saved", die
> Vollständigkeit (24/24 · 100 %) und die Kontingent-Pille sichtbar —
> **der Score-Wert selbst nicht.** Marcels Vorgabe war „der Score bleibt
> auf dem Tablet". Ein eingeklappter Start nimmt ihn nicht weg, aber er
> zeigt ihn beim Öffnen nicht.

**Drei Wege, alle ohne Umbau der Score-Logik:**

1. **Eingeklappt starten ab ≤ 1024 px**, Score einen Klick entfernt.
   Billigster Weg, 250 px gewonnen, Score beim Start unsichtbar.
2. **Eingeklappt starten + Kurzfassung** — „83 · Gut" wandert neben die
   Adresse in `row1`. Kostet etwas Bauarbeit, hält aber beide Ziele:
   flach **und** Score sichtbar. **Empfehlung.**
3. **Ausgeklappt lassen, Pillen verkleinern** (103 → ~70 px) und
   `.sc-main` neben die Pillen. Spart nur ~100 px und fasst die
   auffälligste Fläche der App an.

### B ist gebaut — `v1190` / `v1190b`, Weg 2 (Marcels Entscheidung 01.09.)

| Fenster | vorher | jetzt beim Start |
|---|---|---|
| **820 px** | 347 px (39 %) | **97 px (11 %)** |
| 1024 px | 342 px | eingeklappt |
| 1400 px | 317 px | unverändert ausgeklappt |

**Gemessen in der Kabine, alle fünf Regeln:** startet eingeklappt bei
≤ 1024 px · Kurzfassung „83 · Gut" in der Tier-Farbe (grün, `#5ed992`)
· Klick darauf klappt auf → 347 px, und die Kurzfassung verschwindet
(keine Doppelanzeige) · die getroffene Wahl überlebt das Neuladen ·
bei 1400 px bleibt es ausgeklappt.

> **Zwei eigene Fehler in diesem Paket, beide zurückgenommen:**
> 1. Der erste Wurf schrieb `border-color: rgba(201,168,76,.40)` — das
>    Marken-Gold als Zahlenwert, das sich beim Mandanten **nicht**
>    umfärbt. `style.css` hatte davon vorher **null** Treffer, ich habe
>    den ersten hineingebracht. Behoben mit `var(--gold)` (`v1190b`);
>    Grün und Rot bleiben als Statusfarben fest.
> 2. Ich meldete, der Gold-Audit sei „von RC=0 auf RC=1 gesprungen".
>    **Falsch gemessen:** `python3 … | tail -5; echo $?` liefert den
>    Rückgabewert von `tail`. **RC=1 ist der Normalzustand dieses
>    Repos** — der Audit zählt alle bekannten, nicht tokenisierten
>    Goldtöne, und davon stehen Hunderte in JS-Dateien. Er ist ein
>    Frühwarnsystem für neue Verstöße, kein Tor. Wer ihn als Tor
>    benutzt, muss `git show <alt>:datei | grep -c` gegenrechnen —
>    genau das hat den echten Befund geliefert.

### Admin-Oberfläche — gemessen am 01.09.2026, sie trägt

**Ergebnis: kein Umbau nötig.** Gemessen in der Kabine, jede Ansicht
**einzeln** eingeblendet:

| Fenster | Navigation | Inhalt | Überlauf |
|---|---|---|---|
| **768 px** (iPad hoch) | legt sich **waagerecht** um (MQ 820 greift) | volle Breite | **keiner** in 10 Ansichten |
| **1024 px** (iPad quer) | bleibt Spalte, 214 px | 793 px | **keiner** |

Die drei Media-Queries tun genau das, was sie sollen: `two-col` und
`user-detail-grid` fallen bei ≤ 900 px auf eine Spalte, die Navigation
wird bei ≤ 820 px zur Zeile. Bei 1024 px ist der Desktop-Zustand
richtig — 214 px Leiste neben 793 px Inhalt ist auf einem quer
gehaltenen iPad kein Engpass.

> **Ein Zwischenbefund war falsch, und die Ursache ist lehrreich:** Der
> erste Durchgang meldete **51 px Überlauf** bei 820 px, verursacht von
> einem `button.btn`. Das war ein **Artefakt des Messaufbaus** — ich
> hatte alle 14 Ansichten **gleichzeitig** eingeblendet, um überhaupt
> etwas zu sehen. Im Betrieb ist immer nur eine sichtbar. Einzeln
> gemessen: null Überlauf. **Wer versteckte Ansichten zum Messen
> aufdeckt, misst einen Zustand, den es nicht gibt.**

> **Und eine Feinheit, die man kennen muss:** bei einer iframe-Breite
> von exakt 820 px greift `@media (max-width: 820px)` **nicht** —
> `innerWidth` meldet 820, `documentElement.clientWidth` aber 804, weil
> der senkrechte Rollbalken 16 px nimmt. Wer auf der Grenze misst, misst
> die falsche Seite davon. Deshalb steht oben 768 px (iPad hoch) und
> nicht 820.

**Was diese Messung NICHT abdeckt, ehrlich benannt:**
- **Ohne Anmeldung sind die Tabellen leer.** Gemessen wurden die
  statischen Kopfzeilen (6–7 Spalten); echte Zeilen mit langen
  Mailadressen und UUIDs können breiter werden. In ein Passwortfeld
  tippe ich nicht — für die Messung mit Daten müsste Marcel im Admin
  angemeldet sein, dann misst der nächste Durchgang in seinem Tab.
- **Vier Ansichten waren ganz leer** (`landing`, `marktzinsen`,
  `stats`, `network`) — sie bauen ihren Inhalt erst aus Daten. Für sie
  gilt „nicht messbar", nicht „kein Befund".
- Die vierte Media-Query (1150 px, Karten-Designer in
  `admin-network.js`) konnte deshalb nicht geprüft werden.
- **820 px (iPad Hochformat) bleibt die Handy-Fassung:** Drawer, eine
  Spalte über die volle Breite. Das ist **kein Defekt**, sondern die Folge
  von Entscheidung A (Schwelle 901). Soll das Hochformat andocken, wären
  bei 260-px-Leiste nur 560 px Inhalt übrig — das schließt zweispaltige
  Formulare aus. **Eigene Entscheidung, nicht in diesem Punkt.**


### Preismodell v1176 — vollständig, live seit 31.08./01.09.2026

**War Punkt 1 und der größte Brocken im Backlog.** Marcels Auftrag vom
30.08.: *„Wir wollen nicht mehr mit Kerosin arbeiten … die Preisstruktur
ist zu teuer. Die Staffelung soll einfach sein."* Alle fünf Umbauschritte
sind gebaut, ausgerollt und auf Produktion abgenommen:

> **Woher der Auftrag kam:** aus `design/mockups/Anmerkungen.docx`. Der
> Tester schreibt dort als zweiten Punkt überhaupt: *„Bezahlmodell: Zweite
> Währung sollte meiner Meinung nach unbedingt raus. Wirkt undurchsichtig.
> Idee: Basis-Tarif bestimmtes Kontingent frei, danach kostet die Bewertung
> extra."* **Das ist genau das, was gebaut wurde** — drei Zähler statt
> Kerosin, Einzelkauf am gesperrten Knopf.

| | was | erledigt in |
|---|---|---|
| 1 | drei Zähler statt einem, Nicht-Verfall und Deckel | `v1183` (Migration 064/066) |
| 2 | die acht KI-Einzelabrufe entkoppelt — sie kosten nichts mehr | `v1183` |
| 3 | Restbestände vorhandener Nutzer umgerechnet | Migration 064 |
| 4 | Kopfpille und Kontingent-Box auf Bewertungen | `v1183`, `v1185d/e` |
| 5 | **Einzelkauf am gesperrten Knopf** | `v1187` |

**Dazu, was beim Bauen dazukam:** der Kauf, der nichts gutschrieb
(`v1184`) · der Monatsübertrag, der jeden neuen Nutzer beschenkte
(`v1184b`, Migration 067) · vier Wochen Pro mit Testpaket statt sieben
Tagen ohne (`v1185`, Migrationen 068/069) · die Preis-IDs, die keine
Migration mehr schreibt (`v1186`) · Kerosin-Reste im Nutztext und ein
Preisversprechen, das der Server nicht einlöste (`v1187`) · Umlaute
(`v1188`) · der Admin-Doppelpfad (`v1189`).

**Live-Preise:** Starter 19,99 · Investor 39,99 · Pro 79,99 · Partner 99.
Vier Pakete (7,90 / 19,90 / 39,90 / 69,90) und fünf Einzelposten (0,90
bis 9,90), alle über `lookup_key` aufgelöst.

**Beim Abschließen wurden die offenen Restfragen des Punktes einzeln
nachgeprüft**, damit nichts still mit ihm verschwindet:

- **Co-Pilot ohne Plan-Gate** → mit `v1178` gebaut (Grenze statt Schloss).
- **Free/Starter mit falscher Litermenge in `config.js`** → mit `v1176`
  korrigiert, der Rest mit `v1183` stillgelegt.
- **Bankexport-Leck** („Free rutscht durch") → `bankExportPlans:
  ['investor','pro']`, Free und Starter sind draußen.
- **Übergangsregel für Bestandskunden mit gekauften Marktwert-Abrufen**
  → **gemessen auf beiden Servern: null Nutzer mit `avm_bonus_credits`.**
  Die Umstellung auf die getrennten Töpfe `avm_a_bank`/`avm_b_bank` hat
  also niemandem etwas genommen. Wäre hier jemand gewesen, hätte eine
  Migration gefehlt — Migration 066 legt die neuen Spalten mit 0 an und
  überträgt den alten Stand **nicht**.

**Die ausführlichen Befunde stehen oben** unter „HIER WEITERMACHEN" —
sie sind die eigentliche Lehre dieser Runde und gehören dorthin, wo der
nächste Durchgang zuerst hinsieht.

- [2026-08-30] **Preise, Kontingente, Wording, Co-Pilot-Grenze und drei Defekte** — `v1176`–`v1179`.
   Marcels Freigabe: *„WIR HABEN NOCH KEINE ZAHLENDEN KUNDEN, NUR TEST USER,
   DAHER KÖNNEN WIR DAS EINFACH UMSETZEN."* Damit fiel die Übergangsregel weg,
   und die Empfehlungen aus `preiskonzept-gesamt.html` sind gebaut.

   | | Commit | was |
   |---|---|---|
   | `v1176` | `dd226cb` | Preise und Kontingente an allen Anzeigestellen |
   | `v1176b` | `99b99db` | Partner-Grundgebühr — sie steckte nicht in `config.js` |
   | `v1176c` | `f137547` | der Umschalter überschrieb die formatierte Zahl |
   | `v1177` | `27f319b` | die drei Stufen heißen überall gleich |
   | `v1178` | `27f319b` | Co-Pilot-Grenze · Bankexport-Leck · Preis-Einordnung |
   | `v1179` | `7751bf0` | fünf Kleinigkeiten aus dem Testbericht |

   **Preise:** Starter 29 → **19,99** · Investor 59 → **39,99** · Pro 99 →
   **79,99** · Partner 149 → **99** mit Seats 24/19/15.
   **Kontingente** statt Litertank: 1 / 5 / 5+5 / 5+5+5.
   **Landing-Optik unverändert** — nur Zahlen und Zeilentexte getauscht.

   ### Drei Sachen, die beim Bauen anders waren als gedacht

   1. **Die Partner-Grundgebühr steht nicht in `config.js`.** Nach dem ersten
      Rollout zeigte die laufende App weiter 149 €, obwohl ich dort nichts
      geändert hatte — den Partner-Plan gibt es in `PRICING` gar nicht,
      `reseller-portal.js:612` klont ihn zur Laufzeit aus `pro` und setzt den
      Preis selbst. **Ohne den Blick in die laufende App wäre er
      stehengeblieben.**
   2. **Der Formatierer war da und wurde eine Zeile später überholt.** Die
      Karten zeigten „19.99" mit Punkt, obwohl `_planCardsHtml` schon
      formatierte — `_updatePpgPrices` läuft direkt danach und schrieb den
      rohen Attributwert zurück.
   3. **Die Tour gibt es längst.** Der Testbericht wünscht sich einen
      „Reisebegleiter"; gemessen startet die Tour bereits von allein, aber
      **genau einmal pro Browser** (`tour-engine.js:1179`), und die Abwahl
      „wird nicht mehr automatisch gezeigt" existiert auch. Es fehlte nicht
      die Tour, sondern **der zweite Weg zu ihr** — jetzt „Rundgang starten"
      im Aktionen-Menü.

   ### Zwei Defekte geschlossen

   - **Bankexport:** die Sperre prüfte nur `starter`, **Free rutschte mit
     Wasserzeichen durch.** Die Funktionsübersicht sagt für beide „–".
     Track-Record blieb unangetastet — dort sagt die Matrix für Free
     ausdrücklich „Wasserzeichen", und der Code tut genau das.
   - **Preis-Einordnung** (war Punkt 2): das Vorzeichen war vertauscht. Bei
     129.000 € Kaufpreis und 177.000 € Marktwert stand „Deutlich über Markt"
     in Rot, während die Zeile darüber dasselbe Delta grün zeigte.
     **Herkunft: `design/mockups/Anmerkungen.docx`** — der Tester schreibt
     dort wörtlich *„Rückmeldung aber ‚Deutlich über Marktwert'? sollte das
     nicht unter Marktwert sein?"* Es ist der einzige **Rechen**befund des
     ganzen Berichts; alles andere darin ist Bedienführung.

   > **Zweimal dieselbe `sed`-Falle an einem Nachmittag, offen benannt:**
   > `&` steht in der Ersetzung für den ganzen Treffer — `&nbsp;` hat deshalb
   > den Treffer *plus* „nbsp;" eingesetzt und die Tarifkarten der Landing
   > zerlegt. Rückgenommen über `git checkout --`. Und direkt danach bei der
   > Seat-Staffel: erst lief `35→24`, dann traf `24→15` den frisch
   > geschriebenen Wert. **Sed-Regeln auf einer Zeile sind eine Kette, keine
   > Menge.**

   ### Was am Preismodell noch offen ist — nicht vergessen, nur nicht baubar

   - **Stripe:** die Preis-Objekte liegen im Dashboard, nicht im Repo. Neue
     anlegen (nicht die alten ändern), dann die IDs eintragen.
   - **Tabelle `plans`:** braucht eine Migration. Sie ist ein DB-Eingriff.
   - **Der Kontingent-Zähler** selbst: `aiCreditsService.js` führt weiter
     einen Litertank. **Die Anzeige ist umgestellt, die Buchhaltung nicht** —
     das ist bewusst so und steht als eigener Punkt im Backlog.

- [2026-08-30] **Akzentfarbe: Fassung C und ein freier Farbton-Regler** — `v1175`, `3f4a6cc`.
   Damit ist **Punkt 4 vollständig**. Marcels Wahl aus der Demo: **Fassung C.**
   Dazu sein Nachtrag: *„können wir einen freien Farbregler auch dazu setzen?"*

   **Die Schnellauswahl ist ab jetzt die kuratierte warme Liste** — Gold,
   Karamell, Kupfer, Ziegel, Moos hell, Sand. Blau, Petrol und Schiefer
   fallen weg; **alles Kühle kommt über den Regler oder den Farbkasten.**
   Nachgewiesen, dass das trägt: der Regler auf 200° ergibt `#3F8EB5`, ein
   sauberes Blau.

   **Der Regler dreht nur den Farbton.** Sättigung und Helligkeit kommen aus
   dem Ton, der gerade gilt — sonst wäre ein Zug am Regler ein Sprung in eine
   fremde Farbe. Zwei Grenzen, damit jede Stellung auch etwas ergibt, beide
   nachgemessen:

   | Ausgangston | Regler | Ergebnis | warum |
   |---|---|---|---|
   | `#4A443C` fast grau | 120° | `#267326` | ohne Boden bei S 0,50 hätte sich **nichts** bewegt |
   | `#FDFCFA` fast weiß | 300° | `#C875C8` | Deckel L 0,62 — darüber verschwindet ein Akzent |
   | `#080706` fast schwarz | 300° | `#732673` | Boden L 0,30 |

   **Alle drei Bedienelemente gehen durch eine Funktion** (`akzentSetzen`).
   Drei Wege mit je eigener Nachzieh-Logik wären genau die Konstellation, in
   der einer den anderen nicht mitbekommt. Ausgelassen wird nur das Element,
   an dem gerade gezogen wird — ihm den Wert zurückzuschreiben lässt den
   Regler springen. Über den Bedienweg in allen Richtungen geprüft:

   | Schritt | Kachel | Regler | Farbkasten |
   |---|---|---|---|
   | Kachel Ziegel | Ziegel an | springt auf 18° | `#b5633f` |
   | Regler auf 200° | keine | 200 | `#3f8eb5`, markiert |
   | Farbkasten auf Moos hell | **Moos hell an** | 69° | `#8e9a4e` |
   | Zurücksetzen | Gold an | 44° | `#c9a84c` |

   > **Was den freien Wähler ungefährlich macht, gemessen:** selbst mit
   > `#FFFFFF` als Akzent landet der dunkle Textton bei **3,81** auf der
   > Karte und **20,38** auf Obsidian; mit `#F0D000` bei 3,62 / 13,75. Die
   > `v1109`-Regel greift also auch im Unsinnsfall. **Der Regler braucht
   > seine Grenzen trotzdem** — nicht wegen des Kontrasts, sondern damit er
   > sich beim Ziehen überhaupt sichtbar verhält.

- [2026-08-30] **Freier Akzentwähler im Darstellungs-Panel** — `v1174`, `8e95bf5`.
   Der zweite Teil von **Punkt 4**; die Tonwahl war da noch offen.

   **Er musste gebaut werden, weil es hier keinen gab** — der Backlog nahm
   an, es gäbe einen. Im Panel standen sechs feste Kacheln
   (`ui-varianten.js:80`); die sechs `<input type=color>` dort gehören den
   **Bereichsfarben**. Der einzige freie Wähler saß im **Reseller-Portal**
   (`branding-darstellung.js:114`, `#dpbe-acc`) und setzt die
   **Partner-Marke** für deren Mandanten.

   **Er geht denselben Weg wie die Kacheln:** `save(ui_accent)` +
   `farbenAnwenden` → `DealPilotWhitelabel.apply`. **Kein zweiter
   Speicherort und keine eigenen `--wl-`Tokens** — genau daran ist `v1157`
   gescheitert. 44 px, damit die Trefferfläche aus v650/v652 auch hier gilt.
   Er liegt **innerhalb** `#dpuv-lock`, die Partner-Sperre (`sperreHart`)
   fasst ihn also mit.

   **Über den Bedienweg geprüft, alle vier Richtungen:**

   | Schritt | Kachel | Wähler | `--gold` | gespeichert |
   |---|---|---|---|---|
   | Start | Gold an | `#c9a84c` | `#c9a84c` | `#C9A84C` |
   | Kachel Petrol geklickt | Petrol an | folgt: `#0f6e6e` | `#0F6E6E` | `#0F6E6E` |
   | Wähler auf `#B5633F` | **keine an** | markiert | `#b5633f` | `#b5633f` |
   | Wähler auf eine Kachelfarbe | Blau an | `#1f4e79` | `#1f4e79` | `#1f4e79` |
   | Zurücksetzen | Gold an | `#c9a84c` | `#C9A84C` | — |

   > **Wie der Zurücksetzen-Test ohne Schaden lief:** „Zurücksetzen" räumt
   > auch `ui_form`, `ui_obsidian` und die alten Einzelschlüssel weg, und im
   > Prüfkonto standen dort echte Werte (`rund`, `#241C16`). Vor dem Test
   > **den gesamten `localStorage` gesichert**, danach Schlüssel für
   > Schlüssel zurückgeschrieben und mit einem Neuladen gegengeprüft.
   > `_dpDispReset` schreibt nichts auf den Server, deshalb war das
   > vollständig.

- [2026-08-30] **Garagenfeld und Miteigentumsanteil — Marcels Entscheidung: Weg A** — `v1165` `b9e7851`, `v1166` `c9779df`.
   War **Punkt 10**. Die fachliche Frage war die einzige, die den Punkt noch
   blockierte; Marcel hat sie am 14.08. beantwortet: *„wohnungsbezogen"*.

   **Damit war nichts mehr zu bauen.** Das Feld bleibt wohnungsbezogen, der
   Nutzer trägt seinen Anteil ein, `lib/nhk2010.js` bekommt **kein** `mea`
   und **kein** `ist_wohnung`. Die beiden Pakete, die vor der Entscheidung
   ohnehin baubar waren, setzen genau das um: `v1165` hat den Platzhalter
   geräumt, der das Gegenteil der Feldhilfe sagte („alle Garagen zusammen"
   gegen „nur der eigene Anteil"), und `v1166` zeigt einen Hinweis, wenn ein
   MEA gepflegt ist **und** eine Garagenfläche steht.

   **Warum A fachlich trägt** (damit die Abwägung nicht neu geführt wird):
   alles andere im Modell ist bereits wohnungsbezogen — Gebäudeteil über die
   BGF der Wohnung, Außenanlagen als Prozentsatz davon, Bodenwert
   MEA-gekürzt; die Garage folgt fachlich **nicht** dem Wohnungs-MEA (in der
   Teilungserklärung meist eigener Anteil oder Sondernutzungsrecht), eine
   Kürzung damit wäre in beide Richtungen falsch; und B wäre ein
   Rechenkern-Eingriff mit eigener Prüfstrecke für einen Effekt, den eine
   richtige Zahl im Feld sauberer erreicht.

   **Wo A schwach bleibt, offen gesagt:** beim Mehrfamilienhaus mit
   gemeinschaftlichen Garagen ohne Zuordnung verführt das Feld dazu, die
   Gesamtfläche einzutragen — bis zu ~18.500 € zu viel im Sachwert. Genau
   dagegen steht der Hinweis aus `v1166`.

- [2026-08-30] **Wallet: Bild, Kaufpreis und „privat" haben wieder Abstand** — `v1173`, `0131306`.
   War **Punkt 11**. Gemessen in der laufenden App auf Staging (Partner-Konto,
   Objekt `Dealstreet 999`, Kartenmodus über den **Bedienweg** im
   Darstellungs-Panel gesetzt, nicht per `setAttribute`).

   | | Wallet vorher | Standardkarte | Wallet jetzt |
   |---|---|---|---|
   | Bild → Text, waagerecht | **0 px** (Bildkante x88, Textkante x88) | 12 px | **12 px** |
   | „privat" → Kaufpreis | **1 px** | 4 px | **5 px** |

   **Der Befund im Backlog stimmte: es lag am Raster, nicht an der Farbe.**
   Zwei Ursachen, beide in `css/ui-varianten.css`:

   1. **Spalte 1 war 64 px breit — genau so breit wie das Bild.** Das Bild
      bekommt in Abschnitt (C) zusätzlich `margin-left:10px`, damit es die
      Polsterung wiederhat, die `.sbc-top` mit `margin:-10px` weggenommen
      hat. Es ragte damit **exakt 10 px in den 10-px-Spaltenabstand** und
      fraß ihn auf. Die Spalte trägt die Polsterung jetzt selbst
      (10 + 64 = 74 px), der Abstand steht auf 12 px wie im Standard.
   2. **Der Zeilenabstand des Rasters ist 0.** Der Halter sitzt mit
      `align-self:end` am Ende von Zeile 3, der Preis mit `align-self:start`
      am Anfang von Zeile 4 — sie treffen sich an der Zeilengrenze. Der
      `margin-top:1px` des Preises war der ganze Abstand.

   **Nach dem Eingriff nachgemessen, ohne Testregel, gegen die Datei vom
   Server:** Bild bis x88, Text ab x100 · Halter bis y264, Preis ab y269 ·
   das Paar bleibt mittig zum Bild (Mitte 271 = Bildmitte 271) · die
   Bandzeilen rücken um 10 px mit und halten weiter 24 px Luft zum
   Score-Ring, die Adresse läuft nicht über (`scrollWidth == clientWidth`).

   **Marcels zweite Vorgabe an derselben Karte** (*„achte darauf, dass alle
   Werte immer angegeben werden, die wir brauchen"*) ist damit auch
   beantwortet — **es fehlt nichts.** Am geladenen Objekt ausgezählt, welche
   `.sbc-*`-Elemente im Layout stehen: Objektnummer, KI-Abzeichen, Datum,
   Pfeil, Adresse, Halter, Kaufpreis, alle drei Kacheln, Score-Ring mit
   Stufenpille, Investor- und Won-Ribbon, Duplizieren und Löschen. Die
   Wallet-Fassung blendet gegenüber der Standardkarte **nichts** aus;
   `.sbc-top-body` hat als einziges keine eigene Fläche, weil es
   `display:contents` trägt — das ist der Zweck der Regel, kein Verlust.

   ### `v1173b` — der Griff nach der Spaltenbreite hatte einen Preis, sichtbar erst bei 390 px

   `1e4bde8`. **In der Messkabine gefunden** (iframe 390 px auf
   `/impressum.html`, gleiche Herkunft, Schublade aufgezogen,
   `getAnimations().finish()`):

   | | Adresse `scrollWidth` / `clientWidth` |
   |---|---|
   | vor `v1173` (Spalte 64 px) | 244 / 244 — passt |
   | nach `v1173` (Spalte 74 px) | **234 / 232 — zwei Pixel Ellipse** |
   | nach `v1173b` | 322 / 322 — passt |

   **Nummer, Datum und Adresse standen in Spalte 2** — ihre Breite hing
   damit an der Bildspalte, und die ist um 10 px gewachsen. Auf dem großen
   Schirm fällt das nicht auf, in der Schublade schon. Die beiden Bandzeilen
   spannen jetzt über **beide** Spalten und halten ihren Einzug mit
   `padding-left: 74px` (10 Polsterung + 64 Bild) selbst. Sie stehen damit
   **pixelgleich wie vor `v1173`** und sind von der Bildspalte unabhängig.

   > **Die Lehre:** Wer eine Rasterspalte breiter macht, nimmt die Breite
   > **allen** Zeilen weg, die in der Nachbarspalte liegen — auch denen, die
   > mit dem Grund der Änderung nichts zu tun haben. **Nachmessen gehört
   > deshalb an die schmalste Stelle**, nicht an die, an der gebaut wurde.

   > **Was beim Messen fast schiefgegangen wäre:** die Zoom-Ausschnitte des
   > Browsers liegen in **Bildschirmkoordinaten**, `getBoundingClientRect`
   > liefert **CSS-Pixel**. Zwischen beiden liegt hier ein Faktor von rund
   > 0,83. Ein Ausschnitt, der nach den gemessenen Zahlen gesetzt wird,
   > zeigt etwas anderes als erwartet — die Bandzeile mit Nummer und Datum
   > sah dadurch erst aus, als fehle sie. **Zum Beweisen zählt die Zahl aus
   > dem DOM, nicht der Ausschnitt.**

- [2026-08-14] **Eine Breite für die ganze Marktbericht-Seite** — `v1172`/`v1172b`, `167c935`. **Von Marcel abgenommen.**
   **Sein Befund am Bild `design/mockups/markztbericht.png`:** die Schrittleiste
   breit, alles darüber und darunter schmal — *„das muss optisch zusammenpassen."*

   **Die Ursache war mein eigener Eingriff aus `v1151`.** Dort hatte die
   Reiterleiste eine **eigene** Grenze von 960 px bekommen, weil die sieben
   Marken 902 px brauchen und bei 760 px in zwei Zeilen umbrachen. Die
   Begründung stimmt technisch — die Leiste ist Navigation, keine
   Formularzeile. **Nur entsteht dadurch eine zweite Kante auf derselben
   Seite, und genau die sieht man.**

   Jetzt **960 px für alles**: Inhalt, Leiste, Kurztext, Fortschritt. Keine
   760er-Regel mehr in der Datei. Das Argument aus `v1128` (eine Formularzeile
   über 1.278 px ist unlesbar) bleibt gewahrt — 960 liegt deutlich darunter.

   > **Die Lehre:** Eine Sonderbreite für ein einzelnes Element ist fast immer
   > die falsche Antwort auf „zu schmal". Sie löst das gemeldete Problem und
   > erzeugt ein sichtbareres. **Wenn ein Element mehr Platz braucht als seine
   > Nachbarn, ist die Frage, ob nicht alle mehr brauchen.**

   ### `v1172b` — die Cache-Kette war nur zu einem Drittel gezogen

   Mein `sed` suchte `v=1165`; dort stand längst `v=1166` aus dem vorigen
   Paket. `mb-wizard.js` stand also auf `1172`, **iframe-URL und Lader weiter
   auf `1166`**. Der Browser hätte das iframe-Dokument aus dem Cache geladen —
   mit dem **alten** Skriptverweis — und die Änderung wäre nie angekommen,
   obwohl auf dem Server alles richtig lag.

   **Aufgefallen nur, weil die Kontrollausgabe alle drei Glieder nebeneinander
   zeigt.** Ein `sed`, das nichts findet, meldet keinen Fehler.

- [2026-08-13] **Die zwei Befunde aus dem Prüflauf sind behoben — und einer war keiner** — `v1171` + DB-Eingriff, `6c1e101`.
   ### `beleg_import` — echt, und behoben

   Stand in `config.js` ab Investor, in **keinem** DB-Plan. Die DB ist die
   Quelle, und `beleg-import.js:66` hängt **allein** an
   `hasFeature('beleg_import')` — **kein** Plan-Key-Fallback. Die Funktion war
   damit für **jeden** zu, auch für Pro und Partner.

   Jetzt in der DB für `investor`/`pro`/`partner`, genau wie `config.js` es
   vorsieht. **Sicherung 8.597 Bytes**, `BEGIN/ROLLBACK`-Probelauf vorher
   (Verteilung geprüft), Backend danach neu gestartet — der Plan-Cache hätte
   sonst die alten Werte weitergereicht.

   ### `custom_finance_models` — Startfenster geschlossen

   `config.js` gab es Free frei, die DB führt `false`. Ein echter Free-Nutzer
   hatte es nie; der Fallback log nur **im Startfenster**, bis die DB
   antwortet. Dasselbe Muster wie `v1160`, anderer Schlüssel.

   ### `theme_palette` — ZURÜCKGENOMMEN, vor dem Eingriff

   **Mein Befund war falsch geschlossen.** Gemessen stimmte er (`false` am
   echten Konto), aber `_isPalette()` prüft **zuerst** `isProOrAbove()` — die
   Palette hängt am **Plan-Schlüssel**, nicht am Feature. **Pro und Partner
   haben sie.** Die `hasFeature('theme_palette')`-Zeile ist ein ausdrücklich
   kommentierter Vorgriff („später, wenn Backend es kennt").

   **Beinahe hätte ich einen bewusst gesetzten Platzhalter gelöscht.** Gerettet
   hat nur die Frage „gibt es die Funktion überhaupt?" **vor** dem Eingriff —
   dieselbe Frage, die den `beleg_import`-Fund erst brauchbar gemacht hat.

   > **Die Lehre, die beide Fälle verbindet:** Ein Feature-Schlüssel auf
   > `false` heißt **nicht**, dass die Funktion gesperrt ist. Sie kann an einem
   > **zweiten Weg** hängen — hier am Plan-Schlüssel. **Vor jeder Behebung die
   > Aufrufstelle lesen, nicht nur den Schlüssel.** Bei `beleg_import` gab es
   > keinen zweiten Weg, bei `theme_palette` schon.

- [2026-08-13] **Punkt 6 durchgeklickt — zwei Funktionen sind für JEDEN gesperrt, auch für Pro und Partner**
   Der Prüfmodus aus `v1163` erlaubt endlich, was der Punkt verlangte. Alle
   vier Stufen gegen 25 Feature-Schlüssel gemessen, dann **gegen die Datenbank
   gegengehalten** — und genau das Gegenhalten war der Punkt.

   ### Der Befund: `beleg_import` und `theme_palette` stehen in KEINEM DB-Plan

   `config.js` gibt sie frei (`beleg_import` ab Investor, `theme_palette` ab
   Pro). **Die Datenbank kennt beide Schlüssel überhaupt nicht** — geprüft
   über `jsonb_object_keys` für alle fünf Pläne.

   Und die DB ist die Quelle: `hasFeature` fragt zuerst `Sub.hasCachedFeature`
   und nimmt `config.js` nur bei `null`. **Gemessen am echten Partner-Konto
   sind beide `false`.** Für jeden zahlenden Nutzer sind diese zwei Funktionen
   also **zu**, während die Datei behauptet, sie seien offen.

   | Schlüssel | `config.js` | DB | echter Partner |
   |---|---|---|---|
   | `beleg_import` | ab investor | **fehlt** | **false** |
   | `theme_palette` | ab pro | **fehlt** | **false** |

   **Das ist Befund B3 in echt** — nur andersherum, als B3 ihn vermutet hatte.
   B3 fürchtete einen Tippfehler im **Code**; der Kreuzabgleich hatte den zu
   Recht entwarnt. Die Lücke sitzt zwischen **Code und Datenbank**: ein
   Schlüssel, den `config.js` kennt und `plans.features` nicht, ist still zu.
   **Der Kreuzabgleich muss beide Seiten prüfen, nicht nur die Frontend-Seite.**

   **Zu klären, bevor jemand etwas ändert:** ob die zwei Funktionen überhaupt
   ausgeliefert sind. Ein Schlüssel ohne DB-Eintrag kann auch schlicht heißen,
   dass es die Funktion nicht mehr gibt — dann gehört er aus `config.js` raus
   und nicht in die DB. **Erst messen, was hinter den Schlüsseln steckt.**

   ### Zweiter Befund: `custom_finance_models` — die Datei ist großzügiger als die DB

   `config.js` gibt es **Free** frei, die DB führt `free=false`. Ein echter
   Free-Nutzer hat es also nicht — **es sieht nur im Startfenster so aus**,
   bis die DB antwortet. Dasselbe Muster wie bei `v1160`, nur an einem anderen
   Schlüssel. Die restlichen 22 Schlüssel waren unauffällig.

   *(Messfalle, die ich fast selbst getreten hätte: die simulierten Stufen
   lesen den `config.js`-Fallback, das echte Konto liest die DB. **Das ist kein
   Äpfel-mit-Äpfeln-Vergleich** — ein Unterschied zwischen „partner" und den
   anderen Zeilen der Matrix ist zuerst ein Hinweis auf die Quelle, nicht auf
   den Plan. Erst der DB-Abgleich macht daraus einen Befund.)*

- [2026-08-13] **Spracheingabe: schneller, und die Stichwörter als Fenster** — `v1169`, `a78ab83`.
   ### Schneller — eine Zeile, die niemandem nützte

   Pro Aufnahme laufen **vier** Modelle: Transkription, Live-Zwischenauswertung
   (`gpt-4o-mini`), Feldauswertung (`gpt-5.5`), Verifikation (`gpt-5.4-mini`).

   **Der Transkriptions-Default stand auf `gpt-4o-transcribe-diarize`.**
   Diarisierung trennt **Sprecher voneinander** — beim Diktat ins eigene
   Mikrofon spricht eine Person. Das war Rechenzeit ohne Gegenwert, und der
   **Dateikopf nennt als Default ohnehin `gpt-4o-mini-transcribe`**: Code und
   Doku standen auseinander, und der Code hatte das teurere gewonnen.

   Jetzt `gpt-4o-mini-transcribe`. Weiterhin über `OPENAI_TRANSCRIBE_MODEL`
   überschreibbar — wer eine Besichtigung zu zweit aufnimmt, setzt die
   Sprechertrennung dort.

   **Ehrlich dazu:** um wie viel es schneller wird, ist **nicht gemessen** —
   dafür braucht es einen echten Sprechlauf. Dass Sprechertrennung bei einem
   Sprecher nichts beiträgt, steht dagegen fest.

   ### Fenster statt Wolke

   Bisher standen **alle** Chips gleichzeitig da, je nach Modus über 30. Wer
   spricht, sucht darin sein nächstes Stichwort — die Wolke wurde mit jedem
   erkannten Feld nur **bunter, nicht kürzer**.

   Jetzt höchstens **neun** sichtbar. Ein erkanntes bleibt **900 ms grün
   stehen** — damit die Bestätigung gesehen wird —, geht dann mit einem kurzen
   Abgang weg, und von hinten rückt eins nach.

   **Bewusst nur die Sichtbarkeit.** Alle Chips bleiben im DOM:
   `updateChipsFromText`, `markChipsFinal` und die Gruppen-Navigation suchen
   per Selektor `.vi-chip[data-cid=…]` — **wer hier Elemente entfernt, bricht
   drei Stellen still.** Und der Fortschrittszähler zählt weiter **alle**,
   sonst stünde dort dauerhaft „9".

   `display:none` statt `visibility` — ein unsichtbares Chip hielte seinen
   Platz und die Wolke bliebe genauso groß.

   **Nachweis:** Syntax beide Dateien, Backend neu gebaut, Marker im
   Container. Das Ausblende-CSS im Browser geprüft: `.vi-aus` und `.vi-weg`
   ergeben `display:none`, das erkannte Chip trägt die Animation `viAb`.
   **Die Nachrück-Logik selbst ist nicht abgenommen** — die Chips entstehen
   erst beim Aufnahmestart, und dafür braucht es ein Mikrofon. Staging-Abnahme.

- [2026-08-13] **Checkboxen per Sprache — der ganze Weg, nicht nur die Freigabe** — `v1168`, `77be07f`. **(Backlog-Punkt 7, Rest 1)**
   Beide Katalogbauer stiegen bei `type === 'checkbox'` aus. „Alle Felder"
   schließt sie ein. **Die Freigabe allein hätte nichts bewirkt** — vier
   Stellen mussten mit, und jede einzelne hätte still versagt:

   | # | Stelle | Was ohne sie passiert wäre |
   |---|---|---|
   | 1 | **Backend-Whitelist** (`voiceExtractService:51`) | `kind` wird gegen `['select','num','int','date','text']` geprüft — `bool` wäre **still auf `text`** gefallen. Katalog käme durch, KI lieferte `"ja"`, das Frontend hätte einen String, wo es ein Häkchen setzen will |
   | 2 | **Prompt-Zeile** | Das Modell rät zwischen `true`, `"ja"` und `1`. Wichtiger noch: **nur nennen, wenn zutreffend** — sonst listet es gewissenhaft alle Häkchen mit `false` und die Import-Tabelle quillt über mit Nicht-Befunden |
   | 3 | **Normalisierung**, in **beiden** Auswertepfaden | Ohne sie käme `"ja"` als String an |
   | 4 | **`applyMerged()`** in `object-actions.js` | `setInput()` schreibt in `.value` und **lässt eine Checkbox unberührt** — sie wäre als übernommen **gezählt** worden, ohne gesetzt zu sein |

   **Die wichtigste Entscheidung ist keine technische:** Es kommt **nur JA
   durch.** Ein „nein" wird verworfen statt als `false` übernommen — sonst
   hakt ein beiläufiges *„einen Stellplatz gibt es nicht"* ein Feld **aktiv
   ab**, das der Nutzer nie angefasst hat. Die Import-Tabelle zeigt nur, was
   gesetzt wird; ein stilles Abhaken wäre dort unsichtbar gewesen.

   `change` wird von Hand gefeuert — ein per Skript gesetztes `.checked` löst
   keins aus, und die Rechenkette hängt an Ereignissen.

   ### Der Rest war viel kleiner als der Punkt klingt

   **Gemessen: 203 Felder, davon genau EINE Checkbox** — `san_tax_active`.
   Die Änderung ist vollständig und richtig, **betrifft heute aber ein Feld.**
   Das Formular löst Ja/Nein sonst über Selects, und die sind längst füllbar.
   *(Wer den Punkt für groß hielt — ich auch — hat von „Checkboxen" auf eine
   Menge geschlossen, die es nicht gibt. Erst zählen, dann schätzen.)*

   **Nachweis:** Syntax für alle drei Dateien, Backend **neu gebaut**, vier
   Marker im laufenden Container, Server hört wieder. **Nicht abgenommen ist
   der Sprechlauf** — dafür braucht es ein Mikrofon am Gerät. Das bleibt
   Rest 3 des Punktes.

- [2026-08-13] **Punkt 7, Rest 2 gemessen: das Speichern-Modal gibt es nicht — und der Snapshot ist eine feste Liste**
   Marcel: *„Beim ‚Als Objekt speichern' öffnet sich ohnehin ein kleines Modal.
   Dort soll stehen: es gibt weitere Werte, die mit übernommen werden — mit
   Auflistung, und mit den Texten der Zusammenfassung."*

   **Gemessen in `quick-check.js:1720`:** `qcSaveAsObject()` speichert **ohne
   jedes Modal**. Es sammelt einen **fest verdrahteten Snapshot** von rund
   20 `qc_`-Feldern (Kaufpreis, Miete, Adresse, Flächen, Zins, Tilgung …),
   prüft zwei Pflichtfelder und schreibt durch.

   **Zwei Folgerungen, die den Rest schärfen:**
   1. **Die Auflistung, die Marcel will, ist ohne Vorarbeit gar nicht baubar** —
      es gibt keine Stelle, die weiß, *welche* Werte „zusätzlich mitkommen".
      Der Snapshot ist eine Handliste, keine Ableitung. Wer die Auflistung
      will, braucht zuerst eine Quelle dafür.
   2. **Der Snapshot trägt `thesis`, `risiken` und `notizen` NICHT.** Im
      QuickBoarding werden sie heute auch nicht per Sprache gefüllt (dort
      bleibt es bei den QC-Feldern), es geht also **nichts verloren**. Sobald
      der Sprach-Umfang im QC erweitert würde, **ginge es verloren** — dann
      muss der Snapshot mitwachsen. Das gehört zusammen entschieden.

   **Nicht geklärt:** welches Modal Marcel meint. Möglich, dass er das
   Namens-/Bestätigungsfenster eines anderen Weges vor Augen hat
   (`pdf-import.js` kennt ein „Als Objekt speichern" mit Fotos). **Bevor hier
   gebaut wird, den Bedienweg einmal gemeinsam anschauen** — sonst entsteht
   ein zweites Modal neben einem vorhandenen.

- [2026-08-13] **Punkt 7 ist zum größten Teil längst gebaut — Befund, kein Umbau**
   **Vor dem Bauen nachgesehen, und gut so.** Marcels Punkt liest sich wie ein
   Neubau („Spracheingabe soll **alle** Felder füllen"). Gemessen im Code:

   | Marcels Wunsch | Stand |
   |---|---|
   | **alle** Felder per Sprache füllbar | **`buildFullCatalog()`, v519** — gibt *alle* `window.FIELDS` an die Auswertung, nicht nur die Chip-Whitelist. Der Kommentar nennt als Beispiele genau `bank_inst`, `d1_type`, Bauspar-Felder, Investment-These, Risiken |
   | Risiken und Mängel → **bekannte Risiken** | `risiken` steht in `HINTS` und ist füllbar |
   | Vorhaben → **Investitionsthese** | `thesis` ebenso |
   | Rest → **zusätzliche Notizen**, statt ihn zu verlieren | **Prompt-Regel 8** in `voiceExtractService.js:138`: *„Allgemeine Anmerkungen ohne eigenes Feld → notizen."* |
   | QuickBoarding: weniger Felder, gleiche Logik | so gebaut — im Quick Check bleibt es bei den QC-Feldern, derselbe Dienst |

   **Der Unterschied, der den Punkt erklärt:** die **Chip-Wolke** ist kuratiert
   (`buildCatalog`, v510 — eine Whitelist mit Klartext-Labels), der
   **Auswertekatalog** ist vollständig (`buildFullCatalog`, v519). Wer auf die
   Chips sieht, hält die Liste für den Umfang. **Sie ist nur die Anzeige.**

   ### Was wirklich offen ist — deutlich kleiner als der Punkt

   1. **Checkboxen werden übersprungen.** Beide Katalogbauer steigen bei
      `el.type === 'checkbox'` aus. „Alle Felder" schließt sie ein; ob das
      Absicht war, steht nirgends.
   2. **Das Modal beim „Als Objekt speichern"** — Marcel will dort die
      Auflistung der mit übernommenen Werte und die Texte der Zusammenfassung.
      **Nicht geprüft**, ob es das gibt.
   3. Ob die Einsortierung in `risiken`/`thesis`/`notizen` in der Praxis
      trifft, sagt nur ein echter Sprechlauf — das ist ein Abnahmepunkt, kein
      Codebefund.

   **Deshalb hier nichts gebaut.** Ein Paket auf „das fehlt" wäre das siebte
   Mal derselbe Fehler gewesen. Der Punkt gehört auf die drei Reste
   zusammengestrichen, nicht als Neubau angefasst.

- [2026-08-13] **Die zwei Reste des Profil-Schalters sind zu** — `v1167`, `c1d572b`. **(Backlog-Punkt 5 abgeschlossen)**
   **Rest 1 · Je Profil eigene Werte.** Der Schalter setzte `ui_cards` hart auf
   `''`. Wer „Wallet" oder „Stapel" eingestellt hatte, verlor das beim
   Umschalten — und beim **Zurückschalten kam es nicht wieder.** Marcels
   Vorgabe nennt für das helle Profil Standard-Karten, das war also nicht
   falsch, aber gröber als nötig.

   Jetzt merkt sich jedes Profil seine drei Darstellungsschalter unter
   `dp_profil_werte`. **Nur die drei** — `ui_accent` und `ui_obsidian` sind
   Markenfarben und gelten in beiden Profilen; wer sein Gold setzt, will es
   nicht nur im Dunkeln.

   **Gesichert wird nur, wenn wirklich ein Profil aktiv war.** Bei einer
   dritten Vorlage gehört der Stand zu keinem der zwei und würde sonst einem
   davon untergeschoben.

   **Nachgemessen** (`settings.js?v=v1167`, echte Klicks):

   | | Vorlage | Karten | Merker |
   |---|---|---|---|
   | Ausgang: Obsidian + Wallet | (keine) | `wallet` | – |
   | nach „Hell" | `kanzlei` | (keine) | `obsidian:{wallet}` |
   | zurück auf „Obsidian" | (keine) | **`wallet`** | beide Profile |

   **Rest 2 · Markierung beim Öffnen.** `markieren()` hing nur am Klick auf ein
   Profil — wer das Pane öffnete, sah **zwei ungedrückte Knöpfe**, obwohl einer
   galt. `_dpProfilMarkieren` gab es bereits, es wurde nur nie beim Öffnen
   gerufen. Gemessen: Pane geschlossen, neu geöffnet, ohne Klick steht
   `obsidian=true hell=false`.

   **Damit ist Backlog-Punkt 5 vollständig** — Schalter, beide Richtungen,
   eigene Werte je Profil, Markierung. Marcels Einstellungen und der neue
   Merker sind nach dem Test zurückgesetzt.

- [2026-08-13] **Der Hinweis am Garagenfeld — die Rückfrage, die in beiden Wegen stimmt** — `v1166`, `c9779df`. **(Backlog-Punkt 10)**
   Punkt 10 wartet auf eine fachliche Entscheidung. **Dieser Hinweis nimmt sie
   nicht vorweg** — er erscheint genau dann, wenn beide Auslegungen
   auseinanderfallen können: ein **Miteigentumsanteil ist gepflegt** (also eine
   ETW) **und eine Garagenfläche steht drin.** Dann fragt er:

   > Der Miteigentumsanteil wird hier **nicht** abgezogen — anders als beim
   > Bodenwert. Steht dort der eigene Anteil?

   **Bewusst keine Schwelle und keine Rechnung.** Die Garage folgt in der
   Teilungserklärung meist einem **eigenen** Anteil oder einem
   Sondernutzungsrecht, nicht dem Wohnungs-MEA. Eine automatische Kürzung wäre
   darum in **beide** Richtungen falsch — bei zwei Garagen für sechs Parteien zu
   wenig, bei einer zugeordneten eigenen Garage ebenfalls zu wenig, bei gar
   keiner zu viel. **Gefragt wird, nicht gerechnet.**

   **Zwei Fallen beim Einbau, beide vorher bedacht:**
   - Aufgerufen **nach** dem Neuzeichnen. `zeichnen()` baut die Blöcke neu auf;
     ein vorher angehängter Hinweis wäre still wieder weg gewesen. `mea` und
     `garagenBgf` standen bereits in der Auslöserliste — der Hinweis kommt bei
     jeder Änderung an einem der beiden mit.
   - **Eigene Darstellung statt einer fremden Klasse:** für `.wm-f small` gibt
     es in dieser App **keine** Regel. Ein blankes `<small>` hätte geerbt, was
     zufällig da war. Gedämpft und ohne Statusfarbe, Gold als
     Whitelabel-Token — es ist eine Rückfrage, kein Fehler.

   **Nachweis:** Syntax geprüft, zwei Marker auf dem Server, Cache-Kette in
   allen drei Gliedern gezogen. **Im Browser nicht abgenommen** — dafür braucht
   es einen Bericht mit gepflegtem MEA und Garagenfläche; das ist ein
   Staging-Abnahmepunkt.

- [2026-08-13] **Das Garagenfeld sagte im Platzhalter das Gegenteil der Feldhilfe** — `v1165`, `b9e7851`. **(Backlog-Punkt 10, der entblockbare Teil)**
   Punkt 10 stand als **blockiert**, weil eine fachliche Entscheidung fehlt.
   Beim Nachsehen lag darunter aber ein Widerspruch, der **keine** Entscheidung
   braucht — einer der beiden Texte muss schlicht falsch sein:

   | | Text |
   |---|---|
   | Feldhilfe (v1142) | „bei einer Eigentumswohnung also nur die eigene Garage oder **der eigene Anteil**" |
   | Platzhalter im Feld | „Länge × Breite, **alle Garagen zusammen**" |

   **Sichtbar ist der Platzhalter.** Die Hilfe muss man aufklappen. Der Nutzer
   trug also genau die Gesamtfläche ein, die den Sachwert zu hoch macht —
   `lib/nhk2010.js` kennt weder `mea` noch `ist_wohnung` und kürzt nichts. Am
   Prüfobjekt Hüllhorst sind das 64,58 m² für **eine von drei** Einheiten, bis
   zu rund 18.500 € zu viel.

   Der Platzhalter heißt jetzt „Länge × Breite – bei einer ETW nur der eigene
   Anteil". Cache-Buster in **allen drei Gliedern** der Marktbericht-Kette
   hochgezogen.

   **Was das ausdrücklich NICHT tut:** es nimmt die fachliche Frage nicht
   vorweg. Ob ins Feld eine MEA-Kürzung gehört, entscheidet Marcel weiterhin —
   hier wurde nur der Widerspruch zwischen zwei Texten geräumt.

   **Nachweis:** Syntax geprüft, Marker auf dem Server, Kette gezogen. Der
   sichtbare Platzhalter ist **nicht im Browser abgenommen** — ein Textstring
   ohne Logik, aber gesehen habe ich ihn dort nicht.

- [2026-08-13] **Die Objektnummer im Kopf hat jetzt Kontrast** — `v1164`, `bb44d8d`. **(Backlog-Punkt 9)**
   **Kein neuer Befund, sondern der Rest eines halb erledigten.** Der Punkt
   nannte 2,98 (kanzlei) und 2,88 (boarding). Gemessen wurde jetzt **3,88 und
   3,72** — die Regel aus Abschnitt (b) der `ui-varianten.css` hat also längst
   gewirkt, sie war nur **nicht weit genug**. Kleiner Text (10,5 px / 700)
   braucht 4,5.

   **Gelöst über den Token, nicht über eine neue Regel.** `--uv-marke-dd` war
   bisher nur ein Alias auf `--uv-marke-d` — die Sollbruchstelle war vorgesehen
   und nie benutzt. Jetzt dunkelt sie **relativ zum Markenton** ab:
   `color-mix(in srgb, var(--uv-marke-d) 82%, #000)`.

   **Relativ und nicht als Literal — das ist der Punkt:** ein Whitelabel-Rot
   bleibt Rot und wird nur dunkler. Ein festes Gold hätte die Mandantenmarke an
   sechs Stellen überschrieben, und `gold-audit.py` hätte es zu Recht angemahnt.

   | | vorher `#987B22` | jetzt `#7d651c` |
   |---|---|---|
   | kanzlei (`#FBFAF7`) | 3,88 | **5,38** |
   | boarding (`#FAF5E8`) | 3,72 | **5,16** |

   **Alle sechs Leser von `--uv-marke-dd` wurden vorher geprüft** — Objektnummer,
   Kerosin-Pille, zwei Teile des Aktionen-Knopfs, Reiter-Status. Alle stehen auf
   **hellem** Grund unter kontor/panel/kanzlei/boarding, keiner auf dunklem.
   Deshalb ist das Abdunkeln für alle richtig und nicht nur für den gemeldeten Fall.

   **Zwei Werkzeugfallen, beide neu und beide teuer:**
   1. **Der Grund-Leser muss Verläufe auswerten** — stand schon im Punkt und hat
      sich bestätigt. Ein Leser, der nur `background-color` kennt, überspringt die
      Kopfleiste und meldet Weiß.
   2. **Verschachteltes `color-mix` liefert `color(srgb 0.48 0.39 0.10)`, nicht
      `rgb()`.** Mein Parser las die 0–1-Werte als 0–255 und meldete Kontrast
      19,24 — *„behoben"*, wo nichts gemessen war. **Ein Farbparser, der nur
      `rgb()` kennt, ist ab jetzt unbrauchbar**, sobald `color-mix` im Spiel ist.
   3. Und der Nachfolgefehler davon: der reparierte Leser fand dann den
      **halbtransparenten Eigenhintergrund** der Pille (20 % Gold) und maß
      dagegen. **Gemessen wird gegen den Grund der Fläche darunter**, nicht gegen
      den eigenen Schleier.

   *(Nicht gemessen: `kontor` und `panel` lesen denselben Token, ihre Kopfgründe
   sind aber nicht ausgelesen. Gegen den im Punkt genannten älteren Grund
   `#E8DFC5` käme der neue Ton auf 4,22 — knapp unter 4,5. Wer dort nachmisst,
   sollte mit 85 % statt 82 % rechnen.)*

- [2026-08-13] **Die sieben Pro-Tage gibt es — Marcel hatte recht, ich hatte es bestritten** — Prüflauf, kein Umbau. **(Backlog-Punkt 6, Marcels Frage)**
   **Zuerst die Rücknahme:** Im Prüflauf vom selben Tag stand von mir *„Ich
   kann das nicht bestätigen — in meinen Unterlagen steht es nicht."* **Das
   war falsch, und zwar weil ich in meinen Unterlagen gesucht habe statt im
   Code.** Der Mechanismus ist gebaut, sauber dokumentiert und trägt überall
   den Marker `TR7-trial`.

   **Wie es wirklich läuft — nicht am Starter, sondern ab Registrierung:**

   | | |
   |---|---|
   | **Wer** | **jeder neue Nutzer**, automatisch bei der Registrierung |
   | **Was** | `plan_trials`-Zeile, `granted_plan='pro'`, `expires_at = NOW() + 7 days` |
   | **Wo vergeben** | `userService.js:42` (der Trichter) und `auth.js:69` |
   | **Mehrfachvergabe** | ausgeschlossen per `WHERE NOT EXISTS` |
   | **Auslaufen** | automatisch über `expires_at`, kein Aufräumjob nötig |
   | **Fehlschlag** | wird geloggt, bricht die Registrierung **nicht** ab |

   **Vier bewusste Abweichungen von rohem Pro** (`subscriptionService.js:78 ff.`):
   1. **Ein aktives bezahltes Abo schlägt die Testphase** — sonst sähe ein
      Reseller-Mandant sieben Tage „Pro" und würde danach sichtbar
      herabgestuft, obwohl der Reseller bezahlt hat.
   2. `export_csv`, `json_backup`, `excel_import` bleiben **aus** — die
      Exporte sind Verkaufsargumente und tragen kein Wasserzeichen.
   3. **KI-Kontingent bleibt auf Free-Niveau** — Kerosin wird nicht verschenkt.
   4. **Das Wasserzeichen bleibt aktiv.** Getestet wird der Funktionsumfang,
      nicht der Export.

   ### Und was nach Tag 7 mit den Objekten passiert — die eigentliche Frage

   **Nichts wird unerreichbar.** Belegt, nicht vermutet: `requireUnderLimit('objects')`
   hängt an **genau einer Stelle** — `router.post('/')` in `objects.js:73`.
   **Nur das Anlegen** ist begrenzt; Lesen, Listen und Ändern tragen kein Limit.

   | Plan | `max_objects` |
   |---|---|
   | free | 1 |
   | starter | 5 |
   | investor | 25 |
   | pro / partner | `-1` (unbegrenzt) |

   Nach Ablauf fällt der Nutzer auf Free (1). Seine unter Pro angelegten
   Objekte bleiben **sichtbar, aufrufbar und bearbeitbar** — er kann nur kein
   neues anlegen, solange er über dem Limit liegt. **Das ist das richtige
   Verhalten**, und es ist keine Änderung nötig.

   *(Ungeprüft geblieben: ob das Frontend die verbleibenden Testtage sichtbar
   macht. `trial_days_left` liefert das Backend — ob es jemand anzeigt, ist
   nicht gemessen.)*

- [2026-08-13] **Der Plan-Override war wirkungslos — jetzt ein Prüfmodus, der nur nach unten geht** — `v1163`, `a4107d0`. **(Backlog-Punkt 6, der offene Rest)**
   **Der Punkt lag nicht am Prüfen, sondern am fehlenden Werkzeug.** „Je Plan
   durchklicken" war nicht simulierbar: `getCurrentPlanKey()` fragte **zuerst**
   `Sub.getCurrentSync()`, und ein echtes Abo im Cache gewann immer. Gemessen:
   `dp_plan_override='free'` gesetzt, `currentKey()` blieb `partner`. **Der
   Override war also nie tot — er stand hinten in der Reihenfolge.**

   **Kein genereller Vorrang.** Das würde jeden Nutzer mit einer Konsolenzeile
   auf `partner` heben. Stattdessen Rangordnung
   `free < starter < investor < pro < partner`, und **der Override darf nur
   herabstufen.** Wer Partner hat, sieht sich alles darunter an; nach oben
   geht nichts.

   **Der zweite Teil, ohne den es ein halber Schalter wäre:** `hasFeature`
   fragt zuerst `Sub.hasCachedFeature` — die DB-Features des **echten** Abos.
   Die Anzeige hätte „free" gezeigt und trotzdem Partner-Funktionen
   freigeschaltet. **Das sieht aus wie ein bestandener Test und ist keiner.**
   Im Prüfmodus wird der DB-Weg jetzt übersprungen. Eine Quelle für beide
   Leser: `pruefOverride(echterPlan)`.

   **Nachgemessen** (`config.js?v=v1163`, echtes Partner-Konto):

   | | echt | `currentKey()` | Features |
   |---|---|---|---|
   | ohne Override | partner | `partner` | `market_data_fields=true`, `rnd_full=true` |
   | Override `free` | partner | **`free`** | **beide `false`** |
   | Override entfernt | partner | `partner` | wieder `true` |

   **Grenze, die dazugehört:** simuliert wird das **Frontend-Gate**, nicht die
   Durchsetzung im Backend — die API antwortet weiter nach dem echten Abo. Und
   der Prüfmodus zeigt den **`config.js`-Fallback** des simulierten Plans, nicht
   dessen DB-Zeile; der Client kennt nur sein eigenes Abo. Für die geprüften
   Schlüssel stimmen beide überein, sonst wäre das ein Fehlerkanal.

   ### Kreuzabgleich der Feature-Schlüssel — B3 ist entwarnt

   B3 fürchtete: „ein Tippfehler sperrt still den teuersten Plan". Alle im
   Frontend abgefragten Schlüssel gegen alle in Plänen definierten gehalten
   (37 in den Plänen, 26 abgefragt über `hasFeature`/`can`/`_gate`/
   `data-feature`): **kein abgefragter Schlüssel fehlt in den Plänen.** Die
   Sorge trifft an keiner Stelle zu.

   *(Zwei eigene Fehlbefunde aus diesem Lauf, beide vor der Meldung gefangen —
   und beide entstanden, weil ich Namen verglichen statt Aufrufstellen gelesen
   habe:*
   1. *`ai_analysis=false` bei Free „gemessen" — es heißt `ai_analysis_tab`,
      und ein unbekannter Schlüssel ist für jeden false. Die Probe hat sich
      selbst erzeugt, was sie fand.*
   2. *Fünf Schlüssel schienen abgefragt, aber nirgends definiert, darunter ein
      scheinbarer Dreher `custom_track_record_cover` ↔ `track_record_custom_cover`.
      **Ein Namensdreher wäre ein echter Kundenschaden gewesen** — deshalb erst
      die Aufrufstelle gelesen: `_gate()` führt beide Schreibweisen im
      **Selektor**, um beide HTML-Varianten zu fangen, der **Schlüssel** ist
      richtig. `ai_lage`, `bauspar`, `tilgungsaussetzung` sind gar keine
      Feature-Schlüssel, sondern Datenfelder. **Lehre: bei Feature-Schlüsseln
      nie Namenslisten diffen, ohne die Aufrufstelle zu lesen** — `_gate` trennt
      Selektor und Schlüssel, ein grep über beide wirft sie zusammen.)*

- [2026-08-13] **Hell und Dunkel als zwei Profile, unter „Profil & Anzeige"** — `v1162` + `v1162b`, `381e678`. **(Backlog-Punkt 5, erster Wurf)**
   **Marcels Vorgabe:** „DealPilot wird im dunklen Modus ausgeliefert. Daneben
   ein heller Modus, umschaltbar mit einem Griff." Ort: ausdrücklich
   **Einstellungen → Profil & Anzeige**.

   **Die helle Fassung kommt aus `design/mockups/hell.png`** und ist damit die
   Vorlage **`kanzlei`**, nicht `panel` — am CSS gegengeprüft (warme helle
   Kopfleiste `--uv-chrome #FBFAF7`, warme Fläche, weiße Karten,
   Serifenschrift). `panel` ist „Kühl" mit Blaustich und im Bild nirgends.
   **Und der Chrome-Skin bleibt in beiden Profilen aus:** im Bild sind die
   Reiter golden, nicht die Tinte aus `v1158`, und die hängt an
   `body.dp-chrome-hell`. Der helle Modus ist eine **Vorlage**, kein Skin.

   | Profil | `ui_theme` | `ui_cards` | `dp_chrome_hell` |
   |---|---|---|---|
   | Obsidian | `''` | `''` | `0` |
   | Hell | **`kanzlei`** | `''` | `0` |

   **Kein zweites Zustandsmodell:** derselbe Schlüssel `dp_user_settings`,
   dieselbe `anwenden()`-Kette wie im Darstellungs-Panel, angewandt über
   **dessen API** statt per `setAttribute` — sonst fehlt `skinNachziehen()`.

   **Ist eine dritte Vorlage aktiv, ist KEIN Profil markiert.** Das ist
   ehrlicher als eines zu behaupten: wer im Panel „Konsole" gewählt hat, ist
   in keinem der zwei. Gemessen und bestätigt (`aktiv: null` bei `panel`).

   **Nachgemessen** (`settings.js?v=v1162b`, echte Klicks):

   | | vorher | nach „Hell" | nach „Obsidian" |
   |---|---|---|---|
   | Vorlage | (keine) | **`kanzlei`** | (keine) |
   | Kopfleiste | dunkler Verlauf | **rgb(251,250,247)** | dunkler Verlauf |
   | Sidebar | rgb(10,10,10) | rgb(251,250,247) | rgb(10,10,10) |
   | Reiter | — | **golden** | — |
   | `dp_chrome_hell` | 0 | **0** | 0 |

   ### `v1162b` — die Reihenfolge war der ganze Punkt

   Der erste Anlauf setzte **erst die Vorlage, dann den Skin aus**. Gemessen:
   nach dem Klick auf „Hell" stand `data-ui-theme` **leer** statt auf
   `kanzlei`. Ursache ist `FALLEN.md` Punkt 6 — `_dpDispSkin` ruft
   `vorlageNachziehen()`, und das setzt `ui_theme` auf `''`, wenn die Vorlage
   der neuen Helligkeit widerspricht. **Es hat genau die Vorlage gelöscht, die
   eine Zeile vorher gesetzt worden war.** Im Kommentar stand es richtig, im
   Code falsch. Jetzt: erst Skin aus, dann Zustand, dann anwenden.

   ### Zwei offene Punkte aus diesem ersten Wurf

   1. **Frage 1 des Punkts ist noch nicht gebaut.** Meine Antwort war „je
      Profil eigene Werte" über `brand_display` — der Schalter **überschreibt
      `ui_cards` heute hart** auf `''`. Wer „Wallet" oder „Stapel" eingestellt
      hatte, verliert das beim Umschalten. Marcels Vorgabe nennt Standard-Karten
      für das helle Profil, also ist es nicht falsch — aber die Verfeinerung
      fehlt.
   2. **Beim programmatischen Öffnen** (`showSettings('profilanzeige')`) wird
      nicht markiert; `markieren()` hängt am Tab-Klick. Nach einem Klick auf
      ein Profil stimmt die Markierung. Kosmetisch, aber offen.

   *(Nebenbeobachtung, nicht von diesem Paket: im Obsidian-Modus stand die
   Reiterfarbe auf `rgb(0,0,0)` statt Gold, und `dp_user_settings` trug
   `ui_form: 'rund'` und `ui_obsidian: '#241C16'` — fremde Werte aus einer
   anderen Sitzung. Vor einem Befund daraus erst prüfen, wer sie gesetzt hat.)*

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
