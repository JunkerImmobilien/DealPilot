# -*- coding: utf-8 -*-
import json, re
verf = json.load(open('/tmp/by-verf.json'))
ags  = json.load(open('/tmp/by-ags.json'))
zug  = json.load(open('/tmp/by-verf-ags.json'))

# Fuenf Schreibweisen des Berichts treffen die amtliche Liste nicht.
# Jede EINZELN gegen die Liste geprueft, nicht aus dem Kopf gesetzt.
# "Doanu - Ries" ist ein Tippfehler IM BERICHT (Donau-Ries).
NACHTRAG = {
  'Doanu - Ries, LK':                 '09779',
  'Kempten, kreisfreie Stadt':        '09763',
  'Lindau, LK':                       '09776',
  'Neumarkt i. d. Oberpfalz, LK':     '09373',
  'Neustadt an der Waldnaab, LK':     '09374',
}
schon = {z['name'] for z in zug}
for s in verf:
    if s['name'] in schon: continue
    k = NACHTRAG.get(s['name'])
    if not k:
        print('IMMER NOCH OFFEN:', s['name']); continue
    zug.append({**s, 'ags': k, 'amtlicher_name': ags[k]})

zug.sort(key=lambda x: x['ags'])
doppelt = [a for a in {z['ags'] for z in zug} if sum(1 for z in zug if z['ags']==a) > 1]
print('Saetze:', len(zug), ' eindeutige AGS:', len({z['ags'] for z in zug}), ' doppelt:', doppelt)
print('mit Sachwertfaktor:', sum(1 for z in zug if z['sachwertfaktoren']))
print('mit Liegenschaftsz:', sum(1 for z in zug if z['liegenschaftszinssaetze']))

QV = ('© Oberer Gutachterausschuss für Grundstückswerte im Freistaat Bayern, '
      'Immobilienmarktbericht Bayern 2026, Kapitel 11 '
      '"Wertermittlungsrelevante Daten" (Stand 2025)')
out = {
 'was': 'Verfuegbarkeit wertermittlungsrelevanter Daten je bayerischem Gutachterausschuss',
 'keine_werte': ('Dieser Bericht veroeffentlicht KEINE Zahlenwerte. Er sagt nur, WELCHE '
   'Daten ein Ausschuss 2023-2025 abgeleitet hat. Woertlich: "Bei den '
   'wertermittlungsrelevanten Daten wird lediglich dargestellt, ob diese '
   'vorhanden sind." Die Werte selbst sind beim oertlichen Ausschuss zu '
   'erfragen. Diese Datei ist deshalb der WEG ZUR QUELLE, nicht die Quelle.'),
 'land_code': 'BY', 'stand': '2025', 'berichtsjahr': 2026,
 'quelle_url': 'https://www.gutachterausschuesse-bayern.de/',
 'quellenvermerk': QV,
 'fundstelle': 'Immobilienmarktbericht Bayern 2026, Kapitel 11, S. 197-199',
 'quelle_parser': 'v1613-BYVERF',
 'gebiete': zug,
}
json.dump(out, open('/tmp/by-verfuegbarkeit.json','w'), ensure_ascii=False, indent=1)
print('geschrieben.')
