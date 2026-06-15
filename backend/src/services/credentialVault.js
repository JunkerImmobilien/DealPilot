'use strict';
/* AES-256-GCM Vault fuer externe Anbieter-Keys.
   Schluessel: CRED_ENC_KEY aus .env, sonst abgeleitet aus JWT_SECRET (immer vorhanden, >=32 Z.).
   Format: base64(iv):base64(tag):base64(ciphertext) */
const crypto = require('crypto');

function key() {
  const base = process.env.CRED_ENC_KEY || process.env.JWT_SECRET || 'dealpilot-cred-fallback';
  return crypto.createHash('sha256').update(String(base)).digest(); // 32 Bytes
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  const tag = c.getAuthTag();
  return [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

function decrypt(blob) {
  const parts = String(blob).split(':');
  if (parts.length !== 3) throw new Error('bad ciphertext');
  const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(parts[0], 'base64'));
  d.setAuthTag(Buffer.from(parts[1], 'base64'));
  return Buffer.concat([d.update(Buffer.from(parts[2], 'base64')), d.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
