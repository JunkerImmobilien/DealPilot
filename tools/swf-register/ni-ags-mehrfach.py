#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ni-ags-mehrfach.py — die zusammengesetzten Gebiete aufloesen

ni-ags-aufloesen.py ordnet jedem Gebiet GENAU EINEN Kreis zu und laesst
alles liegen, was mehrere nennt: "Landkreise Cloppenburg und Vechta",
"Stadt Delmenhorst und Lk Oldenburg und Wesermarsch", "Stuhr, Syke,
Weyhe". Das waren 16 Gebiete mit 23 Workbooks - der groesste
ungehobene Block in Niedersachsen.

Das Register kann sie fuehren: rezept2register.py nimmt 'ags' als
LISTE. Was fehlt, ist die Liste.

DIESES SKRIPT RAET NICHT. Es zerlegt den Gebietsnamen an "und" und
Komma, loest jedes Stueck einzeln gegen das amtliche Kreisverzeichnis
auf - mit derselben Ligaturpruefung wie ni-ags-aufloesen.py - und gibt
nur aus, was VOLLSTAENDIG aufgeht. Bleibt ein Stueck ungeklaert,
faellt das ganze Gebiet durch: eine halbe AGS-Liste ist schlimmer als
keine, weil sie so aussieht, als waere sie vollstaendig.

EINSCHRAENKENDE GEBIETE ("Uebriger Landkreis Wolfenbuettel", "Altkreis
Goettingen ohne Orte: ...") werden NICHT aufgeloest. Sie sind ein Kreis
MINUS etwas, und dafuer gibt es im Register keine Ausschlusslogik. Sie
bekommen einen eigenen Vermerk.

Aufruf:  python3 ni-ags-mehrfach.py kreise.xlsx ni-kopfdaten.csv [--csv]
"""
import re, sys, zipfile
from xml.etree import ElementTree as ET

NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
LIG = set('ftilh')

def xlsx_zeilen(pfad):
    z = zipfile.ZipFile(pfad)
    st = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')):
            st.append(''.join(t.text or '' for t in si.iter(NS + 't')))
    for name in sorted(n for n in z.namelist()
                       if re.match(r'xl/worksheets/sheet\d+\.xml$', n)):
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

kreise = {}
for z in xlsx_zeilen(sys.argv[1]):
    if len(z) < 3:
        continue
    schl, art, name = (z[0] or '').strip(), (z[1] or '').strip(), (z[2] or '').strip()
    if re.fullmatch(r'03\d{3}', schl) and name:
        kreise[schl] = (re.sub(r',\s*(Stadt|Landeshauptstadt|Hansestadt).*$', '', name), art)

sys.stderr.write('Amtliche NI-Kreise: %d\n' % len(kreise))
if len(kreise) < 30:
    sys.stderr.write('ABBRUCH: Kreisliste nicht gelesen.\n'); sys.exit(1)

def passt(amtlich, roh):
    """Wie in ni-ags-aufloesen.py: jede Luecke ist ein echtes
    Leerzeichen ODER eine weggefallene Ligatur."""
    teile = [t for t in re.split(r'\s+', roh.strip()) if t]
    if not teile:
        return None
    muster = r'^' + r'(\s|.{1,4})'.join(re.escape(t) for t in teile) + r'$'
    m = re.fullmatch(muster, amtlich)
    if not m:
        return None
    for s in m.groups():
        if s is None or s.isspace():
            continue
        kern = s.replace(' ', '')
        if not kern or not set(kern.lower()) <= LIG:
            return None
    return True

def ein_kreis(stueck):
    """Genau ein amtlicher Kreis fuer dieses Stueck, oder None."""
    s = stueck.strip(' -–')
    # Die Art wird MITGENOMMEN, nicht nur weggeschnitten: "Oldenburg"
    # gibt es zweimal - als kreisfreie Stadt (03403) und als Landkreis
    # (03458). Ohne diese Probe waere die Aufloesung dort eine Muenze.
    art_soll = None
    if re.match(r'^(Stadt|Städte)\s', s):
        art_soll = 'Stadt'
    elif re.match(r'^(Landkreise|Landkreis|Lk\.?)\s', s):
        art_soll = 'Landkreis'
    s = re.sub(r'^(Landkreise|Landkreis|Lk\.?|Kreis|Stadt|Städte|Region|Reg\.)\s+', '', s)
    s = re.sub(r'\s*\(.*?\)\s*$', '', s).strip()
    if not s:
        return None

    def kandidaten(pruef):
        out = []
        for ags, (amt, art) in kreise.items():
            if art_soll and art_soll not in art:
                continue
            amt_ohne = re.sub(r'\s*\([^)]*\)\s*$', '', amt).strip()
            if pruef(amt) or (amt_ohne != amt and pruef(amt_ohne)):
                out.append(ags)
        return out

    # 1. Der genaue Weg: Ligaturpruefung wie in ni-ags-aufloesen.py.
    treffer = kandidaten(lambda amt: passt(amt, s))
    if len(treffer) == 1:
        return treffer[0]
    if treffer:
        return None                   # mehrdeutig bleibt mehrdeutig

    # 2. Der Ausschuss kuerzt manchmal: "Hameln" fuer "Hameln-Pyrmont".
    #    Erlaubt ist nur ein Praefix VOR einem Bindestrich, und auch das
    #    nur, wenn genau ein Kreis so beginnt. "Oldenburg" wuerde hier
    #    weiterhin durchfallen, weil es zwei gibt.
    def praefix(amt):
        return '-' in amt and amt.split('-')[0].strip() == s
    treffer = kandidaten(praefix)
    return treffer[0] if len(treffer) == 1 else None

def einschraenkend(n):
    return bool(re.search(r'Übriger|Altkreis|\bohne\b|mit Ortslagen', n))

def zerlegen(n):
    """An 'und' und Komma trennen - aber nicht innerhalb einer Klammer."""
    t = re.sub(r'\s*\([^)]*\)', '', n)
    return [s for s in re.split(r'\s+und\s+|,\s*', t) if s.strip()]

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

auf, teil, eins = [], [], []
for n in sorted(gesehen):
    if einschraenkend(n):
        eins.append((n, gesehen[n])); continue
    stuecke = zerlegen(n)
    if len(stuecke) < 2:
        continue                      # die macht ni-ags-aufloesen.py
    treffer, offen = [], []
    for s in stuecke:
        a = ein_kreis(s)
        (treffer if a else offen).append(a or s)
    if offen:
        teil.append((n, gesehen[n], treffer, offen))
    else:
        auf.append((n, gesehen[n], treffer))

print('═══ VOLLSTÄNDIG AUFGELÖST (%d Gebiete) ═══' % len(auf))
for n, wbs, ags in auf:
    print('  %-52s %s  (%d Workbook(s))' % (n[:52], ' + '.join(ags), len(wbs)))
if teil:
    print('\n═══ TEILWEISE — fällt durch (%d) ═══' % len(teil))
    for n, wbs, ags, offen in teil:
        print('  %-52s gefunden: %s · offen: %s'
              % (n[:52], ' + '.join(ags) or '—', ', '.join(offen)))
print('\n═══ EINSCHRÄNKEND — kein Registerweg (%d) ═══' % len(eins))
for n, wbs in eins:
    print('  %-52s %d Workbook(s)' % (n[:52], len(wbs)))

wb_auf = sum(len(w) for _, w, _ in auf)
print('\n── %d Gebiete mit %d Workbooks aufgelöst · %d teilweise · %d einschränkend ──'
      % (len(auf), wb_auf, len(teil), len(eins)))

if '--csv' in sys.argv:
    import io
    with io.open('ni-ags-mehrfach.csv', 'w', encoding='utf-8') as f:
        f.write('workbook;roh_name;ags_liste;anzahl_kreise\n')
        for n, wbs, ags in auf:
            for wb in wbs:
                f.write('%s;%s;%s;%d\n' % (wb, n, '|'.join(ags), len(ags)))
    sys.stderr.write('ni-ags-mehrfach.csv geschrieben: %d Zeilen\n' % wb_auf)
