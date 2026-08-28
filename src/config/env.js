'use strict';

require('dotenv').config();

function read(name, fallback) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return value;
}

function readBool(name, fallback = false) {
  const value = read(name, null);
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function loadEnv(overrides = {}) {
  const mock = readBool('MOCK_DASHBOARD', false) || overrides.mock === true;
  const dashboardPort = Number(read('DASHBOARD_PORT', '3000'));

  const base = {
    mock,
    nodeEnv: read('NODE_ENV', 'development'),
    logLevel: read('LOG_LEVEL', 'info'),
    dashboardPort: Number.isFinite(dashboardPort) ? dashboardPort : 3000,
    dashboardPublicUrl: read('DASHBOARD_PUBLIC_URL', `http://localhost:${dashboardPort || 3000}`),
    sessionSecret: read('SESSION_SECRET', 'dev-only-change-me'),
    databaseUrl: read('DATABASE_URL', 'postgres://rolebot:rolebot@localhost:5432/rolebot'),
    guildId: read('GUILD_ID', ''),
    verifyChannelId: read('VERIFY_CHANNEL_ID', ''),
    boosterCategoryId: read('BOOSTER_CATEGORY_ID', ''),
    newbieRoleId: read('NEWBIE_ROLE_ID', ''),
    logChannelId: read('LOG_CHANNEL_ID', ''),
    deployCommands: readBool('DEPLOY_COMMANDS', true),
    discordClientSecret: read('DISCORD_CLIENT_SECRET', '')
  };

  if (mock) {
    return {
      ...base,
      mock: true,
      discordToken: read('DISCORD_TOKEN', ''),
      discordClientId: read('DISCORD_CLIENT_ID', '')
    };
  }

  const discordToken = read('DISCORD_TOKEN', '');
  const discordClientId = read('DISCORD_CLIENT_ID', '');
  if (!discordToken) {
    throw new Error('DISCORD_TOKEN is required. Copy .env.example to .env.');
  }
  if (!discordClientId) {
    throw new Error('DISCORD_CLIENT_ID is required. Copy .env.example to .env.');
  }

  return {
    ...base,
    discordToken,
    discordClientId
  };
}

module.exports = { loadEnv, read, readBool };
