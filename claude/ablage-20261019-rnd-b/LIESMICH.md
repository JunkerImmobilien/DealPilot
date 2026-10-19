# Paket RND Variante B für die Website (JunkerImmobilien_Homepage)

Stand 19.10.2026, gebaut im DealPilot-Chat. Der Patch passt auf Commit `493ef70` (geprüft mit `git apply --check`).

## Entscheidung Marcel: Variante B

- Anlage 2 ImmoWertV führt, wie im Gutachten-Modul V4.2.6. Dessen Endwert ist standardmäßig das Punktraster: `verfahrenGewaehlt || punktraster`.
- Jenseits der GND gilt das Plateau aus V4.2.6.
- Das technische Verfahren ist nur noch eine Plausibilitätsprüfung (Hinweis bei Faktor 2 Abweichung), nicht mehr der Leitwert.

## Was der Patch ändert

**`assets/rnd/rnd-calc.js`**
1. `calcPunktraster`, Alter ≥ GND: Plateau wie im Modul. Die Kurve läuft bis zum Scheitel `b·GND/(2a)` und wird dort gehalten. Vorher gab es hier `anwendbar:false` und keinen Wert.
2. Untergrenze `RND_MIN = 10` im Formelzweig, nach oben begrenzt durch GND − 10, wie Modul V4.2.4/V4.2.5 und DealPilot `rnd-einheitlich.js`.
3. `calcAll`, Verfahrenswahl:

   | Fall | Leitwert |
   |---|---|
   | Formel anwendbar | Punktraster |
   | unter der Altersschwelle | GND − Alter (`gnd_minus_alter`) |
   | technisches Verfahren | neuer Hinweis `technisch_abweichung` bei Faktor > 2 |

   Der Schadensabschlag wirkt nur noch auf die technische Plausibilitätszahl. Bauschäden gehören nach § 8 Abs. 3 ImmoWertV zu den besonderen objektspezifischen Merkmalen, nicht zur RND.

**`assets/rnd/rnd-spanne.js`**
4. Hinweis im Kommentar „Die Regel“: Die alte Regel ist abgelöst und bleibt als Begründungsspur stehen.
5. **Fehler, den B sonst sichtbar macht:** Die obere Kante wurde auf `Math.floor(obergrenze)` gekappt. Unter B ist die Obergrenze der Leitwert selbst. Die Spanne lag damit immer unter dem Gutachtenwert (29,81 ergab 27–29) und versprach mehr Abschreibung, als das Gutachten hergibt. Jetzt reicht die obere Kante mindestens bis `ceil(Leitwert)`.

## Prüfung: `node rnd-b-pruefen.mjs <website-root>`

Der Prüfer lädt die echten Dateien und ruft die echten Funktionen. Er prüft:
- 11.760 Fälle: GND 50/60/70/80/100 × Punkte 0–20 × Alter 1 bis GND+40
- Website-Leitwert = Modul-Endwert (±0,01)
- immer ein Wert
- nie ein Anstieg mit dem Alter, wo das Modul nicht selbst steigt
- Gutachtenwert immer in der Spanne

Ergebnis mit dem Patch: **SAUBER, RC=0.**

Anlage 2 selbst springt nicht. Über alle Fälle gibt es zwei, in denen ein Jahr älter mehr ergibt: 0,14 bzw. 0,04 Jahre, im Modul genauso. Der früher gemessene Sprung (1978: 29–35, 1979: 19–23) kam vom Wechsel zwischen technischem Verfahren und Punktraster an der Schwelle.

## ⚠ Vor dem Ausrollen von Marcel abnehmen lassen

An den vier belegten Fällen aus dem Kommentar in `rnd-spanne.js` liegt B **deutlich höher** als die Belege:

| Fall | B (Website = Modul) | Beleg |
|---|---|---|
| Rinteln, Bj. 1972, GND 80, 0 Punkte | 25,81 · 23–26 | 14–18 (Wettbewerber) |
| Hüllhorst, Bj. 1965, GND 80, 6 Punkte | 31,49 · 28–32 | 21–25 (Wettbewerber) |
| Ref 06644, Bj. 1998, GND 70 | 42 · 34–42 (unter der Schwelle: GND − Alter) | 26 (Gutachten) |
| Ref 02661, Bj. 1994, GND 70 | 38 · 30–38 | 26 (Gutachten) |

Eine längere RND bedeutet eine niedrigere AfA. Die Website würde bei diesen Objekten seltener „lohnt sich“ sagen. Konsequent ist das nur, wenn das Gutachten diese Zahlen auch so ausweist. Im Modul kann der Sachverständige das Verfahren wählen oder manuell würdigen (`finalRndManuell`). Die Referenzgutachten haben offenbar so gewürdigt.

## Nach dem Einspielen

- `VERSION` in `rnd-calc.js` auf `3.2.0` setzen.
- Die Cache-Buster `?v=` von `rnd-calc.js`/`rnd-spanne.js` in `ersteinschaetzung.html`, `gutachten-beauftragen.html` und `restnutzungsdauergutachten.html` neu setzen.
- Ersteinschätzung im Browser mit einem echten Trichterlauf prüfen. Der Prüfer rechnet ohne Gewerke-Angaben, die echten Strecken liefern sie mit.
