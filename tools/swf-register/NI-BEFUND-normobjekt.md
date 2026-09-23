# Das Normobjekt ist nicht 120 / 40 / 2,5 — es steht je Gebiet woanders

**Gemessen am 23.09.2026 an der Stadt Braunschweig** (`2026_sw_efh_bsbs`).
Dieser Befund hält den Rezeptbau auf, bis er geklärt ist — deshalb steht er
hier und nicht nur in einer Commit-Nachricht.

---

## Was das vorhandene Werkzeug annimmt

`ni-kalkulator-abtasten.sh` schreibt in seinem Kopf:

> GETASTET WIRD AM NORMOBJEKT. Wohnfläche, Restnutzungsdauer und Standardstufe
> bleiben auf ihren Vorgaben (**120 m² · 40 Jahre · 2,5**) — dort stehen alle
> drei Umrechnungskurven auf 1,00.

Das ist die Grundlage dafür, dass Gitter und Korrekturen zusammenpassen. Wäre
sie falsch, rechnete jede Korrektur vom falschen Punkt aus — und zwar still.

## Was gemessen wurde

Die drei Umrechnungskurven aus dem Dashboard, gelesen mit
`ni-kurven-lesen.py` (Zuordnung über die x-Position, nicht über die
Reihenfolge im Textstrom):

| Kurve | wo sie **1,00** ist | Annahme im Werkzeug |
|---|---|---|
| Wohnfläche | ~**140 m²** (bei 140: 0,99) | 120 m² → dort steht **0,96** |
| Restnutzungsdauer | **35 Jahre** (exakt 1,00) | 40 Jahre |
| Standardstufe | **3,0** (exakt 1,00) | 2,5 → dort steht **0,88** |

Die Stichprobe desselben Dashboards nennt als Median: Wohnfläche **141 m²**,
Restnutzungsdauer **35**, Standardstufe **2,7**.

## Was daraus folgt

**Das Normobjekt liegt nahe am Median der jeweiligen Stichprobe, nicht auf
festen Werten.** Bei der Restnutzungsdauer trifft es den Median exakt (35), bei
der Wohnfläche fast (140 gegen 141), bei der Standardstufe nicht ganz (3,0
gegen 2,7 — offenbar auf einen glatten Wert gelegt).

Damit ist das Normobjekt **je Gebiet ein anderes**. Es lässt sich aber
ablesen, und zwar ohne zu raten: **an der Stelle, wo jede Kurve 1,00 zeigt.**

## Warum das den Rezeptbau aufhält

Ein Rezept trägt das Gitter (Faktor über Bodenrichtwert und vorläufigem
Sachwert) **und** die Korrekturen für abweichende Wohnfläche, Restnutzungsdauer
und Standardstufe. Beide beziehen sich auf denselben Punkt.

Trägt das Rezept ein Normobjekt von 120 / 40 / 2,5 ein, während das Gitter in
Wirklichkeit bei 140 / 35 / 3,0 abgetastet wurde, dann wird jede Korrektur vom
falschen Punkt aus angesetzt. Am Beispiel Braunschweig: die Wohnflächen&shy;kurve
läge um rund **4 Prozent** daneben, die Standardstufenkurve um **12 Prozent**.

Das ergäbe einen Sachwertfaktor, der plausibel aussieht und falsch ist — genau
die Sorte Zahl, die niemand nachrechnet.

## Der Weg nach vorn

1. Je Gebiet die drei Kurven lesen und den Punkt bestimmen, an dem sie 1,00
   sind. Das ist das tatsächliche Normobjekt.
2. Dieses Normobjekt ins Rezept schreiben (`formel.normobjekt`), nicht die
   angenommenen Werte.
3. Prüfen, ob die vorhandenen NI-Rezepte (15 Stück, vor dieser Messung
   entstanden) das richtige Normobjekt führen. **Das ist offen** und sollte vor
   dem nächsten Registerlauf geklärt werden.
4. Den Kopfkommentar in `ni-kalkulator-abtasten.sh` berichtigen.

## Was der Befund nicht berührt

Die **Gitterwerte selbst** sind davon unberührt. Sie wurden mit den
Voreinstellungen des Dashboards abgetastet, also am tatsächlichen Normobjekt —
welches auch immer das ist. Falsch würde erst die Verrechnung mit den
Korrekturen.

Auch die Ernte-Logik bleibt gültig: Spannen, Achsen und Leerprüfung hängen
nicht am Normobjekt.
