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
  ''  /* v516: Default-Prompt entfernt (leakte als Transkript-Echo) */;

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
    let closed = false, msgCount = 0, commitTimer = null, lastCommitBytes = 0, audioFrames = 0, audioBytes = 0;  /* v531-commit */
    console.log('[voiceStream] Client verbunden -> verbinde OpenAI (' + LIVE_MODEL + ') ' + REALTIME_URL);

    function closeBoth() {
      if (closed) return; closed = true;
      try { if (commitTimer) { clearInterval(commitTimer); commitTimer = null; } } catch (e) {}  /* v531-commit */
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
              turn_detection: null  /* v531-commit: manueller Modus, Commit loest Transkription aus */
            }
          }
        }
      }));
      tellClient({ type: 'dp-ready' });
      /* v531-commit: gepuffertes Audio periodisch committen, sonst feuert der
         VAD bei Dauer-append oft nie -> kein transcription-Event. */
      try { if (commitTimer) clearInterval(commitTimer); } catch (e) {}
      commitTimer = setInterval(function () {
        if (up.readyState === WebSocket.OPEN && (audioBytes - lastCommitBytes) >= 120000) {  /* v532-interval: min ~2.5s Audio pro Commit */
          lastCommitBytes = audioBytes;
          try { up.send(JSON.stringify({ type: 'input_audio_buffer.commit' })); } catch (e) {}
        }
      }, 4000);  /* v532-interval */
    });

    up.on('message', function (data, isBinary) {
      /* v530-diag: ALLE Event-Typen; Fehler + session.* voll */
      if (!isBinary) {
        msgCount++;
        try {
          const txt = data.toString(); const o = JSON.parse(txt); const t = o.type || '?';
          if (String(t).indexOf('error') >= 0) console.error('[voiceStream] OpenAI FEHLER #' + msgCount + ':', txt.slice(0, 600));
          else if (t === 'session.created' || t === 'session.updated') console.log('[voiceStream] OpenAI #' + msgCount + ' ' + t + ': ' + txt.slice(0, 600));
          else console.log('[voiceStream] OpenAI #' + msgCount + ': ' + t);
        } catch (e) {}
      }
      if (client.readyState === WebSocket.OPEN) {
        try { client.send(data, { binary: isBinary }); } catch (e) {}
      }
    });
    up.on('close', function (code, reason) {
      console.log('[voiceStream] OpenAI getrennt: code ' + code + (reason ? ' / ' + reason.toString() : '') + ' | v530-diag: Audio-Frames empfangen=' + audioFrames + ', Bytes=' + audioBytes);
      closeBoth();
    });
    up.on('error', function (err) {
      console.error('[voiceStream] OpenAI-WS-Fehler:', err && err.message);
      tellClient({ type: 'dp-error', error: 'upstream: ' + (err && err.message) });
      closeBoth();
    });

    audioFrames = 0; audioBytes = 0;  /* v531: oben deklariert */
    client.on('message', function (data, isBinary) {
      if (up.readyState !== WebSocket.OPEN) {
        if (isBinary) { audioFrames++; if (audioFrames === 1 || audioFrames % 100 === 0) console.warn('[voiceStream] v530-diag: Audio-Frame #' + audioFrames + ' aber OpenAI-WS NICHT offen (state=' + up.readyState + ')'); }
        return;
      }
      if (isBinary) {
        audioFrames++; audioBytes += (data && data.length) || 0;
        if (audioFrames === 1 || audioFrames === 5 || audioFrames % 100 === 0) console.log('[voiceStream] v530-diag: Audio-Frame #' + audioFrames + ' (' + ((data && data.length) || 0) + ' B, gesamt ' + audioBytes + ' B) -> append');
        if (audioFrames === 1 || audioFrames % 50 === 0) {  /* v533-pcmlevel */
          try {
            var _i16 = new Int16Array(data.buffer, data.byteOffset, Math.floor(data.length / 2));
            var _peak = 0, _sum = 0;
            for (var _k = 0; _k < _i16.length; _k++) { var _a = Math.abs(_i16[_k]); if (_a > _peak) _peak = _a; _sum += _i16[_k] * _i16[_k]; }
            var _rms = _i16.length ? Math.round(Math.sqrt(_sum / _i16.length)) : 0;
            console.log('[voiceStream] v533-pcmlevel: Frame #' + audioFrames + ' samples=' + _i16.length + ' peak=' + _peak + '/32767 rms=' + _rms);
          } catch (e) { console.error('[voiceStream] v533-pcmlevel Fehler:', e && e.message); }
        }
        const b64 = Buffer.from(data).toString('base64');
        try { up.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: b64 })); } catch (e) { console.error('[voiceStream] v530-diag: append-send Fehler:', e && e.message); }
      } else {
        console.log('[voiceStream] v530-diag: Text-Frame vom Client:', data.toString().slice(0, 120));
        try { up.send(data.toString()); } catch (e) {}
      }
    });
    client.on('close', closeBoth);
    client.on('error', closeBoth);
  });

  console.log('[voiceStream] WS aktiv auf ' + WS_PATH + ' (Modell ' + LIVE_MODEL + ')');
}

module.exports = { attach };
