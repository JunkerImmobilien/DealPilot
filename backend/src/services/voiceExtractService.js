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

/* v1169-VFAST: Der Default stand auf `gpt-4o-transcribe-diarize`. Diarisierung
   trennt SPRECHER voneinander — beim Diktat ins eigene Mikrofon spricht eine
   Person. Das war Rechenzeit ohne Gegenwert und der erste Grund, warum die
   Erkennung sich zaeh anfuehlte. Der Dateikopf nennt als Default ohnehin
   `gpt-4o-mini-transcribe`; Code und Doku waren auseinander.
   Weiterhin per OPENAI_TRANSCRIBE_MODEL ueberschreibbar — wer Sprechertrennung
   braucht (Aufnahme einer Besichtigung zu zweit), setzt sie dort. */
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
const EXTRACT_MODEL = process.env.OPENAI_VOICE_EXTRACT_MODEL || process.env.OPENAI_MODEL || 'gpt-5.5';
const QUICKMATCH_MODEL = process.env.OPENAI_QUICKMATCH_MODEL || 'gpt-4o-mini';  /* v513: Live-Zwischenauswertung, klein/guenstig */

const MAX_CATALOG = 250;       /* Eintraege */
const MAX_OPTIONS = 40;        /* Optionen je Select */

/* ════════════════════════════════════════════════════════════════════
 * v1259 · WAS KOSTET EINE AUFNAHME?
 *
 * Marcels Frage vom 08.09.2026: „Was kostet uns denn jetzt diese
 * Sprachaufzeichnung? Koennen wir das irgendwie ermitteln?"
 *
 * Der naheliegende Weg ist versperrt: die Nutzungs-API von OpenAI
 * antwortet mit `Missing scopes: api.usage.read` — der Schluessel hat die
 * Berechtigung nicht (dafuer braeuchte es einen Admin-Key).
 *
 * Der bessere Weg liegt ohnehin naeher: JEDE OpenAI-Antwort traegt ihren
 * Verbrauch selbst mit. Bis v1258 hat dieser Dienst ihn weggeworfen — er
 * las `data.text` bzw. `data.output` und liess `data.usage` liegen. Jetzt
 * wird er eingesammelt.
 *
 * WAS GEMESSEN IST UND WAS GESCHAETZT: Die Tokenzahlen sind gemessen, sie
 * kommen von OpenAI. Die PREISE sind hinterlegte Annahmen — ein Preis, der
 * sich aendert, ohne dass es jemand merkt, waere schlimmer als kein Preis.
 * Deshalb steht jeder Posten mit `bepreist: true|false` da, und was nicht
 * bepreist ist, wird ausdruecklich genannt statt still als 0 gerechnet.
 *
 * PREISE NACHTRAGEN, ohne den Code anzufassen:
 *   OPENAI_PREISE='{"gpt-5.5":{"ein":1.25,"aus":10}}'
 * (USD je 1 Mio Token). Der Umrechnungskurs steht in OPENAI_USD_EUR.
 * ════════════════════════════════════════════════════════════════════ */
/* WELCHE MODELLE WIRKLICH LAUFEN — gemessen am 08.09.2026 mit
   `docker exec dealpilot-backend printenv`, nicht aus dem Code gelesen:

     Transkription   OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe
     Auswertung      OPENAI_VOICE_EXTRACT_MODEL=gpt-5.4-mini
     Live-Hilfe      (kein Override) -> gpt-4o-mini
     Gegenpruefung   (kein Override) -> gpt-5.4-mini, steht auf AUS

   Die Defaults hier im Code sind also NICHT das, was laeuft. Besonders bei
   der Transkription: v1169 hat den Default bewusst von `gpt-4o-transcribe`
   auf `gpt-4o-mini-transcribe` gestellt, um Tempo zu gewinnen — die ENV auf
   dem Server setzt aber weiter das grosse Modell. Diese Optimierung ist im
   Betrieb nie angekommen. Ein Direktvergleich derselben Datei ergab 2944 ms
   (gross) gegen 1864 ms (mini); die Qualitaet liess sich aus Einzellaeufen
   NICHT beurteilen, weil dieselbe Datei bei zwei Laeufen desselben Modells
   zwei verschiedene Ortsnamen ergab. Transkription ist nicht deterministisch.
   Ob die ENV so bleiben soll, ist Marcels Entscheidung. */
/* USD je 1 Mio Token. `einAudio` gilt nur fuer Audio-Eingabe, `einCached`
   fuer wiederverwendete Prompt-Praefixe.
   Recherchiert am 08.09.2026, jeder Wert aus zwei unabhaengigen Quellen. */
const PREISE_FEST = {
  'gpt-5.4-mini':           { ein: 0.75, einCached: 0.075, aus: 4.50 },
  'gpt-4o-mini':            { ein: 0.15, aus: 0.60 },
  'gpt-4o-transcribe':      { ein: 2.50, einAudio: 6.00, aus: 10.00 },
  'gpt-4o-mini-transcribe': { ein: 1.25, einAudio: 3.00, aus: 5.00 }
  /* gpt-5.5 fehlt weiter — es laeuft hier nicht (die ENV setzt
     gpt-5.4-mini), und einen Preis einzutragen, den niemand braucht und
     den ich nicht geprueft habe, waere die schlechtere Haelfte von beidem.
     Nachtragen ohne Codeaenderung per OPENAI_PREISE. */
};
const USD_EUR = Number(process.env.OPENAI_USD_EUR || 0.92);

function preisFuer(modell) {
  let extra = {};
  try { extra = JSON.parse(process.env.OPENAI_PREISE || '{}'); } catch (e) { extra = {}; }
  return extra[modell] || PREISE_FEST[modell] || null;
}

function neuerSammler() {
  return { posten: [], usdGesamt: 0, ohnePreis: [] };
}

/* Nimmt die `usage` einer OpenAI-Antwort entgegen. Fail-soft in jeder
   Richtung: fehlt sie, fehlt der Posten — die Auswertung laeuft weiter.
   Eine Kostenmessung darf nie der Grund sein, dass ein Diktat scheitert. */
function usageErfassen(sammler, schritt, modell, data) {
  try {
    if (!sammler) return;
    const u = (data && data.usage) || null;
    if (!u) { sammler.posten.push({ schritt, modell, hinweis: 'ohne usage-Angabe' }); return; }

    /* /v1/responses zaehlt input_tokens/output_tokens; die Transkription
       kann stattdessen eine Dauer melden (usage.type === 'duration'). */
    const ein = Number(u.input_tokens != null ? u.input_tokens : (u.prompt_tokens || 0)) || 0;
    const aus = Number(u.output_tokens != null ? u.output_tokens : (u.completion_tokens || 0)) || 0;
    const det = u.input_token_details || u.input_tokens_details || {};
    const einAudio = Number(det.audio_tokens || 0) || 0;
    /* v1259f · Zwischengespeicherte Prompt-Teile kosten nur einen Bruchteil.
       Das ist hier KEIN Randfall: von rund 6.200 Eingabe-Token der Auswertung
       sind ueber 6.000 der immer gleiche Feldkatalog, und der steht im Prompt
       VOR dem Transkript. Genau diese Reihenfolge macht ihn zwischenspeicher-
       faehig. Ohne diese Zeilen rechnete die Anzeige den Katalog jedes Mal
       zum vollen Preis und meldete damit zu viel. */
    const einCached = Number(det.cached_tokens || 0) || 0;
    const einText = Math.max(0, ein - einAudio - einCached);
    const sekunden = (u.type === 'duration') ? (Number(u.seconds) || 0) : 0;

    const p = preisFuer(modell);
    const posten = { schritt, modell, ein, aus, einAudio, einCached, sekunden, bepreist: false, usd: 0 };
    if (p) {
      const satzAudio  = (p.einAudio  != null) ? p.einAudio  : p.ein;
      /* Kein Cache-Preis hinterlegt: zum vollen Satz rechnen. Lieber zu hoch
         als eine Ersparnis behaupten, die vielleicht nicht gilt. */
      const satzCached = (p.einCached != null) ? p.einCached : p.ein;
      posten.usd = (einText * p.ein + einAudio * satzAudio + einCached * satzCached + aus * p.aus) / 1e6;
      posten.bepreist = true;
      sammler.usdGesamt += posten.usd;
    } else if (sammler.ohnePreis.indexOf(modell) < 0) {
      sammler.ohnePreis.push(modell);
    }
    sammler.posten.push(posten);
  } catch (e) { /* eine Kostenmessung bricht nie eine Auswertung ab */ }
}

function kostenAbschluss(sammler) {
  if (!sammler) return null;
  const eur = sammler.usdGesamt * USD_EUR;
  return {
    eur_cent: Math.round(eur * 10000) / 100,   /* zwei Nachkommastellen im Cent */
    usd: Math.round(sammler.usdGesamt * 1e6) / 1e6,
    kurs: USD_EUR,
    vollstaendig: sammler.ohnePreis.length === 0,
    ohne_preis: sammler.ohnePreis,
    posten: sammler.posten
  };
}

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
      /* v1168-VBOOL: 'bool' ergaenzt. Ohne diesen Eintrag faellt ein
         Checkbox-Feld STILL auf 'text' zurueck — der Katalog kaeme durch, die
         KI lieferte "ja", und das Frontend haette einen String, wo es ein
         Haekchen setzen will. Die Whitelist ist der Grund, warum Checkboxen
         nicht einfach im Frontend freigeschaltet werden konnten. */
      kind: ['select', 'num', 'int', 'date', 'text', 'bool'].includes(e.kind) ? e.kind : 'text',
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

async function transcribe(buf, mime, apiKey, sammler) {
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
  usageErfassen(sammler, 'Transkription', TRANSCRIBE_MODEL, data);  /* v1259 */
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

function buildPrompt(transcript, catalog, zusatz) {
  const lines = catalog.map(e => {
    let l = '- ' + e.id + ' | ' + e.kind + ' | ' + e.label;
    if (e.hint) l += ' (' + e.hint + ')';
    if (e.kind === 'select') {
      l += '\n  ERLAUBTE WERTE: ' + e.options.map(o => '"' + o.v + '"=' + o.t).join(', ');
    }
    /* v1168-VBOOL: Ohne diese Zeile steht im Prompt nur "bool" als Typ — das
       Modell raet dann zwischen true, "ja" und 1. Und die zweite Haelfte ist
       die wichtigere: NUR nennen, wenn es zutrifft. Sonst listet das Modell
       gewissenhaft alle Haekchen mit false auf und die Import-Tabelle
       quillt ueber mit Nicht-Befunden. */
    if (e.kind === 'bool') {
      l += '\n  NUR true, wenn es im Text ausdruecklich zutrifft. Trifft es nicht zu oder wird es nicht erwaehnt: Feld WEGLASSEN, nicht false.';
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
    '14. INVENTAR: `moebl` ist die GESAMTSUMME des Inventars. Werden EINZELPOSTEN\n' +
    '    genannt ("Kueche 8.000, Moebel 3.000"), fuelle NUR inv_kueche, inv_moebel,\n' +
    '    inv_geraete und lass `moebl` WEG — es wird aus den Einzelposten berechnet.\n' +
    '    Nur wenn ein einziger Gesamtbetrag ohne Aufschluesselung genannt wird\n' +
    '    ("Inventar 11.000 Euro"), gehoert er nach `moebl`. Beides gleichzeitig\n' +
    '    zu setzen zerstoert den Einzelposten-Wert.\n' +
    '13. HAUSGELD-AUFTEILUNG: hg_ul = umlagefaehiger Anteil, hg_nul = NICHT\n' +
    '    umlagefaehiger Anteil. Wird ein GESAMT-Hausgeld plus ein nicht-umlagefaehiger\n' +
    '    Anteil genannt (z.B. "Hausgeld 300, davon 100 nicht umlagefaehig"), dann\n' +
    '    hg_nul = 100 und hg_ul = Gesamt minus nicht-umlagefaehig = 200. Werden beide\n' +
    '    Anteile direkt genannt, uebernimm sie 1:1. Nur ein Hausgeld-Wert ohne\n' +
    '    Aufteilung -> in hg_ul.\n' +
    (zusatz ? zusatz + String.fromCharCode(10) : "") +
    'TRANSKRIPT:\n"""\n' + transcript + '\n"""';
}

async function extractFields(transcript, catalog, apiKey, sammler, zusatz) {
  transcript = stripTermDump(transcript);  /* v515 */
  let r;
  try {
    r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        input: [{ role: 'user', content: buildPrompt(transcript, catalog, zusatz) }],
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
  usageErfassen(sammler, 'Auswertung', EXTRACT_MODEL, data);  /* v1259 */
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
    } else if (entry.kind === 'bool') {
      /* v1168-VBOOL · Ein Haekchen kennt zwei Zustaende, die KI liefert je
         nach Formulierung true, "true", "ja" oder 1.
         NUR JA-Antworten kommen durch. Ein "nein" wird VERWORFEN statt als
         false uebernommen — sonst haekelt ein beilaeufiges "einen Stellplatz
         gibt es nicht" ein Feld aktiv ab, das der Nutzer nie angefasst hat.
         Die Import-Tabelle zeigt nur, was gesetzt wird; ein stilles
         Abhaeken waere dort unsichtbar. */
      const bv = (typeof v === 'boolean') ? v
        : ['true', 'ja', 'yes', '1'].includes(String(v).toLowerCase().trim());
      if (!bv) return;
      fields[k] = true;
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
  const sammler = neuerSammler();  /* v1259 */
  const transcript = await transcribe(buf, mime, key, sammler);
  if (!transcript || transcript.length < 10) throw httpErr(422, 'Keine Sprache erkannt \u2014 bitte erneut aufnehmen.');
  let out = await extractFields(transcript, cat, key, sammler);
  if (VERIFY_ON) { try { out = await verifyFields(transcript, out, cat, key, sammler); } catch (e) {} }  /* v522 verify-pass, fail-soft */

  /* v1259 \u00b7 Der eigene Schluessel eines Nutzers ist SEINE Rechnung, nicht
     unsere. Kosten werden nur ausgewiesen, wenn der Server-Key gezahlt hat. */
  const kosten = o.userApiKey ? null : kostenAbschluss(sammler);
  if (kosten) {
    try {
      console.log('[voice/kosten] %s ct (EUR) | %s | %s',
        kosten.eur_cent.toFixed(2),
        kosten.vollstaendig ? 'vollstaendig' : ('ohne Preis: ' + kosten.ohne_preis.join(', ')),
        kosten.posten.map(p => p.schritt + ' ' + (p.ein || 0) + '/' + (p.aus || 0)).join(' | '));
    } catch (e) {}
  }
  return { transcript, fields: out.fields, unsicher: out.unsicher, kosten };
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
  /* v1259 · Die Live-Hilfe laeuft bis zu sechsmal je Aufnahme und kostet
     jedes Mal. Sie gehoert in die Rechnung, sonst zaehlt „was kostet eine
     Aufnahme" nur die Haelfte. Eigener Sammler, weil dieser Aufruf ueber
     eine eigene Route laeuft — das Frontend addiert beide Seiten. */
  const sammler = neuerSammler();
  usageErfassen(sammler, 'Live-Hilfe', QUICKMATCH_MODEL, data);
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
  return { ids: arr.filter(id => valid.has(id)), kosten: kostenAbschluss(sammler) };  /* v1259 */
}

/* v522: Verifikations-Pass (2. KI-Call), prueft/korrigiert Felder gegen das Transkript. */
/* v1170-VNOVERIFY: Standard von AN auf AUS gedreht — Marcels Entscheidung
   („mach den Pass weg wenn das schneller ist").

   Der Verifikations-Pass ist ein VOLLSTAENDIGER zweiter KI-Aufruf: er schickt
   Transkript UND das erste Ergebnis noch einmal weg und laesst gegenpruefen.
   Damit kostet er ungefaehr so viel Wartezeit wie die Auswertung selbst — der
   groesste einzelne Hebel beim Tempo.

   NICHT geloescht, nur abgeschaltet. Der Code bleibt vollstaendig und laeuft
   wieder, sobald OPENAI_VOICE_VERIFY=1 gesetzt wird. Kehrt die Qualitaet
   sichtbar zurueck (falsch zugeordnete Zahlen, verwechselte Felder), ist das
   die erste Stellschraube — dann war der Pass sein Geld wert und die
   Entscheidung gehoert neu gestellt.

   Der Aufruf in Zeile ~276 ist ohnehin fail-soft: faellt der Pass aus, gilt
   das Erstergebnis. Abschalten aendert also nichts am Verhalten im Fehlerfall,
   nur an der Regel. */
const VERIFY_ON = String(process.env.OPENAI_VOICE_VERIFY || '0') !== '0';
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

async function verifyFields(transcript, prev, catalog, apiKey, sammler) {
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
  usageErfassen(sammler, 'Gegenpruefung', VERIFY_MODEL, data);  /* v1259 */
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
    } else if (entry.kind === 'bool') {
      /* v1168-VBOOL · Ein Haekchen kennt zwei Zustaende, die KI liefert je
         nach Formulierung true, "true", "ja" oder 1.
         NUR JA-Antworten kommen durch. Ein "nein" wird VERWORFEN statt als
         false uebernommen — sonst haekelt ein beilaeufiges "einen Stellplatz
         gibt es nicht" ein Feld aktiv ab, das der Nutzer nie angefasst hat.
         Die Import-Tabelle zeigt nur, was gesetzt wird; ein stilles
         Abhaeken waere dort unsichtbar. */
      const bv = (typeof v === 'boolean') ? v
        : ['true', 'ja', 'yes', '1'].includes(String(v).toLowerCase().trim());
      if (!bv) return;
      fields[k] = true;
    } else {
      fields[k] = v;
    }
  });
  /* Sicherheitsnetz: leert der Pass (fast) alles, lieber Original behalten */
  if (Object.keys(fields).length === 0 && Object.keys((prev && prev.fields) || {}).length > 0) return prev;
  return { fields: fields, unsicher: unsicher };
}

/* ════════════════════════════════════════════════════════════════════
 * v1273 · Kurzantwort aus TEXT statt aus Audio
 *
 * Fuer die Rueckfragen nach der Auswertung: der Co-Pilot fragt nach dem,
 * was fehlt, und man darf tippen statt zu sprechen. Getippt gibt es kein
 * Audio - also faellt die Transkription weg, und mit ihr der groesste
 * Kostenposten. Uebrig bleibt EIN kleiner Extraktionslauf auf einem
 * Katalog von zwei, drei Feldern statt 250.
 *
 * Bewusst dieselbe Antwortform wie extractFromAudio ({fields, unsicher,
 * kosten}), damit das Frontend beide Wege gleich behandelt. `transcript`
 * ist der eingegebene Text - so bleibt nachvollziehbar, worauf sich eine
 * Zuordnung stuetzt.
 *
 * Die Verifikationsrunde laeuft hier NICHT: sie prueft das Transkript
 * gegen die Felder, und bei einer getippten Antwort auf eine gezielte
 * Frage gibt es nichts zu verifizieren - der Text IST die Antwort.
 * ════════════════════════════════════════════════════════════════════ */
async function extractFromText(text, catalog, opts) {
  const o = opts || {};
  const key = o.userApiKey || o.apiKey;
  if (!key) { const e = new Error('Kein OpenAI-API-Key verfuegbar.'); e.code = 'NO_API_KEY'; throw e; }
  const cat = sanitizeCatalog(catalog);
  if (!cat.length) throw httpErr(400, 'Feld-Katalog fehlt oder ist leer.');
  const t = String(text || '').trim().slice(0, 4000);
  if (t.length < 1) throw httpErr(400, 'Keine Antwort uebergeben.');
  const sammler = neuerSammler();
  /* v1275b · Der Zusatz macht aus einem Diktat-Parser einen Antwort-Parser.
     Gemessen: auf "490 Euro kalt im Monat" kam bei EINEM Feld im Katalog der
     ganze Satz als Wert zurueck - das Modell hatte ja nur dieses eine Fach.
     Bei "245.000 Euro" ging es gut. Der Unterschied ist Zufall, solange im
     Prompt nichts steht, was den Fall benennt. */
  const ZUSATZ = [
    'ZUSATZREGEL FUER DIESE ANFRAGE: Der Text ist die kurze ANTWORT auf eine',
    'gezielte Rueckfrage zu genau den Feldern im Katalog. Uebernimm NUR den',
    'WERT, niemals den ganzen Satz. "490 Euro kalt im Monat" -> 490,',
    '"so um die hundert Quadratmeter" -> 100, "Baujahr war 62" -> 1962.',
    'Enthaelt die Antwort keinen verwertbaren Wert ("weiss nicht", "keine',
    'Ahnung"), gib ein leeres JSON-Objekt zurueck.'
  ].join(String.fromCharCode(10));
  const out = await extractFields(t, cat, key, sammler, ZUSATZ);
  const kosten = o.userApiKey ? null : kostenAbschluss(sammler);
  return { transcript: t, fields: out.fields, unsicher: out.unsicher, kosten };
}

module.exports = { extractFromAudio, extractFromText, quickMatch, transcribe };  /* v536: transcribe fuer Live-Chunks */
