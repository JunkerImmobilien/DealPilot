'use strict';
/* ══════════════════════════════════════════════════════════════════════
   v1372 (B20) · TESTS FÜR DAS SCHUTZSYSTEM

   Marcels Punkt B20: „Tests: Normalnutzung, jede Eskalationsstufe,
   Adminausnahme, Entsperrung, Audit-Log, Fehlalarm."

   Alle sechs sind hier abgedeckt. Der wichtigste ist der letzte.

   ────────────────────────────────────────────────────────────────────
   WARUM DER FEHLALARM-TEST DER WICHTIGSTE IST

   Ein Schutzsystem, das zu viel greift, wird abgeschaltet — und dann
   schützt es gar nicht mehr. Der Test „fleißiger Nutzer bleibt
   unauffällig" ist deshalb kein Nebenschauplatz, sondern die eigentliche
   Zusage: 60 Überschreitungen über zwölf Endpunktgruppen in
   unregelmäßigen Abständen dürfen NICHT als hohes Risiko gelten, obwohl
   die Menge weit über der Schwelle liegt.

   Genau das ist B18, und genau daran scheitern Systeme, die nur zählen.

   ────────────────────────────────────────────────────────────────────
   WAS DIESE TESTS NICHT TUN

   Sie starten keinen Server und rufen keine HTTP-Endpunkte auf. Sie
   prüfen die Logik gegen eine echte Datenbank — das ist die Schicht, in
   der die Entscheidungen fallen. Die Routen darüber sind dünn; was sie
   tun, ist an ihren Aufrufen ablesbar.

   AUSFÜHRUNG: im Container, wo die Datenbank erreichbar ist.
     docker exec dealpilot-backend node --test src/../tests/

   Die Testdaten tragen eine eigene Kennung und werden am Ende entfernt.
   Sie laufen NICHT gegen Produktion — die Verbindung kommt aus der
   Umgebung des Containers, in dem sie gestartet werden.
   ══════════════════════════════════════════════════════════════════════ */
const { test, before, after } = require('node:test');
const assert = require('node:assert');

const sec = require('../src/services/securityEventService');
const { query } = require('../src/db/pool');

/* Ein eigenes Konto, damit kein echtes verfälscht wird. */
const TEST_MAIL = 'test-b20-' + Date.now() + '@dealpilot.invalid';
let TEST_ID = null;

before(async () => {
  const r = await query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, 'x', 'B20 Test', 'user') RETURNING id`, [TEST_MAIL]);
  TEST_ID = r.rows[0].id;
});

after(async () => {
  if (!TEST_ID) return;
  await query('DELETE FROM security_events WHERE user_id = $1', [TEST_ID]);
  await query('DELETE FROM users WHERE id = $1', [TEST_ID]);
});

/* Hilfe: n Ereignisse schreiben, mit wählbarer Vielfalt und Gleichmäßigkeit. */
async function ereignisse(n, { pfade, gleichmaessig }) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    const pfad = pfade[i % pfade.length];
    /* Die Abstände macht der Zeitstempel, nicht echtes Warten - sonst
       liefe der Test minutenlang. */
    const versatz = gleichmaessig
      ? i * 1000
      : Math.round(i * 1000 * (1 + Math.sin(i) * 4 + (i % 7) * 3));
    rows.push(query(
      `INSERT INTO security_events (user_id, art, stufe, pfad, methode, detail, created_at)
       VALUES ($1, 'rate_limit', 'hinweis', $2, 'GET', '{}'::jsonb, NOW() - ($3 || ' milliseconds')::interval)`,
      [TEST_ID, pfad, String(600000 - versatz)]
    ));
  }
  await Promise.all(rows);
}

async function leeren() {
  await query('DELETE FROM security_events WHERE user_id = $1', [TEST_ID]);
}

/* ────────────────────────────────────────────────────────────────────
   1 · NORMALNUTZUNG
   ──────────────────────────────────────────────────────────────────── */
test('Normalnutzung bleibt NORMAL', async () => {
  await leeren();
  await ereignisse(3, {
    pfade: ['/api/v1/objects', '/api/v1/plans', '/api/v1/passes'],
    gleichmaessig: false
  });
  const s = await sec.stufeBerechnen(TEST_ID);
  assert.strictEqual(s.stufe, 'normal',
    'drei Ereignisse liegen unter jeder Schwelle');
});

/* ────────────────────────────────────────────────────────────────────
   2 · DIE ESKALATIONSSTUFEN
   ──────────────────────────────────────────────────────────────────── */
test('AUFFÄLLIG ab der fünften Überschreitung', async () => {
  await leeren();
  await ereignisse(6, { pfade: ['/api/v1/objects'], gleichmaessig: true });
  const s = await sec.stufeBerechnen(TEST_ID);
  assert.strictEqual(s.stufe, 'auffaellig');
  assert.ok(s.grund.ueberschreitungen >= 5, 'die Begründung nennt die Menge');
});

test('WARNUNG nur bei Menge UND Muster', async () => {
  await leeren();
  /* 25 Ereignisse, ein Pfad, gleichmäßig - das ist ein Skript-Muster */
  await ereignisse(25, { pfade: ['/api/v1/objects'], gleichmaessig: true });
  const s = await sec.stufeBerechnen(TEST_ID);
  assert.ok(s.stufe === 'warnung' || s.stufe === 'hohes_risiko',
    'Menge und Muster zusammen ergeben mindestens WARNUNG, war: ' + s.stufe);
});

test('HOHES RISIKO bei sehr vielen, sehr gleichförmigen Zugriffen', async () => {
  await leeren();
  await ereignisse(55, { pfade: ['/api/v1/objects'], gleichmaessig: true });
  const s = await sec.stufeBerechnen(TEST_ID);
  assert.strictEqual(s.stufe, 'hohes_risiko');
});

/* ────────────────────────────────────────────────────────────────────
   3 · DER FEHLALARM — der wichtigste Test
   ──────────────────────────────────────────────────────────────────── */
test('FEHLALARMSCHUTZ: viel Verkehr über viele Endpunkte bleibt harmlos', async () => {
  await leeren();
  /* 60 Ereignisse - weit über der höchsten Schwelle. Aber über zwölf
     Endpunktgruppen und in unregelmäßigen Abständen: so arbeitet ein
     Mensch mit großem Portfolio. */
  await ereignisse(60, {
    pfade: ['/api/v1/objects', '/api/v1/plans', '/api/v1/passes', '/api/v1/subscription',
            '/api/v1/ai/status', '/api/v1/tax-records/x', '/api/v1/market-rates/a',
            '/api/v1/marktbericht/b', '/api/v1/avm/health', '/api/v1/tax-periods',
            '/api/v1/network', '/api/v1/credits'],
    gleichmaessig: false
  });
  const s = await sec.stufeBerechnen(TEST_ID);

  assert.notStrictEqual(s.stufe, 'hohes_risiko',
    'ein fleißiger Nutzer darf NICHT als hohes Risiko gelten - das ist B18');
  assert.ok(s.grund.vielfalt >= 10,
    'die Vielfalt muss erkannt werden, war: ' + s.grund.vielfalt);
});

test('Zu wenig Daten rechtfertigen keine höhere Stufe', async () => {
  await leeren();
  /* Vier Ereignisse: die Streuung bleibt null ("weiß ich nicht"). */
  await ereignisse(4, { pfade: ['/api/v1/objects'], gleichmaessig: true });
  const m = await sec.muster(TEST_ID);
  assert.strictEqual(m.streuung, null,
    'unter fünf Ereignissen ist ein Variationskoeffizient Rauschen');
});

/* ────────────────────────────────────────────────────────────────────
   4 · ENTSCHEIDUNG UND ENTSPERRUNG
   ──────────────────────────────────────────────────────────────────── */
test('Eine Entscheidung schlägt die Berechnung', async () => {
  await leeren();
  await ereignisse(6, { pfade: ['/api/v1/objects'], gleichmaessig: true });

  await sec.entscheiden({
    userId: TEST_ID, art: sec.ARTEN.EINGESCHRAENKT,
    adminEmail: 'test@b20', notiz: 'Test der Einschränkung'
  });

  const z = await sec.zustand(TEST_ID);
  assert.strictEqual(z.geltend, 'eingeschraenkt');
  assert.strictEqual(z.durch, 'entscheidung');
  assert.ok(z.berechnet && z.berechnet.stufe,
    'der berechnete Stand bleibt daneben sichtbar');
});

test('Entsperrung gibt wieder den berechneten Stand frei', async () => {
  await sec.entscheiden({
    userId: TEST_ID, art: sec.ARTEN.FREIGEGEBEN,
    adminEmail: 'test@b20', notiz: 'Test der Entsperrung'
  });
  const z = await sec.zustand(TEST_ID);
  assert.strictEqual(z.durch, 'freigabe');
  assert.notStrictEqual(z.geltend, 'eingeschraenkt',
    'nach der Freigabe gilt wieder, was gerechnet wurde');
});

test('Eine Entscheidung ohne Begründung wird abgelehnt', async () => {
  await assert.rejects(
    () => sec.entscheiden({ userId: TEST_ID, art: sec.ARTEN.GESPERRT,
                            adminEmail: 'test@b20', notiz: '' }),
    /Begruendung/,
    'wer sperrt, soll sagen warum - und zwar bevor er es tut'
  );
});

/* ────────────────────────────────────────────────────────────────────
   5 · DAS PROTOKOLL IST APPEND-ONLY
   ──────────────────────────────────────────────────────────────────── */
test('Das Audit-Log hält jede Entscheidung fest', async () => {
  const c = await sec.chronik(TEST_ID, { limit: 100 });
  const entscheidungen = c.filter((e) =>
    ['eingeschraenkt', 'gesperrt', 'freigegeben'].indexOf(e.art) >= 0);
  assert.ok(entscheidungen.length >= 2,
    'Einschränkung und Freigabe stehen beide in der Chronik');

  /* Die Begründung bleibt erhalten - sie ist der Teil, der später zählt. */
  assert.ok(entscheidungen.every((e) => e.detail && e.detail.notiz),
    'jede Entscheidung trägt ihre Begründung');
});

test('security_events hat keine Spalte zum Ändern', async () => {
  const r = await query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'security_events' AND column_name IN ('updated_at','geaendert_am')`);
  assert.strictEqual(r.rowCount, 0,
    'append-only heißt: es gibt nichts zu aktualisieren');
});

/* ────────────────────────────────────────────────────────────────────
   6 · DIE ADMINAUSNAHME
   ──────────────────────────────────────────────────────────────────── */
test('Eine Ausnahme befreit vom Limit, nicht vom Protokoll', async () => {
  await query('UPDATE users SET security_exempt = TRUE, security_exempt_grund = $2 WHERE id = $1',
              [TEST_ID, 'B20-Test']);

  const r = await query('SELECT security_exempt, security_exempt_grund FROM users WHERE id = $1',
                        [TEST_ID]);
  assert.strictEqual(r.rows[0].security_exempt, true);
  assert.ok(r.rows[0].security_exempt_grund, 'eine Ausnahme ohne Begründung gibt es nicht');

  /* Entscheidend: die Ereignisse werden trotzdem geschrieben. */
  const vorher = (await sec.chronik(TEST_ID, { limit: 500 })).length;
  await sec.schreibe({ userId: TEST_ID, art: sec.ARTEN.RATE_LIMIT, stufe: 'hinweis',
                       pfad: '/api/v1/objects', methode: 'GET', detail: { ausnahme: true } });
  const nachher = (await sec.chronik(TEST_ID, { limit: 500 })).length;

  assert.strictEqual(nachher, vorher + 1,
    'befreit vom Limit heißt NICHT befreit vom Protokoll');
});

/* ────────────────────────────────────────────────────────────────────
   7 · DIE KONFIGURATION
   ──────────────────────────────────────────────────────────────────── */
test('Die Schwellen kommen aus der Datenbank und bauen aufeinander auf', async () => {
  const cfg = await sec.konfiguration();
  assert.ok(cfg.schwellen.length === 3);

  const [hoch, warnung, auffaellig] = cfg.schwellen;
  assert.ok(auffaellig.ueberschreitungen <= warnung.ueberschreitungen);
  assert.ok(warnung.ueberschreitungen <= hoch.ueberschreitungen);
  assert.ok(hoch.maxVielfalt <= warnung.maxVielfalt,
    'nach oben werden die Muster-Grenzen strenger, nicht lockerer');
});

test('Eine verdrehte Reihenfolge wird von der Datenbank abgelehnt', async () => {
  await assert.rejects(
    () => query('UPDATE security_config SET warnung_ab = 999 WHERE id = 1'),
    /reihenfolge/i,
    'sonst stünde WARNUNG über HOHES RISIKO und die höchste Stufe wäre unerreichbar'
  );
});
