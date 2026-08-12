// server.js — Express-Einstieg: API-Router + statisches Dashboard.
// API bewusst unter /api/v1/marktbericht (1:1 als Zusatz-Router in DealPilot einhaengbar).
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cfg } from './lib/config.js';
/* WADM-4 */
import { starteHarvestScheduler } from './lib/harvestScheduler.js';
import { router } from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Frontend-Verzeichnis robust finden: Docker (/app/frontend) ODER lokaler Lauf (../../frontend)
const FRONTEND_CANDIDATES = [
  path.resolve(__dirname, '..', 'frontend'),        // Docker: /app/frontend
  path.resolve(__dirname, '..', '..', 'frontend'),  // lokal:  marktbericht/frontend
];
const FRONTEND_DIR = FRONTEND_CANDIDATES.find((p) => {
  try { return fs.existsSync(path.join(p, 'index.html')); } catch { return false; }
}) || FRONTEND_CANDIDATES[0];

const app = express();
app.use(cors());
/* WIMP-5 · 80 MB fuer den PDF-Import. Ein Grundstuecksmarktbericht hat
 * 100 bis 250 Seiten; base64 legt nochmal ein Drittel drauf. */
app.use(express.json({ limit: process.env.MB_BODY_LIMIT || '80mb' }));

app.use('/api/v1/marktbericht', router);

// Dashboard statisch ausliefern
app.use('/', express.static(FRONTEND_DIR));

const server = app.listen(cfg.port, () => {
  console.log(`[marktbericht] listening on :${cfg.port}`);
  console.log(`[marktbericht] dashboard  http://localhost:${cfg.port}/`);
  console.log(`[marktbericht] api        http://localhost:${cfg.port}/api/v1/marktbericht/health`);
  console.log(`[marktbericht] frontend   ${FRONTEND_DIR} (${fs.existsSync(path.join(FRONTEND_DIR, 'index.html')) ? 'gefunden' : 'FEHLT'})`);
    /* WADM-3 · Taktgeber der Discovery. Laeuft neben dem Server, nie im
   * Anfragepfad — ein haengendes Landesportal darf keinen Bericht blockieren. */
  try { starteHarvestScheduler(); } catch (e) { console.log('[harvest] Start fehlgeschlagen:', e.message); }
  /* v1083a-WBOOT · Ausschuss-Register aus mb.param_modell nachladen.
   *
   * Das Register laedt seine Saatdatei beim ersten Zugriff selbst
   * (v1083a-WLAZ) — es kann also nie leer sein. Dieser Hook holt zusaetzlich
   * den DB-Stand, damit eine spaetere Ernte OHNE Deploy wirkt.
   *
   * Laeuft NEBEN dem Server, nie im Anfragepfad — dieselbe Regel wie beim
   * Taktgeber. Schlaegt er fehl oder ist die Tabelle leer, bleibt die
   * versionierte Saatdatei stehen: das Register ist dann alt, aber nie leer. */
  (async () => {
    try {
      const reg = await import('./lib/ausschuss_register.js');
      reg.ladeSaat();
      const { q } = await import('./lib/db.js');
      const r = await reg.ladeAusDb(q);
      const st = reg.registerStand();
      console.log('[register] ' + st.saetze + ' Saetze, ' + st.gebiete
        + ' Gebiete, Herkunft ' + st.herkunft + (r.grund ? ' (DB: ' + r.grund + ')' : ''));
    } catch (e) { console.log('[register] Start fehlgeschlagen:', e.message); }
  })();
  console.log(`[marktbericht] ai_mode=${cfg.ai.mode}  geo=${cfg.geoapify.key ? 'geoapify' : 'none'}  market=${cfg.market.source}`);
});
// Lange Berichte (GeoMap-Calls + bis zu 3 min OpenAI) nicht serverseitig abschneiden.
server.requestTimeout = 300000;  // 5 min
server.headersTimeout = 310000;
server.timeout = 0;              // kein Socket-Timeout
