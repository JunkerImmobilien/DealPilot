// umrechnung_flaeche.js  (v2279)
//
// Umrechnungskoeffizienten fuer die GRUNDSTUECKSGROESSE aus dem Register
// (Kennzahl `umrechnungskoeffizient_flaeche`, § 19 ImmoWertV) — dieselbe
// Ablage wie Liegenschaftszins und Sachwertfaktor: JSON-Satzdatei unter
// lib/register/, Herkunft je Satz (Link, Jahrgang, Stichtag, Seite, Lizenz),
// zur Laufzeit ueber ausschuss_register.finde() mit der Kaskade 8 -> 5 -> 3 -> 2
// Stellen der AGS. Ein amtlicher LANDESWERT greift damit von selbst, wenn
// einer als Satz mit zweistelliger AGS hinterlegt ist; einen erfundenen
// Auffangwert gibt es nicht.
//
// WARUM (Marcel 16.10.2026, „das kann doch gar nicht sein, dass wir so einen
// grossen Bodenwert in Bielefeld haben"): Bericht 216, Westerfeldstr. 140,
// rechnete 1.570 m² × 450 €/m² = 706.500 € — die ganze Flaeche zum vollen
// Richtwert, obwohl das Richtwertgrundstueck der Zone 600 m² hat. Hinterlegt
// waren Koeffizienten nur fuer Minden-Luebbecke (umrechnung_nrw.js, fest im
// Code). Fuer jeden anderen Ort stand nur ein Hinweis da, und gerechnet
// wurde voll.
//
// DIE REGEL DES AUSSCHUSSES GILT, NICHT EINE EIGENE: Tabelle, Zwischenwerte,
// was oberhalb und unterhalb der Tabelle gilt, und fuer welche Objektarten
// sie ueberhaupt gilt — alles steht im Satz (`formel`, `geltungsbereich`).
// Liegt das Objekt ausserhalb (Bielefeld: Geschosswohnungsbau), wird NICHT
// umgerechnet, sondern der Weg zum Ausschuss genannt.

import { finde } from './ausschuss_register.js';
import { readFileSync } from 'node:fs';   /* v2288 */

export const KENNZAHL = 'umrechnungskoeffizient_flaeche';

/** Objektart des Berichts -> Schluessel des Geltungsbereichs. */
export function artSchluessel(objektart) {
  const t = String(objektart || '').toLowerCase().trim();
  if (/etw|wohnung|whg|apartment|appartement/.test(t)) return 'etw';
  if (/mfh|mehrfamil/.test(t)) return 'mfh';
  if (/zfh|zweifamil/.test(t)) return 'zfh';
  if (/dhh|doppel/.test(t)) return 'dhh';
  if (/\brh\b|reihen/.test(t)) return 'rh';
  if (/efh|einfamil|villa|bungalow/.test(t)) return 'efh';
  if (/gewerbe|buero|büro|laden|hotel|garage/.test(t)) return 'gewerbe';
  return t || null;
}

const r4 = (x) => Math.round(x * 10000) / 10000;

/** Koeffizient fuer EINE Flaeche nach der Regel des Satzes.
 *  -> { k, weg } oder { k: null, grund } */
/* v2281 · DIE FORMEN, IN DENEN AUSSCHUESSE SIE VEROEFFENTLICHEN (gemessen an der
   Recherche 16.10.2026, scratchpad uk-recherche.md):
     flaeche_tabelle   Tabelle je Normgroesse (Bielefeld), Schluessel "*" = eine
                       Tabelle fuer jede Bezugsgroesse (Quotient Objekt/Norm);
                       zwischenwerte 'linear' oder 'stufen' (naechst kleinere Stufe)
     flaeche_funktion  g(f) als Formel, UK = g(Objekt) / g(Norm):
                         potenz  g = (f / basis_qm) ^ exponent        (Hamburg)
                         log     g = a + b · ln(f)                     (Koeln)
                         linear  g = a + b · f                         (Oberberg. Kreis)
                       gueltig nur in spanne_qm [von, bis]
     flaeche_eins      amtlich „kein Einfluss" / UK = 1 (Sachsen-Anhalt landesweit,
                       Essen, Hoexter, Steinfurt) - nur innerhalb spanne_qm, wenn genannt
   Alles andere: kein Koeffizient (form_unbekannt) - nie geraten. */
function _funktionG(f, x) {
  const t = f.typ;
  if (t === 'potenz' && Number(f.basis_qm) > 0) return Math.pow(x / Number(f.basis_qm), Number(f.exponent));
  if (t === 'log') return Number(f.a) + Number(f.b) * Math.log(x);
  if (t === 'linear') return Number(f.a) + Number(f.b) * x;
  return null;
}

export function koeffizientFuer(satz, flaecheQm, normgroesseQm) {
  const f = (satz && satz.formel) || {};
  let fl = Number(flaecheQm); const norm = Number(normgroesseQm);
  if (!(fl > 0)) return { k: null, grund: 'flaeche_fehlt' };
  const sp = Array.isArray(f.spanne_qm) ? f.spanne_qm : null;
  const inSpanne = (x) => !sp || ((sp[0] == null || x >= sp[0]) && (sp[1] == null || x <= sp[1]));

  if (f.form === 'flaeche_eins') {
    if (!inSpanne(fl) || !inSpanne(norm)) return { k: null, grund: 'ausserhalb_spanne', wortlaut: f.wortlaut || null };
    return { k: 1, weg: 'amtlich kein Einfluss der Grundstücksgröße (Koeffizient 1)' };
  }
  if (f.form === 'flaeche_funktion') {
    if (!inSpanne(fl) || !inSpanne(norm)) return { k: null, grund: 'ausserhalb_spanne', wortlaut: f.wortlaut || null };
    const gF = _funktionG(f, fl), gN = _funktionG(f, norm);
    if (!(gF > 0) || !(gN > 0)) return { k: null, grund: 'funktion_unbekannt' };
    return { k: r4(gF / gN), weg: 'Formel des Ausschusses' + (f.formel_wortlaut ? ' (' + f.formel_wortlaut + ')' : '')
      + ', ' + fl + ' m² gegen ' + norm + ' m²' };
  }
  if (f.form !== 'flaeche_tabelle') return { k: null, grund: 'form_unbekannt' };
  /* v2289b · Rundungsregel des Ausschusses vor dem Ablesen (Kiel: „auf volle 25 m2
     runden"). Ohne sie lieferte eine Tabelle mit Stufen ohne Zwischenwerte fuer
     670 m2 nichts, fuer 675 m2 einen Wert. */
  const _rund = Number(f.rundung_flaeche_qm);
  const _fl0 = fl;
  if (_rund > 0) { fl = Math.round(fl / _rund) * _rund; }
  const tab = (f.tabellen || {})[String(norm)] || (f.tabellen || {})['*'];
  if (!tab) return { k: null, grund: 'normgroesse_nicht_in_tabelle' };
  const xs = tab.flaeche_qm, ys = tab.koeffizient;
  if (!Array.isArray(xs) || xs.length !== ys.length || xs.length < 2) return { k: null, grund: 'tabelle_defekt' };
  const min = xs[0], max = xs[xs.length - 1];

  if (fl < min) {
    return { k: null, grund: 'unter_tabelle',
      wortlaut: (f.unterhalb && f.unterhalb.wortlaut) || null };
  }
  if (fl <= max) {
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] === fl) return { k: ys[i], weg: 'Tabellenwert ' + fl + ' m²' };
      if (xs[i] > fl) {
        const x0 = xs[i - 1], x1 = xs[i], y0 = ys[i - 1], y1 = ys[i];
        if (f.zwischenwerte === 'stufen') return { k: y0, weg: 'Stufe ab ' + x0 + ' m²' };
        const k = r4(y0 + (y1 - y0) * (fl - x0) / (x1 - x0));
        if (f.zwischenwerte !== 'linear') return { k: null, grund: 'keine_zwischenwerte' };
        return { k, weg: 'linear zwischen ' + x0 + ' m² (' + y0 + ') und ' + x1 + ' m² (' + y1 + ')' };
      }
    }
  }
  const o = f.oberhalb || {};
  if (o.regel === 'normgroesse_plus_rest' && Number(o.rest_faktor) >= 0) {
    const k = r4((norm + (fl - norm) * Number(o.rest_faktor)) / fl);
    return { k, weg: 'oberhalb der Tabelle: (' + norm + ' + (' + fl + ' − ' + norm + ') × '
      + String(o.rest_faktor).replace('.', ',') + ') / ' + fl };
  }
  return { k: null, grund: 'ueber_tabelle',
    wortlaut: o.wortlaut || null };
}

/** Das Anwendungsbeispiel des Dokuments nachrechnen (Pruefmassstab). */
export function pruefeBeispiel(satz) {
  const b = satz && satz.formel && satz.formel.pruefbeispiel;
  if (!b) return { ok: null, grund: 'kein_beispiel' };
  /* v2281b · DERSELBE WEG WIE groessenanpassung(): Quotient UK(Objekt) / UK(Bezugsgroesse).
     Bei einer Tabelle "*" (eine Tabelle fuer jede Bezugsgroesse: HE, TH, Bremen) ist
     UK(Bezugsgroesse) nicht 1 - ohne den Quotienten traf kein Anwendungsbeispiel, das
     zwischen zwei Groessen umrechnet. Fuer Tabellen je Normgroesse und Formeln ist der
     Nenner 1, dort aendert sich nichts.
     Viele Dokumente nennen nur den angepassten Bodenwert JE m² mit eigener Rundung
     (HE „118 €/m²“, Bremen „rd. 159,-“, HH „rund 840 €/m²“): dafuer bodenwert_eur_qm
     und rundung_eur_qm; die Einzelkoeffizienten des Beispiels (koeffizient_objekt,
     koeffizient_norm) werden gegen die Tabelle selbst gehalten. */
  const rF = koeffizientFuer(satz, b.flaeche_qm, b.normgroesse_qm);
  const rN = koeffizientFuer(satz, b.normgroesse_qm, b.normgroesse_qm);
  const k = rF.k != null && rN.k > 0 ? r4(rF.k / rN.k) : null;
  const nah = (ist, soll, tol) => soll == null || (ist != null && Math.abs(ist - soll) <= tol);
  const bw = k != null ? Math.round(b.flaeche_qm * b.brw_eur_qm * k) : null;
  const st = Number(b.rundung_eur_qm) > 0 ? Number(b.rundung_eur_qm) : 0.01;
  const bwQm = k != null ? Math.round((b.brw_eur_qm * k) / st) * st : null;
  const hatSoll = b.bodenwert_eur != null || b.bodenwert_eur_qm != null;
  return { ok: k != null && hatSoll && nah(k, b.koeffizient, 0.005)
             && nah(rF.k, b.koeffizient_objekt, 0.0005) && nah(rN.k, b.koeffizient_norm, 0.0005)
             && nah(bw, b.bodenwert_eur, 1) && nah(bwQm, b.bodenwert_eur_qm, 1e-6),
           k, soll_k: b.koeffizient, bodenwert: bw, soll_bodenwert: b.bodenwert_eur,
           bodenwert_qm: bwQm, soll_bodenwert_qm: b.bodenwert_eur_qm };
}

/** Satz fuer den Ort. Mehrere Saetze (Zweige) -> der, dessen Geltung die
 *  Objektart nennt; sonst der erste. */
/* v2284 · TABELLEN-ID DER BODENRICHTWERTZONE (BORIS-NI listeUmrechnungstabelle).
   In NI haengt die Tabelle an der ZONE: in Goettingen fuehren W-Zonen 0590110,
   M-Zonen 0590111, Aussenbereichszonen 0592024 ("nicht untersucht"). Ist die
   ID der Zone bekannt (tabellenIds, String oder Liste), gilt:
     - fuehren Saetze geltungsbereich.boris_tabellen, nur der Satz, der eine
       dieser IDs enthaelt;
     - trifft keiner, werden Saetze MIT boris_tabellen nicht genommen (die Zone
       fuehrt eine andere oder keine Flaechentabelle) - es bleiben die ohne
       (z. B. die Kreis-Sperre mit dem Weg).
   Saetze mit geltungsbereich.nur_ueber_tabellen_id greifen NIE ueber die
   AGS allein - ohne ID bleibt alles wie vor v2284. */
export function satzFuer(ags, objektart, alle, tabellenIds) {
  /* v2288b · Platzhalter-Zeilen aus param_modell ({form: konstante, wert: null},
     entschaerfte Sperren) sind keine Saetze - die Sperre selbst kommt aus der Datei. */
  const t = (alle || finde(KENNZAHL, ags)).filter((s) => !(s && s.formel && s.formel.form === 'konstante'
    && s.formel.wert == null && s.vollstaendig !== false && !s.warum_kein_wert));
  if (!t.length) return null;
  const art = artSchluessel(objektart);
  const ids = (Array.isArray(tabellenIds) ? tabellenIds : [tabellenIds]).map((x) => String(x || '').trim()).filter(Boolean);
  /* Eine LISTE heisst: die Zone ist bekannt - auch leer (Zone ohne jede Tabelle). */
  const bekannt = Array.isArray(tabellenIds) || ids.length > 0;
  const tabs = (s) => ((s.geltungsbereich || {}).boris_tabellen || []);
  let kand;
  if (bekannt && t.some((s) => tabs(s).length)) {
    const treffer = t.filter((s) => tabs(s).some((x) => ids.indexOf(x) >= 0));
    kand = treffer.length ? treffer : t.filter((s) => !tabs(s).length);
  } else {
    kand = t.filter((s) => !(s.geltungsbereich || {}).nur_ueber_tabellen_id);
  }
  if (!kand.length) return null;
  return kand.find((s) => ((s.geltungsbereich || {}).objektarten || []).indexOf(art) >= 0) || kand[0];
}

/**
 * Groessenanpassung des Bodenwerts — dieselbe Rueckgabeform wie
 * umrechnung_nrw.flaechenaufteilung(), damit ErtragswertService.bodenwert()
 * sie ohne Aenderung liest.
 */
export function groessenanpassung({ ags, objektart, flaeche_qm, bezugsgroesse_qm, brw_eur_qm, saetze, ortsteile, tabellen_id,
                                    mfh_uebertragen }) {
  const nichts = (grund, hinweis, extra) => ({ verfuegbar: false, grund, hinweis, ...(extra || {}) });
  const satz = satzFuer(ags, objektart, saetze, tabellen_id);   /* v2284: Tabellen-ID der Zone */
  if (!satz) return nichts('kein_satz');
  const fl = Number(flaeche_qm), bez = Number(bezugsgroesse_qm), brw = Number(brw_eur_qm);
  const g = satz.geltungsbereich || {};
  const herkunft = {
    quelle: satz.gaa_name,
    quelle_text: ((satz.belege_meta || {}).dokument || 'Umrechnungskoeffizienten') + ', ' + satz.gaa_name
      + (satz.berichtsjahr ? ' (' + satz.berichtsjahr + ')' : ''),
    quelle_url: satz.quelle_url || null, quellenvermerk: satz.quellenvermerk || null,
    lizenz: satz.lizenz || null, stufe: satz.stufe || null, stichtag: satz.stichtag || null,
    berichtsjahr: satz.berichtsjahr || null,
    kennzahl: KENNZAHL, ebene: satz.ebene || null,
    boris_tabelle: ((satz.geltungsbereich || {}).boris_tabellen || []).find((x) =>
      [].concat(tabellen_id || []).indexOf(x) >= 0) || null,   /* v2284 */
  };
  /* v2281 · Sperre (vollstaendig === false): der Ausschuss fuehrt keinen
     Koeffizienten oder er ist nicht verwendbar (Lizenz, kostenpflichtig, nur
     Tiefe). Keine Zahl - der Weg zur Quelle, wie bei Zins und Faktor. */
  if (satz.vollstaendig === false || satz.warum_kein_wert) {
    return nichts('sperre', (fl > 0 && Number(bezugsgroesse_qm) > 0 && fl !== Number(bezugsgroesse_qm)
      ? 'Der Bodenwert ist nicht an die Grundstücksgröße angepasst (' + fl + ' m² gegen '
        + Number(bezugsgroesse_qm) + ' m² Bezugsgröße). ' : '')
      + (satz.warum_kein_wert ? String(satz.warum_kein_wert) + ' ' : '')
      + (satz.quelle_url ? 'Quelle: ' + satz.gaa_name + ', ' + satz.quelle_url + '.' : ''),
      { ...herkunft, sperre_grund: satz.sperre_grund || null,
        nicht_angepasst: fl > 0 && Number(bezugsgroesse_qm) > 0 && fl !== Number(bezugsgroesse_qm) });
  }
  if (!(fl > 0)) return nichts('flaeche_fehlt', null, herkunft);
  if (!(brw > 0)) return nichts('brw_fehlt', null, herkunft);
  if (!(bez > 0)) {
    return nichts('bezugsgroesse_fehlt', 'Die Bezugsgröße des Bodenrichtwertgrundstücks fehlt; '
      + 'ohne sie ist der Umrechnungskoeffizient des Ausschusses nicht bestimmbar.', herkunft);
  }

  const art = artSchluessel(objektart);
  const erlaubt = g.objektarten || null;
  const ausgeschlossen = (g.objektarten_ausgeschlossen || []).indexOf(art) >= 0
    || (erlaubt && art && erlaubt.indexOf(art) < 0);
  /* v2362 · Marcel 17.10.2026: „wenn wir eigene Tabellen haben und es klar ist, die
     Werte, ansonsten die bundesweite Formel." Ein MFH, das NUR wegen der Objektart
     aus der Tabelle des Ausschusses faellt (Tabelle des individuellen Wohnungsbaus),
     bekommt diese oertliche Tabelle UEBERTRAGEN - vor der bundesweiten DealPilot-
     Formel, weil sie denselben Markt beschreibt. Nie amtlich: Stufe C, im Bericht
     als Uebertragung benannt, mit dem Wortlaut des Ausschusses dazu. Der Aufrufer
     schaltet es ein (mfh_uebertragen) - ein Kern liest keine Einstellungen. */
  const _uebertragen = ausgeschlossen && art === 'mfh' && mfh_uebertragen === true
    && (g.objektarten || []).some((a) => ['efh', 'zfh', 'dhh', 'rh'].indexOf(a) >= 0);
  if (ausgeschlossen && !_uebertragen) {
    return nichts('ausserhalb_geltung',
      'Die Umrechnungskoeffizienten des Ausschusses gelten für ' + (g.nutzung || 'den Regelfall')
      + ', nicht für diese Objektart. Der Bodenwert ist deshalb NICHT an die Grundstücksgröße angepasst ('
      + fl + ' m² gegen ' + bez + ' m² Bezugsgröße). '
      + (g.ausserhalb_wortlaut ? 'Der Ausschuss: „' + g.ausserhalb_wortlaut + '“ ' : '')
      + (g.ausserhalb_weg ? 'Ansprechpartner: ' + g.ausserhalb_weg + '.' : ''),
      { ...herkunft, nicht_angepasst: true });
  }
  /* v2283 · AUSGESCHLOSSENE GEBIETE INNERHALB DER AGS (Bremen: Oberneuland,
     Borgfeld, St. Magnus). Sie haben keine eigene AGS - geprueft wird gegen
     die Ortsangaben der BORIS-Antwort (Ortsteil, Gemarkung). Kennt der Bericht
     den Ortsteil nicht, wird NICHT umgerechnet: eine Tabelle, deren Geltung
     sich nicht pruefen laesst, gilt hier nicht. */
  const _ausg = Array.isArray(g.gebiete_ausgeschlossen) ? g.gebiete_ausgeschlossen : [];
  if (_ausg.length) {
    const orte = (Array.isArray(ortsteile) ? ortsteile : [ortsteile])
      .map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
    /* voller Name vor der Klammer („St. Magnus (Lesumlage)" -> „st. magnus") -
       nie nur das erste Wort, „st" steckt in „Osterholz". */
    const kern = (x) => String(x).split('(')[0].trim().toLowerCase();
    const treffer = _ausg.find((a) => orte.some((o) => o === kern(a) || o.indexOf(kern(a)) >= 0));
    if (!orte.length || treffer) {
      return nichts(treffer ? 'gebiet_ausgeschlossen' : 'ortsteil_unbekannt',
        (treffer
          ? 'Die Umrechnungskoeffizienten des Ausschusses gelten ausdrücklich nicht für ' + treffer + '. '
          : 'Die Umrechnungskoeffizienten des Ausschusses gelten nicht für ' + _ausg.join(', ')
            + '; der Ortsteil dieses Grundstücks ist nicht bekannt. ')
        + 'Der Bodenwert ist nicht an die Grundstücksgröße angepasst.',
        { ...herkunft, nicht_angepasst: fl !== bez });
    }
  }
  /* v2286 · TABELLE NACH HAUSTYP (Dortmund: freistehend 600, DH/RE 300, RM 200).
     Der Ausschuss waehlt die Tabelle nach dem Haustyp, nicht nach der Zone.
     Passt die Bezugsgroesse der Zone nicht zur Tabelle des Haustyps, oder ist
     der Haustyp nicht eindeutig (DealPilot kennt kein Reihenend/-mittelhaus),
     wird nicht umgerechnet. */
  const _jeArt = g.normgroesse_je_objektart;
  if (_jeArt && typeof _jeArt === 'object') {
    const soll = Number(_jeArt[art]);
    if (!(soll > 0) || soll !== bez) {
      return nichts('haustyp_passt_nicht', 'Der Ausschuss wählt seine Umrechnungstabelle nach dem Haustyp'
        + (soll > 0 ? ' (für diese Objektart Bezugsgröße ' + soll + ' m², die Zone nennt ' + bez + ' m²)'
                    : ' — für diese Objektart ist die Tabelle nicht eindeutig') + '. Der Bodenwert ist nicht an die Grundstücksgröße angepasst.',
        { ...herkunft, nicht_angepasst: fl !== bez });
    }
  }
  /* v2281 · Geltung nach Bodenrichtwert (Hessen: nur unter 400 EUR/m2). */
  const brwBis = Number(g.brw_bis_eur_qm), brwVon = Number(g.brw_von_eur_qm);
  if ((brwBis > 0 && brw > brwBis) || (brwVon > 0 && brw < brwVon)) {
    return nichts('ausserhalb_brw', 'Die Umrechnungskoeffizienten des Ausschusses gelten nur für Bodenrichtwerte '
      + (brwVon > 0 ? 'ab ' + brwVon + ' ' : '') + (brwBis > 0 ? 'bis ' + brwBis + ' ' : '') + '€/m²; hier '
      + brw + ' €/m². Der Bodenwert ist nicht an die Grundstücksgröße angepasst.',
      { ...herkunft, nicht_angepasst: fl !== bez });
  }
  if (fl === bez) {
    return nichts('gleich_bezugsgroesse', null, herkunft);
  }

  const kFl = koeffizientFuer(satz, fl, bez);
  const kBez = koeffizientFuer(satz, bez, bez);
  if (kFl.k == null || kBez.k == null) {
    const g2 = kFl.k == null ? kFl : kBez;
    return nichts(g2.grund, 'Für ' + fl + ' m² bei ' + bez + ' m² Bezugsgröße liefert die Tabelle des '
      + 'Ausschusses keinen Koeffizienten' + (g2.wortlaut ? ' („' + g2.wortlaut + '“)' : '')
      + '. Der Bodenwert ist nicht angepasst.', { ...herkunft, nicht_angepasst: true });
  }
  const faktor = r4(kFl.k / kBez.k);
  const bwQm = Math.round(brw * faktor * 100) / 100;
  const wertBauland = Math.round(fl * bwQm);
  const _erg = {
    verfuegbar: true,
    bezugsgroesse_qm: bez,
    bauland_qm: fl, gruen_qm: 0,
    koeffizient_bauland: kFl.k, koeffizient_bezugsgroesse: kBez.k,
    koeffizient_weg: kFl.weg,
    faktor, bodenwert_eur_qm: bwQm,
    gruen_eur_qm: 0,
    wert_bauland_eur: wertBauland, wert_gruen_eur: 0,
    wert_eur: wertBauland,
    koeffizient_angewandt: true,
    ...herkunft,
    hinweis: 'Der Bodenrichtwert wurde mit dem Umrechnungskoeffizienten des Ausschusses an die '
      + 'Grundstücksgröße angepasst: ' + fl + ' m² gegen ' + bez + ' m² Bezugsgröße, Koeffizient '
      + String(kFl.k).replace('.', ',') + ' (' + kFl.weg + '). Quelle: ' + herkunft.quelle_text + '.',
  };
  if (!_uebertragen) return _erg;
  return {
    ..._erg, uebertragen: true, amtlich: false, stufe: 'C',
    quelle_art: 'Tabelle des Ausschusses, auf das Mehrfamilienhaus übertragen',
    hinweis: 'Die Umrechnungskoeffizienten des Ausschusses gelten für den Bereich „' + (g.nutzung || 'individueller Wohnungsbau') + '“'
      + ', nicht für Mehrfamilienhäuser'
      + (g.ausserhalb_wortlaut ? ' („' + g.ausserhalb_wortlaut + '“)' : '') + '. Weil er für diesen Markt eine eigene Tabelle '
      + 'führt, ist sie hier auf das Mehrfamilienhaus übertragen — das ist keine amtliche Angabe für diese Objektart: '
      + fl + ' m² gegen ' + bez + ' m² Bezugsgröße, Koeffizient ' + String(kFl.k).replace('.', ',') + ' (' + kFl.weg
      + '). Quelle der Tabelle: ' + herkunft.quelle_text + '.',
  };
}

/* ══ v2288 · DIE DEALPILOT-FORMEL — STUFE UNTER DEM AMTLICHEN WERT ══════
   Marcel 16.10.2026: „wir bestimmen eine Formel fuer die Berechnung des
   Koeffizienten, damit es naeherungsweise ist. Das waere dann eine Stufe
   darunter" und: „da schreiben wir DealPilot-Formel … abgeleitet aus einer
   DealPilot-Formel".

     UK(Objekt) / UK(Bezugsgroesse) = (Flaeche / Bezugsgroesse) ^ b

   b ist der Median der Exponenten aller amtlichen Flaechentabellen im
   Register (tools/uk-naeherung-ableiten.mjs -> lib/uk-naeherung.json, nach
   jeder Ernte neu). Hamburg fuehrt amtlich genau diese Form (b = -0,2496).

   NIE amtlich: Herkunft „abgeleitet aus der DealPilot-Formel", Stufe N (v2401, vorher D),
   mit Tabellenzahl und typischer Abweichung. Nur Ein-/Zweifamilien-,
   Doppel-, Reihenhaus, nur Zonen mit BEKANNTER Geschosszahl bis II, nur
   0,5- bis 2,5-fache Bezugsgroesse. Wo der Ausschuss etwas anderes sagt
   (Tiefe, WGFZ, kein Einfluss, Gebiet/Haustyp/Objektart ausgeschlossen),
   entscheidet der Aufrufer, sie NICHT zu rufen. */
let _NAEH = null;
function naeherungsDaten() {
  if (_NAEH !== null) return _NAEH;
  try { _NAEH = JSON.parse(readFileSync(new URL('./uk-naeherung.json', import.meta.url), 'utf8')); }
  catch (e) { _NAEH = false; }
  return _NAEH;
}

/** Geschosszahl aus BORIS („II", "2", "I-II", "III") -> hoechste Zahl oder null. */
export function geschosse(t) {
  const s = String(t == null ? '' : t).toUpperCase().trim();
  if (!s) return null;
  const rom = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8 };
  const teile = s.split(/[^IVX0-9]+/).filter(Boolean)
    .map((x) => (/^\d+$/.test(x) ? Number(x) : rom[x] || null)).filter((x) => x > 0);
  return teile.length ? Math.max(...teile) : null;
}

/** Sperrgruende, bei denen der Ausschuss eine ANDERE Regel hat - dort keine Naeherung. */
/* v2289a · Vorrang hat der Grund-Code der Ernte (sperre_grund). Die Stichwortsuche
   bleibt Rueckfall fuer Saetze ohne Code - sie traf auch zufaellige Zitate („-tiefe"). */
const KEINE_NAEHERUNG_BEI = new Set(['nur_tiefe', 'nur_wgfz', 'nur_tiefe_wgfz', 'tiefe_und_wgfz',
  'tiefe_und_flaeche_kombiniert', 'nicht_abbildbar', 'reihenwahl_nicht_ueber_ags', 'nur_einzelfall', 'kein_einfluss']);
export function sperreSchliesstNaeherungAus(text, code) {
  if (code) return KEINE_NAEHERUNG_BEI.has(String(code));
  return /tiefe|wgfz|\bgfz\b|geschossfl|kein(?:en|e)? einfluss|keine (?:flaechen)?abh|nicht flaechenabh|ausgeschlossen/i
    .test(String(text || ''));
}

/* v2593 · Abweichung der DealPilot-Formel im Kundentext, ohne Fachwort:
   „in der Haelfte der Faelle hoechstens X %, in 8 von 10 Faellen hoechstens Y %".
   cv = pruefung.loto aus der JSON (Kreuzvalidierung); ohne sie die alten Werte. */
function _abwText(cv, alt) {
  const k = (x) => String(Math.round(Number(x) * 10) / 10).replace('.', ',');
  if (cv && Number.isFinite(Number(cv.median_pct)) && Number.isFinite(Number(cv.p80_pct))) {
    return 'nachgeprüft an amtlichen Tabellen weicht sie in der Hälfte der Fälle höchstens ' + k(cv.median_pct)
      + ' % vom amtlichen Wert ab, in 8 von 10 Fällen höchstens ' + k(Math.round(Number(cv.p80_pct))) + ' %';
  }
  return 'typische Abweichung vom amtlichen Wert ' + k(alt.abweichung_median_pct) + ' %, in 90 % der Fälle unter '
    + k(Math.round(Number(alt.abweichung_p90_pct))) + ' %';
}

export function naeherung({ objektart, flaeche_qm, bezugsgroesse_qm, brw_eur_qm, geschosszahl }) {
  const d = naeherungsDaten();
  const nein = (grund, hinweis) => ({ verfuegbar: false, grund, hinweis: hinweis || null });
  if (!d || !d.alle || !(Number(d.alle.b) < 0)) return nein('keine_formel');
  const g = d.gilt_fuer || {};
  const art = artSchluessel(objektart);
  if ((g.objektarten || []).indexOf(art) < 0) return nein('objektart');
  const gz = geschosse(geschosszahl);
  if (gz == null) return nein('geschosszahl_unbekannt',
    'Die Geschosszahl der Bodenrichtwertzone ist nicht bekannt — die DealPilot-Formel gilt nur für Zonen bis zwei Vollgeschosse.');
  if (gz > (g.max_vollgeschosse || 2)) return nein('geschosse');
  const fl = Number(flaeche_qm), bez = Number(bezugsgroesse_qm), brw = Number(brw_eur_qm);
  if (!(fl > 0) || !(bez > 0) || !(brw > 0)) return nein('angaben_fehlen');
  const r = fl / bez;
  if (r < (g.verhaeltnis_von || 0.5) || r > (g.verhaeltnis_bis || 2.5)) return nein('ausserhalb_bereich',
    'Die Grundstücksgröße liegt außerhalb des Bereichs, für den die DealPilot-Formel abgeleitet ist ('
      + (g.verhaeltnis_von || 0.5) + '- bis ' + (g.verhaeltnis_bis || 2.5) + '-fache Bezugsgröße).');
  if (fl === bez) return nein('gleich_bezugsgroesse');
  const b = Number(d.alle.b);
  /* v2360 · Zweiter Ast jenseits des 2,5-Fachen: dort fallen die amtlichen Tabellen
     steiler, die Mehrflaeche wird wie Hinterland bewertet - bis 2,5 x die Potenz,
     darueber je m2 der Restfaktor c (Median aus den Tabellen, uk-naeherung.json). */
  const o = d.oberhalb && Number(d.oberhalb.rest_faktor) > 0 && r > Number(d.oberhalb.ab) ? d.oberhalb : null;
  const k = o ? r4((Math.pow(Number(o.ab), b) * Number(o.ab) + (r - Number(o.ab)) * Number(o.rest_faktor)) / r)
              : r4(Math.pow(r, b));
  const bwQm = Math.round(brw * k * 100) / 100;
  const de = (x) => String(x).replace('.', ',');
  return {
    verfuegbar: true, naeherung: true, stufe: d.stufe || 'N',
    quelle_art: 'DealPilot-Formel', quelle: 'DealPilot-Formel', quelle_text: 'abgeleitet aus der DealPilot-Formel',
    bezugsgroesse_qm: bez, bauland_qm: fl, gruen_qm: 0,
    koeffizient_bauland: k, koeffizient_bezugsgroesse: 1, faktor: k,
    bodenwert_eur_qm: bwQm, gruen_eur_qm: 0,
    wert_bauland_eur: Math.round(fl * bwQm), wert_gruen_eur: 0, wert_eur: Math.round(fl * bwQm),
    koeffizient_angewandt: true,
    formel: { b, tabellen: d.alle.tabellen, laender: d.alle.laender, stand: d.stand,
              abweichung_median_pct: (o || d.alle).abweichung_median_pct, abweichung_p90_pct: (o || d.alle).abweichung_p90_pct,
              /* v2593 · Kreuzvalidierung und Streuung des Exponenten (noch nicht im Bericht) */
              pruefung: ((o || d.alle).pruefung || {}).loto || null, b_p10: d.alle.b_p10 ?? null, b_p90: d.alle.b_p90 ?? null,
              zweiter_ast: o ? { ab: Number(o.ab), rest_faktor: Number(o.rest_faktor), tabellen: o.tabellen } : null },
    uebertragen: (g.uebertragen_auf || []).indexOf(art) >= 0,
    hinweis: ((g.uebertragen_auf || []).indexOf(art) >= 0
      ? 'Für Mehrfamilienhäuser veröffentlicht der Ausschuss hier keinen Umrechnungskoeffizienten. Die DealPilot-Formel '
        + 'ist aus den Tabellen des individuellen Wohnungsbaus abgeleitet und wird auf das Mehrfamilienhaus übertragen '
        + '(Bodenrichtwertzone bis zwei Vollgeschosse). '
      : '')
      + ((g.uebertragen_auf || []).indexOf(art) >= 0 ? '' : 'Für diesen Ort liegt kein amtlicher Umrechnungskoeffizient vor. ')
      + 'Der Bodenrichtwert ist deshalb mit einem '
      + 'Koeffizienten angepasst, der aus der DealPilot-Formel abgeleitet ist: '
      + (o ? 'bis zum ' + de(o.ab) + '-Fachen der Bezugsgröße (' + de(o.ab) + ')^' + de(b) + ', die Fläche darüber mit dem Restfaktor '
             + de(o.rest_faktor) + ' (aus ' + o.tabellen + ' Tabellen, die so weit reichen), zusammen ' + de(k)
           : '(' + fl + ' / ' + bez + ')^' + de(b) + ' = ' + de(k))
      + '. Die Formel beruht auf ' + d.alle.tabellen + ' amtlichen Umrechnungstabellen der '
      + 'Gutachterausschüsse (' + (d.alle.laender || []).join(', ') + ', Stand ' + d.stand + '); '
      /* v2593 · gemessen mit ausgelassener Tabelle (uk-naeherung.json pruefung.loto),
         nicht mehr an den Tabellen, aus denen die Formel gelernt ist. */
      + _abwText((o || d.alle).pruefung && (o || d.alle).pruefung.loto, (o || d.alle))
      + (o ? ' (oberhalb des 2,5-Fachen deutlich unsicherer)' : '') + '. Keine amtliche Zahl — liegt dir der Koeffizient des '
      + 'zuständigen Ausschusses vor, trag ihn unter „Umrechnungskoeffizient Grundstücksgröße" ein.',
  };
}

export default { KENNZAHL, artSchluessel, koeffizientFuer, pruefeBeispiel, satzFuer, groessenanpassung, naeherung, geschosse };
