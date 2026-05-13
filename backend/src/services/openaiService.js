'use strict';
/**
 * OpenAI-Service – server-seitiger KI-Analyse-Proxy mit Web-Search.
 *
 * Architektur:
 *  - Frontend ruft POST /api/v1/ai/analyze mit den Calc-KPIs + Lage-Infos
 *  - Backend baut Prompt, ruft OpenAI mit aktiviertem Web-Search-Tool auf
 *  - OpenAI recherchiert eigenständig zu Makrolage/Mikrolage/Mietspiegel/Demografie
 *  - Antwort wird als strukturiertes JSON zurückgegeben
 *
 * Voraussetzung: OPENAI_API_KEY in .env
 *
 * Modell: per ENV überschreibbar (OPENAI_DEFAULT_MODEL).
 *  Default 'gpt-4o-mini' – günstig, kann web_search.
 */

const config = require('../config');

const OPENAI_URL = 'https://api.openai.com/v1/responses';

/**
 * V25: Investment-Report-Prompt nach Marcels Vorgabe.
 * Liefert eine strukturierte Bewertung in 7 Abschnitten:
 *   1. Gesamtbewertung
 *   2. Stärken & Schwächen
 *   3. Risikoanalyse
 *   4. Szenario-Analyse (Worst/Best Case)
 *   5. Investor-Fit
 *   6. Klare Empfehlung (Kaufen / Prüfen / Nicht kaufen)
 *   7. DealPilot-Insight (Tool-Voice, prägnant)
 *
 * Web-Search bleibt aktiv für Lage-/Mietspiegel-Recherche.
 */
function buildPrompt(payload) {
  const o = payload.objekt || {};
  const k = payload.kennzahlen || {};
  const f = payload.finanzierung || {};
  const ds = payload.dealscore || {};

  // Kennzahlen sicher formatieren
  const fmtPct = (v, dec) => v == null ? '–' : (v * (Math.abs(v) > 1 ? 1 : 100)).toFixed(dec || 1) + ' %';
  const fmtNum = (v, dec) => v == null ? '–' : Number(v).toFixed(dec || 2);
  const fmtEur = (v) => v == null ? '–' : Math.round(Number(v)).toLocaleString('de-DE') + ' €';

  // Sub-Scores aus DealScore
  const cfScore   = ds.cf_score != null ? ds.cf_score : '–';
  const rdScore   = ds.rendite_score != null ? ds.rendite_score : '–';
  const ltvScore  = ds.ltv_score != null ? ds.ltv_score : '–';
  const dscrScore = ds.dscr_score != null ? ds.dscr_score : '–';
  const potScore  = ds.potenzial_score != null ? ds.potenzial_score : '–';
  const potDesc   = ds.potenzial_desc || (
    'Wertsteigerung ' + fmtPct(o.wertstg_pct, 1) +
    ', Mietsteigerung ' + fmtPct(o.mietstg_pct, 1)
  );

  const ortLine = [o.str, o.hnr, o.plz, o.ort].filter(Boolean).join(' ');

  return [
    'Du bist ein professioneller Immobilien-Investment-Analyst.',
    'Ich habe einen DealScore für eine Immobilie berechnet.',
    'Deine Aufgabe ist es, diesen Score nicht nur zu beschreiben,',
    'sondern eine fundierte Investment-Analyse zu erstellen.',
    '',
    '## DEALPILOT-BEWERTUNGSSKALA (verbindlich verwenden!)',
    'Halte dich strikt an diese Schwellwerte und an den unten formulierten Wortlaut.',
    'Vergleiche Werte NIE mit "Marktdurchschnitten" aus deinem Trainingsdatensatz,',
    'sondern ausschließlich mit dieser Skala:',
    '',
    'LTV (Loan to Value) — Beleihungsauslauf:',
    '',
    '🟢 SOLIDE — LTV unter 85 %:',
    '   Marktüblicher und bankenseitig meist gut darstellbarer Finanzierungsbereich',
    '   für Kapitalanleger in Deutschland. Bietet in der Regel eine solide Sicherheits-',
    '   reserve und gute Finanzierungskonditionen. Ein LTV zwischen 80–85 % gilt',
    '   ausdrücklich NICHT als „hoch", sondern als übliche Investmentfinanzierung.',
    '',
    '🟡 ERHÖHT — LTV zwischen 85 % und 100 %:',
    '   Erhöhte Fremdkapitalquote mit geringerer Sicherheitsreserve. Die Finanzierung',
    '   reagiert sensibler auf Marktveränderungen, Zinsanstiege oder Leerstand. Banken',
    '   prüfen solche Finanzierungen häufig strenger und Konditionen können sich',
    '   verschlechtern.',
    '',
    '🔴 KRITISCH — LTV über 100 %:',
    '   Sehr hohe bzw. vollständige Fremdfinanzierung mit erhöhter finanzieller',
    '   Belastung und geringer Absicherung. Bereits kleinere Marktwertverluste oder',
    '   unerwartete Kosten können die Finanzierung deutlich belasten. Anschluss-',
    '   finanzierungen und Nachbewertungen können problematisch werden.',
    '',
    'DSCR (Debt Service Coverage Ratio) — Schuldendienstdeckung:',
    '',
    '🔴 KRITISCH — DSCR unter 1,0:',
    '   Schuldendienst nicht durch Mieteinnahmen gedeckt. Der Investor muss aus',
    '   eigenem Einkommen zuschießen. Banken finanzieren das nur mit hohem Eigen-',
    '   kapital oder Zusatzsicherheiten — meist mit Zinsaufschlag.',
    '',
    '🟡 KNAPP — DSCR zwischen 1,0 und 1,2:',
    '   Bedienung gerade so gedeckt, der Puffer ist klein. Bei Mietausfällen,',
    '   Reparaturen oder Zinserhöhungen kann die Finanzierung schnell unter Druck',
    '   geraten.',
    '',
    '🟢 SOLIDE — DSCR ab 1,2:',
    '   Tilgung und Zins sind komfortabel gedeckt, ausreichender Puffer vorhanden.',
    '   Banken-Standard. Ab 1,5 gilt als sehr solide.',
    '',
    'WICHTIGE INSTRUKTIONEN:',
    '- Verwende die Begriffe „SOLIDE", „ERHÖHT", „KRITISCH" / „KNAPP" exakt wie oben.',
    '- Formuliere positiv-konkret: Ein LTV von 84 % ist SOLIDE und gehört in den',
    '  Stärken-Block, NICHT in die Risiken. Bezeichne diesen Bereich NIE als „hoch",',
    '  „relativ hoch" oder „erhöht" — das ist faktisch falsch und kontrastiert mit',
    '  unserer Skala.',
    '- Ein DSCR von 1,25 ist SOLIDE und damit eine STÄRKE, kein Risiko.',
    '- Wenn du die Skala-Texte in der Gesamtbewertung oder Risikoanalyse zitierst,',
    '  verwende den DealPilot-Wortlaut wörtlich oder zumindest sinngemäß identisch.',
    '',
    '## OBJEKT-DATEN',
    ortLine ? '- Adresse: ' + ortLine : '',
    o.objart ? '- Objektart: ' + o.objart : '',
    o.wfl ? '- Wohnfläche: ' + o.wfl + ' m²' : '',
    o.baujahr ? '- Baujahr: ' + o.baujahr : '',
    o.makrolage ? '- Makrolage (Selbstbewertung): ' + o.makrolage : '',
    o.mikrolage ? '- Mikrolage (Selbstbewertung): ' + o.mikrolage : '',
    '',
    '## INPUT-DATEN',
    '',
    'DealScore: ' + (ds.total != null ? ds.total : '–') + ' / 100',
    '',
    'Cashflow:',
    '- Monatlich: ' + fmtEur(k.cf_m),
    '- Score: ' + cfScore + ' / 100',
    '',
    'Rendite (NMR):',
    '- Prozent: ' + fmtPct(k.nmy, 2),
    '- Score: ' + rdScore + ' / 100',
    '',
    'LTV (Loan to Value):',
    '- Wert: ' + fmtPct(k.ltv != null && k.ltv > 1 ? k.ltv / 100 : k.ltv, 1) +
      '  → Einordnung nach DealPilot-Skala oben (NICHT mit Marktdurchschnitten vergleichen!)',
    '- Score: ' + ltvScore + ' / 100',
    '',
    'DSCR (Debt Service Coverage Ratio):',
    '- Wert: ' + fmtNum(k.dscr, 2) +
      '  → Einordnung nach DealPilot-Skala oben',
    '- Score: ' + dscrScore + ' / 100',
    '',
    'Potenzial (Wertsteigerung + Mietsteigerung):',
    '- Beschreibung: ' + potDesc,
    '- Score: ' + potScore + ' / 100',
    '',
    'Bruttomietrendite: ' + fmtPct(k.bmy, 2),
    'Kaufpreis: ' + fmtEur(k.kp),
    'Gesamtinvestition: ' + fmtEur(k.gi),
    'Eigenkapital: ' + fmtEur(k.ek),
    f.d1z_pct != null ? 'Sollzins D1: ' + Number(f.d1z_pct).toFixed(2) + ' %' : '',
    f.d1t_pct != null ? 'Tilgung D1: ' + Number(f.d1t_pct).toFixed(2) + ' %' : '',
    '',
    '## RECHERCHE-AUFTRAG',
    'Recherchiere im Web zu folgenden Punkten und nimm die Erkenntnisse in deine Analyse auf:',
    '1. Makrolage in ' + (o.ort || 'der Region') + ' (Wirtschaft, Demografie, Arbeitsmarkt)',
    '2. Mikrolage PLZ ' + (o.plz || '?') + ' (Stadtteil-Reputation, Infrastruktur)',
    '3. Lokaler Mietspiegel (€/m² Bestand vs. Neubau)',
    '4. Kaufpreisniveau für vergleichbare Objekte in der Region',
    '',
    '## AUFGABEN',
    '',
    '1. Gesamtbewertung (4-6 Sätze) → Ist das ein guter Deal oder nicht? Warum? Mit konkreten Zahlen.',
    '',
    '2. Stärken & Schwächen Analyse',
    '   → Nenne die 4-5 wichtigsten Stärken — jede mit konkreter Zahl/Begründung',
    '   → Nenne die 4-5 größten Risiken — jeweils erläutert',
    '',
    '3. Risikoanalyse (tiefergehend) — Bewerte explizit:',
    '   - Finanzierungsrisiko (LTV + DSCR) — WICHTIG: Wenn LTV < 85 % und DSCR >= 1,2,',
    '     stelle das als STÄRKE dar, nicht als Risiko. Erst ab den Schwellen oben spricht',
    '     man von Risiko. Bei soliden Werten kurz erwähnen "Finanzierung solide aufgestellt"',
    '     und stattdessen das Zinsänderungsrisiko (Anschlussfinanzierung) thematisieren.',
    '   - Cashflow-Stabilität',
    '   - Abhängigkeit von Annahmen',
    '',
    '4. Szenario-Analyse — Simuliere:',
    '   - Worst Case: Miete -10%, Zins +1%',
    '   - Best Case:  Miete +5%, Wertsteigerung über Erwartung',
    '   → Beschreibe ausführlich, wie sich der Deal qualitativ und quantitativ verändert',
    '',
    '5. Investor-Fit — Für wen ist der Deal geeignet?',
    '   - Cashflow-Investor?',
    '   - Wertsteigerungs-Investor?',
    '   - Sicherheitsorientiert?',
    '   → jeweils 2-3 Sätze Begründung mit Bezug auf Zahlen',
    '',
    '6. Klare Empfehlung — "Kaufen", "Prüfen", oder "Nicht kaufen" mit ausführlicher Begründung',
    '',
    '7. DealPilot Insight',
    '   → Professionelle Einschätzung wie von einem Investment-Tool',
    '   → 4-5 Sätze, fundiert und konkret',
    '',
    '8. Investmentbewertung — eine umfassende holistische Bewertung des Deals (8-12 Sätze).',
    '   Soll Rendite, Lage, Marktumfeld, Risiko und langfristige Perspektive verbinden.',
    '',
    '9. Verhandlungsempfehlung — konkrete Verhandlungsstrategie (8-12 Sätze).',
    '   Welche Argumente, welche Hebel, welcher Zielpreis, welche Kompromisse?',
    '',
    '10. Kaufpreis-Offerte — empfohlener Kaufpreis mit ausführlicher Begründung (5-7 Sätze)',
    '   plus 4-6 konkrete Argumente für die Verhandlung.',
    '',
    '11. Bankargumente — 5-7 ausführliche, fundierte Argumente zur Vorlage bei der Bank.',
    '   Jedes Argument 2-3 Sätze mit konkreten Zahlen aus dem Deal.',
    '',
    '## STIL',
    '- Klar, professionell, wie ein ausführlicher Investment-Report',
    '- Mit Zahlen aus dem Deal arbeiten — konkret werden',
    '- Wo immer möglich Bezüge zur Lage-Recherche herstellen',
    '- KEINE Markdown-Sterne (**fett** vermeiden), KEINE Listen-Bullets mit *',
    '- AUSFÜHRLICH schreiben — Marcel will fundierte Texte, keine Floskeln',
    '',
    '## ANTWORTFORMAT — strikt JSON, keine Markdown-Codeblöcke',
    'Antworte AUSSCHLIESSLICH mit folgendem JSON-Objekt:',
    '{',
    '  "gesamtbewertung": "4-6 Sätze, mit Zahlen",',
    '  "fazit_kurz": "Kaufen | Prüfen | Nicht kaufen",',
    '  "staerken":   ["Stärke 1 ausführlich mit Zahl", "Stärke 2", "Stärke 3", "Stärke 4", "Stärke 5"],',
    '  "risiken":    ["Risiko 1 ausführlich mit Zahl", "Risiko 2", "Risiko 3", "Risiko 4", "Risiko 5"],',
    '  "risikoanalyse": {',
    '    "finanzierungsrisiko": "Ausführliche Bewertung von LTV+DSCR, 4-5 Sätze",',
    '    "cashflow_stabilitaet": "Ausführliche Bewertung Cashflow-Stabilität, 4-5 Sätze",',
    '    "annahmen_abhaengigkeit": "Welche Annahmen sind kritisch? 4-5 Sätze"',
    '  },',
    '  "szenarien": {',
    '    "worst_case": "Miete -10%, Zins +1% — Folgen ausführlich qualitativ und quantitativ, 4-6 Sätze",',
    '    "best_case":  "Miete +5%, Wertsteigerung über Erwartung — Folgen ausführlich, 4-6 Sätze"',
    '  },',
    '  "investor_fit": {',
    '    "cashflow_investor":     "ja/nein/teilweise — Begründung mit Zahlen, 2-3 Sätze",',
    '    "wertsteigerungs_investor": "ja/nein/teilweise — Begründung mit Zahlen, 2-3 Sätze",',
    '    "sicherheitsorientiert": "ja/nein/teilweise — Begründung mit Zahlen, 2-3 Sätze"',
    '  },',
    '  "empfehlung": "Kaufen | Prüfen | Nicht kaufen",',
    '  "empfehlung_begruendung": "Ausführliche Begründung, 4-6 Sätze",',
    '  "dealpilot_insight": "Tool-Voice, 4-5 Sätze, fundiert",',
    '  "investmentbewertung": "Holistische Bewertung — 8-12 Sätze, mit Zahlen, Lage, Marktumfeld, Risiko, langfristige Perspektive",',
    '  "verhandlungsempfehlung": "Konkrete Verhandlungsstrategie — 8-12 Sätze: Argumente, Hebel, Zielpreis, Kompromisse",',
    '  "kaufpreis_offerte": {',
    '    "empfohlen": "Empfohlener Kaufpreis als Zahl mit € — z.B. 175.000 €",',
    '    "begruendung": "Warum dieser Preis? 5-7 Sätze mit Bezug auf Vergleichswerte und Marktlage",',
    '    "argumente": ["Argument 1 für die Verhandlung — ausführlich mit Zahl", "Argument 2", "Argument 3", "Argument 4", "Argument 5"]',
    '  },',
    '  "bankargumente": [',
    '    "Argument 1 zur Vorlage bei Bank — DSCR/LTV/Lage, 2-3 Sätze mit konkreten Zahlen",',
    '    "Argument 2",',
    '    "Argument 3",',
    '    "Argument 4",',
    '    "Argument 5"',
    '  ],',
    '  "makrolage_recherche": "Ausführlich recherchierte Fakten zur Makrolage, 4-6 Sätze",',
    '  "mikrolage_recherche": "Ausführlich recherchierte Fakten zur Mikrolage, 4-6 Sätze",',
    '  "mietspiegel_eur_qm":  "Recherchierter Wert €/m² oder null",',
    '  "kaufpreisniveau":     "Einordnung des Kaufpreises mit Vergleichswerten, 3-4 Sätze",',
    '  "quellen":             ["URL 1", "URL 2", "..."]',
    '}'
  ].filter(Boolean).join('\n');
}

/**
 * Ruft OpenAI Responses-API mit web_search-Tool auf.
 *
 * V26: Key-Priorität:
 *   1. Server-Key aus config.openai.apiKey (.env OPENAI_API_KEY)
 *   2. Falls nicht da: userApiKey aus opts (vom Frontend mitgeschickt)
 *   3. Sonst: 503 mit klarer Fehlermeldung
 *
 * User-Keys werden NIE geloggt oder persistiert — nur als Bearer-Token
 * an OpenAI weitergereicht.
 */
async function callOpenAI(prompt, opts) {
  opts = opts || {};
  const apiKey = config.openai.apiKey || opts.userApiKey || null;
  const keySource = config.openai.apiKey
    ? 'server'
    : (opts.userApiKey ? 'user' : 'none');

  if (!apiKey) {
    const err = new Error(
      'Kein OpenAI-API-Key verfügbar. Bitte entweder serverseitig OPENAI_API_KEY setzen ' +
      'oder einen persönlichen Key in den Einstellungen hinterlegen.'
    );
    err.code = 'NO_API_KEY';
    throw err;
  }

  const model = opts.model || config.openai.defaultModel;
  const body = {
    model: model,
    input: prompt,
    // V34: Output-Limit deutlich erhöht — die ausführlichen Texte aus V33
    // brauchen mehr Platz. Vorher Default (~4k) → JSON-Truncate.
    max_output_tokens: 8000,
    tools: [{ type: 'web_search_preview' }]
  };

  // V51/V62.3: Determinismus aus opts.aiOptions durchreichen, wenn vorhanden.
  // Bei temperature=0 → reproduzierbare Antworten.
  // V62.3: 'seed' wird NICHT mehr durchgereicht — die /v1/responses-API
  // unterstützt diesen Parameter nicht (gibt 400: Unknown parameter 'seed').
  // 'seed' war nur in der alten /v1/chat/completions-API gültig.
  if (opts.aiOptions) {
    if (opts.aiOptions.temperature != null) {
      body.temperature = Number(opts.aiOptions.temperature);
    }
    // 'seed' bewusst nicht setzen — siehe oben
  }

  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const txt = await resp.text();
    // Bei 401 vom OpenAI: Key ungültig — Source mitgeben damit Frontend zielgerichtet meldet
    if (resp.status === 401) {
      const err = new Error(
        keySource === 'user'
          ? 'Dein persönlicher OpenAI-Key ist ungültig oder abgelaufen. Bitte in den Einstellungen prüfen.'
          : 'Server-OpenAI-Key ist ungültig. Bitte Admin kontaktieren.'
      );
      err.status = 401;
      err.keySource = keySource;
      throw err;
    }
    const err = new Error('OpenAI API Fehler ' + resp.status + ': ' + txt.slice(0, 400));
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();

  // Antwort-Text extrahieren (Responses-API: output[].content[].text)
  let text = '';
  if (data.output_text) {
    text = data.output_text;
  } else if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === 'output_text' && c.text) text += c.text;
        }
      }
    }
  }
  if (!text) {
    throw new Error('OpenAI hat keinen Antworttext geliefert.');
  }
  return { text: text.trim(), raw: data, model: model };
}

/**
 * JSON aus dem Modell-Output robust parsen — auch wenn um den JSON-Block
 * Markdown-Fences oder Vorrede stehen.
 *
 * V34: Recovery-Logik — bei abgeschnittenem JSON (Output-Limit) wird
 * versucht, die fehlenden schließenden Klammern zu ergänzen, damit
 * der User wenigstens die teilweise Analyse sieht.
 */
function extractJson(text) {
  if (!text) return null;

  // 1) Markdown ```json ... ``` Block?
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch (e) { /* fallthrough */ }
  }

  // 2) Erste { ... } Klammer?
  const first = text.indexOf('{');
  const last  = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    const slice = text.slice(first, last + 1);
    try { return JSON.parse(slice); } catch (e) { /* fallthrough */ }
  }

  // 3) Direktes JSON
  try { return JSON.parse(text); } catch (e) { /* fallthrough */ }

  // 4) V34: Recovery — JSON ist abgeschnitten
  //    Wir suchen den letzten kompletten Wert und schließen dann brace/bracket-Stack.
  if (first >= 0) {
    const partial = text.slice(first);
    const recovered = _recoverTruncatedJson(partial);
    if (recovered) {
      try { return JSON.parse(recovered); } catch (e) { /* still fails */ }
    }
  }

  return null;
}

/**
 * V34: Versucht ein abgeschnittenes JSON zu reparieren, indem nicht-geschlossene
 * Strings, Arrays und Objects nachträglich geschlossen werden.
 * Best-effort — perfektes JSON ist nicht garantiert, aber besser als gar nichts.
 */
function _recoverTruncatedJson(text) {
  // Letzte vollständige Position finden — wir gehen rückwärts von Ende
  // und suchen die letzte Zeile, die mit Komma/Bracket schließt.
  let s = text;

  // Letztes Komma am Ende entfernen + alles dahinter (unvollständige Werte)
  // Wir scannen rückwärts: letzter Punkt wo wir sicher abschließen können
  let stack = []; // 'object' oder 'array'
  let inString = false;
  let escape = false;
  let lastSafeIdx = -1;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      if (stack.length && stack[stack.length - 1] === c) stack.pop();
    }
    // "Sicherer" Punkt: nach `,` oder `}` oder `]` außerhalb von Strings
    if (c === ',' || c === '}' || c === ']') lastSafeIdx = i;
  }

  // Wenn wir noch in einem String sind, schließen
  let result = s;
  if (inString) {
    // Bis zum letzten ", abschneiden
    if (lastSafeIdx > 0) result = s.slice(0, lastSafeIdx + 1);
    else return null;
    // Stack neu rechnen — vereinfacht: wir hängen einfach die Klammern an
    // (kann bei letztem Komma vor neuem Key dann doppelt schließen, deshalb Komma weg)
    if (result.endsWith(',')) result = result.slice(0, -1);
  } else if (lastSafeIdx > 0 && lastSafeIdx < s.length - 1) {
    // Nach lastSafeIdx kommt unvollständiger Content → abschneiden
    result = s.slice(0, lastSafeIdx + 1);
    if (result.endsWith(',')) result = result.slice(0, -1);
  }

  // Stack neu rechnen für das gekürzte Ergebnis
  stack = [];
  inString = false;
  escape = false;
  for (let i = 0; i < result.length; i++) {
    const c = result[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"' && !escape) { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      if (stack.length && stack[stack.length - 1] === c) stack.pop();
    }
  }

  // Stack umkehrt schließen
  while (stack.length) {
    result += stack.pop();
  }

  return result;
}

/**
 * High-level: Analyse mit Web-Search durchführen.
 *
 * V34: Logging gegen "wo ist mein Output hin"-Probleme.
 */
async function analyze(payload, opts) {
  const prompt = buildPrompt(payload);
  const r = await callOpenAI(prompt, opts);
  const parsed = extractJson(r.text);
  // V34: Lokales Logging — bei Parse-Fail Länge + Anfang/Ende für Debug
  if (!parsed) {
    console.warn('[openaiService] JSON-Parse fehlgeschlagen — Text-Länge:', (r.text || '').length);
    console.warn('[openaiService] Anfang:', (r.text || '').slice(0, 200));
    console.warn('[openaiService] Ende:',   (r.text || '').slice(-200));
  }
  return {
    success: true,
    model: r.model,
    analysis: parsed,
    raw_text: parsed ? null : r.text  // bei Parse-Fail Text zurückgeben für Debug
  };
}

/**
 * V36: Kompakte Lage-Bewertung (Makro + Mikro) für eine Adresse.
 * Kurzer Output, eigener Endpoint, eigenes JSON-Schema.
 */
async function analyzeLage(payload, opts) {
  const adresse = payload.adresse || [payload.str, payload.hnr, payload.plz, payload.ort].filter(Boolean).join(' ');
  if (!adresse) throw new Error('Keine Adresse übergeben');

  // V63.21: Style-Hinweis aus aiOptions zusammenbauen (Detailgrad, Tonalität, Fokus, Custom-Instructions)
  function _buildStyleBlock(aiOpts) {
    if (!aiOpts) return '';
    const parts = [];
    if (aiOpts.detailLevel) {
      const dlMap = {
        'kurz': 'Antworte sehr knapp — Stichpunkte, je 1 kurzer Satz pro Dimension.',
        'mittel': 'Antworte in mittlerer Länge — 1-2 vollständige Sätze pro Dimension.',
        'ausfuehrlich': 'Antworte ausführlich — 3-4 Sätze pro Dimension mit Begründung und Datenpunkten.'
      };
      if (dlMap[aiOpts.detailLevel]) parts.push(dlMap[aiOpts.detailLevel]);
    }
    if (aiOpts.tonality) {
      const tnMap = {
        'sachlich': 'Tonalität: streng sachlich-neutral, ohne Bewertungen.',
        'beratend': 'Tonalität: beratend mit konkreten Empfehlungen ("Empfehlenswert wenn ...").',
        'kritisch': 'Tonalität: kritisch — Risiken zuerst benennen, dann Chancen.'
      };
      if (tnMap[aiOpts.tonality]) parts.push(tnMap[aiOpts.tonality]);
    }
    if (Array.isArray(aiOpts.focusAreas) && aiOpts.focusAreas.length) {
      parts.push('Lege besonderen Fokus auf: ' + aiOpts.focusAreas.join(', ') + '.');
    }
    if (aiOpts.customInstructions && typeof aiOpts.customInstructions === 'string') {
      const ci = aiOpts.customInstructions.trim().slice(0, 500);
      if (ci) parts.push('Zusätzliche Anweisung des Nutzers: ' + ci);
    }
    if (!parts.length) return '';
    return '\n## STIL-VORGABEN\n' + parts.join('\n') + '\n';
  }
  const styleBlock = _buildStyleBlock(opts && opts.aiOptions);

  // V63.8: KI muss vordefinierte ENUM-Werte zurückgeben (passend zu den UI-Dropdowns)
  // statt frei numerisch zu erfinden. Pro Dimension Score 0-100 + Enum-Wert.
  const kpInfo = payload.kaufpreis ? '\nKaufpreis: ' + payload.kaufpreis.toLocaleString('de-DE') + ' €' : '';
  const wflInfo = payload.wohnflaeche ? '\nWohnfläche: ' + payload.wohnflaeche + ' m²' : '';
  const nkmInfo = payload.nettokaltmiete ? '\nNettokaltmiete: ' + payload.nettokaltmiete + ' €/Mon' : '';

  const prompt = [
    'Du bist Immobilien-Marktexperte. Bewerte umfassend die Lage und das Marktumfeld für folgendes Objekt:',
    '',
    'Adresse: ' + adresse + kpInfo + wflInfo + nkmInfo,
    styleBlock,
    '## AUFGABE',
    'Recherchiere und liefere eine fundierte Lage-Analyse mit 6 Dimensionen + Quellen + Deal-Bewertung.',
    'WICHTIG: Für jede Dimension MUSST du genau einen der unten aufgelisteten ENUM-Strings als "value" zurückgeben.',
    'Erfinde KEINE eigenen Werte. Erfinde KEINE freien Zahlen. Wähle exakt einen vorgegebenen String.',
    '',
    'DIMENSIONEN:',
    '',
    '1. makro (Makrolage = Stadt/Region: Bevölkerung, Wirtschaft, Arbeitsmarkt)',
    '   ENUM-Werte: "sehr_gut" | "gut" | "durchschnittlich" | "schwach" | "sehr_schwach"',
    '',
    '2. mikro (Mikrolage = Stadtteil: ÖPNV, Infrastruktur, Wohnumfeld)',
    '   ENUM-Werte: "sehr_gut" | "gut" | "durchschnittlich" | "schwach" | "sehr_schwach"',
    '',
    '3. bevoelkerung (Bevölkerungsentwicklung der Region)',
    '   ENUM-Werte: "stark_wachsend" | "wachsend" | "stabil" | "leicht_fallend" | "stark_fallend"',
    '',
    '4. nachfrage (Nachfrage-Indikatoren / Marktpuls)',
    '   ENUM-Werte: "sehr_stark" | "stark" | "mittel" | "schwach" | "sehr_schwach"',
    '',
    '5. wertsteigerung (mittelfristiges Wertsteigerungs-Potenzial)',
    '   ENUM-Werte: "sehr_hoch" | "hoch" | "mittel" | "niedrig" | "keines"',
    '',
    '6. entwicklung (Entwicklungs-Möglichkeiten / Stadtentwicklungs-Pläne)',
    '   ENUM-Werte: "mehrere" | "eine_starke" | "begrenzt" | "kaum" | "keine"',
    '',
    'Wenn ein Kaufpreis angegeben wurde: bewerte ZUSÄTZLICH ob der Kaufpreis im Marktumfeld realistisch / zu teuer / Schnäppchen ist.',
    '',
    'QUELLEN: Pro Dimension EINE primäre Quelle nennen (label + url) — z.B. "Statistisches Bundesamt", "ImmoScout24 Marktbericht 2026", "Mietspiegel <Stadt>". KEINE erfundenen URLs.',
    '',
    'Antwort STRIKT als JSON, keine Markdown-Codeblöcke:',
    '{',
    '  "makro": { "value": "gut", "text": "2-3 Sätze Begründung", "source": {"label":"Stat. Bundesamt","url":"https://..."} },',
    '  "mikro": { "value": "gut", "text": "2-3 Sätze", "source": {...} },',
    '  "bevoelkerung":   { "value": "stabil",      "text": "1-2 Sätze", "source": {...} },',
    '  "nachfrage":      { "value": "stark",       "text": "1-2 Sätze", "source": {...} },',
    '  "wertsteigerung": { "value": "hoch",        "text": "1-2 Sätze", "source": {...} },',
    '  "entwicklung":    { "value": "eine_starke", "text": "1-2 Sätze", "source": {...} }',
    '}'
  ].join('\n');

  const r = await callOpenAI(prompt, Object.assign({ maxTokens: 2500 }, opts || {}));
  const parsed = extractJson(r.text);
  if (!parsed) {
    return { success: false, error: 'KI-Antwort konnte nicht ausgewertet werden.', raw_text: r.text };
  }

  // V63.8: ENUM-Mapping → Score (für Score-Bar in der UI)
  const enumScoreMaps = {
    makro:          { sehr_gut: 90, gut: 75, durchschnittlich: 55, schwach: 35, sehr_schwach: 15 },
    mikro:          { sehr_gut: 90, gut: 75, durchschnittlich: 55, schwach: 35, sehr_schwach: 15 },
    bevoelkerung:   { stark_wachsend: 90, wachsend: 75, stabil: 55, leicht_fallend: 35, stark_fallend: 15 },
    nachfrage:      { sehr_stark: 90, stark: 75, mittel: 55, schwach: 35, sehr_schwach: 15 },
    wertsteigerung: { sehr_hoch: 90, hoch: 75, mittel: 55, niedrig: 35, keines: 15 },
    entwicklung:    { mehrere: 90, eine_starke: 75, begrenzt: 55, kaum: 35, keine: 15 }
  };
  function _enrich(dim, key) {
    const d = parsed[key];
    if (!d) return null;
    const map = enumScoreMaps[dim];
    const score = map && d.value && map[d.value] != null ? map[d.value] : null;
    return {
      value: d.value || null,
      score: score,
      label: _humanLabel(d.value),
      text: d.text || '',
      source: d.source || null
    };
  }
  function _humanLabel(v) {
    if (!v) return '';
    return v.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
  }

  return {
    success: true,
    model: r.model,
    adresse: adresse,
    makro:           _enrich('makro',          'makro'),
    mikro:           _enrich('mikro',          'mikro'),
    bevoelkerung:    _enrich('bevoelkerung',   'bevoelkerung'),
    nachfrage:       _enrich('nachfrage',      'nachfrage'),
    wertsteigerung:  _enrich('wertsteigerung', 'wertsteigerung'),
    entwicklung:     _enrich('entwicklung',    'entwicklung')
    // V63.9: deal_verdict (Kaufpreis-Bewertung) entfernt — User-Wunsch
  };
}

/**
 * V38: KI-Empfehlungen für DS2-Investor-Score-Felder.
 * Liefert pro Feld einen vorgeschlagenen Wert (passend zu den Enum-Optionen)
 * + kurze Begründung. Nutzt Web-Search für Lage/Markt-Recherche.
 */
async function suggestDs2Fields(payload, opts) {
  const { fields, fieldSpecs, context } = payload;
  const adresse = context.adresse || [context.strasse, context.hausnr, context.plz, context.ort]
    .filter(Boolean).join(' ');
  if (!adresse) throw new Error('Keine Adresse im Context');

  // Felder-Beschreibung für den Prompt
  const fieldDescs = fields.map(fid => {
    const spec = fieldSpecs[fid] || {};
    let line = '  - "' + fid + '" (' + (spec.label || fid) + ')';
    if (spec.values && Array.isArray(spec.values)) {
      line += ' — ENUM-Werte (genau einer dieser Strings): ' + JSON.stringify(spec.values);
    } else if (spec.type === 'number') {
      line += ' — Zahl' + (spec.unit ? ' in ' + spec.unit : '') + (spec.hint ? ' (' + spec.hint + ')' : '');
    }
    return line;
  }).join('\n');

  const prompt = [
    'Du bist Immobilien-Investmentexperte. Bewerte folgendes Objekt und gib für jedes angefragte Feld eine begründete Empfehlung.',
    '',
    'OBJEKT-KONTEXT:',
    '  Adresse: ' + adresse,
    context.objektart ? '  Objektart: ' + context.objektart : '',
    context.baujahr ? '  Baujahr: ' + context.baujahr : '',
    context.wohnflaeche ? '  Wohnfläche: ' + context.wohnflaeche + ' m²' : '',
    context.kaufpreis ? '  Kaufpreis: ' + context.kaufpreis.toLocaleString('de-DE') + ' €' : '',
    // V44: Immobilienwert (Bankbewertung > SV-Wert > Kaufpreis) für Lage-/Markt-Beurteilung
    context.bankbewertung ? '  Bankbewertung: ' + context.bankbewertung.toLocaleString('de-DE') + ' €' : '',
    context.sachverstaendigenwert ? '  Sachverständigenwert: ' + context.sachverstaendigenwert.toLocaleString('de-DE') + ' €' : '',
    context.nettokaltmiete ? '  Nettokaltmiete: ' + context.nettokaltmiete + ' €/Mon' : '',
    context.makrolage ? '  Makrolage (Selbstangabe): ' + context.makrolage : '',
    context.mikrolage ? '  Mikrolage (Selbstangabe): ' + context.mikrolage : '',
    '',
    'GESUCHTE FELDER:',
    fieldDescs,
    '',
    'AUFGABE:',
    'Recherchiere kurz für die Adresse (Bevölkerungsentwicklung, Marktmiete €/m², Nachfrage etc.) und gib für jedes Feld:',
    '  - "value": exakt einer der erlaubten ENUM-Werte (für Kategorien) ODER eine Zahl (für numerische Felder)',
    '  - "reasoning": kurze Begründung in 1 Satz, max 80 Zeichen',
    '  - "source": Quelle, z.B. "Mietspiegel Herford 2024", "Stat. Bundesamt", "regionale Marktberichte". Bei Unsicherheit: "KI-Marktbewertung". KEINE erfundenen URLs.',
    '',
    'WICHTIG:',
    '  - ENUM-Werte EXAKT so wie angegeben (keine Übersetzung, keine Kreativität)',
    '  - Bei Unsicherheit: konservativ, eher mittlere Kategorie wählen',
    '  - Wenn ein Feld nicht sinnvoll bestimmbar ist (z.B. weil Kontext fehlt): null als value',
    '  - Quellen NIEMALS frei erfinden. Wenn unsicher → "KI-Marktbewertung"',
    '',
    'Antwort STRIKT als JSON, KEIN Markdown:',
    '{',
    '  "suggestions": {',
    '    "ds2_zustand": { "value": "gut", "reasoning": "Baujahr 1997, vermutlich saniert", "source": "KI-Marktbewertung" },',
    '    "ds2_marktmiete": { "value": 9.5, "reasoning": "Mietspiegel Herford 2024", "source": "Mietspiegel Herford 2024" }',
    '  }',
    '}'
  ].filter(Boolean).join('\n');

  const r = await callOpenAI(prompt, Object.assign({ maxTokens: 2500 }, opts || {}));
  const parsed = extractJson(r.text);
  if (!parsed || !parsed.suggestions) {
    return { success: false, error: 'KI-Antwort konnte nicht ausgewertet werden.', raw_text: r.text };
  }

  // Validierung: ENUM-Werte gegen die Spec prüfen
  const cleaned = {};
  fields.forEach(fid => {
    const sugg = parsed.suggestions[fid];
    if (!sugg || sugg.value == null || sugg.value === '') return;
    const spec = fieldSpecs[fid];
    if (spec && Array.isArray(spec.values)) {
      if (spec.values.indexOf(sugg.value) >= 0) {
        cleaned[fid] = {
          value: sugg.value,
          reasoning: (sugg.reasoning || '').toString().slice(0, 200),
          source: (sugg.source || 'KI-Marktbewertung').toString().slice(0, 80)
        };
      }
    } else {
      const n = typeof sugg.value === 'number' ? sugg.value : parseFloat(sugg.value);
      if (!isNaN(n)) {
        cleaned[fid] = {
          value: n,
          reasoning: (sugg.reasoning || '').toString().slice(0, 200),
          source: (sugg.source || 'KI-Marktbewertung').toString().slice(0, 80)
        };
      }
    }
  });

  return { success: true, model: r.model, suggestions: cleaned };
}

/**
 * V39: KI-Vorschläge für Quick Check (rent/mgmt/finance) inkl. Quellen.
 */
async function suggestQcFields(group, context, opts) {
  const adresse = context.adresse || context.ort || '';
  if (!adresse) throw new Error('Keine Adresse');

  // V207a: Cache-Check vorab
  const crypto = require('crypto');
  function _cacheKey() {
    // Normalisierung damit "Str." und "Straße" denselben Key ergeben
    const adrNorm = String(adresse).toLowerCase()
      .replace(/str\./g, 'strasse')
      .replace(/ß/g, 'ss')
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, ' ').trim();
    // KP grob in 50k-Bändern (damit kleine Schwankungen denselben Cache treffen)
    const kpBand = context.kaufpreis ? Math.round(context.kaufpreis / 50000) * 50 : 0;
    return crypto.createHash('sha256')
      .update(group + '|' + adrNorm + '|' + kpBand + '|' + (context.wohnflaeche || 0))
      .digest('hex').substring(0, 32);
  }
  const cacheKey = _cacheKey();

  try {
    const { query } = require('../db/pool');
    const cached = await query(
      `SELECT result_json FROM ai_qc_cache
       WHERE cache_key = $1 AND expires_at > NOW()`,
      [cacheKey]
    );
    if (cached.rowCount > 0) {
      // Hit-Counter erhöhen (best-effort, blockt nicht)
      query(`UPDATE ai_qc_cache SET hits = hits + 1 WHERE cache_key = $1`, [cacheKey]).catch(()=>{});
      console.log('[V207a qc-suggest] CACHE HIT für', group, adresse.substring(0, 40));
      const cachedResult = cached.rows[0].result_json;
      return Object.assign({ from_cache: true }, cachedResult);
    }
  } catch (e) {
    console.warn('[V207a qc-suggest] Cache-Lookup fehlgeschlagen:', e.message);
  }

  // ── V207a: Quellen-Whitelist für deutschen Immobilienmarkt ──────────
  // Statt "irgendwas aus dem Internet" prompten wir die KI auf
  // konkrete deutsche Branchenquellen: Sprengnetter, F+B, PriceHubble,
  // IVD-Marktbericht, BulwienGesa, kommunale Mietspiegel.
  const SOURCES_GUARD = [
    '',
    'WICHTIG — SERIÖSE QUELLEN PFLICHT:',
    '  Nutze AUSSCHLIESSLICH folgende Branchenquellen für deutsche Immobiliendaten:',
    '  - Kommunaler Mietspiegel (mietspiegel-<stadt>.de, qualifizierter Mietspiegel)',
    '  - Sprengnetter ImmoWelt-Marktdaten',
    '  - F+B Wohn-Index / F+B Mietspiegel',
    '  - PriceHubble Marktanalysen',
    '  - IVD-Marktbericht (Immobilienverband Deutschland)',
    '  - BulwienGesa Wohnmarktstudien',
    '  - Statistische Landesämter, destatis.de',
    '  - empirica-systeme, JLL Residential City Profile',
    '',
    '  KEINE Quellen: Allgemeines Internet, Foren, Blogs, ImmoScout-Inserate (single).',
    '  Bei fehlenden konkreten Daten lieber "Branchenüblich" als "Quelle" angeben',
    '  als eine erfundene Studie nennen. ERFUNDENE URLs SIND VERBOTEN.',
    ''
  ].join('\n');

  let prompt;
  if (group === 'rent') {
    prompt = [
      'Du bist Immobilien-Marktexperte für den deutschen Wohnungsmarkt.',
      'Schätze die marktübliche Nettokaltmiete für folgendes Objekt.',
      '',
      'OBJEKT:',
      '  Lage: ' + adresse,
      context.wohnflaeche ? '  Wohnfläche: ' + context.wohnflaeche + ' m²' : '',
      context.baujahr ? '  Baujahr: ' + context.baujahr : '',
      context.kaufpreis ? '  Kaufpreis: ' + context.kaufpreis.toLocaleString('de-DE') + ' €' : '',
      '',
      'AUFGABE:',
      '  1. PRÜFE ZUERST den kommunalen Mietspiegel der Stadt/Gemeinde aus der Adresse.',
      '  2. Wenn Mietspiegel verfügbar: nutze ortsübliche Vergleichsmiete (€/m² netto-kalt).',
      '  3. Falls kein qualifizierter Mietspiegel: F+B Wohn-Index, IVD oder Sprengnetter.',
      '  4. Berücksichtige Baujahr (Bestand vs. Neubau-Zuschlag), Wfl-Größe, Mikrolage.',
      '  5. Ergebnis: NETTOKALTMIETE pro Monat in Euro für das konkrete Objekt.',
      SOURCES_GUARD,
      'Antwort STRIKT als JSON:',
      '{ "suggestions": { "nettokaltmiete": { "value": 750, "source": "Mietspiegel Herford 2024 (qualifiziert) — 7,80 €/m²", "reasoning": "Mittlere Lage, Baujahr 1997, 96 m²" } } }'
    ].filter(Boolean).join('\n');
  } else if (group === 'mgmt') {
    prompt = [
      'Du bist Immobilien-Bewirtschaftungsexperte für deutsche Wohnimmobilien (ETW).',
      'Schätze für das folgende Objekt das Hausgeld und den Anteil nicht-umlagefähiger Kosten.',
      '',
      'OBJEKT: ' + adresse,
      context.baujahr ? '  Baujahr: ' + context.baujahr : '',
      context.wohnflaeche ? '  Wohnfläche: ' + context.wohnflaeche + ' m²' : '',
      '',
      'AUFGABE: Liefere ZWEI Werte:',
      '  - hausgeld_pct: Gesamtes Hausgeld als % der Jahres-Nettokaltmiete (NKM)',
      '    Faustregel: ETW ~26% (18-35% Range, abhängig von Baujahr/Heizung/Lage)',
      '    Standard-Bestand Bj. 1990+: 22-30%',
      '    Sanierungsbedürftig oder Vorkriegs: 30-35%',
      '  - nul_pct: Anteil NICHT-UMLAGEFÄHIGER Kosten am HAUSGELD (NICHT an der NKM!)',
      '    (Erhaltungsaufwand-Rücklage + WEG-Verwalterkosten + Mietausfallwagnis)',
      '    PLAUSIBLE RANGE: 12-30% (Standard ETW ~20-25%)',
      '    Bei jüngerem Bestand: 12-18%, älterem: 22-30%',
      '    Rest = umlagefähig (Müll, Wasser, Versicherung, Hausstrom) wird auf Mieter umgelegt',
      SOURCES_GUARD,
      '  Quelle bevorzugt: IVD-Marktbericht, BulwienGesa, F+B, kommunale Hausgeld-Daten.',
      '',
      'Antwort STRIKT als JSON:',
      '{ "suggestions": { "hausgeld_pct": { "value": 26, "source": "IVD-Marktbericht 2024 (ETW Bestand Bj. 1997)", "reasoning": "Standard Wohnung mit Zentralheizung" }, "nul_pct": { "value": 22, "source": "Branchenüblich (BulwienGesa)", "reasoning": "Mittlerer Erhaltungsaufwand, WEG-Verwaltung Standard" } } }'
    ].filter(Boolean).join('\n');
  } else if (group === 'finance') {
    prompt = [
      'Du bist Baufinanzierungs-Experte für deutsche Kapitalanleger-Finanzierungen.',
      'Gib aktuell marktübliche Werte an.',
      '',
      'KONTEXT: Kapitalanleger-Finanzierung in Deutschland, Stand: heute',
      context.kaufpreis ? '  Kaufpreis ca. ' + context.kaufpreis.toLocaleString('de-DE') + ' €' : '',
      '',
      'AUFGABE:',
      '  - zinssatz: aktueller marktüblicher Sollzinssatz (%) bei 10J-Bindung,',
      '    80-90% LTV, gute Bonität, Kapitalanleger',
      '  - tilgung: empfohlene Anfangstilgung (%) für Kapitalanleger',
      '',
      'Quelle PFLICHT: Interhyp Best-Zins-Index, Dr. Klein, FMH Finanzberatung,',
      '  Europace, BaFin-Statistik oder Bundesbank. KEINE erfundenen URLs.',
      '',
      'Antwort STRIKT als JSON:',
      '{ "suggestions": { "zinssatz": { "value": 3.85, "source": "Interhyp Best-Zins-Index (Stand letzte Woche)", "reasoning": "10J-Bindung, 80% LTV, Bonität gut" }, "tilgung": { "value": 2.0, "source": "Branchenüblich Kapitalanleger", "reasoning": "Standard 1,5-2,5%" } } }'
    ].filter(Boolean).join('\n');
  }

  // V207a: Temperature 0 für Determinismus (zusammen mit Cache greift das gut)
  const callOpts = Object.assign(
    { maxTokens: 800 },
    opts || {},
    { aiOptions: Object.assign({ temperature: 0 }, (opts && opts.aiOptions) || {}) }
  );

  const r = await callOpenAI(prompt, callOpts);
  const parsed = extractJson(r.text);
  if (!parsed || !parsed.suggestions) {
    return { success: false, error: 'KI-Antwort konnte nicht ausgewertet werden.', raw_text: r.text };
  }

  const cleaned = {};
  Object.keys(parsed.suggestions).forEach(k => {
    const s = parsed.suggestions[k];
    if (!s || s.value == null) return;
    const n = typeof s.value === 'number' ? s.value : parseFloat(String(s.value).replace(',', '.'));
    if (isNaN(n)) return;
    cleaned[k] = {
      value: n,
      source: (s.source || 'KI-Marktbewertung').toString().slice(0, 120),
      reasoning: (s.reasoning || '').toString().slice(0, 200)
    };
  });

  // ── V207a: Sanity-Check für Bewirtschaftungs-Werte (V207-Logik) ──────
  // Marcels Befund G: KI lieferte unplausible Werte. Wenn außerhalb der
  // realistischen Range → durch Faustregel ersetzen + im reasoning vermerken.
  // V207 Logik: hausgeld_pct (% NKM) + nul_pct (% vom HG)
  if (group === 'mgmt') {
    const FAUSTREGEL_HG_PCT  = 26;   // % der Jahres-NKM
    const FAUSTREGEL_NUL_PCT = 22;   // % vom HG

    if (cleaned.hausgeld_pct) {
      const v = cleaned.hausgeld_pct.value;
      if (v < 15 || v > 40) {
        console.warn('[V207 sanity] hausgeld_pct=' + v + '% außerhalb 15-40%, ersetze durch Faustregel ' + FAUSTREGEL_HG_PCT + '%');
        cleaned.hausgeld_pct = {
          value: FAUSTREGEL_HG_PCT,
          source: 'Faustregel IVD (KI-Wert ' + v + '% war unplausibel)',
          reasoning: 'KI lieferte ' + v + '% — außerhalb realistischer Range (15-40% NKM). Ersetzt.'
        };
      }
    }
    if (cleaned.nul_pct) {
      const v = cleaned.nul_pct.value;
      if (v < 12 || v > 30) {
        console.warn('[V207 sanity] nul_pct=' + v + '% außerhalb 12-30%, ersetze durch Faustregel ' + FAUSTREGEL_NUL_PCT + '%');
        cleaned.nul_pct = {
          value: FAUSTREGEL_NUL_PCT,
          source: 'Faustregel IVD (KI-Wert ' + v + '% war unplausibel)',
          reasoning: 'KI lieferte ' + v + '% — außerhalb realistischer Range (12-30% vom HG). Ersetzt.'
        };
      }
    }

    // Backward-Compat: falls noch alte Backend-Antwort mit instandhaltung_pct/verwaltung_pct kommt
    if (cleaned.instandhaltung_pct && !cleaned.nul_pct) {
      const iv = cleaned.instandhaltung_pct.value;
      if (iv < 12 || iv > 30) {
        cleaned.instandhaltung_pct = {
          value: 22, source: 'Faustregel IVD (Alt-Wert ' + iv + '% unplausibel)',
          reasoning: 'Ersetzt durch Branchenstandard.'
        };
      }
    }
    if (cleaned.verwaltung_pct) {
      const uv = cleaned.verwaltung_pct.value;
      if (uv < 3 || uv > 8) {
        cleaned.verwaltung_pct = {
          value: 4.5, source: 'Faustregel IVD (Alt-Wert ' + uv + '% unplausibel)',
          reasoning: 'Ersetzt durch Branchenstandard.'
        };
      }
    }
  }

  const result = { success: true, model: r.model, suggestions: cleaned };

  // V207a: In Cache schreiben (24h gültig)
  try {
    const { query } = require('../db/pool');
    await query(
      `INSERT INTO ai_qc_cache (cache_key, groep, adresse, result_json, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours')
       ON CONFLICT (cache_key) DO UPDATE
         SET result_json = EXCLUDED.result_json,
             expires_at = EXCLUDED.expires_at,
             hits = 0`,
      [cacheKey, group, adresse.substring(0, 200), JSON.stringify(result)]
    );
    console.log('[V207a qc-suggest] CACHE WRITE für', group, adresse.substring(0, 40));
  } catch (e) {
    console.warn('[V207a qc-suggest] Cache-Write fehlgeschlagen:', e.message);
  }

  return result;
}

/**
 * V38: Strukturierte Datenextraktion aus PDF-Exposé-Text.
 */
async function extractExpose(text, opts) {
  const prompt = [
    'Du bekommst den Text eines deutschen Immobilien-Exposés (ImmoScout, Kleinanzeigen, Maklerbroschüre etc.).',
    'Extrahiere folgende Felder als JSON. Wenn ein Feld nicht im Text steht: weglassen oder null.',
    '',
    'FELDER:',
    '  - adresse: vollständige Adresse als String (z.B. "Dresdenstraße 116, 32052 Herford")',
    '  - plz: Postleitzahl (5 Ziffern)',
    '  - ort: Stadt/Gemeinde',
    '  - kaufpreis: Zahl in Euro, ohne Währungssymbol (z.B. 285000)',
    '  - wohnflaeche: Zahl in m² (z.B. 96.5)',
    '  - grundstuecksflaeche: Zahl in m² (nur bei Häusern relevant)',
    '  - baujahr: 4-stellige Jahreszahl',
    '  - sanierungsjahr: 4-stellige Jahreszahl falls eine Sanierung erwähnt wird',
    '  - objektart: einer von: "Wohnung", "Eigentumswohnung", "Einfamilienhaus", "Mehrfamilienhaus", "Reihenhaus", "Doppelhaushälfte", "Gewerbe"',
    '  - zimmer: Zahl (z.B. 3 oder 3.5)',
    '  - nettokaltmiete: Zahl in Euro/Monat (falls vermietet oder Mieteinnahmen erwähnt)',
    '  - nebenkosten: Zahl in Euro/Monat (Nebenkosten, BK)',
    '  - hausgeld: Zahl in Euro/Monat (nur bei ETW)',
    '  - instandhaltung: Zahl in Euro/Monat (Instandhaltungsrücklage, falls separat ausgewiesen)',
    '  - verwaltung: Zahl in Euro/Monat (Verwaltungskosten, falls separat ausgewiesen)',
    '  - eigenkapital: Zahl in Euro (Eigenkapital-Anteil, falls Finanzierungsbeispiel im Exposé)',
    '  - kaufnebenkosten: Zahl in % (Kaufnebenkosten gesamt, falls erwähnt — typisch 10-12)',
    '  - stellplatz: String (z.B. "Tiefgarage", "Außenstellplatz", "kein Stellplatz") oder null',
    '  - heizkosten: Zahl in Euro/Monat',
    '  - energieklasse: einer von "A+","A","B","C","D","E","F","G","H"',
    '  - energieverbrauch: Zahl in kWh/(m²·a)',
    '  - heizungsart: String (z.B. "Gas-Zentralheizung", "Wärmepumpe", "Fernwärme")',
    '  - balkon: true/false',
    '  - keller: true/false',
    '  - aufzug: true/false',
    '  - zustand: einer von "Neubau", "Erstbezug", "saniert", "renoviert", "modernisiert", "renovierungsbedürftig"',
    '',
    'WICHTIG:',
    '  - Zahlen IMMER als Number, NICHT als String',
    '  - Bei mehreren Mietangaben: bevorzugt Nettokaltmiete, sonst Kaltmiete',
    '  - Wenn das Objekt LEERSTEHEND verkauft wird (kein aktueller Mieter): nettokaltmiete weglassen',
    '  - Tausenderpunkte und Kommas korrekt deutsch interpretieren (3.500,50 = 3500.5)',
    '',
    'Antwort STRIKT als JSON, kein Markdown, kein Text drumherum:',
    '{ "extracted": { "adresse": "...", "kaufpreis": 285000, ... } }',
    '',
    '─── EXPOSE-TEXT ───',
    text
  ].join('\n');

  const r = await callOpenAI(prompt, Object.assign({ maxTokens: 1500 }, opts || {}));
  const parsed = extractJson(r.text);
  if (!parsed) {
    return { success: false, error: 'KI-Antwort konnte nicht ausgewertet werden.', raw_text: r.text };
  }

  // Normalisieren
  const ext = parsed.extracted || parsed;
  const cleaned = {};
  ['adresse', 'plz', 'ort', 'objektart', 'energieklasse', 'heizungsart', 'zustand', 'stellplatz'].forEach(k => {
    if (ext[k] != null && ext[k] !== '') cleaned[k] = String(ext[k]).trim();
  });
  ['kaufpreis', 'wohnflaeche', 'grundstuecksflaeche', 'baujahr', 'sanierungsjahr',
   'zimmer', 'nettokaltmiete', 'nebenkosten', 'hausgeld', 'heizkosten', 'energieverbrauch',
   'instandhaltung', 'verwaltung', 'eigenkapital', 'kaufnebenkosten'].forEach(k => {
    const v = ext[k];
    if (v == null || v === '') return;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (!isNaN(n)) cleaned[k] = n;
  });
  ['balkon', 'keller', 'aufzug'].forEach(k => {
    if (ext[k] != null) cleaned[k] = Boolean(ext[k]);
  });

  return { success: true, model: r.model, extracted: cleaned };
}

/**
 * V63.91: extractMarketData
 * ─────────────────────────────────────────────────────────────
 * Extrahiert Marktdaten aus einem Marktwert-/Lage-Report-PDF
 * (z.B. PriceHubble-Bewertung). Befüllt die Objekt-Felder mit
 * Verkehrswert, m²-Preisen, Lage-Scores, Vergleichsobjekten.
 *
 * Liefert ein anderes Schema als extractExpose — denn ein Marktbericht
 * hat typischerweise keinen Kaufpreis (das Objekt wird ja gerade bewertet)
 * sondern einen Verkehrswert + Range + Lage-Scores.
 */
async function extractMarketData(text, opts) {
  const prompt = [
    'Du bekommst den Text eines deutschen Immobilien-Marktwert-Berichts',
    '(z.B. PriceHubble, Sprengnetter, McMakler-Bewertung, Maklergutachten).',
    'Extrahiere folgende Felder als JSON. Wenn ein Feld nicht im Text steht: weglassen oder null.',
    '',
    'KERNFELDER:',
    '  - adresse: vollständige Adresse als String',
    '  - plz: 5 Ziffern',
    '  - ort: Stadt/Gemeinde',
    '  - objektart: einer von "Wohnung","Eigentumswohnung","Einfamilienhaus","Mehrfamilienhaus","Reihenhaus","Doppelhaushälfte"',
    '  - wohnflaeche: Zahl in m²',
    '  - grundstuecksflaeche: Zahl in m² (bei Häusern)',
    '  - baujahr: 4-stellige Jahreszahl',
    '  - sanierungsjahr: 4-stellige Jahreszahl',
    '  - zimmer: Zahl',
    '',
    'BEWERTUNG (das Herzstück eines Marktberichts):',
    '  - verkehrswert: empfohlener Marktwert/Verkehrswert in Euro (Zahl)',
    '  - verkehrswert_min: untere Grenze des Konfidenz-Bereichs in Euro',
    '  - verkehrswert_max: obere Grenze in Euro',
    '  - preis_pro_qm: Verkehrswert pro m² in Euro',
    '  - bewertungsdatum: Datum der Bewertung (YYYY-MM-DD oder DD.MM.YYYY)',
    '  - konfidenz: Text (z.B. "Gut", "Mittel", "Niedrig") oder null',
    '',
    'LAGE-SCORES (typisch 1-5 oder 1-10, Text bei PriceHubble):',
    '  - lage_geraeusch: Zahl (z.B. 5.0)',
    '  - lage_einkaufen: Zahl',
    '  - lage_bildung: Zahl',
    '  - lage_gastronomie: Zahl',
    '  - lage_gesundheit: Zahl',
    '  - lage_freizeit: Zahl',
    '',
    'WERTENTWICKLUNG (Markttrends):',
    '  - wertentwicklung_3jahre_pct: Veränderung der letzten 3 Jahre in % (Zahl, kann negativ sein)',
    '  - wertentwicklung_1jahr_pct: Veränderung im letzten Jahr in % (Zahl)',
    '  - prognose_naechstes_jahr_pct: Prognose nächstes Jahr in % (Zahl)',
    '  - markt_durchschnittspreis: Durchschnittspreis im Stadtteil/PLZ-Gebiet in Euro',
    '  - markt_tage_auf_dem_markt: Durchschnittliche Tage auf dem Markt (Zahl)',
    '',
    'SOZIO-ÖKONOMIE (falls enthalten):',
    '  - bevoelkerung: Einwohnerzahl der Stadt (Zahl)',
    '  - arbeitslosenquote_pct: Arbeitslosenquote in % (Zahl)',
    '  - wanderungssaldo: Wanderungssaldo pro 1000 Einwohner (Zahl)',
    '',
    'AUSSTATTUNG (sofern bewertet, jeweils ein Wert/Bewertung):',
    '  - kueche_qualitaet: String (z.B. "Gehoben", "Standard", "Einfach")',
    '  - bad_qualitaet: String',
    '  - boden_qualitaet: String',
    '  - fenster_qualitaet: String',
    '  - energie_label: String (A+, A, B, ..., H)',
    '',
    'WICHTIG:',
    '  - Zahlen IMMER als Number, NICHT als String',
    '  - Tausenderpunkte und Kommas korrekt deutsch (3.500,50 = 3500.5)',
    '  - Bei Range "201K - 252K" → 201000 / 252000',
    '  - Prozentzahlen: "+8,89%" → 8.89, "-2,36%" → -2.36',
    '',
    'Antwort STRIKT als JSON, kein Markdown:',
    '{ "extracted": { "verkehrswert": 211900, "lage_geraeusch": 5.0, ... } }',
    '',
    '─── MARKTBERICHTS-TEXT ───',
    text
  ].join('\n');

  const r = await callOpenAI(prompt, Object.assign({ maxTokens: 1800 }, opts || {}));
  const parsed = extractJson(r.text);
  if (!parsed) {
    return { success: false, error: 'KI-Antwort konnte nicht ausgewertet werden.', raw_text: r.text };
  }
  const ext = parsed.extracted || parsed;
  const cleaned = {};
  // String-Felder
  ['adresse','plz','ort','objektart','bewertungsdatum','konfidenz',
   'kueche_qualitaet','bad_qualitaet','boden_qualitaet','fenster_qualitaet','energie_label'
  ].forEach(k => {
    if (ext[k] != null && ext[k] !== '') cleaned[k] = String(ext[k]).trim();
  });
  // Zahl-Felder (inkl. negative für Wertentwicklungs-%-Werte)
  ['wohnflaeche','grundstuecksflaeche','baujahr','sanierungsjahr','zimmer',
   'verkehrswert','verkehrswert_min','verkehrswert_max','preis_pro_qm',
   'lage_geraeusch','lage_einkaufen','lage_bildung','lage_gastronomie','lage_gesundheit','lage_freizeit',
   'wertentwicklung_3jahre_pct','wertentwicklung_1jahr_pct','prognose_naechstes_jahr_pct',
   'markt_durchschnittspreis','markt_tage_auf_dem_markt',
   'bevoelkerung','arbeitslosenquote_pct','wanderungssaldo'
  ].forEach(k => {
    const v = ext[k];
    if (v == null || v === '') return;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (!isNaN(n)) cleaned[k] = n;
  });
  return { success: true, model: r.model, extracted: cleaned };
}

module.exports = {
  analyze,
  analyzeLage,
  suggestDs2Fields,
  suggestQcFields,
  extractExpose,
  extractMarketData,
  buildPrompt,
  callOpenAI,
  extractJson
};
