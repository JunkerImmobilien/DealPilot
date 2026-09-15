#!/usr/bin/env python3
# ══════════════════════════════════════════════════════════════════════════
# ni-kurven-lesen.py (v1414) — die Umrechnungskoeffizienten eines
#                              niedersächsischen Dashboards auslesen
#
# Die Kurven werden NICHT abgetastet. Ihre Stützstellen stehen als Zahlen
# im PDF, und das ist die bessere Quelle: der Ausschuss hat sie selbst
# abgedruckt, während ein abgetasteter Punkt immer nur eine Stelle trifft,
# die wir gewählt haben.
#
# DAS PROBLEM, das dieses Skript löst: die Zahlen eines Diagramms stehen
# auf VERSCHIEDENEN HÖHEN — sie folgen der Kurve. Im Textstrom kommen sie
# deshalb in einer Reihenfolge, die nichts mit der x-Achse zu tun hat.
# Bei Verden las sich das als 1,02 · 1,00 · 1,01 · 0,99 · 0,98 · 0,96 …
# — eine Folge, die weder monoton ist noch zu den Achsenwerten passt, und
# die als Korrekturtabelle still falsch gerechnet hätte.
#
# Zugeordnet wird deshalb über die x-POSITION: die Koeffizientenzahl, die
# waagerecht am nächsten an einer Achsenbeschriftung steht, gehört zu ihr.
#
# Aufruf:  pdftotext -bbox-layout dash.pdf dash.xml
#          python3 ni-kurven-lesen.py dash.xml "<Achsenmuster>"
#   z. B.  python3 ni-kurven-lesen.py dash.xml "^[1-4],[05]$"     (Stufen)
#          python3 ni-kurven-lesen.py dash.xml "^[1-3],[02468]$"  (BGF/Wfl)
# ══════════════════════════════════════════════════════════════════════════
import re
import sys
import io
from collections import defaultdict


def woerter(xml):
    return [(float(m.group(1)), float(m.group(2)), float(m.group(3)),
             float(m.group(4)), m.group(5))
            for m in re.finditer(
                r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" '
                r'yMax="([\d.]+)">([^<]*)</word>', xml)]


def zahl(t):
    t = t.strip().lstrip('±± ')
    try:
        return float(t.replace('.', '').replace(',', '.')) if ',' in t \
            else float(t)
    except ValueError:
        return None


def kurve(W, achsmuster):
    """Achsenbeschriftung finden, Koeffizienten darüber zuordnen."""
    # Die Achse ist die Zeile, in der die meisten Treffer auf gleicher Höhe
    # liegen — eine y-Achsenbeschriftung steht dagegen untereinander.
    kand = [w for w in W if re.fullmatch(achsmuster, w[4])]
    zeilen = defaultdict(list)
    for w in kand:
        zeilen[round((w[1] + w[3]) / 2)].append(w)
    if not zeilen:
        return []
    y, achse = max(zeilen.items(), key=lambda kv: len(kv[1]))
    if len(achse) < 3:
        return []
    achse.sort(key=lambda w: w[0])

    # Koeffizienten: Zahlen der Form 0,xx / 1,xx OBERHALB der Achse, aber
    # nicht weiter als bis zur vorigen Grafik. Die y-Achsenbeschriftung
    # steht ganz links und fällt über ihre x-Lage heraus.
    xlinks = achse[0][0] - 25
    ko = [w for w in W
          if re.fullmatch(r'[01][,.]\d\d', w[4])
          and y - 105 < (w[1] + w[3]) / 2 < y - 4
          and w[0] > xlinks]

    aus = []
    for a in achse:
        amitte = (a[0] + a[2]) / 2
        nah = [w for w in ko if abs((w[0] + w[2]) / 2 - amitte) < 18]
        if not nah:
            aus.append((a[4], None))
            continue
        nah.sort(key=lambda w: abs((w[0] + w[2]) / 2 - amitte))
        aus.append((a[4], zahl(nah[0][4])))
    return aus


if __name__ == '__main__':
    W = woerter(io.open(sys.argv[1], encoding='utf-8').read())
    for stelle, wert in kurve(W, sys.argv[2]):
        print('%s;%s' % (stelle, '' if wert is None else wert))
