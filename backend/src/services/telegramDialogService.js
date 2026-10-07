'use strict';
/* services/telegramDialogService.js — die Auskunft des Bots (v1793)
 *
 * ── DIE REGEL DIESER DATEI ───────────────────────────────────────────────
 *
 * HIER WIRD NICHTS GERECHNET. Keine Rendite, keine Restschuld, kein DSCR.
 * Diese Datei holt Daten, die woanders entstanden sind, und reicht sie an
 * `openaiService.copilotChat` weiter — denselben Dienst, den der Browser
 * ruft.
 *
 *   > "Rechenkerne — nie duplizieren" (CLAUDE.md). `projectAll` rechnete
 *   > jahrelang in Cent, und aufgefallen ist es erst, als eine zweite
 *   > Quelle danebenstand. Eine zweite Vermoegensbilanz im Bot waere
 *   > derselbe Fehler noch einmal.
 *
 * Zwei Quellen, beide fremd:
 *   Portfolio  -> `portfolio_spiegel` (vom Browser abgelegt, v1793)
 *   Objekt     -> `objects.data` (die App schreibt es, wir lesen es)
 */
const { query } = require('../db/pool');
const openaiService = require('./openaiService');

/* ── Portfolio ───────────────────────────────────────────────────────────
 *
 * Der Spiegel ist nur so frisch wie der letzte Besuch im Browser. Deshalb
 * kommt der Stand IMMER mit — nicht als Fussnote, sondern als Teil der
 * Auskunft.
 *
 *   > Eine Zahl ohne Stand behauptet, aktuell zu sein.
 */
async function portfolioKontext(userId) {
  const r = await query(
    `SELECT payload, erfasst_am FROM portfolio_spiegel WHERE user_id = $1`,
    [userId]
  );
  if (!r.rows.length) return null;
  const alterMin = Math.round((Date.now() - new Date(r.rows[0].erfasst_am).getTime()) / 60000);

  /* ── v1796 · WIE ALT IST ALT? ─────────────────────────────────────────
   *
   * Bis hierher nannte der Bot nur das Datum des Spiegels. Das ist
   * richtig, aber es beantwortet die falsche Frage. Entscheidend ist
   * nicht, wie alt der Stand IST, sondern ob sich seitdem etwas GEAENDERT
   * hat.
   *
   *   > Ein drei Wochen alter Stand, an dem sich nichts geaendert hat, ist
   *   > aktuell. Ein zwei Stunden alter, hinter dem zwei Objekte
   *   > bearbeitet wurden, ist es nicht.
   *
   * `objects.updated_at` weiss das, und die Abfrage kostet nichts. Damit
   * kann der Bot statt einer Altersangabe eine Aussage machen. */
  const g = await query(
    `SELECT count(*)::int AS n FROM objects
      WHERE user_id = $1 AND updated_at > $2`,
    [userId, r.rows[0].erfasst_am]
  );

  return {
    payload: r.rows[0].payload,
    erfasst_am: r.rows[0].erfasst_am,
    alter_minuten: alterMin,
    geaendert_seitdem: (g.rows[0] && g.rows[0].n) || 0
  };
}

function standSatz(erfasstAm, alterMin, geaendertSeitdem) {
  const d = new Date(erfasstAm);
  const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  const tag = d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
  const wann = alterMin < 60 * 24 ? 'heute ' + uhr + ' Uhr' : tag + ', ' + uhr + ' Uhr';

  /* v1796 · Die Aenderung schlaegt das Alter. Sie ist die eigentliche
     Aussage: ein alter Stand ohne Aenderung stimmt noch, ein frischer mit
     Aenderung nicht mehr. */
  if (geaendertSeitdem > 0) {
    return 'Stand: ' + wann + ' — seitdem '
      + (geaendertSeitdem === 1 ? 'hast du ein Objekt' : 'hast du ' + geaendertSeitdem + ' Objekte')
      + ' bearbeitet. Öffne DealPilot einmal kurz, dann stimmen die Summen wieder.';
  }
  if (alterMin < 60 * 24 * 7) return 'Stand: ' + wann + '.';
  return 'Stand: ' + wann + ' — unverändert seitdem.';
}

/* ── Objekte ─────────────────────────────────────────────────────────────
 *
 * Die Liste ist bewusst schmal: Kennung, Adresse, Stand. Alles Weitere holt
 * `objektKontext` erst, wenn ein Objekt wirklich gemeint ist.
 */
async function objekteListe(userId, limit) {
  const r = await query(
    `SELECT id, data, updated_at FROM objects
      WHERE user_id = $1
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $2`,
    [userId, limit || 60]
  );
  return r.rows.map((z) => {
    const d = z.data || {};
    return {
      id: z.id,
      adresse: [d.str, d.hnr].filter(Boolean).join(' ')
             + (d.plz || d.ort ? ', ' + [d.plz, d.ort].filter(Boolean).join(' ') : ''),
      seq: d.seq || d.objektnummer || null,
      kp: d.kp || null,
      geaendert: z.updated_at
    };
  });
}

/* ── Scores und Kerndaten lesen, nie rechnen ─────────────────────────────
 *
 * Beide Scores werden im Browser gerechnet und am Objekt gespeichert. Der
 * Bot liest den gespeicherten Wert — eine zweite Rechnung waere eine
 * zweite Meinung ueber denselben Deal, und im Chat staende dann eine
 * andere Zahl als auf der Karte.
 *
 * DIE STUFE steht nirgends gespeichert; sie entsteht erst bei der Anzeige.
 * Die Kette unten ist die aus CLAUDE.md, die fuer die Objektkarte gilt:
 * 85 / 70 / 50 / 35.
 *
 * v1950 · HIER STAND EINE FALSCHE BEGRUENDUNG. Der Satz lautete:
 *
 *   "`score-tiers.js` kennt nur vier Baender und endet bei 50 - die
 *    fuenfte Stufe KRITISCH ist dort nicht abgebildet."
 *
 * Gemessen am 07.10.2026 stimmt das nicht: `stufe()` dort fuehrt seit
 * v1859 alle fuenf Stufen, seit v1863 mit "Sehr gut" obenauf. Nur
 * `classify()` hat vier Baender - das ist die FARBkette, nicht die
 * Wortkette.
 *
 * > Eine falsche Begruendung ist schlimmer als keine: sie rechtfertigt
 * > die Doppelung dauerhaft. Wer sie liest, prueft die andere Datei
 * > nicht mehr nach.
 *
 * v1955 · UND HIER STAND DIE NAECHSTE FALSCHE BEGRUENDUNG. v1950 sagte:
 *
 *   "Das Backend-Image kopiert `frontend/` nicht. Ein gemeinsames Modul
 *    zur Laufzeit gibt es ohne Bauschritt also nicht."
 *
 * Der erste Satz stimmt. Der zweite nicht: **den Bauschritt gibt es seit
 * v1899** - `tools/rechenkerne-spiegeln.mjs` spiegelt fuenf Rechenkerne
 * nach `backend/src/generated/rechenkerne/`, und `score-tiers.js` ist
 * einer davon. `services/rechenkerne.js` reicht ihn als `stufe(wert)`
 * heraus.
 *
 * > Ich habe einen PRUEFER gebaut, wo ein ERZEUGER stand. Gefunden erst,
 * > als ich fuer ein anderes Paket nach der Spiegelung gesucht habe -
 * > und dabei kam heraus, dass die gespiegelte Kopie seit meiner
 * > v1950-Aenderung VERALTET war (2781 gegen 4962 Bytes). Eine zweite
 * > Quelle, die niemand nachzieht, ist genau das, was die Spiegelung
 * > verhindern soll.
 *
 * Ab jetzt LIEST diese Datei die Kette, sie fuehrt sie nicht mehr. Der
 * eigene Rueckfall bleibt nur fuer den Fall, dass die Spiegelung fehlt -
 * ein Bot, der wegen eines fehlenden Kerns gar nichts sagt, waere
 * schlimmer als einer, der die Woerter doppelt kennt. Der Pruefer
 * `tools/score-ketten-pruefen.mjs` haelt den Rueckfall auf Linie.
 */
function stufeZu(score) {
  if (score == null) return null;
  /* v1955: die EINE Kette, ueber die gespiegelte score-tiers.js. */
  try {
    const r = require('./rechenkerne').stufe(score);
    if (r && r.versal) return r.versal;
  } catch (e) { /* Rueckfall unten */ }
  /* Rueckfall, nur wenn die Spiegelung fehlt. Gleich zu halten ist
     Aufgabe von tools/score-ketten-pruefen.mjs. */
  if (score >= 85) return 'SEHR GUT';   /* v1863: Marcel - "mit gut, sehr gut und dann die anderen" */
  if (score >= 70) return 'GUT';
  if (score >= 50) return 'SOLIDE';
  if (score >= 35) return 'SCHWACH';
  return 'KRITISCH';
}

function scoreLesen(daten) {
  const d = daten || {};
  const ds = Number.isFinite(Number(d._dealpilot_score)) ? Number(d._dealpilot_score) : null;

  /* DAS GATE: `_ds2_score` existiert auch dann, wenn der Investor Deal
     Score gar nicht gerechnet wurde. Ohne diese Pruefung behauptet der
     Bot einen Wert, den die App selbst nicht anzeigt.

     > Eine Zahl, die im Datensatz steht, ist noch kein Ergebnis. */
  const dsTwoOk = d._ds2_computed === true;
  const ds2 = dsTwoOk && Number.isFinite(Number(d._ds2_score)) ? Number(d._ds2_score) : null;

  const weitere = [];
  const zeig = [
    ['_kpis_dscr', 'DSCR', (v) => Number(v).toFixed(2)],
    ['_kpis_ltv', 'LTV', (v) => Number(v).toFixed(1) + ' %'],
    ['_kpis_bmy', 'Bruttomietrendite', (v) => Number(v).toFixed(2) + ' %'],
    ['_kpis_cf_ns', 'Cashflow nach Steuer', (v) => Math.round(v).toLocaleString('de-DE') + ' €/Jahr']
  ];
  zeig.forEach(([id, name, f]) => {
    const v = d[id];
    if (v == null || !Number.isFinite(Number(v))) return;
    weitere.push({ name, wert: f(v) });
  });

  return {
    dealscore: ds, stufe: stufeZu(ds),
    investor: ds2, investorStufe: stufeZu(ds2),
    investor_gerechnet: dsTwoOk,
    weitere
  };
}

/* ── Kerndaten eines Objekts ─────────────────────────────────────────────
 *
 * Marcel: "sag mir was Objekt 17 davon an Kerndaten hat."
 *
 * Bewusst nur Felder, die WIRKLICH im Datensatz stehen. Gemessen am
 * 02.10.2026: von den `_kpis_*`-Feldern werden nur sechs je geschrieben —
 * `_kpis_miete_j`, `_kpis_gi`, `_kpis_restschuld`, `_kpis_nmy` und
 * `_kpis_nmr` werden im Frontend GELESEN, aber nirgends geschrieben, und
 * `_kpis_vuv` ist im Code selbst als Leiche markiert.
 *
 *   > Ein Feld, das nur gelesen wird, sieht im Code aus wie eine
 *   > Datenquelle und ist eine Luecke.
 */
function kerndaten(daten) {
  const d = daten || {};
  const z = (v) => Number(v).toLocaleString('de-DE');
  const reihen = [];
  const dazu = (name, wert) => { if (wert != null && wert !== '') reihen.push({ name, wert }); };

  dazu('Objektart', d.objart || d.objektart);
  dazu('Wohnfläche', d.wfl ? d.wfl + ' m²' : null);
  dazu('Zimmer', d.zimmer);
  dazu('Baujahr', d.baujahr);             /* nie durch Intl.NumberFormat */
  dazu('Kaufpreis', d.kp ? z(d.kp) + ' €' : null);
  dazu('Kaltmiete', d.nkm ? z(d.nkm) + ' €/Monat' : null);
  dazu('Eigenkapital', d.ek ? z(d.ek) + ' €' : null);
  dazu('Darlehen', d.d1 ? z(d.d1) + ' €' : null);
  dazu('Zins', d.d1z ? d.d1z + ' %' : null);
  dazu('Tilgung', d.d1t ? d.d1t + ' %' : null);
  return reihen;
}

async function objektKontext(userId, objektId) {
  const r = await query(
    `SELECT id, data, ai_analysis, updated_at FROM objects WHERE user_id = $1 AND id = $2`,
    [userId, objektId]
  );
  if (!r.rows.length) return null;
  const z = r.rows[0];
  return {
    objekt_id: z.id,
    daten: z.data || {},
    ki_lagebewertung: z.ai_analysis || null,
    geaendert: z.updated_at
  };
}

/* ── Objektzuordnung aus einem Satz ──────────────────────────────────────
 *
 * Dasselbe Verfahren wie im Browser (`copilot-aenderungen.js objektZuordnen`),
 * und mit denselben zwei Lehren, die es dort gekostet hat:
 *
 *   1. `indexOf` findet TEILWOERTER: "str" steckt in "Musterstrasse".
 *      Deshalb Wortgrenzen.
 *   2. Ein Laengenfilter wirft die HAUSNUMMER weg — und genau die
 *      unterscheidet zwei Objekte in derselben Strasse. Zahlen zaehlen ab
 *      einer Stelle und wiegen schwerer.
 *
 * Und die wichtigste: BEI GLEICHSTAND WIRD GEFRAGT, nicht geraten. Ein
 * falsch zugeordnetes Objekt aendert Daten am falschen Haus.
 */
const STRASSENWOERTER = new Set(['strasse', 'straße', 'str', 'weg', 'allee', 'platz',
  'gasse', 'ring', 'damm', 'ufer', 'chaussee', 'hof', 'park']);

function _woerter(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-zäöüß0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/* ── v1828 · DIE ABKUERZUNG GEHT IN BEIDE RICHTUNGEN ─────────────────────
 *
 * GEMESSEN am 04.10.2026: Marcel fragte den Bot nach dem Objekt in der
 * "Bismarckstraße". Das Objekt heisst in seiner Liste "Bismarckstr. 27
 * Detmold" — der Bot fand es nicht und sagte, er kenne es nicht.
 *
 * Die Praefixregel aus v1810 loeste den Fall "Nutzer kuerzt ab, Objekt
 * ist ausgeschrieben" (Musterstr -> Musterstraße). Sie prueft, ob ein
 * OBJEKTwort LAENGER ist und mit dem Suchwort beginnt. Der umgekehrte
 * Fall kam nie an: "bismarckstrasse" (15) ist laenger als
 * "bismarckstr" (11), also griff nichts.
 *
 *   > Eine Abkuerzungsregel, die nur in eine Richtung greift, loest den
 *   > halben Fall — und zwar die Haelfte, die seltener vorkommt. Objekte
 *   > werden abgekuerzt angelegt und ausgeschrieben gesprochen.
 *
 * Statt die Regel ein zweites Mal zu flicken, bekommen beide Seiten
 * dieselbe STAMMFORM: ein Wort, das auf eine Strassenendung auslaeuft,
 * wird auf seinen Stamm plus Marker gekuerzt.
 *
 *     bismarckstrasse -> bismarck~        bismarckstr -> bismarck~
 *     musterstraße    -> muster~          musterstr   -> muster~
 *     lindenhof       -> linden~
 *
 * Der Marker `~` bleibt dran, damit "Parkstr." nicht auf das blosse Wort
 * "Park" trifft. Dass "Parkstr." und "Parkweg" beide zu "park~" werden,
 * ist beabsichtigt: dann punkten beide gleich, und das ist eine
 * Rueckfrage — die einzige Antwort, die in keinem Fall das falsche Haus
 * trifft.
 *
 * Die Laengenbedingung schuetzt die Endung selbst: aus dem allein
 * stehenden "weg" oder "str" wird kein Stamm, sie fallen weiter unter
 * STRASSENWOERTER.
 */
const _ENDUNGEN = ['strasse', 'straße', 'str', 'weg', 'allee', 'platz',
  'gasse', 'ring', 'damm', 'ufer', 'chaussee', 'hof', 'park'];

/* ── v1828b · WOERTER, DIE EINE FRAGE AUSMACHEN, KEINE ADRESSE ───────────
 *
 * GEMESSEN beim Pruefen von v1828, und es war schlimmer als der
 * gemeldete Fehler. Auf den GANZEN Satz
 *
 *     "Was kannst du mir zum Objekt in der Bismarckstraße sagen?"
 *
 * antwortete der alte Stand EINDEUTIG mit "Demo-Objekt ·
 * Beispiel-Wohnung Dealhausen". Das Wort "objekt" steht in diesem Namen,
 * und es punktete genau wie ein Strassenname.
 *
 *   > Ein Fehlschlag ist aergerlich, ein falscher Treffer ist gefaehrlich.
 *   > "Kenne ich nicht" sieht jeder; die falsche Wohnung sieht niemand.
 *
 * Deshalb zaehlen Gattungs- und Fragewoerter nicht mit. Sie stehen in
 * jeder zweiten Frage und in manchem Objektnamen — und sagen in beiden
 * Faellen nichts darueber aus, WELCHES Haus gemeint ist. Ortsnamen und
 * Strassen bleiben unberuehrt. */
const _FUELLWOERTER = new Set([
  /* Gattung */
  'objekt', 'objekte', 'wohnung', 'wohnungen', 'haus', 'immobilie',
  'immobilien', 'etw', 'efh', 'mfh', 'zfh', 'demo', 'beispiel', 'unbenannt',
  /* Frage und Fuellsel */
  'was', 'wie', 'wer', 'wo', 'warum', 'welche', 'welches', 'welcher',
  'kannst', 'kann', 'koennen', 'könnte', 'sagen', 'sag', 'zeig', 'zeige',
  'gib', 'mir', 'mich', 'ich', 'du', 'das', 'der', 'die', 'den', 'dem',
  'ein', 'eine', 'einen', 'einem', 'einer', 'zum', 'zur', 'bei', 'bitte',
  'und', 'oder', 'von', 'vom', 'fuer', 'für', 'auf', 'mit', 'ist', 'sind',
  'hat', 'habe', 'haben', 'mal', 'bitte', 'danke', 'ueber', 'über'
]);

function _stamm(t) {
  for (const e of _ENDUNGEN) {
    if (t.length > e.length + 2 && t.endsWith(e)) return t.slice(0, -e.length) + '~';
  }
  return t;
}

function objektRaten(satz, liste) {
  /* v1828 · Beide Seiten in dieselbe Stammform, bevor verglichen wird.
     Vorher verglich hier eine ausgeschriebene gegen eine abgekuerzte
     Strasse und fand nichts. */
  /* v1828b · Fuellwoerter raus, BEVOR gestammt wird. Ein "objekt" in der
     Frage darf nicht gegen eine Strasse antreten. */
  const w = _woerter(satz).filter((t) => !_FUELLWOERTER.has(t)).map(_stamm);
  const treffer = liste.map((o) => {
    const ows = _woerter(o.adresse).map(_stamm);
    const ow = new Set(ows);
    let p = 0;
    for (const t of w) {
      if (/^\d+$/.test(t)) { if (ow.has(t)) p += 3; continue; }  /* Hausnummer/PLZ */
      if (STRASSENWOERTER.has(t)) continue;                      /* "strasse" sagt nichts */
      if (ow.has(t)) { if (t.length > 2) p += 2; continue; }

      /* ── v1810 · ABGEKUERZTE STRASSENNAMEN ────────────────────────────
       *
       * GEMESSEN: "Musterstr" fand "Musterstraße 12" NICHT. Die
       * Wortgrenzen-Regel aus v1767b war gegen die indexOf-Falle gebaut
       * ("str" steckt in jeder Strasse) und hat recht — aber sie trifft
       * auch die Abkuerzung, die jeder schreibt.
       *
       *   > Wer "Musterstr" tippt, meint die Musterstrasse. Eine Regel,
       *   > die das nicht trifft, ist zu streng geworden statt sicher.
       *
       * Ein PRAEFIX zaehlt deshalb, wenn es lang genug ist: ab fuenf
       * Zeichen. "str" (drei) bleibt draussen, "muster" trifft
       * "musterstrasse", und das ist gewollt. */
      /* v1828 · in BEIDE Richtungen. Die Stammform oben faengt die
         Strassenendungen; diese Regel bleibt fuer alles andere, was
         jemand verkuerzt tippt ("alexander" -> "alexanderstraße" und
         umgekehrt "hermannstrasse" -> "hermann"). Beide Seiten muessen
         mindestens fuenf Zeichen tragen, sonst trifft ein Wortanfang
         zu viele. */
      if (t.length >= 5) {
        const praefix = ows.some((a) =>
          (a.length > t.length && a.indexOf(t) === 0) ||
          (t.length > a.length && a.length >= 5 && t.indexOf(a) === 0));
        if (praefix) { p += 2; continue; }
      }
    }
    return { o: o, p: p };
  }).filter((x) => x.p > 0).sort((a, b) => b.p - a.p);

  if (!treffer.length) return { art: 'keiner' };
  if (treffer.length > 1 && treffer[0].p === treffer[1].p) {
    return { art: 'mehrdeutig', kandidaten: treffer.filter((x) => x.p === treffer[0].p).map((x) => x.o) };
  }
  return { art: 'eindeutig', objekt: treffer[0].o, punkte: treffer[0].p };
}

/* ── Die Antwort ─────────────────────────────────────────────────────────
 *
 * `copilotChat` ist derselbe Dienst, den der Browser ruft. `kontextArt`
 * entscheidet, wie das Modell den Kontext beschriftet — ohne ihn stuende
 * "AKTUELLES OBJEKT" ueber einer Vermoegensbilanz (v1704).
 */
async function antwort(opts) {
  const nutzlast = {
    message: opts.message,
    history: (opts.history || []).slice(-12),
    context: opts.context,
    allowWeb: false
  };
  if (opts.kontextArt) nutzlast.kontextArt = opts.kontextArt;
  if (opts.felder) nutzlast.felder = opts.felder;

  const r = await openaiService.copilotChat(nutzlast, {});
  return r;
}

module.exports = {
  portfolioKontext, standSatz, objekteListe, objektKontext, objektRaten, antwort,
  scoreLesen, kerndaten, stufeZu
};
