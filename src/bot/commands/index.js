'use strict';

const fs = require('fs');
const path = require('path');

function loadCommands() {
  const dir = __dirname;
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.js') && file !== 'index.js')
    .map((file) => require(path.join(dir, file)));
}

function commandCollection() {
  const map = new Map();
  for (const command of loadCommands()) {
    map.set(command.data.name, command);
  }
  return map;
}

module.exports = { loadCommands, commandCollection };
