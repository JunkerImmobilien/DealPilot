'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { testConnection, pool } = require('./db/pool');
const { errorHandler, notFoundHandler } = require('./middleware/errors');

const authRoutes = require('./routes/auth');
const registerWithVerifyRoutes = require('./routes/registerWithVerify');
const objectRoutes = require('./routes/objects');
const userRoutes = require('./routes/users');
const healthRoutes = require('./routes/health');
const planRoutes = require('./routes/plans');
const subscriptionRoutes = require('./routes/subscription');
const taxRecordsRoutes = require('./routes/taxRecords');
const stripeWebhookRoutes = require('./routes/stripeWebhook');
const aiRoutes = require('./routes/ai');
const marketRatesRoutes = require('./routes/marketRates');
const betaSignupRoutes = require('./routes/betaSignup');
const dealActionRoutes = require('./routes/dealAction');
const feedbackRoutes = require('./routes/feedback');
const scrapeRoutes = require('./routes/scrape');
const rndRequestRoutes = require('./routes/rndRequest');  // V186: RND-Anfrage-Endpoint
const adminRoutes = require('./routes/admin');  // V194: Admin-Dashboard
const creditsRoutes = require('./routes/credits');  // V197: KI-Credit-Käufe
const resellerRoutes = require('./routes/reseller');  // V200: Reseller-Anfragen
const avmRoutes = require('./routes/avm');  // V326: AVM-Integration
const marktberichtRoutes = require('./routes/marktbericht');  // v539: Marktbericht-Proxy
const passesRoutes = require('./routes/passes');  // qb-shared-pass
const networkRoutes = require('./routes/network');  // v852-network

const app = express();

// ── Trust proxy (for correct req.ip behind reverse proxies) ──
app.set('trust proxy', 1);

// ── Security headers ───────────────────────────────
app.use(helmet({
  // Allow CORS to work properly
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ── CORS ───────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Allow no-origin (e.g., mobile apps, curl) and configured origins
    if (!origin || config.cors.origins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS: origin not allowed: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Stripe Webhook (MUST be before express.json() - needs raw body) ──
app.use('/api/v1/webhooks/stripe', stripeWebhookRoutes);

// ── Body parsing ────────────────────────────────────
// Big limit because photos are stored as base64 inside data
app.use(express.json({ limit: '50mb' }));

// ── Rate limiting (skip health checks) ──────────────
/* ══════════════════════════════════════════════════════════════════════
   v1366 · DAS LIMIT HAENGT AM KONTO, NICHT AN DER LEITUNG
   ══════════════════════════════════════════════════════════════════════
   B3 aus Marcels Schutz-Lastenheft verlangt Anomalie-Erkennung JE
   ACCOUNT. Bis hierher zaehlte express-rate-limit nach IP - mit zwei
   Folgen, beide am 13.09.2026 gemessen:

   1. ZU ENG FUER ECHTE ARBEIT. Ein Seitenstart samt drei geoeffneten
      Objekten erzeugt 57 API-Anfragen in 24 Sekunden. Das Limit stand
      bei 100 pro Minute (printenv im Container - NICHT die 200/900 s aus
      config.js, die dort als Default stehen).

   2. MEHRERE MITARBEITER TEILEN SICH EINEN ZAEHLER. Hinter einem
      Firmenanschluss laufen alle ueber dieselbe IP. Zwei Kollegen
      gleichzeitig, und einer bekommt 429 - ohne etwas falsch gemacht zu
      haben.

   Beides loest derselbe Griff: wer eingeloggt ist, wird unter seiner
   Nutzerkennung gezaehlt und bekommt ein deutlich groesseres Kontingent.
   Wer nicht eingeloggt ist, bleibt bei der IP und beim engen Limit -
   dort ist Vorsicht richtig.

   DER SCHLUESSEL WIRD NICHT VERIFIZIERT, NUR GELESEN. Die Zaehlung
   laeuft vor jeder Route, also vor `authenticate`. Ein gefaelschter
   Token traefe damit einen fremden Zaehler-Eimer - schaden kann er
   nicht, denn die Route selbst prueft ihn weiterhin richtig und lehnt
   ihn ab. Wer mit fremder Kennung zaehlt, verbraucht nur Anfragen, die
   er ohnehin nicht beantwortet bekommt.

   HIER STAND EIN TOTER SCHALTER. Das Objekt trug `skip` ZWEIMAL:

     skip: function (req) { ...Authorization vorhanden -> nicht limitieren... }
     standardHeaders: true,
     legacyHeaders: false,
     skip: (req) => req.path.startsWith('/health')

   In JavaScript gewinnt die zweite Eigenschaft. Die Ausnahme aus v395
   (Commit 94e4f6f, 01.06.2026) war damit seit ueber drei Monaten
   wirkungslos - die Datei sagte das Gegenteil von dem, was sie tat. Fuer
   den Schutz war der Zufallszustand der bessere; jetzt steht es
   ausdruecklich da.
   ══════════════════════════════════════════════════════════════════════ */
const jwtUtil = require('./utils/jwt');
const securityEvents = require('./services/securityEventService');

/* Wie oft ist dieser Schluessel in der letzten Stunde angelaufen? Nur im
   Arbeitsspeicher - beim Neustart faengt die Zaehlung von vorn an, und das
   ist richtig so: die dauerhafte Wahrheit steht in security_events, hier
   liegt nur, was fuer die Einstufung des naechsten Ereignisses gebraucht
   wird. Ein Eintrag je Konto, aufgeraeumt sobald er eine Stunde alt ist. */
const _limitGedaechtnis = new Map();
setInterval(() => {
  const grenze = Date.now() - 60 * 60 * 1000;
  for (const [k, v] of _limitGedaechtnis) {
    if (v.seit < grenze) _limitGedaechtnis.delete(k);
  }
}, 15 * 60 * 1000).unref();


/* Wer ist das? Gibt die Nutzerkennung zurueck oder null. */
function _kontoAusToken(req) {
  try {
    const h = req.headers && req.headers.authorization;
    if (!h) return null;
    const m = /^Bearer\s+(.+)$/i.exec(h);
    if (!m) return null;
    const p = jwtUtil.verify(m[1]);
    return (p && p.userId) ? String(p.userId) : null;
  } catch (e) {
    /* abgelaufen oder gefaelscht - dann zaehlt die IP, und die Route
       lehnt die Anfrage ohnehin ab. */
    return null;
  }
}

/* Bei IPv6 bekommt ein einzelner Anschluss ein ganzes /64-Netz - wer
   darin die Adresse wechselt, haette sonst jedes Mal einen frischen
   Zaehler. Deshalb wird auf die ersten vier Bloecke gekuerzt. IPv4
   bleibt, wie es ist. */
function _ipSchluessel(ip) {
  const roh = String(ip || 'unbekannt');
  if (roh.indexOf(':') < 0) return roh;              /* IPv4 */
  const ohneV4 = roh.replace(/^::ffff:/i, '');
  if (ohneV4.indexOf(':') < 0) return ohneV4;        /* IPv4 in IPv6-Schreibweise */
  return ohneV4.split(':').slice(0, 4).join(':') + '::/64';
}

const LIMIT_KONTO = parseInt(process.env.RATE_LIMIT_MAX_ACCOUNT || '600', 10);

/* ══════════════════════════════════════════════════════════════════════
   v1371 (B11) · AUSNAHMEN — befreit vom Limit, NICHT vom Protokoll

   Marcels Auflage: „Administratoren, Entwickler und ausdruecklich
   freigeschaltete Testkonten muessen weiterarbeiten koennen ... Ausnahmen
   muessen rollenbasiert umgesetzt und trotzdem protokolliert werden."

   Der zweite Halbsatz ist der wichtige. Eine Ausnahme ohne Protokoll
   waere ein blinder Fleck: genau die Konten mit den weitesten Rechten
   waeren die, ueber die niemand etwas weiss. Hier wird deshalb nur der
   BREMSKLOTZ entfernt, nicht die Beobachtung.

   WARUM EIN CACHE: die Ausnahme steht in der Datenbank, der Limiter
   laeuft vor JEDER Anfrage. Eine Abfrage je Anfrage waere genau die
   Sorte Kosten, die das Schutzsystem vermeiden soll. Fuenf Minuten
   Gueltigkeit sind ein vertretbarer Kompromiss - wer eine Ausnahme
   setzt, wartet hoechstens fuenf Minuten auf ihre Wirkung.
   ══════════════════════════════════════════════════════════════════════ */
const _ausnahmen = new Map();      /* userId -> { frei: bool, bis: ms } */
const AUSNAHME_TTL = 5 * 60 * 1000;

function _ausnahmeBekannt(konto) {
  const e = _ausnahmen.get(konto);
  return (e && e.bis > Date.now()) ? e.frei : null;
}

async function _ausnahmeLaden(konto) {
  try {
    const r = await require('./db/pool').query(
      'SELECT security_exempt, role FROM users WHERE id = $1', [konto]);
    /* Rollen, die von Haus aus befreit sind - sie muessen arbeiten
       koennen, auch wenn gerade jemand das Limit ausreizt. */
    const rolle = r.rows[0] && r.rows[0].role;
    const frei = !!(r.rows[0] && (r.rows[0].security_exempt ||
                    rolle === 'owner' || rolle === 'admin' || rolle === 'developer'));
    _ausnahmen.set(konto, { frei, bis: Date.now() + AUSNAHME_TTL });
    return frei;
  } catch (e) {
    /* Im Zweifel NICHT befreien - eine Ausnahme, die aus einem Fehler
       entsteht, ist keine. */
    _ausnahmen.set(konto, { frei: false, bis: Date.now() + 30 * 1000 });
    return false;
  }
}



const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: (req) => (_kontoAusToken(req) ? LIMIT_KONTO : config.rateLimit.max),
  keyGenerator: (req) => {
    const konto = _kontoAusToken(req);
    if (konto) return 'u:' + konto;
    return 'ip:' + _ipSchluessel(req.ip);
  },
  /* Die eingebaute Pruefung warnt bei einem eigenen keyGenerator, weil
     man dabei leicht die IPv6-Praefixe vergisst. Genau das erledigt
     `_ipSchluessel` - deshalb ist die Warnung hier abgestellt und nicht
     ueberhoert. Die Version im Container (express-rate-limit 7.5)
     exportiert keinen `ipKeyGenerator`, sonst waere der der Weg. */
  /* v1366b: der Schluessel heisst in 7.5 schlicht `ip` - mein erster
     Versuch (keyGeneratorIpFallback) ist dort unbekannt und erzeugte beim
     Start eine ValidationError-Zeile im Log. Eine Fehlermeldung, die
     immer dasteht, wird nicht gelesen. */
  validate: { ip: false },

  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (req.path.startsWith('/health')) return true;

    /* v1371: Ausnahmen ueberspringen das Limit - aber nur, wenn die
       Antwort schon im Cache liegt. `skip` ist synchron; eine Abfrage
       ist hier nicht moeglich. Beim ersten Mal wird deshalb normal
       limitiert und die Ausnahme im Hintergrund nachgeladen; ab der
       zweiten Anfrage greift sie. Fuer ein Konto, das dauernd arbeitet,
       ist das eine Anfrage Unterschied. */
    const konto = _kontoAusToken(req);
    if (!konto) return false;

    const bekannt = _ausnahmeBekannt(konto);
    if (bekannt === null) { _ausnahmeLaden(konto); return false; }
    return bekannt;
  },

  /* B3-Vorarbeit: eine Ueberschreitung ist noch kein Verstoss, aber sie
     gehoert protokolliert. Mehr passiert hier bewusst NICHT - Marcels
     Auflage: „Eine technische Auffaelligkeit darf nicht automatisch als
     rechtlich bewiesener Vertragsverstoss behandelt werden." */
  handler: (req, res) => {
    const konto = _kontoAusToken(req);

    /* v1367: das Ereignis geht in die Ablage, nicht nur ins Log. Bis
       hierher stand es in console.warn - fluechtig, beim naechsten
       Rebuild weg, nicht durchsuchbar. Ein Muster ueber Tage erkennt
       man darin nicht.

       Die Stufe steigt mit der Haeufigkeit, NICHT mit der Schwere des
       Pfades: wer einmal ueber das Limit kommt, hat zu schnell
       geklickt; wer es dauernd tut, arbeitet anders. Mehr sagt die
       Stufe nicht - sie ist kein Score und loest nichts aus.

       `await` gibt es hier nicht: der Handler muss antworten, nicht
       warten. Faellt das Schreiben aus, steht es im Log und der Nutzer
       merkt nichts - ein Protokoll darf die Anwendung nicht aufhalten. */
    try {
      const jetzt = Date.now();
      const schluessel = konto ? ('u:' + konto) : ('ip:' + _ipSchluessel(req.ip));
      const zuvor = _limitGedaechtnis.get(schluessel) || { n: 0, seit: jetzt };
      if (jetzt - zuvor.seit > 60 * 60 * 1000) { zuvor.n = 0; zuvor.seit = jetzt; }
      zuvor.n += 1;
      _limitGedaechtnis.set(schluessel, zuvor);

      const stufe = zuvor.n >= 20 ? 'ernst' : (zuvor.n >= 5 ? 'auffaellig' : 'hinweis');

      /* v1370 (B8): NUR an den Schwellen nachrechnen und melden.

         Bei jeder Ueberschreitung `stufeBerechnen()` aufzurufen wuerde
         zwei Datenbankabfragen kosten - bei einem Skript mit tausend
         Anfragen also zweitausend. Die Benachrichtigung wuerde teurer
         als der Vorgang, den sie meldet, und das Problem verschlimmern.

         Die Stufe kann sich nur an den Schwellen aendern (20 und 50, aus
         SCHWELLEN in securityEventService). Genau dort wird geprueft -
         zweimal je Konto und Stunde statt tausendmal. */
      if (konto && (zuvor.n === 20 || zuvor.n === 50)) {
        setImmediate(async () => {
          try {
            const sec = require('./services/securityEventService');
            const alert = require('./services/securityAlert');
            const bewertung = await sec.stufeBerechnen(konto);
            if (bewertung.stufe === 'warnung' || bewertung.stufe === 'hohes_risiko') {
              const u = await require('./db/pool').query(
                'SELECT email FROM users WHERE id = $1', [konto]);
              await alert.stufeMelden({
                userId: konto,
                email: u.rows[0] && u.rows[0].email,
                stufe: bewertung.stufe,
                grund: bewertung.grund,
                vergleich: bewertung.vergleich
              });
            }
          } catch (e) {
            console.warn('[limit] Stufenmeldung fehlgeschlagen:', e.message);
          }
        });
      }


      securityEvents.schreibe({
        userId: konto,
        ipKey: konto ? null : _ipSchluessel(req.ip),
        art: securityEvents.ARTEN.RATE_LIMIT,
        stufe,
        pfad: req.path,
        methode: req.method,
        detail: {
          /* v1371: war das ein befreites Konto? Steht im Protokoll, auch
             wenn es hier nur selten vorkommt - beim allerersten Aufruf,
             bevor der Cache gefuellt ist. */
          ausnahme: _ausnahmeBekannt(konto) === true,
          limit: konto ? LIMIT_KONTO : config.rateLimit.max,

          fenster_s: Math.ceil(config.rateLimit.windowMs / 1000),
          ueberschreitungen_1h: zuvor.n
        }
      });
    } catch (e) {
      console.warn('[limit] Ereignis nicht protokolliert:', e.message);
    }

    res.status(429).json({
      error: 'Zu viele Anfragen in kurzer Zeit. Bitte einen Moment warten.',
      retry_after_s: Math.ceil(config.rateLimit.windowMs / 1000)
    });

  }
});
app.use(limiter);


// Stricter rate limit for auth endpoints (prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

// ── Routes ─────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/auth', registerWithVerifyRoutes);
// V276.1-route-order: wkAggregate VOR objectRoutes! Sonst matched /:id und Validator wirft 400
app.use('/api/v1/objects', require('./routes/wkAggregate'));  // V276-wk-enabled
app.use('/api/v1/bmf', require('./routes/bmf'));  /* V288-bmf-route-applied */
app.use('/api/v1/tax-snapshots', require('./routes/taxSnapshots'));  // V278-tax-snapshots
app.use('/api/v1/objects', objectRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/plans', planRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.use('/api/v1/tax-records', taxRecordsRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/market-rates', marketRatesRoutes);
app.use('/api/v1/beta-signup', betaSignupRoutes);
app.use('/api/v1/track', rateLimit({ windowMs: 60000, max: 120 }), require('./routes/track')); // v973
app.use('/api/v1/deal-action', dealActionRoutes);
app.use('/api/v1/feedback', feedbackRoutes);
app.use('/api/v1/listing', scrapeRoutes);  // V63.85: URL-Scraper für Quick-Check
app.use('/api/v1/rnd-request', rndRequestRoutes);  // V186: RND-Wizard-Anfrage
app.use('/api/v1/passes', passesRoutes);  // qb-shared-pass
app.use('/api/v1/network-cards', networkRoutes);  // v852-network
app.use('/api/v1/export', require('./routes/exportEncrypt'));
// V276.1-route-order: wkAggregate wurde NACH OBEN verschoben (vor objectRoutes) — siehe oben
app.use('/api/v1/tax-periods', require('./routes/taxPeriods'));  // V259-02: Steuerzeitraeume  // V258-04: WK-Aggregation  // V251-05: Encrypted Export

// V194: Admin-Dashboard
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/credits', creditsRoutes);  // V197
app.use('/api/v1/api-keys', require('./routes/apiKeys'));  // mand v807-api-keys
app.use('/api/v1/avm', avmRoutes);  // V326: AVM-Integration
app.use('/api/v1/immometrica', require('./routes/immometrica'));  // v655: ImmoMetrica
app.use('/api/v1/marktbericht', marktberichtRoutes);  // v539: Marktbericht-Proxy
app.use('/api/v1', resellerRoutes);  // V200
app.use('/api/v1/reseller', require('./routes/resellerPortal'));  // reseller-portal-p3
app.use('/api/v1/reseller-invite', require('./routes/resellerInvite'));  // reseller-invite-p5
app.use('/api/v1/admin-reseller', require('./routes/resellerAdminPanel'));  // reseller-admin-panel-p7
app.set('db', pool);

// API root info
app.get('/api/v1', (req, res) => {
  res.json({
    name: 'Junker Immobilien Backend',
    version: '1.0.0',
    endpoints: {
      auth: '/api/v1/auth',
      objects: '/api/v1/objects',
      users: '/api/v1/users (admin)',
      plans: '/api/v1/plans',
      subscription: '/api/v1/subscription',
      stripeWebhook: '/api/v1/webhooks/stripe',
      health: '/health'
    }
  });
});

// Root redirect to API info
app.get('/', (req, res) => res.redirect('/api/v1'));

// ── Error handlers (LAST) ──────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Startup ────────────────────────────────────────
async function start() {
  console.log('═══════════════════════════════════════════════');
  console.log(' Junker Immobilien Backend');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Environment: ${config.env}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  CORS: ${config.cors.origins.join(', ')}`);

  const dbOk = await testConnection();
  if (!dbOk) {
    console.error('✗ Database not reachable - start anyway (will retry on requests)');
  }

  const _server = app.listen(config.port, () => {
    console.log(`✓ Server listening on http://localhost:${config.port}`);
    console.log(`  Try: curl http://localhost:${config.port}/health`);
    console.log('───────────────────────────────────────────────');
  });
  // v779-lifecycle: taeglicher Abo-Lifecycle-Job. Laeuft als Dry-Run, solange
  // lifecycle_config.enabled=false (sendet/loescht nichts). Scharf nur ueber Admin 'Kundenbindung'.
  try {
    const lifecycleService = require('./services/lifecycleService');
    const _runLc = function () {
      lifecycleService.scan({}).then(function (r) {
        console.log('[lifecycle] scan: enabled=' + r.enabled + ' dryRun=' + r.dryRun + ' actions=' + r.count);
      }).catch(function (e) { console.error('[lifecycle] scan failed:', e && e.message); });
    };
    setTimeout(_runLc, 60000);                  // einmal ~1min nach Boot
    setInterval(_runLc, 24 * 60 * 60 * 1000);   // danach taeglich
  } catch (e) { console.error('[lifecycle] init failed:', e && e.message); }

  // v799-retention-scheduler: taeglicher Kundenbindungs-Lauf (Auslauf + Inaktivitaet)
  try {
    const retentionService = require('./services/retentionService');
    const _RET_INTERVAL_MS = 24 * 60 * 60 * 1000; // taeglich
    const _runRetention = async () => {
      try {
        const r = await retentionService.runOnce({ dryRun: false });
        console.log('[retention] Lauf fertig:',
          'Auslauf', r.expiry.sent + '/' + r.expiry.candidates,
          '| Inaktiv', r.inactive.sent + '/' + r.inactive.candidates,
          '| Testphase', (r.testphase ? r.testphase.sent + '/' + r.testphase.candidates : '-'));
      } catch (e) {
        console.error('[retention] Lauf-Fehler:', e.message);
      }
    };
    setTimeout(_runRetention, 60 * 1000);          // erster Lauf 60s nach Start
    setInterval(_runRetention, _RET_INTERVAL_MS);  // danach taeglich
    console.log('✓ Retention-Scheduler aktiv (taeglich)');
  } catch (e) {
    console.error('✗ Retention-Scheduler konnte nicht starten:', e.message);
  }

  /* v1186: Die Stripe-Preis-IDs in `plans` gegen die lookup_keys abgleichen.
     Laeuft bei jedem Start, nicht als Migration — eine Migration kann nur
     feste IDs schreiben, und die sind je Umgebung verschieden. Migration
     065 hat auf diese Weise die Sandbox-IDs festgeschrieben; auf
     Produktion waere daran jeder Checkout gescheitert.

     Verzoegert, damit der Server zuerst antwortet: der Abgleich ist
     wichtig, aber nicht dringlicher als ein laufender Dienst. Faellt er
     aus, bleiben die alten Werte stehen und es steht im Log. */
  try {
    const plansSync = require('./db/plans-preise-sync');
    setTimeout(function () {
      plansSync.sync({}).then(function (r) {
        if (!r.ok) console.warn('[plans-sync] uebersprungen:', r.reason);
      }).catch(function (e) {
        console.error('[plans-sync] fehlgeschlagen:', e && e.message);
      });
    }, 15000);
  } catch (e) {
    console.error('✗ plans-sync konnte nicht starten:', e.message);
  }

  // v507: WebSocket-Relay fuer Live-Transkription (OpenAI Realtime)
  /* v538-ws-removed: Realtime-WS-Live-Pfad entfernt. Web-Audio liefert auf manchen
     Geraeten Stille -> Realtime unbrauchbar. Live-Mitschrift laeuft seit v536 ueber
     POST /api/v1/ai/transcribe-chunk. voiceStream.js bleibt ungenutzt auf Platte. */
}

// Graceful shutdown
async function shutdown(signal) {
  console.log(`\n  Received ${signal}, shutting down...`);
  try {
    await pool.end();
    console.log('  ✓ Database pool closed');
  } catch (err) {
    console.error('  ✗ Error closing pool:', err.message);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => {
  console.error('✗ Unhandled rejection:', err);
});

start();

module.exports = app;
