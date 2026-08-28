'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadEnv } = require('../src/config/env');
const { createLogger } = require('../src/utils/logger');
const { createMockApp } = require('../src/web/app');

describe('preview dashboard HTTP', () => {
  let server;
  let base = '';

  before(async () => {
    const env = loadEnv({ mock: true });
    env.dashboardPort = 0;
    env.logLevel = 'silent';
    server = await createMockApp(env, createLogger('silent'));
    const address = server.address();
    base = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves login and authenticates into the access GUI', async () => {
    const login = await fetch(`${base}/login`);
    assert.equal(login.status, 200);
    const loginHtml = await login.text();
    assert.match(loginHtml, /Open preview dashboard/);

    const auth = await fetch(`${base}/auth/mock`, { method: 'POST', redirect: 'manual' });
    assert.equal(auth.status, 302);
    const cookie = auth.headers.get('set-cookie');
    assert.match(cookie, /rm_session=/);

    const session = await fetch(`${base}/api/session`, { headers: { cookie } });
    assert.equal(session.status, 200);
    const body = await session.json();
    assert.equal(body.mock, true);
    assert.equal(body.guilds[0].name, 'Aether');

    const state = await fetch(`${base}/api/guilds/${body.guildId}/state`, { headers: { cookie } });
    const payload = await state.json();
    assert.ok(payload.structure.categories.length >= 8);
    const welcome = payload.structure.categories.find((item) => item.id === 'c-welcome');
    assert.equal(welcome.access.profileKey, 'gate');

    const apply = await fetch(`${base}/api/guilds/${body.guildId}/access/apply`, {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' }
    });
    const applied = await apply.json();
    assert.equal(applied.ok, true);
    assert.ok(applied.summary.targets > 10);
  });
});
