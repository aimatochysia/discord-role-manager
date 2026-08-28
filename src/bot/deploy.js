'use strict';

const { REST, Routes } = require('discord.js');
const { loadCommands } = require('./commands');

async function deployCommands(env, commands) {
  const body = [...(commands?.values?.() ? commands.values() : loadCommands())].map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(env.discordToken);
  if (env.guildId) {
    await rest.put(Routes.applicationGuildCommands(env.discordClientId, env.guildId), { body });
    return { scope: 'guild', count: body.length };
  }
  await rest.put(Routes.applicationCommands(env.discordClientId), { body });
  return { scope: 'global', count: body.length };
}

async function main() {
  const { loadEnv } = require('../config/env');
  const { commandCollection } = require('./commands');
  const env = loadEnv();
  const result = await deployCommands(env, commandCollection());
  console.log(`Deployed ${result.count} commands (${result.scope}).`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { deployCommands };
