'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   services/gutachtenPreise.js — v3590 · DIE EINZIGE STELLE DER GUTACHTENPREISE

   VORLAEUFIG: Stand junker-immobilien.io/preise.html vom 16.11.2026. Wird ersetzt, sobald
   gutachten.org Preise liefert (Marcel fragt beim Partner an, ob Preise ueber die API mitkommen).
   Eine spaetere Preisquelle (Partner-API oder JSON-URL) tauscht NUR preisliste() hier aus —
   gutachtenAuftrag.preisBerechnen() und die Oberflaeche (GET /gutachterpartner/preise) lesen
   ausschliesslich ueber diese Funktion. Nirgends sonst stehen Preise.
   ═══════════════════════════════════════════════════════════════════════ */

const VORLAEUFIG = {
  vorlaeufig: true,
  hinweis_quelle: 'Vorläufige Preise (Stand junker-immobilien.io, 16.11.2026) – werden ersetzt, sobald gutachten.org Preise liefert.',
  quelle: 'https://junker-immobilien.io/preise.html',
  stand: '2026-11-16',
  steuer: 'Kleinunternehmer nach § 19 UStG – es wird keine Umsatzsteuer ausgewiesen, der Betrag ist der Endpreis.',
  /* Festpreise nach Wohn- bzw. Nutzflaeche, inkl. digitalem Versand; „bis“ einschliesslich */
  stufen: [
    { bis: 150, preis: 951, text: 'bis 150 m²' },
    { bis: 300, preis: 1070, text: '151–300 m²' },
    { bis: 500, preis: 1184, text: '301–500 m²' },
    { bis: 1000, preis: 1541, text: '501–1.000 m²' },
    { bis: 2500, preis: 2017, text: '1.001–2.500 m²' },
    { bis: null, preis: 2612, text: 'über 2.500 m², Sonderimmobilien und Portfolios' }
  ],
  hinweis_individuell: 'Ab 1.000 m² und bei Sonderimmobilien ist eine individuelle Kalkulation möglich.',
  besichtigung: {
    keine: { betrag: 0, text: 'ohne Besichtigung' },
    aussen: { betrag: 199, text: 'Außenbesichtigung', empfohlen: true, hinweis: 'stärkt die Akzeptanz beim Finanzamt' },
    innen_aussen: { betrag: 499, text: 'Innen- und Außenbesichtigung', hinweis: 'mit vollständiger Fotodokumentation' }
  },
  express: { betrag: 299, text: 'Expresszuschlag', hinweis: 'Fertigstellung binnen einer Woche' },
  bearbeitung: 'in der Regel 2–3 Wochen',
  /* Mengenrabatt: innerhalb eines Auftrags, Beauftragung binnen zwei Wochen. In DealPilot ist ein Auftrag
     ein Objekt — der Rabatt wird angezeigt, aber erst ab der Stueckzahl gerechnet. */
  mengenrabatt: [{ ab: 25, pct: 20 }, { ab: 10, pct: 15 }, { ab: 5, pct: 10 }],
  /* Rabattcodes (Marcel 16.11.2026). Gross-/Kleinschreibung egal. Nicht mit Mengenrabatt kombiniert:
     der hoehere gilt (vorlaeufig, Marcel kann anders entscheiden). */
  codes: { JUNKER5: { pct: 5, text: 'Rabattcode Junker5' } },
  /* Bezug des Rabatts: Honorar = Grundpreis + Zubuchungen (Seite sagt es nicht eindeutig — Rueckfrage an Marcel) */
  rabatt_bezug: 'Honorar einschließlich Zubuchungen',
  zahlung: 'Zahlung auf Rechnung nach Erhalt des Gutachtens.',
  skonto_vorkasse: 'Bei Vorkasse gewährt Junker Immobilien laut Preisliste 3 % Skonto auf den Gesamtbetrag.'
};

/** Die gueltige Preisliste. Heute die vorlaeufige Tabelle; spaeter z. B. aus der Partner-API (mit Zwischenspeicher). */
function preisliste() { return VORLAEUFIG; }

module.exports = { preisliste };
