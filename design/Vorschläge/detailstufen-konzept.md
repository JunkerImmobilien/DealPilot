# Detailstufen und Zielbild als Mietleiter — Konzept (Entwurf)

Stand 02.11.2026 · Demo-first, nichts in der App geändert · Demo: `design/Vorschläge/detailstufen-demo.html`

Anlass: Messe-Feedback („von Anfänger bis Profi alles dabei") und Marcels Wunsch, den Umfang
der App stufenweise zu erweitern — ein einfach angelegtes Objekt soll später erweiterbar sein,
und jede Stufe endet in einer Bewertung und einem Investment-PDF. Dazu: das Zielbild ist
„cool, aber überfordernd" — einfacher darstellen und die erreichbare Miete aus Lage und Daten
prognostizieren.

---

## 1 · Was es schon gibt (gemessen, nicht angenommen)

| Baustein | Fundstelle | Reichweite |
|---|---|---|
| Eingabetiefe 1/2/3 „Einfach · Mittel · Ausgiebig" | `frontend/js/objekt-reiter.js` (Merker `dp_zielstufe` Z. 716, Ausblenden über `[data-oe-stufe-min]`, Pflicht je Stufe `pflichtFuer()` Z. 633–669) | **nur Reiter Objekt**, Merker global im Browser, Vorgabe 1 |
| Zweistufiger Arbeitsablauf „einfach / detailliert" | `frontend/js/workflow.js:73`, `dp_user_settings.workflow_detail_level` | Pflichtfelder je Bereich (Fortschrittsanzeige) |
| Einfach / Genau | Pilot-Analyse (`wert-zielbild.js`), Portfolio-Cockpit (`dashboard.js:1118-1168`) | nur Darstellung |
| „Bereit für die Bank?" | `deal-action-readycheck.js:141-255` | Vollständigkeitsprüfung |
| Investor Deal Score erst ab 70 % von 24 KPIs | `dealscore2-ui.js:323-335` (`_dpDs2Schwelle`) | sonst nur einfacher Deal Score (Score-Hero) |
| Vorschlag vom 07.09.2026 „Wie ausführlich soll die Eingabe sein?" | `design/Vorschläge/eingabemodus-demo.html` | nie ausgerollt; gemessen damals 238 Felder, 93 im Reiter Objekt |

**Befund:** Es gibt **drei** Stufen-Mechaniken nebeneinander (Eingabetiefe 1–3, `workflow_detail_level`,
Einfach|Genau), mit drei Merkern. Wer eine vierte daneben baut, macht das Problem größer.
**Vorschlag: ein Merker, eine Stufe, die alle drei steuert** — die Eingabetiefe ist der Kern,
die anderen beiden lesen sie.

**Wichtige Lücke:** Die heutige Eingabetiefe 1 kennt **weder Kaufpreis noch Miete** — sie liefert eine
Marktpreisindikation, aber keine Investment-Bewertung. Marcels Anforderung („mit jeder Stufe zu einer
Bewertung und einem Investment-PDF") verlangt deshalb, dass die Einstiegsstufe **Kaufpreis und
Kaltmiete** dazunimmt. Die Eingabetiefe ist heute eine Wertermittlungs-Tiefe, keine Investment-Tiefe.

---

## 2 · Stufenmodell

| | **Sichtflug** · Einsteiger | **Instrumentenflug** · Investor | **Langstrecke** · Profi |
|---|---|---|---|
| Baut auf | Eingabetiefe 1 **+ Kaufpreis, Kaltmiete** | Eingabetiefe 2 | Eingabetiefe 3 + alle Reiter |
| Eingaben (Wohnung) | **8** Pflicht: Adresse (PLZ, Ort, Straße), Objektart, Wohnfläche, Baujahr, Kaufpreis, Kaltmiete — dazu Eigenkapital, vorbelegt aus dem Profil (Demo: 9 Felder) | **≈ 22**: + Hausgeld, Zustand, Energie, Standardstufe, Zimmer, Etage, Eigenkapital, Zins, Tilgung, Grenzsteuersatz, Leerstand, Instandhaltung | **alle** (heute ≈ 238): + Grundstück, BRW, BGF, MEA, NHK, Steuer im Detail (AfA, § 7b), Mietverträge je Einheit, Zielbild, Bankexport |
| Sichtbare Reiter | Objekt · Miete · Ergebnis (Finanzierung als **eine** Zeile „Eigenkapital") | + Finanzierung, Steuer (kurz), Bewertung | alle |
| Was DealPilot vorbelegt | Finanzierung, Kosten, Steuer **aus dem Investmentprofil**; Marktmiete, Lage, Bevölkerung, Nachfrage aus Marktdaten; Kaufnebenkosten aus Land (GrESt) | Finanzierung sichtbar und änderbar; Vorbelegung bleibt, wo leer | nichts still — jede Vorbelegung als solche gekennzeichnet |
| Ergebnis | Rendite, Cashflow, DSCR, DealPilot-Score, Marktpreisindikation | + Investor Deal Score, Steuer-Cashflow, erweiterte Indikation | + Sach-/Ertragswert nach ImmoWertV, Zielbild, Bank-Mappe |
| Investment-PDF | „Kurzbericht · Sichtflug" | „Investorbericht" | heutiges Voll-PDF |

**Namen:** Sichtflug / Instrumentenflug / Langstrecke passen zur Luftfahrt-Bildsprache und sagen
etwas über die Tiefe (auf Sicht — mit Instrumenten — weit voraus). Klarname immer daneben:
Einsteiger · Investor · Profi. Alternativen, falls Marcel will: *Rundflug · Linienflug · Langstrecke*.

### Wechsel jederzeit, nichts geht verloren
- Ausgeblendet wird die **Anzeige**, nicht der Inhalt. Felder behalten ihre Werte (heute schon so
  bei `data-oe-stufe-min`), Rechnungen benutzen eingetragene Werte auch in der kleineren Stufe.
- Ausgeblendete Felder mit eigenem Wert werden gezählt: „3 eigene Angaben in Instrumentenflug" — ein
  Klick zeigt sie. Sonst rechnet ein Einsteiger mit einem Wert, den er nicht sieht.
- **Hochschalten** öffnet nur neue Felder, vorbelegt mit dem, was bisher als Vorgabe gerechnet wurde
  (sichtbar als Vorgabe, nicht als eigene Angabe).
- Herunterschalten ändert **kein** Ergebnis.

### Global oder je Objekt — Empfehlung: **beides, mit klarer Rangfolge**
- **Nutzer-Stufe (global)** = Vorgabe für neue Objekte. Gefragt **einmal**, beim ersten Objekt
  (wie im Vorschlag 07.09.), danach in den Einstellungen. Sie wandert ins Profil auf dem Server
  (`dp_user_settings`), nicht nur in `localStorage` wie heute `dp_zielstufe`.
- **Objekt-Stufe** = gespeichert am Objekt, Knopf „Dieses Objekt genauer rechnen" im Objektkopf.
- Begründung: Das PDF muss sagen, in welcher Stufe *dieses* Objekt gerechnet wurde — das gehört
  ans Objekt. Und dasselbe Konto hat typischerweise ein schnelles Ankauf-Screening (Sichtflug) und
  ein gekauftes Bestandsobjekt (Langstrecke) nebeneinander. Ein globaler Schalter würde jedes Mal
  das falsche Objekt umstellen.

---

## 3 · Bewertung und Score bei weniger Feldern — die Kollision

**Die Kollision:** Der Investor Deal Score erscheint erst ab 70 % von 24 KPIs. Im Sichtflug sind
eigene Angaben nur für etwa 6–8 KPIs da (Brutto-/Nettorendite, Cashflow, Faktor, Bausubstanz,
Ist-/Marktmiete …). Zählt man die Vorgaben aus dem Investmentprofil und Marktdaten mit (Zins,
Tilgung, LTV, EK-Bedarf, Leerstand, Instandhaltung, Lage, Bevölkerung, Nachfrage …), kommt man über
70 % — aber dann bewertet der Score **zu einem großen Teil die eigenen Vorgaben**, nicht das Objekt.

**Vorschlag (Variante A, Empfehlung):**
1. Die Schwelle bleibt 70 %. KPIs werden nach Herkunft gezählt: **eigene Angabe · Marktdaten ·
   Vorgabe aus dem Profil**.
2. Marktdaten zählen voll (sie sind objektbezogen). Vorgaben zählen, wenn die Stufe sie verlangt —
   der Score trägt dann das Siegel **„vorläufig · n von 24 aus Vorgaben"**.
3. Im Sichtflug ist das **Hauptergebnis der einfache DealPilot-Score** (5 Faktoren, heute schon da);
   der Investor Deal Score steht klein als „vorläufig" daneben.
4. Ab Instrumentenflug ohne Siegel, sobald Vorgaben unter 30 % liegen.

Variante B (strenger): Im Sichtflug gar kein Investor Deal Score, nur der einfache Score.
Variante C (weicher): Vorgaben zählen ohne Siegel — **nicht empfohlen**, verwischt die Herkunft.

**Wertermittlung:** Sichtflug zeigt die heutige Marktpreisindikation (Eingabetiefe 1). Sach- und
Ertragswert nach ImmoWertV gibt es erst in Langstrecke — **kein Verfahren rechnet halb**. Das PDF
der kleineren Stufen sagt das ausdrücklich: „Verkehrswert nach ImmoWertV: nicht gerechnet — dafür
fehlen Grundstück, Bodenrichtwert, BGF. Schalte auf Langstrecke."

### Was im Investment-PDF steht und wie „vereinfacht" gekennzeichnet ist
- Kopf: Stufe als Band („Kurzbericht · Sichtflug — vereinfachte Rechnung").
- Jede Zahl trägt ihre Herkunft wie heute im Marktbericht: **eigene Angabe · Marktdaten ·
  amtlich · DealPilot-Vorgabe (Investmentprofil)**. Vorgaben **nie** als amtlich, nie ohne Marke.
- Eine Seite „Was dieser Bericht nicht enthält" mit der Liste der Felder, die eine höhere Stufe
  bringen würde, und was sie ändern (z. B. „Steuer: AfA nicht gerechnet, Cashflow nach Steuer
  vorläufig").
- Bank-Export und „Bereit für die Bank?" erst ab Instrumentenflug; im Sichtflug ausgegraut mit Grund.

---

## 4 · Zielbild einfacher: die Mietleiter

Heute: drei Begriffe (Ist / Soll / Zielbild), vier Eingabefelder, Maßnahmenliste und Summenzeile in
einer Karte (`index.html:1854-1877`), beim MFH je Wohnung im Aufklapper „Details · Plan"
(`mfh-einheiten.js`). Rechnerisch richtig, sprachlich zu viel.

**Vorschlag: eine Karte, vier Sprossen, je Sprosse eine Zahl und eine Herkunft.**

| Sprosse | Bedeutung | Rechnung | Herkunft |
|---|---|---|---|
| **1 · Heute** | Ist-Miete | Eingabe | eigene Angabe |
| **2 · Ohne Maßnahme** | Mieter bleibt, normale Erhöhung | min(Vergleichsmiete, Ist × (1 + Kappung)), mit Datum der nächsten Erhöhung (Sperrfrist 15 Monate, § 558 / § 558b) — heute `sollFuer()`/`mhTermine()` in `potenzial.js` | Kappung amtlich (Verordnung je Gemeinde), Vergleichsmiete je nach Quelle |
| **3 · Bei Mieterwechsel** | Neuvermietung ohne Umbau | **mit Mietpreisbremse:** max(Vergleichsmiete × 1,10; Vormiete) (§ 556d, § 556e); **ohne:** Neuvertragsmiete am Markt | Bremse amtlich (Landesverordnung), Marktmiete „aktueller Marktdurchschnitt" |
| **4 · Nach Sanierung** | Umbau, dann neu vermietet | Marktmiete im Zustand „neuwertig/modernisiert"; nach **umfassender** Modernisierung gilt die Bremse bei Erstvermietung nicht (§ 556f S. 2) | Marktdaten (Zustandsfilter) oder amtlich, wo vorhanden (Minden-Lübbecke); sonst eigene Angabe oder DealPilot-Näherung |

- Jede Sprosse: Zahl €/m² und € im Monat, Abstand zur vorigen in € pro Jahr, ein Herkunfts-Etikett.
- **Wo keine Zahl belegt ist, steht keine** — die Sprosse zeigt den Weg („Mietspiegel deiner Stadt:
  Link") und ein Feld für die eigene Angabe.
- Lange Mietverhältnisse ohne Anpassung werden **hervorgehoben** (Marcels Punkt): „Mieter seit 2009,
  letzte Erhöhung unbekannt — Abstand zur Vergleichsmiete 2,90 €/m²". Das ist der Fall, in dem
  Sprosse 2 und 3 auseinanderliegen.
- **MFH:** dieselbe Leiter als **Zeile je Wohnung** (Heute · Ohne Maßnahme ab · Wechsel · Sanierung),
  Summenzeile darunter. Klick auf die Zeile öffnet das heutige „Details · Plan" — nichts fällt weg.
- Die Maßnahmenliste mit Modernisierungspunkten wandert unter Sprosse 4 („Was kostet die Sanierung?")
  und ist im Sichtflug zugeklappt.

### Was heute rechenbar ist und was neue Daten braucht — Umsetzungsreihenfolge

| # | Baustein | Stand | Aufwand |
|---|---|---|---|
| 1 | Sprossen 1 + 2 (Heute, ohne Maßnahme, Datum) | **rechenbar** — `potenzial.js` `sollFuer()`, `mhTermine()`, Kappung je Gemeinde aus `kappungsgrenzen.json` | nur Darstellung |
| 2 | Sprosse 3 mit Mietpreisbremse | **Daten da, nicht ausgewertet**: `kappungsgrenzen.json` führt `mietpreisbremse` je Gemeinde (759 Einträge `true`) und `mietpreisbremse_gelistet` je Land; kein Code liest es (gemessen: nur `indexmiete.js` erwähnt § 556d im Kommentar). Gültigkeit je Verordnung (`gueltig_bis`) prüfen | klein |
| 3 | Vergleichsmiete aus dem Mietspiegel (Sprosse 2 und 3 werden belastbar) | **fehlt** — Paket `Dateien/Mietrecht/mietrecht-ort-1.3.0.zip` liegt ungenutzt (Bewertung BACKLOG.md ~Z. 655–824). Bis dahin: Marktmiete aus Reiter Miete, gekennzeichnet „Vergleichsmiete genähert — bitte Mietspiegel prüfen" | mittel |
| 4 | Sprosse 3 ohne Bremse (Neuvertragsmiete) | **teilweise** — GeoMap-Angebotsmieten (`MarketAnalysisService.js:194-219`) sind Angebotspreise; mit dem vorhandenen Angebotsabschlag als „aktueller Marktdurchschnitt" | klein bis mittel |
| 5 | Sprosse 4 nach Sanierung | **teilweise** — Zustandsfilter der Angebotsmieten (gleiche Quelle) für „neuwertig/modernisiert"; amtlich nur Minden-Lübbecke (`PotenzialService.js:238-275`, `lib/mietmodell_nrw.js`); sonst eigene Angabe | mittel |
| 6 | KI-Mietrecherche (`ki-miete.js`) als Begründung einblenden | da | klein — nur als Text, nie als Zahl ohne Quelle |

Reihenfolge-Empfehlung: **1 → 2 → 4 → 5 → 3** (3 ist am größten, die Leiter funktioniert vorher
schon mit Kennzeichnung). Flugplan-Demo (`design/mockups/flugplan-demo.html`, BACKLOG N82, geparkt)
ist damit nicht verworfen: die Mietleiter ist der „Soll/Ist"-Teil daraus in einfacher Form.

---

## 5 · Entscheidungen für Marcel

1. **Namen:** Sichtflug · Instrumentenflug · Langstrecke (mit Einsteiger · Investor · Profi)?
2. **Einstiegsstufe mit Kaufpreis und Miete** — die heutige Eingabetiefe 1 wird damit um zwei
   Pflichtfelder größer. Einverstanden?
3. **Score im Sichtflug:** Variante A (Investor Deal Score mit Siegel „vorläufig, n aus Vorgaben"),
   B (nur einfacher Score) oder C (Vorgaben zählen still)? Empfehlung A.
4. **Global + je Objekt** (Empfehlung) oder nur global?
5. **Drei Mechaniken zu einer zusammenlegen** (`dp_zielstufe`, `workflow_detail_level`, Einfach|Genau) —
   Einfach|Genau in Pilot-Analyse/Cockpit folgt dann der Stufe, bleibt aber umschaltbar?
6. **Mietleiter Sprosse 3 ohne Mietspiegel:** mit genäherter Vergleichsmiete (gekennzeichnet) zeigen
   oder leer lassen, bis `mietrecht-ort` eingebaut ist? Empfehlung: zeigen, gekennzeichnet — für den
   Liegenschaftszins gilt dieselbe Haltung (Wert mit ausgewiesener Ebene).
7. **Sanierungsmiete aus Angebotsdaten** ist Marktdurchschnitt, nicht amtlich — reicht das im
   Kundenbericht als „aktueller Marktdurchschnitt im Zustand modernisiert"?
