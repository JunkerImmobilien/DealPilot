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
/* v2010 - dasselbe Projektwissen, das der Telegram-Agent liest.
   Bis v2010 war agentLauf.js sein einziger Leser. */
const projektwissen = require('./projektwissen');
const dokumentSchemas = require('./dokumentSchemas');   /* v1678 */

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
/* v2041 - der Ankauf-Block fuer den Prompt.

   Marcel: „sind wir aktuell nach Plan? Kannst du mir einen Soll-Ist-
   Vergleich machen?" - in der App und ueber den Telegram-Bot; beide
   laufen hier durch.

   Die Tabelle geht FERTIG hinein. Das Modell soll vergleichen, nicht
   nachrechnen: die beiden Saetze wurden jeweils zu ihrer Zeit
   gerechnet. Eine Neuberechnung mit heutigen Regeln wuerde nicht das
   Objekt messen, sondern unsere Regelaenderung. */
/* v2430 · MIETERHOEHUNG UND ZIELBILD (Marcel 19.10.2026). Je Wohnung bis zu
   drei Mieten: Ist, Soll-Miete (Mieter bleibt, normale Mieterhoehung) und
   Zielbild (nach Umbau/Neuvermietung). Der Ertragswert je Stufe kommt aus dem
   Marktbericht-Dienst (derselbe Kern wie Stufe 3) - hier wird nichts gerechnet.
   Kennzeichnung: Potenzialwert, keine Verkehrswertermittlung. */
function _potenzialBlock(pz) {
  var z = [], e = function (n) { return n == null ? '-' : Math.round(n).toLocaleString('de-DE') + ' EUR'; };
  z.push('');
  z.push('## MIETERHOEHUNG UND ZIELBILD (Ausblick, kein Verkehrswert zum heutigen Stichtag)');
  z.push('Stufen: Bestand = heutige Ist-Miete; Mieterhoehung = Soll-Miete, der jetzige Mieter bleibt'
    + ' (Paragraf 558 BGB bis zur Vergleichsmiete, Kappungsgrenze, 15 Monate nach der letzten Erhoehung;'
    + ' Paragraf 559 bei Modernisierung im bewohnten Zustand); Zielbild = nach Umbau oder Neuvermietung.');
  if (pz.kappung && pz.kappung.text) z.push(pz.kappung.text);
  var st = pz.stufen || {};
  z.push('');
  /* v2541 · Jahr je Stufe und beide Marktpreisindikationen (Marcel 20.10.2026) */
  z.push('Stufe | Jahr | Kaltmiete/Monat | Kaltmiete/Jahr | Massnahmenkosten | Modernisierungspunkte plus | Bruttomietrendite | DSCR | Restnutzungsdauer | Miete im Ertragswert/Jahr (Anhebung gegen Bestand) | Ertragswert | Marktpreisindikation (Angebote) | Rohertragsfaktor x Miete');
  ['bestand', 'mieterhoehung', 'zielbild'].forEach(function (k) {
    var x = st[k]; if (!x) return;
    z.push(k + ' | ' + (x.jahr ? x.jahr : (k === 'zielbild' ? 'offen' : '-')) + ' | ' + e(x.kaltmiete_monat) + ' | ' + e(x.kaltmiete_jahr) + ' | ' + e(x.kosten) + ' | ' + (x.punkte_plus || 0)
      + ' | ' + (x.bmy != null ? x.bmy + ' %' : '-') + ' | ' + (x.dscr != null ? x.dscr : '-')
      + ' | ' + (x.rnd != null ? Math.round(x.rnd) + ' J.' : '-')
      + ' | ' + (x.rohertrag_ertragswert != null ? e(x.rohertrag_ertragswert) + (x.anhebung_ertragswert ? ' (+' + e(x.anhebung_ertragswert) + ')' : '') : '-')   /* v2488 */
      + ' | ' + (x.ertragswert != null ? e(x.ertragswert) : 'nicht gerechnet')
      + ' | ' + (x.marktpreisindikation_angebote != null ? e(x.marktpreisindikation_angebote) : '-')
      + ' | ' + (x.rohertragsfaktor_x_miete != null ? e(x.rohertragsfaktor_x_miete) : '-'));
  });
  /* v2541 · die Jahre: woher sie kommen, und was „offen" heisst */
  if (pz.jahre) z.push('Jahre: Bestand ab Kaufdatum' + (pz.jahre.ankauf ? ' ' + pz.jahre.ankauf : ' (nicht eingetragen)')
    + (pz.jahre.mieterhoehung ? ', Mieterhoehung ab ' + pz.jahre.mieterhoehung + ' (' + (pz.jahre.mieterhoehung_herkunft || '') + ')' : '')
    + ', Zielbild ' + (pz.jahre.zielbild ? pz.jahre.zielbild + ' (Angabe des Nutzers)' : 'ohne Jahr (offen) - dann kein Jahr erfinden, sondern sagen, dass es offen ist') + '.'
    + ' Nenne zu jeder Stufe, fuer welches Jahr sie gilt.');
  if (pz.marktpreisindikation && !pz.ertragswert_gesperrt) {
    var M = pz.marktpreisindikation;
    if (M.angebote && M.angebote.verfuegbar) z.push('Marktpreisindikation (Angebote): ' + (M.angebote.hinweis || '')
      + (M.angebote.abschlag_pct != null ? ' Abschlag auf Angebotspreise ' + M.angebote.abschlag_pct + ' %.' : '')
      + ' Stelle sie dem Ertragswert gegenueber (beides nennen, Abweichung einordnen), ohne eine der beiden Zahlen als Verkehrswert zu bezeichnen.');
    if (M.rohertragsfaktor && M.rohertragsfaktor.verfuegbar) z.push('Rohertragsfaktor ' + M.rohertragsfaktor.faktor + ' des '
      + String(M.rohertragsfaktor.ausschuss || 'Gutachterausschusses').replace(/^Der\s+/, '') + ' x Jahresnettokaltmiete der Stufe: Durchschnitt aus Kauffaellen, eine Gegenprobe.');
  }
  /* v2488 · warum die Miete im Ertragswert von der Kaltmiete abweicht (Band, Leerstand) */
  if (pz.ertragswert_basis && !pz.ertragswert_gesperrt) z.push('Miete im Ertragswert: ' + pz.ertragswert_basis
    + ' Weicht sie von der Kaltmiete ab, so erklaeren; die Anhebung ist der Mehrertrag, auf dem der Wertzuwachs der Stufe beruht.');
  /* v2431 · ohne Stufe 3 gibt es keinen Ertragswert (Marcel 19.10.2026) */
  if (pz.ertragswert_gesperrt) z.push('Ertragswert je Stufe gibt es mit DealPilot Stufe 3 (Wertermittlung nach ImmoWertV); fuer dieses Objekt liegt sie nicht vor.'
    + ' Nenne KEINEN Ertragswert, keine Restnutzungsdauer und kein Aufteilungspotenzial - nur Mieten, Massnahmen, Kosten, Rendite und Cashflow.'
    + ' Ein sachlicher Halbsatz, dass der Ertragswert je Stufe mit Stufe 3 erscheint, genuegt; keine Werbung.');
  else if (!pz.ertragswert_gerechnet) z.push('Die Ertragswerte sind fuer diesen Stand nicht gerechnet - nenne keine Ertragswerte, nur die Mieten.');
  if (pz.aufteilung && pz.aufteilung.je_stufe && !pz.ertragswert_gesperrt) {
    var a = pz.aufteilung;
    z.push('Aufteilung in Eigentumswohnungen (Summe der Wohnungen als ETW, Zins ' + (a.zins_etw != null ? a.zins_etw + ' %' : '-')
      + (a.zins_etw_ausschuss ? ' des ' + a.zins_etw_ausschuss.replace(/^Der\s+/, '') : '')
      + (a.zins_haus != null ? ', Haus ' + a.zins_haus + ' %' : '')
      + ', Kosten der Aufteilung ' + e(a.kosten) + '):');
    Object.keys(a.je_stufe).forEach(function (k) {
      var y = a.je_stufe[k];
      /* v2431 · negativ = kein Potenzial, mit Begruendung statt Minusbetrag */
      z.push('  ' + k + ': Summe ' + e(y.summe) + ', ' + (y.potenzial < 0 ? 'KEIN Aufteilungspotenzial (nach Kosten unter dem Haus als Ganzes)'
        : 'Potenzial nach Kosten gegen Haus als Ganzes ' + e(y.potenzial)));
    });
    if (a.negativ_hinweis) z.push('  Begruendung (so wiedergeben, keinen Minusbetrag als Potenzial nennen): ' + a.negativ_hinweis);
    /* v2541 · dieselben Wohnungen nach Angebotspreisen fuer Eigentumswohnungen (nur nach dem Abruf „Marktpreise") */
    var me = a.marktpreisindikation_etw;
    if (me && me.summe_bestand != null) z.push('  Nach Angebotspreisen fuer Eigentumswohnungen am Ort (Median ' + (me.median_qm != null ? me.median_qm + ' EUR/m2' : '-')
      + (me.stichprobe ? ', ' + me.stichprobe + ' Angebote' : '') + '): Summe heute ' + e(me.summe_bestand)
      + (me.summe_zielbild != null ? ', im Zielbild ' + e(me.summe_zielbild) : '')
      + '. Wohnungseigentum wird am Markt regelmaessig ueber Vergleichspreise gehandelt - diese Summe neben die Ertragswert-Summe stellen und den Unterschied erklaeren.');
  }
  if (Array.isArray(pz.wohnungen) && pz.wohnungen.length > 1) {
    z.push('');
    z.push('Wohnung | m2 | Ist/Monat | Soll/Monat (ab) | Ziel/Monat (wann) | Massnahmen');
    pz.wohnungen.forEach(function (w) {
      z.push((w.nr || '') + ' ' + (w.lage || '') + ' | ' + (w.wfl || '-') + ' | ' + (w.ist ? e(w.ist) : (w.status === 'leer' ? 'leer' : '-'))
        + ' | ' + (w.soll != null ? e(w.soll) + (w.soll_ab ? ' (' + w.soll_ab + ')' : '') : '-')
        + ' | ' + (w.ziel != null ? e(w.ziel) + (w.ziel_wann ? ' (' + w.ziel_wann + ')' : '') : '-')
        + ' | ' + (w.massnahmen || '-'));
    });
  }
  return z.join('\n');
}

function _ankaufBlock(ak) {
  var z = [];
  z.push('');
  z.push('## ANKAUF-STAND (eingefroren) UND ABWEICHUNG');
  z.push('Dieses Objekt ist gekauft. Der Stand beim Nutzen-/Lastenwechsel am '
    + ak.stichtag + ' wurde eingefroren.');
  if (ak.korrekturen) {
    z.push('Davon ' + ak.korrekturen + ' spaetere Korrektur(en) - der Massstab wurde angepasst.');
  }
  if (Array.isArray(ak.abweichung) && ak.abweichung.length) {
    z.push('');
    z.push('Kennzahl | Ankauf | Bestand heute | Differenz | Richtung');
    for (var i = 0; i < ak.abweichung.length; i++) {
      var r = ak.abweichung[i];
      var d = Math.round(r.diff * 100) / 100;
      z.push(r.wort + ' | ' + r.ankauf + ' | ' + r.bestand + ' | '
        + (d > 0 ? '+' : '') + d + ' | ' + r.richtung);
    }
  } else {
    z.push('Keine Kennzahl ist zu beiden Zeitpunkten vergleichbar - sage das, statt zu schaetzen.');
    /* ══ v2139 · UND DANN LAGEN DIE ANKAUFSZAHLEN DOCH VOR ══════════
       `ui.js:967` sendet `kennzahlen_damals` (der Kurzstand zum
       Stichtag). Gelesen wurde nur `abweichung` - die Tabelle, die
       einen VERGLEICH braucht.

       > Genau wenn kein Vergleich moeglich ist, stand hier „sage das,
       > statt zu schaetzen" - und die Zahlen von damals reisten
       > ungelesen mit. Der Satz war richtig und die Lage eine andere. */
    if (ak.kennzahlen_damals) {
      z.push('');
      z.push('Die Kennzahlen zum Ankauf liegen aber vor (nicht vergleichbar, aber nennbar):');
      z.push(typeof ak.kennzahlen_damals === 'string'
        ? ak.kennzahlen_damals : JSON.stringify(ak.kennzahlen_damals));
    }
  }
  /* v2139: wann der Stand festgeschrieben wurde - nicht dasselbe wie der
     Stichtag. Wer einen Ankauf drei Monate spaeter eintraegt, hat seine
     Zahlen aus der Zeit der EINGABE, nicht aus der des Uebergangs. */
  if (ak.festgeschrieben_am && ak.festgeschrieben_am !== ak.stichtag) {
    z.push('Festgeschrieben wurde dieser Stand am ' + ak.festgeschrieben_am
      + ' - nicht am Stichtag selbst.');
  }
  z.push('');
  z.push('ANKAUF ist der Soll-Stand (wie gekauft), BESTAND der Ist-Stand (heute).');
  z.push('NICHT zu verwechseln mit Soll-Miete und Ist-Miete: die beschreiben EINE');
  z.push('Miete (was hereinkaeme gegen was gezahlt wird), nicht zwei Zeitpunkte.');
  z.push('Wird nach einem Soll-Ist-Vergleich gefragt oder danach, ob es nach Plan');
  z.push('laeuft, antworte AUS DIESER TABELLE und rechne sie nicht nach.');
  return z.join('\n');
}

function buildPrompt(payload, opts) {
  const o = payload.objekt || {};
  const k = payload.kennzahlen || {};
  const f = payload.finanzierung || {};
  const ds = payload.dealscore || {};
  const mb = payload.marktbewertung || {};
  const mr = payload.marktradar || [];
  const mbr = payload.marktbericht || null;   /* v947-mbsource: der echte Bericht */
  const isc = payload.investor_score || null;
  /* v2009 - Vermarktungsdauer. Bis hierher gab es sie nur im Request. */
  const vh = payload.verhandlung || null;
  /* v2011 - die sieben Bloecke aus Marcels Liste. */
  const _st = payload.steuer || null;
  const _bw = payload.bewirtschaftung || null;
  const _me = payload.mietentwicklung || null;
  /* v2041 - der eingefrorene Ankauf-Stand samt fertiger Abweichung. */
  const _ak = payload.ankauf || null;
  const _pz = payload.potenzial || null;   /* v2430 */
  const _wo = payload.wohnung || null;
  const _bo = payload.boden || null;
  const _ha = payload.halter || null;
  const _zu = payload.zustand || null;
  const _ip = payload.investor_profil || null;   /* v2140 */
  /* v2013 - wie viele Fotos mitgehen. Sie stehen NICHT im Text (sie
     waeren dort base64), aber das Modell muss wissen, dass es welche
     hat und was es daraus NICHT schliessen darf. */
  const _nFotos = (opts && Array.isArray(opts.fotos)) ? opts.fotos.length : 0;
  /* Nur Werte, die es WIRKLICH gibt - ein leerer Block waere eine
     Ueberschrift ohne Inhalt und kostet nur Aufmerksamkeit. */
  const _zeilen = function (titel, paare) {
    const da = paare.filter(function (p) { return p[1] != null && p[1] !== ''; });
    if (!da.length) return '';
    return '\n' + titel + '\n' + da.map(function (p) { return '- ' + p[0] + ': ' + p[1]; }).join('\n');
  };
  /* ═══ v1311 · Woher die Zahlen kommen ════════════════════════════════
     Marcels Vorgabe vom 11.09.2026: der Co-Pilot soll das Wissen aus dem
     Sprechlauf mitnehmen. Die WERTE kamen schon an — was fehlte, war ihre
     Herkunft: amtlich, abgerufen, geschaetzt oder genaehert.

     Fuer eine Analyse ist das kein Beiwerk. Eine belegte Zahl traegt eine
     Empfehlung; eine genaeherte traegt einen Vorbehalt, und der gehoert in
     den Text — nicht ins Kleingedruckte. */
  const hk = payload.herkunft || null;
  /* v1323: der Marktkontext und das Erbbaurecht aus der
     DealPilot-Marktbewertung. GEMESSEN: dealpilot_marktbewertung wird seit
     v746 geschickt und hatte im ganzen Backend KEINEN Leser. */
  const _dpmb = payload.dealpilot_marktbewertung || null;
  const mk = (_dpmb && _dpmb.marktkontext) || null;
  const eb = (_dpmb && _dpmb.erbbaurecht) || null;
  const _z = function (n) { return (n == null || !isFinite(n)) ? '-' : Math.round(n).toLocaleString('de-DE'); };
  const _p = function (n) { return (n == null || !isFinite(n)) ? '-' : (n.toFixed(1).replace('.', ',') + ' %'); };
  const _p2 = function (n) { return (n == null || !isFinite(n)) ? '-' : (n.toFixed(2).replace('.', ',') + ' %'); };

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
    /* ── v1700 · DIE STUFEN DES GESAMT-SCORES ──────────────────────────
       Marcel: „Investor-Deal-Score 82, Deal-Score 88 — der sagt mir aber
       immer noch ‚Prüfen' in Gelb. Diese Grenzen passen nicht."

       Er hat recht, und die Ursache war eine Lücke: die Skala oben deckt
       LTV und DSCR ab, den GESAMT-Score aber nicht. Die KI bekam die
       Zahl („DealScore: 88 / 100", Z. 219) ohne jede Bedeutung und hat
       frei geraten.

       Die Schwellen stehen in CLAUDE.md und gelten überall in der App
       (`js/dashboard.js:390`). Dass die Analyse sie nicht kannte, hat
       zwei widersprüchliche Aussagen auf denselben Bildschirm gebracht.

       > Eine Zahl ohne Maßstab ist keine Aussage. Wer sie weitergibt,
       > muss den Maßstab mitgeben — sonst erfindet der Empfänger einen.

       Die Empfehlung ist an die Stufe gebunden, aber nicht daran
       gefesselt: Abweichen ist erlaubt und muss benannt werden. Sonst
       wäre die KI ein Papagei des Scores, und man könnte sie sparen. */
    '## DEAL-SCORE — DIE STUFEN (verbindlich)',
    'Der DealScore steht unten als Zahl von 0 bis 100. Er bedeutet:',
    '',
    '🟢 SEHR GUT — 85 und mehr',
    '🟢 GUT — 70 bis 84',
    '🟡 SOLIDE — 50 bis 69',
    '🟠 SCHWACH — 35 bis 49',
    '🔴 KRITISCH — unter 35',
    '',
    'Dieselben Schwellen gelten für den Investor Deal Score.',
    '',
    'BINDUNG DER EMPFEHLUNG:',
    '- SEHR GUT oder GUT (70+)  → "Kaufen"',
    '- SOLIDE (50–69)      → "Prüfen"',
    '- SCHWACH oder KRITISCH (unter 50) → "Nicht kaufen"',
    '',
    'Du DARFST davon abweichen, wenn ein konkreter, benennbarer Umstand',
    'dagegen spricht — etwa ein DSCR unter 1,0, ein LTV über 100 %, ein',
    'erkennbarer Sanierungsstau oder eine Lage mit fallender Nachfrage.',
    'Dann MUSST du diesen Umstand im ersten Satz der Begründung nennen',
    'und sagen, dass du deshalb von der Score-Stufe abweichst.',
    '',
    'Ohne einen solchen Grund ist eine Empfehlung, die unter der',
    'Score-Stufe liegt, FALSCH. Ein Objekt mit 88 Punkten ist TOP — dort',
    '"Prüfen" zu schreiben, widerspricht der eigenen Bewertung und',
    'verwirrt den Nutzer, der beide Angaben nebeneinander sieht.',
    '',
    'WICHTIGE INSTRUKTIONEN:',
    '- Verwende die Begriffe „SOLIDE", „ERHÖHT", „KRITISCH" / „KNAPP" exakt wie oben.',
    '- Formuliere positiv-konkret: Ein LTV von 84 % ist SOLIDE und gehört in den',
    '  Stärken-Block, NICHT in die Risiken. Bezeichne diesen Bereich NIE als „hoch",',
    '  „relativ hoch" oder „erhöht" — das ist faktisch falsch und kontrastiert mit',
    '  unserer Skala.',
    '- Ein DSCR von 1,25 ist SOLIDE und damit eine STÄRKE, kein Risiko.',
    '',
    '## GEWICHTUNG & HEBEL-LOGIK (verbindlich)',
    '- LTV ist NUR EINER von mehreren Faktoren — gewichte ihn NICHT über. Ein hoher',
    '  LTV ist KEIN eigenständiges K.-o.-Kriterium, wenn DSCR solide und die',
    '  Eigenkapitalrendite hoch ist.',
    '- Eine sehr hohe oder UNENDLICHE EK-Rendite (no-money-down: Kaufpreis UND',
    '  Kaufnebenkosten vollständig aus Fremdkapital finanziert) ist eine herausragende',
    '  HEBEL-STÄRKE und gehört prominent in die Stärken — niemals in die Risiken.',
    '  Bei EK ~ 0 verzinst jeder positive Cashflow das eingesetzte Eigenkapital',
    '  faktisch unendlich gut. Stelle das ausdrücklich als Top-Argument dar.',
    '- NIEMALS formulieren, 0 % Eigenkapital / no-money-down "mindere die Attraktivität"',
    '  oder "die EK-Rendite sei nicht gegeben". Das Gegenteil ist richtig: maximaler Hebel,',
    '  höchste/unendliche EK-Rendite — das ist die STAERKSTE Eigenschaft des Deals.',
    '- Bewerte den Deal PRIMÄR über Cashflow, EK-Rendite, DSCR und Substanz/Lage.',
    '  Der LTV moduliert nur das Finanzierungsrisiko, dominiert aber nie das Urteil.',
    '- Wenn DSCR >= 1,2 UND EK-Rendite hoch/unendlich: Finanzierung klar als STÄRKE',
    '  darstellen; LTV nur als nachrangigen Hinweis (Zinsänderungs-/Anschlussrisiko).',
    '- Wenn du die Skala-Texte in der Gesamtbewertung oder Risikoanalyse zitierst,',
    '  verwende den DealPilot-Wortlaut wörtlich oder zumindest sinngemäß identisch.',
    '',
    '## OBJEKT-DATEN',
    ortLine ? '- Adresse: ' + ortLine : '',
    o.objart ? '- Objektart: ' + o.objart : '',
    /* ── v1700 · GESAMTFLAECHE IST KEINE WOHNUNGSGROESSE ──────────────
       Marcel: „er sagt mir, die Wohnungsgroesse sei mit 390 m² zu gross,
       obwohl sich die auf acht Wohnungen verteilt."

       Die Zahl allein laesst beides zu. Ohne die Einheiten liest jeder
       Leser — auch ein Modell — eine Wohnung daraus und vergleicht sie
       mit einem Mietspiegel, der fuer Wohnungen gilt.

       Steht die Einheitenzahl fest, wird die Flaeche ausdruecklich als
       SUMME benannt und die Durchschnittsgroesse danebengestellt. Fehlt
       sie, wird bei einem Mehrfamilienhaus wenigstens gewarnt — eine
       ungewisse Angabe ist besser als eine falsche Gewissheit. */
    o.wfl
      ? (o.einheiten && o.einheiten.anzahl > 1
          ? '- Wohnfläche: ' + o.wfl + ' m² — das ist die GESAMTFLÄCHE über '
            + o.einheiten.anzahl + ' Einheiten'
            + (o.einheiten.flaeche_schnitt
                ? ', im Schnitt ' + o.einheiten.flaeche_schnitt + ' m² je Einheit'
                : '')
          : '- Wohnfläche: ' + o.wfl + ' m²')
      : '',
    /* v1700c: je Einheit auch Art und Status — eine leerstehende
       Gewerbeeinheit ist etwas anderes als eine vermietete Wohnung, und
       ohne diese Angabe sieht beides gleich aus. Der Leerstand ist fuer
       die Bewertung oft wichtiger als die Flaeche. */
    (o.einheiten && o.einheiten.anzahl > 1)
      ? '- Einheiten: ' + o.einheiten.anzahl
        + (o.einheiten.je_einheit && o.einheiten.je_einheit.length
            ? '\n' + o.einheiten.je_einheit.filter(function (e) { return e.wfl || e.miete; })
                .map(function (e) {
                  /* ══ v2139 · HIER FEHLTEN SIEBEN FELDER JE EINHEIT ══
                     `ui.js:805-826` sendet je Einheit auch `etage`,
                     `zimmer`, `vertragsart` (aus `mv_art`), die drei
                     Vertragstermine und den `zustand`. Gedruckt wurden
                     sechs andere.

                     `art` ist `wohnen|gewerbe` - NICHT die Vertragsart.
                     Die beiden Namen liegen so nah beieinander, dass
                     die Luecke beim Lesen des Codes nicht auffaellt:
                     eine Zeile mit `e.art` SIEHT aus, als stuende die
                     Vertragsart drin.

                     Reihenfolge: erst was die Einheit IST (Nr, Flaeche,
                     Zimmer, Etage, Nutzung), dann was sie TRAEGT
                     (Miete, Status, Vertrag, Termine), dann ihr
                     Zustand. Die Termine tragen ihr Wort mit, weil
                     drei nackte Datumsangaben hintereinander nicht
                     unterscheidbar sind. */
                  return '  · ' + (e.nr ? 'Nr. ' + e.nr + ': ' : '')
                    + (e.wfl ? e.wfl + ' m²' : 'Fläche offen')
                    + (e.zimmer ? ', ' + e.zimmer + ' Zi.' : '')
                    + (e.etage ? ', ' + e.etage : '')
                    + (e.art ? ', ' + e.art : '')
                    + (e.miete ? ', ' + e.miete + ' € Ist-Kaltmiete' : '')
                    + (e.status ? ', ' + e.status : '')
                    + (e.lage ? ', ' + e.lage : '')
                    + (e.vertragsart ? ', Vertrag: ' + e.vertragsart : '')
                    + (e.letzte_erhoehung ? ', letzte Erhöhung ' + e.letzte_erhoehung : '')
                    + (e.naechste_anpassung ? ', nächste Anpassung ' + e.naechste_anpassung : '')
                    + (e.befristet_bis ? ', befristet bis ' + e.befristet_bis : '')
                    + (e.zustand ? ', Zustand: ' + e.zustand : '')
                    /* ══ v2156 · DIE MIETE IST MEHR ALS EINE ZAHL ════════
                       Die Soll-Miete, die Erhoehungsart und der
                       Kuendigungsverzicht reisten bis v2155 nicht mit
                       (gemessen: 13 von 36 Feldern). Ohne sie nennt die
                       Analyse als CHANCE, was vertraglich schon
                       vereinbart ist — eine Staffelmiete steigt von
                       selbst, eine Indexmiete haengt am VPI, und ein
                       Kuendigungsverzicht bindet beide Seiten.
                       Die Soll-Miete steht NEBEN der Ist-Miete, nicht
                       statt ihr: der Abstand ist der Hebel. */
                    + (e.soll_miete ? ', Soll-Kaltmiete ' + e.soll_miete + ' €' : '')
                    + (e.mietvertrag_seit ? ', Vertrag seit ' + e.mietvertrag_seit : '')
                    + (e.kuendigungsverzicht_bis
                        ? ', KUENDIGUNGSVERZICHT bis ' + e.kuendigungsverzicht_bis : '')
                    + (e.erhoehung_art ? ', Erhoehung: ' + e.erhoehung_art
                        + (e.erhoehung_wert != null ? ' (' + e.erhoehung_wert + ')' : '')
                        + (e.erhoehung_rhythmus_jahre ? ', alle ' + e.erhoehung_rhythmus_jahre + ' Jahre' : '')
                        + (e.stufen_offen != null ? ', ' + e.stufen_offen + ' Stufe(n) offen' : '')
                      : '')
                    + (e.massnahme ? ', MASSNAHME: ' + e.massnahme
                        + (e.massnahme_kosten ? ' (' + fmtEur(e.massnahme_kosten) + ')' : '')
                      : '');
                }).join('\n')
            : '')
      : '',
    /* Leerstand ausdruecklich benennen: er steht in den Einheiten, wird
       aber leicht ueberlesen, wenn man nur die Summe sieht. */
    (function () {
      var e = o.einheiten;
      if (!e || !Array.isArray(e.je_einheit) || !e.je_einheit.length) return '';
      var leer = e.je_einheit.filter(function (x) { return /leer/i.test(String(x.status || '')); });
      if (!leer.length) return '- Leerstand: keiner laut Einheitenliste';
      var flL = leer.reduce(function (a, x) { return a + (Number(x.wfl) || 0); }, 0);
      return '- Leerstand: ' + leer.length + ' von ' + e.anzahl + ' Einheiten'
        + (flL ? ' (' + Math.round(flL) + ' m²)' : '')
        + ' — das ist Potenzial UND Risiko zugleich, bitte beides benennen.';
    })(),
    (o.einheiten && o.einheiten.aufgeteilt != null)
      ? '- Aufteilung nach WEG: ' + (o.einheiten.aufgeteilt
          ? 'JA — die Einheiten sind einzeln verkäuflich (Aufteilungsgewinn möglich)'
          : 'NEIN — das Haus ist ungeteilt')
      : '',
    (o.einheiten && o.einheiten.gnd)
      ? '- Gesamtnutzungsdauer laut Konfigurator: ' + o.einheiten.gnd + ' Jahre'
      : '',
    /* ══ v2139a · WIE ALT IST DIESER EINHEITENSTAND? ═══════════════════
       `mfh-einheiten.js:946` schreibt bei jedem Speichern ein Datum
       (`stand`). Der Kommentar in `ui.js` nennt Marcels Auftrag woertlich:
       er wollte Modernisierung UND Stand erfasst haben - gelesen wurde
       nur die Modernisierung.

       > Ein Datensatz ohne Datum laesst keine Frage nach seiner
       > Aktualitaet zu. Das Modell kann nicht sagen "die Aufstellung ist
       > zwei Jahre alt", wenn es nicht weiss, wann sie entstand. */
    (o.einheiten && o.einheiten.stand)
      ? '- Stand dieser Einheiten-Aufstellung: ' + o.einheiten.stand
      : '',
    /* ══ v2139a · DIE SUMME DER EINHEITEN GEGEN DIE WOHNFLAECHE ═══════
       `ui.js:788` sendet `flaeche_summe` - die addierte Flaeche der
       Einheiten. Daneben steht `o.wfl`, die eingetragene Wohnflaeche.

       Zwei Zahlen zur selben Groesse sind kein Widerspruch, solange
       beide ihre Herkunft tragen. Weichen sie ab, ist das ein BEFUND:
       entweder fehlt eine Einheit in der Aufstellung, oder die
       Gesamtflaeche ist falsch. Beides aendert jede Kennzahl je m2.

       Die Schwelle ist 1 m2 - unter Rundung soll hier nichts gemeldet
       werden. Gerechnet wird NICHTS: genannt werden beide Zahlen. */
    (function () {
      var e = o.einheiten;
      if (!e || e.flaeche_summe == null || !isFinite(e.flaeche_summe)) return '';
      if (o.wfl == null || !isFinite(o.wfl)) {
        return '- Summe der Einheitenflaechen: ' + e.flaeche_summe + ' m2'
          + ' (eine Gesamtwohnflaeche ist nicht eingetragen)';
      }
      var diff = Number(e.flaeche_summe) - Number(o.wfl);
      if (Math.abs(diff) < 1) {
        return '- Summe der Einheitenflaechen: ' + e.flaeche_summe
          + ' m2 - deckt sich mit der eingetragenen Wohnflaeche.';
      }
      return '- ABWEICHUNG Flaeche: die Einheiten summieren sich auf '
        + e.flaeche_summe + ' m2, eingetragen sind ' + o.wfl + ' m2 ('
        + (diff > 0 ? '+' : '') + Math.round(diff * 10) / 10 + ' m2).'
        + ' Nenne BEIDE Zahlen und sage, was fehlen koennte (eine Einheit,'
        + ' Gewerbe, Keller). Rechne KEINE dritte Zahl aus und waehle keine aus.';
    })(),
    /* ══ v2139a · EIN STRING ZERFAELLT HIER IN BUCHSTABEN ═════════════
       `modernisierung` ist ein Verzeichnis Gewerk -> Stufe
       (`mfh-einheiten.js`, `d.gebaeude`). Gelesen wurde es mit
       `Object.keys()` - und das nimmt auch einen String an:
       `Object.keys('Dach neu')` gibt '0'..'7' zurueck, `length` ist 8,
       die Bedingung also WAHR, und im Prompt stuende
       `0=D, 1=a, 2=c, 3=h, ...`.

       Gefunden beim Bau von `tools/prompt-lecks-pruefen.mjs`: mein
       Pruefauftrag schickte versehentlich einen String, und der Prompt
       trug die Buchstaben. Das war mein Fehler im Pruefer - aber es ist
       genau der Fehler, den ein Umbau am Sender eines Tages echt macht.

       > Eine Pruefung auf `length` fragt, ob etwas DA ist, nicht ob es
       > die richtige GESTALT hat. Der Unterschied faellt erst im
       > Ergebnis auf, und dort sieht er wie ein Modellfehler aus. */
    (function () {
      var m = o.einheiten && o.einheiten.modernisierung;
      if (!m) return '';
      if (typeof m === 'string') {
        return m.trim() ? '- Modernisierungsstand (als Text erfasst): ' + m.trim() : '';
      }
      if (typeof m !== 'object' || Array.isArray(m) || !Object.keys(m).length) return '';
      return '- Modernisierungsstand (Anlage 2 ImmoWertV): '
        + Object.keys(m).map(function (k) { return k + '=' + m[k]; }).join(', ');
    })(),
    (o.einheiten && o.einheiten.anzahl > 1)
      ? '  ACHTUNG: Vergleiche Mietspiegel und ortsübliche Größen mit der '
        + 'Fläche JE EINHEIT, niemals mit der Gesamtfläche. Eine '
        + 'Gesamtfläche von ' + o.wfl + ' m² ist bei ' + o.einheiten.anzahl
        + ' Einheiten normal und KEIN Auffälligkeitsgrund.'
      : (/mehrfamilien|mfh|wohnhaus|zinshaus/i.test(String(o.objart || ''))
          ? '  ACHTUNG: Dies ist ein Mehrfamilienhaus. Die Wohnfläche ist die '
            + 'SUMME aller Einheiten, nicht die Größe einer Wohnung. Die Zahl der '
            + 'Einheiten liegt nicht vor — nenne deshalb KEINE Aussage zur '
            + 'Wohnungsgröße und vergleiche sie nicht mit einem Mietspiegel.'
          : ''),
    o.baujahr ? '- Baujahr: ' + o.baujahr : '',
    o.makrolage ? '- Makrolage (Selbstbewertung): ' + o.makrolage : '',
    o.mikrolage ? '- Mikrolage (Selbstbewertung): ' + o.mikrolage : '',
    /* v2157 · die vier Lage-Felder und die Lageklasse (N62.4) */
    o.lageklasse ? '- Lageklasse (Selbstbewertung): ' + o.lageklasse + '-Lage' : '',
    o.bevoelkerung ? '- Bevoelkerungsentwicklung (Selbstbewertung): ' + o.bevoelkerung : '',
    o.nachfrage ? '- Nachfrage-Indikatoren (Selbstbewertung): ' + o.nachfrage : '',
    o.wertsteigerung ? '- Wertsteigerungs-Potenzial (Selbstbewertung): ' + o.wertsteigerung : '',
    o.entwicklung ? '- Entwicklungs-Moeglichkeiten (Selbstbewertung): ' + o.entwicklung : '',
    o.thesis ? '- Investitionsthese des Investors: ' + o.thesis : '',
    o.risiken ? '- Vom Investor benannte Risiken: ' + o.risiken : '',
    o.notizen ? '- Sonstige Bemerkungen des Investors: ' + o.notizen : '',
    '',
    /* v1311: Die Herkunft je Feld — amtlich, abgerufen, geschaetzt. */
    hk ? '## HERKUNFT DER ANGABEN' : '',
    hk ? 'So sind die Werte dieses Objekts zustande gekommen:' : '',
    hk ? Object.keys(hk).slice(0, 40).map(function (id) {
           return '- ' + id + ': ' + hk[id];
         }).join('\n') : '',
    hk ? '' : '',
    hk ? 'NUTZE DAS. Eine amtlich belegte Zahl (BORIS, Stichtag, Zone) traegt eine' : '',
    hk ? 'Empfehlung; eine Naeherung ("Ortszentrum", "als Naeherung") traegt einen' : '',
    hk ? 'Vorbehalt, und der gehoert in den Text statt ins Kleingedruckte. Werte aus' : '',
    hk ? 'einer Marktpreisindikation sind belastbarer als Selbstbewertungen des' : '',
    hk ? 'Investors — sage das, wo es den Unterschied macht. ERFINDE KEINE Herkunft' : '',
    hk ? 'fuer Felder, die hier nicht stehen.' : '',
    hk ? '' : '',
    /* ═══ v1323 · Marktkontext und Erbbaurecht in der Analyse ════════════
       Marcels Vorgabe: „wichtig waere auch dass dem Co-Pilot und der
       Analyse diese Daten zur Bewertung zur Verfuegung stehen."

       GEMESSEN, warum sie es bisher nicht taten: `dealpilot_marktbewertung`
       wird vom Frontend seit v746 geschickt — ein `grep` ueber das ganze
       Backend findet KEINEN Leser. Dieselbe Falle wie beim Orchestrator
       (FALLEN.md, „ref laesst Felder fallen"): das Frontend schickt, die
       Gegenseite laesst fallen, und niemand merkt es, weil nichts rot wird.

       Die Zahlen hier sind echte Marktaggregate, keine Selbsteinschaetzung.
       Sie sind damit belastbarer als alles, was der Investor selbst
       eingestuft hat — und genau das soll der Text auch sagen. */
    mk ? '## MARKTKONTEXT (echte Angebotsdaten im Umkreis, 12 Monate)' : '',
    mk && mk.segment === 'gewerbe' ? ('Segment: Gewerbe / ' + (mk.klasse || '?')) : '',
    mk && mk.segment === 'gewerbe' && mk.kauf ? ('- Kauf eigene Klasse ' + _z(mk.kauf.klasse_median_sqm) + ' EUR/m2 (n=' + (mk.kauf.klasse_n || 0) + '), gesamter Gewerbemarkt ' + _z(mk.kauf.markt_median_sqm) + ' EUR/m2') : '',
    mk && mk.segment === 'gewerbe' && mk.miete ? ('- Miete eigene Klasse ' + _z(mk.miete.klasse_median_sqm) + ' EUR/m2 (n=' + (mk.miete.klasse_n || 0) + ')') : '',
    mk && mk.segment !== 'gewerbe' && mk.basis_median_sqm != null ? ('Vergleichsbasis: ' + _z(mk.basis_median_sqm) + ' EUR/m2 (n=' + mk.basis_n + ')') : '',
    mk && mk.vermietung ? ('- VERMIETET GEGEN FREI: vermietet ' + _z(mk.vermietung.vermietet_median_sqm) + ' EUR/m2 (n=' + mk.vermietung.vermietet_n + '), frei ' + _z(mk.vermietung.frei_median_sqm) + ' EUR/m2 (n=' + mk.vermietung.frei_n + '), Unterschied ' + _p(mk.vermietung.abschlag_pct) + '. Bei einer Kapitalanlage ist die VERMIETETE Gruppe die richtige Vergleichsbasis.') : '',
    mk && mk.energie ? ('- ENERGIEKLASSEN AM ORT: A-C ' + _z(mk.energie.gut_median_sqm) + ' EUR/m2 (n=' + mk.energie.gut_n + '), F-H ' + _z(mk.energie.schlecht_median_sqm) + ' EUR/m2 (n=' + mk.energie.schlecht_n + '), Spreizung ' + _p(mk.energie.spreizung_pct) + '. Das ist der oertlich GEMESSENE Abschlag fuer einen schlechten Energieausweis, kein Studienwert - nutze ihn, wenn die Energieklasse des Objekts bekannt ist.') : '',
    mk && mk.rendite ? ('- ANGEBOTSRENDITE AM ORT: Median ' + _p2(mk.rendite.median_pct) + ' (Q25 ' + _p2(mk.rendite.q25_pct) + ', Q75 ' + _p2(mk.rendite.q75_pct) + ', n=' + mk.rendite.n + '). Stelle die Bruttorendite des Objekts dagegen und sage, wo es liegt.') : '',
    mk && mk.erbbau_markt ? ('- Erbbaurechts-Angebote im Umkreis: ' + _z(mk.erbbau_markt.median_sqm) + ' EUR/m2, Anteil ' + _p(mk.erbbau_markt.anteil_pct) + ' der Angebote, Abstand zur Basis ' + _p(mk.erbbau_markt.abstand_pct) + '. VORSICHT: Volltextsuche ohne Ausschlusslogik, ein Angebot mit "kein Erbbaurecht" zaehlt mit. Signal, kein Beleg - nur als Groessenordnung verwenden.') : '',
    mk ? 'Diese Zahlen sind AGGREGATE ECHTER ANGEBOTE, keine Selbsteinschaetzung. Sie' : '',
    mk ? 'wiegen damit schwerer als die Lage- und Zustandsnoten des Investors. Rechne' : '',
    mk ? 'mit ihnen, nenne die Stichprobengroesse, und erfinde keine Zahl dazu.' : '',
    mk ? '' : '',
    eb && eb.ok ? '## ERBBAURECHT (§ 50 ImmoWertV)' : '',
    eb && eb.ok ? 'Das Objekt steht auf einem Erbbaurechtsgrundstueck. Der Marktwert ist ein' : '',
    eb && eb.ok ? 'VOLLEIGENTUMSWERT - kein Bewertungspartner nimmt den Parameter entgegen.' : '',
    eb && eb.ok ? ('- Bodenwert (gehoert dem Erbbaurechtsgeber): ' + _z(eb.teile.bodenwert) + ' EUR') : '',
    eb && eb.ok ? ('- ' + (eb.teile.zinsvorteil >= 0 ? 'Vorteil' : 'Nachteil') + ' aus dem Vertragszins: ' + _z(Math.abs(eb.teile.zinsvorteil)) + ' EUR (angemessen ' + eb.annahmen.zinssatzAngemessen + ' %' + (eb.annahmen.zinsQuelle ? ', oertlich erhoben' : '') + ')') : '',
    eb && eb.ok ? ('- ERBBAURECHTSWERT ' + _z(eb.erbbaurechtswert) + ' EUR, Abschlag ' + _z(eb.abschlag) + ' EUR = ' + _p(eb.abschlagPct)) : '',
    eb && eb.ok ? 'Der Abschlag ist in Wertpuffer, Wertsteigerung und Deal Score bereits' : '',
    eb && eb.ok ? 'eingerechnet. Erwaehne ihn trotzdem - er ist fuer Finanzierung und' : '',
    eb && eb.ok ? 'Wiederverkauf der wichtigste Einzelfaktor an diesem Objekt.' : '',
    eb && eb.ok && eb.annahmen.restlaufzeit < 30 ? 'ACHTUNG: unter 30 Jahren Restlaufzeit finanzieren die meisten Banken nicht mehr voll.' : '',
    eb && eb.ok ? '' : '',
    /* v2010 - DAS PRODUKTWISSEN. Bis hierher kannte die Pilot-Analyse
       die Begriffe der App nur aus hartkodierten Absaetzen weiter oben;
       `bot-wissen.md` las ausschliesslich der Telegram-Agent. Jetzt
       lesen alle drei dieselbe gepflegte Datei. */
    /* v2019b - der Block kommt jetzt von aussen (mit Marcels
       Ergaenzung). Ohne ihn bleibt der Basisblock - buildPrompt wird
       auch von Pruefwerkzeugen ohne Nutzer gerufen. */
    (function () { var _b = (opts && opts.wissensblock) || projektwissen.block();
      return _b ? ('\n' + _b + '\n') : ''; })(),

    /* ══ v2011 · DIE SIEBEN BLOECKE ══════════════════════════════
       Sie stehen VOR den Input-Daten, weil sie beschreiben, WAS das
       Objekt ist - die Kennzahlen sagen nur, wie es sich rechnet. */
    _st ? _zeilen('## STEUER (fuer Aufgabe 8 - bisher musstest du raten)', [
      ['Zu versteuerndes Einkommen', _st.zve != null ? _z(_st.zve) + ' EUR' : null],
      ['Grenzsteuersatz', _st.grenzsteuersatz_pct != null ? _p(_st.grenzsteuersatz_pct) : null],
      ['AfA-Satz', _st.afa_satz_pct != null ? _p(_st.afa_satz_pct) : null],
      ['AfA ueber Restnutzungsdauer', _st.afa_rnd_jahre != null ? _st.afa_rnd_jahre + ' Jahre' : null],
      ['Gebaeudeanteil', _st.gebaeudeanteil_pct != null ? _p(_st.gebaeudeanteil_pct) : null],
      /* ══ v2139 · VIER STEUERANGABEN REISTEN UNGELESEN MIT ══════════
         `ui.js:892-911` sendet sie seit v2067a mit eigener Begruendung.
         Gelesen wurden fuenf von neun.

         Besonders die Sanierung: Aufgabe 8 soll die Steuerwirkung
         beurteilen, und ob 40.000 EUR Sanierung als Erhaltungsaufwand
         ueber zwei bis fuenf Jahre verteilt oder aktiviert werden,
         aendert die Steuerwirkung der ersten Jahre vollstaendig. Das
         Modell hat es nicht geraten - es wusste nichts davon. */
      ['Eigener AfA-Satz', _st.afa_eigen_pct != null ? _p(_st.afa_eigen_pct) : null],
      ['Sanierungskosten', (_st.sanierung && _st.sanierung.kosten_eur != null)
        ? _z(_st.sanierung.kosten_eur) + ' EUR'
          + (_st.sanierung.betrag_ist ? ' (' + _st.sanierung.betrag_ist + ')' : '') : null],
      ['Sanierung steuerlich angesetzt', (_st.sanierung && _st.sanierung.steuerlich_angesetzt != null)
        ? (_st.sanierung.steuerlich_angesetzt
            ? ('ja, verteilt auf ' + (_st.sanierung.verteilung_jahre === 'auto'
                ? 'automatisch gewaehlte Jahre' : (_st.sanierung.verteilung_jahre || '?') + ' Jahre'))
            : 'nein - als Erhaltungsaufwand NICHT angesetzt') : null],
      ['Sonder-AfA § 7b', _st.sonder_afa_7b ? 'aktiv' : null],
      ['Erbbaurecht', (_st.erbbaurecht && _st.erbbaurecht.ja)
        ? ('ja' + (_st.erbbaurecht.erbbauzins_eur_jahr != null
            ? ', Erbbauzins ' + _z(_st.erbbaurecht.erbbauzins_eur_jahr) + ' EUR/Jahr' : '')) : null]
    ]) : '',
    /* v2166 · Werbungskosten, Jahresverlauf und das Jahr der Wende -
       fertig gerechnet von der App (calc.js, State.cfRows). */
    (_st && (_st.werbungskosten_jahr1 || _st.verlauf || _st.wende)) ? (function () {
      var o = [''];
      var wk = _st.werbungskosten_jahr1;
      if (wk) {
        o.push('## STEUER: WERBUNGSKOSTEN JAHR 1 (von der App gerechnet)');
        o.push('- Mieteinnahmen ' + _z(wk.mieteinnahmen_eur) + ' EUR; Werbungskosten gesamt ' + _z(wk.summe_eur)
          + ' EUR = Schuldzinsen ' + _z(wk.schuldzinsen_eur) + ' + AfA ' + _z(wk.afa_eur)
          + ' + Bewirtschaftung (steuerlich) ' + _z(wk.bewirtschaftung_steuerlich_eur) + ' EUR');
      }
      var w = _st.wende;
      if (w) {
        o.push('## STEUER: WANN WIRD DAS OBJEKT STEUERLICH POSITIV');
        o.push(w.erstes_jahr_steuerlich_positiv
          ? ('- Erstes Jahr mit positivem Ergebnis aus Vermietung: ' + w.erstes_jahr_steuerlich_positiv
             + '. Steuerwirkung bis dahin: ' + _z(w.steuerwirkung_bis_dahin_eur) + ' EUR (negativ = Erstattung).'
             + ' Steuerlast danach bis Jahr 15: ' + _z(w.steuerlast_danach_bis_jahr15_eur) + ' EUR.')
          : ('- In den gerechneten ' + w.gerechnet_ueber_jahre + ' Jahren bleibt das Ergebnis negativ.'
             + ' Steuerwirkung gesamt: ' + _z(w.steuerwirkung_bis_dahin_eur) + ' EUR (negativ = Erstattung).'));
      }
      if (Array.isArray(_st.verlauf) && _st.verlauf.length) {
        o.push('## STEUER: JAHRESVERLAUF (EUR; Ergebnis = Miete - Zinsen - AfA - BWK; Steuer negativ = Erstattung)');
        o.push('Jahr | Miete | Zinsen | AfA | BWK | Ergebnis V+V | Steuer | Cashflow n. St.');
        _st.verlauf.forEach(function (r) {
          o.push([r.jahr, r.miete_eur, r.zinsen_eur, r.afa_eur, r.bwk_steuerlich_eur, r.ergebnis_vuv_eur,
                  r.steuer_eur, r.cashflow_nach_steuer_eur].map(function (x) { return x == null ? '-' : x; }).join(' | '));
        });
      }
      return o.join('\n');
    })() : '',
    _bw ? _zeilen('## BEWIRTSCHAFTUNG (Struktur, nicht nur die Summe)', [
      ['Hausgeld umlagefaehig', _bw.hausgeld_umlagefaehig != null ? _z(_bw.hausgeld_umlagefaehig) + ' EUR' : null],
      ['Hausgeld NICHT umlagefaehig', _bw.hausgeld_nicht_umlagefaehig != null ? _z(_bw.hausgeld_nicht_umlagefaehig) + ' EUR' : null],
      ['Grundsteuer', _bw.grundsteuer != null ? _z(_bw.grundsteuer) + ' EUR' : null],
      ['WEG-Ruecklage', _bw.weg_ruecklage != null ? _z(_bw.weg_ruecklage) + ' EUR' : null],
      ['Eigene Ruecklage', _bw.eigene_ruecklage != null ? _z(_bw.eigene_ruecklage) + ' EUR' : null],
      ['Kalkulierter Mietausfall', _bw.mietausfall_pct != null ? _p(_bw.mietausfall_pct) : null]
    ]) : '',
    /* v2026 - der Plan sagt jetzt, WORAUS er gerechnet ist, und
       kennzeichnet die Indexmieten als Annahme. Die vier
       Progressionsfelder kommen im Modus `einheiten` nicht mehr mit
       (ui.js laesst sie dort weg), also faellt ihre Zeile von selbst. */
    _me ? _zeilen('## MIETENTWICKLUNGSPLAN (bereits geplant, nicht von dir zu erfinden)', [
      ['Woraus gerechnet', _me.herkunft || _me.modus],
      ['Wohnungen mit Ist-Miete', _me.einheiten_gesamt],
      ['davon im Plan', _me.einheiten_mit_plan],
      ['davon Indexmiete (Hoehe = ANNAHME)', _me.einheiten_index],
      ['Zielmiete', _me.soll_eur_qm != null ? _me.soll_eur_qm + ' EUR/m2' : null],
      ['Schritte', _me.schritte],
      ['Intervall', _me.intervall_jahre != null ? _me.intervall_jahre + ' Jahre' : null],
      ['Schritthoehe', _me.schritt_pct != null ? _p(_me.schritt_pct) : null],
      ['Mietspiegel', _me.mietspiegel_eur_qm != null ? _me.mietspiegel_eur_qm + ' EUR/m2' : null],
      ['Kalkulierter Leerstand', _me.leerstand_pct != null ? _p(_me.leerstand_pct) : null],
      /* v2139: `umlagefaehig` sagt, ob der Plan auf der Kaltmiete oder
         auf der Warmmiete steht. Ohne diese Angabe sind Zielmiete und
         Mietspiegel-Vergleich nicht einzuordnen - 12 EUR/m2 warm und
         12 EUR/m2 kalt sind zwei verschiedene Objekte. */
      ['Bezug der Zielmiete', _me.umlagefaehig != null
        ? (_me.umlagefaehig ? 'inkl. umlagefaehiger Kosten (warm)' : 'Kaltmiete') : null]
    ]) : '',
    (_me && _me.modus === 'einheiten')
      ? ('\nZUR MIETENTWICKLUNG: Die Tabelle ist aus den Mietvertraegen der einzelnen'
        + '\nWohnungen gerechnet, nicht aus einer pauschalen Steigerung. Wohnungen ohne'
        + '\nHaken bleiben auf ihrer Ist-Miete - fuer sie wird KEINE Steigerung'
        + '\nangenommen. Rechne keine eigene Progression dagegen.'
        + ((_me.einheiten_index > 0)
            ? ('\nBei den Indexmietvertraegen (§ 557b BGB) steht der TERMIN im Vertrag, die'
              + '\nHOEHE nicht - sie ergibt sich erst aus dem Verbraucherpreisindex. Nenne'
              + '\ndiesen Teil ausdruecklich eine Annahme, kein vereinbartes Ergebnis.')
            : ''))
      : '',
    /* v2041 - ANKAUF gegen BESTAND. Gebaut von `_ankaufBlock()` weiter
       unten; hier steht nur der Aufruf, damit die Verkettung lesbar
       bleibt. */
    _ak ? _ankaufBlock(_ak) : '',
    _pz ? _potenzialBlock(_pz) : '',   /* v2430 */
    _wo ? _zeilen('## WOHNUNGSDETAILS (fuer den Mietspiegel-Vergleich)', [
      ['Zimmer', _wo.zimmer], ['Baeder', _wo.baeder],
      ['Etage', _wo.etage], ['Etagen gesamt', _wo.etagen_gesamt],
      ['Garagen', _wo.garagen], ['Stellplaetze aussen', _wo.stellplaetze_aussen],
      ['Balkon/Terrasse', _wo.balkon_qm != null ? _wo.balkon_qm + ' m2' : null],
      ['Grundriss', _wo.grundriss]
    ]) : '',
    _bo ? _zeilen('## BODEN UND SUBSTANZ', [
      ['Bodenrichtwert', _bo.bodenrichtwert_eur_qm != null ? _z(_bo.bodenrichtwert_eur_qm) + ' EUR/m2' : null],
      ['Stichtag', _bo.brw_stichtag],
      ['Grundstueck', _bo.grundstueck_qm != null ? _z(_bo.grundstueck_qm) + ' m2' : null],
      ['Miteigentumsanteil', _bo.miteigentumsanteil_pct != null ? _p(_bo.miteigentumsanteil_pct) : null],
      ['Bruttogrundflaeche', _bo.bgf_qm != null ? _z(_bo.bgf_qm) + ' m2' : null],
      ['Standardstufe', _bo.standardstufe],
      ['Sachwertfaktor', _bo.sachwertfaktor],
      ['Liegenschaftszins', _bo.liegenschaftszins_pct != null ? _p(_bo.liegenschaftszins_pct) : null],
      ['Nutzungsart', _bo.nutzungsart]
    ]) : '',
    /* ══ v2156 · EINE ZAHL OHNE AUFTRAG WIRD NICHT BENUTZT ═══════════════
       Marcel am 12.10.2026: „auch Liegenschaftszinsen … dass auch wirklich
       alles damit einfliesst."
       Der Zins STAND im Prompt (eine Zeile hoeher, seit v2011) — aber kein
       Satz sagte dem Modell, was es damit tun soll. Anders als bei der
       Restnutzungsdauer, wo ein ausdruecklicher Abgleich-Auftrag steht.
       Gemessen: er kommt in den Antworten praktisch nicht vor.
       > Ein Datum im Prompt ist kein Datum in der Analyse. Ohne Auftrag
       > liest das Modell darueber hinweg — dieselbe Lehre wie bei den
       > Feldern ohne Zielfeld (v2139). */
    (_bo && _bo.liegenschaftszins_pct != null)
      ? '- AUFTRAG zum Liegenschaftszins: er ist die Groesse, an der der\n'
        + '  Ertragswert haengt (ein Prozentpunkt mehr senkt ihn um gut ein\n'
        + '  Fuenftel). Ordne ihn ein: passt er zu Lage und Objektart, und was\n'
        + '  bedeutet er fuer die Bewertung? Liegt unten ein Marktbericht mit\n'
        + '  einem eigenen Zinssatz vor, gilt dessen Wert — nenne dann beide\n'
        + '  und sage, welcher woher kommt.'
      : '',
    _ha ? _zeilen('## HALTER UND UEBERGANG (privat oder Gesellschaft aendert Steuer und Finanzierung)', [
      ['Halter', _ha.name], ['Gehalten seit', _ha.seit],
      ['Kaufdatum', _ha.kaufdatum],
      ['Wirtschaftlicher Uebergang', _ha.wirtschaftlicher_uebergang],
      ['Vermietungsstand', _ha.vermietungsstand]
    ]) : '',
    _zu ? _zeilen('## ZUSTAND UND ENERGIE (der Marktkontext oben bietet dafuer den gemessenen Abschlag an)', [
      ['Zustand', _zu.ds2_zustand], ['Energieklasse', _zu.energieklasse],
      ['Modernisierung', _zu.modernisierung],
      ['Modernisierungspunkte', _zu.modernisierungspunkte],
      /* ══ v2139 · DIE ACHT BAUTEILE UND DIE GERECHNETE RND ══════════
         `ui.js:1025-1061` sendet beides seit v2067/v2068, jeweils mit
         einer Begruendung, die genau sagt, warum eine Summe nicht
         reicht: Eine Summe sagt nicht, WO die Punkte fehlen.

         Gelesen wurde nur die Summe (`modernisierungspunkte`). Genau
         die Unterscheidung, um die es ging, kam nicht an.

         Und die RND des Wizards ist etwas anderes als
         `steuer.afa_rnd_jahre`: dort steht, was der Nutzer EINGETRAGEN
         hat, hier was die Bauteile HERGEBEN. Weichen sie ab, ist das
         ein Befund - deshalb steht der Abgleich als Auftrag dabei und
         nicht als stille Zahl. */
      ['Letzte Modernisierung je Bauteil', (_zu.bauteile && typeof _zu.bauteile === 'object'
        && Object.keys(_zu.bauteile).length)
        ? Object.keys(_zu.bauteile).map(function (k) { return k + ' ' + _zu.bauteile[k]; }).join(', ')
        : null],
      ['Restnutzungsdauer GERECHNET (Anlage 2 ImmoWertV)', (_zu.restnutzungsdauer_berechnet
        && _zu.restnutzungsdauer_berechnet.jahre != null)
        ? (_zu.restnutzungsdauer_berechnet.jahre + ' Jahre'
           + (_zu.restnutzungsdauer_berechnet.gesamtnutzungsdauer != null
              ? ' von ' + _zu.restnutzungsdauer_berechnet.gesamtnutzungsdauer : '')
           + (_zu.restnutzungsdauer_berechnet.alter_jahre != null
              ? ', Alter ' + _zu.restnutzungsdauer_berechnet.alter_jahre + ' Jahre' : '')
           + (_zu.restnutzungsdauer_berechnet.verfahren
              ? ', Verfahren ' + _zu.restnutzungsdauer_berechnet.verfahren : '')
           + (_zu.restnutzungsdauer_berechnet.stand
              ? ', Stand ' + _zu.restnutzungsdauer_berechnet.stand : ''))
        : null]
    ]) : '',
    /* v2139: der Auftrag zum Abgleich. Zwei Restnutzungsdauern aus
       verschiedenen Quellen sind kein Widerspruch, solange beide ihre
       Herkunft tragen - aber eine Abweichung gehoert genannt. */
    (_zu && _zu.restnutzungsdauer_berechnet && _zu.restnutzungsdauer_berechnet.jahre != null
      && _st && _st.afa_rnd_jahre != null
      && Math.abs(Number(_zu.restnutzungsdauer_berechnet.jahre) - Number(_st.afa_rnd_jahre)) >= 3)
      ? ('\n- ABWEICHUNG Restnutzungsdauer: eingetragen ' + _st.afa_rnd_jahre
         + ' Jahre (Steuer), aus den Bauteilen gerechnet '
         + _zu.restnutzungsdauer_berechnet.jahre + ' Jahre. Nenne BEIDE mit ihrer'
         + ' Herkunft und sage, was die Abweichung fuer die AfA bedeutet.'
         + ' Rechne KEINE dritte Zahl aus.')
      : '',
    /* ══ v2140 · DIESER INVESTOR — SEINE SCHWELLEN, NICHT UNSERE ══════

       Aufgabe 5 („Investor-Fit") nannte drei Archetypen und keine
       Eingabe. Die Schwellen dieses Nutzers lagen im `localStorage`.

       Die Ordnung darunter ist der eigentliche Inhalt dieses Blocks.
       Ohne sie stehen zwei Schwellen zur selben Groesse im Prompt - die
       DealPilot-Skala („solide ab DSCR 1,2", weiter oben) und die
       persoenliche („ab 1,35 kauf ich") - und das Modell waehlt eine
       aus, ohne zu sagen welche.

       > Der SCORE darf das Profil nie sehen. Dieselbe Wohnung hat fuer
       > jeden Nutzer denselben Score; eine Einstellung, die ihn
       > verschiebt, macht zwei Nutzer unvergleichbar. Das ist dieselbe
       > Regel wie fuer die Rechenkerne: ein Kern liest NIE
       > Einstellungen.

       Die ANALYSE darf es - sie urteilt fuer diesen Investor. */
    /* ══ v2140b · WAS DAVON HAT DER NUTZER SELBST GESETZT? ════════════
       `_selbst_gesetzt` ist die Liste der Schluessel, die im
       `localStorage` des Nutzers stehen (`ui.js`, aus `load()`). Alles
       andere ist die VORGABE aus `config.js` - sie gilt, weil die App
       danach rechnet, aber sie ist keine Entscheidung.

       Ohne diese Trennung urteilt das Modell gegen eine Schwelle und
       nennt sie "seine" - und der Nutzer liest ein Mass, das er nie
       gesetzt hat. */
    _ip ? (function () {
      var g = Array.isArray(_ip._selbst_gesetzt) ? _ip._selbst_gesetzt : [];
      var mark = function (k, wert) {
        if (wert == null) return null;
        return wert + (g.indexOf(k) >= 0 ? '  (selbst gesetzt)' : '  (Vorgabe, nicht gesetzt)');
      };
      return _zeilen('## DIESER INVESTOR (Einstellungen, keine Messung am Objekt)', [
        ['Mindest-DSCR', mark('min_dscr', _ip.min_dscr != null
          ? String(_ip.min_dscr).replace('.', ',') : null)],
        ['Mindest-Cashflow', mark('min_cashflow_vor_st', _ip.min_cashflow_vor_st != null
          ? _z(_ip.min_cashflow_vor_st) + ' EUR/Monat vor Steuer' : null)],
        ['Maximaler LTV', mark('max_ltv', _ip.max_ltv != null
          ? _p(Number(_ip.max_ltv)) : null)],
        ['Strategie', mark('strategie', _ip.strategie)],
        ['Risikoneigung', mark('risikoneigung', _ip.risikoneigung)],
        ['Erwarteter Verkaeufer-Druck', mark('verkaeufer_druck', _ip.verkaeufer_druck)],
        ['Eingeschaetzte Marktlage', mark('marktlage', _ip.marktlage)]
      ]);
    })() : '',
    _ip ? ('\n- Diese Zahlen sind EINSTELLUNGEN. Der DealScore und die DealPilot-Skala'
      + '\n  weiter oben bleiben unberuehrt: sie messen das OBJEKT. Rechne keinen'
      + '\n  Score nach dem Profil um.'
      + '\n- Beantworte Aufgabe 5 (Investor-Fit) AN DIESEN Schwellen: nenne je'
      + '\n  Schwelle, ob sie gehalten oder verfehlt wird, mit BEIDEN Zahlen'
      + '\n  (Schwelle und gemessener Wert).'
      + '\n- Widerspricht eine persoenliche Schwelle der DealPilot-Skala (etwa'
      + '\n  Mindest-DSCR 1,35 gegen "solide ab 1,2"), nenne BEIDE und sage,'
      + '\n  welche wessen ist. Mische sie nicht und waehle keine aus.'
      /* v2140b: der frueher hier stehende Satz („Fehlt eine Schwelle
         hier...") konnte NIE greifen - `get()` im Frontend gibt immer
         einen Wert, notfalls die Vorgabe. Eine Regel, deren Bedingung
         nicht eintreten kann, ist keine Regel. Jetzt steht die
         Unterscheidung an der Zeile selbst. */
      + '\n- "(selbst gesetzt)" heisst: eine Entscheidung dieses Nutzers. Daran'
      + '\n  darfst du ihn messen. "(Vorgabe, nicht gesetzt)" ist der Standardwert'
      + '\n  der App - er gilt fuer die Rechnung, ist aber KEINE Aussage des Nutzers.'
      + '\n  Nenne ihn nicht "seine" Schwelle und bau darauf kein Urteil ueber'
      + '\n  seine Ziele.'
      + (Array.isArray(_ip._selbst_gesetzt) && _ip._selbst_gesetzt.length === 0
          ? '\n- ACHTUNG: der Nutzer hat KEINE dieser Angaben selbst gesetzt. Alles'
            + '\n  oben ist Vorgabe. Urteile nach der DealPilot-Skala, sage das'
            + '\n  ausdruecklich, und schlage ihm vor, sein Profil zu fuellen'
            + '\n  (Einstellungen -> Standardwerte).'
          : '')) : '',
    '',
    /* v2013 - DIE FOTOS. Ein Bild zeigt einen EINDRUCK, keine Messung. */
    _nFotos ? ('\n## FOTOS DES OBJEKTS\nDu bekommst ' + _nFotos + ' Foto(s) dieses Objekts mitgeliefert.'
      + '\n- Beschreibe, was SICHTBAR ist: Bauweise, Fassade, Fenster, Dach, Umfeld, Pflegezustand.'
      + '\n- Nenne es als visuellen Eindruck, nicht als Feststellung.'
      + '\n- Leite aus einem Foto NIEMALS ab: Baujahr, Wohnflaeche, Sanierungsjahr, Energieklasse'
      + '\n  oder einen Wert. Dafuer sind die erfassten Felder da.'
      + '\n- Der Zustand steht als ERFASSTES Feld oben (Abschnitt ZUSTAND UND ENERGIE).'
      + '\n  Widerspricht der Bildeindruck diesem Feld, SAGE DAS ausdruecklich und nenne beides -'
      + '\n  ersetze das Feld nicht stillschweigend.'
      + '\n- Zeigt ein Bild nichts Aussagekraeftiges, sage das statt etwas zu konstruieren.') : '',
    '',
    /* ══ v2022 · MIETVERTRAEGE JE EINHEIT ════════════════════════
       Ohne diese Regel waeren die neuen Felder weitere Zahlen. */
    /* v2022a - hier stand `ein`. Die Einheiten haengen an `o.einheiten`
       (o = payload.objekt), nicht an einer Variablen `ein` - die gibt es
       in buildPrompt gar nicht. Der Container hat es beim ersten echten
       Aufruf geworfen: ReferenceError: ein is not defined. node --check
       sieht so etwas nicht, es ist gueltige Syntax. */
    (o.einheiten && Array.isArray(o.einheiten.je_einheit)
      && o.einheiten.je_einheit.some(function (e) { return e && e.vertragsart; }))
      ? ('\n## MIETVERTRAEGE JE EINHEIT'
        /* v2139: der Verweis auf den Ort. Bis hierher nannte dieser
           Block vier Feldnamen, die im Prompt nicht vorkamen - weder
           als Wert noch als Ort. Jetzt stehen sie in der Einheitenzeile
           oben, und der Block sagt das. */
        + '\n(Die Werte stehen oben in der Einheitenliste je Zeile.)'
        + '\n- "vertragsart" steht je Einheit. Staffelmiete (\u00a7 557a BGB) und Indexmiete'
        + '\n  (\u00a7 557b BGB) tragen ihre naechste Erhoehung SCHON im Vertrag: das ist ein'
        + '\n  TERMIN, kein Mieterhoehungspotenzial. Behandle beides nicht gleich - sonst'
        + '\n  rechnest du dieselbe Steigerung zweimal (einmal als Staffel, einmal als'
        + '\n  Luft zur Marktmiete).'
        + '\n- "naechste_anpassung" ist dieser Termin. Nenne ihn, wenn er in den naechsten'
        + '\n  zwei Jahren liegt.'
        + '\n- "letzte_erhoehung" sagt, wie lange die Miete schon steht. Je laenger, desto'
        + '\n  eher ist Spielraum da - aber nur bei UNBEFRISTETEN Vertraegen ohne Staffel.'
        + '\n- "befristet_bis" ist ein Leerstandsrisiko mit Datum, kein Vorteil.'
        + '\n- Zeitmiete (\u00a7 575 BGB) braucht einen gesetzlichen Grund; moebliert/Kurzzeit'
        + '\n  (\u00a7 549 Abs. 2 BGB) hat keinen Kuendigungsschutz; preisgebundene Wohnungen'
        + '\n  folgen der Kostenmiete, nicht dem Mietspiegel.'
        /* v2023a - die Regel zu `rnd_eigen` ist entfallen: das Feld gibt
           es seit v2023 nicht mehr. Die Restnutzungsdauer je Einheit
           kommt aus dem Zustand (Anlage 2 ImmoWertV, Schritt 3/4 des
           MFH-Konfigurators) - EIN Weg, nicht zwei. */
        + '\n- Die Restnutzungsdauer je Einheit steht NICHT hier: sie wird aus dem'
        + '\n  Zustand gerechnet (Anlage 2 ImmoWertV). Leite sie nicht aus dem Vertrag ab.')
      : '',
    '',
    '## INPUT-DATEN',
    '',
    'DealScore: ' + (ds.total != null ? ds.total : '–') + ' / 100',
    /* v2009 - hier stand nur `.total`. Die vier Teilscores reisen seit
       jeher mit und wurden verworfen - waehrend das Antwortformat ein
       Feld `score_vergleich` verlangt, das erklaeren soll, WELCHE
       Zusatz-KPIs die Differenz treiben. Das Modell musste raten. */
    isc ? ('Investor Deal Score: ' + (isc.total != null ? isc.total : '–') + ' / 100 (beruecksichtigt zusaetzlich Lage/Substanz/Upside — 24 KPIs)') : '',
    /* v2009 - die Aufschluesselung des Investor Deal Score. */
    (isc && (isc.rendite != null || isc.finanzierung != null || isc.risiko != null || isc.lage != null))
      ? ('  davon Rendite ' + (isc.rendite != null ? isc.rendite : '–')
         + ' | Finanzierung ' + (isc.finanzierung != null ? isc.finanzierung : '–')
         + ' | Risiko ' + (isc.risiko != null ? isc.risiko : '–')
         + ' | Lage ' + (isc.lage != null ? isc.lage : '–')
         + (isc.label ? ' | Stufe ' + isc.label : '')
         + '  (nutze GENAU diese vier fuer score_vergleich - nicht raten)')
      : '',

    /* v2009 - VERMARKTUNGSDAUER. `verhandlung` wurde seit jeher
       geschickt und kam im ganzen Dienst nur EINMAL vor: in der
       Beschreibung der Ausgabe. Wie lange ein Objekt am Markt steht,
       ist einer der staerksten Verhandlungshebel ueberhaupt. */
    (vh && (vh.tage_online != null || vh.inseriert_seit))
      ? ('\nVERMARKTUNGSDAUER\n'
         + (vh.tage_online != null ? '- Seit ' + vh.tage_online + ' Tagen inseriert\n' : '')
         + (vh.inseriert_seit ? '- Inseriert seit: ' + vh.inseriert_seit + '\n' : '')
         + '- Lange Standzeit ist ein Verhandlungshebel, kurze mahnt zur Eile. '
         + 'Nenne die Zahl in der Verhandlungsempfehlung, wenn sie etwas aussagt.')
      : '',

    /* v2009 - DIE GEMESSENEN LAGESCORES. Bisher wurden aus
       `dealpilot_marktbewertung` nur `marktkontext` und `erbbaurecht`
       gelesen. Die Lagescores kommen aus dem Marktbericht - also aus
       einer MESSUNG - waehrend `makrolage`/`mikrolage` weiter oben
       Marcels SELBSTeinschaetzung sind. Das Modell sah bisher nur die
       Selbsteinschaetzung und nicht die Messung daneben. */
    (_dpmb && (_dpmb.mikrolage || _dpmb.makrolage || _dpmb.wertentwicklung_pct_pa != null))
      ? ('\nDEALPILOT-LAGESCORES (gemessen, nicht geschaetzt)\n'
         + (_dpmb.mikrolage ? '- Mikrolage: ' + (_dpmb.mikrolage.label || '–')
             + (_dpmb.mikrolage.score != null ? ' (' + _dpmb.mikrolage.score + '/100)' : '') + '\n' : '')
         + (_dpmb.makrolage ? '- Makrolage: ' + (_dpmb.makrolage.label || '–')
             + (_dpmb.makrolage.score != null ? ' (' + _dpmb.makrolage.score + '/100)' : '') + '\n' : '')
         + (_dpmb.wertentwicklung_pct_pa != null ? '- Wertentwicklung: ' + _p(_dpmb.wertentwicklung_pct_pa) + ' p.a.\n' : '')
         + (_dpmb.marktwert != null ? '- Marktwert laut Karte: ' + _z(_dpmb.marktwert) + ' EUR\n' : '')
         + 'Diese Werte sind GEMESSEN. Weichen sie von der Selbsteinschaetzung '
         + 'des Investors ab, sage es und begruende mit diesen Zahlen.')
      : '',

    '',
    'Cashflow:',
    /* v2009 - `cf_m` ist der Cashflow VOR Steuer (calc.js:1970:
       cf_m = cf_op/12, waehrend cf_ns = cf_op - steuer). Das stand
       bisher nicht dran, und Aufgabe 8 verlangt eine Aussage zur
       Steuererstattung. Jetzt steht beides da und ist benannt. */
    '- Monatlich (VOR Steuer): ' + fmtEur(k.cf_m),
    (k.cf_ns != null && isFinite(k.cf_ns)) ? ('- Jaehrlich NACH Steuer: ' + fmtEur(k.cf_ns)) : '',
    (k.steuer != null && isFinite(k.steuer)) ? ('- Steuerwirkung p.a.: ' + fmtEur(-k.steuer) + ' (negativ = Erstattung)') : '',
    (k.afa != null && isFinite(k.afa)) ? ('- AfA p.a.: ' + fmtEur(k.afa)) : '',
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
    /* v2264 · Ohne Darlehen gibt es keinen Schuldendienst - „DSCR 0,00 kritisch"
       (gemessen Sachsenstr. 18) war falsch. */
    (!(Number(f.d1) > 0) && !(Number(k.dscr) > 0))
      ? '- Wert: entfällt — kein Darlehen, also kein Schuldendienst. NICHT als Risiko oder „kritisch“ werten.'
      : ('- Wert: ' + fmtNum(k.dscr, 2) + '  → Einordnung nach DealPilot-Skala oben'),
    (!(Number(f.d1) > 0) && !(Number(k.dscr) > 0)) ? '' : ('- Score: ' + dscrScore + ' / 100'),
    '',
    'Potenzial (Wertsteigerung + Mietsteigerung):',
    '- Beschreibung: ' + potDesc,
    '- Score: ' + potScore + ' / 100',
    '',
    'Bruttomietrendite: ' + fmtPct(k.bmy, 2),
    'Kaufpreis: ' + fmtEur(k.kp),
    'Gesamtinvestition: ' + fmtEur(k.gi),
    'Eigenkapital: ' + fmtEur(k.ek),
    /* v2832 · hier stand „Eigenkapitalrendite (EK-Rendite): 3,7 %" - gemeint war
       k.em, das Equity Multiple (Vermoegenszuwachs / Eigenkapital, ein Vielfaches).
       Gemessen (Rechenwege-Pruefer 22.10.2026, Fund 12) an 2026-1054. Die
       EK-Rendite (k.ekr, p. a. vor Steuern) reist seit v2832 eigens mit. */
    k.ekr != null && isFinite(Number(k.ekr)) ? 'Eigenkapitalrendite (EK-Rendite, p. a. vor Steuern): ' + fmtPct(Number(k.ekr), 1) : '',
    'Equity Multiple (Vermögenszuwachs über die Haltedauer / Eigenkapital): ' + (k.em == null ? '–' : (!isFinite(k.em) ? 'unendlich — no-money-down (Kaufpreis & Kaufnebenkosten voll fremdfinanziert)' : Number(k.em).toFixed(1).replace('.', ',') + '-fach')),
    f.d1z_pct != null ? 'Sollzins D1: ' + Number(f.d1z_pct).toFixed(2) + ' %' : '',
    f.d1t_pct != null ? 'Tilgung D1: ' + Number(f.d1t_pct).toFixed(2) + ' %' : '',
    f.restschuld_ezb != null ? 'Restschuld am Ende der Zinsbindung: ' + fmtEur(f.restschuld_ezb) : '',
    /* v2009 - Aufgabe 13 verlangt eine Anschlussfinanzierungs-Analyse.
       Bis hierher reiste die Restschuld mit, aber nicht, WANN die
       Zinsbindung endet. Eine Restschuld ohne Datum ist keine Basis. */
    (f.d1_bindj != null && f.d1_bindj !== '') ? ('Zinsbindung: ' + f.d1_bindj + ' Jahre') : '',
    (f.anschl_z != null && f.anschl_z !== '') ? ('Angenommener Anschlusszins: ' + f.anschl_z + ' %') : '',
    (f.anschl_t != null && f.anschl_t !== '') ? ('Angenommene Anschlusstilgung: ' + f.anschl_t + ' %') : '',
    '',
    /* v947-mbsource: Der DealPilot-Marktbericht ist die BESTE Quelle im Prompt —
     * gemessene Vergleichsdaten statt Formularfelder. Er steht deshalb VOR der
     * Marktbewertung. Alles hier ist gerechnet, nicht der KI zum Schaetzen
     * ueberlassen: Abweichungen, Spanne und Zeitabstaende. */
    ...(mbr ? (function () {
      var a = mbr.aktuell || {};
      var L = [];
      L.push('## DEALPILOT-MARKTBERICHT (gemessene Daten — die BESTE Quelle hier, vor allem anderen nutzen)');
      L.push('- Stand: ' + new Date(a.created_at).toLocaleString('de-DE') + ' · ' + mbr.anzahl + ' Bericht(e) zu diesem Objekt');
      if (a.address) L.push('- Adresse laut Bericht: ' + a.address);
      if (a.market_value != null) L.push('- Marktwert (Indikation): ' + fmtEur(a.market_value));
      if (a.market_value_low != null && a.market_value_high != null) {
        var lo = Number(a.market_value_low), hi = Number(a.market_value_high);
        L.push('- Vergleichsspanne: ' + fmtEur(lo) + ' bis ' + fmtEur(hi));
        if (lo > 0) {
          var faktor = hi / lo;
          L.push('- STREUUNG: das obere Ende ist das ' + faktor.toFixed(2).replace('.', ',') + '-fache des unteren.');
          if (faktor > 1.5) {
            L.push('  ACHTUNG: Diese Streuung ist GROSS. Der Punktwert ist eine Orientierung,');
            L.push('  KEINE Aussage. Sage das deutlich. Fuer Kalkulation und Beleihung ist das');
            L.push('  untere Drittel die belastbare Groesse — nicht der Punktwert.');
          }
        }
      }
      if (a.median_sqm != null) L.push('- Vergleichsmedian: ' + Math.round(Number(a.median_sqm)).toLocaleString('de-DE') + ' €/m²'); /* nicht fmtNum(x,0): `dec || 2` macht daraus 2 Nachkommastellen */
      if (a.confidence_pct != null) L.push('- Aussagekraft laut Bericht: ' + a.confidence_pct + ' %');
      if (a.micro_score != null) L.push('- Mikrolage: ' + a.micro_score + ' von 100');
      if (a.macro_score != null) L.push('- Makrolage: ' + a.macro_score + ' von 100');

      /* ══ v2157 · DIE LAGE, ZWEIMAL ERHOBEN (N62.4) ═════════════════════

         Marcel am 12.10.2026: „Und wir haben ja auch im Objekt ...
         Wertsteigerungspotenzial, Nachfrageindikatoren,
         Bevoelkerungsentwicklung, Entwicklungsmoeglichkeiten. Also dass
         wir da wirklich die Daten halt auch abfragen und verwerten und das
         auch gegenueberstellen."

         GEMESSEN an Bericht 176 (Huellhorst): der Bericht leitet die Lage
         aus Messdaten ab (lage_bericht) und fuehrt daneben die Angaben des
         Nutzers (lage_nutzer). Sie weichen in vier von fuenf Punkten ab —
         Mikrolage begrenzt gegen durchschnittlich, Nachfrage hoch gegen
         mittel, Wertsteigerung hoch gegen mittel, Entwicklung steigend
         gegen begrenzt. Keine der beiden Seiten kam bisher hier an.

         Der Zensus wird mitgegeben, WENN er da ist, und sonst ausdruecklich
         als fehlend benannt: am 12.10.2026 trugen 0 von 162 Berichten auf
         Staging Zensus-Werte (die Kreisdatei ist leer). Ohne diesen Satz
         fuellt das Modell die Luecke mit einer recherchierten Leerstands-
         quote und stellt sie neben gemessene Zahlen. */
      var _lb = (a.lage_bericht && typeof a.lage_bericht === 'object') ? a.lage_bericht : null;
      var _ln = (a.lage_nutzer && typeof a.lage_nutzer === 'object') ? a.lage_nutzer : null;
      if (_lb || _ln) {
        var _lz = [
          ['Makrolage', 'makrolage'], ['Mikrolage', 'mikrolage'],
          ['Bevoelkerungsentwicklung', 'bevoelkerung'], ['Nachfrage', 'nachfrage'],
          ['Wertsteigerung', 'wertsteigerung'], ['Entwicklung', 'entwicklung'],
          ['Mietentwicklung', 'mietentwicklung']
        ].map(function (r) {
          var vb = _lb && _lb[r[1]] != null ? String(_lb[r[1]]) : null;
          var vn = _ln && _ln[r[1]] != null ? String(_ln[r[1]]) : null;
          if (vb == null && vn == null) return null;
          var abw = (vb != null && vn != null && vb.toLowerCase() !== vn.toLowerCase());
          return '  ' + r[0] + ': Bericht ' + (vb || '–') + ' | Objektfeld ' + (vn || '–')
               + (abw ? '  <- WEICHT AB' : '');
        }).filter(Boolean);
        if (_lz.length) {
          L.push('- LAGE ZWEIMAL ERHOBEN (Bericht = aus Messdaten abgeleitet, Objektfeld = Angabe des Investors):');
          _lz.forEach(function (z) { L.push(z); });
        }
      }
      if (a.bevoelkerung_trend_pct != null && isFinite(Number(a.bevoelkerung_trend_pct)))
        L.push('- Bevoelkerungstrend des Kreises (gemessen): '
          + (Number(a.bevoelkerung_trend_pct) >= 0 ? '+' : '')
          + Number(a.bevoelkerung_trend_pct).toFixed(2).replace('.', ',') + ' % pro Jahr');
      var _zs = (a.zensus && typeof a.zensus === 'object') ? a.zensus : null;
      if (_zs && _zs.available) {
        var _zt = [];
        if (_zs.leerstandsquote != null) _zt.push('Leerstandsquote ' + String(_zs.leerstandsquote).replace('.', ',') + ' %');
        if (_zs.eigentuemerquote != null) _zt.push('Eigentuemerquote ' + String(_zs.eigentuemerquote).replace('.', ',') + ' %');
        if (_zs.nettokaltmiete_qm != null) _zt.push('Nettokaltmiete ' + String(_zs.nettokaltmiete_qm).replace('.', ',') + ' EUR/m2');
        if (_zs.jung_18_30 != null) _zt.push('Anteil 18-30 Jahre ' + String(_zs.jung_18_30).replace('.', ',') + ' %');
        L.push('- ZENSUS 2022 (amtlich, Stichtag 15.05.2022, KREIS' + (_zs.kreis_name ? ' ' + _zs.kreis_name : '') + '): '
          + (_zt.length ? _zt.join(', ') : 'keine Kennzahl'));
        /* v2162 · Gemeinde und die Werte passend zu Baujahr und Groesse
           (mb.zensus_werte). Die Miete ist BESTANDSMIETE aller Vertraege -
           das Modell darf sie nicht als Markt- oder Angebotsmiete ausgeben. */
        var _zf = function (n, d) { return n == null ? null : Number(n).toFixed(d).replace('.', ','); };
        var _zg = _zs.gemeinde, _zk = _zs.kreis;
        if (_zg) {
          var _gt = [];
          if (_zg.nettokaltmiete_qm != null) _gt.push('Nettokaltmiete ' + _zf(_zg.nettokaltmiete_qm, 2) + ' EUR/m2');
          if (_zg.leerstandsquote != null) _gt.push('Leerstandsquote ' + _zf(_zg.leerstandsquote, 1) + ' %');
          if (_zg.leerstandsquote_marktaktiv != null) _gt.push('marktaktiver Leerstand ' + _zf(_zg.leerstandsquote_marktaktiv, 1) + ' %');
          if (_gt.length) L.push('  Gemeinde ' + _zg.name + ': ' + _gt.join(', '));
        }
        [['miete_baujahr', 'Baujahrsklasse'], ['miete_flaeche', 'Groessenklasse']].forEach(function (p) {
          var src = (_zg && _zg[p[0]] && _zg[p[0]].wert != null) ? [_zg[p[0]], 'Gemeinde'] : ((_zk && _zk[p[0]] && _zk[p[0]].wert != null) ? [_zk[p[0]], 'Kreis'] : null);
          if (src) L.push('  Nettokaltmiete ' + p[1] + ' ' + src[0].klasse + ' (' + src[1] + '): ' + _zf(src[0].wert, 2) + ' EUR/m2');
        });
        var _zl = (_zg && _zg.leerstandsdauer) || (_zk && _zk.leerstandsdauer);
        if (_zl && _zl.length) L.push('  Dauer des Leerstands (Anteil der leeren Wohnungen): '
          + _zl.map(function (x) { return x.text + ' ' + _zf(x.anteil_pct, 1) + ' %'; }).join(', '));
        if (_zg || (_zk && (_zk.miete_baujahr || _zk.miete_flaeche)))
          L.push('  Die Zensus-Miete ist die BESTANDSMIETE aller laufenden Vertraege am Stichtag, keine Angebotsmiete;'
            + ' nenne sie als solche. Der Zensus-Leerstand ist keine Mietausfallannahme (Langzeitleerstand zaehlt mit).');
      } else if (_zs) {
        L.push('- ZENSUS 2022: fuer diesen Kreis liegen KEINE Zensus-Werte vor. Nenne keine Zensus-Zahl'
          + ' und schreibe keine recherchierte Leerstands- oder Eigentuemerquote als Zensuswert.');
      }
      /* v2947 (N78.5) · eindeutig benannt: die Rendite des Berichts rechnet ohne Zusatzeinnahmen,
         sein Score ist eine eigene Bewertung - nicht der DealPilot-Score (85 gegen 78 am Westerfeld). */
      if (a.gross_yield_pct != null) L.push('- Bruttomietrendite laut Marktbericht (ohne Zusatzeinnahmen): ' + fmtNum(a.gross_yield_pct, 1).replace('.', ',') + ' %');
      if (a.rent_multiplier != null) L.push('- Kaufpreisfaktor laut Bericht: ' + fmtNum(a.rent_multiplier, 1).replace('.', ','));
      if (a.deal_score != null) L.push('- Score laut Marktbericht (eigene Bewertung des Berichts, NICHT der DealPilot-Score und nicht der Investor Deal Score): ' + a.deal_score);

      /* ══ v2150 · DIE WERTERMITTLUNG STUFE 3 GEHT MIT ═══════════════════

         Marcel am 12.10.2026: „in der Pilot Analyse woher kommen die werte
         und daten im reiter Lage & Markt? wenn wir einen marktbericht haben
         oder mehrere koennen wir die Daten dafuer aus den Marktberichten
         holen da wir diese sachen ja dort ueber die partner abholen." Und:
         „auch wenn Stufe 3 gerechnet wurde sollte auf jedenfall auch der
         Verkehrswert mit einfliessen und die Gesamtbewertung einfliessen."

         GEMESSEN am 12.10.2026: `/objects/history` liefert seit v1963 den
         Sachwert und den Ertragswert und seit v1965 das FUEHRENDE
         Verfahren mit Grund und Quelle (Paragraf 6 Abs. 1 ImmoWertV). Der
         Block hier las davon KEIN EINZIGES FELD — er endete beim
         Deal-Score. Die Zahlen lagen in `a` und wurden nie gelesen.

         Dasselbe Muster wie v1963 selbst: dort lag der Cross-Check in der
         Datenbankzeile und hat den Server nie verlassen. Hier verlaesst er
         den Server und erreicht den Prompt nicht.

         ── WARUM DAS WORT „VERKEHRSWERT" HIER NICHT FAELLT ───────────────

         Marcels Auftrag ist, dass der Wert EINFLIESST — nicht, dass er
         umbenannt wird. Die Doktrin steht im Bericht selbst
         (`CrossCheckService.js:121`): „Vereinfachtes Sachwert-/Ertrags-
         wertverfahren nach ImmoWertV-Logik als Plausibilitaets-Quercheck.
         Indikativ, kein Gutachten n. Paragraf 194 BauGB."

         > Beides gilt gleichzeitig: die Zahl gehoert in die Analyse, UND
         > sie darf nicht als Verkehrswert etikettiert werden. Deshalb
         > bekommt die KI den Wert, das Verfahren, den Grund — und den
         > Satz, was sie damit nicht tun darf. Ein Wert ohne seine
         > Einordnung ist in diesem Fall schlimmer als keiner. */
      var _sw = a.sachwert_eur != null ? Number(a.sachwert_eur) : null;
      var _ew = a.ertragswert_eur != null ? Number(a.ertragswert_eur) : null;
      if (_sw != null || _ew != null || a.fuehrend) {
        L.push('');
        L.push('## WERTERMITTLUNG IM BERICHT (Stufe 3, ImmoWertV-Logik)');
        if (_sw != null) L.push('- Sachwert: ' + fmtEur(_sw));
        if (_ew != null) L.push('- Ertragswert: ' + fmtEur(_ew));
        if (_sw != null && _ew != null && _sw > 0) {
          var _spr = ((_ew - _sw) / _sw) * 100;
          L.push('- Abstand Ertrags- zu Sachwert: ' + (_spr >= 0 ? '+' : '')
            + _spr.toFixed(1).replace('.', ',') + ' %');
          if (Math.abs(_spr) > 25) {
            L.push('  ACHTUNG: Die beiden Verfahren liegen WEIT auseinander. Das ist');
            L.push('  ein Befund und gehoert genannt: entweder traegt die Substanz den');
            L.push('  Preis nicht (Ertragswert hoeher) oder die Miete traegt die');
            L.push('  Substanz nicht (Sachwert hoeher). Sage, welcher Fall vorliegt.');
          }
        }
        var _vn = { sachwert: 'Sachwertverfahren', ertragswert: 'Ertragswertverfahren',
                    vergleichswert: 'Vergleichswertverfahren' }[a.fuehrend] || null;
        if (_vn) {
          L.push('- FUEHRENDES VERFAHREN: ' + _vn
            + (a.fuehrend_grund ? ' — ' + a.fuehrend_grund : ''));
          if (a.fuehrend_quelle) L.push('  Rechtsgrundlage: ' + a.fuehrend_quelle);
          var _tragend = a.fuehrend === 'sachwert' ? _sw
                       : a.fuehrend === 'ertragswert' ? _ew : null;
          if (_tragend != null) {
            L.push('- Der TRAGENDE Wert ist damit ' + fmtEur(_tragend)
              + ' (' + _vn + ').');
            L.push('  Nutze ihn als Anker fuer die Einordnung des Kaufpreises und');
            L.push('  sage ausdruecklich, aus welchem Verfahren er kommt und warum');
            L.push('  dieses Verfahren fuehrt.');
          }
        } else if (a.fuehrend_grund) {
          L.push('- KEIN fuehrendes Verfahren ausgewiesen: ' + a.fuehrend_grund);
        }
        /* ══ v2156 · DER ZINS GEHOERT ZUM ERTRAGSWERT ════════════════════

           Marcel am 12.10.2026: „auch Finanzierung und Liegenschaftszinsen
           und Wertgutachten, dass auch wirklich alles damit einfliesst."

           GEMESSEN: der Ertragswert stand hier ohne den Liegenschaftszins,
           der ihn erzeugt. Das Objektfeld `lzs_pct` aus dem Formular steht
           400 Zeilen weiter oben im Block „BODEN UND SUBSTANZ" — als
           nackte Zahl, ohne Auftrag. Zwei Zahlen zur selben Groesse, ohne
           Beruehrung, und das Modell musste raten, welche gilt.

           > Ein Ertragswert ohne seinen Zinssatz ist nicht pruefbar. Der
           > Zins ist die Groesse, an der die ganze Rechnung haengt: ein
           > Prozentpunkt mehr senkt den Ertragswert um gut ein Fuenftel.

           Die HERKUNFT steht dabei (Stufe A-E, Zweig, Jahrgang, aus dem
           Register oder nicht). Ein amtlicher Satz des Gutachterausschusses
           und ein Rueckfall sind nicht dasselbe — und die Analyse muss das
           sagen koennen, statt beides „Liegenschaftszins" zu nennen. */
        if (a.lzs_pct != null) {
          var _lz = Number(a.lzs_pct);
          var _lzh = [];
          if (a.lzs_stufe) _lzh.push('Stufe ' + a.lzs_stufe);
          if (a.lzs_zweig) _lzh.push(String(a.lzs_zweig));
          if (a.lzs_berichtsjahr) _lzh.push('Jahrgang ' + a.lzs_berichtsjahr);
          _lzh.push(a.lzs_aus_register ? 'aus dem amtlichen Register'
                                       : 'NICHT aus dem Register — Rueckfallwert');
          L.push('- Liegenschaftszinssatz der Rechnung: '
            + fmtNum(_lz, 2).replace('.', ',') + ' %  (' + _lzh.join(' · ') + ')');
          if (!a.lzs_aus_register) {
            L.push('  ACHTUNG: Dieser Zinssatz kommt NICHT vom Gutachterausschuss.');
            L.push('  Der Ertragswert darueber ist damit eine Rechnung mit einer');
            L.push('  Annahme, nicht mit einem amtlichen Modellwert. Sage das dazu,');
            L.push('  wenn du den Ertragswert verwendest.');
          }
          /* Weicht der Zins des Berichts von dem im Formular ab, ist das
             ein Befund — keine Kleinigkeit: beide Zahlen heissen gleich. */
          /* `_bo` ist der Boden-Block (Z. 117), nicht `mb` — das ist die
             Marktbewertung. Mein erster Zugriff hiess `mb.liegenschafts-
             zins_pct` und waere immer undefined gewesen: eine Abweichung,
             die nie gemeldet wird, sieht wie Uebereinstimmung aus. */
          if (_bo && _bo.liegenschaftszins_pct != null) {
            var _lzf = Number(_bo.liegenschaftszins_pct);
            if (isFinite(_lzf) && _lzf > 0 && Math.abs(_lzf - _lz) >= 0.05) {
              L.push('  ABWEICHUNG: im Objekt ist ' + fmtNum(_lzf, 2).replace('.', ',')
                + ' % hinterlegt, der Bericht rechnet mit '
                + fmtNum(_lz, 2).replace('.', ',') + ' %.');
              L.push('  Nenne BEIDE und sage, welcher woher kommt. Der Bericht rechnet');
              L.push('  mit seinem eigenen; der hinterlegte Wert ist ein Formularfeld.');
            }
          }
        }
        if (a.gnd_jahre != null) {
          L.push('- Gesamtnutzungsdauer der Rechnung: ' + Math.round(Number(a.gnd_jahre)) + ' Jahre');
        }
        if (a.bwk_quote != null) {
          L.push('- Bewirtschaftungskostenquote der Rechnung: '
            + fmtNum(Number(a.bwk_quote) * 100, 1).replace('.', ',') + ' % des Rohertrags');
        }
        L.push('- EINORDNUNG, die mitgesagt werden MUSS: diese Werte sind ein');
        L.push('  vereinfachter Plausibilitaets-Quercheck nach ImmoWertV-Logik,');
        L.push('  INDIKATIV und KEIN Gutachten nach Paragraf 194 BauGB. Nenne sie');
        L.push('  nie als "Verkehrswert" und nie als Gutachtenergebnis.');

        /* Entwicklung: nur wenn mehr als ein Bericht die Werte traegt. */
        var _vs = (mbr.verlauf || []).filter(function (x) { return x.sachwert != null || x.ertragswert != null; });
        if (_vs.length > 1) {
          L.push('- Entwicklung der Verfahrenswerte ueber ' + _vs.length + ' Berichte:');
          _vs.forEach(function (x) {
            L.push('  • ' + new Date(x.datum).toLocaleDateString('de-DE') + ': '
              + (x.sachwert != null ? 'Sachwert ' + fmtEur(x.sachwert) : 'Sachwert —')
              + ' · ' + (x.ertragswert != null ? 'Ertragswert ' + fmtEur(x.ertragswert) : 'Ertragswert —')
              + (x.fuehrend ? ' · fuehrend: ' + x.fuehrend : ''));
          });
          L.push('  Der Zeitabstand-Riegel von oben gilt hier genauso: unter 30 Tagen');
          L.push('  kommt eine Differenz aus geaenderten EINGABEN, nicht aus dem Markt.');
        }
      }

      /* ---- Verlauf: NUR wenn er etwas bedeutet ---------------------------- */
      var v = (mbr.verlauf || []).filter(function (x) { return x.marktwert != null; });
      if (v.length > 1) {
        L.push('- Verlauf der Marktwert-Indikation:');
        v.forEach(function (x) {
          L.push('  • ' + new Date(x.datum).toLocaleString('de-DE') + ': ' + fmtEur(x.marktwert));
        });
        var erst = v[0], letzt = v[v.length - 1];
        var tage = (new Date(letzt.datum) - new Date(erst.datum)) / 86400000;
        var dPct = erst.marktwert > 0 ? ((letzt.marktwert - erst.marktwert) / erst.marktwert) * 100 : 0;
        L.push('- Differenz erster zu letzter Bericht: ' + (dPct >= 0 ? '+' : '') + dPct.toFixed(1).replace('.', ',') +
               ' % ueber ' + (tage < 1 ? 'weniger als einen Tag' : Math.round(tage) + ' Tage'));
        if (tage < 30) {
          L.push('  WICHTIG: Der zeitliche Abstand ist ZU KURZ fuer eine Marktaussage.');
          L.push('  Diese Differenz kommt aus GEAENDERTEN EINGABEN, nicht aus dem Markt.');
          L.push('  Nenne sie als solche und deute sie AUF KEINEN FALL als Wertentwicklung');
          L.push('  oder Trend. Eine belastbare Wertentwicklung braucht Berichte ueber Monate.');
        } else {
          L.push('  Der Abstand traegt eine Aussage: gehe auf die Richtung ein und ordne sie ein.');
        }
      } else {
        L.push('- Nur ein Bericht vorhanden -> KEINE Aussage zur Wertentwicklung moeglich.');
        L.push('  Empfiehl, in einigen Monaten einen zweiten Bericht zu erstellen.');
      }

      /* ---- Mietabweichung: die eigentliche Aussage ------------------------ */
      var marktM = null;
      try { marktM = (a.data && a.data.rent && a.data.rent.median_sqm) || null; } catch (e) {}
      if (marktM == null && mb.marktmiete_qm != null) marktM = Number(mb.marktmiete_qm);
      var wfl = Number(o.wfl || (a.living_area != null ? a.living_area : 0)) || null;
      /* nkm_j ist die JAHRES-Nettokaltmeite (calc.js State.kpis) -> /12 fuer den
       * Monatsvergleich. NICHT k.bmy/k.nmy nehmen: das sind Renditen in Prozent. */
      var istKalt = (k.nkm_j != null && Number(k.nkm_j) > 0) ? Number(k.nkm_j) / 12 : null;
      if (marktM && wfl && istKalt) {
        var istQm = istKalt / wfl;
        var abw = ((istQm - marktM) / marktM) * 100;
        L.push('');
        L.push('## MIETNIVEAU — GERECHNET, NICHT GESCHAETZT');
        L.push('- Marktmiete laut Bericht: ' + fmtNum(marktM, 2).replace('.', ',') + ' €/m²');
        L.push('- Ist-Kaltmiete: ' + fmtEur(istKalt) + '/Monat auf ' + Math.round(wfl) + ' m² = ' + fmtNum(istQm, 2).replace('.', ',') + ' €/m²');
        L.push('- Abweichung: ' + (abw >= 0 ? '+' : '') + abw.toFixed(1).replace('.', ',') + ' %');
        if (abw < -8) {
          L.push('- BEWERTUNG: Die Ist-Miete liegt UNTER Marktniveau. Das ist ein ECHTER HEBEL:');
          L.push('  Mietsteigerungspotenzial bei Neuvermietung oder Anpassung im Bestand.');
          L.push('  Beziffere es (Marktmiete × Flaeche gegen Ist), nenne die rechtlichen Grenzen');
          L.push('  (Kappungsgrenze, Mietspiegel, Mieterhoehung nur in Schritten) und ordne ein,');
          L.push('  wie schnell es realisierbar ist. Das gehoert in die Chancen.');
        } else if (abw > 15) {
          L.push('- BEWERTUNG: Die Ist-Miete liegt DEUTLICH UEBER Marktniveau. Zwei Lesarten,');
          L.push('  und du musst beide nennen:');
          L.push('  (a) Ein Sondereffekt erklaert es — moebliert, gewerblich, Kurzzeitvermietung.');
          L.push('      Dann ist die Rendite echt, aber sie haengt an diesem Modell.');
          L.push('  (b) Es ist ein Eingabefehler oder eine nicht haltbare Miete.');
          L.push('  In beiden Faellen gilt: bei Neuvermietung faellt die Miete auf Marktniveau.');
          L.push('  Es gibt KEIN Mietsteigerungspotenzial mehr — im Gegenteil, das ist ein RISIKO.');
          L.push('  Rechne vor, was mit dem Cashflow passiert, wenn auf ' + fmtNum(marktM, 2).replace('.', ',') + ' €/m² neu vermietet wird.');
          L.push('  Das gehoert in die Risiken, NICHT in die Chancen.');
        } else {
          L.push('- BEWERTUNG: Die Ist-Miete liegt auf Marktniveau. Kein nennenswerter Hebel');
          L.push('  ueber die Miete, aber auch kein Rueckschlagrisiko bei Neuvermietung.');
        }
      }

      L.push('');
      L.push('## QUELLENPFLICHT');
      L.push('- Sage bei JEDER Zahl aus diesem Block dazu, dass sie aus dem DealPilot-Marktbericht');
      L.push('  vom ' + new Date(a.created_at).toLocaleDateString('de-DE') + ' stammt. Der Leser muss unterscheiden koennen,');
      L.push('  was GEMESSEN ist und was du eingeordnet hast.');
      L.push('- Sachwert und Ertragswert im Bericht sind ein PLAUSIBILITAETS-QUERCHECK,');
      L.push('  kein Wertansatz. Nie als Verkehrswert darstellen.');
      L.push('- Der Bericht ist eine Marktpreisindikation, KEIN Gutachten n. § 194 BauGB.');
      L.push('');
      return L;
    })() : ['## DEALPILOT-MARKTBERICHT', '- Kein Marktbericht zu diesem Objekt vorhanden.',
            '- Empfiehl im Fazit, einen zu erstellen (Tab Bewertung) — die Analyse steht sonst',
            '  auf den Eingaben allein, ohne Vergleichsdaten.', '']),

    '## MARKTBEWERTUNG (falls hinterlegt — vorrangig vor Schätzungen nutzen)',
    mb.marktwert ? '- Hinterlegter Marktwert: ' + fmtEur(mb.marktwert) : '- Keine eigene Marktbewertung hinterlegt.',
    mb.marktmiete_qm ? '- Hinterlegte Marktmiete: ' + fmtNum(mb.marktmiete_qm, 2) + ' €/m²' : '',
    mr.length ? ('- Marktpreisindikationen (mehrere Anbieter):\n' + mr.map(function (x) {
      var parts = [];
      if (x.marktwert != null) parts.push('Marktwert ' + fmtEur(x.marktwert));
      if (x.low != null || x.high != null) parts.push('Spanne ' + fmtEur(x.low) + ' bis ' + fmtEur(x.high));
      if (x.konfidenz != null) parts.push('Konfidenz ' + x.konfidenz);
      return '  • ' + (x.provider || 'Anbieter') + ': ' + parts.join(', ');
    }).join('\n')) : '',
    (mr.length > 1) ? '- Es liegen MEHRERE Marktpreisindikationen vor — gehe auf ALLE ein, vergleiche sie, nenne jeweils Spanne und (falls vorhanden) Konfidenz und qualifiziere die Aussage. Es sind Marktpreisindikationen, KEIN Verkehrswert.' : '',
    '- Wenn ein Marktwert hinterlegt ist, nutze ihn als VORRANGIGEN Vergleichsanker',
    '  für Kaufpreis-Einordnung, Offerte und Bewertung — vor allgemeinen Annahmen.',
    /* v947-mbsource: Rangfolge klarstellen. Der hinterlegte Marktwert ist ein
     * Formularfeld — der Marktbericht sind 822 gemessene Vergleichspreise. */
    mbr ? '- ACHTUNG RANGFOLGE: Liegt ein DealPilot-Marktbericht vor (Block oben), schlaegt dieser den hier hinterlegten Marktwert. Der hinterlegte Wert ist ein Formularfeld, der Bericht sind gemessene Vergleichsdaten. Weichen sie ab, nenne beide und sage, welcher woher kommt.' : '',
    '- Wenn Web-Recherche aktiv ist: leite Kaufpreisniveau und Mietspiegel aus den',
    '  recherchierten Quellen ab — qualifiziert mit Spanne/Konfidenz statt vager',
    '  Allgemeinplätze.',
    '',
    '## RECHERCHE-AUFTRAG',
    'Recherchiere im Web zu folgenden Punkten und nimm die Erkenntnisse in deine Analyse auf:',
    '1. Makrolage in ' + (o.ort || 'der Region') + ' (Wirtschaft, Demografie, Arbeitsmarkt)',
    '2. Mikrolage PLZ ' + (o.plz || '?') + ' (Stadtteil-Reputation, Infrastruktur)',
    '3. Lokaler Mietspiegel (€/m² Bestand vs. Neubau)',
    '4. Kaufpreisniveau für vergleichbare Objekte in der Region',
    /* ══ v2150 · DER RECHERCHE-AUFTRAG MUSS DEN BERICHT KENNEN ══════════
       Marcel: „wenn wir einen marktbericht haben oder mehrere koennen wir
       die Daten dafuer aus den Marktberichten holen da wir diese sachen ja
       dort ueber die partner abholen."
       Punkte 3 und 4 standen UNBEDINGT da. Liegt ein Bericht vor, ist eine
       Web-Recherche zum Mietniveau nicht nur unnoetig, sondern schaedlich:
       sie stellt eine geschaetzte Zahl neben eine gemessene. */
    mbr ? 'WICHTIG zu 3 und 4: zu diesem Objekt LIEGT EIN MARKTBERICHT VOR (Block oben). '
        + 'Seine Marktmiete und seine Vergleichswerte sind GEMESSEN — sie gelten, nicht deine '
        + 'Recherche. Recherchiere zu 3 und 4 nur ERGAENZEND (z.B. Neubaumiete, wenn der Bericht '
        + 'nur Bestand fuehrt) und sage bei jeder Zahl, ob sie aus dem Bericht oder aus deiner '
        + 'Recherche kommt. Stelle NIE eine recherchierte Zahl ohne Hinweis neben eine gemessene.'
        : '',
    '',
    '## AUFGABEN',
    '',
    '1. Gesamtbewertung (8-10 Sätze) → Ist das ein guter Deal oder nicht? Warum? Mit konkreten Zahlen.',
    '',
    '2. Stärken & Schwächen Analyse',
    '   → Nenne die 5 wichtigsten Stärken — jede 3-4 Sätze mit konkreter Zahl/Begründung',
    '   → Nenne die 5 größten Risiken — jedes 3-4 Sätze mit Zahl und Folge',
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
    '   → jeweils 3-5 Sätze Begründung mit Bezug auf Zahlen',
    /* v2140: die Aufgabe nannte bis hierher drei Archetypen und KEINE
       Eingabe - die Schwellen dieses Nutzers erreichten den Prompt
       nicht. Jetzt tun sie es, und die Aufgabe sagt, wo sie stehen. */
    (payload.investor_profil
      ? '   → UND KONKRET: der Abschnitt "DIESER INVESTOR" nennt seine eigenen'
        + ' Schwellen.\n     Pruefe sie einzeln ab (gehalten / verfehlt, je mit'
        + ' beiden Zahlen) und sage zum\n     Schluss, ob der Deal zu DIESEM'
        + ' Investor passt - nicht nur zu einem Archetyp.'
      : '   → Ein persoenliches Investmentprofil liegt nicht vor. Urteile nach den'
        + '\n     DealPilot-Schwellen und sage, dass du das tust.'),
    '',
    '6. Klare Empfehlung — "Kaufen", "Prüfen", oder "Nicht kaufen" mit ausführlicher Begründung',
    '',
    '7. DealPilot Insight',
    '   → Professionelle Einschätzung wie von einem Investment-Tool',
    '   → 6-8 Sätze, fundiert und konkret',
    '',
    '8. Investmentbewertung — eine umfassende holistische Bewertung des Deals (12-16 Sätze).',
    '   Soll Rendite, Lage, Marktumfeld, Risiko und langfristige Perspektive verbinden.',
    '   Gehe dabei auch auf die Steuererstattung/den Steuervorteil ein: was sie bringt und wie',
    '   sie sich auf das zu versteuernde Einkommen auswirkt (Bezug AfA und Werbungskosten),',
    '   qualitativ und mit Zahlen soweit aus den Eingabedaten ableitbar.',
    '',
    '9. Verhandlungsempfehlung — konkrete Verhandlungsstrategie (12-16 Sätze).',
    '   Welche Argumente, welche Hebel, welcher Zielpreis, welche Kompromisse?',
    '',
    '10. Kaufpreis-Offerte — empfohlener Kaufpreis mit ausführlicher Begründung (5-7 Sätze)',
    '   plus 4-6 konkrete Argumente für die Verhandlung.',
    '',
    '11. Bankargumente — 5-7 ausführliche, fundierte Argumente zur Vorlage bei der Bank.',
    '   Jedes Argument 2-3 Sätze mit konkreten Zahlen aus dem Deal.',
    '',
    '12. Offerte-Anschreiben — ein höfliches, wertschätzendes Schreiben an Makler/',
    '   Verkäufer, das die Situation mit allen Vor- und Nachteilen respektvoll',
    '   darstellt und die Preisvorstellung herleitet (Feld "offerte_mail").',
    '',
    '## OFFERTE-LEITLINIEN (verbindlich)',
    '- In Kaufpreis-Offerte UND offerte_mail NICHT mit LTV/Beleihungsauslauf argumentieren',
    '  (interne Finanzierungskennzahl des Kaeufers, KEIN Verhandlungsargument).',
    '- Argumentiere mit: den vorliegenden Marktbewertungen (OHNE Anbieter, Portale oder',
    '  Datenquellen beim Namen zu nennen — schreibe „aktuelle Marktdaten“ bzw.',
    '  „Marktdurchschnitt“), Objektzustand (z.B. Modernisierungsbedarf),',
    '  Lage/Markt und den eigenen Kennzahlen des Deals. Nenne Vorteile UND Nachteile.',
    /* v2264 · Marcel 15.10.2026, gemessen an gespeicherten Analysen: Westerfeldstr.
       empfahl 910.000 EUR bei 545.000 EUR Kaufpreis, Alexanderstr. 140.000 bei
       129.000. Eine Kaufpreis-Offerte ueber dem Angebotspreis ist keine Verhandlung. */
    '- Die empfohlene Offerte liegt NIE über dem Kaufpreis (Angebotspreis) des Objekts.',
    '  Ist das Objekt deutlich mehr wert, ist das ein Argument, ZÜGIG zum Angebotspreis',
    '  oder knapp darunter zu kaufen — die Offerte bleibt höchstens beim Kaufpreis.',
    '- Formatiere die offerte_mail wie einen echten Brief: Anrede in eigener Zeile, dann',
    '  2-3 inhaltliche Absaetze (durch Leerzeile getrennt), dann Grussformel und Name in',
    '  eigenen Zeilen. Nutze echte Zeilenumbrueche, KEIN durchgehender Fliesstext-Block.',
    '',
    '13. Anschlussfinanzierung — betrachte die Phase nach der Zinsbindung: schaetze die',
    '   voraussichtliche Restschuld am Ende der Zinsbindung, ordne das Anschlussrisiko ein',
    '   und gib an, welcher Eigenkapital-Einsatz oder welche Sondertilgung die',
    '   Anschlussfinanzierung tragfaehig macht. Konkret mit Zahlen, soweit ableitbar.',
    '   Betrachte dabei die Wertsteigerung: der voraussichtliche Objektwert am Ende der',
    '   Zinsbindung senkt den effektiven Beleihungsauslauf der Anschlussfinanzierung; stelle',
    '   die Restschuld dem gestiegenen Wert gegenueber. Sage KLAR, ob sich das Investment auch',
    '   im Anschluss traegt (Bezug Cashflow, Ziel etwa +/- 0). Wird es eng, empfiehl konkret',
    '   entweder Eigenkapital-Einsatz/Sondertilgung (mit Hausnummer) ODER eine guenstigere',
    '   Anschlusskondition (Zielzins), damit der Cashflow nicht negativ wird.',
    '',
    /* ══ v2150 · AUFGABE 14 — DER ABGLEICH GEGEN DIE SCHNITTSTELLE ══════
       Marcel: „man kann die werte der KI gerne mit den daten aus der
       schnittstelle abgleichen auch wenn Stufe 3 gerechnet wurde sollte
       auf jedenfall auch der Verkehrswert mit einfliessen und die
       Gesamtbewertung einfliessen."

       Die Aufgabe steht nur, wenn ein Bericht da ist — ein Auftrag, der
       auf nichts zeigt, erzeugt eine erfundene Antwort. Das Zielfeld
       `berichts_abgleich` steht im Antwortformat weiter unten; ohne
       Zielfeld faellt die Arbeit lautlos auf den Boden. */
    mbr ? '14. Abgleich mit dem Marktbericht — stelle deine Einordnung NEBEN seine\n'
        + '   gemessenen Werte: Marktwert und Spanne, Marktmiete, Sach- und Ertragswert,\n'
        + '   das fuehrende Verfahren. Wo ihr uebereinstimmt, sage es kurz. Wo nicht,\n'
        + '   nenne BEIDE Zahlen und sage, welche woher kommt — der Bericht ist gemessen,\n'
        + '   deine Einordnung ist eine Einschaetzung. Nutze den tragenden Wert des\n'
        + '   fuehrenden Verfahrens als Anker fuer den Kaufpreis und nenne das Verfahren\n'
        + '   dabei. Die Sach- und Ertragswerte sind INDIKATIV und kein Gutachten nach\n'
        + '   Paragraf 194 BauGB — schreibe sie nie als "Verkehrswert".\n'
        + '   Gehoert nach "berichts_abgleich".'
        : '',
    /* ══ v2157 · AUFGABE 15 — DIE LAGE GEGENUEBERSTELLEN (N62.4) ════════
       Marcel: „Makrolage, Mikrolage, Mietspiegel, Preisniveau aus dem
       Netz beziehen, aber auch mit Quellen ... und das auch
       gegenueberstellen nochmal mit dem Mietspiegel oder der Recherche
       aus dem Netz."
       Die Aufgabe steht IMMER: auch ohne Bericht gibt es zwei Seiten —
       das Objektfeld und die Recherche. Die Quelle steht je ZEILE, nicht
       nur im Sammel-Array: eine Zahl ohne ihre Quelle daneben ist im
       Reiter nicht nachpruefbar. */
    '15. Lage-Gegenueberstellung — eine Zeile je Merkmal: Makrolage, Mikrolage,',
    '   Bevoelkerungsentwicklung, Nachfrage, Wertsteigerung, Entwicklung,',
    '   Mietniveau, Kaufpreisniveau. Je Zeile drei Spalten: was das OBJEKTFELD',
    '   sagt (Angabe des Investors), was der MARKTBERICHT sagt (nur wenn oben',
    '   ein Bericht steht, sonst null) und was deine RECHERCHE ergibt — mit',
    '   der URL der Quelle in derselben Zeile. Keine Quelle gefunden: null,',
    '   nicht schaetzen. Dann ein Urteil: "stimmt", "weicht ab" oder "offen"',
    '   (wenn eine Seite fehlt), und 1-2 Saetze, was die Abweichung fuer die',
    '   Investition bedeutet. Wo das Objektfeld vom Bericht abweicht, sage',
    '   deutlich, dass die Angabe des Investors nicht gemessen ist.',
    '   Gehoert nach "lage_gegenueberstellung".',
    /* v2160 · N62.6 — die steuerliche Zusammenfassung. Marcel: „bei der
       Pilotanalyse natuerlich auch eine steuerliche Zusammenfassung machen.
       Das soll natuerlich auch mit in den Soll-Ist-Abgleich einfliessen."
       Bis hier stand die Steuer nur als Nebensatz in Aufgabe 8 - ohne
       eigenes Feld (Lehre v2013b: ohne Zielfeld kein Text). */
    '',
    '16. Steuerliche Zusammenfassung — was die Investition steuerlich bewirkt, NUR aus',
    /* v2166: gegliedert - Marcel: „auf Werbungskosten eingehen und wann das Objekt
       steuerlich positiv wird und was das an Abgaben bedeutet." Die Zahlen stehen
       oben fertig (STEUER: WERBUNGSKOSTEN / WANN POSITIV / JAHRESVERLAUF). */
    '   Gliederung, in dieser Reihenfolge: (1) Werbungskosten Jahr 1 nach Art mit EUR -',
    '   Schuldzinsen, AfA, Bewirtschaftung - und ihr Verhaeltnis zur Miete; (2) Ergebnis aus',
    '   Vermietung und Steuerwirkung im ersten Jahr; (3) in welchem Jahr das Ergebnis positiv',
    '   wird und WARUM (Zinsanteil sinkt, Miete steigt, AfA bleibt) - mit den Zahlen dieses',
    '   Jahres; (4) was danach an Steuer anfaellt, je Jahr und kumuliert bis Jahr 15, und wie',
    '   das den Cashflow nach Steuer veraendert; (5) Sanierung: wie sie steuerlich wirkt (falls',
    '   angegeben); (6) Hinweis auf den Steuerberater. Zahlen NUR aus den Steuer-Bloecken oben.',
    '   dem Block STEUER und den Kennzahlen (Steuerwirkung p.a., Cashflow vor/nach Steuer).',
    '   Nenne: AfA-Basis und -Satz bzw. Restnutzungsdauer, ob Sanierung als',
    '   Erhaltungsaufwand verteilt wird, die Steuerwirkung im ersten Jahr in EUR und',
    '   was sie fuer den Cashflow nach Steuer heisst. Fehlt eine Angabe (z. B. kein',
    '   Grenzsteuersatz), sage das und rechne NICHT mit einem angenommenen Satz.',
    /* v2164a - gemessen am ersten echten Lauf (2026-1052): „2 % ueber eine
       Restnutzungsdauer von 80 Jahren". Eingetragen war nur der Satz; die
       80 stammt aus der Gesamtnutzungsdauer des Marktberichts. */
    '   Die AfA-Dauer ergibt sich aus dem Satz (2 % = 50 Jahre, 2,5 % = 40, 3 % = 33). Eine',
    '   Restnutzungsdauer nennst du NUR, wenn oben "AfA ueber Restnutzungsdauer" steht;',
    '   die Gesamtnutzungsdauer des Marktberichts ist KEINE AfA-Dauer.',
    '   Keine Steuerberatung: schliesse mit dem Hinweis, dass ein Steuerberater die',
    '   Einordnung bestaetigen sollte. Gehoert nach "steuer_zusammenfassung".',
    (_ak ? '   Liegt oben ein ANKAUF-STAND vor: vergleiche zusaetzlich die steuerliche Lage\n'
      + '   beim Ankauf mit heute (Zeile "Steuerwirkung p. a." und Cashflow n. Steuer der\n'
      + '   Abweichungstabelle) und erklaere die Bewegung. Gehoert nach "soll_ist_steuer".' : ''),
    (_pz ? '17. Potenzial (Mieterhoehung und Zielbild) - liegt oben der Block MIETERHOEHUNG UND ZIELBILD vor:\n'
      + '   4-7 Saetze: was ohne Mieterwechsel erreichbar ist und ab wann, was das Zielbild mit welchen\n'
      + '   Massnahmen und Kosten bringt, die Ertragswerte je Stufe und der Wertzuwachs nach Kosten,\n'
      + '   bei Aufteilung deren Wirkung (auch wenn sie negativ ist). Die schnellsten Hebel zuerst.\n'
      + '   Nenne es ausdruecklich einen Ausblick (unterstellt, dass die hoehere Miete erzielt bzw. die Massnahmen umgesetzt sind), keinen Verkehrswert zum heutigen Stichtag; Score und\n'
      + '   Verkehrswert bleiben beim Bestand. Zahlen NUR aus dem Block. Gehoert nach "potenzial_text".' : ''),
    '## STIL',
    '- Klar, professionell, wie ein ausführlicher Investment-Report',
    '- Mit Zahlen aus dem Deal arbeiten — konkret werden',
    '- Wo immer möglich Bezüge zur Lage-Recherche herstellen',
    '- KEINE Markdown-Sterne (**fett** vermeiden), KEINE Listen-Bullets mit *',
    '- AUSFÜHRLICH schreiben — Marcel will fundierte Texte, keine Floskeln',
    '- Werte Investitionsthese, die vom Investor benannten Risiken und die sonstigen',
    '  Bemerkungen aktiv aus: spiegle sie in Stärken/Risiken (Pro/Kontra) und',
    '  bestätige oder widerlege sie mit Zahlen.',
    '- Quellen: vollständige URLs NUR im "quellen"-Array, KEINE rohen Markdown-Links im Text.',
    /* v2264 · Regel vom 14.10.2026 (CLAUDE.md, Anbieter-Neutralitaet): 19 von 27
       gespeicherten Analysen nannten Portale im Text oder in der Quellenliste. */
    '- KEINE Namen von Immobilienportalen, Bewertungsdiensten oder kommerziellen',
    '  Datenanbietern — weder im Fließtext noch im "quellen"-Array (keine URLs solcher',
    '  Seiten). Schreibe „aktuelle Angebotsdaten“ bzw. „Marktdaten“. Erlaubt sind amtliche',
    '  und öffentliche Stellen (Gutachterausschuss, Statistisches Bundesamt/Landesamt,',
    '  Deutsche Bundesbank, Kommune) und ImmoMetrica.',
    '',
    '## ANTWORTFORMAT — strikt JSON, keine Markdown-Codeblöcke',
    'Antworte AUSSCHLIESSLICH mit folgendem JSON-Objekt:',
    '{',
    '  "gesamtbewertung": "8-10 Sätze, mit Zahlen: Rendite, Cashflow vor/nach Steuer, DSCR/LTV, Lage, Hauptrisiko, Urteil",',
    '  "fazit_kurz": "Kaufen | Prüfen | Nicht kaufen",',
    /* ══ v2156 · JEDER EINTRAG BRAUCHT EINE VORGABE ═══════════════════
       Marcel am 12.10.2026: „dass wir da wirklich vernuenftige
       Auswertungen bekommen … das noch vollumfaenglicher, genauer."

       Hier stand `["Staerke 1 ausfuehrlich mit Zahl", "Staerke 2",
       "Staerke 3", …]`. GEMESSEN: das ist die schwaechste Vorgabe des
       ganzen Antwortformats — alle anderen Felder nennen eine Satzzahl
       (4-6, 8-12), diese beiden nur das Wort „ausfuehrlich", und zwar
       nur am ERSTEN Element. Die Eintraege 2 bis 5 hatten gar keine.

       > Ein Listeneintrag ohne Vorgabe wird ein Stichwort. „Gute Lage"
       > ist keine Staerke, es ist eine Behauptung — und sie steht dann
       > neben einem ersten Eintrag, der drei Saetze und eine Zahl hat.

       Jetzt tragen alle fuenf dieselbe Anforderung: zwei bis drei Saetze
       MIT der Zahl, auf die sich die Aussage stuetzt. Das ist dieselbe
       Strenge wie im uebrigen Format und der Grund, warum die
       Investmentbewertung heute brauchbar ist. */
    '  "staerken":   ["je Eintrag 3-4 Sätze MIT der Zahl, auf die sich die Aussage stützt (z.B. \\"DSCR 1,34 liegt über der Bankschwelle 1,2 …\\"). Kein Stichwort, kein Allgemeinplatz. Fünf Einträge, der erste der stärkste.", "Stärke 2 — gleiche Anforderung", "Stärke 3", "Stärke 4", "Stärke 5"],',
    '  "risiken":    ["je Eintrag 3-4 Sätze MIT Zahl und mit der Folge für den Investor (was passiert, wenn es eintritt). Fünf Einträge, der erste der schwerste.", "Risiko 2 — gleiche Anforderung", "Risiko 3", "Risiko 4", "Risiko 5"],',
    '  "risikoanalyse": {',
    '    "finanzierungsrisiko": "Ausführliche Bewertung von LTV+DSCR mit beiden Zahlen, Bankschwellen und Entwicklung über die Jahre, 6-8 Sätze",',
    '    "cashflow_stabilitaet": "Cashflow-Stabilität: Cashflow vor UND nach Steuer, wie er sich über den Jahresverlauf entwickelt, was ihn trägt und was ihn kippen kann, 6-8 Sätze",',
    '    "annahmen_abhaengigkeit": "Welche Annahmen sind kritisch (Miete, Leerstand, Zins nach Bindung, Instandhaltung)? Je Annahme: was passiert, wenn sie nicht eintritt, 6-8 Sätze"',
    '  },',
    '  "szenarien": {',
    '    "worst_case": "Miete -10%, Zins +1% — Folgen ausführlich qualitativ und quantitativ (Cashflow, DSCR, Steuer), 6-8 Sätze",',
    '    "best_case":  "Miete +5%, Wertsteigerung über Erwartung — Folgen ausführlich mit Zahlen, 6-8 Sätze"',
    '  },',
    '  "investor_fit": {',
    '    "cashflow_investor":     "ja/nein/teilweise — Begründung mit Zahlen, 2-3 Sätze",',
    '    "wertsteigerungs_investor": "ja/nein/teilweise — Begründung mit Zahlen, 2-3 Sätze",',
    '    "sicherheitsorientiert": "ja/nein/teilweise — Begründung mit Zahlen, 2-3 Sätze"',
    '  },',
    '  "empfehlung": "Kaufen | Prüfen | Nicht kaufen",',
    '  "empfehlung_begruendung": "Ausführliche Begründung: die drei Gründe, die das Urteil tragen, je mit Zahl, und was es ändern würde, 8-10 Sätze",',
    '  "dealpilot_insight": "Tool-Voice, 6-8 Sätze, fundiert — die eine Erkenntnis, die in den Zahlen steckt und die man auf den ersten Blick nicht sieht",',
    '  "investmentbewertung": "Holistische Bewertung — 12-16 Sätze, mit Zahlen, Lage, Marktumfeld, Risiko, langfristige Perspektive",',
    '  "verhandlungsempfehlung": "Konkrete Verhandlungsstrategie — 12-16 Sätze: Argumente, Hebel, Zielpreis, Kompromisse",',
    '  "kaufpreis_offerte": {',
    '    "empfohlen": "Empfohlener Kaufpreis als Zahl mit € — z.B. 175.000 €",',
    '    "begruendung": "Warum dieser Preis? 5-7 Sätze mit Bezug auf Vergleichswerte und Marktlage",',
    '    "argumente": ["Argument 1 für die Verhandlung — ausführlich mit Zahl", "Argument 2", "Argument 3", "Argument 4", "Argument 5"]',
    '  },',
    '  "offerte_mail": {',
    '    "betreff": "Betreff der E-Mail an Makler/Verkäufer (kurz, sachlich)",',
    '    "text": "Höfliches, sehr wertschätzendes Anschreiben an Makler oder Verkäufer, 10-16 Sätze. Beschreibe die Situation sachlich und respektvoll, würdige das Objekt, lege Vorteile UND Nachteile transparent dar (gestützt auf Investitionsthese und benannte Risiken) und leite daraus die Preisvorstellung wertschätzend und nachvollziehbar her. Freundlicher, seriöser Ton, kein Druck, mit höflicher Grußformel."',
    '  },',
    '  "bankargumente": [',
    '    "Argument 1 zur Vorlage bei Bank — DSCR/LTV/Lage, 2-3 Sätze mit konkreten Zahlen",',
    '    "Argument 2",',
    '    "Argument 3",',
    '    "Argument 4",',
    '    "Argument 5"',
    '  ],',
    '  "makrolage_recherche": "Ausführlich recherchierte Fakten zur Makrolage (Bevölkerung, Wirtschaft, Arbeitsmarkt, Wohnungsmarkt) mit Zahlen und Jahr, 8-10 Sätze",',
    '  "mikrolage_recherche": "Ausführlich recherchierte Fakten zur Mikrolage (Quartier, Infrastruktur, Verkehr, Nachfrage, Lärm/Umfeld) mit Zahlen, 8-10 Sätze",',
    /* v2150 · Marcel: „man kann die werte der KI gerne mit den daten aus
       der schnittstelle abgleichen." Das Feld hiess „Recherchierter Wert" —
       und genau das hat das Modell getan, auch wenn der Marktbericht eine
       GEMESSENE Marktmiete trug. Ein Feldname ist eine Anweisung. */
    '  "mietspiegel_eur_qm":  "€/m² kalt. VORRANG: der Wert aus dem DealPilot-Marktbericht, falls einer im Prompt steht. Nur ohne Bericht selbst recherchieren. null, wenn keine belastbare Quelle da ist — nie schätzen",',
    '  "mietspiegel_herkunft": "woher dieser Wert kommt: \\"Marktbericht vom <Datum>\\" oder die recherchierte Quelle. null wenn kein Wert",',
    /* v2150 · DAS FELD FUER DEN ABGLEICH. Ohne Zielfeld verschwindet ein
       Prompt-Auftrag lautlos — der Auftrag unten in Aufgabe 14 braucht
       eine Stelle, an der die Antwort landen kann. */
    '  "berichts_abgleich":   "Wenn ein Marktbericht vorliegt: 2-4 Sätze, wie deine Einordnung zu seinen gemessenen Werten steht (Marktwert, Marktmiete, Sach-/Ertragswert, führendes Verfahren). Weichen sie ab, nenne BEIDE Zahlen und sage, welche woher kommt. null ohne Bericht",',
    '  "kaufpreisniveau":     "Einordnung des Kaufpreises mit Vergleichswerten (EUR/m², Faktor, Bodenrichtwert, Marktbericht), 6-8 Sätze",',
    /* v2157 · Zielfeld fuer Aufgabe 15 (N62.4) */
    '  "lage_gegenueberstellung": [',
    '    { "merkmal": "Makrolage", "objektfeld": "Angabe des Investors oder null", "bericht": "Wert laut Marktbericht oder null", "recherche": "dein Befund, kurz, mit Zahl wo moeglich", "quelle": "URL der Recherchequelle oder null", "urteil": "stimmt | weicht ab | offen", "kommentar": "1-2 Saetze: was das fuer die Investition heisst" },',
    '    "... je eine Zeile fuer Mikrolage, Bevoelkerungsentwicklung, Nachfrage, Wertsteigerung, Entwicklung, Mietniveau, Kaufpreisniveau"',
    '  ],',
    /* v2160 · Zielfelder fuer Aufgabe 16 (N62.6, vertieft v2166) */
    '  "steuer_zusammenfassung": "14-20 Saetze in der Gliederung von Aufgabe 16: Werbungskosten nach Art, Ergebnis und Steuerwirkung Jahr 1, Jahr der Wende und warum, Steuerlast danach in EUR, Folge fuer den Cashflow nach Steuer, Sanierung, Hinweis auf Steuerberater",',
    _pz ? '  "potenzial_text": "4-7 Saetze nach Aufgabe 17 (Mieterhoehung, Zielbild, Ertragswert je Stufe, Wertzuwachs nach Kosten, Aufteilung); null ohne Block",' : '',   /* v2430 */
    _ak ? '  "soll_ist_steuer": "2-4 Saetze: steuerliche Lage beim Ankauf gegen heute, mit beiden Zahlen; null, wenn keine Steuerzahl zu beiden Zeitpunkten vorliegt",' : '',
    '  "anschlussfinanzierung": "Restschuld nach Zinsbindung + noetiger EK-Einsatz/Sondertilgung damit die Anschlussfinanzierung traegt, 4-6 Saetze mit Zahlen soweit ableitbar",',
    '  "score_vergleich": "Falls DealPilot-Score UND Investor Deal Score vorliegen und sich unterscheiden: erklaere Konvergenz/Divergenz und welche Zusatz-KPIs (Lage/Substanz/Upside) den Unterschied treiben, 4-6 Saetze. Sonst leer lassen.",',
    /* v2013b - GEMESSEN am echten Lauf: die Fotos gingen durch (22 von
       22 Schluesseln kamen zurueck), aber das Modell schrieb KEIN Wort
       zum Bildeindruck. Der Grund stand im Antwortformat: es gab kein
       Feld dafuer. Ich hatte "beschreibe, was sichtbar ist" verlangt
       und keinen Ort dafuer gegeben - das Modell fuellt die definierten
       Felder, nicht erfundene.
       Das Feld erscheint nur, wenn auch Fotos mitgehen; sonst waere es
       eine Zeile, die zum Raten einlaedt. */
    _nFotos ? '  "optischer_eindruck": "Was die Fotos ZEIGEN: Bauweise, Fassade, Fenster, Dach, Umfeld, Pflegezustand. Als visueller Eindruck formuliert, nicht als Feststellung. KEIN Baujahr, keine Flaeche, kein Sanierungsjahr, kein Wert daraus ableiten. Widerspricht der Eindruck dem erfassten Zustandsfeld, nenne BEIDES und sage, dass sie auseinandergehen. 4-6 Saetze.",' : '',
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
    /* ══ v2156 · 8000 WAREN SCHON KNAPP, UND ES WURDE MEHR VERLANGT ═════

       GEMESSEN am 12.10.2026: das Antwortformat verlangt über rund 30
       Felder grob 110 bis 160 Sätze. Bei etwa 20 Tokens je deutschem Satz
       sind das 2.200 bis 3.200 Tokens für den Fließtext allein, plus
       JSON-Gerüst, plus die beiden Fünferlisten.

       Dass es bisher meist reichte, lag daran, dass die Listeneinträge
       Stichworte waren. v2156 verlangt dort 2-3 Sätze MIT Zahl, also bis
       zu 30 Sätze mehr — und dazu kommen die neuen Felder
       (`berichts_abgleich`, `mietspiegel_herkunft`, Aufgabe 14).

       > Ein Truncate ist hier kein Schönheitsfehler: `extractJson()` hat
       > eine Reparatur für abgeschnittenes JSON (Z. 1409 ff), aber die
       > rettet die Struktur, nicht den Inhalt. Die zuletzt verlangten
       > Felder fehlen dann einfach — und das sind die, die in der
       > Aufgabenliste hinten stehen: Bankargumente, Anschreiben,
       > Anschlussfinanzierung, der Berichtsabgleich.

       12000 statt 8000. Die Kappe bleibt eine Kappe — sie soll nur nicht
       vor dem Ende der Aufgabenliste greifen. */
    max_output_tokens: 16000,   /* v2166: laengere Texte; gpt-4o-mini erlaubt 16.384 */
    /* v1264: Web-Suche abschaltbar. Additiv — wer die Option nicht setzt,
       bekommt sie weiter, also ändert sich für alle bestehenden Aufrufer
       nichts. Gebraucht wird das für Nachbearbeitungs-Aufrufe, die einen
       bereits vorliegenden Text nur umformen: dort ist die Websuche reine
       Wartezeit und kostet zusätzlich. */
    tools: opts.noWebSearch ? [] : [{ type: 'web_search_preview' }]
  };

  // V51/V62.3: Determinismus aus opts.aiOptions durchreichen, wenn vorhanden.
  // Bei temperature=0 → reproduzierbare Antworten.
  // V62.3: 'seed' wird NICHT mehr durchgereicht — die /v1/responses-API
  // unterstützt diesen Parameter nicht (gibt 400: Unknown parameter 'seed').
  // 'seed' war nur in der alten /v1/chat/completions-API gültig.
  if (opts.aiOptions) {
    /* v2978 · Die Denkmodelle (gpt-5-Familie, o1/o3/o4) lehnen `temperature` mit 400 ab:
       „Unsupported parameter: 'temperature' is not supported with this model."
       Marcel 27.10.2026 im Co-Piloten auf Prod - dort fehlt COPILOT_MODEL, also greift der
       Standard gpt-5.6-luna (auf Staging steht gpt-4o-mini, deshalb fiel es dort nie auf).
       Fuer diese Modelle wird die Temperatur weggelassen statt die Frage scheitern zu lassen. */
    const _ohneTemperatur = /^(gpt-5|o[1-9])/i.test(String(model || ''));
    if (opts.aiOptions.temperature != null && !_ohneTemperatur) {
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
    /* v2209: store:false - nichts liest eine gespeicherte Antwort wieder ein (kein previous_response_id). */
    body: JSON.stringify(Object.assign({ store: false }, body))
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
function _analyzeStyleSuffix(opts) {
  var ai = opts && opts.aiOptions; if (!ai) return '';
  var parts = [];
  var dlMap = { kurz: 'Antworte knapper, fokussiert auf das Wesentliche.', mittel: 'Antworte in mittlerer Laenge.', ausfuehrlich: 'Antworte ausfuehrlich mit Begruendung und Datenpunkten.' };
  if (ai.detailLevel && dlMap[ai.detailLevel]) parts.push(dlMap[ai.detailLevel]);
  var tnMap = { sachlich: 'Tonalitaet: streng sachlich-neutral.', beratend: 'Tonalitaet: beratend mit konkreten Empfehlungen.', kritisch: 'Tonalitaet: kritisch — Risiken zuerst benennen, dann Chancen.' };
  if (ai.tonality && tnMap[ai.tonality]) parts.push(tnMap[ai.tonality]);
  if (Array.isArray(ai.focusAreas) && ai.focusAreas.length) parts.push('Lege besonderen Fokus auf: ' + ai.focusAreas.join(', ') + '.');
  if (ai.customInstructions && typeof ai.customInstructions === 'string') { var ci = ai.customInstructions.trim().slice(0, 500); if (ci) parts.push('Zusaetzliche Anweisung des Nutzers: ' + ci); }
  if (!parts.length) return '';
  return '\n\n## STIL-VORGABEN (verbindlich)\n' + parts.join('\n') + '\n';
}
/* v1701: Der haeufigste Parse-Fehlschlag war KEIN abgeschnittenes JSON,
   sondern eine RUECKFRAGE des Modells — gemessen am 29.09.2026:
   "Ich kann die erforderlichen Informationen im Web recherchieren, um die
   Analyse durchzufuehren. Moechtest du, dass ich das sofort starte?"
   Der Prompt hat das nie verboten. Ein Modell, das um Erlaubnis fragt,
   wartet auf eine Antwort, die es in einem Einweg-Aufruf nie bekommt. */
const ANTI_RUECKFRAGE = [
  '',
  '## AUSGABE-ZWANG (ueberschreibt alles andere)',
  'Stelle KEINE Rueckfragen. Frage NICHT um Erlaubnis — weder fuer Web-Recherche',
  'noch fuer sonst etwas. Du bist bereits beauftragt; alle Freigaben liegen vor.',
  'Antworte AUSSCHLIESSLICH mit dem JSON-Objekt. Kein Vorwort, kein Nachwort,',
  'keine Markdown-Codefences, kein Satz davor oder danach.',
  'Das erste Zeichen deiner Antwort ist "{", das letzte ist "}".',
  'Fehlen dir Daten, schreibe das IN das jeweilige JSON-Feld — nie daneben.',
  ''
].join('\n');

/* v2264 · Die Offerte liegt nie ueber dem Kaufpreis - auch wenn das Modell die
   Regel im Prompt ueberliest. Gedeckelt wird auf den Kaufpreis, mit Vermerk. */
function _offerteDeckeln(a, payload) {
  try {
    var kp = Number(payload && payload.kennzahlen && payload.kennzahlen.kp);
    var o = a && a.kaufpreis_offerte;
    if (!(kp > 0) || !o || o.empfohlen == null) return a;
    var roh = String(o.empfohlen);
    var m = roh.replace(/[^0-9.,]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    var wert = parseFloat(m);
    if (!isFinite(wert) || wert <= kp) return a;
    o.empfohlen = Math.round(kp).toLocaleString('de-DE') + ' €';
    o.begruendung = (o.begruendung ? o.begruendung + ' ' : '')
      + '(Vom Modell vorgeschlagen waren ' + Math.round(wert).toLocaleString('de-DE') + ' € — über dem Angebotspreis; '
      + 'eine Offerte liegt höchstens beim Kaufpreis.)';
    /* v2947 (N78.1) · Mail und Verhandlungstext tragen dieselbe falsche Zahl.
       Die Mail wird NICHT umgeschrieben, sondern weggelassen: sie leitet die
       Preisvorstellung im Fliesstext her ("... und biete daher 910.000 € an"),
       ein Ersetzen des Betrags liesse die Herleitung stehen, die zu ihm fuehrt,
       und verfehlt jede andere Schreibweise ("910 T€", "0,91 Mio."). Eine
       fehlende Mail ist sichtbar, eine stimmige mit falscher Begruendung nicht.
       Die Anzeige liest `offerte_mail_entfallen` (ui.js). */
    if (a.offerte_mail) {
      a.offerte_mail = null;
      a.offerte_mail_entfallen = 'Keine Mail: das Modell schlug '
        + Math.round(wert).toLocaleString('de-DE') + ' € vor, über dem Kaufpreis von '
        + Math.round(kp).toLocaleString('de-DE') + ' €. Die Herleitung der Mail stützte sich auf diesen Betrag.';
    }
    if (a.verhandlungsempfehlung) {
      a.verhandlungsempfehlung = 'Hinweis: Der vom Modell genannte Zielpreis von '
        + Math.round(wert).toLocaleString('de-DE') + ' € liegt über dem Kaufpreis von '
        + Math.round(kp).toLocaleString('de-DE') + ' € und gilt nicht; Preisangaben über dem Kaufpreis '
        + 'im folgenden Text bitte nicht verwenden. ' + String(a.verhandlungsempfehlung);
    }
    a.offerte_gedeckelt = { vorschlag: Math.round(wert), kaufpreis: Math.round(kp) };
    try { console.warn('[analyze] Offerte gedeckelt: ' + wert + ' -> ' + kp); } catch (e) {}
  } catch (e) {}
  return a;
}

async function analyze(payload, opts) {
  const prompt = buildPrompt(payload, opts) + _analyzeStyleSuffix(opts) + ANTI_RUECKFRAGE;
  /* v2013 - MIT Fotos geht der ERSTE Anlauf ueber den Bildweg.

     `callOpenAI` schickt `input: <string>`; Bilder brauchen
     content-parts. Den Weg gab es schon (`_callOpenAIVision`), aber
     nur fuer den Beleg-Import.

     Ohne Fotos bleibt ALLES wie es war - gleiche Funktion, gleiche
     Websuche. Und der zweite Anlauf weiter unten laeuft immer ueber
     den Textweg: ein Wiederholversuch soll nicht auch noch die
     Bilder bezahlen. */
  const _fotos = (opts && Array.isArray(opts.fotos)) ? opts.fotos.slice(0, 4) : [];
  let r;
  if (_fotos.length) {
    const teile = [{ type: 'input_text', text: prompt }].concat(
      _fotos.map(function (f) { return { type: 'input_image', image_url: f }; }));
    /* v2013a - GEMESSEN am ersten echten Lauf: die Analyse kam mit nur
       5 von ~20 Schluesseln zurueck, 2.731 Zeichen, abgeschnitten.
       Ursache: `_callOpenAIVision` deckelt bei `opts.maxTokens || 700`.
       Die 700 stammen vom Beleg-Import, fuer den die Funktion gebaut
       wurde - eine Rechnung braucht keine 8000 Tokens, eine
       Pilot-Analyse schon. Der Textweg nimmt 8000, also muss der
       Bildweg dieselben bekommen; sonst ist die Antwort je nach Weg
       verschieden lang, und das sieht man ihr nicht an. */
    r = await _callOpenAIVision(teile, Object.assign({}, opts, { maxTokens: 16000 }));   /* v2167: wie der Textweg (v2166) - mit Fotos galt sonst weiter 8000 */
  } else {
    r = await callOpenAI(prompt, opts);
  }
  let parsed = extractJson(r.text);
  let used = r;

  // V34: Lokales Logging — bei Parse-Fail Länge + Anfang/Ende für Debug
  if (!parsed) {
    console.warn('[openaiService] JSON-Parse fehlgeschlagen — Text-Länge:', (r.text || '').length);
    console.warn('[openaiService] Anfang:', (r.text || '').slice(0, 200));
    console.warn('[openaiService] Ende:',   (r.text || '').slice(-200));

    /* v1701: Zweiter Anlauf statt Fehlermeldung. Ohne Websuche — genau die
       war der Anlass der Rueckfrage — und mit temperature 0, damit das
       Modell nicht noch einmal ins Plaudern geraet. Schlaegt auch der fehl,
       kommt die alte Meldung. Kostet im Fehlerfall einen zweiten Aufruf,
       sonst nichts: der Zweig wird nur bei !parsed betreten. */
    try {
      const r2 = await callOpenAI(
        prompt + '\n\nDein vorheriger Versuch war KEIN gueltiges JSON. Der RECHERCHE-AUFTRAG ' +
                 'oben ist fuer diesen Durchgang aufgehoben: recherchiere NICHT im Web, rufe KEIN ' +
                 'Such-Tool auf und frage nicht danach. Arbeite allein mit den oben gegebenen ' +
                 'Daten und deinem Wissen; die Recherche-Felder fuellst du aus deinem Wissen oder ' +
                 'laesst sie leer. Antworte jetzt nur mit dem JSON-Objekt, beginnend mit "{" und ' +
                 'endend mit "}".',
        Object.assign({}, opts, {
          noWebSearch: true,
          aiOptions: Object.assign({}, (opts && opts.aiOptions) || {}, { temperature: 0 })
        })
      );
      const p2 = extractJson(r2.text);
      if (p2) {
        console.warn('[openaiService] Zweiter Anlauf hat geliefert (ohne Websuche).');
        parsed = p2; used = r2;
      } else {
        console.warn('[openaiService] Zweiter Anlauf ebenfalls ohne JSON:', (r2.text || '').slice(0, 200));
      }
    } catch (e) {
      console.warn('[openaiService] Zweiter Anlauf fehlgeschlagen:', e.message);
    }
  }

  return {
    success: true,
    model: used.model,
    /* v1704d: auch hier. `ui.js:_urlSauber` saeubert nur die
       strukturierten Quellenfelder - die LANGTEXTE
       (`makrolage_recherche`, `kaufpreisniveau`, …) tragen ihre Links im
       Fliesstext und kamen dort nie an. */
    analysis: _offerteDeckeln(_analyseQuellenNeutral(_analyseUrlsSaeubern(parsed)), payload),
    raw_text: parsed ? null : used.text  // bei Parse-Fail Text zurückgeben für Debug
  };
}

/* Geht rekursiv durch die Analyse und saeubert jeden String. Zahlen,
   Wahrheitswerte und null bleiben unangetastet - eine Saeuberung, die
   Typen verbiegt, waere schlimmer als der Zaehlparameter. */
function _analyseUrlsSaeubern(a) {
  if (a == null) return a;
  if (typeof a === 'string') return _urlsSaeubern(a);
  if (Array.isArray(a)) return a.map(_analyseUrlsSaeubern);
  if (typeof a === 'object') {
    const out = {};
    for (const k of Object.keys(a)) out[k] = _analyseUrlsSaeubern(a[k]);
    return out;
  }
  return a;
}

/**
 * V36: Kompakte Lage-Bewertung (Makro + Mikro) für eine Adresse.
 * Kurzer Output, eigener Endpoint, eigenes JSON-Schema.
 */
/* ══ v2972 · KEIN QUELLENNAME IM TEXT DER PILOT-ANALYSE (Marcel 27.10.2026) ══
   Das Investment-PDF 2026-1078 nannte unter „Lage & Markt" „von miet-check.de".
   Die Regel steht seit v2264 im Prompt (Z. ~1609) - das Modell ueberliest sie.
   Ein Hinweis verliert gegen das Werkzeug; also wird die ANTWORT bereinigt:
   Portal- und Anbieternamen werden ersetzt, Domains, die nicht amtlich sind,
   fallen aus dem Fliesstext (mit ihrer Praeposition), und die Quellenliste
   verliert Eintraege solcher Seiten. Amtliche Stellen bleiben, ImmoMetrica auch. */
const _QN_AMTLICH = /(\.bund\.de|destatis|statistik|bundesbank|gutachterausschu|boris|regionalstatistik|zensus|\.nrw\.de|it\.nrw|\.bayern\.de|\.hessen\.de|\.niedersachsen\.de|\.sachsen\.de|berlin\.de|hamburg\.de|bremen\.de|\.ihk\.de|stadt|gemeinde|kreis|rathaus|haus-?und-?grund|immometrica|arbeitsagentur|europa\.eu|bbsr)/i;
const _QN_PORTAL_NAME = /\b(ImmobilienScout\s?24|Immobilien\s?Scout\s?24|ImmoScout\s?24|ImmoScout|Immowelt|Immonet|immoportal|Wohnungsb(?:oe|ö)rse|Homeday|meinestadt|Kleinanzeigen|Kalaydo|wohnpreis|immopreise|Immo-?Kompass)\b/gi;
const _QN_ANBIETER_NAME = /\b(Sprengnetter|PriceHubble|GeoMap|on-geo|empirica|bulwiengesa)\b/gi;
const _QN_DOMAIN = /(\s*\(?\s*(?:Quelle:\s*|von\s+|laut\s+|lt\.\s*|auf\s+|bei\s+|via\s+|nach\s+)?)(?:https?:\/\/)?(?:www\.)?([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:de|com|net|org|eu|info|io))\b(?:\/[^\s),;]*)?(\s*\))?/gi;
function _quelleNeutralText(t) {
  return String(t)
    .replace(_QN_DOMAIN, function (m, vor, dom) {
      if (_QN_AMTLICH.test(dom)) return m;
      if (/laut|lt\.|nach/i.test(vor || '')) return (/^\s*[LN]/.test(vor) ? ' Laut' : ' laut') + ' aktuellen Marktdaten';
      return '';
    })
    .replace(_QN_PORTAL_NAME, 'Angebotsportalen')
    .replace(_QN_ANBIETER_NAME, 'unabhängiger Bewertungspartner')
    .replace(/\s+([.,;:])/g, '$1').replace(/,([.;:])/g, '$1').replace(/\(\s*\)/g, '').replace(/ {2,}/g, ' ');
}
function _quelleIstMarktseite(q) {
  const t = typeof q === 'string' ? q : (q && (q.url || q.quelle || q.label || q.name)) || '';
  if (!t || _QN_AMTLICH.test(t)) return false;
  _QN_PORTAL_NAME.lastIndex = 0; _QN_ANBIETER_NAME.lastIndex = 0;
  return _QN_PORTAL_NAME.test(t) || _QN_ANBIETER_NAME.test(t) || /\.(de|com|net|org|eu|info|io)\b/i.test(t);
}
function _analyseQuellenNeutral(a, schluessel) {
  if (a == null) return a;
  if (typeof a === 'string') {
    /* ein Feld, das nur eine Quelle traegt, wird bei einer Marktseite neutral */
    if ((schluessel === 'quelle' || schluessel === 'mietspiegel_herkunft') && _quelleIstMarktseite(a)) return schluessel === 'quelle' ? null : 'aktueller Marktdurchschnitt';
    return _quelleNeutralText(a);
  }
  if (Array.isArray(a)) {
    const l = schluessel === 'quellen' ? a.filter(function (q) { return !_quelleIstMarktseite(q); }) : a;
    return l.map(function (x) { return _analyseQuellenNeutral(x, schluessel); });
  }
  if (typeof a === 'object') {
    const out = {};
    for (const k of Object.keys(a)) out[k] = _analyseQuellenNeutral(a[k], k);
    return out;
  }
  return a;
}

async function analyzeLage(payload, opts) {
  const adresse = payload.adresse || [payload.str, payload.hnr, payload.plz, payload.ort].filter(Boolean).join(' ');
  if (!adresse) throw new Error('Keine Adresse übergeben');
  
  // V187-h2: Adress-Genauigkeits-Kontext für die KI
  const hasStr = !!(payload.str && String(payload.str).trim());
  const hasHnr = !!(payload.hnr && String(payload.hnr).trim());
  const hasPlz = !!(payload.plz && String(payload.plz).trim());
  const hasOrt = !!(payload.ort && String(payload.ort).trim());
  let addressContext = '';
  if (hasStr && hasHnr && hasPlz && hasOrt) {
    addressContext = 'Du hast die VOLLSTÄNDIGE Adresse (Straße, Hausnummer, PLZ, Ort). Liefere eine PRÄZISE Mikrolagen-Analyse auf Straßenebene: konkrete Nachbarschafts-Charakteristik, fußläufige Infrastruktur, Quartierscharakter. Nutze die Straße als Anker für deine Recherche.';
  } else if (hasStr && hasPlz && hasOrt) {
    addressContext = 'Du hast Straße + PLZ + Ort (keine Hausnummer). Liefere eine detaillierte Straßenebene-Analyse. Erwähne kurz dass für noch präzisere Aussagen (z.B. konkrete Lärmbelastung, Hausnummer-genaue Lage) die Hausnummer hilfreich wäre.';
  } else if (hasPlz && hasOrt) {
    addressContext = 'Du hast NUR PLZ + Ort (keine Straße). Liefere eine generelle Lage-Einschätzung für das Quartier/den Stadtteil. Wichtig: Sei vorsichtig mit straßenspezifischen Aussagen — du kennst die konkrete Straße nicht. Mache stattdessen Aussagen über das PLZ-Gebiet und den Stadtteil. Erwähne im Mikrolagen-Block dass eine straßengenaue Analyse erst mit Adresse möglich wäre.';
  } else if (hasOrt) {
    addressContext = 'Du hast NUR den Ort (keine PLZ, keine Straße). Liefere nur eine sehr generelle Stadt-/Gemeinde-Einschätzung. Sei explizit dass die Analyse ohne PLZ und Straße nur grobe Hinweise liefern kann.';
  }
  payload._addressContext = addressContext;


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
    (payload._addressContext ? '\n## ADRESS-GENAUIGKEIT\n' + payload._addressContext : ''),
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
    '4. nachfrage (Nachfrage = Vermarktungsdauer der Kaufangebote: sehr_stark bis 30 Tage, stark bis 60, mittel bis 120, schwach bis 200, darueber sehr_schwach)',   /* v2518 */
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
/* v2500 · Der Prompt ist eine eigene Funktion, damit
   tools/prompt-lecks-pruefen.mjs die ECHTE Fassung pruefen kann (kommen
   die belegten Vergleichswerte an?) - ohne Modellaufruf. */
function buildDs2Prompt(payload) {
  const { fields, fieldSpecs, context } = payload;
  const adresse = context.adresse || [context.strasse, context.hausnr, context.plz, context.ort]
    .filter(Boolean).join(' ');
  if (!adresse) throw new Error('Keine Adresse im Context');
  const _belege = payload.mietbelege && typeof payload.mietbelege === 'object' ? payload.mietbelege : null;

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
    '  - "reasoning": Begruendung in 1 Satz, max 160 Zeichen. KEIN Quellenname — die Quelle steht in "sources".',
    '  - "source": Kurzname der WICHTIGSTEN Quelle (max 80 Zeichen). Bei Unsicherheit: "KI-Marktbewertung".',
    '  - "sources": ALLE benutzten Quellen als Array, je { "label": "...", "url": "...", "amtlich": true/false }. Typisch zwei bis vier.',
    '    "amtlich": true NUR fuer Stadt, Gemeinde, Landkreis, Statistikamt, IHK oder Haus- und Grundbesitzerverein.',
    '    Portale wie ImmobilienScout, Immowelt, immoportal, mietspiegel.com sind NIE amtlich — auch nicht, wenn sie',
    '    ihre Seite "Mietspiegel" nennen. Eine kommerzielle Mietpreisuebersicht ist kein Mietspiegel.',
    '    Nenne so eine Quelle im "label" auch nicht so: "Mietpreisuebersicht ImmobilienScout24", nicht "Mietspiegel".',
    '    url NUR wenn du sie sicher kennst, sonst ganz weglassen — nie eine plausible URL bauen.',
    '    Eine einzige Quelle nur, wenn es wirklich nur eine gab.',
    '',
    /* v1242 · Marcels Vorgabe vom 07.09.2026: „die KI anfrage duerfte mehrere
       quellen ausgeben und moeglichst immer bei der gemeinde oder stadt
       nachschauen ob es da einen mietspiegel gibt, einen offiziellen."
       Der Prompt verlangte bis hierher genau EINE Quelle (source, 80 Zeichen)
       und nannte den Mietspiegel nur als Beispiel. Jetzt ist er der erste
       Auftrag — und das Fehlen eines Mietspiegels ist eine Antwort, keine
       Luecke. */
    'AMTLICHER MIETSPIEGEL — ZUERST PRUEFEN:',
    '  - Sieh fuer die Gemeinde/Stadt nach, ob es einen OFFIZIELLEN Mietspiegel gibt',
    '    (Stadt, Gemeinde, Landkreis, IHK oder Haus- und Grundbesitzerverein).',
    '  - Gibt es einen: nenne ihn mit JAHR in "sources" und stuetze ds2_marktmiete darauf.',
    '  - Gibt es keinen: sage das ausdruecklich in "reasoning" ("kein amtlicher',
    '    Mietspiegel fuer <Ort>") und nenne, worauf du dich stattdessen stuetzt.',
    '  - Ein qualifizierter Mietspiegel (§ 558d BGB) hat Vorrang vor einem einfachen.',
    '  - NICHT raten: ein Mietspiegel, den du nicht belegen kannst, wird nicht genannt.',
    '',
    /* v2500 · Die belegten Vergleichswerte aus DealPilots eigenen Daten
       (mietBelegeService). Steht nur da, wenn sie gesammelt wurden - und
       die Regeln zu "vergleich_text"/"stuetzt_sich_auf" NUR mit ihnen
       (regel-ohne-daten: eine Regel, die Felder erklaert, die nicht im
       Prompt stehen, laesst das Modell glauben, es habe sie). */
    _belege ? _mietBelegeBlock(_belege) : '',
    '',
    'WICHTIG:',
    '  - Nenne in "reasoning"' + (_belege ? ', "vergleich_text"' : '') + ' und in den "label" der Quellen KEINEN Namen eines',
    '    Immobilienportals oder Datenanbieters. Angebotsmieten heissen "aktueller Marktdurchschnitt".',
    '  - ENUM-Werte EXAKT so wie angegeben (keine Übersetzung, keine Kreativität)',
    '  - Bei Unsicherheit: konservativ, eher mittlere Kategorie wählen',
    '  - Wenn ein Feld nicht sinnvoll bestimmbar ist (z.B. weil Kontext fehlt): null als value',
    '  - Quellen NIEMALS frei erfinden. Wenn unsicher → "KI-Marktbewertung"',
    '',
    'Antwort STRIKT als JSON, KEIN Markdown:',
    '{',
    /* v1242b · Der echte Lauf am 07.09.2026 hat zwei Fehler an EINER Stelle
       gefunden: das Beispiel-JSON. Es zeigte kein "sources" und trug in
       "reasoning" einen Quellennamen ("Mietspiegel Herford 2024") statt einer
       Begruendung. Das Modell kopiert das Beispiel — es kam genau eine Quelle
       zurueck und ein reasoning, das keins war. Das letzte Beispiel schlaegt
       jede Anweisung darueber. Beide Faelle stehen jetzt drin: mit und ohne
       amtlichen Mietspiegel. */
    '  "suggestions": {',
    '    "ds2_marktmiete": { "value": 9.5,',
    '      "reasoning": "Qualifizierter Mietspiegel, mittlere Lage, Baujahresklasse 1960-1979",',
    '      "source": "Mietspiegel Herford 2024",',
    '      "sources": [ { "label": "Qualifizierter Mietspiegel Herford 2024", "url": "https://www.herford.de/mietspiegel", "amtlich": true },',
    '                   { "label": "IHK Ostwestfalen, Immobilienmarktbericht 2025", "amtlich": true },',
    '                   { "label": "Aktueller Marktdurchschnitt (Angebotsmieten), Stand 2026" } ]'
      + (_belege ? ',\n      "vergleich_text": "Der Pilot-Wert <Wert> liegt <x> % <ueber/unter> dem aktuellen Marktdurchschnitt von <Median von oben>; zur amtlichen Vergleichsmiete von <Wert von oben, oder: keine amtliche>: <x> % <ueber/unter>.",'
        + '\n      "stuetzt_sich_auf": ["amtliche_vergleichsmiete", "marktdurchschnitt"] },' : ' },'),
    '    "ds2_mietausfall": { "value": "niedrig",',
    '      "reasoning": "Kein amtlicher Mietspiegel fuer Huellhorst; Einschaetzung aus Kreisdaten",',
    '      "source": "Kreis Minden-Luebbecke, Wohnungsmarktbeobachtung",',
    '      "sources": [ { "label": "Kreis Minden-Luebbecke, Wohnungsmarktbeobachtung 2025", "amtlich": true },',
    '                   { "label": "IT.NRW Bevoelkerungsvorausberechnung", "amtlich": true } ]'
      + (_belege ? ',\n      "vergleich_text": "Die Pilot-Einstufung <Stufe in Worten> gegen den Anhalt aus dem Zensus 2022 (<Anhalt von oben>, marktaktiver Leerstand <Wert von oben>): <passt/weicht ab, weil ...>.",'
        + '\n      "stuetzt_sich_auf": ["leerstand_zensus", "bevoelkerung"] }' : ' }'),
    '  }',
    '}'
  ].filter(Boolean).join('\n');
  return prompt;
}

/* v2500 · Der Block der belegten Vergleichswerte. Jede Zeile traegt ihren
   Schluessel in eckigen Klammern - das Modell nennt ihn in
   "stuetzt_sich_auf", und die Anzeige markiert, worauf es sich stuetzt.
   Fehlt ein Wert, steht er ausdruecklich als fehlend da: sonst fuellt das
   Modell die Luecke mit einer recherchierten Zahl und stellt sie neben
   gemessene (v2157, Zensus). */
function _mietBelegeBlock(b) {
  const z = function (n, d) { return n == null ? '–' : Number(n).toFixed(d == null ? 2 : d).replace('.', ','); };
  const dat = function (s) { return s ? String(s).slice(8, 10) + '.' + String(s).slice(5, 7) + '.' + String(s).slice(0, 4) : null; };
  const L = [];
  L.push('BELEGTE VERGLEICHSWERTE (aus DealPilots eigenen Daten, GEMESSEN — vor jeder Web-Recherche nutzen):');
  if (b.bericht) L.push('  Marktbericht vom ' + (dat(b.bericht.datum) || '?') + (b.bericht.stufe ? ', Stufe ' + b.bericht.stufe : ''));
  const a = b.amtlich || {};
  if (!a.fehlt && a.wert_qm != null) {
    L.push('  [amtliche_vergleichsmiete] ' + z(a.wert_qm) + ' EUR/m2 — Mietpreisuebersicht des Gutachterausschusses'
      + (a.quelle ? ' (' + a.quelle + ')' : '') + '. Amtlich; bildet weitgehend Bestandsmieten ab.'
      + (a.ausserhalb ? ' ACHTUNG: Objekt liegt ausserhalb der Tabelle, nur als Vergleich.' : ''));
  } else {
    L.push('  [amtliche_vergleichsmiete] liegt NICHT vor' + (a.grund ? ' (' + a.grund + ')' : '') + '. Erfinde keine; ein amtlicher Mietspiegel nur, wenn du ihn belegen kannst.');
  }
  const m = b.markt || {};
  if (!m.fehlt && m.wert_qm != null) {
    L.push('  [marktdurchschnitt] ' + z(m.wert_qm) + ' EUR/m2 Median der Angebotsmieten'
      + (m.q25_qm != null && m.q75_qm != null ? ' (mittlere Haelfte ' + z(m.q25_qm) + ' bis ' + z(m.q75_qm) + ')' : '')
      + (m.anzahl != null ? ', ' + m.anzahl + ' Angebote' : '') + (m.umkreis_km != null ? ' im Umkreis von ' + z(m.umkreis_km, 1) + ' km' : '')
      + (m.stand ? ', Stand ' + dat(m.stand) : '') + '. Angebotsmieten, keine Abschluesse; ein Abschlag fuer Mieten ist nicht gemessen.'
      + (m.trend_pct_pa != null ? ' Entwicklung ' + z(m.trend_pct_pa, 1) + ' % pro Jahr.' : ''));
  } else {
    L.push('  [marktdurchschnitt] liegt NICHT vor' + (m.grund ? ' (' + m.grund + ')' : '') + '.');
  }
  if (b.band) L.push('  [marktueblichkeitsband] ' + z(b.band.unten_qm) + ' bis ' + z(b.band.oben_qm) + ' EUR/m2 (Wertermittlung: amtlich/Angebot x 0,7 bis x 1,3)'
    + (b.band.lage ? ', Ist-Miete liegt ' + ({ unter: 'unterhalb', im_band: 'im Band', ueber: 'oberhalb' }[b.band.lage] || b.band.lage) : ''));
  if (b.ertrag) L.push('  [ertragswert_miete] ' + z(b.ertrag.wert_qm) + ' EUR/m2 im Ertragswert angesetzt' + (b.ertrag.quelle ? ' (' + b.ertrag.quelle + ')' : ''));
  if (b.ist_qm != null) L.push('  [ist_miete] ' + z(b.ist_qm) + ' EUR/m2 (Angabe des Investors)');
  L.push('');
  L.push('MIETAUSFALL — BELEGTE DATEN:');
  const lz = b.leerstand || {};
  if (!lz.fehlt) {
    L.push('  [leerstand_zensus] Zensus 2022, Stichtag 15.05.2022, ' + lz.ebene + ' ' + (lz.name || '') + ': '
      + (lz.marktaktiv_pct != null ? 'marktaktiver Leerstand ' + z(lz.marktaktiv_pct, 1) + ' %' : 'marktaktiver Leerstand nicht ausgewiesen')
      + (lz.gesamt_pct != null ? ', Gesamtleerstand ' + z(lz.gesamt_pct, 1) + ' %' : '')
      + (lz.dauerleer_anteil_pct != null ? ', davon ' + z(lz.dauerleer_anteil_pct, 1) + ' % seit ueber 12 Monaten (Dauerleerstand, kein Mietausfall)' : '')
      + (lz.anhalt ? '. Anhalt: ' + lz.anhalt.wort : '') + '.');
    L.push('    Der Wert ist vom Mai 2022 — einen juengeren amtlichen Leerstand je Gemeinde gibt es nicht. Nenne das Jahr.');
  } else {
    L.push('  [leerstand_zensus] liegt NICHT vor. Nenne keine Leerstandsquote als Zensuswert.');
  }
  const bv = b.bevoelkerung || {};
  if (!bv.fehlt && bv.trend_pct_pa != null) {
    L.push('  [bevoelkerung] Kreis: ' + (bv.trend_pct_pa >= 0 ? '+' : '') + z(bv.trend_pct_pa, 2) + ' % pro Jahr' + (bv.stand ? ' (Stand ' + bv.stand + ')' : '') + ', Regionaldatenbank');
  } else {
    L.push('  [bevoelkerung] liegt NICHT vor.');
  }
  L.push('  Haushaltsentwicklung: liegt NICHT vor. Angebotsdauer von Mietangeboten: liegt NICHT vor. Fuer beides keine Zahl nennen.');
  L.push('');
  L.push('ZU DEN BELEGEN:');
  L.push('  - "vergleich_text": 1-2 Saetze je Feld, die deinen Wert den belegten Werten oben gegenueberstellen —');
  L.push('    mit den Zahlen von oben, nichts neu rechnen ausser der Abweichung in Prozent.');
  L.push('  - "stuetzt_sich_auf": die Schluessel in eckigen Klammern, auf die du dich stuetzt (nur vorhandene).');
  L.push('  - Weicht deine Marktmiete um mehr als 15 % vom [marktdurchschnitt] ab, begruende das.');
  L.push('  - Beim Mietausfall stellst du deine Einstufung dem [leerstand_zensus] gegenueber (mit "Zensus 2022").');
  return L.join('\n');
}

async function suggestDs2Fields(payload, opts) {
  const { fields, fieldSpecs, context } = payload;
  const prompt = buildDs2Prompt(payload);

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
    /* v1242 · Quellen sind jetzt eine LISTE. `source` (Einzahl) bleibt
       erhalten, damit aeltere Anzeigen nicht ins Leere greifen — sie
       bekommt den ersten Eintrag. Ohne URL ist eine Quelle trotzdem eine
       Quelle; erfundene URLs sind schlimmer als keine.

       v1242c · Der Gegenlauf gegen Huellhorst hat gezeigt, warum das Wort
       im Etikett nicht reicht: das reasoning sagte richtig „kein amtlicher
       Mietspiegel fuer Huellhorst" — und die einzige Quelle hiess
       „Mietspiegel Huellhorst 2026", von immoportal.com. Ein kommerzielles
       Portal. Eine Anzeige, die auf /mietspiegel/i hervorhebt, macht daraus
       optisch den amtlichen. Deshalb entscheidet jetzt ein eigenes Feld
       `amtlich` — und eine Portal-Domain kann es nicht tragen, egal wie das
       Etikett lautet. */
    /* v1242e · Die Sperrliste aus v1242c/d verliert immer. Der naechste Lauf
       brachte miete-aktuell.de — wieder ein Portal, wieder nicht auf der
       Liste, wieder unter dem Namen „Mietspiegel Huellhorst 2026". Es gibt
       beliebig viele Portale und genau eine amtliche Stelle je Ort. Also
       wird die Frage umgedreht: nicht „ist das ein bekanntes Portal?",
       sondern „kann dieser Host ueberhaupt amtlich sein?" Amtsfaehig ist
       ein Host, der den Ortsnamen traegt (huellhorst.de, bielefeld.de,
       kreis-minden-luebbecke.de) oder zu einer amtlichen Stelle gehoert
       (IHK, bund.de, destatis, IT.NRW, Statistische Landesaemter). Alles
       andere kann sich „Mietspiegel" nennen, wie es will. */
    const _ortWorte = String(context.ort || '')
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 4; });
    const _AMTSSTELLEN = /(\.ihk\.de|\.bund\.de|destatis\.de|it\.nrw|statistik[a-z-]*\.[a-z]{2,}|\.landkreis|landkreis-|kreis-|\.stadt-|stadt-|gemeinde-|\.de\/rathaus|haus-und-grund|hausundgrund)/i;
    const _amtsfaehig = function (url) {
      if (!url) return false;
      let host = '';
      try { host = new URL(url).hostname.toLowerCase(); } catch (e) { return false; }
      const hostFlach = host.replace(/-/g, '');
      if (_ortWorte.some(function (w) { return hostFlach.indexOf(w.replace(/-/g, '')) >= 0; })) return true;
      return _AMTSSTELLEN.test(host);
    };
    const _PORTALE = /(ohne-makler|immobilien\.net|immoportal|immowelt|immobilienscout|immoscout|immonet|wohnungsboerse|homeday|mietspiegel\.(com|net|org)|meinestadt|wohnen-im-alter|kalaydo|ebay|miete-aktuell|wohnpreis|mietpreise\.|immopreise|immo-?kompass|capital\.de|wohnungsmarkt24)/i;
    /* v2500 · Bewertungs- und Datenanbieter nie namentlich (CLAUDE.md) */
    const _ANBIETER = /(sprengnetter|pricehubble|geomap|on-?geo|f\+b|empirica|bulwiengesa|value ag|vdp research|europace|homeday)/i;
    const _quellen = (function () {
      const roh = Array.isArray(sugg.sources) ? sugg.sources : [];
      const out = [];
      roh.forEach(function (q) {
        if (!q) return;
        const label = (typeof q === 'string' ? q : (q.label || q.title || q.name || '')).toString().trim().slice(0, 120);
        if (!label) return;
        let url = (typeof q === 'object' && q.url ? String(q.url).trim() : '');
        if (url && !/^https?:\/\//i.test(url)) url = '';
        let amtlich = !!(typeof q === 'object' && (q.amtlich === true || q.amtlich === 'true'));
        /* Eine Portal-Domain ist nie amtlich. Und wo das Modell selbst sagt,
           es gebe keinen amtlichen Mietspiegel, darf keine Quelle einen
           behaupten — der Widerspruch wird zugunsten der Aussage aufgeloest. */
        /* v1242e: amtlich braucht jetzt einen amtsfaehigen Host — die
           Portalpruefung bleibt als zweite Schranke fuer Faelle ohne URL. */
        if (amtlich && url && !_amtsfaehig(url)) amtlich = false;
        if (amtlich && url && _PORTALE.test(url)) amtlich = false;
        if (amtlich && _PORTALE.test(label)) amtlich = false;
        if (amtlich && /kein\s+(amtlicher|offizieller)\s+mietspiegel/i.test(String(sugg.reasoning || ''))) amtlich = false;
        if (out.some(function (x) { return x.label === label; })) return;
        /* v1242d · Auch das ETIKETT wird richtiggestellt, nicht nur die
           Auszeichnung. Der Lauf gegen Huellhorst lieferte eine
           ImmobilienScout24-Preisstatistik unter dem Namen „Mietspiegel
           Huellhorst 2026". Wer das liest, liest einen Mietspiegel — und
           einen solchen gibt es dort nicht. Ein Mietspiegel ist nach
           §§ 558c/558d BGB eine Uebersicht der ortsueblichen
           Vergleichsmiete, erstellt von der Gemeinde oder gemeinsam von
           den Interessenvertretern. Eine Portal-Preisstatistik ist das
           nicht, egal wie ihre Seite heisst. Also wird sie benannt, was
           sie ist. */
        let anzeige = label;
        if (!amtlich && /mietspiegel/i.test(label) && !_amtsfaehig(url)) {
          /* Der Herausgeber steht in der Domain, nicht in einer Liste. */
          let herkunft = '';
          try {
            herkunft = new URL(url).hostname.toLowerCase()
              .replace(/^www\./, '').replace(/\.(de|com|net|org|eu|info)$/, '');
          } catch (e) { herkunft = ''; }
          const bekannt = {
            'immobilienscout24': 'ImmobilienScout24', 'immowelt': 'Immowelt',
            'immonet': 'Immonet', 'immoportal': 'immoportal', 'homeday': 'Homeday',
            'wohnungsboerse': 'Wohnungsboerse', 'miete-aktuell': 'miete-aktuell.de'
          };
          void bekannt; void herkunft;   /* v2500: der Portalname geht nicht mehr nach aussen */
          anzeige = label.replace(/mietspiegel/ig, 'Mietpreisuebersicht').slice(0, 120);
        }
        /* ══ v2500 · KEIN PORTALNAME NACH AUSSEN (Marcel 14.10.2026) ═══════
           „bitte auch keine Quelle wie ImmobilienScout angeben" - bis hierher
           haengte v1242d den Portalnamen sogar an („Mietpreisuebersicht
           (ImmobilienScout24)") und verlinkte die Portalseite. Eine
           Portalquelle heisst jetzt „Aktueller Marktdurchschnitt
           (Angebotsmieten)", ohne Link; Etikett und Link bleiben nur im
           Server-Protokoll. Mehrere Portale fallen zu EINEM Eintrag zusammen. */
        const _istAnbieter = !amtlich && (_ANBIETER.test(label) || _ANBIETER.test(url));
        /* Die Liste verliert immer (v1242e): der erste echte Lauf von v2500
           brachte ohne-makler.net. Also zusaetzlich die Umkehrung - eine nicht
           amtliche Quelle mit Link auf einen nicht amtsfaehigen Host, die von
           Miete, Angeboten oder Preisen spricht, ist eine Marktquelle. */
        const _marktHost = !amtlich && url && !_amtsfaehig(url) && /miet|angebot|preis|markt/i.test(label + ' ' + url);
        const _istPortal = !amtlich && (_istAnbieter || _marktHost || _PORTALE.test(url) || _PORTALE.test(label));
        let _url = url;
        if (_istPortal) {
          const _jahr = (label.match(/\b(20\d\d)\b/) || [])[1];
          anzeige = _istAnbieter
            ? 'Unabhängiger Bewertungspartner' + (_jahr ? ' (' + _jahr + ')' : '')
            : 'Aktueller Marktdurchschnitt (Angebotsmieten' + (_jahr ? ', ' + _jahr : '') + ')';
          _url = '';
          console.log('[v2500 ds2-suggest] Portalquelle neutralisiert: ' + label + (url ? ' ' + url : ''));
        }
        /* v2500b · Dubletten auch bei abweichender Schreibweise (zweiter Lauf: zweimal Marktdurchschnitt) */
        const _flach = function (t) { return String(t).toLowerCase().replace(/stand|[^a-z0-9äöü]/g, ''); };
        if (out.some(function (x) { return _flach(x.label) === _flach(anzeige); })) return;
        const e = { label: anzeige };
        if (_url) e.url = _url;
        if (amtlich) e.amtlich = true;
        out.push(e);
      });
      if (!out.length && sugg.source) out.push({ label: String(sugg.source).slice(0, 120) });
      return out.slice(0, 6);
    })();
    /* v1242d · Der Kurzname kommt aus der BEREINIGTEN Liste, nicht mehr roh
       aus sugg.source — sonst traegt er weiter „Mietspiegel Huellhorst 2026",
       waehrend die Liste daneben schon „Mietpreisuebersicht (ImmobilienScout24)"
       sagt. Zwei Namen fuer dieselbe Quelle sind schlimmer als der falsche
       allein. */
    /* v2500 · auch der Text: ein Portal- oder Anbietername im Satz wird
       ersetzt, nicht nur in der Quellenliste. */
    const _neutral = function (t) {
      return String(t || '')
        .replace(/\b(ImmobilienScout\s?24|Immobilien\s?Scout\s?24|ImmoScout\s?24|ImmoScout|Immowelt|Immonet|immoportal|Wohnungsb(oe|ö)rse|Homeday|meinestadt(\.de)?|miete-aktuell(\.de)?|mietspiegel\.(com|net|org)|wohnpreis(\.de)?)\b/gi, 'aktueller Marktdurchschnitt')
        .replace(/\b(Sprengnetter|PriceHubble|GeoMap|on-geo)\b/gi, 'unabhängiger Bewertungspartner');
    };
    const _quelleKurz = _neutral(((_quellen[0] && _quellen[0].label) || sugg.source || 'KI-Marktbewertung').toString()).slice(0, 80);
    /* v2500 · die zwei neuen Felder - nur mit Belegen im Prompt verlangt */
    const _BELEG_SCHLUESSEL = ['amtliche_vergleichsmiete', 'marktdurchschnitt', 'marktueblichkeitsband', 'ertragswert_miete', 'ist_miete', 'leerstand_zensus', 'bevoelkerung'];
    const _zusatz = {};
    if (payload.mietbelege) {
      /* Der Text ist an den NUTZER gerichtet: der Wert der Recherche ist nicht "dein" Wert,
         und Enum-Schluessel (sehr_niedrig) gehoeren in Worte (gemessen im zweiten Lauf). */
      if (sugg.vergleich_text) _zusatz.vergleich_text = _neutral(sugg.vergleich_text)
        .replace(/^Dein(e)? (Wert|Einstufung)/, function (x, e, w) { return w === 'Wert' ? 'Der Pilot-Wert' : 'Die Pilot-Einstufung'; })
        .replace(/sehr_niedrig/g, 'sehr niedrig').replace(/erhoeht/g, 'erhöht')
        .slice(0, 400);
      if (Array.isArray(sugg.stuetzt_sich_auf)) {
        _zusatz.stuetzt_sich_auf = sugg.stuetzt_sich_auf.map(String).filter(function (k, i, a) {
          return _BELEG_SCHLUESSEL.indexOf(k) >= 0 && a.indexOf(k) === i;
        });
      }
    }
    if (spec && Array.isArray(spec.values)) {
      if (spec.values.indexOf(sugg.value) >= 0) {
        cleaned[fid] = Object.assign({
          value: sugg.value,
          reasoning: _neutral(sugg.reasoning).slice(0, 200),
          source: _quelleKurz,
          sources: _quellen
        }, _zusatz);
      }
    } else {
      const n = typeof sugg.value === 'number' ? sugg.value : parseFloat(sugg.value);
      if (!isNaN(n)) {
        cleaned[fid] = Object.assign({
          value: n,
          reasoning: _neutral(sugg.reasoning).slice(0, 200),
          source: _quelleKurz,
          sources: _quellen
        }, _zusatz);
      }
    }
  });


  /* v1242c · Die URLs sind ungeprueft, solange sie niemand abruft. Der
     Gegenlauf lieferte https://www.bielefeld.de/mietspiegel und
     https://atlasbig.de/plz-33604 — plausibel gebaut, aber niemand hat
     nachgesehen. Ein Link, der ins Leere fuehrt, ist schlimmer als kein
     Link: er sieht aus wie ein Beleg. Also einmal anklopfen. Wer nicht
     antwortet, behaelt sein Etikett und verliert den Link — die Quelle
     bleibt lesbar, sie ist nur nicht mehr anklickbar. */
  await _quellenUrlsPruefen(cleaned);

  return { success: true, model: r.model, suggestions: cleaned };
}

async function _quellenUrlsPruefen(cleaned) {
  const urls = new Set();
  Object.keys(cleaned).forEach(function (fid) {
    (cleaned[fid].sources || []).forEach(function (q) { if (q.url) urls.add(q.url); });
  });
  if (!urls.size) return;

  const lebt = new Map();
  await Promise.all(Array.from(urls).slice(0, 12).map(async function (u) {
    /* HEAD zuerst — viele Verwaltungsseiten mögen es, manche antworten
       darauf mit 405. Dann GET hinterher, aber abgebrochen, sobald der
       Status da ist; der Rumpf interessiert nicht. */
    for (const methode of ['HEAD', 'GET']) {
      try {
        const res = await fetch(u, {
          method: methode,
          redirect: 'follow',
          signal: AbortSignal.timeout(3000),
          headers: { 'User-Agent': 'DealPilot-Quellenpruefung/1.0' }
        });
        if (res.status === 405 || res.status === 501) continue;
        lebt.set(u, res.status >= 200 && res.status < 400);
        return;
      } catch (e) {
        if (methode === 'GET') lebt.set(u, false);
      }
    }
  }));

  Object.keys(cleaned).forEach(function (fid) {
    (cleaned[fid].sources || []).forEach(function (q) {
      if (q.url && lebt.get(q.url) === false) delete q.url;
    });
  });
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
    'MIETE (NUR falls der Bericht Mietdaten enthaelt, z.B. Sprengnetter-Mietgutachten; sonst weglassen/null — NICHTS erfinden):',
    '  - marktmiete_qm: Marktmiete (Nettokaltmiete) pro m² in Euro (Zahl)',
    '  - marktmiete_monat: Marktmiete (Nettokaltmiete) pro Monat in Euro (Zahl)',
    '',  // V356-marktmiete
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
    '  LAGE-/MARKT-EINSTUFUNG (fuer Investor-Score) — wenn der Bericht nur einen Gesamt-Score oder ein Label fuer Makro-/Mikrolage nennt, leite die Stufe daraus ab:',
    '  - makrolage: genau einer von [sehr_schwach, schwach, durchschnittlich, gut, sehr_gut]',
    '  - mikrolage: genau einer von [sehr_schwach, schwach, durchschnittlich, gut, sehr_gut]',
    '  - bevoelkerung_entwicklung: Bevoelkerungs-ENTWICKLUNG (kein Einwohner-Wert), genau einer von [stark_wachsend, wachsend, stabil, leicht_fallend, stark_fallend]',
    '  - nachfrage: genau einer von [sehr_stark, stark, mittel, schwach, sehr_schwach]',
    '  - wertsteigerung: genau einer von [sehr_hoch, hoch, mittel, niedrig, keines]',
    '  - entwicklung: Entwicklungs-/Stadtentwicklungs-Moeglichkeiten, genau einer von [mehrere, eine_starke, begrenzt, kaum, keine]',
    '  WICHTIG: Lass makrolage, mikrolage, bevoelkerung_entwicklung, nachfrage, wertsteigerung und entwicklung NIE leer. Stehen sie nicht ausdruecklich im Bericht, schaetze den plausibelsten Wert aus Ort/Region, Lage-Scores und Gesamtkontext des Berichts ab (es sind ueberschreibbare Vorschlaege fuer den Nutzer). Nur wenn gar kein Ortsbezug erkennbar ist, gib null zurueck.',  // v381-ds2-estimate  // v374-ds2-extract
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
    '  - kueche_zustand: String (z.B. "Neu / kürzlich modernisiert", "Gut in Stand gehalten", "Renovierungsbedürftig")',
    '  - bad_zustand: String',
    '  - boden_zustand: String',
    '  - fenster_zustand: String',
    '  - badezimmer: Number (Anzahl Badezimmer)',
    '  - etage: Number (Etage der Wohnung)',
    '  - etagen: Number (Anzahl Etagen im Gebäude)',
    '  - modernisierungsjahr: Number (Jahr der letzten Modernisierung)',
    '  - garagen: Number (Anzahl Garagen-/Tiefgaragenplätze)',
    '  - stellplatz_aussen: Number (Anzahl Außenstellplätze)',
    '  - balkon_flaeche: Number (Fläche Balkon/Terrasse in m²)',
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
  ['adresse','plz','ort','objektart','bewertungsdatum','konfidenz','makrolage','mikrolage','bevoelkerung_entwicklung','nachfrage','wertsteigerung','entwicklung',
   'kueche_qualitaet','bad_qualitaet','boden_qualitaet','fenster_qualitaet','kueche_zustand','bad_zustand','boden_zustand','fenster_zustand','badezimmer','etage','etagen','modernisierungsjahr','garagen','stellplatz_aussen','balkon_flaeche','energie_label'
  ].forEach(k => {
    if (ext[k] != null && ext[k] !== '') cleaned[k] = String(ext[k]).trim();
  });
  // Zahl-Felder (inkl. negative für Wertentwicklungs-%-Werte)
  ['wohnflaeche','grundstuecksflaeche','baujahr','sanierungsjahr','zimmer',
   'verkehrswert','verkehrswert_min','verkehrswert_max','preis_pro_qm',
   'lage_geraeusch','lage_einkaufen','lage_bildung','lage_gastronomie','lage_gesundheit','lage_freizeit',
   'wertentwicklung_3jahre_pct','wertentwicklung_1jahr_pct','prognose_naechstes_jahr_pct',
   'markt_durchschnittspreis','markt_tage_auf_dem_markt',
   'bevoelkerung','arbeitslosenquote_pct','wanderungssaldo',
   'marktmiete_qm','marktmiete_monat'  /* V356-marktmiete */
  ].forEach(k => {
    const v = ext[k];
    if (v == null || v === '') return;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (!isNaN(n)) cleaned[k] = n;
  });
  return { success: true, model: r.model, extracted: cleaned };
}

/**
 * v361-enrich-market-fields: Fehlende Lage-Felder nach Marktbericht-Import per KI ermitteln.
 * Bekommt den PDF-Volltext + Liste fehlender Feld-IDs. Leitet jedes Feld ZUERST
 * aus dem Bericht ab; nur was dort nicht steht, wird per web_search recherchiert.
 * Gibt pro Feld { value, herkunft: 'kontext'|'kontext+ki', text } zurueck.
 *
 * @param {string} text     PDF-Volltext (gekuerzt)
 * @param {string[]} fields Feld-IDs aus: makrolage, mikrolage, ds2_bevoelkerung,
 *                          ds2_nachfrage, ds2_wertsteigerung, ds2_entwicklung
 * @param {object} context  { adresse, plz, ort, ... }
 */
async function enrichMarketFields(text, fields, context, opts) {
  opts = opts || {};
  context = context || {};
  const ENUMS = {
    makrolage:          ['sehr_schwach','schwach','durchschnittlich','gut','sehr_gut'],
    mikrolage:          ['sehr_schwach','schwach','durchschnittlich','gut','sehr_gut'],
    ds2_bevoelkerung:   ['stark_wachsend','wachsend','stabil','leicht_fallend','stark_fallend'],
    ds2_nachfrage:      ['sehr_stark','stark','mittel','schwach','sehr_schwach'],
    ds2_wertsteigerung: ['sehr_hoch','hoch','mittel','niedrig','keines'],
    ds2_entwicklung:    ['mehrere','eine_starke','begrenzt','kaum','keine']
  };
  const LABELS = {
    makrolage: 'Makrolage (Stadt/Region: Bevoelkerung, Wirtschaft, Arbeitsmarkt)',
    mikrolage: 'Mikrolage (Stadtteil: OEPNV, Infrastruktur, Wohnumfeld)',
    ds2_bevoelkerung: 'Bevoelkerungsentwicklung der Region',
    ds2_nachfrage: 'Nachfrage = Vermarktungsdauer der Kaufangebote (bis 30 / 60 / 120 / 200 Tage)',   /* v2518 */
    ds2_wertsteigerung: 'Mittelfristiges Wertsteigerungs-Potenzial',
    ds2_entwicklung: 'Entwicklungs-Moeglichkeiten / Stadtentwicklungs-Plaene'
  };
  const want = (Array.isArray(fields) ? fields : []).filter(f => ENUMS[f]);
  if (!want.length) return { success: true, model: null, suggestions: {} };

  const adresse = context.adresse || [context.str, context.hnr, context.plz, context.ort].filter(Boolean).join(' ');
  const dimLines = want.map((f, i) => {
    return (i + 1) + '. ' + f + ' (' + LABELS[f] + ')\n   ENUM-Werte: ' + ENUMS[f].map(v => '"' + v + '"').join(' | ');
  }).join('\n\n');

  const prompt = [
    'Du bist Immobilien-Marktexperte. Du bekommst den TEXT eines Immobilien-Marktberichts',
    'und sollst fehlende Lage-Einschaetzungen fuer ein Objekt ermitteln.',
    '',
    'OBJEKT-ADRESSE: ' + (adresse || '(nicht angegeben)'),
    '',
    'VORGEHEN PRO FELD (strikt einhalten):',
    '1. Pruefe ZUERST, ob sich der Wert AUS DEM BERICHTSTEXT ableiten laesst',
    '   (direkt genannt ODER klar aus Zahlen/Aussagen im Text herleitbar).',
    '   Wenn ja: setze "herkunft": "kontext".',
    '2. Nur wenn der Bericht dazu NICHTS hergibt: recherchiere im Web (web_search)',
    '   fuer die genannte Adresse/Region und kombiniere mit dem Bericht.',
    '   Dann: setze "herkunft": "kontext+ki".',
    '3. Der BERICHT ist immer fuehrend. Web-Funde duerfen Bericht-Aussagen NICHT widersprechen.',
    '',
    'WICHTIG:',
    '- Fuer jedes Feld GENAU einen der vorgegebenen ENUM-Strings als "value".',
    '- Erfinde keine eigenen Werte, keine freien Zahlen.',
    '- Wenn ein Feld gar nicht bestimmbar ist: "value": null.',
    '',
    'FELDER:',
    '',
    dimLines,
    '',
    'Antwort STRIKT als JSON, kein Markdown:',
    '{',
    '  "suggestions": {',
    '    "<feldId>": { "value": "<enum>", "herkunft": "kontext"|"kontext+ki", "text": "1 kurzer Satz Begruendung" }',
    '  }',
    '}',
    '',
    '─── MARKTBERICHTS-TEXT ───',
    String(text || '').slice(0, 12000)
  ].join('\n');

  const r = await callOpenAI(prompt, Object.assign({ maxTokens: 2000 }, opts));
  const parsed = extractJson(r.text);
  if (!parsed || !parsed.suggestions) {
    return { success: false, error: 'KI-Antwort konnte nicht ausgewertet werden.', raw_text: r.text };
  }
  const cleaned = {};
  want.forEach(f => {
    const s = parsed.suggestions[f];
    if (!s || s.value == null || s.value === '') return;
    if (ENUMS[f].indexOf(s.value) < 0) return;   // Enum-Schutz
    let herkunft = (s.herkunft === 'kontext+ki') ? 'kontext+ki' : 'kontext';
    cleaned[f] = {
      value: s.value,
      herkunft: herkunft,
      text: (s.text || '').toString().slice(0, 200)
    };
  });
  return { success: true, model: r.model, suggestions: cleaned };
}

/* v585-copilot BEGIN */
/**
 * Co-Pilot — leichter Chat-Agent. Reused callOpenAI (web_search_preview ist dort
 * immer angehaengt, wird aber per System-Prompt gesteuert):
 *   - allowWeb=false  -> Prompt verbietet Web-Suche, weist Nutzer an, sie zu aktivieren.
 *   - allowWeb=true   -> Web-Suche erlaubt, nur bei Bedarf.
 * KEIN Kerosin-Abzug (Aufrufer zieht nichts ab) — server-seitig rate-limited.
 * Modell: COPILOT_MODEL (.env) oder Default gpt-4.1-mini.
 */
/* ── v1704d · ZAEHLPARAMETER AUS DEN LINKS ───────────────────────────
   Marcel hatte das am 29.09.2026 an der Pilot-Analyse gemeldet: „Da steht
   auch hinten irgendwie UTM Unterstrich Source gleich OpenAI." Behoben
   wurde es damals in `ui.js` (`_urlSauber`) - aber nur fuer die
   STRUKTURIERTEN Quellenfelder der JSON-Analyse.

   Gemessen am Portfolio-Piloten, direkt nach dem Bau:
     ([miete-aktuell.de](https://www.miete-aktuell.de/...?utm_source=openai))

   Im Chat stehen die Links im Fliesstext, dort kam die Saeuberung nie an.

   > Ein Fehler, der an einer Stelle behoben ist, ist nicht behoben. Er
   > ist an EINER Stelle behoben - und die anderen Wege sehen aus wie
   > neue Fehler, obwohl es derselbe ist.

   Deshalb sitzt es jetzt im Backend, hinter `copilotChat`: damit gilt es
   fuer den Co-Pilot im Tab Objekt, den Hilfe-Assistenten und den
   Portfolio-Piloten auf einmal - drei Aufrufer, eine Saeuberung.

   Entfernt werden nur Zaehl- und Herkunftsparameter. Ein Parameter, der
   den INHALT bestimmt, bliebe sonst auf der Strecke und der Link liefe
   ins Leere. */
const _ZAEHLPARAM = /^(utm_[a-z_]+|gclid|fbclid|msclkid|igshid|mc_cid|mc_eid|ref|referrer|source)$/i;

function _urlsSaeubern(text) {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/https?:\/\/[^\s<>()\[\]"']+/gi, function (roh) {
    /* Satzzeichen am Ende gehoeren zum Satz, nicht zur Adresse. */
    var schwanz = '';
    var m = roh.match(/[.,;:!?]+$/);
    if (m) { schwanz = m[0]; roh = roh.slice(0, -schwanz.length); }
    try {
      var u = new URL(roh);
      var weg = [];
      u.searchParams.forEach(function (_v, k) { if (_ZAEHLPARAM.test(k)) weg.push(k); });
      if (!weg.length) return roh + schwanz;
      weg.forEach(function (k) { u.searchParams.delete(k); });
      var s = u.toString();
      /* Ein leer gewordenes `?` sieht aus wie ein Tippfehler. */
      if (s.slice(-1) === '?') s = s.slice(0, -1);
      return s + schwanz;
    } catch (e) { return roh + schwanz; }
  });
}

async function copilotChat(payload, opts) {
  opts = opts || {};
  payload = payload || {};
  const ctx = payload.context && typeof payload.context === 'object' ? payload.context : {};
  const history = Array.isArray(payload.history) ? payload.history.slice(-12) : [];
  const message = String(payload.message || '').trim();
  const allowWeb = payload.allowWeb === true;

  /* v1704: derselbe Endpunkt traegt jetzt zwei Kontexte - ein Einzelobjekt
     und das ganze Portfolio. Der Diskriminator steht VOR dem Systemtext,
     weil der Systemtext ihn braucht. */
  const istPortfolio = payload.kontextArt === 'portfolio'
    || (ctx && ctx.art === 'portfolio');

  /* ═══ v1767 · DAS BEISPIEL WIRD AUS DEM KATALOG GEBAUT ══════════════
     Gemessen am 01.10.2026 mit Marcels eigenem Satz („aender bei der
     Musterstrasse 12 mal die Zimmeranzahl auf fuenf"):

       <<<FELDER {"feld_id":"zimmer","anderes_feld":"5"} FELDER>>>

     Das Modell hat die PLATZHALTER meines Formatbeispiels fuer feste
     Schluessel gehalten und Feld-Id und Wert als zwei Werte eingesetzt.
     Es stand `{"feld_id":"wert","anderes_feld":"wert"}` dort - fuer ein
     kleines Modell (hier gpt-4o-mini) ist das eine Schablone mit zwei
     benannten Spalten, kein Muster.

     > Ein Platzhalter in einem Beispiel ist eine Einladung, ihn
     > abzuschreiben. Steht dort eine ECHTE Feld-Id, kann das Abschreiben
     > nicht mehr schiefgehen.

     Deshalb: das Beispiel kommt aus dem mitgeschickten Katalog. */
  const _bspBlock = (function () {
    const f = Array.isArray(payload.felder) ? payload.felder : [];
    const t = f.find((x) => x.kind === 'text');
    const s = f.find((x) => x.kind === 'select' && x.options && x.options.length);
    const b = {};
    if (t) b[t.id] = '850';
    if (s) b[s.id] = String(s.options[0]);
    return Object.keys(b).length ? JSON.stringify(b) : '{"nkm":"850"}';
  })();

  /* v2010 - auch der Co-Pilot und der Portfolio-Pilot lesen jetzt das
     Projektwissen. Er steht als ERSTER Systemblock: ueber alle
     Anfragen gleich, also die richtige Stelle fuer den Prompt-Cache. */
  /* v2019b - mit Marcels Ergaenzung, wenn der Aufrufer sie mitgibt. */
  const _pw = (opts && opts.wissensblock) || projektwissen.block();
  const sys = [
    _pw ? _pw : '',
    istPortfolio
      ? 'Du bist der DealPilot Portfolio-Pilot, ein sachlicher KI-Assistent fuer Immobilien-Investmentanalyse. Du siehst das GESAMTE Portfolio des Nutzers: seine Vermoegensbilanz und jedes einzelne Objekt darin.'
      : 'Du bist der DealPilot Co-Pilot, ein sachlicher KI-Assistent fuer Immobilien-Investmentanalyse.',
    'Antworte praezise, auf Deutsch, in du-Form, ohne Floskeln und ohne Markdown-Ueberschriften.',
    'Nutze die bereitgestellten Objekt- und Kennzahlendaten als PRIMAERE Quelle. Rechne wo sinnvoll mit den',
    'gegebenen Zahlen (DSCR, LTV, Cashflow, Renditen, Kaufpreis). Erfinde keine Werte; fehlt etwas, sag es klar.',
    allowWeb
      ? 'Web-Recherche ist FREIGEGEBEN: nutze das web_search-Tool nur, wenn die Frage aktuelle externe Marktdaten erfordert, die nicht in den Objektdaten stehen. Nenne keine internen Anbieter-Namen.'
      : 'Web-Recherche ist NICHT freigegeben: recherchiere NICHT im Web und rufe KEIN Such-Tool auf. Wenn die Frage externe oder aktuelle Marktdaten braucht, die nicht in den Daten stehen, erklaere in 1-2 Saetzen was dir fehlt und bitte den Nutzer, oben den Schalter \u201eWeb-Recherche\u201c zu aktivieren.',
    /* v1703: der Nutzer kann jetzt im Chat eine Marktpreis-Indikation
       abrufen (Knopf \u201eMarktpreis \u00b7 1 Abruf"). Steht sie im Kontext, ist
       sie die beste Zahl, die es gibt - sie kommt von einem
       Bewertungspartner, nicht aus einem Formularfeld.

       ANBIETER-NEUTRALITAET: CLAUDE.md sagt \u201eSprengnetter und
       PriceHubble nie namentlich nach aussen". */
    'MARKTPREIS-INDIKATION: Steht im Kontext ein Feld "marktpreis_indikation", dann wurde sie soeben bei einem',
    'unabhaengigen Bewertungspartner abgerufen. Nutze sie als VORRANGIGEN Vergleichsanker fuer Kaufpreis-Einordnung,',
    'Miete und Verhandlung - vor allgemeinen Annahmen. Nenne sie immer als "Indikation", NIE als Verkehrswert oder',
    'Gutachten, und nenne die Spanne mit. Nenne NIEMALS einen Anbieternamen: die Quelle heisst "unabhaengiger',
    'Bewertungspartner". Ist das Feld nicht da und die Frage braucht einen Marktpreis, weise in EINEM Satz auf den',
    'Knopf \u201eMarktpreis \u00b7 1 Abruf\u201c oben hin - und rate keine Zahl.',
    /* v1704: die Regeln, die nur fuer das Portfolio gelten. Sie stehen
       hier und nicht im Frontend-Auftrag, weil sie auch fuer jede
       Rueckfrage danach gelten muessen - nicht nur fuer die Analyse. */
    istPortfolio
      ? [
          '',
          'PORTFOLIO-REGELN (verbindlich):',
          '- "vermoegensbilanz" ist die Summe ueber ALLE Objekte, bereits ausgerechnet. Rechne sie NICHT nach und',
          '  stelle ihr keine eigene Summe gegenueber - du wuerdest gegen dieselben Zahlen anders rechnen.',
          '- "objekte" ist die Einzelaufstellung. Sprich Objekte mit ihrem "name" an, nie mit ihrer Nummer allein.',
          '- Steht "objekte_im_payload" unter "anzahl_objekte", hast du NICHT alle Objekte vor dir: die',
          '  Vermoegensbilanz umfasst dann mehr als deine Liste. Sage das, bevor du Einzelobjekte gegen die Summe',
          '  stellst - sonst behauptest du eine Vollstaendigkeit, die du nicht hast.',
          '- "projektion" ist eine Modellfortschreibung, keine Prognose: sie unterstellt gleichbleibende Miete,',
          '  Zins und Tilgung. Nenne sie so, wenn du sie verwendest.',
          '- Die Einheit steht IM Feldnamen (_eur, _eur_jahr, _prozent, _qm). Lies sie dort ab, rate sie nicht.',
          '- Fehlt ein Feld (null), ist es nicht erfasst - nicht null. Sage, was fehlt, statt es zu ueberspringen.',
          /* v2014 - die sechs neuen Felder zur Substanz. Ohne diese Zeile
             stehen sie zwar im Auftrag, werden aber als weitere Zahlen
             gelesen statt als Risikotraeger. */
          '- Je Objekt stehen jetzt auch "lageklasse" (A/B/C), "zustand", "energieklasse",',
          '  "leerstand_pct", "wohneinheiten" und "bodenrichtwert_eur_qm". Nutze SIE fuer die',
          '  Klumpenrisiken: Lage ueber lageklasse und bodenrichtwert (nicht nur ueber den Ort),',
          '  Substanz ueber zustand und energieklasse, Ertragssicherheit ueber leerstand_pct.',
          '- Haeufen sich schlechte Energieklassen oder renovierungsbeduerftige Objekte, ist das',
          '  ein Sanierungs-Klumpen - benenne ihn mit Namen und Anzahl.',
          /* v2164 - der Auszug der Einzel-Analysen. Ohne diese Zeile waere er
             nur weiterer Text im Kontext (Lehre v2014). */
          '- Je Objekt steht "pilot_analyse": ein AUSZUG der Pilot-Analyse dieses Objekts (Empfehlung,',
          '  Fazit, Top-Risiken/-Staerken, Steuer) mit ihrem Stand. Nutze ihn fuer "welche tragen, welche',
          '  belasten" und fuer Klumpenrisiken (gleiche Risiken bei mehreren Objekten). Ist er null, gibt es',
          '  fuer das Objekt keine Analyse - sage das. Ist der Stand alt, sage, dass die Einschaetzung aelter ist',
          '  als die Zahlen. Die Zahlen im Objekt gehen vor, wenn sie dem Auszug widersprechen.'
        ].join('\n')
      : '',

    /* ═══ v1764 · DER CO-PILOT DARF FELDER AENDERN ═══════════════════════
       Marcel am 01.10.2026, nach einem echten Versuch:

         „Kannst du den Zustand der Wohnung auf stark
          renovierungsbeduerftig aendern?"
         -> „Ich kann den Zustand der Wohnung nicht aendern, da keine
             Werte erfinden oder anpassen kann."

       Zwei Fehler lagen darin, beide meine. Der Filter im Frontend
       verlangte eine ZAHL - „stark renovierungsbeduerftig" ist aber ein
       Auswahlwert. Und selbst wenn er durchgekommen waere: das Modell
       wusste gar nicht, dass es das darf. Es hat die Regel „erfinde keine
       Werte" auf eine ANWEISUNG des Nutzers angewandt.

       > Einen Wert zu erfinden und einen anzunehmen, den der Nutzer
       > gerade nennt, ist nicht dasselbe. Die erste Regel schuetzt vor
       > Behauptung, die zweite waere Gehorsamsverweigerung.

       Deshalb bekommt das Modell den Feldkatalog und einen klaren
       Auftrag. Es entscheidet selbst, ob eine Nachricht eine Frage oder
       eine Anweisung ist - das kann es besser als jedes Muster im
       Frontend. Geaendert wird trotzdem nichts ohne Bestaetigung: das
       Modell SCHLAEGT VOR, der Nutzer entscheidet. */
    (Array.isArray(payload.felder) && payload.felder.length)
      ? [
          '',
          'FELDER AENDERN (verbindlich):',
          'Der Nutzer kann dich bitten, Angaben am Objekt zu aendern - z. B. "aendere die Miete auf 850",',
          '"der Zustand ist stark renovierungsbeduerftig", "trag bitte Baujahr 1968 ein".',
          'Das ist KEIN Erfinden: der Nutzer nennt den Wert, du ordnest ihn nur dem richtigen Feld zu.',
          'Erkennst du eine solche Anweisung, haenge an deine Antwort GENAU EINEN Block in dieser Form an:',
          '',
          '<<<FELDER',
          _bspBlock,
          'FELDER>>>',
          '',
          '- Der SCHLUESSEL ist die Feld-Id aus der Liste unten, der WERT ist der neue Inhalt.',
          '  Es gibt KEINEN Schluessel namens "feld_id", "feld", "id", "wert" oder "value" -',
          '  wer so etwas schreibt, hat das Beispiel missverstanden.',
          '- Verwende NUR Feld-Ids aus der Liste VERFUEGBARE FELDER unten, nie erfundene.',
          istPortfolio
            ? '- Der Nutzer nennt im Portfolio das Objekt dazu ("bei der Musterstr. 12 ..."). '
              + 'Die Feld-Ids sind bei allen Objekten dieselben - nenne das Objekt in deinem '
              + 'Satz davor, damit der Nutzer sieht, welches gemeint ist.'
            : '- Es ist immer das Objekt gemeint, das unter AKTUELLES OBJEKT steht.',
          '- Bei einem Auswahlfeld (kind=select) nimm WOERTLICH eine der angegebenen Optionen.',
          '- Zahlen ohne Tausenderpunkt und ohne Einheit: 850, nicht "850 EUR" und nicht "1.250".',
          '- Bist du dir bei der Zuordnung unsicher, frag nach und haenge KEINEN Block an.',
          '- Ist es eine normale Frage, antworte normal und haenge KEINEN Block an.',
          '- Schreibe im Text davor in EINEM Satz, was du eintragen wuerdest. Behaupte NICHT,',
          '  dass es schon geaendert sei - der Nutzer bestaetigt es erst.',
          '',
          'VERFUEGBARE FELDER (id | Bezeichnung | Art):',
          payload.felder.slice(0, 220).map(function (f) {
            return '  ' + f.id + ' | ' + String(f.label || '').slice(0, 48)
              + ' | ' + (f.kind || 'text')
              + (f.options && f.options.length
                  ? ' [' + f.options.slice(0, 12).join(' / ') + ']' : '');
          }).join('\n')
        ].join('\n')
      : '',

    /* ═══ v1766 · ABRUFE AUSLOESEN - MIT KOSTENANSAGE ══════════════════
       Marcels V4/V5: „auch Marktberichte oder Wertermittlungen dort
       ausfuehren ... Er sagt dann was es kostet und wieviel Kontingent
       wir noch haben."

       GEMESSEN, nicht geraten: jeder Abruf kostet GENAU 1 - `cost` ist in
       `ai_credits_log` immer 1 (aiCreditsService.js:363). Verschieden
       sind nicht die Preise, sondern die GUTHABENARTEN: mpi, mpi_plus,
       wev. Der Bestand kommt aus GET /ai/credits und wird vom Frontend
       mitgeschickt - das Modell rechnet ihn nicht aus.

       > Bei Geld wird nicht geschaetzt. Steht der Bestand nicht im
       > Auftrag, nennt das Modell auch keinen - lieber keine Zahl als
       > eine erfundene. */
    (payload.abrufe && payload.abrufe.length)
      ? [
          '',
          'ABRUFE AUSLOESEN (verbindlich):',
          'Der Nutzer kann dich bitten, einen kostenpflichtigen Abruf zu starten',
          '("hol mir eine Marktpreis-Indikation", "mach einen Marktbericht").',
          'Erkennst du das, haenge an deine Antwort GENAU EINEN Block an:',
          '',
          '<<<ABRUF',
          '{"name":"<name aus der Liste>"}',
          'ABRUF>>>',
          '',
          '- Nenne im Text davor, WAS es kostet und WIEVIEL noch da ist - beides steht',
          '  unten in der Liste. Erfinde KEINE Zahl und rechne nichts um.',
          '- Ist das Guthaben 0, haenge KEINEN Block an, sondern sage es.',
          '- Fuehre nichts aus und behaupte nicht, es sei schon geschehen: der Nutzer',
          '  bestaetigt den Abruf erst.',
          '- Bei einer normalen Frage: kein Block.',
          '',
          'VERFUEGBARE ABRUFE (name | was es ist | kostet | noch frei):',
          payload.abrufe.map(function (a) {
            return '  ' + a.name + ' | ' + a.titel + ' | 1 ' + a.art
              + ' | ' + (a.rest == null ? 'unbekannt' : a.rest);
          }).join('\n')
        ].join('\n')
      : '',

    /* ═══ v1769 · DIE MARKTBERICHTE (Backlog V6) ══════════════════════
       Marcel: „Wichtig ist auch, dass sich beide Piloten immer auch zum
       Objekt bei der Pilot-Analyse oder dem ganzen Bestand beim
       Portfolio-Piloten den Marktbericht oder die Berichte holen und
       alles abgleichen."

       Der Weg dorthin war seit v942 zu: `objects/history` machte
       `parseInt()` auf eine UUID und antwortete mit HTTP 400. Migration
       015 und `_uidAus()` haben ihn geoeffnet (v1769).

       ABGLEICHEN HEISST BENENNEN, NICHT RECHNEN. Der Marktbericht und
       die Objektkalkulation sind zwei Quellen zur selben Groesse. Eine
       dritte, gemittelte Zahl waere eine Behauptung, die in keiner von
       beiden steht.

       > Zwei Zahlen zur selben Groesse sind kein Widerspruch, solange
       > beide ihre Herkunft tragen. Eine dritte, gemittelte waere einer. */
    (payload.marktberichte && typeof payload.marktberichte === 'object')
      ? [
          '',
          'MARKTBERICHTE (verbindlich):',
          istPortfolio
            ? 'Unter "MARKTBERICHTE ZUM BESTAND" steht je Objekt der JUENGSTE '
              + 'DealPilot-Marktbericht.'
            : 'Unter "MARKTBERICHT ZUM OBJEKT" steht der juengste DealPilot-'
              + 'Marktbericht zu diesem Objekt.',
          /* v1769c · GEMESSEN am 02.10.2026: auf die Frage „wie viele meiner
             Objekte haben einen Marktbericht" antwortete das Modell „8" —
             im Auftrag stand `objekte_mit_bericht: 21`, und alle 21 Saetze
             trugen einen Marktwert. Es hat die Liste gezaehlt statt die
             Zahl zu lesen, und sich verzaehlt.

             Fuer die Vermoegensbilanz steht diese Regel schon oben
             („Rechne sie NICHT nach"). Fuer die Berichte fehlte sie.

             > Eine Zahl, die im Auftrag steht, soll gelesen werden, nicht
             > nachgezaehlt. Wer zaehlt, kann sich verzaehlen — und das
             > Ergebnis sieht genauso aus wie ein gelesenes. */
          istPortfolio
            ? '- "objekte_mit_bericht" und "berichte_gesamt" sind BEREITS AUSGEZAEHLT. '
              + 'Lies sie ab und zaehle die Liste NICHT selbst nach; bei einer '
              + 'Abweichung gilt die angegebene Zahl.'
            : '- "vorhanden" ist die Zahl der Berichte zu diesem Objekt, bereits '
              + 'ausgezaehlt. Lies sie ab.',
          '- Diese Marktwerte stammen aus dem BERICHT, nicht aus der Kalkulation.',
          '  Weichen sie ab, nenne BEIDE Zahlen und sage, woher jede kommt.',
          '- Rechne KEINE dritte Zahl aus und bilde kein Mittel. Eine gemittelte',
          '  Zahl steht in keiner der beiden Quellen.',
          istPortfolio
            ? '- Bilde auch keine Summe ueber die Berichts-Marktwerte: die '
              + 'Vermoegensbilanz ist die Summe, und sie rechnet anders.'
            : '- "bericht_id" ist die Nummer des Berichts; nenne sie, wenn du dich '
              + 'auf ihn beziehst.',
          '- Fehlt ein Feld, ist es im Bericht nicht erfasst. Sage das, statt es zu',
          '  ueberspringen - und erfinde es nicht aus der Kalkulation.',
          '- Steht dort "abruf": "fehlgeschlagen", konnte ich die Berichte NICHT',
          '  laden. Sage das ausdruecklich; es ist nicht dasselbe wie "es gibt keine".',
          '- Die Einheit steht IM Feldnamen (_eur, _eur_qm, _prozent, _qm).',
          '',
          (istPortfolio ? 'MARKTBERICHTE ZUM BESTAND' : 'MARKTBERICHT ZUM OBJEKT')
            + ' (JSON):',
          JSON.stringify(payload.marktberichte, null, 1)
        ].join('\n')
      : ''
  ].filter(Boolean).join('\n');

  /* v1704: ohne den Diskriminator stuende „AKTUELLES OBJEKT" ueber einer
     Vermoegensbilanz - und das Modell antwortet auf die Ueberschrift.

     > Eine Beschriftung ist kein Schmuck. Sie sagt dem Modell, was es vor
     > sich hat, und eine falsche belegt es mit einer Annahme, die durch
     > keine Zahl im Datensatz widerlegt wird. */
  const ctxBlock = (istPortfolio
    ? 'GESAMTES PORTFOLIO DES NUTZERS (Kontext, JSON):\n'
    : 'AKTUELLES OBJEKT (Kontext, JSON):\n') + JSON.stringify(ctx, null, 2);

  let convo = '';
  for (const m of history) {
    const role = (m && m.role === 'assistant') ? 'Co-Pilot' : 'Nutzer';
    convo += role + ': ' + String((m && m.content) || '').trim() + '\n';
  }
  convo += 'Nutzer: ' + message + '\nCo-Pilot:';

  /* v2188 · DER TOWER SCHICKT DIE HILFE MIT
     Der Pilot (frontend/js/pilot-tower.js) sucht vor der KI-Frage selbst
     in Hilfe, Feld-Erklaerungen und Ablaeufen und schickt die besten
     Treffer als `hilfe` mit. Bis hier kannte der Co-Pilot die Hilfetexte
     der App nicht - er beantwortete Bedienfragen aus allgemeinem Wissen.
     Begrenzt auf 8 Eintraege a 1.200 Zeichen: es ist ein Auszug, kein
     zweites Handbuch im Prompt. */
  const _hilfe = Array.isArray(payload.hilfe) ? payload.hilfe.slice(0, 8) : [];
  const hilfeBlock = _hilfe.length
    ? 'AUSZUG AUS DER DEALPILOT-HILFE (zur Frage gefunden):\n'
      + _hilfe.map(function (h) {
        return '- [' + String((h && h.art) || '').slice(0, 30) + '] ' + String((h && h.titel) || '').slice(0, 120)
          + ': ' + String((h && h.text) || '').slice(0, 1200);
      }).join('\n')
      + '\nBei Fragen zur BEDIENUNG der App (wo, wie, was passiert wenn) ist dieser Auszug die'
      + ' massgebliche Quelle: nenne Reiter und Knopf so, wie sie dort heissen, und erfinde keine'
      + ' Menuepunkte. Steht die Antwort nicht darin, sag das und rate keinen Weg.\n\n'
    : '';
  const prompt = sys + '\n\n' + hilfeBlock + ctxBlock + '\n\n--- Gespraech ---\n' + convo;
  /* v1329: war gpt-4.1-mini - abgekuendigt zum 11.12.2026. */
  const model = opts.model || process.env.COPILOT_MODEL || 'gpt-5.6-luna';

  const res = await callOpenAI(prompt, {
    userApiKey: opts.userApiKey,
    model: model,
    aiOptions: { temperature: 0.4 }
  });
  return { reply: _urlsSaeubern(res.text), model: res.model, allowWeb: allowWeb };
}
/* v585-copilot END */

/* ─────────────────────────────────────────────────────────────────────
 * v1008-beleg: Vision-Extraktion für den KI-Beleg-Import.
 * Nutzt dieselbe Responses-API wie callOpenAI, aber mit Bild-Input
 * (input_image) und OHNE web_search. Gibt strukturiertes JSON je Beleg.
 * ───────────────────────────────────────────────────────────────────── */
async function _callOpenAIVision(contentParts, opts) {
  opts = opts || {};
  const apiKey = config.openai.apiKey || opts.userApiKey || null;
  const keySource = config.openai.apiKey ? 'server' : (opts.userApiKey ? 'user' : 'none');
  if (!apiKey) {
    const err = new Error('Kein OpenAI-API-Key verfügbar.');
    err.code = 'NO_API_KEY';
    throw err;
  }
  const model = opts.model || config.openai.defaultModel;
  const body = {
    model: model,
    input: [{ role: 'user', content: contentParts }],
    max_output_tokens: opts.maxTokens || 700
  };
  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify(Object.assign({ store: false }, body))   /* v2209 */
  });
  if (!resp.ok) {
    const txt = await resp.text();
    const err = new Error('OpenAI API Fehler ' + resp.status + ': ' + txt.slice(0, 300));
    err.status = resp.status;
    err.keySource = keySource;
    throw err;
  }
  const data = await resp.json();
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
  return { text: (text || '').trim(), raw: data, model: model };
}

const _BELEG_KATEGORIEN = ['Notar & Grundbuch', 'Maklergebühr', 'Grunderwerbsteuer', 'Fahrtkosten', 'Verpflegung', 'Unterkunft', 'Handwerker / Sanierung', 'Material / Sanierung', 'Herstellungskosten (Erweiterung)', 'Sonstiges'];

const _BELEG_PROMPT =
  'Du liest EIN Bild einer Seite mit deutschen Kauf-/Kostenbelegen im Immobilien-Kontext: ' +
  'Rechnungen, Quittungen, Notar-, Grundbuch-, Makler-, Handwerkerbelege, Sammelrechnungen ' +
  'UND Buchhaltungs-/Kontenlisten (OPOS-Konto / Rechnungswesen / Kontoauszug). Das Bild kann gedreht sein - lies es trotzdem. ' +
  'Gib AUSSCHLIESSLICH ein JSON-Objekt zurueck, ohne Vorrede, ohne Markdown:\n' +
  '{"positionen":[{"datum":"TT.MM.JJJJ oder null","aussteller":"string oder null","betrag_netto":Zahl oder null,"ust_betrag":Zahl oder null,"ust_satz":19 oder 7 oder 0 oder null,"betrag_brutto":Zahl oder null,"kategorie":"eine aus der Liste","konfidenz":"hoch oder mittel oder niedrig","beschreibung":"kurzer Hinweis"}]}\n' +
  'Regeln:\n' +
  '- ZUERST PRUEFEN - Buchhaltungs-/OPOS-/Kontenliste? Merkmale: Kopf wie "OPOS-Konto"/"Rechnungswesen"/"Kontenanzeige", ' +
  'Spalten "Betrag Soll"/"Betrag Haben", und eine FUSSZEILE mit "JVZ Soll" und "JVZ Haben" (oft daneben "Summe offene Posten"/"EB-Wert"). ' +
  'Wenn ja: IGNORIERE alle Einzelzeilen und gib GENAU EINE Position fuer die Seite zurueck: ' +
  'datum = das Jahr (z.B. "2020"), aussteller = der Firmen-/Kontoname, ' +
  'betrag_brutto = der Zahlenwert bei "JVZ Soll", betrag_netto = null, ust_betrag = null, ' +
  'kategorie = "Material / Sanierung" (Baustoffe/Handwerk) sonst "Sonstiges", ' +
  'beschreibung = "OPOS <Jahr> - JVZ Soll <Wert> / JVZ Haben <Wert>". Lies die beiden Fusszeilen-Werte GENAU ab, erfinde nichts. ' +
  'Pro Seite also nur EINE Position, keine Einzelrechnungen.\n' +
  '- NUR wenn es KEINE solche Liste ist (normale Belege/Quittungen/Rechnungen): lies ALLE erkennbaren Belege, ' +
  'mehrere getrennte Quittungen im Bild -> je eine Position; Sammelrechnung -> Zeilen derselben Kategorie zu einer Summenposition, ' +
  'Gesamtsumme nicht doppelt zu den Einzelposten.\n' +
  '- betrag_brutto (bei normalen Belegen) = Gesamt-/Endbetrag ("Insgesamt"/"Total"/"Summe"/Rechnungsbetrag). ' +
  'Wenn nur Brutto und "X MwSt inbegriffen" dasteht: ust_betrag = X, betrag_netto = brutto - X.\n' +
  '- Betraege als Dezimalzahl mit Punkt (1234.56), ohne Waehrungszeichen.\n' +
  '- Kategorie exakt eine aus: ' + _BELEG_KATEGORIEN.join(', ') + '.\n' +
  '- Nicht sicher lesbar -> null und konfidenz "niedrig". Erfinde nichts.';

/* ═══════════════════════════════════════════════════════════════════════
   v1406 · ZWEITER MODUS: LAUFENDE WERBUNGSKOSTEN
   ═══════════════════════════════════════════════════════════════════════
   Marcel: „da waere schon cool, wenn wir jetzt, ich sage jetzt mal, eine
   Nebenkostenabrechnung oder Hausgeld oder keine Ahnung, Belege da reingeben
   koennten und der teilt das passend auf."

   Der Beleg-Import von v1008 zielt auf ANSCHAFFUNGSKOSTEN — Notar, Makler,
   Grunderwerbsteuer. Das ist der Kauf. Was hier dazukommt, ist das LAUFENDE
   Jahr: Hausgeld, Nebenkostenabrechnung, Verwaltergebuehr, Grundsteuer.

   DER UNTERSCHIED IST NICHT NUR DIE LISTE, SONDERN DIE AUFTEILUNG. Eine
   Hausgeldabrechnung ist EIN Beleg mit DREI verschiedenen Sorten Kosten:

     umlagefaehig      Heizung, Wasser, Muell, Hausmeister, Versicherung.
                       Sie sind Werbungskosten UND Einnahme (durchlaufend).
     nicht umlagefaehig Verwaltergebuehr, Bankgebuehren, nicht umlegbare
                       Instandhaltung. Nur Werbungskosten.
     Erhaltungsruecklage  Die ZUFUEHRUNG ist KEINE Werbungskost. Abziehbar
                       wird sie erst, wenn die Gemeinschaft das Geld
                       tatsaechlich fuer Erhaltung ausgibt (BFH IX R 19/24).
                       Das ist der Punkt, an dem die meisten Selbstrechner
                       zu viel ansetzen — deshalb gibt es dafuer eine eigene
                       Kategorie, die ausdruecklich NICHT in ein Feld fliesst.

   Genau diese drei auseinanderzuhalten ist die Arbeit, die der Nutzer sonst
   von Hand macht.                                                          */
const _WK_KATEGORIEN = [
  'Nebenkosten umlagefähig', 'Nebenkosten nicht umlagefähig',
  'Erhaltungsrücklage (nicht absetzbar)', 'Hausverwaltung',
  'Erhaltungsaufwand / Reparatur', 'Grundsteuer', 'Versicherung',
  'Schuldzinsen', 'Kontoführung', 'Steuerberatung',
  'Fahrtkosten', 'Inserat / Vermietung', 'Porto & Telefon',
  'Gericht & Rechtsanwalt', 'Sonstiges',
];

const _WK_PROMPT =
  'Du liest EIN Bild einer Seite mit deutschen Belegen zur VERMIETUNG einer Immobilie: ' +
  'Hausgeldabrechnung, Wohngeldabrechnung, Nebenkostenabrechnung, Verwalterabrechnung, ' +
  'Grundsteuerbescheid, Versicherungsrechnung, Handwerkerrechnung, Zinsbescheinigung. ' +
  'Das Bild kann gedreht sein - lies es trotzdem. ' +
  'Gib AUSSCHLIESSLICH ein JSON-Objekt zurueck, ohne Vorrede, ohne Markdown:\n' +
  '{"positionen":[{"datum":"TT.MM.JJJJ oder null","jahr":JJJJ oder null,"aussteller":"string oder null",' +
  '"betrag_netto":Zahl oder null,"ust_betrag":Zahl oder null,"ust_satz":19 oder 7 oder 0 oder null,' +
  '"betrag_brutto":Zahl oder null,"kategorie":"eine aus der Liste",' +
  '"konfidenz":"hoch oder mittel oder niedrig","beschreibung":"kurzer Hinweis"}]}\n' +
  'Regeln:\n' +
  '- HAUSGELD- ODER NEBENKOSTENABRECHNUNG? Dann NICHT eine Summe zurueckgeben, sondern AUFTEILEN. ' +
  'Solche Abrechnungen weisen die Aufteilung fast immer selbst aus - such nach Spalten oder Abschnitten ' +
  'wie "umlagefaehig"/"umlegbar"/"auf Mieter umlagefaehig" gegen "nicht umlagefaehig"/"nicht umlegbar" ' +
  'und nach "Instandhaltungsruecklage"/"Erhaltungsruecklage"/"Ruecklagenzufuehrung". ' +
  'Gib dann GETRENNTE Positionen zurueck: eine fuer die Summe der umlagefaehigen Kosten ' +
  '(kategorie "Nebenkosten umlagefähig"), eine fuer die nicht umlagefaehigen ' +
  '(kategorie "Nebenkosten nicht umlagefähig"), eine fuer die Verwaltergebuehr, wenn sie einzeln ausgewiesen ist ' +
  '(kategorie "Hausverwaltung"), und eine fuer die Ruecklagenzufuehrung ' +
  '(kategorie "Erhaltungsrücklage (nicht absetzbar)").\n' +
  '- WICHTIG: Die Zufuehrung zur Erhaltungs-/Instandhaltungsruecklage IMMER als eigene Position mit genau ' +
  'dieser Kategorie ausweisen, auch wenn sie in der Abrechnung unter den Kosten steht. Sie ist beim ' +
  'Eigentuemer NICHT sofort abziehbar. Niemals in die Nebenkosten einrechnen.\n' +
  '- Steht die Aufteilung NICHT in der Abrechnung, gib die Gesamtsumme als EINE Position mit der Kategorie ' +
  '"Nebenkosten nicht umlagefähig" und konfidenz "niedrig" zurueck, und schreibe in die beschreibung, ' +
  'dass die Abrechnung keine Aufteilung ausweist. Rate die Aufteilung NICHT.\n' +
  '- Betrifft die Abrechnung eine EINZELNE Wohnung innerhalb einer Gemeinschaft, nimm den Betrag DIESER ' +
  'Wohnung (Spalte "Ihr Anteil"/"Anteil Einheit"), nicht die Summe der ganzen Gemeinschaft. ' +
  'Steht beides da, nimm den Anteil und vermerke es in der beschreibung.\n' +
  '- "jahr" ist das ABRECHNUNGSJAHR, auf das sich der Beleg bezieht - bei einer Hausgeldabrechnung ' +
  'also das abgerechnete Wirtschaftsjahr, NICHT das Datum der Erstellung. Steht kein Jahr da, null.\n' +
  '- Normale Einzelrechnungen (Handwerker, Versicherung, Grundsteuer): je eine Position, ' +
  'betrag_brutto = Gesamt-/Endbetrag.\n' +
  '- Eine Handwerkerrechnung ist "Erhaltungsaufwand / Reparatur" - es sei denn, sie schafft etwas NEUES ' +
  '(Anbau, Ausbau, Erweiterung), dann "Sonstiges" mit einem Hinweis in der beschreibung.\n' +
  '- Betraege als Dezimalzahl mit Punkt (1234.56), ohne Waehrungszeichen.\n' +
  '- Kategorie exakt eine aus: ' + _WK_KATEGORIEN.join(', ') + '.\n' +
  '- Nicht sicher lesbar -> null und konfidenz "niedrig". Erfinde nichts.';

async function _extractBelegPage(image, opts) {
  /* v1406: zwei Prompts, eine Mechanik. `modus` entscheidet, ob der Beleg
     als Anschaffungskost oder als laufende Werbungskost gelesen wird. */
  const _prompt = (opts.modus === "wk") ? _WK_PROMPT : _BELEG_PROMPT;
  const content = [{ type: "input_text", text: _prompt }, { type: "input_image", image_url: image }];
  const r = await _callOpenAIVision(content, { userApiKey: opts.userApiKey, model: opts.model, maxTokens: 4000 });
  const parsed = extractJson(r.text);
  if (parsed == null) { throw new Error('JSON-Parse (Antwort evtl. zu dicht/abgeschnitten)'); }
  let pos = Array.isArray(parsed) ? parsed
          : (Array.isArray(parsed.positionen) ? parsed.positionen
          : ((parsed && (parsed.betrag_brutto != null || parsed.betrag_netto != null || parsed.aussteller)) ? [parsed] : []));
  return Array.isArray(pos) ? pos : [];
}

/**
 * v1008-beleg: extractBeleg — liest EIN Dokument (1..n Seiten) per Vision, EINE
 * Vision-Anfrage PRO SEITE (begrenzt parallel), und aggregiert alle Positionen.
 * So werden lange PDFs (Rechnungslisten) und dichte Tabellen vollstaendig gelesen.
 * @returns { positionen: [...] }
 */
async function extractBeleg(images, opts) {
  opts = opts || {};
  const imgs = (images || []).slice(0, 30);
  const out = new Array(imgs.length);
  const err = new Array(imgs.length);
  const CONC = 4;
  let next = 0;
  async function worker() {
    while (next < imgs.length) {
      const my = next++;
      try { out[my] = await _extractBelegPage(imgs[my], opts); }
      catch (e) { out[my] = []; err[my] = (e && e.message) ? String(e.message).slice(0, 120) : 'Fehler'; }
    }
  }
  const runners = [];
  for (let w = 0; w < Math.min(CONC, imgs.length); w++) runners.push(worker());
  await Promise.all(runners);
  let pos = []; let errN = 0; let firstErr = '';
  out.forEach(function (r, i) {
    if (Array.isArray(r) && r.length) { pos = pos.concat(r); }
    else if (err[i]) { errN++; if (!firstErr) firstErr = err[i]; }
  });
  let diag = imgs.length + ' Seite(n)';
  if (!pos.length) { diag += ', 0 Treffer'; if (errN) diag += ' - ' + errN + ' Seite(n) mit Fehler: ' + firstErr; }
  return { positionen: pos, pages: imgs.length, diag: diag };
}


/**
 * v1678 — extractDokument: eine beliebige Dokumentart einlesen.
 *
 * Löst den Einzelfall `extractRndg` (v1677) ab und bedient alle neun
 * Arten aus `dokumentSchemas.js`. Die Schemata stammen aus dem
 * Import-Modul v1.1.0; kommt eine neue Modulfassung, wird nur dort
 * nachgezogen — diese Funktion bleibt unverändert.
 *
 * Zwei Regeln sind hier eingebaut, beide teuer bezahlt:
 *
 * 1. **Zahlen werden geprüft, nicht übernommen.** `Number(null)` ist 0
 *    und besteht `Number.isFinite` — erst auf Abwesenheit prüfen. Jedes
 *    Schema führt seine Grenzen; ein Bodenrichtwert von 4 Mio €/m² ist
 *    ein Lesefehler, keine Lage.
 * 2. **Fehlende Pflichtangaben werden benannt, nicht überbrückt.** Genau
 *    das hat bei der Kaufpreisaufteilung (v1669) eine um Faktor 2,9
 *    falsche Antwort erzeugt, die plausibel aussah.
 */
async function extractDokument(text, typ, opts) {
  const prompt = dokumentSchemas.baueprompt(typ, text);
  if (!prompt) {
    return { success: false, error: 'Unbekannte Dokumentart: ' + typ };
  }
  const spec = dokumentSchemas.SCHEMATA[typ];

  const r = await callOpenAI(prompt, Object.assign({ maxTokens: 1400 }, opts || {}));
  const parsed = extractJson(r.text);
  if (!parsed) {
    return { success: false, error: 'KI-Antwort konnte nicht ausgewertet werden.', raw_text: r.text };
  }
  const ext = parsed.extracted || parsed;

  /* Zahlenfelder gegen die Grenzen des Schemas prüfen. Was durchfällt,
     wird null UND gemeldet — stillschweigend verworfene Werte sind der
     Fehler, den wir gerade erst behoben haben.                       */
  const verworfen = [];
  const grenzen = spec.zahlen || {};
  Object.keys(grenzen).forEach(function (feld) {
    if (!(feld in ext)) return;
    const roh = ext[feld];
    if (roh === null || roh === undefined || roh === '') { ext[feld] = null; return; }
    const n = Number(roh);
    const g = grenzen[feld];
    if (!Number.isFinite(n) || n < g[0] || n > g[1]) {
      verworfen.push({ feld: feld, wert: roh, erwartet: g[0] + ' bis ' + g[1] });
      ext[feld] = null;
    } else {
      ext[feld] = n;
    }
  });

  const fehlend = (spec.pflicht || []).filter(function (f) {
    return ext[f] === null || ext[f] === undefined || ext[f] === '';
  });

  return {
    success: true,
    model: r.model,
    typ: typ,
    label: (dokumentSchemas.DOKUMENT_TYPEN[typ] || {}).label || typ,
    extracted: ext,
    rechenbar: fehlend.length === 0,
    fehlende_pflichtfelder: fehlend,
    verworfene_werte: verworfen
  };
}

/**
 * v1677 — extractRndg: Restnutzungsdauergutachten einlesen.
 * Bleibt als eigener Weg bestehen, weil der RND-Assistent ihn ruft.
 *
 * Das Schema stammt WÖRTLICH aus dem Import-Modul v1.1.0
 * (`import_service.py`, `EXTRAKTIONS_PROMPTS['rndg']`). Damit ist die
 * Brücke gebaut, um die es ging: das Modul liefert die EXTRAKTION,
 * DealPilot rechnet. Kommt eine neue Modulfassung, muss nur dieses
 * Schema nachgezogen werden — die Rechnung bleibt, wo sie hingehört.
 *
 * `rnd_jahre` wird mitgelesen, obwohl wir sie selbst rechnen: nur so
 * lässt sich die eigene Rechnung gegen das Gutachten halten. Eine
 * übernommene Zahl, die niemand gegenprüft, ist eine Behauptung.
 */
async function extractRndg(text, opts) {
  const prompt = [
    'Aus dem folgenden deutschen Restnutzungsdauergutachten extrahiere die',
    'Kernzahlen als JSON. Wenn ein Feld nicht auffindbar ist: null.',
    '',
    'Schema:',
    '{',
    '  "gutachten_nr": string,',
    '  "objekt_adresse": string,',
    '  "baujahr": number,',
    '  "bewertungsstichtag": string im Format DD.MM.JJJJ,',
    '  "gnd_jahre": number (Gesamtnutzungsdauer),',
    '  "rnd_jahre": number (Restnutzungsdauer laut Gutachten),',
    '  "modernisierungspunkte": number (0 bis 20, Anlage 2 ImmoWertV),',
    '  "verfahren_gewaehlt": string, einer von "Linear"/"Punktraster"/"Technisch",',
    '  "ausstattung": {"veraltet_pct": number, "standard_pct": number, "gehoben_pct": number}',
    '}',
    '',
    'Antworte NUR mit JSON.',
    '',
    'RNDG:',
    text
  ].join('\n');

  const r = await callOpenAI(prompt, Object.assign({ maxTokens: 900 }, opts || {}));
  const parsed = extractJson(r.text);
  if (!parsed) {
    return { success: false, error: 'KI-Antwort konnte nicht ausgewertet werden.', raw_text: r.text };
  }
  const ext = parsed.extracted || parsed;

  /* Number(null) ist 0 und besteht Number.isFinite — deshalb erst auf
     Abwesenheit prüfen, dann rechnen. Steht so in CLAUDE.md.          */
  function zahl(v, min, max) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (min != null && n < min) return null;
    if (max != null && n > max) return null;
    return n;
  }

  const out = {
    gutachten_nr:          ext.gutachten_nr || null,
    objekt_adresse:        ext.objekt_adresse || null,
    bewertungsstichtag:    ext.bewertungsstichtag || null,
    verfahren_gewaehlt:    ext.verfahren_gewaehlt || null,
    baujahr:               zahl(ext.baujahr, 1500, 2100),
    gnd_jahre:             zahl(ext.gnd_jahre, 10, 120),
    rnd_jahre:             zahl(ext.rnd_jahre, 0, 120),
    modernisierungspunkte: zahl(ext.modernisierungspunkte, 0, 20),
    ausstattung:           (ext.ausstattung && typeof ext.ausstattung === 'object') ? ext.ausstattung : null
  };

  /* Was fehlt, damit der Kern rechnen kann — benannt, nicht geraten.
     Ein Import, der stillschweigend mit Standardwerten weiterrechnet,
     liefert kein falsches Ergebnis, sondern ein richtig aussehendes
     (derselbe Fehler wie bei der Kaufpreisaufteilung, v1669).        */
  const fehlend = [];
  if (out.baujahr == null) fehlend.push('baujahr');
  if (out.gnd_jahre == null) fehlend.push('gnd_jahre');
  out.rechenbar = fehlend.length === 0;
  out.fehlende_pflichtfelder = fehlend;

  return { success: true, model: r.model, extracted: out };
}

/* ── v1796 · Bild -> Text, mehr nicht ────────────────────────────────────
 *
 * Der Telegram-Bot bekommt Fotos: ein abfotografiertes Exposé, ein
 * Screenshot aus einem Portal, ein Seitenausschnitt.
 *
 * Es waere naheliegend, dafuer einen dritten Auslese-Weg zu bauen (neben
 * `extractFromText` und `extractFromAudio`). Das waere einer zu viel:
 *
 *   > Drei Wege zu denselben Feldern weichen irgendwann in drei
 *   > Richtungen ab. Zwei davon merkt niemand.
 *
 * Deshalb tut diese Funktion nur EINEN Schritt — sie macht aus dem Bild
 * Text. Was daraus ein Objektfeld wird, entscheidet danach derselbe
 * `extractFromText`, den auch Sprache und Tastatur durchlaufen. Dieselbe
 * Schablonen-Heilung, dieselbe Prozent-Falle, dieselbe Adresspruefung.
 */
async function bildZuText(imageDataUrl, opts) {
  const o = opts || {};
  const prompt =
    'Gib den fuer eine Immobilienbewertung relevanten Inhalt dieses Bildes '
    + 'als FLIESSTEXT wieder. Nenne Adresse, Objektart, Wohnflaeche, '
    + 'Grundstuecksflaeche, Zimmer, Baujahr, Kaufpreis, Miete, Hausgeld und '
    + 'alles Weitere, was dasteht.\n\n'
    + 'ERFINDE NICHTS. Was du nicht sicher lesen kannst, laesst du weg. '
    + 'Schreibe keine Einleitung und keine Bewertung, nur den Inhalt. '
    + 'Ist auf dem Bild nichts Immobilienbezogenes zu sehen, antworte genau '
    + 'mit: KEIN_INHALT';
  const content = [
    { type: 'input_text', text: prompt },
    { type: 'input_image', image_url: imageDataUrl }
  ];
  const r = await _callOpenAIVision(content, {
    userApiKey: o.userApiKey, model: o.model, maxTokens: 2000
  });
  const t = String((r && r.text) || '').trim();
  if (!t || /^KEIN_INHALT/i.test(t)) return '';
  return t;
}

module.exports = {
  copilotChat,  /* v585 */
  bildZuText,   /* v1796 — macht nur Text; die Felder macht extractFromText */
  analyze,
  analyzeLage,
  suggestDs2Fields,
  buildDs2Prompt,     /* v2500 · fuer tools/prompt-lecks-pruefen.mjs */
  suggestQcFields,
  extractExpose,
  extractMarketData,
  enrichMarketFields,
  buildPrompt,
  callOpenAI,
  extractBeleg,
  extractRndg,       /* v1677 */
  extractDokument,   /* v1678 */
  _analyseQuellenNeutral,   /* v2972 · fuer den Pruefer */
  extractJson
};
