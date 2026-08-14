#!/usr/bin/env python3
# rezept2register.py   (v1094-WREZ)
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
    'stufen_1d': {'achse_x_feld': 'achse_feld', 'achse_x_bez': 'achse_bez'},
    # v1093 · Worms schreibt den Achsennamen unter `eingang`; der Auswerter
    # liest `achse_feld`. `eingang` bleibt zusaetzlich stehen, weil
    # `eingang_bez` die Einheit traegt und die ist hier der ganze Fall.
    'log_1d': {},
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
                          'liefert','hinweis','normobjekt',
                          'kategorie_zuordnung','zuordnung_feld',
                          'kategorie_baender'},
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
    # v1088 · zwei Formen, die Ost- und Sueddeutschland brauchen
    'stufen_kategorial': {'form','achse_k_feld','achse_k_bez','stufen',
                          'rundung_stellen','liefert','hinweis','normobjekt',
                          'stufen_hinweis','kategorie_zuordnung','zuordnung_feld'},
    'regression_additiv':{'form','intercept','terme','rundung_stellen','liefert',
                          'hinweis','normobjekt','wortlaut','wortlaut_hinweis',
                          'diskret'},
    'baender_1d':        {'form','achse_feld','achse_bez','achse_art','baender',
                          'rundung_stellen','liefert','hinweis','normobjekt',
                          'interpolation_grund'},
    # v1093 · zwei Formen aus der Ernte vom 13.08.
    'log_1d':            {'form','achse_feld','achse_bez','eingang','eingang_bez',
                          'a','b','skala','gueltig','gleichung','rundung_stellen',
                          'liefert','hinweis','normobjekt','guete'},
    'spanne_kategorial': {'form','spanne','spanne_wortlaut','wert','wert_hinweis',
                          'kategorie_feld','kategorien','rundung_stellen',
                          'liefert','hinweis','normobjekt'},
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
        'kategorien_bez', 'normierung', 'quelle_hinweis', 'fundstelle',
        'interpolation', 'zeitterm', 'regression', 'einheit_bez',
        'kategorie_zuordnung', 'zuordnung_feld',
        'funktion_dokumentation', 'strittig', 'stufen_fallzahl',
        'stufen_schreibweise_vorbehalt', 'achse_x', 'warnung',
        'wert_art', 'wert_art_hinweis', 'monotonie_warnung',
        'merkmalsauswertungen_dokumentation', 'inselvorbehalt',
        'klassen_bez', 'spanne', 'quelle_tabelle', 'liefert_hinweis', 'einzige_quelle',
        # v1093 · Schluessel aus der Ernte vom 13.08. Alle erklaeren, keiner
        # rechnet — geprueft durch Nachlesen im jeweiligen Rezept, nicht
        # durch die Endung des Namens.
        'variable_einheit', 'herleitung', 'hinweis_einheit',
        'interpolation_hinweis', 'rundung_stellen_hinweis', 'rundung_hinweis',
        'basiswert', 'gleichung', 'guete', 'wert_hinweis', 'spanne_wortlaut',
        'form_korrektur', 'korrekturprotokoll', 'berichtsjahr',
        'verfeinerungen',
        # v1094 · aus der Ernte vom 13.08. nachts. Alle erklaeren, keiner
        # rechnet — je Rezept nachgelesen, nicht an der Namensendung erkannt.
        'liefert_einheit', 'tabelle_hinweis', 'tabelle_luecken',
        'regression_dokumentation', 'kein_treffer', 'kategorien_wortlaut',
        'achse_y_bez', 'achse_k_bez', 'stufen_bez', 'normobjekt_hinweis',
        'zusammenlegung', 'gnd_hinweis', 'anwendungsbeispiel',
        'klassengrenze_hinweis', 'bestimmung',
        'eingang', 'eingang_bez', 'stuetzstellen_hinweis'}

# v1094 · Zwei Kennzahlen mehr. `vergleichsfaktor` ist § 20 ImmoWertV und
# damit eine echte Bewertungsgroesse; `bodenpreisindex` ist eine Indexreihe
# und bleibt indikativ. Sie stehen hier, weil der Umsetzer sonst jedes Rezept
# abweist, das sie fuehrt — und zwar mit einer Meldung, die wie ein
# Rezeptfehler aussieht statt wie eine fehlende Zeile im Umsetzer.
KENNZAHLEN = {'sachwertfaktor', 'liegenschaftszinssatz',
              'vergleichsfaktor', 'bodenpreisindex'}

# v1093 · Korrekturen tragen zwei verschiedene Dinge unter EINEM Namen.
# `art` ist in korrekturAnwenden() seit v1083 die FORM der Tabelle
# ('band' gegen Stufentabelle). Die Rezepte vom 13.08. schreiben dort
# `multiplikativ` — das meint die WIRKUNG. Haette ich das unveraendert
# durchgereicht, waere `art === 'band'` falsch gewesen, der Stufenzweig
# haette keine `stufen` gefunden und `null` geliefert: die Korrektur
# waere still unter 'nicht erfasst' gelaufen. Getrennt wird HIER.
WIRKUNGEN = {'additiv', 'multiplikativ'}


def normSchluessel(k):
    """Zahlenschluessel als kuerzeste eindeutige Zeichenkette.

    "50000.0" -> "50000", "11.00" -> "11", "3.5" -> "3.5". Der Auswerter
    liest ueber String(zahl); ein Schluessel mit angehaengten Nullen wird
    dort nie gefunden, und das faellt nicht auf, weil die Tabelle vollstaendig
    aussieht.
    """
    t = str(k)
    if re.fullmatch(r'-?\d+(\.\d+)?', t):
        f = float(t)
        return str(int(f)) if f == int(f) else repr(f)
    return t


# v1093-WLAND · DER LANDESSCHLUESSEL WIRD ABGELEITET, NICHT GESETZT.
#
# Bis v1090 stand im Umsetzer `'land_code': 'NW'` fest verdrahtet — aus der
# Zeit, als das Register nur Nordrhein-Westfalen fuehrte. Gemessen am
# 13.08.: 101 Datensaetze aus Sachsen-Anhalt, Thueringen, Bayern und
# Niedersachsen tragen deshalb 'NW'.
#
# Funktional ist bisher nichts kaputt, weil die Zustaendigkeit ueber den
# AGS aufgeloest wird und ein AGS bundesweit eindeutig ist. Aber die Spalte
# LUEGT, sie steht im eindeutigen Schluessel von mb.param_modell, und jede
# spaetere Frage der Art "alle Saetze in Bayern" bekaeme null Zeilen — ein
# stiller Rueckfall in Reinform.
#
# Abgeleitet wird aus den ersten beiden Stellen des AGS, denn das ist die
# amtliche Quelle. Widerspricht der im Rezept notierte `land_code` dieser
# Ableitung, wird ABGEBROCHEN statt entschieden.
LAND_AUS_AGS = {
    '01': 'SH', '02': 'HH', '03': 'NI', '04': 'HB', '05': 'NW', '06': 'HE',
    '07': 'RP', '08': 'BW', '09': 'BY', '10': 'SL', '11': 'BE', '12': 'BB',
    '13': 'MV', '14': 'SN', '15': 'ST', '16': 'TH',
}


def landCode(datei, ags, rezept_land):
    t = str(ags)[:2]
    code = LAND_AUS_AGS.get(t)
    if not code:
        meckern(datei, f"AGS '{ags}' beginnt mit '{t}' — kein Bundesland")
        return None
    if rezept_land and str(rezept_land).strip() not in (t, code):
        meckern(datei, f"land_code '{rezept_land}' im Rezept widerspricht "
                       f"dem AGS '{ags}' (das waere {t}/{code})")
        return None
    return code


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


# v1093 · Die Namen, unter denen die Rezepte vom 13.08. ihre Achsen fuehren.
# Der Auswerter bekommt seine Eingaben von gutachterausschuss.js und kennt
# dort genau diese Kuerzel. Ein Achsenname, den die Feldbruecke nicht kennt,
# fuehrt zu "Achse fehlt" bei JEDEM Objekt — und das faellt nicht auf, weil
# der Datensatz vollstaendig aussieht.
ACHSENNAMEN = {
    'vorlaeufiger_sachwert': 'sachwert',
    'vorlaeufiger_sachwert_eur': 'sachwert',
    'sachwert_eur': 'sachwert',
    'bodenrichtwert': 'brw',
    'bodenrichtwert_eur_qm': 'brw',
    'restnutzungsdauer': 'rnd',
    'restnutzungsdauer_jahre': 'rnd',
    'bruttogrundflaeche': 'bgf',
    'bruttogrundflaeche_qm': 'bgf',
    'grundstuecksflaeche': 'flaeche',
    'grundstuecksflaeche_qm': 'flaeche',
    'baujahr': 'baujahr',
    'jahr': 'jahr',                  # v1094 · Indexreihen laufen ueber die Zeit
    'wohnflaeche': 'wfl',
    'wohnflaeche_qm': 'wfl',
}


def achsenname(datei, v):
    t = str(v or '').strip().lower()
    if not t:
        return None
    if t in ACHSENNAMEN:
        return ACHSENNAMEN[t]
    if t in set(ACHSENNAMEN.values()):
        return t
    meckern(datei, f"Achsenname '{v}' ist der Feldbruecke unbekannt — "
                   f"bekannt sind {sorted(set(ACHSENNAMEN.values()))}")
    return None


def normalisiere(datei, m):
    form = m.get('form')
    # v1094 · `form: null` ist kein Fehler, sondern eine Aussage: der
    # Ausschuss fuehrt die Kennzahl, hat aber kein Modell abgeleitet
    # (Wiesbaden bei Wohnungseigentum). Der Datensatz gehoert trotzdem ins
    # Register — er sagt "gefuehrt, aber nicht abgeleitet", und das ist
    # etwas anderes als "kein Ausschuss hinterlegt".
    if form is None:
        f = dict(m.get('formel') or {})
        f['form'] = None
        return f
    if form not in ERLAUBT:
        meckern(datei, f"Modellform '{form}' kennt der Auswerter nicht")
        return None
    formel = dict(m.get('formel') or {})
    formel['form'] = form

    # ── v1093 · vier Umformungen aus der Ernte vom 13.08. ────────────────
    # Jede uebersetzt einen Schluessel, unter dem ein Rezept etwas RECHNENDES
    # fuehrt. Sie stehen hier und nicht in den Rezepten, weil Handarbeit an
    # sechzehn Stellen fuenfzehn Gelegenheiten fuer einen Zahlendreher waere.

    # (a) `variable` / `achse` nennen die Achse. Der Auswerter liest
    #     `achse_feld`.
    #     Nur fuer Formen, die ueberhaupt eine Achse haben: eine Regression
    #     traegt ihre Merkmale in den TERMEN, nicht auf einer Achse. `variable`
    #     ist dort reine Beschriftung, und ein zusaetzliches achse_feld waere
    #     ein Schluessel, den der Auswerter nie liest.
    hat_achse = 'achse_feld' in ERLAUBT.get(form, set())
    for quelle in ('variable', 'achse'):
        if hat_achse and quelle in formel and 'achse_feld' not in formel:
            n = achsenname(datei, formel[quelle])
            if n is None:
                return None
            formel['achse_feld'] = n
            formel['achse_bez'] = formel.get('achse_bez') or str(formel[quelle])
        formel.pop(quelle, None)

    # (b) `stuetzstellen: [[x, y], ...]` ist dieselbe Tabelle wie
    #     `stufen: {x: y}` — nur als Paarliste geschrieben. Der Auswerter
    #     liest die Abbildung.
    if 'stuetzstellen' in formel and 'stufen' not in formel:
        st = formel.pop('stuetzstellen')
        if not (isinstance(st, list) and all(
                isinstance(r, (list, tuple)) and len(r) == 2 for r in st)):
            meckern(datei, 'stuetzstellen ist keine Liste aus [x, y]-Paaren')
            return None
        formel['stufen'] = {normSchluessel(x): y for x, y in st}
        if len(formel['stufen']) != len(st):
            meckern(datei, f'stuetzstellen: {len(st)} Paare ergeben nur '
                           f"{len(formel['stufen'])} Schluessel — doppelte "
                           f'x-Werte')
            return None
    formel.pop('stuetzstellen', None)

    # (c) In den Termen einer Regression heisst das Merkmal `feld`, nicht
    #     `variable`. Ein Term mit unbekanntem Feld rechnet mit null.
    if isinstance(formel.get('terme'), list):
        neu = []
        for t in formel['terme']:
            t = dict(t)
            if 'variable' in t and 'feld' not in t:
                n = achsenname(datei, t.pop('variable'))
                if n is None:
                    return None
                t['feld'] = n
            t.pop('variable', None)
            t.pop('variable_einheit', None)
            neu.append(t)
        formel['terme'] = neu

    # (e) v1094 · DIE ACHSENOBJEKTE DER ERNTE VOM 13.08. NACHT.
    #
    # Drei Laeufe haben ihre Achsen als OBJEKT geschrieben statt als Liste:
    # `achse_x: {name, art, werte}` bzw. `{name, art, klassen}`, dazu die
    # Tabelle unter `tabelle` statt `zellen`. Beides ist lesbar, nur eines
    # rechnet.
    #
    # Uebersetzt wird hier und an genau einer Stelle. BEWIESEN wird die
    # Uebersetzung nicht hier, sondern in der Pruefstrecke: Wiesbaden und
    # die Uckermark drucken durchgerechnete Anwendungsbeispiele ab, und die
    # laufen durch den ECHTEN Auswerter gegen den umgesetzten Datensatz.
    # Waere die Uebersetzung falsch, kaeme das Beispiel nicht heraus.
    for quelle, ziel_feld, ziel_bez in (('x_achse', 'achse_x_feld', 'achse_x_bez'),
                                        ('achse_x', 'achse_x_feld', 'achse_x_bez')):
        a = formel.get(quelle)
        if isinstance(a, dict):
            n = achsenname(datei, a.get('name'))
            if n is None:
                return None
            formel[ziel_feld] = formel.get(ziel_feld) or n
            formel[ziel_bez] = formel.get(ziel_bez) or str(a.get('name'))
            if isinstance(a.get('werte'), list):
                formel['achse_x'] = a['werte']
            else:
                formel.pop('achse_x', None)
            formel.pop(quelle if quelle != 'achse_x' else '_', None)

    for quelle in ('y_achse', 'achse_y'):
        a = formel.get(quelle)
        if not isinstance(a, dict):
            continue
        if isinstance(a.get('kategorien'), list):
            formel['kategorien'] = a['kategorien']
            formel['achse_k_bez'] = str(a.get('name'))
            # Das Merkmal, aus dem die Kategorie folgt. Es wird NICHT durch
            # die Feldbruecke geschickt: eine kategoriale Achse ist kein
            # numerisches Eingabefeld, und eine Geschaeftslage steht in
            # keinem Gemeindeschluessel.
            #
            # Der erste Entwurf rief hier achsenname() und loeschte den
            # Fehler danach wieder aus der Liste. Das hat nicht nur den
            # eigenen Fehler unterdrueckt, sondern JEDEN gleichartigen —
            # auch den einer anderen Datei, die vorher gelaufen war.
            # Kassels Jahresachse verschwand dadurch spurlos: der Umsetzer
            # meldete keinen Fehler und schrieb den Datensatz trotzdem
            # nicht. Ein stiller Rueckfall, gebaut vom Waechter selbst.
            formel['achse_k_feld'] = str(a.get('name'))
        if isinstance(a.get('klassen'), list):
            # v1094 · Klassen auf einer Achse sind KATEGORIEN mit
            # Zahlengrenzen. Der Auswerter kennt keine Form "x stetig x y in
            # Zahlklassen"; er kennt `matrix_kategorial` mit einer
            # Kategorienachse — und seit v1094-WKAB kann er die Kategorie aus
            # einem Zahlenband ableiten. Damit ist es dieselbe Form, nicht
            # eine neue. Uebersetzt wird hier, bewiesen in der Pruefstrecke
            # gegen das Anwendungsbeispiel des Berichts.
            n = achsenname(datei, a.get('name'))
            if n is None:
                return None
            formel['form'] = 'matrix_kategorial'
            formel['kategorien'] = [k.get('bez') for k in a['klassen']]
            formel['kategorie_baender'] = [
                {'von': k.get('von'), 'bis': k.get('bis'),
                 'kategorie': k.get('bez')} for k in a['klassen']]
            formel['zuordnung_feld'] = n
            formel['achse_k_bez'] = str(a.get('name'))
            formel['achse_k_feld'] = str(a.get('name'))
        formel.pop(quelle, None)

    # (f) `tabelle` ist `zellen` unter anderem Namen. Zwei Bauformen:
    #     {kategorie: [[x, y], ...]}  -> x-Achse aus den Paaren ableiten
    #     {schluessel: [w1, w2, ...]} -> unveraendert uebernehmen
    if 'tabelle' in formel and 'zellen' not in formel:
        t = formel.pop('tabelle')
        if isinstance(t, list) and all(
                isinstance(r, (list, tuple)) and len(r) == 2 for r in t):
            # Eine reine Paarliste ohne Kategorien ist eine Stufentabelle.
            formel['stufen'] = {normSchluessel(x): y for x, y in t}
            t = None
        elif not isinstance(t, dict):
            meckern(datei, 'tabelle ist weder Abbildung noch Paarliste')
            return None
        paarform = (t is not None) and all(
            isinstance(r, list) and r and isinstance(r[0], (list, tuple))
            for r in t.values())
        if t is None:
            pass                      # schon als Stufentabelle uebernommen
        elif paarform:
            kat = list(t.keys())
            xs = sorted({float(x) for r in t.values() for x, _ in r})
            zellen = {}
            for x in xs:
                zeile = []
                for k in kat:
                    treffer = [y for xx, y in t[k] if float(xx) == x]
                    # Eine leere Zelle ist kein Wert. Kein Nachbar, kein
                    # Mittelwert — die Kategorien haben verschiedene
                    # Stuetzstellenbereiche, und das ist Dokumentverhalten.
                    zeile.append(treffer[0] if treffer else None)
                zellen[normSchluessel(x)] = zeile
            formel['zellen'] = zellen
            formel['achse_x'] = xs
            formel['kategorien'] = formel.get('kategorien') or kat
            formel['zellen_schluessel'] = ('x-Stuetzstelle -> Werte in '
                                           'Reihenfolge kategorien (aus '
                                           'Paarlisten je Kategorie gebaut)')
        else:
            formel['zellen'] = {normSchluessel(k): v for k, v in t.items()}

    # (g) `achse` mit `stufen` als Liste von {kategorie, wert} — die Bauform,
    #     in die zwei kollidierende Modelle zusammengelegt wurden.
    if isinstance(formel.get('achse'), dict) and isinstance(formel.get('stufen'), list):
        a = formel.pop('achse')
        formel['achse_k_bez'] = str(a.get('name'))
        formel['achse_k_feld'] = formel.get('achse_k_feld') or str(a.get('name'))
        formel['stufen'] = {str(r.get('kategorie')): r.get('wert')
                            for r in formel['stufen']}

    # (d) log_1d: der Achsenname steht unter `eingang`, die EINHEIT unter
    #     `eingang_bez` — und die ist bei dieser Form der ganze Fall
    #     (Prozentzahl gegen Dezimalbruch). Beide bleiben stehen.
    if form == 'log_1d':
        if 'achse_feld' not in formel and formel.get('eingang'):
            formel['achse_feld'] = str(formel['eingang'])
        if 'gueltig' not in formel:
            g = (m.get('geltungsbereich') or {})
            for k, v in g.items():
                if isinstance(v, list) and len(v) == 2 and k != 'spannen':
                    formel['gueltig'] = v
                    break

    for alt, neu in UMBENENNEN.get(form, {}).items():
        if alt in formel:
            if neu in formel and formel[neu] != formel[alt]:
                meckern(datei, f'{alt} und {neu} widersprechen sich')
                return None
            formel[neu] = formel.pop(alt)

    spannen_uebernehmen(m, formel)

    # v1094 · Die Uebersetzung oben kann die FORM aendern (Wiesbadens
    # Klassenachse macht aus matrix_band ein matrix_kategorial). Die weisse
    # Liste muss dann gegen die NEUE Form pruefen — sonst meldet sie die
    # gerade erst erzeugten Schluessel als fremd.
    form = formel.get('form') or form
    if form not in ERLAUBT:
        meckern(datei, f"Modellform '{form}' kennt der Auswerter nicht")
        return None
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
    for feld in ('zellen', 'stufen'):
        if feld in formel and isinstance(formel[feld], dict):
            formel[feld] = {normSchluessel(k): v for k, v in formel[feld].items()}

    return formel


def korrekturen_normalisieren(datei, zweig, korr):
    """v1093 · `art` trennen: FORM der Tabelle gegen WIRKUNG der Korrektur.

    Ausgang ist eine Liste, deren Eintraege genau eines von beidem unter
    `art` tragen. Was hier nicht sauber zugeordnet werden kann, bricht ab —
    eine Korrektur, die still als 'nicht erfasst' durchlaeuft, ist genau der
    Fehler, den diese Uebersetzung verhindern soll.
    """
    aus = []
    for k in (korr or []):
        k = dict(k)
        a = str(k.get('art') or '').strip().lower()
        if a in WIRKUNGEN:
            k['wirkung'] = a
            k.pop('art', None)          # 'band' bleibt frei fuer die Tabellenform
        elif a and a != 'band':
            meckern(datei, f"Zweig '{zweig}': Korrektur '{k.get('bez')}' traegt "
                           f"art='{a}' — weder Tabellenform ('band') noch "
                           f"Wirkung ({sorted(WIRKUNGEN)})")
            return None

        # Ein Faktor ohne Merkmalsfeld ist nicht anwendbar. Kiel fuehrt seine
        # multiplikativen Zu-/Abschlaege als qualitative Merkmale
        # ("guter Gebaeudezustand") ohne Eingabefeld — der Auswerter kann sie
        # nicht zuordnen. Sie GEHOEREN in den Bericht, aber nicht in die
        # Rechnung, und das muss ein Mensch entscheiden.
        if k.get('wirkung') == 'multiplikativ':
            if not k.get('feld'):
                meckern(datei, f"Zweig '{zweig}': multiplikative Korrektur "
                               f"'{k.get('bez')}' hat kein Merkmalsfeld. Sie ist "
                               f"nicht anwendbar — auszuweisen, nicht zu rechnen.")
                return None
            if 'faktor' in k and 'stufen' not in k and 'baender' not in k:
                meckern(datei, f"Zweig '{zweig}': Korrektur '{k.get('bez')}' "
                               f"nennt einen festen Faktor ohne Merkmalstabelle. "
                               f"Wann er gilt, sagt das Rezept nicht.")
                return None
        aus.append(k)
    return aus


def zaehle_zellen(formel):
    z = formel.get('zellen')
    if not isinstance(z, dict):
        return None
    return sum(len(r) for r in z.values() if isinstance(r, list))


def bauen():
    saetze = []
    zurueck = []
    dateien = sorted(glob.glob(os.path.join(REZEPTE, '*.json')))
    if not dateien:
        print(f'FEHLER: keine Rezepte unter {REZEPTE}', file=sys.stderr)
        return 1

    for p in dateien:
        datei = os.path.basename(p)
        # v1093 · Dateien mit fuehrendem Unterstrich sind BAUSTEINE
        # (Landesmodellvermerke, Notizen), keine Rezepte. Sie tragen keinen
        # Zustaendigkeitsschluessel und sollen auch keinen bekommen.
        if datei.startswith('_'):
            continue
        try:
            d = json.load(open(p, encoding='utf-8'))
        except Exception as e:
            meckern(datei, f'nicht lesbar: {e}')
            continue

        kennzahl = d.get('kennzahl') or 'sachwertfaktor'
        if kennzahl not in KENNZAHLEN:
            meckern(datei, f"kennzahl '{kennzahl}' ist nicht vorgesehen")
            continue

        # v1093 · DAS FREIGABETOR.
        #
        # Ein Rezept mit `freigabe_saatlauf: false` ist fertig gelesen und
        # geprueft — aber es fehlt etwas, das ueber die Zahlen hinausgeht:
        # meist der Modellvermerk nach § 10 ImmoWertV, manchmal die
        # Nutzungsrechtseinraeumung. Beides ist kein Rechenfehler und wird
        # deshalb nicht gemeckert; der Satz kommt nur nicht ins Register.
        #
        # "Kostenloser Download" ist eine Preisaussage, keine Lizenz.
        if d.get('freigabe_saatlauf') is False:
            zurueck.append((datei, d.get('freigabe_grund')
                            or d.get('freigabe_saatlauf_grund')
                            or 'nicht freigegeben (Grund im Rezept)'))
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

            # EINE REGRESSION TRAEGT IHRE WIRKUNG IN DEN TERMEN.
            #
            # Wer ihr zusaetzlich additive Korrekturen mitgibt, rechnet
            # dieselbe Wirkung zweimal. Bei Halle waere aus dem Faktor 1,10
            # ein 2,02 geworden — plausibel aussehend und falsch. Die
            # Umrechnungskoeffizienten, die viele Berichte neben der
            # Gleichung abdrucken, BESCHREIBEN sie; sie ergaenzen sie nicht.
            #
            # Kein stiller Rueckfall: hier wird abgebrochen, damit ein
            # Mensch entscheidet, wohin die Tabelle gehoert.
            if formel.get('form') == 'regression_additiv' and m.get('korrekturen'):
                meckern(datei, f"Zweig '{m.get('zweig')}': regression_additiv "
                               f"mit {len(m['korrekturen'])} additiven Korrekturen. "
                               f"Die Terme tragen die Wirkung bereits — das waere "
                               f"eine Doppelzaehlung. Gehoeren die Tabellen in den "
                               f"Geltungsbereich?")
                continue

            # EINE FEHLENDE STREUUNG MACHT NICHT DEN WERT UNBRAUCHBAR,
            # SONDERN SEINE STUFE UNBELEGBAR.
            #
            # `vollstaendig: false` ist fuer einen Datensatz gedacht, dessen
            # MODELL unvollstaendig ist — Berlins Altbezirks-Korrektur etwa
            # ist laut Anwendungshinweis Pflichtbestandteil der Rechnung.
            # Ohne sie darf nicht gerechnet werden.
            #
            # Eine nicht abgedruckte Standardabweichung ist etwas anderes:
            # der Zinssatz ist amtlich veroeffentlicht und gilt. Nur die
            # Stufenregel (§ Streuung) kann ihn nicht auf A pruefen. Die
            # ehrliche Antwort ist deshalb Stufe B mit Begruendung — nicht
            # "gar kein Wert". Beides waere eine Aussage, die die Quelle
            # nicht macht: A ueberzeichnet, gar nichts unterzeichnet.
            grund_txt = str(m.get('unvollstaendig_grund')
                            or d.get('unvollstaendig_grund') or '')
            nur_streuung = ('STANDARDABWEICHUNG' in grund_txt.upper()
                            and 'streuung' not in grund_txt.lower()[:20])
            # `vollstaendig` steht oft am DOKUMENT, nicht am Modell — der
            # erste Anlauf prueft nur das Modell und griff deshalb nie.
            voll_eff = (m.get('vollstaendig') if m.get('vollstaendig') is not None
                        else d.get('vollstaendig', True))
            if voll_eff is False and 'ABWEICHUNG' in grund_txt.upper():
                m['vollstaendig'] = True
                m['stufe'] = 'B'
                m['stufe_grund'] = ('Streuung nicht ausgewiesen — die '
                                    'Belastbarkeit lässt sich nicht auf Stufe A '
                                    'prüfen. Der Wert selbst ist amtlich '
                                    'veröffentlicht.')
                m['streuung_fehlt'] = True

            korrekturen = korrekturen_normalisieren(
                datei, m.get('zweig'), m.get('korrekturen'))
            if korrekturen is None:
                continue

            beleg = m.get('beleg')
            if not beleg:
                # CHECK (jsonb_array_length(belege) > 0) — kein Datensatz
                # ohne Beleg. Die Datenbank wuerde es ohnehin ablehnen;
                # hier bricht es mit einer lesbaren Begruendung ab.
                meckern(datei, f"Zweig '{m.get('zweig')}' hat keinen Beleg")
                continue

            # Ein Modell darf seinen EIGENEN Zustaendigkeitsschluessel
            # tragen. Otterndorf fuehrt vier Sachwertfaktoren fuer vier
            # Landkreise unter demselben Zweig — ohne diese Zeile schriebe
            # der Umsetzer jedes Modell fuer jeden Kreis und liefe in den
            # eindeutigen Schluessel der Tabelle.
            for ags in (m.get('ags') or ags_liste):
                lc = landCode(datei, ags, d.get('land_code'))
                if lc is None:
                    continue
                saetze.append({
                    'land_code': lc,
                    'ags': str(ags),
                    'ebene': ebene,
                    'gebiet_name': d.get('gebiet_name') or d.get('gaa_name'),
                    'gaa_name': d.get('gaa_name'),
                    'kennzahl': kennzahl,
                    'zweig': m.get('zweig'),
                    'formel': formel,
                    'korrekturen': korrekturen,
                    'modellansaetze': m.get('modellansaetze') or d.get('modellansaetze') or {},
                    'geltungsbereich': m.get('geltungsbereich') or {},
                    'belege': [beleg],
                    'vollstaendig': (m.get('vollstaendig')
                                     if m.get('vollstaendig') is not None
                                     else d.get('vollstaendig', True)),
                    'unvollstaendig_grund': (m.get('unvollstaendig_grund')
                                             or d.get('unvollstaendig_grund')),
                    # `objektart` ist ein KUERZEL, keine Beschriftung.
                    # Die Rezepte schreiben dort teils deutschen Klartext
                    # ("Ein-/Zweifamilienhaus, Doppelhaushaelfte, ..."), und
                    # der Aufloeser vergleicht gegen Kuerzel — er faende
                    # nichts. Normalisiert wird hier, einmal: sieht es wie
                    # ein Kuerzel aus, wird es uebernommen; sonst gilt der
                    # Zweig, und der Klartext bleibt als Beschriftung.
                    'objektart': (m.get('objektart')
                                  if re.fullmatch(r'[a-z0-9_]+',
                                                  str(m.get('objektart') or ''))
                                  else m.get('zweig')),
                    'objektart_bez': (m.get('objektart')
                                      if not re.fullmatch(r'[a-z0-9_]+',
                                                          str(m.get('objektart') or ''))
                                      else None),
                    'baujahr_von': m.get('baujahr_von'),
                    'baujahr_bis': m.get('baujahr_bis'),
                    'auswerter_vorhanden': m.get('auswerter_vorhanden', True),
                    'stufe': m.get('stufe') or 'A',
                    'stufe_grund': m.get('stufe_grund'),
                    'fallzahl': m.get('fallzahl'),
                    'streuung': m.get('streuung'),
                    'stichtag': d.get('stichtag'),
                    # v1093 · DAS BERICHTSJAHR DES MODELLS SCHLAEGT DAS DES
                    # DOKUMENTS. Das Berichtsjahr steht im eindeutigen
                    # Schluessel von mb.param_modell — genau dafuer, damit
                    # zwei Jahrgaenge desselben Ausschusses konfliktfrei
                    # nebeneinander stehen (Iserlohn und Maerkischer Kreis
                    # fuehren sechs). Ein Heft druckt seinen Vorjahrgang
                    # regelmaessig mit ab; wer dann das Jahr des DOKUMENTS
                    # nimmt, laesst zwei Saetze auf denselben Schluessel
                    # fallen und ueberschreibt einen davon still.
                    'berichtsjahr': (m.get('berichtsjahr')
                                     if m.get('berichtsjahr') is not None
                                     else (m.get('formel') or {}).get('berichtsjahr')
                                     if isinstance(m.get('formel'), dict)
                                     and m['formel'].get('berichtsjahr') is not None
                                     else d.get('berichtsjahr')),
                    'modellversion': d.get('modellversion') or f"GMB {d.get('berichtsjahr')}",
                    'quelle_url': d.get('quelle_url'),
                    'quelle_parser': d.get('quelle_parser') or 'v1093-WREZ',
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

    if zurueck:
        print(f'\n{len(zurueck)} Rezepte ZURUECKGEHALTEN (kein Fehler):')
        for datei, grund in zurueck:
            print(f'  {datei}: {str(grund)[:110]}')
        print()

    gebiete = len({s['ags'] for s in saetze})
    aus = len({s['gaa_name'] for s in saetze})
    zellen = sum(zaehle_zellen(s['formel']) or 0 for s in saetze)
    print(f'{len(saetze)} Registerdatensaetze · {aus} Ausschuesse · '
          f'{gebiete} Zustaendigkeitsschluessel · {zellen} Tabellenzellen')
    for e in sorted({s['ebene'] for s in saetze}):
        print(f'  ebene={e}: {sum(1 for s in saetze if s["ebene"] == e)}')
    for lc in sorted({s['land_code'] for s in saetze}):
        print(f'  land={lc}: {sum(1 for s in saetze if s["land_code"] == lc)}')
    print(f'-> {ZIEL}')
    return 0


if __name__ == '__main__':
    sys.exit(bauen())
