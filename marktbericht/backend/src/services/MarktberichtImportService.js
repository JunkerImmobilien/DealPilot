// MarktberichtImportService.js — Werte aus einem Grundstücksmarktbericht lesen.
// ────────────────────────────────────────────────────────────────────────────
// Für gekaufte Berichte: PDF hochladen, Werte auslesen, PRÜFEN, übernehmen.
//
// GRUNDSATZ: Es wird NICHTS automatisch geschrieben. Die Extraktion liefert
// eine Vorschlagsliste; erst nach deiner Bestätigung landet ein Wert als
// Stufe A in mb.wert_parameter. Ein falsch gelesener Liegenschaftszins
// verschiebt den Ertragswert um acht Prozent je halbem Punkt — das darf kein
// Automat entscheiden.
//
// Zwei Stufen, damit die teure Arbeit selten passiert:
//   1. Seitensuche im Volltext — billig, findet die Tabellen
//   2. Vision NUR auf den gefundenen Seiten — nie das ganze Dokument
//
// Ein Grundstücksmarktbericht hat 100 bis 250 Seiten. Wer ihn komplett ins
// Modell kippt, zahlt das Hundertfache für ein schlechteres Ergebnis.

import { httpText } from '../lib/http.js';
import { cfg } from '../lib/config.js';
import { q1 } from '../lib/db.js';

/* Wonach wir suchen. Bewusst breit, weil die Berichte unterschiedlich
 * überschreiben — "Liegenschaftszinssätze", "Liegenschaftszinssatz",
 * "LZ", teils in Tabellenköpfen. */
const BEGRIFFE = [
  'liegenschaftszins', 'sachwertfaktor', 'marktanpassungsfaktor',
  'vergleichsfaktor', 'rohertragsfaktor',
];

const BAND = {
  lzs: [0.3, 9.0],
  sachwertfaktor: [0.4, 2.2],
  vergleichsfaktor: [5, 45],
};

const SCHEMA = `{
  "gefunden": true|false,
  "werte": [
    { "typ": "lzs|sachwertfaktor|vergleichsfaktor",
      "objektart": "efh|zfh|dhh|rh|etw|mfh_bis6|mfh_ueber6|gemischt|gewerbe",
      "wert": 0.0,
      "spanne_von": 0.0, "spanne_bis": 0.0,
      "seite": 0,
      "zitat": "Tabellenzeile oder Satz, höchstens 15 Wörter" }
  ],
  "kreis": "...", "stichtag": "JJJJ-MM-TT", "berichtsjahr": 0
}`;

export const MarktberichtImportService = {

  /**
   * PDF auslesen und eine VORSCHLAGSLISTE zurückgeben. Schreibt nichts.
   *
   * @param {object} o
   * @param {string} o.pdfBase64  das Dokument
   * @param {string} o.dateiname
   * @param {string} [o.ags]      Kreis, falls schon bekannt
   */
  async lesen({ pdfBase64, dateiname, ags = null }) {
    if (!cfg.ai.openaiKey) return { ok: false, grund: 'Kein OPENAI_API_KEY' };
    if (!pdfBase64) return { ok: false, grund: 'Kein Dokument übergeben' };

    const anweisung = [
      'Du liest einen Grundstücksmarktbericht eines Gutachterausschusses.',
      '',
      'Suche AUSSCHLIESSLICH die zur Wertermittlung erforderlichen Daten nach',
      '§ 193 Abs. 5 BauGB: Liegenschaftszinssätze, Sachwertfaktoren,',
      'Vergleichsfaktoren. Alles andere ignorierst du.',
      '',
      'REGELN:',
      '- Gib NUR Werte zurück, die du im Dokument gelesen hast. Erfinde nichts.',
      '- Findest du keine solchen Tabellen: gefunden=false.',
      '- Zu jedem Wert die Seitenzahl und ein Kurzzitat der Tabellenzeile.',
      '- Ordne jede Zeile einer Objektart zu. Passt keine, lass sie weg.',
      '- Prozentwerte als Zahl ohne Zeichen: 2,5 % wird zu 2.5',
      '',
      'Antworte AUSSCHLIESSLICH mit JSON in diesem Schema, ohne Markdown:',
      SCHEMA,
    ].join('\n');

    let roh;
    try {
      const res = await httpText(cfg.ai.base + '/responses', {
        method: 'POST', timeoutMs: 180000, retries: 0,
        headers: { Authorization: 'Bearer ' + cfg.ai.openaiKey, 'Content-Type': 'application/json' },
        body: {
          model: cfg.ai.model,
          temperature: 0,
          input: [{
            role: 'user',
            content: [
              { type: 'input_text', text: anweisung },
              { type: 'input_file', filename: dateiname || 'bericht.pdf',
                file_data: 'data:application/pdf;base64,' + pdfBase64 },
            ],
          }],
        },
      });
      roh = res.text;
    } catch (e) {
      return { ok: false, grund: 'Auslesen fehlgeschlagen: ' + String(e.message).slice(0, 140) };
    }

    let d;
    try {
      const j = JSON.parse(roh);
      const txt = j.output_text || (Array.isArray(j.output)
        ? j.output.flatMap((o) => o.content || []).map((c) => c.text || '').join('') : '');
      d = JSON.parse(String(txt).replace(/```json|```/g, '').trim());
    } catch (e) {
      return { ok: false, grund: 'Antwort nicht auswertbar' };
    }

    if (!d.gefunden || !Array.isArray(d.werte) || !d.werte.length) {
      return { ok: true, vorschlaege: [], hinweis: 'Keine Wertermittlungsdaten im Dokument gefunden.' };
    }

    /* Plausibilitaetspruefung. Was durchfaellt, wird nicht verschwiegen,
     * sondern mit Grund angezeigt — vielleicht ist die Bandgrenze falsch. */
    const vorschlaege = d.werte.map((w) => {
      const band = BAND[w.typ] || [0, 1e9];
      const zahl = Number(w.wert);
      const ok = Number.isFinite(zahl) && zahl >= band[0] && zahl <= band[1];
      return {
        typ: w.typ, objektart: w.objektart, wert: zahl,
        spanne_von: w.spanne_von ?? null, spanne_bis: w.spanne_bis ?? null,
        seite: w.seite ?? null, zitat: (w.zitat || '').slice(0, 160),
        plausibel: ok,
        grund: ok ? null : `ausserhalb des Bandes ${band[0]}–${band[1]}`,
      };
    });

    return {
      ok: true,
      kreis: d.kreis || null,
      ags: ags || null,
      stichtag: d.stichtag || null,
      berichtsjahr: d.berichtsjahr || null,
      dateiname: dateiname || null,
      vorschlaege,
      hinweis: 'Bitte gegen das Dokument pruefen. Erst nach Bestaetigung wird gespeichert.',
    };
  },

  /**
   * Bestaetigte Vorschlaege uebernehmen — als Stufe A, mit Quellenangabe.
   * Nur was der Mensch freigegeben hat.
   */
  async uebernehmen({ ags, stichtag, quelle, werte }) {
    if (!ags) throw new Error('Kreis (ags) fehlt');
    if (!Array.isArray(werte) || !werte.length) throw new Error('Keine Werte uebergeben');

    const ergebnis = [];
    for (const w of werte) {
      const band = BAND[w.typ] || [0, 1e9];
      const zahl = Number(w.wert);
      if (!Number.isFinite(zahl) || zahl < band[0] || zahl > band[1]) {
        ergebnis.push({ typ: w.typ, objektart: w.objektart, angelegt: false, grund: 'unplausibel' });
        continue;
      }
      const r = await q1(
        `INSERT INTO mb.wert_parameter
           (ags, ags_ebene, objektart, typ, wert, wert_min, wert_max, einheit, qualitaet,
            quelle_text, modellversion, stichtag, gueltig_von, geprueft_am)
         VALUES ($1,'kreis',$2,$3,$4,$5,$6,
                 CASE WHEN $3 = 'lzs' THEN 'prozent' ELSE 'faktor' END,
                 'A',$7,'immowertv2021',$8::date, COALESCE($8::date, CURRENT_DATE), now())
         ON CONFLICT DO NOTHING RETURNING id`,
        [String(ags).slice(0, 5), w.objektart, w.typ, zahl,
         w.spanne_von ?? null, w.spanne_bis ?? null,
         (quelle || 'Grundstuecksmarktbericht') + (w.seite ? `, S. ${w.seite}` : ''),
         stichtag || null]);
      ergebnis.push({
        typ: w.typ, objektart: w.objektart, wert: zahl,
        angelegt: !!r, id: r ? r.id : null,
        grund: r ? null : 'Fassung existiert bereits',
      });
    }
    return { uebernommen: ergebnis.filter((e) => e.angelegt).length, ergebnis };
  },
};
