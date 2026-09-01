'use strict';
/**
 * V63.86 — KI-Credits-Service
 * ═══════════════════════════════════════════════════════════════
 * Verwaltet pro User:
 *   - Monatslimit aus Plan (Free=1, Starter=5, Investor=15, Pro=40)
 *   - aktueller Monats-Verbrauch (resettet beim Monatswechsel)
 *   - Bonus-Credits aus Käufen (verfallen erst nach Verbrauch)
 *
 * Reihenfolge der Verbrauch:
 *   1. Bonus-Credits zuerst (FIFO im Sinne dass die Anzeige sie reduziert)
 *   2. Wenn keine Bonus-Credits mehr → Monats-Credits
 *   3. Wenn beides leer → 402 Payment Required
 */
const { query } = require('../db/pool');

/* ═══ v1183 · DREI KONTINGENTE STATT EINES LITERTANKS ═══════════════════
   Bis hierher lief alles ueber einen einzigen Zaehler in Litern, und die
   Preise je Leistung steckten verstreut in den Routen (marktbericht.js
   COST = {fast:2, full:5, wertermittlung:12}). Der Kunde sah einen Tank und
   musste selbst ausrechnen, wie viele Bewertungen darin stecken.

   Jetzt zaehlt jede Leistungsart fuer sich:
     mpi       Stufe 1 · Marktpreisindikation            (frueher 2 L)
     mpi_plus  Stufe 2 · Erweiterte Marktpreisindikation (frueher 5 L)
     wev       Stufe 3 · Wertermittlung nach ImmoWertV   (frueher 12 L)

   MUSS MIT frontend/js/config.js ZUSAMMENPASSEN. Dort steht dieselbe
   Tabelle als `kontingent:` je Plan — sie treibt die Anzeige, diese hier
   die Abrechnung. Laufen sie auseinander, wirbt die Seite mit einer Zahl,
   die der Server nicht gibt. Beim Aendern BEIDE anfassen.

   `partner` ist ein erweiterter Pro und erbt dessen Kontingent — dieselbe
   Regel wie in reseller-portal.js:612. Fehlt ein Plan hier, gilt free;
   ein unbekannter Schluessel darf nie versehentlich grosszuegig sein. */
const KONTINGENT = {
  free:     { mpi: 1, mpi_plus: 0, wev: 0, sparfaktor: 0 },
  starter:  { mpi: 5, mpi_plus: 0, wev: 0, sparfaktor: 3 },
  investor: { mpi: 5, mpi_plus: 5, wev: 0, sparfaktor: 3 },
  pro:      { mpi: 5, mpi_plus: 5, wev: 5, sparfaktor: 3 },
  partner:  { mpi: 5, mpi_plus: 5, wev: 5, sparfaktor: 3 }
};

const ARTEN = ['mpi', 'mpi_plus', 'wev'];

/* ═══ v1185 · Das Testpaket ═════════════════════════════════════════════
   Vier Wochen Pro ab Registrierung (plan_trials, TR7 seit v811b) geben den
   FUNKTIONSUMFANG frei. Die Bewertungen kamen bis hierher nicht mit: der
   Testnutzer sah Pro, hatte aber das Free-Kontingent — eine
   Marktpreisindikation im Monat, keine Wertermittlung. Er konnte also
   gerade das nicht testen, wofuer er zahlen soll.

   Marcels Entscheidung vom 31.08.2026: ein EINMALIGES Paket fuer das ganze
   Fenster, das mit der Testphase verfaellt. Nicht das Monatskontingent
   eines Pro — das haenge am Zufall des Anmeldedatums (wer sich am 20.
   anmeldet, bekaeme am 1. das naechste) und wandere beim Monatswechsel in
   die Bank, die nie verfaellt.

   DIESE ZAHLEN SIND EIN PREIS. Sie stehen auch in frontend/js/config.js
   als `testphase` und in der Cockpit-Matrix. Beim Aendern alle drei
   anfassen — es ist dieselbe Falle wie bei KONTINGENT oben. */
const TESTPAKET = { mpi: 5, mpi_plus: 3, wev: 1 };
const TESTPHASE_TAGE = 28;

/* Die Stufen des Marktberichts heissen im Code seit je 1/2/3. Diese
   Zuordnung ist die einzige Stelle, an der aus einer Stufe eine Art wird. */
const STUFE_ART = { 1: 'mpi', 2: 'mpi_plus', 3: 'wev' };

/* STILLGELEGT v1183 — bleibt exportiert, weil aeltere Aufrufer die Tabelle
   noch lesen koennen. Sie beschreibt den alten Litertank und darf fuer
   keine Abrechnung mehr herangezogen werden. */
const PLAN_LIMITS = {
  free:     2,
  starter:  10,
  investor: 40,
  pro:      100
};

// Monats-Reset: Wenn current_period_start in einem früheren Monat liegt → reset
async function _ensureCurrentPeriod(userId) {
  await query(`
    INSERT INTO ai_credits_user (user_id) VALUES ($1)
    ON CONFLICT (user_id) DO NOTHING
  `, [userId]);

  await query(`
    UPDATE ai_credits_user
    SET current_period_used  = 0,
        current_period_start = date_trunc('month', NOW())::date,
        updated_at = NOW()
    WHERE user_id = $1
      AND current_period_start < date_trunc('month', NOW())::date
  `, [userId]);
}

/* ─── v1185 · Testpaket gewaehren ───────────────────────────────────────
   Wird beim Vergeben der Testphase gerufen (userService.createUser und der
   Admin-Weg). `bis` ist plan_trials.expires_at.

   NUR EINMAL JE NUTZER: die Bedingung ist `testphase_bis IS NULL`. Wer
   schon eine Testphase hatte, bekommt keine zweite — sonst waere ein
   zweites Konto oder ein zweiter Admin-Klick ein zweites Paket. */
async function gewaehreTestpaket(userId, bis, opts) {
  if (!userId || !bis) return { ok: false, reason: 'fehlende_angabe' };
  opts = opts || {};
  await _ensureCurrentPeriod(userId);

  /* v1189: `erneuern` hebt den Einmal-Riegel auf. Die Registrierung darf
     das NIE — sonst waere ein zweites Konto ein zweites Paket. Der Admin
     darf es, weil dahinter eine Person steht, die es entscheidet, und die
     Vergabe im Audit-Log landet. */
  const bedingung = opts.erneuern ? '' : ' AND testphase_bis IS NULL';
  const r = await query(
    'UPDATE ai_credits_user' +
    '   SET testphase_mpi = $2, testphase_mpi_plus = $3, testphase_wev = $4,' +
    '       testphase_bis = $5, updated_at = NOW()' +
    ' WHERE user_id = $1' + bedingung +
    ' RETURNING user_id',
    [userId, TESTPAKET.mpi, TESTPAKET.mpi_plus, TESTPAKET.wev, bis]
  );
  if (!r.rowCount) return { ok: false, reason: 'schon_gewaehrt' };
  await query(
    "INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1,'testphase',0,'trial',$2)",
    [userId, JSON.stringify({ paket: TESTPAKET, bis: bis })]
  );
  return { ok: true, paket: TESTPAKET, bis: bis };
}

/* ─── v1185 · Der Verfall ───────────────────────────────────────────────
   Laeuft vor jeder Auskunft und vor jeder Abbuchung. Was von der
   Testphase uebrig ist, wird verworfen — es wandert NICHT in die Bank.
   Genau das ist der Unterschied zum Monatskontingent.

   `testphase_bis` bleibt stehen: sie ist der Nachweis, dass dieser Nutzer
   seine Testphase hatte, und der Riegel gegen ein zweites Paket. */
async function _verfallTestphase(userId) {
  await query(
    'UPDATE ai_credits_user' +
    '   SET testphase_mpi = 0, testphase_mpi_plus = 0, testphase_wev = 0,' +
    '       updated_at = NOW()' +
    ' WHERE user_id = $1 AND testphase_bis IS NOT NULL AND testphase_bis <= NOW()' +
    '   AND (testphase_mpi > 0 OR testphase_mpi_plus > 0 OR testphase_wev > 0)',
    [userId]
  );
}

async function _planKey(userId) {
  const r = await query(`
    SELECT plan_id FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1
  `, [userId]);
  const plan = r.rowCount ? r.rows[0].plan_id : 'free';
  return KONTINGENT[plan] ? plan : 'free';
}

async function _getPlanLimit(userId) {
  const r = await query(`
    SELECT plan_id FROM subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1
  `, [userId]);
  const plan = r.rowCount ? r.rows[0].plan_id : 'free';
  return PLAN_LIMITS[plan] != null ? PLAN_LIMITS[plan] : 1;
}

/* ─── Monatsuebertrag ───────────────────────────────────────────────────
   Marcels Regel: nicht genutzte Abrufe verfallen NICHT. Beim Monatswechsel
   wandert der Rest ins Sparguthaben, gedeckelt auf das Dreifache des
   Monatskontingents (`sparfaktor`).

   Warum ein eigener Merker (`kontingent_carry_at`) und nicht
   `current_period_start`: letzteres wird beim Reset gesetzt, egal ob der
   Uebertrag lief. Bricht der Vorgang dazwischen ab, waere das Guthaben
   still weg. Der eigene Merker macht den Uebertrag idempotent — zweimal
   aufgerufen traegt er nur einmal ueber.

   Zwei Monate Pause sind kein Sonderfall: es wird der Rest EINES Monats
   uebertragen, nicht je verpasstem Monat einer. Wer drei Monate nicht da
   war, hat auch nur einmal etwas uebrig gehabt. */
async function _carryOver(userId, plan) {
  const k = KONTINGENT[plan] || KONTINGENT.free;
  const r = await query(`
    SELECT mpi_used, mpi_plus_used, wev_used,
           mpi_bank, mpi_plus_bank, wev_bank,
           kontingent_carry_at
      FROM ai_credits_user WHERE user_id = $1
  `, [userId]);
  if (!r.rowCount) return;
  const row = r.rows[0];

  const monatsAnfang = new Date();
  monatsAnfang.setUTCDate(1);
  monatsAnfang.setUTCHours(0, 0, 0, 0);
  const carryAt = row.kontingent_carry_at ? new Date(row.kontingent_carry_at) : null;
  if (carryAt && carryAt >= monatsAnfang) return;   /* schon gelaufen */

  /* v1184: KEIN Merker heisst NEUE Zeile, nicht "seit je nichts uebertragen".
     GEMESSEN am 31.08.2026: ein frisch angelegter Pro-Nutzer stand ohne
     einen einzigen Kauf auf mpi=5 mpi_plus=5 wev=5 in der Bank — sein
     volles Monatskontingent, zusaetzlich zum Monatskontingent selbst.
     Ursache war die fehlende Vorbelegung: `_ensureCurrentPeriod()` legt die
     Zeile mit `INSERT (user_id)` an, und Migration 066 hatte nur die damals
     bestehenden Zeilen gesetzt.

     Migration 067 gibt der Spalte einen DEFAULT. Dieser Riegel bleibt
     trotzdem: Produktion hat 067 noch nicht, und eine Zeile aus einer
     Wiederherstellung kann den Merker jederzeit wieder leer mitbringen.
     Also nur den Merker setzen und nichts uebertragen — wer diesen Monat
     erst angelegt wurde, hatte im Vormonat nichts uebrig. */
  if (!carryAt) {
    await query(
      "UPDATE ai_credits_user SET kontingent_carry_at = date_trunc('month', NOW())::date," +
      ' updated_at = NOW() WHERE user_id = $1', [userId]
    );
    return;
  }

  const setzt = [];
  const werte = [];
  ARTEN.forEach(function (art) {
    const limit = k[art] || 0;
    const used  = parseInt(row[art + '_used'], 10) || 0;
    const bank  = parseInt(row[art + '_bank'], 10) || 0;
    const rest  = Math.max(0, limit - used);
    const deckel = limit * (k.sparfaktor || 0);
    /* Nie ueber den Deckel — und nie unter den Bestand, den der Nutzer
       gekauft hat. Gekauftes ist kein Uebertrag und faellt nicht unter den
       Deckel; deshalb wird nur der ZUWACHS begrenzt, nicht die Bank. */
    const platz = Math.max(0, deckel - bank);
    const neu   = bank + Math.min(rest, platz);
    werte.push(neu);
    setzt.push(art + '_bank = $' + (werte.length + 1));
    werte.push(0);
    setzt.push(art + '_used = $' + (werte.length + 1));
  });

  await query(
    'UPDATE ai_credits_user SET ' + setzt.join(', ') +
    ", kontingent_carry_at = date_trunc('month', NOW())::date, updated_at = NOW()" +
    ' WHERE user_id = $1',
    [userId].concat(werte)
  );
}

/* v1183: liefert je Leistungsart Kontingent, Verbrauch, Sparguthaben und
   Rest — plus die beiden Marktwert-Bestaende. `unit` ist bewusst weg: es
   gibt keine Einheit mehr, es gibt Bewertungen. */
async function getStatus(userId) {
  await _ensureCurrentPeriod(userId);
  const plan = await _planKey(userId);
  await _carryOver(userId, plan);
  await _verfallTestphase(userId);      /* v1185 — vor jeder Auskunft */

  const r = await query(`
    SELECT current_period_start,
           mpi_used, mpi_plus_used, wev_used,
           mpi_bank, mpi_plus_bank, wev_bank,
           avm_a_bank, avm_b_bank,
           testphase_mpi, testphase_mpi_plus, testphase_wev, testphase_bis
      FROM ai_credits_user WHERE user_id = $1
  `, [userId]);
  const row = r.rows[0] || {};
  const k = KONTINGENT[plan] || KONTINGENT.free;

  const arten = {};
  ARTEN.forEach(function (art) {
    const limit = k[art] || 0;
    const used  = parseInt(row[art + '_used'], 10) || 0;
    const bank  = parseInt(row[art + '_bank'], 10) || 0;
    const test  = parseInt(row['testphase_' + art], 10) || 0;
    const ausMonat = Math.max(0, limit - used);
    arten[art] = {
      limit:     limit,
      used:      used,
      monatlich: ausMonat,          /* was dieser Monat noch hergibt */
      testphase: test,              /* v1185 — verfaellt mit der Testphase */
      bank:      bank,              /* angespart und gekauft, verfaellt nie */
      rest:      ausMonat + test + bank  /* was der Nutzer wirklich noch machen kann */
    };
  });

  // Reset-Datum: 1. des nächsten Monats
  const next = new Date();
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(1);
  next.setUTCHours(0, 0, 0, 0);

  /* v1185: `testphase` ist null, wenn nie eine lief — das Frontend soll
     „keine Testphase" von „Testphase abgelaufen" unterscheiden koennen. */
  let testphase = null;
  if (row.testphase_bis) {
    const bis = new Date(row.testphase_bis);
    const laeuft = bis.getTime() > Date.now();
    testphase = {
      bis:    row.testphase_bis,
      laeuft: laeuft,
      tage_rest: laeuft ? Math.max(0, Math.ceil((bis.getTime() - Date.now()) / 86400000)) : 0
    };
  }

  return {
    plan:            plan,
    arten:           arten,
    sparfaktor:      k.sparfaktor || 0,
    testphase:       testphase,      /* v1185 */
    avm:             {
      a: parseInt(row.avm_a_bank, 10) || 0,
      b: parseInt(row.avm_b_bank, 10) || 0
    },
    period_start:    row.current_period_start,
    period_reset_at: next.toISOString().slice(0, 10)
  };
}

/* ─── v1183 · Eine Bewertung abbuchen ───────────────────────────────────
   `art` ist 'mpi' | 'mpi_plus' | 'wev'.

   REIHENFOLGE: was zuerst verfaellt, wird zuerst verbraucht.
     1. Monatskontingent — laeuft zum Monatsende ab (bei bezahlten Plaenen
        wandert der Rest bis zum Deckel in die Bank, bei free verfaellt er)
     2. Testphase (v1185) — laeuft mit dem Testfenster ab und wandert NIE
        in die Bank
     3. Bank — angespart und gekauft, verfaellt nie

   Das ist durchgehend die fuer den Nutzer guenstigere Richtung: sein
   Bestaendigstes bleibt am laengsten liegen.

   Gibt { ok:false, reason:'kein_kontingent', art, status } zurueck, wenn
   nichts mehr da ist. Der Aufrufer muss das behandeln: ein verschlucktes
   Ergebnis heisst, die Leistung wird erbracht und nicht bezahlt. */
async function consumeArt(userId, art, endpoint, meta) {
  if (ARTEN.indexOf(art) < 0) {
    return { ok: false, reason: 'unbekannte_art', art: art };
  }
  await _ensureCurrentPeriod(userId);
  const status = await getStatus(userId);   /* raeumt auch die Testphase ab */
  const k = status.arten[art];

  if (!k || k.rest < 1) {
    return { ok: false, reason: 'kein_kontingent', art: art, status: status };
  }

  /* Genau EIN Topf wird belastet. `quelle` steht im Log, damit spaeter
     nachvollziehbar ist, was eine Bewertung gekostet hat — eine aus der
     Testphase hat niemand bezahlt. */
  let quelle;
  if (k.monatlich > 0) {
    quelle = 'monat';
    await query(
      'UPDATE ai_credits_user SET ' + art + '_used = ' + art + '_used + 1, updated_at = NOW() WHERE user_id = $1',
      [userId]
    );
  } else if (k.testphase > 0) {
    quelle = 'testphase';
    await query(
      'UPDATE ai_credits_user SET testphase_' + art + ' = GREATEST(0, testphase_' + art + ' - 1),' +
      ' updated_at = NOW() WHERE user_id = $1',
      [userId]
    );
  } else {
    quelle = 'bank';
    await query(
      'UPDATE ai_credits_user SET ' + art + '_bank = GREATEST(0, ' + art + '_bank - 1), updated_at = NOW() WHERE user_id = $1',
      [userId]
    );
  }
  /* Das Log bleibt in derselben Tabelle und behaelt seine Bedeutung:
     v1125 rechnet daraus die bezahlte Marktbericht-Stufe zurueck — und
     eine Bewertung aus der Testphase zaehlt dafuer mit, der Nutzer hat
     den Bericht ja bekommen. `cost` ist immer 1, die Art steht im meta. */
  const QUELLE_SOURCE = { monat: 'monthly', testphase: 'trial', bank: 'bonus' };
  await query(
    `INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1,$2,1,$3,$4)`,
    [userId, endpoint || 'unknown', QUELLE_SOURCE[quelle] || 'bonus',
     JSON.stringify(Object.assign({ art: art, quelle: quelle }, meta || {}))]
  );

  return { ok: true, art: art, source: quelle };
}

/* Marktbericht-Stufe 1/2/3 -> Art. Die einzige Uebersetzung im System. */
async function consumeStufe(userId, stufe, endpoint, meta) {
  const art = STUFE_ART[parseInt(stufe, 10)];
  if (!art) return { ok: false, reason: 'unbekannte_stufe', stufe: stufe };
  return consumeArt(userId, art, endpoint, Object.assign({ wert_stufe: parseInt(stufe, 10) }, meta || {}));
}

/* Marktwert-Abruf: eigener Bestand, keine Monatszuteilung. Wer keinen hat,
   kauft einen (5,90 € / 9,90 €). Sie hingen bis v1183 am Litertank und
   kosteten dort 40 bzw. 20 L — bei 5 Bewertungen im Monat waere ein
   einziger Abruf das Achtfache des Kontingents gewesen. */
async function consumeAvm(userId, seite, endpoint, meta) {
  const spalte = (seite === 'b') ? 'avm_b_bank' : 'avm_a_bank';
  await _ensureCurrentPeriod(userId);
  const r = await query('SELECT ' + spalte + ' AS bestand FROM ai_credits_user WHERE user_id = $1', [userId]);
  const bestand = r.rowCount ? (parseInt(r.rows[0].bestand, 10) || 0) : 0;
  if (bestand < 1) return { ok: false, reason: 'kein_abruf', seite: seite };

  await query(
    'UPDATE ai_credits_user SET ' + spalte + ' = GREATEST(0, ' + spalte + ' - 1), updated_at = NOW() WHERE user_id = $1',
    [userId]
  );
  await query(
    `INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1,$2,1,'bonus',$3)`,
    [userId, endpoint || 'avm', JSON.stringify(Object.assign({ avm: seite }, meta || {}))]
  );
  return { ok: true, seite: seite };
}

/* Kauf gutschreiben — Pakete wie Einzelposten. Erwartet ein Objekt der Form
   { mpi: 15, mpi_plus: 10, wev: 3, avm_a: 0, avm_b: 0 }.
   Gekauftes geht immer in die Bank und faellt NICHT unter den Sparfaktor-
   Deckel: der begrenzt den Uebertrag aus dem Abo, nicht das, wofuer
   jemand Geld gegeben hat. */
async function addKontingent(userId, paket, ref) {
  await _ensureCurrentPeriod(userId);
  const felder = [];
  const werte = [];
  ARTEN.concat(['avm_a', 'avm_b']).forEach(function (art) {
    const n = Math.max(0, parseInt(paket && paket[art], 10) || 0);
    if (!n) return;
    werte.push(n);
    felder.push(art + '_bank = ' + art + '_bank + $' + (werte.length + 1));
  });
  if (!felder.length) return { ok: false, reason: 'leeres_paket' };

  await query(
    'UPDATE ai_credits_user SET ' + felder.join(', ') + ', updated_at = NOW() WHERE user_id = $1',
    [userId].concat(werte)
  );
  await query(
    `INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1,'purchase',0,'bonus',$2)`,
    [userId, JSON.stringify({ ref: ref || null, paket: paket })]
  );
  return { ok: true };
}

// STILLGELEGT v1183 — alter Liter-Verbrauch. Siehe consumeArt().
async function consume(userId, cost, endpoint, meta) {
  /* Der Litertank ist weg. getStatus() liefert seit v1183 kein
     total_remaining / monthly_remaining / bonus_credits mehr — die alte
     Rechnung wuerde also mit undefined arbeiten und wegen
     `undefined < cost === false` JEDE Buchung durchwinken, ohne etwas
     abzuziehen. Genau so entsteht eine Leistung, die nie bezahlt wird.

     Deshalb hier ein hartes Nein statt einer stillen Null. Wer das sieht,
     hat einen Aufrufer uebersehen: er muss auf consumeArt()/consumeStufe()
     (Bewertungen) oder consumeAvm() (Marktwert-Abrufe) umgestellt werden —
     oder die Leistung ist eine der acht kleinen KI-Hilfen, die seit v1183
     im Plan enthalten sind und gar nichts mehr kosten. */
  try {
    console.warn('[v1183] consume() ist stillgelegt — Aufrufer nicht umgestellt:',
      endpoint || 'unbekannt', 'cost=' + cost);
  } catch (e) {}
  return { ok: false, reason: 'liter_stillgelegt', endpoint: endpoint || null };
}

/* ─── v1125-stufenpreis · Welche Marktbericht-Stufe ist fuer dieses Objekt
   schon bezahlt? ───────────────────────────────────────────────────────────
   Marcels Regel vom 2026-08-11: "man darf spaeter vertiefen und es kostet
   nur die Differenz."

   DIE ANTWORT KOMMT AUS DEM EIGENEN LOG, NIEMALS VOM CLIENT. Eine vom
   Browser mitgeschickte "ich habe schon Stufe 3 bezahlt" waere ein
   Freifahrtschein fuer jeden Bericht.

   Zwei Feinheiten, beide gemessen:
   - consume() teilt eine Buchung auf Monats- und Bonustank auf und schreibt
     dann ZWEI Zeilen fuer denselben Bericht. MAX() ist dagegen unempfindlich.
   - Alte Zeilen tragen kein wert_stufe (das kam erst mit v1125). Fuer sie
     wird die Stufe aus den gebuchten Kosten zurueckgerechnet, damit
     bestehende Objekte nicht doppelt zahlen. Die Aufteilung auf zwei Toepfe
     macht die Einzelzeile allerdings kleiner als den Gesamtpreis — deshalb
     wird je Bericht (endpoint+ts-Sekunde) SUMMIERT, bevor zurueckgerechnet
     wird. */
/* Nur plausible Kennzeichen zaehlen. GEMESSEN im Log: 39 Buchungen liegen
   unter einem Kennzeichen, das der QUELLTEXT einer JavaScript-Funktion ist
   (`function _currentObjectId(){ … }`) — der Fehler aus der Zeit vor v941,
   als window._currentObjectId die Funktion selbst war und eine Funktion
   truthy ist. Behoben ist er, die Altzeilen bleiben (09.06.–15.07.2026).
   Ohne diesen Riegel waeren alle Objekte, die je diesen Weg genommen
   haben, EIN Objekt — und ab dem zweiten Bericht kostenlos. */
function _refTaugt(ref) {
  if (typeof ref !== 'string') return false;
  var s = ref.trim();
  if (!s || s.length > 64) return false;
  if (/\s/.test(s)) return false;            /* kein Fliesstext, kein Quelltext */
  return /^[A-Za-z0-9._:-]+$/.test(s);
}

async function bezahlteStufeMarktbericht(userId, externalRef) {
  if (!_refTaugt(externalRef)) return 0;
  try {
    const r = await query(
      `WITH je_bericht AS (
         SELECT COALESCE(MAX((meta->>'wert_stufe')::int), 0) AS stufe,
                SUM(cost) AS summe
           FROM ai_credits_log
          WHERE user_id = $1
            AND endpoint LIKE 'marktbericht:%'
            AND meta->>'external_ref' = $2
            AND cost > 0
          GROUP BY date_trunc('second', used_at), endpoint
       )
       SELECT COALESCE(MAX(GREATEST(
                stufe,
                CASE WHEN summe >= 12 THEN 3
                     WHEN summe >= 5  THEN 2
                     WHEN summe >= 2  THEN 1
                     ELSE 0 END)), 0) AS stufe
         FROM je_bericht`,
      [userId, String(externalRef)]
    );
    const s = r && r.rows && r.rows[0] ? parseInt(r.rows[0].stufe, 10) : 0;
    return (s >= 1 && s <= 3) ? s : 0;
  } catch (e) {
    /* Im Zweifel NICHTS gutschreiben: lieber einmal zu viel verlangt als
       ein Bericht umsonst. Der Fehler wird gemeldet, nicht verschluckt. */
    try { console.warn('[v1125] bezahlteStufeMarktbericht:', e.message); } catch (x) {}
    return 0;
  }
}

// Admin / Stripe-Webhook-Hook: Bonus-Credits gutschreiben (Kauf)
async function addBonus(userId, amount, ref) {
  amount = Math.max(0, parseInt(amount, 10) || 0);
  if (amount === 0) return { ok: false, reason: 'zero_amount' };
  await _ensureCurrentPeriod(userId);
  await query(`UPDATE ai_credits_user SET bonus_credits = bonus_credits + $1, updated_at = NOW() WHERE user_id = $2`, [amount, userId]);
  // Log-Eintrag mit negativem cost um Käufe vom Verbrauch zu unterscheiden
  await query(`INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1,'purchase',$2,'bonus',$3)`,
    [userId, -amount, JSON.stringify({ ref: ref || null })]);
  return { ok: true };
}

// V63.91: Reines Logging ohne Credit-Verbrauch (z.B. PDF-Extraktion)
async function logExtract(userId, endpoint) {
  try {
    await query(`INSERT INTO ai_credits_log (user_id, endpoint, cost, source, meta) VALUES ($1,$2,0,'free',NULL)`,
      [userId, endpoint || 'extract']);
  } catch (e) { /* nicht kritisch */ }
  return { ok: true };
}

/* v596-copilot-monthly */
async function copilotUsage(userId) {
  const uid = String(userId);
  await query(`INSERT INTO copilot_usage (user_id) VALUES ($1::text) ON CONFLICT (user_id) DO NOTHING`, [uid]);
  await query(`UPDATE copilot_usage SET used = 0, period_start = date_trunc('month', NOW())::date, updated_at = NOW() WHERE user_id = $1::text AND period_start < date_trunc('month', NOW())::date`, [uid]);
  const { rows } = await query(`SELECT used FROM copilot_usage WHERE user_id = $1::text`, [uid]);
  return rows && rows[0] ? rows[0].used : 0;
}
async function copilotInc(userId) {
  await query(`UPDATE copilot_usage SET used = used + 1, updated_at = NOW() WHERE user_id = $1::text`, [String(userId)]);
}

module.exports = {
  getStatus,
  copilotUsage,
  copilotInc,
  consumeArt,                  /* v1183 — eine Bewertung je Art */
  consumeStufe,                /* v1183 — Marktbericht-Stufe 1/2/3 */
  consumeAvm,                  /* v1183 — Marktwert-Abruf */
  addKontingent,               /* v1183 — Kauf gutschreiben */
  gewaehreTestpaket,           /* v1185 — Testphase, einmalig, verfaellt */
  TESTPAKET,                   /* v1185 — muss zu config.js passen */
  TESTPHASE_TAGE,              /* v1185 */
  KONTINGENT,                  /* v1183 — muss zu config.js passen */
  ARTEN,
  STUFE_ART,
  consume,                     /* STILLGELEGT v1183, antwortet mit Nein */
  addBonus,                    /* STILLGELEGT v1183, siehe addKontingent */
  logExtract,
  bezahlteStufeMarktbericht,   /* v1125-stufenpreis */
  PLAN_LIMITS                  /* STILLGELEGT v1183 */
};
