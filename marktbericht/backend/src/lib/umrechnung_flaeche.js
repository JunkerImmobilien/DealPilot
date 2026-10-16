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
export function koeffizientFuer(satz, flaecheQm, normgroesseQm) {
  const f = (satz && satz.formel) || {};
  const fl = Number(flaecheQm), norm = Number(normgroesseQm);
  if (f.form !== 'flaeche_tabelle') return { k: null, grund: 'form_unbekannt' };
  const tab = (f.tabellen || {})[String(norm)];
  if (!tab) return { k: null, grund: 'normgroesse_nicht_in_tabelle' };
  const xs = tab.flaeche_qm, ys = tab.koeffizient;
  if (!Array.isArray(xs) || xs.length !== ys.length || xs.length < 2) return { k: null, grund: 'tabelle_defekt' };
  if (!(fl > 0)) return { k: null, grund: 'flaeche_fehlt' };
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
  const r = koeffizientFuer(satz, b.flaeche_qm, b.normgroesse_qm);
  const bw = r.k != null ? Math.round(b.flaeche_qm * b.brw_eur_qm * r.k) : null;
  return { ok: r.k != null && Math.abs(r.k - b.koeffizient) < 0.005 && Math.abs(bw - b.bodenwert_eur) <= 1,
           k: r.k, soll_k: b.koeffizient, bodenwert: bw, soll_bodenwert: b.bodenwert_eur };
}

/** Satz fuer den Ort. Mehrere Saetze (Zweige) -> der, dessen Geltung die
 *  Objektart nennt; sonst der erste. */
export function satzFuer(ags, objektart, alle) {
  const t = alle || finde(KENNZAHL, ags);
  if (!t.length) return null;
  const art = artSchluessel(objektart);
  return t.find((s) => ((s.geltungsbereich || {}).objektarten || []).indexOf(art) >= 0) || t[0];
}

/**
 * Groessenanpassung des Bodenwerts — dieselbe Rueckgabeform wie
 * umrechnung_nrw.flaechenaufteilung(), damit ErtragswertService.bodenwert()
 * sie ohne Aenderung liest.
 */
export function groessenanpassung({ ags, objektart, flaeche_qm, bezugsgroesse_qm, brw_eur_qm, saetze }) {
  const nichts = (grund, hinweis, extra) => ({ verfuegbar: false, grund, hinweis, ...(extra || {}) });
  const satz = satzFuer(ags, objektart, saetze);
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
  };
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
  if (ausgeschlossen) {
    return nichts('ausserhalb_geltung',
      'Die Umrechnungskoeffizienten des Ausschusses gelten für ' + (g.nutzung || 'den Regelfall')
      + ', nicht für diese Objektart. Der Bodenwert ist deshalb NICHT an die Grundstücksgröße angepasst ('
      + fl + ' m² gegen ' + bez + ' m² Bezugsgröße). '
      + (g.ausserhalb_wortlaut ? 'Der Ausschuss: „' + g.ausserhalb_wortlaut + '“ ' : '')
      + (g.ausserhalb_weg ? 'Ansprechpartner: ' + g.ausserhalb_weg + '.' : ''),
      { ...herkunft, nicht_angepasst: true });
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
  return {
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
}

export default { KENNZAHL, artSchluessel, koeffizientFuer, pruefeBeispiel, satzFuer, groessenanpassung };
