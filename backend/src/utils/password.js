'use strict';
const bcrypt = require('bcrypt');
const config = require('../config');

async function hash(password) {
  return bcrypt.hash(password, config.auth.bcryptRounds);
}

async function verify(password, hashed) {
  return bcrypt.compare(password, hashed);
}

module.exports = { hash, verify };
