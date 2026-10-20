/* v2510 · DIE MAKRO-ROHWERTE IM BERICHT
 * ──────────────────────────────────────────────────────────────────────
 * Gemessen am 20.10.2026: der Bericht zeigte die Makrolage nur als
 * Teilscores (0-100). Die Zahlen, aus denen sie entstehen - Bevoelkerungs-
 * entwicklung, Arbeitslosenquote, Einkommensindex, Wanderungssaldo -
 * standen nirgends. `assessment.bevoelkerung` wurde nie gesetzt, und die
 * PDF-Zeile „Bevoelkerungstrend" las `macro.metrics`, das der Score nicht
 * traegt. Die Zahl war gemessen und kam nie an.
 *
 * Hier wird aus dem Rohabruf (DestatisConnector.macro) eine Liste je
 * Kennzahl: Wert, Einheit, Ebene (Kreis), Stand-Jahr, Tabellencode und
 * der Teilscore daneben. Dazu der Quellenvermerk nach dl-de/by-2-0 -
 * NUR, wenn mindestens ein Wert im Bericht steckt.
 *
 * Wortlaut des Vermerks, gemessen am 20.10.2026:
 *   regionalstatistik.de, Impressum/Copyright:
 *     „© Statistische Ämter des Bundes und der Länder, 2026"
 *     „Datenlizenz Deutschland – Namensnennung – Version 2.0"
 *   govdata.de/dl-de/by-2-0, Abs. 2 und 3: Bereitsteller, Lizenzvermerk
 *   mit Verweis auf den Lizenztext, Verweis auf den Datensatz (URI), und
 *   Veraenderungen sind kenntlich zu machen. Trend und Index sind von
 *   uns umgerechnet - das steht deshalb im Vermerk.
 *
 * Reine Funktion: liest nichts, schreibt nichts. */

export const REGIO_URL = 'https://www.regionalstatistik.de/genesis/online?operation=table&code=';
export const LIZENZ_URL = 'https://www.govdata.de/dl-de/by-2-0';

const TABELLE_STANDARD = {
  bevoelkerung: '12411-01-01-4',
  einkommen: '82000-07-01-4',
  arbeitslosenquote: 'AI008-1',
  wanderung: 'AI002-1',
};

const zahl = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

export function makroKennzahlen(macroRaw, macro, agsInfo) {
  if (!macroRaw || !macroRaw.available || !macroRaw.metrics) return null;
  const m = macroRaw.metrics;
  const j = macroRaw.jahre || {};
  const t = Object.assign({}, TABELLE_STANDARD, macroRaw.tables_used || {});
  const bd = (macro && macro.breakdown) || {};
  const werte = [];

  const bev = zahl(m.bevoelkerung_trend);
  if (bev != null) werte.push({
    schluessel: 'bevoelkerung', label: 'Bevölkerungsentwicklung',
    wert: bev, einheit: '% p. a.', nachkomma: 2, vorzeichen: true,
    jahr: j.bevoelkerung ?? null, von_jahr: j.bevoelkerung_von ?? null,
    erlaeuterung: 'Durchschnitt pro Jahr aus dem Bevölkerungsstand',
    tabelle: t.bevoelkerung, teilscore: bd.bevoelkerung ?? null,
  });
  const alq = zahl(m.arbeitslosenquote);
  if (alq != null) werte.push({
    schluessel: 'arbeitslosigkeit', label: 'Arbeitslosenquote',
    wert: alq, einheit: '%', nachkomma: 1, vorzeichen: false,
    jahr: j.arbeitslosenquote ?? null, von_jahr: null,
    erlaeuterung: 'bezogen auf alle zivilen Erwerbspersonen',
    tabelle: t.arbeitslosenquote, teilscore: bd.arbeitslosigkeit ?? null,
  });
  const kk = zahl(m.kaufkraft_idx);
  if (kk != null) werte.push({
    schluessel: 'kaufkraft', label: 'Kaufkraftindex',
    wert: kk, einheit: '(Deutschland = 100)', nachkomma: 1, vorzeichen: false,
    jahr: j.kaufkraft ?? null, von_jahr: null,
    erlaeuterung: 'verfügbares Einkommen je Einwohner im Verhältnis zum Bundeswert desselben Jahres',
    tabelle: t.einkommen, teilscore: bd.kaufkraft ?? null,
  });
  const wan = zahl(m.wanderungssaldo);
  if (wan != null) werte.push({
    schluessel: 'wanderung', label: 'Wanderungssaldo',
    /* der Connector rechnet „je 10.000 EW" in % um (fuer den Score);
       gezeigt wird die amtliche Einheit */
    wert: Math.round(wan * 100 * 10) / 10, einheit: 'je 10.000 Einwohner', nachkomma: 1, vorzeichen: true,
    jahr: j.wanderung ?? null, von_jahr: null,
    erlaeuterung: 'Zuzüge minus Fortzüge',
    tabelle: t.wanderung, teilscore: bd.wanderung ?? null,
  });
  if (!werte.length) return null;

  /* v2517 · Ebene und Gebiet JE WERT: Bevoelkerung und Wanderung kommen,
     wo es sie gibt, aus der Gemeinde; Arbeitslosigkeit und Kaufkraft aus
     dem Kreis. Ein Wert ohne Ebenenangabe (Altbestand) ist ein Kreiswert. */
  const EB = { bevoelkerung: 'bevoelkerung', arbeitslosigkeit: 'arbeitslosenquote', kaufkraft: 'kaufkraft', wanderung: 'wanderung' };
  const eb = macroRaw.ebenen || {};
  const kreisName = (agsInfo && agsInfo.kreis_name) || macroRaw.kreis_name || null;
  for (const w of werte) {
    w.ebene = eb[EB[w.schluessel]] || 'Kreis';
    w.gebiet = w.ebene === 'Gemeinde' ? (macroRaw.gemeinde_name || null) : kreisName;
    if (w.schluessel === 'wanderung' && w.ebene === 'Gemeinde') {
      w.erlaeuterung = 'Zuzüge minus Fortzüge über die Gemeindegrenzen je 10.000 Einwohner, von DealPilot aus den Tabellen 12711-91-01-5 und 12411-01-01-5 gerechnet';
      w.tabellen = ['12711-91-01-5', '12411-01-01-5'];
    }
  }
  const tabellen = [...new Set(werte.flatMap((w) => w.tabellen || [w.tabelle]).filter(Boolean))];
  const vermerk = 'Datenquelle: © Statistische Ämter des Bundes und der Länder, ' + new Date().getFullYear()
    + ', Regionaldatenbank Deutschland, Tabelle' + (tabellen.length > 1 ? 'n ' : ' ') + tabellen.join(', ')
    + '. Bevölkerungsentwicklung, Kaufkraftindex und Wanderungssaldo von DealPilot aus den Tabellenwerten umgerechnet.';
  return {
    ebene: werte.some((w) => w.ebene === 'Gemeinde') ? 'Gemeinde und Kreis' : 'Kreis',
    kreis_ags: macroRaw.kreis_ags || (agsInfo && agsInfo.kreis_ags) || null,
    kreis_name: kreisName,
    gemeinde_ags: macroRaw.gemeinde_ags || null,
    gemeinde_name: macroRaw.gemeinde_name || null,
    herkunft: macroRaw.herkunft || 'regionaldatenbank-live',
    werte,
    quellennachweis: {
      vermerk,
      kennzahlen: werte.map((w) => w.label),
      lizenz: 'Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2-0), ' + LIZENZ_URL,
      lizenz_url: LIZENZ_URL,
      tabellen,
      urls: tabellen.map((c) => REGIO_URL + c),
      url: REGIO_URL + tabellen[0],
    },
  };
}
