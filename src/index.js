'use strict';

const { loadEnv } = require('./config/env');
const { createLogger } = require('./utils/logger');
const { createDb, migrateLatest } = require('./db');
const { createRepos } = require('./db/repos');
const { createClient } = require('./bot/client');
const { commandCollection } = require('./bot/commands');
const { registerEvents } = require('./bot/events');
const { createMockApp, createLiveApp } = require('./web/app');

async function main() {
  const env = loadEnv();
  const logger = createLogger(env.logLevel);

  if (env.mock) {
    await createMockApp(env, logger);
    logger.info(`Open ${env.dashboardPublicUrl} — preview mode, no Discord token required`);
    return;
  }

  const knex = createDb();
  await migrateLatest(knex);
  logger.info('Migrations complete');

  const repos = createRepos(knex);
  const client = createClient();
  const commands = commandCollection();
  const ctx = { env, logger, knex, repos, client, commands };

  registerEvents(ctx);
  await createLiveApp(ctx);
  await client.login(env.discordToken);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { main };
