'use strict';
/* services/agentWerkzeuge.js — was der Agent tun darf (v1801)
 *
 * Marcel am 02.10.2026: "Also wirklich ein schlauer Agent, der halt genau
 * weiss, was er da machen muss."
 *
 * ── DIE GRENZE, DIE JEDE ZEILE HIER EINHAELT ─────────────────────────────
 *
 *   > Die KI darf entscheiden, WAS GETAN WIRD — nie, WAS WAHR IST.
 *
 * Kein Werkzeug rechnet. Sie lesen aus der Datenbank, aus dem
 * Portfolio-Spiegel oder rufen eine vorhandene Systemfunktion. Was das
 * Modell zurueckbekommt, ist das, was dasteht — nicht das, was es sich
 * denkt.
 *
 * Das ist nicht Vorsicht, sondern Erfahrung: `projectAll` rechnete
 * jahrelang in Cent, und aufgefallen ist es erst, als eine zweite Quelle
 * danebenstand. Ein Modell, das Kennzahlen selbst ableitet, ist genau so
 * eine zweite Quelle — nur eine, die bei jedem Aufruf anders rechnen kann.
 *
 * ── DREI STUFEN ──────────────────────────────────────────────────────────
 *
 *   lesen      laeuft sofort
 *   schreiben  laeuft sofort, aber NIE still: jedes Schreibwerkzeug
 *              prueft selbst und gibt bei belegten Feldern oder unklaren
 *              Auswahlwerten eine RUECKFRAGE zurueck, statt zu speichern
 *   kostet     laeuft nur, wenn `darfKosten` gesetzt ist — und das setzt
 *              der Webhook, nicht das Modell
 *
 * ── v1809 · HIER STAND EIN VERSPRECHEN, DAS DER CODE NICHT HIELT ─────────
 *
 * Bis v1808 stand hier "schreiben laeuft erst nach einer Bestaetigung im
 * Chat". Gemessen: `agentLauf.js` prueft NUR `stufe === 'kostet'`.
 * Schreibwerkzeuge liefen ohne jede externe Sperre.
 *
 *   > Ein Kommentar, der mehr verspricht als der Code haelt, ist
 *   > gefaehrlicher als gar keiner. Wer ihn liest, hoert auf zu pruefen.
 *
 * Die Sperre fuer Schreibwerkzeuge sitzt deshalb IM Werkzeug und ist
 * inhaltlich: `felder_aendern` schreibt kein belegtes Feld und keinen
 * ungueltigen Auswahlwert, sondern fragt. `objekt_anlegen` legt an — das
 * ist bewusst erlaubt, weil ein neues Objekt nichts ueberschreibt und
 * jederzeit wieder loeschbar ist.
 *
 * Fuer Geld gilt die harte Sperre: sie steht in `agentLauf.js` und das
 * Modell kann sie nicht uebergehen.
 */
const { query } = require('../db/pool');
const dialog = require('./telegramDialogService');
const fuehrung = require('./fuehrungService');
const markt = require('./telegramMarktService');
const objectService = require('./objectService');
const voiceExtract = require('./voiceExtractService');
const vorgaben = require('./botVorgabenService');   /* v1824 */
const rechenkerne = require('./rechenkerne');       /* v1899: DealKpis/Dscr der App */
const bewertungsText = require('./bewertungsText'); /* v1927: die KI-Einordnung */
const avmHistorie = require('./avmHistoryService');  /* v1937: Marktpreisindikation */
const config = require('../config');

/* ═══ LESEN ═══════════════════════════════════════════════════════════ */

async function objekte_liste(ctx) {
  const liste = await dialog.objekteListe(ctx.userId, 60);
  const r = await query(
    `SELECT id,
            (data::jsonb->>'_dealpilot_score')::int   AS score,
            (data::jsonb->>'_ds2_score')::int         AS ids_score,
            COALESCE((data::jsonb->>'_ds2_computed')::boolean,false) AS ids_ok
       FROM objects WHERE user_id = $1`,
    [ctx.userId]);
  const extra = {};
  r.rows.forEach((z) => { extra[z.id] = z; });

  return {
    anzahl: liste.length,
    /* Die Nummer ist die Grundlage fuer "Objekt 17" — sie MUSS stabil
       sein und mit dem uebereinstimmen, was der Nutzer im Chat sieht. */
    objekte: liste.map((o, i) => {
      const e = extra[o.id] || {};
      /* ── v1831 · DIE STUFE GEHOERT ZUR ZAHL ───────────────────────────
       *
       * GEMESSEN am 04.10.2026 an einem echten Lauf: auf dieselbe Frage
       * nannte der Bot den Score 71 einmal "SOLIDE" und einmal "GUT" —
       * in zwei Antworten hintereinander. Richtig ist GUT (ab 70).
       *
       * Die Ursache stand hier: dieses Werkzeug gab nur die ZAHL. Das
       * Wort dazu hat das Modell erfunden, und es erfand es jedes Mal
       * neu.
       *
       *   > Wo das Werkzeug nur eine Zahl liefert, denkt das Modell sich
       *   > das Wort dazu. Was woertlich so heissen soll, gehoert als
       *   > fertiger Wert ins Ergebnis.
       *
       * `stufeZu` ist dieselbe Funktion, die `objekt_kennzahlen` und
       * `objekt_schnellblick` benutzen — ein Weg zur Stufe, nicht drei.
       * Die Kette (85/70/50/35) ist die der Objektkarte. */
      return {
        nummer: i + 1, id: o.id, adresse: o.adresse, kaufpreis_eur: o.kp,
        dealscore: e.score != null ? e.score : null,
        dealscore_stufe: dialog.stufeZu(e.score != null ? e.score : null),
        investor_deal_score: e.ids_ok ? e.ids_score : null,
        investor_stufe: dialog.stufeZu(e.ids_ok ? e.ids_score : null)
      };
    })
  };
}

async function objekt_lesen(ctx, args) {
  const id = await _findeObjekt(ctx, args);
  if (!id) return { gefunden: false, hinweis: 'Kein Objekt zu dieser Angabe gefunden.' };
  const o = await dialog.objektKontext(ctx.userId, id);
  if (!o) return { gefunden: false };
  ctx.merkeObjekt(id);
  const s = dialog.scoreLesen(o.daten);
  return {
    gefunden: true, id: o.objekt_id,
    adresse: [o.daten.str, o.daten.hnr].filter(Boolean).join(' ')
           + (o.daten.ort ? ', ' + [o.daten.plz, o.daten.ort].filter(Boolean).join(' ') : ''),
    kerndaten: dialog.kerndaten(o.daten),
    dealscore: s.dealscore, dealscore_stufe: s.stufe,
    investor_deal_score: s.investor, investor_stufe: s.investorStufe,
    kennzahlen: s.weitere,
    /* Der ganze Datensatz, aber ohne die internen Marker — das Modell
       soll Felder sehen, keine Buchhaltung. */
    felder: _ohneIntern(o.daten),
    stand: o.geaendert
  };
}

/* ═══ v1847 · DIE PILOT-ANALYSE FUER DEN BOT ═══════════════════════════════
 *
 * Marcel am 04.10.2026: „wenn wir die Pilotanalyse gemacht haben, dass die
 * dem Projektwissen zur Verfügung steht, dass der Bot, der Telegram-Bot,
 * die auch abfragen kann."
 *
 * GEMESSEN: die Analyse entsteht aus EINER KI-Antwort (/ai/analyze), wird
 * vollständig als JSON in `objects.ai_analysis` gespeichert, und
 * `dialog.objektKontext()` liest sie seit jeher als `ki_lagebewertung`
 * mit. Elf Aufrufer in dieser Datei — und keiner hat je hineingesehen.
 *
 *   > Der Weg war bis zur letzten Tür gebaut. Es fehlte nur die Klinke.
 *
 * Das ist der Spiegel-Weg, wie er sein soll: gerechnet und bezahlt hat der
 * Browser (eine Analyse, einmal), der Bot LIEST. Er rechnet nichts nach
 * und löst keine neue Anfrage aus — Stufe `lesen`, kostet nichts.
 *
 * Herausgegeben wird nicht der Rohtext (bis zu zehn Kilobyte Modell-JSON),
 * sondern die Abschnitte, die auch die Pilot-Analyse zeigt: Briefing,
 * Stärken, Risiken, Risikoanalyse, Lage, Verhandlung, Bank. Fehlt eine
 * Analyse, steht das da — mit dem Weg dorthin, nicht mit einer Erfindung. */
/* ═══ v1853 · N8 · Der Bankexport über den Bot ═══════════════════════════
 * Marcel: „der bankexport soll auch über den bot abgefragt werden können.
 * So kann man schnell eine übersicht bekommen."
 *
 * Der Bankexport der App ist eine Tabelle, EINE ZEILE JE DARLEHEN
 * (calc.js renderBankTable): Adresse, Art, m², Miete, Bank, Darlehensart,
 * Finanzierungsdatum, Vertragsnr., Summe, Zins, Tilgung, Rate, Bindung,
 * Restschuld. Hier dasselbe aus zwei Quellen, ohne Nachbau:
 *   · die EINGABEN aus objects.data (Bank, Vertrag, Summe, Zins, Tilgung,
 *     Bindung, Daten) — je Darlehen d1/d2;
 *   · die GERECHNETEN Groessen aus dem Portfolio-Spiegel (Restschuld, Zins-
 *     und Tilgungsbetrag je Jahr, Bindung bis) — je Objekt, gerechnet im
 *     Browser. Fehlt der Spiegel, fehlen diese Spalten, und das steht da.
 * Nichts wird hier gerechnet. Stufe `lesen`, kostet nichts. */
async function bank_uebersicht(ctx, args) {
  const r = await query(
    `SELECT id, name, data FROM objects WHERE user_id = $1 ORDER BY seq_no NULLS LAST, created_at`,
    [ctx.userId]);
  const sp = await dialog.portfolioKontext(ctx.userId);
  const spiegel = {};
  if (sp && sp.payload && Array.isArray(sp.payload.objekte)) sp.payload.objekte.forEach((o) => { if (o && o.id) spiegel[String(o.id)] = o; });
  const num = (v) => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const dez = (v) => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const eur = (n) => n == null ? '—' : Math.round(n).toLocaleString('de-DE') + ' EUR';
  const pct = (n) => n == null ? '—' : n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  const zeilen = [], text = [];
  let nr = 0;
  const filter = args && args.adresse ? _flach(String(args.adresse)) : null;
  r.rows.forEach((o) => {
    let d = {}; try { d = typeof o.data === 'string' ? JSON.parse(o.data) : (o.data || {}); } catch (e) { d = {}; }
    const adresse = [d.str, d.hnr].filter(Boolean).join(' ') + (d.ort ? ', ' + [d.plz, d.ort].filter(Boolean).join(' ') : '');
    if (filter && !_flach(adresse + ' ' + (o.name || '')).includes(filter)) return;
    const s = spiegel[String(o.id)] || null;
    [['d1', 'I'], ['d2', 'II']].forEach(([k, roem]) => {
      const summe = num(d[k]);
      if (!(summe > 0)) return;
      nr++;
      const art = (d[k + '_type'] === 'tilgungsaussetzung' ? 'Tilgungsaussetzungsdarlehen' : 'Annuitätendarlehen') + ' ' + roem;
      const z = {
        nr, objekt_id: o.id, adresse, objektart: d.objart || null, wohnflaeche_qm: num(d.wfl),
        bank: d.bank_inst || null, darlehensart: art, vertragsnummer: d[k + '_vertrag'] || null,
        vertragsdatum: d[k + '_vertragsdatum'] || null, auszahlung: d[k + '_auszahl'] || null, kaufdatum: d.kaufdat || null,
        summe_eur: summe, zins_pct: dez(d[k + 'z']), tilgung_pct: dez(d[k + 't']), bindung_jahre: num(d[k + '_bindj']),
        nkm_monat_eur: s && Number.isFinite(Number(s.miete_kalt_eur_jahr)) ? Math.round(Number(s.miete_kalt_eur_jahr) / 12) : (num(d.nkm) || null),
        restschuld_eur: s && Number.isFinite(Number(s.restschuld_eur)) ? Number(s.restschuld_eur) : null,
        rate_monat_eur: s && Number.isFinite(Number(s.zins_eur_jahr)) && Number.isFinite(Number(s.tilgung_eur_jahr))
          ? Math.round((Number(s.zins_eur_jahr) + Number(s.tilgung_eur_jahr)) / 12) : null,
        zinsbindung_bis: s && s.zinsbindung_bis ? s.zinsbindung_bis : null,
        spiegel_vorhanden: !!s
      };
      zeilen.push(z);
      text.push(nr + ' · ' + adresse + (z.objektart ? ' (' + z.objektart + ')' : '') + ' · ' + (z.bank || 'Bank —') + ' · ' + art
        + ' ' + eur(summe) + ' · Zins ' + pct(z.zins_pct) + ' / Tilgung ' + pct(z.tilgung_pct)
        + (z.bindung_jahre ? ' · Bindung ' + z.bindung_jahre + ' J.' + (z.zinsbindung_bis ? ' bis ' + z.zinsbindung_bis : '') : '')
        + (z.vertragsnummer ? ' · Vertrag ' + z.vertragsnummer + (z.vertragsdatum ? ' (' + z.vertragsdatum + ')' : '') : ' · ohne Vertragsnummer')
        + (z.restschuld_eur != null ? ' · Restschuld ' + eur(z.restschuld_eur) : '')
        + (z.rate_monat_eur != null ? ' · Rate ' + eur(z.rate_monat_eur) + '/Monat' : ''));
    });
  });
  if (!zeilen.length) {
    return { anzahl: 0, so_sagen: filter
      ? 'Zu „' + args.adresse + '" finde ich kein Objekt mit Darlehen.'
      : 'Es ist noch kein Darlehen eingetragen — die Bankübersicht entsteht aus den Finanzierungsfeldern der Objekte (Reiter Finanzierung).' };
  }
  const ohneSpiegel = zeilen.filter((z) => !z.spiegel_vorhanden).length;
  return {
    anzahl: zeilen.length,
    stand: sp ? dialog.standSatz(sp.erfasst_am, sp.alter_minuten, sp.geaendert_seitdem) : null,
    so_schreiben: text,
    hinweis: 'Eine Zeile je Darlehen, wie der Bankexport in DealPilot. Betraege in "so_schreiben" '
      + 'sind fertig formatiert - nimm sie unveraendert. Eingaben (Bank, Vertrag, Summe, Zins, Tilgung, Bindung) '
      + 'stammen aus dem Objekt; Restschuld, Rate und "Bindung bis" aus dem Portfolio-Stand, gerechnet in DealPilot'
      + (ohneSpiegel ? '. ' + ohneSpiegel + ' Zeile(n) haben keinen Portfolio-Stand - dort fehlen Restschuld und Rate, erfinde sie nicht.' : '.'),
    so_sagen: ohneSpiegel && !sp ? 'Es liegt kein Portfolio-Stand vor — Restschuld und Rate kann ich erst nennen, wenn DealPilot einmal geöffnet wurde.' : undefined,
    zeilen
  };
}

async function pilot_analyse_lesen(ctx, args) {
  const id = await _findeObjekt(ctx, args);
  if (!id) return { gefunden: false, hinweis: 'Kein Objekt zu dieser Angabe gefunden.' };
  const o = await dialog.objektKontext(ctx.userId, id);
  if (!o) return { gefunden: false };
  ctx.merkeObjekt(id);
  const adresse = [o.daten.str, o.daten.hnr].filter(Boolean).join(' ')
    + (o.daten.ort ? ', ' + [o.daten.plz, o.daten.ort].filter(Boolean).join(' ') : '');

  const roh = o.ki_lagebewertung;
  if (!roh) {
    return { gefunden: true, id: o.objekt_id, adresse: adresse, analyse_vorhanden: false,
      so_sagen: 'Für dieses Objekt liegt noch keine Pilot-Analyse vor. Sie wird in '
              + 'DealPilot im Reiter „Pilot-Analyse" mit einem Klick erstellt — '
              + 'danach kann ich sie dir hier zusammenfassen.' };
  }
  let a;
  try { a = (typeof roh === 'string') ? JSON.parse(roh) : roh; }
  catch (e) {
    return { gefunden: true, id: o.objekt_id, adresse: adresse, analyse_vorhanden: false,
      so_sagen: 'Die gespeicherte Pilot-Analyse ist nicht lesbar (kein gültiges JSON). '
              + 'Bitte in DealPilot neu erstellen.' };
  }
  /* Nur was es gibt — ein leeres Feld ist kein Feld. */
  const nimm = (v) => (v == null || v === '' || (Array.isArray(v) && !v.length)) ? undefined : v;
  const liste = (v) => Array.isArray(v) ? v.filter(Boolean).slice(0, 8) : nimm(v);
  const aus = {
    gefunden: true, id: o.objekt_id, adresse: adresse, analyse_vorhanden: true,
    stand: o.geaendert,
    briefing: {
      empfehlung: nimm(a.empfehlung), fazit_kurz: nimm(a.fazit_kurz),
      gesamtbewertung: nimm(a.gesamtbewertung), begruendung: nimm(a.empfehlung_begruendung),
      investmentbewertung: nimm(a.investmentbewertung), dealpilot_insight: nimm(a.dealpilot_insight),
      investor_fit: nimm(a.investor_fit)
    },
    staerken: liste(a.staerken), risiken: liste(a.risiken),
    risikoanalyse: nimm(a.risikoanalyse), szenarien: nimm(a.szenarien),
    anschlussfinanzierung: nimm(a.anschlussfinanzierung),
    lage: { makro: nimm(a.makrolage_recherche), mikro: nimm(a.mikrolage_recherche),
            mietspiegel_eur_qm: nimm(a.mietspiegel_eur_qm), kaufpreisniveau: nimm(a.kaufpreisniveau),
            quellen: liste(a.quellen) },
    verhandlung: { empfehlung: nimm(a.verhandlungsempfehlung), kaufpreis_offerte: nimm(a.kaufpreis_offerte),
                   offerte_mail: nimm(a.offerte_mail) },
    bankargumente: liste(a.bankargumente),
    hinweis: 'Die Pilot-Analyse ist eine KI-Einschätzung auf Basis der Objektdaten zum '
           + 'Zeitpunkt ihrer Erstellung — keine Wertermittlung und kein amtlicher Wert.'
  };
  /* v1849 · Fremdanalyse-Wächter. Gemessen am 04.10.2026: sechs Objekte
   * trugen byte-identisch dieselbe Analyse, und die zur Gohliser Straße
   * (Leipzig) sprach von Bielefeld. Eine Analyse, die den Ort des Objekts
   * nirgends nennt, aber EINEN ANDEREN Ort aus dem Portfolio, ist mit hoher
   * Wahrscheinlichkeit kopiert — dann bekommt der Nutzer das gesagt, statt
   * dass der Bot dem falschen Haus die richtige Sprache gibt. */
  const ort = String(o.daten.ort || '').trim();
  if (ort) {
    const text = (typeof roh === 'string') ? roh : JSON.stringify(roh);
    const nenntOrt = text.toLowerCase().includes(ort.toLowerCase());
    if (!nenntOrt) {
      aus.fremd_verdacht = true;
      aus.so_sagen = 'Achtung: Die gespeicherte Pilot-Analyse nennt den Ort ' + ort + ' nirgends — '
                   + 'sie stammt vermutlich von einem anderen Objekt. Bitte in DealPilot im Reiter '
                   + '„Pilot-Analyse" neu erstellen, bevor du dich darauf stützt.';
    }
  }
  /* Leere Teilbäume ganz weglassen, damit das Modell nicht "null" vorliest. */
  Object.keys(aus).forEach((k) => {
    const v = aus[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.keys(v).forEach((kk) => { if (v[kk] === undefined) delete v[kk]; });
      if (!Object.keys(v).length) delete aus[k];
    } else if (v === undefined) delete aus[k];
  });
  return aus;
}

/* ══ v2012 · DIE COCKPIT-ANALYSE, ABHOLBAR ═══════════════════════════

   Eine OBJEKT-Analyse wird gespeichert und hat hier laengst ein
   Werkzeug (`pilot_analyse_lesen`). Die PORTFOLIO-Analyse hatte
   beides nicht: sie entstand im Chat des Cockpits und war mit dem
   Schliessen des Reiters weg. Der Bot konnte die ZAHLEN lesen
   (`portfolio_lesen`), nie die Beurteilung.

   Seit v2012 legt der Portfolio-Pilot sie in `user_settings` unter
   `portfolio_analyse` ab. Hier wird sie geholt - mit STAND, denn
   eine Beurteilung ohne Datum ist bei einem Portfolio, das sich
   jeden Monat aendert, eine Falle. */
async function portfolio_analyse_lesen(ctx) {
  const r = await query(
    'SELECT wert, updated_at FROM user_settings WHERE user_id = $1 AND schluessel = $2',
    [ctx.userId, 'portfolio_analyse']
  );
  /* v2012a - GEMESSEN beim Aufraeumen eines Prueflaufs: hier stand
     `!r.rows[0].wert`. Ein zurueckgesetzter Eintrag ist aber
     `{text:null,...}` - ein Objekt, und damit truthy. Das Werkzeug
     meldete `vorhanden: true` mit `analyse: null`, und der Bot haette
     eine Analyse angekuendigt, die es nicht gibt.
     Geprueft wird deshalb der TEXT, nicht die Zeile. */
  const _w = (r.rowCount && r.rows[0].wert) || null;
  if (!_w || !_w.text || !String(_w.text).trim()) {
    return {
      vorhanden: false,
      hinweis: 'Es liegt keine Portfolio-Analyse vor. Sie entsteht in DealPilot im '
             + 'Portfolio-Cockpit ueber den Knopf "Portfolio-Analyse starten". '
             + 'Sag das - und erfinde KEINE eigene Gesamtbeurteilung. Die reinen '
             + 'Zahlen kannst du mit portfolio_lesen holen.'
    };
  }
  const w = _w;   /* v2012a - oben schon geprueft und gehalten */
  const stand = w.stand || r.rows[0].updated_at;
  let alter = null;
  try {
    const t = new Date(stand).getTime();
    if (Number.isFinite(t)) alter = Math.max(0, Math.round((Date.now() - t) / 86400000));
  } catch (e) {}
  return {
    vorhanden: true,
    analyse: w.text || null,
    stand: stand || null,
    stand_lesbar: stand ? new Date(stand).toLocaleDateString('de-DE') : null,
    alter_tage: alter,
    anzahl_objekte: w.anzahl_objekte != null ? w.anzahl_objekte : null,
    objekte_im_payload: w.objekte_im_payload != null ? w.objekte_im_payload : null,
    portfolio_score: w.portfolio_score != null ? w.portfolio_score : null,
    hinweis: 'Das ist die gespeicherte Beurteilung aus dem Portfolio-Cockpit, nicht neu '
           + 'gerechnet. NENNE DEN STAND. Ist sie aelter als 30 Tage, sage ausdruecklich, '
           + 'dass sich das Portfolio seitdem geaendert haben kann, und biete an, die '
           + 'aktuellen Zahlen mit portfolio_lesen dagegenzuhalten.'
  };
}

async function portfolio_lesen(ctx) {
  const sp = await dialog.portfolioKontext(ctx.userId);
  if (!sp) {
    return {
      vorhanden: false,
      hinweis: 'Es liegt kein Portfolio-Stand vor. Er entsteht in DealPilot selbst; '
             + 'der Nutzer muss die App einmal oeffnen. NICHT selbst ausrechnen.'
    };
  }
  /* ── v1803 · DIE BETRAEGE GEHEN FERTIG FORMATIERT MIT ────────────────
   *
   * GEMESSEN am 02.10.2026: auf "wie hoch sind meine Verbindlichkeiten"
   * antwortete das Modell mit *472.157,90 EUR*. Richtig sind
   * 4.721.579 EUR — es hat die letzten beiden Ziffern als Cent gelesen.
   *
   *   > Dieselbe Falle, die `projectAll` jahrelang in Cent rechnen liess.
   *   > Nur merkt man sie hier schneller, weil ein Mensch die Antwort
   *   > liest — und genau deshalb darf man sich darauf nicht verlassen.
   *
   * Eine Prompt-Regel allein genuegt nicht: ein Modell haelt sich
   * meistens daran. Deshalb bekommt es die Zahl zusaetzlich SO, wie sie
   * dastehen soll. Was fertig dasteht, wird abgeschrieben statt
   * umgerechnet. */
  const bil = (sp.payload && sp.payload.vermoegensbilanz) || {};
  const lesbar = {};
  Object.keys(bil).forEach((k) => {
    if (!/_eur$/.test(k) || !Number.isFinite(Number(bil[k]))) return;
    lesbar[k] = Number(bil[k]).toLocaleString('de-DE') + ' EUR';
  });

  /* ── v1813 · DIE NUMMER DES SPIEGELS GEHT NICHT MIT ─────────────────
   *
   * GEMESSEN am 03.10.2026 auf Staging: Nr 8 der Chat-Liste ist
   * "Bäckerstr. 7 Musterhausen", `nr: 8` im Spiegel ist "Ravensberger Weg
   * 38 Bielefeld". Die beiden Zählungen haben verschiedene Grundmengen —
   * alle Objekte nach Änderungsdatum gegen nur die gewonnenen in
   * API-Reihenfolge — und laufen ab Platz 2 auseinander.
   *
   *   > Zwei Zählungen für dasselbe Wort sind schlimmer als keine. Was
   *   > nicht dasteht, kann nicht falsch gelesen werden.
   *
   * Also steht sie nicht mehr da. Die Referenz ist die ID (v1813 im
   * Frontend), und für ein einzelnes Objekt gibt es `objekt_kennzahlen`. */
  const daten = Object.assign({}, sp.payload);
  if (Array.isArray(daten.objekte)) {
    daten.objekte = daten.objekte.map((o) => {
      const k = Object.assign({}, o);
      delete k.nr;
      return k;
    });
  }

  /* ── v1818b · BEIDE ZAHLEN, FERTIG FORMULIERT ───────────────────────
   *
   * GEMESSEN: "wie viele Objekte habe ich im Portfolio" -> 9,
   * "wie viele objekte habe ich" -> 18. Beide richtig (18 angelegt, 9 im
   * Bestand), fuer den Nutzer ein Widerspruch.
   *
   *   > Zwei richtige Zahlen auf eine Frage sind schlimmer als eine
   *   > falsche. Die falsche korrigiert man, am Widerspruch zweifelt man
   *   > an allem.
   *
   * In der Wissensdatei stand die Regel schon — das Modell befolgte sie
   * halb und nannte weiter nur eine Zahl. Zum dritten Mal dieselbe Lehre:
   * was im ERGEBNIS steht, wirkt; was daneben steht, wirkt manchmal.
   * Also steht der Satz jetzt fertig im Ergebnis. */
  let angelegt = null;
  try {
    const r = await query(`SELECT count(*)::int AS n FROM objects WHERE user_id = $1`,
      [ctx.userId]);
    angelegt = r.rows.length ? r.rows[0].n : null;
  } catch (e) { /* ohne die Zahl bleibt der Rest richtig */ }
  const imBestand = (sp.payload && sp.payload.anzahl_objekte) || 0;

  return {
    vorhanden: true,
    stand: dialog.standSatz(sp.erfasst_am, sp.alter_minuten, sp.geaendert_seitdem),
    geaendert_seitdem: sp.geaendert_seitdem,
    objekte_angelegt: angelegt,
    objekte_im_bestand: imBestand,
    so_sagen_anzahl: (angelegt != null && angelegt !== imBestand)
      ? angelegt + ' Objekte angelegt, davon ' + imBestand + ' im Bestand'
      : imBestand + ' Objekte im Bestand',
    hinweis_anzahl: 'Nennt der Nutzer die ANZAHL seiner Objekte oder fragt nach '
      + 'der Groesse des Portfolios, nimm "so_sagen_anzahl" UNVERAENDERT. Beide '
      + 'Zahlen gehoeren zusammen: alles hier Folgende gilt fuer den BESTAND, '
      + 'nicht fuer alle angelegten Objekte. Nur eine Zahl zu nennen laesst die '
      + 'andere wie einen Fehler aussehen.',
    hinweis: 'Alle Betraege sind GANZE EURO. Unter "so_schreiben" stehen sie '
           + 'fertig formatiert — nimm diese Schreibweise unveraendert. '
           + 'Die Objekte hier tragen KEINE Nummer: die Nummer aus der Chat-Liste '
           + 'gilt hier nicht. Willst du die Kennzahlen EINES Objekts, nimm '
           + 'objekt_kennzahlen — das ordnet richtig zu.',
    so_schreiben: lesbar,
    daten: daten
  };
}

/* ── Der Spiegel, aufgeschlossen für EIN Objekt ──────────────────────────
 *
 * Die Zuordnung geht über die ID. Nur wenn der Spiegel noch von vor v1813
 * stammt und keine ID führt, wird der Name genommen — und auch das nur,
 * wenn er EINDEUTIG ist. Auf Staging heißen zwei Objekte "Am Markt 9
 * Kabelsketal"; bei denen wäre ein Namenstreffer ein Münzwurf.
 */
function _spiegelEintrag(payload, objektId, daten) {
  const liste = (payload && Array.isArray(payload.objekte)) ? payload.objekte : [];
  if (!liste.length) return { eintrag: null, grund: 'leer' };

  const ueberId = liste.filter((o) => o && o.id && String(o.id) === String(objektId));
  if (ueberId.length === 1) return { eintrag: ueberId[0], grund: 'id' };

  /* Kein Eintrag mit dieser ID, aber der Spiegel führt IDs? Dann ist das
     Objekt wirklich nicht drin — nicht gewonnen, oder nach dem Spiegel
     angelegt. Dann NICHT über den Namen weitersuchen: das Ergebnis wäre
     ein anderes Haus. */
  const mitId = liste.filter((o) => o && o.id).length;
  if (mitId) return { eintrag: null, grund: 'nicht_im_spiegel' };

  const d = daten || {};
  const name = _flach([d.str, d.hnr].filter(Boolean).join(' '));
  const ort = _flach(d.ort || '');
  if (!name) return { eintrag: null, grund: 'alt_ohne_id' };
  const treffer = liste.filter((o) => {
    const nm = _flach(o && o.name);
    if (!nm) return false;
    return nm.indexOf(name) >= 0
        && (!ort || _flach(o.ort).indexOf(ort) >= 0 || nm.indexOf(ort) >= 0);
  });
  if (treffer.length === 1) return { eintrag: treffer[0], grund: 'name' };
  if (treffer.length > 1) return { eintrag: null, grund: 'name_mehrdeutig' };
  return { eintrag: null, grund: 'nicht_im_spiegel' };
}

/* Die Kennzahlen eines Spiegel-Eintrags, FERTIG FORMATIERT — weil ein
   Modell 4721579 als "47.215,79" gelesen hat (v1803). Was fertig dasteht,
   wird abgeschrieben statt umgerechnet. */
const KZ_FELDER = [
  ['cashflow_nach_steuer_eur_jahr', 'Cashflow nach Steuer', 'eur_jahr'],
  ['cashflow_vor_steuer_eur_jahr', 'Cashflow vor Steuer', 'eur_jahr'],
  ['miete_kalt_eur_jahr', 'Kaltmiete', 'eur_jahr'],
  ['kaufpreis_eur', 'Kaufpreis', 'eur'],
  ['eigenkapital_eur', 'Eigenkapital', 'eur'],
  ['darlehen_eur', 'Darlehen', 'eur'],
  ['restschuld_eur', 'Restschuld heute', 'eur'],
  ['zins_eur_jahr', 'Zins', 'eur_jahr'],
  ['tilgung_eur_jahr', 'Tilgung', 'eur_jahr'],
  ['bruttomietrendite_prozent', 'Bruttomietrendite', 'prozent'],
  ['dscr', 'DSCR', 'zahl2'],
  ['ltv_prozent', 'LTV', 'prozent'],
  ['zins_prozent', 'Zinssatz', 'prozent'],
  ['tilgung_prozent', 'Tilgungssatz', 'prozent']
];

function _kzText(wert, art) {
  const z = Number(wert);
  if (!Number.isFinite(z)) return null;
  if (art === 'eur') return Math.round(z).toLocaleString('de-DE') + ' EUR';
  if (art === 'eur_jahr') return Math.round(z).toLocaleString('de-DE') + ' EUR/Jahr';
  if (art === 'prozent') return z.toFixed(2).replace('.', ',') + ' %';
  if (art === 'zahl2') return z.toFixed(2).replace('.', ',');
  if (art === 'jahr') return String(Math.round(z));
  return String(wert);
}

/* ── Die gerechneten Zahlen EINES Objekts ───────────────────────────────
 *
 * Marcel: "Wie ist der Cashflow bei wohnung xy. wie ist der Investro deal
 * score."
 *
 * Bisher gab es dafür nur `portfolio_lesen` — neun Objekte im Paket, und
 * das Modell musste das richtige darin finden. Über die Nummer. Die nicht
 * stimmt. Hier kommt genau ein Objekt, zugeordnet über die ID.
 */
async function objekt_kennzahlen(ctx, args) {
  const id = await _findeObjekt(ctx, args);
  if (!id) return { gefunden: false, hinweis: 'Kein Objekt zu dieser Angabe gefunden.' };
  const o = await dialog.objektKontext(ctx.userId, id);
  if (!o) return { gefunden: false };
  ctx.merkeObjekt(id);

  const d = o.daten || {};
  const adresse = [d.str, d.hnr].filter(Boolean).join(' ')
    + (d.ort ? ', ' + [d.plz, d.ort].filter(Boolean).join(' ') : '');
  const sc = dialog.scoreLesen(d);
  const sp = await dialog.portfolioKontext(ctx.userId);
  const tr = sp ? _spiegelEintrag(sp.payload, id, d) : { eintrag: null, grund: 'kein_spiegel' };

  const kennzahlen = {}, fehlen = [];
  if (tr.eintrag) {
    KZ_FELDER.forEach((f) => {
      const t = _kzText(tr.eintrag[f[0]], f[2]);
      if (t) kennzahlen[f[1]] = t; else fehlen.push(f[1]);
    });
    /* Der Monatswert, weil danach so oft gefragt wird — aus derselben Zahl
       geteilt, nicht aus einer zweiten Quelle. */
    const cf = Number(tr.eintrag.cashflow_nach_steuer_eur_jahr);
    if (Number.isFinite(cf)) {
      kennzahlen['Cashflow nach Steuer je Monat'] =
        Math.round(cf / 12).toLocaleString('de-DE') + ' EUR/Monat';
    }
  }

  const ergebnis = {
    gefunden: true, id: id, adresse: adresse,
    objektart: d.objart || d.objektart || null,
    dealpilot_score: sc.dealscore, dealpilot_stufe: sc.stufe,
    investor_deal_score: sc.investor, investor_stufe: sc.investorStufe,
    kennzahlen: Object.keys(kennzahlen).length ? kennzahlen : null,
    stand: tr.eintrag
      ? dialog.standSatz(sp.erfasst_am, sp.alter_minuten, sp.geaendert_seitdem) : null
  };

  if (!sc.investor_gerechnet) {
    ergebnis.investor_hinweis = 'Der Investor Deal Score ist für dieses Objekt NICHT '
      + 'gerechnet. Sag das so — nenne keine Zahl dafür. Er entsteht in DealPilot, '
      + 'wenn das Objekt im Deal-Score-Modul durchgerechnet wird.';
  }
  /* ── v1927 · DIE VOLLSTAENDIGE BEWERTUNG, AUS DEM GLEICHEN WERKZEUG ───
   *
   * GEMESSEN an Marcels Chat vom 06.10.2026, 22:22 Uhr: auf „Kannst du mir
   * den DealPilot-Score nochmal nennen?" kam die Zahl 68, die Stufe SOLIDE
   * und sonst nichts — obwohl `objekt_schnellblick` seit v1925 Score,
   * Heuristik und Kennzahlen liefert.
   *
   * Der Grund stand in der BESCHREIBUNG dieses Werkzeugs: „IMMER nehmen bei
   * … 'wie ist der Score von …'". Das Modell hat sich daran gehalten. Es
   * hat nicht das falsche Werkzeug gewaehlt — ihm wurde das falsche
   * vorgeschrieben.
   *
   *   > Wer zwei Werkzeuge fuer dieselbe Frage anbietet, bestimmt mit der
   *   > Beschreibung, welches gilt. Ein Modell ist nicht ungehorsam, wenn
   *   > es dem folgt, was dasteht.
   *
   * Zwei Wege waeren moeglich gewesen: die Beschreibung umhaengen, oder
   * hier dasselbe liefern. Das Umhaengen haette die Frage nur verschoben —
   * „wie ist der Cashflow bei …" fuehrt weiter hierher, und dort fehlte
   * die Bewertung dann genauso.
   *
   * Also ruft dieses Werkzeug das andere. KEINE zweite Rechnung, keine
   * kopierte Ableitung: buchstaeblich dieselbe Funktion. Schlaegt sie fehl,
   * bleibt dieses Werkzeug stehen, was es immer war.
   */
  let sb = null;
  try {
    sb = await objekt_schnellblick(ctx, { id: id });
  } catch (e) {
    sb = null;
  }
  if (sb && sb.gefunden && sb.bewertung) {
    ergebnis.bewertung = sb.bewertung;
    /* Der Score steht jetzt an EINER Stelle im Ergebnis. Die beiden Felder
       oben blieben sonst als zweite Fassung daneben stehen — und zwei
       Felder mit demselben Namen laden dazu ein, das aeltere zu nehmen. */
    delete ergebnis.dealpilot_score;
    delete ergebnis.dealpilot_stufe;
    ergebnis.score_siehe = 'bewertung.dealpilot_score und bewertung.stufe';
  }
  if (sb && sb.gefunden) {
    /* Die gerechneten Groessen als ERSATZ, wenn der Portfolio-Stand nichts
       hergibt — nie daneben. Steht der Spiegel, gilt der Spiegel: er ist in
       DealPilot gerechnet und kennt Restschuld und Rate, die hier niemand
       ableiten kann. */
    if (!tr.eintrag) {
      ergebnis.rechnung = sb.rechnung;
      ergebnis.finanzierung = sb.finanzierung;
      ergebnis.kaufnebenkosten = sb.kaufnebenkosten;
    }
  }

  if (!tr.eintrag) {
    /* Jeder Grund bekommt seinen eigenen Satz. Ein gemeinsamer wäre
       bequemer und in jedem Einzelfall ungenau. */
    const saetze = {
      kein_spiegel: 'Es liegt kein Portfolio-Stand vor — der Nutzer muss DealPilot '
        + 'einmal öffnen. Dann stehen Cashflow, DSCR, LTV und Rendite hier.',
      leer: 'Der Portfolio-Stand enthält keine Objekte.',
      nicht_im_spiegel: 'Dieses Objekt steht NICHT im Portfolio-Stand. Das ist der Fall, '
        + 'wenn es nicht auf "gewonnen" steht oder nach dem letzten Stand angelegt '
        + 'wurde. Cashflow, DSCR, LTV und Rendite gibt es dafür deshalb nicht — '
        + 'behaupte dafür keine Zahl.',
      alt_ohne_id: 'Der Portfolio-Stand ist älter als der Umbau und lässt sich diesem '
        + 'Objekt nicht sicher zuordnen. Der Nutzer muss DealPilot einmal öffnen.',
      name_mehrdeutig: 'Im Portfolio-Stand passen mehrere Einträge auf diese Adresse. '
        + 'Ich nenne lieber keine Zahl als die eines anderen Hauses. Der Nutzer muss '
        + 'DealPilot einmal öffnen, dann ist die Zuordnung eindeutig.'
    };
    ergebnis.kennzahlen_hinweis = saetze[tr.grund] || saetze.nicht_im_spiegel;

    /* ── v1927 · DER SATZ STIMMTE NICHT MEHR ──────────────────────────
     *
     * Im Chat stand woertlich: „Kennzahlen wie Cashflow, DSCR, LTV und
     * Rendite sind nicht verfuegbar, da das Objekt nicht im
     * Portfolio-Stand ist." Das kam von hier — und es war seit v1925
     * falsch: der Rechenkern liefert genau diese vier.
     *
     *   > Ein Hinweis, der eine Luecke beschreibt, muss mitfallen, wenn
     *   > die Luecke geschlossen wird. Sonst behauptet er sie weiter.
     *
     * Was der Portfolio-Stand WIRKLICH allein hat, bleibt benannt:
     * Restschuld heute und die Rate in Euro — die haengen am Tilgungslauf
     * und lassen sich hier nicht ableiten. */
    if (ergebnis.bewertung && ergebnis.bewertung.kennzahlen) {
      ergebnis.kennzahlen_hinweis = (saetze[tr.grund] || saetze.nicht_im_spiegel)
        .replace(' Dann stehen Cashflow, DSCR, LTV und Rendite hier.', '')
        .replace(' Cashflow, DSCR, LTV und Rendite gibt es dafür deshalb nicht — '
               + 'behaupte dafür keine Zahl.', '')
        + ' ABER: Cashflow, DSCR, LTV und Nettomietrendite stehen trotzdem da — '
        + 'in "bewertung.kennzahlen", gerechnet mit demselben Kern wie die App. '
        + 'Sag NICHT, sie seien nicht verfuegbar. Was wirklich nur aus dem '
        + 'Portfolio-Stand kommt, ist die Restschuld heute und die Rate in Euro.';
    }
  }
  if (fehlen.length) ergebnis.nicht_gerechnet = fehlen;
  return ergebnis;
}

/* ── Rangliste: "was sind meine besten Wohnungen" ───────────────────────
 *
 * "Beste" ist keine Kennzahl. Wer die Frage mit EINER Zahl beantwortet,
 * hat sich für eine Bedeutung entschieden, ohne es zu sagen.
 *
 *   > Eine Wahl im Werkzeugschema ist ein Auftrag — das Modell trifft sie,
 *   > ohne zu fragen. (v1811, zweimal gemessen.)
 *
 * Deshalb ist `kennzahl` NICHT verpflichtend: ohne Angabe kommen mehrere
 * Kennzahlen nebeneinander, sortiert nach dem Investor Deal Score, und das
 * Ergebnis trägt die Anweisung, die Messgröße zu nennen.
 */
const RANG = {
  investor_deal_score: ['Investor Deal Score', 'investor_deal_score', 'score', 'hoch'],
  dealpilot_score: ['DealPilot-Score', 'dealpilot_score', 'score', 'hoch'],
  cashflow: ['Cashflow nach Steuer', 'cashflow_nach_steuer_eur_jahr', 'eur_jahr', 'hoch'],
  cashflow_vor_steuer: ['Cashflow vor Steuer', 'cashflow_vor_steuer_eur_jahr', 'eur_jahr', 'hoch'],
  bruttomietrendite: ['Bruttomietrendite', 'bruttomietrendite_prozent', 'prozent', 'hoch'],
  dscr: ['DSCR', 'dscr', 'zahl2', 'hoch'],
  ltv: ['LTV', 'ltv_prozent', 'prozent', 'niedrig'],
  kaufpreis: ['Kaufpreis', 'kaufpreis_eur', 'eur', 'hoch'],
  miete: ['Kaltmiete', 'miete_kalt_eur_jahr', 'eur_jahr', 'hoch'],
  restschuld: ['Restschuld', 'restschuld_eur', 'eur', 'hoch'],
  /* v1813g · "Finanzierungsbedarf" hatte keine Kennzahl, und das Modell
     nahm daraufhin den KAUFPREIS. Eine fehlende Wahl wird nicht zur
     Rueckfrage, sondern zur naechstbesten. */
  darlehen: ['Darlehen', 'darlehen_eur', 'eur', 'hoch'],
  eigenkapital: ['Eigenkapital', 'eigenkapital_eur', 'eur', 'hoch'],
  zinssatz: ['Zinssatz', 'zins_prozent', 'prozent', 'niedrig'],
  wohnflaeche: ['Wohnfläche', 'wohnflaeche_qm', 'zahl2', 'hoch'],
  baujahr: ['Baujahr', 'baujahr', 'jahr', 'hoch']
};

/* "Wohnung" ist keine Objektart — im Datensatz heißt sie ETW. Wer nach
   seinen "besten Wohnungen" fragt, soll nicht am Vokabular scheitern.
   Dieselbe Lehre wie bei den Umlauten: das Mittel gehört an jede Stelle. */
const ART_WORTE = {
  wohnung: 'ETW', wohnungen: 'ETW', etw: 'ETW', eigentumswohnung: 'ETW',
  eigentumswohnungen: 'ETW', haus: 'EFH', haeuser: 'EFH', einfamilienhaus: 'EFH',
  efh: 'EFH', zfh: 'ZFH', zweifamilienhaus: 'ZFH', mfh: 'MFH',
  mehrfamilienhaus: 'MFH', mehrfamilienhaeuser: 'MFH', dhh: 'DHH',
  doppelhaushaelfte: 'DHH', rh: 'RH', reihenhaus: 'RH', buero: 'BUERO',
  gewerbe: 'GEW', gew: 'GEW', garage: 'GAR', gar: 'GAR',
  geschaeftshaus: 'GESCH', gesch: 'GESCH', hotel: 'HOTEL'
};

async function objekte_rangliste(ctx, args) {
  const a = args || {};
  const sp = await dialog.portfolioKontext(ctx.userId);
  if (!sp || !sp.payload || !Array.isArray(sp.payload.objekte) || !sp.payload.objekte.length) {
    return { vorhanden: false,
      hinweis: 'Es liegt kein Portfolio-Stand vor. Er entsteht in DealPilot selbst; der '
             + 'Nutzer muss die App einmal öffnen. NICHT selbst ausrechnen.' };
  }

  let liste = sp.payload.objekte.slice();
  const gesamt = liste.length;

  let art = null;
  if (a.objektart) {
    const roh = _flach(String(a.objektart).trim());
    art = ART_WORTE[roh] || String(a.objektart).trim().toUpperCase();
    liste = liste.filter((o) => _flach(o.objektart) === _flach(art));
    if (!liste.length) {
      const vorhanden = {};
      sp.payload.objekte.forEach((o) => {
        if (o.objektart) vorhanden[o.objektart] = (vorhanden[o.objektart] || 0) + 1;
      });
      return { vorhanden: true, anzahl: 0, gefiltert_auf: art,
        objektarten_im_bestand: vorhanden,
        hinweis: 'Kein Objekt dieser Art im Portfolio-Stand. Nenne dem Nutzer, welche '
               + 'Arten er hat — die stehen unter objektarten_im_bestand.' };
    }
  }

  const schluessel = (a.kennzahl && RANG[a.kennzahl]) ? a.kennzahl : 'investor_deal_score';
  const label = RANG[schluessel][0], feld = RANG[schluessel][1];
  const fmtArt = RANG[schluessel][2], richtung = RANG[schluessel][3];

  const ohne = liste.filter((o) => !Number.isFinite(Number(o[feld]))).length;
  const sortiert = liste.slice().sort((x, y) => {
    const vx = Number(x[feld]), vy = Number(y[feld]);
    const ax = Number.isFinite(vx), ay = Number.isFinite(vy);
    if (!ax && !ay) return 0;
    if (!ax) return 1;                      /* ohne Wert immer nach hinten */
    if (!ay) return -1;
    return richtung === 'niedrig' ? vx - vy : vy - vx;
  });

  const grenze = Math.min(Number(a.anzahl) > 0 ? Number(a.anzahl) : 20, 30);
  const zeilen = sortiert.slice(0, grenze).map((o, i) => {
    const z = { platz: i + 1, id: o.id || null, name: o.name || null,
      ort: o.ort || null, objektart: o.objektart || null };
    z[label] = _kzText(o[feld], fmtArt) || '(nicht gerechnet)';
    /* Immer mehrere Kennzahlen dazu — "beste" heißt für verschiedene Leute
       Verschiedenes, und eine Rangliste mit nur einer Zahl lässt die
       Antwort einseitiger aussehen als die Lage ist. */
    if (feld !== 'investor_deal_score') {
      z['Investor Deal Score'] = Number.isFinite(Number(o.investor_deal_score))
        ? String(Math.round(o.investor_deal_score)) : '(nicht gerechnet)';
    }
    if (feld !== 'dealpilot_score') {
      z['DealPilot-Score'] = Number.isFinite(Number(o.dealpilot_score))
        ? String(Math.round(o.dealpilot_score)) : '(nicht gerechnet)';
    }
    if (feld !== 'cashflow_nach_steuer_eur_jahr') {
      z['Cashflow nach Steuer'] =
        _kzText(o.cashflow_nach_steuer_eur_jahr, 'eur_jahr') || '(nicht gerechnet)';
    }
    if (feld !== 'bruttomietrendite_prozent') {
      z['Bruttomietrendite'] =
        _kzText(o.bruttomietrendite_prozent, 'prozent') || '(nicht gerechnet)';
    }
    return z;
  });

  /* ── v1813g · EIN FILTER, DEN NIEMAND WOLLTE, FIEL NICHT AUF ────────────
   *
   * GEMESSEN am 03.10.2026: auf "welche Objekte haben den hoechsten
   * Finanzierungsbedarf" rief der Agent dieses Werkzeug mit
   * `{"kennzahl":"kaufpreis","objektart":"Wohnung"}` — beides erfunden. Die
   * Antwort nannte "Hermannstraße 9, 200.000 EUR" als Spitze, waehrend das
   * teuerste Objekt 1.394.304 EUR Restschuld traegt. Vier MFH fehlten
   * stillschweigend, weil sie keine Wohnungen sind.
   *
   *   > Ein Filter, der die Haelfte des Bestands entfernt, muss im SATZ
   *   > stehen, nicht im Feld daneben. `gefiltert_auf` stand da und wurde
   *   > nicht gelesen — zum dritten Mal dieselbe Lehre.
   *
   * Also steht der Satz jetzt fertig im Ergebnis, und zwar an der Stelle,
   * die das Modell abschreibt. */
  const sagen = [];
  if (art) {
    sagen.push('Gezeigt werden NUR ' + zeilen.length + ' von ' + gesamt
      + ' Objekten — gefiltert auf die Objektart ' + art + '. Sag das dem Nutzer, '
      + 'bevor du die Liste nennst.');
  }
  sagen.push('Sortiert nach: ' + label + (richtung === 'niedrig'
    ? ' (niedriger ist besser)' : ' (hoeher ist besser)') + '.');

  return {
    vorhanden: true,
    anzahl: zeilen.length,
    von_insgesamt: gesamt,
    gefiltert_auf: art,
    so_sagen: sagen.join(' '),
    sortiert_nach: label,
    beste_zuerst: true,
    bessere_richtung: richtung === 'niedrig' ? 'niedriger ist besser' : 'hoeher ist besser',
    ohne_wert: ohne,
    stand: dialog.standSatz(sp.erfasst_am, sp.alter_minuten, sp.geaendert_seitdem),
    rangliste: zeilen,
    hinweis: (art ? 'ZUERST: ' + sagen[0] + ' ' : '')
           + 'Sortiert ist nach "' + label + '". SAG DAS in deiner Antwort — "beste" ist '
           + 'keine Kennzahl, und der Nutzer muss wissen, nach was du ordnest. '
           + (a.kennzahl ? '' : 'Der Nutzer hat keine Messgröße genannt: nenne die '
             + 'Reihenfolge nach Score und weise auf eine abweichende Reihenfolge bei '
             + 'Cashflow oder Rendite hin, wenn sie sich unterscheidet. ')
           + (ohne ? 'Bei ' + ohne + ' Objekt(en) ist diese Kennzahl nicht gerechnet — '
             + 'die stehen am Ende und dürfen NICHT als "schlecht" dargestellt werden. ' : '')
           + 'Alle Beträge sind fertig formatiert; nimm sie unverändert.'
  };
}

/* ── "Gib mir die Felder von Wohnung 17" ────────────────────────────────
 *
 * Marcel: "damit ich sehen kann was alles drin steht."
 *
 * `objekt_lesen` gibt den Datensatz schon mit — aber mit den INTERNEN
 * Namen: `wfl`, `d1t`, `ds2_zustand`. Das ist eine Datenbankzeile, keine
 * Auskunft. Hier stehen Beschriftung und Wert, nach Etappen geordnet, und
 * dazu, wie viele Felder leer sind.
 */
const ETAPPEN_NAMEN = (function () {
  const m = {};
  try { fuehrung.etappen().forEach((e) => { m[e.nr] = e.nr + '. ' + e.name; }); } catch (e) {}
  return m;
})();

/* Welche Etappe trägt ein Feld? Die Zuordnung steckt in den Frageblöcken.
   GEMESSEN: nur 51 von 189 Feldern stehen in einem Block — der Rest läuft
   als "Weitere Felder". Das ist ehrlicher als eine erfundene Einteilung. */
const FELD_ETAPPE = (function () {
  const m = {};
  try {
    const k = require('../generated/frontend-konstanten.json');
    const d = k.daten || k;
    (d.fragen || []).forEach((b) => (b.ids || []).forEach((i) => { m[i] = b.et || 1; }));
  } catch (e) {}
  return m;
})();

const GELD_WORT = /preis|miete|kosten|darlehen|kapital|wert|rücklage|hausgeld|ausfall|betrag|summe|erbbauzins/i;

function _feldWert(feld, wert) {
  if (wert == null || wert === '') return null;
  if (typeof wert === 'object') return JSON.stringify(wert).slice(0, 120);
  const s = String(wert);
  const label = (feld && feld.label) || '';
  /* Baujahr und Jahreszahlen NIE durch eine Tausendertrennung. */
  if (/baujahr|jahr\b|\(jahre\)/i.test(label)
      || /^(baujahr|btj|anschl_bj|d1_bindj|d2_bindj)$/.test(feld.id)) return s;
  const z = Number(s.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(z) || !/^[\d.,\s-]+$/.test(s)) return s;
  if (/%/.test(label)) return s.replace('.', ',') + ' %';
  if (/€\/m²/.test(label)) return s.replace('.', ',') + ' EUR/m²';
  if (/m²/.test(label)) return s.replace('.', ',') + ' m²';
  if (GELD_WORT.test(label) && Math.abs(z) >= 100) {
    return Math.round(z).toLocaleString('de-DE') + ' EUR';
  }
  return s;
}

async function objekt_felder_liste(ctx, args) {
  const a = args || {};
  const id = await _findeObjekt(ctx, a);
  if (!id) return { gefunden: false, hinweis: 'Kein Objekt zu dieser Angabe gefunden.' };
  const o = await dialog.objektKontext(ctx.userId, id);
  if (!o) return { gefunden: false };
  ctx.merkeObjekt(id);
  const d = o.daten || {};

  const suche = _flach(String(a.bereich || '').trim());
  const katalog = fuehrung.katalog();
  const gruppen = {};
  const leere_namen = [];
  let gefuellt = 0, leer = 0;

  katalog.forEach((f) => {
    if (suche && _flach(f.id).indexOf(suche) < 0 && _flach(f.label).indexOf(suche) < 0) return;
    const wert = _feldWert(f, d[f.id]);
    if (wert == null) {
      leer++;
      if (leere_namen.length < 40) leere_namen.push(f.label);
      return;
    }
    gefuellt++;
    const et = FELD_ETAPPE[f.id];
    const g = et ? (ETAPPEN_NAMEN[et] || ('Etappe ' + et)) : 'Weitere Felder';
    if (!gruppen[g]) gruppen[g] = [];
    gruppen[g].push({ feld: f.id, bezeichnung: f.label, wert: wert });
  });

  /* Was im Datensatz steht, aber in keinem Katalog — Notizen, Importfelder.
     Es weglassen hieße behaupten, der Datensatz sei leerer als er ist. */
  const bekannt = {};
  katalog.forEach((f) => { bekannt[f.id] = true; });
  const sonstige = [];
  Object.keys(d).forEach((k) => {
    if (k.indexOf('_') === 0 || bekannt[k]) return;
    const v = d[k];
    if (v == null || v === '') return;
    if (suche && _flach(k).indexOf(suche) < 0) return;
    const t = typeof v === 'object' ? JSON.stringify(v) : String(v);
    sonstige.push({ feld: k, wert: t.length > 200 ? t.slice(0, 200) + ' …' : t });
  });

  let luecken = [];
  try {
    luecken = (fuehrung.luecken(d, { bisEtappe: 4 }) || []).slice(0, 5)
      .map((b) => b.frage || (b.ids || []).join(', '));
  } catch (e) {}

  return {
    gefunden: true, id: id,
    adresse: [d.str, d.hnr].filter(Boolean).join(' ')
      + (d.ort ? ', ' + [d.plz, d.ort].filter(Boolean).join(' ') : ''),
    gesucht: a.bereich || null,
    gefuellte_felder: gefuellt,
    leere_felder: leer,
    felder_nach_bereich: gruppen,
    weitere_eintraege: sonstige.length ? sonstige.slice(0, 30) : undefined,
    leere_beispiele: leere_namen.length ? leere_namen : undefined,
    naechste_luecken: luecken.length ? luecken : undefined,
    stand: o.geaendert,
    hinweis: 'Das sind die EINGETRAGENEN Felder. Gerechnete Größen — Cashflow, Rendite, '
           + 'DSCR, LTV, Restschuld, Scores — stehen hier NICHT drin; dafür '
           + 'objekt_kennzahlen. Gib dem Nutzer die Felder nach Bereichen geordnet mit '
           + 'Bezeichnung und Wert, nicht die internen Feldnamen. Sind es mehr als etwa '
           + 'dreißig, nenne die Bereiche mit ihren wichtigsten Werten und frage, '
           + 'welchen Bereich er im Einzelnen sehen will.'
  };
}

/* ── "Wie kann ich meinen Cashflow steigern?" ───────────────────────────
 *
 * Die Frage ist beantwortbar — aber nur mit den eigenen Zahlen. Ein Modell,
 * das hier aus dem Allgemeinwissen antwortet, schreibt "Miete erhöhen,
 * Kosten senken, umschulden": richtig, nutzlos und von jedem Portfolio
 * unabhängig.
 *
 * Dieses Werkzeug rechnet die Hebel am ECHTEN Datensatz und nennt bei
 * jedem, worauf er sich stützt. Gerechnet wird mit derselben Arithmetik
 * wie im Portfolio-Spiegel (Darlehenssumme mal Satz durch 100) — kein
 * zweiter Rechenkern, dieselbe Zeile.
 *
 * UND WO KEINE ANGABE LIEGT, STEHT DER WEG DORTHIN. Fehlt die Marktmiete,
 * ist der Mietspielraum nicht "null", sondern unbekannt — und das Werkzeug
 * sagt, welches Feld fehlt.
 */
function _zahl(v) {
  const n = Number(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function _hebelFuer(d) {
  const hebel = [], fehlt = [];
  const eur = (x) => Math.round(x).toLocaleString('de-DE') + ' EUR/Jahr';

  /* 1 · Tilgung. Der Cashflow steigt sofort, das Vermögen wächst langsamer
     — beides gehört in denselben Satz. */
  const d1 = _zahl(d.d1), d2 = _zahl(d.d2), t1 = _zahl(d.d1t), t2 = _zahl(d.d2t);
  const tilgJ = d1 * t1 / 100 + d2 * t2 / 100;
  if (tilgJ > 0 && (t1 > 1 || t2 > 1)) {
    const auf1 = d1 * Math.min(t1, 1) / 100 + d2 * Math.min(t2, 1) / 100;
    hebel.push({
      hebel: 'Tilgungssatz senken',
      jetzt: 'Tilgung ' + [t1 ? t1 + ' %' : null, t2 ? t2 + ' %' : null].filter(Boolean).join(' / ')
           + ' = ' + eur(tilgJ),
      wenn: 'auf 1 % gesenkt',
      wirkung: '+' + eur(tilgJ - auf1),
      aber: 'Der Cashflow steigt sofort, aber die Restschuld sinkt langsamer — das Geld '
          + 'ist nicht verdient, nur verschoben. Mit der Bank zu vereinbaren.'
    });
  } else if (tilgJ > 0) {
    hebel.push({ hebel: 'Tilgungssatz senken',
      jetzt: 'Tilgung liegt bereits bei 1 % oder darunter (' + eur(tilgJ) + ')',
      wirkung: 'kein Spielraum nach unten' });
  }

  /* 2 · Zins. Kein Zielzins wird erfunden — die Wirkung steht je halbem
     Prozentpunkt da, und der Nutzer setzt sein eigenes Angebot ein. */
  const z1 = _zahl(d.d1z), z2 = _zahl(d.d2z);
  const zinsJ = d1 * z1 / 100 + d2 * z2 / 100;
  if (zinsJ > 0) {
    const jeHalb = (d1 + d2) * 0.5 / 100;
    hebel.push({
      hebel: 'Zins senken (Umschuldung, Prolongation)',
      jetzt: 'Zinssatz ' + [z1 ? z1 + ' %' : null, z2 ? z2 + ' %' : null].filter(Boolean).join(' / ')
           + ' = ' + eur(zinsJ),
      wenn: 'je 0,5 Prozentpunkte weniger',
      wirkung: '+' + eur(jeHalb),
      aber: (d.d1_bindj || d.anschl_z)
        ? 'Zinsbindung ' + (d.d1_bindj ? d.d1_bindj + ' Jahre' : 'nicht eingetragen')
          + (d.anschl_z ? ', Anschlusszins kalkuliert mit ' + d.anschl_z + ' %' : '')
          + '. Vor dem Ende der Bindung geht das nur mit Vorfälligkeitsentschädigung.'
        : 'Die Zinsbindung ist nicht eingetragen — ohne sie lässt sich nicht sagen, ab '
          + 'wann umgeschuldet werden kann.'
    });
  }

  /* 3 · Miete gegen Marktmiete — nur mit eingetragener Vergleichsmiete. */
  const wfl = _zahl(d.wfl), nkm = _zahl(d.nkm), ze = _zahl(d.ze);
  const mmDs2 = _zahl(d.ds2_marktmiete), mmSoll = _zahl(d.me_soll);
  const mm = mmDs2 || mmSoll;
  if (mm > 0 && wfl > 0 && nkm > 0) {
    const sollJ = mm * wfl * 12, istJ = nkm * 12;
    const quelle = mmDs2 ? 'Marktmiete (DS2)' : 'Soll-Mietspiegel';
    const je = (nkm / wfl).toFixed(2).replace('.', ',');
    if (sollJ > istJ) {
      hebel.push({
        hebel: 'Miete an das Marktniveau heranführen',
        jetzt: je + ' EUR/m² (' + eur(istJ) + ')',
        wenn: String(mm).replace('.', ',') + ' EUR/m² nach ' + quelle,
        wirkung: '+' + eur(sollJ - istJ),
        aber: 'Nur im Rahmen von Mietspiegel, Kappungsgrenze und laufendem Vertrag — bei '
            + 'Bestandsmietern meist in Schritten oder erst bei Neuvermietung.'
      });
    } else {
      hebel.push({ hebel: 'Miete an das Marktniveau heranführen',
        jetzt: je + ' EUR/m²',
        wirkung: 'kein Spielraum — die Miete liegt bereits auf oder über dem ' + quelle
               + ' (' + String(mm).replace('.', ',') + ' EUR/m²)' });
    }
  } else if (wfl > 0 && nkm > 0) {
    fehlt.push({ hebel: 'Mietspielraum',
      fehlendes_feld: 'Marktmiete (€/m²) DS2 oder Soll-Mietspiegel (€/m²)',
      warum: 'Ohne eine Vergleichsmiete lässt sich nicht sagen, ob die Miete unter Markt '
           + 'liegt. Das ist KEIN "kein Spielraum", sondern unbekannt.' });
  }

  /* 4 · Die nicht umlagefähigen Kosten — die einzigen, die den Cashflow
     wirklich drücken. Umlagefähiges zahlt der Mieter. */
  const nul = [
    ['hg_nul', 'Hausgeld (nicht umlagefähig)'],
    ['weg_r', 'WEG-Rücklage'],
    ['eigen_r', 'eigene Instandhaltungsrücklage'],
    ['nul_sonst', 'Sonderverwaltung'],
    ['mietausfall', 'kalkulierter Mietausfall']
  ].map((p) => ({ name: p[1], wert: _zahl(d[p[0]]) })).filter((x) => x.wert > 0);
  if (nul.length) {
    const summe = nul.reduce((s, x) => s + x.wert, 0);
    const rohertrag = (nkm + ze) * 12;
    hebel.push({
      hebel: 'Nicht umlagefähige Kosten',
      jetzt: nul.map((x) => x.name + ' ' + Math.round(x.wert).toLocaleString('de-DE') + ' EUR')
               .join(', ') + ' = ' + eur(summe)
           + (rohertrag > 0 ? ' (' + (summe / rohertrag * 100).toFixed(1).replace('.', ',')
             + ' % des Rohertrags)' : ''),
      wirkung: 'Jeder hier gesparte Euro geht voll in den Cashflow',
      aber: 'Rücklagen zu senken verschiebt Instandhaltung in die Zukunft — das ist kein '
          + 'Gewinn, sondern eine Verschiebung.'
    });
  }

  /* 5 · Zusätzliche Einnahmen — eingetragen oder fehlend. */
  const stp = _zahl(d.stellplatz_miete_monat);
  if (ze > 0 || stp > 0) {
    hebel.push({ hebel: 'Zusätzliche Einnahmen',
      jetzt: (ze > 0 ? Math.round(ze).toLocaleString('de-DE') + ' EUR/Monat' : '')
           + (stp > 0 ? (ze > 0 ? ', darin Stellplatz ' : 'Stellplatz ')
              + Math.round(stp).toLocaleString('de-DE') + ' EUR/Monat' : ''),
      wirkung: 'Stellplatz, Garage, Werbefläche oder Waschkeller wirken voll auf den '
             + 'Cashflow und sind nicht an die Kappungsgrenze gebunden' });
  } else {
    fehlt.push({ hebel: 'Zusätzliche Einnahmen',
      fehlendes_feld: 'Zusätzliche Einnahmen / Monat',
      warum: 'Nicht eingetragen. Stellplatz, Garage oder Waschkeller wirken voll auf den '
           + 'Cashflow — wenn es sie gibt, fehlen sie heute in der Rechnung.' });
  }

  /* 6 · Leerstand */
  if (d.vermstand) {
    hebel.push({ hebel: 'Vermietungsstand', jetzt: String(d.vermstand),
      wirkung: 'Bei Leerstand ist die Vermietung der größte einzelne Hebel' });
  }

  return { hebel: hebel, fehlt: fehlt };
}

/* ── v1813d · ZWEI WERKZEUGE STATT EINES MIT SCHALTER ────────────────────
 *
 * Erst war das EIN Werkzeug mit `bereich: 'objekt'|'portfolio'`. GEMESSEN:
 * auf "wie kann ich meinen Cashflow steigern" gab das Modell
 * `bereich: "objekt"` mit und erfand dazu einen Objektbezug — die Antwort
 * galt dann einem einzelnen Haus und sah wie die ganze aus.
 *
 *   > Was ein Werkzeug anbietet, wird benutzt. Wer eine Verwechslung
 *   > ausschliessen will, darf sie nicht anbieten.
 *
 * Jetzt sind es zwei: das Portfolio-Werkzeug nimmt GAR KEINE Parameter, es
 * gibt also nichts zu erfinden. Die Wahl steckt im Namen, und den waehlt
 * das Modell an der Frage — nicht in einem Feld, das es ausfuellen muss. */
async function cashflow_hebel(ctx, args) {
  const a = args || {};
  const bereich = String(a.bereich || '').toLowerCase() === 'portfolio' ? 'portfolio' : 'objekt';

  if (bereich === 'portfolio') {
    const sp = await dialog.portfolioKontext(ctx.userId);
    if (!sp || !sp.payload) {
      return { vorhanden: false,
        hinweis: 'Kein Portfolio-Stand vorhanden — der Nutzer muss DealPilot einmal öffnen.' };
    }
    const b = sp.payload.vermoegensbilanz || {};
    const objekte = Array.isArray(sp.payload.objekte) ? sp.payload.objekte : [];
    /* Wo sitzt der Schmerz? Das sagt, welches Objekt es wert ist, einzeln
       angesehen zu werden — und macht aus einem Allgemeinplatz eine
       Handlungsfolge. */
    const negativ = objekte
      .filter((o) => Number(o.cashflow_nach_steuer_eur_jahr) < 0)
      .sort((x, y) => Number(x.cashflow_nach_steuer_eur_jahr)
                    - Number(y.cashflow_nach_steuer_eur_jahr))
      .slice(0, 5)
      .map((o) => ({ id: o.id || null, name: o.name,
        cashflow: _kzText(o.cashflow_nach_steuer_eur_jahr, 'eur_jahr'),
        tilgungssatz: o.tilgung_prozent != null ? o.tilgung_prozent + ' %' : null,
        zinssatz: o.zins_prozent != null ? o.zins_prozent + ' %' : null,
        dscr: _kzText(o.dscr, 'zahl2') }));

    /* ── v1813c · DIE HEBEL DER DREI SCHWAECHSTEN GEHEN MIT ─────────────
     *
     * GEMESSEN: auf "wie kann ich meinen Cashflow steigern" rief der Agent
     * dieses Werkzeug ACHTZEHNMAL — einmal je Objekt — und schrieb am Ende
     * trotzdem "Miete erhoehen, Kosten senken", ohne eine einzige Zahl.
     *
     *   > Ein Werkzeug, das nur einen Teil der Antwort liefert, wird so
     *   > oft gerufen, wie es Teile gibt. Und die Antwort wird davon nicht
     *   > besser, sondern teurer.
     *
     * Also kommen die gerechneten Hebel der drei schwaechsten Objekte
     * gleich mit: ein Aufruf, und die Antwort hat Zahlen. */
    const schwach = [];
    for (const o of negativ.slice(0, 3)) {
      /* Ueber die ID, und bei einem Spiegel von vor v1813 ueber den Namen —
         aber nur, wenn er EINDEUTIG ist. `objects.name` ist genau das Feld,
         aus dem der Spiegel seinen Namen nimmt. */
      let q = null;
      if (o.id) {
        q = await query(`SELECT data FROM objects WHERE id = $1 AND user_id = $2`,
          [o.id, ctx.userId]);
      } else if (o.name) {
        q = await query(`SELECT data FROM objects WHERE user_id = $1 AND name = $2`,
          [ctx.userId, o.name]);
        if (q.rows.length !== 1) q = null;
      }
      if (!q || !q.rows.length) continue;
      const h = _hebelFuer(q.rows[0].data || {});
      schwach.push({ name: o.name, cashflow: o.cashflow, hebel: h.hebel,
        dafuer_fehlt_eine_angabe: h.fehlt.length ? h.fehlt : undefined });
    }

    const tilg = Number(b.tilgung_eur_jahr), zins = Number(b.zins_eur_jahr);
    const stellen = [];
    if (Number.isFinite(tilg) && tilg > 0) {
      stellen.push({ hebel: 'Tilgung im ganzen Bestand', jetzt: _kzText(tilg, 'eur_jahr'),
        wirkung: 'Jeder Prozentpunkt weniger Tilgung ist unmittelbar Cashflow — aber die '
               + 'Restschuld sinkt langsamer' });
    }
    if (Number.isFinite(zins) && zins > 0) {
      stellen.push({ hebel: 'Zins im ganzen Bestand', jetzt: _kzText(zins, 'eur_jahr'),
        wirkung: 'Je 0,5 Prozentpunkte auf die Darlehenssumme: '
               + _kzText(Number(b.darlehen_aufgenommen_eur || 0) * 0.5 / 100, 'eur_jahr') });
    }
    return {
      vorhanden: true, bereich: 'portfolio',
      stand: dialog.standSatz(sp.erfasst_am, sp.alter_minuten, sp.geaendert_seitdem),
      cashflow_nach_steuer: _kzText(b.cashflow_nach_steuer_eur_jahr, 'eur_jahr'),
      cashflow_vor_steuer: _kzText(b.cashflow_vor_steuer_eur_jahr, 'eur_jahr'),
      kapitaldienst: _kzText(b.kapitaldienst_eur_jahr, 'eur_jahr'),
      dscr_portfolio: _kzText(b.dscr_portfolio, 'zahl2'),
      stellschrauben: stellen,
      schwaechste_objekte: negativ.length ? negativ : undefined,
      hebel_der_schwaechsten: schwach.length ? schwach : undefined,
      hinweis: 'DAS IST DIE GANZE ANTWORT — ruf dieses Werkzeug NICHT noch einmal und '
             + 'nicht je Objekt auf. Unter "hebel_der_schwaechsten" stehen die '
             + 'gerechneten Hebel der Objekte, die am meisten kosten. '
             + 'NENNE BEI JEDEM HEBEL DIE EURO-WIRKUNG, die hier steht, und das Objekt, '
             + 'zu dem sie gehoert — ein Hebel ohne Zahl ist ein Allgemeinplatz und '
             + 'hilft bei keinem Portfolio. Nenne dazu jede Einschraenkung. Alle Zahlen '
             + 'sind fertig formatiert; nimm sie unveraendert und erfinde keine weiteren '
             + 'und keine Zinsangebote. Sag am Ende, dass das eine Rechnung auf seinen '
             + 'eingetragenen Zahlen ist und keine Finanzierungs- oder Steuerberatung.'
    };
  }

  const id = await _findeObjekt(ctx, a);
  if (!id) {
    return { gefunden: false,
      hinweis: 'Kein Objekt zu dieser Angabe gefunden. Ging die Frage um den '
             + 'GESAMTBESTAND, nimm cashflow_hebel_portfolio.' };
  }
  const o = await dialog.objektKontext(ctx.userId, id);
  if (!o) return { gefunden: false };
  ctx.merkeObjekt(id);
  const d = o.daten || {};
  const sp = await dialog.portfolioKontext(ctx.userId);
  const tr = sp ? _spiegelEintrag(sp.payload, id, d) : { eintrag: null, grund: 'kein_spiegel' };
  const erg = _hebelFuer(d);

  return {
    gefunden: true, bereich: 'objekt', id: id,
    adresse: [d.str, d.hnr].filter(Boolean).join(' ') + (d.ort ? ', ' + d.ort : ''),
    cashflow_jetzt: tr.eintrag
      ? _kzText(tr.eintrag.cashflow_nach_steuer_eur_jahr, 'eur_jahr') : null,
    cashflow_jetzt_hinweis: tr.eintrag ? undefined
      : 'Der gerechnete Cashflow liegt für dieses Objekt nicht vor — es steht nicht im '
      + 'Portfolio-Stand. Die Hebel unten gelten trotzdem: sie kommen aus dem Datensatz, '
      + 'nicht aus der Rechnung. Nenne keinen Ausgangs-Cashflow.',
    dscr: tr.eintrag ? _kzText(tr.eintrag.dscr, 'zahl2') : null,
    hebel: erg.hebel,
    dafuer_fehlt_eine_angabe: erg.fehlt.length ? erg.fehlt : undefined,
    hinweis: 'Jeder Hebel steht mit seiner Wirkung UND seiner Einschränkung da — nenne '
           + 'beide. Alle Beträge sind fertig formatiert; nimm sie unverändert und rechne '
           + 'nichts dazu. Steht unter "dafuer_fehlt_eine_angabe" etwas, sag dem Nutzer, '
           + 'welches Feld fehlt — ein fehlender Wert ist KEIN fehlender Hebel. Schließe '
           + 'damit, dass das eine Rechnung auf seinen eigenen eingetragenen Zahlen ist '
           + 'und keine Finanzierungs- oder Steuerberatung.'
  };
}

/* ── Ein Feld ueber ALLE Objekte ─────────────────────────────────────────
 *
 * Marcel am 03.10.2026: "geht das noch intelligenter und schlauer, sodass
 * er alle fragen zu meinen objekten versteht?"
 *
 * GEMESSEN, warum er das fragt:
 *
 *   "Welche Objekte haben keinen Keller?"     19 Werkzeugaufrufe, 17 s
 *   "Wie viele sind Mehrfamilienhaeuser?"     18 Werkzeugaufrufe, 17 s
 *   "Welche sind vor 1960 gebaut?"            fragte zurueck statt zu antworten
 *
 * Der Agent hatte nur zwei Wege: den Portfolio-Spiegel (22 Kernfelder) oder
 * ein Objekt einzeln. Alles, was im Spiegel fehlt — Keller, Heizung,
 * Energieausweis, Zinsbindung, Sanierungsstand — zwang ihn, achtzehnmal
 * dasselbe zu tun.
 *
 *   > Ein Agent, der eine Frage nur beantworten kann, indem er achtzehnmal
 *   > nachschlaegt, beantwortet sie meistens nicht. Er fragt zurueck, und
 *   > das sieht aus wie Dummheit, ist aber ein fehlendes Werkzeug.
 *
 * Dieses Werkzeug liest beliebige Felder ueber ALLE Objekte in EINEM
 * Aufruf. Es rechnet nichts — es liest, was im Datensatz steht. Die
 * Auswertung ("vor 1960", "kein Keller") macht das Modell auf den Zahlen,
 * die es bekommt, nicht auf eigener Annahme.
 */
async function objekte_felder(ctx, args) {
  const gewuenscht = Array.isArray(args && args.felder) ? args.felder : [];
  if (!gewuenscht.length) {
    return { fehler: 'Bitte in "felder" die Feld-Ids angeben, z.B. ["baujahr","objart"]. '
                   + 'Welche es gibt, sagt feld_katalog.' };
  }

  /* ── v1812e · GELD STEHT NICHT HIER, UND DAS SAGT DAS WERKZEUG SELBST ─
   *
   * GEMESSEN: auf "welche Objekte haben den hoechsten Finanzierungsbedarf"
   * nahm der Agent dieses Werkzeug, fand `d1`/`restschuld` leer und
   * meldete "12 von 18 Objekten haben keinen eingetragenen
   * Finanzierungsbedarf" — eine falsche Aussage, denn die Werte sind nicht
   * leer, sie werden GERECHNET.
   *
   * Ich hatte das in die Werkzeugbeschreibung geschrieben. Es half nicht,
   * zum zweiten Mal heute:
   *
   *   > Was im Ergebnis steht, wirkt. Was in der Beschreibung steht,
   *   > wirkt manchmal. Wer einen Irrweg verhindern will, stellt das
   *   > Schild an den Weg, nicht an die Karte.
   */
  const GERECHNET = /^(d\d|restschuld|cashflow|cf_|rendite|dscr|ltv|tilg|zins_eur|kapitaldienst|score|_kpis)/i;
  const falsch = gewuenscht.filter((f) => GERECHNET.test(String(f))
    || /darlehen|restschuld|cashflow|rendite|tilgung|finanzierungsbedarf|eigenkapital/i.test(String(f)));
  if (falsch.length) {
    return {
      ok: false,
      falsche_felder: falsch,
      hinweis: 'Diese Groessen stehen NICHT im Objektdatensatz — sie werden in '
             + 'DealPilot gerechnet. Ein leeres Feld hier heisst NICHT, dass der '
             + 'Wert fehlt. Nimm portfolio_lesen: dort stehen Darlehen, Restschuld, '
             + 'Tilgung, Zins, Cashflow, Rendite, DSCR, LTV und beide Scores fuer '
             + 'JEDES Objekt einzeln und fertig gerechnet.'
    };
  }
  /* Nur bekannte Felder — sonst liest das Modell sich etwas zusammen, das
     es nicht gibt, und haelt das Ergebnis fuer eine Fehlanzeige.
     v1812b: Nennt das Modell statt der Id eine Beschriftung ("Wohnfläche",
     "Baujahr"), wird sie aufgeloest statt abgewiesen — es kennt die
     internen Namen nicht, und das ist kein Grund zu scheitern. */
  const gueltig = [], unbekannt = [];
  gewuenscht.forEach((f) => {
    if (fuehrung.feld(f)) { gueltig.push(f); return; }
    const flach = _flach(f);
    const treffer = fuehrung.katalog().filter((k) =>
      _flach(k.id) === flach || _flach(k.label) === flach
      || _flach(k.label).replace(/\s*\([^)]*\)\s*/g, '').trim() === flach);
    if (treffer.length === 1) gueltig.push(treffer[0].id); else unbekannt.push(f);
  });
  if (!gueltig.length) {
    return { fehler: 'Keines dieser Felder gibt es.', unbekannte_felder: unbekannt,
             hinweis: 'Frag feld_katalog mit einem Suchwort nach dem richtigen Namen.' };
  }

  const r = await query(
    `SELECT id, name, ort, data FROM objects
      WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 200`,
    [ctx.userId]);

  const zeilen = r.rows.map((z, i) => {
    const d = z.data || {};
    const e = {
      nummer: i + 1, id: z.id,
      adresse: [d.str, d.hnr].filter(Boolean).join(' ')
             + (d.ort ? ', ' + d.ort : (z.ort ? ', ' + z.ort : ''))
    };
    gueltig.forEach((f) => {
      const v = d[f];
      /* ── v1812c · LEER STEHT ALS WORT DA, NICHT ALS null ──────────────
       *
       * GEMESSEN: auf "welche Objekte haben keinen Keller" antwortete der
       * Agent mit einer Liste — darunter Objekte, bei denen das Feld
       * schlicht LEER war. Ein `null` im JSON liest ein Modell als "nein".
       *
       *   > Ein leeres Feld ist keine Aussage. Wer es als Nein liest,
       *   > behauptet etwas ueber ein Haus, das niemand geprueft hat.
       *
       * Der Hinweis daneben half nicht — dieselbe Lehre wie bei den
       * Betraegen und beim Preis: was im Wert steht, schlaegt, was im
       * Hinweis steht. Also steht es jetzt im Wert. */
      e[f] = (v === '' || v == null) ? '(nicht ausgefuellt)' : v;
    });
    return e;
  });

  /* Wie viele tragen das Feld ueberhaupt? Ohne diese Zahl haelt das Modell
     siebzehn Leerwerte fuer siebzehn Neins. */
  const gefuellt = {};
  gueltig.forEach((f) => {
    gefuellt[f] = zeilen.filter((z) => z[f] !== '(nicht ausgefuellt)').length;
  });

  return {
    anzahl: zeilen.length,
    felder: gueltig,
    unbekannte_felder: unbekannt.length ? unbekannt : undefined,
    wie_viele_tragen_das_feld: gefuellt,
    objekte: zeilen,
    hinweis: '"(nicht ausgefuellt)" heisst: niemand hat das Feld gepflegt. Das ist '
           + 'KEIN Nein und keine Null. Wer danach fragt, bekommt von dir die '
           + 'Objekte, bei denen das Feld WIRKLICH einen Wert hat — und dazu den '
           + 'Satz, bei wie vielen es leer ist. Behaupte nie etwas ueber ein Objekt, '
           + 'dessen Feld leer ist.'
  };
}

/* ── v1817 · PREISE KOMMEN AUS DER DATENBANK, NIE AUS DEM GEDAECHTNIS ───
 *
 * GEMESSEN am 04.10.2026: auf "Was kostet DealPilot Pro im Monat?"
 * antwortete der Agent "Bitte besuche die offizielle Website". Ehrlich,
 * aber nutzlos — der Preis steht in `plans`, drei Zeilen entfernt.
 *
 * DIE VERSUCHUNG WAERE, IHN IN DIE WISSENSDATEI ZU SCHREIBEN. Dann stuende
 * er an einer FUENFTEN Stelle: config.js (Anzeige), plans (Abbuchung),
 * Billing-Portal (Kundenportal), .env (Seats, Kontingente) — und jetzt
 * noch eine Textdatei.
 *
 *   > Jede weitere Stelle, an der ein Preis steht, ist eine weitere
 *   > Stelle, an der er falsch sein kann. Und Preise fallen durch jedes
 *   > Raster: niemand prueft sie, bis ein Kunde sich beschwert.
 *
 * Gelesen wird deshalb `plans` — die Tabelle, nach der ABGEBUCHT wird.
 * Was dort steht, ist das, was der Kunde zahlt.
 */
async function pakete_und_preise(ctx, args) {
  const r = await query(
    `SELECT id, name, tagline, price_monthly_cents, price_yearly_cents,
            max_objects, max_users, is_listed
       FROM plans
      WHERE is_active = true
      ORDER BY sort_order, price_monthly_cents`);
  if (!r.rows.length) {
    return { fehler: 'Es sind keine Pakete hinterlegt.' };
  }

  const eur = (cents) => (cents == null ? null
    : (Number(cents) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' EUR');

  /* Welches Paket hat der Nutzer? Die Frage "was kostet Pro" heisst oft
     "lohnt der Wechsel" — ohne den eigenen Stand ist die Antwort halb.
     Es steht in `subscriptions`, NICHT an `users`: dort gibt es gar keine
     Plan-Spalte. Mein erster Anlauf las `users.plan_id`, lief in den
     try/catch und haette immer null gemeldet.

       > Eine Abfrage, die still scheitert, sieht aus wie eine Antwort.
       > Gemessen statt angenommen: 0 Spalten mit "plan" an `users`. */
  let eigenes = null, eigenesInterval = null;
  try {
    const u = await query(
      `SELECT plan_id, billing_interval FROM subscriptions
        WHERE user_id = $1 AND status IN ('active','trialing')
        ORDER BY created_at DESC LIMIT 1`, [ctx.userId]);
    if (u.rows.length) {
      eigenes = u.rows[0].plan_id;
      eigenesInterval = u.rows[0].billing_interval || null;
    }
  } catch (e) { /* ohne eigenes Paket bleibt die Liste trotzdem richtig */ }

  const pakete = r.rows
    .filter((p) => p.is_listed || p.id === eigenes)
    .map((p) => ({
      id: p.id,
      name: p.name,
      kurz: p.tagline || null,
      /* FERTIG FORMATIERT. Das Modell hat schon zweimal Euro als Cent
         gelesen (v1803) — bei einem PREIS waere das eine Falschaussage
         gegenueber einem Kunden. */
      preis_monatlich: p.price_monthly_cents === 0 ? 'kostenlos' : eur(p.price_monthly_cents),
      preis_jaehrlich: p.price_yearly_cents === 0 ? 'kostenlos' : eur(p.price_yearly_cents),
      objekte: p.max_objects === -1 ? 'unbegrenzt' : String(p.max_objects),
      nutzer: p.max_users === -1 ? 'unbegrenzt' : String(p.max_users),
      dein_paket: p.id === eigenes || undefined,
    }));

  return {
    pakete,
    dein_paket: eigenes,
    deine_zahlweise: eigenesInterval,
    hinweis: 'Die Preise stehen fertig formatiert da — nimm sie UNVERAENDERT und '
           + 'rechne nichts um. Es sind Bruttopreise in Euro; Junker Solution ist '
           + 'Kleinunternehmer nach § 19 UStG, es wird keine Umsatzsteuer '
           + 'ausgewiesen. Nenne bei einem Jahrespreis auch, dass er auf zwoelf '
           + 'Monate gerechnet guenstiger ist, wenn das zutrifft. Nicht gelistete '
           + 'Pakete nennst du nur, wenn es das Paket des Nutzers ist.',
  };
}

/* ═══ v1937 · DIE MARKTPREISINDIKATION ZUR BEWERTUNG ══════════════════════
 *
 * Marcel am 07.10.2026:
 *
 *   „Auch wenn wir zu dem Objekt eine Marktpreisindikation haben, dass wir
 *    das mit reinarbeiten und allem. Also, dass wir es vollumfaenglich
 *    ausgeben koennen. Haben wir die Moeglichkeit, das zu machen?"
 *
 * GEMESSEN am 07.10.2026 auf Staging — ja, an zwei Stellen, und sie sind
 * NICHT dasselbe:
 *
 *   1. `avm_valuations` (avmHistoryService) — echte Abrufe bei einem
 *      Bewertungspartner plus manuelle Eintraege (Makler, Gutachten).
 *      Fuenf Saetze liegen dort, zu zwei Objekten.
 *   2. `svwert` / `bankval` am Objekt — der Verkehrs- bzw. Beleihungswert,
 *      den der Nutzer SELBST eingetragen hat.
 *
 * Der Marktbericht (eigene Datenbank, `marktbericht_abrufen`) ist bewusst
 * NICHT dabei: er KOSTET Guthaben. Ihn nebenbei zu ziehen, weil jemand
 * nach dem Score fragt, waere ein Abruf ohne Freigabe.
 *
 * ── DREI REGELN, DIE HIER GELTEN ──────────────────────────────────────
 *
 * · ANBIETER-NEUTRALITAET. `avm_valuations.provider` fuehrt woertlich
 *   `pricehubble`. CLAUDE.md: „Sprengnetter und PriceHubble nie namentlich
 *   nach aussen — unabhaengige Bewertungspartner." Der Name wird deshalb
 *   hier uebersetzt und verlaesst die Funktion nicht. Ein Name, der im
 *   Ergebnis steht, steht frueher oder spaeter im Chat.
 * · DIE HERKUNFT WIRD NICHT VERWISCHT. Ein Abruf beim Bewertungspartner,
 *   die Schaetzung eines Maklers und eine Zahl, die der Nutzer selbst ins
 *   Formular geschrieben hat, sind drei verschiedene Dinge. Sie stehen
 *   nebeneinander, jede mit ihrem Datum.
 * · DIE ABWEICHUNG WIRD HIER GERECHNET, NICHT VON DER KI. „Kaufpreis
 *   liegt 9,8 % ueber dem Marktwert" ist eine Rechnung. Das Modell darf
 *   keine neue Zahl bilden — also bekommt es die fertige.
 *
 *   > Eine Marktpreisindikation ohne ihr Datum und ihre Herkunft ist eine
 *   > Behauptung mit Nachkommastellen.
 */
async function _marktpreisIndikation(userId, objektId, d, kp) {
  const eur = (x) => Math.round(x).toLocaleString('de-DE') + ' EUR';
  const pct = (x) => x.toFixed(1).replace('.', ',') + ' %';
  const tag = (x) => { try { return new Date(x).toISOString().slice(0, 10); } catch (e) { return null; } };

  const quellen = [];
  let leitwert = null, leitquelle = null, leitart = null;

  try {
    const liste = await avmHistorie.listForObject(userId, objektId);
    (liste || []).forEach((zz) => {
      const w = Number(zz.marktwert);
      if (!Number.isFinite(w) || w <= 0) return;
      /* Der Anbietername wird NICHT durchgereicht. */
      const istAbruf = String(zz.provider || '').toLowerCase() !== 'manuell';
      /* v1939 · DIE PREISART ENTSCHEIDET UEBER DEN ABSCHLAG.
         GEMESSEN am 07.10.2026: `pricehubble-client.js` ruft `dealType:
         'sale'` ab, also einen Marktwert — ob dahinter Angebots- oder
         Transaktionsdaten stehen, sagt unser Code NICHT. Und was eine
         Maklerschaetzung ist, steht im Etikett, nicht in der Zahl.
         Beides ist damit `unbekannt`, und der Kern behandelt es nach
         Marcels Vorgabe vorsichtshalber wie ein Angebot — mit dem Satz
         dazu, dass die Art nicht feststellbar war. Geraten wird nichts. */
      const preisart = 'unbekannt';
      const herkunft = istAbruf
        ? 'Abruf bei einem unabhaengigen Bewertungspartner'
        : ('manuell eingetragen' + (zz.source_label ? ' (' + zz.source_label + ')' : ''));
      const e = {
        wert: eur(w), herkunft: herkunft, stand: tag(zz.created_at),
        preisart: preisart, _roh: w,
        spanne: (Number(zz.low) > 0 && Number(zz.high) > 0)
          ? eur(Number(zz.low)) + ' bis ' + eur(Number(zz.high)) : null,
        je_qm: Number(zz.eur_per_sqm) > 0 ? eur(Number(zz.eur_per_sqm)) + '/m²' : null,
        marktmiete_monat: Number(zz.marktmiete) > 0 ? eur(Number(zz.marktmiete)) : null,
        sicherheit: zz.confidence || null,
        notiz: zz.note || null
      };
      quellen.push(e);
      /* Leitwert ist der JUENGSTE Abruf — nicht der hoechste und nicht der
         bequemste. `listForObject` sortiert bereits absteigend. */
      if (leitwert == null && istAbruf) { leitwert = w; leitquelle = e; leitart = preisart; }
    });
    /* Gibt es gar keinen Abruf, gilt der juengste manuelle Eintrag. */
    if (leitwert == null && quellen.length) {
      const erste = (liste || []).find((zz) => Number(zz.marktwert) > 0);
      if (erste) { leitwert = Number(erste.marktwert); leitquelle = quellen[0]; leitart = quellen[0].preisart; }
    }
  } catch (e) {
    return { fehler: 'Die Bewertungshistorie war nicht lesbar: ' + e.message };
  }

  /* Der eigene Eintrag am Objekt — eine andere Qualitaet, deshalb eigener
     Block und NICHT in derselben Liste. */
  const zahl = (v) => {
    const n = Number(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const svw = zahl(d.svwert), bank = zahl(d.bankval);
  const eigene = [];
  if (svw) eigene.push({ was: 'Verkehrswert', wert: eur(svw), herkunft: 'am Objekt eingetragen' });
  if (bank && bank !== svw) eigene.push({ was: 'Beleihungswert', wert: eur(bank), herkunft: 'am Objekt eingetragen' });
  if (leitwert == null && svw) {
    leitwert = svw;
    leitquelle = { wert: eur(svw), herkunft: 'am Objekt eingetragener Verkehrswert', stand: null };
    /* v1939: ein VERKEHRSWERT ist bereits ein Wert und kein Angebot — hier
       waere ein Abschlag eine zweite Minderung derselben Sache. */
    leitart = 'wert';
  }

  if (!quellen.length && !eigene.length) {
    return {
      vorhanden: false,
      hinweis: 'Zu diesem Objekt liegt KEINE Marktpreisindikation vor — weder ein '
        + 'Abruf noch ein eingetragener Verkehrswert. Behaupte keinen Marktwert und '
        + 'leite keinen aus dem Kaufpreis ab. Der Nutzer kann einen Abruf starten '
        + '(marktbericht_preis nennt den Preis).'
    };
  }

  /* ── v1939 · DER ABSCHLAG KOMMT VOR DEM VERGLEICH ────────────────────
   *
   * Marcel am 07.10.2026: „Immer bedenken dass es angebotspreise sind und
   * meistens 10 % dadrunter verkauft wird."
   *
   * Also wird der Marktwert BEREINIGT, bevor „der Kaufpreis liegt X %
   * darueber" gebildet wird — sonst steht die Abweichung auf einer Zahl,
   * von der Marcel sagt, dass sie zu hoch ist. Der Satz selbst steht in
   * `qc-heuristik.js` (`ANGEBOTSABSCHLAG`), nicht hier: er ist eine
   * Bewertungsvorgabe und gehoert an EINE Stelle.
   *
   *   > Ein Abschlag, den man nicht sieht, macht aus einer Annahme eine
   *   > Messung. Deshalb steht er in jeder Zeile dabei.
   *
   * Der ROHE Wert bleibt sichtbar — wer die Quelle nachschlagen will,
   * findet dort diese Zahl und nicht unsere. */
  const bereinigt = leitwert ? rechenkerne.heuristikTeil('marktwertBereinigt', leitwert, leitart) : null;
  let vergleich = null;
  if (bereinigt && kp > 0) {
    const basis = bereinigt.bereinigt;
    const diff = kp - basis;
    const q = diff / basis * 100;
    vergleich = {
      kaufpreis: eur(kp),
      marktwert_laut_quelle: eur(bereinigt.roh),
      angebotsabschlag: bereinigt.abschlag_pct > 0
        ? (pct(bereinigt.abschlag_pct) + ' — ' + bereinigt.grund)
        : ('kein Abschlag — ' + bereinigt.grund),
      marktwert: eur(basis),
      unterschied: (diff >= 0 ? '+' : '-') + eur(Math.abs(diff)),
      /* ── v1939b · DIE ZAHL TRAEGT IHREN ABSCHLAG SELBST ──────────────
       * GEMESSEN am ersten echten Lauf: die KI schrieb „35,6 % ueber dem
       * Marktwert" und liess den Abschlag weg — obwohl der Prompt ihn
       * ausdruecklich verlangt. Das Werkzeugschema schlaegt den Prompt:
       * was woertlich so heissen soll, gehoert als fertiger Wert ins
       * Ergebnis, nicht als Bitte an das Modell. */
      kaufpreis_zu_marktwert: 'Kaufpreis liegt ' + pct(Math.abs(q))
        + (diff >= 0 ? ' UEBER' : ' UNTER') + ' dem Marktwert'
        + (bereinigt.abschlag_pct > 0
            ? ' (nach ' + pct(bereinigt.abschlag_pct) + ' Angebotsabschlag auf '
              + eur(bereinigt.roh) + ' — eine Annahme, keine Messung)'
            : ''),
      grundlage: leitquelle
        ? (leitquelle.herkunft + (leitquelle.stand ? ', Stand ' + leitquelle.stand : ''))
        : null,
      /* Fuer die Heuristik — nicht zum Anzeigen. */
      _basis: basis,
      _abschlag_grund: bereinigt.abschlag_pct > 0 ? bereinigt.grund : null
    };
  }

  return {
    vorhanden: true,
    quellen: quellen.length ? quellen : undefined,
    am_objekt: eigene.length ? eigene : undefined,
    vergleich: vergleich || undefined,
    hinweis: 'Das ist eine INDIKATION, kein Gutachten. Nenne den Bewertungspartner '
      + 'NIE beim Namen — "unabhaengiger Bewertungspartner". Nenne zu jeder Zahl '
      + 'ihre Herkunft und ihren Stand; eine selbst eingetragene Zahl ist etwas '
      + 'anderes als ein Abruf. Rechne NICHTS nach — die Abweichung steht fertig da.'
  };
}

/* ── v1824 · DER SCHNELLBLICK ────────────────────────────────────────────
 *
 * Marcel am 04.10.2026:
 *
 *   "wir wollen ja als Erstes einen Deal-Score haben … dass er dann
 *    automatisch dann eine Abfrage macht über das Objekt, ob das gut oder
 *    schlecht ist … die Einschätzung, die der Quick-Check dort geben
 *    würde unten, also eine Kaufempfehlung, diese Heuristik, den
 *    Deal-Score, die Werte dazu."
 *
 * ── v1925 · HIER STAND „WARUM DIESES WERKZEUG KEINEN DEAL-SCORE RECHNET"
 *
 * Marcel am 06.10.2026, hörbar verärgert:
 *
 *   „Ich habe dir gesagt, ich möchte mit meinem Telegram-Bot, dass wir
 *    auch, wenn wir den Quick-Check machen, dass dann natürlich der
 *    Deal-Score berechnet wird und dann auch die Bewertung der Heuristik
 *    mit angegeben wird. Das hast du auch nicht umgesetzt."
 *
 * Er hat recht, und die Begründung, die hier stand, war der Grund dafür.
 * Sie lautete:
 *
 *   > GEMESSEN am 04.10.2026: der DealPilot-Score wird im BROWSER
 *   > gerechnet (`dealscore.js`). Eine Score-Engine im Backend wäre ein
 *   > zweiter Rechenkern. Deshalb liefert der Schnellblick, was sich OHNE
 *   > Score sagen lässt, und nennt es auch so.
 *
 * DIE MESSUNG WAR RICHTIG, DER SCHLUSS WAR FALSCH. Aus „das Backend darf
 * den Score nicht ANDERS rechnen" wurde „das Backend darf ihn nicht
 * rechnen". Das ist nicht dasselbe, und der Unterschied ist genau die
 * Spiegelung, die seit v1899 für DSCR und KPI schon da war. Sie zu
 * erweitern war immer möglich; ich habe es nicht getan und stattdessen
 * einen Verzicht dokumentiert, der nach Sorgfalt aussah.
 *
 *   > Ein begründeter Verzicht ist nur so lange eine Begründung, wie der
 *   > Weg daran wirklich fehlt. Danach ist er eine Ausrede mit Fußnote.
 *
 * Seit v1925 spiegelt `tools/rechenkerne-spiegeln.mjs` fünf Kerne, und
 * `services/rechenkerne.js` gibt sie dem Backend:
 *
 *     Dscr.compute()              dscr-engine.js
 *     DealKpis.compute()          deal-kpis.js
 *     ScoreTier.stufe()           score-tiers.js
 *     DealScore.computeFromKpis() dealscore.js      <- der Deal-Score
 *     QcHeuristik.bewerten()      qc-heuristik.js   <- die Heuristik
 *
 * Es ist WOERTLICH dieselbe Datei, die der Browser lädt, mit SHA-256 je
 * Quelle. Keine zweite Rechnung, kein zweiter Dialekt.
 *
 * ── WAS DER SCHNELLBLICK JETZT LIEFERT ────────────────────────────────
 *
 * Drei Dreisatzrechnungen, jede offen vorgerechnet:
 *
 *     Bruttomietrendite   Jahreskaltmiete / Kaufpreis
 *     Kaufpreisfaktor     Kaufpreis / Jahreskaltmiete
 *     Kapitaldienst       Darlehen × (Zins + Tilgung)
 *
 * dazu den DEAL-SCORE mit seinen fünf Teilnoten und seiner Stufe, und die
 * HEURISTIK des Quick-Checks: die Einschätzungszeilen und die
 * Kaufempfehlung (KAUFEN / VERHANDELN / KRITISCH / PASS) samt
 * Schmerzschwellen-Kaufpreis.
 *
 * ── EINE ZAHL, NICHT ZWEI ─────────────────────────────────────────────
 *
 * Wurde das Objekt in DealPilot schon gerechnet, steht sein Score am
 * Datensatz (`_dealpilot_score`). Dann gilt DIESER, und es wird kein
 * zweiter gerechnet — der Quick-Check der App weicht vom Vollbild-Score
 * bewusst ab (quick-check.js, V63.22: der Quick-Check kennt weniger
 * Felder), und beide Zahlen nebeneinander im Chat wären genau die zweite
 * Meinung, die hier nie entstehen soll. Erst wenn kein gespeicherter
 * Score da ist, rechnet der Schnellblick selbst — und sagt, dass es der
 * Quick-Check-Score ist.
 *
 * ── UND DIE FEHLENDEN ANGABEN ─────────────────────────────────────────
 *
 * Marcel: "einmal den Ort abfragen, was haben wir denn da, und dann
 * können wir ja grob das hochrechnen, was die Kaufnebenkosten wären."
 *
 * Die Grunderwerbsteuer steht im Landesgesetz und kommt aus der PLZ
 * (eine Tabelle, im Frontend gepflegt). Notar und Grundbuch sind
 * Richtwerte und werden als solche gekennzeichnet. Zins und Tilgung
 * kommen aus seinen Vorgaben — oder es wird EINMAL gefragt.
 */
async function objekt_schnellblick(ctx, args) {
  const id = await _findeObjekt(ctx, args);
  if (!id) return { gefunden: false, hinweis: 'Kein Objekt zu dieser Angabe gefunden.' };
  const o = await dialog.objektKontext(ctx.userId, id);
  if (!o) return { gefunden: false };
  ctx.merkeObjekt(id);
  const d = o.daten || {};

  /* Betraege: der Punkt ist ein TAUSENDERtrennzeichen ("180.000"). */
  const z = (v) => {
    const n = Number(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  /* ── v1899 · PROZENTSAETZE BRAUCHEN EINEN ANDEREN PARSER ──────────────
   *
   * GEMESSEN am 06.10.2026 am Objekt d65ed5cb (Staging): das Formular
   * speichert die Saetze GEMISCHT — `gest_p` als "6.50", `notar_p` als
   * "2.2", `d1z` dagegen als "3,9". Durch `z()` gelesen wurde daraus
   * 650 % Grunderwerbsteuer und 22 % Notar; der Schnellblick meldete
   * "Grunderwerbsteuer 650,00 % = 1.267.500 EUR", ein Darlehen von
   * 1.481.375 EUR und einen Kapitaldienst von 87.401 EUR. Jede Zahl
   * danach war Unsinn, und keine sah wie ein Tippfehler aus.
   *
   * Beim Zins fiel es nie auf, weil dort zufaellig ein Komma stand.
   *
   *   > Ein Punkt in einem Prozentsatz ist nie ein Tausendertrennzeichen.
   *     Kein Satz dieser App hat vier Stellen.
   *
   * Dieselbe Trennung fuehrt `objekt_kennzahlen` weiter oben schon
   * (`num` fuer Betraege, `dez` fuer Dezimalzahlen, Z. 170/171) — hier
   * fehlte sie. */
  const dez = (v) => {
    if (v == null || String(v).trim() === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const eur = (x) => Math.round(x).toLocaleString('de-DE') + ' EUR';
  const pct = (x) => x.toFixed(2).replace('.', ',') + ' %';

  const kp = z(d.kp), nkm = z(d.nkm), ze = z(d.ze) || 0, wfl = z(d.wfl);
  const erg = await vorgaben.ergaenzung(ctx.userId, d);

  /* ── Was fehlt, um ueberhaupt etwas zu sagen? ───────────────────────── */
  const pflicht = [];
  if (!kp) pflicht.push('Kaufpreis');
  if (!nkm) pflicht.push('Nettokaltmiete pro Monat');
  if (pflicht.length) {
    return {
      gefunden: true, id: id, adresse: _adrVon(o),
      geht_noch_nicht: pflicht,
      hinweis: 'Ohne ' + pflicht.join(' und ') + ' laesst sich nichts rechnen. '
             + 'Frag genau danach — eine Zahl, die man nicht hat, wird nicht '
             + 'geschaetzt.'
    };
  }

  /* ── Die drei Dreisatzrechnungen, offen ───────────────────────────────
   *
   * ── v1899 · SIE KOMMEN AUS DEM KERN DER APP, NICHT VON HIER ──────────
   *
   * Marcel am 06.10.2026: „den Telegram-Bot, der soll auch nicht seine
   * eigenen so bilden. Also wenn, dann soll das schon Hand und Fuss haben,
   * was wir da machen."
   *
   * Hier standen bis dahin vier eigene Formeln:
   *
   *     mieteJahr     = (nkm + ze) * 12
   *     bmr           = mieteJahr / kp * 100
   *     faktor        = kp / mieteJahr
   *     kapitaldienst = darlehen * (zins + tilg) / 100
   *
   * GEMESSEN am Objekt d65ed5cb (Staging): sie trafen dieselben Zahlen wie
   * `DealKpis.compute()` — bmy 4,953846 %, Faktor 20,186335, und der
   * Kapitaldienst stimmt bis auf die Rundung (gegengemessen: 10.004,748
   * gegen 10.004,75; die Eurozahl haengt an Nebenkosten und Eigenkapital,
   * deshalb steht hier keine). Das macht die Formeln nicht richtig, nur
   * momentan gleich. CLAUDE.md
   * sagt: „Rechenkerne — nie duplizieren", und zwei Formeln, die heute
   * dasselbe ergeben, sind genau die Stelle, an der morgen zwei Zahlen
   * stehen, von denen keine falsch aussieht.
   *
   * Gerechnet wird deshalb mit `DealKpis.compute()` aus
   * `services/rechenkerne.js` — der WOERTLICH gespiegelten
   * `frontend/js/deal-kpis.js`, derselben Datei, die der Browser laedt.
   * Der Rechenweg darunter bleibt ausgeschrieben: der Bot soll die Zahl
   * weiterhin vorrechnen koennen.
   *
   * KEIN RUECKFALL AUF EIGENE FORMELN: fehlt die Spiegelung, sagt der
   * Schnellblick das und rechnet nicht. Eine zweite Meinung ueber denselben
   * Deal ist schlimmer als eine fehlende Auskunft. */
  if (!rechenkerne.vorhanden()) {
    return {
      gefunden: true, id: id, adresse: _adrVon(o),
      geht_noch_nicht: ['Rechenkern'],
      hinweis: 'Der Rechenkern der App ist im Backend gerade nicht ladbar '
             + '(src/generated/rechenkerne). Ich rechne NICHT mit einer '
             + 'eigenen Formel — sag dem Nutzer, dass die Kennzahlen im '
             + 'Moment nur in DealPilot selbst stehen, und melde den Fehler.'
    };
  }

  /* Die Kaufnebenkosten stehen weiter unten — fuer Bruttomietrendite und
     Kaufpreisfaktor braucht der Kern sie nicht (sie haengen am Kaufpreis).
     Der Kapitaldienst wird im Finanzierungszweig mit der dann bekannten
     Gesamtinvestition noch einmal gerufen. */
  const K0 = rechenkerne.kpis({ kp: kp, nkm: nkm, ze: ze });
  const mieteJahr = K0.nkm_j;
  const bmr = K0.bmy;
  const faktor = K0.fak;

  const rechnung = {
    jahreskaltmiete: eur(mieteJahr)
      + (ze ? '  (' + eur(nkm * 12) + ' Miete + ' + eur(ze * 12) + ' zusaetzlich)' : ''),
    bruttomietrendite: pct(bmr) + '  = ' + eur(mieteJahr) + ' / ' + eur(kp),
    kaufpreisfaktor: faktor.toFixed(1).replace('.', ',') + '-fach'
      + '  = ' + eur(kp) + ' / ' + eur(mieteJahr),
  };
  if (wfl) {
    rechnung.kaufpreis_je_qm = eur(kp / wfl) + '/m²';
    rechnung.miete_je_qm = (nkm / wfl).toFixed(2).replace('.', ',') + ' EUR/m²';
  }

  /* ── Kaufnebenkosten, soweit belegbar ───────────────────────────────── */
  const satzVon = (id2) => {
    /* v1899: `dez` statt `z` — ein Prozentsatz fuehrt kein
       Tausendertrennzeichen (siehe Block oben). */
    if (erg.vorhanden[id2] != null) return { wert: dez(erg.vorhanden[id2]), quelle: 'am Objekt' };
    if (erg.vom_nutzer[id2] != null) return { wert: Number(erg.vom_nutzer[id2]), quelle: 'deine Vorgabe' };
    if (erg.vorschlag[id2]) return { wert: Number(erg.vorschlag[id2].wert), quelle: erg.vorschlag[id2].herkunft };
    return null;
  };
  const knkTeile = [];
  let knkSumme = 0, knkVollstaendig = true;
  [['gest_p', 'Grunderwerbsteuer'], ['notar_p', 'Notar'], ['gba_p', 'Grundbuch'],
   ['makler_p', 'Maklercourtage']].forEach(([fid, name]) => {
    const s = satzVon(fid);
    if (!s || s.wert == null) { knkVollstaendig = false; knkTeile.push(name + ': unbekannt'); return; }
    const betrag = kp * s.wert / 100;
    knkSumme += betrag;
    knkTeile.push(name + ' ' + pct(s.wert) + ' = ' + eur(betrag) + '  (' + s.quelle + ')');
  });

  const kaufnebenkosten = {
    posten: knkTeile,
    summe: knkVollstaendig ? eur(knkSumme) : eur(knkSumme) + ' (unvollstaendig)',
    anteil_am_kaufpreis: knkVollstaendig ? pct(knkSumme / kp * 100) : null,
    gesamtinvestition: knkVollstaendig ? eur(kp + knkSumme) : null,
    vollstaendig: knkVollstaendig,
  };

  /* ── Finanzierung, wenn Vorgaben vorliegen ──────────────────────────── */
  let finanzierung = null;
  const zins = satzVon('d1z'), tilg = satzVon('d1t');
  const ekQuote = erg.vom_nutzer.ek_quote != null ? Number(erg.vom_nutzer.ek_quote) : null;
  /* ── v1824b · AUCH OHNE VOLLSTAENDIGE KAUFNEBENKOSTEN ────────────────
   *
   * Hier stand `knkVollstaendig` als Bedingung. GEMESSEN an Marcels
   * Objekt: die Maklercourtage ist nicht hinterlegt (sie ist
   * Verhandlungssache, es gibt keinen Richtwert) — und deshalb fiel die
   * ganze Finanzierung aus. Mit Zins und Tilgung, aber ohne Rechnung.
   *
   *   > Eine Luecke in einem Posten darf nicht die ganze Rechnung
   *   > ausknipsen. Sie gehoert benannt, nicht hochgerechnet auf alles.
   *
   * Gerechnet wird mit dem, was belegt ist, und der Hinweis sagt, in
   * welche Richtung das Ergebnis dadurch verschoben ist: fehlt ein
   * Kostenposten, ist das Darlehen zu klein und der Kapitaldienst zu
   * niedrig. */
  /* ── v1925 · DIE BEWIRTSCHAFTUNG, GENAU WIE calc.js SIE BILDET ────────
   *
   * Der Deal-Score haengt am Cashflow, und der Cashflow haengt an den
   * NICHT umlagefaehigen Bewirtschaftungskosten. Ohne sie faellt er zu
   * gut aus — und zwar deutlich: gemessen am Objekt ef9d0eb4 sind es
   * 1.599,46 EUR im Jahr, also 133 EUR im Monat, und der Score
   * verschiebt sich dadurch um zehn Punkte.
   *
   * Gebildet wird sie WOERTLICH nach `calc.js:1361-1404`, inklusive der
   * drei Modi, die das Formular kennt (der Modus steht am Datensatz, von
   * `storage.js:276` geschrieben):
   *
   *     detail   ul  = hg_ul + grundsteuer + ul_sonst + kp1..kp4
   *              nul = hg_nul + eigen_r + mietausfall + nul_sonst
   *     percent  Quoten auf die Jahreskaltmiete bzw. den Kaufpreis
   *
   * Die WEG-Ruecklage (`weg_r`) wird NICHT mitsummiert — sie steckt
   * bereits im Hausgeld; das Formular fuehrt sie als Infofeld
   * (calc.js:1346). Wer sie addiert, zaehlt sie zweimal.
   *
   *   > Eine Bewirtschaftungszahl, die nicht da ist, wird nicht
   *   > geschaetzt. Der Quick-Check der App zeigt ohne Hausgeld keinen
   *   > Score, und hier gilt dasselbe. */
  const bwkModus = d._bwk_mode || 'detail';
  let bwkUl = 0, bwkNul = 0, bwkHerkunft = null;
  if (bwkModus === 'percent') {
    if ((d._bwk_pct_mode || 'nkm') === 'kp') {
      const q = dez(d.bwk_kp_pct);
      if (q != null && q > 0) {
        bwkUl = kp * q / 100 * 0.5;
        bwkNul = kp * q / 100 * 0.5;
        bwkHerkunft = pct(q) + ' vom Kaufpreis (am Objekt, 50/50 geteilt)';
      }
    } else {
      const qu = dez(d.bwk_ul_pct), qn = dez(d.bwk_nul_pct);
      if ((qu != null && qu > 0) || (qn != null && qn > 0)) {
        bwkUl = nkm * 12 * (qu || 0) / 100;
        bwkNul = nkm * 12 * (qn || 0) / 100;
        bwkHerkunft = 'Quoten der Jahreskaltmiete (am Objekt): '
          + pct(qu || 0) + ' umlagefaehig, ' + pct(qn || 0) + ' nicht umlagefaehig';
      }
    }
  } else {
    const ulT = ['hg_ul', 'grundsteuer', 'ul_sonst', 'kp1', 'kp2', 'kp3', 'kp4'];
    const nulT = ['hg_nul', 'eigen_r', 'mietausfall', 'nul_sonst'];
    const sum = (ids) => ids.reduce((a, k2) => a + (z(d[k2]) || 0), 0);
    const hatEtwas = ulT.concat(nulT).some((k2) => z(d[k2]) != null && z(d[k2]) !== 0);
    if (hatEtwas) {
      bwkUl = sum(ulT);
      bwkNul = sum(nulT);
      bwkHerkunft = 'aus den Einzelposten am Objekt (Hausgeld, Grundsteuer, '
        + 'Ruecklage, Mietausfallwagnis)';
    }
  }
  const bwkDa = bwkHerkunft != null;

  /* ── Finanzierung und Kennzahlen: EIN Lauf des Kerns ──────────────────
   *
   * v1925: hier liefen vorher zwei getrennte `rechenkerne.kpis()`-Aufrufe
   * nebeneinander — einer ohne Bewirtschaftung fuer die Finanzierung, und
   * der Score haette einen zweiten gebraucht. Zwei Laeufe desselben Kerns
   * mit verschiedenen Eingaben liefern zwei verschiedene Cashflows, und
   * im Chat staende dann beides.
   *
   *   > Dieselbe Kennzahl darf in einer Antwort nur EINMAL vorkommen.
   *
   * Also ein Lauf mit allem, was belegt ist, und die Beschriftung sagt,
   * was drinsteckt. */
  let K = null, darlehen = null, ek = null;
  /* Steht hier und nicht erst beim Score: ob das Objekt in DealPilot schon
     gerechnet wurde, entscheidet AUCH ueber die Finanzierung (Block
     darunter). */
  const sGespeichert = dialog.scoreLesen(d);
  if (zins && tilg) {
    const gi = kp + knkSumme;
    ek = ekQuote != null ? gi * ekQuote / 100 : (z(d.ek) || 0);
    /* ── v1925 · WANN EIN DARLEHEN ABGELEITET WERDEN DARF ──────────────
     *
     * Das Darlehen am Objekt schlaegt jede Ableitung — es ist die
     * eingetragene Zahl. Fehlt es, hing es bisher an den Vorgaben:
     * `Gesamtinvestition minus Eigenkapital`. So macht es der Quick-Check
     * der App, der kein Darlehensfeld hat, und so soll es bleiben, solange
     * ein Objekt noch nicht gerechnet ist.
     *
     * GEMESSEN am 06.10.2026 auf Staging, und es war falsch: die Objekte
     * 18ecfdd8 (Sachsenstr. 18) und 2c14c9b3 fuehren Zins und Tilgung,
     * aber KEIN Darlehen — `_kpis_dscr` steht dort auf 0, DealPilot
     * rechnet sie also als Barkauf. Der Schnellblick leitete trotzdem
     * 196.560 EUR Darlehen ab und meldete 972 EUR Ueberschuss, wo die App
     * 10.800 EUR zeigt. Daneben stand der gespeicherte Score 68 — eine
     * richtige Zahl und eine erfundene in derselben Antwort.
     *
     *   > Ein Objekt, das in DealPilot gerechnet wurde, hat seine
     *   > Finanzierung dort. Was dort fehlt, fehlt absichtlich.
     *
     * Also: abgeleitet wird nur, wenn das Objekt noch KEINEN gerechneten
     * Score hat. Sonst gilt, was eingetragen ist — auch die Null. */
    const d1Objekt = z(d.d1);
    const darlehenGesetzt = d1Objekt != null && d1Objekt > 0;
    const darlehenAbgeleitet = !darlehenGesetzt && sGespeichert.dealscore == null;
    darlehen = darlehenGesetzt ? d1Objekt
      : (darlehenAbgeleitet ? Math.max(0, gi - ek) : 0);

    /* AfA und Grenzsteuersatz nur, wenn sie am Objekt stehen — sonst 0,
       dann ist der Cashflow vor Steuer gleich dem nach Steuer. */
    const gebAnt = dez(d.geb_ant), afaSatz = dez(d.afa_satz);
    const afa = (gebAnt != null && gebAnt > 0)
      ? (kp + knkSumme) * (gebAnt / 100) * ((afaSatz != null ? afaSatz : 2) / 100) : 0;
    const svw = z(d.svwert) || z(d.bankval) || 0;

    K = rechenkerne.kpis({
      kp: kp, nk: knkSumme, san: z(d.san) || 0, moebl: z(d.moebl) || 0,
      nkm: nkm, ze: ze, uf: 0,
      bwk_ul: bwkUl, bwk_nul: bwkNul,
      d1: darlehen, d1z: zins.wert, d1t: tilg.wert, ek: ek,
      afa: afa, grenz: dez(d.grenz) || 0,
      ekInklNkLtv: d.ek_inkl_nk === true || d.ek_inkl_nk === 'true'
                || d._ek_ist_nk === true || d._ek_ist_nk === 'true',
      svw: svw
    });

    finanzierung = {
      eigenkapital: eur(ek) + (ekQuote != null ? '  (' + pct(ekQuote) + ' deiner Vorgabe)' : ''),
      darlehen: eur(darlehen)
        + (darlehenGesetzt ? '  (am Objekt hinterlegt)'
            : darlehenAbgeleitet
              ? '  ANGENOMMEN: Gesamtinvestition minus Eigenkapital. Am Objekt '
                + 'steht kein Darlehen. Sag das dem Nutzer.'
              : '  Am Objekt steht KEIN Darlehen, und das Objekt ist in '
                + 'DealPilot schon gerechnet — dort gilt es als Barkauf. '
                + 'Es wird keins angenommen. Frag den Nutzer, ob ein Darlehen '
                + 'fehlt.'),
      zins: pct(zins.wert) + '  (' + zins.quelle + ')',
      tilgung: pct(tilg.wert) + '  (' + tilg.quelle + ')',
      kapitaldienst_jahr: eur(K.rate_j)
        + '  = ' + eur(darlehen) + ' x ' + pct(zins.wert + tilg.wert),
      bewirtschaftung_jahr: bwkDa
        ? eur(bwkUl + bwkNul) + ' gesamt, davon ' + eur(bwkNul)
          + ' nicht umlagefaehig  (' + bwkHerkunft + ')'
        : 'nicht hinterlegt',
      /* v1925: die Beschriftung richtet sich danach, was wirklich drin
         steckt. Vorher hiess diese Zeile immer „vor BWK und Steuer" —
         mit hinterlegtem Hausgeld war das falsch beschriftet. */
      ueberschuss_jahr: eur(K.cf_op)
        + (bwkDa ? '  (nach Bewirtschaftung und Kapitaldienst, vor Steuer)'
                 : '  (nach Kapitaldienst, OHNE Bewirtschaftung, vor Steuer)'),
      hinweis_ueberschuss: bwkDa
        ? 'Miete minus nicht umlagefaehige Bewirtschaftung minus Kapitaldienst, '
          + 'vor Steuer. Die umlagefaehigen Kosten sind ein durchlaufender '
          + 'Posten und stehen bewusst nicht drin.'
        : 'Das ist die Miete MINUS Kapitaldienst — ohne '
          + 'Bewirtschaftungskosten und ohne Steuer. Am Objekt ist kein '
          + 'Hausgeld hinterlegt; der echte Cashflow liegt darunter.',
      /* Die Richtung der Verschiebung, wenn ein Kostenposten fehlt. */
      vorbehalt: knkVollstaendig ? undefined
        : 'Bei den Kaufnebenkosten fehlt noch ein Posten. Die Gesamtinvestition '
          + 'ist dadurch ZU KLEIN, also das Darlehen zu klein und der '
          + 'Kapitaldienst zu niedrig — der Überschuss sieht besser aus, als er '
          + 'ist. Sag das dem Nutzer und frag nach dem fehlenden Satz.',
    };
  }

  /* ── v1925 · DER DEAL-SCORE UND DIE HEURISTIK ─────────────────────────
   *
   * Marcels Auftrag, woertlich: „dass dann natuerlich der Deal-Score
   * berechnet wird und dann auch die Bewertung der Heuristik mit
   * angegeben wird."
   *
   * Beides kommt aus den gespiegelten Kernen der App:
   *   DealScore.computeFromKpis()  (dealscore.js)
   *   QcHeuristik.bewerten()       (qc-heuristik.js)
   *
   * Der Weg ist derselbe, den der Quick-Check im Browser geht
   * (quick-check.js Z. 534-606): DealKpis -> die fuenf Groessen
   * cf_m / nmy / ltv / dscr / wp_kpi -> DealScore.
   *
   * GEMESSEN am 06.10.2026 am Objekt ef9d0eb4 (Staging): dieser Weg gibt
   * Score 77 — bitgleich zum gespeicherten `_dealpilot_score`, und
   * bmy, nmy, ltv, dscr, bwk, cf_op, cf_m stimmen auf die letzte Stelle
   * mit den gespeicherten `_kpis_*` ueberein.
   *
   * ── WAS FEHLEN DARF UND WAS NICHT ────────────────────────────────── */
  /* ── v1927 · HIER FEHLTE DIE HEURISTIK GENAU DANN, WENN ES ZAEHLT ────
   *
   * GEMESSEN an Marcels Telegram-Chat vom 06.10.2026, 22:22 Uhr — also
   * NACH dem Rollout von v1925:
   *
   *   „Der DealPilot-Score fuer die Wohnung in der Sachsenstrasse 18 …
   *    betraegt 68 und ist in der Kategorie SOLIDE."
   *
   * Und sonst nichts. Keine Empfehlung, keine Einschaetzung, keine
   * Kennzahl. Der Grund stand hier: der Zweig fuer den GESPEICHERTEN
   * Score gab Zahl und Stufe zurueck und hoerte dort auf. Die Heuristik
   * lief nur im anderen Zweig — also nur an Objekten, die in DealPilot
   * noch NICHT gerechnet waren.
   *
   *   > Genau die Objekte, die der Nutzer am besten kennt, bekamen die
   *   > duennste Antwort. Ein Zweig, der weniger kann als sein
   *   > Geschwister, faellt nicht auf: er liefert ja etwas.
   *
   * Richtig ist: der SCORE hat eine Quelle (gespeichert ODER gerechnet,
   * nie beides), die HEURISTIK laeuft immer — sie ist eine Funktion des
   * Scores und der Kennzahlen, und die Kennzahlen kommen in beiden
   * Faellen aus demselben Kern.
   *
   * ── WAS FEHLEN DARF UND WAS NICHT ────────────────────────────────── */
  let bewertung = null;
  const scoreFehlt = [];
  if (!zins || !tilg) scoreFehlt.push('Zinssatz und Tilgung');
  if (!bwkDa) scoreFehlt.push('Hausgeld bzw. Bewirtschaftungskosten');

  const svw2 = z(d.svwert) || z(d.bankval) || 0;
  /* Der Wertpuffer ist `Verkehrswert minus Kaufpreis` (calc.js:2036).
     Ohne Verkehrswert nimmt der Quick-Check 5 % vom Kaufpreis an — das
     ist eine ANNAHME und steht als solche im Ergebnis. */
  const wp = svw2 > 0 ? svw2 - kp : kp * 0.05;

  /* ── 1 · WELCHER SCORE GILT — genau einer ─────────────────────────────
   * Liegt ein in DealPilot gerechneter vor, gilt DIESER, und es wird kein
   * zweiter gerechnet. Der Quick-Check-Score weicht bewusst ab
   * (quick-check.js V63.22: er kennt weniger Felder), und zwei Zahlen
   * nebeneinander waeren die zweite Meinung, die hier nie entstehen soll.
   * Deshalb gibt es im gespeicherten Fall auch KEINE Teilnoten: sie sind
   * die Zerlegung EINER Rechnung, und diese Rechnung hat hier nicht
   * stattgefunden. */
  let score = null, herkunft = null, teilnoten = null, teilnotenRoh = null;
  if (sGespeichert.dealscore != null) {
    score = sGespeichert.dealscore;
    herkunft = 'in DealPilot gerechnet und am Objekt gespeichert';
  } else if (!scoreFehlt.length) {
    const mstg = dez(d.mietstg) != null ? dez(d.mietstg) : 1.5;
    const S = rechenkerne.score({
      kp: kp, cf_m: K.cf_m, nmy: K.nmy, ltv: K.ltv, dscr: K.dscr,
      wp_kpi: wp, mstg: mstg
    });
    score = S.score;
    herkunft = 'Quick-Check-Score — gerechnet mit demselben Kern wie die App '
      + '(DealKpis + DealScore). Das Objekt wurde in DealPilot noch nicht '
      + 'vollstaendig gerechnet; der Vollbild-Score kann abweichen, weil er '
      + 'mehr Felder kennt.';
    teilnoten = S.breakdown.map((b) => ({
      was: b.label, punkte: Math.round(b.score) + ' von 100',
      gewicht: b.weight + ' %', grundlage: b.input
    }));
    /* v1936: dieselben Punkte, aber nach Schluessel — `qc-heuristik.js`
       traegt sie in die fuenf Kategorien ein und rechnet sie NICHT nach. */
    teilnotenRoh = {};
    S.breakdown.forEach((b) => { teilnotenRoh[b.key] = b.score; });
  }

  if (score == null) {
    bewertung = {
      dealpilot_score: null,
      geht_noch_nicht: scoreFehlt,
      hinweis: 'Fuer den Deal-Score fehlt ' + scoreFehlt.join(' und ') + '. '
        + 'Der Quick-Check der App zeigt ohne diese Angaben auch keinen Score — '
        + 'es wird nichts geschaetzt. Frag genau danach, EINE Angabe auf einmal.'
    };
  } else {
    /* ── 2 · DIE KENNZAHLEN UND DIE HEURISTIK — immer, wenn sie gehen ── */
    const bwkQuote = (K && K.nkm_j > 0) ? (K.bwk / K.nkm_j * 100) : null;
    /* ── v1938 · EINE LISTE FUER ALLE ANZEIGEN ───────────────────────────
     * Welche Groesse an diesem Objekt gar nicht anwendbar ist, steht
     * EINMAL da — und sowohl die Ampel als auch die fuenf Kategorien lesen
     * sie. Gemessen an der Sachsenstr. 18: solange die beiden ihre eigene
     * Fallunterscheidung fuehrten, sagte die Ampel „entfaellt" und die
     * Kategorie zwei Zeilen darunter „LTV 0 %". */
    const nichtAnwendbar = {
      dscr: (darlehen > 0) ? null : 'ohne Kapitaldienst gibt es keinen Deckungsgrad',
      ltv: (darlehen > 0) ? null : 'am Objekt ist kein Darlehen hinterlegt',
      bwk: bwkDa ? null : 'am Objekt ist keine Bewirtschaftung hinterlegt',
      ekr: (ek > 0) ? null : 'ohne eingesetztes Eigenkapital nicht berechenbar'
    };
    /* ── v1939 · DIE MARKTPREISINDIKATION GEHOERT IN DIE HEURISTIK ───────
     *
     * Marcel am 07.10.2026: „Wenn es einen Preis gibt dann sollte man
     * diesen auch mit in die heuristic bauen. Marktpreisindikation die
     * daten mit in die heuristic uebergeben und mit score zusammen
     * auswerten."
     *
     * Deshalb wird sie hier GELESEN, bevor die Heuristik laeuft — nicht
     * erst danach fuer die KI. Der uebergebene Wert ist der BEREINIGTE
     * (Angebotsabschlag schon drin, siehe `_marktpreisIndikation`), damit
     * der Abschlag genau einmal wirkt. */
    const mpiFrueh = await _marktpreisIndikation(ctx.userId, id, d, kp);
    const marktBasis = (mpiFrueh && mpiFrueh.vergleich) ? mpiFrueh.vergleich._basis : null;
    const marktGrund = (mpiFrueh && mpiFrueh.vergleich) ? mpiFrueh.vergleich._abschlag_grund : null;

    const H = K ? rechenkerne.heuristik({
      score: score, kp: kp, nkm: nkm + ze,
      bmr: K.bmy, nmr: K.nmy, cfMon: K.cf_m, dscr: K.dscr, ltv: K.ltv,
      ekr: K.ekr, bewirtPctNkm: bwkQuote || 0,
      marktwert: marktBasis, marktwert_grund: marktGrund
    }, undefined, nichtAnwendbar) : null;

    bewertung = {
      dealpilot_score: score,
      stufe: rechenkerne.stufe(score).versal,
      herkunft: herkunft,
      investor_deal_score: sGespeichert.investor,
      investor_stufe: sGespeichert.investorStufe,
      teilnoten: teilnoten || undefined,
      /* ── v1927 · NULL IST NICHT „NICHT GERECHNET" ────────────────────
       *
       * GEMESSEN am 07.10.2026 an der Sachsenstr. 18: ohne hinterlegtes
       * Darlehen gab der Kern `dscr 0,00` und `ltv 0,00 %` aus, und so
       * stand es im Ergebnis. Beides ist keine Null, sondern eine Groesse,
       * die es ohne Schuldendienst gar nicht gibt — eine 0,00 beim DSCR
       * liest sich wie „deckt den Kapitaldienst nicht", und das Gegenteil
       * ist der Fall.
       *
       *   > Eine Kennzahl, die nicht anwendbar ist, gehoert benannt und
       *   > nicht beziffert. Eine Null behauptet eine Messung.
       *
       * Dasselbe bei der Bewirtschaftungsquote: 0,00 % heisst hier nicht
       * „keine Kosten", sondern „nicht hinterlegt". Und der Cashflow
       * traegt dann einen Zusatz, weil er ohne Bewirtschaftung zu gut
       * aussieht. Der KERN bleibt unberuehrt — gerechnet wird weiter mit
       * dem, was er liefert; nur die Beschriftung sagt die Wahrheit. */
      kennzahlen: K ? {
        cashflow_monat: Math.round(K.cf_m).toLocaleString('de-DE') + ' EUR vor Steuer'
          + (bwkDa ? '' : '  — OHNE Bewirtschaftung, am Objekt ist keine hinterlegt. '
                        + 'Der echte Wert liegt darunter.'),
        nettomietrendite: pct(K.nmy),
        ltv: (darlehen > 0) ? pct(K.ltv)
          : 'entfaellt — am Objekt ist kein Darlehen hinterlegt',
        dscr: (darlehen > 0) ? K.dscr.toFixed(2).replace('.', ',')
          : 'entfaellt — ohne Kapitaldienst gibt es keinen Deckungsgrad',
        bewirtschaftungsquote: bwkDa ? (pct(bwkQuote) + ' der Jahreskaltmiete')
          : 'nicht hinterlegt',
      } : undefined,
      kennzahlen_fehlen: K ? undefined
        : 'Cashflow, DSCR, LTV und Nettomietrendite brauchen ' + scoreFehlt.join(' und ')
          + '. Sie werden nicht geschaetzt — frag danach.',
      wertpuffer: !K ? undefined : (svw2 > 0
        ? eur(wp) + '  (Verkehrswert ' + eur(svw2) + ' minus Kaufpreis)'
        : eur(wp) + '  ANGENOMMEN: 5 % vom Kaufpreis, weil kein Verkehrswert '
          + 'hinterlegt ist. Sag das dem Nutzer.'),
      /* ── DIE HEURISTIK, VOLLUMFAENGLICH ──────────────────────────────
       *
       * v1936. Marcel am 07.10.2026: „beim Quickcheck geben wir doch immer
       * diese Heuristik aus, was dabei rauskommt. Das muss doch da
       * vollumfaenglich stehen."
       *
       * GEMESSEN, was der Quick-Check unten WIRKLICH zeigt — und was der
       * Bot bis v1935 davon lieferte:
       *
       *   Satz zur Stufe (#qc-top-deal-desc)   fehlte
       *   7 Kennzahlen mit Ampel               nur 5, ohne Ampel
       *   5 Kategorien mit Rechenweg           nur Punkte, ohne Skala
       *   Einschaetzungszeilen                 war da
       *   Kaufempfehlung                       war da
       *
       *   > Ein Teil der Heuristik sieht aus wie die Heuristik. Wer nur
       *   > das Urteil weitergibt, gibt die Begruendung nicht weiter —
       *   > und genau die wollte der Nutzer.
       *
       * Alle fuenf kommen jetzt aus `qc-heuristik.js`, also aus derselben
       * Datei, die der Browser laedt. */
      stufensatz: H ? rechenkerne.heuristikTeil('stufensatz',
        rechenkerne.stufe(score).farbe) : undefined,
      kennzahlen_ampel: K ? rechenkerne.heuristikTeil('kennzahlenAmpel',
        { bmr: K.bmy, nmr: K.nmy, ekr: K.ekr, cfMon: K.cf_m,
          dscr: K.dscr, ltv: K.ltv, bewirtPctNkm: bwkQuote || 0 }, nichtAnwendbar) : undefined,
      kategorien: K ? rechenkerne.heuristikTeil('kategorien',
        { bmr: K.bmy, nmr: K.nmy, ekr: K.ekr, cfMon: K.cf_m,
          dscr: K.dscr, ltv: K.ltv, bewirtPctNkm: bwkQuote || 0 },
        teilnotenRoh, nichtAnwendbar) : undefined,
      empfehlung: H && H.empfehlung ? H.empfehlung.verdict : null,
      empfehlung_text: H && H.empfehlung ? H.empfehlung.text : null,
      einschaetzung: H ? H.einschaetzung : undefined,
      hinweis: 'Das ist die Bewertung, die der Quick-Check in DealPilot unten '
        + 'anzeigt — dieselben Schwellen, dieselben Saetze, VOLLSTAENDIG. '
        + 'Gib sie in EINER Nachricht aus, in dieser Reihenfolge: '
        + '1. Score mit Stufe und "stufensatz". '
        + '2. "kennzahlen_ampel" — alle sieben, je Zeile Wert und Ampel '
        + '(gruen/gelb/rot); was "entfaellt" traegt, nennst du mit seinem Grund '
        + 'und NICHT als Zahl. '
        + '3. "kategorien" — die fuenf mit Punkten und Wert; den "rechenweg" nur, '
        + 'wenn der Nutzer nachfragt. '
        + '4. "empfehlung" und "empfehlung_text". '
        + '5. "einschaetzung" — ALLE Zeilen, keine weglassen. '
        + '6. "marktpreisindikation", wenn sie vorhanden ist. '
        + '7. "ki_einordnung" zum Schluss. '
        + 'Texte UNVERAENDERT uebernehmen, nichts dazuerfinden, nichts nachrechnen.'
    };

    /* ── v1927 · DIE EINORDNUNG DER KI ───────────────────────────────────
     *
     * Marcel am 07.10.2026: „dass wir … das Ganze in die KI werfen, dass
     * wir da noch mal was dazu bekommen. … dass wir da einmal eine
     * komplette Bewertung bekommen."
     *
     * ZULETZT, und nur zu dem, was oben gerechnet ist. Die Reihenfolge
     * ist die Aussage: erst die Zahlen, dann die Regel, dann die Meinung.
     * Begruendung steht in `services/bewertungsText.js`.
     *
     * KEIN STILLER AUSFALL: faellt die KI aus, kommt die Bewertung
     * trotzdem — mit dem Grund im Ergebnis, nicht mit einer Luecke. */
    /* ── v1937 · DIE MARKTPREISINDIKATION, WENN ES EINE GIBT ─────────────
     * Sie wird GELESEN, nicht abgerufen — ein Abruf kostet und braucht
     * eine Freigabe. Steht nichts da, steht das auch so im Ergebnis. */
    /* v1939: EIN Aufruf. Die Indikation wurde oben schon gelesen, weil die
       Heuristik sie braucht — ein zweiter Lauf waere ein zweiter DB-Zugriff
       und, schlimmer, eine zweite Zahl. */
    bewertung.marktpreisindikation = mpiFrueh;
    const mpi = mpiFrueh;

    const einordnung = await bewertungsText.einordnung({
      adresse: _adrVon(o),
      objektart: d.objart || d.objektart || null,
      baujahr: d.baujahr || null,
      wohnflaeche: wfl ? wfl + ' m²' : null,
      kaufpreis: eur(kp),
      jahreskaltmiete: rechnung.jahreskaltmiete,
      bruttomietrendite: rechnung.bruttomietrendite,
      kaufpreisfaktor: rechnung.kaufpreisfaktor,
      kennzahlen: bewertung.kennzahlen,
      score: bewertung.dealpilot_score,
      stufe: bewertung.stufe,
      teilnoten: bewertung.teilnoten,
      empfehlung: bewertung.empfehlung,
      empfehlung_text: bewertung.empfehlung_text,
      einschaetzung: bewertung.einschaetzung,
      /* v1937 · Die Marktpreisindikation geht MIT hinein — fertig
         gerechnet und anbieterneutral. Die KI ordnet sie ein; die
         Abweichung in Prozent hat sie nicht selbst gebildet. */
      marktwert: (mpi && mpi.vergleich) ? mpi.vergleich.marktwert : null,
      marktwert_roh: (mpi && mpi.vergleich) ? mpi.vergleich.marktwert_laut_quelle : null,
      angebotsabschlag: (mpi && mpi.vergleich) ? mpi.vergleich.angebotsabschlag : null,
      marktwert_herkunft: (mpi && mpi.vergleich) ? mpi.vergleich.grundlage : null,
      kaufpreis_zu_marktwert: (mpi && mpi.vergleich) ? mpi.vergleich.kaufpreis_zu_marktwert : null,
      marktmiete_monat: (mpi && mpi.quellen)
        ? (mpi.quellen.find((q) => q.marktmiete_monat) || {}).marktmiete_monat || null : null,
      /* Was die Rechnung traegt und was sie nicht traegt — damit die
         Einordnung nicht sicherer klingt als die Zahlen darunter. */
      vorbehalte: [
        knkVollstaendig ? null
          : 'Bei den Kaufnebenkosten fehlt ein Posten; Darlehen und Kapitaldienst '
            + 'sind dadurch eher zu niedrig.',
        (svw2 > 0) ? null
          : 'Es ist kein Verkehrswert hinterlegt; der Wertpuffer ist mit 5 % vom '
            + 'Kaufpreis ANGENOMMEN, nicht gemessen.',
        bwkDa ? null
          : 'Am Objekt ist keine Bewirtschaftung hinterlegt. Der Cashflow ist '
            + 'dadurch ZU HOCH — die nicht umlagefaehigen Kosten fehlen darin.',
        (K && !(darlehen > 0)) ? 'Am Objekt ist kein Darlehen hinterlegt; gerechnet '
          + 'ist das wie ein Barkauf. DSCR und LTV entfallen deshalb.' : null,
        (mpi && mpi.vorhanden === false)
          ? 'Es liegt KEINE Marktpreisindikation vor. Sage nichts darueber, ob der '
            + 'Kaufpreis marktgerecht ist — du weisst es nicht.' : null,
        bewertung.kennzahlen_fehlen || null
      ].filter(Boolean)
    }, { userApiKey: ctx.userApiKey || null });

    if (einordnung.ok) {
      bewertung.ki_einordnung = einordnung.text;
      bewertung.ki_modell = einordnung.modell;
    } else {
      bewertung.ki_einordnung = null;
      bewertung.ki_einordnung_fehlt = einordnung.grund
        + ' Die Bewertung oben gilt trotzdem — sie ist gerechnet, nicht von der '
        + 'KI. Sag dem Nutzer in EINEM Satz, dass die Einordnung diesmal fehlt, '
        + 'und schreibe KEINE eigene an ihrer Stelle.';
    }
  }

  return {
    gefunden: true, id: id, adresse: _adrVon(o),
    objektart: d.objart || d.objektart || null,
    baujahr: d.baujahr || null,
    wohnflaeche: wfl ? wfl + ' m²' : null,
    rechnung,
    kaufnebenkosten,
    finanzierung,
    fehlende_angaben: erg.fehlt.length
      ? erg.fehlt.map((f) => erg.beschriftung[f] || f) : undefined,
    vorgaben_hinterlegt: erg.hat_vorgaben,
    /* ── v1925 · DER SCORE UND DIE HEURISTIK STEHEN JETZT HIER ───────── */
    bewertung,
    /* v1887 · Die Adresse steht hier seit jeher im Ergebnis — der Hinweis
       hat nie verlangt, sie auch hinzuschreiben. GEMESSEN am 05.10.2026:
       der Bot gab die Kennzahlen der Löhner Str. 278 (233 m², 350.000 €,
       1.400 €/Monat) unter der Ueberschrift "Sachsenstraße 18" aus. Jede
       einzelne Zahl war richtig gerechnet; nur das Haus war ein anderes.

         > Eine Zahl ohne ihr Objekt ist nicht pruefbar. Und eine Zahl
         > unter dem FALSCHEN Objekt sieht genauso aus wie eine richtige. */
    hinweis: 'Schreibe die Adresse aus "adresse" WOERTLICH ueber die Zahlen — '
      + 'nicht die, die der Nutzer gesagt hat. Weichen beide voneinander ab, '
      + 'nennst du die Zahlen NICHT, sondern sagst, welches Objekt du gefunden '
      + 'hast, und fragst nach. '
      + 'Gib dem Nutzer die Zahlen MIT ihrem Rechenweg, so wie sie hier '
      + 'stehen — sie sind fertig formatiert. '
      /* v1925: hier stand „Sag ausdruecklich, dass das noch kein Score ist".
         Es IST jetzt einer — und zwar der, den die App rechnet. */
      + 'Der Block "bewertung" traegt den DEAL-SCORE mit seiner Stufe, die '
      + 'KAUFEMPFEHLUNG und die EINSCHAETZUNGSZEILEN des Quick-Checks. Nenne '
      + 'sie: Score mit Stufe, dann die Empfehlung, dann die Einschaetzung. '
      + 'Steht dort "geht_noch_nicht", nennst du KEINEN Score und fragst nach '
      + 'den genannten Angaben — erfinde keinen und schaetze nicht. '
      + 'Steht dort "herkunft", sag auch, woher der Score kommt. '
      + (erg.hat_vorgaben
          ? 'Der Nutzer hat Vorgaben hinterlegt; sie sind eingesetzt und als '
            + '"deine Vorgabe" gekennzeichnet. '
          : 'Der Nutzer hat KEINE Vorgaben hinterlegt. Frag ihn EINMAL, ob er '
            + 'Zinssatz, Tilgung und Eigenkapitalquote fuer kuenftige Objekte '
            + 'hinterlegen will — mit vorgaben_setzen. Danach nie wieder fragen. ')
      + (erg.fehlt.length
          ? 'Nenne die fehlenden Angaben und frag nach ihnen — EINE auf einmal. '
          : '')
      + 'Biete am Ende die Marktpreisindikation an und sag, dass sie einen Abruf '
      + 'aus dem Kontingent kostet (marktbericht_preis nennt den Preis). '
      /* v1925: hier stand „Behaupte KEINE Kaufempfehlung". Jetzt gibt es
         eine — aber nur die aus dem Kern, nie eine eigene. */
      + 'Die Kaufempfehlung steht in "bewertung.empfehlung" und ihr Text in '
      + '"bewertung.empfehlung_text". Nimm BEIDE woertlich. Steht dort nichts, '
      + 'sprichst du KEINE Empfehlung aus — auch keine vorsichtige.'
  };
}

/* ── v1824 · DIE VORGABEN SETZEN ─────────────────────────────────────────
 *
 * Marcel: "Soll ich irgendwie kuenftig die Sachen dann hinterlegen? Aber
 * nur dann, wenn nichts hinterlegt ist, dass man einmal fragt, dann wird
 * es naechstes Mal schneller gehen."
 *
 * Darum prueft `objekt_schnellblick` selbst, ob Vorgaben da sind, und
 * sagt dem Modell nur im Leerfall, dass es fragen soll. Die Frage kommt
 * EINMAL — danach stehen die Werte.
 */
async function vorgaben_setzen(ctx, args) {
  const felder = (args && args.felder) || {};
  if (!Object.keys(felder).length) {
    return { ok: false,
      moeglich: Object.fromEntries(Object.entries(vorgaben.ERLAUBT)
        .map(([id, r]) => [id, r.label + ' in ' + r.einheit])),
      hinweis: 'Gib in "felder" die Werte an, die der Nutzer genannt hat. '
             + 'Erfinde keine — nur was er gesagt hat.' };
  }
  const r = await vorgaben.setzen(ctx.userId, felder);
  return {
    ok: r.uebernommen.length > 0,
    uebernommen: r.uebernommen.map((id) =>
      (vorgaben.ERLAUBT[id] ? vorgaben.ERLAUBT[id].label : id) + ': ' + r.vorgaben[id]),
    abgewiesen: r.abgewiesen.length ? r.abgewiesen : undefined,
    hinweis: (r.abgewiesen.length
      ? 'Abgewiesen wurde, was nicht in den erlaubten Rahmen passt (ein Zinssatz '
        + 'von 50 % ist ein Tippfehler, kein Zinssatz). Frag diese Werte nochmal. '
      : '')
      + 'Bestaetige dem Nutzer kurz, was hinterlegt ist, und sag, dass es ab '
      + 'jetzt automatisch benutzt wird. Er kann es jederzeit aendern.'
  };
}

async function feld_katalog(ctx, args) {
  /* ── v1812b · DIE UMLAUTFALLE, ZUM VIERTEN MAL AN EINEM TAG ──────────
   *
   * GEMESSEN: der Agent suchte "wohnflaeche" und bekam NICHTS — das Feld
   * heisst `wfl` und traegt das Label "Wohnfläche (m²)". Daraufhin
   * antwortete er dem Nutzer: "Es gibt kein Feld fuer Wohnflaeche."
   *
   * Dieselbe Falle hatte heute schon "parkstr", "portfolios" und
   * "Wohnflaeche" in `_feldAusSatz`. Dort habe ich `_flach()` gebaut —
   * und hier nicht angewandt.
   *
   *   > Eine Falle, gegen die man an einer Stelle ein Mittel hat, trifft
   *   > einen an der naechsten. Das Mittel gehoert nicht an die Stelle,
   *   > sondern an jede.
   *
   * Zusaetzlich beidseitig: wer "flaeche" sucht, soll "Wohnfläche"
   * finden, und wer "Wohnfläche (m²)" eingibt, soll `wfl` finden. */
  const suche = _flach(String((args && args.suche) || '').trim());
  let felder = fuehrung.katalog();
  if (suche) {
    felder = felder.filter((f) => {
      const id = _flach(f.id);
      const label = _flach(f.label);
      return id.indexOf(suche) >= 0 || label.indexOf(suche) >= 0
          || (suche.length >= 5 && suche.indexOf(label) >= 0 && label.length >= 4);
    });
  }
  /* Ohne Suche nur die Auswahlfelder und die wichtigsten — der ganze
     Katalog waere ein Dump, und ein Dump macht den Agenten beliebiger. */
  if (!suche) felder = felder.filter((f) => f.kind === 'select').slice(0, 60);
  return { anzahl: felder.length, felder: felder.slice(0, 60) };
}

/* ═══ SCHREIBEN (brauchen Bestaetigung) ═══════════════════════════════ */

async function felder_aendern(ctx, args) {
  const id = await _findeObjekt(ctx, args);
  if (!id) return { ok: false, hinweis: 'Kein Objekt zu dieser Angabe gefunden.' };
  let felder = Object.assign({}, (args && args.felder) || {});

  /* v1806 · Auch hier der Freitext — aus demselben Grund wie bei
     `objekt_anlegen`: das Modell kennt die Feldnamen nicht. "setz die
     Wohnflaeche auf 85" trifft `wfl` nur, wenn jemand den Namen kennt. */
  const text = String((args && args.beschreibung) || '').trim();
  if (text) {
    /* ── v1807 · ZUERST DAS GENANNTE FELD, DANN DIE EXTRAKTION ─────────
     *
     * GEMESSEN: "setz den Zustand auf total marode" landete als
     * `notizen: "total marode"` — die Extraktion ordnete den Satz einem
     * FREITEXTFELD zu, nicht dem Auswahlfeld `ds2_zustand`. Das Werkzeug
     * fragte daraufhin brav zurueck, aber zum falschen Feld; und der
     * Agent meldete "Zustand wurde auf total marode gesetzt".
     *
     *   > Eine Aenderung am falschen Feld ist schlimmer als gar keine.
     *   > Sie wird gemeldet, geglaubt — und steht dann an einer Stelle,
     *   > an der sie nichts bewirkt.
     *
     * Deshalb wird zuerst geprueft, ob der Nutzer ein Feld BEIM NAMEN
     * nennt. Ist es ein Auswahlfeld, wird die Angabe gegen seine Werte
     * gehalten — und bei Unklarheit gefragt, mit den Moeglichkeiten. */
    const genannt = _feldAusSatz(text);
    if (genannt && felder[genannt.feld.id] == null) {
      felder[genannt.feld.id] = genannt.wert;
    }

    try {
      const o0 = await dialog.objektKontext(ctx.userId, id);
      const r = await voiceExtract.extractFromText(text, fuehrung.katalog(), {
        apiKey: config.openai.apiKey, modus: 'antwort',
        kontext: (o0 && o0.daten) || {}
      });
      Object.entries((r && r.fields) || {}).forEach(([fid, w]) => {
        /* Was die Extraktion in ein FREITEXTFELD gelegt hat, obwohl der
           Nutzer ein anderes Feld genannt hat, wird verworfen — sonst
           steht derselbe Satz zweimal im Datensatz. */
        if (genannt && fid !== genannt.feld.id
            && String(w).toLowerCase().indexOf(String(genannt.wert).toLowerCase()) >= 0) return;
        if (felder[fid] == null) felder[fid] = w;
      });
    } catch (e) { /* dann eben nur die ausdruecklichen Felder */ }
  }

  /* ── Auswahlfelder: niemals einen ungueltigen Wert schreiben ────────
   *
   * Marcel, Punkt 3: "Bei Feldern mit definierten Auswahlmoeglichkeiten
   * darf der Copilot keine ungueltigen Werte einfach uebernehmen."
   *
   * Was sich eindeutig zuordnen laesst, wird zugeordnet (Gross-/Klein-
   * schreibung, Teilwort). Was nicht, kommt als Rueckfrage zurueck — mit
   * den Moeglichkeiten. */
  const geprueft = {}, nachfragen = [], unbekannt = [];
  for (const [fid, wert] of Object.entries(felder)) {
    const f = fuehrung.feld(fid);
    if (!f) { unbekannt.push(fid); continue; }
    if (f.kind === 'select' && f.optionen && f.optionen.length) {
      const treffer = _ordneOption(wert, f.optionen);
      if (treffer.eindeutig) geprueft[fid] = treffer.wert;
      else nachfragen.push({
        feld: fid, label: f.label || fid, gesagt: wert,
        moeglich: f.optionen.map((o) => o.text || o.wert)
      });
      continue;
    }
    geprueft[fid] = wert;
  }

  if (nachfragen.length) {
    return { ok: false, rueckfrage: true, auswahl_unklar: nachfragen,
      hinweis: 'Diese Werte passen zu keiner Auswahl. Frag den Nutzer, '
             + 'welche der genannten Moeglichkeiten er meint. NICHTS speichern.' };
  }
  if (!Object.keys(geprueft).length) {
    return { ok: false, unbekannte_felder: unbekannt,
      hinweis: 'Keine bekannten Felder dabei. Nenne dem Nutzer, was nicht zugeordnet werden konnte.' };
  }

  const o = await dialog.objektKontext(ctx.userId, id);
  const belegt = Object.keys(geprueft).filter((fid) =>
    fuehrung.gefuellt(o.daten, fid) && String(o.daten[fid]) !== String(geprueft[fid]));

  /* Ein belegtes Feld wird nie still ueberschrieben — und die Rueckfrage
     nennt BEIDE Werte, sonst kann der Nutzer sie nicht beantworten. */
  if (belegt.length && !(args && args.bestaetigt)) {
    return { ok: false, rueckfrage: true,
      bereits_belegt: belegt.map((fid) => ({
        feld: fid, label: (fuehrung.feld(fid) || {}).label || fid,
        steht_auf: o.daten[fid], soll_werden: geprueft[fid] })),
      hinweis: 'Diese Felder sind belegt. Nenne dem Nutzer ALTEN und NEUEN Wert '
             + 'und frage, ob geaendert werden soll. Erst nach einem Ja erneut '
             + 'aufrufen, dann mit bestaetigt: true.' };
  }

  const neu = Object.assign({}, o.daten, geprueft);
  await query(`UPDATE objects SET data = $3::jsonb, updated_at = now()
                WHERE id = $1 AND user_id = $2`,
    [id, ctx.userId, JSON.stringify(neu)]);
  ctx.merkeObjekt(id);
  return { ok: true, geaendert: geprueft,
    unbekannte_felder: unbekannt.length ? unbekannt : undefined,
    hinweis: 'Gespeichert. Die Kennzahlen rechnet DealPilot beim naechsten Oeffnen neu.' };
}

async function objekt_anlegen(ctx, args) {
  /* ── v1806 · DER FREITEXT IST DER WICHTIGSTE PARAMETER ────────────────
   *
   * GEMESSEN am 02.10.2026 mit Marcels eigenem Satz:
   *
   *   "Leg mir eine Eigentumswohnung in der Musterstrasse 12 in Hannover
   *    an. Die Wohnung hat 85 m2, vier Zimmer, liegt im zweiten
   *    Obergeschoss und ist aktuell vermietet."
   *
   *   uebernommen: zimmer=4, etage=2.  NICHT uebernommen: Objektart,
   *   Strasse, Hausnummer, Ort, Wohnflaeche — fuenf von sieben.
   *
   * Das Modell hatte sie GELESEN (es nannte "Musterstrasse 12, Hannover"
   * in seiner Antwort), aber es kennt die FELDNAMEN nicht: dass die
   * Strasse `str` heisst, der Ort `ort`, die Objektart `objart` und die
   * Wohnflaeche `wfl`. Es hat `zimmer` und `etage` getroffen, weil die
   * zufaellig wie das deutsche Wort heissen.
   *
   *   > Ein Modell, das die Namen nicht kennt, raet sie — und trifft
   *   > genau die, die man ohnehin erraten haette. Der Rest faellt
   *   > lautlos weg.
   *
   * Den ganzen Katalog mitzugeben waere ein Dump (189 Felder in jedem
   * Prompt). Stattdessen nimmt dieses Werkzeug den SATZ entgegen und
   * laesst `extractFromText` die Felder ziehen — denselben Dienst, den
   * Sprechlauf, Sprachnachricht und Foto schon nutzen, samt
   * Schablonenheilung und Prozentfalle.
   *
   * `felder` bleibt zusaetzlich moeglich fuer das, was das Modell sicher
   * weiss. Beides wird gemischt; der Freitext gewinnt nicht gegen eine
   * ausdrueckliche Feldangabe. */
  const felder = (args && args.felder) || {};
  const sauber = {};
  const unbekannt = [];

  const text = String((args && args.beschreibung) || '').trim();
  if (text) {
    try {
      const r = await voiceExtract.extractFromText(text, fuehrung.katalog(), {
        apiKey: config.openai.apiKey, modus: 'inserat'
      });
      Object.entries((r && r.fields) || {}).forEach(([fid, w]) => {
        if (!fuehrung.feld(fid)) return;
        const f = fuehrung.feld(fid);
        /* Auswahlfelder normalisieren — die Extraktion liefert manchmal
           den Klartext ("Eigentumswohnung"), gespeichert wird der Wert. */
        if (f.kind === 'select' && f.optionen && f.optionen.length) {
          const t = _ordneOption(w, f.optionen);
          if (t.eindeutig) sauber[fid] = t.wert;
          return;
        }
        sauber[fid] = w;
      });
    } catch (e) { /* ohne Freitext geht es auch, nur mit weniger */ }

    /* ── v1806b · AUSWAHLFELDER AUS DEM SATZ NACHZIEHEN ────────────────
     *
     * GEMESSEN: "Leg mir eine Eigentumswohnung ... an" ergab `notizen:
     * "Eigentumswohnung; aktuell vermietet"` und ein LEERES `objart` —
     * obwohl es dort die Option "Eigentumswohnung (ETW)" gibt.
     *
     *   > Eine Angabe, die in einem Freitextfeld landet statt im
     *   > zustaendigen Auswahlfeld, ist nicht gespeichert, sondern
     *   > abgelegt. Sie steht da und wirkt nicht.
     *
     * Deshalb: fuer jedes leere Auswahlfeld im Satz nachsehen, ob einer
     * seiner Optionstexte woertlich vorkommt. Nur bei GENAU EINEM
     * Treffer — zwei waeren keine Entscheidung. */
    const klein = text.toLowerCase();
    fuehrung.katalog().forEach((kf) => {
      if (kf.kind !== 'select' || sauber[kf.id] != null) return;
      const roh = fuehrung.feld(kf.id);
      if (!roh || !roh.optionen) return;
      const treffer = roh.optionen.filter((o) => {
        const t = String(o.text || '').toLowerCase()
          .replace(/\s*\([^)]*\)\s*/g, '').trim();   /* "Eigentumswohnung (ETW)" -> "eigentumswohnung" */
        return t.length >= 5 && klein.indexOf(t) >= 0;
      });
      if (treffer.length === 1) sauber[kf.id] = treffer[0].wert;
    });
  }

  /* ── v1812d · AUCH `felder` MUSS DURCH DIE AUSWAHLPRUEFUNG ───────────
   *
   * GEMESSEN: `objart` landete als "Eigentumswohnung" im Datensatz statt
   * als "ETW". Der Freitext-Weg normalisiert Auswahlwerte seit v1806b —
   * dieser Weg hier nicht, und er laeuft DANACH, ueberschreibt also das
   * richtige Ergebnis mit dem Klartext.
   *
   *   > Zwei Wege in dieselbe Spalte, und nur einer prueft. Der andere
   *   > gewinnt, weil er spaeter kommt. */
  Object.entries(felder).forEach(([fid, w]) => {
    const f = fuehrung.feld(fid);
    if (!f) { unbekannt.push(fid); return; }
    if (f.kind === 'select' && f.optionen && f.optionen.length) {
      const t = _ordneOption(w, f.optionen);
      if (t.eindeutig) sauber[fid] = t.wert;
      /* Nicht eindeutig: NICHT setzen. Ein ungueltiger Auswahlwert ist
         schlimmer als ein leeres Feld — er sieht aus wie eine Angabe. */
      return;
    }
    sauber[fid] = w;
  });
  if (!Object.keys(sauber).length) {
    return { ok: false, unbekannte_felder: unbekannt,
      hinweis: 'Keine verwertbaren Felder. Frag nach Adresse, Objektart und Flaeche.' };
  }

  /* ── v1887 · DASSELBE HAUS ZWEIMAL ───────────────────────────────────
   *
   * GEMESSEN am 05.10.2026 in Marcels Dialog, nachgezaehlt in der
   * Staging-Datenbank:
   *
   *   2304bf0f  Sachsenstraße 18 Herford  angelegt 13:48:10  (ohne Miete)
   *   bad5ad8a  Sachsenstraße 18 Herford  angelegt 13:50:01  (nkm 940)
   *
   * Der Nutzer wollte EIN Objekt. Seine zweite Nachricht war eine
   * ERGAENZUNG ("wir haben 940 Euro Kaltmiete"), das Modell rief aber
   * wieder `objekt_anlegen` — und bekam ein zweites Haus.
   *
   * Der Schaden hoert nicht bei der Dublette auf: ab da loest dieselbe
   * Adresse MEHRDEUTIG auf, und genau das hat den Nummern-Waechter aus
   * v1813c ausgehebelt (siehe `_findeObjekt`). Eine Dublette ist also
   * nicht nur unordentlich, sie macht die Objektzuordnung blind.
   *
   *   > Eine Ergaenzung ist kein zweites Haus. Wer das verwechselt,
   *   > verliert danach auch das erste.
   *
   * Es gibt echte Faelle mit gleicher Anschrift (zwei Einheiten im selben
   * Haus). Deshalb wird nicht verhindert, sondern GEFRAGT — und die
   * Rueckfrage nennt die Kennung des vorhandenen Objekts, damit der
   * naechste Zug `felder_aendern` sein kann. */
  const _schl = (v) => String(v == null ? '' : v).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/stra(ss|s)e\b/g, 'str').replace(/[^a-z0-9]/g, '');
  if (!(args && args.bestaetigt) && sauber.str && (sauber.plz || sauber.ort)) {
    const vorhanden = (await dialog.objekteListe(ctx.userId, 60)).filter((o) => {
      const d = o.adresse || '';
      return _schl(d) === _schl([sauber.str, sauber.hnr].filter(Boolean).join(' ')
        + ', ' + [sauber.plz, sauber.ort].filter(Boolean).join(' '));
    });
    if (vorhanden.length) {
      ctx.merkeObjekt(vorhanden[0].id);
      return { ok: false, rueckfrage: true, bereits_vorhanden: vorhanden.map((o) => ({
          id: o.id, adresse: o.adresse })),
        hinweis: 'Unter dieser Anschrift gibt es bereits ein Objekt. NICHTS wurde '
               + 'angelegt. Wollte der Nutzer nur ETWAS ERGAENZEN (Miete, Baujahr, '
               + 'Finanzierung), dann nimm felder_aendern mit der genannten id — '
               + 'das ist der Normalfall. Nur wenn er ausdruecklich ein ZWEITES, '
               + 'eigenes Objekt an derselben Anschrift meint (zwei Einheiten im '
               + 'selben Haus), frag ihn das und rufe danach objekt_anlegen erneut '
               + 'mit bestaetigt: true. Frag NICHT nach Daten, die du schon hast.' };
    }
  }

  /* ── v1804 · NICHT SELBST INSERTEN ───────────────────────────────────
   *
   * Hier stand ein direktes `INSERT INTO objects (user_id, data)`. Das
   * schlug fehl: `objects.name` ist NOT NULL, und der Name entsteht nicht
   * im Datensatz, sondern in `extractSummary` aus Strasse, Hausnummer und
   * Ort. Dazu vergibt `create` atomar eine Sequenznummer und schreibt
   * die Summenspalten (bmy, cf_ns, dscr, kaufpreis).
   *
   * GEMESSEN am 02.10.2026: der Bot konnte KEIN Objekt anlegen —
   * "null value in column name violates not-null constraint".
   *
   *   > Wer an einer Tabelle vorbei einfuegt, an der ein Dienst haengt,
   *   > uebernimmt dessen ganze Arbeit — und merkt erst an der ersten
   *   > Spalte, dass es welche gab. */
  const erstellt = await objectService.create(ctx.userId, {
    data: sauber, aiAnalysis: null, photos: []
  });
  const r = { rows: [{ id: erstellt.id }] };
  ctx.merkeObjekt(r.rows[0].id);

  /* ── v1809 · DEN LAUFENDEN ENTWURF AUFRAEUMEN ────────────────────────
   *
   * GEMESSEN: legte der Agent waehrend einer laufenden Webhook-Anlage ein
   * Objekt an, blieb der Zustand `modus='anlegen'` samt Entwurf stehen.
   * Die naechste Nachricht ging wieder in die Fuehrung, und am Ende stand
   * DASSELBE Objekt ein zweites Mal in der Datenbank.
   *
   *   > Wer eine Sache zu Ende bringt, muss auch den Zettel wegwerfen,
   *   > auf dem sie stand. Sonst macht sie jemand noch einmal.
   *
   * `ctx.anlageFertig` setzt der Webhook; ausserhalb davon (Prueflaeufe)
   * gibt es sie nicht und es passiert nichts. */
  if (typeof ctx.anlageFertig === 'function') {
    try { await ctx.anlageFertig(); } catch (e) { /* nicht kritisch */ }
  }
  const fo = fuehrung.fortschritt(sauber);
  const offen = fuehrung.luecken(sauber, { modus: 'anlegen' }).slice(0, 3);
  return { ok: true, id: r.rows[0].id, uebernommen: sauber,
    unbekannte_felder: unbekannt.length ? unbekannt : undefined,
    fortschritt: fo.fertig + ' von ' + fo.bloecke + ' Bloecken',
    naechste_fragen: offen.map((b) => b.frage),
    hinweis: 'Angelegt. Nenne dem Nutzer, was uebernommen wurde, und frage die '
           + 'naechsten offenen Punkte — aber NUR die, die oben stehen.' };
}

async function anlage_luecken(ctx, args) {
  const felder = (args && args.felder) || {};
  const fo = fuehrung.fortschritt(felder);
  const offen = fuehrung.luecken(felder, { modus: 'anlegen' });
  return {
    fortschritt: fo, offene_bloecke: offen.slice(0, 5).map((b) => ({
      frage: b.frage, felder: b.ids.filter((id) => !fuehrung.gefuellt(felder, id))
        .map((id) => {
          const f = fuehrung.feld(id) || {};
          return { id, label: f.label || id, art: f.kind,
            auswahl: f.optionen ? f.optionen.map((o) => o.text || o.wert) : undefined };
        })
    }))
  };
}

/* ═══ KOSTET (braucht Bestaetigung MIT PREIS) ═════════════════════════ */

async function marktbericht_preis(ctx, args) {
  const id = await _findeObjekt(ctx, args);
  if (!id) return { ok: false, hinweis: 'Kein Objekt gefunden.' };

  /* ── v1821 · DIE PREISANSAGE HAELT IHREN GEGENSTAND FEST ─────────────
   *
   * GEMESSEN am 04.10.2026: der Preis galt "Am Markt 9", abgerufen und
   * abgebucht wurde "Gohliser Strasse 42". Diese Funktion hat das Objekt
   * ermittelt und es dann VERGESSEN — kein merkeObjekt, kein Angebot.
   * Beim "ja" suchte der Abruf neu und landete woanders.
   *
   *   > Wer einen Preis nennt, nennt ihn fuer etwas. Was man nicht
   *   > festhaelt, muss man neu suchen — und beim zweiten Suchen findet
   *   > man etwas anderes.
   *
   * Ab hier gilt: das Objekt wird gemerkt UND als Angebot abgelegt. Der
   * Abruf nimmt ausschliesslich dieses. */
  ctx.merkeObjekt(id);
  const _o = await dialog.objektKontext(ctx.userId, id);
  const _adr = _adrVon(_o) || null;   /* EINE Stelle, siehe _adrVon */
  if (typeof ctx.merkeAngebot === 'function') await ctx.merkeAngebot(id, _adr);

  /* ── v1811b · OHNE STUFE GIBT ES ALLE DREI ───────────────────────────
   *
   * Der Hinweis "frag nach der Stufe" half nicht: das Modell gab einfach
   * `stufe: 1` mit und meinte, damit sei gefragt. Es konnte ja eine
   * waehlen.
   *
   *   > Ein Hinweis, der eine Wahl verbietet, die das Werkzeug anbietet,
   *   > verliert gegen das Werkzeug. Wer will, dass gefragt wird, darf
   *   > nicht waehlen lassen.
   *
   * Ohne ausdrueckliche Stufe bekommt das Modell jetzt ALLE DREI mit
   * Preis und Inhalt — und keine Moeglichkeit, eine davon fuer den Nutzer
   * zu bestimmen. */
  {
    const alle = [];
    for (const s of [1, 2, 3]) {
      const v = await markt.voranschlag(ctx.userId, id, s);
      if (!v.moeglich) continue;
      alle.push({
        stufe: s, name: v.name, was_drin_ist: v.was_drin_ist,
        verbraucht_einen_abruf: v.verbraucht_einen_abruf,
        guthaben_abrufe_uebrig: v.bestand,
        so_sagen: v.so_sagen
      });
    }
    return {
      objekt_id: id,
      /* ── v1887 · DIE PREISANSAGE NENNT IHREN GEGENSTAND AUCH DEM MODELL ──
       *
       * v1821 hat das Objekt der Preisansage festgehalten (merkeAngebot),
       * damit ein spaeteres „ja" nicht woanders landet. Dem MODELL wurde
       * es trotzdem nie gesagt: hier stand nur `objekt_id`, eine UUID, die
       * kein Mensch wiedererkennt.
       *
       * GEMESSEN am 05.10.2026: der Bot listete die drei Stufen unter der
       * Ueberschrift „Sachsenstraße 18, 32052 Herford" — angesagt und als
       * Angebot abgelegt war die Löhner Str. 278 (nachgelesen in
       * telegram_dialog.angebot). Das Modell konnte es nicht besser
       * wissen; es hatte nur die Adresse, die der NUTZER gesagt hatte.
       *
       *   > Eine Herkunftsangabe gehoert an den Ort, nie an den Wert. Wer
       *   > dem Modell nur eine UUID gibt, zwingt es, die Adresse aus dem
       *   > Gespraech zu nehmen — und das ist genau die, die stimmen
       *   > soll, nicht die, die stimmt. */
      gilt_fuer: _adr,
      stufen: alle,
      hinweis: 'Hier stehen alle drei Stufen mit Preis und Inhalt.\n'
             + 'SCHREIBE DIE ADRESSE AUS "gilt_fuer" WOERTLICH in deine Antwort. '
             + 'Nimm NICHT die Adresse, die der Nutzer gesagt hat — weicht sie ab, '
             + 'ist das kein Schoenheitsfehler, sondern das falsche Haus. Sag ihm '
             + 'in dem Fall ausdruecklich, dass du ein anderes Objekt gefunden hast, '
             + 'und frage nach.\n'
             + 'HAT DER NUTZER EINE STUFE GENANNT (z.B. "erweiterte", "vollstaendige '
             + 'Wertermittlung", "Marktpreisindikation")? Dann nenne NUR DIESE, mit '
             + 'ihrem so_sagen-Satz, und frage, ob du sie abrufen sollst.\n'
             + 'HAT ER KEINE GENANNT? Dann zeige ihm alle drei mit dem, was sie '
             + 'unterscheidet, und frage, welche er moechte. Waehle KEINE selbst.\n'
             + 'In beiden Faellen: marktbericht_abrufen erst nach einem '
             + 'ausdruecklichen Ja. Dieser Voranschlag verbraucht selbst kein '
             + 'Guthaben — das ist eine Angabe fuer dich, nicht fuer den Nutzer.'
    };
  }

}

/* ── Sammelaktion: was kostet es fuer ALLE? ──────────────────────────────
 *
 * Marcel: "ich moechte fuer alle Objekte die Marktpreisindikation oder die
 * erweiterte Marktpreisindikation machen, dass er das ausfuehrt."
 *
 *   > Eine Aktion ueber ALLE Objekte ist siebzehn Aktionen. Kostet sie
 *   > Geld, sind es siebzehn Abbuchungen — und die Bestaetigung muss die
 *   > GESAMTSUMME nennen, nicht den Einzelpreis. Wer "ja" sagt, muss
 *   > wissen, wozu.
 */
async function marktbericht_preis_alle(ctx, args) {
  const stufe = _stufe(args);
  const liste = await dialog.objekteListe(ctx.userId, 60);
  if (!liste.length) return { anzahl: 0, hinweis: 'Keine Objekte vorhanden.' };

  const je = [];
  let kostenpflichtig = 0, bereit = 0;
  for (const o of liste) {
    const v = await markt.voranschlag(ctx.userId, o.id, stufe);
    const k = v.moeglich && v.verbraucht_einen_abruf;
    if (k) kostenpflichtig++;
    /* Pflichtangaben prueft der Bericht selbst; hier nur die groben. */
    const d = (await dialog.objektKontext(ctx.userId, o.id)).daten || {};
    const fehlt = [];
    if (!d.plz && !d.ort) fehlt.push('PLZ/Ort');
    if (!d.objektart && !d.objart) fehlt.push('Objektart');
    if (!d.wfl) fehlt.push('Wohnflaeche');
    if (!fehlt.length) bereit++;
    je.push({ id: o.id, adresse: o.adresse, kostet: k,
      fehlende_angaben: fehlt.length ? fehlt : undefined });
  }

  const art = (markt.STUFEN[stufe] || markt.STUFEN[1]);
  const bestand = je.length ? (await markt.voranschlag(ctx.userId, je[0].id, stufe)).bestand : null;

  return {
    anzahl: liste.length, stufe, name: art.name,
    davon_bereit: bereit,
    davon_unvollstaendig: liste.length - bereit,
    kostenpflichtige_abrufe: kostenpflichtig,
    /* v1806c · Hiess vorher nur `bestand` — das Modell las es als Zahl der
       OBJEKTE und schrieb "Dein Gesamtbestand umfasst 36 Objekte". Gemeint
       war das Guthaben.

         > Ein Feldname, der zwei Lesarten zulaesst, bekommt irgendwann die
         > falsche. Und der Leser merkt es nicht, weil beide Zahlen
         > plausibel aussehen. */
    guthaben_abrufe_uebrig: bestand,
    reicht_nicht: (bestand != null && kostenpflichtig > bestand),
    objekte: je,
    /* v1811 · wie bei marktbericht_preis: der Satz redet ueber SICH, nicht
       ueber die Bewertung. */
    so_sagen: kostenpflichtig > 0
      ? ('Das verbraucht ' + kostenpflichtig + ' Abrufe vom Typ "' + art.name + '"'
         + (bestand != null ? ' aus deinem Kontingent (noch ' + bestand + ' uebrig)' : '') + '.')
      : 'Dafuer wird nichts weiter verbraucht.',
    hinweis: 'Dieser Voranschlag verbraucht selbst kein Guthaben — das ist eine '
           + 'Angabe fuer dich, NICHT fuer den Nutzer. Sag ihm woertlich, was unter '
           + '"so_sagen" steht, nenne wie viele Objekte unvollstaendig sind, und '
           + 'frage dann. Schreibe NIE "kostet nichts", wenn kostenpflichtige_abrufe '
           + 'groesser null ist. Erst nach einem ausdruecklichen Ja '
           + 'marktbericht_abrufen je Objekt aufrufen.'
  };
}

async function marktbericht_abrufen(ctx, args) {
  /* ══ v1821 · DAS ANGEBOT ENTSCHEIDET, NICHT DAS MODELL ══════════════
   *
   * GEMESSEN am 04.10.2026 an Marcels Dialog: Preis fuer "Am Markt 9"
   * angesagt, "Gohliser Strasse 42" abgerufen und abgebucht.
   *
   *   > Was Geld kostet, darf das Modell nicht adressieren. Es darf es
   *   > vorschlagen; bestaetigt wird DER VORSCHLAG, nicht irgendeiner.
   *
   * Liegt ein Angebot vor (die Preisansage hat es abgelegt, der Webhook
   * hat die Zustimmung geprueft), gilt AUSSCHLIESSLICH dessen Objekt.
   * Eine abweichende Angabe des Modells wird nicht befolgt, sondern
   * gemeldet — stillschweigend zu uebergehen waere derselbe Fehler mit
   * umgekehrtem Vorzeichen. */
  let id = ctx.angebotObjekt || null;
  let abweichung = null;
  if (id) {
    const gewuenscht = await _findeObjekt(ctx, args).catch(() => null);
    if (gewuenscht && String(gewuenscht) !== String(id)) abweichung = gewuenscht;
  } else {
    id = await _findeObjekt(ctx, args);
  }
  if (!id) {
    return { ok: false, hinweis: 'Kein Objekt gefunden. Nenne zuerst den Preis '
           + '(marktbericht_preis) und lass den Nutzer zustimmen — erst dann gibt es '
           + 'ein Objekt, auf das sich der Abruf beziehen darf.' };
  }
  const stufe = _stufe(args);
  const o = await dialog.objektKontext(ctx.userId, id);
  try {
    const r = await markt.abrufen(ctx.userId, o, stufe);
    ctx.merkeObjekt(id);
    if (typeof ctx.angebotVerbraucht === 'function') await ctx.angebotVerbraucht();

    /* ── v1808 · DAS ERGEBNIS IST MEHR ALS EINE ZAHL ───────────────────
     *
     * Marcel, Punkt 7: "Das Ergebnis soll nicht lediglich aus einem
     * einzelnen Marktpreis bestehen" — er will Lage, Marktdaten,
     * Vergleichsdaten, Annahmen, Risiken und QUELLEN.
     *
     * Der Bericht liefert das als Markdown (`report_md`) plus Zahlen im
     * Rumpf. Beides geht ans Modell; es soll zusammenfassen, nicht
     * nacherzaehlen — und die QUELLEN mitnehmen.
     *
     *   > Eine Wertauskunft ohne ihre Herkunft verstoesst gegen die
     *   > Wertermittlungsdoktrin, egal wie gut sie formuliert ist. */
    const bericht = r.report_md || r.bericht_md || r.markdown || null;
    const stufeInfo = markt.STUFEN[stufe] || markt.STUFEN[1];

    return {
      ok: true, stufe, art: stufeInfo.art, name: stufeInfo.name,
      /* v1821 · WOFUER gerechnet wurde, steht im Ergebnis. Ohne diese
         Zeile kann das Modell eine andere Adresse darueberschreiben — und
         genau das ist am 04.10.2026 passiert. */
      abgerufen_fuer: _adrVon(o),
      abweichung_gemeldet: abweichung
        ? 'Das Modell wollte ein ANDERES Objekt abrufen. Gerechnet wurde das '
          + 'Objekt der Preisansage. Sag dem Nutzer ausdruecklich, WELCHES Objekt '
          + 'berechnet wurde.'
        : undefined,
      zahlen: _berichtZahlen(r),
      bericht_text: bericht ? String(bericht).slice(0, 14000) : null,
      rumpf: _ohneGrosseFelder(r),
      hinweis: 'Fasse fuer den Nutzer zusammen: Wert bzw. Spanne, die verwendeten '
             + 'Objektangaben, Lage, Marktdaten, Annahmen und Besonderheiten — und '
             + 'NENNE DIE QUELLEN, wenn welche dastehen. Erfinde nichts dazu. '
             + 'Sag ausdruecklich, dass es eine Indikation ist und kein Gutachten '
             + '(ausser bei der Wertermittlung nach ImmoWertV). '
             + 'Nenne Anbieter nie beim Namen — "unabhaengiger Bewertungspartner".'
    };
  } catch (e) {
    /* ── v1821 · EINE GELDAKTION DARF NICHT SPURLOS SCHEITERN ──────────
     *
     * GEMESSEN: drei Abrufe im Agentenlog, nur EIN Bericht im
     * Marktbericht-Dienst. Zwei sind vorher gescheitert, und der Fehler
     * ging ausschliesslich als Werkzeugergebnis ans Modell. Als Marcel
     * sagte, die Wertermittlung habe nicht funktioniert, gab es keine
     * einzige Spur davon.
     *
     *   > Ein Fehler, der nur dem Modell gemeldet wird, ist nach der
     *   > Antwort verschwunden. */
    try {
      console.error('[marktbericht v1821] Abruf FEHLGESCHLAGEN'
        + ' stufe=' + stufe + ' objekt=' + id
        + ' adresse=' + _adrVon(o)
        + ' kontingent=' + Boolean(e.kontingent)
        + ' fehler=' + String(e && e.message).slice(0, 300));
    } catch (_) {}
    return { ok: false, fehler: e.message, kontingent: Boolean(e.kontingent),
      upgrade_zu: e.upgradeTo || undefined,
      abgerufen_fuer: _adrVon(o), stufe: stufe,
      hinweis: 'Der Abruf ist fehlgeschlagen. Nenne dem Nutzer den Fehlertext und '
             + 'das Objekt, um das es ging, und frag, ob er es erneut versuchen '
             + 'soll. Erfinde keine Zahlen aus einem gescheiterten Abruf.' };
  }
}

/* Zahlen aus dem Berichtsrumpf, unter den Namen, die dort vorkommen
   koennen. Was nicht da ist, kommt nicht vor — nichts wird geraten. */
function _berichtZahlen(r) {
  const w = r.wert || r.ergebnis || r.result || r || {};
  const z = {};
  const nimm = (ziel, ...kandidaten) => {
    for (const k of kandidaten) {
      const v = (w && w[k]) != null ? w[k] : (r && r[k]);
      if (v != null && Number.isFinite(Number(v))) {
        z[ziel] = Number(v).toLocaleString('de-DE'); return;
      }
    }
  };
  nimm('marktwert_eur', 'marktwert', 'wert', 'value');
  nimm('spanne_von_eur', 'spanne_von', 'low', 'min');
  nimm('spanne_bis_eur', 'spanne_bis', 'high', 'max');
  nimm('eur_pro_qm', 'eur_pro_qm', 'eur_per_sqm');
  nimm('marktmiete_eur', 'marktmiete', 'miete');
  return Object.keys(z).length ? z : null;
}

/* Grosse Textfelder raus — sie stehen schon in `bericht_text`, und zweimal
   dasselbe im Kontext macht den Agenten nur beliebiger. */
function _ohneGrosseFelder(r) {
  const o = {};
  Object.keys(r || {}).forEach((k) => {
    if (/report_md|bericht_md|markdown|html/i.test(k)) return;
    const v = r[k];
    if (typeof v === 'string' && v.length > 600) return;
    o[k] = v;
  });
  return o;
}

/* ═══ Helfer ═════════════════════════════════════════════════════════ */

/* v1821 · Eine Adresse an EINER Stelle gebildet. Sie steht jetzt im
   Ergebnis des Abrufs UND im Fehlerprotokoll — zwei Schreibweisen
   derselben Adresse waeren zwei Gelegenheiten, sie falsch zu bilden. */
function _adrVon(o) {
  const d = (o && o.daten) || {};
  return [d.str, d.hnr].filter(Boolean).join(' ')
    + (d.ort ? ', ' + [d.plz, d.ort].filter(Boolean).join(' ') : '');
}

function _ohneIntern(d) {
  const o = {};
  Object.keys(d || {}).forEach((k) => {
    if (k.indexOf('_') === 0) return;      /* _kpis_*, _ds2_*, _dealpilot_score */
    /* v1847 · GEMESSEN: `ai_lage_cache` (ki-lage.js:432) beginnt nicht mit
       `_` und trug rohes HTML samt Zeitstempel ins Modell — ein Feld, das
       niemand lesen soll, als "Feld" ausgegeben. Alles, was ein Zwischen-
       speicher ist, bleibt draussen. Die Pilot-Analyse hat ihr eigenes
       Werkzeug (pilot_analyse_lesen) und gehoert hier ebenfalls nicht hin. */
    if (/_cache$|^ai_analysis$|^ai_lage/.test(k)) return;
    if (d[k] == null || d[k] === '') return;
    o[k] = d[k];
  });
  return o;
}

function _stufe(args) {
  const s = Number((args && args.stufe) || 1);
  return (s === 1 || s === 2 || s === 3) ? s : 1;
}

/* ── Welches Feld meint der Satz? ────────────────────────────────────────
 *
 * "setz den ZUSTAND auf total marode" -> ds2_zustand + "total marode"
 * "die ZIMMERZAHL auf 5"              -> zimmer + "5"
 *
 * Gesucht wird ueber die Feld-Beschriftung, nicht ueber die interne Id —
 * der Nutzer sagt "Zustand", nicht "ds2_zustand". Bei mehreren Treffern
 * gewinnt der laengste, also der genaueste.
 */
/* Umlaute vereinheitlichen. GEMESSEN: "setz die Wohnflaeche auf 85" fand
   das Feld "Wohnfläche (m²)" nicht — ae gegen ä. Wer diktiert oder schnell
   tippt, schreibt beides.

     > Ein Treffer, der an einem Umlaut scheitert, scheitert bei jedem
     > zweiten Nutzer. */
function _flach(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

function _feldAusSatz(text) {
  const t = _flach(text);
  /* "auf X" / "von X auf Y" — der Wert steht hinter dem letzten "auf" */
  const m = /\bauf\s+(.+?)\s*[.?!]?$/i.exec(text);
  if (!m) return null;
  const wert = m[1].trim();
  if (!wert || wert.length > 60) return null;

  let bester = null;
  fuehrung.katalog().forEach((f) => {
    const label = _flach(f.label)
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\b(ds2|dp|v\d+)\b/g, ' ')
      .replace(/[^a-z ]/g, ' ').trim();
    if (label.length < 4) return;
    /* Das Label kann mehrere Woerter haben ("Zustand der Wohnung") —
       es genuegt, wenn das erste davon im Satz steht. */
    const kern = label.split(/\s+/)[0];
    if (kern.length < 5) return;
    if (t.indexOf(kern) < 0) return;
    if (!bester || kern.length > bester.kern.length) bester = { feld: f, kern };
  });
  if (!bester) return null;
  return { feld: bester.feld, wert };
}

/* Ordnet eine Nutzerangabe einer Auswahl zu. Eindeutig heisst: genau ein
   Treffer. Zwei Treffer sind keine Entscheidung. */
function _ordneOption(wert, optionen) {
  const w = String(wert == null ? '' : wert).toLowerCase().trim();
  if (!w) return { eindeutig: false };
  const genau = optionen.filter((o) =>
    String(o.wert).toLowerCase() === w || String(o.text || '').toLowerCase() === w);
  if (genau.length === 1) return { eindeutig: true, wert: genau[0].wert };
  const teil = optionen.filter((o) =>
    String(o.text || '').toLowerCase().indexOf(w) >= 0
    || w.indexOf(String(o.text || '').toLowerCase()) >= 0
    || String(o.wert).toLowerCase().indexOf(w) >= 0);
  if (teil.length === 1) return { eindeutig: true, wert: teil[0].wert };
  return { eindeutig: false };
}

/* Objekt finden — Nummer aus der letzten Liste, ID, Adresse, oder das
   zuletzt besprochene. Die Reihenfolge ist dieselbe wie im Webhook. */
async function _findeObjekt(ctx, args) {
  const a = args || {};

  /* ── v1887 · DIE ERFUNDENE NUMMER, ZUM ZWEITEN MAL ───────────────────
   *
   * GEMESSEN am 05.10.2026 an Marcels Bot-Dialog (Sachsenstraße 18,
   * 32052 Herford), nachgelesen in `telegram_dialog` auf Staging:
   *
   *   letzte_liste[1]      = 3fbb754c  ->  Löhner Str. 278, Hiddenhausen
   *   angebot.adresse      = "Löhner Str. 278, 32120 Hiddenhausen"
   *   letztes_objekt       = 3fbb754c
   *
   * Der Nutzer hat in KEINER seiner vier Nachrichten eine Nummer genannt.
   * Trotzdem galt die ganze Auskunft der Löhner Str. 278: der Schnellblick
   * meldete "Jahreskaltmiete 16.800 EUR / 1.502 EUR je m² / 6,01 EUR je m²"
   * unter der Überschrift "Sachsenstraße 18" — das sind exakt die Werte des
   * Löhner-Objekts (wfl 233, kp 350.000, nkm 1.400), auf den Cent
   * nachgerechnet. Keine Einheitenverwechslung: das falsche Haus.
   *
   * Der Wächter aus v1813c war da und griff nicht. Er greift nur, wenn die
   * genannte Adresse EINDEUTIG auflöst. Hier war sie `mehrdeutig` (das
   * Objekt war versehentlich zweimal angelegt), also war `perAdr` null,
   * also fiel der Vergleich aus — und die erfundene Nummer gewann still.
   *
   *   > Ein Wächter, der nur beim eindeutigen Fall aufwacht, schläft
   *   > genau dann, wenn es unübersichtlich wird.
   *
   * Zwei Lehren, beide hier umgesetzt:
   *
   *   1. Eine Nummer gilt nur, wenn der NUTZER eine genannt hat. Das
   *      entscheidet `absicht.bezug()` im Webhook deterministisch; von
   *      dort kommt `ctx.nummerErfunden`. Regel 7h im Prompt verbietet die
   *      erfundene Nummer bereits — und wurde trotzdem gebrochen. Was
   *      gefragt werden soll, darf nicht wählbar sein.
   *   2. Auch wenn die Nummer gelten darf: eine genannte Adresse, die
   *      MEHRDEUTIG ist, ist eine Rückfrage — keine Freigabe für die
   *      Nummer.
   *
   * Prüfläufe (tools/agent-pruefung) rufen die Werkzeuge direkt mit
   * `{nummer: N}` und setzen die Fahne nicht. Deshalb gilt die Sperre nur
   * bei ausdrücklichem `nummerErfunden === true`. */
  if (a.nummer != null && ctx.nummerErfunden === true) {
    delete a.nummer;
  }

  if (a.nummer != null && ctx.letzteListe && ctx.letzteListe.length) {
    const n = Number(a.nummer);
    /* v1887 · Eine Nummer ausserhalb der Liste darf eine mitgegebene
       ADRESSE nicht mit ins Nichts reissen. Hier stand `return null`, und
       das Werkzeug meldete darauf "Kein Objekt gefunden" — auch dann,
       wenn die Adresse danebenstand und sauber aufgeloest haette. */
    if (!(n >= 1 && n <= ctx.letzteListe.length)) {
      if (!a.adresse || _istPlatzhalter(a.adresse)) return null;
      delete a.nummer;
      return await _findeObjekt(ctx, a);
    }
    const perNr = ctx.letzteListe[n - 1];

    /* ── v1813c · EINE GERATENE NUMMER SCHLUG DIE GENANNTE ADRESSE ──────
     *
     * GEMESSEN am 03.10.2026: auf "wie ist der Cashflow bei der
     * Musterstraße?" rief der Agent `objekt_kennzahlen` mit `adresse:
     * "Musterstraße"` UND `nummer: 1` — die Nummer hatte er sich gedacht,
     * der Nutzer hatte keine genannt. Hier gewann die Nummer, und die
     * Antwort galt "Unbenannt" statt der Musterstraße.
     *
     *   > Eine Angabe, die der Nutzer gemacht hat, darf nie gegen eine
     *   > verlieren, die das Modell dazuerfunden hat.
     *
     * Widersprechen sich beide, wird gefragt. Das ist die einzige Antwort,
     * die in keinem Fall das falsche Haus trifft. */
    if (a.adresse && !_istPlatzhalter(a.adresse)) {
      const liste = await dialog.objekteListe(ctx.userId, 60);
      const t = dialog.objektRaten(String(a.adresse), liste);

      /* ── v1887 · MEHRDEUTIGE ADRESSE IST KEINE FREIGABE FUER DIE NUMMER ──
       *
       * GEMESSEN: zwei Objekte "Sachsenstraße 18, 32052 Herford" (der Bot
       * hatte dasselbe Objekt zweimal angelegt). `objektRaten` meldete
       * `mehrdeutig`, der Wächter unten prüfte auf `eindeutig` und liess
       * die erfundene `nummer: 1` durch — Antwort zur Löhner Str. 278.
       *
       *   > Zwei Treffer auf die genannte Adresse sind eine Frage nach
       *   > DIESER Adresse. Sie sind kein Grund, ein drittes Haus zu
       *   > nehmen, das gar nicht genannt wurde. */
      if (t.art === 'mehrdeutig') {
        const ids = t.kandidaten.map((o) => o.id);
        if (ctx.letztesObjekt && ids.some((i) => String(i) === String(ctx.letztesObjekt))) {
          return ctx.letztesObjekt;
        }
        if (ctx.merkeListe) ctx.merkeListe(ids);
        const e = new Error('mehrdeutig');
        e.mehrdeutig = t.kandidaten.map((o, i) => ({ nummer: i + 1, adresse: o.adresse }));
        e.grund = 'Auf die genannte Adresse passen mehrere Objekte.';
        throw e;
      }

      const perAdr = (t.art === 'eindeutig') ? t.objekt.id : null;
      if (perAdr && String(perAdr) !== String(perNr)) {
        const nrAdr = (liste.find((o) => o.id === perNr) || {}).adresse || '';
        /* Ein Objekt OHNE jede Adresse kann nicht das sein, das der Nutzer
           per Adresse genannt hat. GEMESSEN: auf "Cashflow bei der
           Musterstraße" fragte der Agent zurueck und bot als zweiten
           Kandidaten "Nummer 1" an — ein leeres Objekt namens "Unbenannt",
           das das Modell geraten hatte. Eine Rueckfrage zwischen einer
           Adresse und einem Nichts ist keine Frage. */
        if (!nrAdr.replace(/[\s,]/g, '')) return perAdr;
        if (ctx.merkeListe) ctx.merkeListe([perAdr, perNr]);
        const e = new Error('mehrdeutig');
        e.mehrdeutig = [
          { nummer: 1, adresse: t.objekt.adresse },
          { nummer: 2, adresse: nrAdr }
        ];
        e.grund = 'Die genannte Adresse und die genannte Nummer zeigen auf '
                + 'verschiedene Objekte.';
        throw e;
      }
    }
    return perNr;
  }
  if (a.id && /^[0-9a-f-]{36}$/i.test(String(a.id))) {
    const r = await query(`SELECT id FROM objects WHERE id = $1 AND user_id = $2`,
      [a.id, ctx.userId]);
    return r.rows.length ? r.rows[0].id : null;
  }
  if (a.adresse && _istPlatzhalter(a.adresse)) {
    /* Ein Platzhalter ist keine Angabe. Ihn wie eine zu behandeln heisst,
       ein Objekt auf eine Erfindung hin zu zeigen. */
    delete a.adresse;
  }
  if (a.adresse) {
    const liste = await dialog.objekteListe(ctx.userId, 60);
    const t = dialog.objektRaten(String(a.adresse), liste);
    if (t.art === 'eindeutig') return t.objekt.id;
    if (t.art === 'mehrdeutig') {
      /* ── v1809 · MEHRDEUTIG WAR EINE SACKGASSE ────────────────────────
       *
       * Hier stand `return null`, und das Werkzeug meldete darauf "Kein
       * Objekt gefunden" — obwohl zwei gefunden wurden. Die Kandidaten
       * gingen verloren, und ein spaeteres "die zweite" fand keine Liste.
       *
       *   > Zwei Treffer sind kein Fehlschlag, sondern eine Frage. Wer
       *   > sie als Fehlschlag meldet, macht aus einer Rueckfrage eine
       *   > Sackgasse. */
      const ids = t.kandidaten.map((o) => o.id);

      /* ── v1813f · BEI GLEICHSTAND GEWINNT DAS GESPRAECH ────────────────
       *
       * GEMESSEN: auf die Anschlussfrage "und die Miete?" gab das Modell
       * die Adresse des gerade besprochenen Objekts mit. War die
       * mehrdeutig, fragte der Agent zurueck — nach einem Objekt, ueber
       * das die beiden gerade geredet hatten.
       *
       *   > Zwei gleich gute Treffer sind keine Entscheidung. Steckt einer
       *   > davon im laufenden Gespraech, ist er es aber doch.
       *
       * Das ist KEIN Zurueckfallen ins Blaue: es gilt nur, wenn das
       * besprochene Objekt unter den Kandidaten IST. Ist es das nicht,
       * wird weiter gefragt. */
      if (ctx.letztesObjekt && ids.some((i) => String(i) === String(ctx.letztesObjekt))) {
        return ctx.letztesObjekt;
      }

      if (ctx.merkeListe) ctx.merkeListe(ids);
      const e = new Error('mehrdeutig');
      e.mehrdeutig = t.kandidaten.map((o, i) => ({ nummer: i + 1, adresse: o.adresse }));
      throw e;
    }
  }

  /* ── v1809 · NICHT BLIND AUFS LETZTE OBJEKT ZURUECKFALLEN ────────────
   *
   * Hier stand `return ctx.letztesObjekt` ohne jede Pruefung. Folge: eine
   * Frage, die eine UNBEKANNTE Adresse nennt, wurde stillschweigend zum
   * zuletzt besprochenen Objekt beantwortet.
   *
   *   > Eine Antwort zum falschen Objekt sieht genauso aus wie eine zum
   *   > richtigen. Nur die Zahlen stimmen nicht, und das faellt niemandem
   *   > auf, der sie nicht ohnehin kennt.
   *
   * Der Rueckfall gilt jetzt nur, wenn der Satz GAR KEINE eigene Adresse
   * nennt — dieselbe Pruefung, die der Webhook mit `knuepftAn` macht. */
  if (a.adresse && !ctx.letztesObjekt) return null;
  if (a.adresse && ctx.letztesObjekt) {
    const nennt = /\b(str\.|stra(ß|ss)e|weg|allee|platz|gasse|ring|damm)\b/i.test(String(a.adresse))
      || /[a-zäöüß]{3,}(str\.?|stra(ß|ss)e|weg|allee|platz)\b/i.test(String(a.adresse));
    if (nennt) return null;   /* eigene Adresse genannt, aber nicht gefunden */
  }

  /* Genau ein Objekt vorhanden? Dann ist es gemeint. */
  if (!ctx.letztesObjekt) {
    const liste = await dialog.objekteListe(ctx.userId, 3);
    if (liste.length === 1) return liste[0].id;
  }
  return ctx.letztesObjekt || null;
}

/* ═══ Das Register ═══════════════════════════════════════════════════ */

/* ── v1813d · "NUR WENN ..., SONST WEGLASSEN" ────────────────────────────
 *
 * GEMESSEN am 03.10.2026: das Modell fuellt JEDES Feld des Schemas, auch
 * wenn es den Wert nicht hat. Aus dem Protokoll:
 *
 *   {"nummer":1,"id":"uuid-Musterstraße","adresse":"Musterstraße"}
 *   {"nummer":1,"id":"uuid1","adresse":"Adresse des ersten Objekts"}
 *   {"nummer":3,"id":"1","adresse":"Musterstraße 12"}   <- bei Frage zu Nr 3
 *
 * Die dritte Zeile ist die gefaehrliche: eine erfundene Adresse, die sich
 * eindeutig aufloesen laesst, neben der richtigen Nummer.
 *
 *   > Ein leeres Feld im Schema ist fuer ein Modell eine Aufgabe, kein
 *   > Angebot. Was weggelassen werden darf, muss dastehen.
 */
const OBJEKT_ARGS = {
  nummer: { type: 'integer',
    description: 'Nummer aus der zuletzt gezeigten Liste — NUR wenn der Nutzer '
      + 'eine Zahl genannt hat. Sonst WEGLASSEN, nicht raten.' },
  id: { type: 'string',
    description: 'Objekt-UUID, 36 Zeichen — NUR wenn du sie aus einem '
      + 'Werkzeugergebnis hast. Sonst WEGLASSEN, nie erfinden.' },
  adresse: { type: 'string',
    description: 'Adresse oder Teil davon, WOERTLICH aus der Frage des Nutzers — '
      + 'NUR wenn er eine genannt hat. Sonst WEGLASSEN, keinen Platzhalter.' }
};

/* Erfundene Platzhalter abweisen, bevor sie ein Objekt treffen. */
function _istPlatzhalter(s) {
  const t = String(s || '').trim();
  if (t.length < 3) return true;
  return /^(uuid|id|xy|xyz|objekt|adresse|beispiel|string|null|undefined|n\/a)\b/i.test(t)
      || /uuid|platzhalter|des ersten objekts|der wohnung xy/i.test(t);
}

const WERKZEUGE = [
  { name: 'objekte_liste', stufe: 'lesen', fn: objekte_liste,
    beschreibung: 'Alle Objekte des Nutzers mit Nummer, Adresse, Kaufpreis und Scores. '
      + 'Die Nummer ist die, auf die sich der Nutzer spaeter bezieht.',
    parameter: { type: 'object', properties: {}, additionalProperties: false } },

  /* v1853 · N8 · Der Bankexport als Uebersicht — eine Zeile je Darlehen. */
  { name: 'bank_uebersicht', stufe: 'lesen', fn: bank_uebersicht,
    beschreibung: 'Die Bankuebersicht (Bankexport) ueber alle Objekte oder EIN Objekt: je Darlehen '
      + 'Adresse, Bank, Darlehensart, Summe, Zins, Tilgung, Zinsbindung, Vertragsnummer und '
      + '-datum, Restschuld und Rate. Nutze es, wenn nach Bankexport, Darlehensuebersicht, '
      + 'Finanzierungsuebersicht, Restschulden, Zinsbindungen oder Vertragsnummern gefragt wird. '
      + 'Kostet nichts; rechnet nichts. Gib "so_schreiben" zeilenweise wieder.',
    parameter: { type: 'object', properties: {
      adresse: { type: 'string', description: 'Optional: nur dieses Objekt (Adresse oder Teil davon)' }
    }, additionalProperties: false } },

  /* v1847 · Die Pilot-Analyse — gerechnet im Browser, gelesen vom Bot. */
  { name: 'pilot_analyse_lesen', stufe: 'lesen', fn: pilot_analyse_lesen,
    beschreibung: 'Die gespeicherte Pilot-Analyse EINES Objekts: Briefing mit Empfehlung, '
      + 'Staerken, Risiken, Risikoanalyse und Szenarien, Lage (Makro/Mikro/Mietspiegel), '
      + 'Verhandlungsempfehlung mit Kaufpreis-Offerte, Bankargumente. Nutze es, wenn nach '
      + 'Einschaetzung, Empfehlung, Staerken/Schwaechen, Risiken, Verhandlung oder Bank '
      + 'gefragt wird. Kostet nichts; rechnet nichts neu. Liegt keine Analyse vor, sagt '
      + 'das Ergebnis, wie sie entsteht - erfinde dann keine.',
    parameter: { type: 'object', properties: {
      adresse: { type: 'string', description: 'Adresse oder Teil davon' },
      nummer:  { type: 'integer', description: 'Nummer aus der zuletzt gezeigten Liste' },
      id:      { type: 'string', description: 'Objekt-Kennung, falls bekannt' }
    }, additionalProperties: false } },

  { name: 'objekt_lesen', stufe: 'lesen', fn: objekt_lesen,
    beschreibung: 'Alle Daten EINES Objekts: Kerndaten, Scores, Kennzahlen, Felder. '
      + 'Ohne Angabe wird das zuletzt besprochene Objekt genommen.',
    parameter: { type: 'object', properties: OBJEKT_ARGS, additionalProperties: false } },

  /* v2012 · Die Cockpit-Analyse - das Gegenstueck zu pilot_analyse_lesen. */
  { name: 'portfolio_analyse_lesen', stufe: 'lesen', fn: portfolio_analyse_lesen,
    beschreibung: 'Die gespeicherte PORTFOLIO-Analyse (Cockpit-Analyse) des Nutzers: '
      + 'Vermoegensbilanz, Ertragslage, welche Objekte tragen und welche belasten, '
      + 'Klumpenrisiken, Entwicklung und die naechsten Schritte - als Fliesstext, so '
      + 'wie der Portfolio-Pilot sie geschrieben hat. Nutze es, wenn nach der '
      + 'Gesamtbeurteilung, der Einschaetzung des Bestands, Klumpenrisiken oder '
      + '"was soll ich als naechstes tun" gefragt wird. Fuer reine ZAHLEN nimm '
      + 'portfolio_lesen. Kostet nichts; rechnet nichts neu. NENNE IMMER DEN STAND.',
    parameter: { type: 'object', properties: {}, additionalProperties: false } },

  { name: 'portfolio_lesen', stufe: 'lesen', fn: portfolio_lesen,
    beschreibung: 'Die Portfolio-Zahlen in EINEM Aufruf: Vermoegensbilanz, Projektion '
      + 'UND alle Objekte einzeln mit Kaufpreis, Darlehen, Restschuld, Tilgung, Zins, '
      + 'Miete, Cashflow, DSCR, LTV, Rendite und beiden Scores. '
      + 'IMMER aufrufen bei Fragen zum Gesamtbestand, zu Summen, Verbindlichkeiten, '
      + 'Tilgung, Rendite ueber alles, zur Zukunft — UND bei Vergleichen ueber mehrere '
      + 'Objekte ("welche haben den hoechsten/niedrigsten ..."). '
      + 'Dafuer NICHT jedes Objekt einzeln lesen: hier steht alles schon drin. '
      + 'Rechne Summen NUR aus diesen Zahlen, nie aus eigener Annahme.',
    parameter: { type: 'object', properties: {}, additionalProperties: false } },

  { name: 'objekte_felder', stufe: 'lesen', fn: objekte_felder,
    beschreibung: 'Liest BELIEBIGE Felder ueber ALLE Objekte auf einmal — '
      + 'Baujahr, Objektart, Keller, Heizung, Energieausweis, Zinsbindung, '
      + 'Zustand, Ausstattung: jede EINGETRAGENE Angabe. '
      + 'Lies NIEMALS zwanzig Objekte einzeln, um sie zu vergleichen. '
      + 'Kennst du den Feldnamen nicht, frag vorher feld_katalog. '
      + 'NICHT FUER GELD UND KENNZAHLEN: Restschuld, Cashflow, Rendite, DSCR, '
      + 'LTV, Tilgung und Scores stehen hier NICHT drin, weil sie gerechnet '
      + 'werden und nicht eingetragen sind — dafuer portfolio_lesen, das hat '
      + 'sie fuer alle Objekte fertig.',
    parameter: { type: 'object',
      properties: { felder: { type: 'array', items: { type: 'string' },
        description: 'Feld-Ids, z.B. ["baujahr","objart","keller"]' } },
      required: ['felder'], additionalProperties: false } },

  { name: 'objekt_kennzahlen', stufe: 'lesen', fn: objekt_kennzahlen,
    beschreibung: 'Die GERECHNETEN Zahlen EINES Objekts: Cashflow (Jahr und Monat), '
      + 'DSCR, LTV, Bruttomietrendite, Restschuld, Zins und Tilgung in Euro — '
      + 'DAZU die VOLLSTAENDIGE BEWERTUNG im Feld "bewertung": DealPilot-Score mit '
      + 'Stufe, die Kaufempfehlung (KAUFEN / VERHANDELN / KRITISCH / PASS), die '
      + 'Einschaetzungszeilen und die KI-Einordnung in "ki_einordnung". '
      + 'IMMER nehmen bei "wie ist der Cashflow bei ...", "wie ist der Score von ...", '
      + '"was bringt mir Objekt N" — NICHT portfolio_lesen und darin suchen: die '
      + 'Nummern der beiden Listen stimmen nicht ueberein. '
      + 'Rufe DANEBEN NICHT objekt_schnellblick — der steckt hier schon drin, und '
      + 'ein zweiter Aufruf erzeugt nur eine zweite KI-Einordnung. '
      + 'Antworte in EINER Nachricht: Score mit Stufe, Empfehlung, Einschaetzung, '
      + 'Einordnung. Nicht in mehreren.',
    parameter: { type: 'object', properties: OBJEKT_ARGS, additionalProperties: false } },

  { name: 'objekte_rangliste', stufe: 'lesen', fn: objekte_rangliste,
    beschreibung: 'Rangliste ueber alle Objekte: "was sind meine besten Wohnungen", '
      + '"welches Objekt hat den hoechsten Cashflow", "wo ist die Rendite am besten". '
      + 'Liefert je Objekt mehrere Kennzahlen nebeneinander, damit du nicht EINE '
      + 'Bedeutung von "beste" unterstellst. Mit "objektart" filtern ("Wohnung" wird zu '
      + 'ETW aufgeloest), mit "kennzahl" ordnen — aber nur, wenn der Nutzer die '
      + 'Messgroesse selbst nennt. '
      + 'FRAG NICHT NACH DER KENNZAHL: ohne Angabe kommen Score, Cashflow und Rendite '
      + 'nebeneinander, und du nennst in der Antwort, nach was du geordnet hast. Eine '
      + 'Rueckfrage ist hier eine unnoetige Runde — die Zahlen liegen alle vor.',
    parameter: { type: 'object',
      properties: {
        kennzahl: { type: 'string',
          enum: ['investor_deal_score', 'dealpilot_score', 'cashflow', 'cashflow_vor_steuer',
                 'bruttomietrendite', 'dscr', 'ltv', 'kaufpreis', 'miete', 'restschuld',
                 'darlehen', 'eigenkapital', 'zinssatz', 'wohnflaeche', 'baujahr'],
          description: 'NUR angeben, wenn der Nutzer die Messgroesse nennt. '
            + '"Finanzierungsbedarf", "Schulden", "wie viel steht noch offen" '
            + '-> restschuld. "Was habe ich aufgenommen" -> darlehen. '
            + 'Sonst WEGLASSEN — dann kommen Score, Cashflow und Rendite zusammen.' },
        objektart: { type: 'string',
          description: 'NUR wenn der Nutzer selbst eine Art nennt ("Wohnungen", "meine '
            + 'MFH"). Sonst WEGLASSEN — ein Filter, den niemand wollte, versteckt die '
            + 'Haelfte des Bestands, und die Antwort sieht trotzdem vollstaendig aus.' },
        anzahl: { type: 'integer',
          description: 'Wie viele Plaetze, hoechstens 30. Sonst WEGLASSEN.' }
      }, additionalProperties: false } },

  { name: 'objekt_felder_liste', stufe: 'lesen', fn: objekt_felder_liste,
    beschreibung: 'Alle EINGETRAGENEN Felder EINES Objekts mit Bezeichnung und Wert, nach '
      + 'Bereichen geordnet, dazu wie viele Felder leer sind. '
      + 'Nehmen bei "gib mir die Felder von ...", "was steht bei Objekt N alles drin", '
      + '"zeig mir alle Daten dazu". Mit "bereich" auf einen Teil eingrenzen '
      + '("miete", "darlehen", "zustand").',
    parameter: { type: 'object',
      properties: Object.assign({}, OBJEKT_ARGS, {
        bereich: { type: 'string', description: 'Suchwort, um die Liste einzugrenzen' }
      }), additionalProperties: false } },

  { name: 'cashflow_hebel_portfolio', stufe: 'lesen',
    fn: (ctx) => cashflow_hebel(ctx, { bereich: 'portfolio' }),
    beschreibung: 'Wie laesst sich der Cashflow im GESAMTBESTAND steigern? '
      + 'IMMER nehmen bei "wie kann ich meinen Cashflow steigern", "wo kann ich '
      + 'optimieren", "wo verliere ich Geld" — also immer dann, wenn der Nutzer KEIN '
      + 'einzelnes Objekt nennt. Liefert Cashflow und Kapitaldienst des Bestands, die '
      + 'Stellschrauben und die gerechneten Hebel der Objekte, die am meisten kosten — '
      + 'alles in EINEM Aufruf. Antworte NIE aus eigenem Wissen: ohne dieses Werkzeug '
      + 'hast du dazu keine Zahlen, und allgemeine Ratschlaege helfen bei keinem '
      + 'Portfolio.',
    parameter: { type: 'object', properties: {}, additionalProperties: false } },

  { name: 'cashflow_hebel', stufe: 'lesen', fn: cashflow_hebel,
    beschreibung: 'Wie laesst sich der Cashflow EINES Objekts steigern? Rechnet die '
      + 'Hebel am ECHTEN Datensatz: Tilgung, Zins, Mietspielraum gegen die eingetragene '
      + 'Vergleichsmiete, nicht umlagefaehige Kosten, zusaetzliche Einnahmen, Leerstand '
      + '— jeder mit Wirkung in Euro pro Jahr UND mit seiner Einschraenkung. '
      + 'Nur nehmen, wenn der Nutzer ein BESTIMMTES Objekt nennt; sonst '
      + 'cashflow_hebel_portfolio.',
    parameter: { type: 'object', properties: OBJEKT_ARGS, additionalProperties: false } },

  { name: 'objekt_schnellblick', stufe: 'lesen', fn: objekt_schnellblick,
    beschreibung: 'Die erste Einschaetzung zu einem Objekt, OHNE Abruf und ohne Kosten: '
      + 'Bruttomietrendite, Kaufpreisfaktor, Kaufpreis und Miete je Quadratmeter — '
      + 'jede Zahl mit ihrem Rechenweg. Dazu die Kaufnebenkosten, soweit belegbar: '
      + 'die GRUNDERWERBSTEUER kommt aus der Postleitzahl (gesetzlicher Satz des '
      + 'Landes), Notar und Grundbuch sind gekennzeichnete Richtwerte. Und die '
      + 'Finanzierung, wenn der Nutzer Zinssatz und Tilgung hinterlegt hat. '
      + 'DAZU DER DEAL-SCORE MIT SEINER STUFE, die KAUFEMPFEHLUNG (KAUFEN / '
      + 'VERHANDELN / KRITISCH / PASS) und die EINSCHAETZUNGSZEILEN — genau das, '
      + 'was der Quick-Check in DealPilot unten anzeigt, aus demselben Rechenkern — '
      + 'und zum Schluss die KI-EINORDNUNG in "bewertung.ki_einordnung". '
      + 'Antworte in EINER Nachricht, in dieser Reihenfolge: Zahlen, Score mit '
      + 'Stufe, Empfehlung, Einschaetzung, Einordnung. '
      + 'IMMER nehmen direkt nach dem Anlegen eines Objekts und bei "ist das ein '
      + 'guter Deal", "was haelst du davon", "lohnt sich das", "mach mal einen '
      + 'Quick-Check". Fehlen Angaben fuer den Score, sagt das Werkzeug welche — '
      + 'dann fragst du danach und nennst keinen Score.',
    parameter: { type: 'object', properties: OBJEKT_ARGS, additionalProperties: false } },

  { name: 'vorgaben_setzen', stufe: 'schreiben', fn: vorgaben_setzen,
    beschreibung: 'Hinterlegt die Standardwerte des Nutzers fuer kuenftige Objekte: '
      + 'Zinssatz (d1z), Tilgung (d1t), Zinsbindung (d1_bindj), Eigenkapitalquote '
      + '(ek_quote), Maklercourtage (makler_p), Notar (notar_p), Grundbuch (gba_p). '
      + 'Nur aufrufen, wenn der Nutzer sie GENANNT hat — erfinde keine Saetze. '
      + 'objekt_schnellblick sagt dir, ob schon Vorgaben hinterlegt sind; nur wenn '
      + 'nicht, fragst du EINMAL danach.',
    parameter: { type: 'object',
      properties: { felder: { type: 'object',
        description: 'Feld-Id zu Zahl, z.B. {"d1z": 3.8, "d1t": 2, "ek_quote": 20}' } },
      required: ['felder'], additionalProperties: false } },

  { name: 'pakete_und_preise', stufe: 'lesen', fn: pakete_und_preise,
    beschreibung: 'Die Pakete mit ihren PREISEN, direkt aus der Datenbank, nach der '
      + 'auch abgebucht wird — monatlich und jaehrlich, dazu Objekt- und '
      + 'Nutzergrenzen und welches Paket der Nutzer selbst hat. '
      + 'IMMER nehmen bei "was kostet ...", "welche Pakete gibt es", "was ist in '
      + 'Pro drin", "lohnt der Wechsel". Nenne NIE einen Preis aus dem Gedaechtnis: '
      + 'er steht in der Datenbank und aendert sich dort.',
    parameter: { type: 'object', properties: {}, additionalProperties: false } },

  { name: 'feld_katalog', stufe: 'lesen', fn: feld_katalog,
    beschreibung: 'Welche Felder es gibt und welche Werte bei Auswahlfeldern erlaubt '
      + 'sind. Mit "suche" nach einem Begriff fragen ("keller", "heizung", "zins") — '
      + 'das liefert die internen Feld-Ids, die objekte_felder und felder_aendern '
      + 'brauchen. Vor dem Aendern eines Auswahlfeldes aufrufen.',
    parameter: { type: 'object',
      properties: { suche: { type: 'string', description: 'Feldname oder Teil davon' } },
      additionalProperties: false } },

  { name: 'anlage_luecken', stufe: 'lesen', fn: anlage_luecken,
    beschreibung: 'Was fehlt an einem Objektentwurf noch? Gibt die naechsten Fragen in '
      + 'der richtigen Reihenfolge und die erlaubten Auswahlwerte.',
    parameter: { type: 'object',
      properties: { felder: { type: 'object', description: 'bisher bekannte Felder' } },
      additionalProperties: false } },

  { name: 'felder_aendern', stufe: 'schreiben', fn: felder_aendern,
    beschreibung: 'Aendert Felder an einem Objekt. Prueft Auswahlwerte und meldet belegte '
      + 'Felder zurueck, statt sie zu ueberschreiben.',
    parameter: { type: 'object',
      properties: Object.assign({}, OBJEKT_ARGS, {
        beschreibung: { type: 'string', description: 'Der Aenderungswunsch des Nutzers, woertlich' },
        felder: { type: 'object', description: 'Feld-Id zu Wert, z.B. {"zimmer":"5"}' },
        bestaetigt: { type: 'boolean', description: 'true erst, wenn der Nutzer ja gesagt hat' }
      }),
      additionalProperties: false } },

  { name: 'objekt_anlegen', stufe: 'schreiben', fn: objekt_anlegen,
    beschreibung: 'Legt ein neues Objekt an. Gib in "beschreibung" den ganzen Satz des '
      + 'Nutzers WOERTLICH weiter — daraus werden die Felder gezogen, auch die, deren '
      + 'interne Namen du nicht kennst. In "felder" nur, was du sicher zuordnen kannst.',
    parameter: { type: 'object',
      properties: {
        beschreibung: { type: 'string', description: 'Der Satz des Nutzers, woertlich' },
        felder: { type: 'object', description: 'Feld-Id zu Wert, soweit sicher bekannt' }
      }, additionalProperties: false } },

  { name: 'marktbericht_preis', stufe: 'lesen', fn: marktbericht_preis,
    beschreibung: 'Was kosten die Bewertungen? Liefert IMMER ALLE DREI Stufen '
      + 'mit Preis und Inhalt — du waehlst keine aus, der Nutzer waehlt. Drei Stufen: '
      + '1 = Marktpreisindikation (Lage und Preisspanne), '
      + '2 = Erweiterte Marktpreisindikation (zusaetzlich Zustand und Qualitaet, '
      + 'engere Spanne, mit Dossier), '
      + '3 = Wertermittlung nach ImmoWertV (Boden-, Ertrags- und Sachwert mit '
      + 'Rechenweg). Kostet selbst nichts. IMMER vor marktbericht_abrufen. '
      + 'Geht aus der Frage nicht hervor, welche Stufe gemeint ist, FRAG den Nutzer '
      + 'und nenne dabei, was die Stufen unterscheiden.',
    parameter: { type: 'object', properties: OBJEKT_ARGS,
      additionalProperties: false } },

  { name: 'marktbericht_preis_alle', stufe: 'lesen', fn: marktbericht_preis_alle,
    beschreibung: 'Was kostet eine Bewertung fuer ALLE Objekte zusammen? Nennt die '
      + 'Gesamtzahl der Abrufe, den Bestand und welche Objekte unvollstaendig sind. '
      + 'Kostet selbst nichts. IMMER aufrufen, wenn der Nutzer "fuer alle Objekte" sagt.',
    parameter: { type: 'object',
      properties: { stufe: { type: 'integer', description: '1, 2 oder 3' } },
      additionalProperties: false } },

  { name: 'marktbericht_abrufen', stufe: 'kostet', fn: marktbericht_abrufen,
    beschreibung: 'Ruft die Bewertung ab. KOSTET GUTHABEN. Nur aufrufen, wenn der Nutzer '
      + 'nach einer Preisansage ausdruecklich zugestimmt hat.',
    parameter: { type: 'object',
      properties: Object.assign({}, OBJEKT_ARGS,
        { stufe: { type: 'integer', description: '1, 2 oder 3' } }),
      additionalProperties: false } }
];

function fuerModell() {
  return WERKZEUGE.map((w) => ({
    type: 'function',
    name: w.name,
    description: w.beschreibung,
    parameters: w.parameter
  }));
}

function finde(name) { return WERKZEUGE.find((w) => w.name === name) || null; }

module.exports = { WERKZEUGE, fuerModell, finde };
