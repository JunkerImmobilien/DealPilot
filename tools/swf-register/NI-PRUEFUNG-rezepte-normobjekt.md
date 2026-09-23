# Die 15 NI-Rezepte gegen das gemessene Normobjekt

**Geprüft am 23.09.2026.** Auslöser war der Befund, dass das Normobjekt je
Gebiet woanders liegt als der Werkzeugkommentar behauptet
(`NI-BEFUND-normobjekt.md`). Die Frage: haben die vorhandenen Rezepte das
Richtige eingetragen?

## Ergebnis: ja. Alle prüfbaren stimmen.

| | |
|---|---|
| geprüft und richtig | **7** |
| scheinbar abweichend — beides Werkzeugfehler | 2 |
| nicht prüfbar (keine lesbare Kurve) | 6 |

```
✓ Braunschweig    Wfl 150 · RND 35 · Stufe 3,0      alle drei richtig
✓ Gifhorn         Wfl 150 · Stufe 2,5               richtig
✓ Region Hannover RND 40 · Stufe 2,5                richtig
✓ Hildesheim      RND 40                            richtig
✓ Celle           Wfl 130 · Stufe 2,5               richtig
~ Wolfsburg       Wfl 150 — Werkzeug las 140        siehe unten
~ Verden          Stufe 2,5 — Werkzeug las 2,0      siehe unten
```

---

## Die zwei scheinbaren Abweichungen

### Wolfsburg — ein Plateau, kein Fehler

Die Wohnflächenkurve ist dort sehr flach und hat **zwei** Stützstellen mit
exakt 1,00:

```
80=0,98  100=0,99  120=0,99  140=1,00  160=1,00  180=1,01  200=1,01  220=1,01
```

`ni-kurven-ernte.sh` nimmt stur die **erste** Stelle mit 1,00 und meldet 140.
Das Rezept trägt 150 — die Mitte des Plateaus. Das ist die vernünftigere Wahl,
und eindeutig messbar ist hier gar nichts.

> **Werkzeugschwäche:** Ein Plateau muss als solches gemeldet werden, nicht als
> Punkt. Bei zwei oder mehr Stellen mit 1,00 gehört die Spanne ausgegeben.

### Verden — zwei Kurven, eine Etikette

Verden führt **zwei** Korrekturkurven, und beide haben Achsen derselben Form
(Kommazahlen zwischen 1 und 5):

```
Umrechnungskoeffizienten für abweichende Standardstufen
Umrechnungskoeffizienten bei abweichendem Verhältnis von Bruttogrundfläche
                                                        zu Wohnfläche
```

`ni-kurven-lesen.py` liest alle passenden Zahlen aus dem **ganzen Dokument**
und kann die beiden Diagramme nicht auseinanderhalten. Herausgekommen ist eine
Kurve mit der Achse 1,6 – 3,8 in 0,2er-Schritten, etikettiert als
„Standardstufen". Standardstufen laufen aber in 0,5er-Schritten — **das ist in
Wirklichkeit die BGF/Wohnfläche-Kurve**, und ihr Normobjekt 2,0 steht genauso
im Rezept: *„Standardstufe 2,5 · Verhältnis Brutto-Grundfläche zu Wohnfläche
2,0"*.

> **Zwei Werkzeugschwächen auf einmal:**
> 1. Zwei Kurven mit gleichartiger Achse werden nicht getrennt — das braucht
>    eine Zuordnung über die y-Position des Diagramms, nicht nur über x.
> 2. Die Typ-Erkennung greift hier gar nicht: im Textstrom steht
>    „Bru **o**grundfläche" — das `tt` ist als Ligatur ausgefallen und wurde
>    durch ein Leerzeichen ersetzt. Dieselbe Falle wie bei den Ausschussnamen,
>    nur an anderer Stelle. `muster_fuer()` sucht nach `*Bruttogrundfläche*`
>    und findet nichts.

---

## Was daraus folgt

**Für die Rezepte: nichts.** Sie sind in Ordnung, und zwar auch dort, wo mein
Werkzeug etwas anderes sagt. Wer sie gebaut hat, hat genauer hingesehen als
mein automatischer Abgleich.

**Für das Werkzeug: drei offene Punkte**, bevor damit neue Rezepte gebaut
werden:

1. Plateaus als Spanne melden statt als ersten Punkt.
2. Kurven mit gleichartiger Achse über die y-Position trennen.
3. Die Ligatur-Lücken auch in den Überschriften auflösen — nicht nur die
   Unicode-Ligaturen (ﬀ ﬁ ﬂ), sondern auch die als Leerzeichen ausgefallenen.

Solange diese drei offen sind, ist `ni-kurven-ernte.sh` ein **Hilfsmittel zum
Nachsehen**, keine Quelle, aus der ungeprüft Rezepte entstehen dürfen.

## Wiederholen

Das Prüfskript liegt als `pruef-normobjekt.js` daneben:

```
node tools/swf-register/pruef-normobjekt.js
```

Es vergleicht den Fließtext in `modelle[0].formel.normobjekt` jedes NI-Rezepts
mit den gemessenen Werten aus `ni-ernte/ni-kurven/` und ordnet über die
`quelle_url` zu.
