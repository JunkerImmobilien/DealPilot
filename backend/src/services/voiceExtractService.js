/* ════════════════════════════════════════════════════════════════════
 * voiceExtractService.js — v503-voice (ersetzt v501)
 * Sprachaufzeichnung -> Transkription (OpenAI Audio) -> Feld-Extraktion.
 *
 * v502: Der Feld-KATALOG kommt vom Frontend mit (zur Laufzeit aus
 * window.FIELDS + echtem DOM gebaut, ALLE Tabs). Selects bringen ihre
 * echten Optionen (value+text) mit -> die KI brueckt freie Formulierungen
 * ("Zustand ist gut") auf den exakt passenden Optionswert. Serverseitig
 * werden Select-Antworten gegen die mitgelieferten Optionen validiert.
 *
 * Eigene Datei (additiv), bewusst NICHT in openaiService.js gepatcht.
 * Nutzt Node-18+-Globals: fetch, FormData, Blob (Node 22 im Image).
 *
 * env-Overrides:
 *   OPENAI_TRANSCRIBE_MODEL     (Default: gpt-4o-mini-transcribe)
 *   OPENAI_VOICE_EXTRACT_MODEL  (Default: OPENAI_MODEL bzw. gpt-5.5)
 * ════════════════════════════════════════════════════════════════════ */
'use strict';

const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-transcribe-diarize';
const EXTRACT_MODEL = process.env.OPENAI_VOICE_EXTRACT_MODEL || process.env.OPENAI_MODEL || 'gpt-5.5';
const QUICKMATCH_MODEL = process.env.OPENAI_QUICKMATCH_MODEL || 'gpt-4o-mini';  /* v513: Live-Zwischenauswertung, klein/guenstig */

const MAX_CATALOG = 250;       /* Eintraege */
const MAX_OPTIONS = 40;        /* Optionen je Select */

function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function extFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.indexOf('mp4') >= 0 || m.indexOf('m4a') >= 0 || m.indexOf('aac') >= 0) return 'mp4';
  if (m.indexOf('ogg') >= 0) return 'ogg';
  if (m.indexOf('wav') >= 0) return 'wav';
  if (m.indexOf('mpeg') >= 0 || m.indexOf('mp3') >= 0) return 'mp3';
  return 'webm';
}

/* Katalog vom Frontend bereinigen/validieren (kein blindes Durchreichen in den Prompt) */
function sanitizeCatalog(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const e of raw) {
    if (out.length >= MAX_CATALOG) break;
    if (!e || typeof e.id !== 'string' || !/^[A-Za-z0-9_]{1,40}$/.test(e.id)) continue;
    const entry = {
      id: e.id,
      kind: ['select', 'num', 'int', 'date', 'text'].includes(e.kind) ? e.kind : 'text',
      label: String(e.label || e.id).slice(0, 90)
    };
    if (e.hint) entry.hint = String(e.hint).slice(0, 120);
    if (entry.kind === 'select') {
      entry.options = [];
      (Array.isArray(e.options) ? e.options : []).slice(0, MAX_OPTIONS).forEach(o => {
        if (o && typeof o.v === 'string' && o.v !== '') {
          entry.options.push({ v: o.v.slice(0, 60), t: String(o.t || o.v).slice(0, 60) });
        }
      });
      if (!entry.options.length) continue;
    }
    out.push(entry);
  }
  return out;
}

async function transcribe(buf, mime, apiKey) {
  const fd = new FormData();
  fd.append('model', TRANSCRIBE_MODEL);
  fd.append('language', 'de');
  fd.append('file', new Blob([buf], { type: mime || 'audio/webm' }), 'aufnahme.' + extFromMime(mime));
  let r;
  try {
    r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey },
      body: fd
    });
  } catch (e) {
    throw httpErr(502, 'Transkription nicht erreichbar: ' + e.message);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (r.status === 401) throw httpErr(401, 'OpenAI-Key ungueltig (Transkription).');
    throw httpErr(502, 'Transkription fehlgeschlagen (HTTP ' + r.status + '): ' + t.slice(0, 300));
  }
  const data = await r.json().catch(() => ({}));
  return String(data.text || '').trim();
}

/* v515: schneidet eine vorgelesene/gespiegelte Begriffs-Liste am Ende ab
 * (z.B. "... Begriffe: Eigentumswohnung, Mehrfamilienhaus, ..."). Solche
 * reinen Wort-Aufzaehlungen ohne Werte fuehren sonst zu Falsch-Extraktion. */
function stripTermDump(t) {
  var s = String(t || '');
  s = s.replace(/\bBegriffe\s*:[\s\S]*$/i, '');
  return s.trim();
}

function buildPrompt(transcript, catalog) {
  const lines = catalog.map(e => {
    let l = '- ' + e.id + ' | ' + e.kind + ' | ' + e.label;
    if (e.hint) l += ' (' + e.hint + ')';
    if (e.kind === 'select') {
      l += '\n  ERLAUBTE WERTE: ' + e.options.map(o => '"' + o.v + '"=' + o.t).join(', ');
    }
    return l;
  }).join('\n');

  return 'Du bist ein Extraktions-Parser fuer eine deutsche Immobilien-Investitionsanalyse-Software.\n' +
    'Der folgende Text ist ein Sprach-Transkript (kann Erkennungsfehler enthalten,\n' +
    'Zahlen teils als Zahlwoerter).\n\n' +
    'AUFGABE: Extrahiere ALLE im Transkript genannten Werte in ein JSON-Objekt.\n' +
    'Schluessel = Feld-id aus dem Katalog.\n\n' +
    'FELD-KATALOG (id | typ | Bedeutung):\n' + lines + '\n\n' +
    'REGELN:\n' +
    '1. Gib NUR ein JSON-Objekt zurueck. Kein Markdown, keine Backticks, kein Text davor/danach.\n' +
    '2. Nimm NUR Felder auf, deren Wert im Transkript tatsaechlich genannt oder eindeutig\n' +
    '   beschrieben wird. Nichts erfinden, keine Defaults.\n' +
    '3. typ num/int: JSON-Zahl mit Punkt als Dezimaltrenner. Zahlwoerter umrechnen:\n' +
    '   "dreihundertzwanzigtausend" -> 320000, "vier Komma zwei Prozent" -> 4.2, "1.250 Euro" -> 1250.\n' +
    '   Prozentangaben: nur die Zahl ohne Prozentzeichen.\n' +
    '4. typ date: Format YYYY-MM-DD.\n' +
    '5. typ select: Gib EXAKT einen der ERLAUBTEN WERTE (den Teil in Anfuehrungszeichen) zurueck.\n' +
    '   BRUECKEN FINDEN: Freie Formulierungen auf die inhaltlich passendste Option abbilden\n' +
    '   ("Zustand der Wohnung ist gut" -> der Wert, dessen Text "gut" entspricht;\n' +
    '   "Nachfrage ist sehr hoch" -> passende Nachfrage-Option). Sinngemaess ableiten ist\n' +
    '   ausdruecklich erwuenscht. Passt KEINE Option sinnvoll: Feld weglassen.\n' +
    '6. ZUSATZEINNAHMEN: Nennt der Sprecher mehrere monatliche Einnahme-Posten neben der\n' +
    '   Kaltmiete (z.B. "Kueche fuer 70 Euro vermieten, Stellplatz fuer 30 Euro"), dann\n' +
    '   ist ze die SUMME dieser Posten (Beispiel: 100). Die Kaltmiete selbst gehoert in nkm,\n' +
    '   NICHT in ze.\n' +
    '7. Lage-Beschreibungen: Aussagen zu Stadt/Region/Wirtschaft -> makrolage (Freitext),\n' +
    '   zu Viertel/Strasse/Umfeld -> mikrolage (Freitext). Nachfrage/Bevoelkerung/Entwicklung\n' +
    '   zusaetzlich auf die passenden Select-Felder bruecken, wenn vorhanden.\n' +
    '8. Allgemeine Anmerkungen ohne eigenes Feld -> notizen.\n' +
    '9. Offensichtliche Transkriptionsfehler sinnvoll korrigieren ("Bauchjahr" -> Baujahr).\n' +
    '10. Zusaetzlich ein Feld "_unsicher": Array von Feld-ids, bei denen du dir wegen\n' +
    '    Transkript-Qualitaet oder Mehrdeutigkeit unsicher bist (leeres Array wenn keines).\n\n' +
    '11. (Regel 11/12 v515) Eine bloße Aufzaehlung von Feld- oder Fachbegriffen OHNE zugehoerige\n' +
    '    Zahl/Angabe (z.B. "Eigentumswohnung, Mehrfamilienhaus, Wohnflaeche, Quadratmeter, Baujahr,\n' +
    '    Kaufpreis, ..." oder ein mit "Begriffe:" eingeleiteter Block) ist KEINE Wertenennung.\n' +
    '    Ignoriere solche Aufzaehlungen vollstaendig und extrahiere daraus NICHTS.\n' +
    '12. Leite NIEMALS einen Wert aus einem anderen Feld ab und setze KEINE Defaults/Annahmen.\n' +
    '    Beispiel: Sind Zinssatz und Tilgung genannt, aber KEINE Zinsbindung in Jahren, dann lass\n' +
    '    d1_bindj WEG. Nur ausdruecklich genannte Werte aufnehmen.\n' +
    '13. HAUSGELD-AUFTEILUNG: hg_ul = umlagefaehiger Anteil, hg_nul = NICHT\n' +
    '    umlagefaehiger Anteil. Wird ein GESAMT-Hausgeld plus ein nicht-umlagefaehiger\n' +
    '    Anteil genannt (z.B. "Hausgeld 300, davon 100 nicht umlagefaehig"), dann\n' +
    '    hg_nul = 100 und hg_ul = Gesamt minus nicht-umlagefaehig = 200. Werden beide\n' +
    '    Anteile direkt genannt, uebernimm sie 1:1. Nur ein Hausgeld-Wert ohne\n' +
    '    Aufteilung -> in hg_ul.\n' +
    'TRANSKRIPT:\n"""\n' + transcript + '\n"""';
}

async function extractFields(transcript, catalog, apiKey) {
  transcript = stripTermDump(transcript);  /* v515 */
  let r;
  try {
    r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        input: [{ role: 'user', content: buildPrompt(transcript, catalog) }],
        max_output_tokens: 5000
      })
    });
  } catch (e) {
    throw httpErr(502, 'Extraktion nicht erreichbar: ' + e.message);
  }
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    if (r.status === 401) throw httpErr(401, 'OpenAI-Key ungueltig (Extraktion).');
    throw httpErr(502, 'Extraktion fehlgeschlagen (HTTP ' + r.status + '): ' + t.slice(0, 300));
  }
  const data = await r.json().catch(() => ({}));
  let text = '';
  (data.output || []).forEach(item => {
    (item.content || []).forEach(c => {
      if (c.type === 'output_text' || c.type === 'text') text += (c.text || '');
    });
  });
  text = text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```+/, '').replace(/```+$/, '').trim();
    if (text.toLowerCase().startsWith('json')) text = text.slice(4).trim();
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) {
    throw httpErr(502, 'Extraktions-Antwort war kein gueltiges JSON.');
  }

  const byId = {};
  catalog.forEach(e => { byId[e.id] = e; });

  const unsicher = Array.isArray(parsed._unsicher) ? parsed._unsicher.filter(k => byId[k]) : [];
  delete parsed._unsicher;

  const fields = {};
  Object.keys(parsed).forEach(k => {
    const entry = byId[k];
    const v = parsed[k];
    if (!entry || v === null || v === '') return;
    if (entry.kind === 'select') {
      /* Serverseitige Validierung: Wert muss eine erlaubte Option sein
         (exakt -> Text-Match -> verwerfen). */
      const sv = String(v);
      let hit = entry.options.find(o => o.v === sv);
      if (!hit) {
        const lv = sv.toLowerCase().trim();
        hit = entry.options.find(o => o.v.toLowerCase() === lv || o.t.toLowerCase().trim() === lv);
      }
      if (!hit) return;
      fields[k] = hit.v;
    } else {
      fields[k] = v;
    }
  });
  return { fields, unsicher };
}

/**
 * Haupteinstieg: Base64-Audio + Feld-Katalog -> { transcript, fields, unsicher }
 * @param {string} audioB64 - Base64 (ohne data:-Prefix)
 * @param {string} mime     - z.B. 'audio/webm'
 * @param {Array}  catalog  - [{id, kind, label, hint?, options?:[{v,t}]}]
 * @param {object} opts     - { apiKey, userApiKey }
 */
async function extractFromAudio(audioB64, mime, catalog, opts) {
  const o = opts || {};
  const key = o.userApiKey || o.apiKey;
  if (!key) { const e = new Error('Kein OpenAI-API-Key verfuegbar.'); e.code = 'NO_API_KEY'; throw e; }
  const cat = sanitizeCatalog(catalog);
  if (!cat.length) throw httpErr(400, 'Feld-Katalog fehlt oder ist leer.');
  let buf;
  try { buf = Buffer.from(audioB64, 'base64'); } catch (e) { throw httpErr(400, 'Audio konnte nicht dekodiert werden.'); }
  if (!buf || buf.length < 2000) throw httpErr(400, 'Aufnahme zu kurz oder leer.');
  const transcript = await transcribe(buf, mime, key);
  if (!transcript || transcript.length < 10) throw httpErr(422, 'Keine Sprache erkannt \u2014 bitte erneut aufnehmen.');
  let out = await extractFields(transcript, cat, key);
  if (VERIFY_ON) { try { out = await verifyFields(transcript, out, cat, key); } catch (e) {} }  /* v522 verify-pass, fail-soft */
  return { transcript, fields: out.fields, unsicher: out.unsicher };
}

/* v513: Live-Zwischenauswertung. Transkript-Text -> Array erkannter Feld-ids
 * (KEINE Werte). Kleines Modell, fail-soft: bei jedem Fehler leeres Array,
 * damit die Live-Hilfe nie hart bricht. */
function buildQuickPrompt(transcript, catalog) {
  const lines = catalog.map(e => '- ' + e.id + ' | ' + e.label).join('\n');
  return 'Du markierst, welche Felder einer Immobilien-Analyse in einem deutschen ' +
    'Sprach-Transkript bereits GENANNT oder eindeutig beschrieben wurden. KEINE Werte extrahieren.\n\n' +
    'FELDER (id | Bedeutung):\n' + lines + '\n\n' +
    'REGELN:\n' +
    '1. Gib NUR ein JSON-Array von Feld-ids zurueck (z.B. ["plz","ort","kp"]). Kein Markdown, kein Text.\n' +
    '2. Nimm eine id NUR auf, wenn ihr Inhalt im Transkript vorkommt \u2014 auch implizit/aus dem Kontext\n' +
    '   (z.B. "Hermannstrasse 9" -> str UND hnr; "32609 Huellhorst" -> plz UND ort; "im 2. Obergeschoss" -> etage).\n' +
    '3. Nichts erfinden. Unklar -> weglassen.\n\n' +
    'TRANSKRIPT:\n"""\n' + transcript + '\n"""';
}

async function quickMatch(transcript, catalog, apiKey) {
  if (!apiKey) { const e = new Error('Kein OpenAI-API-Key.'); e.code = 'NO_API_KEY'; throw e; }
  const cat = sanitizeCatalog(catalog);
  if (!cat.length || !transcript || transcript.length < 3) return { ids: [] };
  let r;
  try {
    r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: QUICKMATCH_MODEL,
        input: [{ role: 'user', content: buildQuickPrompt(transcript, cat) }],
        max_output_tokens: 400
      })
    });
  } catch (e) { return { ids: [] }; }
  if (!r.ok) return { ids: [] };
  const data = await r.json().catch(() => ({}));
  let text = '';
  (data.output || []).forEach(item => {
    (item.content || []).forEach(c => {
      if (c.type === 'output_text' || c.type === 'text') text += (c.text || '');
    });
  });
  text = text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```+/, '').replace(/```+$/, '').trim();
    if (text.toLowerCase().startsWith('json')) text = text.slice(4).trim();
  }
  let arr = [];
  try { const pp = JSON.parse(text); arr = Array.isArray(pp) ? pp : (Array.isArray(pp.ids) ? pp.ids : []); } catch (e) { arr = []; }
  const valid = new Set(cat.map(e => e.id));
  return { ids: arr.filter(id => valid.has(id)) };
}

/* v522: Verifikations-Pass (2. KI-Call), prueft/korrigiert Felder gegen das Transkript. */
const VERIFY_ON = String(process.env.OPENAI_VOICE_VERIFY || '1') !== '0';
const VERIFY_MODEL = process.env.OPENAI_VOICE_VERIFY_MODEL || 'gpt-5.4-mini';

function buildVerifyPrompt(transcript, fields, catalog) {
  const cat = catalog.map(function (e) {
    var line = '- ' + e.id + ' (' + (e.kind || 'text') + '): ' + (e.label || e.id);
    if (e.kind === 'select' && e.options) {
      line += ' | ERLAUBT: ' + e.options.map(function (o) { return '"' + o.v + '"'; }).join(', ');
    }
    return line;
  }).join('\n');
  return 'Du bist ein strenger Pruefer. Eine erste KI hat aus einem deutschen Immobilien-\n' +
    'Sprachtranskript Felder extrahiert. Pruefe JEDEN Wert gegen das Transkript und gib das\n' +
    'KORRIGIERTE JSON zurueck.\n\n' +
    'PRUEFE:\n' +
    '- Wert nicht im Transkript belegt -> Feld ENTFERNEN.\n' +
    '- Falsche Zuordnung (z.B. Zins als Tilgung, Kaltmiete als Hausgeld) -> richtig zuordnen.\n' +
    '- Einheit/Groessenordnung falsch (Prozent vs. Euro, klarer Zahlendreher) -> korrigieren.\n' +
    '- Ein klar genannter Wert fehlt -> ergaenzen (richtige Feld-id).\n' +
    '- typ select: nur ERLAUBTE Werte (exakt der Wert in Anfuehrungszeichen).\n' +
    '- Hausgeld: hg_ul = umlagefaehig, hg_nul = nicht umlagefaehig. Gesamt minus\n' +
    '  nicht-umlagefaehig = hg_ul, falls so genannt.\n' +
    'Erfinde NICHTS, setze KEINE Defaults. Antworte NUR mit dem JSON-Objekt (kein Markdown,\n' +
    'kein Text drumherum). Behalte/aktualisiere "_unsicher" (Array von Feld-ids).\n\n' +
    'FELD-KATALOG:\n' + cat + '\n\n' +
    'BISHERIGE EXTRAKTION (JSON):\n' + JSON.stringify(fields) + '\n\n' +
    'TRANSKRIPT:\n"""\n' + transcript + '\n"""';
}

async function verifyFields(transcript, prev, catalog, apiKey) {
  /* fail-soft: bei jedem Fehler bleibt prev unveraendert. */
  const seed = {};
  Object.keys((prev && prev.fields) || {}).forEach(function (k) { seed[k] = prev.fields[k]; });
  if (prev && Array.isArray(prev.unsicher)) seed._unsicher = prev.unsicher.slice();
  let r;
  try {
    r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VERIFY_MODEL,
        input: [{ role: 'user', content: buildVerifyPrompt(transcript, seed, catalog) }],
        max_output_tokens: 5000
      })
    });
  } catch (e) { return prev; }
  if (!r || !r.ok) return prev;
  const data = await r.json().catch(function () { return {}; });
  let text = '';
  (data.output || []).forEach(function (item) {
    (item.content || []).forEach(function (c) {
      if (c.type === 'output_text' || c.type === 'text') text += (c.text || '');
    });
  });
  text = text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```+/, '').replace(/```+$/, '').trim();
    if (text.toLowerCase().startsWith('json')) text = text.slice(4).trim();
  }
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) { return prev; }

  const byId = {};
  catalog.forEach(function (e) { byId[e.id] = e; });
  const unsicher = Array.isArray(parsed._unsicher) ? parsed._unsicher.filter(function (k) { return byId[k]; }) : [];
  delete parsed._unsicher;
  const fields = {};
  Object.keys(parsed).forEach(function (k) {
    const entry = byId[k];
    const v = parsed[k];
    if (!entry || v === null || v === '') return;
    if (entry.kind === 'select') {
      const sv = String(v);
      let hit = entry.options.find(function (o) { return o.v === sv; });
      if (!hit) {
        const lv = sv.toLowerCase().trim();
        hit = entry.options.find(function (o) { return o.v.toLowerCase() === lv || o.t.toLowerCase().trim() === lv; });
      }
      if (!hit) return;
      fields[k] = hit.v;
    } else {
      fields[k] = v;
    }
  });
  /* Sicherheitsnetz: leert der Pass (fast) alles, lieber Original behalten */
  if (Object.keys(fields).length === 0 && Object.keys((prev && prev.fields) || {}).length > 0) return prev;
  return { fields: fields, unsicher: unsicher };
}

module.exports = { extractFromAudio, quickMatch, transcribe };  /* v536: transcribe fuer Live-Chunks */
