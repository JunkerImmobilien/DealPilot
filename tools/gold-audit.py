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

RUECKGABE: 0 = sauber · 1 = neues Hartgold gefunden
"""
import os, re, sys

BASE = '/opt/dealpilot/frontend'
for a in sys.argv[1:]:
    if not a.startswith('--'):
        BASE = a
ALLE = '--alle' in sys.argv

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
    print('     -> Das faerbt sich beim Mandanten NICHT um. Bitte tokenisieren.')
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
sys.exit(1 if bekannt else 0)
