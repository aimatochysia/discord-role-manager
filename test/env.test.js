'use strict';

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadEnv } = require('../src/config/env');
const { durationToMs } = require('../src/bot/commands/mod');

describe('env loader', () => {
  const previous = { ...process.env };

  after(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) delete process.env[key];
    }
    Object.assign(process.env, previous);
  });

  it('loads mock mode without a token', () => {
    process.env.MOCK_DASHBOARD = '1';
    process.env.DASHBOARD_PORT = '4123';
    delete process.env.DISCORD_TOKEN;
    delete process.env.DISCORD_CLIENT_ID;
    process.env.VERIFY_MESSAGE_ID = '111222333444555666';
    const env = loadEnv();
    assert.equal(env.mock, true);
    assert.equal(env.dashboardPort, 4123);
    assert.equal(env.verifyMessageId, '111222333444555666');
  });

  it('requires token and client id for the live bot', () => {
    process.env.MOCK_DASHBOARD = '0';
    delete process.env.DISCORD_TOKEN;
    delete process.env.DISCORD_CLIENT_ID;
    assert.throws(() => loadEnv(), /DISCORD_TOKEN/);
  });
});

describe('timeout duration parser', () => {
  it('parses minutes hours and days', () => {
    assert.equal(durationToMs('10m'), 10 * 60 * 1000);
    assert.equal(durationToMs('2h'), 2 * 60 * 60 * 1000);
    assert.equal(durationToMs('1d'), 86400000);
    assert.equal(durationToMs('30'), 30 * 60 * 1000);
  });
});
