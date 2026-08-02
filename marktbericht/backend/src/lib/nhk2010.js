// nhk2010.js — Normalherstellungskosten und Sachwertrechnung.
// ────────────────────────────────────────────────────────────────────────────
// WICHTIG: Die Kostenkennwerte unten sind ein GERUEST, keine Verordnungswerte.
// `geprueft: false` sperrt den Sachwert, bis sie gegen Anlage 4 ImmoWertV
// (NHK 2010) eingetragen sind. Erfundene Kennwerte waeren schlimmer als kein
// Sachwert — sie saehen aus wie eine Messung.
//
// Eintragen: die Tabelle in WERTE fuellen, dann `geprueft: true` setzen.
// Der Sachwert erscheint danach automatisch, ohne Codeaenderung.

export const NHK_2010 = {
  fassung: 'ImmoWertV 2021, Anlage 4 (NHK 2010)',
  geprueft: true,   // fuer die enthaltenen Gebaeudearten; 1.x-3.x fehlen (Grafik)
  basisjahr: 2010,

  /* Gebaeudetypen der NHK-2010-Systematik. Die Achsen sind Gebaeudeart,
   * Keller/Dachgeschoss und Standardstufe 1 bis 5. */
  /* Gebaeudearten nach Anlage 4, Nummer II. Die Nummern sind die der
   * Verordnung — so bleibt die Zuordnung nachpruefbar. */
  typen: {
    '4.1': 'Mehrfamilienhäuser4  5 mit bis zu 6 WE',
    '4.2': 'Mehrfamilienhäuser4 5 mit 7 bis 20 WE',
    '4.3': 'Mehrfamilienhäuser4 5 mit mehr als 20 WE',
    '5.1': 'Wohnhäuser mit Mischnutzung7',
    '5.2': 'Banken und Geschäftshäuser mit Wohnungen',
    '5.3': 'Banken und Geschäftshäuser ohne Wohnungen',
    '6.1': 'Bürogebäude, Massivbau',
    '6.2': 'Bürogebäude, Stahlbetonskelettbau',
    '7.1': 'Gemeindezentren',
    '7.2': 'Saalbauten/Veranstaltungsgebäude',
    '8.1': 'Kindergärten',
    '8.2': 'Allgemeinbildende Schulen, Berufsbildende Schulen',
    '8.3': 'Sonderschulen',
    '9.1': 'Wohnheime/Internate',
    '9.2': 'Alten-/Pflegeheime',
    '10.1': 'Krankenhäuser/Kliniken',
    '10.2': 'Tageskliniken/Ärztehäuser',
    '11.1': 'Hotels',
    '12.1': 'Sporthallen (Einfeldhallen)',
    '12.2': 'Sporthallen (Dreifeldhallen/Mehrzweckhallen)',
    '12.3': 'Tennishallen',
    '12.4': 'Freizeitbäder/Heilbäder',
    '13.1': 'Verbrauchermärkte',
    '13.2': 'Kauf-/Warenhäuser',
    '13.3': 'Autohäuser ohne Werkstatt',
    '14.1': 'Einzelgaragen/Mehrfachgaragen',
    '14.2': 'Hochgaragen',
    '14.3': 'Tiefgaragen',
    '14.4': 'Nutzfahrzeuggaragen',
    '15.1': 'Betriebs-/Werkstätten, eingeschossig',
    '15.2': 'Betriebs-/Werkstätten, mehrgeschossig ohne Hallenanteil',
    '15.3': 'Betriebs-/Werkstätten, mehrgeschossig, hoher Hallenanteil',
    '15.4': 'Industrielle Produktionsgebäude, Massivbauweise',
    '15.5': 'Industrielle Produktionsgebäude, überwiegend Skelettbauweise',
    '16.1': 'Lagergebäude ohne Mischnutzung, Kaltlager',
    '16.2': 'Lagergebäude mit bis zu 25 % Mischnutzung',
    '16.3': 'Lagergebäude mit mehr als 25 % Mischnutzung',
    '17.1': 'Museen',
    '17.2': 'Theater',
    '17.3': 'Sakralbauten',
    '17.4': 'Friedhofsgebäude',
  },

  keller_dg: {
    kg_dg_ausgebaut: 'mit Keller, Dachgeschoss ausgebaut',
    kg_dg_nicht: 'mit Keller, Dachgeschoss nicht ausgebaut',
    ohne_kg_dg_ausgebaut: 'ohne Keller, Dachgeschoss ausgebaut',
    ohne_kg_flach: 'ohne Keller, Flachdach oder flach geneigt',
  },

  /* EUR je m2 Bruttogrundflaeche, Preisstand 2010.
   * Schluessel: <typ>|<keller_dg>|<standardstufe 1-5>
   * LEER = noch einzutragen. Solange leer, kein Sachwert. */
  /* Ausgelesen aus dem Verordnungstext (gesetze-im-internet.de, Anlage 4
   * ImmoWertV, BGBl. I 2021, 2824-2855) am 01.08.2026 — nicht geschaetzt.
   * Schluessel: <Gebaeudeart-Nr>|<Standardstufe>, EUR je m2 BGF, Stand 2010.
   *
   * NICHT ENTHALTEN: die Tabelle fuer freistehende Ein- und Zweifamilien-,
   * Doppel- und Reihenhaeuser (Gebaeudearten 1.x bis 3.x). Sie ist auf
   * gesetze-im-internet.de als Grafik eingebunden und laesst sich nicht aus
   * dem Text ziehen. Solange sie fehlt, rechnet der Sachwert fuer diese
   * Gebaeude nicht — geschaetzte Kennwerte waeren schlimmer als keine. */
  WERTE: {
    /* 4.1 Mehrfamilienhäuser4  5 mit bis zu 6 WE */
    '4.1|3': 825,
    '4.1|4': 985,
    '4.1|5': 1190,
    /* 4.2 Mehrfamilienhäuser4 5 mit 7 bis 20 WE */
    '4.2|3': 765,
    '4.2|4': 915,
    '4.2|5': 1105,
    /* 4.3 Mehrfamilienhäuser4 5 mit mehr als 20 WE */
    '4.3|3': 755,
    '4.3|4': 900,
    '4.3|5': 1090,
    /* 5.1 Wohnhäuser mit Mischnutzung7 */
    '5.1|3': 860,
    '5.1|4': 1085,
    '5.1|5': 1375,
    /* 5.2 Banken und Geschäftshäuser mit Wohnungen */
    '5.2|3': 890,
    '5.2|4': 1375,
    '5.2|5': 1720,
    /* 5.3 Banken und Geschäftshäuser ohne Wohnungen */
    '5.3|3': 930,
    '5.3|4': 1520,
    '5.3|5': 1900,
    /* 6.1 Bürogebäude, Massivbau */
    '6.1|3': 1040,
    '6.1|4': 1685,
    '6.1|5': 1900,
    /* 6.2 Bürogebäude, Stahlbetonskelettbau */
    '6.2|3': 1175,
    '6.2|4': 1840,
    '6.2|5': 2090,
    /* 7.1 Gemeindezentren */
    '7.1|3': 1130,
    '7.1|4': 1425,
    '7.1|5': 1905,
    /* 7.2 Saalbauten/Veranstaltungsgebäude */
    '7.2|3': 1355,
    '7.2|4': 1595,
    '7.2|5': 2085,
    /* 8.1 Kindergärten */
    '8.1|3': 1300,
    '8.1|4': 1495,
    '8.1|5': 1900,
    /* 8.2 Allgemeinbildende Schulen, Berufsbildende Schulen */
    '8.2|3': 1450,
    '8.2|4': 1670,
    '8.2|5': 2120,
    /* 8.3 Sonderschulen */
    '8.3|3': 1585,
    '8.3|4': 1820,
    '8.3|5': 2315,
    /* 9.1 Wohnheime/Internate */
    '9.1|3': 1000,
    '9.1|4': 1225,
    '9.1|5': 1425,
    /* 9.2 Alten-/Pflegeheime */
    '9.2|3': 1170,
    '9.2|4': 1435,
    '9.2|5': 1665,
    /* 10.1 Krankenhäuser/Kliniken */
    '10.1|3': 1720,
    '10.1|4': 2080,
    '10.1|5': 2765,
    /* 10.2 Tageskliniken/Ärztehäuser */
    '10.2|3': 1585,
    '10.2|4': 1945,
    '10.2|5': 2255,
    /* 11.1 Hotels */
    '11.1|3': 1385,
    '11.1|4': 1805,
    '11.1|5': 2595,
    /* 12.1 Sporthallen (Einfeldhallen) */
    '12.1|3': 1320,
    '12.1|4': 1670,
    '12.1|5': 1955,
    /* 12.2 Sporthallen (Dreifeldhallen/Mehrzweckhallen) */
    '12.2|3': 1490,
    '12.2|4': 1775,
    '12.2|5': 2070,
    /* 12.3 Tennishallen */
    '12.3|3': 1010,
    '12.3|4': 1190,
    '12.3|5': 1555,
    /* 12.4 Freizeitbäder/Heilbäder */
    '12.4|3': 2450,
    '12.4|4': 2985,
    '12.4|5': 3840,
    /* 13.1 Verbrauchermärkte */
    '13.1|3': 720,
    '13.1|4': 870,
    '13.1|5': 1020,
    /* 13.2 Kauf-/Warenhäuser */
    '13.2|3': 1320,
    '13.2|4': 1585,
    '13.2|5': 1850,
    /* 13.3 Autohäuser ohne Werkstatt */
    '13.3|3': 940,
    '13.3|4': 1240,
    '13.3|5': 1480,
    /* 14.1 Einzelgaragen/Mehrfachgaragen */
    '14.1|3': 245,
    '14.1|4': 485,
    '14.1|5': 780,
    /* 14.2 Hochgaragen */
    '14.2|3': 480,
    '14.2|4': 655,
    '14.2|5': 780,
    /* 14.3 Tiefgaragen */
    '14.3|3': 560,
    '14.3|4': 715,
    '14.3|5': 850,
    /* 14.4 Nutzfahrzeuggaragen */
    '14.4|3': 530,
    '14.4|4': 680,
    '14.4|5': 810,
    /* 15.1 Betriebs-/Werkstätten, eingeschossig */
    '15.1|3': 970,
    '15.1|4': 1165,
    '15.1|5': 1430,
    /* 15.2 Betriebs-/Werkstätten, mehrgeschossig ohne Hallenanteil */
    '15.2|3': 910,
    '15.2|4': 1090,
    '15.2|5': 1340,
    /* 15.3 Betriebs-/Werkstätten, mehrgeschossig, hoher Hallenanteil */
    '15.3|3': 620,
    '15.3|4': 860,
    '15.3|5': 1070,
    /* 15.4 Industrielle Produktionsgebäude, Massivbauweise */
    '15.4|3': 950,
    '15.4|4': 1155,
    '15.4|5': 1440,
    /* 15.5 Industrielle Produktionsgebäude, überwiegend Skelettbauweise */
    '15.5|3': 700,
    '15.5|4': 965,
    '15.5|5': 1260,
    /* 16.1 Lagergebäude ohne Mischnutzung, Kaltlager */
    '16.1|3': 350,
    '16.1|4': 490,
    '16.1|5': 640,
    /* 16.2 Lagergebäude mit bis zu 25 % Mischnutzung */
    '16.2|3': 550,
    '16.2|4': 690,
    '16.2|5': 880,
    /* 16.3 Lagergebäude mit mehr als 25 % Mischnutzung */
    '16.3|3': 890,
    '16.3|4': 1095,
    '16.3|5': 1340,
    /* 17.1 Museen */
    '17.1|3': 1880,
    '17.1|4': 2295,
    '17.1|5': 2670,
    /* 17.2 Theater */
    '17.2|3': 2070,
    '17.2|4': 2625,
    '17.2|5': 3680,
    /* 17.3 Sakralbauten */
    '17.3|3': 1510,
    '17.3|4': 2060,
    '17.3|5': 2335,
    /* 17.4 Friedhofsgebäude */
    '17.4|3': 1320,
    '17.4|4': 1490,
    '17.4|5': 1720,
  },

  /* Gewichtung der neun Gewerke fuer die Standardstufe (Anlage 4).
   * Ebenfalls gegen den Verordnungstext zu pruefen. */
  gewerke_gewicht: {
    aussenwaende: null, dach: null, fenster_tueren: null,
    innenwaende: null, decken_treppen: null, fussboeden: null,
    sanitaer: null, heizung: null, sonstige_technik: null,
  },

  /* Korrekturfaktoren aus Anlage 4, Fussnoten zu den Wohngebaeuden.
   * Wohnungsgroesse wird linear zwischen den Stuetzstellen interpoliert. */
  korrektur_wohnungsgroesse: { 35: 1.10, 50: 1.00, 135: 0.85 },
  korrektur_grundriss: { einspaenner: 1.05, zweispaenner: 1.00, dreispaenner: 0.97, vierspaenner: 0.95 },

  /* Baunebenkosten sind in den Kennwerten bereits enthalten (Anlage 4 I.1 Abs. 3):
   * Mehrfamilienhaeuser 19 %, Wohnhaeuser mit Mischnutzung 18 %,
   * Banken und Geschaeftshaeuser 22 %, Buerogebaeude 18 %.
   * Nicht noch einmal aufschlagen. */
  baunebenkosten_enthalten: true,

  /* Aussenanlagen: in der Verordnung nicht als fester Satz vorgegeben.
   * Bleibt eine Eingabe, kein Automatismus. */
  aussenanlagen_pct: null,
};

/* Schluessel ist <Gebaeudeart-Nr>|<Standardstufe>, z. B. '4.1|3'.
 * Die Keller/Dachgeschoss-Achse gilt nur fuer die Ein- und Zweifamilien-
 * haeuser (1.x-3.x), und genau deren Tabelle fehlt noch. */
export function nhkKennwert(typ, kellerDg, stufe) {
  if (!NHK_2010.geprueft) return null;
  /* v1047-WSTD-1 · Vorher: `Number(stufe) || 3`. Eine fehlende Angabe
   * wurde damit zu Stufe 3 — still. Gemessen an einer 165-m2-Wohnung:
   * 216.978 EUR statt 259.059 EUR bei Stufe 4. Zwischen Stufe 3 und 5
   * liegen bei 4.1 rund 44 Prozent; das laesst sich nicht mitteln. Ohne
   * Angabe erscheint das Verfahren nicht, wie bei jeder anderen fehlenden
   * Pflichtangabe auch. */
  const roh = Number(stufe);
  if (!Number.isFinite(roh) || roh < 1) return null;
  const st = Math.min(5, Math.max(3, Math.round(roh)));   // Tabelle kennt 3-5
  const v = NHK_2010.WERTE[`${typ}|${st}`];
  return Number.isFinite(v) ? v : null;
}

/* Korrekturfaktoren fuer Wohngebaeude (Anlage 4, Fussnoten).
 * Wohnungsgroesse linear zwischen 35, 50 und 135 m2 WF je WE. */
export function korrekturWohnung({ wohnflaeche_je_we, grundriss }) {
  let f = 1;
  const w = Number(wohnflaeche_je_we);
  if (Number.isFinite(w) && w > 0) {
    const k = NHK_2010.korrektur_wohnungsgroesse;
    if (w <= 35) f *= k[35];
    else if (w >= 135) f *= k[135];
    else if (w <= 50) f *= k[35] + (k[50] - k[35]) * (w - 35) / 15;
    else f *= k[50] + (k[135] - k[50]) * (w - 50) / 85;
  }
  const g = NHK_2010.korrektur_grundriss[String(grundriss || '').toLowerCase()];
  if (g) f *= g;
  return Math.round(f * 1000) / 1000;
}

/**
 * Bruttogrundflaeche. Direkt angegeben schlaegt jede Naeherung.
 * Die Naeherung aus der Wohnflaeche ist grob und wird als solche gemeldet —
 * bei einem Mehrfamilienhaus ist sie unbrauchbar, weil Treppenhaus,
 * Keller und Nebenraeume je nach Gebaeude stark schwanken.
 */
export function bgf({ bgf_direkt, wohnflaeche_qm, objektart }) {
  const d = Number(bgf_direkt);
  if (Number.isFinite(d) && d > 0) return { wert: d, herkunft: 'direkt', verlaesslich: true };
  const w = Number(wohnflaeche_qm);
  if (!Number.isFinite(w) || w <= 0) return { wert: null, herkunft: null, verlaesslich: false };
  const istMfh = /mfh|mehrfamilien/i.test(String(objektart || ''));
  if (istMfh) {
    return { wert: null, herkunft: null, verlaesslich: false,
      hinweis: 'Bei Mehrfamilienhaeusern ist die Naeherung aus der Wohnflaeche zu ungenau. '
             + 'Bruttogrundflaeche bitte direkt angeben.' };
  }
  return { wert: Math.round(w * 1.55), herkunft: 'Naeherung aus Wohnflaeche', verlaesslich: false };
}

/**
 * Sachwert nach §§ 35–39 ImmoWertV.
 *
 * @param {object} ein
 * @param {object} bodenwertErgebnis  aus ErtragswertService.bodenwert()
 * @param {object} [param]  { sachwertfaktor, stufe, quelle } aus der Parametertabelle
 */
export function sachwert(ein, bodenwertErgebnis, param) {
  const out = {
    verfahren: 'Sachwertverfahren', rechtsgrundlage: '§§ 35–39 ImmoWertV 2021',
    staffel: [], hinweise: [], warnungen: [], wert: null, anwendbar: false,
  };

  if (!NHK_2010.geprueft) {
    out.grund = 'Die NHK-2010-Kostenkennwerte sind noch nicht hinterlegt. Solange sie fehlen, '
      + 'wird kein Sachwert ausgewiesen — ein geschätzter Herstellungskostenwert wäre '
      + 'irreführend, weil er wie eine Messung aussieht.';
    return out;
  }

  const kw = nhkKennwert(ein.nhk_typ, ein.keller_dg, ein.standardstufe);
  if (kw == null) {
    const istEfh = /^[123]\./.test(String(ein.nhk_typ || ''));
    out.grund = istEfh
      ? 'Für freistehende Ein- und Zweifamilien-, Doppel- und Reihenhäuser fehlt die '
        + 'Kostenkennwert-Tabelle noch. Sie ist im Verordnungstext als Grafik eingebunden '
        + 'und ließ sich nicht auslesen. Geschätzte Kennwerte wären irreführend.'
      : `Für ${ein.nhk_typ || 'diesen Gebäudetyp'} in Standardstufe `
        + `${ein.standardstufe || '?'} ist kein Kostenkennwert hinterlegt.`;
    return out;
  }
  /* Korrekturfaktoren fuer Wohnungsgroesse und Grundrissart. */
  const korr = korrekturWohnung({
    wohnflaeche_je_we: ein.wohnflaeche_je_we, grundriss: ein.grundriss,
  });

  const f = bgf(ein);
  if (!f.wert) {
    out.grund = f.hinweis || 'Ohne Bruttogrundfläche kein Sachwert.';
    return out;
  }
  if (!f.verlaesslich) {
    out.hinweise.push('Die Bruttogrundfläche wurde aus der Wohnfläche genähert (Faktor 1,55). '
      + 'Für ein belastbares Ergebnis bitte direkt angeben.');
  }

  const index = Number(ein.baupreisindex) || null;
  if (!index) { out.grund = 'Ohne Baupreisindex kein Sachwert.'; return out; }
  const regional = Number(ein.regionalfaktor) || 1.0;

  const herst = Math.round(kw * f.wert * index * regional * korr);
  out.staffel.push({ pos: `Normalherstellungskosten (${kw} €/m² BGF × ${f.wert} m²)`, wert: Math.round(kw * f.wert) });
  if (korr !== 1) out.staffel.push({ pos: `× Korrektur Wohnungsgröße / Grundriss`, faktor: korr, wert: null });
  out.staffel.push({ pos: `× Baupreisindex ${index}`, faktor: index, wert: null });
  if (regional !== 1) out.staffel.push({ pos: `× Regionalfaktor ${regional}`, faktor: regional, wert: null });
  out.staffel.push({ pos: '= Herstellungskosten Gebäude', wert: herst, summe: true });

  const gnd = Number(ein.gnd_jahre), rnd = Number(ein.rnd_jahre);
  if (!gnd || rnd == null) { out.grund = 'Ohne Rest- und Gesamtnutzungsdauer kein Sachwert.'; return out; }
  const minderung = Math.round(herst * ((gnd - rnd) / gnd));
  out.staffel.push({ pos: `− Alterswertminderung (${gnd - rnd} von ${gnd} Jahren)`, wert: -minderung, summe: true });

  let geb = herst - minderung;
  const bes = Number(ein.bes_bauteile) || 0;
  if (bes) { geb += bes; out.staffel.push({ pos: '+ besondere Bauteile', wert: bes }); }
  const aussen = Number(ein.aussenanlagen)
    || (NHK_2010.aussenanlagen_pct ? Math.round(geb * NHK_2010.aussenanlagen_pct / 100) : 0);
  if (aussen) { geb += aussen; out.staffel.push({ pos: '+ Außenanlagen', wert: aussen }); }
  out.staffel.push({ pos: '= Gebäudesachwert', wert: geb, summe: true });
  /* v1056-WSW-1 · Diese Werte gab es nur als lokale Variablen. Die
   * Ergebniskarte las sw.gebaeude_sachwert_eur und bekam undefined —
   * sichtbar als "Gebäude –" neben einer korrekten Staffel. */
  out.gebaeude_sachwert_eur = geb;
  out.restnutzungsdauer_jahre = rnd;
  out.gesamtnutzungsdauer_jahre = gnd;
  out.alterswertminderung_eur = minderung;
  out.herstellungskosten_eur = herst;

  const bw = (bodenwertErgebnis && bodenwertErgebnis.vollstaendig) ? bodenwertErgebnis.wert : 0;
  if (!bw) out.warnungen.push('Ohne Bodenwert ist der Sachwert unvollständig — er besteht aus Gebäude UND Boden.');
  out.staffel.push({ pos: '+ Bodenwert', wert: bw });
  out.bodenwert_eur = bw || null;   /* v1056-WSW-2 */
  const vorlaeufig = geb + bw;
  out.vorlaeufiger_sachwert_eur = vorlaeufig;
  out.staffel.push({ pos: '= vorläufiger Sachwert', wert: vorlaeufig, summe: true });

  /* Marktanpassung. Ohne Sachwertfaktor bleibt es beim vorlaeufigen Sachwert —
   * der ist ein definierter Zwischenwert, aber KEIN Marktwert. In schwachen
   * Maerkten liegt der Faktor deutlich unter 1, in starken darueber. */
  const swf = param && Number(param.sachwertfaktor);
  if (!swf) {
    out.wert = vorlaeufig;
    out.marktangepasst = false;
    out.warnungen.push('Kein Sachwertfaktor verfügbar. Ausgewiesen ist der vorläufige Sachwert '
      + 'ohne Marktanpassung — das ist eine Herstellungskostenrechnung, kein Marktwert. '
      + 'Abweichungen von 30 % und mehr sind normal.');
    return out;
  }
  const marktwert = Math.round(vorlaeufig * swf);
  out.staffel.push({ pos: `× Sachwertfaktor ${String(swf).replace('.', ',')}`, faktor: swf, wert: null });
  out.staffel.push({ pos: '= marktangepasster Sachwert', wert: marktwert, summe: true });
  out.wert = marktwert;
  out.marktangepasst = true;
  out.sachwertfaktor = { wert: swf, stufe: param.stufe || null, quelle: param.quelle || null };
  out.anwendbar = true;
  return out;
}
