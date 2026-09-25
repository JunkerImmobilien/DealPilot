# -*- coding: utf-8 -*-
import json, re, unicodedata
verf = json.load(open('/tmp/by-verf.json'))
ags  = json.load(open('/tmp/by-ags.json'))

def norm(s):
    s = s.lower()
    s = s.replace('ä','ae').replace('ö','oe').replace('ü','ue').replace('ß','ss')
    s = re.sub(r'\b(landeshauptstadt|stadt|landkreis|lk)\b', ' ', s)
    s = re.sub(r'[^a-z0-9]+', '', s)
    return s

# Kreisfreie Stadt und Landkreis koennen denselben Namen tragen
# (Augsburg, Bamberg, ...). Deshalb wird die ART mitgefuehrt, nicht nur
# der Name - sonst landet der Landkreis auf der Stadt.
idx = {}
for k, n in ags.items():
    art = 'stadt' if k[2] in '1234' and int(k[3:]) < 100 else 'lk'
    idx.setdefault(norm(n), []).append((k, n))

treffer, offen = [], []
for s in verf:
    roh = s['name']
    ist_stadt = 'kreisfreie Stadt' in roh
    kern = norm(re.sub(r',\s*(LK|kreisfreie Stadt|Rest LK|Rhein-Main LK)$', '', roh))
    kand = idx.get(kern, [])
    if len(kand) == 1:
        k, n = kand[0]
        treffer.append({**s, 'ags': k, 'amtlicher_name': n})
    elif len(kand) == 2:
        # zwei gleichnamige: Stadt hat die kleinere Ordnungsnummer
        kand.sort(key=lambda x: x[0])
        k, n = kand[0] if ist_stadt else kand[1]
        treffer.append({**s, 'ags': k, 'amtlicher_name': n})
    else:
        offen.append(roh)

print('zugeordnet:', len(treffer), ' offen:', len(offen))
for o in offen: print('   OFFEN:', o)
json.dump(treffer, open('/tmp/by-verf-ags.json','w'), ensure_ascii=False, indent=1)
