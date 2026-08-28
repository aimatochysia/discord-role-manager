'use strict';

const { Events } = require('discord.js');
const { routeInteraction } = require('./interactions');
const { grantNewbie, isVerifyEmoji, handleJoin } = require('../services/verification');
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
    for (const guild of readyClient.guilds.cache.values()) {
      try {
        await syncGuildBoosters(guild, repos);
      } catch (error) {
        logger.warn({ err: error, guildId: guild.id }, 'Booster sync failed');
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
      if (!isVerifyEmoji(reaction.emoji)) return;
      const guild = reaction.message.guild;
      if (!guild) return;
      const settings = await repos.getSettings(guild.id);
      if (!settings?.verify_message_id || settings.verify_message_id !== reaction.message.id) return;
      const member = await guild.members.fetch(user.id);
      const bindings = await repos.getBindings(guild.id);
      await grantNewbie(member, bindings, 'Verification reaction');
    } catch (error) {
      logger.warn({ err: error }, 'Verify reaction failed');
    }
  });
}

module.exports = { registerEvents };
