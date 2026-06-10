// server.js — Express-Einstieg: API-Router + statisches Dashboard.
// API bewusst unter /api/v1/marktbericht (1:1 als Zusatz-Router in DealPilot einhaengbar).
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cfg } from './lib/config.js';
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
app.use(express.json({ limit: '5mb' }));

app.use('/api/v1/marktbericht', router);

// Dashboard statisch ausliefern
app.use('/', express.static(FRONTEND_DIR));

const server = app.listen(cfg.port, () => {
  console.log(`[marktbericht] listening on :${cfg.port}`);
  console.log(`[marktbericht] dashboard  http://localhost:${cfg.port}/`);
  console.log(`[marktbericht] api        http://localhost:${cfg.port}/api/v1/marktbericht/health`);
  console.log(`[marktbericht] frontend   ${FRONTEND_DIR} (${fs.existsSync(path.join(FRONTEND_DIR, 'index.html')) ? 'gefunden' : 'FEHLT'})`);
  console.log(`[marktbericht] ai_mode=${cfg.ai.mode}  geo=${cfg.geoapify.key ? 'geoapify' : 'none'}  market=${cfg.market.source}`);
});
// Lange Berichte (GeoMap-Calls + bis zu 3 min OpenAI) nicht serverseitig abschneiden.
server.requestTimeout = 300000;  // 5 min
server.headersTimeout = 310000;
server.timeout = 0;              // kein Socket-Timeout
