// modell.js  (v1066)
//
// Auswertung eines Modells aus mb.param_modell.
//
// DREI REGELN, DIE NICHT AUFGEWEICHT WERDEN
//
// 1) DIE FORMEL IST DATEN, NICHT CODE. Es wird nichts ausgewertet, was aus
//    einer PDF stammt — nur feste Felder werden multipliziert und addiert.
//    Eine Formel als Zeichenkette in eval() waere eine Sicherheitsluecke mit
//    Anlauf.
//
// 2) AUSSERHALB DES GELTUNGSBEREICHS WIRD NICHT GERECHNET. Berlin sagt
//    ausdruecklich: mindestens vier Mieteinheiten, nicht fuer Wohnungs- und
//    Teileigentum, nicht fuer Ein-, Zwei- und Dreifamilienhaeuser. Und die
//    Gleichung gilt nur zwischen dem 5- und dem 95-Prozent-Perzentil. Wer
//    darueber hinaus verlaengert, bekommt eine Zahl, die es nicht gibt.
//
// 3) DER ZINSSATZ KOMMT NUR MIT SEINEN MODELLANSAETZEN. § 10 ImmoWertV.
//    Ein Berliner Zinssatz, gerechnet mit den Bewirtschaftungskosten des
//    AGVGA-NRW-Modells, ist modellfremd — und sieht amtlich aus.

/** Ein Zahlenwert oder null. Number(null) ist 0 und besteht Number.isFinite. */
function zahl(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Zinssatz aus einem Modell.
 *
 * @param {object} modell   Zeile aus mb.param_modell
 * @param {object} objekt   { miete_qm_monat, mieteinheiten, objektart,
 *                            altbezirk, baujahr, gewerbeanteil_pct, ostteil }
 * @returns {{ verfuegbar:boolean, wert?:number, herleitung?:Array,
 *             modellansaetze?:object, grund?:string, hinweis?:string }}
 */
export function zinssatzAusModell(modell, objekt) {
  if (!modell || !modell.formel) {
    return { verfuegbar: false, grund: 'kein_modell' };
  }
  const g = modell.geltungsbereich || {};
  const o = objekt || {};

  // ── Geltungsbereich ────────────────────────────────────────────────────
  const art = String(o.objektart || '').toLowerCase();
  for (const aus of (g.objektarten_aus || [])) {
    if (art && art.indexOf(String(aus).toLowerCase()) >= 0) {
      return { verfuegbar: false, grund: 'objektart_ausgeschlossen',
        hinweis: 'Der Gutachterausschuss schließt diese Objektart '
          + 'ausdrücklich aus seiner Ableitung aus (' + aus + '). '
          + 'Der Zinssatz wird deshalb nicht angewandt.' };
    }
  }

  const we = zahl(o.mieteinheiten);
  const minWe = zahl(g.min_mieteinheiten);
  if (minWe != null) {
    if (we == null) {
      return { verfuegbar: false, grund: 'mieteinheiten_unbekannt',
        hinweis: 'Das Modell gilt erst ab ' + minWe + ' Mieteinheiten. '
          + 'Die Zahl der Mieteinheiten ist nicht erfasst — ohne sie wird '
          + 'nicht gerechnet.' };
    }
    if (we < minWe) {
      return { verfuegbar: false, grund: 'zu_wenige_mieteinheiten',
        hinweis: 'Das Modell gilt ab ' + minWe + ' Mieteinheiten, das Objekt '
          + 'hat ' + we + '.' };
    }
  }

  const miete = zahl(o.miete_qm_monat);
  if (miete == null || miete <= 0) {
    return { verfuegbar: false, grund: 'miete_fehlt',
      hinweis: 'Die Gleichung setzt die durchschnittliche monatliche '
        + 'Objektkaltmiete je m² voraus. Ohne sie gibt es keinen Zinssatz.' };
  }
  const von = zahl(g.miete_von), bis = zahl(g.miete_bis);
  if ((von != null && miete < von) || (bis != null && miete > bis)) {
    return { verfuegbar: false, grund: 'miete_ausserhalb',
      hinweis: 'Die Gleichung ist nur zwischen ' + von + ' und ' + bis
        + ' €/m² statistisch verlässlich anwendbar; das Objekt liegt mit '
        + String(miete).replace('.', ',') + ' €/m² außerhalb. '
        + 'Sie wird nicht darüber hinaus verlängert.' };
  }

  // ── Die Gleichung ──────────────────────────────────────────────────────
  const f = modell.formel;
  const herleitung = [];
  let wert = zahl(f.konstante) || 0;
  herleitung.push({ pos: 'Konstante', wert: Math.round(wert * 10000) / 10000 });

  if (zahl(f.je_miete) != null) {
    const t = f.je_miete * miete;
    wert += t;
    herleitung.push({ pos: String(f.je_miete).replace('.', ',') + ' × Objektkaltmiete '
      + String(miete).replace('.', ',') + ' €/m²', wert: Math.round(t * 10000) / 10000 });
  }
  if (zahl(f.je_tag) != null && zahl(f.tage) != null) {
    const t = f.je_tag * f.tage;
    wert += t;
    herleitung.push({ pos: String(f.je_tag).replace('.', ',') + ' × ' + f.tage
      + ' Tage (Zeitkomponente der Regression)', wert: Math.round(t * 10000) / 10000 });
  }
  if (zahl(f.zuschlag)) {
    wert += f.zuschlag;
    herleitung.push({ pos: 'Zuschlag Gebietsgruppe ' + (modell.zweig || ''),
      wert: f.zuschlag });
  }

  // ── Korrekturen ────────────────────────────────────────────────────────
  const k = modell.korrekturen || {};
  const nimm = (topf, schluessel) => {
    if (!topf || schluessel == null) return null;
    const v = topf[String(schluessel)];
    return zahl(v);
  };

  const kAlt = nimm(k.altbezirk, o.altbezirk);
  if (kAlt != null && kAlt !== 0) {
    wert += kAlt;
    herleitung.push({ pos: 'Korrektur Altbezirk ' + o.altbezirk, wert: kAlt });
  }

  const bjg = baujahresgruppe(zahl(o.baujahr), !!o.ostteil);
  const kBj = nimm(k.baujahresgruppe, bjg);
  if (kBj != null && kBj !== 0) {
    wert += kBj;
    herleitung.push({ pos: 'Korrektur Baujahresgruppe ' + bjg, wert: kBj });
  }

  const gw = zahl(o.gewerbeanteil_pct);
  if (gw != null && k.gewerbeanteil_pct) {
    const stufe = Math.min(80, Math.max(0, Math.round(gw / 10) * 10));
    const kGw = nimm(k.gewerbeanteil_pct, stufe);
    if (kGw != null && kGw !== 0) {
      wert += kGw;
      herleitung.push({ pos: 'Korrektur gewerblicher Anteil ' + stufe + ' %', wert: kGw });
    }
  }

  wert = Math.round(wert * 100) / 100;

  return {
    verfuegbar: true,
    wert,
    zweig: modell.zweig,
    herleitung,
    modellansaetze: modell.modellansaetze || null,
    modellversion: modell.modellversion,
    stufe: modell.stufe,
    fallzahl: modell.fallzahl != null ? Number(modell.fallzahl) : null,
    quelle: modell.gaa_name || modell.gebiet_name || null,
    quelle_url: modell.quelle_url || null,
    hinweis: 'Objektspezifisch aus der veröffentlichten Regressionsgleichung des '
      + (modell.gaa_name || 'Gutachterausschusses') + ' berechnet. '
      + 'MODELLKONFORMITÄT (§ 10 ImmoWertV): dieser Zinssatz gilt nur zusammen '
      + 'mit den Ansätzen des Ausschusses für Bewirtschaftungskosten, '
      + 'Restnutzungsdauer und Bodenwert. Werden andere Ansätze verwendet, '
      + 'ist das Ergebnis nicht marktgerecht.',
  };
}

/** Berliner Baujahresgruppen. Andere Profile bringen ihre eigenen mit. */
export function baujahresgruppe(baujahr, ostteil) {
  const bj = zahl(baujahr);
  if (bj == null) return null;
  if (bj < 1919) return 'vor_1919';
  if (bj <= 1948) return '1919_1948';
  if (bj <= 1972) return '1949_1972';
  if (bj <= 1990) return ostteil ? '1973_1990_ost' : '1973_1990_west';
  if (bj <= 2002) return '1991_2002';
  return 'ab_2003';
}

/**
 * Der Beleg. Ein Modell wird nur uebernommen, wenn seine eigene Gleichung
 * die in derselben Veroeffentlichung abgedruckten Stuetzstellen trifft.
 *
 * Das ist die staerkste Pruefung, die es hier gibt: die Quelle prueft sich
 * selbst. Weicht eine Stelle ab, ist entweder die Formel falsch gelesen
 * oder die Tabelle — in beiden Faellen wird nichts gespeichert.
 */
export function belegePruefen(modell) {
  const fehler = [];
  for (const b of (modell.belege || [])) {
    const r = zinssatzAusModell(
      { ...modell, geltungsbereich: {} },
      { miete_qm_monat: b.miete, mieteinheiten: 99, objektart: 'mfh' }
    );
    if (!r.verfuegbar) { fehler.push({ ...b, ist: null, grund: r.grund }); continue; }
    const ist = Math.round(r.wert * 10) / 10;
    if (Math.abs(ist - b.zins) > 0.0001) fehler.push({ ...b, ist });
  }
  return { ok: fehler.length === 0, geprueft: (modell.belege || []).length, fehler };
}

export default { zinssatzAusModell, belegePruefen, baujahresgruppe };
