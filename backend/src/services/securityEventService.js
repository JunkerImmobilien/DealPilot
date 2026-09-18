'use strict';
/* ══════════════════════════════════════════════════════════════════════
   v1367 · SICHERHEITSEREIGNISSE — BEOBACHTEN, NICHT URTEILEN

   Punkt B3 aus Marcels Schutz-Lastenheft: "unabhängig vom verwendeten
   Werkzeug erkennen, ob ein Account versucht, die Anwendung
   automatisiert, systematisch oder in ungewöhnlichem Umfang auszulesen."

   Dieser Dienst macht die erste Hälfte davon: er schreibt Beobachtungen
   fort und beantwortet Fragen darüber. Die zweite Hälfte - was daraus
   folgt - ist ausdrücklich NICHT hier. Marcels Auflage:

     "Eine technische Auffälligkeit oder ein automatisch erzeugter
      Risikoscore darf NICHT automatisch als rechtlich bewiesener
      Vertragsverstoß behandelt werden."

   DESHALB GIBT ES HIER KEINE SPERRE UND KEINEN SCORE. Es gibt eine
   Chronik und zwei Kennzahlen, die ein Mensch lesen kann.

   ────────────────────────────────────────────────────────────────────
   DIE ZWEI KENNZAHLEN, UND WARUM GERADE DIESE

   Gemessen am 13.09.2026 an echter Nutzung (Seitenstart plus drei
   geöffnete Objekte, 57 Anfragen in 24 Sekunden):

     Vielfalt         12 verschiedene Endpunktgruppen
     Unregelmäßigkeit Variationskoeffizient der Abstände: 5,13

   Ein Auslese-Skript trifft ein bis zwei Gruppen bei einer Streuung nahe
   null. VIELFALT UND UNREGELMÄSSIGKEIT UNTERSCHEIDEN BESSER ALS REINE
   FREQUENZ - ein Mensch klickt stoßweise und löst dabei ein Dutzend
   verschiedene Dinge aus, ein Skript zieht gleichmäßig eine Sache ab.

   Das trifft genau B18: "Fehlalarmschutz: Nutzungshistorie und
   Accounttyp berücksichtigen, Eskalation statt Sofortsperre." Wer nur
   nach Tempo geht, sperrt den fleißigsten Kunden zuerst.
   ══════════════════════════════════════════════════════════════════════ */

const { query } = require('../db/pool');

/* Nur diese Arten werden geschrieben. Eine feste Liste, damit nicht mit
   der Zeit vierzig Sorten entstehen, die niemand mehr auswerten kann. */
const ARTEN = {
  RATE_LIMIT: 'rate_limit',      // Kontingent überschritten
  AUTH_FAIL:  'auth_fail',       // Anmeldung gescheitert
  MUSTER:     'muster',          // auffälliges Zugriffsmuster

  /* v1369 (B4): die drei Zustände, die NUR ein Mensch setzt. Sie stehen
     bewusst in derselben Tabelle wie die Beobachtungen - dadurch steht
     die Entscheidung in derselben Chronologie wie das, was zu ihr
     geführt hat, und niemand muss zwei Quellen vergleichen. */
  EINGESCHRAENKT: 'eingeschraenkt',
  GESPERRT:       'gesperrt',
  FREIGEGEBEN:    'freigegeben'
};

const STUFEN = { HINWEIS: 'hinweis', AUFFAELLIG: 'auffaellig', ERNST: 'ernst' };

/* ──────────────────────────────────────────────────────────────────────
   Schreiben. Wirft nie - ein Protokoll, das die Anwendung umbringt, ist
   schlimmer als kein Protokoll.
   ────────────────────────────────────────────────────────────────────── */
async function schreibe({ userId, ipKey, art, stufe, pfad, methode, detail }) {
  try {
    if (!art) return null;
    const r = await query(
      `INSERT INTO security_events (user_id, ip_key, art, stufe, pfad, methode, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING id, created_at`,
      [
        userId || null,
        userId ? null : (ipKey || null),   // bei bekanntem Konto keine IP
        String(art).slice(0, 40),
        STUFEN[String(stufe || '').toUpperCase()] || stufe || STUFEN.HINWEIS,
        pfad ? String(pfad).split('?')[0].slice(0, 200) : null,
        methode ? String(methode).slice(0, 10) : null,
        JSON.stringify(detail || {})
      ]
    );
    return r.rows[0] || null;
  } catch (e) {
    console.warn('[sec] Ereignis nicht gespeichert:', e.message);
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────────────
   Die Chronik eines Kontos. Für die Fallakte aus B19 - chronologisch,
   ohne Bewertung.
   ────────────────────────────────────────────────────────────────────── */
async function chronik(userId, { seit, limit } = {}) {
  const r = await query(
    `SELECT id, art, stufe, pfad, methode, detail, created_at
       FROM security_events
      WHERE user_id = $1
        AND created_at >= COALESCE($2::timestamptz, NOW() - INTERVAL '30 days')
      ORDER BY created_at DESC
      LIMIT $3`,
    [userId, seit || null, Math.min(parseInt(limit, 10) || 200, 1000)]
  );
  return r.rows;
}

/* ──────────────────────────────────────────────────────────────────────
   Die Auswertung. Gibt ZAHLEN zurück, kein Urteil.

   `vielfalt`       wie viele verschiedene Endpunktgruppen getroffen wurden
   `streuung`       Variationskoeffizient der Abstände zwischen Ereignissen
                    (Standardabweichung geteilt durch Mittelwert)

   Zur Einordnung dienen die gemessenen Vergleichswerte oben - sie stehen
   als `vergleich` mit in der Antwort, damit niemand die Zahlen ohne
   Maßstab liest.

   WARUM DIE STREUUNG NUR AB FÜNF EREIGNISSEN: bei drei Abständen ist ein
   Variationskoeffizient Rauschen. Darunter wird `null` zurückgegeben -
   und `null` heißt "weiß ich nicht", nicht "unauffällig".
   ────────────────────────────────────────────────────────────────────── */
async function muster(userId, { fensterMinuten } = {}) {
  const fenster = Math.min(Math.max(parseInt(fensterMinuten, 10) || 60, 1), 1440);
  const r = await query(
    `SELECT pfad, created_at
       FROM security_events
      WHERE user_id = $1
        AND created_at >= NOW() - ($2 || ' minutes')::interval
      ORDER BY created_at ASC`,
    [userId, String(fenster)]
  );
  const zeilen = r.rows || [];

  /* v1367c: das gemeinsame Präfix muss weg, bevor gruppiert wird.
     Erst stand hier `pfad.replace(/^\/+/,'').split('/')[0]` - das ergibt
     bei JEDEM Pfad `api`, weil alle mit /api/v1/ beginnen. Die Vielfalt
     war damit immer 1, und eine Kennzahl, die immer dasselbe sagt, sieht
     aus wie eine Kennzahl.

     Gefunden beim Probelauf mit fünf verschiedenen Pfaden: gemeldet wurde
     `vielfalt: 1`. Dieselbe Sorte Fehler wie die Leser, die ins Leere
     greifen - sie fällt nur auf, wenn man das Ergebnis gegen eine
     bekannte Erwartung hält. */
  const gruppen = new Set();
  zeilen.forEach((z) => {
    if (!z.pfad) return;
    const ohnePraefix = String(z.pfad).replace(/^\/?api\/v\d+\//i, '').replace(/^\/+/, '');
    const g = ohnePraefix.split('/')[0];
    if (g) gruppen.add(g);
  });

  let streuung = null;
  if (zeilen.length >= 5) {
    const luecken = [];
    for (let i = 1; i < zeilen.length; i++) {
      luecken.push(new Date(zeilen[i].created_at) - new Date(zeilen[i - 1].created_at));
    }
    const mittel = luecken.reduce((a, b) => a + b, 0) / luecken.length;
    if (mittel > 0) {
      const varianz = luecken.reduce((a, b) => a + Math.pow(b - mittel, 2), 0) / luecken.length;
      streuung = Math.round((Math.sqrt(varianz) / mittel) * 100) / 100;
    }
  }

  return {
    fenster_minuten: fenster,
    ereignisse: zeilen.length,
    vielfalt: gruppen.size,
    streuung,
    /* Der Maßstab gehört zur Zahl - sonst liest jemand "3" und weiß
       nicht, ob das viel ist. */
    vergleich: {
      normalnutzung_vielfalt: 12,
      normalnutzung_streuung: 5.13,
      gemessen_am: '2026-09-13',
      hinweis: 'Ein Skript trifft ein bis zwei Gruppen bei Streuung nahe null. '
             + 'Diese Zahlen sind eine Beobachtung, kein Urteil.'
    }
  };
}

/* ══════════════════════════════════════════════════════════════════════
   v1369 (B4) · RISIKOSTUFEN — WO DIE MASCHINE AUFHÖRT UND DER MENSCH
   ANFÄNGT
   ══════════════════════════════════════════════════════════════════════
   Marcels Stufenleiter aus dem Lastenheft:

     NORMAL → AUFFÄLLIG → WARNUNG → HOHES RISIKO
            → EINGESCHRÄNKT → GESPERRT → MANUELL FREIGEGEBEN

   SEINE ENTSCHEIDUNG VOM 13.09.2026 ZIEHT DIE TRENNLINIE MITTEN HINEIN:

     die ersten vier   werden BERECHNET  — das sind Messwerte
     die letzten drei  werden GESETZT    — das sind Entscheidungen

   Gefragt war, ab wann das System selbst eingreift. Die Antwort: gar
   nicht. Es stuft ein und meldet; jede Einschränkung und jede Sperre
   setzt ein Mensch. Das ist die strengste Auslegung seiner eigenen
   Auflage - und die einzige, bei der ein Fehlalarm keinen zahlenden
   Kunden aussperrt.

   ────────────────────────────────────────────────────────────────────
   MUSTER **UND** MENGE — die zweite Entscheidung

   Eine Stufe steigt nur, wenn BEIDES zutrifft: viele Überschreitungen
   UND ein skript-typisches Muster. Das ist B18 („Fehlalarmschutz:
   Nutzungshistorie berücksichtigen, Eskalation statt Sofortsperre")
   wörtlich genommen.

   Warum das nötig ist, zeigt die Messung vom 13.09.2026: echte Nutzung
   trifft 12 Endpunktgruppen bei einem Variationskoeffizienten von 5,13.
   Ein Nutzer mit großem Portfolio erzeugt viel Verkehr - aber
   UNGLEICHMÄSSIG und über viele Endpunkte. Wer nur die Menge zählt,
   trifft zuerst den fleißigsten Kunden.

   Die Schwellen sind ein Vorschlag, kein Naturgesetz. Sie stehen hier
   an einer Stelle und sind über den Admin änderbar (B17), sobald echte
   Daten da sind. Bis dahin gilt: lieber zu spät einstufen als zu früh.
   ══════════════════════════════════════════════════════════════════════ */
const RISIKO = {
  NORMAL:         'normal',
  AUFFAELLIG:     'auffaellig',
  WARNUNG:        'warnung',
  HOHES_RISIKO:   'hohes_risiko',
  EINGESCHRAENKT: 'eingeschraenkt',
  GESPERRT:       'gesperrt',
  FREIGEGEBEN:    'freigegeben'
};

/* ══════════════════════════════════════════════════════════════════════
   v1371 (B17) · DIE SCHWELLEN GEHÖREN DEM BETREIBER

   Bis hierher standen sie als Konstante im Code. Das war für den Anfang
   richtig — man kann nichts einstellen, was man noch nicht gemessen hat.
   Jetzt gibt es Messwerte, und damit gehört die Entscheidung in die
   Datenbank (Migration 073).

   DER CACHE IST HIER PFLICHT, NICHT KOMFORT: `stufeBerechnen` läuft an
   den Limit-Schwellen und in jeder Fallakte. Eine Abfrage je Aufruf
   wäre genau die Sorte Kosten, die dieses System vermeiden soll.

   Und wenn die Tabelle nicht antwortet, gelten die eingebauten Werte —
   ein Schutzsystem, das ohne Konfiguration stehenbleibt, schützt nicht.
   ══════════════════════════════════════════════════════════════════════ */
const SCHWELLEN_VORGABE = [
  { stufe: RISIKO.HOHES_RISIKO, ueberschreitungen: 50, maxVielfalt: 2, maxStreuung: 1.0 },
  { stufe: RISIKO.WARNUNG,      ueberschreitungen: 20, maxVielfalt: 3, maxStreuung: 1.5 },
  { stufe: RISIKO.AUFFAELLIG,   ueberschreitungen: 5,  maxVielfalt: 99, maxStreuung: 99 }
];

let _cfgCache = null;
let _cfgBis = 0;
const CFG_TTL = 60 * 1000;

async function konfiguration() {
  if (_cfgCache && _cfgBis > Date.now()) return _cfgCache;
  try {
    const r = await query('SELECT * FROM security_config WHERE id = 1');
    if (!r.rowCount) throw new Error('keine Zeile');
    const c = r.rows[0];
    _cfgCache = {
      schwellen: [
        { stufe: RISIKO.HOHES_RISIKO, ueberschreitungen: c.hoch_ab,
          maxVielfalt: c.hoch_vielfalt, maxStreuung: Number(c.hoch_streuung) },
        { stufe: RISIKO.WARNUNG, ueberschreitungen: c.warnung_ab,
          maxVielfalt: c.warnung_vielfalt, maxStreuung: Number(c.warnung_streuung) },
        { stufe: RISIKO.AUFFAELLIG, ueberschreitungen: c.auffaellig_ab,
          maxVielfalt: 99, maxStreuung: 99 }
      ],
      roh: c,
      aus_datenbank: true
    };
  } catch (e) {
    /* Vorgabewerte statt Stillstand. */
    _cfgCache = { schwellen: SCHWELLEN_VORGABE, roh: null, aus_datenbank: false };
  }
  _cfgBis = Date.now() + CFG_TTL;
  return _cfgCache;
}

/* Nach einer Änderung im Admin sofort wirksam machen, statt bis zu einer
   Minute auf den Cache zu warten. */
function konfigurationVergessen() { _cfgCache = null; _cfgBis = 0; }


/* ──────────────────────────────────────────────────────────────────────
   Die berechnete Stufe. Gibt IMMER auch die Begründung zurück - eine
   Stufe ohne Begründung ist ein Urteil ohne Akte.
   ────────────────────────────────────────────────────────────────────── */
async function stufeBerechnen(userId, { fensterMinuten } = {}) {
  const m = await muster(userId, { fensterMinuten: fensterMinuten || 60 });

  /* Nur Limit-Überschreitungen zählen für die Menge - eine gescheiterte
     Anmeldung ist etwas anderes und gehört nicht in dieselbe Waage. */
  const r = await query(
    `SELECT COUNT(*)::int AS n
       FROM security_events
      WHERE user_id = $1 AND art = $2
        AND created_at >= NOW() - ($3 || ' minutes')::interval`,
    [userId, ARTEN.RATE_LIMIT, String(m.fenster_minuten)]
  );
  const n = (r.rows[0] && r.rows[0].n) || 0;

  const cfg = await konfiguration();
  for (const s of cfg.schwellen) {

    if (n < s.ueberschreitungen) continue;

    /* Die Muster-Bedingung. `streuung === null` heißt „zu wenig Daten" -
       und zu wenig Daten dürfen NIE eine höhere Stufe rechtfertigen. */
    const musterPasst =
      (m.vielfalt <= s.maxVielfalt) &&
      (s.maxStreuung >= 99 || (m.streuung !== null && m.streuung <= s.maxStreuung));

    if (!musterPasst) continue;

    return {
      stufe: s.stufe,
      berechnet: true,
      grund: {
        ueberschreitungen: n,
        schwelle: s.ueberschreitungen,
        vielfalt: m.vielfalt,
        vielfalt_grenze: s.maxVielfalt < 99 ? s.maxVielfalt : null,
        streuung: m.streuung,
        streuung_grenze: s.maxStreuung < 99 ? s.maxStreuung : null,
        fenster_minuten: m.fenster_minuten
      },
      vergleich: m.vergleich
    };
  }

  return {
    stufe: RISIKO.NORMAL,
    berechnet: true,
    grund: { ueberschreitungen: n, vielfalt: m.vielfalt, streuung: m.streuung,
             fenster_minuten: m.fenster_minuten },
    vergleich: m.vergleich
  };
}

/* ──────────────────────────────────────────────────────────────────────
   Der geltende Zustand. Eine menschliche Entscheidung schlägt jede
   Berechnung - und sie gilt, bis ein Mensch sie aufhebt.

   WARUM KEIN EIGENES STATUSFELD: der Zustand ergibt sich aus der
   jüngsten Entscheidung in der Chronik. Ein zweiter Speicher daneben
   könnte auseinanderlaufen, und dann hätte man zwei Wahrheiten darüber,
   ob jemand gesperrt ist. Die Chronik ist append-only und damit die
   verlässlichere Quelle.
   ────────────────────────────────────────────────────────────────────── */
async function zustand(userId) {
  const r = await query(
    `SELECT art, stufe, detail, created_at
       FROM security_events
      WHERE user_id = $1 AND art = ANY($2)
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId, [ARTEN.EINGESCHRAENKT, ARTEN.GESPERRT, ARTEN.FREIGEGEBEN]]
  );

  const berechnet = await stufeBerechnen(userId);

  if (!r.rowCount) {
    return { geltend: berechnet.stufe, durch: 'berechnung', berechnet };
  }

  const e = r.rows[0];
  const gesetzt = e.art === ARTEN.FREIGEGEBEN ? RISIKO.FREIGEGEBEN
                : e.art === ARTEN.GESPERRT    ? RISIKO.GESPERRT
                : RISIKO.EINGESCHRAENKT;

  /* „Manuell freigegeben" hebt die Einschränkung auf - die Berechnung
     läuft danach weiter, aber sie sperrt nichts. Deshalb gilt bei einer
     Freigabe wieder der berechnete Wert, mit dem Vermerk, dass ein
     Mensch zugestimmt hat. */
  if (gesetzt === RISIKO.FREIGEGEBEN) {
    return {
      geltend: berechnet.stufe,
      durch: 'freigabe',
      freigegeben_am: e.created_at,
      freigegeben_von: (e.detail && e.detail.admin) || null,
      notiz: (e.detail && e.detail.notiz) || null,
      berechnet
    };
  }

  return {
    geltend: gesetzt,
    durch: 'entscheidung',
    seit: e.created_at,
    von: (e.detail && e.detail.admin) || null,
    notiz: (e.detail && e.detail.notiz) || null,
    berechnet
  };
}

/* Eine menschliche Entscheidung festhalten. Verlangt IMMER eine Notiz -
   wer einschränkt, soll sagen warum, und zwar bevor er es tut. Ohne das
   steht in der Akte später eine Sperre ohne Begründung, und niemand kann
   sie prüfen. */
async function entscheiden({ userId, art, adminEmail, notiz }) {
  const erlaubt = [ARTEN.EINGESCHRAENKT, ARTEN.GESPERRT, ARTEN.FREIGEGEBEN];
  if (erlaubt.indexOf(art) < 0) throw new Error('unerlaubte Entscheidung: ' + art);
  if (!notiz || String(notiz).trim().length < 3) throw new Error('Begruendung fehlt');

  const vorher = await stufeBerechnen(userId);

  return schreibe({
    userId,
    art,
    stufe: art === ARTEN.FREIGEGEBEN ? STUFEN.HINWEIS : STUFEN.ERNST,
    detail: {
      admin: adminEmail || null,
      notiz: String(notiz).trim().slice(0, 500),
      /* Der berechnete Stand im Moment der Entscheidung - damit später
         nachvollziehbar ist, worauf sie sich stützte. */
      stand_bei_entscheidung: vorher.stufe,
      grund_bei_entscheidung: vorher.grund
    }
  });
}

module.exports = { schreibe, chronik, muster, stufeBerechnen, zustand, entscheiden,
                   konfiguration, konfigurationVergessen, SCHWELLEN_VORGABE,
                   ARTEN, STUFEN, RISIKO };

