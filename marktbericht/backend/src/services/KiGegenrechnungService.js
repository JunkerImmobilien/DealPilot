// KiGegenrechnungService.js — unabhaengige Zweitrechnung als Plausibilitaetsprobe.
// ────────────────────────────────────────────────────────────────────────────
// WAS DAS IST: eine zweite Meinung. Unsere Engine bleibt die Quelle des Werts —
// sie ist deterministisch, gegen Handrechnung geprueft und im PDF Zeile fuer
// Zeile nachvollziehbar. Das Modell rechnet unabhaengig daneben, und wir
// stellen beide gegenueber.
//
// WAS DAS NICHT IST: die Bewertung. Weichen beide ab, ist das ein Pruefsignal,
// kein Schiedsspruch. Der Modellwert wandert NIE in wert_parameter, nie in den
// Marktwert, nie in die Ertragswertzeile des Dossiers.
//
// WARUM ES TROTZDEM lohnt: den Verwaltungskosten-Fehler vom 01.08. — 2.330 EUR
// Verwaltung bei 7.506 EUR Rohertrag, weil die Einheiten des ganzen Hauses
// angesetzt wurden — haette eine Gegenrechnung sofort angezeigt.
//
// REPRODUZIERBARKEIT: Das Modell recherchiert NICHT. Alle Eingangsgroessen
// werden mitgeliefert: Bodenrichtwert amtlich mit Stichtag, Marktmiete aus
// segmentierten Vergleichsdaten, Liegenschaftszins mit seiner Herkunftsstufe.
// Fehlt etwas, soll das Modell es benennen statt es zu erfinden.

import { httpText } from '../lib/http.js';
import { cfg } from '../lib/config.js';

/* Das Schema, das wir erzwingen. Bewusst flach und vollstaendig — jede
 * Zwischengroesse einzeln, damit die Gegenueberstellung Zeile fuer Zeile
 * moeglich ist und nicht nur am Endergebnis haengt. */
const SCHEMA = `{
  "verfahrenswahl": { "fuehrend": "vergleich|ertrag|sach", "begruendung": "..." },
  "ertragswert": {
    "anwendbar": true,
    "rohertrag_jahr": 0,
    "bewirtschaftungskosten": { "verwaltung": 0, "instandhaltung": 0, "mietausfall": 0, "summe": 0 },
    "reinertrag": 0,
    "bodenwert": 0,
    "bodenwertverzinsung": 0,
    "gebaeudereinertrag": 0,
    "restnutzungsdauer": 0,
    "barwertfaktor": 0,
    "gebaeudeertragswert": 0,
    "ertragswert": 0
  },
  "sachwert": { "anwendbar": false, "begruendung": "...", "sachwert": null },
  "verkehrswert": { "wert": 0, "spanne_von": 0, "spanne_bis": 0, "begruendung": "..." },
  "annahmen": ["..."],
  "fehlende_angaben": ["..."],
  "unsicherheiten": ["..."]
}`;

export const KiGegenrechnungService = {

  /**
   * @param {object} ein   vollstaendige Eingangsgroessen (siehe baueEingabe)
   * @param {object} unser unser eigenes Ergebnis zum Vergleich
   */
  async rechne(ein, unser) {
    if (!cfg.ai.openaiKey) return { verfuegbar: false, grund: 'Kein OPENAI_API_KEY' };

    const anweisung = [
      'Du bist Immobilienbewerter und rechnest nach ImmoWertV 2021.',
      '',
      'WICHTIG: Recherchiere NICHTS. Alle Eingangsgroessen stehen unten. Fehlt eine',
      'Angabe, trage sie unter "fehlende_angaben" ein und rechne ohne sie weiter,',
      'soweit moeglich. Erfinde keine Bodenrichtwerte, Liegenschaftszinssaetze oder',
      'Marktmieten — auch dann nicht, wenn du meinst, den Wert zu kennen.',
      '',
      'Beachte:',
      '- Bewertet wird das angegebene Objekt. Bei einer Eigentumswohnung ist das EINE',
      '  Einheit; die Zahl der Wohneinheiten beschreibt das Gebaeude, nicht den',
      '  Bewertungsgegenstand. Verwaltungskosten gelten je bewerteter Einheit.',
      '- Rohertrag ist die marktueblich erzielbare Miete, nicht die Ist-Miete.',
      '- Das Sachwertverfahren ist fuer Eigentumswohnungen nicht anwendbar.',
      '- Bodenwert = Flaeche x Bodenrichtwert, bei Wohnungen anteilig ueber den',
      '  Miteigentumsanteil.',
      '',
      'Antworte AUSSCHLIESSLICH mit JSON in genau diesem Schema, ohne Markdown:',
      SCHEMA,
      '',
      '── EINGANGSGROESSEN ──',
      JSON.stringify(ein, null, 1),
    ].join('\n');

    let roh;
    try {
      const res = await httpText(cfg.ai.base + '/responses', {
        method: 'POST', timeoutMs: 90000, retries: 0,
        headers: { Authorization: 'Bearer ' + cfg.ai.openaiKey, 'Content-Type': 'application/json' },
        body: { model: cfg.ai.model, input: anweisung, temperature: 0 },
      });
      roh = res.text;
    } catch (e) {
      return { verfuegbar: false, grund: 'Anfrage fehlgeschlagen: ' + String(e.message).slice(0, 120) };
    }

    let d;
    try {
      const j = JSON.parse(roh);
      const txt = j.output_text || (Array.isArray(j.output)
        ? j.output.flatMap((o) => o.content || []).map((c) => c.text || '').join('') : '');
      d = JSON.parse(String(txt).replace(/```json|```/g, '').trim());
    } catch (e) {
      return { verfuegbar: false, grund: 'Antwort nicht auswertbar' };
    }

    return { verfuegbar: true, modell: cfg.ai.model, ergebnis: d, vergleich: vergleiche(d, unser) };
  },

  /** Eingangsgroessen aus ref, landValue und den Marktdaten zusammenstellen. */
  baueEingabe(ref, landValue, sale, rent, params) {
    const n = (v) => (v == null || v === '' ? null : Number(v));
    return {
      objekt: {
        objektart: ref.property_type || null,
        wohnflaeche_qm: n(ref.living_area),
        zimmer: n(ref.rooms),
        baujahr: n(ref.build_year),
        baustatus: ref.baustatus || 'bestand',
        zustand: ref.condition || null,
        ausstattung: ref.quality || null,
        energieklasse: ref.energy_class || null,
        etage: n(ref.floor),
        wohneinheiten_im_gebaeude: n(ref.units),
        stellplaetze: (n(ref.garages) || 0) + (n(ref.outdoor_parking) || 0),
        grundstuecksflaeche_qm: n(ref.plot_area),
        miteigentumsanteil_pct: n(ref.mea_pct),
      },
      bodenrichtwert: landValue && landValue.available ? {
        eur_pro_qm: n(landValue.value_sqm),
        stichtag: landValue.stichtag || null,
        quelle: landValue.source || null,
        zone: landValue.zone || null,
      } : { hinweis: 'kein amtlicher Bodenrichtwert verfuegbar' },
      markt: {
        kaufpreis_median_eur_qm: sale ? n(sale.median_per_sqm) : null,
        kaufpreis_q25_eur_qm: sale ? n(sale.q25_per_sqm) : null,
        kaufpreis_q75_eur_qm: sale ? n(sale.q75_per_sqm) : null,
        vergleichsfaelle: sale ? n(sale.sample_size) : null,
        marktmiete_median_eur_qm: rent ? n(rent.median_per_sqm) : null,
        segmentierung: sale && sale.segmentierung ? sale.segmentierung : null,
      },
      parameter: {
        liegenschaftszins_pct: params ? n(params.lzs_pct) : null,
        liegenschaftszins_herkunft: params ? (params.lzs_stufe || params.lzs_quelle) : null,
      },
      kaufpreis_eur: n(ref.purchase_price),
      ist_kaltmiete_monat_eur: n(ref.monthly_net_rent),
    };
  },
};

/* Gegenueberstellung. Wir bewerten nicht, wer recht hat — wir zeigen, wo es
 * auseinandergeht, und ab welcher Abweichung jemand hinsehen sollte. */
function vergleiche(ki, unser) {
  if (!unser || !unser.ertragswert || !unser.ertragswert.available) {
    return { moeglich: false, grund: 'kein eigener Ertragswert zum Vergleich' };
  }
  const u = unser.ertragswert;
  const k = ki.ertragswert || {};
  const hol = (t) => { const r = (u.staffel || []).find((s) => s.pos.indexOf(t) >= 0); return r ? Math.abs(r.wert) : null; };

  const zeilen = [
    { pos: 'Rohertrag', unser: hol('= Rohertrag'), ki: k.rohertrag_jahr },
    { pos: 'Bewirtschaftungskosten', unser: u.bwk_pa_eur, ki: k.bewirtschaftungskosten && k.bewirtschaftungskosten.summe },
    { pos: 'Reinertrag', unser: u.reinertrag_pa_eur, ki: k.reinertrag },
    { pos: 'Bodenwert', unser: u.bodenwert_eur, ki: k.bodenwert },
    { pos: 'Restnutzungsdauer', unser: u.restnutzungsdauer_jahre, ki: k.restnutzungsdauer },
    { pos: 'Barwertfaktor', unser: u.vervielfaeltiger, ki: k.barwertfaktor },
    { pos: 'Ertragswert', unser: u.value_eur, ki: k.ertragswert },
    /* WGEG26-1 · Sachwert mitvergleichen, wo er ueberhaupt anwendbar ist. */
    { pos: 'Sachwert', unser: (unser.sachwert && unser.sachwert.value_eur) || null,
      ki: (ki.sachwert && ki.sachwert.sachwert) || null },
  ].map((z) => {
    const a = Number(z.unser), b = Number(z.ki);
    const abw = (Number.isFinite(a) && Number.isFinite(b) && a !== 0)
      ? Math.round(((b - a) / Math.abs(a)) * 1000) / 10 : null;
    return { ...z, abweichung_pct: abw, auffaellig: abw != null && Math.abs(abw) > 10 };
  });

  const auff = zeilen.filter((z) => z.auffaellig);
  return {
    moeglich: true,
    zeilen,
    auffaellige: auff.map((z) => z.pos),
    urteil: !auff.length
      ? 'Beide Rechnungen stimmen in allen Zwischengroessen ueberein.'
      : 'Abweichung bei: ' + auff.map((z) => z.pos + ' (' + z.abweichung_pct + ' %)').join(', ')
        + '. Das ist ein Pruefsignal, keine Korrektur — der Bericht rechnet unveraendert mit der eigenen Engine.',
  };
}
