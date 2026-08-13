# Inventar — Sachwertfaktor-Rezepte NRW (Stand 13.08.2026)

Quellen: `claude/v1083-ernte-owl-ruhr.md` · `claude/v1083-ernte-rheinschiene.md` ·
`claude/v1083-ernte-fuenf-staedte.md` · `claude/v1083-ernte-hoexter-iserlohn-mk.md` ·
`claude/v1083-ernte-hoexter-mk-belegt.md` · `claude/v1083-korrektur-bonn-20260812.md`
Zellwerte Höxter und Gegenprobe Märkischer Kreis zusätzlich aus
`/root/ernte/out/swf_roh.json`; alle Schlüssel gegen
`/root/ernte/gmd2025/schluessel.csv` nachgeschlagen.

**14 Rezepte, 31 Modelle.** Jede Zahl stammt aus einem der Dokumente bzw. aus
`swf_roh.json`; nichts ergänzt, nichts interpoliert, nichts fortgesetzt.
Fehlwerte sind `null`, Klammerwerte sind übernommen und als Vorbehalt markiert.

---

## Die Tabelle

| Datei | Ausschuss (GAA) | AGS | Ebene | Form(en) | Zweige | Ber.jahr | Beispiel? | vollständig? |
|---|---|---|---|---|---|---|---|---|
| `10200-bielefeld.json` | Stadt Bielefeld (10200) | 05711000 | gemeinde | matrix_kategorial (35×3) | ezfh | 2026 | **ja**, 320.000/gut → 1,14 → SW 354.800 € | **ja** |
| `312-hoexter.json` | Kreis Höxter (31200) | 05762 | kreis | matrix_interp (56×8 = 448 Zellen) + 2 Stufenkorrekturen | ezfh | 2026 | **ja**, 300.000/80 → 0,70 → mit RND 55 und BGF 300 → 0,77 | **ja** — nur die Objektartabgrenzung ist im Erntedokument nicht beziffert |
| `314-kreis-lippe.json` | Kreis Lippe und Stadt Detmold (31400) | 05766 | kreis | doppel_log | ezfh | 2026 | **ja**, 600 m²/320.000 € → 90,86 % | **ja** |
| `321-kreis-paderborn.json` | Kreis Paderborn (32100) | 05774 | kreis | matrix_interp (10×4) | ezfh | 2026 | **ja**, 400.000/200 → 0,87 → 348.000 € | fast — Spaltenzuordnung Zeilen 600k/650k aus Monotonie erschlossen; keine Fallzahl/Streuung |
| `270-stadt-paderborn.json` | Stadt Paderborn (27000) | 05774032 | gemeinde | 3× linear_sachwert | efh, rhdhh, zfh | 2026 | **ja**, alle drei | **ja** |
| `243-iserlohn.json` | Stadt Iserlohn (24300) | 05962024 | gemeinde | 2× stufen_1d | ezfh, rhdhh | 2026 | nein → Zählprüfung (5 bzw. 4 Stützstellen) | fast — kein Stichtag beziffert |
| `315-maerkischer-kreis.json` | Märkischer Kreis (31500) | 05962 | kreis | 2× stufen_1d (Zeitreihe) | ezfh, rhdhh | 2026 | nein → Zählprüfung (14 bzw. 8 Stützstellen) | fast — Lizenz widersprüchlich → `null`; Fallzahl rhdhh fehlt |
| `10300-bochum.json` | Stadt Bochum (10300) | 05911000 | gemeinde | konstante + 4 Korrekturen (`basiswert_additiv`) | ezfh | 2026 | **ja**, 1,21+0,06−0,15+0,02+0,05 = 1,19 | fast — Lagegrenzen der Wohnlageklassen unbestätigt |
| `10600-dortmund.json` | Stadt Dortmund (10600) | 05913000 | gemeinde | 2× matrix_kategorial (15×4, 18×4) + stufen_1d, alle `liefert: zuschlag_prozent` | rh, ezfh, ezfh_rh | 2026 | **ja** für die Baujahrstabelle, Gebiet 1/Bj 1960 → 34 % → 1,34 → 546.000 € | **nein** — Gebietsdefinition (Ziffer 8.1) fehlt, Lizenz/Stichtag/Auswertejahre fehlen |
| `10700-duesseldorf.json` | Landeshauptstadt Düsseldorf (10700) | 05111000 | gemeinde | 5× matrix_band (8×6, 4×6, 3× 1×6) | ezfh, rh, dreifh, mfh, ggg | 2026 | nein → Zählprüfung | fast — keine Fallzahlen/Streuungen im Bericht; Stufe B |
| `10800-duisburg.json` | Stadt Duisburg (10800) | 05112000 | gemeinde | 4× konstante | efh, rhdhh, rmh, zfh | 2026 | nein → Zählprüfung | **nein** — 5. Teilmarkt (29 Fälle) unerfasst; Lizenz, Stichtag, Quell-URL fehlen |
| `10900-essen.json` | Stadt Essen (10900) | 05113000 | gemeinde | 2× konstante | ezfh, rmh | 2026 | nein → Zählprüfung gegen Median/Spanne | fast — Lizenz nirgends abgedruckt; Kauffallzahlen fehlen |
| `11400-koeln.json` | Stadt Köln (11400) | 05315000 | gemeinde | matrix_kategorial (23×6) + additive Bodenwertniveau-Korrektur | ezfh | 2026 | **ja**, 500.000 links freistehend, BWN 500 → 1,06 − 0,05 = 1,01 | fast — nur Browser-Extraktion, nicht `pdftotext` |
| `30600-rhein-erft-kreis.json` | Rhein-Erft-Kreis (30600) | 05362 | kreis | 4× matrix_interp (12×12, 12×12, 9×12, 11×12) | ezfh, rhdhh, rmh, fertighaus | 2026 | nein → Zählprüfung | fast — keine Streuung/Fallzahl je Typ |

**Kein Rezept** (siehe `_fehlend.md`): **Stadt Lüdenscheid (25200, AGS
05962032)** — Form `potenz` bekannt, Koeffizienten a und b nirgends auffindbar.
**Kreis Gütersloh (30800)** — keine Quelle. **Bundesstadt Bonn (10400)** — nur
Liegenschaftszinssätze, keine Sachwertfaktoren.

---

## Nachträge vom 13.08.2026

### Höxter — die 448 Zellen, gemessen statt geglaubt

Quelle `/root/ernte/out/swf_roh.json`, Schlüssel `312_hoexter`, Zellen
unverändert übernommen. Alle Prüfungen bestanden:

```
Spalten 8 / erwartet 8            OK
Zeilen 56 / erwartet 56           OK
Zellen 448 / erwartet 448         OK   keine leere Zelle
Schrittweite y 10.000 EUR         durchgehend
Schrittweite x 20 EUR/m2          durchgehend
 50.000 /  20 -> 0,71  soll 0,71  OK
 50.000 / 160 -> 1,00  soll 1,00  OK
600.000 /  20 -> 0,42  soll 0,42  OK
600.000 / 160 -> 0,71  soll 0,71  OK
300.000 /  80 -> 0,70  soll 0,70  OK   (Innenwert aus dem Anwendungsbeispiel)
Monotonie: alle 56 Zeilen steigend ueber BRW, alle 8 Spalten fallend ueber vSW
Keine Ausreisserzeile. Wertebereich 0,42 bis 1,00.
```

Das vollständige Anwendungsbeispiel rechnet ebenfalls durch:
0,70 + 0,06 (RND 55 statt 40) + 0,01 (BGF 300 statt 350) = **0,77**.

### Märkischer Kreis — zwei Extraktionswege, ein Ergebnis

Rezept (aus `v1083-ernte-hoexter-mk-belegt.md`) gegen `swf_roh.json`
(`315_mk_freistehend`, `315_mk_dhh_rh`) abgeglichen:

| Zweig | Rezept | swf_roh | Abweichungen |
|---|---|---|---|
| ezfh | 14 Stützstellen, Jahrgang 2025 | 14 Stützstellen, `gilt: 2025` | **keine** |
| rhdhh | 8 Stützstellen, Jahrgang 2025 | 8 Stützstellen, `gilt: 2025` | **keine** |

Auch die Dokumentationsjahrgänge 2023 und 2024 stimmen im Überlappungsbereich
vollständig überein. `swf_roh.json` führt dort **zusätzlich** die Stützstellen
450.000 und 475.000, die im Erntedokument nicht abgedruckt waren — die
Zeitreihe im Rezept ist deshalb auf die vollen sechs Jahrgänge 2020–2025
erweitert worden, mit Herkunftsvermerk. **Der Rechenweg bleibt unverändert der
Jahrgang 2025 in `formel.stufen`.** Zwei Quellen, zwei Parser, kein Widerspruch.

### Schlüssel nachgeschlagen statt geschlossen

`/root/ernte/gmd2025/schluessel.csv` (Spalten `ags · name ·
kreis_kreisfreiestadt · gaa_kennz · gaa_name`) ist die belegte Quelle. Ergebnis:

- **Alle 14 AGS bestätigt.** Kein Treffer musste korrigiert werden.
- **Sechs GAA-Kennzeichen waren verkürzt** und sind auf die amtliche
  fünfstellige Form gezogen: Höxter 312 → **31200** · Kreis Lippe 314 →
  **31400** · Kreis Paderborn 321 → **32100** · Stadt Paderborn 270 →
  **27000** · Iserlohn 243 → **24300** · Märkischer Kreis 315 → **31500**. Die
  dreistellige Kurzform der Erntedokumente steht als `gaa_kennz_kurz` daneben,
  die Dateinamen sind unverändert geblieben.
- **Zwei bis dahin unbekannte Kennzeichen sind jetzt belegt:**
  Köln = **11400**, Rhein-Erft-Kreis = **30600**. Beide Dateien heißen
  entsprechend jetzt `11400-koeln.json` und `30600-rhein-erft-kreis.json`
  (vorher nach AGS benannt) — **diese zwei Dateinamen haben sich geändert.**
- Bestätigt: 10300 Bochum · **10400 Bonn** · 10600 Dortmund · 10700 Düsseldorf ·
  10800 Duisburg · 10900 Essen · 10200 Bielefeld.
- Bestätigt ist auch der Zuschnitt des Märkischen Kreises: GAA 31500 führt alle
  MK-Gemeinden **außer** Iserlohn (24300) und Lüdenscheid (25200).

Die `ags`-Felder stehen in der Form, die die Aufgabenstellung vorgibt
(fünfstellig = Kreis, achtstellig = Gemeinde). `schluessel.csv` schreibt Kreise
achtstellig mit Endung `000`; wo es hilft, steht diese Form als `ags_form8`
daneben.

---

## Nachgerechnet, nicht behauptet

Alle acht abgedruckten Anwendungsbeispiele treffen das geschriebene Rezept:

```
Bielefeld       320.000 / gut            -> 1,14        soll 1,14   ok
Hoexter         300.000 / 80 EUR/m2      -> 0,70 -> 0,77 soll 0,77  ok
Kr. Paderborn   400.000 / 200 EUR/m2     -> 0,87        soll 0,87   ok  (348.000 EUR)
Koeln           500.000 / BWN 500        -> 1,06 - 0,05 = 1,01      ok
Bochum          WLK 3 / 375k / 43 / 160  -> 1,19        soll 1,19   ok
Dortmund        Gebiet 1 / Baujahr 1960  -> 34 % = 1,34 soll 1,34   ok
St. Paderborn   450k / 380k / 480k       -> 420.014 / 375.669 / 442.685  soll rd. 420.000 / 376.000 / 443.000  ok
Kr. Lippe       600 m2 / 320.000         -> 90,8603 %   soll 90,86  ok
```

**Rücknahme einer eigenen Fehldiagnose:** Beim Kreis Lippe hatte ich zunächst
eine Abweichung von 0,03 Prozentpunkten vermutet. Falsch — die Formel trifft
90,8603 %. Die im Erntedokument abgedruckten *gerundeten* Zwischenwerte
(63,106 und 211,570) sind selbst ungenau; mit voller Genauigkeit sind es
63,10379 und 211,59794.

**Monotonie über die ganze Tabelle** wurde für jedes Modell geprüft:

- Alle `stufen_1d`, alle Kategorien in Bielefeld/Köln/Dortmund und alle 56 Zeilen
  in Höxter: sauber.
- Rhein-Erft: fallend über den Sachwert, steigend über den Bodenrichtwert — mit
  **einer** Ausnahme: Spalte BRW 750 €/m² bei den freistehenden Häusern
  (250.000 → 1,13 · 300.000–600.000 → 1,12 · 650.000/700.000 → 1,13). So steht
  es im Erntedokument; **nicht geglättet**, im Rezept als Befund vermerkt.
- Düsseldorf ist über die Baujahresgruppen erwartungsgemäß nicht monoton — eine
  `matrix_band` ohne Interpolation, die Baujahresgruppen sind keine geordnete
  Wertskala.

---

## Entscheidungen, die beim Verdrahten bekannt sein müssen

**1 · Die Gemeinde-Ebene muss vor der Kreis-Ebene geprüft werden.** Im Märkischen
Kreis liegen drei Ausschüsse übereinander: Kreis 31500 (`ags 05962`), Iserlohn
24300 (`ags 05962024`) und Lüdenscheid 25200 (`ags 05962032`). Ein Auflöser, der
auf fünf Stellen vergleicht, trifft für Iserlohn und Lüdenscheid still den
Kreisdatensatz — kein Fehler, nur ein falscher Wert.

**2 · Zwei Formen liefern keinen Faktor.** `linear_sachwert` (Stadt Paderborn)
liefert einen **Euro-Betrag**, `doppel_log` (Kreis Lippe) liefert **Prozent**.
Dortmund liefert **Zu-/Abschläge in Prozent** auf den vorläufigen Sachwert
(`formel.liefert = "zuschlag_prozent"`, `Faktor = 1 + Zuschlag/100`). Wer das
als Faktor liest, rechnet um Größenordnungen falsch.

**3 · Bochum ist keine Matrix.** Basiswert 1,21 plus vier additive Korrekturen.
Die am 10.08. kursierende Bochum-Matrix mit 847 Kauffällen war **frei erfunden**
— im Rezept ausdrücklich als verworfen vermerkt. Die Fallzahl lautet 747.

**4 · Düsseldorf steht auf Stufe B, nicht A** — der Bericht sagt selbst, dass die
Kauffälle 2025 nicht ausreichten und die Faktoren aus 2023 „sachverständig
fortgeschrieben" wurden. Alle übrigen Rezepte stehen auf A.

**5 · Die sachverständigen Zu-/Abschläge sind NICHT rechenbar hinterlegt.**
Düsseldorf nennt sie als Obergrenzen („bis − 15 %") mit dem Zusatz
„sachverständig abzuwägen" — sie stehen als Dokumentation in
`geltungsbereich.sachverstaendige_zuschlaege`, nicht in `korrekturen`.

**6 · Klammerwerte sind Werte.** Dortmund markiert dünn belegte Zellen mit
Klammern; sie stehen mit ihrem Wert im Rezept, `formel.vorbehalt` führt je
Kategorie die betroffenen x-Stützstellen. `–` und leer sind `null`.

**7 · Zeitreihen: der jüngste Jahrgang gilt.** Iserlohn und Märkischer Kreis
führen sechs Berichtsjahre. In `formel` steht ausschließlich der Jahrgang 2025
(`formel.jahrgang`); die älteren Spalten stehen als
`geltungsbereich.zeitreihe_dokumentation` daneben.

**8 · `berichtsjahr` = Jahreszahl im Titel des Grundstücksmarktberichts**
(durchgängig 2026), nicht das Datenjahr. Das Datenjahr steht in
`auswertezeitraum`. Wo der Bericht keinen Stichtag beziffert, steht
`stichtag: null` — nicht geraten.

**9 · Zweigschlüssel.** Verwendet: `efh` · `zfh` · `ezfh` (Bericht fasst EFH und
ZFH zusammen) · `rh` · `rhdhh` · `rmh` · `dreifh` · `mfh` · `ggg` ·
`fertighaus` · `ezfh_rh` (Dortmund Gebiet 1/6a, wo der Bericht gar nicht nach
Objektart trennt). Die wörtliche Bezeichnung steht in jedem Modell unter
`zweig_bez` — beim Mapping **diese lesen, nicht den Schlüssel raten**. Zwei
Fälle, die auffallen: Stadt Paderborn `zfh` umfasst **Zwei- UND
Dreifamilienhäuser**, Düsseldorf `ggg` ist auf **35–45 % gewerblichen
Rohertragsanteil** eingegrenzt. Höxter trägt `ezfh` mit dem ausdrücklichen
Vermerk, dass die Objektartabgrenzung im Erntedokument nicht beziffert ist.

**10 · Schlüsselkonventionen in `formel`.** `matrix_interp` und
`matrix_kategorial`: `zellen` ist ein Objekt, Schlüssel = y-Stützstelle als
String bzw. Kategoriename, Wert = Array in Reihenfolge der x-Achse.
`matrix_band`: Schlüssel = `bez` des y-Bandes. Jede Datei sagt es selbst in
`zellen_schluessel`.

**11 · Feldnamen.** Die Rezepte nutzen bei `doppel_log` `f_feld`/`x_feld`; der
Auswerter erwartet `feld_1`/`bez_1`/`gueltig_1` bzw. `feld_2`/`bez_2`/`gueltig_2`
und normalisiert das beim Einlesen. Bei `potenz` erwartet er `achse_feld`,
`achse_bez`, `a`, `b`, optional `x_faktor`, `gueltig_von`, `gueltig_bis` — ein
`potenz`-Rezept gibt es noch nicht, Lüdenscheid wäre der Kandidat.

---

## Was das Register davon hat

Elf Ausschüsse mehr auf Stufe A, fünf davon mit abgedrucktem Anwendungsbeispiel
als Prüfmaßstab. Sieben der neun Modellformen sind belegt vertreten
(`matrix_interp`, `matrix_kategorial`, `matrix_band`, `stufen_1d`,
`linear_sachwert`, `doppel_log`, `konstante`) — es fehlt allein `potenz`, und
dafür fehlen Lüdenscheids Koeffizienten.

`mb.param_modell` nimmt alle 14 ohne Migration auf. Der CHECK
`jsonb_array_length(belege) > 0` ist erfüllt — **jedes Modell trägt einen
Beleg**, entweder ein Anwendungsbeispiel oder eine Zählprüfung mit
`soll_zeilen`/`soll_spalten` aus dem Dokument.
