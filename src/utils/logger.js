'use strict';

const pino = require('pino');

function createLogger(level = 'info') {
  const pretty = process.env.NODE_ENV !== 'production';
  return pino({
    level,
    ...(pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:standard' }
          }
        }
      : {})
  });
}

module.exports = { createLogger };
