/* ════════════════════════════════════════════════════════════════════
 * voiceStream.js — v511 (Sprache+Prompt+Noise-Reduction)
 * WebSocket-Relay: Browser-Mic (24-kHz-PCM) -> DealPilot-Backend ->
 * OpenAI Realtime Transcription (Session type 'transcription').
 *
 * NEU ggü v507:
 *  - Pro-Verbindung-Logging (client connect, upstream open/close/error).
 *  - 'unexpected-response': OpenAI lehnt den Upgrade ab (z.B. 401/403 wegen
 *    Modell-/Beta-Zugang) -> Status + Body ins Backend-Log UND als dp-error
 *    an den Browser (Modal zeigt den Grund statt still leer zu bleiben).
 *  - Erste eingehende OpenAI-Events (type) ins Log; Fehler-Events vollständig.
 *
 * env: OPENAI_REALTIME_URL, OPENAI_REALTIME_MODEL (Default gpt-realtime-whisper)
 * ════════════════════════════════════════════════════════════════════ */
'use strict';

const { WebSocketServer, WebSocket } = require('ws');
const config = require('../config');
let jwtUtil = null;
try { jwtUtil = require('../utils/jwt'); } catch (e) { jwtUtil = null; }

const WS_PATH = '/api/v1/ai/voice-stream';
const REALTIME_URL = process.env.OPENAI_REALTIME_URL || 'wss://api.openai.com/v1/realtime?intent=transcription';
const LIVE_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-whisper';
const LIVE_LANG = process.env.OPENAI_REALTIME_LANG || 'de';
// Kurzer Vokabular-Prompt (Domain-Begriffe) — laut OpenAI-Guide KEINE langen
// Anweisungen, nur Stichwoerter. Wird NICHT an *-whisper-Modelle geschickt
// (dort 'prompt' nicht unterstuetzt).
const LIVE_PROMPT = process.env.OPENAI_REALTIME_PROMPT ||
  'Diktat auf Deutsch, Immobilien-Investment. Begriffe: Eigentumswohnung, Mehrfamilienhaus, Wohnflaeche, Quadratmeter, Baujahr, Kaufpreis, Kaltmiete, Hausgeld, Eigenkapital, Zinssatz, Tilgung, Bodenrichtwert, Stellplatz, Garage, Grunderwerbsteuer, Notarkosten, Mikrolage, Makrolage.';

function attach(server) {
  const apiKey = config && config.openai && config.openai.apiKey;
  if (!apiKey) {
    console.warn('[voiceStream] kein OpenAI-Key — Live-Streaming deaktiviert.');
    return;
  }
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', function (req, socket, head) {
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { return; }
    if (url.pathname !== WS_PATH) return;

    const token = url.searchParams.get('token');
    if (!jwtUtil || typeof jwtUtil.verify !== 'function' || !token) {
      console.warn('[voiceStream] Upgrade ohne/ungueltigen Token -> 401');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return;
    }
    try { jwtUtil.verify(token); }
    catch (e) {
      console.warn('[voiceStream] Token-Verify fehlgeschlagen -> 401:', e && e.message);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(req, socket, head, function (client) { wss.emit('connection', client, req); });
  });

  wss.on('connection', function (client) {
    let closed = false, msgCount = 0;
    console.log('[voiceStream] Client verbunden -> verbinde OpenAI (' + LIVE_MODEL + ') ' + REALTIME_URL);

    function closeBoth() {
      if (closed) return; closed = true;
      try { up.close(); } catch (e) {}
      try { client.close(); } catch (e) {}
    }
    function tellClient(obj) { try { client.send(JSON.stringify(obj)); } catch (e) {} }

    const up = new WebSocket(REALTIME_URL, {
      headers: { Authorization: 'Bearer ' + apiKey }  /* v509: GA-Interface — KEIN OpenAI-Beta-Header (sonst beta_api_shape_disabled) */
    });

    // OpenAI lehnt den WS-Upgrade ab (HTTP-Fehler vor dem Open) — DAS ist der
    // typische Fall bei fehlendem Modell-/Beta-Zugang.
    up.on('unexpected-response', function (_req, res) {
      let body = '';
      res.on('data', function (c) { body += c.toString(); });
      res.on('end', function () {
        console.error('[voiceStream] OpenAI lehnt Upgrade ab: HTTP ' + res.statusCode + ' — ' + body.slice(0, 500));
        tellClient({ type: 'dp-error', error: 'OpenAI ' + res.statusCode + ': ' + body.slice(0, 200) });
        closeBoth();
      });
    });

    up.on('open', function () {
      console.log('[voiceStream] OpenAI verbunden -> session.update (transcription, ' + LIVE_MODEL + ', de)');
      var transCfg = { model: LIVE_MODEL, language: LIVE_LANG };
      // 'prompt' nur fuer Nicht-whisper-Modelle (gpt-4o-transcribe etc.)
      if (LIVE_PROMPT && !/whisper/i.test(LIVE_MODEL)) transCfg.prompt = LIVE_PROMPT;
      up.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'transcription',
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: 24000 },
              transcription: transCfg,
              noise_reduction: { type: 'near_field' },  // Objekt! (String -> invalid_type)
              turn_detection: { type: 'server_vad' }
            }
          }
        }
      }));
      tellClient({ type: 'dp-ready' });
    });

    up.on('message', function (data, isBinary) {
      // Erste Events + alle Fehler ins Log (Diagnose)
      if (!isBinary && msgCount < 8) {
        msgCount++;
        let t = '?';
        try { const o = JSON.parse(data.toString()); t = o.type || '?';
          if (String(t).indexOf('error') >= 0) console.error('[voiceStream] OpenAI-Event#' + msgCount + ' FEHLER:', data.toString().slice(0, 500));
          else console.log('[voiceStream] OpenAI-Event#' + msgCount + ':', t);
        } catch (e) {}
      }
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(data, { binary: isBinary }); } catch (e) {}
      }
    });
    up.on('close', function (code, reason) {
      console.log('[voiceStream] OpenAI getrennt: code ' + code + (reason ? ' / ' + reason.toString() : ''));
      closeBoth();
    });
    up.on('error', function (err) {
      console.error('[voiceStream] OpenAI-WS-Fehler:', err && err.message);
      tellClient({ type: 'dp-error', error: 'upstream: ' + (err && err.message) });
      closeBoth();
    });

    client.on('message', function (data, isBinary) {
      if (up.readyState !== WebSocket.OPEN) return;
      if (isBinary) {
        const b64 = Buffer.from(data).toString('base64');
        try { up.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: b64 })); } catch (e) {}
      } else {
        try { up.send(data.toString()); } catch (e) {}
      }
    });
    client.on('close', closeBoth);
    client.on('error', closeBoth);
  });

  console.log('[voiceStream] WS aktiv auf ' + WS_PATH + ' (Modell ' + LIVE_MODEL + ')');
}

module.exports = { attach };
