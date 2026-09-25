# -*- coding: utf-8 -*-
# Bayern IMB 2026, Kapitel 11 "Wertermittlungsrelevante Daten".
# Der Bericht nennt KEINE Werte - er sagt je Ausschuss, WELCHE Daten
# 2023-2025 abgeleitet wurden. Das ist der Weg zur Quelle, nicht die Zahl.
import re, json
Z = open('/tmp/by.txt', encoding='utf-8', errors='replace').read().split('\n')
VON, BIS = 16430, 16570
SPALTEN = ['sachwertfaktoren','liegenschaftszinssaetze','index_bauland_wb',
           'index_bebaute_wb','index_etw','index_bauland_gewerbe',
           'index_agrar','marktbericht']
HAKEN = 'ü'

kopf, saetze = None, []
for i in range(VON, min(BIS, len(Z))):
    z = Z[i].rstrip()
    if re.search(r'Stadt/\s*Landkreis', z):
        p = z.index('Landkreis') + len('Landkreis')
        # An DOPPELabstaenden trennen: "ind. WB" und "Index Agrar" sind
        # je EINE Spalte, aber zwei Woerter.
        k = [m.start() + p for m in re.finditer(r'\S+(?: \S+)*', z[p:])]
        if len(k) == len(SPALTEN): kopf = k
        continue
    if kopf is None: continue
    m = re.match(r'^\s*(.{2,55}?)(?:\s{2,}|$)', z)
    if not m: continue
    name = m.group(1).strip()
    if not re.search(r'(LK|kreisfreie Stadt)$', name): continue
    hat = {s: False for s in SPALTEN}
    for idx, ch in enumerate(z):
        if ch != HAKEN: continue
        d = sorted((abs(idx - k), n) for k, n in zip(kopf, SPALTEN))
        if d[0][0] <= 8: hat[d[0][1]] = True
    saetze.append({'name': name, **hat})

print('Kreiszeilen      :', len(saetze))
for c in SPALTEN:
    print('  ' + c.ljust(24), sum(1 for s in saetze if s[c]))
print('ganz ohne Eintrag:', sum(1 for s in saetze if not any(s[c] for c in SPALTEN)))
json.dump(saetze, open('/tmp/by-verf.json','w'), ensure_ascii=False, indent=1)
