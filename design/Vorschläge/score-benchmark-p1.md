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

---

## 5 · Recherche: realistische Bänder (02.11.2026)

Die Bänder in 3.3 waren eine fachliche Schätzung. Hier stehen sie neu, gesetzt
aus einer Web-Recherche (Stand 2025/2026) und den **amtlichen Liegenschaftszinssätzen
aus dem eigenen Register**. Quellen stehen am Ende. Es gilt dieselbe Vorbemerkung wie
oben: ein Band ist eine **begründete Einordnung, kein Messwert**. Marcel entscheidet.

> **Vorweg der wichtigste Befund:** Für die Mindest-DSCR privater Vermieter gibt es
> **keine Bankrichtlinie und keine Aufsichtsquelle**, die eine Zahl nennt. § 48u KWG
> kennt als Instrumente nur eine LTV-Obergrenze und eine Tilgungsvorgabe, keine
> Schuldendienstdeckung. Die Zahlen 1,1 / 1,2 / 1,35 stammen durchweg aus
> Vermittler-Ratgebern, und die sagen selbst: „jede Bank legt ihre Mindestdeckung
> selbst fest". Die DSCR-Schwellen unten sind deshalb **Branchenpraxis, nicht Norm**.

### 5.1 Was die Recherche hergibt

**1 · DSCR / Kapitaldienstfähigkeit**

| Aussage | Quelle (Art) |
|---|---|
| DSCR = Reinertrag (nach Verwaltung, Instandhaltung, Mietausfall, nicht umlagefähigen Kosten) / Kapitaldienst. 1,0 = Miete deckt Zins und Tilgung genau, ohne Puffer. 1,2 ist der übliche Beispielwert mit 20 % Puffer, „jede Bank legt ihre Mindestdeckung selbst fest" | finanzplusimmo.de (Darlehensvermittler § 34i, 2026) |
| Banken verlangen 1,20 bis 1,35; 1,10–1,24 „grenzwertig" (mehr EK oder Sicherheiten), unter 1,10 „kritisch", dann zählt die persönliche Bonität | veltivo.de, openpr.de (Ratgeber, **nur Suchtreffer, nicht geöffnet**) |
| Liegt die DSCR unter 1, zahlt der Käufer monatlich aus seinem Einkommen zu. Die Bank prüft dann die **persönliche** Kapitaldienstfähigkeit (§ 18a KWG, § 505b BGB) | finanzplusimmo.de; drklein.de |
| In der Haushaltsrechnung rechnen Banken die Miete nur zu rund **60–80 %** an (Dr. Klein: Sicherheitsabschlag 10–20 %) | drklein.de/renditeobjekte (25.06.2026); Vermittler- und Forenquellen |
| Für den Beleihungswert gelten mindestens **15 %** Bewirtschaftungskosten vom Rohertrag (§ 11 BelWertV), in der Tragfähigkeitsrechnung oft mehr | finanzplusimmo.de; `marktbericht/backend/src/lib/beleihungswert.js` |
| Einige Banken finanzieren auch Objekte mit DSCR < 1, wenn die Bonität gut und der monatliche Eigenanteil klein ist | openpr.de (Ratgeber, Suchtreffer) |

**Was DSCR < 1 heißt:** Das Objekt trägt seine Finanzierung nicht selbst. Die
Finanzierung steht dann auf dem Einkommen des Käufers, nicht auf dem Objekt. Ein
Zuschuss von 10 % der Miete (B, E) ist etwas anderes als einer von 60–110 % (C, F, H).

**2 · LTV / Beleihungsauslauf**

| Aussage | Quelle |
|---|---|
| Durchschnittlicher Beleihungsauslauf im Neugeschäft: **82,50 %** im 2. Tertial 2026 (Vorjahr 83,44 %), Tilgung 1,91 %, Darlehen 276.635 € | Dr. Klein Trendindikator T2/2026 (Europace-Daten, 16.09.2026) |
| Für Kapitalanleger: Eigenkapital **„Kaufnebenkosten plus 5 bis 10 %"** empfohlen | Interhyp, Kapitalanleger-PDF (Stand Sept. 2025) |
| MFH: viele Banken verlangen **20–30 %** Eigenkapital, Nebenkosten aus eigenen Mitteln; **110 % gibt es „selten"** | Dr. Klein, MFH als Renditeobjekt (06.10.2026) |
| Mindestens die Kaufnebenkosten als Eigenkapital | Dr. Klein, Renditeobjekte (25.06.2026) |
| Realkreditgrenze: **60 % des Beleihungswerts** (§ 14 PfandBG). Der Beleihungswert liegt unter dem Marktwert (Vergleichswert −10 %, § 19 BelWertV) und darf ihn nie übersteigen | `beleihungswert.js` (v2630), PfandBG |
| Zinsaufschlag 60 % → 95 % Beleihung: **+0,16 bis +0,44 Pp** je nach Zinsbindung; 10 J. ab 4,4 % (60 %) bzw. 4,5 % (80 %) | capitalo.de (Marktbandbreite 18.09.2026, kein Bankpreisblatt) |

**Folgerung:** LTV 90–100 % gegen den Kaufpreis ist bei Kapitalanlegern **üblich und
von Vermittlern empfohlen**; 110 % ist die Ausnahme. Ein hoher LTV ist für sich kein
Urteil über das Objekt, er verschiebt das Risiko in Zins und Cashflow. Der Benchmark
rechnet alle Fälle mit 3,8 %. Nach capitalo.de liegt der Markt im September 2026
eher bei 4,4–4,5 %; dazu weiter unten die Empfindlichkeit.

**3 · Bruttomietrendite / Kaufpreisfaktor**

| Quelle | Werte |
|---|---|
| Baufi24-Mietrenditeatlas H2/2025 (18.02.2026) | München 3,22 % · Frankfurt 3,24 % · Hamburg 3,02 % · Köln 3,50 % · Berlin 3,36 % · Gelsenkirchen 5,24 % · Top 7 ≈ 3,4 % · 50 Städte ≈ 4,1 %. **Rechnet mit Angebotsmieten**, liegt also über der Bestands-BMR |
| Baufi24 H1/2026 (18.08.2026) | 52 Städte 4,17 %, Spitze Chemnitz 5,77 %, Gelsenkirchen 5,16 %, Hamburg 3,00 % als Schlusslicht |
| Dr. Klein, MFH (06.10.2026) | BMR sehr gute Lagen **3–4 %**, gute/mittlere **4–5,5 %**, weniger gefragte **5,5–7 %+**. Faktor „gut" 20–25, in Top-Lagen 23–25. Faustregel: **NMR über dem Finanzierungszins**; bei Zins 3,5–4,5 % und NMR 2–3 % „oft schwer rentabel" |
| Interhyp (Sept. 2025) | BMR **≥ 5 % gilt als lukrativ** (Orientierungswert) |
| **Amtliche Liegenschaftszinssätze im Register** (netto, Marktgleichgewicht) | Gelsenkirchen MFH 3,4 % / ETW verm. 2,6 % · Köln MFH 2,9 % / ETW verm. 1,9 % · Bielefeld MFH 2,5 % / ETW verm. 2,9 % · Herford MFH 2,8 % (alle GMD NRW, Stichtag 31.12.2025) · Frankfurt MFH 2,8 % (sehr gut) bis 4,3 % (einfach), 01.01.2026 · München, Pirmasens: gesperrt |

**Daraus abgeleitete Renditebänder (Ist-BMR):**

| Lage | schwach | solide | gut |
|---|---|---|---|
| A (Top 7) | < 3,0 % | 3,0–4,0 % | > 4,0 % |
| B (Groß-/Mittelstadt) | < 4,0 % | 4,0–5,5 % | > 5,5 % |
| C (Kleinstadt, Strukturschwäche) | < 5,5 % | 5,5–7,0 % | > 7,0 % |

Die Vorgaben in `lage-profil.js:84` (Ziel-BMR A 3,5 / B 5,0 / C 7,0 %) liegen damit
**in** diesen Bändern; C liegt an der oberen Kante. Die Recherche bestätigt sie.

**4 · Cashflow nach Kapitaldienst, vor Steuern**

- Ziel **≥ 0 €/Monat** und „idealerweise ein kleiner Überschuss" (clean-invoice.com, drklein.de).
- Ein negativer Cashflow macht ein Objekt **nicht automatisch** zum schlechten Investment,
  weil Tilgung und Wertentwicklung mitzählen. Bedingung ist, dass der Zuschuss dauerhaft
  tragbar ist (clean-invoice.com, Ratgeber).
- Interhyp empfiehlt, den Cashflow über eine niedrigere Tilgung oder eine tilgungsfreie
  Anlaufphase zu steuern. **Eine einzelne €-Schwelle nennt keine Quelle.** Darum taugt
  der Cashflow in € schlecht als harte Grenze: er wächst mit der Objektgröße. Die DSCR
  ist dimensionslos.

**5 · Sanierungsbedarf / Instandhaltungsstau**

- Wertermittlung: Baumängel und Bauschäden sind **besondere objektspezifische
  Grundstücksmerkmale** (§ 8 Abs. 3 ImmoWertV). Sie werden nach der Marktanpassung
  durch **marktgerechte Abschläge** berücksichtigt, also nicht zwingend in Höhe der
  vollen Kosten, sondern so, wie der Markt sie einpreist.
- Laufende Instandhaltung im Ertragswertmodell: **14,40 €/m² Wfl. p. a.** (2026),
  Verwaltung 367 €/WE (ETW 439 €), Mietausfallwagnis 2 % (Anlage 3 ImmoWertV, über
  den VPI fortgeschrieben; `jahreswerte.json` `bwk_anlage3`, Quelle OGA Brandenburg).
- Rücklagen-Faustregeln: Peters'sche Formel (Herstellungskosten × 1,5 / 80 je m² und
  Jahr), VPB 1 €/m² und Monat, Verwalter 7–12 €/m² und Jahr (immowelt.de, jacasa.de;
  Ratgeber). Liquiditätsreserve: mindestens 2–3 Nettokaltmieten (drklein.de).
- **Profi-Praxis also:** Der Investitionsbedarf geht **voll in die Gesamtinvestition**
  (Kaufpreis + Nebenkosten + Sanierung). Rendite und Kapitaldienst werden auf diese
  Summe gerechnet, sonst sieht ein Sanierungsobjekt besser aus, als es ist.

**6 · Mietsteigerungspotenzial: wie viel Prognose seriös ist**

- **Bestand:** höchstens bis zur ortsüblichen Vergleichsmiete, frühestens 15 Monate
  nach Einzug bzw. ein Jahr nach der letzten Erhöhung, und höchstens **+20 % in drei
  Jahren**, in Gebieten mit Landesverordnung **+15 %** (§ 558 Abs. 1 und 3 BGB).
  Erhöhungen nach §§ 559–560 zählen nicht mit.
- **Neuvermietung:** Die Mietpreisbremse ist bis **Ende 2029** verlängert (Bundestag
  26.06.2025). Im Gebiet gilt höchstens Vergleichsmiete + 10 % (§ 556d BGB), Ausnahmen
  nach §§ 556e, 556f (Vormiete, Neubau, umfassende Modernisierung). Laut
  `frontend/js/data/kappungsgrenzen.json` (Stand 19.10.2026) gilt sie in **München,
  Frankfurt, Hamburg, Köln und Bielefeld**, also für B, F, H, C und E.
- **Markt:** Neuvertragsmieten MFH 2025 **+3,5 %** (vdp, 10.02.2026), Bestandsmieten
  (VPI Nettokaltmiete) 2025 **+2,1 %** (Destatis).
- **Seriös ist:** die zulässige Miete nach `sollFuer`-Logik (Vergleichsmiete ∧ Kappung
  ∧ Sperrfrist). Eine Fortschreibung der Vergleichsmiete um rund 2 % p. a. ist
  vertretbar, wenn sie gekennzeichnet ist. Die Angebotsmiete darf nur als Szenario
  „bei Neuvermietung" erscheinen, und in Bremsengebieten auch dann **nur bis
  Vergleichsmiete + 10 %**.

> **Das trifft DS2 doppelt.** Die Angebotsmiete ist nicht nur keine Bestandsprognose,
> sie ist in fünf der acht Fälle auch bei Neuvermietung **nicht zulässig**:
>
> | Fall | Vergleichsmiete | + 10 % (§ 556d) | Angebot (DS2-Upside) |
> |---|---:|---:|---:|
> | B | 18,50 | **20,35** | 22,50 |
> | C | 10,60 | **11,66** | 13,50 |
> | E | 9,40 | **10,34** | 10,50 |
> | F | 14,00 | **15,40** | 17,00 |
> | H | 13,20 | **14,52** | 17,50 (Verkäufer) |

### 5.2 Kennzahlen je Fall gegen die Recherche

Nachgerechnet aus den Eckdaten in Abschnitt 3. Faktor = KP / Jahres-NKM.
Darlehen/MW = Darlehen gegen den Marktwert.

| Fall | Faktor | KP/MW | BMR / Markt-BMR (Baufi24) | NMR vs. Zins 3,8 % | amtl. LZS (Register) | DSCR | CF in % der NKM | Darlehen/MW |
|---|---:|---:|---|---|---|---:|---:|---:|
| A | 10,4 | 0,94 | 9,60 / GE 5,24 | 6,81 > 3,8 | GE MFH 3,4 | 1,30 | +18 % | 94 % |
| B | 33,3 | 0,98 | 3,00 / M 3,22 | **2,39 < 3,8** | gesperrt | 0,91 | −9 % | 49 % |
| C | 27,1 | 0,91 | 3,69 / K 3,50 | **2,74 < 3,8** | K ETW 1,9 | 0,58 | −60 % | 82 % |
| D | 9,6 | 1,03 | 10,40 / – | 7,06 > 3,8 | gesperrt | 1,68 (mit Sanierung ≈ 1,06) | +30 % | 83 % |
| E | 18,4 | **0,73** | 5,44 / – | 4,17 > 3,8 | BI ETW 2,9 | 0,88 | −11 % | 66 % |
| F | 30,4 | 1,05 | 3,29 / F 3,24 | **2,56 < 3,8** | F MFH 2,8–4,3 | 0,44 | **−109 %** | **116 %** |
| G | 14,6 | 0,97 | 6,84 / – | 4,72 > 3,8 | HF MFH 2,8 | 1,12 | +8 % | 78 % |
| H | 34,2 | **1,18** | 2,92 / HH 3,02 | **2,31 < 3,8** | Formelwerk | 0,55 | −71 % | 94 % |

**D mit Sanierung (Überschlag, nur im Bericht gerechnet):** Ein Kapitaldienst von
13.920 € und eine DSCR von 1,68 ergeben einen Reinertrag von 23.400 €. Werden die
140.000 € zu 5,8 % (Zins + Tilgung) finanziert, steigt der Kapitaldienst auf 22.040 €.
Die DSCR liegt dann bei **≈ 1,06**, der Cashflow bei rund +113 €/Monat. Die Miete
liegt mit 6,50 €/m² schon über der Vergleichsmiete von 6,30 €. Die Sanierung hebt
also kaum Miete, sie erhält nur den Bestand.

**Zinsempfindlichkeit:** Bei 4,4 % statt 3,8 % (capitalo.de, Sept. 2026) fallen alle
DSCR um den Faktor 5,8 / 6,4 ≈ 0,91: A 1,18 · B 0,82 · C 0,53 · D 1,52 · **E 0,80**
· F 0,40 · **G 1,01** · H 0,50. E und G rutschen damit an die Kanten der Deckel
unten. Der Deckel muss deshalb mit dem **eingegebenen** Zins rechnen, nie mit einer
Konstanten.

### 5.3 Recherchierte Bänder je Fall

**Gesamt** gilt für einen einzelnen Ring. **Investment** und **Finanzierung** gelten
für die Zwei-Score-Variante. ✓ = im Band, ✗ = außerhalb (mit Richtung).

**A · Gelsenkirchen MFH, LTV 100 %, BMR 9,6 %**
Gesamt **Gut 70–84** · Investment **Gut 70–84** · Finanzierung **Solide–Gut 60–79**.
Die BMR liegt fast doppelt über dem Stadtwert (5,24 %), die NMR doppelt über dem
amtlichen MFH-Zins (3,4 %) und über dem Darlehenszins (positiver Hebel). „Sehr gut"
verhindern die C-Lage, Energieklasse E und ein Darlehen, das gegen den Beleihungswert
(MW −10 %) bei rund 105 % liegt. Interhyp empfiehlt NK + 5–10 % Eigenkapital, A bringt
nur die NK. Die DSCR 1,30 liegt im Bankband 1,20–1,35, die Finanzierung ist also
tragfähig, aber ohne Reserve beim Eigenkapital.
→ DS1 79 ✓ · DS2 81 ✓ · Alternative 79 ✓ · Investment 79 ✓ · Finanzierung 72 ✓

**B · München-Schwabing ETW, LTV 50 %, BMR 3,0 %**
Gesamt **Schwach bis untere Solide, 40–55** · Investment **Solide 50–64** ·
Finanzierung **Schwach 35–49**.
Die BMR liegt knapp unter dem Münchner Angebotsschnitt (3,22 %) und ist damit
**markttypisch für die A-Lage** und liegt genau an der Untergrenze des
Solide-Bands A (3,0 %). Die NMR von 2,39 % liegt unter dem Zins. Dr. Klein nennt das „oft schwer
rentabel". DSCR 0,91 heißt: das Objekt trägt sich nicht, aber die Zuzahlung beträgt
nur 9 % der Miete. Bei 50 % Eigenkapital liegt der Kredit unter der Realkreditgrenze.
„Kritisch" ist nach keiner Quelle begründbar.
→ DS1 31 ✗ zu streng · DS2 55 ✓ (Rand) · Alternative 52 ✓ · Investment 54 ✓ · Finanzierung 39 ✓

**C · Köln-Kalk ETW, LTV 90 %, Ist-Miete 8,00 €/m²**
Gesamt **Schwach 35–49** · Investment **Solide 55–69** · Finanzierung **Kritisch 0–34**.
Die BMR von 3,69 % liegt über dem Kölner Schnitt, der KP 9 % unter dem Marktwert. Die
Miete darf in drei Jahren um 15 % steigen (Kappung Köln), bei Neuvermietung bis
11,66 €/m² (Bremse). Das Objekt ist solide. Die Finanzierung trägt es nicht: DSCR 0,58,
Zuzahlung 60 % der Miete, also rund 4.300 € im Jahr. Mit dem Darlehenszins über der
NMR wird jeder weitere Fremdkapital-Euro teurer, als er einbringt.
→ DS1 23 ✗ zu streng · DS2 51 ✗ zu mild (knapp) · Alternative 54 ✗ zu mild · Investment 58 ✓ · Finanzierung 15 ✓

**D · Pirmasens MFH, Sanierung 140.000 € (47 % des KP)**
Gesamt **Solide 50–64** · Investment **Solide 50–64** · Finanzierung (mit
Sanierungskredit) **Solide 50–69**.
BMR 10,4 % und Faktor 9,6 sehen nach „Sehr gut" aus. Profis rechnen aber auf die
Gesamtinvestition: (300.000 + 31.500 + 140.000) ergibt eine BMR von 6,6 %. Das ist das
Solide-Band der C-Lage. Der KP liegt 3 % **über** dem Marktwert, Zustand G, Bevölkerung
fallend. Mit finanzierter Sanierung sinkt die DSCR auf ≈ 1,06. Das ist nach den
Vermittlerquellen „grenzwertig", die Bank verlangt mehr Eigenkapital oder Sicherheiten.
→ DS1 86 ✗ viel zu mild · DS2 72 ✗ zu mild · Alternative 65 ✗ (1 Punkt über) ·
Investment 62 ✓ · Finanzierung 93 ✗ zu mild (der Kapitaldienst kennt die Sanierung nicht,
ein Datenfehler, kein Gewichtungsfehler)

**E · Bielefeld ETW, KP 27 % unter Marktwert**
Gesamt **Solide 55–69** · Investment **Gut 70–84** · Finanzierung **Schwach 35–49**.
Die NMR von 4,17 % liegt deutlich über dem amtlichen ETW-Zins Bielefeld (2,9 %) und
über dem Darlehenszins. Faktor 18,4 liegt unter der 20er-Faustregel. Der Preisvorteil
von 55.000 € ist real. Gegen den Marktwert beträgt das Darlehen 66 %, die Beleihung ist
also gut. DSCR 0,88 und −77 €/Monat (11 % der Miete) machen die Finanzierung schwach,
aber nicht kritisch. Ohne den knappen Kapitaldienst wäre das Gesamturteil „Gut".
→ DS1 48 ✗ zu streng · DS2 59 ✓ · Alternative 68 ✓ · Investment 73 ✓ · Finanzierung 24 ✗ zu streng
(die DS1-Kurven geben ab DSCR ≤ 0,9 null Punkte und messen den LTV gegen den KP statt gegen den MW)

**F · Frankfurt-Bornheim ETW, 110 % finanziert, −1.251 €/Monat**
Gesamt **Kritisch 0–34** · Investment **Schwach–Solide 40–54** · Finanzierung **Kritisch 0–20**.
Die BMR liegt mit 3,29 % genau auf dem Frankfurter Schnitt (3,24 %). Das Objekt ist
markttypisch, aber 5 % über dem Marktwert gekauft. Die Finanzierung liegt außerhalb
dessen, was die Quellen als üblich beschreiben: 110 % gibt es „selten", das Darlehen
beträgt 116 % des Marktwerts, die DSCR 0,44, die Zuzahlung mehr als die ganze Miete
(15.000 € im Jahr). Dazu kommen nach capitalo.de Zinsaufschläge für hohe Beleihung, die
der Benchmark nicht einrechnet.
→ DS1 9 ✓ · DS2 43 ✗ zu mild · Alternative 45 ✗ zu mild · Investment 50 ✓ · Finanzierung 0 ✓

**G · Herford MFH 8 WE, LTV 80 %**
Gesamt **Gut 70–84** · Investment **Gut 70–84** · Finanzierung **Solide–Gut 60–74**.
Die NMR von 4,72 % liegt deutlich über dem amtlichen MFH-Zins Herford (2,8 %), die
BMR von 6,84 % im Gut-Band der B-Lage, der KP 3 % unter dem Marktwert. Der Cashflow ist
positiv. Die DSCR von 1,12 liegt aber **unter** dem verbreiteten Bankwert 1,2 und gilt
als „grenzwertig". Bei 4,4 % Zins wären es 1,01.
→ DS1 81 ✓ · DS2 76 ✓ · Alternative 78 ✓ · Investment 77 ✓ · Finanzierung 81 ✗ (7 Punkte zu mild)

**H · Hamburg-Eimsbüttel ETW, KP 18 % über Marktwert, Verkäuferprognose 17,50 €/m²**
Gesamt **Kritisch bis untere Schwach, 15–40** · Investment **Schwach 35–49** ·
Finanzierung **Kritisch 0–34**.
70.000 € über dem Marktwert gekauft, das ist rund die Hälfte des eingesetzten
Eigenkapitals. Die BMR liegt mit 2,92 % unter dem Hamburger Schnitt. Die Ist-Miete von
14,00 €/m² liegt schon über der Vergleichsmiete (13,20 €), § 558 bringt also nichts.
Bei Neuvermietung erlaubt die Bremse höchstens 14,52 €/m², die Verkäuferprognose von
17,50 € ist rechtlich nicht erreichbar. DSCR 0,55, Zuzahlung 71 % der Miete. **Die
Grenze zwischen Kritisch und Schwach ist hier Ermessen**, deshalb ist das Band breiter.
→ DS1 18 ✓ · DS2 51 ✗ zu mild · Alternative 38 ✓ (Rand) · Investment 40 ✓ · Finanzierung 23 ✓

**Trefferbild:**

| Variante | im Band | daneben |
|---|---:|---|
| DS1 heute | 4 / 8 | B, C, E zu streng; D viel zu mild |
| DS2 balanced | 4 / 8 | C, D, F, H zu mild (Angebotsmiete als Upside, LTV-Belohnung) |
| Alternative (ein Ring) | 5 / 8 | C, F zu mild; D 1 Punkt darüber |
| Zwei Scores: Investment | **8 / 8** | – |
| Zwei Scores: Finanzierung | 5 / 8 | D (Sanierung fehlt im Kapitaldienst), E zu streng, G leicht zu mild |
| **Investment mit DSCR-Deckel (5.4)** | **8 / 8** | H an der Kante (40) |
| **Alternative mit DSCR-Deckel (5.4)** | **7 / 8** | D 65 (1 Punkt über) |

### 5.4 Empfehlung: die harte Grenze

**Die Grenze hängt an der DSCR (netto, wie seit v3031), nicht am Cashflow in €.**
Die DSCR ist die Kennzahl, mit der Banken die Tragfähigkeit prüfen, und sie ist
unabhängig von der Objektgröße. Der Cashflow dient nur als zweite Zeile im Text.

| Stufe | Bedingung (mit dem **eingegebenen** Zins) | Höchsturteil | Begründung |
|---|---|---|---|
| 0 | Barkauf oder DSCR ≥ 1,2 | kein Deckel | Bankübliche Mindestdeckung mit Puffer erreicht |
| 1 | 1,0 ≤ DSCR < 1,2 | **Gut (≤ 84)** | Trägt sich, aber unter dem verbreiteten Bankwert. „Sehr gut" nur mit Reserve |
| 2 | 0,8 ≤ DSCR < 1,0 | **Solide (≤ 69)** | Trägt sich nicht selbst, Zuzahlung klein. Die Bank stützt sich auf das Einkommen |
| 3 | DSCR < 0,8 | **Schwach (≤ 49)** | Zuzahlung erheblich (C −60 %, H −71 %). Die Finanzierung trägt das Objekt nicht |
| 4 | DSCR < 0,8 **und** Darlehen > Marktwert | **Kritisch (≤ 34)** | Unterdeckt und unbesichert zugleich (F: 116 % des MW). Restschuld bleibt auch nach Verkauf |

Am Fall wirkt der Deckel so: auf den Investment-Score gelegt C 58 → **49**,
E 73 → **69**, F 50 → **34**. Auf die Alternative gelegt C 54 → 49, F 45 → 34.
B, H, A, D und G bleiben unverändert.

**Die Empfehlung aus Abschnitt 4 wird damit präziser:** zwei Scores anzeigen
(Investment und Finanzierung) und als Gesamturteil bzw. Empfehlung **den
Investment-Score unter dem DSCR-Deckel** nehmen. Das trifft alle acht Bänder. Ist nur
ein Ring gewollt, trifft die Alternative mit demselben Deckel sieben von acht.

**Was der Deckel nicht löst:** D braucht Zustand und Investitionsbedarf im Quick-Check
(Gesamtinvestition in Rendite **und** Kapitaldienst). E zeigt, dass die DS1-Kurven für
LTV (gegen den KP) und DSCR (≤ 0,9 = 0) zu hart sind. In der Finanzierungsnote sollte
der LTV gegen den Marktwert bzw. Beleihungswert gemessen werden.

### 5.5 Kurzfassung

**Bänder je Fall:**
A Gut 70–84 · B Schwach/Solide 40–55 · C Schwach 35–49 · D Solide 50–64 ·
E Solide 55–69 · F Kritisch 0–34 · G Gut 70–84 · H Kritisch/Schwach 15–40.

**Harte Grenze:** DSCR ≥ 1,2 frei · 1,0–1,2 höchstens Gut · 0,8–1,0 höchstens Solide ·
< 0,8 höchstens Schwach · < 0,8 und Darlehen > Marktwert höchstens Kritisch. Gerechnet
mit dem eingegebenen Zins.

**Wichtigste Quellen:**
- Dr. Klein, MFH als Renditeobjekt (06.10.2026): https://www.drklein.de/finanzierung-mehrfamilienhaus-beleihen-faq.html
- Dr. Klein, Renditeobjekte (25.06.2026): https://www.drklein.de/renditeobjekte.html
- Dr. Klein Trendindikator T2/2026 (16.09.2026): https://www.drklein.de/fileadmin/drk/ueber-dr-klein/pressemitteilungen/pm-drk-dtb-2026-T2.pdf
- Interhyp, Immobilie als Kapitalanlage (Sept. 2025): https://start.immocation.de/hubfs/Interhyp_Immocation_Info-PDF_Kapitalanleger_September2025.pdf
- Baufi24-Mietrenditeatlas H2/2025: https://www.baufi24.de/presse/pressemitteilungen/mietrendite-trend-022026/ · H1/2026: https://www.baufi24.de/presse/pressemitteilungen/mietrendite-trend-082026/
- vdp-Index Q4/2025 (10.02.2026): https://www.pfandbrief.de/wp-content/uploads/2026/02/20260210_vdp_PM_vdp-Index_Q4_2025_DE_final.pdf
- Destatis VPI 2025: https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/01/PD26_019_611.html (Nettokaltmieten +2,1 % nach IHK Hannover: https://www.ihk.de/hannover/hauptnavigation/standort/konjunktur-statistik/aktuell/inflationsrate-2025-stabil-bei-2-2-prozent-6940438)
- § 558 BGB: https://www.gesetze-im-internet.de/bgb/__558.html · Mietpreisbremse bis 2029: https://www.lto.de/recht/nachrichten/n/bundestag-verlaengert-mietpreisbremse-bis-2029
- § 48u KWG: https://www.gesetze-im-internet.de/kredwg/__48u.html · § 8 ImmoWertV: https://www.gesetze-im-internet.de/immowertv_2022/__8.html
- Zinsen nach Beleihung (Marktbandbreite 18.09.2026): https://www.capitalo.de/anbieter/capitalo/news/bauzinsen-aktuell
- DSCR-Praxis (Vermittler, 2026): https://finanzplusimmo.de/ratgeber/traegt-sich-das-mehrfamilienhaus-selbst
- Cashflow-Faustregel (Ratgeber): https://www.clean-invoice.com/wissen/allgemein/mietrendite-berechnen · Rücklagen (Ratgeber): https://www.immowelt.de/ratgeber/wohnen/instandhaltungsruecklage, https://www.jacasa.de/ratgeber/lexikon/instandhaltungsruecklage
- Amtliche Liegenschaftszinssätze: Register `lzs-swf-2026-nachernte.json` (GMD NRW, https://www.opengeodata.nrw.de/produkte/infrastruktur_bauen_wohnen/boris/GMD/GMDNRW_CSV.zip), `lzs-he-2026.json`; Bewirtschaftungskosten: `jahreswerte.json` `bwk_anlage3`

**Grenzen der Recherche:** Kein Primärtext einer Bank-Kreditrichtlinie war erreichbar.
Die Bundesbank-Seite zu Wohnimmobilienfinanzierungen nennt keine LTV- oder DSTI-Werte.
Die DSCR-Schwellen 1,10 / 1,24 / 1,35 stammen aus Ratgeber-Suchtreffern, die nicht
geöffnet wurden. Baufi24 rechnet mit Angebotsmieten und überzeichnet die Bestands-BMR.
Für München und Pirmasens führt das Register keinen offenen Liegenschaftszins (Sperre).
