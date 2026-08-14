#!/usr/bin/env python3
# land-code-reparatur.py   (v1093-WREP)
#
# EIN MARKER SAGT "HIER WAR ICH", NICHT "HIER IST ALLES GUT".
#
# Der Umsetzer trug bis v1090 `land_code: 'NW'` fest verdrahtet — aus der
# Zeit, als das Register nur Nordrhein-Westfalen fuehrte. Seit v1088 stehen
# aber Saetze aus Sachsen-Anhalt, Thueringen, Bayern und Niedersachsen in den
# Saatdateien, und alle tragen 'NW'.
#
# v1093 behebt die URSACHE (der Umsetzer leitet den Landesschluessel jetzt
# aus dem AGS ab). Das allein reicht nicht: die bereits gebauten Saatdateien
# tragen den falschen Wert weiter. Wo ein Fehler ausgeliefert wurde, braucht
# es einen Schritt, der den SCHADEN sucht — nicht nur einen, der die Quelle
# schliesst.
#
# WAS DER FEHLER ANRICHTET: funktional bisher nichts, weil die Zustaendigkeit
# ueber den AGS aufgeloest wird und ein AGS bundesweit eindeutig ist. Aber
# die Spalte steht im eindeutigen Schluessel von mb.param_modell, und jede
# spaetere Auswertung nach Bundesland bekaeme fuer Bayern null Zeilen und
# fuer NRW 101 zu viel. Ein stiller Rueckfall in Reinform: eine Zahl, die
# aussieht wie die richtige.
#
# Idempotent: ein zweiter Lauf meldet 0 Aenderungen.

import json, sys, os, glob

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
REG = os.path.join(ROOT, 'marktbericht', 'backend', 'src', 'lib', 'register')

LAND_AUS_AGS = {
    '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE',
    '07': 'RP', '08': 'BW', '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB',
    '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH',
}


def main():
    dateien = sorted(glob.glob(os.path.join(REG, '*.json')))
    if not dateien:
        print(f'FEHLER: keine Saatdateien unter {REG}', file=sys.stderr)
        return 1

    gesamt_ge, gesamt_un = 0, 0
    for p in dateien:
        try:
            d = json.load(open(p, encoding='utf-8'))
        except Exception as e:
            print(f'FEHLER: {p} nicht lesbar: {e}', file=sys.stderr)
            return 1
        if not isinstance(d, list):
            continue

        ge, un, ohne = 0, 0, 0
        for s in d:
            ags = str(s.get('ags') or '')
            code = LAND_AUS_AGS.get(ags[:2])
            if not code:
                ohne += 1
                continue
            if s.get('land_code') != code:
                s['land_code'] = code
                ge += 1
            else:
                un += 1
        if ohne:
            print(f'FEHLER: {os.path.basename(p)}: {ohne} Saetze mit einem AGS, '
                  f'der zu keinem Bundesland gehoert', file=sys.stderr)
            return 1
        if ge:
            json.dump(d, open(p, 'w', encoding='utf-8'),
                      ensure_ascii=False, indent=1)
        laender = sorted({s.get('land_code') for s in d})
        print(f'  {os.path.basename(p):24} {len(d):>4} Saetze · '
              f'{ge} berichtigt · {un} bereits richtig · {" ".join(laender)}')
        gesamt_ge += ge
        gesamt_un += un

    print(f'  {"gesamt":24} {gesamt_ge} berichtigt, {gesamt_un} unveraendert')
    return 0


if __name__ == '__main__':
    sys.exit(main())
