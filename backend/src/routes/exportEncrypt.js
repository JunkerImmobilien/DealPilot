/**
 * V251-05: Export-Encryption Endpoint
 *
 * POST /api/v1/export/encrypt — Verschluesselt JSON-Payload mit Server-Key
 * POST /api/v1/export/decrypt — Entschluesselt
 *
 * Server-Key kommt aus ENV.DEALPILOT_EXPORT_KEY (64 Hex-Chars = 32 Bytes AES-256).
 * Verschluesselungs-Format: AES-256-GCM
 *   Output: { v: 1, iv: <hex 12 bytes>, tag: <hex 16 bytes>, data: <hex> }
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

const KEY_HEX = process.env.DEALPILOT_EXPORT_KEY;
const VERSION = 1;

function _getKey() {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error('DEALPILOT_EXPORT_KEY ENV fehlt oder ungueltig (64 Hex-Chars erwartet)');
  }
  return Buffer.from(KEY_HEX, 'hex');
}

router.post('/encrypt', authenticate, (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'JSON body required' });
    }

    const key = _getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const plain = Buffer.from(JSON.stringify(payload), 'utf-8');
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return res.json({
      v: VERSION,
      iv: iv.toString('hex'),
      tag: authTag.toString('hex'),
      data: encrypted.toString('hex'),
      _meta: {
        encrypted_at: new Date().toISOString(),
        app: 'DealPilot',
        algo: 'AES-256-GCM',
      },
    });
  } catch (err) {
    console.error('[export/encrypt] Fehler:', err);
    return res.status(500).json({ error: 'Encryption failed' });
  }
});

router.post('/decrypt', authenticate, (req, res) => {
  try {
    const enc = req.body;
    if (!enc || !enc.iv || !enc.tag || !enc.data || enc.v !== VERSION) {
      return res.status(400).json({ error: 'Invalid encrypted payload' });
    }

    const key = _getKey();
    const iv = Buffer.from(enc.iv, 'hex');
    const tag = Buffer.from(enc.tag, 'hex');
    const data = Buffer.from(enc.data, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    const payload = JSON.parse(decrypted.toString('utf-8'));

    return res.json(payload);
  } catch (err) {
    console.error('[export/decrypt] Fehler:', err);
    return res.status(500).json({ error: 'Decryption failed' });
  }
});

module.exports = router;
