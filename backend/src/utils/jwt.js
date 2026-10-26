'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config');

function sign(payload) {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
    issuer: 'junker-backend'
  });
}

/* v2961 · Ein Token mit eigener, kurzer Laufzeit — fuer den PDF-Dienst,
   der damit die App im Headless-Browser oeffnet. Es verlaesst den Server
   nicht, soll aber auch dort nicht sieben Tage gelten. */
function signKurz(payload, laufzeit) {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: laufzeit || '5m',
    issuer: 'junker-backend'
  });
}

function verify(token) {
  return jwt.verify(token, config.auth.jwtSecret, {
    issuer: 'junker-backend'
  });
}

module.exports = { sign, signKurz, verify };
