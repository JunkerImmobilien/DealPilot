#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Die Ausschussnamen aus dem Tableau-PDF tragen Luecken, wo im Font eine
Ligatur stand: "Landkreis Gi orn", "Wolfenbue el", "Grafscha Bentheim".
Das Werkzeug ni-kopfdaten.sh gibt sie bewusst ROH aus - "die Luecke zu
raten waere genau die Sorte Zahl, die wir nicht erfinden."

Dieses Skript raet nicht, es BEWEIST. Fuer jeden rohen Namen wird
geprueft, welche amtlichen Kreisnamen Niedersachsens entstehen, wenn man
an jeder Luecke ENTWEDER ein echtes Leerzeichen ODER eine Ligatur
einsetzt. Ein Name gilt nur als aufgeloest, wenn

  (1) GENAU EIN amtlicher Kreis passt,
  (2) die eingesetzten Zeichen ausschliesslich Ligaturbuchstaben sind
      (f t i l h - "fh" wie in Gifhorn nennt das Werkzeug ausdruecklich)
      und
  (3) die Art uebereinstimmt, wo der rohe Name sie nennt.

Punkt 3 ist noetig, weil "Osnabrueck" zweimal vorkommt: als kreisfreie
Stadt (03404) und als Landkreis (03459). Ohne diese Probe waere die
Aufloesung dort eine Muenze.

Alles andere bleibt offen und bekommt kein Rezept.
"""
import re, sys, zipfile
from xml.etree import ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'

def xlsx_zeilen(pfad):
    z = zipfile.ZipFile(pfad)
    st = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')):
            st.append(''.join(t.text or '' for t in si.iter(NS + 't')))
    for name in sorted(n for n in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml$', n)):
        for row in ET.fromstring(z.read(name)).iter(NS + 'row'):
            zeile = []
            for c in row.iter(NS + 'c'):
                v = c.find(NS + 'v')
                if v is None or v.text is None:
                    zeile.append('')
                elif c.get('t') == 's':
                    zeile.append(st[int(v.text)])
                else:
                    zeile.append(v.text)
            yield zeile

# ── Die amtlichen Kreise Niedersachsens ───────────────────────────────
# Gemessen an der Datei, nicht angenommen: Blatt 2 traegt den
# Regionalschluessel in Spalte 0, die Art in Spalte 1, den Namen in
# Spalte 2. Blatt 1 ist Deckblatt.
kreise = {}
for z in xlsx_zeilen(sys.argv[1]):
    if len(z) < 3:
        continue
    schl, art, name = (z[0] or '').strip(), (z[1] or '').strip(), (z[2] or '').strip()
    if re.fullmatch(r'03\d{3}', schl) and name:
        kreise[schl] = (re.sub(r',\s*(Stadt|Landeshauptstadt|Hansestadt).*$', '', name), art)

sys.stderr.write('Amtliche NI-Kreise gelesen: %d\n' % len(kreise))
if len(kreise) < 30:
    sys.stderr.write('ABBRUCH: zu wenige Kreise - Tabelle nicht richtig gelesen.\n')
    sys.exit(1)

LIG = set('ftilh')

def passt(amtlich, roh):
    """Entsteht roh aus amtlich, wenn Ligaturen zu Luecken werden?
    Jede Luecke im rohen Namen darf ein echtes Leerzeichen sein ODER
    eine weggefallene Ligatur. Rueckgabe: die eingesetzten Stuecke."""
    teile = [t for t in re.split(r'\s+', roh.strip()) if t]
    if not teile:
        return None
    muster = r'^' + r'(\s|.{1,4})'.join(re.escape(t) for t in teile) + r'$'
    m = re.fullmatch(muster, amtlich)
    if not m:
        return None
    eingesetzt = []
    for s in m.groups():
        if s is None or s.isspace():
            continue                      # echtes Leerzeichen - in Ordnung
        # An einer Wortgrenze faellt die Ligatur ZUSAETZLICH zum
        # Leerzeichen weg: "Grafschaft Bentheim" wird zu "Grafscha
        # Bentheim", eingesetzt ist also "ft ". Das Leerzeichen gehoert
        # dann zum echten Text und wird nicht mitgeprueft.
        kern = s.replace(' ', '')
        if not kern or not set(kern.lower()) <= LIG:
            return None                   # keine Ligatur, also Zufall
        eingesetzt.append(kern)
    return eingesetzt

def art_passt(roh, art):
    if re.match(r'^Stadt\s', roh):
        return 'Stadt' in art
    if re.match(r'^(Landkreis|Kreis)\s', roh):
        return 'Landkreis' in art
    return True

# ── Die rohen Namen ───────────────────────────────────────────────────
roh = []
with open(sys.argv[2], encoding='utf-8') as f:
    kopf = f.readline().strip().split(';')
    for z in f:
        w = z.rstrip('\n').split(';')
        if len(w) >= 2:
            roh.append(dict(zip(kopf, w)))

gesehen = {}
for r in roh:
    n = (r.get('ausschuss') or '').strip(' -')
    if n and n != '?':
        gesehen.setdefault(n, []).append(r['workbook'])

# Ein Gebiet, das mehrere Kreise nennt oder einen Kreis EINSCHRAENKT,
# ist kein Kreis. Es hilft nichts, dafuer einen AGS zu suchen.
def zusammengesetzt(n):
    return bool(re.search(r'\bund\b|,|Übriger|Altkreis|ohne\b|mit Ortslagen|Landkreise\b', n))

eindeutig, mehr, keiner, zus = [], [], [], []
for n in sorted(gesehen):
    if zusammengesetzt(n):
        zus.append(n); continue
    kern = re.sub(r'^(Landkreis|Stadt|Region|Kreis)\s+', '', n).strip()
    # Zwei Kurzformen, die keine Ligaturfrage sind: der Ausschuss
    # schreibt "Reg. Hannover" fuer "Region Hannover" und laesst den
    # amtlichen Klammerzusatz weg ("Nienburg" statt "Nienburg (Weser)").
    # Beide werden hier BENANNT zugelassen, nicht stillschweigend -
    # jede weitere Kurzform faellt weiter durch und bleibt offen.
    kurz = re.sub(r'^Reg\.\s+', 'Region ', n)
    kern_kurz = re.sub(r'^(Landkreis|Stadt|Region|Kreis)\s+', '', kurz).strip()
    treffer = []
    for ags, (amt, art) in kreise.items():
        if not art_passt(n, art):
            continue
        amt_ohne = re.sub(r'\s*\([^)]*\)\s*$', '', amt).strip()
        for kand in (n, kern, kurz, kern_kurz):
            if amt_ohne != amt and passt(amt_ohne, kand) is not None:
                treffer.append((ags, amt, ''))
                break
        else:
            for kand in (n, kern, kurz, kern_kurz):
                s = passt(amt, kand)
                if s is not None:
                    treffer.append((ags, amt, ''.join(s)))
                    break
    if len(treffer) == 1:
        eindeutig.append((n, treffer[0]))
    elif treffer:
        mehr.append((n, treffer))
    else:
        keiner.append(n)

print('═══ EINDEUTIG AUFGELOEST (%d) ═══' % len(eindeutig))
for n, (ags, amt, s) in eindeutig:
    mark = ('  <- Ligatur "%s"' % s) if s else ''
    print('  %-38s %s  %s%s' % (n[:38], ags, amt, mark))
if mehr:
    print('\n═══ MEHRDEUTIG - kein Rezept (%d) ═══' % len(mehr))
    for n, t in mehr:
        print('  %-38s %s' % (n[:38], ', '.join(a + ' ' + x for a, x, _ in t)))
if keiner:
    print('\n═══ KEIN AMTLICHER KREIS PASST (%d) ═══' % len(keiner))
    for n in keiner:
        print('  %-38s (%d Workbook(s))' % (n[:38], len(gesehen[n])))
print('\n═══ ZUSAMMENGESETZTE GEBIETE - kein einzelner Kreis (%d) ═══' % len(zus))
for n in zus:
    print('  %-52s %d Workbook(s)' % (n[:52], len(gesehen[n])))

wb_zus = sum(len(gesehen[n]) for n in zus)
wb_ein = sum(len(gesehen[n]) for n, _ in eindeutig)
print('\n── Zusammenfassung ──')
print('  Gebiete gesamt:        %d' % len(gesehen))
print('  auf einen Kreis:       %d  (%d Workbooks)' % (len(eindeutig), wb_ein))
print('  zusammengesetzt:       %d  (%d Workbooks)' % (len(zus), wb_zus))
print('  mehrdeutig/ohne Kreis: %d' % (len(mehr) + len(keiner)))

# ── Zuordnungsdatei fuer den Rezeptbau ────────────────────────────────
# Mit "--csv" schreibt das Werkzeug, was es BEWEISEN konnte - und nur
# das. Zusammengesetzte Gebiete und Gemeinden stehen mit leerem AGS und
# einem Grund darin, damit beim Rezeptbau niemand sie fuer vergessen
# haelt und still einen Kreis einsetzt.
if '--csv' in sys.argv:
    import io
    zuord = {}
    for n, (ags, amt, s) in eindeutig:
        zuord[n] = (ags, amt, 'ligatur:' + s if s else 'direkt')
    for n in zus:
        zuord[n] = ('', '', 'zusammengesetzt - mehrere Kreise oder Teilgebiet')
    for n, t in mehr:
        zuord[n] = ('', '', 'mehrdeutig: ' + '/'.join(a for a, _, _ in t))
    for n in keiner:
        zuord[n] = ('', '', 'kein Kreis - Gemeindeebene oder Kurzform')
    with io.open('ni-ags.csv', 'w', encoding='utf-8') as f:
        f.write('workbook;roh_name;ags;amtlicher_name;befund\n')
        for r in roh:
            n = (r.get('ausschuss') or '').strip(' -')
            a, amt, b = zuord.get(n, ('', '', 'kein Name im Kopfdatensatz'))
            f.write('%s;%s;%s;%s;%s\n' % (r['workbook'], n, a, amt, b))
    sys.stderr.write('ni-ags.csv geschrieben: %d Zeilen\n' % len(roh))
