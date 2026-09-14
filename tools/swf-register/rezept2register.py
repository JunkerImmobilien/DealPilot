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
                          # v1098d: Die Zuordnung ueber ein ZAHLENBAND gibt es im
                          # Auswerter seit v1094 (kategorieAus, fuer Wiesbaden) -
                          # hier fehlte sie. Ein Rezept mit kategorie_baender waere
                          # am Werkzeug gescheitert, obwohl der Auswerter es kann.
                          'kategorie_baender','zuordnung_feld','kategorie_zuordnung',
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
    # v1098i: Die Formen unten kennt der Auswerter seit v1088 bis v1093,
    # im Werkzeug fehlten sie. Ein Rezept damit waere hier gescheitert,
    # obwohl swf_modelle.js sie rechnet - dieselbe Luecke wie bei
    # kategorie_baender (v1098d).
    'baender_1d':        {'form','achse_feld','achse_bez','baender','rundung_stellen',
                          'liefert','hinweis','normobjekt'},
    'stufen_kategorial': {'form','achse_feld','achse_bez','kategorie_feld','kategorie_bez',
                          'kategorien','stufen','rundung_stellen','liefert','hinweis',
                          'normobjekt'},
    'log_1d':            {'form','achse_feld','achse_bez','a','b','gueltig_von',
                          'gueltig_bis','rundung_stellen','liefert','hinweis','normobjekt'},
    'spanne_kategorial': {'form','achse_feld','achse_bez','kategorien','spannen',
                          'rundung_stellen','liefert','hinweis','normobjekt'},
    # v1101-WBKAT: Baender, die JE KATEGORIE anders laufen.
    'baender_kategorial': {'form','achse_feld','achse_bez','achse_k_feld',
                           'achse_k_bez','kategorien','kategorie_baender',
                           'zuordnung_feld','kategorie_zuordnung','baender_je_kategorie',
                           'rundung_stellen','liefert','hinweis','normobjekt'},
    # v1103-WVERZ: je Kategorie ein VOLLSTAENDIGES Modell. Ersetzt das
    # potenz_kategorial aus v1102 - Havelland braucht je Region andere
    # ACHSEN, nicht nur andere Parameter.
    'verzweigt': {'form','achse_k_feld','achse_k_bez','kategorien',
                  'kategorie_baender','zuordnung_feld','kategorie_zuordnung','kategorie_sonst','kategorie_mehrdeutig',
                  'modell_je_kategorie','rundung_stellen','liefert','hinweis',
                  'normobjekt'},
    # v1110: die Schluessel hier stimmten NIE mit dem Auswerter ueberein
    # (basis/glieder gegen intercept/terme) - die Form war nie benutzt worden.
    'regression_additiv': {'form','intercept','terme','diskret','aussen_exponent',
                           'rundung_stellen','liefert',
                           'hinweis','normobjekt'},
}

# Schluessel, die NICHTS berechnen, sondern erklaeren. Sie duerfen in jeder
# Form stehen und wandern unveraendert in den Datensatz — der Bericht soll
# spaeter sagen koennen, WAS er da anwendet.
#
# Sie stehen hier EINZELN aufgezaehlt und nicht als Praefixregel: eine Regel
# der Art "alles mit _bez ist Doku" wuerde einen Tippfehler in einem
# rechnenden Schluessel mit durchlassen, und der waere ein stiller Rueckfall
# auf den Standardwert des Auswerters.
# v1100c-WBED: `bedingungen` beschreibt den Anwendungsbereich, den der
# Bericht selbst nennt (Uckermark: nur Bodenrichtwert ueber 30 EUR/qm).
# Sie gilt formunabhaengig und wird VOR der Rechnung geprueft.
DOKU = {'zellen_schluessel', 'jahrgang', 'ci', 'umrechnung', 'vorbehalt',
        'kategorien_bez', 'normierung', 'quelle_hinweis', 'fundstelle',
        # `bedingungen` RECHNET nicht, aber es SPERRT - und das ist kein
        # Dokumentationsschluessel im eigentlichen Sinn. Es steht hier, weil
        # es in jeder Form vorkommen darf; geprueft wird es im Auswerter.
        'bedingungen'}

EBENEN = {'gemeinde', 'kreis', 'bezirk', 'gaa', 'land', 'bund'}
EINHEITEN = {'faktor', 'prozent', 'zuschlag_prozent', 'wert_eur'}

fehler = []


# v1098-WKORR · Korrekturen liefen bis hierher UNGEPRUEFT durch.
#
# Der Auswerter kennt fuenf Arten. Steht in `art` etwas anderes - ein
# Tippfehler genuegt -, faellt er in den `stufen`-Zweig, findet dort keine
# Stufen und gibt `null` zurueck: KEINE Korrektur. Still. Das Ergebnis
# bleibt plausibel, es ist nur falsch.
#
# Darum dieselbe Regel wie bei den Formeln: bekannte Schluessel je Art,
# alles andere bricht ab.
# Erlaubt in JEDER Art: "hinweis" erklaert die Korrektur im Bericht und
# rechnet nicht mit. Er stand in den vorhandenen Rezepten und haette sie beim
# ersten Lauf abbrechen lassen - gefunden vom Gegentest gegen die 14 NRW-Rezepte.
KORREKTUR_DOKU = {'hinweis', 'fundstelle', 'quelle_hinweis', 'vorbehalt'}

KORREKTUR_ARTEN = {
    'stufen':     {'art','feld','bez','stufen','wirkung','rundung_stellen'},
    'band':       {'art','feld','bez','baender','wirkung','rundung_stellen'},
    'potenz':     {'art','feld','bez','basis','exponent','wirkung',
                   'rundung_stellen','deckel_ab','deckel_wert','boden_ab','boden_wert'},
    'linear':     {'art','feld','bez','a','b','wirkung',
                   'rundung_stellen','deckel_ab','deckel_wert','boden_ab','boden_wert'},
    'kategorial': {'art','feld','bez','werte','wirkung','rundung_stellen'},
    # v1100-WK2D: eine Korrektur, die von einer ZAHL und einer KATEGORIE
    # abhaengt - Oberhavel druckt die BGF-Korrektur je Region anders ab.
    'stufen_kategorial': {'art','feld','bez','kategorie_feld','stufen',
                           'wirkung','rundung_stellen'},
}


def pruefe_korrekturen(datei, korrekturen):
    for i, k in enumerate(korrekturen):
        if not isinstance(k, dict):
            meckern(datei, f'Korrektur {i}: kein Objekt')
            continue
        # Fehlt `art`, galt bisher `stufen` - das bleibt so, weil die
        # vierzehn vorhandenen Rezepte es so schreiben.
        art = k.get('art') or 'stufen'
        if art not in KORREKTUR_ARTEN:
            meckern(datei, f"Korrektur {i} ('{k.get('bez') or k.get('feld')}'): "
                           f"unbekannte Art '{art}' - bekannt sind "
                           + ', '.join(sorted(KORREKTUR_ARTEN)))
            continue
        fremd = set(k) - KORREKTUR_ARTEN[art] - DOKU - KORREKTUR_DOKU
        if fremd:
            meckern(datei, f"Korrektur {i} ('{k.get('bez') or k.get('feld')}', "
                           f"Art '{art}'): unbekannte Schluessel "
                           + ', '.join(sorted(fremd)))
        if not k.get('feld'):
            meckern(datei, f'Korrektur {i}: kein `feld`')
        if k.get('wirkung') not in (None, 'additiv', 'multiplikativ'):
            meckern(datei, f"Korrektur {i}: `wirkung` ist "
                           f"'{k.get('wirkung')}' - erlaubt sind additiv und multiplikativ")
        # Eine multiplikative Korrektur mit Wert 0 setzt das Ergebnis auf
        # null. Das ist fast nie gemeint und immer eine Meldung wert.
        if art == 'kategorial':
            for name, wert in (k.get('werte') or {}).items():
                if not isinstance(wert, (int, float)):
                    meckern(datei, f"Korrektur {i}: '{name}' traegt keinen Zahlwert")
                elif k.get('wirkung') == 'multiplikativ' and wert == 0:
                    meckern(datei, f"Korrektur {i}: '{name}' ist multiplikativ 0")
    return korrekturen


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

    # v1102-WEIND - EIN NAME DARF NUR IN EINER KATEGORIE STEHEN.
    #
    # GEFUNDEN an Barnim: `Stolzenhagen` ist dort ein Ortsteil von Wandlitz
    # (Region Suedbarnim, Faktor rund 1,07) UND ein Ortsteil von
    # Lunow-Stolzenhagen (Region Nordbarnim, Faktor 0,96). kategorieAus()
    # nimmt den ERSTEN Treffer in der Reihenfolge der Kategorien - fuer die
    # Haelfte der Faelle waere das die falsche Region, und niemand saehe es.
    #
    # Ein mehrdeutiger Name gehoert in KEINE Liste: dann meldet der
    # Auswerter 'kategorie_ohne_wert' und der Bericht sagt, dass er die
    # Lage nicht zuordnen kann. Kein Treffer heisst kein Wert.
    zu = formel.get('kategorie_zuordnung') or {}
    if isinstance(zu, dict):
        gesehen = {}
        for kat, liste in zu.items():
            if not isinstance(liste, list):
                continue
            for name in liste:
                schl = str(name).strip().lower()
                if schl in gesehen and gesehen[schl] != kat:
                    meckern(datei, f"'{name}' steht in zwei Kategorien "
                            f"({gesehen[schl]} und {kat}) - mehrdeutig")
                    return None
                gesehen[schl] = kat

    # v1103-WVERZ - jede Kategorie braucht ihr Modell, und jedes Modell eine
    # Form, die der Auswerter kennt. Sonst stuende eine Kategorie im Rezept,
    # fuer die spaeter still nichts herauskommt.
    # v1105-WTIEFE - ZWEI EBENEN, NICHT MEHR.
    #
    # Potsdam-Mittelmark verzweigt zuerst nach der Region (Berliner Umland
    # oder weiterer Metropolenraum) und INNERHALB jeder Region noch einmal
    # nach dem Bodenrichtwertbereich - und die Bereiche ueberschneiden sich
    # zwischen den Regionen (110 bis 500 hier, 110 bis 290 dort). Eine
    # Ebene reicht dafuer nicht.
    #
    # Tiefer als zwei geht nicht: kein bisher gelesener Bericht braucht es,
    # und eine unbegrenzte Schachtelung waere im Rezept nicht mehr
    # nachvollziehbar.
    def pruefe_verzweigt(f, tiefe, pfad):
        mjk = f.get('modell_je_kategorie') or {}
        fehlen = [k for k in (f.get('kategorien') or []) if str(k) not in mjk]
        if fehlen:
            meckern(datei, f'{pfad}ohne Modell: {fehlen}')
            return False
        for k, um in mjk.items():
            wo = f"{pfad}Untermodell '{k}': "
            if not isinstance(um, dict) or um.get('form') not in ERLAUBT:
                meckern(datei, wo + f"Form '{(um or {}).get('form')}' "
                        'kennt der Auswerter nicht')
                return False
            if um['form'] == 'verzweigt':
                if tiefe >= 2:
                    meckern(datei, wo + 'dritte Verzweigungsebene')
                    return False
                if not pruefe_verzweigt(um, tiefe + 1, wo):
                    return False
                continue
            fremd_u = set(um) - ERLAUBT[um['form']] - DOKU - {'korrekturen'}
            if fremd_u:
                meckern(datei, wo + f'unbekannte Schluessel {sorted(fremd_u)}')
                return False
            pruefe_korrekturen(datei, um.get('korrekturen') or [])
        return True

    if form == 'verzweigt':
        if not pruefe_verzweigt(formel, 1, ''):
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
                    # v1098-WLAND: Das Landeskuerzel stand hier HART auf 'NW'.
                    # Vierzehn Rezepte kamen aus NRW, und solange das so war, fiel
                    # es nicht auf. Das erste Hamburger Rezept waere damit als
                    # nordrhein-westfaelisch ins Register gegangen - und die
                    # Kaskade haette es ueber einen NRW-Gemeindeschluessel gesucht,
                    # den es nicht gibt. Fallback bleibt 'NW', damit die
                    # vorhandenen Rezepte ohne Aenderung weiterlaufen.
                    'land_code': d.get('land_code') or 'NW',

                    'ags': str(ags),
                    'ebene': ebene,
                    'gebiet_name': d.get('gebiet_name') or d.get('gaa_name'),
                    'gaa_name': d.get('gaa_name'),
                    'kennzahl': 'sachwertfaktor',
                    'zweig': m.get('zweig'),
                    'formel': formel,
                    'korrekturen': pruefe_korrekturen(datei, m.get('korrekturen') or []),

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
                    # v1098j · ZWEI VERSCHIEDENE FRAGEN, die bis hierher
                    # vermengt waren:
                    #
                    #   1. Darf Marcel als Sachverstaendiger mit dem Wert
                    #      arbeiten? Amtliche Marktdaten in einem
                    #      Verkehrswertgutachten zu verwenden ist der
                    #      vorgesehene Zweck dieser Berichte.
                    #   2. Darf der Wert in einem DealPilot-Bericht an einen
                    #      KUNDEN gehen? Das entscheidet die Lizenz.
                    #
                    # `verwendung` trennt beides:
                    #   'produkt'    darf ausgeliefert werden
                    #   'gutachten'  Marcel arbeitet damit; im Kundenbericht
                    #                steht nur der Link zur Quelle
                    #
                    # Fehlt das Feld, gilt 'produkt' - so sind die vierzehn
                    # NRW-Rezepte geschrieben, deren Lizenz zero-2-0 ist.
                    'verwendung': d.get('verwendung') or 'produkt',
                    'auflagen': d.get('auflagen'),
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

    # v1098-WLAND2 · JE LAND EINE DATEI.
    #
    # Bis hierher ging alles in `out/swf-nrw.json` — richtig, solange nur NRW
    # drin war. Mit Hamburg waere ein Bundesland in einer Datei namens "nrw"
    # gelandet, und beim naechsten Land das dritte. Der Name haette gelogen,
    # und `SAATDATEIEN` im Backend haette nicht gesagt, was wo liegt.
    #
    # NW behaelt seinen Dateinamen: er steht in `ausschuss_register.js` und
    # in jedem bisherigen Nachweis. Alle anderen bekommen `swf-<land>.json`.
    NW_ZIEL = ZIEL
    nach_land = {}
    for s in saetze:
        nach_land.setdefault(s['land_code'], []).append(s)

    geschrieben = []
    for land, teil in sorted(nach_land.items()):
        pfad = NW_ZIEL if land == 'NW' else os.path.join(
            os.path.dirname(NW_ZIEL) or '.', f'swf-{land.lower()}.json')
        with open(pfad, 'w', encoding='utf-8') as f:
            json.dump(teil, f, ensure_ascii=False, indent=1)
        geschrieben.append((land, pfad, len(teil)))

    gebiete = len({s['ags'] for s in saetze})
    aus = len({s['gaa_name'] for s in saetze})
    zellen = sum(zaehle_zellen(s['formel']) or 0 for s in saetze)
    print(f'{len(saetze)} Registerdatensaetze · {aus} Ausschuesse · '
          f'{gebiete} Zustaendigkeitsschluessel · {zellen} Tabellenzellen')
    for e in sorted({s['ebene'] for s in saetze}):
        print(f'  ebene={e}: {sum(1 for s in saetze if s["ebene"] == e)}')
    for land, pfad, n in geschrieben:
        print(f'-> {pfad}  ({land}: {n})')
    if len(geschrieben) > 1:
        namen = [os.path.basename(p) for _, p, _ in geschrieben]
        print('   Jede Datei muss in SAATDATEIEN stehen '
              '(marktbericht/backend/src/lib/ausschuss_register.js): '
              + ', '.join(namen))
    return 0


if __name__ == '__main__':
    sys.exit(bauen())
