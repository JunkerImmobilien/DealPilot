'use strict';
/* Speicherung/Abruf externer Anbieter-Keys pro User. Pattern wie userService. */
const bcrypt = require('bcrypt');
const { query } = require('../db/pool');
const vault = require('./credentialVault');

async function setCredential(userId, provider, secret) {
  const ciphertext = vault.encrypt(secret);
  const hint = String(secret).slice(-4);
  await query(
    `INSERT INTO user_provider_credentials (user_id, provider, ciphertext, hint, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id, provider)
     DO UPDATE SET ciphertext = EXCLUDED.ciphertext, hint = EXCLUDED.hint, updated_at = now()`,
    [userId, provider, ciphertext, hint]
  );
  return { exists: true, hint };
}

async function getMeta(userId, provider) {
  const r = await query(
    `SELECT hint, updated_at FROM user_provider_credentials WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );
  if (!r.rows.length) return { exists: false };
  return { exists: true, hint: r.rows[0].hint, updatedAt: r.rows[0].updated_at };
}

async function getSecret(userId, provider) {
  const r = await query(
    `SELECT ciphertext FROM user_provider_credentials WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );
  if (!r.rows.length) return null;
  try { return vault.decrypt(r.rows[0].ciphertext); } catch (e) { return null; }
}

async function remove(userId, provider) {
  await query(`DELETE FROM user_provider_credentials WHERE user_id = $1 AND provider = $2`, [userId, provider]);
  return { exists: false };
}

// Passwort-Reauth fuer "Anzeigen". users.password_hash (bcrypt).
async function verifyPassword(userId, password) {
  const r = await query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
  if (!r.rows.length || !r.rows[0].password_hash) return false;
  try { return await bcrypt.compare(String(password), r.rows[0].password_hash); } catch (e) { return false; }
}

module.exports = { setCredential, getMeta, getSecret, remove, verifyPassword };
