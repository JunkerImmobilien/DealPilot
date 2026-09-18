#!/usr/bin/env python3
# ══════════════════════════════════════════════════════════════════════════
# ni-wert-lesen.py (v1413) — eine Zahl aus einem Tableau-PDF holen,
#                            über ihre LAGE statt über die Zeilenreihenfolge
#
# WARUM NICHT ÜBER ZEILEN: `pdftotext -layout` gibt den Textstrom in
# Lesereihenfolge aus, und in einem Dashboard steht der Wert nicht
# zwangsläufig neben seiner Beschriftung. Gemessen an drei Fällen:
#
#   Braunschweig   Wert in der Zeile der Beschriftung   -> grep -A1 richtig
#   Nienburg       Wert ACHT Zeilen darunter            -> grep -A1 liest fremd
#   Osnabrück      gar kein Wert; die Folgezeile ist    -> grep -A1 liest die
#                  bereits die nächste Beschriftung        Standardabweichung
#
# Drei Layoutregeln später war klar: 81 Dashboards haben nicht ein Layout,
# sondern viele, und jede weitere Regel trifft das nächste Dashboard nicht.
# Über die Bounding-Box stellt sich die Frage gar nicht — gesucht wird die
# Zahl, die auf DERSELBEN HÖHE steht wie ihre Beschriftung, rechts davon.
# Findet sich keine, gibt es keinen Wert. Das ist die Erntedoktrin, auf
# einen Textstrom angewandt.
#
# Aufruf:  pdftotext -bbox-layout dash.pdf dash.xml
#          python3 ni-wert-lesen.py dash.xml
#          -> "faktor;standardabweichung" (leer, wo nichts eindeutig ist)
# ══════════════════════════════════════════════════════════════════════════
import re
import sys
import io


def woerter(xml):
    """Alle Wörter mit ihren Koordinaten."""
    return [(float(m.group(1)), float(m.group(2)), float(m.group(3)),
             float(m.group(4)), m.group(5))
            for m in re.finditer(
                r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" '
                r'yMax="([\d.]+)">([^<]*)</word>', xml)]


def wert_neben(W, muster, unten, oben, toleranz=6.0):
    """Die erste Zahl rechts von `muster`, auf derselben Höhe und im Band."""
    anker = [w for w in W if re.search(muster, w[4])]
    if not anker:
        return None
    a = anker[0]
    mitte = (a[1] + a[3]) / 2
    kand = [w for w in W
            if w[0] > a[2]                                   # rechts davon
            and abs((w[1] + w[3]) / 2 - mitte) < toleranz    # gleiche Höhe
            # Das ±-Zeichen klebt mal am Wert und mal nicht: Braunschweig
            # druckt "±0,12", Osnabrück "± 0,21". Im ersten Fall ist es
            # Teil desselben Wortes und schloss den Wert vom Muster aus.
            and re.fullmatch(r'[±±]?\s*[\d.]+[,.]\d\d', w[4])]
    kand.sort(key=lambda w: w[0])
    for w in kand:
        t = w[4].lstrip('±± ')
        try:
            # "0,92" deutsch · "0.92" englisch · "1.234,56" mit Tausenderpunkt
            v = float(t.replace('.', '').replace(',', '.')) if ',' in t \
                else float(t)
        except ValueError:
            continue
        if unten <= v <= oben:
            return v
    return None


if __name__ == '__main__':
    W = woerter(io.open(sys.argv[1], encoding='utf-8').read())
    # ANKER: im bbox-XML steht jedes WORT einzeln, und die fehlende
    # ft-Ligatur zerlegt "Sachwertfaktor:" in "Sachwer" + "aktor:".
    # Gesucht wird deshalb das Teilwort MIT Doppelpunkt — das grenzt
    # zugleich gegen die Überschriften "Sachwer aktoren" und
    # "Sachwer aktors" ab, die keinen tragen.
    f = wert_neben(W, r'^(aktor:|Sachwertfaktor:)$', 0.20, 4.00)
    a = wert_neben(W, r'^Standardabweichung:$',      0.01, 1.00)
    print('%s;%s' % ('' if f is None else f, '' if a is None else a))
