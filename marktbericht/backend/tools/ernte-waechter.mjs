#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════
   WÄCHTER FÜR DIE JÄHRLICHE NACHERNTE   ·   Backlog E5
   ═══════════════════════════════════════════════════════════════════════

   WAS DIESES WERKZEUG IST — UND WAS ES BEWUSST NICHT IST

   Gutachterausschüsse veröffentlichen jährlich. Das Register im Repo hält
   den Jahrgang, der beim Ernten gerade aktuell war. Ein Jahr später ist
   er still veraltet, und nichts im System widerspricht: eine Zahl aus dem
   Grundstücksmarktbericht 2024 sieht genauso aus wie eine aus 2026.

   Der Engpass ist dabei NICHT das Herunterladen. Der Engpass ist zu
   wissen, WO ein neuer Jahrgang erschienen ist. Ohne diese Liste fängt
   die Nachernte jedes Mal bei der Recherche an — genau der Satz, der
   deshalb in CLAUDE.md und im Backlog steht.

   Dieses Werkzeug SCHREIBT NICHTS. Keine Datenbank, keine Registerdatei,
   keine Zahl. Das ist kein Mangel an Ausbaustufe, sondern die Doktrin:

   > Wir erfinden keine Zahl.

   Ein Automat, der einen neuen Jahrgang herunterlädt und den Wert selbst
   ins Register überträgt, hätte niemanden, der das Anwendungsbeispiel des
   amtlichen Dokuments nachgerechnet hat — und der Prüfmaßstab ist
   ausdrücklich das Anwendungsbeispiel, nie eine selbst ausgerechnete
   Zahl. Ein solcher Automat würde also eine Herkunft behaupten, die er
   nicht geprüft hat. Das ist schlimmer als eine veraltete Zahl, denn eine
   veraltete Zahl trägt wenigstens ihren richtigen Jahrgang.

   Deshalb endet dieses Werkzeug bei der ARBEITSLISTE. Es sagt, wo
   nachzuernten ist, mit Link, Jahrgang und Alter. Das Nachrechnen bleibt
   bei Marcel.

   ── WARUM HTTP 200 HIER NICHTS BEWEIST ─────────────────────────────────

   Beide DealPilot-Domains antworten auf JEDEN Pfad mit 200 und liefern
   die index.html (rund 318 KB). Daran hing jahrelang das fehlende Logo
   auf den PDFs: der Prüfer sah 200 und war zufrieden. Fremde Behörden-
   Server tun dasselbe — bei `tlbg.thueringen.de` kam HTTP 200 mit
   `text/html` zurück, wo ein PDF stehen sollte: ein CAPTCHA.

   Deshalb meldet dieses Werkzeug IMMER `content-type` UND
   `content-length`, und eine URL mit PDF-/ZIP-Endung, die HTML liefert,
   ist ein TOTFUND — auch bei Status 200.

   ── WARUM ER SEINE DECKUNG NENNT ───────────────────────────────────────

   `gold-audit.py` las mit relativem Pfad 6 statt 181 Dateien und meldete
   trotzdem „sauber". Ein Prüfer, der grün wird, ohne gelesen zu haben,
   ist schlimmer als keiner. Unter 90 % Dateideckung bricht dieser Lauf
   ab — dieselbe Schwelle und derselbe Grund wie bei `register-saat.mjs`.

   ── ZEITSTEUERUNG ──────────────────────────────────────────────────────

   Ein Vorschlag, WANN dieser Wächter laufen sollte, liegt als Text unter
       design/Vorschläge/ernte-waechter-zeitsteuerung.md
   Dort steht KEIN crontab-Eintrag und kein systemd-Timer, der sich
   einfach ausführen lässt. Eine Zeitsteuerung einzurichten ist ein
   Server-Eingriff und gehört vorgelegt, nicht nebenbei getan.

   ── AUFRUF ─────────────────────────────────────────────────────────────

     node tools/ernte-waechter.mjs                 # Arbeitsliste, Top 20
     node tools/ernte-waechter.mjs --alle          # alle Ausschüsse
     node tools/ernte-waechter.mjs --offline       # ohne HTTP-Prüfung
     node tools/ernte-waechter.mjs --md            # Markdown für BACKLOG.md
     node tools/ernte-waechter.mjs --nur=TH        # nur ein Land
     node tools/ernte-waechter.mjs --faellig-ab=1  # schon ab 1 Jahr
     node tools/ernte-waechter.mjs --db            # Lauftabellen mitlesen
                                                   # (nur im Container)
   Jahresbezug: --jahr=2027 rechnet das Alter gegen ein anderes Jahr.
   ═══════════════════════════════════════════════════════════════════════ */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/* ── Schalter ───────────────────────────────────────────────────────── */
const arg = (n, d) => {
  const t = process.argv.find((a) => a.startsWith(`--${n}=`));
  return t ? t.slice(n.length + 3) : d;
};
const ALLE      = process.argv.includes('--alle');
const OFFLINE   = process.argv.includes('--offline');
const MD        = process.argv.includes('--md');
const MIT_DB    = process.argv.includes('--db');
const NUR       = String(arg('nur', '')).toUpperCase();
const FAELLIG_AB = parseInt(arg('faellig-ab', '2'), 10);
const JAHR      = parseInt(arg('jahr', String(new Date().getFullYear())), 10);
const ZEITLIMIT = parseInt(arg('zeitlimit', '15000'), 10);
const PARALLEL  = parseInt(arg('parallel', '6'), 10);
const LISTE_MAX = ALLE ? Infinity : parseInt(arg('top', '20'), 10);

const DIR = fileURLToPath(new URL('../src/lib/register/', import.meta.url));

/* Die zwei amtlichen Kennzahlen, auf die die Ernte zielt:
   Liegenschaftszinssatz (§ 21 Abs. 2 ImmoWertV) und Sachwertfaktor
   (§ 21 Abs. 3). Alles andere ist Beigabe — es fehlt nicht, wenn es
   fehlt. */
const SOLL_KENNZAHLEN = ['liegenschaftszinssatz', 'sachwertfaktor'];

/* Trennzeichen fuer die Gruppenschluessel. Es wird GENERIERT, nicht
   getippt: ein handgeschriebenes NUL in einer Quelldatei macht sie fuer
   grep zu einer Binaerdatei, waehrend `node --check` gruen bleibt — der
   Defekt faellt dann erst auf, wenn jemand in der Datei sucht und keine
   Treffer bekommt. Zeichen 31 (Unit Separator) kommt in keinem
   Ausschussnamen vor und ist druckbar-unsichtbar, aber nicht NUL. */
const TRENNER = String.fromCharCode(31);

/* ═══════════════════════════════════════════════════════════════════════
   1 · EINLESEN  —  und die Deckung nennen, bevor irgendetwas behauptet
       wird. Drei Sorten Datei liegen im Register:
         · Datensatzdatei  (Array von Sätzen)
         · Wegweiser       (Objekt: sagt, WELCHER Ausschuss WAS führt,
                            ohne selbst Werte zu tragen)
         · alles andere    = Ausfall, kommt ins Protokoll
   ══════════════════════════════════════════════════════════════════════ */
const alleDateien = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
let datensatzDateien = 0;
let wegweiserDateien = 0;
const probleme = [];
let saetze = [];
const wegweiser = [];

for (const f of alleDateien) {
  let j;
  try {
    j = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  } catch (e) {
    probleme.push(`${f} — unlesbar: ${e.message}`);
    continue;
  }
  if (Array.isArray(j)) {
    const mit = j.filter((r) => r && r.kennzahl && r.land_code);
    if (mit.length !== j.length) {
      probleme.push(`${f} — ${j.length - mit.length} Zeile(n) ohne kennzahl/land_code`);
    }
    datensatzDateien++;
    saetze = saetze.concat(mit.map((r) => ({ ...r, _datei: f })));
    continue;
  }
  if (j && j.was && (j.gebiete || j.ausschuesse)) {
    /* Ein Wegweiser ist kein Ausfall — dieselbe Unterscheidung wie in
       register-saat.mjs (v1757b). Er zählt aber DOPPELT für die Ernte:
       er sagt, dass es dort Daten gibt, die noch nicht im Register
       liegen. Genau das ist eine Nachernte-Aufgabe. */
    wegweiserDateien++;
    wegweiser.push({ ...j, _datei: f });
    continue;
  }
  probleme.push(`${f} — weder Datensatzdatei noch Wegweiser (${typeof j})`);
}

const gelesen = datensatzDateien + wegweiserDateien;
const deckung = alleDateien.length ? gelesen / alleDateien.length : 0;

/* ═══════════════════════════════════════════════════════════════════════
   2 · GRUPPIEREN JE AUSSCHUSS
       `gaa_name` ist die natürliche Klammer. 1.019 Sätze tragen aber
       keinen (die NRW-Sammeldateien aus BORIS, Gemeinde für Gemeinde) —
       die werden zu einer SAMMELQUELLE je Datei und Land zusammengefasst,
       statt 400 Pseudo-Ausschüsse zu erzeugen. Eine Gemeinde ist kein
       Gutachterausschuss.
   ══════════════════════════════════════════════════════════════════════ */
const gruppen = new Map();
for (const r of saetze) {
  const name = r.gaa_name || `(Sammelquelle ohne Ausschussangabe · ${r._datei})`;
  const key = `${r.land_code}${TRENNER}${name}`;
  if (!gruppen.has(key)) {
    gruppen.set(key, {
      land: r.land_code,
      gaa: name,
      ohneGaaName: !r.gaa_name,
      n: 0,
      kennzahlen: new Map(),
      jahre: new Map(),      // berichtsjahr -> Anzahl
      urls: new Map(),       // quelle_url  -> { n, jahr }
      dateien: new Set(),
      stichtage: new Set(),
      indikativ: 0,
      stufen: new Map(),
    });
  }
  const g = gruppen.get(key);
  g.n++;
  g.kennzahlen.set(r.kennzahl, (g.kennzahlen.get(r.kennzahl) || 0) + 1);
  g.dateien.add(r._datei);
  if (r.stichtag) g.stichtage.add(r.stichtag);
  if (r.indikativ) g.indikativ++;
  if (r.stufe) g.stufen.set(r.stufe, (g.stufen.get(r.stufe) || 0) + 1);
  if (Number.isInteger(r.berichtsjahr)) {
    g.jahre.set(r.berichtsjahr, (g.jahre.get(r.berichtsjahr) || 0) + 1);
  }
  if (r.quelle_url) {
    const u = g.urls.get(r.quelle_url) || { n: 0, jahr: null };
    u.n++;
    if (Number.isInteger(r.berichtsjahr) && (u.jahr == null || r.berichtsjahr > u.jahr)) {
      u.jahr = r.berichtsjahr;
    }
    g.urls.set(r.quelle_url, u);
  }
}

/* Wegweiser als eigene Zeilen: Ausschuss bekannt, Werte NICHT im
   Register. Sie sind damit immer eine offene Ernte, unabhängig vom
   Alter. */
for (const w of wegweiser) {
  const land = w.land_code || '??';
  const key = `${land}${TRENNER}WEGWEISER ${w._datei}`;
  const zahl = (x) => (Array.isArray(x) ? x.length : 0);
  gruppen.set(key, {
    land,
    gaa: (w.was || w._datei).slice(0, 120),
    ohneGaaName: false,
    istWegweiser: true,
    n: 0,
    kennzahlen: new Map(),
    jahre: Number.isInteger(w.berichtsjahr) ? new Map([[w.berichtsjahr, 1]]) : new Map(),
    urls: w.quelle_url ? new Map([[w.quelle_url, { n: 0, jahr: w.berichtsjahr ?? null }]]) : new Map(),
    dateien: new Set([w._datei]),
    stichtage: new Set(w.stand ? [String(w.stand)] : []),
    indikativ: 0,
    stufen: new Map(),
    wegweiserGebiete: zahl(w.gebiete) || zahl(w.ausschuesse),
  });
}

let liste = [...gruppen.values()];
if (NUR) liste = liste.filter((g) => String(g.land).toUpperCase() === NUR);

/* Alter und Leitquelle je Gruppe. Die Leitquelle ist die URL des
   JÜNGSTEN Jahrgangs — dort erscheint der nächste. */
for (const g of liste) {
  const jahre = [...g.jahre.keys()];
  g.jahr = jahre.length ? Math.max(...jahre) : null;
  g.alter = g.jahr == null ? null : JAHR - g.jahr;
  g.faellig = g.istWegweiser || (g.alter != null && g.alter >= FAELLIG_AB) || g.jahr == null;
  const sortiert = [...g.urls.entries()].sort((a, b) => (b[1].jahr || 0) - (a[1].jahr || 0)
                                                     || b[1].n - a[1].n);
  g.leitquelle = sortiert.length ? sortiert[0][0] : null;
  g.fehlt = SOLL_KENNZAHLEN.filter((k) => !g.kennzahlen.has(k));
  g.stichtag = [...g.stichtage].filter(Boolean).sort().pop() || null;
}

/* ═══════════════════════════════════════════════════════════════════════
   3 · QUELLEN PRÜFEN
       HEAD zuerst — viele Behörden-Server mögen HEAD nicht, dann GET mit
       `Range: bytes=0-0`. Wir laden bewusst nicht die ganze Datei: ein
       NRW-ZIP ist dreistellig MB groß und die Frage lautet nur, ob dort
       noch eine Datei DIESER ART liegt.
   ══════════════════════════════════════════════════════════════════════ */
const ERWARTET = (url) => {
  const m = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(url || '');
  const e = m ? m[1].toLowerCase() : null;
  if (e === 'pdf') return 'pdf';
  if (e === 'zip') return 'zip';
  if (e === 'xlsx' || e === 'xls') return 'tabelle';
  if (e === 'csv') return 'csv';
  if (e === 'html' || e === 'htm' || e === 'php' || e === 'asp' || e === 'aspx') return 'seite';
  return null; /* Einstiegsseite ohne Endung — HTML ist dort richtig */
};

async function pruefeUrl(url) {
  const befund = {
    url, status: null, ctype: null, clen: null, erwartet: ERWARTET(url),
    urteil: null, hinweis: null, endziel: null,
  };
  const kopf = {
    'user-agent': 'DealPilot-Ernte-Waechter/1.0 (+Nachernte-Pruefung, kein Crawler)',
    accept: '*/*',
  };
  const hol = async (methode, extra) => {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ZEITLIMIT);
    try {
      return await fetch(url, {
        method: methode, redirect: 'follow', signal: ac.signal,
        headers: { ...kopf, ...(extra || {}) },
      });
    } finally { clearTimeout(t); }
  };

  let res;
  try {
    res = await hol('HEAD');
    /* 403/405/501 auf HEAD heisst oft nur „HEAD mag ich nicht".
       Ebenso ein HEAD ohne content-type: manche Server beantworten nur
       GET vollständig. Erst wenn auch GET keinen Typ nennt, ist das ein
       Befund — sonst meldet das Werkzeug seine eigene Methode als
       Defekt der Quelle (gemessen an stadt.muenchen.de). */
    if (!res.ok || res.status === 403 || res.status === 405
        || !res.headers.get('content-type')) {
      const r2 = await hol('GET', { range: 'bytes=0-0' });
      if (r2.status !== 416) res = r2;
    }
  } catch (e) {
    try {
      res = await hol('GET', { range: 'bytes=0-0' });
    } catch (e2) {
      befund.urteil = 'UNERREICHBAR';
      befund.hinweis = (e2.cause && e2.cause.code) || e2.name || e2.message;
      return befund;
    }
  }

  befund.status = res.status;
  befund.ctype = (res.headers.get('content-type') || '(kein content-type)')
    .split(';')[0].trim().toLowerCase();
  const cr = res.headers.get('content-range');
  const cl = res.headers.get('content-length');
  befund.clen = cr && /\/(\d+)$/.test(cr) ? Number(/\/(\d+)$/.exec(cr)[1])
              : (cl != null ? Number(cl) : null);
  if (res.url && res.url !== url) befund.endziel = res.url;

  if (res.status >= 400) {
    befund.urteil = `HTTP ${res.status}`;
    return befund;
  }

  const istHtml = /text\/html|application\/xhtml/.test(befund.ctype);
  const passt = {
    pdf:    (c) => /application\/pdf|application\/octet-stream/.test(c),
    zip:    (c) => /zip|octet-stream|x-compressed/.test(c),
    tabelle:(c) => /spreadsheet|excel|octet-stream/.test(c),
    csv:    (c) => /csv|text\/plain|octet-stream/.test(c),
    seite:  (c) => /text\/html|application\/xhtml/.test(c),
  };

  if (befund.erwartet && !passt[befund.erwartet](befund.ctype)) {
    /* HIER liegt der eigentliche Zweck dieser Prüfung. HTTP 200 mit
       text/html, wo ein PDF stehen sollte, ist genau der Thüringer
       CAPTCHA-Fall. */
    befund.urteil = 'TOTFUND';
    befund.hinweis = istHtml
      ? `erwartet ${befund.erwartet}, geliefert HTML — Fehlerseite, Abfrage-Sperre oder CAPTCHA`
      : `erwartet ${befund.erwartet}, geliefert ${befund.ctype}`;
    return befund;
  }
  if (befund.erwartet && befund.erwartet !== 'seite'
      && befund.clen != null && befund.clen < 1024) {
    befund.urteil = 'TOTFUND';
    befund.hinweis = `nur ${befund.clen} Byte — zu klein für ${befund.erwartet}`;
    return befund;
  }
  befund.urteil = 'OK';
  return befund;
}

const urlBefund = new Map();
let geprueft = 0;
if (!OFFLINE) {
  const zuPruefen = [...new Set(liste.flatMap((g) => [...g.urls.keys()]))].filter(Boolean);
  let i = 0;
  const arbeiter = Array.from({ length: Math.max(1, PARALLEL) }, async () => {
    for (;;) {
      const k = i++;
      if (k >= zuPruefen.length) return;
      const b = await pruefeUrl(zuPruefen[k]);
      urlBefund.set(zuPruefen[k], b);
      geprueft++;
    }
  });
  await Promise.all(arbeiter);
}

/* ═══════════════════════════════════════════════════════════════════════
   4 · DECKUNG — vor jedem Befund, und mit Abbruch
   ══════════════════════════════════════════════════════════════════════ */
const E = (n) => new Intl.NumberFormat('de-DE').format(n);
const Z = [];
const say = (s = '') => Z.push(s);

say('═══ DECKUNG ═══');
say(`Dateien im Register   : ${alleDateien.length}`);
say(`davon Datensatzdateien: ${datensatzDateien}`);
say(`davon Wegweiser       : ${wegweiserDateien} (sagen, wo Daten liegen, tragen keine)`);
say(`Dateideckung          : ${(deckung * 100).toFixed(1)} %`);
say(`Sätze gelesen         : ${E(saetze.length)}`);
say(`Ausschüsse / Quellgruppen: ${liste.length}${NUR ? ` (Filter --nur=${NUR})` : ''}`);
if (probleme.length) {
  say(`Probleme              : ${probleme.length}`);
  probleme.forEach((p) => say(`   · ${p}`));
}

if (!alleDateien.length || !saetze.length) {
  say('');
  say('ABBRUCH: keine Datensätze gelesen — das ist ein Werkzeugausfall, kein Befund.');
  console.log(Z.join('\n'));
  process.exit(1);
}
if (deckung < 0.9) {
  say('');
  say(`ABBRUCH: nur ${gelesen} von ${alleDateien.length} Dateien lesbar (< 90 %).`);
  say('Ein Prüfer, der grün wird, ohne gelesen zu haben, ist schlimmer als keiner.');
  console.log(Z.join('\n'));
  process.exit(1);
}

/* ── Quellenbefund ──────────────────────────────────────────────────── */
const alleUrls = [...new Set(liste.flatMap((g) => [...g.urls.keys()]))].filter(Boolean);
const nachUrteil = (u) => [...urlBefund.values()].filter((b) => b.urteil === u);
say('');
say('═══ QUELLEN ═══');
if (OFFLINE) {
  say(`${alleUrls.length} eigenständige quelle_url — NICHT geprüft (--offline).`);
  say('Ohne HTTP-Prüfung ist über Erreichbarkeit nichts gesagt, auch nicht Gutes.');
} else {
  const tot = nachUrteil('TOTFUND');
  const weg = [...urlBefund.values()].filter((b) => b.urteil === 'UNERREICHBAR'
                                                 || /^HTTP /.test(b.urteil || ''));
  say(`geprüft               : ${geprueft} von ${alleUrls.length}`);
  say(`erreichbar und passend: ${nachUrteil('OK').length}`);
  say(`TOTFUND (200, aber falscher Inhalt): ${tot.length}`);
  say(`nicht erreichbar      : ${weg.length}`);
  say('HTTP 200 allein beweist nichts — darum stehen content-type und -length dabei.');
  [...tot, ...weg].forEach((b) => {
    say(`   ✗ ${b.urteil}  ${b.ctype || '-'}  ${b.clen != null ? E(b.clen) + ' B' : 'Länge unbekannt'}`);
    say(`     ${b.url.slice(0, 150)}`);
    if (b.hinweis) say(`     → ${b.hinweis}`);
    if (b.endziel) say(`     umgeleitet auf ${b.endziel.slice(0, 140)}`);
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   5 · ARBEITSLISTE, nach Fälligkeit sortiert
   ══════════════════════════════════════════════════════════════════════ */
const rang = (g) => {
  const b = g.leitquelle ? urlBefund.get(g.leitquelle) : null;
  const kaputt = b && b.urteil !== 'OK' ? 1 : 0;
  /* Fälligkeit heisst ALTER. Der erste Entwurf stellte die Wegweiser an
     den Anfang — dann stand ein Wegweiser aus dem laufenden Jahr vor
     einem Ausschuss, dessen Jahrgang acht Jahre zurückliegt. Das Alter
     entscheidet, „nichts geerntet" ist nur der Gleichstandsbrecher. */
  return [
    g.alter == null ? 99 : g.alter,  // Alter zuerst — das ist die Fälligkeit
    g.istWegweiser ? 1 : 0,          // dann: gar nichts geerntet
    kaputt,                          // dann kaputte Quelle
    g.fehlt.length,                  // dann fehlende Pflichtkennzahlen
  ];
};
const faellige = liste.filter((g) => g.faellig)
  .sort((a, b) => {
    const ra = rang(a); const rb = rang(b);
    for (let i = 0; i < ra.length; i++) if (rb[i] !== ra[i]) return rb[i] - ra[i];
    return String(a.land + a.gaa).localeCompare(String(b.land + b.gaa), 'de');
  });

const jahrVerteilung = {};
liste.forEach((g) => { const k = g.jahr == null ? 'ohne' : g.jahr; jahrVerteilung[k] = (jahrVerteilung[k] || 0) + 1; });

say('');
say('═══ ALTER DER JAHRGÄNGE ═══');
say(`Bezugsjahr ${JAHR} · fällig ab ${FAELLIG_AB} Jahr(en) Rückstand`);
say('Jahrgang: ' + Object.keys(jahrVerteilung).sort()
  .map((k) => `${k} → ${jahrVerteilung[k]}`).join(' · '));
say(`fällig  : ${faellige.length} von ${liste.length} Ausschüssen/Quellgruppen`);

say('');
say(`═══ ARBEITSLISTE (${Math.min(faellige.length, LISTE_MAX)} von ${faellige.length}) ═══`);
if (!faellige.length) {
  say('Nichts fällig. Jeder erfasste Jahrgang ist jünger als die Schwelle.');
}
faellige.slice(0, LISTE_MAX).forEach((g, i) => {
  const b = g.leitquelle ? urlBefund.get(g.leitquelle) : null;
  const q = OFFLINE ? 'ungeprüft'
    : b ? `${b.urteil}${b.ctype ? ' · ' + b.ctype : ''}${b.clen != null ? ' · ' + E(b.clen) + ' B' : ''}`
        : 'keine URL';
  say('');
  say(`${String(i + 1).padStart(2)}. [${g.land}] ${g.gaa}`);
  if (g.istWegweiser) {
    say(`    WEGWEISER — ${g.wegweiserGebiete} Gebiete/Ausschüsse benannt, `
      + `KEIN Wert im Register. Jahrgang ${g.jahr ?? '?'}`
      + (g.alter != null ? `, ${g.alter} Jahr(e) alt` : ''));
  } else {
    say(`    Jahrgang ${g.jahr ?? '—'}`
      + (g.alter != null ? `  ·  ${g.alter} Jahr(e) alt` : '  ·  Alter unbekannt')
      + `  ·  ${E(g.n)} Satz/Sätze`
      + (g.stichtag ? `  ·  Stichtag ${g.stichtag}` : ''));
    say(`    hat      : ${[...g.kennzahlen.entries()].map(([k, n]) => `${k} ${n}`).join(' · ') || '—'}`);
    say(`    fehlt    : ${g.fehlt.length ? g.fehlt.join(' · ') : '(beide Pflichtkennzahlen vorhanden)'}`);
    if (g.indikativ) say(`    davon indikativ: ${g.indikativ}`);
  }
  say(`    Quelle   : ${q}`);
  say(`    ${g.leitquelle || '(keine quelle_url)'}`);
  if (b && b.hinweis) say(`    → ${b.hinweis}`);
});
if (faellige.length > LISTE_MAX) {
  say('');
  say(`… ${faellige.length - LISTE_MAX} weitere. Vollständig mit --alle, als Tabelle mit --md.`);
}

/* ═══════════════════════════════════════════════════════════════════════
   6 · MARKDOWN — zum Hineinkopieren in BACKLOG.md
   ══════════════════════════════════════════════════════════════════════ */
if (MD) {
  const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|');
  say('');
  say('═══ MARKDOWN (für BACKLOG.md) ═══');
  say('');
  say(`<!-- erzeugt von tools/ernte-waechter.mjs · Bezugsjahr ${JAHR}`
    + ` · ${datensatzDateien}+${wegweiserDateien}/${alleDateien.length} Dateien`
    + ` · ${E(saetze.length)} Sätze${OFFLINE ? ' · Quellen UNGEPRÜFT' : ''} -->`);
  say('');
  say('| Land | Ausschuss / Quellgruppe | Jahrgang | Alter | Sätze | fehlt | Quelle | Link |');
  say('|---|---|---:|---:|---:|---|---|---|');
  faellige.forEach((g) => {
    const b = g.leitquelle ? urlBefund.get(g.leitquelle) : null;
    const q = OFFLINE ? 'ungeprüft'
      : b ? `${b.urteil}${b.ctype ? ` (${b.ctype})` : ''}` : '—';
    say(`| ${g.land} | ${esc(g.gaa).slice(0, 80)}`
      + `${g.istWegweiser ? ' **(Wegweiser — nichts geerntet)**' : ''}`
      + ` | ${g.jahr ?? '—'} | ${g.alter ?? '?'}`
      + ` | ${g.istWegweiser ? '0' : E(g.n)}`
      + ` | ${g.istWegweiser ? 'alles' : (g.fehlt.join(', ') || '—')}`
      + ` | ${esc(q)}`
      + ` | ${g.leitquelle ? `[Quelle](${g.leitquelle})` : '—'} |`);
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   7 · LAUFTABELLEN (nur lesend, nur mit --db)
       Antwortet auf die Frage „wann ist überhaupt zuletzt geerntet
       worden?". Es wird ausschließlich SELECT gefahren — dieses Werkzeug
       schreibt nirgends.
   ══════════════════════════════════════════════════════════════════════ */
if (MIT_DB) {
  say('');
  say('═══ LETZTE LÄUFE (gelesen, nicht geschrieben) ═══');
  try {
    const { q } = await import('../src/lib/db.js');
    const l = await q(`SELECT id, gestartet_am, ausloeser, gefunden, uebernommen, verworfen
                         FROM mb.param_lauf ORDER BY id DESC LIMIT 5`);
    if (!l.length) say('mb.param_lauf  : leer — es ist noch nie geerntet worden.');
    l.forEach((r) => say(`mb.param_lauf  #${r.id} ${new Date(r.gestartet_am).toISOString().slice(0, 16)}`
      + `  ${r.ausloeser}  gefunden ${r.gefunden} · übernommen ${r.uebernommen} · verworfen ${r.verworfen}`));
    const e = await q(`SELECT job, status, rows_in, rows_out, started_at
                         FROM mb.etl_runs ORDER BY id DESC LIMIT 5`);
    if (!e.length) say('mb.etl_runs    : leer — kein ETL-Lauf protokolliert.');
    e.forEach((r) => say(`mb.etl_runs    ${r.job} ${r.status} in ${r.rows_in} / out ${r.rows_out}`
      + `  ${new Date(r.started_at).toISOString().slice(0, 16)}`));
  } catch (err) {
    say(`Datenbank nicht erreichbar: ${err.message}`);
    say('Das ist kein Befund über die Ernte — nur über diesen Lauf.');
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   8 · FAZIT und Rückgabewert
       Rot wird der Wächter bei einem TOTFUND oder einer unerreichbaren
       Quelle — das ist ein echter Defekt, der jemanden erreichen muss.
       Ein fälliger Jahrgang allein ist gelb: er ist der Normalfall jedes
       Frühjahrs und darf keine Zeitsteuerung dauerhaft rot färben, sonst
       liest sie niemand mehr.
   ══════════════════════════════════════════════════════════════════════ */
const kaputteQuellen = OFFLINE ? 0
  : [...urlBefund.values()].filter((b) => b.urteil !== 'OK').length;
say('');
say('═══ FAZIT ═══');
say(`${faellige.length} Ausschüsse/Quellgruppen sind nachzuernten`
  + ` · ${kaputteQuellen} Quelle(n) defekt`
  + ` · ${wegweiserDateien} Wegweiser ohne einen einzigen Wert im Register`);
say('Dieses Werkzeug hat NICHTS geschrieben — weder Register noch Datenbank.');
say('Jeder Wert wird von Hand am Anwendungsbeispiel des Dokuments abgenommen.');

console.log(Z.join('\n'));
process.exit(kaputteQuellen > 0 ? 1 : 0);
