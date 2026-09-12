// ReportGenerationService.js — erzeugt den Bericht-Text.
// mode 'stub'  -> deterministisches Markdown-Template aus dem Payload (kein API-Call)
// mode 'openai'-> echter Chat-Completion-Call mit report_prompt.txt als System-Prompt
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cfg, aiEnabled } from '../lib/config.js';
import { httpJson } from '../lib/http.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT = fs.readFileSync(path.join(__dirname, 'report_prompt.txt'), 'utf8');

function fmt(n, suffix = '') {
  if (n == null || isNaN(n)) return 'keine Daten';
  return new Intl.NumberFormat('de-DE').format(n) + suffix;
}

function stubReport(p) {
  const a = p.address || {};
  const v = p.valuation || {};
  const mv = v.market_value || {};
  const y = v.yield || {};
  const sale = p.sale || {};
  const rent = p.rent || {};
  const ds = p.deal_score || {};
  const micro = p.micro || {};
  const macro = p.macro || {};

  return `# Immobilien-Marktbericht

## A) Executive Summary
Objekt in **${a.city || 'unbekannt'}** (${a.postcode || ''}), ${p.ref.property_type || 'Objekt'},
${fmt(p.ref.living_area, ' m²')}. Geschätzter Marktwert: **${fmt(mv.estimated, ' €')}**
(Spanne ${fmt(mv.low, ' €')} – ${fmt(mv.high, ' €')}, Konfidenz ${mv.confidence ?? 'n/a'}).
${mv.confidence_pct != null ? `Aussagekraft der Indikation: **${mv.confidence_label} · ${mv.confidence_pct} %**${mv.input_filled != null ? ` (${mv.input_filled}/${mv.input_total} wertrelevante Objektangaben)` : ''}.${mv.input_missing && mv.input_missing.length ? ` Genauer wird die Bewertung mit: ${mv.input_missing.join(', ')}.` : ''}
` : ''}Deal-Score: **${ds.score ?? 'n/a'}/100 (${ds.rating || 'n/a'})**.

## B) Standortübersicht
Adresse: ${a.formatted || p.ref.address || 'n/a'}. Koordinaten: ${p.ref.lat?.toFixed?.(5)}, ${p.ref.lon?.toFixed?.(5)}.

## C) Makrolage
Makro-Score: **${macro.score ?? 'n/a'}/100**${macro.estimated ? ' (geschätzt, neutraler Default)' : ''}.
${macro.note || ''}

## D) Mikrolage
Mikro-Score: **${micro.score ?? 'n/a'}/100** (Quelle: ${micro.source || 'n/a'}).
${micro.categories ? Object.entries(micro.categories).map(([k, c]) =>
  `- ${k}: nächste ${c.nearest_m != null ? c.nearest_m + ' m' : 'keine'} (${c.count} im Umkreis)`).join('\n') : ''}
${p.assessment ? `
## D2) Lage- und Potenzialbewertung
${[
  ['Mikrolage', p.assessment.mikrolage],
  ['Makrolage', p.assessment.makrolage],
  ['Bevölkerungsentwicklung', p.assessment.bevoelkerung],
  ['Nachfrage', p.assessment.nachfrage],
  ['Entwicklungsmöglichkeiten', p.assessment.entwicklung],
  ['Wertsteigerungspotenzial', p.assessment.wertsteigerung],
  ['Mietausfallrisiko', p.assessment.mietausfallrisiko],
].filter(([, v]) => v != null && v !== '').map(([k, v]) => `- **${k}:** ${v}`).join('\n')}
${p.assessment.marktmiete_eur_qm != null ? `\nEingeschätzte Marktmiete: **${p.assessment.marktmiete_eur_qm} €/m²**` : ''}${p.assessment.marktfaktor != null ? `, Marktfaktor: **${p.assessment.marktfaktor}**` : ''}
` : ''}
${p.marktkontext ? `
## D3) Marktkontext (GeoMap-Aggregate, 12 Monate, Radius ${p.marktkontext.radiusKm} km)
${p.marktkontext.segment === 'gewerbe' ? [
  `Segment: **Gewerbe / ${p.marktkontext.klasse}**`,
  p.marktkontext.kauf ? `- Kauf eigene Klasse: **${fmt(p.marktkontext.kauf.klasse_median_sqm, ' €/m²')}** (n=${p.marktkontext.kauf.klasse_n ?? 0}), gesamter Gewerbemarkt: ${fmt(p.marktkontext.kauf.markt_median_sqm, ' €/m²')} (n=${p.marktkontext.kauf.markt_n ?? 0})${p.marktkontext.kauf.abstand_pct != null ? ` — Abstand ${p.marktkontext.kauf.abstand_pct.toFixed(1)} %` : ''}` : null,
  p.marktkontext.miete ? `- Miete eigene Klasse: **${fmt(p.marktkontext.miete.klasse_median_sqm, ' €/m²')}** (n=${p.marktkontext.miete.klasse_n ?? 0}), gesamter Gewerbemarkt: ${fmt(p.marktkontext.miete.markt_median_sqm, ' €/m²')} (n=${p.marktkontext.miete.markt_n ?? 0})` : null,
  p.marktkontext.rendite ? `- Angebotsrendite im Segment: **${p.marktkontext.rendite.median_pct} %** (Q25 ${p.marktkontext.rendite.q25_pct} / Q75 ${p.marktkontext.rendite.q75_pct}, n=${p.marktkontext.rendite.n})` : null,
].filter(Boolean).join('\n') : [
  p.marktkontext.basis_median_sqm != null ? `Vergleichsbasis: ${fmt(p.marktkontext.basis_median_sqm, ' €/m²')} (n=${p.marktkontext.basis_n})` : null,
  p.marktkontext.vermietung ? `- **Vermietet gegen frei:** vermietet ${fmt(p.marktkontext.vermietung.vermietet_median_sqm, ' €/m²')} (n=${p.marktkontext.vermietung.vermietet_n}), frei ${fmt(p.marktkontext.vermietung.frei_median_sqm, ' €/m²')} (n=${p.marktkontext.vermietung.frei_n}) — Unterschied **${p.marktkontext.vermietung.abschlag_pct.toFixed(1)} %**. Für einen Kapitalanleger ist die vermietete Gruppe die passende Vergleichsbasis.` : null,
  p.marktkontext.energie ? `- **Energieklassen am Ort:** A–C ${fmt(p.marktkontext.energie.gut_median_sqm, ' €/m²')} (n=${p.marktkontext.energie.gut_n})${p.marktkontext.energie.mittel_median_sqm != null ? `, D–E ${fmt(p.marktkontext.energie.mittel_median_sqm, ' €/m²')} (n=${p.marktkontext.energie.mittel_n})` : ''}, F–H ${fmt(p.marktkontext.energie.schlecht_median_sqm, ' €/m²')} (n=${p.marktkontext.energie.schlecht_n}) — Spreizung **${p.marktkontext.energie.spreizung_pct.toFixed(1)} %**. Das ist der lokal gemessene Abschlag für einen schlechten Energieausweis, nicht ein Studienwert.` : null,
  p.marktkontext.rendite ? `- **Angebotsrendite am Ort:** Median **${p.marktkontext.rendite.median_pct} %** (Q25 ${p.marktkontext.rendite.q25_pct} / Q75 ${p.marktkontext.rendite.q75_pct}, n=${p.marktkontext.rendite.n}). Vergleiche die Bruttorendite des Objekts damit.` : null,
  p.marktkontext.erbbau_markt ? `- **Erbbaurecht am Markt:** ${fmt(p.marktkontext.erbbau_markt.median_sqm, ' €/m²')} (n=${p.marktkontext.erbbau_markt.n}, Anteil ${p.marktkontext.erbbau_markt.anteil_pct.toFixed(1)} % der Angebote), Abstand zur Basis **${p.marktkontext.erbbau_markt.abstand_pct.toFixed(1)} %**. ACHTUNG: Volltextsuche, kein Filter — ein Angebot mit „kein Erbbaurecht" wird mitgezählt. Signal, kein Beleg.` : null,
].filter(Boolean).join('\n')}
` : ''}${p.erbbaurecht && p.erbbaurecht.ok ? `
## D4) Erbbaurecht (§ 50 ImmoWertV)
Das Objekt steht auf einem Erbbaurechtsgrundstück. Der Marktwert oben ist ein
**Volleigentumswert** — kein Bewertungspartner nimmt den Parameter entgegen.
- Bodenwert (gehört dem Erbbaurechtsgeber): ${fmt(p.erbbaurecht.teile.bodenwert, ' €')}
- ${p.erbbaurecht.teile.zinsvorteil >= 0 ? 'Vorteil' : 'Nachteil'} aus dem Vertragszins: ${fmt(Math.abs(p.erbbaurecht.teile.zinsvorteil), ' €')} (angemessen ${p.erbbaurecht.annahmen.zinssatzAngemessen} %${p.erbbaurecht.annahmen.zinsQuelle ? `, örtlich erhoben: ${p.erbbaurecht.annahmen.zinsQuelle}` : ''})
- Nicht entschädigter Gebäudeanteil bei Zeitablauf: ${fmt(p.erbbaurecht.teile.heimfallabschlag, ' €')}
- **Erbbaurechtswert: ${fmt(p.erbbaurecht.erbbaurechtswert, ' €')} — Abschlag ${fmt(p.erbbaurecht.abschlag, ' €')} · ${p.erbbaurecht.abschlagPct.toFixed(1)} %**
${p.erbbaurecht.markt ? `Am Markt beobachtet bei ${p.erbbaurecht.markt.text}: ${p.erbbaurecht.markt.von}–${p.erbbaurecht.markt.bis} % — die Rechnung liegt ${p.erbbaurecht.markt.imRahmen ? 'darin' : 'daneben'}.` : ''}
${(p.erbbaurecht.hinweise || []).map((h) => `- ${h}`).join('\n')}
` : ''}
## E) Kaufpreisanalyse
Vergleichs-Kaufpreis Median: **${fmt(sale.median_per_sqm, ' €/m²')}**
(Q25 ${fmt(sale.q25_per_sqm)} / Q75 ${fmt(sale.q75_per_sqm)} €/m²).
Stichprobe: ${sale.sample_size ?? 0} Objekte, Radius ${sale.used_radius_m ?? '?'} m,
${sale.outliers_removed ?? 0} Ausreißer entfernt. Konfidenz: ${sale.confidence ?? 'n/a'}.
Objekt-Kaufpreis/m²: ${fmt(v.inputs?.price_per_sqm, ' €/m²')}.

## F) Mietanalyse
Vergleichsmiete Median: **${fmt(rent.median_per_sqm, ' €/m²')}**
(Q25 ${fmt(rent.q25_per_sqm)} / Q75 ${fmt(rent.q75_per_sqm)} €/m²).
Stichprobe: ${rent.sample_size ?? 0} Objekte. Konfidenz: ${rent.confidence ?? 'n/a'}.

## G) Mietentwicklung
${p.rent_trend_pct != null ? `Indikative Mietentwicklung: ${p.rent_trend_pct} %/Jahr.` :
  'Keine Zeitreihe verfügbar – Mietindex-Quelle (z. B. Mietspiegel/GeoMap) erforderlich.'}

## H) Kaufpreisentwicklung
${p.price_trend_pct != null ? `Indikative Kaufpreisentwicklung: ${p.price_trend_pct} %/Jahr.` :
  'Keine Zeitreihe verfügbar – Preisindex-Quelle erforderlich.'}

## I) Bodenrichtwertanalyse
${p.land_value && p.land_value.available
  ? (p.land_value.source === 'dealpilot-eingabe'
      ? `Bodenrichtwert (Angabe aus DealPilot): **${fmt(p.land_value.value_sqm, ' €/m²')}**. `
        + `Für diesen Standort liegt aktuell kein automatischer Amtsabruf vor; der Wert stammt aus der manuellen Eingabe. `
      : `Amtlicher Bodenrichtwert (${p.land_value.source}): **${fmt(p.land_value.value_sqm, ' €/m²')}**`
        + `${p.land_value.stichtag ? ` (Stichtag ${p.land_value.stichtag})` : ''}`
        + `${p.land_value.nutzung ? `, Nutzung: ${p.land_value.nutzung}` : ''}`
        + `${p.land_value.zone ? `, Zone ${p.land_value.zone}` : ''}.`
        + ` Quelle: Gutachterausschüsse${p.land_value.license ? ', ' + p.land_value.license : ''}. `)
    + `Der Bodenrichtwert bezieht sich auf unbebaute Grundstücke und ist kein Verkehrswert.`
  : `Kein Bodenrichtwert verfügbar${p.land_value && p.land_value.claimed_land ? ' (Land ' + p.land_value.claimed_land + ' noch nicht automatisch angebunden – manuelle Eingabe möglich)' : p.land_value && p.land_value.reason === 'land_nicht_unterstuetzt' ? ' (Bundesland noch nicht angebunden – manuelle Eingabe möglich)' : ''}.`}


## J) Vergleichsobjekte
${(sale.comparables || []).slice(0, 8).map((c) =>
  `- ${c.living_area} m², Bj. ${c.build_year}, ${c.condition}: ${fmt(c.price, ' €')} (${fmt(c.price_per_sqm, ' €/m²')}), ${c.distance_m} m`).join('\n') || 'Keine Vergleichsobjekte gefunden.'}

## K) Marktwertindikation
Geschätzter Marktwert: **${fmt(mv.estimated, ' €')}** (Spanne ${fmt(mv.low)} – ${fmt(mv.high)} €).
Basis: Median ${fmt(mv.basis_median_sqm, ' €/m²')} × Fläche × Faktoren
(${v.factors ? Object.entries(v.factors).map(([k, val]) => `${k}=${val}`).join(', ') : 'n/a'}).
${mv.discount_to_market_pct != null ? `Abweichung Kaufpreis ggü. Marktwert: ${mv.discount_to_market_pct} % ${mv.discount_to_market_pct > 0 ? '(unter Marktwert)' : '(über Marktwert)'}.` : ''}

## L) Renditeanalyse
Jahresnettokaltmiete: ${fmt(y.annual_net_rent, ' €')}.
Bruttomietrendite: **${y.gross_yield_pct ?? 'n/a'} %**. Kaufpreisfaktor: ${y.rent_multiplier ?? 'n/a'}.

## M) Chancen und Risiken
- Chance: ${mv.discount_to_market_pct > 0 ? 'Kauf unter Marktwert.' : 'Lagequalität laut Mikro-Score.'}
- Risiko: ${sale.confidence != null && sale.confidence < 0.5 ? 'Geringe Datenkonfidenz – Werte mit Vorsicht.' : 'Marktzins-/Mietausfallrisiko allgemein.'}

## N) Prognose 3–5 Jahre
Ohne angebundene Zeitreihen (Destatis/Mietspiegel/Preisindex) nur qualitativ:
abhängig von Makrolage-Score (${macro.score ?? 'n/a'}) und Mikrolage (${micro.score ?? 'n/a'}).

## O) Fazit und Empfehlung
Deal-Score **${ds.score ?? 'n/a'}/100 (${ds.rating || 'n/a'})**.
Empfehlung: ${ds.score >= 60 ? '**Kaufen / näher prüfen**' : ds.score >= 45 ? '**Beobachten**' : '**Eher meiden**'}.
_Hinweis: Stub-Modus (kein KI-Text). Für narrativen Bericht REPORT_AI_MODE=openai setzen._
`;
}

export const ReportGenerationService = {
  async generate(payload, opts = {}) {
    if (aiEnabled()) {
      try {
        const text = await callOpenAI(payload, opts);
        return { mode: 'openai', report_md: text };
      } catch (e) {
        // Fallback auf Stub bei API-Fehler, Bericht crasht nicht
        return { mode: 'stub_fallback', report_md: stubReport(payload),
                 error: `OpenAI-Fehler: ${e.message}` };
      }
    }
    return { mode: 'stub', report_md: stubReport(payload) };
  },
};

// V-PERF: Bericht in MEHREREN KURZEN Calls PARALLEL erzeugen (nicht 1 langer Call).
// 3 gleichmaessig balancierte Kapitelgruppen (5/5/6) -> 1 Anfrage weniger als zuvor (war 4),
// weiterhin parallel -> Wall-Clock = langsamste Gruppe. Reihenfolge A..P bleibt fix.
const CHAPTER_GROUPS = [
  { id: 'g1', titel: 'Zusammenfassung & Empfehlung', kapitel: ['A) Zusammenfassung & Empfehlung'] },
  { id: 'g2', titel: 'Objekt, Lage & Markt', kapitel: ['B) Objekt, Lage & Markt'] },
  { id: 'g3', titel: 'Bewertung, Rendite & Ausblick', kapitel: ['C) Bewertung, Rendite & Ausblick'] },
];

/* v960-chapterguard
 * ────────────────────────────────────────────────────────────────────────────
 * Die Kapitelgrenze stand bisher NUR im Prompt ("ERZEUGE JETZT AUSSCHLIESSLICH
 * DIESE KAPITEL ... Keine weiteren Kapitel"). Geprueft hat sie niemand.
 * Im Prod-Bericht vom 17.7. hatten sich zwei von drei Gruppen nicht daran
 * gehalten und je den GANZEN Bericht geschrieben:
 *     g1 -> A B C ·  g2 -> B ·  g3 -> A B C
 * merged = A B C B A B C  -> der Mandant bekommt den Bericht dreifach
 * verschraenkt, mit sich widersprechenden Aussagen ("niedrige Aussagekraft"
 * auf Seite 6, "umfassend und zuverlaessig" auf Seite 7).
 *
 * Ein Prompt ist eine Bitte, keine Zusicherung. Was zaehlt, entscheidet der Code.
 *
 * Konservativ: findet der Filter das erwartete Kapitel nicht, bleibt die
 * Antwort unveraendert. Der Filter kann Doppelungen entfernen — nie ein
 * Kapitel verlieren.
 */
function keepOnlyChapters(md, kapitel) {
  const want = new Set(
    (kapitel || [])
      .map((k) => (String(k).match(/^\s*([A-Z])\)/) || [])[1])
      .filter(Boolean),
  );
  if (!want.size) return md;

  const HD = /^\s{0,3}#{1,6}\s*([A-Z])\)/;
  const lines = String(md).split(/\r?\n/);
  const out = [];
  let keep = false, sawWanted = false;

  for (const ln of lines) {
    const m = ln.match(HD);
    if (m) keep = want.has(m[1]);
    if (keep) { out.push(ln); if (m) sawWanted = true; }
  }

  if (!sawWanted) return md; // Modell hat das Kapitel nicht als Ueberschrift gesetzt -> nichts anfassen
  return out.join('\n').trim();
}

async function callOpenAI(payload, opts = {}) {
  const onStep = (typeof opts.onStep === 'function') ? opts.onStep : () => {};
  const userJson = 'STRUKTURIERTE DATEN (JSON):\n\n' + JSON.stringify(payload, null, 2);
  console.log(`[openai] split-call model=${cfg.ai.model} groups=${CHAPTER_GROUPS.length}`);
  onStep(`report: ${CHAPTER_GROUPS.length} Kapitelgruppen werden parallel geschrieben…`);
  const tStart = Date.now();

  const settled = await Promise.allSettled(CHAPTER_GROUPS.map(async (g) => {
    const headings = g.kapitel.map((k) => '# ' + k).join('\n');
    // Der Zusammenfassungs-Gruppe (Kapitel A) gezielt die Aussagekraft/Konfidenz mitgeben,
    // damit der Bericht damit eroeffnet und fehlende Angaben als Empfehlung nennt.
    let extra = '';
    if (g.id === 'g1') {
      const mvc = (payload.valuation && payload.valuation.market_value) || {};
      const ns = (payload.sale && payload.sale.sample_size) || null;
      extra = `\n\nWICHTIG fuer "A) Executive Summary": Beginne mit einem Satz zur AUSSAGEKRAFT der `
        + `Marktwertindikation (Konfidenz ${mvc.confidence_pct ?? '?'} % – ${mvc.confidence_label ?? 'n/a'}`
        + `${ns ? ', gestuetzt auf ' + ns + ' Vergleichsangebote' : ''}`
        + `${mvc.input_filled != null ? ' und ' + mvc.input_filled + '/' + mvc.input_total + ' wertrelevante Objektangaben' : ''}). `
        + ((mvc.input_missing && mvc.input_missing.length)
          ? `Schliesse die Zusammenfassung mit einer kurzen Empfehlung: Folgende Angaben wuerden die Bewertung weiter praezisieren: ${mvc.input_missing.join(', ')}.`
          : `Alle wertrelevanten Objektangaben liegen vor – betone die hohe Belastbarkeit der Indikation.`);
    }
    /* ═══ v1323b · Der Marktkontext muss BENANNT werden ══════════════════
       Der ganze Payload geht ohnehin als JSON an das Modell — `marktkontext`
       und `erbbaurecht` sind also da. Nur: ein Feld im JSON ist noch keine
       Anweisung. Gemessen am Bericht vom 12.09.2026 — die Zahlen standen
       drin und kamen im Text nicht vor.

       Die Gruppen g2 (Objekt, Lage & Markt) und g3 (Bewertung, Rendite &
       Ausblick) sind die Orte, an denen sie hingehören: g2 ordnet den Ort
       ein, g3 die Zahlen. */
    if ((g.id === 'g2' || g.id === 'g3') && payload.marktkontext) {
      const mk = payload.marktkontext;
      const teile = [];
      if (mk.segment === 'gewerbe') {
        if (mk.kauf && mk.kauf.klasse_median_sqm != null) {
          teile.push(`Kaufpreisniveau der eigenen Gewerbeklasse (${mk.klasse}): ${fmt(mk.kauf.klasse_median_sqm, ' EUR/m2')} bei ${mk.kauf.klasse_n} Angeboten`
            + (mk.kauf.markt_median_sqm != null ? `, gesamter Gewerbemarkt ${fmt(mk.kauf.markt_median_sqm, ' EUR/m2')}` : ''));
        }
        if (mk.miete && mk.miete.klasse_median_sqm != null) {
          teile.push(`Mietniveau der eigenen Klasse: ${fmt(mk.miete.klasse_median_sqm, ' EUR/m2')} bei ${mk.miete.klasse_n} Angeboten`);
        }
      } else {
        if (mk.vermietung) {
          teile.push(`vermietete Wohnungen liegen bei ${fmt(mk.vermietung.vermietet_median_sqm, ' EUR/m2')} (${mk.vermietung.vermietet_n} Angebote), freie bei ${fmt(mk.vermietung.frei_median_sqm, ' EUR/m2')} (${mk.vermietung.frei_n}) — Unterschied ${mk.vermietung.abschlag_pct.toFixed(1)} %`);
        }
        if (mk.energie) {
          teile.push(`Energieklassen A-C ${fmt(mk.energie.gut_median_sqm, ' EUR/m2')} gegen F-H ${fmt(mk.energie.schlecht_median_sqm, ' EUR/m2')} — Spreizung ${mk.energie.spreizung_pct.toFixed(1)} % (oertlich GEMESSEN, kein Studienwert)`);
        }
      }
      if (mk.rendite) {
        teile.push(`Angebotsrendite am Ort: Median ${mk.rendite.median_pct} % (Q25 ${mk.rendite.q25_pct}, Q75 ${mk.rendite.q75_pct}, ${mk.rendite.n} Angebote)`);
      }
      if (teile.length) {
        extra += `\n\nNUTZE DEN MARKTKONTEXT aus dem JSON-Feld "marktkontext" — das sind Aggregate `
          + `ECHTER Angebote im Umkreis von ${mk.radiusKm} km ueber 12 Monate, keine Schaetzung und keine `
          + `Selbsteinschaetzung des Investors. Konkret: ${teile.join('; ')}. `
          + `Nenne mindestens einen dieser Werte mit seiner Stichprobengroesse und ordne das Objekt dagegen ein. `
          + `Erfinde keine Zahl dazu.`;
      }
    }
    if (payload.erbbaurecht && payload.erbbaurecht.ok && (g.id === 'g1' || g.id === 'g3')) {
      const eb = payload.erbbaurecht;
      extra += `\n\nERBBAURECHT: Das Objekt steht auf einem Erbbaurechtsgrundstueck. Der ermittelte `
        + `Marktwert ist ein VOLLEIGENTUMSWERT — kein Bewertungspartner nimmt den Parameter entgegen. `
        + `Nach § 50 ImmoWertV betraegt der Abschlag ${fmt(eb.abschlag, ' EUR')} = ${eb.abschlagPct.toFixed(1)} %, `
        + `der Erbbaurechtswert also ${fmt(eb.erbbaurechtswert, ' EUR')} `
        + `(Bodenwert ${fmt(eb.teile.bodenwert, ' EUR')}, Restlaufzeit ${eb.annahmen.restlaufzeit} Jahre, `
        + `angemessener Erbbauzins ${eb.annahmen.zinssatzAngemessen} %`
        + `${eb.annahmen.zinsQuelle ? ' (oertlich erhoben)' : ''}). `
        + `DAS MUSS IM TEXT VORKOMMEN — es ist fuer Finanzierung und Wiederverkauf der wichtigste `
        + `Einzelfaktor an diesem Objekt.`
        + (eb.annahmen.restlaufzeit < 30 ? ` Unter 30 Jahren Restlaufzeit finanzieren die meisten Banken nicht mehr voll.` : '');
    }
    const userMsg =
      userJson +
      '\n\n---\nERZEUGE JETZT AUSSCHLIESSLICH DIESE KAPITEL – in genau dieser Reihenfolge und ' +
      'mit exakt diesen Markdown-Ueberschriften. Keine weiteren Kapitel, keine Vorrede, ' +
      'kein Codeblock drumherum. Schreibe jedes Kapitel als zusammenhaengenden Fliesstext ' +
      /* v895f-kurz */
      'DEUTLICH KUERZER als ueblich \u2014 hoechstens 4-6 Saetze pro Kapitel, insgesamt etwa halb so lang. ' +
      'Jede Aussage nur EINMAL (keine Wiederholungen; jede Ueberschrift nur einmal verwenden). KEINE Stichpunkte, ' +
      'KEINE Score-Zahlen wie "85/100" im Text, Zahlen in den Text einweben):\n' + headings + extra;
    const raw = await callOneGroup(userMsg);
    /* v960-chapterguard: die Gruppe liefert, was sie liefert — der Code
     * entscheidet, was davon uebernommen wird. Fremde Kapitel fliegen raus. */
    const md = keepOnlyChapters(raw, g.kapitel);
    if (md !== raw) {
      console.warn(`[openai] Gruppe ${g.id} lieferte fremde Kapitel mit `
        + `(${raw.length} -> ${md.length} Zeichen) — verworfen.`);
    }
    onStep(`report: "${g.titel}" fertig`);
    return { id: g.id, md };
  }));

  // Robust: einzelne fehlgeschlagene/leere Gruppe darf NICHT den ganzen Bericht kippen.
  const okById = {};
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled' && s.value && s.value.md) okById[s.value.id] = s.value.md;
    else { console.warn(`[openai] Gruppe ${CHAPTER_GROUPS[i].id} leer/fehler`); onStep(`report: "${CHAPTER_GROUPS[i].titel}" fehlgeschlagen`); }
  });

  const merged = CHAPTER_GROUPS
    .map((g) => okById[g.id] || '')
    .map((s) => String(s).trim())
    .filter(Boolean)
    .join('\n\n');

  console.log(`[openai] ${Object.keys(okById).length}/${CHAPTER_GROUPS.length} Gruppen ok nach ${Date.now() - tStart}ms`);
  if (!merged) throw new Error('Leere OpenAI-Antwort (alle Gruppen)');
  return merged;
}

async function callOneGroup(userMsg) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMsg },
  ];
  const isNewModel = /^(gpt-5|o\d|gpt-4\.1)/.test(cfg.ai.model || '');
  const isReasoningModel = /^(gpt-5|o\d)/.test(cfg.ai.model || ''); // 4.1-Familie kennt KEIN reasoning_effort
  const maxTok = parseInt(process.env.OPENAI_MAX_TOKENS_PER_GROUP || '1800', 10); /* v895f-kurz */
  // 'low' ist bei gpt-5.5 gueltig ('minimal' NICHT -> 400). Erlaubt: none|low|medium|high|xhigh.
  const effortEnv = (process.env.OPENAI_REASONING_EFFORT || 'low').trim().toLowerCase();

  // 1. Versuch: mit reasoning_effort (nur Reasoning-Modelle)
  let r = null, firstErr = null;
  try {
    r = await rawCompletion(messages, { maxTok, effort: isReasoningModel ? effortEnv : null, isNewModel });
  } catch (e) { firstErr = e; }

  // Selbstheilung: bei FEHLER (z.B. 400 'unsupported reasoning_effort') ODER leerem content
  // -> Retry OHNE effort + grosszuegigeres Budget.
  if ((firstErr || !r || !r.content) && isReasoningModel && effortEnv && effortEnv !== 'off') {
    console.warn(`[openai] 1. Versuch ${firstErr ? 'Fehler: ' + firstErr.message : 'leer (finish=' + r.finish + ')'} -> Retry ohne reasoning_effort`);
    r = await rawCompletion(messages, { maxTok: Math.max(maxTok, 8000), effort: null, isNewModel });
  }
  if (!r || !r.content) {
    if (firstErr) throw firstErr;
    throw new Error(`Leere OpenAI-Antwort (finish=${r ? r.finish : '?'}, usage=${JSON.stringify(r ? r.usage : {})})`);
  }
  return r.content;
}

// Ein einzelner Completion-Call. Gibt {content, finish, usage, error} zurueck (wirft nur bei Netz/HTTP).
async function rawCompletion(messages, { maxTok, effort, isNewModel } = {}) {
  const body = { model: cfg.ai.model, messages };
  if (isNewModel) {
    body.max_completion_tokens = maxTok;
    if (effort && effort !== 'off') body.reasoning_effort = effort; // minimal|low|medium|high
  } else {
    body.max_tokens = maxTok;
  }
  const data = await httpJson(`${cfg.ai.base}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.ai.openaiKey}` },
    body,
    timeoutMs: parseInt(process.env.OPENAI_TIMEOUT_MS || '120000', 10),
    retries: 0,
  });
  const choice = data?.choices?.[0];
  return { content: choice?.message?.content || '', finish: choice?.finish_reason || '?', usage: data?.usage || null };
}

// Diagnose: ein minimaler Completion-Call mit den aktuellen Settings -> zeigt finish_reason etc.
export async function openaiSelfCheck() {
  if (!aiEnabled()) return { configured: false, hinweis: 'REPORT_AI_MODE!=openai oder kein API-Key.' };
  const isNewModel = /^(gpt-5|o\d|gpt-4\.1)/.test(cfg.ai.model || '');
  const effort = (process.env.OPENAI_REASONING_EFFORT || 'low').trim().toLowerCase();
  const messages = [{ role: 'user', content: 'Antworte mit genau einem Satz: Warum ist eine gute Lage bei Immobilien wichtig?' }];
  try {
    const r = await rawCompletion(messages, { maxTok: parseInt(process.env.OPENAI_MAX_TOKENS_PER_GROUP || '6000', 10), effort: isNewModel ? effort : null, isNewModel });
    return { configured: true, model: cfg.ai.model, reasoning_effort: isNewModel ? (effort || '(keiner)') : '(n/a)',
             finish_reason: r.finish, content_len: (r.content || '').length, content_preview: (r.content || '').slice(0, 200), usage: r.usage,
             diagnose: r.content ? 'OK – Modell liefert Text.' : 'LEER trotz HTTP 200. finish_reason/usage beachten (oft reasoning_effort oder Token-Budget).' };
  } catch (e) {
    return { configured: true, model: cfg.ai.model, error: e.message,
             diagnose: 'HTTP-/Netzfehler. Wenn 400 zu reasoning_effort: OPENAI_REASONING_EFFORT=off setzen.' };
  }
}

/* v972b: kurzer, EHRLICHER Trend-Text aus den Verlaufsdaten. Reused rawCompletion(). */
export async function generateVerlaufText(payload) {
  if (!aiEnabled()) return { text: '', error: 'KI im mb-Backend nicht aktiv.' };
  const p = payload || {};
  const labels = p.labels || {};
  const series = Array.isArray(p.series) ? p.series : [];
  const metrics = Array.isArray(p.metrics) ? p.metrics : [];
  if (series.length < 2) return { text: '', error: 'Zu wenig Berichte.' };
  const lines = series.map((row, i) => {
    const parts = metrics.map((k) => (labels[k] || k) + '=' + (row[k] == null ? '-' : row[k]));
    return `Bericht ${i + 1} (${row.date || '?'}): ` + parts.join(', ');
  }).join('\n');
  const sys = 'Du bist ein nuechterner Immobilien-Analyst. Fasse die Entwicklung der Marktberichte eines Objekts in 3-5 Saetzen ehrlich zusammen. '
    + 'Sage klar, ob Kennzahlen STEIGEN, FALLEN, SCHWANKEN oder STABIL sind - erfinde keinen Trend, wenn die Werte nur schwanken. '
    + 'Nenne konkrete Zahlen (Marktwert, Score). Keine Anlageberatung, keine Ueberschrift, nur Fliesstext auf Deutsch.';
  const messages = [{ role: 'system', content: sys }, { role: 'user', content: 'Verlaufsdaten:\n' + lines }];
  const isNewModel = /^(gpt-5|o\d|gpt-4\.1)/.test(cfg.ai.model || '');
  const isReasoning = /^(gpt-5|o\d)/.test(cfg.ai.model || '');
  const effort = (process.env.OPENAI_REASONING_EFFORT || 'low').trim().toLowerCase();
  try {
    let r = await rawCompletion(messages, { maxTok: parseInt(process.env.OPENAI_MAX_TOKENS_PER_GROUP || '2000', 10), effort: isReasoning ? effort : null, isNewModel });
    if (!r.content) r = await rawCompletion(messages, { maxTok: 3000, effort: null, isNewModel });
    return { text: (r.content || '').trim() };
  } catch (e) { return { text: '', error: e.message }; }
}
