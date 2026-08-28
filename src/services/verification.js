'use strict';

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { embed, OK } = require('../utils/embeds');

async function grantNewbie(member, bindings, reason = 'Verification') {
  const newbieId = bindings.newbie;
  if (!newbieId) {
    throw new Error('Newbie role is not bound. Set NEWBIE_ROLE_ID in .env or run /setup roles.');
  }
  if (member.roles.cache.has(newbieId)) {
    return { already: true };
  }
  await member.roles.add(newbieId, reason);
  const unverifiedId = bindings.unverified;
  if (unverifiedId && unverifiedId !== member.guild.id && member.roles.cache.has(unverifiedId)) {
    await member.roles.remove(unverifiedId, reason).catch(() => null);
  }
  return { already: false };
}

function isVerifyEmoji(emoji) {
  return emoji?.name === '✅' || emoji?.identifier === '✅' || emoji?.name === 'white_check_mark';
}

function getWatchedVerifyMessageIds(env = {}, settings = null) {
  const ids = new Set();
  if (env.verifyMessageId) ids.add(String(env.verifyMessageId));
  if (settings?.verify_message_id) ids.add(String(settings.verify_message_id));
  return ids;
}

function isWatchedVerifyMessage(messageId, env = {}, settings = null) {
  if (!messageId) return false;
  return getWatchedVerifyMessageIds(env, settings).has(String(messageId));
}

async function resolveVerifyBindings(guild, repos, env = {}) {
  const bindings = await repos.getBindings(guild.id);
  if (!bindings.newbie && env.newbieRoleId) bindings.newbie = env.newbieRoleId;
  if (!bindings.unverified) bindings.unverified = guild.id;
  return bindings;
}

async function prefetchVerifyMessage(client, env, logger) {
  if (!env.verifyMessageId) return { skipped: true, reason: 'no_message_id' };
  if (!env.verifyChannelId) {
    logger?.info(
      { messageId: env.verifyMessageId },
      'VERIFY_MESSAGE_ID is set; set VERIFY_CHANNEL_ID too so the bot can cache the message on boot'
    );
    return { skipped: true, reason: 'no_channel_id' };
  }
  const channel = await client.channels.fetch(env.verifyChannelId);
  const message = await channel.messages.fetch(env.verifyMessageId);
  logger?.info(
    { channelId: channel.id, messageId: message.id },
    'Watching verification message — any reaction grants Newbie'
  );
  return { skipped: false, message };
}

function verificationEmbed(guildName) {
  return embed({
    title: `Welcome to ${guildName}`,
    description: [
      'New members can only see this channel until they accept the rules.',
      '',
      'React with any emoji **or** press the button below to receive **Newbie** and unlock the rest of the server.',
      '',
      'By verifying you agree to follow the rules posted here.'
    ].join('\n')
  }).setColor(OK);
}

function verificationComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rm:verify:accept')
        .setLabel('I accept — verify me')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    )
  ];
}

async function postVerificationPanel(channel, guildName) {
  const message = await channel.send({
    embeds: [verificationEmbed(guildName)],
    components: verificationComponents()
  });
  await message.react('✅').catch(() => null);
  return message;
}

async function handleJoin(member, repos) {
  const settings = await repos.getSettings(member.guild.id);
  if (!settings) return;
  const bindings = await repos.getBindings(member.guild.id);
  const unverifiedId = bindings.unverified;
  if (unverifiedId && unverifiedId !== member.guild.id) {
    await member.roles.add(unverifiedId, 'New member lockdown').catch(() => null);
  }
}

module.exports = {
  grantNewbie,
  isVerifyEmoji,
  getWatchedVerifyMessageIds,
  isWatchedVerifyMessage,
  resolveVerifyBindings,
  prefetchVerifyMessage,
  verificationEmbed,
  verificationComponents,
  postVerificationPanel,
  handleJoin
};
