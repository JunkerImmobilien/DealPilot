'use strict';
/**
 * V63.78: Nextcloud-Service (WebDAV)
 * ──────────────────────────────────
 * Lädt Bankunterlagen in eine Nextcloud-Instanz hoch und erzeugt
 * pro Anfrage einen geschützten Public-Share-Link.
 *
 * Konfiguration in .env:
 *   NEXTCLOUD_BASE_URL    z.B. https://cloud.junker-immobilien.io
 *   NEXTCLOUD_USERNAME    DealPilot-Service-User
 *   NEXTCLOUD_APP_PASSWORD  App-Password aus Nextcloud-Settings
 *   NEXTCLOUD_BASE_FOLDER   z.B. "DealPilot/Bankanfragen" (wird angelegt falls nötig)
 *   NEXTCLOUD_SHARE_EXPIRES_DAYS  Tage bis Auto-Ablauf (default 30)
 *
 * Wenn Nextcloud nicht konfiguriert ist (NEXTCLOUD_BASE_URL leer),
 * fällt das Modul auf einen Stub zurück, der null zurückgibt — der
 * Caller (dealAction) hängt die Files dann wie bisher als Mail-Attachment an.
 *
 * APIs verwendet:
 *   PUT    {url}/remote.php/dav/files/{user}/{path}    (WebDAV upload)
 *   MKCOL  {url}/remote.php/dav/files/{user}/{folder}  (folder create)
 *   POST   {url}/ocs/v2.php/apps/files_sharing/api/v1/shares  (public share)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

function _enabled() {
  return !!(process.env.NEXTCLOUD_BASE_URL && process.env.NEXTCLOUD_USERNAME && process.env.NEXTCLOUD_APP_PASSWORD);
}

function _baseAuth() {
  return Buffer.from(
    process.env.NEXTCLOUD_USERNAME + ':' + process.env.NEXTCLOUD_APP_PASSWORD
  ).toString('base64');
}

function _request(method, fullUrl, body, headers, isXml) {
  return new Promise(function(resolve, reject) {
    const u = new URL(fullUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const opts = {
      method: method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers: Object.assign({
        'Authorization': 'Basic ' + _baseAuth(),
        'OCS-APIRequest': 'true'
      }, headers || {})
    };
    const req = lib.request(opts, function(res) {
      const chunks = [];
      res.on('data', function(c) { chunks.push(c); });
      res.on('end', function() {
        const buf = Buffer.concat(chunks);
        const text = buf.toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ status: res.statusCode, headers: res.headers, body: text });
        } else {
          reject(new Error('Nextcloud HTTP ' + res.statusCode + ': ' + text.substring(0, 500)));
        }
      });
    });
    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) req.write(body);
      else req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// MKCOL — Ordner anlegen (idempotent: 405 = existiert bereits → ok)
async function _mkcolSafe(baseUrl, user, folderPath) {
  const url = baseUrl.replace(/\/$/, '') + '/remote.php/dav/files/' + user + '/' + folderPath;
  try {
    await _request('MKCOL', url, null, {});
  } catch (e) {
    // 405 Method Not Allowed = Ordner existiert schon — ignorieren
    if (e.message.indexOf('405') >= 0) return;
    throw e;
  }
}

// Verschachtelte Ordner anlegen (z.B. "DealPilot/Bankanfragen/2026-05-06_obj-id")
async function _ensureFolder(baseUrl, user, fullPath) {
  const parts = fullPath.split('/').filter(Boolean);
  let acc = '';
  for (const p of parts) {
    acc = acc ? acc + '/' + p : p;
    await _mkcolSafe(baseUrl, user, encodeURI(acc));
  }
}

// File hochladen (PUT)
async function _uploadFile(baseUrl, user, remotePath, buffer, contentType) {
  const url = baseUrl.replace(/\/$/, '') + '/remote.php/dav/files/' + user + '/' + encodeURI(remotePath);
  await _request('PUT', url, buffer, {
    'Content-Type': contentType || 'application/octet-stream',
    'Content-Length': buffer.length
  });
}

// Public Share Link erstellen mit optionalem Ablaufdatum
async function _createPublicShare(baseUrl, sharePath, expiresDays) {
  const url = baseUrl.replace(/\/$/, '') + '/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json';
  const body = new URLSearchParams();
  body.append('path', '/' + sharePath);
  body.append('shareType', '3');         // 3 = public link
  body.append('permissions', '1');       // 1 = read only
  if (expiresDays && expiresDays > 0) {
    const exp = new Date();
    exp.setDate(exp.getDate() + expiresDays);
    body.append('expireDate', exp.toISOString().slice(0, 10));   // YYYY-MM-DD
  }
  const res = await _request('POST', url, body.toString(), {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json'
  });
  let json;
  try { json = JSON.parse(res.body); } catch (e) { throw new Error('Nextcloud share response invalid JSON'); }
  const data = json && json.ocs && json.ocs.data;
  if (!data || !data.url) throw new Error('Nextcloud share response missing url');
  return data.url;
}

/**
 * Lädt eine Datei-Map (z.B. {ausweis: [File], gehalt: [File]}) in einen frischen
 * Ordner in Nextcloud hoch und erzeugt einen Share-Link auf den Ordner.
 *
 * @param {object} fileMap   { docId: [{ filename, content (Buffer), contentType }] }
 * @param {object} ctx       { kind, addressSlug, userIdentifier }
 * @returns {Promise<{shareUrl, folderPath, fileCount} | null>}
 */
async function uploadBankDocs(fileMap, ctx) {
  if (!_enabled()) return null;

  const baseUrl = process.env.NEXTCLOUD_BASE_URL;
  const user = process.env.NEXTCLOUD_USERNAME;
  const baseFolder = process.env.NEXTCLOUD_BASE_FOLDER || 'DealPilot/Bankanfragen';
  const expiresDays = parseInt(process.env.NEXTCLOUD_SHARE_EXPIRES_DAYS || '30', 10);

  // Eindeutiger Ordnername: yyyy-mm-dd_kind_address-slug_random
  const ts = new Date().toISOString().slice(0, 10);
  const slug = (ctx.addressSlug || 'objekt')
    .toString().toLowerCase()
    .replace(/[äöüß]/g, function(c) { return ({ä:'ae',ö:'oe',ü:'ue',ß:'ss'})[c]; })
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50);
  const rand = Math.random().toString(36).slice(2, 7);
  const folderName = ts + '_' + (ctx.kind || 'anfrage') + '_' + slug + '_' + rand;
  const fullFolder = baseFolder + '/' + folderName;

  await _ensureFolder(baseUrl, user, fullFolder);

  let fileCount = 0;
  for (const docId of Object.keys(fileMap || {})) {
    const arr = Array.isArray(fileMap[docId]) ? fileMap[docId] : [];
    for (let i = 0; i < arr.length; i++) {
      const f = arr[i];
      if (!f || !f.content) continue;
      const safeName = (f.filename || ('file_' + i)).replace(/[^a-zA-Z0-9._\-äöüÄÖÜß]/g, '_');
      const remotePath = fullFolder + '/' + docId + '_' + safeName;
      await _uploadFile(baseUrl, user, remotePath, f.content, f.contentType || 'application/octet-stream');
      fileCount++;
    }
  }

  if (fileCount === 0) return null;

  const shareUrl = await _createPublicShare(baseUrl, fullFolder, expiresDays);
  return {
    shareUrl: shareUrl,
    folderPath: fullFolder,
    fileCount: fileCount,
    expiresInDays: expiresDays
  };
}

function getStatus() {
  return {
    enabled: _enabled(),
    baseUrl: process.env.NEXTCLOUD_BASE_URL || null,
    baseFolder: process.env.NEXTCLOUD_BASE_FOLDER || 'DealPilot/Bankanfragen'
  };
}

module.exports = {
  uploadBankDocs,
  getStatus
};
