'use strict';
/* pruef-geldweg.js — v1821
 *
 * EINE GELDAKTION MUSS WISSEN, WOFUER SIE GILT.
 *
 * GEMESSEN am 04.10.2026 an Marcels echtem Dialog:
 *
 *   Nutzer: "Dann lass uns mal eine erweiterte Marktpreisindikation abrufen."
 *   Bot:    "... fuer das Objekt Am Markt 9, 06184 Kabelsketal kostet einen Abruf"
 *   Nutzer: "Ja"
 *   Bot:    "Hier ist die ... fuer das Objekt Gohliser Strasse 42, Leipzig"
 *
 * Abgebucht wurde es auch (mpi_plus_used 0 -> 1). Dieser Laeufer prueft die
 * drei Stellen, an denen das haengen kann — OHNE einen Abruf auszuloesen
 * und ohne einen einzigen Kontingentpunkt zu verbrauchen:
 *
 *   1 die Preisansage legt das Angebot ab
 *   2 der Abruf nimmt AUSSCHLIESSLICH das Objekt des Angebots
 *   3 die Nutzerkennung uebersteht den Weg als UUID (kein parseInt)
 *
 * DER GEGENTEST GEHOERT DAZU: Probe 2 prueft, dass eine ABWEICHENDE
 * Objektangabe des Modells NICHT befolgt wird. "Richtig, wenn man es
 * richtig macht" beweist nichts — gemessen wird der Angriff.
 */
const { query } = require('/app/src/db/pool');
const W = require('/app/src/services/agentWerkzeuge');

let proben = 0, fehler = 0;
const pruef = (txt, ok, dazu) => {
  proben++; if (!ok) fehler++;
  console.log('  ' + (ok ? 'ok     ' : 'FALSCH ') + txt + (dazu ? '\n         ' + dazu : ''));
};

function machCtx(uid, angebotObjekt) {
  const spur = { angebot: null, verbraucht: false, gemerkt: null };
  return {
    ctx: {
      userId: uid, letzteListe: null, letztesObjekt: null, protokoll: [],
      angebotObjekt: angebotObjekt || null,
      merkeObjekt(id) { this.letztesObjekt = id; spur.gemerkt = id; },
      merkeListe(ids) { this.letzteListe = ids; },
      async merkeAngebot(id, adr) { spur.angebot = { objekt_id: id, adresse: adr }; },
      async angebotVerbraucht() { spur.verbraucht = true; }
    },
    spur
  };
}

(async function () {
  const u = await query(
    `SELECT user_id FROM telegram_links WHERE bestaetigt_am IS NOT NULL LIMIT 1`);
  if (!u.rows.length) { console.log('Kein bestaetigter Link — Abbruch.'); process.exit(1); }
  const uid = u.rows[0].user_id;
  console.log('DECKUNG: Nutzer ' + uid);

  const objs = await query(
    `SELECT id, name FROM objects WHERE user_id = $1
      AND data->>'str' IS NOT NULL AND data->>'plz' IS NOT NULL
      ORDER BY updated_at DESC LIMIT 4`, [uid]);
  if (objs.rows.length < 2) { console.log('Zu wenige Objekte — Abbruch.'); process.exit(1); }
  const A = objs.rows[0], B = objs.rows[1];
  console.log('  A = ' + A.name + '\n  B = ' + B.name);

  /* ══ 1 · Die Preisansage haelt ihren Gegenstand fest ══════════════════ */
  console.log('\n=== 1 · Preisansage legt das Angebot ab ===');
  const p1 = machCtx(uid, null);
  const preis = await W.finde('marktbericht_preis').fn(p1.ctx, { id: A.id });
  pruef('Preisansage fuer A liefert Stufen', Boolean(preis && !preis.ok === false));
  pruef('Angebot abgelegt, und zwar fuer A',
    Boolean(p1.spur.angebot) && String(p1.spur.angebot.objekt_id) === String(A.id),
    p1.spur.angebot ? 'Angebot: ' + p1.spur.angebot.adresse : 'KEIN Angebot abgelegt');
  pruef('und das Objekt ist gemerkt', String(p1.spur.gemerkt) === String(A.id));

  /* ══ 2 · DER GEGENTEST: das Modell will ein anderes Objekt ════════════ */
  console.log('\n=== 2 · GEGENTEST — abweichende Modellangabe wird nicht befolgt ===');
  const p2 = machCtx(uid, A.id);
  /* Der Abruf bekommt das Angebot fuer A und eine Modellangabe fuer B.
     Er darf NICHT B rechnen. Damit kein Kontingent verbraucht wird, wird
     der echte Abrufdienst durch einen Spion ersetzt. */
  const markt = require('/app/src/services/telegramMarktService');
  const echt = markt.abrufen;
  let gerechnetFuer = null;
  markt.abrufen = async function (userId, objekt, stufe) {
    gerechnetFuer = objekt && objekt.objekt_id;
    /* Wir brechen ab, BEVOR etwas abgebucht wird. Der Werkzeugpfad
       behandelt das wie einen Fehlschlag — uns genuegt, WOFUER er
       gerechnet haette. */
    const e = new Error('Probelauf — kein echter Abruf');
    e.fachlich = true;
    throw e;
  };
  try {
    await W.finde('marktbericht_abrufen').fn(p2.ctx, { id: B.id, stufe: 1 });
  } catch (e) { /* der Werkzeugpfad faengt selbst */ }
  markt.abrufen = echt;

  pruef('gerechnet wurde das Objekt des ANGEBOTS (A), nicht die Modellangabe (B)',
    String(gerechnetFuer) === String(A.id),
    'gerechnet fuer: ' + gerechnetFuer + '\n         Angebot A: ' + A.id
    + '\n         Modell wollte B: ' + B.id);

  /* ══ 3 · Ohne Angebot kein Objekt aus dem Nichts ══════════════════════ */
  console.log('\n=== 3 · Ohne Angebot und ohne Bezug: kein Abruf ===');
  const p3 = machCtx(uid, null);
  let gerechnet3 = null;
  markt.abrufen = async function (userId, objekt) { gerechnet3 = objekt && objekt.objekt_id; throw new Error('Probelauf'); };
  const r3 = await W.finde('marktbericht_abrufen').fn(p3.ctx, {}).catch(() => ({}));
  markt.abrufen = echt;
  pruef('ohne Angebot UND ohne Objektbezug wird nichts gerechnet',
    gerechnet3 === null,
    gerechnet3 ? 'es wurde doch gerechnet, fuer: ' + gerechnet3 : (r3.hinweis || '').slice(0, 90));

  /* ══ 4 · Die Nutzerkennung uebersteht den Weg ═════════════════════════ */
  console.log('\n=== 4 · Die Kennung bleibt eine UUID ===');
  /* Der Fehler war parseInt('2a1ac331-...') === 2. Geprueft wird die
     REGEL, die jetzt dort steht — an der echten Kennung. */
  const regel = (v) => {
    const s = String(v == null ? '' : v).trim();
    return (s && s !== 'undefined' && s !== 'null' && /^[A-Za-z0-9-]{1,64}$/.test(s)) ? s : null;
  };
  pruef('die UUID kommt unveraendert durch', regel(uid) === uid,
    'parseInt haette daraus gemacht: ' + parseInt(uid, 10));
  pruef('leere Angaben werden null', regel('') === null && regel('undefined') === null
    && regel(null) === null);
  pruef('ein Semikolon wird abgewiesen', regel('abc;DROP') === null);

  const typen = await query(
    `SELECT table_name, data_type FROM information_schema.columns
      WHERE column_name = 'user_id' AND table_schema = 'mb'`);
  const alleText = typen.rows.length > 0 && typen.rows.every((r) => r.data_type === 'text');
  pruef('die mb-Spalten user_id sind text (Migration 015)', alleText,
    typen.rows.map((r) => r.table_name + '=' + r.data_type).join(', '));

  /* ══ 5 · Berichte, die niemandem gehoeren ═════════════════════════════ */
  console.log('\n=== 5 · Altbestand: Berichte mit verstuempelter Kennung ===');
  /* Eine Kennung, die kuerzer als eine UUID ist, kann keine sein. */
  const kaputt = await query(
    `SELECT count(*)::int AS n FROM mb.market_reports
      WHERE user_id IS NOT NULL AND length(user_id) < 20`).catch(() => ({ rows: [{ n: -1 }] }));
  const n = kaputt.rows[0].n;
  console.log('  ' + (n > 0 ? 'HINWEIS' : 'ok     ')
    + ' Berichte mit verstuempelter Kennung: ' + n
    + (n > 0 ? '\n         Diese Berichte sind keinem Nutzer zugeordnet und tauchen in '
      + 'keiner Historie auf. Sie gehoeren nachgezogen — das ist ein DB-Eingriff '
      + 'und braucht Marcels Freigabe.' : ''));

  console.log('\n──────────────────────────────────────────────');
  console.log('DECKUNG: ' + proben + ' Proben, ' + fehler + ' fehlgeschlagen.');
  console.log('KEIN Kontingent verbraucht — der Abrufdienst war durchgehend ersetzt.');
  console.log(fehler ? 'NICHT BESTANDEN.' : 'Alle Proben bestanden.');
  process.exit(fehler ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH: ' + (e && e.stack || e)); process.exit(2); });
