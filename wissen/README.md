# Wissen — DealPilot, Tag für Tag

**Seit 02.11.2026.** Marcel: *„ich möchte, dass wir alles immer wissen, was genau
ist"* — Regeln, Optik, Kombinatorik, Berechnungen, Ansichten, Videos, wie Objekte
angelegt werden, wie der Ablauf ist.

## Wo was steht

| Ablage | sagt | Lesereihenfolge |
|---|---|---|
| `CLAUDE.md` | **wie** gearbeitet wird | 1 |
| `claude/projektanweisung-hauptapp.md` | **Gesamtstand** + Rollout-Journal (Was · Commit · Nachweis · Rest) | 2 |
| `wissen/JJJJ-MM-TT.md` | **was an diesem Tag galt und warum** — Entscheidungen, Regeln, gemessene Befunde, Fallen | 3, bei Detailfragen |
| `BACKLOG.md` | **was ansteht** | — |
| `FALLEN.md` | **wo schon jemand hingefallen ist** | — |

> `CHANGELOG.md` und `docs/changelog/` sind **seit Mai 2026 (V239) nicht mehr
> fortgeschrieben**. Die Chronik danach steht im Rollout-Journal der
> Projektanweisung und ab 02.11.2026 zusätzlich hier.

## Aufbau einer Tagesdatei

Jede Datei hat dieselben Abschnitte. Leer bleibt, was an dem Tag nicht vorkam:

1. **Getan:** Version · Commit · Staging/Prod · Nachweis
2. **Regeln und Entscheidungen:** Marcels Worte wörtlich, mit dem, was daraus folgt
3. **Kombinatorik:** was unter welchen Bedingungen gilt (Plan × Zustand × Ansicht)
4. **Berechnungen:** welche Funktion rechnet, mit welchen Eingaben, und ein gemessenes Beispiel
5. **Ansichten und Optik:** wo was steht (Datei, Funktion, Selektor)
6. **Abläufe:** Objekte anlegen, Import, Videos, Rollout
7. **Fallen:** was heute schiefging oder fast schiefging
8. **Offen:** mit Verweis auf den Backlog-Punkt

## Tage

> Die Tage vom 13.05. bis 30.10.2026 sind am 02.11.2026 **rückwirkend** aus Commits,
> Rollout-Journal, Backlog und Memory angelegt. Tage ohne Commit und ohne Eintrag fehlen.
> Querzugriff nach Thema: [themen.md](themen.md).


### Mai 2026

- [2026-05-13](2026-05-13.md) — V1.0 erster Repo-Stand; V181–V187: Stripe-Checkout + Race-Schutz, Plan-Audit (DB als Quelle), BRW-KI, KI-Lage-Cache
- [2026-05-14](2026-05-14.md) — V187-h3: Bodenrichtwert-Prompt gab immer 250 €/m² (Few-Shot-Verzerrung)
- [2026-05-15](2026-05-15.md) — V189–V191: Steuer hinter BWK, BRW-Ergebnis je Objekt; überzähliges div ließ Steuer in jedem Tab erscheinen
- [2026-05-16](2026-05-16.md) — V192–V193: White-Label-Grundlage für Pro (Branding, Anfrage-Routing, Calendly)
- [2026-05-17](2026-05-17.md) — V194–V196: Admin-Dashboard mit TOTP, Nutzerverwaltung, MRR/ARR, Diagramme, CSV
- [2026-05-18](2026-05-18.md) — V197–V224: KI-Credit-Pakete via Stripe, Willkommens-Mails, AGB/Datenschutz, Reseller-Seite, Logo-Saga, V1.1
- [2026-05-19](2026-05-19.md) — V226–V240: degressive AfA + § 7b, Tooltips, PLZ-Schutz, DSCR-Kern dscr-engine.js, Kundenportal, Einführungs-Tour
- [2026-05-20](2026-05-20.md) — V225/V240–V252: Domain-Split Landing/App, Login-Bug-Marathon (11 Fehler), UI-Politur, Demo-Objekt
- [2026-05-21](2026-05-21.md) — V257–V260: zvE-Profil, Steuerzeiträume (tax_periods), WK-Aggregation, Alle-Objekte-Kanban, Hintergrund weiß
- [2026-05-22](2026-05-22.md) — V268–V270: Jahr 1 anteilig (WU, d1_auszahl), AfA Erstjahr monatsgenau, Steuerverlauf klickbar
- [2026-05-24](2026-05-24.md) — V270.3–V272: Stripe-Live-Vorbereitung, Rechtstexte, Pflicht-Einwilligung, Registrierung
- [2026-05-25](2026-05-25.md) — V275–V281: V+V anderer Bestandsobjekte, Tabelle tax_snapshots, steuerrichtiger Vorgängerfilter
- [2026-05-26](2026-05-26.md) — V284–V288: Bestandsliste, AfA 3 % am Baujahr (§ 7 Abs. 4 Nr. 2), BMF-Backend
- [2026-05-27](2026-05-27.md) — V289–V292.6: BMF-Rechner (Pipeline 12 Phasen, 3 Varianten), ji_token-Fix, AfA-Basis Faktor-100-Fehler
- [2026-05-28](2026-05-28.md) — V292.6.5–V294: BMF MEA-Fixes, WK-Übernahme, hart kodierte Modal-Version, alter BMF-Rechner raus
- [2026-05-29](2026-05-29.md) — V295–V325, V351–V353: BMF-PDF-Anlage, Status verloren, Jahr-1-Konsistenz Cashflow/Steuer
- [2026-05-30](2026-05-30.md) — v355–v357, V326: Finanzierungs-Umbau, Marktbericht-Import, AVM-Anbindung, Quick-Check als iframe
- [2026-05-31](2026-05-31.md) — v358–v375: Aktionsleiste, Kombi-PDF-Import mit OCR (34/19 Felder), DS2-Direktextraktion

### Juni 2026

- [2026-06-01](2026-06-01.md) — v376–v416: Auto-Save-Kopf, Score Kopf=Kachel, QC-Aktionskarte; v395-Rate-Limit-Schalter von Anfang an tot
- [2026-06-02](2026-06-02.md) — v417–v447: AVM-Credit-Topf (1 Credit), Landing-AVM-Karten, Margen 0,4/0,7/1,0, Rechtstexte
- [2026-06-03](2026-06-03.md) — v448–v452: Deal-Aktion Ready-Check, Portfolio-Dashboard
- [2026-06-05](2026-06-05.md) — v453–v488: ScoreTier als eine Quelle, Quick-Check-Tab, Cockpit-Umbau, KI-Timeout 120 s
- [2026-06-07](2026-06-07.md) — v489–v497: Kerosin-System (Liter), Feature-Matrix, § 19 UStG, Plan-Gates
- [2026-06-08](2026-06-08.md) — v498–v500: Landing-Durchsicht, Kerosin-Intro, Sitzungs-Banner
- [2026-06-09](2026-06-09.md) — v501–v538: Spracherfassung (Realtime → transcribe-chunk), QC-Cockpit-Karte
- [2026-06-10](2026-06-10.md) — v539–v581: Marktbericht als eigener Microservice, PRE-FLIGHT-Leiste
- [2026-06-11](2026-06-11.md) — v582–v618: Co-Pilot (Migration 033), Boarding-Pass-Optik, Sidebar-Rail, Passwort min. 10
- [2026-06-12](2026-06-12.md) — v619–v654: Mobile-Overhaul, Drawer-Akkordeon (fixed-Overlay), Settings nur Icons, AVM scharf
- [2026-06-15](2026-06-15.md) — v655–v675: ImmoMetrica-Anbindung, Import-Fixes Baujahr/Hausnummer, pass.html
- [2026-06-16](2026-06-16.md) — v677–v723: Quickboarding, Teilen-System, 18 Anläufe Speicher-Dialog im iframe, Hausgeld-Kern
- [2026-06-18](2026-06-18.md) — v724–v734: Foto-Verkleinerung, schlanke Sidebar-Liste, AVM-Ausstattungsfelder
- [2026-06-19](2026-06-19.md) — v735–v738: Auto-Save, Speichern vor Objektwechsel
- [2026-06-22](2026-06-22.md) — v739–v748: zweiter AVM-Partner live, AVM-Historie (Migration 036)
- [2026-06-23](2026-06-23.md) — v750e–v750k: Portfolio-Cockpit Feinschliff
- [2026-06-25](2026-06-25.md) — v765–v771: AVM-Sektion, ImmoMetrica-Demo, Neu-Objekt Status offen, Score-Hero
- [2026-06-26](2026-06-26.md) — v777–v802: Massenmail, Kundenbindung, Admin; fehlende Migrationen 037–042 (Prod-Image unvollständig)
- [2026-06-29](2026-06-29.md) — v812–v814: Mandanten/Halter mit KSt, API-Schlüssel, Überführung Privat → GmbH
- [2026-06-30](2026-06-30.md) — v815–v816j: Überführungs-Assistent, Mandanten-Umschalter in der Sidebar

### Juli 2026

- [2026-07-02](2026-07-02.md) — v803–v850: Sammelstand paralleler Sitzung (Marktbericht, AVM, Mandanten, Suche)
- [2026-07-03](2026-07-03.md) — v851–v855: neue Landingpage, Deal-Aktion als Boarding-Cockpit, Netzwerk-Karten
- [2026-07-06](2026-07-06.md) — v856–v880: Netzwerk-Ausbau, Tour-Umbau, _currentObjKey-Auflöser, Marktbericht-Redesign
- [2026-07-07](2026-07-07.md) — v882–v893d: Plan-Fenster in Landing-Optik, AVM-Kern, QC-Konsens-Übernahme
- [2026-07-08](2026-07-08.md) — v893c ff.: QC Doppel-/Dreifach-Anlage, Weißbild-Fix, AES-Verschlüsselung, .dpk-Import
- [2026-07-09](2026-07-09.md) — MA05–MA15 Mobile-App + v895: Prod laut Betreff; Marktbericht Doppelring-Hero (Aussagekraft)
- [2026-07-10](2026-07-10.md) — MA22–MA30 → Prod; v895d–g Marktbericht immer hell, Berichte-Download
- [2026-07-11](2026-07-11.md) — MA31–MA33 (PWA), AVM „Coming soon“ (Staging aus/Prod an), v898 Bankexport-Modale
- [2026-07-12](2026-07-12.md) — v899–v903: Theme-Fundament (heller Skin), Bankexport-Audit, MA34
- [2026-07-14](2026-07-14.md) — Rollout Reseller/Whitelabel P3–P21 + Theme v900–v938, Migrationen 055–057
- [2026-07-15](2026-07-15.md) — v940–v944, W1–W16: WK-PDF ab Investor, Whitelabel-Kontakt/Farben/Wortmarke
- [2026-07-16](2026-07-16.md) — W17–W43: --wl-Token-Ebene (841 → 0), dp:plan-ready, PDFs in Markenfarbe, BMF-Gate
- [2026-07-17](2026-07-17.md) — v942–v955: Marktbericht am Objekt, Streuung → Aussagekraft, Kerosin-Dreifachabbuchung
- [2026-07-18](2026-07-18.md) — v959–v973: Berichte löschen, QC-Takeover-Gate, Mobile-Sperre (v970), Landing-Analytics
- [2026-07-19](2026-07-19.md) — v974–v1000: BMF-Modal v292-Restore, Spracherfassung 5 Kategorien
- [2026-07-21](2026-07-21.md) — KI-Beleg-Import, Pfandbrief-Margen kalibriert, Mail-Domain → @dealpilot.immo
- [2026-07-23](2026-07-23.md) — Landing-Promo (ERSTFLUG 16 %), Handy-Sperre statt Weiche, 7 Tage Pro-Testphase

### August 2026

- [2026-08-02](2026-08-02.md) — v1014–v1043: Wertermittlung ImmoWertV 2021 (Ertrag, Sachwert NHK, BORIS), Quellenregister, Modellkonformität
- [2026-08-03](2026-08-03.md) — v1062–v1076: Verfahrenswahl, BWK auf Gesamtrohertrag, NHK vollständig; CLAUDE.md angelegt; v644 Akkordeon
- [2026-08-04](2026-08-04.md) — v645–v652, v1077: Handy/Tablet-Block (Tablet leer, 16px/44px), BACKLOG.md + design/ angelegt
- [2026-08-05](2026-08-05.md) — Prod-Rollout; v1079–v1088: Darstellungsvorlagen, Partner-Pro-Schranken, Aktionen-Menü, Handy-Sperre ab Partner
- [2026-08-06](2026-08-06.md) — v1089–v1111: Marke unter Vorlagen, Mindestkontrast OKLab, Kompakt/Stapel, Panel-Umbau, Partner-Flow
- [2026-08-08](2026-08-08.md) — v1112–v1116: Einstellungen + Partner-Portal am Handy, Gold auf Gold, Partner-Branding, Schließen-Knopf B
- [2026-08-10](2026-08-10.md) — v1117–v1128b: Handy-Sperre gefallen (SW-Abmeldung), Marktbericht-Rückweg, drei Stufenpreise, Wizard mit Reitern, Textfarben-Regler
- [2026-08-11](2026-08-11.md) — v1129–v1138e: sieben Wizard-Reiter, Werbungskosten-PDF geht auf, WM-Felder überleben das Speichern; Prod-Rollout 98 Commits
- [2026-08-12](2026-08-12.md) — v1139–v1154 + MB v1077–v1083b: ETW-Bodenwertverzinsung doppelt, SWF nie angewandt, Register NRW 493 LZS, Stufenregel; Prod 2×
- [2026-08-13](2026-08-13.md) — v1155–v1171 + MB v1084/a: Hell/Dunkel als Profile, Plan-Gates gegen DB, business/enterprise weg, Spracheingabe schneller, SWF-Register
- [2026-08-14](2026-08-14.md) — MB v1085–v1096a, v1172: Prod 74ae2e3, Register 2.150 Sätze aus 8 Ländern, eine Breite 960 px, drei Projektanweisungen nach claude/
- [2026-08-30](2026-08-30.md) — v1173–v1180: Wallet-Abstände, Akzentwähler + Fassung C, Preismodell Variante A (19,99/39,99/79,99/99), Stufen-Wording, Stripe-Sandbox
- [2026-08-31](2026-08-31.md) — v1181–v1186: Live-Preise mit lookup_key, Kontingent-Zähler statt Liter, Kaufkette, 4 Wochen Pro mit Testpaket; Prod-Rollout 064–069

### September 2026

- [2026-09-01](2026-09-01.md) — v1187–v1197: Kerosin-Reste bis zum Geldweg, Admin-Doppelroute, Tablet-Kopf, Löschknopf/Ring, erster MB-Abruf, deploy v3b; 3× Prod
- [2026-09-02](2026-09-02.md) — v1198–v1208: ETW-Bodenwert ohne MEA, Feldmarkierung, MEA Pflicht, Stufe wählbar, Score-Skala, PDF umgebaut; 2× Prod
- [2026-09-03](2026-09-03.md) — v1209–v1228: Marktbericht nachgerechnet (Hinterland, Plausibilität, 10 von 42), Steuer-Mappe, Anlage V 2025, Bilanz/GuV GmbH
- [2026-09-04](2026-09-04.md) — Prod v1215–v1231, Nutzer-Spiegelung Staging→Prod, Plan-Prüflauf B7–B15, v1229–v1238 Quick-Check, Überführung, Vortrag
- [2026-09-07](2026-09-07.md) — v1239–v1257, 14 Prod-Rollouts: Testbericht abgearbeitet, KI-Mietquellen, Preisrunde + Stripe Live, Bezahlschranke, Profil
- [2026-09-08](2026-09-08.md) — v1258–v1267b: § 7b-Spalte, Gold-Audit-Basislinie, Sprachaufzeichnung mit Kosten, IRR/Break-Even, 15-%-Grenze netto, BORIS zuerst; 3× Prod
- [2026-09-09](2026-09-09.md) — v1268–v1281: Doppel-Anlage behoben, PLZ→Ort/Straßenliste, Orbit-Standzeiten, Co-Pilot-Dialog mit Rückfragen; Prod bis v1272
- [2026-09-10](2026-09-10.md) — v1282–v1293g: Sprechlauf mit Etappen, Deal Score/DS2 als Halt, Herkunft je Feld, Kaufentscheidung, Pre-Flight-Kette, Kombi-Test
- [2026-09-11](2026-09-11.md) — v1294–v1322: Kontingent verfällt, Pakete/Menge, Sprechlauf-Feinschliff, Erbbaurecht § 50, GeoMap-Segmente, Kettenabbruch
- [2026-09-12](2026-09-12.md) — v1323–v1361: zwei Prod-Rollouts (v1273–v1331), Structured Outputs, MB-Formular, Gutachten-Prüfung, Einstellungs-Audit, Kaufgrenzen
- [2026-09-13](2026-09-13.md) — v1362–v1378b Schutz Block B, Tarif 2026, Datenraum; MB v1097–v1107: Ernte HH/HE/NI/RP/BB, Quellenlink und -nachweis
- [2026-09-14](2026-09-14.md) — SWF-Ernte über alle 16 Länder (v1108–v1160, v1387, v1396, v1401, 383 Sätze); Steuerprogression, Sprechlauf, BMF, BORIS (v1115–v1121, v1379–v1400)
- [2026-09-15](2026-09-15.md) — v1402–v1420: Quellennachweis mit Jahrgang und Lizenz, Baupreisindex 2,02→1,91, GbR im ESt-Topf, Progressionskurve, Belege im Tab Steuern, Ernte NI 5→14 Sätze
- [2026-09-16](2026-09-16.md) — v1421–v1425b: ERSTFLUG 15 % dauerhaft, Flyer-Code bis Checkout, Seat 19/15/12 über lookup_key, Rabatte im Admin; Prod per Cherry-Pick
- [2026-09-17](2026-09-17.md) — v1426–v1427b: RND-Kern 3.1.0 und Sachwert-Rechenweg aus dem Gutachten-Paket, Löhner auf den Euro, ZFH-Faktor 1,05
- [2026-09-18](2026-09-18.md) — Prod-Merge staging vollständig (Migr. 071–074), Quellenabgleich, v1428 Gold 448; v1429–v1441d Backlog v22 auf Staging
- [2026-09-19](2026-09-19.md) — v1442–v1453d: EK-Rendite vor Steuern, Sanierungsfinanzierung LTC, BGF mit Quelle, Gutachten.org, MFH-Einheiten, Hybrid, helles Profil; drei Prod-Rollouts
- [2026-09-20](2026-09-20.md) — v1454–v1469: MFH Stufe 3 (Zustand je Einheit), Soll-Sprung, BORIS-Vermerk; Bankfassung des Investment-PDF vollständig, Rumpfjahr-Fehler Stress-Matrix
- [2026-09-21](2026-09-21.md) — v1470–v1503: BMF-Fenster mit Bodenabschlag, Kaufpreisaufteilung-PDF, Arbeitshilfe als PDF, Umlaut-Kehrtwende, erfundene Vorbelegungen geleert
- [2026-09-22](2026-09-22.md) — v1504–v1554: Investment-PDF-Sperre, RND-Spanne, rnd-ui.js raus, Score rechts im Hellmodus, Partner 49→99 € (Prod), Landing neu gebaut
- [2026-09-23](2026-09-23.md) — v1555–v1589: Landing-Ablauf als Demo (Wechselschritt, Steuer-Rechenweg), Kontingent-Tabelle, Sitemap/Verifizierung auf Prod; Ernte NI Normobjekt, Bremen/Saarland
- [2026-09-24](2026-09-24.md) — v1590–v1603: neue Landing auf Prod, Erstflug-Balken/Rabatt-Fenster, Demo-MFH Gerberstr. 27, RND-Assistent-Fehler, Datenschutz v1601
- [2026-09-25](2026-09-25.md) — v1604–v1614c: Prod/Staging gleichgezogen (213 Commits), UUID-Fix v1610, Sprechlauf mobil, NI/BY-Ernte, Weg zur Quelle
- [2026-09-26](2026-09-26.md) — v1615–v1645: Prod früh, Sprechlauf, NI-Ernter, Lage aus BORIS, PDF-Absender/Logo, fünf Layouts, Datenaufnahme, Quick-Check
- [2026-09-28](2026-09-28.md) — v1646–v1667e: Typografie, nur noch Aktenmappe/Kanzlei, Kartei-Datenaufnahme, Score-Chip, Rückweg „Heute“, Liter raus
- [2026-09-29](2026-09-29.md) — v1668–v1711d: Gutachten gegen Kerne, Dokument-Import, Layouts bis Aktenreiter, Marktpreis/Portfolio-Pilot; Prod v1669/73/74
- [2026-09-30](2026-09-30.md) — v1712–v1734: Kartenentwürfe, Panel nur was wirkt, Handy/Tablet, Prod-Rollout 336 Commits, PDF-Absturz, KRITISCH auf der Karte

### Oktober 2026

- [2026-10-01](2026-10-01.md) — v1735–v1768c: Cockpit hell, Grund-Setup und Tour, Piloten nehmen Änderungen an, Ernte in die DB (493 → 2.573 Zeilen)
- [2026-10-02](2026-10-02.md) — v1769–v1811e: mb-Kennung UUID (Migr. 015), Tour-Hänger, Ernte erreicht Bericht (SAATDATEIEN), Telegram-Bot bis Agent mit Werkzeugkasten
- [2026-10-03](2026-10-03.md) — v1812–v1816b: Agent beantwortet Fragen über alle Objekte (19 Werkzeuge), Kennzahlen-Stempel, san_tax_active, Register-LZS in den Bericht
- [2026-10-04](2026-10-04.md) — Prod-Merge v1628–v1827c, Prod bis v1846b; v1817–v1864a: Jacoby, Unterlagen, BORIS, Reiter Objekt 3 Ebenen, Score „Sehr gut“
- [2026-10-05](2026-10-05.md) — v1865–v1891: Parkstr. 9, vier Steuerfehler, Handy-Aktenmappe, Ernte Linien 6–9, Bot falsches Haus; sieben Prod-Rollouts bis v1888a
- [2026-10-06](2026-10-06.md) — v1892–v1928: Handy-Menü der Aktenmappe in ~30 Paketen, Bewirtschaftung je Posten, Steuer v1898, Bot rechnet mit gespiegelten Kernen
- [2026-10-07](2026-10-07.md) — v1929–v1962: Partikel als Pseudoelement, Kartenstile, Heuristik mit Marktwert, Messe-Pop-up, Prod v1947–v1950a, Lageklassen A/B/C
- [2026-10-08](2026-10-08.md) — v1963–v2009: RND-Kerne gleichgezogen, Vergleichswert nur mit Kaufpreisen, erste Vergleichsfaktoren, ImmoMetrica live, Datenaufnahme N45
- [2026-10-09](2026-10-09.md) — v2010–v2061b: Piloten mit Projektwissen und Fotos, Analyse-Stempel, Ankauf-Stand, Portfolio-Export, geführte Eingabe, Tabellen-Karten
- [2026-10-10](2026-10-10.md) — v2062–v2098: Kontrast messbar, Export mit Marktberichten/RND, Rechenkerne-API, RND-Eingabe repariert, Kerosin raus, Kanban Bestand
- [2026-10-11](2026-10-11.md) — v2099–v2125: Cockpit-Kontrast umgesetzt, GrESt/Halter im Export, Score/Knöpfe-Staffelung, Kartenstile, Datenaufnahme über 48 Maße
- [2026-10-12](2026-10-12.md) — v2126–v2157: Geräteabnahme 5×, Gnadenfrist + Migration 086, Barkauf in beiden Scores, Lageklassen-Ampel; Prod v1951–v2144
- [2026-10-13](2026-10-13.md) — v2158–v2207: Zensus/Makro-DB, gpt-4.1, Bestand/Ankauf, BWK je Objektart 1,60, neue Hilfe mit Pilot/Atlas; 17 Prod-Rollouts
- [2026-10-14](2026-10-14.md) — v2208–v2238a: Schwärzen, Gewerbe-Ertragswert, Soll-Ansicht überschrieb Ist, Lage im Urteil, Angebotsabschlag, Messe-Studio; Prod 18–21
- [2026-10-15](2026-10-15.md) — v2239–v2273: Bauzins dynamisch, Ampeln nach Schwellen, Marktbewertung Gewerbe/GRST, Inventar im KP, NK aus Profil, BMF-Fenster, Videoreihe 02–14
- [2026-10-16](2026-10-16.md) — v2273a–v2370: Umrechnungskoeffizient Fläche bundesweit + DealPilot-Formel, eine RND beim MFH, Anlage-2-Plateau, Portfolio-DSCR, Videothek
- [2026-10-17](2026-10-17.md) — v2357–v2371: WGFZ-Umrechnung, DealPilot-Formel für MFH, örtliche Tabelle vor Bundesformel, geführte Eingabe repariert, Sprecher onyx
- [2026-10-18](2026-10-18.md) — v2365–v2372c: Ertragswert mit Ist-Miete, Angebotsabschlag im Bericht, amtliche Gegenprobe, WGFZ-Ernte, Modul 25 lauffähig
- [2026-10-19](2026-10-19.md) — v2368–v2445: LZS immer ein Wert, Stufe N, Register gegen DB, Marktbericht-Prüfung, Zielbild/Potenzial, Unterlagen 342 Ämter, Quick Boarding
- [2026-10-20](2026-10-20.md) — v2450–v2545: Wertpotenzial im Tab Bewertung, Ertragswert bei Leerstand, Nachrechnung MFH, Marktpreise-Abruf, Stufenskala, Steuerverlauf; Prod 56
- [2026-10-21](2026-10-21.md) — v2546–v2710: Gutachterprüfung E1–E11, Prüfstrecke Wertermittlung, IRW NRW, Beleihungswert, Register & Ernte, Flughandbuch, Messe-Schleife; Prod 57–60
- [2026-10-22](2026-10-22.md) — v2720–v2880: Baupreisindex Kaufzeitpunkt, Stufe N bei Zugangssperre, Marktbewertungskarte, Gewerbe, Wert & Zielbild, PDFs, Rechenwege; Prod 61–64
- [2026-10-23](2026-10-23.md) — v2880–v2943: Steuer-Tab neu (Splitting, Soli, KiSt, Verlustvortrag), PDF-Kurzfassung, Datenschutz, Support-KI, RND vier Stufen; Prod 65–67
- [2026-10-25](2026-10-25.md) — v2944–v2956: Wert & Zielbild, Pilot-Analyse N78, Portfolio-Cockpit neu (Einfach/Genau), Co-Pilot-Limit 10/20/50/100; Prod 68 + 2
- [2026-10-26](2026-10-26.md) — v2960–v2968d: Telegram-Bot mit Hilfe, Bewertung 1–3 und PDF-Dienst, MFH-Hausmaßnahmen (N80), Demo-Spiegel, Videothek mit Marcels Stimme
- [2026-10-27](2026-10-27.md) — v2969–v3015: stehende Prod-Freigabe, RND Variante 4, Bestandsmodus, Überführung GmbH, Gutachterpraxis, VGF bundesweit, IRW NRW; ~15 Rollouts
- [2026-10-28](2026-10-28.md) — v3016–v3029: Unterlagen lesen (Scans, WEG), Webinare, gültige PDFs, Jahreswerte/GENESIS, Einstellungen schlank, verlangbar/wirksam; Prod bis 1ab5490
- [2026-10-29](2026-10-29.md) — v3030–v3048: BRW-Schätzen raus, Leerstand rechnet, DSCR netto, Version 1.0.0, Stammdaten am Konto, Abschlag ≤ 10 %; Prod 1.0.0–1.0.11
- [2026-10-30](2026-10-30.md) — v3049–v3057a: Marktbericht-Import füllt fehlende Deal-Score-KPIs, Wertkarten (N84.4), BMF-Vergleichstafel (N85), Import parallel; nur Staging
- [2026-10-31](2026-10-31.md) — v3058 Exposé-Import mit führender Null in der PLZ (Nachtrag)

### November 2026

- [2026-11-02](2026-11-02.md) — v3059–v3060a: Mein Profil, Deal-Score-Reiter, Bewertung, Zeitdruck-Feld, Steuer im Objekt; Prod 1.0.12
