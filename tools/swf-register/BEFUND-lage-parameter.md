# Der Lage-Parameter der niedersaechsischen Kalkulatoren — aufgeklaert

**Stand 25.09.2026.** 26 Tableau-Kalkulatoren (rund 15 Kreise) rechnen
nur mit gesetzter Lage. Welche, steht in `ni-lageachse.csv`, Spalte
`erntbar` = „nein - Lage-Parameter fehlt".

## Was gemessen wurde

Im Browser am Kalkulator `2026_sw_efh_nomgs` (Goslar), Lage von Hand
umgestellt und der Verkehr mitgelesen:

```
POST /vizql/w/2026_sw_efh_nomgs/v/Dash/sessions/<sid>/commands/tabdoc/set-parameter-value-from-index
  parameterName = [Parameters].[Parameter 2]
  idx           = 2          <- NULLBASIERTER INDEX, nicht der Wert
```

**Der Parameter heisst intern `Parameter 2`.** „Lage" ist die
Beschriftung im Dashboard, nicht der Name. Deshalb konnte Raten nicht
funktionieren — und deshalb ist der URL-Weg nicht nur ungeloest,
sondern **grundsaetzlich tot**: ein Index laesst sich in einer
Tableau-URL nicht ausdruecken.

Gescheitert und damit abgehakt:
- `Lage=GS 01`, `Lage=GS01`, `Lage=GS 02 %26 GS 03`
- `Parameter%202=GS%2001`
- `tsConfigContainer` der Einbettseite auslesen (kommt leer, wird per
  JavaScript gefuellt; ein POST darauf gibt 110 Bytes)
- Sitzungs-PDF ueber `tabsrv/export-pdf-server` (410)

## Der zweite Teil des Befundes

**Jeder URL-Parameter loescht die Lage.** Ohne Parameter liefert Goslar
Lage „GS 01" und Faktor 1,03; mit `Brw=60&Sach=250000` — also exakt den
Vorgabewerten — ist die Lage leer und der Faktor leer. Das erklaert die
54 leeren Zeilen im Protokoll von `ni-ernte.sh` vollstaendig.

`Brw` und `Sach` sind dagegen die richtigen Namen (nachgewiesen:
`Sach=310000` setzt 310.000 im Dashboard).

**Die Zahlen stehen nicht im DOM.** Tableau rendert die Kacheln als
webp-Bilder; im DOM liegen nur die Beschriftungen („Sachwertfaktor:").
Ein Ernter kann den Wert also nicht einfach auslesen.

## Was daraus folgt

Der Weg ist ein **sitzungsgetriebener Ernter**:

1. Sitzung aufbauen (Bootstrap, liefert `<sid>`)
2. `Parameter 2` per Index setzen, `Brw` und `Sach` je Gitterpunkt
3. den Wert aus dem Sitzungs-Export lesen

Das ist ein Bau, kein Probelauf. Ob er sich fuer ~15 Kreise lohnt,
entscheidet Marcel.

> **Nebenbefund, der den Bau kleiner machen koennte:** das Diagramm
> „Umrechnungskoeffizienten fuer abweichende vorlaeufige Sachwerte und
> Regionen" zeigt **alle vier Lage-Kurven gleichzeitig** — mit Legende.
> Fuer die KORREKTUREN braucht es den Parameter also womoeglich gar
> nicht, nur fuer den Faktor selbst.
