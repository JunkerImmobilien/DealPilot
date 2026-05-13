'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config');

function sign(payload) {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
    issuer: 'junker-backend'
  });
}

function verify(token) {
  return jwt.verify(token, config.auth.jwtSecret, {
    issuer: 'junker-backend'
  });
}

module.exports = { sign, verify };
