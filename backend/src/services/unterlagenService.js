'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   unterlagenService.js — v1833
   UNTERLAGEN BEIM AMT ANFORDERN
   ═══════════════════════════════════════════════════════════════════════

   Marcel am 04.10.2026: „dann habe ich dir in unseren Dateienordner …
   Unterlagen-App reingegeben. Das wäre also ganz cool, wenn wir
   irgendwelche Unterlagen für ein Objekt brauchen, dass wir die halt
   anfragen können … und dass da halt auch immer vernünftige Sachen bei
   rauskommen."

   Die Fachdaten — Zuständigkeitsregeln und Anschreiben — stammen aus
   seiner eigenständigen Unterlagen-App. Sie sind sorgfältig gemacht und
   juristisch belegt (§ 12 GBO beim Grundbuch, kein Baulastenverzeichnis
   in Bayern) und werden hier übernommen, nicht neu erfunden.

   ── WARUM NICHT DIE APP ANBINDEN ────────────────────────────────────────

   Die App läuft auf dem eigenen Rechner (localhost:8787), hat keinen
   Login und sagt das selbst: „Nicht ohne Zugangsschutz auf einen Server
   stellen." Eine HTTPS-Seite darf zudem kein http://localhost rufen.
   Beides zusammen heißt: anbinden geht nicht, übernehmen geht.

   ── DIE REGEL, DIE HIER ÜBERALL GILT ────────────────────────────────────

   Eine Mailadresse, die niemand belegt hat, ist eine Behauptung. Die KI
   nennt die Seite, auf der sie sie gelesen hat — und dieser Dienst ruft
   die Seite SELBST ab und sieht nach. Steht sie nicht da, wird der Satz
   trotzdem gespeichert, aber als `beleg_ok: false` und mit Warnung.

     > Lieber eine Adresse mit Warnung als eine ohne Zweifel. Wer eine
     > unbelegte Adresse stillschweigend anbietet, lässt den Nutzer in
     > seinem Namen an die falsche Stelle schreiben.

   DealPilot verschickt NICHTS von selbst. Der Dienst erzeugt Entwürfe.
   ═══════════════════════════════════════════════════════════════════════ */
const { query } = require('../db/pool');
const openaiService = require('./openaiService');

/* ── Die fünf Unterlagen ────────────────────────────────────────────────
 *
 * `regel` ist die Zuständigkeitsregel, die der Recherche mitgegeben wird.
 * `bitte` ist der Satz, der im Anschreiben steht — er nennt die
 * Rechtsgrundlage, wo es eine gibt. */
const ARTEN = [
  {
    id: 'flurkarte', name: 'Flurkarte',
    regel: 'Auszug aus der Liegenschaftskarte. Zuständig ist das Katasteramt '
         + '(Vermessungs- und Katasteramt) des Kreises bzw. der kreisfreien Stadt; '
         + 'in manchen Bundesländern ein Landesamt mit Regionalstellen.',
    betreff: 'Auszug aus der Liegenschaftskarte (Flurkarte)',
    bitte: 'Ich bitte um Übersendung eines aktuellen Auszugs aus der '
         + 'Liegenschaftskarte (Flurkarte, Maßstab 1:1000) sowie, sofern möglich, '
         + 'des Flurstücks- und Eigentumsnachweises.'
  },
  {
    id: 'grundbuch', name: 'Grundbuchauszug',
    regel: 'Grundbuchauszug. Zuständig ist das Grundbuchamt beim Amtsgericht, in '
         + 'dessen Bezirk die Gemeinde liegt (in Baden-Württemberg zentrale '
         + 'grundbuchführende Amtsgerichte).',
    betreff: 'Antrag auf unbeglaubigten Grundbuchauszug',
    bitte: 'Ich beantrage die Erteilung eines vollständigen, unbeglaubigten '
         + 'Grundbuchauszugs (Bestandsverzeichnis, Abteilung I bis III). Das '
         + 'berechtigte Interesse gemäß § 12 GBO ergibt sich aus der Vollmacht '
         + 'des Eigentümers.'
  },
  {
    id: 'altlasten', name: 'Altlastenauskunft',
    regel: 'Auskunft aus dem Altlastenkataster. Zuständig ist die untere '
         + 'Bodenschutzbehörde, meist beim Kreis bzw. der kreisfreien Stadt '
         + '(Umweltamt).',
    betreff: 'Auskunft aus dem Altlastenkataster',
    bitte: 'Ich bitte um Auskunft, ob das Grundstück im Altlastenkataster bzw. '
         + 'im Verzeichnis der Altlastenverdachtsflächen geführt wird, und '
         + 'gegebenenfalls um Mitteilung der vorliegenden Erkenntnisse.'
  },
  {
    id: 'baulasten', name: 'Baulastenauskunft',
    regel: 'Auskunft aus dem Baulastenverzeichnis. Zuständig ist die untere '
         + 'Bauaufsichtsbehörde: die Stadt/Gemeinde, falls sie eine eigene '
         + 'Bauaufsicht hat, sonst der Kreis (Bauamt, Bauordnungsamt, Bau- und '
         + 'Planungsamt), nicht das Katasteramt. In Bayern gibt es kein '
         + 'Baulastenverzeichnis; nenne das dann im Hinweis.',
    betreff: 'Auskunft aus dem Baulastenverzeichnis',
    bitte: 'Ich bitte um Auskunft aus dem Baulastenverzeichnis, ob zulasten oder '
         + 'zugunsten des Grundstücks Baulasten eingetragen sind, und '
         + 'gegebenenfalls um Übersendung der Baulastenblätter in Kopie.'
  },
  {
    id: 'bauakte', name: 'Bauakte',
    regel: 'Einsicht in die Bauakte. Zuständig ist das Bauaktenarchiv der unteren '
         + 'Bauaufsichtsbehörde: die Stadt/Gemeinde, falls sie eine eigene '
         + 'Bauaufsicht hat, sonst der Kreis.',
    betreff: 'Einsicht in die Bauakte',
    bitte: 'Ich bitte um Einsicht in die Bauakte des Objekts. Sofern die Akte '
         + 'digital vorliegt, bitte ich um Übersendung (insbesondere '
         + 'Baugenehmigungen, Grundrisse, Schnitte, Ansichten, '
         + 'Flächenberechnungen und Baubeschreibung); andernfalls bitte ich um '
         + 'einen Terminvorschlag zur Einsichtnahme.'
  }
];
const ARTEN_MAP = {};
ARTEN.forEach((a) => { ARTEN_MAP[a.id] = a; });

/* Gewerbliche Bestellportale sind keine amtliche Quelle — auch nicht für
   die Zuständigkeit. Sie sehen auf den ersten Blick amtlich aus, und
   genau darauf sind sie gebaut. */
/* ── v1833c · DAS MUSTER WAR ZU ENG ───────────────────────────────────────
 *
 * GEMESSEN am 04.10.2026: die Grundbuch-Recherche für Hüllhorst nannte als
 * Quelle `portal-grundbuchamt.de` — ein gewerblicher Antragsservice, der
 * sich im eigenen Hinweis als „privater Antragsservice" zu erkennen gibt.
 * Mein Muster fing ihn NICHT, weil es „portal" nur als Nachsilbe kannte
 * (`katasteramt-portal`), nicht als Vorsilbe.
 *
 * Gehalten hat trotzdem die zweite Linie: die Adresse stand dort nicht,
 * also kein Beleg. Genau dafür sind es zwei Prüfungen.
 *
 *   > Ein Filter, der einmal durchlässt, ist kein kaputter Filter — er ist
 *   > der Grund, warum es einen zweiten gibt. Beide zu haben ist die
 *   > Entscheidung, nicht den einen perfekt zu machen.
 *
 * Erkannt wird jetzt in beide Richtungen, und die amtlichen Domains sind
 * ausdrücklich ausgenommen: eine echte Behördenseite endet auf `.de` unter
 * einem Kreis-, Stadt-, Landes- oder Justiznamen, und `justiz.nrw.de`
 * enthält selbst das Wort „justiz" — ein blindes Muster würde sie treffen. */
const AMTLICH = /(^|\.)((kreis|stadt|gemeinde|landkreis|bezirk)-[a-z-]+|justiz|service|serviceportal|amt24|buergerservice)\.[a-z]{2,}$|\.(bund|nrw|bayern|berlin|hamburg|bremen|sachsen|thueringen|niedersachsen|hessen|rlp|saarland|schleswig-holstein|brandenburg|mv-regierung|sachsen-anhalt|baden-wuerttemberg)\.de$/i;
const GEWERBLICH = new RegExp(
  '(katasteramt|baulastenverzeichnis|grundbuchauszug|grundbuchamt|altlasten|bauakte|flurkarte|grundbuch)'
  + '[-._]?(online|portal|direkt|service|24|express|jetzt|antrag)'
  + '|(online|portal|direkt|express|mein|dein)[-._]?'
  + '(katasteramt|baulastenverzeichnis|grundbuchauszug|grundbuchamt|bauakte|flurkarte|grundbuch)'
  + '|geoindex|immobilien-?scout|grundbuch24|antragsservice|\\.shop\\b', 'i');

function istGewerblich(url) {
  if (!url) return false;
  let wirt = String(url), pfad = '';
  try { const x = new URL(url); wirt = x.hostname; pfad = x.pathname; }
  catch (e) { /* kein gueltiger Link — dann gegen die ganze Zeichenkette */ }
  /* Eine amtliche Domain bleibt amtlich, auch wenn ihr Pfad ein
     Schlagwort enthält (`justiz.nrw.de/grundbuchamt`). */
  if (AMTLICH.test(wirt)) return false;
  return GEWERBLICH.test(wirt + pfad);
}

function gemeindeSchluessel(plz, ort) {
  return String((plz || '') + '-' + (ort || ''))
    .toLowerCase().trim()
    .replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '');
}

function _s(v) { return typeof v === 'string' ? v.trim() : ''; }
function _link(v) { return /^https?:\/\//i.test(_s(v)) ? _s(v) : ''; }

/* ── v1844 · EINE ADRESSE MUSS WIE EINE AUSSEHEN ───────────────────────────
 *
 * GEMESSEN am 04.10.2026 beim ersten „Alle abrufen" für Hüllhorst: zwei
 * Ämter kamen mit der Adresse `email` zurück — dem Wort, nicht einer
 * Adresse. Das Modell hatte meinen JSON-Schlüssel als Wert zurückgegeben.
 * Gespeichert wurde es, angezeigt wurde es, und „Im Mailprogramm öffnen"
 * hätte `mailto:email` gebaut.
 *
 * Die Belegprüfung hielt („nicht belegt") — aber sie prüfte, ob „email"
 * auf der Quellseite steht. Das Wort steht auf fast jeder Seite. Ein
 * Zufallstreffer hätte die Zeile grün gemacht.
 *
 *   > Was keine Adresse sein kann, darf nicht als Adresse geprüft werden.
 *   > Eine Prüfung, die auf ein Nichts ein Ja sagen kann, ist keine.
 *
 * Deshalb EINE Stelle für die Form, und beide Wege nutzen sie: der
 * Rückweg der Recherche und die Belegprüfung. Streng: ein @, danach eine
 * Domain mit Punkt, keine Leerzeichen, kein Platzhalterwort. */
function mailGueltig(v) {
  const s = _s(v).toLowerCase();
  if (!s) return false;
  if (/^(email|e-mail|mail|keine|none|null|n\/a|—|-)$/.test(s)) return false;
  return /^[^\s@<>()[\]]+@[^\s@<>()[\]]+\.[a-z]{2,}$/.test(s);
}

/* Trackingparameter raus, bevor die Seite abgerufen oder gespeichert wird.
   Die Websuche hängt `?utm_source=openai` an — gemessen an Hüllhorst. Eine
   Quellenangabe, die verrät, über welches Werkzeug sie gefunden wurde,
   gehört nicht in einen Nachweis, und manche Server antworten darauf
   anders. */
function _sauber(url) {
  const u = _link(url);
  if (!u) return '';
  try {
    const x = new URL(u);
    for (const p of [...x.searchParams.keys()]) {
      if (/^utm_|^ref$|^source$|^fbclid$|^gclid$/i.test(p)) x.searchParams.delete(p);
    }
    return x.toString();
  } catch (e) { return u; }
}

function _findeJson(text) {
  if (!text) return null;
  const roh = String(text);
  const von = roh.lastIndexOf('{');
  if (von < 0) return null;
  /* Von hinten, weil die Websuche davor Text schreiben kann. */
  for (let bis = roh.length; bis > von; bis--) {
    const stueck = roh.slice(von, bis);
    if (stueck.trim().endsWith('}')) {
      try { return JSON.parse(stueck); } catch (e) { /* weiter */ }
    }
  }
  return null;
}

/* ═══ DIE BELEGPRÜFUNG ══════════════════════════════════════════════════
 *
 * Wir rufen die genannte Quellseite ab und sehen nach, ob die Adresse dort
 * wirklich steht. Das ist der Unterschied zwischen „die KI sagt" und „wir
 * haben nachgesehen".
 *
 * Gesucht wird unscharf: viele Behördenseiten schreiben die Adresse mit
 * (at) oder als JavaScript-Schnipsel gegen Erntemaschinen. Eine Adresse,
 * die so geschützt ist, gilt als belegt, wenn Konto und Domain beide
 * auftauchen. */
async function belegPruefen(email, quelleUrl) {
  if (!email) return { ok: false, grund: 'keine Adresse genannt' };
  /* v1844 · Vor dem Abruf der Quelle: kann das überhaupt eine Adresse
     sein? „email" steht auf fast jeder Seite — eine Belegprüfung darauf
     wäre ein Zufallsgenerator. */
  if (!mailGueltig(email)) return { ok: false, grund: 'keine gültige Adresse (' + _s(email).slice(0, 30) + ')' };
  if (!quelleUrl) return { ok: false, grund: 'keine Quelle genannt' };
  if (istGewerblich(quelleUrl)) {
    return { ok: false, grund: 'die Quelle ist ein gewerbliches Portal, keine amtliche Seite' };
  }
  let text = '';
  try {
    const a = await fetch(quelleUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'DealPilot/1.0 (Immobilienbewertung; Belegpruefung)' },
      signal: AbortSignal.timeout(12000)
    });
    if (!a.ok) return { ok: false, grund: 'Quelle antwortete mit HTTP ' + a.status };
    text = (await a.text()).toLowerCase();
  } catch (e) {
    return { ok: false, grund: 'Quelle nicht erreichbar: ' + (e.message || e) };
  }
  const adr = String(email).toLowerCase();
  if (text.includes(adr)) return { ok: true, grund: 'wörtlich auf der Quellseite gefunden' };
  const [konto, domain] = adr.split('@');
  if (konto && domain && text.includes(konto) && text.includes(domain)) {
    return { ok: true, grund: 'auf der Quellseite gefunden (gegen Erntemaschinen getrennt geschrieben)' };
  }
  return { ok: false, grund: 'die Adresse steht nicht auf der genannten Quellseite' };
}

/* ═══ DIE RECHERCHE ═════════════════════════════════════════════════════
 *
 * Der Prompt stammt aus Marcels App und bleibt in seiner Strenge: nur
 * amtliche Seiten, keine geratene Adresse, Funktionspostfach statt
 * persönlichem. */
async function amtSuchen(art, ort, opts = {}) {
  const u = ARTEN_MAP[art];
  if (!u) throw new Error('Unbekannte Unterlagenart: ' + art);
  const adresse = [ort.strasse, [ort.plz, ort.ort].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');

  const nachtrag = opts.nachtrag || '';
  const prompt = 'Du recherchierst für einen Immobiliensachverständigen die '
    + 'zuständige Behörde in Deutschland.\n\n'
    + 'Objekt: ' + adresse + '\n'
    + 'Gesuchte Unterlage: ' + u.name + '\n'
    + 'Zuständigkeitsregel: ' + u.regel + '\n\n'
    + 'Nutze die Websuche und ermittle die Kontaktdaten für genau diese Anfrage. Regeln:\n'
    + '- Verwende nur offizielle Seiten: die Behörde selbst, Kreis, Stadt oder '
    + 'Gemeinde, Land, Justiz oder kommunale Serviceportale. Gewerbliche Bestell- '
    + 'und Vermittlungsportale sind keine Quelle, auch nicht für die Zuständigkeit.\n'
    + '- Die Zuständigkeit muss sich aus einer offiziellen Seite ergeben. Weicht '
    + 'sie von der Regel oben ab, gilt die offizielle Seite; nenne das im Hinweis.\n'
    + '- Gib nur eine E-Mail-Adresse an, die du wörtlich auf einer offiziellen '
    + 'Seite gelesen hast. Rate keine Adresse aus dem Namen des Amts. Findest du '
    + 'keine, bleibt "email" leer.\n'
    + '- Nimm die Funktionsadresse des Fachbereichs (z. B. katasteramt@…), kein '
    + 'persönliches Postfach einzelner Beschäftigter, solange es eine '
    + 'Funktionsadresse gibt.\n'
    + '- Schreibe die Adresse in einfachen Zeichen mit normalem Bindestrich.\n'
    + '- "quelle" ist ein PFLICHTFELD: dort gehört die URL der Seite hinein, '
    + 'auf der du die Adresse gelesen hast. Schreibe den Link nicht in den '
    + 'Hinweis und nicht in den Fließtext, sondern in dieses Feld.\n'
    + '- Stelle keine Rückfragen und bitte nicht um Erlaubnis. Antworte direkt.'
    + nachtrag + '\n\n'
    + 'Antworte am Ende ausschließlich mit einem JSON-Objekt, ohne Einleitung '
    + 'und ohne Markdown:\n'
    + '{"behoerde":"","abteilung":"","email":"","telefon":"","kanal":"email | portal | formular | post",'
    + '"antragUrl":"","quelle":"","seiten":[],"gebuehr":"","hinweis":"","kreis":"","bundesland":""}';

  const antwort = await openaiService.callOpenAI(prompt, {});
  const r = _findeJson(antwort && (antwort.text || antwort.output_text || antwort));
  if (!r || !r.behoerde) {
    const e = new Error('Keine eindeutige Behörde gefunden.');
    e.rohtext = String((antwort && (antwort.text || antwort.output_text)) || '').slice(0, 400);
    throw e;
  }

  /* Stammt die Auskunft von einem gewerblichen Portal, EINMAL mit klarer
     Ansage neu suchen — nicht endlos, sonst dreht sich das im Kreis. */
  if (istGewerblich(_link(r.quelle)) && !opts.nachtrag) {
    return amtSuchen(art, ort, {
      nachtrag: '\n- Die zuvor gefundene Quelle war ein gewerbliches Portal. '
              + 'Suche ausschließlich auf der Seite des Kreises, der Stadt, der '
              + 'Gemeinde, des Landes oder der Justiz.'
    });
  }

  /* ── v1833b · DEN BELEG EINSAMMELN, WO ER WIRKLICH LIEGT ───────────────
   *
   * GEMESSEN am 04.10.2026 an Hüllhorst: das Modell fand beide Behörden
   * richtig (Kreis Minden-Lübbecke, Amtsgericht Lübbecke), ließ `quelle`
   * aber LEER und schrieb den Link stattdessen in den Hinweis:
   *
   *     "... ([minden-luebbecke.de](https://www.minden-luebbecke.de/...))"
   *
   * Die Belegprüfung meldete daraufhin „keine Quelle genannt" — richtig
   * nach ihrer Regel und trotzdem falsch, denn die Quelle stand da.
   *
   *   > Eine Angabe im falschen Feld ist keine fehlende Angabe. Wer sie
   *   > als fehlend behandelt, verwirft, was er schon hat.
   *
   * Deshalb wird der Beleg jetzt aus allen drei Stellen eingesammelt:
   * `quelle`, `seiten`, und zuletzt die Links im Fließtext des Hinweises.
   * Das ist keine Nachsicht — geprüft wird danach genauso streng. */
  let quelle = _link(r.quelle);
  const seiten = Array.isArray(r.seiten) ? r.seiten.map(_link).filter(Boolean) : [];
  const hinweisLinks = (_s(r.hinweis).match(/https?:\/\/[^\s)\]"']+/g) || []);
  if (!quelle) quelle = seiten.find((u) => !istGewerblich(u)) || '';
  if (!quelle) quelle = hinweisLinks.find((u) => !istGewerblich(u)) || '';

  return {
    behoerde: _s(r.behoerde), abteilung: _s(r.abteilung),
    /* v1844 · Nur, was eine Adresse sein kann. Sonst leer — und leer heißt
       im Modal „nur über das Portal" oder „keine Adresse", nie `mailto:`. */
    email: mailGueltig(r.email) ? _s(r.email).toLowerCase() : '',
    telefon: _s(r.telefon),
    kanal: ['email', 'portal', 'formular', 'post'].includes(_s(r.kanal)) ? _s(r.kanal) : 'email',
    antrag_url: _link(r.antragUrl), quelle_url: _sauber(quelle),
    seiten: [...new Set(seiten.concat(hinweisLinks))].map(_sauber).slice(0, 8),
    gebuehr: _s(r.gebuehr), hinweis: _s(r.hinweis),
    kreis: _s(r.kreis), bundesland: _s(r.bundesland)
  };
}

/* ═══ ERNTEN: suchen, belegen, hinterlegen ══════════════════════════════
 *
 * `erzwingen: true` sucht neu, auch wenn ein Satz da ist. Sonst wird der
 * hinterlegte genommen — das ist der Sinn der Tabelle. */
async function amtHolen(userId, art, ort, opts = {}) {
  const schluessel = gemeindeSchluessel(ort.plz, ort.ort);
  if (!schluessel || schluessel === '-') {
    return { gefunden: false, grund: 'Ohne Postleitzahl und Ort lässt sich keine Zuständigkeit bestimmen.' };
  }
  if (!opts.erzwingen) {
    const vorhanden = await query(
      `SELECT * FROM unterlagen_aemter WHERE gemeinde_schluessel = $1 AND art = $2`,
      [schluessel, art]);
    if (vorhanden.rows.length) {
      return { gefunden: true, aus_register: true, amt: vorhanden.rows[0] };
    }
  }

  let gefunden;
  try { gefunden = await amtSuchen(art, ort); }
  catch (e) {
    return { gefunden: false, grund: e.message || String(e), rohtext: e.rohtext || null };
  }

  const beleg = await belegPruefen(gefunden.email, gefunden.quelle_url);

  const r = await query(
    `INSERT INTO unterlagen_aemter
       (gemeinde_schluessel, plz, ort, art, behoerde, abteilung, email, telefon,
        kanal, antrag_url, quelle_url, seiten, gebuehr, hinweis, kreis, bundesland,
        beleg_ok, beleg_grund, geprueft_am, erstellt_von)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now(),$19)
     ON CONFLICT (gemeinde_schluessel, art) DO UPDATE SET
       behoerde = EXCLUDED.behoerde, abteilung = EXCLUDED.abteilung,
       email = EXCLUDED.email, telefon = EXCLUDED.telefon, kanal = EXCLUDED.kanal,
       antrag_url = EXCLUDED.antrag_url, quelle_url = EXCLUDED.quelle_url,
       seiten = EXCLUDED.seiten, gebuehr = EXCLUDED.gebuehr,
       hinweis = EXCLUDED.hinweis, kreis = EXCLUDED.kreis,
       bundesland = EXCLUDED.bundesland, beleg_ok = EXCLUDED.beleg_ok,
       beleg_grund = EXCLUDED.beleg_grund, geprueft_am = now()
     RETURNING *`,
    [schluessel, ort.plz || null, ort.ort || null, art, gefunden.behoerde,
     gefunden.abteilung || null, gefunden.email || null, gefunden.telefon || null,
     gefunden.kanal, gefunden.antrag_url || null, gefunden.quelle_url || null,
     JSON.stringify(gefunden.seiten), gefunden.gebuehr || null,
     gefunden.hinweis || null, gefunden.kreis || null, gefunden.bundesland || null,
     beleg.ok, beleg.grund, userId || null]);

  return { gefunden: true, aus_register: false, amt: r.rows[0], beleg: beleg };
}

/* ═══ DAS ANSCHREIBEN ═══════════════════════════════════════════════════
 *
 * Ein Entwurf, kein Versand. Die Flurstücksangaben kommen mit, wenn sie da
 * sind — ohne sie muss das Amt selbst suchen, und das dauert. */
function anschreiben(art, objekt, absender) {
  const u = ARTEN_MAP[art];
  if (!u) throw new Error('Unbekannte Unterlagenart: ' + art);
  const o = objekt || {};
  const a = absender || {};
  const adresse = [o.strasse, [o.plz, o.ort].filter(Boolean).join(' ')]
    .filter(Boolean).join(', ');

  const flur = [
    o.gemarkung && ('Gemarkung ' + o.gemarkung),
    o.flur && ('Flur ' + o.flur),
    o.flurstueck && ('Flurstück ' + o.flurstueck)
  ].filter(Boolean);

  const zeilen = [];
  zeilen.push('Sehr geehrte Damen und Herren,');
  zeilen.push('');
  zeilen.push('ich bin mit der Bewertung des folgenden Objekts beauftragt:');
  zeilen.push('');
  zeilen.push('    ' + adresse);
  if (flur.length) zeilen.push('    ' + flur.join(' · '));
  if (o.eigentuemer) zeilen.push('    Eigentümer: ' + o.eigentuemer);
  zeilen.push('');
  zeilen.push(u.bitte);
  zeilen.push('');
  /* Die Vollmacht wird nur erwähnt, wenn sie wirklich beiliegt. Ein Satz
     über eine Anlage, die fehlt, kostet den ganzen Vorgang eine Runde. */
  if (a.vollmacht_liegt_bei) {
    zeilen.push('Die Vollmacht des Eigentümers liegt diesem Schreiben bei.');
  } else {
    zeilen.push('Eine Vollmacht des Eigentümers kann ich auf Anforderung '
      + 'unverzüglich nachreichen.');
  }
  zeilen.push('');
  zeilen.push('Für Rückfragen stehe ich gern zur Verfügung. Über eine kurze '
    + 'Mitteilung zu Bearbeitungsdauer und etwaigen Gebühren würde ich mich freuen.');
  zeilen.push('');
  zeilen.push('Mit freundlichen Grüßen');
  if (a.name) zeilen.push(a.name);
  if (a.firma) zeilen.push(a.firma);
  if (a.anschrift) zeilen.push(a.anschrift);
  if (a.telefon) zeilen.push('Telefon ' + a.telefon);
  if (a.email) zeilen.push(a.email);

  return {
    betreff: u.betreff + (o.strasse ? ' — ' + adresse : ''),
    text: zeilen.join('\n')
  };
}

/* ═══ LESEN: was die Ernte für eine Gemeinde schon hält ═════════════════
 *
 * v1844 · Das Modal zählte beim Öffnen „5 von 5 fehlen", obwohl für
 * Hüllhorst zwei Ämter längst hinterlegt waren — es erfuhr das erst beim
 * Klick. Eine Anzeige, die mehr Arbeit ankündigt als da ist, ist eine
 * falsche Anzeige. */
async function aemterFuer(plz, ort) {
  const schluessel = gemeindeSchluessel(plz, ort);
  if (!schluessel || schluessel === '-') return [];
  const r = await query(
    `SELECT * FROM unterlagen_aemter WHERE gemeinde_schluessel = $1 ORDER BY art`,
    [schluessel]);
  return r.rows;
}

module.exports = {
  ARTEN, ARTEN_MAP, gemeindeSchluessel, istGewerblich, mailGueltig,
  amtSuchen, amtHolen, aemterFuer, belegPruefen, anschreiben
};
