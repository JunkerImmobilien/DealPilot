#!/usr/bin/env python3
# rezept2register.py   (v1084-WREZ)
#
# REZEPT -> REGISTERDATENSATZ.
#
# Ein Rezept ist die menschenlesbare Fassung dessen, was in einem
# Grundstuecksmarktbericht steht. Ein Registerdatensatz ist die Zeile in
# mb.param_modell, aus der der Auswerter rechnet. Dazwischen liegt genau
# eine Uebersetzung, und die steht hier — nicht verteilt auf vierzehn
# Dateien.
#
# WARUM NORMALISIERT WIRD:
# Die Rezepte sind von Hand aus den Berichten uebernommen worden und tragen
# die Feldnamen, die beim Lesen naheliegend waren (`f_feld`, `x_feld`).
# swf_modelle.js hat einen anderen Vertrag (`feld_1`, `achse_feld`). Beides
# ist fuer sich richtig. Was NICHT passieren darf: dass ein unbekannter
# Schluessel still verschwindet und das Modell danach mit einem fehlenden
# Feld rechnet. Deshalb ist die Uebersetzung eine WEISSE LISTE — was hier
# nicht steht, bricht ab.
#
# EINGABEFELDER — die Namen, unter denen der Auswerter die Objektmerkmale
# erwartet. Sie muessen zu dem passen, was gutachterausschuss.js hineingibt:
#   sachwert   vorlaeufiger Sachwert in Euro
#   brw        Bodenrichtwert Euro/m2
#   rnd        Restnutzungsdauer in Jahren
#   bgf        Bruttogrundflaeche m2
#   flaeche    Grundstuecksflaeche m2 (= Baugrundstuecksflaeche)
#   baujahr    Baujahr
#   wohnlage   Wohnlage als Text
#   gebiet     Gebietsnummer/-name
#   lagewert   Lagewert
#   gebaeudegruppe / anbauweise_rheinseite / baulandflaeche  (Bandachsen)

import json, sys, glob, os, re

REZEPTE = sys.argv[1] if len(sys.argv) > 1 else 'rezepte'
ZIEL    = sys.argv[2] if len(sys.argv) > 2 else 'out/swf-nrw.json'

# ── Feldnamen der Rezepte -> Feldnamen des Auswerters ────────────────────
# Nur diese Umbenennungen sind erlaubt. Alles andere wandert unveraendert
# durch; unbekannte STRUKTURSCHLUESSEL brechen ab (siehe pruefe_formel).
UMBENENNEN = {
    'doppel_log': {'f_feld': 'feld_1', 'f_bez': 'bez_1',
                   'x_feld': 'feld_2', 'x_bez': 'bez_2'},
    'potenz':     {'x_feld': 'achse_feld', 'x_bez': 'achse_bez'},
    'linear_sachwert': {'x_feld': 'achse_feld', 'x_bez': 'achse_bez'},
}

# Schluessel, die der Auswerter je Form kennt. Ein Rezept darf weniger
# tragen, aber nichts Fremdes — ein Tippfehler im Schluessel waere sonst
# ein stiller Rueckfall auf den Standardwert.
ERLAUBT = {
    'matrix_interp':     {'form','achse_x','achse_x_feld','achse_x_bez','achse_y',
                          'achse_y_feld','achse_y_bez','zellen','rundung_stellen',
                          'liefert','hinweis','normobjekt'},
    'matrix_kategorial': {'form','achse_x','achse_x_feld','achse_x_bez','achse_k_feld',
                          'achse_k_bez','kategorien','zellen','rundung_stellen',
                          'liefert','hinweis','normobjekt'},
    'matrix_band':       {'form','achse_x_feld','achse_x_bez','achse_y_feld','achse_y_bez',
                          'baender_x','baender_y','zellen','rundung_stellen',
                          'liefert','hinweis','normobjekt'},
    'stufen_1d':         {'form','achse_feld','achse_bez','stufen','rundung_stellen',
                          'liefert','hinweis','normobjekt','jahrgaenge'},
    'potenz':            {'form','achse_feld','achse_bez','a','b','x_faktor',
                          'gueltig_von','gueltig_bis','rundung_stellen','liefert',
                          'hinweis','normobjekt'},
    'linear_sachwert':   {'form','achse_feld','achse_bez','a','b','gueltig_von',
                          'gueltig_bis','rundung_stellen','liefert','hinweis','normobjekt'},
    'doppel_log':        {'form','c','a','b','feld_1','bez_1','gueltig_1',
                          'feld_2','bez_2','gueltig_2','rundung_stellen','liefert',
                          'hinweis','normobjekt'},
    'konstante':         {'form','wert','rundung_stellen','liefert','hinweis','normobjekt'},
}

# Schluessel, die NICHTS berechnen, sondern erklaeren. Sie duerfen in jeder
# Form stehen und wandern unveraendert in den Datensatz — der Bericht soll
# spaeter sagen koennen, WAS er da anwendet.
#
# Sie stehen hier EINZELN aufgezaehlt und nicht als Praefixregel: eine Regel
# der Art "alles mit _bez ist Doku" wuerde einen Tippfehler in einem
# rechnenden Schluessel mit durchlassen, und der waere ein stiller Rueckfall
# auf den Standardwert des Auswerters.
DOKU = {'zellen_schluessel', 'jahrgang', 'ci', 'umrechnung', 'vorbehalt',
        'kategorien_bez', 'normierung', 'quelle_hinweis', 'fundstelle'}

EBENEN = {'gemeinde', 'kreis', 'bezirk', 'gaa', 'land', 'bund'}
EINHEITEN = {'faktor', 'prozent', 'zuschlag_prozent', 'wert_eur'}

fehler = []


def meckern(datei, text):
    fehler.append(f'{datei}: {text}')


def spannen_uebernehmen(m, formel):
    """geltungsbereich.spannen -> gueltig_1/gueltig_2 bei doppel_log.

    Der Auswerter sperrt die Extrapolation nur, wenn er die Spanne kennt.
    Steht sie im Rezept unter geltungsbereich, muss sie hier ankommen —
    sonst rechnet doppel_log ausserhalb der Stichprobe weiter, und genau
    das untersagen die Berichte ausdruecklich.
    """
    if formel.get('form') != 'doppel_log':
        return
    sp = (m.get('geltungsbereich') or {}).get('spannen') or {}
    paare = [('gueltig_1', ['baugrundstuecksflaeche_m2', 'grundstuecksflaeche_m2',
                            'baulandflaeche_m2']),
             ('gueltig_2', ['vorlaeufiger_sachwert_eur', 'sachwert_eur'])]
    for ziel, kandidaten in paare:
        if formel.get(ziel):
            continue
        for k in kandidaten:
            v = sp.get(k)
            if isinstance(v, list) and len(v) == 2:
                formel[ziel] = v
                break


def normalisiere(datei, m):
    form = m.get('form')
    if form not in ERLAUBT:
        meckern(datei, f"Modellform '{form}' kennt der Auswerter nicht")
        return None
    formel = dict(m.get('formel') or {})
    formel['form'] = form

    for alt, neu in UMBENENNEN.get(form, {}).items():
        if alt in formel:
            if neu in formel and formel[neu] != formel[alt]:
                meckern(datei, f'{alt} und {neu} widersprechen sich')
                return None
            formel[neu] = formel.pop(alt)

    spannen_uebernehmen(m, formel)

    fremd = set(formel) - ERLAUBT[form] - DOKU
    if fremd:
        meckern(datei, f"unbekannte Schluessel in formel: {sorted(fremd)}")
        return None

    einheit = formel.get('liefert', 'faktor')
    if einheit not in EINHEITEN:
        meckern(datei, f"liefert='{einheit}' ist keine bekannte Einheit")
        return None

    # ── matrix_kategorial: die Tabelle steht im Rezept GEDREHT ─────────────
    # Der Auswerter liest `zelle(zellen, x_stuetzstelle, kategorie_index)` —
    # also Zeile = x-Wert, Spalte = Kategorie. Die Rezepte sind so
    # geschrieben, wie der Bericht die Tabelle druckt: Zeile = Kategorie.
    # Beides ist lesbar, nur eines rechnet. Gedreht wird HIER, an genau einer
    # Stelle, und nicht in vierzehn Rezepten von Hand — Handarbeit an
    # vierzehn Stellen ist dreizehn Gelegenheiten fuer einen Zahlendreher.
    #
    # Welche Lage vorliegt, sagt der Aufbau selbst: stimmen die Schluessel
    # mit den Kategorien ueberein, ist gedreht. Geraten wird nicht.
    if form == 'matrix_kategorial' and isinstance(formel.get('zellen'), dict):
        kat = [str(k) for k in (formel.get('kategorien') or [])]
        z = formel['zellen']
        if kat and set(map(str, z.keys())) == set(kat):
            achse = formel.get('achse_x') or []
            breit = {len(r) for r in z.values() if isinstance(r, list)}
            if breit != {len(achse)}:
                meckern(datei, f'matrix_kategorial: Zeilenlaenge {breit} passt '
                               f'nicht zur x-Achse ({len(achse)} Stuetzstellen)')
                return None
            formel['zellen'] = {
                str(x): [z[k][i] for k in kat] for i, x in enumerate(achse)}
            formel['zellen_schluessel'] = ('x-Stuetzstelle -> Werte in Reihenfolge '
                                           'kategorien (beim Einlesen gedreht)')

    # Zellenschluessel als String vereinheitlichen. json.dump macht aus
    # einem Float-Schluessel "50000.0", der Leser sucht "50000" — das hat
    # am 12.08. eine ganze Matrix stumm gemacht.
    if 'zellen' in formel and isinstance(formel['zellen'], dict):
        formel['zellen'] = {
            (str(int(k)) if re.fullmatch(r'-?\d+(\.0+)?', str(k)) else str(k)): v
            for k, v in formel['zellen'].items()}

    return formel


def zaehle_zellen(formel):
    z = formel.get('zellen')
    if not isinstance(z, dict):
        return None
    return sum(len(r) for r in z.values() if isinstance(r, list))


def bauen():
    saetze = []
    dateien = sorted(glob.glob(os.path.join(REZEPTE, '*.json')))
    if not dateien:
        print(f'FEHLER: keine Rezepte unter {REZEPTE}', file=sys.stderr)
        return 1

    for p in dateien:
        datei = os.path.basename(p)
        try:
            d = json.load(open(p, encoding='utf-8'))
        except Exception as e:
            meckern(datei, f'nicht lesbar: {e}')
            continue

        ebene = d.get('ebene')
        if ebene not in EBENEN:
            meckern(datei, f"ebene '{ebene}' verletzt param_modell_ebene_check "
                           f'(erlaubt: {sorted(EBENEN)})')
            continue
        ags_liste = d.get('ags') or []
        if not ags_liste:
            meckern(datei, 'kein Zustaendigkeitsschluessel')
            continue

        for m in d.get('modelle') or []:
            formel = normalisiere(datei, m)
            if formel is None:
                continue

            beleg = m.get('beleg')
            if not beleg:
                # CHECK (jsonb_array_length(belege) > 0) — kein Datensatz
                # ohne Beleg. Die Datenbank wuerde es ohnehin ablehnen;
                # hier bricht es mit einer lesbaren Begruendung ab.
                meckern(datei, f"Zweig '{m.get('zweig')}' hat keinen Beleg")
                continue

            for ags in ags_liste:
                saetze.append({
                    'land_code': 'NW',
                    'ags': str(ags),
                    'ebene': ebene,
                    'gebiet_name': d.get('gebiet_name') or d.get('gaa_name'),
                    'gaa_name': d.get('gaa_name'),
                    'kennzahl': 'sachwertfaktor',
                    'zweig': m.get('zweig'),
                    'formel': formel,
                    'korrekturen': m.get('korrekturen') or [],
                    'modellansaetze': m.get('modellansaetze') or d.get('modellansaetze') or {},
                    'geltungsbereich': m.get('geltungsbereich') or {},
                    'belege': [beleg],
                    'stufe': m.get('stufe') or 'A',
                    'stufe_grund': m.get('stufe_grund'),
                    'fallzahl': m.get('fallzahl'),
                    'streuung': m.get('streuung'),
                    'stichtag': d.get('stichtag'),
                    'berichtsjahr': d.get('berichtsjahr'),
                    'modellversion': d.get('modellversion') or f"GMB {d.get('berichtsjahr')}",
                    'quelle_url': d.get('quelle_url'),
                    'quelle_parser': 'v1084-WREZ',
                    'quellenvermerk': d.get('quellenvermerk'),
                    'lizenz': d.get('lizenz'),
                    'fundstelle': d.get('fundstelle'),
                })

    if fehler:
        print('ABBRUCH — kein Registerdatensatz geschrieben:', file=sys.stderr)
        for f in fehler:
            print('  ' + f, file=sys.stderr)
        return 1

    # Der eindeutige Schluessel der Tabelle. Eine Kollision hier wuerde auf
    # dem Server zu einem stillen Ueberschreiben fuehren.
    gesehen = {}
    for s in saetze:
        k = (s['ags'], s['kennzahl'], s['zweig'], s['berichtsjahr'], s['quelle_url'])
        if k in gesehen:
            print(f'ABBRUCH — doppelter Schluessel: {k}', file=sys.stderr)
            return 1
        gesehen[k] = True

    os.makedirs(os.path.dirname(ZIEL) or '.', exist_ok=True)
    with open(ZIEL, 'w', encoding='utf-8') as f:
        json.dump(saetze, f, ensure_ascii=False, indent=1)

    gebiete = len({s['ags'] for s in saetze})
    aus = len({s['gaa_name'] for s in saetze})
    zellen = sum(zaehle_zellen(s['formel']) or 0 for s in saetze)
    print(f'{len(saetze)} Registerdatensaetze · {aus} Ausschuesse · '
          f'{gebiete} Zustaendigkeitsschluessel · {zellen} Tabellenzellen')
    for e in sorted({s['ebene'] for s in saetze}):
        print(f'  ebene={e}: {sum(1 for s in saetze if s["ebene"] == e)}')
    print(f'-> {ZIEL}')
    return 0


if __name__ == '__main__':
    sys.exit(bauen())
