'use strict';

const { Events } = require('discord.js');
const { routeInteraction } = require('./interactions');
const {
  grantNewbie,
  isWatchedVerifyMessage,
  resolveVerifyBindings,
  prefetchVerifyMessage,
  handleJoin
} = require('../services/verification');
const { seedEnvDefaults } = require('../services/setup');
const { syncBoosterRole, syncGuildBoosters } = require('../services/booster');
const { deployCommands } = require('./deploy');

function registerEvents(ctx) {
  const { client, logger, repos, env } = ctx;

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info({ user: readyClient.user.tag, guilds: readyClient.guilds.cache.size }, 'Bot ready');
    if (env.deployCommands) {
      try {
        await deployCommands(env, ctx.commands);
        logger.info('Slash commands deployed');
      } catch (error) {
        logger.error({ err: error }, 'Failed to deploy commands');
      }
    }
    try {
      await prefetchVerifyMessage(readyClient, env, logger);
    } catch (error) {
      logger.warn({ err: error }, 'Could not fetch VERIFY_MESSAGE_ID — check VERIFY_CHANNEL_ID and that the bot can see that channel');
    }
    for (const guild of readyClient.guilds.cache.values()) {
      try {
        await seedEnvDefaults(guild, repos, env);
        await syncGuildBoosters(guild, repos);
      } catch (error) {
        logger.warn({ err: error, guildId: guild.id }, 'Guild boot sync failed');
      }
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      await routeInteraction(interaction, ctx);
    } catch (error) {
      logger.error({ err: error }, 'Interaction failed');
      const payload = { content: `Error: ${error.message}`, ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      await handleJoin(member, repos);
    } catch (error) {
      logger.warn({ err: error }, 'Join handler failed');
    }
  });

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      const settings = await repos.getSettings(newMember.guild.id);
      const bindings = await repos.getBindings(newMember.guild.id);
      await syncBoosterRole(newMember, bindings, settings?.auto_booster !== false);
    } catch (error) {
      logger.warn({ err: error }, 'Member update handler failed');
    }
  });

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
      const message = reaction.message;
      const guild = message.guild;
      if (!guild) return;
      const settings = await repos.getSettings(guild.id);
      if (!isWatchedVerifyMessage(message.id, env, settings)) return;
      const member = await guild.members.fetch(user.id);
      const bindings = await resolveVerifyBindings(guild, repos, env);
      await grantNewbie(member, bindings, 'Verification reaction');
    } catch (error) {
      logger.warn({ err: error }, 'Verify reaction failed');
    }
  });
}

module.exports = { registerEvents };
