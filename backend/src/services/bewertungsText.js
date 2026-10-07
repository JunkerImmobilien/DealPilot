'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * bewertungsText.js — v1927
 *
 * DIE EINORDNUNG. Ein kurzer Text der KI zu einer BEREITS GERECHNETEN
 * Bewertung — nicht statt ihr.
 *
 * ── WARUM ──────────────────────────────────────────────────────────────────
 *
 * Marcel am 07.10.2026:
 *
 *   „Also wir haben ja beim Quick Check … kriegen wir nur eine Heuristik,
 *    die uns vorschlaegt, ob das Investment gut oder schlecht ist. So, diese
 *    Heuristik koennten wir erst auch einmal noch ergaenzen, dass wir da
 *    zusaetzlich zu dieser Heuristik oder in Kombination das auch noch mal
 *    abgleichen und das Ganze in die KI werfen, dass wir da noch mal was
 *    dazu bekommen. … dass wir da einmal eine komplette Bewertung bekommen."
 *
 * ── DIE REIHENFOLGE IST DIE AUSSAGE ───────────────────────────────────────
 *
 *   1. die GERECHNETEN Zahlen   (DealKpis, aus der Spiegelung)
 *   2. der SCORE und seine Stufe (DealScore, aus der Spiegelung)
 *   3. die HEURISTIK            (QcHeuristik, aus der Spiegelung)
 *   4. die EINORDNUNG           <- erst hier spricht die KI
 *
 * Das ist keine Geschmacksfrage. Die ersten drei sind nachrechenbar und bei
 * gleichen Eingaben immer gleich; der vierte ist es nicht. Steht er zuerst
 * oder allein, wird aus einer Rechnung eine Meinung.
 *
 *   > Eine KI-Einordnung, die keine gerechnete Zahl neben sich hat, ist
 *   > keine Bewertung — sie ist ein Text ueber ein Haus.
 *
 * Deshalb: dieses Modul rechnet NICHTS. Es bekommt fertige Zahlen, fertige
 * Woerter und fertige Saetze und darf sie nur einordnen. Der Prompt verbietet
 * ausdruecklich neue Zahlen und das Ueberstimmen der Empfehlung.
 *
 * ── KEIN STILLER AUSFALL ──────────────────────────────────────────────────
 *
 * Faellt die KI aus (kein Schluessel, Zeitgrenze, 429), kommt die Bewertung
 * trotzdem — ohne den Text und MIT dem Grund. Ein Feld, das im Fehlerfall
 * einfach fehlt, sieht aus wie eines, das es nie gab.
 *
 * ── WAS ES KOSTET ─────────────────────────────────────────────────────────
 *
 * GEMESSEN am 07.10.2026: der Telegram-Agent (`agentLauf.js`) ruft fuer
 * JEDE Nachricht dasselbe Modell (`config.openai.defaultModel`) und
 * verrechnet dafuer heute KEIN Kerosin — `agentLauf` prueft allein
 * `stufe === 'kostet'`, und das trifft nur `marktbericht_abrufen`. Dieser
 * Zusatzaufruf liegt in derselben Klasse: dasselbe Modell, ein kurzer
 * Prompt, keine Websuche.
 *
 *   > Ob eine Leistung Geld kostet, entscheidet nicht der, der sie baut.
 *
 * Deshalb wird hier NICHTS abgebucht. Soll die Einordnung Kerosin kosten,
 * ist das Marcels Entscheidung, und der Weg dafuer steht schon:
 * `aiCreditsService.pruefeArt()` VOR dem Aufruf (fragt, bucht nicht) und
 * `aiCreditsService.consumeArt()` danach. Die Reihenfolge ist die aus
 * v1251 — erst fragen, dann liefern, dann buchen.
 * ═══════════════════════════════════════════════════════════════════════════ */

const openai = require('./openaiService');

/* Eine Zeitgrenze, damit ein haengender Aufruf nicht den ganzen Chat
   blockiert. Der Nutzer wartet im Telegram auf eine Antwort; lieber die
   Bewertung ohne Einordnung als gar keine. */
const FRIST_MS = 25000;

function _mitFrist(versprechen, ms) {
  return new Promise((aufloesen, ablehnen) => {
    const uhr = setTimeout(() => {
      const e = new Error('Die KI hat innerhalb von ' + Math.round(ms / 1000)
        + ' Sekunden nicht geantwortet.');
      e.code = 'FRIST';
      ablehnen(e);
    }, ms);
    versprechen.then((w) => { clearTimeout(uhr); aufloesen(w); },
                     (f) => { clearTimeout(uhr); ablehnen(f); });
  });
}

/* ── Der Prompt ──────────────────────────────────────────────────────────
 *
 * Er bekommt NUR, was gerechnet wurde, und sagt dreimal, was verboten ist.
 * Die Verbote stehen dort, weil jedes davon schon einmal passiert ist:
 *
 *   · neue Zahlen  — `projectAll` rechnete jahrelang in Cent, und das
 *     Modell hat Euro schon zweimal als Cent gelesen (v1803). Ein Modell,
 *     das rechnen darf, ist eine zweite Quelle.
 *   · Aussagen ueber LAGE und ZUSTAND — gemessen im ersten echten Lauf am
 *     07.10.2026 (Parkstr. 9, Score 3): „Dieser Deal hat eine gewisse
 *     Attraktivitaet durch die Lage und die Groesse des Mehrfamilienhauses."
 *     Von der Lage stand kein Wort in der Eingabe. Das Verbot gegen neue
 *     ZAHLEN hatte gehalten; die erfundene Qualitaet ging daran vorbei.
 *
 *       > Eine erfundene Zahl faellt auf. Ein erfundenes Adjektiv nicht —
 *       > und es steht genauso im Bericht.
 *   · die Empfehlung ueberstimmen — sie ist eine Regel mit Schwellen
 *     (75/60/40). Ein Text, der sie aufweicht, macht sie wertlos, ohne sie
 *     zu aendern.
 *   · die Zahlenliste wiederholen — sie steht im selben Chat direkt
 *     darueber. Eine zweite Aufzaehlung macht die Antwort laenger und
 *     nicht besser.
 */
function bauePrompt(e) {
  const z = [];
  const zeile = (name, wert) => { if (wert != null && wert !== '') z.push(name + ': ' + wert); };

  zeile('Adresse', e.adresse);
  zeile('Objektart', e.objektart);
  zeile('Baujahr', e.baujahr);
  zeile('Wohnflaeche', e.wohnflaeche);
  zeile('Kaufpreis', e.kaufpreis);
  zeile('Jahreskaltmiete', e.jahreskaltmiete);
  zeile('Bruttomietrendite', e.bruttomietrendite);
  zeile('Kaufpreisfaktor', e.kaufpreisfaktor);
  if (e.kennzahlen) {
    Object.keys(e.kennzahlen).forEach((k) => zeile(k, e.kennzahlen[k]));
  }
  zeile('DealPilot-Score', e.score != null ? (e.score + ' von 100 (' + e.stufe + ')') : null);
  if (Array.isArray(e.teilnoten)) {
    e.teilnoten.forEach((t) => zeile('  Teilnote ' + t.was,
      t.punkte + ', Gewicht ' + t.gewicht + ', Grundlage ' + t.grundlage));
  }
  /* v1937 · Die Marktpreisindikation. FERTIG gerechnet — die Abweichung in
     Prozent steht da, damit das Modell sie nicht bildet. */
  zeile('Marktwert (Indikation)', e.marktwert);
  zeile('  Herkunft des Marktwerts', e.marktwert_herkunft);
  zeile('  Kaufpreis zum Marktwert', e.kaufpreis_zu_marktwert);
  zeile('  Marktmiete je Monat (Indikation)', e.marktmiete_monat);
  zeile('Kaufempfehlung der Heuristik', e.empfehlung);
  zeile('Begruendung der Heuristik', e.empfehlung_text);
  if (Array.isArray(e.einschaetzung)) {
    e.einschaetzung.forEach((m, i) => zeile('Einschaetzung ' + (i + 1), m));
  }
  if (Array.isArray(e.vorbehalte)) {
    e.vorbehalte.forEach((v, i) => zeile('Vorbehalt ' + (i + 1), v));
  }

  return [
    'Du bist der Co-Pilot von DealPilot und schreibst fuer einen Immobilien-Investor.',
    'Unten stehen Zahlen, die BEREITS GERECHNET sind, und eine Kaufempfehlung,',
    'die aus festen Schwellen stammt. Schreibe dazu eine EINORDNUNG.',
    '',
    '── Die gerechnete Bewertung ──',
    z.join('\n'),
    '',
    '── Dein Auftrag ──',
    'Schreibe 3 bis 5 Saetze auf Deutsch, in der Du-Form, ohne Ueberschrift,',
    'ohne Aufzaehlungszeichen und ohne Markdown.',
    '',
    'Sage darin:',
    '1. was an diesem Deal am meisten traegt,',
    '2. was ihn am meisten belastet,',
    '3. was der Investor als Naechstes pruefen oder verhandeln sollte.',
    '',
    '── Was du NICHT darfst ──',
    '· KEINE neue Zahl nennen, die oben nicht steht. Nicht ueberschlagen,',
    '  nicht umrechnen, nicht hochrechnen. Keine Marktpreise, keine',
    '  Mietspiegel, keine Zinsprognosen — du kennst sie nicht.',
    '· KEINE Aussage ueber LAGE, ZUSTAND, AUSSTATTUNG, Mieterstruktur,',
    '  Nachbarschaft oder Entwicklungspotenzial. Du kennst davon nichts —',
    '  oben stehen nur Zahlen. Saetze wie "attraktiv durch die Lage" oder',
    '  "gute Substanz" sind erfunden, auch wenn sie harmlos klingen.',
    '· Die Kaufempfehlung NICHT ueberstimmen und nicht abschwaechen. Wenn du',
    '  einen Grund siehst, der dagegen spricht, nenne den Grund — das Urteil',
    '  bleibt stehen.',
    '· Einer Einschaetzungszeile NICHT widersprechen. Beanstandet eine Zeile',
    '  eine Zahl, nenne sie nicht "hoch", "gut" oder "solide" — die Wertung',
    '  steht schon da und sie gilt.',
    '· Beim Marktwert NIE einen Anbieter beim Namen nennen. Er heisst',
    '  "unabhaengiger Bewertungspartner". Nenne die Herkunft so, wie sie',
    '  oben steht, und verwisch sie nicht: ein Abruf, eine Maklerschaetzung',
    '  und eine selbst eingetragene Zahl sind drei verschiedene Dinge. Steht',
    '  kein Marktwert da, sagst du NICHTS darueber, ob der Preis marktgerecht',
    '  ist — du weisst es dann nicht.',
    '· Die Zahlenliste NICHT wiederholen. Sie steht im selben Chat direkt',
    '  ueber deinem Text. Nimm einzelne Zahlen nur auf, wo du sie brauchst.',
    '· Steht oben ein Vorbehalt, nimm ihn ernst und sage, in welche Richtung',
    '  er das Bild verschiebt.',
    '',
    'Antworte NUR mit dem Text, ohne Vorrede.'
  ].join('\n');
}

/**
 * Die Einordnung holen.
 *
 * @param {Object} eingabe  die fertigen Werte (siehe bauePrompt)
 * @param {Object} opts     { userApiKey } wird durchgereicht
 * @returns {Promise<{ok:true,text,modell}|{ok:false,grund,technisch}>}
 *          Wirft NICHT. Ein Fehler ist ein Ergebnis mit `ok:false` — der
 *          Aufrufer soll die Bewertung trotzdem ausliefern.
 */
async function einordnung(eingabe, opts) {
  const o = opts || {};
  try {
    const antwort = await _mitFrist(openai.callOpenAI(bauePrompt(eingabe || {}), {
      userApiKey: o.userApiKey || null,
      /* Keine Websuche: der Text ordnet vorliegende Zahlen ein, er
         recherchiert nicht. Websuche waere hier nur Wartezeit — und sie
         holte Zahlen herein, die der Prompt gerade verbietet. */
      noWebSearch: true,
      /* Niedrige Temperatur: dieselbe Bewertung soll nicht jeden Tag
         anders klingen. */
      aiOptions: { temperature: 0.2 }
    }), FRIST_MS);

    const text = String(antwort.text || '').trim();
    if (!text) return { ok: false, grund: 'Die KI hat keinen Text geliefert.' };
    return { ok: true, text: text, modell: antwort.model };
  } catch (e) {
    /* Der Grund wird WEITERGEREICHT, nicht verschluckt. Welcher es war,
       entscheidet, was der Nutzer tun kann. */
    let grund;
    if (e && e.code === 'NO_API_KEY') {
      grund = 'Es ist kein OpenAI-Schluessel hinterlegt.';
    } else if (e && e.code === 'FRIST') {
      grund = e.message;
    } else if (e && e.status === 401) {
      grund = 'Der OpenAI-Schluessel wurde abgelehnt.';
    } else if (e && e.status === 429) {
      grund = 'Das KI-Kontingent bei OpenAI ist gerade erschoepft.';
    } else {
      grund = 'Die KI war nicht erreichbar.';
    }
    return { ok: false, grund: grund, technisch: (e && e.message) || String(e) };
  }
}

module.exports = { einordnung, bauePrompt, FRIST_MS };
