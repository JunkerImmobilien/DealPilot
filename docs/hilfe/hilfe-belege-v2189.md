# Belege zu hilfe-tief.json



# Belege — Topic „reiter“ (Die Reiter im Objekt)

Reiterleiste: frontend/index.html:983–991 (Objekt s0, Investition s1, Miete s2, Finanzierung s3, Bewirtschaftung s4, Steuer s3-tax, Pilot-Analyse s5, Bewertung s6, Deal-Aktion s8).

## Objekt
- frontend/index.html:1086–1100 — Labels PLZ, Ort, Straße, Hausnummer, Objektart, Wohnfläche (m²), Zimmer, Baujahr, Zustand der Wohnung
- frontend/index.html:1110, 1118, 1126 — Standardstufe (NHK 2010), Energieklasse, Vermietungsstand
- frontend/index.html:1050 — Eingabetiefe-Pillen „Einfach · Mittel · Ausgiebig“, Box „Marktbericht abrufen“
- frontend/js/objekt-reiter.js:596–604 — Stufennamen und Ein-Satz-Beschreibungen je Stufe
- frontend/js/objekt-reiter.js:507–532 — Pflichtfelder je Stufe (pflichtFuer)
- frontend/js/objekt-reiter.js:597–598, 674–679 — „N fehlt“, rote Umrandung #B8625C der fehlenden Pflichtfelder
- frontend/js/objekt-reiter.js:700–705 — Stufe 2 „ab Investor“, Stufe 3 „ab Pro“
- frontend/index.html (s0, Wertanker) — „Bankbewertung“, „Verkehrswert (§ 194 BauGB …)“, „Sofortiger Wertpuffer / Equity“
- frontend/js/calc.js:1183–1185 — Wertpuffer = Verkehrswert − Kaufpreis, nur angezeigt wenn > 0
- frontend/index.html (s0) — „Objektfotos (erscheinen im PDF · bis zu 6)“ (Satz wurde wegen Länge gestrichen)

## Investition
- frontend/index.html:1580–1598 — Kaufpreis, Makler/Notar/Grundbuchamt/Grunderwerbsteuer/Sonstige je (%) und (€), „Sonstige (%) · Bausachverständiger, Anfahrt, Gutachten“, Summe Nebenkosten
- frontend/js/main.js:51, 63–65 — Vorbelegung neuer Objekte: gba_p 0,50, gest_p 6,50 (ji_p 1,50, notar_p 2,20 aus Profil — nicht genannt)
- frontend/js/calc.js:871–881 — Euro-Eingabe rechnet Prozent nach (syncCostEur)
- frontend/js/calc.js:895–898 — Nebenkosten-Summe; Gesamtinvestition = kp + nk + san + moebl
- frontend/index.html:1608–1611 — Markt-Faktor (KP / Jahres-NKM), automatisch
- frontend/index.html:1627–1660 — Sanierung, „In Sanierungskosten übernehmen“, Sanierungskosten, „Angegebener Betrag — für die 15 %-Grenze“ brutto/netto, § 6 Abs. 1 Nr. 1a EStG
- frontend/index.html:1744–1746 — Inventarkosten „NICHT in der 15-%-Grenze. Separat … abgeschrieben“; 1770–1792 Küche, Möbel, Geräte …

## Miete
- frontend/index.html (s2, ab 1819) — „Mietpreis recherchieren“ + Erklärtext (Adresse + Wohnfläche, Mietausfall-Risiko, Übernahme per Klick)
- frontend/index.html (s2) — Mietstruktur: Nettokaltmiete / Monat, Zusätzliche Einnahmen / Monat (Stellplatz, Garage), Umlagefähige Kosten / Monat, Warmmiete
- frontend/index.html (s2) — Marktmiete (€/m²) DS2 „wird mit Ist-Miete verglichen für Upside-Score“
- frontend/index.html (s2) — Mietentwicklung: Modi „Prognose“, „Detail“, „Aus Wohnungen“; Mietsteigerung p.a.; Soll-Mietspiegel, Anzahl Erhöhungen, Intervall
- frontend/index.html:1954, 1985–1989 — mietstg, Prognose-Annahmen wertstg, kostenstg, leerstand, btj, exit_bmy
- frontend/js/main.js:99–102 — Mietsteigerung/Wertsteigerung/Leerstand aus dem Investmentprofil (Einstellungen) für neue Objekte

## Finanzierung
- frontend/index.html (s3, 2341ff.) — Darlehen I – Hauptdarlehen; Eigenkapital, Anfängl. Darlehenssumme, Zinssatz nominal (% p.a.), Tilgung (% p.a.), Zinsbindung (Jahre), Restschuld Ende Zinsbindung, Volltilgung (ca. Jahr); „Eigenkapital passend setzen“ / „Darlehen passend setzen“
- frontend/index.html:2717 + Text — „Eigene Anschlussfinanzierung für Darlehen 1“, „Konservativ rechnen: z.B. 5,0 % Zins und 1,0 % Tilgung“, „Ohne Häkchen läuft Darlehen 1 mit seiner Annuität weiter“
- frontend/index.html:2641–2643 — Art des Darlehens, Option „Tilgungsaussetzungsdarlehen (mit Bausparvertrag)“
- frontend/js/d1-type-handler.js:34–49 — bei Tilgungsaussetzung: BSV-Karte sichtbar, Tilgung = 0 und gesperrt
- frontend/index.html (s3) — Karte „Bausparvertrag Tilgungsaussetzung“: Bausparsumme, Sparrate / Monat, Mindestsparquote, Bauspardarlehen-Konditionen
- frontend/index.html:2796 — Darlehen II „Hinzufügen“; Optionen inkl. „KfW-Darlehen“

## Bewirtschaftung
- frontend/index.html (s4, 2910ff.) — Eingabe-Modus „Detailliert“ / „% der NKM“; Hinweis „Warum die Quote bei hohen Mieten überzeichnet“
- frontend/index.html (s4) — Umlagefähige Kosten / Jahr (Hausgeld umlagefähig, Grundsteuer), Nicht umlagefähige Kosten / Jahr (Hausgeld n.u., Eigene Instandhaltungsrücklage, Kalkulat. Mietausfall, Sonderverwaltung)
- frontend/js/bwk-profil.js STANDARD (Kopf, ~Z.30–36) — etw hg_qm 4,00, nul_pct 30, ruecklage_qm 0,50; efh verw 230, inst_qm 9,0, bk_qm 2,20; mfh verw 230, inst_qm 9,0, bk_qm 2,50; faktor 1,60
- frontend/js/bwk-profil.js ART/NAME — ETW→Eigentumswohnung; EFH/ZFH/DHH/RH→Ein-/Zweifamilienhaus; MFH→Mehrfamilienhaus
- frontend/js/bwk-profil.js vorschlag() — Verwaltung/Instandhaltung × Faktor („ImmoWertV Anlage 3“), jahresFaktor() aus /marktbericht/bwk/ansaetze
- frontend/js/bwk-profil.js leisteZeichnen() — „Standardwerte je Objektart“, „eigene Eingaben gehen immer vor“, „Anpassen in den Einstellungen unter „Investment-Profil““
- frontend/js/bwk-profil.js FELDER — Einheiten (€/m² · Monat, € je Wohnung · Jahr, €/m² · Jahr)

## Steuer
- frontend/index.html (s3-tax, 2000ff.) — Persönliche Steuer; „Zu versteuerndes Einkommen (zvE) vor Immobilie / Jahr“; „Persönl. Grenzsteuersatz (%)“; „Grenzsteuersatz automatisch aus zvE berechnen“; § 32a EStG
- frontend/index.html (s3-tax) — AfA-Satz-Optionen (2,0/2,5/3,0 linear, 5,0 degressiv), „Gebäudeanteil am KP (%)“ „Rest = Grundstücksanteil“, BMF-Rechner, Sonder-AfA § 7b „wird in der Berechnung NICHT angesetzt“ ohne Bestätigung
- frontend/index.html (s3-tax) — „Was mit diesen Werten passiert“: Differenz zweier Tarifberechnungen; Reihenfolge Kaufzeitpunkt; nur gespeicherte Bestandsobjekte
- frontend/index.html (s3-tax) — „Steuerformular pro Jahr“, „Belege & Abrechnungen einlesen (KI)“, „Keine Steuerberatung“

## Pilot-Analyse
- frontend/index.html:3065–3100 — Titel/Beschreibung, „Pilot-Analyse starten“, „Pilot-Analyse im PDF-Export einschließen“, Bausteine im PDF
- frontend/js/ui.js:679ff. — runAI: „Bitte zuerst Kaufpreis eingeben“
- backend/src/routes/ai.js:253–256 — „keine Kontingent-Sperre mehr — diese KI-Hilfe ist im Plan enthalten“

## Bewertung
- frontend/index.html (s6, 3115ff.) — „DealPilot Score entspricht exakt dem Boarding-Score — basiert auf Cashflow, Rendite, LTV, Risiko und Potenzial“; Investor Deal Score; Investor-Score Zusatzangaben „Eingabe direkt in den jeweiligen Tabs (Objekt, Investition, Miete)“
- Score-Stufen: Vorgabe aus brief.md / CLAUDE.md (js/score-tiers.js)
- frontend/js/calc.js:2026–2027 — bmy = NKM/KP, nmy = (NKM − nicht uml. BWK)/GI, Faktor = KP/NKM
- frontend/index.html (s3 Finanzierungsübersicht) — „Darlehenssumme ÷ Kaufpreis = LTV“; (s3) Checkbox „LTV inkl. Erwerbsnebenkosten berechnen (strenger, GI-Bezug)“
- frontend/index.html (s6) — DSCR „Brutto: NKM/Schulden · Netto: (NKM−NUL)/Schulden“; Cashflow vor/nach Steuern Heute / Ende Zinsbindung / Anschluss; „Cashflow – Korrekte Berechnung“

## Deal-Aktion
- frontend/js/deal-action.js:591–620 — renderTab, „In Gesellschaft überführen“ „Privat-Objekt einfrieren + neues GmbH-Objekt anlegen“
- frontend/js/deal-action-boarding.js:60–76 — Status Offen/Gewonnen/Verloren mit Untertiteln
- frontend/js/deal-action-boarding.js:110–113 — Investment-PDF (Fassungen Bankfassung, hell, Obsidian), Track Record
- frontend/js/deal-action-boarding.js:126–171 — Bänder „Dokumente & Exporte“, „Marktberichte“, „Bordkarte & Unterlagen“, „Unterlagen beim Amt anfordern“, „Dein Netzwerk“ („Geprüfte Partner — Objektdaten gehen mit“)

## Bewusst weggelassen
- Notar- (2,20 %) und Sonstige-Vorbelegung (1,50 %): kommen teils aus dem Profil, Bedeutung „notar_grundbuch“ unklar
- Partner-Banner im Reiter Deal-Aktion (Firmenname/Kontakt sind Whitelabel-abhängig)
- Ob „Mietpreis recherchieren“ Kontingent verbraucht — nicht geprüft
- Ampel-Schwellen der Kennzahlen-Bewertung, Kostensteigerungs-/Exit-Standardwerte
- Genaue Formel des Jahresfaktors (Server-Abruf, Rückfall 1,60) — nur „Jahresfaktor“ genannt


# Belege — Topic `quickcheck`

Vorab gemessen: Im QC-iframe (`frontend/quickcheck-app.html`) wird `js/quick-check.js` NICHT geladen (nur `index.html:3666`). Der Quick-Check-Code steht inline in `quickcheck-app.html` (Z. 3758–6485) plus die Kerne `score-tiers.js`, `qc-heuristik.js`, `dealscore.js`, `lage-profil.js` (Z. 6631–6688). Der AKTIVE Score ist `window._dpPilotScore` (Z. 7111) = `DealKpis.compute` → `DealScore.computeFromKpis`; `QcEngine.computeScore` (Z. 3851, Rendite/Cashflow/Sicherheit/Finanzierung/Effizienz 30/25/20/15/10) ist nur Rückfall (Z. 4166–4172) und wurde deshalb NICHT beschrieben.

## 1 · Eingaben und Pflichtfelder
- frontend/index.html:856 — Seitenleisten-Menü „Aktionen“
- frontend/index.html:793 — Eintrag „Quick Boarding“ (sbActionsAction('quickcheck'))
- frontend/quickcheck-app.html:3801-3814 — FIELDS: required true für plz, ort, wfl, kp, nkm, hg, hg_split, ek, zins, tilg (10)
- frontend/quickcheck-app.html:3459,3464,3492,3575,3591,3598,3622,3627,3632,3637 — Feldbeschriftungen wörtlich
- frontend/quickcheck-app.html:4225-4229 — gated: Bewertung erst bei allen Pflichtfeldern; 4237-4241 Score „–“
- frontend/quickcheck-app.html:4244 — „noch N Pflichtfeld(er) offen“; 6995 (qb-hstat übernimmt den Teil nach dem letzten „·“)
- frontend/quickcheck-app.html:4109-4122 — mieteAddUp: Summe der Bestandteile, nicht wenn NKM selbst getippt (dataset.userSet)
- frontend/quickcheck-app.html:3613-3619 — „Beleihung (LTV):“ 100/95/90/85/80 %
- frontend/quickcheck-app.html:4124-4140 und 6603-6625 (qc-autoek) — EK = KP×(1−LTV) + KP×10,5 %, nur wenn EK nicht selbst gesetzt
- frontend/quickcheck-app.html:6575-6584 — Zins/Tilgung aus Investmentprofil (nur wenn leer), hg_split aus bwk_anteil_default wenn leer oder „22“
- frontend/quickcheck-app.html:3599 — Vorgabe 22; 6531-6572 — Hausgeld-Schätzung (getHausgeldEstimate), eigener Wert (userSet) gewinnt
- frontend/js/settings.js:229,1192 — Einstellungs-Reiter „Standardwerte“ (Investmentprofil-Pane, settings.js:738-739)

## 2 · Der Score und seine fünf Teilnoten
- frontend/quickcheck-app.html:7111-7130 — _dpPilotScore: knk 10,5 %, darlehen = kp×(1+knk) − ek, DealScore.computeFromKpis; wp_kpi = Marktwert−KP wenn MW>KP; mstg 1.5
- frontend/js/dealscore.js:18-24 — DEFAULT_WEIGHTS cashflow 30, rendite 25, ltv 15, risiko 15, potenzial 15
- frontend/js/dealscore.js:28-50, 53-78 — Presets (Gewichte je Profil), gelesen aus dp_dealscore2_preset
- frontend/js/dealscore2.js:176-178 — Profil balanced heißt „Ausgewogen“
- frontend/js/dealscore.js:85-90 — Cashflow 50 + CF/4
- frontend/js/dealscore.js:92-97 — Rendite (NMR−2)×33,33 (2 %→0, 3,5 %→50, 5 %→100)
- frontend/js/dealscore.js:141-146 — LTV (110−LTV)×2,5
- frontend/js/dealscore.js:148-165 — Risiko DSCR 0,9→0, 1,0→60, 1,2→80, 1,5→100
- frontend/js/dealscore.js:167-175 — Potenzial 30 + min(60, Puffer%×3), +10 nur bei Mietsteigerung > 1,5 (QC übergibt 1,5 → nie)
- frontend/js/dealscore.js:234-242 — Labels „Cashflow“, „Rendite (NMR)“, „LTV“, „Risiko (DSCR)“, „Potenzial (Wertpuffer + Miete)“
- frontend/js/dealscore.js:250-255 — gewichteter Schnitt
- frontend/js/score-tiers.js:72 (stufe) + dealscore.js:263-268 — 85/70/50/35 Sehr gut/Gut/Solide/Schwach/Kritisch

## 3 · Kennzahlen und Zielwerte
- frontend/quickcheck-app.html:3373-3379 und 6903-6904 (qb-reskin4 KPI, die SICHTBARE Reihe) — Beschriftungen und Ziele „≥5%“, „≥3%“, „≥7%“, „≥0€“, „≥1,2“, „<90%“, „18–35%“
- frontend/quickcheck-app.html:3964-3977 — kpiClass: bmr ≤3 bad/≥5 good; nmr ≤1/≥3; ekr ≤0/≥7; cf ≤−100/≥0; dscr ≤1,0/≥1,2; ltv ≥105 bad/≤95 good; bwk >35 bad, ≥18 good
- frontend/quickcheck-app.html:7123-7128 — bmr/nmr/ltv aus DealKpis, bwkPct = bwk / NKM-Jahr
- frontend/quickcheck-app.html:5105-5125 — Kennzahlen speisen Pro/Achtung

## 4 · Lageklasse und Zielrendite
- frontend/quickcheck-app.html:3530-3541 — Feld „Lageklasse“, Optionen „– keine Angabe“, „A-Lage“, „B-Lage“, „C-Lage“, Hinweis „Vorgabe aus deinem Profil · überschreibbar“; Kommentar 3521-3528: nur der Kunde wählt
- frontend/quickcheck-app.html:6637-6672 — Vorbelegung aus Standardklasse, nur wenn Feld leer
- frontend/js/lage-profil.js (Kopf) — „A 3,5 · B 5,0 · C 7,0“, keine Ableitung aus der Makrolage; VORGABE {A:3.5,B:5.0,C:7.0}; zielBmr() Z. 186-195
- frontend/js/investment-profile.js:197-216 — „Lageklassen A · B · C“, „Zielrendite“ (Platzhalter „Pflicht“, „% brutto“), Mietausfall/Bewirt. n. uml./Eigenkapital (Platzhalter „Standard“), „Standard für neue Quick-Checks“
- frontend/js/qc-heuristik.js:216-225 — ZIEL_BMR_RUECKFALL = 6
- frontend/quickcheck-app.html:5408-5414 — zielBmr der gewählten Klasse in den Zielkaufpreis
- frontend/js/qc-heuristik.js:502-525, 557-562, 597-640 — Güte/Ampel/Worte: rot (<75 % des Ziels) „deutlich unter deinem Ziel“, gelb „knapp unter deinem Ziel“, grün „am Ziel“, ab q 1,15 „deutlich über deinem Ziel“
- frontend/quickcheck-app.html:5505-5525 — Experten-Meinung nutzt zielUrteil; ohne Klasse fester Text + „Gemessen am Bundesdurchschnitt …“

## 5 · Bewertung und Verhandlungs-Empfehlung
- frontend/quickcheck-app.html:3665 „Bewertung“, 3675-3678 „Verhandlungs-Empfehlung“, 3681 „Pro-Argumente“, „⚠ Achtung“, 3692 „Experten-Meinung“
- frontend/js/qc-heuristik.js:67 — SCHWELLE kaufen 75, verhandeln 60, kritisch 40
- frontend/js/qc-heuristik.js:318-450 — empfehlung(): KAUFEN / VERHANDELN (auch bei ≥75 und KP > Marktwert) / PRUEFEN (60–74 ohne Preishebel, schwächste Kennzahl) / KRITISCH / PASS
- frontend/quickcheck-app.html:5432-5443 — WORTE: „Starker Kauf — empfehlenswert“, „Kauf möglich — verhandeln nötig“, „Kauf möglich — genauer prüfen“, „Nur mit Nachbesserung tragfähig“, „Finger weg — weitersuchen“
- frontend/js/qc-heuristik.js:218-275 — zielKaufpreis = min(NKM×12/Ziel, KP bei Cashflow 0 (Näherung), bereinigter Marktwert); ≥ KP → KP
- frontend/js/qc-heuristik.js:115-153 + quickcheck-app.html:5380-5383 — Angebotsabschlag 10 % (Preisart „unbekannt“)
- frontend/quickcheck-app.html:5446-5458 — „Argumente für das Gespräch“ bei VERHANDELN/KRITISCH (nicht im Hilfetext ausgeführt)
- frontend/quickcheck-app.html:5673-5698 — KI-Analyse startet automatisch bei vollständigen Pflichtfeldern (1,8 s Ruhe); 5642-5645 Rückfall „Lokale Heuristik“; 5257

## 6 · Marktpreis, Exposé und Sprache abrufen
- frontend/quickcheck-app.html:3394 — „QUICKBOARDING PASS“; 3396-3399 Kachel DealPilot (title „Marktpreisbewertung“), Gruppe „Marktbewertung“
- frontend/quickcheck-app.html:3409-3412 — „Exposé / Marktbericht“; 3413-3416 Sprache (title „im Plan enthalten“)
- frontend/js/immometrica-qc.js:95-98 — Sprachkachel heißt „Sprache“; 80-107 ImmoMetrica-Kachel, ohne Zugang Hinweis „bitte Zugang in den Einstellungen speichern“
- frontend/quickcheck-app.html:7266-7267 (qc-kartei-angleich, v1693) — Kacheln spr/ph ausgeblendet
- frontend/quickcheck-app.html:6050-6059 — „1 Bewertung … aus deinem Kontingent verbraucht“
- frontend/quickcheck-app.html:6169-6243 — Reihenfolge voice, expose, immometrica, ph, spr, dpmb; Pause mit „Weiter“ (6144-6167); dpmb braucht PLZ oder Ort (6135-6138)
- frontend/quickcheck-app.html:4880-4935 + 6240 — nach dem Abruf Marktmiete (Spanne) in qc_nkm_grund, mieteAddUp
- frontend/quickcheck-app.html:6302-6316 — DealPilot-Ergebnis wird _avmResults[0] → Marktwert für Potenzial (7121) und Zielkaufpreis (5372-5383)
- frontend/quickcheck-app.html:6245-6261 — Knopf wird „Neuer Vorgang“, setzt alles zurück (mit Rückfrage)

## 7 · Als Objekt speichern
- frontend/quickcheck-app.html:3700-3705 — „Als Objekt speichern“ (disabled bis Pflichtfelder); 4290-4300 Freigabe
- frontend/quickcheck-app.html:5788-5815 — im iframe: postMessage qc-save-open an die Haupt-App (Standalone-Dialog „Welche Daten übernehmen?“ Z. 3714 nur ohne Elternfenster)
- frontend/js/qc-bridge.js:457-467 — Overlay „Diese Daten werden übernommen“, Reiter „Übernahme“ / „Ausgelesene Daten“, „Spanne“ Unten/Ø/Oben, „Alle übernehmen“, „Abbrechen“, „Speichern & übernehmen“
- frontend/js/qc-bridge.js:440-447 — „Bereits im Quickboarding gesetzt“ + ausgelesene Zusatzdaten
- frontend/js/qc-bridge.js:430 — Leertext „Keine Markteinschätzung im QuickBoarding — Marktwert und Miete holst du im Objekt über „Abrufen““
- frontend/js/qc-bridge.js:20-23, 193-199 — neues Objekt (newObj), geladenes nicht überschrieben
- frontend/js/qc-bridge.js:227-233 — Fotos; quickcheck-app.html:3648 „max 6“
- frontend/js/qc-bridge.js:247 — Marktwert → svwert (Verkehrswert) nur wenn angehakt


# Belege — Topic `marktbericht`

Pfade relativ zu E:\DealPilot\repo.

## 1 Die drei Stufen und der Abruf
- frontend/index.html:1050 — „Eingabetiefe“, Pillen, Box „Marktbericht abrufen“, Fuß „Jeder Abruf landet im Verlauf und steht am Verkehrswert zur Übernahme.“, Knopf „Im Marktbericht öffnen →“
- frontend/js/objekt-reiter.js:700-703 — Kachelnamen und Sätze „Einfach · Stufe 1“ / „Mittel · Stufe 2“ / „Ausgiebig · Stufe 3“ (wörtlich übernommen)
- frontend/js/objekt-reiter.js:705 — `ab = { 2: 'ab Investor', 3: 'ab Pro' }`
- frontend/js/objekt-reiter.js:716 — Anzeige „N frei“, Knopf „was fehlt“ / „abrufen“
- frontend/js/objekt-reiter.js:546-548 — „Für Stufe N fehlt noch:“, Klick springt zum Feld, „der Bericht rechnet nie halb“
- frontend/js/objekt-reiter.js:497-526 — Pflichtfelder je Stufe (pflichtFuer)
- marktbericht/backend/src/services/ReportOrchestrator.js:1211-1235 — Stufe < 3: Boden-, Ertrags-, Sachwert „nicht im Umfang“
- backend/src/services/aiCreditsService.js:47-53, 78 — Kontingent je Art (mpi/mpi_plus/wev = Stufe 1/2/3) je Plan
- backend/src/routes/marktbericht.js:100-121 + aiCreditsService.js:499-529 — bezahlte Stufe je Objekt: gleich/niedriger = 0, höher = eine Bewertung der Zielstufe

## 2 Lauf im Hintergrund
- frontend/js/mb-auftrag.js:38-47 — acht Etappen (Namen wörtlich)
- frontend/js/mb-auftrag.js:24-25 — Balken zählt abgehakte Etappen, keine erfundene Zeit
- frontend/js/mb-auftrag.js:226 — „In der Warteschlange — Platz N“
- frontend/js/mb-auftrag.js:220-222 — Stufe 1 (Schnellmodus): Makrolage „nicht im Umfang“ (nicht in den Text übernommen, nur Hintergrund)
- frontend/js/mb-auftrag.js:140-141 — Knopf „Im Hintergrund weiter“, Satz „Du kannst weiterarbeiten …“
- frontend/js/mb-auftrag.js:84, 174-176 — Pille bottom 76px, mittig; Texte „Marktbericht in Arbeit · …“, „✓ Marktbericht fertig · … — öffnen“, „⚠ Marktbericht nicht erstellt · …“
- frontend/js/mb-auftrag.js:183-205 — Öffnen lädt das Objekt und übernimmt das Ergebnis bzw. öffnet den Marktbericht
- frontend/js/mb-auftrag.js:28-31 — Tab zu: Server rechnet zu Ende, Buchung erst bei Ergebnis
- frontend/js/mb-auftrag.js:271-289 — Nachsehen im Verlauf, Abbruch nach 15 Minuten („Kein Ergebnis im Verlauf gefunden.“)
- frontend/js/mb-auftrag.js:252 — Toast „⚠ Marktbericht nicht erstellt: <Grund>“

## 3 Alte Berichte wiederfinden
- frontend/js/deal-action-boarding.js:136 — Band „Marktberichte“ / „Erzeugte Berichte als PDF“
- frontend/js/deal-action-boarding.js:1024-1046 — neueste zuerst, Datum · Uhrzeit, Marktwert, Knopf „PDF“, ✕ „Bericht endgültig löschen“
- frontend/js/deal-action-boarding.js:1048-1056 — OFFEN = 3, „N weitere anzeigen“
- frontend/js/deal-action-boarding.js:1058-1077 — ab 2 Berichten: Entwicklung + Knopf „Verlauf ansehen“
- frontend/js/deal-action-boarding.js:1033-1036 — „Noch keine Marktberichte …“ + „Marktbericht erstellen“
- frontend/js/deal-action-boarding.js:1229-1240 + frontend/index.html:989 — „Verlauf ansehen“ klickt Reiter „Pilot-Analyse“ und Unter-Reiter
- frontend/js/ui.js:2106 — Unter-Reiter „Marktbericht-Verlauf“
- frontend/js/ui.js:3074-3077 — sichtbar erst ab 2 Berichten mit Marktwert
- frontend/marktbericht-app/index.html:635 — „Marktwert-Verlauf dieses Objekts“
- frontend/marktbericht-app/app.js:1842-1851 — „Erster gespeicherter Stand …“, Reihen Marktwert und Deal-Score

## 4 Verkehrswert übernehmen
- frontend/index.html:1402-1405 — Karte „Wertanker“, Feld „Verkehrswert“, Box #oe-vw darunter (Reiter Objekt, sec s0 ab Z.1048)
- frontend/js/objekt-reiter.js:893-903 — je Bericht eigene Einträge Ertragswert/Sachwert/Marktwert; Marktwert nie führend
- frontend/js/objekt-reiter.js:907 — neueste zuerst
- frontend/js/objekt-reiter.js:915-918 — Optionstext „Art · Datum · Betrag €“, „· führend“, Grund im title
- frontend/js/objekt-reiter.js:923 — Knopf „als Verkehrswert übernehmen“
- frontend/js/objekt-reiter.js:250-261 — „Unterschied zum Bericht vom …“ / „Rechenweg identisch …“
- frontend/js/objekt-reiter.js:946-950 — Wert ins Feld, input/change-Events, calc()
- frontend/js/objekt-reiter.js:872-877 — welche Zahl gilt, entscheidet der Sachverständige, nicht die Software

## 5 Bodenwert und Bodenrichtwert
- marktbericht/backend/src/services/ErtragswertService.js:62-71, 129-131 — Fläche × Bodenrichtwert, Hinweise bei Fehlen
- marktbericht/backend/src/services/ErtragswertService.js:134-140 — GFZ nur mit Koeffizient, „Wir erfinden keinen“
- marktbericht/backend/src/services/ErtragswertService.js:142-159 — Anpassung Zuschnitt/Lage, Erschließungsbeitrag
- marktbericht/backend/src/services/ErtragswertService.js:179-197 — ETW ohne MEA: kein Bodenwert, Hinweis „Teilungserklärung, meist als Bruch wie 125/1000“
- marktbericht/backend/src/connectors/boris/registry.js:611-621 — BORIS zuerst, Rückfall auf DealPilot-Eingabe („brw“)
- marktbericht/backend/src/services/DealPilotObjectMapper.js:203 — land_value_manual = Feld `brw`
- frontend/index.html:1153-1170 — Feld „Bodenrichtwert (€/m²)“, Knöpfe „Bodenrichtwert abrufen“ (title „gratis (Open Data)“), „BORIS-Portal“, „Bodenrichtwert schätzen“ (title „bitte trotzdem auf BORIS verifizieren“)
- frontend/index.html:1555-1560 — Block „Ansätze des Sachverständigen“, „Bodenwert-Anpassung (%)“, „Begründung der Anpassung“
- frontend/marktbericht-app/app.js:766-768 — „kein amtlicher Bodenrichtwert verfügbar“; app.js:770-790 Strich + Grund bei fehlendem Bodenwert

## 6 Ertragswert
- marktbericht/backend/src/services/ErtragswertService.js:241-244 — Verfahren, §§ 27–34 ImmoWertV 2021
- ErtragswertService.js:261-279 — Rohertrag inkl. Stellplätze
- marktbericht/backend/src/services/CrossCheckService.js:752-760, 796 — Miete aus Angebotsmieten oder Mietpreisübersicht des Ausschusses; Rohertrag = Miete/m² × Wfl × 12
- ErtragswertService.js:285-295 — Ist-Miete nur Hinweis (ab 10 % Abweichung)
- CrossCheckService.js:943-977 — BWK-Rangfolge: Quote des Ausschusses auf gesamten Rohertrag inkl. Stellplätze → Pauschale (BWK_QUOTE 0,23) → normiert Anlage 3
- ErtragswertService.js:309-321 — Zeilentitel „(… Angabe des Gutachterausschusses)“ / „(eigene Kalkulation)“
- ErtragswertService.js:330-331 — Verwaltung je bewerteter Einheit (ETW = 1)
- ErtragswertService.js:352-357 + lib/immowertv.js:92-127 — Anlage-3-Ansätze zum Stichtag (BWK_JAHRE, bwkAnsaetze)
- ErtragswertService.js:404-412 — Liegenschaftszins, Rückfall § 256 BewG Stufe D
- ErtragswertService.js:420-433 + 160-169 — nur rentierlicher Bodenwert verzinst (§ 41)
- ErtragswertService.js:443-460 + 465 — RND (Anlage 2 aus Punkten bzw. Rückfall mit Hinweis), Barwertfaktor
- marktbericht/backend/src/services/CrossCheckService.js:212-213 — Hinweistext „Restnutzungsdauer geschätzt (Gesamtnutzungsdauer minus Alter) — Anlage 2 ImmoWertV wurde nicht angewandt.“
- ErtragswertService.js:487-503 — + Bodenwert, besondere objektspezifische Merkmale
- ErtragswertService.js:251-257 — ohne Bodenwert: vereinfachtes Verfahren ohne Bodenwerttrennung + Warnung
- CrossCheckService.js:781-786, 985-1003 — EFH/ZFH ohne erfasste Miete: Wert unterdrückt, Rechenweg bleibt

## 7 Sachwert
- marktbericht/backend/src/lib/nhk2010.js:816-834 — NHK-Kennwert × BGF, × Baupreisindex, × Regionalfaktor, Bauteile
- marktbericht/backend/src/services/CrossCheckService.js:73-74 — BAUPREISINDEX = 1.91, Stichtag 2026-01-01, Konstante
- frontend/js/objekt-reiter.js:380 (automatik) — Leiste „Baupreisindex … Konstante 2010 → Stichtag · noch nicht je Ausschuss“
- nhk2010.js:864 — „− Alterswertminderung (GND−RND von GND Jahren)“
- nhk2010.js:872-952 — besondere Bauteile, Garage, Außenanlagen, „= Gebäudesachwert“
- nhk2010.js:965-969 — „+ Bodenwert“, „= vorläufiger Sachwert“
- nhk2010.js:1012-1013 — „× Sachwertfaktor“, „= marktangepasster Sachwert“
- CrossCheckService.js:347-354, 419-470 — Faktor aus Tabelle am vorläufigen Sachwert (zwei Läufe), zuständiger Ausschuss nach Gemeindeschlüssel
- CrossCheckService.js:500-509 — GND aus Modell des Ausschusses, sonst Anlage 1; § 21 Abs. 3
- frontend/js/objekt-reiter.js:506-523 — Stufe-3-Pflicht: nutzungsart, gsfl, brw, bgf, standardstufe; ETW mea; Häuser nhk_haus/nhk_geschosse/nhk_dach
- frontend/js/objekt-reiter.js:489-492 — Feldnamen „Hausform (NHK)“, „Geschosse und Unterkellerung“, „Dachausbildung“
- CrossCheckService.js:645-686 — Gewerbe/Garage kein Sachwert; Objekttyp fehlt; ETW ohne BGF/Standardstufe mit Grund

## 8 Herkunft, Quellennachweis und fehlende Werte
- frontend/js/objekt-reiter.js:93-95 — Stufen-Legende A–E (wörtlich)
- marktbericht/backend/src/services/WertParameterService.js:1-12, 404-450 — Kaskade, Stufe D = § 256 BewG
- marktbericht/backend/src/lib/immowertv.js:228-236 — Hinweis „Gesetzlicher Auffangwert … NICHT marktabgeleitet“
- marktbericht/backend/src/lib/quellen_links.js:451-477 — Satz „… führt <Stelle>“, kostenfrei / kostenpflichtig, URL
- frontend/marktbericht-app/app.js:804-816, 907-920 — Satz + Link „zur Quelle“ unter Zins und Sachwertfaktor, immer (nicht nur bei fehlender Zahl)
- CrossCheckService.js:526-535 — „Standardwert 1,0 — ohne Marktanpassung“, „Herstellungskostenrechnung, kein Marktwert“
- frontend/marktbericht-app/app.js:897-900 — Karte „vorläufig · Sachwertfaktor 1,0 (Standard, ohne Marktanpassung)“
- CrossCheckService.js:30-35 — Sachwertfaktor: kein Treffer = kein Wert, nie Nachbarkreis, nie Landesmittel
- CrossCheckService.js:1248-1294 — Quellennachweis nur für tatsächlich verwendete Sätze, entdoppelt, Jahrgang
- frontend/marktbericht-app/app.js:941-960 — Block „Quellennachweis“, Kennzahlen, „Berichtsjahr“, Lizenz
- frontend/index.html:1177 — Leiste „Parameter der Verkehrswertermittlung · nach ImmoWertV, nur für Stufe 3“


# Belege — cockpit / einstellungen

Alle Pfade relativ zu `frontend/`.

## Topic cockpit

### Aufbau: neun Abschnitte
- js/dashboard.js:2340-2403 — Sektionsköpfe 01 Portfolio Score … 09 Jahresabschluss (Wortlaut der h2)
- js/dashboard.js:2341 — Auswahl „Objekt“ (#dp-dash-objsel), Halter-Chips (#dp-halter-filter)
- js/dashboard.js:585 — Option „Alle Objekte (n)“
- js/dashboard.js:206-212, 261-266 — Einzelobjekt-Auswahl filtert Aggregation auf ein Objekt (wonList)
- js/mandanten.js:124-132 — Halter-Chips nur bei Pro (`_isPro`), „Alle“ + Mandantenliste
- js/dashboard.js:1952-1966 — Board-Spalten „In Prüfung“, „Gewonnen“, „Verloren“
- js/dashboard.js:3166-3167 (Block ab 3128) — Knöpfe „Verlängern“, „Beenden“; Leertext nennt „Quick Boarding teilen“

### Portfolio Score
- js/dashboard.js:81, 76-80 — nur Stufe „won“ (gewonnen)
- js/dashboard.js:84-88 — Score je Objekt: ds2_score_persist (Investor) vor dealpilot_score
- js/dashboard.js:268-285 — Gesamt = kaufpreisgewichtetes Mittel (w = kaufpreis)
- js/dashboard.js:300-319 — fünf Kategorien (Rendite, Finanzierung, Risiko & Vermietung, Lage & Diversifikation, Upside-Potenzial), ebenfalls kaufpreisgewichtet
- js/dashboard.js:385 — Leertext „Noch kein gewonnenes Objekt mit berechnetem Score.“
- js/dashboard.js:91-99 + CLAUDE.md-Kette — Stufe aus ScoreTier (85/70/50/35)
- js/dashboard.js:392-393, 425 — „Details & alle KPIs“ (Investor) / „x / y bewertet“

### Kennzahlen
- js/dashboard.js:609-627 — Kachel Bestand/Ankauf-Stand, Umschaltung nur bei eingefrorenen Ständen, „netto kalt“
- js/dashboard.js:628 — Investition mit/ohne NK, Restschuld
- js/dashboard.js:629 — Bruttomietrendite „Jahresmiete / KP“, Nettomietrendite „nach BWK“
- js/dashboard.js:630 — Cashflow / Monat, / Jahr, Klick vor/nach Steuer
- js/dashboard.js:653-683 — Kachel „Seit Ankauf“: Besser/Schlechter „am DealScore“
- js/dashboard.js:697-705 — Health-Reihe erst ab Investor-Plan (Sperrtext)
- js/dashboard.js:770-791 — Eigenkapital-Rendite (Cash-on-Cash / ROE), Ø-Zinssatz ↔ Zinsbindungs-Risiko (< 3 J.), DSCR „Ab 1,2 komfortabel“, Tilgungsfortschritt

### Steuer über alle Objekte
- js/dashboard.js:2350-2357 — Tag-Tooltip: echte steuerliche Ergebnisse, Reihenfolge des Kaufs, Gesellschaften getrennt
- js/dashboard.js:1644-1647 — Leertext: Objekt muss im Tab Steuern gerechnet und gespeichert sein
- js/dashboard.js:1666-1670 — „Einkommensteuer · § 32a“ / „Körperschaftsteuer … proportional“
- js/dashboard.js:1717-1739 — Tabellenspalten, Pfeil ↓ „Dieses Objekt hat deinen Grenzsteuersatz gesenkt“
- js/dashboard.js:1706-1712 — „nicht hinterlegt“ → Einstellungen / Mandanten
- js/dashboard.js:1743-1751 — Fußtexte privat / Gesellschaft

### Projektion & Verlauf / Gesamt-Projektion
- js/dashboard.js:2358 — Tooltip mit den Annahmen (+1,5 / +2,0 / +2,0 / AfA 2,0 % bei 80 % / ~3,5 %), Knöpfe 10 J./20 J./30 J., „ein-/ausblenden“
- js/dashboard.js:2360-2368 — sieben Grafiken (Titel wörtlich)
- js/dashboard.js:2370 — Abschnitt 07 Modellprojektion
- js/dashboard.js:1840-1842 — Tabellenspalten

### Steuer-Mappe
- js/dashboard.js:2379-2390 — Text, „Veranlagungsjahr“, „Anlage-V-Zuordnung anhängen“, „Steuer-Mappe erstellen“, Hinweis amtliches Formular
- js/dashboard.js:2655-2690 — Jahresliste nur aus vorhandenen Steuerdaten, „n Objekte“, Vorauswahl letztes abgeschlossenes Jahr, „keine Steuerdaten erfasst“ sperrt Knopf

### Jahresabschluss
- js/dashboard.js:2403-2414 — Text, Gesellschaft, Geschäftsjahr, „Jahresabschluss erstellen“, HGB-Hinweis, Verrechnungskonto Gesellschafter, Kosten der Gesellschaft
- js/dashboard.js:2738-2756 — Abschnitt nur bei Mandant mit Rechtsform GmbH/UG

## Topic einstellungen

### Die Reiter im Überblick
- js/settings.js:189-270 — Reitertitel und Untertitel wörtlich
- js/settings.js:1187-1200 — Kurzbeschreibungen (Standardwerte: „Vorgaben, die in jede Kalkulation einfliessen“, Datenraum: „Geteilte Objekte und Portfolio-Pässe“)
- js/settings.js:738-748 (Kommentar v1355) — Darstellung ändert keine Zahl
- js/settings.js:964-968 — „Auto-Save aktiv · …“, „Abbrechen“, „Speichern“
- js/settings.js:982-986 — Esc schließt
- js/settings.js:295, 323, 338, 350 — Account-Info, Passwort ändern, 2FA, Account löschen
- js/telegram-panel.js:52-63 — Telegram hängt im Pane „account“

### Co-Pilot (KI) und Kontakt & Logo
- js/settings.js:463 — gilt für KI-Lage, Quick-Check, Investor Deal Score AI
- js/settings.js:465-500 — Detailgrad (kurz/mittel/ausführlich), Tonalität (sachlich/beratend/kritisch), Fokus-Schwerpunkte, Eigene Anweisungen
- js/settings.js:513-519 — Eigenes Wissen für alle Piloten (Pilot-Analyse, Portfolio-Pilot, Telegram-Bot; keine sich ändernden Zahlen)
- js/settings.js:533-560 — Standard-Analyseparameter, pro Objekt im KI-Tab überschreibbar
- js/settings.js:374 — Kontaktdaten im PDF-Footer und auf Track-Records
- js/settings.js:429-440 — Eigenes Logo für PDFs, „Logo hochladen“, PNG 300×100 px

### Deal Score
- js/settings.js:655-680 — fünf Regler (Beschriftungen wörtlich), range 0–60, „↺ Standard wiederherstellen“
- js/dealscore.js:18-24 — Standard 30/25/15/15/15
- js/dealscore.js:314-318 — Summe muss 100 % ergeben
- js/settings.js:694-695 — Investor Deal Score, 24 KPIs, Investor/Pro
- js/dealscore2.js:172-300 — Profile Ausgewogen, Konservativ, Optimistisch, Lage-Fokus, Cashflow-Fokus, Sicherheit
- js/dealscore2-ui.js:765-766, 789, 800, 809, 818-819 — Bewertungsprofil, Benutzerdefiniert, Haupt-/Untergewichtungen, Grenzwerte-Format „4:20, 5:50, 7:80, 9:100“
- js/dealscore.js:28-77 — Kopplung: DS1 nimmt PRESET_WEIGHTS des aktiven DS2-Profils; eigene Gewichte nur bei Preset „custom“

### Standardwerte
- js/investment-profile.js:241 — Vorbelegung bei jedem neuen Objekt, pro Objekt überschreibbar
- js/investment-profile.js:243-250 — Finanzierung (Zinsbindung 5/10/15/20, Pfandbrief-Satz, Zins-Stufe, EK % v. KP)
- js/investment-profile.js:252-263 — Bewirtschaftung (ul/nul % NKM, Mietausfall, Hausgeld)
- js/investment-profile.js:279-285 — Mindest-Schwellen als farbliche Marker
- js/investment-profile.js:287-289 — Grenzsteuersatz
- js/investment-profile.js:218-238, 292-297 — Bundesland mit GrESt-Satz, Notar & Grundbuch, Maklergebühr
- js/investment-profile.js:303-304 — „Profil speichern“, „Auf Defaults zurücksetzen“

### Lageklassen und Bewirtschaftung je Objektart
- js/lage-profil.js:84 — Vorgabe A 3,5 / B 5,0 / C 7,0
- js/lage-profil.js:86-90 — A-Lage/B-Lage/C-Lage
- js/investment-profile.js:197-215 — Felder je Klasse, Hinweistext, „Standard für neue Quick-Checks“
- js/investment-profile.js:322-330 (Kommentar) — Lagefelder speichern sofort
- js/bwk-profil.js:203-215 — Felder je Objektart
- js/bwk-profil.js:67 — Namen Eigentumswohnung / Ein-/Zweifamilienhaus / Mehrfamilienhaus
- js/bwk-profil.js:224-232 — Hinweistext, Fortschreibungsfaktor 1,60 ab 01.01.2026, jährlich zum 1. Januar
- js/bwk-profil.js:242 — Toast „✓ Standardwert gespeichert“

### Darstellung und Tooltip-Hilfe
- js/settings.js:772-807 — Aussehen: Layout, Objektkarten, Kartenstil
- js/settings.js:868-869 — „Zurücksetzen“: Aufteilung, Darstellung und Marke
- js/settings.js:874-880 — Markt-Daten-Cards standardmäßig zugeklappt
- js/settings.js:889-895 — Score-Leiste standardmäßig minimiert
- js/settings.js:901-907 — Quickboarding — Auto-Übernahme, Standard-Quelle „Konsens (Ø aller aktiven)“ (die übrigen Optionen nennen Anbieter → bewusst nicht zitiert)
- js/settings.js:911-917 — Objektfotos einbeziehen
- js/settings.js:924-940 — Tooltip-Hilfe Aus/Profi/Anfänger, Profi behält kritische Hinweise (§ 7b)
- js/tooltip-engine.js:27 — DEFAULT_MODE = 'beginner'
- js/settings.js:944-951 — Marktbericht-Design Hell/Dunkel

### Mandanten und Steuerzeiträume
- js/mandanten.js:704-709 — Hinweis Halter, „Neuer Mandant“
- js/mandanten.js:589 — Privat in allen Plänen, GmbH/UG ist Pro
- js/mandanten.js:614-690 — Objektliste je Mandant
- js/mandanten.js:595 / 697 — „Bearbeiten“
- js/mandanten.js:934-940 — Privat-Formular hostet die Steuerzeiträume
- js/tax-periods.js:156-190 — „Gültig von“, „Gültig bis (leer = laufend)“, „zvE / Jahr (€)“, „Grund“, „Notiz (optional)“, Zuordnung nach Kaufdatum/wirtschaftlichem Übergang
- js/tax-periods.js:307-312, 326-341 — Überschneidungs-Konflikt
- js/mandanten.js:869-930 — Identifikation, KSt + Soli 15,825 %, GewSt-Hebesatz, erweiterte Kürzung, Buchhaltung, Kosten der Gesellschaft
- js/mandanten.js:710-712 — „Überführung starten“

### Telegram-Bot
- js/telegram-panel.js:90-104 — Funktionsbeschreibung, BotFather-Schritte
- js/telegram-panel.js:119-133 — Einwilligung (VAE, nicht Ende-zu-Ende-verschlüsselt)
- js/telegram-panel.js:139-141 — „Bot verbinden“
- js/telegram-panel.js:180 — „Bot entfernen“
- js/telegram-panel.js:199-201 — „Stilllegen“, „Trennen“
- js/telegram-panel.js:221-230 — /start + Code, „Verbindungscode erzeugen“
- js/telegram-panel.js:332 — Trennen löscht Chatverlauf

### Plan und Kontingent
- js/settings.js:2153, 2177 — „Dein Kontingent“
- js/ai-credits.js:31-35 — MPI / MPI+ / WEV mit Langnamen
- js/ai-credits.js:338-366 — Zellen „… im Monat · … dauerhaft“, Marktwert „zugekaufte Abrufe“
- js/ai-credits.js:378-380 — Monatskontingent verfällt, Zugekauftes nie
- js/ai-credits.js:393 — Zurücksetzung am 1. des Monats
- js/ai-credits.js:402 — „Bewertungen nachkaufen“ öffnet das Preisfenster
- js/settings.js:2152-2155 — Kaufblock bei bezahlten Plänen
- js/settings.js:2074-2077, 2108-2110 — Bewertungspakete, „Oder einzeln …“, Einzelpreis höher


# Belege: Topics `import` und `steuer_tief`

Pfade relativ zu `E:\DealPilot\repo\frontend\`.

## import

### Wo du Import und Export findest
- index.html:848 — Seitenleisten-Knopf „Aktionen“ (aria-label „Aktionen-Menü öffnen“)
- index.html:796-797 — Eintrag „Import“ (sbActionsAction('hub-import')), Abschnitt „Anlegen“ davor
- index.html:805-814 — Abschnitt „Ausgeben“: Track Record, Bankexport, Export
- js/ui.js:2658-2659 — hub-import/hub-export → openImportHub/openExportHub
- js/import-export-modal.js:131-135, 238-243 — Titel „Daten importieren“ / „Daten exportieren“
- js/deal-action-boarding.js:130 (Block ab 120) — „PDFs herunterladen“ · „Investment, Finanzamt (Steuer) & Track Record — mit den aktuellen Objektdaten“
- js/deal-action-boarding.js:110-113, 220-222, 258 — Zeilen Investment-PDF, Finanzamt-PDF (Steuerformular), Kaufpreisaufteilung (Finanzamt), Track Record
- index.html:991 — Reiter „Deal-Aktion“
- js/layout-varianten.js:194 — Ansicht „Tower“: „Aktionen links, Score und Ausgaben rechts“
- js/layout-varianten.js:309-317 — Ausgaben-Liste (Exposé / Gesamt-PDF, Bankfassung, Marktbericht „Als PDF, wenn einer vorliegt“, Kaufpreisaufteilung · BMF, Finanzamt-PDF art 'jahr', Track Record, Export)
- js/layout-varianten.js:436 — „Finanzamt-PDF — welches Jahr?“

### Daten importieren: die drei Karten
- js/import-export-modal.js:81-95 — Karte „Dokument einlesen“, neun Arten
- js/import-export-modal.js:97-111 — „Excel-Kalkulation importieren“, aktuell geöffnetes Objekt, ImmoKalk / immocation Roter Faden / immocation Pro, Überschreib-Warnung
- js/import-export-modal.js:113-126 — „JSON-Backup importieren“, gleicher Name wird überschrieben, „Stripe/Plan-Daten sind nicht enthalten — nur Objekte“
- js/storage.js:2598-2602 — verschlüsseltes Backup: Passwortabfrage beim Import

### Exposé oder Marktbericht einlesen
- quickcheck-app.html:3410-3413 — Kachel „Exposé / Marktbericht“ (Gruppe „Daten einlesen“)
- quickcheck-app.html:3424 — Knopf „Abrufen“
- quickcheck-app.html:6189-6193 + js/quick-check.js:2082-2090 — Exposé-Schritt ruft den PDF-Import im Hauptfenster
- js/pdf-import.js:62-73 — „PDF-Exposé importieren“, „ImmoScout, Kleinanzeigen, Maklerexposés“, „PDF-Datei, max 100 MB“
- js/pdf-import.js:134-136, 209-232 — OCR-Rückfall (Texterkennung) bei Scan-PDFs
- js/pdf-import.js:765-783 — ausgelesene Felder (Kaufpreis, Wohnfläche, Baujahr, Nettokaltmiete, Hausgeld …)
- js/pdf-import.js:877-917 — Fotos „werden mit übernommen“ (Haken), „Daten erkannt“, „Ausgewählte übernehmen“
- js/object-actions.js:381, 398-410 — Pre-Flight-Kachel „Exposé / Marktbericht“ und „Abrufen“ im Objekt
- js/object-actions.js:363 — Leiste heißt „PRE-FLIGHT“ / „Daten einlesen“ (379)
- js/object-actions.js:1963-1964 — „Exposé & Marktbericht importieren“, mehrere PDFs, Typ umstellbar, „Marktbericht führt bei Konflikt“, OCR

### Gutachten und Auszüge lesen
- js/dokument-import.js:75-82 — Titel, Arten, „PDF auswählen“
- js/dokument-import.js:124-129 — Scan: „Texterkennung ist für diesen Weg noch nicht eingebaut“
- js/dokument-import.js:152-164 — Auswahl bei unklarer Art
- js/dokument-import.js:174 — „Erkannt als … (… % Trefferquote im Stichwortabgleich)“
- js/dokument-import.js:192-218 — „Fehlende Pflichtangaben“, „Unplausible Werte verworfen“, „Gelesene Angaben“, „Ergebnis des fremden Gutachtens“ (nicht übernommen)
- js/dokument-import.js:222 — „Rohdaten anzeigen“
- js/import-export-modal.js:92-93 — „Fremde Gutachten liefern Eingaben, keine Ergebnisse“
- HINWEIS: Das Fenster hat KEINEN Übernehmen-Knopf; der Hilfetext sagt deshalb nur „zeigt“.

### Belege einlesen (KI)
- js/deal-action-boarding.js:264-267 — Knopf „Belege“ (kpa_ak) in der Zeile Kaufpreisaufteilung
- js/deal-action-boarding.js:789-795 — kpa_ak → DealPilotBelegImport.open('ak')
- index.html:2316-2328 — Knopf „📎 Belege & Abrechnungen einlesen (KI)“ im Reiter Steuer, Hinweistext Hausgeld/Rücklage
- js/beleg-import.js:22-25, 30-43 — AK-Kategorien und Zielfelder
- js/beleg-import.js:73-99 — WK-Kategorien; Erhaltungsrücklage → null (nicht übernommen)
- js/beleg-import.js:17 — MAX_BELEGE = 40 je Lauf
- js/beleg-import.js:276-279 — „Der KI-Beleg-Import ist ab dem Investor-Plan verfügbar.“
- js/beleg-import.js:287-310 — Titel, „KI liest Datum · Betrag · USt · Aussteller · Kategorie — du bestätigst jede Zeile“, „PDFs, Fotos (JPG/PNG), CSV oder Excel“, „Ordner auswählen“, „Einzelne Dateien“, „CSV-Auswertung“, Übernehmen-Knöpfe
- js/beleg-import.js:~697-766 (Abschnitt ab Zeile 312+385) — WK: nach Jahr gruppiert, addiert, „ohne Jahr übersprungen“
- js/beleg-import.js:~780-786 — AK: Frage ERSETZEN / ADDIEREN bei belegten Feldern

### Daten exportieren
- js/import-export-modal.js:169-183 — „PDF-Report für Objekt“
- js/import-export-modal.js:185-203 — „DealPilot-Sicherung“, .dpkt, „Empfohlen vor jedem App-Update“, „Mit Passwort verschlüsseln (AES-256)“, Klartext-Warnung
- js/import-export-modal.js:206-218 — „Excel-Export“, eine Zeile je Objekt
- js/import-export-modal.js:220-231 — „Portfolio-CSV“, Semikolon, Summenzeile
- js/pdf-wahl.js:47-52 — Fassungen Bankfassung / Investment-PDF · hell / Investment-PDF · Obsidian
- js/pdf-wahl.js:121 — „Diese Wahl merken (später über „Fassung“ neben dem PDF-Knopf änderbar)“
- js/deal-action-boarding.js:202-206 — Knopf „Fassung“ neben „PDF“

### Track Record und Bankexport
- js/storage.js:3397 ff. — Track-Record-Ansicht: „Alle Objekte anzeigen — sonst nur gewonnene Deals“, „Klick auf eine Karte: Einzel-PDF — oder unten Sammel-PDF“, „Sammel-PDF (alle angezeigten Objekte)“, Hinweis auf Tab Deal-Aktion
- js/storage.js:3071 ff. (Text ~3125-3150) — „Bankexport · alle Objekte“, „Format AuswertungBank“, Häkchen erste Spalte, Spalten Bank/Darlehenssumme/Zins/Tilgung/Zinsbindung/Akt. Restschuld
- js/storage.js (Bereich 3120-3395) — Knöpfe „CSV exportieren“, „Excel exportieren“, „PDF erstellen“

## steuer_tief

### Grenzsteuersatz und Steuerwirkung
- index.html:2086-2087 — „Persönliche Steuer“, §32a EStG (Tarif 2026), manuelles Übersteuern
- index.html:2088-2094 — „Dein zvE wird zentral im Profil gespeichert.“
- index.html:2102 — Checkbox grenz_auto „Grenzsteuersatz automatisch aus zvE berechnen“
- js/tax.js:1948-1960 — Automatik: Tax.calcGrenzsteuersatz(zve), Feld gesperrt
- index.html:2034-2043 — „Was mit diesen Werten passiert“, Differenz zweier Tarifberechnungen, Cashflow nach Steuer, Bestandsobjekte
- index.html:2048-2066 — Reihenfolge Kaufzeitpunkt; § 15a, § 15b, § 10d bleiben außen vor

### Steuerzeiträume
- index.html:2094 — Link „📅 Steuerzeiträume verwalten →“
- js/settings.js:1728-1737 — öffnet Einstellungen „mandanten“ und bearbeitet „privat“
- js/settings.js:251-254 — Einstellungsreiter „Mandanten“
- js/tax-periods.js:156-190 — „Neuen Zeitraum hinzufügen“, „Gültig von“, „Gültig bis (leer = laufend)“, „zvE / Jahr (€)“, „Grund“, „Notiz (optional)“, „Hinzufügen“
- js/tax-periods.js:330-341 — Konflikt: „Trotzdem als neuen Zeitraum anlegen“ / „Abbrechen“
- js/tax.js:376-383, 1409-1417 — Zeitraum zum Stichtag JAHR-06-15 (Jahresmitte), sonst zvE-Feld

### AfA-Satz, Gebäudeanteil und § 7b
- index.html:2122 — Karte „AfA-Konfiguration“
- index.html:2152-2158 — die fünf AfA-Optionen (wörtlich)
- index.html:2140-2144 — Hinweis „Degressive AfA möglich“, § 7 Abs. 5a EStG, Knopf „Auf degressiv 5% wechseln“; Steuerung js/afa-ui.js:45, 87
- index.html:2170 — „Gebäudeanteil am KP (%)“, „Rest = Grundstücksanteil“
- index.html:2175-2185 — „AfA / Jahr (berechnet)“, Zusammensetzung Gebäude-AfA / bewegliche WG, „AfA-Verlauf erste 10 Jahre ansehen“
- index.html:2196-2245 — § 7b: +5 % in 4 Jahren, vier Voraussetzungen (2218, 2224, 2230, 2236), Cap 4.000 €/m² (2241)

### Eigener AfA-Satz über die Restnutzungsdauer
- js/afa-eigen.js:26-42 — Optgroup „Eigener Satz (§ 7 Abs. 4 Satz 2 EStG)“, Option „Eigenen Satz / Restnutzungsdauer eingeben …“, Felder, Hinweis „100 ÷ RND … Nachweis (Gutachten)“, Knöpfe „Restnutzungsdauer ermitteln“, „Letzte Ermittlung übernehmen“
- js/afa-eigen.js:47, 51-53 — RND → Satz; Grundlage „RND-Ermittlung DealPilot (indikativ)“
- js/afa-eigen.js:71 — plausibel 0,5 bis 33,3 %
- js/afa-eigen.js:15-17 — eigener Satz wird nie von einer Automatik überschrieben
- js/rnd-wizard.js:21, 31-118 — 9 Schritte (Objekt-Basis … Modernisierungen, Zustand der Gewerke … Ergebnis & Empfehlung)
- js/rnd-wizard.js:385-389, 503-515 — Modus 'anfrage': letzter Knopf „✉ Anfrage senden →“, _lastRndResult wird gesetzt
- js/deal-action.js:1754-1768 — openExpertWithRnd öffnet den Wizard (ohne modus → 'anfrage')

### BMF-Rechner: Kaufpreis aufteilen
- index.html:2124-2128 — Knopf „BMF-Rechner“ (openBMFModal)
- js/bmf-modal-html.html:13-27 — Titel, BMF-Arbeitshilfe (Juni 2023), Reiter 1–4
- js/bmf-modal-html.html (Reiter 1) — „Auto-Übernahme aus Tab Investition“, Kaufpreis, GrESt, Notar, Grundbuchamt, Makler, Fahrtkosten-Helfer, Verpflegung, Unterkunft, Gutachten, Anwalt; „Herstellungskosten Gebäude § 255 Abs. 2 HGB … 100 % Gebäude“
- js/bmf-modal-html.html (Reiter 2) — Verfahren-Regel „Bekannte Miete → Ertragswert, Vergleichsfaktor → Vergleichswert, sonst Sachwert. Alle drei werden berechnet“
- js/bmf-modal-html.html:276-278 — Knopf „KI-Vorschlag“; Knöpfe „BRW → BMF“, „Lzs → BMF“
- js/bmf-modal-v292.js:427-468 — Jacoby-Zeile, „nicht gerechnet — kein amtlicher Zinssatz“
- js/bmf-modal.js:411-428 — Reiter p-bmf/p-afa/p-hebel gesperrt bis Pflichtangaben vollständig

### Varianten, Bodenabschlag und Ausgabe
- js/bmf-modal-html.html — Reiter 3: „Lineare AfA · § 7 Abs. 4 EStG“, „Vergleich: Standard 80/20 vs. BMF-Berechnung“
- js/bmf-modal-v292.js:506-512, 580-591 — vier Varianten mit Faktoren; :33-36 Vorauswahl 'amtlich'
- js/bmf-modal-v292.js:525, 555, 625 — Risiko-Score je Variante
- js/bmf-modal-v292.js:661-664 — Status Puffer / Knapp / Überschritten
- js/bmf-modal-html.html:545-568 — „Notarvertrag-Klausel“, Konservativ/Moderat/Aggressiv, „Kopieren“
- js/bmf-modal-html.html:578 — Hinweis § 6 StBerG, „Abweichungen über 25 % … Sachverständigengutachten sinnvoll“
- js/bmf-modal-html.html:601-602 — „Beim „Übernehmen“: Gebäudeanteil + AfA-Satz wandern ins Steuer-Modul“
- js/bmf-bodenabschlag.js:87, 96-127 — Reiter „Bodenabschlag“, Szenario neben der amtlichen Aufteilung, BFH IX R 26/19, Stufen 0/15/20/25, RND von/bis, „Begründung (kommt in den Vertragstext)“
- js/bmf-bodenabschlag.js:277 — „Ohne Begründung bleibt der Abschlag angreifbar“
- js/bmf-modal.js:827-885 — Ausgabe-Block: „Kaufpreisaufteilung als PDF“, „BMF-Arbeitshilfe als PDF“, „BMF-Original als XLSX“

### Werbungskosten je Jahr und Sanierung verteilen
- index.html:2302 — „Steuerformular pro Jahr · individuelle Werte“; :2310-2312 Hinweis „fließen in die Cashflow-Projektion und in den Steuerverlauf“
- js/tax.js:1477-1478 — „Quick-Modus“ / „Detail-Modus“; Knopf „↺ Vorschläge wiederherstellen“
- js/tax.js:~1510-1530 — Quick-Spalten (Jahr … Steuer-Effekt), Hinweis „Klicke ein Feld an … Der Pfeil ↺ …“
- js/tax.js:~1540, 1600-1700 — Detail: „Veranlagungsjahr“, Gruppen 1.0 Finanzierungskosten … 6.0 AfA bewegliche Wirtschaftsgüter, 7.0 Einnahmen
- index.html:1575, 1616-1680 — Reiter Investition (s1), Karte Sanierung, „In Steuer-Werbungskosten übernehmen“, Optionen „Automatisch (15%-Regel)“ … „5 Jahre (Standard §82b)“ … „Über AfA-Nutzungsdauer (anschaffungsnahe HK)“
- index.html:1689-1700 — 15%-Grenze netto, „− Umsatzsteuer 19 %“
- js/tooltip-content.js:189-192 — § 82b EStDV, Automatik-Erklärung

### Finanzamt-PDF und Anlage V
- index.html:2303-2307 — „Steuerjahr“, Checkbox „Anlage V“ (Titel: zweite Seite nach den Zeilen der amtlichen Anlage V), Knopf „Finanzamt-PDF“
- js/werbungskosten-pdf.js:121-133 — Jahresliste (erste 15 Jahre) + „Alle Jahre“
- js/werbungskosten-pdf.js:72-107 — Anlage-V-Seite je Jahr; bei Alle Jahre eine Seite je Jahr plus Zusammenfassung
- js/anlage-v-2025.js:1-15, 55-56 — Zuordnung aus dem Formular 2025 abgeschrieben
- js/werbungskosten-pdf.js:1072-1106, 1165-1170 — Rückfall auf jüngeres Formular mit Vorbehalt (rot, Kopf und Fuß)
- js/werbungskosten-pdf.js:678-706, 721 — GmbH/UG: keine Anlage V, Gewerbebetrieb § 8 Abs. 2 KStG
- js/deal-action-boarding.js:219-226, 779-787 — Finanzamt-PDF auch im Reiter Deal-Aktion
- js/dashboard.js:2379-2390 — Cockpit „Steuer-Mappe“, „Veranlagungsjahr“, „Anlage-V-Zuordnung anhängen“, „Steuer-Mappe erstellen“


# Belege faq_mehr („Noch mehr Fragen“)

## Liegenschaftszins „gesetzlicher Auffangwert“
- marktbericht/backend/src/services/WertParameterService.js:4-11 — Kaskade A amtlich kreisscharf, B amtlich regional, C eigene Marktableitung, D § 256 BewG, E Nutzereingabe
- marktbericht/backend/src/services/WertParameterService.js:434-448 — nichts gefunden -> lzsNach256, stufe 'D', quelle '§ 256 BewG'
- marktbericht/backend/src/services/ReportOrchestrator.js:1307-1311 — Texte „indikativ, gesetzlicher Auffangwert“, „nach § 256 BewG, nicht marktabgeleitet“, E „eigene Angabe“
- frontend/marktbericht-app/app.js:4387-4389 — Stufentexte „amtlich, kreisscharf“ … „gesetzlicher Auffangwert n. § 256 BewG“, „eigene Angabe“
- frontend/marktbericht-app/app.js:791-812 — Zeile „Liegenschaftszinssatz: … (indikativ)“, Quelle-Satz mit warum_kein_wert, kosten, Link
- marktbericht/backend/src/lib/quellen_links.js:156ff, 287 — warum_kein_wert-Texte, kostenpflichtige Herausgabe
- frontend/marktbericht-app/wertermittlung.js:340-341 — Feld „Liegenschaftszinssatz (%)“, Platzhalter „leer = amtlicher bzw. gesetzlicher Wert“
- frontend/marktbericht-app/wertermittlung.js:674-683 — Aufklapper „▸ Werte selbst setzen“

## Stufe 3 nicht abrufbar
- frontend/js/objekt-reiter.js:699-723 — Box „Marktbericht abrufen“, Knopf „was fehlt“/„abrufen“, „N frei“, disabled bei rest 0, „ab Pro“
- frontend/js/objekt-reiter.js:551-557 — „Für Stufe N fehlt noch:“, Klick springt zum Feld, „der Bericht rechnet nie halb“
- frontend/js/objekt-reiter.js:507-531 — Pflichtfelder Stufe 3: nutzungsart, gsfl, brw, bgf; ETW mea; EFH/ZFH/DHH/RH nhk_haus/geschosse/dach
- frontend/js/objekt-reiter.js:493-498 — Feldnamen (Hausform (NHK), Geschosse und Unterkellerung, Dachausbildung …)
- frontend/js/objekt-reiter.js:534-547 — Schild „optional“, Ansatz der Anlage 3 ImmoWertV
- frontend/js/config.js:416 — Pro: wev 5 (Starter/Investor wev 0, Z. 318/370)

## Kontingent aufgebraucht
- frontend/js/config.js:238-250 — drei Zähler mpi/mpi_plus/wev, Monatskontingent verfällt zum Monatsende
- backend/src/services/aiCreditsService.js:202-213 — Reset ab Monatsanfang
- frontend/js/settings.js:2070-2074 — „Bewertungspakete“, „Zugekauftes verfällt nie und wird erst verbraucht, wenn dein Monatskontingent leer ist.“
- frontend/js/settings.js:2104-2107 — „Oder einzeln — genau die eine, die gerade fehlt“
- frontend/js/settings.js:2141-2152 — bezahlter Plan: „Dein Kontingent“ + Kaufblock; Free darf nicht kaufen
- backend/src/routes/credits.js:12, 172 — Free -> upgrade_required
- frontend/js/settings.js:1197 — Einstellungs-Reiter „Plan“

## Wo finde ich meine Marktberichte?
- frontend/js/objekt-reiter.js:866-924 — am Feld Verkehrswert: Liste je Bericht Ertragswert/Sachwert/Marktwert, Aufklappfeld, „als Verkehrswert übernehmen“, „N Berichte im Verlauf“
- frontend/js/ui.js:2106, 3066-3078 — Reiter „Marktbericht-Verlauf“ in der Pilot-Analyse, sichtbar ab 2 Berichten
- frontend/js/mb-auftrag.js:38-46 — acht Etappen
- frontend/js/mb-auftrag.js:140-144 — „Im Hintergrund weiter“, „Bericht öffnen“
- frontend/js/mb-auftrag.js:90, 172-174 — Pille unten (bottom fixed): „Marktbericht in Arbeit“, „✓ Marktbericht fertig … — öffnen“
- frontend/js/mb-auftrag.js:27-30, 263-266 — Tab schließen: Server rechnet zu Ende, Nachsehen im Verlauf

## Score-Gewichtung
- frontend/js/settings.js:184-185, 1191 — „Einstellungen“, Reiter „Deal Score“
- frontend/js/settings.js:654-679 — „DealPilot Score (Quick-Check)“, Regler-Beschriftungen, 0–60, „Summe der Gewichtungen:“, „↺ Standard wiederherstellen“
- frontend/js/settings.js:1498-1508 — Summe grün bei 100
- frontend/js/dealscore.js:314-318 — Summe ≠ 100 -> Fehler „Summe muss 100% ergeben“, nicht gespeichert
- frontend/js/settings.js:1584-1593 — Speichern ruft setWeights, bei Fehler alert + return
- frontend/js/dealscore.js:28-31 — Standard 30/25/15/15/15
- frontend/js/settings.js:968 — Knopf „Speichern“
- frontend/js/settings.js:684-695 — Abschnitt „Investor Deal Score“ (Investor/Pro)
- frontend/js/dealscore2-ui.js:764-797 — „Bewertungsprofil“, Wechsel auf „Benutzerdefiniert“
- frontend/js/dealscore2.js:178-294 — Profilnamen Ausgewogen, Konservativ, Optimistisch, Lage-Fokus, Cashflow-Fokus, Sicherheit

## Investor Deal Score nicht sichtbar
- frontend/js/dealscore2-ui.js:398-399 — MIN_COMPLETENESS 0.70, 24 KPIs
- frontend/js/dealscore2-ui.js:446-466 — „Bitte mindestens … % der Kennzahlen ausfüllen“, „📋 Welche KPIs fehlen noch?“, Hinweis Tabs Objekt (Lage, Energieklasse, Zustand), Bewirtschaftung, Steuer
- frontend/js/dealscore2-ui.js:467-477 — Kaufgrenzen-Block (DSCR, Cashflow, LTV) unabhängig vom Score
- frontend/js/settings.js:632-641 — Free deal_score_v2 'demo', Starter false, Investor/Pro true
- frontend/js/dealscore2-ui.js:430-438 — Demo-Modus (Free)

## Steuerzeitraum
- frontend/index.html:2001, 2091-2094 — Reiter Steuer, „Dein zvE wird zentral im Profil gespeichert.“, Link „📅 Steuerzeiträume verwalten →“
- frontend/js/settings.js:1728-1737 — Link öffnet Einstellungen „mandanten“, uiEdit("privat")
- frontend/js/mandanten.js:566-568, 939 — Inline-Verwaltung im privaten Halter
- frontend/js/tax-periods.js:206-245 — „Steuerzeiträume verwalten“, „Neuen Zeitraum hinzufügen“, „Gültig von“, „Gültig bis (leer = laufend)“, „zvE / Jahr (€)“, „Grund“, „Notiz (optional)“, „Hinzufügen“
- frontend/js/tax-periods.js:304-313, 331-342 — Überschneidung -> Konfliktdialog „Trotzdem als neuen Zeitraum anlegen“/„Abbrechen“
- frontend/js/tax-periods.js:280-281 — „Bearb.“, „×“
- frontend/js/calc.js:801-818 — Zuordnung über wirtschaftlicher_uebergang (sonst Kaufdatum); manuelles zvE wird nicht überschrieben
- frontend/index.html:1137 — Beschriftung „Wirtsch. Übergang“

## Wann speichert DealPilot?
- frontend/js/storage.js:4082 — Auto-Save aus, Speichern bei Tab-Wechsel
- frontend/index.html:3753 — Floating-Save entfernt; kein sichtbarer Speichern-Knopf gefunden (btn-save in main.js:309 ohne Element im HTML)
- frontend/js/ui.js:136-139 — switchTab -> dpTabSwitchSave
- frontend/js/storage.js:1104, 1943-1945 — Neues Objekt / loadSaved sichern vorher
- frontend/js/ui.js:1603, 2286; frontend/js/deal-action.js:236, 2409 — Sichern nach Pilot-Analyse / Statuswechsel
- frontend/js/storage.js:4121-4127 — nur wenn Kaufpreis > 0 oder Ort
- frontend/js/storage.js:4168-4175 — beforeunload-Warnung bei ungesicherten Änderungen
- frontend/js/storage.js:998-999, 4241-4246 — Anzeige „Auto-saved · gerade eben“ (#hdr-autosave, index.html:936-938)

## Duplizieren / Löschen
- frontend/js/storage.js:1611-1614 — Kartenknöpfe ⎘ „Duplizieren“, × „Löschen“
- frontend/js/storage.js:2015-2036 — Kopie mit data, ai_analysis, photos; _obj_seq und Gewonnen/Verloren-Flags entfernt
- frontend/js/storage.js:2049-2062 — confirm „Objekt wirklich löschen?“, DELETE
- backend/src/services/objectService.js:207 — hartes DELETE FROM objects (kein Papierkorb)
- frontend/js/help.js:61-62 — Verloren bleibt erhalten, ausgegraut am Ende der Ankauf-Liste (bestehender Hilfetext); frontend/js/deal-action.js:2424 „Verloren“

## Sichern / Exportieren
- frontend/index.html:856 — „Aktionen“; :796-797 „Import“; :812-813 „Export“ (data-feature export_csv)
- frontend/js/import-export-modal.js:159-232 — Karten „PDF-Report für Objekt“, „DealPilot-Sicherung“ (.dpkt, „Mit Passwort verschlüsseln“, Klartext-Warnung), „Excel-Export“, „Portfolio-CSV“
- frontend/js/import-export-modal.js:236-242 — Titel „Daten exportieren“
- frontend/js/import-export-modal.js:113-124, 133-137 — „JSON-Backup importieren“, Stripe/Plan-Daten nicht enthalten
- frontend/js/storage.js:2202-2205, 2244-2247 — „Objekt-Sicherung (Import/Export) ist im Pro-Plan enthalten.“
- frontend/js/config.js:419 — json_backup nur Pro

## Pilot-Analyse „neu abrufen“
- frontend/js/ui.js:1473-1481 — verglichene Felder (Kaufpreis, Nettokaltmiete, Sollzins, Eigenkapital, Zustand, Hausgeld …)
- frontend/js/ui.js:1544-1556 — Stempel mit Stand und Abdruck
- frontend/js/ui.js:2050-2087 — Kopf: „gehört zu einem anderen Objekt … bitte neu abrufen“, „seitdem hat/haben sich … geändert … neu abrufen“, „die Zahlen haben sich seitdem nicht geändert“, alte Analyse ohne Datum


## faq_mehr — Zusatz (vom Hauptagenten)
### Wie rufe ich den Piloten?
- frontend/js/pilot-tower.js:12, :50, :581 — F1 überall, ? wenn nicht getippt wird
- frontend/js/pilot-tower.js:210-213 — Pilot anklickbar (title „Pilot rufen — F1 oder ?“), Klick öffnet/schließt
- frontend/js/pilot-tower.js:286-295 — ORTE Seitenleiste/Kopfleiste/Hauptbereich/Nur auf F1, Standard „seite“
- frontend/js/pilot-tower.js:283-285 — Rückfall auf nächsten Ort ohne Platz
- frontend/js/pilot-tower.js:305 — Überschrift „Pilot · Hilfe auf F1“
### Warum ist der Ankauf-Stand nicht eingefroren?
- frontend/js/ankauf.js:95-99 — Stichtag aus #wirtschaftlicher_uebergang
- frontend/index.html:1137 — Label „Wirtsch. Übergang · Nutzen-/Lastenwechsel“
- frontend/js/ankauf.js:49-55 — festschreiben nur bei _deal_won_state=true
- frontend/js/ankauf.js:347-368 — automatisch einfrieren bei gewonnen, ohne Stichtag nichts
- frontend/js/ankauf.js:320-326, 395-403 — Frage „Ankauf-Stand festschreiben?“, Knöpfe „Festschreiben“/„später“, Toast „Erst den Nutzen-/Lastenwechsel im Reiter Objekt eintragen.“
- frontend/js/storage.js:297-304 — bei offen/verloren ruht der Stand (_ankauf_ruhend)
