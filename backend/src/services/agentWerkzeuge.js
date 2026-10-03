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
      return {
        nummer: i + 1, id: o.id, adresse: o.adresse, kaufpreis_eur: o.kp,
        dealscore: e.score != null ? e.score : null,
        investor_deal_score: e.ids_ok ? e.ids_score : null
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

  return {
    vorhanden: true,
    stand: dialog.standSatz(sp.erfasst_am, sp.alter_minuten, sp.geaendert_seitdem),
    geaendert_seitdem: sp.geaendert_seitdem,
    hinweis: 'Alle Betraege sind GANZE EURO. Unter "so_schreiben" stehen sie '
           + 'fertig formatiert — nimm diese Schreibweise unveraendert.',
    so_schreiben: lesbar,
    daten: sp.payload
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

  Object.entries(felder).forEach(([fid, w]) => {
    if (fuehrung.feld(fid)) sauber[fid] = w; else unbekannt.push(fid);
  });
  if (!Object.keys(sauber).length) {
    return { ok: false, unbekannte_felder: unbekannt,
      hinweis: 'Keine verwertbaren Felder. Frag nach Adresse, Objektart und Flaeche.' };
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
      objekt_id: id, stufen: alle,
      hinweis: 'Hier stehen alle drei Stufen mit Preis und Inhalt.\n'
             + 'HAT DER NUTZER EINE GENANNT (z.B. "erweiterte", "vollstaendige '
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
  const id = await _findeObjekt(ctx, args);
  if (!id) return { ok: false, hinweis: 'Kein Objekt gefunden.' };
  const stufe = _stufe(args);
  const o = await dialog.objektKontext(ctx.userId, id);
  try {
    const r = await markt.abrufen(ctx.userId, o, stufe);
    ctx.merkeObjekt(id);

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
    return { ok: false, fehler: e.message, kontingent: Boolean(e.kontingent),
      upgrade_zu: e.upgradeTo || undefined };
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

function _ohneIntern(d) {
  const o = {};
  Object.keys(d || {}).forEach((k) => {
    if (k.indexOf('_') === 0) return;      /* _kpis_*, _ds2_*, _dealpilot_score */
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
  if (a.nummer != null && ctx.letzteListe && ctx.letzteListe.length) {
    const n = Number(a.nummer);
    if (n >= 1 && n <= ctx.letzteListe.length) return ctx.letzteListe[n - 1];
    return null;
  }
  if (a.id && /^[0-9a-f-]{36}$/i.test(String(a.id))) {
    const r = await query(`SELECT id FROM objects WHERE id = $1 AND user_id = $2`,
      [a.id, ctx.userId]);
    return r.rows.length ? r.rows[0].id : null;
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

const OBJEKT_ARGS = {
  nummer: { type: 'integer', description: 'Nummer aus der zuletzt gezeigten Liste' },
  id: { type: 'string', description: 'Objekt-UUID' },
  adresse: { type: 'string', description: 'Adresse oder Teil davon' }
};

const WERKZEUGE = [
  { name: 'objekte_liste', stufe: 'lesen', fn: objekte_liste,
    beschreibung: 'Alle Objekte des Nutzers mit Nummer, Adresse, Kaufpreis und Scores. '
      + 'Die Nummer ist die, auf die sich der Nutzer spaeter bezieht.',
    parameter: { type: 'object', properties: {}, additionalProperties: false } },

  { name: 'objekt_lesen', stufe: 'lesen', fn: objekt_lesen,
    beschreibung: 'Alle Daten EINES Objekts: Kerndaten, Scores, Kennzahlen, Felder. '
      + 'Ohne Angabe wird das zuletzt besprochene Objekt genommen.',
    parameter: { type: 'object', properties: OBJEKT_ARGS, additionalProperties: false } },

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
    beschreibung: 'Liest BELIEBIGE Felder ueber ALLE Objekte auf einmal. '
      + 'DAS IST DAS WERKZEUG FUER JEDE FRAGE NACH "WELCHE OBJEKTE ..." — '
      + 'Baujahr, Objektart, Keller, Heizung, Energieausweis, Zinsbindung, '
      + 'Sanierungsstand, einfach jedes Feld. '
      + 'Lies NIEMALS zwanzig Objekte einzeln, um sie zu vergleichen: ein '
      + 'Aufruf hier liefert dasselbe. '
      + 'Kennst du den Feldnamen nicht, frag vorher feld_katalog.',
    parameter: { type: 'object',
      properties: { felder: { type: 'array', items: { type: 'string' },
        description: 'Feld-Ids, z.B. ["baujahr","objart","keller"]' } },
      required: ['felder'], additionalProperties: false } },

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
