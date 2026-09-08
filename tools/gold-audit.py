#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gold-audit — Der Waechter. READ-ONLY, aendert NICHTS.

WOZU: Nach W29-W34 traegt kein Modul mehr eigenes Gold — alles zeigt auf
WL_TINTS in whitelabel-override.js. Aber nichts hindert ein neues Modul daran,
morgen wieder #C9A84C hart reinzuschreiben. Genau so ist der Zustand entstanden,
den wir aufgeraeumt haben.

Dieses Skript nimmt die Landkarte SELBST auf — es liest, was index.html und
quickcheck-app.html tatsaechlich laden, statt einer Liste zu glauben. Das war
mein Fehler: ich habe der Uebergabe geglaubt ("25 Module + style.css") und die
zwoelf anderen Stylesheets vier Pakete lang nicht gesehen.

AUFRUF (auf Staging oder Prod):
    python3 gold-audit.py                    # Kurzbericht
    python3 gold-audit.py --alle             # jede einzelne Fundstelle
    python3 gold-audit.py /pfad/zum/frontend

BASISLINIE (v1259): 468 Fundstellen sind ALTBESTAND aus 56 Dateien. Sie alle zu
tokenisieren hiesse, 56 Dateien anzufassen, in denen Gold teils in Gradienten,
color-mix und Inline-Stilen steckt — viel Risiko fuer einen Nutzen, den heute
niemand hat: es gibt genau EIN Partner-Abo. Der Waechter wurde gebaut, um NEUES
Hartgold zu finden, nicht um den Altbestand taeglich zu wiederholen. Ein Rot,
das immer rot ist, wird nicht gelesen.

Deshalb vergleicht er ab v1259 gegen `gold-audit-basislinie.txt` — je Datei eine
Zahl. MEHR als dort steht = rot. Weniger = gruen, mit dem Hinweis, die Basislinie
zu senken. Eine Datei, die dort GAR NICHT steht, ist immer rot: so faellt ein
neues Modul mit hartem Gold sofort auf, auch wenn die Gesamtzahl gleich bliebe.

FEHLT die Basislinie-Datei, gilt das alte Verhalten (jeder Fund = rot). Ein
frischer Klon soll nicht still durchgehen, nur weil eine Datei fehlt.

    python3 gold-audit.py --basislinie-schreiben    # Stand einfrieren

RUECKGABE: 0 = sauber · 1 = mehr Hartgold als in der Basislinie
"""
import os, re, sys

BASE = '/opt/dealpilot/frontend'
for a in sys.argv[1:]:
    if not a.startswith('--'):
        BASE = a

# v1259 · BASE MUSS absolut sein. Mit einem relativen Pfad ("gold-audit.py
# frontend") loest Zeile ~86 die Treffer gegen BASE ein ZWEITES Mal auf —
# aus 'frontend/js/auth.js' wird 'frontend/frontend/js/auth.js', die Datei
# gibt es nicht, sie fliegt raus. Gemessen am 08.09.2026: absolut 181
# eingelesene Dateien, relativ 6. Und der Waechter meldete dabei "sauber".
# Ein Pruefer, der bei falschem Aufruf gruen wird, ist gefaehrlicher als
# keiner — deshalb hier absolut, und unten eine Deckungspruefung.
BASE = os.path.abspath(BASE)

ALLE = '--alle' in sys.argv
SCHREIBEN = '--basislinie-schreiben' in sys.argv
BASISDATEI = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gold-audit-basislinie.txt')


def basislinie_lesen():
    """Rueckgabe: (dict {relpfad: zahl}, assets_soll) oder (None, 0), wenn es
       keine Basislinie gibt. None ist etwas anderes als {} — {} hiesse
       'eingefroren auf null'.
       assets_soll ist die Zahl der Dateien, die beim Einfrieren eingelesen
       wurden. Sie ist die Deckungspruefung: liest der Waechter heute deutlich
       weniger, hat er nicht weniger GEFUNDEN, sondern weniger GESUCHT."""
    if not os.path.isfile(BASISDATEI):
        return None, 0
    out, assets_soll = {}, 0
    try:
        with open(BASISDATEI, 'r', encoding='utf-8') as f:
            for ln in f:
                ln = ln.strip()
                if ln.startswith('# ASSETS\t'):
                    try:
                        assets_soll = int(ln.split('\t')[1].strip())
                    except (IndexError, ValueError):
                        pass
                    continue
                if not ln or ln.startswith('#'):
                    continue
                # Trenner ist der LETZTE Tabulator: Dateinamen duerfen Leerzeichen tragen.
                if '\t' not in ln:
                    continue
                name, _, zahl = ln.rpartition('\t')
                try:
                    out[name.strip()] = int(zahl.strip())
                except ValueError:
                    continue
    except Exception:
        return None, 0
    return out, assets_soll

VARFB = re.compile(r'var\(\s*--[A-Za-z0-9-]+\s*,\s*(?:[^()]|\([^()]*\))*\)')
HELP = re.compile(r"(window\.)?_wlc\(\s*'#[0-9A-Fa-f]{6}'\s*\)|_dpshGold\(\)"
                  r"|window\._qcGold\([^()]*\)|window\._qcGoldRGB\(\)"
                  r"|(window\.)?_wlrgbaH\(\s*'#[0-9A-Fa-f]{6}'[^()]*\)"
                  r"|(window\.)?_wlrgba\([^()]*\)")
CMT = re.compile(r'/\*.*?\*/|<!--.*?-->|//[^\n]*', re.S)
URI = re.compile(r'url\(\s*["\']?data:(?:[^()]|\([^()]*\))*\)')
HEX = re.compile(r'#[0-9A-Fa-f]{6}\b')
RGBA = re.compile(r'rgba?\(\s*201\s*,\s*168\s*,\s*76\s*,\s*(?!0\s*\))')  # Alpha 0 = unsichtbar, bewusst


def goldish(h):
    r, g, b = int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)
    return r >= g > b and (r - b) >= 20 and r >= 110


def rd(p):
    try:
        with open(p, 'r', encoding='utf-8', errors='replace') as f:
            return f.read()
    except Exception:
        return ''


# ── 1) Die Landkarte SELBST aufnehmen ───────────────────────────────────────
# Jedes Dokument, das die App ausliefert. marktbericht-app/index.html ist eine
# EIGENE App in einem eigenen iframe — sie hat mir vier Pakete lang gefehlt.
docs = ['index.html', 'quickcheck-app.html', 'mobile-demo.html', 'pass.html',
        'reseller.html', os.path.join('marktbericht-app', 'index.html')]
assets, fehlt = [], []
for d in docs:
    p = os.path.join(BASE, d)
    if not os.path.isfile(p):
        continue
    assets.append(d)
    # v954-relpath: RELATIV ZUM DOKUMENT aufloesen, nicht gegen BASE.
    # Bis v953 stand hier join(BASE, u) — fuer index.html stimmt das zufaellig,
    # weil sie IN BASE liegt. marktbericht-app/index.html liegt eine Ebene tiefer:
    #     src="app.js"                       -> frontend/app.js            (gibt es nicht)
    #     src="../js/whitelabel-override.js" -> /opt/dealpilot/js/...      (gibt es nicht)
    # -> Die GESAMTE Marktbericht-App wurde nie geprueft. Ausgerechnet die App,
    #    von der dieser Kopfkommentar sagt, sie habe vier Pakete lang gefehlt.
    # Ein fuehrender "/" bleibt BASE-relativ (Absolutpfad ab Webroot).
    ddir = os.path.dirname(p)
    for m in re.finditer(r'\b(?:src|href)\s*=\s*["\']([^"\']+\.(?:js|css))(?:\?[^"\']*)?["\']', rd(p)):
        u = m.group(1)
        if u.startswith('http'):
            continue
        f = (os.path.normpath(os.path.join(BASE, u.lstrip('/'))) if u.startswith('/')
             else os.path.normpath(os.path.join(ddir, u)))
        if os.path.isfile(f):
            if f not in assets:
                assets.append(f)
        elif f not in fehlt:
            fehlt.append(f)
assets = [a if os.path.isabs(a) else os.path.join(BASE, a) for a in assets]
assets = sorted(set(a for a in assets if os.path.isfile(a)))

# ── 2) Die Wahrheit ueber die Farben: WL_TINTS aus dem Override ─────────────
ov = rd(os.path.join(BASE, 'js', 'whitelabel-override.js'))
m = re.search(r'var WL_TINTS = \[([\s\S]*?)\];', ov)
if not m:
    print('FEHLER: WL_TINTS nicht in js/whitelabel-override.js gefunden. W30 eingespielt?')
    sys.exit(2)
TINTS = set(t.lower() for t in re.findall(r"'(#[0-9A-Fa-f]{6})'", m.group(1)))

# Handgeprueft KEIN Marken-Gold (Statusfarben, Rot, warme Grautoene)
IGNOR = set(x.lower() for x in [
    '#B8625C', '#B86250', '#8C4843', '#D98579', '#B94F3A', '#D9685F', '#F0D4CC',
    '#F2ECDC', '#CDBF9A', '#A89F8C', '#ECE4D2', '#EEE6D6', '#E8E2D4', '#FAF6E8',
    '#E89B2F', '#E0A030', '#A16207', '#E8B84F',
])

# Die Stellen, die Literale sein MUESSEN — sonst zeigt der Fallback auf sich selbst:
ROOT = re.compile(r':root\s*\{[^{}]*\}')


def mask_helper(s):
    """Die Helfer tragen das Literal als Rueckfallwert — bewusst. Zeilenweise
       maskieren ist verlaesslicher als Klammern zaehlen: CMT frisst '//' auch
       in 'http://www.w3.org/...' und bringt jede Klammerbilanz durcheinander."""
    out = []
    for ln in s.split('\n'):
        if ('getPropertyValue' in ln or '.test(v) ? v :' in ln
                or 'var f = fb ||' in ln or 'return /^#[0-9a-f]{6}$/i' in ln):
            out.append('')
        else:
            out.append(ln)
    return '\n'.join(out)


# ── 3) Pruefen ──────────────────────────────────────────────────────────────
neu, bekannt, rest = {}, {}, {}
for p in assets:
    # whitelabel-override.js IST die Farbquelle — dort MUESSEN die Literale stehen.
    if os.path.basename(p) == 'whitelabel-override.js':
        continue
    s = rd(p)
    probe = HELP.sub('', VARFB.sub('', URI.sub('', CMT.sub('', s))))
    probe = mask_helper(probe)
    # :root NUR in echten Stylesheets ausnehmen — dort sind die Literale die
    # Fallback-Quelle. In einer .js-Datei ist ':root{' ein String, also ein
    # Namensraum, der sehr wohl tokenisiert gehoert (storage.js:2174 hat mich
    # das gelehrt: die Maske hat den halben Modal-Bausatz verschluckt).
    if p.endswith('.css') or p.endswith('.html'):
        probe = ROOT.sub('', probe)
    name = os.path.relpath(p, BASE)
    for h in HEX.findall(probe):
        hl = h.lower()
        if not goldish(h):
            continue
        if hl in IGNOR:
            continue
        (bekannt if hl in TINTS else rest).setdefault(name, {}).setdefault(hl, 0)
        (bekannt if hl in TINTS else rest)[name][hl] += 1
    n = len(RGBA.findall(probe))
    if n:
        bekannt.setdefault(name, {}).setdefault('rgba(201,168,76,..)', 0)
        bekannt[name]['rgba(201,168,76,..)'] += n

print('=' * 72)
print(' GOLD-AUDIT   %s' % BASE)
print('=' * 72)
print(' Dokumente + geladene Dateien selbst eingelesen: %d' % len(assets))
if fehlt:
    # v954-relpath: Zahl NENNEN. `fehlt[:5]` zeigte fuenf Namen ohne Gesamtzahl —
    # so faellt nicht auf, dass eine ganze App fehlt. Ein Waechter, dessen eigene
    # Luecke man nicht sieht, ist eine Beruhigung, keine Pruefung.
    print(' [!] Referenziert, aber NICHT auf der Platte: %d Datei(en)' % len(fehlt))
    for f in fehlt:
        print('       %s' % os.path.relpath(f, BASE) if f.startswith(BASE) else '       %s' % f)
    print('     -> Diese Dateien wurden NICHT geprueft. Tippfehler im src= oder Datei geloescht?')
print(' WL_TINTS im Override: %d Toene' % len(TINTS))
print()

if bekannt:
    tot = sum(sum(v.values()) for v in bekannt.values())
    print(' [!] HARTES GOLD AUS DER TOKEN-LISTE — gehoert auf var(--wl-<hex>, #<hex>):')
    print('     %d Fundstellen in %d Datei(en)' % (tot, len(bekannt)))
    for f in sorted(bekannt, key=lambda x: -sum(bekannt[x].values())):
        print('       %-34s %s' % (f, ', '.join('%s x%d' % (k, v)
                                                for k, v in sorted(bekannt[f].items(), key=lambda x: -x[1])[:5])))
    print()
    print('     -> Das faerbt sich beim Mandanten NICHT um. Ob das ein FEHLER ist,')
    print('        sagt der Basislinien-Vergleich am Ende.')
else:
    print(' [OK] Kein hartes Gold aus der Token-Liste. Alles zeigt auf --wl-*.')
print()

if rest:
    tot = sum(sum(v.values()) for v in rest.values())
    print(' [i] Goldnah, aber unbekannt: %d Toene, %d Fundstellen' % (
        len(set(k for v in rest.values() for k in v)), tot))
    print('     Weder in WL_TINTS noch handgeprueft ausgeschlossen. KEIN blinder Sweep —')
    print('     darunter sind Statusfarben, die gold bleiben MUESSEN.')
    if ALLE:
        for f in sorted(rest):
            print('       %s' % f)
            for h, c in sorted(rest[f].items()):
                print('          %s x%d' % (h, c))
    else:
        print('     Vollstaendig:  python3 gold-audit.py --alle')
print()
print('=' * 72)

# ── 4) Basislinien-Vergleich ────────────────────────────────────────────────
# v1259 · Der Waechter soll NEUES Hartgold melden, nicht den Altbestand.
# Verglichen wird JE DATEI, nicht die Summe: sonst deckt eine aufgeraeumte
# Datei eine neue zu, und unterm Strich bliebe alles unauffaellig.
jetzt = dict((f, sum(v.values())) for f, v in bekannt.items())

if SCHREIBEN:
    with open(BASISDATEI, 'w', encoding='utf-8', newline='\n') as f:
        f.write('# gold-audit — Basislinie (Altbestand an hartem Gold je Datei)\n')
        f.write('# Erzeugt mit: python3 tools/gold-audit.py --basislinie-schreiben\n')
        f.write('#\n')
        f.write('# Diese Zahlen sind KEIN Ziel, sondern ein Deckel. Sie duerfen sinken,\n')
        f.write('# nie steigen. Wer eine Datei ohnehin anfasst und Gold tokenisiert,\n')
        f.write('# schreibt die Basislinie danach neu — dann ist der Deckel dichter.\n')
        f.write('# Format: <pfad><TAB><anzahl>\n')
        f.write('#\n')
        f.write('# ASSETS\t%d\n' % len(assets))
        f.write('# ^ Zahl der eingelesenen Dateien. Deckungspruefung: liest ein\n')
        f.write('#   spaeterer Lauf deutlich weniger, hat er weniger GESUCHT, nicht\n')
        f.write('#   weniger gefunden. Dann ist "sauber" eine Luege.\n')
        f.write('#\n')
        f.write('# Gesamt zum Zeitpunkt des Einfrierens: %d Fundstellen in %d Datei(en)\n'
                % (sum(jetzt.values()), len(jetzt)))
        for k in sorted(jetzt):
            f.write('%s\t%d\n' % (k, jetzt[k]))
    print(' [OK] Basislinie geschrieben: %s' % BASISDATEI)
    print('      %d Fundstellen in %d Datei(en) eingefroren.' % (sum(jetzt.values()), len(jetzt)))
    print('=' * 72)
    sys.exit(0)

BASIS, ASSETS_SOLL = basislinie_lesen()

if BASIS is None:
    print(' [i] Keine Basislinie (%s).' % os.path.basename(BASISDATEI))
    print('     Es gilt das strenge Verhalten: JEDER Fund ist rot.')
    print('=' * 72)
    sys.exit(1 if bekannt else 0)

ueber, unter = [], []
for f in sorted(set(list(jetzt.keys()) + list(BASIS.keys()))):
    ist, soll = jetzt.get(f, 0), BASIS.get(f, 0)
    if ist > soll:
        ueber.append((f, soll, ist, f not in BASIS))
    elif ist < soll:
        unter.append((f, soll, ist))

print(' BASISLINIE: %d Fundstellen in %d Datei(en) eingefroren (Altbestand).'
      % (sum(BASIS.values()), len(BASIS)))

# Deckungspruefung VOR dem Vergleich. Ohne sie liest sich ein halb gelaufener
# Waechter wie ein sauberes Ergebnis — jede Datei steht dann unter ihrer
# Basislinie, und das Skript gratuliert zum Aufraeumen.
if ASSETS_SOLL and len(assets) < ASSETS_SOLL * 0.9:
    print()
    print(' [!!] ABBRUCH — DECKUNG ZU GERING: %d von %d Dateien eingelesen.'
          % (len(assets), ASSETS_SOLL))
    print('      Der Waechter hat nicht weniger GEFUNDEN, er hat weniger GESUCHT.')
    print('      Meist ein falscher Pfad. Richtig ist der Frontend-Ordner:')
    print('        python3 tools/gold-audit.py /opt/dealpilot/frontend')
    print('      Sind wirklich Dateien weggefallen: Basislinie neu schreiben.')
    print('=' * 72)
    sys.exit(1)
if ueber:
    print()
    print(' [!!] NEUES HARTES GOLD — mehr als die Basislinie erlaubt:')
    for f, soll, ist, neu_datei in ueber:
        print('        %-34s %d -> %d%s' % (f, soll, ist, '   (Datei war sauber!)' if neu_datei else ''))
    print()
    print('      -> Diese Stellen gehoeren auf var(--wl-<hex>, #<hex>), bevor')
    print('         das Paket rausgeht. Sie sind HEUTE dazugekommen.')
if unter:
    print()
    print(' [OK] Unter der Basislinie — %d Datei(en) aufgeraeumt:' % len(unter))
    for f, soll, ist in unter[:12]:
        print('        %-34s %d -> %d' % (f, soll, ist))
    if len(unter) > 12:
        print('        ... und %d weitere' % (len(unter) - 12))
    print('      -> Basislinie nachziehen: python3 tools/gold-audit.py --basislinie-schreiben')
if not ueber and not unter:
    print(' [OK] Genau auf der Basislinie. Kein neues Hartgold.')
print()
print('=' * 72)
sys.exit(1 if ueber else 0)
