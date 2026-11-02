# Score-Benchmark P1 — Mietpotenzial im Quick-Check und Gewichtung des Scores

Stand 02.11.2026. Nur gemessen und gerechnet, **kein Code geändert**.
Rechenweg: `scratchpad/benchmark.cjs` lädt die **echten** Dateien aus `frontend/js/`
(`dscr-engine.js`, `deal-kpis.js`, `score-tiers.js`, `dealscore.js`,
`qc-heuristik.js`, `dealscore2.js`, `lage-profil.js`) per `vm` mit demselben
Fenster-Stub wie `backend/src/services/rechenkerne.js`. Die fünf gespiegelten
Kerne unter `backend/src/generated/rechenkerne/` sind laut SHA-256 **bitgleich**
mit `frontend/js/` — App, Quick-Check und Telegram-Bot rechnen also heute
dasselbe.

> Alles, was unter „Alternative" oder „Zwei Scores" steht, ist eine
> **Nachbildung im Bericht**. Diese Rechnung gibt es im Code nicht.

---

## 1 · Bestand: welche Scores es gibt

### 1.1 DealPilot Score klassisch (DS1) — `frontend/js/dealscore.js`

Das ist der Score, den der Quick-Check zeigt (Ring im iframe), dazu die
Objektkarte ohne DS2-Freischaltung und der Telegram-Bot.

**Gewichte** (`dealscore.js:18-51`). Ohne `localStorage` (Backend, Bot) gilt
`balanced`:

| Vorlage | Cashflow | Rendite (NMR) | LTV | Risiko (DSCR) | Potenzial |
|---|---:|---:|---:|---:|---:|
| **balanced (Standard)** | **30** | **25** | **15** | **15** | **15** |
| conservative („Vorsichtig") | 35 | 15 | 20 | 20 | 10 |
| optimistic | 25 | 35 | 10 | 10 | 20 |
| lage | 20 | 22 | 14 | 14 | 30 |
| cashflow | 45 | 20 | 12 | 13 | 10 |
| sicherheit | 28 | 12 | 25 | 25 | 10 |

> **Die Zahlen aus dem Auftrag, 35/15/20/20/10, sind die Vorlage
> `conservative`, nicht der Standard.** Wer in den Einstellungen „Vorsichtig"
> gewählt hat, sieht sie; der Bot rechnet immer `balanced`. Beide Varianten
> stehen unten in der Tabelle.

**Kurven je Kennzahl** (gemessen am Code, nicht am Kopfkommentar):

| Faktor | Datei:Zeile | Kurve |
|---|---|---|
| Cashflow v. St./Mon. | `dealscore.js:93-98` | linear: −200 € = 0, 0 € = 50, +200 € = 100 |
| Rendite (NMR) | `dealscore.js:100-105` | linear: 2 % = 0, 3,5 % = 50, 5 % = 100 |
| **LTV** | `dealscore.js:148-153` | linear `(110 − LTV) × 2,5`: **≤ 70 % = 100, 80 % = 75, 90 % = 50, 100 % = 25, ≥ 110 % = 0** |
| Risiko (DSCR, netto seit v3031) | `dealscore.js:155-173` | ≤ 0,9 = 0, 1,0 = 60, 1,2 = 80, ≥ 1,5 = 100 |
| Potenzial | `dealscore.js:175-183` | 30 + min(60, Wertpuffer/KP × 300), +10 bei Mietsteigerung **> 1,5 %** |

Barkauf (kein Darlehen): LTV und DSCR fallen aus der Gewichtung
(`dealscore.js:132-146`, `:244-249`).

**Nebenbefunde:**
- Der Kopfkommentar `dealscore.js:6-11` nennt andere Kurven („CF > 200 € = 100,
  < −100 = 0", „NMR > 4,5 % = 100", „LTV < 80 % = 100"). Der Code rechnet wie in
  der Tabelle oben.
- **Im Quick-Check bewertet „Potenzial" kein Mietpotenzial.** Beide Aufrufer
  geben `mstg: 1.5` fest mit. Der Bonus verlangt `> 1,5`, kommt also **nie**.
  `quickcheck-app.html:7697` setzt den Wertpuffer nur mit AVM-Marktwert
  (sonst 0 → Potenzial = 30). `quick-check.js:641` setzt ihn fest auf
  `kp × 0,05`, damit liegt Potenzial dort **immer bei 45**.

### 1.2 Quick-Check-Score — `quickcheck-app.html` + `quick-check.js` + `qc-heuristik.js`

- **Einen eigenen Score gibt es nicht.** Das iframe (`quickcheck-app.html:7681-7706`,
  `_dpPilotScore`) rechnet `DealKpis.compute()` und danach
  `DealScore.computeFromKpis()`, also DS1 `balanced`. Den LTV rechnet es
  **gegen den Kaufpreis**, die Nebenkosten stecken aber im Darlehen. Wer nur die
  Nebenkosten aus Eigenkapital zahlt, hat also LTV 100 % und bekommt 25 Punkte.
  Ohne Eingabe nimmt es für die Tilgung 1,5 %.
- `QcEngine.computeScore` ist nur der Rückfall, wenn die Kerne fehlen (mit
  Warnhinweis, `quickcheck-app.html:4450-4490`).
- `qc-heuristik.js` liefert Ampeln, Texte, Empfehlung und Zielkaufpreis, aber
  **keine Punkte**. Schwellen der Empfehlung: KAUFEN ≥ 70, VERHANDELN ≥ 50,
  KRITISCH ≥ 35 (`qc-heuristik.js:77`).
- **Befund: der Rechenweg passt nicht zu den Punkten.** `QcHeuristik.kategorien()`
  (`qc-heuristik.js:953-1017`) beschreibt die Punkte nach der **alten
  Rückfallformel**. Rendite steht dort als „BMR 40 % / NMR 40 % / EKR 20 %,
  3–7 %", der LTV als Stufen „30/60/80/90", Effizienz als
  Bewirtschaftungsquote. Die Punkte daneben kommen aber aus DS1: Rendite nur
  NMR 2–5 %, LTV linear, und „Effizienz" ist der Wertpuffer. Diese Texte gehen
  an die Haupt-App (`quick-check.js:841-851`) und an den Telegram-Agenten
  (`backend/src/services/agentWerkzeuge.js:2708`). Kunde und Bot lesen damit
  eine Begründung, die nicht zur Zahl gehört.

### 1.3 Investor Deal Score (DS2) — `frontend/js/dealscore2.js`

Er hat 24 Kennzahlen in 5 Kategorien. **Er ist nicht ins Backend gespiegelt**,
läuft also nur im Browser. Die Objektkarte zeigt ihn bei DS2-Freischaltung
(`storage.js:1932-1956`).

| Kategorie | balanced | conservative | optimistic | lage | cashflow | sicherheit |
|---|---:|---:|---:|---:|---:|---:|
| Rendite (BMR 25, NMR 30, CF 25, CoC 20) | 35 | 30 | 40 | 20 | 40 | 25 |
| Finanzierung (DSCR 35, **LTV 30**, Zins 15, Tilgung 10, EK-Bedarf 10) | 25 | 30 | 20 | 15 | 25 | 30 |
| Risiko (Leerstand, IH, Bausubstanz, Energie, Mietausfall, Ausstattung) | 20 | 25 | 15 | 15 | 20 | 30 |
| Lage (Ist/Markt, Mietwachstum, Bevölkerung, Nachfrage, Mikrolage) | 10 | 10 | 10 | 40 | 8 | 10 |
| Upside (Mietsteigerung, Faktor vs. Markt, Wertsteigerung, Entwicklung) | 10 | 5 | 15 | 10 | 7 | 5 |

`dealscore2.js:47-89`, Presets `:172-299`.

**LTV in DS2 ist umgekehrt gepolt wie in DS1** (`dealscore2.js:100-106`):
0–70 % = 85, 70–85 % = 95, **85–95 % = 100**, 95–105 % = 75, > 105 % = 30.
Dazu kommt eine Wechselwirkung LTV × DSCR (+5 / −20 / −25, `:158-162`, `:471-489`).
Die Folge: DS1 bestraft eine hohe Beleihung, DS2 belohnt sie bis 95 %. Die
Kommentarzeile „Damit beide Score-Engines sich in dieselbe Richtung bewegen"
(`dealscore.js:26`) gilt nur für die Gewichte.

**Befund: Angebotsmiete als Mietpotenzial.** „Ist-/Marktmiete" (Lage) und
„Mietsteigerung-Potenzial" (Upside) rechnen beide gegen `ds2_marktmiete`
(`dealscore2-ui.js:137`). Das Feld heißt „Marktmiete … markt-üblich für die
Region" (`index.html:1932-1935`). Es dient zugleich als Ersatz für den
gestrichenen Mietspiegel-Vergleich (`index.html:1928`) und in `potenzial.js`
als zweite Quelle der **Vergleichsmiete für § 558** (`potenzial.js:815-822`,
Rangfolge `zb_vgl_qm` → `ds2_marktmiete` → `me_soll`). Genau das ist die
Gleichsetzung, die Marcel ausschließen will: Ein Feld trägt Angebotsmiete,
ortsübliche Vergleichsmiete und Upside zugleich.

### 1.4 Wo der LTV überall wirkt

| Weg | DS1 balanced | DS2 balanced |
|---|---|---|
| direkt | LTV 15 % | Finanzierung 25 % × LTV-Anteil 30 % = **7,5 %** (+ Wechselwirkung) |
| über den Kapitaldienst | Cashflow 30 % + DSCR 15 % | DSCR 8,75 %, Cashflow 8,75 %, Cash-on-Cash 7 %, EK-Bedarf 2,5 % |
| **finanzierungsabhängig gesamt** | **60 %** | **≈ 35 %** |
| objektbezogen | NMR 25 % + Potenzial 15 % = 40 % | Rest |

**Der direkte LTV-Anteil von 15 % ist nicht das Problem. Das Problem ist, dass
60 % des Gewichts an der Finanzierungsstruktur hängen.** Gemessen an Fall E
(unten): Das Objekt bleibt dasselbe, das Eigenkapital steigt von LTV 90 % auf
70 %, und der Score springt **von 48 auf 78**. Davon kommen 7,5 Punkte aus
dem LTV, 10,8 aus dem Cashflow und 10,9 aus dem DSCR. Dieselbe Wohnung ist
damit je nach Eigenkapital „Schwach" oder „Gut".

---

## 2 · P1.1–P1.3: was es schon gibt und was im Quick-Check ankommt

| Marcels Baustein | Gibt es im Code? | Kommt im Quick-Check (iframe) an? |
|---|---|---|
| aktuelle Jahres-NKM | `DealKpis.compute` → `nkm_j` (`deal-kpis.js:103`) | ja, rechnet mit; als Jahreszahl nicht ausgewiesen |
| Bruttorendite | `bmy` (`deal-kpis.js:225`) | ja, im Rechenweg und im Lage-Urteil (`quickcheck-app.html:5443`). Von der Kachelreihe seit qc-v2420 entfernt (`:4542`) |
| marktübliche Sollmiete | AVM-/Marktmiete im QC (`quickcheck-app.html:5005-5020`), `ds2_marktmiete` in der Haupt-App | **teilweise**: AVM-Marktmiete mit Satz „Mietsteigerungspotenzial bei Neuvermietung" (`:5531`, `:5669`). Das ist eine **Angebots-/AVM-Miete**, keine ortsübliche Vergleichsmiete. Ein Feld für die Vergleichsmiete fehlt im QC |
| rechtlich zulässige Zielmiete (Kappung, Sperrfrist) | **ja, vollständig in der Haupt-App**: `potenzial.js` `kappung(ags)` :153 (Länderliste 15/20 %), `mietpreisbremse(ags)` :358, `mhTermine()` :663 (verlangbar/wirksam, Jahressperre § 558 Abs. 1), `sollFuer()` :740 (Vergleichsmiete ∧ Kappung, Drei-Jahres-Anrechnung § 558 Abs. 3, § 559 mit Erhaltungsanteil, Staffel/Index/Gewerbe `vertragGrenzen` :717) | **nein**: `potenzial.js` wird in `quickcheck-app.html` nicht geladen, und es ist **kein reiner Kern** (liest DOM, `fetch`, `window._dpMfh`) |
| Jahresmiete und BMR nach 3 J. | Haupt-App: Mietleiter/Stufen (`potenzial.js` `modell`, `stufenWerte`, `leiterZeilen`) | **nein** |
| persönliche Zielbruttorendite | `lage-profil.js:84` Vorgabe A 3,5 / B 5,0 / C 7,0 %, `zielBmr()` :186, aus dem Investmentprofil | ja: `qc_lageklasse` (`quickcheck-app.html:3596`). Wirkt auf Ampel, Lage-Urteil und Zielpreis, **bewusst nicht auf den Score** (v2143) |
| renditebasierter Zielkaufpreis | `QcHeuristik.zielKaufpreis()` (`qc-heuristik.js:263-313`) = **min(NKM heute × 12 / Zielrendite; KP bei Cashflow 0; bereinigter Marktwert)** | ja, in der Empfehlungsbox (`quickcheck-app.html:5817-5838`). Grundlage ist aber die **heutige** Miete, nicht die nach 3 Jahren |
| Upside-Score | DS2-Kategorie `upside` (`dealscore2.js:605-650`) | nein (DS2 läuft nicht im QC) |

### Marcels Beispiel, nachgerechnet

| | Rechnung | Ergebnis |
|---|---|---:|
| heute, echter Kern `zielKaufpreis(kp 180.000, NKM 900/Mon, Ziel 8 %)` | 10.800 / 8 % (der Cashflow ist +132 €, also nicht bindend) | **135.000 €** |
| Marcel: Zielkaufpreis auf die Miete nach 3 J. | 13.500 / 8 % | 168.750 € |
| **zulässig bei Kappung 20 %** | 10.800 × 1,20 = 12.960 → / 8 % | **162.000 €** (BMR nach 3 J. 7,2 %) |
| **zulässig bei Kappung 15 %** | 10.800 × 1,15 = 12.420 → / 8 % | **155.250 €** (6,9 %) |

> **Im Beispiel steigt die Bestandsmiete in drei Jahren um 25 %.** Das liegt
> über jeder Kappungsgrenze des § 558 Abs. 3 BGB. Erreichbar ist es nur durch
> Neuvermietung oder eine Modernisierungsumlage nach § 559. Genau diesen
> Unterschied soll der Baustein zeigen. Der Zielkaufpreis braucht deshalb die
> zulässige Miete als Grundlage und die Marktmiete nur als zweite, gekennzeichnete
> Zahl („bei Neuvermietung").

---

## 3 · Benchmark: 8 Fälle A–H

**Gemeinsame Annahmen:** Erwerbsnebenkosten 10,5 % (wie `zielKaufpreis`),
Zins 3,8 %, Tilgung 2 %. Darlehen = Kaufpreis + Nebenkosten − Eigenkapital.
LTV gegen den Kaufpreis, wie im QC-iframe. Bewirtschaftung = nicht umlagefähige
Kosten p. a. (Verwaltung, Instandhaltung, Mietausfall). Der Score folgt dem
QC-iframe-Pfad (Wertpuffer = max(0, Marktwert − KP), `mstg` 1,5). DS2 ist mit
`balanced` gerechnet, die Angebotsmiete steht dabei in `ds2_marktmiete`.

| Fall | Objekt, Ort (Lage) | KP | NKM/Mon | Wfl | Bj | Zustand | EK | Marktwert | Vergleichs-/Angebotsmiete €/m² | Kappung | Invest.-bedarf |
|---|---|---:|---:|---:|---:|---|---|---:|---|---:|---:|
| A hoher LTV + hohe Rendite | MFH 4 WE, Gelsenkirchen (C) | 250.000 | 2.000 | 260 | 1972 | normal, E | nur NK | 265.000 | 7,2 / 8,0 | 20 % | – |
| B niedriger LTV + geringe Rendite | ETW, München-Schwabing (A) | 500.000 | 1.250 | 70 | 2012 | gut, B | 55 % der GI | 510.000 | 18,5 / 22,5 | 15 % | – |
| C niedrige Ist-Miete + Potenzial | ETW, Köln-Kalk (B) | 195.000 | 600 | 75 | 1965 | normal, D | NK + 10 % | 215.000 | 10,6 / 13,5 | 15 % | – |
| D hohe Rendite + Sanierungsbedarf | MFH 6 WE, Pirmasens (C) | 300.000 | 2.600 | 400 | 1958 | stark sanierungsbed., G | NK + 20 % | 290.000 | 6,3 / 6,8 | 20 % | 140.000 |
| E KP deutlich unter Marktwert | ETW, Bielefeld (B) | 150.000 | 680 | 68 | 1990 | gut, C | NK + 10 % | 205.000 | 9,4 / 10,5 | 15 % | – |
| F hoher LTV + negativer CF | ETW, Frankfurt-Bornheim (A) | 420.000 | 1.150 | 85 | 2008 | gut, C | 0 (110 %) | 400.000 | 14,0 / 17,0 | 15 % | – |
| G solide, stabil vermietet | MFH 8 WE, Herford (B) | 640.000 | 3.650 | 560 | 1994 | gut, C | NK + 20 % | 660.000 | 6,9 / 7,6 | 20 % | – |
| H hoher KP + optimistische Prognose | ETW, Hamburg-Eimsbüttel (A) | 460.000 | 1.120 | 80 | 1999 | gut, D | NK + 20 % | 390.000 | 13,2 / 17,5 (Verkäufer: 17,5) | 15 % | – |

### 3.1 Heute (echte Kerne)

| Fall | BMR | NMR | CF/Mon | DSCR | LTV | **DS1 heute** | Stufe | Punkte CF · NMR · LTV · DSCR · Pot. | DS1 „Vorsichtig" | DS2 balanced |
|---|---:|---:|---:|---:|---:|---:|---|---|---:|---:|
| A | 9,60 % | 6,81 % | +358 € | 1,30 | 100,0 % | **79** | Gut | 100 · 100 · **25** · 86 · 48 | 77 | 81 Gut |
| B | 3,00 % | 2,39 % | −108 € | 0,91 | 50,0 % | **31** | Kritisch | 23 · 13 · 100 · 6 · 36 | 35 | 55 Solide |
| C | 3,69 % | 2,74 % | −357 € | 0,58 | 90,0 % | **23** | Kritisch | 0 · 25 · 50 · 0 · 61 | 20 | 51 Solide |
| D | 10,40 % | 7,06 % | +790 € | 1,68 | 80,0 % | **86** | Sehr gut | 100 · 100 · 75 · 100 · 30 | 88 | 72 Gut |
| E | 5,44 % | 4,17 % | −77 € | 0,88 | 90,0 % | **48** | Schwach | 31 · 72 · 50 · **0** · 90 | 41 | 59 Solide |
| F | 3,29 % | 2,56 % | −1.251 € | 0,44 | 110,5 % | **9** | Kritisch | 0 · 19 · 0 · 0 · 30 | 6 | 43 Schwach |
| G | 6,84 % | 4,72 % | +309 € | 1,12 | 80,0 % | **81** | Gut | 100 · 91 · 75 · 72 · 39 | 82 | 76 Gut |
| H | 2,92 % | 2,31 % | −800 € | 0,55 | 80,0 % | **18** | Kritisch | 0 · 10 · 75 · 0 · 30 | 20 | 51 Solide |

DS2-Kategorien (Rendite · Finanzierung · Risiko · Lage · Upside):
A 98·94·58·64·52 · B 18·51·91·86·**94** · C 13·60·69·77·**100** · D 100·91·**22**·47·54 ·
E 42·60·82·70·55 · F 12·20·82·83·**93** · G 69·79·82·74·80 · H 11·56·76·83·**93**.

**LTV-Empfindlichkeit DS1:** gleiches Objekt, Eigenkapital so gesetzt, dass der LTV 70 % beträgt. Die Klammer zerlegt den Unterschied nach Faktoren.

| Fall | heute → LTV 70 % | davon LTV direkt | über Cashflow | über DSCR |
|---|---|---:|---:|---:|
| A | 79 → **92** | +11,3 | 0 | +2,1 |
| C | 23 → 33 | +7,5 | +2,4 | 0 |
| D | 86 → 90 | +3,8 | 0 | 0 |
| **E** | **48 → 78** | +7,5 | +10,8 | +10,9 |
| F | 9 → 24 | +15,0 | 0 | 0 |
| G | 81 → 86 | +3,8 | 0 | +2,1 |
| H | 18 → 22 | +3,8 | 0 | 0 |

(B liegt schon bei 50 %. Mehr Fremdkapital senkt den Score dort, 31 → 24.)

### 3.2 Alternative nach Marcels Gewichtung (Nachbildung, nicht im Code)

Teilnoten 0–100, gebaut **nur aus vorhandenen Kurven**:

| Teilnote (Gewicht) | Nachbildung |
|---|---|
| Aktuelle Rendite/Wirtschaftlichkeit (25) | ½ BMR auf der DS2-Kurve 4/5/7/9 % + ½ NMR auf der DS1-Kurve. **Ohne Finanzierung** |
| Prognose/Mietpotenzial (20) | ½ BMR nach 3 J. mit der **rechtlich zulässigen** Miete (min(Vergleichsmiete, Ist × (1 + Kappung)), nie unter Ist = `sollFuer`-Logik) + ½ zulässiger Anstieg auf der DS2-Kurve `mietsteigerung` |
| Kaufpreis vs. Marktwert (20) | DS2-Kurve `kaufpreisFaktor` auf KP/Marktwert (0,8 = 100 · 1,0 = 65 · 1,2 = 15) |
| Standort (15) | Mittel aus Mikrolage, Bevölkerung und Nachfrage (DS2-Zuordnung) |
| Zustand/Investitionsbedarf (10) | ½ DS2-Zustand + ½ Investitionsbedarf/KP (0 % = 100, 10 % = 70, 25 % = 35, 40 % = 10) |
| Finanzierung/LTV (10) | DS1-Kurven: DSCR 40 + Cashflow 30 + LTV 30 |

**Zwei Scores:** Investment = die ersten fünf auf 90 normiert; Finanzierung = die sechste Teilnote allein.

| Fall | Aktuell · Prognose · Preis · Standort · Zustand · Finanz. | zul. Miete nach 3 J. (BMR) | **Alternative** | **Investment** | **Finanzierung** |
|---|---|---|---:|---:|---:|
| A | 100 · 70 · 76 · 60 · 83 · 72 | 2.000 (9,60 %), Ist > Vergleichsmiete | **79 Gut** | 79 Gut | 72 Gut |
| B | 16 · 35 · 69 · 93 · 93 · 39 | 1.295 (3,11 %) | **52 Solide** | 54 Solide | 39 Schwach |
| C | 22 · 52 · 84 · 73 · 83 · 15 | **690 (4,25 %), Kappung 15 %**. Angebot: 1.013 (6,23 %) | **54 Solide** | 58 Solide | 15 Kritisch |
| D | 100 · 70 · 56 · 27 · **13** · 93 | 2.600 (10,40 %) | **65 Solide** | 62 Solide | 93 Sehr gut |
| E | 64 · 48 · **100** · 73 · 93 · 24 | 680 (5,44 %) | **68 Solide** | 73 Gut | 24 Kritisch |
| F | 19 · 35 · 53 · 87 · 93 · **0** | 1.190 (3,40 %) | **45 Schwach** | 50 Solide | 0 Kritisch |
| G | 84 · 70 · 71 · 73 · 93 · 81 | 3.864 (7,25 %) | **78 Gut** | 77 Gut | 81 Gut |
| H | 15 · **30** · **20** · 87 · 93 · 23 | 1.120 (2,92 %): Ist liegt schon über der Vergleichsmiete. Verkäufer: 1.400 (3,65 %) | **38 Schwach** | 40 Schwach | 23 Kritisch |

**Zielkaufpreis je Fall** (Zielrendite der Lageklasse; heute = echter Kern, 3 J. = zulässige Miete / Ziel):
A (7 %) 250.000 → 342.857 · B (3,5 %) 428.571 → 444.000 · C (5 %) 108.518 → 165.600 ·
D (7 %) 290.000 → 445.714 · E (5 %) 131.406 → 163.200 · F (3,5 %) 172.789 → 408.000 ·
G (5 %) 640.000 → 927.360 · H (3,5 %) 241.633 → 384.000.
Die Zahl „heute" ist durch den Cashflow-Deckel und den Marktwert gebunden, die
Zahl „3 J." nur durch die Rendite. **Beide Zahlen gehören nebeneinander und nicht an dieselbe Stelle:** Sonst wird aus einem
Renditeziel eine Kaufempfehlung über dem Marktwert (G: 927.360 € bei
Marktwert 660.000 €).

### 3.3 Wo das heutige Modell offensichtlich danebenliegt

Erwartetes Band = fachliche Einschätzung aus den Eckdaten. Das ist **kein
Messwert**, Marcel als Sachverständiger entscheidet.

| Fall | erwartet | DS1 heute | DS2 | Alternative | Urteil |
|---|---|---|---|---|---|
| A | Gut | 79 Gut | 81 Gut | 79 Gut | **passt.** Der LTV kostet 13 Punkte und die Stufe „Sehr gut", die Bank trägt es aber (DSCR 1,30, +358 €). Leicht streng, nicht falsch. Die Vermutung „A zu streng" ist nur schwach bestätigt |
| B | Schwach bis Solide | **31 Kritisch** | 55 | 52 | **DS1 zu streng.** Bei 50 % Eigenkapital in A-Lage ist „Kritisch" falsch. Die Wohnung ist teuer (BMR 3,0 % unter Ziel 3,5 %), aber kein Notfall |
| C | Solide (Objekt) / Finanzierung kritisch | **23 Kritisch** | 51 (Upside **100** aus +69 % Angebotsmiete) | 54 | **DS1 sieht das Potenzial nicht, DS2 überzeichnet es.** Zulässig sind +15 % (Kappung), nicht +69 % |
| D | Solide oder darunter (47 % des KP Sanierung, Bevölkerung stark fallend) | **86 Sehr gut** | 72 Gut | 65 Solide | **DS1 deutlich zu milde.** Der Quick-Check kennt weder Investitionsbedarf noch Zustand noch Lage. Mit der finanzierten Sanierung in der Haupt-App gerechnet: 63 |
| E | Gut (27 % unter Marktwert) | **48 Schwach** | 59 | 68 / Invest 73 | **DS1 zu streng.** 30 Punkte hängen allein an der Eigenkapitalhöhe, und der Preisvorteil wirkt nur über Potenzial (15 %) |
| F | Kritisch | 9 Kritisch | **43 Schwach** | **45 Schwach** | **DS1 richtig.** Die Vermutung „F zu milde" stimmt für DS2 und **für die Alternative**, nicht für DS1. Mit 10 % Gewicht wird ein Cashflow von −1.251 €/Monat fast unsichtbar |
| G | Gut | 81 Gut | 76 Gut | 78 Gut | passt überall |
| H | Schwach/Kritisch | 18 Kritisch | **51 Solide** (Upside 93) | 38 Schwach | **DS2 zu milde**: Die Angebotsmiete 17,5 €/m² zählt als Potenzial, obwohl die Ist-Miete schon über der Vergleichsmiete liegt. Mit der zulässigen Miete (Alternative) ist der Fall richtig eingeordnet |

**Zusammengefasst:** DS1 liegt bei B, C und E zu streng, weil die Finanzierung
60 % trägt, und bei D zu milde, weil der Quick-Check Zustand, Lage und
Investitionsbedarf nicht kennt. DS2 liegt bei C, F und H zu milde, weil die
Angebotsmiete als Potenzial zählt und der LTV bis 95 % belohnt wird. Die
Alternative trifft A, C, D, E, G und H. Bei **F (45) und B (52) ist sie zu
milde**, weil die Finanzierung nur 10 % zählt.

---

## 4 · Empfehlung

1. **Zwei Scores statt einer neuen Gewichtung.** Ein **Investment-Score**
   (Objekt und Preis: aktuelle Rendite, zulässiges Mietpotenzial, Preis
   gegen Marktwert, Standort, Zustand/Investitionsbedarf) und ein
   **Finanzierungs-Score** (DSCR, Cashflow, LTV). Gründe aus den Zahlen:
   - E springt bei gleichem Objekt um 30 Punkte.
   - F erreicht mit 10 % Finanzierungsgewicht noch 45.
   - Getrennt zeigen beide Fälle das Richtige: E Investment 73 / Finanzierung 24, F 50 / 0.

   Die Empfehlung KAUFEN sollte **beide** Scores verlangen, etwa
   Investment ≥ 70 und Finanzierung ≥ 50. Dann kann ein guter Kauf mit
   schlechter Finanzierung nicht mehr „Kritisch" heißen, und eine schlechte
   Finanzierung verschwindet nicht im Mittel. Ist nur EIN Ring gewollt, braucht
   die Alternative einen **Deckel** bei DSCR < 1 oder Cashflow < 0, sonst ist F
   „Schwach" statt „Kritisch".
2. **Mietpotenzial nur aus der rechtlich zulässigen Miete.** Die `sollFuer`-Logik
   als DOM-freien Kern aus `potenzial.js` herauslösen (Vergleichsmiete ∧
   Kappung ∧ Sperrfrist, Staffel/Index). Den Kern spiegeln und im QC laden.
   Angebots-/AVM-Miete nur als zweite Zeile „bei Neuvermietung". Dazu
   **`ds2_marktmiete` trennen** in Vergleichsmiete (§ 558) und Angebotsmiete.
   Heute ist es ein Feld für beides (`potenzial.js:815-822`, `dealscore2-ui.js:137`).
3. **Zielkaufpreis zweistufig:** heute (bestehender Kern, unverändert) und
   „bei zulässiger Miete in 3 J.", ohne den Marktwert zu überschreiten.
   Marcels 168.750 € werden damit gesetzeskonform 162.000 € (Kappung 20 %)
   bzw. 155.250 € (15 %).
4. **Der Quick-Check braucht Zustand und Investitionsbedarf**, sonst bleibt D
   „Sehr gut".
5. **Unabhängig davon reparieren:** die `kategorien()`-Rechenwege
   (`qc-heuristik.js:985-1017`) beschreiben andere Kurven als die Punkte
   daneben, und das geht auch an den Bot. Außerdem sind der Kopfkommentar
   `dealscore.js:6-11` und der `mstg`-Bonus nie erreichbar.

**Nachziehen bei einer Änderung:**
- `dealscore.js`, `qc-heuristik.js` und `deal-kpis.js` sind gespiegelt →
  `node tools/rechenkerne-spiegeln.mjs`.
- Ein **neuer Kern** (z. B. Mietpotenzial) muss in die Spiegelliste, in
  `_pruefsummen.json` → `reihenfolge` und in `GEBRAUCHT` in
  `backend/src/services/rechenkerne.js` eingetragen werden.
- `node tools/score-ketten-pruefen.mjs`: Pflicht, wenn sich Stufen oder Wörter
  ändern. Sonst als Gegenprobe laufen lassen.
- `node tools/buster-ebenen-pruefen.mjs`: `dealscore.js` und `qc-heuristik.js`
  werden von `index.html` **und** `quickcheck-app.html` geladen (dort heute
  `dealscore.js?v=v2191`, `qc-heuristik.js?v=v3031`).
- Telegram-Bot und Agent: `agentWerkzeuge.js:2464-2540` (`DealScore.computeFromKpis`)
  und `:2708` (`kategorien`), `telegramDialogService.js` (Rückfall der Stufen).
- DS2 ist nicht gespiegelt. Bei einer Änderung dort sind Karte
  (`storage.js:1932-1956`), Score-Hero (`dpsh-score-hero.js:421`) und
  Einstellungen (`settings.js:2962`) nachzumessen.
- **Gespeicherte Scores** (`dealpilot_score`, `ds2_score_persist`,
  `objectService.js`) zeigen auf den Karten bis zum nächsten Speichern den
  alten Wert.
- Texte, die die Gewichte nennen: Einstellungsdialog
  (`dealscore.js:802-890`), `tooltip-content.js`, `prozess-atlas.js:97`.
