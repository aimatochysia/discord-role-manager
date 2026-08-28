'use strict';

const path = require('path');
const express = require('express');
const { demoGuild } = require('../../fixtures/demo-guild');
const { resolveStructureAccess } = require('../services/access');
const { buildApplyPlan, summarizePlan } = require('../services/overwrites');
const { renderAccessMap } = require('../services/canvasMap');
const { buildStructure } = require('../services/structure');
const { applyPlanToGuild, buildGuildApplyPlan } = require('../services/apply');
const { executeModeration } = require('../services/moderation');
const { memberRankKeys, memberCan, CAPABILITIES } = require('../services/permissions');
const { RANKS, RANK_KEYS } = require('../config/ranks');
const { PROFILES } = require('../config/profiles');
const { sha256 } = require('../utils/crypto');

const PUBLIC = path.join(__dirname, 'public');

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (!key) continue;
    out[key] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `rm_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${12 * 3600}; SameSite=Lax`);
}

function metaLists() {
  return {
    ranks: RANK_KEYS.map((key) => ({
      key,
      label: RANKS[key].label,
      description: RANKS[key].description,
      color: RANKS[key].color,
      kind: RANKS[key].kind,
      priority: RANKS[key].priority
    })),
    profiles: Object.values(PROFILES).map((profile) => ({
      key: profile.key,
      label: profile.label,
      description: profile.description,
      color: profile.color
    }))
  };
}

function cloneDemo() {
  return structuredClone(demoGuild());
}

function mockResolved(state) {
  return resolveStructureAccess(
    {
      id: state.guild.id,
      name: state.guild.name,
      icon: state.guild.icon,
      memberCount: state.guild.memberCount,
      ownerId: state.guild.ownerId,
      categories: state.categories,
      uncategorized: state.uncategorized
    },
    state.rules,
    state.custom
  );
}

function createMockApp(env, logger) {
  const state = cloneDemo();
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(PUBLIC));

  app.get('/login', (_req, res) => res.sendFile(path.join(PUBLIC, 'login.html')));
  app.post('/auth/mock', (_req, res) => {
    setSessionCookie(res, 'mock-owner');
    res.redirect('/');
  });
  app.get('/auth/magic', (_req, res) => {
    setSessionCookie(res, 'mock-owner');
    res.redirect('/');
  });

  app.use('/api', (req, res, next) => {
    const token = parseCookies(req).rm_session;
    if (token !== 'mock-owner') return res.status(401).json({ error: 'Sign in required' });
    req.session = { userId: 'u-owner', guildId: state.guild.id };
    next();
  });

  app.get('/api/session', (_req, res) => {
    res.json({
      user: { id: 'u-owner', tag: 'preview-owner' },
      guildId: state.guild.id,
      guilds: [state.guild],
      mock: true
    });
  });

  app.get('/api/guilds/:id/state', (req, res) => {
    if (req.params.id !== state.guild.id) return res.status(404).json({ error: 'Unknown guild' });
    res.json({
      guild: state.guild,
      structure: mockResolved(state),
      bindings: state.bindings,
      roles: state.roles,
      settings: state.settings,
      requests: state.requests.filter((row) => row.status === 'pending'),
      audit: state.audit,
      ...metaLists()
    });
  });

  app.put('/api/guilds/:id/access', (req, res) => {
    const { targetType, targetId, profileKey, inherit, ranks } = req.body;
    const existing = state.rules.find((row) => row.target_type === targetType && row.target_id === targetId);
    const next = {
      target_type: targetType,
      target_id: targetId,
      profile_key: inherit ? 'inherit' : profileKey,
      inherit: Boolean(inherit)
    };
    if (existing) Object.assign(existing, next);
    else state.rules.push(next);
    if (profileKey === 'custom' && ranks) {
      state.custom = state.custom.filter((row) => !(row.target_type === targetType && row.target_id === targetId));
      for (const [rankKey, access] of Object.entries(ranks)) {
        state.custom.push({
          target_type: targetType,
          target_id: targetId,
          rank_key: rankKey,
          can_view: Boolean(access.view),
          can_send: Boolean(access.send)
        });
      }
    }
    state.audit.unshift({ id: Date.now(), actor: 'preview-owner', action: 'access_set', details: next, created_at: new Date().toISOString() });
    res.json({ ok: true });
  });

  app.put('/api/guilds/:id/ranks', (req, res) => {
    state.bindings[req.body.rankKey] = req.body.roleId;
    res.json({ ok: true });
  });

  app.put('/api/guilds/:id/settings', (req, res) => {
    Object.assign(state.settings, req.body);
    res.json({ ok: true });
  });

  app.post('/api/guilds/:id/requests/:rid/review', (req, res) => {
    const row = state.requests.find((item) => String(item.id) === String(req.params.rid));
    if (row) row.status = req.body.status;
    res.json({ ok: true });
  });

  app.post('/api/guilds/:id/access/apply', (_req, res) => {
    const resolved = mockResolved(state);
    const plan = buildApplyPlan(resolved, state.bindings, state.everyoneId);
    const summary = summarizePlan(plan);
    state.audit.unshift({
      id: Date.now(),
      actor: 'preview-owner',
      action: 'apply_access',
      details: summary,
      created_at: new Date().toISOString()
    });
    res.json({
      ok: true,
      mock: true,
      summary,
      message: `Preview: would write ${summary.targets} Discord overwrites (${summary.inherited} inherit, ${summary.explicit} explicit).`
    });
  });

  app.get('/api/guilds/:id/map.png', (req, res) => {
    const buffers = renderAccessMap(mockResolved(state));
    res.setHeader('Content-Type', 'image/png');
    res.send(buffers[0]);
  });

  app.get('/', (req, res) => {
    if (parseCookies(req).rm_session !== 'mock-owner') return res.redirect('/login');
    res.sendFile(path.join(PUBLIC, 'index.html'));
  });

  return new Promise((resolve) => {
    const server = app.listen(env.dashboardPort, '0.0.0.0', () => {
      logger.info({ port: env.dashboardPort }, 'Preview dashboard listening');
      resolve(server);
    });
  });
}

function createLiveApp(ctx) {
  const { env, logger, repos, client } = ctx;
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(PUBLIC));

  app.get('/login', (_req, res) => res.sendFile(path.join(PUBLIC, 'login.html')));

  app.get('/auth/magic', async (req, res) => {
    const token = String(req.query.token || '');
    if (!token) return res.redirect('/login');
    const session = await repos.getSession(sha256(token));
    if (!session) return res.status(401).send('Invalid or expired link. Run /dashboard in Discord.');
    setSessionCookie(res, token);
    res.redirect('/');
  });

  async function loadSession(req) {
    const token = parseCookies(req).rm_session;
    if (!token) return null;
    return repos.getSession(sha256(token));
  }

  app.get('/', async (req, res) => {
    const session = await loadSession(req);
    if (!session) return res.redirect('/login');
    res.sendFile(path.join(PUBLIC, 'index.html'));
  });

  app.use('/api', async (req, res, next) => {
    try {
      const session = await loadSession(req);
      if (!session) return res.status(401).json({ error: 'Sign in with /dashboard in Discord' });
      req.session = session;
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/session', async (req, res) => {
    const guilds = [];
    for (const guild of client.guilds.cache.values()) {
      const member = await guild.members.fetch(req.session.user_id).catch(() => null);
      if (!member) continue;
      const bindings = await repos.getBindings(guild.id);
      if (!memberCan(member, bindings, CAPABILITIES.VIEW_DASHBOARD, guild.ownerId)) continue;
      guilds.push({ id: guild.id, name: guild.name });
    }
    res.json({
      user: { id: req.session.user_id },
      guildId: req.session.guild_id || guilds[0]?.id || null,
      guilds,
      mock: false
    });
  });

  async function requireGuild(req, res) {
    const guild = client.guilds.cache.get(req.params.id);
    if (!guild) {
      res.status(404).json({ error: 'Guild not in cache. Invite the bot first.' });
      return null;
    }
    const member = await guild.members.fetch(req.session.user_id).catch(() => null);
    const bindings = await repos.getBindings(guild.id);
    if (!member || !memberCan(member, bindings, CAPABILITIES.VIEW_DASHBOARD, guild.ownerId)) {
      res.status(403).json({ error: 'No dashboard permission in this guild.' });
      return null;
    }
    return { guild, member, bindings };
  }

  app.get('/api/guilds/:id/state', async (req, res, next) => {
    try {
      const loaded = await requireGuild(req, res);
      if (!loaded) return;
      const { guild, bindings } = loaded;
      const [rules, custom, settings, requests, audit] = await Promise.all([
        repos.getRules(guild.id),
        repos.getCustom(guild.id),
        repos.getSettings(guild.id),
        repos.listRequests(guild.id, 'pending'),
        repos.listAudit(guild.id, 40)
      ]);
      if (!bindings.unverified) bindings.unverified = guild.id;
      const structure = resolveStructureAccess(buildStructure(guild), rules, custom);
      res.json({
        guild: { id: guild.id, name: guild.name, icon: guild.iconURL({ size: 64 }), memberCount: guild.memberCount },
        structure,
        bindings,
        roles: [...guild.roles.cache.values()].map((role) => ({ id: role.id, name: role.name, color: role.hexColor })),
        settings: settings || {},
        requests,
        audit,
        ...metaLists()
      });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/guilds/:id/access', async (req, res, next) => {
    try {
      const loaded = await requireGuild(req, res);
      if (!loaded) return;
      if (!memberCan(loaded.member, loaded.bindings, CAPABILITIES.MANAGE_ACCESS_CONFIG, loaded.guild.ownerId)) {
        return res.status(403).json({ error: 'Cannot edit access' });
      }
      const { targetType, targetId, profileKey, inherit, ranks } = req.body;
      await repos.upsertRule(loaded.guild.id, targetType, targetId, { profileKey: inherit ? 'inherit' : profileKey, inherit });
      if (profileKey === 'custom') await repos.replaceCustom(loaded.guild.id, targetType, targetId, ranks || {});
      await repos.addAudit(loaded.guild.id, req.session.user_id, 'access_set', { targetType, targetId, profileKey });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/guilds/:id/ranks', async (req, res, next) => {
    try {
      const loaded = await requireGuild(req, res);
      if (!loaded) return;
      if (!memberCan(loaded.member, loaded.bindings, CAPABILITIES.MANAGE_BOT_SETTINGS, loaded.guild.ownerId)) {
        return res.status(403).json({ error: 'Cannot bind ranks' });
      }
      await repos.setBinding(loaded.guild.id, req.body.rankKey, req.body.roleId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/guilds/:id/settings', async (req, res, next) => {
    try {
      const loaded = await requireGuild(req, res);
      if (!loaded) return;
      if (!memberCan(loaded.member, loaded.bindings, CAPABILITIES.MANAGE_VERIFICATION, loaded.guild.ownerId)) {
        return res.status(403).json({ error: 'Cannot edit settings' });
      }
      await repos.upsertSettings(loaded.guild.id, req.body);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/guilds/:id/requests/:rid/review', async (req, res, next) => {
    try {
      const loaded = await requireGuild(req, res);
      if (!loaded) return;
      if (!memberCan(loaded.member, loaded.bindings, CAPABILITIES.APPROVE_TRAINEE, loaded.guild.ownerId)) {
        return res.status(403).json({ error: 'Cannot review requests' });
      }
      const request = await repos.getRequest(req.params.rid);
      if (!request || request.guild_id !== loaded.guild.id) return res.status(404).json({ error: 'Not found' });
      if (req.body.status === 'approved') {
        const result = await executeModeration(loaded.guild, request);
        await repos.reviewRequest(request.id, { status: 'approved', reviewerId: req.session.user_id, note: result });
        return res.json({ ok: true, result });
      }
      await repos.reviewRequest(request.id, { status: 'denied', reviewerId: req.session.user_id });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/guilds/:id/access/apply', async (req, res, next) => {
    try {
      const loaded = await requireGuild(req, res);
      if (!loaded) return;
      if (!memberCan(loaded.member, loaded.bindings, CAPABILITIES.APPLY_ACCESS, loaded.guild.ownerId)) {
        return res.status(403).json({ error: 'Cannot apply overwrites' });
      }
      const { plan, summary } = await buildGuildApplyPlan(loaded.guild, repos);
      const result = await applyPlanToGuild(loaded.guild, plan);
      await repos.addAudit(loaded.guild.id, req.session.user_id, 'apply_access', { summary, errors: result.errors });
      res.json({
        ok: true,
        summary,
        errors: result.errors,
        message: `Wrote ${summary.targets} overwrites${result.errors.length ? ` with ${result.errors.length} errors` : ''}.`
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/guilds/:id/map.png', async (req, res, next) => {
    try {
      const loaded = await requireGuild(req, res);
      if (!loaded) return;
      const rules = await repos.getRules(loaded.guild.id);
      const custom = await repos.getCustom(loaded.guild.id);
      const structure = resolveStructureAccess(buildStructure(loaded.guild), rules, custom);
      const buffers = renderAccessMap(structure);
      res.setHeader('Content-Type', 'image/png');
      res.send(buffers[0]);
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    logger.error({ err: error }, 'Dashboard error');
    res.status(500).json({ error: error.message });
  });

  return new Promise((resolve) => {
    const server = app.listen(env.dashboardPort, '0.0.0.0', () => {
      logger.info({ port: env.dashboardPort }, 'Dashboard listening');
      resolve(server);
    });
  });
}

module.exports = { createMockApp, createLiveApp };
